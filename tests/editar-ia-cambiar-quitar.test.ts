// =============================================================================
// EDITAR CON MAKO: cambiar, quitar y volver a poner (duodécima tanda, ola 2, docs/diseno-duodecima-tanda.md §2.6 y §3.5)
// =============================================================================
// El pedido (la prueba con Fiesta Music, ws10, 12/10/2026): «le pedí que cambie WhatsApp por Instagram» y el lienzo dijo
// «Esa tarjeta no puede abrir otro camino a la vez». Medido en prod (#245, el borrador): editar sólo AGREGABA, así que
// colgó una COPIA del mensaje en paralelo después de la espera (nvnnfzp, copia de nw7j95n), y la copia salió por
// WhatsApp porque `nodoDe` pasaba todo a WhatsApp.
//
// Lo que fija este archivo es lib/flujo-ia.ts → `deIAEdicion`, `erroresEdicion`, `resumenEdicion` y el prompt de editar:
//   · cambiar conserva el id (donde puede haber leads parados);
//   · «cambia WhatsApp por Instagram» cambia el canal EN EL MISMO id, saca el AI Step con su aviso y no deja copias;
//   · con un CRON que no es de Instagram, la PREGUNTA «¿Cambio qué la dispara?» con las opciones del catálogo y «Déjalo así»;
//   · quitar una condición se lleva lo que cuelga, con el aviso de cuántas;
//   · el formato viejo (sólo "agregar") sigue igual;
//   · «no cambió nada» es un error para el reintento;
//   · el resumen («Cambié 1 · saqué 3 · agregué 2») lo arma el código;
//   · el system de editar más un user grande entran en Groq.
//
// ⚠️ PROBADO ROMPIENDO (12/10/2026, scratchpad wf-duodecima/ia-editar/romper.mjs: copia lib/, app/ y este test a un ESPEJO,
// rompe lib/flujo-ia.ts allí y corre este archivo; el worktree nunca ve un archivo roto; restaura de memoria, sha1 igual).
// Base 12 pass / 0 fail; las 18 roturas (A a R) cayeron. El resultado de cada una, al lado de su test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deIAEdicion, erroresEdicion, resumenEdicion, cambioDeCanal, hablaDelCron, userDeEditar, entraEnGroq, disparadoresParaIA,
  aIA, EDITAR_IA_SYSTEM_TEMPLATE, LISTA_BLANCA_IA, CARACTERES_POR_TOKEN_IA, SALIDA_DEL_TOPE_IA, TECHO_GROQ_IA,
  type CtxIA, type PasoIA,
} from '../lib/flujo-ia';
import { claseDe, ID_INICIO, type PasoGrafo } from '../lib/flujo-grafo';
import { opcionesCronIA } from '../lib/disparadores';
import { catalogosDe, etapasDeCondicion } from '../lib/condiciones-catalogos';
import { porId } from '../lib/api-mako/registro';
import { LEAD_DEL_EVENTO } from '../lib/api-mako/flujo-params';
import { marcasDeVoseo } from '../lib/puestas-data';

const acciones = LISTA_BLANCA_IA.map((id) => {
  const d = porId(id);
  if (!d) throw new Error(`la lista blanca nombra «${id}», que no está en el registro`);
  return { id: d.id, titulo: d.titulo, parametros: d.parametros };
});
/** Un generador determinista para `nuevoId`. */
const rndDe = () => { let k = 0; return () => ((k++ * 0.137) % 1); };

const PRODUCTOS = [
  { funnelId: 3, productoId: 10, nombre: 'Service Delivery & Ops', esDefault: true, etapas: [{ value: 'nuevo', label: 'Nuevo' }, { value: 'agendado', label: 'Agendado' }], etapasEntrega: [{ value: 'onboarding', label: 'Onboarding' }, { value: 'activo', label: 'Activo' }] },
];
const ETIQUETAS = [{ id: 7, nombre: 'Cualificado', archivada_at: null }];
const CRON_ENTREGA = 'entrega:10:onboarding';

/** El contexto de ws10: el CRON que arma `opcionesCronIA` (la MISMA del desplegable), con o sin Instagram conectado. */
const ctxDe = (o: Partial<CtxIA> & { instagram?: boolean } = {}): CtxIA => {
  const { instagram = true, ...resto } = o;
  return {
    etiquetas: ETIQUETAS.map((e) => ({ id: e.id, nombre: e.nombre })),
    productos: PRODUCTOS,
    disparadores: disparadoresParaIA(opcionesCronIA({ productos: PRODUCTOS, etiquetas: ETIQUETAS, conectados: { instagram, messenger: false, email: false, pagos: false } })),
    audios: [], archivos: [], acciones, links: {},
    catalogoCondicion: catalogosDe({ etapas: etapasDeCondicion(PRODUCTOS), productos: PRODUCTOS, remotos: null }),
    disparadorActual: CRON_ENTREGA,
    ...resto,
  };
};

const TEXTO_245 = 'Hola {{nombre}}, ¿cómo vas con el ingreso a la plataforma? Cualquier duda me escribes por aquí.';

/** #245 de ws10, como quedó antes de la copia: espera → mensaje WA → aviso al equipo, y el AI Step. */
const base245 = (): PasoGrafo[] => [
  { id: 'na4n6pr', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 1440 }, siguiente: 'nw7j95n' },
  { id: 'nw7j95n', canal: 'whatsapp', proveedor: 'no_oficial', delay_horas: 0, asunto: null, cuerpo: TEXTO_245, siguiente: 'niu0inc' },
  { id: 'niu0inc', canal: 'whatsapp', accion: { operacion: 'avisar_al_equipo', params: { leadId: LEAD_DEL_EVENTO, mensaje: 'Entró un cliente nuevo' } }, siguiente: null },
  { id: 'nq09965', nodo: 'respuesta', paso_ia: true, objetivo: 'Que entre a la plataforma', casos: [{ id: 'c1', titulo: 'Duda', cuando: 'Pregunta cómo entrar', siguiente: null }], si_no: null },
  { id: ID_INICIO, nodo: 'inicio', siguiente: 'na4n6pr' },
];

const porId2 = (pasos: readonly PasoGrafo[], id: string) => pasos.find((p) => p.id === id) as PasoIA | undefined;
const mensajes = (pasos: readonly PasoGrafo[]) => pasos.filter((p) => claseDe(p) === 'mensaje') as PasoIA[];

// rotura A (cambiar crea una tarjeta nueva en vez de conservar el id): 7 pass / 5 fail, cae éste (y los de #245, la
// pregunta, el resumen y la condición).
test('cambiar el texto conserva el id, el lugar y lo que no se nombró', () => {
  const ctx = ctxDe({ pedido: 'Cambia el texto del mensaje por uno más corto' });
  const r = deIAEdicion({ cambiar: [{ id: 'nw7j95n', texto: 'Hola {{nombre}}, ¿pudiste entrar a la plataforma?' }] }, base245(), ctx, rndDe());
  const m = porId2(r.pasos, 'nw7j95n')!;
  assert.equal(m.cuerpo, 'Hola {{nombre}}, ¿pudiste entrar a la plataforma?');
  assert.equal(m.canal, 'whatsapp');
  assert.equal(m.siguiente, 'niu0inc', 'el mensaje sigue donde seguía');
  assert.equal(porId2(r.pasos, 'na4n6pr')!.siguiente, 'nw7j95n', 'la espera sigue apuntándolo');
  assert.deepEqual(r.cambiadas, ['nw7j95n']);
  assert.deepEqual(r.agregadas, []);
  assert.deepEqual(r.quitadas, []);
  assert.equal(r.pasos.length, base245().length);
  assert.deepEqual(erroresEdicion(base245(), r, ctx), []);
  assert.equal(r.resumen, 'Cambié 1');
});

// rotura B (sin el cambio de canal por código: `if (cambio && false)`): 11 / 1, cae éste (la copia sola deja el WhatsApp y
// el AI Step). rotura C (sin descartar las copias en `agregarTramos`): 11 / 1, cae éste (2 DM en paralelo). rotura D (el
// cambio de canal no saca el AI Step): 11 / 1, cae éste.
test('«cambia WhatsApp por Instagram» (#245): el canal cambia en el MISMO id, el AI Step sale y no queda una copia', () => {
  const pedido = 'Cambia WhatsApp por Instagram';
  assert.equal(cambioDeCanal(pedido), 'instagram');
  const ctx = ctxDe({ pedido });
  // Las dos salidas del modelo: la buena (cambiar), y la del bug medido (la copia en paralelo después de la espera).
  const buena = { cambiar: [{ id: 'nw7j95n', canal: 'instagram' }], quitar: ['nq09965'] };
  const copia = { agregar: [{ despues_de: 'na4n6pr', salida: 'paralelo', inicio: 't1', tarjetas: [{ id: 't1', tipo: 'mensaje', canal: 'instagram', texto: TEXTO_245 }] }] };
  for (const [nombre, json] of [['buena', buena], ['copia', copia]] as const) {
    const r = deIAEdicion(json, base245(), ctx, rndDe());
    const ms = mensajes(r.pasos);
    assert.equal(ms.length, 1, `${nombre}: quedaron ${ms.length} mensajes (una copia)`);
    assert.equal(ms[0].id, 'nw7j95n', `${nombre}: el mensaje cambió de id`);
    assert.equal(ms[0].canal, 'instagram', `${nombre}: sigue por ${ms[0].canal}`);
    assert.equal(ms[0].cuerpo, TEXTO_245);
    assert.ok(!porId2(r.pasos, 'na4n6pr')!.paralelos?.length, `${nombre}: la espera abre un camino en paralelo`);
    assert.equal(porId2(r.pasos, 'nq09965'), undefined, `${nombre}: el AI Step sigue`);
    assert.ok(r.avisos.includes('Saqué el AI Step: por Instagram todavía no contesta'), `${nombre}: ${r.avisos.join(' | ')}`);
    // El aviso al equipo es una acción: no se toca.
    assert.equal(porId2(r.pasos, 'niu0inc')!.canal, 'whatsapp');
    assert.ok(r.cambiadas.includes('nw7j95n') && !r.cambiadas.includes('niu0inc'), `${nombre}: ${r.cambiadas.join(',')}`);
    assert.deepEqual(r.quitadas, ['nq09965']);
    assert.deepEqual(r.agregadas, []);
    assert.deepEqual(erroresEdicion(base245(), r, ctx), [], `${nombre}: la revisión lo rechaza`);
  }
});

// rotura E (sin la pregunta: `hayDM` siempre false): 11 / 1, cae éste. rotura F (la pregunta sin «Déjalo así»): 11 / 1,
// cae éste. rotura G (en editar, «un DM sólo con un CRON de su canal» vuelve a ser un error de `validarIA`): 10 / 2, cae
// éste y el de #245.
test('con un CRON de etapa, trae la pregunta «¿Cambio qué la dispara?» con el catálogo y «Déjalo así»', () => {
  const ctx = ctxDe({ pedido: 'Cambia WhatsApp por Instagram' });
  const r = deIAEdicion({ cambiar: [{ id: 'nw7j95n', canal: 'instagram' }] }, base245(), ctx, rndDe());
  assert.ok(r.pregunta, 'no preguntó');
  assert.equal(r.pregunta.sobre, 'cron');
  assert.equal(r.pregunta.texto, '¿Cambio qué la dispara?');
  assert.equal(r.pregunta.otra, true);
  const valores = r.pregunta.opciones.map((x) => x.valor);
  assert.deepEqual(valores, ['instagram:comentario', 'instagram:historia', 'instagram:dm', 'igual'], 'hasta 3 del catálogo de Instagram, y «Déjalo así»');
  assert.equal(r.pregunta.opciones.at(-1)!.label, 'Déjalo así');
  // Los rótulos salen del catálogo (sin «El usuario»), nunca del modelo.
  assert.equal(r.pregunta.opciones[2].label, 'Envía un mensaje');
  for (const v of valores.slice(0, -1)) assert.ok(ctx.disparadores.some((d) => d.value === v), v);
  assert.equal(r.disparador, undefined, 'el CRON no se toca hasta que la persona elija');
  assert.deepEqual(erroresEdicion(base245(), r, ctx), [], 'en editar el CRON es una pregunta, no un error');

  // Con el CRON ya de Instagram, no pregunta.
  const conIG = deIAEdicion({ cambiar: [{ id: 'nw7j95n', canal: 'instagram' }] }, base245(), ctxDe({ pedido: 'Cambia WhatsApp por Instagram', disparadorActual: 'instagram:dm' }), rndDe());
  assert.equal(conIG.pregunta, undefined);
  // Sin Instagram conectado (el desplegable no lo ofrece), el aviso y nada más.
  const sinIG = deIAEdicion({ cambiar: [{ id: 'nw7j95n', canal: 'instagram' }] }, base245(), ctxDe({ pedido: 'Cambia WhatsApp por Instagram', instagram: false }), rndDe());
  assert.equal(sinIG.pregunta, undefined);
  assert.ok(sinIG.avisos.includes('Conecta Instagram en el CRON'), sinIG.avisos.join(' | '));
});

/** Un flujo con una condición: mensaje → condición (Agendó → mensaje A; si no → espera → mensaje B). */
const baseCondicion = (): PasoGrafo[] => [
  { id: 'm0', canal: 'whatsapp', cuerpo: 'Hola {{nombre}}', siguiente: 'k1' },
  { id: 'k1', nodo: 'condicion', ramas: [{ id: 'k1r0', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'ma' }], si_no: 'e1' },
  { id: 'ma', canal: 'whatsapp', cuerpo: 'Nos vemos en la llamada', siguiente: null },
  { id: 'e1', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 1440 }, siguiente: 'mb' },
  { id: 'mb', canal: 'whatsapp', cuerpo: '¿Te ayudo a agendar?', siguiente: null },
];

// rotura H (`quitarTarjeta` sin el aviso de cuántas colgaban): 11 / 1, cae éste. rotura I (quitar con `filter` del id en
// vez de `borrarNodo`: las ramas quedan sueltas): 10 / 2, cae éste y el del resumen.
test('quitar una condición se lleva sus ramas, con el aviso de cuántas tarjetas se fueron', () => {
  const ctx = ctxDe({ pedido: 'Saca la condición', disparadorActual: 'venta:3:nuevo' });
  const r = deIAEdicion({ quitar: ['k1'] }, baseCondicion(), ctx, rndDe());
  assert.deepEqual(r.pasos.map((p) => p.id), ['m0']);
  assert.equal(r.pasos[0].siguiente, null, 'el mensaje de antes queda sin nada después');
  assert.deepEqual(r.quitadas.sort(), ['e1', 'k1', 'ma', 'mb']);
  assert.ok(r.avisos.includes('Saqué la condición y las 3 tarjetas que colgaban de ahí'), r.avisos.join(' | '));
  assert.deepEqual(erroresEdicion(baseCondicion(), r, ctx), []);
  // Y lo que el quitar dejó libre sirve para agregar.
  const r2 = deIAEdicion({ quitar: ['k1'], agregar: [{ despues_de: 'm0', salida: 'sig', tarjetas: [{ id: 't1', tipo: 'esperar', horas: 24, sigue: 't2' }, { id: 't2', tipo: 'mensaje', texto: '¿Seguimos?' }] }] }, baseCondicion(), ctx, rndDe());
  assert.equal(r2.agregadas.length, 2);
  assert.equal(r2.pasos[0].siguiente, r2.agregadas[0]);
  assert.equal(r2.resumen, 'Saqué 4 · agregué 2');
});

// rotura J (`deIAEdicion` deja de leer "agregar"): 9 / 3, cae éste (y el de quitar y el del resumen, que agregan).
test('el formato viejo (sólo "agregar") sigue igual: lo de antes no cambia', () => {
  const ctx = ctxDe({ pedido: 'Agrega un recordatorio' });
  const base = baseCondicion();
  const r = deIAEdicion({ agregar: [{ despues_de: 'ma', salida: 'sig', tarjetas: [{ id: 't1', tipo: 'esperar', horas: 24, sigue: 't2' }, { id: 't2', tipo: 'mensaje', texto: 'Te espero en la llamada' }] }] }, base, ctx, rndDe());
  for (const p of base) {
    const q = porId2(r.pasos, p.id!)!;
    // La única flecha que se toca es la salida vacía donde se cuelga el tramo («ma» → la espera nueva).
    assert.deepEqual(p.id === 'ma' ? { ...q, orden: 0, siguiente: null } : { ...q, orden: 0 }, { ...p, orden: 0 }, `cambió ${p.id}`);
  }
  assert.equal(r.agregadas.length, 2);
  assert.deepEqual(r.cambiadas, []);
  assert.deepEqual(r.quitadas, []);
  assert.equal(r.resumen, 'Agregué 2');
  assert.deepEqual(erroresEdicion(base, r, ctx), []);
});

// rotura K (sacar el «no cambió nada» de `erroresEdicion`): 11 / 1, cae éste.
test('«no cambió nada» es un error para el reintento; un cambio de verdad no lo es', () => {
  const ctx = ctxDe({ pedido: 'Mejora el texto' });
  for (const json of [{}, { cambiar: [{ id: 'nw7j95n', texto: TEXTO_245 }] }, { quitar: ['no-existe'] }]) {
    const r = deIAEdicion(json, base245(), ctx, rndDe());
    assert.deepEqual([r.cambiadas, r.quitadas, r.agregadas], [[], [], []], JSON.stringify(json));
    assert.ok(erroresEdicion(base245(), r, ctx).includes('no cambió nada'), JSON.stringify(json));
  }
});

// rotura L (`resumenEdicion` cuenta las quitadas como cambiadas): 10 / 2, cae éste y el de quitar.
test('resumenEdicion cuenta bien, sólo con lo que pasó', () => {
  assert.equal(resumenEdicion({ cambiadas: [], quitadas: [], agregadas: [] }), '');
  assert.equal(resumenEdicion({ cambiadas: ['a', 'b', 'c'], quitadas: ['d'], agregadas: ['e', 'f'] }), 'Cambié 3 · saqué 1 · agregué 2');
  assert.equal(resumenEdicion({ cambiadas: [], quitadas: ['d'], agregadas: [] }), 'Saqué 1');
  // De una edición real: cambia un texto, quita la condición (y sus 3) y agrega dos.
  const ctx = ctxDe({ pedido: 'Cambia el saludo, saca la condición y agrega un seguimiento', disparadorActual: 'venta:3:nuevo' });
  const r = deIAEdicion({
    cambiar: [{ id: 'm0', texto: 'Hola {{nombre}}, gracias por escribir' }],
    quitar: ['k1'],
    agregar: [{ despues_de: 'm0', salida: 'sig', tarjetas: [{ id: 't1', tipo: 'esperar', dias: 1, sigue: 't2' }, { id: 't2', tipo: 'mensaje', texto: '¿Cómo vas?' }] }],
  }, baseCondicion(), ctx, rndDe());
  assert.equal(r.resumen, 'Cambié 1 · saqué 4 · agregué 2');
  assert.deepEqual(erroresEdicion(baseCondicion(), r, ctx), []);
});

/** Un negocio GRANDE, como el de tests/crear-ia-tercera.test.ts (`ctxGrande`): 4 productos, 20 etiquetas, 8 audios. */
function ctxGrande(pedido: string): { ctx: CtxIA; perfil: string; voz: string } {
  const etapas = Array.from({ length: 14 }, (_, i) => ({ value: `etapa_${i}`, label: `Etapa número ${i + 1}` }));
  const productos = [
    { funnelId: 3, productoId: 7, nombre: 'Mentoría de negocio', esDefault: true, etapas, etapasEntrega: etapas.slice(0, 8) },
    { funnelId: 5, productoId: 11, nombre: 'Curso de ventas', etapas, etapasEntrega: etapas.slice(0, 6) },
    { funnelId: 6, productoId: 12, nombre: 'Comunidad de dueños', etapas, etapasEntrega: etapas.slice(0, 8) },
    { funnelId: 8, productoId: 15, nombre: 'Programa de liderazgo', etapas, etapasEntrega: etapas.slice(0, 6) },
  ];
  const etiquetas = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, nombre: `Etiqueta ${i + 1}`, archivada_at: null }));
  const disparadores = disparadoresParaIA(opcionesCronIA({ productos, etiquetas, conectados: { instagram: true, messenger: true, email: true, pagos: true } }));
  const ctx: CtxIA = {
    etiquetas: etiquetas.map((e) => ({ id: e.id, nombre: e.nombre })), productos, disparadores, pedido,
    catalogoCondicion: catalogosDe({ etapas: etapasDeCondicion(productos), productos, remotos: { cursos: [], posts: [], campanas: ['Campaña de otoño'], reuniones: [] } }),
    audios: Array.from({ length: 8 }, (_, k) => ({ id: k + 1, titulo: `Audio ${k + 1}`, transcript: 'Hola, te cuento cómo trabajamos y qué vas a lograr en las primeras semanas del programa. '.repeat(3) })),
    archivos: [], acciones,
    links: { agenda: { url: 'https://cal.com/x', para: 'el link para que agende la llamada' }, video: { url: 'https://v.com/x', para: 'el video que conviene ver antes de hablar' } },
    disparadorActual: 'entrega:7:etapa_0',
  };
  return { ctx, perfil: 'Somos una agencia que ayuda a negocios de servicios a vender más. '.repeat(60), voz: 'Cercano, directo, con ejemplos. '.repeat(80) };
}

/** Un flujo de 12 tarjetas con textos largos: lo que viaja en EL FLUJO ACTUAL. */
const flujoGrande = (): PasoGrafo[] => {
  const out: PasoGrafo[] = [];
  for (let k = 0; k < 6; k++) {
    out.push({ id: `e${k}`, nodo: 'esperar', espera: { modo: 'tiempo', minutos: 1440 }, siguiente: `m${k}` });
    out.push({ id: `m${k}`, canal: 'whatsapp', cuerpo: `Hola {{nombre}}, este es el mensaje ${k + 1}: te cuento cómo seguimos con lo tuyo y qué conviene preparar para la próxima semana.`, siguiente: k < 5 ? `e${k + 1}` : null });
  }
  return out;
};
const tokens = (s: string) => Math.ceil(s.length / CARACTERES_POR_TOKEN_IA);

// Medido con este negocio (scratchpad wf-duodecima/ia-editar/medir.test.ts): system de editar ~1.505 tokens; editar sin el
// CRON ~3.483 (entra: el techo con la salida del tope es 3.700); con el bloque DISPARADORES entero (~862) ~4.293, y Groq
// queda afuera de la cascada.
// rotura M (el bloque DISPARADORES va entero siempre): 11 / 1, cae éste. rotura N (el perfil sin tope): 11 / 1, cae éste.
test('el system de editar y un user grande entran en Groq; el CRON viaja sólo si el pedido habla de él', () => {
  const sinCron = ctxGrande('Cambia el texto del tercer mensaje para que sea más corto');
  const user = userDeEditar(sinCron.ctx, { perfil: sinCron.perfil, voz: sinCron.voz, pedido: sinCron.ctx.pedido! }, flujoGrande());
  assert.doesNotMatch(user, /DISPARADORES/);
  assert.match(user, /EL FLUJO ACTUAL/);
  const prompt = tokens(EDITAR_IA_SYSTEM_TEMPLATE) + tokens(user);
  assert.ok(entraEnGroq(EDITAR_IA_SYSTEM_TEMPLATE, user), `editar pesa ~${prompt} tokens: con ${SALIDA_DEL_TOPE_IA} de salida pasa el techo de ${TECHO_GROQ_IA}`);

  const conCron = ctxGrande('Cambia WhatsApp por Instagram');
  assert.ok(hablaDelCron(conCron.ctx.pedido));
  const user2 = userDeEditar(conCron.ctx, { perfil: conCron.perfil, voz: conCron.voz, pedido: conCron.ctx.pedido! }, flujoGrande());
  // Sólo nombra un canal: van las opciones de ESE canal y la de hoy, con su clave de siempre (no las ~120).
  assert.match(user2, /DISPARADORES/);
  assert.match(user2, /- Instagram: d\d+ /);
  assert.doesNotMatch(user2, /- (Pagos|Messenger|Email|Etiqueta):/);
  assert.match(user2, /CRON ACTUAL: d\d+/);
  // Y un pedido del CRON en sí lleva el bloque entero.
  const entero = ctxGrande('Que arranque cuando llegue a la etapa 3');
  assert.match(userDeEditar(entero.ctx, { perfil: entero.perfil, voz: entero.voz, pedido: entero.ctx.pedido! }, flujoGrande()), /- Pagos:/);
  assert.ok(entraEnGroq(EDITAR_IA_SYSTEM_TEMPLATE, user2), `editar con el CRON pesa ~${tokens(EDITAR_IA_SYSTEM_TEMPLATE) + tokens(user2)} tokens`);
});

// rotura R (el prompt vuelve a «NUNCA cambias ni borras una tarjeta»): 11 / 1, cae éste.
test('el prompt de editar: cambiar, quitar y agregar, con ids reales, sin voseo', () => {
  assert.doesNotMatch(EDITAR_IA_SYSTEM_TEMPLATE, /NUNCA cambias/);
  for (const k of ['"cambiar"', '"quitar"', '"agregar"', '"disparador"']) assert.ok(EDITAR_IA_SYSTEM_TEMPLATE.includes(k), k);
  assert.deepEqual(marcasDeVoseo(EDITAR_IA_SYSTEM_TEMPLATE), []);
  // Los ids que el modelo nombra son los de EL FLUJO ACTUAL (`aIA`), con los de las ramas.
  const c = aIA(baseCondicion(), ctxDe());
  assert.deepEqual(c.tarjetas.map((t) => t.id), ['m0', 'k1', 'ma', 'e1', 'mb']);
  assert.equal((c.tarjetas[1].ramas as Array<{ id: string }>)[0].id, 'k1r0');
});

// rotura O (`cambioDeCanal` sólo con «WhatsApp por X»): 11 / 1, cae éste.
test('cambioDeCanal: pasar el flujo a Instagram no es sumarle un DM', () => {
  for (const t of ['Cambia WhatsApp por Instagram', 'pásalo a Instagram', 'que sea por Instagram en vez de WhatsApp', 'cámbialo todo a Messenger', 'de WhatsApp a Instagram']) {
    assert.ok(cambioDeCanal(t), t);
  }
  for (const t of ['Agrega un DM por Instagram después de la espera', 'pásale el link por Instagram', 'Cambia el texto del segundo mensaje', 'cambia el email por uno más corto']) {
    assert.equal(cambioDeCanal(t), null, t);
  }
});

// rotura P (el parche de una condición pierde el destino de la rama): 11 / 1, cae éste.
test('cambiar una condición: filas nuevas en la MISMA rama, con su id y su destino; el «si no» queda', () => {
  const ctx = ctxDe({ pedido: 'Que la condición mire si tiene la etiqueta Cualificado', disparadorActual: 'venta:3:nuevo' });
  const r = deIAEdicion({ cambiar: [{ id: 'k1', ramas: [{ id: 'k1r0', si: [{ campo: 'etiqueta', etiqueta: 'Cualificado' }] }] }] }, baseCondicion(), ctx, rndDe());
  const k = porId2(r.pasos, 'k1')!;
  assert.deepEqual(k.ramas, [{ id: 'k1r0', modo: 'todas', filas: [{ campo: 'etiqueta', valor: 7 }], siguiente: 'ma' }]);
  assert.equal(k.si_no, 'e1');
  assert.deepEqual(r.cambiadas, ['k1']);
  assert.deepEqual(erroresEdicion(baseCondicion(), r, ctx), []);
});

// rotura Q (cambiar de tipo deja la tarjeta nueva SUELTA: sin reconectar a los padres): 11 / 1, cae éste.
test('cambiar el tipo de una tarjeta la reemplaza en el mismo lugar (quitar y agregar en el mismo puerto)', () => {
  const ctx = ctxDe({ pedido: 'En vez de esperar, ponle la etiqueta Cualificado', disparadorActual: 'venta:3:nuevo' });
  const r = deIAEdicion({ cambiar: [{ id: 'e1', tipo: 'etiqueta', poner: 'Cualificado' }] }, baseCondicion(), ctx, rndDe());
  assert.equal(porId2(r.pasos, 'e1'), undefined);
  assert.equal(r.agregadas.length, 1);
  const nueva = porId2(r.pasos, r.agregadas[0])!;
  assert.equal(nueva.accion?.operacion, 'poner_etiqueta_lead');
  assert.equal(nueva.siguiente, 'mb', 'lo que seguía sigue después');
  assert.equal(porId2(r.pasos, 'k1')!.si_no, nueva.id, 'el «si no» apunta a la nueva');
  assert.deepEqual(r.quitadas, ['e1']);
  assert.deepEqual(erroresEdicion(baseCondicion(), r, ctx), []);
});
