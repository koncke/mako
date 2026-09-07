// =============================================================================
// Un trabajo de generación lleva su prompt donde la cola del Flow nuevo lo lee
// =============================================================================
// ⚠️ ESTE TEST EXISTE PORQUE EL DUEÑO VIO ESTO EN LA PANTALLA DE SU CLIENTE, en una
// reunión (06/09/2026):
//
//     Google no pudo hacer la imagen del escenario 1 y no dijo por qué
//     El trabajo no trae texto para filmar.
//
// La segunda línea es NUESTRA. La rama de BOQ de `ejecutar()` (extensión) reemplaza
// la frase de aprendizaje por `pedido.prompt`; los dos `encolar` del server llevaban
// el prompt ADENTRO —en `body` para el clip, en `parches` para la imagen— y arriba
// no había nada. Con plantilla de BOQ, video E imagen morían con ese mensaje.
//
// Dos contratos se escribieron por separado y nadie los cruzó: el que encola y el
// que ejecuta. Este test los cruza.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const leer = (...p: string[]) => readFileSync(resolve(raiz, ...p), 'utf8');
const vivo = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const accion = vivo(leer('app', 'video-generator', 'video-action.ts'));
const worker = vivo(leer('extension', 'background.js'));

/** El objeto literal que se le pasa a `encolar('<tipo>', {…})`, por tipo. */
function pedidosDe(tipo: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`encolar\\('${tipo}',\\s*\\{`, 'g');
  for (const m of accion.matchAll(re)) {
    // Hasta la llave que cierra el objeto, contando llaves.
    let i = m.index! + m[0].length;
    let hondo = 1;
    const desde = i;
    while (i < accion.length && hondo > 0) {
      if (accion[i] === '{') hondo++;
      else if (accion[i] === '}') hondo--;
      i++;
    }
    out.push(accion.slice(desde, i - 1));
  }
  return out;
}

/** Las claves de PRIMER nivel de un objeto literal (aplanando lo anidado). */
function clavesDePrimerNivel(obj: string): string[] {
  let plano = obj;
  for (let k = 0; k < 8 && /[{(\[][^{}()\[\]]*[})\]]/.test(plano); k++) {
    plano = plano.replace(/[{(\[][^{}()\[\]]*[})\]]/g, 'X');
  }
  return [...`,${plano}`.matchAll(/[,{]\s*(?:\.\.\.\([^)]*\)\s*)?([a-zA-Z_$][\w$]*)\s*:/g)].map((x) => x[1]);
}

for (const tipo of ['generar_clip', 'generar_imagen']) {
  test(`todo encolar('${tipo}') lleva \`prompt\` al tope del pedido`, () => {
    const pedidos = pedidosDe(tipo);
    assert.ok(pedidos.length >= 1, `no encontré ningún encolar('${tipo}')`);
    for (const p of pedidos) {
      assert.ok(
        clavesDePrimerNivel(p).includes('prompt'),
        `Un encolar('${tipo}') no lleva \`prompt\` al tope:\n  ${p.replace(/\s+/g, ' ').slice(0, 160)}…\n\n`
        + 'La rama de BOQ de la cola lee `pedido.prompt`. Sin él, con plantilla de BOQ el\n'
        + 'trabajo muere con «El trabajo no trae texto para filmar» — en la pantalla del\n'
        + 'cliente.',
      );
    }
  });
}

test('la rama de BOQ de la cola lee el prompt de `pedido.prompt`', () => {
  // El otro lado del contrato, para que los dos no se separen otra vez.
  assert.match(
    worker,
    /const prompt = String\(\(trabajo\.pedido && \(trabajo\.pedido\.prompt \|\| trabajo\.pedido\.texto\)\) \|\| ''\);/,
    'La cola ya no lee `pedido.prompt`: si cambió el campo, hay que cambiarlo en los\n'
    + 'dos `encolar` de video-action.ts y en este test.',
  );
});

test('el prompt del clip al tope es el MISMO que va en el cuerpo', () => {
  // Dos prompts distintos para el mismo clip —uno para el Flow viejo y otro para el
  // nuevo— sería un anuncio que cambia según el protocolo. Se calcula una vez.
  const [pedido] = pedidosDe('generar_clip');
  assert.match(pedido, /^\s*prompt: promptClip,/m);
  assert.match(pedido, /prompt: promptClip,\s*\n\s*mediaId,/);
});
