// =============================================================================
// Los avisos de reunión no vuelven a prometer lo que todavía no existe
// =============================================================================
// El aviso post-llamada preguntaba «¿te paso el resumen y las objeciones acá?» en
// el INSTANTE del webhook de Fathom — cuando el Closing Analyst todavía no había
// corrido y no había ni resumen ni objeciones. La pregunta además no tenía
// receptor: nadie escuchaba la respuesta.
//
// El arreglo es de ORDEN, no de texto, y por eso necesita test: mover el
// `emitirDelCatalogo` de vuelta afuera del `after()` compila perfecto, pasa el
// typecheck, y devuelve el bug entero sin que nada avise. Lo mismo con el
// `startIso` de Calendly: si alguien saca la revalidación, MaKo reserva contra un
// hueco que el modelo pudo haber reescrito.
//
// Son asserts sobre el CÓDIGO FUENTE (el patrón "CABLEADO" de la casa): lo que se
// prueba es que el cableado siga en su lugar, no una función pura.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');

test('CABLEADO: el aviso post-llamada se emite DESPUÉS del análisis, adentro del after()', () => {
  const src = leer('../app/api/webhooks/fathom/route.ts');

  const iAfter = src.indexOf('after(() =>');
  assert.ok(iAfter > 0, 'el trabajo pesado sigue yendo en background con after()');

  const iAviso = src.indexOf("emitirDelCatalogo('reunion-ocurrio-fathom'");
  assert.ok(iAviso > 0, 'el aviso de reunión ocurrida sigue existiendo');
  assert.ok(
    iAviso > iAfter,
    'el aviso volvió a emitirse ANTES del after(): en ese momento no hay análisis, así que solo puede prometer',
  );

  // Y el texto lo arma el módulo que lee lo MISMO que pinta la pantalla: si el
  // webhook vuelve a escribir el mensaje a mano, el mensaje y la vista se separan.
  assert.ok(src.includes('textoAvisoPostLlamada('), 'el texto del aviso sale de lib/lead-resumen, no de un template suelto');
  assert.ok(
    !/¿Quer[ée]s que te pase el resumen/.test(src),
    'volvió la pregunta que nadie escucha: si no hay receptor de la respuesta, va un LINK',
  );
});

test('CABLEADO: el aviso sale igual aunque el follow-up no se haya podido redactar', () => {
  const src = leer('../app/api/webhooks/fathom/route.ts');
  const bloque = src.slice(src.indexOf('after(() =>'));

  const iIf = bloque.indexOf('if (attended !== false)');
  const iAviso = bloque.indexOf("emitirDelCatalogo('reunion-ocurrio-fathom'");
  assert.ok(iIf > 0, 'sigue existiendo el guard de asistencia para la redacción del follow-up');
  assert.ok(iAviso > iIf, 'el aviso va después de intentar la redacción');

  // Una reunión que TERMINÓ tiene que avisar aunque el lead no haya asistido o
  // aunque el análisis se caiga. Se mide con las llaves: si el balance vuelve a
  // 0 antes del aviso, el aviso está FUERA del `if`, que es lo que se quiere.
  let balance = 0;
  let cerroAntes = false;
  for (let i = iIf; i < iAviso; i++) {
    if (bloque[i] === '{') balance += 1;
    else if (bloque[i] === '}') {
      balance -= 1;
      if (balance === 0) { cerroAntes = true; break; }
    }
  }
  assert.ok(cerroAntes, 'el aviso quedó ADENTRO del `if (attended !== false)`: un no-show deja de avisar que la reunión terminó');
});

test('CABLEADO: el horario de Calendly se revalida contra la API al confirmar, no se cree el de la propuesta', () => {
  const src = leer('../lib/mako-doer-acciones.ts');
  const i = src.indexOf("case 'agendar_reunion'");
  assert.ok(i > 0, 'la acción de agendar sigue existiendo');
  const caso = src.slice(i, src.indexOf('\n      case ', i + 10));

  const iHuecos = caso.indexOf('huecosDisponibles(');
  const iReserva = caso.indexOf('reservarReunion(');
  assert.ok(iHuecos > 0, 'se dejó de pedir los huecos reales antes de reservar');
  assert.ok(iReserva > iHuecos, 'se reserva ANTES de revalidar el hueco');
  assert.ok(
    caso.includes('h.startIso === startIso'),
    'el startIso tiene que matchear EXACTO contra Calendly: pasó por el modelo y entre la propuesta y el "sí" pasan horas',
  );
});

test('CABLEADO: agendar sigue siendo una PROPUESTA, nunca una escritura directa', () => {
  const src = leer('../lib/mako-doer-acciones.ts');
  const i = src.indexOf("case 'proponer_agendar_reunion'");
  assert.ok(i > 0, 'la tool de proponer agendado sigue existiendo');
  const caso = src.slice(i, src.indexOf('\n      case ', i + 10));
  assert.ok(caso.includes("proponer('agendar_reunion'"), 'la tool dejó de pasar por la pendiente de confirmación');
  assert.ok(!caso.includes('reservarReunion('), 'la tool reserva directo: el "sí" del dueño dejó de ser obligatorio');
});

test('CABLEADO: el link al resumen lo arma el código, nunca el modelo', () => {
  // Un id de lead es un dato exacto sin redundancia: un dígito cambiado abre la
  // ficha de OTRO lead y no se ve roto. Los cuatro avisos que linkean tienen que
  // usar el helper, no un template a mano.
  for (const ruta of ['../app/api/webhooks/calendly/route.ts', '../app/api/webhooks/fathom/route.ts']) {
    const src = leer(ruta);
    assert.ok(
      !/\/crm\/\$\{[^}]*\}\/resumen/.test(src),
      `${ruta} arma la URL del resumen a mano en vez de usar linkResumenLead`,
    );
  }
  const lib = leer('../lib/lead-resumen.ts');
  assert.ok(lib.includes('export function linkResumenLead'), 'el helper del link sigue siendo la fuente única');
});

test('CABLEADO: el recordatorio no depende de la frecuencia del cron para no repetirse', () => {
  const src = leer('../lib/reunion-recordatorio.ts');
  // La marca lleva el ISO de la reunión: si el lead REAGENDA, la key cambia y el
  // recordatorio del horario nuevo sí sale.
  assert.ok(/keyMarca = \(leadId: number, cual: 'R1' \| 'R2', iso: string\)/.test(src),
    'el candado dejó de ser por reunión: atado a la ventana del cron, un cambio de schedule duplica avisos');
  const iEmitir = src.indexOf('emitirDelCatalogo(');
  const iMarcar = src.indexOf('setSetting(key');
  assert.ok(iEmitir > 0 && iMarcar > iEmitir, 'la marca se escribe ANTES del envío: un fallo deja la reunión sin aviso para siempre');
});
