// =============================================================================
// El RAG de un cliente NO lee el negocio del dueño
// =============================================================================
// Leila, el 01/10/2026 (00:29:00), abriendo el editor de una secuencia en SU workspace y
// leyendo un nombre que no conocía: **«¿quién es este?»**. Martín: «esos son ejemplos…
// está tomando ejemplos de Mauricio siempre».
//
// La causa: `wsParaRag()` presta el `OWNER_WS` entero, y el `OWNER_WS` es un CLIENTE.
// Medido contra producción el 04/10/2026 — 42 entradas del ws1 entraban al RAG general de
// cada cliente, 22 de ellas un glosario de nombres propios de sus reuniones.
//
// Acá se prueban las dos mitades:
//   · la DECISIÓN, con la función pura (`lib/rag-prestamo.ts`, sin `server-only`);
//   · el CABLEADO, leyendo `lib/mako-knowledge.ts`: los DOS lectores que usan `wsParaRag`
//     tienen que pasar por el filtro. Con uno solo, la fuga sigue abierta por el otro.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sinLoAjenoDelDueno, sePresta, FUENTES_PRESTABLES } from '../lib/rag-prestamo';

const DUENO = 1;
const CLIENTE = 11;

// La forma real de las filas, con los valores de `fuente` que hay en producción.
const FILAS = [
  { id: 1, workspace_id: DUENO, area: 'mensajes', fuente: 'manual', titulo: 'Levanta Muertos — los 3 pilares' },
  { id: 2, workspace_id: DUENO, area: 'mensajes', fuente: 'mako', titulo: 'Estructuras que persuaden' },
  { id: 3, workspace_id: DUENO, area: 'glosario', fuente: 'reunión', titulo: 'Patricia Muñoz' },
  { id: 4, workspace_id: DUENO, area: 'glosario', fuente: 'reunión', titulo: 'Francisco Hernandez' },
  { id: 5, workspace_id: CLIENTE, area: 'glosario', fuente: 'reunión', titulo: 'Gretel' },
  { id: 6, workspace_id: CLIENTE, area: 'mensajes', fuente: 'manual', titulo: 'Mi voz de marca' },
];

test('EL CASO DE LEILA: el glosario del dueño no llega al cliente', () => {
  const visto = sinLoAjenoDelDueno(FILAS, CLIENTE, DUENO).map((f) => f.titulo);
  assert.ok(!visto.includes('Patricia Muñoz'), 'se sigue prestando un nombre propio del dueño');
  assert.ok(!visto.includes('Francisco Hernandez'), 'se sigue prestando un nombre propio del dueño');
});

test('…y el MÉTODO del dueño se sigue prestando: no se rompió lo que la feature venía a hacer', () => {
  const visto = sinLoAjenoDelDueno(FILAS, CLIENTE, DUENO).map((f) => f.titulo);
  assert.ok(visto.includes('Levanta Muertos — los 3 pilares'), 'se dejó de prestar el método cargado a mano');
  assert.ok(visto.includes('Estructuras que persuaden'), 'se dejó de prestar el método que sembró MaKo');
});

test('lo PROPIO del cliente nunca se filtra, venga de donde venga', () => {
  const visto = sinLoAjenoDelDueno(FILAS, CLIENTE, DUENO).map((f) => f.titulo);
  // Su glosario sale de SUS reuniones y es suyo: el filtro es sobre el préstamo, no sobre
  // la fuente. Sin esta mitad, el arreglo le esconde a cada cliente su propio material.
  assert.ok(visto.includes('Gretel'), 'se le escondió al cliente su propio glosario');
  assert.ok(visto.includes('Mi voz de marca'));
});

test('el DUEÑO sigue viendo lo suyo entero', () => {
  assert.equal(sinLoAjenoDelDueno(FILAS, DUENO, DUENO).length, FILAS.length);
});

test('la lista de fuentes va en POSITIVO: una fuente nueva NO se presta sola', () => {
  // Es la regla del Reset. Con «todas menos reunión», el día que algo escriba
  // `fuente: 'transcript'` en el ws1 se presta sin que nadie lo decida.
  assert.ok(!sePresta('reunión'));
  assert.ok(!sePresta('transcript'), 'una fuente que todavía no existe se está prestando');
  assert.ok(!sePresta(''), 'una fila sin fuente se está prestando');
  assert.ok(!sePresta(undefined));
  assert.deepEqual([...FUENTES_PRESTABLES].sort(), ['mako', 'manual']);
});

test('CABLEADO: los DOS lectores que prestan el workspace del dueño pasan por el filtro', () => {
  const src = readFileSync('lib/mako-knowledge.ts', 'utf8').replace(/\r\n/g, '\n');
  // ⚠️ SE CUENTAN LOS `wsParaRag` Y LOS FILTROS, no se busca la palabra en el archivo. Hay
  // dos lectores (`searchKnowledge` y `listActiveKnowledgeByArea`) y los dos inyectan lo
  // que traen en un prompt: con uno solo filtrado, la fuga sigue abierta por el otro y el
  // test daría verde igual.
  const presta = (src.match(/await wsParaRag\(\)/g) ?? []).length;
  const filtra = (src.match(/sinLoAjenoDelDueno\(/g) ?? []).length;
  assert.ok(presta > 0, 'desapareció `wsParaRag`: si el préstamo se fue, este test hay que reescribirlo');
  assert.equal(filtra, presta, `${presta} lectores prestan el workspace del dueño y sólo ${filtra} filtran`);
});

// ── Verificado rompiéndolo (04/10/2026), con los números ─────────────────────
// · sin romper nada                                     → 6 pases, 0 fallos
// · agregando `'reunión'` a `FUENTES_PRESTABLES`        → 4 pases, 2 fallos
// · quitando el filtro de `listActiveKnowledgeByArea`   → 5 pases, 1 fallo (CABLEADO)
// · devolviendo `filas` sin filtrar                     → 5 pases, 1 fallo
//
// ⚠️ Y EL TEST DEL CABLEADO SE GANÓ EL PUESTO EN SU PRIMERA CORRIDA: con los dos lectores
// obvios ya arreglados daba «3 lectores prestan y sólo 2 filtran». El tercero era
// `listKnowledgeAgencia`, que no alimenta un prompt — DIBUJA la lista en /conocimiento, o
// sea que los 22 nombres del dueño se leían en pantalla. Contar los `wsParaRag` encontró
// lo que leer los dos call sites que yo tenía en la cabeza no iba a encontrar nunca.
