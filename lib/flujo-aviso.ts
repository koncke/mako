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
//
// ── LAS TARJETAS DE LA CASA (10/10/2026, restos de versiones anteriores) ───────
// Martín abrió /automations y el lienzo de un mensaje de MaKo seguía con lo de
// antes de la sexta tanda: el DELAY como tarjeta, el CRON como un texto de varias
// líneas, el ＋ al costado y la CONDITION con flechas rotuladas. Desde acá las
// tarjetas tienen las MISMAS formas que una automatización (`grafoDeSecuencia`,
// lib/flujo-conversacion.ts), y el Lienzo las dibuja con las mismas piezas:
//   · el CRON lleva sus cajitas («Cuando…») y su salida al pie («Entonces ●»);
//   · cada tarjeta, su círculo al pie, con el ＋ adentro si no sigue nada;
//   · la CONDITION, dos filas: la condición y «Si no»;
//   · el DELAY va SOBRE la flecha («⏳ 2 días») cuando está entre dos cosas.
// Lo que NO cambia es el modelo: los pasos siguen siendo una LISTA y el motor
// (`decidir`, lib/flujo-pasos.ts) la recorre igual. Las flechas salen de esa lista.

import {
  ANCHO_NODO, ALTO_MIN, ALTO_PUERTO, GAP_X, GAP_Y, MARGEN, ICONO_MAKO, ICONO_GMAIL, encerrar, posicionDePildora,
  type NodoFlujo, type AristaFlujo, type GrafoFlujo, type PuertoNodo,
} from './lienzo-grafo';
import { rotuloDeEvento, describirPaso, type Disparador, type Paso } from './flujos-tipos';
import { textoCron, type CronAviso } from './cron-aviso';
// Las posiciones y su poda son de los DOS lienzos (éste y el de /automations, desde la quinta tanda):
// viven en lib/lienzo-posiciones.ts y se re-exportan acá para los que ya las importaban de este módulo.
import { podarPosiciones, type Posiciones } from './lienzo-posiciones';
// Los títulos, los íconos y los altos de las tarjetas de la casa (CRON · DELAY · CONDITION · ACTION ·
// MAKO EN WHATSAPP): UN lugar para los dos lienzos. Este módulo no lo importa nadie de los que importa
// ése: no hay ciclo.
import {
  TITULO, ICONO_CRON, ICONO_ACCION, ALTO_MAKO, ALTO_PILDORA, ANCHO_PILDORA, altoConFilas, altoCron, altoDeMensaje,
  type DisparadorTarjeta, type PasoParaGrafo,
} from './flujo-conversacion';
import { correSuFlujo } from './avisos-catalogo';
import { ROTULO_CONDICION, DELAY_MAX_HORAS, sanearHoras, type CondicionFlujo } from './flujo-pasos';
import { textoDuracion, unidadMostrada, type UnidadEspera } from './espera-duracion';
export { podarPosiciones, type Posiciones };

/** El título de la tarjeta del mensaje al grupo (MaKo en WhatsApp 1: «El título debe ser ese»). */
export const TITULO_MAKO_EN_WHATSAPP = TITULO.mako;

/**
 * Lo que dice la tarjeta de un mensaje al grupo: su texto, en una línea y cortado con «…» (WhatsApp
 * 12, sexta tanda: «si el mensaje es muy largo, que termine con "..." en lugar de mostrarlo todo,
 * así no se rompe el diseño»). La tarjeta de un paso tiene alto fijo.
 */
export function recorteDeTarjeta(texto: string | null | undefined, tope = 90): string {
  const t = String(texto ?? '').replace(/\s+/g, ' ').trim();
  return t.length > tope ? `${t.slice(0, tope - 1).trimEnd()}…` : t;
}

export type AvisoParaGrafo = {
  /** Qué lo hace salir, en palabras. Sale del catálogo: es un hecho, no una opción. */
  disparador: string;
  /** Cada cuánto, como máximo. 0 = cada vez. */
  frecuenciaMin: number;
  /** El texto que llega. */
  texto: string;
  canales: { wa: boolean; email: boolean };
  /** El asunto del correo, si tiene uno propio. Lo dibuja la tarjeta EMAIL. */
  asunto?: string;
  /** Cómo se llama el mensaje: es el asunto por default. */
  titulo?: string;
  /** El paso `insistir` del flujo, si está prendido. */
  insistir: { cadaMin: number; veces: number } | null;
  /** El disparador POR EVENTO del flujo, si se eligió uno. */
  evento: Disparador | null;
  /** Los pasos del flujo que NO son `insistir`: lo que pasa después. */
  pasos: Paso[];
  /** Dónde arrastró cada tarjeta quien lo editó. */
  posiciones?: Posiciones;
  /** El agendado por TIEMPO, si hay uno. Vive en su tabla (mig 0183), no en el store. */
  cron?: CronAviso | null;
  /** La zona con la que se agendó. Va al texto: «a la mañana» no dice a qué hora. */
  tz?: string | null;
  /**
   * El id del aviso. Con él el grafo sabe si el código que emite el aviso CORRE TAMBIÉN su flujo
   * (`correSuFlujo` del catálogo: la cobranza), y entonces sus pasos corren sin elegir un evento.
   * Ausente = no se sabe, y vale lo de siempre (sólo con un evento).
   */
  id?: string;
  /**
   * Quien monta sabe elegir un CRON (puede editar el flujo): la tarjeta dibuja «＋ Nuevo CRON» debajo
   * de sus cajitas mientras no haya ninguno elegido. Con uno elegido no va: un mensaje sale por tiempo
   * O por un evento, nunca por los dos (la regla del 04/10, `SeccionCron` en app/agencia/FlujoAviso.tsx),
   * y un «＋» que no puede sumar nada es un control que no hace nada.
   */
  nuevoCron?: boolean;
};


/** Por dónde te llega, con los dos canales resueltos. */
export function porDondeLlega(c: { wa: boolean; email: boolean }): string {
  if (c.wa && c.email) return 'Al grupo de WhatsApp y a tu correo';
  if (c.wa) return 'Al grupo de WhatsApp';
  if (c.email) return 'A tu correo';
  return 'Por ningún lado: los dos canales están apagados';
}

/**
 * Lo que dice el nodo CRON, y es lo único que la tarjeta AFIRMA.
 *
 * Los tres estados, en el orden en que mandan:
 *   · agendado por TIEMPO  → la frase del cron, con su zona
 *   · disparado por una ACCIÓN → el evento
 *   · ninguno de los dos   → el disparador nativo, en una línea
 *
 * ⚠️ El nativo se dice SIEMPRE, incluso con un cron puesto: agendar no apaga el
 * código que produce el aviso. Una tarjeta que sólo dijera «todos los lunes a las 9»
 * sobre un mensaje que además sale cuando entra un lead estaría contando la mitad — y
 * es la mitad que nadie va a auditar, porque suena completa.
 */
export function textoDisparador(a: Pick<AvisoParaGrafo, 'disparador' | 'evento' | 'cron' | 'tz'>): string {
  const partes: string[] = [];
  if (a.cron) partes.push(textoCron(a.cron, a.tz));
  const d = a.evento;
  // `rotuloDeEvento` y no `EVENTOS`: un flujo guardado con un evento que quedó sin emisor tiene que
  // seguir diciéndolo («… (ya no se dispara)») en vez de desaparecer de la tarjeta.
  const ev = d && d.tipo === 'evento' ? rotuloDeEvento(d.evento) : null;
  if (ev) partes.push(`Cuando ${ev.toLowerCase()}.`);
  // ⚠️ EL HECHO NATIVO VA ÚLTIMO Y ROTULADO, o se lee como una PRECONFIGURACIÓN.
  //
  // Antes iba primero y pelado, así que la tarjeta titulada «CRON» arrancaba con
  // «Cron los lunes a la mañana» y el dueño lo leyó exactamente así: «estás
  // PRECONFIGURANDO el cron, pusiste "Los lunes a la mañana" pero hard codeado,
  // cuando JUSTAMENTE lo estamos haciendo editable». Y tenía razón en lo que veía:
  // ese texto es el campo `disparador` del catálogo —la descripción de fábrica del
  // aviso— con el agendado real en null al lado.
  //
  // No se borra, porque es cierto y es la única línea que dice que ~30 de los 65
  // mensajes ya salen solos desde el código que los produce. Se rotula: «Hoy sale
  // solo» es un hecho del sistema, no un ajuste que alguien eligió.
  if (a.disparador.trim()) partes.push(`Hoy sale solo: ${disparadorCorto(a.disparador).toLowerCase()}`);
  return partes.join(NL_TXT) || 'Sin configurar';
}
const NL_TXT = '\n';

/**
 * LAS CAJITAS DE LA TARJETA CRON («Cuando…», como en ManyChat y en una automatización: `CuerpoCron`,
 * app/automations/FlujoLienzo.tsx). Lo mismo que dice `textoDisparador`, una cajita por cosa y en el
 * mismo orden: lo configurado primero (el horario o el evento) y el hecho nativo último, rotulado.
 *
 * El `id` es lo que se toca: el horario y el evento abren el editor del CRON; el nativo (`''`) no es
 * algo que se elija, así que se dibuja como texto (tocarlo abre la tarjeta igual). El ícono es la clave
 * de `IconoDisparador`: el calendario del Recurrente y el rayo del evento.
 */
export function disparadoresDeAviso(a: Pick<AvisoParaGrafo, 'disparador' | 'evento' | 'cron' | 'tz'>): DisparadorTarjeta[] {
  const out: DisparadorTarjeta[] = [];
  if (a.cron) out.push({ id: 'tiempo', texto: textoCron(a.cron, a.tz), icono: 'recurrente' });
  const d = a.evento;
  // `rotuloDeEvento` y no `EVENTOS`: un evento que quedó sin emisor se sigue nombrando (ver `textoDisparador`).
  const ev = d && d.tipo === 'evento' ? rotuloDeEvento(d.evento) : null;
  if (ev) out.push({ id: 'evento', texto: `Cuando ${ev.toLowerCase()}`, icono: 'otro' });
  if (a.disparador.trim()) out.push({ id: '', texto: `Hoy sale solo: ${disparadorCorto(a.disparador).toLowerCase()}` });
  return out.length ? out : [{ id: '', texto: 'Sin configurar' }];
}

/**
 * LA TARJETA DE LA QUE CUELGA LA CADENA DE PASOS: «MaKo en WhatsApp», o la del EMAIL si WhatsApp está
 * apagado (con los dos apagados, la que dice que no sale por ningún lado, que también es `mensaje`). Es
 * la única de las del mensaje con salida: con los dos canales prendidos el email sale A LA VEZ que el
 * WhatsApp y no tiene un «después» propio (`insertarPasoTras` cuelga del tronco todo lo que no es un
 * `paso-N`), así que un círculo ahí prometería un lugar que no existe.
 */
export function cabezaDeCadena(c: { wa: boolean; email: boolean }): 'mensaje' | 'mensaje-email' {
  return !c.wa && c.email ? 'mensaje-email' : 'mensaje';
}

/** Las dos filas de una CONDITION: la condición (se cumple → el paso de al lado) y «Si no» (lo saltea). */
export const PUERTO_SI = 'si';
export const PUERTO_SI_NO = 'si_no';

/** Lo que dice la pastilla de una espera: «24 h», «2 días», «90 min». Lo que el motor ESPERA, acotado como él (`sanearHoras`). */
export function textoEsperaAviso(horas: unknown): string {
  return textoDuracion(segundosDeEspera(horas));
}

// ── LA ESPERA DE UN MENSAJE, EN LAS UNIDADES DE UN DELAY ──────────────────────────────────────
// El DELAY de una automatización ofrece segundos, minutos, horas y días (lib/espera-duracion.ts). El de
// un mensaje de MaKo lo corre OTRO motor (`decidir`, lib/flujo-pasos.ts), que guarda `horas` y las acota
// a su marco: de un minuto (`DELAY_MIN_HORAS`) a 30 días (`DELAY_MAX_HORAS`). Ofrecer segundos o un año
// sería prometer una espera que el motor no cumple (AGENTS.md: «Un número tuyo por encima del suyo no
// protege: promete»): hasta el 10/10 el editor dejaba escribir 8760 horas y el motor esperaba 720.

/** Las unidades que se ofrecen: las de un DELAY, sin los segundos (el motor espera de a minutos). */
export const UNIDADES_ESPERA_AVISO: readonly UnidadEspera[] = ['min', 'h', 'dias'];
/** El techo, en segundos: el del motor. */
export const ESPERA_AVISO_MAX_S = DELAY_MAX_HORAS * 3600;

/** Lo que el motor ESPERA para estas horas (acotado como él), en minutos enteros: lo que la pantalla muestra. */
export function segundosDeEspera(horas: unknown): number {
  return Math.min(ESPERA_AVISO_MAX_S, Math.max(60, Math.round((sanearHoras(horas) * 3600) / 60) * 60));
}

/** Las horas que se GUARDAN para N segundos, con el marco del motor y en minutos enteros. */
export function horasDeEspera(segundos: number): number {
  const s = Number.isFinite(segundos) ? segundos : 60;
  return Math.min(ESPERA_AVISO_MAX_S, Math.max(60, Math.round(s / 60) * 60)) / 3600;
}

/**
 * La unidad que se muestra: la que eligió la persona si la expresa entera (`unidadMostrada`, la misma regla
 * que un DELAY: tipear no hace saltar la unidad), y nunca una que no se ofrece (los segundos).
 */
export function unidadDeEsperaAviso(segundos: number, preferida: UnidadEspera | null | undefined): UnidadEspera {
  const u = unidadMostrada(segundos, preferida);
  return UNIDADES_ESPERA_AVISO.includes(u) ? u : 'min';
}

/** El renglón del nombre «MaKo» en la burbuja de la tarjeta (11,5 px y su aire: `BurbujaHilo`, `autor`). */
export const RENGLON_AUTOR_BURBUJA = 16;
/** El renglón de abajo de la burbuja (el recordatorio, a 11,5 px y con su margen). */
export const RENGLON_DETALLE_TARJETA = 18;

/**
 * El mensaje de una tarjeta, como lo mide el árbol de una automatización (`altoDeMensaje`): la misma
 * cuenta para que los renglones que dibuja la burbuja (`renglonesDeTarjeta`, app/automations/FlujoLienzo.tsx)
 * terminen en «…» donde termina la tarjeta (WhatsApp 12: «así no se rompe el diseño»).
 */
export function pasoDeTarjeta(texto: string, canal: 'whatsapp' | 'email' = 'whatsapp', asunto: string | null = null): PasoParaGrafo {
  return { orden: 1, canal, delay_horas: 0, asunto, cuerpo: texto ?? '', template_wa: null, tipo: 'texto' } as PasoParaGrafo;
}

export function grafoDeAviso(a: AvisoParaGrafo): GrafoFlujo {
  const col = (i: number) => MARGEN + i * (ANCHO_NODO + GAP_X);
  const pos = a.posiciones ?? {};
  /** La posición guardada gana sobre la calculada. Sin fila guardada, la calculada. */
  const en = (id: string, x: number, y: number) => ({ x: pos[id]?.x ?? x, y: pos[id]?.y ?? y });

  const sinCanal = !a.canales.wa && !a.canales.email;
  const conEvento = a.evento?.tipo === 'evento';
  /**
   * ¿Los pasos CORREN? Con un evento elegido, sí (`dispararEvento`). Y también cuando el código que
   * emite el aviso corre su flujo (`correSuFlujo`, la cobranza: `correrFlujoDe`).
   *
   * ⚠️ SIN ESTO LA PLANTILLA DE FÁBRICA DE LA COBRANZA SE DIBUJABA ROTA (sexta tanda, General 15):
   * sus cuatro pasos —que el cron corre— salían con «Este paso sólo corre cuando el mensaje lo
   * dispara un evento», y una tarjeta con advertencia se pinta como rota (`TarjetaNodo roto`). Era
   * falso en las cuatro, y es la plantilla que Martín pidió editable el 04/10.
   */
  const corren = conEvento || (a.id != null && correSuFlujo(a.id));
  const pasos = a.pasos;
  const cabeza = cabezaDeCadena(a.canales);

  // ── Lo que pasa DESPUÉS del aviso. Son los pasos del flujo, y corren por el
  // camino del EVENTO (`dispararEvento`) o, en los avisos que el código emite Y
  // corre (`correSuFlujo`: la cobranza), por `correrFlujoDe`. Si no, quedan
  // dibujados y quietos — y eso lo dice el nodo, porque un paso que no corre y no
  // lo avisa es el control que se dibuja y no hace nada.
  //
  // ⚠️ LAS FLECHAS SALEN DEL MOTOR (`decidir`, lib/flujo-pasos.ts), que recorre una LISTA: un paso
  // sigue en el de al lado, y una CONDITION sigue en el de al lado si se cumple y en el de DOS más
  // allá si no (`paso + 2`). Un diagrama que esconde el salto es un diagrama que miente.
  const ids = pasos.map((_, i) => `paso-${i}`);
  const salidas = (i: number): Array<{ puerto: string; hasta: number }> => {
    if (pasos[i]?.tipo === 'condicional') {
      return [{ puerto: PUERTO_SI, hasta: i + 1 }, { puerto: PUERTO_SI_NO, hasta: i + 2 }].filter((s) => s.hasta < pasos.length);
    }
    return i + 1 < pasos.length ? [{ puerto: 'sig', hasta: i + 1 }] : [];
  };
  // Cuántas flechas le llegan a cada paso: la del tronco al primero, y las de las salidas de cada uno.
  const padres = pasos.map((_, i) => (i === 0 ? 1 : 0));
  pasos.forEach((_, i) => { for (const s of salidas(i)) padres[s.hasta] += 1; });
  /**
   * ⚠️ EL DELAY VA SOBRE LA FLECHA (sexta tanda, DELAY 1: «Que Delay no sea una tarjeta, que la flecha
   * no se corte, que sea algo en medio de la flecha, más sutil»), con la MISMA regla que una
   * automatización (`grafoDeSecuencia`): una espera con UNA sola flecha que le llega y algo después.
   * Ahí la flecha va de lo de antes a lo de después sin cortarse y la espera es su pastilla (un nodo
   * `enFlecha`: se toca, se edita y se borra igual). Una espera al final, o a la que le llegan dos
   * flechas (la del «Si no» de una CONDITION y la de su paso de al lado), se dibuja como su píldora.
   */
  const enFlecha = (i: number): boolean => pasos[i]?.tipo === 'esperar' && padres[i] === 1 && i + 1 < pasos.length;
  /** Desde el paso `d`: las esperas que van en la flecha y el paso al que la flecha llega. */
  const tramo = (d: number): { hasta: number; esperas: number[] } => {
    const esperas: number[] = [];
    let cur = d;
    while (cur < pasos.length && enFlecha(cur)) { esperas.push(cur); cur += 1; }
    return { hasta: cur, esperas };
  };

  const advertenciaSinEvento = corren ? undefined : 'Este paso sólo corre cuando el mensaje lo dispara un evento, y todavía no elegiste ninguno.';
  /**
   * ⚠️ LOS TÍTULOS SON LOS DE LA CASA (sexta tanda, General 15 y MaKo en WhatsApp 2: «El editable de
   * MaKo en WhatsApp debe ser lo mismo que el editable de WhatsApp»). Decían «Hace algo», «Espera»,
   * «Si pasa esto» y «Te lo recuerda» al lado de tarjetas CRON y MAKO EN WHATSAPP, en la misma lista
   * que las automatizaciones, donde la misma cosa se llama ACTION, DELAY y CONDITION (`TITULO`). Y el
   * mensaje al GRUPO es la tarjeta de MaKo (`tipo: 'mako'`): su detalle es SU TEXTO —lo que sale
   * (lib/flujos.ts)— y no «Avisar al dueño».
   *
   * ⚠️ UN PASO DE MENSAJE NO ES SIEMPRE «AL LEAD», Y LA TARJETA LO TIENE QUE DECIR. El «al lead» de
   * antes NO SE ENVÍA (decisión de Martín, 06/10/2026: «nada al cliente», la rama de lib/flujos.ts),
   * así que su tarjeta lleva la marca: un título que dice «le escribe» sobre algo que no sale es la
   * afirmación de más que esta casa no dibuja.
   */
  const tarjetaDe = (p: Paso, i: number): Omit<NodoFlujo, 'id' | 'x' | 'y' | 'orden'> => {
    const sig: PuertoNodo[] = [{ id: 'sig', vacio: i + 1 >= pasos.length }];
    if (p.tipo === 'condicional') {
      const puertos: PuertoNodo[] = [
        { id: PUERTO_SI, rotulo: ROTULO_CONDICION[p.condicion as CondicionFlujo] ?? describirPaso(p), tono: 'buena', vacio: i + 1 >= pasos.length },
        // ⚠️ EL «SI NO» NO OFRECE «＋», y por eso va LLENO aunque no siga en nada: lo que se agrega en
        // una lista va en un lugar de la lista, y el de dos más allá también lo recorre el «sí» (después
        // del de al lado). Un ＋ ahí agregaría algo para los dos caminos desde la fila de uno. Sin un paso
        // dos más allá el motor termina, y la fila lo dice.
        { id: PUERTO_SI_NO, rotulo: i + 2 < pasos.length ? 'Si no' : 'Si no, termina', tono: 'mala', vacio: false },
      ];
      return { tipo: 'condicion', familia: 'control', titulo: TITULO.condicion, icono: '🔀', detalle: describirPaso(p), puertos, ancho: ANCHO_NODO, alto: altoConFilas(puertos.length), advertencia: advertenciaSinEvento };
    }
    if (p.tipo === 'esperar') {
      return { tipo: 'espera', familia: 'control', titulo: TITULO.esperar, icono: '⏳', detalle: textoEsperaAviso(p.horas), puertos: sig, ancho: ANCHO_PILDORA, alto: ALTO_PILDORA, advertencia: advertenciaSinEvento };
    }
    if (p.tipo === 'accion') {
      return { tipo: 'accion', familia: 'contenido', titulo: TITULO.accion, icono: ICONO_ACCION, detalle: describirPaso(p), puertos: sig, salidaAlPie: true, ancho: ANCHO_NODO, alto: ALTO_MIN + 14 + ALTO_PUERTO, advertencia: advertenciaSinEvento };
    }
    if (p.tipo === 'mensaje' && p.canal === 'aviso_dueno') {
      return {
        tipo: 'mako', familia: 'contenido', titulo: TITULO_MAKO_EN_WHATSAPP, icono: ICONO_MAKO,
        detalle: recorteDeTarjeta(p.texto) || describirPaso(p), puertos: sig, salidaAlPie: true,
        ancho: ANCHO_NODO, alto: ALTO_MAKO + ALTO_PUERTO, advertencia: advertenciaSinEvento,
      };
    }
    return {
      tipo: 'mensaje-lead', familia: 'contenido', titulo: 'Le escribe al lead', icono: '📤', detalle: describirPaso(p),
      puertos: sig, salidaAlPie: true, ancho: ANCHO_NODO, alto: ALTO_MIN + 14 + ALTO_PUERTO,
      advertencia: advertenciaSinEvento ?? 'No se envía: nada sale al cliente.',
    };
  };

  // ── Dónde va cada tarjeta: una fila, una columna por tarjeta dibujada (la pastilla de una espera no
  // ocupa columna).
  //
  // ⚠️ LA TARJETA DEL «SÍ» DE UNA CONDITION CON SALTO SUBE UNA FILA. El «Si no» va a la tarjeta de dos
  // más allá, y en la misma fila su flecha —que sale horizontal de la fila de abajo— pasaba POR DETRÁS
  // de la tarjeta del «sí», que se lee como que el «si no» entra ahí (medido en el navegador el
  // 10/10/2026; bajar lo de después no alcanzaba: la flecha sale horizontal y se mete igual). Arriba,
  // como en el árbol de una automatización (el «sí» arriba, el «si no» abajo), el «Si no» va derecho
  // por la fila y el «sí» sube y vuelve a bajar. Para que nada quede con `y` negativa, la fila entera
  // baja lo que sube la más alta (sólo lo calculado: lo que alguien movió se queda donde lo dejó).
  const tarjetas = pasos.map((p, i) => tarjetaDe(p, i));
  const destinosDelSiNo = new Set<number>();
  pasos.forEach((p, i) => { if (p.tipo === 'condicional' && i + 2 < pasos.length) destinosDelSiNo.add(i + 2); });
  const sube = pasos.map((_, i) => i > 0 && pasos[i - 1].tipo === 'condicional' && i + 1 < pasos.length
    && !enFlecha(i) && !destinosDelSiNo.has(i));
  const fila = MARGEN + Math.max(0, ...tarjetas.map((t, i) => (sube[i] ? t.alto + GAP_Y : 0)));

  const nodos: NodoFlujo[] = [];
  const aristas: AristaFlujo[] = [];

  // ── EL CRON: una cajita por cosa que lo dispara y su salida al pie (sexta tanda, CRON 10) ──
  // El alto es FIJO (lleva salida) y se SUMA por cajita con las mismas piezas que una automatización
  // (`altoCron`). Su salida va siempre llena: lo que sigue al CRON es el mensaje, que no se elige.
  const disparadores = disparadoresDeAviso(a);
  const conNuevoCron = !!a.nuevoCron && !a.cron && !conEvento;
  nodos.push({
    id: 'entrada', tipo: 'entrada', familia: 'contenido', titulo: TITULO.cron, icono: ICONO_CRON,
    detalle: textoDisparador(a),
    puertos: [{ id: 'sig', vacio: false }], salidaAlPie: true,
    ...en('entrada', col(0), fila), ancho: ANCHO_NODO,
    alto: altoCron(disparadores.map((d) => d.texto), conNuevoCron, 1),
  });

  /**
   * ⚠️ UNA TARJETA POR CANAL, Y EL CANAL SIGUE SIENDO UN CAMPO.
   *
   * Pedido el 04/10/2026: «cambia la tarjeta de "Mensaje" por "WhatsApp" y agrega la
   * tarjeta de "Email" así utilizamos el mismo tablero para ambos», junto con «las
   * secuencias de email o WhatsApp es lo mismo, no se gestiona aparte».
   *
   * Lo que NO se hizo es volver el canal un NODO, que es lo que el dueño ya tumbó una
   * vez («es un paso que no hace nada»): estas dos tarjetas se DERIVAN de `a.canales`,
   * el par de booleanos del mensaje, igual que todo lo demás del lienzo sale del dato.
   * Cada una dibuja un mensaje que OCURRE —uno que sale por WhatsApp, uno que sale por
   * mail—, no la propiedad «por dónde».
   *
   * ⚠️ EL ID DE WHATSAPP SIGUE SIENDO `mensaje`, A PROPÓSITO. Las posiciones guardadas
   * se podan POR ID (`podarPosiciones`), así que renombrarlo borraba en el primer
   * arrastre la coordenada de todo el que había movido su tarjeta — y además
   * `FlujoAviso.tsx` pregunta por ese id para decidir qué editor abre. El del mail es nuevo y
   * no tiene nada que conservar.
   *
   * ⚠️ Y SÓLO LA CABEZA DE LA CADENA TIENE SALIDA (`cabezaDeCadena`): con los dos prendidos, el mail
   * es `puertos: []` (termina ahí, sin círculo), y los dos salen del CRON a la vez.
   */
  const recordatorio = a.insistir
    ? `🔔 Te lo recuerda cada ${textoCadencia(a.insistir.cadaMin)}, hasta ${a.insistir.veces} ${a.insistir.veces === 1 ? 'vez' : 'veces'}`
    : null;
  const hayPasos = pasos.length > 0;
  /**
   * ⚠️ CON UN CANAL APAGADO, EL CÍRCULO DE LA CABEZA OFRECE SU «＋» AUNQUE YA SIGA EN ALGO (`paralelo`):
   * prender el otro canal es agregar algo que sale A LA VEZ —su tarjeta aparece al lado, no después—,
   * que es lo que un «＋» en paralelo significa en una automatización. Ese ＋ ofrece SÓLO los canales
   * (`opcionesEn` en app/agencia/FlujoAviso.tsx): un paso no puede ir en paralelo en una lista. Sin
   * esto, con pasos puestos no quedaba en el lienzo cómo prender el mail (el ＋ del costado se fue).
   */
  const canalPorPrender = !a.canales.wa || !a.canales.email;
  const salidaDe = (id: string): Pick<NodoFlujo, 'puertos' | 'salidaAlPie'> => (id === cabeza
    ? { puertos: [{ id: 'sig', vacio: !hayPasos, ...(canalPorPrender ? { paralelo: true } : {}) }], salidaAlPie: true }
    : { puertos: [] });
  const conSalida = (id: string) => (id === cabeza ? ALTO_PUERTO : 0);
  const delMensaje: string[] = [];

  if (sinCanal) {
    // Con los dos apagados no hay tarjeta de canal que dibujar, y el hecho sigue
    // necesitando dónde decirse: queda UNA que dice que no sale por ningún lado. Sin
    // esto el lienzo mostraría el disparador y después nada, que se lee como que
    // falta algo en la pantalla y no como que el mensaje está apagado.
    nodos.push({
      id: 'mensaje', tipo: 'mensaje', familia: 'contenido', titulo: 'MENSAJE', icono: '🔇', orden: 1,
      detalle: porDondeLlega(a.canales),
      advertencia: 'Con los dos canales apagados este mensaje no sale.',
      ...salidaDe('mensaje'),
      ...en('mensaje', col(1), fila), ancho: ANCHO_NODO, alto: ALTO_MIN + RENGLON_DETALLE_TARJETA + conSalida('mensaje'),
    });
    delMensaje.push('mensaje');
  } else {
    let yMensaje = fila;
    if (a.canales.wa) {
      /**
       * ⚠️ ES LA TARJETA DE MaKo, NO LA DE UN WHATSAPP (sexta tanda, MaKo en WhatsApp 3: «Revisa que
       * todas las "Notificaciones" están configuradas con la tarjeta de WhatsApp en lugar de la de
       * MaKo... Eso está mal»). Este mensaje lo manda MaKo al GRUPO del negocio, y en el lienzo del
       * Chatbot ese mensaje es la tarjeta «MaKo en WhatsApp». La identidad la pone `tipo: 'mako'`: es
       * lo que `identidadDeTarjeta` (app/_components/Lienzo.tsx) pinta con el dorado de MaKo, y
       * `ICONO_MAKO` es su logo. El ID sigue siendo `mensaje` (ver arriba): las posiciones y el ＋.
       *
       * El alto es FIJO (lleva salida): la burbuja con el nombre «MaKo» arriba, el texto hasta donde
       * entra (y «…»), y el recordatorio si hay uno.
       */
      const alto = altoDeMensaje(pasoDeTarjeta(a.texto)) + RENGLON_AUTOR_BURBUJA
        + (recordatorio ? RENGLON_DETALLE_TARJETA : 0) + conSalida('mensaje');
      nodos.push({
        id: 'mensaje', tipo: 'mako', familia: 'contenido', titulo: TITULO_MAKO_EN_WHATSAPP, icono: ICONO_MAKO, orden: 1,
        detalle: recordatorio ?? '',
        ...salidaDe('mensaje'),
        ...en('mensaje', col(1), yMensaje), ancho: ANCHO_NODO, alto,
      });
      delMensaje.push('mensaje');
      yMensaje += alto + GAP_Y;
    }
    if (a.canales.email) {
      // EL EMAIL SE DIBUJA COMO UN MAIL (como en una automatización: `VistaEmail`): el asunto arriba y
      // el cuerpo —que es el MISMO texto del mensaje— abajo. Su alto, con la misma cuenta.
      const asuntoVisible = a.asunto?.trim() || a.titulo || '';
      const alto = altoDeMensaje(pasoDeTarjeta(a.texto, 'email', asuntoVisible)) + conSalida('mensaje-email');
      nodos.push({
        id: 'mensaje-email', tipo: 'mensaje', familia: 'contenido', canal: 'email', titulo: TITULO.email, icono: ICONO_GMAIL, orden: 1,
        // El ASUNTO del correo, que es lo único propio de este canal. Vacío = el título
        // del mensaje, y entonces la tarjeta lo muestra en gris: «(el título)» sería
        // un dato inventado, y el título a secas se lee como el asunto de verdad.
        detalle: a.asunto?.trim() || a.titulo,
        // El recordatorio sale SÓLO por WhatsApp (`insistir`). Con el mail
        // prendido y WhatsApp apagado, la advertencia viaja en la tarjeta del canal
        // que sí existe, que es la única que alguien va a mirar.
        advertencia: recordatorio && !a.canales.wa
          ? 'Los recordatorios salen por WhatsApp, y este mensaje lo tienes apagado ahí.'
          : undefined,
        ...salidaDe('mensaje-email'),
        ...en('mensaje-email', col(1), yMensaje), ancho: ANCHO_NODO, alto,
      });
      delMensaje.push('mensaje-email');
    }
  }
  // Del CRON salen las tarjetas del mensaje, a la vez. ⚠️ SIN «＋» EN EL MEDIO (`sinMas`): entre el CRON
  // y el mensaje no entra nada —el mensaje es lo que el CRON dispara— y el ＋ de esa flecha insertaba
  // al PRINCIPIO de los pasos, o sea DESPUÉS del mensaje: señalaba un lugar y el paso caía en otro.
  for (const id of delMensaje) {
    aristas.push({ desde: 'entrada', hasta: id, puerto: 'sig', tono: sinCanal ? 'mala' : 'normal', sinMas: true });
  }

  let columna = 2;
  pasos.forEach((_, i) => {
    const id = ids[i];
    if (enFlecha(i)) {
      // La posición viva la calcula el lienzo de la flecha que la lleva (`posicionDePildora`, abajo).
      nodos.push({ ...tarjetas[i], id, orden: i, enFlecha: true, puertos: [], salidaAlPie: undefined, x: 0, y: 0 });
      return;
    }
    nodos.push({ ...tarjetas[i], id, orden: i, ...en(id, col(columna), sube[i] ? fila - tarjetas[i].alto - GAP_Y : fila) });
    columna += 1;
  });

  // ── Las flechas: una por salida con destino, desde SU fila, con las esperas que llevan encima ──
  // El tono dice si la cadena CORRE (verde) o está quieta (gris): es lo que distingue «esto sigue» de
  // «esto está dibujado y no pasa».
  const tono = corren ? 'buena' as const : 'normal' as const;
  const flecha = (desde: string, puerto: string, d: number, extra: Partial<AristaFlujo> = {}) => {
    const t = tramo(d);
    if (t.hasta >= pasos.length) return;
    aristas.push({
      desde, hasta: ids[t.hasta], puerto, tono,
      ...(t.esperas.length ? { esperas: t.esperas.map((e) => ({ id: ids[e], texto: textoEsperaAviso((pasos[e] as Extract<Paso, { tipo: 'esperar' }>).horas) })) } : {}),
      ...extra,
    });
  };
  if (hayPasos) flecha(cabeza, 'sig', 0);
  pasos.forEach((_, i) => {
    if (enFlecha(i)) return;
    for (const s of salidas(i)) {
      // El «Si no» SALTA: el ＋ del medio de su flecha insertaría después de la CONDITION, o sea en la
      // OTRA rama. Un control que hace algo distinto de lo que dice la flecha de la que cuelga es peor
      // que no tenerlo (`sinMas`).
      flecha(ids[i], s.puerto, s.hasta, s.puerto === PUERTO_SI_NO ? { sinMas: true } : {});
    }
  });

  // Las pastillas, donde quedaron sus flechas (con las tarjetas ya en su lugar, guardado o calculado).
  const dibujadas = nodos.filter((n) => !n.enFlecha);
  const g0 = { nodos: dibujadas, aristas };
  for (const n of nodos) {
    if (!n.enFlecha) continue;
    const r = posicionDePildora(g0, n.id);
    if (r) Object.assign(n, r);
  }

  return { nodos, aristas, ...encerrar(dibujadas) };
}

// `podarPosiciones` (tirar las posiciones de los nodos que ya no existen) se mudó a
// lib/lienzo-posiciones.ts: la usan los dos lienzos. Se re-exporta arriba.

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
/**
 * Los pasos que el lienzo dibuja.
 *
 * ⚠️ EL `esperar` VOLVIO AL DIBUJO EL 04/10/2026, Y ES UN CAMBIO DE HECHO, NO DE
 * ESTILO. Estaba excluido por una razon correcta: el motor no lo ejecutaba —hacia
 * `break`— y la regla de la casa es que solo se dibuja la rama que el motor EJECUTA.
 * Con `flujo_corridas` (mig 0186) ahora SI corre, asi que esconderlo seria el error
 * inverso: un paso que ocurre y no se ve.
 *
 * El `insistir` sigue afuera y por otro motivo: no es un paso del recorrido sino una
 * propiedad del mensaje que lo precede (vuelve a mandar el MISMO), asi que dibujarlo
 * como tarjeta contaba un hecho de mas. Su UI se saco el 04/10 y el motor lo sigue
 * ejecutando si alguna vez vuelve a aparecer uno.
 */
export function pasosDibujados(pasos: Paso[]): Paso[] {
  return pasos.filter((p) => !esInsistir(p));
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
  // ⚠️ LO OCULTO SE DERIVA DE LO DIBUJADO, NUNCA SE ENUMERA AL LADO. Acá había una
  // segunda lista (`esInsistir(p) || p.tipo === 'esperar'`) y el día que `esperar` pasó
  // a DIBUJARSE quedó en las dos: cada inserción DUPLICABA todas las esperas. Medido en
  // el navegador el 04/10/2026 — un click en «Delay» dejaba 3 tarjetas ⏳ donde había 1,
  // y el siguiente 6 — y el `npm test` estaba en verde porque los tests del índice usan
  // `insistir` como el paso oculto. Dos listas que contestan la misma pregunta no
  // divergen por descuido: divergen porque se arregla una.
  const otros = pasos.filter((p) => !vivos.includes(p));
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

/**
 * EL DISPARADOR NATIVO, EN UNA LÍNEA.
 *
 * Pedido textual: «el editable de "Qué lo dispara" debería tener muchísimo menos
 * texto, el menor texto posible». El del catálogo son dos o tres oraciones —
 * explica el disparador Y sus condiciones— y eso vive bien en la ficha del aviso y
 * mal en un panel de 328 px con tres controles abajo.
 *
 * Se corta en el primer punto, punto y coma o DOS PUNTOS, y se le saca el paréntesis
 * final: la primera oración es el disparador y todo lo que sigue —las condiciones, la
 * enumeración de lo que cubre, la aclaración de la zona— son salvedades que viven en la
 * ficha del aviso. No se resume ni se reescribe: cortar es TIRAR.
 *
 * Los dos puntos entraron después de verlo en pantalla: «Cron los lunes a la mañana
 * (hora local del workspace): ads, cierres, CAC, cash, ritmo» pasaba entero porque no
 * tiene ni un punto, y son 82 caracteres en un panel de 328 px.
 */
export function disparadorCorto(txt: string): string {
  const primera = txt.split(/[.;:]/)[0]?.trim() ?? '';
  const base = (primera || txt.trim()).replace(/\s*\([^)]*\)\s*$/, '').trim();
  return base.length > 96 ? base.slice(0, 95).trimEnd() + '…' : base;
}

/**
 * CADA CUÁNTO INSISTE, en palabras.
 *
 * El paso guarda MINUTOS y siempre los va a guardar —es lo que el motor lee de la
 * fila (`insistencias.cada_min`)— pero «cada 43200 minutos» no es una frase que
 * alguien pueda leer. Las unidades son las que el dueño nombró: «se debería poder
 * recordar 1 vez al día, a la semana, al mes».
 */
export function textoCadencia(min: number): string {
  if (min >= 43200 && min % 43200 === 0) { const n = min / 43200; return n === 1 ? 'mes' : `${n} meses`; }
  if (min >= 10080 && min % 10080 === 0) { const n = min / 10080; return n === 1 ? 'semana' : `${n} semanas`; }
  if (min >= 1440 && min % 1440 === 0) { const n = min / 1440; return n === 1 ? 'día' : `${n} días`; }
  if (min >= 60 && min % 60 === 0) { const n = min / 60; return n === 1 ? 'hora' : `${n} horas`; }
  return `${min} minutos`;
}
