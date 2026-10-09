// =============================================================================
// CREAR CON IA, TERCERA TANDA (09/10/2026): la falla de proveedores, el formato sin «Ir a» y la caja
// =============================================================================
// El pedido literal está en app/admin/dev/chatbot/bitacora.ts (hito del 9 oct 02:05), «Por otro lado»:
//   1. «Falló al crear con IA la secuencia, soluciona eso.»
//   2-6. La caja: minimalista como «Nueva tarea», que grabe y transcriba en vivo, «Generar con IA»,
//        el placeholder que escribe y borra ejemplos genéricos y para al tocarlo, y la creación que
//        oscurece el resto, no deja editar y tiene Cancelar.
//
// LA FALLA, medida el 09/10/2026 con las keys reales del ws1 (scratchpad F-diag.mts y F-real.mts):
// gemini 403/429 (Google bloqueó el proyecto de esa key), openrouter 404 (el modelo ya no es gratis),
// mistral 429 (siempre), openai 429 ×4 (sin crédito, y además cobra) y GROQ —que arma un flujo válido
// en 3 s— salteado por la cascada porque el pedido pesaba ~10k contra su techo de 7k. El mensaje
// eligió «configuración de MaKo» por el «unavailable for free» de OpenRouter. Lo puro se EJECUTA; lo
// que es cableado se fija leyendo el fuente sin comentarios y en LF.
//
// ⚠️ PROBADO ROMPIENDO CADA PIEZA (09/10/2026, scratchpad F-romper.mjs, restaura de MEMORIA, md5
// verificado): el resultado de cada rotura está al lado de su test, de 13 tests. La primera versión del
// test del techo usaba un negocio chico (~3.100 tokens) y dejaba pasar en VERDE dos roturas (el perfil
// sin tope y los disparadores en una línea por opción): tenía 900 tokens de aire. Se calibró cerca del
// borde y las dos caen.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  falloDeIA, salidaParaIA, bloqueDisparadores, disparadoresParaIA, deIA, userDeCrear, userDeEditar,
  PROVS_CREAR_IA, PROVS_GRATIS_PIN, MODELOS_CREAR_IA, SALIDA_MIN_IA, SALIDA_MAX_IA, LISTA_BLANCA_IA,
  CREAR_IA_SYSTEM_TEMPLATE, EDITAR_IA_SYSTEM_TEMPLATE, type CtxIA,
} from '../lib/flujo-ia';
import { motivoDeErroresCascada } from '../lib/ia-mensajes';
import { accionDelFlujo } from '../lib/editor-acciones';
import { seccionesDisparo } from '../lib/flujo-conversacion';
import { porId } from '../lib/api-mako/registro';
import { marcasDeVoseo } from '../lib/puestas-data';
import { CrearConIA, EJEMPLOS } from '../app/chatbot/CrearConIA';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const acciones = LISTA_BLANCA_IA.map((id) => {
  const d = porId(id);
  if (!d) throw new Error(`la lista blanca nombra «${id}», que no está en el registro`);
  return { id: d.id, titulo: d.titulo, parametros: d.parametros };
});
const rndDe = () => { let k = 0; return () => ((k++ * 0.137) % 1); };

// ── 1. El mensaje: el motivo por proveedor, no la bolsa ───────────────────────────

/** Lo que dejó la cascada en el ws1 (los 8 errores del «(+5 más)»), con la forma de `erroresOut`. */
const BOLSA_WS1 = [
  'gemini: chatCheap(gemini): HTTP 429',
  'gemini: chatCheap(gemini): HTTP 403',
  'openrouter: chatCheap(openrouter): This model is unavailable for free. The paid version is available now - use this slug instead: minimax/minimax-m3',
  'mistral: chatCheap(mistral): Rate limit exceeded',
  'openai: chatCheap(openai): You exceeded your current quota, please check your plan and billing details.',
  'openai: chatCheap(openai): You exceeded your current quota, please check your plan and billing details.',
  'openai: chatCheap(openai): You exceeded your current quota, please check your plan and billing details.',
  'openai: chatCheap(openai): You exceeded your current quota, please check your plan and billing details.',
];

// rotura (falloDeIA clasifica la bolsa entera con motivoDeErroresCascada, como errorDeCascada): 1 fallo.
test('la bolsa del ws1: el motivo viejo culpaba a la configuración; el nuevo dice que Google rechazó la key', () => {
  // El diagnóstico equivocado, fijado para que se entienda el arreglo: con la bolsa entera gana el
  // «unavailable for free» de OpenRouter, que es config nuestra y no lo que frenó al ws1.
  assert.match(motivoDeErroresCascada(BOLSA_WS1) ?? '', /^Hay un problema de configuración de MaKo/);
  const f = falloDeIA(BOLSA_WS1, true);
  assert.equal(f.error, 'Gemini rechazó tu key y Mistral está al tope. Cámbiala en Integraciones.');
  assert.equal(f.link, '/integraciones?abrir=gemini');
});

// rotura (sin el chequeo de «denied access»): 1 fallo.
test('falloDeIA: cada causa en una línea, con la acción que corresponde', () => {
  // Google bloqueado, con el mensaje y sin el código (la otra forma en que llega).
  assert.equal(falloDeIA(['gemini: chatCheap(gemini): Your project has been denied access. Please contact support.'], true).error,
    'Gemini rechazó tu key. Cámbiala en Integraciones.');
  // Al tope: se espera, no se cambia nada.
  const tope = falloDeIA(['gemini: chatCheap(gemini): HTTP 429', 'groq: chatCheap(groq): Rate limit reached for model openai/gpt-oss-120b'], true);
  assert.deepEqual(tope, { error: 'Gemini está al tope y Groq está al tope. Prueba en un rato.' });
  // Saturado.
  assert.equal(falloDeIA(['gemini: chatCheap(gemini): HTTP 503: This model is currently experiencing high demand'], true).error, 'Gemini está saturado. Prueba en un rato.');
  // Lo nuestro (un modelo retirado, el 413 de Groq con «rate-limits» en la URL): sin culpar a la persona y sin link.
  const nuestro = falloDeIA([
    'openrouter: chatCheap(openrouter): This model is unavailable for free.',
    'groq: chatCheap(groq): Request too large for model on tokens per minute (TPM). Visit https://console.groq.com/docs/rate-limits',
  ], true);
  assert.deepEqual(nuestro, { error: 'Falló de nuestro lado, no de tus keys. Prueba más tarde.' });
  // Sin tiempo.
  assert.equal(falloDeIA(['sin tiempo: el plazo del pedido vence en 3 s'], true).error, 'Las IA tardaron demasiado. Prueba de nuevo.');
  // Sin ninguna IA: conectar una gratis, con el link.
  assert.deepEqual(falloDeIA([], false), { error: 'No tienes ninguna IA gratis conectada.', link: '/integraciones?abrir=gemini' });
  // Todo corto: es una línea que se dibuja.
  for (const e of [BOLSA_WS1, ['gemini: chatCheap(gemini): HTTP 429']]) assert.ok(falloDeIA(e, true).error.length <= 90);
});

// ── 2. La cascada: gratis, y el pedido entra en Groq ──────────────────────────────

test('la lista de proveedores no cobra nunca, y el pin pago no entra', () => {
  for (const p of ['openai', 'anthropic', 'mistral']) assert.ok(!(PROVS_CREAR_IA as readonly string[]).includes(p), p);
  for (const p of ['openai', 'anthropic']) assert.ok(!(PROVS_GRATIS_PIN as readonly string[]).includes(p), p);
  assert.deepEqual([...PROVS_CREAR_IA], ['gemini', 'groq', 'openrouter']);
  assert.match(MODELOS_CREAR_IA.openrouter ?? '', /:free$/, 'el de OpenRouter tiene que ser un :free');
});

// Integración (decisión 16): la IA sólo arma acciones que el lienzo OFRECE (`ACCIONES_DEL_FLUJO`).
// Rotura (devolver `mover_lead_en_producto` a la lista sin el filtro): 1 fallo.
test('la lista blanca de la IA es un subconjunto de la lista corta del lienzo', () => {
  for (const id of LISTA_BLANCA_IA) assert.ok(accionDelFlujo(id), `${id} no está en la lista corta del lienzo`);
  assert.ok(!LISTA_BLANCA_IA.includes('mover_lead_en_producto'));
  assert.equal(LISTA_BLANCA_IA.length, 5, 'el filtro se llevó una acción que la IA ponía: ¿salió del lienzo?');
});

// rotura (salidaParaIA devuelve siempre SALIDA_MAX_IA, como los 6000 fijos de antes): 2 fallos.
test('salidaParaIA: lo que queda bajo el techo, si alcanza para un flujo; si no, la de siempre', () => {
  assert.equal(salidaParaIA(2869, 7000), 4131, 'el pedido del ws1 después del arreglo');
  assert.equal(salidaParaIA(500, 7000), SALIDA_MAX_IA, 'nunca más que la de siempre');
  assert.equal(salidaParaIA(4500, 7000), SALIDA_MAX_IA, 'si no alcanza, Groq queda afuera igual');
  assert.equal(salidaParaIA(1000, undefined), SALIDA_MAX_IA);
});

/** La cuenta de la cascada, leída de lib/ai-cheap.ts (es server-only y no se puede importar acá). */
const AI_CHEAP = leer('lib/ai-cheap.ts');
const TECHO_GROQ = Number(/const TECHO_ENTRADA[^=]*= \{\n\s*groq: ([\d_]+),/.exec(AI_CHEAP)?.[1].replace(/_/g, ''));
const DIVISOR = Number(/export const tokensAprox = \(texto: string\): number => Math\.ceil\(texto\.length \/ ([\d.]+)\);/.exec(AI_CHEAP)?.[1]);
const tokens = (s: string) => Math.ceil(s.length / DIVISOR);

/**
 * Un negocio GRANDE, más que cualquiera de hoy: perfil y guía de voz largos (se cortan en su tope), 4
 * productos de 14 etapas con su entrega (más de 100 disparadores: el bloque se corta en 80), 8 audios y
 * 20 etiquetas. Calibrado para que quede CERCA del borde: sin el tope del perfil, o con los
 * disparadores en una línea por opción, se pasa (ver las roturas).
 *
 * ⚠️ RECALIBRADO EN LA INTEGRACIÓN DE LA TERCERA TANDA. Hasta ahí eran 2 productos y 40 EVENTOS; la
 * decisión 4 (parte B) sacó los eventos del CRON y `seccionesDisparo` ya no los trae, así que quedaban
 * 63 disparadores y ~3.140 tokens: con ese aire, las dos roturas de abajo daban VERDE (medido con
 * scratchpad medir-ia.mts: sin tope ~3.980 y con una línea por opción ~3.880, los dos bajo 4.000). Con
 * 4 productos: 105 disparadores y ~3.430 tokens de prompt (~3.570 de salida bajo el techo). Roturas
 * re-medidas con el calibre nuevo (arnés que restaura de memoria): sin el tope del perfil y la voz,
 * 13 pass / 1 fail; DISPARADORES en una línea por opción con el valor interno, 12 / 2.
 */
function ctxGrande(): { ctx: CtxIA; perfil: string; voz: string } {
  const etapas = Array.from({ length: 14 }, (_, i) => ({ value: `etapa_${i}`, label: `Etapa número ${i + 1}` }));
  const productos = [
    { funnelId: 3, productoId: 7, nombre: 'Mentoría de negocio', esDefault: true, etapas, etapasEntrega: etapas.slice(0, 8) },
    { funnelId: 5, productoId: 11, nombre: 'Curso de ventas', etapas, etapasEntrega: etapas.slice(0, 6) },
    { funnelId: 6, productoId: 12, nombre: 'Comunidad de dueños', etapas, etapasEntrega: etapas.slice(0, 8) },
    { funnelId: 8, productoId: 15, nombre: 'Programa de liderazgo', etapas, etapasEntrega: etapas.slice(0, 6) },
  ];
  const etiquetas = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, nombre: `Etiqueta ${i + 1}`, archivada_at: null }));
  const disparadores = disparadoresParaIA(seccionesDisparo({
    disparadores: [], productos, etiquetas, actual: { trigger_tipo: 'manual' }, textoActual: 'manual',
  }));
  const ctx: CtxIA = {
    etiquetas: etiquetas.map((e) => ({ id: e.id, nombre: e.nombre })), productos, disparadores,
    audios: Array.from({ length: 8 }, (_, k) => ({ id: k + 1, titulo: `Audio ${k + 1}`, transcript: 'Hola, te cuento cómo trabajamos y qué vas a lograr en las primeras semanas del programa. '.repeat(3) })),
    archivos: [], acciones,
    links: { agenda: { url: 'https://cal.com/x', para: 'el link para que agende la llamada' }, video: { url: 'https://v.com/x', para: 'el video que conviene ver antes de hablar' } },
  };
  return { ctx, perfil: 'Somos una agencia que ayuda a negocios de servicios a vender más. '.repeat(60), voz: 'Cercano, directo, con ejemplos. '.repeat(80) };
}

// rotura (sacar el tope del perfil y de la voz en bloquesDeContexto): 1 fallo. rotura (DISPARADORES
// vuelve a una línea por opción con el valor interno): 1 fallo.
test('con todo en el tope, el pedido deja salida para un flujo bajo el techo de Groq', () => {
  assert.ok(TECHO_GROQ > 0 && DIVISOR > 0, 'no pude leer la cuenta de lib/ai-cheap.ts');
  const { ctx, perfil, voz } = ctxGrande();
  assert.ok(ctx.disparadores.length >= 100, `son ${ctx.disparadores.length}`);
  const user = userDeCrear(ctx, { perfil, voz, pedido: 'Recuperar a quien dejó sus datos y no agendó, con un WhatsApp al día y un email a los dos días.' });
  const prompt = tokens(CREAR_IA_SYSTEM_TEMPLATE) + tokens(user);
  // El calibre: cerca del borde. Si el prompt baja mucho (otro cambio del CRON), las roturas dejan de
  // medir: este assert lo dice antes de que den verde sin que nadie se entere.
  assert.ok(prompt >= 3_300, `el prompt pesa ~${prompt} tokens: lejos del borde, las roturas ya no miden; recalibrar ctxGrande`);
  const salida = salidaParaIA(prompt, TECHO_GROQ);
  assert.ok(prompt + SALIDA_MIN_IA <= TECHO_GROQ, `el prompt pesa ~${prompt} tokens: no deja ${SALIDA_MIN_IA} de salida bajo ${TECHO_GROQ}`);
  assert.ok(salida >= SALIDA_MIN_IA && prompt + salida <= TECHO_GROQ, `salida ${salida}`);
});

test('el contexto ya no lleva las otras automatizaciones (sólo servían para «Ir a»), ni las URL', () => {
  const { ctx, perfil, voz } = ctxGrande();
  const user = userDeCrear(ctx, { perfil, voz, pedido: 'algo' });
  assert.doesNotMatch(user, /OTRAS AUTOMATIZACIONES/);
  assert.doesNotMatch(user, /https?:\/\//);
  assert.doesNotMatch(userDeEditar(ctx, { perfil, voz, pedido: 'algo' }, []), /OTRAS AUTOMATIZACIONES/);
});

// ── 3. El disparador por su clave corta ───────────────────────────────────────────

// rotura (resolverDisparador sin la clave corta `dN`): 1 fallo.
test('DISPARADORES compacto: una línea por sección, claves cortas, y la clave resuelve el valor exacto', () => {
  const d = disparadoresParaIA(seccionesDisparo({
    disparadores: [{ value: 'instant_form_sin_agenda', label: 'Formulario sin agenda' }],
    productos: [
      { funnelId: 3, productoId: null, nombre: 'Mentoría', etapas: [{ value: 'nuevo', label: 'Nuevo' }, { value: 'agendado', label: 'Agendado' }], etapasEntrega: [] },
      { funnelId: 5, productoId: 11, nombre: 'Curso', etapas: [{ value: 'agendado', label: 'Agendado' }], etapasEntrega: [] },
    ],
    etiquetas: [{ id: 9, nombre: 'Cualificado', archivada_at: null }], actual: { trigger_tipo: 'manual' }, textoActual: 'manual',
  })).filter((o) => o.value !== 'trigger:manual');
  const bloque = bloqueDisparadores(d);
  // Sin «Eventos»: la decisión 4 de la tercera tanda (parte B) los sacó del CRON —ahora son condiciones—,
  // y `seccionesDisparo` ya no los trae. El evento que se le pasa no aparece (integración).
  assert.equal(bloque, [
    '- Etapa · Mentoría (llega a): d1 Nuevo · d2 Agendado',
    '- Etapa · Curso (llega a): d3 Agendado',
    '- Etiquetas (se le puso): d4 Cualificado',
  ].join('\n'));
  assert.doesNotMatch(bloque, /venta:|trigger:|etiqueta:/, 'el valor interno no viaja al modelo');
  assert.doesNotMatch(bloque, /Formulario sin agenda/, 'un evento volvió a ofrecerse como disparador');
  const ctx: CtxIA = { etiquetas: [], productos: [], disparadores: d, audios: [], archivos: [], acciones, links: {} };
  const r = (disparador: string) => deIA({ disparador, inicio: 't1', tarjetas: [{ id: 't1', tipo: 'mensaje', texto: 'Hola' }] }, ctx, rndDe()).disparador;
  assert.equal(r('d3'), 'venta:5:agendado');
  assert.equal(r('D1'), 'venta:3:nuevo');
  assert.equal(r('d99'), null, 'una clave que no existe no elige nada');
  // Lo de antes sigue entrando (un prompt guardado en /configuraciones que pida el valor).
  assert.equal(r('venta:5:agendado'), 'venta:5:agendado');
  // Y un evento, que ya no es un disparador, no elige nada.
  assert.equal(r('trigger:instant_form_sin_agenda'), null);
});

// ── 4. Los prompts, sin «Ir a» ─────────────────────────────────────────────────────

test('los dos prompts: sin «ir_a», el disparador por clave, y en español neutro', () => {
  for (const t of [CREAR_IA_SYSTEM_TEMPLATE, EDITAR_IA_SYSTEM_TEMPLATE]) {
    assert.doesNotMatch(t, /"ir_a"|ir_a|automatizacion"/);
    assert.deepEqual(marcasDeVoseo(t), []);
  }
  assert.match(CREAR_IA_SYSTEM_TEMPLATE, /"disparador": "d1"/);
});

// ── 5. La caja ───────────────────────────────────────────────────────────────────

const CAJA = sinComentarios(leer('app/chatbot/CrearConIA.tsx'));
const dibujar = (props: Partial<Parameters<typeof CrearConIA>[0]> = {}) => renderToStaticMarkup(createElement(CrearConIA, {
  modo: 'crear', secuenciaId: 7, onListo: () => {}, ...props,
} as Parameters<typeof CrearConIA>[0]));

// rotura (volver a dibujar los `ejemplos` como chips): 1 fallo. Desde la integración la prop ya no
// existe: lo que se fija es que no vuelvan ni ella ni la cadena que los armaba con nombres de etapas
// (ChatAgentApp → SimuladorWhatsApp → SecuenciaPerfil → CrearConIA).
test('dibujada: «Generar con IA», el primer ejemplo genérico en el placeholder y sin los ejemplos de props', () => {
  const html = dibujar();
  assert.match(html, />Generar con IA</);
  assert.doesNotMatch(html, /¿Qué quieres que haga\?/);
  assert.match(html, new RegExp(`placeholder="${EJEMPLOS[0]}"`));
  assert.doesNotMatch(html, /Nutrición No Show/);
  assert.doesNotMatch(CAJA, /ejemplos\?:/, 'volvió la prop `ejemplos`');
  for (const f of ['app/chatbot/ChatAgentApp.tsx', 'app/chatbot/SimuladorWhatsApp.tsx', 'app/chatbot/SecuenciaPerfil.tsx']) {
    assert.doesNotMatch(sinComentarios(leer(f)), /ejemplosIA/, `${f}: volvió la cadena de los ejemplos con nombres de etapas`);
  }
  // El micrófono del Plan (el mismo botón, no una copia).
  assert.match(html, /aria-label="Dictar el pedido"/);
  assert.match(CAJA, /import \{ BotonDictar \} from '@\/app\/plan\/board\/CrearTareaModal';/);
});

test('los ejemplos son genéricos: ni etapas, ni productos, ni nombres, y en tú', () => {
  for (const e of EJEMPLOS) {
    assert.doesNotMatch(e, /«|»|R1|R2|Mauricio|Leila|Código|No Show/, e);
    assert.deepEqual(marcasDeVoseo(e), [], e);
    assert.ok(e.length <= 70, e);
  }
});

// rotura (la animación vuelve cuando se vacía el campo: `!pedido` sin `!tocada`): 1 fallo.
test('el placeholder para del todo al tocar la caja, y no vuelve', () => {
  assert.match(CAJA, /useEjemploQueSeEscribe\(p\.modo === 'crear' && !tocada && !pedido\)/);
  assert.match(CAJA, /onPointerDownCapture=\{parar\}/);
  assert.match(CAJA, /onFocusCapture=\{parar\}/);
  assert.doesNotMatch(CAJA, /setTocada\(false\)/, 'nada la vuelve a prender');
  assert.match(CAJA, /placeholder=\{tocada \? PLACEHOLDER_QUIETO : ejemplo\}/);
});

// rotura (la capa adentro del componente, sin portal): 1 fallo.
test('mientras crea: una capa fija sobre toda la pantalla (portal al body), que también corta el teclado', () => {
  assert.match(CAJA, /return typeof document !== 'undefined' \? createPortal\(tarjeta, document\.body\) : tarjeta;/);
  assert.match(CAJA, /capa: \{\n\s+position: 'fixed', inset: 0, zIndex: 125,/);
  assert.match(CAJA, /document\.addEventListener\('keydown', alTeclado, true\);/);
  assert.match(CAJA, /e\.stopImmediatePropagation\(\);/);
  // Y Cancelar corta el pedido de verdad (AbortController), no sólo la pantalla.
  assert.match(CAJA, /const cancelar = \(\) => \{\n\s+ctrl\.current\?\.abort\(\);/);
});

// rotura (el error sin el link): 1 fallo.
test('el error trae el link a donde se arregla', () => {
  assert.match(CAJA, /if \(ev\.t === 'error'\) \{ setEstado\(\{ t: 'quieto', error: ev\.error \|\| 'No se pudo', link: ev\.link \}\); return true; \}/);
  const ruta = sinComentarios(leer('app/api/chat-agent/secuencias/ia/route.ts'));
  assert.match(ruta, /send\(\{ t: 'error', error: g\.error, \.\.\.\(g\.link \? \{ link: g\.link \} : \{\}\) \}\);/);
});
