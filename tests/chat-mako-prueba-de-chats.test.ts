// =============================================================================
// El chat de MaKo de Automations: lo que encontró la prueba de los chats del Cerebro (22/10/2026)
// =============================================================================
// El arnés (rama probar-chats-automations, scripts/probar-chats/automations.mts) corrió 36 casos contra producción
// (be4b9189a) y dejó 18 fallas, con su causa. Las del modelo se miden con el arnés; acá van las que son CÓDIGO:
//   · «Mover de etapa» busca la etapa en el CRM del CRON y guarda ese CRM (si-responde-mover-avisar, 3 de 3);
//   · el verbo «arranque» no pisa la etapa de venta que el pedido nombra (mau-pega-con-disparador, 3 de 3);
//   · un «cambiar» sin cambio real no dice «Cambié» (agrega-estos-textos y esperar-2-dias);
//   · el link que escribió el dueño se queda en el texto (creame-otra, 3 de 3).
// (La espera EN EL MEDIO está en tests/flujo-ia.test.ts; las variables que se renombran, en tests/flujo-ia-arreglos.test.ts.)
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deIA, deIAEdicion, limpiarTexto, linksDelPedido, LISTA_BLANCA_IA, AVISO_MISMA_PERSONA, type CtxIA, type PasoIA } from '../lib/flujo-ia';
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
  const base: PasoIA[] = [{ id: 'm1', orden: 1, canal: 'whatsapp', delay_horas: 0, asunto: null, preheader: null, cuerpo: 'Hola {{nombre}}, soy Mauricio Bustos.', template_wa: null, proveedor: 'no_oficial', siguiente: null } as PasoIA];
  const r = deIAEdicion({ cambiar: [{ id: 'm1', texto: 'Hola {{nombre}}, soy Mauricio Bustos.' }] }, base, ctxDe(), rndDe());
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

// rotura (sacar `esperaCortaEntreWhatsapp` de `deIAEdicion`) → 1 rojo de 5 (éste).
test('una espera corta entre dos WhatsApp lo dice el código: la línea espera las horas de «Misma persona»', () => {
  const wa = (id: string, cuerpo: string, siguiente: string | null): PasoIA => ({ id, orden: 0, canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo, template_wa: null, proveedor: 'no_oficial', siguiente } as PasoIA);
  const base: PasoIA[] = [
    wa('m1', 'Hola {{nombre}}, soy Mauricio Bustos.', 'e1'),
    { id: 'e1', orden: 0, canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: '', template_wa: null, proveedor: 'no_oficial', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 1440 }, siguiente: 'm2' } as PasoIA,
    wa('m2', '¿Te puedo hacer una pregunta rápida?', null),
  ];
  const corta = deIAEdicion({ cambiar: [{ id: 'e1', minutos: 5 }] }, base, ctxDe(), rndDe());
  assert.deepEqual(corta.cambiadas, ['e1']);
  assert.ok(corta.avisos.includes(AVISO_MISMA_PERSONA), corta.avisos.join(' | '));
  const larga = deIAEdicion({ cambiar: [{ id: 'e1', dias: 2 }] }, base, ctxDe(), rndDe());
  assert.ok(!larga.avisos.includes(AVISO_MISMA_PERSONA), 'dos días: no hace falta decirlo');
  const nada = deIAEdicion({ cambiar: [{ id: 'm1', texto: 'Hola {{nombre}}, soy Mauricio.' }] }, base, ctxDe(), rndDe());
  assert.ok(!nada.avisos.includes(AVISO_MISMA_PERSONA), 'una espera que nadie tocó no se avisa');
});
