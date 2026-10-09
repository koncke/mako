// =============================================================================
// El remitente de Resend: «falta», no «opcional», y el que se escribe tiene que servir
// =============================================================================
// Punto 15 del audio de Customer Success (08/10/2026, Leandro probando el curso): con su key puesta
// los correos no salían, y lo que faltaba era el REMITENTE, que el formulario marcaba «opcional»
// mientras la tarjeta decía «Conectada». Sin remitente, con la key propia, los correos salen de
// onboarding@resend.dev y sólo le llegan al dueño de la cuenta. Medido el 09/10/2026: el ws4 tiene
// su key y ningún remitente.
//
// El remitente NO pasa a obligatorio: `opcional` lo leen los tres lectores de «conectado» y la tab
// /email se abre con la key sola (es donde se verifica el dominio). Por eso existe `sinEsto`.
//
// Y del punto 13 (el mismo audio), lo que se fija acá: el link a la página de keys va ARRIBA de la
// ayuda, la ayuda es un «Cómo configurarlo» con rótulo debajo del campo (no un «?» en la barra) y la
// nota gris de debajo del campo se mudó adentro de la ayuda.
//
// Probado ROMPIÉNDOLO (09/10/2026), un caso por vez y restaurado:
//   · sacar el `if (c.opcional && c.sinEsto)` del semáforo → 1 fallo
//   · sacar `sinEsto` del RESEND_FROM del catálogo → 1 fallo
//   · devolver la frase «El remitente es opcional» al tutorial → 1 fallo
//   · sacar la rama de email de lib/integraciones.ts → 1 fallo
//   · volver el link de la ayuda abajo de los pasos → 1 fallo
//   · devolver el `<IconBtn name="help"` a la barra del campo → 1 fallo
//   · aceptar cualquier dominio en `problemaDelRemitente` → 2 fallos
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { problemaDelRemitente } from '../lib/resend-remitente';

const leer = (rel: string) => readFileSync(resolve(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
// Las líneas de comentario primero y los bloques después (un `/*` adentro de un `//` abriría un
// bloque que se come el código del medio).
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const VERIFICADO = [{ name: 'tunegocio.com', status: 'verified' }];

test('un remitente vacío no es un problema del ping (eso lo dice el campo)', () => {
  assert.equal(problemaDelRemitente('', VERIFICADO), null);
  assert.equal(problemaDelRemitente(null, VERIFICADO), null);
  assert.equal(problemaDelRemitente(undefined, []), null);
});

test('un remitente de un dominio verificado de la cuenta sirve, con o sin nombre, y en un subdominio', () => {
  assert.equal(problemaDelRemitente('Tu negocio <hola@tunegocio.com>', VERIFICADO), null);
  assert.equal(problemaDelRemitente('hola@tunegocio.com', VERIFICADO), null);
  assert.equal(problemaDelRemitente('Tu negocio <Hola@TuNegocio.com>', VERIFICADO), null);
  assert.equal(problemaDelRemitente('Leandro <leandro0@contacto.tunegocio.com>', VERIFICADO), null, 'generoso: un subdominio del verificado no se frena');
  assert.equal(problemaDelRemitente('x@contacto.tunegocio.com', [{ name: 'contacto.tunegocio.com', status: 'verified' }]), null);
});

test('frena lo que se sabe roto, y lo dice', () => {
  assert.match(problemaDelRemitente('Tu negocio', VERIFICADO) ?? '', /no tiene un correo válido/);
  assert.match(problemaDelRemitente('Tu negocio <hola@tunegocio>', VERIFICADO) ?? '', /no tiene un correo válido/);
  assert.match(problemaDelRemitente('onboarding@resend.dev', VERIFICADO) ?? '', /prueba de Resend/);
  assert.match(problemaDelRemitente('hola@otrodominio.com', VERIFICADO) ?? '', /otrodominio\.com no está en tu cuenta/);
  assert.match(problemaDelRemitente('hola@tunegocio.com', []) ?? '', /no está en tu cuenta/, 'cuenta sin dominios');
  assert.match(problemaDelRemitente('hola@tunegocio.com', [{ name: 'tunegocio.com', status: 'pending' }]) ?? '', /todavía no está verificado/);
  assert.match(problemaDelRemitente('hola@tunegocio.com', [{ name: 'tunegocio.com', status: 'not_started' }]) ?? '', /todavía no está verificado/);
  assert.match(problemaDelRemitente('hola@tunegocio.com', [{ name: 'tunegocio.com', status: 'failed' }]) ?? '', /todavía no está verificado/);
});

test('un dominio que se parece no es el dominio', () => {
  // `endsWith(n)` sin el punto aceptaría «miTUNEGOCIO.com» por «tunegocio.com».
  assert.ok(problemaDelRemitente('hola@mitunegocio.com', VERIFICADO), 'mitunegocio.com no es tunegocio.com');
});

test('un estado que Resend no declara roto deja pasar (generoso)', () => {
  assert.equal(problemaDelRemitente('hola@tunegocio.com', [{ name: 'tunegocio.com', status: 'temporary_failure' }]), null);
  assert.equal(problemaDelRemitente('hola@tunegocio.com', [{ name: 'tunegocio.com', status: 'partially_verified' }]), null);
});

test('el ping de Email juzga el remitente contra la cuenta de esa key', () => {
  const src = sinComentarios(leer('lib/metodo-verificar.ts'));
  const i = src.indexOf('async email(v)');
  assert.ok(i > 0, 'no encontré el ping de email');
  const ping = src.slice(i, src.indexOf('async anthropic(', i));
  assert.match(ping, /problemaDelRemitente\(v\.RESEND_FROM, dominios\)/);
  assert.match(ping, /if \(problema\) return \{ ok: false, error: problema \}/);
});

test('el remitente sigue opcional para «conectado», pero declara qué falta sin él', () => {
  const cat = leer('lib/metodo-catalogo.ts');
  const linea = cat.split('\n').find((l) => /env: 'RESEND_FROM'/.test(l)) ?? '';
  assert.match(linea, /opcional: true/, 'opcional lo leen los tres lectores de «conectado» y la puerta de /email');
  assert.match(linea, /sinEsto: '[^']+'/, 'sin `sinEsto` el campo vuelve a decir «opcional»');
  assert.doesNotMatch(sinComentarios(cat), /El remitente es opcional/, 'la frase que mentía volvió al tutorial');
});

test('la ruta le baja `sinEsto` al formulario', () => {
  const ruta = sinComentarios(leer('app/api/integraciones/credencial/route.ts'));
  assert.match(ruta, /sinEsto: c\.sinEsto \?\? null/);
});

test('el semáforo pinta «falta» ANTES de llegar a «opcional»', () => {
  const form = sinComentarios(leer('app/integraciones/ServicioConfigForm.tsx'));
  const i = form.indexOf('function semaforo(');
  const cuerpo = form.slice(i, form.indexOf('\n}\n', i));
  const falta = cuerpo.indexOf("if (c.opcional && c.sinEsto) return { color: 'var(--warn-fill)', texto: 'falta'");
  const opcional = cuerpo.indexOf("texto: 'opcional'");
  assert.ok(falta > 0, 'falta la rama de `sinEsto` en el semáforo');
  assert.ok(opcional > falta, 'la rama de `sinEsto` tiene que ir antes que la de «opcional»');
});

test('la tarjeta de Email no dice «Conectada» con el remitente en el sandbox', () => {
  const integ = sinComentarios(leer('lib/integraciones.ts'));
  assert.match(integ, /d\.key === 'email' && !faltan\.length && await remitenteEsSandbox\(\)/);
  assert.match(integ, /estado: 'falta' as EstadoIntegracion,\s*detalle: 'Falta el remitente/);
});

test('punto 13: el link de la ayuda va ARRIBA de los pasos, y la nota vive adentro', () => {
  const form = sinComentarios(leer('app/integraciones/ServicioConfigForm.tsx'));
  const i = form.indexOf('function PasosAyuda(');
  const cuerpo = form.slice(i, form.indexOf('\n}\n', i));
  const link = cuerpo.indexOf('<a href={ayuda.url}');
  const pasos = cuerpo.indexOf('<ol');
  assert.ok(link > 0 && pasos > 0 && link < pasos, 'el link a la página de keys tiene que ir antes de los pasos');
  assert.match(cuerpo, /\{nota && </, 'la nota del catálogo se muda adentro de la ayuda');
});

test('punto 13: la ayuda es «Cómo configurarlo» debajo del campo, sin «?» en la barra ni nota gris', () => {
  const form = sinComentarios(leer('app/integraciones/ServicioConfigForm.tsx'));
  assert.doesNotMatch(form, /<IconBtn name="help"/, 'el «?» de la barra pasaba desapercibido');
  assert.match(form, /'Ocultar' : 'Cómo configurarlo'/);
  assert.match(form, /<PasosAyuda ayuda=\{ayuda\} nota=\{c\.nota\} \/>/);
  // La nota gris de debajo del campo: `{c.nota}` suelto en un div, fuera de la ayuda.
  assert.doesNotMatch(form, /\}>\{c\.nota\}<\/div>/, 'la nota gris volvió a dibujarse debajo del campo');
});
