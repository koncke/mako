// =============================================================================
// La secuencia de email atada a un CRM (4/11/2026, punto 4 de la campaña de email de Mauricio)
// =============================================================================
// Sin el CRM, el CRON por etapa mira sólo la CASA de cada lead (`leadsDeCohorte`, lib/nutricion.ts): los sumados a
// «Email Marketing» con `agregar_en_bloque_a_crm` no entraban nunca, con la secuencia activa y sin un error. Ahora
// `crear_secuencia_email` y `editar_meta_secuencia_email` aceptan `funnelId` y lo guardan por la puerta de los CRON.
//
// Corre los runners REALES y el barrido del motor (`planificarInscripciones`, que no escribe) sobre una base en memoria
// (tests/_email-campana-hijo.ts, escenario «secuencia»).
//
// Probado ROMPIÉNDOLO (4/11/2026), sobre una base de 6 / 0: `crearEmailSecuencia` ignorando `funnelId` → 3 / 3; la edición
// sin el chequeo de «activa» para el CRM → 5 / 1; `fijarCrmDelDisparador` sin el `funnel_id` → 3 / 3. Restaurado, 6 / 0.
//
// Correr: node --import tsx --test tests/email-campana-secuencia.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_email-campana-hijo.ts'), 'secuencia'], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 180_000,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;

test('un CRM de otro negocio o una columna que no es suya no se proponen', () => {
  assert.match(R.crmAjeno.error, /no es de este negocio/);
  assert.match(R.columnaQueNoEs.error, /no tiene la columna/);
  assert.ok(R.columnaQueNoEs.disponibles.some((d: { key: string }) => d.key === 'em_entrada'), 'dice cuáles hay');
});

test('con funnelId y sin trigger: «está en la columna de entrada de ese CRM»', () => {
  assert.deepEqual(R.prep.payload, { nombre: 'Campaña 14', etapa: 'em_entrada', trigger: 'etapa_actual', funnelId: 20 });
  assert.match(R.prep.resumen, /«Email Marketing» › «Entrada»/);
  assert.deepEqual(R.fila, { trigger_tipo: 'etapa_actual', etapa: 'em_entrada', funnel_id: 20, activa: false });
});

test('atada al CRM, el barrido inscribe a los AGREGADOS abiertos de esa columna (y a nadie más)', () => {
  // 601 (abierto, sumado) sí; 602 está en «Abrió»; 603 es ganado (no se sumó); 605 es perdido: el motor sólo inscribe abiertos.
  assert.deepEqual(R.plan, [601]);
});

test('sin el CRM, los agregados no entran: es justo el agujero que esto cierra', () => {
  assert.equal(R.ejecSinCrm.ok, true);
  assert.equal(R.filaSinCrm.funnel_id, null);
  assert.deepEqual(R.planSinCrm, []);
});

test('activa, no se le cambia el CRM (es cambiar a quién le escribe); pausada, sí, y vuelve a atarse', () => {
  assert.match(R.cambiarCrmActiva.error, /ACTIVA/);
  assert.equal(R.ejecVolver.ok, true);
  assert.deepEqual(R.filaVuelta, { funnel_id: 20, etapa: 'em_entrada' });
});

test('nada salió a la red', () => {
  assert.deepEqual(R.otros, []);
});
