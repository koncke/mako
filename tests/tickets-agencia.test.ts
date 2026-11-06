// =============================================================================
// Los tickets de quien administra una agencia suben un escalón (5/11/2026), sin quitarle el lugar a un cliente con algo roto.
// =============================================================================
// Martín le dijo a Código Inmobiliario (agencia, negocio 13) en la llamada del 30/10 que sus tickets tienen prioridad. Ejecuta el
// triage (`clasificar`, lib/tickets-reglas.ts), lo que se guarda (`leerTriage`) y el orden del mazo (`ordenDelMazo`).
// Probado rompiéndolo (5/11/2026, base 5/0):
//   · `subirPorAgencia` que no sube nada                                 → 2/3 (el 1, el 3 y el 4);
//   · que suba también lo de un tercero o lo automático                  → 4/1 (el 2);
//   · el mazo sin poner detrás a los que subieron                        → 4/1 (el 4);
//   · `leerTriage` que pierde la marca                                   → 4/1 (el 3).
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { clasificar, leerTriage, subirPorAgencia, type EntradaTriage, type Triage } from '../lib/tickets-reglas';
import { ordenDelMazo } from '../app/tickets/bandeja/mazo-reglas';
import type { FilaTicket } from '../lib/tickets-db';

const pedido: EntradaTriage = { tipoDeclarado: 'pedido', declaradoPor: 'persona', titulo: 'Quiero que el CRM muestre la zona', descripcion: 'Se podría agregar la zona de cada propiedad.', contexto: {} };
const pregunta: EntradaTriage = { tipoDeclarado: 'pregunta', declaradoPor: 'persona', titulo: '¿Dónde veo las llamadas?', descripcion: '', contexto: {} };
const roto: EntradaTriage = { tipoDeclarado: 'bug', declaradoPor: 'persona', titulo: 'Dejó de andar el envío', descripcion: 'Antes andaba y ahora no sale nada.', contexto: { error: 'HTTP 500' } };
const urgente: EntradaTriage = { tipoDeclarado: 'bug', declaradoPor: 'persona', titulo: 'No puedo entrar', descripcion: 'No puedo trabajar.', contexto: {} };

test('1 · lo de una agencia sube un escalón (baja → media → alta), nunca a urgente; lo que no subió no lleva marca', () => {
  assert.deepEqual([subirPorAgencia('baja'), subirPorAgencia('media'), subirPorAgencia('alta'), subirPorAgencia('urgente')], ['media', 'alta', 'alta', 'urgente']);
  const p = clasificar(pedido, { deAgencia: true });
  assert.equal(clasificar(pedido).prioridad, 'media');
  assert.equal(p.prioridad, 'alta');
  assert.equal(p.agencia, true);
  assert.ok(p.porque.some((x) => /agencia/.test(x)), 'el porqué lo dice');
  assert.equal(clasificar(pregunta, { deAgencia: true }).prioridad, 'media');
  const r = clasificar(roto, { deAgencia: true });
  assert.deepEqual([r.prioridad, r.agencia], ['alta', undefined], 'algo roto ya es alta: no sube ni se marca');
  const u = clasificar(urgente, { deAgencia: true });
  assert.deepEqual([u.prioridad, u.agencia], ['urgente', undefined]);
});

test('2 · lo de un tercero o lo que abrió MaKo solo no sube: no lo pidió quien administra la agencia', () => {
  assert.equal(clasificar(pedido, { deAgencia: true, deTercero: true }).prioridad, 'media');
  assert.equal(clasificar(pedido, { deAgencia: true, automatico: true }).prioridad, 'media');
});

test('3 · la marca se guarda y se vuelve a leer; un valor que no es true no la inventa', () => {
  const t = clasificar(pedido, { deAgencia: true });
  assert.equal(leerTriage(JSON.parse(JSON.stringify(t)))?.agencia, true);
  assert.equal(leerTriage({ ...t, agencia: 'sí' })?.agencia, undefined);
  assert.equal(leerTriage(clasificar(pedido))?.agencia, undefined);
});

function fila(id: number, prioridad: FilaTicket['prioridad'], minutosAtras: number, triage: Triage | null): FilaTicket {
  const creado = new Date(Date.parse('2026-11-05T12:00:00Z') - minutosAtras * 60_000).toISOString();
  const f: FilaTicket = {
    id, created_at: creado, updated_at: creado, workspace_id: 3, usuario_id: 1, usuario_email: 'alguien@prueba.test', usuario_nombre: 'Alguien',
    rol: 'admin', plan: 'Pro', tipo: 'pedido', tipo_manual: false, titulo: `Ticket ${id}`, descripcion: '', canal: 'formulario', contexto: {},
    estado: 'esperando_decision', prioridad, triage, decision: null, decision_nota: null, decidido_at: null, duplicado_de: null, respuesta: null,
    despacho: null, pedido_id: null, despachado_at: null, aviso_estado: null, aviso_intentos: 0, aviso_motivo: null, aviso_at: null,
    arreglado_at: null, arreglo_nota: null, resuelto_at: null, avisado_at: null,
  };
  return f;
}

test('4 · el mazo: lo que subió por la agencia va detrás de un cliente con algo roto, y delante de lo que no subió', () => {
  const deAgencia = fila(1, 'alta', 600, clasificar(pedido, { deAgencia: true })); // esperó más, pero subió
  const clienteRoto = fila(2, 'alta', 10, clasificar(roto));
  const clienteMedia = fila(3, 'media', 900, clasificar(pedido));
  const urgenteCliente = fila(4, 'urgente', 1, clasificar(urgente));
  assert.deepEqual(ordenDelMazo([deAgencia, clienteRoto, clienteMedia, urgenteCliente]), [4, 2, 1, 3]);
});

test('5 · sin agencia, el orden de siempre: prioridad y después el que espera hace más', () => {
  assert.deepEqual(ordenDelMazo([fila(1, 'media', 10, null), fila(2, 'media', 600, null), fila(3, 'alta', 1, null)]), [3, 2, 1]);
});
