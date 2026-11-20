// =============================================================================
// Las tres acciones que le faltaban a la API de MaKo (pendiente O19, 18/11/2026; Martín, 25/10: «Todo MaKo se debe poder
// utilizar por API»)
// =============================================================================
//   · `cargar_guiones_anuncio` (P0-10): la carga de guiones del Video Generator, por WhatsApp y HTTP (lib/guiones-cargar.ts).
//   · `generar_anuncios_planteados` (P0-11): rehacer las motivaciones de compra FUNDIENDO, sin borrar guiones
//     (lib/razones-fundir.ts, con su test puro en tests/razones-fundir.test.ts).
//   · `editar_armada_con_ia` (P0-7): el «Editar» del chat del lienzo, aunque la automatización tenga ramas
//     (lib/flujo-ia-editar.ts). Propone; al confirmar crea las etiquetas nuevas y publica.
// Se corren por las funciones REALES de la API (`ejecutarOperacion`, `aplicarEnElActo`, `confirmarPendiente`) en un hijo
// (tests/_api-acciones-octubre-hijo.ts) sobre un PostgREST de mentira; de mentira son sólo los modelos.
//
// PROBADO ROMPIÉNDOLO (18/11/2026, una por vez, restaurado; base 6 pasan / 0 fallan):
//   · cargar: `ejecutar` sin sacar los repetidos dentro del texto (todos los índices)              → 5 / 1 (el 2);
//   · cargar: el resumen nombrando también los que ya estaban (`aGuardar` = `unicos`)              → 5 / 1 (el 2);
//   · generar: `regenerarMatrizSinPerder` escribiendo lo que trajo la IA, sin fundir                → 5 / 1 (el 3);
//   · generar: sin la guarda de los flujos en `preparar`                                           → 5 / 1 (el 3);
//   · editar: `faltaParaConfirmar` que nunca dice «ya no vale»                                     → 5 / 1 (el 4);
//   · editar: el mismo plazo de IA por HTTP que por WhatsApp (150 s en vez de 40)                  → 5 / 1 (el 4).
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { REGISTRO } from '../lib/api-mako/registro';
import { RUTAS_REST } from '../lib/api-mako/rest';
import { DEFS_AL_FINAL } from '../lib/api-mako/areas/contenido.def';

const RAIZ = join(__dirname, '..');
type Escena = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
let cache: Map<string, Escena> | null = null;
function escena(nombre: string): Escena {
  if (!cache) {
    const r = spawnSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', join(RAIZ, 'tests/_api-acciones-octubre-hijo.ts')], {
      cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 200_000,
    });
    if (r.status !== 0) throw new Error(`el hijo salió con ${r.status}: ${(r.stderr || '').slice(-3000)}`);
    cache = new Map();
    for (const l of r.stdout.split('\n')) if (l.startsWith('@@OCT@@')) { const e = JSON.parse(l.slice(7)) as Escena; cache.set(e.nombre, e); }
  }
  const e = cache.get(nombre);
  assert.ok(e, `falta la escena «${nombre}»`);
  return e;
}
const def = (id: string) => {
  const d = REGISTRO.find((x) => x.id === id);
  assert.ok(d, `falta ${id} en el registro`);
  return d as typeof d & Record<string, unknown>;
};

test('1. las tres están declaradas con lo que decide su riesgo, al final de su área y con su ruta REST', () => {
  for (const [id, area] of [['cargar_guiones_anuncio', 'contenido'], ['generar_anuncios_planteados', 'contenido'], ['editar_armada_con_ia', 'chatbot']] as const) {
    const d = def(id);
    assert.equal(d.area, area);
    assert.ok(RUTAS_REST.some(([, , op]) => op === id), `${id} tiene su ruta REST`);
    assert.equal(d.costo, 'ia', `${id} usa la IA del negocio: costo 'ia'`);
    assert.equal(d.lenta, true, `${id} espera a un modelo: es lenta`);
    assert.equal((d.gating as { rolMinimo?: string }).rolMinimo, 'admin', `${id} es de admin`);
    const delArea = REGISTRO.filter((x) => x.area === area).map((x) => x.id);
    // «Al final» = detrás de todo lo de ANTES: lo único que puede seguirle es lo que se declaró DESPUÉS, en el orden de
    // DEFS_AL_FINAL (19/11/2026: Inspiración, que por la misma regla va detrás de éstas y no les saca el lugar).
    const despues = area === 'contenido' ? DEFS_AL_FINAL.slice(DEFS_AL_FINAL.findIndex((x) => x.id === id) + 1).map((x) => x.id) : [];
    if (area === 'contenido') assert.deepEqual(delArea.slice(delArea.indexOf(id) + 1), despues, `${id} va al final de su área (el orden decide el presupuesto del chat)`);
    else assert.ok(delArea.indexOf(id) >= delArea.length - 2, `${id} va al final de su área (el orden decide el presupuesto del chat)`);
  }
  // Cargar: por la app ya está `cargar_guion_propio` (la acción del botón); ésta es WhatsApp y HTTP, sobre la MISMA función.
  assert.deepEqual([...(def('cargar_guiones_anuncio').canales as string[])].sort(), ['http', 'whatsapp']);
  assert.equal(def('cargar_guion_propio').canales.includes('app'), true);
  // Lo que se confirma mirando una pantalla (lo que la persona va a guardar o a perder): pantalla.
  assert.equal(def('cargar_guiones_anuncio').confirmacion, 'pantalla');
  assert.equal(def('generar_anuncios_planteados').confirmacion, 'pantalla');
  assert.equal(def('generar_anuncios_planteados').reversible, false);
  // Editar corre el modelo al PROPONER: la pantalla genérica vuelve a correr `preparar` al confirmar (otra respuesta del
  // modelo), así que va por chat, con la propuesta guardada. Y a los leads les llega lo nuevo: un «sí» puro por WhatsApp.
  assert.equal(def('editar_armada_con_ia').confirmacion, 'chat');
  assert.equal(def('editar_armada_con_ia').aTerceros, true);
  // Ninguna corre desde un paso de un flujo (gasta IA y reescribe; un paso se confirma solo).
  // (lib/api-mako/flujo.ts es server-only: lo mira el hijo.)
  assert.deepEqual(escena('fin').noEnFlujos, ['generar_anuncios_planteados', 'editar_armada_con_ia']);
});

test('2. cargar: propone sin escribir; guarda sólo lo nuevo (ni lo ya guardado ni lo repetido), en borrador; «otra vez» no repite', () => {
  const e = escena('cargar');
  assert.equal(e.propuesta.ok, true, JSON.stringify(e.propuesta));
  assert.equal(e.propuesta.tipo, 'propuesta');
  assert.match(e.propuesta.propuesta.url, /\/mako\/revisar\//);
  assert.equal(e.guionesTrasProponer, 0, 'proponer escribió la matriz');
  // El resumen nombra lo que va a QUEDAR: el guion nuevo, y no el que ya estaba guardado.
  assert.match(e.resumenPropuesta, /Guardar un guion en «Guiones propios», en borrador: «El de la coach»\./);
  assert.doesNotMatch(e.resumenPropuesta, /El de la agenda/, 'el resumen nombra un guion que ya estaba guardado');
  assert.match(e.resumenPropuesta, /Uno ya estaba guardado/);
  assert.match(e.resumenPropuesta, /Uno se repite dentro del texto/);
  assert.equal(e.cargado.ok, true, JSON.stringify(e.cargado));
  assert.equal(e.propios.guiones.length, 1, 'se guardó el repetido o el que ya estaba');
  assert.match(e.propios.guiones[0].texto, /^Si eres coach/);
  assert.equal(e.propios.guiones[0].estado, 'borrador');
  assert.deepEqual(e.cargado.datos.guionIds, [e.propios.guiones[0].id], 'el id de lo creado vuelve en la respuesta');
  assert.equal(e.cargado.datos.celdaId, 'guiones-propios');
  assert.equal(e.trabajoIntacto, 1, 'cargar tocó la celda que ya tenía su guion');
  // Repetirlo es un éxito sin cambios (un PUT idempotente para un token detallado), y no duplica.
  assert.equal(e.otraVez.ok, true, JSON.stringify(e.otraVez));
  assert.equal(e.guionesTrasOtraVez, 1);
  assert.deepEqual(e.sinTexto.faltan, ['texto']);
});

test('3. generar: la IA corre al confirmar; lo que tiene trabajo se queda, lo vacío se reemplaza, hasta 3; nunca desde un flujo', () => {
  const e = escena('generar');
  assert.equal(e.propGen.ok, true, JSON.stringify(e.propGen));
  assert.equal(e.iaTrasProponer, 0, 'proponer llamó a la IA');
  assert.match(e.resumenGen, /Se quedan tal cual un anuncio con guiones, formato o imagen: «Dejar de vender a mano»/);
  assert.match(e.resumenGen, /Se reemplazan 2 que todavía no tienen nada: «Tener más clientes», «Cobrar más por sesión»/);
  assert.equal(e.generado.ok, true, JSON.stringify(e.generado));
  assert.deepEqual(e.trasGenerar.map((c: Escena) => c.id).slice(0, 1), ['c-trabajo'], 'la celda con trabajo no conservó su id');
  assert.equal(e.trasGenerar.find((c: Escena) => c.id === 'c-trabajo').guiones, 1, 'se perdió un guion');
  const de = (av: string) => e.trasGenerar.filter((c: Escena) => c.avatarId === av).map((c: Escena) => c.nombre);
  assert.deepEqual(de('av1'), ['Dejar de vender a mano', 'Tener su tarde libre', 'Contratar a su primera vendedora'], 'el nombre que ya estaba no se repite; hasta 3');
  assert.deepEqual(de('av2'), ['Llenar su agenda']);
  assert.ok(!e.trasGenerar.some((c: Escena) => c.id === 'c-vacia' || c.id === 'c-av2'), 'lo vacío no se reemplazó');
  assert.deepEqual(e.generado.datos.celdaIds, e.trasGenerar.filter((c: Escena) => c.id !== 'c-trabajo').map((c: Escena) => c.id), 'los ids de lo que entró vuelven');
  assert.match(e.generado.resumen, /^Listo: entraron 3 anuncios planteados nuevos; se quedó uno con su trabajo; salieron 2 que no tenían nada\.$/);
  // Con un avatar: el otro queda como estaba, también su celda vacía.
  assert.equal(e.soloAv2.ok, true, JSON.stringify(e.soloAv2));
  assert.ok(e.trasSoloAv2.some((c: Escena) => c.id === 'c-vacia'), 'tocó una celda de otro avatar');
  assert.deepEqual(e.trasSoloAv2.filter((c: Escena) => c.avatarId === 'av2').map((c: Escena) => c.nombre), ['Llenar su agenda', 'Cobrar por adelantado']);
  assert.match(e.soloAv2.resumen, /salió uno que no tenía nada\.$/);
  assert.match(e.avatarFalso.error, /No hay un avatar con id «no-existe»/);
  assert.equal(e.desdeFlujo.ok, false);
  assert.match(e.desdeFlujo.error, /Una automatización no puede rehacer tus anuncios/);
  // Sin nada nuevo que poner, no se escribe (ni se sacan las vacías para nada).
  assert.equal(e.nadaNuevo.ok, false);
  assert.match(e.nadaNuevo.resumen, /MaKo no encontró motivaciones nuevas/);
  assert.equal(e.nadaEscrito, true, 'escribió la matriz sin nada nuevo');
});

test('4. editar: propone sin escribir; al confirmar crea la etiqueta y publica; una propuesta vieja ya no vale; 40 s por HTTP', () => {
  const e = escena('editar');
  assert.equal(e.pendiente.tipo, 'pendiente', JSON.stringify(e.pendiente));
  assert.equal(e.cuerpoTrasProponer, 'Hola, te escribo por lo que dejaste en el formulario', 'proponer publicó');
  assert.equal(e.etiquetasTrasProponer, 0, 'proponer creó la etiqueta (se crea recién al confirmar)');
  assert.match(e.resumenPendiente, /^Editar «Bienvenida» y publicarla: Cambié 1 · agregué 1\. Etiquetas nuevas: «Saludado»\.$/);
  assert.doesNotMatch(e.resumenPendiente, /toca Publicar/, 'el cierre del lienzo no va en el resumen de la API');
  assert.equal(typeof e.payloadPendiente.antes, 'string', 'la propuesta guarda la firma de lo publicado que vio');
  assert.equal(e.editado.ok, true, JSON.stringify(e.editado));
  assert.match(e.editado.resumen, /^Listo: publiqué «Bienvenida» con los cambios\.$/);
  const m1 = e.tras.find((p: Escena) => p.id === 'm1');
  assert.equal(m1.cuerpo, 'Hola {{lead_nombre}}, gracias por escribirnos');
  const etiqueta = e.etiquetas.find((x: Escena) => x.nombre === 'Saludado');
  assert.ok(etiqueta, 'no se creó la etiqueta nueva');
  assert.equal(e.tras.find((p: Escena) => p.id === 'm2').accion.params.etiquetaId, etiqueta.id, 'la tarjeta TAG quedó con el ref y no con el id real');
  // La propuesta de antes de la edición: se cierra sin tocar nada (la automatización cambió).
  assert.match(String(e.vieja?.error), /Esa automatización cambió desde que te propuse esto/);
  assert.equal(e.estadoVieja, 'error', 'la propuesta vieja quedó viva');
  assert.equal(e.cuerpoTrasVieja, 'Hola {{lead_nombre}}, gracias por escribirnos');
  // MaKo contestó en vez de cambiar: no hay nada que proponer, y se dice.
  assert.match(e.contesta.error, /^Eso ya está así/);
  // Lo que se sabe sin el modelo, sin el modelo: la de otro negocio, sin pedido, desde un flujo.
  assert.match(e.ajena.error, /No existe la secuencia #42/);
  assert.deepEqual(e.sinPedido.faltan, ['pedido']);
  assert.match(e.deFlujo.error, /Una automatización no puede editar automatizaciones/);
  assert.equal(e.llamadasDespues, e.llamadasAntesDeLasGuardas, 'una guarda llamó al modelo');
  // Por HTTP la IA tiene 40 s (/api/v1 corta a 60): con más, el pedido moría sin respuesta.
  assert.ok(e.plazoHttpMs >= 39_000 && e.plazoHttpMs <= 40_500, `plazo por HTTP: ${e.plazoHttpMs} ms`);
});

test('5. ninguna sale de la base de mentira, y lo que no se mockeó es sólo el registro de actividad', () => {
  const e = escena('fin');
  assert.deepEqual(e.red, [], 'salió a la red');
  for (const t of e.sinMock as string[]) assert.ok(['actividad_acciones', 'pruebas'].includes(t), `una tabla sin mock decide algo: ${t}`);
});

test('6. la carga del Video Generator y la de la API son la MISMA función (la acción del botón llama a lib/guiones-cargar.ts)', async () => {
  const { readFileSync } = await import('node:fs');
  const accion = readFileSync(join(RAIZ, 'app/video-generator/cargar-guiones-action.ts'), 'utf8').replace(/\r\n/g, '\n');
  const run = readFileSync(join(RAIZ, 'lib/api-mako/areas/contenido.run.ts'), 'utf8').replace(/\r\n/g, '\n');
  for (const src of [accion, run]) {
    assert.match(src, /from '@\/lib\/guiones-cargar'/);
    assert.match(src, /cargarGuiones\(/);
  }
  const i = accion.indexOf('export async function cargarGuionesAction(');
  const fin = accion.indexOf('export async function', i + 10);
  assert.ok(i > 0 && fin > i, 'no está cargarGuionesAction');
  const cuerpo = accion.slice(i, fin);
  assert.match(cuerpo, /cargarGuiones\(crudo, indices\)/);
  assert.doesNotMatch(cuerpo, /setRazones\(|getRazones\(/, 'la acción del botón volvió a leer o escribir la matriz por su cuenta');
});
