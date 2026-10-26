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

// ── Lo que se rompió al sacar las tarjetas (revisión del tren, 25/10/2026) ─────────────────────────────────────────────

test('7. link_configurar_integracion da el link de las que no tienen tarjeta (las IA y Google Calendar)', () => {
  // Contestaba «La integración «anthropic» no existe para este negocio»: MaKo (chat y WhatsApp) no podía mandar el link.
  const run = sinComentarios(leer('lib/api-mako/areas/integraciones.run.ts'));
  const tool = run.slice(run.indexOf('link_configurar_integracion: {'));
  assert.match(tool, /const tarjetas = await tarjetasDelWs\(ctx\.ws\);/, 'la herramienta dejó de validar con tarjetasDelWs');
  const helpers = sinComentarios(leer('lib/api-mako/areas/integraciones.helpers.ts'));
  const cuerpo = helpers.slice(helpers.indexOf('export async function tarjetasDelWs('));
  assert.match(cuerpo, /return defsVisibles\(DEFS_TARJETAS\.map\(\(d\) => \(\{ \.\.\.d, oculto: false \}\)\), \{/,
    'tarjetasDelWs volvió a sacar las `oculto`: el link de las IA y de Google Calendar dice «no existe»');
  // Lo que esa regla deja pasar: las cinco, y la plataforma corta igual (un cliente no nombra GitHub).
  const deUnCliente = defsVisibles(DEFS.map((d) => ({ ...d, oculto: false })), { cats: null, ocultas: new Set(), esSuper: false }).map((d) => d.key);
  for (const key of SIN_TARJETA) assert.ok(deUnCliente.includes(key), `${key} no tendría link`);
  assert.equal(deUnCliente.includes('github'), false, 'la regla de la plataforma dejó de cortar');
});

test('8. «Costo de MaKo»: la caja de cada IA y «Regístralos →» abren el modal de SU integración', () => {
  const page = sinComentarios(leer('app/integraciones/page.tsx'));
  assert.match(page, /const todas = await getIntegraciones\(\{ conOcultas: true \}\);/);
  assert.match(page, /const integraciones = todas\.filter\(\(i\) => !esOculta\(i\.key\)\);/, 'la grilla tiene que seguir sin las `oculto`');
  assert.match(page, /const sinTarjeta = todas\.filter\(\(i\) => esOculta\(i\.key\)\);/);
  assert.match(page, /sinTarjeta=\{sinTarjeta\}/, 'el tablero no recibe las que no tienen tarjeta');
  const board = sinComentarios(leer('app/integraciones/IntegracionesBoard.tsx'));
  assert.match(board, /onOpenService=\{\(key\) => setModal\(\{ t: 'svc', key \}\)\}/);
  assert.match(board, /const svcByKey = \(key: string\): Integracion \| null => integraciones\.find\(\(x\) => x\.key === key\)\s*\?\? sinTarjeta\.find\(\(x\) => x\.key === key\) \?\? SYNTHETIC\[key\] \?\? null;/,
    'svcByKey no busca en las que no tienen tarjeta: la caja de Claude no abre nada');
  // Y nadie las dibuja: `sinTarjeta` sólo la lee svcByKey.
  assert.equal((board.match(/sinTarjeta\./g) ?? []).length, 1, '`sinTarjeta` se usa para algo más que abrir el modal');
});

test('9. si falla la vuelta de Google, se reabre el modal suelto (el botón «Conectar» está)', () => {
  const board = sinComentarios(leer('app/integraciones/IntegracionesBoard.tsx'));
  const ini = board.indexOf('const gcalReabierto = useRef<string | null>(null);');
  assert.ok(ini > 0, 'no se encontró la reapertura del modal de Google');
  const efecto = board.slice(ini, board.indexOf('}, [gcalParam, integraciones, abrirSuelta]);', ini));
  assert.match(efecto, /if \(GCAL_MSG\[gcalParam\]\?\.kind !== 'err' \|\| integraciones\.some\(\(i\) => i\.key === 'google'\)\) return;/,
    'con un «ok» (o con Google en la grilla) no se reabre nada');
  assert.match(efecto, /gcalReabierto\.current = gcalParam;\s*abrirSuelta\('google', gcalParam\);/, 'un error de Google deja la pantalla sin botón');
  assert.match(efecto, /if \(gcalReabierto\.current === gcalParam\) return;/, 'se reabriría en cada render');
});

// ── ROTURAS (25/10/2026) ───────────────────────────────────────────────────────
// Una por vez, restaurando de memoria y comprobando el contenido. Base: 6 pasan / 0 fallan. Las 14 cazadas, cada una 5 / 1:
//   I1. «MaKo IA (Anthropic)» de vuelta en la tarjeta                → 1. los nombres
//   I2. «Email (Resend)» en los campos del modal                     → 1. los nombres
//   I3. Google Calendar sin `oculto` (vuelve a ser tarjeta)          → 2. sin tarjeta pero existen
//   I4. getIntegracion vuelve a mirar `oculto` (su modal no abre)    → 2.
//   I5. ver_integraciones sin `conOcultas` (la API no las lee)       → 2.
//   I6. `?abrir=` de una oculta devuelve sin abrir nada              → 3. el link es contrato
//   I7. sin el «?» de la computadora                                → 4. «Tus cuentas de IA»
//   I7b. la diferencia en el NOMBRE del botón (aria-label)          → 4.
//   I8. «Pronto» en la fila de Groq                                 → 4.
//   I9. las sin conectar sin atenuar (opacity 1)                     → 5. en gris
//   I10. el interruptor de la agenda prende con cualquier valor     → 6. la agenda al entrar con Google
//   I11. otorgoLaAgenda con UN scope alcanza (`some`)                → 6.
//   I12. `access_type=offline` siempre, con o sin la agenda          → 6.
//   I13. el callback guarda el refresh_token sin mirar el `scope`    → 6.
// Restaurado: 6 / 0.
// Revisión del tren (25/10/2026), base 9 / 0; cada una 8 / 1 y restaurado 9 / 0 (script con reemplazo exacto, CRLF):
//   I14. tarjetasDelWs con `DEFS_TARJETAS` a secas (las `oculto` «no existen») → 7. link_configurar_integracion
//   I15. svcByKey sin buscar en `sinTarjeta`                         → 8. «Costo de MaKo»
//   I16. page.tsx no le pasa `sinTarjeta` al tablero                 → 8.
//   I17. page.tsx lee `getIntegraciones()` sin `conOcultas`          → 8.
//   I18. un error de Google no reabre el modal suelto                → 9. la vuelta de Google
//   I19. sin la ref (se reabriría en cada render)                    → 9.
//   I20. se reabre también con un «ok»                               → 9.
