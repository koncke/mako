// Recorre TODAS las clases de un curso y arma el plan de descarga. Una corrida
// por curso, no una por clase.
//
// Como funciona y por que asi: el listado de clases son <button>, no links — es
// una SPA que cambia el src del <iframe> del player. No hay URL por clase, asi
// que la unica forma de enumerar es clickear cada boton y leer el iframe nuevo.
//
// Se queda con el ID del video del player (ej. Vimeo 1214168115), NO con la URL
// firmada del CDN: esas traen exp=<timestamp> y caducan en minutos. El ID es
// estable y yt-dlp resuelve el resto con el Referer correcto.
//
//   node <abs>\scripts\curso-plan.mjs
//   node <abs>\scripts\curso-plan.mjs --port 9333 --espera 9

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const PORT = Number(arg('port', 9333));
const ESPERA = Number(arg('espera', 9)) * 1000; // tope para que cambie el iframe
// Cuantas vueltas de desplegar acordeones. Se corta solo al CONVERGER; esto es la red.
const RONDAS = Number(arg('rondas', 40));
const RAIZ = arg('raiz', 'C:\\cursos');
// El autor NO está en la página del curso, pero SÍ es parte del nombre de la carpeta
// («<Curso> - <Autor>», que cumplen 36 de 39) y del título en el portal. Lo mismo que
// en curso-plan-vip.mjs: si falta se avisa fuerte en vez de generar a medias.
const AUTOR = arg('autor', '');

const slug = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 80);

// Nombre de archivo valido en Windows: sin <>:"/\|?* ni punto/espacio final.
const limpio = (s) => s.normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
  .replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 120) || 'sin-titulo';

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
  enviar(method, params = {}, sessionId) {
    const id = ++this.id;
    this.ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
    return new Promise((ok, no) => {
      this.pend.set(id, { ok, no });
      setTimeout(() => this.pend.has(id) && (this.pend.delete(id), no(new Error(`timeout ${method}`))), 25000);
    });
  }
}

// Extrae el id del video de la URL del iframe, por plataforma.
const idDePlayer = (src) => {
  if (!src) return null;
  for (const [re, plat] of [
    [/player\.vimeo\.com\/video\/(\d+)/i, 'vimeo'],
    [/iframe\.mediadelivery\.net\/(?:embed|play)\/\d+\/([a-f0-9-]+)/i, 'bunny'],
    [/youtube\.com\/embed\/([\w-]{11})/i, 'youtube'],
    [/drive\.google\.com\/file\/d\/([\w-]+)/i, 'drive'],
    [/pandavideo[^?]*\?v=([\w-]+)/i, 'panda'],
    [/fast\.wistia\.net\/embed\/iframe\/(\w+)/i, 'wistia'],
  ]) {
    const m = re.exec(src);
    if (m) return { plataforma: plat, id: m[1] };
  }
  return { plataforma: 'desconocida', id: null };
};

// URL canonica para pasarle a yt-dlp.
const urlDescarga = ({ plataforma, id }, src) => {
  if (plataforma === 'vimeo') return `https://player.vimeo.com/video/${id}`;
  if (plataforma === 'youtube') return `https://www.youtube.com/watch?v=${id}`;
  if (plataforma === 'drive') return `https://drive.google.com/file/d/${id}/view`;
  return src; // bunny/wistia/panda: la URL del embed sirve tal cual
};

const main = async () => {
  let lista;
  try { lista = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json()); }
  catch { console.error(`\n  ✖ No hay CDP en ${PORT}. Corré curso-perfil.ps1 primero.\n`); process.exit(1); }

  const pag = lista.filter((t) => t.type === 'page' && !t.url.startsWith('devtools://'));
  // El sitio tiene DOS patrones de URL de curso: /curso/<slug> y /vip/course/<slug>.
  // Reconocer solo el primero dejaba media plataforma afuera.
  //
  // ⚠️ CON VARIOS CURSOS ABIERTOS, «el primero que matchee» ES EL CURSO EQUIVOCADO.
  // El Chrome dedicado acumula pestañas de los cursos ya bajados, y `find` se queda
  // con la que esté primera en la lista de CDP —que no es la que estás mirando—. El
  // plan sale completo, con el nombre y las clases de OTRO curso, y eso no se ve hasta
  // que alguien abre la carpeta. Por eso `--url <parte-de-la-url>`: cuando se pasa, se
  // exige esa pestaña y se corta si no está, en vez de adivinar.
  const FILTRO = arg('url', '');
  const obj = FILTRO
    ? pag.find((t) => t.url.toLowerCase().includes(FILTRO.toLowerCase()))
    : pag.find((t) => /\/(curso|course)\//i.test(t.url)) ?? pag.find((t) => t.url !== 'about:blank');
  if (!obj) {
    if (FILTRO) {
      console.error(`\n  ✖ No hay ninguna pestaña cuya URL contenga «${FILTRO}».`);
      console.error('    Abiertas ahora:');
      for (const t of pag) console.error(`      · ${t.url.slice(0, 110)}`);
      console.error('');
    } else {
      console.error('  ✖ No encuentro una pestaña con un curso abierto.\n');
    }
    process.exit(1);
  }
  if (!FILTRO && pag.filter((t) => /\/(curso|course)\//i.test(t.url)).length > 1) {
    console.log(`  ⚠ Hay varias pestañas de curso abiertas y elegí una sola. Si no es la que`);
    console.log(`    querías, pasá --url <parte-de-la-url>.`);
  }

  const ws = new WebSocket(obj.webSocketDebuggerUrl);
  await new Promise((ok, no) => {
    ws.addEventListener('open', ok, { once: true });
    ws.addEventListener('error', () => no(new Error('no pude conectar a CDP')), { once: true });
  });
  const cdp = new Cdp(ws);
  await cdp.enviar('Runtime.enable');

  const ev = async (expression, awaitPromise = false) => {
    const { result } = await cdp.enviar('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
    return result?.value;
  };

  // ⚠️ SE RECARGA ANTES DE ENUMERAR, SIEMPRE.
  // El recorrido clickea decenas de lecciones y acordeones, así que deja la página en
  // un estado cualquiera. Correr el script dos veces seguidas sobre la misma pestaña
  // enumeraba lo que había quedado a la vista: en «Trilogía de BRIAN TRACY» la segunda
  // corrida detectó 3 clases de 11 y NO se quejó (ver la nota del contador, abajo).
  await ev('location.reload()');
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const n = await ev('document.querySelectorAll("button").length');
    if (typeof n === 'number' && n > 8) break;
  }
  await new Promise((r) => setTimeout(r, 800));

  const titulo = await ev('document.title');
  const curso = limpio(String(titulo).split(/\s+[—|]\s+/)[0]);
  console.log(`\n  Curso : ${curso}`);
  console.log(`  URL   : ${obj.url}\n`);

  // 1. Abrir TODOS los acordeones, incluidos los anidados.
  //
  // Cómo se reconoce una cabecera de módulo, y por qué así: lleva un progreso
  // (`0/2`) y NO lleva duración (`25:38`). Anclar el progreso al FINAL de la línea
  // no sirve — hay cabeceras como «1. ONBOARDING 0/2 1», con un número detrás.
  //
  // Y no se puede confiar en aria-expanded: acá no existe. Así que se mide el
  // efecto de cada click y, si CERRÓ en vez de abrir, se vuelve a clickear. Se
  // repite en rondas porque un módulo abierto puede revelar submódulos cerrados.
  // ⚠️ La señal de «este click ABRIÓ» no puede ser «cuántas clases se ven», porque
  // reconocer una clase depende del formato del curso. «M5 -95» (Juan ADS) no
  // muestra duración en sus lecciones —dicen «02 1. Introducción» y nada más—, así
  // que el contador viejo daba 0 en todas las rondas y el script cortó con «no
  // encontré ninguna clase» habiendo abierto los 18 módulos correctamente.
  //
  // Se cuenta el TOTAL de botones: abrir un acordeón agrega nodos y cerrarlo los
  // saca, en cualquier curso y sin depender de cómo se rotule una lección.
  const contarBotones = `document.querySelectorAll('button').length`;
  const contarClases = `[...document.querySelectorAll('button')].filter(b => { const t=(b.innerText||'').replace(/\\s+/g,' ').trim(); return /\\b\\d{1,2}:\\d{2}\\b/.test(t) && !/\\d+\\s*\\/\\s*\\d+/.test(t); }).length`;
  const antes = await ev(contarClases);

  // El bucle vive en NODE, no en la página: meter N clicks con espera dentro de un
  // solo Runtime.evaluate se pasa del timeout en cuanto el curso tiene muchos
  // módulos (pasó con este, de 249 clases). Un click por llamada, cada una corta.
  const marcar = `(() => {
    const esCabecera = (b) => { const t=(b.innerText||'').replace(/\\s+/g,' ').trim();
      return /\\d+\\s*\\/\\s*\\d+/.test(t) && !/\\b\\d{1,2}:\\d{2}\\b/.test(t) && t.length < 120; };
    const hs = [...document.querySelectorAll('button')].filter(esCabecera);
    hs.forEach((b, i) => b.setAttribute('data-cxh', String(i)));
    return hs.length;
  })()`;

  // Se extrae a una función porque hay que volver a llamarla DURANTE el recorrido:
  // ver la nota del acordeón que se cierra solo, más abajo.
  // ⚠️ EL TOPE DE RONDAS NO PUEDE CORTAR EN SILENCIO. Con 8 rondas y 27 módulos,
  // «BigSEO Academy» terminaba de desplegar hasta el módulo 13 y el script seguía como
  // si nada: el plan salió con 77 de 136 lecciones —los módulos 14 a 26 enteros— y no
  // hubo ni una línea que dijera que se había quedado a mitad. Un corte limpio en un
  // número redondo de módulos es la firma de un tope, no de un curso que se terminó.
  //
  // Ahora el tope es alto y, si se llega a él CRECIENDO todavía, se avisa fuerte y
  // `topeAlcanzado` queda en true para que el resumen final lo pueda hacer fallar.
  let topeAlcanzado = false;
  const abrirAcordeones = async (rondas = RONDAS, verboso = true) => {
  for (let ronda = 1; ronda <= rondas; ronda++) {
    if (ronda === rondas) topeAlcanzado = true;
    const previo = await ev(contarBotones);
    const cabeceras = await ev(marcar);
    let abiertos = 0;
    for (let i = 0; i < (cabeceras ?? 0); i++) {
      const c0 = await ev(contarBotones);
      const hizo = await ev(`(() => { const b = document.querySelector('button[data-cxh="${i}"]'); if (!b) return false; b.click(); return true; })()`);
      if (!hizo) continue;
      await new Promise((r) => setTimeout(r, 130));
      const c1 = await ev(contarBotones);
      // Si cerró en vez de abrir, se revierte: no hay aria-expanded que consultar.
      if (c1 < c0) await ev(`(() => { const b = document.querySelector('button[data-cxh="${i}"]'); if (b) b.click(); return true; })()`);
      else if (c1 > c0) abiertos++;
    }
    await new Promise((r) => setTimeout(r, 400));
    const ahora = await ev(contarBotones);
    if (verboso) console.log(`  ronda ${ronda}: ${previo} → ${ahora} botones (${cabeceras} cabeceras, ${abiertos} abierta/s)`);
    // Converger es la ÚNICA salida limpia: si el conteo dejó de crecer, se vio todo.
    if (ahora === previo) { topeAlcanzado = false; break; }
  }
  if (topeAlcanzado && verboso) {
    console.log(`  ⚠ ME QUEDÉ SIN RONDAS Y EL LISTADO TODAVÍA CRECÍA: hay módulos sin desplegar.`);
    console.log(`    Volvé a correr con --rondas <n> más alto. El plan que salga está INCOMPLETO.`);
  }
  };

  // ⚠️ LA FOTO DE ANTES DE ABRIR NADA TAMBIÉN CUENTA.
  // Al cargar, la plataforma deja abierto el submódulo de la clase en curso, y la
  // rutina de acordeones lo CIERRA al abrir los otros. Esa lección no aparece en
  // ninguna foto posterior: en «Trilogía de BRIAN TRACY» se perdía «Negociando la
  // venta», la 1 de 11, y el total seguía dando 11 porque en su lugar se colaba una
  // cabecera. Dos errores que se tapan entre sí dan un número correcto y una lista mal.
  // Qué es una lección para esta heurística: un <button> con duración mm:ss, o
  // numerado por la plataforma, y SIN progreso «0/11» (eso es una cabecera). El
  // chrome de la página no cumple ninguna de las dos y queda afuera solo.
  // ⚠️ La duración NO puede ser el requisito: «M5 -95» (116 lecciones) se enumeró como
  // CERO porque sus lecciones dicen «02 1. Introducción» y ningún mm:ss.
  // ⚠️ Y LA LECCIÓN EN CURSO NO CUMPLE NINGUNA DE LAS DOS SEÑALES.
  // La plataforma la resalta y la rotula SIN número y SIN duración («Brian Tracy -
  // Negociando la venta», mientras sus hermanas dicen «02 Brian Tracy - …»), así que
  // el filtro de texto la tira — y es la lección 1 del curso. Tampoco sirve comparar
  // la clase CSS: la resaltada tiene otra (`bg-[#FFD43B]/10`).
  // Lo que sí la identifica es la ESTRUCTURA: cuelga del mismo padre que sus hermanas.
  // Medido acá: por padre directo entra ella sola; por abuelo se cuela «2.BONOS
  // EXCLUSIVOS», así que es padre directo y no más arriba.
  const visiblesAhora = `(() => {
    const dur = /\\b(\\d{1,2}:\\d{2})\\b/;
    const numerada = /^\\s*\\d{1,3}\\s*[.)]?\\s+\\S/;
    const btns = [...document.querySelectorAll('button')];
    const txtDe = (b) => (b.innerText || '').replace(/\\s+/g, ' ').trim();
    // Cabecera de módulo: lleva progreso (0/2) en CUALQUIER posición, no solo al
    // final — hay cabeceras como «1. ONBOARDING 0/2 1».
    const esCabecera = (b) => /\\d+\\s*\\/\\s*\\d+/.test(txtDe(b));
    const porTexto = btns.filter((b) => {
      const t = txtDe(b);
      if (!t || t.length > 200 || esCabecera(b)) return false;
      return dur.test(t) || numerada.test(t);
    });
    const padres = new Set(porTexto.map((b) => b.parentElement));
    const acepta = new Set(porTexto);
    for (const b of btns) {
      if (acepta.has(b) || esCabecera(b) || !txtDe(b) || txtDe(b).length > 200) continue;
      if (padres.has(b.parentElement)) acepta.add(b);
    }
    const out = [];
    let mod = null;
    for (const b of btns) {
      const txt = txtDe(b);
      if (esCabecera(b)) { if (txt.length < 120) mod = txt.replace(/\\s*\\d+\\s*\\/\\s*\\d+.*$/, '').trim(); continue; }
      if (!acepta.has(b)) continue;
      const m = dur.exec(txt);
      out.push({
        crudo: txt,
        modulo: mod,
        // Sin duración se emite vacío en vez de inventar «00:00»: un cero es un
        // dato, y acá el dato es que la plataforma no lo publica.
        duracion: m ? m[1] : '',
        titulo: txt.replace(dur, '').replace(/^\\s*\\d{1,3}\\s+/, '').replace(/^\\s*\\d{1,3}[.)]\\s*/, '').trim(),
      });
    }
    return out;
  })()`;

  const acumuladas = new Map();
  const juntar = async () => {
    for (const v of (await ev(visiblesAhora)) ?? []) if (!acumuladas.has(v.crudo)) acumuladas.set(v.crudo, v);
  };
  await juntar();
  await abrirAcordeones();

  // Cuántas clases DEBERÍA haber, según la propia página: cada cabecera publica su
  // progreso «0/11», y el denominador es el total de lecciones de ese módulo. Es la
  // única cifra de la pantalla que no depende de nuestra heurística, así que sirve
  // de patrón contra el cual medirse — y más abajo se compara de verdad.
  const esperadas = await ev(`(() => {
    let n = 0;
    for (const b of document.querySelectorAll('button')) {
      const t = (b.innerText || '').replace(/\\s+/g, ' ').trim();
      if (t.length >= 120 || /\\b\\d{1,2}:\\d{2}\\b/.test(t)) continue;
      const m = /(\\d+)\\s*\\/\\s*(\\d+)/.exec(t);
      if (m) n += Number(m[2]);
    }
    return n;
  })()`);
  const despues = await ev(contarClases);
  if (despues !== antes) console.log(`  (acordeones: ${antes} → ${despues} clases)\n`);

  // 2. Enumerar clases. Heurística robusta en vez de clases de Tailwind (que
  //    cambian con cualquier build): un <button> cuyo texto tiene duración mm:ss.
  //    Se les pone un data-attr para poder volver a agarrar el MISMO botón después
  //    de cada click, porque React reordena y re-renderiza los nodos.
  // ⚠️ La duración NO puede ser el requisito para reconocer una clase. Lo era, y
  // por eso «M5 -95» (116 lecciones) se enumeró como CERO: sus lecciones se
  // rotulan «02 1. Introducción Preparación», sin un mm:ss por ningún lado.
  //
  // Ahora se acepta por CUALQUIERA de las dos señales —duración, o el número de
  // orden con el que la plataforma numera cada lección— y se descarta lo que
  // lleva progreso «0/11», que es la marca de una cabecera de módulo. El chrome
  // de la página (el menú de usuario, los botones del player) no cumple ninguna
  // de las dos, así que queda afuera solo.
  // ⚠️ LA LISTA DE CLASES ES UNA TRAVESÍA, NO UNA FOTO.
  // En los cursos con acordeones MUTUAMENTE EXCLUYENTES —abrir «Parte 2» cierra
  // «Parte 1»— no existe ningún instante en que todas las lecciones estén en el DOM,
  // así que enumerar de una sola pasada es enumerar de menos por diseño. Medido en
  // «Trilogía de BRIAN TRACY»: al cargar se ven las 2 lecciones de Parte 1; después de
  // abrir las cabeceras, esas 2 ya no están y aparecen las de Partes 2-4.
  // Se recorre cabecera por cabecera y se ACUMULA por texto. La foto vieja daba un
  // número creíble (11, igual al total) que además era falso: incluía una cabecera
  // como si fuera clase y se perdía una lección real.
  await juntar();
  const cabeceras = await ev(marcar);
  for (let i = 0; i < (cabeceras ?? 0); i++) {
    const hizo = await ev(`(() => { const b = document.querySelector('button[data-cxh="${i}"]'); if (!b) return false; b.click(); return true; })()`);
    if (!hizo) continue;
    await new Promise((r) => setTimeout(r, 450));
    await juntar();
  }
  // Segunda vuelta: abrir una cabecera puede revelar submódulos que en la primera
  // vuelta todavía no existían.
  const cabeceras2 = await ev(marcar);
  for (let i = 0; i < (cabeceras2 ?? 0); i++) {
    await ev(`(() => { const b = document.querySelector('button[data-cxh="${i}"]'); if (b) b.click(); return true; })()`);
    await new Promise((r) => setTimeout(r, 400));
    await juntar();
  }
  const clases = [...acumuladas.values()].map((v, i) => ({ ...v, idx: i }));

  if (!clases?.length) {
    console.error('  ✖ No encontré ninguna clase. Abrí la página del curso (no el catálogo).\n');
    process.exit(1);
  }

  // Contra qué se mide: NO contra sí mismo. Los contadores «0/11» de las cabeceras
  // son la cuenta de la plataforma, ajena a nuestra heurística, y sumarlos da el
  // total real. Comparar contra eso es lo que convierte un enumerado corto —el
  // fallo silencioso de siempre: bajás 41 de 92 y nada avisa— en un error visible.
  // ⚠️ SUMAR LOS «0/N» NO ALCANZA: ESE CONTADOR SE DEGRADA JUNTO CON LA ENUMERACIÓN.
  // Solo ve las cabeceras que están EN EL DOM, así que con el acordeón colapsado baja
  // al mismo tiempo que `clases.length` y el chequeo da verde comparándose contra sí
  // mismo. Pasó acá: 3 detectadas, «la página dice 3», y el curso tiene 11.
  // El total de verdad lo publica la ficha del curso («11 lecciones») y no depende de
  // qué esté abierto. Cuando existe, ÉSE es el patrón, y se toma el mayor de los dos.
  const declaradas = await ev(`(() => {
    const m = /(\\d+)\\s+lecciones?/i.exec(document.body.innerText || '');
    return m ? Number(m[1]) : 0;
  })()`);
  const patron = Math.max(esperadas || 0, declaradas || 0);
  if (declaradas && esperadas && declaradas !== esperadas) {
    console.log(`  (la ficha dice ${declaradas} lecciones y los módulos a la vista suman ${esperadas})`);
  }
  if (patron > 0 && clases.length !== patron) {
    const falta = patron - clases.length;
    console.log(`  ⚠ La página dice ${patron} lecciones y detecté ${clases.length}` +
      (falta > 0 ? ` — faltan ${falta}.` : ` — hay ${-falta} de más.`));
    if (falta > 0 && clases.length < patron * 0.9) {
      console.error(`\n  ✖ Corto por más del 10%. NO escribo un plan incompleto:`);
      console.error(`    un curso a medias se baja entero y el faltante recién aparece al final.`);
      console.error(`    Probá con --espera más alto (a este le hicieron falta 20s) y si sigue,`);
      console.error(`    revisá cómo rotula las lecciones: puede ser un formato nuevo.\n`);
      process.exit(3);
    }
  }
  console.log(`  ${clases.length} clases detectadas${patron ? ` (la página dice ${patron})` : ''}.\n`);

  // 3. Módulos: cada clase ya viene con el suyo, leído del orden del documento en el
  //    momento en que era visible. No se puede recalcular al final sobre el DOM: con
  //    acordeones excluyentes, al final la mitad de las clases ya no está en pantalla.
  const modDe = new Map(clases.map((c) => [c.idx, c.modulo ?? null]));

  // 4. Recorrer: click -> esperar a que el iframe cambie -> anotar el id.
  const srcActual = () => ev(`(document.querySelector('iframe[src*="player"], iframe[src*="embed"], iframe[src*="vimeo"]') || document.querySelector('iframe') || {}).src || null`);
  const plan = [];
  // Las que resultaron ser cabeceras: no son fallas, así que no se cuentan como
  // «sin resolver» ni disparan la alarma del enumerado corto.
  const cabecerasFalsas = [];
  let previo = await srcActual();

  for (const c of clases) {
    const etiqueta = `${String(c.idx + 1).padStart(2, '0')} ${c.titulo}`;
    // ⚠️ La cuenta se toma DENTRO del click, no antes de buscar: la búsqueda de abajo
    // abre y cierra cabeceras, así que una medición previa compara contra otro árbol y
    // el guardia de «esto era una cabecera» se dispara sobre clases legítimas.
    globalThis.__botonesAntes = null;
    let clickeado = await ev(`(() => {
      const b = document.querySelector('button[data-cx="${c.idx}"]');
      if (!b) return null;
      const n = document.querySelectorAll('button').length;
      b.click();
      return n;
    })()`);
    let botonesAntes = typeof clickeado === 'number' ? clickeado : null;
    if (typeof clickeado === 'number') clickeado = true;

    // ⚠️ EL ACORDEÓN SE CIERRA SOLO, Y SE LLEVA LAS MARCAS PUESTAS.
    // En los cursos con submódulos anidados, abrir una lección de «Parte 1» CIERRA
    // «Parte 2..4»: sus botones salen del DOM y con ellos el `data-cx`. El síntoma es
    // «no pude re-encontrar el botón» en bloque, y no es del curso: la enumeración
    // estuvo bien, lo que caducó fue la marca. Medido en «Trilogía de BRIAN TRACY»:
    // 4 de 11 clases resueltas, y las 7 perdidas eran exactamente las anidadas.
    //
    // Por eso el fallback no es reintentar el mismo selector —el nodo ya no existe—
    // sino REABRIR los acordeones y volver a buscar el botón por su TEXTO, que es lo
    // único que sobrevive a que React recree el nodo.
    if (!clickeado) {
      // ⚠️ EL CLICK DE CABECERA ES UN TOGGLE, ASÍ QUE «ABRIR SU MÓDULO» A CIEGAS LO
      // CIERRA LA MITAD DE LAS VECES. Se veía como un zigzag perfecto —04 ✓, 05 ✖,
      // 06 ✓, 07 ✖—: cuando el submódulo ya estaba abierto, el click lo cerraba y se
      // llevaba justo la lección que se buscaba.
      // Por eso no se razona sobre el estado (que no se puede consultar: no hay
      // aria-expanded) sino que se PRUEBA: se toca una cabecera, se mira si la lección
      // apareció, y si no, se deja como estaba y se sigue con la próxima.
      const clickPorTexto = `(() => {
        const objetivo = ${JSON.stringify(c.crudo)};
        const b = [...document.querySelectorAll('button')]
          .find((x) => (x.innerText || '').replace(/\\s+/g, ' ').trim() === objetivo);
        if (!b) return null;
        b.setAttribute('data-cx', '${c.idx}');
        const n = document.querySelectorAll('button').length;
        b.click();
        return n;
      })()`;
      const r0 = await ev(clickPorTexto);
      if (typeof r0 === 'number') { botonesAntes = r0; clickeado = 'directo'; }
      if (!clickeado) {
        const cabs = await ev(marcar);
        for (let h = 0; h < (cabs ?? 0); h++) {
          await ev(`(() => { const b = document.querySelector('button[data-cxh="${h}"]'); if (b) b.click(); return true; })()`);
          await new Promise((r) => setTimeout(r, 380));
          const hallado = await ev(clickPorTexto);
          if (typeof hallado === 'number') { botonesAntes = hallado; clickeado = 'buscando'; break; }
          // No apareció: se deshace el toggle para no dejar el árbol peor que antes.
          await ev(`(() => { const b = document.querySelector('button[data-cxh="${h}"]'); if (b) b.click(); return true; })()`);
          await new Promise((r) => setTimeout(r, 200));
        }
      }
      if (clickeado) console.log(`     ↻ ${etiqueta} — estaba plegada; la encontré ${clickeado === 'directo' ? 'por texto' : 'abriendo cabeceras'}`);
    }
    if (!clickeado) { console.log(`  ✖ ${etiqueta} — no pude re-encontrar el botón (ni por texto)`); continue; }

    // ⚠️ SI EL CLICK CAMBIÓ LA CANTIDAD DE BOTONES, NO ERA UNA CLASE: ERA UNA CABECERA.
    // Hay cabeceras que no llevan progreso porque lo llevan sus submódulos («1. BRIAN
    // TRACY en las Ventas», con «Parte 1 0/2» adentro), así que la heurística de texto
    // las toma por lecciones numeradas. Clickearlas COLAPSA el módulo entero y se lleva
    // puestas todas las lecciones de abajo — el síntoma es un bloque de «no pude
    // re-encontrar el botón» que parece un problema de marcas y es un problema de
    // haber clickeado lo que no era.
    // ⚠️ Y LA SEÑAL NO PUEDE SER «CAMBIÓ LA CANTIDAD DE BOTONES»: eso también pasa al
    // elegir una clase, porque abrir su módulo pliega el anterior. Se probó, y marcó
    // como cabeceras a CUATRO clases legítimas —dos de ellas ya resueltas con su id de
    // Vimeo en la corrida anterior—. El discriminador real es el que ya estaba a mano:
    // **una clase carga un video y una cabecera no**. Así que primero se espera el
    // iframe, y recién si NO hubo video se mira si además se movió el árbol.

    // Esperar el cambio de src, sin dormir a ciegas.
    let src = previo, t0 = Date.now();
    while (Date.now() - t0 < ESPERA) {
      await new Promise((r) => setTimeout(r, 350));
      const s = await srcActual();
      if (s && s !== previo) { src = s; break; }
    }

    const info = idDePlayer(src);
    if (!src || src === previo || !info?.id) {
      const botonesTrasClick = await ev(contarBotones);
      // Sin video y con el árbol movido: era una cabecera. Se revierte para no dejar
      // la lista rota para las que siguen.
      if (botonesAntes !== null && botonesTrasClick !== botonesAntes) {
        await ev(`(() => { const b = document.querySelector('button[data-cx="${c.idx}"]'); if (b) b.click(); return true; })()`);
        await new Promise((r) => setTimeout(r, 400));
        console.log(`  ·  ${etiqueta} — es una CABECERA, no una clase (lo revierto)`);
        cabecerasFalsas.push(c.idx);
        continue;
      }
      // Puede ser la clase que YA estaba cargada: no es un fallo si tiene id.
      const inf2 = idDePlayer(previo);
      if (inf2?.id && plan.every((p) => p.videoId !== inf2.id)) {
        plan.push({ n: c.idx + 1, titulo: c.titulo, duracion: c.duracion, modulo: modDe.get(c.idx) ?? null, plataforma: inf2.plataforma, videoId: inf2.id, url: urlDescarga(inf2, previo), archivo: `${String(c.idx + 1).padStart(2, '0')} - ${limpio(c.titulo)}` });
        console.log(`  ✓ ${etiqueta}  (${inf2.plataforma} ${inf2.id})  [ya cargada]`);
      } else {
        console.log(`  ⚠ ${etiqueta} — el iframe no cambió en ${ESPERA / 1000}s`);
      }
      continue;
    }

    plan.push({
      n: c.idx + 1,
      titulo: c.titulo,
      duracion: c.duracion,
      modulo: modDe.get(c.idx) ?? null,
      plataforma: info.plataforma,
      videoId: info.id,
      url: urlDescarga(info, src),
      archivo: `${String(c.idx + 1).padStart(2, '0')} - ${limpio(c.titulo)}`,
    });
    console.log(`  ✓ ${etiqueta}  (${info.plataforma} ${info.id})`);
    previo = src;
  }

  // Renumerar: `n` sale del índice de la ENUMERACIÓN, que incluye las cabeceras que
  // resultaron no ser clases, así que quedaban huecos —este curso arrancaba en «02»
  // y terminaba en «12» para 11 clases—. El número es el nombre del archivo y el
  // orden con que se lee el curso, así que va contiguo desde 1.
  plan.forEach((p, i) => {
    p.n = i + 1;
    p.archivo = `${String(i + 1).padStart(2, '0')} - ${limpio(p.titulo)}`;
  });

  // 5. PDFs de resumen que cuelgan de las clases.
  const pdfs = await ev(`[...new Set([...document.querySelectorAll('a[href*="Reader?type=resource"]')].map(a => a.href))]`);

  const ua = await ev('navigator.userAgent');
  const dir = join(RAIZ, slug(curso));
  mkdirSync(dir, { recursive: true });
  const destino = join(dir, 'plan.json');

  // Si ya existe un plan, no se pisa a ciegas: se guarda al lado.
  const salida = existsSync(destino) ? join(dir, 'plan.nuevo.json') : destino;
  writeFileSync(salida, JSON.stringify({
    curso, autor: AUTOR.trim(), slug: slug(curso), pagina: obj.url, userAgent: ua,
    referer: new URL(obj.url).origin + '/',
    clases: plan, pdfs: pdfs ?? [],
  }, null, 2), 'utf8');

  const reales = clases.length - cabecerasFalsas.length;
  const faltan = reales - plan.length;
  console.log('\n' + '─'.repeat(70));
  console.log(`  ${plan.length}/${reales} clases con video${faltan ? ` · ⚠ ${faltan} sin resolver` : ''}` +
    (cabecerasFalsas.length ? ` · ${cabecerasFalsas.length} eran cabeceras` : ''));

  // ⚠️ EL CHEQUEO QUE FALTABA: contra el TOTAL DE LA FICHA, y AL FINAL.
  // El de arriba compara la enumeración cruda, y ahí una cabecera colada tapa una
  // lección perdida: 10 clases + 1 cabecera dan 11, que es justo el total, y el
  // resumen imprime «10/10 clases con video» — un pleno perfecto al que le falta una.
  // Recién cuando se sabe cuáles eran cabeceras se puede comparar de verdad.
  //
  // ⚠️ Y ESTE CHEQUEO TIENE QUE HACER FALLAR AL SCRIPT, NO IMPRIMIR UN ⚠️. Existía desde
  // antes, detectaba el problema con el número exacto… y el `process.exit` de abajo solo
  // miraba `faltan`, así que salía 0. «BigSEO Academy» se bajó, se transcribió y se
  // publicó con 77 de 136 lecciones —43% del curso— con este aviso impreso en una
  // consola que nadie volvió a mirar. Es, textual, el «console.warn no es un control»
  // de AGENTS.md.
  const incompleto = patron > 0 && plan.length < patron;
  if (incompleto) {
    console.log(`  ✖ LA FICHA DICE ${patron} LECCIONES Y EL PLAN TIENE ${plan.length}: FALTAN ${patron - plan.length}.`);
    console.log(`    «${plan.length}/${reales}» de arriba es contra lo que detecté, no contra el curso.`);
    console.log(`    Casi siempre es que quedaron módulos sin desplegar: subí --rondas y repetí.`);
  }
  if (topeAlcanzado) {
    console.log(`  ✖ LA APERTURA DE ACORDEONES SE QUEDÓ SIN RONDAS mientras seguía encontrando.`);
  }
  console.log(`  ${(pdfs ?? []).length} PDF(s) de resumen`);
  console.log(`  Plataforma: ${[...new Set(plan.map((p) => p.plataforma))].join(', ') || '—'}`);
  console.log(`  → ${salida}`);
  if (AUTOR.trim()) console.log(`  Autor     : ${AUTOR.trim()}  →  «${limpio(curso)} - ${AUTOR.trim()}»`);
  console.log('─'.repeat(70));
  if (!AUTOR.trim()) {
    console.log(`\n  ⚠ SIN AUTOR. La carpeta en Drive es «<Curso> - <Autor>» (la cumplen 36 de`);
    console.log(`    39) y el título del portal también lo lleva. Volvé a correr con`);
    console.log(`    --autor "Nombre Apellido" o quedan los dos a medias.`);
  }
  if (salida !== destino) console.log(`\n  ⚠ Ya había un plan.json: lo dejé como plan.nuevo.json para que compares.`);
  console.log(`\n  Siguiente:  node <abs>\\scripts\\curso-bajar.mjs --plan "${destino}"\n`);
  ws.close();
  // Salir 0 con un plan al que le falta la mitad del curso es lo que dejó pasar los
  // 59 de BigSEO. Cada motivo tiene su codigo para que el que llame sepa cual fue.
  process.exit(incompleto || topeAlcanzado ? 4 : faltan ? 3 : 0);
};

main().catch((e) => { console.error(`\n  ✖ ${e.message}\n`); process.exit(1); });
