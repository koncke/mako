// =============================================================================
// /m/mako — las decisiones de la PANTALLA del chat, puras (sin React, sin server)
// =============================================================================
// Lo que el chat del teléfono necesita decidir y que se prueba sin navegador
// (tests/m-mako-chat.test.ts):
//   · cómo se lee una respuesta de /api/m/mako (el 413 de Vercel es TEXTO PLANO);
//   · qué se puede reintentar y qué no (un turno que pudo haber corrido NO se repite:
//     costaría otra vez y podría dejar dos acciones pendientes iguales);
//   · cómo se arma el hilo con lo que el turno devolvió (`aviso` y `paraLaPersona` se
//     MUESTRAN y no se guardan: no vuelven al recargar, a propósito);
//   · qué dice la fila y el sheet de una propuesta después de confirmar o cancelar;
//   · el gesto del micrófono (deslizar a la izquierda cancela, hacia arriba bloquea);
//   · el tamaño al que se achica una foto antes de subirla;
//   · qué es un archivo elegido, qué sale al tocar Enviar en la vista previa, qué dice la
//     vista mientras no se puede enviar y cuánto tapa el teclado de iOS
//     (tests/m-mako-vista-previa.test.ts).
//
// Lo importan componentes 'use client': SÓLO TIPOS de lib/mako-turno-app-reglas.ts (ese
// módulo arrastra el registro de la API de MaKo, ~400 descripciones) y VALORES sólo de
// lib/mako-adjuntos.ts y lib/claves-en-el-chat.ts (una constante), que son puros y sin server.
// =============================================================================

import { sinDesde } from '@/lib/chat-desde';
import type {
  MensajeChat, PropuestaPantalla, RespuestaTurno, ResultadoTarjeta, TarjetaPendiente,
} from '@/lib/mako-turno-app-reglas';
import { ERROR_ADJUNTO, TOPE_ADJUNTOS, TOPE_TOTAL_BYTES, type TipoAdjunto } from '@/lib/mako-adjuntos';
import type { EstadoArchivero } from '@/lib/chat-mako-bloques';
import { ELIGE_TU_PREGUNTA, SALTEAR_PREGUNTA, type Abrir, type Bloque } from '@/lib/chat-bloques';
import { respuestasDeElegir } from '@/lib/editor-landing/bloques-web';
import { GRAMATICA } from '@/lib/mako-gramatica';
import { CLAVE_TAPADA } from '@/lib/claves-en-el-chat';
import type { OfferMensaje } from '@/lib/offer-marco';
import type { IdMensaje, MensajeWA } from '@/lib/centro-mensajes';

// ── El hilo ──────────────────────────────────────────────────────────────────

/**
 * Un archivo de un mensaje de la persona. Guardado (mig 0305): `ref`, que se pide a /api/mako/chat?adjunto=. Recién
 * elegido, mientras sale: `local`, la vista previa del navegador (un `blob:`), que no se guarda.
 */
export type ArchivoHilo = {
  nombre: string; tipo: TipoAdjunto; ref?: string; local?: string; archivero?: EstadoArchivero;
  /** Lo que la pantalla dice de ese archivo, debajo del nombre (Offer: «Ojo: …» de lo que leyó). Gana a la del Archivero. */
  nota?: string;
  /** No se abre desde el chat: Offer guarda lo que LEYÓ, no el archivo (22/10/2026, OF4). Sin esto, la ficha sin link decía
   *  «No pude abrir el archivo.» en cada documento de una conversación de Offer, también en el Ops Center. */
  sinAbrir?: boolean;
};

/** `en_curso`: confirmada, y es un trabajo largo que sigue por detrás (1.11); su avance va en el G6 de abajo. */
/** `incierta`: su trabajo largo se cortó y no se sabe si terminó (no es «falló»: no hay que pedirlo de nuevo sin mirar). */
export type EstadoPropuesta = 'pendiente' | 'aplicando' | 'en_curso' | 'hecho' | 'cancelada' | 'vencida' | 'resuelta' | 'fallo' | 'incierta';

export type ItemHilo =
  | {
      k: 'msg';
      id: string;
      role: 'user' | 'assistant';
      texto: string;
      at: string | null;
      /** una nota de voz de ESTA sesión de la pantalla: se escucha y debajo va lo que se entendió */
      voz?: { url: string; secs: number } | null;
      /** los nombres de lo que se adjuntó, en el teléfono mientras sale */
      adjuntos?: string[];
      /** los archivos del mensaje: guardados (vuelven al recargar) o recién elegidos */
      archivos?: ArchivoHilo[];
      /** enviando · error (no llegó: se puede reintentar) · incierto (no sé si llegó) */
      estado?: 'enviando' | 'error' | 'incierto';
      error?: string;
      /** una nota de voz que no se entendió: además de «Reintentar», se puede descartar (app/_chat/notas-en-el-acto.ts) */
      descartable?: boolean;
      /** desde dónde lo escribió la persona («CRM › Ana»: la estrella de una tab, OC6, lib/chat-desde.ts) */
      desde?: string;
      /** los links a la pantalla donde se hace lo pedido (sólo de MaKo, y sólo en esta sesión de la pantalla: el
       *  Second Brain los pide a /api/mako/pedidos; lib/chat-mako-reglas.ts → colgarIrA) */
      irA?: { titulo: string; link: string }[];
    }
  /** `abrir`: después de confirmarla, el «Abrir en <tab>» del link que devolvió la acción (1.8). */
  | { k: 'propuesta'; id: string; t: TarjetaPendiente; estado: EstadoPropuesta; nota?: string; abrir?: Abrir }
  | { k: 'pantalla'; id: string; p: PropuestaPantalla }
  /** `mako` = lo escribió el código para la persona (la agenda); `plataforma` = no pude.
   *  `conectar`: la integración que le falta al negocio (`RespuestaTurno.conectar`): un botón que abre su modal ahí mismo. */
  | { k: 'aviso'; id: string; texto: string; tono: 'mako' | 'plataforma'; conectar?: string;
      /** El texto para mandar de nuevo: el aviso de un mensaje que quedó sin respuesta (`conSinRespuesta`). */
      reintentar?: string }
  /** Lo que el chat DIBUJA (lib/chat-bloques.ts, app/_chat/BloqueHilo.tsx): lo creado con su miniatura, el antes y el
   *  después, un trabajo largo, una pregunta con opciones. Lo de MaKo, a la izquierda. */
  /** `respondida`: una pregunta (G1) que la persona ya contestó (su mensaje siguiente), al recargar. */
  /** `deTarjeta`: el G6 de un trabajo largo que lanzó esa tarjeta (1.11). */
  | { k: 'bloque'; id: string; b: Bloque; respondida?: string; deTarjeta?: number };

/** Lo que dice el botón de un aviso con `conectar`. La IA se nombra como la persona la piensa, no por el proveedor: el
 *  modal que abre es el de la que el negocio ya eligió (`iaParaConectar`, lib/mako-turno-app-reglas.ts). */
const SERVICIOS_DE_IA: ReadonlySet<string> = new Set(['anthropic', 'openai', 'gemini', 'groq']);
export const botonConectar = (servicio: string): string => (SERVICIOS_DE_IA.has(servicio) ? 'Conectar tu IA' : 'Conectar');

let secuencia = 0;
/** Un id local para la `key` de React (los mensajes guardados no traen id). */
export const idLocal = (pre: string): string => `${pre}-${Date.now().toString(36)}-${(++secuencia).toString(36)}`;

/** `conWs` le pega a la URL de una nota de voz el `?ws=` de la pestaña: un `<audio src>` no pasa por el `fetch` de la casa, y
 *  sin él el super admin que mira un cliente recibe 403 (/api/offer/audio). */
type ConWs = (url: string) => string;
const sinWs: ConWs = (u) => u;
const aMensaje = (m: MensajeChat, i: number, conWs: ConWs = sinWs): ItemHilo => ({
  k: 'msg', id: `m${i}-${m.created_at ?? ''}`, role: m.role, at: m.created_at ?? null,
  // Lo de la persona trae su marca de desde dónde (OC6): el chip, y el texto sin ella.
  ...(m.role === 'user' ? (({ desde, texto }) => ({ texto, ...(desde ? { desde } : {}) }))(sinDesde(m.content)) : { texto: m.content }),
  ...(m.adjuntos?.length ? { archivos: m.adjuntos } : {}),
  // La nota de voz (Offer y el onboarding, 22/10/2026): se escucha, y el texto es la transcripción (lib/mako-turno-app-reglas.ts).
  ...(m.audio?.url ? { voz: { url: conWs(m.audio.url), secs: m.audio.secs } } : {}),
});

/** Los archivos guardados del mensaje de la persona que devolvió un turno (para cambiar la vista previa por ellos). */
export const archivosDeRespuesta = (r: RespuestaTurno): ArchivoHilo[] => r.mensajes.find((m) => m.role === 'user')?.adjuntos ?? [];

/**
 * Lo que se lee en la burbuja de un mensaje CON sus archivos a la vista: sin el «(envió una imagen: x)» que el turno
 * guarda para la memoria del modelo (`placeholderDeAdjunto`), que al lado de la miniatura sobra.
 */
export const textoConArchivos = (texto: string): string =>
  // El cierre se busca hasta « — » o el final: un nombre con paréntesis («plano (v2).jpg») no corta antes.
  texto.replace(/^\(envió (?:una imagen|un PDF|\d+ archivos)(?:: .*?)?\)(?: — |$)/, '');

/**
 * NUNCA UNA KEY EN EL CHAT (pieza 1.6), la mitad de la PANTALLA. La burbuja de la persona se dibuja optimista, con lo que
 * escribió, y el turno la guarda TAPADA (lib/claves-en-el-chat.ts): sin esto la clave seguía a la vista, debajo del aviso
 * «Tapé tu clave: no quedó en el chat», hasta recargar. `itemsDeRespuesta` no la arregla (sólo SUMA lo de MaKo), así que
 * cada chat la mezcla en el `marcar(idU, …)` con que cierra el turno: `{ texto }` con lo guardado, o `{}` si no hay nada
 * que cambiar.
 *
 * ⚠️ Sólo cuando el servidor TAPÓ (lo guardado trae `[clave tapada]` y lo enviado no). «Si difieren» a secas no sirve: el
 * turno también recorta, parte los pegados y antepone el «(envió una imagen: x)» de la memoria del modelo, y la burbuja
 * no tiene que cambiar por eso. De ese placeholder se limpia lo guardado, igual que al dibujar (`textoConArchivos`).
 */
export function textoTapadoDeRespuesta(r: Pick<RespuestaTurno, 'mensajes'>, enviado: string): { texto?: string } {
  const guardado = (r.mensajes ?? []).find((m) => m.role === 'user')?.content;
  if (typeof guardado !== 'string' || !guardado.includes(CLAVE_TAPADA) || enviado.includes(CLAVE_TAPADA)) return {};
  return { texto: /^\(envió /.test(enviado) ? guardado : textoConArchivos(guardado) };
}

/** El link de un archivo guardado (sin el `?ws=`: en un `<img src>` lo pone quien lo dibuja, con `conWs`). */
export const rutaDeArchivo = (ref: string): string => `/api/mako/chat?adjunto=${encodeURIComponent(ref)}`;

const aPropuesta = (t: TarjetaPendiente): ItemHilo => ({ k: 'propuesta', id: `p${t.pendienteId}`, t, estado: 'pendiente' });

/** Un mensaje guardado y, debajo, lo que dibuja (lo creado de un «Hecho: …» vuelve con su miniatura al recargar). */
const conSusBloques = (m: MensajeChat, i: number, conWs: ConWs = sinWs): ItemHilo[] => {
  // El porqué de un turno sin respuesta (la marca `porque`): no es un turno de MaKo, es su aviso, con el botón de conectar.
  const porque = (m.bloques ?? []).find((b): b is Extract<Bloque, { t: 'porque' }> => b.t === 'porque');
  if (porque) return [{ k: 'aviso', id: `porque-${i}-${m.created_at ?? ''}`, texto: m.content, tono: 'mako', ...(porque.conectar ? { conectar: porque.conectar } : {}) }];
  // El «En curso: …» de un trabajo largo que sigue: su G6 consulta y dice cómo termina; la burbuja quedaba diciendo «En
  // curso» al lado de un G6 terminado (la segunda revisión de la ola 1).
  const sigue = (m.bloques ?? []).some((b) => b.t === 'trabajo' && !!b.consulta && b.pasos.some((p) => p.estado === 'en_curso'));
  return [
    ...(sigue ? [] : [aMensaje(m, i, conWs)]), ...(m.bloques ?? []).map((b, j): ItemHilo => ({ k: 'bloque', id: `b${i}-${j}-${m.created_at ?? ''}`, b })),
  ];
};

/** El hilo de una sesión recién abierta: los mensajes guardados y, al final, lo que espera (las tarjetas y, desde la
 *  1.10, las propuestas de pantalla pendientes de este chat, con su formulario). */
/**
 * UN MENSAJE SIN RESPUESTA NO QUEDA MUDO (22/10/2026, el cliente roto del ws1). El «Cerebro» de Mauricio tenía dos mensajes
 * suyos del 18/10 sin nada debajo: el turno falló (ese día, «anthropic vetado» y nada más) y lo que dice el fallo es un aviso
 * de la pantalla que NO se guarda, así que al recargar el hilo terminaba en su pregunta, como si MaKo no la hubiera leído. Si
 * lo último es un mensaje de la persona y ya pasó el techo del turno (`TECHO_TURNO_MS`: la ruta corre hasta 420 s), se dice
 * que no se contestó, con «Reintentar». Antes de eso no: el turno puede seguir corriendo (otra pestaña, el teléfono).
 */
export const SIN_RESPUESTA = 'No te pude contestar esto.';
export const TECHO_TURNO_MS = 7 * 60_000;
export function conSinRespuesta(items: readonly ItemHilo[], ahora: number): ItemHilo[] {
  const ult = items[items.length - 1];
  if (!ult || ult.k !== 'msg' || ult.role !== 'user' || ult.estado || !ult.at) return [...items];
  const t = Date.parse(ult.at);
  if (!Number.isFinite(t) || ahora - t < TECHO_TURNO_MS) return [...items];
  return [...items, { k: 'aviso', id: `sin-respuesta-${ult.id}`, texto: SIN_RESPUESTA, tono: 'plataforma', reintentar: ult.texto }];
}

export function itemsDeSesion(mensajes: readonly MensajeChat[], propuestas: readonly TarjetaPendiente[], pantallas: readonly PropuestaPantalla[] = [], conWs: ConWs = sinWs): ItemHilo[] {
  return conRespuestas([
    ...mensajes.flatMap((m, i) => conSusBloques(m, i, conWs)), ...propuestas.map(aPropuesta),
    ...pantallas.map((p): ItemHilo => ({ k: 'pantalla', id: `s-${p.escritorio}`, p })),
  ]);
}

// ── Una conversación de Offer en el Ops Center (21/10/2026) ─────────────────────────────────────────────────────────
// Martín: «las personas deberían poder continuar lo que quieran siempre desde el Ops Center». Una conversación de Offer se
// LEE y se SIGUE en el Ops Center con el motor de Offer (/api/offer: 'abrir' y 'turno', app/second-brain/motor-offer.ts),
// dibujada con el MISMO hilo: lo del dueño a la derecha (su nota de voz como audio, con la transcripción debajo), lo de
// MaKo a la izquierda y sus opciones como una pregunta que se toca (G1 «rápida»: sin «Elige tú» ni «Saltear»). Como en la
// tab (app/offer/ChatOffer.tsx), las opciones son sólo las del ÚLTIMO mensaje: las de antes ya no se contestan.

/** El hilo de una conversación de Offer. `conWs` le pega a una URL de audio el `?ws=` de la pestaña (un `<audio src>` no
 *  pasa por el `fetch` de la casa: lib/offer-marco.ts → `audio`). `notaDe`: lo que la pantalla dice de cada documento leído
 *  (la tab: `notaDelAdjunto`, app/offer/ayudas.ts). */
export function itemsDeOffer(
  mensajes: readonly OfferMensaje[], conWs: (url: string) => string = (u) => u,
  notaDe?: (a: NonNullable<OfferMensaje['adjuntos']>[number]) => string,
): ItemHilo[] {
  const ultimo = mensajes.length - 1;
  return conRespuestas(mensajes.flatMap((m, i): ItemHilo[] => {
    if (m.de === 'yo') {
      return [{
        k: 'msg', id: `of-${m.id}`, role: 'user', texto: m.texto, at: m.at || null,
        ...(m.audio?.url ? { voz: { url: conWs(m.audio.url), secs: m.audio.secs } } : {}),
        ...(m.adjuntos?.length ? {
          archivos: m.adjuntos.map((a): ArchivoHilo => {
            const nota = notaDe?.(a);
            return { nombre: a.nombre, tipo: 'document', sinAbrir: true, ...(nota ? { nota } : {}) };
          }),
        } : {}),
      }];
    }
    const out: ItemHilo[] = [{ k: 'msg', id: `of-${m.id}`, role: 'assistant', texto: m.texto, at: m.at || null }];
    const op = i === ultimo ? opcionesDeOffer(mensajes) : null;
    return op ? [...out, op] : out;
  }));
}

/** Las opciones VIGENTES de una conversación de Offer: las del último mensaje, si es de MaKo y trae (las de antes ya no se
 *  contestan). Van al final del hilo, sea el de Offer o el de la proyección con el arranque (lib/chat-mako-indice.ts →
 *  hiloDeOffer, que no las trae). */
export function opcionesDeOffer(mensajes: readonly OfferMensaje[]): ItemHilo | null {
  const m = mensajes[mensajes.length - 1];
  if (!m || m.de !== 'mako' || !m.opciones?.length) return null;
  return { k: 'bloque', id: `of-${m.id}-op`, b: { t: 'pregunta', pregunta: '', opciones: m.opciones.map((titulo) => ({ titulo })), varias: !!m.varias, rapida: true } };
}

/** Lo que se manda a Offer al tocar una opción: si es la de una pregunta del DIAGNÓSTICO (el último mensaje de MaKo), su
 *  índice (`respuesta`), como la tab (app/offer/OfferApp.tsx); si no, el texto y nada más. */
export function respuestaDeOffer(mensajes: readonly OfferMensaje[], texto: string): { preguntaId: string; idx: number } | null {
  const ultimo = [...mensajes].reverse().find((m) => m.de === 'mako');
  if (!ultimo?.pregunta || !ultimo.opciones?.length) return null;
  const idx = ultimo.opciones.findIndex((o) => igual(o) === igual(texto));
  return idx >= 0 ? { preguntaId: ultimo.pregunta.id, idx } : null;
}

// ── Lo de WhatsApp en el chat con MaKo (21/10/2026, el del super admin: app/admin/operaciones/MensajeWA.tsx) ─────────────

type ItemMsg = Extract<ItemHilo, { k: 'msg' }>;
/** El id de un mensaje para lo de WhatsApp (lib/centro-mensajes.ts → IdMensaje: `t:` y hasta 64 letras, números o guiones). Sale
 *  de quién lo dijo y de su hora, que no cambian al recargar (el id de la fila sí: lleva su lugar en el hilo). Lo que todavía no
 *  tiene hora, de su id. */
export const idWA = (x: Pick<ItemMsg, 'id' | 'role' | 'at'>): IdMensaje =>
  `t:${x.at ? `${x.role === 'user' ? 'u' : 'm'}${x.at.replace(/\D/g, '')}` : x.id.replace(/[^\w-]/g, '-').slice(-60)}`;
/** El mensaje, para el menú del clic derecho, la cita y los fijados (sin el contexto de WhatsApp, no hace nada). */
export const mensajeWADe = (x: ItemMsg, nombre: string): MensajeWA => ({
  id: idWA(x), texto: x.texto, de: x.role === 'user' ? 'Tú' : nombre, propio: x.role === 'user',
  instante: x.at ? Date.parse(x.at) || 0 : 0, trabajo: null,
});

type ItemBloque = Extract<ItemHilo, { k: 'bloque' }>;
const esSelector = (x: ItemHilo): x is ItemBloque => x.k === 'bloque' && (x.b.t === 'pregunta' || x.b.t === 'elegir');
const esDeLaPersona = (x: ItemHilo): x is ItemMsg => x.k === 'msg' && x.role === 'user';
const igual = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** ¿`d` es lo que arma «Listo» en una pregunta de varias: algunos títulos, en el orden de las opciones, unidos con «, »?
 *  Se arma como el botón, sin partir por comas: un título puede tener una («Precios, planes»). */
function esVariasDe(d: string, titulos: readonly string[], desde = 0): boolean {
  for (let k = desde; k < titulos.length; k++) {
    const t = titulos[k];
    if (d === t || (d.startsWith(`${t}, `) && esVariasDe(d.slice(t.length + 2), titulos, k + 1))) return true;
  }
  return false;
}

/** ¿`dicho` es lo que manda un toque en ESTE selector? Una opción del G1 (o varias con «Listo»), sus «Elige tú» y
 *  «Saltear», o lo que manda el «elegir» del Web Generator («Diseño: Minimal», «Diseño: saltear»). `norma` dice cuánto
 *  se parece: `igual` (sin mayúsculas ni tildes) para lo del turno actual, `tal` (lo que manda el botón, TAL CUAL) para
 *  un selector de un turno anterior. */
function esRespuestaDe(b: Bloque, dicho: string, norma: (s: string) => string): boolean {
  const d = norma(dicho);
  if (b.t === 'elegir') return respuestasDeElegir(b).some((r) => norma(r) === d);
  if (b.t !== 'pregunta') return false;
  const titulos = b.opciones.map((o) => norma(o.titulo));
  return titulos.includes(d) || d === norma(ELIGE_TU_PREGUNTA) || d === norma(SALTEAR_PREGUNTA) || (!!b.varias && esVariasDe(d, titulos));
}
const tal = (s: string): string => s;

/**
 * Un selector (la pregunta G1, o el «elegir» G2 del Web Generator) seguido de un mensaje de la persona ya está
 * contestado: con eso (1.9). Lo usan también las pantallas al dibujar (revisión del 21/10/2026): contestar escribiendo
 * apaga las opciones en el acto, no al recargar.
 * ⚠️ UNA respuesta no cierra DOS selectores (revisión del 21/10/2026): MaKo guarda en el mismo mensaje lo que dibujan
 *    las lecturas y su pregunta (el G2 de diseños y el G1 del producto), y tocar «Mentoría» apagaba también los diseños
 *    con «Respondiste: Mentoría». Cada mensaje de la persona cierra los selectores abiertos de los que es (lo que manda un
 *    toque suyo); si es de uno del turno ACTUAL (los que vinieron después del mensaje anterior de la persona), sólo ése:
 *    un «Saltear» de la pregunta nueva no cierra las viejas. Si no es de ninguno, escribir contesta, como siempre, pero
 *    sólo si en el turno actual hay UNO abierto; con varios, quedan abiertos (abierto de más cuesta poco).
 *    Un selector de un turno anterior que quedó abierto sigue esperando, pero sólo un toque SUYO lo cierra, con el texto
 *    que manda el botón TAL CUAL: tocado más tarde se cierra él y no la pregunta nueva, y lo escrito turnos después no lo
 *    contesta, aunque se parezca a una opción suya («curso kairos» escrito a la pregunta de Pagos cerraba el «¿Para qué
 *    producto?» viejo). Revisiones del 21/10/2026: contarlo para «uno solo abierto» dejaba sin cerrar, escribiendo,
 *    todas las preguntas siguientes de la sesión.
 */
export function conRespuestas(xs: readonly ItemHilo[]): ItemHilo[] {
  const respondidas = new Map<number, string>();
  let abiertos: number[] = [];
  let delTurno: number[] = [];
  xs.forEach((x, i) => {
    if (esSelector(x)) { abiertos.push(i); delTurno.push(i); return; }
    if (!esDeLaPersona(x)) return;
    const suyos = abiertos.filter((k) => esRespuestaDe((xs[k] as ItemBloque).b, x.texto, delTurno.includes(k) ? igual : tal));
    const suyosDelTurno = suyos.filter((k) => delTurno.includes(k));
    const abiertosDelTurno = delTurno.filter((k) => abiertos.includes(k));
    const cierra = suyosDelTurno.length ? suyosDelTurno : suyos.length ? suyos : abiertosDelTurno.length === 1 ? abiertosDelTurno : [];
    for (const k of cierra) respondidas.set(k, x.texto);
    abiertos = abiertos.filter((k) => !cierra.includes(k));
    delTurno = [];
  });
  return xs.map((x, i) => (esSelector(x) && respondidas.has(i) ? { ...x, respondida: respondidas.get(i)! } : x));
}

/**
 * Lo que se SUMA al hilo después de tocar una tarjeta: lo que el código escribió para la persona y lo que dibuja el
 * resultado (`bloques`, la 1.7), sin recargar. Lo usan TODAS las pantallas del chat con MaKo: una no puede mostrar la
 * miniatura y otra no.
 */
export function itemsTrasTarjeta(r: ResultadoTarjeta, pendienteId?: number): ItemHilo[] {
  const avisos = (r.paraLaPersona ?? []).filter((t) => t.trim()).map((t): ItemHilo => ({ k: 'aviso', id: idLocal('v'), texto: t, tono: 'mako' }));
  // El G6 de un trabajo largo sabe de qué tarjeta es: al terminar, ella deja de decir «En curso» (`trasTrabajo`).
  const deTarjeta = r.ok && r.enCurso && pendienteId != null ? { deTarjeta: pendienteId } : {};
  const bloques = r.ok ? (r.bloques ?? []).map((b): ItemHilo => ({ k: 'bloque', id: idLocal('b'), b, ...(b.t === 'trabajo' ? deTarjeta : {}) })) : [];
  return [...avisos, ...bloques];
}

/** La tarjeta cuyo trabajo largo terminó mientras se miraba (1.11; revisión del 21/10/2026: quedaba «En curso»). */
export function trasTrabajo(xs: readonly ItemHilo[], pendienteId: number, ok: boolean | null): ItemHilo[] {
  return conTarjeta(xs, pendienteId, ok == null ? 'incierta' : ok ? 'hecho' : 'fallo');
}

/**
 * El hilo después de tocar una tarjeta: la tarjeta con su estado nuevo (y su «Abrir», 1.8) y, al final, lo que vuelve
 * (`itemsTrasTarjeta`). Sin `r` (mientras corre, o si no llegó la respuesta), sólo el estado. Lo usan TODAS las
 * pantallas del chat con MaKo: antes cada una lo armaba a mano.
 */
export function conTarjeta(xs: readonly ItemHilo[], pendienteId: number, estado: EstadoPropuesta, nota?: string, r?: ResultadoTarjeta): ItemHilo[] {
  const abrir = r?.ok ? r.abrir : undefined;
  const sig = xs.map((x) => (x.k === 'propuesta' && x.t.pendienteId === pendienteId ? { ...x, estado, nota, ...(abrir ? { abrir } : {}) } : x));
  return r ? [...sig, ...itemsTrasTarjeta(r, pendienteId)] : sig;
}

/**
 * Lo que se SUMA al hilo con la respuesta de un turno. El mensaje de la persona ya está
 * dibujado (optimista), así que de `mensajes` se toma sólo lo de MaKo. El cartel de la
 * plataforma y lo que armó el código van como avisos: se ven, no son un turno de MaKo.
 */
export function itemsDeRespuesta(r: RespuestaTurno, yaVistas: ReadonlySet<number> = new Set()): ItemHilo[] {
  const out: ItemHilo[] = [];
  r.mensajes.forEach((m) => {
    // Con lo que dibuja (una pregunta con opciones, 1.9), debajo del mensaje.
    if (m.role === 'assistant' && m.content.trim()) {
      out.push({ ...aMensaje(m, 0), id: idLocal('a') });
      for (const b of m.bloques ?? []) out.push({ k: 'bloque', id: idLocal('b'), b });
    }
  });
  for (const t of r.paraLaPersona) if (t.trim()) out.push({ k: 'aviso', id: idLocal('v'), texto: t, tono: 'mako' });
  // Al negocio le falta una integración (su IA): no es un cartel de «no pude», lo dice MaKo y trae el botón para conectarla.
  if (r.aviso) out.push(r.conectar
    ? { k: 'aviso', id: idLocal('v'), texto: r.aviso, tono: 'mako', conectar: r.conectar }
    : { k: 'aviso', id: idLocal('v'), texto: r.aviso, tono: 'plataforma' });
  for (const t of r.propuestas) if (!yaVistas.has(t.pendienteId)) out.push(aPropuesta(t));
  for (const p of r.pantallas) out.push({ k: 'pantalla', id: idLocal('s'), p });
  return out;
}

// ── La respuesta HTTP ────────────────────────────────────────────────────────

export type Leido<T> =
  | { ok: true; datos: T }
  /** `reintentable`: el server lo rechazó ANTES de correr el turno (no se guardó nada); `status`, el de ese 4xx */
  | { ok: false; error: string; reintentable: boolean; status?: number };

export const ERROR_INCIERTO = 'No sé si llegó. Recarga el chat antes de reintentar.';

/**
 * Lee lo que contestó /api/m/mako. El cuerpo se pasa como TEXTO: el 413 de Vercel (más de
 * ~4,5 MB) llega en texto plano, y un `res.json()` directo tiraría con un error que no dice
 * qué pasó.
 *
 * ⚠️ Sólo un 4xx con su `{ ok:false, error }` es reintentable: el route lo devuelve antes de
 * guardar nada. Un 5xx, un cuerpo que no es JSON, la red caída (status 0) o el corte por
 * tiempo pueden haber corrido el turno entero —con sus acciones pendientes—, así que no se
 * reintenta a ciegas: se recarga el chat y se mira.
 */
export function leerRespuesta<T>(status: number, texto: string): Leido<T> {
  if (status === 413) return { ok: false, error: ERROR_ADJUNTO.pesado, reintentable: true, status };
  let j: unknown = null;
  try { j = JSON.parse(texto); } catch { /* no es JSON */ }
  const obj = j && typeof j === 'object' ? (j as Record<string, unknown>) : null;
  if (status >= 200 && status < 300 && obj) return { ok: true, datos: obj as T };
  if (status >= 400 && status < 500 && obj && typeof obj.error === 'string') {
    return { ok: false, error: obj.error, reintentable: status !== 408 && status !== 429, status };
  }
  return { ok: false, error: ERROR_INCIERTO, reintentable: false };
}

// ── Lo que se adjunta ────────────────────────────────────────────────────────

/** Una foto se achica a este lado mayor antes de subir: unos 300-600 KB en JPEG. */
export const LADO_MAX = 1600;

/** El tamaño al que se dibuja una imagen de w×h: nunca se agranda, se conserva la forma. */
export function medidasAchicadas(w: number, h: number, max = LADO_MAX): { w: number; h: number } {
  if (!(w > 0) || !(h > 0)) return { w: 0, h: 0 };
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

/** ¿Entran estos archivos? Los mismos topes que el route (4 archivos, 4 MB en total). */
export function problemaDeSeleccion(bytes: readonly number[]): string | null {
  if (bytes.length > TOPE_ADJUNTOS) return ERROR_ADJUNTO.muchos;
  if (bytes.reduce((n, b) => n + b, 0) > TOPE_TOTAL_BYTES) return ERROR_ADJUNTO.pesado;
  return null;
}

/** Un archivo que viaja con el turno (lo arma `envioDe`; ChatMako lo sube por multipart). */
export type AdjuntoM = { id: string; file: File; nombre: string; tipo: 'image' | 'document' };

/**
 * Qué es un archivo elegido: por su tipo o, si el navegador no lo dio, por su extensión. null = no
 * se manda (solo fotos o PDF). El route lo vuelve a mirar por sus BYTES (lib/mako-adjuntos.ts): esto
 * es para decirlo antes de subir, no para confiar en lo que dijo el navegador.
 * ⚠️ NO es el `accept` de la lista (`aceptaSegun`): un PDF sin tipo, como lo entregan algunos
 * selectores de Android, quedaría afuera por una regla que el route no tiene.
 */
export function tipoDeElegido(f: { name: string; type: string }): 'image' | 'document' | null {
  if (f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name)) return 'image';
  if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) return 'document';
  return null;
}

/**
 * Lo que sale al tocar Enviar (en el composer o en la vista previa): el texto recortado y TODOS
 * los archivos juntados, en el orden de la tira. Sin archivos, sólo el texto.
 */
export function envioDe(texto: string, items: readonly { id: string; file: File }[]): { texto: string; adjuntos: AdjuntoM[] } {
  return {
    texto: texto.trim(),
    adjuntos: items.map((it) => ({
      id: it.id, file: it.file, nombre: it.file.name, tipo: tipoDeElegido(it.file) === 'image' ? 'image' : 'document',
    })),
  };
}

/**
 * Lo que dice la vista previa mientras algo no la deja enviar (va con su giro). null = nada: se
 * puede enviar. Un Enviar apagado sin motivo a la vista se lee como un botón roto.
 */
export function avisoDeVista(s: { preparando: boolean; transcribiendo: boolean; ocupado: boolean }): string | null {
  if (s.preparando) return 'Preparando el archivo…';
  if (s.transcribiendo) return 'Transcribiendo…';
  if (s.ocupado) return `${GRAMATICA.analizando.rotulo} · tu mensaje anterior`;
  return null;
}

/**
 * Cuánto tapa el teclado, en px. En iOS el layout NO se achica con el teclado (hay que correr lo
 * de abajo esto); en Android el viewport ya se achica solo (`interactive-widget=resizes-content`,
 * app/m/layout.tsx) y da 0.
 */
export function altoTeclado(innerHeight: number, vv: { height: number; offsetTop: number } | null | undefined): number {
  if (!vv) return 0;
  return Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop));
}

/** Menos que esto no es un teclado (la barra de Safari que se esconde): no cambia cómo se ve la franja de abajo. */
const MIN_TECLADO_PX = 120;

/**
 * El teclado, para lo que va pegado abajo. `corrimiento` es lo que hay que subirlo (`altoTeclado`), y es 0 si iOS ya corrió la pantalla
 * para mostrar el campo: por eso no dice si el teclado está abierto. `abierto` y `reserva` sí, por lo que le falta a la pantalla visible.
 */
export function tecladoDelComposer(innerHeight: number, vv: { height: number; offsetTop: number } | null | undefined): { corrimiento: number; abierto: boolean; reserva: number } {
  if (!vv) return { corrimiento: 0, abierto: false, reserva: 0 };
  const falta = Math.max(0, Math.round(innerHeight - vv.height));
  const abierto = falta >= MIN_TECLADO_PX;
  return { corrimiento: altoTeclado(innerHeight, vv), abierto, reserva: abierto ? falta : 0 };
}

// ── El micrófono ─────────────────────────────────────────────────────────────

/** Mantener más de esto = nota de voz; menos = un toque (dictado al campo). */
export const ESPERA_MANTENER_MS = 250;
/** Deslizar a la izquierda más de esto cancela la nota. */
export const UMBRAL_CANCELAR_PX = 80;
/** Deslizar hacia arriba más de esto la bloquea (sigue grabando sin el dedo). */
export const UMBRAL_BLOQUEAR_PX = 70;
/** Una nota de voz dura como mucho esto; los últimos 15 s se cuentan para atrás. */
export const TOPE_NOTA_S = 120;

/** Qué hace el dedo que mantiene el micrófono. Cancelar gana: es lo que no deja rastro. */
export function gestoDelMic(dx: number, dy: number): 'cancelar' | 'bloquear' | null {
  if (dx <= -UMBRAL_CANCELAR_PX) return 'cancelar';
  if (dy <= -UMBRAL_BLOQUEAR_PX && Math.abs(dx) < UMBRAL_CANCELAR_PX) return 'bloquear';
  return null;
}

/** Los segundos que le quedan a la nota, sólo en los últimos 15. */
export function restanteNota(secs: number): number | null {
  const r = TOPE_NOTA_S - secs;
  return r <= 15 ? Math.max(0, r) : null;
}

export const duracion = (secs: number): string => {
  const s = Math.max(0, Math.floor(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** ¿Este error es «el micrófono está bloqueado»? (y no otra falla, que se dice tal cual) */
export function esMicBloqueado(error: string | null | undefined): boolean {
  const e = (error ?? '').toLowerCase();
  return /micr[oó]fono/.test(e) && /(permis|no me dej[oó]|bloque)/.test(e);
}

/** Cómo se habilita, en una frase. iOS no tiene candado en la barra: se hace en Ajustes. */
export const comoHabilitarMic = (ios: boolean): string => ios
  ? 'Actívalo en Ajustes › Safari › Micrófono.'
  : 'Actívalo en el candado junto a la dirección.';

// ── Lo que dice MaKo mientras trabaja ────────────────────────────────────────

/** La fuente que acompaña al rótulo «Revisando» (GRAMATICA.analizando exige nombrarla). */
export function fuenteDelTurno(adjuntos: readonly { tipo: 'image' | 'document' }[]): string {
  if (adjuntos.some((a) => a.tipo === 'document')) return 'el PDF';
  if (adjuntos.length > 1) return 'las fotos';
  if (adjuntos.length === 1) return 'la foto';
  return 'tus datos';
}

/** A partir de acá el rótulo dice cuánto puede tardar (los turnos medidos: 23-108 s). */
export const AVISO_LENTO_S = 12;

// ── Después de confirmar o cancelar una propuesta ────────────────────────────

export const SALIDA_PROPUESTA = 'No ejecutar la acción';

/** El primario nombra la acción y su objeto: es el nombre de la operación. */
export const rotuloPrimario = (t: Pick<TarjetaPendiente, 'titulo'>): string => t.titulo.trim() || 'Ejecutar la acción';

export type TrasTarjeta = {
  /** el estado nuevo de la fila; `null` = sigue pendiente (se puede volver a intentar) */
  estado: EstadoPropuesta | null;
  /** 3-4 palabras, o null si no hay toast */
  toast: string | null;
  /** lo que dice el sheet: de quién fue y qué pasa ahora */
  frase: string | null;
  haptico: 'success' | 'error' | null;
};

/** Traduce lo que contestó la acción a lo que ve la persona. */
export function trasTarjeta(r: ResultadoTarjeta, accion: 'confirmar' | 'cancelar'): TrasTarjeta {
  if (r.ok) {
    if (accion === 'confirmar' && r.enCurso) return { estado: 'en_curso', toast: 'Sigue por detrás', frase: null, haptico: 'success' };
    return accion === 'confirmar'
      ? { estado: 'hecho', toast: 'Acción ejecutada', frase: null, haptico: 'success' }
      : { estado: 'cancelada', toast: 'No se ejecutó', frase: null, haptico: null };
  }
  if (r.error === 'Ya no está vigente') return { estado: 'vencida', toast: 'Ya no está vigente', frase: 'Venció: ya no se puede ejecutar.', haptico: null };
  if (r.error === 'Ya se resolvió') return { estado: 'resuelta', toast: 'Ya se resolvió', frase: 'Ya se resolvió en otro lado.', haptico: null };
  // Se ejecutó y falló: la pendiente quedó cerrada. No se ofrece reintentar.
  if (r.ejecutada) return { estado: 'fallo', toast: null, frase: `Se ejecutó y falló: ${r.error}`, haptico: 'error' };
  return { estado: null, toast: null, frase: `MaKo no pudo: ${r.error}`, haptico: 'error' };
}

/** El texto de la pill de cada estado. «Aprobación pendiente» es el único naranja. Los
 *  estados que son de MaKo salen de GRAMATICA: el rótulo de un estado no se escribe a mano. */
export const PILL_PROPUESTA: Record<EstadoPropuesta, { texto: string; tono: 'warn' | 'good' | 'neutro' | 'bad' }> = {
  pendiente: { texto: GRAMATICA.aprobacion.rotulo, tono: 'warn' },
  aplicando: { texto: GRAMATICA.ejecuta.rotulo, tono: 'neutro' },
  en_curso: { texto: 'En curso', tono: 'neutro' },
  incierta: { texto: 'Revísalo', tono: 'warn' },
  hecho: { texto: GRAMATICA.completo.rotulo, tono: 'good' },
  cancelada: { texto: 'No se ejecutó', tono: 'neutro' },
  vencida: { texto: 'Vencida', tono: 'neutro' },
  resuelta: { texto: 'Ya resuelta', tono: 'neutro' },
  fallo: { texto: 'Falló', tono: 'bad' },
};
