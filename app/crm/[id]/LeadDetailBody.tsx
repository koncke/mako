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
// progresivo del Kanban. ⚠️ Es la etapa del producto EN VISTA (06/10/2026, mig 0207): si se
// mira un producto donde el lead está AGREGADO, el desplegable es el de ese tablero y mover
// escribe sólo su fila, sin wizard (ver lead-view/ProductoDelLead.tsx). "Volver" usa el
// historial del navegador.
//
// ⚠️ DESDE EL 12/10/2026 LA CABECERA ES `CabeceraLead` (lead-view/CabeceraLead.tsx), la MISMA pieza
// que la del pop-up del tablero: portada con la cara (punto 11), nombre editable con un clic,
// etiquetas arriba del nombre (punto 9) y UN desplegable en árbol —funnel › etapa— encima de «N sin
// marcar» (punto 9). Era la tercera vez que esta ruta se quedaba con la versión anterior de algo que
// cambió en el pop-up; con una sola pieza, no puede.

import { useState, useTransition, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useRouter } from '@/app/_ui/Link';
import { deleteLeadAction } from '../actions';
import { ConfirmDialog } from '@/app/components/ConfirmDialog';
import { deriveStageKey, stageMetaOpt, type Stage } from '@/lib/pipeline';
import type { FathomLink } from '@/lib/leads';
import { suscripcionDeFila } from '@/lib/venta-tipo';
import type { Step } from '@/lib/stage-requirements';
import type { Pago } from '@/lib/pagos';
import type { MiembroEquipo } from '../actions';
import { EditarDeal } from './EditarDeal';
import { LeadTabs, type LeadTabDef } from '../lead-view/LeadTabs';
import { FunnelYEtapa, useProductosDeLaFicha, type ProductoOpcion } from '../lead-view/ProductoDelLead';
import { DatosSinMarcarCard } from '../lead-view/DatosSinMarcarCard';
import { CabeceraLead, type LeadConCara } from '../lead-view/CabeceraLead';
import { EtiquetasDelLead, versionDeEtiquetas } from '../lead-view/EtiquetasDelLead';
import { StageMoveDialog, type MoveLeadInfo } from '../StageMoveDialog';
import { MoverEtapaConfirm } from '../MoverEtapaConfirm';
import { pideWizardAlElegir } from '../mover-etapa';
import { BotonBorrar } from '@/app/_ui/BotonBorrar';

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

export function LeadDetailBody({ lead, stages, pagos, initialTab, initialEdit, initialSolucionar, tabs, nombre, stageLabel, faltantes = [], equipo = [], productos = [], fotoEmail = null }: {
  /** Con las columnas de la cara (portada, encuadres): la cabecera las dibuja y las cambia. */
  lead: LeadConCara;
  stages: Stage[];
  pagos: Pago[];
  /** La foto del email (Gravatar, `d=404`), armada en el server. Ver lead-view/CaraDelLead.tsx. */
  fotoEmail?: string | null;
  initialTab?: string;
  initialEdit?: boolean;
  /** ?solucionar=1: abrir directo el asistente (o la edición si solo faltan datos estáticos). */
  initialSolucionar?: boolean;
  /** Tabs de LECTURA (contenido server-rendered). */
  tabs: LeadTabDef[];
  // El nombre (para la confirmación de borrar) y el de la etapa (para «Mover de… a…»). La
  // empresa, el alta y el color salen del `lead`, adentro de la cabecera.
  nombre: string;
  stageLabel: string;
  /** Datos sin marcar de la etapa actual (badge + Solucionar). */
  faltantes?: Step[];
  /** Equipo del workspace (para los desplegables de setter/closer del wizard). */
  equipo?: MiembroEquipo[];
  /**
   * Los productos del workspace, para el desplegable de «en cuáles está este lead».
   *
   * Pedido de Martín: «Dentro del detail de un lead debería salir el mismo desplegable
   * de productos». Con uno solo no se dibuja: un desplegable de una opción promete una
   * decisión que no existe.
   *
   * Es la FOTO con la que el botón se dibuja al toque: en cuáles está y con qué etapa lo
   * trae la ficha misma (`productosDeLaFichaAction`), que es lo único que lo sabe.
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
  // En qué productos está y cuál se mira. Acá no hace falta releer nada si cambia la casa: el
  // `router.refresh()` que hace la ficha después de cada cambio le trae el lead de nuevo.
  const fichaProd = useProductosDeLaFicha({ leadId: lead.id, casa: lead.funnel_id, foto: productos });

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
    // El tipo de venta guardado: sin esto el wizard abre en «Pago único» y a un becado
    // (#747) le vuelve a pedir el monto.
    ventaTipo: lead.venta_tipo ?? null,
    // La mensualidad y el plazo de una suscripción: sin ellos reabrirla pedía el monto
    // vacío, y guardar escribía NULL encima (lib/venta-tipo.ts).
    ...suscripcionDeFila(lead),
  };

  // Solucionar (pasada única): SIEMPRE abre el wizard con TODO lo faltante
  // (reuniones + venta + higiene + Deal Details + documentos + respuestas R2).
  // Ya no deriva a ninguna tab ni queda mudo.
  const solucionar = () => { setMoveTo(currentStage); };


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

  // Elegir otra etapa de la CASA mueve (08-T22), como soltar una card en el tablero: las etapas de
  // reunión y la nutrición manual sí abren el wizard (ver pideWizardAlElegir). Antes toda etapa
  // abría el wizard con sus preguntas. Las etapas de un funnel AGREGADO las mueve el desplegable
  // solo (lead-view/ProductoDelLead.tsx), sin wizard.
  const pickStage = (key: string) => {
    if (!key || key === currentStage) return;
    if (pideWizardAlElegir(stages, key)) setMoveTo(key); else setMoverDirecto(key);
  };

  // ⚠️ LA CABECERA ES LA DEL POP-UP (lead-view/CabeceraLead.tsx), en su caja (`marco`): acá atrás
  // está el fondo de la página. Las etiquetas van ARRIBA del nombre y, a la derecha, el desplegable
  // del funnel ENCIMA del aviso de datos sin marcar (punto 9, 12/10/2026). Se va con el scroll: en
  // esta ruta —que se abre desde el link de un WhatsApp, o sea muchas veces en un teléfono— una
  // portada fija se comería media pantalla. Lo que queda pegado arriba es la fila de pestañas.
  //
  // ⚠️ EL AVISO DE DATOS SIN MARCAR VA ACÁ, debajo del desplegable, no en su propia franja. Ocupaba
  // un renglón de ancho completo arriba de las tabs para decir un número — y era el renglón que
  // empujaba las pestañas hacia abajo en TODOS los leads con algo sin marcar (el 98%).
  const header: ReactNode = (
    <div style={{ marginTop: 14, marginBottom: 20 }}>
      <CabeceraLead
        lead={lead}
        fotoEmail={fotoEmail}
        marco
        kicker={<EtiquetasDelLead leadId={lead.id} version={versionDeEtiquetas(lead.updated_at, fichaProd.productos)} />}
        acciones={
          <>
            <FunnelYEtapa ficha={fichaProd} etapasCasa={stages} etapaCasa={currentStage} onElegirCasa={pickStage} ariaLabel="Cambiar etapa o funnel" />
            {faltantes.length > 0 && (
              <DatosSinMarcarCard faltantes={faltantes} onSolucionar={solucionar} />
            )}
          </>
        }
      />
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
          {/* La fila de pestañas queda pegada arriba al scrollear la página (punto 16). */}
          <LeadTabs initial={tab} onChange={setTab} tabs={tabs} fija={{ fondo: 'var(--bg)' }} />
          {/* ⚠️ BORRAR LEAD NO SE FUE CON EL BOTÓN DE EDITAR. Vivía al pie del formulario,
              que era el único lugar de ESTA ruta donde se podía borrar (el modal tiene el
              suyo). Es irreversible, así que queda al fondo y con su confirmación
              nombrando la consecuencia, pegada al botón. Desde el 12/10/2026 es el tacho rojo
              de la casa, igual que en el pop-up (punto 12). */}
          {delErr && <div style={{ marginTop: 14, color: 'var(--bad)', fontSize: 13, fontWeight: 600, fontFamily: SANS }}>{delErr}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 18 }}>
            <BotonBorrar texto="Borrar lead" title={`Borrar a ${nombre || 'este lead'}`} onClick={() => setConfirmDelete(true)} disabled={borrando} />
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
