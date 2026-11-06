// =============================================================================
// lead-magnets/proponer — MaKo propone el lead magnet con la IA del NEGOCIO (6/11/2026)
// =============================================================================
// Lee la oferta (lib/ofertas.ts), los competidores con su oferta leída (lib/spy.ts) y la lista que ya tiene, y le pide a la IA
// del negocio hasta 3 propuestas; lo que se muestra lo decide `leerPropuestas` (./propuesta.ts, puro, con test). La última
// propuesta se guarda (`mako.lead-magnets.propuestas`) para verla al volver sin gastar la IA otra vez: es una caché de un solo
// escritor, por eso no lleva compare-and-set.
//
// «Cada negocio paga su IA»: sin la suya, no corre y se le dice que la conecte (la plataforma usa la suya, que es la de MaKo).
// Sin la red de la plataforma (`redDePlataforma` apagada) y adentro de «sólo su IA» (D6b, `conSuIADelNegocio`). La oferta y los
// competidores no son datos de los clientes del negocio (`pii: false` en el catálogo).
// =============================================================================

import 'server-only';
import { wsObligatorio, wsSuperAdmin } from '../workspace';
import { getSetting, setSetting } from '../settings';
import { listarOfertas } from '../ofertas';
import { listarCompetidores } from '../spy';
import { claveDeIAPropia, conSuIADelNegocio } from '../ia-del-negocio';
import { chatCheapCascade, errorDeCascada } from '../ai-cheap';
import { renderPrompt } from '../prompt-render';
import { contenidoNoConfiable } from '../prompt-render-pure';
import { CONECTA_TU_IA } from '../ia-mensajes';
import { listarLeadMagnets, type Falla } from './server';
import {
  FORMA_PROPUESTAS, PROPONER_LM_SYSTEM_TEMPLATE, PROPONER_LM_USER_TEMPLATE, dossierParaProponer, leerGuardadas, leerPropuestas,
  plantillasParaLaIA, type PropuestaLM, type PropuestasGuardadas,
} from './propuesta';

export const FEATURE_PROPONER_LM = 'lead-magnet-propone';
export const CLAVE_PROPUESTAS_LM = 'mako.lead-magnets.propuestas';
export const KEY_PROMPT_PROPONER_SYSTEM = 'lead-magnet.proponer.system';
export const KEY_PROMPT_PROPONER_USER = 'lead-magnet.proponer.user';

/** Por qué no se pudo proponer, para que la pantalla ofrezca lo que lo arregla. */
export type FaltaPropuesta = 'oferta' | 'ia';
export type Propuesto = { ok: true; propuestas: PropuestaLM[]; descartadas: number; aviso: string | null; en: string };

const falla = (status: number, error: string, falta?: FaltaPropuesta): Falla & { falta?: FaltaPropuesta } => ({ ok: false, error, status, ...(falta ? { falta } : {}) });
const mensaje = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** La última propuesta guardada (para dibujar sin gastar la IA). null si no hay o no se pudo leer. */
export async function propuestasGuardadas(): Promise<PropuestasGuardadas | null> {
  try { return leerGuardadas(await getSetting(CLAVE_PROPUESTAS_LM)); } catch { return null; }
}

/**
 * Propone hasta 3 lead magnets. `guardar: false` (la API de MaKo, que lo sirve por GET: un GET no escribe) no deja la propuesta
 * para la pantalla.
 */
export async function proponerLeadMagnets(o: { guardar?: boolean } = {}): Promise<Propuesto | (Falla & { falta?: FaltaPropuesta })> {
  let ws: number;
  try { ws = await wsObligatorio(); } catch (e) { return falla(401, mensaje(e)); }

  // ¿Con qué IA? La del negocio; la plataforma, la suya. Sin la suya no corre (no se presta la de MaKo).
  const plataforma = await wsSuperAdmin().catch(() => null);
  const suIA = ws === plataforma ? true : await claveDeIAPropia(ws).catch(() => null);
  if (suIA === null) return falla(503, 'No pude revisar tus cuentas de IA: vuelve a intentarlo.');
  if (!suIA) return falla(409, `${CONECTA_TU_IA} para que MaKo te proponga.`, 'ia');

  // Lo que lee. Una oferta que no se pudo leer frena (no se propone a ciegas); los competidores, no: se avisa y sigue.
  const [ofertas, comp, lista] = await Promise.all([
    listarOfertas(true).then((o) => ({ ok: true as const, o }), (e: unknown) => ({ ok: false as const, error: mensaje(e) })),
    listarCompetidores().catch((e: unknown) => ({ ok: false as const, error: mensaje(e) })),
    listarLeadMagnets(),
  ]);
  if (!ofertas.ok) return falla(503, 'No pude leer tu oferta: vuelve a intentarlo.');
  if (!lista.ok) return lista;
  const aviso = comp.ok ? null : 'No pude leer tus competidores: propuse sólo desde tu oferta.';
  const dossier = dossierParaProponer({
    ofertas: ofertas.o,
    competidores: comp.ok ? comp.competidores.map((c) => ({ nombre: c.nombre, instagram: c.instagram, oferta: c.oferta })) : [],
    yaTiene: lista.lista.map((e) => e.nombre),
  });
  if (!dossier) return falla(409, 'Carga tu oferta en Offer o un competidor en Competitors Spy: MaKo propone desde ahí.', 'oferta');

  return conSuIADelNegocio(ws, async () => {
    const system = await renderPrompt(KEY_PROMPT_PROPONER_SYSTEM, PROPONER_LM_SYSTEM_TEMPLATE, { plantillas: plantillasParaLaIA(), forma: FORMA_PROPUESTAS });
    const user = await renderPrompt(KEY_PROMPT_PROPONER_USER, PROPONER_LM_USER_TEMPLATE, {
      oferta: contenidoNoConfiable(dossier.oferta, 'oferta'),
      competencia: contenidoNoConfiable(dossier.competencia, 'competencia'),
      yaTiene: contenidoNoConfiable(dossier.yaTiene, 'ya_tiene'),
    });
    const errores: string[] = [];
    const texto = await chatCheapCascade({
      system, user, json: true, feature: FEATURE_PROPONER_LM, maxTokens: 900, temperature: 0.5, erroresOut: errores,
      hastaMs: Date.now() + 45_000, redDePlataforma: false,
    });
    if (!texto.trim()) return falla(502, await errorDeCascada(errores, 'proponer un lead magnet'));
    const l = leerPropuestas(texto, { nCompetidores: dossier.nCompetidores, prohibidos: dossier.prohibidos, yaTiene: lista.lista.map((e) => e.nombre) });
    if (!l.ok) return falla(502, 'MaKo no contestó algo que se entienda: vuelve a intentarlo.');
    if (l.descartadas.length) console.log(`[lead-magnets] ws=${ws} descarté ${l.descartadas.length} propuesta(s): ${l.descartadas.map((d) => d.motivo).join(' · ').slice(0, 300)}`);
    const en = new Date().toISOString();
    // Sólo se guarda una propuesta con algo: «no quedó ninguna» no pisa la anterior.
    if (l.propuestas.length && o.guardar !== false) {
      try { await setSetting(CLAVE_PROPUESTAS_LM, JSON.stringify({ en, propuestas: l.propuestas } satisfies PropuestasGuardadas)); } catch { /* se ve igual; al volver no está */ }
    }
    return { ok: true as const, propuestas: l.propuestas, descartadas: l.descartadas.length, aviso, en };
  });
}
