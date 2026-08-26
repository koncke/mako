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
 * pegarlas en el CSS global las haria chocar con las nuestras en otras pantallas.
 * Se carga con un <link> al abrir el material, no en el bundle.
 *
 * ATENCION: el contenedor tiene que ser <div class="ahdoc"><div class="ugc">.
 * 593 de las reglas estan escritas bajo .ugc y solo 5 aplican sin el; sin ese div
 * en el medio el CSS no matchea y la pantalla queda con el contenido crudo apilado.
 *
 * ATENCION 2 - LO ESCRITO A MANO VA EN LA COLA, DESPUES DEL ORIGEN. Durante meses
 * el archivo se armaba como cabecera + origen, con TODAS las reglas propias adentro
 * de la cabecera: o sea ANTES del origen, que es lo contrario de lo que decia su
 * propio comentario. Con la misma especificidad gana la ultima, asi que cada regla
 * propia perdia contra la del origen y el sintoma era siempre el mismo -"le puse
 * !important y no pasa nada"-. La cola de este archivo es COLA de verdad. */
@import url('${FUENTES}');
`;

/* Todo lo escrito a mano vive ACA, y va DESPUES del origen. Una regla, un lugar: si
 * aparece dos veces, la de abajo gana en silencio y la de arriba miente. */
const cola = `
/* ── EL ANCHO: el shell del origen se sale de su caja a proposito ──────────────
 * Su regla dice .ugc-shell { margin: -26px calc(50% - 50vw) -90px }, o sea que se
 * escapa del contenedor para ocupar la ventana. Alla funciona porque su caja ES la
 * ventana; aca vive dentro del contenedor del portal y el resultado era la barra
 * superpuesta y el documento cortado a la mitad. Se NEUTRALIZA ese margen.
 *
 * ⚠️ NO se arregla ensanchando. Se probo con width:100vw + margin-left:calc(50% -
 * 50vw) y quedo PEOR: la barra se fue a x = -284. El contenedor ya se salia solo, y
 * el truco lo corrio una segunda vez. Dos correcciones del mismo ancho se suman. */

/* ── LA REPLICA ES UNA APP DE 100vh: LA PAGINA NO SCROLLEA, SCROLLEA EL CONTENIDO ──
 *
 * Cinco rondas de parches sobre el mismo sintoma, y el arreglo de una fue la causa de
 * la siguiente:
 *
 *  - Para matar la barra horizontal se puso overflow-x: hidden en html y body.
 *  - Pero overflow-x: hidden con overflow-y: visible NO deja el otro eje quieto: el
 *    valor USADO de overflow-y pasa a auto y body se vuelve contenedor de scroll. Un
 *    position: sticky se posiciona contra su ancestro que scrollea; con body hecho
 *    contenedor y sin scroll propio, la barra dejo de pegarse DEL TODO.
 *  - Sintoma: al scrollear la leccion la barra se iba con la pagina y abajo quedaba
 *    papel vacio. Medido a 1920x880 con scrollY=302: .ugc-side en y=-302 con top:0.
 *    Y por eso las verificaciones anteriores daban bien: todas median con scrollY=0,
 *    el unico estado en que un sticky roto se ve igual que uno sano.
 *
 * La salida no es otro parche de sticky: es que la pagina no scrollee. El shell mide
 * exactamente la ventana, la barra es un bloque normal de alto completo -sin sticky no
 * hay nada de que despegarse- y lo que scrollea es el contenido; en la leccion, cada
 * columna la suya. Es como funciona la barra de MaKo, que es lo que se pidio, y la
 * barra horizontal desaparece sola: sin scroll de pagina no hay barra vertical, y sin
 * barra vertical no sobra el ancho. */
html:has(.ahdoc), body:has(.ahdoc) { overflow: hidden !important; height: 100% !important; }
.cono:has(.ahdoc) { height: 100vh !important; min-height: 0 !important; overflow: hidden !important; }
.cono:has(.ahdoc) > .paper-bg { height: 100vh !important; }
/* El chrome del portal se saca: la replica ya trae su marca y su "Volver a los cursos"
 * en la propia barra, asi que el header de afuera era chrome DUPLICADO -y es el
 * contenedor que se reporto tres veces como "la caja que tapa el papel"-. */
.cono-wrap:has(.ahdoc) { padding: 0 !important; max-width: none !important; width: auto !important; margin: 0 !important; height: 100vh !important; overflow: hidden !important; }
.cono-wrap:has(.ahdoc) .al-top, .cono-wrap:has(.ahdoc) .al-shared-ft { display: none !important; }

.ahdoc { position: relative; width: auto !important; max-width: none !important; margin-inline: 0 !important; height: 100vh !important; overflow: hidden !important; }
.ahdoc > .paper-bg, .ahdoc > .grain { position: absolute; inset: 0; pointer-events: none; }
.ahdoc > .ugc { position: relative; z-index: 1; }
.ahdoc .ugc { height: 100vh !important; width: 100% !important; max-width: 100% !important; min-width: 0 !important; }
.ahdoc .ugc .ugc-shell {
  height: 100vh !important; min-height: 0 !important; max-width: none !important;
  margin: 0 !important; overflow: hidden !important;
  display: flex !important; align-items: stretch !important;
  width: 100% !important; max-width: 100% !important;
}

/* La barra: bloque normal de alto completo. Sin sticky no hay nada que se despegue y no
 * depende de que ningun ancestro conserve su overflow. */
.ahdoc .ugc .ugc-side {
  position: static !important; top: auto !important;
  height: 100vh !important; max-height: 100vh !important; min-height: 0 !important;
  flex: 0 0 268px !important; align-self: stretch !important;
  border-radius: 0 !important; overflow-y: auto !important; overscroll-behavior: contain;
}

/* La columna de contenido: la busqueda fija arriba y el resto scrolleando debajo.
 * El min-height: 0 no sobra - sin el, un hijo de flex no se deja achicar por debajo de
 * su contenido y el scroll interno no aparece nunca. */
.ahdoc .ugc .ugc-main {
  height: 100vh !important; min-width: 0 !important; width: 100% !important;
  display: flex !important; flex-direction: column !important; overflow: hidden !important;
  padding: 24px 32px 0 !important;
}
/* La busqueda era sticky sobre una ventana entera; aca quedaba flotando encima de las
 * tarjetas. Se vuelve estatica y con su propio espacio. */
.ahdoc .ugc .ugc-topbar { position: static !important; flex: 0 0 auto !important; margin: 0 0 18px !important; z-index: auto !important; }
.ahdoc .ugc .ugc-content {
  flex: 1 1 auto !important; min-height: 0 !important; padding: 0 !important;
  display: flex !important; flex-direction: column !important;
  overflow-y: auto !important; overflow-x: hidden !important; overscroll-behavior: contain;
  width: 100% !important; max-width: 100% !important;
}
.ahdoc .ugc .ugc-content > * { flex: 0 0 auto !important; }

/* En la leccion las dos columnas llenan el alto y scrollea cada una la suya: el video
 * queda a la vista mientras se lee el documento, que en la clase mas larga mide 8221 px.
 * El padding de abajo del origen es 118 px -alli hay un reproductor flotante que aca no
 * existe- y era una franja muerta al pie de la pantalla. */
.ahdoc .ugc .ugc-content > .ugc-split { flex: 1 1 auto !important; min-height: 0 !important; }
.ahdoc .ugc .ugc-split {
  display: flex !important; gap: 18px !important; align-items: stretch !important;
  max-width: none !important; margin: 0 !important; padding: 0 0 24px !important;
}
.ahdoc .ugc .ugc-split > .ugc-vcol, .ahdoc .ugc .ugc-split > .ugc-pcol {
  position: static !important; top: auto !important; align-self: stretch !important;
  flex: 1 1 0 !important; min-width: 0 !important; max-width: none !important; width: auto !important;
  min-height: 0 !important; max-height: none !important;
  overflow-y: auto !important; overflow-x: hidden !important; overscroll-behavior: contain;
}

/* Las tabs del documento se quedan arriba de SU columna. Medido antes de esto: al bajar
 * el documento pasaban de y=102 a y=-2898, o sea que para cambiar de Documento a
 * Transcripcion habia que devolver 8000 px de papel. No se notaba mientras scrolleaba la
 * pagina entera -eran parte del recorrido-; con el panel scrolleando por dentro, una barra
 * de navegacion que vive adentro de lo que navega deja de ser una barra.
 *
 * El fondo NO es opcional: sin el, el papel del documento pasa por debajo y las tabs
 * quedan ilegibles sobre el texto que va corriendo. */
.ahdoc .ugc .ugc-pcol > .ugc-tabs {
  position: sticky !important; top: 0 !important; z-index: 3 !important;
  background: var(--u-paper, #f4f1e8) !important;
  padding: 2px 0 10px !important; margin: 0 0 4px !important;
}

/* ── Lo demas, por pieza ──────────────────────────────────────────────────────── */
/* Y el contenedor NO pinta: el papel tiene que verse. Un fondo propio encima del papel
 * es lo que hacia que pareciera una caja pegada arriba. */
.ahdoc .ugc, .ahdoc .ugc .ugc-shell, .ahdoc .ugc .ugc-main, .ahdoc .ugc .ugc-content {
  background: transparent !important; box-shadow: none !important; border: 0 !important;
}
/* ⚠️ La tarjeta de modulo mostraba SOLO la portada hasta pasarle el cursor: en el origen
 * el cuerpo aparece en hover. Sin mouse -o de un vistazo- el indice era una fila de
 * imagenes sin un solo titulo. */
.ahdoc .ugc .ugc-modcard-body { opacity: 1 !important; visibility: visible !important; transform: none !important; max-height: none !important; }
/* Los botones de la leccion, con aire: venian pegados uno contra otro. */
.ahdoc .ugc .ugc-lecnav { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; }
.ahdoc .ugc .ugc-lecnav .ugc-btn { margin: 0 !important; }
/* El hero ocupaba media pantalla con un boton chico adentro. Se acota, y como aca es un
 * <button> y en el origen un <a>, sin el display: block colapsa a 0 x 0. */
.ahdoc .ugc .ugc-hero { display: block !important; width: 100% !important; max-height: 260px !important; min-height: 0 !important; }
.ahdoc .ugc .ugc-hero-img { object-fit: cover !important; }
/* ATENCION - LAS CLASES VAN EN GRILLA, NO EN CARRUSEL. En el origen .ugc-rail es una
 * fila que se corre de costado, porque alla el indice muestra 5 modulos. Con 30 clases
 * eso es una fila larguisima sin barra visible: navegar se vuelve imposible. Una grilla
 * usa el alto, que es justo lo que sobra. */
.ahdoc .ugc .ugc-rail {
  display: grid !important;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)) !important;
  gap: 18px !important; overflow: visible !important; scroll-snap-type: none !important;
}
.ahdoc .ugc .ugc-rail > * { scroll-snap-align: none !important; flex: none !important; width: auto !important; }
/* El video, con su alto real: entraba a 150 px. */
.ahdoc .ugc .ugc-vframe { aspect-ratio: 16 / 9 !important; height: auto !important; min-height: 0 !important; }
.ahdoc .ugc .ugc-vcard { width: 100% !important; }
/* Los clips embebidos del documento, con su caja: sin alto propio un iframe sale de
 * 150 px y rompe la fila. */
.ahdoc .ugc .ugc-clip-drive, .ahdoc .ugc .ugc-media iframe { width: 100% !important; aspect-ratio: 9 / 16 !important; height: auto !important; border: 0; display: block; }
.ahdoc .ugc .ugc-media { max-width: 220px !important; }
/* La clase SIN video muestra su portada en el mismo marco, y el marco no la conocia.
 * La regla del origen es \`.ugc-vframe iframe, .ugc-vframe video\` — sin \`img\`. Una clase
 * sin video (\`Agentes\`) cae al <img> de CursoReplica y, sin posicionar ni escalar, la
 * imagen se dibuja a su tamano natural (1280 px) y el \`overflow: hidden\` de .ugc-vcard
 * la recorta: se ve un pedazo gigante de la esquina superior izquierda en vez de la
 * portada. No es que falte la imagen — sobra tamano. */
.ahdoc .ugc .ugc-vframe img { position: absolute !important; inset: 0 !important; width: 100% !important; height: 100% !important; object-fit: cover !important; display: block !important; }

/* ── LA LAMINA DIBUJADA PASA POR EL MISMO REVELADO QUE UNA TAPA DE VERDAD ──────────
 * A toda tapa real el origen le pone \`filter: saturate(.8) brightness(.92)\` (la regla
 * \`.ugc-modcard-cover img\`) y encima el \`.shade\`, un degrade de 12% a 55% de negro. Ese
 * es el revelado de la casa y es lo que hace que el riel se lea de un solo tono.
 *
 * La lamina en SVG hereda el \`.shade\` sola —esta adentro del mismo contenedor y antes de
 * el— pero NO el filtro: aquella regla es un selector de ELEMENTO y un <svg> no matchea
 * \`img\`. Medido con PIL, el papel dentro de la tarjeta a tres alturas:
 *     referencia (m1..m5)      (190,188,180) · (159,158,151) · (124,123,115)
 *     lamina sin esta regla    (244,243,231) · (244,243,231) · (244,243,231)
 *     lamina con esta regla    (189,188,181) · (159,158,151) · (123,122,115)
 *
 * Sin la linea, en el unico curso donde conviven —AvatarHype: 5 tapas reales y 1
 * dibujada— se ve como una tarjeta que brilla al lado de cinco apagadas.
 *
 * Se eligio revelar la LAMINA y no aclarar el \`.shade\` de la tapa real: aclarar el shade
 * le cambia la cara a las 5 tapas que hoy estan BIEN y le saca contraste al chip
 * \`.ugc-modcard-n\`. Este camino toca 368 tarjetas que hoy muestran un degrade negro con
 * un numero, y CERO de las que hoy estan bien.
 *
 * Va sobre la CLASE y no sobre \`svg\` para que no alcance a ningun otro svg que entre a
 * la tarjeta despues. */
.ahdoc .ugc .ugc-modcard-cover .ugc-lamina { filter: saturate(.8) brightness(.92); }
`;

writeFileSync(SALIDA, cabecera + salida + cola, 'utf8');
console.log(`\n  reglas rescopeadas: ${reglas}`);
console.log(`  → ${SALIDA}  (${Math.round((cabecera + salida).length / 1024)} KB)\n`);
