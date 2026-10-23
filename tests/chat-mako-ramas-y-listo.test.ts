// «Editar» con ramas según lo que conteste el lead, el control de lo pedido y el «✓ Listo» (22/10/2026)
// =============================================================================
// Martín, con #289 en el ws1 (modo Editar, con el crédito de Claude, Haiku), por el Cerebro:
//   B. «revisa lo que le pedí vs lo que creó, creó a la mitad las cosas que le pedí»: un saludo, una pregunta y DOS ramas
//      según lo que conteste. Medido en seco con una secuencia NEUTRA (scratchpad, medir-editar-ramas.mts; Haiku 6 veces y
//      Sonnet 3): los dos modelos mandan las ramas de formas que el código descartaba (un "si_responde" adentro de un tramo;
//      «cambiar» del «Si responde» con casos nuevos; un tramo colgado de él sin "caso") y las ramas se perdían. Sonnet no lo
//      arregla (armó una rama sola y preguntó por el link; 71-82 s y ~US$ 0,13 por turno contra ~5 s y US$ 0,008 de Haiku):
//      el arreglo es del código. Los fixtures de abajo son respuestas REALES de esa medición (textos neutros).
//   A. «Si me ponés un mensaje en rojo abajo y el de arriba no dice algo como "Listo!", parece que no funcionó»: «✓ Listo» y
//      una línea; lo que MaKo acomodó, en gris y plegado; en rojo SÓLO lo pedido que no se hizo (`noHecho`).
// ⚠️ PROBADO ROMPIÉNDOLO: los números van al pie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deIAEdicion, LISTA_BLANCA_IA, textosDeMensajes, type CtxIA } from '../lib/flujo-ia';
import { raizRespuesta, nodoPorId, type PasoGrafo } from '../lib/flujo-grafo';
import { faltantesDelPedido, errorDeFaltantes } from '../lib/flujo-ia-intencion';
import { revisarEdicion } from '../lib/flujo-ia-revision-editar';
import { lineaDeListo, CIERRE_EDICION } from '../lib/flujo-ia-cliente';
import { sanearMensaje } from '../lib/automatizacion-chat';
import { porId } from '../lib/api-mako/registro';

const RAIZ = join(import.meta.dirname, '..');
const leer = (p: string): string => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const acciones = LISTA_BLANCA_IA.map((id) => { const d = porId(id)!; return { id: d.id, titulo: d.titulo, parametros: d.parametros }; });
const CTX = {
  etiquetas: [{ id: 11, nombre: 'Sprint · respondió', archivada: false }],
  productos: [{ funnelId: 44, productoId: null, nombre: 'Sprint 3 días', esDefault: true, etapas: [{ value: 'lead', label: 'Lead entrante' }, { value: 'st0', label: 'Prospección activa' }], etapasEntrega: [] }],
  disparadores: [{ value: 'venta:44:st0', label: 'Sprint 3 días › Entra a «Prospección activa»' }],
  audios: [], archivos: [], acciones, links: {}, disparadorActual: 'venta:44:st0',
} as unknown as CtxIA;
/** La FORMA de #289 (condición «nunca le escribiste», el mensaje, «Si responde» sin casos → aviso → etiqueta), con textos neutros. */
const BASE = [
  { id: 'nzqh6wv', nodo: 'condicion', canal: 'whatsapp', orden: 1, ramas: [{ id: 'n2er7x6', modo: 'todas', filas: [{ no: true, campo: 'ya_contactado' }], siguiente: 'npin7mc' }], si_no: null, asunto: null, cuerpo: '', delay_horas: 0, template_wa: null },
  { id: 'npin7mc', canal: 'whatsapp', orden: 2, asunto: null, cuerpo: 'Hola {{nombre}}, te escribo de Estudio Norte.', revisar: false, siguiente: null, delay_horas: 0, template_wa: null },
  { id: 'nhhcilm', nodo: 'respuesta', canal: 'whatsapp', casos: [], orden: 3, si_no: 'nresp289', asunto: null, cuerpo: '', delay_horas: 0, template_wa: null },
  { id: 'nresp289', canal: 'whatsapp', orden: 4, asunto: null, cuerpo: '', siguiente: 'netiq289', delay_horas: 0, template_wa: null, accion: { operacion: 'avisar_al_equipo', params: { leadId: 'evento', partes: [{ tipo: 'texto', cuerpo: '💬 {{nombre_completo}} respondió' }], mensaje: '💬 {{nombre_completo}} respondió' } } },
  { id: 'netiq289', canal: 'whatsapp', orden: 5, asunto: null, cuerpo: '', siguiente: null, delay_horas: 0, template_wa: null, accion: { operacion: 'poner_etiqueta_lead', params: { leadId: 'evento', etiquetaId: 11 } } },
] as unknown as PasoGrafo[];
const PEDIDO = [
  'Quiero que la secuencia sea así:',
  '1. Primer mensaje: «Hola {Nombre}, soy Ana de Estudio Norte. ¿Cómo estás?»',
  '2. Después le preguntas: «¿Ya tienes un plan para tu proyecto este mes?»',
  '3. Si responde que sí, le mandas: «¡Genial! Te comparto nuestra guía para empezar: estudionorte.com/guia»',
  '4. Si responde que no, le mandas: «Entiendo. ¿Te gustaría que te cuente en 10 minutos cómo podemos ayudarte?»',
].join('\n');
const rnd = () => { let k = 0; return () => ((k++ * 0.137) % 1); };
/** Lo que quedó: los casos de «Si responde» y lo que falta del pedido. */
const medir = (obj: unknown) => {
  const r = deIAEdicion(obj, BASE, CTX, rnd());
  const resp = raizRespuesta(r.pasos);
  const casos = (resp ? nodoPorId(r.pasos, resp)?.casos ?? [] : []).map((c) => ({ titulo: c.titulo, cuando: c.cuando }));
  return { r, casos, faltan: faltantesDelPedido(PEDIDO, textosDeMensajes(r.pasos)) };
};

// ── Respuestas REALES de la medición en seco (22/10/2026, textos neutros) ────────────────────────────────────────
const HAIKU_CAMBIAR_CASOS = {"cambiar":[{"id":"npin7mc","texto":"Hola {{nombre}}, soy Ana de Estudio Norte. ¿Cómo estás?"},{"id":"nhhcilm","objetivo":"Identificar si el lead tiene un plan para su proyecto este mes","casos":[{"titulo":"Respondió que sí","cuando":"respuesta_contiene","valor":"sí","sigue":"t1"},{"titulo":"Respondió que no","cuando":"respuesta_contiene","valor":"no","sigue":"t2"}],"otra_cosa":"nresp289"}],"agregar":[{"despues_de":"nhhcilm","salida":"paralelo","tarjetas":[{"id":"t1","tipo":"mensaje","canal":"whatsapp","texto":"¡Genial! Te comparto nuestra guía para empezar: estudionorte.com/guia","sigue":null},{"id":"t2","tipo":"mensaje","canal":"whatsapp","texto":"Entiendo. ¿Te gustaría que te cuente en 10 minutos cómo podemos ayudarte?","sigue":null}]},{"despues_de":"npin7mc","salida":"sig","tarjetas":[{"id":"t3","tipo":"mensaje","canal":"whatsapp","texto":"¿Ya tienes un plan para tu proyecto este mes?","sigue":"nhhcilm"}]}]};
const HAIKU_CUANDO_OBJETO = {"cambiar":[{"id":"npin7mc","texto":"Hola {{nombre}}, soy Ana de Estudio Norte. ¿Cómo estás?"},{"id":"nhhcilm","casos":[{"titulo":"Respondió que sí","cuando":{"modo":"contiene_palabra","palabras":["sí","si","yes","claro","dale","ok","yep"]},"sigue":"nmsg_si"},{"titulo":"Respondió que no","cuando":{"modo":"contiene_palabra","palabras":["no","nope","nah","negativo"]},"sigue":"nmsg_no"}],"otra_cosa":"nmsg_duda"}],"quitar":["nresp289","netiq289"],"agregar":[{"despues_de":"npin7mc","salida":"sig","tarjetas":[{"id":"nmsg_pregunta","tipo":"mensaje","canal":"whatsapp","texto":"¿Ya tienes un plan para tu proyecto este mes?","sigue":"nhhcilm"}]},{"despues_de":"nhhcilm","salida":"si","tarjetas":[{"id":"nmsg_si","tipo":"mensaje","canal":"whatsapp","texto":"¡Genial! Te comparto nuestra guía para empezar: estudionorte.com/guia","sigue":null},{"id":"nmsg_no","tipo":"mensaje","canal":"whatsapp","texto":"Entiendo. ¿Te gustaría que te cuente en 10 minutos cómo podemos ayudarte?","sigue":null},{"id":"nmsg_duda","tipo":"mensaje","canal":"whatsapp","texto":"¿Ya tienes un plan para tu proyecto este mes?","sigue":null}]}]};
const HAIKU_SIN_PREGUNTA = {"cambiar":[{"id":"npin7mc","texto":"Hola {{nombre}}, soy Ana de Estudio Norte. ¿Cómo estás?"},{"id":"nhhcilm","objetivo":"Conocer si tiene un plan para su proyecto este mes","casos":[{"titulo":"Respondió que sí","cuando":"respuesta_contiene","valor":"sí","sigue":"t1"},{"titulo":"Respondió que no","cuando":"respuesta_contiene","valor":"no","sigue":"t2"}],"otra_cosa":"nresp289"}],"agregar":[{"despues_de":"nhhcilm","salida":"sig","tarjetas":[{"id":"t1","tipo":"mensaje","canal":"whatsapp","texto":"¡Genial! Te comparto nuestra guía para empezar: estudionorte.com/guia","sigue":null},{"id":"t2","tipo":"mensaje","canal":"whatsapp","texto":"Entiendo. ¿Te gustaría que te cuente en 10 minutos cómo podemos ayudarte?","sigue":null}]}]};
const SONNET_UN_CASO = {"cambiar":[{"id":"npin7mc","texto":"Hola {{nombre}}, soy Ana de Estudio Norte. ¿Cómo estás?"}],"agregar":[{"despues_de":"npin7mc","inicio":"t1","tarjetas":[{"id":"t1","tipo":"mensaje","canal":"whatsapp","texto":"¿Ya tienes un plan para tu proyecto este mes?","sigue":null}]},{"despues_de":"nhhcilm","caso":{"titulo":"No tiene plan","cuando":"El lead responde que no tiene un plan para su proyecto este mes"},"inicio":"t3","tarjetas":[{"id":"t3","tipo":"mensaje","canal":"whatsapp","texto":"Entiendo. ¿Te gustaría que te cuente en 10 minutos cómo podemos ayudarte?","sigue":null}]}]};
/** La forma de la PRIMERA corrida de Haiku (no quedó guardada): el tramo trae un "si_responde" entero, como al crear. */
const HAIKU_SI_RESPONDE_EN_EL_TRAMO = {
  cambiar: [{ id: 'npin7mc', texto: 'Hola {{nombre}}, soy Ana de Estudio Norte. ¿Cómo estás?' }],
  agregar: [{ despues_de: 'npin7mc', salida: 'sig', tarjetas: [
    { id: 'm1', tipo: 'mensaje', canal: 'whatsapp', texto: '¿Ya tienes un plan para tu proyecto este mes?', sigue: 'r1' },
    { id: 'r1', tipo: 'si_responde', objetivo: 'Saber si tiene un plan', casos: [
      { titulo: 'Dice que sí', cuando: 'El lead dice que ya tiene un plan', sigue: 'm2' },
      { titulo: 'Dice que no', cuando: 'El lead dice que todavía no tiene un plan', sigue: 'm3' },
    ] },
    { id: 'm2', tipo: 'mensaje', canal: 'whatsapp', texto: '¡Genial! Te comparto nuestra guía para empezar: estudionorte.com/guia' },
    { id: 'm3', tipo: 'mensaje', canal: 'whatsapp', texto: 'Entiendo. ¿Te gustaría que te cuente en 10 minutos cómo podemos ayudarte?' },
  ] }],
};

test('B · un "si_responde" adentro de un tramo: sus casos van al «Si responde» con su mensaje, y no se pierde nada', () => {
  const { r, casos, faltan } = medir(HAIKU_SI_RESPONDE_EN_EL_TRAMO);
  assert.deepEqual(casos.map((c) => c.titulo), ['Dice que sí', 'Dice que no']);
  assert.deepEqual(faltan, [], `faltan: ${faltan.join(' | ')} · avisos: ${r.avisos.join(' | ')}`);
  assert.ok(!r.avisos.some((a) => /no colgaban? de nada|ya hay una, sumé un caso|seguía en otra que no existe/.test(a)), r.avisos.join(' | '));
  assert.deepEqual(r.noHecho ?? [], []);
});

test('B · «cambiar» del «Si responde» con casos nuevos y sus mensajes en un tramo: cada caso con SU mensaje', () => {
  for (const [nombre, obj] of [['cambiar casos', HAIKU_CAMBIAR_CASOS], ['cuándo como objeto', HAIKU_CUANDO_OBJETO]] as const) {
    const { r, casos, faltan } = medir(obj);
    assert.deepEqual(casos.map((c) => c.titulo), ['Respondió que sí', 'Respondió que no'], nombre);
    assert.deepEqual(faltan, [], `${nombre}: faltan ${faltan.join(' | ')} · avisos: ${r.avisos.join(' | ')}`);
    // El «cuándo» es una frase que el clasificador puede leer, no la clave que mandó el modelo.
    for (const c of casos) assert.match(c.cuando, /\s/, `${nombre}: «${c.cuando}» no es una frase`);
    assert.ok(!r.avisos.some((a) => /se cambian en el lienzo|no puede abrir otro camino/.test(a)), `${nombre}: ${r.avisos.join(' | ')}`);
  }
});

test('B · lo que el MODELO no armó lo encuentra el control: la pregunta que faltó, la rama que faltó', () => {
  assert.deepEqual(medir(HAIKU_SIN_PREGUNTA).faltan, ['¿Ya tienes un plan para tu proyecto este mes?']);
  const sonnet = medir(SONNET_UN_CASO);
  assert.deepEqual(sonnet.casos.map((c) => c.titulo), ['No tiene plan'], 'el tramo colgado del «Si responde» con su caso');
  assert.deepEqual(sonnet.faltan, ['¡Genial! Te comparto nuestra guía para empezar: estudionorte.com/guia']);
  // El error del reintento dice qué falta y cómo se pone una rama.
  assert.match(errorDeFaltantes(sonnet.faltan), /Faltó en el flujo lo que pegó el dueño: «¡Genial!.*CASO de "si_responde"/);
});

test('el control: sólo textos entre comillas largos; sin tildes, links ni variables; 80% de sus palabras en UN mensaje', () => {
  const pedido = 'Cámbiale el nombre a «Sprint» y poné «Hola {Nombre}, soy Ana. Te paso el link: estudionorte.com/x»';
  assert.deepEqual(faltantesDelPedido(pedido, ['Hola {{nombre}}, soy Ana. Te paso el link:']), [], 'el link y la variable no cuentan');
  assert.deepEqual(faltantesDelPedido(pedido, ['Otra cosa']), ['Hola {Nombre}, soy Ana. Te paso el link: estudionorte.com/x']);
  assert.deepEqual(faltantesDelPedido('Sin comillas: hola, ¿cómo estás?', []), []);
  assert.deepEqual(faltantesDelPedido('«Sprint · respondió»', []), [], 'un nombre corto no es un mensaje');
});

test('la ruta: la primera vez lo que falta es un error (reintento); después se aplica y va en ROJO, nunca «Listo»', () => {
  const ruta = sinComentarios(leer('app/api/chat-agent/secuencias/ia/route.ts'));
  // Desde el merge con el AU2 (22/10/2026) el control vive en `revisarEdicion` (lib/flujo-ia-revision-editar.ts) y la ruta le
  // pasa UN `control` por turno. Ejecutado, con la respuesta REAL de Haiku que se olvidó la pregunta:
  assert.match(ruta, /const control = \{ yaPidioLoQueFalta: false \};/);
  const control = { yaPidioLoQueFalta: false };
  const intento = () => revisarEdicion({ obj: HAIKU_SIN_PREGUNTA, base: BASE, ctx: CTX, pedido: PEDIDO, historial: [], intencion: 'editar', control });
  const falta = '¿Ya tienes un plan para tu proyecto este mes?';
  const primero = intento();
  assert.deepEqual(primero.errores, [errorDeFaltantes([falta])], 'la primera vez no volvió al modelo con lo que faltaba');
  const segundo = intento();
  assert.deepEqual(segundo.errores, [], 'el segundo intento volvió a reintentar: el turno no termina nunca');
  assert.ok(segundo.r.noHecho?.includes(`No quedó en el lienzo: «${falta}»`), 'lo que faltó no se dice en rojo');
  // Sin `control` (otro llamador), cada intento es el primero.
  assert.deepEqual(revisarEdicion({ obj: HAIKU_SIN_PREGUNTA, base: BASE, ctx: CTX, pedido: PEDIDO, historial: [], intencion: 'editar' }).errores, [errorDeFaltantes([falta])]);
  assert.match(ruta, /noHecho\.length \? 'No pude hacer todo lo que pediste' : 'Listo'/);
  assert.match(ruta, /\.\.\.\(noHecho\.length \? \{ noHecho \} : \{\}\),\n\s+\}\)\]\);/, 'el chat guardado no sabe qué faltó');
  assert.match(ruta, /\.\.\.\(noHecho\.length \? \{ noHecho \} : \{\}\),\n\s+\}\);/, 'el stream no dice qué faltó');
  // Y lo que no se hizo se guarda en el chat (el saneado no lo tira).
  assert.deepEqual(sanearMensaje({ id: 'm1', de: 'mako', texto: 'x', at: new Date().toISOString(), via: 'app', noHecho: ['No quedó: «a»'] })?.noHecho, ['No quedó: «a»']);
});

test('A · «✓ Listo» y una línea cuando cambió algo y no falta nada; con algo pedido afuera, no hay «Listo»', () => {
  assert.equal(lineaDeListo({ cambios: { cambiadas: 1, quitadas: 0, agregadas: 3 } }), `Cambié 1 tarjeta y agregué 3. ${CIERRE_EDICION}`);
  assert.equal(lineaDeListo({ cambios: { cambiadas: 2, quitadas: 1, agregadas: 0 } }), `Cambié 2 tarjetas y saqué 1. ${CIERRE_EDICION}`);
  assert.equal(lineaDeListo({ cambios: { cambiadas: 1, quitadas: 0, agregadas: 3 }, noHecho: ['No quedó: «x»'] }), null);
  assert.equal(lineaDeListo({ cambios: { cambiadas: 0, quitadas: 0, agregadas: 0 } }), null);
  assert.equal(lineaDeListo({}), null);
  // La pantalla: el tilde verde arriba, lo acomodado plegado y en gris, lo no hecho en rojo.
  const chat = sinComentarios(leer('app/automations/ChatMako.tsx'));
  // (23/10/2026, AU4: en el globo del hilo único, `parteDeMako`.)
  const mensaje = chat.slice(chat.indexOf('function parteDeMako('), chat.indexOf('function parteDeMako(') + 4000);
  assert.match(mensaje, /arriba: listo \? <span data-listo-mako="" style=\{S\.listo\}>✓ Listo<\/span> : null,/);
  assert.match(mensaje, /<ul data-no-hecho-mako="" role="alert" style=\{S\.noHecho\}>/);
  assert.match(mensaje, /<details data-avisos-mako=""/);
  assert.match(chat, /\n {2}avisos: \{ maxWidth: '92%', fontSize: 12\.5, color: 'var\(--faint\)' \},/, 'lo acomodado volvió a naranja');
  assert.match(chat, /\n {2}noHecho: \{[^}]*color: 'var\(--bad\)'/);
  assert.match(chat, /\n {2}listo: \{[^}]*color: 'var\(--good\)'/);
  // El mensaje en vivo lleva las cuentas y lo no hecho (como el que guarda la ruta).
  assert.match(chat, /\.\.\.\(l\.noHecho\?\.length \? \{ noHecho: l\.noHecho \} : \{\}\),/);
});

// ── Probado rompiéndolo (22/10/2026, romper.mjs) ───────────────────────────────────────────────────────────────────
// Los números son «tests / fallan» de ESTE archivo con cada rotura.
//   R1. sin `partirSiResponde` (el "si_responde" del tramo se tira, como antes)              → 6 / 1
//   R2. «cambiar» del «Si responde» vuelve a rechazarse entero                               → 6 / 2
//   R3. sin `repartirCasosPedidos` (los casos sin su mensaje)                                 → 6 / 2
//   R4. el control de lo pedido mira cualquier palabra (sin el 80%)                          → 6 / 1
//   R5. la ruta sin el reintento por lo que falta                                            → 6 / 1
//   R6. «Listo» aunque falte algo                                                            → 6 / 1
//   R7. lo acomodado vuelve a naranja                                                        → 6 / 1
