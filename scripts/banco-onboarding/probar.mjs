// LOS TESTS QUE TOCAN (21/11/2026; el Cerebro: «con los componentes reales dibujados en local… Playwright headless sobre esa página,
// tocando de verdad cada control»). Sin sesión, sin producción, sin el navegador de la app y con el audio del navegador apagado.
// Uso: node scripts/banco-onboarding/build.mjs && node scripts/banco-onboarding/probar.mjs [--solo videos,whatsapp,barra,brain,marca]
// Sale con 1 si algo falla. Las capturas quedan en scripts/banco-onboarding/salida/capturas.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const AQUI = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const req = createRequire(import.meta.url);
const { chromium } = req(process.env.PLAYWRIGHT_DIR ? `${process.env.PLAYWRIGHT_DIR}/playwright-core` : 'C:/dev/playwright-medidor/node_modules/playwright-core');
const PUERTO = 4591;
const BASE = `http://127.0.0.1:${PUERTO}`;
const CAPT = path.join(AQUI, 'salida', 'capturas');
fs.mkdirSync(CAPT, { recursive: true });
const soloArg = process.argv.indexOf('--solo');
const SOLO = soloArg > 0 ? process.argv[soloArg + 1].split(',') : null;

const resultados = [];
const chequear = (escenario, que, ok, detalle = '') => { resultados.push({ escenario, que, ok: !!ok, detalle }); console.log(`${ok ? 'PASA ' : 'FALLA'} [${escenario}] ${que}${!ok && detalle ? ` — ${detalle}` : ''}`); };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const servidor = spawn(process.execPath, [path.join(AQUI, 'servir.cjs')], { env: { ...process.env, PUERTO_BANCO: String(PUERTO) }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok) => servidor.stdout.once('data', ok));
const navegador = await chromium.launch({ headless: true, args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'] });

async function pagina(escenario, ancho = 1440, alto = 900) {
  const ctx = await navegador.newContext({ viewport: { width: ancho, height: alto } });
  const pg = await ctx.newPage();
  const errores = [];
  pg.on('pageerror', (e) => errores.push(String(e.message || e)));
  pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|404/.test(m.text())) errores.push(m.text()); });
  const navegaciones = [];
  // Lo que navega fuera del banco (el RESET, «Ir a un paso»): se anota y se contesta con una página vacía del mismo origen.
  await pg.route(/127\.0\.0\.1:\d+\/(onboarding|second-brain)/, (r) => { navegaciones.push(new URL(r.request().url()).pathname + new URL(r.request().url()).search); r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>fuera</title>' }); });
  await pg.goto(`${BASE}/?p=${escenario}`);
  return { pg, ctx, errores, navegaciones };
}
const llamadas = (pg) => pg.evaluate(() => window.__llamadas ?? []);

const ESCENARIOS = {
  // ── Un video a la vez, y en la esquina sólo el último ──
  async videos() {
    const { pg, ctx, errores } = await pagina('videos');
    const arriba = 'div[data-banco="arriba"]', abajo = 'div[data-banco="abajo"]';
    await pg.waitForSelector(`${arriba} .mk-vmom__play`, { timeout: 15000 });
    await pg.click(`${arriba} .mk-vmom__play`);
    await pg.waitForFunction((s) => { const v = document.querySelector(`${s} video`); return v && !v.paused; }, arriba, { timeout: 8000 }).catch(() => {});
    chequear('videos', 'play al de arriba: corre', await pg.evaluate((s) => !document.querySelector(`${s} video`)?.paused, arriba));
    await pg.evaluate(() => window.scrollTo(0, 1500));
    const flota = await pg.waitForSelector('.mk-pip', { timeout: 5000 }).then(() => true).catch(() => false);
    chequear('videos', 'el de arriba, fuera de la vista: pasa a la esquina', flota);
    if (flota) chequear('videos', 'en el flotante no va «Omitir recorrido»', !(await pg.textContent('.mk-pip'))?.includes('Omitir recorrido'));
    await pg.screenshot({ path: path.join(CAPT, 'videos-1-arriba-flota.png') });
    await pg.click(`${abajo} .mk-vmom__play`);
    await esperar(1200);
    const e = await pg.evaluate(([a, b]) => ({ pip: document.querySelectorAll('.mk-pip').length, arribaQuieto: document.querySelector(`${a} video`)?.paused ?? true, abajoCorre: !(document.querySelector(`${b} video`)?.paused ?? true), todos: [...document.querySelectorAll('video')].filter((v) => !v.paused && !v.muted).length }), [arriba, abajo]);
    chequear('videos', 'play al de abajo: el de arriba deja la esquina', e.pip === 0, `flotantes: ${e.pip}`);
    chequear('videos', 'el de arriba queda pausado', e.arribaQuieto);
    chequear('videos', 'el de abajo, a la vista, corre sin flotar', e.abajoCorre && e.pip === 0);
    chequear('videos', 'un solo video con sonido corriendo', e.todos === 1, `corriendo: ${e.todos}`);
    await pg.screenshot({ path: path.join(CAPT, 'videos-2-abajo.png') });
    chequear('videos', 'sin errores en la página', errores.length === 0, errores.slice(0, 3).join(' | '));
    await ctx.close();
  },

  // ── El WhatsApp de la revisión, como el de un número nuevo ──
  async whatsapp() {
    const { pg, ctx, errores } = await pagina('whatsapp');
    const hay = await pg.waitForSelector('[data-abrir-whatsapp]', { timeout: 25000 }).then(() => true).catch(() => false);
    chequear('whatsapp', 'el mensaje del código, con «Abrir WhatsApp»', hay);
    if (hay) {
      chequear('whatsapp', '«Abrir WhatsApp» es un botón (no un link a wa.me)', await pg.evaluate(() => document.querySelector('[data-abrir-whatsapp]')?.tagName === 'BUTTON'));
      await pg.click('[data-abrir-whatsapp]');
      const modal = await pg.waitForSelector('.wsim', { timeout: 4000 }).then(() => true).catch(() => false);
      chequear('whatsapp', 'abre el modal que simula WhatsApp', modal);
      if (modal) {
        const msjs = await pg.$$eval('.wsim__msj', (xs) => xs.map((x) => (x.textContent ?? '').trim()));
        chequear('whatsapp', '1º el pedido que manda la persona', msjs[0] === 'Hola, quiero confirmar mi WhatsApp.', msjs[0]);
        chequear('whatsapp', '2º MaKo con el código', /Tu código para confirmar tu WhatsApp es 482 ?913/.test(msjs[1] ?? ''), msjs[1]);
        chequear('whatsapp', '3º la tarjeta de MaKo', /Guardar contacto/.test(msjs[2] ?? ''), msjs[2]);
        chequear('whatsapp', '4º «Guárdame en tus contactos…»', /^Guárdame en tus contactos/.test(msjs[3] ?? ''), msjs[3]);
        await pg.screenshot({ path: path.join(CAPT, 'whatsapp-modal.png') });
        await pg.click('text=Pegar el código');
        await esperar(300);
        chequear('whatsapp', '«Pegar el código» cierra el modal', (await pg.$('.wsim')) === null);
        chequear('whatsapp', 'el código queda en la caja', (await pg.inputValue('#arr-v2-codigo').catch(() => '')) === '482913');
        await esperar(1600);
        const ll = (await llamadas(pg)).filter((l) => l.url.startsWith('/api/onboarding/arranque') && l.metodo === 'POST');
        chequear('whatsapp', 'se confirma solo, con ese código', ll.some((l) => JSON.stringify(l.cuerpo).includes('482913')), JSON.stringify(ll.map((l) => l.cuerpo)).slice(0, 200));
      }
    }
    chequear('whatsapp', 'sin errores en la página', errores.length === 0, errores.slice(0, 3).join(' | '));
    await ctx.close();
  },

  // ── La barra del administrador: un solo RESET, «Autocompletar», «Ir a un paso» ──
  async barra() {
    {
      const { pg, ctx, errores } = await pagina('barra');
      await pg.waitForSelector('text=Estás viendo el dashboard de', { timeout: 15000 });
      const botones = await pg.$$eval('button', (xs) => xs.map((x) => (x.textContent ?? '').trim()));
      chequear('barra', 'un solo «Reset» en la barra', botones.filter((t) => /^reset$/i.test(t)).length === 1, botones.join(', '));
      chequear('barra', 'sin «Datos de Mauricio» ni «Reiniciar onboarding»', !botones.some((t) => /Datos de Mauricio|Reiniciar onboarding/.test(t)));
      chequear('barra', 'el chat sin la fila de ejemplos (igual que el de un cliente)', (await pg.$('.arr-v2__ejemplos')) === null);
      const auto = await pg.waitForSelector('button:has-text("Autocompletar")', { timeout: 20000 }).then(() => true).catch(() => false);
      chequear('barra', '«Autocompletar» aparece con la pregunta del nombre', auto);
      if (auto) {
        await pg.click('button:has-text("Autocompletar")');
        await esperar(800);
        const ll = (await llamadas(pg)).filter((l) => l.url.startsWith('/api/onboarding/arranque') && l.metodo === 'POST');
        chequear('barra', '«Autocompletar» contesta el nombre de ejemplo', ll.some((l) => l.cuerpo?.texto === 'Valentina'), JSON.stringify(ll.map((l) => l.cuerpo)).slice(0, 200));
      }
      const sel = 'select[aria-label="Ir a un paso del onboarding o del reto"]';
      const n = await pg.waitForSelector(sel, { timeout: 8000 }).then(() => pg.$$eval(`${sel} option`, (xs) => xs.length)).catch(() => 0);
      chequear('barra', '«Ir a un paso» con todos los pasos (más de 60)', n > 60, `opciones: ${n}`);
      const grupos = await pg.$$eval(`${sel} optgroup`, (xs) => xs.map((x) => x.getAttribute('label'))).catch(() => []);
      chequear('barra', 'agrupados: Onboarding, Ops Center, el reto y cada día', ['Onboarding', 'Ops Center', 'Día 1', 'Día 7'].every((g) => grupos.includes(g)), grupos.join(', '));
      await pg.screenshot({ path: path.join(CAPT, 'barra.png') });
      chequear('barra', 'sin errores en la página', errores.length === 0, errores.slice(0, 3).join(' | '));
      await ctx.close();
    }
    {
      // «Ir a un paso»: el pedido, y lo que deja para la pantalla a la que va.
      const { pg, ctx, navegaciones } = await pagina('barra');
      const sel = 'select[aria-label="Ir a un paso del onboarding o del reto"]';
      await pg.waitForSelector(sel, { timeout: 15000 });
      await pg.selectOption(sel, 'recorrido-3');
      await esperar(1500);
      chequear('barra', '«Ir a un paso» pide ESE paso', (await llamadas(pg).catch(() => [])).some((l) => l.url.startsWith('/api/admin/saltar-onboarding') && l.cuerpo?.paso === 'recorrido-3') || navegaciones.length > 0);
      chequear('barra', '«Ir a un paso» va al destino', navegaciones.some((u) => u.startsWith('/second-brain')), navegaciones.join(', '));
      await ctx.close();
    }
    {
      // RESET: confirmación que dice que no borra nada, el pedido y la ida al onboarding.
      const { pg, ctx, navegaciones } = await pagina('barra');
      await pg.waitForSelector('button:text-is("Reset")', { timeout: 15000 });
      await pg.click('button:text-is("Reset")');
      const panel = await pg.waitForSelector('#reiniciar-onboarding-panel', { timeout: 4000 }).then(() => true).catch(() => false);
      chequear('barra', 'RESET pide confirmación', panel);
      if (panel) {
        chequear('barra', 'la confirmación dice que no borra nada de lo suyo', (await pg.textContent('#reiniciar-onboarding-panel'))?.includes('No borra nada de lo suyo'));
        await pg.click('#reiniciar-onboarding-panel button:has-text("Sí, reset")');
        await esperar(500);
        chequear('barra', 'RESET hace lo de «Reiniciar onboarding»', (await llamadas(pg).catch(() => [])).some((l) => l.url === '/api/admin/reiniciar-onboarding' && l.metodo === 'POST'));
        await esperar(1500);
        chequear('barra', 'y lleva al onboarding', navegaciones.some((u) => u.startsWith('/onboarding')), navegaciones.join(', '));
      }
      await ctx.close();
    }
  },

  // ── El Second Brain del recorrido ──
  async brain() {
    const { pg, ctx, errores } = await pagina('brain');
    await pg.waitForSelector('[data-banco="grafo-real"]');
    chequear('brain', 'sin el recorrido, el grafo real (sin la capa)', (await pg.$('.sbr')) === null);
    await pg.evaluate(() => window.__banco.recorrido());
    const capa = await pg.waitForSelector('.cbg-marco .sbr', { timeout: 8000 }).then(() => true).catch(() => false);
    chequear('brain', 'con el recorrido, la capa adentro del marco del grafo', capa);
    if (capa) {
      chequear('brain', 'el cerebro de la portada entero', (await pg.$$eval('.sbr-n', (xs) => xs.length)) > 150);
      const flecha = await pg.evaluate(() => { const b = document.querySelector('.cbg-atras').getBoundingClientRect(); return document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)?.closest('.cbg-atras') != null; });
      chequear('brain', 'la flecha de volver queda encima y se puede tocar', flecha);
      await pg.screenshot({ path: path.join(CAPT, 'brain-1-entero.png') });
      const fase = await pg.waitForFunction(() => document.querySelector('.sbr')?.getAttribute('data-fase') === 'tuyo', null, { timeout: 4000 }).then(() => true).catch(() => false);
      chequear('brain', 'a los 1,2 s empieza a apagarse', fase);
      await esperar(3800);
      const textos = await pg.textContent('.sbr');
      chequear('brain', 'queda lo que MaKo sabe', ['Valentina', 'Confirmado', 'Instagram', 'Armar mi landing', 'Nutri Vale'].every((t) => textos?.includes(t)));
      const visible = await pg.evaluate(() => getComputedStyle(document.querySelector('.sbr-tuyo')).opacity === '1');
      chequear('brain', 'y se ve', visible);
      await pg.screenshot({ path: path.join(CAPT, 'brain-2-tuyo.png') });
      await pg.evaluate(() => window.__banco.cerrar());
      await esperar(900);
      chequear('brain', 'terminado el recorrido, la capa se va', (await pg.$('.sbr')) === null);
    }
    chequear('brain', 'sin errores en la página', errores.length === 0, errores.slice(0, 3).join(' | '));
    await ctx.close();
  },

  // ── Un paso que pide clic no tiene «Siguiente» ──
  async marca() {
    const { pg, ctx, errores } = await pagina('marca');
    await pg.waitForSelector('#objetivo');
    await pg.evaluate(() => window.__banco.tutorial());
    const uno = await pg.waitForSelector('text=Este paso pide un clic.', { timeout: 8000 }).then(() => true).catch(() => false);
    chequear('marca', 'el paso que pide clic, marcado', uno);
    if (uno) {
      const b = await pg.$$eval('button', (xs) => xs.map((x) => (x.textContent ?? '').trim()));
      chequear('marca', 'sin «Siguiente»', !b.includes('Siguiente') && !b.includes('Listo'), b.join(', '));
      chequear('marca', 'con «Omitir recorrido»', b.includes('Omitir recorrido'));
      await pg.screenshot({ path: path.join(CAPT, 'marca-1-clic.png') });
      await pg.click('#objetivo');
      const dos = await pg.waitForSelector('text=Este paso sólo explica.', { timeout: 8000 }).then(() => true).catch(() => false);
      chequear('marca', 'tocar lo marcado (a través del hueco) lleva al paso siguiente', dos);
      if (dos) {
        const b2 = await pg.$$eval('button', (xs) => xs.map((x) => (x.textContent ?? '').trim()));
        chequear('marca', 'el paso que explica sí tiene su botón para avanzar', b2.includes('Siguiente') || b2.includes('Listo'), b2.join(', '));
      }
    }
    chequear('marca', 'sin errores en la página', errores.length === 0, errores.slice(0, 3).join(' | '));
    await ctx.close();
  },
};

for (const [nombre, f] of Object.entries(ESCENARIOS)) {
  if (SOLO && !SOLO.includes(nombre)) continue;
  try { await f(); } catch (e) { chequear(nombre, 'el escenario corre entero', false, String(e?.message ?? e).slice(0, 300)); }
}
await navegador.close();
servidor.kill();
const fallas = resultados.filter((r) => !r.ok);
fs.writeFileSync(path.join(AQUI, 'salida', 'resultado.json'), JSON.stringify(resultados, null, 1));
console.log(`\n${resultados.length - fallas.length} de ${resultados.length} pasan${fallas.length ? `; FALLAN ${fallas.length}` : ''}.`);
process.exit(fallas.length ? 1 : 0);
