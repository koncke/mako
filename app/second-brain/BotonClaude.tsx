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
// a Claude. El lugar donde alguien entiende para qué conectarlo es mirando el mapa de lo
// que MaKo sabe de él.
// =============================================================================

import { useState } from 'react';
import { ClaudeMark } from '@/app/_components/icons';
import { ModalShell, closeBtn } from '@/app/_components/ModalShell';
import { TutorialAgente } from '@/app/_components/TutorialAgente';
import { Carrusel, EnlaceMaKo } from '@/app/_components/PanelMarketing';
import { SvcIcon, BrandDefs } from '@/app/_components/ServicioVisual';
import { MakoStar } from '@/app/_components/MakoBrand';
import { SLIDES } from '@/lib/servicio-slides';
import type { TokenAgenteVisible } from '@/lib/agente-token-nucleo';

const MONO = "'Geist Mono', monospace";

export function BotonClaude({ actual, appUrl }: { actual: TokenAgenteVisible | null; appUrl: string }) {
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
        title="Llevarte tu segundo cerebro a Claude"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 9,
          // Fondo oscuro y no el `secondary` de la casa: es un botón de MARCA ajena, y
          // el negro la separa del resto de la barra sin inventar un color.
          // ⚠️ El borde sube a #3A3A3A desde que la pantalla es oscura: contra el #22262E
          // del fondo, el #2A2A2A original daba 1,1:1 y el botón se leía como un agujero
          // sin bordes en vez de como un botón.
          background: '#181818', border: '1px solid #3A3A3A', color: '#F5F4F0',
          borderRadius: 10, padding: '8px 14px', cursor: 'pointer',
          fontFamily: "'Geist', sans-serif", fontSize: 13.5, fontWeight: 600,
          minHeight: 'var(--ctrl-h, 38px)',
        }}
      >
        {/* La ráfaga de CLAUDE, no el logotipo de Anthropic. Acá se conecta con el
            producto, no con la empresa. */}
        {/* Más grande que la tipografía, no más chico: un logo de 15 al lado de un
            rótulo de 13,5 se lee como una viñeta, no como una marca. */}
        <ClaudeMark size={20} />
        Conectar a Claude
      </button>

      {abierto && (
        <ModalShell w={940} h="min(720px, calc(100dvh - 96px))" label="Conectar a Claude" onClose={() => setAbierto(false)}>
          <div className="mk-svc-modal">
            {/* ═══ IZQUIERDA (negra) · qué vas a poder hacer ═══ */}
            <aside className="mk-svc-aside" style={{ display: 'flex', flexDirection: 'column', padding: '26px 24px', minWidth: 0, minHeight: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <MakoStar size={14} color="var(--accent)" />
                <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--sidebar-text)' }}>
                  Con Claude conectado
                </span>
              </div>
              <Carrusel slides={SLIDES.agente ?? []} arriba={<EnlaceMaKo k="agente" nombre="Claude" />} />
            </aside>

            {/* ═══ DERECHA · el tutorial, el mismo de /integraciones ═══
                Header fijo y el medio scrolleando: si el header no estuviera pinado, el ✕
                se iría con el scroll. */}
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
              <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 13, padding: '22px 26px 16px' }}>
                <SvcIcon k="agente" box={44} radius={12} size={25} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontWeight: 600, fontSize: 20, letterSpacing: '-0.014em', margin: 0, color: 'var(--ink)' }}>Claude</h3>
                  <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)', marginTop: 3 }}>
                    Tu negocio, adentro de Claude
                  </div>
                </div>
                <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar" style={closeBtn}>✕</button>
              </div>
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 26px 26px' }}>
                <TutorialAgente actual={actual} appUrl={appUrl} />
              </div>
            </div>
          </div>
        </ModalShell>
      )}
    </>
  );
}
