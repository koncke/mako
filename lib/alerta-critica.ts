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
// ── LO QUE SÍ SE RESPETA ────────────────────────────────────────────────────
//
// El interruptor de Configuraciones › Notificaciones. Si el dueño apaga este
// aviso, se calla — porque insistir contra alguien que dijo «no» no es
// insistencia, es un canal roto que no se puede frenar. Lo maneja `emitirAviso`.
// =============================================================================

import { getTenantDb } from './workspace';
import { getSetting, setSetting } from './settings';
import { emitirAviso, emitirDelCatalogo } from './avisos';
import { encabezadoAviso } from './avisos-catalogo';
import { APP_BASE_URL } from './app-url';
import { textoAlerta, textoRecuperada, causaDe } from './alerta-critica-texto';

/**
 * CADA CUÁNTO VUELVE A AVISAR, según hace cuánto que el problema está abierto.
 *
 * No baja de 15 minutos ni siquiera después de un día. Es a propósito y va en
 * contra de lo que hace todo el mundo (bajar la frecuencia para no molestar):
 * mientras la entrega está frenada, cada hora de silencio es un día de leads
 * perdido. Si molesta, se resuelve — que es el punto.
 */
const CADENCIA: ReadonlyArray<{ hastaMin: number; cadaMin: number }> = [
  { hastaMin: 60, cadaMin: 10 },        // la 1ª hora: cada 10 minutos
  { hastaMin: 6 * 60, cadaMin: 15 },    // hasta 6 h: cada 15
  { hastaMin: Infinity, cadaMin: 20 },  // de ahí en más: cada 20, para siempre
];

const cadaCuanto = (minAbierto: number): number =>
  (CADENCIA.find((c) => minAbierto < c.hastaMin) ?? CADENCIA[CADENCIA.length - 1]).cadaMin;

/** Estado de la insistencia de UN incidente. Vive en settings, por workspace. */
const keyInsistencia = (incidenteId: number) => `mako.alerta.insistencia.${incidenteId}`;
type Insistencia = { ultimaIso: string; veces: number };

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
};

/**
 * ¿Este incidente amerita perseguir al dueño?
 *
 * SOLO lo que le está costando plata AHORA. Un ámbar («cuenta en revisión»)
 * avisa una vez y se calla: si todo insistiera, la insistencia dejaría de
 * significar algo y el dueño terminaría silenciando el canal entero — que es el
 * peor resultado posible.
 */
const esCritico = (i: IncidenteAbierto): boolean => i.entrega_frenada || i.severidad === 'rojo';

export type ResultadoAlertas = {
  abiertos: number; criticos: number; avisados: number; resueltos: number; errores: number;
};

/**
 * Persigue los incidentes críticos abiertos de ESTE workspace y avisa los que
 * toca. Corre dentro de runWithWorkspace (lo llama el cron).
 */
export async function insistirAlertasCriticas(ws: number): Promise<ResultadoAlertas> {
  const out: ResultadoAlertas = { abiertos: 0, criticos: 0, avisados: 0, resueltos: 0, errores: 0 };
  const db = await getTenantDb();

  const { data, error } = await db
    .from('service_incidents')
    .select('id, service, severidad, status_label, disable_reason, entrega_frenada, balance_mxn, detalle, started_at')
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
      await setSetting(key, '').catch(() => {});
      if (c.service === 'meta') {
        await emitirDelCatalogo('meta-cuenta-recuperada', {
          ws,
          texto: `${encabezadoAviso('meta-cuenta-recuperada')}
${textoRecuperada()}`,
        });
      }
      out.resueltos += 1;
    }
  } catch (e) {
    console.error(`[alerta-critica] ws=${ws} cierre: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ── Los que siguen abiertos: perseguir ────────────────────────────────────
  for (const inc of abiertos) {
    if (!esCritico(inc)) continue;
    out.criticos += 1;
    try {
      const key = keyInsistencia(inc.id);
      const raw = await getSetting(key).catch(() => null);
      const estado: Insistencia | null = raw ? (JSON.parse(raw) as Insistencia) : null;

      const desdeMs = Date.now() - Date.parse(inc.started_at);
      const minAbierto = Math.max(0, Math.round(desdeMs / 60_000));
      const veces = estado?.veces ?? 0;

      if (estado) {
        const desdeUltimo = (Date.now() - Date.parse(estado.ultimaIso)) / 60_000;
        if (desdeUltimo < cadaCuanto(minAbierto)) continue; // todavía no toca
      }

      // ⚠️ SIN `dedupTtlMin`, a propósito: el dedup es lo que hay que saltear acá.
      // Y sin `emitirDelCatalogo`, porque ese camino puede pasar el texto por la
      // IA cuando el dueño editó la plantilla — un mensaje de emergencia no se
      // reescribe cada quince minutos ni depende de que un proveedor conteste.
      const res = await emitirAviso({
        ws,
        tipo: 'meta-cuenta-frenada',
        // El título del feed in-app dice la CAUSA, no el síntoma: es la misma
        // corrección que en el WhatsApp («suspendida por falta de pago» le dice
        // al dueño qué hacer; «dejó de entregar», no).
        titulo: causaDe({ statusLabel: inc.status_label, disableReason: inc.disable_reason, entregaFrenada: inc.entrega_frenada })
          .titular.replace(/\*/g, ''),
        texto: `${encabezadoAviso('meta-cuenta-frenada')}\n${textoAlerta(
          { statusLabel: inc.status_label, disableReason: inc.disable_reason, entregaFrenada: inc.entrega_frenada },
          minAbierto, veces, `${APP_BASE_URL}/integraciones`,
        )}`,
        categoria: 'aviso',
        semaforo: 'rojo',
        link: '/integraciones',
      });
      // La marca se escribe DESPUÉS del envío: si falló, el próximo ciclo
      // reintenta en vez de esperar la cadencia completa. Y también cuando el
      // dueño lo tiene apagado (`res.apagado`), para no reintentar en loop algo
      // que él silenció.
      if (res.wa || res.apagado) {
        await setSetting(key, JSON.stringify({ ultimaIso: new Date().toISOString(), veces: veces + 1 } satisfies Insistencia)).catch(() => {});
        if (res.wa) out.avisados += 1;
      } else {
        out.errores += 1;
        console.error(`[alerta-critica] ws=${ws} incidente ${inc.id}: el WhatsApp no salió — ${res.waError ?? 'sin motivo'}`);
      }
    } catch (e) {
      out.errores += 1;
      console.error(`[alerta-critica] ws=${ws} incidente ${inc.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return out;
}
