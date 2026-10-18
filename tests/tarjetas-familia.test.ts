// =============================================================================
// UNA familia de tarjetas en CRM, Clients y Plan, en computadora y teléfono (17/10/2026)
// =============================================================================
// Martín, 17/10 22:40 (punto 8): «No me gustan las cards y cómo se ven... Quiero que tengan coherencia... si hacés esto
// del CRM también debe tener cierto sentido en diseño los otros kanban, como el PLAN y Clients». Prototipo:
// docs/prototipos/coherencia-1710.html. Lo puro está en tests/tarjeta-kanban.test.ts; acá se fija el CABLEADO y la
// regla del aviso de un cliente, EJECUTÁNDOLA:
//   1. el tablero del CRM dibuja la tarjeta de la familia SIN perder el arrastre ni el clic derecho, y «Mover a…» de la
//      ficha rápida va por `handleDrop` (el mismo camino que soltar la tarjeta en la columna);
//   2. el teléfono del CRM: tocar abre la ficha rápida en su SheetM, y «Mover a…» le pide a KanbanM SU sheet (no otro);
//   3. Clients: la barra de la etapa y el aviso, el más urgente primero (sin entrar al curso, días sin moverse);
//   4. Plan: el círculo de prioridad completa la tarea, en la computadora y en el teléfono;
//   5. KanbanM: las etapas con su NOMBRE y contador (pestañas píldora), y el pedido de afuera abre su «Mover a…».
//
// PROBADO ROMPIÉNDOLO (17/10/2026), con el archivo en 5 / 0, una rotura por vez y restaurada:
//   · la ficha rápida del CRM moviendo sin `handleDrop`                              → 4 / 1
//   · el teléfono abriendo un «Mover a…» propio en vez de `pedirMover`               → 4 / 1
//   · el aviso de un cliente sin mirar «sin entrar al curso»                         → 4 / 1
//   · el círculo del Plan sin completar (`board.toggleDone`)                         → 4 / 1
//   · KanbanM sin el nombre de la etapa en la pestaña                                → 4 / 1
// Correr: node --import tsx --test tests/tarjetas-familia.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { avanceDeCliente } from '../app/customer-success/aviso-tarjeta';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('CRM en la computadora: la tarjeta de la familia con el arrastre y el clic derecho, y «Mover a…» por handleDrop', () => {
  const b = leer('app/crm/CrmBoard.tsx');
  assert.match(b, /<TarjetaPersona\s+data-leadcard\s+\/\*[^*]*\*\/\s+data-lead-id=\{l\.id\}/, 'la tarjeta perdió el dato del clic derecho');
  const t = b.slice(b.indexOf('<TarjetaPersona'), b.indexOf('<TarjetaPersona') + 4000);
  assert.match(t, /draggable\s+onDragStart=/, 'la tarjeta dejó de arrastrarse');
  assert.match(t, /onDragEnd=\{limpiarArrastreTarjeta\}/);
  assert.match(t, /pildora=\{\{ texto: 'Ver info'/);
  assert.match(t, /className="mk-sel-tarjeta"/, 'sin la casilla de selección');
  assert.match(b, /onMover=\{\(key\) => \{ cerrar\(\); idASoltar\.current = l\.id; handleDrop\(key\); \}\}/, '«Mover a…» tiene que ir por el mismo camino que soltar');
  assert.match(b, /<TarjetaDestacada ancha sobre="Próximo"/);
});

test('CRM en el teléfono: tocar abre la ficha rápida y «Mover a…» usa el sheet de KanbanM', () => {
  const m = leer('app/m/crm/TableroCrm.tsx');
  assert.match(m, /onTocar=\{\(id\) => setRapida\(/);
  assert.match(m, /pedirMover=\{pedirMover\}/);
  assert.match(m, /setPedirMover\(\(p\) => \(\{ id, vez: \(p\?\.vez \?\? 0\) \+ 1 \}\)\)/, 'el «Mover a…» de la ficha rápida tiene que pedirle a KanbanM el suyo');
  assert.doesNotMatch(m, /moverEtapaAction\(Number\(r\.id\)/, 'la ficha rápida no mueve por su cuenta: duplicaría el toast y el deshacer');
  const k = leer('app/m/_ui/KanbanM.tsx');
  assert.match(k, /useEffect\(\(\) => \{ if \(p\.pedirMover\) setMoviendo\(p\.pedirMover\.id\); \}, \[vezPedida\]\);/);
});

test('Clients: la barra de la etapa y el aviso, el más urgente primero', () => {
  const ahora = Date.parse('2026-10-17T12:00:00Z');
  const base = { etapa: 1, etapas: 4, ahoraMs: ahora };
  const sinEntrar = avanceDeCliente({ ...base, enEtapa: { frase: 'hace 30 días', trabado: true }, acceso: { existe: true, revocado: false, ingresos: 0, ultimoIngresoAt: null, invitacionEnviadaAt: '2026-10-01T00:00:00Z' } });
  assert.equal(sinEntrar.pct, 50);
  assert.deepEqual(sinEntrar.aviso, { texto: 'Sin entrar al curso', tono: 'mal' }, 'nunca entró: le gana a los días sin moverse');
  const viejo = avanceDeCliente({ ...base, enEtapa: null, acceso: { existe: true, revocado: false, ingresos: 3, ultimoIngresoAt: '2026-09-20T12:00:00Z' } });
  assert.deepEqual(viejo.aviso, { texto: 'Sin entrar · 27 d', tono: 'riesgo' });
  const trabado = avanceDeCliente({ ...base, enEtapa: { frase: 'hace 21 días', trabado: true }, acceso: null });
  assert.deepEqual(trabado.aviso, { texto: '21 días sin moverse', tono: 'mal' });
  const bien = avanceDeCliente({ ...base, enEtapa: { frase: 'hace 3 días', trabado: false }, acceso: { existe: true, revocado: false, ingresos: 2, ultimoIngresoAt: '2026-10-15T12:00:00Z' } });
  assert.equal(bien.aviso, null);
  assert.equal(bien.texto, 'Etapa 2 de 4 · hace 3 días');
  assert.match(leer('app/customer-success/KanbanEntrega.tsx'), /avance=\{avanceDeCliente\(\{ etapa: iCol, etapas: visibles\.length,/);
  assert.match(leer('app/m/cs/CustomerSuccessM.tsx'), /avanceDeCliente\(\{ etapa: iCol, etapas: grupos\.length,/, 'el teléfono tiene que usar la MISMA regla');
});

test('Plan: el círculo de prioridad completa la tarea, en la computadora y en el teléfono', () => {
  const b = leer('app/plan/board/BoardShell.tsx');
  const card = b.slice(b.indexOf('function CardTile('), b.indexOf('function CardTile(') + 12000);
  assert.match(card, /className=\{`tk-pr tk-pr--\$\{prio\}`\}[\s\S]{0,200}onClick=\{\(e\) => \{ e\.stopPropagation\(\); board\.toggleDone\(t\.id\); \}\}/);
  assert.match(leer('app/m/plan/ListaPlan.tsx'), /if \(!hecha\) completar\(it, 'check'\);/, 'el teléfono completa por el mismo camino que el sheet');
});

test('KanbanM: las etapas con su nombre y contador', () => {
  const k = leer('app/m/_ui/KanbanM.tsx');
  assert.match(k, /<span>\{c\.titulo\}<\/span>\s*<b key=/, 'la pestaña tiene que decir qué etapa es');
  assert.doesNotMatch(k, /gridTemplateColumns: `repeat\(\$\{cols\.length\}/, 'volvieron las rayitas en grilla');
});
