'use client';

// =============================================================================
// StageMoveDialog — wizard progresivo para completar un movimiento de etapa
// =============================================================================
// Diseño tipo asistente MaKo: logo, dots de progreso, una pregunta grande por
// paso, botones grandes y footer Cancelar/Siguiente. El flujo es dinámico:
// "¿Hubo R1?" (cierres sin reunión piden el motivo y saltan lo demás), Fathom
// omitible si la reunión no se grabó, y el plan de pagos son cuotas explícitas
// (primera cuota + "Agregar cuota") que deben cuadrar con el monto de cierre.

import { useMemo, useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import { stageMeta, type Stage } from '@/lib/pipeline';
import { stepsForStage, funnelReqInfo, type Step } from '@/lib/stage-requirements';
import type { FathomLink } from '@/lib/leads';
import { completeStageMoveAction, type StageMoveCuota } from './actions';
import { autoReunionesAction } from './auto-actions';
import type { CrmLead } from './CrmBoard';
import { Dropdown, type DropdownOption } from '@/app/components/Dropdown';
import { esMaKo, MAKO_STAR_URI } from './mako-setter';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";
const compInput: CSSProperties = { width: '100%', padding: '12px 15px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 15, outline: 'none', textAlign: 'center' };

// "dd/mm/aaaa" (formato del extractor de contratos) → "aaaa-mm-dd" (input date). '' si no matchea.
const dmyaIso = (s: string): string => {
  const m = (s || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
};

export type StageMoveTarget = { to: string; asistioJ1?: boolean | null; asistioJ2?: boolean | null };

export type MoveLeadInfo = {
  id: number;
  name: string;
  fechaJ1: string | null;
  fechaJ2: string | null;
  asistioJ1: boolean | null;
  asistioJ2: boolean | null;
  calificado: boolean | null;
  fathom: FathomLink[];
  monto: number | null;
  motivo: string | null;
  setter: string | null;
  // Higiene (se piden en "Completar datos", no al mover de etapa).
  closer?: string | null;
  empresa?: string | null;
  telefono?: string | null;
  tienePlan?: boolean;
  // Excepciones ya declaradas (persistidas en el lead): el wizard no re-pregunta
  // lo que ya se eximió una vez (cierre sin R1/R2, reunión sin grabar).
  sinR1?: boolean;
  sinR2?: boolean;
  fathomOmitido?: boolean;
  // Deal Details / documentos (para prefill + saber si hay contrato que leer).
  email?: string | null;
  tieneContrato?: boolean;
  // ¿Ya están cargadas las secciones del Deal? Si falta alguna, el cierre ofrece
  // leer el contrato para autocompletarlas (sin volverlas obligatorias).
  dealServicioOk?: boolean;
  dealPromesaOk?: boolean;
  dealFiscalOk?: boolean;
  dealObligacionesOk?: boolean;
};

export function leadToMoveInfo(l: CrmLead): MoveLeadInfo {
  return { id: l.id, name: l.name, fechaJ1: l.fechaJ1, fechaJ2: l.fechaJ2, asistioJ1: l.asistioJ1, asistioJ2: l.asistioJ2, calificado: l.calificado, fathom: l.fathom, monto: l.monto || null, motivo: l.motivo || null, setter: l.setter || null, closer: l.closer || null, empresa: l.company || null, telefono: l.phone || null };
}

type PasoId =
  | 'auto'
  | 'huboR1' | 'motivoNoR1' | 'fechaJ1' | 'asistenciaR1' | 'calificado' | 'fathomR1'
  | 'huboR2' | 'motivoNoR2' | 'fechaJ2' | 'asistenciaR2' | 'fathomR2'
  | 'monto' | 'plan' | 'motivo' | 'motivoDetalle'
  | 'setter' | 'closer' | 'empresa' | 'telefono'
  // Deal Details + documentos + Calendly R2 (pasada única del "Solucionar").
  | 'dealAuto' | 'dealServicio' | 'dealPromesa' | 'dealFiscal' | 'dealObligaciones'
  | 'dealFiscalDoc' | 'comprobante' | 'r2Motivo'
  | 'resumen' | 'finalizo';

// Pasos de datos de reunión que la búsqueda automática puede resolver.
const AUTO_RESOLUBLES: PasoId[] = ['fechaJ1', 'asistenciaR1', 'fathomR1', 'fechaJ2', 'asistenciaR2', 'fathomR2'];

function BigChoice({ options, value, onPick }: { options: Array<{ v: string; label: string; sub?: string }>; value: string | null; onPick: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
      {options.map((o) => {
        const active = value === o.v;
        return (
          <button key={o.v} type="button" onClick={() => onPick(o.v)} style={{ minWidth: 150, padding: '13px 22px', borderRadius: 12, border: '1px solid ' + (active ? 'var(--ink)' : 'var(--border-strong)'), background: active ? 'var(--ink)' : 'var(--surface)', color: active ? '#F3F5F8' : 'var(--ink)', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>
            {o.label}
            {o.sub && <div style={{ fontSize: 11.5, fontWeight: 500, marginTop: 2, opacity: 0.75 }}>{o.sub}</div>}
          </button>
        );
      })}
    </div>
  );
}

// Motivo rápido: chips de opciones frecuentes (setean el texto) + campo abierto.
function MotivoQuick({ value, onChange, sugerencias, placeholder }: { value: string; onChange: (v: string) => void; sugerencias: string[]; placeholder: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {sugerencias.map((s) => {
          const active = value.trim().toLowerCase() === s.toLowerCase();
          return <button key={s} type="button" onClick={() => onChange(s)} style={{ padding: '9px 15px', borderRadius: 11, fontSize: 13.5, fontWeight: 700, fontFamily: SANS, cursor: 'pointer', background: active ? 'var(--ink)' : 'var(--surface)', border: '1px solid ' + (active ? 'var(--ink)' : 'var(--border-strong)'), color: active ? '#F3F5F8' : 'var(--ink)' }}>{s}</button>;
        })}
      </div>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ ...compInput, minHeight: 64, textAlign: 'left', lineHeight: 1.5 }} />
    </div>
  );
}

export function StageMoveDialog({ lead, stages, move, onDone, onClose, titulo, completarDatos = false, equipo = [], faltantes, onVerDetalle }: {
  lead: MoveLeadInfo;
  stages: Stage[];
  move: StageMoveTarget;
  onDone: () => void;
  onClose: () => void;
  /** Título contextual del header (default "Mover a <etapa>"): p.ej. "Completar datos" cuando el destino es la etapa actual. */
  titulo?: string;
  /** "Completar datos" (Solucionar): el wizard también pide higiene (setter/closer/empresa/teléfono). */
  completarDatos?: boolean;
  /** Miembros del equipo para los desplegables de setter/closer (con foto). */
  equipo?: Array<{ nombre: string; email: string; foto_url?: string | null }>;
  /** Lista autoritativa de datos faltantes (del caller). Si viene, el wizard la
   *  usa para saber qué pedir (incluye Deal Details / documentos / respuestas R2)
   *  en vez de re-derivarla — así resuelve TODO en una sola pasada. */
  faltantes?: Step[];
  /** Paso final "¿Ver detalle o salir?" (kanban): si viene, navega a la ficha. */
  onVerDetalle?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const hoyISO = new Date().toISOString().slice(0, 10);
  const to = move.to;
  const label = stageMeta(stages, to)?.label ?? to;
  const esCierre = to === 'ganado' || to === 'facturando';

  // ── Respuestas ──
  const [huboR1, setHuboR1] = useState<boolean | null>(lead.fechaJ1 ? true : null);
  const [motivoNoR1, setMotivoNoR1] = useState('');
  const [huboR2, setHuboR2] = useState<boolean | null>(lead.fechaJ2 ? true : null);
  const [motivoNoR2, setMotivoNoR2] = useState('');
  const [fechaJ1, setFechaJ1] = useState(lead.fechaJ1 ?? '');
  const [fechaJ2, setFechaJ2] = useState(lead.fechaJ2 ?? '');
  const [asistioJ1, setAsistioJ1] = useState<boolean | null>(move.asistioJ1 ?? lead.asistioJ1);
  const [asistioJ2, setAsistioJ2] = useState<boolean | null>(move.asistioJ2 ?? lead.asistioJ2);
  const [calificado, setCalificado] = useState<boolean | null>(lead.calificado);
  const [fathom, setFathom] = useState<FathomLink[]>(() => (lead.fathom.length ? lead.fathom : [{ label: 'Llamada', url: '' }]));
  const [fathomOmitido, setFathomOmitido] = useState(false);
  const [monto, setMonto] = useState(lead.monto ? String(lead.monto) : '');
  // Motivo en 2 pasos: categoría (botón) + detalle específico (texto libre).
  const [motivo, setMotivo] = useState(lead.motivo ?? '');
  const [motivoDetalle, setMotivoDetalle] = useState('');
  const [cuotas, setCuotas] = useState<Array<{ monto: string; fecha: string }>>([{ monto: '', fecha: hoyISO }]);
  // Higiene (solo se piden en "Completar datos"). Si el equipo es de UNA sola
  // persona, se auto-asigna como setter y closer (no tiene sentido preguntarlo).
  const soloUno = equipo.length === 1 ? equipo[0].nombre : '';
  const [setter, setSetter] = useState(lead.setter ?? soloUno);
  const [closer, setCloser] = useState(lead.closer ?? soloUno);
  const [empresa, setEmpresa] = useState(lead.empresa ?? '');
  const [telefono, setTelefono] = useState(lead.telefono ?? '');
  // Deal Details + documentos + Calendly R2 (pasada única de "Solucionar").
  const [dealServicio, setDealServicio] = useState('');
  const [dealPromesa, setDealPromesa] = useState('');
  const [dealFiscalRazon, setDealFiscalRazon] = useState('');
  const [dealFiscalId, setDealFiscalId] = useState('');
  const [dealFiscalDom, setDealFiscalDom] = useState('');
  const [dealFiscalCorreo, setDealFiscalCorreo] = useState(lead.email ?? '');
  const [obCliente, setObCliente] = useState('');
  const [obPrestador, setObPrestador] = useState('');
  const [fiscalDocOmitido, setFiscalDocOmitido] = useState(false);
  const [comprobanteOmitido, setComprobanteOmitido] = useState(false);
  const [r2Motivo, setR2Motivo] = useState('');
  const [dealBusy, setDealBusy] = useState(false);
  const [dealReporte, setDealReporte] = useState<string[] | null>(null);
  const [guardado, setGuardado] = useState(false); // tras confirmar → paso final ver/salir
  const esDescal = to === 'descal';
  const motivoFinal = [motivo.trim(), motivoDetalle.trim()].filter(Boolean).join(' — ');

  // "Automático primero": antes de preguntar datos de reuniones se ofrece
  // buscarlos en Calendly + Fathom; lo resuelto no se vuelve a preguntar.
  const [autoOferta, setAutoOferta] = useState(true);
  const [autoBusy, setAutoBusy] = useState(false);
  const [autoReporte, setAutoReporte] = useState<string[] | null>(null);
  const [autoR2NoEncontrada, setAutoR2NoEncontrada] = useState(false);
  const [resueltos, setResueltos] = useState<Set<PasoId>>(() => {
    // Equipo de una sola persona → setter/closer ya resueltos (se auto-asignan).
    const s = new Set<PasoId>();
    if (equipo.length === 1) { s.add('setter'); s.add('closer'); }
    return s;
  });

  // Pasos que la etapa destino EXIGE con lo que el lead ya tiene (se calcula
  // UNA vez al montar — lazy useState, no depende de las respuestas del wizard).
  // "Solucionar" pasa la lista autoritativa `faltantes` (incluye Deal Details,
  // documentos y respuestas R2) para resolver TODO en una sola pasada.
  const [requeridos] = useState(() => {
    if (faltantes) return new Set(faltantes.map((s) => s.id));
    return new Set(stepsForStage(to, {
      ...funnelReqInfo(stages, to),
      fechaJ1: lead.fechaJ1, fechaJ2: lead.fechaJ2,
      asistioJ1: move.asistioJ1 ?? lead.asistioJ1, asistioJ2: move.asistioJ2 ?? lead.asistioJ2,
      calificado: lead.calificado,
      hasFathomUrl: lead.fathom.some((f) => f.url?.trim()),
      monto: lead.monto, motivo: lead.motivo,
      // Higiene: solo se pide en "Completar datos" (Solucionar), NUNCA al mover de etapa.
      ...(completarDatos ? { setter: lead.setter, closer: lead.closer, empresa: lead.empresa, telefono: lead.telefono } : {}),
      tienePlan: to === 'ganado' ? (lead.tienePlan ?? false) : undefined,
      hoyISO,
      sinR1: lead.sinR1, sinR2: lead.sinR2, fathomOmitido: lead.fathomOmitido,
    }).map((s) => s.id));
  });

  // ── Flujo DINÁMICO: la lista de pasos visibles depende de las respuestas ──
  const pasos = useMemo<PasoId[]>(() => {
    const p: PasoId[] = [];
    const necesitaR1 = requeridos.has('fechaJ1') || requeridos.has('asistenciaR1') || requeridos.has('calificado') || requeridos.has('fathomR1');
    const necesitaR2 = requeridos.has('fechaJ2') || requeridos.has('asistenciaR2') || requeridos.has('fathomR2');

    if (necesitaR1) {
      // En cierres puede no haber existido la reunión (caso raro): preguntar.
      if (esCierre && !lead.fechaJ1) p.push('huboR1');
      if (huboR1 === false) p.push('motivoNoR1');
      else {
        if (requeridos.has('fechaJ1')) p.push('fechaJ1');
        if (requeridos.has('asistenciaR1')) p.push('asistenciaR1');
        if (asistioJ1 !== false) {
          if (requeridos.has('calificado')) p.push('calificado');
          if (requeridos.has('fathomR1')) p.push('fathomR1');
        }
      }
    }
    // Si no hubo R1, no tiene sentido preguntar por R2.
    if (necesitaR2 && huboR1 !== false) {
      if (esCierre && !lead.fechaJ2) p.push('huboR2');
      if (huboR2 === false) p.push('motivoNoR2');
      else {
        if (requeridos.has('fechaJ2')) p.push('fechaJ2');
        if (requeridos.has('asistenciaR2')) p.push('asistenciaR2');
        if (asistioJ2 !== false && requeridos.has('fathomR2')) p.push('fathomR2');
      }
    }
    // Automatización del cierre PRIMERO: en un cierre (Ganado/Facturando) se ofrece
    // leer el CONTRATO (dealAuto) para autocompletar servicio/promesa/fiscal/
    // obligaciones ANTES de las preguntas manuales. En "Solucionar" además pide lo
    // que el contrato no complete. No vuelve obligatorias las secciones (respeta el
    // cierre por reserva sin contrato firmado todavía).
    const necesitaDeal = requeridos.has('dealServicio') || requeridos.has('dealPromesa') || requeridos.has('dealFiscal') || requeridos.has('dealObligaciones');
    const dealCompleto = !!(lead.dealServicioOk && lead.dealPromesaOk && lead.dealFiscalOk && lead.dealObligacionesOk);
    if ((esCierre && !dealCompleto) || necesitaDeal) p.push('dealAuto');
    if (requeridos.has('dealServicio')) p.push('dealServicio');
    if (requeridos.has('dealPromesa')) p.push('dealPromesa');
    if (requeridos.has('dealFiscal')) p.push('dealFiscal');
    if (requeridos.has('dealObligaciones')) p.push('dealObligaciones');

    if (requeridos.has('monto')) p.push('monto');
    if (requeridos.has('plan')) p.push('plan');
    if (requeridos.has('motivo')) { p.push('motivo'); p.push('motivoDetalle'); }
    // Higiene (Completar datos): setter/closer/empresa/teléfono.
    if (requeridos.has('setter')) p.push('setter');
    if (requeridos.has('closer')) p.push('closer');
    if (requeridos.has('empresa')) p.push('empresa');
    if (requeridos.has('telefono')) p.push('telefono');
    // Documentos fiscales / comprobantes / motivo de R2 externa: al final.
    if (requeridos.has('dealFiscalDoc')) p.push('dealFiscalDoc');
    if (requeridos.has('comprobante')) p.push('comprobante');
    if (requeridos.has('r2Respuestas')) p.push('r2Motivo');
    p.push('resumen');
    // Lo que la búsqueda automática ya resolvió no se vuelve a preguntar.
    const filtrados = p.filter((id) => id === 'resumen' || !resueltos.has(id));
    // "Automático primero": si hay datos de reunión por pedir, ofrecer buscarlos.
    // Con reporte ya generado el paso se mantiene (aunque todo quede resuelto)
    // para que el usuario VEA qué se encontró antes de seguir.
    if (autoOferta && (autoReporte !== null || filtrados.some((id) => (AUTO_RESOLUBLES as string[]).includes(id)))) {
      filtrados.unshift('auto');
    }
    return filtrados;
  }, [requeridos, esCierre, lead.fechaJ1, lead.fechaJ2, lead.dealServicioOk, lead.dealPromesaOk, lead.dealFiscalOk, lead.dealObligacionesOk, huboR1, huboR2, asistioJ1, asistioJ2, autoOferta, resueltos, autoReporte]);

  // Índice actual + historial REAL de pasos visitados (para que Atrás vuelva
  // al paso anterior visitado, no al índice-1 cuando hubo saltos).
  const [idx, setIdx] = useState(0);
  const [visitados, setVisitados] = useState<PasoId[]>([]);
  const paso = pasos[Math.min(idx, pasos.length - 1)];

  const totalMonto = parseFloat(monto) || 0;
  const sumaCuotas = cuotas.reduce((s, c) => s + (parseFloat(c.monto) || 0), 0);
  // El plan debe cubrir el monto de cierre, pero se tolera una diferencia chica:
  // el deal se pacta en USD y los cobros suelen ser en MXN, así que al convertir
  // cada cuota quedan diferencias de redondeo (centavos a unos pocos dólares).
  const tolCuotas = Math.max(1, totalMonto * 0.005);
  const cuotasCuadran = requeridos.has('plan') ? Math.abs(sumaCuotas - totalMonto) <= tolCuotas && sumaCuotas > 0 : true;

  const respondido = (() => {
    switch (paso) {
      case 'auto': return autoReporte != null; // sin buscar, se sale con "Cargar a mano"
      case 'huboR1': return huboR1 != null;
      case 'motivoNoR1': return !!motivoNoR1.trim();
      case 'huboR2': return huboR2 != null;
      case 'motivoNoR2': return !!motivoNoR2.trim();
      case 'fechaJ1': return !!fechaJ1;
      case 'fechaJ2': return !!fechaJ2;
      case 'asistenciaR1': return asistioJ1 != null;
      case 'asistenciaR2': return asistioJ2 != null;
      case 'calificado': return calificado != null;
      case 'fathomR1': case 'fathomR2': return fathomOmitido || fathom.some((f) => f.url.trim());
      case 'monto': return totalMonto > 0;
      case 'plan': return cuotasCuadran;
      case 'motivo': return !!motivo.trim();
      case 'motivoDetalle': return !!motivoDetalle.trim();
      // Sin equipo configurado no hay a quién seleccionar → se permite continuar.
      case 'setter': return equipo.length === 0 || !!setter.trim();
      case 'closer': return equipo.length === 0 || !!closer.trim();
      case 'empresa': return !!empresa.trim();
      case 'telefono': return !!telefono.trim();
      case 'dealAuto': return true; // buscar con IA es opcional; se puede seguir a mano
      case 'dealServicio': return !!dealServicio.trim();
      case 'dealPromesa': return !!dealPromesa.trim();
      case 'dealFiscal': return !!dealFiscalRazon.trim();
      case 'dealObligaciones': return !!obCliente.trim() || !!obPrestador.trim();
      case 'dealFiscalDoc': return fiscalDocOmitido; // subir marca resuelto (se salta); omitir habilita
      case 'comprobante': return comprobanteOmitido;
      case 'r2Motivo': return !!r2Motivo.trim();
      default: return true;
    }
  })();

  const avanzar = () => {
    setErr(null);
    setVisitados((v) => [...v, paso]);
    setIdx((i) => Math.min(i + 1, pasos.length - 1));
  };
  const atras = () => {
    setErr(null);
    // Volver al ÚLTIMO paso visitado (aunque la lista haya cambiado por saltos).
    const prev = visitados[visitados.length - 1];
    if (!prev) { onClose(); return; }
    setVisitados((v) => v.slice(0, -1));
    const i = pasos.indexOf(prev);
    setIdx(i >= 0 ? i : Math.max(0, idx - 1));
  };

  // Un dato "se pidió" si tuvo paso propio O lo resolvió la búsqueda automática.
  const pide = (id: PasoId) => pasos.includes(id) || resueltos.has(id);

  const confirmar = () => {
    setErr(null);
    startTransition(async () => {
      try {
        const cuotasPayload: StageMoveCuota[] = requeridos.has('plan')
          ? cuotas.filter((c) => parseFloat(c.monto) > 0).map((c) => ({ monto: parseFloat(c.monto), fecha: c.fecha || null }))
          : [];
        await completeStageMoveAction(lead.id, to, {
          ...(pide('fechaJ1') && huboR1 !== false ? { fechaJ1: fechaJ1 || null } : {}),
          ...(pide('fechaJ2') && huboR2 !== false ? { fechaJ2: fechaJ2 || null } : {}),
          ...(pide('asistenciaR1') ? { asistioJ1 } : { asistioJ1: move.asistioJ1 }),
          ...(pide('asistenciaR2') ? { asistioJ2 } : { asistioJ2: move.asistioJ2 }),
          ...(pide('calificado') ? { calificado } : (to === 'ganado' ? { calificado: true } : {})),
          ...(pide('fathomR1') || pide('fathomR2') ? { fathom: fathom.filter((f) => f.url.trim() || f.label.trim()) } : {}),
          ...(pide('monto') ? { monto: totalMonto || null } : {}),
          ...(pide('motivo') ? { motivo: motivoFinal || null } : {}),
          ...(pide('setter') ? { setter: setter.trim() || null } : {}),
          ...(pide('closer') ? { closer: closer.trim() || null } : {}),
          ...(pide('empresa') ? { empresa: empresa.trim() || null } : {}),
          ...(pide('telefono') ? { telefono: telefono.trim() || null } : {}),
          // Deal Details / documentos / respuestas R2 (pasada única).
          ...(pide('dealServicio') && dealServicio.trim() ? { dealServicio: dealServicio.trim() } : {}),
          ...(pide('dealPromesa') && dealPromesa.trim() ? { dealPromesa: dealPromesa.trim() } : {}),
          ...(pide('dealFiscal') && dealFiscalRazon.trim() ? { dealFiscal: { razon: dealFiscalRazon.trim(), id_fiscal: dealFiscalId.trim() || null, domicilio: dealFiscalDom.trim() || null, correo: dealFiscalCorreo.trim() || null } } : {}),
          ...(pide('dealObligaciones') && (obCliente.trim() || obPrestador.trim()) ? { dealObligaciones: { cliente: obCliente.split('\n').map((s) => s.trim()).filter(Boolean), prestador: obPrestador.split('\n').map((s) => s.trim()).filter(Boolean) } } : {}),
          ...(fiscalDocOmitido ? { dealFiscalDocOmitido: true } : {}),
          ...(comprobanteOmitido ? { comprobanteOmitido: true } : {}),
          ...(pide('r2Motivo') && r2Motivo.trim() ? { r2AgendaExternaMotivo: r2Motivo.trim() } : {}),
          ...(cuotasPayload.length ? { cuotas: cuotasPayload } : {}),
          sinR1Motivo: huboR1 === false ? motivoNoR1.trim() : null,
          sinR2Motivo: huboR1 !== false && huboR2 === false ? motivoNoR2.trim() : null,
          fathomOmitido,
        });
        // Solucionar (completar datos) → paso final "¿Ver detalle o salir?".
        // Mover de etapa (drag-drop) → cierra directo (mantiene el toast de undo).
        if (completarDatos) setGuardado(true); else onDone();
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    });
  };

  // ── Render del paso ──
  // Categorías según el desenlace: perder ≠ descalificar (motivos distintos).
  const sugerencias = esDescal
    ? ['No calificado', 'Fuera de perfil', 'Sin presupuesto', 'No es quien decide', 'Otro']
    : ['Precio', 'Timing', 'Eligió a otro', 'Fantasma', 'No respondió', 'Otro'];
  let pregunta = '';
  let sub = '';
  let cuerpo: ReactNode = null;
  const boolStep = (value: boolean | null, set: (v: boolean) => void, si: string, no: string) => (
    <BigChoice value={value == null ? null : String(value)} onPick={(v) => set(v === 'true')} options={[{ v: 'true', label: si }, { v: 'false', label: no }]} />
  );

  // Deal auto: lee el contrato (el ya cargado o uno que se suba) y completa las
  // secciones vacías. Reusa /api/extract-contract (el mismo de Deal Details).
  const buscarDealAuto = async (file?: File) => {
    setDealBusy(true); setErr(null);
    try {
      const fd = new FormData();
      if (file) fd.append('file', file);
      fd.append('leadId', String(lead.id));
      const r = await fetch('/api/extract-contract', { method: 'POST', body: fd });
      const j = await r.json();
      if (j.error) { setErr(j.error); return; }
      const ok = new Set(resueltos);
      const rell: string[] = [];
      if (j.servicio?.que_es && !dealServicio.trim()) { setDealServicio(j.servicio.que_es); ok.add('dealServicio'); rell.push('servicio'); }
      if (j.promesa?.resultado && !dealPromesa.trim()) { setDealPromesa(j.promesa.resultado); ok.add('dealPromesa'); rell.push('promesa'); }
      if (j.fiscal?.razon && !dealFiscalRazon.trim()) {
        setDealFiscalRazon(j.fiscal.razon);
        if (j.fiscal.id_fiscal) setDealFiscalId(j.fiscal.id_fiscal);
        if (j.fiscal.domicilio) setDealFiscalDom(j.fiscal.domicilio);
        if (j.fiscal.correo) setDealFiscalCorreo((c) => c || j.fiscal.correo);
        ok.add('dealFiscal'); rell.push('datos fiscales');
      }
      if ((j.obligaciones?.cliente?.length || j.obligaciones?.prestador?.length) && !obCliente.trim() && !obPrestador.trim()) {
        setObCliente((j.obligaciones.cliente ?? []).join('\n'));
        setObPrestador((j.obligaciones.prestador ?? []).join('\n'));
        ok.add('dealObligaciones'); rell.push('obligaciones');
      }
      // PLAN DE PAGOS del contrato — lo más importante del cierre. El extractor
      // devuelve total_usd + cuotas [{monto, fecha dd/mm/aaaa}]; los cargamos si el
      // usuario no puso nada a mano, y marcamos monto/plan resueltos.
      if (j.total_usd != null && !monto.trim()) { setMonto(String(j.total_usd)); ok.add('monto'); rell.push('monto de cierre'); }
      if (Array.isArray(j.cuotas) && j.cuotas.length && cuotas.every((c) => !c.monto.trim())) {
        setCuotas(j.cuotas.map((c: { monto?: number | string | null; fecha?: string | null }) => ({ monto: c.monto != null ? String(c.monto) : '', fecha: dmyaIso(c.fecha ?? '') })));
        ok.add('plan'); rell.push('plan de cuotas');
      }
      setResueltos(ok);
      setDealReporte(rell.length ? rell.map((x) => `Se completó: ${x}`) : ['El contrato no aportó datos nuevos para completar. Cargá a mano.']);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setDealBusy(false); }
  };

  // Documento fiscal del cliente: subir (lo lee /api/extract-deal-fiscal y guarda
  // doc_path server-side → satisface el requisito) o se omite en el paso.
  const subirFiscalDoc = async (file: File) => {
    setDealBusy(true); setErr(null);
    try {
      const fd = new FormData(); fd.append('file', file); fd.append('leadId', String(lead.id));
      const r = await fetch('/api/extract-deal-fiscal', { method: 'POST', body: fd });
      const j = await r.json();
      if (j.error) { setErr(j.error); return; }
      if (j.razon && !dealFiscalRazon.trim()) setDealFiscalRazon(j.razon);
      if (j.id_fiscal && !dealFiscalId.trim()) setDealFiscalId(j.id_fiscal);
      if (j.domicilio && !dealFiscalDom.trim()) setDealFiscalDom(j.domicilio);
      if (j.correo) setDealFiscalCorreo((c) => c || j.correo);
      const ok = new Set(resueltos); ok.add('dealFiscalDoc'); if (j.razon) ok.add('dealFiscal'); setResueltos(ok);
      setFiscalDocOmitido(false); // ya está resuelto: el flujo salta este paso
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setDealBusy(false); }
  };

  // Aplica lo encontrado por la búsqueda automática y marca resuelto lo que
  // ya no hay que preguntar (calificado y monto siempre quedan en manos humanas).
  const buscarAuto = async () => {
    setAutoBusy(true);
    setErr(null);
    try {
      const r = await autoReunionesAction(lead.id);
      if ('error' in r) { setErr(r.error); return; }
      const ok = new Set(resueltos);
      if (r.fechaJ1) { setFechaJ1(r.fechaJ1); setHuboR1(true); ok.add('fechaJ1'); ok.add('huboR1'); }
      if (r.asistioJ1 != null) { setAsistioJ1(r.asistioJ1); ok.add('asistenciaR1'); }
      if (r.fechaJ2) { setFechaJ2(r.fechaJ2); setHuboR2(true); ok.add('fechaJ2'); ok.add('huboR2'); }
      if (r.asistioJ2 != null) { setAsistioJ2(r.asistioJ2); ok.add('asistenciaR2'); }
      if (r.fathomR1 || r.fathomR2) {
        setFathom((prev) => {
          const links = prev.filter((f) => f.url.trim());
          for (const nuevo of [r.fathomR1, r.fathomR2]) {
            if (nuevo && !links.some((l) => l.url === nuevo.url)) links.push(nuevo);
          }
          return links.length ? links : prev;
        });
        if (r.fathomR1) ok.add('fathomR1');
        if (r.fathomR2) ok.add('fathomR2');
      }
      setResueltos(ok);
      // Si no apareció ninguna R2 (ni fecha ni asistencia) y el lead tampoco la
      // tenía, probablemente se cerró en la R1: en el paso de R2 pedimos solo una
      // confirmación en vez del alta manual completa.
      setAutoR2NoEncontrada(!r.fechaJ2 && r.asistioJ2 == null && !lead.fechaJ2);
      setAutoReporte([
        ...(r.encontrado.length ? r.encontrado : ['No encontré nada en Calendly ni Fathom para este lead.']),
        ...r.faltante.map((f) => `A mano: ${f}`),
      ]);
    } finally {
      setAutoBusy(false);
    }
  };

  switch (paso) {
    case 'auto':
      pregunta = '¿Buscamos los datos automáticamente?';
      sub = 'MaKo revisa Calendly y Fathom y solo te pregunta lo que falte.';
      cuerpo = autoReporte ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, textAlign: 'left' }}>
          {autoReporte.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'baseline', fontSize: 13.5, padding: '9px 13px', background: 'var(--surface-2)', borderRadius: 10 }}>
              <span style={{ flex: 'none' }}>{l.startsWith('A mano:') ? '✎' : '✓'}</span>
              <span style={{ color: 'var(--ink)' }}>{l}</span>
            </div>
          ))}
          <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 4 }}>Seguí con «Siguiente»: solo se pregunta lo que faltó.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" disabled={autoBusy} onClick={buscarAuto} style={{ minWidth: 190, padding: '13px 22px', borderRadius: 12, border: 'none', background: 'var(--ink)', color: '#F3F5F8', fontSize: 14.5, fontWeight: 700, cursor: autoBusy ? 'default' : 'pointer', fontFamily: SANS, opacity: autoBusy ? 0.7 : 1 }}>
            {autoBusy ? 'Buscando…' : '✦ Buscar automáticamente'}
            <div style={{ fontSize: 11.5, fontWeight: 500, marginTop: 2, opacity: 0.75 }}>Recomendado</div>
          </button>
          <button type="button" disabled={autoBusy} onClick={() => setAutoOferta(false)} style={{ minWidth: 150, padding: '13px 22px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>
            Cargar a mano
          </button>
        </div>
      );
      break;
    case 'huboR1':
      pregunta = '¿Hubo Reunión 1?';
      sub = 'Hay cierres raros sin reunión — si no la hubo, contanos por qué.';
      cuerpo = boolStep(huboR1, setHuboR1, 'Sí, hubo R1', 'No hubo R1');
      break;
    case 'motivoNoR1':
      pregunta = '¿Por qué no hubo Reunión 1?';
      cuerpo = <MotivoQuick value={motivoNoR1} onChange={setMotivoNoR1} sugerencias={['Cerró en el primer contacto', 'Cliente referido', 'Cerró por WhatsApp', 'Ya conocía el servicio']} placeholder="Ej: cerró directo por WhatsApp, cliente referido…" />;
      break;
    case 'huboR2':
      pregunta = '¿Hubo una Reunión 2?';
      sub = autoR2NoEncontrada
        ? 'MaKo no encontró una Reunión 2 en Calendly ni Fathom. Si cerraste en la primera llamada, confirmá con «No hubo R2».'
        : 'Si cerraste en la primera llamada (sin una segunda reunión), elegí «No hubo R2».';
      cuerpo = boolStep(huboR2, setHuboR2, 'Sí, hubo R2', 'No hubo R2');
      break;
    case 'motivoNoR2':
      pregunta = '¿Por qué no hubo Reunión 2?';
      cuerpo = <MotivoQuick value={motivoNoR2} onChange={setMotivoNoR2} sugerencias={['Cerró en la R1', 'Cerró por WhatsApp', 'No hizo falta una R2', 'Se reprogramó']} placeholder="Ej: cerró en la misma R1…" />;
      break;
    case 'fechaJ1':
      pregunta = '¿Cuándo es (o fue) la Reunión 1?';
      cuerpo = <input type="date" value={fechaJ1} onChange={(e) => setFechaJ1(e.target.value)} autoFocus style={{ ...compInput, maxWidth: 260, margin: '0 auto', display: 'block' }} />;
      break;
    case 'fechaJ2':
      pregunta = '¿Cuándo es (o fue) la Reunión 2?';
      cuerpo = <input type="date" value={fechaJ2} onChange={(e) => setFechaJ2(e.target.value)} autoFocus style={{ ...compInput, maxWidth: 260, margin: '0 auto', display: 'block' }} />;
      break;
    case 'asistenciaR1':
      pregunta = '¿Asistió a la Reunión 1?';
      cuerpo = boolStep(asistioJ1, setAsistioJ1, 'Sí, asistió', 'No asistió');
      break;
    case 'asistenciaR2':
      pregunta = '¿Asistió a la Reunión 2?';
      cuerpo = boolStep(asistioJ2, setAsistioJ2, 'Sí, asistió', 'No asistió');
      break;
    case 'calificado':
      pregunta = '¿Era un lead calificado?';
      sub = 'Este dato entrena las campañas de Meta (CAPI): marcalo siempre.';
      cuerpo = boolStep(calificado, setCalificado, 'Sí, calificado', 'No calificado');
      break;
    case 'fathomR1':
    case 'fathomR2':
      pregunta = `Link de Fathom de la ${paso === 'fathomR1' ? 'Reunión 1' : 'Reunión 2'}`;
      sub = 'Si la reunión no se grabó, podés omitirlo.';
      cuerpo = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {fathom.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 8 }}>
              <input aria-label="Etiqueta" value={f.label} onChange={(e) => setFathom((arr) => arr.map((x, xi) => (xi === i ? { ...x, label: e.target.value } : x)))} placeholder="Llamada" style={{ ...compInput, flex: 'none', width: 110, textAlign: 'left' }} />
              <input aria-label="URL" value={f.url} onChange={(e) => { setFathomOmitido(false); setFathom((arr) => arr.map((x, xi) => (xi === i ? { ...x, url: e.target.value } : x))); }} placeholder="https://fathom.video/…" autoFocus={i === 0} style={{ ...compInput, flex: 1, textAlign: 'left' }} />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
            <button type="button" onClick={() => setFathom((arr) => [...arr, { label: '', url: '' }])} style={{ padding: 8, borderRadius: 9, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--dim)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: SANS, flex: 1 }}>+ Agregar otro link</button>
            <button type="button" onClick={() => setFathomOmitido(true)} style={{ padding: 8, borderRadius: 9, border: '1px solid ' + (fathomOmitido ? 'var(--warn-fill)' : 'var(--border-strong)'), background: fathomOmitido ? 'var(--warn-bg)' : 'transparent', color: fathomOmitido ? 'var(--warn)' : 'var(--dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>{fathomOmitido ? 'Sin grabación ✓' : 'No se grabó (omitir)'}</button>
          </div>
        </div>
      );
      break;
    case 'monto':
      pregunta = '¿De cuánto fue el cierre?';
      sub = 'En USD.';
      cuerpo = <input inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" autoFocus style={{ ...compInput, maxWidth: 220, margin: '0 auto', display: 'block', fontSize: 22, fontWeight: 700 }} />;
      break;
    case 'motivo':
      pregunta = esDescal ? '¿Por qué se descalificó?' : '¿Por qué se perdió?';
      sub = 'Elegí la categoría; en el próximo paso contás el detalle.';
      cuerpo = (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {sugerencias.map((s) => {
            const active = motivo.trim().toLowerCase() === s.toLowerCase();
            return <button key={s} type="button" onClick={() => setMotivo(s)} style={{ padding: '9px 16px', borderRadius: 11, fontSize: 14, fontWeight: 700, fontFamily: SANS, cursor: 'pointer', background: active ? 'var(--ink)' : 'var(--surface)', border: '1px solid ' + (active ? 'var(--ink)' : 'var(--border-strong)'), color: active ? '#F3F5F8' : 'var(--ink)' }}>{s}</button>;
          })}
        </div>
      );
      break;
    case 'motivoDetalle':
      pregunta = esDescal ? 'Contanos por qué no calificaba' : 'Sé específico: ¿qué pasó?';
      sub = motivo.trim() ? `Categoría: ${motivo.trim()}. Agregá el detalle concreto.` : 'Agregá el detalle concreto.';
      cuerpo = <textarea value={motivoDetalle} onChange={(e) => setMotivoDetalle(e.target.value)} placeholder={esDescal ? 'Ej: factura menos de X, no tiene equipo a cargo…' : 'Ej: le pareció caro vs. la competencia, se enfrió tras la R2…'} autoFocus style={{ ...compInput, minHeight: 90, textAlign: 'left', lineHeight: 1.5 }} />;
      break;
    case 'setter':
    case 'closer': {
      const val = paso === 'setter' ? setter : closer;
      const set = paso === 'setter' ? setSetter : setCloser;
      pregunta = paso === 'setter' ? '¿Quién es el Setter?' : '¿Quién es el Closer?';
      sub = paso === 'setter' ? 'El que agendó la reunión. Elegilo de tu equipo.' : 'El que corrió la llamada de venta. Elegilo de tu equipo.';
      // Setter/Closer SIEMPRE un desplegable del equipo del workspace (con foto) —
      // nunca texto libre (dato sensible, vive en Configuraciones › Equipo).
      const opts: DropdownOption[] = [
        { value: '', label: 'Sin asignar' },
        ...equipo.map((m) => ({ value: m.nombre, label: m.nombre, avatar: m.foto_url ?? null })),
      ];
      if (val.trim() && !equipo.some((m) => m.nombre === val.trim())) {
        // MaKo se pone solo (nutrición automática): se muestra con su estrella y NO
        // es re-seleccionable (disabled). Cualquier otro valor legacy = "fuera del equipo".
        opts.push(esMaKo(val)
          ? { value: val.trim(), label: 'MaKo', sub: 'automático · nutrición', avatar: MAKO_STAR_URI, disabled: true }
          : { value: val.trim(), label: val.trim(), sub: 'fuera del equipo', avatar: null });
      }
      cuerpo = equipo.length > 0 ? (
        <div style={{ maxWidth: 340, margin: '0 auto' }}>
          <Dropdown value={val} options={opts} onChange={set} placeholder="Elegí del equipo…" width="100%" ariaLabel={paso === 'setter' ? 'Setter' : 'Closer'} />
        </div>
      ) : (
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '16px 18px', fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.5, textAlign: 'left' }}>
          Todavía no tenés equipo configurado. Agregá a tus setters y closers en <b>Configuraciones › Equipo</b> y después vas a poder asignarlos acá. Por ahora podés continuar sin asignar.
        </div>
      );
      break;
    }
    case 'empresa':
      pregunta = '¿Cuál es la empresa del lead?';
      cuerpo = <input value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Nombre de la empresa" autoFocus style={{ ...compInput, maxWidth: 320, margin: '0 auto', textAlign: 'left' }} />;
      break;
    case 'telefono':
      pregunta = '¿Cuál es el teléfono de contacto?';
      cuerpo = <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+52 …" type="tel" autoFocus style={{ ...compInput, maxWidth: 320, margin: '0 auto', textAlign: 'left' }} />;
      break;
    case 'dealAuto':
      pregunta = '¿Completamos el cierre con el contrato?';
      sub = 'MaKo lee el contrato y llena servicio, promesa, datos fiscales y obligaciones. Después revisás lo que falte.';
      cuerpo = dealReporte ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, textAlign: 'left' }}>
          {dealReporte.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'baseline', fontSize: 13.5, padding: '9px 13px', background: 'var(--surface-2)', borderRadius: 10 }}><span>✓</span><span style={{ color: 'var(--ink)' }}>{l}</span></div>
          ))}
          <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 4 }}>Seguí con «Siguiente»: solo se pregunta lo que faltó.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          {lead.tieneContrato ? (
            <button type="button" disabled={dealBusy} onClick={() => void buscarDealAuto()} style={{ minWidth: 220, padding: '13px 22px', borderRadius: 12, border: 'none', background: 'var(--ink)', color: '#F3F5F8', fontSize: 14.5, fontWeight: 700, cursor: dealBusy ? 'default' : 'pointer', fontFamily: SANS, opacity: dealBusy ? 0.7 : 1 }}>{dealBusy ? 'Leyendo contrato…' : '✦ Completar con IA (contrato cargado)'}</button>
          ) : (
            <label style={{ minWidth: 220, padding: '13px 22px', borderRadius: 12, background: 'var(--ink)', color: '#F3F5F8', fontSize: 14.5, fontWeight: 700, cursor: dealBusy ? 'default' : 'pointer', fontFamily: SANS, textAlign: 'center', opacity: dealBusy ? 0.7 : 1 }}>
              {dealBusy ? 'Leyendo contrato…' : '✦ Subir contrato y completar'}
              <input type="file" accept=".pdf,image/*" style={{ display: 'none' }} disabled={dealBusy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void buscarDealAuto(f); }} />
            </label>
          )}
          <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>O tocá «Siguiente» para cargarlo a mano.</div>
        </div>
      );
      break;
    case 'dealServicio':
      pregunta = '¿Qué es el servicio que se cerró?';
      sub = 'En una o dos frases: qué se entrega.';
      cuerpo = <textarea value={dealServicio} onChange={(e) => setDealServicio(e.target.value)} placeholder="Ej: Programa de 3 meses de consultoría comercial 1:1 + implementación de CRM." autoFocus style={{ ...compInput, minHeight: 90, textAlign: 'left', lineHeight: 1.5 }} />;
      break;
    case 'dealPromesa':
      pregunta = '¿Qué resultado se prometió?';
      cuerpo = <textarea value={dealPromesa} onChange={(e) => setDealPromesa(e.target.value)} placeholder="Ej: Duplicar reuniones agendadas en 90 días." autoFocus style={{ ...compInput, minHeight: 90, textAlign: 'left', lineHeight: 1.5 }} />;
      break;
    case 'dealFiscal':
      pregunta = 'Datos fiscales del cliente (a facturar)';
      sub = 'La razón fiscal es lo mínimo; el resto ayuda pero es opcional.';
      cuerpo = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input value={dealFiscalRazon} onChange={(e) => setDealFiscalRazon(e.target.value)} placeholder="Razón fiscal / nombre *" autoFocus style={{ ...compInput, textAlign: 'left' }} />
          <input value={dealFiscalId} onChange={(e) => setDealFiscalId(e.target.value)} placeholder="Identificación fiscal (RFC/CUIT/NIT…)" style={{ ...compInput, textAlign: 'left' }} />
          <input value={dealFiscalDom} onChange={(e) => setDealFiscalDom(e.target.value)} placeholder="Domicilio fiscal" style={{ ...compInput, textAlign: 'left' }} />
          <input value={dealFiscalCorreo} onChange={(e) => setDealFiscalCorreo(e.target.value)} placeholder="Correo de facturación" type="email" style={{ ...compInput, textAlign: 'left' }} />
        </div>
      );
      break;
    case 'dealObligaciones':
      pregunta = 'Obligaciones del cierre';
      sub = 'Una por línea. Al menos una alcanza para marcarlo.';
      cuerpo = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
          <div><div style={{ fontSize: 12.5, color: 'var(--dim)', marginBottom: 5 }}>Del cliente</div><textarea value={obCliente} onChange={(e) => setObCliente(e.target.value)} placeholder="Ej: Enviar accesos&#10;Asistir a las sesiones" autoFocus style={{ ...compInput, minHeight: 72, textAlign: 'left', lineHeight: 1.5 }} /></div>
          <div><div style={{ fontSize: 12.5, color: 'var(--dim)', marginBottom: 5 }}>Del prestador</div><textarea value={obPrestador} onChange={(e) => setObPrestador(e.target.value)} placeholder="Ej: Entregar el plan en 7 días&#10;Soporte por WhatsApp" style={{ ...compInput, minHeight: 72, textAlign: 'left', lineHeight: 1.5 }} /></div>
        </div>
      );
      break;
    case 'dealFiscalDoc':
      pregunta = 'Documento fiscal del cliente';
      sub = 'Subí la constancia/RFC/CUIT (MaKo lee los datos). Si no lo tenés, podés omitirlo.';
      cuerpo = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          <label style={{ minWidth: 220, padding: '13px 22px', borderRadius: 12, background: 'var(--ink)', color: '#F3F5F8', fontSize: 14.5, fontWeight: 700, cursor: dealBusy ? 'default' : 'pointer', fontFamily: SANS, textAlign: 'center', opacity: dealBusy ? 0.7 : 1 }}>
            {dealBusy ? 'Leyendo documento…' : '⇪ Subir documento fiscal'}
            <input type="file" accept=".pdf,image/*" style={{ display: 'none' }} disabled={dealBusy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void subirFiscalDoc(f); }} />
          </label>
          <button type="button" onClick={() => setFiscalDocOmitido(true)} style={{ padding: '10px 18px', borderRadius: 11, border: '1px solid ' + (fiscalDocOmitido ? 'var(--warn-fill)' : 'var(--border-strong)'), background: fiscalDocOmitido ? 'var(--warn-bg)' : 'transparent', color: fiscalDocOmitido ? 'var(--warn)' : 'var(--dim)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>{fiscalDocOmitido ? 'Se omite ✓' : 'No lo tengo (omitir)'}</button>
        </div>
      );
      break;
    case 'comprobante':
      pregunta = 'Comprobante de pago';
      sub = 'El comprobante de cada cuota se sube al marcarla como pagada, en Deal Details. Acá podés omitir el aviso.';
      cuerpo = (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button type="button" onClick={() => setComprobanteOmitido(true)} style={{ padding: '11px 20px', borderRadius: 11, border: '1px solid ' + (comprobanteOmitido ? 'var(--warn-fill)' : 'var(--border-strong)'), background: comprobanteOmitido ? 'var(--warn-bg)' : 'transparent', color: comprobanteOmitido ? 'var(--warn)' : 'var(--dim)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>{comprobanteOmitido ? 'Se omite ✓' : 'Omitir por ahora'}</button>
        </div>
      );
      break;
    case 'r2Motivo':
      pregunta = '¿Por qué se agendó la R2 fuera de Calendly?';
      sub = 'No encontramos las respuestas de Calendly de la R2. Si se agendó por otro lado, contanos por qué (así no lo pedimos más).';
      cuerpo = <textarea value={r2Motivo} onChange={(e) => setR2Motivo(e.target.value)} placeholder="Ej: se coordinó por WhatsApp, se reprogramó a mano, reunión interna…" autoFocus style={{ ...compInput, minHeight: 90, textAlign: 'left', lineHeight: 1.5 }} />;
      break;
    case 'plan':
      pregunta = '¿Cómo se van a cobrar las cuotas?';
      sub = `Las cuotas tienen que sumar el monto de cierre (${totalMonto ? '$' + totalMonto.toLocaleString('en-US') : 'definilo en el paso anterior'}). Se toleran diferencias chicas por el cambio USD/MXN. Si es una reserva, cargá el plan completo estimado: la reserva es la primera cuota.`;
      cuerpo = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cuotas.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ flex: 'none', width: 70, fontSize: 13, fontWeight: 600, color: 'var(--dim)', textAlign: 'left' }}>Cuota {i + 1}</span>
              <input inputMode="numeric" value={c.monto} onChange={(e) => setCuotas((arr) => arr.map((x, xi) => (xi === i ? { ...x, monto: e.target.value } : x)))} placeholder={i === 0 ? 'Monto primera cuota' : 'Monto'} style={{ ...compInput, flex: 1, textAlign: 'left' }} />
              <input type="date" value={c.fecha} onChange={(e) => setCuotas((arr) => arr.map((x, xi) => (xi === i ? { ...x, fecha: e.target.value } : x)))} style={{ ...compInput, flex: 'none', width: 160, textAlign: 'left' }} />
              {i > 0 && <button type="button" onClick={() => setCuotas((arr) => arr.filter((_, xi) => xi !== i))} aria-label="Quitar cuota" style={{ flex: 'none', background: 'transparent', border: 'none', color: 'var(--faint)', cursor: 'pointer', fontSize: 15 }}>✕</button>}
            </div>
          ))}
          <button type="button" onClick={() => { const last = cuotas[cuotas.length - 1]; const d = last?.fecha ? new Date(last.fecha + 'T00:00:00Z') : new Date(); d.setUTCMonth(d.getUTCMonth() + 1); setCuotas((arr) => [...arr, { monto: '', fecha: d.toISOString().slice(0, 10) }]); }} style={{ padding: 10, borderRadius: 10, border: '1.5px dashed var(--border-strong)', background: 'transparent', color: 'var(--primary)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>+ Agregar cuota</button>
          {sumaCuotas > 0 && (
            <div style={{ borderRadius: 10, padding: '9px 13px', fontSize: 13, fontWeight: 600, background: cuotasCuadran ? 'var(--good-bg)' : 'var(--bad-bg)', color: cuotasCuadran ? 'var(--good)' : 'var(--bad)', textAlign: 'left' }}>
              {cuotasCuadran
                ? `Cuadra: las cuotas suman $${sumaCuotas.toLocaleString('en-US')}.`
                : `Las cuotas suman $${sumaCuotas.toLocaleString('en-US')} y ${sumaCuotas > totalMonto ? 'exceden' : 'no alcanzan'} el cierre de $${totalMonto.toLocaleString('en-US')}.`}
            </div>
          )}
        </div>
      );
      break;
    case 'resumen': {
      const filas: Array<[string, string]> = [];
      if (huboR1 === false) filas.push(['Sin R1', motivoNoR1]);
      else {
        if (pide('fechaJ1')) filas.push(['Fecha R1', fechaJ1 || '—']);
        if (pide('asistenciaR1')) filas.push(['Asistió R1', asistioJ1 ? 'Sí' : 'No']);
        if (pide('calificado')) filas.push(['Calificado', calificado ? 'Sí' : 'No']);
      }
      if (huboR1 !== false) {
        if (huboR2 === false) filas.push(['Sin R2', motivoNoR2]);
        else {
          if (pide('fechaJ2')) filas.push(['Fecha R2', fechaJ2 || '—']);
          if (pide('asistenciaR2')) filas.push(['Asistió R2', asistioJ2 ? 'Sí' : 'No']);
        }
      }
      if (pide('fathomR1') || pide('fathomR2')) filas.push(['Fathom', fathomOmitido ? 'Sin grabación' : `${fathom.filter((f) => f.url.trim()).length} link(s)`]);
      if (pide('monto')) filas.push(['Monto de cierre', totalMonto ? `$${totalMonto.toLocaleString('en-US')}` : '—']);
      if (pide('plan')) filas.push(['Cuotas', `${cuotas.filter((c) => parseFloat(c.monto) > 0).length} (suman $${sumaCuotas.toLocaleString('en-US')})`]);
      if (pide('motivo')) filas.push([esDescal ? 'Motivo de descalificación' : 'Motivo de pérdida', motivoFinal || '—']);
      if (pide('setter')) filas.push(['Setter', setter.trim() || '—']);
      if (pide('closer')) filas.push(['Closer', closer.trim() || '—']);
      if (pide('empresa')) filas.push(['Empresa', empresa.trim() || '—']);
      if (pide('telefono')) filas.push(['Teléfono', telefono.trim() || '—']);
      pregunta = filas.length ? 'Revisá y confirmá' : 'Confirmá el movimiento';
      cuerpo = filas.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {filas.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13.5, padding: '9px 13px', background: 'var(--surface-2)', borderRadius: 10, textAlign: 'left' }}>
              <span style={{ color: 'var(--dim)' }}>{k}</span><span style={{ color: 'var(--ink)', fontWeight: 600, maxWidth: '65%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
            </div>
          ))}
        </div>
      ) : <p style={{ fontSize: 14, color: 'var(--dim)' }}>No falta ningún dato: el lead pasa a {label}.</p>;
      break;
    }
  }

  const enResumen = paso === 'resumen';
  // Mientras MaKo lee el contrato / busca en Calendly, se bloquea todo (no avanzar,
  // no volver, no cerrar) y se muestra un loader que tapa el pop-up.
  const busy = dealBusy || autoBusy;

  // Paso final tras guardar (P8): ver detalle o salir. No re-cierra solo.
  if (guardado) {
    return (
      <div onClick={onDone} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={{ width: '100%', maxWidth: 460, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(18,21,27,.35)', padding: '30px clamp(20px,6vw,40px)', textAlign: 'center' }}>
          <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: '.14em', color: 'var(--accent)', marginBottom: 14 }}>✦ MAKO</div>
          <div aria-hidden style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--good-bg)', color: 'var(--good)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, marginBottom: 12 }}>✓</div>
          <h3 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 6px', fontFamily: SANS }}>Datos actualizados</h3>
          <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: '0 0 20px' }}>Guardamos todo lo que cargaste para {lead.name}.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {onVerDetalle && <button type="button" onClick={onVerDetalle} style={{ padding: '12px 24px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>Ver detalle →</button>}
            <button type="button" onClick={onDone} style={{ padding: '12px 24px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 14.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>{onVerDetalle ? '← Salir' : 'Listo'}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div onClick={busy ? undefined : onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={{ position: 'relative', width: '100%', maxWidth: 640, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' }}>

        {/* Loader que BLOQUEA todo mientras lee el contrato / busca reuniones */}
        {busy && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(255,255,255,.78)', backdropFilter: 'blur(1.5px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <span aria-hidden style={{ width: 34, height: 34, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', boxSizing: 'border-box', animation: 'spin .7s linear infinite' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', fontFamily: SANS }}>{dealBusy ? 'Leyendo el contrato…' : 'Buscando en Calendly y Fathom…'}</span>
          </div>
        )}

        {/* Header: logo · dots de progreso · cerrar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 20px' }}>
          <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: '.14em', color: 'var(--accent)' }}>✦ MAKO</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {pasos.map((p, i) => (
              <span key={p + i} style={{ width: i === idx ? 22 : 8, height: 8, borderRadius: 999, background: i === idx ? 'var(--primary)' : i < idx ? 'var(--primary-weak, #B9CDF8)' : 'var(--border)', transition: 'width .2s' }} />
            ))}
          </div>
          <button onClick={busy ? undefined : onClose} aria-label="Cerrar" disabled={busy} style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.4 : 1, fontSize: 14, fontFamily: SANS }}>✕</button>
        </div>

        {/* Cuerpo centrado: una pregunta por paso */}
        <div style={{ padding: '26px clamp(20px,6vw,56px) 30px', textAlign: 'center' }}>
          <div style={{ fontSize: 12.5, color: 'var(--faint)', fontFamily: MONO, marginBottom: 8 }}>{titulo ?? `Mover a ${label}`} · {lead.name}</div>
          <h3 style={{ fontSize: 'clamp(20px,4vw,26px)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 6px', fontFamily: SANS }}>{pregunta}</h3>
          {sub && <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: '0 0 18px' }}>{sub}</p>}
          {!sub && <div style={{ height: 12 }} />}
          <div style={{ maxWidth: 520, margin: '0 auto' }}>{cuerpo}</div>
          {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 12 }}>{err}</div>}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <button onClick={atras} disabled={busy} style={{ padding: '11px 20px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1, fontFamily: SANS }}>← {visitados.length === 0 ? 'Cancelar' : 'Atrás'}</button>
          {enResumen ? (
            <button onClick={confirmar} disabled={pending || busy} style={{ padding: '12px 26px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS, opacity: pending || busy ? 0.6 : 1 }}>{pending ? 'Guardando…' : 'Confirmar y mover'}</button>
          ) : (
            <button onClick={avanzar} disabled={!respondido || busy} style={{ padding: '12px 26px', borderRadius: 11, border: 'none', background: respondido && !busy ? 'var(--primary)' : 'var(--border)', color: respondido && !busy ? '#fff' : 'var(--faint)', fontSize: 14.5, fontWeight: 700, cursor: respondido && !busy ? 'pointer' : 'default', fontFamily: SANS }}>Siguiente →</button>
          )}
        </div>
      </div>
    </div>
  );
}
