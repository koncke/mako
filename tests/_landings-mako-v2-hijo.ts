// Lo corre tests/landings-mako-v2.test.ts en un node aparte (`--conditions=react-server`: el saneo lleva `server-only`).
// Arma los documentos de las dos portadas y cuenta, sección por sección, las marcas antes y después del saneo.
import { PORTADAS, documentoMakoV2, seccionesDe, type Portada } from '../scripts/landings-mako-v2.mjs';

const MARCAS = ['data-mako-desde', 'data-mako-precio', 'data-mako-planes', '<details'];
const cuenta = (h: string) => Object.fromEntries(MARCAS.map((m) => [m, (h.match(new RegExp(m, 'g')) ?? []).length]));

// Sin await de primer nivel: tsx compila esto a CommonJS.
void (async () => {
  const salida: Record<string, unknown> = {};
  for (const cual of Object.keys(PORTADAS) as Portada[]) {
    const doc = await documentoMakoV2(cual);
    const limpias = doc.contenido.paginas[0].doc.content.map((t) => String((t.content?.[0]?.attrs as { html?: string } | undefined)?.html ?? ''));
    salida[cual] = seccionesDe(cual).map(([id, crudo], i) => ({ id, antes: cuenta(crudo), despues: cuenta(limpias[i] ?? ''), vacia: !limpias[i] }));
  }
  process.stdout.write(JSON.stringify(salida));
})();
