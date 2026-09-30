// =============================================================================
// flujo-aviso — un aviso de MaKo leído como grafo, para dibujarlo
// =============================================================================
// Módulo SIN `server-only` y PURO. El hermano de `lib/flujo-conversacion.ts`:
// aquél dibuja la charla con un LEAD, éste dibuja lo que MaKo te dice A VOS.
// Los tipos, la geometría y las curvas son de `lib/lienzo-grafo.ts`.
//
// ── UN AVISO ES UN FLUJO CORTO, Y HAY QUE DECIRLO ──────────────────────────
// Son cuatro o cinco nodos, no los veinte de un bot de ManyChat. Lo que el dibujo
// aporta acá no es domar una maraña: es que las CUATRO preguntas de un aviso
// —qué lo dispara, cada cuánto, qué dice, y qué pasa si no contestás— se veían
// como cuatro bloques apilados de un formulario, sin que nada mostrara que el
// recordatorio cuelga de la respuesta y no de la salida del mensaje.
//
// ── LAS ARISTAS SALEN DEL DATO, IGUAL QUE EN EL OTRO ───────────────────────
//   · `frecuenciaMin`           → cada cuánto sale, en la flecha de entrada
//   · el paso `insistir`        → la rama «te lo recuerdo»
//   · `canales` (wa / email)    → por dónde te llega, al final
//
// Nadie conecta nada. El porqué de esa decisión, con la cita del dueño sobre el
// editor de flechas que descartó por «rebuscado», está en `lib/flujo-conversacion.ts`.

import {
  ANCHO_NODO, ALTO_MIN, GAP_X, GAP_Y, MARGEN, encerrar,
  type NodoFlujo, type AristaFlujo, type GrafoFlujo,
} from './lienzo-grafo';
import { FRECUENCIAS, SIN_LIMITE } from './disparador-mensaje';

export type AvisoParaGrafo = {
  /** Qué lo hace salir, en palabras. Sale del catálogo: es un hecho, no una opción. */
  disparador: string;
  /** Cada cuánto, como máximo. 0 = cada vez. */
  frecuenciaMin: number;
  /** El texto que llega. */
  texto: string;
  canales: { wa: boolean; email: boolean };
  /** El paso `insistir` del flujo, si está prendido. */
  insistir: { cadaMin: number; veces: number } | null;
  /** ¿Este mensaje está activo? Un aviso apagado no sale por ningún lado. */
  activo: boolean;
};

/** Cada cuánto sale, dicho corto para una flecha. */
export function cadaCuanto(min: number): string {
  if (!min || min <= SIN_LIMITE) return 'Cada vez que pasa';
  const f = FRECUENCIAS.find((x) => x.min === min);
  return f ? f.label.replace('Máximo uno ', 'Como máximo ') : 'Cada vez que pasa';
}

/** Por dónde te llega, con los dos canales resueltos. */
export function porDondeLlega(c: { wa: boolean; email: boolean }): string {
  if (c.wa && c.email) return 'Al grupo de WhatsApp y a tu correo';
  if (c.wa) return 'Al grupo de WhatsApp';
  if (c.email) return 'A tu correo';
  return 'Por ningún lado: los dos canales están apagados';
}

export function grafoDeAviso(a: AvisoParaGrafo): GrafoFlujo {
  const nodos: NodoFlujo[] = [];
  const aristas: AristaFlujo[] = [];
  const col = (i: number) => MARGEN + i * (ANCHO_NODO + GAP_X);

  // ── Qué lo dispara. Es un HECHO: lo produce el call site que lo emite, y para
  // 60 de los 65 mensajes no hay nada que elegir ahí. Lo editable es cada cuánto,
  // y por eso viaja en la FLECHA y no adentro del nodo.
  nodos.push({
    id: 'entrada', tipo: 'entrada', titulo: 'Qué lo dispara', icono: '⚡',
    detalle: a.disparador,
    x: col(0), y: MARGEN, ancho: ANCHO_NODO, alto: ALTO_MIN + 26,
  });

  // ── El mensaje, como llega.
  const altoMensaje = Math.min(300, ALTO_MIN + Math.min(Math.ceil((a.texto || '').length / 32), 10) * 17);
  nodos.push({
    id: 'mensaje', tipo: 'mensaje', titulo: 'El mensaje', icono: '💬', orden: 1,
    x: col(1), y: MARGEN, ancho: ANCHO_NODO, alto: altoMensaje,
  });
  aristas.push({ desde: 'entrada', hasta: 'mensaje', etiqueta: cadaCuanto(a.frecuenciaMin), tono: 'normal' });

  // ── Por dónde te llega. Es la única salida del mensaje, y se dibuja SIEMPRE —
  // incluso con los dos canales apagados, que es justo cuando hay algo que decir:
  // un aviso sin canal no sale, y hoy eso no se ve en ninguna parte.
  const sinCanal = !a.canales.wa && !a.canales.email;
  nodos.push({
    id: 'salida', tipo: 'salida', titulo: 'Te llega', icono: sinCanal ? '🔇' : a.canales.email && !a.canales.wa ? '✉️' : '📲',
    detalle: porDondeLlega(a.canales),
    advertencia: sinCanal ? 'Con los dos canales apagados este mensaje no sale.' : undefined,
    x: col(2), y: MARGEN, ancho: ANCHO_NODO, alto: ALTO_MIN,
  });
  aristas.push({ desde: 'mensaje', hasta: 'salida', tono: sinCanal ? 'mala' : 'buena' });

  // ── Y si no contestás. Cuelga del MENSAJE, no de la salida: es lo que pasa
  // después de que el mensaje salió, y en el formulario viejo era un bloque más
  // de la columna — se leía como un paso que ocurre siempre.
  const yAbajo = MARGEN + Math.max(altoMensaje, ALTO_MIN + 26) + GAP_Y + 10;
  nodos.push({
    id: 'respuesta', tipo: 'respuesta', titulo: 'Si no contestas', icono: '↩️',
    detalle: a.insistir ? 'MaKo te lo vuelve a mandar' : 'Se manda una vez y listo',
    x: col(1), y: yAbajo, ancho: ANCHO_NODO, alto: ALTO_MIN,
  });
  aristas.push({ desde: 'mensaje', hasta: 'respuesta', etiqueta: 'si no contestas', tono: 'normal' });

  if (a.insistir) {
    const { cadaMin, veces } = a.insistir;
    nodos.push({
      id: 'recordatorio', tipo: 'recordatorio', titulo: 'Te insiste', icono: '🔔',
      detalle: `Cada ${cadaMin} minutos, hasta ${veces} ${veces === 1 ? 'vez' : 'veces'}`,
      // ⚠️ Los recordatorios salen SÓLO por WhatsApp: el choke point los abre
      // adentro del `if` del envío al grupo. Con WhatsApp apagado, el nodo está
      // dibujando algo que no puede ocurrir — y eso se dice, no se esconde.
      advertencia: a.canales.wa ? undefined : 'Los recordatorios salen por WhatsApp, y este mensaje lo tienes apagado ahí.',
      x: col(2), y: yAbajo, ancho: ANCHO_NODO, alto: ALTO_MIN,
    });
    aristas.push({ desde: 'respuesta', hasta: 'recordatorio', etiqueta: 'te lo recuerdo', tono: 'condicional' });
  }

  return { nodos, aristas, ...encerrar(nodos) };
}
