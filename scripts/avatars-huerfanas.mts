// =============================================================================
// avatars-huerfanas — las fotos de leads del bucket público `avatars` que ya no nombra nadie (6/11/2026, el barrido de pendientes)
// =============================================================================
// Las fotos viejas (`leads/<ws>/<lead>.jpg`) se pueden adivinar: la mudanza del cron sólo mueve las que una fila VIVA nombra, y las
// huérfanas siguen ahí con el nombre de antes (docs/relevo/seguridad-aislamiento.md, docs/pendientes.md). Lo corre el Cerebro desde la PC:
//
//   node --conditions=react-server --env-file=C:/dev/mako-api/.env.local --import tsx scripts/avatars-huerfanas.mts
//
// y, mirando lo que lista, otra vez con `--borrar` (con el sí de Martín: borra fotos de producción y no se deshace).
//
// ⚠️ SIN `--borrar`, SÓLO LEE: por negocio, cuántos objetos hay, cuántos nombra alguien y cuántos quedaron huérfanos (cuántos con el
//    nombre adivinable), y diez rutas de muestra (son números, no nombres de personas).
// ⚠️ «LO NOMBRA ALGUIEN» es: la `foto_auto_url` de un lead vivo, la foto JSON de un lead en la PAPELERA (si se recupera, vuelve con
//    esa URL: borrarla le dejaría la cara rota) y la `foto_url` de un contacto de WhatsApp. Una foto de menos de 24 h no se toca: la
//    fila que la va a nombrar puede estar escribiéndose. Un objeto con otro formato no es nuestro: no se toca (`lib/avatars-huerfanas.ts`).
// ⚠️ Una carpeta de un negocio que ya no existe: todo lo de adentro es huérfano (sin filas que lo nombren).
// =============================================================================

import { getSupabaseServer } from '../lib/supabase';
import { leerTodo } from '../lib/supabase-paginado';
import { huerfanas, rutasNombradas, type ObjetoBucket } from '../lib/avatars-huerfanas';

const BORRAR = process.argv.includes('--borrar');
const BUCKET = 'avatars';
const PAGINA = 1000;

const db = getSupabaseServer();
const storage = db.storage.from(BUCKET);

/** Todos los objetos de una carpeta, de a páginas (Storage corta en `limit` sin avisar). */
async function listar(carpeta: string): Promise<Array<{ name: string; id: string | null; created_at: string | null; metadata: { size?: number } | null }>> {
  const out: Array<{ name: string; id: string | null; created_at: string | null; metadata: { size?: number } | null }> = [];
  for (let offset = 0; ; offset += PAGINA) {
    const { data, error } = await storage.list(carpeta, { limit: PAGINA, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`No pude listar ${carpeta}: ${error.message}`);
    const filas = (data ?? []) as Array<{ name: string; id: string | null; created_at: string | null; metadata: { size?: number } | null }>;
    out.push(...filas);
    if (filas.length < PAGINA) return out;
  }
}

async function nombradasDe(ws: number): Promise<Set<string>> {
  const [leads, papelera, contactos] = await Promise.all([
    leerTodo<{ foto_auto_url: string | null }>(db, 'leads', 'id, foto_auto_url', { eq: { workspace_id: ws }, filtros: (q) => q.not('foto_auto_url', 'is', null), orden: 'id' }),
    leerTodo<{ foto: unknown }>(db, 'leads_papelera', 'id, foto', { eq: { workspace_id: ws }, orden: 'id' }),
    leerTodo<{ foto_url: string | null }>(db, 'evolution_contactos', 'id, foto_url', { eq: { workspace_id: ws }, filtros: (q) => q.not('foto_url', 'is', null), orden: 'id' }),
  ]);
  const s = new Set<string>();
  for (const l of leads) for (const r of rutasNombradas(l.foto_auto_url)) s.add(r);
  for (const p of papelera) for (const r of rutasNombradas(JSON.stringify(p.foto))) s.add(r);
  for (const c of contactos) for (const r of rutasNombradas(c.foto_url)) s.add(r);
  return s;
}

async function main(): Promise<void> {
  // Las carpetas de `leads/` son los negocios (`leads/<ws>/`): un objeto suelto ahí no es nuestro.
  const raiz = await listar('leads');
  const carpetas = raiz.filter((x) => x.id == null && /^\d+$/.test(x.name)).map((x) => Number(x.name));
  const ahora = Date.now();
  let total = 0;
  let totalAdivinables = 0;
  let borradas = 0;
  console.log(`${BORRAR ? 'BORRANDO' : 'EN SECO (sólo lee)'} · bucket ${BUCKET} · ${carpetas.length} carpeta(s) de negocio`);
  for (const ws of carpetas) {
    const objetos: ObjetoBucket[] = (await listar(`leads/${ws}`))
      .filter((x) => x.id != null)
      .map((x) => ({ ruta: `leads/${ws}/${x.name}`, creado: x.created_at, bytes: x.metadata?.size ?? null }));
    const nombradas = await nombradasDe(ws);
    const r = huerfanas(objetos, nombradas, ahora);
    const adivinables = r.huerfanas.filter((h) => h.adivinable).length;
    total += r.huerfanas.length;
    totalAdivinables += adivinables;
    const kb = Math.round(r.huerfanas.reduce((s, h) => s + (h.bytes ?? 0), 0) / 1024);
    console.log(`  ws ${ws}: ${objetos.length} objetos · ${objetos.length - r.huerfanas.length - r.recientes - r.ajenos} nombrados · ${r.huerfanas.length} huérfanos (${adivinables} adivinables, ${kb} KB) · ${r.recientes} de menos de 24 h · ${r.ajenos} con otro formato`);
    if (r.huerfanas.length) console.log(`    muestra: ${r.huerfanas.slice(0, 10).map((h) => h.ruta).join(', ')}`);
    if (!BORRAR || !r.huerfanas.length) continue;
    for (let i = 0; i < r.huerfanas.length; i += 100) {
      const tanda = r.huerfanas.slice(i, i + 100).map((h) => h.ruta);
      const { error } = await storage.remove(tanda);
      if (error) { console.error(`    no pude borrar una tanda de ${tanda.length}: ${error.message}`); continue; }
      borradas += tanda.length;
    }
  }
  console.log(`Total: ${total} huérfanos (${totalAdivinables} adivinables)${BORRAR ? ` · ${borradas} borrados` : ' · para borrarlos, otra vez con --borrar'}`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); });
