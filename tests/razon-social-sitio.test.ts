// La razón social de MaKo tiene que estar en el HTML que SIRVE el server de hola-mako.com.
//
// El 08/10/2026 Meta rechazó la verificación del negocio del portafolio MaKo con «la razón
// social de la empresa debe aparecer en el sitio web». El verificador de un tercero puede no
// ejecutar JavaScript, así que lo que se agrega en el `useEffect` de la landing para él no
// existe: por eso estos tests RENDERIZAN en el server (renderToStaticMarkup no corre efectos)
// en vez de buscar el texto en el fuente.
//
// Verificado rompiéndolo: sacar el <span> del pie de la landing → 1 fallo (el primero);
// volver RESPONSABLE a 'MaKo' en /privacidad → 1 fallo; lo mismo en /terminos → 1 fallo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Landing from '../app/vsl/Landing';
import Privacidad from '../app/privacidad/page';
import Terminos from '../app/terminos/page';
import { RAZON_SOCIAL_MAKO } from '../lib/titular-mako';

test('la landing trae la razón social en el HTML del server, sin ejecutar sus efectos', () => {
  const html = renderToStaticMarkup(createElement(Landing));
  assert.ok(html.includes(`Razón social: ${RAZON_SOCIAL_MAKO}`), 'el pie de la landing no trae la razón social');
});

test('/privacidad nombra a la razón social como responsable del tratamiento', () => {
  const html = renderToStaticMarkup(createElement(Privacidad));
  assert.match(html, new RegExp(`Responsable del tratamiento: <strong>${RAZON_SOCIAL_MAKO} \\(MaKo\\)</strong>`));
});

test('/terminos nombra a la razón social como responsable del servicio', () => {
  const html = renderToStaticMarkup(createElement(Terminos));
  assert.match(html, new RegExp(`Responsable del servicio: <strong>${RAZON_SOCIAL_MAKO} \\(MaKo\\)</strong>`));
});

test('la razón social se escribe como en la verificación de Meta: apellido primero', () => {
  // Si alguien la «prolija» a «Leandro Martín Tejado Gonzalvez», a una persona le dice lo mismo
  // y al chequeo de Meta puede no: este test obliga a que el cambio sea a propósito.
  assert.equal(RAZON_SOCIAL_MAKO, 'Tejado Gonzalvez Leandro Martin');
});
