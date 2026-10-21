// =============================================================================
// candado-pesado.mjs — el candado de lo PESADO (tsc, tests, build…), con una COLA justa
// =============================================================================
// POR QUE EXISTE: hasta el 20/10/2026 el candado era una convención a mano: `mkdir C:/dev/pesado.lock` (atómico: el que lo crea, lo tiene) y un
// `quien.txt` de texto libre, con CADA chat reintentando el mkdir en su propio loop. Eso no tiene cola: gana el que pregunta más seguido. Medido por
// el Cerebro el 20/10: Pagos esperó casi DOS horas viendo cómo Video Generator y Web Generator se lo pasaban entre ellos. Y un chat que esperaba 40
// min volvía a su rama con `origin/main` 40 min más adelante, así que su VERDE salía ROJO sólo por «te faltan N commits de main».
//
// COMO FUNCIONA (todo en C:/dev, o en MAKO_PESADO_DIR):
//   · EL MUTEX ES EL MISMO de siempre: el directorio `pesado.lock`, creado con mkdir (atómico). Por eso es COMPATIBLE con el mkdir a mano: quien
//     lo toma a mano y quien lo toma con este módulo se excluyen entre sí. Quien lo toma acá además firma `quien.txt` (el mismo formato de siempre)
//     y `dueno.json` (pid, chat, cuenta, sha, desde): así se sabe si el dueño sigue vivo.
//   · LA COLA es la carpeta `pesado.cola/`: cada uno que espera deja un TURNO (`<hora en ms>-<pid>-<azar>.json`) y entra el más VIEJO, no el que
//     pregunta más seguido. Sólo el primero de la cola intenta tomar el candado.
//   · UN PROCESO MUERTO NO TRABA: un turno se limpia si su pid no vive o si dejó de latir (10 min); un dueño se limpia si su pid no vive, si pasó
//     VENCE_MS (90 min). Uno tomado A MANO (sin pid, no se le puede preguntar si vive) se suelta —con alguien esperando— si es de MI mismo worktree
//     (no puede trabarse contra sí mismo: 21/10, 27 min y 7 chats), a los 10 min si no hay ningún proceso pesado vivo, o a los 30 min. Todo en `pesado.log`.
//   · AL SOLTAR SE ENTREGA: si hay alguien esperando, `soltar` reescribe dueno.json con el pid del primero de la fila que siga vivo (los muertos se
//     saltean) SIN borrar el directorio: un `mkdir` a mano nunca lo ve libre mientras haya fila (21/10: uno le ganó a la cola por 2 s). El que lo recibe se
//     entera en su sondeo de siempre (0,4 s) y confirma con `recibido`; con la fila vacía se borra el directorio como siempre.
//   · Se ve todo: `node scripts/antes-de-subir.mjs --cola` (quién lo tiene, desde cuándo, y la cola entera con su orden).
//
// Lo usa scripts/antes-de-subir.mjs; las pruebas están en tests/candado-pesado.test.ts (con un directorio de mentira, un reloj y un «¿vive?» inyectables).
// =============================================================================

import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** El candado de siempre vive en C:/dev (los worktrees son C:/dev/wt-*). En otra máquina, una carpeta temporal; MAKO_PESADO_DIR manda. */
export const DIR_POR_DEFECTO = process.env.MAKO_PESADO_DIR || (process.platform === 'win32' ? 'C:/dev' : path.join(os.tmpdir(), 'mako-pesado'));
export const VENCE_MS = (Number(process.env.MAKO_PESADO_VENCE_MIN) || 90) * 60_000;
export const LATIDO_MS = 15_000;
export const TURNO_MUERTO_MS = 10 * 60_000;
/**
 * Un candado tomado A MANO (sin dueno.json) no tiene pid: no se le puede preguntar si vive. Antes sólo vencía a los 90 min, y el 21/10 uno trabó 27 min a 7
 * chats sin que corriera nada. Ahora, con alguien esperando: a los OCIOSO min se suelta si NO hay ningún proceso pesado vivo, y a los VENCE min se suelta igual.
 */
export const A_MANO_OCIOSO_MS = (Number(process.env.MAKO_PESADO_OCIOSO_MIN) || 10) * 60_000;
export const A_MANO_VENCE_MS = (Number(process.env.MAKO_PESADO_VENCE_A_MANO_MIN) || 30) * 60_000;
/** Cuánto puede quedar un candado ENTREGADO sin que el siguiente lo reciba (espera con el mismo sondeo de siempre, 0,4 s): si pasa, el que debía recibirlo está colgado. */
export const ENTREGA_VENCE_MS = 30_000;
const PARCIAL_MS = 5_000;   // un turno que todavía se está escribiendo (JSON a medias) no se borra por eso

/** Lo que cada uno firma al anotarse y al tomar el candado (todo opcional: sólo se muestra). @typedef {{ chat?: string, cuenta?: string, sha?: string, comando?: string }} DatosTurno */

export const rutas = (dir = DIR_POR_DEFECTO) => ({ dir, lock: path.join(dir, 'pesado.lock'), cola: path.join(dir, 'pesado.cola'), log: path.join(dir, 'pesado.log') });

/** ¿Vive ese pid? `kill(pid, 0)` no mata: pregunta (EPERM = vive pero no es mío). */
export function pidVivo(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e?.code === 'EPERM'; }
}

function anotar(dir, evento, detalle = '') {
  try { appendFileSync(rutas(dir).log, `${new Date().toISOString()} ${evento} ${detalle}\n`); } catch { /* el log es de cortesía */ }
}

const minutos = (ms) => `${Math.max(0, Math.round(ms / 60000))} min`;

// ---------------------------------------------------------------------------
// La cola
// ---------------------------------------------------------------------------

/**
 * Los turnos VIVOS, del más viejo al más nuevo. Limpia (y anota) los de un proceso muerto o que dejó de latir.
 * @returns {{ archivo: string, pid: number, host?: string, entrega?: number, chat?: string, cuenta?: string, sha?: string, comando?: string, desde?: string, mtime: number }[]}
 */
export function leerCola({ dir = DIR_POR_DEFECTO, vivo = pidVivo, ahora = Date.now } = {}) {
  const { cola } = rutas(dir);
  let nombres = [];
  try { nombres = readdirSync(cola).filter((n) => n.endsWith('.json')).sort(); } catch { return []; }
  const salida = [];
  for (const archivo of nombres) {
    const ruta = path.join(cola, archivo);
    let mtime = 0;
    try { mtime = statSync(ruta).mtimeMs; } catch { continue; }
    let datos = null;
    try { datos = JSON.parse(readFileSync(ruta, 'utf8')); } catch { /* a medias */ }
    const muerto = datos
      ? (datos.host === os.hostname() && !vivo(datos.pid)) || ahora() - mtime > TURNO_MUERTO_MS
      : ahora() - mtime > PARCIAL_MS;
    if (muerto) {
      try { unlinkSync(ruta); } catch { /* otro lo limpió */ }
      anotar(dir, 'limpia-turno', `${archivo} (${datos ? `pid ${datos.pid}` : 'ilegible'})`);
      continue;
    }
    salida.push({ archivo, mtime, ...(datos ?? { pid: 0 }) });
  }
  return salida;
}

/**
 * Deja el turno. El nombre ordena por HORA (ms), después por pid: el más viejo entra primero. Devuelve la ruta del turno.
 * @param {{ dir?: string, datos?: DatosTurno, pid?: number, ahora?: () => number }} o
 * @returns {string}
 */
export function anotarse({ dir = DIR_POR_DEFECTO, datos, pid = process.pid, ahora = Date.now }) {
  const { cola } = rutas(dir);
  mkdirSync(cola, { recursive: true });
  const archivo = `${String(ahora()).padStart(14, '0')}-${String(pid).padStart(8, '0')}-${Math.random().toString(36).slice(2, 6)}.json`;
  const ruta = path.join(cola, archivo);
  // `entrega: 1` = «sé recibir un candado entregado». Cada worktree corre SU copia de este script, así que conviven versiones: soltar sólo entrega a quien lo declara
  // (una versión vieja se quedaría esperando 90 min un candado que ya es suyo y que no sabe reconocer).
  writeFileSync(ruta, JSON.stringify({ pid, host: os.hostname(), desde: new Date(ahora()).toISOString(), ...datos, entrega: 1 }));
  anotar(dir, 'anota-turno', `${archivo} ${datos?.chat ?? ''}`);
  return ruta;
}

/** Marca que sigo esperando: un turno que no late se considera muerto. */
export function latir(ruta, ahora = Date.now) {
  try { const t = new Date(ahora()); utimesSync(ruta, t, t); } catch { /* el turno ya no está: lo nota intentarTomar */ }
}

// ---------------------------------------------------------------------------
// El candado
// ---------------------------------------------------------------------------

const esperarMs = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** Escribe sin que nadie lea un archivo a medias: a un archivo temporal y de ahí un rename (si el rename falla, escribe directo). */
function escribirAtomico(ruta, texto) {
  const tmp = `${ruta}.${process.pid}.tmp`;
  try { writeFileSync(tmp, texto); renameSync(tmp, ruta); }
  catch { try { unlinkSync(tmp); } catch { /* no había */ } writeFileSync(ruta, texto); }
}

/** El contenido de dueno.json tal cual, o null si no está (o está a medias). */
function leerDuenoCrudo(dir) {
  try { return JSON.parse(readFileSync(path.join(rutas(dir).lock, 'dueno.json'), 'utf8')); } catch { return null; }
}

/**
 * Quién lo tiene: lo firmado por este módulo (dueno.json), o —si lo tomaron a mano— el texto de quien.txt. null = libre.
 * Un dueno.json que EXISTE pero no se puede leer está a medias (alguien lo está escribiendo): se reintenta, y si sigue así se lo trata como un candado
 * a mano con la edad de ESE archivo —recién escrito—, no la del quien.txt viejo: si no, la regla del candado ocioso lo soltaría en plena entrega.
 */
export function leerDueno({ dir = DIR_POR_DEFECTO } = {}) {
  const { lock } = rutas(dir);
  if (!existsSync(lock)) return null;
  const rutaDueno = path.join(lock, 'dueno.json');
  let dueno = null;
  let parcial = false;
  if (existsSync(rutaDueno)) {
    for (let i = 0; i < 3 && !dueno; i++) {
      dueno = leerDuenoCrudo(dir);
      if (!dueno && i < 2) esperarMs(15);
    }
    parcial = !dueno;
  }
  let quien = '';
  let mtime = 0;
  try { quien = readFileSync(path.join(lock, 'quien.txt'), 'utf8').trim(); mtime = statSync(path.join(lock, 'quien.txt')).mtimeMs; } catch { /* sin quien.txt */ }
  if (parcial) { try { mtime = statSync(rutaDueno).mtimeMs; } catch { /* se fue */ } }
  if (!mtime) { try { mtime = statSync(lock).mtimeMs; } catch { mtime = 0; } }
  return dueno ? { ...dueno, quien, mtime } : { manual: true, ...(parcial ? { parcial: true } : {}), quien: quien || '(sin quien.txt)', mtime };
}

/**
 * ¿Es un candado A MANO de MI mismo worktree? El 21/10 el chat de `wt-crm-ficha2` tomó el candado a mano (su `mkdir` ganó la carrera justo al soltarse el
 * anterior) y después corrió `antes-de-subir`, que se anotó detrás de SU PROPIO candado: 27 min de bloqueo mutuo. El quien.txt empieza con
 * «<worktree> · <rama>». En un worktree propio (`wt-…`) alcanza el worktree; en el clon compartido hacen falta worktree Y rama (varios chats comparten carpeta).
 * @param {{ manual?: boolean, quien?: string, mtime?: number } | null | undefined} dueno
 * @param {DatosTurno | undefined} datos
 * @returns {boolean}
 */
export function esMio(dueno, datos) {
  if (!dueno?.manual || !datos?.chat) return false;
  const quien = String(dueno.quien ?? '').toLowerCase();
  const chat = String(datos.chat).toLowerCase();
  if (quien.startsWith(chat)) return true;
  const worktree = chat.split(' · ')[0];
  return worktree.startsWith('wt-') && quien.startsWith(worktree) && !/[a-z0-9_-]/.test(quien.charAt(worktree.length));
}

// ¿Hay trabajo pesado corriendo de verdad? Los mismos que el vigía de RAM tiene por pesados (tsc, node --test, next build, vitest, jest, playwright, eslint).
const PESADO = /typescript[\\/]lib[\\/]tsc\b|[\\/]tsc(\.js)?["']?(\s|$)|\s--test(\s|$|-)|next[\\/]dist[\\/].*\bbuild\b|\bnext["']?\s+build\b|vitest|\bjest\b|playwright|\beslint\b/i;
/**
 * ¿Esta línea de comando es trabajo pesado? (Las propias de antes-de-subir y del candado no cuentan: son la espera, no el trabajo.)
 * @param {string} linea
 * @returns {boolean}
 */
export function esLineaPesada(linea) {
  return PESADO.test(linea) && !/antes-de-subir|candado-pesado/i.test(linea);
}
let cachePesados = { t: 0, v: /** @type {string[] | null} */ (null) };
/**
 * Los procesos node pesados de hoy (de a 30 s, que mirar cuesta ~1 s). `null` = no se pudo mirar: se asume que SÍ hay (nunca se suelta un candado a ciegas).
 * @returns {string[] | null}
 */
export function procesosPesados() {
  if (Date.now() - cachePesados.t < 30_000) return cachePesados.v;
  let v = null;
  try {
    const r = process.platform === 'win32'
      ? spawnSync('powershell', ['-NoProfile', '-Command', 'Get-CimInstance Win32_Process -Filter "Name=\'node.exe\'" | ForEach-Object { $_.CommandLine }'], { encoding: 'utf8', timeout: 20_000 })
      : spawnSync('ps', ['-eo', 'args'], { encoding: 'utf8', timeout: 20_000 });
    if (r.status === 0 && typeof r.stdout === 'string') v = r.stdout.split('\n').map((l) => l.trim()).filter((l) => l && esLineaPesada(l));
  } catch { /* v = null */ }
  cachePesados = { t: Date.now(), v };
  return v;
}

/**
 * Por qué el candado puesto ya no es de nadie (null = sigue siendo de alguien). El orden importa: lo barato primero, y `pesados()` (que lanza un proceso) sólo
 * cuando un candado a mano pasó de OCIOSO y todavía no llegó al tope.
 * @param {{ manual?: boolean, quien?: string, mtime: number, pid?: number, host?: string, desde?: string, entregado?: boolean, recibido?: number, entregadoMs?: number } | null} actual
 * @param {{ datos?: DatosTurno, vivo?: (pid: number) => boolean, ahora?: () => number, pesados?: () => string[] | null }} [o]
 * @returns {string | null}
 */
export function motivoSuelta(actual, { datos, vivo = pidVivo, ahora = Date.now, pesados = procesosPesados } = {}) {
  if (!actual) return null;
  if (actual.manual) {
    if (esMio(actual, datos)) return 'es de mi mismo worktree (no puede trabarse contra sí mismo)';
    const edad = ahora() - actual.mtime;
    if (edad > A_MANO_VENCE_MS) return `a mano y pasó el tope de ${Math.round(A_MANO_VENCE_MS / 60000)} min`;
    if (edad > A_MANO_OCIOSO_MS) {
      const p = pesados();
      if (Array.isArray(p) && p.length === 0) return `a mano, hace ${minutos(edad)} y sin ningún proceso pesado vivo`;
    }
    return null;
  }
  if (actual.host === os.hostname() && !vivo(actual.pid ?? 0)) return 'el proceso dueño murió';
  if (actual.entregado && !actual.recibido && ahora() - (actual.entregadoMs || 0) > ENTREGA_VENCE_MS) return `se lo entregaron hace más de ${Math.round(ENTREGA_VENCE_MS / 1000)} s y nadie lo recibió`;
  if (ahora() - (Date.parse(actual.desde ?? '') || actual.mtime) > VENCE_MS) return `pasó el tope de ${Math.round(VENCE_MS / 60000)} min`;
  return null;
}

/** ¿El dueño dejó de importar? Pid muerto, o pasó el tope (a mano: A_MANO_VENCE_MS; sin pid no se le puede preguntar si vive). No mira procesos pesados ni «es mío». */
export function duenoVencido(dueno, { vivo = pidVivo, ahora = Date.now } = {}) {
  return motivoSuelta(dueno, { vivo, ahora, pesados: () => null }) !== null;
}

/**
 * Un intento. Sólo el PRIMERO de la cola prueba el mkdir; el resto espera su turno.
 * @param {{ dir?: string, turno: string, datos?: DatosTurno, pid?: number, vivo?: (pid: number) => boolean, ahora?: () => number, pesados?: () => string[] | null }} o
 * @returns {{ estado: 'tomado' } | { estado: 'espera', delante: number, dueno: object | null } | { estado: 'sin-turno' }}
 */
export function intentarTomar({ dir = DIR_POR_DEFECTO, turno, datos, pid = process.pid, vivo = pidVivo, ahora = Date.now, pesados = procesosPesados }) {
  // ¿Me lo ENTREGÓ el dueño que soltó? `soltar` reescribe dueno.json con el pid del primero de la fila SIN borrar el directorio, así que no hay mkdir que ganar:
  // ya es mío, y me entero con este mismo sondeo. Va antes de mirar la cola: mi turno puede seguir ahí, y no se lo trata como «lo limpiaron».
  const crudo = leerDuenoCrudo(dir);
  if (crudo && crudo.pid === pid && crudo.host === os.hostname()) {
    if (crudo.entregado && !crudo.recibido) {
      escribirAtomico(path.join(rutas(dir).lock, 'dueno.json'), JSON.stringify({ ...crudo, recibido: ahora() }));
      anotar(dir, 'recibe', `${datos?.chat ?? crudo.chat ?? ''} pid ${pid} (me lo entregó pid ${crudo.entregadoPor ?? '?'} hace ${Math.max(0, ahora() - (crudo.entregadoMs || ahora()))} ms)`);
    }
    try { unlinkSync(turno); } catch { /* ya no estaba */ }
    return { estado: 'tomado' };
  }
  const nombre = path.basename(turno);
  const cola = leerCola({ dir, vivo, ahora });
  const lugar = cola.findIndex((t) => t.archivo === nombre);
  if (lugar === -1) return { estado: 'sin-turno' };
  const { lock } = rutas(dir);
  const dueno = leerDueno({ dir });
  // `delante`: cuántos tengo antes — los turnos más viejos, y el dueño actual si lo hay.
  if (lugar > 0) return { estado: 'espera', delante: lugar + (dueno ? 1 : 0), dueno };

  let tomado = false;
  try { mkdirSync(lock); tomado = true; }
  catch (e) {
    if (e?.code !== 'EEXIST') throw e;
    const actual = leerDueno({ dir });
    const motivo = motivoSuelta(actual, { datos, vivo, ahora, pesados });
    if (actual && motivo) {
      anotar(dir, 'limpia-dueno', `${actual.manual ? 'a mano' : `pid ${actual.pid}`} · ${actual.quien ?? ''} · hace ${minutos(ahora() - (Date.parse(actual.desde ?? '') || actual.mtime))} · ${motivo}`);
      rmSync(lock, { recursive: true, force: true });
      try { mkdirSync(lock); tomado = true; } catch { /* otro lo ganó en el medio: sigue esperando */ }
    }
    if (!tomado) { const d = leerDueno({ dir }); return { estado: 'espera', delante: d ? 1 : 0, dueno: d }; }
  }
  const desde = new Date(ahora()).toISOString();
  writeFileSync(path.join(lock, 'quien.txt'), `${datos?.chat ?? 'antes-de-subir'} (${datos?.cuenta ?? '?'}) ${datos?.comando ?? 'antes-de-subir'} — ${fechaCorta(ahora())}\n`);
  escribirAtomico(path.join(lock, 'dueno.json'), JSON.stringify({ pid, host: os.hostname(), desde, ...datos }));
  try { unlinkSync(turno); } catch { /* ya no estaba */ }
  anotar(dir, 'toma', `${datos?.chat ?? ''} pid ${pid}`);
  return { estado: 'tomado' };
}

const dos = (n) => String(n).padStart(2, '0');
function fechaCorta(ms) { const d = new Date(ms); return `${dos(d.getDate())}/${dos(d.getMonth() + 1)} ${dos(d.getHours())}:${dos(d.getMinutes())}`; }

/**
 * Suelta el candado SOLO si es mío (un dueño que se venció y fue reemplazado no le saca el candado al que vino después).
 * Si hay alguien esperando, lo ENTREGA: reescribe dueno.json y quien.txt con los datos del primero de la fila que siga vivo (los muertos se saltean) y NO
 * borra el directorio, así un `mkdir` a mano no lo ve libre ni un instante (21/10: el mkdir de un chat le ganó a la cola por 2 s al soltarse el anterior y
 * después su propio antes-de-subir quedó detrás de ese candado). El que lo recibe se entera en su próximo sondeo (0,4 s, igual que antes) y confirma con
 * `recibido`; si en ENTREGA_VENCE_MS nadie lo recibió, `motivoSuelta` lo libera. Con la fila vacía borra el directorio, como siempre.
 * @param {{ dir?: string, pid?: number, vivo?: (pid: number) => boolean, ahora?: () => number }} [o]
 * @returns {boolean} true si era mío (y lo soltó o lo entregó)
 */
export function soltar({ dir = DIR_POR_DEFECTO, pid = process.pid, vivo = pidVivo, ahora = Date.now } = {}) {
  const dueno = leerDueno({ dir });
  if (!dueno || dueno.manual || dueno.pid !== pid) return false;
  const { lock } = rutas(dir);
  // `leerCola` ya limpia los turnos de procesos muertos (con este mismo `vivo`) y deja los vivos en orden: el primero que quede, de esta máquina, es el siguiente.
  const siguiente = leerCola({ dir, vivo, ahora }).find((t) => t.pid > 0 && t.pid !== pid && (t.host ?? os.hostname()) === os.hostname());
  // Si el primero es de una versión vieja (su turno no trae `entrega`), no se le entrega: se borra el directorio y lo toma con su mkdir de siempre. El orden de la fila
  // manda: no se saltea al viejo para entregarle a uno nuevo que está detrás.
  if (siguiente?.entrega) {
    const { archivo, mtime, ...datosSiguiente } = siguiente;
    const quien = `${datosSiguiente.chat ?? 'antes-de-subir'} (${datosSiguiente.cuenta ?? '?'}) ${datosSiguiente.comando ?? 'antes-de-subir'} — ${fechaCorta(ahora())}\n`;
    escribirAtomico(path.join(lock, 'dueno.json'), JSON.stringify({ ...datosSiguiente, pid: siguiente.pid, host: os.hostname(), desde: new Date(ahora()).toISOString(), entregado: true, entregadoMs: ahora(), entregadoPor: pid }));
    escribirAtomico(path.join(lock, 'quien.txt'), quien);
    anotar(dir, 'entrega', `pid ${pid} → pid ${siguiente.pid} ${datosSiguiente.chat ?? ''}`);
    return true;
  }
  rmSync(lock, { recursive: true, force: true });
  anotar(dir, 'suelta', `pid ${pid}`);
  return true;
}

// ---------------------------------------------------------------------------
// Esperar el turno (lo que llama antes-de-subir)
// ---------------------------------------------------------------------------

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Se anota y espera hasta que le toca. Devuelve { soltar } (o { vencio: true } si pasó `esperaMaxMs`).
 * `aviso(texto)` cuenta cómo va la espera: al cambiar el lugar o el dueño, y al menos cada minuto.
 * Los tipos están acá a propósito: el default `aviso = () => {}` hacía deducir `() => void` (un `aviso` con el texto no compilaba) y el retorno salía
 * como `{ soltar } | { vencio }` con `soltar` «posiblemente undefined» aun después de revisar `vencio` (run 173 de Actions, 20/10).
 * @param {{ dir?: string, datos?: DatosTurno, aviso?: (texto: string) => void, pid?: number, vivo?: (pid: number) => boolean, ahora?: () => number,
 *   pausa?: (ms: number) => Promise<void>, esperaMaxMs?: number, sondeoMs?: number, pesados?: () => string[] | null }} o
 * @returns {Promise<{ soltar: () => boolean, esperoMs: number, vencio?: undefined } | { vencio: true, esperoMs: number, soltar?: undefined }>}
 */
export async function tomarTurno({ dir = DIR_POR_DEFECTO, datos, aviso = () => {}, pid = process.pid, vivo = pidVivo, ahora = Date.now, pausa = dormir, esperaMaxMs = 3 * 60 * 60_000, sondeoMs = 400, pesados = procesosPesados }) {
  let turno = anotarse({ dir, datos, pid, ahora });
  const desde = ahora();
  let ultimoAviso = 0;
  let ultimaFirma = '';
  let ultimoLatido = ahora();
  try {
    for (;;) {
      const r = intentarTomar({ dir, turno, datos, pid, vivo, ahora, pesados });
      if (r.estado === 'tomado') return { soltar: () => soltar({ dir, pid, vivo, ahora }), esperoMs: ahora() - desde };
      if (r.estado === 'sin-turno') { turno = anotarse({ dir, datos, pid, ahora }); continue; }   // lo limpiaron (se durmió la PC): se anota de nuevo, al final
      const firma = `${r.delante}|${r.dueno?.quien ?? ''}`;
      if (firma !== ultimaFirma || ahora() - ultimoAviso > 60_000) {
        aviso(`candado: ${r.delante} delante tuyo · ${r.dueno ? `lo tiene «${r.dueno.quien || r.dueno.chat}» hace ${minutos(ahora() - (Date.parse(r.dueno.desde) || r.dueno.mtime))}${r.dueno.manual ? ` (a mano: si es TUYO usá --ya-tengo-el-candado; si nadie lo usa se libera solo a los ${Math.round(A_MANO_OCIOSO_MS / 60000)} min sin procesos pesados)` : ''}` : 'está libre, esperando mi turno'} · llevo ${minutos(ahora() - desde)}`);
        ultimaFirma = firma;
        ultimoAviso = ahora();
      }
      if (ahora() - ultimoLatido > LATIDO_MS) { latir(turno, ahora); ultimoLatido = ahora(); }
      if (ahora() - desde > esperaMaxMs) { try { unlinkSync(turno); } catch { /* ya no estaba */ } anotar(dir, 'se-cansa', `pid ${pid} tras ${minutos(ahora() - desde)}`); return { vencio: true, esperoMs: ahora() - desde }; }
      await pausa(sondeoMs);
    }
  } catch (e) {
    try { unlinkSync(turno); } catch { /* ya no estaba */ }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Verlo
// ---------------------------------------------------------------------------

/** El estado entero: quién lo tiene y la fila. Sirve para `--cola` y para `--listar`. */
export function estado({ dir = DIR_POR_DEFECTO, vivo = pidVivo, ahora = Date.now } = {}) {
  return { dueno: leerDueno({ dir }), cola: leerCola({ dir, vivo, ahora }) };
}

export function describirEstado(e, ahora = Date.now) {
  const lineas = [];
  if (!e.dueno) lineas.push('  candado: LIBRE');
  else {
    const hace = minutos(ahora() - (Date.parse(e.dueno.desde) || e.dueno.mtime));
    lineas.push(`  candado: lo tiene «${e.dueno.quien || e.dueno.chat}» hace ${hace}${e.dueno.manual ? ' — tomado A MANO (sin pid: lo libera quien lo tomó; con alguien esperando se suelta solo a los ' + Math.round(A_MANO_OCIOSO_MS / 60000) + ' min sin procesos pesados, o a los ' + Math.round(A_MANO_VENCE_MS / 60000) + ' min)' : ` — pid ${e.dueno.pid}`}`);
  }
  if (e.cola.length === 0) lineas.push('  fila: vacía');
  else e.cola.forEach((t, i) => lineas.push(`  fila ${i + 1}: ${t.chat ?? '?'} (${t.cuenta ?? '?'}) · ${t.comando ?? ''} · espera hace ${minutos(ahora() - (Date.parse(t.desde) || t.mtime))} · pid ${t.pid}`));
  return lineas.join('\n');
}
