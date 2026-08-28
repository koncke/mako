// Cablea un curso bajado al portal /conocimientos. Cierra el circuito:
//   plan.json (títulos, módulos, duración)
// + drive.json (el videoId real de cada clase)
// + texto/<clase>.md (tu bloque «Apuntes» + la transcripción)
//   → public/cono-tx/<videoId>.json  (lo que baja TranscriptLazy)
//   → app/conocimientos/curso-<slug>.ts  (el Curso que consume el portal)
//
// Dos decisiones que importan:
//   · El archivo del curso va APARTE, nunca dentro de app/conocimientos/curso.ts:
//     ese es AUTO-GENERADO y todo lo escrito a mano ahí se pierde al regenerar.
//     Es el mismo motivo por el que existen curso-vsl.ts y curso-producto-app.ts.
//   · El `resumen` de cada clase sale de TU bloque «## Apuntes» del .md, no de la
//     transcripción. Si está vacío, el campo va vacío y el portal no dibuja el
//     bloque. Escribís apuntes, volvés a correr esto, y aparecen. La transcripción
//     cruda queda detrás del <details>, que es donde corresponde.
//
// Reanudable y parcial: solo marca hasTx en las clases que YA tienen su .md, así
// se puede correr con la transcripción a medias y volver a correr después.
//
//   node <abs>\scripts\curso-a-portal.mjs --plan C:\cursos\<slug>\plan.json
//   node <abs>\scripts\curso-a-portal.mjs --plan … --categoria "IA aplicada"

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};

const PLAN = arg('plan', '');
const REPO = arg('repo', 'C:\\Users\\marti\\OneDrive\\Escritorio\\dashboard-marketing-main\\dashboard-marketing');
const CATEGORIA = arg('categoria', '');
const EYEBROW = arg('eyebrow', 'Curso externo');

if (!PLAN || !existsSync(PLAN)) { console.error('\n  ✖ Falta --plan <plan.json>\n'); process.exit(1); }
const base = dirname(PLAN);
// Ver la nota del BOM en curso-bajar.mjs: PowerShell 5.1 lo mete y JSON.parse muere.
const plan = JSON.parse(readFileSync(PLAN, 'utf8').replace(/^﻿/, ''));

// ⚠️ EL ORDEN DE LOS MÓDULOS ES UN DATO DEL CURSO, NO EL DE LA PLATAFORMA.
//
// El orden de `plan.clases` es el que devolvió la plataforma, y no tiene por qué ser el
// orden en que se estudia. En MasteryHaus la plataforma devolvía primero «Sesiones de
// Maestría», «MasteryClub» y «Mastery Machine» —que son material SUELTO, sesiones
// grabadas y extras— y recién cuarto «Introducción a la Fórmula», que es por donde se
// empieza. El alumno abría el curso y lo primero que veía era el anexo.
//
// La numeración del AUTOR existe y está en las carpetas de su Drive («1. Introduccion a
// la Formula…», «2. Mentalidad & Foco»…). Eso es el dato; el orden del feed es un
// accidente de cómo la plataforma arma su respuesta.
//
// `plan.ordenModulos` lo fija a mano. Se compara SIN ordinal ni acentos —«6. Marketing
// Perpetuo» y «MKT Perpetuo» son el mismo módulo— y lo que no esté en la lista queda
// DESPUÉS, en el orden que tenía: una lista incompleta no puede esconder un módulo.
if (Array.isArray(plan.ordenModulos) && plan.ordenModulos.length) {
  const llave = (x) => String(x ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/^\d+[.\-)\s]+/, '').replace(/[^a-z0-9]+/g, '');
  const rango = new Map(plan.ordenModulos.map((m, i) => [llave(m), i]));
  const orig = new Map(plan.clases.map((c, i) => [c, i]));
  const puesto = (c) => {
    const r = rango.get(llave(c.modulo));
    return r === undefined ? rango.size : r;
  };
  plan.clases = [...plan.clases].sort((a, b) => puesto(a) - puesto(b) || orig.get(a) - orig.get(b));

  const sinRango = [...new Set(plan.clases.filter((c) => rango.get(llave(c.modulo)) === undefined)
    .map((c) => c.modulo).filter(Boolean))];
  if (sinRango.length) {
    console.log(`\n  ⚠ ${sinRango.length} módulo(s) fuera de ordenModulos — van al final:`);
    for (const m of sinRango) console.log(`      · ${m}`);
  }
}

const driveJson = join(base, 'drive.json');
if (!existsSync(driveJson)) {
  console.error('\n  ✖ Falta drive.json. Corré antes curso-a-drive.mjs: sin el videoId real');
  console.error('    de Drive el portal pinta un iframe muerto.\n');
  process.exit(1);
}
const drive = JSON.parse(readFileSync(driveJson, 'utf8').replace(/^﻿/, ''));
const idPorN = new Map(drive.clases.map((c) => [c.n, c.videoId]));

const dirTexto = join(base, 'texto');
const dirTx = join(REPO, 'public', 'cono-tx');
mkdirSync(dirTx, { recursive: true });

// ── Partir la transcripción en párrafos legibles ─────────────────────────────
// Whisper devuelve un bloque corrido. Sin cortar, el <details> es un muro.
// Se agrupa por oraciones (no por largo fijo, que parte al medio de una idea).
const enParrafos = (texto, porParrafo = 4) => {
  const oraciones = texto
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?…])\s+(?=[¿¡"“'(A-ZÁÉÍÓÚÑ0-9])/g)
    .filter((s) => s.trim());
  const out = [];
  for (let i = 0; i < oraciones.length; i += porParrafo) {
    out.push(oraciones.slice(i, i + porParrafo).join(' ').trim());
  }
  return out.filter(Boolean);
};

// El .md que escribe curso-transcribir.ts: cabecera, «## Apuntes», «## Transcripción».
const leerMd = (ruta) => {
  const txt = readFileSync(ruta, 'utf8');
  const iA = txt.indexOf('## Apuntes');
  const iT = txt.indexOf('## Transcripción');
  const apuntes = iA > -1 && iT > iA ? txt.slice(iA + '## Apuntes'.length, iT).trim() : '';
  const cuerpo = iT > -1 ? txt.slice(iT + '## Transcripción'.length) : txt;
  // Las partes de un audio troceado están separadas por --- ; se concatenan.
  const transcripcion = cuerpo.split(/^\s*---\s*$/m).map((p) => p.trim()).filter(Boolean).join(' ');
  return { apuntes, transcripcion };
};

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

// ⚠️ `esc` ES PARA TEMPLATE LITERALS, Y CASI TODO SE EMITE ENTRE COMILLAS SIMPLES.
// Escapa la barra, el backtick y el `${`, que es exactamente lo que necesita el único
// campo que sale entre backticks (`resumen`). Para los otros veinte, que salen como
// `campo: '…'`, el carácter peligroso es el APÓSTROFO — y ese no lo tocaba nadie.
//
// Un recurso de «Programa RAIO» titulado «Story 17 - Don't Fail Less, Fail Faster»
// generó `label: '03 - Story 17 - Don't Fail Less, Fail Faster',`: un .ts que no
// compila. Y no falla al generar —el script termina con éxito y el archivo queda
// escrito— sino en el typecheck del pre-push, a tres pasos de distancia y con un error
// («':' expected») que no nombra ni el curso ni el apóstrofo.
//
// La regla: el escapado es del DELIMITADOR, no del texto. Un helper llamado `esc` a
// secas invita a usarlo para la otra clase de comilla, que es lo que pasó.
const escSimple = (s) => String(s)
  .replace(/\\/g, '\\\\')
  .replace(/'/g, "\\'")
  .replace(/\r?\n/g, ' ');

// ── Los recursos del portal (PDFs, planillas, links) ─────────────────────────
// `CursoPortal` dibuja la sección «Recursos» solo si `curso.recursos.length > 0`, y
// el detalle de una clase muestra los suyos por `recursoSlugs`. Con los dos vacíos,
// 20 PDFs bajados y subidos a Drive no aparecían en ninguna parte.
//
// El `driveId` sale de drive.json (lo resuelve curso-a-drive.mjs). Un recurso SIN id
// no se emite: una tarjeta que abre un visor vacío es peor que no tener la tarjeta.
// `pdf` = lo que Drive previsualiza en un iframe. Todo lo demás es `file` (una
// descarga), y ese es el DEFAULT: la versión anterior caía a 'pdf' para cualquier
// extensión desconocida, así que los tres ZIP de «Inteligencia Viral 2026» salían
// como visor de PDF y el portal dibujaba un iframe con «sin vista previa».
const TIPO_POR_EXT = { pdf: 'pdf', xlsx: 'pdf', docx: 'pdf', doc: 'pdf', xls: 'pdf', link: 'notion' };
const slugRecurso = (nombre) => nombre.replace(/\.[^.]+$/, '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 60);

// Cómo se cuelga cada recurso de sus clases, y por qué así:
//
//   pdfs/     → el origen (curso-pdfs.mjs) lo asoció a UNA clase: va a esa.
//   recursos/ → la plataforma los asocia a un MÓDULO, nunca a una lección. Así que
//               se cuelgan de todas las clases de su módulo, prefiriendo el
//               SUBMÓDULO cuando lo hay: el recurso de «1. Setting» va a sus 25
//               clases, no a las 38 del módulo raíz «6. SALES».
//
// Bajar de ahí —adivinar UNA clase dentro del módulo— sería inventar el dato, y es
// justamente lo que no se hace.
// ⚠️ QUÉ ES un recurso sale de su URL DE ORIGEN, que es un dato — no del `tipo`, que
//    es el molde con el que lo dibuja el portal.
//
//    `tipo: 'pdf'` es «esto se ve en el visor», y bajo ese molde caen un Google Doc
//    exportado, una planilla y un PDF suelto. Con la etiqueta atada al tipo, los 32
//    archivos de MasteryHaus decían «Catálogo» — una palabra que no distingue nada y que
//    además no describe a ninguno.
//
//    La URL de origen SÍ distingue: `/document/` es un Doc, `/spreadsheets/` una planilla,
//    `/forms/` un formulario. Medido acá: 25 Doc, 6 Sheet, 7 archivos sueltos de Drive y
//    28 links externos.
//
//    ⚠️ La ÚNICA que sale del nombre es «Bot de IA», y es a propósito: un bot es un Google
//    Doc con un prompt adentro, o sea INDISTINGUIBLE de cualquier otro Doc por la URL. Lo
//    que lo declara es el material sobre sí mismo («Bot Nicho Dorado», «BOT AI
//    Desarrollador…»). Se exige la palabra COMPLETA (`\bbot\b`) para que no entre un
//    «robot» ni un «botella»: si el nombre no lo dice, queda «Doc», que nunca es falso.
const etiquetaDe = (x) => {
  const u = String((x && x.url) || '');
  const nombre = String((x && (x.tituloReal || x.label)) || '');
  const esBot = /(^|[^a-záéíóúñ])bot([^a-záéíóúñ]|$)/i.test(nombre);
  // El bot gana ANTES que el origen: un bot puede ser un Doc o un link externo, y en los
  // dos casos lo util para el que mira es que es un BOT, no de que plataforma salio.
  if (esBot) return 'Bot de IA';
  if (/\/forms\//.test(u)) return 'Form';
  if (/\/spreadsheets\//.test(u)) return 'Sheet';
  if (/\/presentation\//.test(u)) return 'Slides';
  if (/\/document\//.test(u)) return esBot ? 'Bot de IA' : 'Doc';
  if (x && x.tipo === 'link') return 'Link';
  const ext = /\.([a-z0-9]+)$/i.exec(String((x && x.archivo) || ''));
  const e = ext ? ext[1].toLowerCase() : '';
  if (e === 'xlsx' || e === 'csv') return 'Sheet';
  if (e === 'docx') return 'Doc';
  if (e === 'pptx') return 'Slides';
  if (e === 'pdf') return esBot ? 'Bot de IA' : 'PDF';
  return null;   // sin dato: gana el molde (TIPO_BADGE), que es lo que había
};

// ⚠️ EL TÍTULO DE UN RECURSO ES UN DATO, NO EL NOMBRE DE SU ARCHIVO.
//
// `recursos-manifiesto.json` guarda el `label` que declara la plataforma. El nombre de
// archivo, en cambio, lo fabricó el descargador pegando los primeros 8 caracteres del id
// del Google Doc para que dos materiales homonimos no se pisaran en disco:
//
//     label    (plataforma)  →  «Conecta tu Dominio»
//     archivo  (disco)       →  «Conecta tu Dominio - 1w3cpy9_.pdf»
//
// Sin este join el portal publicaba el segundo, y los 38 recursos de MasteryHaus se veían
// con un sufijo de basura pegado al título. Lo reportó Martín como «están todos mal».
//
// ⚠️ Y NO se arregla recortando el sufijo con una regex: hay títulos REALES que llevan
//    « - » adentro («Sesión Maestría - Diciembre 2025», «Sesión Maestría - Febrero 2025 Las
//    5 leyes…», 2 de los 38). Cortar por el separador les come media frase. El dato está
//    guardado; se lee, no se adivina — es «si hay que desempatar, todavía estás
//    adivinando» aplicada al nombre.
const titulosDelManifiesto = (base) => {
  const m = new Map();
  const p = join(base, 'recursos-manifiesto.json');
  if (!existsSync(p)) return m;
  try {
    for (const x of JSON.parse(readFileSync(p, 'utf8'))) {
      // `tituloReal` es lo que el ARCHIVO dice de si mismo (lo escribe
      // curso-recursos-titulos.mjs); `label` es el nombre de la SECCION donde cuelga.
      // Gana el primero: en MasteryHaus siete archivos distintos -- ACTIVIDAD #2,
      // 3. Futuro poco feliz, 7. Tracker extra... -- compartian UNA sola seccion, y los
      // siete se publicaban con el mismo nombre y la misma descripcion.
      const t = x && (x.tituloReal || x.label);
      // Un ENLACE no tiene archivo: se indexa por su label, que es lo que despues llega
      // como . Sin esto un bot que es un link quedaba como "Link" a secas.
      const clave = String((x && (x.archivo || x.label)) || '');
      if (clave && t) m.set(clave, { titulo: String(t), etiqueta: etiquetaDe(x) });
    }
  } catch { /* un manifiesto roto no frena la publicación: se cae al nombre de archivo */ }
  return m;
};

const construirRecursos = (drive, planClases, titulos = new Map()) => {
  const recursos = [];
  const porClase = new Map();
  const colgar = (n, slug) => porClase.set(n, [...(porClase.get(n) ?? []), slug]);
  const sinNumero = (s) => String(s ?? '').replace(/^\d+\.\s*/, '').trim();

  for (const r of drive.recursos ?? []) {
    const esEnlace = r.tipo === 'link' && r.url;
    const ext = (r.archivo.match(/\.([^.]+)$/)?.[1] ?? 'pdf').toLowerCase();
    // Un enlace se emite como `bank` con un item: es el único tipo del portal que
    // renderiza un link EXTERNO clickeable. `notion` pondría un botón que dice «Ver en
    // Notion» sobre un tablero de Miro, que sería mentira; y `pdf` abre un visor de
    // Drive, que para un link no existe.
    const tipo = esEnlace ? 'bank' : (TIPO_POR_EXT[ext] ?? 'file');
    let slug = slugRecurso(r.archivo);
    // ⚠️ UN SLUG REPETIDO SE DESAMBIGUA, NO SE DESCARTA. `slugRecurso` saca la extensión,
    // así que «31. Exportar.png» y «31. Exportar.txt» —dos archivos DISTINTOS— caen en el
    // mismo slug, y el `continue` que había acá tiraba el segundo sin decir nada: 56
    // recursos en disco, 54 en la ficha, y el guard del final culpando a Drive por ids que
    // no faltaban. Es el mismo problema que `nombreUnico` ya resolvió para los nombres de
    // archivo, y se resuelve igual: de forma DETERMINISTA, para que dos corridas produzcan
    // los mismos slugs y los links compartidos no se rompan.
    if (recursos.some((x) => x.slug === slug)) {
      const conExt = `${slug}-${ext}`;
      if (!recursos.some((x) => x.slug === conExt)) slug = conExt;
      else {
        let i = 2;
        while (recursos.some((x) => x.slug === `${conExt}-${i}`)) i++;
        slug = `${conExt}-${i}`;
      }
    }
    // Un recurso de archivo SIN id de Drive no se emite (tarjeta que abre nada);
    // un enlace no necesita id, así que esa regla no le aplica.
    if (!esEnlace && !r.driveId) continue;

    let deClases = [];
    let desc = 'Material del curso';

    // El nombre del archivo trae «NN - <título de la clase> - <nombre real>» porque
    // en Drive tiene que poder leerse suelto. En el portal, en cambio, el recurso
    // YA cuelga de su clase y muestra el chip «Clase 32»: repetirlo produce
    // «32 - Leccion 3 Subtitulaje Avanzado - Leccion_3_descargable__Subtitulaje…».
    // Se saca el prefijo EXACTO (número + título de esa clase del plan), no por
    // heurística de guiones — hay títulos que llevan « - » adentro.
    let claseDelPrefijo = null;

    // ⚠️ SI EL RECURSO YA SABE DE QUÉ CLASES ES, ESO MANDA SOBRE LA HEURÍSTICA.
    //
    // Para `nivel: clase` el generador deducía la clase del prefijo «NN - » del nombre
    // de archivo. Es una heurística que solo funciona con los nombres que pone el
    // descargador del repo. Cuando el material viene de otra plataforma —los de
    // MasteryHaus son links de Google dentro del cuerpo de cada lección— el nombre no
    // lleva prefijo, la heurística no encuentra nada, y la ficha sale con 62 recursos y
    // CERO clases con material: la sección del curso llena y ninguna lección mostrando
    // su PDF. No falla nada; simplemente no aparece.
    //
    // El dato explícito ya existe (`recursos.json` trae `clases: [n, …]`). Un dato le
    // gana siempre a una heurística sobre el nombre de un archivo.
    if (Array.isArray(r.clases) && r.clases.length) {
      deClases = r.clases.filter((n) => planClases.some((c) => c.n === n));
      desc = deClases.length === 1 ? `Material de la clase ${deClases[0]}` : `Material de ${deClases.length} clases`;
    } else if (r.nivel === 'clase') {
      const n = Number(/^(\d{1,3})\s*-\s*/.exec(r.archivo)?.[1]);
      const clase = planClases.find((c) => c.n === n);
      if (Number.isFinite(n) && clase) {
        deClases = [n];
        desc = `Material de la clase ${n}`;
        claseDelPrefijo = clase;
      }
    } else if (r.submodulo) {
      deClases = planClases.filter((c) => sinNumero(c.submodulo) === sinNumero(r.submodulo)).map((c) => c.n);
      desc = `Material de «${r.submodulo}»`;
    } else if (r.modulo) {
      deClases = planClases.filter((c) => sinNumero(c.modulo) === sinNumero(r.modulo)).map((c) => c.n);
      desc = `Material de «${r.modulo}»`;
    }

    // ⚠️ Si el recurso trae su título REAL (el que declara la plataforma), gana. El
    // nombre de archivo arrastra un prefijo «NNN - <clase> - » que puso el descargador,
    // y para un recurso de MÓDULO esa clase no es la que lo muestra: el label terminaba
    // nombrando una clase ajena («249 - Campaña de Nutrición Semanal - …») dentro del
    // bloque de otra. Se ve prolijo y dice algo falso.
    let label = r.archivo.replace(/\.[^.]+$/, '');
    const delManifiesto = titulos.get(String(r.archivo ?? ''));
    if (delManifiesto && delManifiesto.titulo) label = delManifiesto.titulo;
    if (r.tituloReal) label = String(r.tituloReal);
    if (claseDelPrefijo) {
      const pref = `${String(claseDelPrefijo.n).padStart(2, '0')} - ${claseDelPrefijo.titulo} - `;
      // Solo si queda algo: hay recursos cuyo nombre ES el de la clase, y dejarlos
      // sin label sería peor que dejarlos repetidos.
      if (label.startsWith(pref) && label.length > pref.length) label = label.slice(pref.length);
    }
    // Los descargables vienen del sistema de archivos del creador: guiones bajos
    // y dobles espacios. Se leen como nombre, no como ruta.
    label = label.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
    recursos.push({
      slug, tipo, ext: esEnlace ? null : ext,
      badge: (delManifiesto && delManifiesto.etiqueta) || (esEnlace ? 'Link' : null) || undefined,
      driveId: esEnlace ? null : r.driveId,
      items: esEnlace ? [{ label: `Abrir ${label}`, url: r.url }] : null,
      label,
      cardDesc: esEnlace ? `Enlace · ${desc.replace(/^Material de /, '')}` : desc,
      clases: deClases.length ? deClases : undefined,
    });
    for (const n of deClases) colgar(n, slug);
  }
  // ⚠️ LOS RECURSOS SE ORDENAN POR MÓDULO, Y EL MÓDULO SALE DE LA POSICIÓN EN
  //    PANTALLA — NO DEL NÚMERO DE CLASE.
  //
  //    El `n` de una clase es su id en la plataforma, y desde que `ordenModulos` reordena
  //    los módulos ya no tiene nada que ver con dónde se ve. Medido en MasteryHaus: la
  //    clase n=21 se dibuja en la POSICIÓN 225. Ordenar por `min(clases)` ponía su
  //    material primero de todo, y el resto igual de mezclado: una lista sin ningún hilo.
  //
  //    Ordenando por la posición, los recursos quedan agrupados por módulo SOLOS — las
  //    clases de un módulo son contiguas en pantalla —, que es lo que se pidió. No hace
  //    falta agrupar a mano ni guardar el módulo en cada recurso.
  const posDe = new Map(planClases.map((c, i) => [c.n, i]));
  const primeraClase = (r) => {
    if (!r.clases || !r.clases.length) return Infinity;   // material del curso entero: al final
    const ps = r.clases.map((n) => posDe.get(n)).filter((p) => p !== undefined);
    return ps.length ? Math.min(...ps) : Infinity;
  };
  recursos.sort((a, b) => primeraClase(a) - primeraClase(b)
    || String(a.label).localeCompare(String(b.label), 'es'));
  return { recursos, porClase };
};
const slugDe = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();

// ── Recorrer las clases ──────────────────────────────────────────────────────
// texto/ puede estar plano u organizado en «<NN Módulo>/» (ver curso-organizar.mjs),
// así que se camina un nivel de subcarpetas.
const mdPorN = new Map();
const listarUnNivel = (dir) => !existsSync(dir) ? [] : readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => e.isDirectory()
    ? readdirSync(join(dir, e.name)).map((f) => join(e.name, f))
    : [e.name]);
for (const rel of listarUnNivel(dirTexto)) {
  const f = basename(rel);
  if (!f.endsWith('.md') || f === '_indice.md') continue;
  const m = /^(\d{1,3})\s*-\s*/.exec(f);
  if (m) mdPorN.set(Number(m[1]), join(dirTexto, rel));
}

const modulos = [...new Set(plan.clases.map((c) => c.modulo).filter(Boolean))];

// ⚠️ QUITAR EL ORDINAL PUEDE FUNDIR DOS MÓDULOS DISTINTOS EN UNA SOLA CAJA.
// El nombre que la plataforma da a un módulo viene con su ordinal («3. Ponencias
// Especiales»), y el ordinal se reinicia en cada sección del curso. Sacarlo hace que
// «3. Ponencias Especiales» (bajo Transmutación de Identidad) y «2. Ponencias
// Especiales» (bajo Facebook Ads) pasen a llamarse igual — y el hub abre un <details>
// por valor de `grupo`, así que las clases de las dos secciones caen adentro del mismo
// acordeón. Medido en BlueHacker el 22/08/2026: el plan trae 40 módulos y el archivo
// generado emitía 38.
//
// El síntoma no se parece a un bug: se ve un curso con dos módulos menos y un acordeón
// un poco más largo. Nadie cuenta los acordeones.
//
// Así que el ordinal se quita SOLO cuando quitarlo no genera un choque. La alternativa
// —dejarlo siempre— ensucia los 20 cursos que no lo necesitan.
const sinOrdinal = (m) => String(m).replace(/^\d+\.\s*/, '');
const choques = new Map();
for (const m of modulos) choques.set(sinOrdinal(m), (choques.get(sinOrdinal(m)) ?? 0) + 1);
const nombreGrupo = (m) => (m ? (choques.get(sinOrdinal(m)) > 1 ? String(m) : sinOrdinal(m)) : undefined);
const clases = [];
let conTx = 0, sinTx = 0, conApuntes = 0;

// ⚠️ Una clase SIN id de Drive no entra a la ficha. Antes se emitía igual con
// `videoId: null` y en el portal quedaba una lección que no reproduce nada — que es
// justo lo que el dueño reporta como «clases rotas». Pasó con «100M money Models»:
// dos entradas del catálogo de la plataforma apuntan a videos que dan HTTP 404 en
// Vimeo, así que nunca se bajaron ni tuvieron id, y aun así salían en la ficha.
//
// No es lo mismo que «todavía no subió»: para eso está el guard de los recursos, que
// aborta. Acá el material NO EXISTE del otro lado, y lo honesto es no listarlo.
// ⚠️ «NO TIENE ID DE DRIVE» NO ES «NO EXISTE DEL OTRO LADO». Son dos cosas y el plan las
// distingue con `sinFuente`, que este código no leía:
//
//     sinFuente: true   la plataforma NO tiene ese video (un link, un pack de recursos,
//                       un bruto sin publicar). Omitirla es correcto.
//     sinFuente: false  la plataforma SÍ lo tiene → si no hay id, FALTA SUBIRLO. Omitirla
//                       en silencio es perder material que está bajado y transcripto.
//
// Pasó con «Clonación · Parte 1 y 2» de Creativos UGC Realistas: `sinFuente: false`, el
// mp4 bajado, el audio hecho, la transcripción escrita y el video YA SUBIDO a Drive — lo
// único que faltaba era que `drive.json` tuviera su id. El generador las descartó, publicó
// 30 de 32 y encima imprimió «el video no existe del otro lado», que era falso. Con la
// clase se fueron sus `docSlug`: los dos `public/cono-doc/clonacion-parte-*.json` quedaron
// commiteados en el repo sin ninguna pantalla que los pudiera abrir. Lo vio el dueño.
const muertas = [];
const huerfanas = [];
for (const c of plan.clases) {
  const videoId = idPorN.get(c.n) ?? null;
  // ⚠️ «SIN VIDEO» SON TRES COSAS DISTINTAS, Y ANTES ERAN DOS.
  //   · `soloTexto`  → su forma ES un documento. Se emite igual, sin videoId: el portal
  //                    pinta el marco solo si hay video y el documento va abajo como
  //                    siempre. Descartarla hacía desaparecer la lección sin dejar hueco
  //                    ni aviso — el mismo modo de falla que el módulo 2 de AvatarHype.
  //   · `sinFuente`  → la plataforma NO lo tiene. Omitirla es correcto.
  //   · lo que queda → está bajada y transcripta y le falta el id de Drive: eso aborta.
  if (!videoId && !c.soloTexto) { (c.sinFuente === false ? huerfanas : muertas).push(c); continue; }
  const md = mdPorN.get(c.n);
  let hasTx = false;
  let apuntes = '';

  if (md && videoId) {
    const { apuntes: a, transcripcion } = leerMd(md);
    apuntes = a;
    const paras = enParrafos(transcripcion);
    if (paras.length) {
      writeFileSync(join(dirTx, `${videoId}.json`), JSON.stringify(paras), 'utf8');
      hasTx = true;
      conTx++;
    }
    if (a) conApuntes++;
  } else {
    sinTx++;
  }

  // vn = número dentro del módulo, para el badge del hub.
  const delModulo = plan.clases.filter((x) => x.modulo === c.modulo);
  const vn = delModulo.findIndex((x) => x.n === c.n) + 1;

  // El documento replicado de la lección, si se capturó. Se pregunta por el ARCHIVO,
  // no por una bandera del plan: si el json no está, el portal dibujaría una tab vacía.
  // El documento vive en `public/cono-doc/<curso>__<leccion>.json`: el slug de una
  // lección solo es único dentro de su curso (dos cursos de AvatarHype tienen
  // `bienvenida`). Se acepta el nombre viejo, sin prefijo, para los que todavía no se
  // regeneraron — pero el nuevo gana.
  const docSlug = (() => {
    if (!c.slug) return null;
    const conCurso = `${plan.slug}__${c.slug}`;
    if (existsSync(join(REPO, 'public', 'cono-doc', `${conCurso}.json`))) return conCurso;
    if (existsSync(join(REPO, 'public', 'cono-doc', `${c.slug}.json`))) return c.slug;
    return null;
  })();
  // La portada de la clase, si se replicó. Se pregunta por el ARCHIVO igual que el
  // documento: una ruta a una imagen que no está deja un hueco roto en la tarjeta.
  const portadaClase = c.codigo && existsSync(join(REPO, 'public', 'cono-ugc', `${c.codigo}.webp`))
    ? `/cono-ugc/${c.codigo}.webp` : null;

  clases.push({
    n: c.n,
    hasDoc: docSlug ? true : undefined,
    docSlug: docSlug ?? undefined,
    codigo: c.codigo ?? undefined,
    portadaClase: portadaClase ?? undefined,
    vn: vn || undefined,
    grupo: nombreGrupo(c.modulo),
    // 2º nivel del hub: la SECCIÓN dentro del módulo. La plataforma la muestra y el
    // portal la tiraba, así que las 24 clases de un módulo salían en una lista plana.
    subgrupo: c.submodulo ? String(c.submodulo).replace(/^\d+\.\s*/, '') : undefined,
    modulo: c.modulo ? modulos.indexOf(c.modulo) + 1 : undefined,
    titulo: c.titulo,
    // Dato factual, no una descripción inventada: duración y módulo.
    // ⚠️ Se ARMA CON LOS QUE EXISTEN, no concatenando con el separador fijo. Cuando la
    // plataforma no publica duración —«Trilogía de BRIAN TRACY» no la muestra— el
    // template dejaba el separador colgando y la tarjeta decía « · Parte 1», con el
    // punto abriendo la línea. Un separador es entre DOS cosas o no va.
    cardDesc: [c.duracion, nombreGrupo(c.modulo) ?? '']
      .filter((x) => x && String(x).trim()).join(' · '),
    videoId,
    resumen: apuntes,
    hasTx,
  });
}

// ── Emitir el módulo del curso ───────────────────────────────────────────────
// El slug del plan suele venir con «curso-de-» adelante; sin quitarlo el archivo
// queda 'curso-curso-de-…' y la constante CURSO_CURSO_DE_…
const slug = (plan.slug ?? slugDe(plan.curso)).replace(/^curso-(de-)?/, '');
const constante = `CURSO_${slug.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`;
const salida = join(REPO, 'app', 'conocimientos', `curso-${slug}.ts`);

// ⚠️ LA CATEGORÍA ES UNA DECISIÓN CURADA, Y REGENERAR NO PUEDE PISARLA. El default del
// script es 'Cursos externos'; el dueño había puesto «Inteligencia Artificial» a mano en
// el archivo. Al republicar el curso para recuperar las clases de Clonación, el curso se
// mudó solo de sección en el portal — un cambio que nadie pidió, escondido adentro de un
// arreglo de otra cosa. Lo vio el dueño.
//
// Un generador que reescribe un archivo tiene que distinguir lo que PRODUCE (las clases,
// las transcripciones, los conteos) de lo que solo TRANSPORTA (dónde va el curso en el
// menú). Lo segundo se lee del archivo que ya está y se devuelve intacto.
const categoriaPrevia = (() => {
  if (CATEGORIA || !existsSync(salida)) return '';
  const m = /^\s*categoria:\s*'([^']*)'/m.exec(readFileSync(salida, 'utf8'));
  return m ? m[1] : '';
})();
if (categoriaPrevia) console.log(`  Categoría: conservo la que ya tenía («${categoriaPrevia}»).`);

// Contra las clases del PLAN, no contra las ya construidas: el plan es el que tiene
// `modulo` y `submodulo` como texto, que es la clave del vínculo con los recursos.
const { recursos: recursosPortal, porClase: slugsPorClase } = construirRecursos(drive, plan.clases, titulosDelManifiesto(base));

// El título lleva el AUTOR, igual que la carpeta de Drive: «<Curso> - <Autor>». Si el
// título de la plataforma ya lo trae —«Curso de Claude AI - Rodrigo Rojo»— no se
// duplica. La comparación es sin acentos y sin mayúsculas: «Rodrigo Rojo» y «rodrigo
// rojo» son el mismo autor, y un duplicado en el título se ve feo en las 9 tarjetas.
const sinAcentos = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const autor = String(plan.autor ?? '').trim();
const tituloConAutor = autor && !sinAcentos(plan.curso).includes(sinAcentos(autor))
  ? `${plan.curso} - ${autor}`
  : plan.curso;

// La portada se declara SOLO si el archivo existe: un `portada` apuntando a un 404
// pinta una tarjeta con la imagen rota, que es peor que una tarjeta sin imagen.
const dirPortadas = join(REPO, 'public', 'cono-portadas');
const portada = existsSync(dirPortadas)
  ? (readdirSync(dirPortadas).find((f) => f.replace(/\.[^.]+$/, '') === slug)
      ? `/cono-portadas/${readdirSync(dirPortadas).find((f) => f.replace(/\.[^.]+$/, '') === slug)}`
      : null)
  : null;

// ⚠️ GUARDA: si hay material en disco y NO termina en la ficha, se corta acá.
//
// Esto ya pasó dos veces y las dos fueron silenciosas: el curso de Claude salió con
// `recursos: []` teniendo 20 PDFs subidos, y el de ATV con los 71 sin id porque
// `recursos/` no se copiaba a Drive. En los dos casos el generador dijo «listo», el
// portal no mostró la sección (la dibuja solo si `recursos.length > 0`) y el dueño lo
// encontró antes que nosotros.
//
// El chequeo se hace contra el DISCO, que es la fuente, no contra lo que se emitió.
const localRecursos = ['pdfs', 'recursos']
  .flatMap((sub) => existsSync(join(base, sub))
    ? readdirSync(join(base, sub), { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name)
    : []);

if (localRecursos.length && recursosPortal.length < localRecursos.length) {
  const faltan = localRecursos.length - recursosPortal.length;
  console.error(`\n  ✖ NO emito la ficha: hay ${localRecursos.length} recurso(s) en disco y solo ${recursosPortal.length} con id de Drive.`);
  console.error(`    Faltan ${faltan}. Sin id no se pueden mostrar, y emitir la ficha así la deja`);
  console.error(`    sin la sección «Recursos» sin que nada avise — que es exactamente el bug`);
  console.error(`    que esta guarda existe para no repetir.\n`);
  console.error(`    Qué hacer:`);
  console.error(`      1. node scripts/curso-a-drive.mjs --plan "${PLAN}" --solo-copiar`);
  console.error(`      2. esperar a que Drive termine de subir`);
  console.error(`      3. node scripts/curso-a-drive.mjs --plan "${PLAN}" --solo-ids`);
  console.error(`      4. volver a correr esto\n`);
  process.exit(4);
}

// ⚠️ EL CONTEO ANUNCIADO SALE DE LO QUE SE EMITE, NO DEL PLAN. `plan.clases.length`
// cuenta lo que el plan pretendía; `clases` es lo que realmente entró a la ficha, y la
// diferencia son las que se omiten por `sinFuente`. «Creator Club» anunciaba «64 clases»
// sobre un array de 62 — verificado en el navegador, no en el JSON — y ese desfase es
// justo el que hace que una pérdida real se lea como normal: si el título siempre dice
// dos más, nadie nota el día que faltan tres.
// ⚠️ `volumen` es un rótulo LIBRE al lado del conteo de clases, no el conteo otra vez.
// Emitía `${plan.clases.length} clases` y el portal pinta «N clases · <volumen>», así que
// la pantalla decía «30 CLASES · 30 CLASES». Acá va la duración total, que es el dato que
// falta y no repite ninguno; si el curso no publica duraciones, va vacío y el portal se
// come el separador (ver CursoPortal.tsx).
const segTotal = plan.clases.reduce((t, c) => {
  const p = String(c.duracion ?? '').split(':').map(Number);
  if (p.some((x) => !Number.isFinite(x))) return t;
  return t + (p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : 0);
}, 0);
const volumen = segTotal >= 3600 ? `${(segTotal / 3600).toFixed(1).replace('.', ',')} h`
  : segTotal > 0 ? `${Math.round(segTotal / 60)} min` : '';

const cuerpo = `// =============================================================================
// ${plan.curso} — portal /conocimientos
// =============================================================================
// GENERADO por scripts/curso-a-portal.mjs desde C:\\cursos\\${slug}\\.
// Regenerable: volver a correr el script sobreescribe este archivo.
//
// Va en archivo propio (y NO dentro de curso.ts) porque ESTE script se niega a escribir
// en aquél: curso.ts es el LEGADO, se mantiene A MANO y todavía tiene varios cursos
// adentro. Este archivo, en cambio, se reescribe entero en cada corrida.
//
// OJO: acá decía «porque aquél es auto-generado desde las transcripciones de
// AVATARHYPE», y es FALSO. Ningún script escribe curso.ts — medido el 22/08/2026, la
// única escritura de .ts del repo es la de este generador, y gen-curso.mjs nunca
// existió en 1755 commits. El mito viajó a 21 de los 24 archivos generados porque
// vivía en ESTA plantilla: una frase equivocada en un generador no se queda en un
// archivo, se multiplica por cada corrida.
//
// El \`resumen\` de cada clase son TUS apuntes, tomados del bloque «## Apuntes» de
// C:\\cursos\\${slug}\\texto\\<clase>.md. Escribí ahí y volvé a correr el script.
// La transcripción cruda no viaja en el bundle: vive en public/cono-tx/<videoId>.json.

import type { Curso } from './curso';

export const ${constante}: Curso = {
  slug: '${escSimple(slug)}',
  categoria: '${escSimple(CATEGORIA || categoriaPrevia || 'Cursos externos')}',
  cardDesc: '${escSimple(`${clases.length} clases en ${modulos.length} módulos.`)}',
  eyebrow: '${escSimple(EYEBROW)}',
  titulo: '${escSimple(tituloConAutor)}',
  subtitulo: '${escSimple(`${clases.length} clases, ${modulos.length} módulos. Video, transcripción y tus apuntes en un solo lugar.`)}',
  volumen: '${escSimple(volumen)}',${portada ? `\n  portada: '${escSimple(portada)}',` : ''}
  recursos: [
${recursosPortal.map((r) => `    {
      slug: '${escSimple(r.slug)}',
      label: '${escSimple(r.label)}',
      cardDesc: '${escSimple(r.cardDesc)}',
      tipo: '${escSimple(r.tipo)}',${r.badge ? `\n      badge: '${escSimple(r.badge)}',` : ''}${r.tipo === 'file' && r.ext ? `\n      ext: '${escSimple(r.ext)}',` : ''}${r.driveId ? `\n      driveId: '${escSimple(r.driveId)}',` : ''}${r.items ? `\n      items: [${r.items.map((i) => `{ label: '${escSimple(i.label)}', url: '${escSimple(i.url)}' }`).join(', ')}],` : ''}${r.clases ? `\n      clases: [${r.clases.join(', ')}],` : ''}
    },`).join('\n')}
  ],
  clases: [
${clases.map((c) => `    {
      n: ${c.n},${c.vn ? `\n      vn: ${c.vn},` : ''}${c.grupo ? `\n      grupo: '${escSimple(c.grupo)}',` : ''}${c.subgrupo ? `\n      subgrupo: '${escSimple(c.subgrupo)}',` : ''}${c.modulo ? `\n      modulo: ${c.modulo},` : ''}${c.hasDoc ? `\n      hasDoc: true,\n      docSlug: '${escSimple(c.docSlug)}',` : ''}${c.codigo ? `\n      codigo: '${escSimple(c.codigo)}',` : ''}${c.portadaClase ? `\n      portadaClase: '${escSimple(c.portadaClase)}',` : ''}
      titulo: '${escSimple(c.titulo)}',
      cardDesc: '${escSimple(c.cardDesc)}',
      videoId: ${c.videoId ? `'${c.videoId}'` : 'null'},
      resumen: ${c.resumen ? `\`${esc(c.resumen)}\`` : `''`},
      transcripcion: [],${c.hasTx ? '\n      hasTx: true,' : ''}
      recursoSlugs: [${(slugsPorClase.get(c.n) ?? []).map((s) => `'${s}'`).join(', ')}],
      herramientas: [],
    },`).join('\n')}
  ],
};
`;

// ⚠️ REGENERAR NO PUEDE VACIAR UNA LISTA DE RECURSOS QUE YA ESTABA PUBLICADA.
//
// El generador arma `recursos` mirando `drive.recursos`, o sea la carpeta LOCAL del
// curso. Cuando esa carpeta no tiene nada —porque los archivos viven solo en Drive, o
// porque el curso se bajó por otro camino— emite `recursos: []` y PISA lo que la ficha
// publicaba. No falla, no avisa: la sección «Recursos» simplemente deja de dibujarse,
// porque `CursoPortal` la muestra solo si `recursos.length > 0`.
//
// Pasó el 22/08/2026 con BlueHacker: migrarlo de 233 a 404 clases borró sus 8 PDFs de
// la ficha. No lo cazó ningún test ni ningún chequeo del pipeline — lo vio el dueño,
// mirando la pantalla, y el commit decía «404 clases publicadas» como si todo hubiera
// salido bien. Una regeneración que AGREGA 171 clases y RESTA 8 recursos se lee como
// una ganancia neta y no lo es.
//
// La guarda va en POSITIVO y corta: se emite la ficha solo si no se está perdiendo
// nada. La salida es `--sin-recursos`, explícita, para el caso legítimo de que el
// curso de verdad se haya quedado sin material.
const fichaPrevia = existsSync(salida) ? readFileSync(salida, "utf8") : "";
const recursosPrevios = fichaPrevia ? (fichaPrevia.match(/^\s{4}slug: '/gm) ?? []).length : 0;
if (recursosPrevios > 0 && recursos.length === 0 && !tiene("sin-recursos")) {
  console.error(`
  ✖ NO emito la ficha: se perderían ${recursosPrevios} recurso(s) que ya están publicados.

    La ficha actual (${basename(salida)}) declara ${recursosPrevios} recurso(s) y esta corrida
    no encontró ninguno, porque no hay archivos en la carpeta local del curso.
    Escribirla igual los borraría de la pantalla sin que nadie se entere.

    Las dos salidas:
      · Si los archivos viven SOLO en Drive, sacalos del archivo generado y pasalos a
        un curso-<slug>-recursos.ts inyectado desde catalogo.ts (ver RECURSOS_UGC y
        RECURSOS_BLUEHACKER). Ahí sobreviven a cualquier regeneración.
      · Si de verdad ya no hay material: --sin-recursos
`);
  process.exit(4);
}

// LAS HUÉRFANAS SE ABORTAN, NO SE AVISAN. El plan dice que la fuente SÍ tiene ese video,
// así que no tenerlo es material perdido, no una clase inexistente. Un `console.log` acá
// es un aviso que nadie lee (el generador imprime veinte líneas), y la ficha sale igual
// con menos clases de las que el curso tiene. Se corta, como ya se corta con los recursos.
//
// ⚠️ Y VA ANTES DEL `writeFileSync`, QUE ES DONDE ESTE MISMO BLOQUE NO ESTABA. Vivía ocho
// líneas DESPUÉS del write: imprimía «NO emito la ficha», salía con código 1… y el
// archivo ya estaba escrito en disco, recortado —las huérfanas se sacan del array mucho
// antes—, con su `subtitulo: '33 clases'` al lado de un array de 31. O sea que el mensaje
// decía exactamente lo contrario de lo que había pasado. La guarda gemela, la de
// recursos, sí corta antes de que `cuerpo` exista: se copió el mensaje y no la posición.
//
// La regla: una guarda que dice «no emito» corre ANTES de emitir. Si el chequeo depende
// de datos que recién existen al final, se escribe a un temporal y se renombra al pasar.
if (huerfanas.length) {
  console.error(`\n  ✖ NO emito la ficha: ${huerfanas.length} clase(s) tienen \`sinFuente: false\` —la plataforma SÍ las tiene— y no tienen id de Drive.`);
  for (const c of huerfanas) console.error(`      n=${c.n}  ${String(c.titulo).slice(0, 58)}`);
  console.error(`\n    Están bajadas y transcriptas, lo que falta es el id. Casi siempre alcanza con:`);
  console.error(`      node scripts/curso-a-drive.mjs --plan ${PLAN} --solo-ids\n`);
  console.error(`    (La ficha anterior queda intacta: no se tocó.)\n`);
  process.exit(1);
}

writeFileSync(salida, cuerpo, 'utf8');

console.log(`\n  Curso : ${plan.curso}`);
console.log(`  Clases: ${clases.length} · ${conTx} con transcripción · ${conApuntes} con apuntes tuyos`);

if (muertas.length) {
  console.log(`  ⚠ ${muertas.length} clase(s) del plan NO entran: \`sinFuente: true\`, la fuente no las tiene.`);
  for (const c of muertas.slice(0, 5)) console.log(`      n=${c.n}  ${c.titulo.slice(0, 58)}`);
}

// ⚠️ SIN PORTADA SE AVISA, aunque no sea un error.
//
// La ficha sin `portada` no rompe nada: la tarjeta sale sin imagen y el curso funciona.
// Por eso pasaron TRES cursos seguidos (Stories Master, Claude Academy 2026 y Cursos
// HeyGen) publicados, verificados en el navegador y commiteados sin tapa, sin que en
// ningún momento nada lo dijera. El dueño lo vio antes que nosotros.
//
// Es el mismo modo de falla que persigue todo este archivo: el proceso reporta éxito y
// el material no aparece. Un hueco que no se nombra es un hueco que se entrega.
if (!portada) {
  console.log(`\n  ⚠ ESTE CURSO NO TIENE PORTADA. La tarjeta va a salir sin imagen.`);
  console.log(`    Se baja de la plataforma en una sola request (sin navegador):`);
  console.log(`      node scripts/curso-portada.mjs --plan ${PLAN}`);
  console.log(`    …y después volvé a correr ESTE script, que es el que la declara.`);
}
if (sinTx) console.log(`  ⚠ ${sinTx} sin transcripción todavía (volvé a correr esto cuando terminen)`);
console.log(`\n  → ${salida}`);
console.log(`  → ${dirTx}\\<videoId>.json  (${conTx} archivo/s)`);
// ⚠️ El curso se suma en app/conocimientos/catalogo.ts y en NINGÚN otro lado.
// Antes la lista estaba escrita dos veces (el portal del admin y el link
// compartido armaban la suya), y un curso que faltaba en la del compartido se
// podía compartir desde la UI con el link dando 404, sin ningún síntoma del lado
// del admin. Ver docs/hallazgos-conocimiento.md → «el link compartido daba 404».
console.log(`\n  Falta UN paso a mano en app/conocimientos/catalogo.ts:`);
console.log(`    import { ${constante} } from './curso-${slug}';`);
console.log(`    …y sumarlo al array CURSOS_TODOS.`);
console.log(`\n  Es el ÚNICO lugar: esa lista la consumen el portal del admin y el link`);
console.log(`  compartido. Sumarlo en Conocimientos.tsx en vez de acá deja el link en 404.\n`);
