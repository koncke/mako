'use client';

// =============================================================================
// LeadEditModal — carga la ficha completa on-demand y la muestra en el PANEL de la derecha
// =============================================================================
// Wrapper fino: trae getLeadFullAction y monta LeadSheet (preview con tabs).
// Para que abrir se sienta instantáneo: (1) cache en memoria por lead (reabrir
// no vuelve a esperar; se refresca en segundo plano), (2) skeleton con los datos
// que el caller ya tiene (seed) mientras llega el resto.
//
// ⚠️ DESDE EL 14/11/2026 NO ES UN MODAL: es el panel que entra por la derecha (lead-view/PanelFicha.tsx), pedido de
// Martín mirando la grabación del CRM de la portada. El nombre se quedó porque lo montan siete pantallas (el tablero,
// Chats, WhatsApp, el Dashboard, los desgloses, la confirmación de MaKo): todas abren el panel sin tocarlas.
// ⚠️ LA CARCASA ES UNA SOLA para el esqueleto, el «no se pudo» y la ficha: cambia lo de adentro, no el panel. Así abrir
// otra tarjeta con el panel abierto cambia la ficha sin que el panel vuelva a entrar desde afuera.

import { useEffect, useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { LeadSheet } from './LeadSheet';
import { getLeadFullAction, type LeadFullData } from './actions';
import { esPaginaVieja, recargarUnaVez, urlParaAbrirLead } from '@/lib/pagina-vieja';
import { PanelFicha } from './lead-view/PanelFicha';
import { Marca } from '@/app/_components/Marca';
import { colorDe } from '@/app/_components/TarjetaEntidad';
import { CSS_CABECERA_LEAD } from './lead-view/CabeceraLead';
import { TAM_CARA_PANEL } from './lead-view/cabecera-panel';

import type { StepId } from '@/lib/stage-requirements';

const SANS = "'Geist', sans-serif";

/** Datos mínimos que el caller puede pasar para pintar el skeleton al instante. */
export type LeadSeed = { nombre: string; empresa?: string | null };

// Cache en memoria (vive lo que la pestaña): reabrir una ficha es instantáneo y
// el fetch corre igual en segundo plano para refrescar.
const cache = new Map<number, LeadFullData>();

export function LeadEditModal({
  leadId,
  seed,
  focus,
  solucionar,
  verDatos,
  avisos,
  onClose,
}: {
  leadId: number;
  seed?: LeadSeed;
  /** Compat con los desgloses: sección pedida → tab del preview. */
  focus?: string;
  /** Abrir YA llevando a ese dato sin marcar (lo pide «A revisar»). */
  solucionar?: StepId;
  /** Abrir con el «Ver» de los datos sin marcar ya desplegado (lo pide «A revisar» desde el 16/10/2026). */
  verDatos?: boolean;
  /** Abrir para elegir qué avisa MaKo (el engranaje de «A revisar», 16/10/2026). */
  avisos?: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [data, setData] = useState<LeadFullData | null>(() => cache.get(leadId) ?? null);
  const [notFound, setNotFound] = useState(false);
  // Reset al cambiar de lead: setState durante render guardado por comparación
  // (patrón React; no dispara el lint de setState-en-effect).
  const [prevLeadId, setPrevLeadId] = useState(leadId);
  if (prevLeadId !== leadId) {
    setPrevLeadId(leadId);
    setData(cache.get(leadId) ?? null);
    setNotFound(false);
  }

  // ⚠️ UNA PESTAÑA DE ANTES DE UN DESPLIEGUE (Leila, 26/10/2026: la ficha de los leads recién extraídos no cargaba sin
  // F5; lib/pagina-vieja.ts). Los de antes abrían desde `cache` y el error se callaba; uno nuevo no está ahí. Se recarga
  // SOLA en la versión nueva, una vez, y abre este mismo lead (`?abrir=`, CrmBoard). Si ya se recargó hace poco, el botón.
  const [vieja, setVieja] = useState(false);
  useEffect(() => {
    let alive = true;
    getLeadFullAction(leadId)
      .then((d) => {
        if (!alive) return;
        if (!d) { cache.delete(leadId); setNotFound(true); return; }
        cache.set(leadId, d);
        setData(d);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        if (esPaginaVieja(e)) {
          if (recargarUnaVez(`ficha-${leadId}`, urlParaAbrirLead(window.location.href, leadId))) return;
          if (!cache.get(leadId)) { setVieja(true); setNotFound(true); }
          return;
        }
        if (!cache.get(leadId)) setNotFound(true);
      });
    return () => { alive = false; };
  }, [leadId]);

  // router.refresh al cerrar: sincroniza la vista de atrás con lo que haya
  // pasado en la ficha (borrado, ediciones desde la ruta).
  const close = () => { router.refresh(); onClose(); };

  // focus viejo de los desgloses → tab del preview.
  // «Ver detalle» de una reunión cercana (CrmBoard, 22/10/2026) abre en «Reuniones».
  const initialTab = focus === 'plan-pagos' ? 'cobranza' : focus === 'reuniones' ? 'reuniones' : 'resumen';

  const nombre = data?.lead.nombre?.trim() || seed?.nombre?.trim() || '';
  return (
    <PanelFicha etiqueta={nombre ? `Ficha de ${nombre}` : 'Ficha del lead'} onCerrar={data ? close : onClose}>
      {(cerrar) => notFound ? (
        <>
          <CabeceraEsqueleto nombre={seed?.nombre ?? ''} bajada={seed?.empresa ?? null} onCerrar={cerrar} />
          <div style={{ padding: '8px 24px', fontFamily: SANS, fontSize: 14, color: 'var(--dim)' }}>
            {vieja ? 'MaKo se actualizó mientras tenías esta página abierta.' : 'No se pudo cargar el lead.'}
            {vieja && <button onClick={() => window.location.assign(urlParaAbrirLead(window.location.href, leadId))} style={{ marginLeft: 10, background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>Recargar</button>}
            <button onClick={cerrar} style={{ marginLeft: 10, background: 'none', border: 'none', color: vieja ? 'var(--dim)' : 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>Cerrar</button>
          </div>
        </>
      ) : !data ? (
        // Skeleton instantáneo con lo que el caller ya sabe del lead: la MISMA cabecera que la ficha (la cara, el nombre),
        // así cuando llega la ficha no salta nada.
        <>
          <CabeceraEsqueleto nombre={seed?.nombre ?? ''} bajada={seed?.empresa ?? null} onCerrar={cerrar} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 24px 0' }}>
            {[44, 120, 160, 90].map((h, i) => (
              <div key={i} style={{ height: h, borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
                <div className="ls-brillo" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent)', animation: 'leadsheet-shimmer 1.2s infinite' }} />
              </div>
            ))}
          </div>
          <style>{'@keyframes leadsheet-shimmer { from { transform: translateX(-100%);} to { transform: translateX(100%);} } @media (prefers-reduced-motion: reduce){ .ls-brillo{ animation:none !important; } }'}</style>
        </>
      ) : (
        // `key`: otro lead es otra ficha (su pestaña, su scroll, sus diálogos), en el MISMO panel.
        <LeadSheet key={data.lead.id} data={data} onClose={cerrar} initialTab={initialTab} solucionarAlAbrir={solucionar} verDatosAlAbrir={verDatos} avisosAlAbrir={avisos} />
      )}
    </PanelFicha>
  );
}

/**
 * La cabecera mientras la ficha carga (o si no cargó): la misma fila que la del panel (lead-view/CabeceraLead.tsx, `panel`),
 * con la cara de las iniciales, el nombre y la empresa que ya sabe quien la abrió, y la cruz (o «Volver» en el teléfono).
 */
function CabeceraEsqueleto({ nombre, bajada, onCerrar }: { nombre: string; bajada: string | null; onCerrar: () => void }) {
  return (
    <div className="cl-cab cl-cab--panel" style={{ flex: 'none', position: 'relative' }}>
      <div className="clp-fila">
        <button type="button" className="clp-volver" aria-label="Volver" title="Volver" onClick={onCerrar}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <span className="clp-cara" aria-hidden style={{ cursor: 'default' }}>
          <Marca nombre={nombre} tam={TAM_CARA_PANEL} color={colorDe(nombre || '·')} />
        </span>
        <span className="clp-txt">
          <span className="cl-nom clp-nom">{nombre || 'Cargando…'}</span>
          {bajada && <span className="clp-bajada">{bajada}</span>}
        </span>
        <button type="button" className="clp-icono clp-x" aria-label="Cerrar" title="Cerrar (Esc)" onClick={onCerrar}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
            strokeLinecap="round" aria-hidden><path d="M6 6 18 18M18 6 6 18" /></svg>
        </button>
      </div>
      <style dangerouslySetInnerHTML={{ __html: CSS_CABECERA_LEAD }} />
    </div>
  );
}
