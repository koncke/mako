// =============================================================================
// «El puente puede filmar» se decide UNA vez, o vuelven las nueve definiciones
// =============================================================================
// ⚠️ HABÍA NUEVE, Y NINGUNA ERA ALCANZABLE EN EL FLOW NUEVO. El dueño mandó dos
// capturas del mismo segundo: el popup decía «MaKo ya puede hacer tus anuncios» y
// el aviso de al lado decía «MaKo todavía no puede filmar tus anuncios».
//
// No era un cartel desalineado. Cuatro compuertas duras cuelgan de ese booleano —el
// botón de crear, la cola de la extensión, el reparto del server y el guard de
// filmar— así que mientras estuvo cerrado NADIE pudo hacer un video, por cuatro
// caminos independientes.
//
// El defecto no fue una línea: fue que cada superficie se armó su propio juicio con
// los insumos que tenía a mano. Este test cuida la ESTRUCTURA, no los textos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const leer = (...p: string[]) => readFileSync(resolve(raiz, ...p), 'utf8');

const worker = leer('extension', 'background.js');
const route = leer('app', 'api', 'flow', 'puente', 'route.ts');
const aviso = leer('app', 'video-generator', 'puente-avisos.tsx');

/** Sin comentarios: ahí se explica el defecto y se lo nombra a propósito. */
const vivo = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * El cuerpo de cada `catch { … }`, contando llaves.
 *
 * Un regex no sirve: el cuerpo de un catch tiene llaves adentro (`ops = {}`, un
 * objeto literal) y cualquier `[^}]*` se frena en la primera.
 */
/** El cuerpo del bloque que abre con `apertura`, contando llaves. `null` si no está. */
function bloqueDe(src: string, apertura: string): string | null {
  const i = src.indexOf(apertura);
  if (i < 0) return null;
  let j = i + apertura.length;
  let hondo = 1;
  const desde = j;
  while (j < src.length && hondo > 0) {
    const c = src[j];
    if (c === '{') hondo++;
    else if (c === '}') hondo--;
    j++;
  }
  return src.slice(desde, j - 1);
}

function cuerposDeCatch(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/catch\s*(?:\([^)]*\)\s*)?\{/g)) {
    let i = m.index! + m[0].length;
    let hondo = 1;
    const desde = i;
    while (i < src.length && hondo > 0) {
      const c = src[i];
      if (c === '{') hondo++;
      else if (c === '}') hondo--;
      i++;
    }
    out.push(src.slice(desde, i - 1));
  }
  return out;
}

test('el latido decide con el ensayo en seco, no con una credencial', () => {
  // ⚠️ SE MIRA ADENTRO DE LA RAMA, NO EN TODO EL ARCHIVO. La primera versión de este
  // test buscaba `puedeFilmar(` en cualquier lado: como el handler ESTADO también lo
  // llama, sacarlo del LATIDO —que es la rama que abre las cuatro compuertas— dejaba
  // el test en verde. Verificado rompiéndolo: no cazaba nada.
  const w = vivo(worker);
  const rama = bloqueDe(w, 'if (enFlowNuevo) {');
  assert.ok(rama !== null, 'desapareció la rama del Flow nuevo en el latido');
  assert.ok(
    /puedeFilmar\(/.test(rama!),
    'El latido ya no decide con el ensayo en seco. Sin él, «listo» vuelve a ser\n'
    + '«tengo un bearer» — que en flow.google.com es falso por construcción, así que\n'
    + 'las cuatro compuertas quedan cerradas para siempre.',
  );
  // ⚠️ EL ORDEN IMPORTA MÁS QUE LA PRESENCIA. `if (!bearer)` tiene que quedar
  // SUBORDINADO al protocolo: si vuelve a ser la primera pregunta, el ensayo queda
  // decorativo y el Flow nuevo vuelve a reportar `sin_sesion` para siempre.
  const iNuevo = w.indexOf('if (enFlowNuevo) {');
  const iBearer = w.indexOf('} else if (!bearer) {');
  assert.ok(iNuevo > 0, 'desapareció la rama del Flow nuevo en el latido');
  assert.ok(
    iBearer > iNuevo,
    'La pregunta por el bearer volvió a estar por delante del protocolo.\n'
    + 'En flow.google.com no hay bearer y este mismo ciclo lo borra: preguntarlo\n'
    + 'primero cierra las cuatro compuertas para siempre.',
  );
});

test('el popup y el latido salen del MISMO juicio', () => {
  const w = vivo(worker);
  assert.ok(
    /for \(const o of A_PEDIR\) ops\[o\.op\] = ensayarOperacion\(/.test(w),
    'El handler ESTADO volvió a marcar una operación como sabida sin ensayarla.\n'
    + 'Tener una entrada guardada no es saber hacerla: el cuerpo puede estar vacío,\n'
    + 'faltarle la url, o haber sido pisado por una generación posterior.',
  );
  assert.ok(
    !/const falta = A_PEDIR\.find\(\(o\) => !ops\[o\.op\]\)/.test(w),
    'Volvió el cálculo viejo de `siguiente`, que sólo miraba que la entrada existiera.',
  );
});

test('ningún `catch` del puente resuelve a «todo listo»', () => {
  // ⚠️ ERA `catch { ops = {}; siguiente = null; }`, y `siguiente === null` es lo que
  // el popup lee como «no falta nada». Un error de lectura se pintaba como éxito:
  // sin excepción visible, sin log, y sin nada que investigar.
  // ⚠️ ESTE TEST SE ESCRIBIÓ MAL LA PRIMERA VEZ, Y VALE DEJARLO ANOTADO: el intento
  // era `/catch\s*\{[^}]*siguiente\s*=\s*null[^}]*\}/`, y `[^}]*` se frena en la
  // primera llave — que es la de `ops = {}`, justo antes de lo que buscaba. O sea
  // que daba verde sobre el bug LITERAL que existe para cazar. Se ve al romperlo.
  //
  // Ahora los `catch` se extraen por conteo de llaves y se miran enteros.
  const w = vivo(worker);
  const culpables = cuerposDeCatch(w).filter((b) => /(?<!let\s)siguiente\s*=\s*null\s*;/.test(b));
  assert.deepEqual(
    culpables.map((b) => b.replace(/\s+/g, ' ').slice(0, 70)), [],
    'Un `catch` vuelve a dejar `siguiente = null`, que el popup lee como «todo listo».\n'
    + 'Un fallo tiene que caer al PRIMER paso: pedir algo ya hecho es barato,\n'
    + 'afirmar que se puede filmar no.',
  );
});

test('un latido sin `estado` no se guarda como listo', () => {
  // La ausencia de información no puede ser la mejor noticia posible: de ese campo
  // cuelgan el botón de crear, el reparto de trabajos y el guard de filmar.
  const m = /ESTADOS\.includes\([\s\S]{0,120}?:\s*'(\w+)'/.exec(vivo(route));
  assert.ok(m, 'no encontré el default del estado en el route');
  assert.notEqual(
    m[1], 'listo',
    'El default de un latido sin `estado` volvió a ser `listo`: una extensión vieja,\n'
    + 'un cuerpo recortado o un campo renombrado se leerían como «puede filmar».',
  );
});

test('la web tiene UN solo lugar donde el puente «anda»', () => {
  const ok = [...vivo(aviso).matchAll(/anda:\s*true/g)];
  assert.equal(
    ok.length, 1,
    `Hay ${ok.length} formas de que la web declare que el puente anda.\n`
    + 'Nueve definiciones distintas fue exactamente el bug: cada superficie se armó\n'
    + 'la suya con los insumos que tenía a mano.',
  );
});

test('el juicio de la extensión es una COPIA generada, no una segunda escritura', () => {
  // Si alguien reimplementa el ensayo dentro de la extensión, vuelve a haber dos
  // versiones — y ésta decide si se abre el producto. La copia la hace
  // `scripts/sync-puede-filmar.mjs` y la vigila el pre-push.
  const copia = leer('extension', 'puede-filmar.js');
  assert.match(copia, /GENERADO por scripts\/sync-puede-filmar\.mjs/);
  // La lista de nombres importados crece; lo que no puede cambiar es de DÓNDE salen.
  const imp = /import \{([^}]+)\} from '\.\/puede-filmar\.js';/.exec(worker);
  assert.ok(imp, 'El service worker ya no importa el juicio: lo estaría decidiendo por su cuenta.');
  for (const n of ['puedeFilmar', 'ensayarOperacion', 'elegirPlantilla']) {
    assert.ok(
      imp![1].includes(n),
      `El worker dejó de importar \`${n}\`: si lo reimplementa, vuelve a haber dos versiones\n`
      + 'del juicio — y ésta decide si se abre el producto y si se cobra un crédito.',
    );
  }
});
