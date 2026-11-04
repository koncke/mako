// =============================================================================
// onboarding-arranque — el chat de arranque: el onboarding de MaKo es una conversación
// =============================================================================
// Pedido de Martín (16/10/2026): «Quiero que elimines todo lo que hay hoy en onboarding tal como está y
// que lo reemplaces por el chat de "Offer"… este onboarding no tiene que ser solo de "offer" (aunque será
// la gran parte), sino que también debe preguntar otras cosas, como el nombre, luego de analizar su offer,
// preguntar su funnel para que lo elija (y así crear su primer CRM)… NO quiero que sea un onboarding
// eterno, es más, mientras más ágil y rápido mejor.» El wizard de antes quedó escrito, pantalla por
// pantalla, en docs/onboarding-pasos-anteriores.md.
//
// Acá viven las reglas PURAS (sin `server-only`, con test que las ejecuta): en qué ETAPA está la
// conversación, qué DICE MaKo en cada una y con qué OPCIONES, qué CRM recomienda, cómo se lee cada
// respuesta y qué se escribe en el perfil del negocio al terminar. La ruta (/api/onboarding/arranque) sólo
// lee los hechos, aplica lo que esto decide y persiste; la pantalla (app/onboarding/ChatArranque.tsx) sólo
// dibuja.
//
// DOS MODOS, porque las capas no ven lo mismo (lib/capas.ts):
//   · 'oferta' (Completo, Agencia): el WhatsApp (o «ahora no»; lo primero desde el 30/10) → nombre → negocio → LO QUE
//     VENDE (la conversación de Offer, reducida) → el PDF con lo que vende → el diagnóstico de fase (con sus opciones) →
//     el CRM que elige → cierre.
//   · 'plan' (Project Manager: no ve Offer ni el CRM): nombre → negocio → objetivo → a qué se dedica → el
//     diagnóstico de fase (las preguntas originales, con sus opciones) → cierre con el plan de arranque.
//
// ⚠️ EL ANÁLISIS DE LA OFERTA NO VA (Martín, 16/10/2026 a la tarde): «Sería bueno que la funcionalidad de
// "OFFER" no esté en el onboarding, sino que ya luego del onboarding el usuario pueda ir a analizar su oferta
// allí... Pero simular "Offer" en el onboarding simplemente para organizar en un PDF lo que vende el usuario».
// La conversación es la de Offer en su versión del onboarding (`OFFER_ARRANQUE_SYSTEM_TEMPLATE`,
// lib/offer-ia.ts): pregunta sólo `PIEZAS_DEL_ARRANQUE` y no ofrece «Armar mi oferta». El diagnóstico de la
// oferta y la oferta mejorada se hacen después, en la tab Offer, sobre la MISMA conversación. El diagnóstico
// de FASE sí queda (es el Norte de MaKo, no el análisis de la oferta), y lo pregunta el arranque con opciones.
// ⚠️ LO QUE NO SE PREGUNTA, y por qué: la zona horaria la toma sola el navegador del admin
// (ZonaDelNegocio en el layout); Meta se conecta después desde su tab (se posterga y queda el
// recordatorio en /general); la IA propia ya no hace falta para arrancar. Todo lo demás del perfil sale de
// la conversación de la oferta.
// ⚠️ LA VOZ: lo que lee el cliente va de «tú», neutro (AGENTS.md: la voz rioplatense es la de MaKo con
// Martín, no la del texto del cliente). El guard de voseo barre este archivo.
// =============================================================================

import { CANALES, PREGUNTAS, VOLUMEN_POR_CANAL, type CanalId } from './fase-diagnostico';
import { TIPOS_CRM, type TipoCrm, type TipoCrmId } from './pipeline';
import type { PiezasSabidas, PropuestaOferta } from './offer-marco';
import type { PropuestaCrm } from './onboarding-crm';
import { RUTA_AUTOMATIONS } from './ruta-automations';
import { NOTA_DE_VOZ } from './chat-mako-reglas';
import { AVISOS_LISTOS, AVISOS_SIN_SOPORTE, PIDE_AVISOS, PREGUNTA_AVISOS } from './avisos-telefono-reglas';
import {
  DICE_NO, DICE_SI, MONEDA_DOLAR, MONEDA_LOCAL, NO_DE_UNA_PALABRA, NOMBRA_LO_PREGUNTADO, PUEDE_SER_NOMBRE, SI_DE_UNA_PALABRA, TRAS_EL_NO,
} from './onboarding-frases';

export type ModoArranque = 'oferta' | 'plan';

/** Lo que el chat guardó de la conversación (app_settings 'onboarding.arranque', un JSON por workspace). */
export type EstadoArranque = {
  nombre?: string;
  negocio?: string;
  /** El negocio que nombró junto con su nombre («Martín, de Acme»): se OFRECE en la pregunta del negocio, nunca
   *  se da por contestada (en «Martín de Córdoba» lo de después del «de» es un lugar). */
  negocioSugerido?: string;
  /** El nombre del negocio que se ENTENDIÓ y espera el sí antes de escribirse en el workspace (20/10/2026, Florencia, ws21:
   *  «mi marca personal: Florencia Ayelen Carballo» se escribió tal cual en el ws, el CRM, el producto y el PDF). `escrito`
   *  es lo que puso la persona. */
  negocioPorConfirmar?: { escrito: string; nombre: string };
  /** El nombre de la PERSONA que se entendió, cuando va a escribirse en su perfil (vacío o un email): espera el sí (quinta
   *  revisión, 21/10: «Hola, ¿cómo estás?» quedaba «Cómo Estás» en usuarios.nombre). Con un perfil que ya tiene nombre, el
   *  nombre leído sólo saluda y no pide nada. */
  nombrePorConfirmar?: { escrito: string; nombre: string };
  /** Lo ESCRITO sobre el PDF, en orden: lo primero a «¿Está correcto?» que no fue un sí ni un no, y lo que siguió a cada
   *  «Escribiste «…». ¿Lo tomo como que está todo bien?». Sin `pdfOk`, espera ese toque. Con `pdfOk: 'no'` es la nota que
   *  MaKo dijo que anota (sexta revisión, 21/10: una respuesta nueva pisaba la corrección; ahora se suma). */
  pdfEscritas?: string[];
  /** Lo que ESCRIBIÓ en una pregunta con opciones, por id de la pregunta ('canal', 'cuello', 'interes'…), cuando lo
   *  CONFIRMÓ con «Sí, es eso» (20/10/2026, Florencia: «no te deja escribir cuando te da las opciones»). Queda dibujado
   *  como su respuesta, con el «Entendí» y su sí, y así llega al chat «Onboarding». */
  escritas?: Record<string, string>;
  /** Lo ESCRITO en una pregunta con opciones (la fase, el canal, el interés) que se ENTENDIÓ como una opción y espera el
   *  toque que lo confirma (21/10/2026, Cerebro: tres rondas de reglas para leer frases abrieron agujeros nuevos cada vez,
   *  y cada uno guardaba un dato malo en silencio). Nada escrito se guarda sin ese toque (`elegirOpcion`). `id` es el de la
   *  pregunta ('canal', 'cuello', 'interes'…) y `opcion`, el índice de la opción ORIGINAL. */
  opcionPorConfirmar?: { id: string; opcion: number; escrito: string };
  /** «¿Cómo llegaste a MaKo?»: una opción de `ORIGENES` o lo que escribió (17/10/2026). */
  origen?: string;
  /** «¿Qué quieres que MaKo resuelva primero?» (modo 'oferta'): decide a qué pestaña entra al terminar. */
  interes?: InteresId;
  objetivo?: string;
  /** Sólo en modo 'plan': en 'oferta' sale de la conversación de la oferta. */
  queHace?: string;
  /** La respuesta de cada pregunta del diagnóstico que hizo el ARRANQUE (índice de la opción ORIGINAL, -1 =
   *  sin contestar): todas en modo 'plan'; en 'oferta', sólo las que la conversación de la oferta no llegó a hacer. */
  faseResp?: number[];
  /** Dónde cierra la venta, si lo preguntó el arranque (la pregunta de canal va antes de la de volumen). */
  canal?: CanalId;
  /** El tipo de CRM que eligió (modo 'oferta'). */
  crmTipo?: TipoCrmId;
  /** Mostrar todos los tipos de CRM, no sólo los de su canal. */
  crmVerTodos?: boolean;
  /** El CRM a medida que armó MaKo con lo que vende (20/10/2026, lib/onboarding-crm.ts). null = se intentó y no salió: queda
   *  la plantilla de su canal. Se arma una vez, al llegar a la pregunta del CRM. */
  crmPropuesta?: PropuestaCrm | null;
  /** «¿Está correcto el PDF?» (18/10/2026): 'no' = faltan cosas o hay algo mal; se anota y se sigue. */
  pdfOk?: 'si' | 'no';
  /** Cómo cobra lo que vende, CONFIRMADO con un toque (cuarta revisión, 21/10): lo que se lee del precio (`cobroDelPrecio`)
   *  se propone y se guarda recién con «Sí, es eso» o con la otra opción. Sin esto, el producto nace como pago único. */
  cobro?: Cobro;
  /** El teléfono de los avisos: 'codigo' = se mandó el código y falta cargarlo. */
  telefono?: 'codigo' | 'verificado' | 'postergado';
  telefonoNumero?: string;
  /** Desde el 4/11/2026 la persona le ESCRIBE a MaKo (lib/verificacion-entrante.ts): 'codigo' = falta que mande el mensaje. Sin esto, MaKo le mandó el código. */
  telefonoEntrante?: boolean;
  /** La conversación de Offer donde vive la oferta (modo 'oferta'). */
  sesionId?: number;
  /** El chat «Onboarding» del Ops Center con esta conversación (20/10/2026): se crea una vez, al terminar. */
  hiloChat?: number;
  /** De quién es ese chat (su chart_key): la proyección de Offer sólo se lo esconde a esa persona. */
  hiloDe?: string;
  /** Cuándo se copió: si la conversación de Offer siguió DESPUÉS, la proyección vuelve a listarla (la copia es una foto). */
  hiloAt?: string;
  /** Quién contestó el onboarding (su chart_key, `chartKeyDePersona`): el chat «Onboarding» es para esa persona, no para
   *  otro admin que entre primero (20/10/2026, revisión del Cerebro). */
  dueno?: string;
  /** La reserva mientras se arma el chat: otra pestaña o el Ops Center no crean un segundo (`decisionDelHilo`). */
  hiloCreando?: { at: string; por: string };
  /** Ya vio la animación del principio: no se repite al recargar. */
  introVista?: boolean;
  /** «Mi teléfono no puede» (3/11/2026): la única salida del paso de los avisos, y sólo la ofrece un navegador que no los recibe. Que los active se MIDE, no se guarda. */
  avisos?: 'sin-soporte';
};

/** Lo que el server MIDE (nunca se guarda: estado vivo, no recordado). */
export type HechosArranque = {
  modo: ModoArranque;
  /** usuarios.nombre de quien entra (de Google o de quien lo invitó): el nombre para «uso mi nombre». */
  nombreCuenta: string;
  /** workspaces.nombre (lo puso el alta). NO se ofrece como opción (Martín, 18/10: sin respuestas rápidas en el nombre
   *  ni en el negocio); queda para lo que lo lea sin ofrecerlo, como un saludo. */
  nombreWorkspace: string;
  /** El negocio ya tiene diagnóstico de fase guardado. */
  faseGuardada: boolean;
  /** El canal del diagnóstico guardado (dónde cierra la venta), o null. */
  canalNegocio: CanalId | null;
  /** La conversación ya sabe lo que vende (`PIEZAS_DEL_ARRANQUE`, lib/offer-marco.ts): está su PDF. */
  loQueVende: boolean;
  /** Cómo cobra, LEÍDO del precio que contó (`cobroDelPrecio`), para proponerlo y que lo confirme. null = no dijo precio. */
  cobroLeido?: Cobro | null;
  /** Las opciones del cobro: todas las lecturas posibles del precio (`opcionesDeCobro`). Sin esto, las de `cobroLeido`. */
  cobroOpciones?: Cobro[] | null;
  /** Lo que ya contestó del diagnóstico en la conversación de la oferta (id de pregunta → opción ORIGINAL, y el
   *  canal si lo contestó ahí), o null sin conversación. El arranque no lo vuelve a preguntar. */
  faseOffer?: { respuestas: Record<string, number>; canal: CanalId | null } | null;
  /** La capa ve el CRM: el chat siembra su funnel principal. */
  conCrm: boolean;
  /** La capa tiene el paso del teléfono ('tabs'). */
  conTelefono: boolean;
  /** El onboarding ya está cerrado. */
  terminado: boolean;
  /** El paso de los avisos aplica (lib/avisos-telefono.ts). Sin esto, no existe: mirando a otro, o con el push apagado, no se traba a nadie. */
  conAvisos?: boolean;
  /** Tiene un TELÉFONO con los avisos activados. Medido en cada lectura. */
  avisosListos?: boolean;
};

export type EtapaArranque =
  | 'nombre' | 'negocio' | 'origen' | 'interes' | 'objetivo' | 'que_hace' | 'fase' | 'oferta' | 'pdf' | 'cobro' | 'crm'
  | 'telefono' | 'codigo' | 'avisos' | 'cierre' | 'listo';

/** `pdf`: el PDF con lo que vende (la ruta lo arma con las piezas de la conversación). */
export type TarjetaArranque = 'crm' | 'telefono' | 'whatsapp' | 'avisos' | 'pdf' | 'listo';

/** Un mensaje del chat de arranque (los de la conversación de la oferta son los de Offer, aparte). */
export type MensajeArranque = {
  id: string;
  de: 'mako' | 'yo';
  texto: string;
  opciones?: string[];
  tarjeta?: TarjetaArranque;
};

// ── Textos ──────────────────────────────────────────────────────────────────
export const OBJETIVOS_SUGERIDOS = ['Conseguir mis primeros clientes', 'Vender más cada mes', 'Escalar sin depender de mí'] as const;
export const AHORA_NO = 'Ahora no';
/** La respuesta que se dibuja (y se anota) al cargar el código del WhatsApp: el código no se guarda. */
export const CODIGO_CARGADO = 'Listo, ya lo cargué.';
/** Lo mismo, cuando la persona le escribió a MaKo (4/11/2026): no cargó nada en la app. */
export const MENSAJE_MANDADO = 'Listo, ya te escribí.';
export const CAMBIAR_NUMERO = 'Cambiar número';
export const VER_OTROS_TIPOS = 'Ver otros tipos';
/** La primera respuesta del CRM (18/10/2026, Martín, punto 10: «las respuestas rápidas tiene que ser ‹Sí, es correcto› u
 *  otras opciones»): acepta el que se le propone. */
export const CRM_SI = 'Sí, es correcto';
export const CRM_PREGUNTA = 'Ahora armemos tu CRM. Estas son las etapas por las que va a pasar cada cliente, de la primera charla a la venta. ¿Te sirven?';
const PREGUNTA_CANAL = '¿Dónde cierras la venta?';

const TOPE_RESPUESTA = 300;
/** Corta por PUNTO DE CÓDIGO, no por unidad UTF-16 (séptima revisión, 21/10): un emoji en el corte dejaba medio par suelto,
 *  que se ve «�» y que Postgres rechaza al copiar la conversación al chat «Onboarding». */
export const cortar = (s: string, n: number): string => { const a = Array.from(s); return a.length > n ? a.slice(0, n).join('') : s; };

/**
 * LAS DOS PREGUNTAS NUEVAS (17/10/2026). Martín: «investiga las preguntas que nos hacen falta: me imagino "¿Cómo nos
 * conociste?", "¿Qué funcionalidad de estas te interesa más?"». Lo que se midió antes de sumarlas: el abandono de una
 * encuesta de bienvenida sube con cada pregunta (más rápido en las primeras), y una pregunta que no CAMBIA nada visible
 * se saca. Por eso son de un toque, y cada una decide algo: el origen dice de dónde vienen los clientes (lo mira el
 * super admin para la pauta) y el interés decide a qué pestaña entra al terminar. El detalle, en
 * docs/hallazgos-onboarding.md.
 */
/**
 * El primer mensaje: explica para qué son las preguntas y cuánto tardan ANTES de preguntar (18/10/2026, Martín: «empieza
 * a preguntar de la nada»).
 */
export const SALUDO_ARRANQUE = '¡Hola! Soy MaKo. Para dejar tu cuenta lista necesito conocer tu negocio: son unas preguntas rápidas, menos de 5 minutos. Para empezar, ¿cómo te llamas?';
/** EL WHATSAPP, LO PRIMERO (30/10/2026, estrategia de lanzamiento): quien compró ya pagó, y sin su número nadie puede escribirle. */
export const PREGUNTA_TELEFONO = '¡Hola! Soy MaKo. ¿A qué WhatsApp te escribo con los avisos y los reportes?';
/** El saludo cuando ya saludó con la pregunta del WhatsApp. */
export const SALUDO_TRAS_TELEFONO = 'Para dejar tu cuenta lista necesito conocer tu negocio: son unas preguntas rápidas, menos de 5 minutos. Para empezar, ¿cómo te llamas?';
export const PIDE_TELEFONO = 'Escribe tu WhatsApp con el código de país (como +52…), o toca «Ahora no».';
/**
 * El WhatsApp escrito en la caja del chat y no en la tarjeta (31/10/2026: es lo primero que ve quien pagó, y escribirlo ahí
 * contestaba «Ahora no estoy esperando eso»). Sin la tarjeta no hay lada: hace falta el país, con «+» o con el número largo.
 * Un número local («1155551234») no se adivina. Devuelve los dígitos, o null.
 */
export function telefonoEscrito(texto: string): string | null {
  const t = (texto || '').trim();
  if (!/^\+?[\d\s().-]+$/.test(t)) return null;
  const digitos = t.replace(/\D/g, '');
  if (digitos.length > 15 || digitos.startsWith('0')) return null;
  return digitos.length >= (t.startsWith('+') ? 8 : 11) ? digitos : null;
}

/** El PDF de lo que vende, con su confirmación (18/10/2026). */
export const PDF_PREGUNTA = 'Perfecto: ya tengo claro qué vendes. Te armé un PDF con tu oferta, ¿está correcto?';
export const PDF_OPCIONES = ['Sí, está correcto', 'No, faltan cosas o hay algo mal'] as const;
export const PDF_NO = 'Está bien: lo anoto para trabajarlo dentro de la app. Ahora sigamos para terminar el onboarding.';
/** Lo escrito al PDF que no es un sí ni un no se confirma con un toque (quinta revisión, 21/10): sumar palabras a una lista
 *  («salvo», «pero»…) no terminaba nunca. CON LA MISMA POLARIDAD que «¿está correcto?» (sexta revisión, 21/10: «¿Lo tomo
 *  como que falta algo?» invertía el sí, y «Está perfecto» se anotaba como corrección), y con lo que confirma adentro: una
 *  pregunta fija no la distingue el guard de pestaña vieja. */
export const pdfConfirmarPregunta = (escrito: string): string => {
  // Pasado el tope se suma a lo último con un salto de línea (`SUMA_PDF`), que la persona no puede escribir: `limpiarRespuesta`
  // los aplana (décima revisión, 21/10: con « · » se partía también lo que escribió). La pregunta repite lo ÚLTIMO sumado, y
  // cuántas cosas más van, así cambia con cada suma y el guard de pestaña vieja la distingue (novena y décima).
  const tramos = escrito.split(SUMA_PDF);
  const ultimo = tramos[tramos.length - 1];
  const mas = tramos.length - 1;
  const citado = cortar(ultimo, 60) === ultimo ? ultimo : `${cortar(ultimo, 60).trimEnd()}…`;
  return `Escribiste «${citado}»${mas ? ` (y ${mas} ${mas === 1 ? 'cosa' : 'cosas'} más)` : ''}. ¿Lo tomo como que está todo bien?`;
};
/** Cómo se suma una corrección a lo último pasado el tope: un salto de línea, que lo escrito no trae. */
export const SUMA_PDF = '\n';
/** Cuántas cosas escritas se suman al PDF antes de pedir el botón (séptima revisión, 21/10: la nota no tenía tope). */
export const PDF_TOPE_ESCRITAS = 5;
export const PDF_BIEN = 'Sí, está todo bien';
export const PDF_FALTA = 'No, hay algo para corregir';
/** La nota de un «no» al PDF sin nada escrito (sexta revisión, 21/10: el «No» tocado no dejaba marca). */
export const PDF_SIN_DETALLE = 'Dijo que algo no está bien, sin detalle.';
/** Lo que MaKo dijo que anota con un «no» al PDF: lo escrito, sumado, o la marca sin detalle. null = no dijo que no. */
export const notaDelPdf = (e: EstadoArranque): string | null =>
  e.pdfOk === 'no' ? (e.pdfEscritas?.length ? e.pdfEscritas.join(SUMA_PDF).split(SUMA_PDF).join(' · ') : PDF_SIN_DETALLE) : null;

export const ORIGENES = ['Instagram', 'YouTube', 'TikTok', 'Un anuncio', 'Me lo recomendaron', 'Google', 'Otro'] as const;

export type InteresId = 'anuncios' | 'ventas' | 'whatsapp' | 'organizar';
export const INTERESES: ReadonlyArray<{ id: InteresId; label: string; ruta: string }> = [
  { id: 'anuncios', label: 'Conseguir clientes con anuncios', ruta: '/ads-writer' },
  { id: 'ventas', label: 'Ordenar mis ventas y seguimientos', ruta: '/crm' },
  { id: 'whatsapp', label: 'Que WhatsApp responda solo', ruta: RUTA_AUTOMATIONS },
  { id: 'organizar', label: 'Organizar mi plan y mi equipo', ruta: '/plan' },
];

/** El setting donde el cierre deja cómo llegó y qué quiere resolver primero. Lo lee `ver_estado_onboarding`. */
export const CLAVE_ENCUESTA = 'onboarding.encuesta';

/** Cómo llegó un negocio y qué quería resolver primero, como lo lee el super admin (`llegadaDe`). `pdfNota`: lo que dijo que
 *  faltaba o estaba mal en el PDF de su oferta (quinta revisión, 21/10: «lo anoto» quedaba en un campo que nadie leía). */
export type LlegadaCliente = { origen: string | null; interes: string | null; at: string | null; pdfNota: string | null };

/**
 * La encuesta guardada (`CLAVE_ENCUESTA`), leída para la tabla de clientes del super admin (17/10/2026: «la respuesta se
 * guarda pero se lee cliente por cliente», docs/relevo/onboarding.md). `interes` sale con el RÓTULO de la opción, no con
 * su id. null si no hay o no se entiende.
 */
export function llegadaDe(raw: string | null | undefined): LlegadaCliente | null {
  if (!raw) return null;
  let v: unknown;
  try { v = JSON.parse(raw); } catch { return null; }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const texto = (x: unknown) => (typeof x === 'string' && x.trim() ? cortar(x.trim(), 80) : null);
  const origen = texto(o.origen);
  const interesId = texto(o.interes);
  const interes = interesId ? INTERESES.find((i) => i.id === interesId)?.label ?? interesId : null;
  const at = typeof o.at === 'string' && Number.isFinite(Date.parse(o.at)) ? o.at : null;
  const pdfNota = typeof o.pdfNota === 'string' && o.pdfNota.trim() ? cortar(o.pdfNota.trim(), 300) : null;
  return origen || interes || pdfNota ? { origen, interes, at, pdfNota } : null;
}

/** A dónde entra al terminar: la pestaña de lo que quiere resolver primero, o /general. */
/**
 * A dónde entra al terminar: el Ops Center (/second-brain), siempre (18/10/2026, Martín: «la primera tab que ve el cliente es
 * Ops Center»). Lo que dijo que quiere resolver primero queda en la encuesta y en `rutaDeEntrada`, pero ya no decide la entrada.
 */
export const RUTA_AL_TERMINAR = '/second-brain';

/** El tutorial del Ops Center que arranca al terminar el onboarding (20/10/2026). */
export const RECORRIDO_INICIO = 'sb-inicio';

/**
 * Al terminar entra AL CHAT «Onboarding», con la conversación tal cual, y arranca el tutorial (20/10/2026, Martín, punto 13
 * del 18/10: «debería estar posicionado en el chat de ‹Onboarding›... con toda la conversación tal cual... y luego debería
 * iniciar el tutorial de la app»). Sin chat (falló crearlo), al Ops Center igual: nunca se traba el final.
 */
export function rutaDelHilo(chat: number | null): string {
  return chat ? `${RUTA_AL_TERMINAR}?chat=${chat}&recorrido=${RECORRIDO_INICIO}` : `${RUTA_AL_TERMINAR}?recorrido=${RECORRIDO_INICIO}`;
}

/** El título del chat del Ops Center con la conversación del onboarding. */
export const TITULO_HILO = 'Onboarding';

/**
 * El `contexto` del chat «Onboarding»: lo MARCA (se reconoce por esto, no por el título: un chat propio que se llame
 * «Onboarding» no es éste) y le dice al modelo qué es esta conversación (el contexto de la sesión va en su prompt).
 */
export const contextoDelHilo = (sesionId: number | undefined): string =>
  `Este chat guarda el onboarding del negocio: lo que contó al empezar en MaKo (onboarding:${sesionId ?? 'arranque'}).`;

/** Cuánto vale una reserva del chat «Onboarding» antes de darla por abandonada. */
export const RESERVA_HILO_MS = 120_000;

/**
 * ¿Se crea el chat «Onboarding» para quien entra? (20/10/2026, revisión del Cerebro). 'listo' = ya existe · 'otro' = no es
 * de esta persona (lo contestó otra; sin dueño anotado, sólo si el negocio tiene UN admin) · 'ocupado' = otra pestaña o el
 * Ops Center lo están armando ahora · 'crear' = esta persona lo arma.
 */
export function decisionDelHilo(e: EstadoArranque, quien: string, o: { ahora: number; unSoloAdmin: boolean }): 'listo' | 'otro' | 'ocupado' | 'crear' {
  if (typeof e.hiloChat === 'number' && e.hiloChat > 0) return 'listo';
  if (e.dueno ? e.dueno !== quien : !o.unSoloAdmin) return 'otro';
  const r = e.hiloCreando;
  if (r && o.ahora - (Date.parse(r.at) || 0) < RESERVA_HILO_MS) return 'ocupado';
  return 'crear';
}

/**
 * El último mensaje del chat «Onboarding» (20/10/2026, llamada con Florencia del 18/10: salió al Ops Center sin guía y sin
 * saber dónde pedir ayuda). Pregunta por dónde empezar con lo que dijo que quería resolver primero (`interes`, que se
 * guardaba y nadie leía), nombra lo que MaKo ya puede hacer y dónde avisar si algo no anda: ahí MaKo abre el ticket.
 */
export function salidaDelOnboarding(interes: InteresId | undefined): string {
  const i = INTERESES.find((x) => x.id === interes);
  const primero = i ? `Me dijiste que quieres empezar por «${i.label.toLowerCase()}»: ¿arrancamos por ahí?` : '¿Por dónde quieres empezar?';
  return `Listo, ya conozco tu negocio. ${primero} También puedo armar tu landing, escribir tus anuncios o tus guiones, cargar tus clientes al CRM o crear tus primeras publicaciones.\n\nSi algo no funciona, escríbemelo aquí o en tu grupo de WhatsApp con MaKo y abro un ticket para que lo arreglen.`;
}

/**
 * Los mensajes del chat «Onboarding», en el orden en que pasaron: la conversación tal cual (un adjunto sin texto dice su
 * nombre: si no, se perdía) y al final la salida (`salidaDelOnboarding`).
 */
export function mensajesDelHilo(
  mensajes: ReadonlyArray<{ de: 'mako' | 'yo'; texto: string; adjuntos?: ReadonlyArray<{ nombre: string }>; id?: string; audio?: { secs: number } }>,
  interes: InteresId | undefined,
): Array<{ role: 'user' | 'assistant'; content: string; audio?: { mensaje: string; secs: number } }> {
  // Una respuesta por VOZ lleva cuál mensaje de Offer tiene el audio (21/10/2026, Florencia: se copiaba sólo la
  // transcripción): el audio no se copia, se reproduce desde la conversación (/api/offer/audio).
  const out = mensajes.map((m) => {
    const audio = m.audio && typeof m.id === 'string' && m.id ? { audio: { mensaje: m.id, secs: Math.max(0, Math.round(m.audio.secs || 0)) } } : {};
    const content = (m.texto ?? '').trim() || (m.adjuntos ?? []).map((a) => `Adjunto: ${a.nombre}`).join('\n') || ('audio' in audio ? NOTA_DE_VOZ : '');
    return { role: m.de === 'yo' ? 'user' as const : 'assistant' as const, content, ...audio };
  }).filter((m) => m.content);
  return [...out, { role: 'assistant', content: salidaDelOnboarding(interes) }];
}

export function rutaDeEntrada(interes: InteresId | undefined): string {
  return INTERESES.find((i) => i.id === interes)?.ruta ?? '/general';
}

/** El interés de una respuesta: la opción tal cual, o lo escrito por sus palabras («los anuncios», «el WhatsApp»). */
export function interesDe(texto: string): InteresId | null {
  const crudo = (texto || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
  if (!crudo) return null;
  const exacto = INTERESES.find((i) => i.label.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase() === crudo);
  if (exacto) return exacto.id;
  // Sin lo negado, como el canal (tercera revisión, 21/10: «no quiero anuncios, quiero ordenar mis ventas» era 'anuncios'),
  // y con un solo interés: con dos a la vez decide la opción más parecida, y siempre se confirma con un toque.
  const t = crudo.replace(/\b(?:no|nunca|sin|ni)\s+(?:(?:me|te|nos|quiero|interesan?|necesito|busco)\s+)*(?:los?\s+|las?\s+|el\s+)?\S+/g, ' ')
    .replace(/\b\S+\s+no\b/g, ' ');
  const hay = ([
    ['anuncios', /anuncio|publicidad|\bads\b|meta|campan|conseguir/],
    ['whatsapp', /whats|wsp|wpp|mensaje|responda|chat/],
    // Sin «cliente»: «conseguir clientes» es la de los anuncios, y con las dos no decidía ninguna.
    ['ventas', /venta|seguimiento|\bcrm\b|lead/],
    ['organizar', /plan|equipo|tarea|organiz/],
  ] as Array<[InteresId, RegExp]>).filter(([, re]) => re.test(t)).map(([id]) => id);
  return hay.length === 1 ? hay[0] : null;
}

const PALABRAS_VACIAS = new Set(['que', 'los', 'las', 'del', 'con', 'por', 'para', 'una', 'uno', 'unos', 'mis', 'sus', 'pero', 'cuando', 'como', 'mas', 'muy', 'ese', 'esa', 'eso', 'esto', 'esta', 'son', 'sin', 'hoy', 'todo', 'toda', 'nada', 'solo', 'sola', 'algo']);
const normal = (t: string): string => (t || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
/**
 * Las palabras que cuentan de un texto, por su raíz (las 5 primeras letras: «empujo» y «empujar» son la misma). Sin los
 * NÚMEROS (el «000» de «15.000» empataba con todas las opciones con «.000», 20/10/2026). Lo NEGADO va MARCADO con «!»: las
 * dos palabras después de «no», «nunca», «sin» o «ni». No se borra (20/10/2026, noche, revisión del Cerebro): borrarlo
 * también borraba el «no cierran» de la OPCIÓN, y «tengo leads pero no cierran» caía en «Me sobra volumen» por «leads».
 * Marcado, «no hago llamadas» sigue sin ser «Llamada de venta», y «no cierran» empareja con el «no cierran» de la opción.
 */
const palabrasDe = (t: string): string[] => {
  const out: string[] = [];
  let negadas = 0;
  for (const w of normal(t).split(/[^a-z0-9ñ]+/).filter(Boolean)) {
    if (w === 'no' || w === 'nunca' || w === 'sin' || w === 'ni') { negadas = 2; continue; }
    const negada = negadas > 0;
    if (negada) negadas -= 1;
    if (w.length >= 3 && !/^\d+$/.test(w) && !PALABRAS_VACIAS.has(w)) out.push(`${negada ? '!' : ''}${w.slice(0, 5)}`);
  }
  return out;
};

/**
 * La opción más parecida a lo que escribió, por las palabras que comparten (20/10/2026, Florencia: «vendo cuando empujo yo,
 * pero va cambiando» no se aceptaba en «¿Cuál es tu mayor cuello de botella?»). Hace falta EVIDENCIA: `minimo` palabras en
 * común (dos, salvo opciones sin vocabulario compartido), o una negada en común («no cierran» con el «no cierran» de la opción). Con una sola palabra suelta («leads») o con un
 * empate, null: se muestran las opciones. Sin pesos dobles (21/10/2026, tercera revisión: lo negado valiendo doble pisaba
 * el contenido, «interesados pero no compran» caía en «no me compra»). Igual, lo que devuelve se CONFIRMA (`elegirOpcion`).
 */
export function opcionMasCercana(texto: string, opciones: readonly string[], minimo = 2): number | null {
  const mias = new Set(palabrasDe(texto));
  let mejor = -1;
  let puntos = 0;
  let negada = false;
  let empate = false;
  opciones.forEach((o, i) => {
    const comunes = [...new Set(palabrasDe(o))].filter((w) => mias.has(w));
    const p = comunes.length;
    if (p > puntos) { puntos = p; mejor = i; empate = false; negada = comunes.some((w) => w.startsWith('!')); } else if (p > 0 && p === puntos) empate = true;
  });
  return !empate && puntos > 0 && (puntos >= minimo || negada) ? mejor : null;
}

// ── Las cifras escritas ─────────────────────────────────────────────────────
// La revisión de la noche del 20/10 (Cerebro) encontró que «millones» se multiplicaba por MIL («Facturo 2 millones» caía en
// «$0 – $3.000»), que «entre 30 y 50 mil» promediaba 30 con 50.000, y que «15 mil y tengo 4 clientes» se tomaba como un
// rango. Y la gente escribe en letras («cincuenta mil», «dos millones») y en lunfardo («50 lucas», «2 palos»).
// La batería de frases reales está en tests/onboarding-cifras-escritas.test.ts.

const NUMERO_EN_LETRAS: Record<string, number> = {
  dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13,
  catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21,
  veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26,
  veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70,
  ochenta: 80, noventa: 90, cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300,
  cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600,
  setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900,
};
/** «un», «una» y «medio» sólo son número delante de «mil» o «millón»: «un poco» o «una llamada» no son una cifra. */
const ANTE_MULTIPLICADOR: Record<string, number> = { un: 1, uno: 1, una: 1, medio: 0.5, media: 0.5 };
const MULTIPLICADOR: Record<string, number> = { mil: 1_000, luca: 1_000, lucas: 1_000, millon: 1_000_000, millones: 1_000_000, palo: 1_000_000, palos: 1_000_000 };

/** Un número en letras desde la palabra `k`: lo que vale, cómo se escribe en cifras y hasta qué palabra llegó. null = no empieza uno. */
function numeroEnLetras(ws: readonly string[], k: number, trasCifra: boolean): { texto: string; hasta: number } | null {
  const primera = ws[k];
  const empieza = primera in NUMERO_EN_LETRAS
    || (primera in ANTE_MULTIPLICADOR && ws[k + 1] in MULTIPLICADOR)
    || ((primera === 'mil' || primera === 'millon') && !trasCifra);
  if (!empieza) return null;
  let total = 0;
  let base = 0;
  let ultimo = Infinity;
  let mult = 0;
  let mults = 0;
  let j = k;
  while (j < ws.length) {
    const x = ws[j];
    if (x in NUMERO_EN_LETRAS && NUMERO_EN_LETRAS[x] < ultimo) {
      base += NUMERO_EN_LETRAS[x];
      ultimo = NUMERO_EN_LETRAS[x];
    } else if (x in ANTE_MULTIPLICADOR && !base && ws[j + 1] in MULTIPLICADOR) {
      base = ANTE_MULTIPLICADOR[x];
      ultimo = 1;
    } else if (x in MULTIPLICADOR) {
      const m = MULTIPLICADOR[x];
      total = m >= 1_000_000 ? (total + (base || 1)) * m : total + (base || 1) * m;
      base = 0;
      ultimo = Infinity;
      mult = m;
      mults += 1;
    } else if (x === 'y' && ultimo >= 30 && ultimo < 100 && ultimo % 10 === 0 && (NUMERO_EN_LETRAS[ws[j + 1]] ?? 10) < 10) {
      // «treinta y cinco»: la «y» une una decena con su unidad. «treinta y cincuenta» es un rango: corta acá.
    } else if (x === 'y' && mult && ws[j + 1] === 'medio') {
      total += mult / 2;
      j += 2;
      continue;
    } else break;
    j += 1;
  }
  if (j === k) return null;
  // Con UN multiplicador al final («cincuenta mil», «dos millones», «medio millón»), queda en palabras: así un rango lo
  // comparte («entre treinta y cincuenta mil»). Si no, la cifra entera con sus puntos de miles.
  const texto = mults === 1 && !base
    ? `${total / mult} ${mult >= 1_000_000 ? 'millones' : 'mil'}`
    : String(Math.round(total + base)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return { texto, hasta: j };
}

/** Los números escritos en letras, pasados a cifras: «treinta y cinco mil» → «35 mil». Lo que sigue a una cifra («2 millones») no se toca. */
function conNumerosEnLetras(t: string): string {
  const ws = t.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let k = 0;
  while (k < ws.length) {
    const r = numeroEnLetras(ws, k, k > 0 && /\d$/.test(ws[k - 1]));
    if (!r) { out.push(ws[k]); k += 1; continue; }
    out.push(r.texto);
    k = r.hasta;
  }
  return out.join(' ');
}

/** Un número de un texto: lo que vale, el número sin multiplicar, su multiplicador, si trae marca de plata o de magnitud, y dónde está. */
type Numero = { valor: number; crudo: number; por: number; marcado: boolean; inicio: number; fin: number };

/**
 * Los números de un texto (en cifras o en letras), con su separador de miles («15.000», «15,000»), el multiplicador de atrás
 * («mil», «k», «lucas», «millones», «palos», «M») y la moneda. Devuelve también el texto en el que se buscaron, para mirar
 * qué hay entre dos números.
 */
function numerosDe(texto: string): { t: string; ns: Numero[] } {
  const t = conNumerosEnLetras(normal(texto));
  const ns: Numero[] = [];
  // El espacio también separa miles («15 000», la norma de la RAE; tercera revisión: «15 000 euros» se leía como 0).
  const re = /(\$|us\$|usd\s*)?(\d{1,3}(?:[.,]\d{3})+(?!\d)|\d{1,3}(?: \d{3})+(?![\d.,])|\d+(?:[.,]\d+)?)(?:\s*(millon(?:es)?\b|palos?\b|mil(?:es)?\b|lucas?\b|k\b|m\b))?(\s*(?:usd|us\$|dolares|dls|pesos|euros|mxn|ars|cop|clp)\b)?/g;
  for (const m of t.matchAll(re)) {
    const conMiles = /^\d{1,3}(?:[., ]\d{3})+$/.test(m[2]);
    const crudo = conMiles ? Number(m[2].replace(/[., ]/g, '')) : Number(m[2].replace(',', '.'));
    if (!Number.isFinite(crudo)) continue;
    // «millón» antes que «mil»: con `startsWith('mil')` «2 millones» valía 2.000 (revisión del Cerebro, 20/10 noche).
    const por = !m[3] ? 1 : /^(?:millon|palo|m$)/.test(m[3]) ? 1_000_000 : 1_000;
    const inicio = m.index ?? 0;
    ns.push({ valor: crudo * por, crudo, por, marcado: conMiles || !!m[1] || !!m[3] || !!m[4], inicio, fin: inicio + m[0].length });
  }
  return { t, ns };
}

/** Lo que puede haber entre las dos puntas de un rango: «30 y 50», «de 30 a 50», «30-50», «$10.000 - $30.000», «hasta». */
const ENTRE_PUNTAS = /^\s*(?:y|a|al|-|–|—|hasta|o)\s*(?:\$|us\$|usd)?\s*$/;
/** Lo que cuenta cosas que no son plata: detrás de una cifra, no es la punta de un rango de plata («15 mil y 4 clientes»). */
const COSAS_CONTADAS = /^\s*(?:clientes?|alumnos?|empleados?|personas?|pacientes?|ventas?|cursos?|productos?|servicios?|unidades?|llamadas?|leads?|horas?|dias?|semanas?|meses|anos?)\b/;
/** Lo que no es una cifra aunque lo parezca: «treinta y pico mil», «veintitantos», «cinco cifras» (tercera revisión). */
const CIFRA_VAGA = /\bpico\b|tantos\b|\bcifras\b/;

/**
 * La cifra de una respuesta escrita a una pregunta de cifras («Facturo 15.000 al mes», «entre 30 y 50 mil», «más de
 * 80.000», «cincuenta mil», «$20 por día», «nada»). Un rango vale su medio, y sus dos puntas comparten el multiplicador
 * («entre 30 y 50 mil» es de 30.000 a 50.000), pero no es rango si la segunda punta baja o cuenta otra cosa («15 mil y 4
 * clientes»). Con varias cifras sueltas vale la única con plata o magnitud; si hay más de una, o si la elegida es un precio
 * unitario («10 ventas de 2 mil»), null. Lo diario, lo semanal y lo anual se pasan a mes sólo si van PEGADOS a la cifra y el
 * texto no dice «mes» («40 mil al mes, trabajo 3 días a la semana» son 40.000). null si no dice una cifra clara. Lo que
 * devuelve igual se CONFIRMA con un toque (`elegirOpcion`).
 */
export function cifraDe(texto: string): number | null {
  const { t, ns } = numerosDe(texto);
  if (CIFRA_VAGA.test(t)) return null;
  if (!ns.length) return /^(?:nada|cero|ningun[oa]|todavia (?:nada|no)|no (?:facturo|invierto|saco|tengo|hago)\b)/.test(t.trim()) ? 0 : null;
  const grupos: Array<{ valor: number; marcado: boolean; inicio: number; fin: number }> = [];
  for (let k = 0; k < ns.length; k += 1) {
    const a = ns[k];
    const b = ns[k + 1];
    if (b && ENTRE_PUNTAS.test(t.slice(a.fin, b.inicio)) && !COSAS_CONTADAS.test(t.slice(b.fin))) {
      const va = a.por === 1 && b.por > 1 && a.crudo < b.crudo ? a.crudo * b.por : a.valor;
      const vb = b.por === 1 && a.por > 1 && b.crudo > a.crudo && b.crudo < 1_000 ? b.crudo * a.por : b.valor;
      if (vb >= va) {
        grupos.push({ valor: (va + vb) / 2, marcado: a.marcado || b.marcado, inicio: a.inicio, fin: b.fin });
        k += 1;
        continue;
      }
    }
    grupos.push({ valor: a.valor, marcado: a.marcado, inicio: a.inicio, fin: a.fin });
  }
  const marcados = grupos.filter((g) => g.marcado);
  const g = grupos.length === 1 ? grupos[0] : marcados.length === 1 ? marcados[0] : null;
  if (!g) return null;
  // Con otra cifra al lado, la elegida detrás de «de» o «a» es un precio por unidad: el total no se adivina.
  if (grupos.length > 1 && /\b(?:de|a|por)\s*$/.test(t.slice(0, g.inicio))) return null;
  let v = g.valor;
  if (/\bmas de\b|\barriba de\b|\bpor encima de\b/.test(t)) v += 1;
  if (/\bmenos de\b|\bdebajo de\b/.test(t)) v = Math.max(0, v - 1);
  const pegado = t.slice(g.fin).split(/[,;]|\.\s/)[0].trim().split(/\s+/).slice(0, 5).join(' ');
  const dichoPorMes = /\bmes(?:es)?\b|\bmensual/.test(t);
  if (!dichoPorMes && /\b(?:por|al|x|cada) dia\b|\bdiari[oa]s?\b|\bdiariamente\b/.test(pegado)) v *= 30;
  else if (!dichoPorMes && /\b(?:por|a la|x|cada|en la) semana\b|\bsemanal(?:es|mente)?\b/.test(pegado)) v *= 4.3;
  else if (!dichoPorMes && /\b(?:por|al|x|cada|en el) ano\b|\banual(?:es|mente)?\b/.test(pegado)) v /= 12;
  return v;
}

/** Los tramos de una pregunta de cifras, cada opción como [desde, hasta). null si alguna opción no es un tramo. */
export function tramosDe(opciones: readonly string[]): Array<[number, number]> | null {
  const out: Array<[number, number]> = [];
  for (const o of opciones) {
    const { t, ns: nums } = numerosDe(o);
    const ns = nums.map((n) => n.valor);
    if (/\bmas de\b/.test(t) && ns.length === 1) out.push([ns[0], Infinity]);
    else if (/\bmenos de\b/.test(t) && ns.length === 1) out.push([0, ns[0]]);
    else if (ns.length >= 2) out.push([ns[0], ns[1]]);
    else return null;
  }
  return out;
}

/**
 * En una pregunta de cifras, la opción del TRAMO donde cae lo que escribió (20/10/2026, revisión del Cerebro: «Facturo
 * 15.000 al mes» caía en «$0 – $3.000» por la palabra «000»). null si no es una pregunta de cifras o no dijo una cifra.
 */
export function tramoDe(texto: string, opciones: readonly string[]): number | null {
  const tramos = tramosDe(opciones);
  const v = cifraDe(texto);
  if (!tramos || v == null) return null;
  // El último tramo que empieza antes de la cifra: «0 – 3» y «4 – 10» dejan un hueco entre 3 y 4 que un «<» no cubre, y en
  // un borde compartido («$3.000» cierra uno y abre el otro) gana el de arriba.
  let i = -1;
  tramos.forEach(([desde], k) => { if (v >= desde) i = k; });
  return i >= 0 ? i : null;
}

/** El canal por sus palabras de siempre, sin lo negado: «vendo todo por WhatsApp» es «Conversaciones por chat». */
const PALABRAS_DE_CANAL: Array<[CanalId, RegExp]> = [
  // Sin «directo» suelto (revisión del Cerebro, 20/10 noche): «me compran directo en la web» es carrito, no chat. El «mensaje
  // directo» ya entra por «mensaje». Y «web», «página» o «sitio» SOLOS no deciden (tercera revisión, 21/10): «entran a la web
  // y me agendan» es llamada y «me escriben desde mi página», chat. La web es carrito sólo si ahí compran o pagan.
  ['conversaciones', /\b(?:whats?app|wsp|wpp|whats|dm|dms|chat|chats|mensajes?|instagram|insta|inbox|messenger|escriben|me escribe)\b/],
  ['llamadas', /\b(?:llam\w*|zoom|meet|videollamadas?|telefono|telefonica|call|agend\w*|reunion(?:es)?|calendly)\b/],
  ['carrito', /\b(?:carrito|checkout|tienda|ecommerce|e-commerce|hotmart|shopify|pagina de pago|link de pago|compran solos?)\b|\b(?:compran|pagan|comprar|pagar)\b[^.,;]{0,20}\b(?:web|pagina|sitio|online|link)\b/],
  ['webinar', /\b(?:webinars?|masterclass|clase en vivo|en vivo|live)\b/],
  ['presencial', /\b(?:presencial|local|taller|consultorio|en persona|oficina)\b/],
];
export function canalDeTexto(texto: string): CanalId | null {
  // Lo negado no cuenta: se borra la palabra que sigue a «no», «nunca» o «sin» (y la de después).
  const t = normal(texto).replace(/\b(?:no|nunca|sin|ni)\s+(?:\S+\s+)?\S+/g, ' ');
  const hay = PALABRAS_DE_CANAL.filter(([, re]) => re.test(t)).map(([c]) => c);
  return hay.length === 1 ? hay[0] : null;
}

export const NO_ENTENDI_OPCION = 'No te entendí: elige una de las opciones o dímelo con otras palabras.';
/** A una pantalla de antes de un despliegue (sin la pregunta que contesta): no puede seguir hasta recargar. */
export const RECARGA_LA_PAGINA = 'Esta pantalla quedó de antes de una actualización: recarga la página para seguir.';

// ── Lo escrito en una pregunta con opciones: se confirma con un toque ───────
// 21/10/2026, Cerebro, después de tres revisiones: cada ronda de reglas para leer frases («2 millones», «no cierran», «la
// web», «sí, es así») cerró los casos de la anterior y abrió otros, y cada error guardaba un dato malo en el diagnóstico
// con un «Lo tomé como» que no dejaba corregir. Ahora lo escrito se LEE, se muestra lo entendido y se guarda recién con el
// toque: un error de lectura cuesta un clic, no un dato malo. Como el nombre del negocio.

/** El botón que confirma lo entendido. Las otras opciones van al lado, para corregir con un toque. */
export const SI_ES_ESO = 'Sí, es eso';
/** Con una moneda que no es el dólar, la cifra no se ubica en un tramo (que son en dólares): se pregunta en dólares. */
export const EN_DOLARES = 'En pesos no lo puedo ubicar: ¿cuánto es más o menos en dólares? Elige una de las opciones.';
const entendi = (opcion: string): string => `Entendí: «${opcion}». ¿Es así?`;
const opcionesParaConfirmar = (opciones: readonly string[], i: number): string[] => [SI_ES_ESO, ...opciones.filter((_, k) => k !== i)];

/**
 * Una pregunta con opciones: contestada (con lo escrito, su «Entendí» y su sí, si lo escribió), esperando el toque que
 * confirma lo escrito, o abierta. Devuelve true si todavía no tiene respuesta.
 */
function preguntarConOpciones(lista: MensajeArranque[], preguntar: Preguntar, e: EstadoArranque, ids: { msg: string; pregunta: string },
  texto: string, opciones: readonly string[], elegida: number | undefined): boolean {
  if (elegida !== undefined) {
    const escrita = e.escritas?.[ids.pregunta];
    preguntar(lista, ids.msg, texto, escrita ?? opciones[elegida], [...opciones]);
    if (escrita) preguntar(lista, `${ids.msg}-ok`, entendi(opciones[elegida]), SI_ES_ESO);
    return false;
  }
  const pend = e.opcionPorConfirmar?.id === ids.pregunta && opciones[e.opcionPorConfirmar.opcion] !== undefined ? e.opcionPorConfirmar : undefined;
  preguntar(lista, ids.msg, texto, pend?.escrito, [...opciones]);
  if (pend) preguntar(lista, `${ids.msg}-ok`, entendi(opciones[pend.opcion]), undefined, opcionesParaConfirmar(opciones, pend.opcion));
  return true;
}

type Eleccion =
  | { tipo: 'guarda'; idx: number; escrito?: string }
  | { tipo: 'confirmar'; idx: number; escrito: string }
  | { tipo: 'otra-vez' }
  | { tipo: 'error'; error: string };

/**
 * Lo que vale de una respuesta a una pregunta con opciones. Una opción TOCADA (o escrita tal cual) se guarda. Lo ESCRITO con
 * otras palabras NUNCA se guarda en silencio: se lee con `leer` y pide el toque; se guarda recién con «Sí, es eso» (o un sí
 * escrito) o con otra opción tocada. Un no vuelve a la pregunta. Sin una lectura clara, un error y las opciones a la vista.
 * `leer` devuelve el índice de la opción, null (no se entendió) o un texto (el error que se le dice).
 */
function elegirOpcion(texto: string, opcion: string | undefined, opciones: readonly string[],
  pend: { opcion: number; escrito: string } | undefined, leer: (t: string) => number | string | null): Eleccion {
  if (pend && (opcion === SI_ES_ESO || (opcion === undefined && siONo(texto) === 'si'))) return { tipo: 'guarda', idx: pend.opcion, escrito: pend.escrito };
  const exacta = opcion !== undefined ? opciones.indexOf(opcion) : opciones.findIndex((o) => normal(o).trim() === normal(texto).trim());
  if (exacta >= 0) return { tipo: 'guarda', idx: exacta };
  if (opcion !== undefined) return { tipo: 'error', error: NO_ENTENDI_OPCION };
  if (pend && siONo(texto) === 'no') return { tipo: 'otra-vez' };
  const r = leer(texto);
  if (typeof r === 'string') return { tipo: 'error', error: r };
  if (r == null || r < 0 || r >= opciones.length) return { tipo: 'error', error: NO_ENTENDI_OPCION };
  return { tipo: 'confirmar', idx: r, escrito: texto };
}

/** Lo que cambia en el estado al GUARDAR una opción: se va lo pendiente, y lo escrito queda sólo si lo confirmó. */
function alGuardarOpcion(e: EstadoArranque, id: string, escrito: string | undefined): Partial<EstadoArranque> {
  const out: Partial<EstadoArranque> = e.opcionPorConfirmar ? { opcionPorConfirmar: undefined } : {};
  if (escrito) return { ...out, escritas: { ...e.escritas, [id]: escrito } };
  if (e.escritas?.[id] === undefined) return out;
  const resto = { ...e.escritas };
  delete resto[id];
  return { ...out, escritas: Object.keys(resto).length ? resto : undefined };
}

/** ¿La cifra es en una moneda que no es el dólar (pesos, «lucas», «palos»)? Los tramos son en dólares. */
export function monedaLocal(texto: string): boolean {
  const t = normal(texto);
  return !MONEDA_DOLAR.test(t) && MONEDA_LOCAL.test(t);
}

/** El primer nombre, para saludar y ofrecerlo: «Martín Koncke» → «Martín». */
export function primerNombre(nombre: string): string {
  return (nombre || '').trim().split(/\s+/)[0] ?? '';
}

const SALUDO = /^(?:hola+|holi|buenas(?:\s+(?:tardes|noches))?|buen(?:os)?\s+d[ií]as?|hey|qu[eé]\s+tal|saludos)\b[\s,!.¡]*/i;
const PRESENTA = /^(?:(?:yo\s+)?soy|me\s+llamo|mi\s+nombre\s+es|me\s+dicen|puedes\s+llamarme|ll[aá]mame|dime|aqu[ií]|ac[aá])\b[\s,:]*/i;
// Con «pero», «aunque», «me», «qué», «ok», «sí» y «no» (cuarta revisión, 21/10): «Me llamo Ana pero me dicen Anita» quedaba
// «Ana Pero Me», y «Hola, ¿qué tengo que poner?», «Qué Tengo».
const PALABRAS_NO_NOMBRE = /^(?:el|la|los|las|un|una|de|del|y|que|qu[eé]|con|en|mi|tu|su|por|para|due[ñn][oa]|y\s+tengo|pero|aunque|me|te|se|ok|okay|s[ií]|no|hola)$/i;

/** ¿El nombre leído de lo escrito puede ir al perfil? Sólo si el perfil no tiene uno de verdad (vacío o un email). */
export function pisaElNombreDelPerfil(actual: string | null | undefined): boolean {
  const a = (actual ?? '').trim();
  return !a || a.includes('@');
}

/** Mayúscula la primera letra de cada palabra que vino toda en minúscula («martín» → «Martín»). */
const conMayuscula = (s: string) => s.replace(/(^|\s)(\p{Ll})(\p{Ll}*)/gu, (_m, a: string, b: string, c: string) => `${a}${b.toUpperCase()}${c}`);

/**
 * EL NOMBRE, ENTENDIDO (17/10/2026). Martín: «le dije "Soy Martin" y me respondió "Un gusto, Soy. ¿Cómo se llama tu
 * negocio?", eso es básico». Se saca el saludo y la presentación («hola, soy», «me llamo», «mi nombre es»), se corta en
 * la primera coma o en lo que ya no es un nombre («Martín, el dueño de Acme»), y se queda con hasta tres palabras. Si
 * nombró su negocio («Martín de Acme», «soy Martín, de Acme», «tengo una agencia que se llama Acme»), vuelve como
 * SUGERENCIA para la pregunta siguiente. Sin nombre entendible («hola»), vuelve vacío y se vuelve a preguntar.
 */
export function extraerNombre(texto: string): { nombre: string; negocio: string | null } {
  let t = limpiarRespuesta(texto).replace(/[!¡¿?]+/g, ' ').replace(/\s+/g, ' ').trim();
  t = t.replace(SALUDO, '').trim();
  t = t.replace(PRESENTA, '').trim();
  // «me dicen el Tano»: el artículo de un apodo no es parte del corte.
  t = t.replace(/^(?:el|la)\s+(?=\p{Lu})/u, '');
  // El negocio, si lo dijo: «… se llama Acme» / «… de Acme» / «… dueño de Acme».
  let negocio: string | null = null;
  const seLlama = /(?:se\s+llama|llamad[oa]|mi\s+(?:negocio|empresa|marca|agencia)\s+es)\s+(.+)$/i.exec(t);
  if (seLlama) negocio = seLlama[1];
  const partes = t.split(/[,.;:]| y | - /);
  const cabeza = (partes[0] ?? '').trim();
  const palabras = cabeza.split(/\s+/).filter(Boolean);
  const nombre: string[] = [];
  for (let i = 0; i < palabras.length && nombre.length < 3; i++) {
    const p = palabras[i];
    if (PALABRAS_NO_NOMBRE.test(p) || /\d/.test(p)) {
      // «Martín de Acme»: lo que sigue al «de» es una sugerencia de negocio.
      if (/^(?:de|del)$/i.test(p) && !negocio && i + 1 < palabras.length) negocio = palabras.slice(i + 1).join(' ');
      break;
    }
    nombre.push(p);
  }
  if (!negocio) {
    const deAlgo = /\b(?:de|del)\s+(?:la\s+empresa\s+|la\s+marca\s+)?(.+)$/i.exec(partes.slice(1).join(' ').trim());
    if (deAlgo) negocio = deAlgo[1];
  }
  const limpio = (s: string | null) => cortar((s ?? '').replace(/^(?:la|el)\s+/i, '').replace(/[«»"']/g, '').trim(), 80);
  return { nombre: cortar(conMayuscula(nombre.join(' ')), 60), negocio: limpio(negocio) || null };
}

/**
 * Lo escrito como nombre SIN el corte por palabra, para cuando el corte lo deja vacío: «Su Lin», «Mi Young», «Una», «Tu
 * Anh» (sexta revisión, 21/10). Sin el saludo ni la presentación, hasta la primera coma y tres palabras. Vacío si no tiene
 * letras, si es un sí o un no («Ok», «Sí») o una pregunta («¿qué tengo que poner?»): eso se vuelve a preguntar.
 */
export function nombreSinCortar(texto: string): string {
  if (/[¿?]/.test(texto)) return '';
  const t = limpiarRespuesta(texto).replace(/[!¡]+/g, ' ').replace(/\s+/g, ' ').trim().replace(SALUDO, '').trim().replace(PRESENTA, '').trim();
  const cabeza = (t.split(/[,.;:]/)[0] ?? '').trim();
  if (!/\p{L}/u.test(cabeza) || siONo(cabeza) !== null) return '';
  return cortar(conMayuscula(cabeza.split(/\s+/).slice(0, 3).join(' ')), 60);
}

/**
 * El nombre del negocio, sin la frase alrededor: «Se llama Acme», «Mi negocio es Acme», «Es Acme» → «Acme». Desde el
 * 20/10/2026 (Florencia, ws21, «mi marca personal: Florencia Ayelen Carballo» quedó entero como nombre): «(Es) mi marca
 * personal: X» → «X», y «Rubro: Nombre» → lo de después de los dos puntos.
 */
export function extraerNegocio(texto: string): string {
  let t = limpiarRespuesta(texto).replace(/[!¡¿?]+/g, ' ').replace(/\s+/g, ' ').trim();
  t = t.replace(/^(?:es|son)\s+(?=(?:mi|nuestr[oa])\s)/i, '');
  t = t.replace(/^(?:mi|nuestr[oa])\s+(?:negocio|empresa|marca|agencia|emprendimiento|consultora|estudio|proyecto)(?:\s+personal)?\s*[:\-–—]\s*/i, '');
  t = t.replace(/^(?:mi\s+(?:negocio|empresa|marca|agencia|emprendimiento)\s+)?(?:se\s+llama|es|son|somos)\s+/i, '');
  t = t.replace(/^(?:la\s+empresa|la\s+marca|el\s+negocio|el\s+nombre)\s+(?:se\s+llama|es)\s+/i, '');
  // «Consultora: Florencia Carballo»: el nombre es lo de después de los dos puntos.
  const dos = t.match(/^[^:]{1,40}:\s*(\S.*)$/);
  if (dos) t = dos[1];
  return t.replace(/[«»"]/g, '').replace(/[.]+$/, '').trim();
}

/** La marca es la persona: «uso mi nombre», «mi propio nombre», «soy yo», «es mi marca personal», o no tiene nombre
 *  todavía («no tengo», «ninguno», «aún no», «no sé»). Se le propone su nombre (20/10/2026, Florencia: «ya no tiene más un
 *  nombre de empresa, tiene mi nombre»). */
const RE_MI_NOMBRE = new RegExp([
  String.raw`\b(?:uso|usa|es|lleva|con|tiene)\s+(?:mi|su)\s+(?:propio\s+)?nombre\b`,
  String.raw`^(?:es\s+)?(?:mi|su)\s+(?:propio\s+)?nombre$`, String.raw`^soy\s+yo$`,
  String.raw`^(?:es\s+)?mi\s+marca\s+personal$`,
  String.raw`\bno\s+(?:tiene|tengo)\b`, String.raw`\bsin\s+nombre\b`, String.raw`^(?:todav[ií]a|a[uú]n)\s+no\b`,
  String.raw`^ningun[oa]$`, String.raw`^no\s+s[eé]$`, String.raw`^no$`,
].join('|'), 'i');

export const NEGOCIO_CONFIRMAR = ['Sí, se llama así', 'No, lo escribo de nuevo'] as const;
/** El nombre de la PERSONA, cuando va a su perfil (vacío o un email): se confirma antes (quinta revisión, 21/10). */
export const NOMBRE_CONFIRMAR = ['Sí, así', 'No, lo escribo de nuevo'] as const;

// Las listas de cómo se dice que sí y que no viven en lib/onboarding-frases.ts (detectores, fuera del guard de voseo).
const enFila = (primeras: string[], siguientes: string[]) => {
  const alt = (xs: string[]) => [...xs].sort((a, b) => b.length - a.length).join('|');
  return new RegExp(`^(?:${alt(primeras)})(?: (?:${alt(siguientes)}))*$`, 'u');
};
// Lo que nombra lo preguntado («es mi negocio») vale como sí sólo DETRÁS de un sí: nunca como el primero de la fila.
const RE_SI = enFila(DICE_SI, [...DICE_SI, ...NOMBRA_LO_PREGUNTADO]);
const RE_NO = enFila(DICE_NO, TRAS_EL_NO);
const RE_NOMBRA = enFila(NOMBRA_LO_PREGUNTADO, NOMBRA_LO_PREGUNTADO);
// La duda es de la PALABRA SUELTA (o de varias de ellas en fila), no de la frase que empieza con ella (octava revisión,
// 21/10: «Claro, así se llama» o «Listo, es correcto» confirmaban en producción y dejaron de hacerlo).
const RE_PUEDE_SER_NOMBRE = enFila(PUEDE_SER_NOMBRE, PUEDE_SER_NOMBRE);
const RE_SI_PELADO = enFila(SI_DE_UNA_PALABRA, SI_DE_UNA_PALABRA);
const RE_NO_PELADO = enFila(NO_DE_UNA_PALABRA, NO_DE_UNA_PALABRA);
/** ¿Sólo nombra lo preguntado («Es mi negocio», «el nombre»)? No es un sí ni un nombre de negocio. */
const nombraLoPreguntado = (texto: string): boolean => RE_NOMBRA.test(normal((texto || '').trim()).replace(/[.!¡?¿,;:]+/g, ' ').replace(/\s+/g, ' ').trim());

/**
 * Un sí o un no ESCRITO a una pregunta de sí o no, con tilde o sin ella y con las formas de siempre («Sí», «Dale», «Ok»,
 * «Perfecto», «Está bien», «👍»). Sin la flag `u`, `\b` no corta después de «í» y «Sí» no era un sí (20/10/2026, revisión
 * del Cerebro: el negocio pasaba a llamarse «Sí»). Un sí con más palabras de acuerdo sigue siendo un sí («Sí, está bien»,
 * «Sí, por favor»: la revisión de la noche las encontró volviéndose el nombre propuesto). Con algo que no es acuerdo («sí,
 * pero se llama Acme») no es un sí ni un no: es otra respuesta. null = ni sí ni no.
 */
export function siONo(texto: string): 'si' | 'no' | null {
  const t = normal((texto || '').trim()).replace(/[.!¡?¿,;:]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  if (RE_SI.test(t)) return 'si';
  // «No está mal» es que SÍ (quinta revisión, 21/10: el PDF quedaba «faltan cosas»), y sin la coma es lo mismo que «No,
  // está mal». Ni sí ni no: se pregunta con el toque.
  if (/^no+ esta mal\b/.test(t)) return null;
  if (RE_NO.test(t)) return 'no';
  return null;
}

/** Un sí o un no PELADOS («Sí», «sip», «Ok», «👍», «Nop», «👎», también repetidos), sin DICE_SI: para el toque del PDF, donde
 *  lo que no es un botón ni un sí o un no de una palabra se anota (sexta revisión, 21/10: con la pregunta al revés, «Está
 *  perfecto» era «sí, falta algo»; séptima: «Ok» o «Nop» se anotaban sin fin). El color de piel del emoji no cuenta. */
export function siONoPelado(texto: string): 'si' | 'no' | null {
  const t = normal((texto || '').trim()).replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '').replace(/[.!¡?¿,;:]+/g, ' ').replace(/\s+/g, ' ').trim();
  return RE_SI_PELADO.test(t) ? 'si' : RE_NO_PELADO.test(t) ? 'no' : null;
}

/**
 * Un sí o un no escrito con un NOMBRE esperando (séptima revisión, 21/10). Como `siONo`, pero un sí hecho SÓLO de palabras
 * que también pueden ser un nombre («Simón», «Vale», «Listo», «Tal Cual», `PUEDE_SER_NOMBRE`) es 'duda': ni confirma el
 * pendiente ni lo reemplaza, se pregunta cuál de los dos es. Con un sí que no es nombre detrás («Claro, así se llama»,
 * «Listo, sí», «Genial, gracias»), o «Sí, …», «Ok», «Correcto», «Está bien», es un sí (octava revisión).
 */
export function siAlPendiente(texto: string): 'si' | 'no' | 'duda' | null {
  const sn = siONo(texto);
  if (sn !== 'si') return sn;
  const t = normal((texto || '').trim()).replace(/[.!¡?¿,;:]+/g, ' ').replace(/\s+/g, ' ').trim();
  return RE_PUEDE_SER_NOMBRE.test(t) ? 'duda' : 'si';
}

/**
 * El nombre del negocio que se entendió de lo que escribió, para CONFIRMARLO antes de escribirlo en el workspace (de ahí se
 * copia al CRM, al producto, al PDF y al grupo de WhatsApp). Lo escrito SIEMPRE se confirma (20/10/2026, revisión del
 * Cerebro): «Mi marca personal Florencia Carballo», «No tengo nombre» o «Hola» se escribían directo. `persona` es el nombre
 * de la persona, para «uso mi nombre» y «no tengo». null = no se entendió (sin letras, o «no tengo» sin su nombre).
 */
export function leerNegocio(texto: string, persona: string): string | null {
  const limpio = limpiarRespuesta(texto).replace(/[«»"]/g, '').replace(/[.]+$/, '').trim();
  if (!/\p{L}/u.test(limpio)) return null;
  if (usaSuNombre(limpio)) return persona.trim() || null;
  return extraerNegocio(limpio) || null;
}

/** ¿Dice que el negocio usa su nombre, o que no tiene uno («Es mi marca personal», «uso mi nombre», «no tengo»)? */
function usaSuNombre(texto: string): boolean {
  return RE_MI_NOMBRE.test(limpiarRespuesta(texto).replace(/[«»"]/g, '').replace(/[.]+$/, '').trim());
}

/** Una respuesta de texto libre: recortada y con tope. Vacía = no contestó. */
export function limpiarRespuesta(t: string): string {
  return cortar((t || '').replace(/\s+/g, ' ').trim(), TOPE_RESPUESTA);
}

// ── El CRM que se propone ───────────────────────────────────────────────────
/** El tipo recomendado para cada canal (el primero de su canal en TIPOS_CRM, que ya viene ordenado así). */
export function tipoRecomendado(canal: CanalId | null): TipoCrm {
  const porCanal = canal ? TIPOS_CRM.filter((t) => t.canal === canal) : [];
  return porCanal[0] ?? TIPOS_CRM.find((t) => t.id === 'llamada') ?? TIPOS_CRM[0];
}

/**
 * Los tipos que se ofrecen: el recomendado primero y los demás de su canal; con «ver todos», los doce. El
 * marco de Offer es de alto ticket vendido por llamada (lib/offer-autores.ts), así que sin canal manda
 * «Llamada de venta». Con el CRM a medida (`propuesta`, 20/10/2026), el recomendado es el que eligió MaKo.
 */
export function tiposOfrecidos(canal: CanalId | null, verTodos: boolean, propuesta?: PropuestaCrm | null): { tipos: TipoCrm[]; hayMas: boolean } {
  const rec = (propuesta && TIPOS_CRM.find((t) => t.id === propuesta.tipo)) || tipoRecomendado(canal);
  const base = verTodos ? [...TIPOS_CRM] : TIPOS_CRM.filter((t) => t.canal === rec.canal);
  const tipos = [rec, ...base.filter((t) => t.id !== rec.id)];
  return { tipos, hayMas: !verTodos && tipos.length < TIPOS_CRM.length };
}

// ── El diagnóstico en modo 'plan' ───────────────────────────────────────────
export type PreguntaFase = { tipo: 'canal' } | { tipo: 'pregunta'; idx: number };

/** La próxima pregunta del diagnóstico sin contestar; la de canal va justo antes de la de volumen. */
export function siguientePreguntaFase(e: EstadoArranque): PreguntaFase | null {
  const resp = e.faseResp ?? [];
  for (let i = 0; i < PREGUNTAS.length; i++) {
    if (PREGUNTAS[i].id === 'volumen' && !e.canal) return { tipo: 'canal' };
    if (!(Number.isInteger(resp[i]) && resp[i] >= 0)) return { tipo: 'pregunta', idx: i };
  }
  return null;
}

function textoPreguntaFase(p: PreguntaFase, canal: CanalId | undefined): { texto: string; opciones: string[] } {
  if (p.tipo === 'canal') return { texto: PREGUNTA_CANAL, opciones: CANALES.map((c) => c.label) };
  const q = PREGUNTAS[p.idx];
  if (q.id === 'volumen') {
    const v = VOLUMEN_POR_CANAL[canal ?? 'llamadas'];
    return { texto: v.texto, opciones: v.opciones };
  }
  return { texto: q.texto, opciones: q.opciones };
}

/** Las respuestas del diagnóstico completas (para guardarlo), o null si falta alguna. */
export function faseCompleta(e: EstadoArranque): number[] | null {
  if (siguientePreguntaFase(e) !== null) return null;
  return PREGUNTAS.map((_, i) => (e.faseResp ?? [])[i]);
}

const contestada = (n: number | undefined): n is number => Number.isInteger(n) && (n as number) >= 0;

/**
 * El diagnóstico como lo ve el arranque en modo 'oferta': lo que contestó ACÁ manda y, si no, lo que ya
 * contestó en la conversación de la oferta. Así las preguntas que Offer ya hizo no se repiten.
 */
export function conFaseDeOffer(e: EstadoArranque, h: Pick<HechosArranque, 'faseOffer'>): EstadoArranque {
  const o = h.faseOffer;
  if (!o) return e;
  const faseResp = PREGUNTAS.map((q, i) => (contestada(e.faseResp?.[i]) ? e.faseResp![i] : (o.respuestas[q.id] ?? -1)));
  const canal = e.canal ?? o.canal ?? undefined;
  return { ...e, faseResp, ...(canal ? { canal } : {}) };
}

// ── La etapa ────────────────────────────────────────────────────────────────
/**
 * En qué etapa está la conversación. Sale de lo guardado Y de lo medido: así, si la persona cerró la
 * pestaña a la mitad, al volver sigue exactamente donde quedó, sin una marca de «paso actual» que haya que
 * acordarse de mover.
 */
export function etapaDeArranque(e: EstadoArranque, h: HechosArranque): EtapaArranque {
  if (h.terminado) return 'listo';
  // Lo primero. El código por WhatsApp va con él: recién con el número probado MaKo lo suma a su grupo (auditoría del 14/10).
  if (h.conTelefono && e.telefono !== 'verificado' && e.telefono !== 'postergado') {
    return e.telefono === 'codigo' ? 'codigo' : 'telefono';
  }
  if (!e.nombre) return 'nombre';
  if (!e.negocio) return 'negocio';
  // Sin el objetivo a 90 días (18/10/2026, Martín: «eliminar "Y en los próximos 90 días, ¿qué quieres lograr?"»): del
  // negocio se pasa directo a lo que vende. Una conversación de antes que lo contestó lo guarda (va al brief), pero ya
  // no se dibuja ni se pregunta. Y «¿Cómo llegaste?» y «¿Qué resolver primero?» van AL FINAL.
  if (h.modo === 'plan') {
    if (!e.queHace) return 'que_hace';
    if (!h.faseGuardada) return 'fase';
  } else {
    // Primero lo que vende (la conversación de Offer, reducida) y después el diagnóstico de fase, que lo
    // pregunta el arranque con sus opciones: la conversación del onboarding ya no lo hace (17/10/2026). Lo que
    // la persona haya contestado en una conversación de antes (`faseOffer`) no se repite.
    if (!h.loQueVende) return 'oferta';
    // «¿Está correcto?» del PDF (18/10/2026). Una conversación que ya pasó la fase no vuelve atrás a preguntarlo.
    if (!e.pdfOk && !h.faseGuardada) return 'pdf';
    // Cómo cobra, leído del precio y confirmado con un toque (cuarta revisión, 21/10). Sin precio dicho, no se pregunta.
    if (h.cobroLeido && !e.cobro && !h.faseGuardada) return 'cobro';
    if (!h.faseGuardada) return 'fase';
    if (h.conCrm && !e.crmTipo) return 'crm';
  }
  if (!e.origen) return 'origen';
  if (h.modo === 'oferta' && !e.interes) return 'interes';
  // OBLIGATORIO (Martín, 3/11/2026): la app es el canal de los avisos, así que sin el teléfono activado no se entra. Lo último, cuando ya invirtió el tiempo: un permiso pedido de entrada se niega.
  if (h.conAvisos && !h.avisosListos && e.avisos !== 'sin-soporte') return 'avisos';
  return 'cierre';
}

// ── Lo que dice MaKo ────────────────────────────────────────────────────────
/**
 * Los mensajes del arranque, partidos en dos: los de ANTES de la conversación de la oferta y los de
 * DESPUÉS. En modo 'plan' no hay oferta, así que todo va en `antes`. Sólo se dibuja hasta la etapa actual:
 * su pregunta es el último mensaje, con sus opciones.
 */
export function mensajesDeArranque(e: EstadoArranque, h: HechosArranque): { antes: MensajeArranque[]; despues: MensajeArranque[] } {
  const etapa = etapaDeArranque(e, h);
  const antes: MensajeArranque[] = [];
  const despues: MensajeArranque[] = [];
  const nombre = e.nombre ? primerNombre(e.nombre) : '';

  const preguntar = (lista: MensajeArranque[], id: string, texto: string, respuesta: string | undefined, opciones?: string[], tarjeta?: TarjetaArranque) => {
    lista.push({ id: `arr-${id}`, de: 'mako', texto, ...(respuesta === undefined && opciones?.length ? { opciones } : {}), ...(tarjeta ? { tarjeta } : {}) });
    if (respuesta !== undefined) lista.push({ id: `arr-${id}-r`, de: 'yo', texto: respuesta });
  };

  // 1. Quién es. EXPLICA ANTES DE PREGUNTAR (18/10/2026, Martín: «empieza a preguntar de la nada… debería decir algo como
  // "necesito que me cuentes de tu negocio para poder configurar tu cuenta... no tardaremos más de 5 minutos"»).
  // SIN respuestas rápidas en el nombre NI en el negocio (18/10/2026, 14:00, Martín: «Sin respuestas rápidas en las
  // preguntas del nombre y del nombre del negocio»): ofrecían lo que quedaba de otra prueba («Ayelen», «Consultesis»).
  // El 20/10 volvió el nombre del alta como botón y el Cerebro lo retiró esa noche: el pedido de Martín es literal y
  // también lo cubre. tests/onboarding-preguntas.test.ts y tests/onboarding-nombre-negocio.test.ts.
  // El nombre que va al perfil se confirma antes (quinta revisión, 21/10): «¿Te llamo «Ana»?».
  if (h.conTelefono) {
    antes.push(...mensajesDelTelefono(e, etapa));
    if (etapa === 'telefono' || etapa === 'codigo') return { antes, despues };
  }
  const nombrePendiente = !e.nombre ? e.nombrePorConfirmar : undefined;
  preguntar(antes, 'nombre', h.conTelefono ? SALUDO_TRAS_TELEFONO : SALUDO_ARRANQUE, e.nombre ?? nombrePendiente?.escrito);
  if (nombrePendiente) preguntar(antes, 'nombre-ok', `¿Te llamo «${nombrePendiente.nombre}»?`, undefined, [...NOMBRE_CONFIRMAR]);
  if (etapa === 'nombre') return { antes, despues };
  // Lo escrito se CONFIRMA antes de escribirlo (20/10/2026, Florencia): la confirmación sí lleva «Sí» / «No».
  const pendiente = !e.negocio ? e.negocioPorConfirmar : undefined;
  preguntar(antes, 'negocio', `Un gusto, ${nombre}. ¿Cómo se llama tu negocio?`, e.negocio ?? pendiente?.escrito);
  if (pendiente) preguntar(antes, 'negocio-ok', `¿Tu negocio se llama «${pendiente.nombre}»?`, undefined, [...NEGOCIO_CONFIRMAR]);
  if (etapa === 'negocio') return { antes, despues };

  // Las dos del 17/10 (`ORIGENES`, `INTERESES`), AL FINAL desde el 18/10 (Martín): antes del cierre.
  const finales = (lista: MensajeArranque[]): boolean => {
    // Sin «Antes de terminar» ni «Última cosa» (18/10/2026, Martín: «no me puede estar diciendo "Antes de terminar"...
    // cada rato»): cada pregunta va directa y el cierre se dice una vez, al final (tests/onboarding-sin-anuncios.test.ts).
    preguntar(lista, 'origen', `¿Cómo llegaste a MaKo, ${nombre}?`, e.origen, [...ORIGENES]);
    if (etapa === 'origen') return true;
    if (h.modo === 'oferta') {
      const elegido = INTERESES.findIndex((i) => i.id === e.interes);
      preguntarConOpciones(lista, preguntar, e, { msg: 'interes', pregunta: 'interes' }, '¿Qué te gustaría que MaKo resuelva primero?',
        INTERESES.map((i) => i.label), elegido >= 0 ? elegido : undefined);
      if (etapa === 'interes') return true;
    }
    if (h.conAvisos) {
      lista.push({ id: 'arr-avisos', de: 'mako', texto: PREGUNTA_AVISOS, ...(etapa === 'avisos' ? { tarjeta: 'avisos' as const } : {}) });
      if (etapa === 'avisos') return true;
      lista.push({ id: 'arr-avisos-r', de: 'yo', texto: e.avisos === 'sin-soporte' && !h.avisosListos ? AVISOS_SIN_SOPORTE : AVISOS_LISTOS });
    }
    return false;
  };

  // 2a. Modo 'plan': a qué se dedica y el diagnóstico, con las preguntas originales.
  if (h.modo === 'plan') {
    preguntar(antes, 'que-hace', '¿A qué se dedica tu negocio?', e.queHace);
    if (etapa === 'que_hace') return { antes, despues };
    if (preguntarFase(antes, e, preguntar)) return { antes, despues };
    if (finales(antes)) return { antes, despues };
    return { antes, despues: cierre(etapa, nombre) };
  }

  // 2b. Modo 'oferta': el pase a la conversación de lo que vende (sus mensajes los dibuja Offer).
  antes.push({ id: 'arr-oferta', de: 'mako', texto: `Gracias, ${nombre}. Ahora cuéntame qué vendes en ${e.negocio}: lo dejo ordenado para trabajar con eso.` });
  if (etapa === 'oferta') return { antes, despues };

  // 2c. Lo que vende, ordenado en un PDF (la tarjeta lleva el link).
  // CORTO Y CON CONFIRMACIÓN (18/10/2026, Martín: «el mensaje anterior al PDF es larguísimo... Debería ser algo como
  // "Perfecto: ya tengo claro qué vendes. Te armé un PDF con tu oferta, ¿está correcto?"»). Si dice que no, se anota para
  // trabajarlo dentro de la app y se sigue: el onboarding no se traba en la oferta.
  // Lo que ESCRIBIÓ se dibuja tal cual (cuarta revisión, 21/10: «Todo perfecto salvo el precio» se dibujaba «Sí, está
  // correcto» y la corrección se perdía).
  // Y lo que no es un sí ni un no se confirma con un toque (quinta revisión, 21/10), que repite lo escrito (sexta). Cada
  // cosa escrita después queda dibujada y se vuelve a preguntar por ella.
  const partesPdf = e.pdfEscritas ?? [];
  preguntar(despues, 'pdf', PDF_PREGUNTA, partesPdf[0] ?? (e.pdfOk ? (e.pdfOk === 'si' ? PDF_OPCIONES[0] : PDF_OPCIONES[1]) : undefined), [...PDF_OPCIONES], 'pdf');
  partesPdf.forEach((p, i) => preguntar(despues, i ? `pdf-ok-${i}` : 'pdf-ok', pdfConfirmarPregunta(p),
    partesPdf[i + 1] ?? (e.pdfOk ? (e.pdfOk === 'si' ? PDF_BIEN : PDF_FALTA) : undefined), [PDF_BIEN, PDF_FALTA]));
  if (etapa === 'pdf') return { antes, despues };
  if (e.pdfOk === 'no') despues.push({ id: 'arr-pdf-no', de: 'mako', texto: PDF_NO });

  // 2c'. Cómo cobra, leído del precio y CONFIRMADO con un toque (cuarta revisión, 21/10): antes se guardaba en el producto
  // sin que nadie lo viera, y la lectura confundía «sin mensualidades» con una suscripción. Las opciones son TODAS las
  // lecturas posibles (`opcionesDeCobro`, novena revisión): la lectura va primera y arma el «Entendí», nunca saca una. Lo
  // que el producto no sabe cobrar (por año, por semana) se dice, sin recomendar nada.
  if (h.cobroLeido && (etapa === 'cobro' || e.cobro)) {
    const opciones = (h.cobroOpciones ?? opcionesDeCobro(null, h.cobroLeido)).map(etiquetaCobro);
    const pregunta = h.cobroLeido.periodo ? cobroSinPropuesta(h.cobroLeido.periodo)
      : h.cobroLeido.porDefecto ? COBRO_SIN_LECTURA : `Entendí que cobras así: «${etiquetaCobro(h.cobroLeido)}». ¿Lo cargo así?`;
    preguntar(despues, 'cobro', pregunta, e.cobro ? etiquetaCobro(e.cobro) : undefined, opciones);
    if (etapa === 'cobro') return { antes, despues };
  }

  // 2d. El diagnóstico de fase, con sus opciones: sólo lo que la persona no contestó ya en una conversación
  // de antes. Queda dibujado después, como parte de la historia.
  if (etapa === 'fase' || preguntoLaFase(e)) {
    const o = h.faseOffer;
    despues.push({ id: 'arr-fase', de: 'mako', texto: 'Ahora unas preguntas rápidas para saber en qué fase está tu negocio.' });
    if (preguntarFase(despues, conFaseDeOffer(e, h), preguntar, { canalYaDicho: !!o?.canal, yaContestada: (id) => o?.respuestas[id] != null })) {
      return { antes, despues };
    }
  }

  // 3. El CRM.
  if (h.conCrm) {
    const { tipos, hayMas } = tiposOfrecidos(h.canalNegocio, !!e.crmVerTodos, e.crmPropuesta);
    // Primero el que se le propone, con «Sí, es correcto»; «Ver otros tipos» abre la lista (18/10/2026, punto 10).
    const elegido = e.crmTipo ? (e.crmTipo === tipos[0].id && !e.crmVerTodos ? CRM_SI : TIPOS_CRM.find((t) => t.id === e.crmTipo)?.label) : undefined;
    const opciones = e.crmVerTodos ? tipos.map((t) => t.label) : [CRM_SI, ...(hayMas ? [VER_OTROS_TIPOS] : [])];
    preguntar(despues, 'crm', CRM_PREGUNTA, elegido, opciones, 'crm');
    if (etapa === 'crm') return { antes, despues };
  }

  if (finales(despues)) return { antes, despues };
  despues.push(...cierre(etapa, nombre));
  return { antes, despues };
}

type Preguntar = (lista: MensajeArranque[], id: string, texto: string, respuesta: string | undefined, opciones?: string[], tarjeta?: TarjetaArranque) => void;

/** ¿El arranque ya hizo alguna pregunta del diagnóstico? (En modo 'oferta' sólo las escribe él.) */
const preguntoLaFase = (e: EstadoArranque): boolean => !!e.canal || (e.faseResp ?? []).some(contestada);

/**
 * Las preguntas del diagnóstico, en orden: las contestadas con su respuesta y la que toca, con las preguntas
 * ORIGINALES. Devuelve true si quedó una abierta. En modo 'oferta' saltea lo que el dueño ya contestó en la
 * conversación de la oferta (`yaContestada`, `canalYaDicho`): esas no se dibujan ni se repiten.
 */
function preguntarFase(lista: MensajeArranque[], e: EstadoArranque, preguntar: Preguntar,
  o: { canalYaDicho?: boolean; yaContestada?: (id: string) => boolean } = {}): boolean {
  const resp = e.faseResp ?? [];
  for (let i = 0; i < PREGUNTAS.length; i++) {
    if (PREGUNTAS[i].id === 'volumen' && !o.canalYaDicho) {
      const c = textoPreguntaFase({ tipo: 'canal' }, e.canal);
      const elegido = e.canal ? CANALES.findIndex((x) => x.id === e.canal) : -1;
      if (preguntarConOpciones(lista, preguntar, e, { msg: 'fase-canal', pregunta: 'canal' }, c.texto, c.opciones, elegido >= 0 ? elegido : undefined)) return true;
    }
    if (o.yaContestada?.(PREGUNTAS[i].id)) continue;
    const q = textoPreguntaFase({ tipo: 'pregunta', idx: i }, e.canal);
    const elegida = contestada(resp[i]) && q.opciones[resp[i]] !== undefined ? resp[i] : undefined;
    if (preguntarConOpciones(lista, preguntar, e, { msg: `fase-${i}`, pregunta: PREGUNTAS[i].id }, q.texto, q.opciones, elegida)) return true;
  }
  return false;
}

/** El WhatsApp y su código: lo primero de la conversación (30/10/2026; hasta ese día, lo último antes del cierre). */
function mensajesDelTelefono(e: EstadoArranque, etapa: EtapaArranque): MensajeArranque[] {
  const out: MensajeArranque[] = [];
  out.push({ id: 'arr-telefono', de: 'mako', texto: PREGUNTA_TELEFONO, ...(etapa === 'telefono' ? { opciones: [AHORA_NO], tarjeta: 'telefono' as const } : {}) });
  if (e.telefono === 'postergado') out.push({ id: 'arr-telefono-r', de: 'yo', texto: AHORA_NO });
  else if (e.telefono === 'codigo' || e.telefono === 'verificado') out.push({ id: 'arr-telefono-r', de: 'yo', texto: e.telefonoNumero || 'Mi WhatsApp' });
  if (etapa === 'telefono') return out;
  if (e.telefono === 'codigo' || e.telefono === 'verificado') {
    // MaKo no le escribe primero a nadie (4/11/2026): la persona le manda el mensaje desde su WhatsApp, con el texto escrito.
    const texto = e.telefonoEntrante
      ? `Para confirmar tu WhatsApp, mándame un mensaje desde ${e.telefonoNumero ? `el ${e.telefonoNumero}` : 'ese número'}. Ya va escrito: sólo envíalo.`
      : `Te mandé un código de 6 dígitos por WhatsApp${e.telefonoNumero ? ` al ${e.telefonoNumero}` : ''}. Escríbelo aquí.`;
    out.push({ id: 'arr-codigo', de: 'mako', texto, ...(etapa === 'codigo' ? { opciones: [CAMBIAR_NUMERO, AHORA_NO], ...(e.telefonoEntrante ? { tarjeta: 'whatsapp' as const } : {}) } : {}) });
    if (etapa === 'codigo') return out;
    if (e.telefono === 'verificado') out.push({ id: 'arr-codigo-r', de: 'yo', texto: e.telefonoEntrante ? MENSAJE_MANDADO : CODIGO_CARGADO });
  }
  return out;
}

/** El cierre (los dos modos). */
function cierre(etapa: EtapaArranque, nombre: string): MensajeArranque[] {
  const out: MensajeArranque[] = [];
  if (etapa === 'listo') {
    out.push({ id: 'arr-listo', de: 'mako', texto: `¡Listo${nombre ? `, ${nombre}` : ''}! Tu MaKo ya está armado.`, tarjeta: 'listo' });
  }
  return out;
}

// ── Las respuestas ──────────────────────────────────────────────────────────
/**
 * Una respuesta. Con una opción viaja TAMBIÉN su texto (`opcionTexto`): el índice solo se lee contra la
 * pregunta ACTUAL del server, y una pestaña vieja que todavía muestra otra pregunta mandaría «la opción 0» de
 * otra cosa (medido en la revisión del 16/10: un clic en «Llamada de venta» del CRM se leía como «Ahora no»
 * del teléfono). Si el texto no coincide, la pregunta cambió y no se anota nada.
 */
/** `pregunta`: el texto del mensaje de MaKo que contesta (la pantalla lo manda con el toque y con lo escrito). */
export type Respuesta = { texto?: string; opcion?: number; opcionTexto?: string; pregunta?: string };
export type ResultadoRespuesta =
  /** `fase` al completar el diagnóstico, con el canal que vale (`faseCanal`: el de acá o el de la oferta). */
  | { ok: true; patch: Partial<EstadoArranque>; fase?: number[]; faseCanal?: CanalId }
  | { ok: false; error: string; cambio?: true };

/**
 * Cómo se lee una respuesta en la etapa actual: el `patch` que se guarda y, al completar el diagnóstico del
 * modo 'plan', las respuestas para `setDiagnosticoFase`. Las etapas de tarjeta (el CRM, el teléfono) y la
 * conversación de la oferta tienen su propia acción en la ruta: acá no entran.
 */
export function leerRespuesta(e: EstadoArranque, h: HechosArranque, r: Respuesta): ResultadoRespuesta {
  const etapa = etapaDeArranque(e, h);
  const { antes, despues } = mensajesDeArranque(e, h);
  const ultimo = [...antes, ...despues].filter((m) => m.de === 'mako').pop();
  const opcion = Number.isInteger(r.opcion) && ultimo?.opciones ? ultimo.opciones[r.opcion as number] : undefined;
  if (r.opcion !== undefined && r.opcionTexto !== undefined && opcion !== r.opcionTexto) {
    return { ok: false, error: 'La pregunta cambió.', cambio: true };
  }
  // La respuesta viaja con la PREGUNTA que contesta (cuarta revisión, 21/10): todas las confirmaciones tienen el mismo botón
  // («Sí, es eso», «Sí, se llama así»), así que el texto del botón no alcanza. Un toque o un «sí» de una pestaña vieja
  // confirmaba una lectura que esa pantalla nunca mostró. Con una confirmación abierta, sin la pregunta tampoco vale.
  // El cobro con una lectura recomendada también es una confirmación: un sí elige la primera (décima revisión, 21/10: sin «Sí,
  // es eso» la guarda ya no la veía).
  const confirma = !!ultimo?.opciones?.some((o) => o === SI_ES_ESO || o === NEGOCIO_CONFIRMAR[0] || o === NOMBRE_CONFIRMAR[0] || o === PDF_BIEN)
    || (etapa === 'cobro' && !!h.cobroLeido && recomienda(h.cobroLeido));
  if (r.pregunta !== undefined && r.pregunta !== ultimo?.texto) return { ok: false, error: 'La pregunta cambió.', cambio: true };
  // Sin la pregunta es una pantalla de ANTES del despliegue (quinta revisión, 21/10): «La pregunta cambió» la dejaba en un
  // bucle, porque su código nunca la manda. Se le dice que recargue.
  if (confirma && r.pregunta === undefined) return { ok: false, error: RECARGA_LA_PAGINA, cambio: true };
  const texto = limpiarRespuesta(opcion ?? r.texto ?? '');

  if (etapa === 'nombre') {
    // Con un nombre esperando, el botón o un sí/no escrito lo resuelven; otra cosa escrita es otro nombre.
    const pendiente = e.nombrePorConfirmar;
    let escrito = texto;
    if (pendiente) {
      const r = texto === NOMBRE_CONFIRMAR[0] ? 'si' : texto === NOMBRE_CONFIRMAR[1] ? 'no' : opcion === undefined ? siAlPendiente(texto) : null;
      const confirmado = { ok: true as const, patch: { nombre: pendiente.nombre, nombrePorConfirmar: undefined } };
      if (r === 'si') return confirmado;
      if (r === 'no') return { ok: true, patch: { nombrePorConfirmar: undefined } };
      // Como en el negocio (sexta revisión, 21/10): «Sí, soy Ana» o el mismo nombre otra vez confirman; «No, Pedro» o «no
      // soy Pedro» proponen el otro. Un «no» seguido de otro no («No, no») descarta.
      const conSiONo = /^(s[ií]+|no+)(?=$|[\s,.!¡?¿:;])[\s,.!¡?¿:;]*(.*)$/iu.exec(texto.trim());
      const esNo = !!conSiONo && /^n/i.test(conSiONo[1]);
      const resto = conSiONo ? conSiONo[2].replace(/^pero\s+/i, '') : texto;
      if (esNo && (!resto.trim() || siONo(resto) === 'no')) return { ok: true, patch: { nombrePorConfirmar: undefined } };
      // El mismo nombre otra vez confirma, también el que el corte deja vacío («Su Lin», séptima revisión).
      if (!esNo && normal(extraerNombre(resto).nombre || nombreSinCortar(resto)) === normal(pendiente.nombre)) return confirmado;
      const rResto = conSiONo && !esNo ? siAlPendiente(resto) : null;
      if (rResto === 'si') return confirmado;
      // Una palabra de acuerdo que también es un nombre: se pregunta cuál (séptima revisión, 21/10).
      if (r === 'duda' || rResto === 'duda') {
        const cual = r === 'duda' ? texto : resto;
        return { ok: false, error: `«${cual}», ¿es tu nombre? Escribe «Me llamo ${cual}». Si es «${pendiente.nombre}», toca «${NOMBRE_CONFIRMAR[0]}».` };
      }
      escrito = resto;
    }
    // Sin opciones: lo escrito se ENTIENDE («Soy Martín», «me llamo…», «Martín de Acme»). Lo que el corte deja vacío pero
    // tiene letras («Su Lin», «Mi Young», «Me llamo Una»: «su», «mi», «una» cortan) se propone con el toque, con cualquier
    // perfil (sexta revisión, 21/10: quedaba en «No te entendí» en bucle).
    const leido = extraerNombre(escrito);
    const sinCortar = leido.nombre ? '' : nombreSinCortar(escrito);
    const nombre = leido.nombre || sinCortar;
    if (!nombre) return { ok: false, error: pendiente ? `¿Te llamo «${pendiente.nombre}»? Dime sí o no, o escribe tu nombre.` : 'No te entendí el nombre. ¿Cómo te llamo?' };
    const sugerido = leido.negocio ? { negocioSugerido: leido.negocio } : {};
    // Si va al PERFIL (vacío o un email), se confirma con un toque (quinta revisión, 21/10: «Gracias», «Dale» o «Jaja»
    // quedaban como usuarios.nombre). No se corta por palabra: «Dale» también es un nombre. Con un nombre de verdad en el
    // perfil, lo leído sólo sirve para saludar y no hace falta el toque.
    if (sinCortar || pisaElNombreDelPerfil(h.nombreCuenta)) return { ok: true, patch: { nombrePorConfirmar: { escrito: texto, nombre }, ...sugerido } };
    return { ok: true, patch: { nombre, ...sugerido, ...(pendiente ? { nombrePorConfirmar: undefined } : {}) } };
  }
  if (etapa === 'negocio') {
    const pendiente = e.negocioPorConfirmar;
    // CON ALGO PENDIENTE, NADA SE ESCRIBE SIN UN SÍ EXPLÍCITO (20/10/2026, revisión del Cerebro): el botón o un sí escrito
    // lo guardan, un no vuelve a preguntar, y cualquier otra cosa es otro nombre que se vuelve a confirmar.
    const persona = [h.nombreCuenta, e.nombre].find((x) => !!x?.trim() && !x.includes('@')) ?? '';
    if (pendiente) {
      const r = opcion === NEGOCIO_CONFIRMAR[0] ? 'si' : opcion === NEGOCIO_CONFIRMAR[1] ? 'no' : opcion === undefined ? siAlPendiente(texto) : null;
      if (r === 'si') return { ok: true, patch: { negocio: pendiente.nombre, negocioPorConfirmar: undefined } };
      if (r === 'no') return { ok: true, patch: { negocioPorConfirmar: undefined } };
      // «Listo», «Claro», «Tal Cual» con otro nombre esperando: puede ser un sí o el nombre real. No se adivina (séptima
      // revisión, 21/10: guardaba el pendiente equivocado); el mismo nombre otra vez sí confirma.
      if (r === 'duda') {
        if (normal(leerNegocio(texto, persona) ?? '') === normal(pendiente.nombre)) return { ok: true, patch: { negocio: pendiente.nombre, negocioPorConfirmar: undefined } };
        return { ok: false, error: `«${texto}», ¿es el nombre de tu negocio? Escribe «Se llama ${texto}». Si es «${pendiente.nombre}», toca «${NEGOCIO_CONFIRMAR[0]}».` };
      }
    }
    // Sin pendiente no hay opciones (Martín, 18/10): todo nombre llega escrito y se confirma.
    let otro = texto;
    const conSiONo = pendiente ? /^(s[ií]+|no+)(?=$|[\s,.!¡?¿:;])[\s,.!¡?¿:;]*(.*)$/iu.exec(texto.trim()) : null;
    if (pendiente && conSiONo) {
      // «Sí, pero se llama Acme» / «No, es Acme» / «No, Acme»: lo de después es el nombre nuevo. Un «sí» seguido de algo
      // que no es acuerdo ni un nombre presentado NO se adivina (revisión del Cerebro, 20/10 noche: «Sí, está bien» se
      // volvía «¿Tu negocio se llama «está bien»?» y el nombre bueno se perdía): se pregunta de nuevo.
      const conPero = /^pero\s/i.test(conSiONo[2]);
      const resto = conSiONo[2].replace(/^pero\s+/i, '');
      const esSi = /^s/i.test(conSiONo[1]);
      // «Sí, no» o «sí… no» no son un sí (sexta revisión, 21/10: con la persona pendiente, el «no» se leía como «no tengo
      // nombre» y guardaba su nombre como el del negocio).
      if (esSi && siONo(resto) === 'no') return { ok: false, error: `¿Tu negocio se llama «${pendiente.nombre}»? Dime sí o no, o escribe el nombre.` };
      if (esSi && normal(leerNegocio(resto, persona) ?? '') === normal(pendiente.nombre)) {
        return { ok: true, patch: { negocio: pendiente.nombre, negocioPorConfirmar: undefined } };
      }
      if (esSi && !conPero && !/^(?:se llama|es|el nombre es|mejor|en realidad)\s/i.test(resto)) {
        return { ok: false, error: `¿Tu negocio se llama «${pendiente.nombre}»? Dime sí o no, o escribe el nombre.` };
      }
      otro = resto.replace(/^(?:mejor|en realidad)\s+/i, '');
    }
    const nombre = leerNegocio(otro, persona);
    if (!nombre) return { ok: false, error: '¿Cómo se llama tu negocio? Si usas tu nombre, escríbelo.' };
    // CON UN NOMBRE ESPERANDO, una palabra de acuerdo, o lo que sólo nombra lo preguntado («es mi negocio», «el nombre»), no
    // lo reemplaza: se pregunta de nuevo y el pendiente queda (tercera y cuarta revisión, 21/10: «Sí, es así» proponía «así»;
    // «No, está bien», «está bien»). Pero SIN pendiente no se corta nada (quinta revisión, 21/10: «Claro», «Listo», «Tal Cual»
    // o «Simón» son nombres de negocios reales, y quedaban en bucle): se PROPONE y el toque confirma. Tampoco se corta un
    // nombre PRESENTADO («se llama Tal Cual», «el nombre es Listo», entre comillas). Lo que dice que usa su nombre («Es mi
    // marca personal») propone el de la persona.
    if (pendiente && !usaSuNombre(otro)) {
      const presentado = /\b(?:se llama|el nombre es)\b|[«»"“”]/i.test(otro);
      const acuerdo = !presentado && !/^es\s/i.test(otro.trim()) && (siONo(otro) !== null || siONo(nombre) !== null);
      const soloNombra = !presentado && (nombraLoPreguntado(otro) || nombraLoPreguntado(nombre));
      if (acuerdo || soloNombra) return { ok: false, error: `¿Tu negocio se llama «${pendiente.nombre}»? Dime sí o no, o escribe el nombre.` };
    }
    return { ok: true, patch: { negocioPorConfirmar: { escrito: texto, nombre } } };
  }
  if (etapa === 'pdf') {
    const partes = e.pdfEscritas ?? [];
    if (partes.length) {
      // Esperando el toque: valen los dos botones y un sí o un no PELADOS, nunca DICE_SI (sexta revisión, 21/10: con la
      // pregunta al revés, «Está perfecto» o «👍» eran un «sí, falta algo»). Lo demás es otra cosa que anotar: se SUMA a
      // lo escrito (no lo pisa: «Sí, el precio» borraba «…el precio es 200») y se vuelve a preguntar.
      const r = texto === PDF_BIEN ? 'si' : texto === PDF_FALTA ? 'no' : opcion === undefined ? siONoPelado(texto) : null;
      if (r) return { ok: true, patch: { pdfOk: r } };
      if (!texto) return { ok: false, error: `Toca «${PDF_BIEN}» o «${PDF_FALTA}».` };
      // Pasado el tope, lo nuevo se suma a lo último, hasta que no entra (octava revisión, 21/10: se descartaba y MaKo decía
      // «Ya lo anoté»). Un error nunca dice que anotó lo que no anotó.
      if (partes.length >= PDF_TOPE_ESCRITAS) {
        const junta = `${partes[partes.length - 1]}${SUMA_PDF}${texto}`;
        if (Array.from(junta).length > TOPE_RESPUESTA) return { ok: false, error: `No entra más texto. Toca «${PDF_BIEN}» o «${PDF_FALTA}».` };
        return { ok: true, patch: { pdfEscritas: [...partes.slice(0, -1), junta] } };
      }
      return { ok: true, patch: { pdfEscritas: [...partes, texto] } };
    }
    // La opción tal cual, o un sí o un no sueltos (`siONo` lee «Sí» con tilde). Un no sin detalle queda anotado igual
    // (`PDF_SIN_DETALLE`, en el cierre).
    if (texto === PDF_OPCIONES[0] || texto === PDF_OPCIONES[1]) return { ok: true, patch: { pdfOk: texto === PDF_OPCIONES[0] ? 'si' : 'no' } };
    const sn = siONo(texto);
    if (sn) return { ok: true, patch: { pdfOk: sn } };
    // Lo demás NO se lee con reglas (quinta revisión, 21/10): «Está bien, sólo cambiaría el precio» se leía como un sí y la
    // corrección se perdía, y sumar «salvo», «pero», «aunque»… a una lista no terminaba nunca. Queda escrito y se pregunta
    // «Escribiste «…». ¿Lo tomo como que está todo bien?» con un toque. Con una corrección, MaKo dice «lo anoto», y lo
    // anota (onboarding.encuesta).
    if (!texto) return { ok: false, error: 'Dime si está correcto o si le falta algo.' };
    return { ok: true, patch: { pdfEscritas: [texto] } };
  }
  if (etapa === 'cobro') {
    // Se elige una de las opciones, que son todas las lecturas (novena revisión, 21/10). Lo escrito no se vuelve a leer con
    // reglas: la opción tal cual, o un sí, que elige la recomendada (la primera), si la hay.
    const leido = h.cobroLeido;
    if (!leido) return { ok: false, error: 'Ahora no estoy esperando eso.' };
    const opciones = h.cobroOpciones ?? opcionesDeCobro(null, leido);
    const elegida = opciones.find((c) => normal(etiquetaCobro(c)) === normal(texto))
      ?? (opcion === undefined && recomienda(leido) && siONo(texto) === 'si' ? opciones[0] : undefined);
    if (elegida) return { ok: true, patch: { cobro: { tipo: elegida.tipo, meses: elegida.meses } } };
    return { ok: false, error: 'Toca la opción que corresponde.' };
  }
  if (etapa === 'origen') {
    // Una opción o lo que escriba («por un amigo», «en un podcast»): las dos sirven para saber de dónde viene.
    if (!texto) return { ok: false, error: 'Elige una opción o escríbelo.' };
    return { ok: true, patch: { origen: texto } };
  }
  if (etapa === 'interes') {
    const labels = INTERESES.map((i) => i.label);
    const pend = e.opcionPorConfirmar?.id === 'interes' ? e.opcionPorConfirmar : undefined;
    const el = elegirOpcion(texto, opcion, labels, pend, (t) => {
      const id = interesDe(t);
      // Las cuatro no comparten palabras: una en común alcanza para proponerla (y se confirma igual).
      return id ? INTERESES.findIndex((i) => i.id === id) : opcionMasCercana(t, labels, 1);
    });
    if (el.tipo === 'error') return { ok: false, error: el.error };
    if (el.tipo === 'otra-vez') return { ok: true, patch: { opcionPorConfirmar: undefined } };
    if (el.tipo === 'confirmar') return { ok: true, patch: { opcionPorConfirmar: { id: 'interes', opcion: el.idx, escrito: el.escrito } } };
    return { ok: true, patch: { interes: INTERESES[el.idx].id, ...alGuardarOpcion(e, 'interes', el.escrito) } };
  }
  if (etapa === 'objetivo' || etapa === 'que_hace') {
    if (!texto) return { ok: false, error: 'Escríbeme tu respuesta.' };
    return { ok: true, patch: { [etapa === 'objetivo' ? 'objetivo' : 'queHace']: texto } };
  }
  if (etapa === 'fase') {
    // En modo 'oferta' cuenta lo que ya contestó en la conversación de la oferta (`conFaseDeOffer`).
    const ef = h.modo === 'oferta' ? conFaseDeOffer(e, h) : e;
    const p = siguientePreguntaFase(ef);
    if (!p) return { ok: false, error: 'El diagnóstico ya está completo.' };
    const { opciones } = textoPreguntaFase(p, ef.canal);
    // El diagnóstico se CALCULA por el índice de cada opción (lib/fase-diagnostico.ts). Lo escrito con otras palabras se
    // entiende (20/10/2026, Florencia: «no te deja escribir cuando te da las opciones») —el canal por sus palabras, una
    // cifra por su TRAMO, lo demás por la opción más parecida— pero NUNCA se guarda sin el toque que lo confirma
    // (`elegirOpcion`, 21/10/2026, Cerebro). Una cifra en pesos no se ubica: los tramos son en dólares.
    const id = p.tipo === 'canal' ? 'canal' : PREGUNTAS[p.idx].id;
    const pend = e.opcionPorConfirmar?.id === id ? e.opcionPorConfirmar : undefined;
    const tramos = p.tipo === 'pregunta' && !!tramosDe(opciones);
    const el = elegirOpcion(texto, opcion, opciones, pend, (t) => {
      if (p.tipo === 'canal') return CANALES.findIndex((c) => c.id === canalDeTexto(t));
      if (tramos) return monedaLocal(t) ? EN_DOLARES : tramoDe(t, opciones);
      return opcionMasCercana(t, opciones);
    });
    if (el.tipo === 'error') return { ok: false, error: el.error };
    if (el.tipo === 'otra-vez') return { ok: true, patch: { opcionPorConfirmar: undefined } };
    if (el.tipo === 'confirmar') return { ok: true, patch: { opcionPorConfirmar: { id, opcion: el.idx, escrito: el.escrito } } };
    const idx = el.idx;
    const escritas = alGuardarOpcion(e, id, el.escrito);
    if (p.tipo === 'canal') {
      const canal = CANALES[idx].id;
      const siguiente: EstadoArranque = { ...ef, canal };
      return { ok: true, patch: { canal, ...escritas }, ...(faseCompleta(siguiente) ? { fase: faseCompleta(siguiente)!, faseCanal: canal } : {}) };
    }
    const faseResp = [...(ef.faseResp ?? PREGUNTAS.map(() => -1))];
    while (faseResp.length < PREGUNTAS.length) faseResp.push(-1);
    faseResp[p.idx] = idx;
    const siguiente: EstadoArranque = { ...ef, faseResp };
    // Lo que se guarda en el estado es sólo lo que contestó ACÁ: lo de Offer se sigue leyendo de Offer, y
    // copiarlo haría que `preguntoLaFase` dibujara como del arranque preguntas que hizo la otra conversación.
    const propias = h.modo === 'oferta' ? faseResp.map((v, i) => (contestada(e.faseResp?.[i]) || i === p.idx ? v : -1)) : faseResp;
    const completa = faseCompleta(siguiente);
    return { ok: true, patch: { faseResp: propias, ...escritas }, ...(completa ? { fase: completa, ...(siguiente.canal ? { faseCanal: siguiente.canal } : {}) } : {}) };
  }
  if (etapa === 'codigo') {
    if (opcion === CAMBIAR_NUMERO) return { ok: true, patch: { telefono: undefined, telefonoNumero: undefined, telefonoEntrante: undefined } };
    if (opcion === AHORA_NO) return { ok: true, patch: { telefono: 'postergado' } };
    return { ok: false, error: e.telefonoEntrante ? 'Mándame el mensaje por WhatsApp: aquí no hace falta escribir nada.' : 'Escribe el código de 6 dígitos.' };
  }
  if (etapa === 'telefono') {
    if (normal(texto).trim() === normal(AHORA_NO)) return { ok: true, patch: { telefono: 'postergado' } };
    return { ok: false, error: PIDE_TELEFONO };
  }
  if (etapa === 'avisos') return { ok: false, error: PIDE_AVISOS };
  if (etapa === 'crm') {
    if (opcion === VER_OTROS_TIPOS) return { ok: true, patch: { crmVerTodos: true } };
    if (opcion === CRM_SI) return { ok: true, patch: { crmTipo: tiposOfrecidos(h.canalNegocio, false, e.crmPropuesta).tipos[0].id } };
    const t = TIPOS_CRM.find((x) => x.label === opcion);
    if (!t) return { ok: false, error: 'Elige un tipo de CRM.' };
    return { ok: true, patch: { crmTipo: t.id } };
  }
  return { ok: false, error: 'Ahora no estoy esperando eso.' };
}

// ── Lo que se cierra ────────────────────────────────────────────────────────
export type PasoDelArranque = 'negocio' | 'productos' | 'fase' | 'tabs' | 'integraciones' | 'plan';

/**
 * Qué pasos del onboarding cierra el chat al terminar, y CÓMO. El teléfono y Meta se POSTERGAN cuando no se
 * hicieron —nunca se marcan hechos—: sin destino, los reportes y los avisos no le llegan a nadie, y lo
 * postergado queda como recordatorio en /general (lib/onboarding-pendientes.ts).
 */
export function cierreDePasos(
  pasosCapa: readonly string[],
  hechos: { telefonoVerificado: boolean; metaConectado: boolean },
): Array<{ paso: PasoDelArranque; done?: boolean; postergar?: boolean }> {
  const out: Array<{ paso: PasoDelArranque; done?: boolean; postergar?: boolean }> = [];
  for (const p of pasosCapa) {
    if (p === 'negocio' || p === 'productos' || p === 'fase' || p === 'plan') out.push({ paso: p, done: true });
    else if (p === 'tabs') out.push(hechos.telefonoVerificado ? { paso: 'tabs', done: true } : { paso: 'tabs', postergar: true });
    else if (p === 'integraciones') out.push(hechos.metaConectado ? { paso: 'integraciones', done: true } : { paso: 'integraciones', postergar: true });
  }
  return out;
}

// ── El perfil del negocio que queda escrito ─────────────────────────────────
/**
 * Un texto que lleva la marca «[completar]» (la pone `filtrarCifras` donde una cifra que el dueño no dio
 * no se puede afirmar) NO se escribe en el brief ni en el catálogo: los prompts lo leerían como un dato. Es
 * la misma regla de `ofertaDesdePropuesta`. Vacío = no se escribe.
 */
export function sinMarca(v: string | null | undefined): string {
  const t = (v ?? '').trim();
  // «sin dato: …» tampoco es un dato (20/10/2026, Florencia, ws21): llegó a la promesa del producto y al brief.
  return /\[completar\]/i.test(t) || /^sin dato\b/i.test(t) ? '' : t;
}

/** Cómo cobra lo que vende: pago único o suscripción (con los meses, si los dijo). `periodo` sólo en lo LEÍDO: cobra por
 *  año o por semana, que el producto no sabe cobrar (sólo único o mensual), así que no se propone y se pregunta. */
export type Cobro = { tipo: 'unico' | 'suscripcion'; meses: number | null; periodo?: Periodo; porDefecto?: true };
/** ¿La lectura se puede recomendar? No si es algo que el producto no cobra (`periodo`) ni si no salió de ninguna señal
 *  (`porDefecto`): ahí las opciones van en orden fijo y un sí no elige (décima revisión, 21/10). */
export const recomienda = (c: Cobro): boolean => !c.periodo && !c.porDefecto;
/** La pregunta del cobro cuando el precio no dice cómo se cobra. */
export const COBRO_SIN_LECTURA = 'No me queda claro cómo cobras: ¿cuál uso?';
/** Haber negado las cuotas o lo mensual es una señal de pago único, dicho como se diga: «sin cuotas», «no se paga en
 *  cuotas», «sin opción de cuotas», «no manejo mensualidades», «cuotas no» (undécima revisión, 21/10). */
const NEGO_LO_PERIODICO = /\b(?:sin|nada de|no|ni)\s+(?:\S+\s+){0,3}?(?:cuotas|mensualidad(?:es)?|mensual(?:es)?|suscripcion|membresia)\b(?:\s+mensual(?:es)?\b)?|\b(?:cuotas|mensualidades)\s*:?\s*no\b/;
/** Un pago único dicho sin «pago único»: «un pago de USD 900», «una cuota», «cuota única», «pago total», «de por vida». */
const UNICO_DICHO = /\b(?:un|una|1)\s+(?:sol[oa]\s+|unic[oa]\s+)?(?:pago|cuota|vez)\b|\bpor unica vez\b|\b(?:cuota|inversion|precio|valor|costo|pago)\s+unic[oa]\b|\bpago total\b|\bde por vida\b|\bvitalici[oa]\b|\bpago (?:por adelantado|al inicio|anticipado)\b/;

/**
 * EL PRECIO EN DÍGITOS, una vez, antes de leerlo (décima revisión, 21/10/2026: con «Tres cuotas mensuales» faltaba la
 * opción de 3 meses, y la única suscripción que quedaba era la sin fin). Lo leen `cobroDelPrecio` y `opcionesDeCobro`. Sin
 * tildes, en minúscula, con los números en letras en cifras («tres» → «3», «treinta y seis» → «36», `conNumerosEnLetras`) y
 * todo lo que no es letra separado de las letras, para que «tres,», «(seis» o «-dos» también se lean (undécima revisión).
 */
export function precioEnDigitos(precio: string | null | undefined): string {
  return conNumerosEnLetras(normal((precio ?? '').trim()).replace(/([a-z])(?=[^a-z0-9\s])/g, '$1 ').replace(/([^a-z0-9\s])(?=[a-z])/g, '$1 '));
}

/** Una N con moneda delante o detrás es un monto, nunca la N de un cobro (undécima revisión: «USD 47 o 2 pagos» traía «de 47 meses»). */
const SIN_MONEDA_ANTES = '(?<!(?:usd|us|u\\$s|\\$|€|mxn|ars|eur|cop|clp|pen|s\\/|r\\$)\\s*)';
const SIN_MONEDA_DESPUES = '(?!\\s*(?:usd|dolares|pesos|mxn|ars|euros?|\\$|€)|[.,]\\d)';
const RE_N_CON_PALABRA = new RegExp(`${SIN_MONEDA_ANTES}\\b(\\d{1,2}(?:(?:\\s*,\\s*\\d{1,2})*\\s+(?:o|y|u)\\s+\\d{1,2})?)\\s*(cuotas|pagos|mensualidades|partes|meses)\\b`, 'g');
const RE_N_SUELTA = new RegExp(`\\b(?:cuotas|pagos|mensualidades)\\s*:\\s*(\\d{1,2})\\b${SIN_MONEDA_DESPUES}|\\b(\\d{1,2})\\s*x\\s*(?=usd|us\\b|\\$|€|mxn|ars|eur)|(?:mensual(?:es)?|por mes|al mes|\\/\\s?mes|cuotas?|pagos?|(?:usd|\\$|€|mxn|ars|eur)\\s*\\d[\\d.,]*)\\s*x\\s*(\\d{1,2})\\b${SIN_MONEDA_DESPUES}(?!\\s*(?:clases?|sesiones?|personas?|unidades?|horas?|semanas?|dias?|meses))`, 'g');

/**
 * LAS N DEL PRECIO, con UN solo extractor para la lectura y para las opciones (undécima revisión, 21/10: la lectura tenía su
 * parser y no veía «10 x USD 120» ni «Cuotas: tres», que las opciones sí). `deCuotas`: las de un cobro en cuotas («3
 * cuotas», «3, 6 o 12 pagos», «cuotas: 3», «10 x USD 120», «USD 120 mensuales x 10», «cuotas a 30, 60 y 90 días»).
 * `otras`: las que pueden ser la duración y no el cobro («6 meses», «3 partes», un plan trimestral): sólo suman opciones.
 */
function nsDelPrecio(t: string): { deCuotas: number[]; otras: number[] } {
  const deCuotas: number[] = [];
  const otras: number[] = [];
  // Una N de cuotas gana a la misma N de «meses» (undécima: «Programa de 4 meses: 4 cuotas» perdía la lectura).
  const sumar = (lista: number[], n: number) => {
    if (n < 2 || n > 60 || deCuotas.includes(n)) return;
    if (lista === deCuotas && otras.includes(n)) otras.splice(otras.indexOf(n), 1);
    if (!otras.includes(n)) lista.push(n);
  };
  for (const m of t.matchAll(RE_N_CON_PALABRA)) for (const n of m[1].match(/\d{1,2}/g) ?? []) sumar(m[2] === 'partes' || m[2] === 'meses' ? otras : deCuotas, Number(n));
  for (const m of t.matchAll(RE_N_SUELTA)) sumar(deCuotas, Number(m[1] ?? m[2] ?? m[3]));
  for (const m of t.matchAll(/\bcuotas\s+a\s+(\d{1,3}(?:\s*,\s*\d{1,3})*\s+(?:y|e)\s+\d{1,3})\s+dias\b/g)) sumar(deCuotas, (m[1].match(/\d+/g) ?? []).length);
  // Un plan trimestral o semestral dura 3 o 6 meses; pegado a un cobro («pago trimestral», «USD 300 trimestrales») es la
  // periodicidad, no una N.
  for (const m of t.matchAll(/(?<!(?:pagos?|cuotas?|cobros?|abonos?|membresias?|suscripcion(?:es)?|\d)\s*)\b(bimestral|trimestral|semestral)(?:es)?\b/g)) {
    sumar(otras, { bimestral: 2, trimestral: 3, semestral: 6 }[m[1] as 'bimestral'] ?? 0);
  }
  return { deCuotas, otras };
}
/** Cada cuánto se cobra, cuando no es por mes: el producto no lo sabe cobrar, así que no se propone (`cobroSinPropuesta`). */
export type Periodo = 'anual' | 'semanal' | 'quincenal' | 'bimestral' | 'trimestral' | 'semestral';
const CADA: Record<Periodo, string> = {
  anual: 'por año', semanal: 'por semana', quincenal: 'cada quince días', bimestral: 'cada dos meses', trimestral: 'cada tres meses', semestral: 'cada seis meses',
};
export const COBRO_UNICO = 'Pago único';
/** «(sin fin)»: una suscripción sin meses se cobra todos los meses (novena revisión, 21/10: se elegía creyendo que eran
 *  los meses de las cuotas). */
export const COBRO_MENSUAL = 'Suscripción mensual (sin fin)';
/** Cómo se le muestra un cobro para confirmarlo. */
export const etiquetaCobro = (c: Cobro): string => (c.tipo === 'unico' ? COBRO_UNICO : c.meses ? `Suscripción de ${c.meses} meses` : COBRO_MENSUAL);
const mismoCobro = (a: Cobro, b: Cobro): boolean => a.tipo === b.tipo && a.meses === b.meses;
/** La pregunta del cobro cuando cobra por año o por semana: sin propuesta, con las dos formas que el producto sabe cobrar. */
export const cobroSinPropuesta = (periodo: Periodo): string =>
  `Entendí que cobras ${CADA[periodo]}. Los productos se cobran en un pago o por mes: ¿cuál uso?`;

// Cada cuánto, dicho de un PAGO (octava revisión, 21/10: «con una llamada semanal» describe el servicio, no el cobro, y se
// leía como un cobro semanal): el adjetivo («cuotas semanales», «pago anual»), «por/cada/al + semana/mes/año» o «/año».
const PERIODICIDAD = '(?:(semanal|quincenal|mensual|bimestral|trimestral|semestral|anual)(?:es|mente)?\\b|(?:por|a la|al|cada|x)\\s+(semana|quincena|mes|ano)\\b|\\/\\s?(semana|mes|ano)\\b)';
const MONTO = '(?:(?:usd|us\\$|u\\$s|\\$|mxn|ars|eur)\\s*)?\\d[\\d.,]*(?:\\s*(?:usd|dolares|pesos|mxn|ars|euros?))?';
/** Los meses de un cobro: «3 meses de USD 300», «USD 300 por mes durante 3 meses», «USD 100 mensuales por 12 meses». */
const RE_MESES_DEL_COBRO = new RegExp(`\\b(\\d{1,2})\\s*meses\\s+de\\s+${MONTO}|(?:mensual(?:es)?|por mes|al mes|cada mes|mes a mes|\\/\\s?mes)\\s*,?\\s*(?:durante|por|x)\\s+(\\d{1,2})\\s*meses\\b`);
/** Con lo mensual ya dicho, los meses que dicen cuánto dura lo que se paga por mes: «Contrato de 12 meses», «por 3
 *  meses», «USD 100 por mes, 12 meses», o el texto que empieza con «3 meses». No los de prueba, garantía o mínimo. */
const NO_DE_COBRO = '(?!\\s+(?:gratis|de prueba|de regalo|bonus|sin cargo|de garantia))';
const RE_MESES_DEL_PLAN = new RegExp(`\\b(?:plan|programa|contrato|mentoria|acompanamiento|suscripcion|membresia|curso|proceso)\\s+(?:de\\s+)?(\\d{1,2})(?:\\s+o\\s+\\d{1,2})?\\s*meses\\b${NO_DE_COBRO}|\\b(?:durante|por)\\s+(\\d{1,2})\\s*meses\\b${NO_DE_COBRO}|(?:mensual(?:es)?|por mes|al mes|cada mes|\\/\\s?mes)\\s*,\\s*(\\d{1,2})\\s*meses\\b${NO_DE_COBRO}|^\\s*(\\d{1,2})\\s*meses\\b${NO_DE_COBRO}`);
/** «N cuotas (de USD X) semanales». */
const RE_CUOTAS_CON = new RegExp(`\\b(\\d{1,2})\\s*(?:cuotas|pagos|mensualidades)(?:\\s+de\\s+${MONTO})?\\s+${PERIODICIDAD}`);
/** Un monto o una palabra de cobro con su periodicidad pegada: «USD 50 por semana», «membresía anual», «pago semanal». */
// Un número pelado no es un monto (novena revisión): «1:1 semanal» o «3 x semana» no pegan una periodicidad al pago.
const MONTO_CON_MONEDA = '(?:(?:usd|us\\$|u\\$s|\\$|€|mxn|ars|eur)\\s*\\d[\\d.,]*|\\d[\\d.,]*\\s*(?:usd|dolares|pesos|mxn|ars|euros?|€))';
const RE_PEGADO = new RegExp(`(?:${MONTO_CON_MONEDA}|\\b(?:pagos?|cobros?|cuotas?|abonos?|suscripcion(?:es)?|membresias?|plan(?:es)?))\\s*${PERIODICIDAD}`, 'g');
const POR_NOMBRE: Record<string, Periodo | 'mensual'> = { semana: 'semanal', quincena: 'quincenal', mes: 'mensual', ano: 'anual' };
/** La periodicidad de un acierto de PERIODICIDAD, cuyos tres grupos empiezan en `desde`. */
const periodoDe = (m: RegExpMatchArray, desde: number): Periodo | 'mensual' =>
  (m[desde] as Periodo | 'mensual' | undefined) ?? POR_NOMBRE[m[desde + 1] ?? m[desde + 2] ?? ''];

/**
 * Cómo cobra, de lo que dijo del precio (20/10/2026, Florencia: «6 cuotas mensuales» quedaba como pago único). Las cuotas
 * o lo mensual son una suscripción, con los meses si los dijo («6 cuotas»); un «pago único» o «de contado» manda aunque
 * también ofrezca cuotas. Lo demás, único. El monto no se lee: es texto libre y lo pone el dueño en Productos.
 * ⚠️ Es una PROPUESTA: se confirma con un toque antes de llegar al producto (etapa 'cobro', cuarta revisión, 21/10).
 */
export function cobroDelPrecio(precio: string | null | undefined): Cobro {
  const crudo = precioEnDigitos(precio);
  if (!crudo.trim() || /pago unico|un (?:solo|unico) pago|en un (?:solo )?pago|de contado|al contado/.test(crudo)) return { tipo: 'unico', meses: null };
  if (/sin interes(?:es)?|\bmsi\b/.test(crudo) && !/membresia|suscripcion|cobro automatico|recurrente|debito automatico/.test(crudo)) return { tipo: 'unico', meses: null };
  // Lo negado no cuenta (cuarta revisión, 21/10: «sin mensualidades», «nada de cuotas», «no es mensual» salían suscripción),
  // y lo anual o semanal también es periódico («Membresía anual», «USD 99 por semana» salían pago único).
  const t = crudo.replace(new RegExp(NEGO_LO_PERIODICO.source, 'g'), ' ')
    .replace(/\b(?:sin|nada de|no es|no hay|no son|ni)\s+(?:(?:las?|los?|un|una)\s+)?\S+(?:\s+mensual(?:es)?)?/g, ' ');
  // Lo que no es por MES va con su `periodo` y la etapa 'cobro' pregunta sin proponer (quinta revisión, 21/10: lo anual se
  // proponía como «Suscripción mensual»). Sólo cuenta la periodicidad PEGADA al pago (octava). Primero, la de las cuotas:
  // «8 cuotas semanales» o «4 pagos trimestrales» no son meses (séptima y octava).
  const cuotasCon = RE_CUOTAS_CON.exec(t);
  const deLasCuotas = cuotasCon ? periodoDe(cuotasCon, 2) : null;
  if (deLasCuotas && deLasCuotas !== 'mensual') return { tipo: 'suscripcion', meses: null, periodo: deLasCuotas };
  // Después, lo semanal o quincenal pegado a un monto o a un cobro, que gana a las cuotas sin periodicidad («USD 50 por
  // semana, 12 pagos» son 12 pagos semanales).
  const pegados = [...t.matchAll(RE_PEGADO)].map((m) => periodoDe(m, 1)).filter((p): p is Periodo => !!p && p !== 'mensual');
  const corto = pegados.find((p) => p === 'semanal' || p === 'quincenal');
  if (corto) return { tipo: 'suscripcion', meses: null, periodo: corto };
  // Las cuotas de la TARJETA son una venta única (revisión del Cerebro, 20/10: «hasta 12 cuotas sin interés con tarjeta»
  // salía suscripción de 12 meses). Pero «con tarjeta» es sólo el MEDIO de pago: con «por mes», «membresía» o «cuotas
  // mensuales» sigue siendo una suscripción (revisión de la noche: «150 USD por mes con tarjeta» salía pago único).
  // «Sin interés» y «MSI» son financiación de la tarjeta salvo que diga que es una membresía o un cobro recurrente. Las
  // cuotas de la tarjeta se dicen también «pagos» o «mensualidades», y «con la tarjeta» (tercera revisión, 21/10: «3 pagos
  // con tarjeta» volvía a ser suscripción); «mensualidades» no es «mensual».
  const recurrente = /membresia|suscripcion|cobro automatico|recurrente|debito automatico/.test(t);
  const mensual = recurrente || /\bmensual(?:es|mente)?\b|por mes|al mes|cada mes|mes a mes|\/\s?mes/.test(t);
  const conTarjeta = /con (?:la |tu |mi |su )?tarjeta/.test(t) && /cuotas|pagos|mensualidades/.test(t);
  if ((/sin interes(?:es)?|\bmsi\b/.test(t) && !recurrente) || (conTarjeta && !mensual)) return { tipo: 'unico', meses: null };
  // Las cuotas, con el MISMO extractor que las opciones (undécima revisión): la lectura es la primera de la red.
  const cuotas = nsDelPrecio(t).deCuotas[0];
  if (cuotas) return { tipo: 'suscripcion', meses: cuotas };
  // Lo anual (o cada dos, tres o seis meses) pegado al pago, DESPUÉS de las cuotas (sexta revisión: un precio anual en «12
  // cuotas» es la suscripción de 12 meses).
  if (pegados[0]) return { tipo: 'suscripcion', meses: null, periodo: pegados[0] };
  // Sin ninguna señal de cobro, la lectura es POR DEFECTO, y una lectura por defecto no se propone (décima revisión, 21/10:
  // «Renovación anual de USD 1.500», «Membresía USD 29» o «Suscripción de 6 meses» proponían «Pago único», y un «Sí» lo
  // guardaba). Sí es una señal haber negado las cuotas o lo mensual («sin mensualidades», cuarta revisión).
  // Un pago único dicho de otra forma («un pago de USD 900», «cuota única», «de por vida») también es una señal (undécima).
  // Los meses se PROPONEN sólo pegados a un cobro: «3 meses de USD 300», «USD 300 por mes durante 3 meses» (undécima
  // revisión, 21/10: «dos meses gratis», «garantía de tres meses» o «mínimo tres meses» se proponían como el fin de la
  // suscripción). Cualquier otro «N meses» suma la opción, pero no se propone.
  const meses = RE_MESES_DEL_COBRO.exec(t);
  if (!/mensual|por mes|al mes|cada mes|mes a mes|\/\s?mes|cuotas|mensualidad/.test(t)) {
    if (meses) return { tipo: 'suscripcion', meses: Number(meses[1] ?? meses[2]) || null };
    return NEGO_LO_PERIODICO.test(crudo) || UNICO_DICHO.test(t) ? { tipo: 'unico', meses: null } : { tipo: 'unico', meses: null, porDefecto: true };
  }
  const plan = meses ? null : RE_MESES_DEL_PLAN.exec(t);
  return { tipo: 'suscripcion', meses: meses ? Number(meses[1] ?? meses[2]) || null : plan ? Number(plan[1] ?? plan[2] ?? plan[3] ?? plan[4]) || null : null };
}

/**
 * LAS OPCIONES DEL COBRO: todas las lecturas posibles, siempre (novena revisión, 21/10/2026). Cuatro vueltas de reglas sobre
 * la periodicidad movieron casos de lugar cada vez («1 a 1 semanal», «con una llamada semanal»); la red es el toque, y el
 * toque sólo sirve si la respuesta correcta está entre las opciones. Van «Pago único», «Suscripción mensual (sin fin)» y
 * una «Suscripción de N meses» por cada N que aparece junto a «cuotas», «pagos», «meses» o «mensualidades». La lectura
 * (`cobroDelPrecio`) sólo ORDENA: va primera, salvo que sea algo que el producto no cobra (`periodo`); nunca saca una opción.
 */
export function opcionesDeCobro(precio: string | null | undefined, leido: Cobro = cobroDelPrecio(precio)): Cobro[] {
  // Sobre el precio en dígitos (décima revisión, 21/10: «tres cuotas» no sumaba la de 3 meses). Las N de cuotas, pagos,
  // partes o mensualidades van primero y sin tope; las de «meses» (que pueden ser la duración, no el cobro) llenan hasta 6.
  const { deCuotas, otras } = nsDelPrecio(precioEnDigitos(precio));
  const ns = [...deCuotas, ...otras.slice(0, Math.max(0, 6 - deCuotas.length))];
  const todas: Cobro[] = [{ tipo: 'unico', meses: null }, { tipo: 'suscripcion', meses: null }, ...ns.map((n) => ({ tipo: 'suscripcion' as const, meses: n }))];
  if (!recomienda(leido)) return todas;
  const primera: Cobro = { tipo: leido.tipo, meses: leido.meses };
  return [primera, ...todas.filter((c) => !mismoCobro(c, primera))];
}

/**
 * Las respuestas del brief (mako.onboarding.answers) que deja la conversación. El brief es lo que leen los
 * generadores (Ads Writer, contenido, video) y el Perro Guardián: si el chat no lo escribe, escriben sin
 * conocer el negocio. Se FUNDE con lo que ya hay (`fundirBrief`): nunca pisa una respuesta que el negocio
 * ya tenía (la del Archivero o una edición en Second Brain).
 *
 * ⚠️ EL PRECIO NO VA: `oferta_ticket` es «Precio / ticket (USD)» y lo que dijo el dueño es texto libre
 * («$3k», «3 pagos de 997», «800 MXN/mes»). Pasarlo a número inventa un precio en dólares (medido en la
 * revisión del 16/10: «$3k» daba 3, «800 MXN/mes» daba 800 USD), y lib/ofertas.ts ya lo prohíbe: «EL PRECIO
 * DEL BRIEF NO SE PARSEA A NÚMERO». El precio queda en la oferta, como texto.
 */
export function briefDesdeArranque(input: {
  estado: EstadoArranque;
  piezas?: PiezasSabidas;
  propuesta?: PropuestaOferta | null;
  /** El texto de la opción que eligió en «¿Cuál es tu MAYOR cuello de botella hoy?». */
  cuello?: string | null;
}): Record<string, string> {
  const v = (k: keyof PiezasSabidas) => sinMarca(input.piezas?.[k]?.valor);
  const prop = input.propuesta ?? null;
  const out: Record<string, string> = {
    negocio_que_hace: sinMarca(input.estado.queHace) || sinMarca(prop?.frase) || v('frase') || v('resultado'),
    negocio_objetivo: sinMarca(input.estado.objetivo),
    negocio_freno: sinMarca(input.cuello) || v('problema'),
    oferta_nombre: sinMarca(prop?.nombre),
    oferta_promesa: v('resultado'),
    oferta_incluye: v('entregables'),
    oferta_garantia: v('garantia'),
    avatar_quien: v('cliente'),
    avatar_dolor: v('problema'),
    avatar_deseo: v('resultado'),
    avatar_objecion: v('objecion'),
  };
  for (const k of Object.keys(out)) if (!out[k].trim()) delete out[k];
  return out;
}

/** Funde respuestas nuevas sobre las que ya hay: sólo llena lo VACÍO. */
export function fundirBrief(previas: Record<string, string>, nuevas: Record<string, string>): Record<string, string> {
  const out = { ...previas };
  for (const [k, val] of Object.entries(nuevas)) if (!(out[k] ?? '').trim() && val.trim()) out[k] = val.trim();
  return out;
}
