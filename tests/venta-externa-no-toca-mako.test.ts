// =============================================================================
// La venta de un Payment Link propio NO toca el cobro de MaKo ni escribe en el Stripe del negocio (27/10/2026, MAU-10)
// =============================================================================
// El mismo webhook cobra la suscripción de MaKo. Este test mira la FORMA del código (molde de tests/cobros-webhook-rutas.test.ts):
// la rama nueva sólo se alcanza cuando `cobroDelAviso` no encontró ningún cobro, `cobroStripe` conserva `ignorar` (de esa forma
// dependen el reembolso y la disputa de una cuota, también la de MaKo), el escritor nunca llama a Stripe para escribir, y un cobro
// externo no se reembolsa ni se cancela desde MaKo. El diseño: docs/diseno-venta-externa-stripe.md §1.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const W = sinComentarios(leer('../lib/cobros-webhook.ts'));
const C = sinComentarios(leer('../lib/cobros.ts'));
const cuerpo = (src: string, firma: string): string => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré ${firma}`);
  const j = src.indexOf('\nexport async function ', i + firma.length);
  const k = src.indexOf('\nasync function ', i + firma.length);
  const fin = [j, k].filter((x) => x > 0);
  return src.slice(i, fin.length ? Math.min(...fin) : undefined);
};

test('cobroStripe conserva `ignorar` y SUMA `noEsDeMako` sólo cuando no hay ningún cobro', () => {
  const f = cuerpo(W, 'async function cobroStripe(');
  assert.match(f, /if \(!c\) return \{ ignorar: ignorado\('no es un cobro de MaKo'\), noEsDeMako: true \};/);
  // Las otras salidas (otra cuenta, otro modo) no lo llevan: el cobro existe y es de MaKo.
  assert.equal((f.match(/noEsDeMako/g) ?? []).length, 2, 'noEsDeMako aparece en el tipo y en el return sin cobro, en ningún otro lado');
});

test('la venta externa se alcanza sólo desde la rama de checkout, sin cobro de MaKo y con el pago aprobado', () => {
  const p = cuerpo(W, 'export async function procesarEventoStripe(');
  const llamadas = p.match(/ventaExternaStripe\(/g) ?? [];
  assert.equal(llamadas.length, 1, 'una sola puerta');
  assert.match(p, /if \('ignorar' in b && b\.noEsDeMako && aviso\.accion === 'aprobado'\) return ventaExternaStripe\(ws, key, id, ev, quien\);/);
  const checkout = p.slice(p.indexOf("if (objeto === 'checkout') {"), p.indexOf("if (objeto === 'factura') {"));
  assert.ok(checkout.includes('ventaExternaStripe('), 'la puerta está en la rama de checkout');
  assert.ok(!p.slice(p.indexOf("if (objeto === 'factura') {")).includes('ventaExternaStripe('), 'ni la factura, ni la baja, ni el cargo, ni la disputa');
});

test('la plataforma y la metadata de MaKo se miran ANTES de escribir, y el escritor nunca escribe en Stripe', () => {
  const v = cuerpo(W, 'async function ventaExternaStripe(');
  assert.ok(v.indexOf('esVentaExterna(') > 0 && v.indexOf('esVentaExterna(') < v.indexOf('registrarVentaExterna('));
  assert.match(v, /esPlataforma: ws === plataforma/);
  const r = cuerpo(C, 'export async function registrarVentaExterna(');
  const iPlat = r.indexOf('if (ws === (await wsSuperAdmin()))');
  assert.ok(iPlat > 0 && iPlat < r.indexOf(".insert("), 'la plataforma se corta antes de la primera escritura');
  for (const prohibida of ['crearCheckout', 'programar', 'reembolsar', 'cancelar', 'expirar', 'Stripe(']) {
    assert.ok(!r.includes(prohibida), `registrarVentaExterna llama a «${prohibida}»`);
  }
  // Entra ya pagada: `aplicarPagoAprobado` no la ve nueva y no programa nada en Stripe (el plazo, la reapertura).
  assert.match(leer('../lib/cobros-externos-reglas.ts'), /estado: 'pagado', pagado_at: pagadoAt,/);
  // El reclamo ANTES del lead: un segundo aviso choca con el `cs_` y no crea otro lead.
  assert.ok(r.indexOf(".insert(") < r.indexOf('createLead('), 'el lead se crea después de reclamar la venta');
  assert.match(r, /\.update\(\{ lead_id: leadId \}\)\.eq\('id', cobro\.id\)\.is\('lead_id', null\)/);
});

test('un cobro externo no se reembolsa ni se cancela desde MaKo: se corta antes de tocar Stripe', () => {
  for (const firma of ['export async function reembolsarCobro(', 'export async function cancelarSuscripcionCobro(']) {
    const f = cuerpo(C, firma);
    const corte = f.indexOf('if (esCobroExterno(c)) return { ok: false');
    assert.ok(corte > 0, `${firma} no corta el cobro externo`);
    assert.ok(corte < f.indexOf('credStripe('), `${firma} corta después de leer las claves de Stripe`);
  }
});

test('la compra a Meta va después de asentar la plata, una vez por lead y sin poder tirar', () => {
  const v = cuerpo(W, 'async function ventaExternaStripe(');
  assert.ok(v.indexOf('registrarVentaExterna(') < v.indexOf('avisarCompraAMeta(compra, ev, v.leadId)'));
  const a = cuerpo(W, 'async function avisarCompraAMeta(');
  assert.ok(a.indexOf("from('lead_audit')") > 0 && a.indexOf("from('lead_audit')") < a.indexOf('sendMetaCAPIEvent('), 'mira la marca antes de mandar');
  assert.match(a, /soloPixel: true, actionSource: 'website',/);
  assert.match(a, /\} catch \(e\) \{\n\s*return `no pude avisarle la compra a Meta/);
});
