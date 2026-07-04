'use client';

// =============================================================================
// DealDetailsCard — tab "Deal Details" del lead
// =============================================================================
// Secciones (según el diseño aprobado): PAGOS (hero cobrado/total + semáforo +
// contrato con viewer + cuotas explícitas con marcar-pagada por comprobante o
// manual), DATOS FISCALES ("Facturado por" con las identidades del workspace +
// datos del cliente + doc fiscal), SERVICIO, PROMESA y OBLIGACIONES.
// Lectura = kv limpias; edición = un modo global con "Guardar deal" que llama
// saveDealSectionsAction (+ saveCuotasAction solo si se tocaron las cuotas).
// El resumen IA rellena SOLO lo vacío: nunca pisa lo cargado.

import { useEffect, useRef, useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Dropdown } from '@/app/components/Dropdown';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import type { Lead } from '@/lib/leads';
import type { Pago } from '@/lib/pagos';
import { marcarPagoAction } from '../actions';
import {
  getIdentidadesFiscalesAction,
  saveDealSectionsAction,
  saveCuotasAction,
  marcarPagoManualAction,
  type IdentidadFiscal,
} from './deal-actions';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

// ── Estilos compartidos (mismos tokens que el resto de app/leads/) ──────────
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };
const ghostBtn: CSSProperties = { padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS };
const outlineBtn: CSSProperties = { padding: '9px 14px', borderRadius: 10, border: '1px solid var(--primary)', background: 'transparent', color: 'var(--primary)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS };
const primaryBtn: CSSProperties = { padding: '10px 18px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS };
const goodBtn: CSSProperties = { padding: '8px 14px', borderRadius: 9, border: 'none', background: 'var(--good)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: SANS };
const linkBtn: CSSProperties = { background: 'transparent', border: 'none', color: 'var(--dim)', fontSize: 13, cursor: 'pointer', fontFamily: SANS, padding: 0 };
const dashedBtn: CSSProperties = { background: 'transparent', border: '1.5px dashed var(--border-strong)', color: 'var(--primary)', fontWeight: 600, fontSize: 13.5, padding: '11px 16px', borderRadius: 11, cursor: 'pointer', width: '100%', fontFamily: SANS };
const tagIA: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 10, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--accent)', background: '#FBF3DE', border: '1px solid #EBD9A8', borderRadius: 6, padding: '3px 8px' };
const docstrip: CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '13px 15px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, marginTop: 18 };
const chipWarn: CSSProperties = { fontSize: 13.5, color: 'var(--warn)', background: 'var(--warn-bg)', border: '1px solid var(--warn-fill)', borderRadius: 999, padding: '5px 13px', fontWeight: 600 };
const chipGood: CSSProperties = { fontSize: 13.5, color: 'var(--good)', background: 'var(--good-bg)', borderRadius: 999, padding: '5px 13px', fontWeight: 700 };
const grid2: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 };
const grid3: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 };
const hintStyle: CSSProperties = { display: 'block', fontSize: 11.5, marginTop: 5, color: 'var(--faint)' };
const readText: CSSProperties = { fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.55 };
const modalH3: CSSProperties = { margin: '0 0 4px', fontSize: 17, fontWeight: 600, color: 'var(--ink)' };
const modalSub: CSSProperties = { fontSize: 13, color: 'var(--dim)', margin: '0 0 16px', lineHeight: 1.5 };

function bannerStyle(kind: 'ok' | 'err' | 'warn'): CSSProperties {
  const map = {
    ok: { background: 'var(--good-bg)', color: 'var(--good)', border: 'none' },
    err: { background: 'var(--bad-bg)', color: 'var(--bad)', border: '1px solid #EBBFBC' },
    warn: { background: 'var(--warn-bg)', color: 'var(--warn)', border: '1px solid var(--warn-fill)' },
  } as const;
  return { borderRadius: 11, padding: '11px 16px', fontSize: 13.5, fontWeight: 600, lineHeight: 1.5, ...map[kind] };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtUSD(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function hoyISO(): string { return new Date().toISOString().slice(0, 10); }
function horaAhora(): string { return new Date().toTimeString().slice(0, 5); }
/** Días desde hoy (local) hasta una fecha YYYY-MM-DD. Negativo = vencida. */
function diasHasta(iso: string): number {
  const [y, m, dd] = iso.slice(0, 10).split('-').map(Number);
  const now = new Date();
  const hoy = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.UTC(y, m - 1, dd) - hoy) / 86400000);
}
/** Fecha para pantalla: dd/mm/aaaa si es ISO; si la IA dejó texto libre, tal cual. */
function fmtFechaLibre(v?: string | null): string | null {
  if (!v) return null;
  return /^\d{4}-\d{2}-\d{2}/.test(v) ? fmtDDMMYYYY(v) : v;
}
function unMesDespues(iso: string | null): string {
  const base = iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso : hoyISO();
  const [y, m, dd] = base.split('-').map(Number);
  return new Date(Date.UTC(y, m, Math.min(dd, 28))).toISOString().slice(0, 10);
}
function etiquetaCuota(numero: number | null): string {
  if (numero === null) return 'Nueva cuota';
  return numero === 0 ? 'Cobro inicial' : `Cuota ${numero}`;
}

// ── Piezas de UI chicas ──────────────────────────────────────────────────────
function Field({ label, hint, children, accent = false }: { label: string; hint?: string; children: ReactNode; accent?: boolean }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 12.5, marginBottom: 6, color: accent ? 'var(--accent)' : 'var(--dim)', fontWeight: accent ? 600 : 400 }}>{label}</span>
      {children}
      {hint && <span style={hintStyle}>{hint}</span>}
    </label>
  );
}

function Kv({ k, v, accent = false }: { k: string; v?: string | null; accent?: boolean }) {
  return (
    <div>
      <span style={{ display: 'block', fontSize: 12, color: accent ? 'var(--accent)' : 'var(--dim)', fontWeight: accent ? 600 : 400, marginBottom: 3 }}>{k}</span>
      <span style={{ display: 'block', ...readText }}>{v?.trim() ? v : '—'}</span>
    </div>
  );
}

function SectionHead({ title, tag }: { title: string; tag?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
      <div style={sectLabel}>{title}</div>
      {tag && <span style={tagIA}>◆ {tag}</span>}
    </div>
  );
}

function Semaforo({ tono, texto }: { tono: 'green' | 'amber' | 'red'; texto: string }) {
  const map = {
    green: { background: 'var(--good-bg)', color: 'var(--good)', border: 'none', dot: 'var(--good)' },
    amber: { background: 'var(--warn-bg)', color: 'var(--warn)', border: '1px solid var(--warn-fill)', dot: 'var(--warn-fill)' },
    red: { background: 'var(--bad-bg)', color: 'var(--bad)', border: '1px solid #EBBFBC', dot: 'var(--bad)' },
  } as const;
  const s = map[tono];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 13px', borderRadius: 999, fontWeight: 600, fontSize: 13, background: s.background, color: s.color, border: s.border }}>
      <span style={{ width: 9, height: 9, borderRadius: 999, background: s.dot }} />
      {texto}
    </span>
  );
}

function DocViewer({ src, nombre, onClose }: { src: string; nombre: string; onClose: () => void }) {
  return (
    <div style={{ marginTop: 14, border: '1px solid var(--border-strong)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 13px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--dim)' }}>{nombre}</span>
        <button type="button" style={linkBtn} onClick={onClose}>Cerrar preview</button>
      </div>
      <iframe src={src} title={nombre} style={{ display: 'block', width: '100%', height: 380, border: 'none', background: 'var(--surface-2)' }} />
    </div>
  );
}

function Modal({ onClose, width = 440, children }: { onClose: () => void; width?: number; children: ReactNode }) {
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(18,21,27,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 60, fontFamily: SANS }}
    >
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: width, padding: '22px 24px', boxShadow: '0 18px 60px rgba(20,30,50,.28)', maxHeight: '90vh', overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

// ── Borradores del modo edición ──────────────────────────────────────────────
type DraftCuota = {
  key: number;
  id: number | null;
  numero: number | null;
  monto: string;
  fecha: string;
  pagado: boolean;
  fecha_pago: string | null;
};

type Drafts = {
  razon: string; idFiscal: string; domicilio: string; correo: string; facturadoPor: string;
  queEs: string; fechaInicio: string; fechaTermino: string; duracion: string; frecuencia: string; modalidad: string; sesiones: string;
  resultado: string; garantia: string;
  obCliente: string; obPrestador: string;
  cuotas: DraftCuota[]; cuotasDirty: boolean;
};

type ExtractResp = {
  error?: string;
  contrato_nombre?: string | null;
  total_usd?: number | null;
  duracion_meses?: number | null;
  cuotas?: Array<{ monto?: number | null; fecha?: string | null }>;
  deal_fiscal?: { razon?: string | null; id_fiscal?: string | null; domicilio?: string | null; correo?: string | null } | null;
  deal_servicio?: { que_es?: string | null; fecha_inicio?: string | null; fecha_termino?: string | null; duracion?: string | null; frecuencia?: string | null; modalidad?: string | null; sesiones?: string | null } | null;
  deal_promesa?: { resultado?: string | null; garantia?: string | null } | null;
  deal_obligaciones?: { cliente?: string[]; prestador?: string[] } | null;
};

// =============================================================================
// Componente principal
// =============================================================================
export function DealDetailsCard({ lead, pagos, editable = true }: { lead: Lead; pagos: Pago[]; editable?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  // null = modo lectura (se renderiza directo de lead/pagos); Drafts = edición.
  const [d, setD] = useState<Drafts | null>(null);
  const dRef = useRef<Drafts | null>(null);
  dRef.current = d;
  const nextKey = useRef(-1);

  const [identidades, setIdentidades] = useState<IdentidadFiscal[] | null>(null);
  const [verContrato, setVerContrato] = useState(false);
  const [verFiscal, setVerFiscal] = useState(false);
  const [modal, setModal] = useState<{ tipo: 'pagar' | 'comprobante'; pago: Pago } | null>(null);

  // Contrato: nombre optimista tras subir uno nuevo (hasta el refresh).
  const [contratoSubido, setContratoSubido] = useState<string | null>(null);
  const [extrayendo, setExtrayendo] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const contratoNombre = contratoSubido ?? lead.contrato_nombre ?? null;
  const tieneContrato = !!lead.contrato_path || contratoSubido !== null;

  useEffect(() => {
    let alive = true;
    getIdentidadesFiscalesAction()
      .then((l) => { if (alive) setIdentidades(l); })
      .catch(() => { if (alive) setIdentidades([]); });
    return () => { alive = false; };
  }, []);

  // ── Totales / semáforo (lectura desde pagos; edición desde los borradores) ──
  const cuotasVista = d
    ? d.cuotas.map((c) => ({ monto: parseFloat(c.monto) || 0, fecha: c.fecha || null, pagado: c.pagado }))
    : pagos.map((p) => ({ monto: Number(p.monto_usd), fecha: p.fecha_esperada, pagado: p.pagado }));
  const cobrado = cuotasVista.filter((c) => c.pagado).reduce((s, c) => s + c.monto, 0);
  const total = cuotasVista.reduce((s, c) => s + c.monto, 0);
  const pend = total - cobrado;
  const montoCierre = lead.monto_cierre_usd ?? 0;
  const totalMostrar = total > 0 ? total : montoCierre;
  const pct = total > 0 ? Math.min(100, Math.round((cobrado / total) * 100)) : 0;

  const hayVencida = cuotasVista.some((c) => !c.pagado && c.fecha && diasHasta(c.fecha) < 0);
  const haySoon = cuotasVista.some((c) => !c.pagado && c.fecha && diasHasta(c.fecha) >= 0 && diasHasta(c.fecha) <= 14);
  const sem: { tono: 'green' | 'amber' | 'red'; texto: string } =
    total > 0 && pend <= 0 ? { tono: 'green', texto: 'Pagado por completo' }
    : hayVencida ? { tono: 'red', texto: 'Cuota vencida' }
    : haySoon ? { tono: 'amber', texto: 'Cuota por vencer' }
    : { tono: 'green', texto: 'Al corriente' };

  // ── Modo edición ────────────────────────────────────────────────────────────
  const enterEdit = () => {
    setFeedback(null);
    setD({
      razon: lead.deal_fiscal?.razon ?? '', idFiscal: lead.deal_fiscal?.id_fiscal ?? '', domicilio: lead.deal_fiscal?.domicilio ?? '', correo: lead.deal_fiscal?.correo ?? '',
      facturadoPor: lead.facturado_por_id != null ? String(lead.facturado_por_id) : '',
      queEs: lead.deal_servicio?.que_es ?? '', fechaInicio: lead.deal_servicio?.fecha_inicio ?? '', fechaTermino: lead.deal_servicio?.fecha_termino ?? '',
      duracion: lead.deal_servicio?.duracion ?? '', frecuencia: lead.deal_servicio?.frecuencia ?? '', modalidad: lead.deal_servicio?.modalidad ?? '', sesiones: lead.deal_servicio?.sesiones ?? '',
      resultado: lead.deal_promesa?.resultado ?? '', garantia: lead.deal_promesa?.garantia ?? '',
      obCliente: (lead.deal_obligaciones?.cliente ?? []).join('\n'), obPrestador: (lead.deal_obligaciones?.prestador ?? []).join('\n'),
      cuotas: pagos.map((p) => ({ key: p.id, id: p.id, numero: p.numero, monto: String(p.monto_usd), fecha: p.fecha_esperada ?? '', pagado: p.pagado, fecha_pago: p.fecha_pago })),
      cuotasDirty: false,
    });
  };
  const cancelar = () => { setD(null); setFeedback(null); };
  const upd = (patch: Partial<Drafts>) => setD((prev) => (prev ? { ...prev, ...patch } : prev));

  const setCuota = (i: number, patch: Partial<DraftCuota>) => setD((prev) => {
    if (!prev) return prev;
    const cuotas = prev.cuotas.slice();
    cuotas[i] = { ...cuotas[i], ...patch };
    return { ...prev, cuotas, cuotasDirty: true };
  });
  const quitarCuota = (i: number) => setD((prev) => (prev ? { ...prev, cuotas: prev.cuotas.filter((_, j) => j !== i), cuotasDirty: true } : prev));
  const agregarCuota = () => setD((prev) => {
    if (!prev) return prev;
    const ultima = prev.cuotas[prev.cuotas.length - 1] ?? null;
    const nueva: DraftCuota = { key: nextKey.current--, id: null, numero: null, monto: '', fecha: unMesDespues(ultima?.fecha || null), pagado: false, fecha_pago: null };
    return { ...prev, cuotas: [...prev.cuotas, nueva], cuotasDirty: true };
  });

  const t = (s: string): string | null => (s.trim() ? s.trim() : null);
  const lineas = (s: string): string[] => s.split('\n').map((x) => x.trim()).filter(Boolean);

  const guardar = () => {
    const draft = d;
    if (!draft) return;
    setFeedback(null);
    startTransition(async () => {
      try {
        await saveDealSectionsAction(lead.id, {
          // Se preservan doc_path / doc_nombre del doc fiscal ya subido.
          deal_fiscal: { ...(lead.deal_fiscal ?? {}), razon: t(draft.razon), id_fiscal: t(draft.idFiscal), domicilio: t(draft.domicilio), correo: t(draft.correo) },
          deal_servicio: { que_es: t(draft.queEs), fecha_inicio: t(draft.fechaInicio), fecha_termino: t(draft.fechaTermino), duracion: t(draft.duracion), frecuencia: t(draft.frecuencia), modalidad: t(draft.modalidad), sesiones: t(draft.sesiones) },
          deal_promesa: { resultado: t(draft.resultado), garantia: t(draft.garantia) },
          deal_obligaciones: { cliente: lineas(draft.obCliente), prestador: lineas(draft.obPrestador) },
          facturado_por_id: draft.facturadoPor ? Number(draft.facturadoPor) : null,
        });
        if (draft.cuotasDirty) {
          await saveCuotasAction(lead.id, draft.cuotas.map((c) => ({ monto: parseFloat(c.monto) || 0, fecha: c.fecha || null, pagado: c.pagado })));
        }
        setD(null);
        setFeedback({ kind: 'ok', msg: 'Deal guardado' });
        router.refresh();
      } catch (err) {
        setFeedback({ kind: 'err', msg: err instanceof Error ? err.message : String(err) });
      }
    });
  };

  // ── Contrato: reemplazar y releer (solo edición). Rellena SOLO lo vacío ────
  const aplicarExtraccion = (j: ExtractResp): string[] => {
    const base = dRef.current;
    if (!base) return [];
    const next: Drafts = { ...base, cuotas: base.cuotas.slice() };
    const rellenado: string[] = [];
    const marca = (label: string) => { if (!rellenado.includes(label)) rellenado.push(label); };
    const setIf = (k: 'razon' | 'idFiscal' | 'domicilio' | 'correo' | 'queEs' | 'fechaInicio' | 'fechaTermino' | 'duracion' | 'frecuencia' | 'modalidad' | 'sesiones' | 'resultado' | 'garantia', val: string | null | undefined, label: string) => {
      if (val && !next[k].trim()) { next[k] = val; marca(label); }
    };
    setIf('razon', j.deal_fiscal?.razon, 'datos fiscales');
    setIf('idFiscal', j.deal_fiscal?.id_fiscal, 'datos fiscales');
    setIf('domicilio', j.deal_fiscal?.domicilio, 'datos fiscales');
    setIf('correo', j.deal_fiscal?.correo, 'datos fiscales');
    setIf('queEs', j.deal_servicio?.que_es, 'servicio');
    setIf('fechaInicio', j.deal_servicio?.fecha_inicio, 'servicio');
    setIf('fechaTermino', j.deal_servicio?.fecha_termino, 'servicio');
    setIf('duracion', j.deal_servicio?.duracion, 'servicio');
    setIf('frecuencia', j.deal_servicio?.frecuencia, 'servicio');
    setIf('modalidad', j.deal_servicio?.modalidad, 'servicio');
    setIf('sesiones', j.deal_servicio?.sesiones, 'servicio');
    setIf('resultado', j.deal_promesa?.resultado, 'promesa');
    setIf('garantia', j.deal_promesa?.garantia, 'promesa');
    if (j.deal_obligaciones?.cliente?.length && !next.obCliente.trim()) { next.obCliente = j.deal_obligaciones.cliente.join('\n'); marca('obligaciones'); }
    if (j.deal_obligaciones?.prestador?.length && !next.obPrestador.trim()) { next.obPrestador = j.deal_obligaciones.prestador.join('\n'); marca('obligaciones'); }
    // Cuotas: solo si no hay ninguna sin pagar ya cargada (no pisar lo existente).
    const extraidas = (j.cuotas ?? []).filter((c) => Number(c?.monto) > 0);
    const hayCuotasCargadas = next.cuotas.some((c) => !c.pagado && (parseFloat(c.monto) || 0) > 0);
    if (extraidas.length > 0 && !hayCuotasCargadas) {
      next.cuotas = [
        ...next.cuotas.filter((c) => c.pagado),
        ...extraidas.map((c) => ({ key: nextKey.current--, id: null, numero: null, monto: String(c.monto), fecha: c.fecha && /^\d{4}-\d{2}-\d{2}/.test(c.fecha) ? c.fecha.slice(0, 10) : '', pagado: false, fecha_pago: null } as DraftCuota)),
      ];
      next.cuotasDirty = true;
      marca('cuotas');
    }
    setD(next);
    return rellenado;
  };

  const subirContrato = async (file: File) => {
    setFeedback(null);
    setExtrayendo(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('leadId', String(lead.id));
      const r = await fetch('/api/extract-contract', { method: 'POST', body: fd });
      const j: ExtractResp = await r.json();
      if (j.error) throw new Error(j.error);
      if (j.contrato_nombre) setContratoSubido(j.contrato_nombre);
      const rellenado = aplicarExtraccion(j);
      setFeedback({
        kind: 'ok',
        msg: rellenado.length
          ? `Contrato leído. Se rellenó solo lo vacío: ${rellenado.join(', ')}. Revisá y tocá Guardar deal.`
          : 'Contrato leído: no había campos vacíos para rellenar (lo cargado no se pisa).',
      });
    } catch (err) {
      setFeedback({ kind: 'err', msg: `No se pudo leer el contrato: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setExtrayendo(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // ── Cuotas (lectura): deshacer un pago ──────────────────────────────────────
  const deshacerPago = (p: Pago) => {
    setFeedback(null);
    startTransition(async () => {
      try { await marcarPagoAction(p.id, lead.id, false, null); router.refresh(); }
      catch (err) { setFeedback({ kind: 'err', msg: err instanceof Error ? err.message : String(err) }); }
    });
  };

  // ── Facturado por (texto en lectura) ────────────────────────────────────────
  const identSel = lead.facturado_por_id != null ? identidades?.find((i) => i.id === lead.facturado_por_id) : undefined;
  const facturadoPorTexto = lead.facturado_por_id == null
    ? '—'
    : identSel ? `${identSel.nombre}${identSel.id_fiscal ? ` · ${identSel.id_fiscal}` : ''}`
    : identidades === null ? 'Cargando…' : '—';

  // Banner de cuadre (edición): suma de TODAS las cuotas vs monto de cierre.
  const sumaTodas = d ? d.cuotas.reduce((s, c) => s + (parseFloat(c.monto) || 0), 0) : 0;
  const diff = Math.round((sumaTodas - montoCierre) * 100) / 100;
  const cuadra = Math.abs(diff) < 0.5;

  const barraAcciones = editable && (
    d ? (
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" style={ghostBtn} onClick={cancelar} disabled={pending}>Cancelar</button>
        <button type="button" style={{ ...primaryBtn, opacity: pending ? 0.6 : 1 }} onClick={guardar} disabled={pending}>{pending ? 'Guardando…' : 'Guardar deal'}</button>
      </div>
    ) : (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" style={primaryBtn} onClick={enterEdit}>Editar deal</button>
      </div>
    )
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {barraAcciones}
      {feedback && <div style={bannerStyle(feedback.kind)}>{feedback.msg}</div>}

      {/* 1 · PAGOS */}
      <section style={card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div style={sectLabel}>Pagos</div>
            <div style={{ fontSize: 26, fontWeight: 600, color: 'var(--ink)', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
              {fmtUSD(cobrado)} <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--dim)' }}>cobrado de {fmtUSD(totalMostrar > 0 ? totalMostrar : null)}</span>
            </div>
            {montoCierre > 0 && (
              <div style={{ marginTop: 6, fontSize: 13, color: 'var(--dim)' }}>
                Monto de cierre <b style={{ color: 'var(--ink)' }}>USD {fmtUSD(montoCierre)}</b>
                {lead.fecha_cierre ? ` · fecha de cierre ${fmtDDMMYYYY(lead.fecha_cierre)}` : ''}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <Semaforo tono={sem.tono} texto={sem.texto} />
            {pend > 0 && <span style={chipWarn}>Pendiente {fmtUSD(pend)}</span>}
            {total > 0 && pend <= 0 && <span style={chipGood}>Pagado</span>}
          </div>
        </div>
        {total > 0 && (
          <div style={{ height: 8, borderRadius: 999, background: 'var(--border)', marginTop: 12, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--good)', transition: 'width .3s' }} />
          </div>
        )}

        {/* Contrato */}
        <div style={docstrip}>
          <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void subirContrato(f); }} />
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{contratoNombre ?? 'Sin contrato cargado'}</div>
            <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 2 }}>
              {tieneContrato
                ? 'Al subir uno nuevo se rellenan las secciones de abajo (solo lo que esté vacío).'
                : 'Subí el contrato (PDF o foto) y las secciones de abajo se rellenan solas.'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {tieneContrato && (
              <button type="button" style={ghostBtn} onClick={() => setVerContrato((v) => !v)}>{verContrato ? 'Cerrar contrato' : 'Ver contrato'}</button>
            )}
            {tieneContrato && (
              <a href={`/api/contract?leadId=${lead.id}`} style={{ ...ghostBtn, textDecoration: 'none', display: 'inline-block' }}>Descargar</a>
            )}
            {editable && d && (
              <button type="button" style={{ ...outlineBtn, opacity: extrayendo ? 0.6 : 1 }} onClick={() => fileRef.current?.click()} disabled={extrayendo}>
                {extrayendo ? 'Leyendo contrato…' : tieneContrato ? 'Reemplazar y releer' : 'Subir contrato'}
              </button>
            )}
          </div>
        </div>
        {verContrato && tieneContrato && (
          <DocViewer src={`/api/doc?leadId=${lead.id}&kind=contrato`} nombre={contratoNombre ?? 'Contrato'} onClose={() => setVerContrato(false)} />
        )}

        {/* Cuotas */}
        <div style={{ marginTop: 22 }}>
          <div style={{ ...sectLabel, marginBottom: 12 }}>Cuotas</div>

          {!d && (
            pagos.length === 0 ? (
              <div style={{ fontSize: 13.5, color: 'var(--faint)' }}>Sin cuotas cargadas. Entrá a editar el deal para agregarlas o subí el contrato.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {pagos.map((p) => {
                  const dt = p.fecha_esperada ? diasHasta(p.fecha_esperada) : null;
                  const vencida = !p.pagado && dt !== null && dt < 0;
                  const porVencer = !p.pagado && dt !== null && dt >= 0 && dt <= 14;
                  const borde = p.pagado ? '#BFE6CD' : vencida ? 'var(--bad)' : porVencer ? 'var(--warn-fill)' : 'var(--border-strong)';
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, border: `1px solid ${borde}`, borderRadius: 11, padding: '11px 14px', background: p.pagado ? 'var(--good-bg)' : 'var(--surface-2)', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <span style={{ color: 'var(--ink)', fontWeight: 600, fontSize: 14 }}>{etiquetaCuota(p.numero)}</span>
                        <span style={{ color: 'var(--dim)', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(Number(p.monto_usd))}</span>
                        <span style={{ fontSize: 13, color: vencida ? 'var(--bad)' : porVencer ? 'var(--warn)' : 'var(--dim)' }}>
                          {p.pagado
                            ? `cobrada el ${fmtDDMMYYYY(p.fecha_pago)}${p.pago_hora ? ` · ${p.pago_hora.slice(0, 5)}` : ''}`
                            : vencida
                              ? `venció ${fmtDDMMYYYY(p.fecha_esperada)} · vencida`
                              : `vence ${fmtDDMMYYYY(p.fecha_esperada)}${porVencer && dt !== null ? (dt === 0 ? ' · hoy' : ` · en ${dt} día${dt === 1 ? '' : 's'}`) : ''}`}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        {p.pagado ? (
                          <>
                            {p.comprobante_path && (
                              <button type="button" style={{ ...linkBtn, color: 'var(--primary)', fontWeight: 600 }} onClick={() => setModal({ tipo: 'comprobante', pago: p })}>Ver comprobante</button>
                            )}
                            {editable && (
                              <button type="button" style={{ ...linkBtn, opacity: pending ? 0.5 : 1 }} disabled={pending} onClick={() => deshacerPago(p)}>deshacer</button>
                            )}
                          </>
                        ) : (
                          editable && <button type="button" style={goodBtn} onClick={() => setModal({ tipo: 'pagar', pago: p })}>Marcar pagada</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {d && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {d.cuotas.map((c, i) => (
                  <div key={c.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, border: `1px solid ${c.pagado ? '#BFE6CD' : 'var(--border-strong)'}`, borderRadius: 11, padding: '11px 14px', background: c.pagado ? 'var(--good-bg)' : 'var(--surface-2)', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--ink)', fontWeight: 600, fontSize: 14 }}>{etiquetaCuota(c.numero)}</span>
                      {c.pagado ? (
                        <>
                          <span style={{ color: 'var(--dim)', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(parseFloat(c.monto) || 0)}</span>
                          <span style={{ fontSize: 13, color: 'var(--dim)' }}>cobrada el {fmtDDMMYYYY(c.fecha_pago)}</span>
                        </>
                      ) : (
                        <>
                          <input className="lead-field" type="number" min={0} step="0.01" value={c.monto} onChange={(e) => setCuota(i, { monto: e.target.value })} style={{ width: 112 }} aria-label={`Monto ${etiquetaCuota(c.numero)}`} />
                          <input className="lead-field" type="date" value={c.fecha} onChange={(e) => setCuota(i, { fecha: e.target.value })} style={{ width: 'auto' }} aria-label={`Vencimiento ${etiquetaCuota(c.numero)}`} />
                        </>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {c.pagado ? (
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--good)', background: '#fff', border: '1px solid #BFE6CD', borderRadius: 999, padding: '2px 9px' }}>pagada</span>
                      ) : (
                        <button type="button" style={linkBtn} onClick={() => quitarCuota(i)}>quitar</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10 }}>
                <button type="button" style={dashedBtn} onClick={agregarCuota}>+ Agregar cuota</button>
              </div>
              {montoCierre > 0 && (
                <div style={{ ...bannerStyle(cuadra ? 'ok' : 'err'), marginTop: 12, fontWeight: cuadra ? 600 : 500 }}>
                  {cuadra
                    ? `Cuadra: las cuotas suman ${fmtUSD(sumaTodas)} y coinciden con el cierre de ${fmtUSD(montoCierre)}.`
                    : `Las cuotas suman ${fmtUSD(sumaTodas)} y ${diff > 0 ? 'exceden' : 'no alcanzan'} el cierre de ${fmtUSD(montoCierre)} por ${fmtUSD(Math.abs(diff))}. Ajustá los montos para que cuadren.`}
                </div>
              )}
            </>
          )}

          <p style={{ fontSize: 12, color: 'var(--faint)', marginTop: 10 }}>El cash del dashboard lee de acá.</p>
        </div>
      </section>

      {/* 2 · DATOS FISCALES */}
      <section style={card}>
        <SectionHead title="Datos fiscales" tag="Extraído del documento" />

        <div style={{ maxWidth: 440, marginBottom: 18 }}>
          <span style={{ display: 'block', fontSize: 12.5, marginBottom: 6, color: 'var(--dim)' }}>Facturado por</span>
          {d ? (
            <Dropdown
              value={d.facturadoPor}
              onChange={(v) => upd({ facturadoPor: v })}
              width="100%"
              ariaLabel="Facturado por"
              disabled={identidades === null}
              placeholder={identidades === null ? 'Cargando…' : 'Elegí una identidad'}
              options={[
                { value: '', label: 'Sin definir' },
                ...(identidades ?? []).map((i) => ({ value: String(i.id), label: i.nombre, sub: i.id_fiscal ?? undefined })),
              ]}
            />
          ) : (
            <div style={readText}>{facturadoPorTexto}</div>
          )}
          <span style={hintStyle}>Tus identidades fiscales se configuran una sola vez en Configuraciones.</span>
        </div>

        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dim)', marginBottom: 12 }}>Cliente (a facturar)</div>
        {d ? (
          <div style={grid2}>
            <Field label="Razón fiscal / nombre"><input className="lead-field" value={d.razon} onChange={(e) => upd({ razon: e.target.value })} /></Field>
            <Field label="Identificación fiscal" hint="RFC, CUIT, NIT, EIN… según país."><input className="lead-field" value={d.idFiscal} onChange={(e) => upd({ idFiscal: e.target.value })} /></Field>
            <Field label="Domicilio fiscal"><input className="lead-field" value={d.domicilio} onChange={(e) => upd({ domicilio: e.target.value })} /></Field>
            <Field label="Correo de facturación"><input className="lead-field" type="email" value={d.correo} onChange={(e) => upd({ correo: e.target.value })} /></Field>
          </div>
        ) : (
          <div style={grid2}>
            <Kv k="Razón fiscal / nombre" v={lead.deal_fiscal?.razon} />
            <Kv k="Identificación fiscal" v={lead.deal_fiscal?.id_fiscal} />
            <Kv k="Domicilio fiscal" v={lead.deal_fiscal?.domicilio} />
            <Kv k="Correo de facturación" v={lead.deal_fiscal?.correo} />
          </div>
        )}

        {lead.deal_fiscal?.doc_path && (
          <>
            <div style={docstrip}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{lead.deal_fiscal.doc_nombre ?? 'Documento fiscal'}</div>
                <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 2 }}>Documento fiscal del cliente: de acá salen los 4 campos.</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" style={ghostBtn} onClick={() => setVerFiscal((v) => !v)}>{verFiscal ? 'Cerrar documento' : 'Ver documento'}</button>
                <a href={`/api/doc?leadId=${lead.id}&kind=fiscal&download=1`} style={{ ...ghostBtn, textDecoration: 'none', display: 'inline-block' }}>Descargar</a>
              </div>
            </div>
            {verFiscal && (
              <DocViewer src={`/api/doc?leadId=${lead.id}&kind=fiscal`} nombre={lead.deal_fiscal.doc_nombre ?? 'Documento fiscal'} onClose={() => setVerFiscal(false)} />
            )}
          </>
        )}
      </section>

      {/* 3 · SERVICIO */}
      <section style={card}>
        <SectionHead title="Servicio" tag="Resumido por IA · editable" />
        {d ? (
          <>
            <div style={{ marginBottom: 14 }}>
              <Field label="Qué es"><textarea className="lead-field" style={{ minHeight: 66, lineHeight: 1.5 }} value={d.queEs} onChange={(e) => upd({ queEs: e.target.value })} /></Field>
            </div>
            <div style={grid3}>
              <Field label="Fecha de inicio"><input className="lead-field" type={!d.fechaInicio || /^\d{4}-\d{2}-\d{2}$/.test(d.fechaInicio) ? 'date' : 'text'} value={d.fechaInicio} onChange={(e) => upd({ fechaInicio: e.target.value })} /></Field>
              <Field label="Fecha de término"><input className="lead-field" type={!d.fechaTermino || /^\d{4}-\d{2}-\d{2}$/.test(d.fechaTermino) ? 'date' : 'text'} value={d.fechaTermino} onChange={(e) => upd({ fechaTermino: e.target.value })} /></Field>
              <Field label="Duración"><input className="lead-field" value={d.duracion} onChange={(e) => upd({ duracion: e.target.value })} /></Field>
              <Field label="Frecuencia"><input className="lead-field" value={d.frecuencia} onChange={(e) => upd({ frecuencia: e.target.value })} /></Field>
              <Field label="Modalidad"><input className="lead-field" value={d.modalidad} onChange={(e) => upd({ modalidad: e.target.value })} /></Field>
              <Field label="Sesiones"><input className="lead-field" value={d.sesiones} onChange={(e) => upd({ sesiones: e.target.value })} /></Field>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}><Kv k="Qué es" v={lead.deal_servicio?.que_es} /></div>
            <div style={grid3}>
              <Kv k="Fecha de inicio" v={fmtFechaLibre(lead.deal_servicio?.fecha_inicio)} />
              <Kv k="Fecha de término" v={fmtFechaLibre(lead.deal_servicio?.fecha_termino)} />
              <Kv k="Duración" v={lead.deal_servicio?.duracion} />
              <Kv k="Frecuencia" v={lead.deal_servicio?.frecuencia} />
              <Kv k="Modalidad" v={lead.deal_servicio?.modalidad} />
              <Kv k="Sesiones" v={lead.deal_servicio?.sesiones} />
            </div>
          </>
        )}
      </section>

      {/* 4 · PROMESA */}
      <section style={card}>
        <SectionHead title="Promesa" tag="Resumido por IA · editable" />
        {d ? (
          <>
            <div style={{ marginBottom: 16 }}>
              <Field label="Resultado prometido"><textarea className="lead-field" style={{ minHeight: 66, lineHeight: 1.5 }} value={d.resultado} onChange={(e) => upd({ resultado: e.target.value })} /></Field>
            </div>
            <div style={{ height: 1, background: 'var(--border)', margin: '18px 0' }} />
            <Field label="Garantía" accent><textarea className="lead-field" style={{ minHeight: 66, lineHeight: 1.5 }} value={d.garantia} onChange={(e) => upd({ garantia: e.target.value })} /></Field>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}><Kv k="Resultado prometido" v={lead.deal_promesa?.resultado} /></div>
            <div style={{ height: 1, background: 'var(--border)', margin: '18px 0' }} />
            <Kv k="Garantía" v={lead.deal_promesa?.garantia} accent />
          </>
        )}
      </section>

      {/* 5 · OBLIGACIONES */}
      <section style={card}>
        <SectionHead title="Obligaciones" tag="Resumido por IA · editable" />
        {d ? (
          <div style={grid2}>
            <Field label="Del cliente (uno por línea)"><textarea className="lead-field" style={{ minHeight: 120, lineHeight: 1.6 }} value={d.obCliente} onChange={(e) => upd({ obCliente: e.target.value })} /></Field>
            <Field label="Del prestador (uno por línea)"><textarea className="lead-field" style={{ minHeight: 120, lineHeight: 1.6 }} value={d.obPrestador} onChange={(e) => upd({ obPrestador: e.target.value })} /></Field>
          </div>
        ) : (
          <div style={grid2}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dim)', marginBottom: 10 }}>Del cliente</div>
              {(lead.deal_obligaciones?.cliente ?? []).length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: 'var(--ink)', lineHeight: 1.7 }}>
                  {(lead.deal_obligaciones?.cliente ?? []).map((o, i) => <li key={i}>{o}</li>)}
                </ul>
              ) : <div style={readText}>—</div>}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dim)', marginBottom: 10 }}>Del prestador</div>
              {(lead.deal_obligaciones?.prestador ?? []).length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: 'var(--ink)', lineHeight: 1.7 }}>
                  {(lead.deal_obligaciones?.prestador ?? []).map((o, i) => <li key={i}>{o}</li>)}
                </ul>
              ) : <div style={readText}>—</div>}
            </div>
          </div>
        )}
      </section>

      {d && editable && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" style={ghostBtn} onClick={cancelar} disabled={pending}>Cancelar</button>
          <button type="button" style={{ ...primaryBtn, opacity: pending ? 0.6 : 1 }} onClick={guardar} disabled={pending}>{pending ? 'Guardando…' : 'Guardar deal'}</button>
        </div>
      )}

      {modal?.tipo === 'pagar' && (
        <PayModal
          pago={modal.pago}
          leadId={lead.id}
          onClose={() => setModal(null)}
          onDone={(msg) => { setModal(null); setFeedback({ kind: 'ok', msg }); router.refresh(); }}
        />
      )}
      {modal?.tipo === 'comprobante' && (
        <ComprobanteModal pago={modal.pago} leadId={lead.id} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

// =============================================================================
// Pop-up: marcar una cuota como pagada — comprobante con IA o registro manual
// =============================================================================
function PayModal({ pago, leadId, onClose, onDone }: { pago: Pago; leadId: number; onClose: () => void; onDone: (msg: string) => void }) {
  const etiqueta = etiquetaCuota(pago.numero);
  const [step, setStep] = useState<'elegir' | 'manual' | 'extraido'>('elegir');
  const [leyendo, setLeyendo] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [ext, setExt] = useState<{ monto: number | null; fecha: string | null; hora: string | null; nombre: string } | null>(null);
  const [monto, setMonto] = useState(String(pago.monto_usd));
  const [fecha, setFecha] = useState(hoyISO());
  const [hora, setHora] = useState(horaAhora());

  const subir = async (file: File) => {
    setErr(null);
    setLeyendo(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('pagoId', String(pago.id));
      fd.append('leadId', String(leadId));
      const r = await fetch('/api/extract-receipt', { method: 'POST', body: fd });
      const j: { error?: string; monto?: number | null; fecha?: string | null; hora?: string | null; comprobante_nombre?: string | null } = await r.json();
      if (j.error) throw new Error(j.error);
      setExt({
        monto: j.monto != null && Number.isFinite(Number(j.monto)) ? Number(j.monto) : null,
        fecha: j.fecha ?? null,
        hora: j.hora ?? null,
        nombre: j.comprobante_nombre ?? file.name,
      });
      setStep('extraido');
    } catch (e) {
      setErr(`No se pudo leer el comprobante: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLeyendo(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const confirmar = (datos: { monto?: number | null; fecha: string; hora?: string | null }) => {
    setErr(null);
    startTransition(async () => {
      try {
        await marcarPagoManualAction(pago.id, leadId, datos);
        onDone(`${etiqueta} marcada como pagada`);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const rowStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', fontSize: 13.5, padding: '5px 0', borderBottom: '1px dashed var(--border)' };

  return (
    <Modal onClose={onClose}>
      <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void subir(f); }} />

      {step === 'elegir' && (
        <>
          <h3 style={modalH3}>Marcar {etiqueta} como pagada</h3>
          <p style={modalSub}>Subí el comprobante y la IA extrae monto, fecha y hora. Si no lo tenés, registralo manual.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button type="button" style={{ ...primaryBtn, width: '100%', opacity: leyendo ? 0.6 : 1 }} onClick={() => fileRef.current?.click()} disabled={leyendo}>
              {leyendo ? 'Leyendo comprobante…' : 'Subir comprobante'}
            </button>
            <button type="button" style={{ ...ghostBtn, width: '100%' }} onClick={() => setStep('manual')} disabled={leyendo}>Ingresar manual</button>
          </div>
          <div style={{ textAlign: 'center', marginTop: 14 }}>
            <button type="button" style={linkBtn} onClick={onClose}>Cancelar</button>
          </div>
        </>
      )}

      {step === 'extraido' && ext && (
        <>
          <h3 style={modalH3}>Comprobante leído</h3>
          <p style={modalSub}>Revisá lo extraído antes de confirmar {etiqueta.toLowerCase()}.</p>
          <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', margin: '6px 0 14px' }}>
            <div style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', padding: '10px 14px', fontFamily: MONO, fontSize: 12, color: 'var(--dim)', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ext.nombre}</span>
              <span style={{ color: 'var(--accent)' }}>◆ IA</span>
            </div>
            <div style={{ padding: '12px 16px' }}>
              <div style={rowStyle}><span style={{ color: 'var(--dim)' }}>Monto</span><span style={{ color: 'var(--ink)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{ext.monto != null ? fmtUSD(ext.monto) : `${fmtUSD(Number(pago.monto_usd))} (de la cuota)`}</span></div>
              <div style={rowStyle}><span style={{ color: 'var(--dim)' }}>Fecha</span><span style={{ color: 'var(--ink)', fontWeight: 600 }}>{ext.fecha ? fmtDDMMYYYY(ext.fecha) : `${fmtDDMMYYYY(hoyISO())} (hoy)`}</span></div>
              <div style={{ ...rowStyle, borderBottom: 'none' }}><span style={{ color: 'var(--dim)' }}>Hora</span><span style={{ color: 'var(--ink)', fontWeight: 600 }}>{ext.hora ?? '—'}</span></div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              style={{ ...goodBtn, flex: 1, padding: '10px 14px', opacity: pending ? 0.6 : 1 }}
              disabled={pending}
              onClick={() => confirmar({ monto: ext.monto, fecha: ext.fecha ?? hoyISO(), hora: ext.hora })}
            >
              {pending ? 'Guardando…' : 'Confirmar pago'}
            </button>
            <button type="button" style={ghostBtn} onClick={() => setStep('elegir')} disabled={pending}>Volver</button>
          </div>
        </>
      )}

      {step === 'manual' && (
        <>
          <h3 style={modalH3}>Registro manual · {etiqueta}</h3>
          <p style={modalSub}>Sin comprobante: cargá los datos del pago.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 12 }}>
            <Field label="Monto (USD)"><input className="lead-field" type="number" min={0} step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} /></Field>
            <Field label="Fecha"><input className="lead-field" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
            <Field label="Hora"><input className="lead-field" type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></Field>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              type="button"
              style={{ ...goodBtn, flex: 1, padding: '10px 14px', opacity: pending || !fecha ? 0.6 : 1 }}
              disabled={pending || !fecha}
              onClick={() => confirmar({ monto: parseFloat(monto) || null, fecha, hora: hora || null })}
            >
              {pending ? 'Guardando…' : 'Guardar pago'}
            </button>
            <button type="button" style={ghostBtn} onClick={() => setStep('elegir')} disabled={pending}>Volver</button>
          </div>
        </>
      )}

      {err && <div style={{ ...bannerStyle('err'), marginTop: 12 }}>{err}</div>}
    </Modal>
  );
}

// =============================================================================
// Pop-up: ver el comprobante de una cuota pagada
// =============================================================================
function ComprobanteModal({ pago, leadId, onClose }: { pago: Pago; leadId: number; onClose: () => void }) {
  const src = `/api/doc?leadId=${leadId}&kind=comprobante&pagoId=${pago.id}`;
  return (
    <Modal onClose={onClose} width={560}>
      <h3 style={modalH3}>Comprobante · {etiquetaCuota(pago.numero)}</h3>
      <p style={modalSub}>Archivo subido al marcar la cuota como pagada.</p>
      <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', margin: '6px 0 14px' }}>
        <div style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', padding: '10px 14px', fontFamily: MONO, fontSize: 12, color: 'var(--dim)', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pago.comprobante_nombre ?? 'comprobante'}</span>
          <span>{fmtUSD(Number(pago.monto_usd))}{pago.fecha_pago ? ` · ${fmtDDMMYYYY(pago.fecha_pago)}` : ''}{pago.pago_hora ? ` · ${pago.pago_hora.slice(0, 5)}` : ''}</span>
        </div>
        <iframe src={src} title="Comprobante" style={{ display: 'block', width: '100%', height: 380, border: 'none', background: 'var(--surface-2)' }} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <a href={`${src}&download=1`} style={{ ...ghostBtn, flex: 1, textAlign: 'center', textDecoration: 'none' }}>Descargar</a>
        <button type="button" style={primaryBtn} onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  );
}
