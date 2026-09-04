// Saca de los títulos de clase YA PUBLICADOS la basura del nombre de archivo.
//
//   node scripts/curso-titulos-limpiar.mjs            (en seco: muestra qué cambiaría)
//   node scripts/curso-titulos-limpiar.mjs --aplicar
//
// ── Qué es «basura» ──────────────────────────────────────────────────────────────────────
// El prefijo de la plataforma de origen («Hotmart Club - »), el nombre del autor con su
// índice de exportación («Gonzalo Seré (1) - »), la resolución y su bitrate («1920x1080
// 1010K»), la extensión, y el sufijo que agrega el sistema de archivos cuando hay dos
// archivos con el mismo nombre («_2», «(1)»). Todos son datos del ARCHIVO, no de la
// lección, y en pantalla se leen como si el curso estuviera mal armado.
//
// ⚠️ EL BITRATE SÓLO CUENTA PEGADO A LA RESOLUCIÓN. La primera versión de esta regla sacaba
//    cualquier «\d+K» suelto y convertía «37. Chichito llegó a 100K y todo» en «llegó a y
//    todo»: ese 100K son cien mil seguidores, o sea el TEMA de la clase. Un limpiador que
//    borra contenido es peor que no limpiar — el título feo se ve feo, el mutilado se lee
//    como si el curso estuviera roto.
//
// ⚠️ Y EL ANCLA AL FINAL —que es lo que protege al «100K»— es justo lo que dejó pasar 4
//    títulos de Metodología JADS: venían como «… - 1920x1080 1010K_2» y «… - 1920x1080
//    1859K (1)», con el sufijo de duplicado DESPUÉS del bitrate. La regla no estaba mal:
//    estaba incompleta. Se contempla ese sufijo dentro del mismo patrón, sin aflojar el
//    ancla.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const APLICAR = process.argv.includes('--aplicar');
const DIR = 'app/conocimientos';

const PLATAFORMAS = /^(hotmart club|kajabi|teachable|thinkific)\s*[-–—:]\s*/i;
// «Nombre Apellido (3) - » al principio: el exportador antepone el autor y un índice.
const AUTOR_INDICE = /^[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)*\s*\(\d+\)\s*[-–—]\s*/;
// El sufijo de duplicado que el sistema de archivos agrega al copiar: «_2», « (1)»,
// « - copia». Los tres van DESPUÉS del bitrate, así que sin contemplarlos acá el ancla al
// final —que es lo que protege al «100K seguidores»— los deja pasar enteros.
const DUP = String.raw`(?:[ _]?\(\d+\)|_\d+|\s*[-–—]\s*(?:copia|copy))?`;
const RES_BITRATE = new RegExp(String.raw`\s*[-–—]?\s*\d{3,4}x\d{3,4}(?:\s+\d{2,5}\s?K)?${DUP}\s*$`, 'gi');
// ⚠️ El guion puede venir PEGADO y sin espacio: «…crecer seguidores-(1080p)». Exigir el
//    espacio dejaba pasar dos títulos con la calidad a la vista.
const CALIDAD = /\s*[-–—]?\s*\((?:\d{3,4}p|hd|full ?hd)\)\s*$/gi;
const EXT = /\.(mp4|mkv|mov|webm|m4v)\s*$/i;

const limpio = (s) => {
  let t = String(s);
  t = t.replace(EXT, '');
  t = t.replace(PLATAFORMAS, '');
  t = t.replace(AUTOR_INDICE, '');
  t = t.replace(RES_BITRATE, '');
  t = t.replace(CALIDAD, '');
  t = t.replace(/\s*[-–—]\s*$/, '');
  return t.replace(/\s+/g, ' ').trim();
};

/**
 * ⚠️ NO se escribe un título que perdió una PALABRA DE CONTENIDO.
 *
 * Es la red contra el modo de falla que ya costó caro: un limpiador que se lleva puesto el
 * tema de la clase. Se comparan las palabras de 4+ letras que no son basura conocida; si
 * desapareció alguna que no está en la lista de lo que se quita a propósito, se deja el
 * título como estaba y se avisa.
 */
const BASURA = new Set(['hotmart', 'club', 'kajabi', 'teachable', 'thinkific', 'mp4', 'mkv', 'mov', 'webm', 'm4v',
  // «copia» / «copy» sólo llegan acá cuando la regex ya los sacó del final, pegados al
  // bitrate: son el sufijo que agrega el sistema de archivos, no una palabra de la clase.
  'copia', 'copy']);
const palabras = (s) => String(s).toLowerCase().match(/[\wáéíóúñ]{4,}/g) ?? [];
const perdio = (antes, despues, delCurso = new Set()) => {
  const d = new Set(palabras(despues));
  /**
   * ⚠️ Un «1345k» es BITRATE sólo si el título traía una RESOLUCIÓN. Sin esa condición el
   *    guard frenaba las 95 limpiezas legítimas creyendo que perdía contenido —y con la
   *    condición al revés se comería el «100K seguidores» que el guard existe para
   *    proteger—. Es el mismo dato mirado en dos contextos: lo que decide es el vecino.
   */
  const habiaResolucion = /\d{3,4}x\d{3,4}/.test(antes);
  return palabras(antes).filter((w) => !d.has(w)
    && !BASURA.has(w)
    && !/^\d+x\d+$/.test(w)
    // El `_2` de un archivo duplicado queda PEGADO al bitrate («1010k_2») y `_` es carácter
    // de palabra para `\w`, así que el tokenizador lo devuelve como una sola: se contempla.
    && !(habiaResolucion && /^\d{2,5}k(?:_\d+)?$/.test(w))
    // `1080p` / `480p` son la CALIDAD, que el limpiador saca a propósito. Sin esta línea el
    // guard frena su propio trabajo: la regex ya lo había sacado bien.
    && !/^\d{3,4}p$/.test(w)
    // El nombre del AUTOR ya esta en el titulo del curso; repetido en cada clase es basura
    // del exportador, no contenido. Se permite perderlo solo si es el autor DE ESTE curso.
    && !delCurso.has(w));
};

let total = 0, cambios = 0, frenados = 0;
const muestras = [];

for (const f of readdirSync(DIR)) {
  if (!/^curso-.*\.ts$/.test(f)) continue;
  const src = readFileSync(`${DIR}/${f}`, 'utf8');
  let n = 0;
  // El titulo del CURSO (indentacion 2) trae «Curso - Autor»: sus palabras son las que una
  // clase puede perder sin que sea contenido.
  const tituloCurso = /\n {2}titulo: '((?:[^'\\]|\\.)*)'/.exec(src)?.[1] ?? '';
  const delCurso = new Set(palabras(tituloCurso));

  // ⚠️ Reemplazo con FUNCIÓN: un título puede traer un `$` («$100M») y en un string de
  //    reemplazo `$1` es una sustitución — eso ya rompió un archivo de este repo.
  const out = src.replace(/(\n {6}titulo: ')((?:[^'\\]|\\.)*)(')/g, (todo, ini, valor, fin) => {
    total++;
    const nuevo = limpio(valor);
    if (nuevo === valor || !nuevo) return todo;
    const p = perdio(valor, nuevo, delCurso);
    if (p.length) {
      frenados++;
      console.log(`  ⛔ ${f}: perdería «${p.join(', ')}»\n       ${valor.slice(0, 80)}\n    →  ${nuevo.slice(0, 80)}`);
      return todo;
    }
    n++;
    if (muestras.length < 12) muestras.push(`${valor.slice(0, 76)}\n        →  ${nuevo.slice(0, 76)}`);
    return ini + nuevo + fin;
  });

  if (!n) continue;
  cambios += n;
  console.log(`  ${f.replace('curso-', '').replace('.ts', '').padEnd(42)} ${n} título(s)`);

  if (!APLICAR) continue;
  // Guarda de estructura: si cambió la CANTIDAD de títulos, el reemplazo rompió el archivo.
  const cuenta = (s) => (s.match(/\n {6}titulo: '/g) ?? []).length;
  if (cuenta(out) !== cuenta(src)) { console.error(`  ✖ cambió la estructura de ${f}: NO escribo`); process.exit(1); }
  writeFileSync(`${DIR}/${f}`, out, 'utf8');
}

console.log(`\n  ${total} títulos revisados · ${cambios} para limpiar${frenados ? ` · ${frenados} FRENADOS por perder contenido` : ''}`);
if (muestras.length) {
  console.log(`\n  Muestra:`);
  for (const m of muestras) console.log(`     ${m}`);
}
console.log(APLICAR ? '\n  ESCRITO\n' : '\n  (en seco — sumá --aplicar)\n');
