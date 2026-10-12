// =============================================================================
// Dónde flotan la caja y la barra de «Crear con IA» (lib/crear-ia-lugar.ts + SecuenciaPerfil)
// =============================================================================
// Revisión de la segunda tanda del Chatbot (09/10/2026), dos hallazgos de la misma familia:
//
//   · La CAJA de una automatización vacía era `inset: 0`, z 4 y centrada en el ancho TOTAL: tapaba
//     la lista en ventanas angostas, parte de «Probar» y la tarjeta CRON ENTERA —`encuadreInicial`
//     la centra en ese mismo lugar—, que no se podía tocar para elegir el disparador. Centrarla
//     entre los insets, solo, empeoraba: quedaba exactamente encima del CRON y tapaba también su ＋.
//   · La BARRA «Pídele un cambio» medía 560 de envoltorio con 460 dibujados (el aire se comía los
//     clics) y quedaba encima de la franja del editor apaisado, tapando sus botones de abajo.
//
// Lo que queda: las dos en la franja de abajo (`franjaIA`), la caja con el CRON encuadrado ARRIBA
// de ella (`RESERVA_ABAJO_CREAR` → `Lienzo.reservaAbajo`), y las dos escondidas —sin desmontarse—
// mientras haya una tarjeta abierta (`FlujoLienzo.onTarjetaAbierta`).
//
// La geometría se mide con las funciones de VERDAD (`grafoDeSecuencia`, `encuadreInicial`,
// `muelles`); la caja se dibuja (renderToStaticMarkup) y lo que no se puede dibujar sin DOM (la
// barra, que aparece con un clic; el aviso de la tarjeta abierta) se fija en el fuente.
//
// PROBADO ROMPIÉNDOLO (09/10/2026):
//   · `RESERVA_ABAJO_CREAR = 0` (el CRON centrado en el alto entero, como antes): 1 fallo, 7 pases
//     («el CRON queda debajo de la caja en 36 ventanas» de 48);
//   · `franjaIA` sin la lista (`left: PANEL_MARGEN`): 2 fallos, 6 pases (el de la lista y el de la
//     franja; el dibujado sigue verde porque compara contra la misma `franjaIA`);
//   · la caja montada con `&& !tarjetaAbierta` en vez de esconderla con `display`: 1 fallo, 7 pases;
//   · el Lienzo encuadrando con `h` entero (sin `- reservaAbajo`): 1 fallo, 7 pases.
// DUODÉCIMA TANDA (12/10/2026): la barra pasó a ser el chat de MaKo. Re-probado con scratchpad/wf-duodecima/chat-ui/
// romper.mjs (base 8 / 0): el chat sin su tope de 45% → 7 / 1; sin esconderse con una tarjeta abierta → 7 / 1; el chat
// con un ancho propio en vez del de la franja → 7 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { grafoDeSecuencia } from '../lib/flujo-conversacion';
import { encuadreInicial, muelles, type Muelles } from '../lib/lienzo-grafo';
import { franjaIA, CAJA_IA_ANCHO, BARRA_IA_ANCHO, CAJA_IA_ALTO, RESERVA_ABAJO_CREAR } from '../lib/crear-ia-lugar';
import { SecuenciaPerfil } from '../app/automations/SecuenciaPerfil';
import type { SecuenciaDto } from '../app/automations/ChatAgentApp';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

type Rect = { x0: number; y0: number; x1: number; y1: number };
const seTocan = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** El grafo de una automatización VACÍA: sólo el CRON. */
const GRAFO = grafoDeSecuencia([], { disparador: 'A mano', secuencias: [] } as never);
const CRON = GRAFO.nodos.find((n) => n.tipo === 'entrada') ?? GRAFO.nodos[0];

/** La tarjeta CRON y su ＋ (que cuelga a `n.x + n.ancho + 7`, ~26 px), en pantalla. */
function cronEnPantalla(w: number, h: number, m: Muelles): Rect {
  const v = encuadreInicial(GRAFO, { w, h: Math.max(1, h - RESERVA_ABAJO_CREAR), insetIzq: m.insets.izq, insetDer: m.insets.der });
  return {
    x0: v.tx + CRON.x * v.k, x1: v.tx + (CRON.x + CRON.ancho + 7 + 26) * v.k,
    y0: v.ty + CRON.y * v.k, y1: v.ty + (CRON.y + CRON.alto) * v.k,
  };
}

/** La pieza centrada en la franja, con su ancho tope (el CSS: `min(Npx, 100%)` + `justify: center`). */
function piezaEnFranja(w: number, h: number, m: Muelles, ancho: number, alto: number): Rect {
  const f = franjaIA(m);
  const z0 = f.left, z1 = w - f.right;
  const bw = Math.min(ancho, z1 - z0);
  const cx = (z0 + z1) / 2;
  return { x0: cx - bw / 2, x1: cx + bw / 2, y0: h - f.bottom - alto, y1: h - f.bottom };
}

const ANCHOS = [900, 1000, 1180, 1280, 1440, 1920];
const ALTOS = [560, 640, 760, 900];

test('la caja de crear no tapa la tarjeta CRON ni su ＋, en ninguna ventana (con y sin «Probar»)', () => {
  const tapados: string[] = [];
  for (const w of ANCHOS) for (const h of ALTOS) for (const probar of [false, true]) {
    const m = muelles({ w, h }, { listaAbierta: true, probarAbierto: probar, editorAbierto: true });
    if (seTocan(cronEnPantalla(w, h, m), piezaEnFranja(w, h, m, CAJA_IA_ANCHO, CAJA_IA_ALTO))) tapados.push(`${w}x${h}${probar ? '+probar' : ''}`);
  }
  assert.deepEqual(tapados, [], `el CRON queda debajo de la caja en ${tapados.length} ventanas`);
});

test('la caja y la barra quedan entre la lista y lo que tapa la derecha abajo', () => {
  for (const w of ANCHOS) for (const h of ALTOS) for (const probar of [false, true]) {
    const m = muelles({ w, h }, { listaAbierta: true, probarAbierto: probar, editorAbierto: true });
    for (const [ancho, alto] of [[CAJA_IA_ANCHO, CAJA_IA_ALTO], [BARRA_IA_ANCHO, 40]] as const) {
      const r = piezaEnFranja(w, h, m, ancho, alto);
      assert.ok(r.x0 >= m.insets.izq, `${w}x${h}: la pieza (${ancho}) pisa la lista`);
      assert.ok(r.x1 <= w - m.insets.derAbajo, `${w}x${h}: la pieza (${ancho}) pisa «Probar»`);
      // Y «Probar» apilado (arriba a la derecha) no llega a la franja de la caja.
      if (m.probar && m.disposicion === 'apilados') {
        const p = m.probar;
        assert.ok(!seTocan(r, { x0: p.left, x1: p.left + p.width, y0: p.top, y1: p.top + p.height }), `${w}x${h}: la pieza tapa «Probar»`);
      }
    }
  }
});

test('la franja sale de los muelles: lista a la izquierda, `derAbajo` a la derecha, encima del zoom', () => {
  const m = muelles({ w: 1440, h: 760 }, { listaAbierta: true, probarAbierto: false, editorAbierto: true });
  assert.deepEqual(franjaIA(m), { left: m.insets.izq + 12, right: 12, bottom: 64 });
  // Sin muelles, los insets de siempre.
  assert.deepEqual(franjaIA(null, { izq: 100, der: 50 }), { left: 112, right: 62, bottom: 64 });
});

// ⚠️ DUODÉCIMA TANDA (12/10/2026): la barra pasó a ser el CHAT de MaKo (app/automations/ChatMako.tsx), que mide el
// ancho de quien lo monta. Desde la DECIMOTERCERA (punto 6) es el hilo de WhatsApp, que LLENA la caja que le dan
// (`position: absolute; inset: 0`: un alto definido, el que necesita `ChatHilo`). El ancho de la franja lo pone
// SecuenciaPerfil con `BARRA_IA_ANCHO`, y el alto, `ALTO_CHAT_MAKO` (una ventana de chat de alto fijo).
test('el ancho de la franja es el que dibuja el chat de MaKo (BARRA_IA_ANCHO, puesto por SecuenciaPerfil)', () => {
  const chat = sinComentarios(leer('app/automations/ChatMako.tsx'));
  assert.match(chat, /raiz: \{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', minHeight: 0,/);
  const perfil = sinComentarios(leer('app/automations/SecuenciaPerfil.tsx'));
  assert.match(perfil, /<div style=\{\{ pointerEvents: 'auto', width: `min\(\$\{BARRA_IA_ANCHO\}px, 100%\)`, flex: 1, minHeight: 0, position: 'relative' \}\}>/);
});

const SEC = {
  id: 7, clave: 'nueva', nombre: 'Nueva automatización', etapa: 'nuevo', trigger_tipo: 'manual',
  activa: false, pasos: [], inscriptos: 0, enviados: 0, estrategia: null, metricas: {},
} as unknown as SecuenciaDto;

// ⚠️ DESDE LA DÉCIMA TANDA (11/10/2026) EL LIENZO VACÍO YA NO DIBUJA LA CAJA (docs/diseno-automations-galeria-v2.md §1,
// «decisión tomada, a confirmar»): pedirle a MaKo vive en el modal «Nueva automatización». La geometría de arriba sigue
// valiendo para la barra de editar y para el día que la caja vuelva (el modo `crear` de CrearConIA sigue vivo).
test('dibujada: una automatización vacía NO dibuja la caja de crear (vive en el modal «Nueva automatización»)', () => {
  const m = muelles({ w: 1440, h: 760 }, { listaAbierta: true, probarAbierto: false, editorAbierto: true });
  const html = renderToStaticMarkup(createElement(SecuenciaPerfil, {
    secuencia: SEC, secuencias: [SEC], productos: [], disparadores: [], onAbrirClave: () => {}, objetivos: [],
    etiquetaEtapa: (k: string) => k, rolAdmin: true, audios: [], negocio: 'Mi negocio', canalCaido: false, tz: null,
    onAudioNuevo: () => {}, onCambio: () => {}, muelles: m,
  } as Parameters<typeof SecuenciaPerfil>[0]));
  assert.doesNotMatch(html, /data-crear-ia="crear"/, 'volvió la caja de crear al lienzo vacío');
  assert.doesNotMatch(html, />Generar con IA</);
  // La pieza sigue midiendo lo mismo, por si vuelve.
  assert.ok(CAJA_IA_ANCHO > 0 && franjaIA(m).bottom > 0);
});

// Duodécima tanda: la barra es el chat de MaKo, en el MISMO lugar. Decimotercera (puntos 2 y 6): de alto fijo, también
// con el lienzo VACÍO (ahí MaKo CREA sobre la fila que nació con el pedido), y encima de la capa mientras trabaja.
test('el chat de editar se ESCONDE con una tarjeta abierta, sin desmontarse (y la caja de crear no se monta)', () => {
  const src = sinComentarios(leer('app/automations/SecuenciaPerfil.tsx'));
  // Décima tanda: el lienzo vacío no monta la caja de crear (ni reserva lugar para ella).
  assert.doesNotMatch(src, /<CrearConIA /, 'volvió la caja de CrearConIA al lienzo');
  assert.doesNotMatch(src, /RESERVA_ABAJO_CREAR/);
  const editar = src.match(/\{rolAdmin && editandoIA && \(\n\s+<div data-crear-ia="editar" style=\{\{ position: 'absolute', \.\.\.franja, height: ALTO_CHAT_MAKO, display: tarjetaAbierta \? 'none' : 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none', zIndex: chatTrabajando \? Z_CHAT_ENCIMA : 4 \}\}>\n\s+<div style=\{\{ pointerEvents: 'auto', width: `min\(\$\{BARRA_IA_ANCHO\}px, 100%\)`, flex: 1, minHeight: 0, position: 'relative' \}\}>\n\s+<ChatMako secuenciaId=\{secuencia\.id\}/);
  assert.ok(editar, 'el chat de editar no está montado como se espera');
  assert.match(src, /onTarjetaAbierta=\{setTarjetaAbierta\}/);
});

test('el lienzo avisa la tarjeta abierta (calculada del dato, antes de pintar) y pasa la reserva', () => {
  const src = sinComentarios(leer('app/automations/FlujoLienzo.tsx'));
  assert.match(src, /const abierta = sel != null && grafo\.nodos\.some\(\(n\) => n\.id === sel\);/);
  assert.match(src, /useLayoutEffect\(\(\) => \{ avisarAbierta\.current\?\.\(abierta\); \}, \[abierta\]\);/);
  assert.match(src, /reservaAbajo=\{reservaAbajo\}/);
});

test('el Lienzo encuadra con el alto ÚTIL (sin la reserva) y la reserva entra en la firma', () => {
  const src = sinComentarios(leer('app/_components/Lienzo.tsx'));
  assert.match(src, /encuadreInicial\(grafo, \{ w, h: Math\.max\(1, h - reservaAbajo\), insetIzq, insetDer \}\)/);
  assert.match(src, /\+\$\{insetDer\}-\$\{reservaAbajo\}`/);
  assert.match(src, /\[grafo\.ancho, grafo\.alto, insetIzq, insetDer, reservaAbajo, pintar\]/);
});
