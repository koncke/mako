// =============================================================================
// Las fichas de WhatsApp Web — corre en web.whatsapp.com (24/10/2026)
// =============================================================================
// MaKo le pide a esta pestaña lo que el WhatsApp Web de la persona YA tiene guardado sobre los teléfonos de sus leads (el
// nombre que cada uno se puso, el de su agenda, si es cuenta de empresa y el nombre de la empresa, y en qué grupos suyos
// está). Lo puro, en wa-fichas-reglas.js.
//
// ⚠️ LO QUE ESTE SCRIPT NO HACE, Y ES DELIBERADO:
//   · No toca la interfaz: no hace clic, no abre chats, no escribe, no marca nada como leído. Sólo LEE la base `model-storage`
//     que WhatsApp Web ya guardó en este navegador.
//   · No habla con la red de WhatsApp: no hay consultas que una línea no oficial tenga que pagar (lib/fotos-contacto.ts).
//   · No crea la base si no existe: abrir `model-storage` sin versión cuando no está la crearía VACÍA en el WhatsApp de la
//     persona. Primero se mira `indexedDB.databases()`.
//   · Devuelve SÓLO lo de los teléfonos pedidos: la agenda de la persona no sale del navegador.
//   · No corre solo: contesta un pedido que la persona disparó desde MaKo.

/** Abre `model-storage` SÓLO si ya existe (sin crearla), en modo lectura. null = no hay (todavía no sincronizó, u otra versión). */
async function abrirModelStorage() {
  try {
    if (typeof indexedDB.databases === 'function') {
      const dbs = await indexedDB.databases();
      if (!dbs.some((d) => d && d.name === 'model-storage')) return null;
    }
  } catch { /* sin la lista se intenta igual, con el aborto de abajo */ }
  return new Promise((resolve) => {
    let req;
    try { req = indexedDB.open('model-storage'); } catch { resolve(null); return; }
    // Si llegara a crearla (no existía), se aborta: nunca se le deja una base vacía.
    req.onupgradeneeded = () => { try { req.transaction.abort(); } catch { /* nada */ } };
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
    req.onsuccess = () => {
      // Si WhatsApp Web necesita actualizar su base mientras se lee, se le cede en el acto: una conexión abierta trabaría SU
      // actualización (y su pestaña), que es justo lo que esto no puede hacer.
      req.result.onversionchange = () => { try { req.result.close(); } catch { /* nada */ } };
      resolve(req.result);
    };
  });
}

/** Todo un store, o [] si no existe en esta versión de WhatsApp Web. */
function leerStore(db, nombre) {
  return new Promise((resolve) => {
    if (!db.objectStoreNames.contains(nombre)) { resolve([]); return; }
    try {
      const r = db.transaction(nombre, 'readonly').objectStore(nombre).getAll();
      r.onsuccess = () => resolve(Array.isArray(r.result) ? r.result : []);
      r.onerror = () => resolve([]);
    } catch { resolve([]); }
  });
}

/**
 * Lo pedido: teléfonos sueltos o `{ telefono, lid }` (con el `@lid` se encuentra al que WhatsApp Web no tiene con su teléfono),
 * y los NOMBRES de los grupos de donde vinieron esos leads: se buscan acá y se dice si están y cuántos son (25/10/2026, 0.71.0).
 */
async function fichasPedidas(pedidos, nombresGrupos) {
  const db = await abrirModelStorage();
  if (!db) return { ok: false, motivo: 'sin_base', diagnostico: { base: false } };
  try {
    const [contactos, grupos, participantes] = await Promise.all([
      leerStore(db, 'contact'), leerStore(db, 'group-metadata'), leerStore(db, 'participant'),
    ]);
    const indice = MakoWaFichas.indexar(contactos, grupos, participantes);
    const conLid = Array.isArray(pedidos) && pedidos.some((p) => p && typeof p === 'object' && p.lid);
    const porLid = conLid ? MakoWaFichas.indexarLids(contactos, grupos, participantes) : null;
    const fichas = MakoWaFichas.fichasDe(indice, pedidos, porLid);
    // El diagnóstico: QUÉ hay (nombres de stores y cantidades), nunca datos de nadie.
    const diagnostico = {
      base: true, stores: Array.from(db.objectStoreNames), contactos: contactos.length, grupos: grupos.length,
      participantes: participantes.length, pedidos: Array.isArray(pedidos) ? pedidos.length : 0, conFicha: fichas.length,
    };
    const enGrupos = Array.isArray(nombresGrupos) && nombresGrupos.length ? MakoWaFichas.buscarGrupos(grupos, participantes, nombresGrupos) : [];
    return { ok: true, fichas, grupos: enGrupos, diagnostico };
  } finally {
    try { db.close(); } catch { /* nada */ }
  }
}

/** ¿WhatsApp Web ya guardó su base? Sin abrirla (abrirla si no está la crearía): sólo la lista de bases. */
async function hayBase() {
  try {
    if (typeof indexedDB.databases !== 'function') return null;
    const dbs = await indexedDB.databases();
    return dbs.some((d) => d && d.name === 'model-storage');
  } catch { return null; }
}

chrome.runtime.onMessage.addListener((msg, _sender, responder) => {
  // El worker pregunta si este script está vivo en la pestaña (una abierta antes de instalar o actualizar no lo tiene) y si
  // WhatsApp Web ya guardó su base (recién abierta, o sin la sesión iniciada, no).
  if (msg && msg.tipo === 'WA_FICHAS_PING') {
    hayBase().then((base) => responder({ ok: true, base }), () => responder({ ok: true, base: null }));
    return true;
  }
  if (!msg || msg.tipo !== 'WA_FICHAS') return false;
  const pedidos = Array.isArray(msg.pedidos) ? msg.pedidos.slice(0, 5000) : Array.isArray(msg.telefonos) ? msg.telefonos.slice(0, 5000) : [];
  const grupos = Array.isArray(msg.grupos) ? msg.grupos.filter((g) => typeof g === 'string').slice(0, 20) : [];
  fichasPedidas(pedidos, grupos).then(responder, (e) => responder({ ok: false, motivo: 'error', error: String(e && e.message || e) }));
  return true;
});
