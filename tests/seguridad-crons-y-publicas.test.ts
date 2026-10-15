// =============================================================================
// Crons y superficie pública: las puertas que no tienen sesión detrás
// =============================================================================
// Auditoría de seguridad del 14/10/2026, paquete «crons y superficie pública». Cuatro hallazgos, y
// los cuatro son puertas que el proxy deja pasar sin sesión (o por las que entra un GET cross-site):
//
//   1. /api/cron/plan-recurvar no pedía el secreto del cron. /api/cron es público por PREFIJO
//      (lib/rutas-publicas.ts) y está exento de la regla de host: cualquiera con la URL reescribía
//      el tablero de la plataforma, gastaba al Perro y se llevaba el norte en la respuesta. Era la
//      única de 41 rutas así, y nunca tuvo guarda. Lo que lo deja cerrado para la próxima ruta es el
//      test de abajo: recorre app/api/cron y exige que CADA handler exportado EMPIECE llamando a
//      `checkCronAuth`, y que ninguna ruta vuelva a leer el header o el secreto por su cuenta (había
//      diez copias locales del chequeo).
//   2. `checkCronAuth` comparaba con `!==`, que corta en el primer carácter distinto. Ahora compara
//      los sha256 con `timingSafeEqual`.
//   3. /api/compartido/archivo autorizaba sólo por ALCANCE (`puedeVer`), sin mirar el recurso del
//      share: el link público de Conocimientos (alcance 'todo') bajaba por id la galería de marca.
//   4. GET /api/chat-agent/onboarding/resumen (sin llamadores) desarchivaba automatizaciones que
//      habían quedado `activa=true` y volvían a mandar audios a leads: un link en un mail alcanzaba
//      (el proxy sólo mira el Origin en POST/PUT/PATCH/DELETE y la cookie es SameSite=Lax). Se borró
//      la ruta, y `armarSecuenciasDeAudios` desarchiva PAUSADA.
//
// Los asserts sobre el fuente normalizan CRLF y sacan los comentarios antes de buscar: un
// `// const denied = checkCronAuth(req);` comentado no cuenta como guarda.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { checkCronAuth } from '../lib/cron-auth';
import { puedeVerAsset, filtrarPorShare, esShareDeMarca, RECURSO_BRANDING, RECURSO_INFORME, type Share } from '../lib/shares';

const RAIZ = resolve(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

/** Todos los route.ts debajo de una carpeta, a cualquier profundidad. */
function rutasDebajo(dir: string): string[] {
  const out: string[] = [];
  for (const nombre of readdirSync(join(RAIZ, dir))) {
    const rel = `${dir}/${nombre}`;
    if (statSync(join(RAIZ, rel)).isDirectory()) out.push(...rutasDebajo(rel));
    else if (/^route\.(ts|tsx|js|mjs)$/.test(nombre)) out.push(rel);
  }
  return out.sort();
}

const METODOS = 'GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS';

// ── 1. Cada handler de app/api/cron empieza pidiendo el secreto ─────────────────────────────────
test('⚠️ cada handler exportado de app/api/cron EMPIEZA con checkCronAuth sobre su propio request', () => {
  const rutas = rutasDebajo('app/api/cron');
  assert.ok(rutas.length >= 40, `encontré ${rutas.length} rutas de cron: ¿se movió la carpeta?`);
  const faltas: string[] = [];
  let handlers = 0;
  for (const ruta of rutas) {
    const crudo = leer(ruta);
    const src = sinComentarios(crudo);
    // Un handler exportado de otra forma (`export const GET = …`, `export { x as GET }`) no lo sabe
    // leer este guard: se escribe como función, o se enseña acá a leerlo.
    if (new RegExp(`^export\\s+(const|let|var)\\s+(${METODOS})\\b`, 'm').test(src)) faltas.push(`${ruta}: handler exportado como constante`);
    if (new RegExp(`^export\\s*\\{[^}]*\\b(${METODOS})\\b[^}]*\\}`, 'm').test(src)) faltas.push(`${ruta}: handler re-exportado`);
    const firma = new RegExp(`^export\\s+(?:async\\s+)?function\\s+(${METODOS})\\s*\\(([^)]*)\\)[^{]*\\{`, 'gm');
    const enCrudo = (crudo.match(firma) ?? []).length;
    const encontrados = [...src.matchAll(firma)];
    // Si sacar comentarios se comió un handler (un `/*` adentro de un string), el guard miraría menos.
    if (encontrados.length !== enCrudo) faltas.push(`${ruta}: ${enCrudo} handlers en el fuente y ${encontrados.length} sin comentarios`);
    if (!encontrados.length) faltas.push(`${ruta}: no exporta ningún handler que este guard sepa leer`);
    for (const m of encontrados) {
      handlers++;
      const metodo = m[1];
      const param = /^\s*(\w+)/.exec(m[2])?.[1];
      // Sin el request no hay header que mirar: así era plan-recurvar (`export async function GET()`).
      if (!param) { faltas.push(`${ruta} ${metodo}: no recibe el request, no puede pedir el secreto`); continue; }
      const cuerpo = src.slice(m.index! + m[0].length);
      const guarda = new RegExp(`^\\s*const (\\w+) = (?:await )?checkCronAuth\\(${param}\\);\\s*if \\(\\1\\) return \\1;`);
      if (!guarda.test(cuerpo)) faltas.push(`${ruta} ${metodo}: no empieza con «const x = checkCronAuth(${param}); if (x) return x;»`);
    }
    if (!/import \{[^}]*\bcheckCronAuth\b[^}]*\} from '@\/lib\/cron-auth';/.test(src)) faltas.push(`${ruta}: no importa checkCronAuth de @/lib/cron-auth`);
    // UN solo chequeo: ninguna ruta lee el secreto ni el header por su cuenta (eran diez copias con `!==`).
    if (/CRON_SECRET/.test(src)) faltas.push(`${ruta}: lee CRON_SECRET por su cuenta`);
    if (/headers\.get\(\s*['"]authorization['"]\s*\)/i.test(src)) faltas.push(`${ruta}: lee el header Authorization por su cuenta`);
  }
  assert.ok(handlers >= rutas.length, `encontré ${handlers} handlers en ${rutas.length} rutas`);
  assert.deepEqual(faltas, [], `/api/cron es público por prefijo: el secreto es la ÚNICA puerta.\n  ${faltas.join('\n  ')}`);
});

test('plan-recurvar, la que no tenía guarda, la tiene', () => {
  const src = sinComentarios(leer('app/api/cron/plan-recurvar/route.ts'));
  assert.match(src, /export async function GET\(req: NextRequest\) \{\s*const denied = checkCronAuth\(req\);\s*if \(denied\) return denied;\s*try \{/);
});

// ── 2. checkCronAuth: fail-closed y en tiempo constante ─────────────────────────────────────────
const conHeader = (v?: string) => new Request('https://x.test/api/cron/algo', v === undefined ? {} : { headers: { authorization: v } });

function conSecreto<T>(valor: string | undefined, fn: () => T): T {
  const antes = process.env.CRON_SECRET;
  if (valor === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = valor;
  try { return fn(); } finally {
    if (antes === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = antes;
  }
}

test('checkCronAuth: sin secreto en el entorno, 500 (fail-closed) aunque el header venga', () => {
  for (const s of [undefined, '']) {
    const r = conSecreto(s, () => checkCronAuth(conHeader('Bearer ')));
    assert.equal(r?.status, 500, `con CRON_SECRET=${JSON.stringify(s)} dejó pasar`);
  }
});

test('checkCronAuth: sólo el Bearer exacto pasa; un prefijo, un sobrante o un header ausente, 401', () => {
  const S = 's3cr3t-del-cron-0123456789';
  conSecreto(S, () => {
    assert.equal(checkCronAuth(conHeader(`Bearer ${S}`)), null, 'el cron de Vercel no entra');
    for (const malo of [undefined, '', 'Bearer', `Bearer ${S.slice(0, -1)}`, `Bearer ${S}x`, `bearer ${S}`, S, `Bearer  ${S}`, `Basic ${S}`]) {
      assert.equal(checkCronAuth(conHeader(malo))?.status, 401, `dejó pasar ${JSON.stringify(malo)}`);
    }
  });
});

test('checkCronAuth compara en tiempo constante (sha256 + timingSafeEqual), no con !== / ===', () => {
  const src = sinComentarios(leer('lib/cron-auth.ts'));
  assert.match(src, /timingSafeEqual\(sha256\(recibido\), sha256\(`Bearer \$\{secret\}`\)\)/);
  assert.doesNotMatch(src, /[!=]==?\s*`Bearer/, 'volvió la comparación que corta en el primer carácter distinto');
  assert.doesNotMatch(src, /`Bearer \$\{secret\}`\s*[!=]==?/);
});

// ── 3. Las piezas de marca sólo las baja un share de marca ──────────────────────────────────────
const share = (extra: Partial<Share>): Share => ({
  id: 1, workspace_id: 1, recurso: RECURSO_BRANDING, alcance: 'todo', recurso_id: null,
  modo: 'link', permiso: 'ver', etiqueta: null, expira_at: null, revocado_at: null, ...extra,
});
const LOGO = { id: 'marca-logo-mako', seccion: 'marca', grupo: 'marca' };
const GRAFICO = { id: 'graficos-crm-crm-03-cxcrmchat', seccion: 'graficos', grupo: 'crm' };

test('el link de Conocimientos (alcance «todo») NO baja piezas de marca, ni sueltas ni en lista', () => {
  const conocimientos = share({ recurso: 'conocimientos', alcance: 'todo' });
  assert.equal(esShareDeMarca(conocimientos), false);
  assert.equal(puedeVerAsset(conocimientos, LOGO), false);
  assert.equal(puedeVerAsset(conocimientos, GRAFICO), false);
  assert.deepEqual(filtrarPorShare(conocimientos, [LOGO, GRAFICO]), []);
});

test('ningún otro recurso baja piezas de marca, aunque su recurso_id coincida con el id de una', () => {
  for (const recurso of ['curso', RECURSO_INFORME, 'tarea-cs', 'otro-nuevo', '']) {
    assert.equal(puedeVerAsset(share({ recurso, alcance: 'item', recurso_id: LOGO.id }), LOGO), false, `${recurso} con item=${LOGO.id}`);
    assert.equal(puedeVerAsset(share({ recurso, alcance: 'todo' }), LOGO), false, `${recurso} con todo`);
  }
});

test('un share de marca sigue viendo lo de su alcance, y sólo eso', () => {
  assert.equal(puedeVerAsset(share({ alcance: 'todo' }), GRAFICO), true);
  const grupo = share({ alcance: 'grupo', recurso_id: 'marca' });
  assert.equal(puedeVerAsset(grupo, LOGO), true);
  assert.equal(puedeVerAsset(grupo, GRAFICO), false);
  const item = share({ alcance: 'item', recurso_id: LOGO.id });
  assert.equal(puedeVerAsset(item, LOGO), true);
  assert.equal(puedeVerAsset(item, GRAFICO), false);
  assert.deepEqual(filtrarPorShare(grupo, [LOGO, GRAFICO]), [LOGO]);
});

test('el endpoint de archivos corta por recurso ANTES de buscar la pieza, y autoriza con puedeVerAsset', () => {
  const src = sinComentarios(leer('app/api/compartido/archivo/route.ts'));
  const limite = src.indexOf('rateLimit(`compartido-archivo:ip:${clientIp(req)}`');
  const token = src.indexOf('await resolverToken(t)');
  const recurso = src.indexOf('if (!esShareDeMarca(acceso.share)) return NO();');
  const busca = src.indexOf('await getAssetDeWorkspace(');
  const autoriza = src.indexOf('if (!puedeVerAsset(acceso.share, asset)) return NO();');
  assert.ok(limite > 0 && limite < token, 'el tope por IP va antes de resolver el token');
  assert.ok(token > 0 && recurso > token && busca > recurso, 'el recurso se mira después del token y antes de buscar la pieza');
  assert.ok(autoriza > busca, 'la pieza se autoriza con puedeVerAsset');
  assert.doesNotMatch(src, /\bpuedeVer\(/, 'volvió `puedeVer` pelado: con alcance «todo» dice que sí sin mirar el recurso');
});

// ── 4. El GET que desarchivaba, y el desarchivo que prendía ─────────────────────────────────────
test('GET /api/chat-agent/onboarding/resumen ya no existe, y ningún GET de app/api arma las secuencias de audios', () => {
  assert.equal(existsSync(join(RAIZ, 'app/api/chat-agent/onboarding/resumen/route.ts')), false, 'volvió la ruta borrada');
  // Armar escribe en nutricion_secuencias (y desarchiva): un GET que lo llame se dispara con un link.
  const conGet = rutasDebajo('app/api')
    .filter((r) => /@\/lib\/secuencias-audios/.test(sinComentarios(leer(r))))
    .filter((r) => new RegExp(`^export\\s+(?:async\\s+)?function\\s+GET\\b`, 'm').test(sinComentarios(leer(r))));
  assert.deepEqual(conGet, [], 'un GET que escribe se dispara con un link (CSRF)');
});

test('armarSecuenciasDeAudios desarchiva PAUSADA, y sólo apaga la que estaba archivada', () => {
  const src = sinComentarios(leer('lib/secuencias-audios.ts'));
  // Para saber si estaba archivada, la lee.
  assert.match(src, /\.select\('id, estrategia, pasos, archivada_at'\)\.eq\('clave', plan\.clave\)/);
  assert.match(src, /const estabaArchivada = fila\.archivada_at != null;/);
  // Cada update que pone `archivada_at: null` (desarchivar) apaga `activa` en la MISMA escritura.
  const updates = [...src.matchAll(/\.update\(\{([\s\S]*?)\}\)\s*\.eq\(/g)].map((m) => m[1]);
  const desarchivan = updates.filter((u) => /archivada_at: null/.test(u));
  assert.ok(desarchivan.length >= 1, 'no encontré el update que desarchiva: el test mira otra cosa');
  for (const u of desarchivan) {
    assert.match(u, /\.\.\.\(estabaArchivada \? \{ activa: false \} : \{\}\)/, `desarchiva sin pausar: «${u.trim().slice(0, 120)}»`);
  }
  // Y la que no estaba archivada conserva lo que el dueño eligió: no hay un `activa: false` suelto.
  for (const u of desarchivan) assert.doesNotMatch(u.replace(/\.\.\.\(estabaArchivada \? \{ activa: false \} : \{\}\)/, ''), /activa:/);
});

// ── PROBADO ROMPIÉNDOLO (14/10/2026) ──────────────────────────────────────────────────────────
// Sin romper: 11 pass / 0 fail. Cada rotura sobre el árbol del worktree, corrida con este archivo y
// restaurada desde memoria antes de la siguiente (pass / fail, y qué test cae):
//    1. plan-recurvar sin las dos líneas de la guarda (como estaba)  → 9 / 2 (el barrido y el de plan-recurvar)
//    2. plan-recurvar con `GET()`, sin request                       → 9 / 2 (los mismos)
//    3. la guarda de cobranza COMENTADA con `//`                     → 10 / 1 (el barrido: lo comentado no cuenta)
//    4. ads-analyst-sync vuelve a leer el header y CRON_SECRET (`!==`) antes de la guarda → 10 / 1 (el barrido)
//    5. meta-daily con un `console.log` ANTES de la guarda           → 10 / 1 (el barrido: «EMPIEZA»)
//    6. checkCronAuth vuelve a `recibido !== \`Bearer ${secret}\``   → 10 / 1 (el de tiempo constante; los de
//       comportamiento siguen verdes: el tiempo no se ve desde un test, por eso va el assert sobre el fuente)
//    7. checkCronAuth sin el corte por secreto ausente (`if (false)`) → 10 / 1 (el fail-closed)
//    8. puedeVerAsset sin `esShareDeMarca`                           → 9 / 2 (Conocimientos y «ningún otro recurso»)
//    9. el endpoint vuelve a `puedeVer` pelado                       → 10 / 1 (el del endpoint)
//   10. el endpoint sin el corte por recurso antes de buscar          → 10 / 1 (el del endpoint)
//   11. armarSecuenciasDeAudios desarchiva sin pausar (como estaba)   → 10 / 1 (el de desarchivar)
//   12. armarSecuenciasDeAudios con `activa: false` SIEMPRE           → 10 / 1 (el mismo: apagaría lo que el dueño prendió)
//   13. vuelve app/api/chat-agent/onboarding/resumen con un GET que arma → 10 / 1 (el de la ruta borrada)
// Restaurado: 11 / 0.
