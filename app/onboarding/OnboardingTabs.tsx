'use client';

// =============================================================================
// OnboardingTabs — el hub de "Onboarding" (menú de la foto): cargar el negocio
// =============================================================================
// El Archivero (soltá tus docs) + Funnel (cómo vendés) + Ángulos y avatares (el
// vocabulario). Tabs tipo píldora (igual que /plan). El Archivero va dentro del
// MISMO marco del wizard: panel negro "así trabaja MaKo" (que se llena con lo que
// MaKo va entendiendo) + la card a la derecha.

import { useState, type CSSProperties, type ReactNode } from 'react';
import { Archivero } from './Archivero';
import { AngulosPanel } from '../configuraciones/AngulosPanel';
import { PanelMarketing, type Fact } from '../_components/PanelMarketing';
import { BrandDefs } from '../_components/ServicioVisual';
import type { Slide } from '@/lib/servicio-slides';

const SANS = "'Geist', sans-serif";
type TabKey = 'archivero' | 'funnel' | 'angulos';

const SLIDES: Slide[] = [
  { t: 'MaKo trabaja con TU negocio', d: 'Lo que sale de tus documentos entra en cada análisis y cada respuesta: deja de darte consejos de manual y te habla de lo tuyo.' },
  { t: 'De tus documentos a tus ángulos', d: 'Tu avatar, tu oferta y tu nicho son la materia prima con la que MaKo arma los ángulos de tus anuncios.' },
  { t: 'La prueba, no la promesa', d: 'A medida que subes documentos, MaKo va entendiendo tu negocio y te lo muestra a la derecha.' },
];

// El Archivero dentro del marco partido del wizard (mismo grid .mk-svc-modal).
function ArchiveroFrame() {
  const [facts, setFacts] = useState<Fact[]>([]);
  return (
    <>
      <BrandDefs />
      {/* Alto FIJO: el modal no se estira con el contenido; la columna blanca scrollea. */}
      <div className="mk-svc-modal" style={{ maxWidth: 980, margin: '0 auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden', height: 'min(720px, calc(100vh - 150px))' }}>
        <PanelMarketing servicioKey="landing" nombre="MaKo" slides={SLIDES} facts={facts} eyebrow="✦ Así trabaja MaKo" />
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto', padding: '30px clamp(20px,4vw,40px)' }}>
          <Archivero onFacts={(f) => setFacts(f)} />
        </div>
      </div>
    </>
  );
}

export function OnboardingTabs({ funnelPanel }: { funnelPanel: ReactNode }) {
  const [tab, setTab] = useState<TabKey>('archivero');
  const TABS: Array<{ key: TabKey; label: string; panel: ReactNode }> = [
    { key: 'archivero', label: 'El Archivero', panel: <ArchiveroFrame /> },
    { key: 'funnel', label: 'Funnel', panel: funnelPanel },
    { key: 'angulos', label: 'Ángulos y avatares', panel: <AngulosPanel /> },
  ];
  // Tabs tipo píldora, mismo control segmentado que el board /plan.
  const pill = (on: boolean): CSSProperties => ({ border: 'none', background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--ink)' : 'var(--dim)', fontWeight: on ? 600 : 500, fontSize: 13.5, padding: '7px 15px', borderRadius: 999, cursor: 'pointer', boxShadow: on ? '0 1px 2px rgba(18,21,27,.08)' : 'none', fontFamily: SANS });
  const activo = TABS.find((t) => t.key === tab);
  return (
    <div>
      <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 999, padding: 3, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map((t) => <button key={t.key} type="button" onClick={() => setTab(t.key)} style={pill(tab === t.key)}>{t.label}</button>)}
      </div>
      {activo?.panel}
    </div>
  );
}
