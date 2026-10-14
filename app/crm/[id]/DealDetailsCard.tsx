'use client';

// =============================================================================
// DealDetailsCard — tab "Deal Details" del lead
// =============================================================================
// UN SOLO modo de edición: el de la ficha (botón "Editar" del header). Acá NO
// hay botón "Editar deal" propio ni "Guardar deal": cuando `editing` es true
// (dentro de EditLeadForm) las secciones se editan inline y el guardado lo
// dispara el único "Guardar cambios" de la ficha, vía ref (save()).
// En modo lectura: kv en recuadros grises + "Marcar pagada" siempre disponible.
// "Completar con IA" (contrato) rellena TODAS las secciones vacías; "Subir
// documento fiscal" rellena Datos fiscales. Diseño 2×2 (nunca 3+1 ni 5+1).

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import { useSearchParams } from 'next/navigation';
import { useRefrescarFicha } from '../lead-view/ficha-cambio';
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
  registrarPagoSueltoAction,
  quitarSinCobroAction,
  type IdentidadFiscal,
} from './deal-actions';
import { esSinCobro } from '@/lib/venta-tipo';
import { pipelineStageOf } from '@/lib/pipeline';
import { planEnLead, tieneDeal } from '@/lib/muestra-pagos';
import { NOMBRE_PASARELA, esPasarela, type CobroVisible } from '@/lib/cobros-tipos';
import { formatoMonto } from '@/lib/pasarela-moneda';
import { opcionesCobroAction, cobrosDelLeadAction, type OpcionesCobro } from './cobros-actions';
import { CobrarConLink } from './CobrarConLink';
import { CobrosDelLead } from './CobrosDelLead';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

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
// Exactamente 2 columnas (nunca 3+1 ni 5+1); en pantallas muy angostas colapsa a 1.
const grid2: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 };
const hintStyle: CSSProperties = { display: 'block', fontSize: 11.5, marginTop: 5, color: 'var(--faint)' };
const mini: CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' };
const miniLabel: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)' };
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

function fmtUSD(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function hoyISO(): string { return new Date().toISOString().slice(0, 10); }
function horaAhora(): string { return new Date().toTimeString().slice(0, 5); }
function diasHasta(iso: string): number {
  const [y, m, dd] = iso.slice(0, 10).split('-').map(Number);
  const now = new Date();
  const hoy = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.UTC(y, m - 1, dd) - hoy) / 86400000);
}
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

function Field({ label, hint, children, accent = false }: { label: string; hint?: string; children: ReactNode; accent?: boolean }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 12.5, marginBottom: 6, color: accent ? 'var(--accent)' : 'var(--dim)', fontWeight: accent ? 600 : 400 }}>{label}</span>
      {children}
      {hint && <span style={hintStyle}>{hint}</span>}
    </label>
  );
}

// Kv de LECTURA dentro de un recuadro gris (para que el dato no quede "flotando").
function KvCard({ k, v, accent = false }: { k: string; v?: string | null; accent?: boolean }) {
  return (
    <div style={mini}>
      <span style={{ display: 'block', fontSize: 12, color: accent ? 'var(--accent)' : 'var(--dim)', fontWeight: accent ? 600 : 400, marginBottom: 3 }}>{k}</span>
      <span style={{ display: 'block', fontSize: 14.5, color: v?.trim() ? 'var(--ink)' : 'var(--faint)', lineHeight: 1.5 }}>{v?.trim() ? v : '—'}</span>
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
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(18,21,27,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 60, fontFamily: SANS }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: width, padding: '22px 24px', boxShadow: '0 18px 60px rgba(20,30,50,.28)', maxHeight: '90vh', overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

// ── Borradores del modo edición ──────────────────────────────────────────────
type DraftCuota = { key: number; id: number | null; numero: number | null; monto: string; fecha: string; pagado: boolean; fecha_pago: string | null };
type Drafts = {
  monto: string; fechaCierre: string; fechaInicioServicio: string;
  // Una suscripción: la mensualidad y el plazo en meses ('' = indefinida).
  mensualidad: string; plazo: string;
  razon: string; idFiscal: string; domicilio: string; correo: string; facturadoPor: string;
  queEs: string; fechaInicio: string; fechaTermino: string; duracion: string; frecuencia: string; modalidad: string; sesiones: string;
  resultado: string; garantia: string; obCliente: string; obPrestador: string;
  cuotas: DraftCuota[]; cuotasDirty: boolean;
};
type ExtractResp = {
  error?: string; contrato_nombre?: string | null; total_usd?: number | null; duracion_meses?: number | null;
  cuotas?: Array<{ monto?: number | null; fecha?: string | null }>;
  fiscal?: { razon?: string | null; id_fiscal?: string | null; domicilio?: string | null; correo?: string | null } | null;
  servicio?: { que_es?: string | null; fecha_inicio?: string | null; fecha_termino?: string | null; duracion?: string | null; frecuencia?: string | null; modalidad?: string | null; sesiones?: string | null } | null;
  promesa?: { resultado?: string | null; garantia?: string | null } | null;
  obligaciones?: { cliente?: string[]; prestador?: string[] } | null;
  asumido?: string[];
};

function buildDraft(lead: Lead, pagos: Pago[]): Drafts {
  return {
    monto: lead.monto_cierre_usd != null ? String(lead.monto_cierre_usd) : '', fechaCierre: lead.fecha_cierre ?? '', fechaInicioServicio: lead.fecha_inicio_servicio ?? '',
    mensualidad: lead.suscripcion_monto_usd != null ? String(lead.suscripcion_monto_usd) : '', plazo: lead.suscripcion_meses != null ? String(lead.suscripcion_meses) : '',
    // Correo de facturación: por defecto el email del lead (salvo que se cargue otro).
    razon: lead.deal_fiscal?.razon ?? '', idFiscal: lead.deal_fiscal?.id_fiscal ?? '', domicilio: lead.deal_fiscal?.domicilio ?? '', correo: lead.deal_fiscal?.correo || lead.email || '',
    facturadoPor: lead.facturado_por_id != null ? String(lead.facturado_por_id) : '',
    queEs: lead.deal_servicio?.que_es ?? '', fechaInicio: lead.deal_servicio?.fecha_inicio ?? '', fechaTermino: lead.deal_servicio?.fecha_termino ?? '',
    duracion: lead.deal_servicio?.duracion ?? '', frecuencia: lead.deal_servicio?.frecuencia ?? '', modalidad: lead.deal_servicio?.modalidad ?? '', sesiones: lead.deal_servicio?.sesiones ?? '',
    resultado: lead.deal_promesa?.resultado ?? '', garantia: lead.deal_promesa?.garantia ?? '',
    obCliente: (lead.deal_obligaciones?.cliente ?? []).join('\n'), obPrestador: (lead.deal_obligaciones?.prestador ?? []).join('\n'),
    cuotas: pagos.map((p) => ({ key: p.id, id: p.id, numero: p.numero, monto: String(p.monto_usd), fecha: p.fecha_esperada ?? '', pagado: p.pagado, fecha_pago: p.fecha_pago })),
    cuotasDirty: false,
  };
}

export type DealDetailsHandle = { save: () => Promise<void> };

// =============================================================================
export const DealDetailsCard = forwardRef<DealDetailsHandle, {
  lead: Lead; pagos: Pago[]; editing?: boolean;
  /**
   * Lo que cambió en el lead, YA escrito en la base. Lo pasa el contenedor que tiene el lead
   * en estado de cliente leído por una action —la ficha en modal (`LeadSheet`) y la pestaña
   * Pagos de Customer Success—, donde `router.refresh()` no llega. Sin aplicarlo, esa ficha
   * sigue armando el wizard con el valor viejo (ver `quitarSinCobroAction`). La ruta
   * /crm/[id] no lo pasa: ahí el lead viene del server y el refresh sí lo trae.
   */
  onCambio?: (patch: Pick<Lead, 'venta_tipo'>) => void;
}>(
  function DealDetailsCard({ lead, pagos, editing = false, onCambio }, ref) {
  const refrescarFicha = useRefrescarFicha();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  /**
   * El tipo de venta que devolvió la última action, y SOBRE QUÉ valor del prop se leyó.
   * Vale mientras el prop siga diciendo lo mismo: cuando el contenedor (o el refresh) trae
   * el dato nuevo, gana el prop. Se CALCULA, no se resetea con un efecto — así un segundo
   * cambio que llegue por el prop (otro «Sin cobro» desde el wizard) se ve sin que nadie
   * se acuerde de limpiar nada.
   */
  const [tipoLeido, setTipoLeido] = useState<{ sobre: string | null; es: string | null } | null>(null);
  const ventaTipo = tipoLeido && tipoLeido.sobre === (lead.venta_tipo ?? null) ? tipoLeido.es : (lead.venta_tipo ?? null);

  // Draft: existe solo en modo edición (controlado por la ficha). En lectura = null.
  const [d, setD] = useState<Drafts | null>(() => (editing ? buildDraft(lead, pagos) : null));
  const dRef = useRef<Drafts | null>(d);
  dRef.current = d;
  const nextKey = useRef(-1);

  const [identidades, setIdentidades] = useState<IdentidadFiscal[] | null>(null);
  const [verContrato, setVerContrato] = useState(false);
  const [verFiscal, setVerFiscal] = useState(false);
  // 'suelto' = «Registrar otro pago»: un cobro que no calza con ninguna cuota (no lleva `pago`).
  const [modal, setModal] = useState<{ tipo: 'pagar' | 'comprobante'; pago: Pago } | { tipo: 'suelto' } | null>(null);
  // Toast de 5s de deshacer, tanto al MARCAR como al DESMARCAR una cuota.
  const [pagoToast, setPagoToast] = useState<{ pago: Pago; accion: 'marcada' | 'desmarcada' } | null>(null);
  useEffect(() => { if (!pagoToast) return; const t = setTimeout(() => setPagoToast(null), 5000); return () => clearTimeout(t); }, [pagoToast]);

  const [contratoSubido, setContratoSubido] = useState<string | null>(null);
  const [extrayendo, setExtrayendo] = useState(false);
  const [subiendoFiscal, setSubiendoFiscal] = useState(false);
  const [fiscalNombre, setFiscalNombre] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const fiscalRef = useRef<HTMLInputElement | null>(null);
  const contratoNombre = contratoSubido ?? lead.contrato_nombre ?? null;
  const tieneContrato = !!lead.contrato_path || contratoSubido !== null;
  const docFiscalNombre = fiscalNombre ?? lead.deal_fiscal?.doc_nombre ?? null;
  const tieneDocFiscal = !!lead.deal_fiscal?.doc_path || fiscalNombre !== null;

  useEffect(() => {
    let alive = true;
    getIdentidadesFiscalesAction().then((l) => { if (alive) setIdentidades(l); }).catch(() => { if (alive) setIdentidades([]); });
    return () => { alive = false; };
  }, []);

  // ── Links de pago (Stripe / Mercado Pago, 11/10/2026) ──
  // Por actions y no por props: esta tarjeta se monta en TRES puertas y en dos el lead es estado de
  // cliente (LeadSheet, Customer Success). Las opciones (pasarelas, productos, si administra) son
  // lecturas de la base; la moneda de cada cuenta la pide el asistente al abrirse.
  const [opcCobro, setOpcCobro] = useState<OpcionesCobro | null>(null);
  const [cobros, setCobros] = useState<CobroVisible[] | null>(null);
  const [errCobros, setErrCobros] = useState(false);
  const [vueltaCobros, setVueltaCobros] = useState(0);
  // En edición la sección no se dibuja (ver `seccionLinks`): no se lee.
  useEffect(() => {
    if (editing) return;
    let vivo = true;
    opcionesCobroAction(lead.id)
      .then((o) => { if (vivo) setOpcCobro(o); })
      .catch(() => { if (vivo) setOpcCobro({ ok: false, error: 'No pude leer cómo cobrar.' }); });
    return () => { vivo = false; };
  }, [lead.id, editing]);
  useEffect(() => {
    if (editing) return;
    let vivo = true;
    cobrosDelLeadAction(lead.id)
      .then((c) => { if (vivo) { setCobros(c); setErrCobros(false); } })
      .catch(() => { if (vivo) setErrCobros(true); });
    return () => { vivo = false; };
  }, [lead.id, vueltaCobros, editing]);
  // Un cobro nuevo, anulado o devuelto cambia la lista, el historial y (al devolver) las cuotas.
  const cobrosCambiaron = () => { setVueltaCobros((v) => v + 1); refrescarFicha(); };

  // save() para el ÚNICO "Guardar cambios" de la ficha (vía ref).
  useImperativeHandle(ref, () => ({
    save: async () => {
      const draft = dRef.current;
      if (!draft) return;
      const t = (s: string): string | null => (s.trim() ? s.trim() : null);
      const lineas = (s: string): string[] => s.split('\n').map((x) => x.trim()).filter(Boolean);
      await saveDealSectionsAction(lead.id, {
        deal_fiscal: { ...(lead.deal_fiscal ?? {}), razon: t(draft.razon), id_fiscal: t(draft.idFiscal), domicilio: t(draft.domicilio), correo: t(draft.correo) },
        deal_servicio: { que_es: t(draft.queEs), fecha_inicio: t(draft.fechaInicio), fecha_termino: t(draft.fechaTermino), duracion: t(draft.duracion), frecuencia: t(draft.frecuencia), modalidad: t(draft.modalidad), sesiones: t(draft.sesiones) },
        deal_promesa: { resultado: t(draft.resultado), garantia: t(draft.garantia) },
        deal_obligaciones: { cliente: lineas(draft.obCliente), prestador: lineas(draft.obPrestador) },
        facturado_por_id: draft.facturadoPor ? Number(draft.facturadoPor) : null,
        monto_cierre_usd: draft.monto.trim() ? (parseFloat(draft.monto) || null) : null,
        fecha_cierre: draft.fechaCierre || null,
        fecha_inicio_servicio: draft.fechaInicioServicio || null,
        // ⚠️ La mensualidad de una suscripción se corrige ACÁ: era la única pantalla que la
        // mostraba sin dejar editarla, y el wizard ya no la pregunta una vez cargada (08/10/2026,
        // los 4.235,29 «al mes» de un total de contrato). Sólo si ES suscripción; el server
        // igual lo re-chequea (compare-and-set sobre venta_tipo).
        ...(ventaTipo === 'suscripcion' ? {
          suscripcion_monto_usd: draft.mensualidad.trim() ? (parseFloat(draft.mensualidad) || null) : null,
          suscripcion_meses: draft.plazo.trim() ? (parseInt(draft.plazo, 10) || null) : null,
        } : {}),
      });
      if (draft.cuotasDirty) {
        // El `id` y la `fecha_pago` viajan porque el server tiene que distinguir
        // una cuota pagada que YA está en la base (saveLeadPlanManual la conserva
        // sola) de una NUEVA ya cobrada, que no existe en ningún lado y hay que
        // insertarla. Sin el id, la mensualidad cobrada caía en el filtro de
        // `!c.pagado` de saveCuotasAction y el cobro se perdía entero.
        await saveCuotasAction(lead.id, draft.cuotas.map((c) => ({ id: c.id, monto: parseFloat(c.monto) || 0, fecha: c.fecha || null, pagado: c.pagado, fecha_pago: c.fecha_pago })));
      }
    },
  }), [lead.id, lead.deal_fiscal, ventaTipo]);

  const upd = (patch: Partial<Drafts>) => setD((prev) => (prev ? { ...prev, ...patch } : prev));
  const setCuota = (i: number, patch: Partial<DraftCuota>) => setD((prev) => { if (!prev) return prev; const cuotas = prev.cuotas.slice(); cuotas[i] = { ...cuotas[i], ...patch }; return { ...prev, cuotas, cuotasDirty: true }; });
  const quitarCuota = (i: number) => setD((prev) => (prev ? { ...prev, cuotas: prev.cuotas.filter((_, j) => j !== i), cuotasDirty: true } : prev));
  const agregarCuota = () => setD((prev) => { if (!prev) return prev; const ultima = prev.cuotas[prev.cuotas.length - 1] ?? null; const nueva: DraftCuota = { key: nextKey.current--, id: null, numero: null, monto: '', fecha: unMesDespues(ultima?.fecha || null), pagado: false, fecha_pago: null }; return { ...prev, cuotas: [...prev.cuotas, nueva], cuotasDirty: true }; });
  // #363 F2 / #697: mensualidad COBRADA de una suscripción. El botón dice
  // "cobrada", así que la cuota nace PAGADA y con la fecha de hoy, con el monto
  // mensual precargado (para las indefinidas que se cobran mes a mes).
  //
  // Antes nacía con `pagado: false` y `fecha: unMesDespues(...)`, o sea que el
  // botón del cobro fabricaba una DEUDA a un mes: el cliente que acababa de pagar
  // seguía figurando en $0 —`total_cobrado_usd` se deriva SÓLO de los pagos
  // marcados, ver sincronizarTotalCobrado en lib/pagos.ts— y un mes después esa
  // cuota caía en "A quién cobrarle" de /comercial, o sea se perseguía un cobro
  // ya hecho. La cuota FUTURA es el otro botón, `agregarCuota`, que no cambia.
  //
  // El monto queda editable mientras la cuota no se haya guardado (id === null):
  // una suscripción sin `suscripcion_monto_usd` cargado nacería en 0, y una cuota
  // en 0 la descarta el guardado sin decir nada.
  const agregarMensualidad = () => setD((prev) => { if (!prev) return prev; const hoy = hoyISO(); const nueva: DraftCuota = { key: nextKey.current--, id: null, numero: null, monto: prev.mensualidad.trim(), fecha: hoy, pagado: true, fecha_pago: hoy }; return { ...prev, cuotas: [...prev.cuotas, nueva], cuotasDirty: true }; });

  // ── Totales / semáforo ──
  const cuotasVista = d ? d.cuotas.map((c) => ({ monto: parseFloat(c.monto) || 0, fecha: c.fecha || null, pagado: c.pagado })) : pagos.map((p) => ({ monto: Number(p.monto_usd), fecha: p.fecha_esperada, pagado: p.pagado }));
  const cobrado = cuotasVista.filter((c) => c.pagado).reduce((s, c) => s + c.monto, 0);
  const total = cuotasVista.reduce((s, c) => s + c.monto, 0);
  const pend = total - cobrado;
  const montoCierre = d ? (parseFloat(d.monto) || 0) : (lead.monto_cierre_usd ?? 0);
  const totalMostrar = total > 0 ? total : montoCierre;
  const pct = total > 0 ? Math.min(100, Math.round((cobrado / total) * 100)) : 0;
  const hayVencida = cuotasVista.some((c) => !c.pagado && c.fecha && diasHasta(c.fecha) < 0);
  const haySoon = cuotasVista.some((c) => !c.pagado && c.fecha && diasHasta(c.fecha) >= 0 && diasHasta(c.fecha) <= 14);
  const sem: { tono: 'green' | 'amber' | 'red'; texto: string } =
    total > 0 && pend <= 0 ? { tono: 'green', texto: 'Pagado por completo' } : hayVencida ? { tono: 'red', texto: 'Cuota vencida' } : haySoon ? { tono: 'amber', texto: 'Cuota por vencer' } : { tono: 'green', texto: 'Al corriente' };
  const sumaTodas = d ? d.cuotas.reduce((s, c) => s + (parseFloat(c.monto) || 0), 0) : 0;
  const diff = Math.round((sumaTodas - montoCierre) * 100) / 100;
  const cuadra = Math.abs(diff) < 0.5;

  // Deal "incompleto" = a un ganado le FALTA alguna sección clave (servicio,
  // promesa, datos fiscales u obligaciones). Antes solo si estaban TODAS vacías;
  // ahora salta el botón "Completar con IA" si falta cualquiera.
  const oblig = lead.deal_obligaciones;
  const dealIncompleto = !editing && lead.estado_lead === 'ganado' && (
    !lead.deal_servicio?.que_es?.trim() ||
    !lead.deal_promesa?.resultado?.trim() ||
    !lead.deal_fiscal?.razon?.trim() ||
    !((oblig?.cliente?.length ?? 0) > 0 || (oblig?.prestador?.length ?? 0) > 0)
  );

  // ── Contrato / doc fiscal: leer con IA (rellena SOLO lo vacío) ──
  const aplicarExtraccion = (j: ExtractResp): string[] => {
    const base = dRef.current; if (!base) return [];
    const next: Drafts = { ...base, cuotas: base.cuotas.slice() };
    const rellenado: string[] = [];
    const marca = (l: string) => { if (!rellenado.includes(l)) rellenado.push(l); };
    const setIf = (k: keyof Drafts, val: string | null | undefined, label: string) => { if (val && !String(next[k]).trim()) { (next[k] as string) = val; marca(label); } };
    setIf('razon', j.fiscal?.razon, 'datos fiscales'); setIf('idFiscal', j.fiscal?.id_fiscal, 'datos fiscales'); setIf('domicilio', j.fiscal?.domicilio, 'datos fiscales'); setIf('correo', j.fiscal?.correo, 'datos fiscales');
    setIf('queEs', j.servicio?.que_es, 'servicio'); setIf('fechaInicio', j.servicio?.fecha_inicio, 'servicio'); setIf('fechaTermino', j.servicio?.fecha_termino, 'servicio'); setIf('duracion', j.servicio?.duracion, 'servicio'); setIf('frecuencia', j.servicio?.frecuencia, 'servicio'); setIf('modalidad', j.servicio?.modalidad, 'servicio'); setIf('sesiones', j.servicio?.sesiones, 'servicio');
    setIf('resultado', j.promesa?.resultado, 'promesa'); setIf('garantia', j.promesa?.garantia, 'promesa');
    if (j.obligaciones?.cliente?.length && !next.obCliente.trim()) { next.obCliente = j.obligaciones.cliente.join('\n'); marca('obligaciones'); }
    if (j.obligaciones?.prestador?.length && !next.obPrestador.trim()) { next.obPrestador = j.obligaciones.prestador.join('\n'); marca('obligaciones'); }
    const extraidas = (j.cuotas ?? []).filter((c) => Number(c?.monto) > 0);
    const hayCuotasCargadas = next.cuotas.some((c) => !c.pagado && (parseFloat(c.monto) || 0) > 0);
    if (extraidas.length > 0 && !hayCuotasCargadas) {
      next.cuotas = [...next.cuotas.filter((c) => c.pagado), ...extraidas.map((c) => ({ key: nextKey.current--, id: null, numero: null, monto: String(c.monto), fecha: c.fecha && /^\d{4}-\d{2}-\d{2}/.test(c.fecha) ? c.fecha.slice(0, 10) : '', pagado: false, fecha_pago: null } as DraftCuota))];
      next.cuotasDirty = true; marca('cuotas');
    }
    setD(next);
    return rellenado;
  };

  // file omitido → relee el contrato YA cargado del lead (Completar con IA).
  const subirContrato = async (file?: File) => {
    setFeedback(null); setExtrayendo(true);
    try {
      const fd = new FormData();
      if (file) fd.append('file', file);
      fd.append('leadId', String(lead.id));
      const r = await fetch('/api/extract-contract', { method: 'POST', body: fd });
      const j: ExtractResp = await r.json();
      if (j.error) throw new Error(j.error);
      if (j.contrato_nombre) setContratoSubido(j.contrato_nombre);
      const rellenado = aplicarExtraccion(j);
      const asum = j.asumido?.length ? ` Asumido por defecto: ${j.asumido.join(', ')}.` : '';
      setFeedback({ kind: 'ok', msg: rellenado.length ? `Contrato leído. Se completó (solo lo vacío): ${rellenado.join(', ')}.${asum} Revisa y Guarda cambios.` : `Contrato leído: no había campos vacíos para completar.${asum}` });
    } catch (err) {
      setFeedback({ kind: 'err', msg: `No se pudo leer el contrato: ${err instanceof Error ? err.message : String(err)}` });
    } finally { setExtrayendo(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const subirDocFiscal = async (file: File) => {
    setFeedback(null); setSubiendoFiscal(true);
    try {
      const fd = new FormData(); fd.append('file', file); fd.append('leadId', String(lead.id));
      const r = await fetch('/api/extract-deal-fiscal', { method: 'POST', body: fd });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      if (j.doc_nombre) setFiscalNombre(j.doc_nombre);
      setD((prev) => prev && ({ ...prev, razon: prev.razon.trim() || j.razon || '', idFiscal: prev.idFiscal.trim() || j.id_fiscal || '', domicilio: prev.domicilio.trim() || j.domicilio || '', correo: prev.correo.trim() || j.correo || '' }));
      setFeedback({ kind: 'ok', msg: 'Documento fiscal leído. Se completaron los datos vacíos. Revisa y Guarda cambios.' });
    } catch (err) {
      setFeedback({ kind: 'err', msg: `No se pudo leer el documento fiscal: ${err instanceof Error ? err.message : String(err)}` });
    } finally { setSubiendoFiscal(false); if (fiscalRef.current) fiscalRef.current.value = ''; }
  };

  // Desmarcar una cuota pagada (botón "deshacer" de la cuota): muestra el toast de
  // 5s para RE-marcar con la fecha original (así no se pierde como pasó antes).
  const desmarcarPago = (p: Pago) => {
    setFeedback(null);
    startTransition(async () => {
      try { await marcarPagoAction(p.id, lead.id, false, null); setPagoToast({ pago: p, accion: 'desmarcada' }); refrescarFicha(); }
      catch (err) { setFeedback({ kind: 'err', msg: err instanceof Error ? err.message : String(err) }); }
    });
  };
  // Un becado marcado por error (#747): la única salida de «Sin cobro» (ver la action).
  // ⚠️ La tarjeta se pinta con lo que DEVUELVE la action, no con el refresh: en dos de sus
  // tres montajes el lead no viene del server y el refresh no lo cambia. Y si el clic no
  // escribió nada (ya no era «Sin cobro»), se dice: un botón que no hace nada y calla se lee
  // como roto.
  const quitarSinCobro = () => {
    setFeedback(null);
    const sobre = lead.venta_tipo ?? null;
    startTransition(async () => {
      try {
        const r = await quitarSinCobroAction(lead.id);
        setTipoLeido({ sobre, es: r.ventaTipo });
        if (!r.cambio) setFeedback({ kind: 'ok', msg: 'Ya no era «Sin cobro».' });
        onCambio?.({ venta_tipo: r.ventaTipo });
        refrescarFicha();
      }
      catch (err) { setFeedback({ kind: 'err', msg: err instanceof Error ? err.message : String(err) }); }
    });
  };
  // Deshacer desde el toast: si se marcó → desmarcar; si se desmarcó → re-marcar
  // con la fecha/hora originales. No re-dispara otro toast.
  const undoPagoToast = (p: Pago, accion: 'marcada' | 'desmarcada') => {
    setPagoToast(null);
    setFeedback(null);
    startTransition(async () => {
      try {
        if (accion === 'marcada') await marcarPagoAction(p.id, lead.id, false, null);
        else await marcarPagoManualAction(p.id, lead.id, { fecha: p.fecha_pago ?? new Date().toISOString().slice(0, 10), hora: p.pago_hora ?? null });
        refrescarFicha();
      } catch (err) { setFeedback({ kind: 'err', msg: err instanceof Error ? err.message : String(err) }); }
    });
  };

  // "Completar con IA" desde la vista abre la edición con ?ia=1 → corre la
  // extracción del contrato ya cargado apenas monta el editor (una sola vez).
  const iaRan = useRef(false);
  useEffect(() => {
    if (d && !iaRan.current && sp.get('ia') === '1' && (lead.contrato_path || contratoSubido)) {
      iaRan.current = true;
      void subirContrato();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d]);

  const identSel = lead.facturado_por_id != null ? identidades?.find((i) => i.id === lead.facturado_por_id) : undefined;
  const facturadoPorTexto = lead.facturado_por_id == null ? '—' : identSel ? `${identSel.nombre}${identSel.id_fiscal ? ` · ${identSel.id_fiscal}` : ''}` : identidades === null ? 'Cargando…' : '—';

  // ⚠️ UN LEAD QUE TODAVÍA NO COMPRÓ también tiene tab Pagos cuando el negocio puede cobrarle con un
  // link (lib/muestra-pagos.ts). A ese lead se le dibuja SÓLO la sección de los links: el deal entero
  // (servicio, promesa, datos fiscales…) vacío sería ruido fijo. En edición se dibuja todo, como siempre.
  const conDeal = !!d || tieneDeal({ estado: lead.estado_lead, etapa: pipelineStageOf(lead), cuotas: pagos.length, planEnLead: planEnLead(lead) });

  // Los links se cobran y se anulan desde la LECTURA: en edición la tarjeta es un borrador que se
  // guarda con el «Guardar cambios» de la ficha, y un cobro no espera a ese botón.
  const seccionLinks = !d && (
    <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={sectLabel}>Links de pago</div>
        {opcCobro?.ok && (
          <CobrarConLink lead={{ id: lead.id, nombre: lead.nombre, email: lead.email, telefono: lead.telefono }}
            pasarelas={opcCobro.pasarelas} productos={opcCobro.productos} onCreado={cobrosCambiaron} />
        )}
      </div>
      {opcCobro && !opcCobro.ok && <p style={{ margin: 0, fontSize: 13, color: 'var(--faint)' }}>{opcCobro.error}</p>}
      <CobrosDelLead cobros={cobros} error={errCobros} esAdmin={!!opcCobro?.ok && opcCobro.esAdmin} onCambio={cobrosCambiaron} />
    </section>
  );

  if (!conDeal) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {feedback && <div style={bannerStyle(feedback.kind)}>{feedback.msg}</div>}
        {seccionLinks}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {feedback && <div style={bannerStyle(feedback.kind)}>{feedback.msg}</div>}
      {dealIncompleto && (
        <div style={{ ...bannerStyle('warn'), display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span>Este deal está ganado pero le faltan datos. Complétalos con el contrato, el documento fiscal o a mano.</span>
          {/* Vista: "Completar con IA" abre la edición y corre la extracción sola (ia=1). */}
          <Link href="?edit=1&tab=cobranza&ia=1" style={{ ...primaryBtn, padding: '8px 14px', textDecoration: 'none' }}>✦ Completar con IA</Link>
        </div>
      )}

      {/* En edición: acciones de IA. "Completar con IA" relee el contrato ya
          cargado (o pide uno si no hay); "Subir otro" reemplaza el contrato. */}
      {d && (
        <div style={{ ...mini, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void subirContrato(f); }} />
          <button type="button" style={{ ...outlineBtn, opacity: extrayendo ? 0.6 : 1 }} onClick={() => (tieneContrato ? void subirContrato() : fileRef.current?.click())} disabled={extrayendo}>
            {extrayendo ? 'Leyendo contrato…' : '✦ Completar con IA (contrato)'}
          </button>
          {tieneContrato && <button type="button" style={ghostBtn} onClick={() => fileRef.current?.click()} disabled={extrayendo}>Subir otro contrato</button>}
          <span style={{ fontSize: 12, color: 'var(--faint)' }}>{tieneContrato ? 'Relee el contrato cargado y completa Servicio, Promesa, Obligaciones y Datos fiscales (solo lo vacío).' : 'Subí el contrato y completa las secciones solas.'}</span>
        </div>
      )}

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
                Monto de cierre <b style={{ color: 'var(--ink)' }}>USD {fmtUSD(montoCierre)}</b>{lead.fecha_cierre ? ` · fecha de cierre ${fmtDDMMYYYY(lead.fecha_cierre)}` : ''}
              </div>
            )}
            {ventaTipo === 'suscripcion' && (
              <div style={{ marginTop: 6, fontSize: 13, color: 'var(--dim)' }}>
                🔁 Suscripción <b style={{ color: 'var(--ink)' }}>USD {fmtUSD(lead.suscripcion_monto_usd ?? 0)}/mes</b> · {lead.suscripcion_meses ? `${lead.suscripcion_meses} meses` : 'mes a mes (indefinida)'}
              </div>
            )}
            {esSinCobro(ventaTipo) && (
              <div style={{ marginTop: 6, fontSize: 13, color: 'var(--dim)' }}>
                <b style={{ color: 'var(--ink)' }}>Sin cobro</b> · becado o bonificado ·{' '}
                <button type="button" disabled={pending} onClick={quitarSinCobro}
                  style={{ background: 'none', border: 0, padding: 0, color: 'var(--primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: SANS }}>
                  Quitar «Sin cobro»
                </button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <Semaforo tono={sem.tono} texto={sem.texto} />
            {pend > 0 && <span style={chipWarn}>Pendiente {fmtUSD(pend)}</span>}
            {total > 0 && pend <= 0 && <span style={chipGood}>Pagado</span>}
          </div>
        </div>
        {total > 0 && <div style={{ height: 8, borderRadius: 999, background: 'var(--border)', marginTop: 12, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: 'var(--good)', transition: 'width .3s' }} /></div>}

        {/* Cierre (monto + fechas) — ahora DENTRO de Pagos (solo edición). */}
        {d && (
          <div style={{ ...mini, marginTop: 16 }}>
            <div style={{ ...miniLabel, marginBottom: 10 }}>Cierre</div>
            <div style={grid2}>
              {/* Una suscripción no tiene monto de cierre (queda NULL a propósito): su plata es
                  la mensualidad, y el plazo vacío es «indefinida». Cambiar el plazo NO rehace
                  las cuotas: se ajustan en la lista de abajo. */}
              {ventaTipo === 'suscripcion' ? (
                <>
                  <Field label="Mensualidad (USD)"><input className="lead-field" type="number" min={0} step="0.01" value={d.mensualidad} onChange={(e) => upd({ mensualidad: e.target.value })} /></Field>
                  <Field label="Plazo (meses)"><input className="lead-field" type="number" min={1} step="1" placeholder="Indefinida" value={d.plazo} onChange={(e) => upd({ plazo: e.target.value.replace(/[^\d]/g, '') })} /></Field>
                </>
              ) : (
                <Field label="Monto del cierre (USD)"><input className="lead-field" type="number" min={0} step="0.01" value={d.monto} onChange={(e) => upd({ monto: e.target.value })} /></Field>
              )}
              <Field label="Fecha de cierre"><input className="lead-field" type="date" value={d.fechaCierre} onChange={(e) => upd({ fechaCierre: e.target.value })} /></Field>
              <Field label="Inicio de servicio (opcional)"><input className="lead-field" type="date" value={d.fechaInicioServicio} onChange={(e) => upd({ fechaInicioServicio: e.target.value })} /></Field>
            </div>
          </div>
        )}

        {/* Contrato — con su propio botón para subir/reemplazar (en edición). */}
        <div style={docstrip}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{contratoNombre ?? 'Sin contrato cargado'}</div>
            <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 2 }}>{tieneContrato ? 'El contrato ya está cargado.' : 'Sube el contrato (PDF o foto).'}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {tieneContrato && <button type="button" style={ghostBtn} onClick={() => setVerContrato((v) => !v)}>{verContrato ? 'Cerrar contrato' : 'Ver contrato'}</button>}
            {tieneContrato && <a href={`/api/contract?leadId=${lead.id}`} style={{ ...ghostBtn, textDecoration: 'none', display: 'inline-block' }}>Descargar</a>}
            {d && <button type="button" style={{ ...outlineBtn, opacity: extrayendo ? 0.6 : 1 }} onClick={() => fileRef.current?.click()} disabled={extrayendo}>{extrayendo ? 'Leyendo…' : tieneContrato ? 'Reemplazar contrato' : 'Subir contrato'}</button>}
          </div>
        </div>
        {verContrato && tieneContrato && <DocViewer src={`/api/doc?leadId=${lead.id}&kind=contrato`} nombre={contratoNombre ?? 'Contrato'} onClose={() => setVerContrato(false)} />}

        {/* Cuotas */}
        <div style={{ marginTop: 22 }}>
          <div style={{ ...sectLabel, marginBottom: 12 }}>Cuotas</div>
          {!d && (pagos.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13.5, color: 'var(--faint)' }}>Sin cuotas cargadas. Entra a Editar para armar el plan o sube el contrato.</div>
              {/* Un pago se registra SIN armar el plan antes (Mauricio, 13/10/2026: «no pude ponerle el tema cuando
                  es un pago diferente»). */}
              <button type="button" style={dashedBtn} onClick={() => setModal({ tipo: 'suelto' })}>+ Registrar un pago</button>
            </div>
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
                      <span style={{ color: 'var(--dim)', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(Number(p.monto_usd))}{p.moneda && p.moneda !== 'USD' && p.monto_original != null ? ` (${formatoMonto(Number(p.monto_original), p.moneda)})` : ''}</span>
                      <span style={{ fontSize: 13, color: vencida ? 'var(--bad)' : porVencer ? 'var(--warn)' : 'var(--dim)' }}>
                        {p.pagado ? `cobrada el ${fmtDDMMYYYY(p.fecha_pago)}${p.pago_hora ? ` · ${p.pago_hora.slice(0, 5)}` : ''}` : vencida ? `venció ${fmtDDMMYYYY(p.fecha_esperada)} · vencida` : `vence ${fmtDDMMYYYY(p.fecha_esperada)}${porVencer && dt !== null ? (dt === 0 ? ' · hoy' : ` · en ${dt} día${dt === 1 ? '' : 's'}`) : ''}`}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      {p.pagado ? (
                        <>
                          {p.comprobante_path && <button type="button" style={{ ...linkBtn, color: 'var(--primary)', fontWeight: 600 }} onClick={() => setModal({ tipo: 'comprobante', pago: p })}>Ver comprobante</button>}
                          {/* La cobró una PASARELA: la prueba es su aviso (no hay comprobante que subir) y
                              no se «deshace» a mano — eso dejaría el cobro pagado y la cuota sin pagar.
                              Lo que la revierte es «Devolver», en Links de pago. */}
                          {esPasarela(p.proveedor)
                            ? <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--good)' }}>por {NOMBRE_PASARELA[p.proveedor]}</span>
                            : <button type="button" style={{ ...linkBtn, opacity: pending ? 0.5 : 1 }} disabled={pending} onClick={() => desmarcarPago(p)}>deshacer</button>}
                        </>
                      ) : (
                        <button type="button" style={goodBtn} onClick={() => setModal({ tipo: 'pagar', pago: p })}>Marcar pagada</button>
                      )}
                    </div>
                  </div>
                );
              })}
              {/* Un cobro que no calza con ninguna cuota: un adelanto, un extra, un pago de otro esquema. */}
              <button type="button" style={{ ...dashedBtn, marginTop: 2 }} onClick={() => setModal({ tipo: 'suelto' })}>+ Registrar otro pago</button>
            </div>
          ))}

          {d && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {d.cuotas.map((c, i) => (
                  <div key={c.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, border: `1px solid ${c.pagado ? '#BFE6CD' : 'var(--border-strong)'}`, borderRadius: 11, padding: '11px 14px', background: c.pagado ? 'var(--good-bg)' : 'var(--surface-2)', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--ink)', fontWeight: 600, fontSize: 14 }}>{etiquetaCuota(c.numero)}</span>
                      {c.pagado && c.id !== null ? (
                        <><span style={{ color: 'var(--dim)', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(parseFloat(c.monto) || 0)}</span><span style={{ fontSize: 13, color: 'var(--dim)' }}>cobrada el {fmtDDMMYYYY(c.fecha_pago)}</span></>
                      ) : (
                        <><input className="lead-field" type="number" min={0} step="0.01" value={c.monto} onChange={(e) => setCuota(i, { monto: e.target.value })} style={{ width: 112 }} aria-label={`Monto ${etiquetaCuota(c.numero)}`} />{c.pagado ? <span style={{ fontSize: 13, color: 'var(--good)', fontWeight: 600 }}>cobrada hoy</span> : <input className="lead-field" type="date" value={c.fecha} onChange={(e) => setCuota(i, { fecha: e.target.value })} style={{ width: 'auto' }} aria-label={`Vencimiento ${etiquetaCuota(c.numero)}`} />}</>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {c.pagado && c.id !== null ? <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--good)', background: '#fff', border: '1px solid #BFE6CD', borderRadius: 999, padding: '2px 9px' }}>pagada</span> : <button type="button" style={linkBtn} onClick={() => quitarCuota(i)}>quitar</button>}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ventaTipo === 'suscripcion' && (
                  <button type="button" style={dashedBtn} onClick={agregarMensualidad}>+ Registrar mensualidad cobrada ({fmtUSD(parseFloat(d.mensualidad) || 0)})</button>
                )}
                <button type="button" style={dashedBtn} onClick={agregarCuota}>+ Agregar cuota</button>
              </div>
              {montoCierre > 0 && (
                <div style={{ ...bannerStyle(cuadra ? 'ok' : 'err'), marginTop: 12, fontWeight: cuadra ? 600 : 500 }}>
                  {cuadra ? `Cuadra: las cuotas suman ${fmtUSD(sumaTodas)} y coinciden con el cierre de ${fmtUSD(montoCierre)}.` : `Las cuotas suman ${fmtUSD(sumaTodas)} y ${diff > 0 ? 'exceden' : 'no alcanzan'} el cierre de ${fmtUSD(montoCierre)} por ${fmtUSD(Math.abs(diff))}. Ajusta los montos.`}
                </div>
              )}
            </>
          )}
          <p style={{ fontSize: 12, color: 'var(--faint)', marginTop: 10 }}>El cash del dashboard lee de aquí.</p>
        </div>
      </section>

      {/* 1b · LINKS DE PAGO (Stripe / Mercado Pago) */}
      {seccionLinks}

      {/* 2 · DATOS FISCALES */}
      <section style={card}>
        <SectionHead title="Datos fiscales" tag="Extraído del documento" />
        <div style={{ maxWidth: 440, marginBottom: 18 }}>
          <span style={{ display: 'block', fontSize: 12.5, marginBottom: 6, color: 'var(--dim)' }}>Facturado por</span>
          {d ? (
            <Dropdown value={d.facturadoPor} onChange={(v) => upd({ facturadoPor: v })} width="100%" ariaLabel="Facturado por" disabled={identidades === null} placeholder={identidades === null ? 'Cargando…' : 'Elige una identidad'}
              options={[{ value: '', label: 'Sin definir' }, ...(identidades ?? []).map((i) => ({ value: String(i.id), label: i.nombre, sub: i.id_fiscal ?? undefined }))]} />
          ) : (
            <div style={{ ...mini }}>{facturadoPorTexto}</div>
          )}
          <span style={hintStyle}>Tus identidades fiscales se configuran una sola vez en Configuraciones.</span>
        </div>

        {/* Subir documento fiscal del cliente (solo en edición) */}
        {d && (
          <div style={{ ...mini, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <input ref={fiscalRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void subirDocFiscal(f); }} />
            <button type="button" style={{ ...outlineBtn, opacity: subiendoFiscal ? 0.6 : 1 }} onClick={() => fiscalRef.current?.click()} disabled={subiendoFiscal}>
              {subiendoFiscal ? 'Leyendo documento…' : tieneDocFiscal ? 'Reemplazar documento fiscal' : '⇪ Subir documento fiscal del cliente'}
            </button>
            <span style={{ fontSize: 12, color: 'var(--faint)' }}>Lee la constancia/RFC/CUIT del cliente y completa los 4 campos.</span>
          </div>
        )}

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
            <KvCard k="Razón fiscal / nombre" v={lead.deal_fiscal?.razon} />
            <KvCard k="Identificación fiscal" v={lead.deal_fiscal?.id_fiscal} />
            <KvCard k="Domicilio fiscal" v={lead.deal_fiscal?.domicilio} />
            <KvCard k="Correo de facturación" v={lead.deal_fiscal?.correo || lead.email} />
          </div>
        )}

        {tieneDocFiscal && (
          <>
            <div style={docstrip}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{docFiscalNombre ?? 'Documento fiscal'}</div>
                <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 2 }}>Documento fiscal del cliente.</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" style={ghostBtn} onClick={() => setVerFiscal((v) => !v)}>{verFiscal ? 'Cerrar documento' : 'Ver documento'}</button>
                <a href={`/api/doc?leadId=${lead.id}&kind=fiscal&download=1`} style={{ ...ghostBtn, textDecoration: 'none', display: 'inline-block' }}>Descargar</a>
              </div>
            </div>
            {verFiscal && <DocViewer src={`/api/doc?leadId=${lead.id}&kind=fiscal`} nombre={docFiscalNombre ?? 'Documento fiscal'} onClose={() => setVerFiscal(false)} />}
          </>
        )}
      </section>

      {/* 3 · SERVICIO */}
      <section style={card}>
        <SectionHead title="Servicio" tag="Resumido por IA · editable" />
        {d ? (
          <>
            <div style={{ marginBottom: 12 }}><Field label="Qué es"><textarea className="lead-field" style={{ minHeight: 66, lineHeight: 1.5 }} value={d.queEs} onChange={(e) => upd({ queEs: e.target.value })} /></Field></div>
            <div style={grid2}>
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
            <div style={{ marginBottom: 12 }}><KvCard k="Qué es" v={lead.deal_servicio?.que_es} /></div>
            <div style={grid2}>
              <KvCard k="Fecha de inicio" v={fmtFechaLibre(lead.deal_servicio?.fecha_inicio)} />
              <KvCard k="Fecha de término" v={fmtFechaLibre(lead.deal_servicio?.fecha_termino)} />
              <KvCard k="Duración" v={lead.deal_servicio?.duracion} />
              <KvCard k="Frecuencia" v={lead.deal_servicio?.frecuencia} />
              <KvCard k="Modalidad" v={lead.deal_servicio?.modalidad} />
              <KvCard k="Sesiones" v={lead.deal_servicio?.sesiones} />
            </div>
          </>
        )}
      </section>

      {/* 4 · PROMESA */}
      <section style={card}>
        <SectionHead title="Promesa" tag="Resumido por IA · editable" />
        {d ? (
          <div style={grid2}>
            <Field label="Resultado prometido"><textarea className="lead-field" style={{ minHeight: 66, lineHeight: 1.5 }} value={d.resultado} onChange={(e) => upd({ resultado: e.target.value })} /></Field>
            <Field label="Garantía" accent><textarea className="lead-field" style={{ minHeight: 66, lineHeight: 1.5 }} value={d.garantia} onChange={(e) => upd({ garantia: e.target.value })} /></Field>
          </div>
        ) : (
          <div style={grid2}>
            <KvCard k="Resultado prometido" v={lead.deal_promesa?.resultado} />
            <KvCard k="Garantía" v={lead.deal_promesa?.garantia} accent />
          </div>
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
            <div style={mini}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--dim)', marginBottom: 8 }}>Del cliente</div>
              {(lead.deal_obligaciones?.cliente ?? []).length > 0 ? <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: 'var(--ink)', lineHeight: 1.7 }}>{(lead.deal_obligaciones?.cliente ?? []).map((o, i) => <li key={i}>{o}</li>)}</ul> : <div style={{ fontSize: 14.5, color: 'var(--faint)' }}>—</div>}
            </div>
            <div style={mini}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--dim)', marginBottom: 8 }}>Del prestador</div>
              {(lead.deal_obligaciones?.prestador ?? []).length > 0 ? <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: 'var(--ink)', lineHeight: 1.7 }}>{(lead.deal_obligaciones?.prestador ?? []).map((o, i) => <li key={i}>{o}</li>)}</ul> : <div style={{ fontSize: 14.5, color: 'var(--faint)' }}>—</div>}
            </div>
          </div>
        )}
      </section>

      {modal?.tipo === 'pagar' && (
        // ⚠️ Con una diferencia pendiente NO va el «Deshacer» del toast: desmarcar la cuota dejaría viva la cuota
        // nueva de la diferencia, y el plan sumaría de más. Se corrige desmarcando y quitando en Editar.
        <PayModal pago={modal.pago} leadId={lead.id} onClose={() => setModal(null)} onDone={(msg, conDeshacer) => { const p = modal.pago; setModal(null); setFeedback({ kind: 'ok', msg }); if (conDeshacer) setPagoToast({ pago: p, accion: 'marcada' }); refrescarFicha(); }} />
      )}
      {modal?.tipo === 'suelto' && (
        <PagoSueltoModal leadId={lead.id} onClose={() => setModal(null)} onDone={(msg) => { setModal(null); setFeedback({ kind: 'ok', msg }); refrescarFicha(); }} />
      )}
      {modal?.tipo === 'comprobante' && <ComprobanteModal pago={modal.pago} leadId={lead.id} onClose={() => setModal(null)} />}

      {pagoToast && (
        <div style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 90, display: 'flex', alignItems: 'center', gap: 14, background: 'var(--ink)', color: '#F3F5F8', borderRadius: 12, padding: '11px 16px', boxShadow: '0 12px 40px rgba(18,21,27,.32)', fontFamily: SANS, fontSize: 13.5 }}>
          <span>{etiquetaCuota(pagoToast.pago.numero)} {pagoToast.accion === 'marcada' ? 'marcada como pagada.' : 'desmarcada.'}</span>
          <button type="button" onClick={() => undoPagoToast(pagoToast.pago, pagoToast.accion)} style={{ background: 'transparent', border: 'none', color: '#8FD0FF', fontWeight: 700, cursor: 'pointer', fontFamily: SANS, fontSize: 13.5 }}>Deshacer</button>
        </div>
      )}
    </div>
  );
});

// =============================================================================
/**
 * Marcar una cuota pagada: con el comprobante (la IA lee monto, fecha y hora) o a mano.
 *
 * ⚠️ UN PAGO DE MENOS PREGUNTA QUÉ PASA CON LA DIFERENCIA (Mauricio, 13/10/2026: «yo no pude ponerle el tema cuando es
 * un pago diferente»). Hasta acá la cuota quedaba pagada por menos y la diferencia DESAPARECÍA del Outstanding. Dos
 * salidas y nada más: queda pendiente (default: el cliente la sigue debiendo) o es un descuento.
 */
function PayModal({ pago, leadId, onClose, onDone }: { pago: Pago; leadId: number; onClose: () => void; onDone: (msg: string, conDeshacer: boolean) => void }) {
  const etiqueta = etiquetaCuota(pago.numero);
  const [resto, setResto] = useState<'pendiente' | 'descuento'>('pendiente');
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
    setErr(null); setLeyendo(true);
    try {
      const fd = new FormData(); fd.append('file', file); fd.append('pagoId', String(pago.id)); fd.append('leadId', String(leadId));
      const r = await fetch('/api/extract-receipt', { method: 'POST', body: fd });
      const j: { error?: string; monto?: number | null; fecha?: string | null; hora?: string | null; comprobante_nombre?: string | null } = await r.json();
      if (j.error) throw new Error(j.error);
      setExt({ monto: j.monto != null && Number.isFinite(Number(j.monto)) ? Number(j.monto) : null, fecha: j.fecha ?? null, hora: j.hora ?? null, nombre: j.comprobante_nombre ?? file.name });
      setStep('extraido');
    } catch (e) { setErr(`No se pudo leer el comprobante: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setLeyendo(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const confirmar = (datos: { monto?: number | null; fecha: string; hora?: string | null }) => {
    setErr(null);
    startTransition(async () => {
      try {
        const r = await marcarPagoManualAction(pago.id, leadId, { ...datos, resto });
        onDone(r.pendiente != null ? `${etiqueta} cobrada · quedan ${fmtUSD(r.pendiente)} pendientes` : `${etiqueta} marcada como pagada`, r.pendiente == null);
      }
      catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    });
  };

  /** Lo que falta para la cuota si se cobra `m` (0 = nada, o se cobró igual o más). */
  const faltaCon = (m: number | null) => (m != null && m > 0 && m < Number(pago.monto_usd) ? Math.round((Number(pago.monto_usd) - m) * 100) / 100 : 0);
  /** La pregunta de la diferencia, pegada al botón de confirmar. Sólo aparece si se cobró de menos. */
  const preguntaResto = (falta: number) => falta > 0 && (
    <div role="radiogroup" aria-label="Qué pasa con la diferencia" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14, padding: '12px 14px', borderRadius: 11, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>Faltan {fmtUSD(falta)} de la cuota</span>
      {([['pendiente', 'Quedan pendientes'], ['descuento', 'Es un descuento']] as const).map(([v, l]) => (
        <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--ink)', cursor: 'pointer' }}>
          <input type="radio" name={`resto-${pago.id}`} checked={resto === v} onChange={() => setResto(v)} />{l}
        </label>
      ))}
    </div>
  );

  const rowStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', fontSize: 13.5, padding: '5px 0', borderBottom: '1px dashed var(--border)' };
  return (
    <Modal onClose={onClose}>
      <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void subir(f); }} />
      {step === 'elegir' && (
        <>
          <h3 style={modalH3}>Marcar {etiqueta} como pagada</h3>
          <p style={modalSub}>Sube el comprobante y la IA extrae monto, fecha y hora. Si no lo tienes, regístralo manual.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button type="button" style={{ ...primaryBtn, width: '100%', opacity: leyendo ? 0.6 : 1 }} onClick={() => fileRef.current?.click()} disabled={leyendo}>{leyendo ? 'Leyendo comprobante…' : 'Subir comprobante'}</button>
            <button type="button" style={{ ...ghostBtn, width: '100%' }} onClick={() => setStep('manual')} disabled={leyendo}>Ingresar manual</button>
          </div>
          <div style={{ textAlign: 'center', marginTop: 14 }}><button type="button" style={linkBtn} onClick={onClose}>Cancelar</button></div>
        </>
      )}
      {step === 'extraido' && ext && (
        <>
          <h3 style={modalH3}>Comprobante leído</h3>
          <p style={modalSub}>Revisa lo extraído antes de confirmar {etiqueta.toLowerCase()}.</p>
          <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', margin: '6px 0 14px' }}>
            <div style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', padding: '10px 14px', fontFamily: MONO, fontSize: 12, color: 'var(--dim)', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ext.nombre}</span><span style={{ color: 'var(--accent)' }}>◆ IA</span>
            </div>
            <div style={{ padding: '12px 16px' }}>
              <div style={rowStyle}><span style={{ color: 'var(--dim)' }}>Monto</span><span style={{ color: 'var(--ink)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{ext.monto != null ? fmtUSD(ext.monto) : `${fmtUSD(Number(pago.monto_usd))} (de la cuota)`}</span></div>
              <div style={rowStyle}><span style={{ color: 'var(--dim)' }}>Fecha</span><span style={{ color: 'var(--ink)', fontWeight: 600 }}>{ext.fecha ? fmtDDMMYYYY(ext.fecha) : `${fmtDDMMYYYY(hoyISO())} (hoy)`}</span></div>
              <div style={{ ...rowStyle, borderBottom: 'none' }}><span style={{ color: 'var(--dim)' }}>Hora</span><span style={{ color: 'var(--ink)', fontWeight: 600 }}>{ext.hora ?? '—'}</span></div>
            </div>
          </div>
          {preguntaResto(faltaCon(ext.monto))}
          <div style={{ display: 'flex', gap: 8, marginTop: faltaCon(ext.monto) > 0 ? 14 : 0 }}>
            <button type="button" style={{ ...goodBtn, flex: 1, padding: '10px 14px', opacity: pending ? 0.6 : 1 }} disabled={pending} onClick={() => confirmar({ monto: ext.monto, fecha: ext.fecha ?? hoyISO(), hora: ext.hora })}>{pending ? 'Guardando…' : 'Confirmar pago'}</button>
            <button type="button" style={ghostBtn} onClick={() => setStep('elegir')} disabled={pending}>Volver</button>
          </div>
        </>
      )}
      {step === 'manual' && (
        <>
          <h3 style={modalH3}>Registro manual · {etiqueta}</h3>
          <p style={modalSub}>Sin comprobante: carga los datos del pago.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 12 }}>
            <Field label="Monto (USD)"><input className="lead-field" type="number" min={0} step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} /></Field>
            <Field label="Fecha"><input className="lead-field" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
            <Field label="Hora"><input className="lead-field" type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></Field>
          </div>
          {preguntaResto(faltaCon(parseFloat(monto) || null))}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button type="button" style={{ ...goodBtn, flex: 1, padding: '10px 14px', opacity: pending || !fecha ? 0.6 : 1 }} disabled={pending || !fecha} onClick={() => confirmar({ monto: parseFloat(monto) || null, fecha, hora: hora || null })}>{pending ? 'Guardando…' : 'Guardar pago'}</button>
            <button type="button" style={ghostBtn} onClick={() => setStep('elegir')} disabled={pending}>Volver</button>
          </div>
        </>
      )}
      {err && <div style={{ ...bannerStyle('err'), marginTop: 12 }}>{err}</div>}
    </Modal>
  );
}

// =============================================================================
/**
 * «Registrar otro pago»: un cobro que no calza con ninguna cuota del plan (un adelanto, un extra, un pago de otro
 * esquema). Entra como una cuota nueva ya cobrada (`registrarPagoSueltoAction`) y suma a lo cobrado del lead. No
 * cambia el monto de cierre: si fue una venta nueva, se corrige en el deal.
 */
function PagoSueltoModal({ leadId, onClose, onDone }: { leadId: number; onClose: () => void; onDone: (msg: string) => void }) {
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [hora, setHora] = useState(horaAhora());
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const valor = parseFloat(monto);
  const listo = Number.isFinite(valor) && valor > 0 && !!fecha;
  const guardar = () => {
    if (!listo) return;
    setErr(null);
    startTransition(async () => {
      try { await registrarPagoSueltoAction(leadId, { monto: valor, fecha, hora: hora || null }); onDone(`Pago de ${fmtUSD(valor)} registrado`); }
      catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    });
  };
  return (
    <Modal onClose={onClose}>
      <h3 style={modalH3}>Registrar otro pago</h3>
      <p style={modalSub}>Un cobro que no es una cuota del plan.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 12 }}>
        <Field label="Monto (USD)"><input className="lead-field" type="number" min={0} step="0.01" value={monto} autoFocus onChange={(e) => setMonto(e.target.value)} /></Field>
        <Field label="Fecha"><input className="lead-field" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
        <Field label="Hora"><input className="lead-field" type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></Field>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button type="button" style={{ ...goodBtn, flex: 1, padding: '10px 14px', opacity: pending || !listo ? 0.6 : 1 }} disabled={pending || !listo} onClick={guardar}>{pending ? 'Guardando…' : 'Registrar pago'}</button>
        <button type="button" style={ghostBtn} onClick={onClose} disabled={pending}>Cancelar</button>
      </div>
      {err && <div style={{ ...bannerStyle('err'), marginTop: 12 }}>{err}</div>}
    </Modal>
  );
}

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
