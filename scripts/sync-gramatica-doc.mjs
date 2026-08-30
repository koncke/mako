// =============================================================================
// sync-gramatica-doc — la tabla de la gramática la escribe el código, no la mano
// =============================================================================
// docs/branding-mako.md es el manual de marca que se puede llevar afuera, así que
// tiene que traer la gramática de los nueve estados adentro. Pero la fuente de
// verdad es lib/mako-gramatica.ts, y una tabla copiada a mano se queda vieja —
// que es la regla «una cosa, un lugar» de AGENTS.md.
//
// No es hipotético y no tardó ni una hora: el documento se escribió a mano el
// 2026-08-11 y en la misma sesión ya decía «el impacto» donde el código dice «el
// impacto esperado», y «decisión» con tilde donde el tipo vale 'decision'.
//
// A diferencia de sync-contrato-detalle, acá el módulo SÍ se puede importar: su
// única dependencia es un `import type`, que tsx borra en runtime. Nada de
// regex sobre el fuente — parsear objetos anidados a mano es cómo se cuelan los
// desfases que este script viene a evitar.
//
//   node --import tsx scripts/sync-gramatica-doc.mjs           → escribe
//   node --import tsx scripts/sync-gramatica-doc.mjs --check   → falla si difiere
// =============================================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { GRAMATICA, ESTADOS, MARCA, REGLA_MARCA, EMOJI_SEMAFORO } from '../lib/mako-gramatica.ts';

const CHECK = process.argv.includes('--check');
const DESTINO = 'docs/branding-mako.md';

const marca = (n) => [
  `<!-- ${n}:INICIO — generado por scripts/sync-gramatica-doc.mjs, NO editar a mano -->`,
  `<!-- ${n}:FIN -->`,
];
const [G_INICIO, G_FIN] = marca('GRAMATICA-MAKO');
const [M_INICIO, M_FIN] = marca('REGLA-MARCA');

/** El pipe parte una tabla de markdown en dos celdas. */
const esc = (s) => String(s).replace(/\|/g, '\\|');

const bloqueGramatica = [
  G_INICIO,
  '',
  'Sale de `lib/mako-gramatica.ts`. **No la edites acá**: si cambia allá, cambia sola.',
  '',
  '| Estado | Rótulo | Forma | Tono | Qué comunica | Exige |',
  '|---|---|---|---|---|---|',
  ...ESTADOS.map((k) => {
    const d = GRAMATICA[k];
    const rot = d.bloquea ? `**${esc(d.rotulo)}**` : esc(d.rotulo);
    return `| \`${k}\` | ${rot} | ${d.forma} | ${d.tono} | ${esc(d.comunica)} | ${d.exige.map(esc).join(' · ')} |`;
  }),
  '',
  `El orden es el CICLO, no el alfabeto: detecta, analiza, explica, propone, pide permiso, actúa, cierra y queda vigilando. Los dos últimos son las salidas. En negrita, el único estado con \`bloquea\` — nada se mueve hasta que el usuario conteste.`,
  '',
  `El semáforo, para los canales sin CSS (WhatsApp y email, nunca la interfaz): ${ESTADOS.length && Object.entries(EMOJI_SEMAFORO).map(([k, v]) => `${v} ${k}`).join(' · ')}.`,
  '',
  G_FIN,
].join('\n');

const bloqueMarca = [
  M_INICIO,
  '',
  `El nombre es **${MARCA}**. Ésta es la regla tal cual viaja adentro de los prompts, desde`,
  '`lib/mako-gramatica.ts`:',
  '',
  ...REGLA_MARCA.split('\n').map((l) => (l.trim() ? `> ${l}` : '>')),
  '',
  M_FIN,
].join('\n');

const entre = (txt, ini, fin, bloque) => {
  const i = txt.indexOf(ini);
  const j = txt.indexOf(fin);
  if (i < 0 || j < 0) return null;
  return txt.slice(0, i) + bloque + txt.slice(j + fin.length);
};

const BLOQUES = [
  { nombre: 'GRAMATICA-MAKO', ini: G_INICIO, fin: G_FIN, texto: bloqueGramatica },
  { nombre: 'REGLA-MARCA', ini: M_INICIO, fin: M_FIN, texto: bloqueMarca },
];

if (!existsSync(DESTINO)) {
  console.error(`  ✗ ${DESTINO} no existe`);
  process.exit(1);
}

const txt = readFileSync(DESTINO, 'utf8');
let nuevo = txt;
for (const b of BLOQUES) {
  const paso = entre(nuevo, b.ini, b.fin, b.texto);
  if (paso === null) {
    console.error(`  ✗ ${DESTINO}: faltan los marcadores ${b.nombre}.`);
    process.exit(1);
  }
  nuevo = paso;
}

// ⚠️ SIN LOS `\r`, POR LA MISMA RAZÓN QUE `sync-contrato-detalle.mjs`: el bloque se
// inserta con `\n` sobre un archivo CRLF, así que en el clon donde el script corrió el
// archivo queda MEZCLADO y coincide, y en un árbol recién sacado de git —un clon nuevo,
// un worktree— git lo normaliza todo a CRLF y la comparación exacta falla sobre un
// archivo idéntico. El guard frenaba el push de cualquiera que reclonara.
// Al escribir se usa `nuevo` tal cual: normalizar decide SI hay que escribir, no QUÉ.
const sinCR = (s) => s.replace(/\r\n/g, '\n');
if (sinCR(nuevo) === sinCR(txt)) {
  console.log(`  ✓ ${DESTINO} al día`);
  process.exit(0);
}
if (CHECK) {
  console.error(`  ✗ ${DESTINO} DESINCRONIZADO — corré: node --import tsx scripts/sync-gramatica-doc.mjs`);
  process.exit(1);
}
writeFileSync(DESTINO, nuevo);
console.log(`  ↻ ${DESTINO} actualizado`);
