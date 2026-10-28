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
  revision: {
    yaRegistrado: Sale; yaRegistradoTickets: number; dos1: Sale; dos2: Sale; regla: Sale; confOtra: number | null; confMisma: number | null; confId: number | null;
    confDespacho: string | null; cerroProv: number | null; provId: number | null; textoEstado: string | null; topeLleno: Sale; sistemaRegla: string | null;
  };
  verificacion: { token: Sale; pantalla: Sale; tarjeta: Sale; ambas: Sale; yaRegNoExiste: Sale; sinTicket: Sale; reglaAntes: Sale };
  base7: { sinSenal: Sale; guarda: Sale; guardaYNoExiste: Sale };
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

test('revisión 28/10: un ticket por falla, uno por pedido distinto, las reglas explicadas no abren nada', () => {
  const v = R.revision;
  // base 3: lo que ya registró registrarError no abre un segundo ticket ni otra línea; la marca igual sale.
  assert.deepEqual({ texto: v.yaRegistrado.texto, ticket: v.yaRegistrado.ticket, linea: v.yaRegistrado.linea }, { texto: 'No pude crear la tarea.', ticket: null, linea: null });
  assert.equal(v.yaRegistradoTickets, 0);
  // base 5: dos pedidos distintos en la misma conversación, dos tickets con su línea.
  assert.ok(v.dos1.ticket?.nuevo && v.dos2.ticket?.nuevo && v.dos1.ticket.id !== v.dos2.ticket.id, 'dos pedidos distintos cayeron en un ticket');
  assert.match(String(v.dos2.linea), /^Quedó el ticket #\d+/);
  // base 7: la regla explicada en la respuesta (la marca sólo dice el qué) no abre nada.
  assert.equal(v.regla.ticket, null, 'una negativa legítima abrió ticket');
});

test('revisión 28/10: la configuración se cierra sólo con la cuenta que falló y no va al Runner; cerrar el proveedor no cierra otro', () => {
  const v = R.revision;
  assert.equal(v.confOtra, null, 'se cerró con otra cuenta (nadie arregló la que falló)');
  assert.equal(v.confMisma, v.confId, 'no se cerró cuando contestó la cuenta que había fallado');
  assert.equal(v.confDespacho, null, 'la configuración fue al Runner');
  assert.equal(v.cerroProv, v.provId);
  assert.notEqual(v.textoEstado, 'resuelto', 'cerrar el proveedor cerró otro automático del negocio');
  assert.equal(v.topeLleno.linea, null, 'con el tope lleno igual dijo «Quedó el ticket»');
  // base 10: un ticket del sistema en el ws 10 no entra por la regla de Leandro.
  assert.equal(v.sistemaRegla, null, 'un error de la app entró por la regla del negocio');
});

test('verificación 28/10: la regla sólo en la oración de la marca, yaRegistrado no apaga el «no existe», sin ticket no hay línea', () => {
  const v = R.verificacion;
  assert.ok(v.token.ticket?.nuevo, 'una falla que nombra el token no abrió ticket');
  assert.ok(v.pantalla.ticket?.nuevo, 'una falla que sugiere hacerlo en tu pantalla no abrió ticket');
  assert.equal(v.tarjeta.ticket, null, '«se confirma en tu tarjeta» abrió ticket');
  assert.ok(v.reglaAntes.ticket?.nuevo, 'una regla al principio de la respuesta tapó la falla de la oración de la marca');
  assert.equal(v.ambas.causa, 'no-existe', 'la regla se comió el «no existe» de la misma respuesta');
  assert.equal(v.yaRegNoExiste.causa, 'no-existe', 'yaRegistrado se comió un pedido que no existe');
  assert.equal(v.sinTicket.ticket, null);
  assert.equal(v.sinTicket.linea, null, 'sin ticket igual dijo «Quedó el ticket»');
});

test('base 7, la otra mitad: con la guarda de una herramienta del turno, el «no pude» no abre ticket; el «no existe» sí', () => {
  const g = R.base7;
  assert.ok(g.sinSenal.ticket?.nuevo, 'sin la señal, la misma frase no abrió ticket: el caso no prueba nada');
  assert.equal(g.guarda.causa, null, 'la guarda de una herramienta abrió ticket');
  assert.equal(g.guarda.ticket, null);
  assert.equal(g.guarda.linea, null, 'con la guarda igual dijo «Quedó el ticket»');
  assert.equal(g.guarda.texto, 'No pude borrar el lead de Juan.');
  assert.equal(g.guardaYNoExiste.causa, 'no-existe', 'la guarda se comió el «no existe» de la misma respuesta');
});

// ── Probado rompiéndolo (27/10/2026) ─────────────────────────────────────────────────────────────────────────────────
// Cada cambio a mano, corrido y restaurado (sha1 igual):
//   1. `clasificar` sin la rama de `automatico`                          → rojo el i.
//   2. el tope de la persona contando las `ref` del sistema               → rojo el h.
//   3. `crearTicket` sin buscar el último abierto de un automático        → rojo el g.
//   4. `cerrarAutomatico` sin cerrar                                       → rojo el j.
//   (28/10) 5. sin `yaRegistrado`, 6. la ref sin lo que falló, 7. sin mirar la regla en la respuesta, 8. la configuración sin
//   `soloSi`, 9. cerrar por el prefijo del negocio, 10. el sistema por la regla → rojo los dos de la revisión.
//   (28/10, base 7) 11. la regla se come el «no existe», 12. `conTicketsDeMaKo` sin la regla → rojo el de base 7.
