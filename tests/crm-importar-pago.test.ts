// =============================================================================
// La columna de PAGO entra como venta, y el cruce mira TODAS las etapas (#622)
// =============================================================================
// Dos cosas, y la segunda es la que Martín remarcó el 04/10/2026: «Si, que lo detecte,
// pero no solo los "Ganados" sino, todos los leads de cualquier etapa... Eso es
// importante para evitar duplicados.»
//
// 1) La tarjeta sale de que Leila carga a mano sus clientes de pago recurrente y TODOS
//    caían en «Lead (Instant form)» — gente que ya pagó esperando una primera reunión.
//    Lo que entra acá es una PROPUESTA: la fila se dibuja diciendo a dónde va y la
//    persona confirma o la apaga, que es la regla de la casa.
//
// 2) EL CRUCE. Medido contra producción ese día, y el resultado tiene dos mitades:
//
//    · **Por etapa no filtra nada, y está bien.** `indiceContactos` lee `leads` sin un
//      solo `.eq` de etapa, estado ni funnel: entran las 1.549 filas de los 6 workspaces
//      con leads, 72 de ellas en un estado terminal (14 ganado + 16 perdido + 8 descal +
//      2 no responde en ws1, 2 en ws4, 3 en ws9, 1 en ws10, 12 en ws11, 14 en ws13) — y
//      entran. Lo único que recorta es el `workspace_id` de getTenantDb, que es
//      aislamiento. Eso queda FIJADO acá: un filtro por etapa en esa lectura es
//      exactamente lo que crearía el duplicado que la decisión viene a evitar.
//
//    · **Por TELÉFONO sí dejaba afuera a casi toda la tabla, y ése era el bug.** El
//      índice comparaba los DÍGITOS COMPLETOS. De los 1.154 leads de ws1 con teléfono,
//      UNO tiene 10 dígitos; 1.027 tienen 13 y 115 tienen 16, porque entraron desde
//      WhatsApp y desde Meta con código de país. O sea que un CSV con números locales
//      —como se tipea una lista de clientes— matcheaba **1 de 1.154**: los otros 1.153 se
//      importaban como leads nuevos, y las dos fichas quedaban inalcanzables para la
//      ingesta siguiente (dos filas con el mismo `telefono_normalizado` rompen con
//      PGRST116 el `.maybeSingle()` de Calendly y del instant form). El criterio no se
//      inventó: es `telefonoComparable`, el MISMO del alta manual y del inbox de
//      WhatsApp. Pares que hoy comparten los últimos 10 dígitos sin compartir los
//      completos: 0 en los 6 workspaces, así que esto no vuelve ambiguo nada que hoy
//      matchee limpio.
//
// ⚠️ PROBADO ROMPIÉNDOLO, las diecisiete. Con el arreglo puesto: 19 pases, 0 fallos.
//   · `montoDeTexto` lee «1.200» con `Number` (el punto como decimal) ....... 3 FALLOS, 17 pases
//   · `ALIAS_PAGO` acepta 'total' y 'precio' ................................. 1 FALLO, 18 pases
//   · `pagoDeCelda` acepta el 0, el negativo y lo fuera de escala ............ 1 FALLO, 18 pases
//   · la columna de pago no excluye las de FECHA ............................. 2 FALLOS, 17 pases
//   · la columna de pago no excluye las cinco ya mapeadas .................... 1 FALLO, 18 pases
//   · `filasDesdeCsv` no propone (no escribe `comoGanado`) ................... 2 FALLOS, 17 pases
//   · `entraGanado` sin el gate del archivo (`comoGanado` pelado) ............ 2 FALLOS, 17 pases
//   · `entraGanado` ignora el destino (la fila que completa entra como venta) . 2 FALLOS, 17 pases
//   · `contar` no suma `comoGanado` .......................................... 1 FALLO, 18 pases
//   · `etapaDeGanado` busca por `kind === 'cierre'` en vez de por la clave ... 1 FALLO, 18 pases
//   · `buscarTelefono` vuelve a comparar sólo los dígitos completos .......... 2 FALLOS, 17 pases
//   · la lectura del índice trae `pipeline_stage` ............................ 1 FALLO, 18 pases
//   · la lectura del índice filtra por `estado_lead` ......................... 1 FALLO, 18 pases
//   · la lectura del índice filtra por `funnel_id` ........................... 1 FALLO, 18 pases
//   · `marcarExistentes` resuelve el teléfono por su cuenta .................. 1 FALLO, 18 pases
//   · la importación cablea la etapa como la cadena 'ganado' ................. 1 FALLO, 18 pases
//   · el portón del ganado deja de pasar por `entraGanado` ................... 1 FALLO, 18 pases
//
// ⚠️ Y ROMPERLO ENCONTRÓ DOS AGUJEROS EN ESTE ARCHIVO, no en el código — los dos daban
// VERDE sobre la rotura (18 pases, 0 fallos — medido sobre la versión de 18 tests de este
// archivo, antes de arreglarlos) y están explicados en su propio test:
//   · el assert de «una columna ya mapeada» medía el parser del importe, no la exclusión.
//   · el assert de `entraGanado` leía el BLOQUE entero, donde esa función aparece también
//     en el `some(...)` de arriba: encontraba lo que el archivo dice de sí mismo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { etapaDeGanado, type Stage } from '../lib/pipeline';
import {
  ALIAS_PAGO, MAX_MONTO_IMPORT, buscarTelefono, clavesDeTelefono, contar, entra, entraGanado,
  filasDesdeCsv, montoDeTexto, pagoDeCelda, recalcular, type FilaImport, type IndiceTelefonos,
} from '../app/crm/leads-importar';

const leer = (p: string) => readFileSync(join(import.meta.dirname, '..', p), 'utf8');
/** Lo que un archivo EJECUTA, sin su prosa (los de línea ANTES que los de bloque). */
const soloCodigo = (src: string): string =>
  src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const fila = (p: Partial<FilaImport>): FilaImport => ({
  id: 'x', nombre: 'Juan Pérez', email: 'juan@x.com', telefono: '', empresa: '',
  incluir: true, yaExiste: false, ...p,
});
/** Una fila con pago, tal como la deja `filasDesdeCsv`. */
const conPago = (p: Partial<FilaImport> = {}): FilaImport =>
  recalcular([fila({ pagoEnArchivo: true, montoPago: 1200, comoGanado: true, ...p })])[0];

// ─────────────────────────────────────────────────────────────────────────────
// El importe: las dos convenciones de separador
// ─────────────────────────────────────────────────────────────────────────────

test('«1.200» son mil doscientos, no uno con veinte', () => {
  // Es el caso que `Number` lee al revés, y leerlo mal no da error: mete al CRM una venta
  // de US$1,20 donde hay un cliente de 1.200.
  assert.equal(montoDeTexto('1.200'), 1200);
  assert.equal(montoDeTexto('1.200.000'), 1_200_000);
  assert.equal(montoDeTexto('1.200,50'), 1200.5, 'coma Y punto: el último manda');
  assert.equal(montoDeTexto('1,200.50'), 1200.5, 'y al revés también');
  assert.equal(montoDeTexto('1200,5'), 1200.5, 'un separador con 1 dígito detrás es decimal');
  assert.equal(montoDeTexto('$ 1 200 MXN'), 1200, 'el símbolo y el código de moneda se van');
});

test('lo que NO es un importe devuelve null, incluida una fecha', () => {
  // Una fecha no puede volverse un monto: un número inventado a partir de «2026-03-15»
  // sería una venta de 2026 dólares, y nadie podría rastrear de dónde salió.
  assert.equal(montoDeTexto('2026-03-15'), null);
  assert.equal(montoDeTexto(''), null);
  assert.equal(montoDeTexto('pagado'), null);
});

test('un 0, un negativo o un número fuera de escala NO son un pago', () => {
  // El negativo no se toma por valor absoluto a propósito: eso convertiría una devolución
  // o un saldo en contra en una venta.
  assert.deepEqual(pagoDeCelda('0'), { pago: false, monto: null });
  assert.deepEqual(pagoDeCelda('-500'), { pago: false, monto: null });
  assert.deepEqual(pagoDeCelda(String(MAX_MONTO_IMPORT + 1)), { pago: false, monto: null },
    'sin tope, una celda con un teléfono pegado entra como una venta de mil millones');
  assert.deepEqual(pagoDeCelda(''), { pago: false, monto: null });
  assert.deepEqual(pagoDeCelda('no'), { pago: false, monto: null });
});

test('«sí» es un pago SIN monto, y eso no es lo mismo que no haber pagado', () => {
  assert.deepEqual(pagoDeCelda('Sí'), { pago: true, monto: null });
  assert.deepEqual(pagoDeCelda('PAGADO'), { pago: true, monto: null });
  assert.deepEqual(pagoDeCelda('1.200'), { pago: true, monto: 1200 });
});

// ─────────────────────────────────────────────────────────────────────────────
// La columna, leída de un CSV real
// ─────────────────────────────────────────────────────────────────────────────

test('la columna de pago se detecta por inclusión y PROPONE entrar como venta', () => {
  const [a, b] = filasDesdeCsv(
    'Nombre,Email,Teléfono,Total cobrado\n'
    + 'Ana Gómez,ana@x.com,9981234567,"1.500"\n'
    + 'Luis Paz,luis@x.com,9987654321,\n',
  ).filas;
  assert.equal(a.pagoEnArchivo, true, '«Total cobrado» es la columna de pago');
  assert.equal(a.montoPago, 1500);
  assert.equal(a.comoGanado, true, 'la propuesta nace PRENDIDA: ésa es la propuesta');
  assert.equal(b.pagoEnArchivo, undefined, 'la fila sin pago no lleva la pregunta encima');
  assert.equal(b.comoGanado, undefined);
});

test('la lista de alias de pago NO incluye lo ambiguo', () => {
  // Es una regla de ADMISIÓN y por eso se fija: el costo de un falso positivo acá no es
  // una celda mal leída, es un lead propuesto como VENTA con un monto sacado de un
  // catálogo de productos. «Total», «precio» y «venta» aparecen en listas que no dicen
  // que alguien pagó — y «Total cobrado» entra igual, por 'cobrado'.
  for (const ambiguo of ['total', 'precio', 'venta', 'valor']) {
    assert.ok(!ALIAS_PAGO.includes(ambiguo),
      `«${ambiguo}» entró a los alias de pago: un alias que falta se agrega el día que `
      + 'aparezca un archivo real que lo use, no por las dudas');
  }
  assert.ok(ALIAS_PAGO.includes('cobrado'), 'y «Total cobrado» tiene que seguir entrando');
});

test('entre «Fecha de pago» y el monto, gana el MONTO', () => {
  // «Fecha de pago» matchea 'pago' y suele venir ANTES, así que sin la exclusión
  // `findIndex` se queda con la fecha y el archivo que SÍ traía el importe entra sin
  // importe — y encima propondría la venta leyendo una fecha.
  const [f] = filasDesdeCsv(
    'Nombre,Email,Fecha de pago,Monto\nAna Gómez,ana@x.com,2026-03-15,"990"\n',
  ).filas;
  assert.equal(f.pagoEnArchivo, true);
  assert.equal(f.montoPago, 990, 'el monto, no el año');
});

test('una columna YA mapeada no puede ser además la de pago', () => {
  // ⚠️ ES UN GUARD DE LA CONDICIÓN Y NO UNA PRUEBA DE SALIDA, y el porqué está MEDIDO: con
  // los alias de hoy, ninguna columna ya mapeada sobrevive al parser del importe. Un
  // nombre y un email no tienen dígitos; un teléfono los tiene y lo frena el tope de
  // `MAX_MONTO_IMPORT`; una empresa es texto. O sea que la salida sale igual con la
  // exclusión puesta y sin ella —comprobado quitándola, con el assert de salida que este
  // test tenía antes: 18 pases, 0 fallos—, así que un
  // assert sobre la fila resultante estaría midiendo el parser y no esto.
  //
  // La exclusión protege del alias que todavía no existe: «Empresa de cobro» matchea
  // 'cobro' y es la EMPRESA, y el día que la lista de pago crezca —o que el tope suba— eso
  // propondría una venta por cada fila del archivo.
  const src = soloCodigo(leer('app/crm/leads-importar.ts'));
  const i = src.indexOf('const iPago = ');
  assert.ok(i > 0, 'no encontré la detección de la columna de pago: ¿se renombró?');
  const cond = src.slice(i, src.indexOf('\n', i));
  assert.match(cond, /!usadas\.has\(i\)/,
    'la columna de pago puede elegir una de las cinco ya mapeadas');
  assert.match(cond, /!coincide\(h, ALIAS_FECHA\)/,
    'y puede elegir una columna de fecha, que es la que suele venir primero');

  // Y la salida, sobre el caso que SÍ se puede medir: la empresa queda en su columna.
  const [f] = filasDesdeCsv('Nombre,Email,Empresa de cobro\nAna Gómez,ana@x.com,Vértice\n').filas;
  assert.equal(f.empresa, 'Vértice');
  assert.equal(f.pagoEnArchivo, undefined, 'y nadie propuso una venta por una razón social');
});

// ─────────────────────────────────────────────────────────────────────────────
// La decisión: UNA función, igual que `entra` y `enriquece`
// ─────────────────────────────────────────────────────────────────────────────

test('`entraGanado` exige las TRES cosas: se crea, el archivo lo dijo, y sigue prendido', () => {
  assert.equal(entraGanado(conPago()), true);
  assert.equal(entraGanado(conPago({ comoGanado: false })), false, 'la persona lo apagó');
  assert.equal(entraGanado(conPago({ incluir: false })), false, 'sin tilde no pasa nada');
  // El gate: `pagoEnArchivo` lo manda el cliente, así que no autoriza nada por sí solo —
  // frena la fila que llega marcada como venta sin que el archivo lo dijera.
  assert.equal(entraGanado(fila({ comoGanado: true })), false,
    'sin `pagoEnArchivo` no hay propuesta que confirmar');
});

test('una fila que COMPLETA la ficha que ya está no entra como venta', () => {
  // Completar llena los campos vacíos de alguien que ya existe (#623) y NO le mueve la
  // etapa: mover de etapa a un lead que alguien viene trabajando no es «completar lo que
  // falta», y pasaría por arriba de su historial.
  const dup = recalcular([fila({
    yaExiste: true, leadExistenteId: 44, enriquecer: true,
    pagoEnArchivo: true, montoPago: 1200, comoGanado: true,
  })])[0];
  assert.equal(entraGanado(dup), false);
  assert.equal(entra(dup), false, 'y tampoco se crea: completa');
});

test('`contar` suma los ganados DENTRO de las que se crean', () => {
  const filas = recalcular([
    fila({ id: 'a', email: 'a@x.com', pagoEnArchivo: true, montoPago: 500, comoGanado: true }),
    fila({ id: 'b', email: 'b@x.com', pagoEnArchivo: true, montoPago: 500, comoGanado: false }),
    fila({ id: 'c', email: 'c@x.com' }),
  ]);
  const c = contar(filas);
  assert.equal(c.tildadas, 3, 'las tres se crean');
  assert.equal(c.comoGanado, 1, 'y una sola entra como venta');
  assert.ok(c.comoGanado <= c.tildadas,
    'es un SUBCONJUNTO: sumarlo aparte contaría dos veces al mismo lead');
});

// ─────────────────────────────────────────────────────────────────────────────
// La etapa sale del EMBUDO, no de un nombre cableado
// ─────────────────────────────────────────────────────────────────────────────

const etapa = (key: string, kind?: Stage['kind']): Stage =>
  ({ key, label: key, dot: '#000', tone: 'neutral', kind });

test('la etapa de venta sale de la CLAVE del pipeline, no de `kind: cierre`', () => {
  // Los 16 embudos de producción (04/10/2026) tienen una etapa con clave `ganado`.
  assert.equal(etapaDeGanado([etapa('lead', 'entrada'), etapa('agenda', 'reunion'), etapa('ganado', 'cierre')]), 'ganado');
  // ⚠️ El de ws13 está armado a mano y tiene `ganado` tipada como «grupo», con su `cierre`
  // en `st0`, que es el DESCARTE («NO Calificado»). Buscando por `kind`, un cliente que
  // pagó entraría en el descarte — y `terminalEstadoFor('st0')` ni siquiera lo marca
  // ganado, así que la venta no sumaría en ninguna parte.
  assert.equal(
    etapaDeGanado([etapa('lead', 'entrada'), etapa('agenda', 'grupo'), etapa('ganado', 'grupo'), etapa('st0', 'cierre')]),
    'ganado',
  );
});

test('un embudo SIN etapa de venta devuelve null, y no se inventa la clave', () => {
  // Escribir en `pipeline_stage` una clave que el embudo no tiene no falla y deja al lead
  // en una columna que el tablero no dibuja: así desaparecieron 1.057 leads.
  assert.equal(etapaDeGanado([etapa('lead', 'entrada'), etapa('agenda', 'reunion')]), null);
  assert.equal(etapaDeGanado([]), null);
  assert.equal(etapaDeGanado(null), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// El cruce contra lo que YA está: todas las etapas, y el teléfono como corresponde
// ─────────────────────────────────────────────────────────────────────────────

/** El índice tal como lo arma `indiceContactos`, con las dos claves por lead. */
function indice(leads: Array<{ id: number; telefono: string }>): IndiceTelefonos {
  const exactos = new Map<string, number | null>();
  const sufijos = new Map<string, number | null>();
  const anotar = (m: Map<string, number | null>, k: string, id: number) => {
    if (!m.has(k)) { m.set(k, id); return; }
    if (m.get(k) !== id) m.set(k, null);
  };
  for (const l of leads) {
    const { exacta, sufijo } = clavesDeTelefono(l.telefono);
    if (exacta) anotar(exactos, exacta, l.id);
    if (sufijo) anotar(sufijos, sufijo, l.id);
  }
  return { exactos, sufijos };
}

test('un teléfono guardado CON código de país lo encuentra un CSV que lo trae sin él', () => {
  // Es el caso de 1.153 de los 1.154 leads con teléfono de ws1: 13 o 16 dígitos guardados
  // contra los 10 que tipea una persona.
  const idx = indice([{ id: 7, telefono: '5219981234567' }]);
  assert.equal(buscarTelefono(idx, '9981234567'), 7);
  assert.equal(buscarTelefono(idx, '+52 1 998 123 4567'), 7, 'y el exacto sigue andando');
  assert.equal(buscarTelefono(idx, '5550001111'), undefined, 'otro número no está en el CRM');
});

test('el EXACTO manda: si hay, el sufijo no opina', () => {
  // Así este cruce más ancho no puede volver AMBIGUO ningún match que antes era limpio.
  const idx = indice([{ id: 1, telefono: '5219981234567' }, { id: 2, telefono: '529981234567' }]);
  assert.equal(buscarTelefono(idx, '5219981234567'), 1, 'exacto: resuelve a uno');
  assert.equal(buscarTelefono(idx, '9981234567'), null,
    'por sufijo son dos: «ya existe» es cierto y no hay a quién completar');
});

test('la clave del sufijo son los ÚLTIMOS 10 dígitos, y un número corto sólo cruza exacto', () => {
  assert.deepEqual(clavesDeTelefono('+52 1 998 123 4567'), { exacta: '5219981234567', sufijo: '9981234567' });
  assert.deepEqual(clavesDeTelefono('12345'), { exacta: '12345', sufijo: null },
    'menos de 7 dígitos no identifica a nadie: no entra al mapa flojo');
  assert.deepEqual(clavesDeTelefono(''), { exacta: null, sufijo: null });
});

test('⚠️ el cruce NO filtra por etapa, por estado ni por funnel', () => {
  // Es la decisión de Martín del 04/10/2026, y lo que la hace cierta es una AUSENCIA, que
  // es justo lo que nadie nota al editar. Medido ese día: entran las 1.549 filas de los 6
  // workspaces con leads, 72 en un estado terminal. Un lead en «No contesta» o en
  // «Perdido» sigue siendo la misma persona.
  const src = soloCodigo(leer('app/crm/importar-server.ts'));
  const i = src.indexOf('await leerPorPaginas<');
  assert.ok(i > 0, 'no encontré la lectura paginada de `leads`: ¿se renombró?');
  const lectura = src.slice(i, src.indexOf('} catch', i));
  assert.ok(lectura.length < 700, `el recorte de la lectura mide ${lectura.length}: está mirando otra cosa`);
  for (const prohibido of ['pipeline_stage', 'estado_lead', 'funnel_id', '.eq(', 'filtros:']) {
    assert.ok(!lectura.includes(prohibido),
      `la lectura del índice de duplicados menciona «${prohibido}»: un filtro ahí deja leads `
      + 'afuera del cruce, y un lead que falta en el índice es un DUPLICADO que se crea igual');
  }
});

test('el teléfono del índice lo decide `buscarTelefono`, no una condición propia del server', () => {
  // Es la regla de este archivo y de sus dos vecinos: una sola función contesta la
  // pregunta. `marcarExistentes` corre DOS veces (al leer el archivo y al confirmar) y no
  // puede contestar distinto que el mapa que ella misma armó.
  const src = soloCodigo(leer('app/crm/importar-server.ts'));
  const i = src.indexOf('export async function marcarExistentes');
  assert.ok(i > 0, 'no encontré marcarExistentes: ¿se renombró?');
  const cuerpo = src.slice(i, src.indexOf('\nconst SISTEMA_EXTRAER', i));
  assert.match(cuerpo, /buscarTelefono\(/,
    'el server volvió a resolver el teléfono por su cuenta: ahí es donde las dos puntas '
    + 'del cruce se separan y el sufijo deja de contar');
  assert.ok(!/telsSufijo\.has\(/.test(cuerpo),
    '`marcarExistentes` no lee los mapas a mano: la precedencia exacto→sufijo vive en una '
    + 'sola función, con test');
});

test('la importación resuelve la etapa de venta con `etapaDeGanado`', () => {
  const src = leer('app/crm/actions.ts');
  const desde = src.indexOf('export async function importarLeadsRevisadosAction');
  assert.ok(desde > 0, 'no encontré importarLeadsRevisadosAction: ¿se renombró?');
  const bloque = soloCodigo(src.slice(desde, src.indexOf('\nexport ', desde + 10)));
  assert.match(bloque, /etapaDeGanado\(/,
    'la etapa se cableó por nombre: escribir una clave que el embudo no tiene no falla y '
    + 'deja al lead en una columna que no existe (ya pasó con 1.057 leads)');
  assert.ok(!/setPipelineStage\([^)]*'ganado'/.test(bloque),
    'nadie escribe la clave literal: sale del pipeline de ESE embudo');
  // ⚠️ LA CONDICIÓN DEL CALL SITE, NO EL BLOQUE: `entraGanado` aparece también arriba, en
  // el `some(...)` que decide si hay que resolver la etapa, así que un `assert.match`
  // sobre el bloque entero da VERDE con el portón cambiado por `f.comoGanado` pelado
  // —medido: 18 pases, 0 fallos—, que es justo el tilde del cliente sin el gate del
  // archivo. Es la trampa de siempre: un guard que lee todo encuentra lo que el archivo
  // dice de sí mismo.
  const j = bloque.indexOf('setPipelineStage(');
  assert.ok(j > 0, 'no encontré la llamada que mueve el lead a la etapa de venta');
  const condicion = bloque.slice(bloque.lastIndexOf('if (', j), j);
  assert.ok(condicion.length < 120, `el recorte de la condición mide ${condicion.length}: está mirando otra cosa`);
  assert.match(condicion, /entraGanado\(f\)/,
    'el server decidió por su cuenta qué fila entra como venta: la casilla, el chip y esta '
    + 'escritura tienen que contestar con la MISMA función');
});
