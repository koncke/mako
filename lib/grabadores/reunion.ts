// =============================================================================
// grabadores/reunion — UNA reunión grabada, venga del grabador que venga (PURO: sin IO, testeable)
// =============================================================================
// Pedido de Martín (26/10/2026): «implementa otras integraciones de grabadores de reuniones, como Loom, etc... Así no
// solo se puede grabar con fathom. Y revisa el plan y otras cosas que solo consumen fathom, que puedan consumir todos
// los grabadores».
//
// Hasta ese día todo MaKo leía la forma de Fathom (`FathomMeeting`, lib/fathom-api.ts): el Plan, el Closing, Customer
// Success, el CRM y la API. Esta es la forma COMÚN: cada grabador (lib/grabadores/<grabador>.ts) traduce lo suyo a una
// `Reunion` y los que leen reuniones leen ESTO, sin saber de dónde salió.
//
// ⚠️ LA CLAVE NUMÉRICA (`clave`). Las tablas que ya guardan reuniones la guardan como `bigint` (closing_analyses,
// plan_reuniones_descartadas, curso_progreso.ia_recording_id) y las marcas del Plan van por número
// (`mako.reunion.auto.<n>`). Para no migrar todo eso y para que Fathom siga EXACTAMENTE igual:
//   · Fathom: la clave es su `recording_id` (siempre positivo). Ninguna marca vieja cambia de nombre.
//   · Los demás: un número NEGATIVO derivado de «grabador:id» (53 bits). No choca nunca con uno de Fathom, y es el mismo
//     en cada lectura. De la clave se vuelve a la reunión con la tabla `grabador_reuniones` (lib/grabadores/index.ts).
// La `ref` («fathom:123», «loom:abc») es lo que viaja en texto: la de Fathom es la misma de siempre (plan_propuestas.ref).
// =============================================================================

import type { FathomMeeting, FathomTranscriptItem } from '../fathom-api';

/** Los grabadores que MaKo sabe leer. El orden es el de la grilla de Integraciones. */
// `grabadora` (04/11/2026): la grabación que se hace DESDE MaKo, con el botón «Grabar» de la ficha del lead y de Cold Calling
// (lib/grabar-llamada.ts). No se conecta ni se lista: su lectura es la tabla `llamadas_grabadas` (lib/grabadores/grabadora.ts).
export const GRABADORES = ['fathom', 'loom', 'tldv', 'fireflies', 'zoom', 'otter', 'readai', 'meet', 'grabadora'] as const;
export type GrabadorId = (typeof GRABADORES)[number];

export const esGrabador = (v: unknown): v is GrabadorId => typeof v === 'string' && (GRABADORES as readonly string[]).includes(v);

/** Una persona de la reunión. `externo` = no es de la casa (el prospecto, el cliente); null = el grabador no lo dice. */
export type PersonaReunion = { nombre: string | null; email: string | null; externo: boolean | null };

/** Un turno de la transcripción. `email` = el invitado al que el GRABADOR atribuyó la voz (una heurística suya, no un hecho). */
export type TurnoReunion = { hablante: string | null; email: string | null; texto: string; segundo: number | null };

/** Un compromiso que el propio grabador ya detectó, con su dueño si lo atribuyó. */
export type AccionReunion = { descripcion: string; responsable: { nombre: string | null; email: string | null } | null };

export type Reunion = {
  grabador: GrabadorId;
  /** El id del grabador, como texto (Fathom: el recording_id). */
  id: string;
  /** La clave de MaKo (ver arriba): Fathom = su recording_id; los demás, negativa. */
  clave: number;
  titulo: string;
  /** ISO: cuándo empezó la grabación (o la reunión programada, si el grabador no lo dice). */
  inicio: string | null;
  fin: string | null;
  programada: string | null;
  /** ISO: cuándo APARECIÓ en el grabador (Fathom: created_at). La ventana del cron va por acá. */
  aparecio: string | null;
  /** Los invitados de la reunión (de su calendario). */
  invitados: PersonaReunion[];
  /** Quién grabó: de él es el plan al que van las tareas. */
  anfitrion: { nombre: string | null; email: string | null } | null;
  /** El link a la grabación en el grabador (Fathom: `url`). */
  link: string | null;
  /** El link para compartir (Fathom: `share_url`): el que se le pega al lead en el CRM. */
  linkCompartido: string | null;
  /** undefined = no se pidió; [] = el grabador no tiene. */
  transcripcion?: TurnoReunion[];
  resumen?: string | null;
  acciones?: AccionReunion[];
};

// ── La clave y la ref ─────────────────────────────────────────────────────────────────────────────

/**
 * 53 bits de hash sobre el texto (cyrb53, de dominio público): entra entero en un `number` y en un bigint de Postgres.
 * Sin BigInt a propósito: el proyecto compila a ES2017, que no acepta sus literales.
 */
function hash53(s: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** La clave numérica de una reunión (ver el encabezado). Fathom con un id que no es un entero positivo: NaN. */
export function claveDeReunion(grabador: GrabadorId, id: string | number): number {
  if (grabador === 'fathom') {
    const n = Number(id);
    return Number.isSafeInteger(n) && n > 0 ? n : NaN;
  }
  return -(hash53(`${grabador}:${String(id)}`) || 1);
}

/** ¿Esta clave es de Fathom? (las de Fathom son positivas; las de los demás, negativas). */
export const esClaveDeFathom = (clave: number): boolean => Number.isSafeInteger(clave) && clave > 0;

/** La ref en texto: «fathom:123», «loom:abc». La de Fathom es la de siempre (plan_propuestas.ref). */
export const refDeReunion = (r: Pick<Reunion, 'grabador' | 'id'>): string => `${r.grabador}:${r.id}`;

/** «loom:abc» → { grabador, id }. Sin grabador conocido o sin id: null. Admite el sufijo del resto («fathom:1:partes-2»). */
export function leerRef(ref: unknown): { grabador: GrabadorId; id: string } | null {
  if (typeof ref !== 'string') return null;
  const i = ref.indexOf(':');
  if (i < 1) return null;
  const grabador = ref.slice(0, i);
  const resto = ref.slice(i + 1);
  // El id de un grabador no lleva «:»; lo que sigue es de MaKo (el borrador de una lectura que completa a otra).
  const id = resto.split(':')[0]?.trim() ?? '';
  if (!esGrabador(grabador) || !id || id.length > 200) return null;
  if (grabador === 'fathom' && !esClaveDeFathom(Number(id))) return null;
  return { grabador, id };
}

/** ¿Es la ref de una reunión (de cualquier grabador)? Lo que antes era `ref.startsWith('fathom:')`. */
export const esRefDeReunion = (ref: unknown): boolean => leerRef(ref) != null;

// ── Lo que se lee de una reunión ──────────────────────────────────────────────────────────────────

const minus = (v: unknown): string => (typeof v === 'string' ? v.trim().toLowerCase() : '');

/** Emails (minúscula) de los invitados EXTERNOS: los prospectos, los clientes. */
export function emailsExternos(r: Pick<Reunion, 'invitados'>): string[] {
  return r.invitados.filter((i) => i.externo === true && i.email).map((i) => minus(i.email)).filter(Boolean);
}

/** TODOS los emails de la reunión: invitados (externos o no), quien la grabó y los dueños de los compromisos. */
export function emailsDeLaReunion(r: Pick<Reunion, 'invitados' | 'anfitrion' | 'acciones'>): string[] {
  const out = new Set<string>();
  for (const i of r.invitados) { const e = minus(i.email); if (e) out.add(e); }
  const host = minus(r.anfitrion?.email);
  if (host) out.add(host);
  for (const a of r.acciones ?? []) { const e = minus(a.responsable?.email); if (e) out.add(e); }
  return [...out];
}

/** Duración en minutos (fin − inicio), o null. */
export function duracionMin(r: Pick<Reunion, 'inicio' | 'fin'>): number | null {
  if (!r.inicio || !r.fin) return null;
  const a = Date.parse(r.inicio);
  const b = Date.parse(r.fin);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.round((b - a) / 60000);
}

/** «HH:MM:SS» de un segundo. */
export function reloj(seg: number | null | undefined): string {
  const s = Number.isFinite(seg) && (seg as number) >= 0 ? Math.floor(seg as number) : 0;
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':');
}

/** «HH:MM:SS», «MM:SS» o «SS» → segundos. undefined si no parsea. */
export function segundosDeReloj(v: unknown): number | null {
  const s = String(v ?? '').trim().replace(/[[\]]/g, '');
  if (!s) return null;
  const p = s.split(':').map((x) => Number(x.trim()));
  if (!p.length || p.length > 3 || p.some((n) => !Number.isFinite(n) || n < 0)) return null;
  return Math.round(p.reduce((acc, n) => acc * 60 + n, 0));
}

/**
 * La transcripción en texto plano, «[HH:MM:SS] Hablante: texto», recortada a `maxChars`. Es EXACTAMENTE el formato que
 * leían el Plan y su juez del criterio (lib/fathom-api.ts `transcriptToText`): con Fathom, el texto sale idéntico.
 */
export function transcripcionATexto(turnos: readonly TurnoReunion[] | null | undefined, maxChars = 16000): string {
  if (!turnos || !turnos.length) return '';
  const lines: string[] = [];
  let len = 0;
  for (const t of turnos) {
    const texto = (t.texto ?? '').trim();
    if (!texto) continue;
    const line = `[${reloj(t.segundo)}] ${t.hablante ?? '—'}: ${texto}`;
    if (len + line.length > maxChars) { lines.push('… (transcript recortado)'); break; }
    lines.push(line);
    len += line.length + 1;
  }
  return lines.join('\n');
}

/**
 * La transcripción con los segundos ya calculados, «[123s · 2:03] Hablante: texto»: la del Closing Analyst (citas con su
 * segundo para el deep-link). Igual que `transcriptWithSeconds` de lib/closing.ts.
 */
export function transcripcionConSegundos(turnos: readonly TurnoReunion[] | null | undefined, maxChars = 60000): string {
  if (!turnos || !turnos.length) return '';
  const out: string[] = [];
  let len = 0;
  for (const t of turnos) {
    const tx = (t.texto ?? '').trim();
    if (!tx) continue;
    const s = Number.isFinite(t.segundo) && (t.segundo as number) >= 0 ? Math.floor(t.segundo as number) : 0;
    const line = `[${s}s · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}] ${t.hablante ?? '—'}: ${tx}`;
    if (len + line.length > maxChars) { out.push('… (transcript recortado)'); break; }
    out.push(line);
    len += line.length + 1;
  }
  return out.join('\n');
}

/**
 * ¿El invitado realmente habló? `true` = certeza de que asistió · `false` = certeza de que NO · `null` = no se puede
 * saber (quien llama asume que asistió: hubo grabación).
 *
 * ⚠️ El email de un turno NO es un hecho sobre la asistencia: es la HEURÍSTICA del grabador, que matchea el nombre del
 * invitado del calendario contra el nombre de quien habla. Leer «no matcheó» como «no vino» mandó a Nutrición No Show
 * una R1 de 64 minutos con 218 turnos del prospecto (lead 1696, 12/08; el porqué entero, en lib/fathom.ts). La ausencia
 * se AFIRMA sólo cuando la transcripción la prueba: todos los que hablaron están atribuidos y todos son de la casa.
 * Un grabador que no atribuye voces a invitados devuelve siempre null: no inventa una ausencia.
 */
export function invitadoHablo(r: Pick<Reunion, 'transcripcion' | 'invitados' | 'anfitrion'>, email: string): boolean | null {
  const t = r.transcripcion ?? [];
  if (!t.length) return null;
  const e = minus(email);
  if (e && t.some((x) => minus(x.email) === e)) return true;
  const deCasa = new Set<string>();
  for (const i of r.invitados) { const em = minus(i.email); if (em && i.externo === false) deCasa.add(em); }
  const host = minus(r.anfitrion?.email);
  if (host) deCasa.add(host);
  const soloDeCasa = t.every((x) => { const m = minus(x.email); return !!m && deCasa.has(m); });
  return soloDeCasa ? false : null;
}

/** Los grabadores que atribuyen cada voz a un correo del calendario: sólo Fathom (medido el 26/10/2026). */
export const ATRIBUYEN_VOCES: ReadonlySet<GrabadorId> = new Set<GrabadorId>(['fathom']);

/**
 * ¿Se anota la asistencia con lo que dijo `invitadoHablo`? Una certeza (true/false) sí, venga de donde venga. Un «no se
 * sabe» (null) se anota como «asistió» SÓLO con un grabador que atribuye voces (Fathom, como siempre): ahí la grabación
 * con el invitado en el calendario es la señal de que vino.
 *
 * ⚠️ tl;dv y Fireflies dan null SIEMPRE (no atribuyen voces), y sus invitados salen del CALENDARIO, no de quién entró
 * (revisión del tren m, 26/10/2026). Con «null = asistió» un lead que no vino —el closer lo esperó 10 minutos con tl;dv
 * grabando— quedaba «asistió», la etapa avanzaba y nunca entraba a la nutrición No Show. Se engancha el link y la
 * asistencia queda sin marcar, como hace `crm-auto.ts` con un match por nombre: la marca una persona o la regla T1.
 */
export const anotaLaAsistencia = (grabador: GrabadorId, hablo: boolean | null): boolean => hablo != null || ATRIBUYEN_VOCES.has(grabador);

// ── La MISMA reunión, grabada por dos grabadores ───────────────────────────────────────────────────

/** Cuánto pueden separarse los inicios de dos grabaciones de la misma reunión (cada bot entra cuando puede). */
export const VENTANA_GEMELAS_MS = 10 * 60_000;

const instantes = (r: Pick<Reunion, 'inicio' | 'programada'>): number[] =>
  [r.inicio, r.programada].map((v) => (v ? Date.parse(v) : NaN)).filter((n) => Number.isFinite(n));
const tituloNormal = (t: string | null | undefined): string =>
  (t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * ¿`a` y `b` son la MISMA reunión, grabada por dos grabadores distintos? (revisión del tren m, 26/10/2026: con Fathom y
 * tl;dv grabando la R1, cada copia tenía su clave y se analizaba, se enganchaba y disparaba eventos DOS veces.)
 *
 * Empiezan con menos de 10 minutos de diferencia Y comparten un invitado (un correo que no es de quien grabó) o el mismo
 * título con el mismo anfitrión. Del mismo grabador nunca: su id ya la identifica. Sin hora, no se afirma nada.
 */
export function esLaMismaReunion(a: Reunion, b: Reunion): boolean {
  if (a.grabador === b.grabador) return false;
  const ta = instantes(a), tb = instantes(b);
  if (!ta.some((x) => tb.some((y) => Math.abs(x - y) <= VENTANA_GEMELAS_MS))) return false;
  const anfitriones = new Set([minus(a.anfitrion?.email), minus(b.anfitrion?.email)].filter(Boolean));
  const deA = new Set(a.invitados.map((i) => minus(i.email)).filter((e) => e && !anfitriones.has(e)));
  if (b.invitados.some((i) => deA.has(minus(i.email)))) return true;
  const titulo = tituloNormal(a.titulo);
  const mismoAnfitrion = !minus(a.anfitrion?.email) || !minus(b.anfitrion?.email) || minus(a.anfitrion?.email) === minus(b.anfitrion?.email);
  return titulo.length >= 4 && titulo === tituloNormal(b.titulo) && mismoAnfitrion;
}

/** Las otras copias de `r` (de otros grabadores) en `todas`. Para una lista chica (las reuniones de un lead). */
export const gemelasDe = (r: Reunion, todas: readonly Reunion[]): Reunion[] =>
  todas.filter((o) => o.clave !== r.clave && esLaMismaReunion(r, o));

/**
 * Las gemelas de cada reunión de `todas`, por clave (sólo las que tienen alguna). Para el barrido del Closing y del Plan,
 * que miran cientos: ordena por hora y compara sólo las cercanas, en vez de todas contra todas. Con un solo grabador en
 * la lista, vacío sin mirar nada.
 */
export function mapaDeGemelas(todas: readonly Reunion[]): Map<number, Reunion[]> {
  const out = new Map<number, Reunion[]>();
  if (new Set(todas.map((r) => r.grabador)).size < 2) return out;
  const conHora = todas.map((r) => ({ r, t: Math.min(...instantes(r)) })).filter((x) => Number.isFinite(x.t)).sort((a, b) => a.t - b.t);
  // `instantes` tiene la hora programada Y la de inicio: dos copias pueden diferir en la más temprana aunque coincidan en
  // otra (una empezó tarde). Tres horas de vecindad sobran; la que decide es `esLaMismaReunion`.
  const VECINDAD_MS = 3 * 3600_000;
  const sumar = (a: Reunion, b: Reunion) => out.set(a.clave, [...(out.get(a.clave) ?? []), b]);
  for (let i = 0; i < conHora.length; i++) {
    for (let j = i + 1; j < conHora.length && conHora[j].t - conHora[i].t <= VECINDAD_MS; j++) {
      if (esLaMismaReunion(conHora[i].r, conHora[j].r)) { sumar(conHora[i].r, conHora[j].r); sumar(conHora[j].r, conHora[i].r); }
    }
  }
  return out;
}

/**
 * De `r` y sus gemelas, ¿le toca a `r`? Una sola copia se procesa: la que ya tiene algo hecho (una fila del Closing, un
 * borrador del Plan) —así una copia que llega DESPUÉS no se procesa de nuevo—, y si ninguna, la del grabador que va
 * primero en `GRABADORES` (Fathom: el que mejor atribuye voces). Sin gemelas, siempre.
 */
export function leTocaA(r: Reunion, gemelas: readonly Reunion[], yaHecha: (x: Reunion) => boolean): boolean {
  if (!gemelas.length) return true;
  const grupo = [r, ...gemelas];
  const hechas = grupo.filter(yaHecha);
  const elegida = [...(hechas.length ? hechas : grupo)]
    .sort((x, y) => GRABADORES.indexOf(x.grabador) - GRABADORES.indexOf(y.grabador) || x.clave - y.clave)[0];
  return elegida.clave === r.clave;
}

/** La clave de «esta reunión de este lead» que no depende del grabador: el dedup del evento y del aviso al terminar. */
export const claveDeReunionDelLead = (leadId: number, cual: 'j1' | 'j2', fecha: string | null): string => `reunion:${leadId}:${cual}:${fecha ?? ''}`;

// ── Quién es de afuera, cuando el grabador no lo dice ──────────────────────────────────────────────

/** Los correos gratuitos: un dominio así no dice de qué empresa es nadie. */
const DOMINIOS_PUBLICOS = new Set([
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.es', 'outlook.com', 'outlook.es', 'live.com', 'msn.com',
  'yahoo.com', 'yahoo.es', 'yahoo.com.mx', 'yahoo.com.ar', 'icloud.com', 'me.com', 'mac.com', 'proton.me', 'protonmail.com', 'aol.com',
]);
const dominio = (e: string): string => e.slice(e.lastIndexOf('@') + 1);

/**
 * ¿Este invitado es de AFUERA? Fathom lo dice (`is_external`); tl;dv, Fireflies y Otter no (medido el 26/10/2026). Se
 * INFIERE del correo contra el de quien grabó: el mismo correo es de la casa; el mismo dominio de empresa, también; un
 * dominio distinto, o cualquiera cuando quien grabó usa un correo gratuito (un gmail no dice de qué empresa es nadie),
 * es de afuera. Sin correo: null (no se sabe). Es una inferencia, y el que la usa (el CRM, el clasificador) ya trata a
 * un «de afuera» que no está en el CRM como lo que es: un desconocido.
 */
export function externoPorCorreo(email: string | null | undefined, delAnfitrion: string | null | undefined, deCasa: ReadonlySet<string> = new Set()): boolean | null {
  const e = minus(email);
  if (!e || !e.includes('@')) return null;
  const host = minus(delAnfitrion);
  if (e === host || deCasa.has(e)) return false;
  if (!host || !host.includes('@')) return null;
  const dh = dominio(host);
  if (DOMINIOS_PUBLICOS.has(dh)) return true;
  return dominio(e) !== dh;
}

// ── Fathom → Reunion ──────────────────────────────────────────────────────────────────────────────

const txt = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

function turnosDeFathom(items: readonly FathomTranscriptItem[] | null | undefined): TurnoReunion[] {
  return (items ?? []).map((it) => ({
    hablante: txt(it.speaker?.display_name),
    email: txt(it.speaker?.matched_calendar_invitee_email),
    texto: typeof it.text === 'string' ? it.text : '',
    segundo: segundosDeReloj(it.timestamp),
  }));
}

/**
 * Una reunión de Fathom (la de su API o la del webhook «new-meeting-content-ready», que trae los mismos nombres) en la
 * forma común. Sin pérdida para lo que MaKo lee: título (cae a `meeting_title`), las fechas, los invitados con su
 * `is_external`, quien grabó, los dos links, la transcripción con sus atribuciones, el resumen y los action items.
 */
export function deFathom(m: Partial<FathomMeeting> & { recording_id?: number | null }): Reunion {
  const id = String(m.recording_id ?? '');
  const inicio = txt(m.recording_start_time) ?? txt(m.scheduled_start_time);
  return {
    grabador: 'fathom',
    id,
    clave: claveDeReunion('fathom', id),
    titulo: (txt(m.title) ?? txt(m.meeting_title) ?? ''),
    inicio,
    fin: txt(m.recording_end_time),
    programada: txt(m.scheduled_start_time),
    aparecio: txt(m.created_at),
    invitados: (m.calendar_invitees ?? []).map((i) => ({
      // Sin nombre de calendario, el nombre con que Fathom lo vio hablar (un Meet sin evento trae sólo eso).
      nombre: txt(i?.name) ?? txt(i?.matched_speaker_display_name),
      email: txt(i?.email),
      externo: typeof i?.is_external === 'boolean' ? i.is_external : null,
    })),
    anfitrion: m.recorded_by ? { nombre: txt(m.recorded_by.name), email: txt(m.recorded_by.email) } : null,
    link: txt(m.url),
    linkCompartido: txt(m.share_url),
    ...(m.transcript !== undefined ? { transcripcion: turnosDeFathom(m.transcript) } : {}),
    ...(m.default_summary !== undefined ? { resumen: txt(m.default_summary?.markdown_formatted) } : {}),
    ...(m.action_items !== undefined ? {
      acciones: (m.action_items ?? []).filter((a) => txt(a?.description)).map((a) => ({
        descripcion: String(a.description).trim(),
        responsable: a.assignee ? { nombre: txt(a.assignee.name), email: txt(a.assignee.email) } : null,
      })),
    } : {}),
  };
}
