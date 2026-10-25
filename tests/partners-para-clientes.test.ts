// =============================================================================
// MaKo Partners: quién ve qué en /partners (24/10/2026; rehecho el 25/10/2026)
// =============================================================================
// Martín (25/10, ~15:40): «Revisa que la url es "https://hola-mako.com/partners/referidos" cuando solo basta "partners"...
// En los clientes no se ve la pagina tipo de ventas de MaKo partners... Solo en SuperAdmin. Y creo que no estás entendiendo,
// si alguien no se hizo "Partner", no le debe saltar abajo nada de "Todavía no tienes referidos" o del dashboard... Solo los
// CTA para que se haga Partner, posterior a apretar eso, un pequeño onboarding, que le pregunte algunas cosas como, cuantos
// quisiera referir, etc... Y que ahí le de su link de referido... Luego de eso, en la misma url, ahora si ven el dashboard,
// con un botón arriba para ver la landing nuevamente por si quieren... En SuperAdmin, directo ver el dashboard». Y el 9:
// «Ser Agencia es muy diferente a Partner». Lo que se fija acá:
//   · LA CAUSA de que el cliente veía el tablero vacío: «partner» era tener código, y hasta el 24/10 el código nacía con sólo
//     abrir el tablero. Ahora partner = terminó el alta (`altaDePartner`), y el código no alcanza;
//   · todo en /partners: la landing (sin alta), el onboarding (`?alta=1`), el panel (con alta), la landing otra vez
//     (`?landing=1`); /partners/referidos lleva a /partners; el super admin, directo el panel del programa;
//   · lo de agencia salió: los links viejos de agencia van a /agency, y el panel de agencia vive allá;
//   · el panel del super admin cuenta como la acreditación (`contarPrograma`, puro); y en cero, dice por qué.
//
// Probado rompiéndolo (25/10/2026): al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contarPrograma, textoProgramaSinReferidos, textoSinReferidos } from '../lib/partners-reglas';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

test('el panel del super admin cuenta como la acreditación: el primer código, una vez, nunca uno mismo; partners = altas', () => {
  const r = contarPrograma({
    plataforma: 9,
    altas: [10, 30, 9, 40],
    codigos: [{ workspace_id: 10, codigo: 'ana' }, { workspace_id: 20, codigo: 'beto' }, { workspace_id: 30, codigo: 'caro' }, { workspace_id: 9, codigo: 'mako' }],
    compras: [
      { ref_codigo: 'ana', alta_ws: 101 },
      { ref_codigo: 'beto', alta_ws: 101 }, // el mismo negocio con otro código después: vale el primero
      { ref_codigo: 'ana', alta_ws: 102 },
      { ref_codigo: 'beto', alta_ws: 20 }, // uno mismo no cuenta
      { ref_codigo: 'nadie', alta_ws: 103 }, // un código que no es de nadie no cuenta
      { ref_codigo: 'nadie', alta_ws: 104 }, { ref_codigo: 'ana', alta_ws: 104 }, // el primero decide aunque no cuente
      { ref_codigo: 'mako', alta_ws: 105 }, // la plataforma nunca es partner
    ],
    libro: [{ referidor_ws: 10, tipo: 'referido', monto_usd: 47 }, { referidor_ws: 10, tipo: 'referido', monto_usd: 97 }, { referidor_ws: 10, tipo: 'uso', monto_usd: -47 },
      { referidor_ws: 30, tipo: 'referido', monto_usd: 47.5 }],
  });
  assert.equal(r.partners, 3, 'los que terminaron el alta (beto tiene código pero no se hizo partner; la plataforma no cuenta)');
  assert.equal(r.referidos, 2);
  assert.equal(r.porPartner.get(9), undefined, 'la plataforma no aparece como partner');
  assert.deepEqual({ g: r.ganadoUsd, p: r.pagadoUsd, a: r.aPagarUsd }, { g: 191.5, p: 47, a: 144.5 });
  assert.deepEqual(r.porPartner.get(10), { referidos: 2, ganadoUsd: 144, pagadoUsd: 47, aCobrarUsd: 97 });
  assert.equal(r.porPartner.get(20), undefined, 'beto no trajo a nadie nuevo ni se hizo partner');
  assert.deepEqual(r.porPartner.get(40), { referidos: 0, ganadoUsd: 0, pagadoUsd: 0, aCobrarUsd: 0 }, 'un partner recién hecho también se ve');
});

test('PARTNER = TERMINÓ EL ALTA, no tener código: la landing sin alta (con el onboarding), el panel con alta', () => {
  for (const rel of ['app/partners/page.tsx', 'app/m/partners/page.tsx']) {
    const p = fuente(rel);
    assert.match(p, /altaDePartner\(ws\)\.catch\(/, `${rel}: pregunta si se hizo partner`);
    assert.doesNotMatch(p, /codigoSiExiste/, `${rel}: tener código no es ser partner (por eso veían el tablero vacío)`);
    const sinAlta = p.indexOf('if (!alta)');
    const alta = p.indexOf("sp.alta === '1'", sinAlta);
    const landing = p.indexOf('<LandingPartners modo="app" accion={{ href: RUTA_ALTA_PARTNERS', sinAlta);
    const panel = p.indexOf('await Promise.all([tableroDe(ws)', sinAlta) > 0 ? p.indexOf('await Promise.all([tableroDe(ws)', sinAlta) : p.indexOf('tableroDe(ws).catch(', sinAlta);
    assert.ok(sinAlta > 0 && alta > sinAlta && landing > alta && panel > landing, `${rel}: sin alta, el onboarding o la landing; recién después el panel`);
    assert.match(p, /<AltaPartner nombreNegocio=\{nombre\} \/>/, `${rel}: el onboarding corto`);
    assert.match(p, /sp\.landing === '1'/, `${rel}: el partner ve la landing otra vez con ?landing=1`);
  }
  const prog = fuente('lib/partners-programa.ts');
  const alta = prog.slice(prog.indexOf('export async function altaDePartner'), prog.indexOf('export type ResultadoAlta'));
  assert.match(alta, /leerAlta\(await leerSetting\(ws, CLAVE_ALTA_PARTNERS\)\)/);
  const tablero = prog.slice(prog.indexOf('export async function tableroDe'), prog.indexOf('async function adminsDe'));
  assert.doesNotMatch(tablero, /codigoDe\(/, 'abrir el panel nunca crea un código');
});

test('el onboarding: una pregunta por pantalla, y al final el link (sólo el admin; la plataforma nunca es partner)', () => {
  const a = fuente('app/partners/AltaPartner.tsx');
  for (const q of ['¿A cuántos negocios podrías recomendarle MaKo este mes?', '¿Cómo vas a llegar a ellos?', '¿Dónde te transferimos lo que ganes?']) assert.ok(a.includes(q), q);
  assert.match(a, /onClick=\{\(\) => \{ setCuantos\(c\.id\); setPaso\(1\); \}\}/, 'la primera avanza sola al tocar');
  assert.match(a, /Lo cargo después/, 'dónde cobra se puede dejar para después');
  assert.match(a, /Este es tu link/);
  assert.match(a, /const r = await hacermePartnerAction\(\{ cuantos, como, cobro: conCobro \? cobro : null \}\)/);
  const act = fuente('app/partners/actions.ts');
  const f = act.slice(act.indexOf('export async function hacermePartnerAction'), act.indexOf('export async function cambiarCobroPartnerAction'));
  assert.match(f, /const ws = await adminDeWorkspaceActual\(\);\s*if \(ws == null\) return/);
  const p = fuente('lib/partners-programa.ts');
  const h = p.slice(p.indexOf('export async function hacermePartner'), p.indexOf('export async function cambiarCobroPartner'));
  assert.match(h, /if \(ws === \(await wsSuperAdmin\(\)\)\) return \{ ok: false/);
  assert.match(h, /const codigo = await codigoDe\(ws\);/, 'el mismo `codigoDe`: crea uno o devuelve el que hay');
  assert.match(h, /at: antes\?\.at/, 'hacerse partner dos veces conserva la fecha del primer alta');
});

test('todo en /partners: /partners/referidos lleva ahí, el super admin va directo al programa, y la agencia salió a /agency', () => {
  assert.match(fuente('app/partners/referidos/page.tsx'), /redirect\(await rutaConWs\(RUTA_PARTNERS\)\)/);
  const p = fuente('app/partners/page.tsx');
  const sup = p.indexOf('if (esSuper && !(await estaImpersonando()))');
  assert.ok(sup > 0 && p.indexOf('return <ProgramaPartners programa={programa}', sup) > sup, 'el super admin: directo el panel del programa');
  assert.match(p.slice(sup), /^[\s\S]*?<LandingPartners modo="app" accion=\{null\}/, 'el super admin mira la landing sin botón: no es partner');
  assert.match(p, /if \(DE_AGENCIA\.some\(\(k\) => sp\[k\]\) \|\| VISTAS_DE_AGENCIA\.includes\(sp\.tab \?\? ''\)\)/, 'los links viejos de agencia (?cuenta=, ?nuevo=, ?tab=)');
  assert.match(p, /redirect\(await rutaConWs\(`\/agency\$\{q\.size \? `\?\$\{q\}` : ''\}`\)\)/);
  assert.doesNotMatch(p, /PartnersApp|cuentasDePartner|partnersDeLaPlataforma/, 'el panel de agencia no está en /partners');
  const ag = fuente('app/agency/page.tsx');
  assert.match(ag, /<PartnersApp\s+cartera=\{cartera\}/);
  assert.match(ag, /if \(ws == null \|\| !\(await esAgencia\(ws\)\)\) redirect/);
  assert.match(ag, /<AgenciasDeLaPlataforma partners=/, 'el super admin ve las agencias en /agency');
  assert.match(fuente('app/partners/PartnersApp.tsx'), /tabs=\{\[\{ id: 'clients', label: 'Clients' \}, \{ id: 'program', label: 'Program' \}\]\}/, 'sin la pestaña «Referidos»');
  assert.match(fuente('lib/movil-rutas.ts'), /if \(dentro\(p, '\/agency'\)\) return '\/m\/agency';/);
  assert.match(fuente('app/partners/PanelPartner.tsx'), /\{agencia && <ButtonLink href="\/agency" variant="secondary">Agency Dashboard<\/ButtonLink>\}/, 'la agencia llega a su panel desde arriba');
  assert.match(fuente('app/partners/PanelPartner.tsx'), /<ButtonLink href=\{RUTA_LANDING_PARTNERS\} variant="secondary">Ver la landing<\/ButtonLink>/, 'el botón de arriba para ver la landing');
});

test('en cero, dice POR QUÉ: sin pasarela no se registra ningún referido (24/10, el Cerebro: «no lo maquilles»)', () => {
  const sin = textoSinReferidos({ cobraEnLinea: false, emailMako: 'equipo@hola-mako.com' });
  assert.match(sin, /escríbenos a equipo@hola-mako\.com/);
  assert.doesNotMatch(sin, /da de alta a mano/, 'Martín: «Elimina... "Por ahora MaKo da de alta a mano"»');
  assert.doesNotMatch(textoSinReferidos({ cobraEnLinea: true, emailMako: 'x@y.z' }), /escríbenos/, 'con pasarela, el texto de siempre');
  assert.match(textoProgramaSinReferidos(false), /todavía no cobra en línea/);
  assert.doesNotMatch(textoProgramaSinReferidos(true), /no cobra/);
  for (const rel of ['app/partners/page.tsx', 'app/m/partners/page.tsx']) {
    assert.match(fuente(rel), /ofertasDeLosPlanes\(\)\.then\(\(o\) => o\.some\(\(x\) => x\.cobrable\)\)\.catch\(\(\) => true\)/, rel);
  }
  assert.match(fuente('app/partners/PanelPartner.tsx'), /textoSinReferidos\(\{ cobraEnLinea, emailMako \}\)/);
  assert.match(fuente('app/partners/ProgramaPartners.tsx'), /vacio=\{textoProgramaSinReferidos\(cobraEnLinea\)\}/);
  assert.match(fuente('app/m/partners/ReferidosM.tsx'), /<VacioM frase=\{textoSinReferidos\(\{ cobraEnLinea, emailMako \}\)\} \/>/);
});

// Roturas (25/10/2026; base 27 / 0 con partners-solo-plata, mako-partners-landing, partners-para-clientes y partners-referidos
// juntos), cada una restaurada (pasan / fallan):
//   · partner vuelve a ser tener código (`codigoSiExiste` en vez del alta)      -> 26 / 1
//   · el teléfono sin el onboarding corto                                       -> 26 / 1
//   · /partners/referidos vuelve a ser otra pantalla                            -> 26 / 1
//   · los links viejos de agencia no van a /agency                              -> 26 / 1
//   · vuelve el aviso «Por ahora MaKo da de alta a mano»                        -> 26 / 1
//   · el super admin con el botón de hacerse partner en la landing              -> 26 / 1
