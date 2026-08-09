// =============================================================================
// model-registry — qué MODELO / IA usa cada tarea (config-driven, editable)
// =============================================================================
// Como el prompt-registry pero para el MODELO: cada "feature" (tag de gasto) tiene
// un modelo por default (del código / recomendación del audit) que se puede pisar
// desde la tab de SuperAdmin. chatClaude/chatCheap leen el override en runtime:
// cambiar acá el modelo o la IA re-rutea las llamadas de verdad, sin tocar código.
//
// provider: 'anthropic' (Claude) | 'groq' | 'openai'. Cambiar de provider a uno
// barato solo tiene sentido en tareas SIMPLES (ver `recomendado`); las de
// razonamiento/voz de marca/PII se quedan en Claude.
//
// ⚠️ El CATÁLOGO no vive acá: está en `lib/model-catalogo.ts`, sin `server-only`,
// para que la guarda del gasto se pueda testear. Acá queda solo el override contra
// la base. Se re-exporta entero: los call-sites no cambian.

import 'server-only';
import { getSetting, setSetting } from '@/lib/settings';
import { OWNER_WS, runWithWorkspace } from '@/lib/workspace';
import { CATALOGO_MODELOS, type ModeloRef, type FeatureModelo } from '@/lib/model-catalogo';

export {
  CATALOGO_MODELOS, PROVEEDORES_PAGOS, REGLA_DEFAULT_GRATIS,
  type Proveedor, type ModeloRef, type FeatureModelo,
} from '@/lib/model-catalogo';


const KEY = 'mako.modelos'; // override JSON: { [feature]: { provider, model } }

async function leerOverrides(): Promise<Record<string, ModeloRef>> {
  const raw = await runWithWorkspace(OWNER_WS, () => getSetting(KEY));
  if (!raw) return {};
  try { const o = JSON.parse(raw); return o && typeof o === 'object' ? o : {}; } catch { return {}; }
}

/** Modelo efectivo de una feature: override del usuario > default del catálogo > null. */
export async function modeloDeFeature(feature?: string): Promise<ModeloRef | null> {
  if (!feature) return null;
  const ov = await leerOverrides();
  if (ov[feature]?.provider && ov[feature]?.model) return ov[feature];
  return CATALOGO_MODELOS.find((f) => f.feature === feature)?.def ?? null;
}

/** Solo el override MANUAL del dueño (null si está usando el default del catálogo).
 *  El router lo respeta como pin: si el dueño fijó un modelo, no lo pisa. */
export async function overrideDeFeature(feature?: string): Promise<ModeloRef | null> {
  if (!feature) return null;
  const ov = await leerOverrides();
  return (ov[feature]?.provider && ov[feature]?.model) ? ov[feature] : null;
}

/** Fija (o limpia) el modelo de una feature. model vacío → vuelve al default. */
export async function setModeloFeature(feature: string, ref: ModeloRef | null): Promise<void> {
  await runWithWorkspace(OWNER_WS, async () => {
    const ov = await leerOverrides();
    if (ref) ov[feature] = ref; else delete ov[feature];
    await setSetting(KEY, JSON.stringify(ov));
  });
}

/** Catálogo + el modelo efectivo (con override aplicado) para la UI de SuperAdmin. */
export async function getModelosConfig(): Promise<Array<FeatureModelo & { actual: ModeloRef; overrideado: boolean }>> {
  const ov = await leerOverrides();
  return CATALOGO_MODELOS.map((f) => {
    const o = ov[f.feature];
    const actual = (o?.provider && o?.model) ? o : f.def;
    return { ...f, actual, overrideado: !!(o?.provider && o?.model) };
  });
}
