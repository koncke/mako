// =============================================================================
// La fila de un chat (16/10/2026): en qué está trabajando, y el «Nuevo chat» de arriba
// =============================================================================
// Martín: «Cuando un chat dice "Trabajando..." debo saber en qué está trabajando» y «Falta la opción de "Nuevo chat" tipo
// placeholder arriba de todos los chats». Lo que se fija: que el segundo renglón dice lo ÚLTIMO en curso (no un pedido
// terminado ni uno sin empezar), y que el comando que abre un chat nuevo es el de esa cuenta, con el nombre bien citado
// para PowerShell (una comilla en el nombre no corta el comando).
//
// ⚠️ Probado ROMPIÉNDOLO (16/10/2026), contra la base en verde de 2 pases:
//   · \`enQueTrabaja\` con el PRIMERO en curso y no el último → 1 fallo («en qué trabaja»);
//   · \`comandoNuevoChat\` sin doblar la comilla → 1 fallo («el comando»).
//   Restaurado de memoria: 2 pases.

import test from 'node:test';
import assert from 'node:assert/strict';
import { enQueTrabaja, type LineaChat, type TrabajoP } from '../lib/centro-chats';
import { comandoNuevoChat } from '../lib/runner';

const trabajo = (id: string, texto: string, estado: TrabajoP['estado'], minuto: number): LineaChat => ({
  tipo: 'trabajo', instante: Date.parse('2026-10-16T12:00:00Z') + minuto * 60_000,
  trabajo: { id, destino: 'local_x', destino_titulo: 'CRM', destino_cuenta: 'claude3', created_at: '2026-10-16T12:00:00Z', texto, estado, motivo: null, entregado_at: null, cerrado_at: null, cierre: null },
});

test('en qué trabaja: el título de lo ÚLTIMO en curso, y nada si no hay nada en curso', () => {
  assert.equal(enQueTrabaja([
    trabajo('a', 'Arreglá la ficha del lead', 'hecho', 1),
    trabajo('b', 'Que el tablero permita arrastrar varias tarjetas a la vez', 'entregado', 2),
    trabajo('c', 'Exportar a CSV con el filtro', 'entregado', 5),
    trabajo('d', 'Revisar el filtro por etapa', 'escrito', 9),
  ]), 'Exportar a CSV con el filtro', 'el entregado más nuevo: el escrito todavía no le llegó');
  assert.equal(enQueTrabaja([trabajo('a', 'Algo', 'hecho', 1)]), null);
  assert.equal(enQueTrabaja([]), null);
  const largo = enQueTrabaja([trabajo('a', 'Una tarea con un título larguísimo que no entra en el segundo renglón de la fila del chat', 'entregado', 1)]);
  assert.ok(largo && largo.length <= 57 && largo.endsWith('…'), 'corto, con sus puntos');
});

test('el comando de «Nuevo chat»: la función del perfil de esa cuenta, con el nombre citado para PowerShell', () => {
  assert.equal(comandoNuevoChat('claude2', 'CRM › Funnels'), "claude2 -n 'CRM › Funnels'");
  assert.equal(comandoNuevoChat('claude3', "  Martín's Plan  "), "claude3 -n 'Martín''s Plan'", 'la comilla se dobla: no corta el comando');
  assert.equal(comandoNuevoChat('claude1', '$HOME; rm x'), "claude1 -n '$HOME; rm x'", 'entre comillas simples nada se expande ni se ejecuta');
});
