// =============================================================================
// Media Buyer — los agentes propios en la corrida: la IA del negocio mira cada regla contra la cuenta (25/10/2026)
// =============================================================================
// Lo puro (qué toca hoy, el pedido, la lectura de la respuesta) está en ./agentes-propios.ts. Acá: leerlos y guardarlos
// (app_settings `media-buyer.agentes`) y, en la corrida, una llamada a la IA DEL NEGOCIO por agente que toca hoy
// (`chatCheapCascade`, como las variaciones: cada negocio paga su IA). Nunca tira: un agente que falla no frena la corrida,
// y su motivo vuelve en `avisos`. Un agente que ya dejó algo hoy no se vuelve a preguntar (no se gasta IA dos veces).
// =============================================================================

import 'server-only';
import { runWithWorkspace } from '@/lib/workspace';
import { getSetting, setSetting } from '@/lib/settings';
import { chatCheapCascade, CASCADA_DOCS } from '@/lib/ai-cheap';
import { CLAVE_AGENTES, FEATURE_AGENTES, MAX_AGENTES, leerAgentes, promptAgente, propuestasDeAgente, resumenParaAgente, tocaHoy, validarAgente, type AgentePropio } from './agentes-propios';
import type { DatosCuenta } from './datos';
import type { KpiMediaBuyer, Propuesta } from './tipos';

export async function leerAgentesPropios(ws: number): Promise<AgentePropio[]> {
  return runWithWorkspace(ws, async () => leerAgentes(await getSetting(CLAVE_AGENTES).catch(() => null)));
}

/** Crea o cambia uno (por id). Devuelve la lista nueva, o el error en palabras. */
export async function guardarAgentePropio(ws: number, x: unknown): Promise<{ ok: true; agentes: AgentePropio[] } | { ok: false; error: string }> {
  const v = validarAgente(x);
  if (!v.ok) return v;
  const lista = await leerAgentesPropios(ws);
  const i = lista.findIndex((a) => a.id === v.valor.id);
  if (i < 0 && lista.length >= MAX_AGENTES) return { ok: false, error: `Hasta ${MAX_AGENTES} agentes propios por negocio.` };
  const nueva = i < 0 ? [...lista, { ...v.valor, creado: new Date().toISOString() }] : lista.map((a, j) => (j === i ? { ...v.valor, creado: a.creado } : a));
  await runWithWorkspace(ws, () => setSetting(CLAVE_AGENTES, JSON.stringify(nueva)));
  return { ok: true, agentes: nueva };
}

export async function borrarAgentePropio(ws: number, id: string): Promise<AgentePropio[]> {
  const nueva = (await leerAgentesPropios(ws)).filter((a) => a.id !== id);
  await runWithWorkspace(ws, () => setSetting(CLAVE_AGENTES, JSON.stringify(nueva)));
  return nueva;
}

/** Lo que dejan hoy los agentes propios activos. `yaHoy`: las claves de lo que ya se guardó (para no preguntar dos veces). */
export async function propuestasDeAgentesPropios(ws: number, x: {
  hoy: string; datos: DatosCuenta; kpi: KpiMediaBuyer; objetivo: number | null; fmt: (u: number) => string; yaHoy: ReadonlySet<string>;
}): Promise<{ propuestas: Propuesta[]; avisos: string[] }> {
  const agentes = (await leerAgentesPropios(ws).catch(() => [])).filter((a) => tocaHoy(a, x.hoy));
  const propuestas: Propuesta[] = [];
  const avisos: string[] = [];
  if (!agentes.length) return { propuestas, avisos };
  const resumen = resumenParaAgente(x.datos.arbol, x.datos.larga, x.kpi, x.fmt);
  for (const a of agentes) {
    const yaMiro = [...x.yaHoy].some((c) => c.startsWith(`propia:${a.id}:`) && c.endsWith(`:${x.hoy}`));
    if (yaMiro) continue;
    try {
      const { system, user } = promptAgente(a, resumen, x.kpi, x.objetivo != null ? x.fmt(x.objetivo) : null);
      const errores: string[] = [];
      const crudo = await runWithWorkspace(ws, () => chatCheapCascade({
        system, user, json: true, maxTokens: 1500, temperature: 0.2, feature: FEATURE_AGENTES,
        motivo: `Media Buyer: el agente «${a.nombre}»`, provs: CASCADA_DOCS, erroresOut: errores,
      }));
      if (!crudo) { avisos.push(`«${a.nombre}»: tu IA no contestó (${errores[0] ?? 'sin respuesta'}).`); continue; }
      propuestas.push(...propuestasDeAgente(crudo, a, x.datos.arbol, x.hoy));
    } catch (e) {
      avisos.push(`«${a.nombre}»: ${e instanceof Error ? e.message : String(e)}`.slice(0, 200));
    }
  }
  return { propuestas, avisos };
}
