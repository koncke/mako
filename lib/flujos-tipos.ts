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
  | { tipo: 'esperar'; horas: number };

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
  if (d.tipo === 'manual') return 'Manual (lo disparás vos)';
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
  return `Esperar ${p.horas}h`;
}

/** Valida la forma de un Flujo (defensivo: viene del store/JSON). */
export function esFlujoValido(x: unknown): x is Flujo {
  if (!x || typeof x !== 'object') return false;
  const f = x as Flujo;
  return f.version === 1 && typeof f.activo === 'boolean' && !!f.disparador && Array.isArray(f.pasos);
}
