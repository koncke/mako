// =============================================================================
// sync-operaciones — el catálogo de operaciones del puente vive en UN lugar
// =============================================================================
// `lib/flow-operaciones.ts` dice qué operaciones sabe hacer el puente a Flow,
// cuáles hay que enseñarle, con qué token, y cuáles cuestan créditos del cliente.
// El servidor lo importa. La EXTENSIÓN no puede: es un paquete aparte, sin bundler,
// y no ve `lib/`.
//
// Hasta acá eso se resolvía copiando el dato a mano, y este repo ya sabe cómo
// termina: el contrato del `detalle` se actualizó en un camino y no en el otro, y
// desde WhatsApp siguió saliendo mal durante días sin que nada avisara. El dueño lo
// vio antes que nosotros.
//
// Acá el desfase sería peor, porque los tokens son el ancla que decide si una
// generación PAGADA se reconoce: un token distinto entre los dos archivos significa
// que la persona genera un clip, se le cobra, y el puente dice que no aprendió.
//
//   node scripts/sync-operaciones.mjs            → escribe extension/operaciones.js
//   node scripts/sync-operaciones.mjs --check    → falla si quedó viejo
// =============================================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { OPERACIONES } from '../lib/flow-operaciones.ts';

const CHECK = process.argv.includes('--check');
const DESTINO = 'extension/operaciones.js';

/**
 * ⚠️ SE NORMALIZAN LOS `\r\n` PARA DECIDIR, y lo que se escribe no se toca.
 *
 * El bloque se genera con `\n` y el archivo en disco es CRLF (`core.autocrlf=true`),
 * así que una comparación exacta pasa SÓLO en el clon donde el script corrió alguna
 * vez. En un clon nuevo, un worktree o CI, git normaliza a CRLF y la guarda frena el
 * push sobre un archivo idéntico. Las cuatro guardas de esta familia lo tuvieron.
 */
const sinCR = (s) => s.replace(/\r\n/g, '\n');

const cuerpo = `// =============================================================================
// GENERADO por scripts/sync-operaciones.mjs — NO EDITAR A MANO
// =============================================================================
// La fuente es lib/flow-operaciones.ts. Si tocás esto directamente, el pre-push
// frena el push — y con razón: un token distinto entre los dos archivos significa
// que alguien genera un clip, se le cobra, y el puente dice que no aprendió.
//
// La extensión no puede importar de lib/ (es un paquete aparte, sin bundler), así
// que el catálogo se copia. Es la misma solución que el repo ya usa para las skills
// y para plugin/, por la misma razón y con la misma guarda.
// =============================================================================

export const OPERACIONES = Object.freeze(${JSON.stringify(OPERACIONES, null, 2)});

/** La operación de un id, o null. */
export function operacionDe(op) {
  return OPERACIONES.find((o) => o.op === op) || null;
}

/** Las que hay que enseñar, en orden. */
export const A_ENSENAR = Object.freeze(OPERACIONES.filter((o) => o.como !== 'ninguna'));

/**
 * Las que se le PIDEN a la persona. Subconjunto de A_ENSENAR.
 *
 * Las otras se aprenden solas: mostrarlas como un paso deja a alguien mirando una
 * pantalla que le pide algo que no puede hacer, con un boton que solo cierra.
 */
export const A_PEDIR = Object.freeze(
  OPERACIONES.filter((o) => o.como !== 'ninguna' && o.pide && o.detectable),
);

/**
 * Las que el puente necesita y todavia NO puede reconocer.
 *
 * No son un paso, y tampoco se callan: se muestran como un limite NUESTRO. Callarlas
 * hace que alguien cuente las operaciones y concluya que falta algo que hacer — y eso
 * ya dejo a alguien subiendo una foto una y otra vez sin que pasara nada.
 */
export const SIN_DETECTAR = Object.freeze(
  OPERACIONES.filter((o) => o.como !== 'ninguna' && !o.detectable),
);

/**
 * Las formas en que un texto puede aparecer dentro del cuerpo de un pedido.
 *
 * ⚠️ \`form\` es la que importa: BOQ manda \`f.req\` como form-urlencoded, donde el
 * espacio es \`+\` y no \`%20\`. Sin esa fila, una generación capturada perfecta daba
 * «no aprendí» — medido, cero de seis.
 */
const CODIFICACIONES = [
  ['crudo', (t) => t],
  ['json', (t) => JSON.stringify(t).slice(1, -1)],
  ['uri', (t) => encodeURIComponent(t)],
  ['json+uri', (t) => encodeURIComponent(JSON.stringify(t).slice(1, -1))],
  ['form', (t) => new URLSearchParams({ x: t }).toString().slice(2)],
  ['json2', (t) => JSON.stringify(JSON.stringify(t).slice(1, -1)).slice(1, -1)],
];

/** Con qué codificación aparece \`ancla\` en \`cuerpo\`, o null. */
export function dondeAparece(cuerpo, ancla) {
  if (typeof cuerpo !== 'string' || !cuerpo || !ancla) return null;
  for (const [nombre, codificar] of CODIFICACIONES) {
    try { if (cuerpo.includes(codificar(ancla))) return nombre; } catch { /* sigue */ }
  }
  return null;
}

/**
 * Qué operación es este cuerpo, mirando los tokens del catálogo.
 *
 * ⚠️ SE DETECTA CON EL TOKEN Y SE ETIQUETA CON LA FRASE, y son dos cosas.
 * El token es alfanumérico para que ninguna codificación lo cambie — por eso
 * encuentra la generación pase lo que pase. Y eso mismo lo vuelve inútil como
 * etiqueta: al ser idéntico bajo todas, contesta siempre \'crudo\'.
 * Lo que hace falta para REPETIR el pedido es cómo viajó la FRASE, que sí tiene
 * espacios y sí cambia. Medido: token → crudo, frase → form, mismo cuerpo.
 */
export function operacionDelCuerpo(cuerpo) {
  for (const o of OPERACIONES) {
    if (!o.token) continue;
    if (!dondeAparece(cuerpo, o.token)) continue;
    const donde = (o.frase && dondeAparece(cuerpo, o.frase)) || \'token\';
    return { op: o.op, donde };
  }
  return null;
}
`;

if (CHECK) {
  if (!existsSync(DESTINO)) {
    console.error(`\n  X ${DESTINO} no existe. Corré: node scripts/sync-operaciones.mjs\n`);
    process.exit(1);
  }
  if (sinCR(readFileSync(DESTINO, 'utf8')) !== sinCR(cuerpo)) {
    console.error(`\n  X ${DESTINO} quedó viejo respecto de lib/flow-operaciones.ts.`);
    console.error('    Los tokens son el ancla que decide si una generación PAGADA se');
    console.error('    reconoce: desincronizados, al cliente se le cobra un clip y el');
    console.error('    puente dice que no aprendió.\n');
    console.error('    Corré: node scripts/sync-operaciones.mjs\n');
    process.exit(1);
  }
  console.log(`  ✓ ${DESTINO} al día`);
  process.exit(0);
}

writeFileSync(DESTINO, cuerpo);
console.log(`✅ ${DESTINO} (${OPERACIONES.length} operaciones, ${OPERACIONES.filter((o) => o.cuesta).length} que cuestan créditos)`);
