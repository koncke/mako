// =============================================================================
// carruseles-rehacer-con-ia — rehacer un carrusel CON MaKo: cada lámina regenerada con IA desde su referencia (21/11/2026)
// =============================================================================
// Martín, 20/11, sobre sus 11 carruseles de ventas: «no salieron idénticos y tenían que salir realmente idénticos… eso lo tienes
// que hacer con inteligencia artificial». Esto corre la MISMA función que «Editar» (`replicarEjemplo`, que regenera cada lámina con
// la IA de imagen de ApiMart: lib/carruseles/regenerar*.ts) sobre una referencia de la biblioteca o sobre láminas de una carpeta,
// con el COPY del carrusel (palabra por palabra) y la persona que va (su personaje, o la del original si es el gancho).
//
// ⚠️ GASTA: los MaKo Tokens del negocio (una imagen por paso y por intento) y su IA de texto. Con --guardar queda en sus diseños.
//
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/carruseles-rehacer-con-ia.mts \
//     --ws 9 (--id -1483 | --carpeta <dir con 01.jpg…> --creador @cuenta --enlace <link>) --copy <archivo> \
//     [--persona original | --persona <imagen.png>] [--salida <dir>] [--guardar]
// =============================================================================
export {};

const base = process.cwd().split(String.fromCharCode(92)).join('/');
const imp = (p: string) => import(`file:///${base}/${p}`);
const xs = process.argv.slice(2);
const op = (k: string): string | null => { const i = xs.indexOf(`--${k}`); return i >= 0 && xs[i + 1] && !xs[i + 1].startsWith('--') ? xs[i + 1] : null; };
const tiene = (k: string) => xs.includes(`--${k}`);
const fs = await import('node:fs');

const ws = Number(op('ws'));
if (!Number.isSafeInteger(ws) || ws <= 0 || ws === 1) { console.log('Falta --ws <n> (nunca el 1, que es de un cliente).'); process.exit(1); }
const dataUrl = (ruta: string) => `data:image/${/\.png$/i.test(ruta) ? 'png' : 'jpeg'};base64,${fs.readFileSync(ruta).toString('base64')}`;

let ejemplo: unknown;
if (op('carpeta')) {
  const dir = op('carpeta')!;
  const laminas = fs.readdirSync(dir).filter((f) => /^\d+.*\.(jpe?g|png)$/i.test(f) || /^lamina_\d+\.(jpe?g|png)$/i.test(f)).sort();
  ejemplo = { que: 'imagenes', urls: laminas.map((f) => dataUrl(`${dir}/${f}`)), creador: op('creador') ?? 'un ejemplo', enlace: op('enlace') };
  console.log(`${laminas.length} láminas de ${dir}`);
} else ejemplo = { que: 'carrusel', id: Number(op('id')) };
const copy = op('copy') ? fs.readFileSync(op('copy')!, 'utf8') : null;
const persona = op('persona') === 'original' ? 'original' : op('persona') ? dataUrl(op('persona')!) : null;

const { runWithWorkspace } = await imp('lib/workspace.ts');
const R = await imp('lib/carruseles/replica-servidor.ts');
const t0 = Date.now();
const seg = () => `${((Date.now() - t0) / 1000).toFixed(1)} s`;
const r = await runWithWorkspace(ws, () => R.replicarEjemplo(ws, 'script:rehacer-con-ia', ejemplo, {
  seco: !tiene('guardar'), copy, persona, hastaMs: Date.now() + 15 * 60_000,
  alEvento: (e: { fase: string; [k: string]: unknown }) => {
    if (e.fase === 'leer') console.log(`[${seg()}] leer: ${e.vistas} de ${e.laminas} láminas`);
    else if (e.fase === 'escribir') console.log(`[${seg()}] escribir: con ${e.con}`);
    else if (e.fase === 'fin') console.log(`[${seg()}] fin: ${JSON.stringify({ ...e, pagina: undefined }).slice(0, 300)}`);
  },
}));
if (!r.ok) { console.log(`✖ ${r.error}`); process.exit(2); }
console.log(`✓ «${r.titulo}» ${r.id} · ${seg()}${r.aviso ? `\n  Aviso: ${r.aviso}` : ''}`);
for (const e of r.errores ?? []) console.log(`  · ${String(e).slice(0, 300)}`);
if (op('salida')) {
  const dir = op('salida')!;
  fs.mkdirSync(dir, { recursive: true });
  // Con --guardar, el diseño se relee de la base (las láminas quedaron en nuestro bucket).
  let doc = r.doc as { pages?: Array<{ background?: { src?: string } }> } | undefined;
  if (!doc && r.id && r.id !== '(seco)') {
    const { getSupabaseServer } = await imp('lib/supabase.ts');
    const { data } = await getSupabaseServer().from('image_disenos').select('doc').eq('id', r.id).maybeSingle();
    doc = data?.doc;
  }
  fs.writeFileSync(`${dir}/resultado.json`, JSON.stringify({ id: r.id, titulo: r.titulo, aviso: r.aviso ?? null, laminas: (doc?.pages ?? []).map((p) => p.background?.src ?? '') }, null, 1));
  console.log(`  Guardé ${dir}/resultado.json`);
}
