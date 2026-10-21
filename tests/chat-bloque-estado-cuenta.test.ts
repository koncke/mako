// =============================================================================
// El estado de cuenta del lead en el hilo con MaKo, y el comprobante adjunto (20/10/2026, Ops Center = lo principal,
// la 2.28, Pagos)
// =============================================================================
// docs/ops-center-principal.md: «Muestra lo mismo que la tab Pagos (un test lo compara); una foto del comprobante deja la
// tarjeta lista para corregir y confirmar». Lo que se fija:
//   1. lo que se dibuja ES la pieza de la tab Pagos: el bloque «Estado de cuenta» (`cobrado`, con el diseño de la tab)
//      montado con la lectura de la ficha (`BloquesDePagos` → `getLeadFullAction` → `Armador tab="pagos"`), sin una
//      cuenta propia; y lo que lee MaKo (`cobranza_lead`) sale de las MISMAS dos funciones que la pieza;
//   2. el comprobante del mensaje le llega a «Marcar pagada», que lo lee solo con el camino de «Subir el comprobante»
//      (/api/extract-receipt: lo guarda en la cuota y llena monto, fecha y hora para revisar), y se usa UNA vez;
//   3. el bloque: el comprobante sólo con UN archivo en el mensaje, y su `ref` se sanea;
//   4. `cobranza_lead` dibuja sólo en el chat de la app, con los archivos del mensaje que le pasa el turno, y con un
//      comprobante le dice al modelo que no proponga `marcar_pago_cobrado` (la marca la revisa la persona en la pieza).
// Sin DOM en los tests de la casa (docs/hallazgos-infra.md): lo que corre en un efecto (bajar el archivo, leerlo) se fija
// en el fuente; lo demás se DIBUJA en un node aparte (tests/_bloques-pagos-hijo.ts).
//
// Probado rompiéndolo (20/10/2026, una rotura por vez, restaurando byte a byte): los números, en ROTURAS al final.
//
// Correr: node --import tsx --test tests/chat-bloque-estado-cuenta.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bloqueEstadoDeCuenta } from '../lib/pagos-bloque';
import { sanearBloque, type BloqueEstadoCuenta } from '../lib/chat-bloques';
import { bloqueDef } from '../lib/ficha/catalogo';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const desescapar = (s: string) => s.replace(/&quot;/g, '"').replace(/&amp;/g, '&');

/** El bloque dibujado en el hijo, y lo que recibió la pieza de la tab (el lead, los bloques y el comprobante). */
function dibujar(b: BloqueEstadoCuenta): { html: string; pieza: { leadId: number; lista: unknown; comprobante: string | null } } {
  const out = execFileSync(process.execPath, ['--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', join(RAIZ, 'tests/_bloques-pagos-hijo.ts'), JSON.stringify(b)], {
    cwd: RAIZ, encoding: 'utf8', timeout: 120_000,
  });
  const html = (JSON.parse(out) as { hilo: string }).hilo;
  const props = /data-pieza="BloquesDePagos" data-props="([^"]*)"/.exec(html);
  assert.ok(props, 'no se montó la pieza de la tab Pagos');
  return { html, pieza: JSON.parse(desescapar(props[1])) };
}

const LEAD = { id: 2739, nombre: 'Francisco (prueba de Pagos)' };
const RECIBO = { ref: '501:0', nombre: 'recibo.jpg', tipo: 'image' as const };

test('1. lo que se dibuja ES la pieza de la tab Pagos, con la lectura de la ficha y sin una cuenta propia', () => {
  const { html, pieza } = dibujar(bloqueEstadoDeCuenta(LEAD, []));
  // El bloque «Estado de cuenta» de la tab, con SU diseño de entrada, a todo el ancho del bloque del chat.
  const def = bloqueDef('cobrado');
  assert.ok(def && def.tab === 'pagos', 'el «Estado de cuenta» es un bloque de la tab Pagos');
  assert.deepEqual(pieza.lista, [{ id: 'cobrado', ancho: 12, diseno: def.disenos[0].id }]);
  assert.equal(pieza.leadId, 2739);
  assert.equal(pieza.comprobante, null);
  assert.match(html, /<p class="ch-bloque__titulo">Francisco \(prueba de Pagos\)<\/p>/);
  assert.match(html, /<a class="ch-abrir" href="\/crm\/2739\?tab=pagos">Abrir la ficha<\/a>/);
  assert.doesNotMatch(html, /Al cobrar la cuota leo/, 'sin comprobante no lo promete');

  // `BloquesDePagos` es el montaje de Clients: la lectura de la ficha y su armador, no otra cuenta.
  const montaje = sinComentarios(leer('app/customer-success/PagosCliente.tsx'));
  assert.match(montaje, /export function BloquesDePagos\(/);
  assert.match(montaje, /getLeadFullAction\(leadId\)/);
  assert.match(montaje, /<Armador tab="pagos" lista=\{lista\} ctx=\{ctx\}/);
  const hilo = sinComentarios(leer('app/_chat/bloques/EstadoCuentaHilo.tsx'));
  assert.doesNotMatch(hilo, /pagos-vistazo|cobrado-lead|estadoDeCuenta|cobradoDelLead/, 'el chat no calcula su propio estado de cuenta');

  // Lo que MaKo LEE para contestar sale de las mismas dos funciones que dibuja la pieza: no puede decir otra cosa.
  const tab = sinComentarios(leer('app/crm/lead-view/ficha/pagos/bloques-cobro.tsx'));
  assert.match(tab, /const cobrado = cobradoDelLead\(\{/);
  assert.match(tab, /const leido = estadoDeCuenta\(\{ cobrado, pagos: ctx\.data\.pagos, ganado: ganado\(ctx\), hoy: ctx\.hoy \}\);/);
  const run = sinComentarios(leer('lib/api-mako/areas/crm.run.ts'));
  const cl = run.slice(run.indexOf('cobranza_lead: {'), run.indexOf('insight_lead: {'));
  assert.match(cl, /const cob = cobradoDelLead\(\{/);
  assert.match(cl, /const e = estadoDeCuenta\(\{ cobrado: cob, pagos: plan\.pagos, ganado: lead\.estado_lead === 'ganado', hoy \}\);/);
});

test('2. el comprobante del mensaje llega a «Marcar pagada», que lo lee solo con el camino de la ficha, UNA vez', () => {
  const { html, pieza } = dibujar(bloqueEstadoDeCuenta(LEAD, [RECIBO]));
  assert.equal(pieza.comprobante, 'recibo.jpg', 'la pieza de la tab recibe el comprobante del chat');
  assert.match(html, /Al cobrar la cuota leo recibo\.jpg: queda listo para revisar y guardar\./);

  const cobrar = sinComentarios(leer('app/crm/lead-view/ficha/pagos/cobrar.tsx'));
  assert.match(cobrar, /const comprobante = useContext\(ComprobanteDelChatCtx\);/);
  assert.match(cobrar, /setAbierto\(pasarelas\.length && !comprobante \? \{ que: 'elegir', cuota: q \} : \{ que: 'marcar', cuota: q \}\)/, 'con el comprobante ya pagó: no se ofrece el link');
  assert.match(cobrar, /<MarcarPagada cuota=\{q\} leadId=\{lead\.id\} monedaNegocio=\{moneda\} hoy=\{ctx\.hoy\} comprobante=\{comprobante\}/);
  // Sin quitar comentarios: el `accept=".pdf,image/*"` del input abre un «/*» que se comería el botón.
  const modal = leer('app/crm/lead-view/ficha/pagos/piezas.tsx');
  const marcar = modal.slice(modal.indexOf('export function MarcarPagada('), modal.indexOf('export function RegistrarPago('));
  // El MISMO `subir` que el botón «Subir el comprobante»: lo guarda en la cuota y llena el formulario, que se revisa.
  assert.match(marcar, /comprobante\.leer\(\)\.then\(\(f\) => subir\(f\)/);
  assert.match(marcar, /onClick=\{\(\) => archivo\.current\?\.click\(\)\}>Subir el comprobante<\/Button>/);
  assert.match(marcar, /await fetch\('\/api\/extract-receipt', \{ method: 'POST', body: fd \}\)/);
  assert.match(marcar, /if \(!comprobante \|\| delChat\.current\) return;\s*delChat\.current = true;/, 'se lee una sola vez al abrir');
  // Se usa UNA vez: leído, el bloque deja de pasarlo (el siguiente cobro no le sube ese archivo a otra cuota).
  const hilo = sinComentarios(leer('app/_chat/bloques/EstadoCuentaHilo.tsx'));
  assert.match(hilo, /\(!archivo \|\| usado \? null : \{/);
  assert.match(hilo, /const blob = await r\.blob\(\);\s*setUsado\(true\);/);
  assert.match(hilo, /<ComprobanteDelChatCtx\.Provider value=\{comprobante\}>/);
});

test('3. el bloque: el comprobante sólo con UN archivo en el mensaje, y su ref se sanea', () => {
  assert.deepEqual(bloqueEstadoDeCuenta(LEAD, [RECIBO]).comprobante, RECIBO);
  assert.equal(bloqueEstadoDeCuenta(LEAD, [RECIBO, { ...RECIBO, ref: '501:1', nombre: 'otro.pdf', tipo: 'document' }]).comprobante, undefined, 'con dos no se adivina');
  assert.equal(bloqueEstadoDeCuenta(LEAD, undefined).comprobante, undefined);
  assert.equal(bloqueEstadoDeCuenta({ id: 9, nombre: null }, []).nombre, 'Lead 9');
  const b = bloqueEstadoDeCuenta(LEAD, [RECIBO]);
  assert.deepEqual(sanearBloque(b), b);
  for (const ref of ['../x', '/api/x', '501', '501:10', '0:1', 'https://otro.com/a.jpg']) {
    assert.equal(sanearBloque({ ...b, comprobante: { ...RECIBO, ref } }), null, `ref «${ref}»`);
  }
  assert.equal(sanearBloque({ ...b, comprobante: { ...RECIBO, tipo: 'video' } }), null);
  assert.equal(sanearBloque({ ...b, leadId: 0 }), null);
  assert.deepEqual(sanearBloque({ t: 'estado_cuenta', leadId: 7, nombre: 'Ana' }), { t: 'estado_cuenta', leadId: 7, nombre: 'Ana' });
});

test('4. `cobranza_lead` dibuja sólo en la app, con los archivos que le pasa el turno; con comprobante, no propone la marca', () => {
  const run = sinComentarios(leer('lib/api-mako/areas/crm.run.ts'));
  const cl = run.slice(run.indexOf('cobranza_lead: {'), run.indexOf('insight_lead: {'));
  assert.match(cl, /const dibuja = !!ctx\.aDibujar;/);
  assert.match(cl, /return dibuja \? \{ content: contenido, bloque: bloqueEstadoDeCuenta\(lead, ctx\.adjuntos\) \} : contenido;/);
  assert.match(cl, /const conComprobante = dibuja && ctx\.adjuntos\?\.length === 1;/, 'la misma regla que el bloque: un solo archivo');
  assert.match(cl, /NO propongas marcar_pago_cobrado/);
  assert.match(cl, /\.\.\.\(dibuja \? \{ en_pantalla: enPantalla \} : \{\}\),/, 'fuera de la app, la salida de siempre');
  const turno = sinComentarios(leer('lib/mako-turno-app.ts'));
  assert.match(turno, /adjuntos: conArchivos\.map\(\(\{ ref, nombre, tipo \}\) => \(\{ ref, nombre, tipo \}\)\),/);
  assert.match(sinComentarios(leer('app/_chat/BloqueHilo.tsx')), /if \(b\.t === 'estado_cuenta'\) return <EstadoCuentaHilo b=\{b\} \/>;/);
});

// ROTURAS (20/10/2026). Base: 4 pases, 0 fallos. Rota (pases / fallos):
//   · el chat monta el bloque con el ancho de la ficha (6 de 12: media burbuja)        → 3 / 1 (1)
//   · el chat calcula su propio estado de cuenta (importa `estadoDeCuenta`)            → 3 / 1 (1)
//   · sin el Provider: el comprobante no llega a la pieza de la tab                     → 3 / 1 (2)
//   · el comprobante se reusa (leído, no se marca usado)                                → 3 / 1 (2)
//   · con el comprobante igual ofrece mandar el link                                    → 3 / 1 (2)
//   · «Marcar pagada» no lee el comprobante del chat                                   → 3 / 1 (2)
//   · el bloque toma el primer archivo aunque vengan dos                                → 3 / 1 (3)
//   · el saneo deja pasar cualquier ref                                                 → 3 / 1 (3)
//   · `cobranza_lead` dibuja también fuera de la app                                    → 3 / 1 (4)
//   · el turno no le pasa los archivos del mensaje                                      → 3 / 1 (4)
// ⚠️ La primera corrida dio un rojo que no era del código: `sinComentarios` sobre piezas.tsx se comía el botón «Subir el
//    comprobante», porque el `accept=".pdf,image/*"` del input abre un «/*». Ese archivo se lee sin quitar comentarios.
