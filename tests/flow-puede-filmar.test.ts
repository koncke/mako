// =============================================================================
// «Puede filmar» se mide, no se recuerda — y nueve definiciones eran ocho de más
// =============================================================================
// ⚠️ ESTE MÓDULO NACIÓ DE DOS CAPTURAS DEL MISMO SEGUNDO. El popup de la extensión
// decía «MaKo ya puede hacer tus anuncios» y el aviso de al lado, dentro de MaKo,
// decía «MaKo todavía no puede filmar tus anuncios». Las dos pantallas hablaban del
// mismo hecho y no compartían ni un insumo.
//
// La causa: `listo` significaba «hay un bearer guardado», y en flow.google.com
// Google no emite ninguno — el propio latido lo borra al ver el dominio nuevo. La
// condición se negaba a sí misma, así que las CUATRO compuertas que cuelgan de ella
// (el botón de crear, la cola de la extensión, el reparto del server y el guard de
// filmar) quedaban cerradas para siempre, para todos.
//
// Ahora `listo` es un ENSAYO EN SECO del camino real. Este test fija sus tres
// rechazos, que son los tres modos en que una plantilla guardada MIENTE.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { puedeFilmar, ensayarOperacion, elegirPlantilla } from '../lib/flow-puede-filmar';
import { codificar, CODIFICACIONES } from '../lib/flow-boq-patch';
import { A_PEDIR } from '../lib/flow-operaciones';

const CLIP = A_PEDIR.find((o) => o.op === 'generar_clip')!;
const IMAGEN = A_PEDIR.find((o) => o.op === 'generar_imagen')!;

/** Un cuerpo creíble que lleva la frase con una codificación real. */
function cuerpoCon(frase: string, cod = 'form'): string {
  return `f.req=%5B%5B%5B%22YhhmEf%22%2C%22${codificar(frase, cod)}%22%5D%5D%5D&at=__MAKO_AT__`;
}

/** El mapa de plantillas tal como vive en `chrome.storage.local`. */
function sanas() {
  return {
    'boq:YhhmEf': { op: 'generar_clip', cuerpo: cuerpoCon(CLIP.frase!), url: 'https://flow.google.com/_/x?rpcids=YhhmEf' },
    'boq:XiFvBb': { op: 'generar_imagen', cuerpo: cuerpoCon(IMAGEN.frase!), url: 'https://flow.google.com/_/x?rpcids=XiFvBb' },
  };
}

test('con las dos plantillas sanas, puede filmar', () => {
  const r = puedeFilmar(sanas(), A_PEDIR);
  assert.equal(r.puede, true, r.porQue);
  assert.equal(r.falta, null);
});

test('la frase se encuentra con CUALQUIERA de las codificaciones conocidas', () => {
  // El ancla no viaja siempre igual: form-urlencoded manda los espacios como `+`.
  // Si el ensayo sólo reconociera una forma, rechazaría plantillas perfectas.
  for (const cod of CODIFICACIONES) {
    const pl = { x: { op: 'generar_clip', cuerpo: cuerpoCon(CLIP.frase!, cod), url: 'u' } };
    assert.equal(ensayarOperacion(pl, CLIP).puede, true, `falló con la codificación «${cod}»`);
  }
});

test('sin plantilla no puede, y dice cuál falta', () => {
  const r = puedeFilmar({}, A_PEDIR);
  assert.equal(r.puede, false);
  assert.equal(r.falta, 'generar_clip');
  assert.match(r.porQue, /SIN_PLANTILLA/);
});

test('una plantilla SIN CUERPO no cuenta como aprendida', () => {
  // ⚠️ ES EL CASO QUE PRODUJO LA CAPTURA. El popup marcaba la operación como sabida
  // con que existiera una entrada con `op`; el replay exige `cuerpo`. Dos verdades
  // sobre la misma plantilla, y la optimista era la que se mostraba.
  const pl = sanas() as Record<string, { op: string; cuerpo: string | null; url: string | null }>;
  pl['boq:YhhmEf'].cuerpo = null;
  const r = puedeFilmar(pl, A_PEDIR);
  assert.equal(r.puede, false);
  assert.match(r.porQue, /PLANTILLA_INCOMPLETA\(generar_clip\)/);
});

test('una plantilla SIN URL tampoco', () => {
  // `repetirEnBoq` la exige igual que el cuerpo (`!pl.cuerpo || !pl.url`), y ningún
  // gate la miraba.
  const pl = sanas() as Record<string, { op: string; cuerpo: string | null; url: string | null }>;
  pl['boq:XiFvBb'].url = '';
  const r = puedeFilmar(pl, A_PEDIR);
  assert.equal(r.puede, false);
  assert.match(r.porQue, /PLANTILLA_INCOMPLETA\(generar_imagen\)/);
});

test('una plantilla cuyo cuerpo fue PISADO no cuenta, aunque esté completa', () => {
  // ⚠️ EL CASO SILENCIOSO. Al guardar, una generación nueva de la misma clase
  // conserva el `op` y reemplaza el `cuerpo`. Si la persona generó otra cosa
  // después de enseñarnos, la plantilla queda registrada, completa, y sin el ancla:
  // `reemplazarEnCuerpo` daría SIN_ANCLA con el trabajo ya tomado y el botón ya
  // apretado. Es indistinguible de una sana si sólo se mira que exista.
  const pl = sanas();
  pl['boq:YhhmEf'].cuerpo = cuerpoCon('un gato tomando mate en la playa');
  const r = puedeFilmar(pl, A_PEDIR);
  assert.equal(r.puede, false);
  assert.match(r.porQue, /SIN_ANCLA\(generar_clip\)/);
});

test('un catálogo vacío contesta que NO, nunca que sí', () => {
  // Un import roto, un `catch`, una copia desincronizada: los tres dejan la lista
  // vacía. «No sé» no puede resolver a un verde — sería el éxito falso de siempre,
  // con el agravante de que no dejaría nada que investigar.
  const r = puedeFilmar(sanas(), []);
  assert.equal(r.puede, false);
  assert.equal(r.porQue, 'SIN_CATALOGO');
});

test('se queda con la PRIMERA que falla, en el orden del catálogo', () => {
  // Un paso por pantalla: el popup ofrece enseñar `falta`, y tiene que ser la
  // primera para que el recorrido sea estable entre latidos.
  const pl = { z: { op: 'generar_imagen', cuerpo: cuerpoCon(IMAGEN.frase!), url: 'u' } };
  const r = puedeFilmar(pl, A_PEDIR);
  assert.equal(r.falta, A_PEDIR[0].op);
});

test('una entrada basura no rompe el ensayo, lo hace contestar que no', () => {
  // El mapa viene de `chrome.storage.local`, o sea de un JSON que escribió otra
  // versión de la extensión. Explotar acá apagaría el puente entero.
  for (const basura of [null, undefined, {}, { op: null }, { op: 'generar_clip' }]) {
    const r = puedeFilmar({ x: basura as never }, A_PEDIR);
    assert.equal(r.puede, false, `dio verde con ${JSON.stringify(basura)}`);
  }
});

test('con DOS plantillas para el mismo op, gana la usable — no la primera', () => {
  // ⚠️ EL CASO QUE ABRÍA LAS CUATRO COMPUERTAS SOBRE UNA PLANTILLA MUERTA.
  //
  // Un navegador que aprendió en labs.google y después migró tiene dos entradas para
  // `generar_clip`: la vieja REST y la nueva de BOQ. Se guardan por CLASE, así que
  // conviven. La REST tiene cuerpo, tiene url, y su JSON lleva la frase en texto
  // plano —o sea que `comoViajo` la encuentra con la codificación `crudo`—: pasaba
  // los tres chequeos. Lo que no tiene es dónde poner el `at`, que es el ÚLTIMO
  // control del espejo. El ensayo daba verde y el pedido moría cinco veces con la
  // plantilla buena a una clave de distancia.
  const pl = {
    'video:batchAsyncGenerateVideoStartImage': {
      op: 'generar_clip',
      cuerpo: `{"prompt":"${CLIP.frase}"}`,
      url: 'https://aisandbox-pa.googleapis.com/v1/video:batch?key=AIza',
      cuando: 1,
    },
    'boq:YhhmEf': {
      op: 'generar_clip', cuerpo: cuerpoCon(CLIP.frase!), url: 'https://flow.google.com/_/x', cuando: 2,
    },
  };
  const elegida = elegirPlantilla(pl, CLIP);
  assert.equal(elegida.clase, 'boq:YhhmEf', 'eligió la plantilla REST, que no tiene dónde poner el `at`');
  assert.equal(ensayarOperacion(pl, CLIP).puede, true);
});

test('una plantilla sin lugar para el `at` no habilita nada', () => {
  // Es el último control que hace el espejo antes de mandar (`PLANTILLA_SIN_AT`), y
  // el ensayo tiene que replicarlo o da un verde que la ejecución rechaza.
  const pl = {
    x: { op: 'generar_clip', cuerpo: `f.req=${codificar(CLIP.frase!, 'form')}`, url: 'u', cuando: 9 },
  };
  const r = ensayarOperacion(pl, CLIP);
  assert.equal(r.puede, false);
  assert.match(r.porQue, /PLANTILLA_SIN_AT\(generar_clip\)/);
});
