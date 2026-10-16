// =============================================================================
// Un cobro confirmado por la pasarela NO pide comprobante subido
// =============================================================================
// La pasarela de pagos (11/10/2026) escribe la cuota cobrada con `proveedor` ('stripe' |
// 'mercadopago') y sin archivo: la prueba del pago es el aviso firmado de la pasarela. El predicado
// viejo (`p.pagado && !p.comprobante_path`) estaba COPIADO en cuatro lugares y le pedía el comprobante
// a cada cuota de pasarela: todo lead que pagaba por link quedaba para siempre en «Datos sin marcar:
// Comprobante de pago», sin nada que subir. Ahora es UNA función (lib/pago-comprobante.ts) y este test
// fija las dos cosas: lo que decide, y que los cuatro lugares la usan (y que nadie vuelve a copiar el
// predicado viejo).
//
// ⚠️ `git ls-files` lista el ÍNDICE: un archivo nuevo sin `git add` no se barre.
//
// Probado ROMPIÉNDOLO (11/10/2026), una rotura por vez y restaurando de memoria. Con el código como
// está: 5 pases, 0 fallos. Rota (pases / fallos):
//   · `faltaComprobante` sin el `!p.proveedor`                                    → 4 / 1
//   · app/crm/[id]/page.tsx vuelto a `pagos.filter((p) => p.pagado && !p.comprobante_path)` → 3 / 2
//     (el call-site Y el barrido lo ven)
//   · lib/queries.ts sin `proveedor` en el select de los pagos del worklist       → 4 / 1
// Correr: node --import tsx --test tests/pago-comprobante.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { faltaComprobante } from '../lib/pago-comprobante';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
/** Sin comentarios: la prosa que EXPLICA el predicado viejo lo nombra. */
const codigo = (r: string) => leer(r).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('qué decide: cobrada a mano sin archivo falta; con archivo o por pasarela, no', () => {
  assert.equal(faltaComprobante({ pagado: true, comprobante_path: null }), true, 'cobrada a mano, sin archivo');
  assert.equal(faltaComprobante({ pagado: true }), true, 'sin la columna (select viejo): se pide, como siempre');
  assert.equal(faltaComprobante({ pagado: true, comprobante_path: 'contratos/x.pdf' }), false, 'con archivo');
  assert.equal(faltaComprobante({ pagado: false, comprobante_path: null }), false, 'sin cobrar no pide comprobante');
  assert.equal(faltaComprobante({ pagado: true, comprobante_path: null, proveedor: 'stripe' }), false, 'la cobró Stripe');
  assert.equal(faltaComprobante({ pagado: true, comprobante_path: null, proveedor: 'mercadopago' }), false, 'la cobró Mercado Pago');
  assert.equal(faltaComprobante({ pagado: true, comprobante_path: null, proveedor: null }), true, 'proveedor null = a mano');
});

// ⚠️ ERAN CUATRO Y DESDE EL 14/10/2026 SON TRES: la ruta /crm/[id] dejó de contar los faltantes por su
// cuenta y lee con la action del pop-up (`getLeadFullAction`, app/crm/actions.ts), que ya está en la lista.
// Cambiado a propósito: se fija además que la ruta no vuelva a contar sola.
const LLAMADORES = [
  'lib/queries.ts',
  'app/crm/actions.ts',
  'lib/api-mako/areas/crm.helpers.ts',
];

test('los cuatro lugares que cuentan comprobantes faltantes usan faltaComprobante', () => {
  const ruta = codigo('app/crm/[id]/page.tsx');
  assert.match(ruta, /await getLeadFullAction\(idNum\)/, 'la ruta tiene que leer con la action del pop-up');
  assert.doesNotMatch(ruta, /comprobante|faltantesDeLead/, 'la ruta vuelve a contar los faltantes por su cuenta');
  for (const f of LLAMADORES) {
    const src = codigo(f);
    assert.match(src, /import \{ faltaComprobante \} from '(@\/lib|\.)\/pago-comprobante';/, `${f}: no importa faltaComprobante`);
    // Que lo LLAME, no sólo que lo importe: un import solo pasa con el predicado viejo al lado.
    assert.match(src, /\.filter\(faltaComprobante\)|faltaComprobante\(p\)/, `${f}: importa faltaComprobante pero no lo usa`);
  }
  // El worklist del CRM lee las cuotas a mano: sin `proveedor` en el select, el predicado vuelve a
  // pedirle el comprobante a todo cobro de pasarela, sin ningún error.
  assert.match(codigo('lib/queries.ts'), /'pagos', 'lead_id, pagado, comprobante_path, proveedor'/);
});

test('nadie vuelve a copiar el predicado viejo en app/ ni lib/', () => {
  const archivos = execFileSync('git', ['ls-files', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8' })
    .split(/\r?\n/).map((f) => f.trim()).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.d\.ts$/.test(f));
  assert.ok(archivos.length > 500, `git ls-files devolvió ${archivos.length} archivos: esto no corrió en el repo`);
  const VIEJO = /\b\w+\.pagado\s*&&\s*!\s*\w+\.comprobante_path\b/;
  const malos = archivos.filter((f) => f !== 'lib/pago-comprobante.ts' && VIEJO.test(codigo(f)));
  assert.deepEqual(malos, [], 'el predicado del comprobante va por faltaComprobante (lib/pago-comprobante.ts)');
});

test('la cuota que cobró una pasarela no se «deshace» a mano en la ficha', () => {
  // Desmarcarla dejaría el cobro pagado y la cuota sin pagar; lo que la revierte es «Devolver».
  const card = codigo('app/crm/[id]/DealDetailsCard.tsx');
  assert.match(card, /\{esPasarela\(p\.proveedor\)\s*\?\s*<span[^>]*>por \{NOMBRE_PASARELA\[p\.proveedor\]\}<\/span>\s*:\s*<button[^>]*onClick=\{\(\) => desmarcarPago\(p\)\}>deshacer<\/button>\}/);
});

test('el módulo es puro: lo importan server, cliente y tests', () => {
  const src = codigo('lib/pago-comprobante.ts');
  assert.doesNotMatch(src, /server-only|'use client'|'use server'|from '/);
});
