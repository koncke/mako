'use client';

// =============================================================================
// BloqueCobranza — «A quién cobrarle»: el desplegable con «Marcar cobrado» y su deshacer
// =============================================================================
// Martín, 11/10/2026 (punto 5): «En Comercial está diferente la parte de "A quién cobrarle", antes era
// un desplegable... Y con las opciones de "Marcar como cobrada"». Es la tabla de la tab vieja
// (app/comercial/CobrarTable.tsx hasta 7527b8c2): cerrada por defecto, con las columnas Lead · Sold
// Revenue · Cash Collected · Outstanding · Próxima cuota · Vence, lo vencido en rojo con URGENTE, lo
// que vence en 5 días con un punto ámbar, y el «Total pendiente» al pie. El orden y la urgencia los
// arma `armarCobranza` (./datos-comercial.ts, con test).
//
// «Marcar cobrado» marca la PRÓXIMA cuota del lead con `marcarPagoAction` (app/crm/actions.ts): el mismo
// camino que la ficha del CRM, que recalcula lo cobrado del lead, deja el historial y corta los
// recordatorios de cobranza de esa cuota (lib/pagos.ts → marcarPago). El toast trae «↶ Deshacer»
// durante 5 s, que la llama con (false, null).
//
// ⚠️ DECISIÓN — LA FECHA DE PAGO ES HOY, EN LA ZONA DEL NEGOCIO, NO EL VENCIMIENTO. La tabla vieja
//    marcaba con `fecha_esperada` (el vencimiento) como «proxy del ingreso real por período», y eso
//    metía el cobro en un período PASADO: una cuota vencida el mes anterior que se cobra hoy sumaba al
//    Cash del mes anterior, y el Cash de este período no se movía al marcarla. La API de MaKo
//    (marcar_pago_cobrado, lib/api-mako/areas/crm.run.ts) y la ficha (PayModal) ya marcan con hoy.
//    Y el «hoy» se calcula AL HACER CLIC con la zona del payload, no al leer: una pestaña abierta desde
//    ayer no puede fechar un cobro de hoy con la fecha de ayer.
//
// ⚠️ Después de marcar NO va `router.refresh()`: el editor siembra los datos una vez y sólo los vuelve a
//    pedir si cambia su firma, así que un refresh no movería ningún número. Va `onRefrescar()`, que
//    vuelve a pedir la HOJA entera (Revenue, Outstanding y esta tabla cambian juntos).
//
// ⚠️ El toast vive en este componente, que se queda montado mientras la hoja recarga (el aviso de carga
//    se dibuja ADENTRO): si se desmontara con la recarga, el «Deshacer» desaparecería en el acto.

import { useCallback, useRef, useState } from 'react';
import { Spinner, Toast, useToast } from '@/app/_ui';
import { marcarPagoAction } from '@/app/crm/actions';
import { hoyEnTz } from '@/lib/date-utils';
import type { EstiloEfectivo } from '@/lib/graficos-temas';
import { nombreCuota, textoVentana, type DatosCobranza, type FilaCobro } from './datos-comercial';
import { Aviso, Capa, MONO, Mensaje, NO_ARRASTRAR, fecha, plural, usd } from './piezas';

export function BloqueCobranza({ d, cargando, error, estilo, onRefrescar }: {
  d: DatosCobranza | null; cargando: boolean; error?: string; estilo: EstiloEfectivo; onRefrescar: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [marcando, setMarcando] = useState<number | null>(null);
  const { toast, show, clear } = useToast(5000);

  const deshacer = useCallback(async (pagoId: number, leadId: number) => {
    try {
      await marcarPagoAction(pagoId, leadId, false, null);
      onRefrescar();
    } catch (e) {
      console.error('[cobranza] deshacer:', e instanceof Error ? e.message : String(e));
      show('No se pudo deshacer', undefined, 'bad');
    }
  }, [onRefrescar, show]);

  // Un ref y no sólo el estado: dos clics antes del próximo render pasarían los dos la guarda del
  // estado, y la segunda llamada marcaría la cuota siguiente del lead después del refresco.
  const enCurso = useRef(false);
  const marcar = useCallback(async (f: FilaCobro, tz: string) => {
    if (!f.cuota || enCurso.current) return;
    enCurso.current = true;
    const { pagoId } = f.cuota;
    setMarcando(pagoId);
    try {
      await marcarPagoAction(pagoId, f.leadId, true, hoyEnTz(tz));
      show(<span><strong>{f.nombre}</strong> · cuota cobrada</span>, () => { void deshacer(pagoId, f.leadId); });
      onRefrescar();
    } catch (e) {
      console.error('[cobranza] marcar:', e instanceof Error ? e.message : String(e));
      show('No se pudo marcar', undefined, 'bad');
    } finally {
      enCurso.current = false;
      setMarcando(null);
    }
  }, [show, deshacer, onRefrescar]);

  const toastPuesto = toast && <Capa><Toast state={toast} onClose={clear} /></Capa>;

  if (!d) return <>{toastPuesto}<Aviso cargando={cargando} error={error} /></>;
  if (error) return <>{toastPuesto}<Aviso cargando={false} error={error} /></>;

  const c = estilo.compacto;
  if (!d.filas.length) {
    return (
      <>
        {toastPuesto}
        <Mensaje>{d.ventana.desde ? `Sin cuotas por cobrar · ${textoVentana(d.ventana)}` : 'Sin cuotas por cobrar'}</Mensaje>
      </>
    );
  }

  return (
    <>
      {toastPuesto}
      <button type="button" className={NO_ARRASTRAR} aria-expanded={abierto} onClick={() => setAbierto((a) => !a)}
        style={{ flex: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%', textAlign: 'left', padding: '13px 18px', border: '1px solid var(--bad)', borderRadius: 12, background: abierto ? 'var(--bad-bg)' : 'transparent', color: 'var(--bad)', fontSize: 14.5, fontWeight: 500, fontFamily: 'inherit' }}>
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Ver a quién cobrarle — {plural(d.filas.length, 'lead', 'leads')} · {usd(d.total, c)} pendiente
        </span>
        <span style={{ flex: 'none', fontFamily: MONO, fontSize: 12, color: 'var(--dim)' }}>{abierto ? 'plegar ▴' : 'desplegar ▾'}</span>
      </button>

      {abierto && (
        <div className="bq-scroll">
          <table className="bq-tabla" style={{ minWidth: 820 }}>
            <thead>
              <tr>
                <th>Lead</th>
                <th className="bq-der">Sold Revenue</th>
                <th className="bq-der">Cash Collected</th>
                <th className="bq-der">Outstanding</th>
                <th>Próxima cuota</th>
                <th>Vence</th>
                <th aria-label="Acción" />
              </tr>
            </thead>
            <tbody>
              {d.filas.map((f) => {
                const vencida = f.urgencia === 'vencida';
                const pronto = f.urgencia === 'pronto';
                return (
                  <tr key={f.leadId} style={{ background: vencida ? 'var(--bad-bg)' : undefined }}>
                    <td><span style={{ color: 'var(--accent)', fontWeight: 500 }}>{f.nombre}</span></td>
                    <td className="bq-der" style={{ color: 'var(--ink)' }}>{usd(f.vendido, c)}</td>
                    <td className="bq-der" style={{ color: 'var(--good)' }}>{usd(f.cobrado, c)}</td>
                    <td className="bq-der" style={{ color: 'var(--bad)' }}>{usd(f.pendiente, c)}</td>
                    <td style={{ fontSize: 13, color: 'var(--dim)', whiteSpace: 'nowrap' }}>{f.cuota ? `${nombreCuota(f.cuota.numero)} · ${usd(f.cuota.monto, c)}` : '—'}</td>
                    <td style={{ fontSize: 13, color: vencida ? 'var(--bad)' : 'var(--dim)', fontWeight: vencida ? 700 : 400, whiteSpace: 'nowrap' }}>
                      {f.cuota?.vence ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                          {(vencida || pronto) && <span className={`bq-punto bq-punto--${vencida ? 'vencida' : 'pronto'}`} aria-hidden />}
                          {vencida ? 'URGENTE · ' : ''}{fecha(f.cuota.vence)}{pronto ? ` (${f.dias === 0 ? 'hoy' : `en ${f.dias}d`})` : ''}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="bq-der">
                      {f.cuota && (
                        <button type="button" className={`bq-boton ${NO_ARRASTRAR}`} disabled={marcando != null}
                          onClick={() => { void marcar(f, d.tz); }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            {marcando === f.cuota.pagoId && <Spinner size={11} />}Marcar cobrado
                          </span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr style={{ background: 'var(--surface-2)' }}>
                <td colSpan={3} style={{ fontWeight: 600, color: 'var(--ink)', borderTop: '1px solid var(--border-strong)' }}>Total pendiente</td>
                <td className="bq-der" style={{ fontWeight: 600, color: 'var(--bad)', borderTop: '1px solid var(--border-strong)' }}>{usd(d.total, c)}</td>
                <td colSpan={3} style={{ borderTop: '1px solid var(--border-strong)' }} />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
