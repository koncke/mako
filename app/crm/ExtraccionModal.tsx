'use client';

// =============================================================================
// ExtraccionModal — «Extrayendo…» y la confirmación de «Extraer» de un grupo de WhatsApp (30/10/2026)
// =============================================================================
// Martín, 30/10/2026: «en el CRM debe aparecer un modal que diga "scrapeando" o algo así... Y al finalizar un mensaje de
// confirmación, algo que se sepa que ya funcionó». El estado es de lib/extraccion-estado.ts, no de este modal: lo monta el tablero,
// así que sobrevive a cerrar el Scraper y, con `sessionStorage`, a una recarga.
//
// ES OTRO `Modal`, ENCIMA del Scraper (la regla de docs/hallazgos-crm.md, «"Nuevo lead" y sus hijos»): cerrarlo vuelve a la lista,
// lista para el grupo siguiente. Mientras corre no se cierra (`sinCerrar`, ni el clic afuera ni Escape): se PARA. Antes un clic
// afuera desmontaba el Scraper y la extracción seguía sin que nada lo dijera.
// =============================================================================

import { useEffect, useRef, type CSSProperties } from 'react';
import { Button, Modal } from '@/app/_ui';
import { CargandoMako } from '@/app/_ui/CargandoMako';
import { Icon } from '@/app/_components/icons';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { avisarExtraccion } from '@/lib/wa-fichas-cliente';
import { cerrarExtraccion, pararExtraccion, useExtraccion, type TonoExtraccion } from '@/lib/extraccion-estado';
import { miles } from './traer-seleccion';

const SANS = "'Geist', sans-serif";
const centro: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10, padding: '18px 8px 10px', fontFamily: SANS };
const COLOR: Readonly<Record<TonoExtraccion, string>> = { ok: 'var(--good)', vacio: 'var(--dim)', mal: 'var(--bad)' };

export function ExtraccionModal({ funnel, onVerCrm, onOtroGrupo }: {
  /** El CRM que se mira: una extracción de otro CRM no aparece acá (punto 16 del 24/10). */
  funnel: number | null;
  /** «Ver en el CRM»: cierra también el Scraper y el alta. */
  onVerCrm: () => void;
  /** Vuelve al Scraper. Después de una recarga no hay ninguno abajo: lo abre. */
  onOtroGrupo: () => void;
}) {
  const e = useExtraccion();
  // Una corrida que la recarga cortó: la extensión deja de andar en WhatsApp Web y vuelve a esta pestaña.
  const avisada = useRef<string | null>(null);
  useEffect(() => {
    if (e?.estado !== 'interrumpida' || avisada.current === e.id) return;
    avisada.current = e.id;
    avisarExtraccion(e.id, { estado: 'error', texto: 'La página de MaKo se recargó.' });
  }, [e?.estado, e?.id]);

  if (!e || e.funnel !== funnel) return null;
  const corre = e.estado === 'corriendo';
  const r = e.resultado;

  if (corre) {
    return (
      <Modal titulo={`Extrayendo de «${e.grupo}»`} ancho={480} onCerrar={ignorar} sinCerrar
        pie={<Button variant="secondary" onClick={pararExtraccion} disabled={e.parando}>{e.parando ? 'Parando…' : 'Parar'}</Button>}>
        <div style={centro}>
          <CargandoMako que="la extracción" alto={120} size={56} />
          <p role="status" style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{e.texto}</p>
          {e.total > 0 && (
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--dim)' }}>{miles(e.nuevos)} de {miles(e.total)} leads en tu CRM</p>
          )}
          <p style={{ margin: 0, fontSize: 13, color: 'var(--faint)' }}>Al terminar vuelves a MaKo solo.</p>
        </div>
      </Modal>
    );
  }

  if (!r) return null;
  const hayLeads = r.tono === 'ok' || e.nuevos > 0;
  const otro = () => { cerrarExtraccion(); onOtroGrupo(); };
  return (
    <Modal titulo={`Extracción de «${e.grupo}»`} ancho={480} onCerrar={cerrarExtraccion}
      pie={(
        <>
          <Button variant={hayLeads ? 'secondary' : 'primary'} onClick={otro}>{r.tono === 'mal' ? 'Intentar de nuevo' : 'Extraer otro grupo'}</Button>
          {hayLeads && <Button variant="primary" onClick={() => { cerrarExtraccion(); onVerCrm(); }}>Ver en el CRM</Button>}
        </>
      )}>
      <div style={centro}>
        <span aria-hidden style={{ width: 48, height: 48, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: COLOR[r.tono], border: `2px solid ${COLOR[r.tono]}` }}>
          {r.tono === 'vacio' ? <span style={{ fontSize: 22, lineHeight: 1 }}>–</span> : <Icon name={r.tono === 'ok' ? 'check' : 'x'} size={22} />}
        </span>
        <p role={r.tono === 'mal' ? 'alert' : 'status'} style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>{r.titulo}<ReportarASoporte /></p>
        {r.detalle && <p style={{ margin: 0, fontSize: 14, color: 'var(--dim)' }}>{r.detalle}</p>}
        {r.chips.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 4 }}>
            {r.chips.map((c) => (
              <span key={c} style={{ fontSize: 12.5, color: 'var(--dim)', border: '1px solid var(--border)', borderRadius: 999, padding: '3px 10px' }}>{c}</span>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Mientras corre, el clic afuera y Escape no hacen nada. De identidad fija (AGENTS.md: todo `Modal` recibe un `onCerrar` estable). */
function ignorar(): void { /* se para con «Parar» */ }
