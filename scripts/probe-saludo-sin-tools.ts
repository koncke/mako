// =============================================================================
// probe-saludo-sin-tools — ¿el turno SIN herramientas ahora se contesta?
// =============================================================================
// Pega DOS veces (una por proveedor) con el system REAL que arma el doer, leído del
// fuente, en sus dos formas: la de ANTES (voz + protocolo de tools, con `tools: []`)
// y la de AHORA (sólo la voz, sin el campo `tools`). Imprime qué contestó cada una.
//
// Por qué existe: la causa del incidente del 01/10 no era la lista vacía sino el
// PROMPT —medido: con un system corto, `tools: []` contesta perfecto; con el
// preámbulo que ordena usar diez herramientas, Groq devuelve 400 y Gemini un 200 con
// el texto vacío, con o sin el campo—. Un arreglo de prompt no se verifica leyéndolo.
//
// ⚠️ GASTA CUOTA de la agencia (4 llamadas cortas). No se corre de rutina.
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/probe-saludo-sin-tools.ts
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { readFileSync } from 'node:fs';

const SRC = readFileSync(resolve(process.cwd(), 'lib/mako-doer-in.ts'), 'utf8');

/** Lee un template literal del fuente por el nombre de su const. */
function constante(nombre: string): string {
  const i = SRC.indexOf(`const ${nombre} = \``);
  if (i < 0) throw new Error(`no encontré ${nombre}`);
  const desde = i + `const ${nombre} = \``.length;
  const hasta = SRC.indexOf('`;', desde);
  return SRC.slice(desde, hasta);
}

const VOZ = constante('DOER_WA_VOZ');
const TOOLS = constante('DOER_WA_TOOLS');

/** La línea que el doer agrega cuando NO hay herramientas. Se lee del fuente por lo
 *  mismo que las otras dos: un probe que arma el prompt a mano verifica otra cosa. */
const SIN_TOOLS = (() => {
  const m = SRC.match(/: '\\n\\nEN ESTE TURNO NO TIENES HERRAMIENTAS:([^']*)';/);
  if (!m) throw new Error('no encontré el bloque de sin-herramientas');
  return `EN ESTE TURNO NO TIENES HERRAMIENTAS:${m[1]}`;
})();

const MENSAJE = 'hola mako, como venimos de reuniones los ultimos 15 dias';

type Caso = { nombre: string; system: string; mandarTools: boolean };
const CASOS: Caso[] = [
  { nombre: 'ANTES (voz + protocolo de tools, tools: [])', system: `${VOZ}\n\n${TOOLS}`, mandarTools: true },
  { nombre: 'AHORA (voz + «no inventes», sin el campo tools)', system: `${VOZ}\n\n${SIN_TOOLS}`, mandarTools: false },
];

const PROVEEDORES = [
  { nombre: 'groq', base: 'https://api.groq.com/openai/v1', model: process.env.CHEAP_MODEL || 'openai/gpt-oss-20b', key: process.env.GROQ_API_KEY },
  { nombre: 'gemini', base: 'https://generativelanguage.googleapis.com/v1beta/openai', model: process.env.GEMINI_MODEL || 'gemini-flash-latest', key: process.env.GEMINI_API_KEY },
];

async function main() {
  console.log(`voz: ${VOZ.length} chars · protocolo de tools: ${TOOLS.length} chars\n`);
  for (const p of PROVEEDORES) {
    if (!p.key) { console.log(`${p.nombre}: sin key en .env.local, lo salto`); continue; }
    for (const c of CASOS) {
      const body: Record<string, unknown> = {
        model: p.model,
        messages: [{ role: 'system', content: c.system }, { role: 'user', content: MENSAJE }],
        max_tokens: 400, temperature: 0.2,
      };
      if (c.mandarTools) { body.tools = []; body.tool_choice = 'auto'; }
      const t0 = Date.now();
      try {
        const res = await fetch(`${p.base}/chat/completions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(30_000),
        });
        const d = await res.json().catch(() => ({}));
        const msg = (d as { choices?: Array<{ message?: { content?: string }; finish_reason?: string }> }).choices?.[0];
        const txt = (msg?.message?.content || '').trim();
        const err = (d as { error?: { message?: string } }).error?.message;
        const ms = Date.now() - t0;
        const veredicto = res.ok && !err && txt ? '✅ CONTESTÓ' : '⛔ NO SIRVIÓ';
        console.log(`${veredicto}  ${p.nombre.padEnd(7)} ${String(res.status).padEnd(4)} fin=${String(msg?.finish_reason ?? '—').padEnd(11)} ${String(txt.length).padStart(4)} chars  ${String(ms).padStart(5)} ms  · ${c.nombre}`);
        if (err) console.log(`            error: ${err.slice(0, 150)}`);
        if (txt) console.log(`            «${txt.replace(/\n/g, ' ').slice(0, 130)}»`);
      } catch (e) {
        console.log(`⛔ NO SIRVIÓ  ${p.nombre.padEnd(7)} excepción: ${e instanceof Error ? e.message : String(e)} · ${c.nombre}`);
      }
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
