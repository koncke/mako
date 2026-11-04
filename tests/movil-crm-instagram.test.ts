// =============================================================================
// MaKo Mobile: un lead que sólo tiene su @ de Instagram se ve en el teléfono como en la computadora
// =============================================================================
// 23/10/2026. El @ ya cuenta como contacto (lib/contacto-minimo.ts, tests/contacto-instagram.test.ts) y el escritorio
// lo dibuja cuando es el ÚNICO canal (`soloInstagram`, app/crm/CrmBoard.tsx): un chip en la tarjeta, el @ donde la
// tabla pone el email y un botón para abrir su Instagram donde las demás filas ofrecen WhatsApp. El teléfono DESTILA el
// escritorio (AGENTS.md): lo mismo, con menos cosas. Lo que se fija acá:
//   1. UNA condición, escrita dos veces a propósito (CrmBoard es un client del escritorio y no se importa en /m): se
//      evalúan las dos, la del escritorio leída de su fuente, sobre una tabla de casos y sobre todas las combinaciones.
//   2. Que el @ LLEGA: sale de la consulta (LISTA_COLS), no de un tipo que lo declara.
//   3. La tarjeta del tablero dibuja el chip y la fila de la búsqueda lo dice, sin rótulo de «falta».
//   4. Con el @ como único canal no hay botón muerto: ni Llamar ni WhatsApp apagados en la ficha, ni en la rápida.
//
// Probado rompiéndolo (23/10/2026): una rotura por vez sobre el archivo real, restaurada desde memoria (y comparada por
// hash), base 13 / 0, y cada una da rojo con SU mensaje:
//   · el helper sin mirar el teléfono (`&& !l.telefonoNorm` fuera)              → 10 / 3 (la tabla, la equivalencia, la búsqueda)
//   · el helper sin mirar el email                                               → 11 / 2 (la tabla, la equivalencia)
//   · el helper devolviendo el @ sin recortar                                    → 11 / 2 (la tabla, la equivalencia)
//   · la búsqueda sin el @ en la segunda línea / sin mirar el teléfono           → 12 / 1 cada una
//   · datos: la tarjeta sin `soloInstagram` / ignorando el teléfono              → 12 / 1 cada una
//   · datos: la ficha con `f.telefono` (canónico: null debajo de 10 dígitos)     → 12 / 1
//   · el tablero sin el chip                                                     → 12 / 1
//   · el chip con «Sin contacto» pegado                                          → 11 / 2 (el chip y «sin rótulo de falta»)
//   · el chip atado a `campos` («Personalizar tarjetas») / el nombre sin el @    → 12 / 1 cada una
//   · la rápida sin «Instagram» / con el link armado a mano                      → 12 / 1 y 11 / 2
//   · la ficha con un `aria-disabled` o un WhatsApp apagado en la rama del @     → 12 / 1 cada una
//   · la ficha sin repartir la fila / con «Sin teléfono» en el contacto          → 12 / 1 cada una
//   · la ficha con el link a mano (también lo ve «a mano») / sin la clase del CSS → 11 / 2 y 12 / 1
//   · la página sin pasarle el @ a la ficha                                      → 12 / 1
// La condición del ESCRITORIO es de otro chat y no se toca desde acá: se rompe EN MEMORIA dentro del test («la guardia no es
// vacía»), igual que LISTA_COLS sin `instagram` (lib/leads.ts). Ahí la prueba es que el extractor ve la diferencia.
//
// Correr: node --import tsx --test tests/movil-crm-instagram.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { buscarEnCartera, soloInstagram, type CanalesDeLead } from '../app/m/crm/reglas';
import { linkInstagram } from '../app/crm/campo-inline';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
// Las líneas `//` PRIMERO, el comentario de JSX y los bloques después (AGENTS.md): un comentario con el código viejo
// adentro hace pasar una guardia que mira el código.
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
/** De `desde` hasta el próximo `hasta` (sin incluirlo). */
const entre = (src: string, desde: string, hasta: string) => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const f = src.indexOf(hasta, i + desde.length);
  assert.ok(f > i, `no encontré «${hasta}» después de «${desde}»`);
  return src.slice(i, f);
};

// ── 1. La condición, escrita dos veces: la del escritorio y la del teléfono ─────────────────────────────────────────

type Predicado = (l: CanalesDeLead) => string | null;

/** El texto de `soloInstagram` en CrmBoard.tsx: su declaración de primer nivel, sin el comentario de arriba. */
function textoDelEscritorio(fuente: string): string {
  const sf = ts.createSourceFile('CrmBoard.tsx', fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const st = sf.statements.find((s) =>
    (ts.isVariableStatement(s) && s.declarationList.declarations.some((d) => ts.isIdentifier(d.name) && d.name.text === 'soloInstagram'))
    || (ts.isFunctionDeclaration(s) && s.name?.text === 'soloInstagram'));
  assert.ok(st, 'CrmBoard.tsx ya no declara `soloInstagram` a primer nivel: la guardia quedó vieja');
  return st.getText(sf).replace(/^export /, '');
}
/** Vuelve llamable ese texto. Los tipos se borran con transpileModule (no se chequean: es sólo para ejecutarlo). */
function comoFuncion(texto: string): Predicado {
  const js = ts.transpileModule(texto, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  // eslint-disable-next-line no-new-func
  return new Function(`${js}; return soloInstagram;`)() as Predicado;
}

const ESCRITORIO = textoDelEscritorio(leer('app/crm/CrmBoard.tsx'));
const delEscritorio = comoFuncion(ESCRITORIO);

type Caso = { que: string; lead: CanalesDeLead; esperado: string | null };
const CASOS: Caso[] = [
  { que: 'sin email, ni teléfono, ni @', lead: {}, esperado: null },
  { que: 'sólo el @', lead: { instagram: 'perez' }, esperado: 'perez' },
  { que: 'el @ y un email', lead: { email: 'a@b.com', instagram: 'perez' }, esperado: null },
  { que: 'el @ y un teléfono', lead: { telefonoNorm: '5215512345678', instagram: 'perez' }, esperado: null },
  { que: 'el @ con espacios alrededor', lead: { instagram: '  perez.ok  ' }, esperado: 'perez.ok' },
  { que: 'el @ son sólo espacios', lead: { instagram: '   ' }, esperado: null },
  { que: 'un email en blanco y el @', lead: { email: '   ', instagram: 'perez' }, esperado: 'perez' },
  { que: 'un teléfono sin dígitos (normalizado vacío) y el @', lead: { telefonoNorm: '', instagram: 'perez' }, esperado: 'perez' },
  { que: 'un teléfono null y el @', lead: { telefonoNorm: null, email: null, instagram: 'perez' }, esperado: 'perez' },
  // Un teléfono corto SÍ es un teléfono: el escritorio no dibuja el @ ahí. `numeroCanonico` lo daría por vacío (exige 10).
  { que: 'un teléfono corto (7 cifras) y el @', lead: { telefonoNorm: '5551234', instagram: 'perez' }, esperado: null },
  { que: 'sólo un teléfono', lead: { telefonoNorm: '5215512345678' }, esperado: null },
  // Lo guardado a mano que no es un usuario: la tarjeta dice lo que hay (como la de escritorio), y el link no existe (abajo).
  { que: 'un @ que no es un usuario', lead: { instagram: 'Martin Koncke' }, esperado: 'Martin Koncke' },
];

/** Todas las combinaciones de los tres canales, con los valores raros que trae la base. */
const GRILLA: CanalesDeLead[] = (() => {
  const emails = [undefined, null, '', '   ', 'a@b.com'];
  const tels = [undefined, null, '', '5215512345678', '5551234'];
  const igs = [undefined, null, '', '   ', 'perez', '  perez  ', '@perez', 'Martin Koncke'];
  return emails.flatMap((email) => tels.flatMap((telefonoNorm) => igs.map((instagram) => ({ email, telefonoNorm, instagram }))));
})();

test('el helper del teléfono: la tabla de casos', () => {
  for (const c of CASOS) assert.equal(soloInstagram(c.lead), c.esperado, c.que);
});

test('EQUIVALENCIA: la condición del teléfono y la de escritorio dicen lo mismo, en la tabla y en todas las combinaciones', () => {
  for (const c of CASOS) assert.equal(delEscritorio(c.lead), c.esperado, `el ESCRITORIO en «${c.que}»`);
  assert.ok(GRILLA.length >= 200, 'la grilla se achicó');
  for (const l of GRILLA) assert.equal(soloInstagram(l), delEscritorio(l), `divergen en ${JSON.stringify(l)}`);
});

test('la guardia no es vacía: una condición de escritorio distinta SE NOTA (se rompe en memoria, CrmBoard no se toca)', () => {
  const roturas: Array<[string, string, string]> = [
    ['sin mirar el teléfono', '&& !l.telefonoNorm', ''],
    ['sin mirar el email', '!l.email?.trim() && ', ''],
    ['sin recortar el @', 'l.instagram.trim() : null', 'l.instagram : null'],
    ['con un teléfono que no cuenta', '!l.telefonoNorm', 'true'],
  ];
  for (const [que, a, b] of roturas) {
    assert.ok(ESCRITORIO.includes(a), `${que}: la rotura no aplica, la condición cambió de forma`);
    const rota = comoFuncion(ESCRITORIO.replace(a, b));
    // Contra la condición REAL del escritorio, no contra la del teléfono: así lo que prueba es la guardia, y no se mezcla con un helper roto.
    assert.ok(GRILLA.some((l) => rota(l) !== delEscritorio(l)), `${que}: la guardia no lo notó`);
  }
});

test('un @ que no es un usuario no tiene link: no se dibuja un botón que no lleva a nada', () => {
  assert.equal(linkInstagram('perez'), 'https://www.instagram.com/perez/');
  assert.equal(linkInstagram('Martin Koncke'), null);
  assert.equal(linkInstagram(null), null);
});

// ── 2. El @ LLEGA al teléfono ────────────────────────────────────────────────────────────────────────────────────────

/** ¿La lista de columnas que leen el tablero y la búsqueda baja `instagram`? Sin la columna no falla nada: llega undefined. */
const listaTraeInstagram = (leads: string) => /\binstagram, /.test(entre(leads, 'const LISTA_COLS =', ';\n'));

test('el @ sale de la consulta: LISTA_COLS lo baja, y la usan el tablero, la búsqueda y las dos fuentes del teléfono', () => {
  const leads = sinComentarios(leer('lib/leads.ts'));
  assert.ok(listaTraeInstagram(leads), 'LISTA_COLS no baja `instagram`: el tablero y la búsqueda lo reciben undefined, sin un error');
  // La guardia no es vacía: sin la columna (roto en memoria, lib/leads.ts no se toca) lo nota.
  assert.ok(leads.includes("'ingreso_estimado, instagram, '"), 'LISTA_COLS cambió de forma');
  assert.ok(!listaTraeInstagram(leads.replace("'ingreso_estimado, instagram, '", "'ingreso_estimado, '")), 'la guardia no nota que falte la columna');
  assert.match(entre(leads, 'export async function listLeadsDeFunnel(', '\n}\n'), /LISTA_COLS/, 'el tablero del teléfono lee otra lista de columnas');
  assert.match(entre(leads, 'async function _listLeads(', '\n}\n'), /LISTA_COLS/, 'la búsqueda del teléfono lee otra lista de columnas');
  // La ficha lee el lead entero (select *), así que trae `instagram` y `telefono_normalizado`.
  assert.match(entre(leads, 'export async function getLead(', '\n}\n'), /\.select\('\*'\)/);
  // Y el mapa que alimenta al tablero lo deja en la fila (la misma función que usa el escritorio).
  assert.match(sinComentarios(leer('app/crm/crm-map.ts')), /instagram: l\.instagram \?\? null,/);
  assert.match(sinComentarios(leer('lib/crm-movil.ts')), /telefono: l\.telefono, instagram: l\.instagram \}\)\), q\);/, 'la búsqueda no le pasa el @');
});

const DATOS = sinComentarios(leer('app/m/crm/datos.ts'));

test('el tablero y la ficha del teléfono arman el @ con las mismas columnas que la tarjeta de escritorio', () => {
  assert.match(DATOS, /import \{[^}]*\bsoloInstagram\b[^}]*\} from '\.\/reglas';/);
  // El tablero: el mapa de escritorio (mapToCrmLead) y sus tres campos, tal cual.
  assert.match(DATOS, /mapToCrmLead\(l, campMap, tablero\)/);
  const push = DATOS.slice(DATOS.indexOf('tarjetas.push({'));
  assert.match(push, /soloInstagram: soloInstagram\(\{ email: c\.email, telefonoNorm: c\.telefonoNorm, instagram: c\.instagram \}\),/);
  assert.match(entre(DATOS, 'export type TarjetaCrmM = {', '\n};'), /soloInstagram: string \| null;/, 'la tarjeta del tablero no declara el @');
  assert.match(entre(DATOS, 'export type FichaV2 = {', '\n};'), /soloInstagram: string \| null;/, 'la ficha no declara el @');
  // La ficha: con el lead entero y su `telefono_normalizado`. `f.telefono` es `numeroCanonico` y da null con menos de 10 dígitos.
  assert.match(DATOS, /soloInstagram: lead \? soloInstagram\(\{ email: lead\.email, telefonoNorm: lead\.telefono_normalizado, instagram: lead\.instagram \}\) : null,/);
  assert.doesNotMatch(DATOS, /telefonoNorm: f\.telefono/, 'un lead con un teléfono corto guardado se vería como «sólo Instagram» en el teléfono y con su teléfono en la computadora');
});

// ── 3. La tarjeta y la búsqueda dibujan el @ ─────────────────────────────────────────────────────────────────────────

const TABLERO = sinComentarios(leer('app/m/crm/TableroCrm.tsx'));
const ESC = sinComentarios(leer('app/crm/CrmBoard.tsx'));

test('la tarjeta del teléfono dibuja el MISMO chip que la de escritorio, siempre que el @ es su único canal', () => {
  const fila = entre(TABLERO, 'function FilaLead(', '\n}\n');
  assert.match(fila, /\{t\.soloInstagram && \(\s*<span className="tk-chips m-crm-tj__canal"><span className="tk-chip tk-chip--gris" data-solo-instagram>@\{t\.soloInstagram\}<\/span><\/span>\s*\)\}/);
  // El de escritorio: la misma clase y el mismo atributo (que el tablero de la computadora y el del teléfono se vean parecidos).
  assert.match(ESC, /<span className="tk-chip tk-chip--gris" data-solo-instagram/);
  // No depende de «Personalizar tarjetas»: no está atado a `campos`.
  assert.doesNotMatch(entre(fila, '{t.soloInstagram', 'data-solo-instagram'), /campos/);
  // Y la clase que lo separa de la línea de arriba existe, y la del chip también.
  assert.match(leer('app/m/crm/crm.css'), /\.m-crm-tj__canal \{/);
  assert.match(leer('app/_ui/TarjetaKanban.tsx'), /\.tk-chip--gris \{/);
  // El nombre accesible de la tarjeta lo lleva (el chip es texto y la tarjeta se nombra con `etiqueta`).
  assert.match(TABLERO, /etiqueta: \[t\.nombre, t\.soloInstagram \? `@\$\{t\.soloInstagram\}` : null, t\.senal\.dice\]\.filter\(Boolean\)\.join\(', '\),/);
});

test('sin rótulo de «falta» (Martín, 22/10/2026: «si no tiene ese dato, que no lo muestre»)', () => {
  const i = TABLERO.indexOf('data-solo-instagram');
  assert.ok(i > 0, 'no encontré el chip del @');
  assert.ok(!/[Ff]alta|[Ss]in (contacto|email|tel[eé]fono|n[uú]mero)/.test(TABLERO.slice(i - 200, i + 120)), 'el @ se dibuja como canal, no como un faltante');
  // La fila del contacto en la ficha dice el @ en vez de «Sin teléfono».
  const ficha = sinComentarios(leer('app/m/crm/[id]/FichaLead.tsx'));
  assert.match(ficha, /\{p\.soloInstagram \? <FilaDatoM k="Instagram" v=\{`@\$\{p\.soloInstagram\}`\} \/> : <FilaDatoM k="Teléfono" v=\{p\.telefono \?\? 'Sin teléfono'\} \/>\}/);
});

test('la búsqueda del teléfono dice el @ donde no hay empresa ni email, y sólo si es su único canal', () => {
  const cartera = [
    { id: 1, nombre: 'Pérez sólo @', instagram: 'perez' },
    { id: 2, nombre: 'Pérez con empresa', empresa: 'Acme', instagram: 'perez2' },
    { id: 3, nombre: 'Pérez con email', email: 'a@b.com', instagram: 'perez3' },
    { id: 4, nombre: 'Pérez con teléfono', telefono: '+52 55 1234 5678', instagram: 'perez4' },
    { id: 5, nombre: 'Pérez con raya', telefono: '—', instagram: 'perez5' },
    { id: 6, nombre: 'Pérez sin nada' },
  ];
  const { filas } = buscarEnCartera(cartera, 'pérez');
  assert.deepEqual(filas.map((f) => [f.id, f.segunda]), [
    [1, '@perez'], [2, 'Acme'], [3, 'a@b.com'], [4, null], [5, '@perez5'], [6, null],
  ]);
  assert.deepEqual(Object.keys(filas[0]).sort(), ['id', 'nombre', 'segunda'], 'la fila de la búsqueda no cambia de forma');
});

// ── 4. Ningún botón muerto ───────────────────────────────────────────────────────────────────────────────────────────

test('la ficha rápida: «Instagram» donde las demás ofrecen Llamar y WhatsApp, y ninguno de los dos sin número', () => {
  const rapida = entre(TABLERO, 'acciones={[', ']}\n            onMoverA');
  assert.match(rapida, /\.\.\.\(r\.telefono \? \[\{ texto: 'Llamar', href: `tel:\+\$\{r\.telefono\}`, primaria: true \}, \{ texto: 'WhatsApp', href: `https:\/\/wa\.me\/\$\{r\.telefono\}`, externo: true \}\] : \[\]\),/);
  assert.match(rapida, /\.\.\.\(igR \? \[\{ texto: 'Instagram', href: igR, externo: true, primaria: true \}\] : \[\]\),/);
  assert.match(rapida, /primaria: !r\.telefono && !igR/, '«Abrir ficha» sigue de primaria con «Instagram» a la vista');
  // El link se arma con campo-inline, nunca a mano; y sin link (un @ que no es usuario) no hay botón.
  assert.match(TABLERO, /const igR = r\?\.soloInstagram \? linkInstagram\(r\.soloInstagram\) : null;/);
  assert.match(TABLERO, /import \{ linkInstagram \} from '@\/app\/crm\/campo-inline';/);
  // Y el @ también se lee en la ficha rápida.
  assert.match(TABLERO, /\.\.\.\(r\.soloInstagram \? \[\{ k: 'Instagram', v: `@\$\{r\.soloInstagram\}` \}\] : \[\]\),/);
});

test('la ficha: con el @ como único canal no hay Llamar ni WhatsApp apagados, hay «Instagram»', () => {
  const ficha = sinComentarios(leer('app/m/crm/[id]/FichaLead.tsx'));
  const acciones = entre(ficha, '<div className="m-crm-acciones"', "onClick={() => setSheet('agendar')}");
  const solo = acciones.slice(acciones.indexOf('{p.soloInstagram ? ('), acciones.indexOf('<>'));
  assert.ok(solo.length > 20, 'no encontré la rama del @ como único canal');
  assert.match(solo, /igHref && \(/, 'sin link no se dibuja el botón');
  assert.match(solo, /href=\{igHref\} target="_blank" rel="noopener noreferrer"/);
  assert.match(solo, /<Icon name="instagram" size=\{22\} \/>/);
  // Lo que NO puede haber en esa rama: un botón apagado, un toast de «sin número», el Llamar o el WhatsApp.
  assert.doesNotMatch(solo, /aria-disabled|toast\(|Llamar|WhatsApp|p\.tel\b|rutaChatsDeLead/);
  // La otra rama (un lead con otros canales) sigue como estaba, con su Llamar y su WhatsApp.
  const resto = acciones.slice(acciones.indexOf('<>'));
  assert.match(resto, /href=\{p\.tel\} aria-label=\{`Llamar a \$\{p\.nombre\}`\}/);
  assert.match(resto, /href=\{rutaChatsDeLead\(p\.id\)\} aria-label=\{`WhatsApp con \$\{p\.nombre\}`\}/);
  // La fila se reparte entre los botones que quedan, y el link se arma con campo-inline. Desde el 04/11/2026 la fila tiene
  // además «Grabar» (siempre), así que se reparte en todos los casos: Agendar, Nota y Grabar, más Llamar y WhatsApp o Instagram.
  assert.match(acciones, /style=\{\{ gridTemplateColumns: `repeat\(\$\{nAcciones\}, minmax\(0, 1fr\)\)` \}\}/);
  assert.match(ficha, /const igHref = p\.soloInstagram \? linkInstagram\(p\.soloInstagram\) : null;/);
  assert.match(ficha, /const nAcciones = 3 \+ \(p\.soloInstagram \? \(igHref \? 1 : 0\) : 2\);/);
  assert.match(sinComentarios(leer('app/m/crm/[id]/page.tsx')), /soloInstagram=\{d\.soloInstagram\}/, 'la página no le pasa el @ a la ficha');
});

test('el link de Instagram se arma en campo-inline, no a mano, en ningún archivo del CRM del teléfono', () => {
  for (const f of ['reglas.ts', 'datos.ts', 'TableroCrm.tsx', '[id]/FichaLead.tsx', '[id]/page.tsx']) {
    assert.doesNotMatch(sinComentarios(leer(`app/m/crm/${f}`)), /instagram\.com/, `${f} arma a mano el link del perfil`);
  }
});

test('hoy el teléfono no da de alta leads; el día que lo haga, pregunta por el contacto con la regla única', () => {
  // El alta de escritorio exige un canal con `tieneContacto` (lib/contacto-minimo.ts, el @ incluido). Un alta del teléfono con su
  // propia regla de «email o teléfono» volvería a dejar afuera al lead que sólo tiene su @.
  for (const f of ['reglas.ts', 'datos.ts', 'acciones.ts', 'TableroCrm.tsx', '[id]/FichaLead.tsx', '[id]/page.tsx']) {
    const src = sinComentarios(leer(`app/m/crm/${f}`));
    if (/createLead|altaDeLead|crearLead/.test(src)) assert.match(src, /tieneContacto/, `${f}: da de alta leads sin preguntar por el contacto con \`tieneContacto\``);
  }
});
