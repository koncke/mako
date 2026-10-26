'use client';

// =============================================================================
// Lo que MaKo recomienda en ESTA pantalla, en el bloque de preguntas del Ops Center (26/10/2026)
// =============================================================================
// Martín (26/10/2026): que MaKo «comience a dar recomendaciones en todos lados, en el Ops Center, cuando uno esta haciendo una
// automatización, al crear una offer, landing... deben ser reales». El motor: lib/recomendaciones.ts; el diseño:
// docs/diseno-mako-recomienda.md. Esto es la cara, y es UNA para todas las pantallas:
//   · VA EN EL BLOQUE DE PREGUNTAS (PreguntasDelChat.tsx → BloqueDePreguntas, `deLaTab`), arriba de la caja: las sugerencias de
//     MaKo quedan plegadas en su tira («Sugerencias de MaKo (N)») hasta que se la toca, y abiertas van de a una. Nunca una lista
//     suelta arriba del hilo (Martín, 22/10/2026, con captura del CRM: «Mira lo mal que se ve esto»).
//   · CADA UNA: qué hacer (la pregunta), el porqué con su número y qué cambia (el contexto), y tres opciones: lo que la hace
//     («Abrir…» o «Escribírselo a MaKo»), «Ahora no» (14 días) y «No aplica» (no vuelve). El porqué lo escribió el código.
//   · «HACERLO» NO EJECUTA NADA: lleva a la pantalla, o deja el pedido ESCRITO en la caja de esta pantalla (`alPedir`) para que
//     la persona lo lea y lo mande. Lo anota como aceptada: pasados 10 días MaKo mide si cambió (lib/recomendaciones-reglas.ts).
//   · SIN NADA QUE DECIR, NO SE DIBUJA NADA: ni una tira vacía ni un «todo bien».
//   · Sólo el admin recibe algo (la ruta le devuelve `[]` al resto): lo que se decide acá vale para todo el equipo.
// ⚠️ SE PIDE UNA VEZ AL MONTARSE (GET, que no escribe nada del negocio). Lo decidido sale de la lista en el acto.
// =============================================================================

import '@/app/admin/operaciones/centro.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BloqueDePreguntas, type PreguntaDeLaTab } from '@/app/admin/operaciones/PreguntasDelChat';
import { leerRespuesta } from '@/app/m/mako/chat-ui';
import { useWs } from '@/app/_ui/Link';
import { conWs } from '@/lib/ws-tab';
import type { Decision, Recomendacion, Superficie } from '@/lib/recomendaciones-reglas';

const RUTA = '/api/mako/recomendaciones';
/** Las pantallas que la dibujan (WhatsApp contesta por la API cuando le preguntan: no tiene bloque). */
export type SuperficieDePantalla = Exclude<Superficie, 'whatsapp'>;

/** «2026-10-16T…» → «16/10». */
const diaMes = (iso: string): string => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : `${d.getDate()}/${d.getMonth() + 1}`; };

/** El contexto de la pregunta: el porqué con su número, y qué cambia. Si ya se aceptó y sigue igual, eso primero. */
export function contextoDe(r: Pick<Recomendacion, 'porque' | 'cambia' | 'seguimiento'>): string {
  const porque = r.porque.map((p) => p.replace(/[.\s]+$/, '')).join('. ');
  const seg = r.seguimiento ? `La aceptaste el ${diaMes(r.seguimiento.aceptadaEl)} y sigue igual. ` : '';
  return `${seg}${porque}. ${r.cambia.replace(/[.\s]+$/, '')}.`;
}

/** ¿El link lleva a la pantalla en la que ya se está? Entonces «Hacerlo» escribe el pedido en la caja en vez de navegar. */
const esEstaPantalla = (href: string): boolean => {
  try { return new URL(href, window.location.origin).pathname === window.location.pathname; } catch { return false; }
};

/**
 * Las recomendaciones de una pantalla como preguntas del bloque. `alPedir`: deja un texto escrito en la caja de esta pantalla (la
 * persona lo lee y lo manda). Sin él, lo que se le pide a MaKo no se ofrece.
 */
export function useRecomendaciones(superficie: SuperficieDePantalla, o: { alPedir?: (texto: string) => void } = {}): PreguntaDeLaTab[] {
  const ws = useWs();
  const [recs, setRecs] = useState<Recomendacion[]>([]);
  const [ocupada, setOcupada] = useState<{ clave: string; n: number } | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [hechas, setHechas] = useState<Record<string, string>>({});
  const { alPedir } = o;

  useEffect(() => {
    let vivo = true;
    void (async () => {
      let status = 0; let cuerpo = '';
      try {
        const r = await fetch(`${RUTA}?superficie=${superficie}`, { signal: AbortSignal.timeout(45_000) });
        status = r.status; cuerpo = await r.text();
      } catch { /* red caída: status 0 */ }
      if (!vivo) return;
      const l = leerRespuesta<{ recomendaciones?: Recomendacion[] }>(status, cuerpo);
      // Si no se pudo leer, no se dibuja nada: una recomendación no es algo que haya que avisar que falta.
      setRecs(l.ok ? (l.datos.recomendaciones ?? []) : []);
    })();
    return () => { vivo = false; };
  }, [superficie]);

  const decidir = useCallback(async (r: Recomendacion, d: Decision, n: number): Promise<boolean> => {
    setOcupada({ clave: r.clave, n });
    setErrores((m) => { const x = { ...m }; delete x[r.clave]; return x; });
    try {
      let status = 0; let cuerpo = '';
      try {
        const res = await fetch(RUTA, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ superficie, clave: r.clave, decision: d }), signal: AbortSignal.timeout(45_000),
        });
        status = res.status; cuerpo = await res.text();
      } catch { /* red caída */ }
      const l = leerRespuesta<Record<string, never>>(status, cuerpo);
      if (!l.ok) { setErrores((m) => ({ ...m, [r.clave]: l.error })); return false; }
      return true;
    } finally {
      setOcupada(null);
    }
  }, [superficie]);

  return useMemo(() => recs.map((r): PreguntaDeLaTab => {
    const a = r.accion;
    // Lo que hace «Hacerlo»: llevar a otra pantalla, o dejar el pedido escrito en la caja de ésta.
    const pedido = a?.tipo === 'chat' ? a.pedido : a?.tipo === 'link' && esEstaPantalla(a.href) ? r.hacer : null;
    const hacer: PreguntaDeLaTab['opciones'][number] | null = pedido && alPedir
      ? { titulo: 'Escribírselo a MaKo', recomendada: true, onElegir: () => void decidir(r, 'hecha', 0).then((ok) => { if (ok) { alPedir(pedido); setHechas((m) => ({ ...m, [r.clave]: 'Quedó escrito en la caja: revísalo y envíalo.' })); } }) }
      : a?.tipo === 'link' && !esEstaPantalla(a.href)
        ? { titulo: a.etiqueta, recomendada: true, onElegir: () => void decidir(r, 'hecha', 0).then((ok) => { if (ok) window.location.assign(conWs(a.href, ws)); }) }
        : null;
    const n0 = hacer ? 1 : 0;
    const sacar = (d: Decision, n: number) => () => void decidir(r, d, n).then((ok) => { if (ok) setRecs((xs) => xs.filter((x) => x.clave !== r.clave)); });
    const opciones: PreguntaDeLaTab['opciones'] = [
      ...(hacer ? [hacer] : []),
      { titulo: 'Ahora no', onElegir: sacar('ahora-no', n0) },
      { titulo: 'No aplica a mi negocio', onElegir: sacar('no-aplica', n0 + 1) },
    ];
    const enCurso = ocupada?.clave === r.clave ? ocupada.n : null;
    return {
      id: r.clave, pregunta: r.hacer, contexto: contextoDe(r), opciones,
      ocupada: enCurso, quieta: !!ocupada && enCurso == null, error: errores[r.clave] ?? null,
      hecha: hechas[r.clave] ? { texto: hechas[r.clave] } : null,
    };
  }), [recs, ocupada, errores, hechas, alPedir, decidir, ws]);
}

/** El bloque con lo que MaKo recomienda en esta pantalla, arriba de su caja. Sin nada que decir, nada. */
export function RecomendacionesDeMako({ superficie, alPedir }: { superficie: SuperficieDePantalla; alPedir?: (texto: string) => void }) {
  const preguntas = useRecomendaciones(superficie, { alPedir });
  if (!preguntas.length) return null;
  return <BloqueDePreguntas chat={`recomienda:${superficie}`} deLaTab={preguntas} />;
}
