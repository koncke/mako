// =============================================================================
// CREAR CON IA (lib/flujo-ia.ts): del JSON del modelo a `pasos`, reparado por código
// =============================================================================
// Pedido de Martín (08/10/2026, segunda tanda, punto 11): «Quiero que implementes la
// funcionalidad de crear un secuencia con IA, mediante un "prompt", y que ahí se vayan
// creando...». Decisión 14 de docs/chatbot-flujo-ramas-diseno.md.
//
// Lo que fija este archivo es la SEGUNDA CAPA de «una regla en un prompt no es una regla»: lo
// que el modelo escriba mal (una acción que no existe, una etiqueta con un id inventado, un
// link en el texto, una espera adentro de «Si responde»…) se REPARA con código antes de
// mostrarlo, y cada reparación queda en `avisos`.
//
// ⚠️ PROBADO ROMPIENDO LA PIEZA, 08/10/2026: el arnés (I-romper.mjs en el scratchpad de la
// sesión) aplicó 25 roturas a lib/flujo-ia.ts, una por vez, corriendo este archivo (21 tests);
// restaura de MEMORIA, nunca con git. Cada rotura y cuántos tests la cazaron está al lado del test
// que la persigue («rotura N: …»). Las 25 cazadas.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deIA, deIAEdicion, validarIA, aIA, ordenDeRevelado, conEtiquetasReales, disparadorReal, refsSinResolver,
  userDeCrear, leyendoTexto, leyendoDe, limpiarTexto, erroresNuevos, LISTA_BLANCA_IA,
  CREAR_IA_SYSTEM_TEMPLATE, EDITAR_IA_SYSTEM_TEMPLATE, type CtxIA, type PasoIA,
} from '../lib/flujo-ia';
import { validarGrafo, padreDe, claseDe, ID_INICIO, raicesSalida, raizRespuesta, descendientes, type PasoGrafo } from '../lib/flujo-grafo';
import { porId } from '../lib/api-mako/registro';
import { esAccion } from '../lib/api-mako/tipos';
import { marcasDeVoseo } from '../lib/puestas-data';

const acciones = LISTA_BLANCA_IA.map((id) => {
  const d = porId(id);
  if (!d) throw new Error(`la lista blanca nombra «${id}», que no está en el registro`);
  return { id: d.id, titulo: d.titulo, parametros: d.parametros };
});

const URL_AGENDA = 'https://cal.com/negocio/llamada';
const ctxBase = (o: Partial<CtxIA> = {}): CtxIA => ({
  etiquetas: [{ id: 7, nombre: 'Cualificado' }, { id: 9, nombre: 'Viejo', archivada: true }],
  productos: [
    { funnelId: 3, productoId: null, nombre: 'Mentoría', esDefault: true, etapas: [{ value: 'nuevo', label: 'Nuevo' }, { value: 'agendado', label: 'Agendado' }] },
    { funnelId: 5, productoId: 11, nombre: 'Curso', etapas: [{ value: 'interesado', label: 'Interesado' }] },
  ],
  disparadores: [{ value: 'trigger:instant_form_sin_agenda', label: 'Formulario sin agenda' }],
  audios: [{ id: 21, titulo: 'Bienvenida', transcript: 'Hola, soy yo' }],
  archivos: [],
  acciones,
  links: { agenda: { url: URL_AGENDA, para: 'agendar una llamada' } },
  ...o,
});

/** Un generador determinista para `nuevoId`. */
const rndDe = () => { let k = 0; return () => ((k++ * 0.137) % 1); };

const EJEMPLO = {
  nombre: 'Bienvenida a quien dejó sus datos', disparador: 'trigger:instant_form_sin_agenda', etiquetas_nuevas: ['Seguimiento'], inicio: 't1',
  tarjetas: [
    { id: 't1', tipo: 'mensaje', canal: 'whatsapp', texto: 'Hola {{nombre}}, ¿te sirve que hablemos esta semana?', link: 'agenda', sigue: 't2' },
    { id: 't2', tipo: 'esperar', horas: 24, sigue: 't3' },
    { id: 't3', tipo: 'condicion', ramas: [{ si: [{ campo: 'agendo' }], sigue: 't4' }], si_no: 't5' },
    { id: 't4', tipo: 'accion', operacion: 'avisar_al_equipo', datos: { mensaje: 'Agendó después de la bienvenida' } },
    { id: 't5', tipo: 'etiqueta', poner: 'Seguimiento' },
    { id: 'r1', tipo: 'si_responde', casos: [{ titulo: 'Quiere agendar', cuando: 'Pide un horario', sigue: 'r2' }], otra_cosa: null },
    { id: 'r2', tipo: 'mensaje', canal: 'whatsapp', ia: true, texto: 'Ofrécele dos horarios de esta semana.' },
  ],
};

const porClase = (pasos: readonly PasoGrafo[], c: string) => pasos.filter((p) => claseDe(p) === c) as PasoIA[];
const mensajes = (pasos: readonly PasoGrafo[]) => porClase(pasos, 'mensaje');
const ok = (pasos: readonly PasoGrafo[], ctx: CtxIA) => {
  assert.deepEqual(validarGrafo(pasos), [], 'validarGrafo');
  assert.deepEqual(validarIA(pasos, ctx), [], 'validarIA');
};

// rotura 1 (esperar en horas sin ×60): 2 fallos. rotura 2 (leadId del modelo en vez del evento): 2 fallos.
test('crear: el ejemplo del prompt se traduce entero y pasa las dos capas', () => {
  const ctx = ctxBase();
  const r = deIA(EJEMPLO, ctx, rndDe());
  ok(r.pasos, ctx);
  // AI Step v2 (décima tanda): el «MaKo contesta» de «Si responde» se pliega ADENTRO de su tarjeta (`respuestaAPasoIA`):
  // eran 7 tarjetas, son 6.
  assert.equal(r.pasos.length, 6);
  assert.equal(r.nombre, 'Bienvenida a quien dejó sus datos');
  assert.equal(r.disparador, 'trigger:instant_form_sin_agenda');
  assert.deepEqual(r.avisos, []);
  const [m1] = mensajes(r.pasos);
  const esp = porClase(r.pasos, 'esperar')[0];
  assert.equal(m1.siguiente, esp.id);
  assert.deepEqual(esp.espera, { modo: 'tiempo', minutos: 1440 });
  const cond = porClase(r.pasos, 'condicion')[0];
  const [avisar, etiqueta] = porClase(r.pasos, 'accion');
  assert.equal(cond.ramas![0].siguiente, avisar.id);
  assert.equal(cond.si_no, etiqueta.id);
  assert.deepEqual(avisar.accion, { operacion: 'avisar_al_equipo', params: { leadId: 'evento', mensaje: 'Agendó después de la bienvenida' } });
  // La etiqueta que no existe se CREA por nombre (un ref negativo), nunca un id inventado.
  assert.deepEqual(r.etiquetasNuevas, [{ ref: -1, nombre: 'Seguimiento' }]);
  assert.deepEqual(etiqueta.accion, { operacion: 'poner_etiqueta_lead', params: { leadId: 'evento', etiquetaId: -1 } });
});

// rotura 3 (un `sigue` puede apuntar a «Si responde»): 1 fallo. rotura 4 (el «MaKo contesta»
// de «Si responde» sin `revisar`): 1 fallo.
test('«Si responde» no tiene padre: cuelga del CRON, y una flecha que la apunta se corta', () => {
  const ctx = ctxBase();
  const r = deIA(EJEMPLO, ctx, rndDe());
  const resp = porClase(r.pasos, 'respuesta')[0];
  assert.equal(padreDe(r.pasos, resp.id!), null);
  assert.equal(raizRespuesta(r.pasos), resp.id);
  // AI Step v2 (décima tanda): «Crear con IA» pliega «Si responde» a AI Step, UNA tarjeta por caso, y el «MaKo
  // contesta» queda ADENTRO del caso (sin tarjeta hija). Nace a revisar: sin `sola`.
  assert.equal(resp.paso_ia, true);
  assert.equal(resp.casos!.length, 1);
  assert.equal(resp.casos![0].siguiente, null);
  assert.ok((resp.casos![0].responder ?? '').trim(), 'el caso contesta');
  assert.notEqual(resp.casos![0].sola, true, '«MaKo contesta» nace como borrador');

  const conFlecha = structuredClone(EJEMPLO);
  conFlecha.tarjetas[4] = { id: 't5', tipo: 'etiqueta', poner: 'Seguimiento', sigue: 'r1' } as never;
  const r2 = deIA(conFlecha, ctx, rndDe());
  ok(r2.pasos, ctx);
  assert.equal(padreDe(r2.pasos, raizRespuesta(r2.pasos)!), null);
  assert.ok(r2.avisos.some((a) => a.includes('no cuelga de ninguna tarjeta')), r2.avisos.join(' | '));
});

// rotura 5 (pegar `ctx.links[k].url` sin mirar si existe): 1 fallo. rotura 6 (no borrar las
// URL del texto): 1 fallo.
test('un link NUNCA pasa por el modelo: la URL la pone el código desde ctx.links, o no va', () => {
  const ctx = ctxBase();
  const r = deIA(EJEMPLO, ctx, rndDe());
  assert.ok(mensajes(r.pasos)[0].cuerpo.endsWith(URL_AGENDA));

  // Sin un link de agenda guardado (medido el 08/10/2026: ni ws1 ni ws13 lo tienen), el mensaje
  // sale SIN link y queda el aviso.
  const sin = deIA(EJEMPLO, ctxBase({ links: {} }), rndDe());
  assert.ok(!/https?:\/\//.test(mensajes(sin.pasos)[0].cuerpo));
  assert.ok(sin.avisos.some((a) => a.includes('No tengo guardado el link')));

  // Una URL escrita por el modelo en el texto se BORRA, aunque parezca la buena.
  const escrita = structuredClone(EJEMPLO);
  escrita.tarjetas[0] = { ...escrita.tarjetas[0], texto: 'Agenda aquí: https://evil.example/x y listo', link: undefined } as never;
  const r3 = deIA(escrita, ctx, rndDe());
  assert.ok(!mensajes(r3.pasos)[0].cuerpo.includes('evil'));
  assert.ok(r3.avisos.some((a) => a.startsWith('Borré un link')));
  ok(r3.pasos, ctx);

  // Y el prompt del modelo lleva la CLAVE y para qué sirve, nunca la URL.
  const user = userDeCrear(ctx, { perfil: 'Mentorías', voz: null, pedido: 'una bienvenida' });
  assert.ok(user.includes('agenda: agendar una llamada'));
  assert.ok(!user.includes(URL_AGENDA), 'la URL viajó al modelo');
});

// rotura 7 (la acción sacada corta la cadena en vez de conectar al padre con lo que seguía): 2 fallos.
test('una acción fuera de la lista blanca se saca y su padre se conecta a lo que seguía', () => {
  const ctx = ctxBase();
  const r = deIA({ inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'mensaje', texto: 'Hola', sigue: 't2' },
    { id: 't2', tipo: 'accion', operacion: 'borrar_lead', datos: {}, sigue: 't3' },
    { id: 't3', tipo: 'esperar', dias: 1, sigue: 't4' },
    { id: 't4', tipo: 'mensaje', texto: 'Sigo por aquí' },
  ] }, ctx, rndDe());
  ok(r.pasos, ctx);
  assert.equal(porClase(r.pasos, 'accion').length, 0);
  const [m1] = mensajes(r.pasos);
  assert.equal(m1.siguiente, porClase(r.pasos, 'esperar')[0].id);
  assert.ok(r.avisos.some((a) => a.includes('borrar_lead')), r.avisos.join(' | '));
});

// rotura 25 (dejar las variables en los datos de una acción): 1 fallo. La forma, otra vez de Groq:
// «El lead {{nombre}} ya agendó» en el aviso al equipo (una acción no completa variables).
test('los datos de una acción no llevan variables: se borran y queda el aviso', () => {
  const ctx = ctxBase();
  const r = deIA({ inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'accion', operacion: 'avisar_al_equipo', datos: { titulo: 'Agendó', mensaje: 'El lead {{nombre}} ya agendó [la llamada].' } },
  ] }, ctx, rndDe());
  ok(r.pasos, ctx);
  assert.deepEqual((porClase(r.pasos, 'accion')[0].accion as { params: unknown }).params, { leadId: 'evento', titulo: 'Agendó', mensaje: 'El lead ya agendó.' });
  assert.ok(r.avisos.some((a) => a.includes('variable de una acción')));
});

// rotura 8 (comparar el nombre de la etiqueta sin normalizar tildes y mayúsculas): 4 fallos.
// rotura 9 (aceptar un id numérico de etiqueta aunque no exista): 1 fallo.
test('una etiqueta se resuelve por NOMBRE normalizado; nunca con un id inventado', () => {
  const ctx = ctxBase();
  const r = deIA({ inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'etiqueta', poner: '  CUALIFICÁDO ', sigue: 't2' },
    { id: 't2', tipo: 'condicion', ramas: [{ si: [{ campo: 'etiqueta', etiqueta: '999' }], sigue: 't3' }, { si: [{ campo: 'etiqueta', etiqueta: 'cualificado' }], sigue: 't4' }], si_no: null },
    { id: 't3', tipo: 'mensaje', texto: 'A' },
    { id: 't4', tipo: 'mensaje', texto: 'B' },
  ] }, ctx, rndDe());
  ok(r.pasos, ctx);
  assert.deepEqual(r.etiquetasNuevas, [], 'no se crea una etiqueta que ya existe');
  assert.equal((porClase(r.pasos, 'accion')[0].accion as unknown as { params: { etiquetaId: number } }).params.etiquetaId, 7);
  const cond = porClase(r.pasos, 'condicion')[0];
  assert.equal(cond.ramas!.length, 1, 'la rama con el id inventado se saca');
  assert.deepEqual(cond.ramas![0].filas, [{ campo: 'etiqueta', valor: 7 }]);
  // Una ARCHIVADA no se usa, y tampoco se crea otra con su nombre.
  const arch = deIA({ inicio: 't1', tarjetas: [{ id: 't1', tipo: 'etiqueta', poner: 'viejo' }] }, ctx, rndDe());
  assert.equal(arch.pasos.length, 0);
  assert.deepEqual(arch.etiquetasNuevas, []);
});

// rotura 10 (una condición sin ramas válidas se deja en vez de reemplazarla por su «si no»): 1 fallo.
test('una etapa sin coincidencia saca la fila; la condición que queda sin ramas pasa a su «si no»', () => {
  const ctx = ctxBase();
  const r = deIA({ inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'condicion', ramas: [{ si: [{ campo: 'etapa', etapa: 'Inexistente' }], sigue: 't2' }], si_no: 't3' },
    { id: 't2', tipo: 'mensaje', texto: 'Nunca' },
    { id: 't3', tipo: 'mensaje', texto: 'Siempre' },
  ] }, ctx, rndDe());
  ok(r.pasos, ctx);
  assert.equal(porClase(r.pasos, 'condicion').length, 0);
  assert.deepEqual(mensajes(r.pasos).map((m) => m.cuerpo), ['Siempre']);
  assert.ok(r.avisos.some((a) => a.includes('Inexistente')));

  // Por rótulo y por producto: la clave y el embudo (null = la casa del lead, el principal).
  const r2 = deIA({ inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'condicion', ramas: [{ si: [{ campo: 'etapa', etapa: 'Agendado' }], sigue: 't2' }, { si: [{ campo: 'etapa', etapa: 'interesado', producto: 'curso' }], sigue: 't3' }] },
    { id: 't2', tipo: 'mensaje', texto: 'A' }, { id: 't3', tipo: 'mensaje', texto: 'B' },
  ] }, ctx, rndDe());
  ok(r2.pasos, ctx);
  assert.deepEqual(porClase(r2.pasos, 'condicion')[0].ramas!.map((x) => x.filas[0]), [
    { campo: 'etapa', valor: 'agendado' }, { campo: 'etapa', valor: 'interesado', funnel_id: 5 },
  ]);
});

// rotura 11 (un audio que no existe se deja con su `audio_id`): 1 fallo.
test('un audio o un archivo que no está en la biblioteca: el mensaje pasa a texto', () => {
  const ctx = ctxBase();
  const r = deIA({ inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'mensaje', texto: 'Te dejo un audio', audio: 77, sigue: 't2' },
    { id: 't2', tipo: 'esperar', dias: 1, sigue: 't3' },
    { id: 't3', tipo: 'mensaje', texto: 'Escúchalo', audio: 'bienvenida', sigue: 't4' },
    { id: 't4', tipo: 'esperar', dias: 1, sigue: 't5' },
    { id: 't5', tipo: 'mensaje', texto: 'El PDF', archivo: 4 },
  ] }, ctx, rndDe());
  ok(r.pasos, ctx);
  const [a, b, c] = mensajes(r.pasos);
  assert.equal(a.tipo, undefined);
  assert.equal(a.audio_id, undefined);
  assert.equal(b.tipo, 'audio');
  assert.equal(b.audio_id, 21);
  assert.equal(c.tipo, undefined);
  assert.ok(r.avisos.some((x) => x.includes('audio no está')));
  assert.ok(r.avisos.some((x) => x.includes('archivo no está')));
});

// rotura 12 (no borrar los corchetes): 1 fallo. rotura 13 (dejar una variable que el motor no resuelve): 1 fallo.
test('un corchete o una variable desconocida se borran del texto; las del motor quedan', () => {
  const t = limpiarTexto('Hola {{nombre}}, [tu link de agenda] cuesta {{precio}} en {negocio} ');
  assert.equal(t.texto, 'Hola {{nombre}}, cuesta en {{negocio}}');
  assert.deepEqual(t.quitado.sort(), ['corchete', 'variable']);
  const ctx = ctxBase();
  const r = deIA({ inicio: 't1', tarjetas: [{ id: 't1', tipo: 'mensaje', texto: 'Hola {{nombre}} [aquí va el link] {{cupon}}' }] }, ctx, rndDe());
  ok(r.pasos, ctx);
  assert.equal(mensajes(r.pasos)[0].cuerpo, 'Hola {{nombre}}');
  // Un mensaje que queda vacío después de limpiar se saca.
  const vacio = deIA({ inicio: 't1', tarjetas: [{ id: 't1', tipo: 'mensaje', texto: '[link] {{precio}}' }] }, ctx, rndDe());
  assert.equal(vacio.pasos.length, 0);
});

// rotura 14 (no sacar la espera de «Si responde»): 1 fallo.
test('una espera dentro de «Si responde» se saca y lo que seguía sube', () => {
  const ctx = ctxBase();
  const r = deIA({ inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'mensaje', texto: 'Hola' },
    { id: 'r1', tipo: 'si_responde', casos: [{ titulo: 'Pregunta', cuando: 'Hace una pregunta', sigue: 'r2' }] },
    { id: 'r2', tipo: 'esperar', horas: 2, sigue: 'r3' },
    { id: 'r3', tipo: 'mensaje', texto: 'Te contesto' },
  ] }, ctx, rndDe());
  ok(r.pasos, ctx);
  const resp = porClase(r.pasos, 'respuesta')[0];
  assert.equal(porClase(r.pasos, 'esperar').length, 0);
  assert.equal(resp.casos![0].siguiente, mensajes(r.pasos).find((m) => m.cuerpo === 'Te contesto')!.id);
  assert.ok(r.avisos.some((a) => a.includes('espera de «Si responde»')));
});

// TERCERA TANDA, decisión 3: «Ir a» sale de Crear con IA. Antes acá se probaba que un «Ir a» hacia
// atrás con una espera en el medio QUEDABA; ahora no queda ninguno.
// PROBADO ROMPIÉNDOLO (09/10/2026, scratchpad F-romper.mjs, restaura de memoria), de 21 tests:
// nodoDe deja el «Ir a» que pidió el modelo → 1 fallo; el segundo padre se corta sin aviso → 1 fallo;
// validarIA acepta un «Ir a» → 1 fallo. Cae éste las tres veces.
test('Crear con IA no arma «Ir a»: el que pide el modelo se saca, y un segundo padre se corta', () => {
  const ctx = ctxBase();
  const pedido = deIA({ inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'mensaje', texto: 'Uno', sigue: 't2' },
    { id: 't2', tipo: 'esperar', dias: 3, sigue: 't3' },
    { id: 't3', tipo: 'ir_a', a: 't1' },
  ] }, ctx, rndDe());
  ok(pedido.pasos, ctx);
  assert.equal(porClase(pedido.pasos, 'ir_a').length, 0);
  assert.equal(porClase(pedido.pasos, 'esperar')[0].siguiente, null, 'la espera queda sin nada después');
  assert.ok(pedido.avisos.some((a) => a.includes('«Ir a»')), pedido.avisos.join(' | '));

  // Dos ramas que apuntan a la misma tarjeta: queda en la primera, la otra salida vacía, y sin salto.
  const dosPadres = deIA({ inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'condicion', ramas: [{ si: [{ campo: 'agendo' }], sigue: 't2' }], si_no: 't2' },
    { id: 't2', tipo: 'mensaje', texto: 'Para todos' },
  ] }, ctx, rndDe());
  ok(dosPadres.pasos, ctx);
  assert.equal(porClase(dosPadres.pasos, 'ir_a').length, 0);
  const cond = porClase(dosPadres.pasos, 'condicion')[0];
  assert.equal(cond.ramas![0].siguiente, mensajes(dosPadres.pasos)[0].id);
  assert.equal(cond.si_no, null);
  assert.ok(dosPadres.avisos.some((a) => a.includes('dos lugares')), dosPadres.avisos.join(' | '));

  // Y la segunda capa lo rechaza si una reparación fallara.
  const conSalto = [...pedido.pasos, { id: 'zz', nodo: 'ir_a' as const, destino: { nodo: pedido.pasos[0].id! } }];
  assert.ok(validarIA(conSalto, ctx).some((e) => e.includes('«Ir a»')));
});

// rotura 16 (no avisar las sueltas; lo que no cuelga de nada nunca se emite): 1 fallo.
test('una tarjeta suelta se saca', () => {
  const ctx = ctxBase();
  const r = deIA({ inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'mensaje', texto: 'Uno' },
    { id: 'x9', tipo: 'mensaje', texto: 'Nadie me apunta' },
  ] }, ctx, rndDe());
  ok(r.pasos, ctx);
  assert.deepEqual(mensajes(r.pasos).map((m) => m.cuerpo), ['Uno']);
  assert.ok(r.avisos.some((a) => a.includes('no colgaba de nada')));
});

// rotura 17 (el nodo de inicio al principio del array): 2 fallos. rotura 18 (`sigue` como lista
// tomando sólo el primero): 2 fallos.
test('varias flechas: `inicio` y `sigue` como lista son caminos en PARALELO', () => {
  const ctx = ctxBase();
  const r = deIA({ inicio: ['w1', 'e1'], tarjetas: [
    { id: 'w1', tipo: 'mensaje', texto: 'Por WhatsApp', sigue: ['w2', 'w3'] },
    { id: 'w2', tipo: 'esperar', dias: 1, sigue: 'w4' },
    { id: 'w4', tipo: 'mensaje', texto: 'Seguimiento' },
    { id: 'w3', tipo: 'etiqueta', poner: 'Cualificado' },
    { id: 'e1', tipo: 'email', asunto: 'Te escribo por aquí también', texto: 'Hola {{nombre}}' },
  ] }, ctx, rndDe());
  ok(r.pasos, ctx);
  const ini = r.pasos[r.pasos.length - 1];
  assert.equal(ini.id, ID_INICIO, 'el inicio va al FINAL del array');
  assert.equal(claseDe(ini), 'inicio');
  const [w1, w4, e1] = [mensajes(r.pasos).find((m) => m.cuerpo === 'Por WhatsApp')!, mensajes(r.pasos).find((m) => m.cuerpo === 'Seguimiento')!, mensajes(r.pasos).find((m) => m.canal === 'email')!];
  assert.equal(ini.siguiente, w1.id);
  assert.deepEqual(ini.paralelos, [e1.id]);
  assert.deepEqual(raicesSalida(r.pasos), [w1.id, e1.id]);
  assert.equal(w1.siguiente, porClase(r.pasos, 'esperar')[0].id);
  assert.deepEqual(w1.paralelos, [porClase(r.pasos, 'accion')[0].id]);
  assert.ok(descendientes(r.pasos, w1.id!).has(w4.id!));
});

// rotura 23 (sin `preferirEsperas`): 1 fallo. La forma es la que devolvió Groq (gpt-oss-120b) el
// 08/10/2026: el recordatorio colgado del email Y de la espera de «3 h antes».
test('una tarjeta colgada de dos lugares, y uno es una espera: se queda con la espera', () => {
  const ctx = ctxBase();
  const r = deIA({ inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'mensaje', canal: 'whatsapp', texto: 'Confirmado', sigue: ['t2', 't3'] },
    { id: 't2', tipo: 'mensaje', canal: 'email', asunto: 'Qué preparar', texto: 'Trae tus dudas', sigue: 't4' },
    { id: 't3', tipo: 'esperar', horas: 3, antes_de_reunion: true, sigue: 't4' },
    { id: 't4', tipo: 'mensaje', canal: 'whatsapp', texto: 'Nos vemos en 3 horas' },
  ] }, ctx, rndDe());
  ok(r.pasos, ctx);
  const espera = porClase(r.pasos, 'esperar')[0];
  const recordatorio = mensajes(r.pasos).find((m) => m.cuerpo === 'Nos vemos en 3 horas')!;
  const email = mensajes(r.pasos).find((m) => m.canal === 'email')!;
  assert.deepEqual(espera.espera, { modo: 'antes_reunion', minutos: 180 });
  assert.equal(espera.siguiente, recordatorio.id);
  assert.equal(email.siguiente, null);
  assert.equal(porClase(r.pasos, 'ir_a').length, 0);
});

// rotura 19 (el orden de revelado en profundidad en vez de a lo ancho): 1 fallo.
test('ordenDeRevelado: primero el CRON, después la salida A LO ANCHO, después «Si responde»', () => {
  const ctx = ctxBase();
  const r = deIA({ inicio: ['a', 'b'], tarjetas: [
    { id: 'a', tipo: 'mensaje', texto: 'A', sigue: 'a2' },
    { id: 'a2', tipo: 'esperar', dias: 1, sigue: 'a3' },
    { id: 'a3', tipo: 'mensaje', texto: 'A3' },
    { id: 'b', tipo: 'email', asunto: 'B', texto: 'B' },
    { id: 'r', tipo: 'si_responde', casos: [{ titulo: 'Sí', cuando: 'Dice que sí', sigue: 'r2' }] },
    { id: 'r2', tipo: 'mensaje', texto: 'Genial' },
  ] }, ctx, rndDe());
  ok(r.pasos, ctx);
  const id = (txt: string) => mensajes(r.pasos).find((m) => m.cuerpo === txt)!.id!;
  const orden = ordenDeRevelado(r.pasos);
  assert.deepEqual(orden, [ID_INICIO, id('A'), id('B'), porClase(r.pasos, 'esperar')[0].id, id('A3'), porClase(r.pasos, 'respuesta')[0].id, id('Genial')]);
  // Todas las tarjetas del lienzo aparecen una vez (el inicio ES el CRON: no se repite).
  assert.equal(new Set(orden).size, orden.length);
  assert.equal(orden.length, r.pasos.length);
});

// rotura 20 (validarIA acepta cualquier etiqueta): 1 fallo.
test('validarIA rechaza lo que una reparación hubiera dejado pasar', () => {
  const ctx = ctxBase();
  const base = deIA(EJEMPLO, ctx, rndDe()).pasos;
  const mal = base.map((p) => (claseDe(p) === 'condicion'
    ? { ...p, ramas: [{ ...p.ramas![0], filas: [{ campo: 'etiqueta' as const, valor: 999 }] }] }
    : p));
  assert.ok(validarIA(mal, ctx).some((e) => e.includes('etiqueta que no existe')));
  const voseo = base.map((p, i) => (i === 0 ? { ...p, cuerpo: 'Tocá el botón y agendá' } : p));
  assert.ok(validarIA(voseo, ctx).some((e) => e.includes('voseo')));
  assert.deepEqual(validarIA(voseo, { ...ctx, usaVoseo: true }), [], 'si la guía de voz vosea, no se marca');
  const accion = base.map((p) => (claseDe(p) === 'accion' ? { ...p, accion: { operacion: 'borrar_lead', params: {} } } : p));
  assert.ok(validarIA(accion, ctx).some((e) => e.includes('borrar_lead')));
  const link = base.map((p, i) => (i === 0 ? { ...p, cuerpo: 'Mira https://otra.example' } : p));
  assert.ok(validarIA(link, ctx).some((e) => e.includes('link')));
});

// rotura 21 (conEtiquetasReales no cambia la fila de la condición): 1 fallo. rotura 24 (elegir las
// etiquetas nuevas sin mirar el disparador ya resuelto, el bug que tenía el WIP): 1 fallo.
test('las etiquetas nuevas se cambian por el id real recién al guardar', () => {
  const ctx = ctxBase();
  const r = deIA({ inicio: 't1', disparador: 'etiqueta:Lista', tarjetas: [
    { id: 't1', tipo: 'condicion', ramas: [{ si: [{ campo: 'etiqueta', etiqueta: 'Seguimiento' }], sigue: 't2' }] },
    { id: 't2', tipo: 'etiqueta', poner: 'Seguimiento' },
  ] }, ctx, rndDe());
  assert.deepEqual(r.etiquetasNuevas.map((n) => n.nombre), ['Seguimiento', 'Lista']);
  assert.equal(r.disparador, 'etiqueta:-2');
  assert.deepEqual(refsSinResolver(r.pasos), [-1]);
  const ids = new Map([[-1, 40], [-2, 41]]);
  const reales = conEtiquetasReales(r.pasos, ids);
  assert.deepEqual(refsSinResolver(reales), []);
  assert.equal(porClase(reales, 'condicion')[0].ramas![0].filas[0].valor, 40);
  assert.equal(disparadorReal(r.disparador, ids), 'etiqueta:41');
  assert.equal(disparadorReal('etiqueta:-5', ids), null, 'un ref sin id real no se guarda');
});

// rotura 22 (editar pisa una salida ocupada): 1 fallo.
test('editar sólo AGREGA: lo de antes queda igual y una salida ocupada no se pisa', () => {
  const ctx = ctxBase();
  const base = conEtiquetasReales(deIA(EJEMPLO, ctx, rndDe()).pasos, new Map([[-1, 40]]));
  const ctx2 = ctxBase({ etiquetas: [...ctxBase().etiquetas, { id: 40, nombre: 'Seguimiento' }] });
  const m1 = base[0];
  const r = deIAEdicion({ agregar: [
    { despues_de: 'cron', salida: 'paralelo', inicio: 'e1', tarjetas: [{ id: 'e1', tipo: 'email', asunto: 'Lo que te prometí', texto: 'Hola {{nombre}}', sigue: 'e2' }, { id: 'e2', tipo: 'etiqueta', poner: 'Seguimiento' }] },
    { despues_de: m1.id, salida: 'sig', tarjetas: [{ id: 'x1', tipo: 'mensaje', texto: 'Esto pisaría' }] },
  ] }, base, ctx2, rndDe());
  assert.deepEqual(erroresNuevos(base, r.pasos), []);
  assert.deepEqual(validarIA(r.pasos, ctx2, new Set(r.agregadas)), []);
  for (const p of base) assert.deepEqual({ ...r.pasos.find((q) => q.id === p.id), orden: 0 }, { ...p, orden: 0 }, `cambió ${p.id}`);
  assert.ok(r.avisos.some((a) => a.includes('no la pisé')));
  const ini = r.pasos.find((p) => claseDe(p) === 'inicio')!;
  assert.equal(ini.siguiente, m1.id);
  // El inicio NO cuenta como agregada: es la tarjeta del CRON (`ID_INICIO` = `ID_ENTRADA` del
  // lienzo), que ya estaba dibujada; revelarla de nuevo la haría parpadear.
  assert.deepEqual(r.agregadas.sort(), r.pasos.filter((p) => !base.some((b) => b.id === p.id) && claseDe(p) !== 'inicio').map((p) => p.id!).sort());
  assert.equal(r.agregadas.length, 2, 'el email y la etiqueta');
  assert.deepEqual(r.etiquetasNuevas, [], 'Seguimiento ya existía');
});

test('la lista blanca: sólo acciones del registro, gratis y reversibles', () => {
  for (const id of LISTA_BLANCA_IA) {
    const d = porId(id);
    assert.ok(d && esAccion(d), id);
    assert.equal(d.costo, 'gratis', id);
    assert.equal(d.reversible, true, id);
  }
});

test('aIA: el CRON no es una tarjeta, y los ids son los reales', () => {
  const ctx = ctxBase();
  const r = deIA({ inicio: ['a', 'b'], tarjetas: [{ id: 'a', tipo: 'mensaje', texto: 'A' }, { id: 'b', tipo: 'etiqueta', poner: 'Cualificado' }] }, ctx, rndDe());
  const c = aIA(r.pasos, ctx);
  assert.deepEqual(c.inicio, raicesSalida(r.pasos));
  assert.ok(!c.tarjetas.some((t) => t.id === ID_INICIO));
  assert.deepEqual(c.tarjetas.find((t) => t.tipo === 'etiqueta'), { id: r.pasos[1].id, tipo: 'etiqueta', poner: 'Cualificado', sigue: null });
});

test('lo que se leyó, en una línea, y los prompts en español neutro', () => {
  assert.equal(leyendoTexto(leyendoDe(ctxBase(), 'Mentorías')), 'tu perfil · 3 etapas · 1 etiqueta · 1 audio · 1 link');
  assert.equal(leyendoTexto(leyendoDe(ctxBase({ etiquetas: [], audios: [], links: {} }), '')), 'sin perfil · 3 etapas');
  for (const t of [CREAR_IA_SYSTEM_TEMPLATE, EDITAR_IA_SYSTEM_TEMPLATE]) assert.deepEqual(marcasDeVoseo(t), []);
});
