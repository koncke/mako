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
 * La COMPRA (27/10/2026, MAU-10: Mauricio vende con un Payment Link de SU Stripe y a Meta no le llegaba ninguna). El `event_id` es el
 * id de la sesión de Stripe: es lo único que tienen igual el servidor (el webhook) y el navegador (la página de gracias, a la que el
 * Payment Link vuelve con `?session_id={CHECKOUT_SESSION_ID}`). Con el mismo `Purchase` + el mismo id, Meta cuenta UNA compra.
 */
export const EVENTO_COMPRA = 'Purchase';
export const eventIdCompra = (sesionId: string): string => `purchase:${sesionId}`;
/**
 * El id de una sesión de pago de Stripe (`cs_test_…`, `cs_live_…`): el `session_id` con el que el Payment Link vuelve a la página de
 * gracias. El Pixel de MaKo (lib/landing-token.ts, v28) lleva la MISMA expresión escrita a mano; tests/compra-navegador.test.ts las cruza.
 */
export const SESION_PAGO_RE = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/;

/**
 * Qué se le manda a Meta de una sesión de Stripe pagada que salió de un Payment Link propio del negocio. null = no es una compra para
 * avisar (no está pagada, no vino de un link, o le falta el monto o la moneda: un Purchase sin valor no optimiza y confunde).
 */
export function compraDeLaSesion(s: {
  id: string; pagoEstado: string | null; paymentLink?: string | null; monto: number | null; moneda: string | null;
  email: string | null; telefono?: string | null; modo?: 'real' | 'prueba';
}): { eventId: string; value: number; currency: string; email: string | null; phone: string | null } | null {
  // Una venta de PRUEBA (la clave `sk_test`) no se le avisa a Meta: entraría al píxel como una compra de verdad (el diseño, §5).
  if (s.modo !== 'real') return null;
  if (s.pagoEstado !== 'paid' || !s.paymentLink || s.monto == null || !(s.monto > 0) || !s.moneda) return null;
  return { eventId: eventIdCompra(s.id), value: s.monto, currency: s.moneda, email: s.email, phone: s.telefono ?? null };
}

/**
 * La clave de deduplicación de la calificación de un lead.
 *
 * ⚠️ ESTABLE POR LEAD, Y ESO ES EL ARREGLO. `lib/leads.ts` dispara comparando el
 * valor viejo contra el nuevo, así que marcar → desmarcar → marcar manda DOS
 * eventos. Con el id derivado del lead, el segundo llega con la misma clave y Meta
 * lo descarta en vez de contar dos conversiones.
 *
 * ⚠️ LA VENTANA DE DEDUPLICACIÓN ES DE META, NO NUESTRA: 48 horas, y se queda con el PRIMERO (documentado; ver la
 * sección de #856 en docs/hallazgos-ads.md: lo enviado no se corrige). Esto cubre el rebote de
 * minutos u horas, que es el caso real (alguien se equivoca y corrige). Una
 * idempotencia que tenga que valer meses necesita una columna nuestra, y hoy no
 * existe — está anotado en docs/hallazgos-ads.md.
 */
export const eventIdCalificado = (leadId: number) => `calif:${leadId}`;

/**
 * La línea del historial (campo `Meta`) que deja una calificación que SÍ entró a Meta. Es NUESTRA marca de «ya se
 * mandó» (#856, 17/10/2026): lo que viaja a Meta no se corrige, y pasadas las 48 h de su dedup, desmarcar y volver a
 * marcar contaba una SEGUNDA conversión. Con la línea escrita no se vuelve a mandar nunca. Sin columna nueva: es un
 * hecho del lead, y en el historial además se lee.
 */
export const LINEA_CALIFICADO_EN_META = 'Meta ya recibió que está calificado';

/**
 * Cuánto espera el aviso antes de salir: la ventana del «Deshacer» del toast (5 s, `useToast` en app/_ui/Toast.tsx)
 * y un margen. Hasta el 17/10/2026 salía en el acto (de fondo desde #854), así que un «Calificado» tocado por error y
 * deshecho al segundo ya había llegado a Meta, que optimizaba el anuncio del cliente con un dato falso.
 */
export const ESPERA_AVISO_CALIFICADO_MS = 8000;

/**
 * ¿Sale el aviso? Se pregunta AL SALIR, con el lead releído: si sigue calificado y si nunca se mandó. Si no se pudo
 * releer, no sale (una señal a Meta no se puede deshacer: sin verificarla, no se afirma).
 */
export function avisaCalificadoAMeta(p: { sigueCalificado: boolean | null; yaSeMando: boolean }): boolean {
  return p.sigueCalificado === true && !p.yaSeMando;
}

/** La clave del lead crudo. El webhook de Meta reintenta el batch entero. */
export const eventIdLeadCrudo = (leadgenId: string) => `lead:${leadgenId}`;

// ─────────────────────────────────────────────────────────────────────────────
// EL SCHEDULE: UN SOLO ID PARA EL NAVEGADOR Y PARA EL SERVIDOR (24/10/2026)
// ─────────────────────────────────────────────────────────────────────────────
// Martín, 24/10: «soluciona esto... Es error de mako». Meta junta el Schedule del navegador (`fbq`) con el de CAPI sólo
// si traen el MISMO `event_id`; el servidor mandaba `schedule:<email>:<inicio>` y el navegador ninguno, así que cada
// reserva podía contarse dos veces (AGENTS.md, «SI LA PÁGINA YA MANDA UN EVENTO DESDE EL NAVEGADOR…»). El id sale ahora
// de lo que las DOS puntas tienen: la URI del evento agendado de Calendly (el `postMessage` `calendly.event_scheduled`
// la trae en `payload.event.uri`; el webhook, en `payload.scheduled_event.uri`). Diseño completo:
// docs/diseno-eventos-meta-por-funnel.md.

/**
 * El id de una reserva de Calendly: el último tramo de su URI (`…/scheduled_events/<uuid>`), sin las barras finales y
 * hasta 80 caracteres. ⚠️ ES LA MISMA CUENTA QUE HACE EL NAVEGADOR en `SCRIPT_DISENO` (lib/editor-landing/html-editable.ts)
 * y que `uuidDeUri` (lib/calendly-error.ts): si una de las tres cambia sola, los ids dejan de coincidir y Meta vuelve a
 * contar dos. Lo cuida tests/meta-schedule-id.test.ts.
 */
export function idDeReservaCalendly(uri: unknown): string | null {
  if (typeof uri !== 'string') return null;
  const t = uri.trim().replace(/\/+$/, '').split('/').pop() ?? '';
  return t ? t.slice(0, 80) : null;
}

/**
 * El `event_id` del Schedule de Calendly. Con la URI del evento, `schedule:<uuid>` (el que también arma el navegador). Sin
 * ella, el formato de antes (email + hora de inicio): sólo deduplica los reintentos del propio webhook, porque el navegador
 * nunca lo puede armar, y por eso el navegador sin URI NO manda nada (ver `SCRIPT_DISENO`).
 */
export function eventIdSchedule(p: { eventoUri?: unknown; email: string; inicioIso: string }): string {
  const id = idDeReservaCalendly(p.eventoUri);
  return id ? `schedule:${id}` : `schedule:${p.email.toLowerCase()}:${p.inicioIso}`;
}

/**
 * ¿La página donde se reservó YA le manda el Schedule a Meta, sin un id compartido, al mismo píxel al que MaKo lo
 * mandaría? Entonces MaKo NO lo repite por CAPI: con dos ids distintos (o uno solo) Meta cuenta dos. Es el caso medido
 * en la landing de un cliente (24/10/2026): su propio código dispara `fbq('track','Schedule')` sin `eventID`.
 *
 * Lo dice el analizador (`scheduleDelNavegador`, lib/landing-analisis.ts): `meta-schedule` = lo manda SIN id;
 * `meta-schedule-id` = lo manda con id (entonces MaKo sí, con el mismo); `meta-px:<id>` = los píxeles que la página
 * inicia. Sin análisis (`null`) o sin la pieza, MaKo manda como siempre: «no sé» no apaga un evento que ya existía. Con la
 * pieza y sin saber a qué píxel va, se asume el mismo: un evento bien contado vale más que dos.
 */
export function repiteScheduleDeLaPagina(piezas: readonly string[] | null, pixelDestino: string | null): boolean {
  if (!piezas || !piezas.includes('meta-schedule')) return false;
  const pixeles = piezas.filter((p) => p.startsWith('meta-px:')).map((p) => p.slice('meta-px:'.length));
  if (!pixeles.length || !pixelDestino) return true;
  return pixeles.includes(pixelDestino);
}

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
