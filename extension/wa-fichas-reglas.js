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
// WhatsApp Web no tiene con su teléfono. `lid-pn-mapping` y `lid-display-name-mapping` existen pero estaban VACÍAS. Leer esa base no toca la interfaz ni la red: no marca nada como leído, no abre chats, no le avisa a
// nadie. Y de la agenda de Martín sólo sale lo de los teléfonos que MaKo pide (leads que ya están en su CRM).
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
   * EL ÍNDICE de lo que WhatsApp Web tiene guardado: por los últimos 10 dígitos de cada teléfono, lo que se sabe de esa persona
   * y en qué grupos de Martín está. Un `@lid` se traduce con el contacto que trae su `phoneNumber`.
   */
  function indexar(contactos, grupos, participantes) {
    const porLid = new Map();
    const porSufijo = new Map();
    const juntar = (k, c) => {
      const prev = porSufijo.get(k) || { agenda: null, pushname: null, empresa: null, esEmpresa: false, grupos: new Set() };
      prev.agenda = prev.agenda || textoUtil(c.name);
      prev.pushname = prev.pushname || textoUtil(c.pushname) || textoUtil(c.notifyName) || textoUtil(c.displayNameLID);
      prev.empresa = prev.empresa || textoUtil(c.verifiedName);
      prev.esEmpresa = prev.esEmpresa || c.isBusiness === true || !!textoUtil(c.verifiedName);
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
  function indexarLids(contactos, grupos, participantes) {
    const porLid = new Map();
    const de = (lid) => porLid.get(lid) || { agenda: null, pushname: null, empresa: null, esEmpresa: false, grupos: new Set() };
    for (const c of Array.isArray(contactos) ? contactos : []) {
      if (!c || typeof c !== 'object') continue;
      const id = idDe(c);
      if (typeof id !== 'string' || !id.endsWith('@lid')) continue;
      const prev = de(id);
      prev.agenda = prev.agenda || textoUtil(c.name);
      prev.pushname = prev.pushname || textoUtil(c.pushname) || textoUtil(c.notifyName) || textoUtil(c.displayNameLID);
      prev.empresa = prev.empresa || textoUtil(c.verifiedName);
      prev.esEmpresa = prev.esEmpresa || c.isBusiness === true || !!textoUtil(c.verifiedName);
      porLid.set(id, prev);
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
   * acentos ni emojis), y si no, el ÚNICO que lo contiene. Devuelve cuántos son en WhatsApp Web; nunca a quiénes.
   */
  function buscarGrupos(grupos, participantes, nombres) {
    const lista = (Array.isArray(grupos) ? grupos : []).filter((g) => g && typeof g.id === 'string' && textoUtil(g.subject));
    const cuantos = new Map();
    for (const p of Array.isArray(participantes) ? participantes : []) {
      if (p && typeof p.groupId === 'string') cuantos.set(p.groupId, Array.isArray(p.participants) ? p.participants.length : 0);
    }
    const out = [];
    for (const n of Array.isArray(nombres) ? nombres.slice(0, 20) : []) {
      const buscado = asuntoComparable(n);
      if (!buscado) continue;
      const iguales = lista.filter((g) => asuntoComparable(g.subject) === buscado);
      const contienen = iguales.length ? iguales : lista.filter((g) => asuntoComparable(g.subject).includes(buscado));
      const g = contienen.length === 1 ? contienen[0] : iguales[0] || null;
      out.push({ nombre: String(n).slice(0, 120), encontrado: !!g, participantes: g ? (cuantos.get(g.id) ?? null) : null });
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

  const api = { telefonoDeJid, sufijo, textoUtil, indexar, indexarLids, asuntoComparable, buscarGrupos, fichasDe };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.MakoWaFichas = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
