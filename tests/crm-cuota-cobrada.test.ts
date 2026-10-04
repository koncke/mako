// =============================================================================
// El botón que dice «cobrada» asienta un COBRO, no una deuda futura (#697)
// =============================================================================
// «+ Registrar mensualidad cobrada» creaba la cuota con `pagado: false` y
// `fecha: unMesDespues(...)`: el botón del cobro fabricaba una DEUDA a un mes.
// El cliente que acababa de pagar seguía figurando en $0 —`total_cobrado_usd`
// se deriva SÓLO de los pagos marcados (sincronizarTotalCobrado, lib/pagos.ts)—
// y un mes después esa misma cuota aparecía en «A quién cobrarle» de /comercial:
// se perseguía un cobro ya hecho, con el número de plata del tablero mintiendo.
//
// Y el arreglo no es una línea, porque la salida tiene UN call site y ese call
// site la tiraba: `saveCuotasAction` filtra `!c.pagado` a propósito, porque
// `saveLeadPlanManual` CONSERVA las cuotas ya pagadas de la base. Pero una cuota
// pagada que todavía NO está en la base no tiene nada que conservar, así que con
// sólo poner `pagado: true` la mensualidad se perdía ENTERA: sin error, sin fila
// y con el botón de guardar diciendo que había guardado. Por eso el `id` viaja al
// server y hay una rama que inserta las nuevas ya cobradas.
//
// Qué fija cada test, y por qué es su propio test: si mañana vuelve una de las
// tres mitades, no hace falta que vuelvan las otras para que esto se ponga rojo.
//
// PROBADO ROMPIÉNDOLO (04/10/2026) — un test verde que nunca se vio fallar no
// prueba nada. Se rompió a propósito cada mitad y se corrió
// `npx tsx --test tests/crm-cuota-cobrada.test.ts`:
//
//   `pagado: true` → `pagado: false` en agregarMensualidad ..... 1 fallo, 6 pases
//   `fecha: hoy` → `fecha: unMesDespues(ultima?.fecha || null)` . 1 fallo, 6 pases
//   sacar `id: c.id` del call site de saveCuotasAction .......... 1 fallo, 6 pases
//   borrar la rama `cobradas` de saveCuotasAction .............. 1 fallo, 6 pases
//   insertar las cobradas DESPUÉS de saveLeadPlanManual ......... 1 fallo, 6 pases
//   volver el gate del render a `c.pagado ?` (sin el `c.id`) .... 1 fallo, 6 pases
//   `pagado: true` en agregarCuota (fundir los dos botones) ..... 1 fallo, 6 pases
//
//   Y el ESTADO EXACTO de producción hasta hoy —las cuatro mitades
//   rotas a la vez, que es lo que había en el repo esta mañana—
//   deja .................................................... 6 fallos, 1 pase
//
// Cada mitad se caza SOLA, que es lo que importa: si mañana vuelve una, no hace
// falta que vuelvan las otras para que esto se ponga rojo.
//
// ⚠️ Los guards leen la FUENTE, así que extraen el BLOQUE y le sacan los
// comentarios antes de preguntar: este archivo y los que audita nombran
// `pagado: false` y `unMesDespues` en su propio porqué, y un `includes` sobre el
// archivo entero daría verde sobre el comentario que explica el bug.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CARD = readFileSync(resolve(__dirname, '../app/crm/[id]/DealDetailsCard.tsx'), 'utf8');
const ACTIONS = readFileSync(resolve(__dirname, '../app/crm/[id]/deal-actions.ts'), 'utf8');

/** Saca las líneas de comentario: el porqué de un arreglo nombra el bug. */
function sinComentarios(bloque: string): string {
  return bloque
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    })
    .join('\n');
}

/** La sentencia de una sola línea que arranca con `ancla` (sin su comentario). */
function unaLinea(src: string, ancla: string): string {
  const linea = src.split('\n').find((l) => l.includes(ancla));
  assert.ok(linea, `no se encontró la línea con «${ancla}»`);
  return sinComentarios(linea);
}

/**
 * Cuerpo de una función exportada: de su `export …function nombre(` hasta el
 * `}` en columna cero. Sin esto, un `includes` sobre el archivo entero contesta
 * sobre la función de al lado o sobre un comentario.
 */
function cuerpoFuncion(src: string, firma: string): string {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no se encontró la firma «${firma}»`);
  const fin = src.indexOf('\n}', i);
  assert.ok(fin > i, `no se encontró el cierre de «${firma}»`);
  return sinComentarios(src.slice(i, fin + 2));
}

/** El bloque JSX que dibuja las cuotas del borrador (modo edición). */
function bloqueCuotasBorrador(): string {
  const i = CARD.indexOf('{d.cuotas.map((c, i) => (');
  assert.ok(i >= 0, 'no se encontró el render de las cuotas del borrador');
  const fin = CARD.indexOf('))}', i);
  assert.ok(fin > i, 'no se encontró el cierre del render de las cuotas');
  return sinComentarios(CARD.slice(i, fin + 3));
}

// ── 1 · El botón del cobro asienta el cobro, hoy ─────────────────────────────

test('«Registrar mensualidad cobrada» crea la cuota PAGADA', () => {
  const l = unaLinea(CARD, 'const agregarMensualidad =');
  assert.match(l, /pagado:\s*true/, 'la mensualidad cobrada tiene que nacer con pagado: true');
  assert.doesNotMatch(l, /pagado:\s*false/, 'si nace sin pagar, el botón del cobro fabrica una deuda');
  assert.match(l, /fecha_pago:\s*hoy/, 'sin fecha_pago la ficha dice «cobrada el —»');
});

test('la mensualidad cobrada se fecha HOY, no a un mes', () => {
  const l = unaLinea(CARD, 'const agregarMensualidad =');
  assert.match(l, /const hoy = hoyISO\(\)/, 'la fecha del cobro sale de hoyISO()');
  assert.match(l, /fecha:\s*hoy/, 'la cuota cobrada vence hoy: es el día en que entró la plata');
  assert.doesNotMatch(l, /unMesDespues/, 'unMesDespues es la cuota FUTURA, que es el otro botón');
});

test('«+ Agregar cuota» sigue creando una cuota FUTURA sin pagar', () => {
  // La contracara: arreglar el cobro no puede fundir los dos botones en uno. Si
  // los dos asientan un cobro, se pierde la única forma de anotar una deuda.
  const l = unaLinea(CARD, 'const agregarCuota =');
  assert.match(l, /pagado:\s*false/, 'la cuota agregada a mano nace SIN pagar');
  assert.match(l, /unMesDespues\(/, 'la cuota agregada a mano vence a un mes de la anterior');
});

// ── 2 · El call site: la salida tiene que llegar al server ───────────────────

test('el guardado le pasa el id y la fecha del cobro a saveCuotasAction', () => {
  // Sin el `id`, el server no puede distinguir una pagada que YA está en la base
  // (la conserva saveLeadPlanManual) de una nueva ya cobrada (hay que insertarla),
  // y la mensualidad se pierde en el filtro de !c.pagado.
  const l = unaLinea(CARD, 'await saveCuotasAction(lead.id,');
  assert.match(l, /id:\s*c\.id/, 'el id de cada cuota tiene que viajar al server');
  assert.match(l, /fecha_pago:\s*c\.fecha_pago/, 'la fecha del cobro tiene que viajar al server');
});

// ── 3 · El server inserta la cuota nueva ya cobrada ──────────────────────────

test('saveCuotasAction inserta las cuotas nuevas que nacen cobradas', () => {
  const cuerpo = cuerpoFuncion(ACTIONS, 'export async function saveCuotasAction(');
  assert.match(
    cuerpo,
    /cuotas\.filter\(\(c\) => c\.pagado && c\.id == null/,
    'tiene que haber una rama para la cuota pagada que todavía NO está en la base',
  );
  assert.match(cuerpo, /from\('pagos'\)\.insert\(rows\)/, 'esas cuotas se insertan en pagos');
  assert.match(cuerpo, /pagado:\s*true/, 'y se insertan ya marcadas como cobradas');
});

test('el cobro se inserta ANTES de reemplazar las cuotas sin pagar', () => {
  // Dos razones y las dos importan: `pagos` tiene índice único (lead_id, numero)
  // y hay que numerar sobre TODAS las filas de ahora; y si el reemplazo fallara,
  // el cobro ya quedó asentado, que es el dato que no se puede volver a averiguar.
  const cuerpo = cuerpoFuncion(ACTIONS, 'export async function saveCuotasAction(');
  const insert = cuerpo.indexOf('.insert(rows)');
  const plan = cuerpo.indexOf('saveLeadPlanManual(');
  assert.ok(insert >= 0, 'no se encontró el insert del cobro');
  assert.ok(plan >= 0, 'no se encontró la llamada a saveLeadPlanManual');
  assert.ok(insert < plan, 'el insert del cobro va antes de saveLeadPlanManual');
});

// ── 4 · Una cuota cobrada SIN guardar se puede corregir y quitar ─────────────

test('la cuota cobrada que no se guardó todavía es editable y se puede quitar', () => {
  // Un clic de más dejaba una fila cobrada imposible de sacar del borrador, y una
  // suscripción sin `suscripcion_monto_usd` nacía en $0 sin forma de corregirlo
  // (y una cuota en 0 la descarta el guardado sin decir nada).
  const bloque = bloqueCuotasBorrador();
  // Los DOS gates estructurales —el que decide inputs vs texto, y el que decide
  // «quitar» vs la pastilla «pagada»— miran el id además de pagado. El `c.pagado`
  // pelado que queda adentro del else es otra pregunta: ahí ya se sabe que no hay
  // id, y sólo elige entre el selector de vencimiento y el rótulo «cobrada hoy».
  const conId = bloque.match(/c\.pagado && c\.id !== null/g) ?? [];
  assert.equal(conId.length, 2, `se esperaban 2 gates que miren el id, hay ${conId.length}`);
  assert.match(bloque, /\{c\.pagado && c\.id !== null \? \(/, 'el monto de una cuota cobrada sin guardar sigue siendo un input');
  const lineaQuitar = bloque.split('\n').find((l) => l.includes('quitar</button>'));
  assert.ok(lineaQuitar, 'no se encontró el botón de quitar una cuota del borrador');
  assert.match(lineaQuitar, /c\.pagado && c\.id !== null \?/, 'una cuota cobrada sin guardar tiene que poder quitarse');
});
