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
//   2. `goteoEmail` en la configuración de una automatización: se guarda, se saca con null, tiene SUS rangos, y lo que se
//      fue (`personaHoras`, `sinVistaPrevia`) da error al guardar y se ignora al leer;
//   3. el motor: `sinLugar`/`quedaFrenada` miran el canal de la tarjeta, y el email cuenta para el uso del goteo del email;
//   4. la API de MaKo ofrece y dice el goteo del email;
//   5. la pantalla: `FilaOpcion` con `debajo` (el número va abajo SÓLO con la opción prendida) y las cuatro filas.
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
import {
  RANGOS_GOTEO, RANGOS_GOTEO_EMAIL, configParaGuardar, sanearConfigAutomatizacion, tieneConfigPropia, tieneRitmoPropio,
} from '../lib/config-automatizacion';
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

test('`goteoEmail` se guarda, se saca con null, y tiene SUS rangos (no los del WhatsApp)', () => {
  const g = configParaGuardar({}, { goteoEmail: { minutos: 10, dia: 80 } });
  assert.ok(g.ok);
  assert.deepEqual(g.ok && g.config, { goteoEmail: { minutos: 10, dia: 80 } });
  assert.ok(g.ok && !g.vacia && tieneConfigPropia(g.config), 'con goteo de email la configuración quedaba «sin nada propio»');
  // Vuelve igual del saneo (lo que lee el motor).
  assert.deepEqual(sanearConfigAutomatizacion(g.ok ? g.valor : ''), { goteoEmail: { minutos: 10, dia: 80 } });
  // Cada campo por separado, sin tocar el otro; y sin tocar el goteo de WhatsApp.
  const solo = configParaGuardar({ goteo: { minutos: 5 }, goteoEmail: { minutos: 10, dia: 80 } }, { goteoEmail: { dia: null } });
  assert.deepEqual(solo.ok && solo.config, { goteo: { minutos: 5 }, goteoEmail: { minutos: 10 } });
  // `null` saca todo el goteo del email; sin otra cosa propia, queda vacía (se borra la clave).
  const saca = configParaGuardar({ goteoEmail: { minutos: 10 } }, { goteoEmail: null });
  assert.ok(saca.ok && saca.config.goteoEmail === undefined && saca.vacia);
  // Sus rangos: los minutos 1 a 240; el tope por día llega al máximo del email de la línea (500), no al del WhatsApp (150).
  assert.deepEqual([...RANGOS_GOTEO_EMAIL.minutos], [1, 240]);
  assert.notDeepEqual([...RANGOS_GOTEO_EMAIL.dia], [...RANGOS_GOTEO.dia], 'el email usaba el rango de WhatsApp');
  assert.equal(configParaGuardar({}, { goteoEmail: { dia: 400 } }).ok, true, '400 emails por día entra');
  assert.equal(configParaGuardar({}, { goteo: { dia: 400 } }).ok, false, '400 WhatsApp por día no entra: el rango de cada canal es el suyo');
  for (const mal of [{ minutos: 0 }, { minutos: 241 }, { dia: 0 }, { dia: 501 }, { minutos: 2.5 }, { dia: '40' }]) {
    const r = configParaGuardar({}, { goteoEmail: mal });
    assert.equal(r.ok, false, `${JSON.stringify(mal)} se guardaba`);
    assert.match(!r.ok ? r.error : '', /van de \d+ a \d+\./);
  }
  // Saneo de lo guardado: lo que no entra queda ausente, nunca tira.
  assert.deepEqual(sanearConfigAutomatizacion('{"goteoEmail":{"minutos":999,"dia":30}}'), { goteoEmail: { dia: 30 } });
  assert.deepEqual(sanearConfigAutomatizacion('{"goteoEmail":"x"}'), {});
  // «Ya le eligieron el ritmo» (el aviso de Prospección) cuenta también el goteo del email.
  assert.equal(tieneRitmoPropio({ goteoEmail: { dia: 30 } }), true);
  assert.equal(tieneRitmoPropio({}), false);
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

test('el motor: `sinLugar(insc, canal)` y `quedaFrenada(insc, sec, canal)` miran el goteo del canal de la tarjeta', () => {
  // El goteo del email se arma como el de WhatsApp, de lo leído de cada automatización.
  assert.match(proc, /for \(const \[id, c\] of configsCorrida\) if \(c\.goteoEmail && \(c\.goteoEmail\.minutos != null \|\| c\.goteoEmail\.dia != null\)\) goteosEmail\.set\(id, c\.goteoEmail\);/);
  assert.match(proc, /const frenoGoteoEmail = \(secId: number\) => frenoDeGoteo\(goteosEmail\.get\(secId\), usoGoteoEmail\.get\(secId\) \?\? SIN_USO, Date\.now\(\)\);/);
  // `sinLugar` elige el goteo por el canal: el de WhatsApp ya no frena al email, y al revés.
  assert.match(proc, /sinLugarEnLaLinea\(insc\.lead_id\) \|\| \(esEmail\(canal\) \? frenoGoteoEmail\(insc\.secuencia_id\) : frenoGoteo\(insc\.secuencia_id\)\)\.frena;/);
  assert.match(proc, /const esEmail = \(canal: string \| null \| undefined\): boolean => canal === 'email';/);
  // Los dos puntos donde un mensaje espera lugar pasan el canal del mensaje que le toca (el leído, o el destino del salto).
  assert.match(proc, /if \(sinLugar\(insc, pasoLeido\?\.canal\) && !\(pasoLeido && sec && sigueSinCupo\(sec\.pasos, idxLeido\)\)\) \{ await quedaFrenada\(insc, sec, pasoLeido\?\.canal\); continue; \}/);
  assert.match(proc, /if \(sinLugar\(insc, destino\.canal\) && !sigueSinCupo\(sec\.pasos, r\.idx\)\) \{ await quedaFrenada\(insc, sec, destino\.canal\); continue; \}/);
  assert.equal((proc.match(/sinLugar\(insc\)/g) ?? []).length, 0, 'quedó un `sinLugar` sin canal: frenaría al email con el goteo de WhatsApp');
  // `quedaFrenada`: con el goteo del email corre SU turno y cuenta SUS frenadas (no las del WhatsApp).
  const q = proc.slice(proc.indexOf('const quedaFrenada = async'), proc.indexOf('const soltarToque'));
  assert.match(q, /const email = esEmail\(canal\);/, 'quedaFrenada tiene que mirar el canal de la tarjeta');
  assert.match(q, /const g = \(email \? goteosEmail : goteos\)\.get\(insc\.secuencia_id\);/);
  assert.match(q, /const f = \(email \? frenoGoteoEmail : frenoGoteo\)\(insc\.secuencia_id\);/);
  assert.match(q, /const frenadas = email \? frenadasGoteoEmail : frenadasGoteo;/);
  assert.match(q, /if \(g && f\.frena && !sinLugarEnLaLinea\(insc\.lead_id\)\)/, 'sólo si lo frena el goteo, no la línea');
});

test('el motor: el uso del goteo del email cuenta los EMAILS (no los WhatsApp), de esas automatizaciones, en 24 h', () => {
  const i = motor.indexOf('async function usoDelGoteo(');
  const cuerpo = motor.slice(i, motor.indexOf('\n}\n', i));
  assert.match(cuerpo, /ids: readonly number\[\], canal: 'whatsapp' \| 'email' = 'whatsapp'\)/, 'sin canal, WhatsApp (lo de siempre)');
  assert.match(cuerpo, /\.in\('secuencia_id', \[\.\.\.ids\]\)\.eq\('canal', canal\)\.in\('estado', \[\.\.\.ESTADOS_DEL_GOTEO\]\)\.gte\('created_at', haceHorasISO\(24\)\)/);
  assert.match(proc, /const usoGoteoEmail = goteosEmail\.size \? await usoDelGoteo\(supabase, \[\.\.\.goteosEmail\.keys\(\)\], 'email'\) : new Map<number, UsoGoteo>\(\);/);
  // Lo que sale en la corrida: el WhatsApp suma al uso de WhatsApp (con el cupo) y el email al del email, cada uno en el suyo.
  assert.match(proc, /if \(paso\.canal === 'email' && cuentaParaElGoteo\(estado\) && goteosEmail\.has\(insc\.secuencia_id\)\) \{\s+usoGoteoEmail\.set\(insc\.secuencia_id, conEnvio\(usoGoteoEmail\.get\(insc\.secuencia_id\) \?\? SIN_USO, Date\.now\(\)\)\);\s+\}/);
  assert.match(proc, /if \(paso\.canal === 'whatsapp' && cuentaParaElCupo\(\{ carril: carril != null \}\)\) \{\s+if \(cuentaParaElGoteo\(estado\) && goteos\.has\(insc\.secuencia_id\)\) usoGoteo\.set\(/);
});

test('«Por qué no sale» ya no lee «Misma persona» ni la reunión cercana: `sinAntiBan` es sólo del carril', () => {
  const db = sinComentarios(leer('lib/por-que-no-sale-db.ts'));
  assert.match(db, /sinAntiBan: carril,/);
  assert.doesNotMatch(db, /reunionCerca|reunionFuturaMs|ultimoWa|personaHoras|HS_REUNION_CERCA/);
  assert.doesNotMatch(sinComentarios(leer('lib/por-que-no-sale.ts')), /mismaPersona|Misma persona|libreMp/);
});

// ── 4. La API de MaKo ────────────────────────────────────────────────────────────────────────────────

test('la API de MaKo ofrece el goteo del email y lo dice al leer; ya no ofrece «Misma persona»', () => {
  const def = sinComentarios(leer('lib/api-mako/areas/chatbot.def.ts'));
  assert.match(def, /\{ nombre: 'goteoEmailMinutos', tipo: 'number', entero: true, minimo: 1, maximo: 240,/);
  assert.match(def, /\{ nombre: 'goteoEmailPorDia', tipo: 'number', entero: true, minimo: 1, maximo: 500,/);
  assert.match(def, /\{ nombre: 'sinGoteoEmail', tipo: 'boolean',/);
  const run = sinComentarios(leer('lib/api-mako/areas/chatbot.run.ts'));
  assert.match(run, /if \(input\.sinGoteoEmail === true\) \{ cambio\.goteoEmail = null;/);
  assert.match(run, /if \(input\.goteoEmailMinutos != null\) \{ g\.minutos = num\(input, 'goteoEmailMinutos'\);/);
  assert.match(run, /if \(input\.goteoEmailPorDia != null\) \{ g\.dia = num\(input, 'goteoEmailPorDia'\);/);
  assert.match(run, /goteo_email: \{ vale: textoDeGoteo\(config\.goteoEmail\), minutos: config\.goteoEmail\?\.minutos \?\? null, por_dia: config\.goteoEmail\?\.dia \?\? null \},/);
  // La pantalla recibe el techo del email de la línea para sugerir el tope.
  const acciones = sinComentarios(leer('app/automations/config-automatizacion-actions.ts'));
  assert.match(acciones, /lineaEmailDia: limites\.email\.dia,/);
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

test('la pantalla tiene las CUATRO filas (Goteo y Tope por día, en WhatsApp y en Email) y pasa `debajo` sólo prendida', () => {
  const p = sinComentarios(leer('app/automations/ConfigAutomatizacionPanel.tsx'));
  const hook = tramo(p, 'export function useAntibanDeLaAutomatizacion(', '\n}\n');
  const llamadas = hook.match(/filaGoteo\('(goteo|goteoEmail)', '(minutos|dia)', '(Goteo|Tope por día)'/g) ?? [];
  assert.deepEqual(llamadas, [
    "filaGoteo('goteo', 'minutos', 'Goteo'", "filaGoteo('goteo', 'dia', 'Tope por día'",
    "filaGoteo('goteoEmail', 'minutos', 'Goteo'", "filaGoteo('goteoEmail', 'dia', 'Tope por día'",
  ]);
  // Cada bloque reparte las suyas: WhatsApp las de `goteo`, Email las de `goteoEmail`.
  assert.match(hook, /whatsapp: d \? \[\s*filaGoteo\('goteo', 'minutos'[\s\S]*?filaGoteo\('goteo', 'dia'[\s\S]*?\] : \[\],\s*[^\n]*\s*email: d \? \[\s*filaGoteo\('goteoEmail', 'minutos'[\s\S]*?filaGoteo\('goteoEmail', 'dia'[\s\S]*?\] : \[\],/);
  // El número va debajo y sólo prendida: «Uno cada [5] min», «Hasta [50] por día».
  const f = tramo(hook, 'const filaGoteo = ', '\n  };');
  assert.match(f, /debajo=\{on \? \(/);
  assert.match(f, /\) : undefined\} \/>/);
  assert.match(f, /'data-goteo-canal': parte === 'goteo' \? 'whatsapp' : 'email'/);
  assert.match(hook, /'Uno cada', 'min'/);
  assert.match(hook, /'Hasta', 'por día'/);
  // El interruptor sigue EN la fila (el nombre con su interruptor), no suelto al lado del número.
  assert.match(f, /interruptor=\{<Interruptor on=\{on\}/);
  // Y la pantalla los dibuja en su bloque: WhatsApp y Email.
  const aj = tramo(p, 'export function AjustesDeLaAutomatizacion(', '\n}\n');
  assert.match(aj, /\{auto\.whatsapp\}/);
  assert.match(aj, /\{auto\.email\}/);
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
