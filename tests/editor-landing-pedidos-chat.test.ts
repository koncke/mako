// =============================================================================
// editor-landing-pedidos-chat — los pedidos sueltos en el chat del agente del editor (Web Generator)
// =============================================================================
// Martín, 16/10/2026 (textual en docs/diseno-mako-pedidos.md): «Feedback sobre lo actual... Y luego y también
// quiero que me crees otra landing para mi otro producto...» → se contesta lo actual y se PROPONE lo otro; borrar
// siempre confirma; lo de otra tab deja el link. Fija:
//   · app/web-generator/editor/pedidos-chat.ts (puro): de la respuesta de POST /api/mako/pedidos a las burbujas,
//     sus botones (cuál apagado) y lo que hace cada clic — con los ejemplos de Martín pasados por el núcleo REAL
//     (lib/mako-pedidos.ts, sin IA: el doble es `null`);
//   · que «crear» va por el camino de la caja del Panel (sessionStorage + `?desde=caja`): la vuelta entera, con
//     `tomarCaja` y `derechaDeQuery` de verdad;
//   · el fuente de paneles/PanelAgente.tsx (sin CRLF y sin comentarios): enviar interpreta ANTES de editar, edita
//     sólo lo actual, las sugerencias no se interpretan y el «Sí» de borrar es la acción de la Papelera del Panel,
//     nunca la abierta y nunca para siempre.
//
// Corre: node --import tsx --test tests/editor-landing-pedidos-chat.test.ts
//
// ── ROTURAS (16/10/2026, arnés que restaura de memoria y verifica el hash; base 15 / 0) ──
//   (pasan / fallan sobre los 15 tests de este archivo; las 26 restauradas con el mismo sha256)
//   pedidos-chat.ts:
//   · interpretacionDe acepta un `ok: false` que trae pedidos                          -> 14 / 1
//   · cualquier link de la ruta pasa (`javascript:`, `//otro.com`)                       -> 14 / 1
//   · lo actual se junta con un espacio y no un renglón                                  -> 14 / 1
//   · la propuesta «¿Terminamos esto…?» aunque no haya nada actual                       -> 14 / 1
//   · `pulsar` no mira si el botón está prendido (el segundo clic repite)                -> 11 / 4
//   · «elimina esta landing» no se trata aparte                                          -> 14 / 1
//   · `papeleraDe` ofrece la abierta                                                     -> 14 / 1
//   · `pulsar` archiva una burbuja con la abierta adentro                                -> 14 / 1
//   · con dos candidatas se elige la primera                                             -> 14 / 1
//   · elegir una candidata archiva sin confirmar                                         -> 13 / 2
//   · «a la papelera» en minúscula                                                       -> 13 / 2
//   · tras un error el «Sí, a la Papelera» queda apagado                                 -> 14 / 1
//   · «Después» abre la creación                                                         -> 14 / 1
//   · `alVolver` no hace nada (el «Abriendo…» queda para siempre)                        -> 14 / 1
//   · otra clave de sessionStorage que la de `tomarCaja`                                 -> 14 / 1
//   · la ruta de crear sin `desde=caja`                                                  -> 14 / 1
//   · el link de «Abrir» sin el id                                                       -> 14 / 1
//   · un VALOR de lib/mako-pedidos (`import { type … }` en vez de `import type`)         -> 14 / 1
//   paneles/PanelAgente.tsx:
//   · «editar» lleva el mensaje entero y no lo actual                                    -> 14 / 1
//   · sin nada actual igual se llama a «editar»                                          -> 14 / 1
//   · la interpretación DESPUÉS de «editar»                                              -> 14 / 1
//   · la respuesta de la ruta sin `interpretacionDe`                                     -> 14 / 1
//   · las sugerencias se interpretan                                                     -> 14 / 1
//   · el «Sí» de borrar con `accion: 'borrar'`                                           -> 14 / 1
//   · sin la guarda de la landing abierta antes de la Papelera                           -> 14 / 1
//   · crear sin `guardarAhora` antes de navegar                                          -> 14 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CLAVE_CAJA, RUTA_CREAR, TEXTOS, alTerminar, alVolver, burbujasDe, cajaParaCrear, cuerpoPedidos, interpretacionDe, nombreCorto,
  papeleraDe, pulsar, sinTerminar, textoActual, trasNoAbrir, trasPapelera, trasRestaurar, vistaDeBurbuja, type BurbujaPedido,
} from '../app/web-generator/editor/pedidos-chat';
import { interpretarCon, type ContextoPedidos, type Interpretacion, type ObjetoChat } from '../lib/mako-pedidos';
import { AREA_INFO } from '../lib/api-mako/tipos';
import { consultaDerecha, derechaDeQuery } from '../app/web-generator/panel-reglas';
import { tomarCaja } from '../app/web-generator/MiniaturaLanding';

const RAIZ = join(import.meta.dirname, '..');
const leer = (f: string) => readFileSync(join(RAIZ, f), 'utf8').replace(/\r\n/g, '\n');
/** Las líneas `//` primero y los bloques después (un `/*` dentro de un `//` no abre nada). */
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// ── Los textos de Martín, tal cual, y las landings del negocio ───────────────
const E2 = 'Feedback sobre lo actual... Y luego y también quiero que me crees otra landing para mi otro producto...';
const E3 = 'Agéndame una reunión con Juan el viernes';

const ABIERTA: ObjetoChat = { id: '41', nombre: 'Curso de inversión', tocadoAt: '2026-10-16T09:00:00Z' };
const VENTAS: ObjetoChat = { id: '42', nombre: 'Ventas de verano', tocadoAt: '2026-10-15T10:00:00Z' };
const WEBINAR: ObjetoChat = { id: '43', nombre: 'Webinar de octubre', tocadoAt: '2026-10-14T10:00:00Z' };
const VIEJA: ObjetoChat = { id: '44', nombre: 'Promo vieja', tocadoAt: '2026-09-01T10:00:00Z' };

const WS = 3;
const ctx = (objetos: ObjetoChat[]): ContextoPedidos => ({ tab: 'landing', actual: ABIERTA, objetos, operaciones: [], ws: WS });
/** El núcleo de verdad (reglas, sin IA) y lo que la ruta devolvería con eso. */
const deRuta = async (texto: string, objetos: ObjetoChat[]) => ({ ok: true, ...(await interpretarCon(texto, ctx(objetos), null)) });

const textos = (b: BurbujaPedido) => vistaDeBurbuja(b).botones.map((x) => x.texto);
const prendidos = (b: BurbujaPedido) => vistaDeBurbuja(b).botones.filter((x) => !x.apagado).map((x) => x.id);

// ─────────────────────────────────────────────────────────────────────────────
// La respuesta de la ruta
// ─────────────────────────────────────────────────────────────────────────────

test('si la ruta falla, tarda o contesta otra cosa, el mensaje ENTERO va a «editar», como siempre', () => {
  const siempre: Interpretacion = { pedidos: [{ sobre: 'actual', texto: E2 }], propuesta: null, origen: 'reglas' };
  for (const r of [
    { ok: false, error: 'Tardó demasiado. Vuelve a intentar.', cortado: 'plazo' },
    { ok: false, error: 'Tu sesión venció.' },
    // `ok: false` manda aunque traiga pedidos (AGENTS.md: manda el `ok` del cuerpo).
    { ok: false, error: 'x', pedidos: [{ sobre: 'nuevo', texto: 'créame otra landing', operacion: null }] },
    null,
    { ok: true, pedidos: [] },
    { ok: true, pedidos: [{ sobre: 'actual', texto: 'x' }, { sobre: 'marte', texto: 'y' }] },
    // Un link que no es de adentro de la app tira la respuesta entera.
    { ok: true, pedidos: [{ sobre: 'otra-tab', texto: 'y', area: 'crm', titulo: 'CRM', link: 'javascript:alert(1)', operacion: null, confirmar: false }] },
    { ok: true, pedidos: [{ sobre: 'otra-tab', texto: 'y', area: 'crm', titulo: 'CRM', link: '//otro.com/crm', operacion: null, confirmar: false }] },
  ]) {
    assert.deepEqual(interpretacionDe(r, `  ${E2} `), siempre, `con ${JSON.stringify(r)}`);
    assert.equal(textoActual(interpretacionDe(r, E2)), E2);
    assert.deepEqual(burbujasDe(interpretacionDe(r, E2), ABIERTA.id), []);
  }
  assert.deepEqual(cuerpoPedidos(' hola ', 41, ' Curso '), { texto: 'hola', tab: 'landing', actualId: 41, actualNombre: 'Curso' });
});

test('lo de la landing abierta se junta en UN texto para «editar»; sin nada de ella, no hay «editar»', () => {
  const i = interpretacionDe({
    ok: true, origen: 'reglas', propuesta: null,
    pedidos: [{ sobre: 'actual', texto: 'Cambia el título' }, { sobre: 'nuevo', texto: 'créame otra landing', operacion: null }, { sobre: 'actual', texto: 'y acorta el hero' }],
  }, 'x');
  assert.equal(textoActual(i), 'Cambia el título\ny acorta el hero');
  assert.equal(textoActual(interpretacionDe({ ok: true, pedidos: [{ sobre: 'nuevo', texto: 'créame otra landing', operacion: null }], propuesta: null }, 'x')), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Crear otra landing
// ─────────────────────────────────────────────────────────────────────────────

test('E2: lo actual va a «editar» y la landing nueva se PROPONE con Sí / Después', async () => {
  const i = interpretacionDe(await deRuta(E2, [ABIERTA, VENTAS]), E2);
  assert.match(textoActual(i) ?? '', /^Feedback sobre lo actual/);
  assert.doesNotMatch(textoActual(i) ?? '', /otra landing/, 'el pedido de la landing nueva NO va a «editar»');
  const bs = burbujasDe(i, ABIERTA.id);
  assert.equal(bs.length, 1);
  const b = bs[0];
  assert.equal(b.tipo, 'crear');
  const v = vistaDeBurbuja(b);
  assert.match(v.texto, /^¿Terminamos esto y después .*otra landing.*\?$/, 'la propuesta de la ruta');
  assert.deepEqual(textos(b), ['Sí', 'Después']);
  assert.deepEqual(prendidos(b), ['si', 'despues']);
  // «Sí» abre la creación con EL PEDIDO (el de la landing nueva, no el mensaje entero).
  const si = pulsar(b, 'si', ABIERTA.id);
  assert.equal(si.efecto?.tipo, 'crear');
  assert.match(si.efecto?.tipo === 'crear' ? si.efecto.pedido : '', /^quiero que me crees otra landing para mi otro producto/);
  assert.equal(vistaDeBurbuja(si.burbuja).nota, TEXTOS.abriendo);
  assert.ok(vistaDeBurbuja(si.burbuja).ocupado);
  // Usado: apagado y marcado; un segundo clic no repite la acción.
  assert.deepEqual(prendidos(si.burbuja), []);
  assert.deepEqual(vistaDeBurbuja(si.burbuja).botones.filter((x) => x.elegido).map((x) => x.id), ['si']);
  assert.equal(pulsar(si.burbuja, 'si', ABIERTA.id).efecto, null);
  assert.equal(pulsar(si.burbuja, 'despues', ABIERTA.id).efecto, null);
});

// «¿Terminamos esto y después…?» → «Sí» quiere decir PRIMERO esto: con el cambio de la landing abierta sin aceptar
// ni descartar, abrir la creación en el acto se iba del editor con «esto» a medias.
// Roturas (sobre 16 tests, pasan / fallan): `pulsar` sin mirar `sinTerminar` → 15 / 1; `alTerminar` que no abre →
// 15 / 1; el panel sin pasarle `sinTerminar` a `pulsar` → 15 / 1; el panel sin el efecto de `alTerminar` → 15 / 1.
test('«Sí» con el cambio de lo abierto sin terminar ESPERA, y abre la creación al aceptarlo o descartarlo', async () => {
  const [b] = burbujasDe(interpretacionDe(await deRuta(E2, [ABIERTA]), E2), ABIERTA.id);
  const si = pulsar(b, 'si', ABIERTA.id, { sinTerminar: true });
  assert.equal(si.efecto, null, 'no se va del editor con el cambio a medias');
  assert.equal(vistaDeBurbuja(si.burbuja).nota, TEXTOS.esperando);
  assert.deepEqual(prendidos(si.burbuja), ['despues'], '«Sí» ya está dicho; «Después» sigue por si cambia de idea');
  assert.deepEqual(vistaDeBurbuja(si.burbuja).botones.filter((x) => x.elegido).map((x) => x.id), ['si']);
  // Al terminar, se abre UNA vez.
  const fin = alTerminar(si.burbuja);
  assert.deepEqual(fin.efecto, { tipo: 'crear', pedido: (si.burbuja as { pedido: string }).pedido });
  assert.equal(vistaDeBurbuja(fin.burbuja).nota, TEXTOS.abriendo);
  assert.equal(alTerminar(fin.burbuja).efecto, null);
  assert.equal(alTerminar(b).efecto, null, 'una burbuja que no esperaba no se abre sola');
  // Lo que cuenta como sin terminar: lo que todavía tiene botones (o el giro) en el mensaje del agente.
  assert.deepEqual(['pendiente', 'aplicando', 'sin-version', 'aplicada', 'descartada', 'restaurada', undefined].map(sinTerminar),
    [true, true, true, false, false, false, false]);
  // El panel: «Sí» mira los mensajes del agente, y el efecto abre la que esperaba cuando ya no queda nada sin terminar.
  const panel = sinComentarios(leer('app/web-generator/editor/paneles/PanelAgente.tsx'));
  assert.match(panel, /pulsar\(m\.burbuja, boton, docId, \{ sinTerminar: mensajes\.some\(\(x\) => x\.de === 'mako' && sinTerminar\(x\.estado\)\) \}\)/);
  const efecto = cuerpoDe(panel, 'useEffect(() => {\n    if (hilo.mensajes.some((m) => m.de === \'mako\' && sinTerminar(m.estado))) return;', '}, [hilo.mensajes, docId]);');
  assert.match(efecto, /const r = alTerminar\(m\.burbuja\);/);
  assert.match(efecto, /void abrirCreacion\(m\.id, r\.efecto\.pedido\);/);
});

// Visto con clics el 16/10/2026: «Crear ahora» (celeste, `secundario`) se leía como una sugerencia más del panel
// («Mejorar la escritura»…, `gma-ag-pildora`, también celeste). Roturas (sobre 17 tests): «Crear ahora» otra vez en
// celeste tras «Después» → no compila (`secundario` ya no es variante: probado con el tsc acotado); sin el «+» → 16 / 1;
// los links del panel en `secundario` → 16 / 1.
test('los botones de una burbuja no se parecen a las sugerencias: «Crear ahora» azul con «+», lo demás en contorno', async () => {
  const [b] = burbujasDe(interpretacionDe(await deRuta(E2, [ABIERTA]), E2), ABIERTA.id);
  const despues = pulsar(b, 'despues', ABIERTA.id).burbuja;
  const directa = burbujasDe(interpretacionDe(await deRuta('Créame otra landing', [ABIERTA]), 'Créame otra landing'), ABIERTA.id)[0];
  for (const x of [despues, directa]) {
    const [crear] = vistaDeBurbuja(x).botones;
    assert.equal(crear.id, 'crear-ahora');
    assert.equal(crear.v, 'primario');
    assert.equal(crear.icono, 'mas');
  }
  const elegir = burbujasDe(interpretacionDe(await deRuta('Borra la otra landing', [ABIERTA, VENTAS, WEBINAR]), 'Borra la otra landing'), ABIERTA.id)[0];
  assert.equal(elegir.tipo, 'elegir');
  assert.deepEqual([...new Set(vistaDeBurbuja(elegir).botones.map((x) => x.v))], ['contorno']);
  const panel = sinComentarios(leer('app/web-generator/editor/paneles/PanelAgente.tsx'));
  const burbuja = cuerpoDe(panel, '<div className="gma-ag-acciones">', '</div>');
  assert.doesNotMatch(burbuja, /data-v="secundario"/);
  assert.match(burbuja, /b\.icono && <Ico n=\{b\.icono\}/);
});

test('«Después» deja la burbuja con «Crear ahora», y «Crear ahora» abre la creación UNA vez', async () => {
  const [b] = burbujasDe(interpretacionDe(await deRuta(E2, [ABIERTA]), E2), ABIERTA.id);
  const despues = pulsar(b, 'despues', ABIERTA.id);
  assert.equal(despues.efecto, null, '«Después» no abre nada');
  assert.equal(vistaDeBurbuja(despues.burbuja).texto, TEXTOS.despues);
  assert.deepEqual(textos(despues.burbuja), ['Crear ahora']);
  assert.deepEqual(prendidos(despues.burbuja), ['crear-ahora']);
  const ahora = pulsar(despues.burbuja, 'crear-ahora', ABIERTA.id);
  assert.equal(ahora.efecto?.tipo, 'crear');
  assert.equal(pulsar(ahora.burbuja, 'crear-ahora', ABIERTA.id).efecto, null, 'dos clics, una creación');
  // Sin sessionStorage la creación no se abre: el botón vuelve a estar prendido y se dice.
  const fallo = trasNoAbrir(ahora.burbuja);
  assert.deepEqual(prendidos(fallo), ['crear-ahora']);
  assert.equal(vistaDeBurbuja(fallo).nota, TEXTOS.noAbrio);
  assert.ok(vistaDeBurbuja(fallo).error);
  // De vuelta en el editor (el hilo sobrevive a navegar), lo que quedó «Abriendo…» ya se abrió: sin giro.
  const vuelta = alVolver(ahora.burbuja);
  assert.equal(vistaDeBurbuja(vuelta).nota, TEXTOS.abierta);
  assert.equal(vistaDeBurbuja(vuelta).ocupado, false);
  assert.deepEqual(prendidos(vuelta), []);
});

test('sin nada de la landing abierta, la landing nueva va DIRECTA (sin propuesta) con «Crear ahora»', async () => {
  const i = interpretacionDe(await deRuta('Créame otra landing', [ABIERTA]), 'Créame otra landing');
  assert.equal(textoActual(i), null, 'no hay nada que editar');
  assert.equal(i.propuesta, null);
  const [b] = burbujasDe(i, ABIERTA.id);
  assert.equal(b.tipo, 'crear');
  assert.equal(vistaDeBurbuja(b).texto, TEXTOS.directa);
  assert.deepEqual(textos(b), ['Crear ahora']);
  const r = pulsar(b, 'crear-ahora', ABIERTA.id);
  assert.deepEqual(r.efecto, { tipo: 'crear', pedido: 'Créame otra landing' });
});

// ─────────────────────────────────────────────────────────────────────────────
// Mandar OTRA landing a la Papelera
// ─────────────────────────────────────────────────────────────────────────────

test('«elimina la otra landing» con UNA otra: «¿Mando «X» a la Papelera?» con «Sí, a la Papelera» y «No»', async () => {
  const texto = 'Elimina la otra landing que tengo';
  const i = interpretacionDe(await deRuta(texto, [ABIERTA, VENTAS]), texto);
  assert.equal(textoActual(i), null);
  const [b] = burbujasDe(i, ABIERTA.id);
  assert.equal(b.tipo, 'papelera');
  assert.equal(vistaDeBurbuja(b).texto, '¿Mando «Ventas de verano» a la Papelera?');
  assert.deepEqual(textos(b), ['Sí, a la Papelera', 'No']);
  const si = pulsar(b, 'papelera', ABIERTA.id);
  assert.deepEqual(si.efecto, { tipo: 'papelera', objeto: VENTAS, id: 42 });
  assert.equal(vistaDeBurbuja(si.burbuja).nota, TEXTOS.archivando);
  assert.equal(pulsar(si.burbuja, 'papelera', ABIERTA.id).efecto, null, 'mientras archiva, otro clic no manda otro pedido');
  const hecha = trasPapelera(si.burbuja, true);
  assert.equal(vistaDeBurbuja(hecha).nota, TEXTOS.enPapelera);
  assert.deepEqual(prendidos(hecha), []);
  assert.equal(vistaDeBurbuja(trasRestaurar(hecha, true)).nota, TEXTOS.restaurada);
  // Si no se pudo, se dice y el botón se puede volver a tocar (no se hizo nada que repetir).
  const fallo = trasPapelera(si.burbuja, false);
  assert.equal(vistaDeBurbuja(fallo).nota, TEXTOS.noArchivo);
  assert.deepEqual(prendidos(fallo), ['papelera', 'no']);
  assert.equal(pulsar(fallo, 'papelera', ABIERTA.id).efecto?.tipo, 'papelera');
  // «No»: nada, y los dos apagados.
  const no = pulsar(b, 'no', ABIERTA.id);
  assert.equal(no.efecto, null);
  assert.deepEqual(prendidos(no.burbuja), []);
  assert.equal(pulsar(no.burbuja, 'papelera', ABIERTA.id).efecto, null);
});

test('con DOS candidatas: primero dos botones con los nombres, y recién después la confirmación', async () => {
  const texto = 'Elimina la otra landing';
  const i = interpretacionDe(await deRuta(texto, [ABIERTA, WEBINAR, VIEJA, VENTAS]), texto);
  const [b] = burbujasDe(i, ABIERTA.id);
  assert.equal(b.tipo, 'elegir', 'nunca se elige la primera de una lista');
  assert.equal(vistaDeBurbuja(b).texto, '¿Cuál: «Ventas de verano» o «Webinar de octubre»?', 'las dos más recientes');
  assert.deepEqual(textos(b), ['Ventas de verano', 'Webinar de octubre']);
  const elegida = pulsar(b, 'elegir:43', ABIERTA.id);
  assert.equal(elegida.efecto?.tipo, 'agregar');
  const confirmar = elegida.efecto?.tipo === 'agregar' ? elegida.efecto.burbuja : null;
  assert.ok(confirmar && confirmar.tipo === 'papelera');
  assert.equal(vistaDeBurbuja(confirmar).texto, '¿Mando «Webinar de octubre» a la Papelera?', 'elegir NO archiva: pregunta');
  assert.deepEqual(prendidos(elegida.burbuja), [], 'la otra ya no se puede elegir');
  assert.deepEqual(vistaDeBurbuja(elegida.burbuja).botones.filter((x) => x.elegido).map((x) => x.texto), ['Webinar de octubre']);
  assert.equal(pulsar(elegida.burbuja, 'elegir:42', ABIERTA.id).efecto, null);
  // Sin candidatas, se pregunta el nombre (sin botones).
  const [sin] = burbujasDe(interpretacionDe(await deRuta(texto, [ABIERTA]), texto), ABIERTA.id);
  assert.deepEqual(sin, { tipo: 'aviso', texto: TEXTOS.cual });
  assert.deepEqual(vistaDeBurbuja(sin).botones, []);
});

test('NUNCA la landing abierta: «elimina esta landing» dice dónde está «Eliminar» y no ofrece la Papelera', async () => {
  const texto = 'Elimina esta landing';
  const i = interpretacionDe(await deRuta(texto, [ABIERTA, VENTAS]), texto);
  assert.equal(textoActual(i), null, 'borrar no es una edición');
  const bs = burbujasDe(i, ABIERTA.id);
  assert.deepEqual(bs, [{ tipo: 'abierta' }]);
  assert.equal(vistaDeBurbuja(bs[0]).texto, TEXTOS.laAbierta);
  assert.deepEqual(vistaDeBurbuja(bs[0]).botones, []);
  // Ni elegida entre dos, ni con una burbuja armada a mano con la abierta adentro.
  assert.deepEqual(papeleraDe(ABIERTA, 41), { tipo: 'abierta' });
  const aMano: BurbujaPedido = { tipo: 'papelera', objeto: ABIERTA, estado: 'pregunta' };
  assert.equal(pulsar(aMano, 'papelera', 41).efecto, null);
  const conAbierta: BurbujaPedido = { tipo: 'elegir', candidatos: [ABIERTA, VENTAS], elegido: null };
  const r = pulsar(conAbierta, 'elegir:41', 41);
  assert.deepEqual(r.efecto, { tipo: 'agregar', burbuja: { tipo: 'abierta' } });
});

// ─────────────────────────────────────────────────────────────────────────────
// Abrir otra landing, ir a otra tab
// ─────────────────────────────────────────────────────────────────────────────

test('otra landing con otro verbo: el link «Abrir «X»» a su editor (el ?ws= lo pega el Link)', async () => {
  const texto = 'Cambia el título de la otra landing';
  const i = interpretacionDe(await deRuta(texto, [ABIERTA, VENTAS]), texto);
  const [b] = burbujasDe(i, ABIERTA.id);
  assert.equal(b.tipo, 'abrir');
  const v = vistaDeBurbuja(b);
  assert.equal(v.texto, 'Eso va en «Ventas de verano».');
  assert.deepEqual(v.links, [{ texto: 'Abrir «Ventas de verano»', href: '/web-generator/42' }]);
  assert.deepEqual(v.botones, []);
  // Con dos, los dos links y la pregunta.
  const [dos] = burbujasDe(interpretacionDe(await deRuta(texto, [ABIERTA, VENTAS, WEBINAR]), texto), ABIERTA.id);
  assert.deepEqual(vistaDeBurbuja(dos).links.map((l) => l.href), ['/web-generator/42', '/web-generator/43']);
  assert.match(vistaDeBurbuja(dos).texto, /^¿Cuál: /);
});

test('E3 (otra tab): el link «Ir a CRM» que armó la ruta, con el ?ws=; sin «editar»', async () => {
  const i = interpretacionDe(await deRuta(E3, [ABIERTA]), E3);
  assert.equal(textoActual(i), null);
  const [b] = burbujasDe(i, ABIERTA.id);
  assert.equal(b.tipo, 'ir');
  const v = vistaDeBurbuja(b);
  assert.equal(v.texto, `Eso se hace en ${AREA_INFO.crm.tab}.`);
  assert.deepEqual(v.links, [{ texto: `Ir a ${AREA_INFO.crm.tab}`, href: `${AREA_INFO.crm.ruta}?ws=${WS}` }]);
});

test('un nombre largo se corta en el botón; uno vacío es «Sin título»', () => {
  assert.equal(nombreCorto({ id: '1', nombre: '   ' }, 28), 'Sin título');
  const largo = nombreCorto({ id: '1', nombre: 'Landing de la promoción de fin de año para el curso' }, 28);
  assert.ok(largo.length <= 28 && largo.endsWith('…'), largo);
  const b: BurbujaPedido = { tipo: 'elegir', candidatos: [{ id: '7', nombre: 'Landing de la promoción de fin de año para el curso' }, VENTAS], elegido: null };
  assert.ok(textos(b).every((t) => t.length <= 28));
});

// ─────────────────────────────────────────────────────────────────────────────
// «Crear» va por el camino de la caja del Panel: la vuelta entera
// ─────────────────────────────────────────────────────────────────────────────

test('«Sí» deja el pedido donde lo busca `tomarCaja` y la ruta abre Crear con IA en Plan con él', () => {
  const guardado = new Map<string, string>();
  const g = globalThis as { window?: unknown };
  const antes = g.window;
  g.window = { sessionStorage: { getItem: (k: string) => guardado.get(k) ?? null, setItem: (k: string, v: string) => { guardado.set(k, v); }, removeItem: (k: string) => { guardado.delete(k); } } };
  try {
    guardado.set(CLAVE_CAJA, cajaParaCrear('  quiero otra landing para mi otro producto ', Date.now()));
    assert.deepEqual(tomarCaja(), { prompt: 'quiero otra landing para mi otro producto', modo: 'plan' });
    assert.equal(tomarCaja(), null, 'se consume UNA vez');
    guardado.set(CLAVE_CAJA, cajaParaCrear('vieja', Date.now() - 11 * 60_000));
    assert.equal(tomarCaja(), null, 'vence');
  } finally {
    g.window = antes;
  }
  const [ruta, query] = RUTA_CREAR.split('?');
  assert.equal(ruta, '/web-generator');
  const d = derechaDeQuery(consultaDerecha(Object.fromEntries(new URLSearchParams(query))), [], []);
  assert.equal(d.tipo, 'ia');
  assert.ok(d.tipo === 'ia' && d.arranque.sesion === true && d.arranque.modo === 'plan', 'Crear con IA lee la sesión, en Plan');
  assert.ok(d.tipo === 'ia' && d.arranque.prompt === undefined, 'el pedido NO viaja en la URL');
  assert.doesNotMatch(RUTA_CREAR, /prompt=/);
});

// ─────────────────────────────────────────────────────────────────────────────
// El panel (se lee el fuente)
// ─────────────────────────────────────────────────────────────────────────────

const PANEL = sinComentarios(leer('app/web-generator/editor/paneles/PanelAgente.tsx'));
function cuerpoDe(src: string, firma: string, siguiente: string): string {
  const ini = src.indexOf(firma);
  assert.ok(ini >= 0, `no encontré «${firma}»`);
  const fin = src.indexOf(siguiente, ini + firma.length);
  assert.ok(fin > ini, `no encontré dónde termina «${firma}»`);
  return src.slice(ini, fin);
}

test('enviar: la interpretación ANTES de «editar», que lleva sólo lo actual y no corre sin nada actual', () => {
  const pedir = cuerpoDe(PANEL, 'async function pedirEdicion(', 'type Sugerencia =');
  assert.ok(pedir.length < 5000, `el recorte de pedirEdicion mide ${pedir.length}: está mirando otra cosa`);
  const interpretar = pedir.indexOf('await pedirPedidos(cuerpoPedidos(texto, docId, ctx.titulo), { ms: PLAZO_PEDIDOS_MS, signal: corte.signal })');
  const editar = pedir.indexOf("pedirIA({ accion: 'editar', instruccion: paraEditar,");
  assert.ok(interpretar >= 0, 'enviar no pide la interpretación (con su plazo y el «Detener»)');
  assert.ok(editar >= 0, '«editar» no lleva el texto de lo actual');
  assert.ok(interpretar < editar, 'se edita antes de interpretar');
  assert.equal((pedir.match(/pedirIA\(/g) ?? []).length, 1);
  const entre = pedir.slice(interpretar, editar);
  assert.match(entre, /paraEditar = textoActual\(interp\);/);
  assert.match(entre, /if \(!paraEditar\) \{ terminar\(\.\.\.burbujas\); return; \}/, 'sin nada actual igual se llama a «editar»');
  assert.match(entre, /const interp = interpretacionDe\(ri, texto\);/, 'la respuesta no pasa por la validación (la falla no vuelve a lo de siempre)');
  assert.match(entre, /if \(!ri\.ok && cortadoPorUsuario\(ri\)\) \{ terminar\(/, '«Detener» mientras interpreta no corta');
  assert.match(pedir, /if \(op\.interpretar !== false\) \{/);
  // Las sugerencias son ediciones NUESTRAS: no se interpretan. Lo escrito, sí.
  assert.match(PANEL, /if \(s\.instruccion\) \{ enviar\(s\.instruccion, s\.alcance \?\? alcanceReal, \{ interpretar: false \}\); return; \}/);
  assert.match(PANEL, /enviar\(texto\);/);
  assert.doesNotMatch(PANEL, /enviar\(texto, [^)]*interpretar: false/);
});

test('el «Sí» de borrar es la Papelera del Panel (`accion: \'papelera\'`), nunca la abierta y nunca para siempre', () => {
  const mandar = cuerpoDe(PANEL, 'const mandarAPapelera = async (id: number, landing: number) => {', 'const alBoton =');
  const guarda = mandar.indexOf('if (landing === ctxRef.current.docId)');
  const papelera = mandar.indexOf("pedirDocs({ accion: 'papelera', id: landing })");
  assert.ok(guarda >= 0, 'no se vuelve a mirar que no sea la abierta');
  assert.ok(papelera > guarda, 'se archiva antes de mirar que no sea la abierta');
  assert.match(mandar.slice(guarda, papelera), /return; \}/);
  assert.doesNotMatch(PANEL, /accion: 'borrar'/, 'el chat borra para siempre');
  assert.match(PANEL, /else if \(efecto\?\.tipo === 'papelera'\) void mandarAPapelera\(id, efecto\.id\);/);
  assert.match(PANEL, /if \(efecto\?\.tipo === 'crear'\) void abrirCreacion\(id, efecto\.pedido\);/);
  // Crear: lo del editor primero, el pedido a la sesión, y la ruta de la caja con el router que lleva el ?ws=.
  const crear = cuerpoDe(PANEL, 'const abrirCreacion = async (id: number, pedido: string) => {', 'const sacarDePapelera =');
  const guardar = crear.indexOf('await ctxRef.current.guardarAhora();');
  const sesion = crear.indexOf('window.sessionStorage.setItem(CLAVE_CAJA, cajaParaCrear(pedido, Date.now()));');
  const ir = crear.indexOf('router.push(RUTA_CREAR);');
  assert.ok(guardar >= 0 && sesion > guardar && ir > sesion, 'el orden es guardar, dejar el pedido y navegar');
  assert.match(PANEL, /import Link, \{ useRouter \} from '@\/app\/_ui\/Link';/);
  // Los botones se leen del STORE (dos clics en un tick no repiten) y las burbujas se dibujan con su vista.
  assert.match(PANEL, /const mensajes = hilos\.get\(docId\)\?\.mensajes \?\? \[\];\n  const m = mensajes\.find\(\(x\) => x\.id === id\);/);
  assert.match(PANEL, /const v = vistaDeBurbuja\(burbuja\);/);
});

test('pedidos-chat.ts es puro: de lib/mako-pedidos sólo TIPOS, y nada del registro', () => {
  const src = leer('app/web-generator/editor/pedidos-chat.ts');
  const imports = src.match(/^import .*$/gm) ?? [];
  assert.deepEqual(imports, ["import type { Interpretacion, ObjetoChat, PedidoResuelto } from '@/lib/mako-pedidos';"]);
  assert.doesNotMatch(src, /api-mako\/registro|server-only|from 'react'/);
  const cliente = sinComentarios(leer('app/web-generator/cliente.ts'));
  assert.match(cliente, /import type \{ Interpretacion \} from '@\/lib\/mako-pedidos';/);
  assert.doesNotMatch(cliente, /^import \{[^}]*\} from '@\/lib\/mako-pedidos'/m);
});
