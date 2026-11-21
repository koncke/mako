'use client';

// =============================================================================
// PanelAgencia — lo de la PLATAFORMA en la barra de «estás viendo el dashboard de X»
// =============================================================================
// Vive en la barra del administrador, al lado de «Salir de la vista». Adentro del onboarding no va ningún atajo: el recorrido tiene que
// verse EXACTAMENTE igual que el de un cliente real, porque si no, lo que se prueba no es lo que el cliente va a ver.
//
// Hoy queda sólo «Probar tema», adentro del Cliente de Diseño. Lo demás salió el 21/11/2026 (Martín, probando con «Ir a un paso»):
//   · «Reset» (vaciaba el negocio entero: 50+ tablas y 4 buckets) → en la barra queda UN «RESET», que reinicia el onboarding sin borrar
//     lo suyo (./ReiniciarOnboarding.tsx). El borrado total pasó a «Acciones del negocio» de /admin/customers/<ws>, como «Borrar todos
//     los datos», sólo en las cuentas de prueba y escribiendo el nombre (app/admin/_polar/web/Customer/CustomerPage/CustomerHeader.tsx).
//   · «Datos de Mauricio» → en su lugar, «Autocompletar» (./Autocompletar.tsx): la respuesta de ejemplo de la pregunta de ahora.
//
// «Datos de Mauricio» se borró entero el 21/11 (la ruta, su lib y su componente). Se pinta solo si /api/admin/negocio-de-prueba dice que
// corresponde: super-admin de la agencia parado EXACTAMENTE en un negocio de prueba. Quién
// decide es el server: esconder el botón no protege nada si el endpoint acepta igual.

import { useEffect, useState, type CSSProperties } from 'react';
import { WS_DISENO } from '@/lib/auth-session';
import { TEMAS, ATTR_TEMA } from '@/lib/temas-candidatos';
import { aplicarTemaCandidato } from './TemaCandidato';
import { InterruptorModo } from './InterruptorModo';

const MONO = "'Geist Mono', monospace";

const chip: CSSProperties = {
  fontFamily: MONO, fontSize: 11.5, letterSpacing: '.06em', textTransform: 'uppercase',
  padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(243,240,231,.3)',
  background: 'transparent', color: '#F3F0E7', cursor: 'pointer', whiteSpace: 'nowrap',
};

/**
 * El tema en prueba — SOLO adentro del Cliente de Diseño.
 *
 * Vive acá y no en la barra lateral porque la barra la ven todos, y esto no es
 * una feature del producto: es una herramienta de obra. Una versión anterior lo
 * puso en el perfil de cualquier usuario y un cliente NUEVO abrió MaKo en
 * oscuro sin haber tocado nada, con toda la cola de contraste que el rebrand
 * todavía no cerró.
 */
function TemaEnPrueba() {
  const [tema, setTema] = useState<string | null>(null);
  useEffect(() => {
    const sync = () => setTema(document.documentElement.getAttribute(ATTR_TEMA));
    sync();
    window.addEventListener('mako-tema-candidato', sync);
    window.addEventListener('mako-modo', sync);
    return () => {
      window.removeEventListener('mako-tema-candidato', sync);
      window.removeEventListener('mako-modo', sync);
    };
  }, []);
  const t = TEMAS[0];
  const on = tema === t.id;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <button
        type="button" title={t.idea.slice(0, 100)}
        onClick={() => aplicarTemaCandidato(on ? null : t.id)}
        style={{
          ...chip,
          background: on ? '#F3F0E7' : 'transparent',
          color: on ? '#14161B' : '#F3F0E7',
          borderColor: on ? '#F3F0E7' : 'rgba(243,240,231,.3)',
        }}
      >
        {on ? t.nombre : 'Probar tema'}
      </button>
      {/* El claro/oscuro solo existe MIENTRAS hay tema en prueba: sin tema no hay
          modo, que es lo que garantiza que ningún cliente lo vea. */}
      {on && <InterruptorModo compacto />}
    </span>
  );
}

export function PanelAgencia() {
  const [disponible, setDisponible] = useState(false);
  // Lo dice el SERVER en la respuesta, nunca el `?ws=` de la URL.
  const [wsPanel, setWsPanel] = useState<number | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch('/api/admin/negocio-de-prueba', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j: { disponible?: boolean; ws?: unknown }) => {
        if (!vivo) return;
        setDisponible(!!j.disponible);
        setWsPanel(typeof j.ws === 'number' ? j.ws : null);
      })
      .catch((e) => { console.warn('[negocio-de-prueba] no se pudo consultar', e); if (vivo) setDisponible(false); });
    return () => { vivo = false; };
  }, []);

  if (!disponible || wsPanel !== WS_DISENO) return null;
  return <TemaEnPrueba />;
}
