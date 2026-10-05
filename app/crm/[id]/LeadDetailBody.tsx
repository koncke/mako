'use client';

// =============================================================================
// LeadDetailBody — cuerpo del detalle del lead: tabs + mover de etapa
// =============================================================================
// ⚠️ YA NO HAY BOTÓN «EDITAR» (05/10/2026, pedido DOS veces): cada dato del lead se
// corrige donde se lee, con un click sobre el valor (ver `app/crm/campo-inline.ts`).
// El lápiz que vivía arriba a la derecha se fue con el formulario que abría.
//
// Lo que sí queda en una pantalla aparte es el DEAL —`?edit=1` monta `EditarDeal`—
// porque su guardado es transaccional y no se puede partir en campos; se llega desde
// donde el deal se lee (tab Pagos).
//
// La etapa se cambia con el desplegable del header, que abre el mismo wizard
// progresivo del Kanban. "Volver" usa el historial del navegador.

import { useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useRouter } from '@/app/_ui/Link';
import { reactivarPendientesAction, deleteLeadAction } from '../actions';
import { ConfirmDialog } from '@/app/components/ConfirmDialog';
import { deriveStageKey, stageMetaOpt, CHIP, type Stage } from '@/lib/pipeline';
import type { Lead, FathomLink } from '@/lib/leads';
import type { Step } from '@/lib/stage-requirements';
import type { Pago } from '@/lib/pagos';
import type { MiembroEquipo } from '../actions';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import { EditarDeal } from './EditarDeal';
import { LeadTabs, type LeadTabDef } from '../lead-view/LeadTabs';
import { ProductoDelLead, type ProductoOpcion } from '../lead-view/ProductoDelLead';
import { DatosSinMarcarCard } from '../lead-view/DatosSinMarcarCard';
import { StageMoveDialog, type MoveLeadInfo } from '../StageMoveDialog';
import { MoverEtapaConfirm } from '../MoverEtapaConfirm';
import { pideWizardAlElegir } from '../mover-etapa';
import { Dropdown } from '@/app/components/Dropdown';

const SANS = "'Geist', sans-serif";

// ⚠️ ACÁ ESTABA `TAB_EDITABLE`, el mapa de la tab de lectura a la de edición, y el
// `IconPencil` del botón «Editar». Los dos se fueron con el formulario: ya no hay
// dos juegos de tabs que mantener en paridad —era la trampa de «las TRES fichas»,
// que mordió tres veces— porque la ficha es una sola y es la editable.

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

export function LeadDetailBody({ lead, stages, pagos, initialTab, initialEdit, initialSolucionar, tabs, nombre, empresa, createdISO, stageLabel, chipTone, faltantes = [], equipo = [], productos = [] }: {
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
  /**
   * Los productos del workspace, para el desplegable de «en cuál vive este lead».
   *
   * Pedido de Martín: «Dentro del detail de un lead debería salir el mismo desplegable
   * de productos». Con uno solo no se dibuja: un desplegable de una opción promete una
   * decisión que no existe.
   */
  productos?: ProductoOpcion[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const currentStage = lead.pipeline_stage && stages.some((s) => s.key === lead.pipeline_stage) ? lead.pipeline_stage : deriveStageKey(lead);
  // ⚠️ «SOLUCIONAR» SIEMPRE ABRE EL WIZARD, igual que en el modal. Antes, cuando lo
  // único faltante eran datos estáticos (teléfono, empresa, el detalle del cierre), se
  // derivaba al formulario de edición — que ya no existe. El wizard es el ÚNICO que
  // marca los datos del worklist (`completeStageMoveAction`), así que no hay una
  // segunda escritura que reemplazar: lo que se saca es la bifurcación.
  const [editandoDeal, setEditandoDeal] = useState(!!initialEdit);
  const [tab, setTab] = useState(initialTab && tabs.some((t) => t.key === initialTab) ? initialTab : tabs[0]?.key ?? 'resumen');
  const [moveTo, setMoveTo] = useState<string | null>(initialSolucionar && faltantes.length > 0 ? currentStage : null);
  const [moverDirecto, setMoverDirecto] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [delErr, setDelErr] = useState<string | null>(null);
  const [borrando, startBorrar] = useTransition();
  // Si una navegación pone ?edit=1 (el «Editar deal →» de la tab Pagos o el «Completar
  // con IA» del propio DealDetailsCard), abrir el editor del deal. Patrón prev-prop:
  // reacciona al cambio del prop.
  const [prevInitEdit, setPrevInitEdit] = useState(!!initialEdit);
  if (!!initialEdit !== prevInitEdit) { setPrevInitEdit(!!initialEdit); if (initialEdit) setEditandoDeal(true); }
  const salirEdicion = () => { setEditandoDeal(false); if (initialEdit || initialSolucionar) router.replace(pathname); };
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

  const borrar = () => {
    setConfirmDelete(false);
    startBorrar(async () => {
      // `deleteLeadAction` redirige al tablero: acá la ficha ES la pantalla, así que
      // quedarse mirando un lead borrado no es una opción. (El modal usa la versión
      // que no redirige, porque ahí la pantalla de atrás sigue viva.)
      try { await deleteLeadAction(lead.id); }
      catch (e) { setDelErr(e instanceof Error ? e.message : 'No se pudo borrar. Reintenta.'); }
    });
  };

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
      ariaLabel="Etapa del lead (elige otra para mover)"
      // Elegir otra etapa MUEVE (08-T22), como soltar una card en el tablero: las
      // etapas de reunión y la nutrición manual sí abren el wizard (ver
      // pideWizardAlElegir). Antes toda etapa abría el wizard con sus preguntas.
      onChange={(key) => {
        if (!key || key === currentStage) return;
        if (pideWizardAlElegir(stages, key)) setMoveTo(key); else setMoverDirecto(key);
      }}
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
          {/* ⚠️ ACÁ ESTABA EL CHIP «N datos sin marcar», con su punto ROJO parpadeando
              (`blinkRed 1.4s infinite`). Se fue el 27/09/2026 porque era la primera de
              CUATRO apariciones del MISMO aviso en la misma pantalla: el chip acá, la
              fila de abajo, la tarjeta roja del formulario de edición y la enumeración
              de la tarjeta de Análisis. Es la fila «el mismo aviso 3 veces» del plan de
              fricción, que estaba marcada como aplicada y nunca se había ubicado.

              El aviso no se pierde: queda el de abajo, que es UNO y sirve para las dos
              cosas que el chip no hacía — decir QUÉ falta y llevar a completarlo. */}        </div>
        <h1 style={{ fontSize: 'clamp(28px,6vw,42px)', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.05, margin: 0 }}>{nombre}</h1>
        <p style={{ marginTop: 6, fontSize: 14, color: 'var(--dim)' }}>{empresa ?? 'Sin empresa'} · Lead #{lead.id} · creado {fmtDDMMYYYY(createdISO)}</p>
      </div>
      {/* Dropdown de etapa + Editar, juntos arriba a la derecha. */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {/* El producto va ANTES de la etapa: la etapa es una posición DENTRO de un
              embudo, así que leer «Mentoría · Agenda R1» en ese orden es leer la frase
              completa. Al revés, la etapa cuelga de un embudo que todavía no se nombró. */}
          <ProductoDelLead leadId={lead.id} funnelId={lead.funnel_id ?? null} productos={productos} />
          {stageSelector}
          {/* ⚠️ ACÁ ESTABA EL BOTÓN «✎ Editar», y se fue el 05/10/2026 (pedido DOS veces).
              No se cambió por un lápiz: los 15 campos que ese formulario editaba se editan
              en la ficha, cada uno donde se lee. Lo único que sigue teniendo pantalla propia
              es el DEAL, y su entrada está en la tab Pagos, al lado del deal. */}
        </div>
        {/* ⚠️ DEBAJO DEL DESPLEGABLE DE ETAPA, no en su propia franja. Ocupaba un renglón
            de ancho completo arriba de las tabs para decir un número — y era el renglón
            que empujaba las pestañas y el contenido hacia abajo en TODOS los leads con
            algo sin marcar (el 98%).
        
            Acá arriba comparte la columna con la etapa, que es la otra cosa que se
            decide de un lead sin bajar: «está en Ganado y le faltan 6 datos» se lee de
            un vistazo, en el lugar donde ya se estaba mirando. Y no cuesta alto: entra
            en el hueco que el bloque del nombre ya dejaba libre a la derecha. */}
        {faltantes.length > 0 && (
          <DatosSinMarcarCard faltantes={faltantes} onSolucionar={solucionar} ignorado={ignorado} onReactivar={reactivar} />
        )}
      </div>
    </div>
  );

  return (
    <div>
      {header}
      {editandoDeal ? (
        <EditarDeal
          lead={lead}
          stages={stages}
          pagos={pagos}
          onDone={() => { salirEdicion(); router.refresh(); }}
          onCancel={salirEdicion}
        />
      ) : (
        <>
          <LeadTabs initial={tab} onChange={setTab} tabs={tabs} />
          {/* ⚠️ BORRAR LEAD NO SE FUE CON EL BOTÓN DE EDITAR. Vivía al pie del formulario,
              que era el único lugar de ESTA ruta donde se podía borrar (el modal tiene el
              suyo). Es irreversible, así que queda discreto al fondo y con su confirmación
              nombrando la consecuencia, pegada al botón. */}
          {delErr && <div style={{ marginTop: 14, color: 'var(--bad)', fontSize: 13, fontWeight: 600, fontFamily: SANS }}>{delErr}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 18 }}>
            <button type="button" onClick={() => setConfirmDelete(true)} disabled={borrando} style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid var(--bad)', background: 'transparent', color: 'var(--bad)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS, opacity: borrando ? 0.5 : 1 }}>Borrar lead</button>
          </div>
        </>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Borrar lead"
          message={<>Vas a borrar definitivamente a <b style={{ color: 'var(--ink)' }}>{nombre}</b> y todo su historial. <b style={{ color: 'var(--bad)' }}>No se puede deshacer.</b></>}
          confirmLabel="Borrar definitivamente"
          onConfirm={borrar}
          onCancel={() => setConfirmDelete(false)}
          zIndex={130}
        />
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

      {moverDirecto && (
        <MoverEtapaConfirm
          lead={{ id: lead.id, nombre: lead.nombre, fechaJ1: lead.fecha_junta_1, asistioJ1: lead.asistio_j1, calificado: lead.calificado }}
          desde={stageLabel}
          destino={{ key: moverDirecto, label: stageMetaOpt(stages, moverDirecto)?.label ?? moverDirecto }}
          onCancel={() => setMoverDirecto(null)}
          onHecho={() => { setMoverDirecto(null); router.refresh(); }}
          // «Completar ahora»: el lead YA está en la etapa nueva; el wizard abre a
          // completar sobre ella (en cuanto el refresh traiga la etapa, cuenta como
          // «Completar datos»; antes, como un movimiento a la misma etapa: igual sirve).
          onCompletar={() => { const k = moverDirecto; setMoverDirecto(null); router.refresh(); setMoveTo(k); }}
        />
      )}
    </div>
  );
}
