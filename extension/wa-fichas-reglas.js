// =============================================================================
// Las fichas de WhatsApp Web, LEÍDAS — lo puro (24/10/2026)
// =============================================================================
// Martín: «lo que yo te pido es con la extensión de MaKo... que se extraiga los nombres y la información pública». La ficha
// que él ve en su WhatsApp Web tiene más que lo que devuelve la API (el nombre, por ejemplo: la API de Evolution no lo trae),
// y WhatsApp Web ya la tiene GUARDADA en su navegador, en la base `model-storage`:
//   · `contact`: { id: '549…@c.us' | '…@lid', phoneNumber?: '549…@c.us', name? (su agenda), pushname? (el que la persona se
//     puso), verifiedName? (el de una cuenta de empresa), isBusiness? };
//   · `group-metadata`: { id: '…@g.us', subject };
//   · `participant`: { groupId: '…@g.us', participants: ['…@c.us' | '…@lid' | { id }] }.
// (Esquema no documentado: lo describen gists públicos de 2023-2025 —mzahidriaz, mcornella— y se lee con defensas: un campo
// que no está es «no sé».)
// ⚠️ MEDIDO EN EL WHATSAPP WEB DE MARTÍN (25/10/2026, 0.71.0; sólo nombres de campos y cantidades): en sus 293 grupos los
// 15.244 participantes son `@lid` (ninguno `@c.us`); el 63 % de esos contactos trae `phoneNumber` y el resto NO. Y el nombre
// casi nunca está en `name`/`pushname` (786) sino en `displayNameLID` (6.252). Por eso: `displayNameLID` es un nombre más, y
// un pedido puede traer el `@lid` del lead (lo sabe Evolution, app/crm/enriquecer-lote-server.ts) para encontrar a los que
// WhatsApp Web no tiene con su teléfono. `lid-pn-mapping` y `lid-display-name-mapping` existen pero estaban VACÍAS.
// Leer esa base no toca la interfaz ni la red: no marca nada como leído, no abre chats, no le avisa a nadie. Y de la agenda de Martín sólo sale lo de los teléfonos que MaKo pide (leads que ya están en su CRM).
// ⚠️ DESDE LA 0.72.0 (26/10/2026) «Extraer» además RECORRE el grupo a la vista (wa-recorrer.js): lo que se ve en la lista de
// miembros suma nombres que esa base no tiene (`nombresDeFilas`, `sumarVistos`). Eso sí abre el chat del grupo.
//
// Script clásico (los content scripts de MV3 no son módulos): deja `MakoWaFichas` en el global y, en node, lo exporta para
// los tests (tests/wa-fichas-extension.test.ts).

(function (raiz) {
  /** Los dígitos de un jid de PERSONA con número (`549…@c.us`, `549…@s.whatsapp.net`, con `:dispositivo`); null si no lo es. */
  function telefonoDeJid(jid) {
    if (typeof jid !== 'string') return null;
    const m = /^(\d{8,15})(?::\d+)?@(?:c\.us|s\.whatsapp\.net)$/.exec(jid.trim());
    return m ? m[1] : null;
  }

  /** Los últimos 10 dígitos: así se cruza un teléfono con el CRM (con o sin el 9 de Argentina o el 1 de México). */
  function sufijo(tel) {
    return String(tel || '').replace(/\D/g, '').slice(-10);
  }

  /** Un texto con alguna letra (no un número ni un emoji solo), sin espacios de más; null si no sirve. */
  function textoUtil(v) {
    if (typeof v !== 'string') return null;
    const t = v.trim();
    return t && /\p{L}/u.test(t) && t !== 'Você' ? t.slice(0, 120) : null;
  }

  /** El id de un participante, venga como texto o como objeto. */
  function idDe(p) {
    if (typeof p === 'string') return p;
    if (p && typeof p === 'object') {
      if (typeof p.id === 'string') return p.id;
      if (p.id && typeof p.id === 'object' && typeof p.id._serialized === 'string') return p.id._serialized;
    }
    return null;
  }

  /**
   * EL NOMBRE VERIFICADO de las cuentas de empresa, por `@lid`, de la tabla `verified-business-name` ({ id: '…@lid', name }).
   * ⚠️ MEDIDO el 26/10/2026 en el WhatsApp Web de Martín: en el grupo de los 221, NINGUNO tenía nombre en `contact` (ni `name`,
   * ni `pushname`, ni `displayNameLID`) y la 0.71.0 completó 0; pero 83 de los 247 tenían su nombre de empresa en ESTA tabla
   * (6.312 filas), que no se leía. Es lo que WhatsApp muestra de una cuenta de empresa que nunca le escribió.
   */
  function verificadosPorLid(verificados) {
    const m = new Map();
    for (const v of Array.isArray(verificados) ? verificados : []) {
      const id = idDe(v);
      const nombre = v ? textoUtil(v.name) : null;
      if (typeof id === 'string' && nombre) m.set(id, nombre);
    }
    return m;
  }

  /**
   * EL ÍNDICE de lo que WhatsApp Web tiene guardado: por los últimos 10 dígitos de cada teléfono, lo que se sabe de esa persona
   * y en qué grupos de Martín está. Un `@lid` se traduce con el contacto que trae su `phoneNumber`. `verificados`: las filas de
   * `verified-business-name` (el nombre de una cuenta de empresa).
   */
  function indexar(contactos, grupos, participantes, verificados) {
    const porLid = new Map();
    const porSufijo = new Map();
    const verificado = verificadosPorLid(verificados);
    const juntar = (k, c) => {
      const prev = porSufijo.get(k) || { agenda: null, pushname: null, empresa: null, esEmpresa: false, grupos: new Set() };
      const deEmpresa = textoUtil(c.verifiedName) || verificado.get(idDe(c)) || null;
      prev.agenda = prev.agenda || textoUtil(c.name);
      prev.pushname = prev.pushname || textoUtil(c.pushname) || textoUtil(c.notifyName) || textoUtil(c.displayNameLID);
      prev.empresa = prev.empresa || deEmpresa;
      prev.esEmpresa = prev.esEmpresa || c.isBusiness === true || !!deEmpresa;
      porSufijo.set(k, prev);
    };
    for (const c of Array.isArray(contactos) ? contactos : []) {
      if (!c || typeof c !== 'object') continue;
      const id = idDe(c);
      const tel = telefonoDeJid(id) || telefonoDeJid(idDe(c.phoneNumber));
      if (typeof id === 'string' && id.endsWith('@lid') && tel) porLid.set(id, tel);
      if (tel) juntar(sufijo(tel), c);
    }
    const asunto = new Map();
    for (const g of Array.isArray(grupos) ? grupos : []) {
      if (g && typeof g.id === 'string' && textoUtil(g.subject)) asunto.set(g.id, textoUtil(g.subject));
    }
    for (const p of Array.isArray(participantes) ? participantes : []) {
      if (!p || typeof p.groupId !== 'string') continue;
      const nombreGrupo = asunto.get(p.groupId);
      if (!nombreGrupo) continue;
      for (const x of Array.isArray(p.participants) ? p.participants : []) {
        const id = idDe(x);
        const tel = telefonoDeJid(id) || (typeof id === 'string' ? porLid.get(id) : null);
        if (!tel) continue;
        const k = sufijo(tel);
        const prev = porSufijo.get(k) || { agenda: null, pushname: null, empresa: null, esEmpresa: false, grupos: new Set() };
        prev.grupos.add(nombreGrupo);
        porSufijo.set(k, prev);
      }
    }
    return porSufijo;
  }

  /**
   * LO DE CADA `@lid`, tenga o no teléfono en WhatsApp Web: su nombre y en qué grupos está. Es para los pedidos que traen el
   * `@lid` del lead (el 37 % de los participantes de Martín no tiene `phoneNumber` en su WhatsApp Web).
   */
  function indexarLids(contactos, grupos, participantes, verificados) {
    const porLid = new Map();
    const verificado = verificadosPorLid(verificados);
    const de = (lid) => porLid.get(lid) || { agenda: null, pushname: null, empresa: null, esEmpresa: false, grupos: new Set() };
    for (const c of Array.isArray(contactos) ? contactos : []) {
      if (!c || typeof c !== 'object') continue;
      const id = idDe(c);
      if (typeof id !== 'string' || !id.endsWith('@lid')) continue;
      const prev = de(id);
      prev.agenda = prev.agenda || textoUtil(c.name);
      const deEmpresa = textoUtil(c.verifiedName) || verificado.get(id) || null;
      prev.pushname = prev.pushname || textoUtil(c.pushname) || textoUtil(c.notifyName) || textoUtil(c.displayNameLID);
      prev.empresa = prev.empresa || deEmpresa;
      prev.esEmpresa = prev.esEmpresa || c.isBusiness === true || !!deEmpresa;
      porLid.set(id, prev);
    }
    // Un @lid con nombre de empresa y sin ficha en `contact` también cuenta.
    for (const [id, nombre] of verificado) {
      if (porLid.has(id)) continue;
      porLid.set(id, { agenda: null, pushname: null, empresa: nombre, esEmpresa: true, grupos: new Set() });
    }
    const asunto = new Map();
    for (const g of Array.isArray(grupos) ? grupos : []) {
      if (g && typeof g.id === 'string' && textoUtil(g.subject)) asunto.set(g.id, textoUtil(g.subject));
    }
    for (const p of Array.isArray(participantes) ? participantes : []) {
      if (!p || typeof p.groupId !== 'string' || !asunto.get(p.groupId)) continue;
      for (const x of Array.isArray(p.participants) ? p.participants : []) {
        const id = idDe(x);
        if (typeof id !== 'string' || !id.endsWith('@lid')) continue;
        const prev = de(id);
        prev.grupos.add(asunto.get(p.groupId));
        porLid.set(id, prev);
      }
    }
    return porLid;
  }

  /** Un nombre de grupo para comparar: sin acentos, sin emojis ni signos, en minúscula y con un espacio entre palabras. */
  function asuntoComparable(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  }

  /**
   * LOS GRUPOS QUE MaKo NOMBRA (los leads vinieron de ahí), buscados en el WhatsApp Web de la persona: igual al nombre (sin
   * acentos ni emojis), y si no, el ÚNICO que lo contiene. Devuelve cuántos son en WhatsApp Web y de cuántos sabe el NOMBRE
   * (`conNombre`, con los `contactos`); nunca a quiénes.
   * ⚠️ MEDIDO el 26/10/2026 en el grupo de Martín de donde vinieron los 221 («RETO del Anuncio Ganador»): 247 participantes,
   * 237 con teléfono y UNO con nombre, porque es un grupo de anuncios donde nadie escribe (17 mensajes guardados, todos del
   * sistema) y WhatsApp sólo conoce el nombre de quien le escribió. Sin este número, «1 completado» se lee como que no anda.
   */
  /** El grupo con ese nombre: igual (sin acentos ni emojis), y si no, el ÚNICO que lo contiene. null si no está o es ambiguo. */
  function grupoNombrado(grupos, nombre) {
    const lista = (Array.isArray(grupos) ? grupos : []).filter((g) => g && typeof g.id === 'string' && textoUtil(g.subject));
    const buscado = asuntoComparable(nombre);
    if (!buscado) return null;
    const iguales = lista.filter((g) => asuntoComparable(g.subject) === buscado);
    const contienen = iguales.length ? iguales : lista.filter((g) => asuntoComparable(g.subject).includes(buscado));
    return contienen.length === 1 ? contienen[0] : iguales[0] || null;
  }

  /**
   * LOS NOMBRES QUE FIRMAN LOS MENSAJES DE UN GRUPO (0.73.5): autor → `notifyName` (el nombre que la persona se puso, que
   * WhatsApp manda con cada mensaje). Leandro (26/10): en un grupo cerrado donde la gente ESCRIBE, «había un montón de
   * personas que tenían nombres y no extrajo nada». El de los 221 de Martín era de anuncios (nadie escribe): esta fuente nunca
   * se había probado. El último mensaje de cada autor gana (es el nombre de hoy).
   */
  function nombresDeMensajes(registros) {
    const m = new Map();
    for (const r of Array.isArray(registros) ? registros : []) {
      if (!r || typeof r !== 'object') continue;
      const autor = typeof r.author === 'string' ? r.author : r.author && typeof r.author._serialized === 'string' ? r.author._serialized : null;
      const nombre = textoUtil(r.notifyName);
      if (autor && /@(lid|c\.us|s\.whatsapp\.net)$/.test(autor) && nombre) m.set(autor.replace(/:\d+@/, '@'), nombre);
    }
    return m;
  }

  /** Suma esos nombres a las fichas de los pedidos (por su `@lid` o su `@c.us`), sólo donde no había ninguno. */
  function sumarNotify(fichas, pedidos, notify) {
    const out = (Array.isArray(fichas) ? fichas : []).map((f) => ({ ...f }));
    let conNotify = 0;
    if (!notify || typeof notify.get !== 'function' || !notify.size) return { fichas: out, conNotify };
    const porTel = new Map(out.map((f) => [sufijo(f.telefono), f]));
    for (const p of Array.isArray(pedidos) ? pedidos : []) {
      const tel = String((p && typeof p === 'object' ? p.telefono : p) || '').replace(/\D/g, '');
      if (tel.length < 8) continue;
      const lid = p && typeof p === 'object' && typeof p.lid === 'string' ? p.lid : null;
      const nombre = (lid && notify.get(lid)) || notify.get(`${tel}@c.us`) || notify.get(`${tel}@s.whatsapp.net`) || null;
      if (!nombre) continue;
      const f = porTel.get(sufijo(tel));
      if (f) {
        if (f.agenda || f.pushname || f.empresa) continue;
        f.pushname = nombre;
      } else {
        const n = { telefono: tel, agenda: null, pushname: nombre, empresa: null, esEmpresa: false, grupos: [] };
        out.push(n);
        porTel.set(sufijo(tel), n);
      }
      conNotify++;
    }
    return { fichas: out, conNotify };
  }

  function buscarGrupos(grupos, participantes, nombres, contactos, verificados, notify) {
    const lista = (Array.isArray(grupos) ? grupos : []).filter((g) => g && typeof g.id === 'string' && textoUtil(g.subject));
    const cuantos = new Map();
    for (const p of Array.isArray(participantes) ? participantes : []) {
      if (p && typeof p.groupId === 'string') cuantos.set(p.groupId, Array.isArray(p.participants) ? p.participants.length : 0);
    }
    const conNombreDe = new Map();
    for (const id of verificadosPorLid(verificados).keys()) conNombreDe.set(id, true);
    for (const c of Array.isArray(contactos) ? contactos : []) {
      const id = idDe(c);
      if (typeof id === 'string' && (textoUtil(c.name) || textoUtil(c.pushname) || textoUtil(c.notifyName) || textoUtil(c.verifiedName) || textoUtil(c.displayNameLID))) conNombreDe.set(id, true);
    }
    const nombrados = new Map();
    const firmados = new Map();
    const base = new Map();
    const conNotifyDe = notify && typeof notify.has === 'function' ? notify : new Map();
    for (const p of Array.isArray(participantes) ? participantes : []) {
      if (!p || typeof p.groupId !== 'string' || !Array.isArray(p.participants)) continue;
      nombrados.set(p.groupId, p.participants.filter((x) => conNombreDe.has(idDe(x)) || conNotifyDe.has(idDe(x))).length);
      firmados.set(p.groupId, p.participants.filter((x) => conNotifyDe.has(idDe(x))).length);
      base.set(p.groupId, p.participants.filter((x) => conNombreDe.has(idDe(x))).length);
    }
    const out = [];
    for (const n of Array.isArray(nombres) ? nombres.slice(0, 20) : []) {
      const buscado = asuntoComparable(n);
      if (!buscado) continue;
      const iguales = lista.filter((g) => asuntoComparable(g.subject) === buscado);
      const contienen = iguales.length ? iguales : lista.filter((g) => asuntoComparable(g.subject).includes(buscado));
      const g = contienen.length === 1 ? contienen[0] : iguales[0] || null;
      out.push({
        nombre: String(n).slice(0, 120), encontrado: !!g, participantes: g ? (cuantos.get(g.id) ?? null) : null,
        conNombre: g && Array.isArray(contactos) ? (nombrados.get(g.id) ?? 0) : null,
        // Cuántos de ellos firman algún mensaje con su nombre (0.73.5).
        conNotify: g ? (firmados.get(g.id) ?? 0) : null,
        // Y cuántos tenían nombre SIN los mensajes (el «antes» de la 0.73.5).
        sinMensajes: g && Array.isArray(contactos) ? (base.get(g.id) ?? 0) : null,
      });
    }
    return out;
  }

  /**
   * LAS FICHAS DE LOS TELÉFONOS PEDIDOS, y NADA MÁS: lo que no se pidió no sale del navegador (la agenda de Martín es suya).
   * Un pedido es un teléfono, o `{ telefono, lid }`: con el `@lid`, lo que WhatsApp Web sabe de ese `@lid` completa lo que no
   * encontró por el teléfono (`porLid`, de `indexarLids`). Un teléfono sin nada guardado no vuelve.
   */
  function fichasDe(indice, pedidos, porLid) {
    const out = [];
    for (const p of Array.isArray(pedidos) ? pedidos : []) {
      const crudo = p && typeof p === 'object' ? p.telefono : p;
      const tel = String(crudo || '').replace(/\D/g, '');
      if (tel.length < 8) continue;
      const lid = p && typeof p === 'object' && typeof p.lid === 'string' && /^\d{6,20}@lid$/.test(p.lid) ? p.lid : null;
      const a = indice.get(sufijo(tel)) || null;
      const b = lid && porLid && typeof porLid.get === 'function' ? porLid.get(lid) || null : null;
      if (!a && !b) continue;
      const f = {
        agenda: (a && a.agenda) || (b && b.agenda) || null,
        pushname: (a && a.pushname) || (b && b.pushname) || null,
        empresa: (a && a.empresa) || (b && b.empresa) || null,
        esEmpresa: !!((a && a.esEmpresa) || (b && b.esEmpresa)),
      };
      const grupos = Array.from(new Set([...(a ? a.grupos : []), ...(b ? b.grupos : [])])).sort((x, y) => x.localeCompare(y, 'es'));
      if (!f.agenda && !f.pushname && !f.empresa && !f.esEmpresa && !grupos.length) continue;
      out.push({ telefono: tel, agenda: f.agenda, pushname: f.pushname, empresa: f.empresa, esEmpresa: f.esEmpresa, grupos });
    }
    return out;
  }

  /** ¿Es un teléfono como lo dibuja WhatsApp Web («+52 1 55 1234 5678», con guiones que no cortan)? */
  function esTelefonoDibujado(t) {
    const s = String(t || '').trim();
    return /^\+?[\d\s().‐-―-]{7,}$/.test(s) && s.replace(/\D/g, '').length >= 8;
  }

  /**
   * LOS NOMBRES QUE SE VIERON EN LA LISTA DE MIEMBROS DEL GRUPO (wa-recorrer.js, 0.72.0): teléfono (sus últimos 10) → nombre.
   * WhatsApp Web dibuja a quien no está en la agenda con su «~nombre» (el que la persona se puso) y su teléfono al lado, en
   * cualquiera de los dos renglones. Sólo esas filas: un nombre sin teléfono a la vista no se puede cruzar con nadie.
   * ⚠️ MEDIDO el 26/10/2026 en el grupo de los 221 de Martín: 53 filas con «~nombre», 39 con el teléfono al lado; en
   * `model-storage`, de esos 247, sólo 1 tenía `pushname`. WhatsApp los tiene en memoria al abrir la lista y no los guarda.
   */
  function nombresDeFilas(filas) {
    const m = new Map();
    for (const f of Array.isArray(filas) ? filas : []) {
      const t = String((f && f.titulo) || '').trim();
      const s = String((f && f.secundario) || '').trim();
      const par = /^~/.test(t) && esTelefonoDibujado(s) ? [t, s] : /^~/.test(s) && esTelefonoDibujado(t) ? [s, t] : null;
      if (!par) continue;
      // Sin el «Admin. del grupo» que WhatsApp dibuja en la fila de un admin, por si quedara pegado al nombre.
      const nombre = textoUtil(par[0].replace(/^~\s*/, '').replace(/\s*(admin\.? del grupo|group admin|admin do grupo)\s*$/i, ''));
      const clave = sufijo(par[1]);
      if (nombre && !m.has(clave)) m.set(clave, nombre);
    }
    return m;
  }

  /**
   * Suma a las fichas lo que se VIO en pantalla (`vistos`, de `nombresDeFilas`), sólo para los pedidos que no tenían ningún
   * nombre: lo guardado en `model-storage` gana. Devuelve las fichas nuevas y cuántas ganaron un nombre así.
   */
  function sumarVistos(fichas, pedidos, vistos) {
    const out = (Array.isArray(fichas) ? fichas : []).map((f) => ({ ...f }));
    let enPantalla = 0;
    if (!vistos || typeof vistos.get !== 'function' || !vistos.size) return { fichas: out, enPantalla };
    const porTel = new Map(out.map((f) => [sufijo(f.telefono), f]));
    for (const p of Array.isArray(pedidos) ? pedidos : []) {
      const tel = String((p && typeof p === 'object' ? p.telefono : p) || '').replace(/\D/g, '');
      if (tel.length < 8) continue;
      const visto = vistos.get(sufijo(tel));
      if (!visto) continue;
      const f = porTel.get(sufijo(tel));
      if (f) {
        if (f.agenda || f.pushname || f.empresa) continue;
        f.pushname = visto;
      } else {
        const nueva = { telefono: tel, agenda: null, pushname: visto, empresa: null, esEmpresa: false, grupos: [] };
        out.push(nueva);
        porTel.set(sufijo(tel), nueva);
      }
      enPantalla++;
    }
    return { fichas: out, enPantalla };
  }

  // ── El PERFIL de cada contacto (0.73.0) ─────────────────────────────────────────────────────────────────────────────
  // Martín, 26/10/2026: «Creo que el scraper solo está extrayendo los nombres, cuando podría entrar a cada perfil y fijarse si
  // tiene links, redes sociales, email, etc...». Y del «visto»: «No importa si marca como "leido" la extensión». wa-recorrer.js
  // abre la información de cada uno (de a uno, con pausas) y le pasa acá lo que se ve: los textos y los links. Esto sólo
  // CLASIFICA lo que está escrito: un perfil sin nada no inventa nada.
  const REDES = [
    ['instagram', /instagram\.com\/([A-Za-z0-9._]{1,30})/i],
    ['facebook', /(?:facebook|fb)\.com\/([A-Za-z0-9.\-]{2,80})/i],
    ['tiktok', /tiktok\.com\/@?([A-Za-z0-9._]{2,30})/i],
    ['linkedin', /linkedin\.com\/(?:in|company)\/([A-Za-z0-9\-_%]{2,100})/i],
    ['youtube', /(?:youtube\.com\/(?:@|c\/|channel\/|user\/)?|youtu\.be\/)([A-Za-z0-9_\-]{2,80})/i],
    ['x', /(?:twitter|x)\.com\/([A-Za-z0-9_]{1,15})(?:[/?#]|$)/i],
  ];
  const ES_DE_UNA_RED = /(^|\/\/)([a-z0-9-]+\.)*(instagram\.com|facebook\.com|fb\.com|tiktok\.com|linkedin\.com|youtube\.com|youtu\.be|twitter\.com|x\.com)(\/|$)/i;
  const NO_ES_CUENTA = new Set(['p', 'reel', 'reels', 'stories', 'explore', 'tv', 'share', 'sharer', 'watch', 'shorts', 'home', 'intent', 'hashtag', 'search']);
  const URL_RE = /\bhttps?:\/\/[^\s<>"'«»]+/gi;
  const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  // ⚠️ LA WEB ESCRITA SIN «https://» (MEDIDO 27/10/2026, 0.74.0, 60 perfiles del grupo de agosto, 0 con datos): el primer panel
  // de empresa decía su web en el texto de la info («www.algo.co») y WhatsApp no la dibuja como link; URL_RE pedía el
  // «https://» y no la veía. Con «www.», cualquier terminación; sin «www.», sólo en minúsculas y con una terminación que no es
  // una palabra («viernes.De 9 a 18», «Gracias.Me encanta», «S.A.» no son webs: no se inventa). Nunca el dominio de un correo
  // (lo frena la arroba de antes) ni el de un link que ya trae su «https://» (lo frena la barra).
  const DOMINIO_RE = /(?<![@\w.\/-])(?:[wW]{3}\.[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}|(?:[a-z0-9-]+\.)+(?:com|net|org|info|biz|io|ai|co|mx|ar|cl|pe|ec|uy|py|bo|ve|br|uk|us|lat|shop|store|online|site|tech|digital|agency|studio|academy|xyz|website|marketing|consulting|travel|coach)(?:\.[a-z]{2})?)(?:\/[^\s<>"'«»]*)?(?![\w@-])/g;
  /** Una red (instagram, facebook...) y su cuenta, de un link; null si no es una red o es una ruta que no es una cuenta. */
  function redDe(url) {
    for (const [red, re] of REDES) {
      const m = re.exec(url);
      if (m && !NO_ES_CUENTA.has(m[1].toLowerCase())) return { red, cuenta: m[1], url };
    }
    return null;
  }
  /** Un link que no sirve como web: los de WhatsApp y los de Google que arma la propia app. */
  const esInterno = (u) => /(^|\/\/)([a-z0-9-]+\.)*(whatsapp\.com|whatsapp\.net|wa\.me|facebook\.com\/l\.php)/i.test(u);

  /**
   * LO QUE DICE EL PERFIL, clasificado: la web (el primer link que no es una red ni de WhatsApp), el Instagram, las otras
   * redes, el correo y la dirección si el panel la rotula. `info` = { textos: string[], links: string[], rotulos?: { [rótulo]:
   * valor } }. null si no hay nada (no se inventa).
   */
  function perfilDeInfo(info) {
    const textos = (info && Array.isArray(info.textos) ? info.textos : []).map((t) => String(t || '')).filter(Boolean).slice(0, 200);
    const links = (info && Array.isArray(info.links) ? info.links : []).map((t) => String(t || '')).filter((u) => /^https?:\/\//i.test(u)).slice(0, 50);
    const todo = textos.join('\n');
    // Y las escritas sin «https://» (DOMINIO_RE), con el «https://» puesto.
    const sueltas = (todo.match(DOMINIO_RE) || []).map((u) => `https://${u}`);
    const urls = Array.from(new Set([...links, ...(todo.match(URL_RE) || []), ...sueltas].map((u) => u.replace(/[).,;:!?]+$/, ''))));
    const redes = [];
    let web = null;
    for (const u of urls) {
      if (esInterno(u)) continue;
      const r = redDe(u);
      if (r) { if (!redes.some((x) => x.red === r.red)) redes.push(r); }
      // Un link de una red que NO es una cuenta (una publicación, un reel) no es su web.
      else if (!web && !ES_DE_UNA_RED.test(u)) web = u;
    }
    // «IG: @cuenta» o «Instagram @cuenta» escrito a mano, sin link.
    if (!redes.some((x) => x.red === 'instagram')) {
      const m = /\b(?:ig|insta(?:gram)?)\s*[:：-]?\s*@([A-Za-z0-9._]{2,30})/i.exec(todo);
      if (m) redes.push({ red: 'instagram', cuenta: m[1], url: `https://instagram.com/${m[1]}` });
    }
    const mails = Array.from(new Set([...links.filter((u) => /^mailto:/i.test(u)).map((u) => u.slice(7)), ...(todo.match(EMAIL_RE) || [])]))
      .filter((e) => !/@(s\.whatsapp\.net|c\.us|lid|g\.us)$/i.test(e));
    const rot = (info && info.rotulos && typeof info.rotulos === 'object') ? info.rotulos : {};
    const rotulo = (re) => { for (const [k, v] of Object.entries(rot)) if (re.test(k) && typeof v === 'string' && v.trim()) return v.trim(); return null; };
    const p = {
      web,
      instagram: (redes.find((x) => x.red === 'instagram') || {}).cuenta || null,
      email: mails[0] || null,
      direccion: rotulo(/direcci[oó]n|address|endere[cç]o/i),
      rubro: rotulo(/categor[ií]a|category|rubro/i),
      descripcion: rotulo(/descripci[oó]n|description|descri[cç][aã]o/i),
      redes: redes.filter((x) => x.red !== 'instagram').map((x) => `${x.red}: ${x.url}`),
    };
    return p.web || p.instagram || p.email || p.direccion || p.rubro || p.descripcion || p.redes.length ? p : null;
  }

  const api = { telefonoDeJid, sufijo, textoUtil, indexar, indexarLids, asuntoComparable, grupoNombrado, buscarGrupos, fichasDe, esTelefonoDibujado, nombresDeFilas, sumarVistos, nombresDeMensajes, sumarNotify, perfilDeInfo };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.MakoWaFichas = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
