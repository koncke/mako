// =============================================================================
// «Unificar» dos fichas parecidas, y lo que dice el bloque «Posibles duplicados» (23/10/2026)
// =============================================================================
// Martín, 23/10/2026 ~23:20 UTC: «En el CRM si me dice "Hay otra ficha parecida", que me de la opción ahí mismo de
// unificarlas, y ese bloque en el detail requiere más info... ¿En que CRM aparece duplicada? etc...». Se prueba EJECUTANDO
// el plan (lib/leads-unificar-reglas.ts, `planDeUnificar`) con lecturas de mentira armadas como la del caso real 249/3099
// del ws1 (medida en seco con scripts/unificar-en-seco.mts), y leyendo el fuente donde lo que importa es el cableado.
//
// Correr: node --import tsx --test tests/ficha-unificar.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (23/10/2026): ver el pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  cualQueda, camposDeLaUnion, planDeUnificar, textoDeLaPrevia, type LecturaUnificar, type OpUnificar,
} from '../lib/leads-unificar-reglas';
import { dondeEnUnaLinea, desdeCuando } from '../app/crm/lead-view/ficha/resumen/duplicados-logica';

const sinComentarios = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');
type De = LecturaUnificar['de'][number];
const vacia = (): De => ({
  inscripciones: [], crm: [], filasCrm: [], etiquetas: [], closingJobs: [], makoPendientes: [], borradoresSetter: [],
  chatEstado: false, chatLeidos: [], conteos: {}, deCliente: {}, arreglos: [], flujos: [], notificaciones: 0,
});
/** El caso real: 249 (vieja, casa «Negocio que ESCALA», agregada en el Sprint en «lead») y 3099 (casa el Sprint, en st0). */
function casoReal(): LecturaUnificar {
  return {
    ws: 1,
    a: { id: 249, nombre: 'Martin Koncke', created_at: '2026-10-21T00:00:00Z', updated_at: 'u249', funnel_id: 1, telefono: '+5493764673479', setter: null, origen_lead: null },
    b: { id: 3099, nombre: 'Martin Koncke', created_at: '2026-10-23T04:39:00Z', updated_at: 'u3099', funnel_id: 44, telefono: '+543764673479', setter: 'MaKo', origen_lead: 'instant_form', meta_lead_id: 'M1' },
    de: {
      249: { ...vacia(), crm: [
        { funnelId: 1, crm: 'Negocio que ESCALA', etapa: 'reactivacion', etapaNombre: 'Nutrición - Reactivación', orden: 8, casa: true },
        { funnelId: 44, crm: 'Sprint 3 días', etapa: 'lead', etapaNombre: 'Lead entrante', orden: 0, casa: false },
      ], filasCrm: [{ id: 1117, funnel_id: 44, etapa: 'lead' }] },
      3099: { ...vacia(), crm: [{ funnelId: 44, crm: 'Sprint 3 días', etapa: 'st0', etapaNombre: 'Prospección activa', orden: 1, casa: true }],
        inscripciones: [{ id: 291, secuencia_id: 289, estado: 'activa', nombre: 'Sprint · apertura' }],
        conteos: { lead_audit: 4, wa_mensajes: 6, nutricion_envios: 2 } },
    },
  };
}
const plan = (l: LecturaUnificar, queda: number | null = null) => { const p = planDeUnificar(l, queda); assert.ok(p.ok, p.ok ? '' : p.error); return p as Extract<typeof p, { ok: true }>; };
const ops = (p: { ops: OpUnificar[] }, op: OpUnificar['op']) => p.ops.filter((o) => o.op === op);

test('cuál queda: la más vieja (la que ya encuentran las respuestas de WhatsApp), salvo que la otra tenga la venta', () => {
  const p = plan(casoReal());
  assert.equal(p.queda, 249);
  assert.equal(p.previa.queda.porque, 'es la más vieja');
  assert.equal(cualQueda({ id: 5, nombre: 'a', created_at: null }, { id: 9, nombre: 'b', created_at: null, estado_lead: 'ganado' }).queda.id, 9, 'la venta gana');
  // La persona elige: «Quedarme con la otra».
  assert.equal(plan(casoReal(), 3099).queda, 3099);
  assert.equal(plan(casoReal(), 3099).previa.queda.porque, 'la elegiste');
});

test('el caso real 249/3099: su automatización, sus mensajes y su historial pasan a la que queda, y el Sprint en la etapa más adelantada', () => {
  const p = plan(casoReal());
  assert.deepEqual(ops(p, 'actualizar').find((o) => o.op === 'actualizar' && o.tabla === 'nutricion_inscripciones'), { op: 'actualizar', tabla: 'nutricion_inscripciones', id: 291, valores: { lead_id: 249 } });
  assert.deepEqual(ops(p, 'actualizar').find((o) => o.op === 'actualizar' && o.tabla === 'lead_funnel'), { op: 'actualizar', tabla: 'lead_funnel', id: 1117, valores: { etapa: 'st0' } }, 'el Sprint queda en Prospección activa');
  const movidas = ops(p, 'mover').map((o) => (o.op === 'mover' ? o.tabla : ''));
  for (const t of ['lead_audit', 'wa_mensajes', 'nutricion_envios']) assert.ok(movidas.includes(t), t);
  assert.ok(!movidas.includes('cobros'), 'una tabla vacía no se toca');
  // Los datos: lo que le falta a la que queda, de la otra; lo suyo no se pisa.
  const lead = ops(p, 'actualizar').find((o) => o.op === 'actualizar' && o.tabla === 'leads' && o.id === 249);
  assert.deepEqual(lead && lead.op === 'actualizar' ? lead.valores : null, { setter: 'MaKo', origen_lead: 'instant_form', meta_lead_id: 'M1' });
  // El id de Meta es único: se le saca a la que se va ANTES de dárselo a la que queda.
  const iSaca = p.ops.findIndex((o) => o.op === 'actualizar' && o.tabla === 'leads' && o.id === 3099);
  const iDa = p.ops.findIndex((o) => o === lead);
  assert.ok(iSaca >= 0 && iSaca < iDa);
  // Lo último: el historial y borrar la que se va.
  assert.deepEqual(p.ops.slice(-2).map((o) => o.op), ['historial', 'borrar-ficha']);
  const t = textoDeLaPrevia(p.previa);
  assert.equal(t.titulo, 'Queda «Martin Koncke» (#249) y se va «Martin Koncke» (#3099)');
  assert.ok(t.secciones.find((s) => s.titulo.startsWith('Lo que se trae'))!.lineas.some((l) => l.texto === '1 automatización'), 'el singular');
  assert.ok(p.previa.choques.some((c) => c.includes('Prospección activa')));
});

test('las dos en la misma automatización: queda una; la viva le gana a la terminada', () => {
  const l = casoReal();
  l.de[249].inscripciones = [{ id: 100, secuencia_id: 289, estado: 'completada', nombre: 'Sprint · apertura' }];
  const p = plan(l);
  // La viva es la de la que se va: se borra la terminada y la viva pasa a la que queda.
  assert.ok(p.ops.some((o) => o.op === 'borrar' && o.tabla === 'nutricion_inscripciones' && o.ids[0] === 100));
  assert.ok(p.ops.some((o) => o.op === 'actualizar' && o.tabla === 'nutricion_inscripciones' && o.id === 291 && o.valores.lead_id === 249));
  assert.ok(p.ops.some((o) => o.op === 'mover' && o.tabla === 'nutricion_envios' && o.col === 'inscripcion_id' && o.de === 100 && o.a === 291), 'sus envíos siguen con la que queda');
  // Empatadas (las dos vivas): la de la que queda.
  l.de[249].inscripciones = [{ id: 100, secuencia_id: 289, estado: 'activa', nombre: 'Sprint · apertura' }];
  const p2 = plan(l);
  assert.ok(p2.ops.some((o) => o.op === 'borrar' && o.tabla === 'nutricion_inscripciones' && o.ids[0] === 291));
  assert.ok(!p2.ops.some((o) => o.op === 'actualizar' && o.tabla === 'nutricion_inscripciones'));
});

test('la casa de la que se va pasa a ser un CRM agregado de la que queda; las etiquetas, una vez cada una', () => {
  const l = casoReal();
  l.de[249].crm = [{ funnelId: 1, crm: 'Negocio que ESCALA', etapa: 'reactivacion', etapaNombre: 'Nutrición - Reactivación', orden: 8, casa: true }];
  l.de[249].filasCrm = [];
  l.de[249].etiquetas = [{ id: 1, etiqueta_id: 7 }];
  l.de[3099].etiquetas = [{ id: 2, etiqueta_id: 7 }, { id: 3, etiqueta_id: 8 }];
  const p = plan(l);
  assert.ok(p.ops.some((o) => o.op === 'insertar' && o.tabla === 'lead_funnel' && o.fila.lead_id === 249 && o.fila.funnel_id === 44 && o.fila.etapa === 'st0'));
  assert.ok(p.ops.some((o) => o.op === 'borrar' && o.tabla === 'crm_lead_etiquetas' && o.ids.join() === '2'), 'la repetida se va');
  assert.ok(p.ops.some((o) => o.op === 'actualizar' && o.tabla === 'crm_lead_etiquetas' && o.id === 3 && o.valores.lead_id === 249), 'la que falta se muda');
});

test('si la que se va ya es cliente, no se une (y lo dice); si la cliente es la vieja, queda ella', () => {
  const l = casoReal();
  l.de[3099].deCliente = { pagos: 2 };
  // Queda la que es cliente (3099), así lo de cliente no se muda: se puede.
  assert.equal(plan(l).queda, 3099);
  // Elegir la otra: la que se va es cliente → no.
  const no = planDeUnificar(l, 249);
  assert.ok(!no.ok && /ya es cliente \(cuotas\)/.test(no.error));
  l.de[249].deCliente = { cs_clientes: 1 };
  assert.ok(!planDeUnificar(l, null).ok, 'las dos clientes: no');
});

test('los datos: de cada uno queda el de la que queda, lo que le falta lo trae, y la previa dice de cuál sale', () => {
  const { trae, lineas } = camposDeLaUnion({ id: 1, nombre: 'Ana', created_at: null, email: 'a@x.com', empresa: '' }, { id: 2, nombre: 'Ana López', created_at: null, email: 'b@x.com', empresa: 'Acme', telefono: '+1', telefono_normalizado: '1' });
  assert.deepEqual(trae, { empresa: 'Acme', telefono: '+1', telefono_normalizado: '1' }, 'el teléfono viaja con su normalizado; el nombre y el email no se pisan');
  assert.ok(lineas.some((x) => x.nombre === 'Email' && x.valor === 'a@x.com' && x.de === 'queda'));
  assert.ok(lineas.some((x) => x.nombre === 'Empresa' && x.de === 'otra'));
});

test('el bloque dice en qué CRM está la otra, desde cuándo, y ofrece «Unificar» con la confirmación', () => {
  assert.equal(dondeEnUnaLinea([{ crm: 'Sprint 3 días', etapa: 'Prospección activa', casa: true }, { crm: 'Negocio que ESCALA', etapa: null, casa: false }]), 'Sprint 3 días › Prospección activa · Negocio que ESCALA');
  assert.equal(desdeCuando('2026-10-23T04:39:00Z', 'America/Tijuana'), 'Existe desde el 22 oct 2026');
  const dup = sinComentarios('app/crm/lead-view/ficha/resumen/duplicados.tsx');
  assert.match(dup, /<Button variant="secondary" size="sm" onClick=\{\(\) => setUnificar\(x\)\}>Unificar<\/Button>/);
  assert.match(dup, /Está en \{dondeEnUnaLinea\(x\.donde\)\}/);
  const acc = sinComentarios('app/crm/lead-view/ficha/resumen/bloques-actions.ts');
  assert.match(acc, /const d = await dondeEstaLaFicha\(c\.lead\.id, cache\)/);
});

test('unificar: sólo el admin, con lo de HOY, sin pisar lo que cambió, y la que se va se borra sólo si no le cuelga nada', () => {
  const acc = sinComentarios('app/crm/unificar-actions.ts');
  assert.match(acc, /if \(\(await getRolWsEfectivo\(\)\) !== 'admin'\) return \{ ok: false, error: 'Sólo el administrador puede unificar fichas\.' \};/);
  assert.match(acc, /const plan = await planParaUnificar\(quedaId, seVaId, quedaId\);/);
  const lib = sinComentarios('lib/leads-unificar.ts');
  assert.match(lib, /if \(version\.queda !== plan\.previa\.version\.queda \|\| version\.seVa !== plan\.previa\.version\.seVa\) \{/);
  assert.match(lib, /const colgando = await quedaColgando\(db, ws, plan\.seVa\);\s*if \(colgando\.length\) throw/);
  // El script en seco no carga la escritura.
  assert.doesNotMatch(sinComentarios('scripts/unificar-en-seco.mts'), /aplicarUnificar/);
});

// Roturas (23/10/2026, base 8/0): la más vieja sin mirar la venta → 7 / 1; la terminada ganándole a la viva → 7 / 1; la
// casa de la otra sin pasar a agregada → 7 / 1; unir con la que se va cliente → 7 / 1; pisar un dato de la que queda →
// 6 / 2; el id de Meta dado antes de sacárselo a la otra → 7 / 1; borrar la ficha sin mirar lo que le cuelga → 7 / 1; las
// etiquetas repetidas sin borrar → 7 / 1.
