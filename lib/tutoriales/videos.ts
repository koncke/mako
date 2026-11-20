// =============================================================================
// EL VIDEO CHICO DE CADA TUTORIAL: el manifiesto de public/tutoriales (18/11/2026)
// =============================================================================
// Los videos de Martín (uno por pestaña y uno del recorrido general) los hace el chat «Tutoriales animados con voz» y van en
// `public/tutoriales/<key>.mp4`, con `public/tutoriales/manifiesto.json`: [{ key, archivo, duracion_s, guion, poster }].
// El motor muestra el de la pestaña leyendo el manifiesto. Si la key todavía no tiene video, NO va ningún video: nunca otro en
// su lugar (Martín, 18/11: «pusiste literalmente el video que tenemos en la landing… ¿cómo vamos a armar un tutorial con eso?»).
// =============================================================================

export const RUTA_MANIFIESTO = '/tutoriales/manifiesto.json';

/**
 * Una frase del video, con su tiempo (Martín, 18/11: «el video y la marca tienen que ir JUNTOS»: la voz dice «toca aquí, en Ver
 * info» y la marca muestra dónde). Las de acción traen `sel`, la marca de la página.
 *   · `espera_clic`: el video se PAUSA hasta que tocan lo marcado (o «Siguiente»). Falso = «Mira aquí»: marca sin pausar (lo que
 *     crea, paga o no es un botón: el lienzo, el QR, Nuevo módulo, Pasar a Pro). Sin el campo: verdadero si hay `sel`.
 *   · `cierra_despues`: lo que se tocó abre un panel o cambia la vista (Ver info, Ver ejemplo, Vista del alumno): el motor lo
 *     cierra antes de marcar lo siguiente, para que no lo tape. Sin el campo: falso.
 */
export type FraseVideo = { id: string; t_inicio: number; t_fin: number; texto: string; sel: string | null; espera_clic: boolean; cierra_despues: boolean };

/**
 * `play`: dónde va el play sobre la portada, si no es el centro (20/11: «el play cae sobre un espacio vacío»; en la bienvenida, el
 * centro es la cabeza del personaje o el texto en todos los cuadros). Lo escribe scripts/tutorial-animado/pantallas-onboarding/poster.mjs.
 */
export type VideoTutorial = { key: string; archivo: string; duracion_s?: number; guion?: string; poster?: string; frases?: FraseVideo[]; play?: 'abajo-derecha' };

/** Las frases válidas del manifiesto, en orden de tiempo, con los valores por defecto. Una frase rara se descarta (nunca rompe). */
export function frasesDe(crudo: unknown): FraseVideo[] {
  if (!Array.isArray(crudo)) return [];
  const out: FraseVideo[] = [];
  crudo.forEach((x, k) => {
    if (!x || typeof x !== 'object') return;
    const f = x as Record<string, unknown>;
    const t0 = Number(f.t_inicio), t1 = Number(f.t_fin);
    if (!Number.isFinite(t0) || t0 < 0) return;
    const sel = typeof f.sel === 'string' && f.sel.trim() ? f.sel.trim() : null;
    out.push({
      id: typeof f.id === 'string' && f.id ? f.id : `f${k}`,
      t_inicio: t0, t_fin: Number.isFinite(t1) && t1 >= t0 ? t1 : t0,
      texto: typeof f.texto === 'string' ? f.texto : '',
      sel,
      // `espera_siguiente` (el chat de los videos, 18/11): una «mira» que igual espera, como el QR del día 2 («escanéalo y toca
      // Siguiente»). Para el motor es lo mismo que esperar el clic: pausa al final de la frase hasta el clic o «Siguiente».
      espera_clic: sel ? f.espera_clic !== false || f.espera_siguiente === true : false,
      cierra_despues: f.cierra_despues === true,
    });
  });
  return out.sort((p, q) => p.t_inicio - q.t_inicio);
}

/**
 * La frase con marca que toca en el segundo `t`: la primera ya empezada y sin hacer. Una «Mira aquí» (sin pausa) cuyo tiempo ya
 * pasó se saltea (se adelantó el video): no se marca tarde.
 */
export function fraseParaMarcar(frases: readonly FraseVideo[], t: number, hechas: ReadonlySet<string>): FraseVideo | null {
  for (const f of frases) {
    if (f.t_inicio > t) return null;
    if (!f.sel || hechas.has(f.id)) continue;
    if (!f.espera_clic && t >= f.t_fin) continue;
    return f;
  }
  return null;
}

/**
 * ¿Ya toca cerrar lo que abrió la frase `idQueAbrio` (`cierra_despues`)? Al EMPEZAR la frase que le sigue, TENGA O NO MARCA (20/11,
 * tarde, la segunda verificación de motor-7 y offer-5): el cierre esperaba a la próxima frase CON marca, y como offer-5 no tiene, la
 * lista de proyectos que abrió offer-4 quedaba encima del chat toda su voz («toca aquí, en Analicemos mi oferta»). Sin frase que le
 * siga, lo cierra el final del video (el cierre del motor).
 */
export function cierraYa(frases: readonly FraseVideo[], idQueAbrio: string, t: number): boolean {
  const i = frases.findIndex((f) => f.id === idQueAbrio);
  const sig = i >= 0 ? frases[i + 1] : undefined;
  return !!sig && t >= sig.t_inicio;
}

/**
 * La frase que suena en el segundo `t` (desde su t_inicio hasta un poco después de su t_fin), o null en un silencio entre frases. La usa
 * el reproductor de los chats para avisar cada frase (`onFrase`) y marcar las que tienen lugar (app/_ui/tutorial/VideoDelMomento.tsx;
 * 20/11, la auditoría de chats, videos-5).
 */
export function fraseEnElTiempo<F extends Pick<FraseVideo, 't_inicio' | 't_fin'>>(frases: readonly F[], t: number): F | null {
  return frases.find((f) => t >= f.t_inicio && t < f.t_fin + 0.2) ?? null;
}

/** ¿Este paso de lib/tutoriales marca lo mismo que la frase? (un `sel` del paso puede ser una lista «computadora, teléfono»). */
export function mismoLugar(selPaso: string, selFrase: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
  return norm(selPaso) === norm(selFrase) || selPaso.split(',').map(norm).includes(norm(selFrase));
}

/** Una entrada válida del manifiesto: su `archivo` es de /tutoriales (nunca un video de otro lado). */
function entradaValida(x: unknown): x is VideoTutorial {
  if (!x || typeof x !== 'object') return false;
  const v = x as Record<string, unknown>;
  return typeof v.key === 'string' && v.key.length > 0 && typeof v.archivo === 'string' && /^(\/tutoriales\/)?[\w.-]+\.(mp4|webm)$/.test(v.archivo);
}

/** El video de una key, o null. El archivo sale con su ruta pública. */
export function videoDe(manifiesto: unknown, key: string): VideoTutorial | null {
  const lista = Array.isArray(manifiesto) ? manifiesto : manifiesto && typeof manifiesto === 'object' && Array.isArray((manifiesto as { videos?: unknown }).videos) ? (manifiesto as { videos: unknown[] }).videos : [];
  const v = lista.find((x) => entradaValida(x) && x.key === key) as VideoTutorial | undefined;
  if (!v) return null;
  const ruta = (a: string) => (a.startsWith('/') ? a : `/tutoriales/${a}`);
  const { frases: crudas, ...resto } = v as VideoTutorial & { frases?: unknown };
  const frases = frasesDe(crudas);
  return { ...resto, archivo: ruta(v.archivo), ...(typeof v.poster === 'string' && v.poster ? { poster: ruta(v.poster) } : {}), ...(frases.length ? { frases } : {}) };
}

/**
 * El nombre de lo que la voz marca, de su propia frase: «Toca aquí, en el Objetivo Principal: …» → «Objetivo Principal»;
 * «Mira aquí, el lienzo: …» → «El lienzo». Para la tarjeta cuando ningún paso de lib/tutoriales marca lo mismo.
 */
export function nombreDeFrase(texto: string): string | null {
  const m = /(?:(?:toca|haz clic|mira)\s+aquí,?|aquí,)\s*(?:en\s+)?([^:.,;]+)/i.exec(texto || '');
  if (!m) return null;
  const x = m[1].trim().replace(/^(?:la|el)\s+(?=[A-ZÁÉÍÓÚ¿«])/, '');
  return x ? x[0].toUpperCase() + x.slice(1) : null;
}

/** «Haz clic en …» con el nombre de la frase («Haz clic en la primera de tus cinco tareas», «Haz clic en Ver info»). */
export function hazDeFrase(texto: string): string | null {
  const n = nombreDeFrase(texto);
  if (!n) return null;
  return `Haz clic en ${/^(?:La|El|Los|Las|Un|Una|Tu|Tus) /.test(n) ? n[0].toLowerCase() + n.slice(1) : n}`;
}

/**
 * ¿Las marcas del video son estos pasos, en su orden? (Martín, 18/11: «el video sigue al recorrido, nunca al revés».) Un video cuyas
 * frases marcan otra cosa no reemplaza a los pasos aprobados: ese tutorial va sin él.
 */
export function sigueLosPasos(frases: readonly FraseVideo[], pasos: readonly { sel: string }[]): boolean {
  const conMarca = frases.filter((f) => !!f.sel);
  return conMarca.length === pasos.length && conMarca.every((f, i) => mismoLugar(pasos[i].sel, f.sel as string));
}
