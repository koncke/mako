'use client';
// =============================================================================
// stream-ia — el LECTOR del stream de «Pídeselo a MaKo» (POST /api/chat-agent/secuencias/ia)
// =============================================================================
// Duodécima tanda (12/10/2026, docs/diseno-duodecima-tanda.md §2.5 y §3.4). Vivía adentro de la caja de Crear con IA
// (app/automations/CrearConIA.tsx, `enviar`); salió acá cuando la caja pasó a ser un CHAT (./ChatMako.tsx), que hace
// VARIOS turnos con el mismo lector: el pedido, cada respuesta a una pregunta, y la respuesta a «¿Cambio qué la
// dispara?».
//
// Lo que hace: un POST, el stream NDJSON de `EventoIA | EventoPreguntaIA`, las FASES REALES mientras tanto (las
// dibuja quien monta), Cancelar (AbortController) y el tope del cliente. Devuelve CÓMO TERMINÓ (`FinIA`); no decide
// qué hacer con el resultado: eso es de ChatMako y de quien lo monta.
//
// ⚠️ LAS FASES SON LAS DEL SERVER, no un spinner eterno: `GRAMATICA.analizando` («Revisando») exige mostrar sobre qué
// está trabajando, y AGENTS.md exige que todo lo que pueda pasar los ~8 s diga cuánto puede tardar. El tope del
// cliente es el de la ruta (`maxDuration = 300`) + margen.
//
// ⚠️ CANCELAR NO ES UN ERROR: termina en `{ t: 'cancelado' }`, y quien monta devuelve el pedido a la caja. Un tope
// vencido sí lo es («Tardó demasiado»). Desmontar corta el pedido: la ruta mira la señal y no guarda nada si se
// canceló antes de terminar.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { EventoIA, ListoIA, GuardadoIA } from '@/lib/flujo-ia';
import type { EventoPreguntaIA, ExtrasEdicionIA, MensajeChatMako, PreguntaMako, RespuestaMako } from '@/lib/automatizacion-chat';
import type { PasoGrafo } from '@/lib/flujo-grafo';

export const RUTA_IA = '/api/chat-agent/secuencias/ia';

/** El tope de la ruta (`maxDuration = 300`) + margen: el `fetch` no puede esperar para siempre. */
export const TOPE_CLIENTE_MS = 310_000;

export type FaseIA = 'contexto' | 'modelo' | 'respuesta' | 'revision';
/** Lo que se dice de cada fase (corto: AGENTS.md, el texto que se dibuja). */
export const TEXTO_FASE: Record<FaseIA, string> = {
  contexto: 'Leyendo tu negocio',
  modelo: 'Escribiendo el flujo',
  // Una pregunta (lib/flujo-ia-consulta.ts): MaKo contesta y no toca el flujo.
  respuesta: 'Pensando la respuesta',
  revision: 'Revisando el flujo',
};
export const ORDEN_FASES: FaseIA[] = ['contexto', 'modelo', 'revision'];

/** El `listo` de editar suma `ExtrasEdicionIA` (§3.5); el de crear no las trae. */
export type ListoStreamIA = ListoIA & Partial<ExtrasEdicionIA>;
export type EventoStreamIA = EventoIA | EventoPreguntaIA;

/** Lo que se manda en cada turno (§3.4). */
export type PedidoIA = {
  /** El pedido ORIGINAL de la ronda: cada respuesta lo vuelve a mandar, con las respuestas acumuladas. */
  pedido: string;
  modo: 'crear' | 'editar';
  secuenciaId?: number;
  /** Editar: el borrador que se manda (vuelve en `onListo` como `base`). */
  pasos?: readonly PasoGrafo[];
  respuestas?: readonly RespuestaMako[];
  /** Galería: el hilo ENTERO (antes de crear vive sólo en el cliente). */
  historial?: readonly MensajeChatMako[];
};

/** Cómo terminó un turno. */
export type FinIA =
  | { t: 'listo'; listo: ListoStreamIA }
  | { t: 'pregunta'; pregunta: PreguntaMako; mensaje: MensajeChatMako }
  | { t: 'error'; error: string; link?: string; status?: number; guardado?: GuardadoIA }
  | { t: 'cancelado' };

export type EstadoIA =
  | { t: 'quieto' }
  | { t: 'trabajando'; fase: FaseIA | null; leido: string | null; reparadas: number | null; desde: number };

/** El cuerpo del POST: sólo lo que hay (una ronda sin respuestas no manda `respuestas`). Pura. */
export function cuerpoIA(p: PedidoIA): Record<string, unknown> {
  return {
    pedido: p.pedido, modo: p.modo,
    ...(p.secuenciaId != null ? { secuenciaId: p.secuenciaId } : {}),
    ...(p.pasos ? { pasos: p.pasos } : {}),
    ...(p.respuestas?.length ? { respuestas: p.respuestas } : {}),
    ...(p.historial?.length ? { historial: p.historial } : {}),
  };
}

/** Una línea NDJSON → su evento. null = vacía, rota o sin forma de evento. Pura. */
export function eventoDeLinea(line: string): EventoStreamIA | null {
  const l = line.trim();
  if (!l) return null;
  try {
    const ev = JSON.parse(l) as EventoStreamIA;
    return ev && typeof ev === 'object' && typeof (ev as { t?: unknown }).t === 'string' ? ev : null;
  } catch { return null; }
}

type EventoFase = Extract<EventoIA, { t: 'fase' }>;

/**
 * LEE UNA RESPUESTA DE LA RUTA hasta que dice cómo terminó: el JSON plano de los errores de antes del stream (403,
 * 400, 409), o el NDJSON línea por línea, avisando cada fase. Un stream que se cierra sin `listo`, `pregunta` ni
 * `error` es «Se cortó». Un corte de la señal (Cancelar, el tope) TIRA: lo resuelve quien la creó. Sin React: el test
 * la corre con un `Response` de verdad.
 */
export async function leerRespuestaIA(res: Response, alFase: (ev: EventoFase) => void): Promise<Exclude<FinIA, { t: 'cancelado' }>> {
  // Los errores de antes del stream (403, 400, 409) llegan como JSON plano.
  if (!res.ok || (res.headers.get('content-type') ?? '').includes('application/json')) {
    const j = await res.json().catch(() => null) as { error?: string; link?: string; guardado?: GuardadoIA } | null;
    return {
      t: 'error', error: j?.error || `Error ${res.status}`, status: res.status,
      ...(j?.link ? { link: j.link } : {}), ...(j?.guardado ? { guardado: j.guardado } : {}),
    };
  }
  if (!res.body) return { t: 'error', error: 'Sin respuesta' };
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  /** Una línea; un `FinIA` = el stream terminó (listo, pregunta o error). */
  const procesar = (line: string): Exclude<FinIA, { t: 'cancelado' }> | null => {
    const ev = eventoDeLinea(line);
    if (!ev) return null;
    if (ev.t === 'listo') return { t: 'listo', listo: ev as ListoStreamIA };
    if (ev.t === 'pregunta') return { t: 'pregunta', pregunta: ev.pregunta, mensaje: ev.mensaje };
    if (ev.t === 'error') return { t: 'error', error: ev.error || 'No se pudo', ...(ev.link ? { link: ev.link } : {}) };
    if (ev.t === 'fase') alFase(ev);
    return null;
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
      const f = procesar(line);
      if (f) { void reader.cancel().catch(() => {}); return f; }
    }
  }
  const f = procesar(buf + dec.decode());
  // El stream se cerró sin decir cómo terminó (se cortó la conexión o la función).
  return f ?? { t: 'error', error: 'Se cortó. Prueba de nuevo.' };
}

/**
 * EL LECTOR. `enviar` hace UN turno y devuelve cómo terminó; `estado` dice la fase mientras tanto. Uno a la vez: un
 * segundo `enviar` con otro en vuelo no sale (`cancelado`).
 */
export function useStreamIA(): {
  estado: EstadoIA; trabajando: boolean; enviar: (p: PedidoIA) => Promise<FinIA>; cancelar: () => void;
} {
  const [estado, setEstado] = useState<EstadoIA>({ t: 'quieto' });
  const ctrl = useRef<AbortController | null>(null);

  // Al desmontar (cambiar de automatización, cerrar el modal) se corta el pedido.
  useEffect(() => () => { const c = ctrl.current; ctrl.current = null; c?.abort(); }, []);

  const cancelar = useCallback(() => {
    const c = ctrl.current;
    ctrl.current = null;
    c?.abort();
    setEstado({ t: 'quieto' });
  }, []);

  const enviar = useCallback(async (p: PedidoIA): Promise<FinIA> => {
    if (ctrl.current) return { t: 'cancelado' };
    const c = new AbortController();
    ctrl.current = c;
    const tope = setTimeout(() => c.abort(), TOPE_CLIENTE_MS);
    setEstado({ t: 'trabajando', fase: null, leido: null, reparadas: null, desde: Date.now() });
    /** Termina el turno: la caja vuelve a quieta ANTES de que quien monta mire el resultado. */
    const fin = (f: FinIA): FinIA => {
      if (ctrl.current === c) { ctrl.current = null; setEstado({ t: 'quieto' }); }
      return f;
    };
    try {
      const res = await fetch(RUTA_IA, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpoIA(p)),
        signal: c.signal,
      });
      return fin(await leerRespuestaIA(res, (ev) => {
        setEstado((s) => (s.t !== 'trabajando' ? s : {
          ...s, fase: ev.fase,
          leido: ev.fase === 'contexto' ? ev.texto : s.leido,
          reparadas: ev.fase === 'revision' ? ev.reparadas : s.reparadas,
        }));
      }));
    } catch (e) {
      // Cancelar (o desmontar) no es un error: quien monta devuelve el pedido a la caja.
      if (c.signal.aborted && ctrl.current !== c) return { t: 'cancelado' };
      return fin({ t: 'error', error: c.signal.aborted ? 'Tardó demasiado. Prueba de nuevo.' : (e instanceof Error ? e.message : String(e)) });
    } finally {
      clearTimeout(tope);
    }
  }, []);

  return { estado, trabajando: estado.t === 'trabajando', enviar, cancelar };
}
