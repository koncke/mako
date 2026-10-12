// =============================================================================
// tests/editor-landing-disenos.test.ts — el DISEÑO de una landing, separado del COPY
// =============================================================================
// Feedback de Martín (12/10/2026): «en las plantillas confundiste la plantilla de DISEÑO, con el
// COPY... En el panel principal, se tienen que ver plantillas del diseño, y al darle a una, puede
// salir un pop-up... que te pregunte de que quieres crearla», y «aproveches las herramientas que
// tenemos dentro de MaKo... embed de calendly, de cal, de stripe, de mercado pago, del VSL».
//
// Fija:
//   · cada diseño × cada objetivo arma una landing que el saneo del server acepta sin tirar nada;
//   · el diseño manda en la forma (tema y hero) y el objetivo en el copy;
//   · los bloques de MaKo entran donde el objetivo los usa (agenda, VSL, botón de pago);
//   · la caja de crear ofrece DISEÑOS para una landing y plantillas para una presentación, y el
//     alta de un diseño lleva el objetivo elegido.
//
// ── Roturas (12/10/2026, a mano y restaurado; base en verde: 7 pasan, 0 fallan) ──
//   · `conHerramientasMako` sin la rama del VSL ............................... 6 / 1
//   · `aplicarDiseno` sin poner el hero del diseño ............................. 6 / 1
//   · `plantillasDe('landing')` devuelve las plantillas de copy (PLANTILLAS) .. 5 / 2
//   · `pedidoDeDiseno` con el tema de la plantilla de copy en vez del diseño ... 6 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanearContenido } from '../lib/editor-landing/validar';
import { TEMAS } from '../lib/editor-landing/temas';
import { PLANTILLAS } from '../lib/editor-landing/plantillas';
import { NODO, type JsonNodo, type LandingContenido } from '../lib/editor-landing/doc';
import { DISENOS_LANDING, OBJETIVOS_LANDING, landingDesde } from '../lib/editor-landing/disenos-landing';
import { pedidoDeDiseno, plantillasDe } from '../app/landing-generator/crear/tipo';

const nodos = (c: LandingContenido): JsonNodo[] => {
  const out: JsonNodo[] = [];
  const ir = (n: JsonNodo) => { out.push(n); for (const h of n.content ?? []) ir(h); };
  for (const p of c.paginas) for (const t of p.doc.content) ir(t);
  return out;
};
const textoDe = (n: JsonNodo): string => (n.text ?? '') + (n.content ?? []).map(textoDe).join('');

test('cada diseño × cada objetivo arma una landing que el saneo acepta sin tirar nada', () => {
  assert.ok(DISENOS_LANDING.length >= 6, 'hay diseños');
  assert.equal(OBJETIVOS_LANDING.length, PLANTILLAS.length, 'un objetivo por plantilla de copy');
  for (const d of DISENOS_LANDING) {
    for (const o of OBJETIVOS_LANDING) {
      const c = landingDesde(d, o.id);
      assert.ok(c, `${d.id} × ${o.id}: no armó nada`);
      const saneo = sanearContenido(c);
      assert.deepEqual(saneo.descartes, [], `${d.id} × ${o.id}: el saneo tiró algo`);
    }
  }
});

test('el diseño manda en la forma: su tema existe y el hero toma el del diseño', () => {
  const ids = new Set(TEMAS.map((t) => t.id));
  for (const d of DISENOS_LANDING) {
    assert.ok(ids.has(d.tema), `${d.id}: el tema «${d.tema}» no existe`);
    const c = landingDesde(d, 'webinar')!;
    assert.equal(c.paginas[0].doc.content[0].attrs?.diseno, d.hero, `${d.id}: el hero no es el del diseño`);
  }
  assert.equal(landingDesde(DISENOS_LANDING[0], 'no-existe'), null, 'un objetivo que no existe no arma nada');
});

test('el objetivo manda en el copy: el mismo diseño con dos objetivos dice cosas distintas', () => {
  const d = DISENOS_LANDING[0];
  const a = textoDe(landingDesde(d, 'agenda-llamada')!.paginas[0].doc.content[0]);
  const b = textoDe(landingDesde(d, 'lead-magnet')!.paginas[0].doc.content[0]);
  assert.notEqual(a, b);
});

test('los bloques de MaKo entran donde el objetivo los usa', () => {
  const d = DISENOS_LANDING[0];
  const insertados = (o: string) => nodos(landingDesde(d, o)!).filter((n) => n.type === NODO.insertado);
  const botonPago = (o: string) => nodos(landingDesde(d, o)!).some((n) => n.type === NODO.boton && textoDe(n) === 'Pagar ahora');
  // Agenda (Calendly o Cal.com) en agendar una llamada y en la consultoría.
  assert.ok(insertados('agenda-llamada').some((n) => n.attrs?.proveedor === 'calendly'), 'agenda-llamada sin agenda');
  assert.ok(insertados('consultoria').some((n) => n.attrs?.proveedor === 'calendly'), 'consultoría sin agenda');
  // El VSL en el hero del webinar y de la venta directa.
  for (const o of ['webinar', 'venta-directa']) {
    const hero = landingDesde(d, o)!.paginas[0].doc.content[0];
    assert.ok((hero.content ?? []).some((n) => n.type === NODO.insertado && n.attrs?.proveedor === 'youtube'), `${o}: sin VSL en el hero`);
  }
  // El botón de pago (Stripe o Mercado Pago) en lo que se vende.
  for (const o of ['venta-directa', 'curso-programa', 'app-software']) assert.ok(botonPago(o), `${o}: sin botón de pago`);
  // Y nada de eso donde no va.
  assert.deepEqual(insertados('gracias'), [], 'la página de gracias no lleva agenda ni VSL');
  assert.equal(botonPago('lead-magnet'), false, 'un lead magnet no cobra');
});

test('la caja de crear ofrece DISEÑOS para una landing y plantillas para una presentación', () => {
  const landing = plantillasDe('landing');
  assert.deepEqual(landing.map((p) => p.id), DISENOS_LANDING.map((d) => d.id));
  assert.ok(landing.every((p) => p.pideObjetivo), 'un diseño pregunta el objetivo');
  const pres = plantillasDe('presentacion');
  assert.ok(pres.length > 0 && pres.every((p) => !p.pideObjetivo), 'una presentación se crea directo');
});

test('el alta de un diseño lleva el objetivo elegido, el tema del diseño y es una página', () => {
  const p = plantillasDe('landing')[1];
  const d = DISENOS_LANDING.find((x) => x.id === p.id)!;
  const alta = pedidoDeDiseno(p, 'webinar');
  assert.ok(alta);
  assert.equal(alta.config?.tema, d.tema);
  assert.equal(alta.config?.formato, 'pagina');
  assert.equal(alta.titulo, PLANTILLAS.find((x) => x.id === 'webinar')!.nombre);
  assert.deepEqual(alta.config?.origen, { modo: 'plantilla', plantilla: `${d.id}:webinar` });
  assert.equal(pedidoDeDiseno(p, 'no-existe'), null);
});

test('cada objetivo tiene su ícono y su nombre', () => {
  for (const o of OBJETIVOS_LANDING) {
    assert.ok(o.nombre.trim(), o.id);
    assert.ok(o.icono && o.icono !== 'objetivo', `${o.id}: sin ícono propio`);
  }
});
