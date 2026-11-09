// =============================================================================
// La tab «Video» (9/11/2026): outliers primero, la plantilla guiada «Mensaje para…», el velo de la pregunta y el modo simple
// =============================================================================
// Martín, 9/11/2026: unificar Video Editor y AI Avatar en UNA tab «Video», con los outliers primero, la plantilla del reel de
// mentores guiada por MaKo («pásame una foto o selecciona de estas», con el resto opacado) y menos botones. El diseño:
// docs/relevo/nube-tab-video.md. Lo que se fija, EJECUTANDO el código:
//   1. cuánto dura un clip según sus palabras, y qué dijo de más o de menos (lib/video-plantillas/medidas.ts);
//   2. la plantilla: sus 6 bloques en orden, los 5 golpes, el guion completo y lo que le falta antes de filmar;
//   3. los outliers: lo inválido afuera, sin repetidos, una fuente caída se dice, una plantilla que no existe no se ofrece;
//   4. la portada: sin `ver`, outliers; con `ver=crear` o `replicar`, las plantillas; `replicar` se valida;
//   5. el estado guiado del proyecto: se sanea lo leído, lo contestado vuelve como hecho de la apertura;
//   6. la galería de la apertura (las fotos cliqueables) tiene sus reglas;
//   7. el velo de la pregunta: sólo con la marca ADENTRO de un chat, y con el aro en ella;
//   8. el modo simple es EN POSITIVO, y la barra y la fila de pestañas lo leen;
//   9. el cableado: el chat del editor lleva el hueco del velo y monta la guía; AI Avatar ya no es una fila de Create.
//
// Correr: node --import tsx --test tests/video-tab.test.ts
// PROBADO ROMPIÉNDOLO (base 9/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chequearGuion, duracionDeClip, palabrasDe, FLOW_VIDEO } from '../lib/video-plantillas/medidas';
import { BLOQUES, GOLPES, clipsDelGuion, creditosDelGuion, guionCompleto, problemasDelGuion, type GuionMensajePara } from '../lib/video-plantillas/mensaje-para';
import { CARPETAS, IDS_PIEZA, PIEZAS } from '../lib/video-plantillas/piezas';
import { FUENTE_MAKO, OUTLIERS_CON_PLANTILLA, juntarOutliers, outlierValido, type FuenteOutliersVideo, type OutlierVideo } from '../lib/video-outliers';
import { replicarDe, rutaReplicar, vistaDeVideo } from '../app/video-editor/vista';
import { conEleccion, conGuion, estadoNuevo, hechosDelProyecto, sanearEstadoGuia } from '../app/video-editor/guia/reglas';
import { PASO, SUPERFICIE_VIDEO_GUIA, opcionesDePersonaje, type HechosVideoGuia } from '../lib/aperturas/video-guia';
import { problemasDeApertura, type Apertura } from '../lib/aperturas/reglas';
import { dibujoDestacado } from '../lib/guia/huecos';
import { CATEGORIAS_SIMPLES, HERRAMIENTAS_SIMPLES, categoriaEnSimple, herramientaEnSimple } from '../app/video-editor/guia/modo-simple-reglas';
import { CATEGORIAS_BIBLIOTECA } from '../app/video-editor/_opencut/components/editor/panels/assets/assets-panel-store';
import { FAMILIAS, SIN_FILA } from '../app/_components/nav';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const GUION: GuionMensajePara = {
  disparo: 'Este es un mensaje para todos los que venden cursos sin resultados.',
  credencial: 'Me llamo Valeria, tengo diez años en ventas y probé de todo.',
  producto: 'Por eso creé un método para que vendas sin perseguir a nadie.',
  beneficio: 'Vas a poder cerrar ventas desde tu celular en minutos.',
  remate: 'Deja de pagar mentorías vacías. Mejor comenta «Método» y te lo regalo.',
  cta: 'Comenta «Método»',
};

test('1. un clip dura lo que piden sus palabras (y no más: Omni repite), y se marca lo que dijo distinto del guion', () => {
  // El caso del 9/11: 16 palabras en 8 s repitió «vendehumo». Con la cuenta, 6 s.
  const dieciseis = 'uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciséis';
  assert.equal(palabrasDe(dieciseis).length, 16);
  assert.equal(duracionDeClip(dieciseis).segundos, 6);
  assert.equal(duracionDeClip(dieciseis).creditos, 6 * FLOW_VIDEO.creditosPorSegundo);
  // Con un gesto, el ritmo baja y el clip es más largo.
  assert.ok(duracionDeClip(dieciseis, { gesto: true }).necesita > duracionDeClip(dieciseis).necesita);
  // Una frase corta no baja del mínimo de Flow; una que no entra en 10 s pide partirse (nunca se pide 10 y se corta).
  assert.equal(duracionDeClip('Hola').segundos, FLOW_VIDEO.minimo);
  const larga = Array.from({ length: 40 }, (_, i) => `palabra${i}`).join(' ');
  assert.equal(duracionDeClip(larga).partir, true);
  assert.equal(duracionDeClip(larga).segundos, FLOW_VIDEO.maximo);
  assert.equal(duracionDeClip('').palabras, 0);
  // El chequeo: exacto (sin tildes ni signos), repetida, faltante, cambiada.
  assert.deepEqual(chequearGuion('Dejá de comentar, ¡ya!', 'deja de comentar ya'), []);
  assert.deepEqual(chequearGuion('en vendehumos', 'en vendehumo en vendehumos').map((d) => d.tipo), ['repetida', 'repetida']);
  assert.deepEqual(chequearGuion('tengo veinticinco años', 'tengo años'), [{ tipo: 'falta', palabra: 'veinticinco' }]);
  assert.deepEqual(chequearGuion('creé una app', 'creé una web'), [{ tipo: 'cambiada', esperada: 'app', oida: 'web' }]);
});

test('2. «Mensaje para…»: los 6 bloques de la referencia en orden, 5 golpes, y el guion completo antes de filmar', () => {
  assert.deepEqual(BLOQUES.map((b) => b.id), ['disparo', 'credencial', 'producto', 'beneficio', 'remate', 'cierre']);
  for (let i = 1; i < BLOQUES.length; i++) assert.ok(BLOQUES[i].tiempo[0] >= BLOQUES[i - 1].tiempo[1] - 1e-9, `${BLOQUES[i].id}: empieza antes de que termine el anterior`);
  assert.equal(BLOQUES.filter((b) => b.mudo).map((b) => b.id).join(), 'cierre', 'el único sin voz es el cierre');
  assert.equal(GOLPES.length, 5);
  assert.ok(!(GOLPES as readonly string[]).includes('remate'), 'el remate no lleva golpe (manual §8.3)');
  for (const b of BLOQUES.filter((x) => !x.mudo)) assert.match(b.molde, /___/, `${b.id}: su molde tiene huecos, no el texto de un cliente`);
  assert.equal(guionCompleto(GUION), true);
  assert.equal(guionCompleto({ ...GUION, cta: '' }), false);
  assert.equal(guionCompleto({ ...GUION, producto: '  ' }), false);
  assert.deepEqual(problemasDelGuion(GUION), []);
  assert.deepEqual(problemasDelGuion({ ...GUION, beneficio: '' }), ['Falta el bloque «Beneficio».']);
  const clips = clipsDelGuion(GUION);
  assert.equal(clips.length, 5);
  assert.equal(creditosDelGuion(GUION), clips.reduce((s, c) => s + c.duracion.creditos, 0));
  // Las piezas: todas con su regla y su carpeta, y sólo el video gasta.
  for (const id of IDS_PIEZA) assert.ok(PIEZAS[id].regla && CARPETAS.some((c) => c.id === PIEZAS[id].carpeta), id);
  assert.deepEqual(IDS_PIEZA.filter((id) => PIEZAS[id].gasta), ['clip-hablado', 'toma-blanca']);
});

const fuente = (id: string): FuenteOutliersVideo => ({ id, nombre: id, leer: async () => ({ ok: true, outliers: [] }) });
const outlier = (x: Partial<OutlierVideo>): OutlierVideo => ({
  id: 'spy:1', fuente: 'spy', red: 'instagram', formato: 'reel', creador: { nombre: 'Alguien', usuario: 'alguien' },
  url: 'https://www.instagram.com/reel/abc/', miniatura: null, titulo: 'Un reel', porque: 'Funciona', duracionS: 20, multiplo: null, plantilla: null, ...x,
});

test('3. los outliers: lo inválido afuera, sin repetidos, lo que se replica primero, y una fuente caída se dice', async () => {
  const spy = fuente('spy');
  const fuera = fuente('fuera');
  const r = juntarOutliers([
    { fuente: FUENTE_MAKO, lectura: await FUENTE_MAKO.leer() },
    { fuente: spy, lectura: { ok: true, outliers: [
      outlier({ id: 'spy:1', multiplo: { veces: 4.2, formato: 'corto', metrica: 'vistas', canal: 'instagram', valor: 42, mediana: 10, comparadas: 9 } }),
      outlier({ id: 'spy:2', url: 'https://www.instagram.com/reel/abc' }), // el mismo link sin la barra: repetido
      outlier({ id: 'spy:3', url: 'http://inseguro.com/x' }), // sin https: afuera
      outlier({ id: 'otra:4', url: 'https://x.com/4' }), // el id no es de su fuente: afuera
      outlier({ id: 'spy:5', url: 'https://x.com/5', plantilla: 'no-existe' }), // una plantilla que no existe no se ofrece
    ] } },
    { fuente: fuera, lectura: { ok: false, motivo: 'No respondió.' } },
  ]);
  assert.deepEqual(r.outliers.map((x) => x.id), ['mako:mensaje-para', 'spy:1', 'spy:5'], 'lo replicable primero, después por múltiplo');
  assert.equal(r.outliers.find((x) => x.id === 'spy:5')?.plantilla, null);
  assert.deepEqual(r.caidas, [{ fuente: 'fuera', nombre: 'fuera', motivo: 'No respondió.' }]);
  // La fuente de MaKo: una por plantilla guiada, válida, sin la imagen de un tercero y sin un múltiplo inventado.
  assert.ok(OUTLIERS_CON_PLANTILLA.length >= 1);
  for (const o of OUTLIERS_CON_PLANTILLA) {
    assert.ok(outlierValido(o), o.id);
    assert.equal(o.miniatura, null);
    assert.equal(o.multiplo?.veces, null);
  }
});

test('4. la portada: outliers primero, «Crear desde cero» con `ver=crear`, y «Replicar» sólo con una plantilla que existe', () => {
  assert.equal(vistaDeVideo({}), 'outliers');
  assert.equal(vistaDeVideo({ ver: 'crear' }), 'crear');
  assert.equal(vistaDeVideo({ replicar: 'mensaje-para' }), 'crear');
  assert.equal(replicarDe({ replicar: 'mensaje-para' }), 'mensaje-para');
  assert.equal(replicarDe({ replicar: 'inventada' }), null);
  assert.equal(replicarDe({}), null);
  assert.equal(rutaReplicar('mensaje-para'), '/video-editor?ver=crear&replicar=mensaje-para');
  // La página lee la vista y monta los outliers sin el motor (el server no importa un valor del motor).
  const page = sinComentarios(leer('app/video-editor/page.tsx'));
  assert.match(page, /if \(vistaDeVideo\(q\) === 'outliers'\)/);
  assert.match(page, /<OutliersVideo portada=\{await leerOutliersVideo\(\)\} \/>/);
  const portada = leer('app/video-editor/OutliersVideo.tsx');
  assert.match(portada, /role="alert"[\s\S]*?<ReportarASoporte \/>/, 'una fuente caída se dice, con «Reportar a Soporte»');
  assert.doesNotMatch(sinComentarios(portada), /_opencut/, 'la portada no carga el motor');
});

test('5. el estado guiado: se sanea lo leído y lo contestado vuelve como hecho de la apertura', () => {
  assert.equal(sanearEstadoGuia(null), null);
  assert.equal(sanearEstadoGuia({ v: 1, plantilla: 'inventada' }), null, 'una plantilla que no existe no es un estado');
  assert.equal(sanearEstadoGuia({ v: 2, plantilla: 'mensaje-para' }), null, 'otra versión no se lee a ciegas');
  const crudo = { v: 1, plantilla: 'mensaje-para', creado: 5, elecciones: { [PASO.personaje]: 'foto:f1', 'otra:clave': 'x', [PASO.voz]: 7 }, guion: { disparo: 'Hola', inventado: 'x' }, simple: 'no' };
  const e = sanearEstadoGuia(crudo);
  assert.ok(e);
  assert.deepEqual(e.elecciones, { [PASO.personaje]: 'foto:f1' }, 'sólo claves de la guía, con valor de texto');
  assert.deepEqual(e.guion, { disparo: 'Hola' });
  assert.equal(e.simple, true, 'el modo simple sólo se apaga con `false`');
  let x = estadoNuevo('mensaje-para', 1);
  assert.equal(hechosDelProyecto(x).vioReferencia, false);
  x = conEleccion(x, PASO.referencia, 'vista');
  x = conGuion(x, GUION);
  const h = hechosDelProyecto(x);
  assert.equal(h.vioReferencia, true);
  assert.equal(h.guionListo, true);
  assert.equal(h.plantilla, 'mensaje-para');
  assert.deepEqual(hechosDelProyecto(null).plantilla, null, 'un proyecto sin estado no es de plantilla: MaKo no guía');
  // De punta a punta: lo contestado mueve a MaKo al paso siguiente.
  const hechos: HechosVideoGuia = { proyecto: 'p1', ...h, fotos: [{ id: 'f1', url: 'https://x.supabase.co/f1.jpg' }], personajes: [], vozClonada: true, ocupado: false };
  assert.equal(SUPERFICIE_VIDEO_GUIA.apertura({ ...hechos, guion: {}, guionListo: false }, {})?.id, PASO.guion, 'sin guion, MaKo pide el guion antes que la foto');
  assert.equal(SUPERFICIE_VIDEO_GUIA.apertura(hechos, {})?.id, PASO.personaje);
  const conFoto = hechosDelProyecto(conEleccion(x, PASO.personaje, 'foto:f1'));
  assert.equal(SUPERFICIE_VIDEO_GUIA.apertura({ ...hechos, ...conFoto }, {})?.id, PASO.voz);
  // Sin saber si tiene voz, el paso se saltea y MaKo sigue (antes la guía se quedaba muda ahí para siempre).
  assert.equal(SUPERFICIE_VIDEO_GUIA.apertura({ ...hechos, ...conFoto, vozClonada: null }, {})?.id, PASO.fondo);
  // La pregunta de los clips se contesta con un botón (una pregunta con botones que no la contestan no sirve).
  const listo = { ...hechos, ...conFoto, voz: 'clonada', fondo: 'corcho' };
  const clips = SUPERFICIE_VIDEO_GUIA.apertura(listo, {});
  assert.equal(clips?.id, PASO.clips);
  assert.ok(clips?.botones.some((b) => b.tipo === 'respuesta'), 'la pregunta de los clips sin un botón que la conteste');
  assert.equal(SUPERFICIE_VIDEO_GUIA.apertura(listo, { [PASO.clips]: 'alcanzan' }), null, 'contestada la última, MaKo calla');
});

test('6. la galería de la apertura: las fotos y los personajes cliqueables, con sus reglas', () => {
  const op = opcionesDePersonaje({
    personajes: [{ id: 'l1', url: 'https://x.co/l1.jpg', nombre: 'En la oficina' }],
    fotos: [{ id: 'f1', url: 'https://x.co/f1.jpg' }, { id: 'f2', url: 'javascript:alert(1)' }],
  });
  assert.deepEqual(op.map((o) => o.valor), ['personaje:l1', 'foto:f1'], 'los personajes primero, y una imagen que no es https afuera');
  const base: Apertura = { id: 'video-guia:personaje', alcance: 'entidad', texto: '¿Cuál uso?', botones: [{ tipo: 'hacer', rotulo: 'Subir una foto', accion: 'x' }, { tipo: 'callar', rotulo: 'Ahora no' }] };
  assert.deepEqual(problemasDeApertura({ ...base, galeria: op }, { primerPaso: true }), []);
  assert.ok(problemasDeApertura({ ...base, galeria: [] }, { primerPaso: true }).some((p) => /galería/.test(p)));
  assert.ok(problemasDeApertura({ ...base, galeria: [op[0], op[0]] }, { primerPaso: true }).some((p) => /contestan lo mismo/.test(p)));
  assert.ok(problemasDeApertura({ ...base, galeria: [{ ...op[0], imagen: 'data:image/png;base64,x' }] }, { primerPaso: true }).some((p) => /imagen/.test(p)));
  // La pieza dibuja la galería y tocar una opción es contestar su valor.
  const pieza = sinComentarios(leer('app/_chat/AperturaMako.tsx'));
  assert.match(pieza, /a\.galeria\.map\(\(o\) => \(/);
  assert.match(pieza, /estado\.elegir\(\{ tipo: 'respuesta', rotulo: o\.rotulo, valor: o\.valor \}\)/);
});

test('7. el velo de la pregunta: sólo con la marca ADENTRO de un chat, y el aro en ella', () => {
  const v = { ancho: 1440, alto: 900 };
  const chat = { x: 0, y: 0, ancho: 360, alto: 900 };
  const marca = { x: 20, y: 600, ancho: 300, alto: 120 };
  const d = dibujoDestacado(marca, [chat], v);
  assert.ok(d);
  assert.deepEqual(d.aro, marca);
  assert.deepEqual(d.huecos, [chat], 'el hueco es el chat; la marca adentro no suma otro');
  assert.equal(dibujoDestacado({ x: 600, y: 100, ancho: 100, alto: 40 }, [chat], v), null, 'fuera de un chat no se oscurece nada');
  assert.equal(dibujoDestacado(null, [chat], v), null);
  assert.equal(dibujoDestacado(marca, [], v), null, 'sin un chat a la vista, no hay velo');
  assert.equal(dibujoDestacado({ ...marca, alto: 0 }, [chat], v), null);
  const velo = sinComentarios(leer('app/_ui/guia/VeloGuia.tsx'));
  assert.match(velo, /const destacando = !clavePaso && e\.destacado;/, 'la guía que señala manda sobre la pregunta marcada');
  assert.match(velo, /profundidadModales\(\) > 0 \? null/, 'con un modal arriba (el editor del guion) no se dibuja');
});

test('8. el modo simple es EN POSITIVO, y la barra y las pestañas lo leen', () => {
  for (const c of CATEGORIAS_SIMPLES) assert.ok((CATEGORIAS_BIBLIOTECA as readonly string[]).includes(c), `${c}: no es una pestaña`);
  assert.equal(categoriaEnSimple('stickers'), false);
  assert.equal(categoriaEnSimple('una-pestana-nueva'), false, 'lo nuevo nace escondido');
  assert.equal(herramientaEnSimple('linea-dividir'), true);
  assert.equal(herramientaEnSimple('linea-iman'), false);
  assert.ok(HERRAMIENTAS_SIMPLES.has('linea-deshacer') && HERRAMIENTAS_SIMPLES.has('linea-generar-subtitulos'));
  const barra = sinComentarios(leer('app/video-editor/_opencut/timeline/components/timeline-toolbar.tsx'));
  assert.match(barra, /\(!simple \|\| herramientaEnSimple\(h\.id\)\)/);
  const fila = sinComentarios(leer('app/video-editor/_opencut/components/editor/panels/assets/tabbar.tsx'));
  assert.match(fila, /CATEGORIAS_BIBLIOTECA\.filter\(\(c\) => !simple \|\| categoriaEnSimple\(c\)\)/);
  // El modo simple no importa el motor (la fila de pestañas se arma en un test con esbuild).
  assert.doesNotMatch(sinComentarios(leer('app/video-editor/guia/modo-simple.ts')), /_opencut/);
  const cabecera = sinComentarios(leer('app/video-editor/_opencut/components/editor/editor-header.tsx'));
  assert.match(cabecera, /\{!simple && <MenuDiseno \/>\}/);
  assert.match(cabecera, /guia\.simple \? "Todas las herramientas" : "Menos herramientas"/);
});

test('9. el cableado: el chat del editor lleva el hueco del velo y monta la guía; AI Avatar ya no es una fila de Create', () => {
  const chat = sinComentarios(leer('app/video-editor/_opencut/chat/PanelChat.tsx'));
  assert.match(chat, /aria-label="Editar con IA" data-mako-chat="">/);
  assert.match(chat, /<GuiaEnElChat proyectoId=\{proyectoId\} ocupado=\{hilo\.corriendo\} quien=\{QUIEN\} \/>/);
  assert.match(chat, /libre: !hilo\.corriendo && !guiado,/, 'con la guía, la pregunta de los subtítulos calla: un paso por pantalla');
  const guia = sinComentarios(leer('app/video-editor/guia/GuiaEnElChat.tsx'));
  assert.match(guia, /<div data-mako-destacado="" /);
  assert.match(guia, /destacarEnElChat\(!!idActual\)/);
  // Lo contestado queda en el PROYECTO.
  assert.match(guia, /if \(b\.tipo === 'respuesta' && estado\.apertura\) cambiarGuia\(proyectoId, \(x\) => conEleccion\(x, estado\.apertura!\.id, b\.valor\)\);/);
  const create = FAMILIAS.find((f) => f.key === 'create');
  const keys = new Set((create?.bloques ?? []).flat().map((it) => it.key));
  assert.ok(keys.has('video-editor'));
  assert.ok(!keys.has('ai-avatar'), 'AI Avatar volvió a ser una fila de Create: es «Tu personaje con IA» de Video');
  assert.ok(SIN_FILA.some((it) => it.key === 'ai-avatar' && it.href === '/ai-avatar'), 'la key de AI Avatar se perdió: la piden su pantalla, la API y las capas');
});

// ── PROBADO ROMPIÉNDOLO (9/11/2026), base 9/0. Cada rotura, 1 fallo y 8 pases ─────────────────────────────────────────────
// R1 un clip que no entra en 10 s ya no pide partirse · R2 la palabra repetida pasa a «de más» · R3 el guion completo sin el
// pedido del cierre · R4 sin el repetido por link · R5 «Replicar» con una plantilla que no existe · R6 `replicar` sin validar ·
// R7 un estado de una plantilla inventada · R8 dos opciones de la galería con el mismo valor · R9 el velo marca fuera del chat ·
// R10 «stickers» en el modo simple · R11 el chat del editor sin `data-mako-chat` · R12 lo contestado no queda en el proyecto ·
// R13 MaKo saltea el paso del guion (antes de sumar su caso al test 5, esta rotura daba 0/9: la cubría sólo tests/aperturas).
// Renombrar una variable local del código (`entero` → `enteroDeSegundos` en medidas.ts) lo deja 9/0.
