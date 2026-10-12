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
  CREAR_IA_SYSTEM_TEMPLATE, EDITAR_IA_SYSTEM_TEMPLATE, objetivoDeIA, plantillaParaPedido, ejemploDePlantilla, entraEnGroq,
  PALABRAS_PLANTILLA, TOPE_TARJETAS_IA, TECHO_GROQ_IA, CARACTERES_POR_TOKEN_IA, SALIDA_DEL_TOPE_IA, SALIDA_MIN_IA,
  type CtxIA, type PasoIA,
} from '../lib/flujo-ia';
import { readFileSync } from 'node:fs';
import { PLANTILLAS, plantillaPorId, pasosDePlantilla } from '../lib/plantillas-automatizaciones';
import { esTarjetaTalCual } from '../lib/mako-tarjeta';
import { validarGrafo, padreDe, claseDe, ID_INICIO, raicesSalida, raizRespuesta, descendientes, TOPE_OBJETIVO, type PasoGrafo } from '../lib/flujo-grafo';
import { porId } from '../lib/api-mako/registro';
import { esAccion } from '../lib/api-mako/tipos';
import { marcasDeVoseo } from '../lib/puestas-data';
import { catalogosDe, etapasDeCondicion } from '../lib/condiciones-catalogos';

const acciones = LISTA_BLANCA_IA.map((id) => {
  const d = porId(id);
  if (!d) throw new Error(`la lista blanca nombra «${id}», que no está en el registro`);
  return { id: d.id, titulo: d.titulo, parametros: d.parametros };
});

const URL_AGENDA = 'https://cal.com/negocio/llamada';
const PRODUCTOS = [
  { funnelId: 3, productoId: null, nombre: 'Mentoría', esDefault: true, etapas: [{ value: 'nuevo', label: 'Nuevo' }, { value: 'agendado', label: 'Agendado' }], etapasEntrega: [] },
  { funnelId: 5, productoId: 11, nombre: 'Curso', etapas: [{ value: 'interesado', label: 'Interesado' }], etapasEntrega: [] },
];
const ctxBase = (o: Partial<CtxIA> = {}): CtxIA => ({
  etiquetas: [{ id: 7, nombre: 'Cualificado' }, { id: 9, nombre: 'Viejo', archivada: true }],
  productos: PRODUCTOS,
  disparadores: [{ value: 'trigger:instant_form_sin_agenda', label: 'Formulario sin agenda' }],
  audios: [{ id: 21, titulo: 'Bienvenida', transcript: 'Hola, soy yo' }],
  archivos: [],
  acciones,
  links: { agenda: { url: URL_AGENDA, para: 'agendar una llamada' } },
  // Duodécima tanda: el MISMO catálogo con que el editor arma el desplegable de condiciones (`armarContexto`).
  catalogoCondicion: catalogosDe({ etapas: etapasDeCondicion(PRODUCTOS), productos: PRODUCTOS, remotos: null }),
  ...o,
});
/**
 * Un CRON de adquisición (el que trae `ctxBase`). DUODÉCIMA TANDA: sin CRON valen sólo las condiciones que el desplegable
 * ofrece con LOS DOS ámbitos (`idsDeCondiciones('sin_cron')`), así que «Agendó» y «Próxima reunión en» se van: los tests
 * de condiciones de adquisición eligen éste.
 */
const CRON_VENTA = 'trigger:instant_form_sin_agenda';

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
    { id: 'r1', tipo: 'si_responde', objetivo: 'Que agende una llamada', casos: [{ titulo: 'Quiere agendar', cuando: 'Pide un horario', sigue: 'r2' }], otra_cosa: null },
    { id: 'r2', tipo: 'mensaje', canal: 'whatsapp', ia: true, texto: 'Ofrécele dos horarios de esta semana.' },
  ],
};

const porClase = (pasos: readonly PasoGrafo[], c: string) => pasos.filter((p) => claseDe(p) === c) as PasoIA[];
const mensajes = (pasos: readonly PasoGrafo[]) => porClase(pasos, 'mensaje');
// (El puente de la ola 1 de la undécima —tolerar «falta el objetivo» del AI Step que armó la IA— se fue con la ola 2:
// la tarjeta `si_responde` trae su "objetivo" y `deIA` se lo pone al AI Step. Lo fija el test «el objetivo de
// "si_responde"» de abajo.)
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
  // UNDÉCIMA TANDA: «MaKo en WhatsApp» nace con su LISTA (sale tal cual, como la que arma el lienzo).
  assert.deepEqual(avisar.accion, { operacion: 'avisar_al_equipo', params: { leadId: 'evento', mensaje: 'Agendó después de la bienvenida', partes: [{ tipo: 'texto', cuerpo: 'Agendó después de la bienvenida' }] } });
  // La etiqueta que no existe se CREA por nombre (un ref negativo), nunca un id inventado.
  assert.deepEqual(r.etiquetasNuevas, [{ ref: -1, nombre: 'Seguimiento' }]);
  assert.deepEqual(etiqueta.accion, { operacion: 'poner_etiqueta_lead', params: { leadId: 'evento', etiquetaId: -1 } });
});

// UNDÉCIMA TANDA (w2-aistep-editor): «Crear con IA» arma UN AI Step con su OBJETIVO (docs/diseno-undecima-tanda.md §6).
// La tarjeta `si_responde` del contrato trae "objetivo"; `deIA` lo limpia (`objetivoDeIA`: sin links ni variables, en un
// renglón, hasta 300) y se lo pone al AI Step al plegarlo (`respuestaAPasoIA(…, { objetivo })`). Sin él, Publicar no
// deja pasar el AI Step, y `validarIA` lo dice con la palabra del modelo para el reintento («corrige esto»): el error de
// `validarGrafo` nombra un id interno que el modelo no conoce.
// ROTURAS (11/10/2026, arnés wf-undecima/w2-aistep-editor/roturas.cjs sobre los seis archivos del paquete, 100 tests,
// base 100 / 0): `deIA` no le pasa el objetivo al conversor → 6 / 100 (5 acá —éste, el ejemplo del prompt, «Si responde»
// no tiene padre, los links y validarIA— y 1 en flujo-ia-arreglos); el conversor ignora `op.objetivo` → 6 / 100 (los
// mismos); el objetivo sin `limpiarTexto` → 1 / 100; `validarIA` no lo pide → 1 / 100. Todas cazadas.
test('el objetivo de "si_responde": el AI Step lo lleva, limpio y hasta 300; sin él, validarIA lo pide con su palabra', () => {
  const ctx = ctxBase();
  const r = deIA(EJEMPLO, ctx, rndDe());
  const ia = porClase(r.pasos, 'respuesta')[0];
  assert.equal(ia.paso_ia, true);
  assert.equal(ia.objetivo, 'Que agende una llamada');
  // Limpio: sin links (con su aviso), en un renglón, con tope.
  const conR1 = (cambio: Record<string, unknown>) => ({ ...EJEMPLO, tarjetas: EJEMPLO.tarjetas.map((t) => (t.id === 'r1' ? { ...t, ...cambio } : t)) });
  const sucio = deIA(conR1({ objetivo: `Que agende\n  en https://cal.com/x {{precio}} ${'y'.repeat(400)}` }), ctx, rndDe());
  const o = porClase(sucio.pasos, 'respuesta')[0].objetivo ?? '';
  assert.ok(o.startsWith('Que agende en') && o.length <= TOPE_OBJETIVO && !/https?:|\n|\{/.test(o), o);
  assert.ok(sucio.avisos.some((a) => a.includes('Borré un link')), sucio.avisos.join(' | '));
  // Sin objetivo: el AI Step queda sin él; Publicar lo frena y validarIA lo dice (para el reintento).
  const sin = deIA(conR1({ objetivo: undefined }), ctx, rndDe());
  assert.equal(porClase(sin.pasos, 'respuesta')[0].objetivo, undefined);
  assert.deepEqual(validarIA(sin.pasos, ctx), ['la tarjeta «si_responde» no tiene "objetivo"']);
  assert.ok(validarGrafo(sin.pasos).some((e) => e.startsWith('falta el objetivo de la tarjeta')));
  // El prompt lo pide y su ejemplo lo trae (las dos capas leen el mismo contrato).
  assert.match(CREAR_IA_SYSTEM_TEMPLATE, /"objetivo": qué tiene que lograr la charla, en una frase\./);
  assert.match(CREAR_IA_SYSTEM_TEMPLATE, /\{"id": "r1", "tipo": "si_responde", "objetivo": "Que agende una llamada",/);
  // Editar: el modelo LEE el objetivo del AI Step que ya está.
  assert.equal(aIA(r.pasos).tarjetas.find((t) => t.tipo === 'si_responde')!.objetivo, 'Que agende una llamada');
  // Con varias «Si responde» (se juntan en la primera), el primer objetivo que no está vacío.
  assert.equal(objetivoDeIA([undefined, '', '  Que   vuelva  ', 'Otro'], []), 'Que vuelva');
});

// rotura 3 (un `sigue` puede apuntar a «Si responde»): 1 fallo. rotura 4 (el «MaKo contesta»
// de «Si responde» sin `revisar`): 1 fallo.
test('«Si responde» no tiene padre: cuelga del CRON, y una flecha que la apunta se corta', () => {
  const ctx = ctxBase();
  const r = deIA(EJEMPLO, ctx, rndDe());
  const resp = porClase(r.pasos, 'respuesta')[0];
  assert.equal(padreDe(r.pasos, resp.id!), null);
  assert.equal(raizRespuesta(r.pasos), resp.id);
  // «Crear con IA» pliega «Si responde» a UN AI Step (undécima: los casos adentro), y el «MaKo contesta» queda ADENTRO
  // del caso (sin tarjeta hija). Nace a revisar: sin `sola`.
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
// «El lead {{nombre}} ya agendó» en el aviso al equipo.
// ⚠️ UNDÉCIMA TANDA: el MENSAJE de «MaKo en WhatsApp» SÍ completa sus datos (`textoDelAviso` resuelve el catálogo para el
// equipo), así que ahí quedan los del equipo y se va lo que no existe; el resto de los datos de una acción, como siempre.
test('los datos de una acción no llevan variables, salvo el mensaje del aviso al equipo, que lleva los SUYOS', () => {
  const ctx = ctxBase();
  const r = deIA({ inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'accion', operacion: 'avisar_al_equipo', datos: { titulo: 'Agendó {{nombre}}', mensaje: 'El lead {{nombre_completo}} ya agendó [la llamada]. {{cupon}}\n👉 {{link_lead}}' } },
  ] }, ctx, rndDe());
  ok(r.pasos, ctx);
  const params = (porClase(r.pasos, 'accion')[0].accion as { params: Record<string, unknown> }).params;
  assert.equal(params.titulo, 'Agendó', 'el título no completa datos');
  assert.equal(params.mensaje, 'El lead {{nombre_completo}} ya agendó.\n👉 {{link_lead}}');
  assert.ok(esTarjetaTalCual(params), 'el aviso nace sin su lista (saldría envuelto, como uno de antes)');
  assert.ok(r.avisos.some((a) => a.includes('variable de una acción')));
  assert.ok(r.avisos.some((a) => a.includes('variable que no existe')));
  // Y un mensaje al LEAD no lleva los del equipo.
  const al = deIA({ inicio: 't1', tarjetas: [{ id: 't1', tipo: 'mensaje', texto: 'Hola {{nombre}}, tu ficha: {{link_lead}}' }] }, ctx, rndDe());
  assert.equal(mensajes(al.pasos)[0].cuerpo, 'Hola {{nombre}}, tu ficha:');
});

// ── UNDÉCIMA TANDA (w3-plantillas): las piezas de hoy en «Crear con IA» ─────────────────────────────────────────────
// ROTURAS (11/10/2026, arnés wf-undecima/w3-plantillas/roturas.cjs, una por vez y restaurada de memoria con sha1 igual;
// base de este archivo 28 / 0, restaurado 28 / 0): al lado de cada test.

// R15: `filaDe` vuelve a aceptar sólo las nueve de antes → 26 / 2 (éste y el del ejemplo de la plantilla).
test('las condiciones del CATÁLOGO: «Próxima reunión en», «Tiene reunión agendada», «Asistió a la reunión»; las retiradas y las de lista no', () => {
  const ctx = ctxBase();
  const r = deIA({ disparador: CRON_VENTA, inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'condicion', ramas: [
      { si: [{ campo: 'reunion_en', op: '<=', valor: 720 }, { campo: 'tiene_telefono' }], sigue: 't2' },
      { si: [{ campo: 'reunion agendada' }], sigue: 't3' },
      { si: [{ campo: 'asistio_reunion', no: true }, { campo: 'r1_pendiente' }, { campo: 'estado_lead', valor: 'frio' }], sigue: 't3' },
    ] },
    { id: 't2', tipo: 'mensaje', texto: 'Hola {{nombre}}, nos vemos {{reunion_cuando}} a las {{reunion_hora}}' },
    { id: 't3', tipo: 'mensaje', texto: 'Hola {{nombre}}' },
  ] }, ctx, rndDe());
  ok(r.pasos, ctx);
  const c = porClase(r.pasos, 'condicion')[0];
  assert.deepEqual(c.ramas!.map((x) => x.filas.map((f) => ({ ...f, union: undefined }))), [
    [{ campo: 'reunion_en', op: 'menor_igual', valor: 720, union: undefined }, { campo: 'tiene_telefono', union: undefined }],
    [{ campo: 'reunion_agendada', union: undefined }],
    [{ campo: 'asistio_reunion', no: true, union: undefined }],
  ]);
  // Los datos de la reunión, detrás de «Próxima reunión», quedan.
  assert.match(mensajes(r.pasos)[0].cuerpo, /\{\{reunion_cuando\}\} a las \{\{reunion_hora\}\}/);
  // Duodécima tanda: una de lista se elige por su NOMBRE EXACTO entre sus opciones («frio» no es un estado del lead), y
  // una retirada no está en el desplegable: las dos se van con su aviso.
  assert.ok(r.avisos.includes('Saqué «Estado del lead»: «frio» no es una opción'), r.avisos.join(' | '));
  assert.ok(r.avisos.includes('Saqué «R1 agendada a futuro»: no está en tus condiciones'), r.avisos.join(' | '));
});

// R14: `validarIA` sin `datosDeReunionSinMirarla` → 27 / 1 (éste).
test('un dato de la reunión sin mirar la reunión antes no pasa la revisión (el modelo lo corrige)', () => {
  const ctx = ctxBase();
  const r = deIA({ inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'esperar', horas: 2, sigue: 't2' },
    { id: 't2', tipo: 'mensaje', texto: 'Hola {{nombre}}, nos vemos {{reunion_cuando}}' },
  ] }, ctx, rndDe());
  assert.ok(validarIA(r.pasos, ctx).some((e) => e.includes('dato de la reunión')), validarIA(r.pasos, ctx).join(' | '));
  const bien = deIA({ inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'esperar', horas: 2, antes_de_reunion: true, sigue: 't2' },
    { id: 't2', tipo: 'mensaje', texto: 'Hola {{nombre}}, empezamos {{reunion_faltan}}' },
  ] }, ctx, rndDe());
  ok(bien.pasos, ctx);
});

test('lo que armó FUERA de lo de hoy (dos CONDITION pegadas) se dice en los avisos', () => {
  const ctx = ctxBase();
  const r = deIA({ disparador: CRON_VENTA, inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'condicion', ramas: [{ si: [{ campo: 'agendo', no: true }], sigue: 't2' }] },
    { id: 't2', tipo: 'condicion', ramas: [{ si: [{ campo: 'tiene_telefono' }], sigue: 't3' }] },
    { id: 't3', tipo: 'mensaje', texto: 'Hola {{nombre}}' },
  ] }, ctx, rndDe());
  assert.ok(r.avisos.some((a) => a.includes('Dos CONDITION seguidas')), r.avisos.join(' | '));
});

/**
 * LA PLANTILLA DE LA CATEGORÍA DEL PEDIDO, con frases como las escribe (o las dicta) Martín. A MANO. `null` = el ejemplo de
 * siempre: un Evento de MaKo, Instagram o el email entrante no los arma «Crear con IA» (su CRON no se elige acá).
 */
const PEDIDOS: ReadonlyArray<readonly [string, string | null]> = [
  ['Mako, créame una automatización que le escriba a los que no vinieron a la reunión', 'lead-no-asistio'],
  ['creame una automatizacion para los leads nuevos que les mande un audio de bienvenida', 'lead-entro'],
  ['hola mako necesito que me armes una automatizacion que cuando alguien deja sus datos en la landing le escriba por whatsapp y si no contesta en dos dias le mande un email', 'lead-entro'],
  ['Quiero una automatización que me avise en el grupo cuando alguien agenda', 'lead-agendo'],
  ['Armame los recordatorios de la reunión: un día antes, una hora antes y 15 minutos antes', 'lead-agendo'],
  ['Créame una automatización para los que tuvieron la llamada y no compraron', 'lead-tuvo-reunion'],
  ['una automatizacion para los que confirmaron la compra y no pagaron', 'lead-confirmo-compra'],
  ['Crea una automatización de bienvenida para los clientes que compraron el programa y pídeles un testimonio', 'cliente-empezo'],
  ['Armame la bienvenida al newsletter para los que se suscriben', 'email-newsletter'],
  ['¿Me puedes crear una automatización para cobrar las cuotas vencidas?', null],
  // Duodécima tanda: Instagram y Messenger van primero (un DM arranca con un CRON de su canal), con las palabras de
  // `canalDelPedido`; «historia» sola no es Instagram.
  ['Armame un flujo que salude por DM a quien comenta en Instagram', 'instagram-te-escribieron'],
  ['Quiero que cuando alguien comente mi reel le llegue el link por DM', 'instagram-te-escribieron'],
  ['Saluda a quien me escribe por Messenger', 'messenger-te-escribieron'],
  ['Cuéntale la historia de mi negocio a los leads nuevos', 'lead-entro'],
];

// R16: `PALABRAS_PLANTILLA` con «agend» primero → 27 / 1 (éste: los que no vinieron a la reunión iban a «agendó»).
test('plantillaParaPedido: la categoría del pedido, como lo escribe Martín; sin coincidencia, el ejemplo de siempre', () => {
  for (const [pedido, id] of PEDIDOS) assert.equal(plantillaParaPedido(pedido)?.id ?? null, id, pedido);
  // Cada id de la tabla de palabras es una plantilla que existe, con CRON de etapa o etiqueta (las que la IA puede armar).
  for (const [id] of PALABRAS_PLANTILLA) {
    const p = plantillaPorId(id);
    // Duodécima tanda: también las de Instagram y Messenger (su CRON fijo es un evento que `opcionesCronIA` ofrece).
    assert.ok(p && (p.cron.pide || p.cron.fijo === 'instagram' || p.cron.fijo === 'messenger'), `«${id}» no es una plantilla que «Crear con IA» pueda armar`);
  }
});

test('el ejemplo de la plantilla va en el pedido (con el MISMO aIA de editar, sin el AI Step) y se traduce con las dos capas', () => {
  const ctx = ctxBase();
  const user = userDeCrear(ctx, { perfil: 'Mentorías', voz: null, pedido: 'Quiero que me avise cuando alguien agenda y le recuerde la reunión' });
  const p = plantillaPorId('lead-agendo')!;
  assert.ok(user.includes(`«${p.nombre}»`), 'el pedido no lleva la plantilla de su categoría');
  const ej = ejemploDePlantilla(p);
  assert.ok(user.includes(JSON.stringify(ej)));
  assert.deepEqual(ej.inicio, ['la_r', 'la_p', 'la_m']);
  assert.ok(!ej.tarjetas.some((t) => t.tipo === 'si_responde'), 'el ejemplo lleva el AI Step (su forma la enseña el system)');
  // Lo que enseña se traduce y pasa las dos capas (el modelo lo copia con sus textos).
  const r = deIA({ ...ej, disparador: CRON_VENTA }, ctx, rndDe());
  ok(r.pasos, ctx);
  assert.equal(porClase(r.pasos, 'accion').filter((x) => esTarjetaTalCual((x.accion as { params: Record<string, unknown> }).params)).length, 3, 'los tres avisos al equipo');
  // Sin categoría, el de siempre (el del system): el pedido no lleva ninguna.
  assert.doesNotMatch(userDeCrear(ctx, { perfil: '', voz: null, pedido: 'algo raro' }), /LA DE ESA CATEGORÍA/);
});

// R13: `userDeCrear` sin `entraEnGroq` (la plantilla siempre) → 27 / 1 (éste), y tests/crear-ia-tercera 13 / 1 (el negocio
// grande deja a Groq afuera de la cascada).
test('la plantilla va sólo si Groq sigue entrando con la salida del tope; la cuenta es la de lib/ai-cheap.ts', () => {
  // Los dos números copiados (ai-cheap es server-only): si cambian allá, esto cae.
  const AI_CHEAP = readFileSync(new URL('../lib/ai-cheap.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(Number(/const TECHO_ENTRADA[^=]*= \{\n\s*groq: ([\d_]+),/.exec(AI_CHEAP)?.[1].replace(/_/g, '')), TECHO_GROQ_IA);
  assert.equal(Number(/export const tokensAprox = \(texto: string\): number => Math\.ceil\(texto\.length \/ ([\d.]+)\);/.exec(AI_CHEAP)?.[1]), CARACTERES_POR_TOKEN_IA);
  // El tope de tarjetas pide más salida que el mínimo, y la plantilla más grande entra en el tope.
  assert.ok(SALIDA_DEL_TOPE_IA >= SALIDA_MIN_IA);
  assert.ok(Math.max(...PLANTILLAS.map((x) => pasosDePlantilla(x).length)) <= TOPE_TARJETAS_IA, 'una plantilla tiene más tarjetas que las que se le piden al modelo');
  // Un pedido que ya no deja lugar: va el de siempre, sin la plantilla.
  const ctx = ctxBase();
  const largo = { perfil: 'x'.repeat(1800), voz: 'y'.repeat(1200), pedido: 'Quiero los recordatorios de la reunión' };
  const conCtxGrande = ctxBase({ audios: Array.from({ length: 40 }, (_, i) => ({ id: i + 1, titulo: `Audio ${i}`, transcript: 'z'.repeat(200) })) });
  assert.doesNotMatch(userDeCrear(conCtxGrande, largo), /LA DE ESA CATEGORÍA/);
  assert.ok(!entraEnGroq(CREAR_IA_SYSTEM_TEMPLATE, userDeCrear(conCtxGrande, largo) + JSON.stringify(ejemploDePlantilla(plantillaPorId('lead-agendo')!))));
  assert.match(userDeCrear(ctx, { perfil: 'Mentorías', voz: null, pedido: largo.pedido }), /LA DE ESA CATEGORÍA/);
  // Cada ejemplo de la galería, solo, entra con un negocio chico.
  for (const x of PLANTILLAS) assert.ok(entraEnGroq(CREAR_IA_SYSTEM_TEMPLATE, JSON.stringify(ejemploDePlantilla(x))), x.id);
  for (const x of PLANTILLAS) assert.ok(!ejemploDePlantilla(x).tarjetas.some((t) => t.tipo === 'si_responde'), `${x.id}: el ejemplo lleva el AI Step`);
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
  const r = deIA({ disparador: CRON_VENTA, inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'condicion', ramas: [{ si: [{ campo: 'etapa', etapa: 'Inexistente' }], sigue: 't2' }], si_no: 't3' },
    { id: 't2', tipo: 'mensaje', texto: 'Nunca' },
    { id: 't3', tipo: 'mensaje', texto: 'Siempre' },
  ] }, ctx, rndDe());
  ok(r.pasos, ctx);
  assert.equal(porClase(r.pasos, 'condicion').length, 0);
  assert.deepEqual(mensajes(r.pasos).map((m) => m.cuerpo), ['Siempre']);
  assert.ok(r.avisos.some((a) => a.includes('Inexistente')));

  // Por rótulo y por producto: la clave y el embudo (null = la casa del lead, el principal).
  const r2 = deIA({ disparador: CRON_VENTA, inicio: 't1', tarjetas: [
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
  const dosPadres = deIA({ disparador: CRON_VENTA, inicio: 't1', tarjetas: [
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
// Duodécima tanda: el disparador se resuelve PRIMERO (de él sale el ámbito de las condiciones), así que la etiqueta del
// CRON es la -1 y la de las tarjetas la -2. Lo que se fija es lo mismo: las dos se crean y ninguna queda sin su id real.
test('las etiquetas nuevas se cambian por el id real recién al guardar', () => {
  const ctx = ctxBase();
  const r = deIA({ inicio: 't1', disparador: 'etiqueta:Lista', tarjetas: [
    { id: 't1', tipo: 'condicion', ramas: [{ si: [{ campo: 'etiqueta', etiqueta: 'Seguimiento' }], sigue: 't2' }] },
    { id: 't2', tipo: 'etiqueta', poner: 'Seguimiento' },
  ] }, ctx, rndDe());
  assert.deepEqual(r.etiquetasNuevas.map((n) => n.nombre), ['Lista', 'Seguimiento']);
  assert.equal(r.disparador, 'etiqueta:-1');
  assert.deepEqual(refsSinResolver(r.pasos), [-2]);
  const ids = new Map([[-2, 40], [-1, 41]]);
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
