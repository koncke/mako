// =============================================================================
// El plan de cortes editado a mano — leerlo y comprobar que sirve
// =============================================================================
// SIN `server-only`: es la validación de lo que la persona editó en el editor, y
// lo que decide si se gastan 25 segundos de CPU en un archivo mal no puede
// quedarse sin test.
//
// ── Qué es un plan ─────────────────────────────────────────────────────────
// Lo que produce el detector de doble umbral, y lo único que hay que cambiar
// para cambiar el montaje:
//
//   { total: 38.65, segs: [ { toma: 1, ini: 0.42, fin: 3.18 }, … ] }
//
// Cada `seg` es un tramo de la línea de tiempo: de qué toma sale y qué pedazo se
// usa. El editor arrastra los bordes, borra tramos, y esto vuelve al worker.
//
// ── Por qué hace falta validarlo ───────────────────────────────────────────
// ⚠️ ffmpeg NO FALLA CON UN TRAMO INVERTIDO. `trim=3:1` produce un segmento
// VACÍO y sigue: el anuncio sale más corto, sin un error en ningún log, después
// de gastar el render entero. Lo mismo con un tramo que se pasa del final del
// clip — devuelve lo que hay y calla.

/** Un tramo: de qué toma sale y qué pedazo se usa, en segundos. */
export type Tramo = { toma: number; ini: number; fin: number };
export type Plan = { total: number; segs: Tramo[] };

/** El mínimo que se puede dejar de un tramo. Menos que esto es un parpadeo. */
const MINIMO_SEG = 0.35;

/**
 * Lee un plan de lo que devolvió el worker o de lo que mandó la pantalla.
 *
 * Devuelve `null` ante cualquier cosa que no sea un plan: un plan a medias es
 * peor que ninguno — el montaje lo tomaría como bueno y no recalcularía.
 */
export function leerPlan(x: unknown): Plan | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (!Array.isArray(o.segs) || o.segs.length === 0) return null;

  const segs: Tramo[] = [];
  for (const s of o.segs) {
    if (!s || typeof s !== 'object') return null;
    const t = s as Record<string, unknown>;
    const toma = Number(t.toma); const ini = Number(t.ini); const fin = Number(t.fin);
    if (!Number.isFinite(toma) || !Number.isFinite(ini) || !Number.isFinite(fin)) return null;
    segs.push({ toma, ini, fin });
  }
  // El total se RECALCULA, no se cree. Es un dato derivado, y uno que llegue
  // mintiendo haría que la pantalla muestre una duración y el video tenga otra.
  return { total: +duracionDe(segs).toFixed(3), segs };
}

/** Cuánto dura el anuncio con estos cortes. */
export function duracionDe(segs: Tramo[]): number {
  return segs.reduce((t, s) => t + Math.max(0, s.fin - s.ini), 0);
}

/**
 * ¿El plan sirve? Devuelve el motivo por el que no, o `null`.
 *
 * Cada control existe por un modo de falla SILENCIOSO de ffmpeg: ninguno de
 * éstos da error al renderizar, todos dejan el archivo mal.
 */
export function porQueNoSirveElPlan(plan: Plan, cuantasTomas: number, segundosPorToma: number): string | null {
  if (!plan.segs.length) return 'El anuncio se quedó sin ningún tramo. Deja al menos uno.';

  for (const [i, s] of plan.segs.entries()) {
    // ⚠️ Un tramo invertido no rompe: `trim=3:1` da un segmento VACÍO y el
    // anuncio sale más corto, sin un error en ningún lado.
    if (s.fin <= s.ini) {
      return `El tramo ${i + 1} termina antes de empezar. Arrástralo al derecho.`;
    }
    if (s.fin - s.ini < MINIMO_SEG) {
      return `El tramo ${i + 1} dura ${(s.fin - s.ini).toFixed(2)} s: es un parpadeo. Déjalo en ${MINIMO_SEG} s o quítalo.`;
    }
    if (s.toma < 1 || s.toma > cuantasTomas) {
      return `El tramo ${i + 1} sale de la toma ${s.toma}, y este anuncio tiene ${cuantasTomas}.`;
    }
    // ⚠️ Pasarse del final del clip tampoco falla: ffmpeg devuelve lo que hay.
    // Se tolera un pelo por el redondeo de la duración.
    if (s.ini < 0 || s.fin > segundosPorToma + 0.2) {
      return `El tramo ${i + 1} pide de ${s.ini.toFixed(2)} a ${s.fin.toFixed(2)} s, y cada toma dura ${segundosPorToma}.`;
    }
  }

  // ⚠️ EL ORDEN DENTRO DE UNA TOMA IMPORTA, y es lo que más fácil se rompe
  // arrastrando: dos tramos de la misma toma que se cruzan hacen que el anuncio
  // repita o se salte una parte de la frase. El video sale bien formado y dice
  // otra cosa.
  const porToma = new Map<number, Tramo[]>();
  for (const s of plan.segs) {
    if (!porToma.has(s.toma)) porToma.set(s.toma, []);
    porToma.get(s.toma)!.push(s);
  }
  for (const [toma, tramos] of porToma) {
    for (let i = 1; i < tramos.length; i++) {
      if (tramos[i].ini < tramos[i - 1].fin) {
        return `En la toma ${toma} hay dos tramos que se pisan. El anuncio repetiría lo que dice ahí.`;
      }
    }
  }

  // Un anuncio de menos de cinco segundos no es un anuncio: es un error de
  // arrastre que nadie quiso.
  const dur = duracionDe(plan.segs);
  if (dur < 5) {
    return `Con estos cortes el anuncio dura ${dur.toFixed(1)} s. Es demasiado corto para publicarlo.`;
  }
  return null;
}
