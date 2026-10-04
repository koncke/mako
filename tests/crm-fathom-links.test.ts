// =============================================================================
// Las grabaciones no se pisan, el fallo de Fathom se oye, y un teléfono repetido
// no tira el webhook (#38 · #689 · PGRST116)
// =============================================================================
// Cuatro defectos distintos que viven en los mismos tres archivos:
//
//   1. La segunda grabación borraba el link de la primera. `applyFathomRecording`
//      escribe `fathom_links` como el array COMPLETO y lo armaba desde el objeto
//      `lead` que le pasaron; `lib/fathom-auto.ts` lee los leads UNA vez y recorre
//      ['j1','j2'] con el MISMO objeto, así que la vuelta de la R2 reescribía la
//      lista entera. Y el contador informaba «adjuntados: 2» igual, que es lo que lo
//      hizo invisible desde julio.
//   2. El buscador automático no miraba las grabaciones ya cargadas en la ficha, así
//      que el asistente volvía a pedir a mano un link que ya estaba guardado. Y la
//      mitad caía peor: `lib/crm-auto.ts` decide la regla T1 con `fathomR1/R2`, o sea
//      que un lead CON su grabación en la ficha y la asistencia sin marcar lo mandaba
//      a **No Show**.
//   3. `fetchAllMeetings(...).catch(() => [])` convertía «no pude leer Fathom» en «no
//      hay nada»: cero enganches, cero logs, cero señal. El síntoma exacto de #689.
//   4. Los lectores por `telefono_normalizado` y por `email` usaban `.maybeSingle()`
//      sobre columnas que NO son únicas. Con dos filas, PostgREST contesta PGRST116 y
//      el `throw` de arriba es un HTTP 500 del webhook: la reunión que el lead acaba
//      de reservar no entra al CRM y nada lo dice.
//
// ⚠️ GUARD DE FUENTE, no de ejecución: los tres módulos abren con `import
// 'server-only'` y un test no los puede importar. Por eso se mira el BLOQUE de cada
// función y con los comentarios BORRADOS — contra el archivo entero, varios de estos
// asserts darían verde sobre el comentario que explica el bug, que es justo lo que
// este arreglo acaba de escribir en esos comentarios.
//
// PROBADO ROMPIÉNDOLO, las DOCE cosas que persigue, una por una. En verde: 10 pases,
// 0 fallos; cada rotura deja 1 fallo y 9 pases, o sea que cada assert cubre algo que
// ningún otro cubre:
//    1) `antes.fathom_links` → `lead.fathom_links`           ← EL bug de #38
//    2) el diff del historial contra `lead` en vez de `antes`
//    3) la relectura deja de traer la asistencia
//    4) la marca de asistencia ignora `marcarAsistencia`
//    5) el match por nombre vuelve a afirmar la asistencia
//    6) vuelve el `.catch(() => [])` sobre fetchAllMeetings   ← EL bug de #689
//    7) vuelve el `if (!l.email) return false` de los candidatos
//    8) el buscador vuelve a ignorar los links de la ficha    ← la 2ª mitad de #38
//    9) la asistencia vuelve a salir de un link pegado a mano
//   10) vuelve un `.maybeSingle()` sobre una columna no única ← el 500 del webhook
//   11) `primerLeadPor` vuelve a `.limit(1)`
//   12) el log de la ambigüedad vuelve a escribir el teléfono
// Y restaurado vuelve a 10/0.
//
// Correr: npx tsx --test tests/crm-fathom-links.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * El fuente sin `\r` (el repo está en CRLF) y SIN COMENTARIOS. Los de línea van
 * ANTES que los de bloque: al revés, un `//` que cite una apertura de bloque se come
 * el resto del archivo.
 *
 * `ancla` es una cadena que TIENE que sobrevivir al limpiado. Sin ella, un borrado
 * desbocado deja todo lo de abajo en verde por la razón equivocada.
 */
function leer(ruta: string, ancla: string): string {
  const crudo = readFileSync(new URL(ruta, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const limpio = crudo.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(limpio.includes(ancla), `el limpiado de comentarios se comió ${ruta}`);
  return limpio;
}

/** El cuerpo de una función top-level: de su firma al `}` en la columna 0. */
function bloque(src: string, firma: string): string {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no está en el fuente: ${firma}`);
  const fin = src.indexOf('\n}\n', i);
  assert.ok(fin > i, `no encontré el cierre de ${firma}`);
  return src.slice(i, fin + 2);
}

const LEADS = leer('../lib/leads.ts', 'export async function applyFathomRecording');
const AUTO = leer('../lib/fathom-auto.ts', 'export async function adjuntarFathomAuto');
const BUSCA = leer('../lib/auto-reuniones.ts', 'export async function buscarReunionesAutomatico');

const APLICAR = bloque(LEADS, 'export async function applyFathomRecording');
const ADJUNTAR = bloque(AUTO, 'export async function adjuntarFathomAuto');
const PRIMERO = bloque(LEADS, 'async function primerLeadPor');

// ── 1 · la segunda grabación no pisa la primera ──────────────────────────────
test('el array de links se arma con lo RELEÍDO de la base, no con el lead que llegó', () => {
  // La relectura va en esta función y no en el bucle del caller porque es el choke
  // point de los TRES caminos que enganchan una grabación (el webhook de Fathom, el
  // CRM automático y el barrido de fathom-auto).
  assert.match(APLICAR, /\.select\('fathom_links, asistio_j1, asistio_j2'\)/, 'se fue la relectura del estado del lead');
  assert.match(APLICAR, /const links = antes\.fathom_links \?\? \[\];/);
  assert.doesNotMatch(
    APLICAR,
    /lead\.fathom_links/,
    'volvió a armar la lista desde el objeto que le pasaron: la grabación de la R2 pisa la de la R1',
  );
  // Y la asistencia se decide con lo mismo, o un objeto viejo vuelve a marcar algo
  // que una persona ya había decidido en el medio.
  assert.match(APLICAR, /const yaMarcado = which === 'j1' \? antes\.asistio_j1 : antes\.asistio_j2;/);
});

test('el historial diffea contra lo releído: no estampa cambios que no pasaron', () => {
  assert.match(APLICAR, /logLeadChanges\(lead\.id, antes, after, 'Fathom'\)/);
  assert.match(APLICAR, /const after = \{ \.\.\.antes,/);
});

// ── 2 · enganchar sin afirmar la asistencia ──────────────────────────────────
test('se puede enganchar el link SIN marcar la asistencia', () => {
  // `attended: null` no alcanzaba: null significa «no sé, hubo grabación» y cae en
  // `?? true`. Son dos preguntas y necesitan dos campos.
  assert.match(APLICAR, /opts\?: \{ marcarAsistencia\?: boolean \}/);
  assert.match(
    APLICAR,
    /const markedAsistencia = \(opts\?\.marcarAsistencia \?\? true\) && yaMarcado == null;/,
    'la marca de asistencia dejó de mirar `marcarAsistencia`: el match por nombre vuelve a afirmar que la persona estuvo',
  );
});

test('el match por NOMBRE engancha el link y deja la asistencia para una persona', () => {
  // lib/fathom.ts:49-71 quemó la heurística por nombre PARA LA ASISTENCIA, y la
  // salida segura que ese mismo comentario escribe es: ante la duda, null.
  assert.match(
    ADJUNTAR,
    /applyFathomRecording\(lead, which, url, null, \{ marcarAsistencia: false \}\)/,
    'el enganche por nombre volvió a afirmar la asistencia',
  );
  // Y con DOS candidatas en la ventana no se desempata: se cuenta y se abstiene.
  assert.match(ADJUNTAR, /if \(candidatas\.length > 1\) \{ ambiguos\+\+; continue; \}/);
  // El camino por email, que es la llave fuerte, sigue afirmándola.
  assert.match(ADJUNTAR, /applyFathomRecording\(lead, which, url, true\)/);
});

test('un lead SIN email ya es candidato: era el caso textual de la tarjeta', () => {
  assert.doesNotMatch(
    ADJUNTAR,
    /if \(!l\.email\) return false;/,
    'volvió el filtro que dejaba afuera a todo lead cargado por teléfono',
  );
  assert.match(ADJUNTAR, /if \(!l\.email && !nombreComparable\(l\.nombre\)\) return false;/);
  // Un nombre repetido en la tanda no identifica a nadie.
  assert.match(ADJUNTAR, /vecesElNombre\.get\(claveNombre\) === 1/);
});

// ── 3 · «no pude leer Fathom» no es «no hay grabaciones» ─────────────────────
test('la lectura de Fathom NO se traga: propaga para que alguien se entere', () => {
  const index = bloque(AUTO, 'async function grabaciones()');
  assert.match(index, /const meetings = await fetchAllMeetings\(\{ includeSummary: false \}\);/);
  assert.doesNotMatch(
    index,
    /\.catch\(/,
    'volvió el catch que convertía un fallo de Fathom en un mapa vacío: cero enganches y cero señal',
  );
  // Y el que lo llama tampoco lo convierte en un cero.
  assert.doesNotMatch(ADJUNTAR, /grabaciones\(\)\.catch/);
  assert.match(ADJUNTAR, /const \{ porEmail, porNombre: grabsPorNombre \} = await grabaciones\(\);/);
  // Lo que sí es best-effort es cada lead, y se cuenta en vez de perderse.
  assert.match(ADJUNTAR, /fallosPorLead\+\+;/);
});

// ── 4 · el buscador mira las grabaciones ya cargadas ────────────────────────
test('buscarReunionesAutomatico lee `fathom_links`, que no aparecía en el archivo', () => {
  assert.match(BUSCA, /const yaEnLaFicha = \(lead\.fathom_links \?\? \[\]\)/, 'el buscador dejó de mirar las grabaciones de la ficha');
  assert.match(BUSCA, /const linkR1 = anaLinkR1 \?\? fichaR1\?\.url \?\? null;/);
  assert.match(BUSCA, /const linkR2 = anaLinkR2 \?\? fichaR2\?\.url \?\? null;/);
  // Y lo devuelve en fathomR1/R2, que es lo que miran el wizard (para no volver a
  // pedirlo) y lib/crm-auto.ts (para no concluir No Show sobre un lead que tiene la
  // grabación guardada).
  assert.match(BUSCA, /fathomR1: linkR1 \?/);
  assert.match(BUSCA, /fathomR2: linkR2 \?/);
});

test('pero la asistencia sigue saliendo SOLO de la grabación analizada', () => {
  // Un link que alguien pegó a mano no prueba quién estuvo. Si esto saliera de
  // `linkR1`, el buscador afirmaría la asistencia desde un link cargado a mano.
  assert.match(BUSCA, /asistioJ1: anaLinkR1 \? true : null,/);
  assert.match(BUSCA, /asistioJ2: anaLinkR2 \? true : null,/);
  // Y el reporte pide SOLO lo que falta: el link ya está, la asistencia no.
  assert.match(BUSCA, /faltante\.push\(`asistencia a la \$\{cual\}`\)/);
});

// ── 5 · un teléfono repetido no tira el webhook ─────────────────────────────
test('ningún lector de una columna NO única usa .maybeSingle()', () => {
  // En `leads` la única columna con índice único es `meta_lead_id` (mig 0007).
  assert.doesNotMatch(
    LEADS,
    /\.eq\('(?:telefono_normalizado|email)',[^)]*\)\s*\.maybeSingle\(\)/,
    'volvió un .maybeSingle() sobre una columna no única: con dos filas es PGRST116 y un 500 del webhook',
  );
  // Los que quedan son por `id` y por `meta_lead_id`, que sí son únicos.
  for (const m of LEADS.match(/\.eq\('[a-z_]+',[^)]*\)\s*\.maybeSingle\(\)/g) ?? []) {
    assert.match(m, /\.eq\('(?:id|meta_lead_id)'/, `maybeSingle sobre una columna que puede repetirse: ${m.replace(/\s+/g, ' ')}`);
  }
});

test('el lector elige el más VIEJO, sabe si había más de uno, y no loguea el dato', () => {
  assert.match(PRIMERO, /\.order\('id', \{ ascending: true \}\)/, 'sin orden explícito, cuál gana lo decide Postgres');
  assert.match(
    PRIMERO,
    /\.limit\(2\)/,
    'con limit(1) se elige en silencio: el 2 es lo que permite saber que había más de uno sin pagar otra consulta',
  );
  assert.match(PRIMERO, /if \(filas\.length > 1\)/, 'la ambigüedad volvió a elegirse sin dejar rastro');
  // El valor es el teléfono o el email de una persona: al log van los ids.
  assert.doesNotMatch(PRIMERO, /\$\{valor\}/, 'el log volvió a escribir el teléfono o el email de alguien');
  assert.match(PRIMERO, /filas\.map\(\(l\) => l\.id\)/);
});
