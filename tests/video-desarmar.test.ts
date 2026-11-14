// =============================================================================
// Desarmar un video de la competencia (ticket 97): lo que se fija
// =============================================================================
// Martín (ticket 97): «extraer al 100 % con ingeniería inversa cómo está construido ese video… para después replicarlo».
//   1. La respuesta de Gemini se lee como dato de un tercero: planos en orden y pegados de 0 al final, tiempos dentro del video,
//      colores que son colores, y lo corregido queda en `dudas`.
//   2. Los cuadros por segundo: un reel a 4–5 (un corte de medio segundo se ve), un video largo a 1–2 y con resolución baja.
//   3. Los números los mide el código (`ritmoDe`), no la IA.
//   4. El estilo de subtítulos más parecido sale de la galería REAL del editor.
//   5. La receta vuelve del chat: la Edición automática la lee aunque el video no esté en RECETAS.
//   6. La plantilla «toca para reemplazar»: la pista principal pegada de 0 al final, un hueco por plano, efectos, fuentes y
//      estilo de subtítulos que EXISTEN en el motor; más de cuatro textos a la vez y lo que pasa de 3 minutos se dicen.
//   7. El paquete VIDEO.md cumple la especificación v1 (los archivos, la línea de tiempo = los planos, el mapa).
//   8. Las claves y las fuentes (Outliers y Spy) rechazan lo que no es un video.
//   9. El cableado: «Desarmar» en las dos tarjetas de Outliers y en Spy; la ruta con la IA del negocio; el chat guardado
//      antes de la carga entera.
//
// Correr: node --import tsx --test tests/video-desarmar.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ESQUEMA_DESARME, MAX_PLANTILLA_S, VERSION_DESARME, claveDeDesarme, comoMirar, edicionDeDesarme, efectoDeTexto, estiloMasParecido,
  fuenteDeOutlier, fuenteDePiezaSpy, leerClaveDesarme, leerDesarme, plantillaDeDesarme, recetaDeDesarme, ritmoDe, segundosIso, textoDeDesarme,
  type Desarme, type DesarmeGuardado, type EstiloDeGaleria,
} from '../lib/video-desarmar';
import { nombreVideoMd, paqueteVideoMd, tokensDe } from '../lib/video-desarmar-videomd';
import { RECETAS, edicionDelTexto, recetaDelHilo, textoDeEdicionEnEditor } from '../lib/video-recetas';
import { PLANTILLAS_SUBTITULO } from '../app/video-editor/_opencut/subtitles/estilos';
import { EFECTOS_TEXTO, FUENTES_PLANTILLAS } from '../app/video-editor/_opencut/text/estilos-predefinidos';
import { abreElEditor, desarmePedido, rutaAbrirDesarme, vistaDeVideo } from '../app/video-editor/vista';

const leer = (ruta: string) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const GALERIA = PLANTILLAS_SUBTITULO as unknown as readonly EstiloDeGaleria[];

/** Una respuesta de Gemini como las que llegan: desordenada, encimada y con un tiempo fuera del video. */
function crudo(): Record<string, unknown> {
  return {
    idioma: 'es', duracionS: 99, proporcion: '9:16', resumen: 'Un reel de una charla.', familia: 'palabra-resaltada',
    gancho: { texto: 'Que paga la gente que paga poco', hastaS: 3, tipo: 'frase que pincha', porQueFunciona: 'Contradice lo esperado.' },
    estructura: [{ nombre: 'Remate', desde: 20, hasta: 30, que: 'x' }, { nombre: 'Golpe', desde: 0, hasta: 7, que: 'y' }],
    planos: [
      { desde: 7.04, hasta: 20, bloque: 'Desarrollo', seVe: 'Plano abierto', encuadre: 'plano general', camara: 'fija', zoom: 'ninguno', broll: false, transicion: 'corte seco', origen: 'grabado', seguridad: 0.9, porQueOrigen: 'luz real', paraReplicar: 'Tú en un escenario' },
      { desde: 0, hasta: 7.5, bloque: 'Golpe', seVe: 'Primer plano', encuadre: 'primer plano', camara: 'fija', zoom: 'entra', broll: false, transicion: '', origen: 'grabado', seguridad: 2, porQueOrigen: '', paraReplicar: 'Tú a cámara' },
      { desde: 19.5, hasta: 300, bloque: 'Remate', seVe: 'Lateral', encuadre: 'plano medio', camara: 'fija', zoom: 'raro', broll: true, transicion: 'corte', origen: 'marciano', seguridad: 0.4, porQueOrigen: '', paraReplicar: '' },
      { desde: 5, hasta: 5, seVe: 'vacío' },
      'no soy un plano',
    ],
    textos: [
      { texto: 'te exige', desde: 2, hasta: 3, posicion: 'centro', tamano: 'gigante', letra: 'con-serifa', mayusculas: false, color: '#FFF', fondo: 'ninguno', colorFondo: 'rojo' },
      { texto: '   ', desde: 1, hasta: 2 },
    ],
    frases: [{ desde: 0.2, hasta: 2.8, texto: 'Que paga la gente que paga poco' }, { desde: 8, hasta: 10, texto: 'Te exige' }],
    subtitulos: { hay: true, palabrasPorVez: 2, mayusculas: false, letra: 'con-serifa', gruesa: true, color: '#ffffff', fondo: 'sombra', colorFondo: '', resaltado: 'palabra-clave', colorResaltado: '#ffffff', tamanoClave: 900, posicion: 'abajo', animacion: '', descripcion: 'Serif blanca, la clave gigante.' },
    musica: { hay: false, volumen: 'ninguna', descripcion: '', efectos: [] },
    ritmo: { pausasRecortadas: true, descripcion: 'Sin pausas.' },
    llamadaALaAccion: null,
    edicion: ['Subtítulos chicos con serifa.'], grabarConAvatar: ['Tu personaje en un escenario.'], grabarConPersona: ['Graba una charla.'], dudas: [],
  };
}

function guardado(d: Desarme, extra: Partial<DesarmeGuardado['fuente']> = {}): DesarmeGuardado {
  return {
    version: VERSION_DESARME,
    fuente: { red: 'instagram', id: 'DPUxQ8_DiVY', url: 'https://www.instagram.com/reel/DPUxQ8_DiVY/', cuenta: 'den.borgg', titulo: null, ...extra },
    miro: { modelo: 'gemini-flash-latest', fps: 5, cuadros: 275, tokens: 1000, resolucion: 'media', hastaS: null, cuando: '2026-11-14T00:00:00.000Z' },
    desarme: d,
  };
}

function desarmeDe(c: Record<string, unknown> = crudo(), duracionS: number | null = 55): Desarme {
  const r = leerDesarme(c, { duracionS });
  assert.ok(r.ok, r.ok ? '' : r.error);
  return r.desarme;
}

test('1. la respuesta de Gemini se lee como dato de un tercero', () => {
  const d = desarmeDe();
  assert.equal(d.duracionS, 55, 'manda la duración conocida, no la que dice la IA (99)');
  assert.deepEqual(d.planos.map((p) => [p.desde, p.hasta]), [[0, 7], [7, 19.5], [19.5, 55]], 'en orden, pegados de 0 al final y dentro del video');
  assert.deepEqual(d.planos.map((p) => p.n), [1, 2, 3]);
  assert.equal(d.planos[2].origen, 'grabado', 'un origen que no existe vuelve a «grabado»');
  assert.equal(d.planos[2].zoom, 'ninguno');
  assert.equal(d.planos[1].seguridad, 0.9);
  assert.equal(d.planos[0].seguridad, 1, 'la seguridad va de 0 a 1');
  assert.equal(d.planos[0].transicion, 'corte seco', 'sin transición dicha, corte seco');
  assert.equal(d.textos.length, 1, 'un texto vacío no es un texto');
  assert.equal(d.textos[0].color, '#ffffff', '#FFF se lee como #ffffff');
  assert.equal(d.textos[0].colorFondo, null, '«rojo» no es un color');
  assert.equal(d.subtitulos.tamanoClave, 300, 'la palabra clave topea en 300 %, el tope del editor');
  assert.deepEqual(d.estructura.map((b) => b.nombre), ['Golpe', 'Remate'], 'la estructura, en orden');
  assert.ok(d.dudas.some((x) => /Ajusté los tiempos/.test(x)), 'lo corregido de más de 1 s se dice en «dudas»');
  assert.equal(d.familia, 'palabra-resaltada');
  assert.equal(leerDesarme({ ...crudo(), familia: 'inventada' }, { duracionS: 55 }).ok && desarmeDe({ ...crudo(), familia: 'inventada' }).familia, null);
  assert.equal(leerDesarme({ planos: [] }, { duracionS: 30 }).ok, false, 'sin planos no hay desarme');
  assert.equal(leerDesarme('texto', {}).ok, false);
  assert.equal(leerDesarme({ planos: [{ desde: 0, hasta: 0 }] }, {}).ok, false, 'sin duración no hay desarme');
});

test('2. los cuadros por segundo según lo que dura', () => {
  assert.deepEqual(comoMirar(30, 'instagram'), { fps: 5, resolucion: 'media', hastaS: null }, 'un reel corto a 5 por segundo: se ve un corte de 0,2 s');
  assert.equal(comoMirar(90, 'instagram').fps, 4);
  assert.equal(comoMirar(150, 'youtube').fps, 2);
  assert.deepEqual(comoMirar(600, 'youtube'), { fps: 2, resolucion: 'baja', hastaS: null });
  assert.deepEqual(comoMirar(1800, 'youtube'), { fps: 1, resolucion: 'baja', hastaS: 1200 }, 'un video de 30 min se mira hasta el minuto 20');
  assert.deepEqual(comoMirar(null, 'instagram'), { fps: 4, resolucion: 'media', hastaS: null }, 'sin duración, un reel');
  assert.deepEqual(comoMirar(null, 'youtube'), { fps: 1, resolucion: 'baja', hastaS: null });
  for (const d of [5, 30, 59, 61, 89, 120, 179, 181, 400, 1199, 5000]) assert.ok(comoMirar(d, 'instagram').fps >= 1 && comoMirar(d, 'instagram').fps <= 5, `${d} s`);
});

test('3. los números los mide el código', () => {
  const r = ritmoDe(desarmeDe());
  assert.deepEqual(r, { planos: 3, cortes: 2, cortesPorMinuto: 2.2, planoMedioS: 18.3, masCortoS: 7, masLargoS: 35.5, menosDeUnSegundo: 0 });
});

test('4. el estilo de subtítulos más parecido, de la galería real del editor', () => {
  const d = desarmeDe();
  assert.equal(estiloMasParecido(d.subtitulos, GALERIA), 'palabra-gigante', 'serif blanca con la clave gigante → «Palabra gigante»');
  const hormozi = { ...d.subtitulos, letra: 'condensada' as const, mayusculas: true, fondo: 'contorno' as const, resaltado: 'ninguno' as const, tamanoClave: 100, color: '#ffffff' };
  assert.ok(['hormozi', 'palabra-resaltada', 'contorno'].includes(estiloMasParecido(hormozi, GALERIA) ?? ''), 'condensada en mayúsculas con contorno');
  const caja = { ...d.subtitulos, letra: 'sin-serifa' as const, mayusculas: false, fondo: 'caja' as const, colorFondo: '#ffffff', color: '#111111', resaltado: 'ninguno' as const, tamanoClave: 100 };
  assert.equal(estiloMasParecido(caja, GALERIA), 'recuadro-blanco');
  assert.equal(estiloMasParecido({ ...d.subtitulos, hay: false }, GALERIA), null, 'sin subtítulos, ningún estilo');
  for (const e of GALERIA) assert.ok(e.id && e.fuente && e.color, `el estilo ${e.id} trae lo que se compara`);
});

test('5. la receta vuelve del chat: la Edición automática la lee', () => {
  const g = guardado(desarmeDe());
  const editor = edicionDeDesarme(g.desarme, 'palabra-gigante');
  assert.deepEqual(editor, { subtitulos: 'palabra-gigante', claves: { tamano: 300, color: '#ffffff' }, pausaMinima: 0.5 });
  const { recorte, textosFuera } = plantillaDeDesarme(g, 'palabra-gigante');
  const texto = textoDeDesarme(g, 'palabra-gigante', { recorte, textosFuera });
  const r = recetaDelHilo([{ de: 'yo', texto: 'hola' }, { de: 'mako', texto }]);
  assert.deepEqual(r?.editor, editor, 'lo que aplica el editor se lee del mensaje');
  assert.equal(recetaDelHilo([{ de: 'mako', texto: 'Armé este proyecto para replicar «Otra cosa»' }]), null, 'sin la línea del editor, nada');
  assert.equal(recetaDelHilo([{ de: 'mako', texto: textoDeEdicionEnEditor(RECETAS[1].editor!)! }]), null, 'la línea sola no es una receta');
  for (const rr of RECETAS) if (rr.editor) assert.deepEqual(edicionDelTexto(textoDeEdicionEnEditor(rr.editor)!), rr.editor, `ida y vuelta: ${rr.id}`);
  assert.deepEqual(edicionDeDesarme({ ...g.desarme, subtitulos: { ...g.desarme.subtitulos, hay: false } }, null), { sinSubtitulos: true, pausaMinima: 0.5 });
  const receta = recetaDeDesarme(g, 'palabra-gigante');
  assert.match(receta.edicion[0], /^3 planos en 55 s: un corte cada 18,3 s de media; el más corto dura 7 s\./, 'lo medido va primero');
  assert.equal(receta.referencia.cuenta, 'den.borgg');
  assert.match(texto, /Toca un hueco y «Sustituir»/);
  assert.match(texto, /el video de @den\.borgg/);
  assert.doesNotMatch(textoDeDesarme(guardado(g.desarme, { cuenta: 'Alex Hormozi' }), null, { recorte: null, textosFuera: 0 }), /@Alex/, 'un nombre con espacios no lleva @');
});

test('6. la plantilla «toca para reemplazar» existe en el motor', () => {
  const muchos = { ...crudo(), textos: Array.from({ length: 6 }, (_, i) => ({ texto: `Texto ${i}`, desde: 1, hasta: 4, posicion: ['arriba', 'centro', 'abajo'][i % 3], tamano: 'grande', letra: ['sin-serifa', 'con-serifa', 'condensada', 'manuscrita'][i % 4], mayusculas: true, color: '#ffe14d', fondo: ['caja', 'contorno', 'sombra', 'ninguno'][i % 4], colorFondo: '#000000' })) };
  const g = guardado(desarmeDe(muchos));
  const { plantilla, recorte, textosFuera } = plantillaDeDesarme(g, 'palabra-gigante');
  const clips = plantilla.piezas.filter((p) => p.tipo === 'clip');
  assert.equal(clips.length, 3, 'un hueco por plano');
  assert.equal(clips[0].inicio, 0);
  for (let i = 1; i < clips.length; i++) assert.equal(clips[i].inicio, clips[i - 1].fin, 'pegados');
  assert.equal(clips[clips.length - 1].fin, plantilla.duracion, 'hasta el final');
  assert.ok(clips.every((c) => c.pista === 'principal' && c.hueco.acepta === 'ambos'));
  assert.equal(new Set(clips.map((c) => c.hueco.nombre)).size, 3, 'cada plano, su hueco');
  assert.match(clips[0].hueco.rotulo, /^1\. Tú a cámara$/);
  assert.equal(textosFuera, 2, 'seis textos a la vez: cuatro pistas, dos fuera');
  assert.equal(recorte, null);
  const efectos = new Set(EFECTOS_TEXTO.map((e) => e.id));
  for (const p of plantilla.piezas) {
    if (p.tipo !== 'texto') continue;
    assert.ok(efectos.has(p.estilo.efecto), `el efecto «${p.estilo.efecto}» existe`);
    assert.ok(FUENTES_PLANTILLAS.includes(p.estilo.fuente), `la fuente «${p.estilo.fuente}» se carga`);
    assert.ok(p.inicio >= 0 && p.fin <= plantilla.duracion && p.fin > p.inicio);
    assert.ok(p.hueco && p.hueco.maxCaracteres >= Array.from(p.muestra).length, 'el texto del original entra en su hueco');
  }
  assert.ok(PLANTILLAS_SUBTITULO.some((s) => s.id === plantilla.subtitulos), 'el estilo de subtítulos existe');
  // Más de 3 minutos: se arman los primeros 180 s y se dice.
  const largo = guardado(desarmeDe({ ...crudo(), planos: [{ desde: 0, hasta: 100, seVe: 'a' }, { desde: 100, hasta: 400, seVe: 'b' }] }, 400));
  const l = plantillaDeDesarme(largo, null);
  assert.equal(l.recorte, 400);
  assert.equal(l.plantilla.duracion, MAX_PLANTILLA_S);
  assert.equal(l.plantilla.subtitulos, undefined);
  assert.equal(efectoDeTexto({ fondo: 'caja', color: '#111111', colorFondo: '#ffe14d' }), 'recuadro-amarillo');
  assert.equal(efectoDeTexto({ fondo: 'contorno', color: '#ffe14d', colorFondo: null }), 'amarillo-trazo-negro');
});

test('7. el paquete VIDEO.md cumple la especificación v1', () => {
  const g = guardado(desarmeDe());
  const p = paqueteVideoMd(g);
  for (const f of ['VIDEO.md', 'video/timeline.md', 'video/shots/01.md', 'video/shots/02.md', 'video/shots/03.md', 'video/content.md', 'video/look.md', 'video/sound.md', 'video/remake.md', 'video/transcript.vtt']) {
    assert.ok(p[f], `falta ${f}`);
  }
  const ficha = p['VIDEO.md'];
  assert.match(ficha, /^---\nvideomd: 1\nname: [a-z0-9]+(-[a-z0-9]+)*\ndescription: ".+"\nsource: \{duration: 55\.0, url: "https:\/\/www\.instagram\.com\/reel\/DPUxQ8_DiVY\/", aspect: '9:16'\}\nshots: 3\nlang: es\n/);
  const mapa = /```videomd-map\n([\s\S]*?)\n```/.exec(ficha)?.[1].split('\n') ?? [];
  for (const f of Object.keys(p).filter((x) => /^video\/[^/]+\.(md|vtt)$/.test(x))) assert.ok(mapa.some((l) => l.startsWith(`${f} | `)), `el mapa lista ${f}`);
  assert.ok(mapa.some((l) => l.startsWith('video/shots/*.md | ')));
  const lineas = /```videomd-timeline\n([\s\S]*?)\n```/.exec(p['video/timeline.md'])?.[1].split('\n') ?? [];
  assert.equal(lineas.length, 3, 'una línea por plano');
  for (const [i, l] of lineas.entries()) {
    const m = /^#(\d{2}) (\d+\.\d)-(\d+\.\d)( \| [a-z~-]+ [^|]+)+$/.exec(l);
    assert.ok(m, `la línea ${l} sigue la gramática`);
    const tiempo = new RegExp(`\\ntime: \\[${m![2].replace('.', '\\.')}, ${m![3].replace('.', '\\.')}\\]\\n`);
    assert.match(p[`video/shots/${m![1]}.md`], tiempo, `el plano ${i + 1} dice el mismo tiempo que la línea`);
  }
  assert.match(p['video/timeline.md'], /^---\nvideomd: 1\npart: timeline\nshots: 3\ntokens: \d+\n---\n/);
  assert.match(p['video/shots/01.md'], /\ninferred: \{made: live_action, p: 1\.00, decided_by: model, real_material: true\}\n/);
  assert.match(p['video/transcript.vtt'], /^WEBVTT\n\n00:00:00\.200 --> 00:00:02\.800\nQue paga la gente que paga poco\n/);
  assert.equal(nombreVideoMd('Den.Borgg — Ñandú!!'), 'den-borgg-nandu');
  assert.equal(tokensDe('abcd'), 1);
  assert.equal(tokensDe('ñññ'), 3);
});

test('8. las claves y las fuentes rechazan lo que no es un video', () => {
  assert.equal(claveDeDesarme('instagram', 'DPUxQ8_DiVY'), 'instagram.DPUxQ8_DiVY');
  assert.equal(claveDeDesarme('instagram', '../x'), null);
  assert.equal(claveDeDesarme('vimeo', '12345'), null);
  assert.deepEqual(leerClaveDesarme('youtube.lQpJatw_uM8'), { red: 'youtube', id: 'lQpJatw_uM8' });
  assert.equal(leerClaveDesarme('youtube.'), null);
  assert.equal(leerClaveDesarme({}), null);
  assert.deepEqual(fuenteDeOutlier({ red: 'instagram', url: 'https://www.instagram.com/reel/DdTdIIPDzHU/', creador: { nombre: 'Tacho', usuario: 'tacho' }, titulo: 'x' }),
    { red: 'instagram', id: 'DdTdIIPDzHU', url: 'https://www.instagram.com/reel/DdTdIIPDzHU/', cuenta: 'tacho', titulo: 'x' });
  assert.equal(fuenteDeOutlier({ red: 'meta-ads', url: 'https://x.com', creador: { nombre: 'a', usuario: null }, titulo: '' }), null);
  assert.equal(fuenteDePiezaSpy({ canal: 'youtube', tipo: 'video', ref: 'lQpJatw_uM8', url: null }, 'Mindvalley')?.red, 'youtube');
  assert.equal(fuenteDePiezaSpy({ canal: 'instagram', tipo: 'reel', ref: 'DPUxQ8_DiVY', url: 'https://www.instagram.com/reel/DPUxQ8_DiVY/' }, 'Den')?.id, 'DPUxQ8_DiVY');
  assert.equal(fuenteDePiezaSpy({ canal: 'instagram', tipo: 'publicacion', ref: 'abcde', url: null, medio: 'carrusel' }, 'x'), null, 'un carrusel no es un video');
  assert.equal(fuenteDePiezaSpy({ canal: 'anuncios', tipo: 'anuncio', ref: '1234567890', url: null, medio: 'video' }, 'x')?.red, 'meta-ads');
  assert.equal(fuenteDePiezaSpy({ canal: 'anuncios', tipo: 'anuncio', ref: '1234567890', url: null, medio: 'imagen' }, 'x'), null);
  assert.equal(segundosIso('PT1M3S'), 63);
  assert.equal(segundosIso('PT2H'), 7200);
  assert.equal(segundosIso('PT'), null);
  assert.equal(segundosIso(null), null);
  // El esquema que se le manda a Gemini: lo que pide `leerDesarme`, y nada fuera del subconjunto que acepta.
  const props = (ESQUEMA_DESARME as { properties: Record<string, unknown>; required: string[] });
  assert.ok(props.required.includes('planos') && !props.required.includes('llamadaALaAccion'));
  assert.doesNotMatch(JSON.stringify(ESQUEMA_DESARME), /"(additionalProperties|\$ref|oneOf|anyOf)"/);
});

test('9. el cableado', () => {
  const outliers = leer('app/video-editor/OutliersVideo.tsx');
  assert.equal(outliers.match(/<Desarmar fuente=\{fuente\} duracionS=\{x\.duracionS\} editor=\{!telefono\} \/>/g)?.length, 2, 'en la tarjeta del reel y en la plantilla de MaKo');
  assert.match(leer('app/competitor-spy/DetallePieza.tsx'), /fuenteVideo \? <Desarmar fuente=\{fuenteVideo\}/);
  const ruta = leer('app/api/desarmar/route.ts');
  assert.match(ruta, /conSuIADelNegocio\(ws, \(\) => desarmarVideo\(/, 'con la IA del negocio (D6b)');
  assert.match(ruta, /esAdminDeTab\('market-an'\)/);
  assert.match(ruta, /await veEditorVideo\(\)/, 'el candado del editor, igual que sus rutas');
  const servidor = leer('lib/video-desarmar-servidor.ts');
  assert.match(servidor, /cambiarSettingSi\(fila, crudo, mirando\)/, 'el trabajo se reclama: no se paga dos veces');
  assert.match(leer('lib/video-desarmar-gemini.ts'), /provsDe\('gemini'\)/, 'con las cuentas de Gemini del negocio');
  const armar = leer('app/video-editor/plantilla/ArmarPlantilla.tsx');
  assert.ok(armar.indexOf('guardarHiloAhora(id)') > 0 && armar.indexOf('guardarHiloAhora(id)') < armar.indexOf('return id;\n\t} catch'), 'el chat se guarda antes de la carga entera');
  // La plantilla se arma en el server, con lo del negocio, por la ENTRADA de la tab (`?desarme=`, como `?receta=`): la página de un
  // proyecto lee SÓLO `desde`, `plantilla` y `propuesta` (tests/video-editor-integracion.test.ts, 2b).
  assert.match(leer('app/video-editor/page.tsx'), /const desarmado = desarme \? await desarmadoParaElEditor\(desarme\) : undefined;/);
  assert.doesNotMatch(leer('app/video-editor/[proyecto]/page.tsx'), /desarme/, 'la página del proyecto no lee el desarme');
  assert.equal(desarmePedido({ desarme: 'instagram.DdTdIIPDzHU' }), 'instagram.DdTdIIPDzHU');
  assert.equal(desarmePedido({ desarme: ['youtube.lQpJatw_uM8', 'x'] }), 'youtube.lQpJatw_uM8');
  assert.equal(desarmePedido({ desarme: 'otra.cosa' }), null);
  assert.equal(desarmePedido({}), null);
  assert.equal(abreElEditor({ desarme: 'instagram.DdTdIIPDzHU' }), false, 'con un desarme no se abre el último proyecto');
  assert.equal(vistaDeVideo({ ver: 'crear', desarme: 'instagram.DdTdIIPDzHU' }), 'crear');
  const abrir = new URL(rutaAbrirDesarme('instagram.DdTdIIPDzHU'), 'https://x');
  assert.equal(abrir.pathname, '/video-editor');
  assert.equal(desarmePedido(Object.fromEntries(abrir.searchParams)), 'instagram.DdTdIIPDzHU', 'ida y vuelta');
  assert.match(leer('app/video-editor/Desarmar.tsx'), /<Link href=\{rutaAbrirDesarme\(clave\)\}/);
});

test('10. otros formatos: un carrusel o una imagen de anuncio, desarmado', async () => {
  const { leerDesarmeImagen, pedidoDeDesarmeImagen, jsonDeTexto } = await import('../lib/imagen-desarmar');
  const crudoImg = {
    tipo: 'lista', resumen: 'Cinco errores.', gancho: '5 ERRORES', porQueFunciona: 'Promete una lista corta.',
    laminas: [
      { rol: 'portada', composicion: 'Título grande arriba', imagen: 'Persona sorprendida', textos: [{ texto: '  5 ERRORES 😱\nque te cuestan ventas ', rol: 'titulo', posicion: 'arriba', tamano: 'gigante', letra: 'condensada', gruesa: true, color: '#FF0' }, { texto: '', rol: 'cuerpo' }] },
      { rol: 'desarrollo', composicion: '', imagen: '', textos: [{ texto: 'Error 1', rol: 'inventado', color: 'azul' }] },
      { rol: 'de más', textos: [] },
    ],
    tipografia: { titulos: 'Anton. Muy condensada; mayúsculas', cuerpo: 'Inter' }, paleta: ['#000000', '#ff0', 'rojo', '#000000'], paraReplicar: ['x'], dudas: [],
  };
  const r = leerDesarmeImagen(crudoImg, { laminas: 2, clase: 'carrusel' });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.desarme.laminas.length, 2, 'no más láminas de las que se le mostraron');
  assert.equal(r.desarme.laminas[0].textos.length, 1, 'un texto vacío no cuenta');
  assert.equal(r.desarme.laminas[0].textos[0].texto, '5 ERRORES 😱\nque te cuestan ventas', 'el texto EXACTO: sólo se recortan los bordes');
  assert.equal(r.desarme.laminas[0].textos[0].color, '#ffff00');
  assert.equal(r.desarme.laminas[1].textos[0].rol, 'cuerpo', 'un rol que no existe vuelve a «cuerpo»');
  assert.equal(r.desarme.laminas[1].textos[0].color, null);
  assert.deepEqual(r.desarme.paleta, ['#000000', '#ffff00'], 'la paleta sin repetidos ni lo que no es un color');
  const pedido = pedidoDeDesarmeImagen(r.desarme);
  assert.ok(pedido.length <= 400, 'entra en el pedido de la réplica de Image (400)');
  assert.match(pedido, /^Mantén la estructura «lista» de 2 láminas \(portada, desarrollo\); títulos en Anton; paleta #000000 #ffff00\. El texto, con mi oferta; las imágenes, regeneradas\.$/);
  assert.equal(leerDesarmeImagen({ laminas: [] }, { laminas: 3, clase: 'carrusel' }).ok, false);
  assert.deepEqual(jsonDeTexto('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(jsonDeTexto('Aquí va: {"a":2} listo'), { a: 2 });
  assert.equal(jsonDeTexto('nada'), null);
  const spy = leer('app/competitor-spy/DetallePieza.tsx');
  assert.match(spy, /!fuenteVideo && esImagenDeSpy\(p\) \? <DesarmarImagen piezaId=\{p\.id\} \/>/);
  assert.match(leer('app/api/competitor-spy/desarmar-imagen/route.ts'), /conSuIADelNegocio\(ws, \(\) => desarmarImagenDeSpy\(piezaId\)\)/);
  assert.match(leer('lib/imagen-desarmar-servidor.ts'), /Competitors Spy no guarda las demás/, 'lo que no se miró se dice');
});

test('11. «Hacer uno así» de un video: la edición viaja con la pieza al Copywriter y al Video Editor', async () => {
  const { textoDeEdicionParaCopiar, PLANOS_PARA_COPIAR } = await import('../lib/video-desarmar');
  const { textoParaCopiar } = await import('../lib/spy-detalle');
  const { docDeTexto } = await import('../lib/copywriter/texto');
  const { sanearProps } = await import('../lib/copywriter/tipos');
  const c = crudo();
  c.textos = [{ texto: 'FLOJOS', desde: 3, hasta: 3.6, posicion: 'arriba', tamano: 'grande', letra: 'sin-serifa', mayusculas: true, color: '#ff0000', fondo: 'ninguno', colorFondo: null }];
  const g = guardado(desarmeDe(c));
  const edicion = textoDeEdicionParaCopiar(g, 'Palabra gigante');
  const lineas = edicion.split('\n');
  assert.equal(lineas[0], '## Su edición, plano a plano');
  assert.match(lineas[1], /^- 3 planos en 55 s: un corte cada 18,3 s de media; el más corto, 7 s\. Grabado 3\.$/, 'lo MEDIDO primero');
  assert.match(edicion, /- Subtítulos: Serif blanca, la clave gigante\. En el editor de MaKo: el estilo «Palabra gigante»\./);
  assert.match(edicion, /- Zooms: 1 \(planos 1\)\. B-roll: 1 \(planos 3\)\./);
  assert.match(edicion, /- 1 · 0–7 s · Grabado, primer plano, zoom entra: Primer plano\. Texto en pantalla: «FLOJOS»\./);
  assert.match(edicion, /## Su edición, paso a paso\n- Subtítulos chicos con serifa\./);
  // Lo que dice el competidor en MAYÚSCULA va adentro de un renglón: no abre una sección del guion.
  const doc = docDeTexto(textoParaCopiar({ nombre: 'Den' }, { canal: 'instagram', tipo: 'reel', url: null, titulo: null, texto: 'Hola', vistas: null, megusta: null, analisis: { gancho: 'g' } }, edicion));
  const titulos = JSON.stringify(doc).match(/"type":"heading"[^}]*\}[^\]]*?"text":"([^"]+)"/g) ?? [];
  assert.ok(!titulos.some((t) => t.includes('FLOJOS')), 'un texto del competidor no es un título');
  const conEdicion = textoParaCopiar({ nombre: 'Den' }, { canal: 'instagram', tipo: 'reel', url: null, titulo: null, texto: 'Hola', vistas: null, megusta: null, analisis: null }, edicion);
  assert.ok(conEdicion.indexOf('## Su edición, plano a plano') < conEdicion.indexOf('## Tu versión'), 'la edición va antes de «Tu versión»');
  assert.doesNotMatch(textoParaCopiar({ nombre: 'Den' }, { canal: 'instagram', tipo: 'reel', url: null, titulo: null, texto: 'Hola', vistas: null, megusta: null, analisis: null }), /Su edición/, 'sin desarme, como antes');
  // Un video largo: los primeros planos y «y N más».
  const largo = guardado(desarmeDe({ ...crudo(), planos: Array.from({ length: 60 }, (_, i) => ({ desde: i, hasta: i + 1, seVe: `p${i}` })) }, 60));
  assert.equal(textoDeEdicionParaCopiar(largo).split('\n').filter((l) => /^- \d+ · /.test(l)).length, PLANOS_PARA_COPIAR);
  assert.match(textoDeEdicionParaCopiar(largo), /- Y 20 planos más: están en el VIDEO\.md\./);
  // La página guarda la clave del desarme (y nada que no tenga su forma).
  assert.equal(sanearProps({ tipo: 'reel', desarme: 'instagram.DdTdIIPDzHU' }).desarme, 'instagram.DdTdIIPDzHU');
  assert.equal(sanearProps({ tipo: 'reel', desarme: '../otra' }).desarme, undefined);
  assert.equal(sanearProps({ tipo: 'reel' }).desarme, undefined, 'una página sin él no lo guarda');
  // El cableado: la caja desarma ANTES de copiar; la ruta lee lo guardado y lo escribe; la página muestra la caja al lado.
  const spy = leer('app/competitor-spy/DetallePieza.tsx');
  assert.ok(spy.indexOf('await desarmarAntes(fuenteVideo') > 0 && spy.indexOf('await desarmarAntes(fuenteVideo') < spy.indexOf("fetch('/api/competitor-spy/copiar'"), 'se desarma antes de copiar');
  const copiar = leer('app/api/competitor-spy/copiar/route.ts');
  assert.match(copiar, /desarmeGuardado\(desarme\)/, 'lo guardado, sin IA');
  assert.match(copiar, /props: \{ desarme \}/);
  assert.match(leer('app/copywriter/editor/EditorGuion.tsx'), /<Desarmar fuente=\{desarmeDeLaPagina\} duracionS=\{null\} editor \/>/);
});

test('12. la copia de la galería de subtítulos (el server no importa del motor) es la del motor', async () => {
  const { GALERIA_SUBTITULOS } = await import('../lib/video-desarmar-estilos');
  const delMotor = PLANTILLAS_SUBTITULO.map((p) => ({
    id: p.id, nombre: p.nombre, fuente: p.fuente, negrita: p.negrita, color: p.color,
    ...(p.mayusculas ? { mayusculas: true } : {}),
    ...(p.fondo ? { fondo: { color: p.fondo.color } } : {}),
    ...(p.trazo ? { trazo: { color: p.trazo.color } } : {}),
    ...(p.sombra ? { sombra: true } : {}),
    ...(p.resaltado ? { resaltado: { modo: p.resaltado.modo, color: p.resaltado.color } } : {}),
    ...(p.clavesTamano ? { clavesTamano: p.clavesTamano } : {}),
  }));
  assert.deepEqual(GALERIA_SUBTITULOS, delMotor, 'cambió la galería del editor: copia sus rasgos a lib/video-desarmar-estilos.ts');
  assert.doesNotMatch(leer('lib/video-desarmar-servidor.ts'), /_opencut/, 'el server no importa del motor del editor');
});
