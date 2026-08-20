// Baja los RECURSOS de un curso de /vip/ (PDFs, workbooks, plantillas).
//
// Por qué existe: curso-plan-vip.mjs saca las lecciones del RPC get_vip_lessons_secure
// y deja `pdfs: []`. Pero los cursos de /vip/ tienen material aparte, y son bastantes:
// el de ATV Advantage tiene 71 archivos que no se estaban bajando. El curso quedaba
// "completo" con 247 videos y sin un solo PDF, y nada lo avisaba.
//
// Dos endpoints, y hacen falta los dos:
//   vip_course_resources   -> metadata (título, módulo, file_type, file_size)
//   rpc/get_vip_resource_urls -> la URL FIRMADA de cada archivo
// Se juntan por id. Las URLs firmadas no necesitan sesión, así que la descarga es
// un fetch pelado — pero caducan, así que se capturan y se usan en la misma corrida.
//
// Igual que el resto: se lee lo que el navegador YA pidió con la sesión del usuario,
// no se le pega a la API por fuera.
//
//   node <abs>\scripts\curso-recursos-vip.mjs --plan C:\cursos\<slug>\plan.json

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync, unlinkSync } from 'node:fs';
// Cómo se baja un archivo y cómo se sabe si sirve: UN lugar, compartido con curso-pdfs.
import { puedeSerArchivo, bajarCuerpo, valido } from './curso-descarga.mjs';
// La metadata NO se captura: se PREGUNTA. Capturar la llamada correcta en el momento
// correcto no funciona (ver la cabecera de curso-api.mjs).
import { preguntarCurso } from './curso-api.mjs';
import { join, dirname } from 'node:path';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const PLAN = arg('plan', '');
const PORT = Number(arg('port', 9333));
const SEGUNDOS = Number(arg('segundos', 20));
// Cuánto se espera a que el lector entregue el archivo. 25s: los ZIP grandes tardan.
const ESPERA_LECTOR = Number(arg('espera-lector', 25)) * 1000;

if (!PLAN || !existsSync(PLAN)) { console.error('\n  ✖ Falta --plan <plan.json>\n'); process.exit(1); }
const base = dirname(PLAN);
const plan = JSON.parse(readFileSync(PLAN, 'utf8').replace(/^﻿/, ''));
const destino = join(base, 'recursos');

const limpio = (s) => String(s).normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
  .replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 110) || 'recurso';
const kb = (b) => `${(Number(b) / 1024).toFixed(0)} KB`;

// Abre todo lo que parezca un módulo o submódulo: sin esto, los recursos de /curso/
// nunca se piden. Mismo molde que curso-inventario.mjs.
const ABRIR = `
(() => {
  let n = 0;
  for (const el of document.querySelectorAll('button, summary, [role="button"], [aria-expanded]')) {
    if (el.getAttribute('aria-expanded') === 'true') continue;
    const t = (el.textContent || '').slice(0, 90);
    const cerrado = el.getAttribute('aria-expanded') === 'false' || el.tagName === 'SUMMARY';
    if (!cerrado && !/m[oó]dulo|bonus|fase|secci[oó]n|recurso|material|lut|clase|semana/i.test(t)) continue;
    try { el.click(); n++; } catch (e) {}
  }
  return n;
})();
`;

class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pend = new Map(); this.oye = [];
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pend.has(m.id)) {
        const { ok, no } = this.pend.get(m.id); this.pend.delete(m.id);
        m.error ? no(new Error(m.error.message)) : ok(m.result);
      } else if (m.method) for (const f of this.oye) f(m);
    });
  }
  enviar(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((ok, no) => {
      this.pend.set(id, { ok, no });
      setTimeout(() => this.pend.has(id) && (this.pend.delete(id), no(new Error(`timeout ${method}`))), 25000);
    });
  }
}

const main = async () => {
  let lista;
  try { lista = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json()); }
  catch { console.error(`\n  ✖ No hay CDP en ${PORT}. Corré curso-perfil.ps1.\n`); process.exit(1); }

  // ⚠️ Puede haber varias pestañas abiertas (una por curso). Sin filtrar por el slug
  // del plan se capturan los recursos del curso EQUIVOCADO, y el error es silencioso.
  //
  // EL SLUG SE SACA DEL SEGMENTO QUE SIGUE AL ÁREA, no por posición desde el final. El
  // `slice(-2, -1)` que había acá funcionaba de casualidad y solo en /vip/, donde la URL
  // termina en `/watch`:
  //
  //     /vip/<slug>/watch    slice(-2,-1) → '<slug>'   ✔ por accidente
  //     /curso/<slug>        slice(-2,-1) → 'curso'    ✖ el ÁREA, no el curso
  //
  // Y «curso» matchea CUALQUIER pestaña de /curso/, así que el filtro que existe para no
  // confundir dos cursos hacía exactamente eso. Es el tercer `slice` negativo sobre una
  // URL que muerde en esta área (ver docs/hallazgos-conocimiento.md).
  const partes = String(plan.pagina ?? '').split('/').filter(Boolean);
  const iArea = partes.findIndex((p) => p === 'curso' || p === 'vip');
  const slugPagina = (iArea > -1 ? partes[iArea + 1] : '') || plan.slug || '';
  if (!slugPagina) { console.error('\n  ✖ No pude sacar el slug de `pagina` ni del plan.\n'); process.exit(1); }

  // Y se aceptan las DOS áreas. Este script se escribió para /vip/, donde la lección vive
  // en `/watch`; el 84% de los cursos está en `/curso/`, donde no existe ese segmento —
  // así que para 26 de 31 planes nunca pudo correr, y el síntoma era «necesito la pestaña
  // /watch» sobre una pestaña que estaba abierta y era la correcta.
  // ⚠️ Y SI NO ESTÁ EN LA PÁGINA CORRECTA, SE NAVEGA. La descarga por lector deja la
  // pestaña en `/Reader?...`, así que una segunda corrida sobre el mismo curso no se
  // encontraba a sí misma y abortaba con «necesito la pestaña de ESTE curso abierta»
  // sobre el Chrome que ella misma había dejado ahí. Exigirle al usuario que deshaga lo
  // que hizo el script es un bug de uso, no un requisito.
  const origen = (() => { try { return new URL(plan.pagina).origin; } catch { return ''; } })();
  let t = lista.find((x) => x.type === 'page' && /\/(watch|curso|vip)\b/.test(x.url) && x.url.includes(slugPagina));
  let hayQueNavegar = false;
  if (!t && origen) {
    // Cualquier pestaña de la misma plataforma sirve: se la lleva a la página del curso.
    t = lista.find((x) => x.type === 'page' && x.url.startsWith(origen));
    hayQueNavegar = !!t;
  }
  if (!t) {
    console.error(`\n  ✖ No hay ninguna pestaña de ${origen || 'la plataforma'} abierta.`);
    console.error(`    Abiertas:`);
    for (const x of lista.filter((y) => y.type === 'page')) console.error(`      ${x.url}`);
    process.exit(1);
  }
  console.log(`\n  Curso   : ${plan.curso}`);
  console.log(`  Pestaña : ${t.url}`);

  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((ok, no) => {
    ws.addEventListener('open', ok, { once: true });
    ws.addEventListener('error', () => no(new Error('no pude conectar a CDP')), { once: true });
  });
  const cdp = new Cdp(ws);

  // ── LAS DOS ÁREAS USAN NOMBRES DISTINTOS PARA LO MISMO ──────────────────────
  // Este script se escribió mirando /vip/. El área /curso/ —donde vive el 84% de los
  // cursos— llama a las mismas tres cosas de otra forma, así que se aceptan los dos
  // nombres. El `vip_` primero solo por historia; el orden no cambia nada porque cada
  // patrón cae en su propia clave.
  //
  //   recursos   vip_course_resources   ·  course_resources
  //   módulos    vip_modules            ·  modules
  //   URLs       get_vip_resource_urls  ·  (no existe en /curso/: ver abajo)
  //
  // ⚠️ En /curso/ NO hay endpoint de URLs firmadas: el archivo se obtiene NAVEGANDO a
  // `/Reader?type=resource&id=<uuid>` y capturando lo que baja. Esa rama está más abajo
  // (`porLector`), y es la que necesita que el socket de CDP siga vivo durante toda la
  // descarga — por eso el `ws.close()` está al final y no acá.
  const cap = new Map();
  cdp.oye.push((m) => {
    if (m.method !== 'Network.responseReceived') return;
    const u = m.params.response.url;
    if (/\/(vip_course_resources|course_resources)\?/.test(u)) cap.set(m.params.requestId, 'meta');
    else if (/get_vip_resource_urls/.test(u)) cap.set(m.params.requestId, 'urls');
    else if (/\/(vip_modules|modules)\?/.test(u)) cap.set(m.params.requestId, 'modules');
  });

  await cdp.enviar('Network.enable');
  await cdp.enviar('Page.enable');
  if (hayQueNavegar) {
    console.log(`  La pestaña estaba en otra página: la llevo a ${plan.pagina}`);
    await cdp.enviar('Page.navigate', { url: plan.pagina });
    await new Promise((r) => setTimeout(r, 4000));
  }
  console.log(`  Recargando y capturando (${SEGUNDOS}s)…`);
  await cdp.enviar('Page.reload', { ignoreCache: true });

  // ⚠️ UN ACORDEÓN CERRADO NO PIDE NADA. En /curso/ los recursos cuelgan de los módulos y
  // la página los pide al ABRIRLOS, así que recargar y esperar devuelve cero y el script
  // reportaba «no capturé course_resources · suele ser que salió de caché» — culpando al
  // caché de algo que nunca se pidió. Es la misma lección que ya estaba en
  // `curso-api-sniff.mjs`, en un archivo distinto: la copia se quedó vieja.
  //
  // Varias rondas porque abrir un módulo revela submódulos que todavía no estaban.
  //
  // ⚠️ Y SE ITERA HASTA QUE DEJE DE LLEGAR, no una cantidad fija de rondas. La página
  // llama a estos endpoints ANTES de resolver la sesión —y ahí devuelven `[]`— y otra vez
  // después. Con rondas fijas, «Mateo Maffia» capturaba solo la anónima y el script
  // reportaba «no capturé course_resources · suele ser que salió de caché», culpando al
  // caché de una respuesta que sí había llegado, vacía. Sus 2 PDF existen: el inventario
  // los tenía, porque ÉL sí itera hasta converger.
  await new Promise((r) => setTimeout(r, 5000));
  let quietas = 0;
  for (let ronda = 1; ronda <= 10 && quietas < 2; ronda++) {
    const antes = cap.size;
    await cdp.enviar('Runtime.evaluate', { expression: ABRIR, returnByValue: true }).catch(() => null);
    await new Promise((r) => setTimeout(r, Math.max(3000, SEGUNDOS * 250)));
    const nuevas = cap.size - antes;
    quietas = nuevas > 0 ? 0 : quietas + 1;
    if (nuevas) console.log(`  ronda ${ronda}: +${nuevas} respuesta(s)`);
  }

  // ⚠️ Misma trampa que en curso-plan-vip.mjs: la página llama al mismo endpoint
  // antes y después de resolver la sesión, y quedarse con «la respuesta más
  // grande» se queda justo con la anónima —llena de filas, vacía de lo que hace
  // falta—. Se puntúa por UTILIDAD (filas que traen el campo clave) y el tamaño
  // solo desempata. Tamaño ≠ corrección.
  const CAMPO_UTIL = { urls: 'file_url', meta: 'title' };
  const utiles = (j, clave) => {
    if (!Array.isArray(j)) return j ? 1 : 0;
    const campo = CAMPO_UTIL[clave];
    return campo ? j.filter((x) => x?.[campo]).length : j.length;
  };
  const datos = {};
  const puntaje = {};
  for (const [rid, clave] of cap) {
    try {
      const { body } = await cdp.enviar('Network.getResponseBody', { requestId: rid });
      const j = JSON.parse(body);
      const u = utiles(j, clave);
      const n = Array.isArray(j) ? j.length : 1;
      const prev = puntaje[clave];
      // Una respuesta VACÍA nunca gana: `[]` es lo que devuelve la llamada anónima.
      if (!n) continue;
      if (!prev || u > prev.u || (u === prev.u && n > prev.n)) { datos[clave] = j; puntaje[clave] = { u, n }; }
    } catch { /* el body pudo salir del buffer */ }
  }
  // ⚠️ EL SOCKET NO SE CIERRA ACÁ. En /vip/ alcanzaba —las URLs firmadas se bajan con un
  // `fetch` pelado— pero en /curso/ el archivo se obtiene NAVEGANDO la pestaña, así que CDP
  // tiene que seguir vivo durante toda la descarga. Se cierra al final.

  // ── El camino del área /curso/: navegar el lector y capturar lo que baja ────────
  // El link del recurso es `/Reader?type=resource&id=<uuid>`, que es una PÁGINA. El
  // archivo real vive detrás de la sesión, y la sesión ya está resuelta en esta pestaña.
  const BASE_LECTOR = /\/curso\//.test(String(plan.pagina ?? ''))
    ? new URL(plan.pagina).origin
    : '';

  // Candidatas que van llegando, alimentadas por el listener de abajo.
  const cands = new Map();
  let listos = [];
  cdp.oye.push((m) => {
    if (m.method === 'Network.responseReceived') {
      const c = puedeSerArchivo(m.params.response);
      if (c) cands.set(m.params.requestId, c);
    }
    if (m.method === 'Network.loadingFinished' && cands.has(m.params.requestId)) {
      listos.push(m.params.requestId);
    }
  });

  /**
   * Baja UN recurso navegando su lector. `{buf, ext}` o `{error}`.
   *
   * ⚠️ NO SE TOMA LA PRIMERA RESPUESTA QUE PAREZCA UN ARCHIVO. La página del lector carga
   * sus propios assets —un logo, una miniatura— y `puedeSerArchivo` los acepta porque la
   * URL termina en `.jpg`. La primera versión bajó los 56 recursos de un curso y los 56
   * eran la MISMA imagen de 17 KB, renombrada con el título de cada recurso. Un fallo
   * que se presenta como éxito, y el conteo cerraba.
   *
   * El desempate es el TAMAÑO QUE YA CONOCEMOS: la metadata trae `file_size`. Se junta
   * todo lo que llegó en la ventana y gana el que coincide; si ninguno coincide, el más
   * grande que valide, que es lo mejor que se puede hacer sin el dato.
   */
  const porLector = async (id, bytesEsperados) => {
    cands.clear(); listos = [];
    const url = `${BASE_LECTOR}/Reader?type=resource&id=${encodeURIComponent(id)}`;
    await cdp.enviar('Page.navigate', { url }).catch(() => {});
    const t0 = Date.now();
    const descartes = [];
    const vistos = new Set();
    let mejor = null;
    while (Date.now() - t0 < ESPERA_LECTOR) {
      await new Promise((r) => setTimeout(r, 400));
      for (const rid of [...listos]) {
        if (vistos.has(rid)) continue;
        vistos.add(rid);
        const c = cands.get(rid);
        if (!c) continue;
        const res = await bajarCuerpo({ cdp, rid, cand: c, referer: plan.referer, ua: plan.userAgent });
        if (res.error) { descartes.push(res.error); continue; }
        // Coincide con el tamaño declarado: es ESE archivo, no hay nada mejor que buscar.
        if (bytesEsperados && res.buf.length === Number(bytesEsperados)) return res;
        if (!mejor || res.buf.length > mejor.buf.length) mejor = res;
      }
      // Si ya hay un candidato y el tamaño esperado no existe, se le da un respiro más
      // por si el archivo real todavía viene en camino, pero no se agota la ventana.
      if (mejor && !bytesEsperados && Date.now() - t0 > 6000) break;
    }
    if (mejor) {
      if (bytesEsperados) descartes.push(`ninguno pesa los ${bytesEsperados}B declarados; me quedo con ${mejor.buf.length}B`);
      return mejor;
    }
    // Se dice QUÉ se descartó y por qué: «no encontré el archivo» a secas manda a buscar
    // en el lugar equivocado. Con esto se ve si llegó algo y no validó, o si no llegó nada.
    return { error: descartes.length ? `nada válido en ${ESPERA_LECTOR / 1000}s — ${descartes.slice(0, 2).join(' · ')}` : `no bajó nada en ${ESPERA_LECTOR / 1000}s` };
  };

  for (const [clave, p] of Object.entries(puntaje)) {
    if (p.u < p.n) console.log(`  ⚠ ${clave}: me quedé con ${p.u}/${p.n} fila(s) útiles (${CAMPO_UTIL[clave] ?? 'sin campo clave'}).`);
  }

  // ── LA METADATA SE PREGUNTA, NO SE CAPTURA ──────────────────────────────────
  //
  // ⚠️ Esto reemplaza a la captura, que era irrecuperable por diseño. La página pide
  // `course_resources` ANTES de resolver la sesión —ahí devuelve `[]`— y otra vez
  // después, y cuál de las dos cae en la ventana depende de la red y del caché. Medido
  // sobre «Mateo Maffia»: `[]` corrida tras corrida, con la sesión viva y
  // `check_course_access` en true. Ninguna cantidad de rondas arregla una carrera.
  //
  // `preguntarCurso` evalúa un `fetch` DENTRO de la página, que ya tiene la sesión. No
  // hay ventana que errar. Y de paso corrigió un dato: el inventario le atribuía 2
  // recursos a «Mateo Maffia» que eran de OTRO curso —respuestas tardías que llegaron
  // mientras el barrido ya había navegado— y la API dice que tiene CERO.
  console.log('  Preguntándole a la API qué recursos tiene…');
  const api = await preguntarCurso(plan.slug || slugPagina, PORT);
  const meta = api.recursos ?? [];
  const mods = new Map((api.modulos ?? []).map((m) => [m.id, m]));
  const urls = new Map((Array.isArray(datos.urls) ? datos.urls : []).map((r) => [r.id, r.file_url]));
  console.log(`  ${api.curso}: ${meta.length} recurso(s) · ${mods.size} módulo(s)`);

  if (!meta.length) {
    console.log('\n  Este curso NO tiene recursos en la fuente. Nada que bajar.\n');
    ws.close();
    process.exit(0);
  }

  // Los mismos campos con otro nombre según el área. Se leen por acá y en ningún otro
  // lado: un `r.vip_module_id` suelto en /curso/ da `undefined`, y `undefined` como id de
  // módulo no falla — deja el recurso colgado del prefijo «00», que es un error que se ve
  // recién en el nombre del archivo.
  const moduloDe = (r) => r.vip_module_id ?? r.module_id ?? null;
  const ordenDe = (x) => Number(x?.sort_order ?? x?.order ?? 0);

  const raizDe = (id) => {
    let c = mods.get(id), visto = new Set();
    while (c?.parent_module_id && mods.has(c.parent_module_id) && !visto.has(c.id)) { visto.add(c.id); c = mods.get(c.parent_module_id); }
    return c ?? null;
  };
  const raices = [...mods.values()].filter((m) => !m.parent_module_id || !mods.has(m.parent_module_id))
    .sort((a, b) => ordenDe(a) - ordenDe(b));
  const ordenRaiz = new Map(raices.map((m, i) => [m.id, i + 1]));

  mkdirSync(destino, { recursive: true });
  console.log(`  Recursos: ${meta.length} · con URL firmada: ${urls.size}\n`);

  let ok = 0, ya = 0, sinUrl = 0, enlaces = 0;
  const fallos = [];
  const indice = [];

  // ⚠️ Los títulos NO son únicos: en este curso hay 7 recursos distintos llamados
  // «Miro» dentro del mismo módulo. La primera versión los nombraba igual y se
  // sobrescribían: reportó «71 bajado(s) · 0 con error» con 64 archivos en disco.
  // Un fallo que se presenta como éxito, otra vez. El nombre se hace único de
  // forma DETERMINISTA (sort_order y, si aún choca, los 6 primeros del id) para
  // que una segunda corrida produzca los mismos nombres y el skip funcione.
  const usados = new Set();
  const nombreUnico = (r, pref, ext) => {
    const t = limpio(r.title);
    for (const cand of [
      `${pref} - ${t}.${ext}`,
      `${pref}.${String(ordenDe(r)).padStart(2, '0')} - ${t}.${ext}`,
      `${pref}.${String(ordenDe(r)).padStart(2, '0')} - ${t} (${String(r.id).slice(0, 6)}).${ext}`,
    ]) if (!usados.has(cand)) { usados.add(cand); return cand; }
    const forzado = `${pref} - ${t} (${String(r.id).slice(0, 12)}).${ext}`;
    usados.add(forzado);
    return forzado;
  };

  for (const r of meta) {
    const raiz = raizDe(moduloDe(r));
    const pref = raiz ? String(ordenRaiz.get(raiz.id) ?? 0).padStart(2, '0') : '00';
    const ext = String(r.file_type ?? 'bin').replace(/^\./, '').toLowerCase();
    const nombre = nombreUnico(r, pref, ext);
    const salida = join(destino, nombre);
    // Se guarda el módulo HOJA además del raíz: es lo que después permite colgar el
    // recurso de SUS clases y no de las 38 del módulo raíz. La plataforma asocia por
    // módulo (`vip_module_id`), nunca por lección, así que la hoja es lo más fino que
    // el dato permite — bajar de ahí sería inventarlo.
    const hoja = mods.get(moduloDe(r));
    indice.push({
      nombre,
      modulo: raiz?.title ?? null,
      submodulo: hoja && hoja.id !== raiz?.id ? hoja.title : null,
      moduloId: moduloDe(r),
      bytes: r.file_size ?? null,
    });

    const url = urls.get(r.id);

    // ⚠️ Un recurso de tipo `link` NO es un archivo: es una URL (Miro, YouTube, Loom).
    // Bajarlo produce el HTML de la landing — 16 de los 71 de este curso quedaron así,
    // uno con 1,1 MB de HTML de YouTube. Lo que hay que guardar es la URL, y el portal
    // la muestra como link externo, no como visor de archivo.
    if (String(r.file_type ?? '').toLowerCase() === 'link') {
      if (!url) { console.log(`  ⚠ ${nombre} — link sin URL`); sinUrl++; continue; }
      indice[indice.length - 1].tipo = 'link';
      indice[indice.length - 1].url = url;
      // Si quedó el blob de una corrida vieja, se borra: es HTML, no el recurso.
      if (existsSync(salida)) { try { unlinkSync(salida); console.log(`  ↻ ${nombre} — era un blob de HTML, lo reemplazo por la URL`); } catch {} }
      else console.log(`  ↗ ${nombre.replace(/\.link$/, '')} → ${url.slice(0, 70)}`);
      enlaces++;
      continue;
    }

    if (existsSync(salida) && Number(r.file_size) && statSync(salida).size === Number(r.file_size)) {
      console.log(`  = ${nombre}`);
      ya++; continue;
    }
    // ── SIN URL FIRMADA: EL CAMINO DEL ÁREA /curso/ ─────────────────────────────
    //
    // /vip/ tiene un endpoint que devuelve URLs firmadas (`get_vip_resource_urls`).
    // /curso/ NO tiene ninguno: el archivo se obtiene NAVEGANDO a
    // `/Reader?type=resource&id=<uuid>` —que es una PÁGINA, no el archivo— y capturando
    // lo que el navegador descarga. La sesión ya está resuelta en esta pestaña, así que
    // no hay que pelearse con cookies. Es el mismo mecanismo de `curso-pdfs.mjs`.
    //
    // Sin esto, los 10 cursos de /curso/ con material reportaban «sin URL firmada» sobre
    // 401 archivos que sí se podían bajar.
    if (!url) {
      if (!BASE_LECTOR) { console.log(`  ⚠ ${nombre} — sin URL firmada`); sinUrl++; continue; }
      const bajado = await porLector(String(r.id), r.file_size);
      if (bajado.error) {
        console.error(`  ✖ ${nombre} — ${bajado.error}`);
        fallos.push({ nombre, error: bajado.error });
        continue;
      }
      // La extensión REAL puede no ser la que decía `file_type`: manda el archivo.
      const nombreReal = nombre.replace(/\.[a-z0-9]+$/i, `.${bajado.ext}`);
      writeFileSync(join(destino, nombreReal), bajado.buf);
      indice[indice.length - 1].nombre = nombreReal;
      console.log(`  ✓ ${nombreReal}  (${kb(bajado.buf.length)})  [lector]`);
      ok++;
      continue;
    }

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      // Un endpoint que contesta HTML con 200 dejaría un PDF roto "bajado": ya
      // pasó con Drive. Si dice PDF, tiene que empezar con %PDF-.
      if (!valido(buf, ext)) {
        throw new Error(`${buf.length}B no valida como .${ext} (¿página de error con 200?)`);
      }
      writeFileSync(salida, buf);
      console.log(`  ✓ ${nombre}  (${kb(buf.length)})`);
      ok++;
    } catch (e) {
      console.error(`  ✖ ${nombre} — ${e.message}`);
      fallos.push({ nombre, error: e.message });
    }
  }

  ws.close();   // recién acá: la descarga por lector necesitaba CDP vivo

  writeFileSync(join(base, 'recursos.json'), JSON.stringify({ curso: plan.curso, total: meta.length, items: indice }, null, 2), 'utf8');

  // El conteo se verifica contra el DISCO, no contra el bucle: la versión anterior
  // decía «71 bajado(s)» con 64 archivos, porque contaba intentos y no resultados.
  // El conteo se verifica contra el DISCO, no contra el bucle. Los enlaces NO son
  // archivos, así que se descuentan del total esperado: si no, «faltan 16».
  const enDisco = readdirSync(destino).length;
  const esperadosEnDisco = meta.length - enlaces - sinUrl - fallos.length;
  console.log('\n' + '─'.repeat(70));
  console.log(`  ${ok} bajado(s) · ${ya} ya estaban · ${enlaces} enlace(s) · ${sinUrl} sin URL · ${fallos.length} con error`);
  console.log(`  archivos en disco: ${enDisco} / ${esperadosEnDisco} esperados  (${meta.length} recursos, ${enlaces} son links)`);
  if (enDisco < esperadosEnDisco) {
    console.log(`  ⚠ FALTAN ${esperadosEnDisco - enDisco}: hay nombres que se pisaron.`);
  }
  console.log(`  → ${destino}`);
  console.log('─'.repeat(70) + '\n');
  process.exit(fallos.length && !ok ? 1 : 0);
};

main().catch((e) => { console.error(`\n  ✖ ${e.message}\n`); process.exit(1); });
