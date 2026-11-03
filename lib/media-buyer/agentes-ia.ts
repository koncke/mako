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
import { getSetting, cambiarSettingSi } from '@/lib/settings';
import { getSupabaseServer } from '@/lib/supabase';
import { fmtDinero } from '@/lib/format';
import { chatCheapCascade, CASCADA_DOCS } from '@/lib/ai-cheap';
import { CLAVE_AGENTES, FEATURE_AGENTES, MAX_AGENTES, leerAgentes, promptAgente, propuestasDeAgente, resumenParaAgente, tocaHoy, validarAgente, type AgentePropio } from './agentes-propios';
import type { DatosCuenta } from './datos';
import type { KpiMediaBuyer, Propuesta } from './tipos';

export async function leerAgentesPropios(ws: number): Promise<AgentePropio[]> {
  return runWithWorkspace(ws, async () => leerAgentes(await getSetting(CLAVE_AGENTES).catch(() => null)));
}

// ⚠️ LO QUE ESCRIBE LEE ESTRICTO (revisión de tren-l, falla 3): `getSetting` devuelve null cuando Supabase falla, y una lista
//    leída como vacía se escribía encima (editar uno con un error pasajero dejaba ése solo; borrar, ninguno). Acá «no pude
//    leer» tira y no se escribe nada, y un JSON guardado que no se entiende tampoco se pisa. El guardado es un compare-and-set
//    por `updated_at` (un token corto; comparar el JSON entero va en la URL y se rompe pasados unos KB): si otro guardó en el
//    medio (la pantalla y MaKo por chat a la vez), se relee y se reintenta.
type Fila = { value: string | null; updated_at: string } | null;
type Resultado = { ok: true; agentes: AgentePropio[] } | { ok: false; error: string };
const VUELTAS = 3;

async function leerFila(ws: number): Promise<Fila> {
  const { data, error } = await getSupabaseServer().from('app_settings').select('value, updated_at')
    .eq('workspace_id', ws).eq('key', CLAVE_AGENTES).maybeSingle();
  if (error) throw new Error(`No pude leer tus agentes propios: ${error.message}`);
  const fila = (data as Fila) ?? null;
  if (fila?.value != null) {
    let j: unknown = null;
    try { j = JSON.parse(fila.value); } catch { /* abajo */ }
    if (!Array.isArray(j)) throw new Error('La lista guardada de agentes propios no se entiende: no la piso.');
  }
  return fila;
}

/** Un `updated_at` posterior al leído aunque el reloj de este servidor vaya atrasado (el token del compare-and-set). */
function despuesDe(leido: string): string {
  const antes = Date.parse(leido);
  return new Date(Number.isNaN(antes) ? Date.now() : Math.max(Date.now(), antes + 1)).toISOString();
}

async function cambiarLista(ws: number, cambio: (lista: AgentePropio[]) => Resultado): Promise<Resultado> {
  return runWithWorkspace(ws, async () => {
    for (let vuelta = 0; vuelta < VUELTAS; vuelta++) {
      const fila = await leerFila(ws);
      const r = cambio(leerAgentes(fila?.value ?? null));
      if (!r.ok) return r;
      const valor = JSON.stringify(r.agentes);
      if (!fila) {
        if (await cambiarSettingSi(CLAVE_AGENTES, null, valor)) return r;
        continue;
      }
      const { data, error } = await getSupabaseServer().from('app_settings')
        .update({ value: valor, updated_at: despuesDe(fila.updated_at) })
        .eq('workspace_id', ws).eq('key', CLAVE_AGENTES).eq('updated_at', fila.updated_at).select('key');
      if (error) throw new Error(`No pude guardar tus agentes propios: ${error.message}`);
      if ((data ?? []).length) return r;
    }
    return { ok: false, error: 'Se cambiaron a la vez desde otro lado: vuelve a intentar.' };
  });
}

/** Crea o cambia uno (por id). Devuelve la lista nueva, o el error en palabras. */
export async function guardarAgentePropio(ws: number, x: unknown): Promise<Resultado> {
  const v = validarAgente(x);
  if (!v.ok) return v;
  return cambiarLista(ws, (lista) => {
    const i = lista.findIndex((a) => a.id === v.valor.id);
    if (i < 0 && lista.length >= MAX_AGENTES) return { ok: false, error: `Hasta ${MAX_AGENTES} agentes propios por negocio.` };
    return { ok: true, agentes: i < 0 ? [...lista, { ...v.valor, creado: new Date().toISOString() }] : lista.map((a, j) => (j === i ? { ...v.valor, creado: a.creado } : a)) };
  });
}

export async function borrarAgentePropio(ws: number, id: string): Promise<Resultado> {
  return cambiarLista(ws, (lista) => ({ ok: true, agentes: lista.filter((a) => a.id !== id) }));
}

/** Lo que dejan hoy los agentes propios activos. `yaHoy`: las claves de lo que ya se guardó (para no preguntar dos veces). */
export async function propuestasDeAgentesPropios(ws: number, x: {
  hoy: string; datos: DatosCuenta; kpi: KpiMediaBuyer; objetivo: number | null; fmt: (u: number) => string; yaHoy: ReadonlySet<string>;
  /** Los lugares del cupo que quedan hoy después del motor (plan.ts → lugaresParaPropios). Con cero no se pregunta. */
  lugares: number;
}): Promise<{ propuestas: Propuesta[]; avisos: string[] }> {
  const agentes = (await leerAgentesPropios(ws).catch(() => [])).filter((a) => tocaHoy(a, x.hoy));
  const propuestas: Propuesta[] = [];
  const avisos: string[] = [];
  if (!agentes.length) return { propuestas, avisos };
  // Con el cupo del plan lleno por el motor, lo que dijera el agente no entra: no se gasta la IA del negocio (falla 9).
  if (x.lugares <= 0) return { propuestas, avisos: ['Tus agentes propios no miraron hoy: el cupo de tu plan ya se llenó.'] };
  const resumen = resumenParaAgente(x.datos.arbol, x.datos.larga, x.kpi, x.fmt, (m) => fmtDinero(m, x.datos.moneda), x.datos.conversor.aUsdNum);
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
