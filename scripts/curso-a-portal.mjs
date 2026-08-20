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
const construirRecursos = (drive, planClases) => {
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
    const slug = slugRecurso(r.archivo);
    if (recursos.some((x) => x.slug === slug)) continue; // slug único, sin pisar
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

    if (r.nivel === 'clase') {
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

    let label = r.archivo.replace(/\.[^.]+$/, '');
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
      driveId: esEnlace ? null : r.driveId,
      items: esEnlace ? [{ label: `Abrir ${label}`, url: r.url }] : null,
      label,
      cardDesc: esEnlace ? `Enlace · ${desc.replace(/^Material de /, '')}` : desc,
      clases: deClases.length ? deClases : undefined,
    });
    for (const n of deClases) colgar(n, slug);
  }
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
  if (!videoId) { (c.sinFuente === false ? huerfanas : muertas).push(c); continue; }
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
  const docSlug = c.slug && existsSync(join(REPO, 'public', 'cono-doc', `${c.slug}.json`)) ? c.slug : null;
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
    grupo: c.modulo ? c.modulo.replace(/^\d+\.\s*/, '') : undefined,
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
    cardDesc: [c.duracion, c.modulo ? String(c.modulo).replace(/^\d+\.\s*/, '') : '']
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
const { recursos: recursosPortal, porClase: slugsPorClase } = construirRecursos(drive, plan.clases);

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
// Va en archivo propio (y NO dentro de curso.ts) porque aquél es auto-generado
// desde las transcripciones de AVATARHYPE: lo que se escriba ahí se pierde.
//
// El \`resumen\` de cada clase son TUS apuntes, tomados del bloque «## Apuntes» de
// C:\\cursos\\${slug}\\texto\\<clase>.md. Escribí ahí y volvé a correr el script.
// La transcripción cruda no viaja en el bundle: vive en public/cono-tx/<videoId>.json.

import type { Curso } from './curso';

export const ${constante}: Curso = {
  slug: '${slug}',
  categoria: '${esc(CATEGORIA || categoriaPrevia || 'Cursos externos')}',
  cardDesc: '${esc(`${plan.clases.length} clases en ${modulos.length} módulos.`)}',
  eyebrow: '${esc(EYEBROW)}',
  titulo: '${esc(tituloConAutor)}',
  subtitulo: '${esc(`${plan.clases.length} clases, ${modulos.length} módulos. Video, transcripción y tus apuntes en un solo lugar.`)}',
  volumen: '${esc(volumen)}',${portada ? `\n  portada: '${portada}',` : ''}
  recursos: [
${recursosPortal.map((r) => `    {
      slug: '${r.slug}',
      label: '${esc(r.label)}',
      cardDesc: '${esc(r.cardDesc)}',
      tipo: '${r.tipo}',${r.tipo === 'file' && r.ext ? `\n      ext: '${esc(r.ext)}',` : ''}${r.driveId ? `\n      driveId: '${r.driveId}',` : ''}${r.items ? `\n      items: [${r.items.map((i) => `{ label: '${esc(i.label)}', url: '${esc(i.url)}' }`).join(', ')}],` : ''}${r.clases ? `\n      clases: [${r.clases.join(', ')}],` : ''}
    },`).join('\n')}
  ],
  clases: [
${clases.map((c) => `    {
      n: ${c.n},${c.vn ? `\n      vn: ${c.vn},` : ''}${c.grupo ? `\n      grupo: '${esc(c.grupo)}',` : ''}${c.subgrupo ? `\n      subgrupo: '${esc(c.subgrupo)}',` : ''}${c.modulo ? `\n      modulo: ${c.modulo},` : ''}${c.hasDoc ? `\n      hasDoc: true,\n      docSlug: '${esc(c.docSlug)}',` : ''}${c.codigo ? `\n      codigo: '${esc(c.codigo)}',` : ''}${c.portadaClase ? `\n      portadaClase: '${esc(c.portadaClase)}',` : ''}
      titulo: '${esc(c.titulo)}',
      cardDesc: '${esc(c.cardDesc)}',
      videoId: ${c.videoId ? `'${c.videoId}'` : 'null'},
      resumen: ${c.resumen ? `\`${esc(c.resumen)}\`` : `''`},
      transcripcion: [],${c.hasTx ? '\n      hasTx: true,' : ''}
      recursoSlugs: [${(slugsPorClase.get(c.n) ?? []).map((s) => `'${s}'`).join(', ')}],
      herramientas: [],
    },`).join('\n')}
  ],
};
`;

writeFileSync(salida, cuerpo, 'utf8');

console.log(`\n  Curso : ${plan.curso}`);
console.log(`  Clases: ${clases.length} · ${conTx} con transcripción · ${conApuntes} con apuntes tuyos`);
// LAS HUÉRFANAS SE ABORTAN, NO SE AVISAN. El plan dice que la fuente SÍ tiene ese video,
// así que no tenerlo es material perdido, no una clase inexistente. Un `console.log` acá
// es un aviso que nadie lee (el generador imprime veinte líneas), y la ficha sale igual
// con menos clases de las que el curso tiene. Se corta, como ya se corta con los recursos.
if (huerfanas.length) {
  console.error(`\n  ✖ NO emito la ficha: ${huerfanas.length} clase(s) tienen \`sinFuente: false\` —la plataforma SÍ las tiene— y no tienen id de Drive.`);
  for (const c of huerfanas) console.error(`      n=${c.n}  ${String(c.titulo).slice(0, 58)}`);
  console.error(`\n    Están bajadas y transcriptas, lo que falta es el id. Casi siempre alcanza con:`);
  console.error(`      node scripts/curso-a-drive.mjs --plan ${PLAN} --solo-ids\n`);
  process.exit(1);
}

if (muertas.length) {
  console.log(`  ⚠ ${muertas.length} clase(s) del plan NO entran: \`sinFuente: true\`, la fuente no las tiene.`);
  for (const c of muertas.slice(0, 5)) console.log(`      n=${c.n}  ${c.titulo.slice(0, 58)}`);
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
