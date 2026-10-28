// =============================================================================
// MaKo sin conexión — dónde queda guardado: IndexedDB, una base por persona (28/10/2026)
// =============================================================================
// Sólo navegador. La base se llama con un hash del email (cifra.ts → nombreDeBase): no hay una lista de quién guardó, así que
// otra cuenta en el mismo perfil del navegador no la abre. ⚠️ SÍ puede ver que existe (`indexedDB.databases()` lista los
// nombres, y el nombre es un hash del email sin sal: el cascarón la tiene que encontrar sin red). Adentro:
//   · `meta`   → 'llave': la DEK envuelta con la clave de esta computadora (reglas.ts → LlaveGuardada);
//   · `copias` → una por negocio, cifrada con la DEK y con el AAD persona:negocio (reglas.ts → CopiaGuardada).
// La lógica (activar, guardar, abrir) vive en ./local.ts contra la interfaz `Almacen`: los tests le pasan uno en memoria.
// =============================================================================

import type { ColaGuardada, CopiaGuardada, LlaveGuardada } from './reglas';

export interface Almacen {
  leerLlave(): Promise<LlaveGuardada | null>;
  guardarLlave(l: LlaveGuardada): Promise<void>;
  leerCopias(): Promise<CopiaGuardada[]>;
  guardarCopia(c: CopiaGuardada): Promise<void>;
  /** La cola de cambios hechos sin conexión (T2), cifrados. */
  leerCola(): Promise<ColaGuardada[]>;
  guardarEnCola(c: ColaGuardada): Promise<void>;
  sacarDeCola(id: string): Promise<void>;
  /** Borra la base entera de esta persona. */
  borrar(): Promise<void>;
}

/** 2 (T2, 28/10/2026): suma `cola`. Una base de la T1 se actualiza sola al abrirla (`onupgradeneeded`). */
const VERSION_BASE = 2;
const promesa = <T>(r: IDBRequest<T>): Promise<T> =>
  new Promise((ok, mal) => { r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error); });
const listo = (t: IDBTransaction): Promise<void> =>
  new Promise((ok, mal) => { t.oncomplete = () => ok(); t.onerror = () => mal(t.error); t.onabort = () => mal(t.error); });

/** ¿Esta persona guardó algo en este navegador? Sin crear la base para preguntarlo. */
export async function existeBase(nombre: string): Promise<boolean> {
  if (typeof indexedDB === 'undefined') return false;
  if (typeof indexedDB.databases === 'function') {
    try { return (await indexedDB.databases()).some((d) => d.name === nombre); } catch { /* sigue con la otra forma */ }
  }
  // Sin `databases()` (Firefox viejo): abrirla sin versión y, si nació recién, abortar la creación.
  return new Promise((ok) => {
    const r = indexedDB.open(nombre);
    // Una base recién nacida abortada se borra sola (la especificación de IndexedDB): llega como error.
    r.onupgradeneeded = () => { r.transaction?.abort(); };
    r.onsuccess = () => { r.result.close(); ok(true); };
    r.onerror = () => ok(false);
  });
}

function abrirBase(nombre: string): Promise<IDBDatabase> {
  return new Promise((ok, mal) => {
    const r = indexedDB.open(nombre, VERSION_BASE);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      if (!db.objectStoreNames.contains('copias')) db.createObjectStore('copias', { keyPath: 'ws' });
      if (!db.objectStoreNames.contains('cola')) db.createObjectStore('cola', { keyPath: 'id' });
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
    r.onblocked = () => mal(new Error('La base de MaKo sin conexión está abierta en otra ventana.'));
  });
}

/** El almacén de IndexedDB de la base `nombre` (la abre en cada operación: dura poco y no bloquea a otra ventana). */
export function almacenIdb(nombre: string): Almacen {
  async function con<T>(stores: string[], modo: IDBTransactionMode, f: (t: IDBTransaction) => Promise<T> | T): Promise<T> {
    const db = await abrirBase(nombre);
    try {
      const t = db.transaction(stores, modo);
      const fin = listo(t);
      const x = await f(t);
      await fin;
      return x;
    } finally { db.close(); }
  }
  return {
    leerLlave: () => con(['meta'], 'readonly', async (t) => ((await promesa(t.objectStore('meta').get('llave'))) as LlaveGuardada | undefined) ?? null),
    guardarLlave: (l) => con(['meta'], 'readwrite', (t) => { t.objectStore('meta').put(l, 'llave'); }),
    leerCopias: () => con(['copias'], 'readonly', async (t) => (await promesa(t.objectStore('copias').getAll())) as CopiaGuardada[]),
    guardarCopia: (c) => con(['copias'], 'readwrite', (t) => { t.objectStore('copias').put(c); }),
    leerCola: () => con(['cola'], 'readonly', async (t) => (await promesa(t.objectStore('cola').getAll())) as ColaGuardada[]),
    guardarEnCola: (c) => con(['cola'], 'readwrite', (t) => { t.objectStore('cola').put(c); }),
    sacarDeCola: (id) => con(['cola'], 'readwrite', (t) => { t.objectStore('cola').delete(id); }),
    borrar: () => new Promise<void>((ok) => {
      const r = indexedDB.deleteDatabase(nombre);
      r.onsuccess = () => ok(); r.onerror = () => ok(); r.onblocked = () => ok();
    }),
  };
}
