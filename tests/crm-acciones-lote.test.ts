// =============================================================================
// Las acciones en LOTE del CRM: lo que no se puede equivocar
// =============================================================================
// Las dos reglas de acá abajo se rompieron de verdad escribiéndolas (05/10/2026), y
// las dos fallan en la dirección tranquilizadora: devuelven un número plausible.
//
// PROBADO ROMPIÉNDOLO (05/10/2026). Con las dos roturas aplicadas a la vez —borrar la
// línea `if (!r.ok) { fallaron += 1; continue; }` y poner `pisar = true` de default—:
// 2 fallan / 2 pasan. Sano: 4/4. O sea que cada uno de los dos guards muerde por su
// cuenta, y los otros dos no se mueven: no son el mismo test escrito dos veces.
//
// ⚠️ POR QUÉ ES UN GUARD DE FUENTE Y NO UNA LLAMADA. `app/crm/actions.ts` es
// `'use server'` y arrastra Supabase, la sesión y el workspace: importarlo desde un
// test pide una base. Lo que estas dos reglas necesitan es que una LÍNEA exista, no
// que la función corra — y eso un guard lo contesta.
//
// ⚠️ Y SE LEE EL BLOQUE, NO EL ARCHIVO. `actions.ts` tiene 3.000 líneas: preguntarle
// al archivo entero si dice «!r.ok» da verde por cualquier otra función. Se recorta la
// función por su cierre REAL (el `export` siguiente), nunca por un número de
// caracteres elegido a ojo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync('app/crm/actions.ts', 'utf8');

/** El cuerpo de una función exportada, hasta el `export` siguiente. */
function bloque(nombre: string): string {
  const i = SRC.indexOf(`export async function ${nombre}(`);
  assert.notEqual(i, -1, `no existe ${nombre} en app/crm/actions.ts`);
  const j = SRC.indexOf('\nexport ', i + 1);
  return SRC.slice(i, j === -1 ? SRC.length : j);
}

/** Sin comentarios: la convención de la casa es explicar en el comentario lo que la
 *  línea hace, así que un guard que no los saca se contesta a sí mismo. Las líneas
 *  ANTES que los bloques — un `/*` dentro de un `//` se come el código del medio. */
const sinComentarios = (s: string) =>
  s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('mover en lote NO cuenta como movido el lead que no se movió', () => {
  const b = sinComentarios(bloque('moverLeadsDeEtapaAction'));
  // `setLeadStageAction` devuelve una UNIÓN: `{ok:true,...} | {ok:false,...}`. La rama
  // falsa no escribió la etapa. Sin esta guarda, `movidos` cuenta los dos y el lote a
  // medias se reporta como un éxito — que es el único resultado que nadie va a auditar.
  assert.match(b, /if \(!r\.ok\)/, 'falta cortar la rama ok:false antes de contar');
  // Y lo que hace con ella: sumarla a `fallaron` y seguir. Si sólo cortara, el lead
  // desaparecería de los tres números y el total no cerraría con la selección.
  assert.match(b, /if \(!r\.ok\) \{ fallaron \+= 1; continue; \}/);
  // Los TRES números existen. Con uno solo no se puede distinguir «movidos todos» de
  // «movidos a medias», que es la distinción por la que esta action devuelve un objeto.
  for (const campo of ['movidos', 'conPendientes', 'fallaron']) {
    assert.match(b, new RegExp(`${campo}`), `falta el contador ${campo}`);
  }
});

test('mover en lote pasa por setLeadStageAction y no escribe la etapa por su cuenta', () => {
  const b = sinComentarios(bloque('moverLeadsDeEtapaAction'));
  // El choke point: historial, pendientes y automatismos cuelgan de ahí. Un UPDATE
  // masivo sería la segunda implementación de «mover de etapa», más rápida y muda.
  assert.match(b, /await setLeadStageAction\(/);
  assert.doesNotMatch(b, /\.from\(['"]leads['"]\)/, 'escribe la tabla a mano: se saltea el historial y los pendientes');
});

test('el relleno en lote NO pisa por defecto, y pisar es explícito', () => {
  const b = sinComentarios(bloque('bulkFillLeadFieldAction'));
  // El default protege al worklist de higiene, donde los leads los eligió un FILTRO.
  assert.match(b, /pisar = false/, 'el default tiene que ser no pisar');
  // Y con `pisar` puesto, el `.or(...)` que exige el campo vacío NO se aplica: sin esto,
  // asignarle un Closer a doce leads que ya tienen otro no escribe nada y contesta «0».
  assert.match(b, /pisar \? q : q\.or\(/, 'con pisar hay que saltear el filtro de vacíos');
});

test('las dos acciones de lote topean la cantidad', () => {
  // Un lote sin techo es una pantalla que se cuelga sobre 1.100 leads, y encima el
  // resultado deja de ser auditable: a partir de cierto número «lo hice» no es una
  // respuesta útil y lo que hace falta es un filtro.
  // SIN `export`: en un archivo `use server` solo se pueden exportar funciones async, y
  // un `export const` tira el BUILD sin que el typecheck diga nada. El guard fija las dos
  // mitades —que el tope exista y que no se exporte— porque la segunda ya se pago.
  assert.match(SRC, /^const TOPE_LOTE = \d+;$/m);
  assert.doesNotMatch(SRC, /export const TOPE_LOTE/);
  for (const f of ['moverLeadsDeEtapaAction', 'eliminarLeadsAction']) {
    assert.match(sinComentarios(bloque(f)), /slice\(0, TOPE_LOTE\)/, `${f} no topea`);
  }
});
