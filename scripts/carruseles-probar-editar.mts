// =============================================================================
// carruseles-probar-editar — probar «Editar» de punta a punta con la IA REAL de un negocio, desde la PC (6/11/2026)
// =============================================================================
// Martín probó «Editar» en producción el 6/11/2026 con un carrusel sin láminas y leyó «Tu IA no contestó ahora». La nube no llega
// a la base ni a las claves: esto corre en la PC con el .env.local (PRODUCCIÓN) la MISMA función que la pantalla
// (`replicarEjemplo`, lib/carruseles/replica-servidor.ts) y muestra cada paso: cuántas láminas llegaron a la IA, qué contestó
// cada IA del negocio (o por qué no), cuánto tardó y cómo quedó el diseño.
//
// ⚠️ EN SECO POR DEFECTO: usa la IA del negocio (gasta SU cuota, unos centavos) pero no copia su foto, no le pide NINGUNA foto a
//    su IA de imagen (eso haría generar a la pestaña del cliente) y no guarda el diseño. Con `--guardar` hace las tres cosas,
//    como la pantalla.
// ⚠️ EL WS 3 (Cliente de Prueba) NO TIENE NINGUNA CLAVE DE IA: con `--ws 3` lo que se ejercita es el camino SIN IA. Para probar
//    con la IA de verdad va `--ws 9` (Martín: tiene Claude, GPT y Gemini). Nunca el ws 1, que es un cliente real.
//
// Uso (desde la raíz del clon):
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/carruseles-probar-editar.mts --ws 9 --id -123
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/carruseles-probar-editar.mts --ws 3 --id 45 --que thumbnail
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
if (!Number.isSafeInteger(ws) || ws <= 0) { console.log('Falta --ws <n> (el 9 para probar con la IA de verdad; el 3, Cliente de Prueba, no tiene ninguna clave).'); process.exit(1); }
if (ws === 1) { console.log('✖ El ws 1 es de un cliente real (Mauricio): prueba en el ws 9 (con IA) o en el ws 3 (sin IA).'); process.exit(1); }
const que = op('que') === 'thumbnail' ? 'thumbnail' : 'carrusel';

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
if (!Number.isSafeInteger(id) || id === 0) { console.log('Falta --id <n> (el id que da buscar_carruseles; negativo = biblioteca) o --sin-laminas.'); process.exit(1); }

const t0 = Date.now();
const seg = () => `${((Date.now() - t0) / 1000).toFixed(1)} s`;
const r = await runWithWorkspace(ws, () => R.replicarEjemplo(ws, 'script:probar-editar', { que, id }, {
  seco: !tiene('guardar'),
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
paginas.forEach((p, i) => console.log(`  Lámina ${i + 1}: ${(p.objects ?? []).filter((o) => o.type === 'textbox').map((o) => `«${String(o.text).slice(0, 60)}»`).join(' · ') || '(sin textos)'}`));
// Lo que se le va a pedir a la IA de IMAGEN del negocio (lib/carruseles/foto-lamina.ts): la foto de una lámina con gente.
const aGenerar = (r as { aGenerar?: Array<{ lamina: number; quien: string; conCara: boolean; escena: string }> }).aGenerar ?? [];
if (aGenerar.length) {
  console.log(`\n  Fotos para su IA de imagen (${aGenerar.length}):`);
  for (const g of aGenerar) console.log(`   · lámina ${g.lamina + 1} · ${g.quien}${g.conCara ? ' (con su cara de referencia)' : ''} · ${g.escena.slice(0, 160)}`);
} else {
  console.log('\n  Fotos para su IA de imagen: ninguna (o el ejemplo no tiene gente, o su extensión de Flow no está conectada).');
}
const fotosPedidas = (r as { fotosPedidas?: number }).fotosPedidas;
if (fotosPedidas) console.log(`  Pedidas de verdad a su navegador: ${fotosPedidas}`);
if (!tiene('guardar')) console.log('\nEn seco: no se guardó nada. Con --guardar queda en los diseños de Image de ese negocio.');
