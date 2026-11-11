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
//   5. el estado guiado del proyecto: se sanea lo leído, lo contestado vuelve como hecho de la apertura, y un paso salteado se
//      saltea (sigue el siguiente) y se retoma desde la lista de pasos: la memoria es el proyecto, no la de las aperturas;
//   6. la galería de la apertura (las fotos cliqueables) tiene sus reglas;
//   7. el velo de la pregunta: sólo con la marca ADENTRO de un chat, y con el aro en ella;
//   8. el modo simple es EN POSITIVO, la barra y la fila de pestañas lo leen, y la pestaña abierta no se esconde;
//   9. el cableado: el chat del editor lleva el hueco del velo y monta la guía; lo de siempre calla sólo MIENTRAS MaKo pregunta;
//      AI Avatar sigue como fila de Create mientras Video sea sólo de Pro (Esencial no tiene otra puerta al personaje);
//  10. «el inicio» del editor es la lista de proyectos (`?ver=crear`), no los outliers, y «Replicar» no arma dos proyectos.
//
// Correr: node --import tsx --test tests/video-tab.test.ts
// PROBADO ROMPIÉNDOLO (base 10/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chequearGuion, duracionDeClip, palabrasDe, FLOW_VIDEO } from '../lib/video-plantillas/medidas';
import { BLOQUES, GOLPES, clipsDelGuion, creditosDelGuion, guionCompleto, problemasDelGuion, type GuionMensajePara } from '../lib/video-plantillas/mensaje-para';
import { CARPETAS, IDS_PIEZA, PIEZAS } from '../lib/video-plantillas/piezas';
import { FUENTE_MAKO, OUTLIERS_CON_PLANTILLA, juntarOutliers, outlierValido, outliersDeSpy, outliersPropios, tituloDeReel, type FuenteOutliersVideo, type OutlierVideo } from '../lib/video-outliers';
import { replicarDe, rutaReplicar, vistaDeVideo } from '../app/video-editor/vista';
import { conEleccion, conGuion, estadoNuevo, hechosDelProyecto, sanearEstadoGuia, sinEleccion } from '../app/video-editor/guia/reglas';
import { PASO, SUPERFICIE_VIDEO_GUIA, VALOR, opcionesDePersonaje, pasosDeLaGuia, type HechosVideoGuia } from '../lib/aperturas/video-guia';
import { problemasDeApertura, type Apertura } from '../lib/aperturas/reglas';
import { dibujoDestacado } from '../lib/guia/huecos';
import { CATEGORIAS_SIMPLES, HERRAMIENTAS_SIMPLES, categoriaEnSimple, herramientaEnSimple, pestanasVisibles } from '../app/video-editor/guia/modo-simple-reglas';
import { CATEGORIAS_BIBLIOTECA } from '../app/video-editor/_opencut/components/editor/panels/assets/assets-panel-store';
import { FAMILIAS } from '../app/_components/nav';
import { NAV_SOLO_PRO } from '../lib/plan-esencial-reglas';
import { RUTA_INICIO } from '../app/video-editor/_opencut/chat/pedidos';
import { RUTA_CREAR_VIDEO } from '../app/video-editor/vista';

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

// 3b, PROBADO ROMPIÉNDOLO (11/11/2026): la vidriera sin conVariedad → rojo («una sola cuenta no llena la primera pantalla»);
// FUENTES_OUTLIERS_VIDEO sólo con FUENTE_MAKO → rojo.
test('3b. los reels de Spy (11/11/2026): el «×» de su cuenta, su miniatura y el gancho de título; la vidriera, variada y reciente', () => {
  // Martín con la captura de la portada: UNA tarjeta, sin imagen. Spy ya trajo los reels de las cuentas que el negocio sigue.
  const DIA = 86_400_000;
  const ahora = Date.parse('2026-11-11T12:00:00Z');
  const cuentas = [{ id: 7, nombre: 'Alguien', instagram: 'alguien', avatar: 'https://x.supabase.co/a.jpg' }, { id: 8, nombre: 'Sin IG', instagram: null }];
  const reel = (id: number, dias: number, vistas: number | null, extra: Record<string, unknown> = {}) => ({
    id, competidor_id: 7, canal: 'instagram', tipo: 'reel', publicada_en: new Date(ahora - dias * DIA).toISOString(),
    vistas, megusta: 10, comentarios: 2, url: `https://www.instagram.com/p/r${id}/`, miniatura: `https://x.supabase.co/m${id}.jpg`,
    texto: `Primera línea ${id}\nsegunda`, analisis: null, ...extra,
  });
  // Diez reels de 1.000 vistas y uno de 10.000: ése es el 10×.
  const piezas = [
    ...Array.from({ length: 10 }, (_, i) => reel(i + 1, 20 + i * 3, 1000)),
    reel(50, 40, 10_000, { analisis: { gancho: 'El gancho que leyó Spy' } }),
    reel(51, 41, 5000, { dejo_de_verse_en: '2026-11-01T00:00:00Z' }), // ya no se ve: afuera
    { ...reel(52, 30, 500), tipo: 'publicacion' }, // un carrusel: no es un reel
    { ...reel(53, 30, 500), competidor_id: 8 }, // una cuenta sin Instagram no se lee
  ];
  const xs = outliersDeSpy(piezas as never, cuentas, ahora);
  assert.equal(xs.length, 11);
  const top = xs.find((x) => x.id === 'spy:50')!;
  assert.equal(top.multiplo?.veces, 10);
  assert.equal(top.titulo, 'El gancho que leyó Spy');
  assert.equal(top.miniatura, 'https://x.supabase.co/m50.jpg');
  assert.deepEqual(top.creador, { nombre: 'Alguien', usuario: 'alguien', foto: 'https://x.supabase.co/a.jpg', competidorId: 7 });
  assert.equal(xs.find((x) => x.id === 'spy:1')!.titulo, 'Primera línea 1', 'sin gancho, la primera línea del pie');
  assert.equal(tituloDeReel({ texto: '', analisis: null }, { nombre: 'X', instagram: 'x' }), 'Reel de @x');
  // La vidriera: la plantilla de MaKo primero, después el 10×.
  const r = juntarOutliers([{ fuente: FUENTE_MAKO, lectura: { ok: true, outliers: OUTLIERS_CON_PLANTILLA } }, { fuente: fuente('spy'), lectura: { ok: true, outliers: xs } }], ahora);
  assert.deepEqual(r.outliers.slice(0, 2).map((x) => x.id), ['mako:mensaje-para', 'spy:50']);
  // Con 12 o más en los últimos 90 días, los viejos quedan afuera; con menos, se ve todo.
  const muchos = Array.from({ length: 14 }, (_, i) => outlier({ id: `spy:${100 + i}`, url: `https://x.com/${100 + i}`, publicada: new Date(ahora - 10 * DIA).toISOString(), creador: { nombre: `C${i}`, usuario: `c${i}` } }));
  const viejo = outlier({ id: 'spy:999', url: 'https://x.com/999', publicada: new Date(ahora - 200 * DIA).toISOString() });
  const conVentana = juntarOutliers([{ fuente: fuente('spy'), lectura: { ok: true, outliers: [...muchos, viejo] } }], ahora);
  assert.ok(!conVentana.outliers.some((x) => x.id === 'spy:999'), 'con 14 recientes, el de hace 200 días no va');
  const pocos = juntarOutliers([{ fuente: fuente('spy'), lectura: { ok: true, outliers: [muchos[0], viejo] } }], ahora);
  assert.ok(pocos.outliers.some((x) => x.id === 'spy:999'), 'con pocos recientes, se ve todo');
  // Como mucho 2 del mismo creador cada 12.
  const deUno = Array.from({ length: 6 }, (_, i) => outlier({ id: `spy:${200 + i}`, url: `https://x.com/${200 + i}`, publicada: new Date(ahora - 5 * DIA).toISOString(), multiplo: { veces: 10 - i, formato: 'corto', metrica: 'vistas', canal: 'instagram', valor: 1, mediana: 1, comparadas: 9 } }));
  const otros = Array.from({ length: 10 }, (_, i) => outlier({ id: `spy:${300 + i}`, url: `https://x.com/${300 + i}`, publicada: new Date(ahora - 5 * DIA).toISOString(), creador: { nombre: `O${i}`, usuario: `o${i}` } }));
  const variada = juntarOutliers([{ fuente: fuente('spy'), lectura: { ok: true, outliers: [...deUno, ...otros] } }], ahora);
  assert.ok(variada.outliers.slice(0, 12).filter((x) => x.creador.usuario === 'alguien').length <= 2, 'una sola cuenta no llena la primera pantalla');
  // Lo propio por Zernio: su cuenta contra su propia mediana; lo que Zernio no sincronizó no tiene números (su 0 no es «nadie»).
  const pub = (i: number, vistas: number, extra: Record<string, unknown> = {}) => ({
    id: `ig${i}`, fecha: new Date(ahora - (20 + i * 2) * DIA).toISOString(), tipo: 'reel', texto: `Mío ${i}`, url: `https://www.instagram.com/reel/m${i}/`,
    miniatura: `https://cdn.example.com/m${i}.jpg`, alcance: null, vistas, impresiones: null, meGusta: 5, comentarios: 1, compartidos: null, guardados: null,
    interaccionPct: null, deZernio: true, sinMetricas: null, ...extra,
  });
  const propios = outliersPropios({ usuario: 'minegocio', nombre: 'Mi negocio' }, [
    ...Array.from({ length: 8 }, (_, i) => pub(i, 1000)), pub(20, 5000), pub(21, 0, { sinMetricas: 'pendiente' }), { ...pub(22, 900), tipo: 'post' },
  ] as never, ahora);
  assert.equal(propios.length, 10, 'sólo los reels');
  assert.equal(propios.find((x) => x.id === 'propio:ig20')?.multiplo?.veces, 5);
  assert.equal(propios.find((x) => x.id === 'propio:ig21')?.vistas, null, 'sin sincronizar, sin números');
  assert.ok(propios.every((x) => outlierValido(x)));
  // La portada: la fuente de Spy enchufada, la tarjeta de Image, «MaKo te guía» y cómo llenarla sin cuentas.
  const servidor = sinComentarios(leer('lib/video-outliers-servidor.ts'));
  assert.match(servidor, /FUENTES_OUTLIERS_VIDEO: readonly FuenteOutliersVideo\[\] = \[FUENTE_MAKO, FUENTE_SPY, FUENTE_PROPIOS\]/);
  assert.match(servidor, /if \(r\.error === 'sin-clave' \|\| r\.error === 'sin-cuenta' \|\| r\.error === 'sin-analytics'\) return \{ ok: true, outliers: \[\] \};/, 'sin Zernio no es una caída');
  assert.match(servidor, /podarVencido\(f\)/, 'los textos y números vencidos de Spy no se muestran');
  const portada = sinComentarios(leer('app/video-editor/OutliersVideo.tsx'));
  assert.match(portada, /<span className=\{o\.marca\}>MaKo te guía<\/span>/);
  assert.doesNotMatch(portada, /rotuloCortoDeMultiplo/, '«Sin datos de su cuenta» no va en la tarjeta de la plantilla');
  assert.match(portada, /<img src=\{x\.miniatura\} alt="" className=\{s\.miniImagen\}/);
  assert.match(portada, /<Link href="\/competitor-spy" className=\{s\.pastilla\}>\+ Seguir cuentas<\/Link>/);
  // En el teléfono también, como Image: los outliers primero (dos columnas, sin «Replicar»: el guiado es de la computadora).
  const movil = sinComentarios(leer('app/m/video-editor/page.tsx'));
  assert.match(movil, /if \(vistaDeVideo\(q\) === 'outliers'\) \{[\s\S]*?<OutliersVideo portada=\{await leerOutliersVideo\(\)\} telefono rutaCrear="\/video-editor\?ver=crear" \/>/);
  assert.match(portada, /<div className=\{s\.raiz\} data-telefono=\{telefono \? 'si' : undefined\}>/);
  assert.match(portada, /\{x\.plantilla && !telefono && <Link href=\{rutaReplicar\(x\.plantilla\)\}/);
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

test('5. el estado guiado: se sanea lo leído, lo contestado vuelve como hecho, y lo salteado se saltea y se retoma', () => {
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
  const hechos: HechosVideoGuia = { proyecto: 'p1', ...h, fotos: [{ id: 'f1', url: 'https://x.supabase.co/f1.jpg' }], personajes: [], fotosLeidas: true, vozClonada: true, ocupado: false };
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
  assert.equal(SUPERFICIE_VIDEO_GUIA.apertura({ ...listo, clips: VALOR.alcanzan }, {}), null, 'contestada en el proyecto, también');
  // ⚠️ La memoria es el PROYECTO (la revisión del 9/11): «Ahora no» saltea ESE paso y MaKo sigue con el siguiente. Con la memoria
  // de las aperturas, callar el primer paso que faltaba callaba la guía entera.
  let s = conEleccion(x, PASO.personaje, VALOR.saltado);
  const hs = { ...hechos, ...hechosDelProyecto(s) };
  assert.equal(hs.personaje, null, 'un «saltado» no es un personaje elegido');
  assert.deepEqual(hs.saltados, [PASO.personaje]);
  assert.equal(SUPERFICIE_VIDEO_GUIA.apertura(hs, {})?.id, PASO.voz, 'salteado el personaje, sigue la voz');
  const lista = pasosDeLaGuia(hs);
  assert.equal(lista.find((p) => p.id === PASO.personaje)?.estado, 'saltado', 'la lista lo muestra para retomarlo');
  assert.equal(lista.find((p) => p.id === PASO.guion)?.estado, 'listo');
  s = sinEleccion(s, PASO.personaje);
  assert.equal(SUPERFICIE_VIDEO_GUIA.apertura({ ...hechos, ...hechosDelProyecto(s) }, {})?.id, PASO.personaje, '«Retomar» lo vuelve a preguntar');
  // Sin voz leída, el paso de la voz ni se lista (no se pregunta a ciegas).
  assert.ok(!pasosDeLaGuia({ ...hechos, vozClonada: null }).some((p) => p.id === PASO.voz));
  // Un guion con un bloque que no entra en 10 s NO está listo, y los clips esperan al guion.
  const largo = { ...GUION, beneficio: Array.from({ length: 40 }, (_, i) => `palabra${i}`).join(' ') };
  assert.equal(hechosDelProyecto(conGuion(x, largo)).guionListo, false, 'un bloque que pide partirse deja el guion sin cerrar');
  assert.equal(SUPERFICIE_VIDEO_GUIA.apertura({ ...listo, guionListo: false, saltados: [PASO.guion] }, {}), null, 'sin guion listo, los clips no se suman');
  // «No pude leer tus fotos» no es «no tienes fotos».
  assert.match(SUPERFICIE_VIDEO_GUIA.apertura({ ...hechos, fotos: [], fotosLeidas: false }, {})?.texto ?? '', /No pude leer tus fotos/);
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
  assert.match(fila, /pestanasVisibles\(CATEGORIAS_BIBLIOTECA, simple, activeTab\)\.map/);
  // La abierta no se esconde (otro panel abre «Efectos»): sin eso, el panel mostraba una pestaña que la fila no tenía.
  assert.deepEqual(pestanasVisibles(['multimedia', 'efectos', 'stickers'], true, 'efectos'), ['multimedia', 'efectos']);
  assert.deepEqual(pestanasVisibles(['multimedia', 'efectos', 'stickers'], true, 'multimedia'), ['multimedia']);
  assert.deepEqual(pestanasVisibles(['multimedia', 'efectos', 'stickers'], false, 'multimedia'), ['multimedia', 'efectos', 'stickers']);
  // El modo simple no importa el motor (la fila de pestañas se arma en un test con esbuild).
  assert.doesNotMatch(sinComentarios(leer('app/video-editor/guia/modo-simple.ts')), /_opencut/);
  const cabecera = sinComentarios(leer('app/video-editor/_opencut/components/editor/editor-header.tsx'));
  assert.match(cabecera, /\{!simple && <MenuDiseno \/>\}/);
  assert.match(cabecera, /guia\.simple \? "Todas las herramientas" : "Menos herramientas"/);
});

test('9. el cableado: el chat del editor lleva el hueco del velo y monta la guía; lo de siempre calla sólo mientras MaKo pregunta', () => {
  const chat = sinComentarios(leer('app/video-editor/_opencut/chat/PanelChat.tsx'));
  assert.match(chat, /aria-label="Editar con IA" data-mako-chat="">/);
  assert.match(chat, /<GuiaEnElChat proyectoId=\{proyectoId\} ocupado=\{hilo\.corriendo\} quien=\{QUIEN\} onHablando=\{setGuiaHablando\} \/>/);
  // MIENTRAS PREGUNTA (no «el proyecto es guiado»): con todo contestado, vuelven las sugerencias de siempre.
  assert.match(chat, /libre: !hilo\.corriendo && !guiaHablando,/, 'con MaKo preguntando, la pregunta de los subtítulos calla');
  assert.doesNotMatch(chat, /useGuiaVideo/, 'lo de siempre no calla por ser un proyecto guiado');
  const guia = sinComentarios(leer('app/video-editor/guia/GuiaEnElChat.tsx'));
  assert.match(guia, /<div data-mako-destacado="" /);
  assert.match(guia, /destacarEnElChat\(!!idActual\)/);
  assert.match(guia, /if \(idActual\) desplegarCrear\(TAB_CREAR\)/, 'con la tarjeta plegada, la pregunta no se veía');
  // Lo contestado Y lo salteado quedan en el PROYECTO, no en la memoria de las aperturas.
  assert.doesNotMatch(guia, /useApertura\(/, 'la memoria de las aperturas calla la guía entera');
  assert.match(guia, /\.tipo === 'respuesta'\) \{\s*cambiarGuia\(proyectoId, \((\w+)\) => conEleccion\(\1, apertura\.id, \w+\.valor\)\);/);
  assert.match(guia, /\.tipo === 'callar'\) \{\s*cambiarGuia\(proyectoId, \((\w+)\) => conEleccion\(\1, apertura\.id, VALOR\.saltado\)\);/);
  assert.match(guia, /onRetomar=\{\((\w+)\) => cambiarGuia\(proyectoId, \((\w+)\) => sinEleccion\(\2, \1\)\)\}/);
  // La foto nueva es la que no estaba antes (no la última de la lista), y lo que la ruta salteó se dice.
  assert.match(guia, /\.find\(\((\w+)\) => !\w+\.has\(\1\.id\)\)/);
  assert.match(guia, /for \(const (\w+) of \w+\.warnings \?\? \[\]\) toast\.error\(\1\)/);
  // AI Avatar FUERA DE LA BARRA desde el 11/11/2026: Martín, «[AI Avatar] no debería estar, eso ya lo hablamos muchas veces». El
  // ítem queda (`fueraDeLaBarra`, su key es contrato) y la RUTA SIGUE: la abren «Tu personaje con IA» de Video y los botones de la
  // biblioteca de anuncios, la guía de video, los carruseles y el CoPilot. Mientras Video sea sólo de Pro, ésas son las puertas de
  // un Esencial a su personaje: si la ruta redirigiera a Video, un Esencial se quedaba sin ninguna.
  const create = FAMILIAS.find((f) => f.key === 'create');
  const items = (create?.bloques ?? []).flat();
  assert.ok(items.some((it) => it.key === 'video-editor'));
  const avatar = items.find((it) => it.key === 'ai-avatar');
  assert.ok(avatar, 'el ítem de AI Avatar sigue: su key es contrato');
  assert.equal(avatar?.fueraDeLaBarra, true, 'y no se dibuja');
  if (NAV_SOLO_PRO.has('video-editor')) assert.doesNotMatch(leer('app/ai-avatar/page.tsx'), /redirect\([^)]*video-editor/,'Video es sólo de Pro: /ai-avatar no puede mandar a Video');
});

test('10. «el inicio» del editor es la lista de proyectos, y «Replicar» no arma dos', () => {
  // `/video-editor` a secas son los outliers: «Volver al inicio» y borrar el proyecto abierto llevan a la lista.
  assert.equal(RUTA_INICIO, RUTA_CREAR_VIDEO);
  const cabecera = sinComentarios(leer('app/video-editor/_opencut/components/editor/editor-header.tsx'));
  assert.match(cabecera, /const volverAlInicio = \(\) => void salir\(RUTA_CREAR_VIDEO\);/);
  assert.doesNotMatch(cabecera, /rutaEditor\("\/video-editor"\)/);
  assert.doesNotMatch(sinComentarios(leer('app/video-editor/_opencut/actions/use-editor-actions.ts')), /rutaEditor\("\/video-editor"\)/);
  const cliente = sinComentarios(leer('app/video-editor/VideoEditorCliente.tsx'));
  assert.match(cliente, /if \(p\.id === actual\) router\.push\(RUTA_CREAR_VIDEO\);/);
  assert.match(cliente, /if \(creando\.current\) return null;\s*creando\.current = true;/, 'un doble clic armaba dos proyectos');
  assert.match(cliente, /if \(!montado\.current\) return null;/);
});

// ── PROBADO ROMPIÉNDOLO (9/11/2026), base 9/0 → 10/0 con la revisión. Cada rotura, 1 fallo y el resto pases ─────────────────
// R1 un clip que no entra en 10 s ya no pide partirse · R2 la palabra repetida pasa a «de más» · R3 el guion completo sin el
// pedido del cierre · R4 sin el repetido por link · R5 «Replicar» con una plantilla que no existe · R6 `replicar` sin validar ·
// R7 un estado de una plantilla inventada · R8 dos opciones de la galería con el mismo valor · R9 el velo marca fuera del chat ·
// R10 «stickers» en el modo simple · R11 el chat del editor sin `data-mako-chat` · R12 lo contestado no queda en el proyecto ·
// R13 MaKo saltea el paso del guion (antes de sumar su caso al test 5, esta rotura daba 0/9: la cubría sólo tests/aperturas).
// Con la revisión (base 10/0, cada rotura 1/9): R14 «Ahora no» no deja el paso salteado · R15 la pestaña abierta se esconde en
// simple · R16 «el inicio» vuelve a los outliers · R17 sin el candado de «crear» · R18 un «saltado» cuenta como valor del paso ·
// R19 MaKo no saltea lo salteado · R20 un guion con un bloque que no entra en 10 s cuenta como listo · R21 lo de siempre calla por
// ser un proyecto guiado (no mientras MaKo pregunta). Y en sus tests: sin `!estadoApertura.apertura` en las píldoras →
// tests/iniciativa-video 1/1; sin <EnVivo /> en la barra → tests/video-editor-enjambre 1/13.
// Renombrar una variable local del código (`entero` → `enteroDeSegundos` en medidas.ts) lo deja 9/0.
