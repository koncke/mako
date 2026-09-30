// =============================================================================
// flujo-aviso — un aviso de MaKo leído como grafo, para dibujarlo
// =============================================================================
// Módulo SIN `server-only` y PURO. El hermano de `lib/flujo-conversacion.ts`:
// aquél dibuja la charla con un LEAD, éste dibuja lo que MaKo te dice A VOS.
// Los tipos, la geometría y las curvas son de `lib/lienzo-grafo.ts`.
//
// ── QUÉ ES UN NODO ACÁ, Y QUÉ NO ──────────────────────────────────────────
// Un nodo es algo que OCURRE. «Te llega al grupo de WhatsApp» era un nodo y se
// fue: el dueño lo marcó con una frase que vale como regla — «es un paso que no
// hace nada». Por dónde sale un mensaje es una propiedad del mensaje, no un paso
// del flujo, y dibujarla como paso hace que el grafo cuente un hecho de más.
// El aviso de que los dos canales están apagados se mudó al nodo del MENSAJE,
// que es de quien es.
//
// ── LAS ARISTAS SALEN DEL DATO ─────────────────────────────────────────────
//   · `frecuenciaMin`            → cada cuánto sale, en la flecha de entrada
//   · el paso `insistir`         → la rama «te lo recuerdo»
//   · `flujo.disparador`         → los eventos que TAMBIÉN lo disparan
//   · `flujo.pasos`              → lo que pasa después, en el camino del evento
//
// ── LO QUE SÍ SE GUARDA: DÓNDE PUSISTE CADA TARJETA ───────────────────────
// La primera versión calculaba el layout y no lo guardaba, con el argumento de
// que para cuatro nodos acomodar a mano es ceremonia. El dueño pidió lo
// contrario — «no se pueden arrastrar por el lienzo las tarjetas, sí deberían»—
// así que las posiciones se persisten por mensaje (`posiciones` en su entrada del
// store). El cálculo queda como el DEFAULT y como el botón de reacomodar: una
// posición guardada de un nodo que ya no existe se ignora sola, y un nodo nuevo
// nace en su lugar calculado en vez de encimarse en el origen.

import {
  ANCHO_NODO, ALTO_MIN, GAP_X, GAP_Y, MARGEN, encerrar,
  type NodoFlujo, type AristaFlujo, type GrafoFlujo,
} from './lienzo-grafo';
import { FRECUENCIAS, SIN_LIMITE } from './disparador-mensaje';
import { EVENTOS, describirPaso, type Disparador, type Paso } from './flujos-tipos';

export type Posiciones = Record<string, { x: number; y: number }>;

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
  /** El disparador POR EVENTO del flujo, si se eligió uno. */
  evento: Disparador | null;
  /** Los pasos del flujo que NO son `insistir`: lo que pasa después. */
  pasos: Paso[];
  /** Dónde arrastró cada tarjeta quien lo editó. */
  posiciones?: Posiciones;
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

/** Lo que dice el nodo de entrada: el hecho, más los eventos que se sumaron. */
export function textoDisparador(a: Pick<AvisoParaGrafo, 'disparador' | 'evento'>): string {
  const d = a.evento;
  const ev = d && d.tipo === 'evento' ? EVENTOS.find((e) => e.key === d.evento)?.label : null;
  return ev ? `${a.disparador}\n\nY también: ${ev.toLowerCase()}.` : a.disparador;
}

export function grafoDeAviso(a: AvisoParaGrafo): GrafoFlujo {
  const nodos: NodoFlujo[] = [];
  const aristas: AristaFlujo[] = [];
  const col = (i: number) => MARGEN + i * (ANCHO_NODO + GAP_X);
  const pos = a.posiciones ?? {};
  /** La posición guardada gana sobre la calculada. Sin fila guardada, la calculada. */
  const en = (id: string, x: number, y: number) => ({ x: pos[id]?.x ?? x, y: pos[id]?.y ?? y });

  const sinCanal = !a.canales.wa && !a.canales.email;
  const conEvento = a.evento?.tipo === 'evento';

  // ── Qué lo dispara. El hecho nativo es un hecho; lo que se ELIGE son los
  // eventos que lo disparan ADEMÁS, y ésos el motor sí los corre.
  nodos.push({
    id: 'entrada', tipo: 'entrada', titulo: 'Qué lo dispara', icono: '⚡',
    detalle: textoDisparador(a),
    ...en('entrada', col(0), MARGEN), ancho: ANCHO_NODO, alto: ALTO_MIN + (conEvento ? 54 : 26),
  });

  // ── El mensaje, como llega. Con el aviso de por dónde sale: es del mensaje,
  // no un paso aparte.
  const altoMensaje = Math.min(300, ALTO_MIN + Math.min(Math.ceil((a.texto || '').length / 32), 10) * 17);
  nodos.push({
    id: 'mensaje', tipo: 'mensaje', titulo: porDondeLlega(a.canales), icono: sinCanal ? '🔇' : a.canales.email && !a.canales.wa ? '✉️' : '💬',
    orden: 1,
    advertencia: sinCanal ? 'Con los dos canales apagados este mensaje no sale.' : undefined,
    ...en('mensaje', col(1), MARGEN), ancho: ANCHO_NODO, alto: altoMensaje,
  });
  aristas.push({ desde: 'entrada', hasta: 'mensaje', etiqueta: cadaCuanto(a.frecuenciaMin), tono: sinCanal ? 'mala' : 'normal' });

  // ── Y si no contestás. Cuelga del MENSAJE: es lo que pasa después de que salió.
  const yAbajo = MARGEN + Math.max(altoMensaje, ALTO_MIN + 54) + GAP_Y + 10;
  nodos.push({
    id: 'respuesta', tipo: 'respuesta', titulo: 'Si no contestas', icono: '↩️',
    detalle: a.insistir ? 'MaKo te lo vuelve a mandar' : 'Se manda una vez y listo',
    ...en('respuesta', col(1), yAbajo), ancho: ANCHO_NODO, alto: ALTO_MIN,
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
      ...en('recordatorio', col(2), yAbajo), ancho: ANCHO_NODO, alto: ALTO_MIN,
    });
    aristas.push({ desde: 'respuesta', hasta: 'recordatorio', etiqueta: 'te lo recuerdo', tono: 'condicional' });
  }

  // ── Lo que pasa DESPUÉS del aviso. Son los pasos del flujo, y corren por el
  // camino del EVENTO: `dispararEvento` es lo único que los ejecuta. Sin un
  // evento elegido quedan dibujados y quietos — y eso lo dice el nodo, porque un
  // paso que no corre y no lo avisa es el control que se dibuja y no hace nada.
  let previo = 'mensaje';
  let x = col(2);
  a.pasos.forEach((p, i) => {
    const id = `paso-${i}`;
    nodos.push({
      id, tipo: p.tipo === 'accion' ? 'accion' : 'mensaje-lead', orden: i,
      titulo: p.tipo === 'accion' ? 'Hace algo' : 'Le escribe al lead',
      icono: p.tipo === 'accion' ? '⚙️' : '📤',
      detalle: describirPaso(p),
      advertencia: conEvento ? undefined : 'Este paso sólo corre cuando el mensaje lo dispara un evento, y todavía no elegiste ninguno.',
      ...en(id, x, MARGEN), ancho: ANCHO_NODO, alto: ALTO_MIN + 8,
    });
    aristas.push({ desde: previo, hasta: id, etiqueta: i === 0 ? 'después' : undefined, tono: conEvento ? 'buena' : 'normal' });
    previo = id;
    x += ANCHO_NODO + GAP_X;
  });

  return { nodos, aristas, ...encerrar(nodos) };
}

/** Las posiciones que ya no corresponden a ningún nodo. Se tiran al guardar: si
 *  no, borrar un paso deja su coordenada para siempre y el próximo con el mismo
 *  id nace en el lugar del que se fue. */
export function podarPosiciones(pos: Posiciones, ids: ReadonlyArray<string>): Posiciones {
  const vivos = new Set(ids);
  const out: Posiciones = {};
  for (const [k, v] of Object.entries(pos)) if (vivos.has(k)) out[k] = v;
  return out;
}

// ── QUÉ PASOS DIBUJA EL LIENZO, Y DÓNDE ENTRA UNO NUEVO ───────────────────
// ⚠️ ESTE FILTRO ESTABA ESCRITO CINCO VECES en `FlujoAviso.tsx` — una por el
// grafo, una por el editor, una por el «quitar» y dos por el alta— y las cinco
// tienen que contestar lo MISMO: el ＋ de la tarjeta `paso-2` sólo inserta en el
// lugar correcto si «cuál es el paso 2» se calcula igual que cuando se dibujó.
// Con dos copias, un `esperar` en el medio corre el índice y el paso nuevo cae
// en otro lado: no da error, queda en el lugar equivocado y el motor lo ejecuta
// ahí. Por eso vive acá, del lado del grafo, que es quien define los ids.

export const esInsistir = (p: Paso): p is Extract<Paso, { tipo: 'insistir' }> => p.tipo === 'insistir';

/** Los pasos que el lienzo dibuja como tarjeta, en el orden en que las dibuja. */
export function pasosDibujados(pasos: Paso[]): Paso[] {
  return pasos.filter((p) => !esInsistir(p) && p.tipo !== 'esperar');
}

/**
 * Un paso nuevo DESPUÉS del nodo `nodoId`.
 *
 * Los ids de los pasos son `paso-<i>` sobre `pasosDibujados`, así que el ＋ de
 * `paso-2` inserta en la posición 3. Cualquier otro nodo —la entrada, el mensaje,
 * el recordatorio— es el TRONCO del aviso y no tiene pasos antes: inserta al
 * principio. Los que el lienzo no dibuja (`insistir`, `esperar`) se conservan
 * enteros y al final: son del mensaje, no de la cadena de pasos.
 */
export function insertarPasoTras(pasos: Paso[], nodoId: string, nuevo: Paso): Paso[] {
  const vivos = pasosDibujados(pasos);
  const otros = pasos.filter((p) => esInsistir(p) || p.tipo === 'esperar');
  const m = /^paso-(\d+)$/.exec(nodoId);
  const corte = m ? Math.min(vivos.length, Number(m[1]) + 1) : 0;
  return [...vivos.slice(0, corte), nuevo, ...vivos.slice(corte), ...otros];
}

/**
 * Saca el paso que el lienzo dibuja en la posición `i`.
 *
 * Recibe el índice de lo DIBUJADO, no del array: el editor de un nodo sabe qué
 * tarjeta está mirando y no tiene por qué saber cuántos `esperar` hay antes.
 */
export function quitarPasoDibujado(pasos: Paso[], i: number): Paso[] {
  const fuera = pasosDibujados(pasos)[i];
  return fuera ? pasos.filter((p) => p !== fuera) : pasos;
}
