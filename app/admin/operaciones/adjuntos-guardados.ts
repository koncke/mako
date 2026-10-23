// =============================================================================
// Los adjuntos que todavía no salieron, guardados en el navegador (17/10/2026)
// =============================================================================
// Martín (feedback del 17/10, la B): «el borrador nunca se pierde», y «los adjuntos sin mandar, si se puede». El texto va
// en localStorage y en MaKo (useCentro.ts); los archivos no entran en localStorage (5 MB y sólo texto) y no viajan a MaKo
// hasta mandar: van en IndexedDB, un registro por chat (su sesión), con los File tal cual (IndexedDB guarda Blobs).
//
// ⚠️ ES UNA COMODIDAD: sin IndexedDB (una ventana privada, un navegador que lo niega) todo sigue igual y no se avisa nada.
//    Cada función atrapa sus errores y contesta vacío.
// ⚠️ SIN 'use client' y sin hooks: lo importa sólo el motor (useCentro.ts), que corre en el navegador.

const BASE = 'ops-center';
const TIENDA = 'adjuntos';

function abrir(): Promise<IDBDatabase | null> {
  return new Promise((ok) => {
    try {
      if (typeof indexedDB === 'undefined') { ok(null); return; }
      const r = indexedDB.open(BASE, 1);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(TIENDA)) r.result.createObjectStore(TIENDA); };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ok(null);
      r.onblocked = () => ok(null);
    } catch { ok(null); }
  });
}

async function conTienda<T>(modo: IDBTransactionMode, hacer: (t: IDBObjectStore) => IDBRequest | null, vacio: T): Promise<T> {
  const db = await abrir();
  if (!db) return vacio;
  return new Promise<T>((ok) => {
    try {
      const tx = db.transaction(TIENDA, modo);
      const req = hacer(tx.objectStore(TIENDA));
      tx.oncomplete = () => { ok(req ? (req.result as T) ?? vacio : vacio); db.close(); };
      tx.onerror = () => { ok(vacio); db.close(); };
      tx.onabort = () => { ok(vacio); db.close(); };
    } catch { ok(vacio); db.close(); }
  });
}

/** Los archivos sin mandar de un chat (su dirección: la sesión, o la clave del que no tiene). */
export async function leerAdjuntosGuardados(direccion: string): Promise<File[]> {
  const v = await conTienda<unknown>('readonly', (t) => t.get(direccion), null);
  return Array.isArray(v) ? v.filter((f): f is File => typeof File !== 'undefined' && f instanceof File) : [];
}

/** Todas las direcciones guardadas (para barrer las miniaturas de antes del 23/10: fotos-enviadas.ts). */
export async function direccionesGuardadas(): Promise<string[]> {
  const v = await conTienda<unknown>('readonly', (t) => t.getAllKeys(), []);
  return Array.isArray(v) ? v.filter((k): k is string => typeof k === 'string') : [];
}

/** Guarda (o, con la lista vacía, borra) los archivos sin mandar de un chat. */
export async function guardarAdjuntos(direccion: string, archivos: readonly File[]): Promise<void> {
  await conTienda<undefined>('readwrite', (t) => (archivos.length ? t.put([...archivos], direccion) : t.delete(direccion)), undefined);
}
