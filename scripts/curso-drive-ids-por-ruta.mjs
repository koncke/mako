// Resuelve el id de Drive de cada archivo de un curso POR SU RUTA, no por su nombre.
//
//   import { mapaPorRuta } from './curso-drive-ids-por-ruta.mjs';
//   const m = mapaPorRuta('Metolodogía JADS - Juan Osorio');   // Map<'sub/carpeta/archivo.mp4', id>
//
// ── Por qué existe ──────────────────────────────────────────────────────────────────────
// `idsDeDrive` busca por NOMBRE acotando a la carpeta del curso. Eso resolvió el problema
// de los cinco `recurso-01.pdf` de cursos distintos, y deja vivo el de adentro: DENTRO de
// un mismo curso el mismo nombre existe en varios módulos. En «Fórmula Ventas Ilimitadas»
// el archivo «4. Tipos de anuncios para productos.mp4» está en los módulos 2, 3 y 4, y las
// tres clases se quedaron con el id del primero.
//
// Medido el 03/09/2026 sobre los 13 cursos cargados desde Drive: **98 clases en 2 cursos**
// apuntando a un video que puede no ser el suyo. Y no da ningún síntoma — la clase abre,
// reproduce un video de verdad, y hasta tiene transcripción; sólo que de otra lección.
//
// ⚠️ Y ADEMÁS SE PIERDE LA TRANSCRIPCIÓN DE LA OTRA. El texto se guarda en
//    `public/cono-tx/<videoId>.json`: dos clases con el mismo id escriben el mismo archivo,
//    así que la segunda pisa a la primera. Arreglar los ids obliga a re-transcribir.
//
// La ruta SÍ es única dentro de un curso —es lo que un sistema de archivos garantiza—, así
// que es la clave correcta. Es la misma lección que ya está escrita para los recursos, una
// capa más adentro: acotar el universo no alcanza si adentro del universo hay repetidos.
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { copyFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { dbDeDrive, esIdReal, DFS_POR_DEFECTO } from './curso-drive-ids.mjs';

/** Abre una COPIA de la metadata de Drive. El `-wal` es obligatorio: sin él se lee una foto
 *  vieja y un archivo subido hace una hora «no existe». Ver curso-drive-ids.mjs. */
export const abrirMetadata = (DFS = DFS_POR_DEFECTO) => {
  const src = dbDeDrive(DFS);
  if (!src) return null;
  const tmp = join(tmpdir(), `dfs-ruta-${process.pid}.db`);
  copyFileSync(src, tmp);
  for (const ext of ['-wal', '-shm']) { try { copyFileSync(src + ext, tmp + ext); } catch { /* puede no existir */ } }
  return new DatabaseSync(tmp);
};

/**
 * Devuelve un Map de `<ruta relativa a la carpeta del curso> -> <id de Drive>`.
 * La ruta usa `/` y NO incluye la carpeta del curso.
 * Devuelve null si la carpeta no está en la metadata (que NO es «la carpeta está vacía»).
 */
export const mapaPorRuta = (nombreCarpeta, db = null, DFS = DFS_POR_DEFECTO) => {
  const propia = !db;
  const base = db ?? abrirMetadata(DFS);
  if (!base) return null;
  try {
    const raiz = base.prepare(`SELECT stable_id FROM items
                               WHERE local_title = ? AND is_folder = 1 AND trashed = 0`).all(nombreCarpeta);
    if (!raiz.length) return null;

    /**
     * ⚠️ DOS CARPETAS CON EL MISMO NOMBRE SON DOS COPIAS DEL CURSO, Y FUSIONARLAS INVENTA
     *    IDS. Drive permite nombres repetidos: hay DOS «TikTok 100k – Jordi Segués» vivas,
     *    la copia entera del curso duplicada. Recorriendo las dos, cada ruta aparece dos
     *    veces con ids distintos y el `Map.set` se queda con el último — o sea, con el de
     *    la copia equivocada, en silencio.
     *
     *    Medido el 03/09/2026: eso produjo 51 «correcciones» sobre TikTok cuyos ids
     *    ORIGINALES eran correctos. Aplicarlas habría roto 51 clases que funcionaban, y el
     *    síntoma habría sido el peor posible: la clase abre y reproduce el video de otra.
     *
     *    Se devuelve `null` —«no puedo contestar»—, que es distinto de «no falta nada».
     */
    if (raiz.length > 1) return null;

    const hijos = base.prepare(`SELECT item_stable_id FROM stable_parents WHERE parent_stable_id = ?`);
    const ficha = base.prepare(`SELECT id, local_title, is_folder, trashed FROM items WHERE stable_id = ?`);

    const out = new Map();
    const ambiguas = new Set();
    const vistos = new Set();
    // Recorrido en anchura llevando la ruta. El tope de profundidad es una red contra un
    // ciclo en la metadata, no un límite real: un curso son 2-3 niveles.
    let frente = raiz.map((r) => ({ sid: r.stable_id, ruta: '' }));
    for (let prof = 0; frente.length && prof < 12; prof++) {
      const sig = [];
      for (const { sid, ruta } of frente) {
        for (const h of hijos.all(sid)) {
          const id = h.item_stable_id;
          if (vistos.has(id)) continue;
          vistos.add(id);
          const r = ficha.get(id);
          if (!r || r.trashed) continue;
          const nombre = String(r.local_title ?? '');
          const completa = ruta ? `${ruta}/${nombre}` : nombre;
          if (r.is_folder) { sig.push({ sid: id, ruta: completa }); continue; }
          // Los `local-…` son archivos que Drive todavía no terminó de subir: no tienen id
          // servible, y anotarlos sería publicar una clase que no reproduce.
          if (!esIdReal(r.id)) continue;
          // ⚠️ Y si DOS archivos comparten la misma ruta relativa —una subcarpeta duplicada
          //    adentro del curso—, la ruta deja de ser una clave. Se marca y no se elige:
          //    quedarse con uno es el mismo bug que este módulo vino a arreglar.
          if (out.has(completa) && out.get(completa) !== r.id) { ambiguas.add(completa); continue; }
          out.set(completa, r.id);
        }
      }
      frente = sig;
    }
    // Las rutas ambiguas se SACAN del mapa: quien consulte una recibe «no sé», que es la
    // respuesta honesta, y no el id de una de las dos copias elegido por orden de recorrido.
    for (const r of ambiguas) out.delete(r);
    return out;
  } finally {
    if (propia) { try { base.close(); } catch { /* da igual */ } }
  }
};

/** Normaliza una ruta para comparar: `\` a `/`, NFC, y sin barras de sobra.
 *  El acento compuesto distinto (NFC vs NFD) hace que dos rutas idénticas en pantalla no
 *  sean iguales — este repo ya perdió 60 GB por eso. */
export const rutaNorm = (s) => String(s ?? '')
  .replace(/\\/g, '/')
  .replace(/^\/+|\/+$/g, '')
  .replace(/\/{2,}/g, '/')
  .normalize('NFC');
