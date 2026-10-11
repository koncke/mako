'use client';

// =============================================================================
// ListaCobrosMako — lo que MaKo cobró, y en qué quedó la cuenta de cada comprador
// =============================================================================
// Una fila por cobro del workspace de la plataforma: quién, qué plan, cuánto, el estado del COBRO y
// el estado del ALTA. Son dos estados y no uno a propósito: un cobro puede estar pagado y la cuenta
// no haberse creado (el email ya era de otra cuenta, o el alta falló), y eso es justo lo que hay que
// ver acá para resolverlo a mano.
//
// ⚠️ REEMBOLSAR DEVUELVE PLATA REAL y no se reintenta solo: pasa por una confirmación, y si la
// pasarela lo rechaza, el motivo queda a la vista (no un «no se pudo» genérico). La cuenta que se
// creó al pagar NO se da de baja con el reembolso: eso es otra decisión.

import { useState, type ReactNode } from 'react';
import { Alert, Button, EmptyState, Status, Tag, Toast, useConfirm, useToast, type Tono } from '@/app/_ui';
import { useRouter } from '@/app/_ui/Link';
import { NOMBRE_PASARELA, rotuloEstado, type EstadoAlta, type EstadoCobro } from '@/lib/cobros-tipos';
import { formatoMonto } from '@/lib/pasarela-moneda';
import { anularCobroMakoAction, reembolsarCobroMakoAction, type CobroMako } from './actions';

const TONO_COBRO: Record<EstadoCobro, Tono> = {
  pendiente: 'info', pagado: 'good', fallido: 'bad', reembolsado: 'warn', anulado: 'neutral',
};

const ALTA: Record<EstadoAlta, { texto: string; tono: Tono }> = {
  pendiente: { texto: 'Creando la cuenta', tono: 'info' },
  hecha: { texto: 'Cuenta creada', tono: 'good' },
  ya_tenia_cuenta: { texto: 'Ya tenía cuenta', tono: 'warn' },
  error: { texto: 'El alta falló', tono: 'bad' },
};

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** «11 oct», leído del ISO tal cual: sin zona horaria, así el server y el navegador dibujan lo mismo. */
function fechaCorta(iso: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${Number(m[3])} ${MESES[Number(m[2]) - 1] ?? ''}` : '';
}

export default function ListaCobrosMako({ cobros, truncado }: { cobros: CobroMako[]; truncado: boolean }) {
  const router = useRouter();
  const { confirm, confirmNode } = useConfirm();
  const { toast, show, clear } = useToast();
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [falla, setFalla] = useState<string | null>(null);

  async function copiar(link: string) {
    try { await navigator.clipboard.writeText(link); show('Link copiado'); }
    catch { setFalla(`No pude copiarlo. El link es: ${link}`); }
  }

  async function anular(c: CobroMako) {
    const ok = await confirm(`Nadie va a poder pagar este link.`, { title: `¿Anular el link de ${c.nombre ?? c.email ?? 'este cobro'}?`, confirmLabel: 'Anular el link' });
    if (!ok) return;
    setOcupado(c.id); setFalla(null);
    const r = await anularCobroMakoAction(c.id).catch(() => ({ ok: false, error: 'No pude anular el link.' }));
    setOcupado(null);
    if (!r.ok) { setFalla(r.error ?? 'No pude anular el link.'); return; }
    show('Link anulado');
    router.refresh();
  }

  async function reembolsar(c: CobroMako) {
    const ok = await confirm(
      <>Se devuelven <strong>{formatoMonto(c.monto, c.moneda)}</strong> por {NOMBRE_PASARELA[c.proveedor]}. No se puede deshacer, y su cuenta de MaKo sigue activa.</>,
      { title: `¿Reembolsar a ${c.nombre ?? c.email ?? 'este comprador'}?`, confirmLabel: 'Reembolsar' },
    );
    if (!ok) return;
    setOcupado(c.id); setFalla(null);
    const r = await reembolsarCobroMakoAction(c.id).catch(() => ({ ok: false, resumen: 'No pude hacer el reembolso.' }));
    setOcupado(null);
    // Un reembolso que la pasarela rechazó se dice con SU motivo, y no se reintenta solo.
    if (!r.ok) { setFalla(r.resumen); return; }
    show('Reembolso hecho');
    router.refresh();
  }

  if (cobros.length === 0) {
    return <EmptyState inline titulo="Todavía no hay cobros" detalle="Cuando vendas un plan, aparece aquí con el estado de su cuenta." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {falla && <Alert tono="bad" onCerrar={() => setFalla(null)}>{falla}</Alert>}
      {truncado && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--faint)' }}>Se muestran los {cobros.length} más nuevos.</p>}
      {cobros.map((c) => (
        <div key={c.id} style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '10px 18px',
          padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)',
        }}>
          <Celda ancho={200}>
            <div style={{ fontWeight: 650, color: 'var(--ink)', overflowWrap: 'anywhere' }}>{c.nombre || c.email || 'Sin nombre'}</div>
            {c.nombre && c.email && <div style={{ fontSize: 12.5, color: 'var(--dim)', overflowWrap: 'anywhere' }}>{c.email}</div>}
            <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 2 }}>{fechaCorta(c.created_at)}</div>
          </Celda>

          <Celda ancho={140} rotulo="Plan">
            <div style={{ color: 'var(--ink)' }}>{c.plan ?? c.concepto}</div>
          </Celda>

          <Celda ancho={130} rotulo="Monto">
            <div style={{ color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
              {formatoMonto(c.monto, c.moneda)}{c.tipo === 'suscripcion' ? ' por mes' : ''}
            </div>
            <div style={{ fontSize: 12, color: 'var(--faint)', display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
              {NOMBRE_PASARELA[c.proveedor]}{c.modo === 'prueba' && <Tag>prueba</Tag>}
            </div>
          </Celda>

          <Celda ancho={130} rotulo="Cobro">
            <Status tono={TONO_COBRO[c.estado]}>{rotuloEstado(c.estado)}</Status>
            {c.motivo && c.estado !== 'pagado' && <Nota>{c.motivo}</Nota>}
          </Celda>

          <Celda ancho={170} rotulo="Cuenta">
            {c.alta_estado ? (
              <>
                <Status tono={ALTA[c.alta_estado].tono}>{ALTA[c.alta_estado].texto}</Status>
                {c.alta_ws_nombre && <div style={{ fontSize: 13, color: 'var(--ink)', marginTop: 4, overflowWrap: 'anywhere' }}>{c.alta_ws_nombre}</div>}
                {c.alta_motivo && <Nota>{c.alta_motivo}</Nota>}
              </>
            ) : (
              <span style={{ color: 'var(--faint)' }}>{c.plan ? (c.estado === 'pagado' ? 'Sin alta' : 'Al pagar') : '—'}</span>
            )}
          </Celda>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {c.link && <Button size="sm" variant="secondary" onClick={() => void copiar(c.link!)}>Copiar link</Button>}
            {(c.estado === 'pendiente' || c.estado === 'fallido') && (
              <Button size="sm" variant="tertiary" loading={ocupado === c.id} onClick={() => void anular(c)}>Anular</Button>
            )}
            {c.estado === 'pagado' && (
              <Button size="sm" variant="tertiary" loading={ocupado === c.id} onClick={() => void reembolsar(c)}>Reembolsar</Button>
            )}
          </div>
        </div>
      ))}
      {confirmNode}
      <Toast state={toast} onClose={clear} />
    </div>
  );
}

function Celda({ ancho, rotulo, children }: { ancho: number; rotulo?: string; children: ReactNode }) {
  return (
    <div style={{ flex: `1 1 ${ancho}px`, minWidth: 0, fontSize: 14 }}>
      {rotulo && <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 4 }}>{rotulo}</div>}
      {children}
    </div>
  );
}

function Nota({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 4, lineHeight: 1.4, overflowWrap: 'anywhere' }}>{children}</div>;
}
