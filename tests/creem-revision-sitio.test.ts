// =============================================================================
// Lo que el revisor de una pasarela mira en hola-mako.com, sin cuenta (5/11/2026)
// =============================================================================
// Nació para la revisión de Creem: una pasarela aprueba la tienda mirando el sitio (términos, privacidad, precios,
// reembolsos, soporte y el correo de contacto visibles y coincidentes, y —a quien genera imagen o video con IA— una
// política de uso aceptable PÚBLICA: docs/relevo/nube-creem-revision.md). Creem RECHAZÓ la tienda de MaKo el mismo 5/11,
// de forma definitiva (docs/creem-retiros.md): lo que pide el revisor de la próxima pasarela y de las tiendas es lo mismo,
// así que el archivo se queda, y desde ese día fija además que ninguna legal nombre a Creem. Se fija, RENDERIZANDO:
//   1. /aup y las demás son públicas, sólo se leen y el desvío del teléfono no las tapa;
//   2. el correo y el responsable son LOS MISMOS en todas (lib/app-url.ts, lib/titular-mako.ts): que no coincidan es uno
//      de los motivos de rechazo más comunes, según Creem;
//   3. /aup dice lo que MaKo hace de verdad: imagen y video, AI Avatar con caras ajenas, mensajes a contactos, la
//      moderación antes de generar y cómo denunciar;
//   4. el pie de la landing (con y sin JavaScript) enlaza todo, y el pie compartido de las legales NO enlaza a comprar
//      (también se abren en la app de iPhone: lib/tienda.ts);
//   5. ninguna legal nombra a Creem (ni como quien cobra, ni como vendedor, ni como quien modera), y ninguna afirma una
//      revisión automática de los pedidos: la moderación quedó sin proveedor (lib/creem-moderacion-reglas.ts).
//
// PROBADO ROMPIÉNDOLO (5/11/2026), con el archivo en verde (6 / 0), una rotura por vez y restaurada (pasan / fallan):
//   · '/aup' fuera de PUBLICOS                                   → 4 / 2
//   · '/planes' en el pie compartido de las legales              → 5 / 1
//   · el correo de /soporte escrito a mano con otra dirección    → 5 / 1
//   · sin el link a /aup en el pie de la landing                 → 5 / 1
// Y el 5/11/2026, con el rechazo de Creem (pasan / fallan):
//   · /reembolsos vuelve a decir «(Creem, Stripe o Mercado Pago)»                → 6 / 1
//   · /aup vuelve a decir «El texto … pasa por el servicio de moderación de Creem» → 5 / 2
//   · /terminos vuelve a decir «el pedido se revisa solo»                        → 6 / 1
//   · /privacidad vuelve a decir «Creem, Stripe y Mercado Pago, para cobrar tu plan» → 6 / 1
// Correr: node --import tsx --test tests/creem-revision-sitio.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Aup from '../app/aup/page';
import Terminos from '../app/terminos/page';
import Privacidad from '../app/privacidad/page';
import Reembolsos from '../app/reembolsos/page';
import Soporte from '../app/soporte/page';
import EliminarCuenta from '../app/eliminar-cuenta/page';
import Landing from '../app/vsl/Landing';
import { PortadaSinJs } from '../app/vsl/PortadaSinJs';
import { PAGINAS_LEGALES } from '../app/_legal/LegalShell';
import { esPublica, esPublicaSoloLeer } from '../lib/rutas-publicas';
import { decidirDesvio } from '../lib/movil-desvio';
import { esRutaDeVenta } from '../lib/tienda';
import { EMAIL_MAKO } from '../lib/app-url';
import { RAZON_SOCIAL_MAKO } from '../lib/titular-mako';

const html = (el: ReactElement) => renderToStaticMarkup(el);
/** El texto que se lee, sin etiquetas (para buscar frases que cruzan un <strong>). */
const texto = (h: string) => h.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');
const correos = (h: string) => [...new Set([...h.matchAll(/[\w.+-]+@[\w-]+\.[\w.-]+/g)].map((m) => m[0].toLowerCase()))];

const LEGALES: Array<[string, () => ReactElement]> = [
  ['/aup', () => createElement(Aup)],
  ['/terminos', () => createElement(Terminos)],
  ['/privacidad', () => createElement(Privacidad)],
  ['/reembolsos', () => createElement(Reembolsos)],
  ['/soporte', () => createElement(Soporte)],
  ['/eliminar-cuenta', () => createElement(EliminarCuenta)],
];

test('1. las páginas que mira el revisor son públicas, sólo se leen, y el teléfono no las tapa', () => {
  for (const [ruta] of [...LEGALES, ['/planes']] as const) {
    assert.equal(esPublica(ruta), true, `${ruta}: sin cuenta se tiene que poder abrir (antes /aup mandaba a /login)`);
    assert.equal(esPublicaSoloLeer(ruta), true, ruta);
    assert.equal(decidirDesvio(ruta).tipo, 'nada', `${ruta}: el desvío del teléfono no la tapa`);
  }
});

test('2. el correo de contacto y el responsable son los mismos en todas', () => {
  for (const [ruta, pagina] of LEGALES) {
    const h = html(pagina());
    const t = texto(h);
    assert.deepEqual(correos(h).filter((c) => c.endsWith('hola-mako.com')), [EMAIL_MAKO], `${ruta}: un solo correo de MaKo, el de EMAIL_MAKO`);
    assert.ok(t.includes(`Razón social: ${RAZON_SOCIAL_MAKO}`), `${ruta}: la razón social, igual que en la verificación de Meta`);
  }
});

test('2b. lo que pide una pasarela EN LOS TÉRMINOS (lo pidió Creem), no sólo en /aup, y /privacidad dice que la página pública graba', () => {
  // ai-wrapper-compliance: «Terms of Service that explicitly prohibit NSFW, explicit, or sexually suggestive content generation»
  // y «independent wrapper or interface built on top of third-party AI models». Leído el 5/11/2026.
  const terminos = texto(html(createElement(Terminos)));
  assert.match(terminos, /prohibido generar contenido sexual, explícito o sexualmente sugerente \(NSFW\)/);
  assert.match(terminos, /MaKo es un producto independiente/);
  assert.match(texto(html(createElement(Aup))), /producto independiente/);
  // «Ni grabadores de sesión» es verdad DENTRO de la app; replay_sesiones graba las landings, también hola-mako.com.
  const privacidad = texto(html(createElement(Privacidad)));
  assert.match(privacidad, /página pública también graba las visitas/);
  assert.match(privacidad, /El píxel también graba las visitas/);
});

test('3. /aup dice lo que MaKo hace: imagen y video, caras ajenas, mensajes, la moderación y cómo denunciar', () => {
  const t = texto(html(createElement(Aup)));
  for (const [que, re] of [
    ['qué genera', /Video Generator y AI Avatar/],
    ['sin contenido sexual ni menores', /Contenido sexual o desnudos[\s\S]*menores de edad/],
    ['caras ajenas (lo que Creem llama manipulación de rostros)', /cara, el cuerpo o la voz de otra persona sin su permiso/],
    ['AI Avatar sólo con la foto propia o con permiso por escrito', /tiene que ser tuya[\s\S]*permiso por escrito/],
    ['mayores de 18', /mayor de 18 años/],
    ['spam a los contactos', /Spam\./],
    ['que el servicio que genera tiene sus propios filtros', /Google Flow, con tu cuenta, puede rechazar un pedido/],
    ['cómo denunciar', /Cómo denunciar un abuso/],
  ] as const) assert.match(t, re, `/aup no dice ${que}`);
});

test('4. el pie de la landing enlaza todo, con y sin JavaScript; el pie de las legales no enlaza a comprar', () => {
  for (const [donde, h] of [['la landing', html(createElement(Landing, {}))], ['la portada sin JavaScript', html(createElement(PortadaSinJs))]] as const) {
    for (const href of ['/terminos', '/privacidad', '/reembolsos', '/aup', '/planes', '/soporte']) {
      assert.ok(h.includes(`href="${href}"`), `${donde}: falta el link a ${href}`);
    }
    assert.ok(h.includes(`mailto:${EMAIL_MAKO}`), `${donde}: falta el correo`);
  }
  // Las legales se abren también en la app de iPhone, que no deja mandar a pagar afuera.
  for (const p of PAGINAS_LEGALES) assert.equal(esRutaDeVenta(p.href), false, `${p.href} en el pie de las legales: adentro de la app de iPhone no se enlaza a comprar`);
  assert.ok(PAGINAS_LEGALES.some((p) => p.href === '/aup'), 'el pie de las legales enlaza /aup');
  const terminos = html(createElement(Terminos));
  assert.ok(terminos.includes('href="/aup"'), 'los términos enlazan la política de uso aceptable');
});

test('5. ninguna legal nombra a Creem, y ninguna afirma una revisión automática que no corre (Creem cerró la tienda el 5/11/2026)', () => {
  for (const [ruta, pagina] of LEGALES) {
    const t = texto(html(pagina()));
    // Lo que se LEE: los comentarios de JSX que cuentan la historia no se dibujan.
    assert.doesNotMatch(t, /creem/i, `${ruta}: Creem rechazó la tienda de MaKo y no cobra, no vende ni modera nada`);
    assert.doesNotMatch(t, /se revisa solo|revisión automática|merchant of record|vendedor registrado/i, `${ruta}: afirma algo que ya no pasa`);
  }
  assert.match(texto(html(createElement(Terminos))), /Los pagos se procesan con Stripe o Mercado Pago/);
  assert.match(texto(html(createElement(Privacidad))), /Stripe y Mercado Pago, para cobrar tu plan/);
  assert.match(texto(html(createElement(Reembolsos))), /\(Stripe o Mercado Pago\)/);
});

test('6. el rechazo de la moderación nombra la misma dirección que sirve /aup', async () => {
  const { TEXTO_RECHAZO } = await import('../lib/creem-moderacion-reglas');
  assert.match(TEXTO_RECHAZO, /hola-mako\.com\/aup/);
  assert.equal(esPublica('/aup'), true);
});
