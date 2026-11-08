// Los parsers de `prompts-registro-sincronizado.mjs`, afuera para que un test los pueda
// ROMPER. Viven acá y no adentro de la guarda porque la guarda es un CLI que corre al
// importarse y termina en `process.exit`: nadie la puede importar para probarla.
//
// CADA función de este archivo tuvo un bug que daba FALSO VERDE o SILENCIO el 6/11/2026,
// y `tests/guarda-registro-prompts.test.ts` reproduce esos casos. Si alguien "simplifica"
// uno de estos parsers el test se pone rojo; sin el test, la guarda seguía en verde
// midiendo NADA, que es exactamente la falla que ella existe para cazar.
// Son puras a propósito: ninguna lee el disco ni git. `resolverIndirecto` recibe las
// fuentes por parámetro — cerraba sobre un Map del módulo y así no se podía probar.

/** Los `{{slot}}` de un texto, sin repetidos y ordenados. */
export const slotsDe = (s) => [...new Set([...String(s ?? '').matchAll(/\{\{(\w+)\}\}/g)].map((x) => x[1]))].sort();

/** Si el fuente escribe esa key como literal, en cualquiera de los tres comillados. */
export const nombraLiteral = (src, key) => src.includes(`'${key}'`) || src.includes(`"${key}"`) || src.includes(`\`${key}\``);

/** Corta el objeto literal que empieza en `i` balanceando llaves. */
export function objetoEn(src, i) {
  let d = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (!d) return src.slice(i, j + 1); }
  }
  return null;
}

/**
 * Las claves de NIVEL 1 del objeto de vars. Acepta `k: v` Y el shorthand `{ titulo,
 * contexto }` — un parser que sólo busca `k:` no ve el shorthand, lee "no pasa ninguna
 * clave" y deja pasar todo en silencio (así di 0 en la primera medición del 6/11/2026).
 * Un spread o una clave computada devuelve '…': el objeto no es medible.
 */
export function clavesDeVars(obj) {
  const out = [];
  let d = 0, buf = '';
  const cerrar = () => {
    const t = buf.trim(); buf = '';
    if (!t) return;
    if (t.startsWith('...') || t.startsWith('[')) { out.push('…'); return; }
    const c = t.match(/^['"`]?([A-Za-z_$][\w$]*)['"`]?\s*(?::|$)/);
    out.push(c ? c[1] : '…');
  };
  for (const ch of obj.slice(1, -1)) {
    if ('{[('.includes(ch)) d++;
    else if ('}])'.includes(ch)) d--;
    if (ch === ',' && d === 0) { cerrar(); continue; }
    buf += ch;
  }
  cerrar();
  return [...new Set(out)];
}

// Las dos formas de indirección del repo, y las dos dejan el literal escrito:
//   · tabla:     `export const PROMPTS_X = { campo: { key: '…' } }` → `PROMPTS_X.campo.key`
//   · constante: `export const CLAVE_X = '…'`                       → `CLAVE_X`
// Se resuelve SÓLO lo que aparece de verdad como primer argumento, buscando su
// declaración. Barrer a ciegas todas las constantes de nombre parecido traía keys de
// OTROS dominios (`app_settings`: `recorridos`, `resend_reply_to`, `vigia.paneles`…) y
// las contaba como prompts huérfanos: 60 falsos positivos (6/11/2026).
export function resolverIndirecto(arg, fuentes) {
  const tabla = arg.match(/^(PROMPTS_[A-Za-z_]+)\.(\w+)\.key$/);
  if (tabla) {
    for (const [, src] of fuentes) {
      const i = src.search(new RegExp(`\\bconst ${tabla[1]}\\s*=\\s*\\{`));
      if (i < 0) continue;
      const obj = objetoEn(src, src.indexOf('{', i));
      const campo = obj?.match(new RegExp(`\\b${tabla[2]}:\\s*\\{[^}]*?\\bkey:\\s*['"]([\\w.\\-]+)['"]`));
      if (campo) return campo[1];
    }
    return null;
  }
  if (!/^[A-Z][A-Z0-9_]*$/.test(arg)) return null;
  for (const [, src] of fuentes) {
    const c = src.match(new RegExp(`\\bconst ${arg}\\s*(?::\\s*\\w+\\s*)?=\\s*['"]([\\w.\\-]+)['"]`));
    if (c) return c[1];
  }
  return null;
}

/**
 * Los argumentos de NIVEL 1 de la llamada que abre en `i`, balanceando `( [ {`. Un regex
 * con `[^,]*?` no sirve: un argumento que contenga una coma (`renderPrompt(elegir(a, b),
 * …)`, o un objeto de vars con dos claves) hace que la llamada no matchee y no se vea EN
 * ABSOLUTO — un silencio, que es peor que un aviso.
 */
export function argumentosDe(src, i) {
  const out = [];
  let d = 0, desde = i + 1;
  for (let j = i; j < src.length; j++) {
    const ch = src[j];
    if ('([{'.includes(ch)) d++;
    else if (')]}'.includes(ch)) {
      d--;
      if (d === 0) { out.push(src.slice(desde, j).trim()); return out; }
    } else if (ch === ',' && d === 1) { out.push(src.slice(desde, j).trim()); desde = j + 1; }
  }
  return null;   // la llamada no cierra
}

// Las bitácoras de /admin/dev son DOCUMENTACIÓN escrita en `.ts`, y varias nombran
// `renderPrompt(…)` dentro de un string: leídas como call-sites dan una key opaca que no
// existe. Se saltean sólo acá, no en el barrido de literales de más abajo — medido el
// 6/11/2026: entradas del registro que sólo una bitácora nombra, 0, así que no tapan nada.
export const esBitacora = (f) => /(^|\/)bitacora\.ts$/.test(f);
