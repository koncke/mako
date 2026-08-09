// =============================================================================
// agente-plugin — el hook que reporta la sesión, GENERADO, no copiado
// =============================================================================
// La skill (`lib/agente-skill.ts`) le dice al modelo qué hacer. Esto es lo otro: el
// pedazo que NO depende de que el modelo se acuerde.
//
// ⚠️ POR QUÉ ESTO ES UN HOOK Y NO UNA LÍNEA EN LA SKILL. La regla de AGENTS.md —«una
// regla en un prompt no es una regla»— acá se aplica entera. «Al terminar, mandale el
// resumen a MaKo» escrito en la skill se cumple casi siempre, y «casi siempre» sobre
// telemetría significa que los datos que llegan están sesgados hacia las sesiones que
// terminaron bien: justo las que menos hay que mirar. Las que se cortan a la mitad, las
// que el usuario abandona enojado, las que se quedan sin cuota — que son las que dicen
// dónde falla el producto — no reportarían nunca. Un hook corre siempre, lo decide el
// runtime y no el modelo.
//
// ⚠️ POR QUÉ SE GENERA EN VEZ DE VIVIR COMO ARCHIVO EN EL REPO. La redacción tiene que
// correr en la máquina del cliente, antes de que el texto salga por la red. El proyecto
// del cliente no puede importar `@/lib`, así que el camino obvio sería copiar la tabla
// de expresiones al script — y esa copia se queda vieja, que es exactamente la cicatriz
// del contrato del `detalle` que documenta AGENTS.md. Acá no hay copia: el script se
// arma desde `REGLAS` cada vez que alguien lo pide, serializando cada `RegExp` por su
// `source` y sus `flags`. Una regla nueva llega al próximo cliente que baje el hook.
//
// ⚠️ LO QUE NO SE PUEDE VERIFICAR DESDE ACÁ, y hay que decirlo: el nombre exacto de los
// campos que Claude Code le pasa a un hook por stdin. Por eso el script lee `prompt`
// pero cae a buscar el último turno humano en el transcript si no está, y por eso
// existe el modo `probar`: el cliente corre un comando y ve si el hook llega a MaKo, en
// vez de descubrir dentro de un mes que nunca reportó nada.
// =============================================================================

import { REGLAS, redactarCon } from './agente-redaccion';

/** Dónde vive el script en el proyecto del cliente. */
export const AGENTE_HOOK_PATH = '.claude/hooks/mako-telemetria.mjs';

/** El JSON que hay que sumar al `.claude/settings.json` del cliente. Se muestra tal
 *  cual en el tutorial: es más corto de leer que explicarlo en prosa. */
export const AGENTE_HOOK_SETTINGS = JSON.stringify({
  hooks: {
    UserPromptSubmit: [{ hooks: [{ type: 'command', command: `node ${AGENTE_HOOK_PATH} turno` }] }],
    SessionEnd: [{ hooks: [{ type: 'command', command: `node ${AGENTE_HOOK_PATH} cierre` }] }],
  },
}, null, 2);

/** Las reglas, serializadas a código JavaScript que se pega adentro del script. */
function reglasComoCodigo(): string {
  return REGLAS
    .map((r) => `  { re: new RegExp(${JSON.stringify(r.re.source)}, ${JSON.stringify(r.re.flags)}), con: ${JSON.stringify(r.con)} },`)
    .join('\n');
}

/**
 * El script del hook. `base` es el origen de MaKo (sin barra final): se incrusta para
 * que el cliente no tenga que configurarlo, que es un paso menos donde equivocarse.
 */
export function agenteHookScript(base: string): string {
  const origen = base.replace(/\/+$/, '');
  return `#!/usr/bin/env node
// =============================================================================
// mako-telemetria — generado por MaKo. NO lo edites: se reemplaza al actualizarlo.
// =============================================================================
// Le cuenta a MaKo de qué se trató tu sesión de Claude Code. Manda dos cosas:
//   · el ACTA: cuántos turnos, cuánto duró, qué herramientas se usaron. Se queda.
//   · LO QUE ESCRIBISTE VOS, y solo eso. Caduca a los 90 días.
// Nunca manda lo que leyeron las herramientas: ni archivos, ni salidas de comandos,
// ni filas de tu base. Ahí es donde viven las credenciales y los datos de terceros.
//
// Antes de salir por la red, el texto pasa por las reglas de tapado de abajo.
//
// Si algo falla, este script se calla y sale con 0: una sesión tuya nunca se rompe
// porque la telemetría no pudo salir.
//
// Para probar que funciona:  node ${AGENTE_HOOK_PATH} probar
// =============================================================================
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = ${JSON.stringify(origen)};
const MODO = process.argv[2] || '';

// El token sale del entorno o de un archivo. NO va incrustado acá a propósito: así este
// script se puede commitear al repo del proyecto y el token no.
function token() {
  if (process.env.MAKO_TOKEN) return process.env.MAKO_TOKEN.trim();
  for (const p of [path.join(process.cwd(), '.claude', 'mako-token'), path.join(os.homedir(), '.mako-token')]) {
    try { const t = fs.readFileSync(p, 'utf8').trim(); if (t) return t; } catch {}
  }
  return '';
}

// ── Tapado. Generado desde lib/agente-redaccion.ts, no lo edites acá. ──────────
// Ni la tabla ni el algoritmo están escritos dos veces: los dos salen del mismo módulo
// del servidor. La función de abajo es literalmente la que corre en MaKo, serializada.
const REGLAS = [
${reglasComoCodigo()}
];

const redactarCon = ${redactarCon.toString()};
const redactar = (t) => redactarCon(t, REGLAS);

// El buffer vive en el temporal del sistema, NO en el proyecto: así no aparece en un
// \`git status\` ni se cuela en un commit del cliente.
const carpeta = path.join(os.tmpdir(), 'mako-agente');
const bufferDe = (id) => path.join(carpeta, String(id).replace(/[^\\w-]/g, '') + '.jsonl');

function leerStdin() {
  return new Promise((resolve) => {
    let d = '';
    if (process.stdin.isTTY) return resolve({});
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { d += c; });
    process.stdin.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch { resolve({}); } });
    setTimeout(() => resolve({}), 3000).unref?.();
  });
}

/** El último turno humano del transcript. Es el plan B por si el campo \`prompt\` no
 *  viene con el nombre que este script espera: sin esto, un cambio de contrato del
 *  runtime deja de reportar EN SILENCIO, que es la peor forma de romperse. */
function ultimoTurnoHumano(ruta) {
  try {
    const lineas = fs.readFileSync(ruta, 'utf8').trim().split('\\n');
    for (let i = lineas.length - 1; i >= 0; i--) {
      const ev = JSON.parse(lineas[i]);
      const m = ev?.message ?? ev;
      if (m?.role !== 'user') continue;
      const c = m.content;
      const texto = typeof c === 'string' ? c : Array.isArray(c) ? c.filter((b) => b?.type === 'text').map((b) => b.text).join('\\n') : '';
      // Un resultado de herramienta también llega con role 'user'. No es un turno humano.
      if (texto.trim()) return texto;
    }
  } catch {}
  return '';
}

/** El acta se arma con lo que se puede CONTAR, nunca con lo que se puede leer. Del
 *  transcript salen nombres de herramienta y cuántas veces se usó cada una; el
 *  contenido no sale de la máquina del cliente. */
function actaDelTranscript(ruta) {
  const herramientas = {};
  let respuestas = 0;
  let modelo = '';
  try {
    for (const linea of fs.readFileSync(ruta, 'utf8').trim().split('\\n')) {
      let ev; try { ev = JSON.parse(linea); } catch { continue; }
      const m = ev?.message ?? ev;
      if (m?.role !== 'assistant') continue;
      respuestas += 1;
      if (m.model && !modelo) modelo = String(m.model);
      for (const b of Array.isArray(m.content) ? m.content : []) {
        if (b?.type === 'tool_use' && b.name) herramientas[b.name] = (herramientas[b.name] || 0) + 1;
      }
    }
  } catch {}
  return { herramientas, respuestas, modelo };
}

async function mandar(cuerpo) {
  const t = token();
  if (!t) return { ok: false, error: 'no hay token (poné MAKO_TOKEN o .claude/mako-token)' };
  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), 8000);
  try {
    const r = await fetch(BASE + '/api/agente/telemetria', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t },
      body: JSON.stringify(cuerpo),
      signal: corte.signal,
    });
    const j = await r.json().catch(() => ({}));
    return r.ok ? { ok: true, ...j } : { ok: false, error: j.error || ('HTTP ' + r.status) };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  } finally { clearTimeout(reloj); }
}

const ev = MODO === 'probar' ? {} : await leerStdin();
const sesion = ev.session_id || ev.sessionId || '';

try {
  if (MODO === 'turno') {
    const texto = ev.prompt || ev.user_prompt || (ev.transcript_path ? ultimoTurnoHumano(ev.transcript_path) : '');
    if (texto.trim() && sesion) {
      fs.mkdirSync(carpeta, { recursive: true });
      fs.appendFileSync(bufferDe(sesion), JSON.stringify({ ts: new Date().toISOString(), texto: texto.slice(0, 2000) }) + '\\n');
    }
  } else if (MODO === 'cierre') {
    const archivo = bufferDe(sesion);
    let turnos = [];
    try {
      turnos = fs.readFileSync(archivo, 'utf8').trim().split('\\n').filter(Boolean).map((l) => JSON.parse(l));
    } catch {}
    // Una sesión sin un solo turno humano no se reporta: es ruido, y además es lo que
    // pasa cuando alguien abre Claude Code y lo cierra sin escribir nada.
    if (turnos.length) {
      let tapadas = 0;
      const limpios = turnos.map((t) => { const r = redactar(t.texto); tapadas += r.tapadas; return { ts: t.ts, texto: r.texto }; });
      const extra = ev.transcript_path ? actaDelTranscript(ev.transcript_path) : {};
      const r = await mandar({
        sesion_id: sesion,
        empezo_en: turnos[0]?.ts,
        termino_en: new Date().toISOString(),
        acta: {
          turnos: limpios.length,
          redacciones: tapadas,
          minutos: turnos[0]?.ts ? Math.round((Date.now() - new Date(turnos[0].ts)) / 60000) : null,
          // El nombre de la carpeta del proyecto, sin la ruta: dice en qué trabaja el
          // cliente sin decir cómo se llama su usuario del sistema.
          proyecto: path.basename(ev.cwd || process.cwd()),
          cierre: ev.reason || null,
          ...extra,
        },
        turnos: limpios,
      });
      // Si no llegó, el buffer NO se borra: el próximo cierre lo reintenta, y el
      // endpoint hace upsert por (workspace, sesión) así que no duplica.
      if (r.ok) { try { fs.unlinkSync(archivo); } catch {} }
    } else { try { fs.unlinkSync(archivo); } catch {} }
  } else if (MODO === 'autoprueba') {
    // Lee un JSON de textos por stdin y devuelve cómo los taparía. Existe para que el
    // test del servidor pueda comparar ESTE script con la redacción de MaKo y fallar si
    // divergen: la función se serializa desde el mismo módulo, pero un bundler que
    // minifique podría romper esa serialización, y eso solo se ve corriéndola.
    const entradas = Array.isArray(ev.textos) ? ev.textos : [];
    console.log(JSON.stringify(entradas.map((t) => redactar(t))));
  } else if (MODO === 'probar') {
    const r = await mandar({
      sesion_id: 'prueba-' + Date.now(),
      acta: { prueba: true, proyecto: path.basename(process.cwd()) },
      turnos: [{ ts: new Date().toISOString(), texto: 'Prueba del hook de MaKo.' }],
    });
    console.log(r.ok ? '✓ El hook llega a MaKo. Ya está andando.' : '✖ No llegó: ' + r.error);
    process.exit(r.ok ? 0 : 1);
  } else {
    console.log('Uso: node ${AGENTE_HOOK_PATH} [turno|cierre|probar]');
  }
} catch {}
// Siempre 0, salvo en \`probar\`: un hook que devuelve error puede frenarle la sesión al
// cliente, y ninguna telemetría vale eso.
process.exit(0);
`;
}
