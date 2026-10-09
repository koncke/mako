// =============================================================================
// nutricion-etapa — qué secuencias dispara un lead que ACABA de caer en una etapa
// =============================================================================
// El dato ya existía: una secuencia con `trigger_tipo = 'etapa_actual'` se cuelga de
// una etapa (`nutricion_secuencias.etapa` = la key del stage) y se acota al embudo que
// declara (`funnel_id`, mig 0170). Lo que no existía era el EVENTO: hasta el 05/10/2026
// eso lo descubría únicamente el barrido horario del cron (`leadsDeCohorte`), así que
// mover un lead a una etapa y que le llegue el mensaje eran dos cosas separadas por
// hasta una hora.
//
// Pedido de Martín (05/10/2026): «Tienes que poner un CRON que se active mediante que un
// lead caiga en X etapa de X producto. Recuerda que ahora tenemos varios productos en el
// CRM, y dentro de cada producto se pueden configurar etapas, entonces esto debería leer
// eso y que el usuario pueda elegir que si cae en dicha etapa, se dispare esa secuencia».
//
// ⚠️ VIVE EN UN MÓDULO PURO, SIN NINGÚN IMPORT DE SERVIDOR, A PROPÓSITO. Esto decide a
// quién le llega un WhatsApp real, así que es justo lo que no puede quedarse sin test —
// el mismo criterio que `lib/nutricion-familias.ts` y `lib/nutricion-ambito.ts`.
//
// ⚠️ Y NO SE PUEDE REUSAR `enrolarPorEvento` A SECAS. Ese camino enrola en TODAS las
// secuencias activas de los triggers del evento, lo cual es correcto para `lead_nuevo`
// (hay un puñado y todas le aplican a cualquier lead nuevo) y sería catastrófico acá: un
// lead que cae en «Agenda» entraría también a la secuencia de «Facturando» y a la del
// producto de al lado. La etapa y el producto son parte de la pregunta, no un detalle.

import { leadEnAmbito, type AmbitoFunnel } from './nutricion-ambito';

// ── VARIAS ETAPAS (cuarta tanda, punto 14; mig 0230) ──────────────────────────────
// Pedido de Martín (09/10/2026): «tal vez yo quiera enviar esa automatización en varias etapas,
// entonces quiero que en el CRON se puedan seleccionar más de 1 etapa». `etapa` (text) es UNA; la
// lista vive en `etapas` (text[]), y `etapa` sigue escribiéndose con la primera para los lectores
// viejos (la API de MaKo, /email, el generador de copy, la clonación).

/** Cuántas etapas puede tener un CRON. Un kanban de la casa no pasa de ~15; el tope corta un pedido roto. */
export const TOPE_ETAPAS = 30;

/** Una lista de claves limpia: sin vacíos, sin espacios alrededor, sin repetidas, en su orden, con tope. */
export function normalizarEtapas(lista: unknown): string[] {
  if (!Array.isArray(lista)) return [];
  const out: string[] = [];
  for (const x of lista) {
    const k = typeof x === 'string' ? x.trim() : '';
    if (k && !out.includes(k)) out.push(k);
    if (out.length >= TOPE_ETAPAS) break;
  }
  return out;
}

/**
 * LAS ETAPAS QUE DISPARAN UNA SECUENCIA. Una función y no un campo: la leen el evento (venta y
 * entrega), el barrido del cron, el cierre de la etapa que se deja, el conteo por etapa del editor de
 * Customer Success y el desplegable del CRON. Con dos copias de la regla, una se queda vieja.
 *
 * `etapas` MANDA cuando no está vacía Y su PRIMERA es `etapa`; si no, vale `etapa` sola.
 *
 * ⚠️ LA COHERENCIA NO ES PROLIJIDAD: es lo que vuelve inofensivos a los escritores VIEJOS. La API de
 * MaKo (`cambiar_disparador_secuencia`, `email.run`) y /email (`actualizarMetaEmailSecuencia`)
 * escriben sólo `etapa`. Sin esta condición, cambiarle la etapa por ahí a una secuencia que tenía
 * [a, b] la dejaba disparando por [a, b] con la pantalla del que la cambió diciendo «c». Con ella, la
 * lista vieja deja de coincidir y se ignora sola. (El caso que no cubre: un escritor viejo que pone
 * `etapa` = la primera de la lista; ahí sigue la lista. Por eso la regla de la casa es que quien
 * escribe `etapa` escriba también `etapas`.)
 */
export function etapasDe(s: { etapa?: string | null; etapas?: readonly unknown[] | null }): string[] {
  const una = (s.etapa ?? '').trim();
  const lista = normalizarEtapas(s.etapas ?? null);
  if (lista.length && lista[0] === una) return lista;
  return una ? [una] : [];
}

/** Lo mínimo que hace falta de una secuencia para saber si esta etapa la dispara. */
export type SecuenciaDeEtapa = {
  id: number;
  trigger_tipo: string;
  /** La key del stage del que cuelga. Sin etapa no hay nada que comparar. */
  etapa: string | null;
  /** Las de un CRON con varias etapas (mig 0230). Manda según `etapasDe`. */
  etapas?: readonly string[] | null;
  /** El ámbito de embudo YA resuelto (`ambitoDeSecuencia`): el caller es el único que
   *  puede saber si ese embudo es el del negocio. */
  ambito: AmbitoFunnel;
};

/** El trigger que se cuelga de una etapa. Es el nombre que ya está en la base. */
export const TRIGGER_ETAPA = 'etapa_actual';

/**
 * Las secuencias que dispara un lead que acaba de caer en `etapa`.
 *
 * Tres condiciones, y las tres tienen que valer:
 *   1. la secuencia se cuelga de una etapa (`trigger_tipo === 'etapa_actual'`),
 *   2. es ESA etapa, y
 *   3. el lead está en el ámbito de embudo que la secuencia declara — o sea, el
 *      PRODUCTO. Con `funnel_id` NULL la secuencia es de todos los productos, que es
 *      como están hoy las 62 filas de producción: sin esto, declarar el producto en una
 *      sola secuencia apagaría el resto.
 *
 * Devuelve las secuencias, no los ids: el caller necesita sus pasos para el primer envío.
 */
export function secuenciasDeEtapa<T extends SecuenciaDeEtapa>(
  secuencias: readonly T[],
  etapa: string | null | undefined,
  leadFunnelId: number | string | null | undefined,
): T[] {
  // Sin etapa no se enrola a nadie. Es la guarda que convierte este camino en uno
  // seguro: un evento sin la etapa adentro NO puede caer en «entonces todas».
  const key = (etapa ?? '').trim();
  if (!key) return [];
  // CUALQUIERA de sus etapas (punto 14): una secuencia de [agenda, facturando] la dispara caer en
  // cualquiera de las dos. Que no se duplique al pasar por las dos lo cuida la inscripción única
  // (lead, secuencia): el evento saltea a quien ya tiene fila (`enrolarPorEvento`).
  return secuencias.filter((s) => (
    s.trigger_tipo === TRIGGER_ETAPA
    && etapasDe(s).includes(key)
    && leadEnAmbito(s.ambito, leadFunnelId)
  ));
}

/** El trigger que se cuelga de una etapa de la ENTREGA de un servicio. */
export const TRIGGER_ENTREGA = 'entrega_actual';

/** Lo mínimo de una secuencia para saber si una etapa de ENTREGA la dispara. */
export type SecuenciaDeEntrega = {
  id: number;
  trigger_tipo: string;
  etapa: string | null;
  /** Las de un CRON con varias etapas de la entrega (mig 0230). Manda según `etapasDe`. */
  etapas?: readonly string[] | null;
  /** El producto de cuya entrega cuelga. NULL = la entrega de cualquier producto. */
  producto_id?: number | string | null;
};

/**
 * Las secuencias que dispara un CLIENTE que acaba de caer en una etapa de la entrega.
 *
 * ⚠️ ES UN EVENTO PROPIO Y NO UN STRING MÁS ADENTRO DEL DE VENTA, y el porqué lo midió
 * la sesión de Customer Success antes de que existiera este código: `secuenciasDeEtapa`
 * compara la etapa con `===`, y las dos listas de etapas —la del embudo y la de la
 * entrega— las edita el CLIENTE. Hoy el choque entre los dos defaults es CERO (venta:
 * lead, agenda, agendaj2, facturando, ganado · entrega: onboarding, arranque, hito1,
 * hito2, entregado), pero nada lo impide: el día que alguien llame `facturando` a una
 * etapa de entrega, mover un cliente en el kanban de Customer Success dispararía una
 * secuencia de VENTA. Un trigger aparte lo cierra por construcción, no por suerte.
 *
 * ⚠️ Y EL ÁMBITO ES EL PRODUCTO, NO EL EMBUDO. Son dos columnas distintas
 * (`producto_id` de la mig 0189 vs `funnel_id` de la 0170) porque del producto al embudo
 * hay dos saltos: pasar el id de un producto como si fuera el de un embudo hace match
 * con el embudo que tenga ese número, que es el de cualquier otra cosa.
 */
export function secuenciasDeEntrega<T extends SecuenciaDeEntrega>(
  secuencias: readonly T[],
  etapa: string | null | undefined,
  productoId: number | string | null | undefined,
): T[] {
  // La misma guarda que arriba, y por lo mismo: sin etapa no se enrola a nadie.
  const key = (etapa ?? '').trim();
  if (!key) return [];
  // Y sin producto tampoco. Acá es MÁS estricto que en la venta: un lead sin embudo es
  // normal (NULL = el del negocio), pero un movimiento de entrega SIEMPRE trae su
  // producto —la fila de `cliente_entrega` lo tiene NOT NULL—, así que un evento sin
  // producto es un llamador roto, no un caso de negocio.
  const prod = productoId == null || productoId === '' ? null : Number(productoId);
  if (prod == null || !Number.isFinite(prod)) return [];
  return secuencias.filter((s) => {
    if (s.trigger_tipo !== TRIGGER_ENTREGA) return false;
    if (!etapasDe(s).includes(key)) return false;
    // NULL = la entrega de CUALQUIER producto, igual que `funnel_id` NULL en la venta.
    if (s.producto_id == null || s.producto_id === '') return true;
    const suyo = Number(s.producto_id);
    return Number.isFinite(suyo) && suyo === prod;
  });
}

/**
 * LO QUE SE CIERRA AL DEJAR UNA ETAPA DE LA ENTREGA: las secuencias de `desde`, MENOS las que
 * también cubren `hacia` (punto 14).
 *
 * ⚠️ SIN LA RESTA, UNA SECUENCIA DE VARIAS ETAPAS SE CORTABA SOLA en su propio recorrido. El evento
 * cierra lo de la etapa que se deja ANTES de enrolar en la nueva (`cerrarEntregaDeEtapa`, lib/
 * nutricion.ts), y la inscripción única hace que enrolar no reabra lo cerrado: un cliente con la
 * felicitación en [hito1, hito2, hito3] que pasaba de hito1 a hito2 se quedaba sin el resto del
 * flujo. Para una secuencia que también cubre la etapa nueva, el momento del que habla NO terminó.
 * `hacia` vacío (salir de la entrega, o un movimiento sin destino) = se cierra todo lo de `desde`.
 */
export function secuenciasQueSeCierran<T extends SecuenciaDeEntrega>(
  secuencias: readonly T[],
  desde: string | null | undefined,
  hacia: string | null | undefined,
  productoId: number | string | null | undefined,
): T[] {
  const deLaQueSeDeja = secuenciasDeEntrega(secuencias, desde, productoId);
  const destino = (hacia ?? '').trim();
  if (!destino) return deLaQueSeDeja;
  return deLaQueSeDeja.filter((s) => !etapasDe(s).includes(destino));
}

/**
 * El trigger «le pusieron la etiqueta X» (mig 0223: `nutricion_secuencias.etiqueta_id`).
 *
 * ⚠️ OTRO TRIGGER Y NO UNA ETAPA MÁS, por lo mismo que la entrega: la etiqueta es un id de
 * `crm_etiquetas` (mig 0224) y una etapa es una key que edita el cliente. Mezclados en
 * `etapa`, el día que un id coincida con una key se dispararía una secuencia que nadie pidió.
 */
export const TRIGGER_ETIQUETA = 'etiqueta_puesta';

/** Lo mínimo de una secuencia para saber si una etiqueta la dispara. */
export type SecuenciaDeEtiqueta = { id: number; trigger_tipo: string; etiqueta_id?: number | string | null };

/**
 * Las secuencias que dispara un lead al que ACABAN de ponerle la etiqueta `etiquetaId`.
 *
 * ⚠️ SIN ETIQUETA NO SE ENROLA A NADIE, y es la misma guarda que la del evento de etapa:
 * `enrolarPorEvento` mete al lead en TODAS las secuencias del trigger del evento, así que sin
 * este filtro poner «Cualificado» lo metía también en la secuencia de «Seguimiento». Una
 * secuencia sin `etiqueta_id` no dispara nunca: no existe «todas las etiquetas».
 */
export function secuenciasDeEtiqueta<T extends SecuenciaDeEtiqueta>(
  secuencias: readonly T[],
  etiquetaId: number | string | null | undefined,
): T[] {
  const id = etiquetaId == null || etiquetaId === '' ? NaN : Number(etiquetaId);
  if (!Number.isInteger(id) || id <= 0) return [];
  return secuencias.filter((s) => s.trigger_tipo === TRIGGER_ETIQUETA && s.etiqueta_id != null && Number(s.etiqueta_id) === id);
}
