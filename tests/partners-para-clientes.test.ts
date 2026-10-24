// =============================================================================
// MaKo Partners para clientes (24/10/2026): Martín, «la tab de MaKo Partners para clientes, primero la tab tipo landing
// que venda la idea de ser partner y luego el dashboard, tanto de SuperAdmin como clientes»
// =============================================================================
// Estaba construida y NO SE VEÍA: el ítem del menú de la foto tenía `soloCapas: ['agencia']`, así que un cliente común
// sólo llegaba a su tablero tipeando la URL. Lo que se fija acá (la barra, en tests/sidebar-nueva.test.ts):
//   · arriba del tablero del cliente y del panel del super admin, PRIMERO lo que vende la idea;
//   · eso dice SÓLO lo que existe: el crédito por referido (ni «se descuenta» ni la comisión del grupal, que no se aplican);
//   · el panel del super admin cuenta el programa como `acreditarReferidos` (`contarPrograma`, puro);
//   · el teléfono: quien no es agencia ve sus referidos.
//
// Probado rompiéndolo (24/10/2026): al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contarPrograma } from '../lib/partners-reglas';

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
  assert.equal(r.conLink, 4);
  assert.equal(r.referidos, 2);
  assert.equal(r.porPartner.get(9), undefined, 'la plataforma no aparece como partner');
  assert.equal(r.acreditadoUsd, 191.5);
  assert.deepEqual(r.porPartner.get(10), { referidos: 2, acreditadoUsd: 144 });
  assert.equal(r.porPartner.get(20), undefined, 'beto no trajo a nadie nuevo');
  assert.deepEqual(r.porPartner.get(30), { referidos: 0, acreditadoUsd: 47.5 }, 'un crédito sin referido contado también se ve');
});

test('lo que vende la idea va PRIMERO, en el tablero del cliente y en el panel del super admin', () => {
  const cliente = fuente('app/partners/referidos/Referidos.tsx');
  const pitch = cliente.indexOf('<PresentacionPartners vista="cliente" />');
  assert.ok(pitch > 0, 'el tablero del cliente sin la presentación');
  const link = cliente.indexOf('<input readOnly value={tablero.link}');
  assert.ok(link > 0 && pitch < link && pitch < cliente.indexOf('<div className="pr-grilla">'), 'la presentación, antes del link y del tablero');
  const plataforma = fuente('app/partners/PartnersApp.tsx');
  const pitchP = plataforma.indexOf('<PresentacionPartners vista="plataforma" />');
  assert.ok(pitchP > 0, 'el panel del super admin sin la presentación');
  assert.ok(pitchP < plataforma.indexOf('El programa') && pitchP < plataforma.indexOf('Agencias del programa'), 'antes del programa y de las agencias');
  assert.match(fuente('app/partners/page.tsx'), /resumenDelPrograma\(\)\.catch\(/, 'el super admin ve el programa entero');
  assert.match(plataforma, /<PartnersPlataforma|export function PartnersPlataforma\(\{ partners, programa \}/);
});

test('la presentación dice SÓLO lo que existe y lleva a la página pública', () => {
  const p = fuente('app/partners/PresentacionPartners.tsx');
  assert.doesNotMatch(p, /descuent/i, 'el crédito todavía no se descuenta de ninguna cuota');
  assert.doesNotMatch(p, /20 ?%|grupal|en plata/i, 'la comisión del grupal no se aplica todavía');
  assert.match(p, /primer mes como crédito/);
  assert.match(p, /<Link href="\/mako-partners">/);
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
//   · el tablero del cliente sin la presentación                                              -> 7 / 1
//   · la presentación después del tablero                                                     -> 7 / 1
//   · el panel del super admin sin la presentación                                            -> 7 / 1
//   · la presentación promete que el crédito «se descuenta»                                   -> 7 / 1
//   · `contarPrograma` cuenta a la plataforma como partner (revisión del 24/10)                -> 7 / 1
//   · `contarPrograma` deja que un código sin dueño no ocupe el primer lugar                    -> 7 / 1
