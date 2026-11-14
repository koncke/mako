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
// vencido sí lo es («Tardó demasiado»). Cancelar corta el pedido: la ruta mira la señal y no guarda nada si se canceló
// antes de terminar.
//
// ⚠️ DESMONTAR YA NO LO CORTA (22/10/2026, Martín: «En Automations, cuando está ejecutando algo, no debe deshabilitarme
// la navegación de la sidebar principal... Se debe ejecutar en segundo plano»). El turno en vuelo vive ACÁ, afuera del
// componente, por clave (la automatización): irse a otra tab no lo corta, y la ruta lo termina y guarda el chat. El fin
// lo recibe quien esté (`aQuienLeToca`): el que lo largó (su `enviar` devuelve, como siempre), el que volvió a montar la
// misma clave (`alAdoptar`: ve lo que va y aplica el resultado) o nadie (`siNadieMira`: guarda el resultado y avisa).
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { EventoIA, ListoIA, GuardadoIA } from '@/lib/flujo-ia';
import type { EventoPreguntaIA, ExtrasEdicionIA, MensajeChatMako, PreguntaMako, RespuestaMako } from '@/lib/automatizacion-chat';
import type { PasoGrafo } from '@/lib/flujo-grafo';

export const RUTA_IA = '/api/chat-agent/secuencias/ia';

/** El tope de la ruta (`maxDuration = 300`) + margen: el `fetch` no puede esperar para siempre. */
export const TOPE_CLIENTE_MS = 310_000;

export type FaseIA = 'contexto' | 'modelo' | 'respuesta' | 'revision';
/**
 * Lo que se dice de cada fase (corto: AGENTS.md, el texto que se dibuja). UNA palabra desde el 22/10/2026: la fila de las
 * fases del chat mide 292 px y lleva los puntos, el rótulo, «50 s · hasta 5 min» y Cancelar en UNA línea (Martín: «no me
 * gusta que "cancelar" tenga un salto de línea»). Con «Pensando la respuesta» (174 px) la fila pedía 409 y el rótulo se
 * cortaba en «Pensan…». En qué fase va lo dicen los puntos.
 */
export const TEXTO_FASE: Record<FaseIA, string> = {
  contexto: 'Leyendo',
  modelo: 'Escribiendo',
  // Una pregunta (lib/flujo-ia-consulta.ts): MaKo contesta y no toca el flujo.
  respuesta: 'Pensando',
  revision: 'Verificando',
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
  /** «Discutir» o «Editar» (22/10/2026, lib/flujo-ia-intencion.ts). Ausente = lo de antes. */
  intencion?: 'discutir' | 'editar';
  /** Lo adjuntado con el «+», ya leído a texto (23/10/2026, AU4: lib/chat-adjuntos-automatizacion.ts). */
  adjuntos?: ReadonlyArray<{ nombre: string; texto: string }>;
};

/** Cómo terminó un turno. */
export type FinIA =
  | { t: 'listo'; listo: ListoStreamIA }
  | { t: 'pregunta'; pregunta: PreguntaMako; mensaje: MensajeChatMako }
  /**
   * `noSalio`: el pedido no llegó a la ruta (el `fetch` falló antes de la respuesta). Sólo entonces el mensaje queda «No se
   * envió · Reintentar». Si la ruta contestó (falta la IA, un tope, se cortó), el mensaje SÍ llegó: lo dice MaKo.
   */
  | { t: 'error'; error: string; link?: string; status?: number; guardado?: GuardadoIA; noSalio?: true }
  | { t: 'cancelado' };

export type EstadoIA =
  | { t: 'quieto' }
  | { t: 'trabajando'; fase: FaseIA | null; leido: string | null; reparadas: number | null; desde: number; intento?: number | null };

/** El cuerpo del POST: sólo lo que hay (una ronda sin respuestas no manda `respuestas`). Pura. */
export function cuerpoIA(p: PedidoIA): Record<string, unknown> {
  return {
    pedido: p.pedido, modo: p.modo,
    ...(p.secuenciaId != null ? { secuenciaId: p.secuenciaId } : {}),
    ...(p.pasos ? { pasos: p.pasos } : {}),
    ...(p.respuestas?.length ? { respuestas: p.respuestas } : {}),
    ...(p.historial?.length ? { historial: p.historial } : {}),
    ...(p.intencion ? { intencion: p.intencion } : {}),
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

/** Un turno en vuelo, afuera de los componentes: su estado, su señal y quién lo está mirando. */
type Trabajo = { estado: EstadoIA; ctrl: AbortController; oyentes: Set<(e: EstadoIA) => void> };
/** El turno en vuelo de cada clave (uno por automatización). */
const TRABAJOS = new Map<string, Trabajo>();
/** Las instancias montadas de cada clave, con lo que hace cada una con un fin que no largó ella (`alAdoptar`). */
const MONTADOS = new Map<string, Map<object, (f: FinIA) => void>>();

/** ¿Hay un turno en vuelo para esta clave? (Lo mira quien monta para no largar otro encima.) */
export const hayTrabajo = (clave: string): boolean => TRABAJOS.has(clave);

/**
 * «CANCELAR» EN EL SERVIDOR (14/11/2026, la llamada con Julio): crear sobre la fila es un trabajo del servidor que la
 * pestaña que se cierra ya no corta (app/api/chat-agent/secuencias/ia/route.ts). Cancelar corta el pedido Y deja la marca
 * que el trabajo mira (`modo: 'cancelar'`). Vive acá, con el único POST del stream: el chat no hace POST propios.
 */
export function cancelarEnElServidor(secuenciaId: number): void {
  void fetch(RUTA_IA, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
    body: JSON.stringify({ modo: 'cancelar', secuenciaId }),
  }).catch(() => { /* sin la marca, el trabajo termina y lo dice el chat */ });
}

/**
 * A QUIÉN LE TOCA EL FIN de un turno: al que lo largó si sigue montado; si no, a OTRA instancia de la misma clave (la
 * persona volvió a la automatización); si no, a nadie (se fue: guarda y avisa quien lo largó, con `siNadieMira`). Pura.
 */
export function aQuienLeToca(duenio: object, montados: ReadonlyMap<object, unknown> | undefined): 'duenio' | 'otro' | 'nadie' {
  if (montados?.has(duenio)) return 'duenio';
  return montados && montados.size > 0 ? 'otro' : 'nadie';
}

/**
 * EL LECTOR. `enviar` hace UN turno y devuelve cómo terminó; `estado` dice la fase mientras tanto. Uno a la vez POR
 * CLAVE: un segundo `enviar` con otro en vuelo no sale (`cancelado`). Montar una clave con un turno en vuelo (se fue y
 * volvió) muestra lo que va, y su fin le llega por `alAdoptar`.
 */
export function useStreamIA(clave: string, alAdoptar?: (f: FinIA) => void): {
  estado: EstadoIA; trabajando: boolean;
  enviar: (p: PedidoIA, extra?: { siNadieMira?: (f: FinIA) => void }) => Promise<FinIA>; cancelar: () => void;
} {
  const yo = useRef<object>({}).current;
  const [estado, setEstado] = useState<EstadoIA>(() => TRABAJOS.get(clave)?.estado ?? { t: 'quieto' });
  const alAdoptarRef = useRef(alAdoptar);
  useEffect(() => { alAdoptarRef.current = alAdoptar; });

  // Montada: se anota para recibir lo que termine, y si hay un turno en vuelo, lo mira. Al desmontar NO se corta nada.
  useEffect(() => {
    let m = MONTADOS.get(clave);
    if (!m) { m = new Map(); MONTADOS.set(clave, m); }
    m.set(yo, (f) => alAdoptarRef.current?.(f));
    const t = TRABAJOS.get(clave);
    if (t) { t.oyentes.add(setEstado); setEstado(t.estado); }
    return () => {
      const mm = MONTADOS.get(clave);
      mm?.delete(yo);
      if (mm && !mm.size) MONTADOS.delete(clave);
      TRABAJOS.get(clave)?.oyentes.delete(setEstado);
    };
  }, [clave, yo]);

  const cancelar = useCallback(() => {
    const t = TRABAJOS.get(clave);
    if (!t) return;
    TRABAJOS.delete(clave);
    t.ctrl.abort();
    for (const o of t.oyentes) o({ t: 'quieto' });
  }, [clave]);

  const enviar = useCallback(async (p: PedidoIA, extra?: { siNadieMira?: (f: FinIA) => void }): Promise<FinIA> => {
    if (TRABAJOS.has(clave)) return { t: 'cancelado' };
    const c = new AbortController();
    const t: Trabajo = { estado: { t: 'trabajando', fase: null, leido: null, reparadas: null, desde: Date.now() }, ctrl: c, oyentes: new Set([setEstado]) };
    TRABAJOS.set(clave, t);
    const poner = (e: EstadoIA) => { t.estado = e; for (const o of t.oyentes) o(e); };
    poner(t.estado);
    const tope = setTimeout(() => c.abort(), TOPE_CLIENTE_MS);
    let respondio = false;
    /** Termina el turno: la caja vuelve a quieta ANTES de que quien lo recibe mire el resultado. */
    const terminar = (f: FinIA): FinIA => {
      if (TRABAJOS.get(clave) === t) TRABAJOS.delete(clave);
      poner({ t: 'quieto' });
      const montados = MONTADOS.get(clave);
      const quien = aQuienLeToca(yo, montados);
      if (quien === 'otro') for (const [k, fn] of montados!) if (k !== yo) fn(f);
      if (quien === 'nadie') extra?.siNadieMira?.(f);
      return f;
    };
    try {
      const res = await fetch(RUTA_IA, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpoIA(p)),
        signal: c.signal,
      });
      respondio = true;
      return terminar(await leerRespuestaIA(res, (ev) => {
        const s = t.estado;
        if (s.t !== 'trabajando') return;
        poner({
          ...s, fase: ev.fase,
          leido: ev.fase === 'contexto' ? ev.texto : s.leido,
          reparadas: ev.fase === 'revision' ? ev.reparadas : s.reparadas,
          intento: ev.fase === 'modelo' ? (ev.intento ?? s.intento ?? null) : null,
        });
      }));
    } catch (e) {
      // Cancelar no es un error: quien monta devuelve el pedido a la caja (`cancelar` ya lo sacó de TRABAJOS).
      if (c.signal.aborted && TRABAJOS.get(clave) !== t) return { t: 'cancelado' };
      return terminar({
        t: 'error', error: c.signal.aborted ? 'Tardó demasiado. Prueba de nuevo.' : (e instanceof Error ? e.message : String(e)),
        // Sin respuesta de la ruta, el pedido no salió: «No se envió · Reintentar». Con respuesta, llegó.
        ...(respondio ? {} : { noSalio: true as const }),
      });
    } finally {
      clearTimeout(tope);
    }
  }, [clave, yo]);

  return { estado, trabajando: estado.t === 'trabajando', enviar, cancelar };
}
