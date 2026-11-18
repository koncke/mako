// =============================================================================
// Descargar «todas las páginas» del Image Editor: el ZIP se arma y se vuelve a abrir entero
// =============================================================================
// El diálogo de descarga (DownloadDialog, «Varias páginas se descargan en un ZIP») junta los archivos de cada página
// con `bundleFiles` → `zipFiles` (app/image-editor/_doory/editor/engine/export/zip.ts), que usa `zipSync` de fflate
// (la 0.8.3 que resuelve el package-lock). Hasta el 18/11/2026 esa función no la había ejecutado nadie
// (docs/hallazgos-editor-imagen.md, «fflate local quedó en 0.4.9… sin probar»). Este test la CORRE: arma el ZIP de
// tres páginas, lo vuelve a abrir con fflate y compara cada nombre y cada byte.
//
// Lo que NO prueba: que el navegador baje el .zip (eso es el diálogo y el `<a download>`) ni el `esm/browser.js` de
// fflate, que es el que empaqueta Next. Las dos builds comparten `zipSync`; la descarga real se mide en producción.
//
// Correr: node --import tsx --test tests/image-editor-zip-paginas.test.ts
// PROBADO ROMPIÉNDOLO (18/11/2026), de a una:
//   · `entries[name] = [new Uint8Array(0), …]` en zipFiles (el ZIP sin los bytes)  → 3 fallos, 3 pases (PNG, SVG, nombres)
//   · `STORED.test(name) ? 6 : 0` (el nivel al revés)                               → 2 fallos, 4 pases (PNG guardada, SVG desinflado)
//   · `for (let n = 2; false; n++)` en entryName (sin desempatar nombres repetidos) → 1 fallo, 5 pases (el mismo nombre)
//   · `files.length > 2` en bundleFiles                                            → 1 fallo, 5 pases («dos páginas ya son un ZIP»)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { unzipSync, type UnzipFileInfo } from 'fflate';
import { bundleFiles, zipFiles } from '../app/image-editor/_doory/editor/engine/export/zip';
import { pageFilename, type ExportFile } from '../app/image-editor/_doory/editor/engine/export/registry';

/** Bytes de prueba con forma de PNG (la firma y relleno distinto por página). No se decodifican: se comparan. */
function pngDePrueba(pagina: number, largo = 4096): Uint8Array {
  const b = new Uint8Array(largo);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  for (let i = 8; i < largo; i++) b[i] = (i * 31 + pagina * 97) & 0xff;
  return b;
}

const archivo = (bytes: Uint8Array, filename: string, type: string): ExportFile => ({
  blob: new Blob([bytes as BlobPart], { type }),
  filename,
});

async function abrir(zip: ExportFile): Promise<{ archivos: Record<string, Uint8Array>; info: Map<string, UnzipFileInfo> }> {
  const datos = new Uint8Array(await zip.blob.arrayBuffer());
  const info = new Map<string, UnzipFileInfo>();
  const archivos = unzipSync(datos, { filter: (f) => { info.set(f.name, f); return true; } });
  return { archivos, info };
}

const iguales = (a: Uint8Array | undefined, b: Uint8Array) => !!a && a.length === b.length && a.every((x, i) => x === b[i]);

test('fflate de arriba es la 0.8.x (la del package-lock), no la 0.4.9 de rrweb', () => {
  const req = createRequire(import.meta.url);
  const version = (req('fflate/package.json') as { version: string }).version;
  assert.match(version, /^0\.8\./, `fflate resuelve ${version}`);
});

test('tres páginas PNG: el ZIP trae los tres archivos, con su nombre y sus bytes', async () => {
  const titulo = 'Promo de la semana';
  const paginas = [1, 2, 3].map((n) => ({ n, bytes: pngDePrueba(n) }));
  const files = paginas.map(({ n, bytes }) => archivo(bytes, pageFilename(titulo, 'png', n, 3), 'image/png'));

  const zip = await zipFiles(files, titulo);
  assert.equal(zip.filename, 'Promo-de-la-semana.zip');
  assert.equal(zip.blob.type, 'application/zip');

  const { archivos, info } = await abrir(zip);
  assert.deepEqual(Object.keys(archivos).sort(), ['Promo-de-la-semana-01.png', 'Promo-de-la-semana-02.png', 'Promo-de-la-semana-03.png']);
  for (const { n, bytes } of paginas) {
    const nombre = pageFilename(titulo, 'png', n, 3);
    assert.ok(iguales(archivos[nombre], bytes), `la página ${n} vuelve con otros bytes`);
    // Una PNG ya viene comprimida: va guardada tal cual (método 0), no se vuelve a desinflar.
    assert.equal(info.get(nombre)?.compression, 0, `una PNG va guardada tal cual (${nombre})`);
  }
});

test('un SVG (texto) va desinflado y vuelve idéntico', async () => {
  const svg = new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg">${'<rect width="10" height="10"/>'.repeat(200)}</svg>`);
  const files = [archivo(svg, 'Afiche-01.svg', 'image/svg+xml'), archivo(svg, 'Afiche-02.svg', 'image/svg+xml')];
  const { archivos, info } = await abrir(await zipFiles(files, 'Afiche'));
  assert.ok(iguales(archivos['Afiche-01.svg'], svg) && iguales(archivos['Afiche-02.svg'], svg), 'el SVG vuelve con otros bytes');
  assert.equal(info.get('Afiche-01.svg')?.compression, 8, 'un SVG se desinfla (método 8)');
  assert.ok((info.get('Afiche-01.svg')?.size ?? Infinity) < svg.length, 'el SVG desinflado ocupa menos que el original');
});

test('dos páginas con el mismo nombre no se pisan, y un nombre con carpetas queda plano', async () => {
  const a = pngDePrueba(1, 600);
  const b = pngDePrueba(2, 600);
  const c = pngDePrueba(3, 600);
  const files = [archivo(a, 'pagina.png', 'image/png'), archivo(b, 'pagina.png', 'image/png'), archivo(c, '../otra/..pagina.png', 'image/png')];
  const { archivos } = await abrir(await zipFiles(files, 'Lote'));
  assert.deepEqual(Object.keys(archivos).sort(), ['_otra_..pagina.png', 'pagina-2.png', 'pagina.png'].sort());
  assert.ok(iguales(archivos['pagina.png'], a), 'la primera «pagina.png» quedó con otros bytes');
  assert.ok(iguales(archivos['pagina-2.png'], b), 'la segunda «pagina.png» no se renombró a «pagina-2.png»');
  assert.ok(Object.keys(archivos).every((n) => !n.includes('/') && !n.startsWith('.')), 'un nombre trae carpeta o arranca con punto');
});

test('un título vacío o con tildes da un .zip con nombre seguro', async () => {
  const files = [archivo(pngDePrueba(1, 64), 'a.png', 'image/png'), archivo(pngDePrueba(2, 64), 'b.png', 'image/png')];
  assert.equal((await zipFiles(files, '')).filename, 'design.zip');
  assert.equal((await zipFiles(files, 'Diseño de campaña')).filename, 'Diseno-de-campana.zip');
});

test('bundleFiles: una página baja tal cual; dos páginas ya son un ZIP', async () => {
  const una = [archivo(pngDePrueba(1, 64), 'Solo.png', 'image/png')];
  const sola = await bundleFiles(una, 'Solo');
  assert.equal(sola.length, 1);
  assert.equal(sola[0]?.filename, 'Solo.png', 'una sola página no se empaqueta');

  const dos = [archivo(pngDePrueba(1, 64), 'Par-01.png', 'image/png'), archivo(pngDePrueba(2, 64), 'Par-02.png', 'image/png')];
  const juntas = await bundleFiles(dos, 'Par');
  assert.equal(juntas.length, 1, 'dos páginas ya son un ZIP');
  assert.equal(juntas[0]?.filename, 'Par.zip');
  const { archivos } = await abrir(juntas[0]!);
  assert.deepEqual(Object.keys(archivos).sort(), ['Par-01.png', 'Par-02.png']);
});
