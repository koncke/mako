// =============================================================================
// editor-landing/css-usado — la hoja de una página publicada, sólo con lo que la página usa (12/11/2026)
// =============================================================================
// Medido ese día en producción (hola-mako.site/app-o-software, una plantilla simple): 224 KB de HTML, de los que 186 KB eran la
// hoja ENTERA del editor (CSS_CONTENIDO: todos los bloques, todos los diseños, todas las variantes) en un <style>. En un teléfono
// con 4G lenta y CPU ×4, el primer pintado tardaba 3,9 s contra 1,2 s de la original que se replicó: el navegador tiene que leer
// y aplicar toda la hoja antes de pintar. El Cerebro: «sólo el CSS que usa».
//
// La regla, CONSERVADORA (ante la duda, la regla queda: una regla de más pesa, una de menos rompe la página):
//   · una regla se va sólo si TODOS sus selectores piden algo que la página no tiene: una clase que no aparece (en el HTML ni en
//     sus scripts: los scripts prenden `gm-anim`, `gm-visto`, `gm-formulario-exito`…, y sus nombres están en el texto), o un
//     `[data-x="valor"]` que el HTML no trae y que ningún script escribe;
//   · lo de adentro de `:not(…)`, `:is(…)`, `:where(…)` y `:has(…)` no se exige (un `:not(.x)` justamente vale sin `.x`), ni un
//     atributo con otro operador (`^=`, `*=`, `~=`…) o sin valor;
//   · `@media`, `@supports`, `@container` y `@layer` se recorren por dentro y se van si quedan vacíos;
//   · `@keyframes`, `@font-face`, `@property`, `@import`, `@charset` y lo que no se entiende, quedan enteros.
// Puro, sin dependencias: lo usa pagina-publica.ts al armar el documento.
// =============================================================================

/** Lo que la página usa: sus clases, sus pares `data-x=valor` y los `data-x` que un script puede escribir (no se exigen). */
export type Usadas = { clases: Set<string>; atributos: Set<string>; dePorScript: Set<string> };

const scriptsDe = (corpus: string): string[] =>
  [...String(corpus ?? '').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);

/** Las clases que la página puede tener: las de sus `class="…"` y cualquier palabra de sus scripts (liberal a propósito). */
export function clasesUsadas(corpus: string): Set<string> {
  const out = new Set<string>();
  for (const m of String(corpus ?? '').matchAll(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    for (const c of (m[1] ?? m[2] ?? '').split(/\s+/)) if (c) out.add(c);
  }
  for (const sc of scriptsDe(corpus)) for (const w of sc.match(/[A-Za-z_][\w-]*/g) ?? []) out.add(w);
  return out;
}

/**
 * Todo lo usado. Los ATRIBUTOS (medido en la publicada de una plantilla: de 157 KB que quedaban con las clases, 61 eran de
 * `[data-anim="…"]`, 41 de `[data-variante="…"]` y 10 de `[data-dispositivo="…"]`, que es del editor): se anotan los pares
 * `data-x=valor` del HTML, y un `data-x` que algún script ESCRIBE (`setAttribute('data-x'`, `dataset.x =`) no se exige.
 */
export function usadasDe(corpus: string): Usadas {
  const atributos = new Set<string>();
  for (const m of String(corpus ?? '').matchAll(/\s(data-[\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi)) {
    atributos.add(`${m[1].toLowerCase()}=${m[2] ?? m[3] ?? m[4] ?? ''}`);
  }
  const dePorScript = new Set<string>();
  for (const sc of scriptsDe(corpus)) {
    for (const m of sc.matchAll(/setAttribute\(\s*['"](data-[\w-]+)['"]/g)) dePorScript.add(m[1].toLowerCase());
    for (const m of sc.matchAll(/dataset\.([A-Za-z_]\w*)\s*=(?!=)/g)) dePorScript.add(`data-${m[1].replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`);
    for (const m of sc.matchAll(/dataset\[\s*['"]([\w-]+)['"]\s*\]\s*=(?!=)/g)) dePorScript.add(`data-${m[1].toLowerCase()}`);
  }
  return { clases: clasesUsadas(corpus), atributos, dePorScript };
}

/** El selector sin lo que no se exige: lo de adentro de :not/:is/:where/:has (con paréntesis anidados). */
function sinLoOpcional(sel: string): string {
  let s = sel;
  for (let vueltas = 0; vueltas < 10; vueltas++) {
    const m = /:(?:not|is|where|has|matches|-webkit-any)\(/i.exec(s);
    if (!m) break;
    let nivel = 0;
    let fin = -1;
    for (let i = m.index + m[0].length - 1; i < s.length; i++) {
      if (s[i] === '(') nivel++;
      else if (s[i] === ')' && --nivel === 0) { fin = i; break; }
    }
    if (fin < 0) break;
    s = s.slice(0, m.index) + s.slice(fin + 1);
  }
  return s;
}

/** Los selectores de una lista, separados por las comas de afuera (no las de un :is(a, b) ni las de un [x="a,b"]). */
function porComas(lista: string): string[] {
  const out: string[] = [];
  let nivel = 0;
  let desde = 0;
  for (let i = 0; i < lista.length; i++) {
    const c = lista[i];
    if (c === '(' || c === '[') nivel++;
    else if (c === ')' || c === ']') nivel = Math.max(0, nivel - 1);
    else if (c === ',' && nivel === 0) { out.push(lista.slice(desde, i)); desde = i + 1; }
  }
  out.push(lista.slice(desde));
  return out.map((x) => x.trim()).filter(Boolean);
}

/** Lo que pide un selector, fuera de lo opcional: sus clases y sus pares `[data-x="v"]` (sólo con `=`). */
export function loQuePide(sel: string): { clases: string[]; pares: string[] } {
  const s = sinLoOpcional(sel);
  const pares: string[] = [];
  for (const m of s.matchAll(/\[\s*(data-[\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]+))\s*(?:[is]\s*)?\]/gi)) {
    pares.push(`${m[1].toLowerCase()}=${m[2] ?? m[3] ?? m[4] ?? ''}`);
  }
  const sinAtributos = s.replace(/\[[^\]]*\]/g, '');
  const clases = [...sinAtributos.matchAll(/\.((?:\\.|[\w-])+)/g)].map((m) => m[1].replace(/\\(.)/g, '$1'));
  return { clases, pares };
}

/** ¿Algún selector de la lista puede aplicar con lo que la página usa? (Con un Set, sólo las clases.) */
export function selectorUsado(lista: string, usadas: ReadonlySet<string> | Usadas): boolean {
  const soloClases = usadas instanceof Set;
  const clases = soloClases ? (usadas as ReadonlySet<string>) : (usadas as Usadas).clases;
  return porComas(lista).some((sel) => {
    const pide = loQuePide(sel);
    if (!pide.clases.every((c) => clases.has(c))) return false;
    if (soloClases) return true;
    const u = usadas as Usadas;
    return pide.pares.every((par) => u.atributos.has(par) || u.dePorScript.has(par.slice(0, par.indexOf('='))));
  });
}

/** El índice del `}` que cierra el bloque que abre en `abre` (saltando comentarios y textos entre comillas); -1 si no cierra. */
function cierre(css: string, abre: number): number {
  let nivel = 0;
  for (let i = abre; i < css.length; i++) {
    const c = css[i];
    if (c === '/' && css[i + 1] === '*') { const f = css.indexOf('*/', i + 2); if (f < 0) return -1; i = f + 1; continue; }
    if (c === '"' || c === "'") {
      for (i++; i < css.length && css[i] !== c; i++) if (css[i] === '\\') i++;
      continue;
    }
    if (c === '{') nivel++;
    else if (c === '}' && --nivel === 0) return i;
  }
  return -1;
}

const AT_POR_DENTRO = /^@(?:media|supports|container|layer|document)\b/i;

/** La hoja sin las reglas que no aplican a nada de lo usado (ver la cabecera). Si algo no se entiende, va tal cual. */
export function podarCss(css: string, usadas: ReadonlySet<string> | Usadas): string {
  const out: string[] = [];
  let i = 0;
  const n = css.length;
  while (i < n) {
    // Comentarios y espacios sueltos entre reglas: fuera.
    if (css[i] === '/' && css[i + 1] === '*') { const f = css.indexOf('*/', i + 2); i = f < 0 ? n : f + 2; continue; }
    if (/\s/.test(css[i])) { i++; continue; }
    const llave = css.indexOf('{', i);
    const punto = css.indexOf(';', i);
    // Un at-rule sin bloque (`@import …;`, `@charset …;`, `@layer a, b;`): queda.
    if (css[i] === '@' && punto >= 0 && (llave < 0 || punto < llave)) { out.push(css.slice(i, punto + 1)); i = punto + 1; continue; }
    if (llave < 0) { out.push(css.slice(i)); break; }
    const fin = cierre(css, llave);
    if (fin < 0) { out.push(css.slice(i)); break; }
    const prelude = css.slice(i, llave).trim();
    const cuerpo = css.slice(llave + 1, fin);
    if (prelude.startsWith('@')) {
      if (AT_POR_DENTRO.test(prelude) && cuerpo.includes('{')) {
        const adentro = podarCss(cuerpo, usadas);
        if (adentro.trim()) out.push(`${prelude}{${adentro}}`);
      } else {
        out.push(`${prelude}{${cuerpo}}`);
      }
    } else if (selectorUsado(prelude, usadas)) {
      out.push(`${prelude}{${cuerpo}}`);
    }
    i = fin + 1;
  }
  return out.join('\n');
}
