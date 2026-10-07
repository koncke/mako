// =============================================================================
// cs-contacto — cuándo se habló por última vez con un cliente, y cuándo avisarle al dueño
// =============================================================================
// PURO: sin `server-only` ni 'use client'. Lo usan cuatro lugares y un test:
//   · la cartera que lee MaKo (`cartera()`, lib/cs-cartera.ts);
//   · la lectura de la tabla de Clientes y del cron (`ultimoContactoDeClientes`, misma lib);
//   · la columna «Último contacto» de app/customer-success/TablaClientes.tsx;
//   · el cron de la alerta al dueño (lib/cs-sin-contacto.ts → app/api/cron/cs-sin-contacto);
//   · tests/cs-sin-contacto.test.ts, que lo EJECUTA.
//
// ⚠️ UNA REGLA, UN LUGAR (#109, 06/10/2026). «El último contacto» vivía adentro de `cartera()`
// (la sesión más nueva contra el WhatsApp más nuevo, con el historial entero y sin ventana).
// La tabla y la alerta necesitaron el mismo dato: con tres copias, la columna diría «hace 3
// días» y el aviso «lleva 21 días sin contacto» sobre el mismo cliente, y nadie sabría cuál
// de los dos miente. Ahora las tres superficies llaman a `ultimoContacto`.
//
// ⚠️ LA ALERTA ES DEL DUEÑO, NUNCA DEL CLIENTE, Y NO USA IA (decisión de Martín, 06/10/2026:
// «Columnas + alerta»). Un cliente ganado que no está dado de baja ni graduado y lleva 21 días
// sin contacto NI movimiento de etapa → un aviso al grupo del dueño con el cliente, los días y
// qué hacer. Uno por cliente y por RACHA (ver `claveRacha`), no uno por día.
//
// ⚠️ UN WHATSAPP CUENTA COMO CONTACTO SÓLO SI LO ESCRIBIÓ EL CLIENTE (`from_me === false`)
// (07/10/2026, revisión de #109). La primera versión contaba cualquier WhatsApp, y en el ws1 el
// envío está PRENDIDO: al cliente que se está yendo —el que no entra al portal— le salen solos
// el recordatorio de clases a los 3 días (#780), los avisos del curso (lib/curso-mensajes.ts) y
// la nutrición (lib/nutricion.ts), todos por `enviarYEspejar` con su `leadId`. Cada uno
// reiniciaba el ancla: la tabla decía «hace 2 días» de alguien con quien nadie habló, y la
// alerta de baja no salía JUSTO para el cliente desenganchado, que es para quien existe.
//
// ⚠️ Y POR QUÉ NO «LOS SALIENTES MENOS LOS AUTOMÁTICOS»: `wa_mensajes` no sabe quién escribió un
// saliente. El espejo marca `raw: { local: true }`, pero si el eco del webhook llega primero gana
// su fila (`ignoreDuplicates`) y la marca se pierde; y `enviarYEspejar` no devuelve el id del
// mensaje, así que ningún emisor automático lo deja anotado para excluirlo. Sin una marca que
// sobreviva, cualquier filtro de «automático» sería un parecido, no un dato. El costo, escrito:
// un WhatsApp que el DUEÑO le manda a mano tampoco mueve el reloj — la alerta mide si el CLIENTE
// sigue respondiendo. Si un saliente manual tiene que contar lo decide Martín, y el camino es
// marcar los envíos automáticos en la base (una columna en `wa_mensajes` que pongan los emisores
// automáticos), no adivinarlos acá.

import { DIAS_TRABADO } from '@/app/customer-success/en-etapa';

/**
 * La categoría del Closing Analyst que NO es una conversación con el cliente. Es la misma que
 * excluye la pestaña Llamadas de la ficha (app/customer-success/ficha-lectura.ts): con una
 * llamada de prueba contada como contacto, la columna diría «hoy» sobre un cliente cuya lista
 * de llamadas no la muestra.
 */
export const CATEGORIA_SIN_CONTACTO = 'test';

/** Una sesión de `closing_analyses` (lo mínimo que la regla mira). */
export type SesionContacto = { call_date: string | null; recording_id?: number | null };
/**
 * Un WhatsApp de `wa_mensajes` (lo mínimo que la regla mira). `from_me` es OBLIGATORIO: es lo que
 * decide si cuenta como contacto (ver la cabecera), y un lector que se olvide de pedirlo no puede
 * compilar.
 */
export type MensajeContacto = { wa_timestamp: string | null; from_me: boolean };
export type ViaContacto = 'sesion' | 'whatsapp';

/**
 * Lo que viaja a la pantalla y al cron: la fecha y por dónde fue. `via: 'whatsapp'` es un WhatsApp
 * QUE ESCRIBIÓ EL CLIENTE, nunca uno que le mandamos.
 */
export type ContactoCliente = { fecha: string | null; via: ViaContacto | null };

export type UltimoContacto<S, M> = ContactoCliente & {
  /** La sesión más nueva (las que no tienen fecha van al final). `null` = ninguna. */
  sesion: S | null;
  /**
   * El WhatsApp más nuevo con fecha, LO HAYA MANDADO QUIEN LO HAYA MANDADO. No es contacto: es lo
   * que mira «espera respuesta» de la cartera de MaKo (quién habló último). `null` = ninguno.
   */
  mensaje: M | null;
  /** El WhatsApp más nuevo que escribió EL CLIENTE (`from_me === false`). Éste sí es contacto. */
  entrante: M | null;
};

/** Milisegundos de una fecha, o `null` si no hay o no se puede leer: no es un valor del dato. */
const msDe = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
};

export const DIA_MS = 86_400_000;

/**
 * El último contacto con un cliente: la sesión más nueva y el WhatsApp más nuevo QUE ESCRIBIÓ ÉL,
 * y el más reciente de los dos. Los salientes no cuentan (ver la cabecera: el recordatorio
 * automático no es una conversación), pero el más nuevo de todos viaja igual en `mensaje`.
 *
 * ⚠️ POR FECHA, NUNCA POR ORDEN DE LLEGADA: un backfill mete mensajes viejos con id nuevo. Y
 * una sesión SIN `call_date` no gana nunca contra una con fecha: un `order(desc)` de Postgres
 * pone los null PRIMERO, y así una grabación sin fecha pasaba por «última sesión». Entre dos
 * sesiones con la misma fecha, la de `recording_id` mayor (la que entró después).
 *
 * ⚠️ HISTORIAL COMPLETO, SIN VENTANA: con una ventana de N días, «nunca hablaron» y «hablaron
 * hace más de N» devuelven la misma lista vacía (docs/hallazgos-customer-success.md).
 *
 * Con la sesión y el WhatsApp del mismo instante gana la sesión: hablar en una llamada dice más
 * que un mensaje, y el empate de verdad casi no existe (una es un día, el otro una hora).
 */
export function ultimoContacto<S extends SesionContacto, M extends MensajeContacto>(
  sesiones: readonly S[],
  mensajes: readonly M[],
): UltimoContacto<S, M> {
  let sesion: S | null = null;
  for (const s of sesiones) {
    if (!sesion) { sesion = s; continue; }
    const a = msDe(s.call_date);
    const b = msDe(sesion.call_date);
    const masNuevaPorId = (s.recording_id ?? 0) > (sesion.recording_id ?? 0);
    if (a !== null && (b === null || a > b || (a === b && masNuevaPorId))) sesion = s;
    else if (a === null && b === null && masNuevaPorId) sesion = s;
  }

  let mensaje: M | null = null;
  let tm: number | null = null;
  let entrante: M | null = null;
  let te: number | null = null;
  for (const m of mensajes) {
    const t = msDe(m.wa_timestamp);
    if (t === null) continue;
    if (tm === null || t > tm) { mensaje = m; tm = t; }
    // ⚠️ `=== false` Y NO `!m.from_me`: una fila leída sin la columna trae `undefined`, y contarla
    // como del cliente devolvería el bug entero. Sin el dato, no es contacto.
    if (m.from_me === false && (te === null || t > te)) { entrante = m; te = t; }
  }

  const ts = msDe(sesion?.call_date);
  if (ts === null && te === null) return { sesion, mensaje, entrante, fecha: null, via: null };
  if (te !== null && (ts === null || te > ts)) return { sesion, mensaje, entrante, fecha: entrante!.wa_timestamp, via: 'whatsapp' };
  return { sesion, mensaje, entrante, fecha: sesion!.call_date, via: 'sesion' };
}

/**
 * «Hace cuánto», para la columna de la tabla: «hoy», «ayer», «hace N días».
 *
 * `null` = no hay fecha que decir. Una fecha del FUTURO (un reloj corrido) también es `null`:
 * dibujarla como «hoy» sería afirmar algo que nadie midió. `ahora` es parámetro para el test.
 */
export function haceCuanto(iso: string | null | undefined, ahora: number = Date.now()): { dias: number; texto: string } | null {
  const t = msDe(iso);
  if (t === null || t > ahora) return null;
  const dias = Math.floor((ahora - t) / DIA_MS);
  return { dias, texto: dias === 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias} días` };
}

// ── La alerta al dueño ────────────────────────────────────────────────────────

/**
 * A partir de cuántos días sin contacto ni movimiento se le avisa al dueño.
 *
 * ⚠️ ES EL MISMO NÚMERO QUE PINTA EN ROJO «N días sin moverse» en el kanban y la tabla
 * (`DIAS_TRABADO`, app/customer-success/en-etapa.ts), importado y no copiado: Martín eligió
 * 21 días y es el umbral que la pantalla ya usaba para «trabado». Con dos constantes, el día
 * que una cambie, la tarjeta diría «trabado» sobre un cliente del que nadie avisa.
 *
 * ⚠️ NO SE MIDIÓ CONTRA LOS DATOS (la corrida no tiene acceso a la base). Lo medido el 26/09:
 * el último WhatsApp de un ganado del ws1 era del 03/09 — o sea que la primera corrida puede
 * encontrar a varios de sus 14 de una vez. Para eso está `TOPE_AVISOS_POR_CORRIDA`.
 */
export const DIAS_SIN_CONTACTO = DIAS_TRABADO;

/**
 * Cuántos avisos NUEVOS salen por workspace en una corrida. Los demás esperan a la de mañana.
 *
 * Existe por la primera corrida: con la cartera entera en silencio, catorce WhatsApps seguidos
 * al grupo del dueño son exactamente lo que lo hace apagar los avisos («me llegan un chorro, ya
 * desactivé los otros»). Los que ya se avisaron NO cuentan contra el tope —el dedup los
 * saltea—, así que el atraso se drena solo: tres por mañana, los de más días primero.
 */
export const TOPE_AVISOS_POR_CORRIDA = 3;

/** El `tipo` del aviso: slug de lib/avisos-catalogo.ts y clave del dedup. */
export const TIPO_AVISO_SIN_CONTACTO = 'cs-cliente-sin-contacto';

/**
 * Cuánto vale la marca de «ya se avisó esta racha». Un año: la clave ya es POR RACHA (ver
 * `claveRacha`), así que el tiempo no es lo que separa un aviso del siguiente — lo separa un
 * contacto nuevo. El TTL sólo existe para que una racha que dura más de un año vuelva a
 * recordarse una vez.
 */
export const DEDUP_RACHA_MIN = 60 * 24 * 365;

/** Los estados de `cs_clientes` (mig 0129) en los que ya no se le avisa a nadie. */
const YA_NO_ES_CLIENTE: ReadonlySet<string> = new Set(['baja', 'graduado']);

export type HechosSinContacto = {
  /**
   * `cs_clientes.estado`. `null` = no tiene fila, y eso es «activo»: la columna nace en
   * 'activo' y la escribe sólo MaKo por chat. ⚠️ «pausado» SÍ avisa: la decisión nombra baja y
   * graduado, nada más.
   */
  estado: string | null;
  /** La fecha de `ultimoContacto` (sesión o WhatsApp). `null` = nunca hubo. */
  contacto: string | null;
  /** El `cliente_entrega.etapa_desde` más nuevo entre todos sus productos. `null` = nunca se movió. */
  movimiento: string | null;
  /** `leads.fecha_cierre`: cuándo se volvió cliente. La venta también es un contacto. */
  cierre: string | null;
};

export type DesdeSinContacto = 'contacto' | 'movimiento' | 'cierre';

export type DecisionSinContacto =
  | { avisar: true; dias: number; ancla: number; desde: DesdeSinContacto }
  | { avisar: false; porque: 'ya-no-es-cliente' | 'sin-fecha' | 'reciente' };

/**
 * ¿Hay que avisarle al dueño por este cliente?
 *
 * El reloj arranca en lo ÚLTIMO que pasó con él: un contacto, un cambio de etapa o la venta.
 * Que la venta cuente no es una concesión: un cliente que cerró hace 5 días no lleva 21 sin
 * contacto, aunque todavía nadie le haya escrito.
 *
 * ⚠️ «NO PUDE LEER» NO LLEGA ACÁ: lo corta `avisosSinContacto`, que con una lectura caída no
 * decide sobre nadie. Un `null` en estos campos es «no hay», nunca «no sé».
 */
export function decidirSinContacto(h: HechosSinContacto, ahora: number): DecisionSinContacto {
  if (h.estado && YA_NO_ES_CLIENTE.has(h.estado)) return { avisar: false, porque: 'ya-no-es-cliente' };
  let ancla: number | null = null;
  let desde: DesdeSinContacto = 'cierre';
  for (const [k, v] of [['contacto', h.contacto], ['movimiento', h.movimiento], ['cierre', h.cierre]] as const) {
    const t = msDe(v);
    if (t !== null && (ancla === null || t > ancla)) { ancla = t; desde = k; }
  }
  // Sin una sola fecha no hay desde cuándo contar: decir «21 días» sería inventar el número.
  if (ancla === null) return { avisar: false, porque: 'sin-fecha' };
  const dias = Math.floor((ahora - ancla) / DIA_MS);
  if (dias < DIAS_SIN_CONTACTO) return { avisar: false, porque: 'reciente' };
  return { avisar: true, dias, ancla, desde };
}

/**
 * La clave del dedup: EL CLIENTE Y EL INICIO DE SU RACHA, no el día.
 *
 * ⚠️ ES LO QUE HACE «UNO POR RACHA, NO UNO POR DÍA». El día 22 y el día 23 de la misma racha
 * tienen la misma ancla, así que la misma clave, y `emitirAviso` no lo repite. Un contacto
 * nuevo (o un cambio de etapa) mueve el ancla: la racha siguiente, 21 días después, tiene otra
 * clave y vuelve a avisar. Va en milisegundos y no en el texto de la fecha: la misma marca
 * escrita dos veces de forma distinta («…Z» y «…+00:00») no puede abrir dos rachas.
 *
 * Y un DESHACER de la etapa no abre una racha: devuelve el reloj previo (`relojDeVuelta`,
 * lib/servicio-etapas.ts), que es el mismo instante.
 */
export const claveRacha = (leadId: number, ancla: number): string => `${leadId}:${ancla}`;

export type ClienteParaAviso = { leadId: number; nombre: string; cierre: string | null };

/**
 * Lo que leyó el cron. Cada lectura con su `null` propio: «no pude leer» no es «no hay».
 * `contacto[leadId]` ausente con la lectura bien = nunca hubo contacto.
 */
export type LecturasSinContacto = {
  contacto: Record<number, ContactoCliente> | null;
  estado: Record<number, string> | null;
  movimiento: Record<number, string> | null;
};

export type AvisoSinContacto = {
  leadId: number;
  nombre: string;
  dias: number;
  desde: DesdeSinContacto;
  via: ViaContacto | null;
  clave: string;
};

/**
 * Los clientes por los que hay que avisar, los de más días primero. `null` = alguna lectura
 * falló y NO se decide sobre nadie.
 *
 * ⚠️ FAIL-CLOSED, Y ES LA REGLA DE LOS MENSAJES QUE SALEN SOLOS (AGENTS.md, «Un mensaje que
 * sale solo no puede AFIRMAR lo que no verificó»): con el WhatsApp sin leer, todos parecen en
 * silencio; con `cs_clientes` sin leer, un cliente dado de baja recibiría el aviso; con la
 * entrega sin leer, uno que se movió ayer. Las tres afirmarían algo falso con la autoridad del
 * sistema.
 */
export function avisosSinContacto(
  clientes: readonly ClienteParaAviso[],
  l: LecturasSinContacto,
  ahora: number,
): AvisoSinContacto[] | null {
  if (!l.contacto || !l.estado || !l.movimiento) return null;
  const out: AvisoSinContacto[] = [];
  for (const c of clientes) {
    const contacto = l.contacto[c.leadId] ?? null;
    const d = decidirSinContacto({
      estado: l.estado[c.leadId] ?? null,
      contacto: contacto?.fecha ?? null,
      movimiento: l.movimiento[c.leadId] ?? null,
      cierre: c.cierre,
    }, ahora);
    if (!d.avisar) continue;
    out.push({
      leadId: c.leadId,
      nombre: c.nombre.trim() || 'Un cliente',
      dias: d.dias,
      desde: d.desde,
      via: contacto?.via ?? null,
      clave: claveRacha(c.leadId, d.ancla),
    });
  }
  // Los de más días primero: si el tope corta, corta a los que menos esperaron. El nombre
  // desempata para que dos corridas elijan a los mismos.
  return out.sort((a, b) => b.dias - a.dias || a.nombre.localeCompare(b.nombre, 'es') || a.leadId - b.leadId);
}

/** El título del aviso (el feed y la lista de /mensajes). */
export const tituloSinContacto = (nombre: string): string => `Sin contacto: ${nombre}`;

/**
 * El mensaje al dueño. Tres renglones: quién y cuántos días (el motivo), qué hacer (la acción
 * sugerida) y el link a su ficha. El rótulo de arriba lo pone `emitirAviso`.
 *
 * Copy de pantalla: español neutro de tú y corto — el cliente de Mauricio es mexicano y este
 * texto lo lee él en WhatsApp.
 */
export function textoSinContacto(a: { nombre: string; dias: number; link: string | null }): string {
  return [
    // «SIN MENSAJES SUYOS», y no «sin contacto» (07/10/2026): la regla ya no cuenta lo que le
    // mandamos (ver la cabecera), así que el dueño que le escribió ayer a mano leería «sin
    // contacto» sobre una conversación que él mismo empezó. Lo que se verificó es que ÉL no
    // escribió ni hubo sesión, y eso es lo que se afirma.
    // «REGISTRADA», y tampoco es relleno: lo que se mira son las llamadas que leyó el Closing
    // Analyst y el WhatsApp que espeja la línea no oficial. Una llamada por teléfono o un chat
    // desde otro número no dejan rastro acá (AGENTS.md, «Un mensaje que sale solo no puede
    // AFIRMAR…»).
    `*${a.nombre}* lleva ${a.dias} días sin mensajes suyos ni sesión registrada, ni cambio de etapa.`,
    'Escríbele hoy o agenda una sesión.',
    ...(a.link ? [a.link] : []),
  ].join('\n');
}
