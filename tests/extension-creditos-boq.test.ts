// =============================================================================
// Los créditos se leen de la respuesta MEDIDA, no de una forma imaginada
// =============================================================================
// El Flow nuevo contesta el saldo por `rpcids=nzlxg`, y el espejo ya guarda esa
// respuesta — así que leer los créditos no cuesta una llamada a Google.
//
// ⚠️ ESTE TEST EXISTE PORQUE EL DATO SE DIO POR PERDIDO TRES VECES.
//
// Al medir busqué la palabra `credit` en las respuestas capturadas, no aparecía, y
// reporté que Google había sacado los créditos. El número estaba en esa misma
// captura, dos veces. Un predicado mal elegido no devuelve «no sé»: devuelve «no»,
// que es indistinguible de un hecho.
//
// La respuesta de abajo es TEXTUAL, copiada del tráfico de una cuenta real el
// 05/09/2026 con el menú de la cuenta abierto y el número 569 confirmado en
// pantalla. Si el formato cambia, este test falla — que es exactamente lo que se
// quiere: el parser no puede quedar «funcionando» sobre una forma que ya no llega.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** El parser real, sacado del archivo: si se renombra o se borra, este test lo dice. */
function cargarParser(): (t: string) => number | null {
  const src = readFileSync(
    resolve(import.meta.dirname, '..', 'extension', 'background.js'), 'utf8',
  );
  const m = /function creditosDeBoq\(texto\) \{[\s\S]*?\n\}/.exec(src);
  assert.ok(m, 'no encontré `creditosDeBoq` en background.js — ¿se renombró?');
  // eslint-disable-next-line no-new-func
  return new Function(`${m[0]}; return creditosDeBoq;`)() as (t: string) => number | null;
}

/** Lo que contestó Flow, textual. 569 es lo que mostraba el menú en ese momento. */
const MEDIDA = ')]}\'\n123\n[["wrb.fr","nzlxg","[569,1,2,2,null,569]",null,null,null,"generic"],'
  + '["di",317],["af.httprm",317,"5763335416657454348",7]]\n25\n[["e",4,null,null,159]]\n';

test('lee el saldo de la respuesta real de nzlxg', () => {
  assert.equal(cargarParser()(MEDIDA), 569);
});

test('una respuesta de OTRO rpcid no da un número', () => {
  // ⚠️ Importa más de lo que parece: todas las respuestas de BOQ tienen la misma
  // forma, y varias traen números. Si el parser no exigiera `nzlxg`, leería el
  // primer número de cualquiera —un contador interno, un id— y lo mostraría como
  // saldo. Un saldo inventado es peor que ninguno: se toman decisiones con él.
  const otra = ')]}\'\n106\n[["wrb.fr","WuwhI","[]",null,null,null,"generic"],["di",301]]\n';
  assert.equal(cargarParser()(otra), null);
});

test('sin respuesta guardada devuelve null, no cero', () => {
  // «Todavía no vi pasar los créditos» y «tenés cero créditos» son cosas distintas,
  // y confundirlas le diría a alguien con saldo que se quedó sin nada.
  const p = cargarParser();
  assert.equal(p(''), null);
  assert.equal(p('cualquier cosa'), null);
});
