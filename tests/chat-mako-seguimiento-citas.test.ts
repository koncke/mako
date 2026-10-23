// =============================================================================
// «Editar» de MaKo: el seguimiento que pidió el dueño queda detrás de «No contestó» aunque el modelo lo arme a medias
// (23/10/2026, el arnés del AU2: `seguimiento-no-contesto` en rojo en las dos pasadas y `solo-apertura` en la segunda)
// =============================================================================
// Tres causas, ninguna era la regla del prompt (ya pedía `contesto` con `no`):
//   · LA CITA SE LEÍA COMO ORDEN: «un seguimiento si no responde: «{Nombre}, ¿pudiste ver lo que te mandé? Me avisas»» →
//     `pidioAviso` veía «avisas», el control le pedía al modelo «falta el aviso al grupo» y el reintento ponía un aviso en
//     vez del seguimiento (pasada 2). Lo que lee la intención va sin las citas (`sinCitas`).
//   · EL MODELO LO DEJÓ A MEDIAS: la espera y una condición «Contestó» (la positiva) colgando de una tarjeta que no existía,
//     y el mensaje cortado (pasada 1, gpt-oss-120b por la red de plataforma). El texto está citado y la espera la dice el
//     pedido: lo arma el código (`seguimientoQueFalta`) y «No contestó» la pone `seguimientosConNoContesto`.
//   · EL RUTEO DE «PEDIDOS SUELTOS» SE LO TRAGÓ: «que la automatización sea de "Apertura"» calzó con otra automatización
//     cuyo nombre tenía «apertura», y MaKo no recibió el pedido (`decidir`, lib/mako-pedidos.ts).
//
// PROBADO ROMPIÉNDOLO: ver el pie. Correr: node --import tsx --test tests/chat-mako-seguimiento-citas.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deIAEdicion, pidioAviso, pidioRespuesta, cambioDeCanal, LISTA_BLANCA_IA, AVISO_SEGUIMIENTO, AVISO_SEGUIMIENTO_ARMADO, type CtxIA } from '../lib/flujo-ia';
import { sinCitas, minutosDelPedido, citasQueFaltan, pideQueQuedeSolo } from '../lib/flujo-ia-intencion';
import { revisarEdicion, pideAgregar } from '../lib/flujo-ia-revision-editar';
import { nodoPorId, type PasoGrafo } from '../lib/flujo-grafo';
import { porId as defPorId, REGISTRO, ordenarPorRelevancia, visible, type Vista } from '../lib/api-mako/registro';
import { esAccion, esLectura, type OperacionDef } from '../lib/api-mako/tipos';
import { interpretarCon, type ContextoPedidos, type ObjetoChat, type OperacionChat } from '../lib/mako-pedidos';

const acciones = LISTA_BLANCA_IA.map((id) => { const d = defPorId(id)!; return { id: d.id, titulo: d.titulo, parametros: d.parametros }; });
const ctxDe = (pedido: string): CtxIA => ({
  etiquetas: [], audios: [], archivos: [], acciones, links: {}, soloLoPedido: true,
  productos: [{ funnelId: 44, productoId: null, nombre: 'Guía', esDefault: true, etapas: [{ value: 'st0', label: 'Prospección' }], etapasEntrega: [] }],
  disparadores: [{ value: 'venta:44:st0', label: 'Guía › Entra a «Prospección»' }], disparadorActual: 'venta:44:st0', pedido,
} as unknown as CtxIA);
const rnd = () => { let k = 0; return () => ((k++ * 0.137) % 1); };

/** La partida del arnés (`automations.mts`, la de dos mensajes), con textos neutros. */
const W = { canal: 'whatsapp', asunto: null, delay_horas: 0, template_wa: null };
const BASE = [
  { ...W, id: 'nm1', orden: 1, cuerpo: 'Hola estimado {{nombre}}, espero que estés muy bien.', siguiente: 'nm2' },
  { ...W, id: 'nm2', orden: 2, cuerpo: 'Hola {{nombre}}, soy Ana de Estudio Norte. ¿Sigues al frente de tu empresa?', siguiente: null },
] as unknown as PasoGrafo[];
/** El pedido del caso `seguimiento-no-contesto`, tal cual. */
const PEDIDO = 'Agregá al final un seguimiento a los 2 días si no responde: «{Nombre}, ¿pudiste ver lo que te mandé? Me avisas»';

const sig = (pasos: readonly PasoGrafo[], id: string | null | undefined) => (id ? nodoPorId(pasos, id) : null);
const esNoContesto = (p: PasoGrafo | null) => !!p && p.nodo === 'condicion' && (p.ramas ?? []).length === 1 && p.ramas![0].filas.length === 1
  && p.ramas![0].filas[0].campo === 'contesto' && p.ramas![0].filas[0].no === true && p.si_no == null;
/** Lo que cuelga de nm2: la espera, la condición y el mensaje (o null donde se corta). */
function cadena(pasos: readonly PasoGrafo[]) {
  const espera = sig(pasos, sig(pasos, 'nm2')?.siguiente);
  const cond = sig(pasos, espera?.siguiente);
  const msg = sig(pasos, cond?.ramas?.[0]?.siguiente);
  return { espera, cond, msg };
}

test('la cita es el mensaje, no la orden: «Me avisas» adentro no pide un aviso, ni «respondes» un «Si responde»', () => {
  assert.equal(sinCitas(PEDIDO), 'Agregá al final un seguimiento a los 2 días si no responde: «…»');
  // Lo corto entre comillas (una etapa, una etiqueta) es parte de la orden y se queda.
  assert.equal(sinCitas('movelo a la etapa «Respondió» y avísame'), 'movelo a la etapa «Respondió» y avísame');
  assert.equal(pidioAviso(PEDIDO), false);
  assert.equal(pidioAviso(`${PEDIDO}. Y avísame por el grupo si contesta`), true);
  assert.equal(pidioRespuesta('Agrega «Hola {Nombre}, cuando me respondas te paso el link»'), false);
  assert.equal(cambioDeCanal('Agrega «Hola {Nombre}, te escribo por Instagram en vez de WhatsApp»'), null);
  assert.equal(pideAgregar('Cambia el segundo por «Hola {Nombre}, te agrego al grupo de la guía»'), false);
  assert.equal(pideQueQuedeSolo('Cambia el primero por «Sólo quiero que sepas que la guía ya está lista»'), false);
});

test('el control ya no pide un aviso que nadie pidió: con el seguimiento bien armado, nada que decir', () => {
  const bien = { agregar: [{ despues_de: 'nm2', salida: 'sig', tarjetas: [
    { id: 't1', tipo: 'esperar', dias: 2, sigue: 't2' },
    { id: 't2', tipo: 'mensaje', canal: 'whatsapp', texto: '{{nombre}}, ¿pudiste ver lo que te mandé? Me avisas' },
  ] }] };
  const rev = revisarEdicion({ obj: bien, base: BASE, ctx: ctxDe(PEDIDO), pedido: PEDIDO, historial: [], intencion: 'editar' });
  assert.deepEqual(rev.errores, [], 'el control volvía al modelo pidiendo «el aviso al grupo» por el «Me avisas» de la cita');
  const { espera, cond, msg } = cadena(rev.r.pasos);
  assert.equal((espera as { espera?: { minutos?: number } } | null)?.espera?.minutos, 2880);
  assert.ok(esNoContesto(cond), 'el seguimiento no quedó detrás de «No contestó desde que entró»');
  assert.match(String(msg?.cuerpo), /^\{\{nombre\}\}, ¿pudiste ver lo que te mandé\? Me avisas$/);
  assert.ok(!rev.r.pasos.some((p) => (p as { accion?: { operacion?: string } }).accion?.operacion === 'avisar_al_equipo'));
  // «Si contesta… te aviso» adentro de un mensaje tampoco pide el aviso cuando el lead responde.
  const cambio = 'Cambiá el segundo por «Hola {Nombre}, si contesta tu socio te aviso por aquí»';
  const rev2 = revisarEdicion({ obj: { cambiar: [{ id: 'nm2', texto: 'Hola {{nombre}}, si contesta tu socio te aviso por aquí' }] }, base: BASE, ctx: ctxDe(cambio), pedido: cambio, historial: [], intencion: 'editar' });
  assert.deepEqual(rev2.errores, [], 'el control pedía el aviso al grupo por el «te aviso» de la cita');
});

test('la pasada 1, tal cual quedó: espera + «Contestó» colgando de una tarjeta que no existe → el código arma el seguimiento', () => {
  const amedias = { agregar: [{ despues_de: 'nm2', salida: 'sig', tarjetas: [
    { id: 't1', tipo: 'esperar', dias: 2, sigue: 't2' },
    { id: 't2', tipo: 'condicion', ramas: [{ si: [{ campo: 'contesto' }], sigue: 't9' }] },
  ] }] };
  const r = deIAEdicion(amedias, BASE, ctxDe(PEDIDO), rnd());
  const { espera, cond, msg } = cadena(r.pasos);
  assert.equal((espera as { espera?: { minutos?: number } } | null)?.espera?.minutos, 2880, 'no tomó la espera que dejó el modelo');
  assert.ok(esNoContesto(cond), 'quedó la condición positiva («Contestó») o ninguna');
  assert.match(String(msg?.cuerpo), /^\{\{nombre\}\}, ¿pudiste ver lo que te mandé\? Me avisas$/, '«{Nombre}» no pasó a {{nombre}}, o no está el texto');
  assert.equal(msg?.canal, 'whatsapp');
  assert.ok(r.avisos.includes(AVISO_SEGUIMIENTO_ARMADO) && r.avisos.includes(AVISO_SEGUIMIENTO), JSON.stringify(r.avisos));
  // Una sola condición: la positiva que dejó el modelo se fue.
  assert.equal(r.pasos.filter((p) => p.nodo === 'condicion').length, 1);
  // Y el control no tiene nada que pedir: no vuelve al modelo.
  const rev = revisarEdicion({ obj: amedias, base: BASE, ctx: ctxDe(PEDIDO), pedido: PEDIDO, historial: [], intencion: 'editar' });
  assert.deepEqual(rev.errores, []);
  assert.equal(rev.r.noHecho, undefined);
});

test('sin nada del modelo, la espera sale del pedido; sin espera en ningún lado, no se inventa', () => {
  const nada = deIAEdicion({ agregar: [] }, BASE, ctxDe(PEDIDO), rnd());
  assert.equal((cadena(nada.pasos).espera as { espera?: { minutos?: number } } | null)?.espera?.minutos, 2880);
  assert.ok(esNoContesto(cadena(nada.pasos).cond));
  const sinLapso = deIAEdicion({ agregar: [] }, BASE, ctxDe('Agregá un seguimiento si no responde: «{Nombre}, ¿pudiste ver lo que te mandé?»'), rnd());
  assert.equal(sinLapso.pasos.length, BASE.length, 'inventó una espera que nadie dijo');
  assert.equal(minutosDelPedido('un seguimiento al día siguiente'), 1440);
  assert.equal(minutosDelPedido('espera 3 horas, y un seguimiento a los 2 días', 'espera 3 horas, y un '.length), 2880);
  assert.equal(minutosDelPedido('un seguimiento en una semana'), 10080);
});

test('el código no arma nada donde el modelo puso otra cosa, con dos citas, sin seguimiento pedido o por email', () => {
  // Un aviso después del último mensaje (lo pudo pedir el dueño): no se toca.
  const conAviso = deIAEdicion({ agregar: [{ despues_de: 'nm2', salida: 'sig', tarjetas: [
    { id: 't1', tipo: 'esperar', dias: 2, sigue: 't2' },
    { id: 't2', tipo: 'accion', operacion: 'avisar_al_equipo', datos: { mensaje: '💬 {{nombre_completo}} no respondió' } },
  ] }] }, BASE, ctxDe(`${PEDIDO}. Y avísame por el grupo`), rnd());
  assert.ok(!conAviso.avisos.includes(AVISO_SEGUIMIENTO_ARMADO));
  // Dos citas que faltan: no se sabe cuál es el seguimiento.
  const dos = deIAEdicion({ agregar: [] }, BASE, ctxDe('Agregá «Hola {Nombre}, te escribo otra vez de Estudio Norte» y un seguimiento a los 2 días: «{Nombre}, ¿lo pudiste ver?»'), rnd());
  assert.ok(!dos.avisos.includes(AVISO_SEGUIMIENTO_ARMADO));
  // Un recordatorio no es un seguimiento (le llega aunque haya contestado).
  const rec = deIAEdicion({ agregar: [] }, BASE, ctxDe('Agregá un recordatorio a los 2 días: «{Nombre}, mañana te paso la guía»'), rnd());
  assert.equal(rec.pasos.length, BASE.length);
  // Una tarjeta que ya estaba después del último mensaje: no se pisa.
  const base2 = [{ ...BASE[0] }, { ...BASE[1], siguiente: 'nx' }, { id: 'nx', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 60 }, siguiente: null }] as unknown as PasoGrafo[];
  const ya = deIAEdicion({ agregar: [] }, base2, ctxDe(PEDIDO), rnd());
  assert.ok(!ya.avisos.includes(AVISO_SEGUIMIENTO_ARMADO));
  // Por email: el asunto no está en el pedido.
  const email = BASE.map((p) => ({ ...p, canal: 'email', asunto: 'Hola' })) as unknown as PasoGrafo[];
  assert.ok(!deIAEdicion({ agregar: [] }, email, ctxDe(PEDIDO), rnd()).avisos.includes(AVISO_SEGUIMIENTO_ARMADO));
  assert.deepEqual(citasQueFaltan(PEDIDO, ['{{nombre}}, ¿pudiste ver lo que te mandé? Me avisas']), []);
});

// ── El ruteo de «pedidos sueltos» (lib/mako-pedidos.ts) ──────────────────────────────────────────────────────────
const VISTA: Vista = { canal: 'app', alcance: 'proponer', ws: 3, rol: 'admin', tabs: null };
const ops: OperacionChat[] = REGISTRO.filter((d) => (esAccion(d) || esLectura(d)) && visible(d, VISTA))
  .map((d) => ({ id: d.id, area: d.area, tipo: esLectura(d) ? 'lectura' : 'accion', titulo: d.titulo, descripcion: d.descripcion }));
const ordenar = (lista: readonly OperacionChat[], texto: string): OperacionChat[] => {
  const m = new Map(lista.map((o) => [o.id, o]));
  return ordenarPorRelevancia(lista.map((o) => defPorId(o.id)).filter((d): d is OperacionDef => !!d), texto).map((d) => m.get(d.id)!);
};
const ABIERTA: ObjetoChat = { id: '623', nombre: '🧪 Prueba chats · seguimiento-no-contesto', tocadoAt: '2026-10-23T08:10:00Z' };
const OTRA: ObjetoChat = { id: '611', nombre: '🧪 Prueba chats · solo-apertura', tocadoAt: '2026-10-23T07:40:00Z' };
const OTRA2: ObjetoChat = { id: '612', nombre: 'Bienvenida', tocadoAt: '2026-10-22T07:40:00Z' };
const ctxChat = (): ContextoPedidos => ({ tab: 'chatbot', actual: ABIERTA, objetos: [ABIERTA, OTRA, OTRA2], operaciones: ops, ordenar, ws: 3 });
const SOLO_APERTURA = 'En realidad solo quiero que la automatización sea de "Apertura", y de última con un seguimiento si no responden con algo como "Hola querido {Nombre}, si no me confirmas no puedo reservarte la guía"... Y una vez que alguien responde en cualquier parte del flujo, se corta la automatización y le avisa a Ana por el grupo de WhatsApp de MaKo.';

test('una orden sobre el flujo abierto no se va a otra automatización porque una cita calce en su nombre', async () => {
  const i = await interpretarCon(SOLO_APERTURA, ctxChat(), null);
  assert.ok(i.pedidos.length > 0 && i.pedidos.every((p) => p.sobre === 'actual'), JSON.stringify(i.pedidos));
  const s = await interpretarCon(PEDIDO, ctxChat(), null);
  assert.ok(s.pedidos.every((p) => p.sobre === 'actual'), JSON.stringify(s.pedidos));
  // Lo que SÍ señala a otra sigue yendo a otra: borrar, y «la otra».
  const borrar = (await interpretarCon('Elimina «Bienvenida»', ctxChat(), null)).pedidos[0];
  assert.ok(borrar.sobre === 'otro' && borrar.objeto?.id === '612', JSON.stringify(borrar));
  const laOtra = (await interpretarCon('En la otra, si no responde, mándale un seguimiento', ctxChat(), null)).pedidos[0];
  assert.equal(laOtra.sobre, 'otro', JSON.stringify(laOtra));
});

// ── ROTURAS (23/10/2026) ───────────────────────────────────────────────────────────────────────────
// Una por vez (reemplazar el texto, correr este archivo, devolverlo de memoria). Base 6 pasan / 0 fallan:
//   C1. `sinCitas` devuelve el pedido entero                                                    → 3 fallan
//   C2. `pidioAviso` sin `sinCitas`                                                             → 1 falla
//   C3. `formaPedida` con el pedido entero                                                      → 1 falla
//   C4. `seguimientoQueFalta` no se llama en `deIAEdicion`                                      → 2 fallan
//   C5. la cola acepta una tarjeta que ya estaba (sin `ed.agregadas.has`)                       → 1 falla
//   C6. `minutosDelPedido` devuelve siempre 1440                                                → 1 falla
//   C7. sin la regla de la orden del flujo en `decidir`                                         → 1 falla
