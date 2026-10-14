// =============================================================================
// «Avatar de IA»: qué es un avatar en MaKo, y cómo se arma su plan
// =============================================================================
// Pedido de Martín (14/10/2026): «implementa lo que ya tenemos en MaKo para la
// generación de videos con esa tab que tiene Capcut de "Avatar de IA"».
//
// La pantalla se copia de CapCut (Avatar de IA › Biblioteca de avatares: «Elige el
// avatar» → «Agregar voz»). Lo que genera NO se inventa: es el Video Generator.
// Ahí, un clip sale de animar la imagen de un ESCENARIO ya aprobado —la persona,
// con su cara, en su lugar— diciendo una frase. Esa imagen es exactamente lo que
// CapCut llama un avatar, así que:
//
//   · «Mis avatares» = los escenarios confirmados del historial del Video
//     Generator (la regla de qué sirve para filmar es UNA: `sirveParaFilmar`).
//   · Generar = el plan del Video Generator con el guion literal
//     (`generarPlanAction`) y ese escenario puesto, ya confirmado, en todas las
//     tomas (la misma escritura que `reusarEscenariosAction`).
//
// SIN `server-only` y sin React, para que tenga test
// (tests/video-editor-avatar.test.ts).

import type { PlanGuardado } from '@/app/video-generator/video-datos';
import type { Escena } from '@/lib/escenas-core';
import { sirveParaFilmar } from '@/app/video-generator/escenario-reuso';

export type AvatarIA = {
  /** El `mediaId` de la imagen dentro de Flow: no vence y es con lo que se anima. */
  id: string;
  /** Para mirarla. ⚠️ Vence (~6 h): la grilla tiene que aguantar que no cargue. */
  url: string;
  lugar: string;
  /** El formato del anuncio de donde sale: decide el encuadre de las tomas nuevas. */
  puestaId: string;
  /** Título del anuncio de donde sale, para decirlo (un dato reusado se anuncia). */
  deAnuncio: string;
  /** La escena de origen: su prompt y su fondo pasan al plan nuevo. */
  escena: Escena;
  escenarioId?: string;
};

/**
 * Los avatares del historial, del anuncio más nuevo al más viejo y sin repetir.
 *
 * La clave es el `mediaId`: un escenario reusado en otro anuncio (o en un avatar
 * generado acá) es la MISMA imagen, y listarlo dos veces sería ofrecer dos veces
 * lo mismo como si fueran dos avatares.
 */
export function avataresDelHistorial(historial: readonly PlanGuardado[]): AvatarIA[] {
  const vistos = new Set<string>();
  const out: AvatarIA[] = [];
  for (const item of historial) {
    for (const escena of item.escenas ?? []) {
      const img = item.imagenes?.[String(escena.n)];
      if (!sirveParaFilmar(img)) continue;
      if (vistos.has(img.elegidaId)) continue;
      vistos.add(img.elegidaId);
      out.push({
        id: img.elegidaId,
        url: img.elegida,
        lugar: escena.lugar,
        puestaId: item.plan?.puestaId ?? '',
        deAnuncio: img.reusadaDe ?? item.plan?.titulo ?? 'un anuncio anterior',
        escena,
        escenarioId: item.escenarioId,
      });
    }
  }
  return out;
}

/**
 * El plan recién armado, con el avatar como escenario de TODAS sus tomas.
 *
 * Una sola escena de la toma 1 a la última, con la imagen ya confirmada: es la
 * misma escritura que hace `reusarEscenariosAction` (elegida + elegidaId +
 * confirmada + reusadaDe). ⚠️ `elegidaId` es el campo que importa: la url vence
 * y el id no, y sin él la toma no se puede filmar.
 */
export function conAvatar(item: PlanGuardado, avatar: AvatarIA): PlanGuardado {
  const total = item.plan.clips.length;
  return {
    ...item,
    escenarioId: avatar.escenarioId ?? item.escenarioId,
    escenas: [{ ...avatar.escena, n: 1, desde: 1, hasta: Math.max(1, total) }],
    imagenes: {
      '1': {
        elegida: avatar.url,
        elegidaId: avatar.id,
        confirmada: true,
        reusadaDe: avatar.deAnuncio,
      },
    },
  };
}
