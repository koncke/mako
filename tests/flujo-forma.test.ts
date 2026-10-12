// =============================================================================
// flujo-forma (lib/flujo-forma.ts): ¿el flujo está armado con las piezas de HOY?
// =============================================================================
// Undécima tanda (11/10/2026). Martín, punto 3: «En ese mismo flujo hay 2 conditions uno al lado del otro, cuando
// justamente tenemos la opción de en una misma tarjeta de condition poner más de 1... Y lo peor es que en el medio de
// los conditions hay un delay de 1 hora, eso no tiene sentido». Punto 4: «{{Mensaje de MaKo}}, ese dato NO existe... No
// es trackeable». Punto 2: el CRON «Dejó su formulario sin agendar (de antes)» «NO tiene sentido».
//
// Lo que fija, regla por regla (cada una con un flujo mínimo que la rompe y uno parecido que no):
//   1. dos CONDITION pegadas, y CONDITION → DELAY → CONDITION (también con dos esperas o por una flecha en paralelo);
//      con un mensaje o un aviso en el medio, nada;
//   2. `{{mensaje_mako}}` en cualquier tarjeta (un mensaje, la tarjeta MaKo, una de sus partes);
//   3. un CRON de antes (`esEventoDeAntes`), y no una etapa ni un Evento de MaKo;
//   4. más de un AI Step por medio;
//   5. un dato del equipo en un mensaje al lead (en la tarjeta MaKo, sí);
//   6. `miraLaReunion`: una espera por tiempo corta el camino; una «antes de la reunión» o la rama «Próxima reunión», no.
//
// PROBADO ROMPIÉNDOLO: ver las roturas al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { problemasDeForma, miraLaReunion, datosDeReunionSinMirarla, MOTIVO_FORMA, type ReglaForma } from '../lib/flujo-forma';
import { ID_INICIO, type PasoGrafo, type FilaCondicion } from '../lib/flujo-grafo';
import type { Disparador } from '../lib/disparadores';

const RELLENO = { orden: 0, canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: '', template_wa: null, proveedor: 'no_oficial' } as const;
const msg = (id: string, cuerpo: string, siguiente: string | null = null): PasoGrafo => ({ ...RELLENO, id, cuerpo, siguiente, revisar: false }) as PasoGrafo;
const espera = (id: string, siguiente: string | null, modo: 'tiempo' | 'antes_reunion' = 'tiempo'): PasoGrafo =>
  ({ ...RELLENO, id, nodo: 'esperar', espera: { modo, minutos: 60 }, siguiente }) as PasoGrafo;
const cond = (id: string, siguiente: string | null, filas: FilaCondicion[] = [{ campo: 'agendo', no: true }], extra: Partial<PasoGrafo> = {}): PasoGrafo =>
  ({ ...RELLENO, id, nodo: 'condicion', ramas: [{ id: `${id}_si`, modo: 'todas', filas, siguiente }], si_no: null, ...extra }) as PasoGrafo;
const mako = (id: string, mensaje: string, siguiente: string | null = null, partes?: unknown[]): PasoGrafo =>
  ({ ...RELLENO, id, siguiente, accion: { operacion: 'avisar_al_equipo', params: { leadId: 'evento', mensaje, ...(partes ? { partes } : {}) } } }) as PasoGrafo;
const ia = (id: string): PasoGrafo =>
  ({ ...RELLENO, id, nodo: 'respuesta', paso_ia: true, objetivo: 'Que agende', casos: [{ id: `${id}_c`, titulo: 'Quiere agendar', cuando: 'Pide un horario', siguiente: null }], si_no: null }) as PasoGrafo;

const reglas = (pasos: PasoGrafo[], crones: Disparador[] = []): Array<[ReglaForma, string | null]> =>
  problemasDeForma(pasos, crones).map((p) => [p.regla, p.tarjeta]);

test('dos CONDITION pegadas y CONDITION → DELAY → CONDITION; con un mensaje en el medio, nada', () => {
  assert.deepEqual(reglas([cond('c1', 'c2'), cond('c2', 'm1'), msg('m1', 'Hola')]), [['condicion_pegada', 'c2']]);
  // El #198 de antes: CONDITION «Llegó hace menos de 72 h» → DELAY 1 h → CONDITION «Agendó».
  assert.deepEqual(reglas([cond('c1', 'd1'), espera('d1', 'c2'), cond('c2', 'm1'), msg('m1', 'Hola')]), [['condicion_espera_condicion', 'c2']]);
  // Dos esperas en el medio siguen sin hacer nada.
  assert.deepEqual(reglas([cond('c1', 'd1'), espera('d1', 'd2'), espera('d2', 'c2'), cond('c2', 'm1'), msg('m1', 'Hola')]), [['condicion_espera_condicion', 'c2']]);
  // Por el «Si no», también.
  assert.deepEqual(reglas([cond('c1', 'm1', undefined, { si_no: 'c2' }), msg('m1', 'Hola'), cond('c2', 'm2'), msg('m2', 'Chau')]), [['condicion_pegada', 'c2']]);
  // Con un mensaje o un aviso en el medio, es lo que hacen las plantillas: nada.
  assert.deepEqual(reglas([cond('c1', 'm1'), msg('m1', 'Hola', 'd1'), espera('d1', 'c2'), cond('c2', 'k1'), mako('k1', '{{nombre_completo}}')]), []);
  assert.deepEqual(reglas([cond('c1', 'k1'), mako('k1', 'Ojo', 'd1'), espera('d1', 'c2'), cond('c2', 'm1'), msg('m1', 'Hola')]), []);
  assert.equal(problemasDeForma([cond('c1', 'c2'), cond('c2', 'm1'), msg('m1', 'Hola')])[0].motivo, MOTIVO_FORMA.condicionPegada);
});

test('{{mensaje_mako}} en cualquier tarjeta: un mensaje, la tarjeta MaKo o una de sus partes', () => {
  assert.deepEqual(reglas([mako('k1', '{{mensaje_mako}}')]), [['mensaje_mako', 'k1']]);
  assert.deepEqual(reglas([mako('k1', 'Hola', null, [{ tipo: 'texto', cuerpo: 'Hola' }, { tipo: 'texto', cuerpo: '{{ mensaje_mako }}' }])]), [['mensaje_mako', 'k1']]);
  // En un mensaje al lead es además un dato del equipo.
  assert.deepEqual(reglas([msg('m1', 'Mira: {{mensaje_mako}}')]).map(([r]) => r).sort(), ['dato_de_equipo', 'mensaje_mako']);
  assert.equal(problemasDeForma([mako('k1', '{{mensaje_mako}}')])[0].motivo, 'No existe: {{mensaje_mako}}');
  // Los datos citables del aviso, sí.
  assert.deepEqual(reglas([mako('k1', '💬 {{nombre_completo}} te escribió.\n«{{lead_escribio}}»\n👉 {{link_lead}}')]), []);
});

test('un CRON de antes (y no una etapa, un Evento de MaKo ni uno a elegir)', () => {
  const pasos = [msg('m1', 'Hola')];
  assert.deepEqual(reglas(pasos, [{ id: 'd1', trigger_tipo: 'instant_form_sin_agenda' }]), [['cron_de_antes', null]]);
  assert.equal(problemasDeForma(pasos, [{ trigger_tipo: 'agendado_primer_contacto' }])[0].motivo, MOTIVO_FORMA.cronDeAntes);
  for (const d of [
    { id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'lead', etapas: null },
    { id: 'd1', trigger_tipo: 'aviso_mako', subtipo: 'cuota_vencida' },
    { id: 'd1', trigger_tipo: 'manual' },
    { id: 'd1', trigger_tipo: 'instagram', subtipo: 'dm' },
  ] as Disparador[]) assert.deepEqual(reglas(pasos, [d]), [], d.trigger_tipo);
});

test('más de un AI Step por medio: el segundo es el que sobra', () => {
  assert.deepEqual(reglas([msg('m1', 'Hola'), ia('a1'), ia('a2')]), [['ai_step_de_mas', 'a2']]);
  assert.deepEqual(reglas([msg('m1', 'Hola'), ia('a1')]), []);
  // Otro medio no cuenta (uno por medio).
  assert.deepEqual(reglas([msg('m1', 'Hola'), ia('a1'), { ...ia('a2'), medio: 'instagram' } as PasoGrafo]), []);
});

test('un dato del EQUIPO en un mensaje al lead (en «MaKo en WhatsApp», sí)', () => {
  assert.deepEqual(reglas([msg('m1', 'Tu ficha: {{link_lead}}')]), [['dato_de_equipo', 'm1']]);
  assert.equal(problemasDeForma([msg('m1', 'Vino de {{lead_utm_campaign}} {{link_lead}}')])[0].motivo, 'Es del equipo: {{lead_utm_campaign}}, {{link_lead}}');
  assert.deepEqual(reglas([mako('k1', '{{nombre_completo}} 👉 {{link_lead}}')]), []);
  // Los del lead, en un mensaje al lead, sí.
  assert.deepEqual(reglas([msg('m1', 'Hola {{nombre}}, nos vemos {{reunion_cuando}}')]), []);
});

test('miraLaReunion: una espera por TIEMPO corta el camino; «antes de la reunión» o la rama «Próxima reunión», no', () => {
  const PROXIMA: FilaCondicion[] = [{ campo: 'reunion_en', op: 'menor_igual', valor: 720 }];
  // Detrás de la rama «Próxima reunión»: sí, aunque haya otro mensaje en el medio.
  const a = [cond('c1', 'm1', PROXIMA), msg('m1', 'Hola', 'm2'), msg('m2', 'Nos vemos {{reunion_cuando}}')];
  assert.ok(miraLaReunion(a, 'm2'));
  assert.deepEqual(datosDeReunionSinMirarla(a), []);
  // Una espera por tiempo después de la condición: hay que volver a preguntar.
  const b = [cond('c1', 'd1', PROXIMA), espera('d1', 'm1'), msg('m1', 'Nos vemos {{reunion_cuando}}')];
  assert.equal(miraLaReunion(b, 'm1'), false);
  assert.deepEqual(datosDeReunionSinMirarla(b), ['m1']);
  // Una espera «antes de la reunión» la ancla el motor.
  assert.ok(miraLaReunion([espera('d1', 'm1', 'antes_reunion'), msg('m1', 'Empezamos {{reunion_faltan}}')], 'm1'));
  // Colgado del CRON, sin nada: no.
  const c = [{ ...RELLENO, id: ID_INICIO, nodo: 'inicio', siguiente: 'k1', paralelos: [] } as PasoGrafo, mako('k1', '{{nombre_completo}} reservó para {{reunion_cuando}}')];
  assert.deepEqual(datosDeReunionSinMirarla(c), ['k1']);
  // Otra fila (o la negada) no cuenta.
  assert.equal(miraLaReunion([cond('c1', 'm1', [{ campo: 'agendo' }]), msg('m1', 'x')], 'm1'), false);
  // Un mensaje sin datos de la reunión no se mide.
  assert.deepEqual(datosDeReunionSinMirarla([espera('d1', 'm1'), msg('m1', 'Hola {{nombre}}')]), []);
});

// ROTURAS (11/10/2026, arnés wf-undecima/w3-plantillas/roturas.cjs: una por vez, restaurada de memoria con sha1 igual;
// base 6 / 0, restaurado 6 / 0):
//   R11 `condicionesDetras` no sigue por las esperas (sólo mira el destino directo)          → 5 / 1 (la de las CONDITION)
//   R12 `miraLaReunion` toma una espera por tiempo como si mirara la reunión                  → 5 / 1 (miraLaReunion)
