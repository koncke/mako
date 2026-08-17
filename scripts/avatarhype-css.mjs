// Pasa los estilos de los documentos del origen a public/cono-doc/ugc.css, con el
// scope de NUESTRO contenedor.
//
// ── Por qué se copia el CSS y no se reescribe a mano ─────────────────────────
// El HTML replicado trae las clases del origen, y ahí vive el significado: qué parte
// de un prompt es la cámara y cuál el guion son `.ugc-clip-part.camara` y `.guion`.
// Sin sus reglas, el documento es una lista de texto plano y se pierde justo eso.
//
// ── Por qué una hoja aparte y no el bundle ──────────────────────────────────
// Son ~70 KB que solo hacen falta cuando alguien ABRE el material de una clase. Se
// carga con un <link> en ese momento, igual que el documento mismo.
//
// ⚠️ TODO se rescopea a `.ahdoc`. El origen usa `.ahc`, que es un nombre corto y
//    ajeno: pegado tal cual en nuestro CSS global, una clase suya que coincida con
//    una nuestra se pisan sin que nada avise, y el síntoma aparece en otra pantalla.
//
//   node <abs>\scripts\avatarhype-css.mjs --css <ugc.css capturado>
//
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const ENTRADA = arg('css', '');
const REPO = arg('repo', 'C:\\Users\\marti\\OneDrive\\Escritorio\\dashboard-marketing-main\\dashboard-marketing');
const SALIDA = join(REPO, 'public', 'cono-doc', 'ugc.css');

if (!ENTRADA) { console.error('\n  ✖ Falta --css <archivo capturado>\n'); process.exit(1); }
const crudo = readFileSync(ENTRADA, 'utf8');

// Un selector por vez: hay reglas con varios separados por coma, y prefijar la lista
// entera («.ahdoc a, b») dejaría el segundo sin scope — que es como se escapa el CSS.
//
// ⚠️ `html`/`body`/`:root` SE REEMPLAZAN, NO SE COLAPSAN. La primera versión devolvía
//    `.ahdoc` para cualquier selector que EMPEZARA con esos, tirando el resto: un
//    `body .algo-oculto { display:none }` quedó como `.ahdoc { display:none }` y
//    escondió el curso entero. La pantalla salía en blanco con el DOM completo —33
//    tarjetas montadas— porque el contenedor raíz estaba en `display:none`.
const rescope = (sel) => sel.split(',').map((s) => {
  const t = s.trim();
  if (!t) return t;
  if (t === '.ahc' || t === ':root' || t === 'html' || t === 'body') return '.ahdoc';
  if (t.startsWith('.ahc ')) return `.ahdoc ${t.slice(5)}`;
  const m = /^(?::root|html|body)\b(.*)$/.exec(t);
  if (m) return `.ahdoc${m[1]}`;          // «body .x» → «.ahdoc .x», no «.ahdoc»
  return `.ahdoc ${t}`;
}).join(', ');

// ⚠️ SE PROCESA REGLA POR REGLA, NO CON UN REEMPLAZO GLOBAL. El archivo capturado
//    trae un `cssText` por línea, así que cada línea es una regla completa. La versión
//    anterior barría el texto entero con un regex y le pegaba el prefijo al `@media`
//    («.ahdoc @media (max-width: 1000px) {»), que no es CSS válido: el navegador tira
//    el bloque entero y con él todo el responsive.
let reglas = 0;
const salida = crudo.split('\n').map((linea) => {
  const l = linea.trim();
  if (!l) return '';
  // Un at-rule con bloque (@media, @supports): se rescopean los selectores de ADENTRO.
  const at = /^(@(?:media|supports|layer|container)[^{]*)\{([\s\S]*)\}$/.exec(l);
  if (at) {
    const dentro = at[2].replace(/([^{}]+)\{([^{}]*)\}/g, (todo, sel, cuerpo) => {
      reglas++;
      return `${rescope(sel)} {${cuerpo}}`;
    });
    return `${at[1]}{${dentro}}`;
  }
  // @font-face y @keyframes no llevan selector de scope: van tal cual.
  if (l.startsWith('@')) return l;
  const r = /^([^{]+)\{([\s\S]*)\}$/.exec(l);
  if (!r) return l;
  reglas++;
  return `${rescope(r[1])} {${r[2]}}`;
}).join('\n');

mkdirSync(join(REPO, 'public', 'cono-doc'), { recursive: true });
const cabecera = `/* Estilos del material de las clases de Avatar Hype.
 * GENERADO por scripts/avatarhype-css.mjs desde la hoja del origen.
 * Todo va scopeado a .ahdoc: las clases del origen (.ugc-*, .ac-*) son suyas y
 * pegarlas en el CSS global las haría chocar con las nuestras en otras pantallas.
 * Se carga con un <link> al abrir el material, no en el bundle. */\n\n`;
writeFileSync(SALIDA, cabecera + salida, 'utf8');
console.log(`\n  reglas rescopeadas: ${reglas}`);
console.log(`  → ${SALIDA}  (${Math.round((cabecera + salida).length / 1024)} KB)\n`);
