// =============================================================================
// Un tutorial no anuncia como opcional un campo que el formulario exige — en NINGÚN servicio.
// =============================================================================
// EL CASO. El 04/10/2026 el tutorial de Calendly decía «Opcional — "Tipo de evento de R1"»
// sobre el campo sin el cual el webhook no sabe de quién es la reunión; se arregló con un
// guard que mira SÓLO Calendly (tests/calendly-sin-tipos.test.ts). El 12/10, al acortar los
// tutoriales, apareció el mismo error en Cal.com: «Opcional — "Tipo de evento de R1"», y el
// campo es obligatorio porque rutea el webhook. Quedó corregido en el texto y sin guard
// (docs/hallazgos-integraciones.md, «Los tutoriales de conexión…»). Una regla aplicada en
// un servicio de dos no está implementada: está documentada.
//
// Lo que fija, para cada servicio de lib/metodo-catalogo.ts: un paso que dice «opcional»
// NOMBRA el campo (su rótulo entre comillas), y ese campo tiene `opcional: true`.
//
// Probado rompiéndolo (13/10/2026), con la base en 0 fallos: devolverle a Cal.com el
// «Opcional: en "Tipo de evento de R1"» y dejar un «opcional» sin nombrar el campo (la
// "API key" de Cal.com dicha como «la clave») dan 1 fallo cada uno, nombrando el paso.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CATALOGO = readFileSync(join(__dirname, '..', 'lib', 'metodo-catalogo.ts'), 'utf8').replace(/\r\n/g, '\n');

/** Cada servicio, de su `key:` al `key:` del siguiente. El último termina donde cierra la
 *  lista (`\n];`): sin ese tope se comía las ayudas por campo que vienen después. */
function servicios(): Array<{ key: string; bloque: string }> {
  const marcas = [...CATALOGO.matchAll(/\n {4}key: '([a-z0-9-]+)',/g)];
  const fin = marcas.length ? CATALOGO.indexOf('\n];', marcas[marcas.length - 1].index!) : -1;
  return marcas.map((m, i) => ({ key: m[1], bloque: CATALOGO.slice(m.index!, marcas[i + 1]?.index ?? (fin > 0 ? fin : CATALOGO.length)) }));
}

/** Los campos a los que se refiere un nombre entre comillas: el rótulo exacto, o los que
 *  empiezan con él («"OAuth"» → los tres campos OAuth). `null` si es la casilla de una
 *  cuenta extra («"API key 2"»), que el código agrega sola y no está en `campos`. */
function aQueCampos(nombre: string, campos: ReadonlyMap<string, boolean>): string[] | null {
  if (/\s\d+$/.test(nombre)) return null;
  return [...campos.keys()].filter((l) => l === nombre || l.startsWith(`${nombre} `));
}

test('cada paso que dice «opcional» nombra su campo, y ese campo es opcional de verdad', () => {
  const todos = servicios();
  // Un piso contra un extractor roto: hoy son 19 servicios (13/10/2026).
  assert.ok(todos.length > 15, `leí ${todos.length} servicios: el extractor quedó viejo`);
  let pasosLeidos = 0;
  const mentirosos: string[] = [];
  const vagos: string[] = [];
  for (const { key, bloque } of todos) {
    const campos = new Map([...bloque.matchAll(/^ {6}\{ env: '[A-Z0-9_]+', label: '([^']+)'(.*)$/gm)]
      .map((m) => [m[1], /\bopcional:\s*true/.test(m[2])] as const));
    const pasos = [...bloque.matchAll(/^ {8}'((?:[^'\\]|\\.)+)',$/gm)].map((m) => m[1]);
    pasosLeidos += pasos.length;
    for (const paso of pasos) {
      if (!/opcional/i.test(paso)) continue;
      let nombra = false;
      for (const [, nombre] of paso.matchAll(/"([^"]{2,40})"/g)) {
        const a = aQueCampos(nombre, campos);
        if (a === null) { nombra = true; continue; }
        if (!a.length) continue;
        nombra = true;
        for (const l of a) if (!campos.get(l)) mentirosos.push(`${key} → «${l}» en: ${paso.slice(0, 70)}`);
      }
      if (!nombra) vagos.push(`${key}: ${paso.slice(0, 90)}`);
    }
  }
  // Hoy son 97 (los tutoriales de 3 a 5 pasos, más los «ojo» del paso externo).
  assert.ok(pasosLeidos > 60, `leí ${pasosLeidos} pasos: el extractor quedó viejo`);
  assert.deepEqual(mentirosos, [], 'un tutorial anuncia como opcional un campo que el formulario exige');
  assert.deepEqual(vagos, [], 'un paso dice «opcional» sin nombrar de qué campo habla');
});
