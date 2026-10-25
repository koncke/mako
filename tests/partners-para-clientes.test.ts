// =============================================================================
// MaKo Partners para clientes (24/10/2026): Martín, «la tab de MaKo Partners para clientes, primero la tab tipo landing
// que venda la idea de ser partner y luego el dashboard, tanto de SuperAdmin como clientes»
// =============================================================================
// Estaba construida y NO SE VEÍA: el ítem del menú de la foto tenía `soloCapas: ['agencia']`, así que un cliente común
// sólo llegaba a su tablero tipeando la URL. Lo que se fija acá (la barra, en tests/sidebar-nueva.test.ts):
//   · (24/10, noche) la landing hasta que el negocio se une, el tablero recién después; el super admin, la landing antes
//     del programa. Lo que dice la landing, en tests/mako-partners-landing.test.ts;
//   · el panel del super admin cuenta el programa como `acreditarReferidos` (`contarPrograma`, puro);
//   · el teléfono: quien no es agencia ve sus referidos.
//
// Probado rompiéndolo (24/10/2026): al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contarPrograma, textoProgramaSinReferidos, textoSinReferidos } from '../lib/partners-reglas';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

test('el panel del super admin cuenta como la acreditación: el primer código, una vez, nunca uno mismo', () => {
  const r = contarPrograma({
    plataforma: 9,
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
    creditos: [{ referidor_ws: 10, monto_usd: 47 }, { referidor_ws: 10, monto_usd: 97 }, { referidor_ws: 30, monto_usd: 47.5 }],
  });
  assert.equal(r.conLink, 3, 'la plataforma no es un negocio con su link');
  assert.equal(r.referidos, 2);
  assert.equal(r.porPartner.get(9), undefined, 'la plataforma no aparece como partner');
  assert.equal(r.acreditadoUsd, 191.5);
  assert.deepEqual(r.porPartner.get(10), { referidos: 2, acreditadoUsd: 144 });
  assert.equal(r.porPartner.get(20), undefined, 'beto no trajo a nadie nuevo');
  assert.deepEqual(r.porPartner.get(30), { referidos: 0, acreditadoUsd: 47.5 }, 'un crédito sin referido contado también se ve');
});

test('la LANDING hasta unirse, el tablero después; y el super admin, la landing antes del programa (24/10, noche)', () => {
  // Martín: «La pagina de MaKo Partners DEBE ser siempre la landing al menos que el usuario ya se haya registrado como
  // partner, solo cuando se registre ahi aparece el dashboard».
  for (const rel of ['app/partners/referidos/page.tsx', 'app/m/partners/page.tsx']) {
    const p = fuente(rel);
    const pregunta = p.indexOf('codigoSiExiste(ws)');
    const landing = p.indexOf('<LandingPartners modo="app"');
    const tablero = p.indexOf('await tableroDe(ws)');
    assert.ok(pregunta > 0 && landing > pregunta && tablero > landing, `${rel}: primero si se unió, la landing si no, y recién después el tablero`);
    assert.match(p, /if \(!codigo\) \{/, `${rel}: sin código, la landing`);
    assert.match(p, /unirmeAPartnersAction/, `${rel}: el botón une al negocio`);
  }
  // El tablero ya no lleva la presentación: la vende la landing, y arriba del tablero va el link.
  const cliente = fuente('app/partners/referidos/Referidos.tsx');
  assert.doesNotMatch(cliente, /PresentacionPartners|LandingPartners/);
  assert.ok(cliente.indexOf('<input readOnly value={tablero.link}') < cliente.indexOf('<div className="pr-grilla">'), 'el link, antes de lo acumulado');
  const plataforma = fuente('app/partners/PartnersApp.tsx');
  const pitchP = plataforma.indexOf('<LandingPartners modo="app"');
  assert.ok(pitchP > 0, 'el panel del super admin sin la landing');
  assert.ok(pitchP < plataforma.indexOf('El programa') && pitchP < plataforma.indexOf('Agencias del programa'), 'antes del programa y de las agencias');
  assert.doesNotMatch(plataforma.slice(pitchP, pitchP + 300), /unirme=/, 'la plataforma no es partner: sin el botón');
  assert.match(fuente('app/partners/page.tsx'), /resumenDelPrograma\(\)\.catch\(/, 'el super admin ve el programa entero');
  assert.match(plataforma, /export function PartnersPlataforma\(\{ partners, programa, cobraEnLinea = true, emailMako \}/);
  assert.match(fuente('app/partners/page.tsx'), /<PartnersPlataforma partners=\{partners\} programa=\{programa\} cobraEnLinea=\{cobraEnLinea\} emailMako=\{EMAIL_MAKO\} \/>/);
});

test('«Unirme»: sólo el admin, nunca la plataforma, y unirse es crear el código (que no se duplica)', () => {
  const a = fuente('app/partners/actions.ts');
  const f = a.slice(a.indexOf('export async function unirmeAPartnersAction'));
  assert.match(f, /const ws = await adminDeWorkspaceActual\(\);/);
  assert.match(f, /ws == null \|\| ws === \(await wsSuperAdmin\(\)\)\) redirect/);
  assert.match(f, /await codigoDe\(ws\)/, 'el mismo `codigoDe` que crea uno o devuelve el que hay');
  assert.match(f, /VUELTAS_DE_UNIRME\.has\(pedida\)/, 'la vuelta no la elige el formulario');
  const prog = fuente('lib/partners-programa.ts');
  const solo = prog.slice(prog.indexOf('export async function codigoSiExiste'), prog.indexOf('async function wsDelCodigo'));
  assert.doesNotMatch(solo, /insert/, 'preguntar si se unió no lo une');
});

test('en cero, dice POR QUÉ: sin pasarela no se registra ningún referido (24/10, el Cerebro: «no lo maquilles»)', () => {
  const sin = textoSinReferidos({ cobraEnLinea: false, emailMako: 'equipo@hola-mako.com' });
  assert.match(sin, /da de alta a mano/);
  assert.match(sin, /escríbenos a equipo@hola-mako\.com/);
  assert.doesNotMatch(textoSinReferidos({ cobraEnLinea: true, emailMako: 'x@y.z' }), /a mano|escríbenos/, 'con pasarela, el texto de siempre');
  assert.match(textoProgramaSinReferidos(false), /todavía no cobra en línea/);
  assert.doesNotMatch(textoProgramaSinReferidos(true), /no cobra/);
  // El cableado: las tres pantallas lo leen de la MISMA cuenta que /planes (`ofertasDeLosPlanes`), y «no pude leer» no
  // afirma que no cobra (cae al texto de siempre).
  for (const rel of ['app/partners/referidos/page.tsx', 'app/partners/page.tsx', 'app/m/partners/page.tsx']) {
    assert.match(fuente(rel), /ofertasDeLosPlanes\(\)\.then\(\(o\) => o\.some\(\(x\) => x\.cobrable\)\)\.catch\(\(\) => true\)/, rel);
  }
  assert.match(fuente('app/partners/referidos/Referidos.tsx'), /detalle=\{textoSinReferidos\(\{ cobraEnLinea, emailMako \}\)\}/);
  assert.match(fuente('app/partners/PartnersApp.tsx'), /detalle=\{textoProgramaSinReferidos\(cobraEnLinea\)\}/);
  assert.match(fuente('app/m/partners/ReferidosM.tsx'), /<VacioM frase=\{textoSinReferidos\(\{ cobraEnLinea, emailMako \}\)\} \/>/);
});

test('el teléfono: quien no es agencia ve sus referidos con los mismos datos que la computadora', () => {
  const m = fuente('app/m/partners/ReferidosM.tsx');
  assert.match(m, /TEXTO_ESTADO_REFERIDO\[x\.estado\]/);
  assert.match(m, /navigator\.clipboard\.writeText\(tablero\.link\)/);
  assert.doesNotMatch(m, /descuent/i);
});

// Roturas (24/10/2026; base 8 / 0 con planes-tres-bloques y partners-para-clientes juntos), cada una restaurada (pasan / fallan):
//   · `contarPrograma` cuenta cada compra (el mismo negocio dos veces)                         -> 7 / 1
//   · `contarPrograma` cuenta al que se trajo a sí mismo                                      -> 7 / 1
//   · (24/10 noche: la presentación del tablero se reemplazó por la landing hasta unirse; sus roturas, abajo)
//   · `contarPrograma` cuenta a la plataforma como partner (revisión del 24/10)                -> 7 / 1
//   · `contarPrograma` deja que un código sin dueño no ocupe el primer lugar                    -> 7 / 1
//   · `textoSinReferidos` nunca dice que se da de alta por llamada (24/10, base 5 / 0)          -> 4 / 1
//   · el tablero del cliente afirma «no cobra» cuando no pudo leer                             -> 4 / 1
//   · el panel del super admin sin el porqué                                                   -> 4 / 1
//   · el teléfono sin el porqué                                                                -> 4 / 1
// Roturas del registro (24/10/2026, noche; base 5 / 0), cada una restaurada (pasan / fallan):
//   · el tablero sin preguntar si se unió (la landing nunca aparece)                          -> 4 / 1
//   · el teléfono igual                                                                        -> 4 / 1
//   · «Unirme» deja unirse a la plataforma                                                     -> 4 / 1
//   · «Unirme» vuelve a donde diga el formulario                                               -> 4 / 1
//   · `codigoSiExiste` crea el código al preguntar                                             -> 4 / 1
//   · el super admin con el botón de unirse                                                    -> 4 / 1
