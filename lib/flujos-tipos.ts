// =============================================================================
// flujos-tipos — el "FLUJO" de una automatización: disparador + pasos (data-pura)
// =============================================================================
// Extiende la "plantilla" (referencia de voz) a un FLUJO editable: CUÁNDO dispara
// (evento/cron/umbral/manual) y QUÉ pasos ejecuta (mandar un mensaje, hacer una
// acción, esperar). Módulo SIN 'server-only' (lo importan webhooks, UI y runtime).
//
// El enum de EVENTOS es CERRADO: cada valor corresponde 1:1 a un choke point donde
// ya se llama emitirDelCatalogo (calendly/fathom/meta-leads/chatwoot). No inventar
// eventos sin choke point.

export type EventoFlujo =
  | 'lead.agendo'        // webhooks/calendly invitee.created (R1 y R2)
  | 'lead.cancelo'       // webhooks/calendly invitee.canceled
  | 'reunion.ocurrio'    // webhooks/fathom new-meeting-content-ready
  | 'lead.form_meta'     // webhooks/meta-leads (INSERT)
  | 'lead.wa_entrante';  // webhooks/chatwoot mensaje entrante

export const EVENTOS: Array<{ key: EventoFlujo; label: string }> = [
  { key: 'lead.agendo', label: 'Un lead agenda una reunión' },
  { key: 'lead.cancelo', label: 'Un lead cancela la reunión' },
  { key: 'reunion.ocurrio', label: 'Terminó una reunión (Fathom)' },
  { key: 'lead.form_meta', label: 'Entra un lead por formulario de Meta' },
  { key: 'lead.wa_entrante', label: 'Un lead escribe por WhatsApp' },
];

export type FiltroEvento = { reunion?: 'R1' | 'R2' };

export type Disparador =
  | { tipo: 'evento'; evento: EventoFlujo; filtro?: FiltroEvento }
  | { tipo: 'manual' };

export type CanalPaso = 'aviso_dueno' | 'wa_lead';
export type AccionFlujo = 'crear_tarea' | 'inscribir_nutricion' | 'marcar_lead';

export type Paso =
  | { tipo: 'mensaje'; canal: CanalPaso; texto: string; requiereAprobacion?: boolean }
  | { tipo: 'accion'; accion: AccionFlujo; params?: Record<string, unknown>; requiereAprobacion?: boolean }
  | { tipo: 'esperar'; horas: number }
  | { tipo: 'insistir'; texto: string; cadaMin: number; veces: number };

// ── EL TECHO DE LA INSISTENCIA ───────────────────────────────────────────────
/**
 * El caso que pidió esto, textual: «ellos quieren que cuando un lead de sus clientes
 * entre al CRM, MaKo en WhatsApp le reviente a mensajes insistiendo que le LLAME».
 *
 * ⚠️ EL TECHO LO IMPONE EL PRODUCTO, NO LA CONFIANZA. «Reventar a mensajes» quema la
 * línea de WhatsApp de un cliente —y la línea es suya, no nuestra—, así que estos dos
 * números NO son configurables: el cliente elige cuántas y cada cuánto DENTRO de este
 * marco, y `sanearInsistir` recorta lo que se pase. Un número que el cliente puede
 * subir no protege nada.
 *
 * Decisión de Martín, 28/09/2026: hasta 5 repeticiones, nunca menos de 30 minutos entre
 * una y otra. Y dos cortes más que no se discuten: se termina en cuanto alguien acusa
 * recibo en el grupo, y de noche no sale (VENTANA_HORARIA).
 */
export const INSISTIR_MAX_VECES = 5;
export const INSISTIR_MIN_MINUTOS = 30;
/** Hora local del workspace: fuera de esta franja, la insistencia espera a la mañana. */
export const INSISTIR_VENTANA = { desde: 8, hasta: 21 } as const;

/** Palabras que cuentan como «lo vi» en el grupo y cortan la insistencia. */
export const ACUSES = ['ok', 'okey', 'oka', 'dale', 'listo', 'visto', 'lo vi', 'ya está', 'ya esta', 'perfecto', 'gracias', 'enterado', 'anotado', '👍', '✅', '🙏'];

/** ¿Este texto del grupo es un acuse de recibo? Tolerante: cualquier mensaje corto que lo contenga. */
export function esAcuse(texto: string): boolean {
  const t = (texto || '').trim().toLowerCase();
  if (!t || t.length > 40) return false;   // un mensaje largo es otra conversación, no un «ok»
  return ACUSES.some((a) => t === a || t.startsWith(a + ' ') || t.endsWith(' ' + a) || t.includes(a));
}

/**
 * CUÁNDO vuelve el próximo. Respeta la noche: si el turno cae fuera de la franja, se
 * corre al comienzo de la siguiente. Un aviso que insiste a las 3 de la mañana no lo
 * lee nadie y sí quema la línea.
 *
 * Vive acá y no en lib/insistencias.ts porque aquel tiene 'server-only' y ningún test
 * lo podría importar — y esto es lo que decide a qué hora le suena el teléfono a una
 * persona. Es la misma razón por la que el techo está acá.
 *
 * `horaLocal` es la hora del workspace AHORA. El salto se estima sumándole las horas
 * del intervalo: es una estimación deliberada, porque el cron vuelve a chequear la
 * ventana al drenar. Un error de borde retrasa un mensaje, nunca lo adelanta.
 */
export function proximaSalida(desde: Date, cadaMin: number, horaLocal: number): Date {
  const prox = new Date(desde.getTime() + cadaMin * 60_000);
  const horaProx = (horaLocal + Math.floor(cadaMin / 60)) % 24;
  if (horaProx >= INSISTIR_VENTANA.desde && horaProx < INSISTIR_VENTANA.hasta) return prox;
  const salto = (24 - horaProx + INSISTIR_VENTANA.desde) % 24;
  return new Date(prox.getTime() + salto * 3_600_000);
}

/** Recorta un paso de insistencia al marco que impone el producto. */
export function sanearInsistir(p: { texto?: string; cadaMin?: number; veces?: number }): { tipo: 'insistir'; texto: string; cadaMin: number; veces: number } {
  const veces = Math.max(1, Math.min(INSISTIR_MAX_VECES, Math.floor(Number(p.veces) || 1)));
  const cadaMin = Math.max(INSISTIR_MIN_MINUTOS, Math.floor(Number(p.cadaMin) || INSISTIR_MIN_MINUTOS));
  return { tipo: 'insistir', texto: (p.texto ?? '').trim(), cadaMin, veces };
}

export type Flujo = {
  version: 1;
  activo: boolean;
  disparador: Disparador;
  pasos: Paso[];
};

/** Flujo vacío por default (para arrancar a editar en la UI). */
export function flujoVacio(): Flujo {
  return { version: 1, activo: false, disparador: { tipo: 'manual' }, pasos: [] };
}

/** Descripción legible del disparador (para la card del flujo). */
export function describirDisparador(d: Disparador): string {
  if (d.tipo === 'manual') return 'Manual (lo disparas tú)';
  const ev = EVENTOS.find((e) => e.key === d.evento)?.label ?? d.evento;
  const f = d.filtro?.reunion ? ` (solo ${d.filtro.reunion})` : '';
  return `${ev}${f}`;
}

/** Descripción legible de un paso. */
export function describirPaso(p: Paso): string {
  if (p.tipo === 'mensaje') {
    const canal = p.canal === 'aviso_dueno' ? 'Avisar al dueño' : 'Mensaje al lead (WhatsApp)';
    return `${canal}${p.requiereAprobacion ? ' · con tu OK' : ''}`;
  }
  if (p.tipo === 'accion') {
    const acc: Record<AccionFlujo, string> = { crear_tarea: 'Crear una tarea', inscribir_nutricion: 'Inscribir en nutrición', marcar_lead: 'Marcar el lead' };
    return `${acc[p.accion] ?? p.accion}${p.requiereAprobacion ? ' · con tu OK' : ''}`;
  }
  if (p.tipo === 'insistir') {
    const cada = p.cadaMin % 60 === 0 ? `${p.cadaMin / 60} h` : `${p.cadaMin} min`;
    return `Insistir hasta que confirmes · cada ${cada}, hasta ${p.veces} ${p.veces === 1 ? 'vez' : 'veces'}`;
  }
  return `Esperar ${p.horas}h`;
}

/** Valida la forma de un Flujo (defensivo: viene del store/JSON). */
export function esFlujoValido(x: unknown): x is Flujo {
  if (!x || typeof x !== 'object') return false;
  const f = x as Flujo;
  return f.version === 1 && typeof f.activo === 'boolean' && !!f.disparador && Array.isArray(f.pasos);
}
