// =============================================================================
// El barrido de «Agenda tu llamada» en la landing de respaldo (14/11/2026)
// =============================================================================
// Martín, 14/11/2026: «lo de agendar llamadas sí debería estar todavía para el tema de Accelerator… Pero en ningún otro lado
// debería estar». app/vsl/landing-html.ts es AUTO-GENERADO desde el diseño y trae 19 botones «Agenda tu llamada» que apuntan a
// `#beta`; no se editan a mano, se reescriben en runtime en el paso (5) de `aplicarContenidoLanding`.
//
// POR QUÉ ESTE ARCHIVO EXISTE, y es lo único que fija:
// El barrido arrancó pidiendo SÓLO el href (`a[href="#beta"]`) y eso era un rastrillo cargado. scripts/landing-principal-high-ticket.mts
// le pone a propósito `href: '#beta'` a TARJETAS de funcionalidad (grupos, automatizaciones, plan, chats, avatar: ícono + título +
// bajada). El `a.textContent = TEXTO_CTA` del barrido las vacía: medido con el selector viejo, la tarjeta pierde sus 3 hijos, el
// href pasa a `/planes` y queda un botón que dice «PRUÉBALO GRATIS AHORA». Hoy no estalla porque ese script parchea el documento
// YA publicado y el barrido sólo corre sobre LANDING_HTML (app/vsl/Landing.tsx:168 `if (!root || diseno) return`), pero el día que
// las dos cosas se cruzaran se perderían cinco tarjetas sin que nadie lo note.
// La cura es que el selector pida TAMBIÉN el texto del botón de la llamada. Este test mide las dos mitades: que los botones se
// barran, y que una tarjeta con el mismo href sobreviva entera.
//
// PROBADO ROMPIÉNDOLO (14/11/2026): sacando la línea `if (!ES_EL_BOTON_DE_LA_LLAMADA.test(...)) continue;` de
// app/vsl/landing-contenido.ts, el segundo test se pone rojo («la tarjeta quedó convertida en botón»); el primero sigue verde,
// que es justamente por qué el agujero no se veía.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { LANDING_HTML } from '../app/vsl/landing-html';
import { aplicarContenidoLanding } from '../app/vsl/landing-contenido';
import { TEXTO_CTA } from '../app/vsl/_competencia/cta';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as {
  JSDOM: new (html: string) => { window: Window & typeof globalThis };
};

// Una tarjeta igual a las que arma scripts/landing-principal-high-ticket.mts: el mismo href que los botones de la llamada.
const TARJETA = '<a href="#beta" class="mk-card-falsa"><span class="ic">◇</span><div class="t">De tus grupos al CRM</div>'
  + '<p class="b">Elige un grupo de WhatsApp y toca «Extraer»: los contactos caen a tu CRM.</p></a>';

/** Dibuja la landing de respaldo con una tarjeta pegada al final y le pasa el barrido las veces que se pida. */
function dibujar(pasadas = 1) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="raiz">${LANDING_HTML}${TARJETA}</div></body></html>`);
  const g = globalThis as unknown as Record<string, unknown>;
  const previo = { window: g.window, document: g.document, HTMLAnchorElement: g.HTMLAnchorElement, HTMLElement: g.HTMLElement, Node: g.Node };
  g.window = dom.window; g.document = dom.window.document;
  g.HTMLAnchorElement = dom.window.HTMLAnchorElement; g.HTMLElement = dom.window.HTMLElement; g.Node = dom.window.Node;
  try {
    const raiz = dom.window.document.getElementById('raiz') as unknown as HTMLElement;
    const betaAntes = dom.window.document.querySelectorAll('a[href="#beta"]').length;
    for (let i = 0; i < pasadas; i++) aplicarContenidoLanding(raiz);
    const tarjeta = dom.window.document.querySelector('.mk-card-falsa');
    // Sólo primitivos afuera: una aserción sobre un nodo de jsdom infla la comparación hasta los GB.
    return {
      betaAntes,
      betaDespues: dom.window.document.querySelectorAll('a[href="#beta"]').length,
      diceAgenda: (dom.window.document.body.textContent ?? '').match(/Agenda tu llamada/gi)?.length ?? 0,
      aPlanes: dom.window.document.querySelectorAll('a[href="/planes"]').length,
      tarjetaHref: tarjeta?.getAttribute('href') ?? null,
      tarjetaHijos: tarjeta?.children.length ?? -1,
      tarjetaTexto: (tarjeta?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    };
  } finally {
    g.window = previo.window; g.document = previo.document;
    g.HTMLAnchorElement = previo.HTMLAnchorElement; g.HTMLElement = previo.HTMLElement; g.Node = previo.Node;
  }
}

test('los botones de la llamada se barren: ninguno queda diciendo «Agenda tu llamada», y es idempotente', () => {
  const una = dibujar(1);
  assert.ok(una.betaAntes >= 19, `la landing de respaldo tiene que traer los botones de la llamada (trajo ${una.betaAntes})`);
  assert.equal(una.diceAgenda, 0, 'después del barrido no puede quedar ningún «Agenda tu llamada»');
  assert.ok(una.aPlanes >= 5, `los botones barridos tienen que apuntar a /planes (hay ${una.aPlanes})`);

  // Dos pasadas: el href deja de ser `#beta` en la primera, así que la segunda no encuentra nada que reescribir.
  const dos = dibujar(2);
  assert.equal(dos.diceAgenda, 0, 'la segunda pasada no puede resucitar el texto viejo');
  assert.equal(dos.aPlanes, una.aPlanes, 'la segunda pasada no puede agregar ni duplicar botones');
});

test('una TARJETA con el mismo href="#beta" sobrevive entera: el barrido mira el texto, no sólo el href', () => {
  const r = dibujar(2);
  assert.equal(r.tarjetaHref, '#beta', 'la tarjeta no es un botón de la llamada: su href no se toca');
  assert.equal(r.tarjetaHijos, 3, 'la tarjeta conserva su ícono, su título y su bajada');
  assert.match(r.tarjetaTexto, /De tus grupos al CRM/, 'la tarjeta conserva su título');
  assert.ok(!r.tarjetaTexto.includes(TEXTO_CTA), `la tarjeta quedó convertida en botón («${r.tarjetaTexto.slice(0, 60)}»)`);
  // Y la tarjeta sobrevive sin tapar lo otro: el barrido sigue dejando 0 «Agenda tu llamada».
  assert.equal(r.diceAgenda, 0);
});
