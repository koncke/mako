'use client';

import { useWs } from '@/app/_ui/Link';
import { conWs } from '@/lib/ws-tab';

// =============================================================================
// NoEsTuyo — el link de un borrador que no es de tu cuenta
// =============================================================================
// Antes acá salía el 404 pelado de Next: «This page could not be found». Con un link
// que MaKo manda por WhatsApp, eso se lee como que la app se rompió — cuando en
// realidad el aislamiento hizo exactamente lo que tiene que hacer.
//
// Lo que se dice y lo que NO: se dice que el borrador es de otra cuenta y de cuál.
// NUNCA se muestra su contenido (ni una tarea, ni el resumen): eso sigue del lado del
// server, scopeado por workspace. La salida depende de quién mira — el super-admin
// puede pasar a ese tablero (ya tiene esa potestad); cualquier otro vuelve al suyo.
// =============================================================================

const SANS = "'Geist', sans-serif";

/** Pasar a ver el tablero de ese workspace: MISMA puerta que la barra de impersonación
 *  (/api/admin/impersonate), no una nueva. Si el server dice que no, no pasa nada. */
async function irAlPlanDe(ws: number) {
  const r = await fetch('/api/admin/impersonate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ws }),
  }).then((x) => x.json()).catch(() => ({ ok: false }));
  if (r?.ok) window.location.href = conWs('/plan', ws);
}

export function NoEsTuyo({ existe, deQuien, wsDestino, otros = [] }: {
  /** el id existe pero es de otra cuenta (false = el link no existe o ya no está). */
  existe: boolean;
  /** nombre del workspace dueño. Solo se muestra al super-admin. */
  deQuien: string;
  /** si viene, se ofrece pasar a ese tablero (solo super-admin). */
  wsDestino: number | null;
  /** Los borradores PENDIENTES que sí son tuyos. El link lo transcribe un modelo y a
   *  veces le erra un carácter; ofrecerlos convierte un callejón sin salida en «era
   *  éste». Solo aparecen cuando el id no existe: si el borrador es de otra cuenta, lo
   *  que corresponde es el aviso de aislamiento, no una lista. */
  otros?: Array<{ id: string; resumen: string; nTareas: number }>;
}) {
  const puedeIr = existe && wsDestino != null;
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)', color: 'var(--ink)', fontFamily: SANS, padding: 24 }}>
      <div style={{ textAlign: 'center', padding: '30px 34px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, maxWidth: 460 }}>
        <div style={{ fontSize: 30, marginBottom: 10 }}>🔒</div>
        <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.35 }}>
          {existe ? 'Estas no son tus tareas' : 'Este borrador ya no existe'}
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--dim)', marginTop: 8, lineHeight: 1.55 }}>
          {existe
            ? (puedeIr && deQuien
              ? `El borrador es de ${deQuien}. Cada plan vive en su propia cuenta, así que desde aquí no te lo puedo mostrar.`
              : 'El borrador es de otra cuenta. Cada plan vive en la suya, así que desde aquí no te lo puedo mostrar.')
            : otros.length
              ? 'Ese link no lleva a ningún lado — puede haber llegado con un carácter cambiado. Estos son los borradores que tienes esperando:'
              : 'Puede que se haya aplicado hace tiempo o que el link esté mal copiado.'}
        </div>
        {!existe && otros.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 14, textAlign: 'left' }}>
            {otros.map((o) => (
              <a key={o.id} href={`/plan/revisar/${o.id}`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '11px 13px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', textDecoration: 'none', color: 'var(--ink)' }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, minWidth: 0 }}>
                  {o.resumen || `${o.nTareas} ${o.nTareas === 1 ? 'tarea' : 'tareas'} para revisar`}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>Revisar →</span>
              </a>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 9, justifyContent: 'center', marginTop: 18, flexWrap: 'wrap' }}>
          <a href="/plan" style={{ padding: '10px 18px', borderRadius: 10, background: 'var(--ink)', color: 'var(--surface)', fontSize: 13.5, fontWeight: 600, textDecoration: 'none' }}>Ir a mi plan</a>
          {puedeIr && (
            // Solo el super-admin: pasa al workspace de esa persona por el mismo camino
            // que la barra de impersonación, no por una puerta nueva.
            <button type="button" onClick={() => { void irAlPlanDe(wsDestino!); }}
              style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>
              Ver el plan de {deQuien.split(' ')[0] || 'esa cuenta'}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
