'use client';

// =============================================================================
// CobranzaPlanCard — cobranza del lead: resumen, plan, contrato y cuotas
// =============================================================================
// Rediseño: (1) hero con "Cobrado X de Y" y barra de progreso; (2) el plan se
// define con un modo simple (Pago único / Inicial + cuotas) y se puede rellenar
// SOLO subiendo el contrato (PDF/imagen → /api/extract-contract con IA) o
// sugerir desde el monto de cierre; (3) cada cuota se marca cobrada con su fecha.

import { useRef, useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { savePlanPagosAction, marcarPagoAction } from '../actions';
import { Dropdown } from '@/app/components/Dropdown';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import type { Lead } from '@/lib/leads';
import type { Pago } from '@/lib/pagos';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };
const ghostBtn: CSSProperties = { padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS };

function hoyISO(): string { return new Date().toISOString().slice(0, 10); }
function fmtUSD(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

type Modo = 'unico' | 'cuotas';

export function CobranzaPlanCard({ lead, pagos, editable = true }: { lead: Lead; pagos: Pago[]; editable?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const [cobroInicial, setCobroInicial] = useState(lead.cobro_inicial_usd?.toString() ?? '');
  const [montoCuota, setMontoCuota] = useState(lead.monto_cuota_usd?.toString() ?? '');
  const [totalCuotas, setTotalCuotas] = useState<string>(lead.total_cuotas?.toString() ?? '0');
  const [diaPago, setDiaPago] = useState<string>(lead.dia_de_pago?.toString() ?? '1');
  const [modo, setModo] = useState<Modo>((lead.total_cuotas ?? 0) > 0 ? 'cuotas' : 'unico');

  // Contrato: subir y extraer con IA
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [extrayendo, setExtrayendo] = useState(false);
  const [contratoNombre, setContratoNombre] = useState<string | null>(lead.contrato_nombre ?? null);

  const nCuotas = modo === 'unico' ? 0 : parseInt(totalCuotas, 10) || 0;
  const inicialNum = parseFloat(cobroInicial) || 0;
  const cuotaNum = modo === 'unico' ? 0 : parseFloat(montoCuota) || 0;

  const cobrado = pagos.filter((p) => p.pagado).reduce((s, p) => s + Number(p.monto_usd), 0);
  const pendiente = pagos.filter((p) => !p.pagado).reduce((s, p) => s + Number(p.monto_usd), 0);
  const totalPagos = cobrado + pendiente;
  // Total del plan: lo que dicen los campos, o — si están vacíos porque las
  // cuotas se cargaron con el modelo viejo — la suma real de las cuotas.
  const totalCampos = inicialNum + cuotaNum * nCuotas;
  const totalPlan = totalCampos > 0 ? totalCampos : totalPagos;
  const progreso = totalPagos > 0 ? Math.min(100, Math.round((cobrado / totalPagos) * 100)) : 0;

  const montoCierre = lead.monto_cierre_usd ?? 0;
  const descuadre = montoCierre > 0 && totalPlan > 0 && Math.abs(totalPlan - montoCierre) >= 1;
  const sinPlan = !lead.cobro_inicial_usd && !(lead.total_cuotas ?? 0) && pagos.length === 0;

  // Sugerir plan desde el monto de cierre: 50% inicial + resto en 2 cuotas.
  const sugerir = () => {
    if (!(montoCierre > 0)) return;
    if (modo === 'unico') {
      setCobroInicial(String(montoCierre));
    } else {
      const inicial = Math.round(montoCierre / 2);
      const cuota = Math.round((montoCierre - inicial) / 2);
      setCobroInicial(String(inicial));
      setMontoCuota(String(cuota));
      setTotalCuotas('2');
    }
  };

  const guardarPlan = () => {
    setFeedback(null);
    startTransition(async () => {
      try {
        await savePlanPagosAction(lead.id, {
          cobro_inicial_usd: cobroInicial.trim() ? parseFloat(cobroInicial) : null,
          monto_cuota_usd: modo === 'cuotas' && montoCuota.trim() ? parseFloat(montoCuota) : null,
          total_cuotas: nCuotas > 0 ? nCuotas : null,
          dia_de_pago: modo === 'cuotas' ? (parseInt(diaPago, 10) || null) : null,
        });
        setFeedback({ kind: 'ok', msg: 'Plan guardado — cuotas generadas' });
        router.refresh();
      } catch (err) {
        setFeedback({ kind: 'err', msg: err instanceof Error ? err.message : String(err) });
      }
    });
  };

  // Subir contrato → IA extrae el plan → prefill de los campos (el usuario revisa
  // y toca Guardar). El archivo queda guardado y descargable.
  const subirContrato = async (file: File) => {
    setFeedback(null);
    setExtrayendo(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('leadId', String(lead.id));
      const r = await fetch('/api/extract-contract', { method: 'POST', body: fd });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      if (j.contrato_nombre) setContratoNombre(j.contrato_nombre);

      // Mapear el modelo extraído (total + cuotas explícitas) al plan actual
      // (inicial + cuota×n): cuota 0 = inicial; el resto, cuotas uniformes.
      const cuotas: Array<{ monto?: number; fecha?: string }> = Array.isArray(j.cuotas) ? j.cuotas : [];
      if (cuotas.length > 0) {
        const inicial = Number(cuotas[0]?.monto) || 0;
        const resto = cuotas.slice(1);
        if (inicial) setCobroInicial(String(inicial));
        if (resto.length > 0) {
          setModo('cuotas');
          const cuotaTipica = Number(resto[0]?.monto) || 0;
          if (cuotaTipica) setMontoCuota(String(cuotaTipica));
          setTotalCuotas(String(resto.length));
          const dia = resto[0]?.fecha ? parseInt(String(resto[0].fecha).slice(8, 10), 10) : NaN;
          if (Number.isFinite(dia) && dia >= 1 && dia <= 28) setDiaPago(String(dia));
        } else {
          setModo('unico');
        }
      } else if (j.total_usd) {
        setModo('unico');
        setCobroInicial(String(j.total_usd));
      }
      const partes = [
        j.total_usd ? `total ${fmtUSD(Number(j.total_usd))}` : null,
        cuotas.length ? `${cuotas.length} pago(s)` : null,
        j.duracion_meses ? `${j.duracion_meses} meses` : null,
      ].filter(Boolean);
      setFeedback({ kind: 'ok', msg: `Contrato leído (${partes.join(' · ') || 'sin plan detectado'}). Revisá los campos y tocá Guardar.` });
    } catch (err) {
      setFeedback({ kind: 'err', msg: `No se pudo leer el contrato: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setExtrayendo(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <section style={card}>
      {/* HERO — cuánto entró de cuánto */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={sectLabel}>Cobranza</div>
          <div style={{ fontSize: 26, fontWeight: 600, color: 'var(--ink)', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
            {fmtUSD(cobrado)} <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--dim)' }}>cobrado de {fmtUSD(totalPagos > 0 ? totalPagos : montoCierre || null)}</span>
          </div>
        </div>
        {pendiente > 0 && <div style={{ fontSize: 13.5, color: 'var(--warn)', background: 'var(--warn-bg)', border: '1px solid var(--warn-fill)', borderRadius: 999, padding: '5px 13px', fontWeight: 600 }}>Pendiente {fmtUSD(pendiente)}</div>}
        {totalPagos > 0 && pendiente === 0 && <div style={{ fontSize: 13.5, color: 'var(--good)', background: 'var(--good-bg)', borderRadius: 999, padding: '5px 13px', fontWeight: 700 }}>Pagado</div>}
      </div>
      {totalPagos > 0 && (
        <div style={{ height: 7, borderRadius: 999, background: 'var(--border)', marginTop: 12, overflow: 'hidden' }}>
          <div style={{ width: progreso + '%', height: '100%', background: 'var(--good)', transition: 'width .3s' }} />
        </div>
      )}

      {/* CONTRATO — subir para autollenar, o descargar el guardado */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 18, padding: '13px 15px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void subirContrato(f); }} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{contratoNombre ? contratoNombre : 'Sin contrato cargado'}</div>
          <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 2 }}>{contratoNombre ? 'Contrato guardado en el lead.' : 'Subí el contrato (PDF o foto) y el plan se rellena solo.'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {contratoNombre && <a href={`/api/contract?leadId=${lead.id}`} style={{ ...ghostBtn, textDecoration: 'none' }}>Descargar</a>}
          {editable && (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={extrayendo} style={{ ...ghostBtn, borderColor: 'var(--primary)', color: 'var(--primary)', opacity: extrayendo ? 0.6 : 1 }}>
              {extrayendo ? 'Leyendo contrato…' : contratoNombre ? 'Reemplazar y releer' : 'Subir contrato'}
            </button>
          )}
        </div>
      </div>

      {/* PLAN — modo + campos (solo en modo edición) */}
      {editable && (
      <div style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 4, gap: 4 }}>
            {([['unico', 'Pago único'], ['cuotas', 'Inicial + cuotas']] as Array<[Modo, string]>).map(([m, lbl]) => (
              <button key={m} type="button" onClick={() => setModo(m)} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, background: modo === m ? 'var(--ink)' : 'transparent', color: modo === m ? 'var(--on-sidebar)' : 'var(--dim)' }}>{lbl}</button>
            ))}
          </div>
          {montoCierre > 0 && sinPlan && (
            <button type="button" onClick={sugerir} style={ghostBtn}>Sugerir desde el cierre ({fmtUSD(montoCierre)})</button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <Field label={modo === 'unico' ? 'Monto del pago (USD)' : 'Cobro inicial (USD)'}>
            <input className="lead-field" type="number" step="0.01" min="0" value={cobroInicial} onChange={(e) => setCobroInicial(e.target.value)} />
          </Field>
          {modo === 'cuotas' && (
            <>
              <Field label="Monto de cada cuota (USD)"><input className="lead-field" type="number" step="0.01" min="0" value={montoCuota} onChange={(e) => setMontoCuota(e.target.value)} /></Field>
              <Field label="Cuotas">
                <Dropdown
                  value={totalCuotas === '0' ? '1' : totalCuotas}
                  onChange={setTotalCuotas}
                  width="100%"
                  ariaLabel="Total de cuotas"
                  options={[1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `${n} cuota${n === 1 ? '' : 's'}` }))}
                />
              </Field>
              <Field label="Día de pago" hint="Tope 28 para que exista en todos los meses.">
                <Dropdown
                  value={diaPago}
                  onChange={setDiaPago}
                  width="100%"
                  ariaLabel="Día de pago"
                  options={Array.from({ length: 28 }, (_, i) => i + 1).map((d) => ({ value: String(d), label: String(d) }))}
                />
              </Field>
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontSize: 14, color: 'var(--dim)' }}>
            Total del plan: <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{fmtUSD(totalPlan)}</span>
            {modo === 'cuotas' && nCuotas > 0 && <span style={{ fontSize: 13, marginLeft: 8 }}>({fmtUSD(inicialNum)} inicial + {nCuotas} × {fmtUSD(cuotaNum)})</span>}
          </div>
          <button type="button" onClick={guardarPlan} disabled={pending} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS, opacity: pending ? 0.6 : 1 }}>{pending ? 'Guardando…' : 'Guardar plan'}</button>
        </div>

        {descuadre && (
          <div style={{ borderRadius: 11, padding: '11px 16px', fontSize: 13.5, marginTop: 12, background: 'var(--warn-bg)', color: 'var(--warn)', border: '1px solid var(--warn-fill)', lineHeight: 1.5 }}>
            El plan suma {fmtUSD(totalPlan)} pero el monto de cierre es {fmtUSD(montoCierre)}. Revisá que cuadre con lo cerrado.
          </div>
        )}

        {feedback && (
          <div style={{ borderRadius: 11, padding: '11px 16px', fontSize: 14, fontWeight: 600, marginTop: 12, background: feedback.kind === 'ok' ? 'var(--good-bg)' : 'var(--bad-bg)', color: feedback.kind === 'ok' ? 'var(--good)' : 'var(--bad)' }}>{feedback.msg}</div>
        )}
      </div>
      )}

      {/* CUOTAS */}
      {pagos.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div style={{ ...sectLabel, marginBottom: 12 }}>Cuotas</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pagos.map((p) => (
              <CuotaRow key={p.id} pago={p} leadId={lead.id} pending={pending} startTransition={startTransition} router={router} setFeedback={setFeedback} />
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'var(--faint)', marginTop: 10 }}>Al guardar el plan se regeneran solo las cuotas NO pagadas. El cash del dashboard lee de acá.</p>
        </div>
      )}
    </section>
  );
}

function CuotaRow({ pago, leadId, pending, startTransition, router, setFeedback }: {
  pago: Pago; leadId: number; pending: boolean; startTransition: React.TransitionStartFunction;
  router: ReturnType<typeof useRouter>; setFeedback: (f: { kind: 'ok' | 'err'; msg: string } | null) => void;
}) {
  const [fechaPago, setFechaPago] = useState(pago.fecha_pago ?? hoyISO());
  const vencida = !pago.pagado && pago.fecha_esperada !== null && pago.fecha_esperada < hoyISO();
  const etiqueta = pago.numero === 0 ? 'Cobro inicial' : `Cuota ${pago.numero}`;

  const marcar = (pagado: boolean) => {
    setFeedback(null);
    startTransition(async () => {
      try { await marcarPagoAction(pago.id, leadId, pagado, pagado ? fechaPago : null); router.refresh(); }
      catch (err) { setFeedback({ kind: 'err', msg: err instanceof Error ? err.message : String(err) }); }
    });
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 11, border: '1px solid ' + (vencida ? 'var(--bad)' : 'var(--border-strong)'), padding: '11px 14px', flexWrap: 'wrap', background: pago.pagado ? 'var(--good-bg)' : 'var(--surface-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--ink)', fontWeight: 600, fontSize: 14 }}>{etiqueta}</span>
        <span style={{ color: 'var(--dim)', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(Number(pago.monto_usd))}</span>
        <span style={{ fontSize: 13, color: vencida ? 'var(--bad)' : 'var(--dim)' }}>
          {pago.pagado ? `cobrada el ${fmtDDMMYYYY(pago.fecha_pago)}` : `vence ${fmtDDMMYYYY(pago.fecha_esperada)}${vencida ? ' · vencida' : ''}`}
        </span>
      </div>
      {pago.pagado ? (
        <button type="button" onClick={() => marcar(false)} disabled={pending} style={{ fontSize: 13, color: 'var(--dim)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: SANS, opacity: pending ? 0.5 : 1 }}>deshacer</button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input className="lead-field" type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} style={{ width: 'auto' }} />
          <button type="button" onClick={() => marcar(true)} disabled={pending} style={{ padding: '8px 14px', borderRadius: 9, border: 'none', background: 'var(--good)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: SANS, opacity: pending ? 0.6 : 1 }}>Marcar pagada</button>
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 12.5, marginBottom: 6, color: 'var(--dim)' }}>{label}</span>
      {children}
      {hint && <span style={{ display: 'block', fontSize: 12, marginTop: 5, color: 'var(--faint)' }}>{hint}</span>}
    </label>
  );
}
