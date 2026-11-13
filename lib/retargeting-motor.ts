// =============================================================================
// El retargeting de los funnels sin VSL: la revisión semanal (13/11/2026). Orquesta las reglas (lib/retargeting-reglas.ts) con
// PUERTOS: la base, la IA del negocio, las etiquetas y Meta los pone lib/retargeting.ts, y los tests los suyos.
// =============================================================================
// En orden: el segmento de cada lead (el código primero; la IA sólo los dudosos con mensajes nuevos, en lotes), las etiquetas
// del CRM (sólo las que puso MaKo se sacan), el historial del lead con el porqué, y los dos públicos de Meta, que se tocan
// SÓLO con el interruptor del negocio prendido (el Cerebro, 13/11: «no crees nada solo en las cuentas de Leila, Mauricio o
// Código»). En seco se arma todo y Meta no se llama. Nunca mueve la etapa.
// =============================================================================

import {
  conEtiqueta, difDelPublico, esComprador, ETIQUETAS, leerVeredictos, loteParaLaIA, NO_AVANZARON, personaDe, POR_LLAMADA, PUBLICOS,
  resumenDelChat, SEGMENTOS, segmentoDelVeredicto, segmentoPorCodigo, SYSTEM_DE_LA_REVISION, TOPE_IA_SEMANAL,
  type ChatRT, type CualPublico, type LeadRT, type Persona, type Segmento, type SegmentoConEtiqueta,
} from './retargeting-reglas';

export type ViaMeta = 'zernio' | 'token' | 'ninguna';
export type PublicoGuardado = { metaId: string; zernioId: string | null; via: Exclude<ViaMeta, 'ninguna'>; miembros: Record<string, Persona> };
/** Lo que queda de una revisión a la otra, en el ajuste `retargeting.estado` del negocio. */
export type EstadoRT = {
  v: 1;
  revisadoAt: string | null;
  enSeco: boolean;
  /** Por lead: segmento, porqué, quién lo decidió (código o IA) y el último mensaje leído (lo que la IA no vuelve a leer). */
  leads: Record<string, { s: Segmento; por: string; f: 'c' | 'ia'; u: number }>;
  /** Las etiquetas que puso MaKo: sólo ésas se sacan. */
  etiquetados: Record<string, SegmentoConEtiqueta>;
  publicos: Partial<Record<CualPublico, PublicoGuardado>>;
  conteo: { segmentos: Record<Segmento, number>; sinRevisar: number; chatsSinLead: number };
  aviso: string | null;
};
export type ConfigRT = { publicosMeta: boolean };

export type PuertosRT = {
  ahora: () => Date;
  /** Todos los leads del negocio. */
  leads: () => Promise<LeadRT[]>;
  /** Las charlas de esos leads, con sus mensajes del más viejo al más nuevo. */
  chats: (leadIds: number[]) => Promise<Map<number, ChatRT>>;
  /** Las charlas con movimiento en 7 días que no son de ningún lead. */
  chatsSinLead: () => Promise<number>;
  estado: () => Promise<EstadoRT | null>;
  guardarEstado: (e: EstadoRT) => Promise<void>;
  config: () => Promise<ConfigRT>;
  /** La IA del negocio: tira si no tiene. */
  ia: (system: string, user: string) => Promise<string>;
  etiquetas: {
    asegurar: (s: SegmentoConEtiqueta) => Promise<number>;
    poner: (leadIds: number[], etiquetaId: number) => Promise<void>;
    sacar: (leadIds: number[], etiquetaId: number) => Promise<void>;
  };
  historial: (filas: Array<{ leadId: number; texto: string }>) => Promise<void>;
  meta: {
    via: () => Promise<ViaMeta>;
    /** Por qué hoy no se puede escribir en Meta (el token vencido), o null. */
    freno: () => Promise<string | null>;
    crear: (cual: CualPublico) => Promise<{ metaId: string; zernioId: string | null }>;
    agregar: (pub: PublicoGuardado, personas: Persona[]) => Promise<void>;
    sacar: (pub: PublicoGuardado, personas: Persona[]) => Promise<void>;
  };
};

export type VistaRT = {
  ultimaRevision: string | null; enSeco: boolean;
  segmentos: Record<Segmento, number>; sinRevisar: number; chatsSinLead: number;
  publicosMeta: {
    prendido: boolean; via: ViaMeta;
    noAvanzaron: { metaId: string | null; personas: number } | null;
    compraron: { metaId: string | null; personas: number } | null;
    aviso: string | null;
  };
};
export type CambiosRT = { etiquetasPuestas: number; etiquetasSacadas: number; alPublico: { agregar: number; sacar: number }; llamadasIA: number };
export type ResultadoRT = VistaRT & { cambios: CambiosRT };

const ceros = (): Record<Segmento, number> => Object.fromEntries(SEGMENTOS.map((s) => [s, 0])) as Record<Segmento, number>;
export const estadoVacio = (): EstadoRT => ({ v: 1, revisadoAt: null, enSeco: false, leads: {}, etiquetados: {}, publicos: {}, conteo: { segmentos: ceros(), sinRevisar: 0, chatsSinLead: 0 }, aviso: null });

/** Lo que ve el CoPilot (`ver_retargeting`), del estado guardado. */
export function vistaDe(e: EstadoRT | null, config: ConfigRT, via: ViaMeta): VistaRT {
  const x = e ?? estadoVacio();
  const pub = (c: CualPublico) => (x.publicos[c] ? { metaId: x.publicos[c]!.metaId, personas: Object.keys(x.publicos[c]!.miembros).length } : null);
  return {
    ultimaRevision: x.revisadoAt, enSeco: x.enSeco, segmentos: { ...ceros(), ...x.conteo.segmentos }, sinRevisar: x.conteo.sinRevisar, chatsSinLead: x.conteo.chatsSinLead,
    publicosMeta: { prendido: config.publicosMeta, via, noAvanzaron: pub('noAvanzaron'), compraron: pub('compraron'), aviso: x.aviso },
  };
}

/** El porqué de lo que decidió el código, para el historial del lead. */
const POR_DEL_CODIGO: Record<Segmento, string> = {
  compro: 'figura como venta en el CRM', agendo: 'tiene una reunión agendada', sigue: 'la charla sigue viva',
  no_respondio: 'no contestó después del primer mensaje del negocio (lo dice su charla de WhatsApp)', no_siguio: 'la etapa del CRM lo dice',
  no_compro: 'la etapa del CRM dice perdido', no_califica: 'la etapa del CRM dice descalificado',
};

const TOPE_POR_PEDIDO = 10_000;
const deA = <T>(xs: T[], n: number): T[][] => { const out: T[][] = []; for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n)); return out; };
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** LA REVISIÓN de un negocio. Nunca tira por un paso que falla: lo cuenta y sigue (lo que no se pudo queda como estaba). */
export async function revisarCon(p: PuertosRT, opts: { enSeco: boolean }): Promise<ResultadoRT> {
  const ahora = p.ahora();
  const [leads, previo, config] = await Promise.all([p.leads(), p.estado(), p.config()]);
  const antes = previo ?? estadoVacio();
  const cambios: CambiosRT = { etiquetasPuestas: 0, etiquetasSacadas: 0, alPublico: { agregar: 0, sacar: 0 }, llamadasIA: 0 };
  const avisos: string[] = [];

  // 1. EL SEGMENTO. Un funnel VSL no entra; quien compró entra aunque no tenga charla.
  const enAlcance = leads.filter((l) => !l.enVsl);
  const chats = await p.chats(enAlcance.map((l) => l.id));
  const nuevos: EstadoRT['leads'] = {};
  const porLeer: ChatRT[] = [];
  let sinRevisar = 0;
  for (const l of enAlcance) {
    const chat = chats.get(l.id) ?? null;
    const seg = segmentoPorCodigo(l, chat, ahora);
    const prev = antes.leads[String(l.id)];
    const ultimo = chat ? resumenDelChat(chat).ultimoId : prev?.u ?? 0;
    if (seg == null) { if (prev) nuevos[String(l.id)] = prev; continue; }
    if (seg !== 'dudoso') { nuevos[String(l.id)] = { s: seg, por: POR_DEL_CODIGO[seg], f: 'c', u: ultimo }; continue; }
    // Lo que la IA ya leyó y no tiene mensajes nuevos, queda como estaba: sólo las charlas con movimiento gastan.
    if (prev?.f === 'ia' && prev.u === ultimo) { nuevos[String(l.id)] = prev; continue; }
    porLeer.push(chat!);
  }

  // 2. LA IA, sólo con los dudosos que se movieron, en lotes y con tope. Sin IA, quedan sin revisar (con lo de antes, si había).
  const aLeer = porLeer.slice(0, TOPE_IA_SEMANAL);
  for (const c of porLeer.slice(TOPE_IA_SEMANAL)) { sinRevisar++; const prev = antes.leads[String(c.leadId)]; if (prev) nuevos[String(c.leadId)] = prev; }
  let sinIA = false;
  for (const lote of deA(aLeer, POR_LLAMADA)) {
    let leidos = new Map<number, { v: Parameters<typeof segmentoDelVeredicto>[0]; por: string }>();
    if (!sinIA) {
      try { cambios.llamadasIA++; leidos = leerVeredictos(await p.ia(SYSTEM_DE_LA_REVISION, loteParaLaIA(lote)), lote.map((c) => c.leadId)); } catch (e) {
        sinIA = true;
        avisos.push(`La IA del negocio no contestó: ${msg(e).slice(0, 120)}`);
      }
    }
    for (const c of lote) {
      const r = leidos.get(c.leadId);
      const prev = antes.leads[String(c.leadId)];
      if (r) nuevos[String(c.leadId)] = { s: segmentoDelVeredicto(r.v), por: r.por || 'lo leyó MaKo en la charla', f: 'ia', u: resumenDelChat(c).ultimoId };
      else { sinRevisar++; if (prev) nuevos[String(c.leadId)] = prev; }
    }
  }

  // 3. LAS ETIQUETAS. Una por lead; sólo se saca lo que puso MaKo. Lo que falla queda como estaba, para la próxima.
  const etiquetados: EstadoRT['etiquetados'] = {};
  const poner = new Map<SegmentoConEtiqueta, number[]>(), sacar = new Map<SegmentoConEtiqueta, number[]>();
  const ids = new Set([...Object.keys(antes.etiquetados), ...Object.keys(nuevos)]);
  const existen = new Set(leads.map((l) => String(l.id)));
  for (const id of ids) {
    const tenia = antes.etiquetados[id];
    const s = nuevos[id]?.s;
    const quiere = conEtiqueta(s) ? s : undefined;
    if (!existen.has(id)) continue; // el lead ya no existe: su etiqueta se fue con él
    if (tenia === quiere) { if (quiere) etiquetados[id] = quiere; continue; }
    if (tenia) sacar.set(tenia, [...(sacar.get(tenia) ?? []), Number(id)]);
    if (quiere) poner.set(quiere, [...(poner.get(quiere) ?? []), Number(id)]);
  }
  const fallaronSacar = new Set<string>(), fallaronPoner = new Set<string>();
  for (const [s, lista] of sacar) {
    try { await p.etiquetas.sacar(lista, await p.etiquetas.asegurar(s)); cambios.etiquetasSacadas += lista.length; } catch (e) {
      lista.forEach((id) => fallaronSacar.add(String(id)));
      avisos.push(`No pude sacar «${ETIQUETAS[s].nombre}»: ${msg(e).slice(0, 100)}`);
    }
  }
  for (const [s, lista] of poner) {
    try { await p.etiquetas.poner(lista, await p.etiquetas.asegurar(s)); cambios.etiquetasPuestas += lista.length; lista.forEach((id) => { etiquetados[String(id)] = s; }); } catch (e) {
      lista.forEach((id) => fallaronPoner.add(String(id)));
      avisos.push(`No pude poner «${ETIQUETAS[s].nombre}»: ${msg(e).slice(0, 100)}`);
    }
  }
  // La que no se pudo sacar sigue puesta: queda anotada, para sacarla la próxima.
  for (const id of fallaronSacar) if (!etiquetados[id] && antes.etiquetados[id]) etiquetados[id] = antes.etiquetados[id];

  // 4. EL HISTORIAL: el porqué, cuando el segmento cambió y lleva etiqueta.
  const filas: Array<{ leadId: number; texto: string }> = [];
  for (const [id, n] of Object.entries(nuevos)) {
    if (!conEtiqueta(n.s) || antes.leads[id]?.s === n.s || fallaronPoner.has(id)) continue;
    filas.push({ leadId: Number(id), texto: `${ETIQUETAS[n.s].nombre} — ${n.por}${n.f === 'ia' ? ' (lo leyó MaKo en su charla de WhatsApp)' : ''}`.slice(0, 300) });
  }
  if (filas.length) await p.historial(filas).catch((e) => { avisos.push(`El historial no se escribió: ${msg(e).slice(0, 100)}`); });

  // 5. LOS PÚBLICOS DE META: sólo con el interruptor del negocio prendido. En seco se cuenta lo que haría, sin llamar a Meta.
  const via = await p.meta.via().catch(() => 'ninguna' as ViaMeta);
  const publicos: EstadoRT['publicos'] = { ...antes.publicos };
  const deseado: Record<CualPublico, Map<number, Persona>> = { noAvanzaron: new Map(), compraron: new Map() };
  for (const l of leads) {
    const persona = personaDe(l);
    if (!persona) continue;
    const s = nuevos[String(l.id)]?.s;
    if (esComprador(l) || s === 'compro') deseado.compraron.set(l.id, persona);
    else if (s && NO_AVANZARON.includes(s)) deseado.noAvanzaron.set(l.id, persona);
  }
  if ((config.publicosMeta || opts.enSeco) && via !== 'ninguna') {
    const freno = config.publicosMeta && !opts.enSeco ? await p.meta.freno().catch((e) => msg(e)) : null;
    if (freno) avisos.push(freno);
    for (const cual of Object.keys(PUBLICOS) as CualPublico[]) {
      const guardado = antes.publicos[cual]?.via === via ? antes.publicos[cual]! : null;
      const dif = difDelPublico(guardado?.miembros ?? {}, deseado[cual]);
      cambios.alPublico.agregar += dif.agregar.length;
      cambios.alPublico.sacar += dif.sacar.length;
      if (opts.enSeco || !config.publicosMeta || freno) continue;
      try {
        const pub: PublicoGuardado = guardado ?? { ...(await p.meta.crear(cual)), via, miembros: {} };
        for (const parte of deA(dif.sacar, TOPE_POR_PEDIDO)) await p.meta.sacar(pub, parte);
        for (const parte of deA(dif.agregar, TOPE_POR_PEDIDO)) await p.meta.agregar(pub, parte);
        publicos[cual] = { ...pub, miembros: dif.quedan };
      } catch (e) {
        avisos.push(`Meta no tomó «${PUBLICOS[cual].nombre}»: ${msg(e).slice(0, 140)}`);
      }
    }
  }

  // 6. LO QUE QUEDA para la próxima, y lo que ve el CoPilot.
  const segmentos = ceros();
  for (const n of Object.values(nuevos)) segmentos[n.s]++;
  const chatsSinLead = await p.chatsSinLead().catch(() => antes.conteo.chatsSinLead);
  const estado: EstadoRT = {
    v: 1, revisadoAt: ahora.toISOString(), enSeco: opts.enSeco, leads: nuevos, etiquetados, publicos,
    conteo: { segmentos, sinRevisar, chatsSinLead }, aviso: avisos.length ? avisos.join(' · ').slice(0, 600) : null,
  };
  await p.guardarEstado(estado);
  return { ...vistaDe(estado, config, via), cambios };
}
