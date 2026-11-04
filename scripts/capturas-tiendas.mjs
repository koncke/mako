// =============================================================================
// capturas-tiendas — las capturas de Google Play y App Store, del /m REAL con la cuenta de revisión (4/11/2026)
// =============================================================================
// Firma una cookie de sesión de la cuenta de revisión con AUTH_SECRET (la misma cuenta y el mismo formato que `crearToken` en
// lib/auth-session.ts + el login de app/api/auth/contrasena/route.ts: mfa 'revision', rol 'usuario', 7 días) y abre hola-mako.com/m…
// con Playwright. SIN contraseña: el secreto sale de un archivo de entorno y NO se imprime, NO se guarda y NO se pasa por argumento.
//
// Uso:
//   node scripts/capturas-tiendas.mjs --out <carpeta> [--env <.env.local>] [--base https://hola-mako.com] [--usuario 29]
//   node scripts/capturas-tiendas.mjs --out <carpeta> --estado <estado.json>    (sin firmar: usa una sesión ya abierta; ver abajo)
//
// Variables: PLAYWRIGHT_DIR (carpeta con node_modules/playwright; por defecto C:/dev/playwright-medidor).
//
// ⚠️ Esto SALTEA el login: no pasa por app/api/auth/contrasena, o sea que no deja la entrada en `mfa_eventos` ni manda el aviso a equipo@.
//    Sólo hace GET (leer): el proxy corta toda escritura de esta cuenta igual (lib/cuenta-revision-reglas.ts).
// ⚠️ 4/11/2026: contra producción la cookie firmada con el AUTH_SECRET del .env.local de `mako-api` NO alcanzó (todas las pantallas mandaron a
//    /login). No se pudo saber si es que el secreto de ese archivo no es el de producción o que la fila de la cuenta no cumple lo que mira
//    lib/auth.ts (`esCuentaDeRevision` + `cambiada_at`). Camino sin forzar nada: que la persona que tiene la contraseña entre UNA vez a mano y
//    guarde la sesión (`npx playwright codegen --save-storage=estado.json https://hola-mako.com/login`), y pasarla con --estado. (--estado: SIN PROBAR.)
// ⚠️ Si alguna pantalla manda a /login, la firma no alcanzó (rotaron la contraseña, cambió el usuario o el AUTH_SECRET del archivo no es
//    el de producción): el script frena y dice cuál. No la fuerza.
// =============================================================================

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const OUT = arg('out', '');
if (!OUT) { console.error('Falta --out <carpeta>'); process.exit(2); }
const ENV = arg('env', '.env.local');
const BASE = arg('base', 'https://hola-mako.com').replace(/\/$/, '');
const USUARIO = arg('usuario', '29');
const ESTADO = arg('estado', '');   // storageState de Playwright con una sesión ya abierta a mano
const CORREO = 'revision-tiendas@hola-mako.com';   // CUENTA_DE_REVISION.email
const DIAS = 7;                                      // DIAS_SESION_REVISION
const PW = process.env.PLAYWRIGHT_DIR || 'C:/dev/playwright-medidor/node_modules';

// --- el secreto: se lee, se usa para firmar y no sale de esta función ----------------------------------------------------
function cookieDeSesion() {
  const linea = readFileSync(ENV, 'utf8').split(/\r?\n/).find((l) => /^AUTH_SECRET=/.test(l));
  const sec = (linea ?? '').replace(/^AUTH_SECRET=/, '').trim().replace(/^["']|["']$/g, '');
  if (!sec) throw new Error(`No hay AUTH_SECRET en ${ENV}`);
  const ahora = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ sub: USUARIO, email: CORREO, nombre: 'Revisión de tiendas', rol: 'usuario', mfa: 'revision', iat: ahora, exp: ahora + DIAS * 86400 }), 'utf8').toString('base64url');
  const firma = createHmac('sha256', sec).update(payload).digest('base64url');
  return `v1.${payload}.${firma}`;
}

const { chromium } = createRequire(join(PW, 'x.js'))('playwright');

// Los dos tamaños: Play pide 9:16 de 1080 de ancho como mínimo; Apple, iPhone con Dynamic Island (1206×2622).
const PERFILES = {
  play: { viewport: { width: 360, height: 640 }, deviceScaleFactor: 3 },   // 1080×1920
  apple: { viewport: { width: 402, height: 874 }, deviceScaleFactor: 3 },  // 1206×2622
};
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const UA_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

// Cada captura: nombre, ruta (o función que la busca) y qué esperar. La ficha busca el primer lead del tablero.
const PANTALLAS = [
  { n: '1-ops-center', ruta: '/m' },
  { n: '2-crm', ruta: '/m/crm' },
  { n: '3-chats', ruta: '/m/chats' },
  { n: '4-ficha', ruta: async (page) => {
      await page.goto(`${BASE}/m/crm`, { waitUntil: 'networkidle' });
      const href = await page.evaluate(() => [...document.querySelectorAll('a[href^="/m/crm/"]')].map((a) => a.getAttribute('href')).find((h) => /^\/m\/crm\/\d+/.test(h)) ?? null);
      return href;
    } },
  { n: '5-dashboard', ruta: '/m/hoy' },
];

const salida = {};
const browser = await chromium.launch();
try {
  for (const [perfil, cfg] of Object.entries(PERFILES)) {
    const ctx = await browser.newContext({ ...cfg, isMobile: true, hasTouch: true, locale: 'es-AR', userAgent: perfil === 'apple' ? UA_IOS : UA, ...(ESTADO ? { storageState: ESTADO } : {}) });
    const dominio = new URL(BASE).hostname;
    if (!ESTADO) await ctx.addCookies([
      { name: 'mako_session', value: cookieDeSesion(), domain: dominio, path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
      { name: 'mako_email', value: CORREO, domain: dominio, path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
    ]);
    const page = await ctx.newPage();
    const dir = join(OUT, perfil); mkdirSync(dir, { recursive: true });
    salida[perfil] = [];
    for (const p of PANTALLAS) {
      let ruta = p.ruta;
      if (typeof ruta === 'function') { ruta = await ruta(page); if (!ruta) { salida[perfil].push({ n: p.n, error: 'no hay lead al que entrar' }); continue; } }
      await page.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {});
      await page.waitForTimeout(2500);   // las animaciones de entrada y las tarjetas que cargan después
      const url = new URL(page.url());
      if (/^\/(login|entrar|acceso)/.test(url.pathname)) { salida[perfil].push({ n: p.n, error: `mandó a ${url.pathname}: la firma no alcanzó` }); continue; }
      const archivo = join(dir, `${p.n}.png`);
      await page.screenshot({ path: archivo, type: 'png', fullPage: false });
      const hayAviso = await page.evaluate(() => /Estás viendo/i.test(document.body.innerText));
      salida[perfil].push({ n: p.n, final: url.pathname, archivo, avisoEstasViendo: hayAviso });
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
writeFileSync(join(OUT, 'resultado.json'), JSON.stringify(salida, null, 2));
console.log(JSON.stringify(salida, null, 2));
