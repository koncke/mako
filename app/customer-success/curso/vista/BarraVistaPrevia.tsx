'use client';

// =============================================================================
// BarraVistaPrevia — la franja arriba de la vista del alumno: volver, qué etapa, y el ensayo
// =============================================================================
// Tres cosas, y ninguna escribe nada del alumno:
//   · «Volver al curso», a la tab con el mismo producto.
//   · La etapa: el portal se ve distinto según dónde esté el cliente (lo de adelante, cerrado), y
//     el equipo lo quiere ver en cada una. Viaja en `?etapa=` y la página la arma de nuevo.
//   · Al abrirse, anota el ensayo del onboarding (`curso_vista`) — sólo para un admin, que es
//     quien arma el curso. Es lo ÚNICO que se escribe, y va a `app_settings`, no al alumno.
//
// Copy de pantalla: corto y de tú (AGENTS.md).

import { useEffect, useRef } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { ButtonLink, Select, Status } from '@/app/_ui';
import { marcarVistaAlumnoAction } from '../actions';

export function BarraVistaPrevia({ productoId, etapa, etapas, anotar }: {
  productoId: number;
  etapa: string | null;
  etapas: Array<{ key: string; label: string }>;
  /** ¿Anotar el ensayo del onboarding? Sólo un admin (el guard de verdad está en la action). */
  anotar: boolean;
}) {
  const router = useRouter();
  // Una vez por montaje: la action es idempotente, pero no hace falta pedirla en cada render.
  const anotado = useRef(false);
  useEffect(() => {
    if (!anotar || anotado.current) return;
    anotado.current = true;
    // Best-effort: si no se anota, la lista de la tab lo sigue pidiendo; nada se rompe.
    void marcarVistaAlumnoAction().catch(() => {});
  }, [anotar]);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)',
    }}>
      <ButtonLink size="sm" variant="secondary" href={`/customer-success/curso?producto=${productoId}`}>Volver al curso</ButtonLink>
      <Status tono="info">Vista del alumno</Status>
      <span style={{ flex: 1 }} />
      {etapas.length > 1 && (
        <Select value={etapa ?? ''} width={220} ariaLabel="Etapa del cliente"
          options={etapas.map((e) => ({ value: e.key, label: e.label }))}
          onChange={(k) => router.replace(`/customer-success/curso/vista?producto=${productoId}&etapa=${encodeURIComponent(k)}`, { scroll: false })} />
      )}
    </div>
  );
}
