/**
 * Transcribe una nota de voz con la cascada GRATIS del repo (Gemini → Groq → OpenAI).
 *
 *   node --conditions=react-server --import tsx scripts/transcribir-audio.ts <ruta> [salida]
 *
 * El `--conditions` NO es opcional: `lib/ai-cheap.ts` lleva `server-only`, y sin eso
 * el import revienta con un error que no nombra ese archivo.
 *
 * Corre en el workspace del super admin porque las keys de IA se leen POR WORKSPACE:
 * con `OWNER_WS` usaría las de un cliente (ver AGENTS.md, «OWNER_WS NO es la plataforma»).
 */
import { config } from 'dotenv';
import { resolve, basename, extname, dirname } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { readFileSync, writeFileSync } from 'node:fs';
import { transcribirAudio } from '../lib/ai-cheap';
import { runWithWorkspace, wsSuperAdmin } from '../lib/workspace';

const MIME: Record<string, string> = {
  '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.opus': 'audio/ogg',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.mp4': 'audio/mp4',
  '.wav': 'audio/wav', '.webm': 'audio/webm', '.flac': 'audio/flac',
};

async function main() {
  const ruta = process.argv[2];
  if (!ruta) throw new Error('falta la ruta del audio');
  const ext = extname(ruta).toLowerCase();
  const mime = MIME[ext];
  if (!mime) throw new Error(`no sé qué tipo es ${ext} (conozco: ${Object.keys(MIME).join(', ')})`);

  const buf = readFileSync(ruta);
  console.log(`audio: ${basename(ruta)} · ${(buf.length / 1024 / 1024).toFixed(2)} MB · ${mime}`);

  const ws = await wsSuperAdmin();
  const texto = await runWithWorkspace(ws, () =>
    transcribirAudio(buf.toString('base64'), mime, { language: 'es' }));

  console.log(`\n═══ ${texto.length} caracteres ═══\n`);
  console.log(texto);

  // Al lado del audio, salvo que se pida otra cosa: la carpeta de Descargas de
  // Windows es donde caen las notas de voz y donde se las va a buscar después.
  const salida = process.argv[3]
    ? resolve(process.argv[3])
    : resolve(dirname(ruta), `${basename(ruta, ext)}.txt`);
  writeFileSync(salida, texto, 'utf8');
  console.log(`\n(guardado en ${salida})`);
}

main().catch((e) => { console.error('✖', e?.message ?? e); process.exit(1); });
