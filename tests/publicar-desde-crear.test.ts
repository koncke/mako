// =============================================================================
// «Publicar» desde el Video Editor, el Image Editor y el Copywriter: UN solo camino, el del Calendario (29/10/2026)
// =============================================================================
// Martín, por el Cerebro: «que con las funcionalidades que ya creamos puedan publicar en Facebook, TikTok, LinkedIn…». El Cerebro:
// «El botón lleva lo exportado (el video, la imagen o el texto) al Calendario con el evento ya armado, para elegir la red, el día y
// la hora. Un solo camino de publicación, el del Calendario». Lo que tiene que pasar:
//
//   1. LO QUE VIENE DE CADA EDITOR ARMA UNA PUBLICACIÓN para mañana a las 10:00 (video → reel; imagen y texto → post), con el
//      archivo que aceptan las redes (MP4/MOV; JPG/PNG/WEBP). Un texto de más de 2.200 no se corta en silencio: va a las notas.
//   2. NO HAY OTRO CAMINO A LA RED: ni la acción ni los editores programan; sólo arman y suben con la subida del Calendario.
//   3. EL CALENDARIO ABRE ESE EVENTO (`?evento=`), una vez.
//   4. LOS TRES BOTONES: el Video Editor (exporta SÓLO el MP4 y no lo guarda en la carpeta), el Image Editor (una página, imagen)
//      y el Copywriter (el texto; nunca desde el editor compartido).
//
// Probado ROMPIÉNDOLO (29/10/2026): ver el pie de este archivo.
//
// Correr: node --import tsx --test tests/publicar-desde-crear.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  eventoDeLaUrl, FORMATO_DE_ORIGEN, HORA_SUGERIDA, publicacionDesdeCrear, TITULO_DE_ORIGEN, urlDelEventoEnCalendario,
} from '../lib/calendario-desde-crear';
import { TOPE_TEXTO } from '../lib/calendario-publicar-reglas';

const RAIZ = join(__dirname, '..');
const leer = (p: string): string => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const HOY = '2026-10-29';

test('un video MP4 arma un reel para mañana a las 10:00; un WEBM o un GIF no se publican', () => {
  const r = publicacionDesdeCrear({ origen: 'video', titulo: '  Mi   reel ', mime: 'video/mp4', hoy: HOY });
  assert.ok(r.ok);
  assert.deepEqual(r.publicacion.entrada, { titulo: 'Mi reel', tipo: 'publicacion', formato: 'reel', fecha: '2026-10-30', hora: HORA_SUGERIDA, duracionMin: null, notas: '' });
  assert.equal(HORA_SUGERIDA, '10:00');
  assert.ok(publicacionDesdeCrear({ origen: 'video', mime: 'video/quicktime', hoy: HOY }).ok);
  assert.deepEqual(publicacionDesdeCrear({ origen: 'video', mime: 'video/webm', hoy: HOY }), { ok: false, error: 'Para publicar, el video va en MP4 o MOV.' });
  assert.deepEqual(publicacionDesdeCrear({ origen: 'imagen', mime: 'image/gif', hoy: HOY }), { ok: false, error: 'Para publicar, la imagen va en JPG, PNG o WEBP.' });
  // Un video no entra como imagen, ni al revés.
  assert.equal(publicacionDesdeCrear({ origen: 'imagen', mime: 'video/mp4', hoy: HOY }).ok, false);
  assert.equal(publicacionDesdeCrear({ origen: 'video', mime: 'image/png', hoy: HOY }).ok, false);
  assert.equal(publicacionDesdeCrear({ origen: 'otro', mime: 'video/mp4', hoy: HOY }).ok, false);
  // Fin de mes: mañana es el 1.º.
  const fin = publicacionDesdeCrear({ origen: 'imagen', mime: 'image/png', hoy: '2026-10-31' });
  assert.ok(fin.ok && fin.publicacion.entrada.fecha === '2026-11-01');
});

test('una imagen y un texto arman un post; sin título, el del editor', () => {
  const i = publicacionDesdeCrear({ origen: 'imagen', titulo: '', mime: 'image/png', hoy: HOY });
  assert.ok(i.ok && i.publicacion.entrada.formato === 'post' && i.publicacion.entrada.titulo === TITULO_DE_ORIGEN.imagen);
  const t = publicacionDesdeCrear({ origen: 'texto', titulo: 'Gancho', texto: '  Hola, esto es el pie.  ', hoy: HOY });
  assert.ok(t.ok);
  assert.equal(t.publicacion.texto, 'Hola, esto es el pie.');
  assert.equal(t.publicacion.entrada.notas, '');
  assert.deepEqual(FORMATO_DE_ORIGEN, { video: 'reel', imagen: 'post', texto: 'post' });
  assert.deepEqual(publicacionDesdeCrear({ origen: 'texto', texto: '   ', hoy: HOY }), { ok: false, error: 'El texto está vacío: escribe algo antes de publicarlo.' });
  // El título largo se corta en el tope de un evento.
  const largo = publicacionDesdeCrear({ origen: 'texto', titulo: 'x'.repeat(300), texto: 'a', hoy: HOY });
  assert.ok(largo.ok && largo.publicacion.entrada.titulo.length === 160);
});

test('un texto de más de 2.200 NO se corta en silencio: va entero a las notas, con el aviso arriba', () => {
  const largo = 'palabra '.repeat(400).trim();
  assert.ok(largo.length > TOPE_TEXTO);
  const r = publicacionDesdeCrear({ origen: 'texto', texto: largo, hoy: HOY });
  assert.ok(r.ok);
  assert.equal(r.publicacion.texto, '', 'el pie queda vacío: no se publica medio texto');
  assert.match(r.publicacion.entrada.notas ?? '', /^El texto pasa los 2\.200 caracteres de una publicación: recórtalo/);
  assert.ok((r.publicacion.entrada.notas ?? '').includes(largo.slice(0, 500)));
  assert.ok((r.publicacion.entrada.notas ?? '').length <= 4000);
});

test('el link vuelve a la semana del evento con su modal, y sólo acepta un id de evento propio', () => {
  assert.equal(urlDelEventoEnCalendario('evabc123xyz', '2026-10-30'), '/calendario?vista=semana&fecha=2026-10-30&evento=evabc123xyz');
  assert.equal(eventoDeLaUrl('evm2k3j4abc123'), 'evm2k3j4abc123');
  for (const x of ['', 'propio:ev1', '../x', 'ev', 'ev<script>', 'EVABC1234', null, 3]) assert.equal(eventoDeLaUrl(x), null, String(x));
  // El formato de los ids es el que arma el Calendario.
  assert.match(leer('lib/calendario.ts'), /const nuevoId = \(\) => `ev\$\{Date\.now\(\)\.toString\(36\)\}\$\{Math\.random\(\)\.toString\(36\)\.slice\(2, 8\)\}`;/);
});

test('la acción arma y sube, con el guard del Calendario, y NO programa nada', () => {
  const a = leer('app/calendario/actions.ts');
  const f = a.slice(a.indexOf('export async function publicacionDesdeCrearAction('), a.indexOf('/** La URL firmada para SUBIR el archivo'));
  assert.ok(f.length > 200);
  assert.ok(f.indexOf('await guard();') > 0 && f.indexOf('await guard();') < f.indexOf('publicacionDesdeCrear('), 'el guard va primero');
  assert.match(f, /const creado = await crearEventos\(\[entrada\], await zonaDelCalendario\(\), \{ origen: 'user', autor: await autor\(\) \}\);/);
  assert.match(f, /if \(texto\) \{\n\s+const g = await guardarPublicacion\(id, \{ texto \}\);/);
  assert.match(f, /if \(q\.origen !== 'texto'\) \{\n\s+const s = await subidaDelArchivo\(id,/);
  assert.doesNotMatch(f, /programar|crearPostZernio|zernio/i, 'la acción programó: el único camino a la red es «Programar» del Calendario');
  // El ayudante del navegador: la subida de SIEMPRE y el archivo guardado; nada de Zernio.
  const h = leer('app/calendario/publicar-desde-crear.ts');
  assert.match(h, /await subirConProgreso\(r\.subida\.url, archivo, r\.subida\.apikey,/);
  assert.match(h, /await guardarPublicacionAction\(r\.id, \{ archivo: r\.subida\.ruta, archivoTipo: r\.subida\.tipo \}\)/);
  // Si la subida (o guardar el archivo) falla, se dice dónde quedó y se devuelve su link: reintentar no arma otra.
  const fallos = [...h.matchAll(/La publicación quedó en el Calendario sin el archivo: súbelo ahí\.`, url \}/g)];
  assert.equal(fallos.length, 2, 'las dos salidas con error devuelven dónde quedó');
  assert.doesNotMatch(h, /zernio|programar/i);
});

test('ningún editor de Create habla con la red: sólo con el Calendario', () => {
  const archivos = execFileSync('git', ['ls-files', 'app/video-editor', 'app/image-editor', 'app/copywriter'], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 50_000_000 })
    .split(/\r?\n/).filter((f) => /\.(ts|tsx)$/.test(f));
  assert.ok(archivos.length > 50, `leí ${archivos.length} archivos`);
  const culpables = archivos.filter((f) => /zernio-publicar|crearPostZernio|programarAction|lib\/zernio'/.test(leer(f)));
  assert.deepEqual(culpables, []);
});

test('el Calendario abre el evento que llega por ?evento=, una sola vez, y saca el parámetro', () => {
  assert.match(leer('app/calendario/page.tsx'), /eventoInicial=\{eventoDeLaUrl\(sp\?\.evento\)\}/);
  const c = leer('app/calendario/CalendarioApp.tsx');
  const e = c.slice(c.indexOf('const abiertoDesdeLaUrl = useRef(false);'), c.indexOf('const borrar = (it: ItemCalendario'));
  assert.match(e, /const it = items\.find\(\(x\) => x\.id === `propio:\$\{eventoInicial\}`\);/);
  assert.match(e, /abiertoDesdeLaUrl\.current = true;\n\s+editar\(it\);\n\s+router\.replace\(`\/calendario\?vista=\$\{vista\}&fecha=\$\{fecha\}`, \{ scroll: false \}\);/);
});

test('el Video Editor: «Publicar» exporta SÓLO el MP4, no lo guarda en la carpeta, y lo lleva al Calendario', () => {
  const header = leer('app/video-editor/_opencut/components/editor/editor-header.tsx');
  assert.match(header, /<PublicarButton \/>\n\s+<ExportButton \/>/);
  assert.match(leer('app/video-editor/_opencut/components/editor/export-button.tsx'), /<DialogoExportar abierto=\{abierto\} onAbiertoChange=\{setAbierto\} publicar \/>/);
  const d = leer('app/video-editor/_opencut/export/dialogo-exportar.tsx');
  assert.match(d, /video: \{ \.\.\.opciones\.video, activo: true, formato: "mp4", codec: codecMp4 \},\n\s+audio: \{ \.\.\.opciones\.audio, activo: false \},\n\s+subtitulos: \{ \.\.\.opciones\.subtitulos, activo: false \},\n\s+gif: \{ \.\.\.opciones\.gif, activo: false \},/);
  assert.match(d, /new Exportacion\(editor, publicar \? paraPublicar : opciones, soporte, \{ guardar: !publicar \}\)/);
  assert.match(d, /origen: "video",\n\s+titulo: datos\.proyecto\.metadata\.name,\n\s+archivo: video\.blob,/);
  // Ya exportado, el mismo video se publica sin volver a exportar; y sólo si es un video que aceptan las redes.
  assert.match(d, /const publicable = resultado\.video && tipoDeArchivo\(resultado\.video\.blob\.type\) === "video" \? resultado\.video : null;/);
  assert.match(d, /onClick=\{\(\) => void publicarVideo\(videoListo\)\}/);
  const x = leer('app/video-editor/_opencut/export/exportar.ts');
  assert.match(x, /if \(this\.opc\.guardar !== false\) for \(const archivo of archivos\) await guardarArchivo\(archivo\);/);
});

test('el Image Editor: «Publicar en redes» con la MISMA exportación, una página y en imagen', () => {
  const d = leer('app/image-editor/_doory/editor/dialogs/DownloadDialog.tsx');
  assert.match(d, /const sePuedePublicar = !!format && tipoDeArchivo\(format\.mime\) === 'image' && chosenPages\.length === 1/);
  assert.match(d, /const files = await runExport\(editor, \{ formatId: format\.id, pages: selected,/);
  assert.match(d, /llevarAlCalendario\(\{ origen: 'imagen',/);
  assert.match(d, /disabled=\{busy \|\| publicando \|\| rangeInvalid \|\| !sePuedePublicar\} data-publicar-imagen=""/);
});

test('el Copywriter: el texto de la página va al Calendario, y nunca desde el editor compartido', () => {
  const e = leer('app/copywriter/editor/EditorGuion.tsx');
  assert.match(e, /llevarAlCalendario\(\{ origen: 'texto', titulo: titulo\.trim\(\) \|\| null, texto: textoDelDoc\(doc\.leer\(\)\) \}\)/);
  assert.match(e, /\{!compartido && \(\n\s+<button type="button" role="menuitem" className="nt-menu-fila" data-publicar-texto=""/);
});

// ── Probado ROMPIÉNDOLO (29/10/2026) ──────────────────────────────────────────
// Con el código como está: 10 pases y 0 fallos. Rota, una por vez y restaurando (cada una → 9 / 1):
//   · un WEBM se acepta como video                    · el texto largo se corta en silencio
//   · la publicación nace hoy (puede ser en el pasado) · el link acepta cualquier cosa
//   · la acción programa en la red                    · la acción sin el guard
//   · si la subida falla no dice dónde quedó          · el Calendario no saca el ?evento= (un F5 lo reabre)
//   · el video para publicar también se guarda        · el video para publicar sale con lo elegido (WEBM, GIF…)
//   · el Video Editor sin el botón Publicar           · el Image Editor publica varias páginas
//   · el Copywriter publica desde el editor compartido · un editor habla directo con Zernio
// («si la subida falla» no mordía en la primera corrida: la frase está en las dos salidas con error y el test miraba una.)
