// =============================================================================
// Ningún botón de la app está muerto
// =============================================================================
// Martín, 2/11/2026, después de mostrárselo a Emilio en la staff: «siempre quiero poder apretar
// en todos los botones, que anden todos los botones». Un botón que se ve apretable y no hace nada
// es peor que no tenerlo: en una demo se aprieta, y el que mira concluye que la app está rota.
//
// ⚠️ LA PRIMERA PASADA DE ESTE BARRIDO DEVOLVIÓ 74 BOTONES Y SETENTA Y TRES ERAN MENTIRA. De dónde
// salían, porque es lo que hay que saber antes de tocar este guard:
//
//   1. **El `<button>` dibujado en un comentario de documentación.** Casi todo componente base
//      tiene uno. Por eso acá los comentarios se BLANQUEAN (se reemplazan por espacios, no se
//      borran: así las líneas no se corren y el error sigue señalando la línea de verdad).
//   2. **El disparador que recibe su handler del envoltorio.** `<DropdownMenuTrigger asChild>` y
//      `<PopoverTrigger asChild>` de Radix clonan al hijo y le meten el `onClick`; nuestro
//      `<Tooltip>` (app/_ui/Tooltip.tsx) pone `onMouseEnter` y `onFocus` en su propio span. El
//      botón de adentro no tiene nada y anda igual. Por eso se mira lo que viene ANTES.
//   3. **El `disabled` de adentro de una expresión.** `disabled={disabled || loading}` y
//      `cursor: disabled ? …` tienen la palabra pero no son un botón apagado a mano. Por eso se
//      le sacan las llaves al tag antes de mirar.
//   4. **El primitivo que esparce las props del padre** (`{...rest}`): el `onClick` llega por ahí.
//
//   5. **El botón de una página SIN React** (el sitio, app/vsl/_sitio: se dibuja en el servidor y no se hidrata). Ahí un
//      `onClick` no correría nunca: lo maneja un script de la página por delegación (las flechas del carrusel de tableros, el
//      sonido de AI Avatar). Pasa si el botón lleva `data-por-script` Y el mismo archivo registra el clic
//      (`addEventListener('click'`): un `data-por-script` sin script que escuche sigue siendo un botón muerto.
//
// Y una cosa que NO es un botón muerto: uno apagado A PROPÓSITO que dice por qué (un `title` o un
// `aria-label`). Ése no está muerto, está esperando algo, y el usuario lo sabe.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const CARPETAS = ['app', 'components'];
const SALTAR = new Set(['node_modules', '.next', '.git', 'dist', 'build', '__tests__']);

/**
 * Los que SÍ pasan, con el porqué. Una excepción nueva se agrega con su motivo o no se agrega:
 * una lista sin motivos es una lista que crece sola.
 */
const PERDONADOS: ReadonlyArray<{ archivo: string; texto: string; porque: string }> = [
  {
    archivo: 'app/_components/Lienzo.tsx',
    texto: 'Cancelar',
    porque: 'El modo «conectar a una tarjeta» escucha `pointerdown` en CAPTURA sobre window y se lo '
      + 'traga antes de que llegue al botón (mismo archivo, el efecto de `eligiendo`). Un `onClick` '
      + 'acá sería código muerto: nunca correría. El botón es la etiqueta de ese gesto.',
  },
  {
    archivo: 'app/admin/_polar/web/DashboardOverview/MetricSelectorModal.tsx',
    texto: 'DragHandleOutlined',
    porque: 'El asa de arrastre de «Customize» (copiada de Polar): `ref={handleRef}` de `useSortable` (@dnd-kit/react) le '
      + 'engancha los sensores del puntero y del teclado al botón. Se arrastra o se mueve con las flechas; un `onClick` no '
      + 'tendría nada que hacer.',
  },
];

const blanquear = (t: string): string => t.replace(/[^\n]/g, ' ');
/** El fuente sin comentarios, con las líneas en su lugar. */
const sinComentarios = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, blanquear).replace(/^[ \t]*\/\/.*$/gm, blanquear);

/**
 * El tag sin sus expresiones `{…}`, por anidadas que estén.
 *
 * ⚠️ LO QUE SE PONE EN LUGAR DE LA EXPRESIÓN NO PUEDE TENER LLAVES. La primera versión dejaba
 * `{}`, que vuelve a matchear contra sí mismo: el bucle corta en la segunda vuelta creyendo que
 * ya no cambia nada, y un `style={{ … cursor: disabled ? … }}` queda sin colapsar. Así es como
 * `app/agencia/FlujoAviso.tsx` aparecía como «apagado a mano» teniendo `disabled={disabled}`.
 */
function sinLlaves(tag: string): string {
  let antes = tag;
  for (let i = 0; i < 12; i += 1) {
    const ahora = antes.replace(/\{[^{}]*\}/g, ' ');
    if (ahora === antes) return ahora;
    antes = ahora;
  }
  return antes;
}

/** Cada `<nombre …>` del fuente, con su línea. Cuenta llaves para encontrar el `>` de verdad. */
function etiquetas(src: string, nombre: string): Array<{ linea: number; inicio: number; tag: string }> {
  const fuera: Array<{ linea: number; inicio: number; tag: string }> = [];
  const re = new RegExp(`<${nombre}(?=[\\s/>])`, 'g');
  for (let m = re.exec(src); m; m = re.exec(src)) {
    let i = m.index + m[0].length;
    let prof = 0;
    while (i < src.length) {
      const ch = src[i];
      if (ch === '{') prof += 1;
      else if (ch === '}') prof -= 1;
      else if (ch === '>' && prof === 0) break;
      i += 1;
    }
    fuera.push({
      linea: src.slice(0, m.index).split('\n').length,
      inicio: m.index,
      tag: src.slice(m.index, i + 1),
    });
  }
  return fuera;
}

const ENVOLTORIO = /asChild|<Tooltip[\s>]|<TooltipTrigger|<PopoverTrigger|<Slot[\s>]/;
const HANDLER_VACIO = /onClick=\{\s*\(\s*\)\s*=>\s*(\{\s*\}|undefined|null|void 0)\s*\}/;
const HANDLER_NOOP = /onClick=\{\s*(noop|nada|vacio|undefined)\s*\}/;
/** `disabled` a secas, sobre el tag ya pelado. `disabled={true}` se mira aparte, sobre el original. */
const APAGADO = /(?:^|\s)disabled(?=[\s/>])/;
const APAGADO_TRUE = /(?:^|\s)disabled\s*=\s*\{\s*true\s*\}/;

function porQueEstaMuerto(tag: string, antes: string, conScript = false): string | null {
  if (HANDLER_VACIO.test(tag) || HANDLER_NOOP.test(tag)) return 'su onClick no hace nada';
  const pelado = sinLlaves(tag);
  const apagado = APAGADO.test(pelado) || APAGADO_TRUE.test(tag);
  // Apagado a propósito Y con el porqué a la vista: ése no está muerto, está esperando algo.
  if (apagado && (tag.includes('title=') || tag.includes('aria-label') || tag.includes('aria-disabled'))) return null;
  const tiene = tag.includes('onClick') || tag.includes('type="submit"') || tag.includes('form=')
    || tag.includes('onPointerDown') || tag.includes('onMouseDown') || tag.includes('onKeyDown')
    // `onFocus` solo también alcanza: en el celular el tap da foco, así que el botón responde.
    || tag.includes('onFocus') || tag.includes('{...')
    || ENVOLTORIO.test(antes)
    // Regla 5: lo maneja el script de la página (y el archivo lo tiene).
    || (tag.includes('data-por-script') && conScript);
  if (!tiene) return 'no tiene onClick, ni es submit, ni lo envuelve un disparador';
  if (apagado) return 'está apagado a mano y no dice por qué (sin title ni aria-label)';
  return null;
}

function archivos(dir: string, fuera: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    if (SALTAR.has(n)) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) archivos(p, fuera);
    else if (p.endsWith('.tsx') || p.endsWith('.jsx')) fuera.push(p);
  }
  return fuera;
}

test('ningún botón de la app está muerto', () => {
  const todos: string[] = [];
  for (const c of CARPETAS) {
    try { archivos(join(RAIZ, c), todos); } catch { /* la carpeta puede no existir */ }
  }
  assert.ok(todos.length > 200, `el guard sólo encontró ${todos.length} componentes: no está mirando la app`);

  const muertos: string[] = [];
  let mirados = 0;
  for (const ruta of todos) {
    const rel = ruta.slice(RAIZ.length).replace(/\\/g, '/');
    const src = sinComentarios(readFileSync(ruta, 'utf8').replace(/\r\n/g, '\n'));
    const conScript = src.includes("addEventListener('click'");
    for (const { linea, inicio, tag } of etiquetas(src, 'button')) {
      mirados += 1;
      const motivo = porQueEstaMuerto(tag, src.slice(Math.max(0, inicio - 320), inicio), conScript);
      if (!motivo) continue;
      // El texto del botón para reconocerlo: lo que sigue al tag hasta el cierre.
      const cuerpo = src.slice(inicio + tag.length, inicio + tag.length + 160);
      const perdonado = PERDONADOS.some((p) => rel === p.archivo && cuerpo.includes(p.texto));
      if (!perdonado) muertos.push(`${rel}:${linea} — ${motivo}`);
    }
  }
  assert.ok(mirados > 400, `el guard sólo vio ${mirados} botones: la lectura de etiquetas se rompió`);
  assert.deepEqual(muertos, [],
    'hay botones que se ven apretables y no hacen nada. O le das un onClick, o lo apagas con un '
    + `title que diga por qué, o lo sacas:\n  ${muertos.join('\n  ')}`);
});
