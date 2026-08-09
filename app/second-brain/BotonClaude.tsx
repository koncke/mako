'use client';

// =============================================================================
// BotonClaude — «Conectar a Claude» desde el segundo cerebro
// =============================================================================
// Tres cosas se comparten con /integraciones en vez de copiarse, y las tres por el mismo
// motivo: dos copias que se ven iguales dejan de verse iguales en el primer cambio.
//   · el TUTORIAL (app/_components/TutorialAgente.tsx) — cuatro pasos encadenados, y el
//     primero tiene adentro la pantalla del consentimiento, que es un texto legal
//     versionado;
//   · el MOLDE DEL MODAL (app/_components/ModalShell.tsx) — la barra negra al costado, el
//     header fijo, el alto que no salta;
//   · las SLIDES y el LOGO, que ya viven en lib/servicio-slides.ts y en BrandDefs.
//
// Por qué el botón vive acá: el segundo cerebro es literalmente lo que la skill le lleva
// a Claude Code. El lugar donde alguien entiende para qué conectar su agente es mirando
// el mapa de lo que MaKo sabe de él.
// =============================================================================

import { useState } from 'react';
import { ModalShell, closeBtn } from '@/app/_components/ModalShell';
import { TutorialAgente } from '@/app/_components/TutorialAgente';
import { Carrusel, EnlaceMaKo } from '@/app/_components/PanelMarketing';
import { SvcIcon, BrandDefs } from '@/app/_components/ServicioVisual';
import { MakoStar } from '@/app/_components/MakoBrand';
import { SLIDES } from '@/lib/servicio-slides';

const MONO = "'Geist Mono', monospace";

export function BotonClaude({ tokenInicial, appUrl }: { tokenInicial: string | null; appUrl: string }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      {/* El logo de Anthropic ya está en el repo como símbolo (`ic-anthropic`), así que
          el botón lleva la marca de verdad y no un ícono genérico. `BrandDefs` monta los
          símbolos: sin él, el <use> no resuelve y se ve un cuadrado de color liso, sin
          error ninguno. */}
      <BrandDefs />
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title="Llevarte tu segundo cerebro a Claude Code"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 9,
          // Fondo oscuro y no el `secondary` de la casa: es un botón de MARCA ajena, y
          // el negro de Anthropic lo separa del resto de la barra sin inventar un color.
          background: '#181818', border: '1px solid #2A2A2A', color: '#F5F4F0',
          borderRadius: 10, padding: '8px 14px', cursor: 'pointer',
          fontFamily: "'Geist', sans-serif", fontSize: 13.5, fontWeight: 600,
          minHeight: 'var(--ctrl-h, 38px)',
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden><use href="#ic-anthropic" /></svg>
        Conectar a Claude
      </button>

      {abierto && (
        <ModalShell w={940} h="min(720px, calc(100dvh - 96px))" label="Conectar a Claude Code" onClose={() => setAbierto(false)}>
          <div className="mk-svc-modal">
            {/* ═══ IZQUIERDA (negra) · qué vas a poder hacer ═══ */}
            <aside className="mk-svc-aside" style={{ display: 'flex', flexDirection: 'column', padding: '26px 24px', minWidth: 0, minHeight: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <MakoStar size={14} color="var(--accent)" />
                <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--sidebar-text)' }}>
                  Con Claude Code conectado
                </span>
              </div>
              <Carrusel slides={SLIDES.agente ?? []} arriba={<EnlaceMaKo k="agente" nombre="Claude Code" />} />
            </aside>

            {/* ═══ DERECHA · el tutorial, el mismo de /integraciones ═══
                Header fijo y el medio scrolleando: si el header no estuviera pinado, el ✕
                se iría con el scroll. */}
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
              <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 13, padding: '22px 26px 16px' }}>
                <SvcIcon k="agente" box={44} radius={12} size={25} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontWeight: 600, fontSize: 20, letterSpacing: '-0.014em', margin: 0, color: 'var(--ink)' }}>Claude Code</h3>
                  <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)', marginTop: 3 }}>
                    Tu segundo cerebro, adentro de tu agente
                  </div>
                </div>
                <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar" style={closeBtn}>✕</button>
              </div>
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 26px 26px' }}>
                <TutorialAgente tokenInicial={tokenInicial} appUrl={appUrl} />
              </div>
            </div>
          </div>
        </ModalShell>
      )}
    </>
  );
}
