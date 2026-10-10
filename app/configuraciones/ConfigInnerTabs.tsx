'use client';

// =============================================================================
// ConfigInnerTabs — UNA sola fila de tabs de /configuraciones
// =============================================================================
// Notificaciones · Identidades fiscales · Equipo cargan EN EL LUGAR (sin
// redirigir). El panel de Equipo se renderiza en el server (page.tsx) y llega
// como prop. Método sigue siendo una ruta propia (admin de agencia). El Archivero,
// el Funnel y los Ángulos se mudaron a "Onboarding" (menú de la foto de perfil).

import Link from '@/app/_ui/Link';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { NotificacionesPanel } from '../perfil/NotificacionesPanel';
import { IdentidadesFiscalesPanel } from './IdentidadesFiscalesPanel';
import { CriterioPanel } from './CriterioPanel';
import { HorarioEnvioPanel } from './HorarioEnvioPanel';

const SANS = "'Geist', sans-serif";

type TabKey = 'notif' | 'fiscal' | 'equipo' | 'criterio' | 'horario';

export function ConfigInnerTabs({ equipoPanel, mensajesEnChatbot = false }: {
  /** Panel server-rendered embebido (data cargada en page.tsx). */
  equipoPanel: ReactNode;
  /**
   * El negocio tiene /automations: el lienzo de cada mensaje de Notificaciones se edita allá (quinta
   * tanda, punto 5). Lo decide el server (page.tsx) con la misma función que el guard de /automations.
   */
  mensajesEnChatbot?: boolean;
}) {
  const [tab, setTab] = useState<TabKey>('notif');
  const [esAdmin, setEsAdmin] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch('/api/auth/me').then((r) => r.json())
      .then((j) => { if (alive && j?.ok && j.autenticado) setEsAdmin(j.rol === 'admin'); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const TABS: Array<{ key: TabKey; label: string; panel: ReactNode }> = [
    { key: 'notif', label: 'Notificaciones', panel: <NotificacionesPanel editarEnChatbot={mensajesEnChatbot} /> },
    { key: 'fiscal', label: 'Identidades fiscales', panel: <IdentidadesFiscalesPanel /> },
    { key: 'equipo', label: 'Equipo', panel: equipoPanel },
    // El criterio gobierna QUE ENTRA al tablero de todo el workspace, asi que solo lo
    // ve (y lo guarda, ver criterio-actions.ts) un admin. Un closer que lo cambie
    // decide que compromisos existen para su jefe.
    ...(esAdmin ? [{ key: 'criterio' as TabKey, label: 'Criterio de reuniones', panel: <CriterioPanel /> }] : []),
    // El horario en que las automatizaciones le escriben a alguien (sexta tanda, 09/10/2026): por
    // defecto, cualquier hora. Decide cuándo le llega un mensaje a cada lead, así que sólo un admin
    // lo cambia (horario-actions.ts). lib/horario-envio.ts tiene el porqué.
    ...(esAdmin ? [{ key: 'horario' as TabKey, label: 'Horario', panel: <HorarioEnvioPanel /> }] : []),
  ];
  // Solo el Método (agencia) sigue siendo ruta aparte.
  const LINKS: Array<{ href: string; label: string; adminOnly?: boolean }> = [
    { href: '/metodo', label: 'Método', adminOnly: true },
  ];

  // Tabs tipo píldora, mismo control segmentado que el board /plan.
  const pill = (on: boolean): CSSProperties => ({ border: 'none', background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--ink)' : 'var(--dim)', fontWeight: on ? 600 : 500, fontSize: 13.5, padding: '7px 15px', borderRadius: 999, cursor: 'pointer', boxShadow: on ? '0 1px 2px rgba(18,21,27,.08)' : 'none', fontFamily: SANS });

  const activo = TABS.find((t) => t.key === tab);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 999, padding: 3 }}>
          {TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)} style={pill(tab === t.key)}>{t.label}</button>
          ))}
        </div>
        {LINKS.filter((l) => !l.adminOnly || esAdmin).map((l) => (
          <Link key={l.href} href={l.href} style={{ fontFamily: SANS, fontSize: 13.5, color: 'var(--dim)', textDecoration: 'none' }}>{l.label} <span aria-hidden style={{ fontSize: 10, opacity: 0.5 }}>↗</span></Link>
        ))}
      </div>
      {activo?.panel}
    </div>
  );
}
