// =============================================================================
// Ante una falla, MaKo en el grupo ofrece el ticket y dice la causa si la sabe (27/10/2026, P3; lib/doer-falla.ts)
// =============================================================================
// Leila (26/10): cuatro intentos de «analizar la llamada de fathom» → MaKo: «puede deberse a un problema con la grabación».
// La causa era su Claude sin crédito (MaKo lo había avisado a las 15:31). Ella: «y tú eres el servicio técnico».
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bloqueDeLaFalla, clavesQueFallan, reportaFalla } from '../lib/doer-falla';
import type { EstadoSuClave } from '../lib/su-clave-reglas';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const AHORA = Date.parse('2026-10-26T19:00:00Z');

test('1. las frases de Leila son un reporte de falla; un pedido o una pregunta, no', () => {
  for (const f of [
    'no puede analizar la llamada de fathom', 'ya van 4 veces, tras 4 intentos sigue igual', 'y tú eres el servicio técnico',
    'no me deja agendar', 'sigue sin funcionar', 'dejó de andar el CRM', 'me da error al publicar', 'se colgó la app',
  ]) assert.ok(reportaFalla(f), `«${f}» no se ve como falla`);
  for (const f of ['¿cuántos leads entraron esta semana?', 'pasale la segunda para mañana', 'gracias MaKo', 'publicá la del webinar'])
    assert.ok(!reportaFalla(f), `«${f}» se ve como falla`);
});

test('2. la causa: su IA que viene fallando se dice primero; la que falló y después anduvo, no', () => {
  const claude: EstadoSuClave = { proveedor: 'anthropic', anduvo: '2026-10-26T14:00:00Z', fallo: { at: '2026-10-26T15:31:00Z', motivo: 'credit balance is too low' }, gastado: 3.2 };
  const gpt: EstadoSuClave = { proveedor: 'openai', anduvo: '2026-10-26T18:00:00Z', fallo: { at: '2026-10-25T10:00:00Z', motivo: '429' }, gastado: 0 };
  assert.deepEqual(clavesQueFallan([claude, gpt]).map((e) => e.proveedor), ['anthropic']);
  const b = bloqueDeLaFalla([claude, gpt], AHORA);
  assert.match(b, /^LA PERSONA TE CUENTA QUE ALGO NO ANDA\./);
  assert.match(b, /propón levantar un ticket con levantar_ticket/);
  assert.match(b, /LO QUE YA SABES: tu Claude viene fallando \(hace 3 h: «credit balance is too low»\)\. Si lo que no anda depende de su IA, ÉSA es la causa/);
  assert.doesNotMatch(b, /tu GPT/);
  // Sin nada que falle, o sin poder leerlo, no se afirma ninguna causa.
  for (const e of [[gpt], null]) assert.doesNotMatch(bloqueDeLaFalla(e, AHORA), /LO QUE YA SABES/);
});

test('3. el doer: con un reporte, el ticket viaja aunque el turno no sea «actuar», y la nota va al system', () => {
  const doer = leer('lib/mako-doer-in.ts');
  assert.match(doer, /const reporta = reportaFalla\(sinPrefijoDeLote\(texto\)\);\n\s*const tools = reporta && !turno\.tools\.some\(\(t\) => t\.name === LEVANTAR_TICKET\) \? \[\.\.\.turno\.tools, \.\.\.TICKET_TOOLS\] : turno\.tools;/);
  assert.match(doer, /const ctxFalla = reporta \? `\\n\\n\$\{bloqueDeLaFalla\(await estadoDeSusClaves\(wsData\)\.catch\(\(\) => null\), Date\.now\(\)\)\}` : '';/);
  assert.match(doer, /\$\{ctxFalla\}\$\{conMemoria\}`;/);
});
