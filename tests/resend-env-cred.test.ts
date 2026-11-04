// =============================================================================
// Las credenciales de Resend de la PLATAFORMA se leen con envCred, nunca de process.env
// =============================================================================
// Medido el 09/10/2026 (lo encontró la sesión de Customer Success con el audio de Leandro
// probando el curso): el invitar decía «RESEND_API_KEY no configurada» y mandaba al cliente a
// conectar SU correo. La key de la plataforma vive en las credenciales del dueño y llega a
// process.env recién cuando termina la hidratación del arranque; `resendKey()` la leía antes.
// El webhook de Resend tenía el mismo agujero con su secreto de firma.
//
// Probado ROMPIÉNDOLO: devolviendo `process.env.RESEND_API_KEY` a lib/resend.ts, 1 fallo y
// 1 pase; devolviendo `process.env.RESEND_WEBHOOK_SECRET` al webhook, 1 fallo y 1 pase.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const leer = (rel: string) => readFileSync(resolve(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
// Las líneas de comentario primero y los bloques después: los comentarios nombran el
// `process.env` que se sacó.
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

test('lib/resend.ts no lee las credenciales de Resend de process.env', () => {
  const src = sinComentarios(leer('lib/resend.ts'));
  assert.doesNotMatch(src, /process\.env\.RESEND_/);
  // La key de MaKo se lee en lib/email-cuenta.ts desde el 4/11/2026 (cada negocio con su cuenta): ahí, con envCred.
  const cuenta = sinComentarios(leer('lib/email-cuenta.ts'));
  assert.doesNotMatch(cuenta, /process\.env\.RESEND_/);
  assert.match(cuenta, /envCred\('RESEND_API_KEY'\)/);
  assert.match(src, /keyDeCorreoDeLaPlataforma\(\)/, 'lib/resend.ts toma la de MaKo de lib/email-cuenta.ts');
});

test('el webhook de Resend lee su secreto con envCred', () => {
  const src = sinComentarios(leer('app/api/webhooks/resend/route.ts'));
  assert.doesNotMatch(src, /process\.env\.RESEND_/);
  assert.match(src, /envCred\('RESEND_WEBHOOK_SECRET'\)/);
});
