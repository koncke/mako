// =============================================================================
// personalidad-store — persistencia del quiz + personalización de preguntas
// =============================================================================
// Patrón fase-store/tono-store: la data pura (preguntas del quiz) vive en
// lib/personalidad.ts; acá la lectura/escritura por workspace y la
// PERSONALIZACIÓN por IA: antes de mostrar cada pregunta, las frases genéricas
// se reescriben con el negocio REAL del cliente (su dolor, su oferta), así el
// quiz se siente hecho para él — con las estáticas como fallback confiable
// (lección aprendida: la IA falla seguido; el quiz nunca se puede trabar).

import 'server-only';
import { getSetting, setSetting } from './settings';
import { PERSONALIDAD_PREGUNTAS, PERSONALIDAD_VACIA, normalizarPersonalidad, personalidadTexto, type Personalidad, type PersonalidadPregunta } from './personalidad';
import { perfilNegocioTexto } from './onboarding';
import { getPanorama } from './archivero';
import { chatCheapCascade, CASCADA_DOCS, MODELO_DOCS } from './ai-cheap';
import { parseJsonObject } from './campaign-structurer';

const KEY = 'mako.personalidad';

export async function getPersonalidad(): Promise<Personalidad> {
  const raw = await getSetting(KEY);
  if (!raw) return PERSONALIDAD_VACIA;
  try { return normalizarPersonalidad(JSON.parse(raw)); } catch { return PERSONALIDAD_VACIA; }
}

export async function setPersonalidad(p: unknown): Promise<Personalidad> {
  const limpio = normalizarPersonalidad(p);
  await setSetting(KEY, JSON.stringify(limpio));
  return limpio;
}

/** El perfil de voz listo para inyectar en un prompt ('' si no está definido). */
export async function personalidadNegocioTexto(): Promise<string> {
  return personalidadTexto(await getPersonalidad());
}

const PERSONALIZAR_SYSTEM = `Eres MaKo, adaptando UNA pregunta de un quiz de personalidad de voz publicitaria al negocio REAL de un cliente. La pregunta muestra frases de anuncio y el dueño elige la que más suena a cómo lo diría ÉL.

Te paso la pregunta con sus opciones genéricas. Reescribe SOLO el texto de cada opción para que hable del negocio real (su oferta, su avatar, su dolor — del contexto), manteniendo EXACTAMENTE:
- la MISMA cantidad de opciones, en el MISMO orden;
- el ESPÍRITU de cada una (su energía/registro/rasgo: si la opción 1 es calmada y la 3 explosiva, así se quedan);
- largo similar (1-2 frases habladas, como línea real de anuncio);
- español NEUTRO/MEXICANO; el tuteo/usted de cada opción se conserva tal cual.
La pregunta en sí puedes dejarla igual o ajustarla apenas. NO agregues opciones, NO inventes datos que no estén en el contexto.

Devuelve EXCLUSIVAMENTE este JSON: {"pregunta":"...","opciones":["...","..."]} — "opciones" son SOLO los textos, en orden.`;

/**
 * La pregunta `idx` del quiz con sus frases PERSONALIZADAS al negocio (misma
 * estructura y rasgos; solo cambian los textos). Si la IA falla o el negocio no
 * tiene contexto todavía, vuelve la estática — el quiz nunca se traba.
 */
export async function personalizarPregunta(idx: number): Promise<PersonalidadPregunta> {
  const base = PERSONALIDAD_PREGUNTAS[idx];
  if (!base) throw new Error('pregunta inválida');
  try {
    const [brief, panorama] = await Promise.all([perfilNegocioTexto(), getPanorama()]);
    if (!brief.trim() || brief.replace(/[—\-·\s]/g, '').length < 20) return base;
    const user = `CONTEXTO DEL NEGOCIO:\n${brief}\n${panorama.trim() ? `\nPANORAMA:\n${panorama.slice(0, 4000)}\n` : ''}
PREGUNTA:
${base.pregunta}
OPCIONES (en orden, conserva el espíritu de cada una):
${base.opciones.map((o, i) => `${i + 1}. ${o.texto} [espíritu: ${o.rasgo}]`).join('\n')}

Adapta los textos al negocio real. Devuelve solo el JSON.`;
    const out = await chatCheapCascade({
      system: PERSONALIZAR_SYSTEM, user, json: true, maxTokens: 700,
      feature: 'personalidad', motivo: `Personalizar pregunta del quiz de voz (${base.key})`,
      provs: CASCADA_DOCS, modelos: MODELO_DOCS,
      validar: (t) => {
        const j = parseJsonObject(t);
        return Array.isArray(j.opciones) && j.opciones.length === base.opciones.length && j.opciones.every((x) => typeof x === 'string' && x.trim().length > 8);
      },
    });
    if (!out) return base;
    const j = parseJsonObject(out);
    const textos = (j.opciones as string[]).map((t) => t.trim());
    return {
      ...base,
      pregunta: typeof j.pregunta === 'string' && j.pregunta.trim() ? j.pregunta.trim() : base.pregunta,
      opciones: base.opciones.map((o, i) => ({ ...o, texto: textos[i] || o.texto })),
    };
  } catch {
    return base;
  }
}
