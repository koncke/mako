// =============================================================================
// Si MaKo le dice a la persona que algo no se pudo, queda un ticket (27/10/2026) — lo que escribe en la base
// =============================================================================
// Con `conTicketsDeMaKo`, `ticketDeNoPude`, `cerrarSiVolvio` y `crearTicket` REALES contra una base de mentira
// (tests/_no-pude-hijo.ts). Fija:
//   g. tres «no pude» iguales en la misma conversación son UN ticket y dos notas «Volvió a pasar»; la línea sale una vez;
//   i. en el negocio con la regla de aprobación (ws 11), un automático NO entra por la regla: sin `regla` y sin Runner;
//   j. el proveedor con un error no va al arreglo automático, es uno por negocio (otra superficie suma al mismo) y se cierra
//      solo; si vuelve a pasar después de cerrado, es uno nuevo;
//   h. los automáticos tienen su tope (6 por negocio y día) y no le gastan el suyo a la persona;
//   y una negativa legítima (una regla de MaKo) no escribe nada.
//
// Probado rompiéndolo (27/10/2026): al pie del archivo.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { TOPE_AUTOMATICOS_POR_DIA } from '../lib/tickets-reglas';

const RAIZ = join(import.meta.dirname, '..');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_no-pude-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, timeout: 120_000, stdio: ['ignore', 'pipe', 'ignore'],
});
type Sale = { texto: string; causa: string | null; ticket: { id: number; nuevo: boolean } | null; linea: string | null; lineaCorta: string | null };
type Tk = { id: number; ref: string; titulo: string; tipo: string; estado: string; despacho: string | null; regla: string | null; causa: string | null };
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as {
  error?: string; g1: Sale; g2: Sale; g3: Sale; gTickets: Tk[]; gNotas: number; regla: Sale;
  j1: { id: number; nuevo: boolean }; j2: { id: number; nuevo: boolean }; jCerrado: number | null; j3: { id: number; nuevo: boolean }; jTickets: Tk[];
  hAutomaticos: number; hAMano: boolean;
};

test('g. tres «no pude» en la misma conversación son UN ticket; la línea la escribe el código y sale una vez', () => {
  assert.equal(R.error, undefined, String(R.error));
  assert.equal(R.g1.texto, 'No pude crear la tarea: el plan no respondió.', 'la marca le llegó a la persona');
  assert.equal(R.g1.causa, 'texto');
  assert.match(String(R.g1.linea), /^Quedó el ticket #\d+ para el equipo de MaKo\.$/);
  assert.equal(R.gTickets.length, 1);
  assert.equal(R.g2.ticket?.id, R.g1.ticket?.id);
  assert.equal(R.g2.linea, null, 'repetido en la misma conversación: nada');
  assert.equal(R.gNotas, 2, 'lo que volvió a pasar no se anotó en el ticket');
  assert.equal(R.gTickets[0].titulo, 'MaKo no pudo hacer lo que le pidieron, en el Ops Center', 'el título no lo arma el código');
  assert.ok(R.gTickets[0].ref.startsWith('np:11:ops-center:'));
});

test('i. en el negocio con la regla de aprobación, un automático no entra por la regla ni va al Runner', () => {
  assert.equal(R.gTickets[0].regla, null, 'un automático entró por la regla de aprobación');
  assert.equal(R.gTickets[0].despacho, null, 'un «no pude» de texto fue solo al Runner');
});

test('j. el proveedor: no va al arreglo automático, uno por negocio, se cierra solo y si vuelve es otro', () => {
  assert.ok(R.j1?.nuevo);
  assert.equal(R.j2.id, R.j1.id, 'otra superficie del mismo negocio abrió otro ticket del proveedor');
  assert.equal(R.jCerrado, R.j1.id, 'no se cerró solo');
  assert.ok(R.j3.nuevo && R.j3.id !== R.j1.id, 'volvió a pasar después de cerrado y no abrió uno nuevo');
  for (const t of R.jTickets) assert.equal(t.despacho, null, `el ticket del proveedor #${t.id} fue al Runner`);
  assert.deepEqual(R.jTickets.map((t) => t.estado), ['resuelto', 'esperando_decision']);
});

test('h. los automáticos tienen su tope y no le gastan el suyo a la persona', () => {
  assert.equal(TOPE_AUTOMATICOS_POR_DIA, 6);
  assert.equal(R.hAutomaticos, 3, `con 3 automáticos ya abiertos se abrieron ${R.hAutomaticos} más (el tope es 6)`);
  assert.equal(R.hAMano, true, 'la persona no pudo levantar uno a mano');
});

test('una negativa legítima (una regla de MaKo) no escribe nada, y la marca igual sale del texto', () => {
  assert.equal(R.regla.texto, 'Eso lo confirmas tú.');
  assert.equal(R.regla.causa, null);
  assert.equal(R.regla.ticket, null);
});

// ── Probado rompiéndolo (27/10/2026) ─────────────────────────────────────────────────────────────────────────────────
// Cada cambio a mano, corrido y restaurado (sha1 igual):
//   1. `clasificar` sin la rama de `automatico`                          → rojo el i.
//   2. el tope de la persona contando las `ref` del sistema               → rojo el h.
//   3. `crearTicket` sin buscar el último abierto de un automático        → rojo el g.
//   4. `cerrarAutomatico` sin cerrar                                       → rojo el j.
