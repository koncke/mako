// =============================================================================
// El área `imagen` de la API de MaKo (el Image Editor, 15/10/2026)
// =============================================================================
// Lo que la API hace sin el motor de Doory, y que se rompería en silencio:
//   1. el documento en blanco tiene la forma del que arma el editor (`createBlankDocument`);
//   2. cambiar textos respeta las mayúsculas del motor (`textCase` + `caseSource`), entra en grupos y no
//      inventa: lo que no encuentra lo devuelve;
//   3. no quedó ninguna de las 10 plantillas de Doory (6/11/2026): ni en el panel «Diseño», ni en la API, ni en
//      disco. Es el guard contra la reincidencia, y vive SÓLO acá (los diez slugs no se repiten en otro test);
//   4. las siete operaciones llevan el permiso de la tab (`image-editor`) y de admin, como toda tab.
//
// PROBADO ROMPIÉNDOLO (15/10/2026): sin `rolMinimo` en GATING de imagen.def.ts, el 4 falla (0/1); con
// `o.text = nuevo` en lugar del `caseSource` para las mayúsculas, el 2 falla (0/1).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createBlankDocument } from '../app/image-editor/_doory/lib/document';
import { cambiarTextos, documentoEnBlanco, resumirDoc, textosDe } from '../lib/image-editor/reglas';
import { DEFS } from '../lib/api-mako/areas/imagen.def';
import { servicioPlantillas } from '../app/image-editor/mako/plantillas';

const RAIZ = join(import.meta.dirname, '..');

/** Las 10 que servía el panel «Diseño» hasta el 6/11/2026, por su slug (eran sus JSON y sus WebP). */
const DOORY = [
  'bold-sale-announcement', 'bold-youtube-thumbnail', 'botanical-celebration-invitation', 'clean-business-card',
  'grand-opening-flyer', 'modern-pitch-deck', 'modern-resume', 'night-bloom-concert-poster', 'rooftop-event-story',
  'serif-quote-card',
] as const;

test('1: el documento en blanco tiene la forma del que arma el editor', () => {
  const nuestro = documentoEnBlanco(1080, 1350, 'p1') as { pages: { id: string }[] };
  const motor = createBlankDocument(1080, 1350) as unknown as { pages: { id: string }[]; meta?: unknown };
  const sinIds = (d: { pages: { id: string }[] }) => ({ ...d, pages: d.pages.map((p) => ({ ...p, id: 'x' })) });
  const { meta: _meta, ...motorSinMeta } = motor;
  assert.deepEqual(sinIds(nuestro), sinIds(motorSinMeta as { pages: { id: string }[] }));
  assert.deepEqual(resumirDoc(nuestro), { ancho: 1080, alto: 1350, paginas: 1 });
});

test('2: cambiar textos respeta las mayúsculas del motor, entra en grupos y dice lo que no encontró', () => {
  const doc = {
    pages: [
      { objects: [
        { type: 'textbox', text: 'Hola mundo' },
        { type: 'textbox', text: 'FIN DE TEMPORADA', textCase: 'upper', caseSource: 'Fin de temporada' },
        { type: 'group', objects: [{ type: 'textbox', text: 'Dentro del grupo' }] },
        { type: 'rect', text: 'no es texto' },
      ] },
    ],
  };
  const r = cambiarTextos(doc, [
    { actual: 'hola   MUNDO', nuevo: 'Chau' },
    { actual: 'Fin de temporada', nuevo: 'Liquidación' },
    { actual: 'Dentro del grupo', nuevo: 'Cambiado' },
    { actual: 'No existe', nuevo: 'x' },
  ]);
  assert.equal(r.cambiados, 3);
  assert.deepEqual(r.noEncontrados, ['No existe']);
  const objs = (r.doc as typeof doc).pages[0].objects as Record<string, unknown>[];
  assert.equal(objs[0].text, 'Chau');
  assert.equal(objs[1].caseSource, 'Liquidación');
  assert.equal(objs[1].text, 'LIQUIDACIÓN', 'el visible sale en mayúsculas, como lo haría el motor');
  assert.equal((objs[2].objects as Record<string, unknown>[])[0].text, 'Cambiado');
  assert.equal(objs[3].text, 'no es texto', 'un objeto que no es texto no se toca');
  assert.equal(doc.pages[0].objects[0].text, 'Hola mundo', 'el original no se modifica');
  assert.deepEqual(textosDe(r.doc), [{ pagina: 1, nombre: null, textos: ['Chau', 'LIQUIDACIÓN', 'Cambiado'] }]);
});

// PROBADO ROMPIÉNDOLO (6/11/2026, base 7/0; de a una y restaurando):
//   · un .json de Doory de vuelta en app/image-editor/mako/plantillas/  -> 6/1;
//   · un .webp de Doory de vuelta en public/cv/plantillas/              -> 6/1;
//   · el panel sirviendo una plantilla otra vez (list)                  -> 6/1;
//   · `get` abriendo una de Doory en vez de negarla                     -> 6/1;
//   · la API armando `/cv/plantillas/${slug}.webp`                      -> 6/1;
//   · `documentoDePlantilla` de vuelta en imagen.run.ts                 -> 5/2: también se cae el test 7, que carga
//     el runner en un node suelto y lo importa. El guard no está solo.
// ⚠️ Lee `imagen.run.ts` SIN sacar los comentarios: nombrar `catalogoPlantillas` o `documentoDePlantilla` en un
// comentario de ESE archivo lo pone rojo. Falla cerrado y se deja así: hablar ahí de traerlas de vuelta es,
// justamente, lo que no tiene que pasar desapercibido.
test('3: no quedó ninguna de las 10 plantillas de Doory: ni en el panel «Diseño», ni en la API, ni en disco', async () => {
  // Eran material ajeno adentro del producto: la Attribution Assurance License del código portado aplica «in whole or
  // part, with or without modification», así que sacar el crédito visible (29/10/2026, `editor/CreditoDoory.tsx`) no la
  // desactivaba. Las plantillas de MaKo son propias, se generan por código y se eligen en «Nuevo diseño»
  // (lib/image-editor/plantillas-reales.ts; las cuidan image-plantillas-reales.test.ts y -crear.test.ts, que ya fijan
  // que se puedan guardar como diseño: sin fotos locales y bajo el tope).
  // Desde el 11/11/2026 el panel sirve las plantillas REALES de MaKo (app/image-editor/mako/plantillas.ts): una pantalla vacía
  // en producción es una falla (docs/pruebas/image-10-11.md, caso 17). Lo que este test cuida sigue igual: ninguna de Doory.
  const panel = servicioPlantillas(null);
  const { PLANTILLAS_IMAGEN } = await import('../lib/image-editor/plantillas-reales');
  const propias = new Set(PLANTILLAS_IMAGEN.map((p) => p.id));
  const lista = (await panel.list({ page_size: 100 })).results;
  assert.ok(lista.length > 0, 'el panel «Diseño» quedó vacío otra vez');
  for (const t of lista) assert.ok(propias.has(t.slug) && !DOORY.includes(t.slug), `«${t.slug}» no es una plantilla real de MaKo`);
  assert.deepEqual((await panel.categories()).map((c) => c.name).sort(), [...new Set(PLANTILLAS_IMAGEN.map((p) => p.grupo))].sort(), 'las categorías son los grupos de MaKo, no las de Doory');
  await assert.rejects(() => panel.get(DOORY[0]), /no existe/i, 'una de Doory se puede volver a abrir');
  for (const slug of DOORY) {
    assert.ok(!existsSync(join(RAIZ, 'app/image-editor/mako/plantillas', `${slug}.json`)), `${slug}.json volvió`);
    assert.ok(!existsSync(join(RAIZ, 'public/cv/plantillas', `${slug}.webp`)), `${slug}.webp volvió`);
  }
  // Y la API ya no las ofrece ni las acepta: `listar_plantillas_imagen` trae sólo `reales`, y `crear_diseno_imagen`
  // con un slug que no es de una real contesta que no existe.
  const run = readFileSync(join(RAIZ, 'lib/api-mako/areas/imagen.run.ts'), 'utf8');
  assert.doesNotMatch(run, /catalogoPlantillas|documentoDePlantilla/, 'la API volvió a leer el catálogo de Doory');
  assert.doesNotMatch(run, /cv\/plantillas\/\$\{/, 'la API volvió a mandar la miniatura de una plantilla borrada');
});

test('4: las operaciones del área llevan el permiso de la tab y de admin, y la definición no arrastra el server', () => {
  // 7 del editor + 4 de los carruseles (4/11/2026: estado_carruseles, buscar_carruseles, guardar_carrusel y
  // crear_carrusel_desde_referencia, «Hacer el mío») + 2 de la biblioteca de ejemplos, que edita SÓLO la plataforma
  // (ver_biblioteca_carruseles y cambiar_biblioteca_carruseles: la ven todos los negocios y ningún negocio la cambia)
  // + editar_ejemplo_carrusel (6/11/2026: «Editar» un ejemplo con la IA del negocio)
  // + 3 de Thumbnails (6/11/2026: buscar_thumbnails, guardar_thumbnail y editar_ejemplo_thumbnail, las miniaturas de YouTube).
  assert.equal(DEFS.length, 17);
  const DE_LA_PLATAFORMA = new Set(['ver_biblioteca_carruseles', 'cambiar_biblioteca_carruseles']);
  for (const d of DEFS) {
    assert.equal(d.area, 'imagen');
    const esperado = DE_LA_PLATAFORMA.has(d.id) ? { tab: 'image-editor', rolMinimo: 'admin', soloPlataforma: true } : { tab: 'image-editor', rolMinimo: 'admin' };
    assert.deepEqual(d.gating, esperado, `${d.id}: el permiso es el de la tab (y el de la plataforma, para la biblioteca)`);
    if (DE_LA_PLATAFORMA.has(d.id)) assert.ok(!d.canales.includes('http'), `${d.id}: lo de la plataforma no sale por HTTP`);
  }
  const src = readFileSync(join(RAIZ, 'lib/api-mako/areas/imagen.def.ts'), 'utf8');
  const imports = [...src.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
  assert.deepEqual(imports.sort(), ['../tipos', '@/lib/carruseles/opciones', '@/lib/image-editor/tamanos'], 'una .def.ts sólo importa tipos y datos sin dependencias');
});

test('5: por WhatsApp, un pedido de crear un diseño llega con las herramientas del editor, y no se roba otros pedidos', async () => {
  // 15/10/2026: «creame un flyer…» salía `capturar` dudosa (sin herramientas) aunque `imagen` estaba en AREA_KEYWORDS.
  // PROBADO ROMPIÉNDOLO: sin la regla 6-bis-bis de clasificarIntencion, 0/1.
  const { clasificarIntencion } = await import('../lib/mako-intencion');
  const crea = ['creame un flyer de la inauguración', 'armame un diseño para la promo del viernes', 'diseñame un banner para la web', 'quiero un volante para la feria'];
  for (const t of crea) {
    const v = clasificarIntencion(t, {});
    assert.equal(v.intencion, 'actuar', `«${t}» tiene que ser actuar`);
    assert.deepEqual(v.areas, ['imagen'], `«${t}» tiene que traer el área imagen`);
  }
  for (const t of ['creame una tarea para el flyer', 'haceme una reunión para ver el diseño', 'creame una automatización para los que bajan el flyer']) {
    assert.ok(!(clasificarIntencion(t, {}).areas ?? []).includes('imagen'), `«${t}» no es un diseño`);
  }
});

// ── 6. El turno que CORRE por WhatsApp (clasificador + herramientasDelTurno, el molde de tests/api-mako-cobros.test.ts) ──
// «El área está bien y la herramienta no viaja» es la trampa: se mide con la función que usa lib/mako-doer-in.ts.
// Medido el 15/10/2026: las cuatro frases llegan con su herramienta. PROBADO ROMPIÉNDOLO: sin `imagen` en AREA_KEYWORDS y
// sin la regla 6-bis-bis, ninguna trae una herramienta del editor (0/1).
test('6: por WhatsApp, cada pedido del editor llega al turno con su herramienta', async () => {
  const { execFileSync } = await import('node:child_process');
  const { pathToFileURL } = await import('node:url');
  const { clasificarIntencion } = await import('../lib/mako-intencion');
  const { herramientasDelTurno } = await import('../lib/doer-herramientas');
  const url = (rel: string) => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);
  // Las de siempre son `server-only`: se las pide a un node aparte, como el test de cobros.
  const codigo = `import { MAKO_TOOLS } from ${url('lib/mako-tools.ts')}; import { MAKO_ACCION_TOOLS } from ${url('lib/mako-doer-acciones.ts')}; process.stdout.write(JSON.stringify([...MAKO_TOOLS, ...MAKO_ACCION_TOOLS].map((t) => t.name)));`;
  const deSiempre = (JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 4 << 20 })) as string[]).map((name) => ({ name }));
  const vista = { canal: 'whatsapp' as const, alcance: 'ejecutar' as const, ws: 3, rol: 'admin' as const, tabs: null };
  const FRASES: Array<{ mensaje: string; espera: string[] }> = [
    { mensaje: 'creame un flyer de la inauguración', espera: ['crear_diseno_imagen', 'listar_plantillas_imagen'] },
    { mensaje: 'armame un diseño para la promo del viernes', espera: ['crear_diseno_imagen'] },
    { mensaje: 'cambiá el texto del flyer de la promo por 2x1', espera: ['cambiar_textos_diseno_imagen', 'ver_diseno_imagen', 'listar_disenos_imagen'] },
    { mensaje: 'qué diseños tengo', espera: ['listar_disenos_imagen'] },
  ];
  for (const f of FRASES) {
    const v = clasificarIntencion(f.mensaje, {});
    const t = herramientasDelTurno({ veredicto: v, texto: f.mensaje, agendaAbierta: false, deSiempre, vista, hayPendientes: false });
    const nombres = t.tools.map((x) => x.name);
    for (const e of f.espera) assert.ok(nombres.includes(e), `«${f.mensaje}» llega sin ${e} (viajan: ${nombres.filter((n) => /imagen/.test(n)).join(', ') || 'ninguna del editor'})`);
  }
});

// ── 7. El área se carga fuera de Next ──
// 15/10/2026: imagen.run.ts → lib/image-editor/server.ts → app/image-editor/acceso.ts → lib/tab-access.ts →
// `next/navigation` hacía que CUALQUIER cosa que importara lib/api-mako/runners.ts fuera de Next (un script, un test con
// `--conditions=react-server`, como tests/voz-mako.test.ts #6) muriera con «createContext is not a function».
// PROBADO ROMPIÉNDOLO: con server.ts importando veEditorImagen de '@/app/image-editor/acceso', 0/1.
test('7: el runner del área carga en un node suelto con --conditions=react-server (sin arrastrar next/navigation)', async () => {
  const { execFileSync } = await import('node:child_process');
  const { pathToFileURL } = await import('node:url');
  const href = JSON.stringify(pathToFileURL(join(RAIZ, 'lib/api-mako/areas/imagen.run.ts')).href);
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', `const m = await import(${href}); process.stdout.write(String(Object.keys(m.RUNNERS).length));`], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 4 << 20,
  });
  assert.equal(salida.trim(), '17');
});
