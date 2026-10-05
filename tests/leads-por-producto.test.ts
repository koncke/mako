// =============================================================================
// Un lead vive en UN producto, y `funnel_id` NULL es el producto del negocio
// =============================================================================
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
import { buscarDuplicados, textoDuplicado, enOtroProducto, type LeadExistente } from '../lib/leads-duplicados';

const RAIZ = join(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8');

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

test('⚠️ `funnel_id` tiene UN solo escritor después del alta, y se llama mover', () => {
  // Un lead que cambia de producto cambia en qué tablero lo ve la gente. Si eso se
  // puede escribir desde cualquier lado, un día un update de otra cosa se lo lleva
  // puesto y el lead desaparece de la pantalla donde alguien lo estaba trabajando.
  //
  // Probado rompiéndolo: se agrega `funnel_id` a `LeadUpdateInput` -> 6 / 1.
  const ld = limpio(leer('lib/leads.ts'));
  assert.match(ld, /export async function moverLeadDeFunnel/,
    'se fue la única puerta declarada para mover un lead de producto');

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
    'un lead cuya columna no viajó se lee como «en otro producto»: el aviso ofrecería moverlo a donde ya está');
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
  const nf = limpio(leer('app/crm/new/NewLeadForm.tsx'));
  for (const salida of ['Abrir', 'Moverlo aquí', 'Crear igual']) {
    assert.ok(nf.includes(salida), `la pantalla del duplicado perdió la salida «${salida}»`);
  }
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
  assert.match(tr, /moverLeadsAFunnelAction/, 'traer de otro producto dejó de mover en lote');
  // Las tres cosas que Martín pidió ver en esa pantalla.
  assert.match(tr, /Traer de/, 'se fue el selector de DE QUÉ producto traer');
  assert.match(tr, /Buscar por nombre, email o teléfono/, 'se fue la barra de búsqueda');
  assert.match(tr, /Todas las etapas/, 'se fue el filtro por etapa');
  assert.match(tr, /alternarTodos/, 'se fue la selección múltiple');
  // ⚠️ Y «tildar todos» tilda lo VISIBLE, no lo que hay: con un filtro puesto, llevarse lo
  //    escondido mueve gente que la persona no vio.
  assert.match(tr, /const ids = enPantalla\.map/,
    '«tildar todos» volvió a mirar la lista entera en vez de lo que está en pantalla');
  // El lote dice lo que ENTRÓ y lo que no: «listo» sobre diez cuando entraron seis manda a
  // buscar los cuatro a un tablero donde no están.
  const ac = limpio(leer('app/crm/actions.ts'));
  assert.match(ac, /return \{ movidos, fallaron \};/,
    'el movimiento en lote volvió a devolver un booleano: no puede decir cuántos entraron');
});