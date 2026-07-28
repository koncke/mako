'use client';

// =============================================================================
// OnboardingTabs — el hub de "Onboarding" (menú de la foto): cargar el negocio
// =============================================================================
// La "fábrica de creativos" en capas (cada una alimenta la siguiente):
//   Resumen → Diagnóstico → El Archivero → Oferta → Gancho → Avatares → Razones →
//   Ángulos → El funnel.
// · Oferta/Gancho = la capa del negocio (qué vendés + el elemento tangible).
// · Avatares (a quién) → Razones (por qué) → Ángulos (formatos de creativo) = la
//   capa creativa. El funnel va al final (lo último que se configura).
// Cada tab va en el MISMO marco del wizard (`Marco`): panel negro + card scrolleable.
// El Funnel usa su propio editor, sin marco.

import { useState, type CSSProperties, type ReactNode } from 'react';
import { Archivero } from './Archivero';
import { ResumenView } from './ResumenView';
import { DiagnosticoView } from './DiagnosticoView';
import { CamposNegocio } from './CamposNegocio';
import { GanchoView } from './GanchoView';
import { AvataresView } from './AvataresView';
import { RazonesView } from './RazonesView';
import { FormatosView } from './FormatosView';
import { PanelMarketing } from '../_components/PanelMarketing';
import { BrandDefs } from '../_components/ServicioVisual';
import type { Slide } from '@/lib/servicio-slides';

const SANS = "'Geist', sans-serif";
type TabKey = 'resumen' | 'diagnostico' | 'archivero' | 'oferta' | 'gancho' | 'avatares' | 'razones' | 'angulos' | 'funnel';

const SLIDES_RESUMEN: Slide[] = [
  { t: 'MaKo trabaja con TU negocio', d: 'Lo que sale de tus documentos entra en cada análisis y cada respuesta: deja de darte consejos de manual y te habla de lo tuyo.' },
  { t: 'La prueba, no la promesa', d: 'A medida que subes documentos, MaKo va entendiendo tu negocio y te lo muestra acá, en prosa.' },
];
const SLIDES_DIAG: Slide[] = [
  { t: 'Primero, dónde estás parado', d: 'Seis preguntas rápidas y MaKo sabe en qué fase está tu negocio y cuál es tu cuello de botella real.' },
  { t: 'Un solo Norte', d: 'Cada fase tiene un foco. El diagnóstico te dice qué priorizar ahora y qué dejar para después.' },
];
const SLIDES_DOCS: Slide[] = [
  { t: 'MaKo trabaja con TU negocio', d: 'Lo que sale de tus documentos entra en cada análisis y cada respuesta: deja de darte consejos de manual y te habla de lo tuyo.' },
  { t: 'Subís y todo se arma solo', d: 'Al subir tus documentos, MaKo arma tu perfil y, si están vacíos, propone también tus avatares y tus razones.' },
];
const SLIDES_OFERTA: Slide[] = [
  { t: 'Tu oferta, en claro', d: 'Lo que vendes, tu promesa y tu precio — extraído de tus documentos y listo para corregir.' },
  { t: 'La base de todo', d: 'De acá salen las razones y los creativos. Cuanto más afinada tu oferta, mejor te vende MaKo.' },
];
const SLIDES_GANCHO: Slide[] = [
  { t: 'El elemento que se ve', d: 'Casi toda oferta tiene algo tangible —un dashboard, una planilla, una metodología— que la hace entendible al instante.' },
  { t: 'El motor del FOMO', d: 'Ese gancho es lo que genera curiosidad en tus anuncios: "si no logras X, es porque te falta ESTO".' },
];
const SLIDES_AVATARES: Slide[] = [
  { t: 'Primero, ¿a quién le hablas?', d: 'No le vendes a "todos", sino a segmentos distintos que podrías targetear por separado en Meta.' },
  { t: 'Tres segmentos, no un retrato', d: 'MaKo propone 3 avatares por industria, tamaño, rol o zona — y te hace preguntas para afinarlos.' },
];
const SLIDES_RAZONES: Slide[] = [
  { t: 'El anuncio no se inventa, se encuentra', d: 'Las razones son las distintas motivos por los que tu cliente te compra: un dolor, un deseo, una explicación.' },
  { t: 'La matriz: avatar × razón', d: 'Para cada avatar, 3 razones. Es la tabla de la que después salen los creativos. Toca una celda para ver el detalle.' },
];
const SLIDES_ANGULOS: Slide[] = [
  { t: 'El mismo mensaje, muchas formas', d: 'Un ángulo es el FORMATO del creativo: una comparación, un testimonio con capturas, una demo…' },
  { t: 'MaKo elige de la biblioteca', d: 'De una biblioteca de formatos de imagen y video, MaKo elige los que mejor le pegan a tus razones y tu gancho.' },
];

// Marco partido del wizard (grid .mk-svc-modal): panel negro + card blanca scrolleable.
function Marco({ slides, children }: { slides: Slide[]; children: ReactNode }) {
  return (
    <>
      <BrandDefs />
      {/* Alto FIJO: el modal no se estira con el contenido; la columna blanca scrollea. */}
      <div className="mk-svc-modal" style={{ maxWidth: 980, margin: '0 auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden', height: 'min(720px, calc(100vh - 150px))' }}>
        <PanelMarketing servicioKey="landing" nombre="MaKo" slides={slides} eyebrow="✦ Así trabaja MaKo" />
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto', padding: '30px clamp(20px,4vw,40px)' }}>
          {children}
        </div>
      </div>
    </>
  );
}

function OfertaFrame() {
  return <Marco slides={SLIDES_OFERTA}><CamposNegocio titulo="Tu oferta" subtitulo="Lo que MaKo entendió de tu negocio y tu oferta. Toca cualquier dato para corregirlo." keys={['negocio_que_hace']} prefijos={['oferta_']} /></Marco>;
}

export function OnboardingTabs({ funnelPanel }: { funnelPanel: ReactNode }) {
  const [tab, setTab] = useState<TabKey>('resumen');
  const TABS: Array<{ key: TabKey; label: string; panel: ReactNode }> = [
    { key: 'resumen', label: 'Resumen', panel: <Marco slides={SLIDES_RESUMEN}><ResumenView /></Marco> },
    { key: 'diagnostico', label: 'Diagnóstico', panel: <Marco slides={SLIDES_DIAG}><DiagnosticoView /></Marco> },
    { key: 'archivero', label: 'El Archivero', panel: <Marco slides={SLIDES_DOCS}><Archivero /></Marco> },
    { key: 'oferta', label: 'Oferta', panel: <OfertaFrame /> },
    { key: 'gancho', label: 'Gancho', panel: <Marco slides={SLIDES_GANCHO}><GanchoView /></Marco> },
    { key: 'avatares', label: 'Avatares', panel: <Marco slides={SLIDES_AVATARES}><AvataresView /></Marco> },
    { key: 'razones', label: 'Razones', panel: <Marco slides={SLIDES_RAZONES}><RazonesView /></Marco> },
    { key: 'angulos', label: 'Ángulos', panel: <Marco slides={SLIDES_ANGULOS}><FormatosView /></Marco> },
    { key: 'funnel', label: 'El funnel', panel: funnelPanel },
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
