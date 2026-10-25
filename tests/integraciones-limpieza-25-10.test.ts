// =============================================================================
// /integraciones de punta a punta (25/10/2026): nombres reales, las IA en «Tus cuentas de IA», Google Calendar sin tarjeta
// =============================================================================
// Martín, 25/10/2026 (docs/feedback-25-10-tarde.md), textual en lo que este test fija:
//   · «Fijate los nombres, no inventes nombres como "MaKo AI", pon los nombres correctamente: "Anthropic API" o "OpenAI API"»;
//   · «dentro de los modales de esas, también pon la opción para que lo conecten desde sus PC, y aclara que no es lo mismo, es
//     algún lugar sutil, tal vez en "?"»;
//   · «elimina las IA dentro de las integraciones, para eso tenemos el bloque que dice "Tus cuentas de IA" arriba del todo.
//     Ahí solo agrega a Groq y listo. En Groq y Gemini no pongas "pronto" en la opción de la computadora»;
//   · «Elimina la de Google Calendar, entiendo que cuando se registran con Google ya le podríamos preguntar esos permisos»;
//   · «Las que están "sin conectar" pon las tarjetas un poco más opacas o grises».
// Hotmart, Skool y Apify («Depreca...», «Elimina Apify») tienen su propio guard: tests/leads-scraper-retirado.test.ts.
//
// Lo que NO se pierde al sacar una tarjeta (y por eso se fija acá): una integración `oculto` sigue existiendo para su modal
// (`getIntegracion` no mira `oculto`), para la API de MaKo (`ver_integraciones` las lista) y para el link `?abrir=<key>`, que
// es contrato (avisos, la API, MaKo en WhatsApp) y abre el modal suelto. Las 7 agendas de Google conectadas siguen andando.
//
// PROBADO ROMPIÉNDOLO (25/10/2026): ver `ROTURAS` al pie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFS, defsVisibles } from '../lib/integraciones-catalogo';
import { INTERRUPTOR_AGENDA_EN_LOGIN, loginPideAgenda, otorgoLaAgenda, scopesDelLogin } from '../lib/google-login-agenda';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** El nombre del producto, como lo escribe su dueño. */
const NOMBRES: Record<string, string> = {
  email: 'Resend', anthropic: 'Anthropic API', openai: 'OpenAI API', gemini: 'Gemini API', groq: 'Groq API', google: 'Google Calendar',
};
const SIN_TARJETA = ['anthropic', 'openai', 'gemini', 'groq', 'google'];

test('1. los nombres son los del producto, en la tarjeta y en los campos', () => {
  for (const [key, nombre] of Object.entries(NOMBRES)) {
    assert.equal(DEFS.find((d) => d.key === key)?.nombre, nombre, `la tarjeta de ${key} no se llama «${nombre}»`);
  }
  for (const d of DEFS) assert.doesNotMatch(d.nombre, /MaKo IA|MaKo AI|\(Anthropic\)|\(OpenAI\)|Email \(/, `«${d.nombre}» es un nombre inventado`);
  // El método (los campos del modal) es `server-only`: se lee del fuente. El modal dice el MISMO nombre que la tarjeta.
  const metodo = sinComentarios(leer('lib/metodo-catalogo.ts'));
  for (const [key, nombre] of Object.entries(NOMBRES)) {
    if (key === 'google') continue; // Google no tiene campos (es la app OAuth de la agencia)
    assert.match(metodo, new RegExp(`key: '${key}',\\s*nombre: '${nombre.replace(/[()]/g, '\\$&')}'`), `los campos de ${key} no dicen «${nombre}»`);
  }
});

test('2. las cuatro IA y Google Calendar no son tarjetas, pero siguen existiendo para su modal y para la API', () => {
  const visibles = defsVisibles(DEFS, { cats: null, ocultas: new Set(), esSuper: true }).map((d) => d.key);
  for (const key of SIN_TARJETA) {
    assert.ok(DEFS.some((d) => d.key === key && d.oculto), `${key} tiene que estar en el catálogo, \`oculto\``);
    assert.equal(visibles.includes(key), false, `${key} volvió a ser una tarjeta de la grilla`);
  }
  const integ = sinComentarios(leer('lib/integraciones.ts'));
  assert.match(integ, /defsVisibles\(\[\{ \.\.\.d, oculto: false \}\]/, 'getIntegracion volvió a mirar `oculto`: su modal no abre');
  assert.match(integ, /opts\.conOcultas \? DEFS\.map\(\(d\) => \(\{ \.\.\.d, oculto: false \}\)\) : DEFS/);
  assert.match(sinComentarios(leer('lib/api-mako/areas/integraciones.run.ts')), /getIntegraciones\(\{ conOcultas: true \}\)/,
    'ver_integraciones dejó de listar las ocultas: la API ya no lee el estado de las IA ni de la agenda');
});

test('3. `?abrir=<key>` de una sin tarjeta abre su modal suelto (es contrato)', () => {
  const board = sinComentarios(leer('app/integraciones/IntegracionesBoard.tsx'));
  assert.match(board, /const \{ abrir: abrirSuelta, modal: modalSuelto \} = useConectarIntegracion\(\);/);
  assert.match(board, /const oculta = !enGrilla && DEFS\.some\(\(d\) => d\.key === abrir && d\.oculto\);/);
  assert.match(board, /if \(oculta\) abrirSuelta\(abrir\);/, 'una oculta no abre nada con su link');
  assert.match(board, /\{modalSuelto\}/, 'el modal suelto no está en el árbol');
});

test('4. «Tus cuentas de IA»: las cuatro claves con su nombre, el «?» de la computadora, y sin «Pronto»', () => {
  const src = sinComentarios(leer('app/integraciones/TusCuentasIA.tsx'));
  assert.match(src, /\{ key: 'anthropic', ia: 'claude' \}, \{ key: 'openai', ia: 'chatgpt' \}, \{ key: 'gemini' \}, \{ key: 'groq' \},/,
    'las claves de API son Anthropic y OpenAI (con computadora) y Gemini y Groq (sin)');
  assert.match(src, /DEFS_INTEGRACIONES\.find\(\(d\) => d\.key === key\)\?\.nombre/, 'el nombre de cada clave no sale del catálogo');
  assert.match(src, /const NO_ES_LO_MISMO = 'No es lo mismo que la clave:/);
  assert.match(src, /\{o\.que === 'pc' && <><span className="tci-ayuda" title=\{NO_ES_LO_MISMO\} aria-hidden>\?<\/span><span id=\{idAyuda\} hidden>\{NO_ES_LO_MISMO\}<\/span><\/>\}/,
    'el «?» de la computadora no está');
  // Al lector, como DESCRIPCIÓN del botón y no en su nombre (en el nombre se leía la oración entera en cada opción).
  assert.match(src, /aria-describedby=\{o\.que === 'pc' \? idAyuda : undefined\}/, 'el lector de pantalla no recibe la diferencia');
  const ini = src.indexOf('function ClavesDeApi(');
  const bloque = src.slice(ini, src.indexOf('\n}\n', ini));
  assert.ok(ini > 0 && bloque.length > 200, 'no se encontró ClavesDeApi');
  assert.doesNotMatch(bloque, /Pronto/i, 'Gemini y Groq no llevan «Pronto»');
  assert.match(bloque, /<BotonIntegracion key=\{c\.key\} servicio=\{c\.key\}/, 'Gemini y Groq abren directo el modal de su clave');
  // Siempre a la vista: con o sin computadora conectada (no colgado de `vacia`).
  assert.match(src, /\{\(estado \|\| leido\) && !eligiendo && !tutorial && <ClavesDeApi /);
});

test('5. las sin conectar, en gris: atenuadas y sin color hasta que se las señala', () => {
  const css = leer('app/globals.css');
  assert.match(css, /\.int-tarjeta\[data-sin-conectar\] > \* \{ opacity: \.62;/);
  assert.match(css, /\.int-tarjeta\[data-sin-conectar\] > :first-child \{ filter: grayscale\(1\); \}/);
  assert.match(css, /\.int-tarjeta\[data-sin-conectar\]:hover > \*, \.int-tarjeta\[data-sin-conectar\]:focus-visible > \* \{ opacity: 1; filter: none; \}/);
  assert.match(sinComentarios(leer('app/integraciones/IntegracionesBoard.tsx')), /data-sin-conectar=\{conectada \|\| motivo \? undefined : ''\}/,
    'una con un problema (rojo o ámbar) no se apaga: pide atención');
});

test('6. la agenda al entrar con Google: apagada salvo GOOGLE_LOGIN_CON_AGENDA=1, y sólo con la agenda ENTERA otorgada', () => {
  assert.equal(INTERRUPTOR_AGENDA_EN_LOGIN, 'GOOGLE_LOGIN_CON_AGENDA');
  assert.equal(loginPideAgenda({}), false, 'sin la variable, el login NO pide la agenda (la app de Google no está verificada)');
  assert.equal(loginPideAgenda({ GOOGLE_LOGIN_CON_AGENDA: 'true' }), false, 'sólo «1» la prende');
  assert.equal(loginPideAgenda({ GOOGLE_LOGIN_CON_AGENDA: '1' }), true);
  assert.equal(scopesDelLogin(false, 'a b'), 'openid email profile');
  assert.equal(scopesDelLogin(true, 'a b'), 'openid email profile a b');
  assert.equal(otorgoLaAgenda('openid email a b', 'a b'), true);
  assert.equal(otorgoLaAgenda('openid email a', 'a b'), false, 'destildó el calendario en el consentimiento granular');
  assert.equal(otorgoLaAgenda(undefined, 'a b'), false);
  assert.equal(otorgoLaAgenda('a b', ''), false, 'sin scopes que pedir no hay agenda que otorgar');
  const login = sinComentarios(leer('app/api/auth/google/route.ts'));
  assert.match(login, /auth\.searchParams\.set\('scope', scopesDelLogin\(conAgenda, GCAL_SCOPE\)\);/);
  assert.match(login, /if \(conAgenda\) auth\.searchParams\.set\('access_type', 'offline'\);/, 'el offline sin la agenda guardaría un token sin permiso');
  assert.match(login, /auth\.searchParams\.set\('prompt', 'select_account'\);/, 'el login no fuerza la pantalla de permisos en cada entrada');
  const vuelta = sinComentarios(leer('app/api/auth/callback/google/route.ts'));
  assert.match(vuelta, /guardarCalendarBestEffort\(usuario, otorgoLaAgenda\(tokens\.scope, GCAL_SCOPE\) \? tokens\.refresh_token : undefined\)/,
    'el callback guarda un token aunque no traiga la agenda');
});

// ── ROTURAS (25/10/2026) ───────────────────────────────────────────────────────
// (se completa con la corrida del arnés)
