// =============================================================================
// MaKo Mobile — «Ads Writer» (app/m/copywriting): lo que se rompe sin un error
// =============================================================================
// La pantalla destila app/ads-writer (AGENTS.md, «MaKo Mobile (/m)»: mismas vistas, mismo orden,
// mismos rótulos). Esto fija:
//   · las tres vistas son las de escritorio, en su orden, y la URL las lee con el `tabDeUrl` de allá;
//   · cada rótulo que el teléfono repite SIGUE en el fuente de escritorio (tabla escrita a mano: una
//     tabla que se recorre a sí misma no ve una fila borrada, docs/hallazgos-mobile.md);
//   · lo que comparte con escritorio vive en módulos PUROS y escritorio lo usa de ahí (el parser del
//     guion, la cobertura, «el próximo guion», el orden de la galería, el día y el extracto): ni
//     escritorio ni el teléfono tienen su copia;
//   · el modelo: los grupos de Anuncios, la galería, la portada y la espina, la valoración leída a la
//     defensiva, el tono de cada estado y de cada veredicto;
//   · una escritura que FALLA adopta la copia que mandó el server en sus 60-120 s (si no, el próximo
//     toque pagaba IA otra vez en una celda ya escrita), y si no llegó ninguna, deja la de pantalla;
//   · escribir y valorar van por las rutas de escritorio (que miran el rol), con su tope, y el pedido
//     NO lleva un campo libre (escritorio lo prohíbe: «Crear un guion NUNCA pide redactar nada»);
//   · dictar es TEXTO al campo (`useDictar`), nunca una grabación que viaja como audio;
//   · «Copiar» dice si copió de verdad;
//   · la página: su guard, el puente ANTES del onboarding, la matriz en estricto, el historial sólo con
//     `?tab=analizar`, y nada del `?ws=`;
//   · el CSS de la carpeta (prefijo entero y tokens que existen), los íconos que existen y cero voseo.
// Que la página dibuje adentro de <PantallaM> lo fija tests/movil-refrescar.test.ts.
//
// Verificado ROMPIÉNDOLO (16/10/2026, base 13 / 0), de a una y restaurando (un script que muta, corre
// y devuelve el archivo):
//   · R.escribirProximo = 'Escribir el próximo'  (recortado)                             → 12 / 1
//   · VISTAS con 'guiones' antes que 'anuncios'                                          → 12 / 1
//   · AdsWriterApp.tsx con su `proximaCelda` inline otra vez (sin `proximaCeldaDe`)      → 12 / 1
//   · SeccionCard.tsx con su propio `export function parsearSecciones`                   → 12 / 1
//   · proximaCeldaDe recorriendo las celdas en vez de los avatares                       → 12 / 1
//   · masRecientePrimero sin mandar los «sin fecha» al final                             → 12 / 1
//   · api.ts mandando `nota` en el pedido                                                → 12 / 1
//   · copiarTexto devolviendo true en el catch                                           → 12 / 1
//   · la page corriendo `datosAnalizar()` siempre (sin `tab === 'analizar'`)             → 12 / 1
//   · copywriting.css con `.m-cw-x` (prefijo abreviado)                                  → 12 / 1
//   · copywriting.css con `var(--mako-fondo)` (no existe)                                → 12 / 1
//   · un «Tocá» en un rótulo de VistasM.tsx                                              → 12 / 1
//   · AnalizarM.tsx dictando con `useVoiceRecorder`                                      → 12 / 1
// Y el de «una escritura que falla» (16/10/2026, base 14 / 0, con el mismo script):
//   · CopywritingM sin el `setMatriz(… matrizSiFalla …)` de la rama `!r.ok` (el bug)     → 13 / 1
//   · CopywritingM sin `delServerRef.current = llegada` en la adopción                   → 13 / 1
//   · CopywritingM tomando `alEmpezar` DESPUÉS del await                                 → 13 / 1
//   · matrizSiFalla devolviendo siempre la del server (el arreglo ingenuo)               → 13 / 1
//   · matrizSiFalla devolviendo siempre la de pantalla (el bug)                          → 13 / 1
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { GuionItem } from '../lib/guion-estado';
import { ESTADOS_GUION } from '../lib/guion-estado';
import type { ScriptDraft, Valoracion } from '../lib/ads-analyst';
import { VISTAS_ADS_WRITER, tabDeUrl } from '../app/ads-writer/tabs';
import { coberturaDe, masRecientePrimero, proximaCeldaDe } from '../app/ads-writer/reglas';
import { VEREDICTO_VALORACION } from '../app/ads-writer/ValoracionGuion';
import { copiarTexto } from '../app/m/copywriting/api';
import {
  R, TONO_VEREDICTO, VISTAS, draftM, espinaDe, gruposDeAnuncios, guionDe, guionesRecientes, matrizSiFalla, metaDeGuion, portadaDe,
  segundaDeAnuncio, tonoDeEstado, tonoDeVeredicto, valoracionM, type AvatarLite, type CeldaM,
} from '../app/m/copywriting/modelo';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
/** Las líneas de comentario PRIMERO y los bloques después (un `/*` dentro de un `//` se comería código). */
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const CARPETA = 'app/m/copywriting';
const FUENTES = readdirSync(join(RAIZ, CARPETA)).filter((n) => /\.tsx?$/.test(n)).map((n) => `${CARPETA}/${n}`);

/** De qué archivo de escritorio sale cada rótulo de `R`. A MANO: si se agrega uno a R, se agrega acá. */
const ORIGEN: Record<keyof typeof R, string> = {
  anuncios: 'app/ads-writer/AdsWriterApp.tsx',
  guiones: 'app/ads-writer/AdsWriterApp.tsx',
  analizar: 'app/ads-writer/AdsWriterApp.tsx',
  escribirProximo: 'app/ads-writer/AdsWriterApp.tsx',
  todosConGuion: 'app/ads-writer/AdsWriterApp.tsx',
  queMakoEscriba: 'app/onboarding/MatrizView.tsx',
  makoSolo: 'app/onboarding/MatrizView.tsx',
  makoEscribiendo: 'app/onboarding/MatrizView.tsx',
  copiarGuion: 'app/ads-writer/GuionLector.tsx',
  analizaNuevo: 'app/ads-writer/AnalizarGuion.tsx',
  valorar: 'app/ads-writer/AnalizarGuion.tsx',
  tarda: 'app/ads-writer/AnalizarGuion.tsx',
  historial: 'app/ads-writer/AnalizarGuion.tsx',
  guionAValorar: 'app/ads-writer/AnalizarGuion.tsx',
  queProbar: 'app/ads-writer/ValoracionGuion.tsx',
  sinDatos: 'app/ads-writer/ValoracionGuion.tsx',
  hookEst: 'app/ads-writer/ValoracionGuion.tsx',
  retEst: 'app/ads-writer/ValoracionGuion.tsx',
};

const guion = (id: string, creadoEn: number, estado: GuionItem['estado'] = 'borrador', texto = 'GANCHO\nHola\nCTA\nEscríbenos'): GuionItem => ({
  id, anguloId: 'a', anguloNombre: 'Dolor', texto, creadoEn, estado, estructuraId: 'pas', estructuraNombre: 'PAS',
});

test('las tres vistas son las de escritorio, en su orden, y la URL se lee con su tabDeUrl', () => {
  const app = sinComentarios(leer('app/ads-writer/AdsWriterApp.tsx'));
  const deEscritorio = [...app.matchAll(/\{ k: '(\w+)', label: '([^']+)'/g)].map((m) => ({ id: m[1], label: m[2] }));
  assert.deepEqual(VISTAS.map((v) => ({ ...v })), deEscritorio, 'las vistas del teléfono no son las de escritorio');
  assert.deepEqual(VISTAS.map((v) => v.id), [...VISTAS_ADS_WRITER]);
  for (const v of VISTAS) assert.equal(tabDeUrl(v.id), v.id);
  const shell = sinComentarios(leer(`${CARPETA}/CopywritingM.tsx`));
  assert.match(shell, /tabDeUrl\(sp\.get\('tab'\)/, 'la vista no se lee de la URL');
});

test('cada rótulo que el teléfono repite sigue en el fuente de escritorio', () => {
  assert.deepEqual(Object.keys(ORIGEN).sort(), Object.keys(R).sort(), 'un rótulo de R sin su archivo de escritorio en ORIGEN');
  // El rótulo ENTERO (entre comillas o como texto de JSX, con el «✦ » que escritorio le pone): un
  // `includes` aceptaría un rótulo recortado. «Predicción sin datos» abre una frase allá: va aparte.
  const comoRotulo = (r: string) => new RegExp(`['"\`>]\\s*(?:[+←✦]\\s*)?${escapar(r)}\\s*(?:→\\s*)?['"\`<]`);
  for (const [k, archivo] of Object.entries(ORIGEN) as Array<[keyof typeof R, string]>) {
    const src = sinComentarios(leer(archivo));
    if (k === 'sinDatos') { assert.match(src, new RegExp(`>${escapar(R[k])}\\. `), `«${R[k]}» ya no abre el aviso de ${archivo}`); continue; }
    assert.match(src, comoRotulo(R[k]), `«${R[k]}» (R.${k}) ya no es un rótulo de ${archivo}`);
  }
});

test('lo que comparte con escritorio vive en módulos puros, y nadie tiene su copia', () => {
  for (const m of ['lib/guion-secciones.ts', 'app/ads-writer/reglas.ts', 'app/ads-writer/analizar.ts', 'app/ads-writer/tabs.ts']) {
    assert.doesNotMatch(leer(m), /^\s*['"]use client['"]/m, `${m} no puede ser un módulo de cliente`);
  }
  // Escritorio usa las reglas de ahí (no las tiene inline).
  const app = sinComentarios(leer('app/ads-writer/AdsWriterApp.tsx'));
  assert.match(app, /import \{ coberturaDe, proximaCeldaDe \} from '\.\/reglas';/);
  assert.match(app, /useMemo\(\(\) => proximaCeldaDe\(celdas, avatares\)/);
  assert.doesNotMatch(app, /x\.avatarId === av\.id && !x\.guiones\.length/, 'AdsWriterApp volvió a tener su «próximo guion»');
  const galeria = sinComentarios(leer('app/ads-writer/GuionesGlobal.tsx'));
  assert.match(galeria, /out\.sort\(\(a, b\) => masRecientePrimero\(a\.g, b\.g\)\)/, 'la galería de escritorio no ordena con masRecientePrimero');
  const seccion = sinComentarios(leer('app/components/SeccionCard.tsx'));
  assert.match(seccion, /export \{ esSubtitulo, parsearSecciones \} from '@\/lib\/guion-secciones';/);
  assert.doesNotMatch(seccion, /function (parsearSecciones|esSubtitulo)\b/, 'SeccionCard volvió a tener su parser');
  const analizar = sinComentarios(leer('app/ads-writer/AnalizarGuion.tsx'));
  assert.doesNotMatch(analizar, /function (diaMes|extracto)\b/, 'AnalizarGuion volvió a tener su diaMes/extracto');
  // Y el teléfono tampoco.
  for (const f of FUENTES) {
    assert.doesNotMatch(sinComentarios(leer(f)), /function (parsearSecciones|esSubtitulo|proximaCeldaDe|coberturaDe|masRecientePrimero|diaMes|extracto|veredictoDe)\b/, `${f} tiene una copia de una regla de escritorio`);
  }
});

test('la cobertura y «el próximo guion»: en orden de avatar, y las unidades que cierran', () => {
  // La primera celda del ARRAY es del segundo avatar: el próximo es la del primero.
  const celdas: CeldaM[] = [
    { id: 'b1', avatarId: 'B', nombre: 'Viaje', guiones: [] },
    { id: 'a1', avatarId: 'A', nombre: 'Salario', guiones: [guion('g1', 1, 'aprobado'), guion('g2', 2, 'aprobado')] },
    { id: 'a2', avatarId: 'A', nombre: 'Ascenso', guiones: [] },
    { id: 'x1', avatarId: 'Z', nombre: 'Huérfana', guiones: [] },
  ];
  const avatares = [{ id: 'A', nombre: 'Dueña' }, { id: 'B', nombre: 'Viajero' }];
  assert.equal(proximaCeldaDe(celdas, avatares)?.id, 'a2');
  // Sin huecos en los avatares, la huérfana (avatar borrado) sigue siendo un anuncio sin guion.
  assert.equal(proximaCeldaDe(celdas.filter((c) => c.id !== 'a2' && c.id !== 'b1'), avatares)?.id, 'x1');
  assert.equal(proximaCeldaDe([celdas[1]], avatares), null);
  assert.deepEqual(coberturaDe(celdas), { conGuion: 1, total: 4, listos: 2, guiones: 2 });
});

test('una escritura que falla deja en pantalla lo último que mandó el server, y si no mandó nada, lo de pantalla', () => {
  type Matriz = { celdas: CeldaM[]; avatares: AvatarLite[] };
  const avatares = [{ id: 'A', nombre: 'Dueña' }];
  const foto: Matriz = { celdas: [{ id: 'a1', avatarId: 'A', nombre: 'Salario', guiones: [] }, { id: 'a2', avatarId: 'A', nombre: 'Ascenso', guiones: [] }], avatares };
  // Mientras escribía a1, un refresco trajo a1 YA escrita (el server guardó y la respuesta se perdió).
  const llegada: Matriz = { celdas: [{ ...foto.celdas[0], guiones: [guion('g1', 1)] }, foto.celdas[1]], avatares };
  const tras = matrizSiFalla({ enPantalla: foto, delServerAlEmpezar: foto, delServerAhora: llegada });
  assert.equal(tras, llegada, 'la copia que llegó mientras escribía se descarta');
  assert.equal(proximaCeldaDe(tras.celdas, tras.avatares)?.id, 'a2', 'el próximo toque vuelve a pagar IA en la celda que el server ya escribió');
  // Sin refresco en el medio: lo de pantalla puede ser MÁS nuevo que el server (lo devolvió la escritura anterior).
  const deLaAnterior: Matriz = { celdas: llegada.celdas, avatares };
  assert.equal(matrizSiFalla({ enPantalla: deLaAnterior, delServerAlEmpezar: foto, delServerAhora: foto }), deLaAnterior,
    'al fallar se vuelve a la copia vieja del server: se borra de la pantalla el guion recién escrito');

  // Y la pantalla lo usa así: la copia que llega va al ref en el mismo bloque que la guarda, se toma ANTES de
  // escribir y se relee DESPUÉS (el render que arrancó la escritura no ve lo que llegó en sus 60-120 s).
  const shell = sinComentarios(leer(`${CARPETA}/CopywritingM.tsx`));
  const adopcion = shell.match(/if \(delServer\.celdas !== celdas[^{]*\{([\s\S]*?)\n {2}\}/)?.[1] ?? '';
  assert.match(adopcion, /setDelServer\(llegada\);/, 'no se encontró el bloque que adopta las props');
  assert.match(adopcion, /delServerRef\.current = llegada;/, 'la copia del server no queda en el ref: al fallar no hay qué adoptar');
  const escribir = shell.match(/const escribir = async[\s\S]*?\n {2}\};/)?.[0] ?? '';
  const tomada = escribir.indexOf('const alEmpezar = delServerRef.current;');
  assert.ok(tomada > 0 && escribir.indexOf('await escribirGuion(') > tomada, 'la copia del server no se toma ANTES de escribir');
  const falla = escribir.match(/if \(!r\.ok\) \{([\s\S]*?)return;\s*\}/)?.[1] ?? '';
  assert.match(falla, /const ahora = delServerRef\.current;\s*setMatriz\(\(m\) => matrizSiFalla\(\{ enPantalla: m, delServerAlEmpezar: alEmpezar, delServerAhora: ahora \}\)\);/,
    'una escritura que falla no adopta lo que mandó el server mientras escribía');
});

test('Anuncios: un grupo por avatar en su orden, con su «N de M» y el estado más avanzado', () => {
  const celdas: CeldaM[] = [
    { id: 'b1', avatarId: 'B', nombre: 'Viaje', guiones: [guion('g3', 3, 'grabado'), guion('g4', 4, 'borrador')] },
    { id: 'a1', avatarId: 'A', nombre: 'Salario', guiones: [] },
  ];
  const grupos = gruposDeAnuncios(celdas, [{ id: 'A', nombre: 'Dueña' }, { id: 'C', nombre: 'Sin razones' }, { id: 'B', nombre: 'Viajero' }]);
  assert.deepEqual(grupos.map((g) => [g.avatar, g.conGuion, g.total]), [['Dueña', 0, 1], ['Viajero', 1, 1]]);
  assert.deepEqual(grupos[1].filas[0], { id: 'b1', nombre: 'Viaje', n: 2, estado: 'grabado' });
  assert.equal(grupos[0].filas[0].estado, null);
  assert.equal(segundaDeAnuncio({ n: 0 }), R.queMakoEscriba);
  assert.equal(segundaDeAnuncio({ n: 1 }), '1 guion');
  assert.equal(segundaDeAnuncio({ n: 3 }), '3 guiones');
});

test('la galería: el más nuevo primero y los «sin fecha» al final; la portada es el gancho', () => {
  // Desordenado a propósito (un fixture ya ordenado deja pasar un sort roto).
  const celdas: CeldaM[] = [
    { id: 'c1', avatarId: 'A', nombre: 'Salario', guiones: [guion('viejo', 0), guion('medio', 20)] },
    { id: 'c2', avatarId: 'X', nombre: 'Viaje', guiones: [guion('nuevo', 30), guion('primero', 10)] },
  ];
  const lista = guionesRecientes(celdas, [{ id: 'A', nombre: 'Dueña' }]);
  assert.deepEqual(lista.map((x) => x.g.id), ['nuevo', 'medio', 'primero', 'viejo']);
  assert.equal(lista[0].avatar, 'Sin avatar');
  assert.equal(metaDeGuion(lista[1]), 'Dolor · Dueña');
  assert.equal(masRecientePrimero({ creadoEn: 0 }, { creadoEn: 5 }), 1);
  assert.equal(guionDe(celdas, [], 'c2', 'nuevo')?.celda, 'Viaje');
  assert.equal(guionDe(celdas, [], 'c1', 'nuevo'), null, 'un guion se busca en SU celda');

  const texto = 'GANCHO\n¿Llamadas que no se confirman?\nHISTORIA\nUna historia larga, larga, larga.\nCTA\nEscríbenos';
  assert.deepEqual(portadaDe(texto), { titulo: 'GANCHO', texto: '¿Llamadas que no se confirman?' });
  assert.deepEqual(portadaDe('Un guion viejo sin rótulos'), { titulo: null, texto: 'Un guion viejo sin rótulos' });
  const espina = espinaDe(texto);
  assert.equal(espina.length, 3);
  assert.ok(Math.abs(espina.reduce((a, b) => a + b, 0) - 1) < 1e-9, 'la espina no suma 1');
  assert.ok(espina[1] > espina[0] && espina[1] > espina[2], 'el bloque más largo no es el más ancho');
  assert.deepEqual(espinaDe('GANCHO\nUno solo'), [], 'con un solo bloque no hay espina');
});

test('el estado y el veredicto: el tono de escritorio, y ningún veredicto sin el suyo', () => {
  assert.deepEqual(ESTADOS_GUION.map(tonoDeEstado), ['neutro', 'info', 'warn', 'good']);
  assert.deepEqual(Object.keys(TONO_VEREDICTO).sort(), Object.keys(VEREDICTO_VALORACION).sort(), 'un veredicto de escritorio sin su tono en el teléfono');
  assert.equal(tonoDeVeredicto('repensar-angulo'), 'bad');
  assert.equal(tonoDeVeredicto('uno-nuevo'), 'neutro');
});

test('la valoración se lee a la defensiva, y una fila del historial no viaja entera', () => {
  const v = {
    clasificacion: { short: 'Agenda llena', angle: 'dolor', hook_type: 'dolor', tags: [], format: 'talking' },
    lectura_estructural: { title: 'Gancho fuerte', text: 'El problema llega rápido.', punto_de_fuga: null },
    prediccion: { verdicto: 'mejorar-gancho', hook_rate_estimado: { min: 20, max: 28 }, retencion_cta_estimada: { min: 4, max: 7 }, razon: 'Se parece a tus mejores.' },
    reescrituras: [{ que_cambiar: 'El gancho', propuesta: 'Abre con la cifra.' }, { que_cambiar: '', propuesta: '' }],
    perfil: { n_total: 31, n_confiables: 12, angulo_saturado: null, under_testing_share: 0 },
  } as unknown as Valoracion;
  const m = valoracionM(v);
  assert.equal(m?.titulo, 'Agenda llena');
  assert.equal(m?.hook, '20–28%');
  assert.equal(m?.ret, '4–7%');
  assert.deepEqual(m?.probar, [{ que: 'El gancho', propuesta: 'Abre con la cifra.' }], 'una reescritura vacía se dibuja');
  // Una fila vieja (JSON a medias) no rompe la hoja.
  const vieja = valoracionM({ prediccion: { verdicto: 'escalar-candidato' } } as unknown as Valoracion);
  assert.deepEqual(vieja && { h: vieja.hook, p: vieja.probar, l: vieja.lectura }, { h: '—', p: [], l: { titulo: '', texto: '' } });
  assert.equal(valoracionM(null), null);

  const d = draftM({ id: 7, guion: 'x'.repeat(120), short: '  ', angle: null, hook_type: null, verdicto: null, valoracion: v, created_at: '2026-10-15T23:40:00+00:00' } as ScriptDraft);
  assert.equal(d.titulo, 'Guion');
  assert.equal(d.dia, '15/10', 'el día sale del TEXTO (sin huso), sin año en el riel');
  assert.equal(d.veredicto, 'mejorar-gancho', 'sin la columna, el veredicto sale de la valoración');
  assert.equal(d.extracto.length, 81);
  assert.ok(!('guion' in d) && !('valoracion' in d), 'la fila lleva el guion entero o la valoración cruda al teléfono');
});

test('escribir y valorar van por las rutas de escritorio, que miran el rol, y el pedido no lleva campo libre', () => {
  const api = sinComentarios(leer(`${CARPETA}/api.ts`));
  assert.match(api, /fetch\('\/api\/onboarding\/razones'/);
  assert.match(api, /action: 'guion-auto', id: celdaId/);
  assert.match(api, /fetch\('\/api\/ads-analyst\/valorar'/);
  assert.equal((api.match(/fetch\(/g) ?? []).length, (api.match(/signal: AbortSignal\.timeout\(/g) ?? []).length, 'un fetch sin tope');
  // «Crear un guion NUNCA pide redactar nada» (MatrizView.tsx): la `nota` que la ruta acepta no se manda.
  assert.doesNotMatch(api, /\bnota\b/, 'el pedido del teléfono manda un texto libre');
  // Las dos rutas cierran el rol (sólo el admin): por eso el teléfono no les suma puerta.
  assert.match(sinComentarios(leer('app/api/onboarding/razones/route.ts')), /export async function POST[\s\S]*?const ws = await resolverWsAdmin\(\);\s*if \(ws == null\) return/);
  assert.match(sinComentarios(leer('app/api/ads-analyst/valorar/route.ts')), /export async function POST[\s\S]*?const cerrada = await soloAdminAdsAnalyst\(\);\s*if \(cerrada\) return cerrada;/);
});

test('dictar es texto al campo, nunca una grabación que viaja como audio', () => {
  const todas = FUENTES.map((f) => sinComentarios(leer(f))).join('\n');
  assert.match(sinComentarios(leer(`${CARPETA}/AnalizarM.tsx`)), /useDictar\(guion, onGuion,/);
  assert.doesNotMatch(todas, /useVoiceRecorder|useGrabacionVoz/, 'el teléfono graba audio en vez de dictar al campo');
});

test('«Copiar» dice si copió de verdad', async () => {
  const antes = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  try {
    let copiado = '';
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async (t: string) => { copiado = t; } } } });
    assert.equal(await copiarTexto('GANCHO\nHola'), true);
    assert.equal(copiado, 'GANCHO\nHola');
    // Sin permiso (y sin el camino viejo, que en node no hay `document`): no finge que copió.
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async () => { throw new Error('NotAllowedError'); } } } });
    assert.equal(await copiarTexto('x'), false);
  } finally {
    if (antes) Object.defineProperty(globalThis, 'navigator', antes);
  }
});

test('la página: su guard, el puente antes del onboarding, la matriz en estricto, y nada del ?ws=', () => {
  const page = sinComentarios(leer(`${CARPETA}/page.tsx`));
  assert.match(page, /requireMovil\(\{ navKey: 'ads-writer' \}\)/);
  assert.match(page, /tab === 'analizar' \? datosAnalizar\(\) : null/, 'el historial de valorados se lee aunque la vista no sea Analizar guion');
  const puente = page.indexOf('await puentearPasosCopyGen()');
  const pendiente = page.indexOf("onboardingTabPendiente('ads-writer')");
  assert.ok(puente > 0 && pendiente > puente, 'el onboarding se pregunta antes del puente (la tab figura pendiente para quien ya la hizo)');
  assert.match(page, /getRazonesEstricto\(\)/, 'la matriz se lee con getRazones: una lectura caída se dibuja como «no hay anuncios»');
  for (const f of FUENTES) {
    const src = sinComentarios(leer(f));
    assert.doesNotMatch(src, /\bsp\.ws\b|get\('ws'\)|searchParams\)\.ws\b/, `${f} lee el workspace de la URL`);
  }
});

test('el CSS de la carpeta, los íconos y el copy', () => {
  const css = sinComentarios(leer(`${CARPETA}/copywriting.css`));
  const primitivas = leer('app/m/m.css') + leer('app/_ui/ui.css');
  const clases = new Set([...css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]));
  assert.ok(clases.size > 20, 'no se leyó ninguna clase');
  for (const c of clases) {
    if (c.startsWith('m-copywriting-') || c === 'm-copywriting') continue;
    assert.match(primitivas, new RegExp(`\\.${escapar(c)}(?![\\w-])`), `.${c}: ni lleva .m-copywriting- ni es una primitiva`);
  }
  // Y las clases que el TSX usa, también con el prefijo entero (o primitivas).
  const todas = FUENTES.map((f) => sinComentarios(leer(f))).join('\n');
  for (const m of todas.matchAll(/className="([^"]+)"/g)) {
    for (const c of m[1].split(/\s+/)) {
      if (c.startsWith('m-copywriting')) assert.ok(clases.has(c), `.${c} se usa y no está en copywriting.css`);
      else assert.match(primitivas, new RegExp(`\\.${escapar(c)}(?![\\w-])`), `.${c}: ni lleva .m-copywriting- ni es una primitiva`);
    }
  }
  const globales = leer('app/globals.css');
  const tokens = new Set([...css.matchAll(/var\(--([\w-]+)/g)].map((m) => m[1]));
  for (const t of tokens) assert.match(globales, new RegExp(`--${escapar(t)}\\s*:`), `var(--${t}) no existe en app/globals.css`);

  const iconos = leer('app/_components/icons.tsx');
  const usados = new Set([...todas.matchAll(/<Icon name="([\w-]+)"/g)].map((m) => m[1]));
  assert.ok(usados.size >= 3, 'no se leyó ningún ícono');
  for (const n of usados) assert.match(iconos, new RegExp(`^\\s*'?${escapar(n)}'?\\s*:`, 'm'), `<Icon name="${n}"> no existe: dibuja un punto`);

  // Español neutro con tú: ningún voseo en lo que se dibuja.
  // Con la tilde: «toca», «mira» o «hace» son de tú (o de él); «tocá», «mirá» y «hacé», de vos.
  const VOSEO = /(?<![\wáéíóúñ])(tocá|mirá|tenés|podés|querés|elegí|escribí|hacé|andá|fijate|contá|probá|abrí|sabés|decí|poné|usá|guardá|pegá|dictá|copiá)(?![\wáéíóúñ])/i;
  for (const f of FUENTES) {
    for (const m of sinComentarios(leer(f)).matchAll(/'([^'\n]*)'|"([^"\n]*)"|>([^<>{}\n]+)</g)) {
      const t = m[1] ?? m[2] ?? m[3] ?? '';
      assert.doesNotMatch(t, VOSEO, `${f}: voseo en «${t.trim()}»`);
    }
  }
});
