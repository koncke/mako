// =============================================================================
// Offer en la pantalla de Create, con la oferta ARMÁNDOSE al costado (29/10/2026)
// =============================================================================
// Martín, 29/10/2026 (por el Cerebro): «También en offer pon el mismo sistema de la sidebar, en lugar del desplegable
// actual... Y que al ir respondiendo las preguntas que te va haciendo MaKo que tu "offer" se arme al costado. Y sin otras
// tabs, incluso en SuperAdmin». Esto fija:
//   1. el documento vivo: sólo lo que ya se sabe, por sección, sin «falta»; y cuál llegó última;
//   2. la tab monta PantallaCrear con ESTE chat y el documento en el centro, sin el desplegable ni el riel;
//   3. el onboarding (`arranque`) sigue con su pantalla: no monta PantallaCrear (es lo primero que ve un cliente);
//   4. Offer sin pestañas en nav.ts, con la key 'offer', y Strategy/Playbook al pie de la lista para el super admin.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { documentoDeOferta, piezaMasNueva } from '../app/offer/documento-vivo';
import { FAMILIAS, TODOS_LOS_ITEMS } from '../app/_components/nav';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

// Roturas (29/10/2026): `documentoDeOferta` sin saltear lo vacío → 1 fallo; `piezaMasNueva` quedándose con la más vieja → 1 fallo.
test('el documento vivo: sólo lo que ya se sabe, en el orden de las secciones, y la pieza que llegó última', () => {
  assert.deepEqual(documentoDeOferta({}), [], 'sin nada contestado, sin secciones (nada de «falta»)');
  const piezas = {
    precio: { valor: ' 900 USD ', fuente: 'chat' as const, at: '2026-10-29T10:00:00Z' },
    cliente: { valor: 'Coaches', fuente: 'negocio' as const, at: '2026-10-29T09:00:00Z' },
    problema: { valor: '   ', fuente: 'chat' as const, at: '2026-10-29T11:00:00Z' },
    bonos: { valor: 'Plantillas', fuente: 'doc' as const, at: '2026-10-29T10:30:00Z' },
  };
  const doc = documentoDeOferta(piezas);
  assert.deepEqual(doc.map((s) => s.titulo), ['Para quién', 'Precio', 'Cierre']);
  assert.deepEqual(doc.flatMap((s) => s.piezas.map((p) => [p.key, p.valor, p.estado])), [
    ['cliente', 'Coaches', 'negocio'], ['precio', '900 USD', 'confirmada'], ['bonos', 'Plantillas', 'confirmada'],
  ]);
  assert.equal(piezaMasNueva(piezas), 'bonos', 'la más nueva CON valor (el problema en blanco no cuenta)');
  assert.equal(piezaMasNueva({}), null);
});

// Roturas (29/10/2026): OfferApp con el <SelectorFunnel> de vuelta → 2 fallos (este y el archivo borrado); el centro con
// <RielPiezas> en vez del documento → 1 fallo; el arranque dentro de PantallaCrear → 1 fallo.
test('la tab: PantallaCrear con el chat de Offer y la oferta en el centro; el onboarding con su pantalla de siempre', () => {
  assert.ok(!existsSync(join(RAIZ, 'app/offer/SelectorFunnel.tsx')), 'el desplegable se fue: las ofertas son la lista de la tarjeta del chat');
  const app = sinComentarios(leer('app/offer/OfferApp.tsx'));
  assert.match(app, /from '@\/app\/_crear\/PantallaCrear'/);
  assert.doesNotMatch(app, /SelectorFunnel/);
  const crudo = leer('app/offer/OfferApp.tsx');
  const corte = crudo.indexOf('// ── EL ONBOARDING');
  assert.ok(corte > 0, 'el onboarding tiene su propio return, después del de la tab');
  const tab = crudo.slice(crudo.indexOf('if (!arranque) {'), corte);
  assert.match(tab, /<PantallaCrear[\s\S]*chat=\{chatDeLaTarjeta\}[\s\S]*<DocumentoVivo /, 'el chat a la izquierda y el documento en el centro');
  assert.doesNotMatch(tab, /<RielPiezas|<BarraPiezasMovil/, 'el riel de casillas no va en la tab');
  assert.match(tab, /<ChatOffer[\s\S]*enTarjeta/, 'el chat sin su marco propio (el marco es de la tarjeta)');
  assert.doesNotMatch(crudo.slice(corte), /<PantallaCrear/, 'el onboarding no monta PantallaCrear');
  assert.match(leer('app/offer/page.tsx'), /style=\{ESTILO_PAGINA_CREAR\}/);
});

test('nav: Offer es UN ítem con la key de su sección, sin pestañas, y Strategy/Playbook siguen vivas', () => {
  const marketing = FAMILIAS.flatMap((f) => f.bloques.flat());
  const offer = marketing.find((it) => it.label === 'Offer');
  assert.ok(offer);
  assert.equal(offer.key, 'offer', 'la key que miran las capas, la API y el teléfono');
  assert.equal(offer.secciones, undefined, '«sin otras tabs, incluso en SuperAdmin»');
  assert.ok(offer.match('/admin/estrategia') && offer.match('/admin/offer-playbook'), 'la barra las marca en Offer');
  assert.ok(TODOS_LOS_ITEMS.some((i) => i.key === 'offer'));
  const app = leer('app/offer/OfferApp.tsx');
  assert.match(app, /pieLista=\{superAdmin \?/);
  assert.match(app, /href="\/admin\/estrategia"/);
  assert.match(app, /href="\/admin\/offer-playbook"/);
});
