// =============================================================================
// «Probar» de UN canal (app/automations/PanelProbar.tsx) — tercera tanda, 09/10/2026
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
  PanelProbar, BandejaGmail, MenuDestinos, cuandoLlega, remitenteVisible, vistaDeFila, destinoLegible, PANEL_PROBAR_ANCHO, PANEL_PROBAR_ALTO,
  canalDelPaso, CANALES_PROBAR, pildoraEnLaBandeja, emisoresDeLineas, emisoresDeRemitentes, emisorAEnviar,
  type CanalProbar, type CorreoRecibido,
} from '../app/automations/PanelProbar';
import { paramsDeVista } from '../app/automations/EditorEmailGmail';
import { renderEmailHtml } from '../lib/email-html';
import type { SecuenciaDto } from '../app/automations/ChatAgentApp';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const PANEL = () => sinComentarios(leer('app/automations/PanelProbar.tsx'));

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

// ⚠️ QUINTA TANDA, PUNTO 1 (09/10/2026) — CAMBIÓ LO QUE ESTOS TESTS FIJABAN. Pedido literal: «no
// elimines el logo de WhatsApp o Email arriba a la izquierda, y pon al lado del botón de "Reiniciar" el
// botón de "Probar en WhatsApp", y que no esté desplegado el "Tu número", sino que al clickear ese botón
// salga el desplegable... primero... los números que ya tiene guardado, y abajo un botón de "Nuevo
// número"... Esto mismo con Email». Antes fijaban el campo «Tu número» + el botón A LA IZQUIERDA.

test('la cabecera es UN renglón: el logo a la izquierda, «Probar en WhatsApp» al lado de ↻; sin título ni «Cerrar»', () => {
  const html = dibujar(true);
  const cab = contenedorComun(html, '>Probar en WhatsApp<', 'aria-label="Reiniciar"');
  assert.doesNotMatch(cab, /<section/, 'probar de verdad y ↻ no comparten renglón');
  assert.match(cab, /display:flex/);
  assert.match(cab, /white-space:nowrap/);
  // El logo del canal, en el MISMO renglón y ANTES que todo.
  const logo = html.indexOf('alt="WhatsApp"');
  assert.ok(logo > 0 && logo < html.indexOf('>Probar en WhatsApp<'), 'el logo no está arriba a la izquierda');
  assert.equal(contenedorComun(html, 'alt="WhatsApp"', 'aria-label="Reiniciar"'), cab, 'el logo se fue a otro renglón');
  // «Probar en WhatsApp» pegado a ↻: entre los dos, sólo el cierre de uno y la apertura del otro.
  const entre = html.slice(html.indexOf('>Probar en WhatsApp<') + '>Probar en WhatsApp<'.length, html.indexOf('aria-label="Reiniciar"'));
  assert.equal((entre.match(/<button/g) ?? []).length, 1, 'otro botón se metió entre «Probar en WhatsApp» y ↻');
  assert.doesNotMatch(entre, /<input|<form|<span|<img/, 'algo se metió entre «Probar en WhatsApp» y ↻');
  // «elimina ese texto» (el «Probar WhatsApp» de la cabecera) y el «Cerrar» vive en el chrome.
  assert.doesNotMatch(html, />Probar<\/span>|✕ Cerrar/);
});

// ── Punto 14: un canal por vez ─────────────────────────────────────────────────

test('WhatsApp: el teléfono con su caja para contestar; «Tu número» NO está desplegado: lo abre el botón', () => {
  const html = dibujar(true, 'whatsapp');
  assert.match(html, /placeholder="Responde como el lead…"/, 'sin la caja para contestar como el lead');
  assert.doesNotMatch(html, /aria-label="Recibidos"/, 'la bandeja de email apareció en WhatsApp');
  assert.doesNotMatch(html, /placeholder="Tu número"|aria-label="Tu WhatsApp"|<form /, 'el campo volvió a estar desplegado');
  assert.match(html, /aria-haspopup="dialog"[^>]*>Probar en WhatsApp</, 'el botón abre el desplegable');
  assert.ok(html.indexOf('>Probar en WhatsApp<') < html.indexOf('Responde como el lead'), 'el botón de verdad no está arriba');
  assert.doesNotMatch(html, /Tu email|Probar en Email|A mi email|A mi WhatsApp/, 'volvieron los dos canales a la vez');
});

test('Email: la bandeja tipo Gmail con su logo, sin caja para contestar, y el mismo botón; nada de WhatsApp', () => {
  const html = dibujar(true, 'email');
  assert.match(html, /aria-label="Recibidos"/, 'sin la bandeja');
  assert.doesNotMatch(html, /Responde como el lead/, 'una respuesta del lead es un WhatsApp: no va en la bandeja');
  assert.ok(html.indexOf('alt="Email"') > 0 && html.indexOf('alt="Email"') < html.indexOf('>Probar en Email<'), 'el logo del email no está arriba a la izquierda');
  assert.doesNotMatch(html, /placeholder="Tu email"|<form /);
  assert.match(html, /aria-haspopup="dialog"[^>]*>Probar en Email</);
  assert.doesNotMatch(html, /Tu número|Probar en WhatsApp|A mi email|A mi WhatsApp|alt="WhatsApp"/);
});

test('el desplegable: primero los GUARDADOS (elegir uno prueba ahí) y abajo «Nuevo número» con su form de banderas', () => {
  const menu = (p: Partial<Parameters<typeof MenuDestinos>[0]>) => renderToStaticMarkup(createElement(MenuDestinos, {
    esEmail: false, guardados: { telefonos: ['5491125052605', '5215512345678'], emails: ['yo@mio.com'] }, onElegir: () => {},
    nuevo: false, onNuevo: () => {}, onProbarNuevo: () => {}, error: null,
    formTelefono: createElement('i', null, 'FORM-TEL'), formEmail: createElement('i', null, 'FORM-MAIL'), puedeProbarNuevo: false, ...p,
  }));
  const html = menu({});
  // Los guardados primero, con la lada separada, y «Nuevo número» ABAJO.
  assert.ok(html.indexOf('+54 91125052605') > 0 && html.indexOf('+52 15512345678') > html.indexOf('+54 91125052605'), html);
  assert.ok(html.indexOf('Nuevo número') > html.indexOf('+52 15512345678'), '«Nuevo número» va abajo');
  assert.doesNotMatch(html, /FORM-TEL/, 'el form sólo aparece al tocar «Nuevo número»');
  // Al tocar «Nuevo número»: el form de siempre y su botón; el email, lo mismo con su form.
  const nuevo = menu({ nuevo: true, error: 'Número incompleto' });
  assert.match(nuevo, /<form[^>]*>[\s\S]*FORM-TEL[\s\S]*Número incompleto[\s\S]*>Probar</);
  assert.doesNotMatch(nuevo, /Nuevo número/);
  assert.match(menu({ esEmail: true }), />yo@mio\.com</);
  assert.match(menu({ esEmail: true }), /Nuevo email/);
  assert.match(menu({ esEmail: true, nuevo: true }), /FORM-MAIL/);
  // «No pude leer» no es «no tiene», y la lista vacía lo dice.
  assert.match(menu({ guardados: 'error' }), /No pude leer tus números/);
  assert.match(menu({ guardados: { telefonos: [], emails: [] } }), /Sin números guardados/);
  assert.match(menu({ guardados: null }), /Cargando/);
  // El form del número es EL de la casa (con la bandera), no un input suelto.
  const src = PANEL();
  assert.match(src, /<TelefonoConPais lada=\{lada\} numero=\{numero\} onLada=\{setLada\}/);
  assert.match(src, /portalTo=\{cajaMenu\}/, 'sin portalTo, el selector del país se abre DETRÁS del desplegable');
  assert.equal(destinoLegible('5491125052605', false), '+54 91125052605');
  assert.equal(destinoLegible(' yo@mio.com ', true), 'yo@mio.com');
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
  const reiniciar = src.slice(src.indexOf('const reiniciar = (deVerdad = false) => {'), src.indexOf('const [menu, setMenu] = useState(false);'));
  assert.ok(reiniciar.length > 50 && reiniciar.length < 600, `el recorte de reiniciar mide ${reiniciar.length}`);
  assert.match(reiniciar, /realRef\.current = deVerdad; setReal\(deVerdad\);/);
  assert.match(reiniciar, /arrancarRefs\(\);/);
  // Elegir un destino del desplegable (o probar uno nuevo) arranca el recorrido DE VERDAD a ése.
  const deVerdad = src.slice(src.indexOf('const probarA = (d: string) => {'), src.indexOf('const probarNuevo = (e: FormEvent) => {'));
  assert.ok(deVerdad.length > 50 && deVerdad.length < 500, `el recorte de probarA mide ${deVerdad.length}`);
  assert.match(deVerdad, /if \(!limpio\) return;/);
  assert.match(deVerdad, /ctx\.current = \{ \.\.\.ctx\.current, destino: limpio \};\n\s+reiniciar\(true\);/, 'el primer envío tiene que ver el destino nuevo');
  const nuevo = src.slice(src.indexOf('const probarNuevo = (e: FormEvent) => {'), src.indexOf('const abrirCorreo'));
  assert.match(nuevo, /sanearDestinoPrueba\(\{ telefono: unirTelefono\(lada, numero\) \}\)\.telefono/, 'la lada y el número, con la regla del server');
  assert.match(nuevo, /postar\(\{ action: 'guardar-destino', destino:/);
  assert.match(nuevo, /probarA\(d\);/);
  // ↻ y «Cambió · ↻» llaman SIN argumento: `onClick={reiniciar}` le pasaría el evento y saldría de verdad.
  assert.equal((src.match(/onClick=\{\(\) => reiniciar\(\)\}/g) ?? []).length, 2);
  assert.doesNotMatch(src, /onClick=\{reiniciar\}/);
});

test('lo del OTRO canal ni se dibuja ni sale: el filtro vive en el panel, y lo real mira el canal', () => {
  const src = PANEL();
  const avanzar = src.slice(src.indexOf('function avanzar() {'), src.indexOf('const arrancarRefs = () => {'));
  assert.ok(avanzar.length > 0 && avanzar.length < 3200, `el recorte de avanzar mide ${avanzar.length}`);
  // (Quinta tanda, punto 1: en el medio se marca «ya le escribimos», salga por el canal que salga.)
  // (Sexta tanda: el canal de un paso sale de UNA función, `canalDelPaso`, la misma del contacto.)
  assert.match(avanzar, /const delPaso: CanalProbar = canalDelPaso\(paso\);\s+huboMensaje\.current = true;\s+if \(delPaso !== ctx\.current\.canal\) \{ luego\(0, avanzar\); return; \}/);
  assert.equal(canalDelPaso({ canal: 'email' }), 'email');
  assert.equal(canalDelPaso({ canal: 'whatsapp' }), 'whatsapp');
  assert.equal(canalDelPaso({}), 'whatsapp', 'un paso sin canal es un WhatsApp, como en el motor');
  // (Sexta tanda, parte «canales»: Instagram y Messenger son su propio canal, no WhatsApp.)
  assert.equal(canalDelPaso({ canal: 'instagram' }), 'instagram');
  assert.equal(canalDelPaso({ canal: 'messenger' }), 'messenger');
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
  // (Cuarta tanda, punto 15: lo que sigue a la rama del email es el WhatsApp de VARIAS partes.)
  const rama = src.slice(src.indexOf("if (p.canal === 'email') {"), src.indexOf("if (redactado == null && p.tipo !== 'ia') {"));
  assert.ok(rama.length > 0 && rama.length < 700, `el recorte de la rama del email mide ${rama.length}`);
  assert.match(rama, /const correo = correoDeEjemplo\(p, c\.negocio\);/);
  assert.match(rama, /ponerCorreo\(\{ id: nuevoId\('em'\), \.\.\.correo, minuto, leido: false \}\);/);
  // (Integración, parte C: lo que sale de verdad lleva el HTML del editor rico, el mismo de la bandeja.)
  assert.match(rama, /mandarReal\(\{ canal: 'email', tipo: 'texto', texto: correo\.cuerpo, asunto: correo\.asunto, \.\.\.\(correo\.html \? \{ html: correo\.html \} : \{\}\) \}, nodo, enRespuesta\);/);
  assert.doesNotMatch(rama, /\bponer\(/, 'el email volvió a meterse en el hilo de WhatsApp');
  assert.doesNotMatch(src, /<select\b/);
  // Y el mail abierto se dibuja con ese HTML (`cuerpoHtml` → `bodyHtml`), y la prueba real lo manda.
  assert.match(src, /renderEmailHtml\(paramsDeVista\(\{ asunto: correo\.asunto, preheader: correo\.vistaPrevia, cuerpo: correo\.cuerpo, cuerpoHtml: correo\.html \|\| null, negocio, remitente \}\)\)/);
  // (Cuarta tanda, punto 16: y con la firma del negocio, `fromName: firma`; la fija tests/email-remitente.test.ts.)
  assert.match(sinComentarios(leer('lib/prueba-paso.ts')), /renderEmailHtml\(\{ subject: envio\.asunto, bodyText: envio\.texto, bodyHtml: envio\.html \|\| undefined, fromName: firma \}\)/);
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

// ── Sexta tanda (09/10/2026): «Probar» 1, 2 y 3 ───────────────────────────────────────
// «1. ...está configurado el email y en PROBAR no salió nada. Al igual que WhatsApp, el email debe
// salir con su animación... 2. ...deberían pedir emisor (siempre dentro de los email y numeros
// configurados, con la opción de agregar nuevo) y remitente... 3. En Email, elimina el texto de "Fin"
// que aparece abajo del todo.» El recorrido lo EJECUTA tests/probar-email-canal.test.ts; acá, el panel.

test('«Probar» 1: el lead de la prueba se elige por canal al arrancar, y la condición lo usa', () => {
  const src = PANEL();
  const arrancar = src.slice(src.indexOf('const arrancarRefs = () => {'), src.indexOf('const reiniciar = (deVerdad = false) => {'));
  // Con el medio de la prueba (TikTok fase 0, 14/10/2026): tests/ai-step-redes.test.ts.
  // (16/10/2026: y con la reunión del lead de la prueba: tests/probar-orden-antes.test.ts.)
  assert.match(arrancar, /simRef\.current = iniciar\(flujoVivo, \{ medio: medioIA, reunionMin: reunionDeLaPrueba\(\) \}\);\n\s+contactoRef\.current = contactoDe\(flujoVivo\);/, 'el contacto no se elige al arrancar con el flujo que se prueba');
  assert.match(src, /contactoParaProbar\(f, \(p\) => canalDelPaso\(p\) === canal, CANALES_PROBAR\[canal\]\.contacto, leadRef\.current, ctx\.current\.nombres\)/);
  const caso = src.slice(src.indexOf("case 'condicion': {"), src.indexOf("case 'fin':"));
  assert.match(caso, /hechosDeLeadNuevo\(\{\n\s+\.\.\.leadRef\.current, \.\.\.contactoRef\.current, yaContactado:/, 'la condición vuelve a decidir con teléfono y email siempre');
  assert.equal(CANALES_PROBAR.email.contacto, 'tieneEmail');
  assert.equal(CANALES_PROBAR.whatsapp.contacto, 'tieneTelefono');
});

test('«Probar» 1: el mail que llega entra con su animación; volver de uno abierto no re-anima la bandeja', () => {
  const dos = [correo({ id: 'a', asunto: 'Uno' }), correo({ id: 'b', asunto: 'Dos' })];
  const conEntra = bandeja({ correos: dos, entra: 'b' });
  assert.equal((conEntra.match(/class="pp-fila pp-entra"/g) ?? []).length, 1, 'sólo el último entra animado');
  assert.ok(conEntra.indexOf('class="pp-fila pp-entra"') < conEntra.indexOf('>Dos<') && conEntra.indexOf('>Dos<') < conEntra.indexOf('>Uno<'));
  assert.equal((bandeja({ correos: dos, entra: null }).match(/pp-entra/g) ?? []).length, 0, 'volviendo de un mail abierto, nada entra');
  assert.equal((bandeja({ correos: dos }).match(/class="pp-fila pp-entra"/g) ?? []).length, 2, 'sin `entra`, lo de antes');
  const src = PANEL();
  assert.match(src, /const ponerCorreo = \(c: CorreoRecibido\) => \{ correosRef\.current = \[\.\.\.correosRef\.current, c\]; setCorreos\(correosRef\.current\); setEntra\(c\.id\); \};/);
  assert.match(src, /<BandejaGmail correos=\{correos\}[^>]*entra=\{entra\}/);
});

test('«Probar» 3: en la bandeja no va «Fin» (ni las esperas ni las acciones); sí lo que falló', () => {
  assert.equal(pildoraEnLaBandeja(null), false, '«Fin» y las píldoras del recorrido no van en la bandeja');
  assert.equal(pildoraEnLaBandeja('ok'), false);
  assert.equal(pildoraEnLaBandeja('bad'), true, 'un envío que falló se dice');
  assert.equal(pildoraEnLaBandeja(null, true), true);
  const src = PANEL();
  const sis = src.slice(src.indexOf('const sistema = ('), src.indexOf('const luego = ('));
  assert.ok(sis.length > 0 && sis.length < 400, `el recorte de sistema mide ${sis.length}`);
  assert.match(sis, /if \(ctx\.current\.canal === 'email'\) \{ if \(pildoraEnLaBandeja\(tono, forzar\)\) setAviso\(\{ texto, tono \}\); return; \}/);
  // «Ya salió · no se reenvía» habla del envío de verdad: va igual.
  assert.match(src, /sistema\('Ya salió · no se reenvía', null, true\)/);
});

test('«Probar» 2: el desplegable pide «De» (el emisor, con «Vincular nuevo») ARRIBA y «Para» abajo', () => {
  const menu = (p: Partial<Parameters<typeof MenuDestinos>[0]>) => renderToStaticMarkup(createElement(MenuDestinos, {
    esEmail: false, guardados: { telefonos: ['5491125052605'], emails: [] }, onElegir: () => {},
    nuevo: false, onNuevo: () => {}, onProbarNuevo: () => {}, error: null,
    formTelefono: createElement('i', null, 'FORM-TEL'), formEmail: createElement('i', null, 'FORM-MAIL'), puedeProbarNuevo: false, ...p,
  }));
  const html = menu({ emisor: { opciones: [{ valor: '', rotulo: '+5215511111111', color: 'var(--good)' }, { valor: 'mako_ws1_b', rotulo: 'Ventas' }], elegido: 'mako_ws1_b', onElegir: () => {}, onVincular: () => {} } });
  const iDe = html.indexOf('>De<'); const iPara = html.indexOf('>Para<');
  assert.ok(iDe > 0 && iPara > iDe, 'falta «De» arriba de «Para»');
  assert.ok(html.indexOf('>Ventas<') > iDe && html.indexOf('>Ventas<') < iPara, 'las líneas van en «De»');
  assert.ok(html.indexOf('Vincular nuevo') > iDe && html.indexOf('Vincular nuevo') < iPara, '«Vincular nuevo» va en «De»');
  assert.ok(html.indexOf('+54 91125052605') > iPara, 'los guardados van en «Para»');
  // El elegido lleva su tilde (y `aria-checked`), el otro no.
  assert.match(html, /aria-checked="true"[^>]*>(?:(?!<\/button>).)*Ventas/);
  assert.match(html, /aria-checked="false"[^>]*>(?:(?!<\/button>).)*\+5215511111111/);
  // «No pude leer» no es «no hay»; sin emisor, el menú es el de antes (sin «De»).
  assert.match(menu({ emisor: { opciones: 'error', elegido: null, onElegir: () => {}, onVincular: () => {} } }), /No pude leer tus números[\s\S]*Vincular nuevo/);
  assert.match(menu({ esEmail: true, emisor: { opciones: [], elegido: null, onElegir: () => {}, onVincular: () => {} } }), /Sin remitente[\s\S]*Vincular nuevo/);
  assert.doesNotMatch(menu({}), />De<|Vincular nuevo/);
  // Íconos, no emojis ni el ＋ de texto, en los renglones de crear.
  assert.doesNotMatch(menu({ emisor: { opciones: [], elegido: null, onElegir: () => {}, onVincular: () => {} } }), /＋/);
});

test('«Probar» 2: los emisores salen de lo vinculado del negocio, y viaja sólo lo que se ELIGIÓ', () => {
  const lineas = [
    { linea: 'mako_ws1', rotulo: '+5215511111111', estado: 'conectado', esDefault: true },
    { linea: 'mako_ws1_b', rotulo: 'Ventas', estado: 'desconectado', esDefault: false },
  ];
  assert.deepEqual(emisoresDeLineas(lineas, null).map((o) => [o.valor, o.rotulo]), [['', '+5215511111111'], ['mako_ws1_b', 'Ventas']], 'la de por default primero, sin el renglón de vincular');
  assert.ok(emisoresDeLineas(lineas, 'mako_ws1_viejo').some((o) => o.valor === 'mako_ws1_viejo'), 'la de la automatización entra aunque ya no esté');
  assert.deepEqual(emisoresDeRemitentes(['Mi negocio <hola@minegocio.com>', 'hola@minegocio.com']).map((o) => o.rotulo), ['Mi negocio <hola@minegocio.com>', 'hola@minegocio.com']);
  assert.deepEqual(emisorAEnviar('whatsapp', null), {}, 'sin elegir no viaja nada: el server usa la línea de la automatización');
  assert.deepEqual(emisorAEnviar('whatsapp', ''), { linea: '' });
  assert.deepEqual(emisorAEnviar('email', 'Mi negocio <hola@minegocio.com>'), { remitente: 'Mi negocio <hola@minegocio.com>' });
  const src = PANEL();
  const mandar = src.slice(src.indexOf('const mandarReal = ('), src.indexOf('const mostrarParte = ('));
  assert.match(mandar, /postar\(\{ action: 'enviar-real', secuenciaId: c\.secuenciaId, destino: destinoReal, mensaje: m, primero, emisor: c\.emisor \}\)/, 'el emisor elegido no viaja');
  // Décima tanda (EMAIL 1): más el porqué de un «De» vacío (el email de MaKo no se ofrece).
  assert.match(src, /emisor=\{\{\s*opciones: opcionesEmisor, elegido: emisorVisible, onElegir: setEmisor, onVincular: abrirVincular,/);
  // «Vincular nuevo» es el flujo de siempre (el QR de una línea nueva; el dominio de /email), y el email
  // dice que REEMPLAZA (hoy hay UN remitente por negocio). Desde la décima tanda (GENERAL 6) el modal vive en
  // ConectarMedio.tsx: lo montan además la tarjeta, Publicar y el CRON.
  const conectar = sinComentarios(readFileSync(new URL('../app/automations/ConectarMedio.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n'));
  assert.match(conectar, /<EvolutionConnect key="nueva-linea" nueva inline panelVisible ocultarChip onLineaCreada=\{\(l: string\) => listo\(l\)\} \/>/);
  // El modal del email ES el del editor de Gmail (`VincularRemitente`, que lleva el aviso de que
  // reemplaza: lo cuida tests/editor-email-gmail.test.ts), no una copia (segunda pasada, parte «datos»).
  assert.match(conectar, /<VincularRemitente inicial=\{dom\} reemplaza=\{reemplaza\}/);
  assert.match(src, /<ConectarMedio medio=\{medioProbar\} nueva=\{vinculando === 'nuevo'\}[^>]*reemplaza=\{vinculados\.length > 0\}/);
});

test('el simulador de cada canal se elige en UN lugar (la parte «canales» enchufa ahí)', () => {
  const src = PANEL();
  assert.match(src, /let simulador: ReactNode;\n\s+switch \(canal\) \{\n\s+case 'email':/);
  // (14/10/2026: con más de un escenario, la barra de contactos a la izquierda y el simulador en su caja.)
  // (15/10/2026: la lista va al costado si hay lugar, o en una fila arriba del chat, `enFila`.)
  assert.match(src, /<div ref=\{setCuerpo\} style=\{\{ flex: 1, minHeight: 0, position: 'relative' \}\}>[\s\S]{0,600}\{conBarra\n\s+\? <div style=\{\{ position: 'absolute', bottom: 0, right: 0, \.\.\.\(enFila \? \{ left: 0, top: ALTO_FILA_ESCENARIOS \+ 6 \} : \{ left: ANCHO_BARRA_ESCENARIOS, top: 0 \}\) \}\}>\{simulador\}<\/div>\n\s+: simulador\}\n\s+<\/div>/);
  // La parte «canales» enchufó Instagram y Messenger acá (sexta tanda, al integrar): una fila y un `case`.
  assert.deepEqual(Object.keys(CANALES_PROBAR).sort(), ['email', 'instagram', 'messenger', 'whatsapp']);
  // La cabecera lee el canal de `CANALES_PROBAR`, no de un `esEmail ?`.
  assert.match(src, /<img src=\{def\.logo\} alt=\{def\.nombre\}/);
  assert.match(src, /\{def\.probarEn\}<\/Button>/);
});

// ROTURAS (09/10/2026), una por vez sobre app/automations/PanelProbar.tsx, con un arnés que rompe, corre
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
//
// ROTURAS de la quinta tanda, punto 1 (09/10/2026), con el arnés del scratchpad corriendo este
// archivo junto con los otros cuatro de la tanda (base 69 / 0). Las 5 cayeron:
//   · H1 sin el logo del canal: 67 / 2 (las dos cabeceras). · H2 el botón sin abrir el desplegable
//     (`aria-haspopup`): 67 / 2. · H3 la lista caída dicha como «Sin números guardados»: 68 / 1.
//   · H4 el form del número sin `portalTo`: 68 / 1. · H5 `probarA` sin poner el destino en `ctx`
//     antes de arrancar (el primer envío iría al destino de antes): 68 / 1.
//
// ROTURAS de la sexta tanda («Probar» 1, 2 y 3; 09/10/2026), con el arnés del scratchpad corriendo
// este archivo con probar-email-canal, probar-lead-nuevo y chatbot-probar (base 53 / 0). Las 10 cayeron,
// cada una 52 / 1: P1 arrancar sin elegir el contacto · P2 la condición sin el contacto elegido · P3 la
// bandeja con todas las píldoras («Fin» vuelve) · P4 `pildoraEnLaBandeja` dejando pasar lo neutro · P5
// el envío real sin el emisor · P6 la bandeja animando todo siempre · P7 el menú sin «Para» · P8 los
// emisores con el renglón de vincular de SalidaWhatsApp · P9 `emisorAEnviar` mandando algo sin elegir ·
// P10 `canalDelPaso` sin reconocer el email.
