// =============================================================================
// Leer el JSON que escupe `loudnorm=print_format=json` — sin python
// =============================================================================
// ── Por qué existe ─────────────────────────────────────────────────────────
// El montaje usaba `python -c` en tres lugares para sacar un número de un JSON.
// Anda en la máquina de Martín y **no anda en el contenedor**: la imagen del
// worker lleva node y ffmpeg, no un intérprete de python. Y la forma en que
// fallaría es la peor: `python: command not found` en medio de un pipe, con
// `set -o pipefail` tomando la salida vacía como un número.
//
// ── Por qué no es un `node -e` inline ──────────────────────────────────────
// Porque el JSON viene mezclado con el log de ffmpeg y hay que recortarlo entre
// la ÚLTIMA llave de apertura y la última de cierre. Eso, escrito en una línea
// dentro de comillas de bash, es exactamente donde este repo ya se quemó: un
// script con regex por heredoc llega mutilado aunque esté citado.
//
// ⚠️ Y LA RAZÓN DEL `rindex`, que no es cosmética: ffmpeg imprime el JSON al
// final, después de todo su log — y ese log puede traer llaves (nombres de
// filtros, rutas). Buscar la PRIMERA llave agarra basura y `JSON.parse` tira un
// error que no dice nada útil. Se busca la última de las dos puntas.
//
// uso:  ffmpeg … 2>&1 | node loudnorm-json.mjs input_i
//       ffmpeg … 2>&1 | node loudnorm-json.mjs input_i input_tp input_lra input_thresh
//
// Imprime los campos pedidos separados por espacio, en el orden pedido, para que
// `set -- $(…)` de bash los reparta en $1 $2 $3 $4 igual que antes.

import { readFileSync } from 'node:fs';

const campos = process.argv.slice(2);
if (!campos.length) {
  console.error('uso: … | node loudnorm-json.mjs <campo> [campo…]');
  process.exit(2);
}

// Todo stdin de una. La salida de ffmpeg para un clip son unos pocos KB.
let crudo = '';
try {
  crudo = readFileSync(0, 'utf8');
} catch {
  console.error('loudnorm-json: no se pudo leer stdin');
  process.exit(1);
}

const ini = crudo.lastIndexOf('{');
const fin = crudo.lastIndexOf('}');
if (ini < 0 || fin < ini) {
  // ⚠️ Se dice QUÉ llegó, recortado. Un «no encontré el JSON» a secas manda a
  // adivinar; las últimas líneas de ffmpeg suelen traer el error de verdad
  // (archivo que no existe, filtro mal escrito, códec que falta).
  console.error('loudnorm-json: la salida de ffmpeg no trae JSON. Últimas líneas:');
  console.error(crudo.trim().split('\n').slice(-6).join('\n'));
  process.exit(1);
}

let datos;
try {
  datos = JSON.parse(crudo.slice(ini, fin + 1));
} catch (e) {
  console.error(`loudnorm-json: el JSON no parsea (${e instanceof Error ? e.message : e})`);
  process.exit(1);
}

const salida = [];
for (const c of campos) {
  const v = datos[c];
  // ⚠️ Un campo ausente NO puede salir como cadena vacía: bash lo colapsa y el
  // `set --` siguiente corre todos los parámetros un lugar, así que el
  // `measured_TP` termina recibiendo el LRA. Un número equivocado en loudnorm no
  // da error: da un audio con el loudness mal, que es justo lo que nadie mira.
  if (v === undefined || v === null || v === '') {
    console.error(`loudnorm-json: falta el campo "${c}" en la salida de ffmpeg`);
    process.exit(1);
  }
  salida.push(String(v));
}
console.log(salida.join(' '));
