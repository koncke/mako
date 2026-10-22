// =============================================================================
// medir-diagnostico-viejo — el diagnóstico de Offer que la API de MaKo les da a los chats (OF1, 22/10/2026)
// =============================================================================
// SÓLO LEE. Para un negocio, corre `listar_analisis_oferta` y `ver_analisis_oferta` (lib/api-mako/areas/negocio.run.ts),
// lo mismo que lee MaKo como contexto para prospectar, y dice en cada conversación si el diagnóstico está marcado como
// armado con el embudo de otro funnel (`diagnosticoViejo`) y si trae alguna de las frases que se le pasan.
//
// Uso (con las variables de la base de producción):
//   node --conditions react-server --env-file=<.env.local> --import tsx scripts/medir-diagnostico-viejo.mts [ws] [frase...]
// Sin frases, busca las dos del Sprint de Mauricio (ws1, sesión 18): «ventas de 24 asistentes» y «6 ofertas activas».
// Sale con 1 si alguna frase llega al contexto.
import { config } from 'dotenv';
if (!process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.SUPABASE_URL) config({ path: '.env.local' });

const ws = Number(process.argv[2] || 1);
const frases = process.argv.slice(3).length ? process.argv.slice(3) : ['ventas de 24 asistentes', '6 ofertas activas'];
const { runWithWorkspace } = await import('../lib/workspace');
const { RUNNERS } = await import('../lib/api-mako/areas/negocio.run');

// Como la llama un chat por HTTP (admin, el negocio entero). Las dos operaciones sólo leen.
const ctx = { ws, canal: 'http', canalKey: `api:${ws}`, alcance: 'total', rol: 'admin' };
const leer = async (id: string, input: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const r = RUNNERS[id] as unknown as { leer?: (i: Record<string, unknown>, c: typeof ctx) => Promise<string> };
  if (!r?.leer) throw new Error(`${id} no es una lectura`);
  return JSON.parse(await r.leer(input, ctx)) as Record<string, unknown>;
};

let llegan = 0;
await runWithWorkspace(ws, async () => {
  const lista = await leer('listar_analisis_oferta', {});
  const conversaciones = (lista.conversaciones ?? []) as Array<{ id: number; titulo: string; nota_total: number | null }>;
  console.log(`ws${ws}: ${conversaciones.length} conversaciones de Offer, ${conversaciones.filter((c) => c.nota_total != null).length} con oferta armada`);
  for (const c of conversaciones.filter((x) => x.nota_total != null)) {
    const v = await leer('ver_analisis_oferta', { id: c.id });
    const texto = JSON.stringify(v);
    const halladas = frases.filter((f) => texto.includes(f));
    llegan += halladas.length;
    console.log(`  #${c.id} «${c.titulo}» v${String(v.version)}: ${v.diagnostico_no_vigente ? 'diagnóstico NO vigente (otro funnel)' : 'diagnóstico vigente'}`
      + ` · frases en el contexto: ${halladas.length ? halladas.map((f) => `«${f}»`).join(', ') : 'ninguna'}`);
  }
});
console.log(llegan ? `✗ ${llegan} frase(s) llegan al contexto de MaKo` : '✓ ninguna de las frases llega al contexto de MaKo');
process.exit(llegan ? 1 : 0);
