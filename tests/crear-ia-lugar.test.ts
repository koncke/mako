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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { grafoDeSecuencia } from '../lib/flujo-conversacion';
import { encuadreInicial, muelles, type Muelles } from '../lib/lienzo-grafo';
import { franjaIA, CAJA_IA_ANCHO, BARRA_IA_ANCHO, CAJA_IA_ALTO, RESERVA_ABAJO_CREAR } from '../lib/crear-ia-lugar';
import { SecuenciaPerfil } from '../app/chatbot/SecuenciaPerfil';
import type { SecuenciaDto } from '../app/chatbot/ChatAgentApp';

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

test('los anchos de la franja son los que dibuja CrearConIA', () => {
  const src = sinComentarios(leer('app/chatbot/CrearConIA.tsx'));
  assert.match(src, new RegExp(`caja: \\{\\n\\s+width: 'min\\(${CAJA_IA_ANCHO}px, 100%\\)'`));
  assert.match(src, new RegExp(`barraWrap: \\{[^}]*width: 'min\\(${BARRA_IA_ANCHO}px, 100%\\)'`));
});

const SEC = {
  id: 7, clave: 'nueva', nombre: 'Nueva automatización', etapa: 'nuevo', trigger_tipo: 'manual',
  activa: false, pasos: [], inscriptos: 0, enviados: 0, estrategia: null, metricas: {},
} as unknown as SecuenciaDto;

test('dibujada: la caja de una automatización vacía flota en la franja, y la capa no toma el puntero', () => {
  const m = muelles({ w: 1440, h: 760 }, { listaAbierta: true, probarAbierto: false, editorAbierto: true });
  const html = renderToStaticMarkup(createElement(SecuenciaPerfil, {
    secuencia: SEC, secuencias: [SEC], productos: [], disparadores: [], onAbrirClave: () => {}, objetivos: [],
    etiquetaEtapa: (k: string) => k, rolAdmin: true, audios: [], negocio: 'Mi negocio', canalCaido: false, tz: null,
    onAudioNuevo: () => {}, onCambio: () => {}, muelles: m,
  } as Parameters<typeof SecuenciaPerfil>[0]));
  const capa = html.match(/<div data-crear-ia="crear" style="([^"]*)"><div style="([^"]*)">/);
  assert.ok(capa, 'no se dibujó la caja de crear');
  const f = franjaIA(m);
  assert.match(capa[1], new RegExp(`position:absolute;left:${f.left}px;right:${f.right}px;bottom:${f.bottom}px;display:flex`));
  assert.match(capa[1], /pointer-events:none/);
  assert.doesNotMatch(capa[1], /inset:0/);
  assert.match(capa[2], new RegExp(`pointer-events:auto;width:min\\(${CAJA_IA_ANCHO}px, 100%\\)`));
});

test('las dos se ESCONDEN con una tarjeta abierta, sin desmontar CrearConIA', () => {
  const src = sinComentarios(leer('app/chatbot/SecuenciaPerfil.tsx'));
  const crear = src.match(/\{rolAdmin && pasos\.length === 0 && \(\n\s+<div data-crear-ia="crear" style=\{\{ position: 'absolute', \.\.\.franja, display: tarjetaAbierta \? 'none' : 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 4 \}\}>\n\s+<div style=\{\{ pointerEvents: 'auto', width: `min\(\$\{CAJA_IA_ANCHO\}px, 100%\)` \}\}>\n\s+<CrearConIA modo="crear"/);
  assert.ok(crear, 'la caja de crear no está montada como se espera (o depende de tarjetaAbierta para montarse)');
  const editar = src.match(/\{rolAdmin && editandoIA && pasos\.length > 0 && \(\n\s+<div data-crear-ia="editar" style=\{\{ position: 'absolute', \.\.\.franja, display: tarjetaAbierta \? 'none' : 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 4 \}\}>\n\s+<div style=\{\{ pointerEvents: 'auto', width: `min\(\$\{BARRA_IA_ANCHO\}px, 100%\)` \}\}>\n\s+<CrearConIA modo="editar"/);
  assert.ok(editar, 'la barra de editar no está montada como se espera');
  assert.match(src, /onTarjetaAbierta=\{setTarjetaAbierta\}/);
  assert.match(src, /reservaAbajo=\{rolAdmin && pasos\.length === 0 \? RESERVA_ABAJO_CREAR : 0\}/);
});

test('el lienzo avisa la tarjeta abierta (calculada del dato, antes de pintar) y pasa la reserva', () => {
  const src = sinComentarios(leer('app/chatbot/FlujoLienzo.tsx'));
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
