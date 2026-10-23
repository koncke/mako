// =============================================================================
// El @ de Instagram cuenta como contacto: un prospecto de Instagram puede entrar al CRM
// =============================================================================
// 23/10/2026, criterio pasado por el Cerebro (Leads Scraper): «si el único dato que hay es el @,
// el lead se crea igual, con el @ como identificador. Un lead sin teléfono es un lead al que
// todavía no le escribiste, no un lead inválido». Lo que se fija acá:
//   1. UNA regla (`tieneContacto`, lib/contacto-minimo.ts), y la usan las tres puertas: el alta
//      de «Nuevo lead» (form y server), el importador (`recalcular`) y la prospección.
//   2. Nada se rellena: el lead con sólo el @ viaja con el email y el teléfono VACÍOS.
//   3. El @ es una llave de duplicados: en el mismo archivo y contra lo que ya está en el CRM.
//   4. El tablero lo dibuja como su canal (`soloInstagram`), sin un rótulo de «falta».
//
// Probado rompiéndolo (23/10/2026), una rotura por vez, restaurando desde memoria:
//   · `|| !!(c.instagram ?? '').trim()` quitado de tieneContacto → 9 pasan / 4 fallan;
//   · `(ig && igs.has(ig))` quitado de recalcular                 → 12 / 1;
//   · `porIg` sacado de `apuntan` en marcarExistentes              → 12 / 1;
//   · la regla vieja (email || teléfono) vuelta al alta del server → 12 / 1;
//   · `instagram: ig || null` sacado del createLead del importador → 12 / 1;
//   · `instagram: p.instagram ?? ''` sacado de pasarAlCrm          → 12 / 1;
//   · el chip `soloInstagram(l) &&` de la tarjeta del kanban quitado → 12 / 1;
//   · el `email` de `CeldasLead` vuelto a `l.email` pelado           → 12 / 1.
// Base: 13 / 0. (Rehecho el 23/10 sobre la tarjeta nueva de main: `TarjetaPersona` y `CeldasLead`.)
//
// Correr: node --import tsx --test tests/contacto-instagram.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tieneContacto, PEDIR_CONTACTO } from '../lib/contacto-minimo';
import { recalcular, type FilaImport } from '../app/crm/leads-importar';
import { contactable } from '../lib/prospectos-reglas';

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

const fila = (p: Partial<FilaImport>): FilaImport => ({
  id: 'f', nombre: 'Inmobiliaria Pérez', email: '', telefono: '', empresa: '', incluir: true, yaExiste: false, ...p,
});

// ── La regla ─────────────────────────────────────────────────────────────────

test('cualquier canal alcanza: email, teléfono con dígitos o el @', () => {
  assert.equal(tieneContacto({ email: 'a@b.com' }), true);
  assert.equal(tieneContacto({ telefono: '+52 55 1234 5678' }), true);
  assert.equal(tieneContacto({ instagram: 'inmobiliaria.perez' }), true, 'el @ solo tiene que alcanzar');
  assert.equal(tieneContacto({}), false);
  assert.equal(tieneContacto({ email: '  ', telefono: '—', instagram: ' ' }), false, 'un guion o espacios no son un canal');
  assert.match(PEDIR_CONTACTO, /^Carga /, 'el aviso arranca con la acción');
  assert.match(PEDIR_CONTACTO, /Instagram/);
});

test('el importador deja entrar una fila con sólo el @, y nada le inventa un teléfono', () => {
  const [r] = recalcular([fila({ instagram: 'inmobiliaria.perez' })]);
  assert.equal(r.motivo, null, 'con el @ no es «sin contacto»');
  assert.equal(r.email, '');
  assert.equal(r.telefono, '', 'el teléfono sigue vacío: nada se rellena');
  const [sin] = recalcular([fila({})]);
  assert.equal(sin.motivo, 'sin-contacto', 'sin ningún canal sigue sin entrar');
});

test('el mismo @ dos veces en el mismo lote: la segunda no entra', () => {
  const [a, b] = recalcular([fila({ id: 'a', instagram: 'perez' }), fila({ id: 'b', nombre: 'Otro nombre', instagram: 'PEREZ' })]);
  assert.equal(a.motivo, null);
  assert.equal(b.motivo, 'repetido-archivo');
});

test('la prospección: un perfil de Instagram sin email ni teléfono se puede pasar', () => {
  assert.equal(contactable({ email: null, telefono: null, instagram: 'perez' }), true);
  assert.equal(contactable({ email: null, telefono: null, instagram: null }), false);
});

// ── Las puertas usan la regla ────────────────────────────────────────────────

const ACCIONES = sinComentarios(leer('../app/crm/actions.ts'));

test('el alta del server exige un canal con la regla única, @ incluido', () => {
  const alta = bloque(ACCIONES, 'async function altaDeLead(');
  assert.match(alta, /tieneContacto\(\{ email: [^}]*instagram: igDelAlta \}\)/);
  assert.match(alta, /throw new Error\(PEDIR_CONTACTO\)/);
  assert.ok(!/!emptyToNull\(formData\.get\('email'\)\) && !emptyToNull\(formData\.get\('telefono'\)\)/.test(alta),
    'la regla vieja (email o teléfono) volvió al alta');
  assert.match(alta, /instagram: igDelAlta,/, 'el @ que se validó es el que se guarda');
});

test('el form del alta pregunta lo mismo que el server', () => {
  const form = sinComentarios(leer('../app/crm/new/NewLeadForm.tsx'));
  assert.match(form, /const faltaContacto = \(fd: FormData\) => !tieneContacto\(\{[\s\S]*?instagram: usuarioInstagram\(String\(fd\.get\('instagram'\)/);
  assert.match(form, /setErr\(PEDIR_CONTACTO\)/);
});

test('el importador manda el @ al alta, sin rellenar nada, y lo cuenta para no repetirlo', () => {
  const imp = bloque(ACCIONES, 'export async function importarLeadsRevisadosAction(');
  assert.match(imp, /instagram: usuarioInstagram\(/, 'el @ del cliente se sanea con la regla de la ficha');
  assert.match(imp, /createLead\(\{[\s\S]*?instagram: ig \|\| null,/);
  assert.match(imp, /\(!!ig && igsNuevos\.has\(ig\)\)/);
  assert.match(imp, /if \(ig\) igsNuevos\.add\(ig\);/);
});

test('el @ ya guardado en el CRM marca la fila como «ya existe»', () => {
  const srv = sinComentarios(leer('../app/crm/importar-server.ts'));
  assert.match(bloque(srv, 'export async function indiceContactos('), /'id, email, telefono, telefono_normalizado, instagram'/);
  assert.match(bloque(srv, 'export async function marcarExistentes('), /const apuntan = \[porEmail, porTel, porIg\]/);
});

test('la prospección manda el @ en cada fila', () => {
  const pasar = bloque(sinComentarios(leer('../lib/prospectos.ts')), 'export async function pasarAlCrm(');
  assert.match(pasar, /instagram: p\.instagram \?\? '',/);
  assert.match(pasar, /elegidos\.filter\(contactable\)/);
});

// ── Se ve distinto ───────────────────────────────────────────────────────────

const TABLERO = sinComentarios(leer('../app/crm/CrmBoard.tsx'));

test('el tablero recibe el @ del lead', () => {
  assert.match(sinComentarios(leer('../app/crm/crm-map.ts')), /instagram: l\.instagram \?\? null,/);
});

test('«sólo por Instagram» es sin email Y sin teléfono', () => {
  assert.match(TABLERO, /const soloInstagram = [\s\S]*?!l\.email\?\.trim\(\) && !l\.telefonoNorm && l\.instagram\?\.trim\(\)/);
});

test('la tarjeta del kanban y la fila de la tabla dibujan el @ como su canal', () => {
  // La tarjeta es `TarjetaPersona` con los campos de «Personalizar tarjetas»: el @ va como un chip que sale SIEMPRE
  // (como el de la automatización), no como un campo que se elige. La fila es `CeldasLead`: el @ va en su email.
  assert.match(TABLERO, /chips: <>[^\n]*\{soloInstagram\(l\) && <span className="tk-chip tk-chip--gris" data-solo-instagram[^>]*>@\{soloInstagram\(l\)\}<\/span>\}/, 'la tarjeta del kanban no dibuja el @');
  assert.match(TABLERO, /<CeldasLead [^\n]*email=\{l\.email \|\| \(soloInstagram\(l\) \? `@\$\{soloInstagram\(l\)\}` : ''\)\}/, 'la fila de la tabla no dibuja el @');
  assert.match(TABLERO, /\{soloInstagram\(l\) && \(\s*<a href=\{igDe\(/, 'la fila no ofrece abrir su Instagram');
});

test('y no hay rótulo de «falta» (Martín, 22/10/2026)', () => {
  const i = TABLERO.indexOf('data-solo-instagram');
  assert.ok(i > 0, 'no encontré el chip del @');
  const tarjeta = TABLERO.slice(i - 80, i + 200);
  assert.ok(!/[Ff]alta|[Ss]in contacto/.test(tarjeta), 'el @ se dibuja como canal, no como un faltante');
});
