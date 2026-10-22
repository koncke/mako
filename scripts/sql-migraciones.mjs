// =============================================================================
// sql-migraciones.mjs — leer el SQL de las migraciones: sin comentarios, en sentencias, con sus identificadores
// =============================================================================
// Lo comparten tests/migraciones-funciones-cerradas.test.ts (que las funciones nazcan cerradas) y scripts/verificar-migraciones-aplicadas.mjs (que lo que crean las migraciones exista en
// producción). Una sola copia: dos lectores de SQL distintos terminan diciendo cosas distintas de la misma migración.
//
// No es un parser de SQL: es un tokenizador que respeta lo que cambia dónde termina una sentencia (comillas simples, identificadores "entre comillas", cuerpos $$…$$, comentarios) y deja
// el resto como texto. Lo que se construye encima lee ese texto con expresiones regulares, sentencia por sentencia.
// =============================================================================

/**
 * El SQL sin comentarios (`--` y de bloque), sin tocar lo que va entre comillas simples ni entre $$ (el cuerpo de las funciones).
 * @param {string} sql
 * @returns {string}
 */
export function sinComentarios(sql) {
  let out = '';
  let i = 0;
  let enStr = false;
  /** @type {string | null} */
  let enDol = null;
  while (i < sql.length) {
    const c = sql[i];
    const c2 = sql.slice(i, i + 2);
    if (enDol) { if (sql.startsWith(enDol, i)) { out += enDol; i += enDol.length; enDol = null; } else { out += c; i++; } continue; }
    if (enStr) { out += c; if (c === "'" && sql[i + 1] === "'") { out += "'"; i += 2; continue; } if (c === "'") enStr = false; i++; continue; }
    if (c2 === '--') { while (i < sql.length && sql[i] !== '\n') i++; continue; }
    if (c2 === '/*') { const j = sql.indexOf('*/', i + 2); i = j < 0 ? sql.length : j + 2; continue; }
    if (c === "'") { enStr = true; out += c; i++; continue; }
    if (c === '$') { const m = /^\$[a-zA-Z_]*\$/.exec(sql.slice(i, i + 40)); if (m) { enDol = m[0]; out += m[0]; i += m[0].length; continue; } }
    out += c; i++;
  }
  return out;
}

/**
 * Parte un SQL (ya sin comentarios) en sentencias por los `;` de primer nivel: no corta dentro de comillas simples, identificadores "…" ni cuerpos $$…$$.
 * @param {string} sql
 * @returns {string[]}
 */
export function sentencias(sql) {
  /** @type {string[]} */
  const out = [];
  let ini = 0;
  let i = 0;
  let enStr = false;
  let enIdent = false;
  /** @type {string | null} */
  let enDol = null;
  while (i < sql.length) {
    const c = sql[i];
    if (enDol) { if (sql.startsWith(enDol, i)) { i += enDol.length; enDol = null; } else i++; continue; }
    if (enStr) { if (c === "'") { if (sql[i + 1] === "'") { i += 2; continue; } enStr = false; } i++; continue; }
    if (enIdent) { if (c === '"') { if (sql[i + 1] === '"') { i += 2; continue; } enIdent = false; } i++; continue; }
    if (c === "'") { enStr = true; i++; continue; }
    if (c === '"') { enIdent = true; i++; continue; }
    if (c === '$') { const m = /^\$[a-zA-Z_]*\$/.exec(sql.slice(i, i + 40)); if (m) { enDol = m[0]; i += m[0].length; continue; } }
    if (c === ';') { out.push(sql.slice(ini, i)); ini = i + 1; }
    i++;
  }
  out.push(sql.slice(ini));
  return out.map((s) => s.trim()).filter(Boolean);
}

/**
 * Parte `texto` por `sep` en el primer nivel (fuera de paréntesis, corchetes y comillas).
 * @param {string} texto
 * @param {string} sep
 * @returns {string[]}
 */
export function partirPrimerNivel(texto, sep) {
  /** @type {string[]} */
  const partes = [];
  let prof = 0;
  let enStr = false;
  let enIdent = false;
  let ini = 0;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enStr) { if (c === "'") enStr = false; continue; }
    if (enIdent) { if (c === '"') enIdent = false; continue; }
    if (c === "'") enStr = true;
    else if (c === '"') enIdent = true;
    else if (c === '(' || c === '[') prof++;
    else if (c === ')' || c === ']') prof--;
    else if (c === sep && prof === 0) { partes.push(texto.slice(ini, i)); ini = i + 1; }
  }
  partes.push(texto.slice(ini));
  return partes.map((p) => p.trim()).filter(Boolean);
}

/**
 * El índice del `)` que cierra el `(` de `ini`, sin contar los paréntesis que están entre comillas simples o "identificadores" (`default ')'` no cierra nada). -1 si no cierra. Puro.
 * @param {string} texto
 * @param {number} ini posición del `(`
 * @returns {number}
 */
export function cierreDeParentesis(texto, ini) {
  let prof = 0;
  let enStr = false;
  let enIdent = false;
  for (let i = ini; i < texto.length; i++) {
    const c = texto[i];
    if (enStr) { if (c === "'") enStr = false; continue; }
    if (enIdent) { if (c === '"') enIdent = false; continue; }
    if (c === "'") enStr = true;
    else if (c === '"') enIdent = true;
    else if (c === '(') prof++;
    else if (c === ')') { prof--; if (prof === 0) return i; }
  }
  return -1;
}

/** Un identificador (con o sin comillas) y un nombre calificado `esquema.nombre` (los dos grupos de captura son esquema y nombre). */
export const ID = '(?:"(?:[^"]|"")+"|[a-zA-Z_][a-zA-Z0-9_$]*)';
export const QNAME = `(?:(${ID})\\s*\\.\\s*)?(${ID})`;

/**
 * El identificador en su forma canónica: sin comillas y tal cual si venía entre comillas, en minúsculas si no (así lo guarda Postgres).
 * @param {string} s
 * @returns {string}
 */
export const ident = (s) => (s.startsWith('"') ? s.slice(1, -1).replace(/""/g, '"') : s.toLowerCase());
