// =============================================================================
// Ticket #93 (13/11/2026): «Email por día» hasta 2.000 con SU cuenta de Resend y SU dominio; 500 con la de la plataforma
// =============================================================================
// Decisión del Cerebro: un negocio que manda con su propia clave de Resend y su dominio verificado (Mauricio, elevate.com.mx
// desde el 9/11) sube su tope bajo su riesgo (Resend Pro da 50.000 por mes); el que manda con la clave de la plataforma
// sigue en 500, porque ahí se cuida el dominio de MaKo. El arranque y la suba de la rampa, de 1 a 500 para todos.
// La regla (pura) en lib/limites-envio.ts; con qué cuenta manda, en lib/limites-envio-cuenta.ts. El camino de la API, con
// las dos cuentas, en tests/email-campana-topes.test.ts.
// Correr: node --import tsx --test tests/limites-email-cuenta-propia-93.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EMAIL_DIA_MAX_CUENTA_PROPIA, LIMITES_CONSTANTES, limitesParaGuardar, limitesVigentes, rangoDeLimite } from '../lib/limites-envio';

const fuente = (rel: string): string => readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const F = LIMITES_CONSTANTES;
const con = (email: Partial<typeof F.email>) => ({ ...F, email: { ...F.email, ...email } });

test('1. guardar: 1.600 por día entra con cuenta propia y no con la de la plataforma; más de 2.000, nunca', () => {
  const propia = limitesParaGuardar(con({ dia: 1600, arranqueDia: 500, arranqueSube: 300 }), F, { cuentaPropia: true });
  assert.equal(propia.ok, true);
  assert.deepEqual(propia.ok && JSON.parse(propia.valor).email, { dia: 1600, arranqueDia: 500, arranqueSube: 300 });
  assert.deepEqual(limitesParaGuardar(con({ dia: 1600 }), F), { ok: false, error: 'Email por día: entre 1 y 500.' }, 'sin decir la cuenta: la de la plataforma');
  assert.deepEqual(limitesParaGuardar(con({ dia: 1600 }), F, { cuentaPropia: false }), { ok: false, error: 'Email por día: entre 1 y 500.' });
  assert.deepEqual(limitesParaGuardar(con({ dia: 2001 }), F, { cuentaPropia: true }), { ok: false, error: 'Email por día: entre 1 y 2000.' });
  // El arranque y la suba siguen de 1 a 500, también con cuenta propia.
  assert.deepEqual(limitesParaGuardar(con({ arranqueDia: 600 }), F, { cuentaPropia: true }), { ok: false, error: 'Email el primer día: entre 1 y 500.' });
  assert.deepEqual(limitesParaGuardar(con({ arranqueSube: 600 }), F, { cuentaPropia: true }), { ok: false, error: 'Email, cuánto sube por día: entre 1 y 500.' });
});

test('2. leer: lo de la cuenta propia se respeta; leído sin ella, baja a 500 (nunca a lo de fábrica, nunca sube)', () => {
  const guardado = JSON.stringify({ email: { dia: 1600, arranqueDia: 500, arranqueSube: 300 } });
  assert.equal(limitesVigentes(guardado, F, { cuentaPropia: true }).email.dia, 1600);
  // «No pude leer la cuenta» o se cambió a la de la plataforma: manda 500, no 100.
  assert.equal(limitesVigentes(guardado, F).email.dia, 500);
  assert.equal(limitesVigentes(guardado, F, { cuentaPropia: false }).email.dia, 500);
  // Lo de siempre no se toca: 300 sigue siendo 300 con cualquier cuenta.
  assert.equal(limitesVigentes(JSON.stringify({ email: { dia: 300 } }), F).email.dia, 300);
  assert.equal(limitesVigentes(JSON.stringify({ email: { dia: 300 } }), F, { cuentaPropia: true }).email.dia, 300);
  // Fuera de todo rango (una fila rota): lo de fábrica, como siempre.
  assert.equal(limitesVigentes(JSON.stringify({ email: { dia: 2500 } }), F, { cuentaPropia: true }).email.dia, F.email.dia);
  // Los otros campos no cambian con la cuenta.
  assert.equal(limitesVigentes(JSON.stringify({ email: { arranqueDia: 600 } }), F, { cuentaPropia: true }).email.arranqueDia, F.email.arranqueDia);
});

test('3. el rango, y quién lo pregunta: el motor, la API, la pantalla y el «por qué no sale»', () => {
  assert.equal(EMAIL_DIA_MAX_CUENTA_PROPIA, 2000);
  assert.deepEqual(rangoDeLimite('email', 'dia', { cuentaPropia: true }), [1, 2000]);
  assert.deepEqual(rangoDeLimite('email', 'dia'), [1, 500]);
  assert.deepEqual(rangoDeLimite('email', 'arranqueDia', { cuentaPropia: true }), [1, 500]);
  assert.deepEqual(rangoDeLimite('wa', 'dia', { cuentaPropia: true }), [1, 150]);
  // Cuenta propia = SU clave de Resend («propia», no la de la plataforma) Y un remitente que pasa.
  const cuenta = fuente('lib/limites-envio-cuenta.ts');
  assert.match(cuenta, /return \{ cuentaPropia: cuenta\.tipo === 'propia' && remitente\.puede \};/);
  assert.match(cuenta, /return \{ cuentaPropia: false \};/, 'ante la duda, la de la plataforma');
  assert.match(fuente('lib/nutricion.ts'), /limitesVigentes\(await getSettingEstricto\(KEY_LIMITES_ENVIO\), limitesDeFabrica\(process\.env\), await opcionesDeRango\(\)\)/);
  const run = fuente('lib/api-mako/areas/chatbot.run.ts');
  assert.match(run, /const prueba = limitesParaGuardar\(nuevo, fabrica, rangoCuenta\);/);
  assert.match(run, /const r = limitesParaGuardar\(payload\.limites, limitesDeFabrica\(process\.env\), await opcionesDeRango\(\)\);/);
  assert.match(fuente('lib/por-que-no-sale-db.ts'), /limitesVigentes\(limitesCrudos, limitesDeFabrica\(process\.env\), await opcionesDeRango\(\)\)/);
  assert.match(fuente('app/automations/config-automatizacion-actions.ts'), /limitesVigentes\(rawLimites, limitesDeFabrica\(process\.env\), await opcionesDeRango\(\)\)/);
  // La API deja pasar hasta 2.000: el rango de verdad lo decide el runner.
  assert.match(fuente('lib/api-mako/areas/chatbot.def.ts'), /\{ nombre: 'emailDia', tipo: 'number', entero: true, minimo: 1, maximo: 2000,/);
});
