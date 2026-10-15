// =============================================================================
// setting-secuencias — fetch, estrategia y prueba en vivo de la tab /setting
// =============================================================================
// La ESTRATEGIA (lib/setting-estrategia.ts) vive en nutricion_secuencias.estrategia.
// Acá: getSecuencias (secuencias + estrategia + métricas 30d), guardarEstrategia,
// crearSecuenciaDesdeEtapa (la de la API, colgada de una etapa) y probarSecuencia (manda los
// mensajes de UN escenario —14/10/2026; antes, todos los pasos— al contacto del admin, marcados
// [PRUEBA], SIN tocar inscripciones ni nutricion_envios: cero contaminación de KPIs y del guard anti-ban).

import 'server-only';
import { getTenantDb } from './workspace';
import { leerTodo, type ConsultaPaginada } from './supabase-paginado';
import { getSecuenciasConStats, reentradaDeSecuencia, type SecuenciaConStats } from './nutricion';
import type { Reentrada } from './reentrada';
import { TRIGGER_ETAPA, TRIGGER_ENTREGA, TRIGGER_ETIQUETA, normalizarEtapas } from './nutricion-etapa';
import { esNodoDeControl, mediaDeAdjunto, esColumnaInexistente } from './nutricion-grafo-motor';
import { getAdjunto, adjuntoBase64 } from './setting-adjuntos';
import { sanearCron, proximaOcurrencia } from './cron-aviso';
import { tzActual, TZ_DEFAULT } from './timezone';
import { listarFunnels, getFunnelDe, getFunnelDefault, productoDeFunnel } from './funnels';
import { nombreVisible } from './lead-funnel-reglas';
import { entregasDeProductos } from './entrega-servicio';
import type { EntregaConfig } from './servicio-etapas';
import { parseEstrategia, nombreDeSecuencia, type Estrategia } from './setting-estrategia';
import { agregarMetricas, serieDiaria, METRICAS_CERO, type FilaEnvio, type FilaInsc, type MetricasSecuencia, type PuntoSerie } from './setting-metricas';
import { getContactoReportes } from './perfil';
import { getInstanciaRow } from './evolution';
import { enviarYEspejar, enviarAudioYEspejar, enviarMediaYEspejar } from './evolution-envio';
import { getAudio, audioBase64 } from './setting-audios';
import { sendEmail, renderEmailHtml, remitenteEsSandbox } from './resend';
import { aplicarVariables } from './template-vars';
import { datosDeEjemplo, escenariosDeLaSecuencia, mensajesDelEscenario } from './simulador-grafo';
import { esCanalSocial, NOMBRE_CANAL } from './canal-social';
import { esPasoAccion } from './nutricion-paso-accion';
import { partesDe } from './mensaje-partes';
import { emojiDeSecuencia } from './flujo-conversacion';
import { leerPosicionesSecuencias, type DbPosiciones } from './secuencia-posiciones';
import type { Posiciones } from './lienzo-posiciones';
import { leerBorradoresSecuencias, firmaPublicado, type DbBorrador } from './secuencia-borrador';
import type { PasoGrafo } from './flujo-grafo';
import { SOLO_DESDE_EL_CRON, MOTIVO_SOLO_DESDE_EL_CRON, TRIGGERS_DEL_EMISOR, MOTIVO_CRON_FIJO } from './disparadores';
import { pasosDeEsqueleto } from './setting-semillas';

export type SecuenciaConEstrategia = Omit<SecuenciaConStats, 'estrategia'> & {
  estrategia: Estrategia | null; metricas: MetricasSecuencia;
  /**
   * La «Reentrada» que el motor USA (`reentradaDeSecuencia`): la guardada (`reentrada`), o sin guardar la regla de antes.
   * El panel del CRON la muestra como la elegida, así que la regla de antes no queda escondida (lib/reentrada.ts).
   */
  reentrada_efectiva: Reentrada;
  /** El emoji del título (mig 0229). null = el del objetivo, que lo pone la pantalla. */
  emoji: string | null;
  /**
   * Dónde puso la persona cada tarjeta del lienzo (mig 0233, lib/secuencia-posiciones.ts). `{}` =
   * ninguna movida; `null` = NO SE PUDIERON LEER (falta la columna o falló la consulta): el lienzo se
   * dibuja como siempre y no guarda, para no pisar lo que no se leyó.
   */
  posiciones: Posiciones | null;
  /**
   * Lo que quedó a medio armar en el lienzo, sin publicar (mig 0240, lib/secuencia-borrador.ts): el
   * borrador VIGENTE (`borradorVigente`). `null` = no hay. AUSENTE = no se pudo leer (falta la columna
   * o falló la consulta): la pantalla abre lo publicado y no guarda borradores.
   */
  borrador?: { pasos: PasoGrafo[]; guardado_at: string } | null;
  /**
   * La huella de lo publicado que trae este GET (`firmaPublicado`, lib/secuencia-borrador.ts): la pestaña
   * la manda con cada borrador, y si ya no es lo publicado el server no lo guarda (`desactualizado`). Va
   * JUNTO con `borrador`: ausente los dos cuando no se pudieron leer (y la pantalla no guarda).
   */
  base?: string;
};

/**
 * LOS EMOJIS DE LAS SECUENCIAS (mig 0229), en una consulta APARTE de `getSecuenciasConStats`
 * (lib/nutricion.ts, que es de otra parte y lo leen el motor y la API de MaKo: sumarle una columna
 * ahí la volvería obligatoria para el cron). Una lectura por pantalla, sin paginar a propósito: son
 * las automatizaciones de UN negocio, decenas, nunca mil.
 *
 * ⚠️ UN ERROR TIRA (también la columna que falta: la 0229 va ANTES del deploy). «No pude leer» no es
 * «no tiene emoji»: devolver vacío pintaría el del objetivo sobre uno elegido, y el primer guardado
 * de otra cosa no lo borraría, pero la pantalla mentiría.
 */
async function emojisDeSecuencias(supabase: Awaited<ReturnType<typeof getTenantDb>>): Promise<Map<number, string>> {
  const { data, error } = await supabase.from('nutricion_secuencias').select('id, emoji').is('archivada_at', null);
  if (error) throw new Error(`emojisDeSecuencias: ${error.message}`);
  const out = new Map<number, string>();
  for (const r of (data ?? []) as Array<{ id: number; emoji: string | null }>) {
    const e = emojiDeSecuencia(r.emoji);
    if (e) out.set(Number(r.id), e);
  }
  return out;
}

/** Guarda el emoji del título (null = vuelve al del objetivo). Uno que no es un emoji, 400. El
 *  saneo es UNA función pura (`emojiDeSecuencia`, lib/flujo-conversacion.ts), con test. */
export async function setEmojiSecuencia(secuenciaId: number, emoji: unknown): Promise<void> {
  const e = emoji == null || emoji === '' ? null : emojiDeSecuencia(emoji);
  if (emoji != null && emoji !== '' && !e) throw new TriggerInvalidoError('Ese no es un emoji.');
  const supabase = await getTenantDb();
  const { data, error } = await supabase
    .from('nutricion_secuencias')
    .update({ emoji: e, updated_at: new Date().toISOString() })
    .eq('id', secuenciaId)
    .select('id');
  if (error) throw new Error(`setEmojiSecuencia: ${error.message}`);
  if (!data?.length) throw new TriggerInvalidoError('Esa automatización no existe en este negocio.');
}

/** Secuencias + métricas 30d + la serie diaria del workspace (una sola pasada). */
export async function getSettingData(): Promise<{ secuencias: SecuenciaConEstrategia[]; serie: PuntoSerie[] }> {
  const supabase = await getTenantDb();
  const desde = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
  // Paginado por `id`. Eran dos `.select()` sueltos: nutricion_envios suma hasta
  // 40 filas por día por workspace, así que la ventana de 30 días cruza las 1000
  // en semanas, y la tabla de inscripciones se lee ENTERA. Pasado el techo,
  // PostgREST devuelve 1000 y un 200: las métricas y la serie diaria de /setting
  // salían calculadas sobre una muestra, sin ningún aviso.
  const [secs, filasEnvio, filasInsc] = await Promise.all([
    getSecuenciasConStats(),
    leerTodo<FilaEnvio>(supabase, 'nutricion_envios', 'secuencia_id, canal, estado, abierto_at, clic_at, created_at', {
      orden: 'id', filtros: (q) => q.gte('created_at', desde) as ConsultaPaginada,
    }),
    leerTodo<FilaInsc>(supabase, 'nutricion_inscripciones', 'secuencia_id, estado, updated_at', { orden: 'id' }),
  ]);
  const met = agregarMetricas(filasEnvio, filasInsc);
  // Las posiciones y los borradores van aparte y tolerantes (no tiran): ver `leerPosicionesSecuencias`
  // y `leerBorradoresSecuencias`. `null` = no se pudieron leer, que no es «ninguno».
  const [emojis, posiciones, borradores] = await Promise.all([
    emojisDeSecuencias(supabase),
    leerPosicionesSecuencias(supabase as unknown as DbPosiciones),
    leerBorradoresSecuencias(supabase as unknown as DbBorrador),
  ]);
  const secuencias = secs.map((s) => ({
    ...s,
    estrategia: parseEstrategia(s.estrategia),
    metricas: met.get(s.id) ?? { ...METRICAS_CERO },
    emoji: emojis.get(s.id) ?? null,
    reentrada_efectiva: reentradaDeSecuencia(s),
    posiciones: posiciones ? (posiciones.get(s.id) ?? {}) : null,
    // Sin poder leerlos, la clave NO va: la pantalla distingue «no hay» (null) de «no sé» (ausente) y
    // en el segundo caso no guarda, para no pisar un borrador que no vio.
    //
    // ⚠️ Y LA BASE VA CON ÉL, CALCULADA ACÁ (revisión, 10/10/2026): es la huella de lo que la pestaña
    // ABRE, y el server compara contra ella al guardar. `s.pasos` es la columna cruda
    // (`getSecuenciasConStats`), la misma que lee `guardarBorradorSecuencia`: con dos lecturas distintas,
    // ningún borrador se guardaría nunca.
    ...(borradores ? { borrador: borradores.get(s.id) ?? null, base: firmaPublicado(s.pasos) } : {}),
  }));
  return { secuencias, serie: serieDiaria(filasEnvio, filasInsc, new Date().toISOString()) };
}

export async function getSecuencias(): Promise<SecuenciaConEstrategia[]> {
  return (await getSettingData()).secuencias;
}

export async function guardarEstrategia(secuenciaId: number, estrategia: Estrategia): Promise<void> {
  const supabase = await getTenantDb();
  const { data } = await supabase.from('nutricion_secuencias').select('id').eq('id', secuenciaId).maybeSingle();
  if (!data) throw new Error('Esa secuencia no existe en este workspace.');
  const { error } = await supabase
    .from('nutricion_secuencias')
    .update({ estrategia, updated_at: new Date().toISOString() })
    .eq('id', secuenciaId);
  if (error) throw new Error(`guardarEstrategia: ${error.message}`);
}

/**
 * Secuencia nueva colgada de una etapa del funnel (funnel-agnóstica, trigger 'etapa_actual'). La
 * crea la operación `crear_secuencia_mensajes` de la API de MaKo. Nace PAUSADA con 2 mensajes de
 * esqueleto que se escriben en el lienzo; activarla la prende.
 *
 * ⚠️ NACE COMO TARJETAS (sexta tanda, 09/10/2026, General 15: plantillas «con configuraciones viejas
 * obsoletas»). Era una LISTA de antes —la espera de 48 h como campo del segundo mensaje, que desde el
 * 08/10 es una tarjeta DELAY (y desde la sexta, la pastilla sobre la flecha)— con un relleno que
 * remitía al «paso de redacción» de un wizard que ya no existe. El lienzo la abría convertida y
 * «Sin publicar» sin que nadie la tocara. La conversión es la MISMA que hace el lienzo al abrirla
 * (`abrirFlujo`); sin estrategia, no hay nada que limpiar (ver `estrategiaConLimpieza`).
 */
export async function crearSecuenciaDesdeEtapa(etapa: string, nombre: string): Promise<number> {
  const supabase = await getTenantDb();
  const clave = `secuencia-${etapa}-${Date.now().toString(36)}`;
  const { data, error } = await supabase
    .from('nutricion_secuencias')
    .insert({ clave, nombre: nombreDeSecuencia(nombre), etapa, trigger_tipo: 'etapa_actual', activa: false, pasos: pasosDeEsqueleto() })
    .select('id')
    .single();
  if (error) throw new Error(`crearSecuenciaDesdeEtapa: ${error.message}`);
  return (data as { id: number }).id;
}

/** El nombre con el que nace una automatización vacía (crear con IA lo reemplaza). */
export const NOMBRE_PROVISORIO = 'Nueva automatización';

/**
 * UNA AUTOMATIZACIÓN VACÍA Y PAUSADA: lo que crea «＋ Nueva» (08/10/2026, decisión 14 de
 * docs/chatbot-flujo-ramas-diseno.md). Abre el lienzo con sólo el CRON y la caja de crear con IA.
 *
 * ⚠️ SIN PASOS DE RELLENO, a propósito: `crearSecuenciaDesdeEtapa` (arriba) siembra dos pasos con
 * «[Escribe este mensaje…]», y ese corchete hace que el paso no salga NUNCA (`RX_RELLENO`,
 * lib/nutricion.ts). Crear con IA exige una automatización VACÍA para escribir encima, y una que
 * se arme a mano empieza tocando el ＋ del CRON.
 *
 * ⚠️ Y CON `trigger_tipo: 'manual'`: es el único disparador que no inscribe a nadie
 * (`TRIGGERS_APARTE` en lib/flujo-conversacion.ts no lo ofrece por eso). Nace pausada igual: un
 * canal propone, una persona confirma (decisión 16).
 */
export async function crearSecuenciaVacia(nombre?: string | null): Promise<{ id: number; nombre: string }> {
  const supabase = await getTenantDb();
  const n = nombreDeSecuencia(nombre ?? '') || NOMBRE_PROVISORIO;
  const clave = `automatizacion-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const { data, error } = await supabase
    .from('nutricion_secuencias')
    .insert({ clave, nombre: n, etapa: 'manual', trigger_tipo: 'manual', activa: false, pasos: [] })
    .select('id')
    .single();
  if (error) throw new Error(`crearSecuenciaVacia: ${error.message}`);
  return { id: (data as { id: number }).id, nombre: n };
}

/**
 * Renombrar una secuencia.
 *
 * ⚠️ CAMBIA EL NOMBRE, NUNCA LA CLAVE. La `clave` es con lo que el desenlace de OTRA
 * secuencia la nombra (`logradoSecuencia`), así que renombrarla rompería el encadenado
 * en silencio — es la regla de la casa sobre referenciar por nombre, y acá ya la
 * pagamos una vez con el nodo «Sigue con» dibujado roto.
 */
/**
 * EL HORARIO DE UNA SECUENCIA: la mitad «por tiempo» del disparador (mig 0192).
 *
 * `null` la devuelve a disparar POR UNA ACCIÓN, que es lo que hacen hoy las 62 filas.
 *
 * ⚠️ LA ZONA SE RESUELVE ACÁ Y LA PRÓXIMA OCURRENCIA SE SIEMBRA ACÁ, igual que en
 * `lib/avisos-programados.ts` y por el mismo motivo: el motor itera workspaces con el
 * `ws` por parámetro, así que resolver la zona ahí sería preguntarle al inquilino del
 * CONTEXTO —que para un cron es el dueño— y el horario de cada cliente se movería solo
 * el día que `tzDeWorkspace` contestara otra cosa.
 *
 * ⚠️ Y SE SIEMBRA SIN DISPARAR. `decidirAgenda` devuelve `toca: false` cuando siembra,
 * pero sembrar desde acá es mejor: si el horario naciera sin ocurrencia, la primera
 * corrida del cron la escribiría y la persona tendría que esperar DOS ciclos para ver
 * algo. Poner un horario tampoco dispara en el momento: la primera ocurrencia es
 * estrictamente posterior a ahora (`proximaOcurrencia`).
 */
export async function setCronSecuencia(secuenciaId: number, cron: unknown): Promise<void> {
  const c = cron == null ? null : sanearCron(cron);
  if (cron != null && !c) throw new Error('Ese horario no se entiende: elige la unidad de la lista.');
  const supabase = await getTenantDb();
  await exigirQueNoSeaDelEmisor(supabase, secuenciaId, 'setCronSecuencia');
  const ahora = new Date();
  const tz = c ? await tzActual().catch(() => TZ_DEFAULT) : TZ_DEFAULT;
  const { error } = await supabase
    .from('nutricion_secuencias')
    .update({
      cron: c,
      cron_proxima_at: c ? proximaOcurrencia(c, ahora, tz, ahora).toISOString() : null,
      updated_at: ahora.toISOString(),
    })
    .eq('id', secuenciaId);
  if (error) throw new Error(`setCronSecuencia: ${error.message}`);
}

/**
 * El nombre como se guarda (sin espacios de más, tope 40). Se mudó a lib/setting-estrategia.ts en la undécima
 * tanda: lo usan también la lista y el título del lienzo, que son del cliente. Sigue saliendo de acá para los
 * que ya lo importaban (app/api/chat-agent/secuencias, lib/flujo-ia-crear.ts).
 */
export { nombreDeSecuencia };

/** El renombre no tocó ninguna fila: el id no es de este negocio, o la automatización está archivada. */
export class SecuenciaNoExisteError extends Error {}

/**
 * RENOMBRA una automatización viva de ESTE negocio. ⚠️ Mira cuántas filas tocó (undécima tanda, punto 5): un id
 * ajeno o archivado contestaba «ok» sin cambiar nada, y «Renombrar» del «⋯» lo mostraba como guardado.
 * Vacío → `TriggerInvalidoError` (400); ninguna fila → `SecuenciaNoExisteError` (404).
 */
export async function renombrarSecuencia(secuenciaId: number, nombre: string): Promise<void> {
  const n = nombreDeSecuencia(nombre);
  if (!n) throw new TriggerInvalidoError('El nombre no puede quedar vacío.');
  const supabase = await getTenantDb();
  const { data, error } = await supabase
    .from('nutricion_secuencias')
    .update({ nombre: n, updated_at: new Date().toISOString() })
    .eq('id', secuenciaId)
    .is('archivada_at', null)
    .select('id');
  if (error) throw new Error(`renombrarSecuencia: ${error.message}`);
  if (!data?.length) throw new SecuenciaNoExisteError('No existe');
}

/**
 * Los PRODUCTOS del workspace con las etapas de cada uno, para el desplegable del
 * disparador. Un producto es un embudo (mig 0170/0171) y sus etapas son las que el
 * dueño configuró en /funnel, así que esto no inventa un catálogo: lee el que ya hay.
 *
 * ⚠️ EL NOMBRE QUE SE MUESTRA ES EL DEL PRODUCTO, NO EL DEL EMBUDO. «Funnel principal»
 * lo escribió la migración y es igual en todos los workspaces: quien mira piensa en su
 * producto. Es la misma lección que ya está escrita en `FunnelResumen.producto`.
 *
 * Las etapas de SALIDA (band 'salidas': perdido, descalificado) no se ofrecen: colgar
 * una secuencia de mensajes de «perdido» es escribirle a quien dijo que no.
 */
export type ProductoConEtapas = {
  /**
   * El embudo. `null` = un producto que se ENTREGA (tiene kanban en Customer Success) y no es
   * el principal de ningún embudo: sólo trae `etapasEntrega`, y el selector de producto de la
   * VENTA no lo lista (no tiene etapas de venta que elegir).
   */
  funnelId: number | null;
  /** El id del PRODUCTO, que no es el del embudo. `null` = ese embudo no vende uno. */
  productoId: number | null;
  nombre: string;
  esDefault: boolean;
  /** Las etapas del EMBUDO: por dónde pasa el lead antes de comprar. */
  etapas: Array<{ value: string; label: string }>;
  /**
   * Las etapas de la ENTREGA del servicio (mig 0188): por dónde pasa el CLIENTE
   * después de comprar. Vacío si ese embudo no tiene producto.
   *
   * ⚠️ `origenEntrega: 'default'` significa que el cliente todavía NO configuró sus
   * etapas y está viendo las de fábrica. Colgar una secuencia de una de esas es
   * legítimo —son las que su kanban dibuja hoy— pero el día que las edite, la clave
   * puede dejar de existir: `nuevaClaveEtapa` nunca reusa una borrada, así que la
   * secuencia queda apuntando a NINGUNA etapa, que es lo correcto y se puede detectar.
   */
  etapasEntrega: Array<{ value: string; label: string }>;
  origenEntrega: 'declarado' | 'default' | null;
};

export async function productosConEtapas(): Promise<ProductoConEtapas[]> {
  const funnels = await listarFunnels();
  const delFunnel = await productoDeFunnel(funnels.map((f) => f.id))
    .catch(() => new Map<number, { id: number; nombre: string }>());
  const entregas = await entregasDeProductos([...delFunnel.values()].map((p) => p.id))
    .catch(() => new Map<number, EntregaConfig>());
  const out: ProductoConEtapas[] = [];
  for (const f of funnels) {
    // El default se lee con `getFunnelDefault` (es el camino que ya cachea la pantalla);
    // el resto por id. Son pocas filas —6 en producción— y se piden una vez por carga.
    const cfg = f.esDefault ? await getFunnelDefault().catch(() => null) : await getFunnelDe(f.id).catch(() => null);
    const prod = delFunnel.get(f.id) ?? null;
    const entrega = prod ? entregas.get(prod.id) ?? null : null;
    out.push({
      funnelId: f.id,
      productoId: prod?.id ?? null,
      nombre: nombreVisible(f),
      esDefault: f.esDefault,
      etapas: (cfg?.stages ?? [])
        .filter((st) => (st.band ?? 'pipeline') !== 'salidas')
        .map((st) => ({ value: st.key, label: st.label })),
      etapasEntrega: (entrega?.etapas ?? []).map((et) => ({ value: et.key, label: et.label })),
      origenEntrega: entrega?.origen ?? null,
    });
  }

  /**
   * ⚠️ LOS PRODUCTOS QUE SE ENTREGAN Y NO SON EL PRINCIPAL DE NINGÚN EMBUDO. Recorriendo sólo
   * los embudos, un servicio sin embudo —medido: el ws13 tiene tres productos nacidos antes
   * de la cadena producto → oferta → embudo, y una entrega real sobre uno— tenía kanban en
   * Customer Success y no aparecía acá: no había forma de colgarle una secuencia. Salen de la
   * MISMA lista que ofrece Customer Success (`productosDeLaEntrega`), así que el editor ofrece
   * exactamente los tableros que existen. Si esa lectura falla, el editor queda como antes.
   */
  const cubiertos = new Set(out.map((x) => x.productoId).filter((n): n is number => n != null));
  const sueltos = (await import('@/app/customer-success/entrega')
    .then((m) => m.productosDeLaEntrega())
    .catch(() => [] as Array<{ id: number; nombre: string }>))
    .filter((p) => !cubiertos.has(p.id));
  if (sueltos.length) {
    const deSueltos = await entregasDeProductos(sueltos.map((p) => p.id))
      .catch(() => new Map<number, EntregaConfig>());
    for (const p of sueltos) {
      const entrega = deSueltos.get(p.id) ?? null;
      out.push({
        funnelId: null, productoId: p.id, nombre: p.nombre, esDefault: false, etapas: [],
        etapasEntrega: (entrega?.etapas ?? []).map((et) => ({ value: et.key, label: et.label })),
        origenEntrega: entrega?.origen ?? null,
      });
    }
  }
  return out;
}

/**
 * «Si un lead cae en ESTA etapa de ESTE producto, disparate» — el disparador de una
 * secuencia, elegido por el dueño.
 *
 * Pedido de Martín (05/10/2026): «esto debería leer eso y que el usuario pueda elegir que
 * si cae en dicha etapa, se dispare esa secuencia». Antes la etapa se fijaba al CREAR la
 * secuencia y no se podía cambiar, y el producto no se podía elegir nunca: las 62 filas de
 * producción tienen `funnel_id` NULL, o sea «todos los productos», porque ninguna pantalla
 * ofrecía el dato.
 *
 * ⚠️ VALIDA QUE LA ETAPA EXISTA EN ESE PRODUCTO, Y NO ES UN LUJO. Una etapa de otro embudo
 * es una combinación imposible: la secuencia queda colgada de una key que ese funnel no
 * tiene y no dispara NUNCA — sin error, sin aviso, y leyéndose como «la secuencia no
 * funciona». La regla de la casa es que eso se ataja al guardar y no en el log de un cron.
 *
 * `funnelId = null` es «todos los productos», y es una elección explícita del dueño: la
 * secuencia le aplica a cualquier lead que caiga en una etapa con esa key.
 *
 * ⚠️ UNA O VARIAS ETAPAS (cuarta tanda, punto 14; mig 0230), y TODAS del MISMO kanban: el ámbito es
 * UN embudo (`funnelId`), así que mezclar adquisición con entrega o dos productos no se puede ni
 * escribir. Cada una se valida igual que la de siempre; una sola que no existe frena el guardado
 * entero (guardar «las que sí» sería decidir por la persona cuáles quería).
 */
export async function setDisparadorEtapa(secuenciaId: number, etapa: string | readonly string[], funnelId: number | null): Promise<void> {
  const keys = typeof etapa === 'string' ? normalizarEtapas([etapa]) : normalizarEtapas(etapa);
  if (!keys.length) throw new Error('Elige la etapa que dispara la secuencia.');

  const productos = await productosConEtapas();
  for (const key of keys) {
    if (funnelId == null) {
      // «Todos los productos»: la etapa tiene que existir en ALGUNO, o es una key muerta.
      const existe = productos.some((pr) => pr.etapas.some((e) => e.value === key));
      if (!existe) throw new Error(`La etapa «${key}» no existe en ninguno de tus funnels.`);
    } else {
      const pr = productos.find((x) => x.funnelId === funnelId);
      if (!pr) throw new Error('Ese funnel no existe o está archivado.');
      if (!pr.etapas.some((e) => e.value === key)) {
        throw new Error(`«${key}» no es una etapa de ${pr.nombre}: elige una de las suyas.`);
      }
    }
  }

  // `producto_id` se limpia por lo mismo que allá se limpia `funnel_id`, y la etiqueta también:
  // un disparador viejo escrito al lado del nuevo es un ámbito que nadie ve.
  await escribirDisparador(secuenciaId, { trigger_tipo: TRIGGER_ETAPA, funnel_id: funnelId, producto_id: null, etiqueta_id: null }, keys, 'setDisparadorEtapa');
}

/**
 * ⚠️ UNA FILA DEL EMISOR (el recordatorio de la reunión, un evento de MaKo: `TRIGGERS_DEL_EMISOR`) NO SE
 * TOCA POR ACÁ (11/10/2026). Su CRON es lo que lee su emisor: cambiarle el disparador o ponerle un horario
 * la dejaría muda para el emisor y la convertiría en una automatización del motor con tarjetas que el motor
 * no sabe correr. Lo mismo que `problemaDeCambio` para la lista de CRON (lib/disparadores-guardar.ts). Las
 * puertas de acá son tres (`setTriggerSecuencia`, `setDisparadorEtapa`, `setDisparadorEntrega`: las tres
 * escriben por `escribirDisparador`) más `setCronSecuencia`.
 */
async function exigirQueNoSeaDelEmisor(supabase: Awaited<ReturnType<typeof getTenantDb>>, secuenciaId: number, quien: string): Promise<void> {
  const { data, error } = await supabase.from('nutricion_secuencias').select('trigger_tipo').eq('id', secuenciaId).maybeSingle();
  if (error) throw new Error(`${quien}: ${error.message}`);
  const t = (data as { trigger_tipo?: string | null } | null)?.trigger_tipo;
  if (t && TRIGGERS_DEL_EMISOR.has(t)) throw new TriggerInvalidoError(`${MOTIVO_CRON_FIJO}.`);
}

/**
 * ESCRIBE UN DISPARADOR CON SUS ETAPAS: `etapa` = la primera (para los lectores viejos) y `etapas` =
 * la lista si son dos o más, o null si es una (null = «una sola, la de `etapa`», que es lo que dicen
 * todas las filas de antes). Para los disparadores sin etapa (`keys` vacío) limpia `etapas` y NO toca
 * `etapa` (la columna es NOT NULL y nadie la lee con esos triggers).
 *
 * ⚠️ SIEMPRE ESCRIBE `etapas`, también para borrarla: una lista vieja que sobrevive a un cambio de
 * disparador vuelve a mandar el día que alguien elija de nuevo la misma primera etapa.
 *
 * ⚠️ Y TOLERA LA 0230 SIN APLICAR SÓLO DONDE NO SE PIERDE NADA: con una etapa (o ninguna) vuelve a
 * escribir sin la columna, que es exactamente lo de antes; con varias, contesta «Aún no se pueden
 * varias etapas» (guardar sólo la primera sería guardar otra cosa que la elegida, en silencio).
 */
async function escribirDisparador(
  secuenciaId: number,
  base: Record<string, unknown>,
  keys: readonly string[],
  quien: string,
): Promise<void> {
  const supabase = await getTenantDb();
  await exigirQueNoSeaDelEmisor(supabase, secuenciaId, quien);
  const conEtapa = keys.length ? { etapa: keys[0] } : {};
  const upd = { ...base, ...conEtapa, updated_at: new Date().toISOString() };
  const { error } = await supabase.from('nutricion_secuencias').update({ ...upd, etapas: keys.length > 1 ? [...keys] : null }).eq('id', secuenciaId);
  if (!error) return;
  if (!esColumnaInexistente(error)) throw new Error(`${quien}: ${error.message}`);
  if (keys.length > 1) throw new TriggerInvalidoError('Aún no se pueden varias etapas.');
  console.warn(`[setting-secuencias] ${quien}: falta nutricion_secuencias.etapas (mig 0230); se guardó sin ella`);
  const { error: e2 } = await supabase.from('nutricion_secuencias').update(upd).eq('id', secuenciaId);
  if (e2) throw new Error(`${quien}: ${e2.message}`);
}

/**
 * «Si un CLIENTE llega a ESTA etapa de la entrega de ESTE producto, disparate».
 *
 * Es la hermana de `setDisparadorEtapa` y es una función aparte, no un parámetro más:
 * son dos disparadores distintos (`etapa_actual` / `entrega_actual`) que escriben dos
 * columnas distintas (`funnel_id` / `producto_id`) porque el ámbito de uno es el embudo
 * y el del otro el producto. El porqué entero, en lib/nutricion-etapa.ts.
 *
 * ⚠️ EL PRODUCTO NO ES OPCIONAL ACÁ. En la venta, `funnel_id` NULL significa «todos los
 * embudos» y es el estado de las 62 filas de hoy; en la entrega, una etapa suelta no
 * quiere decir nada sin el producto —«hito 2» es de UN servicio— y el motor directamente
 * no enrola sin él (`secuenciasDeEntrega` devuelve [] con el producto vacío). Ofrecer
 * «todos los productos» acá sería ofrecer una configuración que no dispara nunca.
 *
 * Una o VARIAS etapas de la entrega de ESTE producto (punto 14), cada una validada.
 */
export async function setDisparadorEntrega(secuenciaId: number, etapa: string | readonly string[], productoId: number): Promise<void> {
  const keys = typeof etapa === 'string' ? normalizarEtapas([etapa]) : normalizarEtapas(etapa);
  if (!keys.length) throw new Error('Elige la etapa de la entrega que dispara la secuencia.');
  if (!Number.isFinite(productoId) || productoId <= 0) throw new Error('Elige de qué producto es la entrega.');

  const pr = (await productosConEtapas()).find((x) => x.productoId === productoId);
  if (!pr) throw new Error('Ese producto no existe o está archivado.');
  for (const key of keys) {
    if (!pr.etapasEntrega.some((e) => e.value === key)) {
      throw new Error(`«${key}» no es una etapa de la entrega de ${pr.nombre}: elige una de las suyas.`);
    }
  }

  // `funnel_id` se LIMPIA: una secuencia es de venta o es de entrega, y dejar el
  // embudo puesto deja un ámbito viejo escrito al lado del nuevo.
  await escribirDisparador(secuenciaId, { trigger_tipo: TRIGGER_ENTREGA, producto_id: productoId, funnel_id: null, etiqueta_id: null }, keys, 'setDisparadorEntrega');
}

/** Lo que llega para cambiar el disparador de una secuencia (POST `{action:'trigger'}`). */
export type CambioDeTrigger = {
  trigger_tipo: string;
  etapa?: string | null;
  /** VARIAS etapas del mismo kanban (punto 14). Con dos o más, manda sobre `etapa`. */
  etapas?: readonly string[] | null;
  producto_id?: number | null;
  /** AUSENTE = no se toca el embudo de la secuencia; `null` = «todos los embudos» (una elección). */
  funnel_id?: number | null;
  etiqueta_id?: number | null;
};

/** El disparador no se puede guardar así: un error del que guarda (la ruta lo contesta 400). */
export class TriggerInvalidoError extends Error {
  constructor(m: string) { super(m); this.name = 'TriggerInvalidoError'; }
}

/**
 * «QUÉ LO DISPARA», elegido en el desplegable del CRON (08/10/2026, punto 5: «eso debe ser un
 * desplegable para seleccionar las acciones que pueden disparar esa automatización»).
 *
 * Valida contra el catálogo (`TRIGGERS`, lib/email-marketing.ts) más los tres que traen un dato
 * propio, y cada uno escribe SÓLO su ámbito y limpia los demás:
 *   · `etapa_actual`   → `setDisparadorEtapa` (la etapa tiene que existir en ese producto);
 *   · `entrega_actual` → `setDisparadorEntrega` (el producto no es opcional);
 *   · `etiqueta_puesta` → la etiqueta tiene que ser de ESTE negocio y no estar archivada
 *     (`crm_etiquetas`, mig 0224). `etiqueta_id` no tiene FK (mig 0223): esta es la puerta.
 *   · el resto (las cohortes de siempre y `manual`) → el trigger y el embudo (null = todos).
 *
 * Una combinación imposible se ataja acá y no en el log de un cron (AGENTS.md): una secuencia
 * colgada de una etiqueta que no existe no dispara NUNCA, sin un error.
 */
export async function setTriggerSecuencia(secuenciaId: number, c: CambioDeTrigger): Promise<void> {
  const tipo = String(c.trigger_tipo ?? '').trim();
  // Una o VARIAS etapas (punto 14): la lista manda si trae algo; si no, la etapa de siempre.
  const etapas = normalizarEtapas(c.etapas ?? null);
  const pedidas: string | string[] = etapas.length ? etapas : String(c.etapa ?? '');
  if (tipo === TRIGGER_ETAPA) {
    const fid = c.funnel_id == null ? null : Number(c.funnel_id);
    if (fid != null && !Number.isFinite(fid)) throw new TriggerInvalidoError('Ese funnel no existe.');
    try { return await setDisparadorEtapa(secuenciaId, pedidas, fid); }
    catch (e) { throw new TriggerInvalidoError(e instanceof Error ? e.message : String(e)); }
  }
  if (tipo === TRIGGER_ENTREGA) {
    const pid = Number(c.producto_id);
    if (!Number.isFinite(pid) || pid <= 0) throw new TriggerInvalidoError('Elige de qué producto es la entrega.');
    try { return await setDisparadorEntrega(secuenciaId, pedidas, pid); }
    catch (e) { throw new TriggerInvalidoError(e instanceof Error ? e.message : String(e)); }
  }
  const { TRIGGERS } = await import('./email-marketing');
  // La etiqueta la suma al catálogo la parte de etiquetas; hasta que esté, se acepta por su constante.
  const valido = tipo === TRIGGER_ETIQUETA || TRIGGERS.some((t) => t.value === tipo);
  if (!valido) throw new TriggerInvalidoError(`«${tipo || '(vacío)'}» no es un disparador de las secuencias.`);
  // Instagram, Messenger, el email que llega y el Recurrente al grupo necesitan su evento o su horario,
  // que sólo arma el CRON (lib/disparadores-guardar.ts): elegidos por esta puerta quedarían mudos.
  if (SOLO_DESDE_EL_CRON.has(tipo)) throw new TriggerInvalidoError(MOTIVO_SOLO_DESDE_EL_CRON);
  // ⚠️ `funnel_id` AUSENTE NO ES `null` (revisión del 08/10/2026). El desplegable del CRON no
  // ofrece producto para un evento ni para una etiqueta, y no lo manda: con `num(undefined)` →
  // null se escribía «todos los embudos» y una secuencia del producto B pasaba a inscribir leads
  // de todos los productos en la próxima corrida, sin que nadie lo eligiera. Ausente = no se toca;
  // `null` explícito = «todos», que sí es una elección.
  const tocaEmbudo = c.funnel_id !== undefined;
  const funnelId = c.funnel_id == null ? null : Number(c.funnel_id);
  if (funnelId != null && (!Number.isFinite(funnelId) || funnelId <= 0)) throw new TriggerInvalidoError('Ese funnel no existe.');
  const supabase = await getTenantDb();
  let etiquetaId: number | null = null;
  if (tipo === TRIGGER_ETIQUETA) {
    etiquetaId = Number(c.etiqueta_id);
    if (!Number.isInteger(etiquetaId) || etiquetaId <= 0) throw new TriggerInvalidoError('Elige la etiqueta que dispara la automatización.');
    const { data, error } = await supabase.from('crm_etiquetas').select('id, archivada_at').eq('id', etiquetaId).maybeSingle();
    if (error) throw new Error(`setTriggerSecuencia (etiqueta): ${error.message}`);
    const et = data as { id: number; archivada_at: string | null } | null;
    if (!et) throw new TriggerInvalidoError('Esa etiqueta no existe en este negocio.');
    if (et.archivada_at) throw new TriggerInvalidoError('Esa etiqueta está archivada.');
  }
  // Sin etapa: `etapas` se LIMPIA (`escribirDisparador` con `keys` vacío), por lo mismo que se limpia
  // el producto — una lista vieja escrita al lado del disparador nuevo es un ámbito que nadie ve.
  await escribirDisparador(secuenciaId, { trigger_tipo: tipo, etiqueta_id: etiquetaId, ...(tocaEmbudo ? { funnel_id: funnelId } : {}), producto_id: null }, [], 'setTriggerSecuencia');
}

// ── Prompts del wizard (editables en /configuraciones vía prompt-registry) ────

export const SETTING_GANCHO_TEMPLATE = `Eres MaKo armando una secuencia de mensajes de setting. El negocio: {{perfil}}.
Objetivo de la secuencia de mensajes: {{objetivo}}. Etapa del lead: {{etapa}}.
Propón 3 GANCHOS concretos (lead magnet, oferta puntual, motivo de re-contacto) que este negocio puede ofrecer YA — nada genérico y nada de inventar recursos que no existen: derívalos del perfil. Máximo 15 palabras cada uno.
Devuelve EXCLUSIVAMENTE un objeto JSON con esta forma: {"sugerencias": ["...", "...", "..."]}`;

export const SETTING_CRITERIO_TEMPLATE = `Eres MaKo deduciendo el CRITERIO DE CALIFICACIÓN de un negocio a partir de sus datos reales. El negocio: {{perfil}}.

Esto es lo que pasó con los leads que ya fueron evaluados en su CRM (respuestas del formulario de agenda, si el dueño los marcó como calificados, y si cerraron):
{{datos}}

Deduce qué separa a un cliente ideal de uno que no sirve, y devuélvelo como reglas que un setter pueda aplicar leyendo una conversación de WhatsApp.
Reglas: básate SOLO en los patrones que ves en los datos y en el perfil del negocio — no inventes umbrales de facturación ni de tamaño que no aparezcan. Si los datos no alcanzan para una regla, no la escribas. Cada regla en una frase corta y verificable en un chat.
Devuelve EXCLUSIVAMENTE un objeto JSON con esta forma: {"califica": ["...", "..."], "descalifica": ["...", "..."]}`;

export const SETTING_PREGUNTAS_TEMPLATE = `Eres MaKo armando la cualificación por WhatsApp de una secuencia de mensajes de setting. El negocio: {{perfil}}.
Objetivo: {{objetivo}}. Etapa del lead: {{etapa}}.
Propón 4 PREGUNTAS de cualificación cerradas y cortas (responderlas toma menos de 15 segundos), en el orden en que un setter las haría, que separen a un lead calificado de uno que no. Sin preguntas obvias ni invasivas.
Devuelve EXCLUSIVAMENTE un objeto JSON con esta forma: {"sugerencias": ["...", "...", "...", "..."]}`;

// ── Criterio de calificación: MaKo lo deduce de los datos reales ─────────────
// En la reunión decidieron cancelar las llamadas de los no calificados, pero
// NUNCA definieron el criterio: vive en la cabeza de Mauricio. Esto lo saca de
// donde sí hay evidencia — los leads que el dueño YA marcó calificado/no, con
// las respuestas de su formulario de agenda y el desenlace.

export type MuestraCalificacion = {
  calificado: boolean | null; cerro: boolean | null;
  respuesta_facturacion: string | null; respuesta_colaboradores: string | null;
  respuesta_objetivo: string | null; respuesta_inversion: string | null; respuesta_decisor: string | null;
};

/** Los leads ya evaluados del workspace, para que MaKo deduzca el patrón. */
export async function muestraParaCriterio(limite = 60): Promise<MuestraCalificacion[]> {
  const supabase = await getTenantDb();
  const cols = 'calificado, cerro, respuesta_facturacion, respuesta_colaboradores, respuesta_objetivo, respuesta_inversion, respuesta_decisor';
  const [evaluados, cerrados] = await Promise.all([
    supabase.from('leads').select(cols).not('calificado', 'is', null).limit(limite),
    // Los que cerraron son la evidencia más fuerte de "cliente ideal", aunque
    // nadie los haya marcado a mano.
    supabase.from('leads').select(cols).eq('cerro', true).limit(limite),
  ]);
  const filas = [...((evaluados.data ?? []) as MuestraCalificacion[]), ...((cerrados.data ?? []) as MuestraCalificacion[])];
  // Dedup por combinación de respuestas + desenlace (sin id no hay clave mejor).
  const vistos = new Set<string>();
  return filas.filter((f) => {
    const k = JSON.stringify(f);
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

/** Texto compacto de la muestra para el prompt (evita mandar JSON crudo enorme). */
export function muestraATexto(filas: MuestraCalificacion[]): string {
  if (!filas.length) return '(el CRM todavía no tiene leads marcados como calificados o cerrados)';
  const linea = (f: MuestraCalificacion) => [
    f.calificado === true ? 'CALIFICADO' : f.calificado === false ? 'NO CALIFICADO' : 'sin marcar',
    f.cerro === true ? 'cerró' : f.cerro === false ? 'no cerró' : null,
    f.respuesta_facturacion ? `factura: ${f.respuesta_facturacion}` : null,
    f.respuesta_colaboradores ? `equipo: ${f.respuesta_colaboradores}` : null,
    f.respuesta_inversion ? `inversión: ${f.respuesta_inversion}` : null,
    f.respuesta_decisor ? `decisor: ${f.respuesta_decisor}` : null,
    f.respuesta_objetivo ? `objetivo: ${String(f.respuesta_objetivo).slice(0, 90)}` : null,
  ].filter(Boolean).join(' · ');
  const si = filas.filter((f) => f.calificado === true).length;
  const no = filas.filter((f) => f.calificado === false).length;
  return `Resumen: ${si} calificados, ${no} no calificados, ${filas.filter((f) => f.cerro === true).length} cerraron.\n\n${filas.map((f) => `- ${linea(f)}`).join('\n')}`;
}

// ── Prueba en vivo ───────────────────────────────────────────────────────────

export type ResultadoPrueba =
  | { ok: true; enviadosWa: number; enviadosEmail: number; avisos: string[] }
  | { ok: false; error: string };

/**
 * EL ESCENARIO QUE SE PRUEBA (14/10/2026): los mensajes que le llegan a un lead por UN camino de la automatización
 * (`escenariosDeLaSecuencia` + `mensajesDelEscenario`, lib/simulador-grafo.ts: lo MISMO que «Probar» y que
 * `escenarios_secuencia`), en orden. Hasta ese día la prueba mandaba cada mensaje del array, con las ramas que se
 * excluyen juntas. `escenario`: el número (1 = el de un lead recién llegado por su CRON); ausente, el 1. `total`:
 * cuántos hay, para que quien pide sepa si tenía que elegir.
 */
export async function escenarioDePrueba(secuenciaId: number, escenario: number | null = null): Promise<
  | { ok: true; sec: SecuenciaConStats; numero: number; total: number; camino: readonly string[]; mensajes: SecuenciaConStats['pasos'] }
  | { ok: false; error: string }
> {
  const secs = await getSecuenciasConStats();
  const sec = secs.find((s) => s.id === secuenciaId);
  if (!sec) return { ok: false, error: 'Esa secuencia no existe en este workspace.' };
  if (!sec.pasos.length) return { ok: false, error: 'La secuencia no tiene pasos para probar.' };
  const { pasos, escenarios } = escenariosDeLaSecuencia(sec, (clave) => secs.find((x) => x.clave === clave)?.id ?? null);
  const numero = escenario ?? 1;
  const elegido = escenarios[numero - 1];
  if (!elegido) {
    return { ok: false, error: escenarios.length ? `Esa automatización tiene ${escenarios.length} ${escenarios.length === 1 ? 'escenario' : 'escenarios'}: elige del 1 al ${escenarios.length}.` : 'Esa automatización no tiene ningún camino para probar.' };
  }
  // Un paso «⚡ Acción de MaKo» no se prueba: correrlo ESCRIBE de verdad (mueve un lead, crea
  // una tarea) y la prueba manda los MENSAJES al admin, nada más. Sin este filtro salía un
  // WhatsApp «[PRUEBA n/N] » en blanco por cada acción, porque su cuerpo se guarda vacío.
  // Ni una tarjeta de CONTROL (condición, espera, «Si responde», «Ir a»): no manda nada.
  const mensajes = mensajesDelEscenario(pasos, elegido.elecciones)
    .filter((p) => !esPasoAccion(p) && !esNodoDeControl(p)) as unknown as SecuenciaConStats['pasos'];
  return { ok: true, sec, numero, total: escenarios.length, camino: elegido.pasos, mensajes };
}

export async function probarSecuencia(secuenciaId: number, op: { escenario?: number | null } = {}): Promise<ResultadoPrueba> {
  const e = await escenarioDePrueba(secuenciaId, op.escenario ?? null);
  if (!e.ok) return { ok: false, error: e.error };
  const { sec, mensajes } = e;
  if (!mensajes.length) return { ok: false, error: 'Por ese camino no le llega ningún mensaje al lead: no hay nada que probar.' };

  const contacto = await getContactoReportes();
  if (!contacto.telefono && !contacto.email) {
    return { ok: false, error: 'Carga tu teléfono y email en Perfil para recibir la prueba.' };
  }

  const avisos: string[] = [];
  let enviadosWa = 0;
  let enviadosEmail = 0;
  // El número es la POSICIÓN en el escenario (1 de N): `orden` es la del array, con las otras ramas adentro.
  const total = mensajes.length;
  // El catálogo entero del «{ }» con sus ejemplos y, encima, el nombre de quien prueba (`datosDeEjemplo`,
  // lib/simulador-grafo.ts: el MISMO de «Probar»). Con los cinco de antes, la etapa o la reunión le
  // llegaban crudas a quien probaba.
  const vars = datosDeEjemplo({ nombre: contacto.nombre || 'Prueba' });

  // La prueba sale por la línea de ESTA secuencia (`null` = la de por default): probarla
  // por otra sería probar otra cosa — y el estado que se mira es el de esa línea.
  const lineaSec = sec.instance_name;
  const [inst, sandbox] = await Promise.all([getInstanciaRow(lineaSec), remitenteEsSandbox()]);
  const evoConectada = inst?.estado === 'conectado';

  // ⚠️ EL NÚMERO CAÍDO SE CONTESTA ANTES DEL BUCLE, Y UNA SOLA VEZ.
  // Estaba adentro, así que una secuencia de dos pasos de WhatsApp devolvía la
  // MISMA frase dos veces pegada («…no se probaron. WhatsApp de empresa sin
  // conectar: los pasos de WhatsApp no se probaron.»), y ninguna de las dos
  // decía qué hacer ni dónde. Es la regla de «un mensaje de error dice DE QUIÉN
  // fue y QUÉ HACER»: la culpa no es de la secuencia ni de MaKo —está bien
  // armada—, es que la sesión de WhatsApp se cayó, y eso se arregla en un solo
  // lugar. Sin el link, quien lo lee concluye que el producto está roto.
  //
  // Se sale temprano solo si NO hay nada más que probar: una secuencia con un
  // paso de email sí se puede probar a medias, y frenar eso sería cobrarle al
  // email un problema del WhatsApp.
  if (!evoConectada && mensajes.every((p) => p.canal === 'whatsapp')) {
    const desde = inst?.ultima_conexion_at
      ? ` (se desconectó el ${new Date(inst.ultima_conexion_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })})`
      : '';
    return {
      ok: false,
      error: inst
        ? `Tu WhatsApp está desconectado${desde}, así que no se pudo mandar la prueba. La secuencia está bien: vuelve a vincular tu número en Configuración → WhatsApp y prueba de nuevo.`
        : 'Todavía no vinculaste tu WhatsApp, así que no hay desde dónde mandar la prueba. Conéctalo en Configuración → WhatsApp.',
    };
  }

  for (const [k, paso] of mensajes.entries()) {
    const n = k + 1;
    // Instagram y Messenger no se prueban en vivo: Meta no deja escribirle primero a nadie (lib/canal-social.ts).
    if (esCanalSocial(paso.canal)) { avisos.push(`Paso ${n}: por ${NOMBRE_CANAL[paso.canal]} no se prueba en vivo (Meta no deja escribir primero).`); continue; }
    const cuerpo = `[PRUEBA ${n}/${total}] ${aplicarVariables(paso.cuerpo, vars)}`;
    if (paso.canal === 'whatsapp') {
      if (!contacto.telefono) { avisos.push(`Paso ${n}: sin teléfono en Perfil, no se probó.`); continue; }
      if (!evoConectada) { avisos.push('Tu WhatsApp está desconectado: esos pasos no se probaron (vuelve a vincularlo en Configuración → WhatsApp).'); continue; }
      // ⚠️ CADA PARTE, EN ORDEN, COMO LE LLEGA AL LEAD (cuarta tanda, punto 15: «un audio primero y
      // luego un link»). `partesDe` lee también lo de antes: un audio con pie son dos (el audio y el
      // texto de después, que antes la prueba NO mandaba y el motor sí). El rótulo «[PRUEBA n/N]» va
      // en el primer texto o caption del paso; un audio no tiene dónde llevarlo. Si una parte falla,
      // las que siguen de ese paso no salen: es lo que hace el motor (`enviarPartesDelPaso`).
      const lista = partesDe(paso);
      if (!lista.length) { avisos.push(`Paso ${n}: sin escribir, no se probó.`); continue; }
      let rotulado = false;
      const conRotulo = (t: string) => { if (rotulado) return t; rotulado = true; return `[PRUEBA ${n}/${total}] ${t}`; };
      for (const parte of lista) {
        if (parte.tipo === 'audio') {
          // La nota de voz de verdad, como al lead.
          const audio = await getAudio(parte.audio_id);
          const b64 = audio ? await audioBase64(audio) : null;
          if (!audio || !b64) { avisos.push(`Paso ${n}: no pude bajar el audio «${audio?.titulo ?? parte.audio_id}».`); break; }
          const ra = await enviarAudioYEspejar({ telefono: contacto.telefono, base64: b64, mimetype: audio.media_mime, linea: lineaSec });
          if (ra.ok) enviadosWa += 1; else { avisos.push(`Paso ${n} (audio): ${ra.error ?? 'no salió'}`); break; }
        } else if (parte.tipo === 'media') {
          // El archivo de verdad, con su pie.
          const adj = await getAdjunto(parte.media_id);
          const b64 = adj ? await adjuntoBase64(adj) : null;
          if (!adj || !b64) { avisos.push(`Paso ${n}: no pude bajar el archivo «${adj?.titulo ?? parte.media_id}».`); break; }
          const rm = await enviarMediaYEspejar({ telefono: contacto.telefono, media: { ...mediaDeAdjunto(adj), base64: b64 }, caption: conRotulo(aplicarVariables(parte.cuerpo ?? '', vars)), linea: lineaSec });
          if (rm.ok) enviadosWa += 1; else { avisos.push(`Paso ${n} (archivo): ${rm.error ?? 'no salió'}`); break; }
        } else {
          const r = await enviarYEspejar({ telefono: contacto.telefono, texto: conRotulo(aplicarVariables(parte.cuerpo, vars)), linea: lineaSec });
          if (r.ok) enviadosWa += 1; else { avisos.push(`Paso ${n} (WhatsApp): ${r.error ?? 'no salió'}`); break; }
        }
      }
    } else {
      if (!contacto.email) { avisos.push(`Paso ${n}: sin email en Perfil, no se probó.`); continue; }
      if (sandbox) { avisos.push('Remitente sandbox: verifica tu dominio para probar los emails.'); continue; }
      const asunto = `[PRUEBA] ${aplicarVariables(paso.asunto ?? '(sin asunto)', vars)}`;
      const r = await sendEmail({ to: contacto.email, subject: asunto, html: renderEmailHtml({ subject: asunto, bodyText: cuerpo }), text: cuerpo });
      if (r.ok) enviadosEmail += 1; else avisos.push(`Paso ${n} (email): ${r.error ?? 'no salió'}`);
    }
  }

  if (enviadosWa + enviadosEmail === 0) {
    // `[...new Set()]`: los avisos se acumulan POR PASO, así que sin esto una
    // secuencia de tres pasos con la misma causa devuelve la misma frase tres
    // veces. Repetir un motivo no lo hace más claro: lo hace parecer tres
    // problemas distintos.
    return { ok: false, error: `No se pudo enviar ningún paso de prueba. ${[...new Set(avisos)].join(' ')}`.trim() };
  }

  // Registrar la prueba SOLO si la secuencia ya tiene secuencia definida (merge).
  const est = parseEstrategia(sec.estrategia);
  if (est) {
    try { await guardarEstrategia(secuenciaId, { ...est, probada_at: new Date().toISOString() }); }
    catch { avisos.push('La prueba salió pero no se pudo registrar probada_at.'); }
  }

  return { ok: true, enviadosWa, enviadosEmail, avisos };
}
