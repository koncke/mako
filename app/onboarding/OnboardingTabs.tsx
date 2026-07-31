'use client';

// =============================================================================
// OnboardingTabs — el hub de "Onboarding": la fábrica de creativos en capas
// =============================================================================
//   Matriz → Diagnóstico → El Archivero → Oferta → Entregable → Persona →
//   Avatares → Razones → Ángulos → El funnel.
// · Matriz (primero): la salida — el grid avatar × razón, cada celda un anuncio.
// · Archivero: los documentos + el Resumen adentro (sub-toggle).
// · Oferta/Entregable/Persona = la capa del negocio. Avatares(a quién) → Razones
//   (por qué, las motivaciones) → Ángulos (formatos) = la capa creativa.
// Cada tab va en el marco del wizard (panel negro + card scrolleable). Funnel: aparte.

import { useState, type CSSProperties, type ReactNode } from 'react';
import { Archivero } from './Archivero';
import { MatrizView } from './MatrizView';
import { DiagnosticoView } from './DiagnosticoView';
import { CamposNegocio } from './CamposNegocio';
import { EntregableView } from './EntregableView';
import { PersonaView } from './PersonaView';
import { PersonalidadView } from './PersonalidadView';
import { AvataresView } from './AvataresView';
import { RazonesView } from './RazonesView';
import { FormatosView } from './FormatosView';
import { PanelMarketing } from '../_components/PanelMarketing';
import { BrandDefs } from '../_components/ServicioVisual';
import type { Slide } from '@/lib/servicio-slides';

const SANS = "'Geist', sans-serif";
type TabKey = 'matriz' | 'diagnostico' | 'archivero' | 'oferta' | 'entregable' | 'persona' | 'personalidad' | 'avatares' | 'razones' | 'angulos' | 'funnel';

const SLIDES_MATRIZ: Slide[] = [
  { t: 'Tu fábrica de anuncios', d: 'La matriz cruza tus avatares con sus razones de compra. Cada celda es un anuncio listo para producir.' },
  { t: 'Todo en un clic', d: 'Toca una celda y ves el contexto, el copy, el guion y —pronto— la imagen y el video de ese anuncio.' },
];
const SLIDES_DIAG: Slide[] = [
  { t: 'Primero, dónde estás parado', d: 'Seis preguntas rápidas y MaKo sabe en qué fase está tu negocio y cuál es tu cuello de botella real.' },
  { t: 'Un solo Norte', d: 'Cada fase tiene un foco. El diagnóstico te dice qué priorizar ahora y qué dejar para después.' },
];
const SLIDES_DOCS: Slide[] = [
  { t: 'MaKo trabaja con TU negocio', d: 'Lo que sale de tus documentos entra en cada análisis: deja de darte consejos de manual y te habla de lo tuyo.' },
  { t: 'Subís y todo se arma solo', d: 'Al subir tus documentos, MaKo arma tu perfil y, si están vacíos, propone también tus avatares y tus razones.' },
];
const SLIDES_OFERTA: Slide[] = [
  { t: 'Tu oferta, en claro', d: 'Lo que vendes, tu promesa y tu precio — extraído de tus documentos y listo para corregir.' },
  { t: 'La base de todo', d: 'De acá salen las razones y los creativos. Cuanto más afinada tu oferta, mejor te vende MaKo.' },
];
const SLIDES_ENTREGABLE: Slide[] = [
  { t: 'El elemento que se ve', d: 'Casi toda oferta tiene algo tangible —un dashboard, una planilla, una metodología— que la hace entendible al instante.' },
  { t: 'El motor del FOMO', d: 'Ese lead magnet es lo que genera curiosidad en tus anuncios: "si no logras X, es porque te falta ESTO".' },
];
const SLIDES_TONO: Slide[] = [
  { t: 'Que suene a TI', d: 'Un quiz corto con frases reales de anuncio: eliges la que dirias tu, y MaKo descubre tu voz.' },
  { t: 'Anuncios humanos', d: 'Un guion con tu voz no parece hecho por una IA: parece tuyo. Eso es lo que hace que la gente se quede a verlo.' },
];
const SLIDES_PERSONA: Slide[] = [
  { t: 'La cara de tus anuncios', d: 'Sube fotos de la persona que aparece en tus creativos y describí su estilo.' },
  { t: 'Para generar imágenes', d: 'MaKo usa esas fotos y la descripción para generar las imágenes de tus anuncios con esa persona.' },
];
const SLIDES_AVATARES: Slide[] = [
  { t: 'Primero, ¿a quién le hablas?', d: 'No le vendes a "todos", sino a segmentos distintos que podrías targetear por separado en Meta.' },
  { t: 'Tres segmentos, no un retrato', d: 'MaKo propone 3 avatares por industria, tamaño, rol o zona — y te hace preguntas para afinarlos.' },
];
const SLIDES_RAZONES: Slide[] = [
  { t: 'Por qué te compran', d: 'Un mismo avatar compra por motivos distintos (curso de inglés: un mejor salario, un viaje, un ascenso).' },
  { t: 'A fondo, no un hook', d: 'MaKo encuentra las motivaciones reales de cada avatar. El copy de cada una vive en la Matriz.' },
];
const SLIDES_ANGULOS: Slide[] = [
  { t: 'El mismo mensaje, muchas formas', d: 'Un ángulo es el FORMATO del creativo: una comparación, un testimonio con capturas, una demo…' },
  { t: 'MaKo elige de la biblioteca', d: 'De una biblioteca de formatos de imagen y video, MaKo elige los que mejor le pegan a tus razones y tu lead magnet.' },
];

// Marco partido del wizard (grid .mk-svc-modal): panel negro + card blanca scrolleable.
function Marco({ slides, children }: { slides: Slide[]; children: ReactNode }) {
  return (
    <>
      <BrandDefs />
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
  const [tab, setTab] = useState<TabKey>('matriz');
  const TABS: Array<{ key: TabKey; label: string; panel: ReactNode }> = [
    { key: 'matriz', label: 'Matriz', panel: <Marco slides={SLIDES_MATRIZ}><MatrizView /></Marco> },
    { key: 'diagnostico', label: 'Diagnóstico', panel: <Marco slides={SLIDES_DIAG}><DiagnosticoView /></Marco> },
    { key: 'archivero', label: 'El Archivero', panel: <Marco slides={SLIDES_DOCS}><Archivero /></Marco> },
    { key: 'oferta', label: 'Oferta', panel: <OfertaFrame /> },
    { key: 'entregable', label: 'Lead Magnet', panel: <Marco slides={SLIDES_ENTREGABLE}><EntregableView /></Marco> },
    { key: 'persona', label: 'Persona', panel: <Marco slides={SLIDES_PERSONA}><PersonaView /></Marco> },
    { key: 'personalidad', label: 'Personalidad', panel: <Marco slides={SLIDES_TONO}><PersonalidadView /></Marco> },
    { key: 'avatares', label: 'Avatares', panel: <Marco slides={SLIDES_AVATARES}><AvataresView /></Marco> },
    { key: 'razones', label: 'Razones', panel: <Marco slides={SLIDES_RAZONES}><RazonesView /></Marco> },
    { key: 'angulos', label: 'Ángulos', panel: <Marco slides={SLIDES_ANGULOS}><FormatosView /></Marco> },
    { key: 'funnel', label: 'El funnel', panel: funnelPanel },
  ];
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
