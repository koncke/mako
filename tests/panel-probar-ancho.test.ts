// =============================================================================
// «Probar» ancho y bajo (app/chatbot/PanelProbar.tsx) — segunda tanda, 08/10/2026
// =============================================================================
// Pedido de Martín, punto 8: «El "Probar" debe ser más ancho también, no tan largo, sino, se
// rompe el diseño». Decisión 11 del diseño (docs/chatbot-flujo-ramas-diseno.md): ~560 × ~400,
// arriba a la derecha, y el lugar lo decide quien lo monta (`muelles`). Acá se DIBUJA el panel
// (renderToStaticMarkup) y se mira la estructura, no el fuente:
//   · llena el rectángulo del padre (`width/height: 100%`);
//   · la cabecera es UN renglón: Probar · ↻ · ✕ Cerrar, sin los interruptores adentro;
//   · los dos interruptores van en UNA fila (su contenedor común envuelve, no apila);
//   · un email del flujo se dibuja como un MAIL (`CorreoDePrueba`), no como una burbuja.
//
// La estructura se lee con un recorrido de etiquetas con pila (`contenedorComun`): el elemento
// más adentro que contiene a los dos textos. Con los interruptores apilados ese contenedor es la
// columna; en una fila, la fila.
//
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  PanelProbar, CorreoDePrueba, dibujarMensajeProbar, PANEL_PROBAR_ANCHO, PANEL_PROBAR_ALTO,
} from '../app/chatbot/PanelProbar';
import type { SecuenciaDto } from '../app/chatbot/ChatAgentApp';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const SECUENCIA = {
  id: 7, clave: 'bienvenida', nombre: 'Bienvenida', etapa: 'nuevo', trigger_tipo: 'etapa',
  activa: false, pasos: [], inscriptos: 0, enviados: 0, estrategia: null, metricas: {},
} as unknown as SecuenciaDto;

const dibujar = (rolAdmin: boolean) => renderToStaticMarkup(createElement(PanelProbar, {
  secuencia: SECUENCIA, edicion: null, secuencias: [SECUENCIA], audios: [], negocio: 'Mi negocio',
  rolAdmin, etiquetaEtapa: (k: string) => k, onCerrar: () => {},
}));

const VACIOS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

/**
 * La etiqueta de apertura del elemento más adentro cuyo contenido tiene a `a` y a `b` (en ese
 * orden de aparición, cada uno la primera vez). Recorre las etiquetas con una pila.
 */
function contenedorComun(html: string, a: string, b: string): string {
  const ia = html.indexOf(a);
  const ib = html.indexOf(b);
  assert.ok(ia >= 0, `no está «${a}»`);
  assert.ok(ib >= 0, `no está «${b}»`);
  const re = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g;
  const pila: Array<{ tag: string; abre: string; desde: number }> = [];
  const abiertosEn = (pos: number): Array<{ tag: string; abre: string; desde: number }> => {
    pila.length = 0;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) && m.index < pos) {
      const tag = m[2].toLowerCase();
      if (m[1]) { while (pila.length && pila.pop()!.tag !== tag) { /* cierra hasta su apertura */ } continue; }
      if (m[4] || VACIOS.has(tag)) continue;
      pila.push({ tag, abre: m[0], desde: m.index });
    }
    return pila.slice();
  };
  const enA = abiertosEn(ia);
  const enB = abiertosEn(ib);
  let k = 0;
  while (k < enA.length && k < enB.length && enA[k].desde === enB[k].desde) k++;
  assert.ok(k > 0, 'no tienen un contenedor en común');
  return enA[k - 1].abre;
}

test('el tamaño que pide: ancho y bajo (~560 × ~400)', () => {
  assert.equal(PANEL_PROBAR_ANCHO, 560);
  assert.equal(PANEL_PROBAR_ALTO, 400);
  assert.ok(PANEL_PROBAR_ANCHO > PANEL_PROBAR_ALTO, 'más ancho que alto');
});

test('llena el rectángulo que le da su padre: width y height al 100 %', () => {
  const html = dibujar(true);
  const raiz = html.match(/<section aria-label="Probar" style="([^"]*)"/);
  assert.ok(raiz, 'no se dibujó el panel');
  assert.match(raiz[1], /(^|;)width:100%/);
  assert.match(raiz[1], /(^|;)height:100%/);
});

test('la cabecera es UN renglón: Probar, ↻ y ✕ Cerrar, sin los interruptores', () => {
  const html = dibujar(true);
  const cab = contenedorComun(html, '>Probar<', '>✕ Cerrar<');
  assert.doesNotMatch(cab, /<section/, 'el nombre y el cierre no comparten renglón');
  assert.match(cab, /display:flex/);
  assert.match(cab, /white-space:nowrap/);
  assert.doesNotMatch(cab, /flex-wrap:wrap|flex-direction:column/);
  // ↻ va en el mismo renglón que el nombre y el cierre.
  assert.equal(contenedorComun(html, '>Probar<', 'aria-label="Reiniciar"'), cab);
  // El cierre dice «Cerrar» (punto 10): un ✕ suelto no alcanzaba.
  assert.match(html, /aria-label="Cerrar"[^>]*>✕ Cerrar</);
});

test('los dos interruptores van en UNA fila (en un panel angosto la segunda baja, nunca se apila)', () => {
  const html = dibujar(true);
  const fila = contenedorComun(html, 'A mi WhatsApp', 'A mi email');
  assert.doesNotMatch(fila, /<section/, 'los interruptores quedaron sueltos en el panel');
  assert.match(fila, /display:flex/);
  assert.match(fila, /flex-wrap:wrap/);
  assert.doesNotMatch(fila, /flex-direction:column/, 'apilados: cada renglón es chat que no se ve');
  // Cada interruptor con su destino al lado.
  assert.doesNotMatch(contenedorComun(html, 'A mi WhatsApp', 'aria-label="Tu WhatsApp"'), /flex-wrap:wrap/);
  assert.doesNotMatch(contenedorComun(html, 'A mi email', 'aria-label="Tu email"'), /flex-wrap:wrap/);
});

test('sin ser admin no hay prueba de verdad: ni interruptores ni destino', () => {
  const html = dibujar(false);
  assert.doesNotMatch(html, /A mi WhatsApp|A mi email|Tu número|Tu email/);
  assert.match(html, />✕ Cerrar</);
});

test('un email del flujo se ve como un MAIL: ✉️ asunto, la vista previa en gris y el cuerpo recortado', () => {
  const html = renderToStaticMarkup(createElement(CorreoDePrueba, { asunto: 'Hola Luis', vistaPrevia: 'De Mi negocio', cuerpo: 'Te escribo por *Acme*' }));
  assert.match(html, /aria-label="Email"/);
  assert.match(html, /✉️<\/span><span[^>]*>Hola Luis</);
  assert.match(html, /color:var\(--faint\)[^"]*">De Mi negocio</, 'la vista previa, en gris');
  assert.match(html, /-webkit-line-clamp:4/, 'el cuerpo se recorta sin cortar el texto');
  assert.doesNotMatch(html, /\*Acme\*/, 'las marcas se pintan como en el envío');
  // Vacío: «Sin asunto», sin renglón de vista previa y el cuerpo dice que falta.
  const vacio = renderToStaticMarkup(createElement(CorreoDePrueba, { asunto: '', vistaPrevia: '', cuerpo: ' ' }));
  assert.match(vacio, />Sin asunto</);
  assert.doesNotMatch(vacio, /color:var\(--faint\)/);
  assert.match(vacio, />Sin escribir</);
});

test('`dibujarMensajeProbar` dibuja a mano sólo el email con su correo; lo demás es la burbuja de siempre', () => {
  const correo = { asunto: 'A', vistaPrevia: '', cuerpo: 'C' };
  const email = dibujarMensajeProbar({ id: 'em-1', fromMe: false, tipo: 'email', correo } as never);
  assert.ok(email, 'el email tiene que dibujarse a mano');
  assert.match(renderToStaticMarkup(createElement('div', null, email)), /aria-label="Email"/);
  assert.equal(dibujarMensajeProbar({ id: 'tx-1', fromMe: false, texto: 'hola' }), null);
  assert.equal(dibujarMensajeProbar({ id: 'em-2', fromMe: false, tipo: 'email' }), null, 'sin correo, la burbuja');
});

test('el email del recorrido sale por `correoDeEjemplo` y viaja con su correo adentro del mensaje', () => {
  const src = sinComentarios(leer('app/chatbot/PanelProbar.tsx'));
  const rama = src.slice(src.indexOf("if (p.canal === 'email') {"), src.indexOf("if (p.tipo === 'audio') {"));
  assert.ok(rama.length > 0 && rama.length < 900, `el recorte de la rama del email mide ${rama.length}`);
  assert.match(rama, /const correo = correoDeEjemplo\(p, c\.negocio\);/);
  assert.match(rama, /poner\(\{ id: nuevoId\('em'\), fromMe: false, tipo: 'email', correo,/);
  // Lo que sale de verdad es lo que se ve: el asunto y el cuerpo del mismo correo.
  assert.match(rama, /mandarReal\(\{ canal: 'email', tipo: 'texto', texto: correo\.cuerpo, asunto: correo\.asunto \}, nodo, enRespuesta\);/);
  // Nada de un <select> nativo ni de voseo en lo que se dibuja (los guards de la casa lo miran igual).
  assert.doesNotMatch(src, /<select\b/);
});

// ROTURAS (08/10/2026), una por vez sobre app/chatbot/PanelProbar.tsx, con un arnés que rompe, corre
// este archivo y restaura DE MEMORIA (nunca con git checkout) verificando con md5 que volviera
// idéntico. Sin romper: 8 pass / 0 fail. Las 11 cayeron:
//   · P1 la raíz sin `width: '100%'`: 7 pass / 1 fail. · P2 sin `height: '100%'`: 7 / 1.
//   · P3 la cabecera en columna (sin `whiteSpace: 'nowrap'`): 7 / 1.
//   · P4 el cierre vuelve a ser un ✕ suelto: 6 / 2.
//   · P5 los interruptores apilados, como antes (`flexDirection: 'column'`): 7 / 1.
//   · P6 `dibujarMensajeProbar` devuelve null y el email vuelve a la burbuja: 7 / 1.
//   · P7 el email sale sin su `correo` adentro del mensaje: 7 / 1.
//   · P8 la vista previa no va en gris: 7 / 1. · P9 el cuerpo sin recortar: 7 / 1.
//   · P10 lo que sale de verdad lleva el asunto crudo del paso y no el que se ve: 7 / 1.
//   · P11 el cuerpo crudo, sin las marcas pintadas: 7 / 1.
