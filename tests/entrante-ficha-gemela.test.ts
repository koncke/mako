// =============================================================================
// Dos fichas con el mismo teléfono: la respuesta va a la que le ESCRIBIMOS último (24/10/2026)
// =============================================================================
// El caso real: German, en Leila, con la #1776 (agosto, número sin país) y la #1797 (52 + 10 dígitos), activa en
// «Recordatorio clase reactivación». WhatsApp le escribe al 521 + 10: ninguna exacta, el sufijo trae las dos y ganaba la de
// id más bajo, así que su respuesta cortaba a la #1776 y la automatización de la #1797 seguía «No contestó». Y el lead de
// prueba de Martín (#3099), que contestaba en el #249. La regla es `fichaDelEntrante` (lib/ficha-del-entrante.ts) y el
// cableado, `matchLeadPorTelefono` (lib/evolution-mensajes.ts: del fuente sólo se lee eso).
// ⚠️ PROBADO ROMPIÉNDOLO: los números van al pie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fichaDelEntrante, ultimoPorFicha, type CandidataDelEntrante } from '../lib/ficha-del-entrante';

const T = (iso: string) => Date.parse(iso);
const c = (id: number, exacta: boolean, ultimo: string | null): CandidataDelEntrante => ({ id, exacta, ultimoEscritoMs: ultimo ? T(ultimo) : null });

test('una sola ficha: es ésa, haya o no algo escrito', () => {
  assert.equal(fichaDelEntrante([c(7, false, null)]), 7);
  assert.equal(fichaDelEntrante([]), null);
});

test('German: antes de que le salga la automatización, la charla de siempre; después, la ficha de la automatización', () => {
  // El setter le escribió como #1776 hasta el 16/10; la #1797 todavía no recibió nada (su bienvenida es un borrador).
  const antes = [c(1776, false, '2026-10-16T19:40:00Z'), c(1797, false, null)];
  assert.equal(fichaDelEntrante(antes), 1776, 'nada le salió a la #1797: su mensaje no contesta a la automatización');
  // Sale el mensaje de la automatización a la #1797: lo que conteste es para ella.
  const despues = [c(1776, false, '2026-10-16T19:40:00Z'), c(1797, false, '2026-10-24T21:13:30Z')];
  assert.equal(fichaDelEntrante(despues), 1797, 'la respuesta va a la ficha a la que le escribimos último');
});

test('German en modo borrador, con el eco ganando: el saliente quedó en la #1776, pero el borrador aprobado dice cuándo salió', () => {
  // La bienvenida de la #1797 se armó el 24/10 a las 18:00 y Leila la aprobó el 25/10 a las 10:00. El eco del webhook ganó
  // la carrera y el espejo la anotó en la #1776 a las 10:00; el envío del motor conserva las 18:00 del día anterior. Lo que
  // desempata es `wa_borradores.enviado_at` (10:00:02, al volver el envío).
  const m = ultimoPorFicha([
    { lead_id: 1776, at: '2026-10-25T13:00:00Z' },   // el eco, con la ficha equivocada
    { lead_id: 1797, at: '2026-10-24T21:00:00Z' },   // nutricion_envios: la hora del borrador
    { lead_id: 1797, at: '2026-10-25T13:00:02Z' },   // wa_borradores.enviado_at
  ]);
  assert.equal(fichaDelEntrante([c(1776, false, null), c(1797, false, null)].map((x) => ({ ...x, ultimoEscritoMs: m.get(x.id) ?? null }))), 1797);
});

test('el lead de prueba de Martín: la #289 le escribe al #3099, y su respuesta ya no cae en el #249', () => {
  assert.equal(fichaDelEntrante([c(249, false, '2026-07-02T15:00:00Z'), c(3099, false, '2026-10-24T13:45:00Z')]), 3099);
});

test('sin nada escrito a ninguna: la exacta, y si no hay, la de id más bajo (lo de antes)', () => {
  assert.equal(fichaDelEntrante([c(10, false, null), c(20, true, null)]), 20);
  assert.equal(fichaDelEntrante([c(30, false, null), c(10, false, null), c(20, false, null)]), 10);
  // Con algo escrito, lo escrito gana a la exacta.
  assert.equal(fichaDelEntrante([c(10, true, null), c(20, false, '2026-10-24T10:00:00Z')]), 20);
});

test('un empate se lo queda la de id más bajo, y el orden de entrada no importa', () => {
  const t = '2026-10-24T10:00:00Z';
  assert.equal(fichaDelEntrante([c(40, false, t), c(12, false, t)]), 12);
  assert.equal(fichaDelEntrante([c(12, false, '2026-10-24T09:00:00Z'), c(40, false, '2026-10-24T11:00:00Z')]), 40);
  assert.equal(fichaDelEntrante([c(40, false, '2026-10-24T11:00:00Z'), c(12, false, '2026-10-24T09:00:00Z')]), 40);
});

test('ultimoPorFicha: lo más nuevo de cada una, entre el chat y las automatizaciones; sin ficha o sin hora no cuenta', () => {
  const m = ultimoPorFicha([
    { lead_id: 1776, at: '2026-10-10T09:00:00Z' },
    { lead_id: 1776, at: '2026-10-16T19:40:00Z' },
    { lead_id: 1797, at: '2026-10-24T21:13:30Z' },
    { lead_id: null, at: '2026-10-25T00:00:00Z' },
    { lead_id: 1797, at: null },
    { lead_id: 1797, at: 'no es una fecha' },
  ]);
  assert.equal(m.get(1776), T('2026-10-16T19:40:00Z'));
  assert.equal(m.get(1797), T('2026-10-24T21:13:30Z'));
  assert.equal(m.size, 2);
});

// ── El cableado ───────────────────────────────────────────────────────────────────────────────────────────────────
const fuente = readFileSync(join(import.meta.dirname, '..', 'lib/evolution-mensajes.ts'), 'utf8').replace(/\r\n/g, '\n');
const ini = fuente.indexOf('async function matchLeadPorTelefono(');
const match = fuente.slice(ini, fuente.indexOf('\n}\n', ini));

test('matchLeadPorTelefono trae TODAS las fichas del sufijo, y con más de una mira lo que le escribimos a cada una', () => {
  // De la más NUEVA a la más vieja: el tope deja afuera las viejas, nunca la que se acaba de inscribir. Y con el tope
  // lleno, la exacta se suma aunque sea vieja.
  assert.match(match, /\.like\('telefono_normalizado', `%\$\{last\}`\)\s*\.order\('id', \{ ascending: false \}\)\.limit\(TOPE_CANDIDATAS\)/);
  assert.match(match, /if \(fichas\.length >= TOPE_CANDIDATAS\) \{[\s\S]{0,300}\.eq\('telefono_normalizado', telNorm\)/);
  assert.match(match, /if \(fichas\.length <= 1\) return fichas\[0\]\?\.id \?\? null;/, 'con una sola, nada más');
  // Sus salientes en ESTE chat y sus WhatsApp de una automatización (la fila del espejo puede tener la ficha del eco).
  assert.match(match, /from\('wa_mensajes'\)\.select\('lead_id, wa_timestamp'\)\.eq\('chat_jid', chatJid\)\.eq\('from_me', true\)\.in\('lead_id', ids\)/);
  assert.match(match, /from\('nutricion_envios'\)\.select\('lead_id, created_at'\)\.in\('lead_id', ids\)\.eq\('canal', 'whatsapp'\)\.in\('estado', \['enviado', 'simulado'\]\)/);
  assert.match(match, /from\('wa_borradores'\)\.select\('lead_id, enviado_at'\)\.in\('lead_id', ids\)\.eq\('estado', 'enviado'\)/, 'sin la salida del borrador aprobado (el modo de Leila)');
  assert.match(match, /\.\.\.\(\(borradores\.data \?\? \[\]\)[\s\S]{0,120}at: r\.enviado_at/);
  assert.match(match, /return fichaDelEntrante\(fichas\.map\(\(f\) => \(\{ id: f\.id, exacta: f\.telefono_normalizado === telNorm, ultimoEscritoMs: ultimo\.get\(f\.id\) \?\? null \}\)\)\);/);
});

test('el entrante guarda con el chat: así la regla ve lo que le escribimos AHÍ', () => {
  assert.match(fuente, /const leadId = prev\?\.lead_id \?\? \(telefono \? await matchLeadPorTelefono\(telefono, chatJid\) : null\);/);
  assert.equal((fuente.match(/matchLeadPorTelefono\(telefono\)/g) ?? []).length, 0, 'ninguna llamada sin el chat');
});

// ── Las roturas (9 tests; sin romper nada: 9 pases, 0 fallos) ─────────────────────────────────────────────────────
// 1. `fichaDelEntrante` sin mirar lo escrito (la exacta o la de id más bajo, lo de antes): 5 fallos / 4 pases.
// 2. Gana lo escrito MÁS VIEJO en vez de lo más nuevo: 4 fallos / 5 pases.
// 3. Sin nada escrito, sin preferir la exacta: 1 fallo / 8 pases.
// 4. El empate se lo queda la de id más ALTO: 1 fallo / 8 pases.
// 5. `ultimoPorFicha` se queda con la PRIMERA fila de cada ficha y no con la más nueva: 2 fallos / 7 pases.
// 6. El webhook vuelve a llamar sin el chat: 1 fallo / 8 pases.
// 7. Sin la lectura de `nutricion_envios`: 1 fallo / 8 pases.
// 8. Sin la salida de los borradores aprobados (`wa_borradores`): 1 fallo / 8 pases.
// 9. Las candidatas de la más VIEJA a la más nueva (el tope deja afuera la recién inscripta): 1 fallo / 8 pases.
// 10. Con el tope lleno, sin sumar la exacta: 1 fallo / 8 pases.
