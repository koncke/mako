// =============================================================================
// El Change History de cada área de /admin/dev, sacado de git
// =============================================================================
// El problema que resuelve: hay 121 áreas y escribir a mano el historial de cada
// una es exactamente lo que `areas.ts` prohíbe — «uno inventado de antemano es
// peor que ninguno: se lee como verdad y no lo es».
//
// Pero el historial no hay que inventarlo: ya está escrito. Cada área declara
// dónde vive, y git sabe qué commits tocaron esos archivos. Esto lo cosecha y lo
// deja en un archivo generado que la pantalla importa.
//
// Lo que NO reemplaza: las seis bitácoras escritas a mano (`<area>/bitacora.ts`).
// Ésas tienen el PEDIDO TEXTUAL del dueño y el porqué de cada decisión, que ningún
// mensaje de commit contiene. Donde existen, mandan ellas y esto va abajo.
//
//   node scripts/gen-dev-historial.mjs
//
// Se corre a mano, no en el build: el `git log` sobre 121 áreas tarda unos
// segundos y el resultado solo cambia cuando hay commits nuevos.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = resolve(RAIZ, 'app/admin/dev/_historial.generado.ts');
const POR_AREA = 12; // los últimos N commits de cada área

/**
 * Lee los slugs y sus rutas de `areas.ts` sin importarlo (es TS).
 *
 * ⚠️ El cierre del array se busca CARÁCTER POR CARÁCTER, fuera de comillas, y no
 * con `\[([^\]]*)\]`. Ese regex —el que estaba— corta en el PRIMER `]` del texto,
 * y las rutas de Next traen uno adentro: `app/crm/[id]/page.tsx`,
 * `app/compartido/[token]/page.tsx`. Todo lo declarado DESPUÉS de la primera ruta
 * dinámica se caía en silencio.
 *
 * Medido el 07/09/2026 sobre las 122 áreas, antes de arreglarlo: `conocimientos`
 * cosechaba 8 de sus 34 rutas, `crm` 11 de 27, `contracts-receipts` 1 de 8 y
 * `shared-links` **0 de 9** — su Change History salía vacío y se leía como un área
 * que nadie tocó. Cuatro áreas, y las cuatro con un `[segmento]`.
 *
 * Por qué no lo cazó nadie: `tests/dev-areas.test.ts` NO usa este parser, importa
 * `AREAS` de verdad, así que veía las 34 y daba verde. Un guard sobre el dato bueno
 * no dice nada del parser que lo lee mal, y acá la salida —un historial más corto—
 * es indistinguible de un área con poca historia. Falla en silencio y hacia abajo.
 */
function leerAreas() {
  const src = readFileSync(resolve(RAIZ, 'app/admin/dev/areas.ts'), 'utf8');
  const inicios = [...src.matchAll(/slug:\s*'([^']+)'/g)].map((m) => ({ slug: m[1], at: m.index }));
  return inicios.map(({ slug, at }, i) => {
    // Cada área termina donde arranca la siguiente: así el `vive:` que se lee es
    // el suyo y no el de la de abajo cuando alguna no declara ninguno.
    const trozo = src.slice(at, i + 1 < inicios.length ? inicios[i + 1].at : src.length);
    const abre = trozo.indexOf('[', trozo.indexOf('vive:'));
    if (!trozo.includes('vive:') || abre < 0) return { slug, rutas: [] };
    const rutas = [];
    let buf = null;
    for (let j = abre + 1; j < trozo.length; j++) {
      const c = trozo[j];
      if (buf !== null) { if (c === "'") { rutas.push(buf); buf = null; } else buf += c; continue; }
      if (c === "'") { buf = ''; continue; }
      if (c === ']') break; // el cierre de verdad: los `]` de las rutas van entre comillas
    }
    return { slug, rutas };
  });
}

const SEP = '';
const FIN = '';

/** Los commits que tocaron esas rutas, del más nuevo al más viejo. */
function commitsDe(rutas) {
  if (!rutas.length) return [];
  let salida;
  try {
    salida = execFileSync(
      'git',
      [
        'log', `-${POR_AREA}`, '--no-merges',
        `--format=%h${SEP}%ad${SEP}%s${SEP}%b${FIN}`,
        '--date=format:%Y-%m-%d %H:%M',
        '--', ...rutas,
      ],
      { cwd: RAIZ, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
    );
  } catch {
    return []; // ruta que ya no existe en el árbol: no es un error
  }
  return salida.split(FIN).map((bloque) => bloque.trim()).filter(Boolean).map((bloque) => {
    const [sha, fecha, titulo, cuerpo = ''] = bloque.split(SEP);
    // El trailer dice cuál de las dos cuentas lo hizo. Sin eso no hay a quién
    // preguntarle por una decisión (ver docs/dos-cuentas.md).
    const cuenta = /Claude-Cuenta:\s*(claude1|claude2)/.exec(cuerpo)?.[1] ?? '';
    // La primera línea del cuerpo que no sea un trailer: es el porqué.
    const porque = cuerpo
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l && !/^[A-Za-z-]+:\s/.test(l) && !l.startsWith('🤖')) ?? '';
    return { sha, fecha, titulo, porque: porque.slice(0, 300), cuenta };
  });
}

const areas = leerAreas();
const historial = {};
let conHistoria = 0;
for (const a of areas) {
  const cs = commitsDe(a.rutas);
  if (cs.length) { historial[a.slug] = cs; conHistoria++; }
}

const esc = (s) => JSON.stringify(String(s ?? ''));
const cuerpo = Object.entries(historial)
  .map(([slug, cs]) => `  ${JSON.stringify(slug)}: [\n${cs
    .map((c) => `    { sha: ${esc(c.sha)}, fecha: ${esc(c.fecha)}, titulo: ${esc(c.titulo)}, porque: ${esc(c.porque)}, cuenta: ${esc(c.cuenta)} },`)
    .join('\n')}\n  ],`)
  .join('\n');

writeFileSync(
  DESTINO,
  `// GENERADO por scripts/gen-dev-historial.mjs — no editar a mano.
//
// Los últimos ${POR_AREA} commits que tocaron los archivos de cada área, sacados de
// git. Es el Change History automático: existe porque escribir 121 historiales a
// mano sería inventarlos, y un historial inventado se lee como verdad.
//
// Las bitácoras escritas a mano (\`<area>/bitacora.ts\`) NO se reemplazan: tienen el
// pedido textual del dueño y el porqué, que ningún commit contiene. Mandan ellas.

export type CommitArea = {
  sha: string;
  fecha: string;
  titulo: string;
  /** La primera línea del cuerpo del commit que no es un trailer: el porqué. */
  porque: string;
  /** Cuál de las dos cuentas lo hizo. Vacío = el commit no traía el trailer. */
  cuenta: string;
};

export const HISTORIAL_GIT: Record<string, CommitArea[]> = {
${cuerpo}
};

export const historialGitDe = (slug: string): CommitArea[] => HISTORIAL_GIT[slug] ?? [];
`,
  'utf8',
);

console.log(`${conHistoria}/${areas.length} áreas con historial · ${DESTINO.replace(RAIZ, '.')}`);
