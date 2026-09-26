// =============================================================================
// El cruce cliente ↔ proyecto de Customer Success
// =============================================================================
// Decide QUÉ TRABAJO se le muestra a quién en la ficha de un cliente. Un error acá no
// se ve como un bug: se ve como un cliente al que le falta la mitad de su trabajo, o
// —peor— como un cliente al que le aparece el de otro.
//
// Los casos salen de MEDIR el ws1 el 25/09/2026 (14 leads ganados, 9 proyectos
// «Cliente: …»), no de imaginarlos:
//   · 6 cruzaban 1-a-1 · 8 clientes sin proyecto · 3 proyectos sin cliente (30 tareas)
//   · «Cendejas IESCA Inmobiliaria» NO cruzaba con «Cliente: Jesús Cendejas»
//   · «hmo» está en DOS proyectos, así que no puede atar a nadie
//
// PROBADO ROMPIÉNDOLO (25/09/2026), que es lo único que distingue un test medido de una
// afirmación. Las tres roturas, con el resultado exacto:
//   1. quitando la dirección proyecto ⊆ cliente de `contenido(cp, cc)` →
//      1 fallo, 7 pases («el lead con MÁS palabras ata por NOMBRE»).
//   2. aflojando el parecido a «comparten cualquier palabra», sin exigir que sea única →
//      2 fallos, 6 pases: Congelados HMO se llevaba también «Cliente: Macario Romero —
//      HMO», o sea el trabajo de otro cliente, y el huérfano desaparecía de la pantalla.
//   3. sacando `grupo` de la lista de RUIDO →
//      1 fallo, 7 pases («Grupo Vértice» se llevaba el proyecto de «Grupo Esquer»).
//
// ⚠️ Y LA PRIMERA VERSIÓN DE ESTE TEST NO MEDÍA LO QUE DECÍA: daba 7 de 7 CON la rotura 1
// puesta, porque el caso Cendejas lo ataba el PARECIDO y el test sólo miraba que atara.
// Lo que faltaba era afirmar CÓMO ató (`como`), que es justo lo que la ficha muestra: un
// parecido anunciado como una coincidencia de nombre es la mentira que nadie audita.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { atar, clavesDe, type ClienteCruce, type ProyectoCruce } from '../app/customer-success/cruce';

/** El mismo reconocedor que usa producción (lib/todo-rutear.ts). Se copia SÓLO acá, y
 *  a propósito: ese módulo es `server-only` y un test no lo puede importar. */
const esDeCliente = (n: string) =>
  /^(cliente|cuenta)\s*:?\s+/.test(n.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase());

const cli = (leadId: number, nombre: string, empresa: string | null = null): ClienteCruce => ({ leadId, nombre, empresa });
/** ⚠️ EL `id` DE UN PROYECTO ES TEXTO desde la 0172, porque Customer Success lee el
 *  tablero que corresponda y los dos numeran distinto (`tarea_categorias.id` es bigint,
 *  `plan_proyectos.id` es texto). Los números medidos del ws1 se conservan tal cual —son
 *  la trazabilidad del caso— y se pasan a texto acá: cambiarlos por ids inventados sería
 *  perder la única forma de volver a la medición.
 *  `cliente` es la clave dura nueva: el proyecto declarando de quién es. */
const proy = (id: number, nombre: string, cliente?: number): ProyectoCruce =>
  ({ id: String(id), nombre, clienteLeadId: cliente ?? null });

// El tablero medido del ws1, recortado a lo que decide cada caso.
const PROYECTOS: ProyectoCruce[] = [
  proy(47, 'Cliente: Macario Romero — HMO'),
  proy(76, 'Cliente: Baja Teriyaki'),
  proy(77, 'Cliente: Grupo Esquer'),
  proy(79, 'Cliente: TEXX'),
  proy(80, 'Cliente: Vértice Industrial'),
  proy(150, 'Cliente: Jesús Cendejas'),
  proy(151, 'Cliente: Congelados HMO'),
  proy(1, 'Anuncios'),
  proy(2, 'Landing y web'),
];

const CLIENTES: ClienteCruce[] = [
  cli(14, 'Teriyaki baja'),
  cli(21, 'TEXX'),
  cli(28, 'Grupo Esquer'),
  cli(31, 'Congelados HMO'),
  cli(91, 'Vertice Industrial'),
  cli(491, 'Cendejas IESCA Inmobiliaria'),
  cli(50, 'Oscar Dalvah'),
];

const correr = (leadPorProyecto?: Map<string, Set<number>>, proyectos: ProyectoCruce[] = PROYECTOS) =>
  atar(CLIENTES, proyectos, { esDeCliente, leadPorProyecto });

/** Los ids ordenados NUMÉRICAMENTE aunque sean texto: con `sort()` a secas, 150 va antes
 *  que 47 y las aserciones medidas dejarían de leerse como los números del ws1. */
const ids = (c: ReturnType<typeof correr>, leadId: number) =>
  (c.porLead.get(leadId) ?? []).map((a) => Number(a.proyectoId)).sort((a, b) => a - b);

const comoDe = (c: ReturnType<typeof correr>, leadId: number, proyectoId: number) =>
  (c.porLead.get(leadId) ?? []).find((a) => a.proyectoId === String(proyectoId))?.como ?? null;

test('EL PEDIDO: el cruce ata en las DOS direcciones, no sólo cliente ⊆ proyecto', () => {
  const c = correr();
  // «Teriyaki baja» (lead) ⊆ «Cliente: Baja Teriyaki»: mismas palabras, otro orden.
  assert.deepEqual(ids(c, 14), [76]);
  // «Vertice Industrial» sin tilde contra «Cliente: Vértice Industrial» con tilde.
  assert.deepEqual(ids(c, 91), [80]);
  // «TEXX» es una sola palabra y aun así no ata con nada más.
  assert.deepEqual(ids(c, 21), [79]);
});

test('el lead con MÁS palabras que el proyecto ata por NOMBRE, no por parecido', () => {
  // La dirección que le falta a `esElProyectoDe` (lib/reunion-cliente.ts), que exige que
  // TODAS las palabras del cliente estén en el proyecto. Acá el proyecto es el subconjunto.
  const c = atar(
    [cli(491, 'Cendejas IESCA Inmobiliaria')],
    [proy(150, 'Cliente: Cendejas Inmobiliaria')],
    { esDeCliente },
  );
  assert.deepEqual((c.porLead.get(491) ?? []).map((a) => a.proyectoId), ['150']);
  assert.equal((c.porLead.get(491) ?? [])[0].como, 'nombre', 'es un subconjunto, no un parecido');
});

test('el caso Cendejas REAL: ata, y la ficha tiene que decir que es un PARECIDO', () => {
  // Medido: el lead es «Cendejas IESCA Inmobiliaria» y el proyecto «Cliente: Jesús
  // Cendejas». Ninguno contiene al otro —«iesca» de un lado, «jesus» del otro—, así que
  // esto lo ata la palabra distintiva y NO se puede anunciar como si fuera una clave.
  const c = correr();
  assert.deepEqual(ids(c, 491), [150], 'Cendejas IESCA Inmobiliaria → Cliente: Jesús Cendejas');
  assert.equal(comoDe(c, 491, 150), 'parecido', 'y se dice que es un parecido');
  assert.equal(comoDe(c, 14, 76), 'nombre', 'contra el que sí es subconjunto');
});

test('«hmo» está en dos proyectos, así que no ata a nadie', () => {
  // Atar por una palabra compartida cualquiera le metería a Congelados HMO el trabajo de
  // Macario Romero. El parecido exige que la palabra sea única de los DOS lados.
  const c = correr();
  assert.deepEqual(ids(c, 31), [151], 'Congelados HMO se queda con el suyo y nada más');
  assert.ok(c.huerfanos.includes('47'), 'y «Cliente: Macario Romero — HMO» queda sin dueño, a la vista');
});

test('«grupo» no distingue a nadie: es ruido, no una clave', () => {
  const con = atar(
    [cli(28, 'Grupo Esquer'), cli(99, 'Grupo Vértice')],
    [proy(77, 'Cliente: Grupo Esquer')],
    { esDeCliente },
  );
  assert.deepEqual((con.porLead.get(99) ?? []).map((a) => a.proyectoId), [], 'Grupo Vértice no se lleva el de Esquer');
  assert.deepEqual(clavesDe('Cliente: Grupo Esquer'), ['esquer']);
});

test('lo que NO cruza se devuelve, de los dos lados', () => {
  const c = correr();
  // Sin esto la ficha esconde el agujero: 8 clientes sin proyecto y 3 proyectos sin
  // cliente son el MISMO dato visto de los dos lados, y casi siempre el mismo corrido.
  assert.deepEqual(c.huerfanos, ['47'], 'el único proyecto «Cliente: …» que nadie reclama');
  assert.deepEqual(c.sinProyecto, [50], 'y el único cliente que no ató con nada');
  // Un proyecto de ÁREA sin cliente no es un huérfano: no es de nadie a propósito.
  assert.ok(!c.huerfanos.includes('1') && !c.huerfanos.includes('2'));
});

test('la CLAVE le gana al nombre, y ata un proyecto que el nombre no habría atado', () => {
  // `cliente_lead_id` (mig 0159) es el único dato duro. Hoy 0 de 212 tareas del ws1 lo
  // traen escrito, así que este camino está apagado en la práctica — y el día que se
  // escriba tiene que mandar, o el parecido sigue decidiendo sobre un hecho.
  const c = correr(new Map([['47', new Set([31])]]));
  assert.deepEqual(ids(c, 31), [47, 151]);
  assert.equal((c.porLead.get(31) ?? [])[0].como, 'clave', 'lo duro va primero en la lista');
  assert.deepEqual(c.huerfanos, [], 'y deja de haber huérfanos');
});

test('un cliente sin palabras útiles no cruza con TODO', () => {
  // El caso que rompe un `every` sobre una lista vacía: sin esta guarda, un lead llamado
  // «SA» ataría con los nueve proyectos del tablero.
  const c = atar([cli(1, 'SA')], PROYECTOS, { esDeCliente });
  assert.deepEqual(c.porLead.get(1), []);
  assert.deepEqual(c.sinProyecto, [1]);
});

// ── LA CLAVE DEL PROPIO PROYECTO (mig 0172) ──────────────────────────────────
// Hasta la 0172 la única clave dura era `cliente_lead_id` de una TAREA, y estaba escrita
// en 0 de las 299 tareas del producto: o sea que el cruce vivía del nombre. Ahora el
// proyecto puede declarar de quién es, y eso es lo que escribe el picker.
//
// PROBADO ROMPIÉNDOLO (26/09/2026), que es lo único que distingue un test medido de una
// afirmación. Las dos roturas, con el resultado EXACTO (10 tests en el archivo):
//   1. sacando la pasada 0 entera de `atar` → 1 fallo, 9 pases. El proyecto asignado a
//      mano deja de atar con su cliente y se va con el del nombre parecido: la asignación
//      se guarda bien y el trabajo aparece en la ficha equivocada.
//   2. dejando la pasada 0 pero SIN marcar `declarados` → 1 fallo, 9 pases. Ata al
//      cliente correcto Y ADEMÁS al del nombre: el mismo proyecto en DOS fichas, una de
//      ellas equivocada y sin forma de sacarlo de ahí.
//
// ⚠️ LA SEGUNDA ROTURA ES EL BUG QUE ESTE TEST ENCONTRÓ AL ESCRIBIRLO, no un caso
// hipotético: la primera versión de la pasada 0 no marcaba nada, y el test falló. O sea
// que «asignar un cliente a mano» era una sugerencia más y no una decisión.

test('el proyecto que declara su cliente ata por CLAVE, y le gana al nombre', () => {
  // «Cliente: Grupo Esquer» se llama como el lead 28 y está asignado a mano al 21 (TEXX).
  // Gana la asignación: no la dedujo nadie, la eligió una persona de una lista.
  const c = correr(undefined, [proy(77, 'Cliente: Grupo Esquer', 21)]);
  assert.deepEqual(ids(c, 21), [77], 'el lead que el proyecto declara se lo queda');
  assert.equal(comoDe(c, 21, 77), 'clave', 'y se dice que es una clave, no un parecido');
  assert.deepEqual(ids(c, 28), [], 'el del nombre parecido NO se lo lleva');
});

test('un lead que no está en la cartera no ata, aunque el proyecto lo declare', () => {
  // Un lead borrado, o de otro workspace. Sin esta guarda el proyecto quedaría atado a un
  // id que no existe y desaparecería de los huérfanos: invisible en las dos listas.
  const c = correr(undefined, [proy(79, 'Cliente: Nadie', 99999)]);
  assert.ok(c.huerfanos.includes('79'), 'queda a la vista como huérfano');
});
