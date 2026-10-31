// =============================================================================
// El estudio de video — el ANUNCIO NUEVO en una sola pantalla (puro, con test)
// =============================================================================
// Copiado de la pantalla de crear de ARCADS (help.arcads.ai → «How to create a talking actor video»): el guion en su campo,
// el actor elegido de una biblioteca filtrable por «situation», y «Generate». Acá:
//   · el GUION es uno de los que MaKo escribió en Ads Writer (o el que pega la persona);
//   · el «actor» es SU avatar con un FORMATO (la biblioteca de puestas, con su video de ejemplo);
//   · la «situation» es el LUGAR (lib/escenarios-data.ts), o «Que lo elija MaKo».
// Reemplaza a TRES pantallas del recorrido viejo (el catálogo, «Así se verá tu anuncio» y «¿Cuál de tus guiones…?») y le saca
// al wizard su pantalla «¿Dónde se graba?»: el lugar se elige acá, al lado de lo demás.
//
// ⚠️ LA CONSECUENCIA DICE LA VERDAD DE ESTE BOTÓN. «Generar anuncio» escribe el guion en tomas: no toca Flow ni gasta un
//    crédito (los créditos se gastan al filmar cada toma). La línea de abajo lo dice, y cuando el botón no responde dice por qué.
// SIN 'use client' y sin server-only: lo usan la pantalla, la acción del server (que valida el lugar con la MISMA regla) y los tests.
// =============================================================================

import { cabidaDeGuion, type Puesta } from '@/lib/puestas-data';
import { escenariosParaCamara, escenarioPorId, type Escenario } from '@/lib/escenarios-data';

/** «Que lo elija MaKo leyendo mi guion»: la salida que existió siempre (WizardAnuncio, paso del lugar). */
export const LUGAR_MAKO = 'mako';

/** Los lugares que sirven con la cámara del formato. Sin formato, ninguno: primero se elige el formato. */
export function lugaresPara(puesta: Pick<Puesta, 'camara'> | null | undefined): Escenario[] {
  return puesta ? escenariosParaCamara(puesta.camara) : [];
}

/**
 * El lugar que queda elegido al cambiar de formato: si el de antes no sirve con la cámara nueva, vuelve a «Que lo elija
 * MaKo». Ofrecer una oficina para un selfie adentro de un auto es romper el formato y descubrirlo después.
 */
export function lugarValido(puesta: Pick<Puesta, 'camara'> | null | undefined, lugar: string): string {
  if (!lugar || lugar === LUGAR_MAKO) return LUGAR_MAKO;
  return lugaresPara(puesta).some((l) => l.id === lugar) ? lugar : LUGAR_MAKO;
}

/**
 * Lo que la ACCIÓN guarda del lugar: el id de un lugar que sirve con ese formato, `null` para «Que lo elija MaKo», o un
 * error si el pedido nombra algo que no existe o que no sirve (la acción lo rechaza: un lugar inventado no se guarda).
 */
export function lugarDelPedido(puesta: Pick<Puesta, 'camara'>, lugar: unknown): { ok: true; escenarioId: string | null } | { ok: false; error: string } {
  if (lugar == null || lugar === '' || lugar === LUGAR_MAKO) return { ok: true, escenarioId: null };
  if (typeof lugar !== 'string' || !escenarioPorId(lugar)) return { ok: false, error: 'No reconozco ese lugar.' };
  if (!lugaresPara(puesta).some((l) => l.id === lugar)) return { ok: false, error: 'Ese lugar no sirve con este formato: elige otro o deja que lo elija MaKo.' };
  return { ok: true, escenarioId: lugar };
}

type GuionDelComposer = { id: string; hablado: string };
type PlanResumido = { id: string; guionId?: string; plan: { puestaId: string } };

/**
 * Si este guion YA tiene un anuncio con ESTE formato: ése se abre, no se rehace (rehacerlo perdía las tomas corregidas y
 * los clips filmados). Con OTRO formato no: el mismo guion en dos formatos son dos anuncios (así grabó el dueño el primero).
 */
export function planExistente(historial: readonly PlanResumido[], guionId: string | null | undefined, puestaId: string | null | undefined): string | null {
  if (!guionId || !puestaId) return null;
  return historial.find((p) => p.guionId === guionId && p.plan.puestaId === puestaId)?.id ?? null;
}

export type EntradaComposer = {
  guion: GuionDelComposer | null;
  puesta: Puesta | null;
  /** El id del anuncio que ya existe con este guion y este formato (`planExistente`). */
  existente: string | null;
  /** ¿El puente con Google Flow anda AHORA? (`estadoDelPuente`, app/video-generator/puente-avisos.tsx). */
  puenteAnda: boolean;
  /** La extensión del navegador es vieja: nada de lo que sigue va a funcionar. */
  extensionVieja: boolean;
};

export type EstadoComposer = {
  /** ¿El botón hace algo? Sin, el botón va apagado y la consecuencia dice qué falta. */
  puede: boolean;
  /** El rótulo del botón: nombra su acción y su objeto. */
  boton: string;
  /** La línea pegada al botón, ANTES del clic. */
  consecuencia: string;
  /** Si el botón abre un anuncio que ya existe en vez de escribir uno. */
  abre: string | null;
  /** El guion no entra entero en el formato: el final quedaría afuera (no bloquea, avisa). */
  desborda: boolean;
};

export function estadoDelComposer(e: EntradaComposer): EstadoComposer {
  const nada = { abre: null, desborda: false };
  if (!e.guion) return { ...nada, puede: false, boton: 'Generar anuncio', consecuencia: 'Elige un guion.' };
  if (!e.puesta) return { ...nada, puede: false, boton: 'Generar anuncio', consecuencia: 'Elige un formato.' };
  // Abrir lo hecho no necesita el puente: no le habla a Google.
  if (e.existente) return { puede: true, boton: 'Abrir el que ya tienes', consecuencia: 'Este guion ya tiene un anuncio con este formato.', abre: e.existente, desborda: false };
  if (e.extensionVieja) return { ...nada, puede: false, boton: 'Generar anuncio', consecuencia: 'Actualiza la extensión de MaKo para seguir.' };
  if (!e.puenteAnda) return { ...nada, puede: false, boton: 'Generar anuncio', consecuencia: 'Conecta tu navegador con Google Flow para seguir.' };
  const cab = cabidaDeGuion(e.puesta, e.guion.hablado);
  if (cab.desborda) {
    return { puede: true, boton: 'Generar anuncio', consecuencia: `No entra entero en ${e.puesta.nombre}: sobran ${cab.palabrasDeMas} palabras.`, abre: null, desborda: true };
  }
  return { puede: true, boton: 'Generar anuncio', consecuencia: `Escribirlo es gratis. Filmarlo son ${cab.clips} tomas.`, abre: null, desborda: false };
}
