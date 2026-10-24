// =============================================================================
// medir-289 — la #289 «Sprint · apertura» (ws1): ¿el goteo es el configurado y «Contestó» corta? SOLO LECTURA.
// =============================================================================
// Uso (desde C:/dev/wt-aut-sab24):
//   node --env-file=C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing/.env.local \
//        --conditions=react-server --import tsx scripts/_sab24/medir-289.mts [--desde=ISO] [--hasta=ISO] [--sec=289] [--ws=1]
// Por defecto --desde = HOY 00:00 de Tijuana (la zona del negocio) y --hasta = ahora.
// La primera hora del sábado 24/10 en la zona del negocio (09:00-10:00 Tijuana = 13:00-14:00 ART):
//   ... medir-289.mts --desde=2026-10-24T16:00:00Z --hasta=2026-10-24T17:00:00Z
//
// Lee la base de PRODUCCIÓN y no escribe NADA (sólo select). No imprime teléfonos ni claves.
//
// Qué mide, con las MISMAS fuentes que el motor:
//   · EL GOTEO es por AUTOMATIZACIÓN: `nutricion_envios` de esta secuencia, canal whatsapp, estado enviado|borrador, por su
//     `created_at` (lib/goteo.ts ESTADOS_DEL_GOTEO; lib/nutricion.ts usoDelGoteo). El `created_at` es cuando terminó de salir
//     el mensaje entero (las 3 partes de M1 con sus pausas): el motor cuenta los minutos desde ahí.
//   · LOS TOPES DE LA LÍNEA son por NEGOCIO (todas sus automatizaciones): `nutricion_envios` estado enviado canal whatsapp en
//     24 h móviles (enviosUltimas24h) y por hora de reloj UTC (enviosEnLaHora). Una campaña (lead que no entró ni agendó en
//     las últimas 24 h) usa el tope del día MENOS la reserva para lo que entra (lib/nutricion-prioridad.ts).
//     ⚠️ Cuentan ENVÍOS (filas), no mensajes: un M1 de 3 partes es UN envío y TRES WhatsApp. Y no cuentan lo que sale por la
//     misma línea a mano (el teléfono, el inbox): eso se mide aparte con `wa_mensajes` salientes, sección [4].
//   · «CONTESTÓ» = un mensaje ENTRANTE guardado en `wa_mensajes` (from_me=false, con lead_id = el del lead, tipo distinto de
//     'evento'/'otro', no de un grupo): su insert llama a pausarPorRespuesta (lib/evolution-mensajes.ts), que pasa la
//     inscripción 'activa' → 'respondio'; eso es lo único que el motor mira (`enRespuesta`, lib/nutricion.ts). La hora es el
//     `created_at` de esa fila (cuando el motor se enteró). Por diseño NO se corta el mensaje que ya estaba saliendo cuando
//     contestó (alguna de sus partes salió antes), ni el primero si todavía no le había SALIDO nada (yaLeSalioAlgo: enviado
//     o simulado; un borrador no cuenta), ni lo que cuelga de la rama «Contestó» (el aviso).
//   · VIOLACIÓN = un mensaje de esta automatización (enviado|borrador|simulado) a esa inscripción DESPUÉS de su primera
//     respuesta, fuera de esas excepciones. Y CORTE PERDIDO = contestó pero la inscripción sigue 'activa' (el motor no lo
//     ve): lo que tenga programado le va a salir; se dice qué y cuándo.
//   · REINICIADA = la inscripción se reactivó (lib/nutricion-reinscripcion.ts: `inscripto_at` vuelve a ahora y los envíos
//     viejos quedan con inscripcion_id null) o se borró y se volvió a crear: el lead ya había recibido mensajes de esta
//     automatización antes de su inscripción actual.
// Revisión del 24/10/2026 (refutación): las correcciones de esta versión están marcadas «(24/10)».
// =============================================================================

import { createClient } from '@supabase/supabase-js';
import { claseDe, indicePorId, idDe, type PasoGrafo } from '../../lib/flujo-grafo';
import { usaContesto, ramaDeQuienContesto } from '../../lib/nutricion-grafo-motor';
import { sanearConfigAutomatizacion, claveConfigAutomatizacion, horarioDeLaAutomatizacion, textoDeHorario } from '../../lib/config-automatizacion';
import { limitesVigentes, limitesDeFabrica, KEY_LIMITES_ENVIO } from '../../lib/limites-envio';
import { horarioVigente, dentroDelHorario, KEY_HORARIO_ENVIO, type HorarioEnvio } from '../../lib/horario-envio';
import { reservaParaEntradas } from '../../lib/nutricion-prioridad';
import { textoDeGoteo } from '../../lib/goteo';

// ── argumentos ───────────────────────────────────────────────────────────────────────────────────
const args = new Map(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const [k, ...v] = a.slice(2).split('=');
  return [k, v.join('=')] as const;
}));
const SEC = Number(args.get('sec') ?? 289);
const WS = Number(args.get('ws') ?? 1);
const TZ_ART = 'America/Argentina/Buenos_Aires';
const TZ_TIJ = 'America/Tijuana';
const AHORA = Date.now();

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// ── utilidades de hora ───────────────────────────────────────────────────────────────────────────
const FMT = new Map<string, Intl.DateTimeFormat>();
const fmtDe = (tz: string) => {
  let f = FMT.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', weekday: 'short' });
    FMT.set(tz, f);
  }
  return f;
};
function partes(ms: number, tz: string) {
  const p = fmtDe(tz).formatToParts(new Date(ms));
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return { y: g('year'), mo: g('month'), d: g('day'), h: g('hour'), mi: g('minute'), s: g('second'), wd: g('weekday') };
}
const DIA_ES: Record<string, string> = { Mon: 'lun', Tue: 'mar', Wed: 'mié', Thu: 'jue', Fri: 'vie', Sat: 'sáb', Sun: 'dom' };
const hora = (ms: number, tz: string) => { const p = partes(ms, tz); return `${DIA_ES[p.wd] ?? p.wd} ${p.d}/${p.mo} ${p.h}:${p.mi}:${p.s}`; };
const dosZonas = (ms: number) => `ART ${hora(ms, TZ_ART)} | TIJ ${hora(ms, TZ_TIJ)}`;
const fechaEn = (ms: number, tz: string) => { const p = partes(ms, tz); return `${p.y}-${p.mo}-${p.d}`; };
function offsetMs(ms: number, tz: string): number {
  const p = partes(ms, tz);
  return Date.UTC(+p.y, +p.mo - 1, +p.d, +p.h, +p.mi, +p.s) - Math.floor(ms / 1000) * 1000;
}
/** El instante UTC de las 00:00 de `fecha` (YYYY-MM-DD) en `tz`. */
function medianoche(fecha: string, tz: string): number {
  const [y, m, d] = fecha.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d);
  let t = guess - offsetMs(guess, tz);
  t = guess - offsetMs(t, tz); // por si el cambio de hora cae entre medio
  return t;
}
const mmss = (ms: number) => { const s = Math.round(ms / 1000); const sign = s < 0 ? '-' : ''; const a = Math.abs(s); return `${sign}${Math.floor(a / 60)}m${String(a % 60).padStart(2, '0')}s`; };

const desdeArg = args.get('desde');
const DESDE = desdeArg ? Date.parse(desdeArg) : medianoche(fechaEn(AHORA, TZ_TIJ), TZ_TIJ);
const HASTA = args.get('hasta') ? Date.parse(args.get('hasta')!) : AHORA;
if (!Number.isFinite(DESDE) || !Number.isFinite(HASTA) || !Number.isInteger(SEC) || !Number.isInteger(WS)) {
  console.error('Argumentos inválidos: --desde/--hasta tienen que ser fechas ISO, --sec y --ws enteros.');
  process.exit(2);
}
const iso = (ms: number) => new Date(ms).toISOString();

// ── lectura estricta (un error NO es «no hay») ─────────────────────────────────────────────────────
function falla(que: string, e: { message: string } | null | undefined): never {
  console.error(`ERROR leyendo ${que}: ${e?.message ?? 'sin detalle'}`);
  process.exit(1);
}
async function todo<T>(que: string, armar: (desde: number, hasta: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < 200; i++) {
    const { data, error } = await armar(i * 1000, i * 1000 + 999);
    if (error) falla(que, error);
    const filas = (data ?? []) as T[];
    out.push(...filas);
    if (filas.length < 1000) return out;
  }
  return out;
}

// ── 1. la automatización, su configuración y la línea ──────────────────────────────────────────────
const { data: secRow, error: eSec } = await db.from('nutricion_secuencias')
  .select('id, nombre, activa, archivada_at, trigger_tipo, etapa, etapas, funnel_id, disparadores, reentrada, created_at, updated_at, workspace_id, pasos')
  .eq('id', SEC).maybeSingle();
if (eSec) falla('nutricion_secuencias', eSec);
if (!secRow) { console.error(`No existe la secuencia ${SEC}.`); process.exit(1); }
const sec = secRow as { id: number; nombre: string; activa: boolean; archivada_at: string | null; trigger_tipo: string; etapa: string | null; etapas: string[] | null; funnel_id: number | null; disparadores: unknown; reentrada: string | null; created_at: string; updated_at: string; workspace_id: number; pasos: PasoGrafo[] };
if (sec.workspace_id !== WS) { console.error(`La secuencia ${SEC} es del ws${sec.workspace_id}, no del ws${WS}.`); process.exit(1); }
const pasos: PasoGrafo[] = Array.isArray(sec.pasos) ? sec.pasos : [];

const claves = [claveConfigAutomatizacion(SEC), KEY_LIMITES_ENVIO, KEY_HORARIO_ENVIO, 'mako.timezone'];
const { data: setRows, error: eSet } = await db.from('app_settings').select('key, value, updated_at').eq('workspace_id', WS).in('key', claves);
if (eSet) falla('app_settings', eSet);
const setting = new Map(((setRows ?? []) as Array<{ key: string; value: unknown; updated_at: string | null }>).map((r) => [r.key, r]));
const cfgRow = setting.get(claveConfigAutomatizacion(SEC));
const cfg = sanearConfigAutomatizacion(cfgRow?.value ?? null);
const lim = limitesVigentes(setting.get(KEY_LIMITES_ENVIO)?.value ?? null, limitesDeFabrica(process.env));
const horarioNegocio = horarioVigente(setting.get(KEY_HORARIO_ENVIO)?.value ?? null);
const horario: HorarioEnvio | null = horarioDeLaAutomatizacion(cfg, horarioNegocio);
const tzRaw = setting.get('mako.timezone')?.value;
const tzNegocio = typeof tzRaw === 'string' ? tzRaw.replace(/^"|"$/g, '') : TZ_TIJ;
const goteo = cfg.goteo ?? null;
const reserva = reservaParaEntradas(lim.wa);
const campanaDia = lim.wa.dia - reserva.dia;
const campanaHora = lim.wa.hora - reserva.hora;
const cfgDesdeMs = cfgRow?.updated_at ? Date.parse(cfgRow.updated_at) : null;

// Las etiquetas de cada tarjeta, y cuántas PARTES (WhatsApp) tiene cada mensaje (24/10).
const etiqueta = new Map<string, string>();
const claseDeNodo = new Map<string, string>();
const partesDeNodo = new Map<string, number>();
let nMsg = 0;
pasos.forEach((p, i) => {
  const id = idDe(p, i);
  const c = claseDe(p);
  claseDeNodo.set(id, c);
  if (c === 'mensaje') {
    nMsg += 1;
    const ps = (p as { partes?: Array<{ cuerpo?: string }> }).partes;
    partesDeNodo.set(id, Array.isArray(ps) && ps.length ? ps.length : 1);
    const txt = String(ps?.[0]?.cuerpo ?? p.cuerpo ?? '').replace(/\s+/g, ' ');
    etiqueta.set(id, `M${nMsg} «${txt.slice(0, 28)}…»`);
  } else if (c === 'accion') etiqueta.set(id, `acción ${(p.accion as { operacion?: string } | null)?.operacion ?? '?'}`);
  else if (c === 'condicion') {
    const filas = (p.ramas ?? []).flatMap((r) => r.filas ?? []);
    const txt = filas.map((f) => f.campo === 'contesto' ? (f.no ? '«No contestó»' : '«Contestó»') : f.campo).join(' y ');
    etiqueta.set(id, `condición ${txt || '?'}`);
  } else if (c === 'esperar') etiqueta.set(id, `espera ${(p as { espera?: { minutos?: number } }).espera?.minutos ?? '?'} min`);
  else etiqueta.set(id, c);
});
const nombreNodo = (id: string | null | undefined, paso?: number | null): string => {
  if (id && etiqueta.has(id)) return `${id} ${etiqueta.get(id)}`;
  if (paso != null && pasos[paso - 1]) { const i = paso - 1; const nid = idDe(pasos[i], i); return `${nid} ${etiqueta.get(nid) ?? ''}`; }
  return id ?? `paso ${paso ?? '?'}`;
};
const ramaContesto = ramaDeQuienContesto(pasos);
// Lo que tarda en salir un envío desde que arranca el tick (medido el 23/10: la 1.ª parte ~16 s después del minuto, y ~10 s
// entre partes con pausa_s=5). Sirve para atribuir partes de wa_mensajes a un envío y para estimar cuándo sale el próximo (24/10).
const durEnvioMs = (nodo: string | null | undefined) => 10_000 * ((partesDeNodo.get(nodo ?? '') ?? 1) - 1);
const MARGEN_PARTES_MS = 15_000;

console.log('='.repeat(110));
console.log(`MEDICIÓN #${SEC} «${sec.nombre}» (ws${WS}) — SOLO LECTURA`);
console.log(`Ahora: ${dosZonas(AHORA)}   (UTC ${iso(AHORA)})`);
console.log(`Ventana: desde ${dosZonas(DESDE)} hasta ${dosZonas(HASTA)}`);
console.log('='.repeat(110));
console.log('\n[1] LA AUTOMATIZACIÓN Y SU CONFIGURACIÓN');
console.log(`  estado: ${sec.archivada_at ? `ARCHIVADA ${sec.archivada_at}` : sec.activa ? 'ACTIVA' : 'PAUSADA/BORRADOR (activa=false)'} · disparador ${sec.trigger_tipo} etapa ${sec.etapa ?? '—'} CRM #${sec.funnel_id ?? '—'} · reentrada ${sec.reentrada ?? '—'} · creada ${sec.created_at} · editada ${sec.updated_at}`);
console.log(`  disparadores: ${JSON.stringify(sec.disparadores)}`);
console.log(`  usa «Contestó»: ${usaContesto(pasos) ? 'sí' : 'NO (contestar no corta nada por su cuenta)'} · rama «Contestó»: ${[...ramaContesto].map((id) => nombreNodo(id)).join(', ') || '—'}`);
console.log(`  mensajes: ${[...partesDeNodo].map(([id, n]) => `${nombreNodo(id).slice(0, 30)} = ${n} parte(s)`).join(' · ')}`);
console.log(`  config propia (app_settings '${claveConfigAutomatizacion(SEC)}', editada ${cfgRow?.updated_at ?? 'nunca'}): ${cfgRow ? JSON.stringify(cfgRow.value) : '— (todo como el negocio)'}`);
console.log(`  goteo WhatsApp: ${textoDeGoteo(goteo)}  → cuenta por AUTOMATIZACIÓN (sólo los WhatsApp de la #${SEC})`);
console.log(`  horario que vale: ${textoDeHorario(horario)} (${cfg.horario !== undefined ? 'propio' : 'el del negocio'}) en zona ${tzNegocio}`);
console.log(`  línea del negocio ('${KEY_LIMITES_ENVIO}' = ${JSON.stringify(setting.get(KEY_LIMITES_ENVIO)?.value ?? null)}): ${lim.wa.dia} ENVÍOS/24 h y ${lim.wa.hora}/hora de reloj → cuenta TODAS las automatizaciones del ws${WS} (envíos, no partes; lo que se manda a mano por la misma línea no entra)`);
console.log(`  reserva para lo que entra: ${reserva.dia}/día y ${reserva.hora}/hora → una CAMPAÑA (lead que no entró ni agendó en 24 h) tiene ${campanaDia}/24 h y ${campanaHora}/hora`);
if (horario && goteo?.minutos) {
  const ventanaMin = (horario.hasta - horario.desde) * 60;
  const porHorario = Math.floor(ventanaMin / goteo.minutos) + 1;
  // (24/10) El ritmo REAL es un minuto más: el reloj del goteo corre desde que terminó de salir el envío y el tick es por minuto.
  const real = goteo.minutos + 1;
  const porHorarioReal = Math.floor(ventanaMin / real) + 1;
  console.log(`  techo teórico por día: min(goteo/día ${goteo.dia ?? '∞'}, campaña ${campanaDia}, horario ${ventanaMin} min ÷ ${goteo.minutos} ≈ ${porHorario}) = ${Math.min(goteo.dia ?? Infinity, campanaDia, porHorario)}`
    + ` · con el ritmo real (~${real} min: tick por minuto) ≈ ${Math.min(goteo.dia ?? Infinity, campanaDia, porHorarioReal)}`);
}

// ── 2. los envíos ────────────────────────────────────────────────────────────────────────────────────
type Envio = { id: number; inscripcion_id: number | null; lead_id: number; paso: number | null; nodo_id: string | null; canal: string; estado: string; created_at: string; error: string | null; ms: number };
const desde24 = Math.min(DESDE, HASTA) - 24 * 3600e3;
const enviosSec = (await todo<Omit<Envio, 'ms'>>('nutricion_envios (la automatización)', (a, b) => db.from('nutricion_envios')
  .select('id, inscripcion_id, lead_id, paso, nodo_id, canal, estado, created_at, error').eq('secuencia_id', SEC).order('id').range(a, b)))
  .map((e) => ({ ...e, ms: Date.parse(e.created_at) })) as Envio[];
const enLaVentana = enviosSec.filter((e) => e.ms >= DESDE && e.ms <= HASTA);

const insRows = await todo<{ id: number; lead_id: number; estado: string; inscripto_at: string; proximo_envio_at: string | null; paso_actual: number; nodo_actual: string | null; hilos: unknown; desenlace: string | null; updated_at: string }>(
  'nutricion_inscripciones', (a, b) => db.from('nutricion_inscripciones')
    .select('id, lead_id, estado, inscripto_at, proximo_envio_at, paso_actual, nodo_actual, hilos, desenlace, updated_at').eq('secuencia_id', SEC).order('id').range(a, b));
const leadIds = [...new Set([...insRows.map((r) => r.lead_id), ...enviosSec.map((e) => e.lead_id)])];
const leads = leadIds.length ? await todo<{ id: number; nombre: string | null; telefono: string | null; telefono_normalizado: string | null }>('leads', (a, b) => db.from('leads')
  .select('id, nombre, telefono, telefono_normalizado').in('id', leadIds).order('id').range(a, b)) : [];
const L = new Map(leads.map((l) => [l.id, l]));
const quien = (id: number) => `#${id} ${String(L.get(id)?.nombre ?? '?').slice(0, 24)}`;

// (24/10) wa_mensajes de estos leads (entrantes Y salientes) desde ANTES del primer envío/inscripción: hacen falta para saber
// cuándo EMPEZÓ a salir cada envío (su primera parte), no sólo cuándo terminó (`created_at` de la fila).
const minInsc = insRows.length ? Math.min(...insRows.map((r) => Date.parse(r.inscripto_at))) : HASTA;
const desdeWa = Math.min(minInsc, enviosSec.length ? enviosSec[0].ms : HASTA, desde24) - 120_000;
type Wa = { id: number; lead_id: number; tipo: string | null; chat_jid: string | null; created_at: string; from_me: boolean; ms: number };
const entrantes: Wa[] = leadIds.length ? (await todo<Omit<Wa, 'ms'>>('wa_mensajes (de los leads)', (a, b) => db.from('wa_mensajes')
  .select('id, lead_id, tipo, chat_jid, created_at, from_me').in('lead_id', leadIds).gte('created_at', iso(desdeWa)).order('id').range(a, b)))
  .map((m) => ({ ...m, ms: Date.parse(m.created_at) })) : [];
const salientesDe = new Map<number, number[]>();
for (const m of entrantes) if (m.from_me) { const v = salientesDe.get(m.lead_id) ?? []; v.push(m.ms); salientesDe.set(m.lead_id, v); }
for (const v of salientesDe.values()) v.sort((a, b) => a - b);
/** (24/10) Cuándo EMPEZÓ a salir un envío: su primera parte saliente (wa_mensajes propio de ese lead) poco antes de la fila. */
const inicioDelEnvio = (e: Envio): number => {
  const v = salientesDe.get(e.lead_id) ?? [];
  const desde = e.ms - durEnvioMs(e.nodo_id) - MARGEN_PARTES_MS;
  const p = v.find((t) => t >= desde && t <= e.ms + 2_000);
  return p ?? e.ms;
};

console.log(`\n[2] ENVÍOS DE LA #${SEC} EN LA VENTANA (${enLaVentana.length})`);
if (!enLaVentana.length) console.log('  sin envíos todavía');
for (const e of enLaVentana) {
  // (24/10) inscripcion_id null NO es «una prueba sin inscripción»: es un envío de una inscripción que después se REACTIVÓ
  // (reactivarInscripcion lo desliga) o se borró (FK on delete set null).
  const huerfano = e.inscripcion_id == null ? ' (desligado: su inscripción se reinició o se borró)' : '';
  console.log(`  ${dosZonas(e.ms)}  ${quien(e.lead_id).padEnd(31)} ${nombreNodo(e.nodo_id, e.paso).slice(0, 50).padEnd(50)} ${e.canal.padEnd(8)} ${e.estado}${huerfano}${e.error ? ` — ${e.error.slice(0, 70)}` : ''}`);
}

// ── 3. el goteo ──────────────────────────────────────────────────────────────────────────────────────
const CUENTA_GOTEO = new Set(['enviado', 'borrador']);
const waGoteo = enviosSec.filter((e) => e.canal === 'whatsapp' && CUENTA_GOTEO.has(e.estado)).sort((x, y) => x.ms - y.ms);
console.log(`\n[3] GOTEO: intervalos entre WhatsApp consecutivos de la #${SEC} (enviado|borrador, por created_at) vs ${goteo?.minutos ?? '—'} min`);
const deLaVentana = waGoteo.filter((e) => e.ms >= DESDE && e.ms <= HASTA);
if (!deLaVentana.length) console.log('  sin envíos todavía');
else {
  let cortos = 0, cortosConCfgVieja = 0;
  const gaps: number[] = [];
  for (const e of deLaVentana) {
    const i = waGoteo.indexOf(e);
    const prev = i > 0 ? waGoteo[i - 1] : null;
    if (!prev) { console.log(`  ${dosZonas(e.ms)}  ${quien(e.lead_id).padEnd(31)} (primero: no hay uno anterior)`); continue; }
    const gap = e.ms - prev.ms;
    gaps.push(gap);
    const corto = goteo?.minutos != null && gap < goteo.minutos * 60_000;
    const vieja = cfgDesdeMs != null && e.ms < cfgDesdeMs;
    if (corto) { if (vieja) cortosConCfgVieja += 1; else cortos += 1; }
    console.log(`  ${dosZonas(e.ms)}  ${quien(e.lead_id).padEnd(31)} +${mmss(gap).padStart(8)} ${corto ? (vieja ? '← MÁS CORTO (antes del último cambio de config)' : '← MÁS CORTO QUE EL GOTEO') : ''}`);
  }
  const ord = [...gaps].sort((a, b) => a - b);
  // (24/10) El motor decide el horario cuando ARRANCA la corrida, no cuando termina de salir el envío: se mira la primera parte.
  // Un envío que empezó a las 20:59:50 y terminó a las 21:00:10 está bien.
  const fuera = deLaVentana.filter((e) => horario && !dentroDelHorario(inicioDelEnvio(e), tzNegocio, horario));
  const terminoAfuera = deLaVentana.filter((e) => horario && dentroDelHorario(inicioDelEnvio(e), tzNegocio, horario) && !dentroDelHorario(e.ms, tzNegocio, horario));
  console.log(`  → ${gaps.length} intervalos · más cortos que ${goteo?.minutos ?? '—'} min: ${cortos}${cortosConCfgVieja ? ` (+${cortosConCfgVieja} antes de que la config cambiara el ${cfgRow?.updated_at})` : ''}`
    + (ord.length ? ` · mínimo ${mmss(ord[0])} · mediana ${mmss(ord[Math.floor(ord.length / 2)])} · máximo ${mmss(ord[ord.length - 1])}` : ''));
  console.log(`  → WhatsApp que EMPEZARON fuera del horario (${textoDeHorario(horario)}): ${fuera.length}${fuera.length ? ' ← ' + fuera.map((e) => `#${e.id} (${dosZonas(inicioDelEnvio(e))})`).join(', ') : ''}`
    + `${terminoAfuera.length ? ` · empezaron adentro y terminaron después del cierre (bien): ${terminoAfuera.length}` : ''}`);
}

// ── 4. por día contra el tope ────────────────────────────────────────────────────────────────────────
const lineaWa = (await todo<{ id: number; secuencia_id: number | null; estado: string; created_at: string }>('nutricion_envios (la línea)', (a, b) => db.from('nutricion_envios')
  .select('id, secuencia_id, estado, created_at').eq('workspace_id', WS).eq('canal', 'whatsapp').eq('estado', 'enviado')
  .gte('created_at', iso(desde24)).lte('created_at', iso(HASTA)).order('id').range(a, b))).map((e) => ({ ...e, ms: Date.parse(e.created_at) })).sort((x, y) => x.ms - y.ms);
console.log(`\n[4] POR DÍA CONTRA EL TOPE`);
if (!deLaVentana.length) console.log('  sin envíos todavía');
else {
  const porDia = (tz: string) => {
    const m = new Map<string, number>();
    for (const e of deLaVentana) { const k = fechaEn(e.ms, tz); m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m].map(([k, n]) => `${k}: ${n}`).join(' · ');
  };
  console.log(`  WhatsApp de la #${SEC} por día calendario — Tijuana: ${porDia(TZ_TIJ)} | ART: ${porDia(TZ_ART)}`);
  let max24 = 0, max24En = 0, maxLinea = 0, maxLineaEn = 0;
  for (const e of deLaVentana) {
    const n = waGoteo.filter((x) => x.ms > e.ms - 24 * 3600e3 && x.ms <= e.ms).length;
    if (n > max24) { max24 = n; max24En = e.ms; }
  }
  // (24/10) El máximo de la LÍNEA se mira en cada envío de la línea (de cualquier automatización), no sólo en los de la #289.
  for (const e of lineaWa.filter((x) => x.ms >= DESDE)) {
    const nl = lineaWa.filter((x) => x.ms > e.ms - 24 * 3600e3 && x.ms <= e.ms).length;
    if (nl > maxLinea) { maxLinea = nl; maxLineaEn = e.ms; }
  }
  // (24/10) El goteo/día es de la automatización; el de campaña (día − reserva) es de la LÍNEA: antes se comparaba la #289 sola contra los dos.
  console.log(`  máximo en 24 h móviles (como lo cuenta el motor) — #${SEC} (enviado|borrador): ${max24} (a las ${dosZonas(max24En)}) vs goteo ${goteo?.dia ?? '—'}/día ${goteo?.dia != null && max24 > goteo.dia ? '← PASÓ EL TOPE' : '(dentro)'}`);
  console.log(`                                                 — línea entera ws${WS} (enviado, todas las automatizaciones): ${maxLinea}${maxLinea ? ` (a las ${dosZonas(maxLineaEn)})` : ''} vs ${lim.wa.dia}/24 h ${maxLinea > lim.wa.dia ? '← PASÓ EL TOPE' : '(dentro)'} y vs campaña ${campanaDia}/24 h ${maxLinea > campanaDia ? '← pasó el de campaña (¿leads frescos?)' : '(dentro)'}`);
  const porHora = new Map<number, { linea: number; sec: number }>();
  for (const x of lineaWa.filter((x) => x.ms >= DESDE)) { const h = Math.floor(x.ms / 3600e3); const v = porHora.get(h) ?? { linea: 0, sec: 0 }; v.linea += 1; if (Number(x.secuencia_id) === SEC) v.sec += 1; porHora.set(h, v); }
  const horas = [...porHora].sort((a, b) => a[0] - b[0]);
  console.log(`  por hora de reloj (línea / #${SEC}) vs ${lim.wa.hora}/hora (campaña ${campanaHora}): ` + horas.map(([h, v]) => { const p = partes(h * 3600e3, TZ_ART); return `${p.d}/${p.mo} ${p.h}h ART=${v.linea}/${v.sec}${v.linea > lim.wa.hora ? '!' : v.linea > campanaHora ? '(>campaña)' : ''}`; }).join(' · '));
  const otras = new Map<string, number>();
  for (const x of lineaWa.filter((x) => x.ms > HASTA - 24 * 3600e3 && Number(x.secuencia_id) !== SEC)) otras.set(String(x.secuencia_id), (otras.get(String(x.secuencia_id)) ?? 0) + 1);
  console.log(`  otras automatizaciones en la línea (enviado), últimas 24 h hasta el corte: ${[...otras].map(([k, n]) => `#${k}=${n}`).join(' ') || 'ninguna'}`);
  // (24/10) LO QUE SALIÓ DE VERDAD POR WHATSAPP del ws en las 24 h hasta el corte: las partes salientes de wa_mensajes. El tope del
  // motor no ve las partes (un M1 son 3) ni lo que se manda a mano o desde el inbox por la misma línea.
  const sal = await todo<{ id: number; lead_id: number | null; instance_name: string | null; created_at: string }>('wa_mensajes (salientes del ws)', (a, b) => db.from('wa_mensajes')
    .select('id, lead_id, instance_name, created_at').eq('workspace_id', WS).eq('from_me', true)
    .gt('created_at', iso(HASTA - 24 * 3600e3)).lte('created_at', iso(HASTA)).order('id').range(a, b));
  const porInst = new Map<string, number>();
  for (const m of sal) porInst.set(String(m.instance_name), (porInst.get(String(m.instance_name)) ?? 0) + 1);
  const enviados24 = enviosSec.filter((e) => e.estado === 'enviado' && e.ms > HASTA - 24 * 3600e3 - 60_000 && e.ms <= HASTA);
  const deLaSec = sal.filter((m) => {
    const t = Date.parse(m.created_at);
    return enviados24.some((e) => e.lead_id === m.lead_id && t >= e.ms - durEnvioMs(e.nodo_id) - MARGEN_PARTES_MS && t <= e.ms + 2_000);
  }).length;
  console.log(`  partes que SALIERON por WhatsApp del ws${WS} en las 24 h hasta el corte (wa_mensajes propios): ${sal.length} (${[...porInst].map(([k, n]) => `${k}=${n}`).join(' ')}) · de la #${SEC}: ${deLaSec} (${enviados24.length} envíos) · el resto (${sal.length - deLaSec}) es a mano/inbox/otros y el tope del motor NO lo cuenta`);
}

// ── 5. la verificación del corte ─────────────────────────────────────────────────────────────────────
// Lo que el motor ve: lo de evolution-mensajes.ts (no de grupo, no propio, tipo distinto de evento/otro).
const vistoPorElMotor = (m: { from_me: boolean; tipo: string | null; chat_jid: string | null }) => !m.from_me && m.tipo !== 'evento' && m.tipo !== 'otro' && !String(m.chat_jid ?? '').endsWith('@g.us');
// Cruce por TELÉFONO: un entrante de su número guardado con OTRO lead (o sin lead) el motor no lo ve.
const ult10 = (t: string | null | undefined) => String(t ?? '').replace(/\D/g, '').slice(-10);
const telDe = new Map<string, number>();
for (const l of leads) for (const t of [l.telefono_normalizado, l.telefono]) { const k = ult10(t); if (k.length === 10) telDe.set(k, l.id); }
const porTel = telDe.size ? (await todo<{ id: number; lead_id: number | null; telefono: string | null; tipo: string | null; chat_jid: string | null; created_at: string; from_me: boolean }>('wa_mensajes (por teléfono)', (a, b) => db.from('wa_mensajes')
  .select('id, lead_id, telefono, tipo, chat_jid, created_at, from_me').eq('workspace_id', WS).eq('from_me', false).gte('created_at', iso(minInsc)).order('id').range(a, b)))
  .filter((m) => telDe.has(ult10(m.telefono)) && m.lead_id !== telDe.get(ult10(m.telefono)) && vistoPorElMotor(m)) : [];

/** Lo que le va a salir desde donde está, por el camino de «no contestó» (lo que el motor hace si no lo ve). */
function proximoMensaje(ins: { nodo_actual: string | null; paso_actual: number }): string | null {
  let idx = ins.nodo_actual ? indicePorId(pasos, ins.nodo_actual) : ins.paso_actual;
  for (let n = 0; n < 25 && idx >= 0 && idx < pasos.length; n++) {
    const p = pasos[idx];
    const c = claseDe(p);
    if (c === 'mensaje') return idDe(p, idx);
    if (c === 'condicion') {
      const ramaNo = (p.ramas ?? []).find((r) => (r.filas ?? []).length && (r.filas ?? []).every((f) => f.campo === 'contesto' && f.no));
      const soloSi = (p.ramas ?? []).every((r) => (r.filas ?? []).every((f) => f.campo === 'contesto' && !f.no));
      const sig = ramaNo ? ramaNo.siguiente : soloSi ? p.si_no : null;
      if (!sig) return null;
      idx = indicePorId(pasos, sig);
      continue;
    }
    if (!p.siguiente) return null;
    idx = indicePorId(pasos, p.siguiente);
  }
  return null;
}

console.log(`\n[5] VERIFICACIÓN DEL CORTE «Contestó» (contestó = entrante en wa_mensajes con su lead_id desde que se inscribió, como pausarPorRespuesta)`);
let contestaron = 0, violaciones = 0, perdidos = 0, okCortadas = 0, reiniciadas = 0;
const futuras: string[] = [];
const MENSAJE = new Set(['enviado', 'borrador', 'simulado']);
const SALIO = new Set(['enviado', 'simulado']); // yaLeSalioAlgo (lib/nutricion.ts): un borrador NO es «le salió algo»
for (const ins of insRows) {
  const t0 = Date.parse(ins.inscripto_at);
  // (24/10) REINICIADA: mensajes de esta automatización a este lead FUERA de esta inscripción (desligados o de otra fila).
  const deAntes = enviosSec.filter((e) => e.lead_id === ins.lead_id && e.inscripcion_id !== ins.id && SALIO.has(e.estado));
  if (deAntes.length) {
    reiniciadas += 1;
    console.log(`  ↺ ${quien(ins.lead_id)} insc ${ins.id}: REINICIADA (inscripta de nuevo ${dosZonas(t0)}) — ya le habían salido ${deAntes.length} de la #${SEC} antes: ${deAntes.map((e) => `${nombreNodo(e.nodo_id, e.paso).slice(0, 12)} ${dosZonas(e.ms)}`).join(', ')}`);
  }
  const suyos = entrantes.filter((m) => m.lead_id === ins.lead_id && m.ms >= t0 && vistoPorElMotor(m)).sort((a, b) => a.ms - b.ms);
  const ajenos = porTel.filter((m) => telDe.get(ult10(m.telefono)) === ins.lead_id && Date.parse(m.created_at) >= t0);
  if (ajenos.length) {
    console.log(`  ⚠ ${quien(ins.lead_id)}: ${ajenos.length} entrante(s) de su número guardados con ${ajenos[0].lead_id == null ? 'NINGÚN lead' : `el lead #${ajenos[0].lead_id}`} (teléfono duplicado: el motor matchea el de id más bajo) — el motor NO los ve como respuesta de esta inscripción`);
    if (!suyos.length && ins.estado === 'activa' && ins.proximo_envio_at) {
      const prox = proximoMensaje(ins);
      if (prox) futuras.push(`${quien(ins.lead_id)}: le sale ${nombreNodo(prox).slice(0, 40)} (${dosZonas(Date.parse(ins.proximo_envio_at))}) aunque su número escribió — los entrantes quedaron en otro lead`);
    }
  }
  if (!suyos.length) {
    if (ins.estado === 'respondio') console.log(`  ? ${quien(ins.lead_id)} insc ${ins.id}: está 'respondio' sin entrante de WhatsApp (¿Instagram/Messenger o un reinicio a mano?)`);
    continue;
  }
  contestaron += 1;
  const T = suyos[0].ms;
  const delInsc = enviosSec.filter((e) => e.inscripcion_id === ins.id).sort((a, b) => a.ms - b.ms);
  const msgs = delInsc.filter((e) => MENSAJE.has(e.estado) && !ramaContesto.has(e.nodo_id ?? ''));
  const antes = msgs.filter((e) => e.ms <= T);
  let despues = msgs.filter((e) => e.ms > T);
  // (24/10) Las dos excepciones del motor, las dos: (a) a la inscripción no le había SALIDO nada (enviado|simulado) cuando
  // contestó → su primer mensaje sale; (b) el mensaje ya estaba saliendo (su primera parte salió antes de la respuesta):
  // no se puede frenar a mitad. Antes sólo se veía (a), y un M2 que estaba saliendo cuando contestó se contaba como VIOLACIÓN.
  let permitido: Envio | null = null;
  let porque = '';
  if (despues.length) {
    const d0 = despues[0];
    const ini = inicioDelEnvio(d0);
    if (!antes.some((e) => SALIO.has(e.estado))) { permitido = d0; porque = 'no le había salido nada antes de contestar'; }
    else if (ini <= T) { permitido = d0; porque = `ya estaba saliendo cuando contestó (1.ª parte ${dosZonas(ini)})`; }
    if (permitido) despues = despues.slice(1);
  }
  const aviso = delInsc.filter((e) => ramaContesto.has(e.nodo_id ?? '') && e.ms > T);
  const ultimoNuestro = antes.length ? antes[antes.length - 1].ms : null;
  // La última PARTE que le salió por la línea (wa_mensajes propio) antes de su respuesta: una respuesta a segundos suele ser
  // la bienvenida automática de un WhatsApp Business, y para el motor cuenta igual como «Contestó».
  const salientes = entrantes.filter((m) => m.lead_id === ins.lead_id && m.from_me && m.ms <= T);
  const parte = salientes.length ? salientes[salientes.length - 1].ms : null;
  const auto = parte != null && T - parte <= 30_000 ? ' ¿respuesta automática?' : '';
  console.log(`  ${quien(ins.lead_id)} insc ${ins.id} — contestó ${dosZonas(T)}${ultimoNuestro != null ? ` (${mmss(T - ultimoNuestro)} después de nuestro último mensaje registrado)` : permitido ? ` (MIENTRAS le salía su primer mensaje o antes: ${mmss(permitido.ms - T)} antes de que terminara)` : ''}`
    + `${parte != null ? ` · ${mmss(T - parte)} después de la última parte saliente${auto}` : ''}`);
  console.log(`      estado hoy: ${ins.estado}${ins.proximo_envio_at ? ` · próximo ${nombreNodo(ins.nodo_actual, ins.paso_actual + 1).slice(0, 40)} a las ${dosZonas(Date.parse(ins.proximo_envio_at))}` : ' · sin próximo envío'}`
    + ` · aviso al equipo: ${aviso.length ? aviso.map((a) => `${a.estado}${a.error ? ` (${a.error.slice(0, 50)})` : ''}`).join(', ') : 'no corrió'}`);
  if (permitido) console.log(`      permitido por diseño: ${nombreNodo(permitido.nodo_id, permitido.paso).slice(0, 40)} ${dosZonas(permitido.ms)} (${porque})`);
  for (const v of despues) { violaciones += 1; console.log(`      ✗ VIOLACIÓN: ${nombreNodo(v.nodo_id, v.paso).slice(0, 40)} ${v.estado} ${dosZonas(v.ms)} (${mmss(v.ms - T)} después de contestar)`); }
  if (ins.estado === 'activa') {
    perdidos += 1;
    const prox = proximoMensaje(ins);
    const cuando = ins.proximo_envio_at ? dosZonas(Date.parse(ins.proximo_envio_at)) : 'sin hora';
    const txt = `${quien(ins.lead_id)}: ${prox ? `le sale ${nombreNodo(prox).slice(0, 40)}` : 'no le queda ningún mensaje'} (su próximo paso, ${cuando})${auto ? ' — su «respuesta» parece la bienvenida automática de un WhatsApp Business' : ''}`;
    if (prox) futuras.push(txt);
    console.log(`      ✗ CORTE PERDIDO: contestó y la inscripción sigue 'activa' — el motor no lo ve. ${prox ? `Le va a salir ${nombreNodo(prox).slice(0, 40)} (próximo paso a las ${cuando}).` : 'No le queda ningún mensaje.'}`);
    // Contestó MIENTRAS salía un mensaje (entre su primera parte y la fila del envío): pausarPorRespuesta lo pasó a 'respondio',
    // alContestar no lo tocó (todavía no había fila de envío: yaLeSalioAlgo) y el motor, al terminar de mandar, escribió el
    // avance con estado 'activa' sin compare-and-set de estado (lib/nutricion.ts `escribir` modo 'fila').
    const enCurso = msgs.find((e) => e.ms > T && inicioDelEnvio(e) <= T);
    if (enCurso) console.log(`      causa probable: contestó ${mmss(enCurso.ms - T)} antes de que terminara de salir ${nombreNodo(enCurso.nodo_id, enCurso.paso).slice(0, 44)} (1.ª parte ${mmss(T - inicioDelEnvio(enCurso))} antes); el motor pisó el 'respondio' con 'activa' al registrar el envío.`);
  } else if (!despues.length) okCortadas += 1;
}
console.log(`  → contestaron: ${contestaron} · cortadas bien: ${okCortadas} · VIOLACIONES (envío después de contestar): ${violaciones} · CORTES PERDIDOS (contestó y sigue 'activa'): ${perdidos} · REINICIADAS: ${reiniciadas}`);
if (futuras.length) console.log(`  → envíos que SERÍAN violación (o le llegan a quien escribió) si nadie hace nada:\n     ${futuras.join('\n     ')}`);
if (!enviosSec.length) console.log('  sin envíos todavía');

// ── 6. las inscripciones y la etapa ──────────────────────────────────────────────────────────────────
console.log(`\n[6] INSCRIPCIONES (${insRows.length})`);
const porEstado = new Map<string, number>();
for (const r of insRows) porEstado.set(r.estado, (porEstado.get(r.estado) ?? 0) + 1);
console.log(`  por estado: ${[...porEstado].map(([k, n]) => `${k}=${n}`).join(' · ')} · inscriptas en la ventana: ${insRows.filter((r) => Date.parse(r.inscripto_at) >= DESDE && Date.parse(r.inscripto_at) <= HASTA).length}`);
const proximaApertura = (ms: number): number | null => {
  if (!horario) return ms;
  if (dentroDelHorario(ms, tzNegocio, horario)) return ms;
  let t = Math.ceil(ms / 60_000) * 60_000;
  for (let i = 0; i < 8 * 48; i++, t += 30 * 60_000) if (dentroDelHorario(t, tzNegocio, horario)) {
    let u = t - 30 * 60_000;
    while (u < t && !dentroDelHorario(u, tzNegocio, horario)) u += 60_000;
    return Math.max(u, ms);
  }
  return null;
};
const vivas = insRows.filter((r) => r.proximo_envio_at && (r.estado === 'activa' || r.estado === 'respondio')).sort((a, b) => Date.parse(a.proximo_envio_at!) - Date.parse(b.proximo_envio_at!));
// (24/10) CUÁNDO SALE DE VERDAD cada MENSAJE de WhatsApp de la cola. `proximo_envio_at` es sólo el piso: el motor lo corre a su
// turno (último + minutos, contado desde que TERMINÓ de salir el anterior) y lo manda el primer tick (cada minuto) después; la
// primera parte sale ~16 s después del minuto y cada parte más suma ~10 s. Fuera del horario espera a que abra. Las condiciones y
// esperas no gastan turno (se resuelven en el primer tick libre) y no se estiman. Si pasaría el tope del día, se marca.
let ultimoGoteo = waGoteo.filter((e) => e.ms <= AHORA).at(-1)?.ms ?? null;
const enVentana24 = [...lineaWa.map((x) => x.ms)];
const sale = new Map<number, string>();
for (const r of vivas) {
  const id = r.nodo_actual ?? (pasos[r.paso_actual] ? idDe(pasos[r.paso_actual], r.paso_actual) : null);
  const idx = id ? indicePorId(pasos, id) : -1;
  const p = idx >= 0 ? pasos[idx] : undefined;
  if (!p || claseDe(p) !== 'mensaje' || p.canal !== 'whatsapp') continue;
  const t = Math.max(Date.parse(r.proximo_envio_at!), ultimoGoteo != null && goteo?.minutos ? ultimoGoteo + goteo.minutos * 60_000 : 0);
  let tick = Math.ceil(t / 60_000) * 60_000;
  // El tick del minuto en curso puede estar mandándolo ahora mismo: sólo si ya pasó más de un minuto es «atrasada».
  let atrasada = false;
  if (tick < Math.floor(AHORA / 60_000) * 60_000) { atrasada = true; tick = Math.ceil(AHORA / 60_000) * 60_000; }
  if (horario && !dentroDelHorario(tick, tzNegocio, horario)) { const ab = proximaApertura(tick); if (ab == null) continue; tick = Math.ceil(ab / 60_000) * 60_000; }
  const fin = tick + 16_000 + durEnvioMs(id);
  const en24 = enVentana24.filter((x) => x > fin - 24 * 3600e3).length;
  sale.set(r.id, `≈ ${dosZonas(fin)}${atrasada ? ' (ya tendría que haber salido: atrasada)' : ''}${en24 >= campanaDia ? ' (¡tope de campaña: esperaría!)' : ''}`);
  enVentana24.push(fin);
  ultimoGoteo = fin;
}
console.log(`  próximos (${vivas.length}), en el orden del motor (proximo_envio_at = el piso; «sale ≈» = cuándo saldría con el goteo y el tick):`);
for (const r of vivas) {
  const ms = Date.parse(r.proximo_envio_at!);
  const id = r.nodo_actual ?? (pasos[r.paso_actual] ? idDe(pasos[r.paso_actual], r.paso_actual) : null);
  const ab = proximaApertura(ms);
  const nota = ab != null && ab > ms ? ` → fuera de horario: no antes de que abra, ${dosZonas(ab)}` : ms < AHORA ? ' (vencida)' : '';
  console.log(`    ${dosZonas(ms)}  ${quien(r.lead_id).padEnd(31)} ${nombreNodo(id).slice(0, 44).padEnd(44)} ${r.estado}${nota}${sale.has(r.id) ? ` · sale ${sale.get(r.id)}` : ''}`);
}
const etapas = [...new Set([sec.etapa, ...(Array.isArray(sec.etapas) ? sec.etapas : [])].filter((x): x is string => !!x))];
if (sec.funnel_id != null && etapas.length) {
  const { count: enCasa, error: e1 } = await db.from('leads').select('id', { count: 'exact', head: true }).eq('workspace_id', WS).eq('funnel_id', sec.funnel_id).in('pipeline_stage', etapas);
  if (e1) falla('leads (etapa)', e1);
  const filas = await todo<{ lead_id: number }>('lead_funnel', (a, b) => db.from('lead_funnel').select('lead_id').eq('workspace_id', WS).eq('funnel_id', sec.funnel_id).in('etapa', etapas).order('id').range(a, b));
  const { data: casa, error: e2 } = await db.from('leads').select('id').eq('workspace_id', WS).eq('funnel_id', sec.funnel_id).in('pipeline_stage', etapas).limit(5000);
  if (e2) falla('leads (etapa, ids)', e2);
  const enEtapa = new Set([...filas.map((f) => Number(f.lead_id)), ...((casa ?? []) as Array<{ id: number }>).map((l) => l.id)]);
  const inscriptos = new Set(insRows.map((r) => r.lead_id));
  const sin = [...enEtapa].filter((id) => !inscriptos.has(id));
  console.log(`  en la etapa ${etapas.join(', ')} del CRM #${sec.funnel_id} hoy: ${enEtapa.size} (agregados ${filas.length} + con casa ahí ${enCasa ?? 0}) · sin inscripción en la #${SEC}: ${sin.length}${sin.length ? ' ← ' + sin.slice(0, 15).map((id) => `#${id}`).join(' ') : ''}`);
}
console.log('\nFin (solo lectura: no se escribió nada).');
