'use client';

// =============================================================================
// AgendarLlamada — «Crear › Agendar llamada»: la página de reserva del negocio (Calendly o Cal.com), sin salir de acá
// =============================================================================
// Martín, 14/10/2026: «Como agregar el calendly o cal, para agendar llamadas». El link sale del server
// (`linkDeAgendaAction` → lib/agenda-link.ts) con las credenciales de ESTE negocio, nunca de una constante.
//
// Lo que no se ve en la firma:
//   · LA RESERVA NO SE ESCRIBE DESDE ACÁ. Se reserva en la página de Calendly o Cal.com (la persona, o su prospecto con
//     el link copiado) y el webhook de cada uno la mete en el CRM; el Calendario la dibuja en «Llamadas». Por eso al
//     reservar por el popup de Calendly se vuelve a leer la pantalla un rato después (`onAgendada`): el webhook tarda.
//   · CALENDLY SE ABRE EN SU POPUP, encima de la tab (el mismo de «Agendarla por Calendly» del CRM). Cal.com, en otra
//     pestaña: no hay un widget suyo en el repo y su página no se mide embebida.
//   · Sin Calendly ni Cal.com, ofrece CONECTARLOS con el modal de /integraciones (`onConectar`), ahí mismo.

import { useEffect, useState, type CSSProperties } from 'react';
import { Modal } from '@/app/_ui/Modal';
import { Button } from '@/app/_ui/Button';
import { Spinner } from '@/app/_ui';
import { openCalendlyEn } from '@/app/crm/calendly-widget';
import { linkDeAgendaAction } from './actions';
import type { LinkDeAgenda, ProveedorAgenda } from '@/lib/agenda-link';

const NOMBRE: Record<ProveedorAgenda, string> = { calendly: 'Calendly', calcom: 'Cal.com' };

export function AgendarLlamada({ onCerrar, onAgendada, onConectar, onCopiado }: {
  onCerrar: () => void;
  /** Se reservó por el popup de Calendly: la pantalla avisa y vuelve a leer. */
  onAgendada: () => void;
  /** Abrir el modal de esa integración (Calendly o Cal.com) en la tab. */
  onConectar: (servicio: ProveedorAgenda) => void;
  onCopiado: () => void;
}) {
  const [cual, setCual] = useState<'R1' | 'R2'>('R1');
  const [link, setLink] = useState<LinkDeAgenda | null>(null);

  useEffect(() => {
    let vivo = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLink(null);
    linkDeAgendaAction(cual)
      .then((r) => { if (vivo) setLink(r); })
      .catch(() => { if (vivo) setLink({ ok: false, motivo: 'Sin conexión. Prueba de nuevo.', faltan: [] }); });
    return () => { vivo = false; };
  }, [cual]);

  const abrir = () => {
    if (!link?.ok) return;
    if (link.proveedor === 'calendly') {
      onCerrar();
      void openCalendlyEn(link.url, { onScheduled: onAgendada });
      return;
    }
    window.open(link.url, '_blank', 'noopener,noreferrer');
  };
  const copiar = () => {
    if (!link?.ok) return;
    void navigator.clipboard?.writeText(link.url).then(onCopiado).catch(() => { /* sin portapapeles: el link está a la vista */ });
  };

  return (
    <Modal titulo="Agendar llamada" ancho={480} onCerrar={onCerrar}
      pie={link?.ok ? (
        <>
          <Button variant="secondary" onClick={copiar}>Copiar link</Button>
          <Button variant="primary" onClick={abrir}>Abrir la agenda</Button>
        </>
      ) : undefined}>
      <div data-agendar-llamada="" style={S.todo}>
        <div role="group" aria-label="Qué reunión" style={S.grupo}>
          {(['R1', 'R2'] as const).map((c) => (
            <button key={c} type="button" aria-pressed={cual === c} onClick={() => setCual(c)} style={{ ...S.opcion, ...(cual === c ? S.opcionSi : null) }}>
              {c === 'R1' ? 'Primera reunión' : 'Segunda reunión'}
            </button>
          ))}
        </div>
        {link == null ? (
          <div style={S.fila}><Spinner size={14} /><span style={S.dim}>Buscando tu agenda…</span></div>
        ) : link.ok ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={S.dim}>{link.reunion ? `${NOMBRE[link.proveedor]} · ${link.reunion}` : NOMBRE[link.proveedor]}</span>
            <a href={link.url} target="_blank" rel="noopener noreferrer" style={S.link}>{link.url}</a>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--ink)' }}>{link.motivo}</p>
            {link.faltan.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {link.faltan.map((s) => (
                  <Button key={s} variant="secondary" size="sm" onClick={() => onConectar(s)}>{`Conectar ${NOMBRE[s]}`}</Button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

const S: Record<string, CSSProperties> = {
  todo: { display: 'flex', flexDirection: 'column', gap: 16 },
  grupo: { display: 'inline-flex', alignSelf: 'flex-start', border: '1px solid var(--border-strong)', borderRadius: 10, overflow: 'hidden' },
  opcion: { appearance: 'none', border: 0, background: 'var(--surface)', color: 'var(--dim)', font: 'inherit', fontSize: 13, fontWeight: 600, padding: '7px 12px', cursor: 'pointer' },
  opcionSi: { background: 'var(--primary)', color: '#fff' },
  fila: { display: 'flex', alignItems: 'center', gap: 8 },
  dim: { fontSize: 13, color: 'var(--dim)' },
  link: { fontSize: 13.5, color: 'var(--primary)', wordBreak: 'break-all', textDecoration: 'none', fontWeight: 600 },
};
