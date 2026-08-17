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
// ⚠️ LAS CLASES `__variable_*` VAN AL CONTENEDOR, NO ADENTRO. Son las que definen
//    `--font-bricolage`, `--font-archivo`… y en el origen viven en el MISMO div que
//    `.ahc`. Prefijarlas («.ahdoc .__variable_a4bae9») las deja apuntando a un
//    elemento que no existe acá, y las 440 referencias a `--font-*` se resuelven en
//    vacío: el navegador cae a la fuente por defecto y la tipografía no se parece.
const rescope = (sel) => sel.split(',').map((s) => {
  const t = s.trim();
  if (!t) return t;
  if (t === '.ahc' || t === ':root' || t === 'html' || t === 'body') return '.ahdoc';
  if (/^\.__variable_\w+$/.test(t)) return '.ahdoc';
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
// Las 7 familias que usa el origen. Sus `@font-face` apuntan a los archivos que Next
// self-hostea en SU dominio, así que no sirven acá: se piden a Google, que es de donde
// salieron. Sin esto quedan las variables definidas apuntando a fuentes que el
// navegador no tiene, y cae a la de sistema — la pantalla «se parece» y no es.
const FUENTES = 'https://fonts.googleapis.com/css2'
  + '?family=Bricolage+Grotesque:opsz,wght@12..96,200..800'
  + '&family=Hanken+Grotesk:wght@300..900'
  + '&family=Instrument+Serif:ital@0;1'
  + '&family=Caveat:wght@400..700'
  + '&family=Spline+Sans+Mono:wght@300..700'
  + '&family=Archivo:wght@100..900'
  + '&family=JetBrains+Mono:wght@100..800'
  + '&display=swap';

const cabecera = `/* Estilos del material de las clases de Avatar Hype.
 * GENERADO por scripts/avatarhype-css.mjs desde la hoja del origen.
 * Todo va scopeado a .ahdoc: las clases del origen (.ugc-*, .ac-*) son suyas y
 * pegarlas en el CSS global las haría chocar con las nuestras en otras pantallas.
 * Se carga con un <link> al abrir el material, no en el bundle.
 *
 * ATENCION: el contenedor tiene que ser <div class="ahdoc"><div class="ugc">.
 * 593 de las reglas estan escritas bajo .ugc y solo 5 aplican sin el; sin ese div
 * en el medio el CSS no matchea y la pantalla queda con el contenido crudo apilado. */
@import url('${FUENTES}');

/* ── Lo único escrito a mano, y por qué ──────────────────────────────────────
 * El origen ocupa la ventana entera; acá el curso vive DENTRO del contenedor del
 * portal, que está topeado. El shell del origen mide 1536 y su caja 984, así que se
 * desbordaba y el panel del documento quedaba CORTADO a la derecha.
 *
 * ⚠️ NO se arregla ensanchando el contenedor. Se probó con el
 * width:100vw + margin-left:calc(50% - 50vw) de siempre y quedó PEOR: la barra se
 * fue a x = -284, o sea fuera de la pantalla. El contenedor ya se salía por su
 * cuenta —heredaba reglas de body del origen— y el truco lo corrió una segunda
 * vez. Dos correcciones del mismo ancho se suman.
 *
 * Lo correcto es al revés: que el shell se ADAPTE a su caja. El layout del origen es
 * fluido (flex con una columna fija de 262 px), así que con el ancho al 100% entra
 * en cualquier contenedor sin cortar nada. */
/* ⚠️ ESTAS VAN AL FINAL Y CON !important, y no es pereza: las reglas del origen son
 * más específicas (.ahdoc .ugc .ugc-main, tres clases) que cualquier cosa razonable
 * que se escriba acá, así que sin esto el shell sigue midiendo 1274 dentro de una caja
 * de 984 y el panel del documento queda cortado a la derecha. Medido. */
/* ⚠️ EL DESBORDE VIENE DEL PROPIO ORIGEN, NO DE ACÁ. Su regla dice
 *   .ugc-shell { margin: -26px calc(50% - 50vw) -90px; min-height: calc(100vh - …) }
 * o sea que el shell se sale de su caja A PROPÓSITO para ocupar la ventana. Allá eso
 * funciona porque su caja ES la ventana; acá vive dentro del contenedor del portal, y
 * el resultado es que la barra se superpone y el panel del documento se corta a la
 * mitad. Se neutraliza ese margen —no se agrega otro ancho, que fue el intento que
 * mandó la barra a x = -284. */
.ahdoc .ugc .ugc-shell { margin-left: 0 !important; margin-right: 0 !important; min-height: 0 !important; }
/* Y las dos columnas de la lección se reparten el ancho real, sin anchos fijos. */
.ahdoc .ugc .ugc-split { display: grid !important; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; }
.ahdoc .ugc .ugc-vcol, .ahdoc .ugc .ugc-pcol { width: auto !important; max-width: none !important; min-width: 0 !important; }
/* ⚠️ La tarjeta de módulo mostraba SOLO la portada hasta pasarle el cursor: en el
 * origen el cuerpo aparece en hover porque la tarjeta vive en un carrusel angosto.
 * Acá el título y la duración tienen que verse siempre — una grilla de tapas mudas
 * no dice qué es cada cosa. */
.ahdoc .ugc .ugc-modcard-body { opacity: 1 !important; visibility: visible !important; transform: none !important; max-height: none !important; }
/* ATENCION - LA BARRA DE BUSQUEDA SE SUPERPONIA AL CONTENIDO. En el origen
 * .ugc-topbar es sticky sobre una ventana completa; aca queda flotando encima de las
 * tarjetas. Se vuelve estatica y con su propio espacio. */
.ahdoc .ugc .ugc-topbar { position: static !important; margin: 0 0 18px !important; z-index: auto !important; }
/* Los botones de la leccion, con aire: venian pegados uno contra otro. */
.ahdoc .ugc .ugc-lecnav { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; }
.ahdoc .ugc .ugc-lecnav .ugc-btn { margin: 0 !important; }
/* El curso ocupa el alto disponible, no una franja al medio. */
.ahdoc .ugc .ugc-shell { min-height: 70vh !important; align-items: stretch !important; }
.ahdoc .ugc .ugc-content { padding: 0 !important; }
.ahdoc { overflow: visible !important; }
.ahdoc .ugc,
.ahdoc .ugc .ugc-shell,
.ahdoc .ugc .ugc-main,
.ahdoc .ugc .ugc-content { width: 100% !important; max-width: 100% !important; min-width: 0 !important; }
/* El split del origen es de ancho fijo; acá se reparte lo que haya. */
.ahdoc .ugc .ugc-split { display: flex !important; gap: 18px; align-items: flex-start; }
.ahdoc .ugc .ugc-vcol,
.ahdoc .ugc .ugc-pcol { flex: 1 1 0 !important; min-width: 0 !important; max-width: none !important; }
/* El hero es un <button> acá (en el origen es un <a>): sin esto colapsa a 0 × 0. */
.ahdoc .ugc .ugc-hero { display: block !important; width: 100% !important; }
/* El fondo de papel y el grano cubren la caja del curso y van DETRÁS de todo. */
.ahdoc > .paper-bg, .ahdoc > .grain { position: absolute; inset: 0; pointer-events: none; }
.ahdoc { position: relative; }
.ahdoc > .ugc { position: relative; z-index: 1; }
\n`;
writeFileSync(SALIDA, cabecera + salida, 'utf8');
console.log(`\n  reglas rescopeadas: ${reglas}`);
console.log(`  → ${SALIDA}  (${Math.round((cabecera + salida).length / 1024)} KB)\n`);
