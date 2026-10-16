#!/usr/bin/env node
// =============================================================================
// cartero.mjs — el cartero del Centro de Operaciones, en la PC de Martín
// =============================================================================
// Lleva a los chats de Claude Code los pedidos que Martín firma en /admin/operaciones. Diseño:
// docs/diseno-centro-de-operaciones.md §2 y §3; lo que costó: docs/hallazgos-operaciones.md.
//
// ⚠️ HAY UN CARTERO POR CUENTA. Las tres cuentas corren a la vez (decisión de Martín, 15/10): una
// en la app de escritorio y las otras en terminal, cada una con su CLAUDE_CONFIG_DIR. Cada
// directorio tiene SU registro de sesiones (`<dir>/sessions/*.json`) y SendMessage funciona adentro
// de una cuenta, así que cada cartero lee el suyo y entrega en el suyo. Se elige con `--cuenta`.
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
//   cartero <claudeN> app|cli <dir>  declara el cartero de una cuenta y su directorio de config
//   carpeta <carpeta> <claudeN>    qué cuenta es cada carpeta de la app (claude-code-sessions)
//   repo <ruta>                    el clon desde el que los chats leen la Ticketera (default: el de
//                                  OneDrive); va en el aviso de una respuesta
//   estado [cuenta]                qué tiene configurado y qué ve
//   ciclo [cuenta]                 una vuelta: sube lo que ve y los acuses; dice qué entregar
//   pendientes [cuenta]            lo que está en el buzón esperando que el chat Cartero lo mande
//   acuse [cuenta] <id> ok | error <motivo>   lo anota el chat Cartero después de cada SendMessage
//   cierre <id> --hecho "…" [--decidido "…"] [--comprobado "…"] [--sigue "…"] [--prueba "…"]
//                                  lo corre el CHAT QUE RECIBIÓ el pedido, al terminarlo
//   esperar [cuenta] [--max-seg N] (opción C, a probar) espera hasta que haya algo y sale con 2
// =============================================================================

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

export const VERSION = '1.3.0';
const HOME = os.homedir();
const DIR = process.env.CARTERO_DIR || path.join(HOME, '.claude', 'operaciones');
const APP = process.env.CARTERO_APP_DIR || path.join(process.env.APPDATA || path.join(HOME, 'AppData', 'Roaming'), 'Claude', 'claude-code-sessions');
const CFG = path.join(DIR, 'config.json');
const CLAVES = path.join(DIR, 'claves.txt');
const LEDGER = path.join(DIR, 'entregados.json');
const CIERRES = path.join(DIR, 'cierres');
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

/** Marca vivos los chats de la app, y suma las sesiones de terminal vivas (fuente `cli`). */
function leerRegistro(cuenta, configDir, fuente, cwds, chats) {
  const dir = path.join(expandir(configDir), 'sessions');
  let archivos = [];
  try { archivos = fs.readdirSync(dir).filter((f) => /^\d+\.json$/.test(f)); } catch { return; }
  for (const f of archivos) {
    const s = leerJson(path.join(dir, f), null);
    if (!s?.messagingSocketPath || !vive(Number(s.pid))) continue;
    const estado = s.status === 'busy' || s.status === 'idle' ? s.status : null;
    if (fuente === 'app') {
      const c = s.hostSessionId ? chats.get(s.hostSessionId) : null;
      if (c) Object.assign(c, { vivo: true, estado, pipe: s.messagingSocketPath });
    } else if (UUID_RE.test(s.sessionId ?? '') && enCwds(s.cwd, cwds) && s.entrypoint !== 'claude-desktop' && !esElCartero(s.name)) {
      const local = `cli_${s.sessionId}`;
      chats.set(local, {
        local, titulo: String(s.name || `${path.basename(String(s.cwd || ''))} · ${s.sessionId.slice(0, 8)}`).slice(0, 120),
        cuenta, vivo: true, estado, pipe: s.messagingSocketPath,
        actividad: s.updatedAt ? new Date(s.updatedAt).toISOString() : null,
      });
    }
  }
}

function carteroDe(cuenta) {
  const cfg = config();
  const k = cfg.carteros?.[cuenta];
  if (!k) throw new Error(`no hay cartero para ${cuenta}: node cartero.mjs cartero ${cuenta} app|cli <dir>`);
  return { cfg, fuente: k.fuente === 'cli' ? 'cli' : 'app', configDir: k.configDir || '~/.claude' };
}

function verChats(cuenta) {
  const { cfg, fuente, configDir } = carteroDe(cuenta);
  const cwds = Array.isArray(cfg.cwds) && cfg.cwds.length ? cfg.cwds : CWDS_DEFAULT;
  const chats = fuente === 'app' ? chatsDeLaApp(cuenta, cwds, cfg.carpetas ?? {}) : new Map();
  leerRegistro(cuenta, configDir, fuente, cwds, chats);
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

async function ciclo(cuenta) {
  const { cfg } = carteroDe(cuenta);
  if (!cfg.token) throw new Error('falta el token: node cartero.mjs token <mkop_…>');
  const url = (cfg.url || 'https://hola-mako.com').replace(/\/$/, '');
  const spkis = claves();
  const ledger = new Set(leerJson(LEDGER, []));
  const chats = verChats(cuenta);
  const BUZON = buzonDe(cuenta);
  const ACUSES = acusesDe(cuenta);

  // Lo que quedó en el buzón sin acuse demasiado tiempo: no se sabe si salió. Se dice así.
  for (const f of listar(BUZON)) {
    const b = leerJson(f, null);
    if (b && Date.now() - Date.parse(b.reclamado) > BUZON_VENCE_MS && !fs.existsSync(path.join(ACUSES, `${b.id}.json`))) {
      escribirJson(path.join(ACUSES, `${b.id}.json`), { id: b.id, estado: 'incierto', motivo: 'El Runner no confirmó si le llegó: míralo en el chat' });
      fs.rmSync(f, { force: true });
    }
  }

  const acuses = listar(ACUSES).map((f) => leerJson(f, null)).filter(Boolean);
  // Los cierres son de la PC, no de una cuenta: los sube el cartero que pase primero.
  const cierres = listar(CIERRES).map((f) => leerJson(f, null)).filter(Boolean);
  const r = await fetch(`${url}/api/operaciones/cartero`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.token}` },
    body: JSON.stringify({
      cuenta, version: VERSION,
      chats: [...chats.values()].map(({ pipe, ...c }) => c),
      claves: spkis.map(claveId), acuses, cierres,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const salida = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`MaKo contestó ${r.status}: ${salida.error ?? 'sin detalle'}`);

  // Lo que se subió ya está en MaKo: se borra de acá.
  for (const a of acuses) fs.rmSync(path.join(ACUSES, `${a.id}.json`), { force: true });
  for (const c of cierres) fs.rmSync(path.join(CIERRES, `${c.id}.json`), { force: true });

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
    if (ledger.has(id)) { rechazar('Ya se había entregado: no sale dos veces'); continue; }
    const chat = chats.get(l.p.destino);
    if (!chat?.vivo || !chat.pipe) { rechazar('El chat se cerró: ábrelo y vuelve a mandarlo'); continue; }
    escribirJson(path.join(BUZON, `${id}.json`), {
      id, reclamado: new Date().toISOString(), clave: quien,
      to: `uds:${chat.pipe}`, titulo: chat.titulo, mensaje: mensaje(l.p),
    });
    log(`[${cuenta}] BUZON ${id} → ${chat.titulo}`);
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
    if (ledger.has(id)) { rechazarId(id, 'Ya se había entregado: no sale dos veces'); continue; }
    const chat = chats.get(a.destino);
    if (!chat?.vivo || !chat.pipe) { rechazarId(id, 'El chat se cerró antes de avisar'); continue; }
    escribirJson(path.join(BUZON, `${id}.json`), {
      id, tipo: 'aviso', reclamado: new Date().toISOString(), clave: null,
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

function pendientes(cuenta) {
  return listar(buzonDe(cuenta)).map((f) => leerJson(f, null)).filter(Boolean)
    .sort((a, b) => a.reclamado.localeCompare(b.reclamado))
    .map(({ id, to, titulo, mensaje }) => ({ id, to, titulo, mensaje }));
}

function acuse(cuenta, id, resultado, motivo) {
  if (!UUID_RE.test(id ?? '')) throw new Error('id inválido');
  const b = path.join(buzonDe(cuenta), `${id}.json`);
  if (!fs.existsSync(b)) throw new Error('ese pedido no está en el buzón');
  const ok = resultado === 'ok';
  escribirJson(path.join(acusesDe(cuenta), `${id}.json`), { id, estado: ok ? 'entregado' : 'no_entregado', motivo: ok ? null : (motivo || 'No le llegó: vuelve a mandarlo') });
  if (ok) { const l = new Set(leerJson(LEDGER, [])); l.add(id); escribirJson(LEDGER, [...l].slice(-5000)); }
  fs.rmSync(b, { force: true });
  log(`[${cuenta}] ACUSE ${id} ${ok ? 'ok' : `error: ${motivo}`}`);
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
  return { dir: DIR, version: VERSION };
}

function estado(cuenta) {
  const cfg = config();
  const base = {
    version: VERSION, dir: DIR, url: cfg.url ?? null,
    token: cfg.token ? `…${String(cfg.token).slice(-4)}` : null,
    claves: claves().map(claveId), carteros: cfg.carteros ?? {}, carpetas: cfg.carpetas ?? {},
  };
  if (!cuenta) return base;
  const chats = [...verChats(cuenta).values()];
  return {
    ...base, cuenta, chats: chats.length,
    vivos: chats.filter((c) => c.vivo).map((c) => c.titulo),
    buzon: listar(buzonDe(cuenta)).length, acuses: listar(acusesDe(cuenta)).length, cierres: listar(CIERRES).length,
  };
}

async function esperar(cuenta, maxSeg) {
  const fin = Date.now() + maxSeg * 1000;
  while (Date.now() < fin) {
    try { await ciclo(cuenta); } catch (e) { log(`[${cuenta}] ESPERAR: el ciclo falló: ${e.message}`); }
    const p = pendientes(cuenta);
    if (p.length) {
      process.stderr.write(`Hay ${p.length} pedido(s) o aviso(s) para entregar. Corré: node "${ESTE}" pendientes --cuenta ${cuenta}\n`);
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
  const conCuenta = () => { if (!CUENTA_RE.test(cuenta ?? '')) throw new Error('falta --cuenta claudeN'); return cuenta; };
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
        escribirJson(CFG, { ...cfg, carteros: { ...(cfg.carteros ?? {}), [c]: { fuente, configDir: dir } } });
        imprimir({ ok: true }); break;
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
      case 'ciclo': { const c = conCuenta(); const r = await ciclo(c); imprimir({ ...r, entregar: pendientes(c) }); break; }
      case 'pendientes': imprimir(pendientes(conCuenta())); break;
      case 'acuse': acuse(conCuenta(), resto[0], resto[1], resto.slice(2).join(' ')); imprimir({ ok: true }); break;
      case 'cierre': cierre(resto[0], resto.slice(1)); imprimir({ ok: true }); break;
      case 'esperar': { const i = resto.indexOf('--max-seg'); await esperar(conCuenta(), i >= 0 ? Number(resto[i + 1]) || 3000 : 3000); break; }
      default:
        process.stderr.write('comandos: instalar | url | token | clave | cartero | carpeta | repo | estado | ciclo | pendientes | acuse | cierre | esperar\n');
        process.exit(1);
    }
  } catch (e) {
    log(`ERROR ${cmd}: ${e.message}`);
    process.stderr.write(`${e.message}\n`);
    process.exit(1);
  }
}
