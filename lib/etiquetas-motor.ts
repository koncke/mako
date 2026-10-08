// =============================================================================
// etiquetas-motor — poner y sacar una etiqueta, con PUERTOS (sin base, con test)
// =============================================================================
// Lo que pasa cuando a un lead se le pone o se le saca una etiqueta, en UN lugar: la ÚNICA
// puerta de escritura de `crm_lead_etiquetas` es `ponerEtiqueta` / `sacarEtiqueta`
// (lib/etiquetas.ts), que arman los puertos reales y llaman a estas funciones. Están acá,
// separadas de la base, para que el orden y los cortes se puedan PROBAR con un supabase de
// mentira (tests/etiquetas-motor.test.ts): idempotencia, espaciado, lote sin disparo y el
// espejo con la etapa sin bucle.
//
// EL ORDEN DE `poner`, y por qué es ése:
//   1. La fila PRIMERO, con insert idempotente (`ignore duplicates`). Si no insertó nada, la
//      etiqueta ya estaba: se contesta `yaEstaba` y NO pasa nada más — ni historial, ni disparo,
//      ni sincronización. Es lo que corta el bucle del espejo (abajo) y el eco de WhatsApp.
//   2. El historial del lead, con el actor (una persona, «MaKo», «MaKo · automatización «x»»).
//   3. Si la etiqueta está VINCULADA a una etapa: mover al lead ahí. Salvo en lote, salvo si la
//      puso justamente ENTRAR a esa etapa (`origen: 'etapa'`).
//   4. El disparo de las automatizaciones «cuando se le pone esta etiqueta», con el espaciado de
//      30 s por (etiqueta, lead). NUNCA en lote, y NUNCA cuando la puso entrar a una etapa
//      (`origen: 'etapa'`): el evento de ese movimiento es la etapa, que tiene su propio
//      disparador, y el movimiento en lote del CRM (`moverLeadsDeEtapaAction` → setPipelineStage
//      de a uno) pasa por el espejo — sin este corte, mover 200 leads a una etapa vinculada sería
//      un envío masivo por la puerta de atrás, por la línea NO oficial del cliente.
//   5. La sincronización con WhatsApp y Chatwoot, ESPERANDO el resultado: lo que falla queda en
//      el historial del lead. Nada de `void` ni de `.catch(() => {})` mudo (el patrón que dejó
//      la sincronización vieja de etapa→etiqueta sin un solo rastro).
//
// ⚠️ EL ESPEJO CON LA ETAPA ES EN LAS DOS DIRECCIONES (decisión del diseño, §5): poner la
// etiqueta mueve a la etapa, y entrar o salir de la etapa la pone o la saca. El bucle se corta
// DOS veces: por la idempotencia del paso 1 (la fila ya está cuando el movimiento vuelve a pedir
// ponerla) y por el `origen: 'etapa'`, que nunca vuelve a mover.
// =============================================================================

import { ESPACIADO_DISPARO_MIN, SYNC_LOTE_MAX } from './etiquetas-reglas';

/** La fila de `crm_etiquetas` que estas funciones necesitan. */
export type EtiquetaMotor = {
  id: number;
  nombre: string;
  funnel_id: number | null;
  etapa_key: string | null;
  archivada_at: string | null;
};

export type ResultadoSync = { destino: 'WhatsApp' | 'Chatwoot'; ok: boolean; error?: string };

/** Lo que el motor necesita de afuera. lib/etiquetas.ts arma los reales; el test, unos de mentira. */
export type PuertosEtiquetas<E extends EtiquetaMotor = EtiquetaMotor> = {
  /** La etiqueta, de ESTE negocio. null = no existe (o es de otro). */
  etiqueta: (id: number) => Promise<E | null>;
  /** ¿El lead es de este negocio? Sin esto, una FK a `leads(id)` dejaría etiquetar al lead de otro. */
  leadExiste: (leadId: number) => Promise<boolean>;
  /** Inserta la fila. true = la insertó; false = ya estaba (idempotente, atómico). */
  insertar: (leadId: number, etiquetaId: number, autor: string) => Promise<boolean>;
  /** Inserta las filas de un lote; devuelve los leads a los que SÍ se les insertó. */
  insertarLote: (leadIds: number[], etiquetaId: number, autor: string) => Promise<number[]>;
  /** Borra la fila. true = la borró; false = no la tenía. */
  borrar: (leadId: number, etiquetaId: number) => Promise<boolean>;
  borrarLote: (leadIds: number[], etiquetaId: number) => Promise<number[]>;
  /** Una línea en el historial del lead (lead_audit). */
  historial: (leadId: number, texto: string, autor: string) => Promise<void>;
  historialLote: (leadIds: number[], texto: string, autor: string) => Promise<void>;
  /** El espaciado de 30 s por (etiqueta, lead): true = este disparo se lo lleva; false = ya hubo uno. */
  reclamarDisparo: (etiquetaId: number, leadId: number, minutos: number) => Promise<boolean>;
  /** Las automatizaciones «cuando se le pone esta etiqueta» (enrolarPorEvento, parte M). */
  disparar: (leadId: number, etiquetaId: number) => Promise<void>;
  /**
   * Mueve al lead a la etapa vinculada. `motivo` = por qué NO se movió (no está en ese producto, la
   * etapa ya no existe, es un desenlace). Quien mueve llama al espejo (`espejarEtapaCon`) desde el
   * gancho de la etapa: así es en producción, y así lo hace el test.
   */
  moverAEtapa: (leadId: number, funnelId: number | null, etapaKey: string, autor: string) => Promise<{ movio: boolean; etapa?: string; motivo?: string }>;
  /** Las etiquetas vivas vinculadas a esa etapa de ese producto (null = el del negocio). */
  etiquetasDeEtapa: (funnelId: number | null, etapaKey: string) => Promise<E[]>;
  /** A dónde se sincroniza ESTA etiqueta (vacío = a ningún lado). Para decidir un lote sin pegarle a nadie. */
  destinos: (etiqueta: E) => Promise<Array<ResultadoSync['destino']>>;
  /** Pone o saca la etiqueta afuera (WhatsApp, Chatwoot) y devuelve cada resultado. Nunca tira. */
  sincronizar: (leadId: number, etiqueta: E, accion: 'poner' | 'sacar') => Promise<ResultadoSync[]>;
};

export type OpcionesPoner = {
  /** Quién: ya resuelto (la sesión, «MaKo», «MaKo · automatización «x»»). */
  autor: string;
  /** 'etapa' = la pone ENTRAR a la etapa vinculada: no vuelve a mover (corta el espejo) ni dispara. */
  origen?: 'etapa' | 'directo';
  /** false = no pegarle a WhatsApp ni a Chatwoot ahora: lo hace quien llamó, al final y con tope (`sincronizarDiferidos`). */
  sincronizar?: boolean;
};

export type ResultadoPoner =
  | {
      ok: true;
      /** Ya la tenía (poner) o ya no la tenía (sacar): no se hizo nada. */
      yaEstaba: boolean;
      /** 'si' = disparó · 'espaciado' = ya hubo uno en los últimos 30 s · 'no' = no corresponde. */
      disparo: 'si' | 'espaciado' | 'no';
      /** Si la etiqueta movió al lead de etapa. */
      movio: boolean;
      sync: ResultadoSync[];
    }
  | { ok: false; error: string };

const nada = (yaEstaba: boolean): ResultadoPoner => ({ ok: true, yaEstaba, disparo: 'no', movio: false, sync: [] });

/** Cada fallo de la sincronización deja su línea en el historial. Lo que salió bien no ensucia. */
async function anotarSync<E extends EtiquetaMotor>(p: PuertosEtiquetas<E>, leadId: number, e: E, accion: 'poner' | 'sacar', sync: ResultadoSync[]): Promise<void> {
  for (const s of sync) {
    if (s.ok) continue;
    await p.historial(leadId, `«${e.nombre}» no se ${accion === 'poner' ? 'puso' : 'sacó'} en ${s.destino}: ${s.error ?? 'sin respuesta'}`.slice(0, 300), 'MaKo');
  }
}

/** Pone UNA etiqueta a UN lead. Ver el orden en la cabecera. */
export async function ponerEtiquetaCon<E extends EtiquetaMotor>(p: PuertosEtiquetas<E>, leadId: number, etiquetaId: number, o: OpcionesPoner): Promise<ResultadoPoner> {
  const e = await p.etiqueta(etiquetaId);
  if (!e) return { ok: false, error: 'Esa etiqueta no existe en este negocio.' };
  if (e.archivada_at) return { ok: false, error: `«${e.nombre}» está archivada.` };
  if (!(await p.leadExiste(leadId))) return { ok: false, error: 'Ese lead no existe en este negocio.' };

  // 1. La fila. Si ya estaba, no pasa nada más: esto es lo que corta el bucle del espejo.
  if (!(await p.insertar(leadId, etiquetaId, o.autor))) return nada(true);

  // 2. El historial.
  await p.historial(leadId, `Se puso «${e.nombre}»`, o.autor);

  // 3. El espejo hacia la etapa. Nunca si la puso entrar a esa misma etapa.
  let movio = false;
  if (e.etapa_key && o.origen !== 'etapa') {
    const m = await p.moverAEtapa(leadId, e.funnel_id, e.etapa_key, o.autor);
    movio = m.movio;
    if (m.movio) await p.historial(leadId, `«${e.nombre}» lo pasó a «${m.etapa ?? e.etapa_key}»`.slice(0, 300), o.autor);
    else if (m.motivo) await p.historial(leadId, `«${e.nombre}» no lo movió de etapa: ${m.motivo}`.slice(0, 300), 'MaKo');
  }

  // 4. El disparo, con el espaciado de 30 s por (etiqueta, lead). No si la puso una etapa.
  let disparo: 'si' | 'espaciado' | 'no' = 'no';
  if (o.origen !== 'etapa') {
    disparo = 'espaciado';
    if (await p.reclamarDisparo(etiquetaId, leadId, ESPACIADO_DISPARO_MIN)) {
      await p.disparar(leadId, etiquetaId);
      disparo = 'si';
    }
  }

  // 5. Afuera, esperando el resultado.
  const sync = o.sincronizar === false ? [] : await p.sincronizar(leadId, e, 'poner');
  await anotarSync(p, leadId, e, 'poner', sync);
  return { ok: true, yaEstaba: false, disparo, movio, sync };
}

/**
 * Saca UNA etiqueta a UN lead. No dispara nada ni mueve de etapa: no hay un «a dónde» natural
 * cuando se saca una etiqueta vinculada, y adivinarlo sería mover al lead por una inferencia.
 * Una etiqueta ARCHIVADA se puede sacar (es la forma de limpiarla de un lead).
 */
export async function sacarEtiquetaCon<E extends EtiquetaMotor>(p: PuertosEtiquetas<E>, leadId: number, etiquetaId: number, o: OpcionesPoner): Promise<ResultadoPoner> {
  const e = await p.etiqueta(etiquetaId);
  if (!e) return { ok: false, error: 'Esa etiqueta no existe en este negocio.' };
  if (!(await p.leadExiste(leadId))) return { ok: false, error: 'Ese lead no existe en este negocio.' };
  if (!(await p.borrar(leadId, etiquetaId))) return nada(true);
  await p.historial(leadId, `Se sacó «${e.nombre}»`, o.autor);
  const sync = o.sincronizar === false ? [] : await p.sincronizar(leadId, e, 'sacar');
  await anotarSync(p, leadId, e, 'sacar', sync);
  return { ok: true, yaEstaba: false, disparo: 'no', movio: false, sync };
}

/** Un cambio que el espejo HIZO en la base y que todavía no se pasó a WhatsApp ni a Chatwoot. */
export type CambioEtiqueta = { leadId: number; etiquetaId: number; accion: 'poner' | 'sacar' };

/**
 * El lado de la ETAPA del espejo: el lead pasó de `desde` a `hacia` en el producto `funnelId`
 * (null = el del negocio). Saca las etiquetas vinculadas a la etapa que deja y pone las de la que
 * entra, con `origen: 'etapa'` — que nunca vuelve a mover. Lo llaman los ganchos de
 * `setBoardStageOverride`, `setPipelineStage`, `updateLead`, `upsertLeadFromCalendly` y
 * `moverEtapaEnProducto`, y el barrido horario (`conciliarEspejoEtapas`).
 *
 * ⚠️ `sincronizar: false` ES PARA LOS LOTES (revisión del 08/10/2026, etiquetas-4/datos-3): mover
 * 200 leads de etapa desde la barra del CRM esperaba, lead por lead, WhatsApp y tres llamadas a
 * Chatwoot por cada etiqueta espejada — cientos de viajes HTTP adentro de una server action con
 * techo de 60 s, con el lote cortado a la mitad y sin el conteo. Así el espejo escribe la base y
 * devuelve en `cambios` lo que hizo; quien llamó lo sincroniza AL FINAL con `sincronizarDiferidos`,
 * con el mismo tope que el lote de etiquetas y el rastro de los que no se pasaron.
 */
export async function espejarEtapaCon<E extends EtiquetaMotor>(
  p: PuertosEtiquetas<E>,
  leadId: number,
  funnelId: number | null,
  desde: string | null,
  hacia: string | null,
  autor: string,
  opts?: { sincronizar?: boolean },
): Promise<{ puestas: number; sacadas: number; cambios: CambioEtiqueta[] }> {
  const cambios: CambioEtiqueta[] = [];
  if (desde === hacia) return { puestas: 0, sacadas: 0, cambios };
  const sincronizar = opts?.sincronizar !== false;
  let puestas = 0;
  let sacadas = 0;
  if (desde) {
    for (const e of await p.etiquetasDeEtapa(funnelId, desde)) {
      const r = await sacarEtiquetaCon(p, leadId, e.id, { autor, origen: 'etapa', sincronizar });
      if (r.ok && !r.yaEstaba) { sacadas++; cambios.push({ leadId, etiquetaId: e.id, accion: 'sacar' }); }
    }
  }
  if (hacia) {
    for (const e of await p.etiquetasDeEtapa(funnelId, hacia)) {
      const r = await ponerEtiquetaCon(p, leadId, e.id, { autor, origen: 'etapa', sincronizar });
      if (r.ok && !r.yaEstaba) { puestas++; cambios.push({ leadId, etiquetaId: e.id, accion: 'poner' }); }
    }
  }
  return { puestas, sacadas, cambios };
}

/**
 * Pasa a WhatsApp y a Chatwoot lo que el espejo (o un lote) escribió sin sincronizar, con UN tope
 * para todo el conjunto: los primeros `tope` (lead, etiqueta) se sincronizan y al resto se le deja
 * escrito en el historial que no se pasó — el mismo rastro que el lote de etiquetas. Lo que no
 * tiene a dónde ir (una etiqueta sin WhatsApp mapeado y un negocio sin Chatwoot) no gasta tope.
 */
export async function sincronizarDiferidos<E extends EtiquetaMotor>(
  p: PuertosEtiquetas<E>,
  cambios: ReadonlyArray<CambioEtiqueta>,
  tope: number = SYNC_LOTE_MAX,
): Promise<{ sincronizados: number; sinSincronizar: number }> {
  const grupos = new Map<string, { etiquetaId: number; accion: 'poner' | 'sacar'; ids: number[] }>();
  for (const c of cambios) {
    const k = `${c.etiquetaId}:${c.accion}`;
    const g = grupos.get(k) ?? { etiquetaId: c.etiquetaId, accion: c.accion, ids: [] };
    if (!g.ids.includes(c.leadId)) g.ids.push(c.leadId);
    grupos.set(k, g);
  }
  const resueltos: Array<{ e: E; accion: 'poner' | 'sacar'; ids: number[] }> = [];
  for (const g of grupos.values()) {
    const e = await p.etiqueta(g.etiquetaId);
    if (e) resueltos.push({ e, accion: g.accion, ids: g.ids });
  }
  return syncGrupos(p, resueltos, tope);
}

async function syncGrupos<E extends EtiquetaMotor>(p: PuertosEtiquetas<E>, grupos: ReadonlyArray<{ e: E; accion: 'poner' | 'sacar'; ids: number[] }>, tope: number): Promise<{ sincronizados: number; sinSincronizar: number }> {
  let quedan = Math.max(0, Math.trunc(tope));
  let sincronizados = 0;
  let sinSincronizar = 0;
  for (const { e, accion, ids } of grupos) {
    if (!ids.length) continue;
    const destinos = await p.destinos(e);
    if (!destinos.length) continue;
    const ahora = ids.slice(0, quedan);
    const resto = ids.slice(ahora.length);
    quedan -= ahora.length;
    for (const id of ahora) await anotarSync(p, id, e, accion, await p.sincronizar(id, e, accion));
    sincronizados += ahora.length;
    if (resto.length) await p.historialLote(resto, `«${e.nombre}» no se ${accion === 'poner' ? 'puso' : 'sacó'} en ${destinos.join(' ni ')}: eran más de ${tope} a la vez`, 'MaKo');
    sinSincronizar += resto.length;
  }
  return { sincronizados, sinSincronizar };
}

export type ResultadoLote = { ok: true; cambiados: number[]; yaEstaban: number; sinSincronizar: number } | { ok: false; error: string };

/**
 * Pone una etiqueta a VARIOS leads (la barra de lote del CRM). ⚠️ NO DISPARA AUTOMATIZACIONES NI
 * MUEVE DE ETAPA, a propósito (diseño §5, el molde de ManyChat): poner «Seguimiento» a 200 leads con
 * una secuencia colgada de esa etiqueta sería un envío masivo por la línea NO oficial del cliente,
 * que es lo único que la hace caer. Lo que sí hace es el historial de cada uno y la sincronización,
 * con tope: los primeros `SYNC_LOTE_MAX`; al resto se le deja escrito que no se pasó.
 */
export async function ponerLoteCon<E extends EtiquetaMotor>(p: PuertosEtiquetas<E>, leadIds: number[], etiquetaId: number, autor: string): Promise<ResultadoLote> {
  const e = await p.etiqueta(etiquetaId);
  if (!e) return { ok: false, error: 'Esa etiqueta no existe en este negocio.' };
  if (e.archivada_at) return { ok: false, error: `«${e.nombre}» está archivada.` };
  const ids = [...new Set(leadIds.filter((n) => Number.isInteger(n) && n > 0))];
  const puestos = await p.insertarLote(ids, etiquetaId, autor);
  if (puestos.length) await p.historialLote(puestos, `Se puso «${e.nombre}» (en lote)`, autor);
  const sinSincronizar = await syncLote(p, puestos, e, 'poner');
  return { ok: true, cambiados: puestos, yaEstaban: ids.length - puestos.length, sinSincronizar };
}

/** El inverso del lote (y su Deshacer): saca la etiqueta a los que la tengan. Tampoco dispara. */
export async function sacarLoteCon<E extends EtiquetaMotor>(p: PuertosEtiquetas<E>, leadIds: number[], etiquetaId: number, autor: string): Promise<ResultadoLote> {
  const e = await p.etiqueta(etiquetaId);
  if (!e) return { ok: false, error: 'Esa etiqueta no existe en este negocio.' };
  const ids = [...new Set(leadIds.filter((n) => Number.isInteger(n) && n > 0))];
  const sacados = await p.borrarLote(ids, etiquetaId);
  if (sacados.length) await p.historialLote(sacados, `Se sacó «${e.nombre}» (en lote)`, autor);
  const sinSincronizar = await syncLote(p, sacados, e, 'sacar');
  return { ok: true, cambiados: sacados, yaEstaban: ids.length - sacados.length, sinSincronizar };
}

/** El lote de etiquetas: un solo grupo, por el MISMO camino (y el mismo tope) que el espejo diferido. */
async function syncLote<E extends EtiquetaMotor>(p: PuertosEtiquetas<E>, ids: number[], e: E, accion: 'poner' | 'sacar'): Promise<number> {
  return (await syncGrupos(p, [{ e, accion, ids }], SYNC_LOTE_MAX)).sinSincronizar;
}
