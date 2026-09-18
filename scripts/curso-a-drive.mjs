// Copia el curso a Google Drive ORGANIZADO por módulo y devuelve el videoId de
// cada clase, que es lo que consume DRIVE_PREVIEW en app/conocimientos.
//
// Por qué no hay OAuth acá: Drive for Desktop ya tiene la cuenta montada en G:.
// Copiar dentro de G:\My Drive es la subida — Drive la hace en background, con
// reintentos propios. Y el file id no hace falta pedirlo por API: Drive mantiene
// una SQLite local (metadata_sqlite_db) cuya tabla `items` tiene `id` (el file id
// de Drive) junto a `local_title`. Se lee con node:sqlite, copiando la DB antes
// porque Drive la tiene lockeada.
//
// Estructura que deja:
//   G:\My Drive\MARKETING KONCEPT\CURSOS\<Curso>\<NN Módulo>\<NN - Clase>.mp4
//                                              \PDFs\
//                                              \texto\
//
// A Drive va SIEMPRE el archivo tal cual se bajó (máxima calidad): no se recodifica
// ni se baja de resolución en ningún punto.
//
// --liberar borra el original LOCAL, y solo el que cumple las CINCO condiciones:
// está dentro de video/, tiene id de Drive, la copia en G: coincide byte a byte, el
// propio Drive reporta ese mismo tamaño (o sea: terminó de subir, no solo de
// registrarse), y YA DIO LO SUYO —el video no es solo un archivo a resguardar, es la
// ENTRADA de la transcripción—. Cualquier duda = se conserva. Y solo actúa si queda
// menos de --min-libre-gb libre, así que con espacio de sobra no borra nada.
//
// ⚠️ «Ya dio lo suyo» se cumple con el AUDIO EXTRAÍDO **o** con la TRANSCRIPCIÓN escrita,
// y la segunda es la evidencia más fuerte: es el producto final de esa cadena. La versión
// vieja pedía solo el audio, y como el audio es un intermedio que se borra para recuperar
// disco (~40 GB en 130 cursos), terminaba conservando videos de clases transcriptas hace
// semanas diciendo «todavía no se le extrajo el audio». Falso, y conservador de más.
//
//   node <abs>\scripts\curso-a-drive.mjs --plan C:\cursos\<slug>\plan.json
//   node <abs>\scripts\curso-a-drive.mjs --plan … --solo-ids   # sin copiar, solo leer ids
//   node <abs>\scripts\curso-a-drive.mjs --plan … --liberar    # + limpiar local si falta espacio
//   node <abs>\scripts\curso-a-drive.mjs --plan … --liberar --min-libre-gb 99999  # limpiar siempre

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, statSync, readdirSync, unlinkSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { esIntermedio, nDeArchivo } from './curso-comun.mjs';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const tiene = (n) => process.argv.includes(`--${n}`);

const PLAN = arg('plan', '');
const DRIVE = arg('drive', 'G:\\My Drive\\MARKETING KONCEPT\\CURSOS');
const DFS = arg('dfs', join(process.env.LOCALAPPDATA ?? '', 'Google\\DriveFS'));
const MINUTOS = Number(arg('minutos', 20)); // tope de espera a que Drive registre
const LIBERAR = tiene('liberar');           // borrar el local una vez CONFIRMADO arriba
const MIN_LIBRE = Number(arg('min-libre-gb', 25)); // solo libera si queda menos que esto

if (!PLAN || !existsSync(PLAN)) { console.error('\n  ✖ Falta --plan <plan.json>\n'); process.exit(1); }
// .replace del BOM: en PowerShell 5.1 «Set-Content -Encoding utf8» escribe UTF-8
// CON BOM, y JSON.parse de Node revienta con «Unexpected token '﻿'». Cualquier
// edición del plan desde PowerShell lo reintroduce, así que se limpia al leer.
const plan = JSON.parse(readFileSync(PLAN, 'utf8').replace(/^﻿/, ''));
const base = dirname(PLAN);

const limpio = (s) => String(s).normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
  .replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 120);
const mb = (b) => (b / 1048576).toFixed(1);

// ⚠️ El archivo de una clase se busca por NÚMERO y excluyendo los intermedios de
// yt-dlp. Antes era `f.startsWith(c.archivo)` con `cand[0]`, y alfabéticamente
// «.fhls-…mp4» gana al «.mp4» limpio: se subieron a Drive TRES intermedios (500 MB)
// que tienen solo la pista de VIDEO, sin audio.
//
// Y el mecanismo de fondo, que es lo que hay que recordar: la copia incremental corre
// MIENTRAS el descargador escribe, así que captura sus archivos transitorios — y
// cuando yt-dlp los mergea y los borra en local, las copias del destino SOBREVIVEN.
// Copiar un directorio que otro proceso está escribiendo deja basura permanente aguas
// abajo. El mismo filtro vive en curso-audio.mjs, por lo mismo.
// esIntermedio y nDeArchivo viven en curso-comun.mjs: estaban copiados acá, en
// curso-audio.mjs y en curso-organizar.mjs, con el mismo bug en los tres.
// video/ puede estar plano u organizado en «<NN Módulo>/» (ver curso-organizar.mjs),
// así que se camina un nivel. Devuelve rutas relativas a dirVideo.
const listarUnNivel = (dir) => !existsSync(dir) ? [] : readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => e.isDirectory()
    ? readdirSync(join(dir, e.name)).map((f) => join(e.name, f))
    : [e.name]);
const videoDeClase = (dirVideo, c) => listarUnNivel(dirVideo)
  .filter((f) => /\.(mp4|mkv|webm|m4v)$/i.test(f) && !esIntermedio(basename(f)) && nDeArchivo(basename(f)) === c.n);

/**
 * ¿El video trae pista de audio? Mismo criterio que `curso-audio.mjs`, que es quien
 * decide si vale la pena intentar extraerla. Ante la duda devuelve `true`: «no pude
 * averiguarlo» nunca puede habilitar un borrado.
 */
const videoTieneAudio = (src) => {
  try {
    const p = execFileSync('ffmpeg', ['-hide_banner', '-i', src], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return /Stream #\d+:\d+.*: Audio:/i.test(String(p));
  } catch (e) {
    const txt = String(e.stderr ?? '') + String(e.stdout ?? '');
    if (!/Stream #\d+:\d+/.test(txt)) return true;
    return /Stream #\d+:\d+.*: Audio:/i.test(txt);
  }
};

/** ¿Existe `<raiz>.md` en texto/, esté suelto o dentro de una carpeta de módulo? */
const hayTx = (dirTexto, raiz) => {
  if (!raiz || !existsSync(dirTexto)) return false;
  const objetivo = `${raiz}.md`;
  const buscar = (d) => readdirSync(d, { withFileTypes: true }).some((e) => (e.isDirectory()
    ? buscar(join(d, e.name))
    : e.name === objetivo));
  try { return buscar(dirTexto); } catch { return false; }
};

import { idsDeDrive as idsDeDriveBase, esIdReal } from './curso-drive-ids.mjs';
// El DFS del script se pasa explicito: el modulo tiene su propio default.
const idsDeDrive = (nombres, carpetaCurso = null) => idsDeDriveBase(nombres, carpetaCurso, DFS);

// ── 1. Copiar (= subir) ──────────────────────────────────────────────────────
// La convención de la carpeta en Drive es «<Curso> - <Autor>», y la cumplen 36 de
// las 39 carpetas de CURSOS. El autor sale del plan (--autor en curso-plan-vip),
// porque la API de la plataforma no lo trae. Separador: guión normal, que es el que
// usan 33 de las 36 (las otras 3 tienen guión largo, que no se replica a propósito).
// ⚠️ Y NO se suma el autor si el título ya lo nombra. Sin esto, «Jaque Blue -
// Creacion de Contenido» de Jaque Blue producía la carpeta «Jaque Blue - Creacion de
// Contenido - Jaque Blue». Es la misma regla que aplica curso-a-portal.mjs
// (`tituloConAutor`) y el mapa AUTOR de app/conocimientos/catalogo.ts: si las tres
// divergen, el mismo curso se llama distinto en Drive y en el portal.
const sinAcentos = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const autorPlan = plan.autor?.trim() ?? '';
const nombreCurso = autorPlan && !sinAcentos(plan.curso).includes(sinAcentos(autorPlan))
  ? `${limpio(plan.curso)} - ${limpio(autorPlan)}`
  : limpio(plan.curso);
// ⚠️ SI YA EXISTE UNA CARPETA QUE ES LA MISMA SALVO ACENTOS, SE USA ESA.
//
// El nombre de la carpeta no es una etiqueta: es la CLAVE que decide dónde se escribe.
// Y sale de concatenar dos campos de texto libre del plan, así que cualquier diferencia
// invisible la parte en dos: un acento, un espacio doble, una forma Unicode distinta
// (NFC vs NFD, que se ven idénticas en cualquier listado).
//
// Pasó el 23/8/2026 con MasteryHaus. La carpeta existente decía «Sofia Contreras» y el
// plan traía «Sofía». Nació una SEGUNDA carpeta con 23 videos y 60 GB, para el mismo
// curso, y no falló nada: ni un error, ni un aviso. Un destino equivocado no da 404 —
// se crea solo y se llena, y todo el proceso reporta éxito.
//
// Por eso crear es la ÚLTIMA opción: primero se busca un destino que matchee sin
// acentos y sin mayúsculas, y si aparece se usa ese, avisando del desvío.
const igualSalvoAcentos = (a, b) => sinAcentos(a).replace(/\s+/g, " ").trim().toLowerCase()
  === sinAcentos(b).replace(/\s+/g, " ").trim().toLowerCase();
let dirCurso = join(DRIVE, nombreCurso);
if (!existsSync(dirCurso) && existsSync(DRIVE)) {
  const gemela = readdirSync(DRIVE, { withFileTypes: true })
    .filter((d) => d.isDirectory() && igualSalvoAcentos(d.name, nombreCurso))
    .map((d) => d.name)[0];
  if (gemela) {
    console.log(`\n  ⚠ Ya existe «${gemela}», que es la misma carpeta salvo acentos.`);
    console.log(`    Uso esa en vez de crear «${nombreCurso}»: dos carpetas para un curso`);
    console.log(`    parten el material en dos sin que nada falle.`);
    dirCurso = join(DRIVE, gemela);
  }
}
if (!plan.autor?.trim()) {
  console.log(`\n  ⚠ El plan no trae autor, así que la carpeta va a quedar «${nombreCurso}»`);
  console.log(`    y sin el « - Autor» que usan las otras 36. Agregá "autor" al plan.json.`);
}
const esperados = []; // { nombre, clase }

if (!tiene('solo-ids')) {
  if (!existsSync(DRIVE)) {
    console.error(`\n  ✖ No existe ${DRIVE}\n    ¿Está Drive for Desktop montado en G:? Pasá otra ruta con --drive\n`);
    process.exit(1);
  }
  mkdirSync(dirCurso, { recursive: true });
  console.log(`\n  Destino: ${dirCurso}\n`);

  const dirVideo = join(base, 'video');
  let copiados = 0, ya = 0, sinArchivo = 0;

  for (const c of plan.clases) {
    const cand = videoDeClase(dirVideo, c);
    if (!cand.length) { console.log(`  ⚠ ${c.archivo} — no está bajado todavía`); sinArchivo++; continue; }

    // `cand[0]` puede venir con su subcarpeta de módulo si el local está organizado.
    // El NOMBRE pelado es lo que va al destino y lo que se busca en la metadata de
    // Drive: dejar la subcarpeta adentro anidaría «módulo/módulo/archivo» y la
    // búsqueda del id por `local_title` no encontraría nada.
    const src = join(dirVideo, cand[0]);
    const archivo = basename(cand[0]);
    const mod = limpio(c.modulo ?? 'Sin módulo').replace(/^(\d+)\.\s*/, (_, n) => `${String(n).padStart(2, '0')} `);
    const dstDir = join(dirCurso, mod);
    mkdirSync(dstDir, { recursive: true });
    const dst = join(dstDir, archivo);
    esperados.push({ nombre: archivo, clase: c, src, dst });

    if (existsSync(dst) && statSync(dst).size === statSync(src).size) { console.log(`  = ${mod}\\${archivo}`); ya++; continue; }
    process.stdout.write(`  ↑ ${mod}\\${archivo} (${mb(statSync(src).size)} MB) … `);
    copyFileSync(src, dst);
    console.log('copiado');
    copiados++;
  }

  // PDFs y texto, si están.
  // `recursos/` estaba FUERA de esta lista, así que los 71 archivos de un curso de
  // /vip/ se bajaban, se contaban como completos… y nunca subían a Drive. El síntoma
  // aparecía dos pasos después: 0/71 recursos con id, y la sección «Recursos» del
  // portal vacía. Los tres directorios de material van acá.
  for (const [sub, etiqueta] of [['pdfs', 'PDFs'], ['recursos', 'Recursos'], ['texto', 'texto']]) {
    const d = join(base, sub);
    if (!existsSync(d)) continue;
    const dst = join(dirCurso, etiqueta);
    mkdirSync(dst, { recursive: true });
    let n = 0;
    // ⚠️ `texto/` puede estar organizado en subcarpetas de módulo (curso-organizar.mjs),
    // así que hay entradas que son DIRECTORIOS. Tratar todo como archivo revienta con
    // EPERM al hacer copyFileSync sobre una carpeta — y el error no dice «es un
    // directorio», dice «operation not permitted», que manda a buscar permisos.
    // Se camina un nivel y se replica la estructura.
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) {
        const sd = join(d, e.name), sdst = join(dst, e.name);
        mkdirSync(sdst, { recursive: true });
        for (const f of readdirSync(sd, { withFileTypes: true }).filter((x) => x.isFile())) {
          const a = join(sd, f.name), b = join(sdst, f.name);
          if (existsSync(b) && statSync(b).size === statSync(a).size) continue;
          copyFileSync(a, b); n++;
        }
        continue;
      }
      const a = join(d, e.name), b = join(dst, e.name);
      if (existsSync(b) && statSync(b).size === statSync(a).size) continue;
      copyFileSync(a, b); n++;
    }
    if (n) console.log(`  ↑ ${etiqueta}: ${n} archivo(s)`);
  }

  console.log(`\n  ${copiados} copiado(s) · ${ya} ya estaban${sinArchivo ? ` · ${sinArchivo} sin bajar` : ''}`);

  // --solo-copiar: para correr EN PARALELO con la descarga. Copiar a G: es
  // instantáneo (Drive sube después, en su propio background), pero resolver los
  // ids exige esperar a que la subida TERMINE del lado del servidor — y eso puede
  // ser media hora. Se separan: copiar cada ronda, resolver ids una sola vez al
  // final con --solo-ids.
  if (tiene('solo-copiar')) {
    console.log(`  (--solo-copiar: no espero los ids. Al final: --solo-ids)\n`);
    process.exit(0);
  }
} else {
  for (const c of plan.clases) {
    const dirVideo = join(base, 'video');
    const cand = videoDeClase(dirVideo, c);
    if (!cand.length) continue;
    const mod = limpio(c.modulo ?? 'Sin módulo').replace(/^(\d+)\.\s*/, (_, n) => `${String(n).padStart(2, '0')} `);
    const archivo = basename(cand[0]);
    esperados.push({ nombre: archivo, clase: c, src: join(dirVideo, cand[0]), dst: join(dirCurso, mod, archivo) });
  }
}

// ⚠️ «NO HAY VIDEOS QUE MAPEAR» NO ES «NO HAY NADA QUE HACER». Los videos se liberan del
// disco local después de subirlos (--liberar), así que en un curso ya procesado esta lista
// SIEMPRE queda vacía — y abortar acá dejaba a los RECURSOS sin poder conseguir su id de
// Drive, aunque estuvieran copiados y esperando del otro lado. Pasó con los 56 de
// «Hackeando la Edición»: subidos a Drive, y el script cortaba antes de mapearlos.
//
// Se mira el DISCO y no `recursosLocales`, que se arma 60 líneas más abajo.
const hayRecursosLocales = ['recursos', 'pdfs']
  .some((sub) => existsSync(join(base, sub)) && readdirSync(join(base, sub)).length > 0);
if (!esperados.length && !hayRecursosLocales) {
  console.error('\n  ✖ No hay nada para mapear: ni videos en video/ ni archivos en recursos/ o pdfs/.\n');
  process.exit(1);
}
if (!esperados.length) console.log('\n  (sin videos locales que mapear —ya se liberaron—: sigo con los recursos)');

// ── 2. Esperar a que Drive registre y leer los ids ───────────────────────────
console.log(`\n  Esperando a que Drive suba y registre (tope ${MINUTOS} min)…`);
console.log('  (el id aparece cuando el archivo existe del lado del servidor)\n');

const pendientes = new Map(esperados.map((e) => [e.nombre, e.clase]));
const resueltos = new Map();
const t0 = Date.now();

let vuelta = 0;
while (pendientes.size && Date.now() - t0 < MINUTOS * 60000) {
  const r = idsDeDrive([...pendientes.keys()], basename(dirCurso));
  if (r.error) { console.error(`  ✖ ${r.error}\n`); process.exit(1); }
  for (const [nombre, info] of r.ids) {
    if (info.ambiguo) {
      console.log(`  ⚠ ${nombre} — ${info.ambiguo} archivos con ese nombre en tu Drive; tomo el primero`);
    }
    resueltos.set(nombre, { ...info, clase: pendientes.get(nombre) });
    console.log(`  ✓ ${nombre}  →  ${info.id}`);
    pendientes.delete(nombre);
  }
  // Distinguir "Drive todavía no lo vio" de "lo registró y está subiendo": son
  // dos estados distintos y el segundo es progreso, no un problema.
  if (pendientes.size && vuelta++ % 6 === 0) {
    const subiendo = r.enVuelo?.size ?? 0;
    const mins = Math.round((Date.now() - t0) / 60000);
    console.log(`  … ${resueltos.size} con id · ${subiendo} subiendo · ${pendientes.size - subiendo} sin registrar aún  (${mins} min)`);
  }
  if (pendientes.size) await new Promise((r2) => setTimeout(r2, 10000));
}

// ── 3. Salida lista para el portal ───────────────────────────────────────────
const clases = esperados
  .filter((e) => resueltos.has(e.nombre))
  .map((e) => {
    const { id } = resueltos.get(e.nombre);
    const c = e.clase;
    return {
      n: c.n, titulo: c.titulo, duracion: c.duracion, modulo: c.modulo,
      videoId: id,
      preview: `https://drive.google.com/file/d/${id}/preview`,
      archivo: e.nombre,
    };
  });

// ── Los RECURSOS también necesitan su id de Drive ────────────────────────────
// Sin esto el portal no puede mostrarlos: `Recurso.driveId` es lo que abre el visor,
// y el array `recursos` vacío hace que la sección entera no exista (CursoPortal
// dibuja «Recursos» solo si `curso.recursos.length > 0`). Los PDFs se bajaban, se
// subían a Drive… y no aparecían en ningún lado.
//
// Dos orígenes con naming distinto, y la diferencia importa:
//   pdfs/     → los produce curso-pdfs.mjs y el número es la CLASE
//   recursos/ → los produce curso-recursos-vip.mjs y el número es el MÓDULO
// recursos.json (lo escribe curso-recursos-vip.mjs) trae el módulo de cada archivo.
// Sin arrastrarlo hasta acá, el portal no puede colgar el recurso de SUS clases.
const idxRecursos = existsSync(join(base, 'recursos.json'))
  ? new Map((JSON.parse(readFileSync(join(base, 'recursos.json'), 'utf8').replace(/^﻿/, '')).items ?? [])
      .map((i) => [i.nombre, i]))
  : new Map();

const recursosLocales = [];
for (const [sub, nivel] of [['pdfs', 'clase'], ['recursos', 'modulo']]) {
  const d = join(base, sub);
  if (!existsSync(d)) continue;
  for (const f of readdirSync(d, { withFileTypes: true }).filter((e) => e.isFile())) {
    const meta = idxRecursos.get(f.name);
    recursosLocales.push({
      archivo: f.name, sub,
      // ⚠️ La CARPETA es el default del nivel, el ÍNDICE es el dato. Un curso puede tener
      // sus archivos en pdfs/ y aun así ser material de MÓDULO — pasó con los 92 de
      // BlueHacker: se bajaron ahí, el generador les buscó una clase por el prefijo
      // numérico del nombre, y 51 de 53 quedaron colgados de la clase equivocada.
      // Corregirlo a mano en drive.json no dura: la próxima corrida reconstruye la lista
      // desde el disco y lo pisa. Con esto, el arreglo vive en recursos.json y sobrevive.
      nivel: meta?.nivel ?? nivel,
      modulo: meta?.modulo ?? null,
      // ⚠️  viaja TAMBIÉN. Es lo que cuelga cada recurso de sus lecciones, y sin
      // él la ficha sale con la sección «Recursos» llena y CERO clases con material —
      // que es como quedó MasteryHaus la primera vez: 62 recursos, 0 recursoSlugs.
      clases: meta?.clases ?? null,
      // ⚠️ Y EL TÍTULO REAL TAMBIÉN, que es el tercero de la misma terna y se olvidó dos
      // veces. El generador tiene `if (r.tituloReal) label = r.tituloReal`, o sea que ya
      // sabía qué hacer con él — lo que faltaba era que llegara. Sin esto, un curso cuyos
      // archivos quedaron con nombre genérico publica los 38 recursos llamados
      // «recurso-01»…«recurso-38». Pasó con Iman Gadzhi: 38 de 38, con los títulos de
      // verdad («Profit First», «The Culture Code») esperando en recursos.json.
      //
      // La lección, que es la que se repite: cuando un dato tiene que cruzar tres
      // archivos, agregar UN campo al índice no alcanza — hay que seguirlo hasta el
      // final. `nivel` y `clases` se arreglaron el 24/08 en esta misma línea y
      // `tituloReal` quedó afuera, con el bug intacto y con cara de arreglado.
      tituloReal: meta?.tituloReal ?? null,
      submodulo: meta?.submodulo ?? null,
    });
  }
}

// Los recursos de tipo LINK no son archivos: no se copian ni tienen id de Drive, pero
// sí van a la ficha. Salen de recursos.json y se pasan derecho, con su URL.
const enlaces = [...idxRecursos.values()]
  .filter((i) => i.tipo === 'link' && i.url)
  .map((i) => ({
    archivo: i.nombre, nivel: 'modulo', tipo: 'link', url: i.url,
    modulo: i.modulo ?? null, submodulo: i.submodulo ?? null,
  }));

const recursos = [];
if (recursosLocales.length) {
  console.log(`\n  Resolviendo id de ${recursosLocales.length} recurso(s)…`);
  const r = idsDeDrive(recursosLocales.map((x) => x.archivo), basename(dirCurso));
  if (!r.error) {
    // ⚠️ UN RECURSO SIN ID SE ANOTA IGUAL, con `driveId: null`. Descartarlo lo hacía
    // DESAPARECER de drive.json, y como el archivo se fusiona con lo previo, la corrida
    // siguiente tampoco tenía qué completar: el recurso quedaba en un limbo permanente —
    // bajado en disco, copiado a Drive, y ausente del único índice que lo puede publicar.
    // Medido: 5 de 8 cursos del lote quedaron así, con 129 archivos en disco y 0 anotados.
    //
    // Anotado con `driveId: null`, la próxima corrida lo encuentra y le pone el id cuando
    // Drive termina. Y el generador del portal ya sabe ignorar los que no lo tienen.
    for (const x of recursosLocales) {
      const info = r.ids.get(x.archivo);
      recursos.push({
        archivo: x.archivo, nivel: x.nivel, clases: x.clases ?? undefined, driveId: info?.id ?? null,
        tituloReal: x.tituloReal ?? undefined,
        modulo: x.modulo, submodulo: x.submodulo,
      });
    }
  }
  const sin = recursos.filter((x) => !x.driveId).length;
  console.log(`  ${recursos.length - sin}/${recursosLocales.length} con id${sin ? ` · ⚠ ${sin} sin id (Drive sigue subiendo; quedan anotados para la próxima)` : ''}`);
}

if (enlaces.length) console.log(`  + ${enlaces.length} enlace(s) (no son archivos: van sin id de Drive)`);

// ⚠️ SE FUSIONA CON EL drive.json QUE YA ESTÁ. NO SE PISA.
//
// Este archivo se arma desde lo que hay en el DISCO LOCAL, y los videos se liberan de
// local en cuanto suben (--liberar). O sea: en un curso ya procesado, `clases` se
// calcula vacío. Escribirlo tal cual borra los 64 videoId que costaron una noche de
// descarga, sin decir nada — y el síntoma aparece dos pasos después, cuando el portal
// no encuentra ningún video.
//
// Pasó HOY, subiendo los 56 recursos de «Hackeando la Edición»: el drive.json quedó con
// 0 clases y 56 recursos. Se recuperó del backup, y por eso ahora se fusiona: una
// entrada nueva pisa a la vieja del mismo `n`, pero una vieja que ya no está en local
// SOBREVIVE. Un archivo que junta el trabajo de varias corridas no se puede escribir
// desde una sola.
const salida = join(base, 'drive.json');
const previo = existsSync(salida)
  ? (() => { try { return JSON.parse(readFileSync(salida, 'utf8').replace(/^﻿/, '')); } catch { return {}; } })()
  : {};
const fusionar = (viejas, nuevas, clave) => {
  const m = new Map((viejas ?? []).map((x) => [String(x[clave]), x]));
  for (const x of nuevas ?? []) m.set(String(x[clave]), x);   // lo nuevo gana
  return [...m.values()];
};
const clasesFinal = fusionar(previo.clases, clases, 'n').sort((a, b) => Number(a.n) - Number(b.n));
const recursosFinal = fusionar(previo.recursos, [...recursos, ...enlaces], 'archivo');
const perdidas = (previo.clases ?? []).length - clasesFinal.length;
if (perdidas > 0) console.log(`  ⚠ el drive.json previo tenía ${perdidas} clase(s) más: las conservo`);
if ((previo.clases ?? []).length && !clases.length) {
  console.log(`  (sin clases nuevas: conservo las ${clasesFinal.length} que ya estaban)`);
}

writeFileSync(salida, JSON.stringify({
  curso: plan.curso, carpeta: dirCurso, clases: clasesFinal,
  recursos: recursosFinal,
}, null, 2), 'utf8');

// ── 4. Liberar espacio local, SOLO con la subida confirmada ──────────────────
// La guarda va en POSITIVO (AGENTS.md): se borra únicamente el archivo que cumple
// TODAS las condiciones. Cualquier duda = no se borra. Un borrado de más acá
// significa perder una descarga de 100 MB y volver a bajarla, así que el costo de
// ser conservador es cero y el de equivocarse no.
if (LIBERAR) {
  const libreGB = () => {
    try {
      const raiz = base.slice(0, 3); // 'C:\'
      const out = execFileSync('powershell', ['-NoProfile', '-Command',
        `[math]::Round((Get-PSDrive ${raiz[0]}).Free/1GB,2)`], { encoding: 'utf8' });
      return Number(out.trim());
    } catch { return null; }
  };
  const libre = libreGB();

  console.log(`\n  ── Liberar espacio local ──`);
  console.log(`  Libre en ${base.slice(0, 3)}: ${libre ?? '?'} GB · umbral: ${MIN_LIBRE} GB`);

  if (libre !== null && libre >= MIN_LIBRE) {
    console.log(`  Nada que liberar: sobra espacio. (Para forzar: --min-libre-gb 99999)`);
  } else {
    let borrados = 0, bytes = 0;
    for (const e of esperados) {
      const r = resueltos.get(e.nombre);
      const razon = [];

      // Las CINCO condiciones que habilitan el borrado, todas en positivo.
      //
      // ⚠️ LA QUINTA ES EL AUDIO, Y FALTABA. Las otras cuatro contestan «¿está a salvo
      // del otro lado?», que es la pregunta correcta para el VIDEO — pero el video es
      // además la ENTRADA de la extracción de audio, y sin audio no hay transcripción.
      // Borrarlo antes de extraerlo deja una clase que se ve completa en el portal
      // (tiene su visor de Drive) y que no va a poder transcribirse nunca sin volver a
      // bajar el archivo, o a traerlo de vuelta de Drive.
      //
      // No pasó de casualidad: en «BlueHacker» el circuito corría audio ANTES que esto,
      // así que las 105 liberadas tenían su audio. Corriendo `--liberar` suelto —que es
      // exactamente para lo que existe la bandera— no lo tendrían.
      //
      // El audio puede estar entero o partido en `.parteNN` (las clases de más de ~87
      // min se trocean), así que se aceptan las dos formas.
      const dirAudio = join(base, 'audio');
      // La raíz sale del nombre del archivo LOCAL, que es de donde curso-audio.mjs saca
      // el suyo. Usar el título de Drive daría lo mismo hoy —se copia con el mismo
      // nombre— pero ata este guard a que eso no cambie nunca.
      const nomLocal = e.src ? basename(e.src) : '';
      const raizAudio = nomLocal.includes('.') ? nomLocal.slice(0, nomLocal.lastIndexOf('.')) : nomLocal;
      const audioEnDisco = !!raizAudio && existsSync(dirAudio) && readdirSync(dirAudio).some((f) =>
        f === raizAudio + '.m4a' || f.startsWith(raizAudio + '.parte'));

      // ⚠️ LA TRANSCRIPCIÓN TAMBIÉN SIRVE, Y ES LA EVIDENCIA MÁS FUERTE DE LAS DOS.
      //
      // Lo que esta condición quiere saber es «¿el video ya dio lo que tenía que dar?».
      // El audio existiendo lo sugiere; la transcripción existiendo lo PRUEBA — es el
      // producto final de esa cadena. Y el audio es un intermedio descartable: una vez
      // transcripto se borra para recuperar disco (son ~40 GB en 130 cursos), y con eso
      // este guard pasaba a conservar videos que ya estaban completamente procesados,
      // diciendo «todavía no se le extrajo el audio» sobre clases transcriptas hace
      // semanas. El mensaje era falso y la decisión, conservadora de más.
      //
      // Se piden las dos formas por separado a propósito: un curso a medio transcribir
      // conserva sus videos por el audio, y uno terminado los libera por el texto.
      // ⚠️ El texto/ puede estar ANIDADO por módulo (`curso-organizar.mjs` reordena
      // algunos cursos), así que buscar solo en la raíz subcuenta: 12 de 140 cursos
      // tienen sus .md un nivel adentro — UGC SIM tiene 1 en la raíz y 56 anidados. Con
      // la búsqueda plana, un curso entero transcripto se lee como no transcripto.
      const tieneTx = !!raizAudio && hayTx(join(base, 'texto'), raizAudio);

      // ⚠️ Y UN VIDEO SIN PISTA DE AUDIO TAMBIÉN «DIO LO SUYO»: no tiene nada que dar.
      //
      // Hay cursos con placas mudas —una portada de 11 segundos, un separador de módulo—
      // que no van a tener audio ni transcripción NUNCA. Sin esta tercera forma, el guard
      // las conserva para siempre: medido, 4 de los 6 videos que quedaban en disco al
      // vaciar la máquina eran exactamente eso, 740 MB esperando una transcripción
      // imposible. Una condición que no se puede cumplir no protege, atasca.
      const sinPista = !!e.src && existsSync(e.src) && !videoTieneAudio(e.src);
      const tieneAudio = audioEnDisco || tieneTx || sinPista;

      const dentroDelCurso = !!e.src && e.src.startsWith(join(base, 'video') + '\\');
      // esIdReal explícito: un 'local-*' significa que Drive NO subió nada todavía.
      const tieneId = esIdReal(r?.id) && !r?.ambiguo;
      const localOk = !!e.src && existsSync(e.src);
      const tamLocal = localOk ? statSync(e.src).size : -1;
      const copiaOk = !!e.dst && existsSync(e.dst) && statSync(e.dst).size === tamLocal;
      const driveOk = tieneId && Number(r.size) === tamLocal;

      if (!dentroDelCurso) razon.push('fuera de video/');
      if (!tieneId) razon.push(r?.ambiguo ? 'id ambiguo' : 'sin id de Drive');
      if (!localOk) razon.push('ya no está local');
      if (!copiaOk) razon.push('la copia en G: no coincide en bytes');
      if (!tieneAudio) razon.push('no tiene ni audio extraído ni transcripción: el video todavía no dio lo suyo');
      if (!driveOk && tieneId) razon.push(`Drive reporta ${r.size} B y el local ${tamLocal} B (sigue subiendo)`);

      if (dentroDelCurso && tieneId && localOk && copiaOk && driveOk && tieneAudio) {
        unlinkSync(e.src);
        borrados++; bytes += tamLocal;
        console.log(`  🗑 ${e.nombre}  (${mb(tamLocal)} MB liberados)`);
      } else {
        console.log(`  · conservo ${e.nombre} — ${razon.join(' · ')}`);
      }
    }
    console.log(`\n  ${borrados} archivo(s) borrado(s) del local · ${mb(bytes)} MB liberados`);
    if (borrados) console.log(`  El máster en máxima calidad queda en ${dirCurso}`);
  }
}

console.log('\n' + '─'.repeat(70));
console.log(`  ${clases.length}/${esperados.length} clases con videoId de Drive`);
console.log(`  Carpeta: ${dirCurso}`);
console.log(`  → ${salida}`);
console.log('─'.repeat(70));

if (pendientes.size) {
  console.log(`\n  ⚠ ${pendientes.size} sin id todavía — Drive sigue subiendo. Volvé a correr con`);
  console.log('    --solo-ids cuando el ícono de Drive deje de girar (no re-copia nada):');
  for (const n of [...pendientes.keys()].slice(0, 6)) console.log(`      ${n}`);
}

console.log(`\n  Los videoId de drive.json son lo que come DRIVE_PREVIEW en`);
console.log(`  app/conocimientos/CursoPortal.tsx:21. La transcripción de cada clase va a`);
console.log(`  public/cono-tx/<videoId>.json, que es de donde la lee TranscriptLazy.\n`);
process.exit(pendientes.size ? 3 : 0);
