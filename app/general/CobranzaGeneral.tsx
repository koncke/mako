'use client';

// =============================================================================
// CobranzaGeneral — «A quién cobrarle» en /general, con «Marcar cobrada» y su deshacer
// =============================================================================
// Lo pidió Mauricio en la reunión del 13/10/2026 (minuto 54 a 72): «el cobranza yo lo veo más operativo... ¿A quién
// cobrarle?» y «me genera mucho valor estar viendo quién sigue de cobranza». Martín: «lo pongo ahí en el general».
//
// Las filas son las MISMAS que las del Dashboard: `armarCobranza` (app/dashboard/bloques/datos-comercial.ts) sobre
// `getOutstandingDetalle` (lib/pagos.ts), con lo vencido hace más tiempo arriba. Lo que cambia es la forma: acá es una
// sección de /general (lista con filete, no una tabla de siete columnas) y está ABIERTA, porque es lo que se acciona.
//
// «Marcar cobrada» es el mismo camino que la ficha del CRM y el Dashboard (`marcarPagoAction`): recalcula lo cobrado
// del lead, deja el historial y corta los recordatorios de esa cuota. La fecha del pago es HOY en la zona del
// negocio, calculada AL HACER CLIC (una pestaña abierta desde ayer no puede fechar un cobro de hoy con la de ayer).
// Después va `router.refresh()`: lo que cambia es un dato de esta pantalla, no qué existe.

import { useCallback, useRef, useState, type CSSProperties } from 'react';
import Link, { useRouter } from '@/app/_ui/Link';
import { Toast, useToast } from '@/app/_ui';
import { Button } from '@/app/_ui/Button';
import { marcarPagoAction } from '@/app/crm/actions';
import { hoyEnTz } from '@/lib/date-utils';
import { fmtUSD } from '@/lib/format';
import { nombreCuota, type FilaCobro } from '@/app/dashboard/bloques/datos-comercial';

/** Cuántas filas se ven de entrada. El resto, con «Ver las N». */
const DE_ENTRADA = 6;

const H2: CSSProperties = { fontWeight: 600, fontSize: 25, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)' };

function fechaCorta(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

function cuandoVence(f: FilaCobro): string {
  if (!f.cuota?.vence) return 'sin fecha';
  if (f.dias == null) return fechaCorta(f.cuota.vence);
  if (f.dias < 0) return `venció hace ${Math.abs(f.dias)} ${Math.abs(f.dias) === 1 ? 'día' : 'días'}`;
  if (f.dias === 0) return 'vence hoy';
  if (f.dias <= 5) return `vence en ${f.dias} ${f.dias === 1 ? 'día' : 'días'}`;
  return `vence el ${fechaCorta(f.cuota.vence)}`;
}

export function CobranzaGeneral({ filas, total, tz, error, alcance }: {
  filas: FilaCobro[];
  total: number;
  /** La zona del negocio: «Marcar cobrada» fecha con HOY en ella. */
  tz: string;
  /** No se pudo leer: se dice, no se dibuja «nada por cobrar». */
  error?: boolean;
  /** El nombre del alcance si la vista mira sólo algunos funnels (null = todo el negocio). */
  alcance: string | null;
}) {
  const router = useRouter();
  const [todas, setTodas] = useState(false);
  const [marcando, setMarcando] = useState<number | null>(null);
  const { toast, show, clear } = useToast(5000);
  // Un ref y no sólo el estado: dos clics antes del próximo render pasarían los dos la guarda del estado.
  const enCurso = useRef(false);

  const deshacer = useCallback(async (pagoId: number, leadId: number) => {
    try {
      await marcarPagoAction(pagoId, leadId, false, null);
      router.refresh();
    } catch {
      show('No se pudo deshacer', undefined, 'bad');
    }
  }, [router, show]);

  const marcar = useCallback(async (f: FilaCobro) => {
    if (!f.cuota || enCurso.current) return;
    enCurso.current = true;
    const { pagoId } = f.cuota;
    setMarcando(pagoId);
    try {
      await marcarPagoAction(pagoId, f.leadId, true, hoyEnTz(tz));
      show(<span><strong>{f.nombre}</strong> · cobrada</span>, () => { void deshacer(pagoId, f.leadId); });
      router.refresh();
    } catch {
      show('No se pudo marcar', undefined, 'bad');
    } finally {
      enCurso.current = false;
      setMarcando(null);
    }
  }, [tz, show, deshacer, router]);

  const visibles = todas ? filas : filas.slice(0, DE_ENTRADA);
  const vencidas = filas.filter((f) => f.urgencia === 'vencida').length;

  return (
    <>
      {toast && <Toast state={toast} onClose={clear} />}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: filas.length ? 18 : 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', minWidth: 0 }}>
          <h2 style={H2}>A quién cobrarle</h2>
          {alcance && <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--dim)' }}>{alcance}</span>}
        </div>
        {filas.length > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 24, letterSpacing: '-0.02em', color: vencidas ? 'var(--bad)' : 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(total)}</span>
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>pendiente</span>
          </span>
        )}
      </div>

      {error ? (
        <span style={{ fontSize: 'var(--fs-md)', color: 'var(--dim)' }}>No pude leer las cuotas.</span>
      ) : !filas.length ? (
        <span style={{ fontSize: 'var(--fs-card)', color: 'var(--dim)' }}>Nada por cobrar.</span>
      ) : (
        <div>
          {visibles.map((f, i) => {
            const vencida = f.urgencia === 'vencida';
            const pronto = f.urgencia === 'pronto';
            return (
              <div key={f.leadId} data-cobro={f.leadId} style={{
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                padding: '12px 0', borderTop: i === 0 ? 'none' : '1px solid var(--border)',
              }}>
                <span aria-hidden style={{ flex: 'none', width: 9, height: 9, borderRadius: '50%', background: vencida ? 'var(--bad)' : pronto ? 'var(--warn-fill)' : 'var(--border-strong)' }} />
                <Link href={`/crm/${f.leadId}`} style={{ flex: '1 1 160px', minWidth: 0, fontSize: 'var(--fs-card)', color: 'var(--ink)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.nombre}
                </Link>
                <span style={{ flex: '0 1 auto', fontSize: 'var(--fs-sm)', color: vencida ? 'var(--bad)' : 'var(--dim)', fontWeight: vencida ? 600 : 400, whiteSpace: 'nowrap' }}>
                  {f.cuota ? `${nombreCuota(f.cuota.numero)} · ${cuandoVence(f)}` : 'sin cuota'}
                </span>
                <span style={{ flex: 'none', minWidth: 84, textAlign: 'right', fontWeight: 600, fontSize: 'var(--fs-card)', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtUSD(f.cuota?.monto ?? f.pendiente)}
                </span>
                {f.cuota && (
                  <span style={{ flex: 'none' }} title={`Marcar cobrada la ${nombreCuota(f.cuota.numero)} de ${f.nombre}`}>
                    <Button variant="secondary" size="sm" disabled={marcando != null} loading={marcando === f.cuota.pagoId}
                      onClick={() => { void marcar(f); }}>
                      Marcar cobrada
                    </Button>
                  </span>
                )}
              </div>
            );
          })}
          {filas.length > DE_ENTRADA && (
            <button type="button" onClick={() => setTodas((t) => !t)}
              style={{ marginTop: 10, padding: 0, border: 'none', background: 'none', color: 'var(--primary)', fontSize: 'var(--fs-md)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              {todas ? 'Ver menos' : `Ver las ${filas.length}`}
            </button>
          )}
        </div>
      )}
    </>
  );
}
