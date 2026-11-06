// =============================================================================
// El primer cobro REAL de un plan de MaKo (lanzamiento del 25/10/2026): lo que la revisión adversarial encontró
// =============================================================================
// La revisión (wf_a4441b10-5ea, 23/10/2026: 5 recorridos y escépticos por hallazgo, sobre 594ecd41b) no dejó ningún
// «bloquea», pero sí lo que pega el día del lanzamiento. Cada arreglo, con su guarda. Lo puro se ejecuta; el cableado se
// lee del FUENTE (lib/cobros.ts, lib/compra-plan.ts y las rutas son `server-only`):
//   1. «Reembolsar» una suscripción NO la corta: en /admin/cobros se corta ANTES de devolver (casilla marcada), y hay un
//      «Cortar la suscripción» propio, también con el primer pago ya devuelto;
//   2. con las claves de PRUEBA conectadas en el ws9, /planes no se ofrece al público (regalaba cuentas reales con 4242);
//   3. una clave de prueba de Stripe no pisa a la real (rompía la firma de todos los avisos reales);
//   4. la dirección del aviso de Mercado Pago lleva `?u=<su cuenta>` (sin él, los avisos de suscripción se descartaban);
//   5. la guía de la clave restringida de Stripe pide los permisos que el código usa;
//   6. el aviso de la venta y /listo no dicen «te llegó el acceso» si el mail no salió;
//   7. un alta cortada se termina con su propia cuenta, no como «Ya tenía cuenta»;
//   8. un «Ya tenía cuenta» se puede atar a su cuenta («Darle el plan a su cuenta»);
//   9. el precio en pesos de cada plan se carga en /admin/cobros, sin pisar los demás planes.
//
// PROBADO ROMPIÉNDOLO (23/10/2026): 16 roturas, ver el pie del archivo.
// Correr: npx tsx --test tests/cobro-lanzamiento.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mailDeAccesoNoSalio, PREFIJO_MAIL_NO_SALIO } from '../lib/cobros-reglas';
import { valoresDelPago } from '../lib/variables-del-lead';

const RAIZ = join(__dirname, '..');
/** Sin comentarios y con LF (AGENTS.md: las líneas PRIMERO y los bloques después). */
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const COBROS = fuente('lib/cobros.ts');
const ACCIONES = fuente('app/admin/cobros/actions.ts');
// Desde el 6/11/2026 (la copia de Polar) el reembolso de un cobro de la pasarela está en Sales › <pedido> (la sección
// Refunds) y «Cortar la suscripción» en Sales › Subscriptions (su menú), con la lista armada en app/admin/_polar/datos/ventas.ts.
const REEMBOLSO = fuente('app/admin/_polar/web/Orders/OrderRefundsSection.tsx');
const CORTAR = fuente('app/admin/_polar/web/Subscriptions/SubscriptionActionsMenu.tsx');
const VENTAS = fuente('app/admin/_polar/datos/ventas.ts');
const COMPRA = fuente('lib/compra-plan.ts');

/** La función entera, desde su firma hasta la `}` de la columna 0 que la cierra. */
function bloque(src: string, firma: string): string {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const fin = src.indexOf('\n}\n', i);
  assert.ok(fin > i, `no encontré el cierre de «${firma}»`);
  return src.slice(i, fin + 2);
}

// ── 1 · Reembolsar una suscripción también la corta ────────────────────────

test('⚠️ reembolsar con «cortar la suscripción» la corta ANTES de devolver, y sin corte no devuelve nada', () => {
  const r = bloque(ACCIONES, 'export async function reembolsarCobroMakoAction(');
  const iCorte = r.indexOf('await cancelarSuscripcionCobro(ws, id, autorDe(admin))');
  const iDevolver = r.indexOf('await reembolsarCobro(ws, id,');
  assert.ok(iCorte > 0 && iDevolver > iCorte, `orden cortar → devolver: ${iCorte} ${iDevolver}`);
  assert.match(r.slice(iCorte, iDevolver), /if \(!corte\.ok\) return \{ ok: false, resumen: `No devolví nada: \$\{corte\.resumen\}` \};/);
  assert.match(r, /if \(cortada && !r\.ok\) return \{ ok: false, resumen: `La suscripción quedó cortada, pero el reembolso no:/, 'un corte hecho con la devolución fallida se dice');
});

test('una suscripción «viva» es la que la pasarela sigue cobrando: pagada o con el primer pago devuelto, y no cancelada', () => {
  const viva = bloque(ACCIONES, 'function suscripcionViva(');
  assert.match(viva, /c\.tipo === 'suscripcion' && !!susId && c\.suscripcion_estado !== 'cancelada' && \(c\.estado === 'pagado' \|\| c\.estado === 'reembolsado'\)/);
  assert.match(viva, /c\.proveedor_suscripcion_id \?\? \(c\.proveedor === 'mercadopago' && c\.tipo === 'suscripcion' \? c\.proveedor_ref : null\)/, 'la misma lectura del id que cancelarSuscripcionCobro');
  assert.match(bloque(ACCIONES, 'export async function cancelarSuscripcionMakoAction('), /if \(!admin\) return \{ ok: false, resumen: NO_ADMIN \};[\s\S]*cancelarSuscripcionCobro\(await wsSuperAdmin\(\), id, autorDe\(admin\)\)/);
});

test('la pantalla: la casilla viene marcada en una suscripción viva, y «Cortar la suscripción» aparece aunque ya se haya devuelto', () => {
  // Al pedir el reembolso, la casilla arranca marcada si la suscripción sigue viva; se ve sólo en ese caso, y lo que diga va
  // al servidor (nunca un corte sin suscripción viva).
  assert.match(REEMBOLSO, /porLaPasarela && cobro\?\.suscripcionViva \? \(\s*<label[^>]*>\s*<Checkbox checked=\{cortar\} onCheckedChange=\{\(v\) => setCortar\(v === true\)\} \/>/, 'la casilla, sólo con una suscripción viva');
  assert.match(REEMBOLSO, /reembolsarCobroMakoAction\(cobro\.id, null, \{ cortarSuscripcion: cobro\.suscripcionViva && cortar \}\)/, 'lo que dice la casilla va al servidor, nunca un corte sin suscripción viva');
  // La casilla ARRANCA marcada si la suscripción sigue viva (devolver sin cortar deja a la pasarela cobrando todos los meses).
  assert.match(REEMBOLSO, /const \[cortar, setCortar\] = useState\(\s*!!cobro\?\.suscripcionViva\s*\)|setCortar\(\s*!!?cobro\??\.suscripcionViva\s*\)/, 'la casilla de cortar la suscripción tiene que arrancar marcada en una suscripción viva');
  // «Cortar la suscripción» depende SÓLO de que esté viva (también con el primer pago ya devuelto).
  assert.match(CORTAR, /\{cobroId != null && <DropdownMenuItem onClick=\{cortar\.show\}>Cortar la suscripción<\/DropdownMenuItem>\}/);
  assert.match(CORTAR, /cancelarSuscripcionMakoAction\(cobroId\)/);
  assert.match(VENTAS, /if \(c\.tipo !== 'suscripcion' \|\| deLeads\.has\(c\.id\) \|\| \(c\.estado !== 'pagado' && c\.estado !== 'reembolsado'\)\) continue/, 'una suscripción con el primer pago devuelto sigue en la lista');
  assert.match(VENTAS, /cobroParaCortar: c\.suscripcionViva \? c\.id : null,/, 'se corta si está viva, sin mirar si ya se devolvió');
});

// ── 2 · Las claves de prueba no se ofrecen al público ──────────────────────

test('⚠️ una pasarela en modo prueba no se ofrece en /planes, salvo al super admin (la prueba de humo)', () => {
  const oferta = bloque(COMPRA, 'export async function ofertaDelPlan(');
  assert.match(oferta, /\(await monedasDeLaPlataforma\(ws\)\)\.filter\(\(m\) => !m\.prueba \|\| opts\.conPrueba === true\)/);
  const monedas = bloque(COMPRA, 'async function monedasDeLaPlataforma(');
  assert.match(monedas, /prueba: modoDeClaveStripe\(await credDelCliente\('STRIPE_SECRET_KEY', ws\)\) === 'prueba'/);
  assert.match(monedas, /prueba: c\.modo === 'prueba'/);
  assert.match(bloque(COMPRA, 'export async function iniciarCompraDePlan('), /const oferta = await ofertaDelPlan\(p\.plan, opts\);/);
  // Las dos puertas le pasan quién es: la ruta del checkout y la página del plan.
  // (Desde el 27/10/2026, junto con el país de quien compra: tests/planes-stripe-afuera.test.ts. Y desde el 28/10, con el código
  // de partner que cuenta: tests/partners-codigo-editable.test.ts.)
  assert.match(fuente('app/api/planes/comprar/route.ts'), /iniciarCompraDePlan\(\{ \.\.\.pedido, ref: refQueCuenta \}, \{\s*conPrueba: \(await getSesionAdmin\(\)\.catch\(\(\) => null\)\) != null,/);
  assert.match(fuente('app/planes/[plan]/page.tsx'), /ofertaDelPlan\(id, \{\s*conPrueba: \(await getSesionAdmin\(\)\.catch\(\(\) => null\)\) != null,/);
});

// ── 3 · Una clave de prueba no pisa a la real ──────────────────────────────

test('⚠️ conectar una clave de prueba de Stripe sobre una real se rechaza ANTES de escribir nada', () => {
  const d = bloque(fuente('lib/cobros-conexion.ts'), 'export async function descubrirStripe(');
  const iGuarda = d.indexOf("if (opts.guardarClave && c.modo === 'prueba' && modoDeClaveStripe(await credDelCliente(k('STRIPE_SECRET_KEY'), ws)) === 'real') {");
  const iReclamo = d.indexOf('await reclamarCuenta(');
  assert.ok(iGuarda > 0 && iReclamo > iGuarda, `la guarda va antes de reclamar y de guardar: ${iGuarda} ${iReclamo}`);
  assert.match(d.slice(iGuarda, iReclamo), /ok: false, status: 409, nadaGuardado: true,/);
});

// ── 4 · La dirección del aviso de Mercado Pago lleva la cuenta ─────────────

test('⚠️ la tarjeta de Mercado Pago muestra la dirección del aviso con ?u=<su cuenta>', () => {
  const r = fuente('app/api/integraciones/credencial/route.ts');
  assert.match(r, /pasoExterno: await pasoExternoDelNegocio\(s\.key, s\.pasoExterno \?\? null, ws\),/);
  const p = bloque(r, 'async function pasoExternoDelNegocio');
  assert.match(p, /if \(!paso \|\| servicio !== 'mercadopago'\) return paso;/);
  assert.match(p, /credDelCliente\('MERCADOPAGO_USER_ID', ws\)/, 'por credDelCliente, nunca por credWs');
  assert.match(p, /return \{ \.\.\.paso, valor: `\$\{paso\.valor\}\?u=\$\{userId\}` \};/);
  // Y la ruta del aviso lee ese `?u=` (lib/cobros-eventos.ts).
  assert.match(fuente('lib/cobros-eventos.ts'), /const u = str\(b\.user_id\) \?\? deQuery\('u'\);/);
});

// ── 5 · Los permisos de la clave restringida ───────────────────────────────

test('la guía de la clave restringida de Stripe pide lo que el código usa (Coupons, Disputes, Prices)', () => {
  const cat = readFileSync(join(RAIZ, 'lib/metodo-catalogo.ts'), 'utf8');
  const write = cat.match(/'Permisos "Write": [^']*'/g) ?? [];
  const read = cat.match(/'Permisos "Read": [^']*'/g) ?? [];
  assert.equal(write.length, 2, 'las dos guías (la tarjeta y el campo)');
  for (const w of write) assert.match(w, /Coupons/);
  for (const r of read) { assert.match(r, /Disputes/); assert.match(r, /Prices/); }
});

// ── 6 · El aviso y /listo no prometen un mail que no salió ─────────────────

test('mailDeAccesoNoSalio: lo lee del mismo prefijo con que se escribe', () => {
  assert.equal(mailDeAccesoNoSalio(`${PREFIJO_MAIL_NO_SALIO}: el dominio no está verificado`), true);
  assert.equal(mailDeAccesoNoSalio(null), false);
  assert.equal(mailDeAccesoNoSalio('Ese email ya tiene una cuenta de MaKo: el plan no se cambió solo.'), false);
  // Las tres escrituras usan la constante, no el texto suelto.
  assert.doesNotMatch(COBROS, /`El mail de acceso no salió/);
  assert.doesNotMatch(fuente('app/api/pagar/email/route.ts'), /`El mail de acceso no salió/);
  assert.match(fuente('app/api/pagar/email/route.ts'), /`\$\{PREFIJO_MAIL_NO_SALIO\}: /);
});

test('⚠️ el aviso «Entró un pago» dice que el mail no salió, y {{pago_alta}} también', () => {
  const linea = bloque(COBROS, 'function lineaDelAlta(');
  const iSin = linea.indexOf("if (estado === 'hecha' && sinMail) return");
  const iCon = linea.indexOf("if (estado === 'hecha') return");
  assert.ok(iSin > 0 && iCon > iSin, 'el caso sin mail va ANTES que «le llegó el acceso»');
  assert.match(linea.slice(iSin, iCon), /NO salió/);
  assert.equal(valoresDelPago({ monto: 47, moneda: 'USD', concepto: 'MaKo Esencial', proveedor: 'stripe', renovacion: false, modo: 'real', alta: 'hecha', altaSinMail: true }).pago_alta, 'Cuenta creada, sin mail de acceso');
  assert.equal(valoresDelPago({ monto: 47, moneda: 'USD', concepto: 'MaKo Esencial', proveedor: 'stripe', renovacion: false, modo: 'real', alta: 'hecha' }).pago_alta, 'Cuenta creada');
  assert.match(fuente('app/pagar/[token]/listo/page.tsx'), /mailSalio=\{!mailDeAccesoNoSalio\(c\.alta_motivo\)\}/);
  assert.match(fuente('app/pagar/[token]/listo/AccesoMako.tsx'), /\{mailSalio \|\| aviso\n\s*\? <p>Te mandamos el acceso a/);
});

// ── 7 · Un alta cortada se termina con su propia cuenta ────────────────────

test('⚠️ un alta cortada que se reintenta termina con la cuenta que creó, y una segunda compra sigue siendo «Ya tenía cuenta»', () => {
  const alta = bloque(COBROS, 'async function altaSiCorresponde(');
  const iPropia = alta.indexOf('const propia = await cuentaDeUnAltaCortada(c, plataforma)');
  const iYa = alta.indexOf("alta_estado: 'ya_tenia_cuenta'");
  assert.ok(iPropia > 0 && iYa > iPropia, 'se mira la propia ANTES de dar «ya tenía cuenta»');
  const cortada = bloque(COBROS, 'async function cuentaDeUnAltaCortada(');
  assert.match(cortada, /u\.invitado_por !== `pago:\$\{c\.proveedor\}` \|\| u\.workspace_id == null \|\| u\.rol_ws !== 'admin'/);
  assert.match(cortada, /Date\.parse\(u\.created_at\) >= Date\.parse\(c\.created_at\)/, 'nació después del cobro');
  assert.match(cortada, /\.eq\('alta_ws', u\.workspace_id\)\.neq\('id', c\.id\)/, 'ningún otro cobro la tiene como suya');
});

// ── 8 · «Darle el plan a su cuenta» ────────────────────────────────────────

test('⚠️ atar un «Ya tenía cuenta» exige que el email sea el ADMIN de un negocio ajeno a la plataforma y sin otro cobro', () => {
  const atar = bloque(COBROS, 'export async function atarCobroASuCuenta(');
  assert.match(atar, /c\.estado !== 'pagado' \|\| c\.alta_estado !== 'ya_tenia_cuenta'/);
  assert.match(atar, /if \(!esCapaVendible\(c\.alta_capa\)\)/, 'nunca la capa de la plataforma');
  assert.match(atar, /if \(u\.workspace_id === plataforma\)/);
  assert.match(atar, /if \(u\.rol_ws !== 'admin'\)/, 'el equipo de otro negocio no se ata solo');
  assert.match(atar, /\.eq\('alta_ws', u\.workspace_id\)\.neq\('id', c\.id\)/);
  assert.match(bloque(ACCIONES, 'export async function atarCobroMakoAction('), /if \(!admin\) return \{ ok: false, resumen: NO_ADMIN \};/);
});

// ── 9 · El precio en pesos de cada plan ────────────────────────────────────

test('⚠️ el precio local se guarda con TODOS los planes, leídos de forma estricta y validados de vuelta', () => {
  const g = bloque(COMPRA, 'export async function guardarPrecioLocal(');
  assert.match(g, /planesDeSetting\(await getSettingEstricto\(CLAVE_PLANES\)\)/, 'con getSetting un error se leía como «no hay setting» y se pisaban los planes');
  const iValida = g.indexOf('const releido = planesDeSetting(json);');
  const iEscribe = g.indexOf('await setSetting(CLAVE_PLANES, json);');
  assert.ok(iValida > 0 && iEscribe > iValida, 'se valida antes de escribir');
  assert.match(g, /m === 'USD'/, 'el precio en dólares es el del plan, no un precio local');
  assert.match(bloque(ACCIONES, 'export async function guardarPrecioLocalAction('), /if \(!admin\) return \{ ok: false, error: NO_ADMIN \};/);
});

// =============================================================================
// PROBADO ROMPIÉNDOLO (23/10/2026), una rotura por vez con un script que reemplaza en el fuente, corre y restaura byte a
// byte. Con el código como está: 12 pases, 0 fallos. Cada rotura da 11 / 1:
//   · reembolsar sigue y devuelve aunque el corte falle      · «viva» sin el primer pago devuelto
//   · la casilla «Cortar también» desmarcada                  · /planes ofrece la pasarela de prueba a todos
//   · la ruta del checkout con prueba para cualquiera         · Stripe acepta una clave de prueba sobre la real
//   · la dirección del aviso de MP sin ?u=                    · la guía de la rk_ sin Coupons
//   · el aviso de la venta sin el caso «el mail no salió»     · {{pago_alta}} sin el caso sin mail
//   · /listo prometiendo siempre el mail                      · el alta cortada sin mirar su propia cuenta
//   · la cuenta propia sin exigir que nació después del cobro · «Darle el plan» sin exigir que sea el admin
//   · el precio local leído con getSetting                    · el reenvío con el prefijo escrito suelto
// =============================================================================
