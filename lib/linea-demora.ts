// =============================================================================
// linea-demora — WhatsApp entrega TARDE: el mensaje viejo no lo contesta MaKo sola, y la demora avisa por mail (10/11/2026)
// =============================================================================
// Martín, 10/11 a la noche: «No funciona MaKo en WhatsApp… no está funcionando para nada bien». Medido (sólo lectura, 11/11 01:00
// UTC): la línea de la voz (`mako_superadmin_muylqv8r`, …2605) dice `open`, pero WhatsApp le entrega los mensajes de los grupos en
// TANDAS: lo escrito entre las 22:49 y las 23:35 UTC entró todo junto a las 23:47:55 y a las 00:37:55, con 30 a 78 minutos de atraso.
// La línea de Martín (`mako_ws9`, …3479), que también está en grupos, entregó mensajes de un día antes (1.373 a 1.416 minutos).
// Lo que eso rompió:
//   · un comprobante de Código Inmobiliario del 9/11, ya resuelto a mano, volvió a entrar el 10/11 por `mako_ws9`: MaKo le dijo a
//     Joan «Recibí tu comprobante» y le mandó a Martín la revisión por segunda vez (ticket #80);
//   · Patricia (ws 22) y Giselle (ws 17) pidieron notas y la respuesta les llegó una hora después (ticket #79).
// La causa (WhatsApp dejando de entregarle a la sesión) no se arregla desde el código: lo que sí, dos cosas.
//   1. UN MENSAJE QUE LLEGA CON HORAS DE ATRASO NO LO ATIENDE MaKo SOLA (`llegoTarde`): el contexto cambió (el equipo ya lo resolvió,
//      la reunión ya pasó). Va a SuperAdmin, que lo contesta si hace falta. El atraso es la hora de WhatsApp (`messageTimestamp`,
//      cuando se MANDÓ) contra ahora.
//   2. LA DEMORA AVISA (`demoraDeEntrega`): el vigilante del canal (lib/canal-vigilante.ts) miraba si el socket contesta, y una
//      línea sorda o atrasada contesta. Ahora mide lo que llega: el atraso de lo que entró a la cola en las últimas horas.
//
// SIN `server-only`: puro, con test (tests/linea-demora.test.ts).
// =============================================================================

/** Desde cuántas horas de atraso un mensaje ya no lo atiende MaKo sola. Medido el 10/11: los de un día antes rompieron; los de 1 h, no. */
export const TARDE_MS = 6 * 3_600_000;

/** La hora de WhatsApp de un mensaje de Evolution (`messageTimestamp`, en segundos; a veces texto o `{ low }`), en ms. */
export function horaDeWhatsApp(ts: unknown): number | null {
  const crudo = typeof ts === 'object' && ts !== null && 'low' in ts ? (ts as { low: unknown }).low : ts;
  const s = Number(crudo);
  if (!Number.isFinite(s) || s <= 0) return null;
  return s < 1e12 ? s * 1000 : s;
}

/** ¿Llegó con tantas horas de atraso que MaKo no lo atiende sola? null = a tiempo, o sin hora (nunca se frena por no saber). */
export function llegoTarde(ts: unknown, ahora: number, tope = TARDE_MS): { horas: number } | null {
  const h = horaDeWhatsApp(ts);
  if (h == null || ahora - h <= tope) return null;
  return { horas: Math.round((ahora - h) / 3_600_000) };
}

/** Lo que mira la alarma: cada mensaje que entró a la cola, cuándo entró y su hora de WhatsApp. */
export type FilaDeEntrega = { created_at: string; ts: unknown; instancia: string | null };

/** Desde cuántos minutos de atraso una entrega cuenta como DEMORA (el 10/11: 30 a 78 min, y un día). */
export const DEMORA_MS = 20 * 60_000;
/** Cuánto hacia atrás se mira. */
export const VENTANA_DEMORA_MS = 3 * 3_600_000;

export type Demora = { instancia: string; atrasadas: number; deTotal: number; maxMin: number };

/**
 * Las líneas que entregaron TARDE en la ventana: por instancia, cuántos mensajes llegaron con más de `DEMORA_MS` de atraso, de
 * cuántos, y el peor. Vacío = todo a tiempo (o no entró nada: el silencio solo no es demora, lo midió el 10/11 el ticket #79).
 */
export function demoraDeEntrega(filas: readonly FilaDeEntrega[], ahora: number, o: { ventanaMs?: number; demoraMs?: number } = {}): Demora[] {
  const desde = ahora - (o.ventanaMs ?? VENTANA_DEMORA_MS);
  const umbral = o.demoraMs ?? DEMORA_MS;
  const por = new Map<string, Demora>();
  for (const f of filas) {
    const llego = Date.parse(f.created_at);
    const h = horaDeWhatsApp(f.ts);
    if (!Number.isFinite(llego) || llego < desde || llego > ahora || h == null) continue;
    const inst = f.instancia || '(sin línea)';
    const d = por.get(inst) ?? { instancia: inst, atrasadas: 0, deTotal: 0, maxMin: 0 };
    d.deTotal++;
    const atraso = llego - h;
    if (atraso > umbral) { d.atrasadas++; d.maxMin = Math.max(d.maxMin, Math.round(atraso / 60_000)); }
    por.set(inst, d);
  }
  return [...por.values()].filter((d) => d.atrasadas > 0).sort((a, b) => b.maxMin - a.maxMin);
}

// ── 11/11/2026 (noche): TODAS LAS LÍNEAS, no sólo la voz ────────────────────────────────────────────────────────────────────
// El informe de esa noche (docs/hallazgos-comunicacion.md, «La línea sorda») midió en `wa_mensajes` (llegada contra hora de envío)
// que 5 de 10 líneas reciben todo con ~24 h de atraso desde el 2 al 7/11 —ws20 Sergio Arriata, ws21 Florencia Carballo, ws22
// Patricia Contreras, ws9 y la voz— y NADIE lo vio: la alarma de arriba sólo lee la cola de MaKo (`mako_doer_buffer`). Los clientes
// estuvieron hasta 9 días viendo sus conversaciones con un día de atraso. Esto mide cada línea por su ATRASO TÍPICO (la mediana: una
// persona que escribió sin señal y llegó tarde no es la línea), con lo que entró por el webhook en las últimas 3 h.
//   ⚠️ LO QUE TRAE EL IMPORTADOR NO ES ATRASO. `importarHistorial`/`sincronizarChat` (lib/evolution-mensajes.ts) vuelcan chats viejos
//   con `created_at` de hoy: medido el 11/11, 638 filas con una mediana de 993 h. Se reconocen por su `raw`: el registro de
//   `findMessages` trae el `id` interno de Evolution y el del webhook no (23.773 filas, todas sin `id`). Sin ese corte, conectar una
//   línea nueva daba «un mes de atraso».

/** Lo que mira la alarma de las líneas: cada mensaje ENTRANTE de `wa_mensajes`. `importado` = `raw->>id` (no null = vino del importador). */
export type FilaDeLinea = { instance_name: string | null; workspace_id: number | null; created_at: string; wa_timestamp: string | null; tipo?: string | null; importado?: unknown };

/** Desde cuánto atraso TÍPICO una línea está atrasada (el pedido del 11/11: «atraso típico de 3 h > 30 min»). */
export const ATRASO_TIPICO_MS = 30 * 60_000;
/** Con menos mensajes que esto en la ventana no se mide: un solo mensaje tarde es la persona, no la línea. ws22 recibe ~5 por tanda. */
export const MIN_PARA_MEDIR = 3;
/** Después de escanear el QR, WhatsApp entrega lo que tenía guardado para el número: eso no es la línea atrasada. */
export const GRACIA_TRAS_VINCULAR_MS = 15 * 60_000;

export type MedidaDeLinea = { instancia: string; ws: number | null; mensajes: number; tipicoMin: number; ultimaLlegadaMs: number };

const mediana = (xs: number[]): number => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Cada línea con al menos `MIN_PARA_MEDIR` mensajes entrantes del webhook en la ventana, con su atraso típico. Sólo lo que llegó
 *  DESPUÉS de vincularse (`vinculos`: lo de antes es de otro dispositivo). Sanas y atrasadas: las sanas cierran la marca. */
export function medirLineas(filas: readonly FilaDeLinea[], ahora: number, vinculos: ReadonlyMap<string, number> = new Map(), ventanaMs = VENTANA_DEMORA_MS): MedidaDeLinea[] {
  const desde = ahora - ventanaMs;
  const por = new Map<string, { ws: number | null; atrasos: number[]; ultima: number }>();
  for (const f of filas) {
    const inst = f.instance_name;
    const llego = Date.parse(f.created_at);
    const envio = f.wa_timestamp ? Date.parse(f.wa_timestamp) : NaN;
    if (!inst || f.importado != null || f.tipo === 'evento' || !Number.isFinite(llego) || !Number.isFinite(envio)) continue;
    // Lo de los primeros minutos tras vincularse es lo que WhatsApp tenía encolado para el número: llega viejo por diseño.
    if (llego < desde || llego > ahora || llego <= (vinculos.get(inst) ?? 0) + GRACIA_TRAS_VINCULAR_MS) continue;
    const d = por.get(inst) ?? { ws: f.workspace_id ?? null, atrasos: [], ultima: 0 };
    d.atrasos.push(Math.max(0, llego - envio));
    d.ultima = Math.max(d.ultima, llego);
    por.set(inst, d);
  }
  return [...por.entries()].filter(([, d]) => d.atrasos.length >= MIN_PARA_MEDIR)
    .map(([instancia, d]) => ({ instancia, ws: d.ws, mensajes: d.atrasos.length, tipicoMin: Math.round(mediana(d.atrasos) / 60_000), ultimaLlegadaMs: d.ultima }))
    .sort((a, b) => b.tipicoMin - a.tipicoMin);
}

/** La marca de una línea atrasada (app_settings de la plataforma, `mako.lineas.atrasadas`, por instancia). `vinculadaDesde` es la
 *  vinculación sobre la que se midió: el panel sólo la desvincula si sigue siendo ésa (lib/linea-sorda.ts, `puedeSoltarseSorda`). */
export type MarcaDeLinea = { instancia: string; ws: number | null; negocio: string; tipicoMin: number; mensajes: number; desde: string; avisadaAt: string | null; vinculadaDesde: number | null };

/**
 * Qué cambia con lo medido: una línea atrasada se marca (o sigue marcada) y se avisa la primera vez y cada `REPETIR_DEMORA_MS`; una
 * MEDIDA sana se desmarca y avisa que volvió. ⚠️ Una línea que no se pudo medir (pocos mensajes, de noche) NO vuelve: sigue como
 * estaba. Que no entre nada no es que esté al día —es justo lo que hace una línea sorda—.
 */
export function marcasDeAtraso(previas: Readonly<Record<string, MarcaDeLinea>>, medidas: readonly MedidaDeLinea[], ahora: number, o: { negocio?: (ws: number | null, inst: string) => string; vinculos?: ReadonlyMap<string, number>; repetirMs?: number } = {}): { marcas: Record<string, MarcaDeLinea>; avisar: MarcaDeLinea[]; volvieron: MarcaDeLinea[] } {
  const iso = new Date(ahora).toISOString();
  const repetir = o.repetirMs ?? 3 * 3_600_000;
  const marcas: Record<string, MarcaDeLinea> = { ...previas };
  const avisar: MarcaDeLinea[] = [];
  const volvieron: MarcaDeLinea[] = [];
  for (const m of medidas) {
    const previa = previas[m.instancia];
    if (m.tipicoMin * 60_000 <= ATRASO_TIPICO_MS) {
      if (previa) { volvieron.push(previa); delete marcas[m.instancia]; }
      continue;
    }
    const toca = !previa?.avisadaAt || ahora - Date.parse(previa.avisadaAt) >= repetir;
    const marca: MarcaDeLinea = {
      instancia: m.instancia, ws: m.ws, negocio: o.negocio?.(m.ws, m.instancia) ?? previa?.negocio ?? m.instancia, tipicoMin: m.tipicoMin, mensajes: m.mensajes,
      desde: previa?.desde ?? iso, avisadaAt: toca ? iso : previa?.avisadaAt ?? null, vinculadaDesde: o.vinculos?.get(m.instancia) ?? null,
    };
    marcas[m.instancia] = marca;
    if (toca) avisar.push(marca);
  }
  return { marcas, avisar, volvieron };
}

/** «26 h» o «45 min». */
export const atrasoEnPalabras = (min: number): string => (min >= 120 ? `${Math.round(min / 60)} h` : `${Math.round(min)} min`);

/** El mail y la campanita de las líneas atrasadas, con el nombre del negocio. Armado por el código. */
export function textoDeLasLineasAtrasadas(lineas: readonly MarcaDeLinea[]): { asunto: string; cuerpo: string } {
  const peor = [...lineas].sort((a, b) => b.tipicoMin - a.tipicoMin)[0];
  const quienes = lineas.map((l) => l.negocio).join(', ');
  return {
    asunto: `⚠️ WhatsApp le entrega con ${peor ? atrasoEnPalabras(peor.tipicoMin) : '?'} de atraso a ${quienes}`,
    cuerpo: [
      'Estas líneas reciben los mensajes de sus clientes con atraso: el negocio ve sus conversaciones tarde, y lo que responde MaKo sale tarde.',
      '',
      ...lineas.map((l) => `· ${l.negocio} (${l.instancia}): lo que entró en las últimas 3 h llegó con un atraso típico de ${atrasoEnPalabras(l.tipicoMin)} (${l.mensajes} mensajes). Atrasada desde ${l.desde.slice(0, 16).replace('T', ' ')} UTC.`),
      '',
      'La causa de fondo es la versión de la librería de WhatsApp de Evolution (Baileys 7.0.0-rc.9): un reinicio no la cura.',
      'Volver a escanear el QR la cura por horas o días: en la pantalla de WhatsApp del negocio, «Conectar» la desvincula sola y da el QR,',
      'y el QR se escanea con el teléfono de ESE número.',
    ].join('\n'),
  };
}

/** El mail de la demora, armado por el código. */
export function textoDeLaDemora(demoras: readonly Demora[]): { asunto: string; cuerpo: string } {
  const peor = demoras[0];
  return {
    asunto: `⚠️ WhatsApp le entrega TARDE a MaKo (hasta ${peor ? Math.round(peor.maxMin) : 0} min)`,
    cuerpo: [
      'WhatsApp está entregando con atraso los mensajes de los grupos: los clientes escriben y MaKo los recibe tarde.',
      '',
      ...demoras.map((d) => `· ${d.instancia}: ${d.atrasadas} de ${d.deTotal} mensajes con más de ${Math.round(DEMORA_MS / 60_000)} min de atraso (el peor, ${d.maxMin} min).`),
      '',
      `Lo que llega con más de ${Math.round(TARDE_MS / 3_600_000)} h de atraso no lo contesta MaKo sola: va al grupo de SuperAdmin.`,
      'Si dura horas, o la línea deja de recibir del todo, la salida medida el 9/11 es volver a escanear su QR en /agencia.',
    ].join('\n'),
  };
}
