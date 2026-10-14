import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filaAOferta, esModeloOferta } from '../lib/oferta-modelo';

/**
 * La OFERTA de un lead en su tab Pagos (Martín, 13/10/2026, Pagos punto 1): un desplegable para
 * asignarla, «Nueva oferta» arriba con nombre, modelo y ticket, y «Analizar oferta» que lleva a Offer.
 *
 * Verificado rompiéndolo (base 5/0): asignar sin buscar la oferta en las del workspace, 1 fallo;
 * crear sin el candado de admin, 1 fallo; «Nueva oferta» al final del desplegable, 1 fallo; la ruta
 * sin el desplegable, 1 fallo; `filaAOferta` sin leer el modelo, 1 fallo.
 */

const leer = (r: string) => readFileSync(new URL(r, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const ACC = sinComentarios(leer('../app/crm/oferta-lead-actions.ts'));
const UI = sinComentarios(leer('../app/crm/lead-view/OfertaDelLead.tsx'));
const cuerpo = (src: string, firma: string) => { const i = src.indexOf(firma); assert.ok(i >= 0, `no encontré ${firma}`); const f = src.indexOf('\nexport ', i + 10); return src.slice(i, f < 0 ? undefined : f); };

test('asignar busca la oferta entre las del workspace: la FK sólo mira que exista', () => {
  const fn = cuerpo(ACC, 'export async function asignarOfertaLeadAction');
  assert.match(fn, /const o = \(await listarOfertas\(\)\)\.find\(\(x\) => x\.id === ofertaId\);\s*if \(!o\) return \{ ok: false, error: 'Esa oferta no existe\.' \};/);
});

test('crear es del admin, pide nombre y modelo, y la liga al CRM del lead', () => {
  const fn = cuerpo(ACC, 'export async function crearOfertaDesdeLeadAction');
  assert.match(fn, /if \(\(await getRolWsEfectivo\(\)\) !== 'admin'\) return/);
  assert.match(fn, /if \(!esModeloOferta\(modelo\)\) return/);
  assert.match(fn, /await ligarOfertaAFunnel\(funnelId, id, false\)/, 'sin ligarla al CRM no aparece en Offer');
});

test('«Nueva oferta» va arriba, y «Analizar oferta» lleva a Offer con la oferta y el CRM', () => {
  const i = UI.indexOf('const opciones: DropdownOption[] = [');
  const lista = UI.slice(i, UI.indexOf('];', i));
  assert.ok(lista.indexOf("label: 'Nueva oferta'") > 0 && lista.indexOf("label: 'Nueva oferta'") < lista.indexOf('(ofertas ?? []).map'), '«Nueva oferta» tiene que ir antes que las ofertas');
  assert.match(UI, /router\.push\(`\/offer\?\$\{qs\.toString\(\)\}`\)/);
  assert.match(UI, /new URLSearchParams\(\{ oferta: String\(elegida\.id\) \}\)/);
});

test('las DOS puertas de la ficha muestran la oferta antes del deal', () => {
  for (const p of ['../app/crm/LeadSheet.tsx', '../app/crm/[id]/page.tsx']) {
    const src = sinComentarios(leer(p));
    const o = src.indexOf('<OfertaDelLead leadId={lead.id}');
    const d = src.indexOf('<DealDetailsCard lead={lead}');
    assert.ok(o > 0 && d > o, `${p}: la oferta no está arriba del deal`);
  }
});

test('el modelo de cobro se lee de la fila, y lo desconocido no se inventa', () => {
  assert.equal(filaAOferta({ id: 1, nombre: 'Mentoría', modelo: 'suscripcion' }).modelo, 'suscripcion');
  assert.equal(filaAOferta({ id: 1, nombre: 'Mentoría', modelo: 'mensualidad' }).modelo, null);
  assert.equal(filaAOferta({ id: 1, nombre: 'Mentoría' }).modelo, null);
  assert.ok(esModeloOferta('unico') && !esModeloOferta('cuotas'));
});
