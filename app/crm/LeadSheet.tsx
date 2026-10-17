'use client';

// =============================================================================
// LeadSheet — ficha del lead en modal, organizada en tabs
// =============================================================================
// ⚠️ YA NO ES UN PREVIEW DE SOLO LECTURA, y por eso no tiene botón de editar: cada
// dato se corrige donde se lee (ver `app/crm/campo-inline.ts`). El «Editar lead →»
// que vivía en el pie se fue el 05/10/2026. Lo que todavía tiene pantalla aparte es
// el DEAL, con su entrada en la tab Pagos. Los movimientos del Kanban que exigen
// datos usan su propio pop-up chico (StageMoveDialog), no esta ficha.

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { deriveStageKey, stageMeta, type Stage } from '@/lib/pipeline';
import { DatosSinMarcarCard } from './lead-view/DatosSinMarcarCard';
import type { StepId } from '@/lib/stage-requirements';
import { deleteLeadInlineAction, getLeadFullAction, type LeadFullData } from './actions';
import { StageMoveDialog, type MoveLeadInfo } from './StageMoveDialog';
import { MoverEtapaConfirm } from './MoverEtapaConfirm';
import { pideWizardAlElegir } from './mover-etapa';
import type { FathomLink } from '@/lib/leads';
import { suscripcionDeFila } from '@/lib/venta-tipo';
import { CabeceraLead } from './lead-view/CabeceraLead';
import { FunnelYEtapa, useProductosDeLaFicha } from './lead-view/ProductoDelLead';
import { ANCHO_FICHA_LEAD, ALTO_CHAT_EN_EL_POPUP, ALTO_FICHA_LEAD, MARGEN_FICHA_LEAD } from './lead-view/ficha-medidas';
import { BotonBorrar } from '@/app/_ui/BotonBorrar';
// ⚠️ LAS TABS Y SUS BLOQUES SON UNA SOLA PIEZA PARA LAS DOS PUERTAS (14/10/2026): esta y la ruta /crm/[id]
// (LeadDetailBody) montan la MISMA `FichaPorBloques`, con los MISMOS datos (`getLeadFullAction`). Acá queda
// lo que es del pop-up: el modal, la cabecera, mover de etapa y borrar.
import { FichaPorBloques } from './lead-view/ficha/FichaPorBloques';
import { ConfirmDialog } from '../components/ConfirmDialog';

import { profundidadModales } from '@/app/_components/pila-modales';
import { FichaCambioProvider } from './lead-view/ficha-cambio';
import { EtiquetasDelLead, versionDeEtiquetas } from './lead-view/EtiquetasDelLead';

const SANS = "'Geist', sans-serif";

export function LeadSheet({ data, onClose, initialTab, solucionarAlAbrir, verDatosAlAbrir, avisosAlAbrir }: {
  data: LeadFullData; onClose: () => void; initialTab?: string;
  /** Abrir llevando a ese dato sin marcar («A revisar» del CRM, 13/10/2026). Se aplica UNA vez. */
  solucionarAlAbrir?: StepId;
  /** Abrir con el «Ver» de los datos sin marcar desplegado («A revisar» del CRM, 16/10/2026). */
  verDatosAlAbrir?: boolean;
  /** Abrir para ELEGIR QUÉ AVISA MaKo (el engranaje de «A revisar»): el basurero ignora en todo el funnel. */
  avisosAlAbrir?: boolean;
}) {
  // ⚠️ LA FICHA SE RELEE CUANDO CAMBIA LA CASA DEL LEAD. Sus datos los trajo una action al abrir
  // (LeadEditModal) y el `router.refresh()` no los toca: si desde el desplegable de productos se
  // quita la casa, la etapa, las etapas y el chip de acá serían los del producto anterior. Sólo
  // vale mientras sea el MISMO lead: si la ficha pasa a mostrar otro, mandan sus datos.
  const [fresca, setFresca] = useState<LeadFullData | null>(null);
  const vigente = fresca && fresca.lead.id === data.lead.id ? fresca : data;
  const { lead, stages, pagos, faltantes, datos, equipo, productos, fotoEmail } = vigente;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [delErr, setDelErr] = useState<string | null>(null);
  // En qué productos está y cuál se mira (ver lead-view/ProductoDelLead.tsx). La etapa de la fila
  // de controles es la del producto EN VISTA: la de la casa, o la de su fila en un producto agregado.
  // ⚠️ Y SE RELEE DESPUÉS DE CADA COSA QUE ESCRIBE, no sólo al cambiar la casa (08/10/2026). Con la
  // foto vieja, «Solucionar» abría «Completar datos» con la etapa de ANTES de moverlo, y su Guardar
  // devolvía al lead a esa etapa: en el CRM de Leila (ws11) el #2608 volvió tres veces de
  // «Conversación abierta» a «Contacto nuevo», y el #2605 perdió el Ganado 25 minutos. Las tarjetas
  // avisan por `useRefrescarFicha` (lead-view/ficha-cambio.tsx); los botones de mover, acá abajo.
  const releer = useCallback(() => {
    void getLeadFullAction(lead.id).then((x) => { if (x) setFresca(x); }).catch(() => {});
  }, [lead.id]);
  const fichaProd = useProductosDeLaFicha({
    leadId: lead.id, casa: lead.funnel_id, foto: productos,
    onCasaCambiada: releer,
  });

  const panelRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // a11y de diálogo: ESC, foco al panel, focus-trap básico, scroll-lock.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const prevActive = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      // Escape cierra la ficha SOLO si no hay nada encima. Esto escucha en fase de
      // CAPTURA sobre window, o sea que corre ANTES que cualquier diálogo anidado —
      // el `stopPropagation` de acá abajo no lo evita, porque para cuando corre ya
      // ganó—. Resultado hasta el 27/09: Escape adentro de un wizard o de una
      // confirmación cerraba la ficha entera con lo que estuvieras escribiendo.
      if (e.key === 'Escape' && !e.isComposing) {
        if (profundidadModales() > 0) return; // lo cierra el de arriba
        e.stopPropagation(); onCloseRef.current(); return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const f = panelRef.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], lastEl = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      prevActive?.focus?.();
    };
  }, []);

  const stageKey = lead.pipeline_stage && stages.some((s) => s.key === lead.pipeline_stage) ? lead.pipeline_stage : deriveStageKey(lead);
  const sm: Stage | undefined = stageMeta(stages, stageKey);

  // Cambiar etapa desde el header (el desplegable del funnel, a la derecha). `moveTo` abre el
  // wizard de datos: solo para las etapas que lo necesitan, y para «Completar ahora».
  const [moveTo, setMoveTo] = useState<string | null>(null);
  const moveInfo: MoveLeadInfo = {
    id: lead.id, name: lead.nombre,
    fechaJ1: lead.fecha_junta_1, fechaJ2: lead.fecha_junta_2,
    asistioJ1: lead.asistio_j1, asistioJ2: lead.asistio_j2, calificado: lead.calificado,
    fathom: (lead.fathom_links ?? []) as FathomLink[],
    monto: lead.monto_cierre_usd ?? null, motivo: lead.motivo_perdida,
    setter: lead.setter ?? null, closer: lead.closer ?? null,
    empresa: lead.empresa ?? null, telefono: lead.telefono ?? null,
    tienePlan: pagos.length > 0,
    sinR1: !!lead.sin_r1, sinR2: !!lead.sin_r2, fathomOmitido: !!lead.fathom_omitido,
    email: lead.email ?? null, tieneContrato: !!lead.contrato_path,
    dealServicioOk: !!lead.deal_servicio?.que_es?.trim(),
    dealPromesaOk: !!lead.deal_promesa?.resultado?.trim(),
    dealFiscalOk: !!lead.deal_fiscal?.razon?.trim(),
    dealObligacionesOk: (lead.deal_obligaciones?.cliente?.length ?? 0) > 0 || (lead.deal_obligaciones?.prestador?.length ?? 0) > 0,
    // El tipo de venta guardado (un becado, #747, no vuelve a ver el paso del monto).
    ventaTipo: lead.venta_tipo ?? null,
    // La mensualidad y el plazo de una suscripción: sin ellos reabrirla pedía el monto
    // vacío, y guardar escribía NULL encima (lib/venta-tipo.ts).
    ...suscripcionDeFila(lead),
  };
  // Elegir otra etapa MUEVE, igual que soltar una card en el tablero (08-T22): se
  // confirma y se guarda, y lo que falta se avisa después sin frenar. Antes abría
  // el wizard con todas las preguntas de la etapa, que es lo que hacía abandonar
  // el CRM. Las etapas de reunión y la nutrición manual sí van al wizard: ahí hay
  // una fecha o un plazo que decidir (ver pideWizardAlElegir).
  const [moverDirecto, setMoverDirecto] = useState<string | null>(null);
  const pickStage = (k: string) => {
    if (!k || k === stageKey) return;
    if (pideWizardAlElegir(stages, k)) setMoveTo(k); else setMoverDirecto(k);
  };

  const doDelete = () => {
    setConfirmDelete(false);
    startTransition(async () => {
      try { await deleteLeadInlineAction(lead.id); router.refresh(); onClose(); }
      catch { setDelErr('No se pudo borrar. Reintenta.'); }
    });
  };

  // ⚠️ «SOLUCIONAR» SE RESUELVE ACÁ ADENTRO, sin salir de la ficha. Pedido textual de
  // Martín (05/10/2026): «el botón de "Solucionar" debería permitirme solucionar allí
  // mismo, sin redirigirme a otra ruta, en el mismo modal».
  //
  // Antes navegaba a `/crm/<id>?solucionar=1` (o a `?edit=1&tab=…`, según qué faltara):
  // cerraba el modal, cargaba otra pantalla, y volver era el botón Atrás. Y el destino
  // no hacía nada que no se pueda hacer acá — en la ruta, «Solucionar» es exactamente
  // `setMoveTo(currentStage)` (`app/crm/[id]/LeadDetailBody.tsx`), o sea el MISMO
  // `StageMoveDialog` que este modal ya monta para cambiar de etapa.
  //
  // ⚠️ NO SE ESCRIBE UNA SEGUNDA ESCRITURA. El wizard es el único que marca los datos
  // del worklist (`completeStageMoveAction`), y `faltantes` —calculado en el server— es
  // su lista autoritativa. Lo que lo convierte en «Completar datos» en vez de un
  // movimiento es que `moveTo` apunte a la etapa ACTUAL, igual que en la ruta.
  const solucionar = () => setMoveTo(stageKey);
  const completandoDatos = moveTo === stageKey;

  // ⚠️ «SOLUCIONAR» UN DATO LLEVA AL DATO, NO ABRE EL ASISTENTE (13/10/2026). Martín: «Elimina
  // completamente el pop-up que salta al darle el botón de "solucionar"... me tiene que redirijir
  // al dato que falta, ya sea cambiando de tab o desplazando a donde está el dato... y marcarse
  // donde falta, como lo hacemos con los tutoriales». Desde el 14/10/2026 lo resuelve la ficha
  // (`pedido`, lead-view/ficha/FichaPorBloques.tsx): va a la tab donde ESTA ficha dibuja el campo
  // y lo señala. El asistente queda SÓLO de respaldo (`onNoEsta`): ningún bloque tiene ese campo,
  // o el campo no se dibujó (la R2 todavía no existe).
  const [pedido, setPedido] = useState<{ id: StepId; n: number } | null>(null);
  const solucionarDato = (id: StepId) => setPedido({ id, n: Date.now() });
  const yaSolucionado = useRef(false);
  useEffect(() => {
    if (!solucionarAlAbrir || yaSolucionado.current) return;
    yaSolucionado.current = true;
    solucionarDato(solucionarAlAbrir);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- una vez, al abrir
  }, [solucionarAlAbrir]);

  return (
    <FichaCambioProvider value={releer}>
    <div data-ficha-overlay onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(18,21,27,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: `${MARGEN_FICHA_LEAD}px clamp(10px,3vw,20px)` }}>
      {/* ⚠️ MÁS ANCHO (punto 14 del 12/10/2026: «bastante más ancho, para aprovechar más el
          espacio»): eran 760. El número vive en lead-view/ficha-medidas.ts, que también lee el
          esqueleto de carga. Sin `aria-labelledby`: el nombre ahora es un campo editable, y un
          diálogo no se nombra con un campo. */}
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={lead.nombre || 'Lead'} onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: ANCHO_FICHA_LEAD, height: ALTO_FICHA_LEAD, maxHeight: ALTO_FICHA_LEAD, display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden', outline: 'none' }}>

        {/* ⚠️ LA CABECERA ES LA MISMA PIEZA QUE LA DE LA RUTA (lead-view/CabeceraLead.tsx): la
            portada con la cara del lead cruzándola (punto 11), el nombre que se edita con un clic,
            las ETIQUETAS ARRIBA DEL NOMBRE en el lugar de la pastilla de la etapa (punto 9), y a la
            derecha UN desplegable en árbol —el funnel con sus etapas adentro— ENCIMA de «N sin
            marcar · Solucionar». La cruz va sobre la portada. Queda FIJA: no está adentro del
            cuerpo que scrollea (punto 16).

            Antes eran tres renglones: la cabecera con la etapa en una pastilla, una fila con el
            desplegable de producto y el de la etapa, y otra con las etiquetas. Martín (12/10/2026):
            «Que sea solo 1 desplegable de "PROSPECCIÓN" que es el funnel, y que sea un desplegable
            tipo arbol». */}
        <CabeceraLead
          lead={lead}
          fotoEmail={fotoEmail}
          onCerrar={onClose}
          junto={<EtiquetasDelLead compacto leadId={lead.id} version={versionDeEtiquetas(lead.updated_at, fichaProd.productos)} />}
          acciones={
            <>
              <FunnelYEtapa ficha={fichaProd} etapasCasa={stages} etapaCasa={stageKey} onElegirCasa={pickStage} ariaLabel="Cambiar etapa o funnel" />
              {datos && (
                <DatosSinMarcarCard leadId={lead.id} datos={datos} onSolucionar={solucionarDato} onCambio={releer} abrirAlMontar={verDatosAlAbrir || avisosAlAbrir}
                  ignorarSiempre={avisosAlAbrir ? { funnelId: lead.funnel_id ?? null } : undefined} />
              )}
            </>
          }
        />

        {/* tabs + cuerpo scrolleable. ⚠️ LA FILA DE PESTAÑAS QUEDA PEGADA ARRIBA de este cuerpo
            (`fija`, punto 16: «las tabs de arriba deben acompañar el scroll. Deben permanecer fijas,
            como todo lo que esta arriba»). Este div es el que scrollea y TIENE ALTO (flex: 1 en un
            panel con el alto topeado), que es lo que un sticky necesita para pegarse.
            ⚠️ LAS TABS SON `FichaPorBloques`, la MISMA pieza que la ruta /crm/[id]: Resumen, Tracking,
            Reuniones y Pagos por bloques (la ficha del funnel del lead), MaKo Analyst y el Historial. */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 clamp(16px,4vw,28px) clamp(14px,4vw,20px)' }}>
          <FichaPorBloques
            data={vigente}
            initialTab={initialTab}
            fondoTabs="var(--surface)"
            altoChat={ALTO_CHAT_EN_EL_POPUP}
            pedido={pedido}
            onNoEsta={solucionar}
            // ⚠️ Acá el lead es estado de cliente (getLeadFullAction), así que el refresh de una tarjeta no
            // lo alcanza: se aplica lo que la action devolvió —el asistente de «Completar datos» se arma
            // con ESTE lead— y se relee el resto (sin «Sin cobro» vuelve a faltar el monto).
            parchear={(patch) => { setFresca({ ...vigente, lead: { ...vigente.lead, ...patch } }); releer(); }}
          />
        </div>

        {/* footer — ⚠️ SIN «Cerrar» (punto 12, 12/10/2026: «Elimina el botón de "Cerrar" que está
            abajo del modal de un lead, para eso ya tenemos la cruz... Ahí debería estar el botón de
            "Borrar lead" y en rojo»). Es el tacho rojo de la casa (BotonBorrar), con la confirmación
            que nombra la consecuencia. Antes era un texto gris a la izquierda, que no se leía como
            algo irreversible.
            ⚠️ Y ACÁ ESTABA «Editar lead →», que se fue el 05/10/2026 (pedido DOS veces): los 15
            campos que ese formulario editaba se editan en la ficha, cada uno donde se lee. Lo único
            con pantalla propia es el DEAL, y su entrada está en la tab Pagos. */}
        {delErr && <div style={{ padding: '8px clamp(16px,4vw,28px)', color: 'var(--bad)', fontSize: 13, fontWeight: 600, fontFamily: SANS }}>{delErr}</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 14, padding: '12px clamp(16px,4vw,28px)', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <BotonBorrar texto="Borrar lead" title={`Borrar a ${lead.nombre || 'este lead'}`} onClick={() => setConfirmDelete(true)} disabled={pending} />
        </div>
      </div>

      {/* ⚠️ EL CLICK NO PUEDE LLEGAR AL BACKDROP DE LA FICHA. Este wizard se monta
          DENTRO del overlay de la ficha, que tiene `onClick={onClose}`: en React los
          eventos suben por el árbol de componentes, así que un click en el fondo del
          wizard (el `padding: 20` alrededor de su panel) cerraba su diálogo Y la ficha
          entera — un portal no lo evita, porque la propagación sigue el árbol de React
          y no el DOM. Da igual cuando mover de etapa cierra la ficha de todos modos, y
          deja de dar igual con «Completar datos», donde la ficha tiene que quedar.
          Es el gemelo por CLICK del Escape que `profundidadModales()` ya resuelve. */}
      {moveTo && (
        <div onClick={(e) => e.stopPropagation()}>
          <StageMoveDialog
            lead={moveInfo}
            stages={stages}
            move={{ to: moveTo }}
            // Completar datos (el «Solucionar» del aviso): es el mismo wizard sobre la
            // etapa actual, con la lista de faltantes que calculó el server. Los tres
            // props van juntos y con la misma condición que en `LeadDetailBody`.
            titulo={completandoDatos ? 'Completar datos' : undefined}
            completarDatos={completandoDatos}
            faltantes={completandoDatos ? faltantes : undefined}
            equipo={equipo}
            onClose={() => setMoveTo(null)}
            // Al completar datos la ficha SE QUEDA: la persona no pidió irse de acá, y
            // cerrarla sería la redirección que este cambio vino a sacar. Mover de
            // etapa sí la cierra — la tarjeta ya no vive en la columna que se estaba
            // mirando.
            onDone={() => { const quedarse = completandoDatos; setMoveTo(null); router.refresh(); if (quedarse) releer(); else onClose(); }}
          />
        </div>
      )}

      {moverDirecto && (
        <MoverEtapaConfirm
          lead={{ id: lead.id, nombre: lead.nombre, fechaJ1: lead.fecha_junta_1, asistioJ1: lead.asistio_j1, calificado: lead.calificado }}
          desde={sm?.label ?? stageKey}
          destino={{ key: moverDirecto, label: stageMeta(stages, moverDirecto)?.label ?? moverDirecto }}
          zIndex={120}
          onCancel={() => setMoverDirecto(null)}
          // ⚠️ La etapa nueva se pinta YA (el parche) y se confirma releyendo: sin el parche,
          // `completandoDatos` compara contra la etapa vieja y «Solucionar» abre «Mover a…».
          onHecho={() => { const k = moverDirecto; setMoverDirecto(null); router.refresh(); if (k) setFresca({ ...vigente, lead: { ...vigente.lead, pipeline_stage: k } }); releer(); }}
          // «Completar ahora»: el lead YA está en la etapa nueva, así que el wizard
          // abre sobre ella, a completar — no a mover de nuevo.
          onCompletar={() => { const k = moverDirecto; setMoverDirecto(null); router.refresh(); if (k) setFresca({ ...vigente, lead: { ...vigente.lead, pipeline_stage: k } }); releer(); setMoveTo(k); }}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Borrar lead"
          message={<>Vas a borrar definitivamente a <b style={{ color: 'var(--ink)' }}>{lead.nombre}</b> y todo su historial. <b style={{ color: 'var(--bad)' }}>No se puede deshacer.</b></>}
          confirmLabel="Borrar definitivamente"
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(false)}
          zIndex={120}
        />
      )}
    </div>
    </FichaCambioProvider>
  );
}
