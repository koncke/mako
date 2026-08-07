// Deshacer un movimiento tiene que dejar la MEMORIA del historial coherente.
//
// El bug: "Restaurar" (revertMoveAction) devolvía la etapa con
// setBoardStageOverride/updateLead —que no auditan— y borraba la línea del
// movimiento, pero dejaba `leads.etapa_vista` apuntando a la etapa deshecha. En
// la carga siguiente de /crm o /general, registrarEtapasDerivadas veía
// `vista !== etapa` y escribía «Etapa: <deshecha> → <restaurada>» firmada por
// MaKo: el deshacer reaparecía como un movimiento del sistema.
//
// Se prueba con las funciones PURAS del módulo (nada toca Supabase). Correr: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Module from 'node:module';
import type { LeadConEtapa } from '../lib/etapa-historial';

// lib/etapa-historial.ts es `server-only` (escribe en lead_audit) y ese paquete
// TIRA al importarse fuera de un Server Component. Acá solo se llaman funciones
// puras, así que se neutraliza el marcador antes de cargar el módulo.
type Cargador = (pedido: string, padre: unknown, esMain: boolean) => unknown;
const M = Module as unknown as { _load: Cargador };
const cargarOriginal = M._load;
M._load = ((pedido: string, padre: unknown, esMain: boolean) =>
  pedido === 'server-only' ? {} : Reflect.apply(cargarOriginal, Module, [pedido, padre, esMain])) as Cargador;

const historial = () => import('../lib/etapa-historial');

/** Lead mínimo (todo en null salvo lo que el caso necesita). */
const L = (p: Partial<LeadConEtapa>): LeadConEtapa => ({
  id: 1395, estado_lead: 'abierto', pipeline_stage: null, fecha_agenda: null,
  fecha_junta_1: null, fecha_junta_2: null, asistio_j1: null, asistio_j2: null,
  nutricion_realizada: false, etapa_vista: null, ...p,
});

test('override deshecho: sin alinear, la próxima pasada inventa una línea', async () => {
  const { etapaVistaPendiente, cambioDeEtapa } = await historial();
  // Alguien arrastró el lead de Agenda a Perdido (etapa_vista quedó en 'perdido')
  // y después le dio "Restaurar": el override volvió a 'agenda' y la línea se borró.
  const restaurado = L({ pipeline_stage: 'agenda', fecha_agenda: '2026-07-01', etapa_vista: 'perdido' });
  assert.equal(etapaVistaPendiente(restaurado), 'agenda', 'la memoria quedó en la etapa deshecha');
  assert.deepEqual(cambioDeEtapa(restaurado), { desde: 'perdido', hacia: 'agenda' }, 'esta es la línea fantasma');
});

test('override deshecho: con etapa_vista alineada NO hay nada que registrar', async () => {
  const { etapaVistaPendiente, cambioDeEtapa, registrarEtapasDerivadas } = await historial();
  const alineado = L({ pipeline_stage: 'agenda', fecha_agenda: '2026-07-01', etapa_vista: 'agenda' });
  assert.equal(etapaVistaPendiente(alineado), null);
  assert.equal(cambioDeEtapa(alineado), null);
  // La pasada masiva corta ANTES de pedir la base: 0 queries, 0 líneas.
  assert.deepEqual(await registrarEtapasDerivadas([alineado]), { registrados: 0, lineas: 0 });
});

test('deshacer sin fila "Etapa" también desalinea: la etapa es DERIVADA', async () => {
  const { etapaVistaPendiente } = await historial();
  // Revertir 'Asistió R1' (asistio_j1 false → null) no toca pipeline_stage, pero
  // saca al lead de No Show R1 igual. Por eso la alineación no puede depender de
  // que el grupo revertido traiga una fila 'Etapa'.
  const revertido = L({ asistio_j1: null, fecha_junta_1: '2026-07-01', etapa_vista: 'noshow_r1' });
  assert.equal(etapaVistaPendiente(revertido), 'agenda');
  // Y revertir 'Estado' (perdido → abierto) idem.
  const reabierto = L({ estado_lead: 'abierto', fecha_agenda: '2026-07-01', etapa_vista: 'perdido' });
  assert.equal(etapaVistaPendiente(reabierto), 'agenda');
});

test('alinear es idempotente y no toca al lead que nunca se registró', async () => {
  const { etapaVistaPendiente, alinearEtapaVista } = await historial();
  // Ya alineado → true sin escribir (si escribiera, acá reventaría por falta de DB).
  assert.equal(await alinearEtapaVista(L({ pipeline_stage: 'ganado', etapa_vista: 'ganado' })), true);
  // Sin lead (no se pudo releer) → false, no rompe el deshacer.
  assert.equal(await alinearEtapaVista(null), false);
  // etapa_vista en null es "nunca registrado": la pasada lo siembra sin línea, y
  // acá se lo trata igual que a cualquier desalineado (fijar la etapa de hoy).
  assert.equal(etapaVistaPendiente(L({ pipeline_stage: 'agenda', etapa_vista: null })), 'agenda');
});

test('CABLEADO: revertMoveAction alinea etapa_vista antes de borrar el rastro', () => {
  // El fix es inerte si la acción no lo llama: revertMoveAction escribe por fuera
  // de logLeadChanges, así que nada más va a alinear la columna por ella.
  // Normalizado a \n: en Windows el archivo viene con CRLF y los cortes por salto
  // de línea no encontrarían el final de la acción.
  const src = readFileSync(new URL('../app/crm/actions.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const cuerpo = src.slice(src.indexOf('export async function revertMoveAction'));
  const fin = cuerpo.indexOf('\nexport ', 1);
  const accion = fin === -1 ? cuerpo : cuerpo.slice(0, fin);
  assert.ok(accion.includes('alinearEtapaVista('), 'revertMoveAction dejó de alinear etapa_vista');
  assert.ok(
    accion.indexOf('alinearEtapaVista(') < accion.indexOf(".from('lead_audit').delete()"),
    'alinear va ANTES del borrado: si el borrado falla, la memoria igual quedó al día',
  );
});
