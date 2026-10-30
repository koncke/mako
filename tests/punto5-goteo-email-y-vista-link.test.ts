// =============================================================================
// Automations (punto 5), 23/10/2026: Goteo y Tope por día también en Email, la vista previa del link con su X, y lo que se fue
// =============================================================================
// Martín (23/10/2026, textual): «Elimina "Vista previa del link", eso no se debe configurar en Configuraciones... Sino en la
// tarjeta de WhatsApp o donde haya pegado el link, simplemente sacándolo como se hace en WhatsApp, que te sale la tarjeta con
// una X para sacarla... Y elimina "Misma persona"... Y en Email también pon goteo y tope por día. Mejora el diseño de eso,
// porque que el botón de "on-off" esté al lado de donde se configuran el resto de cosas no es muy intuitivo».
//
// Lo que fija este archivo (lo NUEVO; lo que se fue está en los tests que fijaban lo viejo: automations-misma-persona-pasos,
// vista-previa-en-configuraciones, automations-antiban):
//   1. `primerLink`: el link que WhatsApp convierte en tarjeta (https, www., un dato que es un link) o null;
//   2. lo que se fue (`personaHoras`, `sinVistaPrevia`) da error al guardar y se ignora al leer;
//   3. el motor: `sinLugar`/`quedaFrenada` miran el canal de la tarjeta;
//   4. la API de MaKo;
//   5. la pantalla: `FilaOpcion` con `debajo` (el número va abajo SÓLO con la opción prendida).
// ⚠️ DESDE EL 24/10/2026 23:00 NO HAY GOTEO DEL EMAIL APARTE (Martín, f21 de la llamada con Leandro: «Uno solo: un solo
// interruptor de goteo (y uno de tope por día) que valga para todos los canales»). Lo que fijaba `goteoEmail` acá pasó a fijar
// que ya no existe, y el goteo único lo fija tests/goteo-un-interruptor.test.ts (R1, R4, R5 y R7 de abajo eran de los dos goteos).
//
// PROBADO ROMPIÉNDOLO (23/10/2026, una pieza por vez con cp de respaldo y restaurada con `git diff --stat -- app lib` vacío; base
// 10 / 0 acá). Cada rotura deja en rojo, de los tests de este archivo y de sus vecinos:
//   R1. `sinLugar` sin el goteo del email (sin `frenoGoteoEmail`)                      → 1 acá + 1 en goteo-automatizacion
//   R2. `debajo` siempre dibujado en `FilaOpcion`                                      → 1 acá
//   R3. la X de `VistaPreviaDelLink` sin poner `sin_vista_previa`                      → 1 acá + 1 en vista-previa-en-configuraciones
//   R4. el uso del goteo del email contando WhatsApp (`.eq('canal', 'whatsapp')`)      → 1 acá + 1 en goteo-automatizacion
//   R5. `goteoEmail` con los rangos del WhatsApp                                       → 1 acá
//   R6. `primerLink` sin reconocer `www.`                                              → 1 acá
//   R7. `quedaFrenada` sin mirar el canal (`const email = false`)                      → 1 acá (la primera versión del test NO lo
//       atrapaba: salió verde; se le agregó la línea `const email = esEmail(canal)` y recién ahí dio rojo)
//   R8. `personaHoras` aceptado otra vez al guardar                                    → 1 acá + 1 en automations-antiban
//   R9. el saneo leyendo `sinVistaPrevia` otra vez                                      → 1 acá + 1 en vista-previa-en-configuraciones
//
// Correr: node --import tsx --test tests/punto5-goteo-email-y-vista-link.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { primerLink } from '../lib/mensaje-partes';
import { RANGOS_GOTEO, configParaGuardar, sanearConfigAutomatizacion, tieneConfigPropia, tieneRitmoPropio } from '../lib/config-automatizacion';
import { FilaOpcion } from '../app/automations/FilasOpciones';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const tramo = (src: string, desde: string, hasta: string) => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `falta «${desde}»`);
  return src.slice(i, src.indexOf(hasta, i + desde.length));
};

// ── 1. El primer link del mensaje ─────────────────────────────────────────────────────────────────

test('`primerLink`: un https, un www., un dato que es un link; sin link, null', () => {
  assert.equal(primerLink({ canal: 'whatsapp', cuerpo: 'Mira esto: https://hola-mako.com/x y nada más' }), 'https://hola-mako.com/x');
  assert.equal(primerLink({ canal: 'whatsapp', cuerpo: 'Entra a www.negocio-uno.com/oferta cuando puedas' }), 'www.negocio-uno.com/oferta');
  assert.equal(primerLink({ canal: 'whatsapp', cuerpo: 'Tu llamada: {{reunion_link}}' }), '{{reunion_link}}');
  assert.equal(primerLink({ canal: 'whatsapp', cuerpo: 'Tu llamada: {{ reunion_link }}' }), '{{ reunion_link }}', 'el dato con espacios también');
  assert.equal(primerLink({ canal: 'whatsapp', cuerpo: 'Hola {{nombre}}, ¿cómo vas?' }), null, 'un dato que no es un link no es un link');
  assert.equal(primerLink({ canal: 'whatsapp', cuerpo: '' }), null);
  // De varios, el PRIMERO: es el que WhatsApp convierte en tarjeta.
  assert.equal(primerLink({ canal: 'whatsapp', cuerpo: 'a https://uno.com y b https://dos.com' }), 'https://uno.com');
  // Con varios textos (un mensaje partido), el primero que lleve link; un audio no cuenta.
  assert.equal(primerLink({ canal: 'whatsapp', cuerpo: 'Hola', partes: [{ tipo: 'texto', cuerpo: 'Hola' }, { tipo: 'texto', cuerpo: 'El curso: https://x.com' }] }), 'https://x.com');
});

// ── 2. `goteoEmail` en la configuración de la automatización ───────────────────────────────────────

test('`goteoEmail` ya no existe (24/10/2026, f21): lo guardado se lee como el goteo de todos, y guardarlo da error', () => {
  // Lo de antes: un goteo sólo de email pasa a valer para todos los canales; con los dos, queda el de WhatsApp.
  assert.deepEqual(sanearConfigAutomatizacion('{"goteoEmail":{"minutos":10,"dia":80}}'), { goteo: { minutos: 10, dia: 80 } });
  assert.deepEqual(sanearConfigAutomatizacion('{"goteo":{"minutos":5},"goteoEmail":{"minutos":10,"dia":80}}'), { goteo: { minutos: 5 } });
  assert.deepEqual(sanearConfigAutomatizacion('{"goteoEmail":"x"}'), {});
  const r = configParaGuardar({}, { goteoEmail: { minutos: 10 } });
  assert.ok(!r.ok && /uno solo para todos los canales/.test(r.error), 'se guardaba un goteo del email aparte');
  // Los rangos: los minutos 1 a 240; el tope por día llega al más alto de las líneas (el de email, 500).
  assert.deepEqual([...RANGOS_GOTEO.minutos], [1, 240]);
  assert.deepEqual([...RANGOS_GOTEO.dia], [1, 500]);
  // «Ya le eligieron el ritmo» (el aviso de Prospección) cuenta también el goteo de antes.
  assert.equal(tieneRitmoPropio(sanearConfigAutomatizacion('{"goteoEmail":{"dia":30}}')), true);
  assert.equal(tieneRitmoPropio({}), false);
  assert.equal(tieneConfigPropia(sanearConfigAutomatizacion('{"goteoEmail":{"dia":30}}')), true);
});
test('lo que se fue da error al guardar y se ignora al leer: `personaHoras` y `sinVistaPrevia`', () => {
  for (const cambio of [{ personaHoras: { whatsapp: 20 } }, { personaHoras: null }, { sinVistaPrevia: true }, { sinVistaPrevia: null }]) {
    assert.equal(configParaGuardar({}, cambio).ok, false, `${JSON.stringify(cambio)} se guardaba`);
  }
  assert.match((configParaGuardar({}, { personaHoras: { whatsapp: 20 } }) as { error: string }).error, /«Misma persona» ya no existe/);
  assert.match((configParaGuardar({}, { sinVistaPrevia: true }) as { error: string }).error, /vista previa de un link se saca en el mensaje, con la X de su tarjeta/);
  // Lo que quedó guardado de antes (19 automatizaciones activas tenían la Misma persona prendida) no se lee ni cuenta.
  const viejo = JSON.stringify({ personaHoras: { whatsapp: 20, email: 20 }, sinVistaPrevia: true, goteo: { minutos: 5 } });
  assert.deepEqual(sanearConfigAutomatizacion(viejo), { goteo: { minutos: 5 } });
  assert.deepEqual(sanearConfigAutomatizacion('{"personaHoras":{"whatsapp":0},"sinVistaPrevia":true}'), {});
  assert.equal(tieneConfigPropia(sanearConfigAutomatizacion(viejo)), true);
  assert.equal(tieneConfigPropia(sanearConfigAutomatizacion('{"personaHoras":{"whatsapp":0},"sinVistaPrevia":true}')), false);
});

// ── 3. El motor: el canal de la tarjeta decide qué goteo la frena ──────────────────────────────────

const motor = leer('lib/nutricion.ts');
const ini = motor.indexOf('export async function procesarEnvios(');
const proc = motor.slice(ini, motor.indexOf('\n}\n', ini));

test('el motor: `sinLugar(insc, canal)` y `quedaFrenada(insc, sec, canal)` miran el canal de la tarjeta (un goteo, cada canal con su cuenta)', () => {
  assert.doesNotMatch(proc, /goteoEmail|goteosEmail|frenoGoteoEmail|usoGoteoEmail/, 'volvió el goteo del email aparte');
  // Los dos puntos donde un mensaje espera lugar pasan el canal del mensaje que le toca (el leído, o el destino del salto).
  assert.match(proc, /if \(sinLugar\(insc, pasoLeido\?\.canal\) && !\(pasoLeido && sec && sigueSinCupo\(sec\.pasos, idxLeido\)\)\) \{ await quedaFrenada\(insc, sec, pasoLeido\?\.canal\); continue; \}/);
  assert.match(proc, /if \(sinLugar\(insc, destino\.canal\) && !sigueSinCupo\(sec\.pasos, r\.idx\)\) \{ await quedaFrenada\(insc, sec, destino\.canal\); continue; \}/);
  assert.equal((proc.match(/sinLugar\(insc\)/g) ?? []).length, 0, 'quedó un `sinLugar` sin canal: frenaría a un canal con el uso de otro');
});

test('«Por qué no sale» ya no lee «Misma persona» ni la reunión cercana: `sinAntiBan` es sólo del carril', () => {
  const db = sinComentarios(leer('lib/por-que-no-sale-db.ts'));
  assert.match(db, /sinAntiBan: carril,/);
  assert.doesNotMatch(db, /reunionCerca|reunionFuturaMs|ultimoWa|personaHoras|HS_REUNION_CERCA/);
  assert.doesNotMatch(sinComentarios(leer('lib/por-que-no-sale.ts')), /mismaPersona|Misma persona|libreMp/);
});

// ── 4. La API de MaKo ────────────────────────────────────────────────────────────────────────────────

test('la API de MaKo ofrece UN goteo para todos los canales (sin el del email aparte) y ya no ofrece «Misma persona»', () => {
  const def = sinComentarios(leer('lib/api-mako/areas/chatbot.def.ts'));
  assert.doesNotMatch(def, /goteoEmail|sinGoteoEmail/, 'volvió el goteo del email aparte');
  assert.match(def, /\{ nombre: 'goteoPorDia', tipo: 'number', entero: true, minimo: 1, maximo: 500,/);
  const run = sinComentarios(leer('lib/api-mako/areas/chatbot.run.ts'));
  assert.doesNotMatch(run, /goteoEmail|goteo_email/);
  assert.match(run, /canales: 'todos: WhatsApp, email, Instagram y Messenger, cada uno con su cuenta'/);
  const acciones = sinComentarios(leer('app/automations/config-automatizacion-actions.ts'));
  assert.doesNotMatch(acciones, /personaNegocio/);
});
// ── 5. La pantalla: el número DEBAJO, sólo con la opción prendida ───────────────────────────────────

const boton = createElement('button', { role: 'switch' });

test('`FilaOpcion` con `debajo`: el número va en un renglón de abajo; sin `debajo`, la fila es sólo nombre e interruptor', () => {
  const con = renderToStaticMarkup(createElement(FilaOpcion, { nombre: 'Goteo', interruptor: boton, debajo: createElement('input', { value: '5', readOnly: true }) }));
  assert.match(con, /<span data-fila-debajo="" style="[^"]*flex-basis:100%[^"]*"><input readOnly="" value="5"\/><\/span>/);
  assert.ok(con.indexOf('role="switch"') < con.indexOf('data-fila-debajo'), 'el número tiene que ir DESPUÉS del interruptor (debajo)');
  const sin = renderToStaticMarkup(createElement(FilaOpcion, { nombre: 'Goteo', interruptor: boton }));
  assert.doesNotMatch(sin, /data-fila-debajo/, 'apagada, no hay renglón de abajo');
  // Con `undefined` (la opción apagada que pasa la pantalla), igual.
  assert.doesNotMatch(renderToStaticMarkup(createElement(FilaOpcion, { nombre: 'Goteo', interruptor: boton, debajo: undefined })), /data-fila-debajo/);
});

test('la pantalla tiene DOS filas (Goteo y Tope por día) en «Todos los canales» y pasa `debajo` sólo prendida', () => {
  const p = sinComentarios(leer('app/automations/ConfigAutomatizacionPanel.tsx'));
  const hook = tramo(p, 'export function useAntibanDeLaAutomatizacion(', '\n}\n');
  const llamadas = hook.match(/filaGoteo\('(minutos|dia)', '(Goteo|Tope por día)'/g) ?? [];
  assert.deepEqual(llamadas, ["filaGoteo('minutos', 'Goteo'", "filaGoteo('dia', 'Tope por día'"]);
  // El número va debajo y sólo prendida: «Uno cada [5] min», «Hasta [50] por día».
  const f = tramo(hook, 'const filaGoteo = ', '\n  };');
  assert.match(f, /debajo=\{on \? \(/);
  assert.match(f, /\) : undefined\} \/>/);
  assert.doesNotMatch(f, /data-goteo-canal/, 'la fila volvió a ser de un canal');
  assert.match(hook, /'Uno cada', 'min'/);
  assert.match(hook, /'Hasta', 'por día'/);
  // El interruptor sigue EN la fila (el nombre con su interruptor), no suelto al lado del número.
  assert.match(f, /interruptor=\{<Interruptor on=\{on\}/);
  // Y la pantalla las dibuja en UN bloque.
  const aj = tramo(p, 'export function AjustesDeLaAutomatizacion(', '\n}\n');
  assert.match(aj, /\{auto\.filas\}/);
  assert.doesNotMatch(aj, /\{auto\.whatsapp\}|\{auto\.email\}/);
});
// ── 6. La vista previa del link, con su X ───────────────────────────────────────────────────────────

test('el editor del WhatsApp: la tarjeta del link con su X, que pone `sin_vista_previa: true` en ESE mensaje', () => {
  const lienzo = leer('app/automations/FlujoLienzo.tsx');
  const v = tramo(lienzo, 'function VistaPreviaDelLink(', '\n}\n');
  // Sin link, o ya sacada, no se dibuja nada.
  assert.match(v, /if \(!link \|\| sacada\) return null;/);
  // Muestra el sitio y la dirección (el título y la imagen los pone WhatsApp al mandar).
  assert.match(v, /new URL\(/);
  assert.match(v, /\{dato \? 'El link del dato' : sitio\}/);
  // La X: un botón con nombre que pone la marca del mensaje.
  assert.match(v, /<button type="button" aria-label="Sacar la vista previa del link"/);
  assert.match(v, /cambiar\(\{ sin_vista_previa: true \}, true\)/);
  // Si el link cambia, la tarjeta vuelve (como pegar otro link en WhatsApp).
  assert.match(v, /link !== sacadaCon\) \{ setSacadaCon\(null\); cambiar\(\{ sin_vista_previa: false \}, true\); \}/);
  // Sólo en el WhatsApp no oficial.
  assert.match(lienzo, /\{noOficial && <VistaPreviaDelLink paso=\{paso\} cambiar=\{cambiar\} \/>\}/);
});

test('el link sin la puntuación pegada (como WhatsApp), y Configuraciones lee una sola vez', () => {
  // Sin esto, escribir un punto después del link lo «cambiaba» y la tarjeta que se había sacado volvía sola (23/10/2026).
  assert.equal(primerLink({ cuerpo: 'mirá www.neg.com.' } as never), 'www.neg.com');
  assert.equal(primerLink({ cuerpo: 'ver (https://x.com/a), dale' } as never), 'https://x.com/a');
  assert.equal(primerLink({ cuerpo: 'https://x.com/a?b=1' } as never), 'https://x.com/a?b=1');
  const panel = readFileSync(new URL('../app/automations/ConfigAutomatizacionPanel.tsx', import.meta.url), 'utf8');
  assert.match(panel, /leerUnaVez\(secuenciaId\)/, 'el horario y los canales vuelven a leer cada uno por su lado');
  // Fuera de `leerUnaVez`, nadie llama a la action directo.
  const sinLaFuncion = panel.replace(/\r\n/g, '\n').replace(/function leerUnaVez[\s\S]*?\n\}\n/, '');
  assert.doesNotMatch(sinLaFuncion, /getConfigAutomatizacionAction\(secuenciaId\)/);
});
