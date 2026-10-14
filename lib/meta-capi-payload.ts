// =============================================================================
// Lo que Meta acepta adentro de un evento de CAPI, decidido sin tocar la red
// =============================================================================
// Módulo PURO (sin `server-only` a propósito): son las cuatro decisiones que
// gobiernan el payload y la lectura de la respuesta. Adentro del cliente HTTP
// ningún test las podía importar, y las cuatro son de las que fallan callado.
//
//   · `leadIdDeMeta`     — el `leadgen_id` viaja SIN hashear y Meta RECHAZA el
//     evento entero si el id no es válido, así que acá vive el único filtro.
//   · `tiempoDelHecho`   — la hora del HECHO, no la de la llamada.
//   · `hayIdentidad`     — Meta exige al menos un identificador, y el `lead_id`
//     cuenta: la doc lo llama el de MÁXIMA prioridad.
//   · `falloEnRespuesta` — Meta manda el fallo ADENTRO del 200 (regla de la casa).
// =============================================================================

/**
 * El `leadgen_id` de Meta, o null si lo que hay no lo es.
 *
 * ⚠️ MANDAR UN `lead_id` INVÁLIDO ES PEOR QUE NO MANDARLO: la doc de Meta dice que
 * ante uno inválido **rechaza el evento**, así que una conversión que hoy sí entra
 * dejaría de entrar. Son 15-17 dígitos.
 *
 * ⚠️ Y EN ESTA BASE HAY UN CENTINELA QUE PARECE UN ID: los leads cargados a mano de
 * un negocio que prospecta en frío tienen `meta_lead_id = '0'` (ver la cabecera de
 * lib/audios-paso.ts). Ninguno vino de un formulario de Meta. El rango de dígitos
 * lo descarta solo — por eso se valida la FORMA y no sólo que el campo no esté vacío.
 */
export function leadIdDeMeta(v: string | null | undefined): string | null {
  if (typeof v !== 'string') return null;
  const d = v.trim();
  return /^[0-9]{15,17}$/.test(d) ? d : null;
}

/** Lo que CAPI acepta hacia atrás. Más viejo que esto, Meta lo rechaza. */
export const VENTANA_CAPI_DIAS = 7;
/** Margen contra el borde de la ventana: la llamada tarda y el reloj de Meta no es el nuestro. */
const MARGEN_SEG = 3600;

export type TiempoDelHecho = {
  /** Lo que va en `event_time` (unix, en segundos). */
  segundos: number;
  /** El instante real del hecho, ISO, o null si no se pudo leer. */
  real: string | null;
  /** true si el hecho caía fuera de la ventana y se recortó a su borde. */
  recortado: boolean;
};

/**
 * El `event_time` del evento: la hora del HECHO.
 *
 * Mandar `Date.now()` siempre es la salida barata y miente sin avisar — un lead que
 * se califica tres semanas después entra con una hora que no es. Pero la ventana de
 * CAPI es de 7 días, así que un hecho más viejo que eso **no tiene hora buena**: o
 * se recorta al borde, o Meta rechaza el evento y la conversión se pierde entera.
 *
 * Se recorta, y el recorte se DECLARA — el llamador lo loguea y el instante real
 * viaja en `custom_data.hecho_en`. Un recorte invisible es una hora inventada; uno
 * declarado es una aproximación acotada que se puede auditar.
 *
 * Un hecho en el FUTURO es un reloj desfasado, no un hecho: también se recorta
 * (Meta rechaza cualquier `event_time` adelantado).
 */
export function tiempoDelHecho(hecho: Date | string | null | undefined, ahora: Date): TiempoDelHecho {
  const ahoraSeg = Math.floor(ahora.getTime() / 1000);
  const d = hecho == null ? null : hecho instanceof Date ? hecho : new Date(hecho);
  if (!d || Number.isNaN(d.getTime())) return { segundos: ahoraSeg, real: null, recortado: false };
  const seg = Math.floor(d.getTime() / 1000);
  const real = d.toISOString();
  if (seg > ahoraSeg) return { segundos: ahoraSeg, real, recortado: true };
  const piso = ahoraSeg - VENTANA_CAPI_DIAS * 86400 + MARGEN_SEG;
  if (seg < piso) return { segundos: piso, real, recortado: true };
  return { segundos: seg, real, recortado: false };
}

/**
 * ¿Hay con qué atribuir el evento?
 *
 * El `lead_id` cuenta por sí solo: es el identificador de máxima prioridad de Meta
 * y es lo único que mueve la Cobertura de leads. Antes se exigía email o teléfono,
 * así que un lead de formulario sin esos dos campos no mandaba nada teniendo el
 * identificador que mejor matchea.
 */
export function hayIdentidad(x: { em?: string | null; ph?: string | null; leadId?: string | null }): boolean {
  return !!(x.em || x.ph || x.leadId);
}

/** Cuántos eventos dijo Meta que recibió. 0 cuando no lo dijo. */
export function eventosRecibidos(body: unknown): number {
  if (body == null || typeof body !== 'object') return 0;
  const n = (body as Record<string, unknown>).events_received;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * El motivo por el que ese 200 NO fue un éxito, o null si lo fue.
 *
 * ⚠️ `res.ok` NO ES «SALIÓ BIEN» y con Meta ya mordió: contesta 200 con `body.error`
 * adentro. Y un 200 sin `error` tampoco alcanza — un cuerpo que no confirma ningún
 * evento es la forma de decir «te escuché y no hice nada», indistinguible de un ok
 * si sólo se mira que no haya error.
 */
export function falloEnRespuesta(body: unknown): string | null {
  if (body == null || typeof body !== 'object') return 'Meta contestó 200 con un cuerpo que no es un objeto';
  const o = body as Record<string, unknown>;
  const err = o.error;
  if (err != null && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    return [
      typeof e.message === 'string' && e.message ? e.message : 'error sin mensaje',
      e.code != null ? `code ${String(e.code)}` : null,
      e.error_subcode != null ? `subcode ${String(e.error_subcode)}` : null,
      typeof o.fbtrace_id === 'string' && o.fbtrace_id ? `fbtrace ${o.fbtrace_id}` : null,
    ].filter(Boolean).join(' · ');
  }
  if (err != null) return `error: ${String(err)}`;
  if (!eventosRecibidos(o)) {
    const n = o.events_received;
    return `Meta no confirmó ningún evento (events_received=${n === undefined ? 'ausente' : String(n)})`;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// El embudo que ve Meta, y las claves con las que deduplica
// ─────────────────────────────────────────────────────────────────────────────
// Meta necesita DOS etapas distinguibles para armar el embudo, y hasta el
// 05/10/2026 no las tenía: `calificado` disparaba `Lead`, que es el evento del
// lead CRUDO. Las dos etapas estaban conflacionadas en un nombre.
//
//   · `Lead`            → el lead crudo, cuando entra el formulario de Meta.
//   · `SubmitApplication` + `QualifiedLead` → la calificación.
//
// `SubmitApplication` es ESTÁNDAR y significa exactamente esto («cuando una
// persona aplica a un producto, servicio o programa»), así que es elegible como
// objetivo de un conjunto de anuncios HOY, sin declarar nada del lado de Meta.
// `QualifiedLead` es nuestro y se manda igual, para medirlo con su nombre. Los dos
// con el MISMO event_id: Meta deduplica por el par (event_name, event_id), así que
// dos nombres distintos se cuentan por separado y mandar los dos es seguro.

/** Los nombres con los que viaja una calificación. El estándar va primero. */
export const EVENTOS_CALIFICADO = ['SubmitApplication', 'QualifiedLead'] as const;

/**
 * La clave de deduplicación de la calificación de un lead.
 *
 * ⚠️ ESTABLE POR LEAD, Y ESO ES EL ARREGLO. `lib/leads.ts` dispara comparando el
 * valor viejo contra el nuevo, así que marcar → desmarcar → marcar manda DOS
 * eventos. Con el id derivado del lead, el segundo llega con la misma clave y Meta
 * lo descarta en vez de contar dos conversiones.
 *
 * ⚠️ LA VENTANA DE DEDUPLICACIÓN ES DE META, NO NUESTRA. Esto cubre el rebote de
 * minutos u horas, que es el caso real (alguien se equivoca y corrige). Una
 * idempotencia que tenga que valer meses necesita una columna nuestra, y hoy no
 * existe — está anotado en docs/hallazgos-ads.md.
 */
export const eventIdCalificado = (leadId: number) => `calif:${leadId}`;

/** La clave del lead crudo. El webhook de Meta reintenta el batch entero. */
export const eventIdLeadCrudo = (leadgenId: string) => `lead:${leadgenId}`;

// ─────────────────────────────────────────────────────────────────────────────
// A DÓNDE SE MANDA EL EVENTO
// ─────────────────────────────────────────────────────────────────────────────
// Hasta el 05/10/2026 el único destino era `META_PIXEL_ID`, el píxel del SITIO, y
// la doc de Conversion Leads dice textual lo contrario: «Refrain from using this
// payload specification for other event types, such as website leads». El destino
// correcto de las etapas del embudo es un conjunto de datos de tipo CRM, que es
// lo único de Meta sin endpoint: lo crea la persona en el Administrador de eventos
// (ver el tutorial de META_CRM_DATASET_ID en lib/metodo-catalogo.ts).
//
// ⚠️ EL ORDEN IMPORTA Y NO ES AL REVÉS: primero el conjunto de datos de CRM si
// existe, y si no el píxel de siempre. Cortar el envío cuando no hay conjunto de
// datos apagaría conversiones que HOY entran en todos los workspaces, que ninguno
// lo tiene — el camino del CRM es la segunda ruta, no un requisito nuevo.
//
// ⚠️ `credWs` NO devuelve solo null o un valor: devuelve también el centinela
// `PENDING…` que escribe el alta de una credencial sin cargar. Un `??` lo tomaría
// como un id bueno y mandaría los eventos a un destino que no existe, así que el
// filtro vive acá adentro, donde hay test, y no en el call-site.

export type DestinoCAPI = {
  /** El id al que se postea el evento. */
  id: string;
  /** true → es un conjunto de datos de CRM, y el payload lleva los campos que Meta
   *  exige solo para ese caso (`event_source`, `lead_event_source`). */
  esCrm: boolean;
};

/** true si lo que vino de `credWs` es un valor cargado de verdad. */
const cargado = (v: string | null | undefined): v is string =>
  typeof v === 'string' && v.trim() !== '' && !v.startsWith('PENDING');

/**
 * El destino del evento: el conjunto de datos de CRM si el cliente lo creó, y si no
 * el píxel del sitio. Null si no hay ninguno de los dos cargado.
 */
export function destinoCAPI(dataset: string | null | undefined, pixel: string | null | undefined): DestinoCAPI | null {
  if (cargado(dataset)) return { id: dataset.trim(), esCrm: true };
  if (cargado(pixel)) return { id: pixel.trim(), esCrm: false };
  return null;
}

/** A dónde va hoy la calificación de un lead (lo que dice la ficha, 14/10/2026). */
export type AdondeVaLaCalificacion = 'crm' | 'pixel' | 'sin_pixel' | 'sin_token';

/** El veredicto, con lo MISMO que decide el envío: sin destino no sale, sin token tampoco. */
export function adondeDe(destino: DestinoCAPI | null, token: string | null | undefined): AdondeVaLaCalificacion {
  if (!destino) return 'sin_pixel';
  if (!cargado(token)) return 'sin_token';
  return destino.esCrm ? 'crm' : 'pixel';
}

/**
 * Los dos campos que Meta exige SOLO en el payload de un conjunto de datos de CRM.
 * Van aparte porque mandarlos al píxel del sitio es justo lo que la doc prohíbe.
 */
export const CUSTOM_DATA_CRM = { event_source: 'crm', lead_event_source: 'MaKo' } as const;
