// =============================================================================
// El chat de MaKo de Automations: lo que encontró la prueba de los chats del Cerebro (22/10/2026)
// =============================================================================
// El arnés (rama probar-chats-automations, scripts/probar-chats/automations.mts) corrió 36 casos contra producción
// (be4b9189a) y dejó 18 fallas, con su causa. Las del modelo se miden con el arnés; acá van las que son CÓDIGO:
//   · «Mover de etapa» busca la etapa en el CRM del CRON y guarda ese CRM (si-responde-mover-avisar, 3 de 3);
//   · el verbo «arranque» no pisa la etapa de venta que el pedido nombra (mau-pega-con-disparador, 3 de 3);
//   · un «cambiar» sin cambio real no dice «Cambié» (agrega-estos-textos y esperar-2-dias);
//   · el link que escribió el dueño se queda en el texto (creame-otra, 3 de 3);
//   · y (#287, 6/11/2026) el link que la TARJETA YA TENÍA tampoco se va cuando el modelo la reescribe.
// (La espera EN EL MEDIO está en tests/flujo-ia.test.ts; las variables que se renombran, en tests/flujo-ia-arreglos.test.ts.)
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deIA, deIAEdicion, limpiarTexto, linksDelPedido, LISTA_BLANCA_IA, type CtxIA, type PasoIA } from '../lib/flujo-ia';
import * as flujoIA from '../lib/flujo-ia';
import { claseDe } from '../lib/flujo-grafo';
import { porId } from '../lib/api-mako/registro';

const acciones = LISTA_BLANCA_IA.map((id) => {
  const d = porId(id);
  if (!d) throw new Error(`la lista blanca nombra «${id}», que no está en el registro`);
  return { id: d.id, titulo: d.titulo, parametros: d.parametros };
});
// El negocio de Mauricio, en chico: el CRM principal y el del Sprint (con «Respondió», que el principal no tiene).
const PRODUCTOS = [
  { funnelId: 1, productoId: null, nombre: 'Negocio que ESCALA', esDefault: true, etapas: [{ value: 'lead', label: 'Lead entrante' }, { value: 'agenda', label: 'Agenda R1' }], etapasEntrega: [] },
  { funnelId: 44, productoId: null, nombre: 'Sprint 3 días', etapas: [{ value: 'lead', label: 'Lead entrante' }, { value: 'st0', label: 'Prospección activa' }, { value: 'st1', label: 'Respondió' }], etapasEntrega: [] },
  { funnelId: 50, productoId: 12, nombre: 'Programa', etapas: [{ value: 'lead', label: 'Lead entrante' }], etapasEntrega: [{ value: 'arranque', label: 'Arranque' }] },
];
const DISPARADORES = [
  { value: 'venta:44:st0', label: 'Sprint 3 días › Entra a «Prospección activa»' },
  { value: 'venta:1:lead', label: 'Negocio que ESCALA › Entra a «Lead entrante»' },
  { value: 'entrega:12:arranque', label: 'Programa › Llega a «Arranque»' },
];
const clave = (valor: string) => `d${DISPARADORES.findIndex((d) => d.value === valor) + 1}`;
const ctxDe = (o: Partial<CtxIA> = {}): CtxIA => ({
  etiquetas: [], productos: PRODUCTOS, disparadores: DISPARADORES, audios: [], archivos: [], acciones, links: {}, ...o,
});
const rndDe = () => { let k = 0; return () => ((k++ * 0.137) % 1); };
const moverDe = (pasos: readonly PasoIA[]) => pasos.find((p) => p.accion?.operacion === 'proponer_cambio_etapa')?.accion?.params as Record<string, unknown> | undefined;
const moverA = (etapa: string) => [
  { id: 't1', tipo: 'mensaje', texto: 'Hola {{nombre}}', sigue: 't2' },
  { id: 't2', tipo: 'accion', operacion: 'proponer_cambio_etapa', datos: { etapa } },
];

// roturas (volver a `producto ?? resolverProducto(null, est.ctx)` en `resolverAccion`; no guardar `embudoId`) → 1 rojo de 5 cada una (éste).
test('«Mover de etapa» busca la etapa en el CRM del CRON y guarda ese CRM, al crear y al editar', () => {
  // Crear con el CRON del Sprint: «Respondió» es del Sprint (el principal no la tiene).
  const r = deIA({ disparador: clave('venta:44:st0'), inicio: 't1', tarjetas: moverA('Respondió') }, ctxDe(), rndDe());
  assert.ok(!r.avisos.some((a) => a.startsWith('Saqué')), r.avisos.join(' | '));
  assert.deepEqual({ etapa: moverDe(r.pasos as PasoIA[])?.etapa, embudoId: moverDe(r.pasos as PasoIA[])?.embudoId }, { etapa: 'st1', embudoId: 44 });
  // «Lead entrante» está en los dos: gana el CRM del CRON, no el principal.
  const l = deIA({ disparador: clave('venta:44:st0'), inicio: 't1', tarjetas: moverA('Lead entrante') }, ctxDe(), rndDe());
  assert.equal(moverDe(l.pasos as PasoIA[])?.embudoId, 44);
  // Con el CRON del principal, lo de siempre (y guarda el principal, como el control del lienzo).
  const p = deIA({ disparador: clave('venta:1:lead'), inicio: 't1', tarjetas: moverA('Agenda R1') }, ctxDe(), rndDe());
  assert.deepEqual({ etapa: moverDe(p.pasos as PasoIA[])?.etapa, embudoId: moverDe(p.pasos as PasoIA[])?.embudoId }, { etapa: 'agenda', embudoId: 1 });
  // Editar una automatización del Sprint: el CRON que ya tiene (`disparadorActual`).
  const base = deIA({ disparador: clave('venta:44:st0'), inicio: 't1', tarjetas: [{ id: 't1', tipo: 'mensaje', texto: 'Hola {{nombre}}' }] }, ctxDe(), rndDe()).pasos;
  const m1 = base.find((x) => claseDe(x) === 'mensaje')!;
  const e = deIAEdicion({ agregar: [{ despues_de: m1.id, salida: 'sig', tarjetas: [{ id: 'x1', tipo: 'accion', operacion: 'proponer_cambio_etapa', datos: { etapa: 'Respondió' } }] }] },
    base, ctxDe({ disparadorActual: 'venta:44:st0' }), rndDe());
  assert.ok(!e.avisos.some((a) => a.startsWith('Saqué')), e.avisos.join(' | '));
  assert.deepEqual({ etapa: moverDe(e.pasos as PasoIA[])?.etapa, embudoId: moverDe(e.pasos as PasoIA[])?.embudoId }, { etapa: 'st1', embudoId: 44 });
  // Una etapa que ningún CRM tiene: se saca, diciendo de cuál no es (el del CRON).
  const n = deIA({ disparador: clave('venta:44:st0'), inicio: 't1', tarjetas: moverA('Contactado') }, ctxDe(), rndDe());
  assert.ok(n.avisos.some((a) => a.includes('«Contactado» no es una etapa de «Sprint 3 días»')), n.avisos.join(' | '));
});

// rotura (sacar el corte de `nombreElegida` en `entregaNombrada`) → 1 rojo de 5 (éste).
test('el verbo «arranque» no pisa la etapa de venta que el pedido nombra', () => {
  const pedido = 'Que arranque cuando el lead entra a la etapa Prospección activa del CRM «Sprint 3 días» y le mande «Hola {Nombre}»';
  const r = deIA({ disparador: clave('venta:44:st0'), inicio: 't1', tarjetas: [{ id: 't1', tipo: 'mensaje', texto: 'Hola {{nombre}}' }] }, ctxDe({ pedido }), rndDe());
  assert.equal(r.disparador, 'venta:44:st0');
  // Si el pedido nombra la entrega y el modelo eligió venta, la segunda capa sigue eligiendo la entrega.
  const otra = deIA({ disparador: clave('venta:44:st0'), inicio: 't1', tarjetas: [{ id: 't1', tipo: 'mensaje', texto: 'Hola {{nombre}}' }] },
    ctxDe({ pedido: 'Cuando un alumno llega a Arranque, dale la bienvenida' }), rndDe());
  assert.equal(otra.disparador, 'entrega:12:arranque');
});

// rotura (sacar `estable` de `contenido`: el JSON crudo) → 1 rojo de 5 (éste).
test('un «cambiar» que no cambia nada no dice «Cambié»', () => {
  const base: PasoIA[] = [{ id: 'm1', orden: 1, canal: 'whatsapp', delay_horas: 0, asunto: null, preheader: null, cuerpo: 'Hola {{nombre}}, soy Mauricio Ejemplo.', template_wa: null, proveedor: 'no_oficial', siguiente: null } as PasoIA];
  const r = deIAEdicion({ cambiar: [{ id: 'm1', texto: 'Hola {{nombre}}, soy Mauricio Ejemplo.' }] }, base, ctxDe(), rndDe());
  assert.deepEqual(r.cambiadas, [], 'el texto es el mismo');
  const c = deIAEdicion({ cambiar: [{ id: 'm1', texto: 'Hola {{nombre}}, soy Mauricio.' }] }, base, ctxDe(), rndDe());
  assert.deepEqual(c.cambiadas, ['m1'], 'y uno de verdad sí cuenta');
});

// roturas (`limpiarTexto` sin `deja`; `textoLimpio` sin el pedido) → 1 rojo de 5 cada una (éste).
test('el link que escribió el dueño se queda; el que inventa el modelo, no', () => {
  const deja = linksDelPedido('Créame otra automatización para los que respondieron: que les mande el link del Sprint https://sprint.mauriciobustos.com/');
  const t = limpiarTexto('Aquí está: https://sprint.mauriciobustos.com/ y si quieres, mira https://otro-sitio.com/oferta', { deja });
  assert.equal(t.texto, 'Aquí está: https://sprint.mauriciobustos.com/ y si quieres, mira');
  assert.deepEqual(t.quitado, ['link'], 'el inventado se borra y se avisa');
  assert.equal(limpiarTexto('Entra a sprint.mauriciobustos.com.', { deja }).texto, 'Entra a sprint.mauriciobustos.com.', 'sin protocolo, el mismo link');
  assert.equal(limpiarTexto('Entra a sprint.mauriciobustos.com/otra-ruta', { deja }).texto, 'Entra a', 'otra ruta del mismo sitio no es lo que escribió');
  // Al crear: el texto del mensaje lo trae, porque el pedido lo nombra.
  const pedido = 'que les mande el link del Sprint https://sprint.mauriciobustos.com/';
  const r = deIA({ disparador: clave('venta:44:st0'), inicio: 't1', tarjetas: [{ id: 't1', tipo: 'mensaje', texto: 'Hola {{nombre}}, aquí va: https://sprint.mauriciobustos.com/' }] }, ctxDe({ pedido }), rndDe());
  assert.match(String((r.pasos as PasoIA[]).find((p) => claseDe(p) === 'mensaje')?.cuerpo), /https:\/\/sprint\.mauriciobustos\.com\//);
  const sin = deIA({ disparador: clave('venta:44:st0'), inicio: 't1', tarjetas: [{ id: 't1', tipo: 'mensaje', texto: 'Hola {{nombre}}, aquí va: https://sprint.mauriciobustos.com/' }] }, ctxDe(), rndDe());
  assert.doesNotMatch(String((sin.pasos as PasoIA[]).find((p) => claseDe(p) === 'mensaje')?.cuerpo), /https?:/, 'sin pedido que lo nombre, se va');
});

// ── #287 (6/11/2026): el link que la TARJETA YA TENÍA ──────────────────────────────────────────────
// El síntoma: pedirle un cambio por chat y que reescriba una tarjeta que nadie nombró, dejándola sin el
// link que el mensaje ya llevaba. El lead lo recibe sin link y nada falla. `deja` sólo tenía los links
// del PEDIDO (22/10/2026), y el que la tarjeta ya tenía no estaba ahí.
//
// PROBADO ROMPIÉNDOLO (arnés del scratchpad: rompe UNA, corre este archivo, restaura y verifica por
// md5). Base: 7 / 0. Once roturas, las once cazadas: `textoLimpio` con el `deja` de antes (sólo el
// pedido) → 5 / 2; el parche del mensaje sin pasar la tarjeta → 5 / 2; el mapa vacío → 5 / 2; todos los
// links del FLUJO en vez de los de la tarjeta → 6 / 1; con «link» conservando igual los de antes →
// 6 / 1; `linksDeLaTarjeta` sin el asunto y la vista previa → 6 / 1, y sin el mensaje del aviso →
// 6 / 1; el aviso al equipo y el objetivo del AI Step limpiados sin `deja` → 6 / 1 cada uno; sus dos
// parches sin pasar la tarjeta → 6 / 1 cada uno. Restaurado: 7 / 0.
const LINK287 = 'https://sprint.mauriciobustos.com/';
const msg287 = (id: string, cuerpo: string, extra: Record<string, unknown> = {}): PasoIA => ({
  id, orden: 1, canal: 'whatsapp', delay_horas: 0, asunto: null, preheader: null, cuerpo,
  template_wa: null, proveedor: 'no_oficial', siguiente: null, ...extra,
} as PasoIA);

test('editar una tarjeta NO le borra el link que YA tenía, y el que inventa el modelo sigue cayéndose', () => {
  const base: PasoIA[] = [msg287('m1', `Hola {{nombre}}, aquí va el material: ${LINK287}`, { siguiente: 'm2' }), msg287('m2', 'Te escribo de nuevo')];
  const ctx = ctxDe({ pedido: 'Haz los mensajes más cortos' });
  const cuerpoDe = (r: { pasos: readonly unknown[] }, id: string) => String((r.pasos as PasoIA[]).find((p) => p.id === id)?.cuerpo);
  // 1. El modelo reescribe la tarjeta y repite el link que ya estaba: se queda.
  const r = deIAEdicion({ cambiar: [{ id: 'm1', texto: `Hola {{nombre}}, te dejo el material: ${LINK287}` }] }, base, ctx, rndDe());
  assert.match(cuerpoDe(r, 'm1'), /sprint\.mauriciobustos\.com/, 'el link que la tarjeta ya tenía se borró: el lead recibe el mensaje sin link');
  // 2. Uno que el modelo INVENTA en esa misma tarjeta se sigue cayendo.
  const inv = deIAEdicion({ cambiar: [{ id: 'm1', texto: 'Hola {{nombre}}, mirá https://otro-sitio.com/oferta' }] }, base, ctx, rndDe());
  assert.doesNotMatch(cuerpoDe(inv, 'm1'), /otro-sitio\.com/, 'un link inventado por el modelo tiene que seguir cayéndose');
  // 3. El link de OTRA tarjeta no revive acá: con todos los del flujo se recupera el que alguien borró a propósito.
  const otra = deIAEdicion({ cambiar: [{ id: 'm2', texto: `Te escribo de nuevo: ${LINK287}` }] }, base, ctx, rndDe());
  assert.doesNotMatch(cuerpoDe(otra, 'm2'), /sprint\.mauriciobustos\.com/, 'ese link vivía en OTRA tarjeta: revivirlo deshace lo que una persona borró');
  // 4. Y cambiar EL LINK no deja los dos: el viejo (acá sin protocolo) se va, que es lo que se pidió.
  const conLink = ctxDe({ pedido: 'Cambia el link', links: { material: { url: 'https://hola-mako.com/material', para: 'el material' } } });
  const cb = deIAEdicion({ cambiar: [{ id: 'm3', link: 'material' }] }, [msg287('m3', 'Hola, mirá sprint.mauriciobustos.com/material')], conLink, rndDe());
  assert.match(cuerpoDe(cb, 'm3'), /hola-mako\.com\/material/, 'el link nuevo no entró');
  assert.doesNotMatch(cuerpoDe(cb, 'm3'), /sprint\.mauriciobustos\.com/, 'cambiar el link no puede dejar los dos');
});

test('el asunto y la vista previa de un email, y el mensaje del aviso al equipo, tampoco pierden su link', () => {
  const base: PasoIA[] = [
    { ...msg287('e1', 'Hola', { siguiente: 'a1' }), canal: 'email', asunto: `Tu acceso: ${LINK287}`, preheader: `Entrá por ${LINK287}` } as PasoIA,
    { ...msg287('a1', ''), accion: { operacion: 'avisar_al_equipo', params: { mensaje: `Pasale esto al lead: ${LINK287}` } } } as PasoIA,
  ];
  const r = deIAEdicion({ cambiar: [
    { id: 'e1', asunto: `Ya tenés acceso: ${LINK287}`, vista_previa: `Entrá acá: ${LINK287}` },
    { id: 'a1', datos: { mensaje: `Mandale esto: ${LINK287}` } },
  ] }, base, ctxDe({ pedido: 'Mejora el email y el aviso' }), rndDe());
  const e1 = (r.pasos as PasoIA[]).find((p) => p.id === 'e1');
  assert.match(String(e1?.asunto), /sprint\.mauriciobustos\.com/, 'el asunto perdió su link');
  assert.match(String(e1?.preheader), /sprint\.mauriciobustos\.com/, 'la vista previa perdió su link');
  const a1 = (r.pasos as PasoIA[]).find((p) => p.accion?.operacion === 'avisar_al_equipo');
  assert.match(String(a1?.accion?.params?.mensaje), /sprint\.mauriciobustos\.com/, 'el aviso al equipo iba a salir sin el link');
  // Y el objetivo de un AI Step, que lo limpia `objetivoDeIA`.
  const ia: PasoIA[] = [{ ...msg287('r1', ''), nodo: 'respuesta', paso_ia: true, objetivo: `Que entre a ${LINK287}` } as PasoIA];
  const o = deIAEdicion({ cambiar: [{ id: 'r1', objetivo: `Que entre por ${LINK287} y conteste` }] }, ia, ctxDe({ pedido: 'Ajusta el objetivo del AI Step' }), rndDe());
  assert.match(String((o.pasos as PasoIA[]).find((p) => p.id === 'r1')?.objetivo), /sprint\.mauriciobustos\.com/, 'el objetivo del AI Step perdió su link');
});

// (Hasta el 23/10/2026 este test fijaba que una espera corta entre dos WhatsApp avisaba «la línea espera las horas de «Misma persona»».
// Martín: «elimina "Misma persona"». La espera que se pide es la que se cumple: ya no hay aviso, y `AVISO_MISMA_PERSONA` se fue.)
test('una espera corta entre dos WhatsApp se pone tal cual y no avisa de «Misma persona» (se fue el 23/10/2026)', () => {
  assert.equal('AVISO_MISMA_PERSONA' in flujoIA, false, 'volvió el aviso de «Misma persona» al chat de MaKo');
  const wa = (id: string, cuerpo: string, siguiente: string | null): PasoIA => ({ id, orden: 0, canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo, template_wa: null, proveedor: 'no_oficial', siguiente } as PasoIA);
  const base: PasoIA[] = [
    wa('m1', 'Hola {{nombre}}, soy Mauricio Ejemplo.', 'e1'),
    { id: 'e1', orden: 0, canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: '', template_wa: null, proveedor: 'no_oficial', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 1440 }, siguiente: 'm2' } as PasoIA,
    wa('m2', '¿Te puedo hacer una pregunta rápida?', null),
  ];
  const corta = deIAEdicion({ cambiar: [{ id: 'e1', minutos: 5 }] }, base, ctxDe(), rndDe());
  assert.deepEqual(corta.cambiadas, ['e1']);
  assert.equal(corta.avisos.some((a) => /misma persona/i.test(a)), false, corta.avisos.join(' | '));
  const larga = deIAEdicion({ cambiar: [{ id: 'e1', dias: 2 }] }, base, ctxDe(), rndDe());
  assert.equal(larga.avisos.some((a) => /misma persona/i.test(a)), false, 'dos días');
  const nada = deIAEdicion({ cambiar: [{ id: 'm1', texto: 'Hola {{nombre}}, soy Mauricio.' }] }, base, ctxDe(), rndDe());
  assert.equal(nada.avisos.some((a) => /misma persona/i.test(a)), false, 'una espera que nadie tocó no se avisa');
});
