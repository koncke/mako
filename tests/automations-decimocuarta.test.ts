// =============================================================================
// Decimocuarta tanda de Automations (12/10/2026): los 8 puntos de Martín con la caja del Landing Generator y la tarjeta
// de Instagram
// =============================================================================
// El pedido literal, en la entrada «Decimocuarta tanda» de docs/hallazgos-chatbot.md. Lo que se fija acá (lo puro se
// EJECUTA; el cableado, en el fuente sin comentarios y en LF):
//   1. «Nueva automatización» sin «Nace pausada»;
//   2. la caja «Pídeselo a MaKo» ES la del Landing Generator (`CajaPedido`), con su «+» ofreciendo lo de la pantalla;
//   3. el chat de MaKo al costado (la geometría, en tests/crear-ia-lugar.test.ts; el muelle, en tests/chatbot-probar.test.ts);
//   4. sin el chip rojo «Conecta tu …» al lado de «Activar»: salta el modal;
//   5. a 8. la tarjeta de Instagram / Messenger: varias cuentas, el desplegable en la cabecera con «Conectar otra», sin
//      «Conectar», sin «Sin Zernio» ni el logo de la derecha, y el ✦ al lado del desplegable. El motor manda por la cuenta
//      de la tarjeta y no cae a otra.
//
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BarraPideselo, accionesMas, MAS_ARCHIVO, MAS_PEGAR } from '../app/automations/ChatMako';
import { EJEMPLOS } from '../app/automations/CrearConIA';
import { opcionesDeCuenta, valorDeCuenta, rotuloSinCuenta, CONECTAR_OTRA, PAGAR_ZERNIO } from '../app/automations/EditorMensajeSocial';
import { cuentaNueva, type EstadoZernio } from '../app/automations/ConectarMedio';
import { cuentaDelPaso, cuentaAlGuardar, conversacionDelPaso } from '../lib/canal-social';
import { marcasDeVoseo } from '../lib/puestas-data';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const fuente = (r: string) => sinComentarios(leer(r));

// ── 1 y 2. La caja del modal ─────────────────────────────────────────────────────────────────────

test('puntos 1 y 2: la caja del modal es la del Landing Generator, sin «Nace pausada», con el ejemplo que se escribe', () => {
  const html = renderToStaticMarkup(createElement(BarraPideselo, { onPedido: () => {} }));
  assert.doesNotMatch(html, /Nace pausada/);
  assert.match(html, /<form class="gp-cc-caja" data-caja-pedido=""/);
  assert.match(html, new RegExp(`<textarea[^>]*placeholder="${EJEMPLOS[0]}"`));
  assert.match(html, /aria-label="Dictar el pedido"/);
  assert.match(html, /class="gp-cc-enviar" aria-label="Enviar" disabled=""/);
  // La MISMA pieza en las dos puertas (no una copia): la landing y el modal importan CajaPedido.
  assert.match(fuente('app/web-generator/CajaCrear.tsx'), /<CajaPedido\n/);
  assert.match(fuente('app/automations/ChatMako.tsx'), /<CajaPedido titulo=\{\{ texto: TITULO_CAJA, nivel: 2 \}\} valor=\{texto\}/);
  // Sin un chip «Plan | Express»: acá no hay un modo que elegir.
  assert.doesNotMatch(fuente('app/automations/ChatMako.tsx'), /Express/);
});

// ⚠️ DECIMOQUINTA (punto 7): el «+» ya no ofrece «Lienzo en blanco» ni «Usar plantilla» (están abajo): sube un archivo o
// una imagen y pega un flujo. El detalle, en tests/automations-decimoquinta.test.ts; acá queda que el «+» es de la caja.
test('punto 2: el «+» es de la caja: subir un archivo y, si quien monta puede crearlo, pegar un flujo', () => {
  assert.deepEqual(accionesMas(false).map((o) => o.value), [MAS_ARCHIVO]);
  assert.deepEqual(accionesMas(true).map((o) => o.value), [MAS_ARCHIVO, MAS_PEGAR]);
  for (const o of accionesMas(true)) assert.deepEqual(marcasDeVoseo(o.label), [], o.label);
  const galeria = fuente('app/automations/GaleriaPlantillas.tsx');
  assert.doesNotMatch(galeria, /MAS_BLANCO|MAS_PLANTILLA|buscarRef/);
});

// ── 4. Sin el chip rojo al lado de «Activar» ─────────────────────────────────────────────────────

test('punto 4: un medio sin conectar abre su modal y NO deja «Conecta tu …» al lado de «Activar»', () => {
  const perfil = fuente('app/automations/SecuenciaPerfil.tsx');
  assert.doesNotMatch(perfil, /setErr\(falta\.error\)/, 'Probar deja el chip');
  assert.match(perfil, /if \(medio\) \{ setConectarMedio\(medio\); setBusy\(null\); return; \}/);
  assert.doesNotMatch(perfil, /if \(medio\) \{ setErr\(e\);/, 'Publicar deja el chip');
  assert.match(perfil, /if \(medio\) setConectarMedio\(medio\);\n\s+else setErr\(r\.error \|\| 'No se pudo cambiar\.'\);/, 'Activar deja el chip');
});

// ── 5 a 8. La cuenta de Instagram / Messenger ────────────────────────────────────────────────────

const A = { id: 'acc_a', usuario: 'tienda', nombre: 'La Tienda' };
const B = { id: 'acc_b', usuario: 'tienda.mx', nombre: 'tienda.mx' };
const ok = (...cuentas: typeof A[]): EstadoZernio => ({ estado: 'ok', cuentas });

test('punto 5: el desplegable lista las cuentas de Zernio, con «Conectar otra», y nombra la conectada', () => {
  // Una: se ve su nombre aunque el paso no guarde cuenta (es la única por la que puede salir).
  const una = opcionesDeCuenta(ok(A), null, 'instagram');
  assert.deepEqual(una.map((o) => [o.value, o.label]), [[A.id, '@tienda'], [CONECTAR_OTRA, 'Conectar otra']]);
  assert.equal(valorDeCuenta(ok(A), null), A.id);
  // Varias, sin elegir: lo que hace el motor sin cuenta (la conversación del lead), y cada una.
  const dos = opcionesDeCuenta(ok(A, B), null, 'instagram');
  assert.deepEqual(dos.map((o) => o.value), ['', A.id, B.id, CONECTAR_OTRA]);
  assert.equal(dos[0].label, 'Donde escribió el lead');
  assert.equal(valorDeCuenta(ok(A, B), null), '');
  assert.equal(valorDeCuenta(ok(A, B), B.id), B.id);
  // La guardada que ya no está entra igual (un value fuera de las opciones se pisa al primer clic).
  const ida = opcionesDeCuenta(ok(A), 'acc_vieja', 'instagram');
  assert.ok(ida.some((o) => o.value === 'acc_vieja' && o.label === 'Una cuenta que ya no está'));
  assert.equal(valorDeCuenta(ok(A), 'acc_vieja'), 'acc_vieja');
  // Sin ninguna (también sin Zernio o con la key mala): sólo conectar, con el nombre del canal.
  for (const e of [ok(), { estado: 'sin_zernio' } as EstadoZernio, { estado: 'key_mala', error: 'x' } as EstadoZernio]) {
    assert.deepEqual(opcionesDeCuenta(e, null, 'messenger').map((o) => [o.value, o.label]), [[CONECTAR_OTRA, 'Conectar Messenger']]);
    assert.equal(rotuloSinCuenta(e), 'Sin conectar');
  }
  // Zernio pausado: el link de pago como opción.
  const pausada: EstadoZernio = { estado: 'pausada', error: 'x', pago: 'https://zernio.com/dashboard/billing' };
  assert.ok(opcionesDeCuenta(pausada, null, 'instagram').some((o) => o.value === PAGAR_ZERNIO));
  assert.equal(rotuloSinCuenta(null), 'Cargando…');
  for (const o of [...dos, ...una]) assert.deepEqual(marcasDeVoseo(o.label), [], o.label);
});

test('punto 5: «Conectar otra» reconoce la cuenta NUEVA (con una ya conectada, «hay alguna» daba listo al instante)', () => {
  assert.deepEqual(cuentaNueva([A.id], [A, B]), B);
  assert.equal(cuentaNueva([A.id], [A]), null, 'con la de antes sola todavía no se conectó nada');
  assert.deepEqual(cuentaNueva([], [A]), A);
  assert.deepEqual(cuentaNueva(null, [A]), A, 'sin saber qué había, cualquiera vale (lo de antes)');
  const cm = fuente('app/automations/ConectarMedio.tsx');
  assert.match(cm, /const nueva = e\?\.ok && Array\.isArray\(e\.cuentas\) \? cuentaNueva\(antes, e\.cuentas\) : null;/);
  assert.match(cm, /onCuenta\?\.\(nueva\);/);
});

test('punto 5: el paso guarda SU cuenta y el motor manda sólo por ella (sin conversación con esa, no cae a otra)', () => {
  assert.equal(cuentaDelPaso({ canal: 'instagram', cuenta_zernio: ' acc_a ' }), 'acc_a');
  assert.equal(cuentaDelPaso({ canal: 'messenger', cuenta_zernio: 'acc_b' }), 'acc_b');
  assert.equal(cuentaDelPaso({ canal: 'whatsapp', cuenta_zernio: 'acc_a' }), null, 'un WhatsApp no tiene cuenta de Zernio');
  assert.equal(cuentaDelPaso({ canal: 'instagram', cuenta_zernio: '  ' }), null);
  // Al guardar: con la clave manda lo que llega; sin la clave (la API, el generador), sobrevive la de antes.
  assert.deepEqual(cuentaAlGuardar({ canal: 'instagram', cuenta_zernio: 'acc_b' }, { canal: 'instagram', cuenta_zernio: 'acc_a' }), { cuenta_zernio: 'acc_b' });
  assert.deepEqual(cuentaAlGuardar({ canal: 'instagram', cuenta_zernio: null }, { canal: 'instagram', cuenta_zernio: 'acc_a' }), {});
  assert.deepEqual(cuentaAlGuardar({ canal: 'instagram' }, { canal: 'instagram', cuenta_zernio: 'acc_a' }), { cuenta_zernio: 'acc_a' });
  assert.deepEqual(cuentaAlGuardar({ canal: 'email', cuenta_zernio: 'acc_a' }, null), {});
  // La conversación por la que sale: con cuenta, sólo las de esa cuenta; sin, la del último mensaje.
  const filas = [
    { id: 1, zernio_account_id: 'acc_a', ultimo_mensaje_at: '2026-10-10T10:00:00Z' },
    { id: 2, zernio_account_id: 'acc_b', ultimo_mensaje_at: '2026-10-11T10:00:00Z' },
  ];
  assert.equal(conversacionDelPaso(filas, null)?.id, 2);
  assert.equal(conversacionDelPaso(filas, 'acc_a')?.id, 1);
  assert.equal(conversacionDelPaso(filas, 'acc_c'), null, 'cayó a la conversación de otra cuenta');
  // El motor: lo lee al enviar y lo conserva al publicar.
  const nutri = fuente('lib/nutricion.ts');
  assert.match(nutri, /cuenta: cuentaDelPaso\(paso\),/);
  assert.match(nutri, /\.\.\.cuentaAlGuardar\(p, antes\.find\(\(q, j\) => idDe\(q, j\) === idDe\(flujo, i\)\)\),/);
  const envio = fuente('lib/canal-zernio.ts');
  assert.match(envio, /if \(fila === null && cuenta\) return \{ ok: false, .*, terminal: true, backoffHoras: 24 \};/);
});

test('puntos 6 a 8: la cabecera del panel es la de WhatsApp (logo, desplegable, ✦) y la fila de adentro se fue', () => {
  const ed = fuente('app/automations/EditorMensajeSocial.tsx');
  // La fila de adentro: sin «Sin Zernio», sin el botón «Conectar», sin la cabecera con el logo a la derecha.
  assert.doesNotMatch(ed, /Sin Zernio/);
  assert.doesNotMatch(ed, /data-conectar-social/);
  assert.doesNotMatch(ed, /<CabeceraSocial\b/);
  assert.doesNotMatch(ed, /\{filaCuenta\}/);
  // La cabecera: el logo a la izquierda, el desplegable y el ✦ al lado (el MISMO botón y estado que en WhatsApp).
  const cab = ed.slice(ed.indexOf('export function CabeceraSocialPanel('));
  const iLogo = cab.indexOf('<LogoSocial canal={canal} size={24} />');
  const iDesp = cab.indexOf('<Dropdown');
  const iMako = cab.indexOf('{conMako && <BotonMakoWhatsApp');
  assert.ok(iLogo > 0 && iLogo < iDesp && iDesp < iMako, 'la cabecera no es logo → desplegable → ✦');
  // El lienzo la monta para Instagram y Messenger, y elegir guarda la cuenta en ESA tarjeta.
  const lienzo = fuente('app/automations/FlujoLienzo.tsx');
  assert.match(lienzo, /if \(claseDe\(paso\) === 'mensaje' && esCanalSocial\(paso\.canal\)\) return true;/);
  assert.match(lienzo, /onCuenta=\{\(c\) => onPasos\(\(prev\) => cambiarNodo\(prev, n\.id, \{ cuenta_zernio: c \}\), true\)\}/);
});

// ── ROTURAS (12/10/2026) ──────────────────────────────────────────────────────────────────────────
// Una por vez, con scratchpad/agente-14/romper.mjs (guarda el original en memoria, rompe, corre ESTE archivo y
// tests/crear-ia-lugar.test.ts, y restaura comprobando el sha1; nunca git). Base: 15 pass / 0 fail.
//   R1.  «Nace pausada» vuelve a la caja                                  → 14 / 1 (puntos 1 y 2)
//   R2.  el «+» ofrece «Pegar lo copiado» sin nada copiado                → 14 / 1 (punto 2, el «+»)
//   R3.  «Probar» vuelve a dejar el chip «Conecta tu …»                   → 14 / 1 (punto 4)
//   R4.  la cuenta guardada que ya no está se cae de las opciones         → 14 / 1 (punto 5, el desplegable)
//   R5.  «Conectar otra» da listo con cualquier cuenta («hay alguna»)     → 14 / 1 (punto 5, la nueva)
//   R6.  sin conversación con la cuenta de la tarjeta, cae a otra         → 14 / 1 (punto 5, el motor)
//   R7.  publicar sin la clave pierde la cuenta de antes                  → 14 / 1 (punto 5, el motor)
//   R8.  el ✦ antes del desplegable                                      → 14 / 1 (puntos 6 a 8)
//   R9.  el chat vuelve a la franja de abajo (centrado)                   → 14 / 1 (crear-ia-lugar, al costado)
//   R10. el motor no le pasa la cuenta al envío                           → 14 / 1 (punto 5, el motor)
// Restaurado: 15 / 0.
