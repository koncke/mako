'use client';

// =============================================================================
// LeadDetailBody — cuerpo del detalle del lead: tabs + mover de etapa + edición
// =============================================================================
// La etapa se cambia SIN entrar a editar: "Mover a…" en la barra de tabs abre
// el mismo wizard progresivo del Kanban. "Editar" es un botón (no una tab): el
// modo edición usa las mismas tabs con sus campos editables, y al guardar
// (confirmado) o cancelar se vuelve a la tab donde estaba el usuario.
// "Volver" usa el historial del navegador (regresa al contexto exacto).

import { useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { reactivarPendientesAction } from '../actions';
import { deriveStageKey, CHIP, type Stage } from '@/lib/pipeline';
import type { Lead, FathomLink } from '@/lib/leads';
import { hayPasoDeWizard, type Step } from '@/lib/stage-requirements';
import type { Pago } from '@/lib/pagos';
import type { MiembroEquipo } from '../actions';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import { EditLeadForm } from './EditLeadForm';
import { LeadTabs, type LeadTabDef } from '../lead-view/LeadTabs';
import { DatosSinMarcarCard } from '../lead-view/DatosSinMarcarCard';
import { StageMoveDialog, type MoveLeadInfo } from '../StageMoveDialog';
import { Dropdown } from '@/app/components/Dropdown';

const SANS = "'Geist', sans-serif";

// Mapea la tab de LECTURA a la de EDICIÓN (solo 3 son editables); el resto abre
// en Overview. Así "Editar" respeta dónde estaba el usuario si esa tab se edita.
const TAB_EDITABLE: Record<string, string> = { resumen: 'resumen', reuniones: 'reuniones', cobranza: 'cobranza' };

function IconPencil() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>;
}

export function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        // Si venís de un deep-link de acción (?solucionar / ?edit), router.back()
        // puede re-caer en la MISMA URL con el param (y "no volver a ningún lado"):
        // en ese caso vamos derecho al tablero. Si no, historial normal.
        const params = new URLSearchParams(window.location.search);
        if (params.has('solucionar') || params.has('edit')) { router.push('/crm'); return; }
        if (window.history.length > 1) router.back(); else router.push('/crm');
      }}
      style={{ fontSize: 14, color: 'var(--dim)', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: SANS }}
    >← Volver</button>
  );
}

export function LeadDetailBody({ lead, stages, pagos, initialTab, initialEdit, initialSolucionar, tabs, nombre, empresa, createdISO, stageLabel, chipTone, faltantes = [], equipo = [] }: {
  lead: Lead;
  stages: Stage[];
  pagos: Pago[];
  initialTab?: string;
  initialEdit?: boolean;
  /** ?solucionar=1: abrir directo el asistente (o la edición si solo faltan datos estáticos). */
  initialSolucionar?: boolean;
  /** Tabs de LECTURA (contenido server-rendered). */
  tabs: LeadTabDef[];
  // Datos del header (antes vivían en page.tsx; ahora acá para que "Editar"
  // conviva con las tabs y respete la tab actual).
  nombre: string;
  empresa: string | null;
  createdISO: string;
  stageLabel: string;
  chipTone: keyof typeof CHIP;
  /** Datos sin marcar de la etapa actual (badge + Solucionar). */
  faltantes?: Step[];
  /** Equipo del workspace (para los desplegables de setter/closer del wizard). */
  equipo?: MiembroEquipo[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const currentStage = lead.pipeline_stage && stages.some((s) => s.key === lead.pipeline_stage) ? lead.pipeline_stage : deriveStageKey(lead);
  // Si solo faltan datos estáticos (tel/empresa/detalle del cierre), no hay
  // asistente: se completan en Editar. Con algún dato de reunión/venta → wizard.
  const soloEdit = faltantes.length > 0 && !hayPasoDeWizard(faltantes);
  const [editing, setEditing] = useState(!!initialEdit || (!!initialSolucionar && soloEdit));
  const [tab, setTab] = useState(initialTab && tabs.some((t) => t.key === initialTab) ? initialTab : tabs[0]?.key ?? 'resumen');
  const [moveTo, setMoveTo] = useState<string | null>(initialSolucionar && !soloEdit && faltantes.length > 0 ? currentStage : null);
  // Si una navegación pone ?edit=1 (ej. la alarma "Editar y completar" del deal),
  // abrir el modo edición. Patrón prev-prop: reacciona al cambio del prop.
  const [prevInitEdit, setPrevInitEdit] = useState(!!initialEdit);
  if (!!initialEdit !== prevInitEdit) { setPrevInitEdit(!!initialEdit); if (initialEdit) setEditing(true); }
  const salirEdicion = () => { setEditing(false); if (initialEdit || initialSolucionar) router.replace(pathname); };
  const chip = CHIP[chipTone] || CHIP.neutral;

  const moveInfo: MoveLeadInfo = {
    id: lead.id,
    name: lead.nombre,
    fechaJ1: lead.fecha_junta_1,
    fechaJ2: lead.fecha_junta_2,
    asistioJ1: lead.asistio_j1,
    asistioJ2: lead.asistio_j2,
    calificado: lead.calificado,
    fathom: (lead.fathom_links ?? []) as FathomLink[],
    monto: lead.monto_cierre_usd ?? null,
    motivo: lead.motivo_perdida,
    setter: lead.setter ?? null,
    closer: lead.closer ?? null,
    empresa: lead.empresa ?? null,
    telefono: lead.telefono ?? null,
    tienePlan: pagos.length > 0,
    sinR1: !!lead.sin_r1,
    sinR2: !!lead.sin_r2,
    fathomOmitido: !!lead.fathom_omitido,
    email: lead.email ?? null,
    tieneContrato: !!lead.contrato_path,
    dealServicioOk: !!lead.deal_servicio?.que_es?.trim(),
    dealPromesaOk: !!lead.deal_promesa?.resultado?.trim(),
    dealFiscalOk: !!lead.deal_fiscal?.razon?.trim(),
    dealObligacionesOk: (lead.deal_obligaciones?.cliente?.length ?? 0) > 0 || (lead.deal_obligaciones?.prestador?.length ?? 0) > 0,
  };

  // Solucionar (pasada única): SIEMPRE abre el wizard con TODO lo faltante
  // (reuniones + venta + higiene + Deal Details + documentos + respuestas R2).
  // Ya no deriva a ninguna tab ni queda mudo.
  const solucionar = () => { setMoveTo(currentStage); };

  // Avisos ignorados a mano (mig 0109): el aviso se muestra en tono suave y con
  // opción de reactivar (vuelve a notificar en el worklist del CRM general).
  const ignorado = !!lead.pendientes_ignorados;
  const [, startReactivar] = useTransition();
  const reactivar = () => { startReactivar(async () => { try { await reactivarPendientesAction(lead.id); router.refresh(); } catch { /* noop */ } }); };

  const editarBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS };

  // Selector de etapa: muestra la ETAPA ACTUAL; elegir otra abre el wizard.
  // Dos columnas lado a lado (Pipeline + Salida | Nutrición) para verlo entero
  // sin scroll.
  const deBanda = (band: 'pipeline' | 'nutricion' | 'salidas') =>
    stages
      .filter((s) => (s.band ?? 'pipeline') === band)
      .sort((a, b) => (a.col ?? 0) - (b.col ?? 0))
      .map((s) => ({ value: s.key, label: s.label, color: s.dot }));
  const stageSelector: ReactNode = (
    <Dropdown
      value={currentStage}
      align="right"
      width={250}
      ariaLabel="Etapa del lead (elegí otra para mover)"
      onChange={(key) => { if (key && key !== currentStage) setMoveTo(key); }}
      columns={[
        [{ title: 'Pipeline', options: deBanda('pipeline') }, { title: 'Salida', options: deBanda('salidas') }],
        [{ title: 'Nutrición', options: deBanda('nutricion') }],
      ]}
    />
  );

  // El dropdown de etapa queda inline con las tabs (acciones); "Editar" vive en
  // el header (arriba a la derecha, donde antes estaba la Cohorte).
  const header: ReactNode = (
    <div style={{ marginTop: 14, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 9 }}>
          <span style={{ display: 'inline-block', fontSize: 13, fontWeight: 600, padding: '5px 12px', borderRadius: 999, background: chip.bg, color: chip.fg, border: '1px solid ' + chip.bd }}>{stageLabel}</span>
          {/* Indicador rojo a la altura del nombre; el botón Solucionar vive en el
              cuadro "Datos sin marcar" (abajo, en todas las tabs). */}
          {faltantes.length > 0 && (
            ignorado
              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, padding: '5px 11px', borderRadius: 999, background: 'var(--warn-bg)', color: 'var(--warn)', border: '1px solid #E7D6A6' }}>
                  <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--warn)' }} />
                  {faltantes.length} dato{faltantes.length === 1 ? '' : 's'} sin marcar · ignorado
                </span>
              : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, padding: '5px 11px', borderRadius: 999, background: 'var(--bad-bg)', color: 'var(--bad)', border: '1px solid #EBBFBC' }}>
                  <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--bad)', animation: 'blinkRed 1.4s infinite' }} />
                  {faltantes.length} dato{faltantes.length === 1 ? '' : 's'} sin marcar
                </span>
          )}
        </div>
        <h1 style={{ fontSize: 'clamp(28px,6vw,42px)', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.05, margin: 0 }}>{nombre}</h1>
        <p style={{ marginTop: 6, fontSize: 14, color: 'var(--dim)' }}>{empresa ?? 'Sin empresa'} · Lead #{lead.id} · creado {fmtDDMMYYYY(createdISO)}</p>
      </div>
      {/* Dropdown de etapa + Editar, juntos arriba a la derecha. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {stageSelector}
        {!editing && <button type="button" onClick={() => setEditing(true)} style={editarBtn}><IconPencil /> Editar</button>}
      </div>
    </div>
  );

  return (
    <div>
      {header}
      {/* Datos sin marcar: ARRIBA de las tabs → visible en TODAS (solo en lectura;
          en edición el EditLeadForm muestra su propio banner). */}
      {!editing && faltantes.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <DatosSinMarcarCard faltantes={faltantes} onSolucionar={solucionar} nota="Completá estos datos para tener la ficha al día." ignorado={ignorado} onReactivar={reactivar} />
        </div>
      )}
      {editing ? (
        <EditLeadForm
          lead={lead}
          stages={stages}
          pagos={pagos}
          initialTab={TAB_EDITABLE[tab] ?? 'resumen'}
          faltantes={faltantes}
          equipo={equipo}
          onDone={() => { salirEdicion(); router.refresh(); }}
          onCancel={salirEdicion}
        />
      ) : (
        <LeadTabs initial={tab} onChange={setTab} tabs={tabs} />
      )}

      {moveTo && (
        <StageMoveDialog
          lead={moveInfo}
          stages={stages}
          move={{ to: moveTo }}
          titulo={moveTo === currentStage ? 'Completar datos' : undefined}
          completarDatos={moveTo === currentStage}
          faltantes={moveTo === currentStage ? faltantes : undefined}
          equipo={equipo}
          onClose={() => { setMoveTo(null); if (initialSolucionar) router.replace(pathname); }}
          onDone={() => { setMoveTo(null); if (initialSolucionar) router.replace(pathname); router.refresh(); }}
        />
      )}
    </div>
  );
}
