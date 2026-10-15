// =============================================================================
// La clave de firma de ESTE dispositivo (sólo navegador)
// =============================================================================
// Cada pedido del Centro se firma acá, con ECDSA P-256 de WebCrypto, y la clave privada nace
// NO EXPORTABLE (`extractable: false`): ni este código la puede leer, sólo pedirle que firme. Se
// guarda en IndexedDB (un CryptoKey se guarda tal cual, sin pasar por texto). La pública sí se
// exporta (SPKI en base64): se le da UNA vez al cartero de la PC, a mano, y es lo único que él
// acepta. El servidor nunca la usa para decidir confianza (docs/diseno-centro-de-operaciones.md §3.1).
//
// Una clave por dispositivo y por persona: el teléfono y la compu tienen cada uno la suya, y el
// cartero acepta una lista. Borrar los datos del sitio borra la clave; se crea otra y se vuelve a
// registrar en la PC.
// =============================================================================

const DB = 'mako-operaciones';
const STORE = 'claves';

export type ClaveDispositivo = { par: CryptoKeyPair; spki: string; id: string };

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, mal) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore(STORE); };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
}

async function op<T>(modo: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir();
  try {
    return await new Promise<T>((ok, mal) => {
      const r = f(db.transaction(STORE, modo).objectStore(STORE));
      r.onsuccess = () => ok(r.result);
      r.onerror = () => mal(r.error);
    });
  } finally {
    db.close();
  }
}

const b64 = (buf: ArrayBuffer): string => {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s);
};

async function describir(par: CryptoKeyPair): Promise<ClaveDispositivo> {
  const spkiBuf = await crypto.subtle.exportKey('spki', par.publicKey);
  const dig = new Uint8Array(await crypto.subtle.digest('SHA-256', spkiBuf));
  const id = [...dig].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  return { par, spki: b64(spkiBuf), id };
}

export async function claveDelDispositivo(sub: string): Promise<ClaveDispositivo | null> {
  try {
    const par = await op<CryptoKeyPair | undefined>('readonly', (s) => s.get(`par:${sub}`));
    return par?.privateKey && par.publicKey ? await describir(par) : null;
  } catch {
    // Navegación privada o almacenamiento bloqueado: no hay dónde guardar una clave.
    return null;
  }
}

export async function crearClaveDelDispositivo(sub: string): Promise<ClaveDispositivo> {
  const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  await op('readwrite', (s) => s.put(par, `par:${sub}`));
  return describir(par);
}

/** Firma el texto tal cual (UTF-8). Devuelve r||s en base64, que es lo que da WebCrypto. */
export async function firmar(clave: ClaveDispositivo, texto: string): Promise<string> {
  const firma = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, clave.par.privateKey, new TextEncoder().encode(texto));
  return b64(firma);
}
