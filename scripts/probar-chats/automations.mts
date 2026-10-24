// =============================================================================
// probar-chats/automations — el chat de MaKo de Automations, probado SIN PANTALLA, con lo GUARDADO como juez
// =============================================================================
// Martín, 22/10/2026: «prueba los chats... Como el chat de MaKo en Automations, todo debe funcionar. Prueba muchos
// casos de uso». Es el chat de la campaña del Sprint de Mauricio (la llamada del 22/10, 01:51-02:10: pegó la secuencia
// con «Quiero que estos sean los mensajes», MaKo armó dos WhatsApp, contestó «indícame qué cambios…» y después metió un
// audio y una variable que no existe).
//
// QUÉ LLAMA (lo mismo que la pantalla, en el mismo orden que app/automations/ChatMako.tsx):
//   · cada mensaje nuevo pasa primero por POST /api/mako/pedidos (los pedidos sueltos: «créame otra…»), con
//     `cuerpoPedidos`, `interpretacionDe`, `paraLienzoVacio`, `burbujasDe` y `textoActual` (app/automations/pedidos-chat.ts);
//   · lo de ESTA automatización va a POST /api/chat-agent/secuencias/ia (`cuerpoIA`, app/automations/stream-ia.ts):
//     con el lienzo vacío CREA (y guarda), con tarjetas EDITA (devuelve el borrador; no guarda);
//   · lo que hace la pantalla con el resultado (SecuenciaPerfil.tsx, `alListoIA`): el borrador si `edicionTocaPasos` y
//     `edicionVigente`, el CRON por `action: 'disparadores'`, y el borrador a la base por `action: 'borrador'`
//     (useBorradorSecuencia) para que el juez lo lea de la base;
//   · una pregunta de MaKo se contesta como un botón (`respuestaMako`) o como «Otra cosa».
// Las filas se crean por `action: 'crear_vacia'` (la de «Lienzo en blanco») y los lienzos de partida por
// `setSecuenciaPasos` (lo mismo que guarda crear). El CRM de prueba, por `crearCrm`, y sus etapas como el «agregar» de
// `editarEtapaAction` (`crearEtapa`: la acción no carga fuera de Next).
//
// EL JUEZ (`juzgar`) mira lo GUARDADO: el lienzo de la fila (el borrador si hay), su CRON, las filas nuevas y las
// etiquetas creadas; el texto de MaKo sólo para lo que se DICE (no saluda, no dice «hecho» sin que nada cambie, nombra el
// lugar real). Cada caso del JSON trae su criterio en palabras (`juicio`) para lo que una regla no alcanza.
//
// CÓMO SE CORRE (desde la raíz de un worktree; NO levanta Next):
//   node --env-file=<.env.local> --conditions=react-server --import tsx scripts/probar-chats/automations.mts \
//     [--casos=id1,id2] [--salida=<archivo.json>] [--ws=3] [--intencion=editar|discutir|ninguna] [--listar]
// Para probar OTRA rama: correr el mismo comando en un worktree de esa rama (los casos y el juez son los mismos).
// Las 18 fallas VERIFICADAS (3 corridas cada una, veredicto a mano, causa con archivo:línea): verificacion-automations-be4b9189a.json.
// Ese commit corrigió el juez: «cada «Cambié» cambió algo que se ve» (siempre), `lienzoNo` (regex sobre el texto crudo) y
// los criterios de cinco-min-entre-mensajes, no-sabado-domingo, variable-inventada, imposible y ambiguo (un «\b» que JSON
// leía como retroceso). Contra base-automations-43b0c2625.json esos casos se comparan a mano.
//
// REGLAS (no se negocian): sólo el workspace de PRUEBA (`enWs` tira con otro: nunca el ws1); todo lo que crea lleva
// `PREFIJO` en el nombre y queda PAUSADO; no publica, no activa, no manda nada («Probar en WhatsApp» no se toca).
// =============================================================================

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { RAIZ, usarSesion, sesionSuperAdmin, llamar, leerRespuesta, enWs, type EventoConHora } from './entorno.mjs';

// ── Argumentos ───────────────────────────────────────────────────────────────────────
const arg = (n: string): string | null => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : null;
};
const WS = Number(arg('ws') ?? 3);
// SÓLO EL ws3 (Cliente de Prueba): el arnés crea automatizaciones y un CRM en el negocio que se le diga, y le escribe a la base
// de PRODUCCIÓN. Con `--ws` de un cliente, le dejaba automatizaciones de prueba en su lista (23/10/2026).
if (WS !== 3) throw new Error(`el arnés corre sólo en el ws3 (Cliente de Prueba), no en el ws${WS}`);
const SOLO = (arg('casos') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const EMAIL = arg('email') ?? 'martinkoncke@gmail.com';
const SHA = (() => { try { return execFileSync('git', ['-C', RAIZ, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return '?'; } })();
const SALIDA = arg('salida') ?? join(tmpdir(), 'probar-chats', `automations-${SHA.slice(0, 9)}-${Date.now()}.json`);
/** «Discutir» o «Editar» de ChatMako.tsx (por defecto Editar, como arranca la pantalla); `ninguna` = no lo manda. */
const INTENCION: 'discutir' | 'editar' | undefined = ((v) => (v === 'ninguna' ? undefined : v === 'discutir' ? 'discutir' : 'editar'))(arg('intencion') ?? process.env.INTENCION);

export const PREFIJO = '🧪 Prueba chats 22/10';
const CRM_NOMBRE = `${PREFIJO} · Automations`;
/** Más que esto, por turno, es un hallazgo (la regla de Martín: «más de ~20 s»). */
const SEGUNDOS_HALLAZGO = 20;
/** Un turno que no llegó a ninguna IA (cuota o saturación de la red), no una respuesta del chat: `falloDeIA` de lib/flujo-ia.ts. */
const RX_SIN_IA = /ninguna IA gratis conectada|Ninguna IA contest|est[aá] al tope|est[aá] saturado|no contest[oó] a tiempo/i;

// ── Los casos ────────────────────────────────────────────────────────────────────────
type Turno =
  | { dice: string | string[]; origen?: 'barra' | 'afuera'; soloSiPregunta?: boolean }
  | { elegir: string; soloSiPregunta?: boolean }
  | { pulsar: string };
type Espera = {
  mensajes?: string[]; cantidadMensajes?: number; minMensajes?: number; sinAudio?: boolean; variablesValidas?: boolean;
  esperasMin?: number[]; noTocaLienzo?: boolean; pregunta?: boolean; textoNo?: string[]; textoSi?: string[];
  disparadorEtapa?: string; disparadorSinCambio?: boolean; operaciones?: string[]; moverA?: string;
  etiquetaCondicion?: string; sinEtiquetasNuevas?: boolean; canal?: string; noContiene?: string[]; antesQue?: [string, string];
  filaNueva?: boolean; abiertaSinCambio?: boolean; sinError?: boolean; unaPregunta?: boolean; sinCambiosNoNombrados?: boolean;
  sinCanal?: string; noRepitePregunta?: boolean;
  /** Ningún texto de mensaje repetido (dos tarjetas con el mismo texto le llegan dos veces al lead). */
  sinDuplicados?: boolean;
  /** La condición va ENTRE el CRON y el primer mensaje: el CRON sigue en ella (no en paralelo) y los mensajes cuelgan de ella. */
  condicionPrimero?: boolean;
  /** Regex que NINGÚN texto de mensaje puede tener, sobre el texto CRUDO (sin `norm`: «al frente de?» se ve con su «?»). */
  lienzoNo?: string[];
  /** El mensaje del seguimiento (un pedazo de su texto) cuelga de «No contestó desde que entró» (23/10/2026, #289). */
  seguimientoNoContesto?: string;
};
type Caso = {
  id: string; titulo: string; partida: string; disparador?: { etapa: string }; antes?: Array<{ crearEtapa: string; recrear?: boolean }>;
  turnos: Turno[]; espera: Espera; juicio: string;
};
const ARCHIVO_CASOS = join(import.meta.dirname, 'casos-automations.json');
const definicion = JSON.parse(readFileSync(ARCHIVO_CASOS, 'utf8')) as { partidas: Record<string, unknown[]>; casos: Caso[] };
const casos = definicion.casos.filter((c) => !SOLO.length || SOLO.includes(c.id));
if (process.argv.includes('--listar')) {
  for (const c of definicion.casos) console.log(`${c.id.padEnd(34)} ${c.titulo}`);
  process.exit(0);
}

// ── La app (después de `entorno`: la sesión ya está puesta) ─────────────────────────────
usarSesion(await sesionSuperAdmin(EMAIL));
const ia = await import('../../app/api/chat-agent/secuencias/ia/route');
const rutaPedidos = await import('../../app/api/mako/pedidos/route');
const rutaSec = await import('../../app/api/chat-agent/secuencias/route');
const pc = await import('../../app/automations/pedidos-chat');
const fic = await import('../../lib/flujo-ia-cliente');
const { cuerpoIA } = await import('../../app/automations/stream-ia');
const { setSecuenciaPasos } = await import('../../lib/nutricion');
const { firmaPublicado } = await import('../../lib/secuencia-borrador');
const { nombreDeTarjeta } = await import('../../lib/flujo-conversacion');
const { claseDe } = await import('../../lib/flujo-grafo');
const { problemasDeTokens } = await import('../../lib/tokens-del-flujo');
const { leerChat } = await import('../../lib/automatizacion-chat-db');
const { disparadorDeValorIA } = await import('../../lib/disparadores');
const { productosConEtapas } = await import('../../lib/setting-secuencias');
const { getSupabaseServer } = await import('../../lib/supabase');
const db = getSupabaseServer();

type PasoGrafo = Record<string, unknown> & { id?: string; siguiente?: string | null; nodo?: string };
type Mensaje = Record<string, unknown> & { id: string; de: 'yo' | 'mako'; texto: string };
type Pregunta = { id: string; sobre: string; texto: string; opciones: Array<{ valor: string; label: string }> };
type Ronda = { pedido: string; respuestas: unknown[]; pregunta: Pregunta };

/** Lo que pide la pantalla: el ⚠️ `textoDeListo` de ChatMako.tsx (lo dicho al terminar de editar). */
function textoDeListo(l: { resumen?: string; disparadores?: unknown[]; orden: unknown[] }): string {
  const r = l.resumen?.trim();
  if (r) return r;
  if (l.disparadores?.length) return 'Cambié qué la dispara';
  const n = l.orden.length;
  if (n) return n === 1 ? 'Agregué 1 tarjeta' : `Agregué ${n} tarjetas`;
  return 'Listo';
}
let cuenta = 0;
const nuevoId = (de: string) => `${de}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${(cuenta++).toString(36)}`;

// ── La base: lo GUARDADO ────────────────────────────────────────────────────────────────
type Fila = { id: number; nombre: string; activa: boolean; pasos: PasoGrafo[]; pasos_borrador: { pasos?: PasoGrafo[] } | null; disparadores: Array<Record<string, unknown>> | null; trigger_tipo: string; archivada_at: string | null };
async function leerFila(id: number): Promise<Fila | null> {
  const { data, error } = await db.from('nutricion_secuencias').select('id, nombre, activa, pasos, pasos_borrador, disparadores, trigger_tipo, archivada_at').eq('workspace_id', WS).eq('id', id).maybeSingle();
  if (error) throw new Error(`leerFila #${id}: ${error.message}`);
  return (data as Fila | null) ?? null;
}
/** El lienzo como lo abre la pantalla: el borrador si hay, si no lo publicado. */
const lienzoDe = (f: Fila): PasoGrafo[] => (Array.isArray(f.pasos_borrador?.pasos) ? f.pasos_borrador!.pasos! : Array.isArray(f.pasos) ? f.pasos : []);

async function usoDesde(desde: string): Promise<string[]> {
  const { data } = await db.from('anthropic_usage').select('*').eq('workspace_id', WS).gte('created_at', desde).order('created_at', { ascending: true });
  return ((data ?? []) as Array<Record<string, unknown>>).map((u) => `${u.provider}/${u.model}${u.motivo ? ` (${String(u.motivo).slice(0, 60)})` : ''}`);
}

// ── Leer un flujo: el camino desde el inicio, tarjeta por tarjeta ─────────────────────
type Tarjeta = { id: string; clase: string; nombre: string; canal?: string; textos: string[]; audio: boolean; esperaMin?: number; delayH?: number; op?: string; params?: Record<string, unknown>; filas?: unknown };
function recorrido(pasos: PasoGrafo[]): Tarjeta[] {
  const porId = new Map(pasos.filter((p) => p?.id).map((p) => [String(p.id), p]));
  const vistos = new Set<string>();
  const out: Tarjeta[] = [];
  const visitar = (id: string | null | undefined) => {
    if (!id || vistos.has(id)) return;
    const p = porId.get(id);
    if (!p) return;
    vistos.add(id);
    out.push(tarjeta(pasos, p));
    const sig: Array<string | null | undefined> = [p.siguiente as string | null | undefined, ...((p.paralelos as string[] | undefined) ?? [])];
    for (const r of (p.ramas as Array<{ siguiente?: string; paralelos?: string[] }> | undefined) ?? []) sig.push(r.siguiente, ...(r.paralelos ?? []));
    for (const c of (p.casos as Array<{ siguiente?: string }> | undefined) ?? []) sig.push(c.siguiente);
    sig.push(p.si_no as string | null | undefined);
    const destino = p.destino as { nodo?: string } | null | undefined;
    if (destino?.nodo) sig.push(destino.nodo);
    for (const s of sig) visitar(s);
  };
  const inicio = pasos.find((p) => p?.nodo === 'inicio');
  if (inicio) visitar(String(inicio.id));
  // Las «Si responde» cuelgan del CRON, y lo suelto también se muestra (al final).
  for (const p of pasos) if (p?.id && !vistos.has(String(p.id))) visitar(String(p.id));
  return out;
}
function tarjeta(pasos: PasoGrafo[], p: PasoGrafo): Tarjeta {
  const clase = claseDe(p as never) as string;
  const partes = Array.isArray(p.partes) ? (p.partes as Array<{ cuerpo?: string; tipo?: string }>) : [];
  const textos = clase === 'mensaje' ? (partes.length ? partes.map((x) => String(x.cuerpo ?? '')) : [String(p.cuerpo ?? '')]) : [];
  const accion = (p.accion ?? null) as { operacion?: string; params?: Record<string, unknown> } | null;
  const espera = p.espera as { modo?: string; minutos?: number } | undefined;
  return {
    id: String(p.id), clase, nombre: nombreDeTarjeta(pasos as never, String(p.id)),
    ...(p.canal ? { canal: String(p.canal) } : {}),
    textos: textos.filter((t) => t.trim()),
    audio: clase === 'mensaje' && (p.tipo === 'audio' || p.audio_id != null || partes.some((x) => x.tipo === 'audio')),
    ...(clase === 'esperar' && espera?.minutos != null ? { esperaMin: espera.minutos } : {}),
    ...(clase === 'mensaje' && Number(p.delay_horas) > 0 ? { delayH: Number(p.delay_horas) } : {}),
    ...(accion?.operacion ? { op: accion.operacion, params: accion.params ?? {} } : {}),
    ...(clase === 'condicion' ? { filas: (p.ramas as unknown[] | undefined) ?? [] } : {}),
  };
}
const linea = (t: Tarjeta): string => {
  const titulo = t.nombre.split(':')[0];
  const cuerpo = t.textos.length ? `${titulo}: «${t.textos.join(' ⏎ ').replace(/\s+/g, ' ').slice(0, 160)}»` : t.nombre;
  const extra = [t.esperaMin != null ? `${t.esperaMin} min` : '', t.delayH ? `delay ${t.delayH} h` : '', t.audio ? 'AUDIO' : '', t.op ? `op=${t.op}` : '', t.canal && t.canal !== 'whatsapp' ? `canal=${t.canal}` : ''].filter(Boolean).join(' · ');
  return `${cuerpo}${extra ? ` [${extra}]` : ''}`;
};

// ── El juez ─────────────────────────────────────────────────────────────────────────
/** Para comparar textos: sin tildes, sin signos ni emojis, sin dobles espacios, en minúscula. */
const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/\{\{?\s*nombre\s*\}?\}/g, 'nombre').replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();
const contiene = (a: string, b: string): boolean => norm(a).includes(norm(b));
const TOKENS = /\{\{\s*([^}]+?)\s*\}\}/g;

type Chequeo = { que: string; ok: boolean; detalle: string };
type Estado = { secId: number; fila: Fila; tarjetas: Tarjeta[]; mensajes: Array<{ textos: string[]; audio: boolean }>; disparadores: Array<Record<string, unknown>> };

function juzgar(c: Caso, x: {
  antes: Estado; despues: Estado; abiertaAntes: Estado; abiertaDespues: Estado | null; textosMako: string[]; preguntas: Pregunta[];
  errores: string[]; etiquetasNuevas: Array<{ nombre: string }>; etapas: Map<string, string>; filasNuevas: number[]; fantasmas: string[];
}): Chequeo[] {
  const e = c.espera;
  const out: Chequeo[] = [];
  const ok = (que: string, cond: boolean, detalle: string) => out.push({ que, ok: cond, detalle });
  const msgs = x.despues.mensajes;
  const textosPlanos = msgs.flatMap((m) => m.textos);
  const todoMako = x.textosMako.join(' \n ');
  if (e.sinError !== false) ok('sin error de MaKo', x.errores.length === 0, x.errores.join(' | ') || 'ninguno');
  if (e.mensajes) {
    let i = 0;
    const faltan: string[] = [];
    for (const esperado of e.mensajes) {
      const j = textosPlanos.findIndex((t, k) => k >= i && contiene(t, esperado));
      if (j < 0) faltan.push(esperado.slice(0, 50)); else i = j + 1;
    }
    ok('los mensajes pedidos, en ese orden', faltan.length === 0, faltan.length ? `faltan o fuera de orden: «${faltan.join('» · «')}»` : `${e.mensajes.length} en orden`);
  }
  if (e.cantidadMensajes != null) ok(`exactamente ${e.cantidadMensajes} mensajes`, textosPlanos.length === e.cantidadMensajes, `hay ${textosPlanos.length}`);
  if (e.minMensajes != null) ok(`al menos ${e.minMensajes} mensajes`, textosPlanos.length >= e.minMensajes, `hay ${textosPlanos.length}`);
  if (e.sinAudio) ok('sin tarjetas de audio inventadas', !x.despues.mensajes.some((m) => m.audio), x.despues.tarjetas.filter((t) => t.audio).map((t) => t.nombre).join(' · ') || 'ninguna');
  if (e.variablesValidas) {
    // La MISMA revisión que Publicar (`problemasDeTokens`), y además un «{Nombre}» de una llave: sale crudo al teléfono.
    const prob = problemasDeTokens(lienzoDe(x.despues.fila) as never, x.despues.fila.trigger_tipo);
    const usados = [...new Set(textosPlanos.flatMap((t) => [...t.matchAll(TOKENS)].map((m) => m[1])))];
    const sueltas = textosPlanos.flatMap((t) => [...t.matchAll(/(^|[^{])\{([^{}]{1,30})\}(?!\})/g)].map((m) => `{${m[2]}}`));
    ok('sólo variables que existen', prob.length === 0 && sueltas.length === 0,
      prob.length || sueltas.length ? [...prob.map((p) => p.motivo), ...(sueltas.length ? [`de una llave (sale crudo): ${sueltas.join(', ')}`] : [])].join(' | ') : `usa: ${usados.join(', ') || 'ninguna'}`);
  }
  if (e.sinCanal) ok(`sin mensajes por ${e.sinCanal}`, !x.despues.tarjetas.some((t) => t.clase === 'mensaje' && (t.canal ?? 'whatsapp') === e.sinCanal), x.despues.tarjetas.filter((t) => t.clase === 'mensaje').map((t) => t.canal ?? 'whatsapp').join(', ') || 'ningún mensaje');
  if (e.noRepitePregunta) {
    const sobres = x.preguntas.map((p) => `${p.sobre}:${norm(p.texto)}`);
    ok('no repite una pregunta ya contestada', new Set(sobres).size === sobres.length, x.preguntas.map((p) => `${p.sobre}: ${p.texto}`).join(' | ') || 'sin preguntas');
  }
  if (e.esperasMin) {
    const esperas = x.despues.tarjetas.filter((t) => t.esperaMin != null || t.delayH).map((t) => t.esperaMin ?? (t.delayH ?? 0) * 60);
    ok(`esperas ${e.esperasMin.join(', ')} min`, JSON.stringify(esperas) === JSON.stringify(e.esperasMin), `hay: ${esperas.join(', ') || 'ninguna'}`);
  }
  if (e.noTocaLienzo) ok('no tocó el lienzo', JSON.stringify(lienzoDe(x.antes.fila)) === JSON.stringify(lienzoDe(x.despues.fila)), JSON.stringify(lienzoDe(x.antes.fila)) === JSON.stringify(lienzoDe(x.despues.fila)) ? 'igual' : 'cambió');
  if (e.pregunta != null) ok(e.pregunta ? 'pregunta antes de hacer' : 'no pregunta: hace', (x.preguntas.length > 0) === e.pregunta, x.preguntas.map((p) => p.texto).join(' | ') || 'sin preguntas');
  if (e.unaPregunta) {
    const signos = (todoMako.match(/\?/g) ?? []).length;
    ok('UNA pregunta concreta', x.preguntas.length === 1 || (x.preguntas.length === 0 && signos >= 1 && signos <= 2), `${x.preguntas.length} preguntas con botones · ${signos} «?» en el texto`);
  }
  for (const r of e.textoNo ?? []) ok(`MaKo no dice /${r}/`, !new RegExp(r, 'i').test(todoMako), new RegExp(r, 'i').exec(todoMako)?.[0] ?? 'no');
  for (const r of e.textoSi ?? []) ok(`MaKo dice /${r}/`, new RegExp(r, 'i').test(todoMako), new RegExp(r, 'i').exec(todoMako)?.[0] ?? 'no lo dice');
  if (e.disparadorEtapa) {
    const key = x.etapas.get(norm(e.disparadorEtapa));
    const d = x.despues.disparadores;
    const tiene = !!key && d.some((y) => y.etapa === key || (Array.isArray(y.etapas) && (y.etapas as string[]).includes(key)));
    ok(`dispara en «${e.disparadorEtapa}»`, tiene, `etapa ${key ?? '(no existe)'} · guardado: ${JSON.stringify(d.map((y) => ({ t: y.trigger_tipo, etapa: y.etapa, funnel: y.funnel_id })))}`);
  }
  if (e.disparadorSinCambio) ok('el CRON no cambió', JSON.stringify(x.antes.disparadores) === JSON.stringify(x.despues.disparadores), JSON.stringify(x.despues.disparadores.map((y) => ({ t: y.trigger_tipo, etapa: y.etapa }))));
  for (const op of e.operaciones ?? []) ok(`hay una tarjeta «${op}»`, x.despues.tarjetas.some((t) => t.op === op), x.despues.tarjetas.filter((t) => t.op).map((t) => t.op).join(', ') || 'ninguna acción');
  if (e.moverA) {
    const key = x.etapas.get(norm(e.moverA));
    const mov = x.despues.tarjetas.filter((t) => t.op === 'proponer_cambio_etapa');
    ok(`mueve a «${e.moverA}»`, !!key && mov.some((t) => t.params?.etapa === key), `etapa ${key ?? '(no existe)'} · mueve a: ${mov.map((t) => String(t.params?.etapa)).join(', ') || 'nada'}`);
  }
  if (e.etiquetaCondicion) {
    const cond = JSON.stringify(x.despues.tarjetas.filter((t) => t.clase === 'condicion').map((t) => t.filas));
    ok(`condición por la etiqueta «${e.etiquetaCondicion}»`, /"campo":"etiqueta"/.test(cond), cond.slice(0, 200));
  }
  if (e.condicionPrimero) {
    // ⚠️ «Antes del primer mensaje, una condición» (22/10/2026, la verificación contra 87365c830): «despues_de: cron» con el CRON
    // ya ocupado la cuelga EN PARALELO (lib/flujo-ia.ts, `agregarTramos`, lugar «cron»), sin aviso. La condición existe pero no
    // filtra nada: los mensajes salen igual. El chequeo de `etiquetaCondicion` sola la daba por buena.
    const ps = lienzoDe(x.despues.fila);
    const ini = ps.find((p) => p?.nodo === 'inicio');
    const primera = ini?.siguiente ? ps.find((p) => String(p.id) === String(ini.siguiente)) : undefined;
    const esCond = !!primera && claseDe(primera as never) === 'condicion';
    // Lo que se alcanza desde la condición (sus ramas, su «si no» y lo que sigue), sin lo suelto.
    const porId = new Map(ps.filter((p) => p?.id).map((p) => [String(p.id), p]));
    const alcanza = new Set<string>();
    const ir = (id: unknown) => {
      if (!id || alcanza.has(String(id))) return;
      const p = porId.get(String(id));
      if (!p) return;
      alcanza.add(String(id));
      [p.siguiente, ...((p.paralelos as string[] | undefined) ?? []), p.si_no, ...((p.ramas as Array<{ siguiente?: string }> | undefined) ?? []).map((r) => r.siguiente)].forEach(ir);
    };
    if (esCond) ir(primera!.id);
    const mensajesBajo = [...alcanza].filter((id) => claseDe(porId.get(id) as never) === 'mensaje').length;
    const paralelos = ((ini?.paralelos as string[] | undefined) ?? []).length;
    ok('la condición va entre el CRON y el primer mensaje', esCond && paralelos === 0 && mensajesBajo === msgs.length && msgs.length > 0,
      `el CRON sigue en: ${primera ? linea(tarjeta(ps, primera)) : 'nada'} · caminos en paralelo desde el CRON: ${paralelos}`);
  }
  if (e.sinDuplicados) {
    const vistos = new Map<string, number>();
    for (const t of textosPlanos) vistos.set(norm(t), (vistos.get(norm(t)) ?? 0) + 1);
    const rep = [...vistos.entries()].filter(([, n]) => n > 1);
    ok('ningún mensaje repetido', rep.length === 0, rep.length ? rep.map(([t, n]) => `«${t.slice(0, 40)}» ×${n}`).join(' · ') : 'ninguno');
  }
  if (e.sinEtiquetasNuevas) ok('no creó etiquetas', x.etiquetasNuevas.length === 0, x.etiquetasNuevas.map((t) => t.nombre).join(', ') || 'ninguna');
  if (e.canal) ok(`hay una tarjeta por ${e.canal}`, x.despues.tarjetas.some((t) => t.canal === e.canal), [...new Set(x.despues.tarjetas.map((t) => t.canal).filter(Boolean))].join(', ') || 'sin canal');
  for (const r of e.lienzoNo ?? []) {
    const rx = new RegExp(r, 'i');
    const malo = textosPlanos.find((y) => rx.test(y));
    ok(`ningún mensaje con /${r}/`, !malo, malo ? `«${malo.slice(0, 80)}»` : 'ninguno');
  }
  if (e.seguimientoNoContesto) {
    // 23/10/2026 (#289): el mensaje del seguimiento cuelga de una condición «No contestó desde que entró» (contesto, no).
    const ps = lienzoDe(x.despues.fila);
    const m = ps.find((p) => claseDe(p as never) === 'mensaje' && contiene(String(p.cuerpo ?? ''), e.seguimientoNoContesto!));
    const padre = m ? ps.find((p) => ((p.ramas as Array<{ siguiente?: string; filas?: Array<{ campo?: string; no?: boolean }> }> | undefined) ?? []).some((r) => r.siguiente === m.id && (r.filas ?? []).some((f) => f.campo === 'contesto' && f.no))) : undefined;
    ok('el seguimiento va detrás de «No contestó desde que entró»', !!padre, m ? (padre ? 'sí' : 'cuelga de otra cosa') : 'no está el mensaje del seguimiento');
  }
  for (const t of e.noContiene ?? []) ok(`ya no está «${t.slice(0, 40)}»`, !textosPlanos.some((y) => contiene(y, t)), textosPlanos.some((y) => contiene(y, t)) ? 'sigue' : 'no está');
  if (e.antesQue) {
    const [a, b] = e.antesQue;
    const ia_ = textosPlanos.findIndex((y) => contiene(y, a));
    const ib = textosPlanos.findIndex((y) => contiene(y, b));
    ok(`«${a.slice(0, 25)}» antes que «${b.slice(0, 25)}»`, ia_ >= 0 && ib >= 0 && ia_ < ib, `posiciones ${ia_} y ${ib}`);
  }
  if (e.sinCambiosNoNombrados) {
    // Las de antes que no se nombraron siguen IGUAL (texto a texto).
    const antes = x.antes.mensajes.flatMap((m) => m.textos);
    const cambiadas = antes.filter((t) => !textosPlanos.some((y) => norm(y) === norm(t)));
    ok('no tocó lo que no se nombró', cambiadas.length <= 1, cambiadas.length ? `cambiaron o se fueron: «${cambiadas.map((y) => y.slice(0, 40)).join('» · «')}»` : 'todas iguales');
  }
  // Siempre: cada «Cambié «X»» de MaKo (los `cambiadas` de la ruta) tiene que cambiar algo que SE VE en esa tarjeta. Medido
  // el 22/10: un `cambiar` sin cambios reales (o sólo de la flecha) daba «Cambié» porque `parcheMensaje` borra un
  // `preheader: null` (lib/flujo-ia.ts, `delete q.preheader`) y `contenido` ya no es igual.
  ok("cada «Cambié» cambió algo que se ve", x.fantasmas.length === 0, x.fantasmas.length ? `dijo «Cambié» de: «${x.fantasmas.map((y) => y.slice(0, 60)).join("» · «")}» y se ve igual` : "ninguno de más");
  if (e.filaNueva) ok('nació otra automatización', x.filasNuevas.length > 0, x.filasNuevas.map((n) => `#${n}`).join(', ') || 'ninguna');
  if (e.abiertaSinCambio && x.abiertaDespues) ok('la abierta no cambió', JSON.stringify(lienzoDe(x.abiertaAntes.fila)) === JSON.stringify(lienzoDe(x.abiertaDespues.fila)), JSON.stringify(lienzoDe(x.abiertaAntes.fila)) === JSON.stringify(lienzoDe(x.abiertaDespues.fila)) ? 'igual' : 'cambió');
  // Siempre: no saluda en cada mensaje, y no dice que hizo algo si el lienzo y el CRON quedaron iguales.
  ok('no saluda', !x.textosMako.some((t) => /^\s*¡?\s*(hola|buen[oa]s)\b/i.test(t)), x.textosMako.find((t) => /^\s*¡?\s*(hola|buen[oa]s)\b/i.test(t))?.slice(0, 40) ?? 'no');
  // «Igual» como lo ve la persona: las mismas tarjetas, con los mismos textos y esperas, en el mismo orden (el JSON puede
  // cambiar sin que cambie nada visible: un `orden` renumerado, una flecha reescrita igual).
  const vista = (s: Estado) => JSON.stringify(s.tarjetas.map(linea));
  const igual = vista(x.antes) === vista(x.despues) && JSON.stringify(x.antes.disparadores) === JSON.stringify(x.despues.disparadores) && !x.filasNuevas.length;
  // ⚠️ Sin `\b` al final: en JS `\b` no ve la «é» como letra y «Cambié» no daba nunca.
  const dijo = x.textosMako.find((t) => /(?<![a-záéíóúñ])(agregu[eé]|cambi[eé]|quit[eé]|saqu[eé]|cre[eé]|mov[ií]|puse|listo|hecho)(?![a-záéíóúñ])/i.test(t) && !/\?\s*$/.test(t.trim()));
  if (igual && dijo) ok('no dice «hecho» sin hacerlo', false, `dijo «${dijo.slice(0, 80)}» y nada cambió`);
  return out;
}

// ── El CRM de prueba ────────────────────────────────────────────────────────────────
type CrmPrueba = { funnelId: number; productoId: number | null; etapas: Map<string, string> };
async function crmDePrueba(): Promise<CrmPrueba> {
  return enWs(WS, async () => {
    const buscar = async () => (await productosConEtapas()).find((p: { nombre: string }) => p.nombre === CRM_NOMBRE) as { funnelId: number; productoId: number | null; etapas: Array<{ value: string; label: string }> } | undefined;
    let p = await buscar();
    if (!p) {
      const { siembraDeCrm } = await import('../../lib/pipeline');
      const { crearCrm } = await import('../../lib/nuevo-crm');
      const s = siembraDeCrm({ tipo: 'linkedin' });
      if ('error' in s) throw new Error(s.error);
      const r = await crearCrm(CRM_NOMBRE, s);
      console.log(`  CRM de prueba creado: funnel #${r.funnelId}, producto #${r.productoId}`);
      p = await buscar();
      if (!p) throw new Error('Creé el CRM de prueba y no lo veo en productosConEtapas');
    }
    return { funnelId: p.funnelId, productoId: p.productoId, etapas: new Map(p.etapas.map((e) => [norm(e.label), e.value])) };
  });
}
/**
 * Crea una etapa en el CRM de prueba, como el «agregar» de `editarEtapaAction` (app/crm/actions.ts): la clave `stN`
 * libre, después de la entrada, con color, y `saveFunnelDe`. ⚠️ La acción no se puede importar fuera de Next (arrastra
 * `next/navigation`, que con `--conditions=react-server` tira «createContext is not a function»): esto es la preparación
 * del caso, no lo que se prueba. `recrear`: si ya está (de otra corrida), la saca antes, para que sea «recién creada».
 */
async function crearEtapa(crm: CrmPrueba, label: string, recrear: boolean): Promise<string> {
  return enWs(WS, async () => {
    const { getFunnelDe, saveFunnelDe } = await import('../../lib/funnels');
    const { colorParaNueva, conTerminales } = await import('../../lib/pipeline');
    const ya = crm.etapas.get(norm(label));
    if (ya && !recrear) return ya;
    const actual = await getFunnelDe(crm.funnelId);
    if ((actual as { origen?: string }).origen === 'error') throw new Error('No pude leer el embudo de prueba');
    let pipeline = (actual.pipeline as Array<{ key: string; label: string; kind?: string }>).filter((st) => !ya || st.key !== ya);
    let n = 0;
    let key = 'st0';
    while (pipeline.some((st) => st.key === key)) { n += 1; key = `st${n}`; }
    const iEntrada = pipeline.findIndex((st) => st.kind === 'entrada');
    const at = Math.max(iEntrada + 1, 1);
    const nueva = { key, label, ...colorParaNueva(pipeline as never, at), kind: 'paso' };
    pipeline = [...pipeline.slice(0, at), nueva, ...pipeline.slice(at)];
    await saveFunnelDe(crm.funnelId, conTerminales(pipeline as never), actual.suppressed, { labels: (actual as { labels?: unknown }).labels });
    const p = ((await productosConEtapas()) as unknown as Array<{ funnelId: number | null; etapas: Array<{ value: string; label: string }> }>).find((x) => x.funnelId === crm.funnelId)!;
    crm.etapas = new Map(p.etapas.map((e) => [norm(e.label), e.value]));
    const quedo = crm.etapas.get(norm(label));
    if (!quedo) throw new Error(`La etapa «${label}» no quedó en el CRM de prueba`);
    return quedo;
  });
}

// ── Las puertas de la pantalla ─────────────────────────────────────────────────────────
async function postSec(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const r = await leerRespuesta(await llamar(WS, rutaSec.POST as never, { url: '/api/chat-agent/secuencias', body }), Date.now());
  return (r.json ?? { ok: false, error: `status ${r.status}` }) as Record<string, unknown>;
}
async function crearVacia(nombre: string): Promise<number> {
  const j = await postSec({ action: 'crear_vacia', nombre });
  if (!j.ok || !(Number(j.secuenciaId) > 0)) throw new Error(`crear_vacia: ${String(j.error)}`);
  return Number(j.secuenciaId);
}
async function estadoDe(id: number): Promise<Estado> {
  const fila = await leerFila(id);
  if (!fila) throw new Error(`#${id} no existe`);
  const tarjetas = recorrido(lienzoDe(fila));
  return { secId: id, fila, tarjetas, mensajes: tarjetas.filter((t) => t.clase === 'mensaje').map((t) => ({ textos: t.textos, audio: t.audio })), disparadores: fila.disparadores ?? [] };
}

/** Lo que tiene la pantalla abierta: una automatización, su lienzo local, su hilo y la pregunta abierta. */
type Abierta = { secId: number; nombre: string; pasos: PasoGrafo[]; publicadas: number; mensajes: Mensaje[]; ronda: Ronda | null };
async function abrir(id: number): Promise<Abierta> {
  const f = (await leerFila(id))!;
  const chat = await enWs(WS, () => leerChat(WS, id));
  return { secId: id, nombre: f.nombre, pasos: lienzoDe(f), publicadas: Array.isArray(f.pasos) ? f.pasos.length : 0, mensajes: chat.mensajes as Mensaje[], ronda: fic.rondaAbierta(chat.mensajes as never) as Ronda | null };
}

type RegistroTurno = {
  dice: string; via: string; ms: number; msPedidos?: number; primeraFaseMs: number | null; modo?: string; fases: string[]; final: string; texto: string;
  pregunta?: string; opciones?: string[]; burbujas?: string[]; ia: string[]; antes: string[]; despues: string[];
};

/** UN turno de MaKo (`turno` de ChatMako.tsx): el POST a la ruta y lo que hace la pantalla con el resultado. */
async function turnoMako(a: Abierta, dicho: string, respuesta: unknown | null, pedido: string | undefined, reg: RegistroTurno, x: Ctx): Promise<void> {
  const crea = a.pasos.length === 0 && !a.publicadas;
  const enCurso = respuesta && a.ronda ? { pedido: a.ronda.pedido, respuestas: [...a.ronda.respuestas, respuesta] } : { pedido: pedido ?? dicho, respuestas: [] as unknown[] };
  const yo: Mensaje = { id: nuevoId('yo'), de: 'yo', texto: dicho, at: new Date().toISOString(), via: 'app', ...(respuesta ? { respuesta } : {}) };
  const modo = crea ? 'crear' : 'editar';
  const base = modo === 'editar' ? a.pasos : undefined;
  // Desde el 22/10/2026 (bbbfe38ff) la pantalla manda «Discutir» o «Editar» al editar (ChatMako.tsx: `...(modo === 'editar'
  // ? { intencion } : {})`) y arranca en Editar. Sin `--intencion`, lo de la pantalla; `--intencion=ninguna` mide la ruta
  // sin elegir (lo de antes de bbbfe38ff: la base de 43b0c2625 y la verificación de be4b9189a se corrieron así).
  const body = cuerpoIA({ pedido: enCurso.pedido, modo, respuestas: enCurso.respuestas as never, secuenciaId: a.secId, ...(base ? { pasos: base as never } : {}), historial: a.mensajes as never, ...(modo === 'editar' && INTENCION ? { intencion: INTENCION } : {}) } as never);
  reg.modo = modo;
  const t0 = Date.now();
  const r = await leerRespuesta(await llamar(WS, ia.POST as never, { url: '/api/chat-agent/secuencias/ia', body }), t0);
  reg.ms = Date.now() - t0;
  const fases = r.eventos.filter((e: EventoConHora) => e.ev.t === 'fase');
  reg.primeraFaseMs = fases[0]?.ms ?? null;
  reg.fases = fases.map((e: EventoConHora) => `${String(e.ev.fase)}@${(e.ms / 1000).toFixed(1)}s${e.ev.intento ? `#${String(e.ev.intento)}` : ''}`);
  if (!r.eventos.length) {
    const j = (r.json ?? {}) as { error?: string };
    reg.final = `error ${r.status}`; reg.texto = j.error ?? '(sin cuerpo)'; x.errores.push(reg.texto);
    return;
  }
  const fin = r.eventos[r.eventos.length - 1].ev;
  reg.final = String(fin.t);
  if (fin.t === 'error') { reg.texto = String(fin.error); x.errores.push(reg.texto); return; }
  a.mensajes = [...a.mensajes, yo];
  if (fin.t === 'pregunta') {
    const p = fin.pregunta as Pregunta;
    reg.texto = String((fin.mensaje as { texto?: string } | undefined)?.texto ?? p.texto);
    reg.pregunta = p.texto; reg.opciones = p.opciones.map((o) => o.label);
    x.preguntas.push(p); x.textosMako.push(reg.texto);
    a.mensajes = [...a.mensajes, fin.mensaje as Mensaje];
    a.ronda = { ...enCurso, pregunta: p };
    return;
  }
  if (fin.t !== 'listo') { reg.texto = `(terminó en ${String(fin.t)})`; x.errores.push(reg.texto); return; }
  const l = fin as Record<string, unknown> & { modo: string; pasos: PasoGrafo[]; orden: string[]; resumen?: string; texto?: string; nombre?: string; disparadores?: unknown[]; pregunta?: Pregunta; etiquetasNuevas: Array<{ id: number; nombre: string }>; avisos?: string[]; cambiadas?: string[]; quitadas?: string[] };
  x.etiquetasNuevas.push(...(l.etiquetasNuevas ?? []));
  if (l.modo === 'crear') {
    a.pasos = l.pasos; a.publicadas = l.pasos.length;
    if (l.nombre) { a.nombre = l.nombre; x.nombresMako.set(a.secId, l.nombre); }
  } else {
    // Lo que la ruta dice que CAMBIÓ, contra cómo se ve la tarjeta antes y después (el juez: «cada «Cambié» cambió algo que se ve»).
    const seVe = (ps: PasoGrafo[] | undefined, id: string): string | null => { const p = (ps ?? []).find((q) => String(q.id) === id); return p ? linea(tarjeta(ps!, p)) : null; };
    for (const id of l.cambiadas ?? []) { const v = seVe(base, id); if (v != null && v === seVe(l.pasos, id)) x.fantasmas.push(v); }
    if (fic.edicionTocaPasos(l as never)) {
      if (!fic.edicionVigente(base as never, a.pasos as never)) { reg.texto = 'Cambiaste el flujo: pídelo de nuevo'; x.errores.push(reg.texto); return; }
      a.pasos = l.pasos;
      // El borrador a la base, como useBorradorSecuencia (con la huella de lo publicado que abrió la pestaña).
      const f = (await leerFila(a.secId))!;
      const g = await postSec({ action: 'borrador', secuenciaId: a.secId, pasos: a.pasos, base: firmaPublicado(f.pasos) });
      if (!g.ok) x.errores.push(`(arnés) no se guardó el borrador: ${String(g.error ?? JSON.stringify(g))}`);
    }
    if (Array.isArray(l.disparadores) && l.disparadores.length) {
      const g = await postSec({ action: 'disparadores', secuenciaId: a.secId, disparadores: l.disparadores });
      if (!g.ok) x.errores.push(`(pantalla) el CRON que pidió MaKo no se guardó: ${String(g.error)}`);
    }
  }
  a.ronda = l.pregunta ? { pedido: enCurso.pedido, respuestas: [], pregunta: l.pregunta } : null;
  const texto = l.modo === 'crear' ? (l.texto ?? `Creé «${l.nombre}»`) : textoDeListo(l as never);
  reg.texto = [texto, ...(l.avisos?.length ? [`avisos: ${l.avisos.join(' · ')}`] : [])].join(' — ');
  if (l.pregunta) { reg.pregunta = l.pregunta.texto; reg.opciones = l.pregunta.opciones.map((o) => o.label); x.preguntas.push(l.pregunta); }
  // Los avisos se ven debajo del mensaje: cuentan como lo que dijo MaKo.
  x.textosMako.push([texto, ...(l.avisos ?? [])].join(' · '));
  a.mensajes = [...a.mensajes, { id: nuevoId('mako'), de: 'mako', texto, at: new Date().toISOString(), via: 'app', ...(l.avisos?.length ? { avisos: l.avisos } : {}), ...(l.pregunta ? { pregunta: l.pregunta } : {}) }];
}

type Ctx = { fantasmas: string[]; errores: string[]; preguntas: Pregunta[]; textosMako: string[]; etiquetasNuevas: Array<{ id: number; nombre: string }>; filasNuevas: number[]; nombresMako: Map<number, string>; burbujas: Array<Record<string, unknown>> };

/** ➤ con un texto (`enviarTexto` de ChatMako.tsx): la pregunta abierta, los pedidos sueltos, y MaKo. */
async function enviarTexto(a: Abierta, t: string, reg: RegistroTurno, x: Ctx): Promise<void> {
  if (a.ronda) {
    const r = fic.respuestaMako(a.ronda.pregunta as never, { texto: t });
    reg.via = 'respuesta («Otra cosa»)';
    return turnoMako(a, r.texto, r.respuesta, undefined, reg, x);
  }
  const crea = a.pasos.length === 0 && !a.publicadas;
  const tP = Date.now();
  const crudo = await Promise.race([
    leerRespuesta(await llamar(WS, rutaPedidos.POST as never, { url: '/api/mako/pedidos', body: pc.cuerpoPedidos(t, a.secId, a.nombre ?? '') }), tP).then((r: { json: unknown }) => r.json),
    new Promise<null>((res) => setTimeout(() => res(null), 12_000)),
  ]);
  const msPedidos = Date.now() - tP;
  reg.msPedidos = msPedidos;
  const leida = pc.interpretacionDe(crudo, t);
  const i = crea ? pc.paraLienzoVacio(leida, t) : leida;
  const nuevas = pc.burbujasDe(i, a.secId) as Array<Record<string, unknown>>;
  const actual = pc.textoActual(i);
  reg.via = `pedidos (${(msPedidos / 1000).toFixed(1)} s, ${String((crudo as { origen?: string } | null)?.origen ?? 'sin respuesta')})`;
  if (nuevas.length) { reg.burbujas = nuevas.map((b) => `${String(b.tipo)}${b.pedido ? `: ${String(b.pedido).slice(0, 80)}` : ''}`); x.burbujas.push(...nuevas); }
  if (!nuevas.length) return turnoMako(a, t, null, actual ?? undefined, reg, x);
  if (!actual) { reg.final = 'burbujas'; reg.texto = '(MaKo no trabaja: sólo burbujas)'; return; }
  return turnoMako(a, t, null, actual, reg, x);
}

// ── Una corrida ───────────────────────────────────────────────────────────────────────
type Resultado = {
  id: string; titulo: string; pedido: string; esperado: string; obtenido: string; veredicto: 'pasa' | 'falla' | 'no-corrio'; evidencia: string;
  segundos: number | null; segundosPorTurno: number[]; lentos: boolean; secuencias: number[]; chequeos: Chequeo[]; turnos: RegistroTurno[]; tarjetasFinal: string[];
};
const creados: { secuencias: number[]; crm: string | null; etapas: string[]; etiquetas: string[] } = { secuencias: [], crm: null, etapas: [], etiquetas: [] };

async function correrCaso(c: Caso, crm: CrmPrueba): Promise<Resultado> {
  const x: Ctx = { fantasmas: [], errores: [], preguntas: [], textosMako: [], etiquetasNuevas: [], filasNuevas: [], nombresMako: new Map(), burbujas: [] };
  const turnos: RegistroTurno[] = [];
  const pedidoTexto = c.turnos.map((t) => ('dice' in t ? (Array.isArray(t.dice) ? t.dice.join('\n') : t.dice) : 'elegir' in t ? `[elige «${t.elegir}»]` : `[toca «${t.pulsar}»]`)).join(' ⏎ ');
  const base: Omit<Resultado, 'veredicto' | 'obtenido' | 'evidencia' | 'chequeos' | 'tarjetasFinal'> = {
    id: c.id, titulo: c.titulo, pedido: pedidoTexto.length > 400 ? `${pedidoTexto.slice(0, 380)}… (${pedidoTexto.length} caracteres)` : pedidoTexto,
    esperado: c.juicio, segundos: null, segundosPorTurno: [], lentos: false, secuencias: [], turnos,
  };
  try {
    for (const a of c.antes ?? []) {
      const key = await crearEtapa(crm, a.crearEtapa, !!a.recrear);
      creados.etapas.push(`${a.crearEtapa} (${key})`);
    }
    // La fila (la de «Lienzo en blanco») y su lienzo de partida.
    const id = await crearVacia(`${PREFIJO} · ${c.id}`);
    creados.secuencias.push(id); base.secuencias.push(id);
    if (c.partida !== 'vacia') {
      const pasos = definicion.partidas[c.partida];
      if (!pasos) throw new Error(`No hay partida «${c.partida}»`);
      await enWs(WS, () => setSecuenciaPasos(id, JSON.parse(JSON.stringify(pasos)) as never));
    }
    if (c.disparador) {
      const key = crm.etapas.get(norm(c.disparador.etapa)) ?? c.disparador.etapa;
      const lista = disparadorDeValorIA(`venta:${crm.funnelId}:${key}`);
      if (!lista.length) throw new Error(`No armo el CRON de «${c.disparador.etapa}»`);
      const g = await postSec({ action: 'disparadores', secuenciaId: id, disparadores: lista });
      if (!g.ok) throw new Error(`No guardé el CRON de partida: ${String(g.error)}`);
    }
    const abiertaAntes = await estadoDe(id);
    let a = await abrir(id);
    let estadoAntes = abiertaAntes;

    for (const t of c.turnos) {
      if ('soloSiPregunta' in t && t.soloSiPregunta && !a.ronda) continue;
      const reg: RegistroTurno = { dice: '', via: '', ms: 0, primeraFaseMs: null, fases: [], final: '', texto: '', ia: [], antes: (await estadoDe(a.secId)).tarjetas.map(linea), despues: [] };
      const desde = new Date(Date.now() - 2000).toISOString();
      if ('pulsar' in t) {
        reg.dice = `[toca «${t.pulsar}»]`;
        const b = x.burbujas.find((y) => y.tipo === 'crear');
        if (!b) { reg.final = 'sin burbuja'; reg.texto = 'No hubo burbuja de «crear» para tocar'; x.errores.push(reg.texto); turnos.push(reg); continue; }
        const r = pc.pulsar(b as never, t.pulsar as never, a.secId, { trabajando: false }) as { efecto: { tipo: string; pedido?: string } | null };
        if (r.efecto?.tipo !== 'crear' || !r.efecto.pedido) { reg.final = 'sin efecto'; reg.texto = `«${t.pulsar}» no creó nada (${JSON.stringify(r.efecto)})`; x.errores.push(reg.texto); turnos.push(reg); continue; }
        // `onCrearOtra` = `crearNueva(pedido)` (ChatAgentApp.tsx): la fila nace YA y su lienzo abre con el pedido puesto.
        const nueva = await crearVacia(`${PREFIJO} · ${c.id} · otra`);
        creados.secuencias.push(nueva); base.secuencias.push(nueva); x.filasNuevas.push(nueva);
        a = await abrir(nueva);
        estadoAntes = await estadoDe(nueva);
        reg.via = 'crear otra → pedido inicial';
        await turnoMako(a, r.efecto.pedido, null, undefined, reg, x);
      } else if ('elegir' in t) {
        reg.dice = `[elige «${t.elegir}»]`;
        if (!a.ronda) { reg.final = 'sin pregunta'; reg.texto = 'No había pregunta para elegir'; turnos.push(reg); continue; }
        const op = t.elegir === 'Elige tú' ? null : a.ronda.pregunta.opciones.find((o) => contiene(o.label, t.elegir));
        const eleccion = t.elegir === 'Elige tú' ? { eligeTu: true as const } : op ? { valor: op.valor } : { texto: t.elegir };
        const r = fic.respuestaMako(a.ronda.pregunta as never, eleccion as never);
        reg.via = op ? `botón «${op.label}»` : t.elegir === 'Elige tú' ? 'Elige tú' : `«Otra cosa» (no había un botón «${t.elegir}»: ${a.ronda.pregunta.opciones.map((o) => o.label).join(' / ')})`;
        await turnoMako(a, r.texto, r.respuesta, undefined, reg, x);
      } else {
        const texto = Array.isArray(t.dice) ? t.dice.join('\n') : t.dice;
        reg.dice = texto.length > 300 ? `${texto.slice(0, 280)}… (${texto.length} caracteres)` : texto;
        if (t.origen === 'afuera') { reg.via = 'pedido inicial (modal)'; await turnoMako(a, texto, null, undefined, reg, x); }
        else await enviarTexto(a, texto, reg, x);
      }
      reg.ia = await usoDesde(desde);
      reg.despues = (await estadoDe(a.secId)).tarjetas.map(linea);
      turnos.push(reg);
      const total = (reg.ms + (reg.msPedidos ?? 0)) / 1000;
      console.log(`    · ${reg.dice.slice(0, 70).replace(/\n/g, ' ')} → ${reg.final} en ${total.toFixed(1)} s${reg.msPedidos ? ` (pedidos ${(reg.msPedidos / 1000).toFixed(1)} s)` : ''}: ${reg.texto.slice(0, 160).replace(/\n/g, ' ')}`);
    }

    const despues = await estadoDe(a.secId);
    const abiertaDespues = a.secId !== id ? await estadoDe(id) : despues;
    // El nombre que puso MaKo, con el prefijo (crear lo pisa: `renombrar`).
    for (const sid of base.secuencias) {
      const f = await leerFila(sid);
      if (f && !f.nombre.startsWith(PREFIJO)) await postSec({ action: 'nombre', secuenciaId: sid, nombre: `${PREFIJO} · ${c.id} · ${f.nombre}`.slice(0, 120) });
      if (f?.activa) x.errores.push(`(!) #${sid} quedó ACTIVA`);
    }
    creados.etiquetas.push(...x.etiquetasNuevas.map((e) => `#${e.id} ${e.nombre}`));
    const chequeos = juzgar(c, { antes: estadoAntes, despues, abiertaAntes, abiertaDespues, textosMako: x.textosMako, preguntas: x.preguntas, errores: x.errores, etiquetasNuevas: x.etiquetasNuevas, etapas: crm.etapas, filasNuevas: x.filasNuevas, fantasmas: x.fantasmas });
    const fallan = chequeos.filter((k) => !k.ok);
    // ⚠️ SIN IA NO SE MIDE EL CHAT (22/10/2026, la verificación contra 87365c830): con Gemini sin cuota del día y Groq en su
    // tope de tokens por día, la ruta contesta «No tienes ninguna IA gratis conectada» (lib/flujo-ia.ts, `falloDeIA`) y el
    // caso salía «falla» por algo que no es del chat. Es «no-corrio» (cuota de IA): se vuelve a correr cuando haya cuota.
    const sinIA = x.errores.find((e) => RX_SIN_IA.test(e));
    // Lo que espera la persona: los pedidos sueltos (antes de MaKo) + MaKo.
    const segs = turnos.filter((t) => t.ms || t.msPedidos).map((t) => Math.round(((t.ms ?? 0) + (t.msPedidos ?? 0)) / 100) / 10);
    const tarjetasFinal = despues.tarjetas.map(linea);
    return {
      ...base, segundos: segs.length ? Math.round(segs.reduce((s, n) => s + n, 0) * 10) / 10 : null, segundosPorTurno: segs, lentos: segs.some((s) => s > SEGUNDOS_HALLAZGO),
      chequeos, tarjetasFinal,
      veredicto: sinIA ? 'no-corrio' : fallan.length ? 'falla' : 'pasa',
      obtenido: [...turnos.map((t) => `MaKo (${t.final}, ${((t.ms + (t.msPedidos ?? 0)) / 1000).toFixed(1)} s): ${t.texto.slice(0, 300)}`), `Lienzo: ${tarjetasFinal.join(' → ') || '(vacío)'}`].join(' ‖ '),
      evidencia: sinIA ? `Cuota de IA, no el chat: «${sinIA.slice(0, 120)}». ${fallan.map((k) => `✗ ${k.que}`).join(' | ')}` : fallan.length ? fallan.map((k) => `✗ ${k.que}: ${k.detalle}`).join(' | ') : chequeos.map((k) => `✓ ${k.que}`).join(' | '),
    };
  } catch (e) {
    return { ...base, veredicto: 'no-corrio', obtenido: '', evidencia: `El arnés no pudo: ${(e as Error).stack?.split('\n').slice(0, 3).join(' ') ?? String(e)}`, chequeos: [], tarjetasFinal: [] };
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────────────
console.log(`probar-chats/automations · ws ${WS} · sha ${SHA.slice(0, 9)} · intención ${INTENCION ?? 'ninguna'} · ${casos.length} casos · salida ${SALIDA}`);
const crm = await crmDePrueba();
creados.crm = `funnel #${crm.funnelId} (producto #${crm.productoId}) «${CRM_NOMBRE}»`;
console.log(`  CRM de prueba: ${creados.crm} · etapas: ${[...crm.etapas.entries()].map(([l, k]) => `${l}=${k}`).join(', ')}`);
const resultados: Resultado[] = [];
mkdirSync(dirname(SALIDA), { recursive: true });
const guardar = () => writeFileSync(SALIDA, JSON.stringify({ sha: SHA, ws: WS, intencion: INTENCION ?? 'ninguna', fecha: new Date().toISOString(), creados, resultados }, null, 2));
for (const c of casos) {
  console.log(`\n▶ ${c.id} — ${c.titulo}`);
  const r = await correrCaso(c, crm);
  resultados.push(r);
  console.log(`  ${r.veredicto.toUpperCase()}${r.lentos ? ' (LENTO)' : ''} · ${r.evidencia.slice(0, 400)}`);
  guardar();
}
const n = (v: string) => resultados.filter((r) => r.veredicto === v).length;
console.log(`\nTotal: ${n('pasa')} pasan · ${n('falla')} fallan · ${n('no-corrio')} no corrieron · lentos (> ${SEGUNDOS_HALLAZGO} s): ${resultados.filter((r) => r.lentos).length}`);
console.log(`Creado en el ws${WS}: secuencias ${creados.secuencias.map((s) => `#${s}`).join(', ')} · ${creados.crm} · etapas: ${creados.etapas.join(', ') || '-'} · etiquetas: ${creados.etiquetas.join(', ') || '-'}`);
console.log(`Resultado: ${SALIDA}`);
process.exit(0);
