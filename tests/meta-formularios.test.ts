// =============================================================================
// Crear un formulario instantáneo: qué se valida y qué se le manda a Meta
// =============================================================================
// La forma del pedido copia la de los formularios que Meta devuelve para la página
// del dueño (2026-09-11). Crear escribe en la página del cliente y no se puede
// borrar por API, así que lo que se valida acá es lo que evita un intento fallido
// o un formulario a medias.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { erroresFormulario, paramsFormulario, sitioLimpio, urlValida, type FormularioNuevo } from '../lib/meta-formularios';

const BASE: FormularioNuevo = {
  nombre: 'Formulario MaKo 11/09',
  estandar: ['FULL_NAME', 'EMAIL', 'PHONE'],
  propias: ['¿Qué tipo de propiedad buscas vender?', '  '],
  mayorIntencion: true,
  privacidadUrl: 'https://v0-joandowd.vercel.app/privacidad',
  sitioUrl: 'https://v0-joandowd.vercel.app',
};

test('el pedido tiene la forma de los formularios que Meta ya devuelve', () => {
  const p = paramsFormulario(BASE);
  assert.equal(p.name, 'Formulario MaKo 11/09');
  assert.equal(p.locale, 'es_LA');
  assert.deepEqual(JSON.parse(p.questions), [
    { type: 'FULL_NAME' }, { type: 'EMAIL' }, { type: 'PHONE' },
    // La vacía se descarta: una pregunta sin texto es un rechazo de Meta.
    { type: 'CUSTOM', key: 'pregunta_1', label: '¿Qué tipo de propiedad buscas vender?' },
  ]);
  assert.deepEqual(JSON.parse(p.privacy_policy), { url: 'https://v0-joandowd.vercel.app/privacidad', link_text: 'Política de privacidad' });
  assert.equal(p.is_optimized_for_quality, 'true');
  assert.equal(p.follow_up_action_url, 'https://v0-joandowd.vercel.app');
  const gracias = JSON.parse(p.thank_you_page);
  assert.equal(gracias.button_type, 'VIEW_WEBSITE');
  assert.equal(gracias.website_url, 'https://v0-joandowd.vercel.app');
  // El orden de las estándar es el de Meta, no el del click.
  assert.deepEqual(JSON.parse(paramsFormulario({ ...BASE, estandar: ['PHONE', 'FULL_NAME'], propias: [] }).questions), [{ type: 'FULL_NAME' }, { type: 'PHONE' }]);
});

test('lo que falta se dice antes de mandar, en castellano', () => {
  assert.deepEqual(erroresFormulario(BASE), []);
  assert.match(erroresFormulario({ ...BASE, privacidadUrl: '' }).join(' '), /política de privacidad/);
  assert.match(erroresFormulario({ ...BASE, privacidadUrl: 'tupagina' }).join(' '), /política de privacidad/);
  assert.match(erroresFormulario({ ...BASE, sitioUrl: 'www' }).join(' '), /botón final/);
  assert.match(erroresFormulario({ ...BASE, nombre: '   ' }).join(' '), /nombre/);
  assert.match(erroresFormulario({ ...BASE, estandar: [], propias: ['  '] }).join(' '), /al menos una pregunta/);
  assert.match(erroresFormulario({ ...BASE, propias: ['a', 'b', 'c', 'd', 'e', 'f'] }).join(' '), /Hasta 5/);
});

test('urls: dirección real sí, texto suelto no; el sitio de la página sale sin tracking', () => {
  assert.equal(urlValida('https://x.com'), true);
  assert.equal(urlValida('ftp://x.com'), false);
  assert.equal(urlValida('https://localhost'), false);
  // El `website` real de la página de ws13, tal como lo devuelve Meta.
  assert.equal(
    sitioLimpio('https://joandowdcodigoinmobiliario.vercel.app/?utm_source=ig&utm_medium=social&fbclid=IwY2xj'),
    'https://joandowdcodigoinmobiliario.vercel.app/',
  );
  assert.equal(sitioLimpio('no es un sitio'), null);
});
