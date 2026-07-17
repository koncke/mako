// =============================================================================
// retro-pipeline — generación v3 de la Retro (8 fases + cerebro organizador)
// =============================================================================
// El proceso acordado con Martín:
//   0 Memoria        — retro anterior + destino de su plan (seguimiento)
//   1 Recolección    — fuentes de texto + datos estructurados por área
//   2 Auditoría      — cobertura de datos (huecos de medición)
//   3 Diagnóstico    — hallazgos candidatos por área (en PARALELO)
//   4 Cruces         — hallazgos que cruzan dos áreas (1 ronda, acotado)
//   5 Cerebro        — prioriza, arma la tesis/fuga, selecciona hallazgos y
//                      encadena el plan (Experiment + tareas "para poder probarlo")
//   6 Verificación   — chequea números citados contra el dato; descarta lo no
//                      soportado
//   7 Redacción      — compone el RetroReporte final y lo persiste
//
// Reglas duras: la EVIDENCIA de cada hallazgo se construye SOLO con números que
// el código midió (datos de retro-datos); el cerebro selecciona y edita texto,
// nunca inventa evidencia. Siempre profundidad máxima.
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import { chatClaude } from './anthropic';
import { getPromptText } from './prompt-render';
import { calcularDestacados, type Retro, type RetroDestacado } from './retro';
import { recolectarFuentes, type AreaKey, type Fuente } from './retro-fuentes';
import { recolectarDatos, type RetroDatos } from './retro-datos';
import { crearExperimento, listExperimentos, metricaDef } from './experimentos';
import { crearTarea, crearTareasDesde, listTareas, listTareasDeRetro, type Prioridad } from './todo';
import { puntuarPlan } from './mako-guardian';
import { prioFromScore } from '../app/plan/board/types';
import { seguimientoDeItem } from './retro-seguimiento';
import {
  RETRO_FASES,
  type AreaId, type Evidencia, type RetroCoberturaItem, type RetroFaseId, type RetroFinding,
  type RetroPlanItem, type RetroReporte, type RetroSeguimientoItem, type RetroStreamEvent,
  type SaludArea, type ToolId,
} from './retro-reporte';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const AREA_NOMBRE: Record<AreaId, string> = {
  adquisicion: 'Adquisición', nutricion: 'Nutrición', conversion: 'Conversión',
  creativos: 'Creativos', revenue: 'Revenue', experimentos: 'Experiments',
};
const AREA_TOOL: Record<AreaId, ToolId> = {
  adquisicion: 'market', nutricion: 'crm', conversion: 'closing',
  creativos: 'script', revenue: 'graphics', experimentos: 'graphics',
};
const AREA_TAB: Record<AreaId, string> = {
  adquisicion: 'Marketing', nutricion: 'CRM', conversion: 'Closing Analyst',
  creativos: 'Script Analyst', revenue: 'Graphics', experimentos: 'Experiments',
};
// Ícono de cada tab en el rail de la ejecución (claves de app/_components/icons.tsx).
const AREA_ICON: Record<AreaId, string> = {
  adquisicion: 'ads', nutricion: 'crm', conversion: 'closing',
  creativos: 'notepencil', revenue: 'graphics', experimentos: 'experiments',
};

function parseJson<T>(text: string): T {
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const s = cleaned.indexOf('{');
  const e = cleaned.lastIndexOf('}');
  if (s === -1 || e <= s) throw new Error('respuesta sin JSON');
  return JSON.parse(cleaned.slice(s, e + 1)) as T;
}

const str = (v: unknown, max = 400): string => String(v ?? '').trim().slice(0, max);
const numOrNull = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fb: T): T =>
  (typeof v === 'string' && (allowed as readonly string[]).includes(v)) ? (v as T) : fb;

/** Sanea una evidencia devuelta por MaKo al contrato (o null si no cumple). */
function sanearEv(j: unknown): Evidencia | null {
  if (!j || typeof j !== 'object') return null;
  const o = j as Record<string, unknown>;
  const tones = ['good', 'bad', 'warn', 'blue', 'gris'] as const;
  if (o.type === 'num' && o.value != null) {
    return { type: 'num', value: str(o.value, 24), label: str(o.label, 90), tone: oneOf(o.tone, tones, 'blue') };
  }
  if (o.type === 'bars' && Array.isArray(o.rows)) {
    const rows = (o.rows as Array<Record<string, unknown>>).slice(0, 4).map((r) => ({
      label: str(r.label, 60), val: str(r.val, 24),
      pct: Math.max(2, Math.min(100, Math.round(Number(r.pct) || 0))),
      strong: !!r.strong,
      tone: oneOf(r.tone, [...tones, 'gray'] as const, 'gray'),
    })).filter((r) => r.label && r.val);
    return rows.length >= 1 ? { type: 'bars', rows } : null;
  }
  if (o.type === 'spark' && Array.isArray(o.vals)) {
    const vals = (o.vals as unknown[]).map(Number).filter(Number.isFinite).slice(0, 12);
    return vals.length >= 3 ? { type: 'spark', vals, tone: oneOf(o.tone, tones, 'warn'), note: str(o.note, 60) } : null;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompts (defaults editables)
// ─────────────────────────────────────────────────────────────────────────────

export const RETRO3_AREA_SYSTEM = `Sos MaKo diagnosticando UN área del negocio de Martín para una retrospectiva. Te paso el resumen del área y sus NÚMEROS medidos (JSON "datos" — la única fuente de verdad numérica).

Devolvé 1 a 3 hallazgos del área. Cada uno:
- "tipo": "hallazgo" (lectura del dato) o "anomalia" (algo raro/urgente que pide acción).
- "short": UNA línea para la card, con el número adentro. Directa, sin relleno.
- "insight": 1-2 líneas para el modal: qué significa y dónde está la palanca. Causa-efecto SIEMPRE como hipótesis.
- "ev": la evidencia VISUAL, construida SOLO con números presentes en "datos" (no inventes ni redondees de más):
    {"type":"num","value":"$9.2","label":"CPL, ↓22% en el período","tone":"good|bad|warn|blue"}
  o {"type":"bars","rows":[{"label":"...","val":"34%","pct":100,"strong":true,"tone":"bad"},{"label":"resto","val":"12%","pct":35,"tone":"gray"}]}
  o {"type":"spark","vals":[2.1,2.3,2.6,2.9],"tone":"warn","note":"frecuencia, semanal"}.
- "source": de dónde sale ("Meta Ads · período").

Si el área está sana y sin nada notable, devolvé menos hallazgos (o ninguno). NO fabriques problemas.
Devolvé SOLO: {"findings":[...]}`;

export const RETRO3_CRUCES_SYSTEM = `Sos MaKo buscando CRUCES entre áreas del negocio de Martín: insights que NINGUNA pestaña muestra sola (ej.: los leads nutridos cierran X veces más; el guion ganador explica el CPL; el no-show se concentra en un anuncio).

Te paso los números de TODAS las áreas (JSON "datos", la única fuente numérica) y los hallazgos por área. Devolvé 2 a 4 cruces de ALTO valor. Cada uno:
- "cross": "Área A × Área B" (nombres cortos).
- "area": el área principal afectada ("adquisicion|nutricion|conversion|creativos|revenue").
- "short", "insight", "ev", "source": mismas reglas que un hallazgo — la evidencia SOLO con números presentes en "datos". Si un cruce que te gustaría hacer no tiene los números, NO lo inventes: descartalo.
Devolvé SOLO: {"findings":[...]}`;

export const RETRO3_CEREBRO_SYSTEM = `Sos el CEREBRO organizador de la retrospectiva de MaKo. Te paso todo lo recolectado: dato duro, hallazgos candidatos (con id), cruces, cobertura de datos, seguimiento del retro pasado y la perspectiva de Martín (si dejó una — es SU hipótesis, contrastala, no la asumas).

Tu trabajo: decidir qué mueve la aguja y componer el reporte.
1) "titulo": título-tesis corto para la lista (ej. "El frente compra barato; el embudo pierde por dos agujeros").
2) "tesis": {"texto": 1-3 frases que cuentan LA historia del período con números, "highlight": la subcadena más crítica del texto (cópiala EXACTA)}. Sin relleno.
3) "fuga": el problema principal EN PLATA si se puede estimar desde los números: {"valor":"$18k","unidad":"por período","titulo":"El problema principal, en plata","texto":"1-2 frases con el cálculo"}; si no hay estimación honesta, null.
4) "areas": para CADA área analizada: {"id","st":"good|warn|bad|gris","line": una línea con su número}. "gris" = datos insuficientes.
5) "keep": los ids de los hallazgos/cruces que VALEN la pena mostrar (descartá los flojos), ordenados de más a menos importante.
6) "edits": opcional, por id: {"short"?:..., "insight"?:...} si podés decirlo mejor (NO toques la evidencia).
7) "plan": 3 a 7 items priorizados. Cada uno:
   {"kind":"exp"|"tarea", "titulo": imperativo y concreto, "why": por qué (con el número), "impacto": estimación honesta ("~$18k/período","~7 cierres","habilita 3 cruces"), "origen":"Nace del cruce X × Y"|"Nace del hallazgo: ...", "findingId": id del hallazgo del que nace (si aplica), "prio":"alta|media|baja" (solo tareas), "destacado": true SOLO en el item más importante,
    si kind=exp: "chain": 1-3 tareas CONCRETAS necesarias para poder correr el experimento (ej. "Grabar el VSL nuevo con el hook en 5 s"), y "experimento": {"hipotesis","cambio","metrica": key del catálogo,"direccion":"subir|bajar","objetivo_valor":number|null,"criterio_exito","ventana_dias":7-30};
    si kind=tarea: "detalle": qué hacer exactamente.
   Los huecos de cobertura importantes también son tareas (medí lo que falta).
NUNCA un experimento sin su "chain". No repitas experimentos ya en curso. Todo en español rioplatense, sin Title Case.
CATÁLOGO DE MÉTRICAS (keys válidas para "experimento.metrica"):
{{catalogo}}
Devolvé SOLO el JSON: {"titulo","tesis","fuga","areas","keep","edits","plan"}.`;

export const RETRO3_VERIF_SYSTEM = `Sos el VERIFICADOR de la retrospectiva de MaKo. Te paso los NÚMEROS medidos (JSON "datos", única fuente de verdad) y el borrador del reporte (tesis, fuga, hallazgos con short/insight, plan con impactos).

Marcá SOLO problemas reales:
- un número citado que NO sale de "datos" (ni por redondeo razonable ni por cálculo simple entre dos números presentes),
- una afirmación causa-efecto presentada como verdad (debe ser hipótesis),
- un experimento del plan sin tareas encadenadas ("chain").
Devolvé SOLO: {"drop":[ids de hallazgos a eliminar], "fixes":[{"id","short"?,"insight"?}] para corregir texto citando bien, "tesis"?: texto corregido si la tesis citaba mal, "planDrop":[ids de items del plan sin sustento]}. Si está todo bien: {"drop":[],"fixes":[],"planDrop":[]}.`;

// ─────────────────────────────────────────────────────────────────────────────
// Fase 0 — memoria: seguimiento del retro anterior (código puro)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El Perro Guardián le pone la prioridad a las tareas que la Retro está por meter
 * al tablero. Antes iban con 'alta' CLAVADA, y eso hacía de la Retro el único
 * productor de tareas del sistema que se salteaba el filtro que existe justamente
 * para que el tablero no se llene: la regla de oro del Perro es la pirámide ("como
 * mucho ~15% en Alta"), y la Retro la rompía de entrada, en lote y cada semana.
 *
 * Puntúa comparando contra las tareas ABIERTAS del tablero — un score sin con qué
 * compararse no significa nada, y es lo que el propio prompt del Perro exige.
 *
 * Best-effort a propósito: si el Perro falla, las tareas entran igual en 'media'.
 * Perder la priorización es aceptable; perder la tarea que aceptaste, no.
 */
async function prioridadesDelPerro(titulos: string[], contexto: string): Promise<Prioridad[]> {
  const fallback = (): Prioridad[] => titulos.map(() => 'media');
  try {
    const abiertas = (await listTareas()).filter((t) => t.progreso < 100).slice(0, 60);
    const out = await puntuarPlan(
      [],
      [
        ...abiertas.map((t) => ({ id: `b${t.id}`, titulo: t.titulo, detalle: t.detalle ?? '', avance: t.progreso })),
        ...titulos.map((titulo, i) => ({ id: `n${i}`, titulo, detalle: `Tarea para poder probar: ${contexto}` })),
      ],
      'Las tareas "n…" son las que la Retro quiere agregar para poder correr un experimento. Puntualas comparándolas contra lo que ya está en el tablero.',
      'Retro: prioridad de las tareas del experimento',
    );
    // Solo se usan los scores de las tareas NUEVAS: re-priorizar el tablero entero
    // sin que el usuario lo pida sería MaKo ejecutando solo.
    const prios = titulos.map((_, i) => {
      const s = out.tareas.find((x) => x.id === `n${i}`);
      return s ? prioFromScore(s.score) : 'media';
    });
    return prios;
  } catch { return fallback(); }
}

/**
 * El destino REAL del plan de la última retro + cuándo se corrió. Exportada porque
 * el gate (lib/retro-gate.ts) necesita exactamente lo mismo que la fase Memoria:
 * qué prometiste y qué hiciste. Una sola fuente para las dos cosas.
 */
export async function seguimientoUltimaRetro(): Promise<{ items: RetroSeguimientoItem[]; corridaISO: string | null }> {
  try {
    const supabase = await getTenantDb();
    const { data } = await supabase.from('retros').select('*').not('reporte', 'is', null)
      .order('created_at', { ascending: false }).limit(1);
    const prev = data && data[0] ? (data[0] as unknown as Retro) : null;
    if (!prev) return { items: [], corridaISO: null };
    const plan = prev.reporte?.plan ?? [];
    if (!plan.length) return { items: [], corridaISO: prev.created_at ?? null };
    const [exps, tareasPrev] = await Promise.all([
      listExperimentos().catch(() => []),
      listTareasDeRetro(prev.id).catch(() => []),
    ]);
    return { items: plan.map((item) => seguimientoDeItem(item, exps, tareasPrev)), corridaISO: prev.created_at ?? null };
  } catch { return { items: [], corridaISO: null }; }
}

async function armarSeguimiento(): Promise<RetroSeguimientoItem[]> {
  try {
    const supabase = (await getTenantDb());
    const { data } = await supabase.from('retros').select('*').not('reporte', 'is', null)
      .order('created_at', { ascending: false }).limit(1);
    const prev = data && data[0] ? (data[0] as unknown as Retro) : null;
    const plan = prev?.reporte?.plan ?? [];
    if (!plan.length) return [];

    const [exps, tareasPrev] = await Promise.all([
      listExperimentos().catch(() => []),
      prev?.id != null ? listTareasDeRetro(prev.id).catch(() => []) : Promise.resolve([]),
    ]);
    return plan.slice(0, 6).map((item) => seguimientoDeItem(item, exps, tareasPrev));
  } catch { return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fases 3-4 — diagnóstico por área + cruces
// ─────────────────────────────────────────────────────────────────────────────

type Candidato = Omit<RetroFinding, 'id'> & { id?: string };

function normalizarFinding(j: Record<string, unknown>, area: AreaId, esCruce: boolean): Candidato | null {
  const ev = sanearEv(j.ev);
  const short = str(j.short, 160);
  if (!ev || !short) return null;
  return {
    tipo: esCruce ? 'cruce' : (j.tipo === 'anomalia' ? 'anomalia' : 'hallazgo'),
    area,
    tool: esCruce ? 'crosses' : AREA_TOOL[area],
    cross: esCruce ? str(j.cross, 60) || undefined : undefined,
    ev,
    short,
    insight: str(j.insight, 320) || short,
    source: str(j.source, 80) || AREA_TAB[area],
    tab: AREA_TAB[area],
  };
}

async function diagnosticarArea(f: Fuente, datosArea: unknown, perspectiva: string): Promise<Candidato[]> {
  try {
    const system = await getPromptText('retro3.area.system', RETRO3_AREA_SYSTEM);
    const user = `${f.texto}\n\ndatos (única fuente numérica):\n${JSON.stringify(datosArea ?? {})}\n${perspectiva}`;
    const raw = await chatClaude(system, [{ role: 'user', content: user }], { feature: 'experimentos', effort: 'high' });
    const j = parseJson<{ findings?: Array<Record<string, unknown>> }>(raw);
    return (j.findings ?? []).slice(0, 3)
      .map((x) => normalizarFinding(x, f.area as AreaId, false))
      .filter((x): x is Candidato => x != null);
  } catch { return []; }
}

async function buscarCruces(fuentes: Fuente[], datos: RetroDatos, candidatos: Candidato[], perspectiva: string): Promise<Candidato[]> {
  try {
    const system = await getPromptText('retro3.cruces.system', RETRO3_CRUCES_SYSTEM);
    const hallazgosTxt = candidatos.map((c) => `- [${c.area}] ${c.short}`).join('\n') || '(ninguno)';
    const user = `datos (única fuente numérica):\n${JSON.stringify(datos.datos)}\n\nHALLAZGOS POR ÁREA:\n${hallazgosTxt}\n\nRESÚMENES:\n${fuentes.map((f) => f.texto).join('\n\n')}\n${perspectiva}`;
    const raw = await chatClaude(system, [{ role: 'user', content: user }], { feature: 'experimentos', effort: 'xhigh' });
    const j = parseJson<{ findings?: Array<Record<string, unknown>> }>(raw);
    return (j.findings ?? []).slice(0, 4)
      .map((x) => {
        const area = oneOf(x.area, ['adquisicion', 'nutricion', 'conversion', 'creativos', 'revenue', 'experimentos'] as const, 'adquisicion');
        return normalizarFinding(x, area, true);
      })
      .filter((x): x is Candidato => x != null);
  } catch { return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fase 5 — cerebro organizador
// ─────────────────────────────────────────────────────────────────────────────

type CerebroOut = {
  titulo: string;
  tesis: { texto: string; highlight?: string };
  fuga: RetroReporte['fuga'];
  areas: RetroReporte['areas'];
  findings: RetroFinding[];
  plan: RetroPlanItem[];
};

async function organizar(
  destacadosTxt: string, candidatos: RetroFinding[], datos: RetroDatos,
  cobertura: RetroCoberturaItem[], seguimiento: RetroSeguimientoItem[],
  areasAnalizadas: AreaId[], perspectiva: string,
): Promise<CerebroOut> {
  const { METRICAS } = await import('./experimentos');
  const catalogo = METRICAS.map((m) => `- ${m.key} — ${m.label}`).join('\n');
  const system = (await getPromptText('retro3.cerebro.system', RETRO3_CEREBRO_SYSTEM)).split('{{catalogo}}').join(catalogo);

  const enCurso = (await listExperimentos().catch(() => [])).filter((e) => e.estado === 'activo')
    .map((e) => `- ${e.titulo}`).join('\n') || '(ninguno)';

  const user = [
    `ÁREAS ANALIZADAS: ${areasAnalizadas.map((a) => AREA_NOMBRE[a]).join(', ')}`,
    `DATO DURO:\n${destacadosTxt}`,
    `HALLAZGOS CANDIDATOS:\n${JSON.stringify(candidatos.map(({ id, tipo, area, cross, short, insight, ev }) => ({ id, tipo, area, cross, short, insight, ev })))}`,
    `NÚMEROS POR ÁREA:\n${JSON.stringify(datos.datos)}`,
    `COBERTURA (huecos de medición):\n${cobertura.map((c) => `- ${c.label}`).join('\n') || '(sin huecos)'}`,
    `SEGUIMIENTO DEL RETRO PASADO:\n${seguimiento.map((s) => `- [${s.estado}] ${s.title} → ${s.fx}`).join('\n') || '(primer retro)'}`,
    `EXPERIMENTOS YA EN CURSO (no los repitas):\n${enCurso}`,
    perspectiva,
  ].join('\n\n');

  const raw = await chatClaude(system, [{ role: 'user', content: user }], { feature: 'experimentos', effort: 'xhigh', maxTokens: 24000 });
  const j = parseJson<Record<string, unknown>>(raw);

  // Selección + edición de hallazgos (la evidencia NO se toca). Dedupe: el
  // modelo puede repetir un id y duplicaría cards/keys en el reporte.
  const porId = new Map(candidatos.map((c) => [c.id, c] as const));
  const keep = Array.from(new Set(Array.isArray(j.keep) ? (j.keep as unknown[]).map(String) : candidatos.map((c) => c.id)));
  const edits = (j.edits && typeof j.edits === 'object' ? j.edits : {}) as Record<string, { short?: unknown; insight?: unknown }>;
  const findings: RetroFinding[] = keep
    .map((id) => porId.get(id))
    .filter((c): c is RetroFinding => c != null)
    .map((c) => ({
      ...c,
      short: edits[c.id]?.short ? str(edits[c.id].short, 160) : c.short,
      insight: edits[c.id]?.insight ? str(edits[c.id].insight, 320) : c.insight,
    }));

  // Plan
  const planRaw = Array.isArray(j.plan) ? (j.plan as Array<Record<string, unknown>>) : [];
  const plan: RetroPlanItem[] = planRaw.slice(0, 8).map((p, i): RetroPlanItem | null => {
    const kind = p.kind === 'tarea' ? 'tarea' as const : 'exp' as const;
    const titulo = str(p.titulo, 160);
    if (!titulo) return null;
    const item: RetroPlanItem = {
      id: `p${i + 1}`, kind,
      destacado: !!p.destacado,
      prio: kind === 'tarea' ? oneOf(p.prio, ['alta', 'media', 'baja'] as const, 'media') : undefined,
      origen: str(p.origen, 120) || 'Nace del análisis del período',
      titulo,
      why: str(p.why, 300),
      impacto: str(p.impacto, 60) || '—',
      chain: Array.isArray(p.chain) ? (p.chain as unknown[]).map((c) => str(c, 120)).filter(Boolean).slice(0, 3) : undefined,
    };
    if (kind === 'exp') {
      const e = (p.experimento ?? {}) as Record<string, unknown>;
      const metrica = metricaDef(String(e.metrica)) ? String(e.metrica) : 'cpl';
      item.experimento = {
        hipotesis: str(e.hipotesis, 240) || item.why,
        cambio: str(e.cambio, 240) || item.titulo,
        metrica,
        direccion: oneOf(e.direccion, ['subir', 'bajar'] as const, metricaDef(metrica)!.mejor),
        objetivo_valor: numOrNull(e.objetivo_valor),
        criterio_exito: str(e.criterio_exito, 200),
        ventana_dias: Math.max(3, Math.min(90, Math.round(numOrNull(e.ventana_dias) ?? 14))),
      };
      if (!item.chain || !item.chain.length) item.chain = ['Definir el cambio concreto a probar'];
    } else {
      item.tarea = { detalle: str(p.detalle, 300) || item.why };
    }
    const fid = str(p.findingId, 12);
    if (fid && porId.has(fid)) {
      const f = findings.find((x) => x.id === fid);
      if (f) f.recId = item.id;
    }
    return item;
  }).filter((x): x is RetroPlanItem => x != null);

  // Áreas (semáforo)
  const areasRaw = Array.isArray(j.areas) ? (j.areas as Array<Record<string, unknown>>) : [];
  const areas: RetroReporte['areas'] = areasAnalizadas.map((id) => {
    const a = areasRaw.find((x) => x.id === id);
    return {
      id, name: AREA_NOMBRE[id],
      st: oneOf<SaludArea>(a?.st, ['good', 'warn', 'bad', 'gris'], 'gris'),
      line: str(a?.line, 110) || 'sin lectura',
    };
  });

  const tesisO = (j.tesis ?? {}) as Record<string, unknown>;
  const fugaO = j.fuga && typeof j.fuga === 'object' ? j.fuga as Record<string, unknown> : null;
  return {
    titulo: str(j.titulo, 160) || 'Retro del período',
    tesis: { texto: str(tesisO.texto, 500) || 'Sin tesis.', highlight: str(tesisO.highlight, 160) || undefined },
    fuga: fugaO && fugaO.valor ? {
      valor: str(fugaO.valor, 16), unidad: str(fugaO.unidad, 24) || 'por período',
      titulo: str(fugaO.titulo, 60) || 'El problema principal, en plata', texto: str(fugaO.texto, 300),
    } : undefined,
    areas, findings, plan,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fase 6 — verificación
// ─────────────────────────────────────────────────────────────────────────────

async function verificar(out: CerebroOut, datos: RetroDatos): Promise<CerebroOut> {
  try {
    const system = await getPromptText('retro3.verificacion.system', RETRO3_VERIF_SYSTEM);
    const borrador = {
      tesis: out.tesis.texto, fuga: out.fuga?.texto ?? null,
      findings: out.findings.map((f) => ({ id: f.id, short: f.short, insight: f.insight })),
      plan: out.plan.map((p) => ({ id: p.id, kind: p.kind, titulo: p.titulo, impacto: p.impacto, chain: p.chain ?? null })),
    };
    const raw = await chatClaude(system,
      [{ role: 'user', content: `datos:\n${JSON.stringify(datos.datos)}\n\nborrador:\n${JSON.stringify(borrador)}` }],
      { feature: 'experimentos', effort: 'high' });
    const j = parseJson<{ drop?: unknown[]; fixes?: Array<Record<string, unknown>>; tesis?: unknown; planDrop?: unknown[] }>(raw);

    const drop = new Set((j.drop ?? []).map(String));
    const planDrop = new Set((j.planDrop ?? []).map(String));
    const fixes = new Map((j.fixes ?? []).map((f) => [String(f.id), f] as const));

    const plan = out.plan.filter((p) => !planDrop.has(p.id));
    // Limpia los recId que apuntaban a items del plan dropeados (referencia colgante).
    const planIds = new Set(plan.map((p) => p.id));
    const findings = out.findings.filter((f) => !drop.has(f.id)).map((f) => {
      const fix = fixes.get(f.id);
      const base = fix ? { ...f, short: fix.short ? str(fix.short, 160) : f.short, insight: fix.insight ? str(fix.insight, 320) : f.insight } : f;
      return base.recId && !planIds.has(base.recId) ? { ...base, recId: undefined } : base;
    });
    // La tesis corregida solo se acepta como string (o {texto}) — nunca "[object Object]".
    const tesisTxt = typeof j.tesis === 'string' ? j.tesis
      : (j.tesis && typeof j.tesis === 'object' && typeof (j.tesis as Record<string, unknown>).texto === 'string') ? (j.tesis as Record<string, unknown>).texto as string : null;
    const tesis = tesisTxt && tesisTxt.trim() ? { ...out.tesis, texto: str(tesisTxt, 500) } : out.tesis;
    return { ...out, findings, plan, tesis };
  } catch { return out; } // si la verificación falla, seguimos con el borrador
}

// ─────────────────────────────────────────────────────────────────────────────
// El pipeline completo
// ─────────────────────────────────────────────────────────────────────────────

export type OpcionesRetroV3 = { perspectiva?: string; areas?: AreaKey[] };

export async function generarRetroV3(
  desde: string, hasta: string, opts: OpcionesRetroV3 = {}, emit?: (e: RetroStreamEvent) => void,
): Promise<Retro> {
  const proceso: Array<{ fase: string; label: string }> = [];
  const send = (e: RetroStreamEvent) => { try { emit?.(e); } catch { /* stream cerrado */ } };
  const step = (fase: RetroFaseId, label: string, tab?: string, hallazgo?: string) => {
    proceso.push({ fase, label });
    send({ t: 'step', fase, label, tab, hallazgo });
  };
  const fase = (f: RetroFaseId) => send({ t: 'fase', fase: f });

  // Filtrar áreas inválidas (un POST manual con strings desconocidos ensuciaría
  // el reporte con name undefined); vacío o todo inválido → todas.
  const validas = (opts.areas ?? []).filter((a): a is AreaId => a in AREA_NOMBRE);
  const pedidas = validas.length ? validas : (Object.keys(AREA_NOMBRE) as AreaId[]);
  const areasEff = Array.from(new Set<AreaId>([...pedidas, 'experimentos']));
  const perspectiva = opts.perspectiva && opts.perspectiva.trim()
    ? `\nPERSPECTIVA DE MARTÍN (su hipótesis, puede estar equivocada — contrastala con el dato, NO la asumas): "${opts.perspectiva.trim()}"`
    : '';
  const t0 = Date.now();

  // LATIDOS: durante las llamadas largas a Claude, emite sub-pasos rotativos cada
  // ~9s. El loader nunca queda inmóvil y el stream nunca queda idle (algunos
  // proxies cortan streams silenciosos). No se guardan en `proceso` (son pulso,
  // no pasos reales).
  const latidos = (fase: RetroFaseId, labels: string[]): (() => void) => {
    let i = 0;
    const id = setInterval(() => { send({ t: 'step', fase, label: labels[i++ % labels.length] }); }, 9000);
    return () => clearInterval(id);
  };

  send({ t: 'plan', fases: RETRO_FASES, tabs: areasEff.map((a) => ({ id: a, label: AREA_TAB[a], icon: AREA_ICON[a] })) });

  // 0 · Memoria
  fase('memoria');
  step('memoria', 'Leyendo el retro anterior y su plan…');
  const seguimiento = await armarSeguimiento();

  // 1 · Recolección (texto + datos en paralelo) — los pasos nombran la TAB real.
  fase('recoleccion');
  step('recoleccion', 'Midiendo el funnel del período…');
  const [{ destacados }, fuentes, datos] = await Promise.all([
    calcularDestacados(desde, hasta),
    recolectarFuentes(desde, hasta, { profundidad: 'profunda', areas: areasEff as AreaKey[] },
      (p) => { const tab = AREA_TAB[p.area as AreaId] ?? p.label; step('recoleccion', `Leyendo la tab ${tab}…`, tab); }).catch(() => [] as Fuente[]),
    recolectarDatos(desde, hasta).catch((): RetroDatos => ({ charts: {}, datos: {}, cobertura: [] })),
  ]);

  // 2 · Auditoría
  fase('auditoria');
  step('auditoria', 'Auditando qué falta medir…');
  const cobertura = datos.cobertura;
  for (const c of cobertura) step('auditoria', `Hueco: ${c.label}`);

  // 3 · Diagnóstico por área (paralelo) — con latidos mientras piensan las áreas.
  fase('diagnostico');
  const stopDiag = latidos('diagnostico', [
    'Leyendo los números área por área…',
    'Comparando contra el período anterior…',
    'Anotando lo que se sale de lo normal…',
  ]);
  let porArea: Candidato[][];
  try {
    porArea = await Promise.all(fuentes.map(async (f) => {
      const tab = AREA_TAB[f.area as AreaId] ?? f.label;
      step('diagnostico', `Sacando insights de ${tab}…`, tab);
      const res = await diagnosticarArea(f, datos.datos[f.area as AreaId], perspectiva);
      if (res[0]) step('diagnostico', `${tab}: ${res[0].short}`, tab, res[0].short);
      return res;
    }));
  } finally { stopDiag(); } // sin finally, un throw dejaría el interval vivo hasta el timeout
  let candidatos: RetroFinding[] = porArea.flat().map((c, i) => ({ ...c, id: `f${i + 1}` } as RetroFinding));

  // 4 · Cruces (1 ronda, acotado)
  fase('cruces');
  step('cruces', 'Cruzando datos entre áreas…');
  const stopCruces = latidos('cruces', [
    'Cruzando nutrición con conversión…',
    'Cruzando guiones con el costo por lead…',
    'Buscando lo que ninguna tab muestra sola…',
  ]);
  let cruces: Candidato[];
  try { cruces = await buscarCruces(fuentes, datos, candidatos, perspectiva); } finally { stopCruces(); }
  const base = candidatos.length;
  candidatos = candidatos.concat(cruces.map((c, i) => ({ ...c, id: `f${base + i + 1}` } as RetroFinding)));
  for (const c of cruces.slice(0, 2)) step('cruces', `Cruce: ${c.short}`, 'Cruces', c.short);

  // 5 · Cerebro organizador (la llamada más larga: latidos sí o sí)
  fase('cerebro');
  step('cerebro', 'Priorizando qué mueve la aguja…');
  const stopCerebro = latidos('cerebro', [
    'Puntuando cada hallazgo…',
    'Buscando el cuello del embudo…',
    'Estimando el impacto en plata…',
    'Encadenando el plan: experimentos → tareas…',
    'Eligiendo qué mueve la aguja…',
  ]);
  const destacadosTxt = destacados.map((d: RetroDestacado) =>
    `- ${d.label}: ${d.valor}${d.delta != null ? ` (${d.delta > 0 ? '+' : ''}${d.delta.toFixed(1)}% vs anterior)` : ''}`).join('\n');
  let out: CerebroOut;
  try { out = await organizar(destacadosTxt, candidatos, datos, cobertura, seguimiento, areasEff, perspectiva); } finally { stopCerebro(); }

  // 6 · Verificación — con presupuesto: si vamos justos con el límite de la
  // función (Vercel), publicamos el borrador del cerebro antes que morir sin nada.
  fase('verificacion');
  if (Date.now() - t0 < 500_000) {
    step('verificacion', 'Verificando cada número citado…');
    const stopVerif = latidos('verificacion', [
      'Chequeando cada número contra la fuente…',
      'Descartando lo que no tiene sustento…',
    ]);
    try { out = await verificar(out, datos); } finally { stopVerif(); }
  } else {
    step('verificacion', 'Sin margen de tiempo: se publica el borrador del cerebro sin la doble verificación.');
  }

  // 7 · Redacción + guardado
  fase('redaccion');
  step('redaccion', 'Componiendo el reporte…');
  const reporte: RetroReporte = {
    version: 3,
    tesis: out.tesis,
    fuga: out.fuga,
    areas: out.areas,
    findings: out.findings,
    plan: out.plan,
    seguimiento,
    cobertura,
    charts: datos.charts,
    proceso,
  };

  const supabase = (await getTenantDb());
  const { data, error } = await supabase.from('retros').insert({
    periodo_desde: desde,
    periodo_hasta: hasta,
    titulo: out.titulo,
    resumen: out.tesis.texto,
    destacados,
    recomendaciones: null,
    snapshot: { desde, hasta, perspectiva: opts.perspectiva?.trim() || null, areas: pedidas, v: 3 },
    reporte,
    model: 'claude-opus-4-8',
  }).select('*').single();
  if (error) throw new Error(`generarRetroV3: ${error.message}`);
  return data as unknown as Retro;
}

// ─────────────────────────────────────────────────────────────────────────────
// Acciones sobre el plan (aceptar / posponer / descartar / deshacer)
// ─────────────────────────────────────────────────────────────────────────────

export type PlanOp = 'aceptar' | 'posponer' | 'descartar' | 'deshacer';

export async function aplicarPlan(retroId: number, itemId: string, op: PlanOp, motivo?: string): Promise<RetroReporte> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase.from('retros').select('*').eq('id', retroId).maybeSingle();
  if (error || !data) throw new Error('retro inexistente');
  const retro = data as unknown as Retro;
  const reporte = retro.reporte;
  if (!reporte) throw new Error('la retro no tiene reporte v3');
  const item = reporte.plan.find((p) => p.id === itemId);
  if (!item) throw new Error('item del plan inexistente');

  if (op === 'deshacer') {
    // Solo limpia el estado visual: si aceptar creó un experimento/tareas, quedan
    // (y item.expCreado recuerda el experimento para que re-aceptar NO duplique).
    delete item.status;
  } else if (op === 'posponer') {
    item.status = { estado: 'pospuesta', at: new Date().toISOString() };
  } else if (op === 'descartar') {
    item.status = { estado: 'descartada', motivo: (motivo || 'sin motivo').slice(0, 60), at: new Date().toISOString() };
  } else if (op === 'aceptar') {
    // Idempotente: ya aceptado (doble click / segunda pestaña) → no duplicar nada.
    if (item.status?.estado === 'aceptada') return reporte;

    let experimentoId: number | undefined;
    let tareaId: number | undefined;
    if (item.kind === 'exp' && item.experimento) {
      if (item.expCreado) {
        // Una aceptación previa (deshecha) ya creó el experimento: reusarlo.
        experimentoId = item.expCreado;
      } else {
        const exp = await crearExperimento({
          titulo: item.titulo,
          hipotesis: item.experimento.hipotesis,
          cambio: item.experimento.cambio,
          metrica: item.experimento.metrica,
          direccion: item.experimento.direccion,
          objetivo_valor: item.experimento.objetivo_valor,
          criterio_exito: item.experimento.criterio_exito,
          ventana_dias: item.experimento.ventana_dias,
          origen: 'mako',
          racional: item.why,
          config: { retro_id: retroId },
          arrancar: true,
        });
        experimentoId = exp.id;
        item.expCreado = exp.id;
        if (item.chain?.length) {
          const prios = await prioridadesDelPerro(item.chain, item.titulo);
          await crearTareasDesde(
            item.chain.map((titulo, i) => ({ titulo, prioridad: prios[i] })),
            { origen: 'retro', retro_id: retroId, experimento_id: exp.id },
          ).catch(() => 0);
        }
      }
    } else if (!item.expCreado) {
      const creada = await crearTarea({
        titulo: item.titulo,
        detalle: item.tarea?.detalle ?? item.why,
        prioridad: item.prio ?? 'media',
        origen: 'retro',
        retro_id: retroId,
      });
      item.expCreado = -1; // marca "ya creé la tarea" (re-aceptar no duplica)
      tareaId = creada.id;  // el vínculo exacto: sin esto el seguimiento tiene que
                            // adivinar por título cuál de las tareas era ésta.
    }
    item.status = { estado: 'aceptada', experimento_id: experimentoId, tarea_id: tareaId, at: new Date().toISOString() };
  } else {
    throw new Error('op inválida');
  }

  const { error: upErr } = await supabase.from('retros').update({ reporte }).eq('id', retroId);
  if (upErr) throw new Error(`aplicarPlan: ${upErr.message}`);
  return reporte;
}
