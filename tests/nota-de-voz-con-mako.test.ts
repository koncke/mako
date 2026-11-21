// =============================================================================
// LA NOTA DE VOZ SIN IA PROPIA LA ESCUCHA EL WHISPER DE MAKO, Y SE COBRA EN MAKO TOKENS (20/11/2026)
// =============================================================================
// Martín, probando el onboarding en producción (ws 3): en «Tu nombre», grabar y mandar un audio daba «Para escuchar tu nota de voz
// necesito una IA conectada. Conecta la tuya o escríbemelo.» (SIN_OIDO). Y: «el usuario debería poder enviar audios
// independientemente de si tiene la IA conectada o no, porque para eso ya usamos los MaKo Tokens».
// La causa: una nota de voz es un dato de un cliente (`pii`), así que `transcribirAudio` salta la red gratis (el Gemini gratis entrena
// con lo que recibe); sin una clave del negocio no quedaba nadie y tiraba «ninguna IA pudo». Lo decidido por el Cerebro: sin IA
// propia, la escucha el Whisper de MaKo (el Groq de la plataforma, el mismo de las notas de WhatsApp: no entrena) y la paga el cupo de
// MaKo Tokens, como el texto. Para TODAS las cajas con micrófono: el arreglo va en la cascada, por donde pasan todas
// (/api/plan-dictado y la nota del chat de MaKo, lib/mako-turno-app.ts). SIN_OIDO queda para cuando no hay ninguna, ni la de MaKo.
//
// ⚠️ PROBADO ROMPIÉNDOLO: ver al pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { escuchaElDeMaKoAlFinal, MARCA_EL_DE_MAKO } from '../lib/nota-de-voz-de-mako';
import { NO_PUDE_ESCUCHAR, SIN_OIDO, errorDeDictado } from '../lib/dictado-error';

const fuente = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const bloque = (s: string, desde: string) => { const i = s.indexOf(desde); assert.ok(i >= 0, `no está: ${desde}`); const j = s.indexOf('\n}\n', i); return s.slice(i, j); };

test('1. la nota de voz de un cliente SIN NINGUNA clave la escucha el de MaKo; con una clave suya (aunque falle), con D6b, un audio que no es nota o el del grupo, no', () => {
  const sin = { sinClavesDelNegocio: true, soloSuIA: false };
  assert.equal(escuchaElDeMaKoAlFinal({ pii: true, ...sin }), true, 'la nota de un cliente sin IA propia: la de MaKo');
  // El Cerebro, 20/11 (rojo de ia16 en 367a6868d): con clave propia, SÓLO la suya; el de MaKo nunca además, ni si la suya falla.
  assert.equal(escuchaElDeMaKoAlFinal({ pii: true, sinClavesDelNegocio: false, soloSuIA: false }), false, 'con una clave suya, nunca el de MaKo');
  assert.equal(escuchaElDeMaKoAlFinal({ pii: true, sinClavesDelNegocio: true, soloSuIA: true }), false, 'con su Claude o su GPT (D6b), sólo su IA');
  assert.equal(escuchaElDeMaKoAlFinal({ pii: true, sinGroq: true, ...sin }), false, 'lo que no es una nota de voz no va a Groq');
  assert.equal(escuchaElDeMaKoAlFinal({ pii: true, notaDeVozDelGrupo: true, ...sin }), false, 'la del grupo ya la escuchó PRIMERO');
  assert.equal(escuchaElDeMaKoAlFinal({ ...sin }), false, 'sin `pii` corre la red de siempre');
});

test('2. lo que lee la persona: SIN_OIDO sólo si no hubo ni la de MaKo; si la de MaKo probó y falló, que la grabe de nuevo; sin saldo, eso', () => {
  const sinNadie = 'transcribirAudio — ninguna IA pudo: red gratis salteada: el audio es de un cliente del negocio y el plan gratis entrena con lo que recibe';
  assert.equal(errorDeDictado(sinNadie), SIN_OIDO, 'ni la de MaKo: no hay con quién escuchar');
  assert.equal(errorDeDictado(`transcribirAudio — ninguna IA pudo: ${MARCA_EL_DE_MAKO}groq#1: 500 internal | red gratis salteada: …`), NO_PUDE_ESCUCHAR,
    'la de MaKo probó y falló: no es «conecta la tuya»');
  const sinSaldo = 'Te quedaste sin MaKo Tokens: esto cuesta 1 MT y tienes 0 MT. Recarga o conecta tu IA.';
  assert.equal(errorDeDictado(sinSaldo), sinSaldo, 'sin MaKo Tokens: lo que dice el medidor, no «grábala de nuevo»');
  assert.equal(errorDeDictado('fetch failed'), NO_PUDE_ESCUCHAR);
  // Con una clave suya que falló: no es «conecta la tuya» (ya tiene), es que no se pudo escuchar.
  assert.equal(errorDeDictado(`${sinNadie.replace('red gratis', 'groq#1: 500 internal | red gratis')}`, { delNegocio: 1 }), NO_PUDE_ESCUCHAR,
    'con una clave suya caída: grábala de nuevo');
  assert.match(fuente('app/api/plan-dictado/route.ts'), /error: errorDeDictado\(msg, \{ delNegocio: e instanceof SttSinEscucha \? e\.errores\.length : 0 \}\)/);
  assert.match(SIN_OIDO, /Conecta la tuya o escríbemelo\.$/);
});

test('3. la cascada: después de las claves del negocio y antes de rendirse, el Whisper de MaKo; con la marca en cada error', () => {
  const ai = fuente('lib/ai-cheap.ts');
  const stt = bloque(ai, 'export async function transcribirAudio(');
  const iGrupo = stt.indexOf('if (o.notaDeVozDelGrupo) throw new SttSinEscucha(errores, erroresPlataforma);');
  const iMako = stt.indexOf('if (escuchaElDeMaKoAlFinal({ ...o, soloSuIA: soloSuIA(), sinClavesDelNegocio: cuentasDelNegocio === 0 })) {');
  // Cuenta las cuentas del negocio que probó: con alguna, el de MaKo no entra.
  assert.match(stt, /for \(const p of await provsDe\(nombre\)\) \{\n\s*cuentasDelNegocio\+\+;/);
  const iPii = stt.indexOf('if (o.pii) {');
  assert.ok(iGrupo > 0 && iMako > iGrupo && iPii > iMako, 'el orden: las claves del negocio, el del grupo, el de MaKo, el corte de la red gratis');
  assert.match(stt.slice(iMako, iPii), /const deMako = await escucharConElDeMaKo\(base64, buf, mime, o, erroresPlataforma\);\n\s*if \(deMako != null\) return deMako;/);
  // El de MaKo es el Groq de la plataforma (Whisper: no entrena con lo que recibe), y cada error suyo va marcado.
  const h = bloque(ai, 'async function escucharConElDeMaKo(');
  assert.match(h, /for \(const p of await groqDeLaPlataforma\(\)\)/);
  assert.match(h, /errores\.push\(\.\.\.propios\.map\(\(e\) => `\$\{MARCA_EL_DE_MAKO\}\$\{e\}`\)\);/);
  // Lo paga el cupo de MaKo Tokens: la cascada corre adentro del medidor, que cobra todo lo que no paga una clave del negocio.
  assert.ok(stt.indexOf('if (!medidorAbierto()) return conMedidorDeMt(opts?.feature, () => transcribirAudio(base64, mime, opts));') < iMako);
  // Las cajas con micrófono pasan por acá con `pii`: el dictado (onboarding, coaches, reto, pestañas) y la nota del chat de MaKo.
  assert.match(fuente('app/api/plan-dictado/route.ts'), /transcribirAudio\(base64, file\.type \|\| 'audio\/webm', \{ motivo, pii: true \}\)/);
  assert.match(fuente('lib/mako-turno-app.ts'), /motivo: 'MaKo: escuchar una nota de voz del chat', pii: true \}\)/);
});

test('4. la nota del chat de MaKo en el teléfono: sin saldo, lo que dice el medidor; si falló la de MaKo, que la grabe de nuevo', () => {
  // Arma su mensaje con `errorDeCascada` sobre los errores DEL NEGOCIO; sin claves del negocio esa lista viene vacía y decía «no hay IA».
  const t = bloque(fuente('lib/mako-turno-app.ts'), 'export async function escucharNotaDelChat(');
  const iSaldo = t.indexOf('if (esSinSaldoDeMt(e)) return { ok: false, error: e instanceof Error ? e.message : String(e), status: 424 };');
  const iMako = t.indexOf('if (e instanceof SttSinEscucha && !e.errores.length && e.erroresPlataforma.some((x) => x.startsWith(MARCA_EL_DE_MAKO))) return { ok: false, error: NO_PUDE_ESCUCHAR, status: 424 };');
  const iCascada = t.indexOf("error: await errorDeCascada(delNegocio, 'escuchar tu audio')");
  assert.ok(iSaldo > 0 && iMako > iSaldo && iCascada > iMako, 'el saldo y la de MaKo, antes del mensaje de las claves del negocio');
});

// ⚠️ PROBADO ROMPIÉNDOLO (20/11/2026, base 4/0; al restaurar, 4/0). Cada rotura, de a una, cae:
//   - escuchaElDeMaKoAlFinal sin mirar D6b (con su IA, igual la de MaKo) → 1
//   - la cascada sin el paso del de MaKo (lo de antes: «ninguna IA pudo») → 3
//   - el de MaKo DESPUÉS del corte de la red → 3
//   - el de MaKo sin marcar sus errores (vuelve «Conecta la tuya» con la de MaKo caída) → 3
//   - errorDeDictado sin mirar la marca → 2; sin el caso del saldo → 2
//   - la nota del teléfono sin el caso del saldo, o sin el de la de MaKo (cada una por separado) → 4
