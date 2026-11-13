// =============================================================================
// Los planes de MaKo SIN PASARELA (23/10/2026): lo que no se puede cobrar no se muestra como si se pudiera
// =============================================================================
// Pedido del Cerebro para el lanzamiento del 25/10: la pasarela de MaKo todavía no está conectada, y cada pantalla de compra
// tiene que tener una salida de verdad mientras tanto. Desde el 24/10 esa salida NO es la agenda (Martín: «No voy a usar
// Calendly, te dije que pongas las columnas de pricing de las ofertas»): el botón lleva a la página del plan, y ahí, sin
// pasarela, la persona deja nombre, email y WhatsApp y queda como lead en el CRM de MaKo con el plan, el origen y el código
// de partner (lib/compra-plan.ts, `pedirPlanSinPasarela`). El Acelerador siempre se pide. La landing de venta muestra las
// columnas de precios donde estaba la agenda (app/vsl/PreciosLanding.tsx).
//
// Probado rompiéndolo (24/10/2026): al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bajadaDePlanes, botonDelPlan, diagnosticoEnTexto, diagnosticoLimpio, leerPedidoCompra, PREGUNTAS_DE_LA_PUERTA, whatsappLimpio } from '../lib/compra-plan-reglas';
import { PREGUNTAS } from '../lib/fase-diagnostico';
import { proPorLlamada } from '../lib/subir-plan-reglas';
import { sufijoDesdeUrl } from '../app/vsl/PreciosLanding';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/^[ \t]*\/?\*.*$/gm, '');

test('SIN AGENDA (24/10, Martín: «No voy a usar Calendly»): ningún botón ni página lleva a Calendly', () => {
  for (const rel of ['lib/compra-plan-reglas.ts', 'app/planes/Vitrina.tsx', 'app/planes/[plan]/page.tsx', 'app/configuraciones/plan/page.tsx', 'app/vsl/Landing.tsx', 'app/vsl/PreciosLanding.tsx', 'app/planes/Tarjetas.tsx']) {
    assert.doesNotMatch(fuente(rel), /calendly\.com|AGENDA_MAKO|agendaConOrigen|initInlineWidget/, rel);
  }
});

test('el botón del plan: «Empezar» sólo si se puede pagar; si no, «Quiero …» y se pide en la página del plan', () => {
  assert.deepEqual(botonDelPlan({ id: 'pro', nombre: 'MaKo Pro', cobrable: true, sufijo: '?ref=ana' }), { href: '/planes/pro?ref=ana', texto: 'Comienza tu prueba gratuita' });
  // El plan sin prueba sigue diciendo «Empezar» (la prueba es sólo de Pro: `planConPrueba`).
  assert.deepEqual(botonDelPlan({ id: 'esencial', nombre: 'MaKo Esencial', cobrable: true, sufijo: '' }), { href: '/planes/esencial', texto: 'Empezar con MaKo Esencial' });
  assert.deepEqual(botonDelPlan({ id: 'pro', nombre: 'MaKo Pro', cobrable: false, sufijo: '?ref=ana' }), { href: '/planes/pro?ref=ana', texto: 'Quiero MaKo Pro' },
    'el origen y el partner viajan en el sufijo a la página del plan');
});

test('el pedido sin pago: el WhatsApp es obligatorio, sólo dígitos, de 8 a 15', () => {
  assert.equal(whatsappLimpio('+54 9 11 1234-5678'), '5491112345678');
  assert.equal(whatsappLimpio('123'), null);
  assert.equal(whatsappLimpio('1'.repeat(16)), null);
  assert.equal(whatsappLimpio(undefined), null);
  const sinWa = leerPedidoCompra({ plan: 'pro', nombre: 'Ana', email: 'a@x.com', quiero: true });
  assert.equal(sinWa.ok, false, 'sin WhatsApp no hay cómo darle de alta');
  const ok = leerPedidoCompra({ plan: 'pro', nombre: 'Ana', email: 'a@x.com', quiero: true, whatsapp: '+52 55 1234 5678', ref: 'estudio-sol' });
  assert.ok(ok.ok && ok.pedido.quiero && ok.pedido.whatsapp === '525512345678' && ok.pedido.ref === 'estudio-sol');
});

test('la puerta del Acelerador: las preguntas del diagnóstico de fase, se guarda el texto, e incompleta no traba el pedido', () => {
  assert.deepEqual(PREGUNTAS_DE_LA_PUERTA.map((q) => q.id), ['facturacion', 'inversion', 'cuello']);
  for (const q of PREGUNTAS_DE_LA_PUERTA) assert.equal(q, PREGUNTAS.find((x) => x.id === q.id), `${q.id}: la del onboarding, no una copia`);
  const d = diagnosticoLimpio({ facturacion: 1, inversion: 0, cuello: 1 });
  assert.deepEqual(d?.map((x) => x.respuesta), PREGUNTAS_DE_LA_PUERTA.map((q, i) => q.opciones[[1, 0, 1][i]]), 'el texto de la opción, no el índice');
  assert.match(diagnosticoEnTexto(d!), /^Factura por mes: \$3\.000 – \$10\.000 · Invierte por mes en conseguir clientes: Nada o menos de \$600 · Su mayor traba: /);
  for (const malo of [{ facturacion: 1, inversion: 0 }, { facturacion: 9, inversion: 0, cuello: 1 }, { facturacion: '1', inversion: 0, cuello: 1 }, [1, 0, 1], null]) {
    assert.equal(diagnosticoLimpio(malo), null, JSON.stringify(malo));
  }
  const base = { plan: 'acelerador', nombre: 'Ana', email: 'a@x.com', quiero: true, whatsapp: '+54 9 11 1234 5678' };
  const con = leerPedidoCompra({ ...base, diagnostico: { facturacion: 1, inversion: 0, cuello: 1 } });
  assert.ok(con.ok && con.pedido.diagnostico?.length === 3);
  const sin = leerPedidoCompra({ ...base, diagnostico: { facturacion: 1 } });
  assert.ok(sin.ok && sin.pedido.diagnostico === null, 'un diagnóstico a medias no pierde el lead');
});

test('la bajada de /planes: «entras en el acto» sólo si algún plan se puede pagar en línea', () => {
  assert.match(bajadaDePlanes(true), /entras en el acto/);
  assert.doesNotMatch(bajadaDePlanes(false), /en el acto/);
  assert.match(bajadaDePlanes(false), /te damos de alta por WhatsApp/);
});

test('«Pasar a Pro» por pedido: sólo desde Esencial y sólo sin la subida en el acto', () => {
  assert.equal(proPorLlamada({ capa: 'completo', subidaEnLinea: false }), true);
  assert.equal(proPorLlamada({ capa: 'completo', subidaEnLinea: true }), false, 'con pasarela, la subida en el acto');
  assert.equal(proPorLlamada({ capa: 'agencia', subidaEnLinea: false }), false, 'Pro no sube a nada');
  assert.equal(proPorLlamada({ capa: null, subidaEnLinea: false }), false);
});

test('/planes arma el botón con la regla y decide por plan con la misma cuenta que el checkout', () => {
  const pagina = fuente('app/planes/page.tsx');
  // Los bloques de /planes y de la landing son UNA pieza (24/10, noche): el botón se arma ahí.
  const tarjetas = fuente('app/planes/Tarjetas.tsx');
  assert.match(tarjetas, /const boton = botonDelPlan\(\{ id: p\.id, nombre: p\.nombre, cobrable: p\.cobrable, sufijo \}\);/);
  assert.match(fuente('app/planes/Vitrina.tsx'), /<TarjetasPlanes planes=\{planes\} sufijo=\{sufijo\} promoVigente=\{promoVigente\} \/>/);
  // Con el país de quien mira (27/10/2026): Mercado Pago sólo en el suyo (tests/planes-stripe-afuera.test.ts).
  assert.match(pagina, /ofertasDeLosPlanes\(paisDelVisitante\(/);
  const lib = fuente('lib/compra-plan.ts');
  const ofertas = lib.slice(lib.indexOf('export async function ofertasDeLosPlanes'), lib.indexOf('export async function ofertasDeLosPlanes') + 700);
  assert.match(ofertas, /precioEn\(plan, m\.moneda\) != null/);
  assert.match(ofertas, /\.filter\(\(m\) => !m\.prueba\)/, 'una pasarela en modo prueba no es cobrable al público (igual que ofertaDelPlan)');
  assert.match(ofertas, /catch/, 'sin poder leer las pasarelas, ninguno es cobrable (no se rompe la página)');
});

test('/planes/<plan>: con pasarela el pago; sin pasarela el pedido; el Acelerador SIEMPRE el pedido', () => {
  const pagina = fuente('app/planes/[plan]/page.tsx');
  assert.match(pagina, /pasarelas\.length\s*\?\s*<CompraPlan[\s\S]*?:\s*\([\s\S]*?<QuieroPlan plan=\{plan\.id\}/);
  const programa = pagina.indexOf('if (id === PROGRAMA_ACELERADOR.id) {');
  assert.ok(programa > 0 && programa < pagina.indexOf('ofertaDelPlan('), 'el programa no pasa por la pasarela');
  assert.match(pagina, /<QuieroPlan plan=\{pr\.id\} nombrePlan=\{pr\.nombre\} origen=\{origen\} refCodigo=\{ref\} preguntas=\{PREGUNTAS_DE_LA_PUERTA\} \/>/,
    'el Acelerador se pide con el diagnóstico como puerta');
  const form = fuente('app/planes/[plan]/QuieroPlan.tsx');
  assert.match(form, /JSON\.stringify\(\{\s*plan: p\.plan, nombre, email, whatsapp, quiero: true, origen: p\.origen, ref: p\.refCodigo, web, diagnostico, periodo: p\.periodo,\s*codigo: preguntas\.length \? undefined : codigoParaMandar\(codigo, p\.refCodigo\),\s*\}\)/);
  // La ruta: el pedido va con el código de partner que ganó (la cookie de /r primero), y nunca abre un pago.
  const ruta = fuente('app/api/planes/comprar/route.ts');
  // Con el código que cuenta (sólo el de un partner, 28/10/2026: tests/partners-codigo-editable.test.ts).
  assert.match(ruta, /if \(pedido\.quiero\) \{\s*const q = await pedirPlanSinPasarela\(\{ \.\.\.pedido, ref: refQueCuenta \}\);/);
  assert.ok(ruta.indexOf('if (pedido.quiero)') < ruta.indexOf('iniciarCompraDePlan('), 'un pedido no llega al checkout');
  const lib = fuente('lib/compra-plan.ts');
  const pedir = lib.slice(lib.indexOf('export async function pedirPlanSinPasarela'));
  assert.match(pedir, /logLeadEvent\(lead\.leadId, 'Pedido de plan', `Quiere \$\{nombrePlan\}\$\{de\}\$\{ref\}\.\$\{wa\}\$\{diag\}`/,
    'el partner y el diagnóstico quedan en el historial del lead');
  assert.match(pedir, /avisarDePlataforma\(\{\s*to: EMAIL_MAKO,/, 'el equipo se entera en el momento');
});

test('«Tu plan» ofrece Pro por pedido, y /mako-partners no nombra un plan que no existe', () => {
  const pagina = fuente('app/configuraciones/plan/page.tsx');
  assert.match(pagina, /proPorLlamada\(\{ capa, subidaEnLinea: subir != null \}\)/);
  assert.match(pagina, /href: `\/planes\/\$\{pro\.id\}`/);
  // Salvo al cliente de una agencia (29/10/2026): su plan lo cambia su agencia (tests/cliente-de-agencia-y-partners-2910.test.ts).
  assert.match(pagina, /porLlamada=\{deAgencia \? null : porLlamada\}/);
  assert.match(fuente('app/configuraciones/plan/PlanPanel.tsx'), /porLlamada && <FilaAjustes[^>]*href=\{porLlamada\.href\}/);
  for (const rel of ['app/mako-partners/page.tsx', 'app/mako-partners/LandingPartners.tsx']) assert.doesNotMatch(fuente(rel), /Growth/, rel);
});

test('la LANDING de venta: las columnas de precios donde estaba la agenda, con el origen y el partner de la URL', () => {
  assert.equal(sufijoDesdeUrl('?utm_source=fb&ref=ana&x=1&fbclid=abc', null), '?utm_source=fb&fbclid=abc&ref=ana');
  assert.equal(sufijoDesdeUrl('', 'inmobiliarias'), '?landing=inmobiliarias', 'la landing de un funnel dice de dónde vino');
  assert.equal(sufijoDesdeUrl('?landing=otra', 'inmobiliarias'), '?landing=otra', 'la de la URL gana');
  const landing = fuente('app/vsl/Landing.tsx');
  assert.match(landing, /root\.querySelectorAll<HTMLElement>\('#cal-embed, \[data-calendly\]'\)/);
  assert.match(landing, /el\.removeAttribute\('data-calendly'\);/, 'la agenda del Web Generator no se carga');
  assert.match(landing, /\{destinoPrecios && createPortal\(<PreciosLanding planes=\{planes\} sufijo=\{sufijo\} \/>, destinoPrecios\)\}/);
  // El efecto que monta los precios va ANTES que el del diseño (que corre su script, el que cargaría Calendly).
  assert.ok(landing.indexOf('setDestinoPrecios(montarPrecios(root));') < landing.indexOf("sc.id = 'gm-diseno-js';"));
  const precios = fuente('app/vsl/PreciosLanding.tsx');
  assert.match(precios, /<TarjetasPlanes promoVigente=\{promoVigente\} planes=\{planes\} sufijo=\{sufijo\} \/>/, 'los mismos bloques (y el mismo botón) que /planes');
  assert.match(fuente('app/planes/Tarjetas.tsx'), /href=\{`\/planes\/\$\{pr\.id\}\$\{sufijo\}`\}>Quiero el Acelerador</);
  // El anual (25/10/2026) se muestra y SIEMPRE se pide: su botón es otro, nunca el del checkout mensual.
  assert.match(fuente('app/planes/Tarjetas.tsx'), /href=\{botonAnualDelPlan\(\{ id: p\.id, sufijo \}\)\.href\}/);
  for (const rel of ['app/page.tsx', 'app/vsl/[slug]/page.tsx']) assert.match(fuente(rel), /planesParaLanding\(\)/, rel);
});

// Roturas (24/10/2026; base 9 / 0), cada una restaurada (pasan / fallan):
//   · `botonDelPlan` dice «Empezar» aunque no se cobre                                         -> 8 / 1
//   · el pedido sin pago acepta no tener WhatsApp                                              -> 8 / 1
//   · `whatsappLimpio` acepta 3 dígitos                                                        -> 8 / 1
//   · el Acelerador pasa por la pasarela (sin su rama)                                          -> 8 / 1
//   · la ruta manda el pedido al checkout (sin la rama de `quiero`)                             -> 8 / 1
//   · el pedido no deja el partner en el historial del lead                                    -> 8 / 1
//   · la landing deja el `data-calendly` del Web Generator (se carga Calendly)                 -> 8 / 1
//   · la landing de un funnel no dice de dónde vino                                            -> 8 / 1
//   · «Tu plan» vuelve a la agenda                                                             -> 7 / 2
