// =============================================================================
// Pídeselo a MaKo en Automations: una orden sobre el FLUJO abierto no se va a otra tab (22/10/2026, el arnés del Cerebro)
// =============================================================================
// «Si responde, movelo a la etapa Respondió del CRM «…» y avisame por WhatsApp», con una automatización abierta, salía en dos
// burbujas «ir» (CRM y WhatsApp) y MaKo no hacía nada: la IA de pedidos lo partió en área crm + área whatsapp, y lo que
// etiqueta la IA es «fuerte» (lib/mako-pedidos.ts, `decidir`). Se prueba con la respuesta de la IA GRABADA (sus pedidos).
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolverPedidos, esOrdenDelFlujo, type ContextoPedidos, type ObjetoChat, type PedidoCrudo } from '../lib/mako-pedidos';

const ABIERTA: ObjetoChat = { id: '535', nombre: '🧪 Prueba chats · tres WhatsApp', tocadoAt: '2026-10-22T10:00:00Z' };
const ctx: ContextoPedidos = { tab: 'chatbot', actual: ABIERTA, objetos: [ABIERTA], operaciones: [], ordenar: (ops) => [...ops], ws: 3 };
const PEDIDO = 'Si responde, movelo a la etapa Respondió del CRM «🧪 Prueba chats 22/10 · Automations» y avisame por WhatsApp';

// rotura (sacar la orden del flujo de `decidir`) → 1 rojo de 2 (éste).
test('con la respuesta GRABADA de la IA de pedidos (crm + whatsapp), la orden sobre el flujo va a la automatización abierta', () => {
  const grabada: PedidoCrudo[] = [
    { texto: 'Si responde, movelo a la etapa Respondió del CRM «🧪 Prueba chats 22/10 · Automations»', verbo: 'editar', area: 'crm', referencia: null, etiqueta: 'ia' },
    { texto: 'avisame por WhatsApp', verbo: 'editar', area: 'whatsapp', referencia: null, etiqueta: 'ia' },
  ];
  const r = resolverPedidos(grabada, ctx, { origen: 'ia', texto: PEDIDO });
  assert.ok(r.pedidos.length > 0);
  for (const p of r.pedidos) assert.equal(p.sobre, 'actual', JSON.stringify(p));
  // Lo que NO es una orden sobre el flujo sigue yendo a su tab, como siempre.
  const otra = resolverPedidos([{ texto: 'Créame una landing para el Sprint', verbo: 'crear', area: 'landing', referencia: null, etiqueta: 'ia' }], ctx, { origen: 'ia', texto: 'Créame una landing para el Sprint' });
  assert.equal(otra.pedidos[0].sobre, 'otra-tab');
});

test('qué es una orden sobre el flujo', () => {
  for (const t of ['Si responde, movelo a Respondió', 'cuando entra a la etapa Prospección activa, mandale el audio', 'avísame por WhatsApp', 'muévelo a Ganado', 'que arranque cuando agenda', 'esperá 2 días']) {
    assert.equal(esOrdenDelFlujo(t), true, t);
  }
  for (const t of ['Llévame al CRM', 'Créame una landing', 'cambiá el precio del producto', 'Pasame el reporte de ventas']) {
    assert.equal(esOrdenDelFlujo(t), false, t);
  }
});
