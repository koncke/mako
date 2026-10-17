#!/usr/bin/env node
// =============================================================================
// cartero.mjs — el cartero del Centro de Operaciones, en la PC de Martín
// =============================================================================
// Lleva a los chats de Claude Code los pedidos que Martín firma en /admin/operaciones. Diseño:
// docs/diseno-centro-de-operaciones.md §2 y §3; lo que costó: docs/hallazgos-operaciones.md.
//
// ⚠️ HAY UN RUNNER POR CARPETA, NO POR CUENTA (16/10/2026). Martín pasó las tres cuentas a la
// terminal («no usar más a Claude desde la app de desktop, sino desde powershell»), cada una con su
// CLAUDE_CONFIG_DIR (claude1 → ~/.claude, claude2 → ~/.claude-martin, claude3 → ~/.claude-cuenta3).
// Cada carpeta tiene SU registro de sesiones (`<dir>/sessions/*.json`) y SendMessage sólo llega a las
// sesiones registradas en la carpeta del que manda (medido el 16/10: a una de otra carpeta contesta
// «ENOINBOX: no-key»). LEER sí se puede de todas, así que:
//   · cualquier Runner ve las tres cuentas enteras y reclama lo que ALGÚN Runner puede entregar
//     (`entregables`: el chat vivo, y un Runner abierto en SU carpeta);
//   · lo reclamado va al buzón de la PC (compartido) con la carpeta del chat, y cada Runner entrega
//     sólo lo de la suya (`pendientes`). Dos Runners en la misma carpeta (la app y la terminal de la
//     cuenta 1 comparten ~/.claude) no lo mandan dos veces: el primero que lo lista se lo queda.
//   · `ciclo` sin `--cuenta` da la vuelta por las cuentas que tienen una fuente en su carpeta.
// La carpeta propia sale de CLAUDE_PID (la sesión que corre esto está en `<dir>/sessions/<pid>.json`)
// o de CLAUDE_CONFIG_DIR. ⚠️ Nunca se copian las `.key` de una carpeta a otra: es la protección de
// SendMessage contra un canal que nadie avaló.
//
// ⚠️ UN SCRIPT NO PUEDE ESCRIBIRLE A UNA SESIÓN. No hay una vía documentada: los named pipes del
// registro son el protocolo INTERNO de Claude Code y no se usan. Por eso este script hace TODO
// menos la entrega —consulta a MaKo, verifica la firma, reclama, arma el mensaje, anota los
// acuses— y el que entrega es un CHAT («Cartero» de esa cuenta) que corre `ciclo`, manda cada
// mensaje con SendMessage y anota el resultado con `acuse`.
//
// ⚠️ LA FIRMA SE VERIFICA ACÁ, EN CÓDIGO, Y NO EN EL MODELO. Un pedido sale sólo si su texto
// está firmado por una de las claves públicas de `claves.txt`, que se cargan A MANO en esta PC.
// MaKo no las conoce ni las puede cambiar: con MaKo comprometida entera, lo peor es no entregar.
//
// ⚠️ NO ABRE NINGÚN PUERTO. Sólo hace pedidos HTTPS hacia afuera.
//
// ⚠️ UN PEDIDO SE ENTREGA UNA VEZ, también contra un servidor que mienta: `entregados.json`
// guarda los ids que ya salieron, y un id que vuelve se rechaza aunque MaKo lo devuelva otra vez.
//
// ⚠️ TAMBIÉN AVISA LAS RESPUESTAS DE LA TICKETERA (15/10/2026): cuando Martín contesta una
// tarjeta, el chat que la preguntó recibe «Martín contestó tu tarjeta X» con el comando para
// leerla. El texto lo arma ESTE script con el `ref` validado: de MaKo no viaja ni una palabra, por
// eso un aviso no necesita firma. Las reglas, en lib/decisiones-aviso.ts.
//
// Comandos (todo lo de la PC vive en ~/.claude/operaciones/; los que dicen [cuenta] llevan
// `--cuenta claudeN`):
//   instalar                       copia este archivo a ~/.claude/operaciones/ y crea las carpetas
//   url <https://…>                a dónde consultar (default https://hola-mako.com)
//   token <mkop_…>                 el token de los carteros (se acuña en /admin/operaciones)
//   clave <SPKI base64>            acepta una clave de firma más (una por dispositivo)
//   cartero <claudeN> app|cli <dir>  suma una fuente de chats a una cuenta (la app, o la terminal de
//                                  esa carpeta de config); una cuenta puede tener las dos
//   carpeta <carpeta> <claudeN>    qué cuenta es cada carpeta de la app (claude-code-sessions)
//   repo <ruta>                    el clon desde el que los chats leen la Ticketera (default: el de
//                                  OneDrive); va en el aviso de una respuesta
//   estado [cuenta]                qué tiene configurado, en qué carpeta corre y qué ve
//   ciclo [cuenta]                 una vuelta: sube lo que ve y los acuses; dice qué entregar. Sin
//                                  cuenta, por todas las de su carpeta
//   pendientes [cuenta]            lo del buzón que le toca mandar a ESTE Runner (su carpeta)
//   acuse [cuenta] <id> ok | error <motivo>   lo anota el Runner después de cada SendMessage
//   abrir                          (1.11.0) abre en una ventana los chats nuevos que Martín pidió con un clic
//   abrir-permitir [off]           (1.11.0) el permiso local para abrirlos: lo prende Martín, una vez
//   nube [<id> <título> …]         (1.10.0) los chats de la nube de la cuenta de la app, como los lista list_sessions;
//                                  los corre el Runner de la app en cada vuelta, antes de `ciclo`
//   cierre <id> --hecho "…" [--decidido "…"] [--comprobado "…"] [--sigue "…"] [--prueba "…"] [--revisar "/ruta"]
//                                  lo corre el CHAT QUE RECIBIÓ el pedido, al terminarlo
//   esperar [cuenta] [--max-seg N] (opción C, a probar) espera hasta que haya algo y sale con 2
//   uso                            lo corre la BARRA DE ESTADO del Runner (runner-settings.json): anota la cuota de
//                                  la cuenta de su terminal y escribe la línea de la barra
// =============================================================================

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

export const VERSION = '1.11.0';
const HOME = os.homedir();
const DIR = process.env.CARTERO_DIR || path.join(HOME, '.claude', 'operaciones');
const APP = process.env.CARTERO_APP_DIR || path.join(process.env.APPDATA || path.join(HOME, 'AppData', 'Roaming'), 'Claude', 'claude-code-sessions');
const CFG = path.join(DIR, 'config.json');
const CLAVES = path.join(DIR, 'claves.txt');
const LEDGER = path.join(DIR, 'entregados.json');
/** Desde la 1.4.0 lo entregado es UN ARCHIVO POR ID: con varios Runners acusando a la vez, leer-cambiar-escribir
 *  `entregados.json` perdía ids (el último que escribe pisa al otro). El json viejo se sigue leyendo. */
const ENTREGADOS = path.join(DIR, 'entregados');
const LATIDOS = path.join(DIR, 'latidos');
/** Un Runner que no dio una vuelta en este rato no cuenta como abierto (su cron corre cada 2 minutos). */
const LATIDO_VENCE_MS = 6 * 60 * 1000;
/** Un cierre que MaKo no aceptó se vuelve a subir en cada vuelta, hasta este tope (su acuse puede llegar después). */
const CIERRE_VENCE_MS = 24 * 3600 * 1000;
const CIERRES = path.join(DIR, 'cierres');
/** Los adjuntos de cada trabajo (1.9.0): una carpeta por id, `adjuntos/<id>/`. Se borran a los VENCE_DIAS. */
const ADJUNTOS = path.join(DIR, 'adjuntos');
/** Los chats de la NUBE de cada cuenta (1.10.0): no quedan en ningún archivo de la PC; los anota el Runner de la app, que
 *  los ve con list_sessions (`nube <id> <título> …`). `nube/<cuenta>.json`. */
const NUBE = path.join(DIR, 'nube');
/** Los chats nuevos que pidió Martín con un clic (1.11.0): `aperturas/<id>.json` mientras esperan a `abrir`, y después el
 *  primer mensaje (`<id>.txt`) y el lanzador (`<id>.cmd`). Se borran a los VENCE_DIAS. */
const APERTURAS = path.join(DIR, 'aperturas');
/** Con qué se abre el `.cmd`: el Explorador, que vive fuera del job de la herramienta Bash (medido el 17/10: un hijo
 *  `detached` muere con ella). Los tests lo cambian por un registrador (`CARTERO_ABRIDOR`, un JSON con el programa y sus
 *  argumentos): es el entorno de la PC, el mismo que ya decide `CARTERO_DIR`. */
const ABRIDOR = (() => { try { const a = JSON.parse(process.env.CARTERO_ABRIDOR ?? ''); if (Array.isArray(a) && a.length && a.every((x) => typeof x === 'string')) return a; } catch { /* el de siempre */ } return ['explorer.exe']; })();
/** Lo anotado de la nube vale este rato: si el Runner dejó de anotarlo, esos chats no se suben como si siguieran ahí. */
const NUBE_VENCE_MS = 10 * 60 * 1000;
/** La cuota de cada cuenta, como la anota la barra de estado de su Runner (`uso`). */
const USO = path.join(DIR, 'uso');
/** Lo que se le pasa al Runner con `--settings`: su barra de estado anota la cuota (lib/runner.ts). */
const AJUSTES_RUNNER = path.join(DIR, 'runner-settings.json');
/** Lo que mide `get_usage` en la app de escritorio (lo escriben los chats; 4º campo, la cuenta). */
const USO_APP = path.join(process.env.CARTERO_HOME || HOME, '.claude', 'uso-semanal.txt');
const LOG = path.join(DIR, 'cartero.log');
/** Un pedido en el buzón sin acuse por más que esto pasa a «no sé si llegó». */
const BUZON_VENCE_MS = 30 * 60 * 1000;
/** Los chats que se ofrecen son los de estos directorios (los del clon y sus worktrees). */
const CWDS_DEFAULT = [path.join(HOME, 'OneDrive', 'Escritorio', 'dashboard-marketing-main'), 'C:\\dev\\'];
/** El clon, desde donde corre `scripts/decisiones.ts` (lee el `.env.local` de ahí). Se cambia con
 *  `repo <ruta>`. */
const REPO_DEFAULT = path.join(HOME, 'OneDrive', 'Escritorio', 'dashboard-marketing-main', 'dashboard-marketing');

// ── utilidades ──────────────────────────────────────────────────────────────────────────────
const sinCR = (s) => s.replace(/\r/g, '');
const leerJson = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return def; } };
const escribirJson = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n'); };
const log = (m) => { try { fs.mkdirSync(DIR, { recursive: true }); fs.appendFileSync(LOG, `${new Date().toISOString()} ${m}\n`); } catch { /* el log nunca frena */ } };
const config = () => leerJson(CFG, {});
const claves = () => { try { return sinCR(fs.readFileSync(CLAVES, 'utf8')).split('\n').map((l) => l.trim()).filter(Boolean); } catch { return []; } };
const claveId = (spki) => crypto.createHash('sha256').update(Buffer.from(spki, 'base64')).digest('hex').slice(0, 16);
const expandir = (p) => String(p ?? '').replace(/^~(?=[\\/]|$)/, HOME);
const ESTE = path.join(DIR, 'cartero.mjs');
const buzonDe = (cuenta) => path.join(DIR, cuenta, 'buzon');
const acusesDe = (cuenta) => path.join(DIR, cuenta, 'acuses');
const resolver = (d) => path.resolve(expandir(d));
const mismoDir = (a, b) => resolver(a).toLowerCase() === resolver(b).toLowerCase();
/** «~/.claude-martin»: la carpeta como la escribe Martín, para mostrarla. */
const rotuloDir = (d) => {
  const rel = path.relative(HOME, resolver(d));
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? `~/${rel.split(path.sep).join('/')}` : resolver(d);
};
/** Las cuentas que tienen un buzón en la PC. */
const cuentasConBuzon = () => { try { return fs.readdirSync(DIR).filter((d) => CUENTA_RE.test(d)); } catch { return []; } };

// ── las fuentes y la carpeta de este Runner ──────────────────────────────────────────────────
/** De dónde salen los chats de una cuenta. Desde la 1.4.0 son varias (la app y la terminal); la forma
 *  de antes, `{ fuente, configDir }`, se sigue leyendo como una sola. */
function fuentesDe(k) {
  const lista = Array.isArray(k?.fuentes) ? k.fuentes : k ? [k] : [];
  const vistas = new Set();
  const out = [];
  for (const f of lista) {
    if (!f || (f.fuente !== 'app' && f.fuente !== 'cli')) continue;
    const configDir = f.configDir || '~/.claude';
    const clave = `${f.fuente}:${resolver(configDir).toLowerCase()}`;
    if (!vistas.has(clave)) { vistas.add(clave); out.push({ fuente: f.fuente, configDir }); }
  }
  return out;
}

/** Todas las carpetas de config que nombra la configuración. */
const carpetasDe = (cfg) => {
  const out = [];
  for (const k of Object.values(cfg.carteros ?? {})) for (const f of fuentesDe(k)) if (!out.some((d) => mismoDir(d, f.configDir))) out.push(f.configDir);
  return out;
};

/** La carpeta de config de la sesión que corre ESTE proceso: Claude Code le pasa su pid a la terminal
 *  (CLAUDE_PID) y la sesión está registrada en `<dir>/sessions/<pid>.json`. Si no, CLAUDE_CONFIG_DIR (el
 *  que pone `claude2` en el perfil de PowerShell), y si no, ~/.claude. CARTERO_CONFIG_DIR manda (los tests). */
export function dirPropio(cfg = config(), env = process.env) {
  if (env.CARTERO_CONFIG_DIR) return resolver(env.CARTERO_CONFIG_DIR);
  const pid = Number(env.CLAUDE_PID);
  if (Number.isInteger(pid) && pid > 0) {
    for (const d of [...carpetasDe(cfg), env.CLAUDE_CONFIG_DIR, '~/.claude'].filter(Boolean)) {
      if (fs.existsSync(path.join(resolver(d), 'sessions', `${pid}.json`))) return resolver(d);
    }
  }
  return resolver(env.CLAUDE_CONFIG_DIR || '~/.claude');
}

/** Las cuentas por las que da la vuelta un Runner: las que tienen una fuente en su carpeta. */
const cuentasDeLaCarpeta = (cfg, dir) => Object.keys(cfg.carteros ?? {})
  .filter((c) => CUENTA_RE.test(c) && fuentesDe(cfg.carteros[c]).some((f) => mismoDir(f.configDir, dir)));

// ── el contrato del pedido (el test diferencial lo compara con lib/operaciones-reglas.ts) ─────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DESTINO_RE = /^(local|cli)_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CUENTA_RE = /^claude\d{1,2}$/;
/** El id de un chat de la nube (copia de lib/operaciones-reglas.ts → NUBE_RE): lo que no es de esta PC. */
export const NUBE_RE = /^(?!local_|cli_)[A-Za-z][A-Za-z0-9_-]{5,100}$/;
const MAX_TEXTO = 8000;
/** El modelo y el esfuerzo que eligió Martín (opcionales; copia de lib/operaciones-reglas.ts → MODELOS y ESFUERZOS). */
const MODELOS = ['opus', 'sonnet', 'haiku'];
const ESFUERZOS = ['low', 'medium', 'high', 'xhigh', 'max'];
const VENCE_DIAS = 14;
// Los adjuntos (1.9.0, 17/10/2026; copia de lib/operaciones-reglas.ts → problemaDeAdjuntos, con test diferencial).
export const MIMES_ADJUNTO = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
export const MAX_ADJUNTOS = 4;
export const MAX_BYTES_ADJUNTOS = 4 * 1024 * 1024;
const MAX_NOMBRE_ADJUNTO = 120;
/** La extensión con la que se guarda: la decide el TIPO (validado por los bytes), nunca el nombre que trajo. */
const EXT_ADJUNTO = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'application/pdf': 'pdf' };

export function problemaDeAdjuntos(x) {
  if (!Array.isArray(x) || !x.length || x.length > MAX_ADJUNTOS) return 'adjuntos inválidos';
  const refs = new Set();
  let total = 0;
  for (const a of x) {
    if (!a || typeof a !== 'object' || Array.isArray(a)) return 'adjuntos inválidos';
    if (typeof a.ref !== 'string' || !UUID_RE.test(a.ref) || refs.has(a.ref)) return 'adjuntos inválidos';
    refs.add(a.ref);
    if (typeof a.nombre !== 'string' || !a.nombre.trim() || a.nombre.length > MAX_NOMBRE_ADJUNTO || /[\u0000-\u001f]/.test(a.nombre)) return 'adjuntos inválidos';
    if (!MIMES_ADJUNTO.includes(a.mime)) return 'adjuntos inválidos';
    if (typeof a.bytes !== 'number' || !Number.isInteger(a.bytes) || a.bytes < 1) return 'adjuntos inválidos';
    if (typeof a.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(a.sha256)) return 'adjuntos inválidos';
    total += a.bytes;
  }
  return total > MAX_BYTES_ADJUNTOS ? 'adjuntos inválidos' : null;
}

/** Qué es un archivo por sus PRIMEROS BYTES (copia de lib/mako-adjuntos.ts → tipoPorFirma, con test diferencial). Un
 *  ejecutable («MZ», un script) no es ninguno de los cinco: no baja. */
export function mimePorFirma(b) {
  const es = (off, ...xs) => xs.every((x, i) => b[off + i] === x);
  if (b.length >= 3 && es(0, 0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (b.length >= 8 && es(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (b.length >= 6 && es(0, 0x47, 0x49, 0x46, 0x38)) return 'image/gif';
  if (b.length >= 12 && es(0, 0x52, 0x49, 0x46, 0x46) && es(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp';
  if (b.length >= 5 && es(0, 0x25, 0x50, 0x44, 0x46, 0x2d)) return 'application/pdf';
  return null;
}

/** El nombre en disco: el número, lo legible del nombre (sin su extensión) y la extensión del TIPO. */
export function nombreEnDisco(i, nombre, mime) {
  const base = String(nombre ?? '').replace(/\.[^.]*$/, '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'adjunto';
  return `${i + 1}-${base}.${EXT_ADJUNTO[mime]}`;
}

/**
 * Baja los adjuntos de un trabajo YA VERIFICADO a `adjuntos/<id>/` y devuelve sus rutas. Lo que baja tiene que tener el
 * tamaño, el sha256 y el tipo (por sus bytes) que dice el texto firmado: si algo no coincide, no queda nada y tira.
 * La URL la arma la PC (su `url` y el `ref` firmado): de MaKo no se usa ninguna dirección.
 */
export async function bajarAdjuntos(url, token, id, adjuntos, dir = ADJUNTOS) {
  if (!UUID_RE.test(id)) throw new Error('id inválido');
  const carpeta = path.join(dir, id);
  fs.rmSync(carpeta, { recursive: true, force: true });
  fs.mkdirSync(carpeta, { recursive: true });
  try {
    const rutas = [];
    for (const [i, a] of adjuntos.entries()) {
      // ⚠️ SIN COMPRIMIR Y EN PARTES (1.9.1, la revisión de seguridad del 17/10/2026). Con `arrayBuffer()` la respuesta
      //    entera iba a la RAM antes de mirar nada: una respuesta «chunked» no trae content-length (Number(null) da 0 y
      //    pasaba) y una con gzip trae el tamaño COMPRIMIDO. Ahora se pide sin comprimir, se rechaza la comprimida, y se
      //    corta en cuanto lo leído pasa lo firmado.
      const r = await fetch(`${url}/api/operaciones/cartero?pedido=${id}&adjunto=${a.ref}`, {
        headers: { authorization: `Bearer ${token}`, 'accept-encoding': 'identity' }, signal: AbortSignal.timeout(60_000),
      });
      if (!r.ok) throw new Error(`MaKo no lo dio (${r.status})`);
      const codificado = (r.headers.get('content-encoding') ?? 'identity').trim().toLowerCase();
      if (codificado !== 'identity') { await r.body?.cancel().catch(() => {}); throw new Error('vino comprimido'); }
      const largo = r.headers.get('content-length');
      if (largo != null && !(Number(largo) <= a.bytes)) { await r.body?.cancel().catch(() => {}); throw new Error('pesa más de lo firmado'); }
      const partes = [];
      let leidos = 0;
      for await (const parte of r.body ?? []) {
        leidos += parte.length;
        if (leidos > a.bytes) throw new Error('pesa más de lo firmado'); // salir del for await cancela el resto
        partes.push(parte);
      }
      const b = Buffer.concat(partes, leidos);
      if (b.length !== a.bytes) throw new Error('no pesa lo firmado');
      if (crypto.createHash('sha256').update(b).digest('hex') !== a.sha256) throw new Error('no es el archivo firmado');
      if (mimePorFirma(b) !== a.mime) throw new Error('no es una foto ni un PDF');
      const ruta = path.join(carpeta, nombreEnDisco(i, a.nombre, a.mime));
      fs.writeFileSync(ruta, b, { flag: 'wx' });
      rutas.push(ruta);
    }
    return rutas;
  } catch (e) {
    fs.rmSync(carpeta, { recursive: true, force: true });
    throw e;
  }
}

/**
 * Anota los chats de la nube de una cuenta: `nube <id> <título> [<id> <título> …]` (sin nada, la deja vacía). Lo corre el
 * Runner de la app en cada vuelta, con lo que le da list_sessions fuera de esta PC. Sólo se ven: no se les entrega nada.
 */
export function anotarNube(cuenta, pares, ahora = Date.now()) {
  if (pares.length % 2) throw new Error('uso: nube <id> <título> [<id> <título> …]');
  const chats = [];
  for (let i = 0; i < pares.length; i += 2) {
    const id = String(pares[i]).trim();
    const titulo = String(pares[i + 1]).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 120) || '(sin título)';
    if (!NUBE_RE.test(id)) throw new Error(`«${id.slice(0, 40)}» no es un chat de la nube (los de esta PC empiezan con local_)`);
    if (!chats.some((c) => c.id === id)) chats.push({ id, titulo });
  }
  escribirJson(path.join(NUBE, `${cuenta}.json`), { at: new Date(ahora).toISOString(), chats: chats.slice(0, 50) });
  return chats.length;
}

/** Lo anotado de la nube para una cuenta, si es de los últimos minutos. */
export function leerNube(cuenta, ahora = Date.now(), dir = NUBE) {
  const n = leerJson(path.join(dir, `${cuenta}.json`), null);
  const at = Date.parse(n?.at ?? '');
  if (!Number.isFinite(at) || ahora - at > NUBE_VENCE_MS || !Array.isArray(n.chats)) return [];
  return n.chats.filter((c) => c && NUBE_RE.test(c.id ?? '') && typeof c.titulo === 'string').slice(0, 50);
}

/** El primer mensaje y el lanzador de una apertura, a los VENCE_DIAS: el chat ya lo leyó o no lo va a leer. */
function limpiarAperturas(ahora = Date.now()) {
  let archivos = [];
  try { archivos = fs.readdirSync(APERTURAS).filter((n) => /\.(txt|cmd)$/.test(n)); } catch { return; }
  for (const n of archivos) {
    try {
      const f = path.join(APERTURAS, n);
      if (ahora - fs.statSync(f).mtimeMs > VENCE_DIAS * 86_400_000) fs.rmSync(f, { force: true });
    } catch { /* la limpieza nunca frena la vuelta */ }
  }
}

/** La cuenta de la app en la carpeta de este Runner: la única que ve list_sessions. */
const cuentaDeLaApp = (cfg, dir) => Object.keys(cfg.carteros ?? {})
  .find((c) => CUENTA_RE.test(c) && fuentesDe(cfg.carteros[c]).some((f) => f.fuente === 'app' && mismoDir(f.configDir, dir))) ?? null;

/**
 * Abre los chats nuevos de la cola (1.11.0). Lo corre el Runner cuando `ciclo` dice `aperturas`. Para cada uno:
 *   · lo toma con un rename (dos Runners no abren el mismo);
 *   · vuelve a verificar la FIRMA sobre el mismo `firmado` que lee después, y el texto (id, destino, cuenta);
 *   · mira el permiso local otra vez (se pudo apagar entre la vuelta y ahora);
 *   · escribe el primer mensaje en `<id>.txt` y el `.cmd`, y lo abre con el Explorador.
 * El acuse dice «se pidió abrir», no «abierto»: el Explorador devuelve 1 aunque abra (medido el 17/10). La prueba es que
 * el chat aparezca en la lista.
 */
export function abrir(cfg = config(), ahora = Date.now()) {
  const spkis = claves();
  const viejo = new Set(leerJson(LEDGER, []));
  const out = [];
  for (const f of listar(APERTURAS)) {
    const tomada = `${f}.tomada`;
    try { fs.renameSync(f, tomada); } catch { continue; } // la tomó otro Runner
    const a = leerJson(tomada, null);
    fs.rmSync(tomada, { force: true });
    const id = a?.id;
    if (typeof id !== 'string' || !UUID_RE.test(id) || path.basename(f) !== `${id}.json`) continue;
    const cuenta = typeof a.cuenta === 'string' && CUENTA_RE.test(a.cuenta) ? a.cuenta : null;
    if (!cuenta) continue;
    const acusar = (estado, motivo) => {
      escribirJson(path.join(acusesDe(cuenta), `${id}.json`), { id, estado, motivo });
      out.push({ id, estado, motivo });
      log(`[${cuenta}] ABRIR ${id} ${estado}: ${motivo}`);
    };
    if (viejo.has(id) || fs.existsSync(path.join(ENTREGADOS, id))) { acusar('no_entregado', 'Ya se había abierto: no se abre dos veces'); continue; }
    const firmado = typeof a.firmado === 'string' ? a.firmado : '';
    if (!quienFirmo(firmado, typeof a.firma === 'string' ? a.firma : '', spkis)) { acusar('no_entregado', 'Pégale tu Token al Runner y vuelve a mandarlo'); continue; }
    const l = leerFirmable(firmado, ahora);
    if (!l.ok) { acusar('no_entregado', `Vuelve a mandarlo (${l.motivo})`); continue; }
    if (l.p.id !== id || l.p.destino !== DESTINO_NUEVO || l.p.cuenta !== cuenta) { acusar('no_entregado', 'Vuelve a mandarlo: no coincide con la firma'); continue; }
    if (!puedeAbrir(cfg, cuenta)) { acusar('no_entregado', 'Prende la apertura de chats en la PC: pídeselo al Runner'); continue; }
    const txt = path.join(APERTURAS, `${id}.txt`);
    const cmd = path.join(APERTURAS, `${id}.cmd`);
    let lanzador;
    try { lanzador = archivoCmd(comandoDeApertura(cuenta, l.p.titulo, txt)); } catch (e) { acusar('no_entregado', `Vuelve a mandarlo (${e.message})`); continue; }
    fs.writeFileSync(txt, l.p.texto);
    fs.writeFileSync(cmd, lanzador);
    spawnSync(ABRIDOR[0], [...ABRIDOR.slice(1), cmd], { timeout: 15_000 });
    fs.mkdirSync(ENTREGADOS, { recursive: true });
    fs.writeFileSync(path.join(ENTREGADOS, id), '');
    acusar('entregado', `Se pidió abrir «${l.p.titulo}» en la terminal de la cuenta ${cuenta.replace('claude', '')}: mira que aparezca en la lista`);
  }
  return out;
}

/** Las carpetas de adjuntos de más de VENCE_DIAS: el trabajo ya venció, y el chat ya los leyó o no los va a leer. */
function limpiarAdjuntos(ahora = Date.now()) {
  let viejas = [];
  try { viejas = fs.readdirSync(ADJUNTOS).filter((d) => UUID_RE.test(d)); } catch { return; }
  for (const d of viejas) {
    try {
      const f = path.join(ADJUNTOS, d);
      if (ahora - fs.statSync(f).mtimeMs > VENCE_DIAS * 86_400_000) fs.rmSync(f, { recursive: true, force: true });
    } catch { /* la limpieza nunca frena la vuelta */ }
  }
}

// Abrir un chat de terminal con un clic (1.11.0; copia de lib/operaciones-reglas.ts, con test diferencial).
export const DESTINO_NUEVO = 'nuevo';
const MAX_NOMBRE_NUEVO = 80;
/** Lista blanca: letras, números, espacios y `› > - _ . , ( ) + :`, empezando con letra o número. Sin comillas. */
export const NOMBRE_NUEVO_RE = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} ›>\-_.,()+:]*$/u;
export function problemaDeNombreNuevo(x) {
  if (typeof x !== 'string' || x.length > MAX_NOMBRE_NUEVO || !NOMBRE_NUEVO_RE.test(x) || x !== x.trim()) return 'nombre inválido';
  return null;
}
/** La ruta del primer mensaje: sólo letras, números y `\ : . _ -` (la carpeta fija de la PC y el id). */
const RUTA_TXT_RE = /^[A-Za-z]:\\[A-Za-z0-9\\._-]+\.txt$/;

/**
 * El comando de PowerShell que abre el chat nuevo. Se arma SÓLO con valores que pasan su lista blanca: la cuenta contra
 * CUENTA_RE (la función del perfil), el nombre contra NOMBRE_NUEVO_RE y la ruta del primer mensaje contra RUTA_TXT_RE. El
 * texto del primer mensaje NO entra acá: el chat arranca con un pedido fijo que lo manda a leer el archivo.
 */
export function comandoDeApertura(cuenta, titulo, rutaTxt) {
  if (!CUENTA_RE.test(cuenta ?? '')) throw new Error('cuenta inválida');
  if (problemaDeNombreNuevo(titulo)) throw new Error('nombre inválido');
  if (!RUTA_TXT_RE.test(rutaTxt ?? '')) throw new Error('ruta inválida');
  return `${cuenta} -n '${titulo}' 'Lee el archivo ${rutaTxt} y haz lo que dice: es el primer mensaje de Martín.'`;
}

/** El `.cmd` que abre el Explorador: sólo `powershell.exe -NoExit -EncodedCommand <base64>`; ningún texto de nadie. */
export function archivoCmd(comando) {
  const b64 = Buffer.from(comando, 'utf16le').toString('base64');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) throw new Error('codificación inválida');
  return `@echo off\r\npowershell.exe -NoExit -EncodedCommand ${b64}\r\n`;
}

/** ¿Esta PC abre chats de esa cuenta? Con el permiso local prendido (`abrir-permitir`) y una terminal declarada. */
export const puedeAbrir = (cfg, cuenta) => cfg?.abrir === true && CUENTA_RE.test(cuenta ?? '')
  && fuentesDe(cfg.carteros?.[cuenta]).some((f) => f.fuente === 'cli');

/** La forma de un `ref` de la Ticketera (copia de REF_DECISION, app/admin/runway/decisiones.ts). */
export const REF_DECISION = /^[a-z0-9][a-z0-9-]{1,63}$/;

export function leerFirmable(texto, ahora) {
  let o;
  try { o = JSON.parse(texto); } catch { return { ok: false, motivo: 'no es JSON' }; }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return { ok: false, motivo: 'no es un objeto' };
  if (o.v !== 1) return { ok: false, motivo: 'versión desconocida' };
  if (typeof o.id !== 'string' || !UUID_RE.test(o.id)) return { ok: false, motivo: 'id inválido' };
  if (typeof o.texto !== 'string' || !o.texto.trim()) return { ok: false, motivo: 'sin texto' };
  if (o.texto.length > MAX_TEXTO) return { ok: false, motivo: `el texto pasa de ${MAX_TEXTO} caracteres` };
  const nuevo = o.destino === DESTINO_NUEVO;
  if (!nuevo && (typeof o.destino !== 'string' || !DESTINO_RE.test(o.destino))) return { ok: false, motivo: 'destino inválido' };
  if (o.cuenta !== null && (typeof o.cuenta !== 'string' || !CUENTA_RE.test(o.cuenta))) return { ok: false, motivo: 'cuenta inválida' };
  if (o.titulo !== null && typeof o.titulo !== 'string') return { ok: false, motivo: 'título inválido' };
  if (nuevo && o.cuenta === null) return { ok: false, motivo: 'falta la cuenta' };
  if (nuevo) { const m = problemaDeNombreNuevo(o.titulo); if (m) return { ok: false, motivo: m }; }
  if (nuevo && o.adjuntos !== undefined) return { ok: false, motivo: 'un chat nuevo no lleva adjuntos' };
  if (o.alcance !== 'solo_esto' && o.alcance !== 'de_ahora_en_mas') return { ok: false, motivo: 'alcance inválido' };
  if (o.modelo != null && !MODELOS.includes(o.modelo)) return { ok: false, motivo: 'modelo inválido' };
  if (o.esfuerzo != null && !ESFUERZOS.includes(o.esfuerzo)) return { ok: false, motivo: 'esfuerzo inválido' };
  if (o.adjuntos !== undefined) { const m = problemaDeAdjuntos(o.adjuntos); if (m) return { ok: false, motivo: m }; }
  const creado = typeof o.creado === 'string' ? Date.parse(o.creado) : NaN;
  const vence = typeof o.vence === 'string' ? Date.parse(o.vence) : NaN;
  if (!Number.isFinite(creado) || !Number.isFinite(vence)) return { ok: false, motivo: 'fechas inválidas' };
  if (vence <= creado || vence - creado > (VENCE_DIAS + 1) * 86_400_000) return { ok: false, motivo: 'vencimiento inválido' };
  if (creado > ahora + 60_000) return { ok: false, motivo: 'fecha en el futuro' };
  if (vence <= ahora) return { ok: false, motivo: 'venció' };
  return { ok: true, p: o };
}

/** Lo que el Runner necesita para aplicar el modelo y el esfuerzo antes de entregar: la sesión y los dos valores. Sólo en
 *  un chat de la APP (`local_…`): las herramientas que los cambian son de la app, y a uno de terminal no se le puede. */
export function comoCorre(p) {
  return String(p?.destino ?? '').startsWith('local_') && (p.modelo || p.esfuerzo)
    ? { sesion: p.destino, modelo: p.modelo ?? null, esfuerzo: p.esfuerzo ?? null }
    : {};
}

/** ¿Alguna de las claves de la PC firmó este texto? Devuelve el id de la clave, o null. */
export function quienFirmo(texto, firmaB64, spkis) {
  for (const spki of spkis) {
    try {
      const key = crypto.createPublicKey({ key: Buffer.from(spki, 'base64'), format: 'der', type: 'spki' });
      const ok = crypto.verify('sha256', Buffer.from(texto, 'utf8'), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(firmaB64, 'base64'));
      if (ok) return claveId(spki);
    } catch { /* clave mal pegada: se prueba la siguiente */ }
  }
  return null;
}

// ── lo que se dijo en cada chat (1.8.0, 17/10/2026) ──────────────────────────────────────────────────────────────────
// Martín: «los chats no se entienden... No se entiende la conversación que se tiene». La conversación del Centro tiene
// que leerse como un chat: lo que se le dijo y lo que CONTESTÓ al terminar cada turno. Sale del transcript del chat
// (`<carpeta>/projects/<cwd con «-»>/<sesión>.jsonl`), leído desde donde quedó la vuelta anterior (`turnos/<local>.json`),
// y se sube sólo lo nuevo. Del transcript NO sale nada más: ni las herramientas, ni lo que pensó, ni los recordatorios.
const TURNOS = path.join(DIR, 'turnos');
const TOPE_TURNO = 4000;
/** La primera vez que se lee un chat, sólo su cola: la historia entera puede pesar decenas de MB. */
const COLA_PRIMERA_VEZ = 2 * 1024 * 1024;
/** Lo que se lee de un chat por vuelta, como mucho (el resto, en la siguiente). */
const LECTURA_MAX = 4 * 1024 * 1024;
const MAX_TURNOS_VUELTA = 300;
/** Un chat cerrado se sigue leyendo estos días (lo último que contestó antes de cerrarse). */
const DIAS_TURNOS = 3;
const RECORDATORIO_RE = /<system-reminder>[\s\S]*?<\/system-reminder>/g;
const CRUZADO_RE = /<cross-session-message\b([^>]*)>([\s\S]*?)<\/cross-session-message>/;
/** Lo que el sistema le escribe al chat (no lo dijo nadie): avisos de tareas, de sesiones, del CI. */
const AUTOMATICO_RE = /^(?:<task-notification>|<side-sessions-event>|<ci-monitor-event>|\[SYSTEM NOTIFICATION|<local-command-|<command-name>)/;

/** La carpeta de los transcripts de un cwd: Claude Code cambia por «-» todo lo que no es letra o número. */
export const carpetaDelCwd = (cwd) => String(cwd ?? '').replace(/[^a-zA-Z0-9]/g, '-');

/** El texto de un mensaje: un string, o los bloques de texto (sin herramientas ni imágenes). */
function textoDe(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n');
}

/**
 * Los turnos de unas líneas del transcript, en orden. De lo que escribe el chat salen DOS cosas por turno (Martín, 17/10:
 * cada chat abre su trabajo con «Voy a trabajar en…» y lo cierra con su «Ya está»):
 *   · su PRIMER texto, en el acto: es lo que va a hacer, y se ve mientras trabaja;
 *   · su ÚLTIMO texto, cuando el turno termina (el próximo mensaje que se le escribe, o `stop_hook_summary`), si es otro.
 * `pendiente` es el turno que todavía no terminó (`{ primero, ultimo }`): viene de la vuelta anterior y vuelve. Puro.
 *   · `yo`: lo que se le escribió (Martín en la app, o un trabajo del Centro: `trabajo` = su id, que el Centro ya muestra);
 *   · `otro`: lo que le mandó otra sesión (`de`: su nombre);
 *   · `el`: lo que contestó.
 */
/**
 * @param {string[]} lineas
 * @param {{ primero: string | null, ultimo: { uuid: string, texto: string, at: string } | null } | null} [pendiente]
 */
export function turnosDeLineas(lineas, pendiente = null) {
  const turnos = [];
  let p = pendiente;
  const cerrar = () => { const t = cierreDe(p); if (t) turnos.push(t); p = null; };
  for (const l of lineas) {
    let o;
    try { o = JSON.parse(l); } catch { continue; }
    if (!o || typeof o !== 'object' || o.isSidechain) continue;
    if (o.type === 'assistant') {
      // Lo que escribe la app en nombre del modelo («You've hit your session limit…») no es una respuesta del chat.
      if (o.isApiErrorMessage || o.message?.model === '<synthetic>') continue;
      const t = textoDe(o.message?.content).trim();
      if (!t || typeof o.uuid !== 'string') continue;
      const ultimo = { uuid: o.uuid, texto: t.slice(0, TOPE_TURNO), at: o.timestamp };
      // El primer texto del turno sale ya: «Voy a trabajar en…».
      if (!p?.primero) turnos.push({ uuid: o.uuid, rol: 'el', de: null, texto: ultimo.texto, at: ultimo.at, trabajo: null });
      p = { primero: p?.primero ?? o.uuid, ultimo };
      continue;
    }
    if (o.type === 'system' && o.subtype === 'stop_hook_summary') { cerrar(); continue; }
    if (o.type !== 'user' || o.isMeta || typeof o.uuid !== 'string') continue;
    const c = o.message?.content;
    if (Array.isArray(c) && c.some((b) => b && b.type === 'tool_result')) continue;
    const t = textoDe(c).replace(RECORDATORIO_RE, '').trim();
    if (!t || AUTOMATICO_RE.test(t)) continue;
    cerrar();
    const m = CRUZADO_RE.exec(t);
    if (m) {
      const cuerpo = m[2].trim();
      // El aviso de una respuesta de la Ticketera lo arma la PC (mensajeAviso): no es una conversación.
      if (!cuerpo || /^Martín contestó tu tarjeta/.test(cuerpo)) continue;
      const trabajo = /^Pedido de Martín desde el Centro de Operaciones/.test(cuerpo) ? (/ cierre ([0-9a-f-]{36}) /.exec(cuerpo)?.[1] ?? null) : null;
      const de = /\bname="([^"]{1,60})"/.exec(m[1])?.[1] ?? /\bfrom="([^"]{1,60})"/.exec(m[1])?.[1] ?? null;
      turnos.push(trabajo
        ? { uuid: o.uuid, rol: 'yo', de: null, texto: cuerpo.slice(0, TOPE_TURNO), at: o.timestamp, trabajo }
        : { uuid: o.uuid, rol: 'otro', de, texto: cuerpo.slice(0, TOPE_TURNO), at: o.timestamp, trabajo: null });
      continue;
    }
    turnos.push({ uuid: o.uuid, rol: 'yo', de: null, texto: t.slice(0, TOPE_TURNO), at: o.timestamp, trabajo: null });
  }
  return { turnos, pendiente: p };
}

/** El cierre de un turno: su último texto, si no es el mismo que ya salió como el primero. null = nada que sumar. */
export function cierreDe(p) {
  const u = p?.ultimo;
  return u && u.uuid !== p.primero ? { uuid: u.uuid, rol: 'el', de: null, texto: u.texto, at: u.at, trabajo: null } : null;
}

/** Lo nuevo del transcript de un chat desde la vuelta anterior. Devuelve los turnos y la marca nueva (se guarda sólo si
 *  MaKo dice que entraron: `guardarMarcas`). Sin transcript, o sin nada nuevo, nada. */
function turnosNuevos(c) {
  if (!c.transcript) return null;
  let st;
  try { st = fs.statSync(c.transcript); } catch { return null; }
  const archivo = path.join(TURNOS, `${c.local}.json`);
  const marca0 = leerJson(archivo, null);
  const marca = marca0 && marca0.transcript === c.transcript ? marca0 : null;
  const ocupado = c.estado === 'busy';
  // Sin nada nuevo y sin una respuesta esperando a que el turno termine: no hay nada que leer.
  if (marca && marca.offset >= st.size && !(marca.pendiente && !ocupado)) return null;
  // Todo en BYTES (Buffer): una posición en caracteres se corre con cada tilde o emoji.
  let inicio = marca ? Math.min(marca.offset, st.size) : Math.max(0, st.size - COLA_PRIMERA_VEZ);
  const hasta = Math.min(st.size, inicio + LECTURA_MAX);
  let buf = Buffer.alloc(0);
  if (hasta > inicio) {
    buf = Buffer.alloc(hasta - inicio);
    const fd = fs.openSync(c.transcript, 'r');
    try { fs.readSync(fd, buf, 0, buf.length, inicio); } finally { fs.closeSync(fd); }
  }
  // La primera vez se arranca en el medio de una línea: se salta hasta la siguiente.
  if (!marca && inicio > 0) {
    const i = buf.indexOf(0x0a);
    if (i < 0) { inicio += buf.length; buf = Buffer.alloc(0); } else { inicio += i + 1; buf = buf.subarray(i + 1); }
  }
  // Sólo las líneas enteras: la última, si no terminó, se lee en la vuelta siguiente.
  const corte = buf.lastIndexOf(0x0a);
  const completo = corte >= 0 ? buf.subarray(0, corte + 1) : Buffer.alloc(0);
  const offset = inicio + completo.length;
  // La 1.8.0 guardaba sólo la última respuesta ({ uuid, texto, at }); la 1.8.1, el turno abierto ({ primero, ultimo }).
  const viejo = marca?.pendiente;
  const pendiente = viejo && typeof viejo.uuid === 'string' ? { primero: null, ultimo: viejo } : viejo ?? null;
  const r = turnosDeLineas(completo.toString('utf8').split('\n').filter(Boolean), pendiente);
  // Un chat que no está trabajando ya terminó su turno: su última respuesta es la que vale.
  if (r.pendiente && !ocupado) { const t = cierreDe(r.pendiente); if (t) r.turnos.push(t); r.pendiente = null; }
  return { turnos: r.turnos.map((t) => ({ local: c.local, ...t })), marca: { archivo, transcript: c.transcript, offset, pendiente: r.pendiente } };
}

/** Lo nuevo de todos los chats de la vuelta, con un tope (lo que no entra sale en la siguiente: su marca no avanza). */
export function turnosDeLaVuelta(chats) {
  const turnos = [];
  const marcas = [];
  for (const c of chats) {
    // Los chats cerrados hace días no cambian: no se leen (la app guarda cientos).
    const t = c.actividad ? Date.parse(c.actividad) : NaN;
    if (!c.vivo && !(Number.isFinite(t) && Date.now() - t < DIAS_TURNOS * 86_400_000)) continue;
    let n;
    try { n = turnosNuevos(c); } catch { n = null; }
    if (!n) continue;
    if (turnos.length + n.turnos.length > MAX_TURNOS_VUELTA && turnos.length) break;
    turnos.push(...n.turnos.slice(-MAX_TURNOS_VUELTA));
    marcas.push(n.marca);
  }
  return { turnos, marcas };
}

function guardarMarcas(marcas) {
  fs.mkdirSync(TURNOS, { recursive: true });
  for (const { archivo, ...m } of marcas) escribirJson(archivo, m);
}

// ── qué chats hay ────────────────────────────────────────────────────────────────────────────
const vive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const enCwds = (cwd, cwds) => cwds.some((p) => String(cwd ?? '').toLowerCase().startsWith(expandir(p).toLowerCase()));
/** El chat que entrega no se ofrece como destino: SendMessage no deja escribirse a sí mismo
 *  (medido el 15/10: «is this session itself»). Se reconoce por el título: «Runner…» (su nombre en pantalla
 *  desde el 15/10/2026, lib/runner.ts) o «Cartero…» (el de antes), también como sub-chat de su jefe
 *  («Centro de Operaciones › Runner»): se mira el último tramo. */
export const esElCartero = (titulo) => /^(runner|cartero)\b/i.test(String(titulo ?? '').split(/[›>]/).pop().trim());

/** Los chats de la APP de esta cuenta: su carpeta en claude-code-sessions (vivos o no). */
function chatsDeLaApp(cuenta, cwds, carpetas) {
  const out = new Map();
  let todas = [];
  try { todas = fs.readdirSync(APP); } catch { return out; }
  for (const carpeta of todas) {
    // Sólo las carpetas de ESTA cuenta: los chats viejos de otra cuenta en la app no los puede
    // retomar ésta. Una carpeta sin declarar no se ofrece (`carpeta <uuid> <claudeN>`).
    if ((carpetas[carpeta] ?? carpetas[carpeta.slice(0, 8)]) !== cuenta) continue;
    const recorrer = (d, prof) => {
      let ents = [];
      try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const e of ents) {
        const f = path.join(d, e.name);
        if (e.isDirectory() && prof < 3) recorrer(f, prof + 1);
        else if (e.isFile() && /^local_.*\.json$/.test(e.name)) {
          const o = leerJson(f, null);
          if (!o || o.isArchived || !DESTINO_RE.test(o.sessionId ?? '') || !enCwds(o.cwd, cwds)) continue;
          out.set(o.sessionId, {
            local: o.sessionId, titulo: String(o.title || '(sin título)').slice(0, 120), cuenta,
            // El Runner se ve en la lista (1.10.0, Martín: «todo chat abierto se ve»), marcado: no se le escribe.
            ...(esElCartero(o.title) ? { esRunner: true } : {}),
            vivo: false, estado: null, pipe: null,
            actividad: o.lastActivityAt ? new Date(o.lastActivityAt).toISOString() : null,
            // Su transcript: los chats de la app los guarda en ~/.claude (también los de otra cuenta).
            transcript: UUID_RE.test(o.cliSessionId ?? '') ? path.join(resolver('~/.claude'), 'projects', carpetaDelCwd(o.cwd), `${o.cliSessionId}.jsonl`) : null,
          });
        }
      }
    };
    recorrer(path.join(APP, carpeta), 0);
  }
  return out;
}

/** Las sesiones vivas registradas en una carpeta de config (las de la app y las de la terminal). */
function sesionesVivas(configDir) {
  const dir = path.join(resolver(configDir), 'sessions');
  let archivos = [];
  try { archivos = fs.readdirSync(dir).filter((f) => /^\d+\.json$/.test(f)); } catch { return []; }
  return archivos.map((f) => leerJson(path.join(dir, f), null)).filter((s) => s?.messagingSocketPath && vive(Number(s.pid)));
}

/** Las carpetas con un Runner abierto: una sesión viva que se llama Runner (o Cartero). El registro trae el nombre
 *  de las dos clases de sesión (el de la app y el de `claude -n Runner`). La de quien corre esto cuenta siempre:
 *  el que da la vuelta ES el Runner de su carpeta. */
function carpetasConRunner(cfg, propio) {
  const out = new Set([resolver(propio).toLowerCase()]);
  for (const d of carpetasDe(cfg)) {
    // Con el nombre no alcanza: un chat llamado Runner al que nadie le pegó las instrucciones no da vueltas, y MaKo le
    // reclamaría trabajos que se vencerían en el buzón. Cuenta si además dio una vuelta hace poco (su latido).
    if (latidoFresco(d) && sesionesVivas(d).some((s) => esElCartero(s.name))) out.add(resolver(d).toLowerCase());
  }
  return out;
}

const latidoDe = (d) => path.join(LATIDOS, `${crypto.createHash('sha256').update(resolver(d).toLowerCase()).digest('hex').slice(0, 16)}.json`);
/** Lo anota cada vuelta de un Runner: «en esta carpeta hay un Runner dando vueltas». */
const latir = (d) => escribirJson(latidoDe(d), { dir: rotuloDir(d), at: new Date().toISOString(), pid: DUENO });
function latidoFresco(d) {
  const l = leerJson(latidoDe(d), null);
  const t = l ? Date.parse(l.at) : NaN;
  return Number.isFinite(t) && Date.now() - t < LATIDO_VENCE_MS;
}

/** La sesión que corre esto, si está registrada en su carpeta (CLAUDE_PID). */
function sesionPropia(propio, env = process.env) {
  const pid = Number(env.CLAUDE_PID);
  if (!Number.isInteger(pid) || pid <= 0) return null;
  return leerJson(path.join(resolver(propio), 'sessions', `${pid}.json`), null);
}

/** `ciclo` y `pendientes` toman lo del buzón para mandarlo: si los corre un chat que NO es el Runner (uno que lo prueba,
 *  o uno cualquiera), se quedaría con trabajos que nunca manda. Si la sesión se sabe y tiene otro nombre, no corre. */
function exigirRunner(propio) {
  const s = sesionPropia(propio);
  const nombre = typeof s?.name === 'string' ? s.name.trim() : '';
  if (nombre && !esElCartero(nombre)) {
    throw new Error(`este chat («${nombre}») no es el Runner: lo del buzón lo manda el chat Runner (claudeN -n Runner)`);
  }
}

/** Marca vivos los chats de la app, y suma las sesiones de terminal vivas (fuente `cli`). Cada chat vivo lleva
 *  su carpeta (`dir`): es la única desde la que SendMessage le llega. */
function leerRegistro(cuenta, configDir, fuente, cwds, chats) {
  const dir = resolver(configDir);
  for (const s of sesionesVivas(configDir)) {
    const estado = s.status === 'busy' || s.status === 'idle' ? s.status : null;
    if (fuente === 'app') {
      const c = s.hostSessionId ? chats.get(s.hostSessionId) : null;
      if (c) Object.assign(c, { vivo: true, estado, pipe: s.messagingSocketPath, dir });
    } else if (UUID_RE.test(s.sessionId ?? '') && enCwds(s.cwd, cwds) && s.entrypoint !== 'claude-desktop'
      && (s.kind == null || s.kind === 'interactive')) {
      const local = `cli_${s.sessionId}`;
      chats.set(local, {
        ...(esElCartero(s.name) ? { esRunner: true } : {}),
        local, titulo: String(s.name || `${path.basename(String(s.cwd || ''))} · ${s.sessionId.slice(0, 8)}`).slice(0, 120),
        cuenta, vivo: true, estado, pipe: s.messagingSocketPath, dir,
        actividad: s.updatedAt ? new Date(s.updatedAt).toISOString() : null,
        transcript: path.join(dir, 'projects', carpetaDelCwd(s.cwd), `${s.sessionId}.jsonl`),
      });
    }
  }
}

function fuentesDeLaCuenta(cfg, cuenta) {
  const fuentes = fuentesDe(cfg.carteros?.[cuenta]);
  if (!fuentes.length) throw new Error(`la cuenta ${cuenta} no tiene de dónde sacar chats: node cartero.mjs cartero ${cuenta} app|cli <dir>`);
  return fuentes;
}

/** Los chats de una cuenta, de todas sus fuentes. `runner` = hay un Runner abierto en la carpeta del chat (sin él,
 *  nadie le puede entregar: la pantalla lo dice, y MaKo no reclama lo suyo). */
function verChats(cuenta, cfg = config(), runners = carpetasConRunner(cfg, dirPropio(cfg))) {
  const fuentes = fuentesDeLaCuenta(cfg, cuenta);
  const cwds = Array.isArray(cfg.cwds) && cfg.cwds.length ? cfg.cwds : CWDS_DEFAULT;
  const chats = new Map();
  if (fuentes.some((f) => f.fuente === 'app')) for (const [k, c] of chatsDeLaApp(cuenta, cwds, cfg.carpetas ?? {})) chats.set(k, { ...c, dir: null });
  for (const f of fuentes) leerRegistro(cuenta, f.configDir, f.fuente, cwds, chats);
  for (const c of chats.values()) c.runner = c.vivo && c.dir ? runners.has(c.dir.toLowerCase()) : null;
  return chats;
}

// ── el mensaje que recibe el chat ────────────────────────────────────────────────────────────
function mensaje(p, rutas = []) {
  const fecha = new Date(p.creado).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const alcance = p.alcance === 'de_ahora_en_mas'
    ? 'Y DE AHORA EN MÁS: además de hacerlo, dejá la regla escrita donde corresponda (AGENTS.md, una memoria o un hallazgo) y decí dónde en el cierre.'
    : 'Sólo esto.';
  return [
    `Pedido de Martín desde el Centro de Operaciones (firmado en su dispositivo, ${fecha}).`,
    '',
    p.texto,
    '',
    // Las fotos y los PDF que mandó con el trabajo, ya en esta PC (1.9.0): el chat los abre con Read.
    ...(rutas.length ? ['Adjuntos (los bajó el Runner a esta PC; ábrelos con Read):', ...rutas.map((r) => `- ${r}`), ''] : []),
    `— Alcance: ${alcance}`,
    '— Al terminar, dejá el cierre en cuatro renglones (y la prueba, si la hay: un commit, un deploy, una medición):',
    `node "${ESTE}" cierre ${p.id} --decidido "…" --hecho "…" --comprobado "…" --sigue "…" --prueba "…"`,
    '— Si dejaste algo para mirar en MaKo, sumá --revisar con su ruta (por ejemplo --revisar "/crm?lead=12"): Martín lo revisa desde el Centro.',
  ].join('\n');
}

/** El aviso de una respuesta de la Ticketera. Lo único que viene de MaKo es el `ref`, validado. */
export function mensajeAviso(ref, repo) {
  if (!REF_DECISION.test(ref)) throw new Error('ref inválido');
  return [
    `Martín contestó tu tarjeta «${ref}» en la Ticketera (te avisa el Centro de Operaciones).`,
    '',
    'Para leer la respuesta, desde el clon:',
    `cd "${repo}" && node --import tsx scripts/decisiones.ts contestadas ${ref}`,
    '',
    `Cuando la tengas, márcala como recogida: node --import tsx scripts/decisiones.ts recoger ${ref}`,
  ].join('\n');
}

// ── la vuelta ────────────────────────────────────────────────────────────────────────────────
function listar(dir) {
  try { return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => path.join(dir, f)); } catch { return []; }
}

async function ciclo(cuenta, cfg = config(), propio = dirPropio(cfg), runners = carpetasConRunner(cfg, propio)) {
  if (!cfg.token) throw new Error('falta el token: node cartero.mjs token <mkop_…>');
  const url = (cfg.url || 'https://hola-mako.com').replace(/\/$/, '');
  const spkis = claves();
  const viejo = new Set(leerJson(LEDGER, []));
  const yaSalio = (id) => viejo.has(id) || fs.existsSync(path.join(ENTREGADOS, id));
  const chats = verChats(cuenta, cfg, runners);
  const BUZON = buzonDe(cuenta);
  const ACUSES = acusesDe(cuenta);

  // Lo que quedó en el buzón sin acuse demasiado tiempo: no se sabe si salió. Se dice así. Recorre los buzones de
  // TODAS las cuentas, no sólo el de la vuelta: cada Runner da la vuelta por las cuentas de su carpeta, y lo de una
  // cuenta cuyo Runner se cerró no lo vencería nadie (quedaría «entregando» para siempre).
  for (const c of cuentasConBuzon()) {
    for (const f of listar(buzonDe(c))) {
      const b = leerJson(f, null);
      if (b && Date.now() - Date.parse(b.reclamado) > BUZON_VENCE_MS && !fs.existsSync(path.join(acusesDe(c), `${b.id}.json`))) {
        const tomado = fs.existsSync(manoDe(f));
        escribirJson(path.join(acusesDe(c), `${b.id}.json`), {
          id: b.id, estado: 'incierto',
          motivo: tomado ? 'El Runner no confirmó si le llegó: míralo en el chat' : 'Se cerró el Runner de esa terminal: ábrelo y vuelve a mandarlo',
        });
        fs.rmSync(f, { force: true });
        fs.rmSync(manoDe(f), { force: true });
      }
    }
  }

  // Los acuses de TODAS las cuentas, y los cierres (que son de la PC). Juntos, porque MaKo aplica un cierre sólo
  // sobre un pedido ENTREGADO: si un Runner subiera los cierres sin el acuse que está en el buzón de otra cuenta, el
  // cierre no entraría (MaKo aplica cada acuse por su id, sin mirar la cuenta: subirlos en cualquier vuelta es seguro).
  const archivosAcuse = cuentasConBuzon().flatMap((c) => listar(acusesDe(c)));
  const acuses = archivosAcuse.map((f) => leerJson(f, null)).filter(Boolean);
  const archivosCierre = listar(CIERRES);
  const cierres = archivosCierre.map((f) => leerJson(f, null)).filter(Boolean);
  // Lo que ALGÚN Runner de la PC puede entregar: el chat vivo, con un Runner abierto en su carpeta. MaKo reclama
  // sólo eso; lo demás queda escrito y sale cuando se abra ese Runner (no se vence en el buzón).
  const entregables = [...chats.values()].filter((c) => c.vivo && c.pipe && c.runner && !c.esRunner).map((c) => c.local);
  // Lo que se dijo en cada chat desde la vuelta anterior (sólo lo nuevo). Lo del Runner no: son sus vueltas.
  const { turnos, marcas } = turnosDeLaVuelta([...chats.values()].filter((c) => !c.esRunner));
  // Los chats de la nube que anotó el Runner de la app (no tienen canal ni transcript en esta PC: sólo se ven).
  const enNube = leerNube(cuenta).map((n) => ({ local: n.id, titulo: n.titulo, cuenta, vivo: false, estado: null, actividad: null, nube: true }));
  const r = await fetch(`${url}/api/operaciones/cartero`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.token}` },
    body: JSON.stringify({
      cuenta, version: VERSION,
      // Ni la dirección del canal, ni la carpeta, ni dónde está el transcript salen de la PC.
      chats: [...[...chats.values()].map(({ pipe, dir, transcript, ...c }) => c), ...enNube],
      entregables, claves: spkis.map(claveId), acuses, cierres, uso: cuotaDe(cuenta), turnos,
      // Las cuentas en las que esta PC abre chats (1.11.0): MaKo le da un trabajo «nuevo» sólo a quien lo declara.
      abre: puedeAbrir(cfg, cuenta) ? [cuenta] : [],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const salida = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`MaKo contestó ${r.status}: ${salida.error ?? 'sin detalle'}`);

  // Lo que se subió ya está en MaKo: se borra de acá (sólo lo que se listó ANTES de subir).
  for (const f of archivosAcuse) fs.rmSync(f, { force: true });
  // Los turnos: la marca avanza sólo si MaKo los guardó (un servidor de antes no dice nada: los ignora igual).
  if (salida.turnosOk !== false) guardarMarcas(marcas);
  // Un cierre se borra cuando MaKo dice que lo aplicó (`cierresIds`). El que no entró (su acuse todavía no llegó, o
  // un servidor de antes que no dice cuáles) se vuelve a subir en la vuelta siguiente, hasta un día.
  const aplicados = new Set(Array.isArray(salida.cierresIds) ? salida.cierresIds : []);
  for (const f of archivosCierre) {
    const c = leerJson(f, null);
    let edad = 0;
    try { edad = Date.now() - fs.statSync(f).mtimeMs; } catch { continue; }
    if (c && aplicados.has(c.id)) fs.rmSync(f, { force: true });
    else if (edad > CIERRE_VENCE_MS) { fs.rmSync(f, { force: true }); log(`CIERRE ${c?.id ?? path.basename(f)} no entró en un día: se descarta`); }
  }

  const ahora = Date.now();
  const rechazarId = (id, motivo) => {
    escribirJson(path.join(ACUSES, `${id}.json`), { id, estado: 'no_entregado', motivo });
    log(`[${cuenta}] RECHAZO ${id}: ${motivo}`);
  };
  for (const { id, firmado, firma } of salida.pedidos ?? []) {
    if (typeof id !== 'string' || !UUID_RE.test(id)) { log(`[${cuenta}] pedido con id inválido`); continue; }
    const rechazar = (motivo) => rechazarId(id, motivo);
    const quien = quienFirmo(firmado, firma, spkis);
    if (!quien) { rechazar('Pégale tu Token al Runner y vuelve a mandarlo'); continue; }
    const l = leerFirmable(firmado, ahora);
    if (!l.ok) { rechazar(`Vuelve a mandarlo (${l.motivo})`); continue; }
    if (l.p.id !== id) { rechazar('Vuelve a mandarlo: el id no coincide con la firma'); continue; }
    if (yaSalio(id)) { rechazar('Ya se había entregado: no sale dos veces'); continue; }
    // Un chat nuevo (1.11.0): `ciclo` no abre nada; lo deja en la cola, y lo abre `abrir`, que vuelve a verificar todo.
    if (l.p.destino === DESTINO_NUEVO) {
      if (l.p.cuenta !== cuenta || !puedeAbrir(cfg, cuenta)) { rechazar('Prende la apertura de chats en la PC: pídeselo al Runner'); continue; }
      escribirJson(path.join(APERTURAS, `${id}.json`), { id, cuenta, firmado, firma, reclamado: new Date().toISOString() });
      log(`[${cuenta}] APERTURA ${id} → «${l.p.titulo}»`);
      continue;
    }
    const chat = chats.get(l.p.destino);
    if (!chat?.vivo || !chat.pipe) { rechazar('El chat se cerró: ábrelo y vuelve a mandarlo'); continue; }
    if (chat.esRunner) { rechazar('Al Runner no se le escribe: elige otro chat'); continue; }
    let rutas = [];
    if (l.p.adjuntos) {
      try { rutas = await bajarAdjuntos(url, cfg.token, id, l.p.adjuntos); } catch (e) { rechazar(`No pude bajar un adjunto (${e.message}): vuelve a mandarlo`); continue; }
    }
    escribirJson(path.join(BUZON, `${id}.json`), {
      id, reclamado: new Date().toISOString(), clave: quien, dir: chat.dir,
      to: `uds:${chat.pipe}`, titulo: chat.titulo, mensaje: mensaje(l.p, rutas),
      ...comoCorre(l.p),
    });
    log(`[${cuenta}] BUZON ${id} → ${chat.titulo} (${rotuloDir(chat.dir)})`);
  }

  // Los avisos de la Ticketera: el texto se arma acá; de lo que mande MaKo sólo se usan el id, el
  // ref y el destino, y los tres se validan antes de tocar el buzón.
  const repo = expandir(cfg.repo || REPO_DEFAULT);
  let avisos = 0;
  for (const a of salida.avisos ?? []) {
    const id = a?.id;
    if (typeof id !== 'string' || !UUID_RE.test(id)) { log(`[${cuenta}] aviso con id inválido`); continue; }
    if (typeof a.ref !== 'string' || !REF_DECISION.test(a.ref)) { rechazarId(id, 'Aviso con una referencia inválida'); continue; }
    if (typeof a.destino !== 'string' || !DESTINO_RE.test(a.destino)) { rechazarId(id, 'Aviso con un destino inválido'); continue; }
    if (yaSalio(id)) { rechazarId(id, 'Ya se había entregado: no sale dos veces'); continue; }
    const chat = chats.get(a.destino);
    if (!chat?.vivo || !chat.pipe || chat.esRunner) { rechazarId(id, 'El chat se cerró antes de avisar'); continue; }
    escribirJson(path.join(BUZON, `${id}.json`), {
      id, tipo: 'aviso', reclamado: new Date().toISOString(), clave: null, dir: chat.dir,
      to: `uds:${chat.pipe}`, titulo: chat.titulo, mensaje: mensajeAviso(a.ref, repo),
    });
    avisos++;
    log(`[${cuenta}] AVISO ${id} (${a.ref}) → ${chat.titulo}`);
  }
  if (salida.avisosError) log(`[${cuenta}] los avisos de la Ticketera no se pudieron calcular: ${salida.avisosError}`);
  limpiarAdjuntos();
  limpiarAperturas();
  return {
    vencidos: salida.vencidos ?? 0, acuses: salida.acuses ?? 0, cierres: salida.cierres ?? 0,
    avisos, avisosError: salida.avisosError ?? null,
  };
}

// ── el Uso de cada cuenta ────────────────────────────────────────────────────────────────────
/**
 * La cuota que trae la barra de estado de Claude Code por stdin (medido en el CLI 2.1.299, 16/10/2026):
 * `rate_limits.five_hour` y `rate_limits.seven_day`, con `used_percentage` y `resets_at` en SEGUNDOS unix. La misma
 * lectura que lib/centro-uso.ts → cuotaDeBarraDeEstado: el test diferencial compara las dos.
 */
export function cuotaDeBarraDeEstado(x, ahora) {
  const rl = x && typeof x === 'object' ? x.rate_limits : null;
  if (!rl || typeof rl !== 'object') return null;
  const v = (w) => {
    if (!w || typeof w.used_percentage !== 'number' || !Number.isFinite(w.used_percentage)) return null;
    const s = typeof w.resets_at === 'number' && Number.isFinite(w.resets_at) ? new Date(w.resets_at * 1000).toISOString() : null;
    return { pct: Math.min(100, Math.max(0, Math.round(w.used_percentage))), reinicia: s };
  };
  const cinco = v(rl.five_hour);
  const semana = v(rl.seven_day);
  return cinco || semana ? { cinco, semana, medido: new Date(ahora).toISOString() } : null;
}

/** La cuenta de la TERMINAL de una carpeta: la que tiene su fuente `cli` ahí (la app no tiene barra de estado). */
const cuentaDeLaTerminal = (cfg, dir) => Object.keys(cfg.carteros ?? {})
  .find((c) => CUENTA_RE.test(c) && fuentesDe(cfg.carteros[c]).some((f) => f.fuente === 'cli' && mismoDir(f.configDir, dir))) ?? null;

const leerStdin = () => new Promise((ok) => {
  let b = '';
  if (process.stdin.isTTY) { ok(''); return; }
  const fin = setTimeout(() => ok(b), 1500);
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (d) => { b += d; }).on('end', () => { clearTimeout(fin); ok(b); });
});

/** La barra de estado del Runner: anota la cuota de su cuenta y devuelve la línea que se ve («Runner · 5 h 12% · semana 47%»). */
async function uso() {
  let o = null;
  try { o = JSON.parse(await leerStdin()); } catch { /* sin entrada, la línea igual */ }
  const cfg = config();
  const cuenta = cuentaDeLaTerminal(cfg, dirPropio(cfg));
  const c = cuotaDeBarraDeEstado(o, Date.now());
  if (cuenta && c) {
    // ⚠️ `medido` es cuándo la cuota CAMBIÓ, no cuándo corrió la barra (revisión adversarial, 16/10/2026): la barra corre
    // cada minuto aunque no llegue ninguna respuesta de la API, y re-sellar el mismo número como de ahora escondería un
    // Runner que dejó de dar vueltas. Cuenta como observación nueva: otros números, o que la sesión haya hablado con la
    // API (`cost.total_api_duration_ms` crece con cada respuesta; en una sesión nueva vuelve a 0).
    const f = path.join(USO, `${cuenta}.json`);
    const previo = leerJson(f, null);
    const api = Number(o?.cost?.total_api_duration_ms);
    const iguales = previo && JSON.stringify([previo.cinco, previo.semana]) === JSON.stringify([c.cinco, c.semana]);
    const nueva = !iguales || !Number.isFinite(api) || api !== previo.api;
    escribirJson(f, { ...c, medido: nueva ? c.medido : previo.medido, api: Number.isFinite(api) ? api : null });
  }
  const n = cuenta ? `Runner de la cuenta ${cuenta.replace('claude', '')}` : 'Runner';
  return c ? `${n} · 5 h ${c.cinco?.pct ?? '—'}% · semana ${c.semana?.pct ?? '—'}%` : n;
}

/** La cuota que sube la vuelta de una cuenta: la de su barra de estado y, si es más nueva, la semanal que midió la app. */
function cuotaDe(cuenta) {
  let c = leerJson(path.join(USO, `${cuenta}.json`), null);
  if (c) c = { cinco: c.cinco ?? null, semana: c.semana ?? null, medido: c.medido };
  try {
    const [pct, reinicia, medido, de] = sinCR(fs.readFileSync(USO_APP, 'utf8')).trim().split(/\s+/);
    const p = Number(pct);
    const m = Date.parse(medido);
    if (de === cuenta && Number.isFinite(p) && Number.isFinite(m) && (!c || m > Date.parse(c.medido))) {
      // ⚠️ El 4º campo lo escribe un chat con el marcador de cuenta, que puede estar atrasado (pasó el 15/10): si el reinicio
      // de la semana no es el que vio la terminal de esta cuenta, esa medición es de OTRA cuenta y no se usa.
      const rApp = Date.parse(reinicia);
      const rTerm = Date.parse(c?.semana?.reinicia ?? '');
      const otra = Number.isFinite(rApp) && Number.isFinite(rTerm) && rTerm > m && Math.abs(rApp - rTerm) > 5 * 60_000;
      if (otra) log(`[${cuenta}] la semanal de la app no es de esta cuenta (se reinicia ${reinicia}, la terminal dice ${c.semana.reinicia})`);
      else {
        // La de 5 horas de la terminal se queda sólo si se midió casi a la vez: si no, es vieja y saldría como de ahora.
        const cincoVale = c?.cinco && m - Date.parse(c.medido) <= 30 * 60_000;
        c = { cinco: cincoVale ? c.cinco : null, semana: { pct: Math.round(p), reinicia: Number.isFinite(rApp) ? reinicia : null }, medido };
      }
    }
  } catch { /* la app no midió: queda la de la terminal */ }
  return c;
}

// ── quién entrega qué ────────────────────────────────────────────────────────────────────────
/** La marca de «lo tiene este Runner», al lado de lo del buzón. */
const manoDe = (f) => f.replace(/\.json$/, '.mano');
/** Quién es este Runner: el pid de su sesión, que es el mismo en cada comando que corre (el de `node` cambia). */
const DUENO = String(process.env.CLAUDE_PID || process.env.CLAUDE_CODE_SESSION_ID || `pid:${process.ppid}`);

/** ¿Lo manda este Runner? Dos Runners en la MISMA carpeta (la app y la terminal de la cuenta 1 comparten
 *  ~/.claude) verían lo mismo: el primero que lo lista se lo queda (crear la marca con `wx` es atómico).
 *  ⚠️ Si el que lo tenía se cerró sin acusarlo, NO se vuelve a mandar: no se sabe si alcanzó a hacerlo, y un pedido
 *  sale una vez. Se dice «no sé si llegó» y Martín decide. */
function tomar(f) {
  const mano = manoDe(f);
  try {
    fs.writeFileSync(mano, DUENO, { flag: 'wx' });
    // Lo pudieron acusar entre que se listó y se marcó (el acuse borra primero lo del buzón): entonces ya salió.
    if (!fs.existsSync(f)) { fs.rmSync(mano, { force: true }); return false; }
    return true;
  } catch { /* ya lo tiene alguien */ }
  let dueno = '';
  try { dueno = fs.readFileSync(mano, 'utf8').trim(); } catch { return false; }
  if (dueno === DUENO) return fs.existsSync(f);
  if (/^\d+$/.test(dueno) && !vive(Number(dueno))) {
    const b = leerJson(f, null);
    if (b && UUID_RE.test(b.id ?? '')) {
      escribirJson(path.join(path.dirname(path.dirname(f)), 'acuses', `${b.id}.json`), {
        id: b.id, estado: 'incierto', motivo: 'El Runner se cerró a mitad de la entrega: míralo en el chat',
      });
      log(`INCIERTO ${b.id}: su Runner (${dueno}) se cerró sin acusarlo`);
    }
    fs.rmSync(f, { force: true });
    fs.rmSync(mano, { force: true });
  }
  return false;
}

/** Lo del buzón que le toca a ESTE Runner: lo de los chats de su carpeta (lo de antes de la 1.4.0 no dice
 *  carpeta: era de la app, ~/.claude), y que no tenga otro Runner. Sin cuenta, de todas. */
function pendientes(cuenta, propio = dirPropio()) {
  const cuentas = cuenta ? [cuenta] : cuentasConBuzon();
  return cuentas.flatMap((c) => listar(buzonDe(c)).map((f) => ({ f, b: leerJson(f, null) })))
    .filter(({ b }) => b && mismoDir(b.dir || '~/.claude', propio))
    .sort((x, y) => x.b.reclamado.localeCompare(y.b.reclamado))
    .filter(({ f }) => tomar(f))
    .map(({ b: { id, to, titulo, mensaje, sesion, modelo, esfuerzo } }) => ({ id, to, titulo, mensaje, ...(sesion ? { sesion, modelo, esfuerzo } : {}) }));
}

function acuse(cuenta, id, resultado, motivo) {
  if (!UUID_RE.test(id ?? '')) throw new Error('id inválido');
  // Sin cuenta, se busca en todos los buzones: el id es único.
  const c = cuenta || cuentasConBuzon().find((x) => fs.existsSync(path.join(buzonDe(x), `${id}.json`)));
  const b = c ? path.join(buzonDe(c), `${id}.json`) : null;
  if (!b || !fs.existsSync(b)) throw new Error('ese pedido no está en el buzón');
  const ok = resultado === 'ok';
  escribirJson(path.join(acusesDe(c), `${id}.json`), { id, estado: ok ? 'entregado' : 'no_entregado', motivo: ok ? null : (motivo || 'No le llegó: vuelve a mandarlo') });
  if (ok) { fs.mkdirSync(ENTREGADOS, { recursive: true }); fs.writeFileSync(path.join(ENTREGADOS, id), ''); }
  // Primero lo del buzón y después la marca: un Runner gemelo que crea la marca entre medio ve que ya no está.
  fs.rmSync(b, { force: true });
  fs.rmSync(manoDe(b), { force: true });
  log(`[${c}] ACUSE ${id} ${ok ? 'ok' : `error: ${motivo}`}`);
}

/** Una vuelta de ESTE Runner: por cada cuenta con una fuente en su carpeta (o la que se le pida), y después lo
 *  que le toca entregar. Si una cuenta falla, las otras siguen. */
async function vuelta(cuenta) {
  const cfg = config();
  const propio = dirPropio(cfg);
  exigirRunner(propio);
  latir(propio);
  const runners = carpetasConRunner(cfg, propio);
  const cuentas = cuenta ? [cuenta] : cuentasDeLaCarpeta(cfg, propio);
  if (!cuentas.length) {
    throw new Error(`esta carpeta (${rotuloDir(propio)}) no es de ninguna cuenta: node cartero.mjs cartero <claudeN> cli ${rotuloDir(propio)}`);
  }
  if (cuenta) return { ...(await ciclo(cuenta, cfg, propio, runners)), entregar: pendientes(cuenta, propio), aperturas: listar(APERTURAS).length };
  const porCuenta = {};
  for (const c of cuentas) {
    try { porCuenta[c] = await ciclo(c, cfg, propio, runners); } catch (e) { porCuenta[c] = { error: e.message }; log(`[${c}] CICLO falló: ${e.message}`); }
  }
  return { carpeta: rotuloDir(propio), cuentas: porCuenta, entregar: pendientes(null, propio), aperturas: listar(APERTURAS).length };
}

function cierre(id, args) {
  if (!UUID_RE.test(id ?? '')) throw new Error('id inválido');
  const v = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? String(args[i + 1]).slice(0, 600) : ''; };
  const c = { decidido: v('decidido'), hecho: v('hecho'), comprobado: v('comprobado'), sigue: v('sigue'), prueba: v('prueba') || null };
  if (!c.hecho && !c.decidido) throw new Error('el cierre necesita al menos --hecho o --decidido');
  // La página de MaKo donde Martín mira lo que hiciste (la sub-tab «Review» del Centro). Sólo una ruta interna: lo
  // demás se rechaza acá, y el servidor lo vuelve a sanear (lib/operaciones-reglas.ts → rutaParaRevisar).
  const revisar = v('revisar');
  if (revisar) {
    if (!/^\/(?![/\\])\S{0,299}$/.test(revisar)) throw new Error('--revisar es una ruta de MaKo que empieza con /, como /crm?lead=12');
    c.revisar = revisar;
  }
  escribirJson(path.join(CIERRES, `${id}.json`), { id, cierre: c });
  log(`CIERRE ${id}`);
}

const archivoDeEsteModulo = () => path.resolve(decodeURIComponent(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')));

function instalar() {
  fs.mkdirSync(CIERRES, { recursive: true });
  const origen = archivoDeEsteModulo();
  if (origen !== path.resolve(ESTE)) fs.copyFileSync(origen, ESTE);
  if (!fs.existsSync(CFG)) escribirJson(CFG, { url: 'https://hola-mako.com', token: '', cwds: CWDS_DEFAULT, carteros: {}, carpetas: {} });
  // La barra de estado del Runner (se le pasa con `--settings`, lib/runner.ts): anota la cuota de su cuenta cada minuto.
  escribirJson(AJUSTES_RUNNER, { statusLine: { type: 'command', command: `node "${ESTE.split(path.sep).join('/')}" uso`, refreshInterval: 60 } });
  return { dir: DIR, version: VERSION };
}

function estado(cuenta) {
  const cfg = config();
  const base = {
    version: VERSION, dir: DIR, url: cfg.url ?? null,
    token: cfg.token ? `…${String(cfg.token).slice(-4)}` : null,
    claves: claves().map(claveId), carteros: cfg.carteros ?? {}, carpetas: cfg.carpetas ?? {},
  };
  // En qué carpeta corre este Runner, por qué cuentas da la vuelta y en qué carpetas hay un Runner abierto.
  const propio = dirPropio(cfg);
  const runners = carpetasConRunner(cfg, propio);
  Object.assign(base, {
    carpeta: rotuloDir(propio), cuentasDeLaCarpeta: cuentasDeLaCarpeta(cfg, propio),
    carpetasConRunner: carpetasDe(cfg).filter((d) => runners.has(resolver(d).toLowerCase())).map(rotuloDir),
  });
  if (!cuenta) return base;
  const chats = [...verChats(cuenta, cfg, runners).values()];
  return {
    ...base, cuenta, chats: chats.length,
    vivos: chats.filter((c) => c.vivo).map((c) => `${c.titulo} (${rotuloDir(c.dir)}${c.runner ? '' : ', sin Runner'})`),
    buzon: listar(buzonDe(cuenta)).length, acuses: listar(acusesDe(cuenta)).length, cierres: listar(CIERRES).length,
  };
}

async function esperar(cuenta, maxSeg) {
  const fin = Date.now() + maxSeg * 1000;
  while (Date.now() < fin) {
    let p = [];
    try { p = (await vuelta(cuenta)).entregar; } catch (e) { log(`[${cuenta ?? 'carpeta'}] ESPERAR: el ciclo falló: ${e.message}`); }
    if (p.length) {
      process.stderr.write(`Hay ${p.length} pedido(s) o aviso(s) para entregar. Corré: node "${ESTE}" pendientes${cuenta ? ` --cuenta ${cuenta}` : ''}\n`);
      process.exit(2);
    }
    await new Promise((r) => setTimeout(r, 15_000));
  }
  process.stderr.write(`Sin pedidos en ${maxSeg} s. Terminá el turno sin hacer nada.\n`);
  process.exit(2);
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────
const esMain = (() => { try { return path.resolve(process.argv[1] ?? '') === archivoDeEsteModulo(); } catch { return false; } })();

if (esMain) {
  const todos = process.argv.slice(2);
  const iC = todos.indexOf('--cuenta');
  const cuenta = iC >= 0 ? todos[iC + 1] : process.env.CARTERO_CUENTA;
  const args = iC >= 0 ? todos.filter((_, i) => i !== iC && i !== iC + 1) : todos;
  const [cmd, ...resto] = args;
  const cuentaOpcional = () => { if (cuenta == null || cuenta === '') return null; if (!CUENTA_RE.test(cuenta)) throw new Error('la cuenta es claudeN'); return cuenta; };
  const imprimir = (v) => process.stdout.write(JSON.stringify(v, null, 2) + '\n');
  try {
    switch (cmd) {
      case 'instalar': imprimir(instalar()); break;
      case 'url': escribirJson(CFG, { ...config(), url: resto[0] }); imprimir({ ok: true }); break;
      case 'token':
        if (!/^mkop_[A-Za-z0-9_-]{20,}$/.test(resto[0] ?? '')) throw new Error('el token empieza con mkop_');
        escribirJson(CFG, { ...config(), token: resto[0] }); imprimir({ ok: true, token: `…${resto[0].slice(-4)}` }); break;
      case 'clave': {
        const spki = (resto[0] ?? '').trim();
        crypto.createPublicKey({ key: Buffer.from(spki, 'base64'), format: 'der', type: 'spki' }); // tira si no es una clave
        const todas = new Set(claves()); todas.add(spki);
        fs.mkdirSync(DIR, { recursive: true });
        fs.writeFileSync(CLAVES, [...todas].join('\n') + '\n');
        imprimir({ ok: true, clave: claveId(spki) }); break;
      }
      case 'cartero': {
        const [c, fuente, dir] = resto;
        if (!CUENTA_RE.test(c ?? '') || (fuente !== 'app' && fuente !== 'cli') || !dir) throw new Error('uso: cartero <claudeN> app|cli <dir>');
        const cfg = config();
        // Se SUMA a las que ya tiene (la app y la terminal de una cuenta conviven); repetida no se duplica.
        const fuentes = fuentesDe({ fuentes: [...fuentesDe(cfg.carteros?.[c]), { fuente, configDir: dir }] });
        escribirJson(CFG, { ...cfg, carteros: { ...(cfg.carteros ?? {}), [c]: { fuentes } } });
        imprimir({ ok: true, fuentes }); break;
      }
      case 'carpeta': {
        if (!CUENTA_RE.test(resto[1] ?? '')) throw new Error('uso: carpeta <uuid> <claudeN>');
        const cfg = config();
        escribirJson(CFG, { ...cfg, carpetas: { ...(cfg.carpetas ?? {}), [resto[0]]: resto[1] } });
        imprimir({ ok: true }); break;
      }
      case 'repo': {
        const dir = expandir(resto[0] ?? '');
        if (!dir || !fs.existsSync(path.join(dir, 'scripts', 'decisiones.ts'))) throw new Error('uso: repo <ruta del clon> (la que tiene scripts/decisiones.ts)');
        escribirJson(CFG, { ...config(), repo: dir }); imprimir({ ok: true, repo: dir }); break;
      }
      case 'estado': imprimir(estado(cuenta && CUENTA_RE.test(cuenta) ? cuenta : null)); break;
      // Sin --cuenta: por todas las de la carpeta de este Runner (1.4.0).
      case 'ciclo': imprimir(await vuelta(cuentaOpcional())); break;
      case 'pendientes': { const propio = dirPropio(); exigirRunner(propio); imprimir(pendientes(cuentaOpcional(), propio)); break; }
      case 'acuse': acuse(cuentaOpcional(), resto[0], resto[1], resto.slice(2).join(' ')); imprimir({ ok: true }); break;
      case 'cierre': cierre(resto[0], resto.slice(1)); imprimir({ ok: true }); break;
      case 'abrir': imprimir(abrir()); break;
      // El permiso local para abrir chats desde MaKo: lo prende Martín, una vez, pidiéndoselo al Runner.
      case 'abrir-permitir': {
        const prendido = resto[0] !== 'off';
        escribirJson(CFG, { ...config(), abrir: prendido });
        imprimir({ ok: true, abrir: prendido }); break;
      }
      case 'nube': {
        const cfg = config();
        const c = cuentaOpcional() ?? cuentaDeLaApp(cfg, dirPropio(cfg));
        if (!c) throw new Error('esta carpeta no tiene la app de ninguna cuenta: nube --cuenta claudeN <id> <título> …');
        imprimir({ ok: true, cuenta: c, chats: anotarNube(c, resto) }); break;
      }
      case 'uso': process.stdout.write(`${await uso()}\n`); break;
      case 'esperar': { const i = resto.indexOf('--max-seg'); await esperar(cuentaOpcional(), i >= 0 ? Number(resto[i + 1]) || 3000 : 3000); break; }
      default:
        process.stderr.write('comandos: instalar | url | token | clave | cartero | carpeta | repo | estado | ciclo | pendientes | acuse | cierre | nube | abrir | abrir-permitir | esperar | uso\n');
        process.exit(1);
    }
  } catch (e) {
    log(`ERROR ${cmd}: ${e.message}`);
    process.stderr.write(`${e.message}\n`);
    process.exit(1);
  }
}
