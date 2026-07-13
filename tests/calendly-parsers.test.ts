// Tests de lib/calendly.ts (import-clean, solo node:crypto): verificación de firma
// del webhook + anti-replay, y los parsers de Q&A/junta que alimentan el CRM.
// Blindan input NO confiable de un webhook público. Correr: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  verifyCalendlySignature, CalendlySignatureError,
  clasificarJunta, isoToFechaTijuana, extractAnswer, extractRespuestaPorFrase,
} from '../lib/calendly';

const KEY = 'clave-de-firma-secreta';
const firmar = (t: number, body: string) =>
  crypto.createHmac('sha256', KEY).update(`${t}.${body}`).digest('hex');
const header = (t: number, body: string) => `t=${t},v1=${firmar(t, body)}`;

test('verifyCalendlySignature — firma válida y fresca pasa', () => {
  const body = JSON.stringify({ event: 'invitee.created' });
  const t = Math.floor(Date.now() / 1000);
  assert.doesNotThrow(() => verifyCalendlySignature(body, header(t, body), KEY));
});

test('verifyCalendlySignature — firma alterada es rechazada', () => {
  const body = '{"a":1}';
  const t = Math.floor(Date.now() / 1000);
  const bad = `t=${t},v1=${'0'.repeat(64)}`;
  assert.throws(() => verifyCalendlySignature(body, bad, KEY), CalendlySignatureError);
});

test('verifyCalendlySignature — header ausente o mal formado es rechazado', () => {
  const body = '{}';
  const t = Math.floor(Date.now() / 1000);
  assert.throws(() => verifyCalendlySignature(body, null, KEY), CalendlySignatureError);
  assert.throws(() => verifyCalendlySignature(body, `t=${t}`, KEY), CalendlySignatureError); // sin v1
  assert.throws(() => verifyCalendlySignature(body, header(t, body), ''), CalendlySignatureError); // sin key
});

test('verifyCalendlySignature — anti-replay: timestamp viejo se rechaza aunque la firma sea válida', () => {
  const body = '{"x":1}';
  const viejo = Math.floor(Date.now() / 1000) - 100_000; // muy fuera de tolerancia
  // firma correcta PARA ese t viejo → debe fallar por edad, no por firma
  assert.throws(() => verifyCalendlySignature(body, header(viejo, body), KEY), CalendlySignatureError);
});

test('clasificarJunta — j2 gana a j1, matchea por slug, sin candidatos → desconocido', () => {
  const cfg = { j1: 'reunion-uno', j2: 'reunion-dos' };
  assert.equal(clasificarJunta({ name: 'reunion-dos' }, cfg), 'j2');
  assert.equal(clasificarJunta({ name: 'reunion-uno' }, cfg), 'j1');
  // slug: URL de agenda vs URI de API resuelven al mismo último segmento
  assert.equal(clasificarJunta({ uri: 'https://api.calendly.com/event_types/reunion-uno' }, cfg), 'j1');
  // j2 tiene precedencia si ambos apuntan a lo mismo
  assert.equal(clasificarJunta({ name: 'x' }, { j1: 'x', j2: 'x' }), 'j2');
  assert.equal(clasificarJunta(undefined, cfg), 'desconocido');
  assert.equal(clasificarJunta({ name: 'otra-cosa' }, cfg), 'desconocido');
});

test('isoToFechaTijuana — convierte a día TJ; ISO inválido lanza', () => {
  assert.equal(isoToFechaTijuana('2026-01-15T12:00:00Z'), '2026-01-15');
  assert.equal(isoToFechaTijuana('2026-01-15T03:00:00Z'), '2026-01-14'); // cruce a día previo
  assert.throws(() => isoToFechaTijuana('no-es-fecha'));
});

test('extractRespuestaPorFrase — elige la coincidencia MÁS LARGA (regresión del cruce de respuestas)', () => {
  const qa = [
    { question: 'Qué buscás para multiplicar los resultados de tu equipo', answer: 'crecer' },
    { question: '¿Cuántos colaboradores tienes?', answer: '5' },
  ];
  // 'equipo' matchea la Q1; 'cuántos colaboradores' (más larga) matchea la Q2 → gana Q2
  assert.equal(extractRespuestaPorFrase(qa, ['equipo', 'cuántos colaboradores']), '5');
  assert.equal(extractRespuestaPorFrase(qa, ['no-existe']), null);
  assert.equal(extractRespuestaPorFrase(undefined, ['x']), null);
});

test('extractAnswer — primera pregunta que contiene la keyword', () => {
  const qa = [{ question: 'Nombre de la Empresa', answer: 'ACME' }, { question: 'Teléfono', answer: '555' }];
  assert.equal(extractAnswer(qa, ['empresa']), 'ACME');
  assert.equal(extractAnswer(qa, ['telefono', 'teléfono']), '555');
  assert.equal(extractAnswer(qa, ['inexistente']), null);
});
