// Resolver el id de Drive de un archivo, leyendo la SQLite local de Google Drive.
//
// Vive aparte porque lo usan DOS caminos: `curso-a-drive.mjs` (sube y despues resuelve) y
// `curso-plan-desde-drive.mjs` (arma un curso a partir de lo que YA esta en Drive). Copiar
// esto seria garantizar que la segunda copia se quede vieja, y lo que tiene adentro —la
// copia del `-wal`— es exactamente lo que costo dias de «Drive tarda en registrar».
import { existsSync, readdirSync, copyFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

export const DFS_POR_DEFECTO = join(process.env.LOCALAPPDATA ?? '', 'Google\\DriveFS');

// ── El lector de la metadata de Drive ────────────────────────────────────────
export const dbDeDrive = (DFS = DFS_POR_DEFECTO) => {
  if (!existsSync(DFS)) return null;
  // La carpeta de la cuenta es un id numérico largo; el resto (Logs, Crashpad…) no.
  const cuentas = readdirSync(DFS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{15,}$/.test(d.name))
    .map((d) => join(DFS, d.name, 'metadata_sqlite_db'))
    .filter(existsSync);
  return cuentas[0] ?? null;
};

// ⚠️ Drive crea la fila ANTES de subir el archivo, con un id PLACEHOLDER
// ('local-46973') y file_size = 0. Ese id no sirve para nada: DRIVE_PREVIEW con
// él da un iframe muerto. El id de verdad son 25+ chars alfanuméricos y aparece
// recién cuando el archivo existe del lado del servidor.
// Tomar el placeholder por bueno fue un falso positivo que reportó "20/20 OK"
// con cero archivos subidos, así que la validación es explícita y no derivada.
const ID_REAL = /^[A-Za-z0-9_-]{20,}$/;
export const esIdReal = (id) => typeof id === 'string' && !id.startsWith('local-') && ID_REAL.test(id);

/**
 * El id de Drive de cada archivo, ACOTADO AL SUBÁRBOL DE LA CARPETA DEL CURSO.
 *
 * ⚠️ EL SCOPE NO ES UNA MEJORA: ES LA DIFERENCIA ENTRE PUBLICAR EL MATERIAL DE ESTE CURSO
 * Y EL DE OTRO. La consulta era `WHERE local_title = ?` a secas, o sea una búsqueda
 * GLOBAL por nombre de archivo en todo el Drive. Con nombres genéricos —y los recursos
 * caen en `recurso-01.pdf` cada vez que la plataforma no da un título en el nombre— eso
 * matchea el archivo de todos los cursos que bajaron igual.
 *
 * Medido el 24/08/2026 sobre Iman Gadzhi: `recurso-01.pdf` existe CINCO veces en el
 * Drive, `recurso-03.pdf` y `recurso-04.pdf` dos veces cada uno. El código detectaba la
 * ambigüedad (`ambiguo: n`) y aun así se quedaba con `reales[0]`, así que 3 de sus 38
 * recursos apuntaban al PDF de otro curso. En la ficha eso no se ve: el recurso tiene su
 * título correcto, su tamaño plausible y abre un PDF — solo que es el de otro.
 *
 * Con el scope, esos mismos 3 resuelven a un único candidato y el tamaño coincide al byte
 * con el archivo local. 38 de 38.
 *
 * `stable_parents` (item_stable_id, parent_stable_id) es lo que permite caminar de la
 * carpeta hacia abajo. Se recorre entera porque un curso tiene subcarpetas por módulo.
 */
export const descendientesDe = (db, nombreCarpeta) => {
  const carp = db.prepare(`SELECT stable_id FROM items
                           WHERE local_title = ? AND is_folder = 1 AND trashed = 0`).all(nombreCarpeta);
  if (!carp.length) return null;
  const hijos = db.prepare(`SELECT item_stable_id FROM stable_parents WHERE parent_stable_id = ?`);
  const dentro = new Set();
  let frente = carp.map((c) => c.stable_id);
  // El tope de vueltas es una red contra un ciclo en la metadata, no un límite real:
  // la jerarquía de un curso son 2-3 niveles.
  for (let i = 0; frente.length && i < 25; i++) {
    const sig = [];
    for (const p of frente) {
      for (const h of hijos.all(p)) {
        if (dentro.has(h.item_stable_id)) continue;
        dentro.add(h.item_stable_id);
        sig.push(h.item_stable_id);
      }
    }
    frente = sig;
  }
  return dentro;
};

export const idsDeDrive = (nombres, carpetaCurso = null, DFS = DFS_POR_DEFECTO) => {
  const src = dbDeDrive(DFS);
  if (!src) return { error: `no encontré metadata_sqlite_db bajo ${DFS}` };
  // Copiar: Drive la tiene abierta y un open directo falla o lee a medias.
  //
  // ⚠️ HAY QUE COPIAR EL `-wal` TAMBIÉN, Y ESTO ERA LA CAUSA DE TODO EL «DRIVE TARDA
  // EN REGISTRAR». La base de Drive está en modo WAL: lo que se escribió desde el
  // último checkpoint vive en `metadata_sqlite_db-wal`, no en el archivo principal.
  // Copiando solo el `.db` se lee una FOTO VIEJA — medido el 2026-08-20: el `.db`
  // congelado a las 13:42 y el `-wal` de 46,9 MB escribiéndose a las 14:21. Un archivo
  // subido a las 13:53 no existía para el script, y el `-wal` de 47 MB dice cuánto
  // estado más estaba invisible.
  //
  // El síntoma no se parece a una lectura vieja: se parece a que Drive tarda. Por eso
  // hay bucles de espera de 10 minutos en `curso-recursos-todos.mjs` y por eso «resolver
  // ids» falla y «publicar» aborta pidiendo justo lo que acaba de correr. Se esperaba a
  // que Drive checkpointeara el WAL, que puede tardar horas — no a que subiera el
  // archivo, que ya estaba subido.
  //
  // Se copian los tres y se abre SIN `readOnly`: sobre la copia temporal, SQLite tiene
  // que poder recuperar el WAL, y en readOnly no lo hace.
  const tmp = join(tmpdir(), `dfs-${process.pid}.db`);
  // ⚠️ LOS TRES NO SON IGUAL DE OBLIGATORIOS, Y TRATARLOS IGUAL ROMPE LA CORRIDA.
  // El `.db` es imprescindible. El `-wal` trae lo no checkpointeado, o sea lo RECIÉN
  // subido: sin él se lee una foto vieja (que es el bug que este bloque vino a arreglar).
  // El `-shm` es solo el índice de memoria compartida y SQLite lo reconstruye del WAL.
  //
  // Pero Drive lo tiene abierto y lo lockea: `EBUSY: resource busy or locked`. Copiarlo
  // dentro del mismo bucle hacía que un archivo PRESCINDIBLE tirara abajo la resolución
  // de 91 ids después de subir los 91 archivos — el trabajo caro ya estaba hecho.
  // Medido el 22/08/2026, y lo introduje yo esa misma mañana al sumar el `-wal`.
  //
  // La regla: cuando agregues un archivo opcional a una copia que ya funcionaba, su
  // fallo tiene que ser opcional también.
  const tmp2 = tmp; // (alias para leer mejor el bloque de abajo)
  try { copyFileSync(src, tmp2); } catch (e) {
    return { error: `no pude copiar la metadata de Drive: ${e.code ?? e.message}` };
  }
  for (const s of ['-wal', '-shm']) {
    if (!existsSync(src + s)) continue;
    try { copyFileSync(src + s, tmp2 + s); }
    catch (e) { console.log(`  ⚠ no pude copiar ${s} (${e.code}); sigo sin él`); }
  }
  const db = new DatabaseSync(tmp);
  const q = db.prepare(`SELECT stable_id, id, local_title, file_size, trashed FROM items
                        WHERE local_title = ? AND is_folder = 0 AND trashed = 0`);
  // El conjunto de stable_id que cuelgan de la carpeta del curso. Si no se pasó carpeta
  // —o la carpeta todavía no está registrada en la metadata— se busca global, que es el
  // comportamiento viejo: degradar a global es peor que acotar, pero es mejor que no
  // resolver nada. Cuando pasa, se DICE.
  const dentro = carpetaCurso ? descendientesDe(db, carpetaCurso) : null;
  const sinScope = !!carpetaCurso && !dentro;
  const out = new Map();
  const enVuelo = new Map(); // registrado pero todavía subiendo
  const colisiones = [];     // nombres que existen en varios cursos y el scope desempató
  for (const n of nombres) {
    const todas = q.all(n);
    // ⚠️ El filtro por carpeta va ANTES del de id real: si no, un homónimo de otro curso
    // con id bueno le gana al propio con id placeholder, y el resultado es un recurso que
    // apunta a otro lado en vez de un «todavía subiendo» que la próxima corrida arregla.
    const filas = dentro ? todas.filter((f) => dentro.has(f.stable_id)) : todas;
    if (dentro && todas.length > filas.length) colisiones.push({ n, global: todas.length, propias: filas.length });
    const reales = filas.filter((f) => esIdReal(f.id));
    if (reales.length === 1) out.set(n, { id: reales[0].id, size: Number(reales[0].file_size ?? 0) });
    else if (reales.length > 1) out.set(n, { ambiguo: reales.length, id: reales[0].id, size: Number(reales[0].file_size ?? 0) });
    else if (filas.length) enVuelo.set(n, filas[0].id); // hay fila, con id placeholder
  }
  if (sinScope) console.log(`  ⚠ no encontré la carpeta «${carpetaCurso}» en la metadata de Drive: busco por nombre GLOBAL.`);
  if (colisiones.length) {
    console.log(`  · ${colisiones.length} nombre(s) existen en varios cursos y los desempató la carpeta:`);
    for (const c of colisiones.slice(0, 6)) console.log(`      ${c.n}  ×${c.global} en el Drive → ${c.propias} en este curso`);
  }
  db.close();
  for (const s of ['', '-wal', '-shm']) { try { unlinkSync(tmp + s); } catch { /* puede no existir */ } }
  return { ids: out, enVuelo };
};
