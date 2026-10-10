// =============================================================================
// recordatorio-automatizacion — el recordatorio de la reunión como una AUTOMATIZACIÓN más (puro, con test)
// =============================================================================
// Decisión de Martín (10/10/2026), a la pregunta de qué hacer con el recordatorio, al que le faltaban el ✦,
// mover tarjetas, «Acomodar» y «Probar»: «Mudarlo al motor». Desde ahí el recordatorio es una fila de
// `nutricion_secuencias` como cualquier otra —su lienzo, su borrador, su ✦, «Probar»— con un CRON propio,
// «Agendó una reunión» (`TRIGGER_RECORDATORIO`).
//
// ⚠️ LO MANDA EL EMISOR DE SIEMPRE, NO EL MOTOR DE NUTRICIÓN, y es a propósito. El motor gira alrededor de
// la R1 (`reunionQuePreparaMs`, lib/nutricion-reinscripcion.ts) y de una inscripción por lead; el
// recordatorio tiene que cubrir la R1 y la R2, una reagenda en el mismo día, la tolerancia de cada toque y no
// repetir un toque ya mandado, y eso ya lo resuelve `mandarRecordatoriosAlLead` (lib/reunion-recordatorio.ts),
// prendido en el ws1. Lo que cambió es DE DÓNDE lee los toques: de esta fila. Así la mudanza no cambia qué
// sale ni cuándo, y las marcas de lo ya mandado (`claveToque`) siguen valiendo.
//
// LA FORMA QUE EL EMISOR SABE MANDAR, y la única que Publicar acepta con este CRON (`toquesDeLaAutomatizacion`):
// CRON → espera «N antes de la reunión» → WhatsApp → espera → WhatsApp…, en fila, con los minutos de `TOQUES`
// (24 h, 1 h y 15 min), de mayor a menor y sin repetir. Se puede sacar un toque; no se puede agregar una
// condición, una acción, un email ni una espera por tiempo: el emisor no sabría mandarlos.
//
// Sin `server-only`: lo leen el lienzo, la ruta que publica, el emisor y los tests.

import { claseDe, idDe, nodoPorId, raizSalida, type PasoGrafo } from './flujo-grafo';
import { lineaDelPaso } from './mensaje-partes';
import { TOQUES, TEXTO_DEFAULT, problemaDelTexto, type ConfigRecordatorio, type Toque } from './recordatorio-lead';

/** El CRON del recordatorio. NO lo inscribe el motor de nutrición: lo lee el emisor (ver la cabecera). */
export const TRIGGER_RECORDATORIO = 'reunion_recordatorio';
/** Cómo se llama en la tarjeta CRON y en el selector. */
export const ROTULO_TRIGGER_RECORDATORIO = 'Agendó una reunión';
/** El nombre de la automatización que crea la mudanza (y la plantilla de la galería). */
export const NOMBRE_RECORDATORIO_AUTOMATIZACION = 'Recordatorio de la reunión';

export type ToqueDeAutomatizacion = {
  min: Toque;
  /** El texto que sale (el escrito, o el de fábrica si la tarjeta está vacía). */
  texto: string;
  /** El número de ESE toque (`linea` del paso), o null = el de por default. */
  linea: string | null;
  /** La tarjeta del mensaje, para abrirla cuando algo falla. */
  paso: string;
};

const esToque = (n: unknown): n is Toque => (TOQUES as readonly unknown[]).includes(n);

/**
 * LOS TOQUES DE LA AUTOMATIZACIÓN, o qué le falta para que el emisor la pueda mandar. Recorre desde la raíz
 * de la salida (`raizSalida`, que salta el nodo de inicio) y exige la fila de esperas y mensajes; además,
 * que no quede nada afuera de la fila (una tarjeta suelta o una rama que el emisor no ve).
 */
export function toquesDeLaAutomatizacion(pasos: readonly PasoGrafo[]): { toques: ToqueDeAutomatizacion[]; problema: string | null; tarjeta: string | null } {
  const toques: ToqueDeAutomatizacion[] = [];
  const mal = (problema: string, tarjeta: string | null) => ({ toques, problema, tarjeta });
  const vistos = new Set<string>();
  let cur: string | null = raizSalida(pasos);
  if (!cur) return mal('El recordatorio no tiene ningún toque.', null);
  while (cur) {
    const espera: PasoGrafo | null = nodoPorId(pasos, cur);
    if (!espera) return mal('Una flecha lleva a una tarjeta que no existe.', null);
    vistos.add(cur);
    if (claseDe(espera) !== 'esperar' || espera.espera?.modo !== 'antes_reunion') {
      return mal('El recordatorio sólo lleva esperas «antes de la reunión» y WhatsApp.', cur);
    }
    const min = Number(espera.espera.minutos);
    if (!esToque(min)) return mal('Cada toque sale 24 h, 1 h o 15 min antes de la reunión.', cur);
    const anterior = toques[toques.length - 1];
    if (anterior && min >= anterior.min) return mal('Los toques van del más temprano al más cercano a la reunión.', cur);
    const msgId: string | null = espera.siguiente ?? null;
    const msg: PasoGrafo | null = nodoPorId(pasos, msgId);
    if (!msg || !msgId) return mal('Después de cada espera va el WhatsApp que sale.', cur);
    vistos.add(msgId);
    if (claseDe(msg) !== 'mensaje' || msg.canal === 'email' || (msg.tipo && msg.tipo !== 'texto') || (msg as { accion?: unknown }).accion) {
      return mal('El recordatorio manda texto por WhatsApp: sin audios, archivos, emails ni acciones.', msgId);
    }
    // Un toque es UN mensaje, en fila: el emisor no manda partes sueltas ni abre flechas en paralelo.
    const conPartes = (msg as { partes?: unknown[] }).partes;
    if (Array.isArray(conPartes) && conPartes.length > 1) return mal('Cada toque es un solo mensaje.', msgId);
    const paralelos = [(espera as { paralelos?: unknown[] }).paralelos, (msg as { paralelos?: unknown[] }).paralelos];
    if (paralelos.some((x) => Array.isArray(x) && x.length)) return mal('El recordatorio no abre flechas en paralelo.', msgId);
    const escrito = typeof msg.cuerpo === 'string' ? msg.cuerpo.trim() : '';
    const texto = escrito || TEXTO_DEFAULT[min];
    const p = problemaDelTexto(texto);
    if (p) return mal(p, msgId);
    toques.push({ min, texto, linea: lineaDelPaso(msg), paso: msgId });
    cur = msg.siguiente ?? null;
    if (cur && vistos.has(cur)) return mal('El recordatorio no puede volver atrás.', msgId);
  }
  const afuera = pasos.map((p, i) => idDe(p, i)).filter((id, i) => !vistos.has(id) && claseDe(pasos[i]) !== 'inicio');
  if (afuera.length) return mal('Hay tarjetas que no salen en el recordatorio: conéctalas o bórralas.', afuera[0]);
  return { toques, problema: null, tarjeta: null };
}

/**
 * LOS PASOS DE UN RECORDATORIO a partir de la configuración de antes (`chatbot.recordatorio_reunion`): la
 * mudanza de cada negocio y la plantilla de la galería (con la de fábrica). Los ids son estables
 * (`espera-1440`, `toque-1440`…), así una tarjeta abierta sigue siendo la misma.
 */
export function pasosDeLaConfig(cfg: Pick<ConfigRecordatorio, 'textos' | 'lineas'>): PasoGrafo[] {
  const out: PasoGrafo[] = [];
  TOQUES.forEach((min, i) => {
    const sig = TOQUES[i + 1];
    out.push({ id: `espera-${min}`, nodo: 'esperar', espera: { modo: 'antes_reunion', minutos: min }, siguiente: `toque-${min}`, canal: 'whatsapp', delay_horas: 0, cuerpo: '' } as PasoGrafo);
    const linea = cfg.lineas[min];
    out.push({
      id: `toque-${min}`, canal: 'whatsapp', proveedor: 'no_oficial', tipo: 'texto', delay_horas: 0,
      cuerpo: cfg.textos[min] ?? TEXTO_DEFAULT[min],
      ...(linea ? { linea } : {}),
      siguiente: sig != null ? `espera-${sig}` : null,
    } as PasoGrafo);
  });
  return out;
}
