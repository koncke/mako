// =============================================================================
// graficos-corbel — el estilo por defecto del Dashboard, con los VALORES de Corbel
// =============================================================================
// Martín, 31/10/2026: «ya estan los dashboard? Ya lo aplicamos? Sigo viendo los templates viejos», y sobre cuál es el de
// por defecto: «creo que había uno que era tipo blanco y negro, que era como el más sólido». Es Corbel con su paleta Mono:
// https://demo.codeandchill.store/corbel/. Los valores se leyeron de la demo con el navegador y están en
// docs/diseno/tokens-corbel.json; tests/graficos-corbel.test.ts mide que esta tabla sea ESA, valor por valor. Si la demo
// cambia, se vuelve a leer: no se adivina.
//
// CÓMO ENTRA: la hoja lleva `data-paleta` (`paletaDeEscena`) en el contenedor del editor y de la miniatura, y adentro se
// REDEFINEN los tokens de la casa (`--ink`, `--surface`, `--good`…), como hace la portada con su color: todo lo que ya se
// dibuja con tokens se pinta solo, y el oscuro son los valores oscuros de la misma tabla. El vidrio, los tiles y el negro
// de Corbel van en `--cb-*`.
//
// ⚠️ EN HEX A PROPÓSITO, y por eso vive acá y no en app/dashboard/editor-css.ts (que sólo tiene tokens): son los valores.
// ⚠️ EL RAYADO NO SE COPIA. En Corbel las columnas van rayadas de adorno; acá el rayado significa «Estimado»
//    (`VOCABULARIO`, lib/graficos-temas.ts) y una medición rayada afirmaría lo contrario de lo que es.
// ⚠️ Puro y sin server-only: lo leen la pantalla, el arnés y los tests.
// =============================================================================

export type EscenaCorbel = 'mono' | 'pastel' | 'ocean' | 'sage';

type Tokens = Record<string, string>;

/** Lo que se repite en las paletas con color (claro): el texto y las líneas de Corbel. */
const CLARO_COLOR: Tokens = {
  '--surface': '#fbfcfd', '--ink': '#14202a', '--dim': '#4c5a65', '--faint': '#5f6d78',
  '--border': '#14202a17', '--border-strong': '#14202a29', '--surface-2': '#14202a0f',
  '--on-primary': '#fff',
  '--cb-glass': '#ffffff80', '--cb-rim': '#ffffffd1',
  '--cb-shadow': '0 1px 0 #fffc inset, 0 22px 44px -30px #00000038',
};
const OSCURO_COLOR: Tokens = {
  '--surface': '#172129', '--ink': '#e8eef1', '--dim': '#a7b3bb', '--faint': '#8d9aa3',
  '--border': '#ffffff16', '--border-strong': '#ffffff29', '--surface-2': '#ffffff11',
  '--on-primary': '#111',
  '--cb-glass': '#ffffff0d', '--cb-rim': '#ffffff13',
  '--cb-shadow': '0 1px 0 #ffffff0d inset, 0 24px 48px -30px #000c',
};
/** El semáforo: Corbel lo deja igual en las cuatro paletas («los colores de estado conservan su significado»). */
const ESTADO_CLARO: Tokens = { '--good': '#22735c', '--good-bg': '#d5eee4', '--bad': '#b1412a', '--bad-bg': '#f8e1da', '--warn': '#85580a', '--warn-bg': '#f5ead2', '--warn-fill': '#85580a' };
const ESTADO_OSCURO: Tokens = { '--good': '#6fd3b0', '--good-bg': '#6fd3b021', '--bad': '#f2937c', '--bad-bg': '#f2937c21', '--warn': '#e8bd62', '--warn-bg': '#e8bd6221', '--warn-fill': '#e8bd62' };

/** La tinta sobre un tile claro. */
const ON_TILE = '#14202a';
/** El chip verde sobre el tile negro (`.delta` adentro de `tile--sky`, medido: rgba(143, 227, 196, .16)). */
const SOBRE_NEGRO: Tokens = { '--cb-sky-good': '#8fe3c4', '--cb-sky-good-bg': '#8fe3c429', '--cb-sky-bad': '#f2937c', '--cb-sky-bad-bg': '#f2937c21' };
const SOBRE_CLARO: Tokens = { '--cb-sky-good': '#22735c', '--cb-sky-good-bg': '#d5eee4', '--cb-sky-bad': '#b1412a', '--cb-sky-bad-bg': '#f8e1da' };

export const PALETAS_CORBEL: Readonly<Record<EscenaCorbel, { claro: Tokens; oscuro: Tokens }>> = {
  mono: {
    claro: {
      ...ESTADO_CLARO, ...SOBRE_NEGRO,
      '--bg': '#efefed', '--surface': '#fcfcfb', '--ink': '#121212', '--dim': '#4f4f4c', '--faint': '#636360',
      '--border': '#11111117', '--border-strong': '#1111112b', '--surface-2': '#f0f0ef',
      '--primary': '#121212', '--on-primary': '#fff', '--primary-bg': '#e4e4e1',
      '--cb-glass': '#ffffffa3', '--cb-rim': '#ffffffeb',
      '--cb-shadow': '0 1px 0 #fffc inset, 0 22px 44px -30px #00000038',
      '--cb-ocean': '#121212', '--cb-on-ocean': '#f3f7f8',
      '--cb-sky': '#121212', '--cb-sky-ink': '#f3f7f8', '--cb-mint': '#fff', '--cb-lemon': '#e2e2de', '--cb-coral': '#d2d2cd', '--cb-on-tile': ON_TILE,
      '--cb-c1': '#121212', '--cb-c2': '#b4b4af', '--cb-c3': '#4f4f4c', '--cb-c4': '#8e8e89', '--cb-c5': '#3f3f3c', '--cb-c6': '#6a6a66', '--cb-c7': '#a6a6a1', '--cb-c8': '#696965',
    },
    oscuro: {
      ...ESTADO_OSCURO, ...SOBRE_CLARO,
      '--bg': '#0b0b0b', '--surface': '#161616', '--ink': '#ededeb', '--dim': '#a9a9a5', '--faint': '#8e8e8a',
      '--border': '#ffffff16', '--border-strong': '#ffffff29', '--surface-2': '#262626',
      '--primary': '#ededeb', '--on-primary': '#111', '--primary-bg': '#ffffff1a',
      '--cb-glass': '#ffffff0b', '--cb-rim': '#ffffff13',
      '--cb-shadow': '0 1px 0 #ffffff0d inset, 0 24px 48px -30px #000c',
      '--cb-ocean': '#222', '--cb-on-ocean': '#f3f7f8',
      '--cb-sky': '#f0f0ee', '--cb-sky-ink': ON_TILE, '--cb-mint': '#d6d6d2', '--cb-lemon': '#c2c2bd', '--cb-coral': '#ababa6', '--cb-on-tile': ON_TILE,
      '--cb-c1': '#ededeb', '--cb-c2': '#6c6c68', '--cb-c3': '#a9a9a5', '--cb-c4': '#4c4c4a', '--cb-c5': '#8e8e8a', '--cb-c6': '#c2c2bd', '--cb-c7': '#c4c4bf', '--cb-c8': '#8a8a86',
    },
  },
  pastel: {
    claro: {
      ...CLARO_COLOR, ...ESTADO_CLARO, ...SOBRE_CLARO,
      '--bg': '#e6ecef', '--primary': '#2a6f9a', '--primary-bg': '#d6e8f5',
      '--cb-ocean': '#1f4d6a', '--cb-on-ocean': '#f3f7f8',
      '--cb-sky': '#a9d2f1', '--cb-sky-ink': ON_TILE, '--cb-mint': '#a7e1ca', '--cb-lemon': '#f1e08f', '--cb-coral': '#f6b4a3', '--cb-on-tile': ON_TILE,
      '--cb-c1': '#2a6f9a', '--cb-c2': '#5f6d78', '--cb-c3': '#2f9a7e', '--cb-c4': '#df7659', '--cb-c5': '#cf9426', '--cb-c6': '#1f4d6a', '--cb-c7': '#4c5a65', '--cb-c8': '#14202a',
    },
    oscuro: {
      ...OSCURO_COLOR, ...ESTADO_OSCURO, ...SOBRE_CLARO,
      '--bg': '#0c1216', '--primary': '#79b6e3', '--primary-bg': '#79b6e326',
      '--cb-ocean': '#24597a', '--cb-on-ocean': '#f3f7f8',
      '--cb-sky': '#a9d2f1', '--cb-sky-ink': ON_TILE, '--cb-mint': '#a7e1ca', '--cb-lemon': '#f1e08f', '--cb-coral': '#f6b4a3', '--cb-on-tile': ON_TILE,
      '--cb-c1': '#79b6e3', '--cb-c2': '#b8daf3', '--cb-c3': '#5fcaa8', '--cb-c4': '#f09a82', '--cb-c5': '#e7b552', '--cb-c6': '#24597a', '--cb-c7': '#a7e1ca', '--cb-c8': '#f6b4a3',
    },
  },
  ocean: {
    claro: {
      ...CLARO_COLOR, ...ESTADO_CLARO, ...SOBRE_CLARO,
      '--bg': '#e4ebf0', '--primary': '#2a6f9a', '--primary-bg': '#d6e8f5',
      '--cb-ocean': '#173f5f', '--cb-on-ocean': '#f3f7f8',
      '--cb-sky': '#9fcbef', '--cb-sky-ink': ON_TILE, '--cb-mint': '#9fdce0', '--cb-lemon': '#cfe3f5', '--cb-coral': '#8fc6d6', '--cb-on-tile': ON_TILE,
      '--cb-c1': '#2a6f9a', '--cb-c2': '#5f6d78', '--cb-c3': '#2f9a7e', '--cb-c4': '#df7659', '--cb-c5': '#cf9426', '--cb-c6': '#173f5f', '--cb-c7': '#4c5a65', '--cb-c8': '#14202a',
    },
    oscuro: {
      ...OSCURO_COLOR, ...ESTADO_OSCURO, ...SOBRE_CLARO,
      '--bg': '#0a1118', '--primary': '#79b6e3', '--primary-bg': '#79b6e326',
      '--cb-ocean': '#1e4c70', '--cb-on-ocean': '#f3f7f8',
      '--cb-sky': '#9fcbef', '--cb-sky-ink': ON_TILE, '--cb-mint': '#9fdce0', '--cb-lemon': '#cfe3f5', '--cb-coral': '#8fc6d6', '--cb-on-tile': ON_TILE,
      '--cb-c1': '#79b6e3', '--cb-c2': '#b8daf3', '--cb-c3': '#5fcaa8', '--cb-c4': '#f09a82', '--cb-c5': '#e7b552', '--cb-c6': '#9fcbef', '--cb-c7': '#9fdce0', '--cb-c8': '#8fc6d6',
    },
  },
  sage: {
    claro: {
      ...CLARO_COLOR, ...ESTADO_CLARO, ...SOBRE_CLARO,
      '--bg': '#e9ebe4', '--primary': '#2f6b4f', '--primary-bg': '#dcede3',
      '--cb-ocean': '#234a3a', '--cb-on-ocean': '#f3f7f8',
      '--cb-sky': '#bfe0c4', '--cb-sky-ink': ON_TILE, '--cb-mint': '#a9dcc6', '--cb-lemon': '#ece2a8', '--cb-coral': '#e9c9a7', '--cb-on-tile': ON_TILE,
      '--cb-c1': '#2f6b4f', '--cb-c2': '#5f6d78', '--cb-c3': '#5c9a3e', '--cb-c4': '#d0864f', '--cb-c5': '#c79a2a', '--cb-c6': '#234a3a', '--cb-c7': '#4c5a65', '--cb-c8': '#14202a',
    },
    oscuro: {
      ...OSCURO_COLOR, ...ESTADO_OSCURO, ...SOBRE_CLARO,
      '--bg': '#0c120f', '--primary': '#8fd1ad', '--primary-bg': '#8fd1ad26',
      '--cb-ocean': '#2a5845', '--cb-on-ocean': '#f3f7f8',
      '--cb-sky': '#bfe0c4', '--cb-sky-ink': ON_TILE, '--cb-mint': '#a9dcc6', '--cb-lemon': '#ece2a8', '--cb-coral': '#e9c9a7', '--cb-on-tile': ON_TILE,
      '--cb-c1': '#8fd1ad', '--cb-c2': '#c9e8d3', '--cb-c3': '#a6d36f', '--cb-c4': '#f0a576', '--cb-c5': '#e7c159', '--cb-c6': '#bfe0c4', '--cb-c7': '#a9dcc6', '--cb-c8': '#e9c9a7',
    },
  },
};

/**
 * Los ocho colores de serie de una paleta: variables, porque cambian entre claro y oscuro. El respaldo es el claro.
 * ⚠️ No son los cinco de la demo tal cual: los que no llegan a 2:1 sobre su superficie (el #c8c8c3 de Mono, el segundo de
 * cada paleta con color) se cambiaron por otro valor medido de la misma paleta, porque una serie que no se ve miente
 * (tests/graficos-modelo.test.ts). Y Salvia abre con su tercero: su verde de acento es casi el verde de «bueno».
 * ⚠️ EL ORDEN DE MONO NO ES EL DE LA DEMO, Y ES A PROPÓSITO: un anillo recorre la paleta por índice y con cuatro canales usa los
 * primeros cuatro, así que dos tonos vecinos dependen de cuántas series haya. Se buscó el orden que aguanta cada N de 2 a 6
 * (tests/graficos-corbel.test.ts). Con más de seis, los tonos se parecen: seis neutros es lo que se distingue.
 */
export const seriesDeEscena = (escena: EscenaCorbel): readonly string[] =>
  (escena === 'sage' ? [3, 1, 2, 4, 5, 6, 7, 8] : [1, 2, 3, 4, 5, 6, 7, 8]).map((n) => `var(--cb-c${n}, ${PALETAS_CORBEL[escena].claro[`--cb-c${n}`]})`);

/** El tile de un número en la hoja. */
export type TileCorbel = 'sky' | 'mint' | 'lemon' | 'coral';

const ORDEN_TILES: readonly TileCorbel[] = ['mint', 'lemon', 'coral'];

type PiezaConLugar = { id: string; x: number; y: number; esNumero: boolean; invertida?: boolean; portada?: unknown };

/**
 * QUÉ TILE LE TOCA A CADA NÚMERO, medido de Corbel: la fila de arriba abre con el negro (`invertida` si la plantilla eligió
 * uno; si no, el primero) y siguen blanco, gris y gris más oscuro. Sale de la POSICIÓN y no se guarda: las hojas que ya
 * existen lo traen sin migrar nada, y mover una tarjeta lo recalcula. Las filas de más abajo no llevan negro: dos anclas
 * en la pantalla no son jerarquía.
 */
export function tilesDeHoja(piezas: readonly PiezaConLugar[]): ReadonlyMap<string, TileCorbel> {
  const out = new Map<string, TileCorbel>();
  const numeros = piezas.filter((p) => p.esNumero && !p.portada);
  const ys = [...new Set(numeros.map((p) => p.y))].sort((a, b) => a - b);
  let i = 0;
  ys.forEach((y, fila) => {
    const deLaFila = numeros.filter((p) => p.y === y).sort((a, b) => a.x - b.x);
    const negro = fila === 0 ? deLaFila.find((p) => p.invertida) ?? deLaFila[0] : null;
    for (const p of deLaFila) out.set(p.id, p === negro ? 'sky' : ORDEN_TILES[i++ % ORDEN_TILES.length]);
  });
  return out;
}

const bloque = (t: Tokens): string => Object.entries(t).map(([k, v]) => `${k}:${v}`).join(';');
const mezcla = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;

/** Lo que adentro de un tile deja de ser de la hoja y pasa a ser de su color. */
const adentroDeTile = (tinta: string, rotulo: number): string => [
  // La línea de un número con tendencia es la primera serie: sin esto, negra sobre el tile negro (y clara sobre el claro, en oscuro).
  `--cb-c1:${tinta}`,
  `--ink:${tinta}`, `--dim:${mezcla(tinta, rotulo)}`, `--faint:${mezcla(tinta, rotulo)}`,
  `--border:${mezcla(tinta, 14)}`, `--border-strong:${mezcla(tinta, 26)}`, `--surface-2:${mezcla(tinta, 8)}`,
  `color:${tinta}`,
].join(';');

const PALETAS_CSS = (Object.keys(PALETAS_CORBEL) as EscenaCorbel[]).map((e) => (
  `[data-paleta="${e}"]{${bloque(PALETAS_CORBEL[e].claro)}}\nhtml[data-tema="oscuro"] [data-paleta="${e}"]{${bloque(PALETAS_CORBEL[e].oscuro)}}`
)).join('\n');

/**
 * La hoja de estilos: la pone quien monta el editor o la galería, DESPUÉS de la del editor. Cada número sale de
 * docs/diseno/tokens-corbel.json.
 */
export const CSS_CORBEL = `
${PALETAS_CSS}
[data-paleta]{font-size:14px;line-height:1.45}
[data-paleta] .lk-top-tit{font-weight:600;letter-spacing:-.025em}
@media (min-width:821px){[data-paleta] .lk-top-tit{font-size:37.44px;line-height:1.04}}
[data-paleta] .lk-comp{font-weight:500}
[data-paleta] .lk-comp-tit{line-height:21.75px}
[data-paleta] .lk-comp-sub{font-size:12.5px;font-weight:500;color:var(--faint)}
[data-paleta] .lk-comp--kpi{justify-content:space-between;gap:12px;padding:18px 20px 16px;box-shadow:none}
[data-paleta] .lk-comp--kpi .lk-comp-tit{font-size:12.5px;font-weight:600;line-height:18.125px;letter-spacing:normal;color:var(--dim);text-transform:none}
[data-paleta] .recharts-cartesian-axis-tick text{font-size:11px;fill:var(--faint)}
[data-paleta] .recharts-cartesian-grid line{stroke:var(--border)}
[data-paleta] .gr-numero,[data-paleta] .gr-kpi-valor{font-weight:600;letter-spacing:-.02em}
[data-paleta] [data-tile]{background:var(--cb-tile);border-color:transparent;--dash-tarjeta-fondo:var(--cb-tile);--gb-fondo:var(--cb-tile)}
[data-paleta] [data-tile="sky"]{--cb-tile:var(--cb-sky);--good:var(--cb-sky-good);--good-bg:var(--cb-sky-good-bg);--bad:var(--cb-sky-bad);--bad-bg:var(--cb-sky-bad-bg);${adentroDeTile('var(--cb-sky-ink)', 78)}}
[data-paleta] [data-tile="mint"]{--cb-tile:var(--cb-mint);${adentroDeTile('var(--cb-on-tile)', 76)}}
[data-paleta] [data-tile="lemon"]{--cb-tile:var(--cb-lemon);${adentroDeTile('var(--cb-on-tile)', 76)}}
[data-paleta] [data-tile="coral"]{--cb-tile:var(--cb-coral);${adentroDeTile('var(--cb-on-tile)', 76)}}
[data-paleta] .lk-comp--portada{--portada-fondo:var(--cb-ocean) !important;--portada-tinta:var(--cb-on-ocean) !important;border-radius:22px;padding:20px;gap:10px;box-shadow:none}
[data-paleta] .lk-comp--portada::before{display:none}
[data-paleta] .lk-comp--portada .lk-comp-tit,[data-paleta] .lk-comp--portada.lk-comp--kpi .lk-comp-tit,[data-paleta] .lk-comp--portada .gb-tit{font-size:15px;font-weight:600;letter-spacing:-.075px;line-height:21.75px;color:var(--portada-tinta)}
[data-paleta] .lk-comp--portada .lk-comp-sub{margin-top:0;font-size:12.5px;color:var(--dim)}
[data-paleta] .lk-comp--portada .gr-prop-val{font-size:34px;font-weight:600;letter-spacing:-1.19px;line-height:34px}
[data-paleta] .lk-comp--portada .gr-prop-val small{font-size:12.5px;font-weight:500}
[data-paleta] .lk-comp--portada .gr-prop-nom{font-size:12.5px;font-weight:600}
[data-paleta] .lk-comp--portada .gr-prop-barra{height:30px;border-radius:999px}
[data-paleta] .lk-comp--portada .gr-tarjeta{border-radius:14px}
[data-paleta] .lk-comp--portada .gr-tarjeta-val{font-size:20px;font-weight:600}
[data-paleta] .lk-comp--portada .gr-tabla td{font-size:13.5px;padding-top:9px;padding-bottom:9px}
[data-paleta] .lk-comp--portada .gr-tabla th{font-size:12px}
[data-paleta] .lk-comp--portada .gb-centro{justify-content:safe center;overflow-y:auto}
@media (max-width:820px){
[data-paleta] .lk-top-tit{font-size:28px;line-height:1.04}
[data-paleta] .lk-pila{gap:10px}
[data-paleta] .lk-pila>.lk-comp{padding:16px}
[data-paleta] .lk-pila>.lk-comp--kpi{padding:14px;gap:8px}
[data-paleta="mono"] .lk-pila>.lk-comp--kpi:not(.lk-comp--titular) .gr-numero-val{font-size:22px !important;line-height:1.1 !important}
}
`;
