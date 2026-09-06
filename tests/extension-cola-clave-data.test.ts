// =============================================================================
// El resultado viaja con la clave que el server lee, o no viaja
// =============================================================================
// `ejecutar()` devuelve el resultado de un trabajo y el server lo levanta con
// `r.data ?? null`. Escribirlo con cualquier otro nombre no rompe nada: el trabajo
// se marca `listo`, con el resultado en NULL.
//
// ⚠️ ESO ES UN ÉXITO VACÍO, y es la misma familia de mentira que acaba de salir del
// popup —«Listo, lo verás en tu Flow» sobre un pedido que no creó nada— una capa
// más abajo y sin nadie mirando. La rama nueva del Flow reescrito se escribió con
// `datos:` y habría resuelto cada video con la nada adentro.
//
// La regla que la casa ya tenía escrita: **escribir la salida no es ofrecerla.** Se
// chequea el CALL SITE, no que la variable exista.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const worker = readFileSync(resolve(raiz, 'extension', 'background.js'), 'utf8');
const ruta = readFileSync(resolve(raiz, 'app', 'api', 'flow', 'puente', 'route.ts'), 'utf8');

/** El cuerpo de `ejecutar()`, hasta la función que le sigue. */
function cuerpoDeEjecutar(): string {
  const i = worker.indexOf('async function ejecutar(trabajo) {');
  assert.ok(i > 0, 'no encontré `ejecutar`');
  const j = worker.indexOf('\nasync function ', i + 10);
  return worker.slice(i, j > 0 ? j : undefined);
}

test('el server sigue leyendo el resultado de `data`', () => {
  // Si esto cambia, el test de abajo está pinchando la clave equivocada. Se lee del
  // consumidor y no de una constante nuestra: el contrato lo fija quien recibe.
  assert.match(
    ruta, /r\.data\s*\?\?/,
    'El route ya no lee `r.data`. Actualizá la clave en `ejecutar()` y acá.',
  );
});

test('todo resultado bueno de la cola trae la carga en `data`', () => {
  const cuerpo = cuerpoDeEjecutar();
  const fallos: string[] = [];

  // Cada `return { … ok: true … }` del ejecutor.
  for (const m of cuerpo.matchAll(/return\s*\{[\s\S]{0,400}?\}\s*;/g)) {
    const obj = m[0];
    if (!/\bok:\s*true\b/.test(obj)) continue;
    // Un `ok: true` puede no llevar carga (no todo trabajo devuelve algo). Lo que
    // no puede es llevarla con OTRO nombre: eso se pierde en silencio.
    // ⚠️ LAS CLAVES SE LEEN APLANANDO, Y ESTE TEST YA SE MINTIÓ A SÍ MISMO ACÁ.
    //
    // La primera versión anclaba a principio de línea (`/^\s*(\w+):/gm`). Un
    // `return { id, ok: true, datos }` escrito en UNA sola línea no daba NINGUNA
    // clave, así que no había nada que reprobar: el test pasaba en verde sobre
    // exactamente el bug que existe para cazar.
    //
    // Un test que no se prueba rompiéndolo es una afirmación, no una medición.
    // Éste se probó: con `datos:` da 1 fallo, con `data:` da 2 pases.
    const dentro = obj.slice(obj.indexOf('{') + 1, obj.lastIndexOf('}'));
    let plano = dentro;
    // Los objetos anidados se colapsan: si no, `data: { url, mediaId }` aportaría
    // `url` y `mediaId` como si fueran claves de primer nivel.
    for (let i = 0; i < 6 && /\{[^{}]*\}/.test(plano); i++) plano = plano.replace(/\{[^{}]*\}/g, 'X');
    const claves = [...`,${plano}`.matchAll(/[,{]\s*(\w+)\s*:/g)].map((x) => x[1]);
    const carga = claves.filter((k) => !['id', 'ok', 'motivo', 'error', 'reintentable'].includes(k));
    const sobra = carga.filter((k) => k !== 'data');
    if (sobra.length) {
      fallos.push(`«${obj.replace(/\s+/g, ' ').slice(0, 90)}…» → ${sobra.join(', ')}`);
    }
  }

  assert.deepEqual(
    fallos, [],
    'Un resultado bueno lleva su carga con una clave que el server no lee:\n  '
    + fallos.join('\n  ')
    + '\n\nEl route hace `r.data ?? null`: con otro nombre el trabajo queda `listo` y\n'
    + 'con el resultado en NULL. Nadie se entera — es un éxito vacío.',
  );
});
