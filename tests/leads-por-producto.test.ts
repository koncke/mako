// =============================================================================
// Un lead tiene UNA casa (`funnel_id`, NULL = el producto del negocio) y se AGREGA a otros
// =============================================================================
// ⚠️ DESDE EL 06/10/2026 (mig 0207) LA CASA YA NO ES «EL» PRODUCTO DEL LEAD. Pedido de
// Martín, textual: «Le acabo de dar a un lead a "Mover a prueba" y se desapareció del
// producto principal de Mauricio. Eso JAMÁS debe pasar... No se debe "Mover" se debe
// agregar al otro producto». La casa sigue siendo `leads.funnel_id` y cada OTRO producto
// donde está es una fila de `lead_funnel`. Lo de abajo sobre NULL sigue valiendo entero:
// es la casa la que se escribe NULL para el del negocio.
//
// Medido contra producción el 30/09/2026, antes de escribir una línea:
//
//   · `leads.funnel_id` está en NULL en las **1.530 filas** de los 6 workspaces con
//     datos (ws1=1146, ws4=300, ws9=3, ws10=1, ws11=52, ws13=28). La columna existe
//     desde la mig 0181 y no la escribe nadie salvo el alta.
//   · Ningún email aparece hoy en más de un funnel: el multi-producto todavía no
//     ocurrió en ningún cliente.
//   · `vsl_events` tiene 79.537 filas de 9.199 visitantes y se ata por `visitor_id`,
//     que en `leads` es UNA columna: **750 visitantes ya miraron más de una landing**,
//     así que la segunda entrada de una persona no tiene hoy dónde guardarse.
//
// De esas tres mediciones sale todo lo que este archivo persigue, y la primera es la
// que puede vaciar un CRM entero sin dar un error.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { buscarDuplicados, textoDuplicado, enOtroProducto, estaEnProducto, type LeadExistente } from '../lib/leads-duplicados';

const RAIZ = join(import.meta.dirname, '..');
// ⚠️ Normalizado a LF ANTES de buscar: el repo está mezclado por archivo (AGENTS.md) y un
// worktree recién checkouteado llega en CRLF.
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');

/** Una función de primer nivel hasta su cierre REAL (la `}` en la columna 0), no un número
 *  de caracteres elegido a ojo: con un recorte fijo el guard lee la función de al lado. */
const bloque = (src: string, firma: string): string => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const fin = src.indexOf('\n}\n', i);
  assert.ok(fin > i, `no encontré el cierre de «${firma}»`);
  return src.slice(i, fin + 2);
};

/** El fuente sin comentarios: la convención de la casa es explicar en el comentario
 *  justo lo que el guard prohíbe, y si no se sacan el guard se acusa a sí mismo.
 *  ⚠️ Los de LÍNEA van primero: al revés, un `//` que contenga la apertura de un
 *  bloque abre uno que se cierra páginas después y deja todo lo del medio invisible. */
const limpio = (s: string) => s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('⚠️ NADIE rellena `leads.funnel_id` masivamente: eso vacía el CRM de los 6 workspaces', () => {
  // EL CASO, y es el más caro de esta tanda porque no da error ni borra una fila:
  // `listLeadsDeFunnel(null)` —el tablero del embudo POR DEFECTO, donde hoy se ven los
  // 1.530 leads— filtra con `.is('funnel_id', null)`. Un backfill que ponga el id del
  // funnel default en esa columna hace que ninguno matchee: el CRM queda en cero para
  // todo el mundo, en silencio.
  //
  // No era hipotético. `docs/modelo-oferta-producto-funnel.md` tenía el SQL escrito y
  // listo para copiar (`update leads … set funnel_id = p.funnel_id`), con el `where not
  // exists` que lo hace re-ejecutable y todo. Nadie lo había corrido todavía.
  //
  // Probado rompiéndolo (con el guard puesto, 7 pasan y 0 fallan):
  //   · se devuelve el `funnel_id = p.funnel_id` al doc      -> 6 / 1
  //   · una migración nueva con `update leads set funnel_id` -> 6 / 1
  const sqlYDocs = execFileSync('git', ['ls-files', 'supabase/migrations', 'docs'], { cwd: RAIZ, encoding: 'utf8' })
    .split(/\r?\n/).map((f) => f.trim())
    .filter((f) => /\.(sql|md)$/.test(f))
    // ⚠️ LAS AUTOPSIAS QUEDAN AFUERA, Y ES LA ÚNICA EXCEPCIÓN. `docs/hallazgos-*.md` existe
    // para CITAR lo que salió mal: la entrada que documenta este mismo bug pega el SQL
    // culpable adentro de un bloque de código, y con ella incluida el guard se acusa a sí
    // mismo — pasó en el commit que lo escribió (2.687 tests, 1 rojo, sobre un documento).
    // Es el mismo modo de falla que `FunnelEditor` y «Cómo entran» ya pagaron en
    // `tests/funnel-estructura.test.ts`: un guard que mira la PALABRA no distingue la receta
    // del texto que explica por qué está prohibida. Se excluye por NOMBRE, no por carpeta,
    // para que un documento nuevo de otra familia entre igual.
    // ⚠️ Y `docs/relevo.md` ES DE LA MISMA FAMILIA, aunque no se llame «hallazgos».
    // El relevo del 05/10 (`6785dc16`) cita este mismo SQL como la trampa más cara de la
    // ventana —«lo más caro no era un pedido: era una receta de migración»— y dejó el
    // guard EN ROJO en `main` desde ese commit. No lo frenó el push porque el pre-push no
    // corre `npm test`, así que nadie se enteró hasta la corrida siguiente.
    //
    // La regla, que es la que ya estaba escrita y le faltaba un nombre: lo que se excluye
    // es el documento cuyo TRABAJO es citar lo prohibido. Sigue siendo por NOMBRE y no por
    // carpeta, para que un documento nuevo de otra familia entre igual.
    //
    // Probado rompiéndolo con la exclusión nueva puesta: un `docs/tmp-rotura.md` con
    // `update leads set funnel_id = 9;` stageado da 9 pasan / 1 falla, y sin él 10 / 0.
    // O sea que excluir el relevo no neutralizó el guard. (El archivo tiene que estar
    // STAGEADO: esto enumera con `git ls-files`, que lista el índice y no el disco.)
    .filter((f) => !/hallazgos[^/]*\.md$/.test(f) && f !== 'docs/relevo.md');
  // «No encontré nada que revisar» y «revisé y está todo bien» son respuestas distintas.
  assert.ok(sqlYDocs.length > 100, `git ls-files devolvió ${sqlYDocs.length}: esto no corrió en el repo`);

  const culpables: string[] = [];
  for (const f of sqlYDocs) {
    const src = leer(f);
    // Un `update … leads … set … funnel_id =` en cualquier orden y con saltos de línea
    // en el medio, que es como está escrito en el doc.
    for (const m of src.matchAll(/update\s+leads\b[\s\S]{0,400}?\bset\b[\s\S]{0,400}?\bfunnel_id\s*=/gi)) {
      culpables.push(`${f} · «${m[0].replace(/\s+/g, ' ').slice(0, 90)}…»`);
    }
  }
  assert.deepEqual(culpables, [],
    'volvió un backfill de `leads.funnel_id`. NULL ya significa «el del negocio» (mig 0181): rellenarlo no agrega información, deja el tablero en cero');
});

test('⚠️ y el lector que hace que eso sea cierto sigue tratando NULL como el del negocio', () => {
  // La otra mitad del guard de arriba: si mañana el filtro deja de ser `.is(null)`, el
  // backfill dejaría de ser peligroso — y el guard de arriba estaría prohibiendo algo
  // que ya no hace daño. Los dos se leen juntos o ninguno de los dos se entiende.
  //
  // Probado rompiéndolo: se cambia el `.is('funnel_id', null)` por un `.eq` -> 6 / 1.
  const ld = limpio(leer('lib/leads.ts'));
  assert.match(ld, /funnelId == null \? q\.is\('funnel_id', null\)/,
    'el tablero del embudo por defecto dejó de buscar los leads sin funnel: los 1.530 de producción viven ahí');
  assert.match(ld, /funnelId == null \? base\.is\('funnel_id', null\)/,
    'el CONTADOR y la LISTA dejaron de mirar lo mismo: uno diría 1.146 y el otro 0');
});

test('⚠️ la CASA (`funnel_id`) no la escribe un update genérico: sólo el camino declarado', () => {
  // Un lead que cambia de casa cambia en qué tablero lo ve la gente. Si eso se puede
  // escribir desde cualquier lado, un día un update de otra cosa se lo lleva puesto y el
  // lead desaparece de la pantalla donde alguien lo estaba trabajando.
  //
  // ⚠️ DESDE EL 06/10/2026 EL ESCRITOR NO ES «MOVER»: los cuatro caminos que movían ahora
  // AGREGAN (mig 0207) y la casa sólo cambia cuando se QUITA al lead de su casa y otra fila
  // pasa a serlo (`quitarDeProducto`, lib/lead-funnel.ts), siempre por `casaParaEscribir`
  // —que escribe NULL para el del negocio—. `moverLeadDeFunnel` (lib/leads.ts) quedó sin
  // call sites ese día.
  //
  // Probado rompiéndolo: se agrega `funnel_id` a `LeadUpdateInput` -> cae; la promoción de
  // `quitarDeProducto` escribe el id crudo sin `casaParaEscribir` -> cae.
  const ld = limpio(leer('lib/leads.ts'));
  const lf = limpio(leer('lib/lead-funnel.ts'));
  assert.match(lf, /funnel_id: casaParaEscribir\(nueva\.funnelId, defaultId\)/,
    'la promoción de la casa dejó de escribir con `casaParaEscribir`: el id del negocio escrito saca al lead de su tablero');

  // El tipo del update genérico NO puede declararlo: sería una segunda puerta, y
  // silenciosa, porque cualquier formulario que mande el campo lo escribiría.
  const iUpd = ld.indexOf('LeadUpdateInput');
  assert.ok(iUpd > 0, 'no encontré `LeadUpdateInput`');
  const bloqueUpd = ld.slice(iUpd, ld.indexOf('};', iUpd));
  assert.ok(!/\bfunnel_id\b/.test(bloqueUpd),
    '`funnel_id` entró a `LeadUpdateInput`: ahora cualquier update puede mover un lead de tablero sin que se note');
});

test('⚠️ el duplicado dice EN QUÉ PRODUCTO está, o el aviso manda a buscar a ciegas', () => {
  // «Que le advierta que el lead ya existe y que le pregunte si lo quiere traer». Para
  // preguntar eso hay que poder decir de dónde: «ya lo tienes» sobre una pantalla donde
  // la persona NO lo ve se lee como que la app se equivoca.
  //
  // Probado rompiéndolo (7 / 0 con el guard puesto):
  //   · se saca `funnel_id` de las columnas que trae la consulta -> 6 / 1
  //   · `textoDuplicado` deja de aceptar el producto             -> 6 / 1
  const ld = limpio(leer('lib/leads.ts'));
  assert.match(ld, /const cols = 'id, nombre, email, telefono_normalizado, funnel_id'/,
    'la búsqueda de duplicados dejó de traer el producto: el aviso no puede nombrarlo');

  const base: LeadExistente = { id: 7, nombre: 'Ana Pérez', email: 'ana@x.com', telefono_normalizado: null, funnel_id: 14 };
  const cs = buscarDuplicados({ nombre: 'Ana Pérez', email: 'ana@x.com' }, [base]);
  assert.equal(cs.length, 1);
  assert.match(textoDuplicado(cs, 'Mentoría'), /en Mentoría/,
    'el aviso no nombra el producto donde está el lead');
  // Y sin producto resuelto NO inventa un «en» colgando de la nada.
  assert.ok(!/ en /.test(textoDuplicado(cs).replace(/con el.*/, '')),
    'el aviso escribe un «en» sin producto detrás');
});

test('⚠️ NULL y el id del embudo por defecto son EL MISMO LUGAR', () => {
  // Es la trampa que hace que todo lo de arriba importe. Con los 1.530 leads en NULL,
  // comparar los números crudos diría «está en otro producto» sobre CADA lead del
  // negocio — o sea, ofrecería moverlos al tablero donde ya están.
  //
  // Probado rompiéndolo: `enOtroProducto` compara `c.lead.funnel_id !== funnelActual`
  // sin normalizar los dos lados -> 6 / 1 (undefined !== null da true).
  const sinFunnel: LeadExistente = { id: 1, nombre: 'Ana', email: null, telefono_normalizado: null, funnel_id: null };
  const c = { lead: sinFunnel, motivo: 'email' as const, texto: 'mismo email' };
  assert.equal(enOtroProducto(c, null), false, 'un lead sin funnel, mirando el del negocio, NO está en otro producto');
  assert.equal(enOtroProducto(c, 14), true, 'un lead del negocio, mirando otro producto, SÍ está en otro');

  // Y el caso que trae la consulta sin la columna: `undefined` es «no sé», y no se
  // puede leer como «está en otro lado».
  const sinColumna = { lead: { id: 2, nombre: 'B', email: null, telefono_normalizado: null } as LeadExistente, motivo: 'email' as const, texto: 'x' };
  assert.equal(enOtroProducto(sinColumna, null), false,
    'un lead cuya columna no viajó se lee como «en otro producto»: el aviso ofrecería agregarlo a donde ya está');
});

test('⚠️ «está en este producto» es por CASA o por FILA (mig 0207), y el id del negocio escrito es el negocio', () => {
  // «No se debe "Mover" se debe agregar al otro producto» (Martín, 06/10/2026). Con eso un
  // lead puede estar acá SIN que acá sea su casa: comparar sólo `funnel_id` le ofrecería
  // «Agregarlo aquí» a alguien que ya está agregado. Y `moverLeadDeFunnel` escribe el id
  // CRUDO del default, así que sin traducir los dos lados un lead con el id del negocio
  // escrito, mirado desde el negocio, saldría como «en otro producto».
  //
  // Probado rompiéndolo (los números, abajo en el comentario del archivo de la tanda):
  //   · `estaEnProducto` sin el chequeo de las filas            -> este test cae
  //   · `estaEnProducto` comparando `funnel_id` crudo, sin `casaReal` -> este test cae
  const DEF = 5;
  const casaX: Pick<LeadExistente, 'funnel_id' | 'productos'> = { funnel_id: 14, productos: [22] };
  assert.equal(estaEnProducto(casaX, 14, DEF), true, 'mirando su casa, está');
  assert.equal(estaEnProducto(casaX, 22, DEF), true, 'mirando un producto donde está AGREGADO, está');
  assert.equal(estaEnProducto(casaX, 30, DEF), false, 'mirando un producto donde no está, no está');
  assert.equal(estaEnProducto(casaX, null, DEF), false, 'su casa es otro y no tiene fila del negocio: no está en el negocio');

  // El producto del negocio, cuando NO es la casa, va en la fila con su id real.
  const agregadoAlNegocio = { funnel_id: 14, productos: [DEF] };
  assert.equal(estaEnProducto(agregadoAlNegocio, null, DEF), true,
    'agregado al negocio (fila con el id del default) y mirando el negocio (null): está');

  // El id del default escrito en la casa ES el negocio.
  assert.equal(estaEnProducto({ funnel_id: DEF }, null, DEF), true,
    'casa con el id del negocio escrito, mirando el negocio: está (sin `casaReal` diría que no)');
  assert.equal(estaEnProducto({ funnel_id: null }, DEF, DEF), true,
    'casa NULL, mirando el negocio por su id: está');

  // Sin saber el default, una fila no puede ser «el negocio»: no se inventa.
  assert.equal(estaEnProducto({ funnel_id: 14, productos: [DEF] }, null), false,
    'sin defaultId, «mirando null» no puede matchear una fila: no se adivina qué id es el negocio');

  // Y el inverso con el nombre de siempre.
  const c = { lead: { id: 9, nombre: 'Ana', email: null, telefono_normalizado: null, funnel_id: 14, productos: [22] } as LeadExistente, motivo: 'email' as const, texto: 'x' };
  assert.equal(enOtroProducto(c, 22, DEF), false, 'agregado acá: NO está «en otro producto» en el sentido de «no está acá»');
  assert.equal(enOtroProducto(c, 30, DEF), true);
});

test('⚠️ el alta devuelve las COINCIDENCIAS, no un string, y sólo una persona autoriza el duplicado', () => {
  // `LeadDuplicadoError` trae las coincidencias adentro justamente para que la pantalla
  // pueda ofrecer algo. La action las tiraba en el `catch` y devolvía `{ error }` pelado:
  // sin los ids no hay «abre el que ya tienes» ni «muévelo aquí», y un aviso sin salida
  // es el que manda a alguien a buscar a mano en otro tablero.
  //
  // Probado rompiéndolo (7 / 0 con el guard puesto):
  //   · la action vuelve a devolver sólo `{ error }`            -> 6 / 1
  //   · `permitirDuplicado` se pone en true por default          -> 6 / 1
  const ac = limpio(leer('app/crm/actions.ts'));
  assert.match(ac, /e instanceof LeadDuplicadoError/,
    'el alta volvió a tratar un duplicado como un error cualquiera');
  assert.match(ac, /coincidencias: e\.coincidencias\.map/,
    'las coincidencias no llegan a la pantalla');

  // El permiso es explícito y viaja desde la UI: nunca un default.
  assert.match(ac, /permitirDuplicado\?: boolean/,
    'el permiso para duplicar dejó de ser un parámetro explícito');
  assert.ok(!/permitirDuplicado(\s*[:=]\s*true|\s*=\s*true)/.test(ac),
    'alguien puso `permitirDuplicado` en true por default: el anti-duplicado dejó de existir');

  // Y la pantalla ofrece las tres salidas.
  // ⚠️ La del medio AGREGA desde el 06/10/2026 (mig 0207): «No se debe "Mover" se debe
  // agregar al otro producto». Probado rompiéndolo: volver a «Moverlo aquí» con
  // `moverLeadAFunnelAction` -> cae acá.
  const nf = limpio(leer('app/crm/new/NewLeadForm.tsx'));
  for (const salida of ['Abrir', 'Agregarlo aquí', 'Crear igual']) {
    assert.ok(nf.includes(salida), `la pantalla del duplicado perdió la salida «${salida}»`);
  }
  assert.ok(!nf.includes('Moverlo aquí'), 'volvió «Moverlo aquí»: el alta tiene que AGREGAR al producto, nunca mover');
  assert.ok(!/moverLeadAFunnelAction/.test(nf), 'el alta volvió a MOVER al lead (le cambia la casa y le resetea la etapa)');
  assert.match(nf, /agregarAProductoAction\(c\.id, destino\)/, '«Agregarlo aquí» dejó de llamar a agregarAProductoAction');
  // Y aparece sólo si NO está acá — por casa O por fila, decidido en el server. Un
  // `c.funnelId !==` crudo le ofrecía agregarlo a alguien que ya estaba agregado.
  assert.match(nf, /enModal && !c\.estaAca &&/, '«Agregarlo aquí» dejó de colgar de `estaAca`');
  assert.ok(!/c\.funnelId\s*!==/.test(nf), 'la pantalla volvió a decidir con el `funnelId` crudo de la casa');
  // El choque se decide contra el producto desde donde se da el alta, con la regla pura.
  const ch = bloque(ac, 'async function choqueDeLead(');
  assert.match(ch, /choqueDeLead\(e: unknown, funnelActual: number \| null\)/, 'el choque dejó de saber desde qué producto se da el alta');
  assert.match(ch, /from\('lead_funnel'\)/, 'el choque dejó de leer las FILAS de las coincidencias: un agregado saldría como «no está acá»');
  assert.match(ch, /estaAca: estaEnProducto\(/, '`estaAca` dejó de salir de `estaEnProducto`');
  assert.match(ac, /return await choqueDeLead\(e, funnelId \?\? null\);/, 'el alta del tablero dejó de pasarle su producto al choque');
  // «Traer de otro producto» va APARTE del formulario, que es como se pidió.
  // ⚠️ EL BOTÓN NO ABRE NADA EN EL FORM: avisa al padre, que cambia la VISTA del modal.
  //    «Cuando le doy, debe reemplazar al formulario de arriba, con un botón de atrás
  //    claro» (30/09). Abriéndose debajo, el modal pedía dos cosas a la vez.
  assert.match(nf, />\s*Traer de otro producto\s*</, 'se fue la opción de traer un lead de otro producto');
  assert.match(nf, /onTraer\?: \(\) => void/, 'el form volvió a resolver el traer por su cuenta: no puede, la vista necesita otro ancho');
  assert.ok(!/function TraerDeOtroProducto/.test(nf), 'el traedor volvió a vivir adentro del form');
});

test('⚠️ el velo de hover cubre el CRM entero, y se apaga donde tiene que apagarse', () => {
  // «En todos los botones si les paso el cursor debería pasar algo». Medido antes de
  // escribirlo: de los 149 `<button>` de `app/crm/**`, CUATRO reaccionaban.
  //
  // ⚠️ Y NO PUEDE SER `background`: 129 de esos 145 botones escriben `background` inline,
  // y un estilo en línea le gana a cualquier regla de hoja sin `!important`. Lo que está
  // libre es `box-shadow` (1 de 145).
  //
  // Probado rompiéndolo (7 / 0 con el guard puesto):
  //   · la regla pasa a usar `background`        -> 6 / 1
  //   · se saca la clase del `<main>` del tablero -> 6 / 1
  const css = leer('app/_ui/ui.css');
  assert.match(css, /\.crm-hover button:hover:not\(:disabled\)/,
    'el velo de hover dejó de existir, o dejó de excluir a los botones apagados');
  assert.match(css, /box-shadow: inset 0 0 0 999px var\(--velo-hover\)/,
    'el velo dejó de pintarse con `box-shadow`: cualquier otra propiedad pierde contra los 129 `background` inline');
  assert.ok(!/\.crm-hover button:hover[^{]*\{[^}]*\bbackground:/.test(css),
    'el velo volvió a usar `background`, que los estilos inline pisan');

  // El token existe en los DOS temas: en oscuro un velo negro no se ve.
  const g = leer('app/globals.css');
  assert.equal((g.match(/--velo-hover:/g) ?? []).length, 2,
    `\`--velo-hover\` tiene que estar definido en claro Y en oscuro`);

  // Y la clase está en las tres rutas del CRM, que es lo que la vuelve una regla del
  // CONJUNTO y no de cada botón.
  for (const ruta of ['app/crm/CrmBoard.tsx', 'app/crm/[id]/page.tsx', 'app/crm/new/page.tsx']) {
    assert.match(leer(ruta), /<main className="crm-hover"/,
      `${ruta} perdió la clase: sus botones vuelven a no reaccionar, y los que se escriban mañana también`);
  }
});

test('⚠️ lo IMPORTADO nace en el tablero desde donde se importó', () => {
  // Hasta el 30/09/2026 `importarLeadsRevisadosAction` no recibía el funnel: **todo lo
  // importado desde un producto secundario nacía en el embudo del negocio y desaparecía de
  // la pantalla donde se lo acababa de importar**. El alta manual ya lo tenía arreglado
  // desde el 28/09 por el otro camino, y nadie cruzó los dos. Sin error y sin una fila
  // perdida: la fila entraba bien y el tablero la buscaba en otro lado.
  //
  // Probado rompiéndolo (el archivo entero da 10 / 0):
  //   · la action deja de recibir el funnel      -> 9 / 1
  //   · el modal deja de pasárselo               -> 9 / 1
  const ac = limpio(leer('app/crm/actions.ts'));
  assert.match(ac, /export async function importarLeadsRevisadosAction\(filas: FilaImport\[\], funnelId\?: number \| null\)/,
    'la importación volvió a no saber a qué producto van los leads');
  // Y lo ESCRIBE: recibirlo y no pasarlo a `createLead` es el mismo bug con un parámetro más.
  const cuerpo = ac.slice(ac.indexOf('importarLeadsRevisadosAction(filas'));
  assert.match(cuerpo.slice(0, 4000), /funnel_id: funnelId \?\? null/,
    'la importación recibe el funnel y no lo escribe');
  const mod = limpio(leer('app/crm/ImportarLeadsModal.tsx'));
  assert.match(mod, /importarLeadsRevisadosAction\(filas, funnelId\)/,
    'el modal de importar dejó de pasar el producto que se está mirando');
});

test('⚠️ el botón partido vive en UN lugar, y los dos ejes salen de ahí', () => {
  // «Pon un botón doble, que esté en la misma linea y se divida a la mitad… y que cada uno
  // sirva para mover la etapa de lugar». Lo dibujan DOS pantallas: la fila de una etapa en
  // el pop-up (vertical) y la cabecera de una columna del tablero (horizontal). Son la misma
  // pieza con el eje cambiado, y las dos se ven con un clic de distancia: dos copias
  // divergen en el primer ajuste y se nota.
  //
  // Probado rompiéndolo (10 / 0 con el guard puesto):
  //   · el tablero se escribe su propia copia   -> 9 / 1
  //   · el control se dibuja sobre una terminal -> 9 / 1
  const mp = leer('app/crm/MoverPartido.tsx');
  assert.match(mp, /export function MoverPartido/, 'se fue el control compartido');
  // Si no se puede mover para ningún lado NO se dibuja: un control entero en gris ocupa el
  // lugar de los que sí se pueden usar.
  assert.match(mp, /if \(!puedeAntes && !puedeDespues\) return null;/,
    'el botón partido volvió a dibujarse entero en gris');
  assert.match(limpio(leer('app/crm/EtapasModal.tsx')), /from '\.\/MoverPartido'/,
    'el pop-up del embudo no importa el control compartido: se escribió una copia');

  // ⚠️ EN EL TABLERO LAS FLECHAS VIVEN ADENTRO DEL MENÚ DE LOS TRES PUNTOS, no en la
  //    cabecera: «las flechas de desplazar en las columnas deben de estar DENTRO del
  //    desplegable» (30/09/2026). Estuvieron sueltas menos de un día — con 12 columnas, dos
  //    botones más por cabecera son 24 controles arriba de las listas.
  const bd = limpio(leer('app/crm/CrmBoard.tsx'));
  assert.ok(!/<MoverPartido/.test(bd), 'el control partido volvió a la cabecera de la columna');
  assert.match(bd, /\.\.\.\(seArrastraCol\(c\) \? \[\{[\s\S]{0,200}value: 'mover'/,
    'la fila «Mover» del menú dejó de colgar del mismo predicado que el arrastre, o desapareció');
  assert.match(bd, /FlechaIzquierdaIcon/, 'las flechas del menú de la columna no son horizontales');
});

test('⚠️ importar tiene DOS orígenes, y el de otro producto no pasa por la tabla de revisión', () => {
  // «Que dentro del pop-up que aparece, me de la opción de importar leads de otro producto,
  // para que sea fácil».
  //
  // ⚠️ Y NO PASA POR `TablaRevisionLeads` a propósito, que es lo que hace que funcione:
  // `indiceContactos` escanea la tabla `leads` del tenant SIN filtro de funnel, así que todo
  // lo traído de otro producto llega marcado `duplicado` — y esa tabla no deja tildar una
  // fila con motivo (`disabled={fuera}`). Enchufado ahí, el botón diría «No hay nada
  // tildado» sobre una lista entera de gente que existe.
  //
  // Probado rompiéndolo (10 / 0 con el guard puesto):
  //   · se saca el selector de origen           -> 9 / 1
  //   · el traído se manda por la tabla         -> 9 / 1 (el import de la action desaparece)
  const mod = limpio(leer('app/crm/ImportarLeadsModal.tsx'));
  assert.match(mod, /useState<'archivo' \| 'producto'>/, 'el modal de importar volvió a tener un solo origen');
  // ⚠️ ES EL MISMO COMPONENTE QUE EL DE «Nuevo lead», no una copia. Acá había un buscador
  //    de una línea y allá una tabla con filtros, haciendo lo mismo: la segunda pantalla
  //    para una misma tarea es siempre la que se queda vieja.
  assert.match(mod, /<TraerDeOtroProducto/, 'el modal de importar se escribió su propio traedor otra vez');
  assert.ok(!/function TraerDeProducto\b/.test(mod), 'volvió el traedor propio del importador');
  const tr = limpio(leer('app/crm/TraerDeOtroProducto.tsx'));
  // ⚠️ AGREGA EN LOTE, NO MUEVE (06/10/2026, mig 0207). Probado rompiéndolo: volver a
  // importar `moverLeadsAFunnelAction` -> cae acá (y además no compila: se borró).
  assert.match(tr, /agregarLoteAProductoAction\(sel, destino\)/, 'traer de otro producto dejó de AGREGAR en lote');
  assert.ok(!/moverLeadsAFunnelAction/.test(tr), 'traer de otro producto volvió a MOVER: le saca el lead al tablero donde estaba');
  // Y UN deshacer, que borra sólo lo que este lote creó.
  assert.match(tr, /quitarLoteDeProductoAction\(agregados, destino\)/, 'el «traer» perdió su deshacer');
  // Las tres cosas que Martín pidió ver en esa pantalla.
  assert.match(tr, /Traer de/, 'se fue el selector de DE QUÉ producto traer');
  assert.match(tr, /Buscar por nombre, email o teléfono/, 'se fue la barra de búsqueda');
  assert.match(tr, /Todas las etapas/, 'se fue el filtro por etapa');
  assert.match(tr, /alternarTodos/, 'se fue la selección múltiple');
  // ⚠️ Y «tildar todos» tilda lo VISIBLE, no lo que hay: con un filtro puesto, llevarse lo
  //    escondido agrega gente que la persona no vio. Y de lo visible, sólo lo TILDABLE: los
  //    que ya están acá (`yaEsta`) no entran.
  assert.match(tr, /const tildables = enPantalla\.filter\(\(f\) => !f\.yaEsta\)/,
    '«tildar todos» dejó de saltear a los que YA están en este producto');
  assert.match(tr, /const ids = tildables\.map/,
    '«tildar todos» volvió a mirar la lista entera en vez de lo que está en pantalla');
  // El lote dice lo que ENTRÓ y lo que no: «listo» sobre diez cuando entraron seis manda a
  // buscar los cuatro a un tablero donde no están.
  assert.match(tr, /onTraidos\(agregados\.length, r\.fallaron,/,
    'el «traer» dejó de reportar cuántos ENTRARON (no cuántos se tildaron) y cuántos fallaron');
});

test('⚠️ ningún camino del CRM MUEVE un lead de producto: todos AGREGAN (06/10/2026)', () => {
  // «Le acabo de dar a un lead a "Mover a prueba" y se desapareció del producto principal de
  // Mauricio. Eso JAMÁS debe pasar... No se debe "Mover" se debe agregar al otro producto»
  // (Martín). `moverLeadAFunnelAction` y `moverLeadsAFunnelAction` le cambiaban la casa al
  // lead y lo reseteaban a la etapa de entrada —a un Ganado le pisaban la etapa con la venta
  // colgando—, y las llamaban CUATRO caminos: «traer de otro producto», la barra de lote, el
  // «Moverlo aquí» del alta y el desplegable de la ficha. Los cuatro agregan; las dos se
  // borraron.
  //
  // Probado rompiéndolo (números en el comentario del archivo):
  //   · se devuelve `moverLeadsAFunnelAction` a actions.ts            -> cae
  //   · un archivo de app/ vuelve a importar `moverLeadAFunnelAction`  -> cae
  //   · la barra de lote vuelve a preguntar «¿Mover N a X?»            -> cae
  //   · la barra de lote pierde el deshacer                            -> cae
  const ac = limpio(leer('app/crm/actions.ts'));
  for (const nombre of ['moverLeadsAFunnelAction', 'moverLeadAFunnelAction']) {
    assert.ok(!new RegExp(`function ${nombre}\\b`).test(ac),
      `volvió \`${nombre}\`: mover le saca el lead al tablero donde estaba y le resetea la etapa`);
  }

  // Nadie las LLAMA ni las IMPORTA en código (app/ y lib/, sin comentarios). Se busca la
  // llamada o el import y no la palabra: la bitácora de /admin/dev cita una adentro de un
  // string (`app/admin/dev/crm/bitacora.ts`), y eso es historia, no un call site.
  // El `includes` crudo va PRIMERO a propósito: sacar comentarios de los ~2.000 fuentes del
  // repo tardaba 34 s; así sólo se limpian los que nombran la palabra.
  const usa = (src: string, nombre: string) =>
    new RegExp(`\\b${nombre}\\s*\\(|import\\s*(type\\s*)?\\{[^}]*\\b${nombre}\\b`).test(src);
  const fuentes = execFileSync('git', ['ls-files', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8' })
    .split(/\r?\n/).map((f) => f.trim()).filter((f) => /\.(ts|tsx)$/.test(f));
  assert.ok(fuentes.length > 200, `git ls-files devolvió ${fuentes.length}: esto no corrió en el repo`);
  for (const nombre of ['moverLeadsAFunnelAction', 'moverLeadAFunnelAction']) {
    const quienes = fuentes.filter((f) => {
      const crudo = leer(f);
      return crudo.includes(nombre) && usa(limpio(crudo), nombre);
    });
    assert.deepEqual(quienes, [], `alguien volvió a llamar a \`${nombre}\`: ese camino tiene que AGREGAR (lead-funnel-actions)`);
  }

  // La barra de lote AGREGA, al toque, con UN deshacer.
  const lote = limpio(leer('app/crm/AccionesLoteLeads.tsx'));
  assert.match(lote, /agregarLoteAProductoAction\(ids, funnelId\)/, 'la acción de lote «Producto» dejó de agregar');
  assert.match(lote, /quitarLoteDeProductoAction\(agregados, funnelId\)/, 'la acción de lote «Producto» perdió su deshacer');
  assert.match(lote, /deshacer\?: \(\) => Promise<void>/, 'el resultado de lote dejó de poder llevar UN deshacer al padre');
  assert.ok(!/tipo: 'producto'/.test(lote),
    'la barra volvió a PREGUNTAR antes de agregar: sumar es reversible y se deshace desde el aviso');
});

test('⚠️ el traer MARCA a los que ya están en el destino, y el conteo del pop-up ve a los agregados', () => {
  // Dos lecturas que con el modelo nuevo (mig 0207) contaban de menos:
  //   · la lista de «traer» no sabía quién YA estaba en el destino (por casa o por fila), y
  //     «Agregar 12» agregaba 9 sin decir por qué;
  //   · el conteo por etapa del pop-up contaba con `deriveStageKey` solo, que mira las
  //     columnas de la CASA: un agregado en una etapa de este tablero no sumaba ahí, y la
  //     etapa con gente agregada decía 0 — o sea que se quitaba sin preguntar. Lo mismo le
  //     pasaba a toda etapa PROPIA del cliente, a la que sólo se llega por `pipeline_stage`.
  //
  // Probado rompiéndolo (números en el comentario del archivo):
  //   · `extrasDelEmbudoAction` vuelve a `deriveStageKey(l …)` -> cae
  //   · `yaEstanEnProducto` deja de leer las filas del destino  -> cae
  const ac = limpio(leer('app/crm/actions.ts'));

  const regla = bloque(ac, 'function etapaComoTablero(');
  assert.match(regla, /l\.pipeline_stage && validas\.has\(l\.pipeline_stage\)/,
    'la etapa del tablero dejó de preferir el override válido (para un agregado, la etapa de su fila)');

  const extras = bloque(ac, 'export async function extrasDelEmbudoAction(');
  assert.match(extras, /const k = etapaComoTablero\(l, validas\);/,
    'el conteo por etapa dejó de usar la regla que dibuja la tarjeta: los agregados y las etapas propias vuelven a contar 0');
  assert.ok(!/deriveStageKey\(/.test(extras), 'el conteo volvió a `deriveStageKey` solo');
  assert.match(extras, /for \(const st of cfg\.stages\) out\[st\.key\] = 0;/,
    'el conteo dejó de inicializarse con TODAS las etapas: una vacía vuelve a leerse como «no sé»');

  const ya = bloque(ac, 'async function yaEstanEnProducto(');
  assert.match(ya, /from\('lead_funnel'\)\.select\('lead_id'\)\.eq\('funnel_id', destinoId\)/,
    'el «ya está» dejó de mirar las FILAS del destino');
  assert.match(ya, /casaReal\(/, 'el «ya está» dejó de traducir la casa NULL al producto del negocio');

  const lista = bloque(ac, 'export async function leadsDeProductoAction(');
  assert.match(lista, /leadsDeProductoAction\(funnelId: number \| null, destino\?: number \| null\)/,
    'la lista de traer dejó de saber a qué producto se agrega');
  assert.match(lista, /yaEsta: yaEstan\.has\(l\.id\)/, 'la lista de traer dejó de marcar a los que ya están');
  assert.match(lista, /etapaComoTablero\(l, validas\)/, 'la lista de traer y el tablero dejaron de ubicar al lead con la misma regla');

  // Y la pantalla manda el destino.
  const tr = limpio(leer('app/crm/TraerDeOtroProducto.tsx'));
  assert.match(tr, /leadsDeProductoAction\(pedido, destino\)/, 'la pantalla de traer dejó de mandar el destino');
});