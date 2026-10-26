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
 * LOS MENSAJES DE ESOS GRUPOS, sólo autor y `notifyName` (0.73.5). En `model-storage` la clave de un mensaje es
 * `false_<chat>_<id>_<autor>` (los recibidos), así que un rango de claves trae sólo los de ese grupo sin leer el resto. Con
 * tope por grupo. `diag` dice cómo es la tabla (por si WhatsApp la cambia) y cuánto trajo, sin datos de nadie.
 */
function mensajesDeGrupos(db, ids) {
  const diag = { tabla: false, clave: null, leidos: 0, conNombre: 0, conAutor: 0, campos: {} };
  if (!db.objectStoreNames.contains('message') || !ids.length || typeof IDBKeyRange === 'undefined') return Promise.resolve({ registros: [], diag });
  return new Promise((resolve) => {
    const registros = [];
    let tx;
    try { tx = db.transaction('message', 'readonly'); } catch { resolve({ registros, diag }); return; }
    const store = tx.objectStore('message');
    diag.tabla = true;
    diag.clave = typeof store.keyPath === 'string' ? store.keyPath : JSON.stringify(store.keyPath);
    // La FORMA de una clave cualquiera de un mensaje recibido (dígitos y letras tapados) y los índices: si el rango no trae
    // nada, esto dice si es que no hay mensajes de ese grupo o que la clave cambió.
    try { diag.indices = Array.from(store.indexNames).slice(0, 12); } catch { /* nada */ }
    try {
      const m = store.openCursor(IDBKeyRange.bound('false_', 'false_\uffff'));
      m.onsuccess = () => { const c = m.result; if (c && !diag.forma) diag.forma = String(c.key).slice(0, 120).replace(/\d/g, '#').replace(/[A-Za-z](?![A-Za-z]*\.us|id\b)/g, 'a'); };
    } catch { /* nada */ }
    let pendientes = ids.length;
    const listo = () => { if (--pendientes <= 0) resolve({ registros, diag }); };
    for (const gid of ids) {
      let n = 0;
      let req;
      try { req = store.openCursor(IDBKeyRange.bound(`false_${gid}_`, `false_${gid}_\uffff`)); } catch { listo(); continue; }
      req.onerror = () => listo();
      req.onsuccess = () => {
        const c = req.result;
        if (!c || n >= 30000) { listo(); return; }
        n++; diag.leidos++;
        const v = c.value || {};
        // ⚠️ MEDIDO en vivo (26/10, 0.73.6, Networking SINDEMEX): el rango trae los mensajes del grupo (1.610) pero NINGUNO
        // tiene `notifyName`. Se prueban los otros campos donde WhatsApp puede guardar el nombre del que escribe, y el
        // diagnóstico cuenta qué campos trae un mensaje (sólo sus NOMBRES) para saber dónde está.
        if (diag.campos && Object.keys(diag.campos).length < 80 && n <= 400) for (const k of Object.keys(v)) diag.campos[k] = (diag.campos[k] || 0) + 1;
        const nombre = [v.notifyName, v.pushname, v.senderName, v.verifiedBizName].find((x) => typeof x === 'string' && x.trim()) || null;
        // El autor: el campo, o la última parte de la clave (`false_<grupo>_<id>_<autor>`).
        const finClave = String(c.key).split('_').pop();
        const autor = v.author || v.participant || (finClave && finClave.includes('@') ? finClave : null);
        if (autor) diag.conAutor++;
        if (nombre) { diag.conNombre++; registros.push({ author: autor, notifyName: nombre }); }
        c.continue();
      };
    }
    tx.onerror = () => resolve({ registros, diag });
  });
}

/**
 * Lo pedido: teléfonos sueltos o `{ telefono, lid }` (con el `@lid` se encuentra al que WhatsApp Web no tiene con su teléfono),
 * y los NOMBRES de los grupos de donde vinieron esos leads: se buscan acá y se dice si están y cuántos son (25/10/2026, 0.71.0).
 */
async function fichasPedidas(pedidos, nombresGrupos, filasVistas) {
  const db = await abrirModelStorage();
  if (!db) return { ok: false, motivo: 'sin_base', diagnostico: { base: false } };
  try {
    // `verified-business-name`: el nombre de las cuentas de empresa (26/10/2026, 0.71.1; ver wa-fichas-reglas.js).
    const [contactos, grupos, participantes, verificados] = await Promise.all([
      leerStore(db, 'contact'), leerStore(db, 'group-metadata'), leerStore(db, 'participant'), leerStore(db, 'verified-business-name'),
    ]);
    const indice = MakoWaFichas.indexar(contactos, grupos, participantes, verificados);
    const conLid = Array.isArray(pedidos) && pedidos.some((p) => p && typeof p === 'object' && p.lid);
    const porLid = conLid ? MakoWaFichas.indexarLids(contactos, grupos, participantes, verificados) : null;
    // Lo que se VIO al recorrer el grupo (0.72.0, wa-recorrer.js) completa a los que la base no tiene con nombre.
    const vistos = MakoWaFichas.nombresDeFilas(filasVistas);
    const sumadas = MakoWaFichas.sumarVistos(MakoWaFichas.fichasDe(indice, pedidos, porLid), pedidos, vistos);
    const enPantalla = sumadas.enPantalla;
    // Los nombres que FIRMAN los mensajes de los grupos nombrados (0.73.5): la fuente de un grupo donde la gente escribe.
    const nombrados = Array.isArray(nombresGrupos) ? nombresGrupos.map((n) => MakoWaFichas.grupoNombrado(grupos, n)).filter(Boolean) : [];
    const deMensajes = await mensajesDeGrupos(db, Array.from(new Set(nombrados.map((g) => g.id))));
    const notify = MakoWaFichas.nombresDeMensajes(deMensajes.registros);
    const { fichas, conNotify } = MakoWaFichas.sumarNotify(sumadas.fichas, pedidos, notify);
    // El diagnóstico: QUÉ hay (nombres de stores y cantidades), nunca datos de nadie.
    const diagnostico = {
      base: true, stores: Array.from(db.objectStoreNames), contactos: contactos.length, grupos: grupos.length,
      participantes: participantes.length, pedidos: Array.isArray(pedidos) ? pedidos.length : 0, conFicha: fichas.length,
      vistos: vistos.size, enPantalla, mensajes: { ...deMensajes.diag, autores: notify.size, sumados: conNotify },
    };
    const enGrupos = Array.isArray(nombresGrupos) && nombresGrupos.length ? MakoWaFichas.buscarGrupos(grupos, participantes, nombresGrupos, contactos, verificados, notify) : [];
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
    // `recorre`: ¿está también wa-recorrer.js? (una pestaña con el script de la 0.71 no lo tiene, y el worker se lo pone.)
    const recorre = !!globalThis.__makoWaRecorrer;
    // `sesion` (0.72.3): 'lista', 'qr' o 'cargando' (el worker espera el QR unos minutos). La mira wa-recorrer.js: este
    // archivo no toca la pantalla.
    const sesion = typeof globalThis.__makoWaSesion === 'function' ? globalThis.__makoWaSesion() : null;
    hayBase().then((base) => responder({ ok: true, base, recorre, sesion }), () => responder({ ok: true, base: null, recorre, sesion }));
    return true;
  }
  if (!msg || msg.tipo !== 'WA_FICHAS') return false;
  const pedidos = Array.isArray(msg.pedidos) ? msg.pedidos.slice(0, 5000) : Array.isArray(msg.telefonos) ? msg.telefonos.slice(0, 5000) : [];
  const grupos = Array.isArray(msg.grupos) ? msg.grupos.filter((g) => typeof g === 'string').slice(0, 20) : [];
  const vistas = Array.isArray(msg.vistas) ? msg.vistas.slice(0, 5000) : [];
  fichasPedidas(pedidos, grupos, vistas).then(responder, (e) => responder({ ok: false, motivo: 'error', error: String(e && e.message || e) }));
  return true;
});
