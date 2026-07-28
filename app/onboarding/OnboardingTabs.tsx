'use client';

// =============================================================================
// OnboardingTabs — el hub de "Onboarding" (menú de la foto): cargar el negocio
// =============================================================================
// El Archivero (soltá tus docs) + Funnel (cómo vendés) + Ángulos (los 3 ángulos de
// venta). Tabs tipo píldora (igual que /plan). El Archivero y Ángulos van dentro del
// MISMO marco del wizard (`Marco`): panel negro "así trabaja MaKo" + la card a la
// derecha (scrolleable). El vocabulario de ángulos del analista (taxonomía) NO vive
// más acá — quedó fuera para no ensuciar la vista; si se quiere editar, va a /configuraciones.

import { useState, type CSSProperties, type ReactNode } from 'react';
import { Archivero } from './Archivero';
import { AvataresView } from './AvataresView';
import { AngulosView } from './AngulosView';
import { PanelMarketing, type Fact } from '../_components/PanelMarketing';
import { BrandDefs } from '../_components/ServicioVisual';
import type { Slide } from '@/lib/servicio-slides';

const SANS = "'Geist', sans-serif";
type TabKey = 'archivero' | 'funnel' | 'avatares' | 'angulos';

const SLIDES: Slide[] = [
  { t: 'MaKo trabaja con TU negocio', d: 'Lo que sale de tus documentos entra en cada análisis y cada respuesta: deja de darte consejos de manual y te habla de lo tuyo.' },
  { t: 'De tus documentos a tus ángulos', d: 'Tu avatar, tu oferta y tu nicho son la materia prima con la que MaKo arma los ángulos de tus anuncios.' },
  { t: 'La prueba, no la promesa', d: 'A medida que subes documentos, MaKo va entendiendo tu negocio y te lo muestra a la derecha.' },
];

const SLIDES_AVATARES: Slide[] = [
  { t: 'Primero, ¿a quién le hablas?', d: 'El anuncio ganador arranca por el avatar: no le vendes a "todos", sino a subnichos distintos que te compran por razones diferentes.' },
  { t: 'Tres personas, no una', d: 'MaKo propone 3 avatares de tu negocio — el que no delega, el que ya se quemó, el que crece sin control — cada uno con su dolor.' },
  { t: 'La base de tus ángulos', d: 'Tus avatares son las filas de la matriz: para cada uno, MaKo encuentra después 3 razones de compra.' },
];

const SLIDES_ANGULOS: Slide[] = [
  { t: 'El anuncio no se inventa, se encuentra', d: 'De lo que ya dice tu negocio, MaKo encuentra los ángulos: las distintas razones por las que tu cliente te compra.' },
  { t: 'La matriz: avatar × razón', d: 'Para cada avatar, 3 ángulos — un dolor, un deseo y una explicación. Son los anuncios que testeas para que el mercado elija al ganador.' },
  { t: 'Cada ángulo, un creativo', d: 'Cada celda de la matriz es la puerta a un anuncio distinto. Los revisas, los ajustas, y después se vuelven creativos.' },
];

// Marco partido del wizard (grid .mk-svc-modal): panel negro + card blanca scrolleable.
function Marco({ slides, facts, children }: { slides: Slide[]; facts?: Fact[]; children: ReactNode }) {
  return (
    <>
      <BrandDefs />
      {/* Alto FIJO: el modal no se estira con el contenido; la columna blanca scrollea. */}
      <div className="mk-svc-modal" style={{ maxWidth: 980, margin: '0 auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden', height: 'min(720px, calc(100vh - 150px))' }}>
        <PanelMarketing servicioKey="landing" nombre="MaKo" slides={slides} facts={facts} eyebrow="✦ Así trabaja MaKo" />
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto', padding: '30px clamp(20px,4vw,40px)' }}>
          {children}
        </div>
      </div>
    </>
  );
}

function ArchiveroFrame() {
  const [facts, setFacts] = useState<Fact[]>([]);
  return <Marco slides={SLIDES} facts={facts}><Archivero onFacts={setFacts} /></Marco>;
}
function AvataresFrame() {
  return <Marco slides={SLIDES_AVATARES}><AvataresView /></Marco>;
}
function AngulosFrame() {
  return <Marco slides={SLIDES_ANGULOS}><AngulosView /></Marco>;
}

export function OnboardingTabs({ funnelPanel }: { funnelPanel: ReactNode }) {
  const [tab, setTab] = useState<TabKey>('archivero');
  const TABS: Array<{ key: TabKey; label: string; panel: ReactNode }> = [
    { key: 'archivero', label: 'El Archivero', panel: <ArchiveroFrame /> },
    { key: 'funnel', label: 'Funnel', panel: funnelPanel },
    { key: 'avatares', label: 'Avatares', panel: <AvataresFrame /> },
    { key: 'angulos', label: 'Ángulos', panel: <AngulosFrame /> },
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
