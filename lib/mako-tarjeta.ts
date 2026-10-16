// =============================================================================
// mako-tarjeta — la tarjeta «MaKo en WhatsApp» POR PARTES (undécima tanda, decisión 2 de la décima)
// =============================================================================
// Pedido de Martín (11/10/2026), textual: «2. Si, agregale esas opciones. Pero en audios, que se pueda
// configurar con ElevenLabs que salga la voz de MaKo. La que usamos para crear los VSL de la landing.» = el
// editor de «MaKo en WhatsApp» con las MISMAS opciones que el de WhatsApp: audio, archivos, varios mensajes
// y ✦. El diseño, en docs/diseno-undecima-tanda.md §2 (decisión 2), §8 y §9 (18-21).
//
// LA FORMA: la tarjeta sigue siendo la ⚡ Acción `avisar_al_equipo` (`OP_AVISAR`, lib/flujo-legado.ts) y
// suma UN campo, `params.partes`: la MISMA lista que un WhatsApp (`ParteMensaje`, lib/mensaje-partes.ts).
//   · Con `partes` (una lista, aunque sea de una parte) la tarjeta sale TAL CUAL: lo que se ve en el lienzo
//     es lo que llega al grupo. Sin «🟡 título», sin «— MaKo», sin el rótulo de barras y sin el dedup de
//     12 h: el reclamo del motor (compare-and-set de la posición) ya impide el doble envío.
//   · Sin `partes` es una tarjeta de ANTES: un texto en `params.mensaje`, y sale como siempre (envuelto).
//   · `params.mensaje` queda como ESPEJO de las partes (los textos unidos): lo leen el feed, el push, la
//     ficha de la API, el «Falta completar» del lienzo (`faltaEscribir`) y todo lo que no sabe de partes.
//
// ⚠️ El audio de esta tarjeta es SÓLO la Voz de MaKo (lib/voz-mako.ts): un audio del negocio sería suplantar
// al dueño. Lo verifica el registro al preparar (chatbot.run.ts → `problemaDePartesGrupo`).
//
// PURO y sin `server-only`: lo usan el editor del lienzo (ola 2), el registro (chatbot.run.ts), el aviso
// (lib/avisos.ts), el envío al grupo (lib/mako-grupo.ts) y tests/mako-tarjeta.test.ts.
// =============================================================================

import {
  sanearPartes, formaGuardada, partesDe, resumenDePartes, PAUSA_ENTRE_PARTES_MS, TOPE_PARTES, pausaAntesDe,
  type ParteMensaje, type CamposMensaje, type PasoConPartes,
} from './mensaje-partes';
import { AVISO_REPETIDO } from './nutricion-grafo-motor';
import { proximaApertura, textoDeApertura, type HorarioEnvio } from './horario-envio';

/** La operación de la tarjeta. El MISMO literal que `OP_AVISAR` (lib/flujo-legado.ts); el test lo fija. */
export const OP_TARJETA_MAKO = 'avisar_al_equipo';

/** El tope de `mensaje` en el registro (chatbot.def.ts): el espejo se recorta ahí. */
export const TOPE_MENSAJE_MAKO = 1000;

/** Lo que dice el feed (y el espejo `mensaje`) de una tarjeta que es sólo audio, o sólo un archivo. */
export const TEXTO_SOLO_AUDIO = '🎤 Nota de voz de MaKo';
export const TEXTO_SOLO_ARCHIVO = '📎 Archivo de MaKo';

/** El `tipo` del aviso que deja la tarjeta (el feed, el push, el interruptor de las de antes). */
export const TIPO_AVISO_TARJETA = 'chatbot-aviso-equipo' as const;

type Params = Record<string, unknown> | null | undefined;

/**
 * QUÉ HACE LA TARJETA FUERA DEL HORARIO DE OFICINA (15/10/2026, Martín: «Quiero que se pueda configurar que te mande el
 * mensaje luego, cuando se "abra" la oficina. Y por defecto si esta configurado horario de oficina que esté eso»):
 * 'espera' (de fábrica: sin elegir, espera) sale cuando abre; 'igual' sale a cualquier hora. Sin horario no hay nada que
 * esperar. Vive EN la tarjeta, donde se piensa ese envío; hasta ese día era una casilla de Configuraciones › Horario
 * («Los avisos al equipo salen igual», `avisosAlEquipo`), y antes del 14/10 una regla escondida del motor. La leen los
 * dos runners: el de los leads (lib/nutricion.ts) y el de los eventos (lib/flujos.ts).
 */
export type FueraDeHorario = 'igual' | 'espera';
export const FUERAS_DE_HORARIO: readonly FueraDeHorario[] = ['espera', 'igual'];

/** ¿Esta tarjeta espera a que abra la oficina? Sin elegir, SÍ. */
export const esperaQueAbra = (params: Params): boolean => params?.fueraDeHorario !== 'igual';

/** Cómo se dice cada opción en el editor de la tarjeta. */
export const ROTULO_FUERA_DE_HORARIO: Readonly<Record<FueraDeHorario, string>> = { espera: 'Espera a que abra', igual: 'Lo manda igual' };

/**
 * EL CHIP DE LA TARJETA EN EL LIENZO, si AHORA esperaría (Estrategia, 15/10/2026: «que la tarjeta DIGA cuándo va a salir»):
 * «Espera a que abra (mañana 9:00)». null con la oficina abierta, sin horario o si la tarjeta lo manda igual: ahí sale
 * en el momento y no hay nada que decir.
 */
export function chipDeEspera(params: Params, h: HorarioEnvio | null, tz: string, ahoraMs: number): string | null {
  if (!h || !esperaQueAbra(params)) return null;
  const abre = proximaApertura(ahoraMs, tz, h);
  if (abre == null || abre <= ahoraMs) return null;
  return `Espera a que abra (${textoDeApertura(abre, ahoraMs, tz)})`;
}

/**
 * POR DÓNDE SALE LA TARJETA (16/10/2026, la mudanza del reporte semanal a SuperAdmin: docs/diseno-avisos-plataforma.md
 * §6). 'email' le escribe al EQUIPO del negocio (sus destinatarios de Notificaciones, uno por uno, desde
 * equipo@hola-mako.com: `enviarAvisoPorEmail`, lib/avisos.ts); sin elegir, el grupo de WhatsApp, como siempre. Un email
 * de MaKo va al equipo, nunca a un lead. Por email va UN texto con su asunto (`problemaDeEmailMako`).
 */
export type CanalMako = 'grupo' | 'email';
export const CANALES_MAKO: readonly CanalMako[] = ['grupo', 'email'];
export const ROTULO_CANAL_MAKO: Readonly<Record<CanalMako, string>> = { grupo: 'WhatsApp del grupo', email: 'Email al equipo' };

/** ¿La tarjeta sale por email? Sin elegir, no: el grupo. */
export const esPorEmail = (params: Params): boolean => params?.canal === 'email';

/** El asunto de una tarjeta por email, crudo (con sus datos «{{…}}» sin resolver). */
export const asuntoDeMako = (params: Params): string => (typeof params?.asunto === 'string' ? params.asunto : '');

/** El tope del asunto: lo que entra en el renglón de una bandeja. */
export const TOPE_ASUNTO_MAKO = 160;

/** El interruptor de una tarjeta por email: la automatización, como `ESTADO_TARJETA`, pero sólo el correo. */
export const ESTADO_EMAIL_TARJETA = { activo: true, wa: false, email: true, frecuenciaMin: 0 } as const;

/**
 * LO QUE LE FALTA A UNA TARJETA POR EMAIL, o null. Lo leen Publicar (los dos runners) y el registro: un correo sin
 * asunto, o con una nota de voz que no tiene cómo viajar, no se publica.
 */
export function problemaDeEmailMako(params: Params): string | null {
  if (!esPorEmail(params)) return null;
  if (!asuntoDeMako(params).trim()) return 'Por email falta el asunto.';
  const lista = partesDeMako(params);
  if (lista.length > 1 || lista.some((p) => p.tipo !== 'texto')) return 'Por email va un solo texto, sin audio, archivos ni varios mensajes.';
  return null;
}

/** ¿La tarjeta sale TAL CUAL? Lo dice la PRESENCIA de la lista, no su largo. */
export const esTarjetaTalCual = (params: Params): boolean => !!params && Array.isArray(params.partes);

/**
 * Las partes de la tarjeta: las de `params.partes` (saneadas), o, en una tarjeta de antes, UN texto con
 * `params.mensaje`. Una lista vacía es una tarjeta sin escribir.
 */
export function partesDeMako(params: Params): ParteMensaje[] {
  if (params && Array.isArray(params.partes)) return sanearPartes(params.partes);
  const m = typeof params?.mensaje === 'string' ? params.mensaje : '';
  return m.trim() ? [{ tipo: 'texto', cuerpo: m }] : [];
}

/**
 * El ESPEJO `mensaje`: los textos (y los pies de los archivos) unidos, recortado al tope del registro. Una
 * tarjeta que es sólo una nota de voz o sólo un archivo dice eso, para que el feed y el «Falta completar»
 * no la lean como vacía.
 */
export function textoDePartes(lista: readonly ParteMensaje[]): string {
  const textos = lista.flatMap((p) => (p.tipo === 'texto' ? [p.cuerpo.trim()] : p.tipo === 'media' && p.cuerpo?.trim() ? [p.cuerpo.trim()] : []));
  const t = textos.filter(Boolean).join('\n\n');
  if (t) return t.slice(0, TOPE_MENSAJE_MAKO);
  if (lista.some((p) => p.tipo === 'audio')) return TEXTO_SOLO_AUDIO;
  if (lista.some((p) => p.tipo === 'media')) return TEXTO_SOLO_ARCHIVO;
  return '';
}

/** Lo que el editor de WhatsApp lee de un paso, armado desde la tarjeta MaKo. */
export type CamposDeMako = Omit<CamposMensaje, 'tipo'> & {
  tipo: 'texto' | 'audio' | 'media';
  canal: 'whatsapp';
  proveedor: 'no_oficial';
  template_wa: null;
  asunto: null;
};

/**
 * EL DTO QUE ENTIENDE EL EDITOR DE WHATSAPP (`EditorMensajeWhatsApp`), armado desde la tarjeta MaKo. Conserva
 * TODO el paso —el `id` y el `orden` REALES de la tarjeta, la `accion`, la posición en el grafo— y le pone
 * los campos de un mensaje por `formaGuardada`: la misma forma con que se guarda un WhatsApp. Lo que el
 * editor devuelve vuelve a la tarjeta por `paramsDeMako`.
 */
export function pasoDeMako<T extends { accion?: { params?: Record<string, unknown> } | null }>(paso: T): T & CamposDeMako {
  const f = formaGuardada(partesDeMako(paso.accion?.params));
  return {
    ...paso,
    canal: 'whatsapp', proveedor: 'no_oficial', template_wa: null, asunto: null,
    // `formaGuardada` sin `ia` nunca da 'ia': una tarjeta MaKo no tiene «MaKo lo adapta».
    tipo: f.tipo === 'ia' ? 'texto' : f.tipo,
    cuerpo: f.cuerpo, audio_id: f.audio_id, media_id: f.media_id, partes: f.partes,
  };
}

/** Lo que el editor manda al cambiar (un diff de la forma guardada). */
export type CambioDeMako = Partial<{ tipo: string; cuerpo: string; audio_id: number | null; media_id: number | null; partes: unknown[]; fueraDeHorario: FueraDeHorario; canal: CanalMako; asunto: string }>;

/**
 * El cambio del editor, de vuelta a los `params` de la tarjeta.
 *
 * ⚠️ `partes` SIEMPRE como lista explícita, aunque sea de una parte: es lo que hace que la tarjeta salga
 * TAL CUAL (`esTarjetaTalCual`). Y `mensaje` como espejo (`textoDePartes`).
 * ⚠️ El cambio se aplica sobre la forma GUARDADA de lo que hay (`formaGuardada`), con la misma regla que un
 * WhatsApp: los campos de siempre son el espejo de la primera parte y MANDAN sobre ella (`partesDe`).
 * Conserva `leadId` y `titulo`; lo demás que el registro no declara no se guarda.
 */
export function paramsDeMako(params: Params, cambio: CambioDeMako): Record<string, unknown> {
  const actual = formaGuardada(partesDeMako(params));
  const { fueraDeHorario, canal, asunto, ...delMensaje } = cambio;
  const junto = { ...actual, ...delMensaje, canal: 'whatsapp', proveedor: 'no_oficial' } as PasoConPartes;
  if (junto.tipo === 'ia') junto.tipo = 'texto';
  // Por dónde y el asunto (16/10/2026) pasan por `paramsConPartes`, que es quien decide qué se guarda.
  const conEnvio = { ...(params ?? {}), ...(canal !== undefined ? { canal } : {}), ...(asunto !== undefined ? { asunto } : {}) };
  const out = paramsConPartes(conEnvio, partesDe(junto));
  return fueraDeHorario && FUERAS_DE_HORARIO.includes(fueraDeHorario) ? { ...out, fueraDeHorario } : out;
}

/**
 * LOS `params` DE UNA TARJETA CON ESTA LISTA (la única que escribe la forma: `paramsDeMako` y `partirConEspera`,
 * lib/flujo-edicion.ts, pasan por acá). `partes` explícita aunque esté vacía, `mensaje` como espejo, y del resto
 * sólo `leadId`, `titulo`, `fueraDeHorario` y, por email, `canal` y `asunto`.
 */
export function paramsConPartes(params: Params, lista: readonly ParteMensaje[]): Record<string, unknown> {
  const partes = sanearPartes(lista);
  return {
    ...(params && params.leadId !== undefined ? { leadId: params.leadId } : {}),
    ...(params && typeof params.titulo === 'string' && params.titulo.trim() ? { titulo: params.titulo } : {}),
    // Lo de fuera del horario viaja con la tarjeta: sin esto, editar el texto lo borraba.
    ...(params && FUERAS_DE_HORARIO.includes(params.fueraDeHorario as FueraDeHorario) ? { fueraDeHorario: params.fueraDeHorario } : {}),
    // Por email, con su asunto (aunque esté a medio escribir: el freno de Publicar lo pide). Sin elegir, el grupo:
    // no se escribe nada, y una tarjeta de antes queda como estaba.
    ...(esPorEmail(params) ? { canal: 'email', asunto: asuntoDeMako(params).slice(0, TOPE_ASUNTO_MAKO) } : {}),
    mensaje: textoDePartes(partes),
    partes,
  };
}

/**
 * LA TARJETA EN UN RENGLÓN (lo que dibuja el lienzo y nombra un error): con dos o más partes, la de un WhatsApp
 * (`resumenDePartes`: «Hola · [audio] · [archivo] pie»); con una, su texto, o qué es si no tiene (una nota de voz,
 * un archivo). Vacía = sin escribir.
 */
export function resumenDeMako(params: Params, largo = 90): string {
  const lista = partesDeMako(params);
  if (lista.length >= 2) return resumenDePartes({ canal: 'whatsapp', proveedor: 'no_oficial', ...formaGuardada(lista) }, largo);
  const [a] = lista;
  if (!a) return '';
  if (a.tipo === 'texto') return a.cuerpo;
  if (a.tipo === 'audio') return TEXTO_SOLO_AUDIO;
  return a.cuerpo?.trim() ? a.cuerpo : TEXTO_SOLO_ARCHIVO;
}

// ── Lo que sale al grupo ─────────────────────────────────────────────────────────

/** Un archivo como lo manda Evolution (`mediaDeAdjunto`, lib/nutricion-grafo-motor.ts). */
export type MediaGrupo = { tipo: 'image' | 'video' | 'document'; mimetype: string; fileName?: string };

/**
 * UNA parte lista para salir: el texto con sus datos ya resueltos y el binario ya bajado. `pausaMs` es la
 * espera ANTES de ésta (desde la segunda; `pausaAntesDe`).
 */
export type PartePreparada =
  | { tipo: 'texto'; texto: string; pausaMs?: number }
  | { tipo: 'audio'; base64: string; mime: string; pausaMs?: number }
  | { tipo: 'media'; base64: string; media: MediaGrupo; caption?: string; pausaMs?: number };

/** Lo que se ve de una lista preparada en el feed, el push y el historial del grupo. */
export function textoDePreparadas(lista: readonly PartePreparada[]): string {
  const t = lista.flatMap((p) => (p.tipo === 'texto' ? [p.texto.trim()] : p.tipo === 'media' && p.caption?.trim() ? [p.caption.trim()] : []))
    .filter(Boolean).join('\n\n');
  if (t) return t;
  if (lista.some((p) => p.tipo === 'audio')) return TEXTO_SOLO_AUDIO;
  if (lista.some((p) => p.tipo === 'media')) return TEXTO_SOLO_ARCHIVO;
  return '';
}

/** Un audio bajado, `'no-existe'` si el id no es de este negocio, o null si no se pudo bajar. */
export type Bajado<T> = T | 'no-existe' | null;

/**
 * LAS PARTES, LISTAS PARA SALIR: primero se bajan TODOS los binarios, y recién después se resuelven los
 * textos. Si un audio o un archivo falta, no sale NADA (`enviarPartesDelPaso`, lib/nutricion.ts, hace lo
 * mismo con el lead): una tarjeta a medias es un mensaje que nadie escribió.
 *
 * Un texto que queda vacío al resolver sus datos no sale (Evolution rechaza un texto vacío); un pie vacío
 * se va con su archivo.
 */
export async function prepararPartes(
  lista: readonly ParteMensaje[],
  d: {
    audio: (id: number) => Promise<Bajado<{ base64: string; mime: string }>>;
    archivo: (id: number) => Promise<Bajado<{ base64: string; media: MediaGrupo }>>;
    texto: (t: string) => Promise<string>;
  },
): Promise<{ ok: true; partes: PartePreparada[] } | { ok: false; error: string }> {
  const partes = lista.slice(0, TOPE_PARTES);
  const binarios = new Map<number, { base64: string; mime?: string; media?: MediaGrupo }>();
  for (const [k, p] of partes.entries()) {
    if (p.tipo === 'audio') {
      const b = await d.audio(p.audio_id);
      if (!b || b === 'no-existe') return { ok: false, error: `parte ${k + 1}: ${b === 'no-existe' ? 'el audio ya no existe' : 'no pude bajar el audio'}` };
      binarios.set(k, b);
    } else if (p.tipo === 'media') {
      const b = await d.archivo(p.media_id);
      if (!b || b === 'no-existe') return { ok: false, error: `parte ${k + 1}: ${b === 'no-existe' ? 'el archivo ya no existe' : 'no pude bajar el archivo'}` };
      binarios.set(k, b);
    }
  }
  const out: PartePreparada[] = [];
  for (const [k, p] of partes.entries()) {
    const pausa = k > 0 ? { pausaMs: pausaAntesDe(p) } : {};
    if (p.tipo === 'texto') {
      const texto = (await d.texto(p.cuerpo)).trim();
      if (texto) out.push({ tipo: 'texto', texto, ...pausa });
    } else if (p.tipo === 'audio') {
      const b = binarios.get(k)!;
      out.push({ tipo: 'audio', base64: b.base64, mime: b.mime ?? 'audio/mpeg', ...pausa });
    } else {
      const b = binarios.get(k)!;
      const caption = p.cuerpo?.trim() ? (await d.texto(p.cuerpo)).trim() : '';
      out.push({ tipo: 'media', base64: b.base64, media: b.media!, ...(caption ? { caption } : {}), ...pausa });
    }
  }
  if (!out.length) return { ok: false, error: 'El aviso quedó vacío.' };
  return { ok: true, partes: out };
}

/** La respuesta cruda de Evolution (`ev`, lib/mako-grupo.ts). */
export type RespuestaEv = { ok: boolean; status: number; body: unknown };
export type EvFn = (path: string, init?: { method?: string; body?: string }) => Promise<RespuestaEv>;

/** Cuántas salieron, sus ids de WhatsApp y, si una falló, por qué. */
export type EnvioPartes = { ok: boolean; salieron: number; ids: string[]; error?: string };

/** El mensaje útil del cuerpo de un error de Evolution (viene anidado y variado). */
export function detalleEvolution(body: unknown): string {
  if (typeof body === 'string') return body.slice(0, 200);
  const b = (body ?? {}) as { response?: { message?: unknown }; message?: unknown; error?: unknown };
  const m = b.response?.message ?? b.message ?? b.error ?? body;
  const txt = Array.isArray(m) ? m.join(' · ') : typeof m === 'string' ? m : JSON.stringify(m);
  return (txt || 'sin detalle').slice(0, 200);
}

const soloB64 = (s: string): string => (s.includes(',') ? s.split(',').pop()! : s);

/** El «escribiendo…» anti-ban de un texto: el de siempre (`enviarAlGrupoMaKo`), proporcional al largo. */
export const delayDeTexto = (texto: string, azar: () => number = Math.random): number =>
  Math.round(Math.min(1500 + texto.length * 45, 9000) * (0.8 + azar() * 0.4));

/** El «grabando…» / «enviando…» de un audio o un archivo. */
export const DELAY_BINARIO_MS = 1000;

/**
 * MANDA LAS PARTES A UN JID, EN ORDEN, por la línea de MaKo. Texto → `/message/sendText`, audio →
 * `/message/sendWhatsAppAudio` (`encoding: true`: nota de voz), archivo → `/message/sendMedia`. Entre una y
 * otra, la pausa que eligió la tarjeta (`pausaMs`, o la de siempre).
 *
 * ⚠️ UNA PARTE SALIÓ SÓLO SI EVOLUTION DEVOLVIÓ SU `key.id`. «res.ok no es salió bien»: un 201 sin id es un
 * mensaje que nadie puede citar ni confirmar, y se cuenta como fallo, con el detalle del cuerpo.
 * ⚠️ CORTA EN LA PRIMERA QUE FALLA: las siguientes no salen, y `salieron` dice cuántas sí.
 *
 * `ev` se inyecta (el de lib/mako-grupo.ts en producción; uno de mentira en el test).
 */
export async function enviarPartesPorEv(
  jid: string,
  partes: readonly PartePreparada[],
  d: { ev: EvFn; instancia: string; esperar?: (ms: number) => Promise<void>; delayMs?: number; azar?: () => number },
): Promise<EnvioPartes> {
  const esperar = d.esperar ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const ids: string[] = [];
  if (!jid) return { ok: false, salieron: 0, ids, error: 'sin grupo' };
  if (!partes.length) return { ok: false, salieron: 0, ids, error: 'no hay nada que mandar' };
  for (const [k, p] of partes.entries()) {
    if (k > 0) await esperar(p.pausaMs ?? PAUSA_ENTRE_PARTES_MS);
    let ruta: string; let cuerpo: Record<string, unknown>;
    if (p.tipo === 'texto') {
      ruta = `/message/sendText/${d.instancia}`;
      cuerpo = { number: jid, text: p.texto, delay: d.delayMs ?? delayDeTexto(p.texto, d.azar) };
    } else if (p.tipo === 'audio') {
      ruta = `/message/sendWhatsAppAudio/${d.instancia}`;
      cuerpo = { number: jid, audio: soloB64(p.base64), delay: d.delayMs ?? DELAY_BINARIO_MS, encoding: true };
    } else {
      ruta = `/message/sendMedia/${d.instancia}`;
      cuerpo = {
        number: jid, mediatype: p.media.tipo, mimetype: p.media.mimetype, media: soloB64(p.base64), delay: d.delayMs ?? DELAY_BINARIO_MS,
        ...(p.media.fileName ? { fileName: p.media.fileName } : {}), ...(p.caption ? { caption: p.caption } : {}),
      };
    }
    const r = await d.ev(ruta, { method: 'POST', body: JSON.stringify(cuerpo) });
    const id = (r.body as { key?: { id?: unknown } } | null)?.key?.id;
    if (!r.ok || typeof id !== 'string' || !id) {
      const que = r.ok ? `Evolution ${r.status} sin el id del mensaje` : `Evolution ${r.status}`;
      return { ok: false, salieron: k, ids, error: `${partes.length > 1 ? `parte ${k + 1} de ${partes.length}: ` : ''}${que} en ${d.instancia}: ${detalleEvolution(r.body)}` };
    }
    ids.push(id);
  }
  return { ok: true, salieron: partes.length, ids };
}

/**
 * El rótulo de barras del grupo (`encabezadoAviso`) sobre una lista: va pegado a la PRIMERA parte si es un
 * texto (idempotente, como el de un texto: si ya empieza con «━━» no se repite). Con `encabezado` null (la
 * tarjeta tal cual) la lista sale como está.
 */
export function partesConRotulo(lista: readonly PartePreparada[], encabezado: string | null): PartePreparada[] {
  const [a, ...resto] = lista;
  if (!encabezado || !a || a.tipo !== 'texto' || a.texto.trimStart().startsWith('━━')) return [...lista];
  return [{ ...a, texto: `${encabezado}\n${a.texto}` }, ...resto];
}

// ── El aviso que arma la tarjeta ─────────────────────────────────────────────────

/** El interruptor de una tarjeta tal cual: la automatización. Ni el store, ni el email, ni el «cada cuánto». */
export const ESTADO_TARJETA = { activo: true, wa: true, email: false, frecuenciaMin: 0 } as const;

export type LeadDelAvisoMako = { id: number; nombre: string; telefono: string | null };

/** La forma del `EmitirAvisoInput` (lib/avisos.ts) que arma la tarjeta, sin el `ws` (lo pone el ctx). */
export type AvisoDeTarjeta = {
  tipo: typeof TIPO_AVISO_TARJETA;
  titulo: string;
  texto: string;
  categoria: 'accion';
  semaforo: 'amarillo';
  link?: string;
  lead?: { id: number; nombre: string };
  dedupKey?: string;
  dedupTtlMin?: number;
  rotulo?: false;
  estado?: typeof ESTADO_TARJETA | typeof ESTADO_EMAIL_TARJETA;
  partes?: PartePreparada[];
  /** Por email: el asunto ya resuelto, y sin push (la tarjeta dice email, no «suena el teléfono»). */
  asuntoEmail?: string;
  push?: false;
};

/**
 * LO QUE CAMBIA DEL AVISO CUANDO LA TARJETA VA POR EMAIL (16/10/2026): el interruptor sólo de correo, el asunto (que es
 * también el título: la banda del correo y el feed dicen lo mismo que la bandeja) y sin push. Lo comparten los dos
 * runners: el de los leads (`armarAvisoDeTarjeta`) y el de los eventos (`emitirTarjetaDelEvento`, lib/flujos.ts).
 */
export function avisoPorEmail(asunto: string): { titulo: string; asuntoEmail: string; estado: typeof ESTADO_EMAIL_TARJETA; push: false } {
  const a = asunto.trim().slice(0, TOPE_ASUNTO_MAKO);
  return { titulo: a, asuntoEmail: a, estado: ESTADO_EMAIL_TARJETA, push: false };
}

/**
 * EL AVISO DE UNA TARJETA «MaKo en WhatsApp».
 *
 * · TAL CUAL (desde un flujo, con `partes`, sin `respuesta`): las partes como están, sin envoltorio, sin
 *   rótulo, SIN `dedupKey`/`dedupTtlMin` (el reclamo del motor ya impide el doble envío, y dos tarjetas del
 *   mismo lead —«Nuevo agendado» y «Reunión en 30 min»— son dos mensajes) y con el estado FIJO: el
 *   interruptor es la automatización, no Configuraciones › Notificaciones. El feed lleva los textos unidos.
 * · COMO SIEMPRE (una tarjeta de antes, el «Otra cosa» del AI Step con `respuesta`, o la API): el texto
 *   envuelto («🟡 título», lo que escribió el lead, nombre · teléfono, el link, «— MaKo»), el dedup por lead
 *   (o por respuesta) de 12 h y el interruptor del store. Si la tarjeta tiene audio o archivos, salen
 *   DESPUÉS del texto envuelto: nada de lo que se ve en la tarjeta se pierde.
 *
 * `textos.mensaje` es el texto ya resuelto (los textos unidos de las partes, o el `mensaje` de antes) y
 * `linkLead` el link a la ficha CON el `?ws=` (`linkApp`): el feed usa la ruta relativa.
 */
export function armarAvisoDeTarjeta(
  payload: Params,
  o: {
    desdeUnFlujo: boolean;
    respuesta: string;
    lead: LeadDelAvisoMako | null;
    linkLead: string | null;
    /** `asunto`: el de una tarjeta por email, ya resuelto con sus datos. */
    textos: { titulo: string; mensaje: string; asunto?: string };
    partes: readonly PartePreparada[] | null;
  },
): AvisoDeTarjeta {
  const { lead } = o;
  const respuesta = o.respuesta.trim();
  const titulo = o.textos.titulo.slice(0, 120);
  const base = {
    tipo: TIPO_AVISO_TARJETA, titulo, categoria: 'accion' as const, semaforo: 'amarillo' as const,
    ...(lead ? { lead: { id: lead.id, nombre: lead.nombre }, link: `/crm/${lead.id}` } : {}),
  };
  // POR EMAIL (16/10/2026): el texto tal cual, al correo del equipo. Sin partes: por email va un texto
  // (`problemaDeEmailMako` lo frena al publicar, y acá no viaja otra cosa aunque llegara).
  if (esPorEmail(payload) && o.desdeUnFlujo && !respuesta && o.partes?.length) {
    return { ...base, texto: textoDePreparadas(o.partes), rotulo: false, ...avisoPorEmail(o.textos.asunto || titulo) };
  }
  if (esTarjetaTalCual(payload) && o.desdeUnFlujo && !respuesta && o.partes?.length) {
    return { ...base, texto: textoDePreparadas(o.partes), rotulo: false, estado: ESTADO_TARJETA, partes: [...o.partes] };
  }
  const texto = [
    `🟡 *${titulo}*`,
    '',
    o.textos.mensaje,
    ...(respuesta ? ['', `_"${respuesta.slice(0, 400)}"_`] : []),
    ...(lead ? ['', `${lead.nombre}${lead.telefono ? ` · ${lead.telefono}` : ''}`, `👉 ${o.linkLead ?? `/crm/${lead.id}`}`] : []),
    '',
    '— MaKo',
  ].join('\n');
  const binarias = (o.partes ?? []).filter((p) => p.tipo !== 'texto');
  return {
    ...base, texto,
    // POR LEAD y 12 h: dos automatizaciones avisando del mismo lead en la misma tarde son un aviso. Con
    // `respuesta`, POR RESPUESTA (revisión del 08/10/2026): por lead, el «no confirmó» de la misma tarde se
    // comía el «Otra cosa». Sin lead no hay entidad de qué deduplicar.
    ...(lead ? {
      dedupKey: respuesta ? `lead:${lead.id}:resp:${respuesta}` : `lead:${lead.id}`, dedupTtlMin: 60 * 12,
    } : {}),
    ...(binarias.length ? { partes: [{ tipo: 'texto' as const, texto }, ...binarias] } : {}),
  };
}

/** Lo que `emitirAviso` devuelve y esta tarjeta lee (lib/avisos.ts, `EmitirAvisoResult`). */
export type ResultadoAviso = { ok: boolean; wa: boolean; deduped: boolean; apagado?: boolean; agrupado?: boolean; waError?: string; email?: boolean };

/**
 * LO QUE LA TARJETA LE CONTESTA AL MOTOR. Un `ok: false` queda como 'fallo' en `nutricion_envios`, con el motivo.
 *
 * ⚠️ «LE AVISÉ» SÓLO SI LLEGÓ. Hasta la décima, `emitirAviso` daba ok aunque el WhatsApp no saliera (el
 * ws14 no tiene grupo, la línea de MaKo caída) y la tarjeta decía «Le avisé al equipo.»: un éxito falso
 * que nadie veía. Ahora, WhatsApp que no salió (`wa: false` con `waError`) es un fallo con su causa. No lo
 * son el aviso apagado en Configuraciones, el deduplicado ni el que espera al resumen de la mañana.
 * ⚠️ El resumen de un deduplicado EMPIEZA con `AVISO_REPETIDO`: el motor lo lee (`avisoSalio`) para mandar
 * el de respaldo.
 */
export function resultadoDelAviso(r: ResultadoAviso, lead: { nombre: string } | null, porEmail = false): { ok: boolean; resumen: string } {
  if (r.deduped) return { ok: true, resumen: `${AVISO_REPETIDO}${lead ? ` de ${lead.nombre}` : ''} hace poco.` };
  if (r.apagado) return { ok: true, resumen: 'El aviso está apagado en Configuraciones › Notificaciones: quedó sólo en la app.' };
  if (r.agrupado) return { ok: true, resumen: 'Quedó para el resumen de la mañana.' };
  if (!r.ok) return { ok: false, resumen: 'No pude avisarle al equipo.' };
  // Por email (16/10/2026), «le escribí» sólo si salió alguno: sin destinatarios, o con Resend caído, es un fallo.
  if (porEmail) return r.email ? { ok: true, resumen: 'Le escribí al equipo.' } : { ok: false, resumen: 'No salió el email: el negocio no tiene a quién escribirle en Notificaciones, o el correo falló.' };
  if (!r.wa && r.waError) return { ok: false, resumen: `No salió al grupo: ${r.waError}`.slice(0, 300) };
  return { ok: true, resumen: 'Le avisé al equipo.' };
}
