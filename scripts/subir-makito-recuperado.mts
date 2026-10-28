// =============================================================================
// subir-makito-recuperado — guarda en la base los mensajes y los 21 audios recuperados del grupo Makito (27/10/2026, MK-02)
// =============================================================================
// Uso, desde la raíz del repo:
//   npx tsx --conditions=react-server scripts/subir-makito-recuperado.mts --env <.env.local> --dir <carpeta> --instancia <voz>
//       ← EN SECO: cuenta qué subiría
//   … --aplicar   ← ESCRIBE en la base de .env.local (PRODUCCIÓN): sólo con el sí de Martín, lo corre el Cerebro
//
// <carpeta> es feedback/makito-audios-2026-10 (afuera del repo): `all.json` (los 942 mensajes del store de Evolution, con la
// forma del webhook) y `audios/<id>.ogg` (los 21 recuperados antes de que el CDN de WhatsApp dejara de servirlos, a los
// ~15-17 días). Cada mensaje pasa por el MISMO camino que el webhook (`guardarMensajeUpsert`), en el workspace de la
// PLATAFORMA (nunca el ws1, que es un cliente), con el base64 de su audio si lo hay. Es idempotente: el upsert completa lo
// que falta y no duplica (índice por wa_message_id).
// =============================================================================

import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const [ENV, DIR, INSTANCIA] = [arg('--env'), arg('--dir'), arg('--instancia')];
if (!ENV || !DIR || !INSTANCIA) { console.error('⛔ faltan --env, --dir o --instancia'); process.exit(1); }
const APLICAR = process.argv.includes('--aplicar');
const dotenv = await import(pathToFileURL(path.join(REPO, 'node_modules', 'dotenv', 'lib', 'main.js')).href);
(dotenv.default ?? dotenv).config({ path: ENV, quiet: true });

const imp = (rel: string) => import(pathToFileURL(path.join(REPO, rel)).href);
const { runWithWorkspace, wsSuperAdmin } = await imp('lib/workspace.ts');
const { guardarMensajeUpsert } = await imp('lib/evolution-mensajes.ts');
const { grupoSeGuarda } = await imp('lib/grupos-guardados.ts');

type Msg = { key?: { id?: string; remoteJid?: string; fromMe?: unknown }; message?: Record<string, unknown>; messageTimestamp?: unknown; base64?: string };
const todos = JSON.parse(readFileSync(path.join(DIR, 'all.json'), 'utf8')) as Msg[];
const deMakito = todos.filter((m) => grupoSeGuarda(m.key?.remoteJid ?? '') && m.key?.id)
  .map((m) => ({ ...m, key: { ...m.key, fromMe: m.key?.fromMe === true || m.key?.fromMe === 'True' } }))
  .sort((a, b) => Number(a.messageTimestamp ?? 0) - Number(b.messageTimestamp ?? 0));
const conAudio = deMakito.filter((m) => existsSync(path.join(DIR, 'audios', `${m.key.id}.ogg`)));
console.log(`${deMakito.length} mensajes de Makito · ${conAudio.length} con su audio recuperado (de ${todos.length} en all.json)`);

if (!APLICAR) {
  console.log('En seco: no se escribió nada. Con --aplicar se guardan en el workspace de la plataforma.');
  process.exit(0);
}
const plataforma = await wsSuperAdmin();
let ok = 0;
const errores: string[] = [];
await runWithWorkspace(plataforma, async () => {
  for (const m of deMakito) {
    const ogg = path.join(DIR, 'audios', `${m.key.id}.ogg`);
    const conBytes = existsSync(ogg) ? { ...m, base64: readFileSync(ogg).toString('base64') } : m;
    try { await guardarMensajeUpsert(INSTANCIA, conBytes as never); ok++; } catch (e) { errores.push(`${m.key.id}: ${e instanceof Error ? e.message : String(e)}`); }
  }
});
console.log(`Guardados ${ok}/${deMakito.length} en el workspace ${plataforma}.${errores.length ? ` Errores (${errores.length}): ${errores.slice(0, 5).join(' | ')}` : ''}`);
process.exitCode = errores.length ? 1 : 0;
