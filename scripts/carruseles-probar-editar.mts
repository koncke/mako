// =============================================================================
// carruseles-probar-editar — probar «Editar» de punta a punta con la IA REAL de un negocio, desde la PC (6/11/2026)
// =============================================================================
// Martín probó «Editar» en producción el 6/11/2026 con un carrusel sin láminas y leyó «Tu IA no contestó ahora». La nube no llega
// a la base ni a las claves: esto corre en la PC con el .env.local (PRODUCCIÓN) la MISMA función que la pantalla
// (`replicarEjemplo`, lib/carruseles/replica-servidor.ts) y muestra cada paso: cuántas láminas llegaron a la IA, qué contestó
// cada IA del negocio (o por qué no), cuánto tardó y cómo quedó el diseño.
//
// ⚠️ EN SECO POR DEFECTO: usa la IA del negocio (gasta SU cuota, unos centavos) pero no copia su foto ni guarda el diseño. Con
//    `--guardar` lo guarda en sus diseños (Image) como haría la pantalla. Probar en el ws 3 (Cliente de Prueba), nunca en el ws 1.
//
// Uso (desde la raíz del clon):
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/carruseles-probar-editar.mts --ws 3 --id -123
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/carruseles-probar-editar.mts --ws 3 --id 45 --que thumbnail
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/carruseles-probar-editar.mts --ws 9 --id spy:1115 --que vertical
//     (13/11/2026: una miniatura VERTICAL, la portada de un reel que Spy ya trajo; el id es el del outlier de video)
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/carruseles-probar-editar.mts --ws 3 --sin-laminas
//     --sin-laminas: elige solo un carrusel de la biblioteca que tenga portada y NO láminas (el caso del 6/11).
// =============================================================================
export {};

const base = process.cwd().split(String.fromCharCode(92)).join('/');
const imp = (p: string) => import(`file:///${base}/${p}`);
const xs = process.argv.slice(2);
const op = (k: string): string | null => { const i = xs.indexOf(`--${k}`); return i >= 0 && xs[i + 1] && !xs[i + 1].startsWith('--') ? xs[i + 1] : null; };
const tiene = (k: string) => xs.includes(`--${k}`);

const ws = Number(op('ws'));
if (!Number.isSafeInteger(ws) || ws <= 0) { console.log('Falta --ws <n> (usa el 3, el Cliente de Prueba).'); process.exit(1); }
if (ws === 1) { console.log('✖ El ws 1 es de un cliente real (Mauricio): prueba en el ws 3.'); process.exit(1); }
const que = op('que') === 'thumbnail' ? 'thumbnail' : op('que') === 'vertical' ? 'vertical' : 'carrusel';

const { runWithWorkspace } = await imp('lib/workspace.ts');
const R = await imp('lib/carruseles/replica-servidor.ts');

let id = Number(op('id'));
if (tiene('sin-laminas')) {
  const S = await imp('lib/carruseles/biblioteca-servidor.ts');
  const todos = await runWithWorkspace(ws, () => S.carruselesDeLaBiblioteca());
  const uno = (todos as Array<{ id: number; laminas: number | null; miniatura: string | null; laminasImagenes?: string[] }>)
    .find((c) => (c.laminas ?? 0) > 1 && c.miniatura && !(c.laminasImagenes ?? []).length);
  if (!uno) { console.log('No encontré un carrusel con portada y sin láminas.'); process.exit(1); }
  id = uno.id;
  console.log(`Elegí el carrusel ${id} (${uno.laminas} láminas, sin las láminas guardadas; portada: ${uno.miniatura?.slice(0, 90)})`);
}
const idVertical = que === 'vertical' ? op('id') : null;
if (que === 'vertical' && !/^[a-z][a-z0-9-]{1,20}:[A-Za-z0-9_.-]{1,80}$/.test(idVertical ?? '')) { console.log('Falta --id <fuente:id> (el verticalId que da buscar_thumbnails con formato vertical, como spy:1115).'); process.exit(1); }
if (que !== 'vertical' && (!Number.isSafeInteger(id) || id === 0)) { console.log('Falta --id <n> (el id que da buscar_carruseles; negativo = biblioteca) o --sin-laminas.'); process.exit(1); }

const t0 = Date.now();
const seg = () => `${((Date.now() - t0) / 1000).toFixed(1)} s`;
const r = await runWithWorkspace(ws, () => R.replicarEjemplo(ws, 'script:probar-editar', que === 'vertical' ? { que, id: idVertical } : { que, id }, {
  seco: !tiene('guardar'),
  // --avatar cara|look|ninguno: lo que contestaría el dueño en el guiado (sin esto, la API vieja: sin foto del negocio).
  guiado: op('avatar') ? { ofertaId: null, ofertaLibre: null, avatar: op('avatar') as 'cara' | 'look' | 'ninguno', cambio: 'textos', pedido: null } : null,
  alEvento: (e: { fase: string; [k: string]: unknown }) => {
    if (e.fase === 'leer') console.log(`[${seg()}] leer: ${e.vistas} de ${e.laminas} láminas llegaron a la IA`);
    else if (e.fase === 'escribir') console.log(`[${seg()}] escribir: con ${e.con}`);
    else if (e.fase === 'lamina') console.log(`[${seg()}] lámina ${Number(e.indice) + 1}/${e.total} (${e.ancho}×${e.alto})`);
    else if (e.fase === 'fin') console.log(`[${seg()}] fin: ${JSON.stringify({ ...e, pagina: undefined }).slice(0, 400)}`);
  },
}));
console.log('\nResultado:');
if (!r.ok) { console.log(`✖ ${r.error}`); process.exit(2); }
console.log(`  ${r.sinIA ? '⚠ SIN la IA (con guías)' : '✓ con la IA del negocio'} · «${r.titulo}» · ${r.vistas ?? '?'} imágenes miradas · ${seg()}`);
if (r.aviso) console.log(`  Aviso que vería la persona: ${r.aviso}`);
for (const e of r.errores ?? []) console.log(`  · error de la IA: ${String(e).slice(0, 500)}`);
const paginas = (r.doc?.pages as Array<{ objects?: Array<{ type?: string; text?: string; name?: string }> }> | undefined) ?? [];
const notas = (r.doc?.pages as Array<{ notes?: string }> | undefined)?.[0]?.notes;
if (notas) console.log(`  Notas: ${notas.replace(/\s+/g, ' ').slice(0, 500)}`);
paginas.forEach((p, i) => console.log(`  Lámina ${i + 1}: ${(p.objects ?? []).filter((o) => o.type === 'image').map((o) => `[${o.name}]`).join(' ')} ${(p.objects ?? []).filter((o) => o.type === 'textbox').map((o) => `«${String(o.text).slice(0, 60)}»`).join(' · ') || '(sin textos)'}`));
// --salida <carpeta>: el diseño (doc.json), lo que leyó la IA (replica.json), las láminas que miró (original-N.jpg) y la plancha de
// cada lámina (plancha-N.jpg), para mirarlas y para probar la plancha sin pagar otra IA (13/11/2026).
if (op('salida') && r.doc) {
  const { mkdirSync, writeFileSync } = await import('node:fs');
  const dir = op('salida')!;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/doc.json`, JSON.stringify(r.doc, null, 1));
  if (r.replica) writeFileSync(`${dir}/replica.json`, JSON.stringify(r.replica, null, 1));
  const jpg = (src: string) => Buffer.from(src.slice(src.indexOf(',') + 1), 'base64');
  (r.imagenes ?? []).forEach((src: string, i: number) => writeFileSync(`${dir}/original-${i + 1}.jpg`, jpg(src)));
  (r.marcadas ?? []).forEach((src: string, i: number) => writeFileSync(`${dir}/marcada-${i + 1}.jpg`, jpg(src)));
  (r.doc.pages as Array<{ background?: { type?: string; src?: string } }>).forEach((p, i) => {
    const src = p.background?.type === 'image' ? p.background.src ?? '' : '';
    if (src.startsWith('data:image/')) writeFileSync(`${dir}/plancha-${i + 1}.jpg`, jpg(src));
  });
  console.log(`  Guardé el diseño, lo leído y las planchas en ${dir}`);
}
if (!tiene('guardar')) console.log('\nEn seco: no se guardó nada. Con --guardar queda en los diseños de Image de ese negocio.');
