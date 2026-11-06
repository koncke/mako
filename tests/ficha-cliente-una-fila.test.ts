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
// ⚠️ DESDE EL 17/10/2026 EL EQUIPO DE LA CUENTA DE MaKo DE UN CLIENTE DE AGENCIA VIVE EN MaKo PARTNERS (la ficha de la
// cuenta, app/partners/PartnersApp.tsx, con app/partners/EquipoDeCuenta.tsx), no en la ficha de Clients. Las reglas de
// abajo (la misma vista para todos los que miran, pedir vs sumar, el vacío que dice «nadie») se mudaron con él: los
// tests las persiguen allá. Roturas de la mudanza: sacar `!superAdmin` de `puedePedir` → 1 fallo («y el permiso…»);
// condicionar el equipo a `superAdmin` → 1 fallo («EL QUE IMPORTA…»).
const partners = () => leer('../app/partners/PartnersApp.tsx');
const equipoDeCuenta = () => leer('../app/partners/EquipoDeCuenta.tsx');

// ⚠️ Y EL 05/10/2026 LA FILA CAMBIÓ DE DUEÑO, sin volver a ser dos. «Dejar solo la sección
// de "PRIORIDADES"… y que haya un botón que te redirija» al Plan: el tablero se monta con
// `soloVista="prioridades"` (sin su selector) y la ficha dibuja la suya —Resumen ·
// Prioridades · Llamadas · Equipo—. Y «Equipo» pasó a existir sólo si el workspace es una
// AGENCIA (`cuentas.visible`): sigue siendo la MISMA ficha para todos los que miran, porque
// esa condición es del workspace y no de la persona. Los tres primeros tests se reescribieron
// ese día para fijar eso; las roturas de abajo de cada uno son de esa reescritura.
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

test('la ficha de un cliente dibuja UNA fila de tabs: la suya, con el tablero sin selector', () => {
  // Dos filas, a 8 px, obligan a aprender cuál manda. Desde el 05/10 la de la ficha es la
  // única: cada tablero montado adentro va con su selector apagado.
  const f = sinComentarios(ficha());
  assert.equal((f.match(/<Tabs\b/g) ?? []).length, 1, 'la ficha tiene que dibujar exactamente UNA fila');
  const boards = f.match(/<(PlanBoard|TodoBoard)\b[\s\S]*?\/>/g) ?? [];
  assert.equal(boards.length, 2, `esperaba los dos tableros, hay ${boards.length}`);
  for (const b of boards) assert.match(b, /soloVista="prioridades"/, 'un tablero volvió a traer su selector: dos filas de tabs');
});

test('EL QUE IMPORTA: el equipo de una cuenta cuelga de la CUENTA, no de quién mira ni de lo que tenga', () => {
  // Cualquier condición sobre la persona o el contenido hace que la MISMA ficha se vea distinta según quién mire, y ése
  // fue el reporte: «¿me estás mostrando algo diferente al inspeccionar?». En Partners cuelga de que la cuenta esté
  // habilitada: la agencia y el super admin parados en ella ven lo mismo.
  const p = sinComentarios(partners());
  const m = /\{abierta\.estado === 'aprobado' \? \(\s*<EquipoDeCuenta/.exec(p);
  assert.ok(m, 'el equipo de la cuenta volvió a depender de otra cosa que la cuenta');
  // Y la ficha de Clients no tiene equipo: es la de la entrega.
  assert.doesNotMatch(sinComentarios(ficha()), /id: 'equipo'|<Panel id="equipo"/, 'volvió la tab «Equipo» a la ficha de Clients');
});

test('y el permiso de PEDIR un alta sigue siendo del que mira', () => {
  // Lo que se unificó es la VISTA, no el permiso: el super admin no pide altas, crea. Si esta condición se fuera con la
  // otra, le estaríamos ofreciendo pedirse permiso a sí mismo.
  const p = partners();
  assert.ok(/puedePedir=\{puedeAbrir && !superAdmin\}/.test(p), 'se perdió el corte de quién puede PEDIR un alta');
});

test('un tablero ilegible dice que no se pudo leer, adentro de Tareas', () => {
  // «No pude leer» no se pinta como «no tiene trabajo». El equipo, que antes compartía esta ficha, vive en Partners.
  const f = sinComentarios(ficha());
  const ini = f.indexOf('<Panel id="prioridades"');
  const fin = f.indexOf('</Panel>', ini);
  assert.ok(ini > 0 && fin > ini, 'no encontré el panel de Prioridades');
  const prioridades = f.slice(ini, fin);
  assert.ok(prioridades.length < 2_000, `el panel de Prioridades mide ${prioridades.length}: estoy mirando otra cosa`);
  assert.match(prioridades, /No pude leer su tablero/, 'se fue el mensaje de tablero ilegible');
});

// ⚠️ PROBADO ROMPIÉNDOLO, la reescritura del 05/10/2026 (baseline del archivo: 10 / 0):
//   1. sacar `soloVista="prioridades"` del TodoBoard → 9 / 1 («…UNA fila de tabs…»).
//   2. la tab con `cuentas?.superAdmin ?` en vez de `verCuentas ?` → 9 / 1 («EL QUE
//      IMPORTA…»).
//   3. el `<EquipoDelCliente …/>` adentro del panel de Prioridades → 9 / 1 («el equipo no
//      depende del tablero…»).

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
  // (La otra era la ficha de un negocio en la grilla vieja de Admin, app/admin/FichaWorkspace.tsx: desde el 6/11/2026 esa ficha
  // es una PÁGINA de la copia de Polar, Admin › Customers › <negocio>, y no un modal.)
  for (const f of ['../app/customer-success/FichaCliente.tsx']) {
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
  // «Pareciera que se bugeó y que la propia Brigitte no puede entrar» — y con cero usuarios es literal: no puede entrar
  // nadie. La frase lo tiene que decir (en Partners desde el 17/10/2026).
  const e = equipoDeCuenta();
  assert.ok(!/Nadie m.s entra a la cuenta/.test(e), 'volvió la frase que da a entender que el dueño sí entra');
  assert.ok(/no tiene a nadie adentro/.test(e), 'el vacío dejó de decir que la cuenta no tiene a nadie');
});

test('el super admin puede SUMAR, no sólo pedir', () => {
  // «¿De qué sirve que tenga una tab de equipo que no puede hacer nada? Ahí deberían poder agregarle setter o closer.»
  // El que pide deja un pedido; el que firma, crea.
  const e = equipoDeCuenta();
  assert.ok(/puedeSumar \? '\/api\/admin\/usuarios' : '\/api\/agencia\/altas'/.test(e),
    'los dos caminos no salen del mismo formulario, o se perdió uno');
  assert.ok(/\(puedePedir \|\| puedeSumar\)/.test(e), 'el formulario sigue siendo sólo para el que PIDE');
  assert.ok(/puedeSumar=\{superAdmin\}/.test(partners()), 'Partners no le da al super admin el camino de sumar');
});
