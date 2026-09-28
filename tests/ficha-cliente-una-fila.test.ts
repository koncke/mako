// =============================================================================
// La ficha de un cliente: UNA fila de tabs, y la MISMA para todos los que miran
// =============================================================================
// Dos reportes del dueño, con una semana de por medio y la misma causa de fondo:
//
//   «Pusiste 2 seleccionables de tabs… eso no tiene sentido» (28/09, sobre el panel de
//   la plataforma) y «soluciona lo de la tab del tablero y equipo, ya habíamos hablado
//   de eso» (29/09, sobre la ficha de Customer Success, con una captura de un usuario
//   de la agencia). La primera vez se arregló UNA de las dos pantallas.
//
// Y el segundo reporte trajo algo peor: «¿me estás mostrando algo diferente al
// inspeccionar de lo que realmente ven los usuarios?». Era cierto y colgaba de una sola
// condición — la tab «Equipo» sólo existía si había ALGO adentro, y para el super admin
// el botón «Pedir sumar a alguien» está apagado a propósito (`!cuentas.superAdmin`), así
// que en un cliente con CERO usuarios la tab entera desaparecía sólo para él.
//
// Medido en el navegador con las dos sesiones sobre la misma ficha, ANTES del arreglo:
//   · agencia (ws13, rol usuario) → filaDeTabs: ["Tablero", "Equipo"]
//   · super admin en /customer-success?ws=13 → filaDeTabs: []
// Y DESPUÉS, las dos:
//   · selector: ["prioridades", "tareas", "Proyectos", "recurrentes", "Equipo"], 1 renglón
//
// ⚠️ PROBADO ROMPIÉNDOLO, dos veces (29/09/2026):
//   1. Volviendo a condicionar la vista (`vistaExtra={hayEquipo ? vistaEquipo : undefined}`):
//      falla 1 de 6 — «la vista Equipo se pasa SIN condición». Es el que importa: es
//      exactamente la forma que tenía el bug de las dos vistas distintas.
//   2. Sacando del `useState` de `BoardShell` la rama que acepta el id de la vista extra:
//      falla 1 de 6 — «un deep-link a la vista extra la abre». El síntoma sería mudo: el
//      control «Ver su equipo» abriría Prioridades y se leería como un botón roto.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const leer = (p: string) => readFileSync(resolve(import.meta.dirname, p), 'utf8');
const ficha = () => leer('../app/customer-success/FichaCliente.tsx');
const shell = () => leer('../app/plan/board/BoardShell.tsx');

test('la ficha de un cliente NO dibuja una segunda fila de tabs', () => {
  // El board ya trae su selector. Otro arriba, a 8 px, obliga a aprender cuál manda.
  const f = ficha();
  assert.ok(!/<Tabs\b/.test(f), 'volvió la fila de tabs propia de la ficha');
  assert.ok(!/\bTabs\b[^\n]*from '@\/app\/_ui'/.test(f), 'sigue importando Tabs');
});

test('EL QUE IMPORTA: la vista Equipo se pasa SIN condición', () => {
  // Cualquier condición acá hace que la MISMA ficha se vea distinta según quién mire, y
  // ése fue el reporte: «¿me estás mostrando algo diferente al inspeccionar?».
  const f = ficha();
  const usos = f.match(/vistaExtra=\{[^}]*\}/g) ?? [];
  assert.ok(usos.length >= 2, `esperaba los dos boards con la vista extra, hay ${usos.length}`);
  for (const u of usos) {
    assert.equal(u, 'vistaExtra={vistaEquipo}', `la vista Equipo está condicionada: ${u}`);
  }
});

test('y el permiso de PEDIR un alta sigue siendo del que mira', () => {
  // Lo que se unificó es la VISTA, no el permiso: el super admin no pide altas, crea. Si
  // esta condición se fuera con la otra, le estaríamos ofreciendo pedirse permiso a sí
  // mismo.
  const f = ficha();
  assert.ok(/!cuentas\.superAdmin/.test(f), 'se perdió el corte de quién puede PEDIR un alta');
  assert.ok(/puedePedir=\{puedePedir\}/.test(f), 'el botón de pedir dejó de depender de ese corte');
});

test('el equipo se muestra aunque el tablero no se haya podido leer', () => {
  // No depende del tablero: perderlo por una lectura caída sería esconder lo único que
  // quedó legible. Y es justo el caso del cliente con cero usuarios.
  const f = ficha();
  const i = f.indexOf('No pude leer su tablero');
  assert.ok(i > 0, 'se fue el mensaje de tablero ilegible');
  assert.ok(/vistaEquipo\.contenido/.test(f.slice(i, i + 400)), 'sin tablero, el equipo desaparece');
});

test('un deep-link a la vista extra la abre, y no cae en Prioridades', () => {
  // `vistaValida` sólo conoce las cuatro literales del board. Sin la rama que acepta el
  // id de la extra, «Ver su equipo» abre Prioridades — un control que no hace lo que dice.
  const s = shell();
  const i = s.indexOf('const [view, setView] = useState');
  const decl = s.slice(i, i + 400);
  assert.ok(/vistaExtra && vistaInicial === vistaExtra\.id/.test(decl),
    'el deep-link a la vista extra cae en la vista por default');
});

test('la vista extra va al FINAL del selector, después de las cuatro', () => {
  // «Simplemente agregar Equipo luego de Recurrentes» (28/09). Si se antepusiera, la
  // primera vista del board dejaría de ser Prioridades.
  const s = shell();
  const i = s.indexOf('...(vistaExtra ?');
  const j = s.indexOf('VISTAS.map((v) =>');
  assert.ok(i > 0 && j > 0, 'no encontré el selector de vistas');
  assert.ok(j < i, 'la vista extra quedó ANTES de las cuatro del board');
});

// ── El TAMAÑO de la ficha, y lo que se dibuja adentro ─────────────────────
//
// ⚠️ Estos cuatro también probados rompiéndolos (29/09/2026): sacarle el `alto` a una de
// las dos fichas falla 1 de 10; devolver el menú al flujo (sin `createPortal`) falla 1;
// volver a «Nadie más entra…» falla 1; y dejar el formulario sólo para `puedePedir`
// falla 1.

test('las dos fichas fijan su ALTO: no lo deciden por lo que tengan adentro', () => {
  // «Ya te había dicho que JAMÁS achiques el tamaño de un detail según lo que contenga
  // dentro» (29/09/2026, y era la segunda vez). El default de `Modal` es un TOPE, que
  // está bien para un diálogo y no para una ficha con un tablero adentro: elegir la
  // vista de Equipo de un cliente sin gente la encogía a la mitad.
  for (const f of ['../app/customer-success/FichaCliente.tsx', '../app/admin/FichaWorkspace.tsx']) {
    assert.ok(/alto="min\(85vh, 720px\)"/.test(leer(f)), `${f} deja que el contenido decida el alto`);
  }
  // Y el prop existe de verdad, con `height` ADEMÁS del tope de la hoja.
  const m = leer('../app/_ui/Modal.tsx');
  assert.ok(/alto \? \{ height: alto \}/.test(m), '`alto` no se aplica como height');
});

test('el menú de acciones se PORTALEA: adentro de un modal lo recorta el overflow', () => {
  // `.mk-modal` lleva `overflow:hidden` para redondear sus esquinas, y este menú abre
  // desde la cabecera de un tablero que a veces vive adentro de uno. Medido antes: el
  // panel terminaba 140 px por debajo del borde del modal.
  const b = leer('../app/_components/BarraAcciones.tsx');
  assert.ok(/createPortal\(/.test(b), 'el menú volvió al flujo y un modal lo va a recortar');
  assert.ok(/ubicarPanel\(/.test(b), 'se ubica a mano en vez de con la cuenta que ya existe');
  assert.ok(!/position: 'absolute', top: 44, right: 0/.test(b), 'quedó la posición vieja, que no se da vuelta ni se topa contra la ventana');
});

test('el equipo vacío NO dice «nadie más»: no hay NADIE, ni el dueño de la cuenta', () => {
  // «Pareciera que se bugeó y que la propia Brigitte no puede entrar» — y con cero
  // usuarios es literal: no puede entrar nadie. La frase lo tiene que decir.
  const f = ficha();
  assert.ok(!/Nadie m.s entra a la cuenta/.test(f), 'volvió la frase que da a entender que el dueño sí entra');
  assert.ok(/no tiene a nadie adentro/.test(f), 'el vacío dejó de decir que la cuenta no tiene a nadie');
});

test('el super admin puede SUMAR, no sólo pedir', () => {
  // «¿De qué sirve que tenga una tab de equipo que no puede hacer nada? Ahí deberían
  // poder agregarle setter o closer.» El que pide deja un pedido; el que firma, crea.
  const f = ficha();
  assert.ok(/puedeSumar/.test(f), 'no hay camino para sumar directo');
  assert.ok(/puedeSumar \? '\/api\/admin\/usuarios' : '\/api\/agencia\/altas'/.test(f),
    'los dos caminos no salen del mismo formulario, o se perdió uno');
  assert.ok(/\(puedePedir \|\| puedeSumar\)/.test(f), 'el formulario sigue siendo sólo para el que PIDE');
});
