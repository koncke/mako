'use client';

// =============================================================================
// El Plan adentro de cada chat jefe: arriba de su avance (16/10/2026)
// =============================================================================
// Martín: «Los chats y el Centro deberían poder conectarse con el PLAN... Crear tareas nuevas, marcar como
// completadas, etc». Cada jefe ES un proyecto del Plan (los dos se llaman como la tab), así que la barra del avance
// muestra las tareas abiertas de ese proyecto, con un círculo para marcarla hecha y una caja para sumar otra.
//
// Copiado de la lista de tareas de Todoist (y de los sub-issues de Linear): el círculo vacío a la izquierda que se
// tilda con un clic, el título, la fecha a la derecha, y la fila «+ Sumar una tarea» al pie. Sin modal y sin preguntas:
// el Perro pone fecha y prioridad al aplicar (las reglas, en lib/centro-plan-reglas.ts).
// ⚠️ Habla con /api/centro/plan con `fetch`, no con una server action: al aplicar corre el Perro (30 a 60 s) y las
// server actions van de a una, así que el resto del Centro quedaba esperando. Lo pide la barra AL ABRIRSE.

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Icon } from '@/app/_components/icons';
import { proyectoDelChat, type EscritoPlan, type LecturaPlan, type TareaPlanP } from '@/lib/centro-plan-reglas';

const RUTA = '/api/centro/plan';
/** El Plan de un jefe leído hace menos de un minuto se reusa al volver a ese chat. */
const VIGENCIA_MS = 60_000;
const enCache = new Map<string, { plan: LecturaPlan; en: number }>();
const vigente = (chat: string) => { const c = enCache.get(chat); return c && Date.now() - c.en < VIGENCIA_MS ? c.plan : null; };

async function pedir<T>(init: RequestInit & { url: string }, timeoutMs: number, falla: T): Promise<T> {
  try {
    // ⚠️ CON SEÑAL DE CORTE (AGENTS.md): sin ella, con la conexión caída el botón quedaba ocupado para siempre.
    const r = await fetch(init.url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    return (await r.json()) as T;
  } catch {
    return falla;
  }
}

export type PlanDelChat = {
  /** null = leyendo. */
  plan: LecturaPlan | null;
  /** Lo último que pasó, en pocas palabras (la línea de estado de la sección). */
  aviso: string | null;
  ocupado: boolean;
  sumar: (texto: string, dePedido: boolean) => Promise<boolean>;
  marcar: (t: TareaPlanP) => Promise<void>;
};

/** El Plan del chat abierto: lo lee al abrir la barra y lo actualiza con lo que devuelve cada escritura. */
export function usePlanDelChat(chat: string): PlanDelChat {
  const [plan, setPlan] = useState<LecturaPlan | null>(() => vigente(chat));
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const guardar = useCallback((p: LecturaPlan | undefined) => {
    if (!p) return;
    if (p.ok) enCache.set(chat, { plan: p, en: Date.now() });
    setPlan(p);
  }, [chat]);

  useEffect(() => {
    setAviso(null);
    const ya = vigente(chat);
    if (ya) { setPlan(ya); return; }
    setPlan(null);
    let vivo = true;
    void pedir<LecturaPlan & { error?: string }>({ url: `${RUTA}?chat=${encodeURIComponent(chat)}` }, 30_000, { ok: false, motivo: 'No pude leer el Plan.' })
      // Un 401 del proxy (la sesión venció) viene como `{ error }`, sin `motivo`.
      .then((p) => { if (vivo) guardar(p.ok ? p : { ok: false, motivo: p.motivo || p.error || 'No pude leer el Plan.' }); });
    return () => { vivo = false; };
  }, [chat, guardar]);

  const escribir = useCallback(async (cuerpo: Record<string, unknown>, mientras: string) => {
    setOcupado(true); setAviso(mientras);
    // El Perro tarda hasta un minuto; la ruta tiene 300 s y el navegador espera un poco más (cortar antes decía «No se
    // pudo» de algo que sí se creó).
    const r = await pedir<EscritoPlan>({ url: RUTA, method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat, ...cuerpo }) },
      310_000, { ok: false, error: 'No se pudo: reintenta.' });
    guardar(r.plan);
    setAviso(r.ok ? r.aviso : r.error);
    setOcupado(false);
    return r.ok;
  }, [chat, guardar]);

  const sumar = useCallback((texto: string, dePedido: boolean) => escribir({ accion: 'sumar', texto, dePedido }, 'Sumando al Plan…'), [escribir]);
  const marcar = useCallback(async (t: TareaPlanP) => { await escribir({ accion: 'marcar', id: t.id }, 'Marcándola hecha…'); }, [escribir]);

  return { plan, aviso, ocupado, sumar, marcar };
}

const FECHA = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'numeric', timeZone: 'UTC' });
const fechaCorta = (d: string) => { const t = Date.parse(`${d}T12:00:00Z`); return Number.isFinite(t) ? FECHA.format(t) : d; };

/** La sección «En el Plan» de un jefe. No se dibuja para el Cerebro, que no tiene proyecto: reparte. */
export function SeccionPlan({ chat, p }: { chat: string; p: PlanDelChat }) {
  const [texto, setTexto] = useState('');
  const jefe = proyectoDelChat(chat);
  if (!jefe) return null;
  const tareas = p.plan?.ok ? p.plan.tareas : [];
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (p.ocupado || !texto.trim()) return;
    if (await p.sumar(texto, false)) setTexto('');
  };
  return (
    <section className="co-plan" aria-label={`En el Plan: ${jefe}`}>
      <h3 className="co-avance__grupo-tit">En el Plan<span>{p.plan?.ok && p.plan.proyecto ? tareas.length : ''}</span>
        <a className="co-plan__ver" href="/plan" target="_blank" rel="noreferrer">Ver el Plan</a>
      </h3>
      {p.plan == null && <p className="co-plan__nota">Leyendo el Plan…</p>}
      {p.plan && !p.plan.ok && <p className="co-plan__nota">{p.plan.motivo}</p>}
      {p.plan?.ok && !p.plan.proyecto && <p className="co-plan__nota">{`No hay un proyecto «${jefe}» en el Plan.`}</p>}
      {p.plan?.ok && p.plan.proyecto && !tareas.length && <p className="co-plan__nota">{`Sin tareas abiertas en «${jefe}».`}</p>}
      {tareas.length > 0 && (
        <ul className="co-plan__lista">
          {tareas.map((t) => (
            <li key={t.id} className="co-plan__fila">
              <button type="button" className="co-plan__check" disabled={p.ocupado} onClick={() => p.marcar(t)}
                aria-label={`Marcar hecha: ${t.titulo}`} title="Marcar hecha">
                <Icon name="check" size={12} />
              </button>
              <span className="co-plan__titulo" title={t.titulo}>{t.titulo}</span>
              {t.deadline && <span className="co-plan__fecha">{fechaCorta(t.deadline)}</span>}
            </li>
          ))}
        </ul>
      )}
      <form className="co-plan__sumar" onSubmit={enviar}>
        <span aria-hidden className="co-plan__mas">+</span>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Sumar una tarea" aria-label={`Sumar una tarea al Plan de ${jefe}`}
          maxLength={200} disabled={p.ocupado} />
      </form>
      {p.aviso && <p className="co-plan__aviso" role="status">{p.aviso}</p>}
    </section>
  );
}
