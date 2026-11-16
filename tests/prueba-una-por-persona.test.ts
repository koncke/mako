// =============================================================================
// UNA PRUEBA GRATIS POR PERSONA: el email, el WhatsApp, y el nombre con el negocio (16/11/2026)
// =============================================================================
// Martín, textual: «la opción C de email y WhatsApp sin mirar la tarjeta… O incluso también podríamos agregar ahí por nombre y
// negocio». Lo que se cuida:
//   · EL CHECKOUT (lib/compra-plan.ts, `puedeEmpezarPrueba`): si el email —por su CASILLA: sin «+algo» en todos los dominios y, en
//     Gmail, sin puntos; el del pago o el de acceso que cambió en la página de gracias— o el WhatsApp —con su país, con o sin el 9 de un
//     celular argentino— ya tuvieron una prueba autorizada, la compra SIGUE sin la prueba (se cobra desde hoy y se dice por qué, sin
//     nombrar al WhatsApp). Nunca se bloquea: la ruta contesta `sinPrueba` y el formulario pasa solo a pagar
//     (tests/checkout-moneda-y-signos.test.ts, el 8). La tarjeta no se mira acá.
//   · EL ONBOARDING (lib/onboarding-arranque-server.ts, `avisarSiYaTuvoPrueba`): al guardar el nombre y el negocio o confirmar el
//     WhatsApp, si coinciden con otra cuenta que ya tuvo su prueba, un correo al super admin con las dos cuentas. No corta nada.
// Lo puro se EJECUTA; el cableado (server-only) se lee del fuente.
// PROBADO ROMPIÉNDOLO (16/11/2026; base 5 / 0): al pie.
// Correr: node --import tsx --test tests/prueba-una-por-persona.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TEXTO_PRUEBA_USADA_WHATSAPP, huellaDeNombreYNegocio, whatsappsDeLaPrueba } from '../lib/compra-plan-reglas';
import { casillaDeLaPrueba, patronesDeLaCasilla } from '../lib/prueba-plan-reglas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
/** Lo que hace el ILIKE de la base con un patrón (`%` = cualquier cosa), para probar que los patrones traen lo que tienen que traer. */
const ilike = (patron: string, valor: string) => new RegExp(`^${patron.split('%').map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/_/g, '.')).join('.*')}$`, 'i').test(valor);

test('1. el email por su CASILLA: sin «+algo» en TODOS los dominios, y en Gmail también sin puntos (es la misma)', () => {
  for (const e of ['vale@gmail.com', 'V.a.l.e@gmail.com', 'vale+promo@gmail.com', 'v.ale+x.y@googlemail.com', '  VALE@Gmail.com ']) {
    assert.equal(casillaDeLaPrueba(e), 'vale@gmail.com', e);
  }
  assert.equal(casillaDeLaPrueba('va.le@empresa.com'), 'va.le@empresa.com', 'fuera de Gmail un punto puede ser otra casilla');
  // EL «+algo» FUERA DE GMAIL (revisión del 16/11/2026, hallazgo 6): Hotmail, iCloud, Proton y los de empresa también lo aceptan, y
  // «martin+1@hotmail.com», «+2»… eran una prueba nueva cada vez.
  for (const [e, sale] of [['martin+1@hotmail.com', 'martin@hotmail.com'], ['Martin+2@Outlook.com', 'martin@outlook.com'], ['vale+x@empresa.com', 'vale@empresa.com'], ['va.le+x@icloud.com', 'va.le@icloud.com']] as const) {
    assert.equal(casillaDeLaPrueba(e), sale, e);
  }
  // Los patrones de la base traen TODAS las formas de esa casilla; lo que traen de más lo descarta la casilla.
  const patrones = patronesDeLaCasilla('va.le+algo@gmail.com')!;
  assert.deepEqual(patrones, ['v%a%l%e%@gmail.com', 'v%a%l%e%@googlemail.com']);
  for (const guardado of ['vale@gmail.com', 'v.a.l.e@gmail.com', 'vale+promo@gmail.com', 'VALE@googlemail.com']) {
    assert.ok(patrones.some((p) => ilike(p, guardado)), `el patrón no trae ${guardado}`);
    assert.equal(casillaDeLaPrueba(guardado), casillaDeLaPrueba('va.le+algo@gmail.com'));
  }
  assert.ok(patrones.some((p) => ilike(p, 'vxaxlxe@gmail.com')) && casillaDeLaPrueba('vxaxlxe@gmail.com') !== 'vale@gmail.com', 'lo de más se descarta por la casilla');
  const hotmail = patronesDeLaCasilla('martin+3@hotmail.com')!;
  assert.deepEqual(hotmail, ['martin@hotmail.com', 'martin+%@hotmail.com']);
  for (const guardado of ['martin@hotmail.com', 'MARTIN+1@hotmail.com', 'martin+promo@hotmail.com']) assert.ok(hotmail.some((p) => ilike(p, guardado)), `el patrón no trae ${guardado}`);
  assert.ok(!hotmail.some((p) => ilike(p, 'martina@hotmail.com')), 'trae otra casilla');
  // Lo que no entra en un filtro de PostgREST (una coma, un paréntesis), el email exacto.
  assert.equal(patronesDeLaCasilla('a,b@empresa.com'), null);
  assert.equal(patronesDeLaCasilla('(a)@empresa.com'), null);
});

test('2. el WhatsApp con su país, y el MISMO número con y sin el 9 de un celular argentino', () => {
  assert.deepEqual(whatsappsDeLaPrueba('5491123456789'), ['5491123456789', '541123456789']);
  assert.deepEqual(whatsappsDeLaPrueba('541123456789'), ['5491123456789', '541123456789'], 'guardado antes del 16/11, sin el 9');
  assert.deepEqual(whatsappsDeLaPrueba('+52 55 1234 5678'), ['525512345678']);
  assert.equal(whatsappsDeLaPrueba(''), null);
  assert.equal(whatsappsDeLaPrueba('123'), null);
});

test('3. el nombre y el negocio juntos, sin tildes, mayúsculas ni signos; con uno solo no alcanza', () => {
  assert.equal(huellaDeNombreYNegocio('María José Ríos', 'Nutri-Vale'), 'maria jose rios|nutri vale');
  assert.equal(huellaDeNombreYNegocio('  maria   jose rios ', 'NUTRI VALE!'), 'maria jose rios|nutri vale');
  assert.equal(huellaDeNombreYNegocio('María', ''), null, 'el nombre solo lo comparten miles');
  assert.equal(huellaDeNombreYNegocio('', 'Nutri Vale'), null, 'el negocio solo, dos socios');
});

test('4. el CHECKOUT: por la casilla del email y por el WhatsApp, y la compra sigue sin la prueba (nunca se bloquea)', () => {
  const plan = leer('lib/compra-plan.ts');
  const ini = plan.indexOf('async function puedeEmpezarPrueba(');
  const puede = plan.slice(ini, plan.indexOf('\n}\n', ini));
  assert.match(puede, /const patrones = patronesDeLaCasilla\(email\);/);
  // El email del pago y el de acceso que cambió en la página de gracias (hallazgo 6): los dos, con todas las formas de la casilla.
  assert.match(puede, /\.or\(patrones\.flatMap\(\(x\) => \[`email\.ilike\.\$\{x\}`, `origen->>email_acceso\.ilike\.\$\{x\}`\]\)\.join\(','\)\)/, 'no se buscan las otras formas de la casilla, o el email de acceso');
  assert.match(puede, /select\('id, email, origen'\)/);
  assert.match(puede, /const usados = \(c: [^)]*\) => \[c\.email, c\.origen\?\.email_acceso\];/);
  assert.match(puede, /usados\(c\)\.some\(\(x\) => typeof x === 'string' && casillaDeLaPrueba\(x\) === casilla\)\)\) return \{ ok: false, motivo: 'email' \}/);
  assert.doesNotMatch(puede, /casillaDeEmail|patronesDeGmail/, 'volvió la casilla que sacaba el «+» sólo en Gmail');
  assert.match(puede, /const numeros = whatsappsDeLaPrueba\(p\.whatsapp\);/);
  assert.match(puede, /\.in\('origen->>whatsapp', numeros\)/, 'el WhatsApp no corta la prueba');
  // Las pruebas que cuentan: las autorizadas de la plataforma («planes:<plan>:prueba» con la suscripción cargada).
  assert.match(puede, /\.eq\('workspace_id', plataforma\)\.like\('creado_por', 'planes:%:prueba'\)\.not\('suscripcion_estado', 'is', null\)/);
  // Sin poder leer, deja empezar (la tarjeta la mira Mercado Pago al autorizar): un comprador no se queda afuera por la base.
  assert.match(puede, /\} catch \(e\) \{[\s\S]*return \{ ok: true \};/);
  // El WhatsApp de la compra viaja: la ruta lo pasa, y el texto dice por qué se cobra desde hoy.
  assert.match(plan, /puedeEmpezarPrueba\(\{ email: p\.email, whatsapp: p\.whatsapp \}, ws\)/);
  // SIN NOMBRAR AL WHATSAPP (revisión del 16/11/2026, hallazgo 7): el del checkout no se verifica, y «Ese WhatsApp ya usó su prueba»
  // le decía a cualquiera que tecleara un número si esa persona había probado MaKo.
  assert.equal(TEXTO_PRUEBA_USADA_WHATSAPP, 'La prueba gratis es una por persona. Si quieres empezar igual, el plan se cobra desde hoy.');
  assert.doesNotMatch(TEXTO_PRUEBA_USADA_WHATSAPP, /whatsapp|n[úu]mero|tel[ée]fono|ese |ya us[óo]/i);
  // EL EMAIL DE ACCESO QUEDA EN EL COBRO DE LA PRUEBA (hallazgo 6): la página de gracias lo cambia, y sin anotarlo el email nuevo
  // empezaba otra prueba. En `origen` (el `email` es el de la pasarela), sólo en la prueba, y después del cambio hecho.
  const ruta = leer('app/api/pagar/email/route.ts');
  const iCambio = ruta.indexOf("const { data: cambiado, error: e2 } = await db.from('usuarios')");
  const iAnota = ruta.indexOf('if (esPruebaDePlan(cobro)) {');
  assert.ok(iCambio > 0 && iAnota > iCambio, 'se anota antes de cambiar el email (o no se anota)');
  assert.match(ruta.slice(iAnota), /update\(\{ origen: \{ \.\.\.origen, email_acceso: nuevo\.email \} \}\)\.eq\('id', cobro\.id\)/);
});

test('5. el ONBOARDING: el nombre y el negocio o el WhatsApp de otra cuenta con prueba AVISAN al super admin, y no cortan nada', () => {
  const src = leer('lib/onboarding-arranque-server.ts');
  // Cuándo: al guardar el nombre o el negocio, o al confirmar el WhatsApp (las tres pasan por `guardarEstadoArranque`).
  const guardar = src.slice(src.indexOf('export async function guardarEstadoArranque('), src.indexOf('// ── LA PRUEBA GRATIS REPETIDA'));
  assert.match(guardar, /if \(patch\.nombre !== undefined \|\| patch\.negocio !== undefined \|\| patch\.telefono === 'verificado'\) await programarAvisoDePrueba\(nuevo as EstadoArranque\);/);
  // Después de contestar, y sólo con un pedido de Next: el onboarding no espera al aviso, y un test o un script no salen a la red.
  assert.match(src, /try \{ after\(correr\); \} catch \{ \/\* sin un pedido de Next: no se avisa \*\/ \}/);
  // Se carga recién al correr: el onboarding no suma lo que el aviso importa (los tests que le simulan la base siguen andando).
  assert.match(src, /await import\('\.\/prueba-repetida'\)\)\.avisarSiYaTuvoPrueba\(ws, e\)/);
  const mod = leer('lib/prueba-repetida.ts');
  const desde = mod.indexOf('export async function avisarSiYaTuvoPrueba(');
  const aviso = mod.slice(desde, mod.indexOf('\n}\n', desde));
  // Sólo a un negocio que empezó con la prueba (el que pagó directo no se mira), y contra OTRAS cuentas con prueba.
  assert.match(aviso, /if \(!propia\) return 'sin-prueba';/);
  assert.match(aviso, /pruebas\(\)\.neq\('alta_ws', ws\)/);
  // DE A PÁGINAS (revisión del 16/11/2026): Supabase corta en 1000 filas SIN AVISAR, y un `limit(2000)` traía 1000. Con el `id` de
  // desempate, una página no repite ni saltea filas de la misma fecha.
  assert.doesNotMatch(aviso, /\.limit\(\d{4,}\)/, 'volvió un limit de más de 1000: Supabase lo corta en 1000');
  assert.match(aviso, /\.order\('created_at', \{ ascending: false \}\)\.order\('id', \{ ascending: false \}\)\.range\(desde, desde \+ PAGINA - 1\)/);
  assert.match(aviso, /if \(filas\.length < PAGINA\) break;/);
  assert.match(mod, /const PAGINA = 1000;/);
  // Por las tres cosas: el nombre y el negocio de su onboarding, el WhatsApp que confirmó y el WhatsApp de su checkout.
  assert.match(aviso, /huellaDeNombreYNegocio\(o\.nombre, o\.negocio\) === huella\) sumar\(Number\(r\.workspace_id\), 'el nombre y el negocio'\)/);
  assert.match(aviso, /o\.telefono === 'verificado' && mismoNumero\(o\.telefonoNumero\)/);
  assert.match(aviso, /mismoNumero\(f\.origen\?\.whatsapp\)\) sumar\(w, 'el WhatsApp'\)/);
  // Al super admin, con las dos cuentas, una vez por cuenta y motivo; y NADA más: no cancela, no toca la prueba.
  assert.match(aviso, /avisarDePlataforma\(\{ to: EMAIL_MAKO, asunto,/);
  assert.match(aviso, /`Esta \(negocio \$\{ws\}\)/);
  assert.match(aviso, /`La otra \(negocio \$\{w\}\)/);
  assert.match(aviso, /setSetting\(CLAVE_AVISO_PRUEBA, /);
  assert.doesNotMatch(aviso, /cancelar|anular|\.update\(|\.delete\(|suspender/i, 'el aviso corta algo: lo decide una persona');
});

// ── Probado rompiéndolo (16/11/2026) ───────────────────────────────────────────────────────────────────────────────────
// Base: 5 pasan / 0 fallan. Cada rotura, restaurada después (pasan / fallan):
//   · la casilla de Gmail sin sacar los puntos                  -> 4 / 1
//   · el WhatsApp sin su variante sin el 9                      -> 4 / 1
//   · el checkout sin mirar el WhatsApp                         -> 4 / 1
//   · el onboarding sin el aviso al guardar el negocio          -> 4 / 1
//   · el aviso también a quien no empezó con la prueba          -> 4 / 1
// Revisión del 16/11/2026, hallazgos 6, 7 y 12 (base 5 / 0, sobre copias):
//   · el «+algo» se saca sólo en Gmail                          -> 4 / 1
//   · el checkout no mira el email de acceso                    -> 4 / 1
//   · la página de gracias no anota el email nuevo en la prueba -> 4 / 1
//   · el aviso vuelve a nombrar al WhatsApp                     -> 4 / 1
//   · la prueba repetida vuelve al limit(2000)                  -> 4 / 1
