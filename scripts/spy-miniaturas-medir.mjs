// =============================================================================
// spy-miniaturas-medir — cuántas piezas de cada competidor tienen su miniatura guardada (4/11/2026). SÓLO LEE.
// =============================================================================
// El Cerebro, con Den Borg: «Casi todas las tarjetitas del gráfico son el degradado rosa de Instagram, sin miniatura. Medí cuántas
// piezas tienen su miniatura guardada». Por competidor y por canal: guardadas (en nuestro bucket), en el CDN todavía vigentes (las
// baja el relleno de cada hora, lib/spy-miniaturas.ts → `rellenarMiniaturas`), en el CDN ya vencidas (sólo una lectura nueva trae
// otra) y sin miniatura.
//
// Uso:  node --env-file=<clon>/.env.local scripts/spy-miniaturas-medir.mjs [workspace] [competidor]
// =============================================================================

import postgres from 'postgres';
import { urlDeLaBase } from './url-de-la-base.mjs';

const [ws, comp] = process.argv.slice(2).map((x) => (x ? Number(x) : null));
const sql = postgres(urlDeLaBase(), { max: 1, prepare: false });
const vencida = (url, ahora) => {
  try {
    const oe = new URL(url).searchParams.get('oe');
    return !!oe && /^[0-9a-f]{6,10}$/i.test(oe) && parseInt(oe, 16) * 1000 <= ahora;
  } catch { return false; }
};
try {
  const filas = await sql`
    select p.workspace_id, p.competidor_id, c.nombre, p.canal, p.miniatura
    from spy_piezas p join spy_competidores c on c.id = p.competidor_id
    where (${ws}::bigint is null or p.workspace_id = ${ws}) and (${comp}::bigint is null or p.competidor_id = ${comp})`;
  const ahora = Date.now();
  const grupos = new Map();
  for (const f of filas) {
    const k = `${f.workspace_id} · ${f.competidor_id} ${f.nombre} · ${f.canal}`;
    const g = grupos.get(k) ?? { total: 0, guardadas: 0, cdnVigentes: 0, cdnVencidas: 0, sin: 0 };
    g.total += 1;
    const m = f.miniatura ?? '';
    if (!m) g.sin += 1;
    else if (m.includes('/storage/v1/object/public/spy-miniaturas/')) g.guardadas += 1;
    else if (vencida(m, ahora)) g.cdnVencidas += 1;
    else g.cdnVigentes += 1;
    grupos.set(k, g);
  }
  for (const [k, g] of [...grupos].sort()) console.log(`${k}: ${g.total} piezas · ${g.guardadas} guardadas · ${g.cdnVigentes} en el CDN (vigentes) · ${g.cdnVencidas} en el CDN (vencidas) · ${g.sin} sin miniatura`);
} finally {
  await sql.end();
}
