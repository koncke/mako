// QUIÉN MOVIÓ LA VOZ DE MaKo, Y DE QUÉ LÍNEA A CUÁL (13/11/2026).
//
// El 12/11 a las 17:38:22 UTC la voz pasó de mako_superadmin_muylqv8r (…2605) a mako_ws9 (…3479, el WhatsApp PERSONAL de
// Martín) con el botón «Usarlo para MaKo» de /agencia, y no quedó rastro de quién: la ruta pedía sesión de admin y no anotaba
// nada. El botón se queda (lo pidió Martín el 3/11) y deja rastro: cada cambio de la voz o del canal por /api/admin/mako-canal
// se anota (lib/registro-lineas-reglas.ts) y se ve en Admin › Analytics › Events, tipo «linea». docs/hallazgos-comunicacion.md.
//
// PROBADO ROMPIÉNDOLO (13/11/2026), cada rotura por separado y vuelta atrás:
//   R1 la ruta de antes (sin la foto ni el registro)                      → falla «la ruta anota»
//   R2 el registro sólo en el `try` (un pedido que tira no se anota)      → falla «la ruta anota»
//   R3 `cambioEntre` que anota aunque no cambie nada                      → falla «sin cambio, sin renglón»
//   R4 una foto que no se pudo leer cuenta como «sin cambio»             → falla «una foto sin leer»
//   R5 la voz en la línea de un cliente sin el rojo                       → falla «el evento del 12/11»
//   R6 el lector de eventos sin los cambios de línea                      → falla «el lector de Events los lee»
//
// Y EL MISMO DÍA (13/11): Martín decidió dejar la voz en su personal («Dejarla en mi personal»), así que ahí NO va en rojo; y
// re-vincular esa línea por QR la dejaba ignorando los grupos (`ignoraGrupos`, lib/evolution-sonda.ts):
//   R7 la personal de Martín vuelve a salir en rojo                       → fallan «su decisión» y «el evento del 12/11»
//   R8 setSettings con el groupsIgnore:true fijo de antes                 → falla «re-vincular la línea que es la voz»
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NO_SE_LEYO, SIN_PANTALLA, TOPE_REGISTRO_LINEAS, cambioEntre, conElCambio, describirLinea, instanciasDe, leerRegistroLineas,
  pantallaDelPedido, vozEnLineaAjena, vozEnSuPersonal, type CambioDeLinea,
} from '../lib/registro-lineas-reglas';
import { ignoraGrupos } from '../lib/evolution-sonda';
import { armarEventos, eventosDeCambiosDeLinea, tiposDeUrl, textoDeCorte, type EntradasEventos } from '../app/admin/_polar/datos/eventos';
import { fuenteSinComentarios } from './_fuente-sin-comentarios';

const CANAL = 'mako_superadmin_muylqv8r';
const ANTES = { voz: CANAL, canal: CANAL };
const DATOS = { at: '2026-11-12T17:38:22.000Z', quien: 'martinkoncke@gmail.com', accion: 'voz-personal', activar: true, pantalla: '/agencia' };

test('el cambio del 12/11: la voz del …2605 al …3479, con quién, qué botón y desde dónde', () => {
  const c = cambioEntre(ANTES, { voz: 'mako_ws9', canal: CANAL }, DATOS);
  assert.ok(c, 'el cambio de voz no quedó anotado');
  assert.deepEqual(c.voz, { de: CANAL, a: 'mako_ws9' });
  assert.equal(c.canal, null, 'el canal no se movió');
  assert.equal(c.quien, 'martinkoncke@gmail.com');
  assert.equal(c.pantalla, '/agencia');
  assert.equal(c.activar, true);
  assert.deepEqual(instanciasDe(c).sort(), [CANAL, 'mako_ws9'].sort());
});

test('la voz en el personal de Martín es su decisión, no una alarma; en la línea de un cliente, sí', () => {
  const c = cambioEntre(ANTES, { voz: 'mako_ws9', canal: CANAL }, DATOS)!;
  // 13/11/2026, Martín: «Dejarla en mi personal».
  assert.equal(vozEnSuPersonal({ ...c, personal: 'mako_ws9' }), true);
  assert.equal(vozEnLineaAjena({ ...c, personal: 'mako_ws9' }), false, 'su personal sale como alarma');
  const deUnCliente = cambioEntre(ANTES, { voz: 'mako_ws13', canal: CANAL }, DATOS)!;
  assert.equal(vozEnLineaAjena({ ...deUnCliente, personal: 'mako_ws9' }), true, 'la voz en la línea de un cliente no se marca');
  assert.equal(vozEnLineaAjena({ ...c, personal: null }), true, 'sin saber cuál es su personal, una línea de negocio se marca');
});

test('sin cambio, sin renglón: un botón que no movió nada no ensucia la lista', () => {
  assert.equal(cambioEntre(ANTES, { ...ANTES }, DATOS), null);
  const delCanal = cambioEntre(ANTES, { voz: CANAL, canal: `${CANAL}_2` }, { ...DATOS, accion: 'conectar' });
  assert.ok(delCanal && delCanal.voz === null && delCanal.canal?.a === `${CANAL}_2`, 'un cambio sólo del canal también se anota');
  const vuelta = cambioEntre({ voz: 'mako_ws9', canal: CANAL }, ANTES, { ...DATOS, accion: 'usar' });
  assert.equal(vuelta && vozEnLineaAjena(vuelta), false, 'volver a la línea de MaKo no es rojo');
});

test('una foto sin leer no es «sin cambio»: se anota igual', () => {
  const c = cambioEntre({ voz: NO_SE_LEYO, canal: CANAL }, { voz: 'mako_ws9', canal: CANAL }, DATOS);
  assert.ok(c, 'con la foto de antes sin leer, el cambio se perdió');
  assert.deepEqual(c.voz, { de: NO_SE_LEYO, a: 'mako_ws9' });
  assert.deepEqual(instanciasDe(c), ['mako_ws9'], 'no se le busca número a «(no se pudo leer)»');
});

test('la pantalla es la ruta del Referer, sin dominio ni parámetros', () => {
  assert.equal(pantallaDelPedido('https://hola-mako.com/agencia?ws=13'), '/agencia');
  assert.equal(pantallaDelPedido(null), SIN_PANTALLA);
  assert.equal(pantallaDelPedido('no es una url'), SIN_PANTALLA);
  assert.equal(pantallaDelPedido('https://hola-mako.com/'), SIN_PANTALLA);
});

test('la lista: lo nuevo primero, con tope, y un renglón roto no la voltea', () => {
  const c = cambioEntre(ANTES, { voz: 'mako_ws9', canal: CANAL }, DATOS)!;
  const roto = JSON.stringify([{ at: 'no es fecha' }, { at: '2026-11-01T00:00:00Z', voz: { de: 'a', a: 'a' } }, 'x']);
  assert.deepEqual(leerRegistroLineas(roto), [], 'lo roto o sin cambio se cae');
  assert.deepEqual(leerRegistroLineas('{no es json'), []);
  let raw: string | null = null;
  for (let i = 0; i < TOPE_REGISTRO_LINEAS + 5; i++) raw = conElCambio(raw, { ...c, at: new Date(Date.UTC(2026, 10, 1) + i * 60_000).toISOString() });
  const l = leerRegistroLineas(raw);
  assert.equal(l.length, TOPE_REGISTRO_LINEAS);
  assert.ok(l[0].at > l[l.length - 1].at, 'lo más nuevo va primero');
  assert.equal(l[0].quien, 'martinkoncke@gmail.com');
});

test('el evento del 12/11 en Admin › Events: dice quién, el botón, la pantalla y que es su número, sin rojo', () => {
  const numeros = { mako_ws9: '5490000003479', mako_ws13: '5490000001313', [CANAL]: '5490000002605' };
  const c: CambioDeLinea = { ...cambioEntre(ANTES, { voz: 'mako_ws9', canal: CANAL }, DATOS)!, numeros, personal: 'mako_ws9' };
  const [ev] = eventosDeCambiosDeLinea([c]);
  assert.equal(ev.nombre, 'linea');
  assert.equal(ev.label, 'La voz de MaKo pasó a tu número, mako_ws9 (…3479)');
  assert.equal(ev.persona, 'martinkoncke@gmail.com');
  assert.equal(ev.negativo, false, 'la voz en el personal de Martín sale en rojo: es su decisión');
  assert.deepEqual(ev.negocios, [], 'es de la plataforma, no de un negocio');
  const campo = (l: string) => ev.campos.find((x) => x.label === l)?.valor;
  assert.equal(campo('Botón'), '«Usarlo para MaKo» (tu número)');
  assert.equal(campo('Pantalla'), '/agencia');
  assert.equal(campo('Voz'), `${CANAL} (…2605) → tu número, mako_ws9 (…3479)`);
  assert.equal(campo('Canal'), undefined);
  const [ajena] = eventosDeCambiosDeLinea([{ ...cambioEntre(ANTES, { voz: 'mako_ws13', canal: CANAL }, DATOS)!, numeros, personal: 'mako_ws9' }]);
  assert.equal(ajena.negativo, true, 'la voz en la línea de un cliente no va en rojo');
  assert.equal(ajena.label, 'La voz de MaKo pasó a mako_ws13 (…1313)');
  assert.equal(describirLinea('mako_ws9', {}), 'mako_ws9', 'sin número, la instancia sola');
  assert.deepEqual(tiposDeUrl('voz'), ['linea']);
});

test('re-vincular la línea que es la voz le deja los grupos abiertos; las demás los ignoran', () => {
  // 13/11/2026: el QR de «Tu número» pasaba por `conectar` → `setSettings`, que le ponía groupsIgnore:true a la voz (…3479).
  assert.equal(ignoraGrupos('mako_ws9', 'mako_ws9'), false, 'la voz quedó ignorando los grupos: MaKo no oye a nadie');
  assert.equal(ignoraGrupos('mako_ws13', 'mako_ws9'), true, 'la línea de un cliente dejó de ignorar los grupos');
  assert.equal(ignoraGrupos('mako_ws9', null), true);
  assert.equal(ignoraGrupos('mako_ws9', undefined), true, 'sin poder leer la voz, la regla de siempre');
  const src = fuenteSinComentarios('lib/evolution.ts');
  const ajustes = src.slice(src.indexOf('async function setSettings('), src.indexOf('export async function permitirGruposEnInstancia'));
  assert.match(ajustes, /const voz = await vozDeMaKoEstricta\(\)\.catch\(\(\) => undefined\);/);
  assert.match(ajustes, /groupsIgnore: ignoraGrupos\(instance, voz\)/);
  assert.doesNotMatch(ajustes, /groupsIgnore: true/, 'volvió el groupsIgnore fijo');
});

test('armarEventos los suma, y dice cuando la lista llegó a su tope', () => {
  const base: EntradasEventos = {
    pedidos: [], ingresos: null, altas: [], actividad: null, errores: null, agente: null, avisos: [], ahora: new Date('2026-11-13T00:00:00Z'),
    topes: { acciones: 100, reportes: 40, sesiones: 200, accionesDeUnNegocio: 300, reportesDeUnNegocio: 100 },
  };
  const c = cambioEntre(ANTES, { voz: 'mako_ws9', canal: CANAL }, DATOS)!;
  assert.deepEqual(armarEventos(base).eventos.filter((e) => e.nombre === 'linea'), [], 'sin el lector no hay');
  assert.equal(armarEventos({ ...base, lineas: [c] }).eventos.filter((e) => e.nombre === 'linea').length, 1);
  const llenos = Array.from({ length: TOPE_REGISTRO_LINEAS }, (_, i) => ({ ...c, at: new Date(Date.UTC(2026, 10, 1) + i * 60_000).toISOString() }));
  const corte = armarEventos({ ...base, lineas: llenos }).cortes.find((x) => x.nombre === 'linea');
  assert.ok(corte, 'la lista llena no avisa que falta lo de antes');
  assert.match(textoDeCorte(corte, (iso) => iso.slice(0, 10)), /cambios de las líneas de MaKo/);
});

test('la ruta anota: foto antes de atender, y en el finally la de después y el registro', () => {
  const src = fuenteSinComentarios('app/api/admin/mako-canal/route.ts');
  const post = src.slice(src.indexOf('export async function POST'), src.indexOf('async function atender'));
  assert.ok(post.length > 0 && src.includes('async function atender'), 'el POST no separa el registro de lo que atiende');
  const iAntes = post.indexOf('const antes = await fotoDeLineas();');
  const iTry = post.indexOf('return await atender(body);');
  const iFinally = post.indexOf('finally');
  assert.ok(iAntes > 0 && iAntes < iTry, 'la foto de antes no se toma antes de atender');
  assert.ok(iFinally > iTry, 'el registro no va en el finally: un pedido que tira no se anota');
  const fin = post.slice(iFinally);
  assert.match(fin, /cambioEntre\(antes, await fotoDeLineas\(\)/);
  assert.match(fin, /quien: sesion\.email/);
  assert.match(fin, /pantallaDelPedido\(req\.headers\.get\('referer'\)\)/);
  assert.match(fin, /if \(cambio\) await anotarCambioDeLinea\(cambio\);/);
  assert.doesNotMatch(post, /case '/, 'una acción se atiende en el POST, fuera del registro');
  assert.match(src.slice(src.indexOf('async function atender')), /case 'voz-personal':/);
});

test('el lector de Events los lee (fuera de la ficha de un negocio) y se los pasa a armarEventos', () => {
  const src = fuenteSinComentarios('app/admin/_polar/datos/eventos-server.ts');
  assert.match(src, /solo \? Promise\.resolve\(null\) : leerCambiosDeLinea\(\)/);
  assert.match(src, /pedidos, ingresos, altas, actividad, errores, agente, lineas,/);
  assert.match(src, /No pude leer los cambios de las líneas de MaKo/);
});
