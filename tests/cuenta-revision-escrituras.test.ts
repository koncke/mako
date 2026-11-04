// =============================================================================
// La cuenta de revisión de las tiendas: qué ESCRIBE, ruta por ruta, con el proxy de verdad (4/11/2026)
// =============================================================================
// Esa contraseña se la damos a terceros (los revisores de Google Play y App Store). La revisión del 4/11 encontró que la lista de lo
// PROHIBIDO no veía las server actions ni lo que se sumaba después (`/api/competitor-spy/*`, `/api/ia-permiso`,
// `app/newsletters/actions.ts`). Ahora es una lista de lo PERMITIDO (lib/cuenta-revision-reglas.ts) y esto la mide:
//
//   1. ENUMERA todo lo que escribe: cada `app/api/**/route.ts` con POST/PUT/PATCH/DELETE y cada archivo `'use server'`;
//   2. le pega al `proxy()` REAL con la cookie firmada de la cuenta (y con la de un closer común, de control);
//   3. compara el veredicto con tests/cuenta-revision-escrituras.snapshot.txt. Una ruta o una acción NUEVA no está ahí: el test falla
//      hasta que alguien decide si un tercero con esa contraseña la puede usar y regenera la lista:
//        MAKO_REGENERAR_SNAPSHOT=1 node --import tsx --test tests/cuenta-revision-escrituras.test.ts
//
// ⚠️ Esto llama a `proxy()` DIRECTO y no ve el matcher de proxy.ts: que cada pedido LLEGUE al proxy lo mira
// tests/proxy-matcher-completo.test.ts (4/11/2026: `POST /crm/x.png` con `Next-Action` no llegaba, y acá daba todo verde).
//
// Correr: node --import tsx --test tests/cuenta-revision-escrituras.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (4/11/2026, base 6 / 0; una rotura por vez, restaurada de memoria):
//   · el proxy sin el corte de la cuenta                              → 2 / 4
//   · el corte vuelve a la lista de lo prohibido (las 6 rutas de antes) → 3 / 3 (las server actions, Spy y los envíos pasan)
//   · `/api/whatsapp/evolution/mensajes` sumada a lo permitido         → 4 / 2 (el snapshot y el test por nombre)
//   · una entrada de lo permitido que no existe como ruta              → 5 / 1
//   · el corte sin mirar `next-action`                                → 5 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NextRequest } from 'next/server';
import { proxy } from '../proxy';
import { crearToken, SESSION_COOKIE } from '../lib/auth-session';
import { CUENTA_DE_REVISION, PERMITIDO_EN_REVISION } from '../lib/cuenta-revision-reglas';
import { esPublica } from '../lib/rutas-publicas';

// El gate ACTIVO, como en producción: sin el secreto el proxy deja pasar todo en local y esto no mediría nada.
process.env.AUTH_SECRET = 'secreto-de-prueba-de-la-revision-0123456789abcdef';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOT = join(RAIZ, 'tests', 'cuenta-revision-escrituras.snapshot.txt');
const leer = (f: string) => readFileSync(join(RAIZ, f), 'utf8').replace(/\r\n/g, '\n');
const archivos = (): string[] => execFileSync('git', ['ls-files', 'app'], { cwd: RAIZ, encoding: 'utf8' }).split('\n').filter(Boolean);

/** La ruta HTTP de un archivo de app/: sin los grupos `(x)`, y los parámetros con un valor cualquiera. */
const rutaDe = (archivo: string): string => {
  const partes = archivo.replace(/^app\//, '').split('/').slice(0, -1).filter((p) => !/^\(.*\)$/.test(p));
  return `/${partes.map((p) => (/^\[\[?\.\.\./.test(p) ? 'a/b' : /^\[.*\]$/.test(p) ? '1' : p)).join('/')}`.replace(/\/$/, '') || '/';
};

const METODOS_QUE_ESCRIBEN = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;
/** Cada ruta de /api con los métodos que escribe (enumerar es leer qué exporta: no afirma nada del código). */
const rutasQueEscriben = (): Array<{ archivo: string; ruta: string; metodos: string[] }> => archivos()
  .filter((f) => /^app\/api\/.+\/route\.ts$/.test(f))
  .map((archivo) => {
    const src = leer(archivo);
    const metodos = METODOS_QUE_ESCRIBEN.filter((m) => new RegExp(`export\\s+(async\\s+function|const|function)\\s+${m}\\b|export\\s*\\{[^}]*\\b${m}\\b`).test(src));
    return { archivo, ruta: rutaDe(archivo), metodos };
  })
  .filter((r) => r.metodos.length > 0);
const accionesDelServidor = (): string[] => archivos().filter((f) => /\.(ts|tsx)$/.test(f) && /^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*\s*['"]use server['"]/.test(leer(f)));
const paginas = (): string[] => archivos().filter((f) => /\/page\.tsx$/.test(f) || f === 'app/page.tsx').map(rutaDe);

const cookie = (mfa?: string, email: string = CUENTA_DE_REVISION.email) =>
  `${SESSION_COOKIE}=${crearToken({ sub: '77', email, nombre: 'X', rol: 'usuario', ...(mfa ? { mfa: mfa as 'revision' } : {}) }, 7)}`;
const REVISION = cookie('revision');
const CLOSER = cookie(undefined, 'closer@otro.test');
const pedir = (metodo: string, ruta: string, c: string, extra: Record<string, string> = {}) =>
  proxy(new NextRequest(`http://localhost:3010${ruta}`, {
    method: metodo,
    headers: { cookie: c, origin: 'http://localhost:3010', host: 'localhost:3010', 'content-type': 'application/json', ...extra },
    ...(metodo === 'GET' || metodo === 'HEAD' ? {} : { body: '{}' }),
  }));
const pasa = (r: Response) => r.headers.get('x-middleware-next') === '1' || r.headers.has('x-middleware-rewrite');
const cortadaPorRevision = async (r: Response) => r.status === 403 && /cuenta de demostración/.test(await r.clone().text());
/** Lo que el proxy le corta a CUALQUIER closer antes (`SOLO_ADMIN` → `denegarRol`): ahí no hace falta el corte de la cuenta. */
const soloAdmin = (metodo: string, ruta: string, extra: Record<string, string> = {}) => !pasa(pedir(metodo, ruta, CLOSER, extra));

/** El veredicto de cada escritura, como queda en el snapshot. */
async function veredictos(): Promise<string[]> {
  const lineas: string[] = [];
  for (const r of rutasQueEscriben()) {
    for (const m of r.metodos) {
      const res = pedir(m, r.ruta, REVISION);
      const v = esPublica(r.ruta) ? (pasa(res) ? 'pública (no usa la sesión)' : 'pública, cortada')
        : pasa(res) ? 'PERMITIDA'
        : soloAdmin(m, r.ruta) && !(await cortadaPorRevision(res)) ? 'sólo admin (el rol la corta antes, también a un closer)'
          : (await cortadaPorRevision(res)) ? 'cortada'
            : `otra respuesta (${res.status})`;
      lineas.push(`${m} ${r.ruta} → ${v}`);
    }
  }
  for (const f of accionesDelServidor()) lineas.push(`acción ${f} → cortada (ninguna página acepta un POST de esta cuenta)`);
  return [...new Set(lineas)].sort();
}

test('1. el snapshot: toda ruta que escribe y toda acción del servidor está clasificada', async () => {
  const actual = (await veredictos()).join('\n') + '\n';
  if (process.env.MAKO_REGENERAR_SNAPSHOT === '1') writeFileSync(SNAPSHOT, actual);
  const guardado = readFileSync(SNAPSHOT, 'utf8').replace(/\r\n/g, '\n');
  const a = new Set(actual.trim().split('\n'));
  const g = new Set(guardado.trim().split('\n'));
  const nuevas = [...a].filter((l) => !g.has(l));
  const viejas = [...g].filter((l) => !a.has(l));
  assert.deepEqual({ nuevas, viejas }, { nuevas: [], viejas: [] },
    'Cambió lo que escribe la app. Decide si la cuenta de revisión de las tiendas (una contraseña que tienen terceros) puede usar cada ruta '
    + 'nueva: si sí, súmala a PERMITIDO_EN_REVISION (lib/cuenta-revision-reglas.ts) con su porqué. Después regenera: '
    + 'MAKO_REGENERAR_SNAPSHOT=1 node --import tsx --test tests/cuenta-revision-escrituras.test.ts');
});

test('2. nada de lo que no está en la lista pasa con la cookie de revisión; con la de un closer común, sí', async () => {
  let medidas = 0;
  for (const r of rutasQueEscriben()) {
    if (esPublica(r.ruta)) continue;
    for (const m of r.metodos) {
      const permitida = Object.prototype.hasOwnProperty.call(PERMITIDO_EN_REVISION, r.ruta);
      const conRevision = pedir(m, r.ruta, REVISION);
      if (permitida) assert.ok(pasa(conRevision), `${m} ${r.ruta}: está en la lista y no pasa`);
      else if (soloAdmin(m, r.ruta)) assert.ok(!pasa(conRevision), `${m} ${r.ruta}: pasa con la cookie de revisión`);
      // Donde un closer común pasa, la cuenta de revisión tiene que estar cortada POR SER ella (el control: sin esto, una ruta rota
      // también «queda cortada»).
      else assert.ok(await cortadaPorRevision(conRevision), `${m} ${r.ruta}: pasa con la cookie de revisión`);
      medidas += 1;
    }
  }
  assert.ok(medidas > 150, `midió ${medidas} escrituras: el enumerador dejó de ver las rutas`);
});

test('3. las que encontró la revisión, por nombre: mails, WhatsApp, links, la computadora, Spy, otro negocio', async () => {
  for (const ruta of ['/api/whatsapp/evolution/mensajes', '/api/chats/email', '/api/compartir', '/api/ia-pc/codigo', '/api/competitor-spy/competidores',
    '/api/datos-mau', '/api/agencia/entrar', '/api/perfil/seguridad', '/api/equipo', '/api/agente/token', '/api/onboarding', '/api/errores']) {
    assert.ok(await cortadaPorRevision(pedir('POST', ruta, REVISION)), ruta);
  }
  // Las server actions viajan como un POST a CUALQUIER página (Next reenvía la acción a quien la tenga): con y sin `next-action`, y como formulario.
  for (const pagina of ['/customer-success', '/newsletters', '/crm', '/tickets', '/m/crm', '/inicio']) {
    assert.ok(await cortadaPorRevision(pedir('POST', pagina, REVISION, { 'next-action': 'abc123', 'content-type': 'text/plain' })), `acción en ${pagina}`);
    assert.ok(await cortadaPorRevision(pedir('POST', pagina, REVISION, { 'content-type': 'multipart/form-data; boundary=x' })), `formulario en ${pagina}`);
    assert.ok(await cortadaPorRevision(pedir('GET', pagina, REVISION, { 'next-action': 'abc123' })), `GET con next-action en ${pagina}`);
    assert.ok(!(await cortadaPorRevision(pedir('POST', pagina, CLOSER, { 'next-action': 'abc123', 'content-type': 'text/plain' }))), `el closer en ${pagina}`);
  }
});

test('4. leer, sí: el revisor mira la app entera', () => {
  for (const ruta of ['/crm', '/chats', '/second-brain', '/perfil', '/api/auth/me', '/api/crm/etiquetas', '/api/notificaciones']) {
    const r = pedir('GET', ruta, REVISION);
    assert.ok(pasa(r), `GET ${ruta}`);
  }
});

test('5. lo permitido es lo que el revisor tiene que probar, y cada entrada existe como ruta que escribe', () => {
  const existentes = new Set(rutasQueEscriben().map((r) => r.ruta));
  for (const ruta of Object.keys(PERMITIDO_EN_REVISION)) {
    assert.ok(existentes.has(ruta), `${ruta} está en la lista y no es una ruta que escriba: una entrada vieja es permiso escrito para algo futuro`);
    assert.ok(!esPublica(ruta), `${ruta} es pública: no hace falta en la lista`);
  }
  for (const ruta of ['/api/m/mako', '/api/mako/chat', '/api/ia-permiso', '/api/soporte/reportar', '/api/cuenta/eliminar']) {
    assert.ok(Object.prototype.hasOwnProperty.call(PERMITIDO_EN_REVISION, ruta), `${ruta}: es lo que Apple y Google piden probar`);
  }
  // Ninguna página: un POST a una página es una server action, y no hay cómo saber cuál.
  const permitidas = new Set(Object.keys(PERMITIDO_EN_REVISION));
  for (const p of paginas()) assert.ok(!permitidas.has(p), `${p} es una página`);
});

test('6. ninguna acción del servidor escapa: una página con cada archivo `use server` enumerado', async () => {
  const acciones = accionesDelServidor();
  assert.ok(acciones.length > 50, `encontró ${acciones.length} archivos 'use server': el enumerador dejó de verlos`);
  assert.ok(acciones.includes('app/customer-success/curso/invitar-actions.ts'), 'el que mandaba el mail desde MaKo');
  assert.ok(acciones.includes('app/newsletters/actions.ts'));
  // Toda página rechaza el POST de esta cuenta: así ninguna de esas acciones tiene por dónde entrar.
  let medidas = 0;
  for (const p of paginas()) {
    if (esPublica(p) || p === '/') continue;
    const r = pedir('POST', p, REVISION, { 'next-action': 'x' });
    assert.ok(soloAdmin('POST', p, { 'next-action': 'x' }) ? !pasa(r) : await cortadaPorRevision(r), `POST ${p}`);
    medidas += 1;
  }
  assert.ok(medidas > 100, `midió ${medidas} páginas: el enumerador dejó de verlas`);
});
