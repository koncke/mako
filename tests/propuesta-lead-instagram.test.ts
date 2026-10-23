// =============================================================================
// Proponer un lead con SOLO el @ de Instagram: la skill de Claude y la pantalla de revisión
// =============================================================================
// 23/10/2026: el alta, el importador y la prospección ya aceptaban el @ como contacto
// (tests/contacto-instagram.test.ts). Quedaban dos puertas cerradas, y con ellas la mitad del
// camino de un prospecto de Instagram que Claude propone:
//   1. `POST /api/agente/lead` (la skill) exigía email o teléfono, y la `ref` por defecto salía
//      de `telefono ?? email`. ⚠️ Abrir la puerta sin tocar la `ref` habría sido un bug mudo: una
//      fila con solo el @ daba `lead:null`, y como `crearPropuesta` devuelve la propuesta que ya
//      existe cuando la `ref` choca (pendiente O aplicada), el SEGUNDO formulario con solo el @
//      contestaba ok con el link del primero y `nueva: false`. Nadie lo veía.
//   2. `/crm/revisar/<id>` armaba las filas con nombre, email, teléfono y empresa: el @ de la
//      propuesta se tiraba, y la fila caía como «sin contacto» aunque Claude lo hubiera mandado.
//
// La ruta no se puede importar desde un test (arrastra next/server, el token y la base), y
// `aFila` no se puede exportar (una ruta de Next sólo exporta sus verbos): se recorta el BLOQUE
// del fuente y se EJECUTA, con las funciones de verdad inyectadas (`tieneContacto`,
// `usuarioInstagram`). Lo que se prueba es el código del archivo, no una copia.
// ⚠️ El POST queda FUERA de ese bloque: que llame a `refPorDefecto(filas)` (y no arme la llave a mano)
// lo fija el test «el POST USA refPorDefecto», que lee el fuente del POST sin comentarios.
//
// Probado rompiéndolo (23/10/2026): base 21 / 0, 19 roturas de a UNA, restaurando los bytes desde
// memoria dentro del mismo script (y comparándolos al final). Cada una da rojo con SU mensaje:
//   · `tieneContacto` sin `instagram` en la ruta                       → 15 / 6 (el @ solo no entra)
//   · `usuarioInstagram(instagramCrudo)` por el crudo                    → 14 / 7 (las tres formas, la ref)
//   · la fila sin `instagram`                                            → 15 / 6 (contrato con la pantalla)
//   · la `ref` vuelta a `telefono ?? email`                              → 18 / 3 (el `lead:null`)
//   · el mensaje sin «instagram»                                         → 20 / 1
//   · el @ de la `ref` sin su arroba                                     → 18 / 3 (usuario numérico = teléfono)
//   · el teléfono sin dígitos otra vez como llave                        → 20 / 1 («N/A»)
//   · el @ inválido sin su mensaje propio / tirando la fila con otro canal → 20 / 1 y 19 / 2
//   · `filasDePropuesta` sin la línea del @ / sin normalizarlo            → 17 / 4 y 19 / 2
//   · la confirmación o la acción mapeando las filas (el @ vaciado)      → 20 / 1 y 20 / 1
//   · la skill sin el ejemplo, sin «solo el @», sin el perfil en la lista → 19 / 2, 19 / 2 y 20 / 1
//     (las dos primeras también rompen la igualdad con el plugin, que comparte la sección)
//   · plugin/skills/mako/SKILL.md viejo                                  → 20 / 1 (el único que no rompe la skill)
//   · `detalleDeLeads` rotulando la falta / leyendo el teléfono sin el @   → 19 / 2 y 20 / 1
// Segunda pasada (23/10/2026, tras la revisión adversarial): el hueco estaba — la `ref` vuelta a
// `telefono ?? email` EN EL POST, `refPorDefecto(crudos)` y el POST sin la `ref` del emisor daban 21 / 0.
// Con el test nuevo, base 22 / 0 y 4 roturas en la ruta, de a UNA:
//   · el POST armando la llave a mano (la línea de antes del diff)      → 21 / 1 (la primera aserción)
//   · `refPorDefecto(crudos)` en vez de las filas                        → 21 / 1 (la primera aserción)
//   · el POST sin la `ref` del emisor                                    → 21 / 1 (la primera aserción)
//   · el POST con la llave a mano DETRÁS de refPorDefecto               → 21 / 1 (la segunda aserción)
//
// Correr: node --import tsx --test tests/propuesta-lead-instagram.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { tieneContacto } from '../lib/contacto-minimo';
import { usuarioInstagram } from '../app/crm/campo-inline';
import { filasDePropuesta, filasIniciales } from '../app/crm/revisar/[id]/propuesta-lead';
import { agenteSkillMarkdown } from '../lib/agente-skill';
import { detalleDeLeads } from '../lib/inbox-movil-reglas';

const leer = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Las líneas de comentario PRIMERO y los bloques después (AGENTS.md).
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** El bloque de una función: desde su firma hasta la próxima declaración de primer nivel. */
const bloque = (src: string, firma: string) => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const fin = src.slice(i + firma.length).search(/\n(export )?(async )?(function|const|type) /);
  return src.slice(i, fin < 0 ? undefined : i + firma.length + fin);
};

// ── La ruta de la skill, ejecutada desde su fuente ───────────────────────────

type Crudo = Record<string, unknown>;
type Resultado = { fila: Record<string, unknown> } | { error: string };
type Ruta = { aFila: (c: Crudo, i: number) => Resultado; refPorDefecto: (f: Array<Record<string, unknown>>) => string };

function cargarRuta(): Ruta {
  const src = leer('../app/api/agente/lead/route.ts');
  const desde = src.indexOf('const txt = ');
  const hasta = src.indexOf('/** El tope por propuesta');
  assert.ok(desde >= 0 && hasta > desde, 'no encontré el bloque `txt` … `refPorDefecto` de la ruta');
  const js = ts.transpileModule(
    `(function (tieneContacto, usuarioInstagram) {\n${src.slice(desde, hasta)}\nreturn { aFila, refPorDefecto };\n})`,
    { compilerOptions: { target: ts.ScriptTarget.ES2020 } },
  ).outputText;
  const fabrica = new Function(`return ${js.trim().replace(/;$/, '')}`)() as (a: unknown, b: unknown) => Ruta;
  return fabrica(tieneContacto, usuarioInstagram);
}
const ruta = cargarRuta();

const fila = (c: Crudo): Record<string, unknown> => {
  const r = ruta.aFila(c, 0);
  assert.ok('fila' in r, `se esperaba una fila y salió «${'error' in r ? r.error : ''}»`);
  return r.fila;
};
const error = (c: Crudo): string => {
  const r = ruta.aFila(c, 0);
  assert.ok('error' in r, 'se esperaba un rechazo y entró como fila');
  return r.error;
};
const refDe = (...crudos: Crudo[]) => ruta.refPorDefecto(crudos.map(fila));

test('un lead con solo el @ entra, con el email y el teléfono VACÍOS (nada se rellena)', () => {
  const f = fila({ nombre: 'Casa Pérez', instagram: '@CasaPerez' });
  assert.equal(f.instagram, 'casaperez', 'sin la @ y en minúsculas, como lo guarda la ficha');
  assert.equal(f.email, null, 'un mail inventado no existe: el dueño lo confirmaría creyendo que es real');
  assert.equal(f.telefono, null, 'un teléfono inventado matchearía el WhatsApp de otra persona');
});

test('el @ llega en sus tres formas y queda igual', () => {
  for (const forma of ['@casaperez', 'casaperez', 'https://www.instagram.com/casaperez/?igsh=abc123']) {
    assert.equal(fila({ nombre: 'Casa Pérez', instagram: forma }).instagram, 'casaperez', `la forma «${forma}»`);
  }
});

test('sin ningún canal se rechaza, y el mensaje nombra los TRES campos', () => {
  const msg = error({ nombre: 'Casa Pérez' });
  assert.match(msg, /"email"/);
  assert.match(msg, /"telefono"/);
  assert.match(msg, /"instagram"/, 'el mensaje viejo decía «email ni telefono» y mandaba a buscar un dato que ya no es el único');
  assert.match(msg, /Casa Pérez/);
  assert.match(error({ nombre: 'Casa Pérez', email: ' ', telefono: 'N/A', instagram: '  ' }), /"instagram"/,
    'espacios y un teléfono sin dígitos tampoco son un canal');
});

test('un "instagram" que no es un usuario se dice como tal, no como «falta»', () => {
  for (const malo of ['Casa Pérez Inmobiliaria', 'https://www.instagram.com/p/Cabc123/']) {
    const msg = error({ nombre: 'Casa Pérez', instagram: malo });
    assert.match(msg, /no es un usuario/, `«${malo}»`);
    assert.match(msg, /@usuario/, 'dice qué mandar');
  }
});

test('un @ inválido NO tira la fila si hay otro canal: el @ no se guarda y el resto sí', () => {
  const f = fila({ nombre: 'Ana', email: 'ANA@Ejemplo.com', instagram: 'dos palabras' });
  assert.equal(f.instagram, null);
  assert.equal(f.email, 'ana@ejemplo.com');
});

test('email y teléfono siguen bastando, y la fila trae las MISMAS claves de siempre más el @', () => {
  const f = fila({ nombre: 'Beto', telefono: '+5491199887766' });
  assert.equal(f.instagram, null, 'sin @ el campo viaja null: es el contrato con la pantalla de revisión');
  assert.deepEqual(Object.keys(f).sort(),
    ['email', 'empresa', 'instagram', 'nombre', 'telefono', 'utm_campaign', 'utm_content', 'utm_medium', 'utm_source']);
});

// ── La `ref` por defecto: lo que no se ve ────────────────────────────────────

test('dos @ distintos NO comparten propuesta: la `ref` no puede ser `lead:null`', () => {
  const a = refDe({ nombre: 'A', instagram: '@casaperez' });
  const b = refDe({ nombre: 'B', instagram: '@otracasa' });
  assert.notEqual(a, b, 'dos formularios distintos con solo el @ chocaban en la misma propuesta y el segundo se perdía');
  assert.ok(!/null|undefined/.test(a), `la llave no puede salir de un valor vacío: ${a}`);
  assert.equal(a, 'lead:@casaperez');
});

test('el mismo @ escrito de otra forma es la MISMA persona: reintentar no duplica', () => {
  assert.equal(
    refDe({ nombre: 'A', instagram: '@CasaPerez' }),
    refDe({ nombre: 'A', instagram: 'https://instagram.com/casaperez' }),
  );
});

test('un usuario que es todo números no choca con un teléfono', () => {
  assert.notEqual(
    refDe({ nombre: 'A', instagram: '5491122334455' }),
    refDe({ nombre: 'A', telefono: '5491122334455' }),
    'sin la arroba el @ y el teléfono compartían llave',
  );
});

test('las `ref` de antes NO cambian: teléfono primero, después email (las propuestas pendientes siguen siendo idempotentes)', () => {
  assert.equal(refDe({ nombre: 'A', telefono: '+5491122334455', email: 'a@x.com', instagram: '@a' }), 'lead:+5491122334455');
  assert.equal(refDe({ nombre: 'A', email: 'a@x.com' }), 'lead:a@x.com');
  assert.equal(refDe(
    { nombre: 'A', telefono: '+5491122334455' }, { nombre: 'B', instagram: '@b' },
  ), 'lead:+5491122334455,@b');
});

test('un «teléfono» sin dígitos no es la llave de nadie: la `ref` sale del email', () => {
  assert.equal(refDe({ nombre: 'A', telefono: 'N/A', email: 'a@x.com' }), 'lead:a@x.com');
  assert.notEqual(
    refDe({ nombre: 'A', telefono: 'N/A', email: 'a@x.com' }),
    refDe({ nombre: 'B', telefono: 'N/A', email: 'b@x.com' }),
    'dos personas con «N/A» de teléfono compartían propuesta',
  );
});

test('el POST USA refPorDefecto(filas): no arma la llave a mano ni se salta la `ref` del emisor', () => {
  // ⚠️ Los tests de arriba ejecutan `aFila` y `refPorDefecto`, que son los bloques ANTES del POST: nada
  // fijaba que el POST llamara a esa función. Volver ahí a `filas.map((f) => f.telefono ?? f.email)`
  // dejaba los 21 en verde y traía de vuelta el `lead:null` (el segundo formulario con solo el @
  // contestaba ok con el link del primero y `nueva: false`). Probado el 23/10/2026: sin este test,
  // las tres roturas del cableado daban 21 / 0.
  const post = bloque(sinComentarios(leer('../app/api/agente/lead/route.ts')), 'export async function POST(');
  assert.match(post, /txt\(body\.ref\)\s*\?\?\s*refPorDefecto\(filas\)/,
    'la `ref` es la que manda el emisor (idempotencia ante un reintento) y, si no manda, refPorDefecto(filas): las FILAS, ya normalizadas');
  assert.ok(!/lead:\$\{|\.(telefono|email|instagram)\s*\?\?/.test(post),
    'el POST arma una llave de contacto a mano: sin el @ en ella, dos formularios con solo el @ chocan en la misma propuesta');
});

// ── La pantalla de revisión ──────────────────────────────────────────────────

test('/crm/revisar: una propuesta con solo el @ NO cae como «sin contacto»', () => {
  const [f] = filasDePropuesta({ leads: [{ nombre: 'Casa Pérez', email: null, telefono: null, instagram: 'casaperez' }] });
  assert.equal(f.instagram, 'casaperez');
  assert.equal(f.motivo ?? null, null, 'con el @ la fila entra');
  assert.equal(f.email, '');
  assert.equal(f.telefono, '', 'nada se rellena');
  assert.equal(filasIniciales([f])[0].incluir, true, 'y nace tildada: no hay motivo para destildarla');
});

test('/crm/revisar: el @ se vuelve a normalizar, también en la forma vieja de un lead suelto', () => {
  assert.equal(filasDePropuesta({ leads: [{ nombre: 'A', instagram: '@CasaPerez' }] })[0].instagram, 'casaperez');
  assert.equal(filasDePropuesta({ leads: [{ nombre: 'A', instagram: 'https://www.instagram.com/casaperez/' }] })[0].instagram, 'casaperez');
  assert.equal(filasDePropuesta({ nombre: 'A', instagram: '@casaperez' })[0].instagram, 'casaperez', 'el contacto suelto de WhatsApp');
});

test('/crm/revisar: sin @, o con algo que no es un usuario, la fila sigue sin él (vacío, no inventado)', () => {
  const filas = filasDePropuesta({ leads: [
    { nombre: 'Ana', email: 'ana@x.com' },
    { nombre: 'Beto', instagram: 'dos palabras' },
    { nombre: 'Carla', instagram: 42 },
  ] });
  assert.deepEqual(filas.map((f) => f.instagram), ['', '', '']);
  assert.deepEqual(filas.map((f) => f.motivo ?? null), [null, 'sin-contacto', 'sin-contacto']);
});

test('/crm/revisar: el mismo @ dos veces en una propuesta, la segunda es «repetido»', () => {
  const [a, b] = filasDePropuesta({ leads: [{ nombre: 'A', instagram: '@perez' }, { nombre: 'B', instagram: 'PEREZ' }] });
  assert.equal(a.motivo ?? null, null);
  assert.equal(b.motivo, 'repetido-archivo');
});

test('/crm/revisar: las filas viajan ENTERAS hasta crear el lead (el @ no se pierde en el camino)', () => {
  const comp = sinComentarios(leer('../app/crm/revisar/[id]/RevisarLead.tsx'));
  assert.match(comp, /confirmarLeadsAction\(prop\.id, filas\)/, 'la confirmación manda las filas tal cual están en pantalla');
  const accion = bloque(sinComentarios(leer('../app/crm/revisar/[id]/acciones.ts')), 'export async function confirmarLeadsAction(');
  assert.match(accion, /importarLeadsRevisadosAction\(filas, casa\)/, 'y se las pasa enteras al importador, que ya sanea el @');
});

// ── La skill ─────────────────────────────────────────────────────────────────

const seccionDeLead = (md: string) => {
  const i = md.indexOf('## 4. Proponer un lead para el CRM');
  const f = md.indexOf('## 3. Entrega el link ENTERO');
  assert.ok(i >= 0 && f > i, 'no encontré la sección «Proponer un lead para el CRM» de la skill');
  return md.slice(i, f);
};
const SKILL = agenteSkillMarkdown('https://mako.test', null).replace(/\r\n/g, '\n');

test('la skill dice que el @ alcanza, con la regla de los tres campos y un ejemplo', () => {
  const s = seccionDeLead(SKILL);
  assert.match(s, /al menos\*\* uno de\s+`email`,\s+`telefono`\s+o\s+`instagram`/, 'la regla de «al menos uno de los tres»');
  assert.ok(!/al menos\*\* `email` o `telefono`/.test(s), 'volvió la regla vieja (email o teléfono)');
  assert.match(s, /"instagram": "@casaperez"/, 'el ejemplo del lote trae un lead con solo el @');
  assert.match(s, /solo tienes el @, manda solo el @/, 'y no se inventan un mail ni un teléfono para completar');
  assert.match(s, /sin la @/, 'dice cómo se guarda');
});

test('el plugin público (SKILL.md) es la MISMA sección: se regeneró desde la skill', () => {
  const plugin = leer('../plugin/skills/mako/SKILL.md');
  assert.equal(seccionDeLead(plugin), seccionDeLead(SKILL),
    'plugin/ quedó viejo respecto de lib/agente-skill.ts: node --import tsx scripts/generar-plugin.mjs');
  assert.match(seccionDeLead(plugin), /`instagram`/);
});

test('la lista de la skill nombra el perfil de Instagram como una de las cosas que se proponen', () => {
  assert.match(SKILL, /un contacto que llegó\s+por afuera: [^\n]*perfil de Instagram/);
});

// ── MaKo Mobile ──────────────────────────────────────────────────────────────

test('el teléfono: un lote con solo el @ se lista por su nombre, sin rótulo de «falta»', () => {
  const lineas = detalleDeLeads({ leads: [
    { nombre: 'Casa Pérez', email: null, telefono: null, instagram: 'casaperez' },
    { nombre: 'Beto', empresa: 'Acme', telefono: '+5491199887766', instagram: null },
  ] });
  assert.deepEqual(lineas.map((l) => l.valor), ['Casa Pérez', 'Beto · Acme']);
  assert.ok(lineas.every((l) => !/falta|sin /i.test(`${l.rotulo} ${l.valor}`)), 'el dato que no hay no se muestra (Martín, 22/10/2026)');
});

test('el teléfono: si el sheet algún día dibuja email o teléfono de la propuesta, dibuja también el @', () => {
  const b = bloque(sinComentarios(leer('../lib/inbox-movil-reglas.ts')), 'export function detalleDeLeads(');
  if (/\.(email|telefono)\b/.test(b)) {
    assert.match(b, /\.instagram\b/, 'detalleDeLeads dibuja el contacto de la propuesta pero se olvidó del @: con solo el @ quedaría vacío');
  }
});
