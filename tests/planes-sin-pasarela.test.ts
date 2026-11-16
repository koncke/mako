// =============================================================================
// Los planes de MaKo SIN PASARELA (23/10/2026): lo que no se puede cobrar no se muestra como si se pudiera
// =============================================================================
// Pedido del Cerebro para el lanzamiento del 25/10: la pasarela de MaKo todavía no está conectada, y cada pantalla de compra
// tiene que tener una salida de verdad mientras tanto. Desde el 24/10 esa salida NO es la agenda (Martín: «No voy a usar
// Calendly, te dije que pongas las columnas de pricing de las ofertas»): el botón lleva a la página del plan, y ahí, sin
// pasarela, la persona deja nombre, email y WhatsApp y queda como lead en el CRM de MaKo con el plan, el origen y el código
// de partner (lib/compra-plan.ts, `pedirPlanSinPasarela`). El Accelerator siempre se pide. La landing de venta muestra las
// columnas de precios donde estaba la agenda (app/vsl/PreciosLanding.tsx).
//
// Probado rompiéndolo (24/10/2026): al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bajadaDePlanes, botonDelPlan, diagnosticoEnTexto, diagnosticoLimpio, leerPedidoCompra, PREGUNTAS_DE_LA_PUERTA, whatsappLimpio } from '../lib/compra-plan-reglas';
import { PREGUNTAS } from '../lib/fase-diagnostico';
import { proPorLlamada } from '../lib/subir-plan-reglas';
import { sufijoDesdeUrl } from '../app/vsl/PreciosLanding';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/^[ \t]*\/?\*.*$/gm, '');

/** Una fila de «Tu plan» tal como quedó dibujada (`FilaAjustes`: con `href` sale un `<a>`; con `onClick`, un `<button>`). */
type FilaDibujada = { titulo: string; detalle: string; como: 'link' | 'boton' | 'quieta'; href: string | null };
type PantallaDelPlan = {
  enPrueba: { filas: FilaDibujada[]; enlaces: string[]; botones: number };
  /** Qué acción de servidor corrió al tocar la fila de Pro. */
  tocarPro: { existe: boolean; corrio: string[] };
};
let dibujo: PantallaDelPlan | null = null;
/**
 * «Tu plan» DIBUJADA, sin navegador y con sus bordes de mentira (tests/_plan-pedir-pro-hijo.ts). Una página no se puede
 * importar desde un test (`@/lib/compra-plan` trae `import 'server-only'`): el hijo la dibuja en un node aparte.
 */
const dibujarTuPlan = (): PantallaDelPlan => {
  if (!dibujo) {
    const out = execFileSync(process.execPath, [
      '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', join(RAIZ, 'tests/_plan-pedir-pro-hijo.ts'),
    ], { cwd: RAIZ, encoding: 'utf8', timeout: 180_000, maxBuffer: 8 * 1024 * 1024 });
    dibujo = JSON.parse(out.trim().split('\n').pop()!) as PantallaDelPlan;
  }
  return dibujo;
};

test('SIN AGENDA en los PLANES (24/10, Martín: «No voy a usar Calendly»), con la única excepción del Accelerator', () => {
  // Essential y Pro se compran sin hablar con nadie: su botón lleva al checkout o al pedido, nunca a una agenda.
  for (const rel of ['lib/compra-plan-reglas.ts', 'app/planes/Vitrina.tsx', 'app/planes/[plan]/page.tsx', 'app/configuraciones/plan/page.tsx', 'app/vsl/Landing.tsx', 'app/vsl/PreciosLanding.tsx']) {
    assert.doesNotMatch(fuente(rel), /calendly\.com|AGENDA_MAKO|agendaConOrigen|initInlineWidget/, rel);
  }
  // ⚠️ LA EXCEPCIÓN, Y UNA SOLA (14/11/2026). Martín: «lo de agendar llamadas sí debería estar todavía para el tema de
  // Accelerator. Ahí debería haber la agenda de llamada. Pero en ningún otro lado debería estar». El Accelerator es el bloque
  // que se vende POR llamada y nunca por la pasarela; las dos columnas de software, no.
  const tj = fuente('app/planes/Tarjetas.tsx');
  // 16/11/2026: el link de la agenda vive UNA vez, en lib/aplicacion-accelerator.ts (`AGENDA_DE_LA_LLAMADA`: la abre la
  // aplicación del Accelerator, ya contestada, a quien califica), y las tarjetas lo toman de ahí.
  const ap = fuente('lib/aplicacion-accelerator.ts');
  assert.equal((tj.match(/calendly\.com/g) ?? []).length, 0, 'las tarjetas escriben la agenda a mano: sale de lib/aplicacion-accelerator.ts');
  assert.equal((ap.match(/calendly\.com/g) ?? []).length, 1, 'la agenda aparece más de una vez en la aplicación');
  assert.doesNotMatch(tj, /AGENDA_MAKO|agendaConOrigen|initInlineWidget/, 'volvió el widget de Calendly de antes');
  assert.match(ap, /export const AGENDA_DE_LA_LLAMADA = 'https:\/\/calendly\.com\/koncke\/asesoria';/, 'la agenda es la de Martín');
  assert.match(tj, /export const AGENDA_ACELERADOR = AGENDA_DE_LA_LLAMADA;/, 'la agenda de las tarjetas no es la de la aplicación');
  // Y la usa SÓLO la tarjeta del programa: el botón de un plan sigue saliendo de `botonDelPlan`.
  // 15/11/2026, ~21:00: el botón de la columna dice «Más información» y lleva a la landing del programa (/accelerator); la
  // llamada se pide desde ahí. La agenda sigue siendo la de Martín (la constante), pero ningún botón de /planes la abre.
  // 16/11/2026: la columna es `TarjetaAccelerator` y el botón se lo pasa `TarjetasPlanes`.
  assert.match(tj, /<TarjetaAccelerator boton=\{\{ href: RUTA_ACCELERATOR, texto: TEXTO_BOTON_ACCELERATOR \}\} \/>/);
  assert.doesNotMatch(tj, /href=\{AGENDA_ACELERADOR\}/, 'un botón de /planes volvió a abrir la agenda');
  assert.doesNotMatch(tj.slice(tj.indexOf('{planes.map((p) => {'), tj.indexOf('mkpl-programa"')), /AGENDA_ACELERADOR/, 'un plan de software ofrece agendar');
});

// EL BOTÓN SIEMPRE DICE LO MISMO (15/11/2026). Martín, textual: «el botón no debería decir comienza tu prueba gratuita.
// Siempre es lo mismo. Pruébalo gratis ahora, todo en mayúscula». Había TRES textos para la misma acción conviviendo en
// /planes: «Comienza tu prueba gratuita» en la tarjeta, «Empezar» en la comparación y `TEXTO_CTA` en las landings.
// ⚠️ Y SE COMPARA CONTRA LA CONSTANTE, NO CONTRA EL TEXTO. Un test que repite la frase que vigila se pone rojo cada vez que
//    alguien la cambia a mano, apuntando al test en vez de al problema — la misma trampa que ya se pagó hoy con el piso del
//    clip suelto (docs/hallazgos-planes-y-cobro.md). Lo que importa es que sea UNA sola frase en toda la pantalla, y eso es
//    lo que se cruza abajo contra `TEXTO_CTA`.
test('el botón del plan: la MISMA frase que las landings; sin pasarela, «Quiero …» y se pide en la página del plan', async () => {
  const { TEXTO_BOTON_PRUEBA } = await import('../lib/compra-plan-reglas');
  const { TEXTO_CTA } = await import('../app/vsl/_competencia/cta');
  assert.equal(TEXTO_BOTON_PRUEBA, TEXTO_CTA,
    'el botón de /planes y el de las landings tienen que decir lo mismo: si no, la misma pantalla muestra dos CTA distintos');
  assert.equal(TEXTO_BOTON_PRUEBA, TEXTO_BOTON_PRUEBA.toUpperCase(), 'todo en mayúscula, como lo pidió Martín');
  assert.deepEqual(botonDelPlan({ id: 'pro', nombre: 'MaKo Pro', cobrable: true, sufijo: '?ref=ana' }), { href: '/planes/pro?ref=ana', texto: TEXTO_BOTON_PRUEBA });
  // Y el MISMO texto en los dos planes: el de US$47 ya no dice una cosa distinta del de US$97.
  assert.deepEqual(botonDelPlan({ id: 'esencial', nombre: 'MaKo Essential', cobrable: true, sufijo: '' }), { href: '/planes/essential', texto: TEXTO_BOTON_PRUEBA });
  // ⚠️ LA ÚNICA EXCEPCIÓN, y no es de estilo: sin pasarela no se puede prometer una prueba gratis que el cobro no da. Lo
  //    que hay es dejar los datos, y eso es otra acción.
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

test('la puerta del Accelerator: las preguntas del diagnóstico de fase, se guarda el texto, e incompleta no traba el pedido', () => {
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

test('«Pasar a Pro» por pedido: sólo desde Essential y sólo sin la subida en el acto', () => {
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
  // 15/11/2026: además le pasa la barra de MaKo Tokens, que va debajo del selector mensual / anual (`barra`).
  assert.match(fuente('app/planes/Vitrina.tsx'), /<TarjetasPlanes planes=\{planes\} sufijo=\{sufijo\} promoVigente=\{promoVigente\} barra=\{<CalculadoraTokens planes=\{planes\} \/>\} \/>/);
  // Con el país de quien mira (27/10/2026): Mercado Pago sólo en el suyo (tests/planes-stripe-afuera.test.ts).
  assert.match(pagina, /ofertasDeLosPlanes\(paisDelVisitante\(/);
  const lib = fuente('lib/compra-plan.ts');
  const ofertas = lib.slice(lib.indexOf('export async function ofertasDeLosPlanes'), lib.indexOf('export async function ofertasDeLosPlanes') + 700);
  assert.match(ofertas, /precioEn\(plan, m\.moneda\) != null/);
  assert.match(ofertas, /\.filter\(\(m\) => !m\.prueba\)/, 'una pasarela en modo prueba no es cobrable al público (igual que ofertaDelPlan)');
  assert.match(ofertas, /catch/, 'sin poder leer las pasarelas, ninguno es cobrable (no se rompe la página)');
});

test('/planes/<plan>: con pasarela el pago; sin pasarela el pedido; el Accelerator SIEMPRE el pedido', () => {
  const pagina = fuente('app/planes/[plan]/page.tsx');
  assert.match(pagina, /pasarelas\.length\s*\?\s*<CompraPlan[\s\S]*?:\s*\([\s\S]*?<QuieroPlan plan=\{plan\.id\}/);
  const programa = pagina.indexOf('if (id === PROGRAMA_ACELERADOR.id) {');
  assert.ok(programa > 0 && programa < pagina.indexOf('ofertaDelPlan('), 'el programa no pasa por la pasarela');
  assert.match(pagina, /<QuieroPlan plan=\{pr\.id\} nombrePlan=\{pr\.nombre\} origen=\{origen\} refCodigo=\{ref\} preguntas=\{PREGUNTAS_DE_LA_PUERTA\} \/>/,
    'el Accelerator se pide con el diagnóstico como puerta');
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

test('«Tu plan» ofrece Pro por PEDIDO: la fila no lleva a ningún checkout, y /mako-partners no nombra un plan que no existe', () => {
  const pagina = fuente('app/configuraciones/plan/page.tsx');
  assert.match(pagina, /proPorLlamada\(\{ capa, subidaEnLinea: subir != null \}\)/);
  // Salvo al cliente de una agencia (29/10/2026): su plan lo cambia su agencia (tests/cliente-de-agencia-y-partners-2910.test.ts).
  assert.match(pagina, /porLlamada=\{deAgencia \? null : porLlamada\}/);
  // ⚠️ ACÁ HABÍA DOS ASERCIONES DE TEXTO QUE CLAVABAN EL DESTINO VIEJO: que la página armara `href: `/planes/${pro.id}`` y que
  //    el panel lo dibujara con `href={porLlamada.href}`. La ronda 2 (14/11/2026) sacó los dos destinos —la fila ya no lleva a
  //    ninguna parte: deja el pedido escrito desde «Tu plan»— y este archivo quedó ROJO, 9/1. Clavar los destinos NUEVOS por
  //    texto habría sido la misma aserción vacía: probado el 15/11, un `doesNotMatch(/href|mailto:/)` sobre el armado de la
  //    fila da `true` TAMBIÉN con la fila de Pro otra vez ausente en la prueba, que es el defecto que la ronda 2 vino a cerrar.
  //    Así que lo que se mide es la PANTALLA DIBUJADA, con el mismo criterio de este archivo (sin pasarela, cada pantalla de
  //    compra tiene una salida de verdad): qué filas quedaron, a dónde se puede ir, y qué corre al tocarlas.
  const p = dibujarTuPlan();
  // 1. LO QUE QUEDA EN PANTALLA en la prueba, entero y en orden (un negocio en sus 7 días gratis del de 47). Si la fila de Pro
  //    desaparece, si cambia de lugar o si vuelve a ser un link, esta lista deja de coincidir.
  assert.deepEqual(p.enPrueba.filas.map((f) => [f.titulo, f.como]), [
    ['Pasar a MaKo Pro', 'boton'], ['Empezar mi plan ya', 'boton'], ['Recomienda MaKo', 'link'], ['Darme de baja', 'boton'],
  ], 'la pantalla «Tu plan» en la prueba');
  // 2. Y DICE QUE SE PIDE, no que se tiene en el acto: ése es el otro texto, el de la subida por la pasarela (`subir`).
  const pro = p.enPrueba.filas.find((f) => f.titulo === 'Pasar a MaKo Pro')!;
  assert.equal(pro.detalle, 'US$ 97 por mes. Pídelo y te lo cambiamos antes de que termine tu prueba.');
  assert.equal(pro.href, null, 'la fila de Pro volvió a llevar a algún lado');
  // 3. A DÓNDE SE PUEDE IR DESDE LA PANTALLA: a /partners y a ningún otro lado. Ni al checkout de /planes (el círculo del 409
  //    y, con la base caída, la segunda suscripción del #494), ni a un mailto, ni a una agenda.
  assert.deepEqual(p.enPrueba.enlaces, ['/partners'], 'apareció un destino nuevo en «Tu plan»');
  // 4. Y AL TOCARLA CORRE LA ACCIÓN QUE PIDE, NUNCA LA QUE COBRA (el handler es el del componente de verdad). `pasarAProAction`
  //    le cambia el precio a la suscripción de la pasarela: con la prueba abierta Stripe la rechaza (`trialing`), y Stripe y
  //    Creem cobrarían la diferencia en días que son gratis.
  assert.deepEqual(p.tocarPro, { existe: true, corrio: ['pedirProAction'] }, 'la fila que debe PEDIR terminó cobrando');
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
  // 14/11/2026: el botón del Accelerator pasó de su pedido (/planes/acelerador, que viajaba con el origen y el partner del
  // sufijo) a la agenda de Martín. ⚠️ CONSECUENCIA MEDIDA, no un detalle: por ese camino el origen y el código de partner ya
  // NO llegan al CRM, y la agenda de Martín todavía no tiene su webhook (docs/hallazgos-integraciones.md).
  // (16/11/2026: el botón se lo pasa `TarjetasPlanes` a la columna, `TarjetaAccelerator`.)
  assert.match(fuente('app/planes/Tarjetas.tsx'), /<TarjetaAccelerator boton=\{\{ href: RUTA_ACCELERATOR,/);
  assert.doesNotMatch(fuente('app/planes/Tarjetas.tsx'), /Quiero el Accelerator/, 'volvió el botón del pedido');
  // El anual (25/10/2026) se muestra y SIEMPRE se pide: su botón es otro, nunca el del checkout mensual.
  assert.match(fuente('app/planes/Tarjetas.tsx'), /href=\{botonAnualDelPlan\(\{ id: p\.id, sufijo \}\)\.href\}/);
  for (const rel of ['app/page.tsx', 'app/vsl/[slug]/page.tsx']) assert.match(fuente(rel), /planesParaLanding\(\)/, rel);
});

// Roturas (24/10/2026; base 9 / 0), cada una restaurada (pasan / fallan):
//   · `botonDelPlan` dice «Empezar» aunque no se cobre                                         -> 8 / 1
//   · el pedido sin pago acepta no tener WhatsApp                                              -> 8 / 1
//   · `whatsappLimpio` acepta 3 dígitos                                                        -> 8 / 1
//   · el Accelerator pasa por la pasarela (sin su rama)                                          -> 8 / 1
//   · la ruta manda el pedido al checkout (sin la rama de `quiero`)                             -> 8 / 1
//   · el pedido no deja el partner en el historial del lead                                    -> 8 / 1
//   · la landing deja el `data-calendly` del Web Generator (se carga Calendly)                 -> 8 / 1
//   · la landing de un funnel no dice de dónde vino                                            -> 8 / 1
//   · «Tu plan» vuelve a la agenda                                                             -> 7 / 2
//
// Roturas de la fila «Pasar a Pro» (15/11/2026, ronda 3; base 10 / 0 con este archivo solo). Cada una rompe el
// COMPORTAMIENTO dejando intacto el texto que el test miraba antes, que es lo que las aserciones viejas no veían:
//   · la fila de Pro otra vez AUSENTE en la prueba (`pro = … ? (enPrueba ? null : …)`, con el prefijo intacto) -> 9 / 1
//   · la fila vuelve a ser un link a /planes (`href="/planes/pro"` en vez del `onClick`)                       -> 9 / 1
//   · la fila que debe PEDIR pasa a COBRAR (`pedirPro` llamando `pasarAProAction()`, con su `onClick` intacto) -> 9 / 1
//
// Roturas de la columna del Accelerator como componente (16/11/2026; base 10 / 0), cada una restaurada (pasan / fallan):
//   · las tarjetas vuelven a escribir la agenda a mano (y no `AGENDA_DE_LA_LLAMADA`)                         -> 9 / 1
//   · `TarjetasPlanes` le pasa la agenda a la columna en vez de la landing                                     -> 8 / 2
// ⚠️ `TarjetaAccelerator` va DESPUÉS de `TarjetasPlanes` en el archivo a propósito: el `slice` de «un plan de software ofrece
//    agendar» corta de `{planes.map` a `mkpl-programa"`, y si la columna se definiera antes, el fin quedaría antes del principio,
//    el `slice` daría '' y la aserción pasaría sin mirar nada.
