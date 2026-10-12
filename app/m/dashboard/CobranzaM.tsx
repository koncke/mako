'use client';

// =============================================================================
// CobranzaM — «A quién cobrarle» en el teléfono: la próxima cuota de cada cliente y «Marcar cobrado»
// =============================================================================
// Es el bloque `cobranza` de la hoja Comercial (app/dashboard/bloques/BloqueCobranza.tsx) en filas:
// mismo orden (lo vencido hace más tiempo arriba, `armarCobranza`), la misma cuota (la PRÓXIMA sin
// pagar) y la MISMA acción: `marcarPagoAction` (app/crm/actions.ts), que valida que la cuota sea de
// ese lead en ESTE workspace, recalcula lo cobrado, deja el historial y corta los recordatorios. Su
// gating es el de escritorio: admin con el Dashboard en su plan, o el CRM.
//
// ⚠️ LA FECHA DE PAGO ES HOY EN LA ZONA DEL NEGOCIO, calculada AL TOCAR (la decisión de escritorio:
//    con el vencimiento, el cobro caía en un período pasado y el Cash de éste no se movía).
// La fila se va al tocar (optimista) y vuelve si falla; el toast trae «Deshacer» (desmarca la
// cuota). Después, `router.refresh()`: Revenue, Outstanding y esta lista cambian juntos, y el
// cliente vuelve a aparecer si le queda otra cuota.
// =============================================================================

import { useRef, useState, useTransition } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Button } from '@/app/_ui/Button';
import { FilaM, ListaM, SeccionM, VacioM, ErrorM, useConexion, useToastM } from '@/app/m/_ui';
import { marcarPagoAction } from '@/app/crm/actions';
import { hoyEnTz } from '@/lib/date-utils';
import { haptico } from '@/lib/haptico';
import type { CobroM } from './modelo';

/** Las que se ven antes de «Ver todos». */
const VISIBLES = 5;

export function CobranzaM({ filas, tz, error, fichaLead }: {
  filas: CobroM[];
  tz: string;
  error: string | null;
  /** ¿Puede abrir la ficha del lead en /m/crm? (la misma regla que la barra para CRM). */
  fichaLead: boolean;
}) {
  const toast = useToastM();
  const { enLinea } = useConexion();
  const router = useRouter();
  const [, empezar] = useTransition();
  const [ocultas, setOcultas] = useState<ReadonlySet<number>>(new Set());
  const [marcando, setMarcando] = useState<number | null>(null);
  const [todas, setTodas] = useState(false);
  // Un ref y no sólo el estado: dos toques antes del próximo render pasarían los dos la guarda, y el
  // segundo marcaría la cuota SIGUIENTE del lead después del refresco (lo mismo que escritorio).
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
        console.error('[m/dashboard] deshacer cobro:', e instanceof Error ? e.message : String(e));
        haptico('error');
        toast('No se pudo deshacer');
      }
    });
  };

  const marcar = async (f: CobroM) => {
    if (enCurso.current || !enLinea) return;
    enCurso.current = true;
    setMarcando(f.pagoId);
    haptico('light');
    try {
      await marcarPagoAction(f.pagoId, f.leadId, true, hoyEnTz(tz));
      ocultar(f.pagoId, true);
      haptico('success');
      toast('Cuota cobrada', { deshacer: () => deshacer(f) });
      empezar(() => router.refresh());
    } catch (e) {
      console.error('[m/dashboard] marcar cobro:', e instanceof Error ? e.message : String(e));
      haptico('error');
      toast('No se pudo marcar');
    } finally {
      enCurso.current = false;
      setMarcando(null);
    }
  };

  const vivas = filas.filter((f) => !ocultas.has(f.pagoId));
  const vistas = todas ? vivas : vivas.slice(0, VISIBLES);
  const accion = vivas.length > VISIBLES ? (
    <button type="button" className="m-lnk" aria-expanded={todas} onClick={() => setTodas((t) => !t)}>
      {todas ? 'Ver menos' : `Ver los ${vivas.length}`}
    </button>
  ) : undefined;

  return (
    <SeccionM titulo="A quién cobrarle" accion={error ? undefined : accion}>
      {error ? (
        <ErrorM frase={error} />
      ) : !vivas.length ? (
        <VacioM frase="Nadie con cuotas por cobrar." />
      ) : (
        <ListaM>
          {vistas.map((f) => (
            <FilaM
              key={f.pagoId}
              avatar={f.nombre}
              titulo={f.nombre}
              segunda={(
                <>
                  {f.urgencia && <span className="m-dash-punto" data-tono={f.urgencia === 'vencida' ? 'bad' : 'warn'} aria-hidden />}
                  {f.linea}
                </>
              )}
              href={fichaLead ? `/m/crm/${f.leadId}` : undefined}
              control={(
                <Button
                  className="m-dash-cobrar"
                  variant="secondary"
                  size="md"
                  loading={marcando === f.pagoId}
                  disabled={!enLinea || (marcando != null && marcando !== f.pagoId)}
                  onClick={() => { void marcar(f); }}
                  aria-label={`Marcar cobrada la cuota de ${f.nombre}`}
                >
                  Marcar cobrado
                </Button>
              )}
            />
          ))}
        </ListaM>
      )}
    </SeccionM>
  );
}
