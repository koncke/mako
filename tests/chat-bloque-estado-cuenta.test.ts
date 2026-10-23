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
//      (/api/extract-receipt: lo guarda en la cuota y llena monto, fecha y hora para revisar), y SÓLO para su cuota;
//   3. ⚠️ (21/10/2026, revisión adversarial) el comprobante va atado al lead y al pedido (`comprobanteDelPedido`): UN
//      archivo, que el modelo dice que es de ESTE lead, cuando toca cobrar una cuota, y que otro lead del mismo mensaje
//      no tomó; el saneo exige su cuota;
//   4. `cobranza_lead` dibuja sólo en el chat de la app, con los archivos del mensaje que le pasa el turno, y le dice al
//      modelo qué pasó con el archivo (con comprobante, no propone `marcar_pago_cobrado`; sin saber de quién es, pregunta);
//   5. (revisión de 1b6fc9ad8, baja) el comprobante se lee con la moneda del negocio YA CARGADA: `useMonedaDelNegocio`
//      empezaba en 'USD' y el del chat se leía al abrir con ésa.
// Sin DOM en los tests de la casa (docs/hallazgos-infra.md): lo que corre en un efecto (bajar el archivo, leerlo) se fija
// en el fuente; lo demás se DIBUJA en un node aparte (tests/_bloques-pagos-hijo.ts).
//
// Probado rompiéndolo (20/10/2026 y 21/10/2026, una rotura por vez, restaurando byte a byte): los números, en ROTURAS al
// final.
//
// Correr: node --import tsx --test tests/chat-bloque-estado-cuenta.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bloqueEstadoDeCuenta, comprobanteDelPedido, notaEnPantalla } from '../lib/pagos-bloque';
import { sanearBloque, type BloqueEstadoCuenta } from '../lib/chat-bloques';
import { bloqueDef } from '../lib/ficha/catalogo';
import { porId } from '../lib/api-mako/registro';
import { comprobanteParaCuota, type ComprobanteDelChat } from '../app/crm/lead-view/ficha/pagos/comprobante-del-chat';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const desescapar = (s: string) => s.replace(/&quot;/g, '"').replace(/&amp;/g, '&');

type Pieza = { leadId: number; lista: unknown; comprobante: { nombre: string; pagoId: number } | null };
/** El bloque dibujado en el hijo, y lo que recibió la pieza de la tab (el lead, los bloques y el comprobante). */
function dibujar(b: BloqueEstadoCuenta): { html: string; pieza: Pieza } {
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
const COBRAR_11 = { tipo: 'cobrar-cuota', pagoId: 11 };

test('1. lo que se dibuja ES la pieza de la tab Pagos, con la lectura de la ficha y sin una cuenta propia', () => {
  const { html, pieza } = dibujar(bloqueEstadoDeCuenta(LEAD, null));
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

test('2. ⚠️ el comprobante llega a «Marcar pagada» SÓLO para su cuota, impaga: al volver del historial no va a la siguiente', () => {
  const comp = { ...RECIBO, pagoId: 11 };
  const { pieza } = dibujar(bloqueEstadoDeCuenta(LEAD, comp));
  assert.deepEqual(pieza.comprobante, { nombre: 'recibo.jpg', pagoId: 11 }, 'la pieza de la tab recibe el comprobante, con su cuota');

  // La regla, con lo que vuelve del historial: el bloque guardado (saneado) trae la cuota 11.
  const guardado = sanearBloque(JSON.parse(JSON.stringify(bloqueEstadoDeCuenta(LEAD, comp)))) as BloqueEstadoCuenta;
  assert.equal(guardado.comprobante?.pagoId, 11);
  const c: ComprobanteDelChat = { nombre: 'recibo.jpg', pagoId: 11, leer: async () => new File([], 'recibo.jpg') };
  assert.equal(comprobanteParaCuota(c, { id: 11, pagado: false }), c, 'la cuota a la que va');
  assert.equal(comprobanteParaCuota(c, { id: 11, pagado: true }), null, 'cobrada ésa, ya se usó');
  assert.equal(comprobanteParaCuota(c, { id: 12, pagado: false }), null, 'la cuota SIGUIENTE no recibe el recibo viejo');
  assert.equal(comprobanteParaCuota(null, { id: 11, pagado: false }), null);
  assert.equal(comprobanteParaCuota(c, null), null);

  const cobrar = sinComentarios(leer('app/crm/lead-view/ficha/pagos/cobrar.tsx'));
  assert.match(cobrar, /const delChat = useContext\(ComprobanteDelChatCtx\);/);
  assert.match(cobrar, /const comprobantePara = \(q: Pago \| null\) => comprobanteParaCuota\(delChat, q\);/);
  assert.match(cobrar, /setAbierto\(pasarelas\.length && !comprobantePara\(q\) \? \{ que: 'elegir', cuota: q \} : \{ que: 'marcar', cuota: q \}\)/, 'con SU comprobante ya pagó: no se ofrece el link');
  assert.match(cobrar, /<MarcarPagada cuota=\{q\} leadId=\{lead\.id\} monedaNegocio=\{moneda\} hoy=\{ctx\.hoy\} comprobante=\{comprobantePara\(q\)\}/);
  assert.doesNotMatch(cobrar, /comprobante=\{(comprobante|delChat)\}/, 'nunca el del chat sin mirar la cuota');
  // La nota de que lo va a leer: junto al botón, sólo si el botón es cobrar SU cuota.
  assert.match(cobrar, /comprobanteDe: \(a: AccionDeCobro \| null\) => \(a\?\.tipo === 'cobrar-cuota' \? comprobantePara\(cuotaPorId\(a\.pagoId\)\) : null\),/);
  const tab = sinComentarios(leer('app/crm/lead-view/ficha/pagos/bloques-cobro.tsx'));
  assert.match(tab, /const delChat = cobrar\.comprobanteDe\(e\.accion\);/);
  assert.match(tab, /Al cobrar la cuota leo \{delChat\.nombre\}: queda listo para revisar y guardar\./);
  // El hilo ya no lleva una marca en memoria ni promete por su cuenta.
  const hilo = sinComentarios(leer('app/_chat/bloques/EstadoCuentaHilo.tsx'));
  assert.doesNotMatch(hilo, /useState|setUsado|Al cobrar la cuota leo/);
  assert.match(hilo, /pagoId: archivo\.pagoId,/);
  assert.match(hilo, /<ComprobanteDelChatCtx\.Provider value=\{comprobante\}>/);

  // «Marcar pagada»: el MISMO `subir` que el botón «Subir el comprobante», una vez al abrir.
  // Sin quitar comentarios: el `accept=".pdf,image/*"` del input abre un «/*» que se comería el botón.
  const modal = leer('app/crm/lead-view/ficha/pagos/piezas.tsx');
  const marcar = modal.slice(modal.indexOf('export function MarcarPagada('), modal.indexOf('export function RegistrarPago('));
  assert.match(marcar, /comprobante\.leer\(\)\.then\(\(f\) => subir\(f, monedaNegocio\)/);
  assert.match(marcar, /onClick=\{\(\) => archivo\.current\?\.click\(\)\}>Subir el comprobante<\/Button>/);
  assert.match(marcar, /await fetch\('\/api\/extract-receipt', \{ method: 'POST', body: fd \}\)/);
  assert.match(marcar, /if \(!comprobante \|\| delChat\.current \|\| monedaNegocio == null\) return;\s*delChat\.current = true;/, 'se lee una sola vez al abrir');
});

test('5. ⚠️ el comprobante se lee con la moneda del negocio YA CARGADA, nunca con la del primer render', () => {
  // La moneda es null mientras no llega (antes empezaba en 'USD'): quien lee algo con ella, espera.
  const datos = sinComentarios(leer('app/crm/lead-view/ficha/pagos/datos.ts'));
  assert.match(datos, /export function useMonedaDelNegocio\(\): string \| null \{\s*const \[moneda, setMoneda\] = useState<string \| null>\(null\);/);
  assert.match(datos, /\.catch\(\(\) => \{ if \(vivo\) setMoneda\('USD'\); \}\)/, 'si no se puede leer, la de siempre (y el comprobante se lee igual)');
  const modal = leer('app/crm/lead-view/ficha/pagos/piezas.tsx');
  const marcar = modal.slice(modal.indexOf('export function MarcarPagada('), modal.indexOf('export function RegistrarPago('));
  // El del chat: el efecto espera la moneda y la pasa (no la del render en que se abrió).
  assert.match(marcar, /\}, \[comprobante, monedaNegocio\]\);/);
  assert.match(marcar, /const subir = async \(file: File, moneda: string\) => \{/);
  assert.match(marcar, /const p = plataDeRecibo\(j, moneda, valorUsd\);/);
  assert.doesNotMatch(marcar, /plataDeRecibo\(j, monedaNegocio/);
  // «Subir el comprobante» a mano tampoco sale antes de saberla.
  assert.match(marcar, /loading=\{leyendo \|\| monedaNegocio == null\} onClick=\{\(\) => archivo\.current\?\.click\(\)\}>Subir el comprobante/);
  assert.match(marcar, /if \(f && monedaNegocio != null\) void subir\(f, monedaNegocio\);/);
  // Lo que todavía no se sabe se muestra como USD (los campos), pero no se lee nada con eso.
  assert.match(sinComentarios(leer('app/crm/lead-view/ficha/pagos/cobrar.tsx')), /<RegistrarPago leadId=\{lead\.id\} crm=\{crm\} monedaNegocio=\{moneda \?\? 'USD'\}/);
});

test('3. ⚠️ el comprobante va atado al lead y al pedido: uno, de ESTE lead, para cobrar una cuota, y de un solo lead', () => {
  const uno = [RECIBO];
  // El caso bueno: un archivo, el modelo dice que es de este lead, toca cobrar la cuota 11.
  const bien = comprobanteDelPedido({ adjuntos: uno, lead: LEAD, esSuyo: true, accion: COBRAR_11 });
  assert.deepEqual(bien, { comprobante: { ...RECIBO, pagoId: 11 }, sin: null });
  assert.deepEqual(bloqueEstadoDeCuenta(LEAD, bien.comprobante).comprobante, { ...RECIBO, pagoId: 11 });
  // Un turno que se re-arranca lo vuelve a pedir para el MISMO lead: lo vuelve a tomar.
  assert.equal(comprobanteDelPedido({ adjuntos: uno, lead: LEAD, esSuyo: true, accion: COBRAR_11 }).comprobante?.pagoId, 11);
  // «Juan pagó, acá el comprobante. ¿Y cómo está Pedro?»: el de Juan no va a Pedro, aunque el modelo se equivoque.
  const pedro = comprobanteDelPedido({ adjuntos: uno, lead: { id: 20, nombre: 'Pedro' }, esSuyo: true, accion: { tipo: 'cobrar-cuota', pagoId: 33 } });
  assert.deepEqual(pedro, { comprobante: null, sin: 'de-otro-lead', de: 'Francisco (prueba de Pagos)' });
  // Otro mensaje (otra lista de archivos): no hereda el dueño del anterior.
  assert.equal(comprobanteDelPedido({ adjuntos: [{ ...RECIBO }], lead: { id: 20, nombre: 'Pedro' }, esSuyo: true, accion: { tipo: 'cobrar-cuota', pagoId: 33 } }).comprobante?.pagoId, 33);
  // Sin decir que es de este lead (el contrato, o no se sabe de quién es): no va.
  assert.deepEqual(comprobanteDelPedido({ adjuntos: [RECIBO], lead: LEAD, esSuyo: false, accion: COBRAR_11 }), { comprobante: null, sin: 'no-es-suyo' });
  // Lo que toca no es cobrar una cuota (registrar el mes, el pago suelto): no se promete.
  for (const accion of [{ tipo: 'registrar-mes' }, { tipo: 'registrar-pago' }, null]) {
    assert.deepEqual(comprobanteDelPedido({ adjuntos: [RECIBO], lead: LEAD, esSuyo: true, accion }), { comprobante: null, sin: 'no-es-cobrar' }, JSON.stringify(accion));
  }
  // Con dos archivos no se adivina; sin archivos, nada. Pero si lo pidió para este lead y el archivo no vino en ESTE
  // mensaje (la respuesta a «¿es su comprobante?» llega sin él), se dice, para que pida volver a adjuntarlo (21/10/2026).
  assert.deepEqual(comprobanteDelPedido({ adjuntos: [RECIBO, { ...RECIBO, ref: '501:1' }], lead: LEAD, esSuyo: true, accion: COBRAR_11 }), { comprobante: null, sin: 'varios' });
  assert.deepEqual(comprobanteDelPedido({ adjuntos: undefined, lead: LEAD, esSuyo: true, accion: COBRAR_11 }), { comprobante: null, sin: 'sin-archivo' });
  assert.deepEqual(comprobanteDelPedido({ adjuntos: [], lead: LEAD, esSuyo: false, accion: COBRAR_11 }), { comprobante: null, sin: null });
  assert.equal(bloqueEstadoDeCuenta({ id: 9, nombre: null }, null).nombre, 'Lead 9');

  // El saneo: la ref, el tipo y AHORA la cuota.
  const b = bloqueEstadoDeCuenta(LEAD, { ...RECIBO, pagoId: 11 });
  assert.deepEqual(sanearBloque(b), b);
  for (const ref of ['../x', '/api/x', '501', '501:10', '0:1', 'https://otro.com/a.jpg']) {
    assert.equal(sanearBloque({ ...b, comprobante: { ...RECIBO, pagoId: 11, ref } }), null, `ref «${ref}»`);
  }
  assert.equal(sanearBloque({ ...b, comprobante: { ...RECIBO, pagoId: 11, tipo: 'video' } }), null);
  // Uno guardado antes del 21/10 (sin cuota), o con una cuota que no es un id: el bloque queda, el comprobante no.
  for (const pagoId of [undefined, 0, -3, '11', 1.5]) {
    assert.deepEqual(sanearBloque({ ...b, comprobante: { ...RECIBO, pagoId } }), { t: 'estado_cuenta', leadId: 2739, nombre: LEAD.nombre }, `pagoId ${JSON.stringify(pagoId)}`);
  }
  assert.equal(sanearBloque({ ...b, leadId: 0 }), null);
  assert.deepEqual(sanearBloque({ t: 'estado_cuenta', leadId: 7, nombre: 'Ana' }), { t: 'estado_cuenta', leadId: 7, nombre: 'Ana' });
});

test('4. `cobranza_lead` dibuja sólo en la app y le dice al modelo qué pasó con el archivo', () => {
  const run = sinComentarios(leer('lib/api-mako/areas/crm.run.ts'));
  const cl = run.slice(run.indexOf('cobranza_lead: {'), run.indexOf('insight_lead: {'));
  assert.match(cl, /const dibuja = !!ctx\.aDibujar;/);
  assert.match(cl, /comprobanteDelPedido\(\{ adjuntos: ctx\.adjuntos, lead, esSuyo: input\.comprobante === true, accion: /, 'el modelo dice de quién es');
  assert.ok(cl.indexOf('const accion = ') < cl.indexOf('comprobanteDelPedido('), 'la acción que toca, antes de atar el comprobante');
  // (21/10/2026, segunda revisión: lo que se le dice al modelo va por `siSeDibuja`, SÓLO si el bloque entró en el mensaje.)
  assert.match(cl, /return dibuja \? \{ content: contenido, bloque: bloqueEstadoDeCuenta\(lead, delPedido\.comprobante\), siSeDibuja: notaEnPantalla\(delPedido\) \} : contenido;/, 'fuera de la app, la salida de siempre');
  assert.doesNotMatch(cl, /en_pantalla/, 'no va adentro de lo que se lee siempre');
  assert.doesNotMatch(cl, /ctx\.adjuntos\?\.length === 1/, 'ya no basta con que venga un archivo');
  // El parámetro, en la definición: el modelo lo pasa sólo si el archivo es de ESTE lead; si no, pregunta.
  const p = porId('cobranza_lead')?.parametros.find((x) => x.nombre === 'comprobante');
  assert.equal(p?.tipo, 'boolean');
  assert.match(String(p?.descripcion), /ESTE lead.*pregúntale/);
  // Lo que se le dice al modelo, según el caso.
  const con = notaEnPantalla({ comprobante: { ...RECIBO, pagoId: 11 }, sin: null });
  assert.match(con, /NO propongas marcar_pago_cobrado/);
  assert.match(notaEnPantalla({ comprobante: null, sin: 'no-es-suyo' }), /pregúntale antes de marcar nada/);
  assert.match(notaEnPantalla({ comprobante: null, sin: 'de-otro-lead', de: 'Juan' }), /ya quedó como comprobante de Juan/);
  assert.match(notaEnPantalla({ comprobante: null, sin: 'sin-archivo' }), /en ESTE mensaje no vino ningún archivo .* pídele que lo adjunte de nuevo/);
  assert.match(notaEnPantalla({ comprobante: null, sin: 'no-es-suyo' }), /que lo vuelva a adjuntar con la respuesta/, 'preguntar sin pedir el archivo no tiene salida');
  for (const sin of ['no-es-cobrar', 'varios', null] as const) {
    assert.doesNotMatch(notaEnPantalla({ comprobante: null, sin }), /comprobante|NO propongas/, `sin «${sin}»: el camino de siempre`);
  }
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
// (21/10/2026: «el comprobante se reusa» dejó de existir como rotura: la marca en memoria no sobrevivía una recarga y se
//  fue; lo que lo frena ahora es la cuota, en las roturas de abajo.)
//
// ROTURAS de la revisión de los bloques (21/10/2026). Base: 4 pases, 0 fallos. Rota (pases / fallos):
//   · el comprobante va a cualquier cuota (sin mirar su pagoId)                       → 3 / 1 (2)
//   · el comprobante va a su cuota aunque ya esté cobrada                             → 3 / 1 (2)
//   · «Marcar pagada» recibe el del chat sin mirar la cuota                           → 3 / 1 (2)
//   · la nota promete leerlo con cualquier botón                                       → 3 / 1 (2)
//   · el comprobante va aunque el modelo no diga que es de este lead                   → 3 / 1 (3)
//   · el comprobante va aunque no toque cobrar una cuota                              → 3 / 1 (3)
//   · el mismo archivo va a dos leads del mismo mensaje                               → 3 / 1 (3)
//   · el saneo deja el comprobante sin su cuota                                       → 3 / 1 (3)
//   · `cobranza_lead` toma el archivo como suyo siempre                               → 3 / 1 (4)
//   · sin saber de quién es, no le dice que pregunte                                  → 3 / 1 (4)
//   · la herramienta sin el parámetro `comprobante`                                   → 3 / 1 (4)
//
// ROTURAS de la segunda revisión (21/10/2026). Base: 4 pases, 0 fallos. Rota (pases / fallos):
//   · la nota de `cobranza_lead` va aunque el bloque no entre                         → 3 / 1 (4)
//   · sin archivo en el mensaje, no lo dice                                           → 3 / 1 (3)
//   · preguntar sin pedir que vuelva a adjuntarlo                                     → 3 / 1 (4)
//
// ROTURAS de la revisión de 1b6fc9ad8 (21/10/2026, la baja de la moneda). Base: 5 pases, 0 fallos. Rota (pases / fallos):
//   · la moneda del negocio vuelve a empezar en 'USD'                                 → 4 / 1 (5)
//   · el comprobante del chat no espera la moneda                                     → 4 / 1 (2)
//   · el efecto sólo depende del comprobante                                          → 4 / 1 (5)
//   · `subir` lee con la moneda del render                                            → 4 / 1 (5)
//   · «Subir el comprobante» antes de saber la moneda                                 → 4 / 1 (5)
//   · si la lectura de la moneda falla, nunca se sabe (el del chat no se lee nunca)   → 4 / 1 (5)
