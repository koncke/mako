// Lo corre tests/landings-mako-v2.test.ts en un node aparte (`--conditions=react-server`: el saneo lleva `server-only`).
// Arma los documentos de las dos portadas y de las landings por funcionalidad y avatar, y cuenta, sección por sección, las
// marcas antes y después del saneo.
import { PORTADAS, documentoMakoV2, seccionesDe, type Portada } from '../scripts/landings-mako-v2.mjs';
import { FUNNELS, documentoDeFunnel, seccionesDeFunnel } from '../scripts/landings-mako-v2-funnels.mjs';

const MARCAS = ['data-mako-desde', 'data-mako-precio', 'data-mako-planes', 'data-mako-prueba', '<details'];
const cuenta = (h: string) => Object.fromEntries(MARCAS.map((m) => [m, (h.match(new RegExp(m, 'g')) ?? []).length]));
type Doc = Awaited<ReturnType<typeof documentoMakoV2>>;
const limpiasDe = (doc: Doc) => doc.contenido.paginas[0].doc.content.map((t) => String((t.content?.[0]?.attrs as { html?: string } | undefined)?.html ?? ''));
const comparar = (secciones: Array<[string, string]>, limpias: string[]) =>
  secciones.map(([id, crudo], i) => ({ id, antes: cuenta(crudo), despues: cuenta(limpias[i] ?? ''), vacia: !limpias[i] }));

// Sin await de primer nivel: tsx compila esto a CommonJS.
void (async () => {
  const salida: Record<string, unknown> = {};
  for (const cual of Object.keys(PORTADAS) as Portada[]) salida[cual] = comparar(seccionesDe(cual), limpiasDe(await documentoMakoV2(cual)));
  for (const f of FUNNELS) salida[f.slug] = comparar(seccionesDeFunnel(f), limpiasDe(await documentoDeFunnel(f)));
  process.stdout.write(JSON.stringify(salida));
})();
