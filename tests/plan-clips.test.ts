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
import { agregarClip, quitarClip, cambiarDuracion, tomasQueHacenFalta, partirHastaQueEntre, enCuantasQueda } from '../app/video-generator/plan-clips';
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

// =============================================================================
// El apilado de la última toma, con las anteriores YA PAGADAS
// =============================================================================
// El caso real, medido en producción el 01/09/2026: el plan de una clienta tenía
// las tomas 1..8 filmadas y la 9 con **70 palabras en 8 segundos** —densidad
// 8,75 contra un techo de 3,0—. El plan se había creado antes del reparto
// exacto, así que el arreglo del planificador no lo alcanzaba: había que poder
// repararlo desde la pantalla.
//
// Y no se podía: `redistribuir` se abstenía del plan ENTERO al ver una toma
// filmada, así que «sumar una toma» insertaba el clip vacío y dejaba las 70
// palabras donde estaban. O sea el mismo «corte a negro con la persona callada»
// que ese guard dice que hay que evitar, entrando por su propia puerta.

/** Un plan con las primeras `filmadas` tomas pagadas y la última desbordada. */
function planApilado(): PlanGuardado {
  const clips = [];
  for (let n = 1; n <= 9; n++) {
    const ultima = n === 9;
    clips.push({
      n,
      segundos: 8,
      habla: true,
      // 70 palabras en la última: el caso real.
      voz: ultima ? Array.from({ length: 70 }, (_, i) => `p${i + 1}`).join(' ') : `linea ${n}`,
      queSeVe: '', camara: '', prompt: `prompt ${n}`,
      palabras: ultima ? 70 : 2,
      tope: 24,
      voseo: [] as string[],
    });
  }
  const video: Record<string, { url: string }> = {};
  for (let n = 1; n <= 8; n++) video[String(n)] = { url: `https://mako/toma-${n}.mp4` };
  return {
    id: 'apilado',
    plan: {
      puestaId: 'selfie-movimiento', titulo: 'Diagnóstico', duracionTotalSeg: 72,
      ritmo: 'H H H H H H H H H', deCorrido: '', clips,
    },
    escenas: [{ n: 1, desde: 1, hasta: 9, lugar: 'El auto', prompt: 'car' }],
    video,
    imagenes: { '1': { elegida: 'img-auto' } },
  } as unknown as PlanGuardado;
}

const vozDe = (it: PlanGuardado, n: number) => it.plan.clips.find((c) => c.n === n)?.voz ?? '';
const palabras = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

test('APILADO: sumar tomas al final REPARTE la toma desbordada, con 8 tomas ya pagadas', () => {
  const p = planApilado();
  // Dos tomas más: 70 palabras repartidas en tres tomas de 8 s.
  let r = agregarClip(p, 9, 8);
  assert.ok(r.ok);
  r = agregarClip(r.item, 10, 8);
  assert.ok(r.ok);

  const it = r.item;
  assert.equal(it.plan.clips.length, 11);

  // ⚠️ LO PAGADO NO SE MOVIÓ NI UNA PALABRA. Es la razón por la que el guard
  // viejo existía, y la que el arreglo tenía que conservar: el video de la toma 3
  // dice «linea 3» y va a seguir diciéndolo.
  for (let n = 1; n <= 8; n++) {
    assert.equal(vozDe(it, n), `linea ${n}`, `la toma pagada ${n} cambió de texto`);
    assert.equal(it.video?.[String(n)]?.url, `https://mako/toma-${n}.mp4`);
  }

  // Y las tres sin filmar se repartieron las 70 palabras.
  const repartido = [9, 10, 11].map((n) => palabras(vozDe(it, n)));
  assert.equal(repartido.reduce((a, b) => a + b, 0), 70, 'se perdieron o se inventaron palabras');
  for (const [k, cuantas] of repartido.entries()) {
    assert.ok(cuantas > 0, `la toma ${9 + k} quedó MUDA: un corte a negro con la persona callada`);
  }
  // Ninguna se queda con el montón. Antes del arreglo, la 9 seguía con 70.
  assert.ok(Math.max(...repartido) < 40, `sigue apilado: ${JSON.stringify(repartido)}`);
});

test('APILADO: el guion entero sobrevive, en orden', () => {
  const p = planApilado();
  const antes = p.plan.clips.map((c) => c.voz).join(' ');
  let r = agregarClip(p, 9, 8); assert.ok(r.ok);
  r = agregarClip(r.item, 10, 8); assert.ok(r.ok);
  const despues = r.item.plan.clips.map((c) => c.voz).filter(Boolean).join(' ');
  assert.equal(despues.replace(/\s+/g, ' ').trim(), antes.replace(/\s+/g, ' ').trim());
});

test('APILADO: el texto NO cruza una toma pagada', () => {
  // La 9 desborda y está al final. Si el reparto ignorara las paredes, parte de
  // sus 70 palabras podría terminar en la 8 —que ya está filmada diciendo otra
  // cosa— y el anuncio tendría audio y guion distintos sin que nadie lo note.
  const p = planApilado();
  const r = agregarClip(p, 9, 8);
  assert.ok(r.ok);
  assert.equal(vozDe(r.item, 8), 'linea 8');
});

test('sumar una toma sobre un guion QUE YA ENTRA deja el clip vacío', () => {
  // El otro uso de sumar: agregar un beat nuevo. Ahí repartir sería moverle las
  // frases a alguien que no lo pidió.
  const p = planApilado();
  // Se le saca el desborde a la 9 y se suma en el medio del tramo sin filmar.
  p.plan.clips[8] = { ...p.plan.clips[8], voz: 'cierre corto', palabras: 2 };
  const r = agregarClip(p, 9, 8);
  assert.ok(r.ok);
  assert.equal(vozDe(r.item, 10), '');
  assert.equal(vozDe(r.item, 9), 'cierre corto');
});

test('tomasQueHacenFalta cuenta contra el techo del formato, no adivina', () => {
  // `selfie-movimiento` admite 3 palabras por segundo, así que en 8 s entran 24:
  // las 70 de la toma real necesitan 3 tomas. El número sale del catálogo, no de
  // una constante escrita al lado — el día que una puesta cambie de densidad,
  // esto la sigue.
  assert.equal(tomasQueHacenFalta(70, 8, 'selfie-movimiento'), 3);
  assert.equal(tomasQueHacenFalta(24, 8, 'selfie-movimiento'), 1);
  assert.equal(tomasQueHacenFalta(25, 8, 'selfie-movimiento'), 2);
  // Una puesta que no existe no puede contestar, y no inventa un número: 1 deja
  // la pantalla como estaba en vez de mandar a partir en 7.
  assert.equal(tomasQueHacenFalta(70, 8, 'no-existe'), 1);
});

test('cambiar la duración NO toca el texto, que es lo que su contrato dice', () => {
  // Pasaba por el mismo `recomponer` que sumar y quitar, así que con nada
  // filmado le repartía el guion entero al anuncio por haber movido un número.
  const p = planApilado();
  // Sin nada filmado: es el caso donde el reparto sí corría.
  p.video = {};
  const antes = p.plan.clips.map((c) => c.voz);
  const r = cambiarDuracion(p, 2, 10);
  assert.ok(r.ok);
  assert.deepEqual(r.item.plan.clips.map((c) => c.voz), antes);
  assert.equal(r.item.plan.clips.find((c) => c.n === 2)?.segundos, 10);
});

test('quitar una toma SE LLEVA SU LÍNEA, y reparte lo que queda', () => {
  // ⚠️ Esto es lo que hace, no necesariamente lo que alguien espera: quitar la
  // toma 3 borra «linea 3» del guion, en silencio. Queda escrito acá para que
  // sea una decisión y no un descubrimiento — si en algún momento se decide que
  // la línea tiene que sobrevivir mudándose al vecino, este test es el que hay
  // que dar vuelta.
  const p = planApilado();
  p.video = {};                                   // nada pagado: se puede quitar
  const antes = palabras(p.plan.clips.map((c) => c.voz).join(' '));
  const suLinea = palabras(p.plan.clips[2].voz);
  const r = quitarClip(p, 3);
  assert.ok(r.ok);
  const despues = palabras(r.item.plan.clips.map((c) => c.voz).filter(Boolean).join(' '));
  assert.equal(despues, antes - suLinea);
  // Y lo que queda NO se apila: se repartió sobre las 8 tomas que sobrevivieron.
  const maxima = Math.max(...r.item.plan.clips.map((c) => palabras(c.voz)));
  assert.ok(maxima <= 24, `quedó una toma con ${maxima} palabras sobre un tope de 24`);
});

test('⚠️ PARTIR SIMULA: `ceil(palabras/tope)` da un piso que NO alcanza', () => {
  // Medido sobre el plan real: 70 palabras y topes de 24 dan ceil = 3, y con tres
  // tomas quedaban de 25 y 28 — una seguía sin poder filmarse, o sea que el
  // arreglo dejaba el problema puesto. El repartidor corta en separadores
  // seguros, nunca por el medio de una frase, así que el promedio no manda.
  const p = planApilado();
  assert.equal(tomasQueHacenFalta(70, 8, 'selfie-movimiento'), 3);   // el piso
  const r = partirHastaQueEntre(p, 9);
  assert.ok(r.ok);
  // Y ninguna toma SIN FILMAR queda por encima de su tope. Es la única prueba
  // que importa: que el resultado se pueda filmar.
  for (const c of r.item.plan.clips) {
    const filmada = !!r.item.video?.[String(c.n)]?.url;
    if (!filmada) assert.ok((c.palabras ?? 0) <= (c.tope ?? 0), `la toma ${c.n} quedó con ${c.palabras} sobre ${c.tope}`);
  }
});

test('PARTIR no toca ni una palabra de lo pagado, ni pierde guion', () => {
  const p = planApilado();
  const antes = p.plan.clips.map((c) => c.voz).join(' ').replace(/\s+/g, ' ').trim();
  const r = partirHastaQueEntre(p, 9);
  assert.ok(r.ok);
  for (let n = 1; n <= 8; n++) {
    assert.equal(r.item.plan.clips.find((c) => c.n === n)?.voz, `linea ${n}`);
  }
  const despues = r.item.plan.clips.map((c) => c.voz).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  assert.equal(despues, antes);
});

test('el número del botón es el que va a pasar', () => {
  // Dos cuentas distintas —una para mostrar y otra para hacer— son cómo el botón
  // promete un número y el server hace otro.
  const p = planApilado();
  const dice = enCuantasQueda(p, 9);
  const r = partirHastaQueEntre(p, 9);
  assert.ok(r.ok);
  assert.equal(r.item.plan.clips.length - p.plan.clips.length + 1, dice);
});

test('partir una toma que YA entra no agrega nada', () => {
  const p = planApilado();
  p.plan.clips[8] = { ...p.plan.clips[8], voz: 'cierre corto', palabras: 2 };
  const r = partirHastaQueEntre(p, 9);
  assert.ok(r.ok);
  assert.equal(r.item.plan.clips.length, 9);
  assert.equal(enCuantasQueda(p, 9), 1);
});
