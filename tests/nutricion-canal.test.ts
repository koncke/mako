// Lo que decide si el motor intenta mandar por el WhatsApp no oficial
// =============================================================================
// Decidía la FILA (`evolution_instancias.estado`), que miente en las dos
// direcciones. Ahora decide la sonda viva y la fila queda de respaldo. El
// porqué, en lib/nutricion-canal.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canalNoOficial, proveedorDelPaso } from '../lib/nutricion-canal';

test('la sonda VIVA le gana a una fila que dice desconectado', () => {
  // El caso caro: un registro viejo apagando un canal que anda, para siempre.
  const r = canalNoOficial('vivo', 'desconectado');
  assert.equal(r.listo, true);
  assert.equal(r.fuente, 'sonda');
});

test('la sonda MUERTA le gana a una fila que dice conectado', () => {
  // mako_superadmin, medido el 08/09/2026: `open` en la fila, «Connection Closed» en la operación.
  const r = canalNoOficial('muerto', 'conectado');
  assert.equal(r.listo, false);
  assert.equal(r.fuente, 'sonda');
  assert.match(r.motivo ?? '', /volver a vincular/, 'el fallo tiene que decir qué hacer');
});

test('sin respuesta de la sonda, decide la fila — y lo dice', () => {
  assert.equal(canalNoOficial('sin_respuesta', 'conectado').listo, true);
  const r = canalNoOficial('sin_respuesta', 'desconectado');
  assert.equal(r.listo, false);
  assert.equal(r.fuente, 'fila');
  assert.match(r.motivo ?? '', /no se pudo comprobar/, '«no pude preguntar» no puede leerse como un hecho medido');
});

test('sin instancia no hay a quién sondear', () => {
  assert.equal(canalNoOficial(null, undefined).listo, false);
});

// Probado rompiéndolo (17/09/2026) con la regla vieja —`listo = estadoFila ===
// 'conectado'`, ignorando la sonda—: 2 fallos, 2 pases. Caen «la sonda VIVA le
// gana…» y «la sonda MUERTA le gana…», que son exactamente las dos mentiras de la fila.

// ── Por cuál de los dos WhatsApp sale un paso ────────────────────────────────
// Decisión de Martín del 05/10/2026: «todo esto es para la no oficial». Lo que
// se prueba acá no es el toggle —ése anda— sino el DEFAULT: qué pasa con un paso
// que nace sin el campo, que es todo lo que hace el editor de flujos.

test('un paso SIN el campo cae al no oficial, que es el canal real', () => {
  // El caso caro: así nacen los pasos del editor de flujos y del wizard. Con el
  // default viejo caían en la rama que exige template_wa y morían con «paso sin
  // template_wa» una vez por día, sin que nada lo dijera.
  assert.equal(proveedorDelPaso({ cuerpo: 'hola' } as never), 'no_oficial');
});

test('el oficial va DECLARADO, y declarado manda', () => {
  assert.equal(proveedorDelPaso({ proveedor: 'oficial' }), 'oficial');
  assert.equal(proveedorDelPaso({ proveedor: 'no_oficial' }), 'no_oficial');
});

test('un template_wa sin proveedor también es oficial: es la señal más cara', () => {
  // Protege al cliente con WABA cuya fila perdió el `proveedor` en un guardado:
  // el nombre de una plantilla sólo se escribe sabiendo que existe en Meta.
  assert.equal(proveedorDelPaso({ template_wa: 'recordatorio_cuota' }), 'oficial');
  // Y un 'no_oficial' explícito le gana igual: lo eligió una persona.
  assert.equal(proveedorDelPaso({ proveedor: 'no_oficial', template_wa: 'x' }), 'no_oficial');
});

test('un audio no es elegible: gana sobre un oficial explícito', () => {
  // Meta no aprueba plantillas con nota de voz, así que la alternativa no es
  // «sale por el oficial»: es «Meta lo rechaza».
  assert.equal(proveedorDelPaso({ tipo: 'audio', audio_id: 7, proveedor: 'oficial' }), 'no_oficial');
  // Pero `tipo: 'audio'` sin audio de la biblioteca no es un audio.
  assert.equal(proveedorDelPaso({ tipo: 'audio', audio_id: 0, proveedor: 'oficial' }), 'oficial');
});

// Probado rompiéndolo (05/10/2026), tres veces, y los números importan:
//
//   · con la regla VIEJA —`(audio) || p.proveedor === 'no_oficial' ? 'no_oficial'
//     : 'oficial'`— cae UNO de 10: «un paso SIN el campo…». Y está bien que sea
//     uno solo: entre las dos reglas hay exactamente UNA diferencia de
//     comportamiento, el default cuando el campo no viene. Todo lo demás —el
//     toggle, el audio, el template— ya andaba.
//   · leyendo la frase de Martín LITERAL (`return 'no_oficial'` y nada más) caen
//     TRES de 10: «el oficial va DECLARADO», «un template_wa sin proveedor…» y
//     «un audio no es elegible…» (su segundo caso, el `audio_id: 0`). Ésos tres
//     son los que protegen al cliente con WABA de que este arreglo le apague el
//     canal que sí tiene aprobado.
//   · ignorando sólo el `template_wa` cae UNO: el tercero.

// ── Y que el motor y la pantalla pregunten ESTO, no su propia versión ────────
// Son tres lugares que resolvían el mismo campo por su cuenta, y ésa es la forma
// en que una de las tres se queda vieja sin que nada avise.
for (const [archivo, abre, cierra] of [
  ['lib/nutricion.ts', '  const limpio = pasos', '  const { error } ='],
  ['lib/api-mako/areas/chatbot.run.ts', '  ficha_secuencia_mensajes: {', '    },'],
] as const) {
  test(`${archivo} resuelve el proveedor con proveedorDelPaso`, () => {
    const src = readFileSync(new URL(`../${archivo}`, import.meta.url), 'utf8');
    const ini = src.indexOf(abre);
    assert.ok(ini > 0, `no encontré el bloque en ${archivo}`);
    const fin = src.indexOf(cierra, ini);
    assert.ok(fin > ini, `no encontré el cierre del bloque en ${archivo}`);
    const bloque = src.slice(ini, fin);
    assert.ok(bloque.length < 4000, `el recorte mide ${bloque.length}: está mirando otra cosa`);
    const linea = bloque.split('\n').find((l) => /\bproveedor:/.test(l)) ?? '';
    assert.match(linea, /proveedorDelPaso\(/, `${archivo} decide el proveedor por su cuenta: ${linea.trim()}`);
  });
}

// Probado rompiéndolo (05/10/2026) devolviendo el ternario viejo en cada uno de
// los dos archivos, por separado: 1 fallo cada vez (10 → 9 pases), y el mensaje
// del assert trae la línea que decidió por su cuenta.
