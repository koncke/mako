'use client';

// =============================================================================
// Cobranza — «A quién cobrarle» en la tab General: la próxima cuota de cada cliente y «Marcar cobrada»
// =============================================================================
// Feedback de la reunión con Mauricio del 12/10/2026 (Fathom 858927676). Él, a los 54:29: «tú tienes en dashboard
// cobranza y el cobranza yo lo veo más operativo»; a los 71:28: «creo que en Operate… debe ser cobranza», «me genera
// mucho valor estar viendo quién sigue de cobranza. Pero nunca lo veo ahí realmente». Martín, al cerrar (86:17):
// «Número tres, en la tab general, la cobranza». General es la tab de lo que se HACE hoy (Operate).
//
// Es la lista del teléfono (app/m/dashboard/CobranzaM.tsx) en escritorio: la MISMA lectura (`leerAQuienCobrar`,
// lib/datos-comercial-server.ts: getOutstandingDetalle + armarCobranza, la del conjunto «Clientes por cobrar» del
// Dashboard), el mismo renglón y la MISMA acción, `marcarPagoAction` (app/crm/actions.ts), que valida que la cuota sea
// de ese lead en este workspace, recalcula lo cobrado, deja el historial y corta los recordatorios.
//
// ⚠️ LA FECHA DE PAGO ES HOY EN LA ZONA DEL NEGOCIO, calculada AL HACER CLIC (la decisión de escritorio: con el
//    vencimiento, el cobro caía en un período pasado y el Cash de éste no se movía).
// ⚠️ UN CLIC A LA VEZ (`enCurso`, un ref y no sólo el estado): dos clics antes del próximo render pasarían los dos la
//    guarda, y el segundo marcaría la cuota SIGUIENTE del lead después del refresco.
// La fila se va al marcar y vuelve si falla; el toast trae «Deshacer» (desmarca la cuota). Después, `router.refresh()`:
// el semáforo, el mes y esta lista cambian juntos, y el cliente vuelve si le queda otra cuota.
// =============================================================================

import { useRef, useState, useTransition, type CSSProperties } from 'react';
import Link, { useRouter } from '@/app/_ui/Link';
import { Button, Toast, useToast } from '@/app/_ui';
import { marcarPagoAction } from '@/app/crm/actions';
import { hoyEnTz } from '@/lib/date-utils';
import type { CobroM } from '@/app/m/dashboard/modelo';

/** Las que se ven antes de «Ver todos». */
const VISIBLES = 6;

export function Cobranza({ filas, tz, error }: { filas: CobroM[]; tz: string; error: string | null }) {
  const { toast, show, clear } = useToast();
  const router = useRouter();
  const [, empezar] = useTransition();
  const [ocultas, setOcultas] = useState<ReadonlySet<number>>(new Set());
  const [marcando, setMarcando] = useState<number | null>(null);
  const [todas, setTodas] = useState(false);
  const enCurso = useRef(false);

  const ocultar = (pagoId: number, si: boolean) => setOcultas((prev) => {
    const s = new Set(prev);
    if (si) s.add(pagoId); else s.delete(pagoId);
    return s;
  });

  const deshacer = (f: CobroM) => {
    ocultar(f.pagoId, false);
    empezar(async () => {
      try {
        await marcarPagoAction(f.pagoId, f.leadId, false, null);
        router.refresh();
      } catch (e) {
        console.error('[general] deshacer cobro:', e instanceof Error ? e.message : String(e));
        show('No se pudo deshacer', undefined, 'bad');
      }
    });
  };

  const marcar = async (f: CobroM) => {
    if (enCurso.current) return;
    enCurso.current = true;
    setMarcando(f.pagoId);
    try {
      await marcarPagoAction(f.pagoId, f.leadId, true, hoyEnTz(tz));
      ocultar(f.pagoId, true);
      show('Cuota cobrada', () => deshacer(f));
      empezar(() => router.refresh());
    } catch (e) {
      console.error('[general] marcar cobro:', e instanceof Error ? e.message : String(e));
      show('No se pudo marcar', undefined, 'bad');
    } finally {
      enCurso.current = false;
      setMarcando(null);
    }
  };

  const vivas = filas.filter((f) => !ocultas.has(f.pagoId));
  const vistas = todas ? vivas : vivas.slice(0, VISIBLES);

  return (
    <div data-cobranza-general="">
      <div style={S.cabecera}>
        <h2 style={S.h2}>A quién cobrarle</h2>
        {!error && vivas.length > VISIBLES && (
          <button type="button" style={S.ver} aria-expanded={todas} onClick={() => setTodas((t) => !t)}>
            {todas ? 'Ver menos' : `Ver los ${vivas.length}`}
          </button>
        )}
      </div>
      {error ? (
        <span style={S.dim}>{error}</span>
      ) : !vivas.length ? (
        <span style={S.dim}>Nadie con cuotas por cobrar.</span>
      ) : (
        <ul style={S.lista}>
          {vistas.map((f) => (
            <li key={f.pagoId} style={S.fila}>
              <span aria-hidden style={{ ...S.punto, background: f.urgencia === 'vencida' ? 'var(--bad)' : f.urgencia === 'pronto' ? 'var(--warn)' : 'transparent' }} />
              <span style={S.texto}>
                <Link href={`/crm/${f.leadId}`} style={S.nombre}>{f.nombre}</Link>
                <span style={S.linea}>{f.linea}</span>
              </span>
              <Button variant="secondary" size="sm" loading={marcando === f.pagoId}
                disabled={marcando != null && marcando !== f.pagoId}
                onClick={() => { void marcar(f); }} aria-label={`Marcar cobrada la cuota de ${f.nombre}`}>
                Marcar cobrada
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Toast state={toast} onClose={clear} />
    </div>
  );
}

// Sólo tokens que existen en claro y en oscuro.
const S: Record<string, CSSProperties> = {
  cabecera: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  // El H2 de las otras secciones de /general (app/general/page.tsx).
  h2: { margin: 0, fontSize: 25, fontWeight: 600, letterSpacing: '-0.015em', color: 'var(--ink)' },
  ver: { border: 'none', background: 'none', padding: 0, font: 'inherit', fontSize: 'var(--fs-meta)', color: 'var(--primary)', cursor: 'pointer' },
  dim: { fontSize: 'var(--fs-md)', color: 'var(--dim)' },
  lista: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' },
  fila: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid var(--border)' },
  punto: { width: 8, height: 8, borderRadius: 999, flex: 'none' },
  texto: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 },
  nombre: { fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--ink)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  linea: { fontSize: 'var(--fs-meta)', color: 'var(--dim)' },
};
