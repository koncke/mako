'use client';

// =============================================================================
// PanelActivacion — la pantalla partida cuando a una tab le falta su conexión
// =============================================================================
// Es el MISMO lenguaje que el modal de /integraciones y que el onboarding, sin
// overlay: vive dentro del área de contenido de la tab. Aside negro a la
// izquierda (carrusel → facts al conectar), config a la derecha.
//
// Por qué no un empty state: un empty state dice "no hay datos" y le echa la
// culpa al negocio del cliente. Esto dice "esto se prende con X, y mirá lo que
// vas a ver" — y cuando conecta, el mismo panel le muestra sus datos reales sin
// cambiar de pantalla.
//
// El gate NO vive acá: la page (server component) pregunta por
// integracionConectada() y decide si renderiza la tab o este panel. Así el
// cliente nunca ve un parpadeo de la tab vacía antes del panel.
// =============================================================================

import { useState } from 'react';
import ServicioConfigForm from '../integraciones/ServicioConfigForm';
import { BrandDefs } from './ServicioVisual';
import { PanelMarketing, type Fact } from './PanelMarketing';
import type { TabActivacion } from '@/lib/tab-activacion';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

export function PanelActivacion({ tab, facts }: {
  tab: TabActivacion;
  /** Datos en vivo si la integración YA está conectada (reemplazan al carrusel). */
  facts?: Fact[];
}) {
  // Al conectar desde acá, recargamos: la tab pasa a tener su integración y la
  // page (server) ya puede renderizar el contenido real en vez de este panel.
  const [conectando, setConectando] = useState(false);

  return (
    <div style={{ padding: 'clamp(12px,3vh,28px) 0', fontFamily: SANS }}>
      <BrandDefs />
      <div
        className="mk-svc-modal"
        style={{
          maxWidth: 940, margin: '0 auto', minHeight: 520,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 18, overflow: 'hidden',
        }}
      >
        <PanelMarketing
          servicioKey={tab.servicio}
          nombre={tab.titulo}
          slides={tab.slides}
          facts={facts}
          eyebrow={tab.eyebrow}
        />

        {/* Columna derecha: por qué está apagada + el form de la credencial. */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ padding: '24px 26px 4px' }}>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.11em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 8 }}>
              Falta un paso
            </div>
            <h2 style={{ margin: 0, fontWeight: 600, fontSize: 20, letterSpacing: '-0.014em', color: 'var(--ink)' }}>
              {tab.titulo} se prende con esto
            </h2>
            <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.55 }}>
              {tab.queFalta}
            </p>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 26px 22px' }}>
            <ServicioConfigForm
              servicioKey={tab.servicio}
              onEstado={(conectada) => {
                // Recién cuando quedó conectada de verdad: recargar para que la
                // page sirva la tab real. Sin esto el cliente conecta y sigue
                // mirando el panel, que se lee como que no funcionó.
                if (!conectada || conectando) return;
                setConectando(true);
                window.location.reload();
              }}
            />
            {tab.ademas && (
              <div style={{ marginTop: 16, background: 'var(--warn-bg)', border: '1px solid var(--border)', borderRadius: 11, padding: '11px 13px', fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.5 }}>
                {tab.ademas}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
