import 'server-only';

// =============================================================================
// alerta-critica — cuando la plata se está quemando, MaKo NO se calla
// =============================================================================
// EL CASO (2026-08-12). La cuenta de Meta del dueño estaba con ENTREGA FRENADA
// —cero anuncios corriendo, cero leads entrando— y por WhatsApp no llegó nada.
// La pantalla de /integraciones lo mostraba en rojo desde hacía horas.
//
// La causa no era un bug sutil: **los avisos de Meta nunca estuvieron
// cableados**. `meta-cuenta-frenada`, `meta-token-vencido`, `meta-cuenta-riesgo`
// y `meta-saldo-agotarse` existían en `avisos-catalogo.ts` como texto, con su
// `disparador` documentado… y `grep` sobre lib/ y app/ devolvía CERO llamadas.
// Un catálogo de mensajes no es un sistema de alertas: alguien tiene que
// llamarlo. Se detectaba (los incidentes se guardaban en `service_incidents` y
// la pantalla los pintaba) y no se avisaba.
//
// ── POR QUÉ ESTE MÓDULO EXISTE APARTE DE `avisos.ts` ────────────────────────
//
// El motor de avisos está construido para NO repetirse: `dedupTtlMin` existe
// justamente para que el cron horario no cuente diez veces la misma cosa. Eso
// es correcto para el 95% de los mensajes y es exactamente lo contrario de lo
// que hace falta acá.
//
// Un anuncio pausado no es una noticia que se da una vez: es una hemorragia que
// sigue abierta. El dueño lo pidió con estas palabras: «cuando pasa esto tenemos
// que ser MUY PESADOS por WhatsApp, no solo el mensaje tiene que ser DRAMÁTICO
// sino que la frecuencia MUY alta hasta que se solucione».
//
// Así que acá el dedup se invierte: en vez de «no lo repitas», es «repetilo cada
// N minutos MIENTRAS siga pasando». Lo que corta la insistencia es UNA sola
// cosa: que el problema se resuelva.
//
// ── QUIÉN DECIDE QUÉ SE DICE Y HASTA CUÁNDO (16/10/2026) ────────────────────
//
// La automatización de SuperAdmin del evento `meta_cuenta_frenada`: su texto
// literal por estado y su techo («Aviso número ≤ 3» de fábrica, editable). Hasta
// ese día lo mandaba `emitirAviso` directo con el texto de este módulo, sin techo:
// el «18ª vez» del grupo de Mauricio (docs/inventario-nada-por-detras.md, lote 1).
// Acá queda lo que es del incidente: qué es crítico, cada cuánto se vuelve a
// emitir, la cuenta compartida y el «ya está».
// =============================================================================

import { getTenantDb } from './workspace';
import { getSetting, setSetting } from './settings';
import { zonaDelNegocioEstricta } from './timezone';
import { credWs } from './credenciales';
import { emitirEventoDePlataforma } from './avisos';
import { datosCuentaFrenada, marcaTrasEmitir, vecesDelEstado, tocaAvisar, necesitaLaZona, ventanaDelIncidente, llegoAlguno, type Insistencia } from './alerta-critica-texto';

/*
 * CADA CUÁNTO VUELVE A AVISAR mientras el problema siga abierto (`tocaAvisar`, lib/alerta-critica-texto.ts).
 *
 * El primer día, UNA HORA (`CADENCIA_MIN`), hasta el techo de la automatización. Lo bajó el dueño el 12/8 después de
 * verlo andando: la primera versión arrancaba cada 10 minutos y eso no es insistir, es tapar el grupo.
 *
 * ⚠️ DESDE EL SEGUNDO DÍA, UNO POR DÍA (27/10/2026, MAU-33; decidido por el Cerebro: «un incidente abierto varios días avisa
 * una vez por día, y uno resuelto avisa "ya está"»). Antes el techo de 3 se contaba sobre el incidente entero: a Mauricio le
 * salió «DETÉN TODO» 25 veces en 28 horas y después calló nueve días con la cuenta frenada. Ahora el techo es por día
 * (`ventana`) y lo que no se detiene es el recordatorio diario, hasta que se resuelva.
 */

/** Estado de la insistencia de UN incidente. Vive en settings, por workspace. */
/** Estado de la insistencia de UN incidente (`Insistencia`, lib/alerta-critica-texto.ts). Vive en settings, por workspace. */
const keyInsistencia = (incidenteId: number) => `mako.alerta.insistencia.${incidenteId}`;

type IncidenteAbierto = {
  id: number;
  service: string;
  severidad: string;
  status_label: string | null;
  disable_reason: string | null;
  entrega_frenada: boolean;
  balance_mxn: number | null;
  detalle: string | null;
  started_at: string;
  confirmado: boolean;
};

/**
 * ¿Este incidente amerita perseguir al cliente?
 *
 * DOS condiciones, y la primera se agregó pagando.
 *
 * 1. QUE SEA UN HECHO. `confirmado` (mig 0139) = Meta contestó y este es su
 *    estado. Un incidente que dice «no se pudo leer el estado» NO es un estado:
 *    es que nosotros no pudimos preguntar. Perseguir eso es anunciarle al cliente
 *    una avería que no existe — el 21/8/2026 le salieron cuatro mensajes a un
 *    cliente cuya cuenta estaba Activa y entregando, porque su
 *    META_AD_ACCOUNT_ID estaba guardado sin `act_` y la Graph API devolvía 400.
 *
 *    ⚠️ El guard va EN POSITIVO —«solo lo confirmado»— y no descartando el
 *    statusLabel que hoy sabemos que salió mal. La condición negativa protege un
 *    caso y deja pasar todos los que todavía no pasaron: el próximo error de
 *    lectura tendría otro texto y volvería a entrar sin que nada avise.
 *
 * 2. QUE CUESTE PLATA AHORA. Un ámbar («cuenta en revisión») avisa una vez y se
 *    calla: si todo insistiera, la insistencia dejaría de significar algo y el
 *    cliente terminaría silenciando el canal entero — el peor resultado posible.
 *    Y ahora sabemos que no es hipotético: la confianza se pierde con UN mensaje
 *    falso, no con veinte verdaderos.
 */
const esCritico = (i: IncidenteAbierto): boolean =>
  i.confirmado && (i.entrega_frenada || i.severidad === 'rojo');

export type ResultadoAlertas = {
  abiertos: number; criticos: number; avisados: number; resueltos: number; errores: number;
};

/**
 * Persigue los incidentes críticos abiertos de ESTE workspace y avisa los que
 * toca. Corre dentro de runWithWorkspace (lo llama el cron).
 */
export async function insistirAlertasCriticas(
  ws: number,
  opts: { cuentasYaAvisadas?: Set<string> } = {},
): Promise<ResultadoAlertas> {
  const out: ResultadoAlertas = { abiertos: 0, criticos: 0, avisados: 0, resueltos: 0, errores: 0 };
  const db = await getTenantDb();

  const { data, error } = await db
    .from('service_incidents')
    .select('id, service, severidad, status_label, disable_reason, entrega_frenada, balance_mxn, detalle, started_at, confirmado')
    .is('resolved_at', null);
  if (error) {
    console.error(`[alerta-critica] ws=${ws} no se pudieron leer los incidentes: ${error.message}`);
    out.errores += 1;
    return out;
  }

  const abiertos = (data ?? []) as IncidenteAbierto[];
  out.abiertos = abiertos.length;
  const abiertosIds = new Set(abiertos.map((i) => i.id));

  // ── Los que se RESOLVIERON: avisar una vez y limpiar el estado ─────────────
  // Se busca por la marca de insistencia, no por la tabla: si el incidente ya se
  // cerró, no aparece en la consulta de arriba. Sin este paso, MaKo persigue
  // veinte veces y después no dice que se arregló — y el dueño no sabe si dejó
  // de avisar porque se resolvió o porque se rompió el aviso.
  try {
    const { data: cerrados } = await db
      .from('service_incidents')
      .select('id, service')
      .not('resolved_at', 'is', null)
      .order('resolved_at', { ascending: false })
      .limit(10);
    for (const c of (cerrados ?? []) as Array<{ id: number; service: string }>) {
      if (abiertosIds.has(c.id)) continue;
      const key = keyInsistencia(c.id);
      const marca = await getSetting(key).catch(() => null);
      if (!marca) continue; // nunca se insistió por este: no hay nada que cerrar
      // El evento de la plataforma `meta_cuenta_recuperada` (16/10/2026): su automatización de SuperAdmin tiene el texto.
      // Sólo si le LLEGÓ alguna alerta (`veces`): decir «ya está» de algo que nunca se avisó es otro mensaje sin contexto.
      // ⚠️ Y SALE ANTES DE BORRAR LA MARCA (revisión del 16/10/2026): sin poder leer las automatizaciones, la marca queda y el
      // próximo tick lo vuelve a intentar. Borrándola primero, el «ya está» se perdía para siempre.
      // Las de TODO el incidente (`total`), no las del último día: con el aviso diario, el día en que se resolvió puede no
      // haber salido ninguno todavía.
      const llegaronAlertas = llegoAlguno(JSON.parse(marca) as Partial<Insistencia>);
      if (c.service === 'meta' && llegaronAlertas) {
        const r = await emitirEventoDePlataforma('meta-cuenta-recuperada', { ws });
        if (!r.ok) { out.errores += 1; continue; }
      }
      await setSetting(key, '').catch(() => {});
      out.resueltos += 1;
    }
  } catch (e) {
    console.error(`[alerta-critica] ws=${ws} cierre: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ⚠️ LA ALERTA ES SOBRE UNA CUENTA PUBLICITARIA, NO SOBRE UN WORKSPACE.
  //
  // El dueño lo vio a los minutos de desplegar: le llegaba DOS VECES, en dos
  // grupos. No era un bug de ruteo — cada mensaje fue al grupo correcto de su
  // workspace. Lo que pasa es que dos workspaces apuntan a la MISMA cuenta de
  // Meta: `Cliente de Prueba` (ws3) tiene su propia copia de las credenciales
  // (`credenciales`, clave META_AD_ACCOUNT_ID), que es justamente lo que lo
  // hace útil como cliente de prueba. Una cuenta suspendida es UN problema; que
  // dos workspaces la miren no lo convierte en dos.
  //
  // Se dedupea por el ID de la cuenta y no excluyendo el workspace de prueba, y
  // eso NO es un detalle: un guard negativo («todos menos ws3») se queda viejo
  // con el próximo cliente al que se le copien credenciales, y encima se queda
  // viejo en silencio (AGENTS.md — «un guard se escribe en POSITIVO»).
  //
  // Gana el PRIMER workspace de la iteración, que es el de menor id: el dueño.
  // Los demás igual registran su incidente —la pantalla de cada uno tiene que
  // decir la verdad— pero no vuelven a avisar por WhatsApp.
  // Va DESPUÉS del cierre de los resueltos, a propósito: si este workspace ya
  // venía insistiendo, tiene que poder decir «ya está» y limpiar su marca. Un
  // corte más arriba lo dejaría con la insistencia colgada para siempre.
  const cuentaId = (await credWs('META_AD_ACCOUNT_ID', ws).catch(() => null))?.trim() || null;
  const yaAvisadas = opts.cuentasYaAvisadas;
  const cuentaTomada = Boolean(cuentaId && yaAvisadas?.has(cuentaId));
  if (cuentaTomada) console.log(`[alerta-critica] ws=${ws} comparte la cuenta ${cuentaId} con otro workspace ya avisado — no repito`);
  // La zona del negocio: el recordatorio de cada día sale de día ahí (`tocaAvisar`). ⚠️ ESTRICTA (la verificación de
  // 69b49a31c, 29/10/2026; AGENTS.md «Una zona, un default»): `zonaDelNegocio` no tira y, sin poder leer, daba Tijuana, así
  // que el recordatorio de un negocio argentino podía caer a las 23:00. Sin poder leerla, esta vuelta no manda lo que la zona
  // decide (`necesitaLaZona`: el recordatorio de un día que no es el primero; el cron vuelve en 10 min). El primer aviso sale
  // igual, y la cuenta queda tomada: otro negocio con la misma cuenta no avisa con SU reloj.
  let tz: string | null = null;
  let zonaIlegible = false;
  if (abiertos.length) {
    try { tz = await zonaDelNegocioEstricta(ws); } catch (e) {
      zonaIlegible = true;
      console.error(`[alerta-critica] ws=${ws}: no pude leer la zona (${e instanceof Error ? e.message : String(e)}) — no aviso en esta vuelta`);
    }
  }


  // ── Los que siguen abiertos: perseguir ────────────────────────────────────
  for (const inc of abiertos) {
    if (!esCritico(inc)) continue;
    out.criticos += 1;
    if (cuentaTomada) continue;
    // ⚠️ LA CUENTA QUEDA TOMADA AUNQUE A ESTE WORKSPACE NO LE TOQUE AVISAR TODAVÍA (24/10/2026). Se marcaba sólo en la vuelta
    // en que éste emitía: en las otras cinco de la hora (el cron corre cada 10 min, la cadencia es de 60), el siguiente
    // workspace de la misma cuenta la veía libre y avisaba con SU reloj. Medido en producción: Mauricio (ws1) y «Cliente de
    // Diseño» (ws4), la misma cuenta impaga, emitían cada hora con media hora de diferencia. No llegaba doble sólo porque
    // ws4 no tiene grupo.
    if (cuentaId) yaAvisadas?.add(cuentaId);
    try {
      const key = keyInsistencia(inc.id);
      const raw = await getSetting(key).catch(() => null);
      const estado: Insistencia | null = raw ? (JSON.parse(raw) as Insistencia) : null;

      const desdeMs = Date.now() - Date.parse(inc.started_at);
      const minAbierto = Math.max(0, Math.round(desdeMs / 60_000));
      // Los que llegaron del ESTADO y del DÍA de ahora (un empeoramiento vuelve a avisar, y un día nuevo también:
      // `vecesDelEstado`). Con eso el `anuncios_vez` del primero de cada día es 1 y pasa el techo de la automatización.
      const ventana = ventanaDelIncidente(minAbierto);
      const veces = vecesDelEstado(estado, inc.status_label, ventana);
      if (zonaIlegible && necesitaLaZona(estado, minAbierto)) continue;

      if (!tocaAvisar(estado, minAbierto, veces, Date.now(), tz)) continue; // todavía no toca

      // EL EVENTO DE LA PLATAFORMA (16/10/2026): los HECHOS del incidente, y la automatización de SuperAdmin dice qué
      // contar de cada estado y hasta cuántas veces (`anuncios_vez`, la CONDITION «Aviso número ≤ 3»). ⚠️ SIN `dedupTtlMin`,
      // a propósito: el ritmo es el de acá (`tocaAvisar`), y el dedup lo callaría.
      const res = await emitirEventoDePlataforma('meta-cuenta-frenada', {
        ws,
        datos: datosCuentaFrenada(
          { statusLabel: inc.status_label, disableReason: inc.disable_reason, entregaFrenada: inc.entrega_frenada, confirmado: inc.confirmado },
          minAbierto, veces,
        ),
      });
      // La marca se escribe DESPUÉS de emitir, y sólo un aviso que LLEGÓ suma al techo (`marcaTrasEmitir`): si no se pudo
      // emitir, el próximo ciclo reintenta; si se emitió y no llegó (sin automatización, sin grupo), vuelve en la próxima
      // cadencia sin gastar avisos.
      const marca = marcaTrasEmitir(estado, inc.status_label, res, new Date().toISOString(), ventana);
      if (marca) {
        await setSetting(key, JSON.stringify(marca)).catch(() => {});
        // La cuenta ya quedó tomada arriba, también cuando el aviso está apagado o llegó al techo: que otro workspace lo
        // grite por la misma cuenta es exactamente lo que se apagó.
        if (marca.veces > veces) out.avisados += 1;
      } else {
        out.errores += 1;
        console.error(`[alerta-critica] ws=${ws} incidente ${inc.id}: no se pudo emitir el evento — no se leyeron las automatizaciones de la plataforma`);
      }
    } catch (e) {
      out.errores += 1;
      console.error(`[alerta-critica] ws=${ws} incidente ${inc.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return out;
}
