// =============================================================================
// La cuarta revisión de Cobros (22/10/2026, revision-cobros-2210-cuarta.md): volver a agregar a un lead a la casa que se
// le quitó con pagos no mueve su plata, y la re-sincronización no se corta ni escribe ceros donde no hay pagos.
// =============================================================================
// Medido en producción el 22/10/2026 (sólo lectura): ningún lead está hoy en el caso de M1 (pagos de un funnel que ya no
// es su casa ni un agregado), y ninguno tiene lo cobrado sin filas en `pagos`. Esto cierra la puerta antes de que pase.
// Probado ROMPIÉNDOLO (22/10/2026): cada test dice su rotura y cuántos fallos dio.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { valoresDelLead } from '../lib/variables-del-lead';
import type { Lead } from '../lib/leads';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const F = () => sinComentarios(leer('lib/lead-funnel.ts'));
const cuerpo = (f: string, firma: string) => { const i = f.indexOf(firma); return f.slice(i, f.indexOf('\nexport ', i + 1)); };

// M1 · Roturas: `agregarAProducto` sin el guard: 1 fallo. El lote sin saltear a los de pagos huérfanos: 1 fallo.
test('M1: no se vuelve a agregar a un lead al CRM que fue su casa con pagos (uno o en lote)', () => {
  const uno = cuerpo(F(), 'export async function agregarAProducto(');
  const guard = uno.indexOf('if ((await pagosHuerfanosDe([leadId], funnelId)).size) throw new TienePagosDeEseCrmError(TIENE_PAGOS_DE_ESE_CRM(');
  assert.ok(guard > 0 && guard < uno.indexOf(".from('lead_funnel').upsert("), 'el guard va ANTES de escribir');
  const lote = cuerpo(F(), 'export async function agregarLoteAProducto(');
  assert.match(lote, /fallaron \+= huerfanos\.size;\s*const nuevos = candidatos\.filter\(\(id\) => !huerfanos\.has\(id\)\);/);
  assert.match(F(), /\.from\('pagos'\)\.select\('lead_id'\)\.eq\('funnel_id', funnelId\)\.in\('lead_id', \[\.\.\.leadIds\]\);\s*if \(error\) throw/, 'si no puede revisar, no agrega');
});

// Revisión del 22/10/2026 · Rotura: la reserva de agenda sin atrapar el guard (vuelve a tirar): 1 fallo.
test('una reserva de agenda que el guard frena no se cae: el aviso y las automatizaciones siguen, y queda dicho', () => {
  const a = sinComentarios(leer('lib/agenda-evento-etapa-server.ts'));
  assert.match(a, /try \{\s*await agregarAProducto\(lead\.id, ruta\.funnelId, \{ autor: canal, etapa: ruta\.etapa \}\);\s*\} catch \(e\) \{\s*if \(!\(e instanceof TienePagosDeEseCrmError\)\) throw e;\s*await logLeadEvent\(/);
});

// B1 y B4 · Roturas: un solo try para toda la tanda: 1 fallo. Sincronizar sin mirar si tiene pagos: 1 fallo.
test('B1 y B4: la re-sincronización es de a uno, y sólo a los que tienen pagos', () => {
  const r = cuerpo(F(), 'async function resincronizarCobrado(');
  assert.match(r, /for \(const id of ids\) \{\s*try \{\s*await sincronizarTotalCobrado\(id\);\s*\} catch/);
  assert.match(r, /let q = \(await getTenantDb\(\)\)\.from\('pagos'\)\.select\('lead_id'\)\.in\('lead_id', ids\);/);
});

// B2 · Rotura: `{{lead_cobrado}}` sin el caso «sin venta»: 1 fallo.
test('B2: sin venta en la casa, {{lead_cobrado}} es lo pagado en total (no «US$ 0»)', () => {
  const v = valoresDelLead({ id: 1, nombre: 'X', monto_cierre_usd: null, total_cobrado_usd: 500, total_cobrado_casa_usd: 0 } as unknown as Lead);
  assert.equal(Number(String(v.lead_cobrado).replace(/[^\d]/g, '')), 500, `cobrado: ${v.lead_cobrado}`);
  const conVenta = valoresDelLead({ id: 1, nombre: 'X', monto_cierre_usd: 2000, total_cobrado_usd: 1500, total_cobrado_casa_usd: 1000 } as unknown as Lead);
  assert.equal(Number(String(conVenta.lead_cobrado).replace(/[^\d]/g, '')), 1000, 'con venta, lo de esa venta (la tercera revisión)');
});

// B3 y B5 · Roturas: `listar_leads` sin `nota_cobrado`: 1 fallo. «Solo con dinero cobrado» con el total: 1 fallo.
test('B3 y B5: listar_leads dice por qué va null, y «Solo con dinero cobrado» mira lo cobrado de la venta', () => {
  assert.match(sinComentarios(leer('lib/api-mako/areas/crm.run.ts')), /\.\.\.\(sinCasa \? \{ nota_cobrado: 'No pude leer lo cobrado de la venta/);
  assert.match(sinComentarios(leer('app/crm/actions.ts')), /const cobrado = cobradoDeLaVentaSiHay\(l\) \?\? 0;\s*switch \(f\.dinero\) \{/);
});
