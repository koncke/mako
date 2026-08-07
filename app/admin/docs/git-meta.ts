import 'server-only';
import { execFileSync } from 'node:child_process';

// =============================================================================
// De qué trabajo salió cada documento, según git
// =============================================================================
// La pregunta que responde: «esto ¿cuándo se escribió y de qué tanda salió?».
// Se saca de git y no de un campo a mano en cada .md, justamente para que no se
// quede viejo — el que commitea ya escribe el mensaje.
//
// UNA sola invocación para los 20 documentos, no una por archivo: se recorre el
// log de docs/ con --name-only y el PRIMER commit que toca un archivo es su
// último cambio.
//
// LA CUENTA no sale de git: las dos sesiones commitean con el mismo autor sobre
// el mismo clon. Se lee del trailer `Claude-Cuenta:` del mensaje, que es la
// convención que pide AGENTS.md. Los commits viejos no lo tienen y muestran «—»:
// eso es correcto, no un error — no había forma de saberlo.
//
// EN PRODUCCIÓN NO HAY .git: el bundle de la función no lo incluye. Por eso todo
// esto devuelve null sin romper, y la pantalla simplemente no muestra la ficha.

export type MetaGit = {
  fecha: string;
  hora: string;
  autor: string;
  asunto: string;
  cuenta: string | null;
};

export function metaDeDocs(): Record<string, MetaGit> {
  const out: Record<string, MetaGit> = {};
  let crudo: string;
  try {
    crudo = execFileSync('git', [
      'log',
      '--date=format:%d %b %Y|%H:%M',
      '--pretty=format:@@@%ad|%an|%s|%(trailers:key=Claude-Cuenta,valueonly,separator=)',
      '--name-only',
      '--', 'docs', 'AGENTS.md',
    ], { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 12 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return out; // sin git (producción) o sin repo: la pantalla se las arregla
  }

  let actual: MetaGit | null = null;
  for (const linea of crudo.split('\n')) {
    if (linea.startsWith('@@@')) {
      const [fecha, hora, autor, asunto, cuenta] = linea.slice(3).split('|');
      actual = { fecha, hora, autor, asunto, cuenta: cuenta?.trim() || null };
      continue;
    }
    const ruta = linea.trim();
    if (!ruta || !actual) continue;
    // El primero que aparece es el más reciente: no se pisa.
    const slug = ruta.replace(/^docs\//, '').replace(/\.md$/, '');
    if (!(slug in out)) out[slug] = actual;
  }
  return out;
}
