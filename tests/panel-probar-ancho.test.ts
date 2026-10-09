// =============================================================================
// «Probar» de UN canal (app/chatbot/PanelProbar.tsx) — tercera tanda, 09/10/2026
// =============================================================================
// Pedido de Martín, punto 14: «al darle probar debería ser un desplegable para probar WhatsApp o
// Email. No que dentro me salga la interfaz de WhatsApp y a su vez me aparezca un campo de Email,
// es contraintuitivo... Si selecciono Email, claro que el diseño que debe aparecer es el de Gmail.
// Por defecto, siempre comienza la animación de prueba de recibiendo la automatización y claro un
// botón para probar con un número o email, dependiendo...». Decisión 14 del diseño.
//
// Lo de la segunda tanda que sigue (punto 8, «más ancho, no tan largo»): ~560 × ~400, llena el
// rectángulo que le da `muelles`, la cabecera en UN renglón.
//
// Se DIBUJA el panel (renderToStaticMarkup) y se mira la estructura; la bandeja (`BandejaGmail`) se
// dibuja sola con sus correos; lo que vive en timers (el recorrido) se fija en el fuente, recortado
// a su función. La lógica del recorrido la EJECUTA tests/simulador-grafo.test.ts.
//
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  PanelProbar, BandejaGmail, cuandoLlega, remitenteVisible, vistaDeFila, PANEL_PROBAR_ANCHO, PANEL_PROBAR_ALTO,
  type CanalProbar, type CorreoRecibido,
} from '../app/chatbot/PanelProbar';
import { paramsDeVista } from '../app/chatbot/EditorEmailGmail';
import { renderEmailHtml } from '../lib/email-html';
import type { SecuenciaDto } from '../app/chatbot/ChatAgentApp';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const PANEL = () => sinComentarios(leer('app/chatbot/PanelProbar.tsx'));

const SECUENCIA = {
  id: 7, clave: 'bienvenida', nombre: 'Bienvenida', etapa: 'nuevo', trigger_tipo: 'etapa',
  activa: false, pasos: [], inscriptos: 0, enviados: 0, estrategia: null, metricas: {},
} as unknown as SecuenciaDto;

const dibujar = (rolAdmin: boolean, canal: CanalProbar = 'whatsapp') => renderToStaticMarkup(createElement(PanelProbar, {
  secuencia: SECUENCIA, edicion: null, secuencias: [SECUENCIA], audios: [], negocio: 'Mi negocio',
  rolAdmin, etiquetaEtapa: (k: string) => k, canal, onCerrar: () => {},
}));

const VACIOS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

/**
 * La etiqueta de apertura del elemento más adentro cuyo contenido tiene a `a` y a `b` (cada uno la
 * primera vez que aparece). Recorre las etiquetas con una pila.
 */
function contenedorComun(html: string, a: string, b: string): string {
  const ia = html.indexOf(a);
  const ib = html.indexOf(b);
  assert.ok(ia >= 0, `no está «${a}»`);
  assert.ok(ib >= 0, `no está «${b}»`);
  const re = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g;
  const abiertosEn = (pos: number): Array<{ tag: string; abre: string; desde: number }> => {
    const pila: Array<{ tag: string; abre: string; desde: number }> = [];
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) && m.index < pos) {
      const tag = m[2].toLowerCase();
      if (m[1]) { while (pila.length && pila.pop()!.tag !== tag) { /* cierra hasta su apertura */ } continue; }
      if (m[4] || VACIOS.has(tag)) continue;
      pila.push({ tag, abre: m[0], desde: m.index });
    }
    return pila;
  };
  const enA = abiertosEn(ia);
  const enB = abiertosEn(ib);
  let k = 0;
  while (k < enA.length && k < enB.length && enA[k].desde === enB[k].desde) k++;
  assert.ok(k > 0, 'no tienen un contenedor en común');
  return enA[k - 1].abre;
}

const correo = (o: Partial<CorreoRecibido> & { id: string }): CorreoRecibido => ({
  asunto: 'Hola', vistaPrevia: '', cuerpo: 'Cuerpo', minuto: 0, leido: false, ...o,
});
const bandeja = (p: Partial<Parameters<typeof BandejaGmail>[0]>) => renderToStaticMarkup(createElement(BandejaGmail, {
  correos: [], abierto: null, recibiendo: false, terminado: false, remitente: 'Mi negocio <hola@minegocio.com>', negocio: 'Mi negocio',
  onAbrir: () => {}, onVolver: () => {}, ...p,
}));

// ── Lo que sigue de la segunda tanda ─────────────────────────────────────────────

test('el tamaño que pide: ancho y bajo (~560 × ~400)', () => {
  assert.equal(PANEL_PROBAR_ANCHO, 560);
  assert.equal(PANEL_PROBAR_ALTO, 400);
});

test('llena el rectángulo que le da su padre: width y height al 100 %, en los dos canales', () => {
  for (const canal of ['whatsapp', 'email'] as const) {
    const raiz = dibujar(true, canal).match(/<section aria-label="Probar" data-canal="(\w+)" style="([^"]*)"/);
    assert.ok(raiz, `no se dibujó el panel de ${canal}`);
    assert.equal(raiz[1], canal);
    assert.match(raiz[2], /(^|;)width:100%/);
    assert.match(raiz[2], /(^|;)height:100%/);
  }
});

test('la cabecera es UN renglón: probar de verdad a la izquierda y ↻; sin título ni «Cerrar» adentro (cuarta tanda, punto 3)', () => {
  const html = dibujar(true);
  const cab = contenedorComun(html, '>Probar en WhatsApp<', 'aria-label="Reiniciar"');
  assert.doesNotMatch(cab, /<section/, 'probar de verdad y ↻ no comparten renglón');
  assert.match(cab, /display:flex/);
  assert.match(cab, /white-space:nowrap/);
  // «elimina ese texto» (el «Probar WhatsApp» de la cabecera) y el «Cerrar» vive en el chrome.
  assert.doesNotMatch(html, />Probar<\/span>|✕ Cerrar/);
});

// ── Punto 14: un canal por vez ─────────────────────────────────────────────────

test('WhatsApp: el teléfono con su caja para contestar, y abajo TU número con su botón; nada de email', () => {
  const html = dibujar(true, 'whatsapp');
  assert.match(html, /placeholder="Responde como el lead…"/, 'sin la caja para contestar como el lead');
  assert.doesNotMatch(html, /aria-label="Recibidos"/, 'la bandeja de email apareció en WhatsApp');
  assert.match(html, /aria-label="Tu WhatsApp"[^>]*placeholder="Tu número"/);
  assert.match(html, />Probar en WhatsApp</);
  // El campo y su botón, en UNA fila, ARRIBA (antes del teléfono).
  const fila = contenedorComun(html, 'aria-label="Tu WhatsApp"', '>Probar en WhatsApp<');
  assert.match(fila, /^<form /);
  assert.ok(html.indexOf('>Probar en WhatsApp<') < html.indexOf('Responde como el lead'), 'el botón de verdad no está arriba');
  assert.doesNotMatch(html, /Tu email|Probar en Email|A mi email|A mi WhatsApp/, 'volvieron los dos canales a la vez');
});

test('Email: la bandeja tipo Gmail, sin caja para contestar, y abajo TU email con su botón; nada de WhatsApp', () => {
  const html = dibujar(true, 'email');
  assert.match(html, /aria-label="Recibidos"/, 'sin la bandeja');
  assert.doesNotMatch(html, /Responde como el lead/, 'una respuesta del lead es un WhatsApp: no va en la bandeja');
  assert.match(html, /aria-label="Tu email"[^>]*placeholder="Tu email"/);
  assert.match(html, />Probar en Email</);
  assert.doesNotMatch(html, /Tu número|Probar en WhatsApp|A mi email|A mi WhatsApp/);
});

test('sin ser admin no hay prueba de verdad: ni el destino ni el botón', () => {
  for (const canal of ['whatsapp', 'email'] as const) {
    const html = dibujar(false, canal);
    assert.doesNotMatch(html, /Tu número|Tu email|Probar en (WhatsApp|Email)/);
    assert.match(html, /aria-label="Reiniciar"/);
  }
});

test('el botón de verdad arranca de nuevo el MISMO recorrido, de verdad; ↻ vuelve a la prueba sin envío', () => {
  const src = PANEL();
  const reiniciar = src.slice(src.indexOf('const reiniciar = (deVerdad = false) => {'), src.indexOf('const probarDeVerdad'));
  assert.ok(reiniciar.length > 50 && reiniciar.length < 600, `el recorte de reiniciar mide ${reiniciar.length}`);
  assert.match(reiniciar, /realRef\.current = deVerdad; setReal\(deVerdad\);/);
  assert.match(reiniciar, /arrancarRefs\(\);/);
  const deVerdad = src.slice(src.indexOf('const probarDeVerdad = (e: FormEvent) => {'), src.indexOf('const elegirRama'));
  assert.match(deVerdad, /if \(!destino\.trim\(\)\) return;\n\s+reiniciar\(true\);/);
  // ↻ y «Cambió · ↻» llaman SIN argumento: `onClick={reiniciar}` le pasaría el evento y saldría de verdad.
  assert.equal((src.match(/onClick=\{\(\) => reiniciar\(\)\}/g) ?? []).length, 2);
  assert.doesNotMatch(src, /onClick=\{reiniciar\}/);
});

test('lo del OTRO canal ni se dibuja ni sale: el filtro vive en el panel, y lo real mira el canal', () => {
  const src = PANEL();
  const avanzar = src.slice(src.indexOf('function avanzar() {'), src.indexOf('const arrancarRefs = () => {'));
  assert.ok(avanzar.length > 0 && avanzar.length < 3200, `el recorte de avanzar mide ${avanzar.length}`);
  assert.match(avanzar, /const delPaso: CanalProbar = paso\.canal === 'email' \? 'email' : 'whatsapp';\n\s+if \(delPaso !== ctx\.current\.canal\) \{ luego\(0, avanzar\); return; \}/);
  // El filtro va ANTES de dibujar y de mandar nada.
  assert.ok(avanzar.indexOf('if (delPaso !== ctx.current.canal)') < avanzar.indexOf('mostrarPaso('));
  const mandar = src.slice(src.indexOf('const mandarReal = ('), src.indexOf('const mostrarPaso = ('));
  assert.match(mandar, /const vaWa = realRef\.current && c\.canal === 'whatsapp' && m\.canal === 'whatsapp';/);
  assert.match(mandar, /const vaEmail = realRef\.current && c\.canal === 'email' && m\.canal === 'email';/);
  // El destino es el del campo del canal: el teléfono O el email, nunca los dos.
  assert.match(mandar, /const destinoReal = vaEmail \? \{ telefono: null, email: c\.destino \} : \{ telefono: c\.destino, email: null \};/);
  // El simulador NO filtra por canal (eso es del panel).
  assert.doesNotMatch(sinComentarios(leer('lib/simulador-grafo.ts')), /CanalProbar/);
});

test('el email del recorrido va a la BANDEJA con su minuto, y lo que sale de verdad es lo que se ve', () => {
  const src = PANEL();
  const rama = src.slice(src.indexOf("if (p.canal === 'email') {"), src.indexOf("if (p.tipo === 'audio') {"));
  assert.ok(rama.length > 0 && rama.length < 700, `el recorte de la rama del email mide ${rama.length}`);
  assert.match(rama, /const correo = correoDeEjemplo\(p, c\.negocio\);/);
  assert.match(rama, /ponerCorreo\(\{ id: nuevoId\('em'\), \.\.\.correo, minuto, leido: false \}\);/);
  // (Integración, parte C: lo que sale de verdad lleva el HTML del editor rico, el mismo de la bandeja.)
  assert.match(rama, /mandarReal\(\{ canal: 'email', tipo: 'texto', texto: correo\.cuerpo, asunto: correo\.asunto, \.\.\.\(correo\.html \? \{ html: correo\.html \} : \{\}\) \}, nodo, enRespuesta\);/);
  assert.doesNotMatch(rama, /\bponer\(/, 'el email volvió a meterse en el hilo de WhatsApp');
  assert.doesNotMatch(src, /<select\b/);
  // Y el mail abierto se dibuja con ese HTML (`cuerpoHtml` → `bodyHtml`), y la prueba real lo manda.
  assert.match(src, /renderEmailHtml\(paramsDeVista\(\{ asunto: correo\.asunto, preheader: correo\.vistaPrevia, cuerpo: correo\.cuerpo, cuerpoHtml: correo\.html \|\| null, negocio, remitente \}\)\)/);
  assert.match(sinComentarios(leer('lib/prueba-paso.ts')), /renderEmailHtml\(\{ subject: envio\.asunto, bodyText: envio\.texto, bodyHtml: envio\.html \|\| undefined \}\)/);
});

// ── La bandeja tipo Gmail ──────────────────────────────────────────────────────

test('la bandeja: remitente, asunto, vista previa y cuándo llega; lo nuevo arriba y lo no leído en negrita', () => {
  const html = bandeja({ correos: [
    correo({ id: 'a', asunto: 'Bienvenida', vistaPrevia: 'Te cuento todo', minuto: 0, leido: true }),
    correo({ id: 'b', asunto: 'Seguimiento', cuerpo: 'Hola *Luis*, ¿pudiste ver?', minuto: 1440 }),
  ] });
  assert.match(html, /aria-label="Recibidos"/);
  assert.ok(html.indexOf('Seguimiento') < html.indexOf('Bienvenida'), 'lo nuevo va arriba');
  assert.match(html, />Mi negocio</, 'el remitente con la regla del envío');
  assert.match(html, />Te cuento todo</, 'la vista previa es el preheader');
  assert.match(html, />Hola Luis, ¿pudiste ver\?</, 'sin preheader, el principio del cuerpo sin marcas');
  assert.match(html, />Ahora</);
  assert.match(html, />\+1 d</);
  // El no leído en negrita; el leído no. Y el contador cuenta los no leídos.
  assert.match(html, /font-weight:700[^"]*">Seguimiento</);
  assert.match(html, /font-weight:400[^"]*">Bienvenida</);
  assert.match(html, /Recibidos<\/span><span[^>]*>1</);
});

test('la bandeja vacía: la fila que late mientras llega, y «Sin correos» sólo al terminar', () => {
  assert.match(bandeja({ recibiendo: true }), /aria-label="Llegando"[^>]*class="pp-pulso"/);
  assert.doesNotMatch(bandeja({}), /Sin correos/, 'un «Sin correos» que aparece y se va es un parpadeo');
  assert.match(bandeja({ terminado: true }), />Sin correos</);
});

test('el mail abierto: el MISMO render que sale (renderEmailHtml con paramsDeVista), y ← vuelve', () => {
  const c = correo({ id: 'x', asunto: 'Tu acceso', vistaPrevia: 'Adentro', cuerpo: 'Hola\n\nTe espero en {{negocio}}', minuto: 120 });
  const html = bandeja({ correos: [c], abierto: 'x' });
  assert.match(html, /aria-label="Correo abierto"/);
  assert.match(html, /aria-label="Volver a Recibidos"/);
  assert.match(html, />\+2 h</);
  assert.match(html, /<strong[^>]*>Mi negocio<\/strong><span[^>]*> &lt;hola@minegocio\.com&gt;<\/span>/);
  const esperado = renderEmailHtml(paramsDeVista({ asunto: c.asunto, preheader: c.vistaPrevia, cuerpo: c.cuerpo, negocio: 'Mi negocio', remitente: 'Mi negocio <hola@minegocio.com>' }));
  const srcDoc = html.match(/<iframe[^>]*srcDoc="([^"]*)"/i)?.[1] ?? html.match(/<iframe[^>]*srcdoc="([^"]*)"/i)?.[1];
  assert.ok(srcDoc, 'el mail abierto no tiene el render');
  const desescapar = (s: string) => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  assert.equal(desescapar(srcDoc), esperado);
  assert.match(esperado, /Te espero en Mi negocio/, 'las variables del negocio, como en el envío');
});

test('las piezas puras: cuándo llega, quién lo manda y la vista previa de la fila', () => {
  assert.equal(cuandoLlega(0), 'Ahora');
  assert.equal(cuandoLlega(30), '+30 min');
  assert.equal(cuandoLlega(120), '+2 h');
  assert.equal(cuandoLlega(1440 * 3), '+3 d');
  assert.equal(cuandoLlega(Number.NaN), 'Ahora');
  assert.deepEqual(remitenteVisible('Acme <hola@acme.com>', 'Mi negocio'), { nombre: 'Acme', mail: 'hola@acme.com' });
  assert.deepEqual(remitenteVisible('hola@acme.com', 'Mi negocio'), { nombre: 'Mi negocio', mail: 'hola@acme.com' }, 'un mail pelado no tiene nombre');
  assert.deepEqual(remitenteVisible('', 'Mi negocio'), { nombre: 'Mi negocio', mail: '' }, 'sin remitente no se inventa un mail');
  assert.deepEqual(remitenteVisible('', ''), { nombre: 'Tu negocio', mail: '' });
  assert.equal(vistaDeFila({ vistaPrevia: '  Lo gris  ', cuerpo: 'x' }), 'Lo gris');
  assert.equal(vistaDeFila({ vistaPrevia: '', cuerpo: '*Hola*\n\n_tú_ ~ya~' }), 'Hola tú ya');
});

// ROTURAS (09/10/2026), una por vez sobre app/chatbot/PanelProbar.tsx, con un arnés que rompe, corre
// este archivo y restaura DE MEMORIA (nunca con git checkout) verificando con md5 que volviera
// idéntico. Sin romper: 13 pass / 0 fail. Las 13 cayeron:
//   · P1 sin el filtro de canal (lo del otro canal se dibuja): 12 / 1.
//   · P2 lo real sin mirar el canal del panel: 12 / 1. · P3 el email con el teléfono: 12 / 1.
//   · P4 el email pide un número: 12 / 1. · P5 el email vuelve al hilo de WhatsApp: 12 / 1.
//   · P6 ↻ con `onClick={reiniciar}` (le pasaría el evento y saldría de verdad): 12 / 1.
//   · P7 lo nuevo abajo: 12 / 1. · P8 «Sin correos» antes de terminar: 12 / 1.
//   · P9 el mail abierto con otro render que el del envío: 12 / 1. · P10 los días en horas: 11 / 2.
//   · P11 el remitente sin la regla del envío: 12 / 1. · P12 el asunto siempre en negrita: 12 / 1.
//   · P13 la prueba real sin ser admin: 12 / 1.
