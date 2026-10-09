// =============================================================================
// CREAR CON IA: los arreglos de la revisión de la segunda tanda (09/10/2026)
// =============================================================================
// Cada test persigue UN hallazgo confirmado de la revisión del frente IA (lib/flujo-ia.ts, la ruta
// app/api/chat-agent/secuencias/ia/route.ts y app/chatbot/CrearConIA.tsx). Lo puro se EJECUTA; lo
// que es cableado (la ruta, la pantalla) se fija leyendo el fuente sin comentarios y en LF.
//
// ⚠️ PROBADO ROMPIENDO CADA ARREGLO, 09/10/2026: el arnés FIXIA-romper.mjs (scratchpad de la sesión)
// revierte el arreglo, corre este archivo, cuenta y RESTAURA DE MEMORIA (md5 verificado). El
// resultado de cada rotura está al lado de su test («rotura: …»).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  LISTA_BLANCA_IA, CREAR_IA_SYSTEM_TEMPLATE, EDITAR_IA_SYSTEM_TEMPLATE, deIA, deIAEdicion, validarIA, limpiarTexto, erroresNuevos,
  disparadoresParaIA, numerosEn, type CtxIA,
} from '../lib/flujo-ia';
import { validarGrafo, claseDe } from '../lib/flujo-grafo';
import { seccionesDisparo } from '../lib/flujo-conversacion';
import { porId } from '../lib/api-mako/registro';

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
const ctxBase = (o: Partial<CtxIA> = {}): CtxIA => ({
  etiquetas: [{ id: 7, nombre: 'Cualificado' }],
  productos: [
    { funnelId: 3, productoId: null, nombre: 'Mentoría', esDefault: true, etapas: [{ value: 'nuevo', label: 'Nuevo' }, { value: 'agendado', label: 'Agendado' }, { value: 'ganado', label: 'Ganado' }] },
    { funnelId: 5, productoId: 11, nombre: 'Curso', etapas: [{ value: 'agendado', label: 'Agendado' }] },
  ],
  disparadores: [{ value: 'trigger:instant_form_sin_agenda', label: 'Formulario sin agenda' }],
  audios: [],
  archivos: [],
  acciones,
  links: { agenda: { url: 'https://cal.com/negocio/llamada', para: 'agendar una llamada' } },
  automatizaciones: [],
  secuenciaId: 99,
  ...o,
});
/** Un generador determinista para `nuevoId`. */
const rndDe = () => { let k = 0; return () => ((k++ * 0.137) % 1); };

// ── asignar_closer_setter: una tarjeta que el lienzo dibuja configurada y nunca hace nada ──
// rotura (volver a sumarla a LISTA_BLANCA_IA): 1 fallo de 1.
test('asignar_closer_setter NO está en la lista blanca: sus nombres no se pueden validar', () => {
  assert.ok(!LISTA_BLANCA_IA.includes('asignar_closer_setter'));
  // Y el bloque ACCIONES del prompt no la ofrece: sale de la lista blanca.
  assert.ok(!acciones.some((a) => a.id === 'asignar_closer_setter'));
});

// ── El ejemplo del prompt contradecía su propia regla 4 («una guía no ofrece días ni horarios») ──
/** El JSON de «LA FORMA (un ejemplo…)» de un prompt, parseado. */
const ejemploDe = (tpl: string) => {
  const i = tpl.indexOf('{', tpl.indexOf('LA FORMA ('));
  const j = tpl.indexOf('\n\nDevuelve EXCLUSIVAMENTE', i);
  return JSON.parse(tpl.slice(i, j)) as { tarjetas?: Array<Record<string, unknown>>; agregar?: Array<{ tarjetas: Array<Record<string, unknown>> }> };
};
// Lo que una guía de «MaKo contesta» no puede hacer: ofrecer un momento. Pedir que elija con el link, sí.
const OFRECE_MOMENTO = /horari|\bd[ií]as?\b|\bhoy\b|ma[ñn]ana|semana|\b\d{1,2}(:\d\d)?\s*(h|hs|am|pm)\b|\blunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado|domingo/i;

// rotura (devolver el texto viejo «Ofrécele dos horarios de esta semana…»): 1 fallo de 3, cae éste.
test('el ejemplo del prompt: ninguna guía ofrece días ni horarios', () => {
  for (const tpl of [CREAR_IA_SYSTEM_TEMPLATE, EDITAR_IA_SYSTEM_TEMPLATE]) {
    const ej = ejemploDe(tpl);
    const tarjetas = [...(ej.tarjetas ?? []), ...(ej.agregar ?? []).flatMap((g) => g.tarjetas)];
    assert.ok(tarjetas.length > 0, 'no encontré el ejemplo');
    for (const t of tarjetas) {
      if (t.ia === true) assert.doesNotMatch(String(t.texto), OFRECE_MOMENTO, `una guía ofrece un momento: «${String(t.texto)}»`);
    }
  }
});

// ── Las llaves que RX_VARIABLE no reconocía quedaban crudas y llegaban al lead ──
// rotura (volver a RX_VARIABLE en limpiarTexto, sin la pasada de llaves sueltas): 1 fallo de 7, cae éste.
test('limpiarTexto: toda llave que no es una variable conocida se va, y avisa', () => {
  const casos: Array<[string, string]> = [
    ['Hola {{Nombre del lead}}, ¿cómo estás?', 'Hola, ¿cómo estás?'],
    ['Tu número {{teléfono}} quedó', 'Tu número quedó'],
    ['Paso {{ 1 }} listo', 'Paso listo'],
    ['Hola {nombre completo}', 'Hola'],
    ['Hola {{nombre}}}', 'Hola {{nombre}}'],
    ['Hola {{nombre', 'Hola nombre'],
  ];
  for (const [entra, sale] of casos) {
    const r = limpiarTexto(entra);
    assert.equal(r.texto, sale, entra);
    assert.ok(r.quitado.includes('variable') || entra === 'Hola {{nombre}}}', `sin aviso: ${entra}`);
    assert.doesNotMatch(r.texto.replace(/\{\{(nombre|negocio)\}\}/g, ''), /[{}]/, entra);
  }
  // Las del motor se quedan (y se normalizan a doble llave).
  assert.equal(limpiarTexto('Hola {Nombre} de {{ negocio }}').texto, 'Hola {{nombre}} de {{negocio}}');
});

// rotura (validarIA sin el chequeo de llaves): 1 fallo de 7, cae éste.
test('validarIA rechaza un texto con llaves que no son una variable', () => {
  const ctx = ctxBase();
  const r = deIA({ inicio: 't1', tarjetas: [{ id: 't1', tipo: 'mensaje', texto: 'Hola {{nombre}}' }] }, ctx, rndDe());
  assert.deepEqual(validarIA(r.pasos, ctx), []);
  for (const cuerpo of ['Hola {{Nombre del lead}}', 'Hola {{teléfono}}', 'Hola {{nombre}}}']) {
    const mal = r.pasos.map((p) => ({ ...p, cuerpo }));
    assert.ok(validarIA(mal, ctx).some((e) => /llaves|variable/.test(e)), cuerpo);
  }
});

// ── Un link sin http ni www (calendly.com/juan) pasaba las dos capas ──
// rotura (sin RX_DOMINIO en limpiarTexto): 1 fallo de 7, cae éste.
test('limpiarTexto borra un dominio suelto y deja en paz lo que no es un link', () => {
  for (const t of ['Agenda en calendly.com/juan/30min', 'Entra a cal.com/x', 'Mira Calendly.com/juan', 'Todo en negocio.com.ar/precios']) {
    const r = limpiarTexto(t);
    assert.doesNotMatch(r.texto, /\.(com|ar)\b/, t);
    assert.ok(r.quitado.includes('link'), t);
  }
  for (const t of ['Revisa tus datos.Te escribo', 'Hola.Me alegra', 'Cuesta 1.500 o 2.5', 'Escríbeme a hola@negocio.com', 'Tus datos.Como siempre']) {
    assert.equal(limpiarTexto(t).texto, t, t);
  }
});

// rotura (validarIA sin mirar los dominios sueltos): 1 fallo de 7, cae éste.
test('validarIA rechaza un dominio suelto salvo que sea el host de uno de tus links', () => {
  const ctx = ctxBase();
  const r = deIA({ inicio: 't1', tarjetas: [{ id: 't1', tipo: 'mensaje', texto: 'Hola', link: 'agenda' }] }, ctx, rndDe());
  assert.deepEqual(validarIA(r.pasos, ctx), [], 'el link completo pegado por el código vale');
  const ajeno = r.pasos.map((p) => ({ ...p, cuerpo: 'Agenda en calendly.com/juan' }));
  assert.ok(validarIA(ajeno, ctx).some((e) => e.includes('link')));
  const propio = r.pasos.map((p) => ({ ...p, cuerpo: 'Agenda en cal.com/negocio/llamada' }));
  assert.deepEqual(validarIA(propio, ctx), []);
});

// ── EDITAR con «Otra cosa» ocupada pisaba el puerto y fallaba con un id interno en pantalla ──
// rotura (sacar el chequeo de «Otra cosa» ocupada en deIAEdicion): 1 fallo de 9, cae éste.
test('editar: «Otra cosa» ocupada no se pisa; lo de antes queda igual y no hay tarjetas sueltas', () => {
  const ctx = ctxBase();
  const base = deIA({ inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'mensaje', texto: 'Hola' },
    { id: 'r1', tipo: 'si_responde', casos: [{ titulo: 'Pregunta', cuando: 'Hace una pregunta', sigue: 'r2' }], otra_cosa: 'r3' },
    { id: 'r2', tipo: 'mensaje', texto: 'Te contesto' },
    { id: 'r3', tipo: 'mensaje', texto: 'Lo veo y te digo' },
  ] }, ctx, rndDe()).pasos;
  const resp = base.find((p) => claseDe(p) === 'respuesta')!;
  assert.ok(resp.si_no, 'la base tiene «Otra cosa» ocupada');
  const r = deIAEdicion({ agregar: [
    { despues_de: 'si_responde', salida: 'otra_cosa', tarjetas: [{ id: 'x1', tipo: 'mensaje', texto: 'Esto pisaría' }] },
  ] }, base, ctx, rndDe());
  assert.ok(r.avisos.some((a) => a.includes('no la pisé')), r.avisos.join(' | '));
  assert.deepEqual(r.agregadas, []);
  assert.deepEqual(erroresNuevos(base, r.pasos), []);
  assert.equal(r.pasos.find((p) => claseDe(p) === 'respuesta')!.si_no, resp.si_no);
});

// rotura (volver a interpolar `ultimo[0]` en el error): 1 fallo de 9, cae éste.
test('la ruta no muestra los errores de la revisión con ids internos: van al log', () => {
  const ruta = sinComentarios(leer('app/api/chat-agent/secuencias/ia/route.ts'));
  const i = ruta.indexOf('if (ultimo) {');
  assert.ok(i > 0);
  const bloque = ruta.slice(i, ruta.indexOf('}', ruta.indexOf('return {', i)));
  assert.match(bloque, /console\.error\(/);
  assert.doesNotMatch(bloque, /error: `[^`]*\$\{/, 'el error de pantalla interpola un detalle');
});

// ── El bloque DISPARADORES perdía el producto: el disparador podía quedar en el embudo equivocado ──
const seccionesDosProductos = () => seccionesDisparo({
  disparadores: [{ value: 'instant_form_sin_agenda', label: 'Formulario sin agenda' }],
  productos: [
    { funnelId: 3, productoId: null, nombre: 'Mentoría', etapas: [{ value: 'agendado', label: 'Agendado' }], etapasEntrega: [] },
    { funnelId: 5, productoId: 11, nombre: 'Curso', etapas: [{ value: 'agendado', label: 'Agendado' }], etapasEntrega: [{ value: 'agendado', label: 'Agendado' }] },
  ],
  etiquetas: [], actual: { trigger_tipo: 'manual' }, textoActual: 'manual',
});

// rotura (aplanar sin el título: `secciones.flatMap((s) => s.options)`): 1 fallo de 11, cae éste.
test('disparadoresParaIA: cada etapa lleva su producto y ningún rótulo se repite', () => {
  const d = disparadoresParaIA(seccionesDosProductos()).filter((o) => o.value !== 'trigger:manual');
  const etapas = d.filter((o) => /^(venta|entrega):/.test(o.value));
  assert.equal(etapas.length, 3);
  assert.equal(new Set(etapas.map((o) => o.label)).size, 3, etapas.map((o) => o.label).join(' | '));
  assert.ok(etapas.find((o) => o.value === 'venta:5:agendado')!.label.includes('Curso'));
  assert.ok(etapas.find((o) => o.value === 'entrega:11:agendado')!.label.startsWith('Entrega'));
  // Y por ese rótulo, la IA resuelve el embudo pedido.
  const ctx = ctxBase({ disparadores: d });
  const curso = etapas.find((o) => o.value === 'venta:5:agendado')!.label;
  assert.equal(deIA({ disparador: curso, inicio: 't1', tarjetas: [{ id: 't1', tipo: 'mensaje', texto: 'Hola' }] }, ctx, rndDe()).disparador, 'venta:5:agendado');
});

// rotura (resolverDisparador vuelve a tomar la primera coincidencia): 1 fallo de 11, cae éste.
test('un rótulo que coincide con varias opciones no elige ninguna: queda «elígelo en el CRON»', () => {
  const ambiguo = [{ value: 'venta:3:agendado', label: 'Llega a «Agendado»' }, { value: 'venta:5:agendado', label: 'Llega a «Agendado»' }];
  const r = deIA({ disparador: 'Llega a «Agendado»', inicio: 't1', tarjetas: [{ id: 't1', tipo: 'mensaje', texto: 'Hola' }] }, ctxBase({ disparadores: ambiguo }), rndDe());
  assert.equal(r.disparador, null);
  // Con el producto en el rótulo, el rótulo pelado ya no coincide con nada: tampoco elige.
  const d = disparadoresParaIA(seccionesDosProductos());
  assert.equal(deIA({ disparador: 'Llega a «Agendado»', inicio: 't1', tarjetas: [{ id: 't1', tipo: 'mensaje', texto: 'Hola' }] }, ctxBase({ disparadores: d }), rndDe()).disparador, null);
  // Y la ruta aplana con la función, no a mano.
  assert.match(sinComentarios(leer('app/api/chat-agent/secuencias/ia/route.ts')), /disparadoresParaIA\(seccionesDisparo\(\{/);
});

// ── Un `monto` inventado por el modelo se guardaba sin ninguna capa ──
const pasarAGanado = (monto: unknown) => ({ inicio: 't1', tarjetas: [
  { id: 't1', tipo: 'accion', operacion: 'proponer_cambio_etapa', datos: { etapa: 'ganado', monto } },
] });
const paramsDe = (pasos: ReadonlyArray<{ accion?: unknown }>) => (pasos.find((p) => p.accion)?.accion as { params: Record<string, unknown> } | undefined)?.params;

test('numerosEn lee los números como se escribe la plata', () => {
  const n = numerosEn('El programa cuesta USD 1.500, o $1,200.50 en cuotas de 2.5 meses. 500 USD.');
  for (const x of [1500, 1200.5, 2.5, 500]) assert.ok(n.includes(x), `falta ${x}: ${n.join(', ')}`);
  assert.deepEqual(numerosEn('sin números'), []);
});

// rotura (resolverAccion acepta cualquier monto): 1 fallo de 14, cae éste.
test('un monto que no está en el pedido ni en el perfil se saca, con aviso; uno que está, queda', () => {
  const sinNumeros = deIA(pasarAGanado(997), ctxBase(), rndDe());
  assert.equal(paramsDe(sinNumeros.pasos)?.etapa, 'ganado', 'la acción queda: sólo se va el monto');
  assert.equal(paramsDe(sinNumeros.pasos)?.monto, undefined);
  assert.ok(sinNumeros.avisos.some((a) => a.includes('monto inventado')), sinNumeros.avisos.join(' | '));
  const conPrecio = ctxBase({ numerosPermitidos: numerosEn('El programa cuesta USD 1.500') });
  const ok = deIA(pasarAGanado(1500), conPrecio, rndDe());
  assert.equal(paramsDe(ok.pasos)?.monto, 1500);
  assert.deepEqual(validarIA(ok.pasos, conPrecio), []);
});

// rotura (validarIA sin mirar los montos): 1 fallo de 14, cae éste.
test('validarIA rechaza un monto que no está en el pedido', () => {
  const conPrecio = ctxBase({ numerosPermitidos: [1500] });
  const r = deIA(pasarAGanado(1500), conPrecio, rndDe());
  const mal = r.pasos.map((p) => (p.accion ? { ...p, accion: { ...p.accion, params: { ...p.accion.params, monto: 4999 } } } : p));
  assert.ok(validarIA(mal, conPrecio).some((e) => e.includes('monto')));
  // Y la ruta arma los permitidos con el perfil y el pedido.
  assert.match(sinComentarios(leer('app/api/chat-agent/secuencias/ia/route.ts')), /numerosPermitidos: numerosEn\(`\$\{perfil\}\\n\$\{pedido\}`\)/);
});

// ── CREAR aceptaba una automatización ACTIVA con pasos [] y escribía los pasos antes de pausarla ──
// rotura (sin el 409 de la activa): 1 fallo de 24 (con flujo-ia-ruta), cae éste.
test('crear: una automatización ACTIVA no se crea con IA (409, «Pausa esta automatización primero»)', () => {
  const ruta = sinComentarios(leer('app/api/chat-agent/secuencias/ia/route.ts'));
  assert.match(ruta, /\.select\('id, nombre, pasos, activa[^']*'\)/);
  assert.match(ruta, /if \(modo === 'crear' && \(sec as \{ activa\?: unknown \}\)\.activa === true\) \{\n\s*return Response\.json\(\{ ok: false, error: '[^']+' \}, \{ status: 409 \}\);/);
});

// rotura (pausar DESPUÉS de guardar, como estaba): 1 fallo de 24 (con flujo-ia-ruta), cae éste.
test('crear: se PAUSA antes de escribir los pasos, y después de mirar la cancelación', () => {
  const ruta = sinComentarios(leer('app/api/chat-agent/secuencias/ia/route.ts'));
  const senal = ruta.indexOf('if (req.signal.aborted)');
  const pausa = ruta.indexOf('await setSecuenciaActiva(secuenciaId, false);');
  const guarda = ruta.indexOf('await setSecuenciaPasos(');
  assert.ok(senal > 0 && pausa > senal && guarda > pausa, `señal ${senal} · pausa ${pausa} · guardar ${guarda}`);
  assert.equal(ruta.split('setSecuenciaActiva(').length - 1, 1, 'una sola pausa');
});

// ── «hasta 1 min» en la espera, cuando la ruta puede tardar ~5 min ──
// rotura (volver a «hasta 1 min»): 1 fallo de 17, cae éste.
test('la espera dice el tope REAL: sale de TOPE_CLIENTE_MS y no es menor que el de la ruta', () => {
  const src = sinComentarios(leer('app/chatbot/CrearConIA.tsx'));
  assert.doesNotMatch(src, /hasta 1 min/);
  assert.match(src, /hasta \{Math\.round\(TOPE_CLIENTE_MS \/ 60_000\)\} min/);
  const tope = Number(/const TOPE_CLIENTE_MS = ([\d_]+);/.exec(src)?.[1].replace(/_/g, ''));
  const max = Number(/export const maxDuration = (\d+);/.exec(leer('app/api/chat-agent/secuencias/ia/route.ts'))?.[1]);
  assert.ok(Math.round(tope / 60_000) >= max / 60, `dice ${Math.round(tope / 60_000)} min y la ruta corta a ${max} s`);
});

test('el ejemplo de crear se traduce entero y pasa validarGrafo y validarIA', () => {
  const ctx = ctxBase();
  const r = deIA(ejemploDe(CREAR_IA_SYSTEM_TEMPLATE), ctx, rndDe());
  assert.deepEqual(validarGrafo(r.pasos), []);
  assert.deepEqual(validarIA(r.pasos, ctx), []);
  assert.equal(r.pasos.length, 7);
});
