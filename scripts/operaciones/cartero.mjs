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
//   cierre <id> --hecho "…" [--decidido "…"] [--comprobado "…"] [--sigue "…"] [--prueba "…"]
//                                  lo corre el CHAT QUE RECIBIÓ el pedido, al terminarlo
//   esperar [cuenta] [--max-seg N] (opción C, a probar) espera hasta que haya algo y sale con 2
//   uso                            lo corre la BARRA DE ESTADO del Runner (runner-settings.json): anota la cuota de
//                                  la cuenta de su terminal y escribe la línea de la barra
// =============================================================================

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

export const VERSION = '1.5.0';
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
const MAX_TEXTO = 8000;
const VENCE_DIAS = 14;
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
  if (typeof o.destino !== 'string' || !DESTINO_RE.test(o.destino)) return { ok: false, motivo: 'destino inválido' };
  if (o.cuenta !== null && (typeof o.cuenta !== 'string' || !CUENTA_RE.test(o.cuenta))) return { ok: false, motivo: 'cuenta inválida' };
  if (o.titulo !== null && typeof o.titulo !== 'string') return { ok: false, motivo: 'título inválido' };
  if (o.alcance !== 'solo_esto' && o.alcance !== 'de_ahora_en_mas') return { ok: false, motivo: 'alcance inválido' };
  const creado = typeof o.creado === 'string' ? Date.parse(o.creado) : NaN;
  const vence = typeof o.vence === 'string' ? Date.parse(o.vence) : NaN;
  if (!Number.isFinite(creado) || !Number.isFinite(vence)) return { ok: false, motivo: 'fechas inválidas' };
  if (vence <= creado || vence - creado > (VENCE_DIAS + 1) * 86_400_000) return { ok: false, motivo: 'vencimiento inválido' };
  if (creado > ahora + 60_000) return { ok: false, motivo: 'fecha en el futuro' };
  if (vence <= ahora) return { ok: false, motivo: 'venció' };
  return { ok: true, p: o };
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
          if (!o || o.isArchived || !DESTINO_RE.test(o.sessionId ?? '') || !enCwds(o.cwd, cwds) || esElCartero(o.title)) continue;
          out.set(o.sessionId, {
            local: o.sessionId, titulo: String(o.title || '(sin título)').slice(0, 120), cuenta,
            vivo: false, estado: null, pipe: null,
            actividad: o.lastActivityAt ? new Date(o.lastActivityAt).toISOString() : null,
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
      && (s.kind == null || s.kind === 'interactive') && !esElCartero(s.name)) {
      const local = `cli_${s.sessionId}`;
      chats.set(local, {
        local, titulo: String(s.name || `${path.basename(String(s.cwd || ''))} · ${s.sessionId.slice(0, 8)}`).slice(0, 120),
        cuenta, vivo: true, estado, pipe: s.messagingSocketPath, dir,
        actividad: s.updatedAt ? new Date(s.updatedAt).toISOString() : null,
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
function mensaje(p) {
  const fecha = new Date(p.creado).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const alcance = p.alcance === 'de_ahora_en_mas'
    ? 'Y DE AHORA EN MÁS: además de hacerlo, dejá la regla escrita donde corresponda (AGENTS.md, una memoria o un hallazgo) y decí dónde en el cierre.'
    : 'Sólo esto.';
  return [
    `Pedido de Martín desde el Centro de Operaciones (firmado en su dispositivo, ${fecha}).`,
    '',
    p.texto,
    '',
    `— Alcance: ${alcance}`,
    '— Al terminar, dejá el cierre en cuatro renglones (y la prueba, si la hay: un commit, un deploy, una medición):',
    `node "${ESTE}" cierre ${p.id} --decidido "…" --hecho "…" --comprobado "…" --sigue "…" --prueba "…"`,
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
  const entregables = [...chats.values()].filter((c) => c.vivo && c.pipe && c.runner).map((c) => c.local);
  const r = await fetch(`${url}/api/operaciones/cartero`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.token}` },
    body: JSON.stringify({
      cuenta, version: VERSION,
      // Ni la dirección del canal ni la carpeta salen de la PC.
      chats: [...chats.values()].map(({ pipe, dir, ...c }) => c),
      entregables, claves: spkis.map(claveId), acuses, cierres, uso: cuotaDe(cuenta),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const salida = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`MaKo contestó ${r.status}: ${salida.error ?? 'sin detalle'}`);

  // Lo que se subió ya está en MaKo: se borra de acá (sólo lo que se listó ANTES de subir).
  for (const f of archivosAcuse) fs.rmSync(f, { force: true });
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
    const chat = chats.get(l.p.destino);
    if (!chat?.vivo || !chat.pipe) { rechazar('El chat se cerró: ábrelo y vuelve a mandarlo'); continue; }
    escribirJson(path.join(BUZON, `${id}.json`), {
      id, reclamado: new Date().toISOString(), clave: quien, dir: chat.dir,
      to: `uds:${chat.pipe}`, titulo: chat.titulo, mensaje: mensaje(l.p),
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
    if (!chat?.vivo || !chat.pipe) { rechazarId(id, 'El chat se cerró antes de avisar'); continue; }
    escribirJson(path.join(BUZON, `${id}.json`), {
      id, tipo: 'aviso', reclamado: new Date().toISOString(), clave: null, dir: chat.dir,
      to: `uds:${chat.pipe}`, titulo: chat.titulo, mensaje: mensajeAviso(a.ref, repo),
    });
    avisos++;
    log(`[${cuenta}] AVISO ${id} (${a.ref}) → ${chat.titulo}`);
  }
  if (salida.avisosError) log(`[${cuenta}] los avisos de la Ticketera no se pudieron calcular: ${salida.avisosError}`);
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
    .map(({ b: { id, to, titulo, mensaje } }) => ({ id, to, titulo, mensaje }));
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
  if (cuenta) return { ...(await ciclo(cuenta, cfg, propio, runners)), entregar: pendientes(cuenta, propio) };
  const porCuenta = {};
  for (const c of cuentas) {
    try { porCuenta[c] = await ciclo(c, cfg, propio, runners); } catch (e) { porCuenta[c] = { error: e.message }; log(`[${c}] CICLO falló: ${e.message}`); }
  }
  return { carpeta: rotuloDir(propio), cuentas: porCuenta, entregar: pendientes(null, propio) };
}

function cierre(id, args) {
  if (!UUID_RE.test(id ?? '')) throw new Error('id inválido');
  const v = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? String(args[i + 1]).slice(0, 600) : ''; };
  const c = { decidido: v('decidido'), hecho: v('hecho'), comprobado: v('comprobado'), sigue: v('sigue'), prueba: v('prueba') || null };
  if (!c.hecho && !c.decidido) throw new Error('el cierre necesita al menos --hecho o --decidido');
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
      case 'uso': process.stdout.write(`${await uso()}\n`); break;
      case 'esperar': { const i = resto.indexOf('--max-seg'); await esperar(cuentaOpcional(), i >= 0 ? Number(resto[i + 1]) || 3000 : 3000); break; }
      default:
        process.stderr.write('comandos: instalar | url | token | clave | cartero | carpeta | repo | estado | ciclo | pendientes | acuse | cierre | esperar | uso\n');
        process.exit(1);
    }
  } catch (e) {
    log(`ERROR ${cmd}: ${e.message}`);
    process.stderr.write(`${e.message}\n`);
    process.exit(1);
  }
}
