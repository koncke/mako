// =============================================================================
// Agregar y quitar clips sin perder los que ya se pagaron
// =============================================================================
// Todo en este módulo está indexado por NÚMERO DE TOMA: el mapa `video` —con las
// urls de los clips pagados—, `promptsPropios`, y los rangos `desde`/`hasta` de
// cada escena. Insertar un clip en el medio corre todos los números de ahí para
// adelante, y lo que no se remapee queda apuntando a otra toma.
//
// El modo de falla no es un error: es que el clip de la toma 4 pase a mostrarse
// como el de la 5. No hay excepción, no hay log, y lo único que lo delata es
// mirar el anuncio y notar que dice otra cosa. Por eso estos tests existen antes
// que la pantalla.

import test from 'node:test';
import assert from 'node:assert/strict';
import { agregarClip, quitarClip, cambiarDuracion } from '../app/video-generator/plan-clips';
import type { PlanGuardado } from '../app/video-generator/video-datos';

const clip = (n: number, segundos = 8, voz = `linea ${n}`) => ({
  n, segundos, habla: true, voz, queSeVe: '', camara: '', prompt: `prompt ${n}`,
  palabras: 2, tope: 24, voseo: [] as string[],
});

/** Un anuncio de 4 tomas en 2 escenarios, con la toma 2 ya filmada. */
function plan(): PlanGuardado {
  return {
    id: 'p1',
    plan: {
      puestaId: 'selfie-movimiento', titulo: 'Anuncio', duracionTotalSeg: 32,
      ritmo: 'H H H H', deCorrido: '', clips: [clip(1), clip(2), clip(3), clip(4)],
    },
    escenas: [
      { n: 1, desde: 1, hasta: 2, lugar: 'El auto', prompt: 'car' },
      { n: 2, desde: 3, hasta: 4, lugar: 'La oficina', prompt: 'office' },
    ],
    video: {
      '2': { url: 'https://mako/toma-2.mp4', mediaId: 'op-2' },
      '3': { error: 'falló' },
    },
    imagenes: { '1': { elegida: 'img-auto' }, '2': { elegida: 'img-oficina' } },
    promptsPropios: { '3': 'mi prompt de la 3' },
  } as unknown as PlanGuardado;
}

// ── Agregar ─────────────────────────────────────────────────────────────────

test('agregar en el medio CORRE las marcas de las tomas posteriores', () => {
  // Lo que se protege: el clip pagado de la toma 2 tiene que seguir siendo el de
  // la toma 2, y el fallo de la 3 pasar a la 4.
  const r = agregarClip(plan(), 2, 10);
  assert.ok(r.ok);
  assert.equal(r.item.video?.['2']?.url, 'https://mako/toma-2.mp4', 'el clip pagado no se movió');
  assert.equal(r.item.video?.['3'], undefined, 'la 3 es la toma nueva: vacía');
  assert.equal(r.item.video?.['4']?.error, 'falló', 'el fallo de la vieja 3 viajó a la 4');
});

test('y corre también los prompts escritos a mano', () => {
  const r = agregarClip(plan(), 2, 10);
  assert.ok(r.ok);
  assert.equal(r.item.promptsPropios?.['4'], 'mi prompt de la 3');
  assert.equal(r.item.promptsPropios?.['3'], undefined);
});

test('la escena que CONTIENE la posición se estira; la siguiente se corre entera', () => {
  // Sin esto el clip nuevo cae fuera de todo escenario y no se puede filmar:
  // `generarTomaAction` exige el escenario confirmado de SU toma.
  const r = agregarClip(plan(), 2, 10);
  assert.ok(r.ok);
  assert.deepEqual(r.item.escenas?.map((e) => [e.desde, e.hasta]), [[1, 3], [4, 5]]);
});

test('el clip nuevo nace VACÍO, no con el texto del vecino', () => {
  // Uno vacío se ve; uno copiado se lee como si alguien lo hubiera querido así.
  const r = agregarClip(plan(), 2, 10);
  assert.ok(r.ok);
  assert.equal(r.item.plan.clips[2].voz, '');
  assert.equal(r.item.plan.clips[2].segundos, 10);
});

test('agregar al principio con 0', () => {
  const r = agregarClip(plan(), 0, 6);
  assert.ok(r.ok);
  assert.equal(r.item.plan.clips[0].voz, '');
  assert.equal(r.item.video?.['3']?.url, 'https://mako/toma-2.mp4', 'la 2 pasó a ser la 3');
  assert.deepEqual(r.item.escenas?.map((e) => [e.desde, e.hasta]), [[1, 3], [4, 5]]);
});

test('los totales se recalculan', () => {
  const r = agregarClip(plan(), 4, 10);
  assert.ok(r.ok);
  assert.equal(r.item.plan.duracionTotalSeg, 42, '32 + 10');
  assert.equal(r.item.plan.ritmo.split(' ').length, 5);
});

test('una duración que Flow no genera se rechaza', () => {
  const r = agregarClip(plan(), 2, 9);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /9 segundos/);
});

// ── Quitar ──────────────────────────────────────────────────────────────────

test('NO se puede quitar una toma ya filmada', () => {
  // Es el punto entero: quitarla sería destruir ~15 créditos sin que nadie lo
  // haya decidido.
  const r = quitarClip(plan(), 2);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /Descarta el clip primero/);
});

test('quitar una sin filmar corre las de atrás', () => {
  const r = quitarClip(plan(), 3);
  assert.ok(r.ok);
  assert.equal(r.item.plan.clips.length, 3);
  assert.equal(r.item.video?.['2']?.url, 'https://mako/toma-2.mp4', 'el pagado no se movió');
  assert.equal(r.item.video?.['3'], undefined, 'el fallo de la 3 se fue con ella');
  assert.equal(r.item.promptsPropios, undefined, 'su prompt también');
});

test('una escena que se queda sin tomas DESAPARECE, con su imagen', () => {
  // Si no, queda un escenario que no cubre nada y sigue pidiendo aprobación en un
  // paso que ya no anima nada.
  let p = plan();
  const a = quitarClip(p, 4); assert.ok(a.ok); p = a.item;
  const b = quitarClip(p, 3); assert.ok(b.ok); p = b.item;
  assert.equal(p.escenas?.length, 1, 'la oficina se quedó sin tomas');
  assert.deepEqual(Object.keys(p.imagenes ?? {}), ['1'], 'y su imagen se fue con ella');
});

test('al caerse una escena, las que siguen se RENUMERAN con su imagen', () => {
  // El mismo remapeo que las tomas, un nivel más arriba: si la escena 1 se cae y
  // la 2 pasa a ser la 1, su imagen tiene que viajar con ella o el paso del
  // escenario muestra la del otro lugar.
  //
  // Se parte de un plan SIN clips filmados: con el de la toma 2 puesto, vaciar el
  // primer escenario es imposible —y está bien que lo sea, es el guard que
  // protege los créditos—. Que el guard estorbe acá no lo hace menos correcto:
  // hace que este test tenga que armar el caso que de verdad quiere probar.
  let p = { ...plan(), video: {} } as PlanGuardado;
  const a = quitarClip(p, 1); assert.ok(a.ok); p = a.item;
  const b = quitarClip(p, 1); assert.ok(b.ok); p = b.item;
  assert.equal(p.escenas?.length, 1);
  assert.equal(p.escenas?.[0].lugar, 'La oficina');
  assert.equal(p.imagenes?.['1']?.elegida, 'img-oficina', 'la imagen viajó con su escena');
});

test('no se puede dejar el anuncio sin ninguna toma', () => {
  const uno = { ...plan(), plan: { ...plan().plan, clips: [clip(1)] }, video: {} } as PlanGuardado;
  assert.equal(quitarClip(uno, 1).ok, false);
});

// ── Duración ────────────────────────────────────────────────────────────────

test('cambiar la duración recalcula el total', () => {
  const r = cambiarDuracion(plan(), 1, 4);
  assert.ok(r.ok);
  assert.equal(r.item.plan.clips[0].segundos, 4);
  assert.equal(r.item.plan.duracionTotalSeg, 28, '32 - 8 + 4');
});

test('no se le cambia la duración a una toma ya filmada', () => {
  // El clip que existe dura lo que dura: cambiar el número dejaría el plan
  // diciendo una cosa y el archivo otra.
  const r = cambiarDuracion(plan(), 2, 10);
  assert.equal(r.ok, false);
});

test('solo duraciones que Flow genera', () => {
  assert.equal(cambiarDuracion(plan(), 1, 9).ok, false);
  assert.equal(cambiarDuracion(plan(), 1, 7).ok, false);
  assert.equal(cambiarDuracion(plan(), 1, 10).ok, true);
});

// ── La invariante que lo cubre todo ─────────────────────────────────────────

test('ningún movimiento pierde un clip PAGADO', () => {
  const urls = (p: PlanGuardado) =>
    Object.values(p.video ?? {}).map((v) => v?.url).filter(Boolean).sort();

  let p = plan();
  const antes = urls(p);
  for (const paso of [
    () => agregarClip(p, 1, 10),
    () => agregarClip(p, 0, 6),
    () => quitarClip(p, 5),
    () => cambiarDuracion(p, 1, 4),
    () => agregarClip(p, 3, 8),
  ]) {
    const r = paso();
    if (r.ok) p = r.item;
    assert.deepEqual(urls(p), antes, 'el clip pagado sobrevivió a cada movimiento');
  }
});
