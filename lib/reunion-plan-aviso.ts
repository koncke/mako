// =============================================================================
// reunion-plan-aviso — los DATOS del aviso «Leí tu reunión y te dejé las tareas en el Plan» (puro, con test)
// =============================================================================
// «Nada por detrás» (docs/inventario-nada-por-detras.md, 17/10/2026): `reunion-tareas-al-plan` lo armaba el código
// (`textoAviso`, lib/reunion-auto.ts) y lo mandaba por `emitirDelCatalogo` con `texto`, que PISA la plantilla: el negocio
// editaba en /mensajes un texto que nunca salía. Ahora es el evento de la plataforma `reunion_tareas_al_plan` con el texto
// LITERAL en su fila de SuperAdmin (lib/plantillas-automatizaciones.ts, `mako-reunion-tareas-al-plan`). Lo que el código
// elegía —una reunión o varias, si completa una lectura a medias— lo pregunta una CONDITION (`plan_varias`, `plan_resto`).
// Acá van sólo los HECHOS. ⚠️ Un dato opcional FALTA, no viene vacío: uno que falta se lleva su renglón.
//
// Medido el 17/10/2026: el aviso nacía APAGADO (sin `porDefecto` en el catálogo) y ningún negocio lo había prendido (el
// ws 13 lo tenía explícitamente apagado): no le llegaba a nadie. Por eso su fila nace PAUSADA (la mudanza lo hace sola).
// =============================================================================

/** Lo que pregunta la CONDITION: si leyó varias reuniones, y si una completa una lectura que había quedado a medias. */
export const PLAN_SI_NO = ['sí', 'no'] as const;

/** Una reunión ya leída en esta corrida, con su borrador (lo arma `procesarReunionesNuevas`). */
export type ReunionAlPlan = {
  titulo: string; fecha: string | null; conQuien: string; mias: number; otras: number;
  /** Cuántas dejó AFUERA el criterio (llegan al borrador destildadas y con su razón). */
  descartadas?: number;
  partesFallidas?: number; recordingId: number; propId: string;
  /** Esta vuelta COMPLETÓ una lectura a medias: son las tareas que faltaban, en un borrador aparte. */
  resto?: boolean;
};

export type DatosReunionesAlPlan = {
  plan_varias: (typeof PLAN_SI_NO)[number]; plan_resto: (typeof PLAN_SI_NO)[number]; plan_tuyas: string;
  plan_titulo?: string; plan_con?: string; plan_cuando?: string; plan_link?: string;
  plan_reuniones?: string; plan_lista?: string;
  plan_de_otros?: string; plan_fuera?: string; plan_a_medias?: string;
};

const texto = (s: string | null | undefined): string | null => (typeof s === 'string' && s.trim() ? s.trim() : null);
const tareas = (n: number, cuyas: string) => `${n} ${n === 1 ? 'tarea' : 'tareas'} ${cuyas}`;

/** Cuántas reuniones como mucho van en la lista (el resto se cuenta): un mensaje de WhatsApp no es un ladrillo. */
export const TOPE_REUNIONES_AVISO = 4;

/**
 * LO QUE PASÓ EN LA CORRIDA, como datos. El número grande es el de TAREAS PROPIAS (el que se ve en «Agregar N al plan»);
 * las de los demás van aparte y no se suman. `cuando` y `link` los pone quien llama (la zona del negocio y la base de la app).
 */
export function datosReunionesAlPlan(
  hechas: readonly ReunionAlPlan[],
  p: { cuando: (h: ReunionAlPlan) => string | null; link: (h: ReunionAlPlan) => string },
): DatosReunionesAlPlan {
  const mias = hechas.reduce((s, h) => s + h.mias, 0);
  const otras = hechas.reduce((s, h) => s + h.otras, 0);
  const fuera = hechas.reduce((s, h) => s + (h.descartadas ?? 0), 0);
  const cojas = hechas.filter((h) => (h.partesFallidas ?? 0) > 0).length;
  const varias = hechas.length > 1;
  const comunes = {
    plan_tuyas: tareas(mias, mias === 1 ? 'tuya' : 'tuyas'),
    ...(otras > 0 ? { plan_de_otros: `${otras} de los demás` } : {}),
    ...(fuera > 0 ? { plan_fuera: String(fuera) } : {}),
    ...(cojas > 0 ? { plan_a_medias: cojas === 1 ? (varias ? 'una de ellas' : 'esta reunión') : `${cojas} de ellas` } : {}),
  };
  if (!varias) {
    const h = hechas[0];
    return {
      // «Terminé de leer» sólo si TERMINÓ (revisión de B5): una vuelta que completa y sigue a medias no terminó nada.
      plan_varias: 'no', plan_resto: h?.resto && !(h.partesFallidas ?? 0) ? 'sí' : 'no', ...comunes,
      ...(texto(h?.titulo) ? { plan_titulo: texto(h.titulo)! } : {}),
      ...(texto(h?.conQuien) ? { plan_con: texto(h.conQuien)! } : {}),
      ...(h && texto(p.cuando(h)) ? { plan_cuando: texto(p.cuando(h))! } : {}),
      ...(h ? { plan_link: p.link(h) } : {}),
    };
  }
  const filas = hechas.slice(0, TOPE_REUNIONES_AVISO).map((h) => {
    const cuando = texto(p.cuando(h));
    return `\n\n• *${texto(h.titulo) ?? 'Reunión'}*${cuando ? ` — ${cuando}` : ''}${h.resto ? ' (lo que faltaba)' : ''}\n   ${tareas(h.mias, h.mias === 1 ? 'tuya' : 'tuyas')}${h.otras ? ` · ${h.otras} de otros` : ''}\n   ${p.link(h)}`;
  });
  const mas = hechas.length - TOPE_REUNIONES_AVISO;
  return {
    plan_varias: 'sí', plan_resto: hechas.some((h) => h.resto && !(h.partesFallidas ?? 0)) ? 'sí' : 'no', ...comunes,
    plan_reuniones: `${hechas.length} reuniones`,
    plan_lista: filas.join('') + (mas > 0 ? `\n…y ${mas} ${mas === 1 ? 'reunión más' : 'reuniones más'}.` : ''),
  };
}
