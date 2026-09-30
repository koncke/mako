// =============================================================================
// La ficha del lead y el selector de producto — lo que se reportó TRES veces
// =============================================================================
// Las tres cosas de acá se pidieron más de una vez, y las tres vuelven solas si
// nadie las fija: son decisiones de forma, y la forma no la mira el compilador.
//
// Probado rompiéndolo, y DOS veces la rotura enseñó algo que la aserción no veía:
//   · la 1ª aserción de POSICIÓN pasaba con el aviso devuelto a su franja vieja
//     (pedía «antes de las tabs», y esa franja también lo está). Se reancló al
//     arranque del CUERPO, y el ancla va en CÓDIGO: el test lee el fuente sin
//     comentarios, así que un ancla comentada no se encuentra.
//   · y la 1ª rotura de `nowrap` NO falló, y el test estaba bien: mi `replace` pegó
//     en el COMENTARIO que explica la regla, no en la línea de estilo. Una rotura que
//     no toca el código no prueba nada — hay que verificar que rompió lo que se cree.
//
// Con el código como está: 8 pases, 0 fallos.
//   · el aviso envuelve (la línea de estilo)          → 7 / 1
//   · vuelve el copy largo que medía 214,6            → 6 / 2
//   · el caso ignorado dibuja las DOS acciones        → 7 / 1
//   · el aviso vuelve a su franja (modal)             → 7 / 1
//   · el aviso vuelve a su franja (ruta /crm/[id])    → 7 / 1
//   · Análisis vuelve antes de Pagos                  → 5 / 1
//   · la página de /crm/[id] recupera «Chat»          → 4 / 2
//   · el selector pierde su `width`                   → 5 / 1
//   · el renglón de crear deja de iluminarse          → 5 / 1
//   · la TERCERA ficha (EditLeadForm) vuelve al inglés → 8 / 1
//   · la ruta /crm/[id] pierde las notas otra vez      → 8 / 1

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
test('el aviso de «datos sin marcar» es SOLO el número y la salida', () => {
  // Pedido CUATRO veces, y cada vez quedó más chico sin llegar a lo que se pedía:
  // la tarjeta ámbar de 180 px, después una fila con fondo y borde, después un
  // renglón sin caja con los nombres recortados, y recién ahora esto. Lo que cerró
  // el tema fue sacar la enumeración ENTERA: «Servicio del cierre · Promesa del
  // cierre · Datos fiscales del cliente · Documento fi…» era el 80% del ancho para
  // una lista que no se puede accionar desde ahí y que encima se cortaba a mitad de
  // palabra. Lo único que hay que decidir mirándolo es el CONTEO.
  const card = leer('../app/crm/lead-view/DatosSinMarcarCard.tsx');

  // NO tiene caja: ni fondo propio ni borde.
  assert.ok(!/background: 'var\(--warn-bg\)'/.test(card), 'el fondo ámbar se fue');
  assert.ok(!/background: 'var\(--surface-2\)'/.test(card), 'no lleva fondo: no es una caja');
  assert.ok(!/border: '1px solid/.test(card), 'no lleva borde: no es una caja');

  // ⚠️ Y NO DIBUJA LOS NOMBRES. Ni completos ni recortados: la única vez que
  // aparecen es en el `title`, que no ocupa un píxel.
  const enElTitle = /const nombres = faltantes\.map\(\(f\) => f\.label\)\.join\(' · '\)/.test(card) && /title=\{[^}]*nombres/.test(card);
  assert.ok(enElTitle, 'los nombres se conservan en el title, a un hover');
  // Los nombres pueden ARMARSE en una const; lo que no pueden es DIBUJARSE. Un
  // `{nombres}` suelto entre etiquetas es la enumeración de vuelta.
  assert.ok(!/>\{nombres\}</.test(card) && !/^\s*\{nombres\}\s*$/m.test(card), 'los nombres no se dibujan: solo viajan en el title');
  assert.ok(!/\.join\(' · '\)\}</.test(card), 'ni interpolados directo entre etiquetas');
  assert.ok(!/textOverflow: 'ellipsis'/.test(card), 'no hay nada que recortar: el ellipsis se fue con la lista');

  // Lo que queda: el conteo y la salida, y nada más.
  assert.ok(/\{faltantes\.length\} sin marcar/.test(card), 'el conteo');
  assert.ok(/\{label\}/.test(card), 'la salida');

  // Verificado rompiéndolo: devolviendo la enumeración al cuerpo, 1 fallo.
});

test('el aviso es UN RENGLÓN, siempre — la garantía es nowrap, no una medición', () => {
  // Regla, no objetivo: «Solucionar siempre en 1 sola línea, si tienes que acortar la
  // frase hazlo, pero siempre en 1 sola línea» (27/09/2026).
  //
  // ⚠️ LA VERSIÓN ANTERIOR CONFIABA EN UNA MEDICIÓN, Y LA MEDICIÓN ESTABA MAL. Se
  // midió en una página donde Geist NO estaba cargada, así que midió system-ui: 205,8
  // px, que entraban en los 210 del desplegable. Con Geist de verdad el mismo
  // contenido mide 214,6 y se parte en dos — que es lo que se reportó. De ahí las dos
  // mitades de este test: `nowrap` es la garantía DURA (no depende de ninguna fuente),
  // y el copy corto es lo que además evita que la columna se ensanche.
  const card = leer('../app/crm/lead-view/DatosSinMarcarCard.tsx');

  assert.ok(/flexWrap: 'nowrap'/.test(card), 'nowrap es la única garantía de un renglón');
  assert.ok(!/flexWrap: 'wrap'/.test(card), 'envolver está prohibido acá, no es una opción de layout');
  assert.ok(!/maxWidth/.test(card), 'con nowrap un tope de ancho no envuelve: recorta, que es peor');

  // El copy corto, medido con Geist cargada contra los 210 px del desplegable:
  //   «6 datos sin marcar» + «Solucionar →»   214,6  ✗
  //   «6 sin marcar»       + «Solucionar →»   176,9  ✓  (33 px de holgura)
  //   «999 sin marcar»     + «Solucionar →»   192,7  ✓  (17 px con tres dígitos)
  assert.ok(/\{faltantes\.length\} sin marcar/.test(card), 'sin la palabra «datos»: son 38 px que no dicen nada nuevo debajo de la etapa');
  assert.ok(!/datos sin marcar/.test(card), 'esa es la versión que se partía en dos');

  // ⚠️ Y EN EL CASO IGNORADO, UNA SOLA ACCIÓN. Las dos juntas miden 312,5 px y no hay
  // forma de que entren; el estado se dice con el color y con el `title`, que no
  // ocupan ancho. Se elige «Reactivar», que es lo que se quiere en ese estado.
  assert.ok(/const apagado = ignorado && !!onReactivar;/.test(card), 'el caso ignorado se decide una vez');
  assert.ok(/apagado \? \(/.test(card), 'y elige UNA acción, no dibuja las dos');
});
test('el aviso vive EN EL HEADER, debajo del desplegable, en las DOS fichas', () => {
  // Estaba en su propia franja de ancho completo arriba de las tabs, empujando las
  // pestañas y el contenido hacia abajo en TODOS los leads con algo sin marcar (el 98%).
  //
  // ⚠️ EL ANCLA ES EL ARRANQUE DEL CUERPO, no `<LeadTabs>`. La primera versión de este
  // test pedía «después del desplegable y antes de las tabs» — y la rotura de prueba
  // (devolver el aviso a su franja, justo encima de `<LeadTabs>`) la PASÓ, porque esa
  // franja también está entre las dos. Una aserción que no distingue las dos posiciones
  // que quiere distinguir no mide nada, y sólo se ve rompiéndola.
  const casos: Array<[string, string]> = [
    // El marcador va en CÓDIGO y no en un comentario: `leer()` los quita, y con un
    // ancla comentada el test falla por no encontrarla, que no es lo que persigue.
    ['../app/crm/LeadSheet.tsx', "overflowY: 'auto'"],
    // En la ruta el header es un `const header = (…)` y el cuerpo empieza en el
    // `return (` del componente: adentro de ese const es adentro del header.
    ['../app/crm/[id]/LeadDetailBody.tsx', '{header}'],
  ];
  for (const [ruta, arranqueDelCuerpo] of casos) {
    const f = leer(ruta);
    const iDrop = f.search(/ariaLabel="(Cambiar etapa|Etapa del lead)/);
    const iAviso = f.indexOf('<DatosSinMarcarCard');
    const iCuerpo = f.indexOf(arranqueDelCuerpo);
    assert.ok(iDrop >= 0 && iAviso >= 0 && iCuerpo >= 0, `${ruta}: falta alguna de las tres anclas`);
    assert.ok(iAviso > iDrop, `${ruta}: el aviso va DESPUÉS del desplegable de etapa`);
    assert.ok(iAviso < iCuerpo, `${ruta}: el aviso tiene que estar en el HEADER, no en el cuerpo`);
  }
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

test('las TRES fichas hablan el mismo idioma y muestran lo mismo', () => {
  // ⚠️ SON TRES, NO DOS, y ésa es la razón por la que esto falló DOS veces. El 27/09
  // se tradujeron las pestañas del modal; después apareció que la ruta /crm/[id] tenía
  // las suyas en inglés; y al arreglar la ruta quedó afuera la TERCERA — el modo
  // EDICIÓN (`EditLeadForm`), que está a un clic del tablero («Editar lead →»).
  //
  // Ninguna es una pantalla muerta: al modal se llega desde el tablero, a la ruta desde
  // el WhatsApp que avisa de un lead nuevo de la landing y desde el Closing Analyst, y
  // al form desde el botón de la ficha.
  const SUPERFICIES = [
    '../app/crm/LeadSheet.tsx',
    '../app/crm/[id]/page.tsx',
    '../app/crm/[id]/EditLeadForm.tsx',
  ];
  for (const ruta of SUPERFICIES) {
    const f = leer(ruta);
    for (const ingles of ['Overview', 'Meetings', 'Insights', 'Deal Details', 'Change History']) {
      assert.ok(!new RegExp(`label: '${ingles}'`).test(f), `${ruta}: «${ingles}» sigue en inglés`);
    }
    assert.ok(!/label: 'Notas'/.test(f), `${ruta}: la pestaña Notas se sacó del producto`);
    assert.ok(!/label: 'Chat'/.test(f), `${ruta}: la pestaña Chat se sacó`);
  }

  // Y Pagos es condicional en las dos que la dibujan como tab de datos.
  assert.ok(/\.\.\.\(\(esVenta \|\| tienePlan\) \? \[\{ key: 'cobranza'/.test(leer('../app/crm/[id]/page.tsx')), 'Pagos condicional en la ruta');
  assert.ok(/\.\.\.\(pagos\.length \? \[\{ key: 'cobranza'/.test(leer('../app/crm/LeadSheet.tsx')), 'Pagos condicional en el modal');
});

test('las notas y el recorrido están en las DOS fichas, y en el mismo lugar', () => {
  // Las notas se sacaron de la ruta junto con su pestaña y volvieron SOLO al modal:
  // quien entra por el link del WhatsApp de la landing se quedaba sin notas.
  for (const ruta of ['../app/crm/LeadSheet.tsx', '../app/crm/[id]/page.tsx']) {
    const f = leer(ruta);
    assert.ok(/<NotasCard leadId=\{lead\.id\} \/>/.test(f), `${ruta}: faltan las notas`);
    // El recorrido va con el Historial, no en el Resumen: las dos contestan «qué pasó».
    const iAct = f.indexOf("label: 'Historial'");
    const iRec = f.indexOf('Recorrido del lead');
    assert.ok(iAct >= 0 && iRec >= 0, `${ruta}: falta alguna de las dos anclas`);
    assert.ok(iRec > iAct, `${ruta}: el recorrido va DENTRO de la tab Historial`);
  }
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
  // ⚠️ AHORA SON DOS FLAGS APAGADOS: `crear` («Nuevo producto», con su ＋ y su filete) y
  //    `sutil` («Productos eliminados», sólo texto y más chico). Comparten el color
  //    porque los dos son secundarios; lo que los distingue es el peso, y eso se mide
  //    abajo. La aserción pedía el ternario exacto y se rompió al sumar el segundo.
  assert.match(drop, /color: o\.crear \|\| o\.sutil \? 'var\(--faint\)'/, 'apagada: --faint');
  assert.match(drop, /sutil\?: boolean/, 'se fue el renglón SUTIL, que es el de lo eliminado');
  // El sutil es MÁS chico que el de crear, o los dos pesan igual y vuelve el problema.
  assert.match(drop, /fontSize: o\.sutil \? 12\.5 : 13\.5/, 'el renglón sutil dejó de ser más chico');
  assert.ok(/o\.crear \? 0\.8/.test(drop), 'y con opacidad, como «＋ Nueva tarea» del plan');
  assert.match(drop, /if \(o\.crear \|\| o\.sutil\) \{ e\.currentTarget\.style\.color = 'var\(--primary\)'/,
    'al pasar el cursor SE ILUMINA — los dos renglones apagados, o el sutil queda muerto');
  assert.ok(/o\.crear && <span aria-hidden[^>]*>＋<\/span>/.test(drop), 'lleva el ＋, como el molde del plan');
});
