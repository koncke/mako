// ⚠️ ARCHIVO ARMADO: no se edita a mano. Sale de lib/sin-conexion/cascaron.ts con `node scripts/sin-conexion/armar.mjs`.
"use strict";
(() => {
  // lib/sin-conexion/almacen.ts
  var VERSION_BASE = 2;
  var promesa = (r) => new Promise((ok, mal) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
  var listo = (t) => new Promise((ok, mal) => {
    t.oncomplete = () => ok();
    t.onerror = () => mal(t.error);
    t.onabort = () => mal(t.error);
  });
  async function existeBase(nombre) {
    if (typeof indexedDB === "undefined") return false;
    if (typeof indexedDB.databases === "function") {
      try {
        return (await indexedDB.databases()).some((d) => d.name === nombre);
      } catch {
      }
    }
    return new Promise((ok) => {
      const r = indexedDB.open(nombre);
      r.onupgradeneeded = () => {
        r.transaction?.abort();
      };
      r.onsuccess = () => {
        r.result.close();
        ok(true);
      };
      r.onerror = () => ok(false);
    });
  }
  function abrirBase(nombre) {
    return new Promise((ok, mal) => {
      const r = indexedDB.open(nombre, VERSION_BASE);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
        if (!db.objectStoreNames.contains("copias")) db.createObjectStore("copias", { keyPath: "ws" });
        if (!db.objectStoreNames.contains("cola")) db.createObjectStore("cola", { keyPath: "id" });
      };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => mal(r.error);
      r.onblocked = () => mal(new Error("La base de MaKo sin conexión está abierta en otra ventana."));
    });
  }
  function almacenIdb(nombre) {
    async function con(stores, modo, f) {
      const db = await abrirBase(nombre);
      try {
        const t = db.transaction(stores, modo);
        const fin = listo(t);
        const x = await f(t);
        await fin;
        return x;
      } finally {
        db.close();
      }
    }
    return {
      leerLlave: () => con(["meta"], "readonly", async (t) => await promesa(t.objectStore("meta").get("llave")) ?? null),
      guardarLlave: (l) => con(["meta"], "readwrite", (t) => {
        t.objectStore("meta").put(l, "llave");
      }),
      leerCopias: () => con(["copias"], "readonly", async (t) => await promesa(t.objectStore("copias").getAll())),
      guardarCopia: (c) => con(["copias"], "readwrite", (t) => {
        t.objectStore("copias").put(c);
      }),
      leerCola: () => con(["cola"], "readonly", async (t) => await promesa(t.objectStore("cola").getAll())),
      guardarEnCola: (c) => con(["cola"], "readwrite", (t) => {
        t.objectStore("cola").put(c);
      }),
      sacarDeCola: (id) => con(["cola"], "readwrite", (t) => {
        t.objectStore("cola").delete(id);
      }),
      borrar: () => new Promise((ok) => {
        const r = indexedDB.deleteDatabase(nombre);
        r.onsuccess = () => ok();
        r.onerror = () => ok();
        r.onblocked = () => ok();
      })
    };
  }

  // lib/sin-conexion/cifra.ts
  var subtle = () => {
    const s = globalThis.crypto?.subtle;
    if (!s) throw new Error("Este navegador no puede cifrar (falta WebCrypto).");
    return s;
  };
  var enc = new TextEncoder();
  var dec = new TextDecoder();
  function aBase64url(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function deBase64url(s) {
    const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - s.length % 4) % 4));
    const out = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
    return out;
  }
  var alAzar = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));
  async function importarLlave(cruda) {
    if (cruda.length !== 32) throw new Error("La llave tiene que medir 32 bytes.");
    return subtle().importKey("raw", cruda, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  }
  async function llaveDeLaClave(clave2, sal, vueltas) {
    const base = await subtle().importKey("raw", enc.encode(clave2), "PBKDF2", false, ["deriveKey"]);
    return subtle().deriveKey(
      { name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: vueltas },
      base,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }
  async function cifrarBytes(bytes, llave, aad) {
    const iv = alAzar(12);
    const datos = new Uint8Array(await subtle().encrypt(
      { name: "AES-GCM", iv, additionalData: enc.encode(aad) },
      llave,
      bytes
    ));
    return { iv: aBase64url(iv), datos: aBase64url(datos) };
  }
  async function descifrarBytes(c, llave, aad) {
    return new Uint8Array(await subtle().decrypt(
      { name: "AES-GCM", iv: deBase64url(c.iv), additionalData: enc.encode(aad) },
      llave,
      deBase64url(c.datos)
    ));
  }
  var cifrarJson = (x, llave, aad) => cifrarBytes(enc.encode(JSON.stringify(x)), llave, aad);
  async function descifrarJson(c, llave, aad) {
    return JSON.parse(dec.decode(await descifrarBytes(c, llave, aad)));
  }
  async function nombreDeBase(emailNormalizado) {
    const h2 = new Uint8Array(await subtle().digest("SHA-256", enc.encode(`mako-sin-conexion|v1|${emailNormalizado}`)));
    return `mako-sc-${Array.from(h2.subarray(0, 16), (b) => b.toString(16).padStart(2, "0")).join("")}`;
  }

  // lib/sin-conexion/reglas.ts
  var VERSION_COPIA = 1;
  var CADA_MS = 10 * 6e4;
  var VENCE_DIAS = 30;
  var BLOQUEO_INACTIVO_MS = 15 * 6e4;
  var VUELTAS = 6e5;
  var normalizarEmail = (email) => email.trim().toLowerCase();
  var aadDeCopia = (email, ws) => `mako-sc:v1|${normalizarEmail(email)}|ws=${ws}`;
  var aadDeLlave = (email, dispositivo) => `mako-sc:v1|${normalizarEmail(email)}|llave|${dispositivo}`;
  var aadDeCola = (email, id) => `mako-sc:v1|${normalizarEmail(email)}|cola|${id}`;
  function vencida(vistoServidor, ahora = Date.now()) {
    const t = Date.parse(vistoServidor);
    return !Number.isFinite(t) || ahora - t > VENCE_DIAS * 864e5;
  }
  function diaEn(ms, tz) {
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);
    } catch {
      return new Date(ms).toISOString().slice(0, 10);
    }
  }
  function horaEn(ms, tz) {
    try {
      return new Intl.DateTimeFormat("es-AR", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(ms);
    } catch {
      return new Date(ms).toISOString().slice(11, 16);
    }
  }
  function deCuando(hecha, tz, ahora = Date.now()) {
    const t = Date.parse(hecha);
    if (!Number.isFinite(t)) return "lo de la última vez que hubo conexión";
    const hoy = diaEn(ahora, tz);
    const dia = diaEn(t, tz);
    const hora = horaEn(t, tz);
    if (dia === hoy) return `lo de las ${hora}`;
    if (dia === diaEn(ahora - 864e5, tz)) return `lo de ayer a las ${hora}`;
    return `lo del ${dia.slice(8, 10)}/${dia.slice(5, 7)} a las ${hora}`;
  }
  function textoDeLaCinta(p) {
    const que = p.motivo === "sin-red" ? "Sin conexión" : "MaKo no responde";
    return `${que} · lo que ves es ${deCuando(p.hecha, p.tz, p.ahora)}`;
  }
  var NECESITA_CONEXION = {
    whatsapp: "Necesita conexión: WhatsApp sale desde MaKo.",
    ia: "Necesita conexión: MaKo piensa en el servidor.",
    escribir: "Lo que escribes aquí se sube cuando vuelva la conexión, con tu OK."
  };

  // lib/sin-conexion/cola.ts
  var TOPE_NOTA_COLA = 4e3;
  var TOPE_TITULO = 200;
  var TOPE_DATO = 300;
  var TOPE_COLA = 200;
  var CAMPOS_CONTACTO_COLA = ["nombre", "email", "empresa"];
  var RE_ID_OP = /^[A-Za-z0-9_-]{8,64}$/;
  var texto = (x, tope) => typeof x === "string" && x.trim() && x.length <= tope ? x : null;
  var textoONulo = (x, tope) => x === null ? null : typeof x === "string" && x.length <= tope ? x : void 0;
  var entero = (x) => typeof x === "number" && Number.isInteger(x) && x > 0 ? x : null;
  var clave = (x) => typeof x === "string" && /^[A-Za-z0-9_:.-]{1,80}$/.test(x) ? x : null;
  function validarOperacion(x) {
    if (!x || typeof x !== "object") return null;
    const o = x;
    const id = typeof o.id === "string" && RE_ID_OP.test(o.id) ? o.id : null;
    const ws = entero(o.ws);
    const hecha = typeof o.hecha === "string" && Number.isFinite(Date.parse(o.hecha)) ? o.hecha : null;
    const c = o.cambio && typeof o.cambio === "object" ? o.cambio : null;
    if (!id || !ws || !hecha || !c) return null;
    let cambio = null;
    if (c.tipo === "nota") {
      const leadId = entero(c.leadId);
      const t = texto(c.texto, TOPE_NOTA_COLA);
      if (leadId && t) cambio = { tipo: "nota", leadId, texto: t.trim() };
    } else if (c.tipo === "etapa") {
      const leadId = entero(c.leadId);
      const funnelId = c.funnelId === null ? null : entero(c.funnelId);
      const antes = clave(c.antes);
      const despues = clave(c.despues);
      if (leadId && (c.funnelId === null || funnelId) && antes && despues && antes !== despues) cambio = { tipo: "etapa", leadId, funnelId, antes, despues };
    } else if (c.tipo === "contacto") {
      const leadId = entero(c.leadId);
      const campo = CAMPOS_CONTACTO_COLA.includes(c.campo) ? c.campo : null;
      const antes = textoONulo(c.antes, TOPE_DATO);
      const despues = textoONulo(c.despues, TOPE_DATO);
      if (leadId && campo && antes !== void 0 && despues !== void 0 && !(campo === "nombre" && !despues?.trim())) {
        cambio = { tipo: "contacto", leadId, campo, antes, despues: despues === null ? null : despues.trim() };
      }
    } else if (c.tipo === "tarea-estado") {
      const tareaId = typeof c.tareaId === "string" && /^[A-Za-z0-9_.-]{1,80}$/.test(c.tareaId) ? c.tareaId : null;
      const antes = clave(c.antes);
      const despues = clave(c.despues);
      if (tareaId && antes && despues && antes !== despues) cambio = { tipo: "tarea-estado", tareaId, antes, despues };
    } else if (c.tipo === "tarea-nueva") {
      const t = texto(c.titulo, TOPE_TITULO);
      if (t) cambio = { tipo: "tarea-nueva", titulo: t.trim() };
    }
    return cambio ? { id, ws, hecha, cambio } : null;
  }
  function tarjetasDe(copia, leadId) {
    return (copia.crm?.tableros ?? []).flatMap((t) => t.tarjetas.filter((c) => c.id === leadId).map((c) => ({ t, c })));
  }
  function conLoPendiente(copia, ops) {
    var _a, _b;
    const out = structuredClone(copia);
    const pendientes = { leads: /* @__PURE__ */ new Set(), tareas: /* @__PURE__ */ new Set() };
    for (const op of ops) {
      if (op.ws !== out.negocio.id) continue;
      const c = op.cambio;
      if (c.tipo === "nota" && out.crm) {
        const lista = (_a = out.crm.notas)[_b = String(c.leadId)] ?? (_a[_b] = []);
        lista.unshift({ texto: c.texto, cuando: op.hecha, autor: out.persona.nombre, pendiente: true });
        pendientes.leads.add(c.leadId);
      } else if (c.tipo === "etapa") {
        for (const { t, c: tarjeta } of tarjetasDe(out, c.leadId)) {
          if ((t.funnelId ?? null) !== c.funnelId || tarjeta.col === c.despues || !t.columnas.some((x) => x.key === c.despues)) continue;
          const de = t.columnas.find((x) => x.key === tarjeta.col);
          const a = t.columnas.find((x) => x.key === c.despues);
          if (de) de.cuantos = Math.max(0, de.cuantos - 1);
          if (a) a.cuantos += 1;
          tarjeta.col = c.despues;
          pendientes.leads.add(c.leadId);
        }
      } else if (c.tipo === "contacto") {
        for (const { c: tarjeta } of tarjetasDe(out, c.leadId)) {
          if (c.campo === "nombre") tarjeta.nombre = c.despues?.trim() || tarjeta.nombre;
          else if (tarjeta.contacto) tarjeta.contacto = { ...tarjeta.contacto, [c.campo]: c.despues?.trim() || null };
          pendientes.leads.add(c.leadId);
        }
      } else if (c.tipo === "tarea-estado" && out.plan) {
        const t = out.plan.tareas.find((x) => x.id === c.tareaId);
        if (t && t.col !== c.despues && out.plan.columnas.some((x) => x.key === c.despues)) {
          const de = out.plan.columnas.find((x) => x.key === t.col);
          const a = out.plan.columnas.find((x) => x.key === c.despues);
          if (de) de.cuantos = Math.max(0, de.cuantos - 1);
          if (a) a.cuantos += 1;
          t.col = c.despues;
          pendientes.tareas.add(t.id);
        }
      } else if (c.tipo === "tarea-nueva" && out.plan) {
        const primera = out.plan.columnas[0];
        if (!primera) continue;
        const nueva = {
          id: op.id,
          titulo: c.titulo,
          proyecto: null,
          deadline: null,
          cuando: "sin-fecha",
          banda: "media",
          esInstancia: false,
          vencida: false,
          linkEscritorio: "/plan",
          estado: "por_hacer",
          col: primera.key,
          prioridad: "sin_priorizar",
          motivo: "Borrador: se confirma al volver la conexión"
        };
        out.plan.tareas.unshift(nueva);
        primera.cuantos += 1;
        pendientes.tareas.add(op.id);
      }
    }
    return { copia: out, pendientes };
  }

  // lib/sin-conexion/local.ts
  async function abrir(p) {
    const guardada = await p.almacen.leerLlave().catch(() => null);
    if (!guardada) return { ok: false, motivo: "nada" };
    let dek;
    try {
      const kek = await llaveDeLaClave(p.clave, deBase64url(guardada.sal), guardada.vueltas);
      dek = await importarLlave(await descifrarBytes({ iv: guardada.iv, datos: guardada.envuelta }, kek, aadDeLlave(p.email, guardada.dispositivo)));
    } catch {
      return { ok: false, motivo: "clave" };
    }
    const cola = await leerColaCon({ email: p.email, llave: dek, almacen: p.almacen });
    if (vencida(guardada.vistoServidor, p.ahora) && !cola.length) {
      await p.almacen.borrar();
      return { ok: false, motivo: "vencida" };
    }
    const { copias, viejas } = await copiasYViejas({ email: p.email, llave: dek, almacen: p.almacen, ahora: p.ahora, conCola: new Set(cola.map((o) => o.ws)) });
    return { ok: true, copias, viejas, llave: dek, cola };
  }
  async function copiasYViejas(p) {
    const copias = [];
    let viejas = 0;
    for (const c of await p.almacen.leerCopias()) {
      if (c.version !== VERSION_COPIA) {
        viejas++;
        continue;
      }
      let copia;
      try {
        copia = await descifrarJson({ iv: c.iv, datos: c.datos }, p.llave, aadDeCopia(p.email, c.ws));
      } catch {
        viejas++;
        continue;
      }
      if (vencida(copia.hecha, p.ahora) && !p.conCola?.has(c.ws)) continue;
      copias.push(copia);
    }
    copias.sort((a, b) => a.negocio.nombre.localeCompare(b.negocio.nombre));
    return { copias, viejas };
  }
  var idDeCambio = () => aBase64url(alAzar(16));
  async function encolar(p) {
    const hay = await p.almacen.leerCola();
    if (hay.length >= TOPE_COLA) return false;
    const seq = hay.reduce((m, c2) => Math.max(m, c2.seq), 0) + 1;
    const c = await cifrarJson(p.op, p.llave, aadDeCola(p.email, p.op.id));
    await p.almacen.guardarEnCola({ id: p.op.id, ws: p.op.ws, seq, iv: c.iv, datos: c.datos });
    return true;
  }
  async function leerColaCon(p) {
    const filas = [...await p.almacen.leerCola().catch(() => [])].sort((a, b) => a.seq - b.seq);
    const out = [];
    for (const f of filas) {
      try {
        const op = validarOperacion(await descifrarJson({ iv: f.iv, datos: f.datos }, p.llave, aadDeCola(p.email, f.id)));
        if (op && op.id === f.id) out.push(op);
      } catch {
      }
    }
    return out;
  }

  // lib/sin-conexion/cascaron.ts
  function h(tag, attrs = {}, ...hijos) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === void 0 || v === false) continue;
      if (typeof v === "function") el.addEventListener(k.replace(/^on/, ""), v);
      else if (v === true) el.setAttribute(k, "");
      else el.setAttribute(k, v);
    }
    for (const x of hijos) if (x) el.append(typeof x === "string" ? document.createTextNode(x) : x);
    return el;
  }
  function motivo() {
    const m = document.querySelector('meta[name="mako-motivo"]')?.getAttribute("content");
    if (m === "sin-red" || m === "no-responde") return m;
    return navigator.onLine ? "probando" : "sin-red";
  }
  var raiz = () => document.getElementById("mako-sin-conexion");
  function pintar(...hijos) {
    const r = raiz();
    r.replaceChildren(...hijos.filter((x) => !!x));
  }
  var relojInactividad = null;
  function bloquear(motivo2) {
    if (relojInactividad) {
      clearTimeout(relojInactividad);
      relojInactividad = null;
    }
    pantallaEntrar(motivo2);
  }
  function armarReloj() {
    if (relojInactividad) clearTimeout(relojInactividad);
    relojInactividad = setTimeout(() => bloquear("Se cerró por inactividad. Vuelve a entrar con tu clave."), BLOQUEO_INACTIVO_MS);
  }
  var alTocar = () => {
    if (relojInactividad) armarReloj();
  };
  function pantallaEntrar(error) {
    if (relojInactividad) {
      clearTimeout(relojInactividad);
      relojInactividad = null;
    }
    const email = h("input", { id: "sc-email", class: "campo", type: "email", autocomplete: "username", required: true });
    const clave2 = h("input", { id: "sc-clave", class: "campo", type: "password", autocomplete: "current-password", required: true });
    const boton = h("button", { type: "submit", class: "boton" }, "Abrir");
    const aviso = h("p", { class: "error", role: "alert", hidden: !error }, error ?? "");
    const form = h(
      "form",
      {
        class: "entrar",
        onsubmit: (ev) => {
          ev.preventDefault();
          boton.disabled = true;
          boton.textContent = "Abriendo…";
          void entrar(email.value, clave2.value).finally(() => {
            boton.disabled = false;
            boton.textContent = "Abrir";
          });
        }
      },
      h("h1", {}, "MaKo sin conexión"),
      h("p", { class: "bajada" }, motivo() === "no-responde" ? "MaKo no responde ahora. Entra con tu email y la clave de esta computadora para ver lo guardado." : "Entra con tu email y la clave de esta computadora para ver lo guardado."),
      aviso,
      h("label", { for: "sc-email", class: "rotulo" }, "Tu email"),
      email,
      h("label", { for: "sc-clave", class: "rotulo" }, "La clave de esta computadora"),
      clave2,
      boton,
      h("p", { class: "nota" }, "Se activa con conexión, en Settings › Instalar la app › Sin conexión."),
      h("button", { type: "button", class: "boton-texto", onclick: () => location.reload() }, "Reintentar con conexión")
    );
    pintar(form);
    email.focus();
  }
  var NO_COINCIDE = "El email o la clave no coinciden con lo guardado en esta computadora.";
  async function entrar(emailCrudo, clave2) {
    const email = normalizarEmail(emailCrudo);
    const nombre = await nombreDeBase(email);
    if (!await existeBase(nombre)) {
      await llaveDeLaClave(clave2, alAzar(16), VUELTAS).catch(() => void 0);
      return pantallaEntrar(NO_COINCIDE);
    }
    const almacen = almacenIdb(nombre);
    const r = await abrir({ email, clave: clave2, almacen });
    if (!r.ok) {
      if (r.motivo === "vencida") return pantallaEntrar("Lo guardado tenía más de 30 días sin conexión y se borró. Vuelve a activarlo con conexión.");
      return pantallaEntrar(NO_COINCIDE);
    }
    if (!r.copias.length) {
      return pantallaEntrar(r.viejas ? "Lo guardado es de una versión anterior. Abre MaKo una vez con conexión para renovarlo." : "Todavía no hay una copia guardada. Se guarda sola con conexión, cada 10 minutos.");
    }
    const s = { email, almacen, llave: r.llave, cola: r.cola, copias: r.copias };
    if (r.copias.length === 1) return pantallaNegocio(s, r.copias[0]);
    pantallaElegir(s);
  }
  function pantallaElegir(s) {
    pintar(h(
      "div",
      { class: "entrar" },
      h("h1", {}, "¿Qué negocio?"),
      ...s.copias.map((c) => h("button", { type: "button", class: "fila-negocio", onclick: () => pantallaNegocio(s, c) }, c.negocio.nombre))
    ));
  }
  async function escribir(s, base, cambio, despues) {
    const op = { id: idDeCambio(), ws: base.negocio.id, hecha: (/* @__PURE__ */ new Date()).toISOString(), cambio };
    const entro = await encolar({ email: s.email, llave: s.llave, almacen: s.almacen, op });
    if (!entro) {
      avisar("Hay demasiados cambios sin subir. Vuelve a conectarte para subirlos antes de seguir.");
      return;
    }
    s.cola.push(op);
    despues();
  }
  function avisar(texto2) {
    const a = h("div", { class: "aviso-flotante", role: "alert" }, texto2);
    raiz().append(a);
    setTimeout(() => a.remove(), 6e3);
  }
  function cinta(copia, sinSubir) {
    const m = motivo();
    const texto2 = m === "probando" ? `Así se ve MaKo sin conexión · lo que ves es ${deCuando(copia.hecha, copia.tz)}` : textoDeLaCinta({ motivo: m, hecha: copia.hecha, tz: copia.tz });
    return h(
      "div",
      { class: "cinta", role: "status" },
      h("span", {}, texto2),
      sinSubir ? h("span", { class: "cinta-cuenta" }, `${sinSubir} ${sinSubir === 1 ? "cambio espera" : "cambios esperan"} la conexión`) : null,
      h("button", { type: "button", class: "cinta-boton", onclick: () => location.reload() }, "Reintentar")
    );
  }
  function pantallaNegocio(s, base, tab = location.pathname.startsWith("/plan") ? "plan" : "crm", e = {}) {
    const { copia, pendientes } = conLoPendiente(base, s.cola);
    const sinSubir = s.cola.filter((op) => op.ws === base.negocio.id).length;
    const otra = (t, x = {}) => pantallaNegocio(s, base, t, x);
    const cuerpo = h("main", { class: "cuerpo" });
    const tabs = h(
      "nav",
      { class: "tabs", "aria-label": "Secciones" },
      ...["crm", "plan"].map((t) => h("button", {
        type: "button",
        class: "tab",
        "aria-current": t === tab ? "page" : void 0,
        onclick: () => otra(t)
      }, t === "crm" ? "CRM" : "Plan"))
    );
    const cabecera = h(
      "header",
      { class: "cabecera" },
      h("span", { class: "marca" }, "MaKo"),
      s.copias.length > 1 ? h("button", { type: "button", class: "boton-texto", onclick: () => pantallaElegir(s) }, copia.negocio.nombre) : h("span", { class: "negocio" }, copia.negocio.nombre),
      tabs,
      h("span", { class: "quien" }, copia.persona.nombre),
      h("button", { type: "button", class: "boton-texto salir", onclick: () => bloquear() }, "Salir")
    );
    const faltan = copia.faltan.length ? h("p", { class: "aviso" }, `No se pudo guardar ${copia.faltan.join(" ni ")} en la última copia.`) : null;
    const deAntes = (copia.deAntes ?? []).map((d) => h("p", { class: "aviso" }, `No se pudo actualizar ${d.que}: lo que ves es ${deCuando(d.hecha, copia.tz)}.`));
    const ctx = { s, base, copia, pendientes, e, otra };
    if (tab === "crm") cuerpo.append(vistaCrm(ctx));
    else cuerpo.append(vistaPlan(ctx));
    armarReloj();
    pintar(
      cinta(copia, sinSubir),
      cabecera,
      faltan,
      ...deAntes,
      cuerpo,
      h("p", { class: "pie" }, `${NECESITA_CONEXION.escribir} WhatsApp, la IA y los cobros necesitan conexión.`)
    );
    if (tab === "crm" && e.fichaDe != null) {
      const t = copia.crm?.tableros[Math.min(e.funnelIdx ?? 0, (copia.crm?.tableros.length ?? 1) - 1)];
      const c = t?.tarjetas.find((x) => x.id === e.fichaDe);
      if (t && c) ficha(ctx, t, c);
    }
  }
  function vistaCrm(ctx) {
    const { copia, e } = ctx;
    const caja = h("section", { class: "crm" });
    if (!copia.crm || !copia.crm.tableros.length) {
      caja.append(h("p", { class: "vacio" }, "El CRM no quedó guardado en la última copia."));
      return caja;
    }
    const tableros = copia.crm.tableros;
    const funnelIdx = Math.min(e.funnelIdx ?? 0, tableros.length - 1);
    const t = tableros[funnelIdx];
    const buscador = h("input", { class: "campo buscar", type: "search", placeholder: "Buscar por nombre, email o teléfono", value: e.filtro ?? "" });
    buscador.addEventListener("input", () => {
      const cols = caja.querySelector(".columnas");
      if (cols) cols.replaceWith(columnasCrm({ ...ctx, e: { ...e, funnelIdx, filtro: buscador.value } }, t));
    });
    const barra = h(
      "div",
      { class: "barra" },
      tableros.length > 1 ? selector(tableros.map((x) => x.funnels.find((f) => f.id === x.funnelId)?.nombre ?? "CRM"), funnelIdx, (i) => ctx.otra("crm", { funnelIdx: i, filtro: buscador.value })) : null,
      buscador
    );
    caja.append(barra, columnasCrm({ ...ctx, e: { ...e, funnelIdx } }, t));
    return caja;
  }
  function selector(opciones, actual, al) {
    const s = h("select", { class: "campo selector", "aria-label": "Funnel" }, ...opciones.map((o, i) => {
      const op = h("option", { value: String(i) }, o);
      op.selected = i === actual;
      return op;
    }));
    s.addEventListener("change", () => al(Number(s.value)));
    return s;
  }
  var coincide = (c, f) => {
    const q = f.trim().toLowerCase();
    if (!q) return true;
    return [c.nombre, c.segunda, c.telefono, c.contacto?.email].some((x) => (x ?? "").toLowerCase().includes(q));
  };
  function columnasCrm(ctx, t) {
    const filtro = ctx.e.filtro ?? "";
    return h("div", { class: "columnas" }, ...t.columnas.map((col) => {
      const tarjetas = t.tarjetas.filter((c) => c.col === col.key && coincide(c, filtro));
      return h(
        "div",
        { class: "columna" },
        h("div", { class: "columna-titulo" }, h("span", {}, col.titulo), h("span", { class: "cuantos" }, String(filtro ? tarjetas.length : col.cuantos))),
        col.total ? h("div", { class: "columna-total" }, col.total) : null,
        ...tarjetas.map((c) => h(
          "button",
          { type: "button", class: "tarjeta", onclick: () => ficha(ctx, t, c) },
          h("span", { class: "tarjeta-nombre" }, c.nombre),
          c.segunda ? h("span", { class: "tarjeta-segunda" }, c.segunda) : null,
          ctx.pendientes.leads.has(c.id) ? h("span", { class: "pendiente" }, "Se sube al volver") : null,
          h(
            "span",
            { class: "tarjeta-pie" },
            c.plata ? h("span", {}, c.plata) : null,
            c.senal.texto ? h("span", { class: `senal ${c.senal.tono ?? ""}` }, c.senal.texto) : null
          )
        ))
      );
    }));
  }
  function fecha(iso, tz) {
    if (!iso) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return null;
    try {
      return new Intl.DateTimeFormat("es-AR", { timeZone: tz, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(t);
    } catch {
      return new Date(t).toLocaleString();
    }
  }
  function destinosDe(t, c) {
    const actual = t.columnas.find((x) => x.key === c.col);
    if (!actual?.sale) return [];
    return t.columnas.filter((x) => x.key !== c.col && x.movible);
  }
  function ficha(ctx, t, c) {
    const { copia, s, base } = ctx;
    const funnelIdx = Math.max(0, copia.crm?.tableros.indexOf(t) ?? 0);
    const volver = () => ctx.otra("crm", { ...ctx.e, funnelIdx, fichaDe: c.id });
    const etapa = t.columnas.find((x) => x.key === c.col)?.titulo ?? null;
    const k = c.contacto;
    const dato = (rotulo, valor) => valor ? h("div", { class: "dato" }, h("dt", {}, rotulo), h("dd", {}, valor)) : null;
    const notas = copia.crm?.notas[String(c.id)] ?? [];
    const cerrar = () => {
      capa.remove();
      document.removeEventListener("keydown", esc);
    };
    const esc = (ev) => {
      if (ev.key === "Escape") cerrar();
    };
    document.addEventListener("keydown", esc);
    const destinos = destinosDe(t, c);
    const selEtapa = h(
      "select",
      { class: "campo", "aria-label": "Mover a" },
      h("option", { value: "" }, "Mover a…"),
      ...destinos.map((x) => h("option", { value: x.key }, x.titulo))
    );
    selEtapa.addEventListener("change", () => {
      if (!selEtapa.value) return;
      void escribir(s, base, { tipo: "etapa", leadId: c.id, funnelId: t.funnelId ?? null, antes: c.col, despues: selEtapa.value }, volver);
    });
    const mover = destinos.length ? h("div", { class: "escribir" }, selEtapa) : h("p", { class: "nota" }, "Desde esta etapa no se mueve sin conexión (Ganado, un cobro o un paso con datos se hacen con conexión).");
    const campos = [
      ["nombre", "Nombre", c.nombre],
      ["email", "Email", k?.email ?? ""],
      ["empresa", "Empresa", k?.empresa ?? ""]
    ];
    const inputs = campos.map(([campo, rotulo, valor]) => ({ campo, valor, el: h("input", { class: "campo", "aria-label": rotulo, value: valor, placeholder: rotulo }) }));
    const formContacto = h("form", {
      class: "escribir",
      hidden: true,
      onsubmit: (ev) => {
        ev.preventDefault();
        void (async () => {
          for (const i of inputs) {
            const nuevo = i.el.value.trim();
            if (nuevo === (i.valor ?? "").trim() || i.campo === "nombre" && !nuevo) continue;
            const op = { id: idDeCambio(), ws: base.negocio.id, hecha: (/* @__PURE__ */ new Date()).toISOString(), cambio: { tipo: "contacto", leadId: c.id, campo: i.campo, antes: i.valor || null, despues: nuevo || null } };
            if (!await encolar({ email: s.email, llave: s.llave, almacen: s.almacen, op })) {
              avisar("Hay demasiados cambios sin subir.");
              break;
            }
            s.cola.push(op);
          }
          volver();
        })();
      }
    }, ...inputs.map((i) => i.el), h("button", { type: "submit", class: "boton" }, "Guardar"));
    const editar = h("button", { type: "button", class: "boton-texto", onclick: () => {
      formContacto.hidden = !formContacto.hidden;
    } }, "Editar nombre, email o empresa");
    const nota = h("textarea", { class: "campo area", rows: "3", placeholder: "Escribe una nota", maxlength: String(TOPE_NOTA_COLA) });
    const formNota = h("form", {
      class: "escribir",
      onsubmit: (ev) => {
        ev.preventDefault();
        const texto2 = nota.value.trim();
        if (!texto2) return;
        void escribir(s, base, { tipo: "nota", leadId: c.id, texto: texto2 }, volver);
      }
    }, nota, h("button", { type: "submit", class: "boton" }, "Guardar nota"));
    const capa = h(
      "div",
      { class: "capa", onclick: (ev) => {
        if (ev.target === capa) cerrar();
      } },
      h(
        "aside",
        { class: "ficha", role: "dialog", "aria-modal": "true", "aria-label": c.nombre },
        h("div", { class: "ficha-cabeza" }, h("h2", {}, c.nombre), h("button", { type: "button", class: "boton-texto", onclick: cerrar }, "Cerrar")),
        ctx.pendientes.leads.has(c.id) ? h("p", { class: "pendiente" }, "Tiene cambios que se suben cuando vuelva la conexión, con tu OK.") : null,
        h(
          "dl",
          { class: "datos" },
          dato("Etapa", etapa),
          dato("Teléfono", c.telefono ? `+${c.telefono}` : null),
          dato("Email", k?.email),
          dato("Instagram", c.soloInstagram ? `@${c.soloInstagram}` : null),
          dato("Empresa", k?.empresa),
          dato("Llegó por", k?.origen),
          dato("Llegó", fecha(k?.creado ?? null, copia.tz)),
          dato("Reunión", fecha(k?.reunion ?? null, copia.tz)),
          dato("Monto", c.plata)
        ),
        mover,
        editar,
        formContacto,
        h("p", { class: "nota" }, NECESITA_CONEXION.whatsapp),
        h("h3", {}, "Notas"),
        formNota,
        notas.length ? h("ul", { class: "notas" }, ...notas.map((n) => h(
          "li",
          {},
          h("p", {}, n.texto),
          h("span", { class: "nota" }, `${n.autor} · ${fecha(n.cuando, copia.tz) ?? ""}`),
          n.pendiente ? h("span", { class: "pendiente" }, "Se sube al volver") : null
        ))) : h("p", { class: "vacio" }, copia.crm?.notasRecortadas ? "Sin notas en la copia (guarda las más nuevas del negocio)." : "Sin notas guardadas.")
      )
    );
    raiz().append(capa);
    capa.querySelector("button")?.focus();
  }
  var VISTAS = [["prioridades", "Prioridades"], ["tareas", "Tareas"], ["proyectos", "Proyectos"], ["recurrentes", "Recurrentes"]];
  function vistaPlan(ctx) {
    const { copia, s, base, pendientes } = ctx;
    const vista = ctx.e.vistaPlan ?? "prioridades";
    const caja = h("section", { class: "plan" });
    const p = copia.plan;
    if (!p) {
      caja.append(h("p", { class: "vacio" }, "El Plan no quedó guardado en la última copia."));
      return caja;
    }
    const seg = h("div", { class: "segmentado", role: "tablist" }, ...VISTAS.map(([k, t]) => h("button", {
      type: "button",
      role: "tab",
      class: "segmento",
      "aria-selected": k === vista ? "true" : "false",
      onclick: () => ctx.otra("plan", { vistaPlan: k })
    }, t)));
    caja.append(seg);
    const proyecto = (x) => x.proyecto ? `${x.proyecto.emoji ? x.proyecto.emoji + " " : ""}${x.proyecto.nombre}` : null;
    const plazo = (d, vencida2) => d ? h("span", { class: vencida2 ? "senal rojo" : "senal" }, `${d.slice(8, 10)}/${d.slice(5, 7)}`) : null;
    const enTareas = () => ctx.otra("plan", { vistaPlan: "tareas" });
    if (vista === "prioridades") {
      caja.append(p.prioridades.length ? h("ul", { class: "lista" }, ...p.prioridades.map((t) => h(
        "li",
        { class: "fila" },
        h("span", { class: "fila-titulo" }, t.titulo),
        h("span", { class: "fila-segunda" }, proyecto(t) ?? ""),
        plazo(t.deadline, t.vencida)
      ))) : h("p", { class: "vacio" }, "Sin prioridades en la última copia."));
    } else if (vista === "tareas") {
      const titulo = h("input", { class: "campo", placeholder: "Nueva tarea", maxlength: String(TOPE_TITULO), "aria-label": "Nueva tarea" });
      caja.append(h("form", {
        class: "escribir en-fila",
        onsubmit: (ev) => {
          ev.preventDefault();
          const t = titulo.value.trim();
          if (t) void escribir(s, base, { tipo: "tarea-nueva", titulo: t }, enTareas);
        }
      }, titulo, h("button", { type: "submit", class: "boton" }, "Agregar")));
      caja.append(h("div", { class: "columnas" }, ...p.columnas.map((col) => {
        const ts = p.tareas.filter((t) => t.col === col.key);
        return h(
          "div",
          { class: "columna" },
          h("div", { class: "columna-titulo" }, h("span", {}, col.titulo), h("span", { class: "cuantos" }, String(col.cuantos))),
          ...ts.map((t) => {
            const esBorrador = s.cola.some((op) => op.id === t.id);
            const mover = esBorrador ? null : (() => {
              const sel = h(
                "select",
                { class: "campo mini", "aria-label": `Mover «${t.titulo}»` },
                h("option", { value: "" }, "Mover a…"),
                ...p.columnas.filter((x) => x.key !== t.col).map((x) => h("option", { value: x.key }, x.titulo))
              );
              sel.addEventListener("change", () => {
                if (sel.value) void escribir(s, base, { tipo: "tarea-estado", tareaId: t.id, antes: t.col, despues: sel.value }, enTareas);
              });
              return sel;
            })();
            return h(
              "div",
              { class: "tarjeta" },
              h("span", { class: "tarjeta-nombre" }, t.titulo),
              proyecto(t) ? h("span", { class: "tarjeta-segunda" }, proyecto(t)) : null,
              t.motivo ? h("span", { class: "tarjeta-segunda" }, t.motivo) : null,
              pendientes.tareas.has(t.id) ? h("span", { class: "pendiente" }, "Se sube al volver") : null,
              h("span", { class: "tarjeta-pie" }, plazo(t.deadline, t.vencida)),
              mover
            );
          })
        );
      })));
    } else if (vista === "proyectos") {
      caja.append(p.proyectos.length ? h("ul", { class: "lista" }, ...p.proyectos.map((x) => h(
        "li",
        { class: "fila" },
        h("span", { class: "fila-titulo" }, `${x.emoji ? x.emoji + " " : ""}${x.nombre}`),
        h("span", { class: "fila-segunda" }, `${x.hechas} de ${x.total} · ${x.pct}%`),
        plazo(x.deadline)
      ))) : h("p", { class: "vacio" }, "Sin proyectos en la última copia."));
    } else {
      caja.append(p.recurrentes.length ? h("ul", { class: "lista" }, ...p.recurrentes.map((x) => h(
        "li",
        { class: "fila" },
        h("span", { class: "fila-titulo" }, x.titulo),
        h("span", { class: "fila-segunda" }, x.repite ?? "Se repite")
      ))) : h("p", { class: "vacio" }, "Sin recurrentes en la última copia."));
    }
    if (p.recortado) caja.append(h("p", { class: "nota" }, "Puede faltar parte del plan."));
    return caja;
  }
  function arrancar() {
    if (typeof indexedDB === "undefined" || !globalThis.crypto?.subtle) {
      pintar(h("div", { class: "entrar" }, h("h1", {}, "MaKo sin conexión"), h("p", { class: "bajada" }, "Este navegador no puede abrir lo guardado.")));
      return;
    }
    document.addEventListener("pointerdown", alTocar, true);
    document.addEventListener("keydown", alTocar, true);
    window.addEventListener("pagehide", () => bloquear());
    window.addEventListener("pageshow", (ev) => {
      if (ev.persisted) bloquear();
    });
    pantallaEntrar();
  }

  // lib/sin-conexion/entrada.ts
  arrancar();
})();
