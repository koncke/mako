// =============================================================================
// mensaje-partes — UN mensaje de WhatsApp que son VARIOS mensajes, en orden
// =============================================================================
// Pedido de Martín (09/10/2026, cuarta tanda, punto 15), textual: «en el editor de WhatsApp...
// Debería funcionar el botón de "enviar", justamente es una buena manera de en una sola
// automatización enviar varios mensajes... Por ejemplo, un audio primero y luego un link».
//
// EL MODELO: `partes` en el paso, una lista ORDENADA de mensajes que salen uno detrás del otro por
// la misma línea. Es un CAMPO del paso y no un nodo nuevo (AGENTS.md, «Un TIPO DE NODO nuevo son
// CINCO puertas»): la tarjeta sigue siendo «este nodo manda un mensaje».
//
// ⚠️ AUSENTE = EL CASO DE SIEMPRE, y por eso NO HAY MIGRACIÓN. `partes` sólo existe cuando son DOS o
// más; un mensaje de una sola parte se guarda como siempre (`tipo` + `cuerpo` + `audio_id` |
// `media_id`). Lo guardado antes se lee como sus partes (`partesDeLegado`): un audio con pie son DOS
// burbujas —el audio y el texto de después—, que es exactamente lo que el motor ya le mandaba al lead.
//
// ⚠️ LOS CAMPOS DE SIEMPRE SON EL ESPEJO DE LA PRIMERA PARTE, Y MANDAN SOBRE ELLA. Todo lo que no sabe
// de partes (la tarjeta, el generador, las tools de la API, lib/secuencias-audios.ts, «Probar» de
// antes) sigue leyendo un mensaje válido: el primero. Y un escritor que no sabe de partes y cambia el
// texto o el audio del paso cambia la PRIMERA parte sin borrar las demás (`partesAlGuardar`): «lo que
// el cliente no mande sobrevive», como las variantes.
//
// ⚠️ `partes: []` NO ES LO MISMO QUE SIN `partes` (hallazgos-chatbot.md, «Un mensaje que pasa a
// archivo o a voz suelta sus variantes»: el merge que trataba `[]` como ausente impedía borrar). El
// editor manda `[]` para decir «una sola parte, lo sé»; sin la clave es «no sé de partes», y ahí se
// conservan las que había.
//
// Módulo PURO y sin `server-only`: lo usan el editor (cliente), el motor (lib/nutricion.ts),
// `setSecuenciaPasos`, «Probar» (lib/simulador-grafo.ts) y tests/mensaje-partes.test.ts.

import { proveedorDelPaso } from './nutricion-canal';

/** Una burbuja. Un audio no lleva texto (WhatsApp no tiene pie de audio: el texto es otra parte). */
export type ParteMensaje =
  | { tipo: 'texto'; cuerpo: string }
  | { tipo: 'audio'; audio_id: number }
  | { tipo: 'media'; media_id: number; cuerpo?: string };

/**
 * Cuántas partes como mucho. Martín pidió «un audio y luego un link» (dos); seis deja aire sin
 * convertir un paso en una ráfaga, que es lo que hace banear una línea no oficial.
 */
export const TOPE_PARTES = 6;

/** Cuánto espera el motor entre una parte y la siguiente (ver `enviarPartesDelPaso`, lib/nutricion.ts). */
export const PAUSA_ENTRE_PARTES_MS = 1200;

/** Lo que este módulo lee de un paso. El resto viaja intacto. */
export type PasoConPartes = {
  canal?: string | null;
  proveedor?: string | null;
  template_wa?: string | null;
  tipo?: string | null;
  cuerpo?: string | null;
  audio_id?: number | null;
  media_id?: number | null;
  partes?: unknown;
};

const idPositivo = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** Una parte cruda, saneada. null = no es una burbuja que se pueda mandar. */
export function sanearParte(raw: unknown): ParteMensaje | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const cuerpo = typeof o.cuerpo === 'string' ? o.cuerpo : '';
  if (o.tipo === 'audio') {
    const id = idPositivo(o.audio_id);
    return id ? { tipo: 'audio', audio_id: id } : null;
  }
  if (o.tipo === 'media') {
    const id = idPositivo(o.media_id);
    if (!id) return null;
    return cuerpo.trim() ? { tipo: 'media', media_id: id, cuerpo } : { tipo: 'media', media_id: id };
  }
  if (o.tipo === 'texto' || o.tipo == null) return cuerpo.trim() ? { tipo: 'texto', cuerpo } : null;
  return null;
}

/** La lista saneada: sin las partes que no se pueden mandar, y con el tope. */
export function sanearPartes(raw: unknown): ParteMensaje[] {
  if (!Array.isArray(raw)) return [];
  const out: ParteMensaje[] = [];
  for (const r of raw) {
    const p = sanearParte(r);
    if (p) out.push(p);
    if (out.length >= TOPE_PARTES) break;
  }
  return out;
}

/**
 * Las partes que dicen los CAMPOS DE SIEMPRE. Un audio con pie son dos (el audio y el texto de
 * después: así le llega al lead); un archivo lleva su caption adentro; un texto vacío no es nada.
 */
export function partesDeLegado(p: PasoConPartes): ParteMensaje[] {
  const cuerpo = typeof p.cuerpo === 'string' ? p.cuerpo : '';
  const audio = idPositivo(p.audio_id);
  if (p.tipo === 'audio' && audio) {
    return cuerpo.trim() ? [{ tipo: 'audio', audio_id: audio }, { tipo: 'texto', cuerpo }] : [{ tipo: 'audio', audio_id: audio }];
  }
  const media = idPositivo(p.media_id);
  if (p.tipo === 'media' && media) return [cuerpo.trim() ? { tipo: 'media', media_id: media, cuerpo } : { tipo: 'media', media_id: media }];
  return cuerpo.trim() ? [{ tipo: 'texto', cuerpo }] : [];
}

/**
 * Las partes de un paso de VARIAS partes, o null si es un mensaje de los de siempre. La cabeza sale
 * de los campos de siempre (mandan sobre la primera parte guardada) y el resto, de `partes`.
 *
 * ⚠️ El motor manda por este camino SÓLO lo que devuelve esto: un audio con pie de antes (dos
 * burbujas en `partesDe`) sigue saliendo por la rama de siempre, sin cambiar ni una línea.
 */
export function partesExplicitas(p: PasoConPartes): ParteMensaje[] | null {
  if (!Array.isArray(p.partes)) return null;
  const guardadas = sanearPartes(p.partes);
  if (guardadas.length < 2) return null;
  const lista = [...partesDeLegado(p), ...guardadas.slice(1)].slice(0, TOPE_PARTES);
  return lista.length >= 2 ? lista : null;
}

/** Las burbujas de un paso, en orden: las de varias partes, o las que dicen los campos de siempre. */
export const partesDe = (p: PasoConPartes): ParteMensaje[] => partesExplicitas(p) ?? partesDeLegado(p);

/** Los campos de un mensaje, en su forma GUARDADA. `partes: []` = una sola (el editor lo manda así). */
export type CamposMensaje = {
  tipo: 'texto' | 'audio' | 'media' | 'ia';
  cuerpo: string;
  audio_id: number | null;
  media_id: number | null;
  partes: ParteMensaje[];
};

/**
 * La forma en que se GUARDA una lista de partes. Una sola parte (o un audio seguido de un texto, que
 * es el audio con pie de siempre) va en los campos de siempre y `partes: []`; dos o más, en `partes`,
 * con la primera copiada en los campos de siempre (el espejo).
 *
 * `ia`: el mensaje estaba en «MaKo lo adapta». Sólo sobrevive con UN texto: MaKo reescribe un texto,
 * no una nota de voz ni una lista (y por eso `setSecuenciaPasos` se la saca a uno de varias partes).
 */
export function formaGuardada(lista: readonly ParteMensaje[], ia = false): CamposMensaje {
  const [a, b] = lista;
  if (!a) return { tipo: ia ? 'ia' : 'texto', cuerpo: '', audio_id: null, media_id: null, partes: [] };
  if (lista.length === 2 && a.tipo === 'audio' && b?.tipo === 'texto') {
    return { tipo: 'audio', cuerpo: b.cuerpo, audio_id: a.audio_id, media_id: null, partes: [] };
  }
  const espejo: Omit<CamposMensaje, 'partes'> = a.tipo === 'audio'
    ? { tipo: 'audio', cuerpo: '', audio_id: a.audio_id, media_id: null }
    : a.tipo === 'media'
      ? { tipo: 'media', cuerpo: a.cuerpo ?? '', audio_id: null, media_id: a.media_id }
      : { tipo: ia && lista.length === 1 ? 'ia' : 'texto', cuerpo: a.cuerpo, audio_id: null, media_id: null };
  return { ...espejo, partes: lista.length > 1 ? lista.slice(0, TOPE_PARTES) : [] };
}

/** ¿Es un solo texto? Ahí viven las variantes («↻ N») y «MaKo lo adapta». */
export const esUnTexto = (lista: readonly ParteMensaje[]): boolean => lista.length === 1 && lista[0].tipo === 'texto';

/**
 * Lo que `setSecuenciaPasos` le pisa al paso reconstruido para guardar sus partes. `{}` = nada: un
 * mensaje de los de siempre se guarda EXACTAMENTE como antes (ni la clave `partes` aparece).
 *
 * `previas`: las `partes` que el paso (por su id) tenía guardadas. Un escritor que no manda la clave
 * no sabe de partes: las demás se conservan y la primera es la de sus campos. Con `partes` (aunque
 * sea `[]`) manda lo que llega.
 *
 * Por el WhatsApp oficial o por email no hay varias partes (una plantilla de Meta es un mensaje, un
 * email es uno): con `partes` explícitas eso se RECHAZA antes (`problemaDePartes`); las conservadas
 * de un paso que cambió de canal se sueltan, porque el canal lo eligió quien guarda ahora.
 */
export function partesAlGuardar(p: PasoConPartes, previas?: unknown): Partial<Omit<CamposMensaje, 'partes'>> & { partes?: ParteMensaje[]; variantes?: string[] } {
  const crudas = Array.isArray(p.partes) ? p.partes : Array.isArray(previas) ? previas : null;
  if (!crudas) return {};
  const cabeza = partesDeLegado(p);
  const resto = p.canal === 'email' || proveedorDelPaso(p) !== 'no_oficial' ? [] : sanearPartes(crudas).slice(1);
  // Sin partes de más, lo que se reconstruyó de los campos de siempre ya es lo correcto.
  if (!resto.length) return { partes: undefined };
  const f = formaGuardada([...cabeza, ...resto]);
  // Varias partes (o una sola que subió a la cabeza): ni variantes (se sortean sobre UN texto) ni
  // «MaKo lo adapta». `undefined` y no `[]`: el merge de abajo repone las guardadas con un `[]`.
  return { tipo: f.tipo, cuerpo: f.cuerpo, audio_id: f.audio_id, media_id: f.media_id, partes: f.partes.length ? f.partes : undefined, variantes: undefined };
}

/**
 * Por qué las partes que LLEGAN no se pueden guardar, o null. Una combinación imposible es una
 * validación al guardar, no una degradación (AGENTS.md): una parte sin su archivo saldría como un
 * mensaje que nadie escribió, y por el oficial o por email no hay varias partes.
 */
export function problemaDePartes(p: PasoConPartes): string | null {
  if (!Array.isArray(p.partes) || p.partes.length === 0) return null;
  const malas = p.partes.filter((x) => !sanearParte(x)).length;
  if (malas) return 'tiene una parte sin su texto o su archivo';
  if (p.partes.length < 2) return null;
  if (p.canal === 'email') return 'tiene varias partes y un email es un solo mensaje';
  if (proveedorDelPaso(p) !== 'no_oficial') return 'tiene varias partes y por el WhatsApp oficial sale una sola plantilla';
  if (p.partes.length > TOPE_PARTES) return `tiene más de ${TOPE_PARTES} partes`;
  return null;
}

// ── El motor: cuántas ya salieron ────────────────────────────────────────────────
// Si una parte falla, el motor no manda las siguientes y reintenta. Para no duplicar las que ya
// salieron, el `fallo` deja escrito cuántas salieron, y el próximo intento arranca de ahí.
//
// ⚠️ VA EN `nutricion_envios.asunto`, y es una convención en un campo de texto, a sabiendas: la tabla
// no tiene un campo para esto y una migración más en esta tanda chocaba con la del CRON. `asunto` es
// de los emails; en un WhatsApp está siempre en null, y la rama de ACCIÓN ya lo usa para la operación
// (lib/nutricion.ts). La marca se escribe y se lee SÓLO con estas dos funciones, con un formato que
// ningún asunto de un WhatsApp tiene. El arreglo de fondo (una columna `partes_salidas`) está en el
// relevo.

const MARCA = /^partes salidas: (\d{1,2})$/;

/** La marca de un `fallo` de un mensaje de varias partes: cuántas ya le llegaron al lead. */
export const marcaPartes = (salieron: number): string => `partes salidas: ${Math.max(0, Math.min(TOPE_PARTES, Math.floor(salieron)))}`;

/** Cuántas partes ya salieron según el último envío de ese nodo. 0 si no es un `fallo` con la marca. */
export function partesYaSalidas(ultimo: { estado?: string | null; asunto?: string | null } | null | undefined): number {
  if (!ultimo || ultimo.estado !== 'fallo' || typeof ultimo.asunto !== 'string') return 0;
  const m = MARCA.exec(ultimo.asunto);
  return m ? Math.min(TOPE_PARTES, Number(m[1])) : 0;
}

// ── El borrador del setter ───────────────────────────────────────────────────────

/**
 * Un borrador (`wa_borradores`) es UN mensaje: texto, y un audio o un archivo. Un mensaje de varias
 * partes que tiene que pasar por el setter se arma así: el único audio o archivo de las partes, y los
 * textos juntos como su pie, en orden. Con DOS archivos no se puede sin perder uno, y eso no se arma:
 * lo dice el `fallo` (`error`). El borrador con varias partes de verdad necesita una columna en
 * `wa_borradores` y que `enviarBorrador` las mande en orden (en el relevo).
 */
export function borradorDePartes(lista: readonly ParteMensaje[]):
  | { ok: true; texto: string; audioId: number | null; adjuntoId: number | null }
  | { ok: false; error: string } {
  const archivos = lista.filter((x) => x.tipo !== 'texto');
  if (archivos.length > 1) return { ok: false, error: 'con dos archivos no se arma un borrador: deja que salga solo' };
  const textos = lista.flatMap((x) => (x.tipo === 'texto' ? [x.cuerpo.trim()] : x.tipo === 'media' && x.cuerpo?.trim() ? [x.cuerpo.trim()] : []));
  const a = archivos[0];
  return { ok: true, texto: textos.filter(Boolean).join('\n\n'), audioId: a?.tipo === 'audio' ? a.audio_id : null, adjuntoId: a?.tipo === 'media' ? a.media_id : null };
}
