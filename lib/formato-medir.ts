// =============================================================================
// Medir un formato a partir de un video de referencia
// =============================================================================
// SIN `server-only`: es aritmética y necesita test. Es la pieza que decide cuánto
// texto entra en cada toma, y equivocarla no da un error — da anuncios donde la
// persona habla apurada o se queda muda al final.
//
// ── Por qué se MIDE y no se pregunta ───────────────────────────────────────
// El creador de formatos no puede pedirle a nadie «¿cuántas palabras por segundo
// querés?». Nadie sabe eso de sí mismo, y la regla de la casa lo dice: nunca un
// campo libre en un formulario, y se pregunta un HECHO, no una preferencia.
//
// Lo que la persona sí puede dar es un video que le gusta. De ahí sale todo esto
// con aritmética.

import { DURACIONES_FLOW } from './costo-clip';

/** Lo que se puede medir de un video de referencia sin mirarlo con un modelo. */
export type MedidaVideo = {
  /** Duración total, en segundos. De ffprobe. */
  duracion: number;
  /** Palabras del habla. De la transcripción. */
  palabras: number;
  /** Segundos donde arranca cada corte de escena. De ffmpeg. */
  cortes: number[];
};

export type FormatoMedido = {
  /** Palabras por segundo. Lo que decide el tope de cada toma. */
  densidad: number;
  /** Cuántos clips tendría un anuncio así. */
  clips: number;
  /** Cuánto dura cada clip, ya ajustado a lo que Flow genera. */
  segundos: number;
  /** El rango que se guarda en el formato, con aire alrededor de lo medido. */
  rangoClips: [number, number];
  rangoSegundos: [number, number];
  /** Qué tan lejos quedó el clip real del que Flow puede generar, en segundos. */
  ajuste: number;
};

/**
 * La duración de Flow más cercana a `seg`.
 *
 * ⚠️ NO SE REDONDEA HACIA ABAJO NI HACIA ARRIBA POR REGLA: se elige la más
 * cercana. Un clip real de 9 s con un redondeo hacia abajo daría 8 y le
 * apretaría un segundo de texto a cada toma del anuncio; hacia arriba daría 10 y
 * dejaría a la persona muda un segundo. La más cercana reparte el error.
 *
 * Y el catálogo es CERRADO —4, 6, 8, 10— porque pedirle 9 a Flow no da un clip
 * de 9: da uno que no existe.
 */
export function duracionDeFlow(seg: number): number {
  let mejor = DURACIONES_FLOW[0] as number;
  for (const d of DURACIONES_FLOW) {
    // ⚠️ EN UN EMPATE GANA LA MÁS CORTA, y va con `<` a propósito.
    //
    // 9 segundos está exactamente entre 8 y 10. Los dos errores no cuestan lo
    // mismo: con 8 la persona habla un poco apurada, con 10 se queda MUDA un
    // segundo al final —y un clip que termina en silencio se lee como que el
    // video falló—. Además el corto sale 12 créditos y el largo 15.
    //
    // El desempate está escrito y no es un accidente del orden del array: un
    // criterio de desempate decide el 100% de los casos donde el óptimo no es
    // único, y este repo ya pagó uno que se resolvía al revés.
    if (Math.abs(d - seg) < Math.abs(mejor - seg)) mejor = d;
  }
  return mejor;
}

/**
 * De lo medido, el formato.
 *
 * ⚠️ LA DENSIDAD SE CALCULA CONTRA LA DURACIÓN TOTAL, no contra los segundos de
 * habla — y la diferencia importa.
 *
 * `palabrasQueEntran(puesta, segundos)` hace `densidad * segundos`, donde
 * `segundos` es lo que dura el CLIP entero: pausas, respiraciones y silencios
 * incluidos. Así que la densidad tiene que estar medida contra lo mismo, o el
 * tope de cada toma queda inflado y el texto no entra.
 *
 * Y de paso esto esquiva una trampa conocida: los timestamps de palabra de
 * Whisper están estirados —`word.end` cubre la pausa siguiente— así que sumar
 * «segundos de habla» con ellos da un número más grande que el real y una
 * densidad más chica. No hacen falta: palabras ÷ duración es exacto.
 */
export function formatoDeMedida(m: MedidaVideo): FormatoMedido | null {
  if (!(m.duracion > 0) || !(m.palabras > 0)) return null;

  const densidad = Math.round((m.palabras / m.duracion) * 100) / 100;

  // Los cortes marcan el ARRANQUE de cada plano, así que la cantidad de clips es
  // la de cortes (el primero es el arranque del video). Sin cortes detectados es
  // un plano único: un clip.
  const clips = Math.max(1, m.cortes.length);
  const segundosReales = m.duracion / clips;
  const segundos = duracionDeFlow(segundosReales);

  return {
    densidad,
    clips,
    segundos,
    // ⚠️ EL RANGO LLEVA AIRE, y no es decoración: `cabidaDeGuion` busca dentro de
    // él la combinación que hace entrar el guion. Un rango de un solo valor
    // —[7,7]— obliga a que todo guion mida exactamente eso, y el que no entra no
    // tiene a dónde crecer. Con aire, un guion más largo suma tomas en vez de
    // desbordar la última.
    rangoClips: [Math.max(1, clips - 2), Math.min(24, clips + 5)],
    rangoSegundos: rangoAlrededor(segundos),
    ajuste: Math.round(Math.abs(segundos - segundosReales) * 100) / 100,
  };
}

/**
 * El rango de duraciones alrededor de la medida, dentro de lo que Flow genera.
 *
 * Se toma la medida y la de al lado hacia arriba: da margen para que un guion
 * largo pueda usar clips más largos en vez de apretar el texto. Hacia abajo no
 * se abre — un clip más corto que el del formato cambia el ritmo que la persona
 * eligió, y ése es el formato.
 */
export function rangoAlrededor(seg: number): [number, number] {
  const i = DURACIONES_FLOW.indexOf(seg as (typeof DURACIONES_FLOW)[number]);
  if (i < 0) return [seg, seg];
  const arriba = DURACIONES_FLOW[Math.min(DURACIONES_FLOW.length - 1, i + 1)];
  return [seg, arriba];
}

/**
 * ¿La medición es CREÍBLE? Devuelve el motivo por el que no, o `null`.
 *
 * ⚠️ EXISTE PORQUE UN NÚMERO MEDIDO NO ES UN NÚMERO BUENO. Un video de
 * referencia puede ser lo que sea: un tema musical sin habla, una película de
 * dos horas, un clip de tres segundos. De todos ellos sale una densidad, y
 * ninguna sirve.
 *
 * Y lo que hace daño no es el rechazo: es aceptar en silencio. Una densidad de
 * 0,4 se guarda igual de bien que una de 3, no rompe nada al guardarse, y
 * aparece semanas después como «los anuncios de este formato salen todos con la
 * persona callada».
 */
export function porQueNoSirve(m: MedidaVideo, f: FormatoMedido): string | null {
  if (m.duracion < 8) {
    return 'El video dura menos de 8 segundos: no alcanza para medir el ritmo de un anuncio.';
  }
  if (m.duracion > 600) {
    return 'El video dura más de 10 minutos. Usa un anuncio, no una charla: el ritmo de los dos no se parece.';
  }
  if (f.densidad < 1.2) {
    return `Se habla muy poco (${f.densidad} palabras por segundo). Si el video tiene música o silencios largos, recorta la parte donde la persona habla.`;
  }
  // ⚠️ EL TOPE ES 3,4 Y NO 5, Y LA DIFERENCIA ES CONCEPTUAL.
  //
  // La densidad de un video de referencia mide a un HUMANO hablando. La densidad
  // de un formato mide otra cosa: cuánto texto acepta el MODELO DE VIDEO antes
  // de tartamudear. No son la misma magnitud, y la del modelo es más baja.
  //
  // La evidencia es el catálogo: los ocho formatos van de 2,1 a 3, y ninguno
  // llega a 3,5 — esos números salieron de probar contra Flow, no de medir
  // locutores. Un tope de 5 dejaba pasar a cualquiera que hable rápido y le
  // guardaba una densidad que el modelo no puede sostener; el anuncio sale con
  // el avatar trabado, que es justo lo que separa «un video con IA» de un
  // anuncio.
  //
  // 3,4 es el máximo del catálogo con un poco de aire. No es un número medido
  // contra Flow —para eso habría que barrer densidades y mirar los clips— y se
  // deja dicho: es el techo de lo que ya sabemos que funciona, no el techo real.
  if (f.densidad > 3.4) {
    return `Se habla a ${f.densidad} palabras por segundo. El avatar se traba arriba de 3: elige un video donde se hable más pausado, o el anuncio va a salir atropellado.`;
  }
  // ⚠️ Y ÉSTE ES EL QUE MÁS ENGAÑA: un video con 40 cortes no es un formato de
  // anuncio con avatar, es un montaje. Cada corte es un clip de Flow, o sea
  // créditos: 40 clips de 8 s son 480 créditos por anuncio.
  if (f.clips > 20) {
    return `Tiene ${f.clips} cortes. Cada corte es un clip que se paga aparte: un anuncio así costaría ${f.clips * 12} créditos.`;
  }
  return null;
}
