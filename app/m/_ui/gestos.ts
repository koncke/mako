// =============================================================================
// La física de los gestos de /m (lógica pura, con test)
// =============================================================================
// Sheet, swipe de fila y pull-to-refresh deciden con las MISMAS cuentas, y esas
// cuentas viven acá para poder probarlas sin un dedo. Los componentes sólo miden
// el puntero y aplican el transform.
//
// De dónde sale cada número:
//   · rubber-band con constante 0,55 — la de Apple (Designing Fluid Interfaces):
//     cuanto más se pasa del borde, menos sigue al dedo.
//   · proyección del momento `v·d/(1−d)` con d = 0,99 — también de Apple: el
//     destino se elige mirando a DÓNDE VA el gesto, no dónde se soltó.
//   · 0,11 px/ms — el umbral de velocidad de Emil Kowalski (Vaul, Sonner): un
//     flick alcanza aunque no haya recorrido la distancia.
//   · 10 px de histéresis y |dx| > 1,5·|dy| para bloquear el eje — antes de eso
//     no se decide nada, y el scroll vertical gana los empates.
// =============================================================================

export const RUBBER = 0.55;
export const VELOCIDAD_FLICK = 0.11; // px/ms
export const HISTERESIS = 10; // px
export const RAZON_EJE = 1.5;
/** Swipe de fila: confirma pasado el 35% del ancho (o con un flick). */
export const UMBRAL_SWIPE = 0.35;
/** Pull-to-refresh: se dispara a los 64 px y se queda en 48 mientras carga. */
export const UMBRAL_PULL = 64;
export const RETENCION_PULL = 48;

/** Resistencia progresiva pasado un borde. Conserva el signo. */
export function rubberband(sobrante: number, dimension: number, c = RUBBER): number {
  if (!sobrante || dimension <= 0) return 0;
  const s = Math.abs(sobrante);
  return Math.sign(sobrante) * ((s * dimension * c) / (dimension + c * s));
}

/** Cuánto más recorre algo soltado a esta velocidad (px/ms) antes de frenar. */
export function proyectar(velocidad: number, desaceleracion = 0.99): number {
  return (velocidad * desaceleracion) / (1 - desaceleracion);
}

export type Muestra = { v: number; t: number };

/**
 * Velocidad (px/ms) de las muestras de los últimos `ventana` ms. Con una sola
 * muestra (o todas en el mismo ms) es 0: no se inventa un flick.
 */
export function velocidadDe(muestras: Muestra[], ventana = 100): number {
  if (muestras.length < 2) return 0;
  const ultima = muestras[muestras.length - 1];
  let primera = ultima;
  for (let i = muestras.length - 2; i >= 0; i--) {
    if (ultima.t - muestras[i].t > ventana) break;
    primera = muestras[i];
  }
  const dt = ultima.t - primera.t;
  return dt > 0 ? (ultima.v - primera.v) / dt : 0;
}

/** El eje de un gesto: null mientras no pasó la histéresis; el vertical gana los empates. */
export function ejeDelGesto(dx: number, dy: number, histeresis = HISTERESIS): 'x' | 'y' | null {
  if (Math.hypot(dx, dy) < histeresis) return null;
  return Math.abs(dx) > RAZON_EJE * Math.abs(dy) ? 'x' : 'y';
}

/**
 * Swipe de una fila: ¿se confirma, y hacia qué lado? Pasado el 35% del ancho o
 * con un flick EN LA MISMA dirección del desplazamiento. Un flick hacia el otro
 * lado cancela aunque la fila esté corrida.
 */
export function decidirSwipe(dx: number, ancho: number, velocidad: number): 'derecha' | 'izquierda' | null {
  if (!dx || ancho <= 0) return null;
  const lado = dx > 0 ? 'derecha' : 'izquierda';
  const mismoSentido = Math.sign(velocidad) === Math.sign(dx);
  if (!mismoSentido && Math.abs(velocidad) > VELOCIDAD_FLICK) return null;
  if (Math.abs(dx) >= UMBRAL_SWIPE * ancho) return lado;
  if (mismoSentido && Math.abs(velocidad) > VELOCIDAD_FLICK) return lado;
  return null;
}

export type SnapSheet = 'cerrado' | 'medio' | 'alto';

/**
 * El destino de un sheet al soltarlo.
 *
 * `visible` es cuánto del panel se ve ahora (px), `velocidad` es px/ms con
 * positivo HACIA ABAJO, `alturas` las alturas visibles de cada snap permitido y
 * `desde` el snap en el que estaba antes de agarrarlo.
 *
 * Se elige el snap más cercano a donde el gesto PROYECTA, y un flick siempre
 * mueve al menos un escalón en su sentido: tirar hacia abajo rápido desde
 * «medio» cierra aunque no se haya pasado de la mitad.
 */
export function destinoDelSheet(p: {
  visible: number;
  velocidad: number;
  alturas: Partial<Record<'medio' | 'alto', number>>;
  desde: 'medio' | 'alto';
}): SnapSheet {
  const escalones: { snap: SnapSheet; h: number }[] = [{ snap: 'cerrado', h: 0 }];
  if (p.alturas.medio != null) escalones.push({ snap: 'medio', h: p.alturas.medio });
  if (p.alturas.alto != null) escalones.push({ snap: 'alto', h: p.alturas.alto });
  escalones.sort((a, b) => a.h - b.h);

  const proyectado = p.visible - proyectar(p.velocidad);
  let elegido = escalones[0];
  for (const e of escalones) if (Math.abs(e.h - proyectado) < Math.abs(elegido.h - proyectado)) elegido = e;

  const iDesde = Math.max(0, escalones.findIndex((e) => e.snap === p.desde));
  const iElegido = escalones.indexOf(elegido);
  if (p.velocidad > VELOCIDAD_FLICK && iElegido >= iDesde) return escalones[Math.max(0, iDesde - 1)].snap;
  if (p.velocidad < -VELOCIDAD_FLICK && iElegido <= iDesde) return escalones[Math.min(escalones.length - 1, iDesde + 1)].snap;
  return elegido.snap;
}

/** Lo que baja el contenido al tirar desde arriba (con resistencia desde el primer px). */
export function distanciaDePull(dy: number, alto: number): number {
  return dy > 0 ? rubberband(dy, alto) : 0;
}
