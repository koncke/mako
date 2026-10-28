// ⚠️ ARCHIVO ARMADO: no se edita a mano. Sale de lib/sin-conexion/cascaron.ts con `node scripts/sin-conexion/armar.mjs`.
"use strict";
(() => {
  // lib/sin-conexion/almacen.ts
  var VERSION_BASE = 1;
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
  async function llaveDeLaClave(clave, sal, vueltas) {
    const base = await subtle().importKey("raw", enc.encode(clave), "PBKDF2", false, ["deriveKey"]);
    return subtle().deriveKey(
      { name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: vueltas },
      base,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }
  async function descifrarBytes(c, llave, aad) {
    return new Uint8Array(await subtle().decrypt(
      { name: "AES-GCM", iv: deBase64url(c.iv), additionalData: enc.encode(aad) },
      llave,
      deBase64url(c.datos)
    ));
  }
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
    escribir: "Escribir sin conexión llega en la próxima versión. Por ahora es para leer."
  };

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
    if (vencida(guardada.vistoServidor, p.ahora)) {
      await p.almacen.borrar();
      return { ok: false, motivo: "vencida" };
    }
    const copias = [];
    let viejas = 0;
    for (const c of await p.almacen.leerCopias()) {
      if (c.version !== VERSION_COPIA) {
        viejas++;
        continue;
      }
      let copia;
      try {
        copia = await descifrarJson({ iv: c.iv, datos: c.datos }, dek, aadDeCopia(p.email, c.ws));
      } catch {
        viejas++;
        continue;
      }
      if (vencida(copia.hecha, p.ahora)) continue;
      copias.push(copia);
    }
    copias.sort((a, b) => a.negocio.nombre.localeCompare(b.negocio.nombre));
    return { ok: true, copias, viejas };
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
    const clave = h("input", { id: "sc-clave", class: "campo", type: "password", autocomplete: "current-password", required: true });
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
          void entrar(email.value, clave.value).finally(() => {
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
      clave,
      boton,
      h("p", { class: "nota" }, "Se activa con conexión, en Settings › Instalar la app › Sin conexión."),
      h("button", { type: "button", class: "boton-texto", onclick: () => location.reload() }, "Reintentar con conexión")
    );
    pintar(form);
    email.focus();
  }
  var NO_COINCIDE = "El email o la clave no coinciden con lo guardado en esta computadora.";
  async function entrar(emailCrudo, clave) {
    const email = normalizarEmail(emailCrudo);
    const nombre = await nombreDeBase(email);
    if (!await existeBase(nombre)) {
      await llaveDeLaClave(clave, alAzar(16), VUELTAS).catch(() => void 0);
      return pantallaEntrar(NO_COINCIDE);
    }
    const r = await abrir({ email, clave, almacen: almacenIdb(nombre) });
    if (!r.ok) {
      if (r.motivo === "vencida") return pantallaEntrar("Lo guardado tenía más de 30 días sin conexión y se borró. Vuelve a activarlo con conexión.");
      return pantallaEntrar(NO_COINCIDE);
    }
    if (!r.copias.length) {
      return pantallaEntrar(r.viejas ? "Lo guardado es de una versión anterior. Abre MaKo una vez con conexión para renovarlo." : "Todavía no hay una copia guardada. Se guarda sola con conexión, cada 10 minutos.");
    }
    if (r.copias.length === 1) return pantallaNegocio(r.copias[0], r.copias);
    pantallaElegir(r.copias);
  }
  function pantallaElegir(copias) {
    pintar(h(
      "div",
      { class: "entrar" },
      h("h1", {}, "¿Qué negocio?"),
      ...copias.map((c) => h("button", { type: "button", class: "fila-negocio", onclick: () => pantallaNegocio(c, copias) }, c.negocio.nombre))
    ));
  }
  function cinta(copia) {
    const m = motivo();
    const texto = m === "probando" ? `Así se ve MaKo sin conexión · lo que ves es ${deCuando(copia.hecha, copia.tz)}` : textoDeLaCinta({ motivo: m, hecha: copia.hecha, tz: copia.tz });
    return h(
      "div",
      { class: "cinta", role: "status" },
      h("span", {}, texto),
      h("button", { type: "button", class: "cinta-boton", onclick: () => location.reload() }, "Reintentar")
    );
  }
  function pantallaNegocio(copia, copias, tab = location.pathname.startsWith("/plan") ? "plan" : "crm") {
    const cuerpo = h("main", { class: "cuerpo" });
    const tabs = h(
      "nav",
      { class: "tabs", "aria-label": "Secciones" },
      ...["crm", "plan"].map((t) => h("button", {
        type: "button",
        class: "tab",
        "aria-current": t === tab ? "page" : void 0,
        onclick: () => pantallaNegocio(copia, copias, t)
      }, t === "crm" ? "CRM" : "Plan"))
    );
    const cabecera = h(
      "header",
      { class: "cabecera" },
      h("span", { class: "marca" }, "MaKo"),
      copias.length > 1 ? h("button", { type: "button", class: "boton-texto", onclick: () => pantallaElegir(copias) }, copia.negocio.nombre) : h("span", { class: "negocio" }, copia.negocio.nombre),
      tabs,
      h("span", { class: "quien" }, copia.persona.nombre),
      h("button", { type: "button", class: "boton-texto salir", onclick: () => bloquear() }, "Salir")
    );
    const faltan = copia.faltan.length ? h("p", { class: "aviso" }, `No se pudo guardar ${copia.faltan.join(" ni ")} en la última copia.`) : null;
    const deAntes = (copia.deAntes ?? []).map((d) => h("p", { class: "aviso" }, `No se pudo actualizar ${d.que}: lo que ves es ${deCuando(d.hecha, copia.tz)}.`));
    if (tab === "crm") cuerpo.append(vistaCrm(copia));
    else cuerpo.append(vistaPlan(copia));
    armarReloj();
    pintar(
      cinta(copia),
      cabecera,
      faltan,
      ...deAntes,
      cuerpo,
      h("p", { class: "pie" }, `${NECESITA_CONEXION.escribir} WhatsApp, la IA y los cobros necesitan conexión.`)
    );
  }
  function vistaCrm(copia, funnelIdx = 0, filtro = "") {
    const caja = h("section", { class: "crm" });
    if (!copia.crm || !copia.crm.tableros.length) {
      caja.append(h("p", { class: "vacio" }, "El CRM no quedó guardado en la última copia."));
      return caja;
    }
    const tableros = copia.crm.tableros;
    const t = tableros[Math.min(funnelIdx, tableros.length - 1)];
    const redibujar = (i, f) => caja.replaceWith(vistaCrm(copia, i, f));
    const buscador = h("input", { class: "campo buscar", type: "search", placeholder: "Buscar por nombre, email o teléfono", value: filtro });
    buscador.addEventListener("input", () => {
      const cols = caja.querySelector(".columnas");
      if (cols) cols.replaceWith(columnasCrm(copia, t, buscador.value));
    });
    const barra = h(
      "div",
      { class: "barra" },
      tableros.length > 1 ? selector(tableros.map((x) => x.funnels.find((f) => f.id === x.funnelId)?.nombre ?? "CRM"), funnelIdx, (i) => redibujar(i, buscador.value)) : null,
      buscador
    );
    caja.append(barra, columnasCrm(copia, t, filtro));
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
  function columnasCrm(copia, t, filtro) {
    return h("div", { class: "columnas" }, ...t.columnas.map((col) => {
      const tarjetas = t.tarjetas.filter((c) => c.col === col.key && coincide(c, filtro));
      return h(
        "div",
        { class: "columna" },
        h("div", { class: "columna-titulo" }, h("span", {}, col.titulo), h("span", { class: "cuantos" }, String(filtro ? tarjetas.length : col.cuantos))),
        col.total ? h("div", { class: "columna-total" }, col.total) : null,
        ...tarjetas.map((c) => h(
          "button",
          { type: "button", class: "tarjeta", onclick: () => ficha(copia, t, c) },
          h("span", { class: "tarjeta-nombre" }, c.nombre),
          c.segunda ? h("span", { class: "tarjeta-segunda" }, c.segunda) : null,
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
  function ficha(copia, t, c) {
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
    const capa = h(
      "div",
      { class: "capa", onclick: (ev) => {
        if (ev.target === capa) cerrar();
      } },
      h(
        "aside",
        { class: "ficha", role: "dialog", "aria-modal": "true", "aria-label": c.nombre },
        h("div", { class: "ficha-cabeza" }, h("h2", {}, c.nombre), h("button", { type: "button", class: "boton-texto", onclick: cerrar }, "Cerrar")),
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
        h("p", { class: "nota" }, NECESITA_CONEXION.whatsapp),
        h("h3", {}, "Notas"),
        notas.length ? h("ul", { class: "notas" }, ...notas.map((n) => h("li", {}, h("p", {}, n.texto), h("span", { class: "nota" }, `${n.autor} · ${fecha(n.cuando, copia.tz) ?? ""}`)))) : h("p", { class: "vacio" }, copia.crm?.notasRecortadas ? "Sin notas en la copia (guarda las más nuevas del negocio)." : "Sin notas guardadas.")
      )
    );
    raiz().append(capa);
    capa.querySelector("button")?.focus();
  }
  var VISTAS = [["prioridades", "Prioridades"], ["tareas", "Tareas"], ["proyectos", "Proyectos"], ["recurrentes", "Recurrentes"]];
  function vistaPlan(copia, vista = "prioridades") {
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
      onclick: () => caja.replaceWith(vistaPlan(copia, k))
    }, t)));
    caja.append(seg);
    const proyecto = (x) => x.proyecto ? `${x.proyecto.emoji ? x.proyecto.emoji + " " : ""}${x.proyecto.nombre}` : null;
    const plazo = (d, vencida2) => d ? h("span", { class: vencida2 ? "senal rojo" : "senal" }, `${d.slice(8, 10)}/${d.slice(5, 7)}`) : null;
    if (vista === "prioridades") {
      caja.append(p.prioridades.length ? h("ul", { class: "lista" }, ...p.prioridades.map((t) => h(
        "li",
        { class: "fila" },
        h("span", { class: "fila-titulo" }, t.titulo),
        h("span", { class: "fila-segunda" }, proyecto(t) ?? ""),
        plazo(t.deadline, t.vencida)
      ))) : h("p", { class: "vacio" }, "Sin prioridades en la última copia."));
    } else if (vista === "tareas") {
      caja.append(h("div", { class: "columnas" }, ...p.columnas.map((col) => {
        const ts = p.tareas.filter((t) => t.col === col.key);
        return h(
          "div",
          { class: "columna" },
          h("div", { class: "columna-titulo" }, h("span", {}, col.titulo), h("span", { class: "cuantos" }, String(col.cuantos))),
          ...ts.map((t) => h(
            "div",
            { class: "tarjeta" },
            h("span", { class: "tarjeta-nombre" }, t.titulo),
            proyecto(t) ? h("span", { class: "tarjeta-segunda" }, proyecto(t)) : null,
            t.motivo ? h("span", { class: "tarjeta-segunda" }, t.motivo) : null,
            h("span", { class: "tarjeta-pie" }, plazo(t.deadline, t.vencida))
          ))
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
