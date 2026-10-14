'use client';

// =============================================================================
// OfertaDelLead — a qué OFERTA entró el lead, arriba de su tab Pagos
// =============================================================================
// Pedido de Martín (13/10/2026, Pagos punto 1): «primero deberías poner un desplegable para asignar
// una oferta, o agregar una nueva que se haga desde allí mismo, con unas preguntas mínimas como
// nombre de la oferta, modelo (pago unico, suscripción) y el ticket... Y que una vez creada en el
// desplegable te de la opción de analizar oferta, que ahí, redirija a la tab de offer».
//
// · «Nueva oferta» va ARRIBA del desplegable, como «Nuevo CRM» (lo pidió el mismo día).
// · Crear pregunta tres cosas y nada más, en un modal; el resto de la oferta se arma en Offer.
// · «Analizar oferta» aparece cuando hay una elegida y lleva a Offer con el CRM y la oferta.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Dropdown, type DropdownOption } from '@/app/components/Dropdown';
import { Modal } from '@/app/_ui/Modal';
import { Toast, useToast } from '@/app/_ui/Toast';
import { MODELOS_OFERTA, type ModeloOferta, type OfertaParaLead } from '@/lib/oferta-modelo';
import { ofertasDelLeadAction, asignarOfertaLeadAction, crearOfertaDesdeLeadAction } from '../oferta-lead-actions';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";
const NUEVA = '__nueva__';
const SIN = '__sin__';

const fmtTicket = (o: Pick<OfertaParaLead, 'precio_usd' | 'modelo'>) => {
  if (o.precio_usd == null) return o.modelo === 'suscripcion' ? 'Suscripción' : o.modelo === 'unico' ? 'Pago único' : '';
  const monto = `USD ${o.precio_usd.toLocaleString('en-US')}`;
  return o.modelo === 'suscripcion' ? `${monto} por mes` : o.modelo === 'unico' ? `${monto} · pago único` : monto;
};

export function OfertaDelLead({ leadId, funnelId, onCambio }: {
  leadId: number;
  /** El CRM del lead: Offer abre la oferta debajo de él. */
  funnelId: number | null;
  /** Después de cambiar la oferta: la ficha relee. */
  onCambio?: () => void;
}) {
  const router = useRouter();
  const [ofertas, setOfertas] = useState<OfertaParaLead[] | null>(null);
  const [actual, setActual] = useState<number | null>(null);
  const [puedeCrear, setPuedeCrear] = useState(false);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast, show, clear } = useToast();
  // `onCerrar` de identidad FIJA para el Modal (AGENTS.md).
  const cerrarModal = useCallback(() => setCreando(false), []);

  useEffect(() => {
    let vivo = true;
    void ofertasDelLeadAction(leadId).then((r) => {
      if (!vivo) return;
      if (!r.ok) { setError(r.error); setOfertas([]); return; }
      setOfertas(r.ofertas); setActual(r.actual); setPuedeCrear(r.puedeCrear);
    }).catch(() => { if (vivo) { setError('No se pudieron leer las ofertas.'); setOfertas([]); } });
    return () => { vivo = false; };
  }, [leadId]);

  const elegir = (v: string) => {
    if (v === NUEVA) { setCreando(true); return; }
    const id = v === SIN ? null : Number(v);
    const antes = actual;
    setActual(id);
    void asignarOfertaLeadAction(leadId, id).then((r) => {
      if (!r.ok) { setActual(antes); show(r.error, undefined, 'bad'); return; }
      onCambio?.();
      show(id == null ? 'Sin oferta' : 'Oferta asignada');
    }).catch(() => { setActual(antes); show('No se pudo guardar', undefined, 'bad'); });
  };

  const elegida = ofertas?.find((o) => o.id === actual) ?? null;
  const opciones: DropdownOption[] = [
    ...(puedeCrear ? [{ value: NUEVA, label: 'Nueva oferta', crear: true } as DropdownOption] : []),
    ...(ofertas ?? []).map((o) => ({ value: String(o.id), label: o.nombre, sub: fmtTicket(o) || undefined })),
    ...(actual != null ? [{ value: SIN, label: 'Sin oferta', sutil: true } as DropdownOption] : []),
  ];

  // Offer abre la conversación de esa oferta debajo del CRM del lead.
  const analizar = () => {
    if (!elegida) return;
    const qs = new URLSearchParams({ oferta: String(elegida.id) });
    if (funnelId != null) qs.set('funnel', String(funnelId));
    router.push(`/offer?${qs.toString()}`);
  };

  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 22px', fontFamily: SANS }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 10 }}>Oferta</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Dropdown
          value={actual != null ? String(actual) : ''}
          placeholder={ofertas == null ? 'Cargando…' : 'Elige la oferta'}
          options={opciones}
          onChange={elegir}
          width={300}
          disabled={ofertas == null}
          ariaLabel="La oferta del lead"
        />
        {/* Offer es del admin (requireRolWs([])): a otro rol el link lo rebotaría. */}
        {elegida && puedeCrear && (
          <button type="button" onClick={analizar}
            style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', fontFamily: SANS, fontSize: 13, fontWeight: 650, color: 'var(--primary)' }}>
            Analizar oferta →
          </button>
        )}
      </div>
      {elegida && fmtTicket(elegida) && <div style={{ marginTop: 8, fontSize: 13, color: 'var(--dim)' }}>{fmtTicket(elegida)}</div>}
      {ofertas != null && ofertas.length === 0 && !error && (
        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--faint)' }}>{puedeCrear ? 'Todavía no hay ofertas: crea la primera.' : 'Todavía no hay ofertas.'}</div>
      )}
      {error && <div role="alert" style={{ marginTop: 8, fontSize: 13, color: 'var(--bad)' }}>{error}</div>}
      {creando && (
        <NuevaOferta
          leadId={leadId}
          onCerrar={cerrarModal}
          onCreada={(o) => {
            setOfertas((xs) => [o, ...(xs ?? [])]);
            setActual(o.id);
            setCreando(false);
            onCambio?.();
            show('Oferta creada');
          }}
        />
      )}
      <Toast state={toast} onClose={clear} />
    </section>
  );
}

/** Lo mínimo para crear una oferta: nombre, cómo se cobra y el ticket. */
function NuevaOferta({ leadId, onCerrar, onCreada }: { leadId: number; onCerrar: () => void; onCreada: (o: OfertaParaLead) => void }) {
  const [nombre, setNombre] = useState('');
  const [modelo, setModelo] = useState<ModeloOferta>('unico');
  const [ticket, setTicket] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const crear = () => {
    if (guardando) return;
    const t = ticket.trim() ? Number(ticket.replace(',', '.')) : null;
    if (!nombre.trim()) { setError('Ponle un nombre.'); return; }
    if (t != null && !Number.isFinite(t)) { setError('El ticket tiene que ser un número.'); return; }
    setGuardando(true); setError(null);
    void crearOfertaDesdeLeadAction(leadId, { nombre, modelo, ticket: t }).then((r) => {
      setGuardando(false);
      if (!r.ok) { setError(r.error); return; }
      onCreada(r.oferta);
    }).catch(() => { setGuardando(false); setError('No se pudo crear.'); });
  };

  const campo = { width: '100%', boxSizing: 'border-box' as const, height: 40, padding: '0 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, fontFamily: SANS };
  const rotulo = { display: 'block', fontSize: 12.5, color: 'var(--dim)', marginBottom: 6 };
  return (
    <Modal titulo="Nueva oferta" ancho={440} onCerrar={onCerrar}
      pie={(<>
        <button type="button" onClick={onCerrar} disabled={guardando}
          style={{ padding: '10px 16px', fontSize: 14, color: 'var(--dim)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: SANS }}>Cancelar</button>
        <button type="button" onClick={crear} disabled={guardando}
          style={{ padding: '11px 22px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: guardando ? 'default' : 'pointer', fontFamily: SANS, opacity: guardando ? 0.7 : 1 }}>
          {guardando ? 'Creando…' : 'Crear oferta'}
        </button>
      </>)}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label>
          <span style={rotulo}>Nombre</span>
          <input data-autofocus value={nombre} maxLength={80} onChange={(e) => { setError(null); setNombre(e.target.value); }}
            onKeyDown={(e) => { if (e.key === 'Enter') crear(); }} style={campo} />
        </label>
        <div>
          <span style={rotulo}>Cómo se cobra</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {MODELOS_OFERTA.map((m) => (
              <button key={m.id} type="button" aria-pressed={modelo === m.id} onClick={() => setModelo(m.id)}
                style={{ flex: 1, height: 40, borderRadius: 10, cursor: 'pointer', fontFamily: SANS, fontSize: 14, fontWeight: 600,
                  border: '1px solid ' + (modelo === m.id ? 'var(--primary)' : 'var(--border-strong)'),
                  background: modelo === m.id ? 'var(--primary-weak)' : 'var(--surface-2)', color: 'var(--ink)' }}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <label>
          <span style={rotulo}>{modelo === 'suscripcion' ? 'Ticket por mes (USD)' : 'Ticket (USD)'}</span>
          <input value={ticket} inputMode="decimal" onChange={(e) => { setError(null); setTicket(e.target.value.replace(/[^\d.,]/g, '')); }}
            onKeyDown={(e) => { if (e.key === 'Enter') crear(); }} style={campo} />
        </label>
        {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--bad)', fontWeight: 600 }}>{error}</p>}
      </div>
    </Modal>
  );
}
