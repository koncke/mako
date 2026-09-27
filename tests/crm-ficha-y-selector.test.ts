// =============================================================================
// La ficha del lead y el selector de producto — lo que se reportó TRES veces
// =============================================================================
// Las tres cosas de acá se pidieron más de una vez, y las tres vuelven solas si
// nadie las fija: son decisiones de forma, y la forma no la mira el compilador.
//
// Probado rompiéndolo, CINCO veces, y cada rotura cayó donde tenía que caer
// (6 pases y 0 fallos con el código como está):
//   · el aviso vuelve a `flexWrap: 'wrap'`        → 5 / 1
//   · Análisis vuelve antes de Pagos          → 5 / 1
//   · la página de /crm/[id] recupera «Chat»  → 4 / 2
//   · el selector pierde su `width`            → 5 / 1
//   · el renglón de crear deja de iluminarse  → 5 / 1

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const crudo = (p: string) => readFileSync(join(import.meta.dirname, p), 'utf8');

/**
 * El archivo SIN sus comentarios.
 *
 * ⚠️ Hace falta, y lo probó este mismo test: la primera versión de «no lleva wrap»
 * falló porque el comentario que EXPLICA por qué no lleva wrap contiene la cadena
 * `flexWrap: 'wrap'`. Es la trampa de AGENTS.md («el código generado se DELATA ante
 * quien lo lee después»), y acá el que lee es el test. Todo test que persiga la
 * AUSENCIA de algo en el fuente tiene que mirar el código, no la prosa.
 *
 * El orden importa: los de línea PRIMERO. Si no, un `//` con un `/*` adentro abre un
 * bloque que se come el resto del archivo — ya pasó con el guard de voseo.
 */
const sinComentarios = (t: string) => t.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (p: string) => sinComentarios(crudo(p));

// ── 1 · El aviso de datos sin marcar ─────────────────────────────────────────
test('el aviso de «datos sin marcar» es UN renglón, y no una caja', () => {
  // Pedido TRES veces. La segunda versión ya no era una tarjeta ámbar de 180 px,
  // pero seguía teniendo fondo, borde y `flexWrap: 'wrap'` — y con 6 datos el
  // texto bajaba a dos líneas y el espaciador empujaba «Solucionar» a una
  // tercera. Con caja alrededor eso se ve igual que la tarjeta que se sacó:
  // «sigue siendo una tarjeta enorme… que no sea una tarjeta siquiera».
  const card = leer('../app/crm/lead-view/DatosSinMarcarCard.tsx');

  // NO tiene caja: ni fondo propio ni borde.
  assert.ok(!/background: 'var\(--warn-bg\)'/.test(card), 'el fondo ámbar se fue');
  assert.ok(!/background: 'var\(--surface-2\)'/.test(card), 'no lleva fondo: no es una caja');
  assert.ok(!/border: '1px solid/.test(card), 'no lleva borde: no es una caja');

  // ⚠️ NO PUEDE ENVOLVER. Es lo único que garantiza un renglón con 1 dato y con 9.
  assert.ok(/flexWrap: 'nowrap'/.test(card), 'sin nowrap vuelve a partirse en tres renglones');
  assert.ok(!/flexWrap: 'wrap'/.test(card), 'wrap es exactamente lo que lo volvía un bloque');

  // Y lo que cede es la enumeración, no el dato ni la acción (AGENTS.md: «declará
  // quién CEDE»). El conteo y el botón van con flex:'none'; los nombres con
  // '0 1 auto' + ellipsis.
  assert.ok(/flex: '0 1 auto'[\s\S]{0,200}textOverflow: 'ellipsis'/.test(card), 'los nombres son los que ceden, con ellipsis');
  assert.ok(/title=\{nombres\}/.test(card), 'lo que se recorta tiene que quedar consultable en el title');

  // Verificado rompiéndolo: poniendo flexWrap 'wrap' de vuelta, 1 de los 4 tests
  // de este bloque falla; devolviendo el fondo, otro.
});

test('el aviso no arrastra props muertas', () => {
  // `nota` viajaba desde los DOS call sites y el render no la dibujaba en ninguna
  // versión: texto escrito, pasado y nunca visto. Es el caso de AGENTS.md
  // («escribir la salida no es ofrecerla»), y se encuentra con un grep del nombre.
  const card = leer('../app/crm/lead-view/DatosSinMarcarCard.tsx');
  assert.ok(!/nota/.test(card), 'el prop `nota` se fue del componente');
  for (const ruta of ['../app/crm/LeadSheet.tsx', '../app/crm/[id]/LeadDetailBody.tsx']) {
    assert.ok(!/nota="/.test(leer(ruta)), `${ruta}: no puede seguir pasando un prop que nadie dibuja`);
  }
});

// ── 2 · El orden de las pestañas ─────────────────────────────────────────────
/** Los `label:` de una lista de tabs, en el orden en que se declaran. */
function etiquetas(fuente: string, desde: string): string[] {
  const i = fuente.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  return [...fuente.slice(i).matchAll(/label: '([^']+)'/g)].map((m) => m[1]);
}

test('Análisis va pegado a Historial, en las DOS fichas', () => {
  // «Que análisis esté previo al historial» (27/09/2026). Las dos contestan «qué
  // pasó con esta persona» —una lo interpreta, la otra lo registra— y Pagos, que
  // contesta otra cosa, estaba en el medio.
  const esperado = ['Resumen', 'Tracking', 'Reuniones', 'Pagos', 'Análisis', 'Historial'];

  const modal = etiquetas(leer('../app/crm/LeadSheet.tsx'), 'tabs={[').slice(0, 6);
  assert.deepEqual(modal, esperado, 'el modal (LeadSheet)');

  const pagina = etiquetas(leer('../app/crm/[id]/page.tsx'), 'tabs={[').slice(0, 6);
  assert.deepEqual(pagina, esperado, 'la ruta /crm/[id]');

  // Verificado rompiéndolo: devolviendo Análisis antes de Pagos en el modal,
  // 1 fallo; en la página, otro.
});

test('la ficha de /crm/[id] es la MISMA ficha que el modal', () => {
  // ⚠️ TRES filas de /admin/friccion estaban marcadas como aplicadas y lo estaban
  // SOLO en el modal: las pestañas en inglés, «Notas» y «Chat». Es la regla de
  // AGENTS.md «sacar un patrón es ENUMERAR dónde está, no arreglarlo donde se
  // vio», y acá se pagó con la pantalla a la que llega el CLIENTE: el WhatsApp
  // que avisa de un lead nuevo de la landing linkea a /crm/<id>, no al tablero.
  const pagina = leer('../app/crm/[id]/page.tsx');
  for (const ingles of ['Overview', 'Meetings', 'Insights', 'Deal Details', 'Change History']) {
    assert.ok(!new RegExp(`label: '${ingles}'`).test(pagina), `«${ingles}» sigue en inglés`);
  }
  assert.ok(!/label: 'Notas'/.test(pagina), 'la pestaña Notas se sacó del producto');
  assert.ok(!/label: 'Chat'/.test(pagina), 'la pestaña Chat se sacó: basta el ícono de WhatsApp al lado del número');
  // Y Pagos es condicional acá también: sin pagos no se dibuja.
  assert.ok(/\.\.\.\(\(esVenta \|\| tienePlan\) \? \[\{ key: 'cobranza'/.test(pagina), 'Pagos tiene que ser condicional, como en el modal');
});

// ── 3 · El selector de producto ──────────────────────────────────────────────
test('el selector de producto llega al borde, alineado con «+ Nuevo lead»', () => {
  // ⚠️ MEDIDO, no deducido. Se reportó DOS veces («aún no está alineado a la
  // derecha a la misma posición que el botón de Nuevo lead»). Reproduciendo las
  // dos filas del CRM en el navegador con sus estilos exactos:
  //   envoltorio <span minWidth:190> + Dropdown sin width → botón de 166,7 px
  //   dentro de un hueco de 190  →  23,3 px muertos a la derecha.
  //   Dropdown con width={190}   →  0 px.
  // Las dos filas son hijas del mismo <main> y comparten su padding, así que con
  // el control ocupando su slot los dos bordes derechos coinciden.
  const tb = leer('../app/crm/CrmToolbar.tsx');
  const i = tb.indexOf('export function SelectorFunnel');
  const bloque = tb.slice(i);

  assert.ok(/width=\{190\}/.test(bloque), 'el ancho va en el Dropdown, que es quien dibuja el botón');
  assert.ok(!/minWidth: 190/.test(bloque), 'el minWidth del envoltorio es lo que dejaba el hueco');

  // Y tiene que seguir siendo el ÚLTIMO de su fila: si algo se agrega después,
  // el que queda pegado al borde es ese otro.
  const board = leer('../app/crm/CrmBoard.tsx');
  const fila = board.slice(board.indexOf('className="crm-tb"'));
  const cierre = fila.indexOf('</div>');
  const ultimo = fila.slice(0, cierre).lastIndexOf('<Selector');
  const bandas = fila.slice(0, cierre).lastIndexOf('<BandasToggle');
  assert.ok(ultimo > bandas, 'el selector va después de las bandas: es el último control de la fila');
});

test('«Nuevo producto» es la salida para CREAR: apagada, y se enciende al pasar el cursor', () => {
  // Pedido con el molde al lado: «que sea algo transparente, opaco, como queriendo
  // agregar uno nuevo, y que al pasar el cursor se ilumine, ya lo hicimos un montón
  // de veces, como al crear una tarea al plan».
  const tb = leer('../app/crm/CrmToolbar.tsx');
  const drop = leer('../app/components/Dropdown.tsx');

  // El llamador la marca con el flag, no con un estilo suyo.
  assert.ok(/label: 'Nuevo producto', crear: true/.test(tb), 'va con el flag `crear`');
  // ⚠️ `color` en un DropdownOption dibuja un PUNTO de 9 px, no tiñe el texto: el
  // intento anterior (`color: 'var(--faint)'`) dejó una bolita gris al lado del
  // renglón y el texto igual de negro que los demás.
  assert.ok(!/'Nuevo producto'[^}]*color:/.test(tb), 'nada de `color`: dibuja un punto, no tiñe');

  // Y NINGUNA opción lleva subtítulo. «JAMÁS uses textos innecesarios»: «el de tu
  // negocio» debajo del único producto que hay era un renglón para no decir nada.
  const sel = tb.slice(tb.indexOf('export function SelectorFunnel'));
  assert.ok(!/sub:/.test(sel), 'el desplegable de productos no lleva subtítulos');

  // El primitive: apagada de entrada, encendida al hover.
  assert.ok(/crear\?: boolean/.test(drop), 'el flag existe en el tipo');
  assert.ok(/color: o\.crear \? 'var\(--faint\)'/.test(drop), 'apagada: --faint');
  assert.ok(/o\.crear \? 0\.8/.test(drop), 'y con opacidad, como «＋ Nueva tarea» del plan');
  assert.ok(/if \(o\.crear\) \{ e\.currentTarget\.style\.color = 'var\(--primary\)'/.test(drop), 'al pasar el cursor SE ILUMINA');
  assert.ok(/o\.crear && <span aria-hidden[^>]*>＋<\/span>/.test(drop), 'lleva el ＋, como el molde del plan');
});
