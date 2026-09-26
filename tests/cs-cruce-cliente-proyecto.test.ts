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
const proy = (id: number, nombre: string): ProyectoCruce => ({ id, nombre });

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

const correr = (leadPorProyecto?: Map<number, Set<number>>) =>
  atar(CLIENTES, PROYECTOS, { esDeCliente, leadPorProyecto });

const ids = (c: ReturnType<typeof correr>, leadId: number) =>
  (c.porLead.get(leadId) ?? []).map((a) => a.proyectoId).sort((a, b) => a - b);

const comoDe = (c: ReturnType<typeof correr>, leadId: number, proyectoId: number) =>
  (c.porLead.get(leadId) ?? []).find((a) => a.proyectoId === proyectoId)?.como ?? null;

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
  assert.deepEqual((c.porLead.get(491) ?? []).map((a) => a.proyectoId), [150]);
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
  assert.ok(c.huerfanos.includes(47), 'y «Cliente: Macario Romero — HMO» queda sin dueño, a la vista');
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
  assert.deepEqual(c.huerfanos, [47], 'el único proyecto «Cliente: …» que nadie reclama');
  assert.deepEqual(c.sinProyecto, [50], 'y el único cliente que no ató con nada');
  // Un proyecto de ÁREA sin cliente no es un huérfano: no es de nadie a propósito.
  assert.ok(!c.huerfanos.includes(1) && !c.huerfanos.includes(2));
});

test('la CLAVE le gana al nombre, y ata un proyecto que el nombre no habría atado', () => {
  // `cliente_lead_id` (mig 0159) es el único dato duro. Hoy 0 de 212 tareas del ws1 lo
  // traen escrito, así que este camino está apagado en la práctica — y el día que se
  // escriba tiene que mandar, o el parecido sigue decidiendo sobre un hecho.
  const c = correr(new Map([[47, new Set([31])]]));
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
