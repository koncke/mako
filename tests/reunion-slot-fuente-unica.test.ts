// Fija la EQUIVALENCIA del mapeo índice→R1/R2 después de unificarlo.
//
// Ese mapeo vivía copiado en tres lugares: `asist()` dentro de generateFunnel
// (lib/pipeline.ts), el filtro `kind === 'reunion'` de funnelReqInfo
// (lib/stage-requirements.ts) y lib/funnel-etapas.ts. Ahora los tres salen de
// funnel-etapas. Estos tests existen para que la unificación no haya cambiado
// NADA: cada uno lleva al lado el oráculo con la lógica VIEJA, tal cual estaba,
// y compara. Si un caso difiere es un bug, no una mejora.
//
// Este archivo importa funnel-etapas ANTES que pipeline a propósito: entre los
// dos hay un ciclo de imports (ver la cabecera de funnel-etapas.ts) y hay que
// probar los dos órdenes de carga. El otro lo cubre tests/pipeline.test.ts, que
// importa pipeline primero. Correr: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reunionesDe, etapasDeReunion, slotPorIndice, slotDeReunion } from '../lib/funnel-etapas';
import { generateFunnel, DEFAULT_PIPELINE, FUNNEL_TEMPLATES, type Stage, type FunnelTransition } from '../lib/pipeline';
import { funnelReqInfo, type PipelineStageLite } from '../lib/stage-requirements';

const pk = (key: string, kind: Stage['kind']): Stage => ({ key, label: key, dot: '#000', tone: 'neutral', kind });

// Los pipelines contra los que se corre TODO: los cuatro templates de producto
// más los bordes (3 reuniones, reuniones al revés, sin etapas).
const PIPELINES: Array<{ nombre: string; pipeline: Stage[] }> = [
  ...FUNNEL_TEMPLATES.map((t) => ({ nombre: `template ${t.id}`, pipeline: t.pipeline })),
  { nombre: 'tres reuniones', pipeline: [pk('lead', 'entrada'), pk('r1', 'reunion'), pk('r2', 'reunion'), pk('r3', 'reunion'), pk('ganado', 'cierre')] },
  { nombre: 'reuniones al revés', pipeline: [pk('lead', 'entrada'), pk('agendaj2', 'reunion'), pk('agenda', 'reunion'), pk('ganado', 'cierre')] },
  { nombre: 'pipeline vacío', pipeline: [] },
  { nombre: 'solo pasos sueltos', pipeline: [pk('a', 'paso'), pk('b', 'paso')] },
];

// ─────────────────────────────────────────────────────────────────────────────
// 1. El oráculo del `asist()` viejo de generateFunnel
// ─────────────────────────────────────────────────────────────────────────────

/** La copia que vivía en lib/pipeline.ts, textual. */
const asistViejo = (meetings: string[], mKey: string, attended: boolean): Partial<FunnelTransition> => {
  const i = meetings.findIndex((m) => m === mKey);
  return i === 0 ? { asistioJ1: attended } : i === 1 ? { asistioJ2: attended } : {};
};

/** Lo que hace hoy pipeline.ts, con las piezas de funnel-etapas. */
const asistNuevo = (meetings: string[], mKey: string, attended: boolean): Partial<FunnelTransition> => {
  const slot = slotPorIndice(meetings.indexOf(mKey));
  if (!slot) return {};
  return slot.cual === 'r1' ? { asistioJ1: attended } : { asistioJ2: attended };
};

test('asist — el mapeo nuevo devuelve lo MISMO que el viejo, etapa por etapa', () => {
  for (const { nombre, pipeline } of PIPELINES) {
    const meetings = pipeline.filter((p) => p.kind === 'reunion').map((p) => p.key);
    // Se prueban las reuniones y también las que NO lo son (tienen que dar {}).
    const claves = [...pipeline.map((p) => p.key), 'etapa-que-no-existe', ''];
    for (const k of claves) {
      for (const attended of [true, false]) {
        assert.deepEqual(asistNuevo(meetings, k, attended), asistViejo(meetings, k, attended), `${nombre} · ${k} · ${attended}`);
      }
    }
  }
});

test('asist — el índice manda: 0→R1, 1→R2, de la 3ª en adelante NADA', () => {
  const meetings = ['m0', 'm1', 'm2', 'm3'];
  assert.deepEqual(asistNuevo(meetings, 'm0', true), { asistioJ1: true });
  assert.deepEqual(asistNuevo(meetings, 'm1', false), { asistioJ2: false });
  // La tabla `leads` solo tiene fecha_junta_1/2: la R3 no tiene dónde marcarse.
  assert.deepEqual(asistNuevo(meetings, 'm2', true), {});
  assert.deepEqual(asistNuevo(meetings, 'm3', true), {});
  assert.deepEqual(asistNuevo(meetings, 'nope', true), {});
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. El funnel generado: los flags de asistencia no se movieron
// ─────────────────────────────────────────────────────────────────────────────

const flagsDe = (t: FunnelTransition) => {
  const f: Record<string, boolean> = {};
  if (t.asistioJ1 !== undefined) f.asistioJ1 = t.asistioJ1;
  if (t.asistioJ2 !== undefined) f.asistioJ2 = t.asistioJ2;
  return f;
};

/** Solo las transiciones que llevan flag, como `from>to` → flags. */
const flagsDelFunnel = (pipeline: Stage[]): Record<string, Record<string, boolean>> => {
  const out: Record<string, Record<string, boolean>> = {};
  for (const t of generateFunnel(pipeline).transitions) {
    const f = flagsDe(t);
    if (Object.keys(f).length) out[`${t.from}>${t.to}`] = f;
  }
  return out;
};

test('generateFunnel — el funnel DEFAULT marca exactamente las mismas asistencias', () => {
  // Golden escrito leyendo el generateFunnel PREVIO al refactor: agenda = R1
  // (asistioJ1), agendaj2 = R2 (asistioJ2). Si esto cambia, cambió el CRM de ws1.
  assert.deepEqual(flagsDelFunnel(DEFAULT_PIPELINE), {
    'agenda>agendaj2': { asistioJ1: true },
    'agenda>noshow_r1': { asistioJ1: false },
    'agenda>perdido': { asistioJ1: true },
    'agenda>descal': { asistioJ1: true },
    'agendaj2>facturando': { asistioJ2: true },
    'agendaj2>noshow_r2': { asistioJ2: false },
    'agendaj2>nocompro': { asistioJ2: true },
    'agendaj2>perdido': { asistioJ2: true },
    'agendaj2>descal': { asistioJ2: true },
  });
});

test('generateFunnel — un funnel de 1 reunión solo marca R1', () => {
  const simple = FUNNEL_TEMPLATES.find((t) => t.id === 'simple');
  assert.ok(simple);
  assert.deepEqual(flagsDelFunnel(simple.pipeline), {
    'agenda>ganado': { asistioJ1: true },
    'agenda>noshow_r1': { asistioJ1: false },
    'agenda>nocompro': { asistioJ1: true },
    'agenda>perdido': { asistioJ1: true },
    'agenda>descal': { asistioJ1: true },
  });
});

test('generateFunnel — la TERCERA reunión no marca nada (no hay columnas)', () => {
  const tres = PIPELINES.find((p) => p.nombre === 'tres reuniones');
  assert.ok(tres);
  const flags = flagsDelFunnel(tres.pipeline);
  for (const clave of Object.keys(flags)) {
    assert.ok(!clave.startsWith('r3>'), `la R3 no debería marcar asistencia: ${clave}`);
  }
  // Y las dos primeras sí, cada una en SU columna.
  assert.deepEqual(flags['r1>r2'], { asistioJ1: true });
  assert.deepEqual(flags['r2>r3'], { asistioJ2: true });
  assert.deepEqual(flags['r1>noshow_r1'], { asistioJ1: false });
  assert.deepEqual(flags['r2>noshow_r2'], { asistioJ2: false });
  // La R3 igual genera su nutrición, solo que sin flag.
  assert.deepEqual(generateFunnel(tres.pipeline).transitions.filter((t) => t.from === 'r3' && t.to === 'noshow_r3').map(flagsDe), [{}]);
});

test('generateFunnel — manda el ORDEN del pipeline, no el nombre de la etapa', () => {
  const alReves = PIPELINES.find((p) => p.nombre === 'reuniones al revés');
  assert.ok(alReves);
  const flags = flagsDelFunnel(alReves.pipeline);
  // 'agendaj2' está primera, así que ES la R1: marca asistioJ1.
  assert.deepEqual(flags['agendaj2>agenda'], { asistioJ1: true });
  assert.deepEqual(flags['agenda>ganado'], { asistioJ2: true });
});

test('generateFunnel — todo flag sale de una reunión, y de la que le toca', () => {
  // Propiedad general sobre TODOS los pipelines: ninguna etapa que no sea
  // reunión marca asistencia, y ninguna reunión marca la columna de otra.
  for (const { nombre, pipeline } of PIPELINES) {
    const meetings = reunionesDe(pipeline);
    for (const t of generateFunnel(pipeline).transitions) {
      const f = flagsDe(t);
      if (!Object.keys(f).length) continue;
      const i = meetings.indexOf(t.from);
      assert.ok(i >= 0, `${nombre}: ${t.from}>${t.to} marca asistencia sin ser reunión`);
      assert.deepEqual(Object.keys(f), [i === 0 ? 'asistioJ1' : 'asistioJ2'], `${nombre}: ${t.from}>${t.to} marca la columna equivocada`);
    }
  }
});

test('generateFunnel — un pipeline sin reuniones no inventa las del funnel por defecto', () => {
  // El riesgo del refactor: `etapasDeReunion` cae a DEFAULT_PIPELINE cuando no le
  // pasan funnel. generateFunnel NO puede usar esa versión — si lo hiciera, un
  // pipeline vacío heredaría firstMeeting='agenda' y aparecerían transiciones de
  // recuperación ('Recupera', 'Reagenda') hacia una etapa que no existe.
  for (const nombre of ['pipeline vacío', 'solo pasos sueltos', 'template directa']) {
    const caso = PIPELINES.find((p) => p.nombre === nombre);
    assert.ok(caso, nombre);
    const { stages, transitions } = generateFunnel(caso.pipeline);
    assert.deepEqual(reunionesDe(caso.pipeline), [], nombre);
    assert.deepEqual(flagsDelFunnel(caso.pipeline), {}, `${nombre}: nadie marca asistencia`);
    for (const t of transitions) {
      assert.ok(t.label !== 'Recupera' && t.label !== 'Reagenda', `${nombre}: ${t.from}>${t.to} "${t.label}" salió de la nada`);
      assert.ok(stages.some((s) => s.key === t.to), `${nombre}: ${t.to} no es una etapa del funnel`);
    }
  }
  // Y el contraste: con reuniones, la recuperación SÍ tiene que estar.
  assert.ok(generateFunnel(DEFAULT_PIPELINE).transitions.some((t) => t.from === 'perdido' && t.to === 'agenda'));
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. funnelReqInfo — misma cuenta que antes
// ─────────────────────────────────────────────────────────────────────────────

/** La copia que vivía en lib/stage-requirements.ts, textual (NIVEL incluido). */
const NIVEL_VIEJO: Record<string, number> = { agenda: 1, agendaj2: 3, facturando: 4, ganado: 5 };
const funnelReqInfoViejo = (pipeline: PipelineStageLite[], stageKey: string) => {
  const reuniones = pipeline.filter((s) => s.kind === 'reunion');
  const numReuniones = reuniones.length;
  const s = pipeline.find((p) => p.key === stageKey);
  if (!s) return { nivel: NIVEL_VIEJO[stageKey] ?? 0, numReuniones, esVenta: stageKey === 'ganado' };
  if (s.kind === 'reunion') return { nivel: 2 * reuniones.findIndex((r) => r.key === stageKey) + 1, numReuniones, esVenta: false };
  if (s.kind === 'pago') return { nivel: 2 * numReuniones, numReuniones, esVenta: false };
  if (s.kind === 'cierre') return { nivel: 2 * numReuniones + 1, numReuniones, esVenta: true };
  return { nivel: 0, numReuniones, esVenta: false };
};

test('funnelReqInfo — idéntico al de antes en todo pipeline y toda etapa', () => {
  // Se preguntan las etapas del pipeline MÁS las que no están en él (nutrición,
  // salidas, keys canónicas de otro funnel): ese es el camino del `if (!s)`.
  const ajenas = ['lead', 'agenda', 'agendaj2', 'facturando', 'ganado', 'nutri', 'noshow_r1', 'manual', 'perdido', 'descal', 'noresp', 'webinar', 'inventada', ''];
  for (const { nombre, pipeline } of PIPELINES) {
    for (const key of [...new Set([...pipeline.map((p) => p.key), ...ajenas])]) {
      assert.deepEqual(funnelReqInfo(pipeline, key), funnelReqInfoViejo(pipeline, key), `${nombre} · ${key}`);
    }
  }
});

test('funnelReqInfo — el funnel DEFAULT sigue dando los niveles canónicos', () => {
  assert.deepEqual(funnelReqInfo(DEFAULT_PIPELINE, 'agenda'), { nivel: 1, numReuniones: 2, esVenta: false });
  assert.deepEqual(funnelReqInfo(DEFAULT_PIPELINE, 'agendaj2'), { nivel: 3, numReuniones: 2, esVenta: false });
  assert.deepEqual(funnelReqInfo(DEFAULT_PIPELINE, 'facturando'), { nivel: 4, numReuniones: 2, esVenta: false });
  assert.deepEqual(funnelReqInfo(DEFAULT_PIPELINE, 'ganado'), { nivel: 5, numReuniones: 2, esVenta: true });
});

test('funnelReqInfo y el funnel generado hablan del MISMO orden de reuniones', () => {
  // Los dos módulos leen el pipeline; lo que se blinda acá es que el nivel de la
  // reunión N y el flag que marca el funnel para la reunión N sean la misma N.
  for (const { nombre, pipeline } of PIPELINES) {
    reunionesDe(pipeline).forEach((key, i) => {
      assert.equal(funnelReqInfo(pipeline, key).nivel, 2 * i + 1, `${nombre} · ${key}`);
      const slot = slotDeReunion(pipeline, key);
      assert.equal(slot?.indice, i < 2 ? i : undefined, `${nombre} · ${key}`);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. El módulo dueño tiene que poder cargarse en el cliente
// ─────────────────────────────────────────────────────────────────────────────

test('el trío se puede importar desde el cliente (nadie trae server-only)', () => {
  // lib/pipeline.ts NO lleva 'server-only' a propósito: lo importa CrmBoard. Al
  // pasar a depender de funnel-etapas (y stage-requirements de los dos), la
  // cadena entera tiene que seguir siendo client-safe. Lo único que toca
  // lib/leads.ts —que sí es server-only— es un `import type`, que TS borra.
  for (const f of ['lib/pipeline.ts', 'lib/funnel-etapas.ts', 'lib/stage-requirements.ts']) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    assert.ok(!/^import\s+['"]server-only['"]/m.test(src), `${f} no puede importar server-only`);
    for (const [, binding, mod] of src.matchAll(/^import\s+([^;]*?)\s*from\s*'([^']+)';/gm)) {
      if (mod !== './leads') continue;
      assert.ok(binding.startsWith('type '), `${f}: './leads' es server-only — solo entra con 'import type' (era: import ${binding})`);
    }
  }
});

test('el ciclo pipeline ⇄ funnel-etapas resiste este orden de carga', () => {
  // Este archivo importa funnel-etapas ANTES que pipeline (ver la cabecera). Si
  // alguno de los dos pasara a usar al otro durante la evaluación del módulo,
  // acá aparecería un undefined. El orden inverso lo cubre pipeline.test.ts.
  assert.deepEqual(etapasDeReunion(null), ['agenda', 'agendaj2'], 'DEFAULT_PIPELINE llegó vacío: el ciclo se evaluó mal');
  assert.ok(generateFunnel(DEFAULT_PIPELINE).transitions.length > 0);
});
