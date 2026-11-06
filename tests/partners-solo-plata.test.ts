// =============================================================================
// MaKo Partners paga SÓLO PLATA, y lo que vino con eso (25/10/2026)
// =============================================================================
// Martín (25/10, ~15:40): «que solo ganen direro y listo... literalmente se llevan el 100% de lo que venden... es importante
// que en la compra, en el carrito, esté la opción de poner código de referido... copia el dashboard de otras apps que usen
// referidos, tanto para superadmin como para los clientes». Y: «Todo, todo siempre tiene que ir a la API». Lo que se cuida:
//   · lo que se gana es el 100% del primer mes A PRECIO DE LISTA POR MES (un anual cobra el año: no se gana el año);
//   · el alta (lo que contestó) se valida y se guarda limpia; el link cuenta visitas sin robots y sólo la primera vez;
//   · el código del carrito: escrito gana sobre la cookie y el `?ref=`; uno que no es de nadie se dice; el Acelerador no lo lleva;
//   · el panel del partner (Tolt) y el del super admin (FirstPromoter): sus números, y «Marcar pagado» sólo del super admin y
//     nunca más de lo que se debe;
//   · la API: las cinco operaciones, con sus puertas.
//
// Probado rompiéndolo (25/10/2026): al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CLAVE_ALTA_PARTNERS, altaLimpia, cobroLimpio, esRobot, ganadoPorMes, gananciaDelReferido, leerAlta, leerVisitas, porGanar, precioDeListaPorMes,
  sumarVisita, ultimosMeses,
} from '../lib/partners-reglas';
import { TEXTO_CODIGO_NO_EXISTE, codigoDeLaCompra, leerPedidoCompra } from '../lib/compra-plan-reglas';
import { codigoParaMandar } from '../app/planes/[plan]/CodigoReferido';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const lista = (p: string) => ({ pro: 97, esencial: 47 } as Record<string, number>)[p] ?? null;

test('lo que se gana: el 100% del primer mes a precio de LISTA por mes (el anual no deja el año)', () => {
  assert.equal(gananciaDelReferido(97), 97);
  assert.equal(precioDeListaPorMes({ plan_mako: 'pro', monto_usd: 970, meses: 12 }, lista), 97, 'un anual de Pro deja el mes de Pro');
  assert.equal(precioDeListaPorMes({ plan_mako: 'esencial', monto_usd: 47, meses: 1 }, lista), 47);
  assert.equal(precioDeListaPorMes({ plan_mako: null, monto_usd: 600, meses: 12 }, lista), 50, 'sin plan conocido, lo cobrado por mes');
  assert.equal(precioDeListaPorMes({ plan_mako: 'raro', monto_usd: 97 }, lista), 97);
  assert.equal(precioDeListaPorMes({ plan_mako: null, monto_usd: null }, lista), null, 'no se sabe: no se inventa');
  assert.equal(porGanar([{ estado: 'registrado', gananciaUsd: 97 }, { estado: 'primer-pago', gananciaUsd: 47 }, { estado: 'acreditado', gananciaUsd: 97 }, { estado: 'se-fue', gananciaUsd: 47 }]), 144, 'en camino: los que siguen');
  const p = fuente('lib/partners-programa.ts');
  // 29/10/2026: con la compra sin plan anotado (la venta a mano), la lista de la capa vendida (`conPlanDeLista`,
  // tests/revision-plata-agency-2910.test.ts).
  assert.match(p, /primero\.set\(Number\(c\.alta_ws\), \{ codigo: c\.ref_codigo, precio: precioDeListaPorMes\(conPlanDeLista\(c\), listaDe\) \}\)/, 'el cron usa el precio de lista');
  assert.match(p, /const monto = gananciaDelReferido\(precio\);/);
});

test('lo ganado por mes: los últimos 6, del más viejo al de hoy, sólo lo ganado (no lo pagado)', () => {
  assert.deepEqual(ultimosMeses('2026-02', 3), ['2025-12', '2026-01', '2026-02']);
  const m = ganadoPorMes([
    { tipo: 'referido', monto_usd: 97, created_at: '2026-10-03T10:00:00Z' }, { tipo: 'referido', monto_usd: 47, created_at: '2026-10-20T10:00:00Z' },
    { tipo: 'uso', monto_usd: -97, created_at: '2026-10-21T10:00:00Z' }, { tipo: 'referido', monto_usd: 97, created_at: '2026-01-02T10:00:00Z' },
  ], '2026-10');
  assert.equal(m.length, 6);
  assert.deepEqual(m.at(-1), { mes: '2026-10', usd: 144 });
  assert.equal(m.reduce((a, x) => a + x.usd, 0), 144, 'lo de enero quedó fuera de los 6 meses');
});

test('el ALTA se guarda limpia: respuestas del catálogo, dónde cobra con tope, y la fecha del primer alta', () => {
  const a = altaLimpia({ cuantos: '3-5', como: ['clientes', 'anuncios', 'clientes', 'hackeo'], cobro: '  mi.alias.mp  ' }, '2026-10-25T12:00:00Z');
  assert.deepEqual(a, { at: '2026-10-25T12:00:00Z', cuantos: '3-5', como: ['clientes', 'anuncios'], cobro: 'mi.alias.mp' });
  assert.equal(altaLimpia({ cuantos: 'mil' }).cuantos, null);
  assert.equal(cobroLimpio('x'.repeat(500))!.length, 120);
  assert.equal(cobroLimpio('   '), null);
  assert.deepEqual(leerAlta(JSON.stringify(a)), a);
  assert.equal(leerAlta('{"cuantos":"3-5"}'), null, 'sin fecha no es un alta');
  assert.equal(leerAlta('roto'), null);
  assert.equal(CLAVE_ALTA_PARTNERS, 'partners.alta');
});

test('las VISITAS al link: sin robots de vista previa, sólo la primera vez de cada navegador, y los últimos 12 meses', () => {
  for (const ua of ['WhatsApp/2.23', 'facebookexternalhit/1.1', 'TelegramBot (like TwitterBot)', 'Slackbot-LinkExpanding', null, '']) assert.equal(esRobot(ua), true, String(ua));
  assert.equal(esRobot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1'), false);
  let v = leerVisitas(null);
  for (let i = 0; i < 3; i++) v = sumarVisita(v, '2026-10');
  assert.deepEqual(v, { total: 3, meses: { '2026-10': 3 } });
  for (let m = 1; m <= 13; m++) v = sumarVisita(v, `2027-${String(m).padStart(2, '0')}`.replace('2027-13', '2028-01'));
  assert.equal(Object.keys(v.meses).length, 12);
  assert.deepEqual(leerVisitas('{"total":"x","meses":{"nope":4}}'), { total: 0, meses: {} });
  const r = fuente('app/r/[codigo]/route.ts');
  // (6/11/2026: «sin cookie» es `ponerCookie` — también cuenta la de un código muerto, que ya no tapa este link)
  assert.match(r, /if \(ponerCookie\) \{\s*res\.cookies\.set\(COOKIE_REF, codigo[^\n]*\n\s*await sumarVisitaAlLink\(codigo, req\.headers\.get\('user-agent'\)\)\.catch\(/, 'sólo sin cookie que valga, y si falla el link igual lleva');
  assert.equal(r.match(/sumarVisitaAlLink\(/g)?.length, 1, 'una sola vez, adentro del «no había cookie»');
});

test('el CÓDIGO en el carrito: escrito gana; si no, el primer link (cookie) y después el ?ref=; uno que no existe se dice', () => {
  assert.equal(codigoDeLaCompra({ escrito: 'ana', cookie: 'beto', url: 'caro' }), 'ana');
  assert.equal(codigoDeLaCompra({ escrito: null, cookie: 'beto', url: 'caro' }), 'beto');
  assert.equal(codigoDeLaCompra({ escrito: null, cookie: null, url: 'caro' }), 'caro');
  const base = { plan: 'pro', nombre: 'Ana López', email: 'ana@x.com' };
  const ok = leerPedidoCompra({ ...base, codigo: '  Estudio-Sur ' });
  assert.ok(ok.ok && ok.pedido.codigoEscrito === 'estudio-sur' && !ok.pedido.codigoEscritoMal);
  const mal = leerPedidoCompra({ ...base, codigo: 'no vale!' });
  assert.ok(mal.ok && mal.pedido.codigoEscrito === null && mal.pedido.codigoEscritoMal, 'algo que no puede ser un código se dice, no se descarta');
  assert.equal(codigoParaMandar('estudio-sur', 'estudio-sur'), undefined, 'si dejó el del link, decide la cookie');
  assert.equal(codigoParaMandar(' Otro ', 'estudio-sur'), 'otro');
  assert.equal(codigoParaMandar('', null), undefined);
  const ruta = fuente('app/api/planes/comprar/route.ts');
  assert.match(ruta, /if \(pedido\.codigoEscritoMal\) return Response\.json\(\{ error: TEXTO_CODIGO_NO_EXISTE, campo: 'codigo' \}, \{ status: 400 \}\);/);
  assert.match(ruta, /if \(pedido\.codigoEscrito && !\(await esCodigoDePartner\(pedido\.codigoEscrito\)\.catch\(\(\) => true\)\)\)/, 'no pude leer: la compra sigue');
  // Desde el 28/10/2026 la ruta guarda sólo el código de un partner (`codigoQueCuenta`, con el mismo orden: el escrito, la cookie
  // y después el `?ref=`; tests/partners-codigo-editable.test.ts).
  assert.match(ruta, /const refQueCuenta = await codigoQueCuenta\(\{ escrito: pedido\.codigoEscrito, cookie: codigoRefLimpio\(req\.cookies\.get\(COOKIE_REF\)\?\.value\), url: pedido\.ref \}, esCodigoDePartner\);/);
  assert.match(TEXTO_CODIGO_NO_EXISTE, /no existe/);
  const compra = fuente('app/planes/[plan]/CompraPlan.tsx');
  assert.ok(compra.indexOf('<CodigoReferido') > 0 && compra.indexOf('<CodigoReferido') < compra.indexOf('<button className="planes-btn" type="submit"'), 'arriba del botón de pagar');
  assert.match(compra, /codigo: codigoParaMandar\(codigo, p\.refCodigo\)/);
  const quiero = fuente('app/planes/[plan]/QuieroPlan.tsx');
  assert.match(quiero, /\{preguntas\.length === 0 && \(\s*<CodigoReferido/, 'el Acelerador (con preguntas) no lleva código');
  assert.match(fuente('app/planes/[plan]/CodigoReferido.tsx'), /¿Te recomendó alguien\? Pon su código/);
  assert.match(fuente('lib/partners-programa.ts'), /export async function esCodigoDePartner[\s\S]*?!== \(await wsSuperAdmin\(\)\)/, 'el código de la plataforma no es de un partner');
});

test('el PANEL del partner (Tolt): visitas, negocios, lo ganado y lo que tiene a cobrar; el link y el código; sus cobros', () => {
  const p = fuente('app/partners/PanelPartner.tsx');
  const kpis = ['Visitas a tu link', 'Negocios que trajiste', 'Ganaste', 'A cobrar'];
  let ultimo = -1;
  for (const k of kpis) { const i = p.indexOf(`<span className="pp-kpi-etq">${k}</span>`); assert.ok(i > ultimo, k); ultimo = i; }
  assert.match(p, /<div className="pp-kpi destacado"><span className="pp-kpi-etq">A cobrar<\/span>/, 'lo que tiene a cobrar, destacado');
  assert.match(p, /<BarrasPorMes datos=\{tablero\.porMes\}/);
  // Desde el 27/10/2026 el link y el código son los VIVOS (`ref`): «Cambiar» el código los cambia sin recargar.
  assert.match(p, /<Copiable etiqueta="Tu link" valor=\{ref\.link\} \/>/);
  assert.match(p, /<CodigoEditable codigo=\{ref\.codigo\} onCambio=\{setRef\} \/>/);
  assert.match(p, /<Copiable etiqueta="Tu código, para poner al pagar" valor=\{codigo\}/);
  assert.match(p, /https:\/\/wa\.me\/\?text=/);
  assert.match(p, /const r = await cambiarCobroPartnerAction\(valor\)/);
  const b = fuente('app/partners/BarrasPorMes.tsx');
  assert.match(b, /width: min\(24px, 60%\); border-radius: 4px 4px 0 0;/, 'columnas finas, punta redondeada, base recta');
  assert.match(b, /const etiqueta = \(i === iHoy \|\| \(i === iMax && Math\.abs\(iMax - iHoy\) >= 2\)\) && d\.usd > 0;/, 'el valor sólo en el de hoy y en el más alto, nunca pegados');
});

test('el PANEL del super admin (FirstPromoter): a pagar destacado, y «Marcar pagado» sólo suyo y nunca más de lo que se debe', () => {
  const g = fuente('app/partners/ProgramaPartners.tsx');
  assert.match(g, /<div className="pp-kpi destacado"><span className="pp-kpi-etq">A pagar<\/span>/);
  assert.match(g, /const ok = await confirm\(/, 'con un «¿seguro?» que dice cuánto y a quién');
  assert.match(g, /marcarPagoPartnerAction\(\{ ws: p\.ws, montoUsd: p\.aCobrarUsd \}\)/);
  const a = fuente('app/partners/actions.ts');
  const m = a.slice(a.indexOf('export async function marcarPagoPartnerAction'), a.indexOf('export async function llevarAPartnersAction'));
  assert.match(m, /if \(!sesion \|\| \(await estaImpersonando\(\)\)\) return \{ ok: false/, 'sólo el super admin, sin estar parado en un cliente');
  const p = fuente('lib/partners-programa.ts');
  const r = p.slice(p.indexOf('export async function registrarPagoAPartner'), p.indexOf('export async function acreditarReferidos'));
  assert.match(r, /if \(!\(monto > 0\) \|\| monto > aCobrarUsd\) return \{ ok: false/);
  assert.match(r, /insert\(\{ referidor_ws: p\.ws, tipo: 'uso', monto_usd: -monto, nota \}\)/, 'un renglón `uso` negativo: lo transferido');
  assert.match(r, /await avisarPago\(p\.ws, monto\)/);
});

test('la API: las cinco operaciones de Partners, con sus puertas y la misma función que la pantalla', () => {
  const def = fuente('lib/api-mako/areas/negocio.def.ts');
  assert.match(def, /id: 'ver_mi_programa_partners', area: 'negocio', tipo: 'lectura',/);
  assert.match(def, /id: 'hacerme_partner', area: 'negocio', tipo: 'accion', confirmacion: 'chat', reversible: false,/);
  assert.match(def, /id: 'cambiar_cobro_partners', area: 'negocio', tipo: 'accion', confirmacion: 'chat', reversible: true,/);
  const prog = def.slice(def.indexOf("id: 'ver_programa_partners'"), def.indexOf("id: 'registrar_pago_partner'"));
  assert.match(prog, /canales: SIN_HTTP, costo: 'gratis', gating: \{ rolMinimo: 'admin', soloPlataforma: true \}/, 'el programa: sólo la plataforma y sin HTTP');
  const pago = def.slice(def.indexOf("id: 'registrar_pago_partner'"), def.indexOf("id: 'listar_tabs_por_configurar'"));
  assert.match(pago, /confirmacion: 'pantalla', pantalla: '\/mako\/revisar', reversible: false,/, 'anota plata: se confirma en una pantalla');
  assert.match(pago, /canales: SIN_HTTP, costo: 'gratis', gating: \{ rolMinimo: 'admin', soloPlataforma: true \}/, 'el pago: sólo la plataforma y sin HTTP');
  assert.match(pago, /fijoAlRevisar: true/, 'el partner no se cambia al revisar');
  const run = fuente('lib/api-mako/areas/negocio.run.ts');
  assert.match(run, /const t = await tableroDe\(ctx\.ws\);/, 'lo mismo que el panel');
  assert.match(run, /const r = await hacermePartner\(ctx\.ws, payload\);/, 'la misma función que el onboarding');
  assert.match(run, /const r = await registrarPagoAPartner\(\{ ws: Number\(payload\.partnerWs\)/, 'la misma función que «Marcar pagado»');
  const rest = fuente('lib/api-mako/rest.ts');
  for (const [v, ruta, id] of [['GET', '/negocio/partners', 'ver_mi_programa_partners'], ['POST', '/negocio/partners', 'hacerme_partner'], ['PUT', '/negocio/partners/cobro', 'cambiar_cobro_partners']]) {
    assert.ok(rest.includes(`['${v}', '${ruta}', '${id}']`), id);
  }
  const snap = readFileSync(join(RAIZ, 'tests/api-mako-http.snapshot.txt'), 'utf8');
  for (const id of ['ver_mi_programa_partners', 'hacerme_partner', 'cambiar_cobro_partners']) assert.match(snap, new RegExp(`^${id}\\r?$`, 'm'), `${id} en el snapshot`);
  assert.doesNotMatch(snap, /^(ver_programa_partners|registrar_pago_partner)\r?$/m, 'lo de la plataforma no sale por HTTP');
  assert.match(readFileSync(join(RAIZ, 'docs/api-mako.md'), 'utf8'), /hacerme_partner/);
});

// Roturas (25/10/2026; base 27 / 0 con partners-solo-plata, mako-partners-landing, partners-para-clientes y partners-referidos
// juntos), cada una restaurada (pasan / fallan):
//   · el anual deja el año (lo cobrado, no el precio de lista)                 -> 26 / 1
//   · el 50% del primer mes en vez del 100%                                     -> 23 / 4
//   · las visitas cuentan el robot de vista previa de WhatsApp                  -> 26 / 1
//   · la visita se cuenta siempre, también con cookie                           -> 26 / 1
//   · la cookie le gana al código escrito en el carrito                         -> 26 / 1
//   · un código escrito que no es de nadie se guarda igual                      -> 26 / 1
//   · «Marcar pagado» deja anotar más de lo que se debe                         -> 26 / 1
//   · «Marcar pagado» lo puede usar cualquier admin                             -> 26 / 1
//   · registrar_pago_partner sale por HTTP                                      -> 26 / 1
//   · el carrito sin el campo del código                                        -> 26 / 1
//   · el Acelerador con el campo del código                                     -> 26 / 1
