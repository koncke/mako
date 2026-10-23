// =============================================================================
// Ángulos sin la recomendación a nivel negocio: la biblioteca, el formato POR ANUNCIO, y una sola cuenta
// =============================================================================
// Pedido del Cerebro (23/10/2026): «"Ángulos" no lo lee ningún generador… O lo enganchás a quien debería
// leerlo, o se saca el botón: pagar IA por un adorno no va». Medido en prod ese día: 0 negocios con
// `mako.formatos_recom` y 0 llamadas a «Elegir formatos de creativo de la biblioteca» en toda la historia; lo
// que SÍ se usa es `elegirAngulo` (un formato por celda, 6 negocios con todas sus celdas), y ese prompt ya
// recibe avatar, razón, copy y entregable. La recomendación no le sumaba nada a nadie: se sacó entera
// (docs/hallazgos-onboarding.md → «Ángulos: la recomendación se sacó»).
//
// Lo que fija este archivo:
//   · `usosPorFormato` (lib/angulos-data.ts) es LA cuenta: la leen la vista, el grafo y la API.
//   · nada del producto vuelve a llamar ni nombrar lo que se sacó (barrido de app/ y lib/ sobre el índice);
//   · una operación RETIRADA no queda nombrada en ningún texto del registro ni de un runner. Ningún test lo
//     cazaba: la descripción de `listar_formatos_creativo` y la nota de su runner mandaban a
//     `recomendar_formatos_creativo` cuando ya no existía (lo encontró el inventario del 23/10). Una guarda
//     general por patrón da 24 falsos positivos (nombres de campos), por eso es una lista explícita.
//
//   · la vista y la API cuentan lo que DIBUJA la Matriz: sólo las celdas de un avatar que existe. Borrar un avatar
//     no borra sus razones, y la verificación del 23/10 encontró «En 3 anuncios» con 2 tarjetas en la Matriz.
//
// ROTURAS (23/10/2026, base 5 de 5 en verde, restaurado de memoria): `usosPorFormato` contando la celda de
// guiones propios: 1 fallo, 4 pases · el POST de vuelta en la ruta: 1 fallo, 4 pases · la nota de
// `listar_formatos_creativo` nombrando recomendar_formatos_creativo: 1 fallo, 4 pases · el grafo colgando un
// formato de la raíz: 1 fallo, 4 pases.
// Tras la verificación (base 6 de 6, restaurado de memoria), cada una 1 fallo y 5 pases: la cuenta sin cortar por
// avatares · la ruta sin avatares · la vista sin la biblioteca de respaldo · el grafo sacando formatos de los
// guiones propios · el grafo con «Lo elegiste» · la API sin avatares · elegir_formato sin la guarda en ejecutar.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { BIBLIOTECA_ANGULOS, CELDA_GUIONES_PROPIOS, usosPorFormato } from '../lib/angulos-data';
import { REGISTRO, porId } from '../lib/api-mako/registro';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** Las operaciones que salieron del registro. Al sacar una, se suma acá: su nombre no puede quedar en ningún texto. */
const OPERACIONES_RETIRADAS = ['recomendar_formatos_creativo', 'crear_borrador_instagram'] as const;

test('usosPorFormato: una cuenta por formato, sin la celda de guiones propios ni ids que no existen', () => {
  const [img, vid] = [BIBLIOTECA_ANGULOS.find((f) => f.medio === 'imagen')!.id, BIBLIOTECA_ANGULOS.find((f) => f.medio === 'video')!.id];
  const celdas = [
    { id: 'a', anguloImagen: img, anguloVideo: vid },
    { id: 'b', anguloImagen: img, anguloVideo: '' },
    { id: 'c', anguloImagen: 'inventado', anguloVideo: vid },
    { id: CELDA_GUIONES_PROPIOS, anguloImagen: img, anguloVideo: vid },
    { id: 'd' },
  ];
  assert.deepEqual(usosPorFormato(celdas), { [img]: 2, [vid]: 2 });
  assert.deepEqual(usosPorFormato([]), {});
  assert.equal(CELDA_GUIONES_PROPIOS, 'guiones-propios', 'el id que escribe el Video Generator (cargar-guiones-action.ts)');
});

test('usosPorFormato con los avatares cuenta lo que dibuja la Matriz: una celda de un avatar borrado no suma', () => {
  const img = BIBLIOTECA_ANGULOS.find((f) => f.medio === 'imagen')!.id;
  const celdas = [
    { id: 'a', avatarId: 'av1', anguloImagen: img },
    { id: 'b', avatarId: 'av2', anguloImagen: img },
    { id: 'c', avatarId: 'borrado', anguloImagen: img },
  ];
  assert.deepEqual(usosPorFormato(celdas, [{ id: 'av1' }, { id: 'av2' }]), { [img]: 2 }, 'la pantalla diría 3 y la Matriz dibuja 2');
  assert.deepEqual(usosPorFormato(celdas), { [img]: 3 }, 'sin avatares (el grafo, que dibuja las huérfanas) cuenta todas');
  assert.deepEqual(usosPorFormato(celdas, []), {}, 'sin ningún avatar, la Matriz no dibuja nada');
});

test('nada del producto llama ni nombra la recomendación que se sacó', () => {
  const archivos = execFileSync('git', ['ls-files', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8' })
    .split(/\r?\n/).map((f) => f.trim()).filter((f) => /\.tsx?$/.test(f));
  assert.ok(archivos.length > 300, `git ls-files devolvió ${archivos.length}: esto no corrió en el repo`);
  const PROHIBIDO = /\b(recomendarFormatos|getRecomendaciones|setRecomendaciones|parseRecomendaciones|FORMATOS_SYSTEM_TEMPLATE|FORMATOS_USER_TEMPLATE)\b|['"`]mako\.formatos_recom['"`]|['"`]formatos\.(system|user)['"`]/;
  const malos = archivos.filter((f) => existsSync(join(RAIZ, f)) && !f.startsWith('app/admin/dev/') && PROHIBIDO.test(sinComentarios(leer(f))));
  assert.deepEqual(malos, [], 'vuelven a usar la recomendación de formatos a nivel negocio');
  // La ruta de la vista quedó en un GET sin IA, y la vista no le manda nada.
  const ruta = sinComentarios(leer('app/api/onboarding/formatos/route.ts'));
  assert.doesNotMatch(ruta, /export async function POST/, 'el POST que pagaba IA volvió');
  assert.match(ruta, /usos: usosPorFormato\(razones, avatares\)/, 'la vista contaría los anuncios de un avatar borrado, que la Matriz no dibuja');
  const vista = sinComentarios(leer('app/onboarding/FormatosView.tsx'));
  assert.doesNotMatch(vista, /method: 'POST'/);
  assert.match(vista, /est\?\.usos/);
  assert.match(vista, /est\?\.biblioteca \?\? BIBLIOTECA_ANGULOS/, 'con el GET caído la vista dice «0 formatos» aunque la biblioteca es fija');
});

test('el grafo de Second Brain dibuja sólo los formatos que usa la matriz, con la misma cuenta', () => {
  const grafo = sinComentarios(leer('lib/cerebro-grafo.ts'));
  assert.match(grafo, /const usos = usosPorFormato\(razones\);/);
  assert.doesNotMatch(grafo, /unir\(RAIZ, id, 'Un formato que MaKo eligió para este negocio'\)/, 'un formato colgado de la raíz es uno que no usa ningún anuncio');
  assert.match(grafo, /if \(r\.id !== CELDA_GUIONES_PROPIOS\) for \(const f of usados\) razonAFormatos\.push/, 'la celda de guiones propios dibuja un formato que la cuenta no cuenta (n = 0)');
  assert.doesNotMatch(grafo, /Lo elegiste para/, 'el formato de cada anuncio lo elige MaKo, no el dueño');
});

test('la API de MaKo: no hay operación que la dispare, y la lectura cuenta como la vista', () => {
  assert.equal(porId('recomendar_formatos_creativo'), undefined);
  const listar = porId('listar_formatos_creativo');
  assert.ok(listar, 'la biblioteca sigue por la API');
  const run = sinComentarios(leer('lib/api-mako/areas/contenido.run.ts'));
  const cuerpo = run.slice(run.indexOf('  listar_formatos_creativo: {'), run.indexOf('  opciones_siguiente_paso_guion: {'));
  assert.match(cuerpo, /const m = await matriz\(\);/, 'la cuenta lee la matriz estricta: «no pude leer» no es «nadie lo usa»');
  assert.match(cuerpo, /usosPorFormato\(m\.razones, avatares\)/, 'la API cuenta distinto que la vista');
  assert.match(cuerpo, /avatares = await avataresParaEscribir\(\)/, 'los avatares en estricto: con [] por un error, todo daría 0');
  // Elegir el formato pagaba IA sobre la celda de los guiones propios, que no es un anuncio (las hermanas ya la frenaban).
  const elegir = run.slice(run.indexOf('  elegir_formato_creativo_anuncio: {'), run.indexOf('  escribir_guion_anuncio: {'));
  assert.equal(elegir.split('if (c.celda.id === CELDA_PROPIOS) return').length - 1, 2, 'preparar y ejecutar tienen que frenar los guiones propios');
});

test('una operación retirada no queda nombrada en ningún texto del registro ni de un runner', () => {
  for (const id of OPERACIONES_RETIRADAS) assert.equal(porId(id), undefined, `${id} está en OPERACIONES_RETIRADAS pero sigue en el registro`);
  const textos = REGISTRO.flatMap((d) => [d.id, d.titulo, d.descripcion, ...(d.parametros ?? []).map((p) => p.descripcion ?? '')].map((t) => ({ op: d.id, t: String(t ?? '') })));
  const runners = execFileSync('git', ['ls-files', 'lib/api-mako/areas'], { cwd: RAIZ, encoding: 'utf8' })
    .split(/\r?\n/).map((f) => f.trim()).filter((f) => /\.run\.ts$|\.helpers\.ts$/.test(f) && existsSync(join(RAIZ, f)))
    .map((f) => ({ op: f, t: sinComentarios(leer(f)) }));
  const malos: string[] = [];
  for (const { op, t } of [...textos, ...runners]) {
    for (const id of OPERACIONES_RETIRADAS) if (new RegExp(`\\b${id}\\b`).test(t)) malos.push(`${op} nombra ${id}`);
  }
  assert.deepEqual(malos, [], 'el modelo va a buscar una herramienta que ya no existe');
});
