// =============================================================================
// recomendaciones — MaKo recomienda: lo que lee de la base del negocio, lo que decide y lo que guarda (26/10/2026)
// =============================================================================
// Pedido de Martín (26/10/2026): que MaKo «comience a dar recomendaciones en todos lados... deben ser reales». El diseño:
// docs/diseno-mako-recomienda.md. Lo puro (cuándo existe una recomendación, cómo se calla, cómo aprende, qué se le acepta a
// la IA): lib/recomendaciones-reglas.ts. Lo que se mide: lib/recomendaciones-senales.ts. Acá, la lectura y la memoria.
//
// UNA PASADA POR PEDIDO (`recomendacionesDe`, adentro del workspace del pedido):
//   1. Lee SÓLO las fuentes que usa esa superficie, cada una con su `error` mirado: una lectura que falla no da señales y
//      queda en `fallas` («no pude leer» no es «no hay nada»).
//   2. Con las señales que se sostienen y la memoria del negocio, `senalesQueHablan`. Sin ninguna: `[]`, y nada más.
//   3. Si el negocio tiene SU IA (o es el espacio de MaKo), la redacción guardada para esa huella; si no hay, la de las
//      reglas ahora y la de la IA en `after()` (la próxima vez sale la de la IA). Sin su IA, las reglas: nunca con la nuestra.
//
// ⚠️ EL GET NO ESCRIBE NADA DEL NEGOCIO: lo único que escribe es la redacción de la IA (un caché, en su setting) y lo hace
//    en `after()`. Decidir («Hacerlo», «Ahora no», «No aplica») escribe la memoria con compare-and-set.
// ⚠️ NADA SALE HACIA AFUERA: no manda mensajes, no crea automatizaciones. «Hacerlo» lleva a la pantalla o le pasa el
//    pedido al chat, que PROPONE con su tarjeta.
// =============================================================================

import 'server-only';
import { getTenantDb, getWorkspaceActual, wsSuperAdmin } from './workspace';
import { getSetting, getSettingEstricto, cambiarSettingSi, setSetting } from './settings';
import { leerTodo } from './supabase-paginado';
import { claveDeIAPropia } from './ia-del-negocio';
import { chatCheapCascade } from './ai-cheap';
import { perfilNegocioTexto, getAnswers } from './onboarding';
import { faseNegocioTexto } from './fase-store';
import { ofertaPrincipal } from './ofertas';
import { getPulso } from './landing-pulso-server';
import { rasgosDelFlujo } from './automatizacion-metricas';
import type { PasoGrafo } from './flujo-grafo';
import { CLAVE_RECOLECTOR, FUENTE_WHATSAPP, hechosDeLaEntrada, leerEstadoRecolector, prendidoPorDefecto } from './recolector-reglas';
import {
  CLAVE_MEMORIA, anotarDecision, claveDe, descartadas, elegirSinIA, funcionaron, huellaDe, leerMemoria, leerRedaccion, pedidoAlAsesor,
  senalesQueHablan, ultimaDecision, type Decision, type DecisionGuardada, type MemoriaRecs, type Recomendacion, type Senal, type Superficie,
} from './recomendaciones-reglas';
import {
  senalEsperando, senalMotivoPerdida, senalNoShow, senalRespuestaLenta, senalSecondBrainSinAprender, senalesDeAutomatizaciones,
  senalesDeLandings, senalesDeObjeciones, type EnvioSenal, type InscripcionSenal, type LeadSenal, type LlamadaSenal, type MensajeSenal,
  type PaginaSenal, type SecuenciaSenal,
} from './recomendaciones-senales';

export const FEATURE_RECOMIENDA = 'mako-recomienda';
const DIA = 86_400_000;
/** La redacción guardada de la IA, por superficie: vale mientras la huella sea la misma y no tenga más de un día. */
const claveRedaccion = (s: Superficie) => `mako.recomendaciones.redaccion.${s}`;
const VIGENCIA_REDACCION_MS = DIA;
/** Tope de lo que se lee de WhatsApp: los más nuevos. Si se llega al tope, la ventana se acorta a lo leído (y se dice). */
const MAX_MENSAJES = 6000;

type Fuente = 'whatsapp' | 'leads' | 'automatizaciones' | 'landings' | 'objeciones' | 'second-brain';
const FUENTES_DE: Record<Superficie, readonly Fuente[]> = {
  'ops-center': ['whatsapp', 'leads', 'automatizaciones', 'landings', 'objeciones', 'second-brain'],
  whatsapp: ['whatsapp', 'leads', 'automatizaciones', 'landings', 'objeciones'],
  automations: ['whatsapp', 'leads', 'automatizaciones'],
  offer: ['leads', 'objeciones'],
  landing: ['leads', 'landings', 'objeciones'],
};

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export type LecturaSenales = { senales: Senal[]; fallas: Array<{ fuente: Fuente; motivo: string }>; notas: string[] };

/** Las señales del negocio en curso para una superficie. Nunca tira: lo que no se pudo leer vuelve en `fallas`. */
export async function senalesDelNegocio(superficie: Superficie, ahora = new Date()): Promise<LecturaSenales> {
  const fuentes = FUENTES_DE[superficie];
  const out: LecturaSenales = { senales: [], fallas: [], notas: [] };
  const db = await getTenantDb();
  const leer = async (f: Fuente, fn: () => Promise<void>) => {
    if (!fuentes.includes(f)) return;
    try { await fn(); } catch (e) { out.fallas.push({ fuente: f, motivo: msg(e).slice(0, 200) }); }
  };

  // Los leads se leen UNA vez y los usan varias señales (no-show, motivos, quién avanzó, registros por página).
  let leads: Array<LeadSenal & { id: number; fecha_agenda: string | null; pagina_registro: string | null }> | null = null;
  const necesitaLeads = fuentes.some((f) => f === 'leads' || f === 'whatsapp' || f === 'landings' || f === 'objeciones');
  if (necesitaLeads) {
    try {
      const desde = new Date(ahora.getTime() - 120 * DIA).toISOString();
      leads = await leerTodo(db, 'leads', 'id, junta_1_at, asistio_j1, estado_lead, motivo_perdida, created_at, fecha_agenda, pagina_registro', {
        orden: 'id', filtros: (q) => q.or(`created_at.gte.${desde},junta_1_at.gte.${desde}`),
      });
    } catch (e) { out.fallas.push({ fuente: 'leads', motivo: msg(e).slice(0, 200) }); }
  }

  let conversacionesConLead = 0;
  await leer('whatsapp', async () => {
    const desdeLectura = new Date(ahora.getTime() - 21 * DIA);
    const r = await db.from('wa_mensajes').select('chat_jid, wa_timestamp, from_me, lead_id, tipo, texto')
      .gte('wa_timestamp', desdeLectura.toISOString()).order('wa_timestamp', { ascending: false }).limit(MAX_MENSAJES);
    if (r.error) throw new Error(`no pude leer los mensajes: ${r.error.message}`);
    const msgs = (r.data ?? []) as MensajeSenal[];
    // Con el tope lleno, lo leído empieza más tarde que los 21 días: la ventana real es la de lo leído.
    const desdeReal = msgs.length >= MAX_MENSAJES ? new Date(msgs[msgs.length - 1].wa_timestamp) : desdeLectura;
    if (msgs.length >= MAX_MENSAJES) out.notas.push(`WhatsApp: se leyeron los ${MAX_MENSAJES} mensajes más nuevos (desde ${desdeReal.toISOString().slice(0, 10)})`);
    const avanzo = leads ? new Set(leads.filter((l) => l.estado_lead === 'ganado' || l.fecha_agenda || l.junta_1_at).map((l) => Number(l.id))) : undefined;
    const lenta = senalRespuestaLenta(msgs, ahora, desdeReal, avanzo);
    const esperando = senalEsperando(msgs, ahora);
    if (lenta) out.senales.push(lenta);
    if (esperando) out.senales.push(esperando);
    const hace14 = ahora.getTime() - 14 * DIA;
    conversacionesConLead = new Set(msgs.filter((m) => m.lead_id != null && Date.parse(m.wa_timestamp) >= hace14).map((m) => m.chat_jid)).size;
  });

  await leer('leads', async () => {
    if (!leads) return;
    const ns = senalNoShow(leads, ahora);
    const mp = senalMotivoPerdida(leads, ahora);
    if (ns) out.senales.push(ns);
    if (mp) out.senales.push(mp);
  });

  await leer('automatizaciones', async () => {
    const desdeEnvios = new Date(ahora.getTime() - 7 * DIA).toISOString();
    const desdeInsc = new Date(ahora.getTime() - 30 * DIA).toISOString();
    const [secs, envios, insc] = await Promise.all([
      db.from('nutricion_secuencias').select('id, nombre, activa, pasos').is('archivada_at', null).order('id'),
      leerTodo<EnvioSenal>(db, 'nutricion_envios', 'secuencia_id, estado, error, created_at', { orden: 'id', filtros: (q) => q.gte('created_at', desdeEnvios) }),
      leerTodo<InscripcionSenal>(db, 'nutricion_inscripciones', 'secuencia_id, estado, inscripto_at', { orden: 'id', filtros: (q) => q.gte('inscripto_at', desdeInsc) }),
    ]);
    if (secs.error) throw new Error(`no pude leer las automatizaciones: ${secs.error.message}`);
    const lista: SecuenciaSenal[] = ((secs.data ?? []) as Array<{ id: number; nombre: string | null; activa: boolean | null; pasos: unknown }>).map((s) => ({
      id: Number(s.id), nombre: String(s.nombre ?? ''), activa: s.activa === true,
      esperaRespuesta: Array.isArray(s.pasos) && rasgosDelFlujo(s.pasos as PasoGrafo[]).respuesta,
    }));
    out.senales.push(...senalesDeAutomatizaciones(lista, envios, insc.map((i) => ({ ...i, secuencia_id: Number(i.secuencia_id) })), ahora));
  });

  await leer('landings', async () => {
    const dias = 30;
    const pulso = await getPulso(dias);
    // Una falla del bloque de visitas no deja afirmar ninguna conversión; una del scroll, ninguna profundidad.
    const sinVisitas = pulso.fallas.some((f) => f.bloque === 'visitas' || f.bloque === 'paginas');
    const sinScroll = pulso.fallas.some((f) => f.bloque === 'scroll');
    if (sinVisitas) throw new Error(`no pude leer las visitas: ${pulso.fallas.map((f) => f.mensaje).join('; ').slice(0, 160)}`);
    const desde = ahora.getTime() - dias * DIA;
    const registros = new Map<string, number>();
    for (const l of leads ?? []) {
      if (!l.pagina_registro || Date.parse(l.created_at) < desde) continue;
      registros.set(l.pagina_registro, (registros.get(l.pagina_registro) ?? 0) + 1);
    }
    const paginas: PaginaSenal[] = pulso.paginas.filter((p) => p.visitantes > 0).map((p) => {
      const mitad = p.profundidad?.hitos.find((h) => h.hito === 50)?.personas;
      return {
        url: p.url, visitantes: p.visitantes, dias,
        registros: leads ? registros.get(p.url) ?? 0 : null,
        scroll: !sinScroll && p.profundidad && mitad != null ? { base: p.profundidad.base, mitad } : null,
      };
    });
    out.senales.push(...senalesDeLandings(paginas));
  });

  await leer('objeciones', async () => {
    const desdeLlamadas = new Date(ahora.getTime() - 120 * DIA).toISOString().slice(0, 10);
    const [kn, oferta, llamadasCrudas] = await Promise.all([
      leerTodo<{ cuerpo: string | null }>(db, 'mako_knowledge', 'cuerpo', { orden: 'id', filtros: (q) => q.eq('fuente', FUENTE_WHATSAPP) }),
      ofertaPrincipal(await getAnswers()),
      // Las llamadas de venta analizadas (closing_analyses): cada objeción con su cita y si se respondió. La PK es
      // (workspace_id, recording_id): se pagina por recording_id.
      // Sólo las de venta ya analizadas (el mismo corte que lib/insights-llamada.ts).
      leerTodo<{ objections: unknown }>(db, 'closing_analyses', 'recording_id, objections', {
        orden: 'recording_id', eq: { status: 'analizada', category: 'venta' }, filtros: (q) => q.gte('call_date', desdeLlamadas).not('objections', 'is', null),
      }),
    ]);
    const llamadas: LlamadaSenal[] = llamadasCrudas.map((l) => ({
      objeciones: (Array.isArray(l.objections) ? l.objections : []).flatMap((o: unknown) => {
        const x = o as { quote?: unknown; note?: unknown; handled?: unknown };
        const texto = [x.quote, x.note].filter((t): t is string => typeof t === 'string').join(' — ');
        return texto ? [{ texto, respondida: x.handled === true }] : [];
      }),
    })).filter((l) => l.objeciones.length > 0);
    const hechos = kn.map((k) => hechosDeLaEntrada(String(k.cuerpo ?? ''))).filter((h) => h.length > 0);
    const motivos = (leads ?? []).filter((l) => l.estado_lead === 'perdido' && l.motivo_perdida?.trim()).map((l) => String(l.motivo_perdida));
    const c = oferta.campos;
    const o = oferta.oferta;
    const partes = [c.nombre, c.precio, c.promesa, c.incluye, c.garantia, o?.precio_nota, o?.objeciones, o?.prueba, o?.para_quien,
      ...(o?.bonos ?? []).map((b) => `${b.nombre} ${b.porque}`)];
    const texto = partes.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).join('\n');
    // Sin oferta cargada no se afirma «tu oferta no lo contesta»: no hay oferta que lo conteste ni que no.
    out.senales.push(...senalesDeObjeciones(hechos, motivos, oferta.origen === 'sin-fila' && !texto.trim() ? null : texto, llamadas));
  });

  await leer('second-brain', async () => {
    const ws = await getWorkspaceActual();
    if (ws == null) return;
    const esPlataforma = ws === (await wsSuperAdmin().catch(() => null));
    const estado = leerEstadoRecolector(await getSettingEstricto(CLAVE_RECOLECTOR), prendidoPorDefecto(esPlataforma));
    const conIA = esPlataforma || (await claveDeIAPropia(ws)) === true;
    const s = senalSecondBrainSinAprender({ prendido: estado.prendido, conIA, conversaciones: conversacionesConLead });
    if (s) out.senales.push(s);
  });

  return out;
}

// ── La memoria del negocio ──────────────────────────────────────────────────────────────────────────────────────────

/** La memoria del negocio en curso. null = no se pudo leer (no se dibuja nada que dependa de ella: se calla todo). */
export async function leerMemoriaDelNegocio(): Promise<{ m: MemoriaRecs; crudo: string | null } | null> {
  try {
    const crudo = await getSettingEstricto(CLAVE_MEMORIA);
    return { m: leerMemoria(crudo), crudo };
  } catch (e) {
    console.error(`[recomendaciones] no pude leer la memoria: ${msg(e)}`);
    return null;
  }
}

export type ResultadoDecidir = { ok: true } | { ok: false; error: string; status: number };

/**
 * Anota lo que la persona decidió sobre una recomendación (compare-and-set: dos personas que deciden a la vez no se
 * pisan). La recomendación tiene que existir HOY en esa superficie: no se anota sobre una clave inventada.
 */
export async function decidirRecomendacion(o: { superficie: Superficie; clave: string; d: Decision; motivo?: string | null; quien: string }): Promise<ResultadoDecidir> {
  // Reabrir no pide que la señal siga hoy: pide que haya algo callado con esa clave. Lo demás, que la recomendación exista.
  let senal: { tipo: string; valor: number } | null = null;
  if (o.d !== 'reabierta') {
    const { senales, fallas } = await senalesDelNegocio(o.superficie);
    const s = senales.find((x) => claveDe(x) === o.clave);
    if (!s) return fallas.length
      ? { ok: false, error: 'No pude leer los datos de esa recomendación. Intenta de nuevo.', status: 503 }
      : { ok: false, error: 'Esa recomendación ya no está (el dato cambió).', status: 404 };
    senal = s;
  }
  for (let intento = 0; intento < 3; intento++) {
    const leida = await leerMemoriaDelNegocio();
    if (!leida) return { ok: false, error: 'No pude leer lo que ya decidiste. Intenta de nuevo.', status: 503 };
    const previa = ultimaDecision(leida.m, o.clave);
    if (o.d === 'reabierta' && (!previa || (previa.d !== 'no-aplica' && previa.d !== 'ahora-no'))) {
      return { ok: false, error: 'Esa recomendación no está descartada.', status: 404 };
    }
    const base = senal ?? { tipo: previa!.tipo, valor: previa!.valor };
    const nueva = anotarDecision(leida.m, {
      clave: o.clave, tipo: base.tipo, superficie: o.superficie, d: o.d, en: new Date().toISOString(), valor: base.valor, quien: o.quien,
      ...(o.motivo?.trim() ? { motivo: o.motivo } : {}),
    });
    if (await cambiarSettingSi(CLAVE_MEMORIA, leida.crudo, JSON.stringify(nueva))) {
      cache.clear();
      return { ok: true };
    }
  }
  return { ok: false, error: 'Otra persona estaba decidiendo a la vez. Intenta de nuevo.', status: 409 };
}

// ── Lo que se muestra ───────────────────────────────────────────────────────────────────────────────────────────────

export type RecomendacionesDe = {
  superficie: Superficie;
  recomendaciones: Recomendacion[];
  /** Lo aceptado que ya no se sostiene: «lo que cambió». */
  funcionaron: Array<{ clave: string; aceptadaEl: string; antes: number }>;
  /** Lo que la persona calló y sigue callado, con su motivo: se reabre con `reabierta`. */
  descartadas: Array<Pick<DecisionGuardada, 'clave' | 'tipo' | 'superficie' | 'd' | 'motivo' | 'en'>>;
  /** Fuentes que no se pudieron leer: lo que dependía de ellas no se dice, ni bien ni mal. */
  fallas: Array<{ fuente: string; motivo: string }>;
  notas: string[];
  /** De dónde salió el texto: la IA del negocio, las reglas (sin su IA, o la IA todavía no redactó), o nada que decir. */
  redaccion: 'ia' | 'reglas' | 'nada';
};

type Redaccion = { huella: string; en: string; recs: Recomendacion[] };
const leerRedaccionGuardada = (crudo: string | null): Redaccion | null => {
  if (!crudo) return null;
  try {
    const j = JSON.parse(crudo) as Redaccion;
    return typeof j?.huella === 'string' && Array.isArray(j.recs) && typeof j.en === 'string' ? j : null;
  } catch { return null; }
};

/** Caché en memoria por negocio y superficie (cada instancia la suya): abrir una tab cinco veces no relee cinco veces. */
const cache = new Map<string, { hasta: number; r: RecomendacionesDe }>();
const TTL_MS = 10 * 60_000;
/** Redacciones de la IA en curso en esta instancia: dos pedidos a la vez no gastan dos veces. */
const enCurso = new Set<string>();

/** ¿Puede este negocio usar SU IA para redactar? (el espacio de MaKo usa la de la plataforma, que es la suya). */
async function puedeRedactar(ws: number): Promise<boolean> {
  const plataforma = await wsSuperAdmin().catch(() => null);
  if (ws === plataforma) return true;
  return (await claveDeIAPropia(ws).catch(() => false)) === true;
}

/** El contexto que lee la IA: el perfil y la fase del negocio, recortados. Ningún dato de un lead. */
async function contextoDelNegocio(): Promise<{ negocio: string; extras: string[] }> {
  const [perfil, fase] = await Promise.all([perfilNegocioTexto().catch(() => ''), faseNegocioTexto().catch(() => '')]);
  return { negocio: [perfil.slice(0, 1800), fase ? `Fase: ${fase.slice(0, 400)}` : ''].filter(Boolean).join('\n'), extras: [] };
}

/**
 * Pide la redacción a la IA del negocio y la guarda para esa huella. Se llama en `after()`: nadie la espera. Una IA que
 * falla no guarda nada (la próxima vez se vuelve a intentar); una que dice «nada vale la pena» se guarda así.
 */
export async function redactarYGuardar(superficie: Superficie, habla: ReturnType<typeof senalesQueHablan>, m: MemoriaRecs, huella: string): Promise<void> {
  const ws = await getWorkspaceActual();
  const llave = `${ws}:${huella}`;
  if (ws == null || enCurso.has(llave)) return;
  enCurso.add(llave);
  try {
    const contexto = await contextoDelNegocio();
    const { system, user } = pedidoAlAsesor({ superficie, senales: habla, contexto, memoria: m });
    const errores: string[] = [];
    const texto = await chatCheapCascade({ system, user, json: true, feature: FEATURE_RECOMIENDA, maxTokens: 900, temperature: 0.2, erroresOut: errores, hastaMs: Date.now() + 45_000 });
    if (!texto.trim()) { if (errores.length) console.error(`[recomendaciones] ws=${ws} la IA no respondió: ${errores[0].slice(0, 160)}`); return; }
    const l = leerRedaccion(texto, { superficie, senales: habla, dossier: user });
    if (!l.ok) { console.error(`[recomendaciones] ws=${ws} no entendí la redacción: ${l.motivo}`); return; }
    if (l.descartadas.length) console.log(`[recomendaciones] ws=${ws} ${superficie}: descarté ${l.descartadas.length} de la IA (${l.descartadas.map((d) => d.motivo).join(' · ').slice(0, 300)})`);
    await setSetting(claveRedaccion(superficie), JSON.stringify({ huella, en: new Date().toISOString(), recs: l.recs } satisfies Redaccion));
    for (const k of cache.keys()) if (k.startsWith(`${ws}:${superficie}`)) cache.delete(k);
  } catch (e) {
    console.error(`[recomendaciones] ws=${ws} no pude redactar: ${msg(e)}`);
  } finally {
    enCurso.delete(llave);
  }
}

/**
 * Lo que MaKo recomienda HOY en una superficie, para el negocio en curso. `alDespues` recibe el trabajo que conviene
 * correr después de contestar (la redacción de la IA); sin él, no se redacta (la API por HTTP, un test).
 */
export async function recomendacionesDe(superficie: Superficie, o: { ahora?: Date; alDespues?: (fn: () => Promise<void>) => void } = {}): Promise<RecomendacionesDe> {
  const ahora = o.ahora ?? new Date();
  const ws = await getWorkspaceActual();
  const k = `${ws}:${superficie}`;
  const c = cache.get(k);
  if (c && c.hasta > Date.now() && !o.ahora) return c.r;
  const [lectura, memoria] = await Promise.all([senalesDelNegocio(superficie, ahora), leerMemoriaDelNegocio()]);
  const base = { superficie, fallas: lectura.fallas, notas: lectura.notas };
  // Sin la memoria no se sabe qué descartó: mostrar sería arriesgarse a repetir lo que dijo que no. Se calla.
  if (!memoria) return { ...base, recomendaciones: [], funcionaron: [], descartadas: [], fallas: [...lectura.fallas, { fuente: 'memoria', motivo: 'no pude leer lo que ya decidiste' }], redaccion: 'nada' };
  const habla = senalesQueHablan(lectura.senales, memoria.m, superficie, ahora);
  const funciono = funcionaron(memoria.m, lectura.senales, ahora);
  const callado = descartadas(memoria.m, ahora).map(({ clave, tipo, superficie: s, d, motivo, en }) => ({ clave, tipo, superficie: s, d, en, ...(motivo ? { motivo } : {}) }));
  let r: RecomendacionesDe;
  if (!habla.length) r = { ...base, recomendaciones: [], funcionaron: funciono, descartadas: callado, redaccion: 'nada' };
  else {
    const reglas = elegirSinIA(lectura.senales, memoria.m, superficie, ahora);
    const redacta = ws != null && (await puedeRedactar(ws));
    const huella = huellaDe(superficie, habla, memoria.m);
    const guardada = redacta ? leerRedaccionGuardada(await getSetting(claveRedaccion(superficie)).catch(() => null)) : null;
    if (guardada && guardada.huella === huella && Date.now() - Date.parse(guardada.en) < VIGENCIA_REDACCION_MS) {
      r = { ...base, recomendaciones: guardada.recs, funcionaron: funciono, descartadas: callado, redaccion: guardada.recs.length ? 'ia' : 'nada' };
    } else {
      if (redacta && o.alDespues) o.alDespues(() => redactarYGuardar(superficie, habla, memoria.m, huella));
      r = { ...base, recomendaciones: reglas, funcionaron: funciono, descartadas: callado, redaccion: 'reglas' };
    }
  }
  cache.set(k, { hasta: Date.now() + TTL_MS, r });
  return r;
}
