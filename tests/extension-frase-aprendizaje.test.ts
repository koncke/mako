// =============================================================================
// La frase de aprendizaje está escrita dos veces y tiene que decir lo mismo
// =============================================================================
// Para que MaKo aprenda a pedirle un video al Flow nuevo hace falta ver UNA
// generación real hecha con una frase conocida: el prompt viaja escapado adentro de
// JSON anidado dentro de un `f.req` url-encodeado, y adivinar ese anidado es lo que
// este repo tiene prohibido. Con la frase, el espejo prueba cada codificación hasta
// encontrar cuál aparece en el cuerpo, y ya no hay nada que suponer.
//
// ⚠️ POR QUÉ ESTÁ DUPLICADA Y NO SE PUEDE EVITAR.
//
// Una copia vive en `injected.js`, que corre en el MAIN world de la página de Flow;
// la otra en `popup.js`, que es quien se la muestra a la persona. Una extensión MV3
// sin bundler no tiene dónde ponerla una sola vez: los content scripts no importan
// módulos y el popup no comparte contexto con ellos.
//
// ⚠️ Y EL DESFASE NO ROMPE NADA RUIDOSO, que es lo que lo hace caro. La persona
// generaría con la frase que le muestra el popup y el espejo buscaría otra: el
// resultado es «no aprendí» sobre una generación que salió perfecta — y el clip ya
// se pagó, en créditos de Google del cliente.
//
// Por eso el guard es un test y no un comentario: es exactamente la clase de cosa
// que un comentario no puede impedir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '..');
const leer = (f: string) => readFileSync(resolve(RAIZ, 'extension', f), 'utf8');

/** La frase, sacada de una declaración `const X = '…';` por el nombre de la const. */
function frase(src: string, nombre: string): string | null {
  const m = new RegExp(`const\\s+${nombre}\\s*=\\s*'([^']*)'`).exec(src);
  return m ? m[1] : null;
}

test('la frase de aprendizaje dice lo mismo en injected.js y en popup.js', () => {
  const enEspejo = frase(leer('injected.js'), 'SENTINELA');
  const enPopup = frase(leer('popup.js'), 'FRASE_APRENDIZAJE');

  assert.ok(enEspejo, 'no encontré SENTINELA en injected.js — ¿se renombró?');
  assert.ok(enPopup, 'no encontré FRASE_APRENDIZAJE en popup.js — ¿se renombró?');
  assert.equal(
    enPopup, enEspejo,
    'El popup le pide a la persona una frase y el espejo busca otra.\n'
    + `  popup.js:    "${enPopup}"\n`
    + `  injected.js: "${enEspejo}"\n`
    + 'La generación de prueba saldría bien y MaKo diría que no aprendió, con el clip\n'
    + 'ya pagado. Si cambiás una, cambiá la otra.',
  );
});

test('la frase es lo bastante rara como para no aparecer sola en un pedido', () => {
  // ⚠️ Si la frase fuera algo común («un gato»), podría aparecer en el cuerpo por
  // otra razón —otro campo, otra generación anterior de la misma sesión— y el
  // espejo aprendería una posición equivocada. El token al final es lo que la hace
  // única, así que se exige que siga estando.
  const f = frase(leer('injected.js'), 'SENTINELA') ?? '';
  assert.match(
    f, /[a-z0-9]{6,}/,
    'La frase necesita un token raro (letras y números juntos) para no confundirse '
    + 'con texto que ya esté en el cuerpo por otro motivo.',
  );
});
