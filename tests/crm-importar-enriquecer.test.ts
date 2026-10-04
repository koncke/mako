// =============================================================================
// Reimportar la misma lista tiene un TERCER destino: completar la ficha que ya está
// =============================================================================
// #623. Hasta el 04/10/2026 una fila repetida tenía dos salidas y ninguna servía para
// el caso que la produce: se reimporta el MISMO CSV con una columna nueva —el teléfono
// que faltaba, la empresa— y las opciones eran saltearla (se pierde el dato nuevo) o
// duplicarla (dos fichas de la misma persona, y las DOS inalcanzables desde ahí: dos
// filas con el mismo `telefono_normalizado` rompen con PGRST116 el `.maybeSingle()` de
// la ingesta siguiente).
//
// Lo que este archivo fija son las dos mitades que se pueden equivocar:
//
//   1. **El destino sale de UNA función** (`destinoDe`). Es la regla de la casa en este
//      archivo y ya se pagó: la casilla, el contador del botón y el portón del server
//      llegaron a contestar tres cosas distintas sobre la misma fila
//      (tests/crm-importar-duplicados.test.ts). Un destino nuevo entra por ahí.
//   2. **Completar NO PISA.** Lo cargado gana sobre lo importado, siempre. Un campo
//      pisado desde un CSV no da error ni deja rastro en ninguna pantalla, y si el campo
//      era el teléfono, lo que se perdió es la llave de match del lead.
//
// ⚠️ LA DECISIÓN DEL 14/08 SIGUE INTACTA, a propósito: tildar un repetido CREA otra
// ficha. Completar es lo que antes NO SE PODÍA ELEGIR, no lo que ahora pasa solo —
// cambiarle el default al tilde habría revertido en silencio una decisión ajena que ese
// otro archivo fija, que es exactamente lo que AGENTS.md prohíbe.
//
// ⚠️ PROBADO ROMPIÉNDOLO, las siete. Con el arreglo puesto: 9 pases, 0 fallos.
//   · `camposParaCompletar` completa aunque el campo tenga valor (se saca el `vacio`) . 2 FALLOS, 7 pases
//   · el teléfono se completa mirando sólo `telefono` (no la llave normalizada) ....... 1 FALLO, 8 pases
//   · `destinoDe` da `enriquecer` sin `leadExistenteId` (no hay a quién) .............. 1 FALLO, 8 pases
//   · `destinoDe` da `enriquecer` con la fila DESTILDADA .............................. 2 FALLOS, 7 pases
//   · `contar` suma las que completan dentro de `tildadas` ............................ 1 FALLO, 8 pases
//   · el server deja de pasar por `destinoDe` y usa `f.enriquecer` pelado ............. 1 FALLO, 8 pases
//   · `enriquecerLead` arma el payload sin `camposParaCompletar` ...................... 1 FALLO, 8 pases
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { camposParaCompletar } from '../lib/leads-duplicados';
import {
  MOTIVO_DECIDIBLE, contar, destinoDe, enriquece, entra, recalcular, type FilaImport,
} from '../app/crm/leads-importar';

const leer = (p: string) => readFileSync(join(import.meta.dirname, '..', p), 'utf8');
/** Lo que un archivo EJECUTA, sin su prosa (los de línea ANTES que los de bloque). */
const soloCodigo = (src: string): string =>
  src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const fila = (p: Partial<FilaImport>): FilaImport => ({
  id: 'x', nombre: 'Juan Pérez', email: '', telefono: '', empresa: '',
  incluir: true, yaExiste: false, ...p,
});
/** Una fila repetida, tal como la deja el server: con motivo y con el id resuelto. */
const repetida = (p: Partial<FilaImport> = {}): FilaImport =>
  recalcular([fila({ email: 'ya@x.com', yaExiste: true, leadExistenteId: 44, ...p })])[0];

// ─────────────────────────────────────────────────────────────────────────────
// Completar NO PISA
// ─────────────────────────────────────────────────────────────────────────────

test('sólo se rellena lo VACÍO: lo cargado gana sobre lo importado', () => {
  const actual = { nombre: 'Juan Pérez', email: 'juan@viejo.com', telefono: null, telefono_normalizado: null, empresa: null };
  const campos = camposParaCompletar(actual, {
    nombre: 'JUAN P', email: 'juan@nuevo.com', telefono: '+52 998 123 4567', empresa: 'Acme',
  });
  assert.deepEqual(campos.map((c) => c.columna).sort(), ['empresa', 'telefono'],
    'PISÓ UN CAMPO CARGADO: el email de la ficha lo escribió una persona o lo trajo '
    + 'Calendly, y una lista reimportada es el dato menos fresco que entra al CRM');
  assert.deepEqual(
    campos.map((c) => [c.columna, c.valor]).sort(),
    [['empresa', 'Acme'], ['telefono', '+52 998 123 4567']],
  );
});

test('el email se completa en MINÚSCULAS: es la llave de match de Calendly', () => {
  const [c] = camposParaCompletar({ email: '' }, { email: '  Juan@X.COM ' });
  assert.deepEqual([c.columna, c.valor], ['email', 'juan@x.com']);
});

test('con la llave normalizada puesta, el teléfono NO está vacío', () => {
  // Un lead con `telefono_normalizado` y `telefono` en blanco matchea por la llave.
  // Completarlo con otro número lo dejaría con un teléfono a la vista y matcheando por
  // otro — el peor de los dos mundos, y sin un solo error.
  const conLlave = camposParaCompletar({ telefono: null, telefono_normalizado: '5219981234567' }, { telefono: '555' });
  assert.deepEqual(conLlave, [], 'el teléfono y su forma normalizada son un solo campo acá');
  const sinNada = camposParaCompletar({ telefono: null, telefono_normalizado: null }, { telefono: '555 000' });
  assert.deepEqual(sinNada.map((c) => c.columna), ['telefono']);
});

test('nada que completar es un resultado, no un cambio', () => {
  const lleno = { nombre: 'Juan', email: 'j@x.com', telefono: '999', telefono_normalizado: '999', empresa: 'Acme' };
  assert.deepEqual(camposParaCompletar(lleno, { nombre: 'Otro', email: 'o@x.com', telefono: '1', empresa: 'B' }), []);
  // Y una fila importada vacía tampoco borra nada.
  assert.deepEqual(camposParaCompletar({ email: 'j@x.com' }, { email: '   ', empresa: '' }), []);
});

// ─────────────────────────────────────────────────────────────────────────────
// Los TRES destinos, por UNA función
// ─────────────────────────────────────────────────────────────────────────────

test('`destinoDe` es la única respuesta, y `entra`/`enriquece` se derivan de ella', () => {
  const casos: Array<[FilaImport, 'omitir' | 'crear' | 'enriquecer', string]> = [
    [fila({}), 'crear', 'una fila limpia y tildada se crea'],
    [fila({ incluir: false }), 'omitir', 'destildada no hace nada'],
    [recalcular([fila({ nombre: '' })])[0], 'omitir', 'sin nombre no se puede crear ni completar'],
    [repetida(), 'crear', 'el repetido TILDADO sigue creando otra ficha: es la decisión del 14/08'],
    [repetida({ incluir: false }), 'omitir', 'el repetido destildado no hace nada'],
    [repetida({ enriquecer: true }), 'enriquecer', 'con «completar» elegido, escribe en la ficha que ya está'],
    [repetida({ enriquecer: true, incluir: false }), 'omitir',
      'SIN TILDE NO PASA NADA: «completar» es una pregunta aparte, no un tercer valor de la casilla'],
    [repetida({ enriquecer: true, leadExistenteId: null }), 'crear',
      'SIN A QUIÉN NO SE COMPLETA: el email matchea un lead y el teléfono otro, así que '
      + 'se cae a lo reversible — escribirle los datos de una persona a otra ficha no lo es'],
  ];
  for (const [f, esperado, porque] of casos) {
    assert.equal(destinoDe(f), esperado, porque);
    assert.equal(entra(f), esperado === 'crear', `\`entra\` dejó de derivarse: ${porque}`);
    assert.equal(enriquece(f), esperado === 'enriquecer', `\`enriquece\` dejó de derivarse: ${porque}`);
    assert.ok(!(entra(f) && enriquece(f)), 'una fila no puede crear Y completar a la vez');
  }
});

test('el contador no mete una ficha completada en el número de «se van a crear»', () => {
  const filas = [
    fila({ id: 'a', email: 'ana@x.com' }),                                        // se crea
    repetida({ id: 'b', email: 'uno@x.com', enriquecer: true }),                  // se completa
    repetida({ id: 'c', email: 'dos@x.com' }),                                    // se duplica
    repetida({ id: 'd', email: 'tres@x.com', enriquecer: true, incluir: false }), // nada
  ];
  const c = contar(filas);
  assert.equal(c.tildadas, 2, 'la limpia y el duplicado a propósito: la que completa NO es un lead nuevo');
  assert.equal(c.aEnriquecer, 1, 'y la que completa tiene su propio número');
  assert.equal(c.aProposito, 1, 'el chip de lo irreversible cuenta sólo el que duplica');
  assert.equal(c.duplicado, 3, 'las tres siguen marcadas como «ya existe»');
});

// ─────────────────────────────────────────────────────────────────────────────
// Y el CABLEADO: un destino sin call site es un control que no hace nada
// ─────────────────────────────────────────────────────────────────────────────

test('el server resuelve el destino con `destinoDe` y escribe por `enriquecerLead`', () => {
  const src = soloCodigo(leer('app/crm/actions.ts'));
  const desde = src.indexOf('export async function importarLeadsRevisadosAction');
  assert.ok(desde > 0, 'no encontré importarLeadsRevisadosAction: ¿se renombró?');
  const bloque = src.slice(desde, src.indexOf('\nexport ', desde + 10));

  assert.match(bloque, /destinoDe\(f\) === 'enriquecer'/,
    'EL SERVER TIENE SU PROPIA CONDICIÓN: con `f.enriquecer` pelado vuelve a haber dos '
    + 'lectores de la misma pregunta, y uno se queda viejo');
  assert.match(bloque, /await enriquecerLead\(f\.leadExistenteId, \{/,
    'el destino se dibuja y no escribe nada: falta el call site');
  // El id lo resuelve el SERVER, no el navegador: es a quién se le escribe.
  assert.match(bloque, /leadExistenteId: null,/,
    'el id del cliente volvió a viajar al bucle: un id en el payload lo cambia cualquiera');
  assert.match(bloque, /f\.enriquecer && f\.leadExistenteId !== idQueVio\[i\]/,
    'si el server resuelve OTRO lead que el que la pantalla mostró, la decisión de '
    + 'completar no era sobre ése');
  assert.match(bloque, /incluir: false, enriquecer: false/,
    'un duplicado que la pantalla NO mostró tampoco autoriza a completar: es el default');
  // Y el portón de crear sigue siendo `entra()` — lo fija crm-importar-duplicados.
  const porton = bloque.indexOf('if (!entra(f) || chocaAcá) { omitidos++; continue; }');
  assert.ok(porton > bloque.indexOf("destinoDe(f) === 'enriquecer'"),
    'el camino de completar tiene que ir ANTES del portón de crear: `entra()` contesta '
    + '«¿se CREA?» y para esa fila la respuesta es no, así que el portón la omitiría');
});

test('la tabla ofrece el destino, y `enriquecerLead` aplica la decisión del módulo puro', () => {
  const tabla = soloCodigo(leer('app/crm/TablaRevisionLeads.tsx'));
  assert.match(tabla, /const puedeCompletar = decidible && !fuera && f\.leadExistenteId != null;/,
    'el control de «completar» se ofrece sin que el server haya resuelto a quién');
  assert.match(tabla, /onClick=\{\(\) => elegirDestino\(f\.id, d\.enriquecer\)\}/,
    'los dos botones del destino no están enchufados a nada');
  assert.match(tabla, /const fuera = destino === 'omitir';/,
    'VOLVIÓ `!entra(f)`: la fila que completa la ficha se dibuja DESTILDADA, o sea la '
    + 'pantalla diciendo lo contrario de lo que va a pasar');

  const leads = soloCodigo(leer('lib/leads.ts'));
  const i = leads.indexOf('export async function enriquecerLead');
  assert.ok(i > 0, 'no encontré `enriquecerLead`');
  const cuerpo = leads.slice(i, leads.indexOf('\n}', i));
  assert.ok(cuerpo.length < 1400, `el recorte se fue de largo (${cuerpo.length}): mira otra función`);
  assert.match(cuerpo, /camposParaCompletar\(actual, datos\)/,
    'la regla «solo se rellena lo vacío» volvió a vivir adentro del módulo con '
    + '`server-only`, donde ningún test la puede ejecutar');
  assert.match(cuerpo, /payload\.telefono_normalizado = normalizarTelefono\(c\.valor\)/,
    'el teléfono se escribiría sin su llave de match: el lead queda invisible para '
    + 'Calendly, Meta y el inbox');
  assert.match(cuerpo, /logLeadChanges\(id, actual, data as Lead, autor\)/,
    'una escritura sobre una ficha que alguien viene trabajando sin una línea en el '
    + 'historial es la fusión en silencio que `avisarFusion` vino a cerrar');
});

test('el botón promete los DOS números, y «sólo completar» no dice «nada tildado»', () => {
  const modal = soloCodigo(leer('app/crm/ImportarLeadsModal.tsx'));
  assert.match(modal, /const haceAlgo = c\.tildadas \+ c\.aEnriquecer;/,
    'con el botón colgado sólo de `tildadas`, una importación de puras fichas a '
    + 'completar dice «No hay nada tildado» sobre una pantalla con todo tildado');
  assert.match(modal, /puede = paso === 0 \? !!file && !err : haceAlgo > 0/,
    'y el wizard no deja confirmar');
  assert.match(modal, /Completar \$\{c\.aEnriquecer\} ficha/, 'el rótulo no nombra lo que va a completar');
  assert.match(modal, /if \(!r\.creados && !r\.enriquecidos && r\.errores\.length\)/,
    'una corrida que completó 2 fichas y tiró un error se mostraba como importación '
    + 'fallida: el único hecho de la corrida se tiraba');
});
