'use client';

// =============================================================================
// FichaPorBloques — LAS TABS DE LA FICHA DEL LEAD, las mismas en las dos puertas
// =============================================================================
// Pedido de Martín (14/10/2026, 03:06): «Que Pagos sea personalizable... edita todo en la misma tab...
// Todas las personalizables, no los hagas con un modal diferente... Que replique la edición que tenemos en
// "Dashboard" y "Landing Generator", que sea un constructor por bloques... con templates... que pueda elegir
// que bloques poner, que diseño, tamaño... y que ahí mismo se configure qué datos sin marcar notifica».
// El diseño es docs/diseno-ficha-bloques.md; el motor, lib/ficha/.
//
// ⚠️ UNA SOLA PIEZA PARA LAS DOS PUERTAS: el pop-up del tablero (app/crm/LeadSheet.tsx) y la ruta /crm/[id]
//    (app/crm/[id]/LeadDetailBody.tsx) montan ESTO con los MISMOS datos (`getLeadFullAction`). Hasta el
//    14/10/2026 cada una armaba sus tabs a mano y ya se habían separado: «N sin marcar» se contaba distinto
//    en cada una. Lo fija tests/ficha-armador.test.ts.
// ⚠️ LO QUE SE PERSONALIZA son Resumen, Tracking, Reuniones y Pagos: cada una es un ./Armador.tsx sobre la
//    ficha del funnel del lead (`data.ficha`). La cabecera (en cada puerta), MaKo Analyst y el Historial
//    quedan como estaban (§3, «Lo que no se personaliza»). Qué tab sale la deciden sus reglas de siempre:
//    Reuniones si el funnel tiene una etapa de reunión, Pagos por `muestraPagos`, Tracking por la campaña.
// ⚠️ «PERSONALIZAR» ES DEL ADMIN (`puedePersonalizar`), en la fila de las tabs y no un engranaje. Editando se
//    ven también Pagos y Tracking aunque este lead no los tenga: la ficha es del funnel, no de este lead.
//    Guarda sola, con «Deshacer» (./useFichaDelFunnel.ts), como el Dashboard.
// ⚠️ PERSONALIZANDO SE ELIGE EL DISPOSITIVO (Escritorio · Tablet · Celular, ./SelectorDispositivo.tsx), como en
//    el editor del Dashboard y el del Web Generator: angosta la ficha REAL (el mismo armador, en una página del
//    ancho del dispositivo), no una simulación aparte. Al volver a «Ver», el escritorio.
// ⚠️ «SOLUCIONAR» UN DATO lo resuelve acá (`pedido`): va a la tab donde se dibuja su campo EN ESTA FICHA
//    (`tabDelDato`, ./armar.ts) y lo señala. Sin un bloque que lo tenga, el asistente (`onNoEsta`).
//
// 16/10/2026 — EL MARCO PERSONALIZABLE POR TAB. Martín: «Sobre todo que sea PERSONALIZABLE, como tenemos en dashboard o
// general cada tab... Que se pueda cambiar el nombre de las tabs internas, agregar bloques, que se pueda ver "epico"...
// Si nunca configuró una tab, y entra por primera vez al detail de un lead, que le salten los templates y el ¿Qué vas
// a crear hoy?... Y que pueda elegir».
//   · EL NOMBRE de cada tab es el de la ficha del funnel (`efectiva.nombres`); personalizando, doble clic en la
//     pestaña lo cambia (../LeadTabs.tsx), como una hoja del Dashboard. La clave (`?tab=`) no cambia.
//   · LA GALERÍA de una tab (./GaleriaTab.tsx) va EN EL LUGAR de la tab: se abre SOLA para el admin en una tab que
//     nadie configuró en este funnel, y con «Plantillas» personalizando. Lo que se mira se dibuja abajo con los datos de
//     este lead (`fichaConVista`, ./galeria.ts): mirar no guarda nada; «Usar» sí.
//   · LA ÉPICA es de la tab (`efectiva.epica`): el titular gigante es el nombre de la tab, la grilla reparte menos por
//     fila y cada bloque recibe `epico` (./tipos.ts).
// =============================================================================

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { EstiloDeLaHoja } from './EstiloDeLaHoja';
import { Dropdown } from '@/app/components/Dropdown';
import dynamic from 'next/dynamic';
import { deriveStageKey } from '@/lib/pipeline';
import { tieneEtapaDeReunion } from '@/lib/etapa-reunion';
import { muestraPagos, planEnLead } from '@/lib/muestra-pagos';
import { buildJourney } from '@/lib/journey';
import { marcaDato } from '@/lib/datos-aviso';
import type { StepId } from '@/lib/stage-requirements';
import type { Lead } from '@/lib/leads';
import { bloqueDef, NOMBRE_TAB, TABS_FICHA, type BloqueId, type TabFicha } from '@/lib/ficha/catalogo';
import { fichaEfectiva, TOPE_NOMBRE_TAB, type CambioFicha, type FichaEfectiva } from '@/lib/ficha/config';
import { Senalar } from '@/app/_ui/Senalar';
import { Toast, useToast } from '@/app/_ui/Toast';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import type { LeadFullData } from '../../actions';
import { JourneyTimeline } from '../../JourneyTimeline';
import { LeadTabs, type LeadTabDef } from '../LeadTabs';
import { AnalystDelLead } from '../AnalystDelLead';
import { AuditHistory } from '../AuditHistory';
import { useRefrescarFicha } from '../ficha-cambio';
import { Armador } from './Armador';
import { AgregarBloque } from './AgregarBloque';
import { PanelFicha } from './PanelFicha';
import { cambiaAvisos, useFichaDelFunnel } from './useFichaDelFunnel';
import { SelectorDispositivo } from './SelectorDispositivo';
import { CLAVE_DE_TAB, dispositivoVisto, estiloDeFicha, indiceDeOcurrencia, puedePersonalizar, tabDelDato, type DispositivoFicha } from './armar';
import { entradaDe } from './registro';
import { CSS_FICHA } from './ficha-css';
import { cambioDeVista, fichaConVista, type VistaGaleria } from './galeria';
import type { CtxFicha } from './tipos';

// La galería sólo la ve el admin (desde «Templates»): su código (la caja de la casa, el micrófono) no viaja con la
// ficha de todos, y no hace falta en el server.
const GaleriaTab = dynamic(() => import('./GaleriaTab').then((m) => m.GaleriaTab), { ssr: false });

const MONO = "'Geist Mono', monospace";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };

const enUnTexto = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement && !!t.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]');

export function FichaPorBloques({ data, parchear, altoChat, initialTab, onTab, fondoTabs, pedido, onNoEsta }: {
  /** Lo que trajo `getLeadFullAction`: las dos puertas leen lo mismo. */
  data: LeadFullData;
  /** Aplicar en el acto lo que una acción ya escribió en el lead (el pop-up). Sin esto, se relee. */
  parchear?: (patch: Partial<Lead>) => void;
  /** El alto del chat de MaKo Analyst: cada puerta sabe cuánto le queda visible. */
  altoChat: string;
  initialTab?: string;
  onTab?: (key: string) => void;
  /** El fondo de la fila de tabs pegada arriba (el de quien la contiene). */
  fondoTabs: string;
  /** «Solucionar» un dato de la cabecera: `n` cambia en cada pedido. */
  pedido?: { id: StepId; n: number } | null;
  /** El campo no está en esta ficha: el asistente de «Completar datos». */
  onNoEsta: () => void;
}) {
  const { lead, stages, pagos } = data;
  // El `router.refresh()` más, en el pop-up, la relectura de la ficha (lead-view/ficha-cambio.tsx).
  const refrescar = useRefrescarFicha();
  const etapa = lead.pipeline_stage && stages.some((s) => s.key === lead.pipeline_stage) ? lead.pipeline_stage : deriveStageKey(lead);
  const hoy = new Date().toISOString().slice(0, 10);
  const { toast, show, clear } = useToast();

  const ff = useFichaDelFunnel(data.ficha ?? null, {
    // Lo que cambia los avisos cambia el «N sin marcar» de la cabecera y el «A revisar» del tablero.
    onGuardado: (c) => { if (cambiaAvisos(c)) refrescar(); },
    onError: (m) => show(m, undefined, 'bad'),
  });
  // Sin la ficha del funnel (la lectura falló), la de respaldo con lo del negocio, y sin «Personalizar».
  const efectiva: FichaEfectiva = ff.ficha?.efectiva ?? fichaEfectiva('respaldo', null, { resumen: data.resumen ?? {}, apagados: [] });
  const puede = puedePersonalizar(data);
  const [editando, setEditando] = useState(false);
  const enEdicion = editando && puede && !!ff.ficha;
  // La vista por dispositivo, como el editor del Dashboard: sólo personalizando; al volver a «Ver», el escritorio.
  const [dispositivoElegido, setDispositivo] = useState<DispositivoFicha>('escritorio');
  const dispositivo = dispositivoVisto(enEdicion, dispositivoElegido);
  const [sel, setSel] = useState<{ tab: TabFicha; indice: number } | null>(null);
  const [agregar, setAgregar] = useState<{ tab: TabFicha; ancla: HTMLElement } | null>(null);
  // LA GALERÍA (./GaleriaTab.tsx): la tab donde se abrió con «Plantillas», lo que se mira en cada una, las que se
  // cerraron con «Ahora no» en este navegador y si ya se montó (se abre sola recién ahí: el server no sabe lo cerrado).
  const [galeria, setGaleria] = useState<TabFicha | null>(null);
  const [vistas, setVistas] = useState<Partial<Record<TabFicha, VistaGaleria>>>({});

  // Las tabs que salen, con sus reglas de siempre (las de las dos puertas).
  const verReuniones = tieneEtapaDeReunion(stages);
  const verPagos = muestraPagos({ estado: lead.estado_lead, etapa, cuotas: pagos.length, planEnLead: planEnLead(lead), ...data.cobro });
  const verTracking = data.verTracking ?? true;
  const delLead: TabFicha[] = ['resumen', ...(verTracking ? ['tracking' as const] : []), ...(verReuniones ? ['reuniones' as const] : []), ...(verPagos ? ['pagos' as const] : [])];
  const tabsBloques: TabFicha[] = enEdicion ? ['resumen', 'tracking', ...(verReuniones ? ['reuniones' as const] : []), 'pagos'] : delLead;

  // «Solucionar» un dato: a la tab donde se dibuja su campo, y señalado. Lo piden la cabecera (`pedido`, una vez por
  // pedido) y, desde el 16/10/2026, los bloques (`ctx.solucionar`: «Completar» de la siguiente acción). Un solo camino.
  const [irA, setIrA] = useState<{ key: string; n: number } | null>(null);
  // ⚠️ «AI ANALYST» YA NO ES UNA PESTAÑA (16/10/2026, Martín: «"AI Analyst" que abra el chat de MaKo para analizar el
  // detail de ese lead en específico... Esto reemplaza a la tab de "MaKo Analyst"... cuando se abra el chat de MaKo al
  // costado izquierdo, todo el modal del detail se desplace a la derecha»). Es un panel aparte, a la izquierda, que
  // se abre desde el «⋯». Lo que pedía la pestaña vieja (`?tab=insights`, «Ver análisis» de la siguiente acción) lo
  // abre a él.
  const [analyst, setAnalyst] = useState(initialTab === 'insights');
  const [senal, setSenal] = useState<{ id: StepId; label: string } | null>(null);
  const ctx: CtxFicha = {
    data, lead, stages, etapa, hoy,
    rol: data.rol ?? 'otro', esAdmin: data.rol === 'admin', verPrivado: !!data.verPrivado,
    releer: refrescar,
    parchear: parchear ?? (() => refrescar()),
    irATab: (clave) => { if (clave === 'insights') { setAnalyst(true); return; } setIrA({ key: clave, n: Date.now() }); },
    solucionar: (paso) => solucionar(paso, Date.now()),
  };
  function solucionar(paso: StepId, n: number) {
    setEditando(false);
    const t = tabDelDato(paso, delLead, {
      listaDe: (tab) => efectiva.tabs[tab], reglasDe: entradaDe, vacio: (p, r) => !!r.estaVacio?.(ctx, p), verPrivado: ctx.verPrivado,
    });
    if (!t) { onNoEsta(); return; }
    const d = [...(data.datos?.avisar ?? []), ...(data.datos?.ocultos ?? [])].find((x) => x.id === paso);
    setIrA({ key: CLAVE_DE_TAB[t], n });
    setSenal({ id: paso, label: d?.label ?? 'este dato' });
  }

  // Un cambio de la ficha, con la selección que le sigue: el bloque movido sigue elegido, el recién puesto
  // queda elegido, y lo que cambia la lista entera la suelta.
  const cambiar = useCallback((c: CambioFicha) => {
    if (c.op === 'mover') {
      setSel((s) => {
        if (!s || s.tab !== c.tab) return s;
        const desde = indiceDeOcurrencia(efectiva.tabs[c.tab], c.bloque, c.n ?? 1);
        return desde === s.indice ? { tab: c.tab, indice: c.lugar - 1 } : null;
      });
    } else if (c.op === 'poner') {
      setSel({ tab: c.tab, indice: c.lugar ? c.lugar - 1 : efectiva.tabs[c.tab].length });
    } else if (c.op === 'quitar' || c.op === 'lista' || c.op === 'volver' || c.op === 'plantilla' || c.op === 'armar' || c.op === 'restaurar') {
      setSel(null);
    }
    ff.cambiar(c);
  }, [ff, efectiva]);

  // El teclado del editor, como el del Dashboard: Ctrl+Z deshace y Supr quita el elegido (fuera de un texto).
  useEffect(() => {
    if (!enEdicion) return;
    const tecla = (e: KeyboardEvent) => {
      if (enUnTexto(e.target)) return;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); ff.deshacer(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
        const p = efectiva.tabs[sel.tab][sel.indice];
        const def = p && bloqueDef(p.id);
        if (!p || !def || (!def.quitable && def.tab === sel.tab)) return;
        e.preventDefault();
        const n = efectiva.tabs[sel.tab].slice(0, sel.indice + 1).filter((x) => x.id === p.id).length;
        cambiar({ op: 'quitar', tab: sel.tab, bloque: p.id, n });
      }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [enEdicion, sel, efectiva, ff, cambiar]);

  // El «Solucionar» de la cabecera, una vez por pedido.
  useEffect(() => {
    if (pedido) solucionar(pedido.id, pedido.n);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sólo cuando llega un pedido nuevo
  }, [pedido?.n]);

  // ── La galería de una tab ─────────────────────────────────────────────────────────────────
  // ⚠️ YA NO SE ABRE SOLA (16/10/2026, Martín: «en los casos de los workspace que ya tienen leads, simplemente ponles
  // las plantillas sugeridas, es decir que no aparezca el "¿Qué vas a crear hoy?"»). Una tab sin configurar ya se
  // dibuja con su sugerida (`efectiva`), sin escribir nada; la galería se abre sólo con «Templates». Con eso se fueron
  // `abreSola` y el «Ahora no» que se recordaba en el navegador.
  const galeriaAbierta = (tab: TabFicha): boolean => !!ff.ficha && puede && galeria === tab;
  const soltarGaleria = (tab: TabFicha) => {
    setGaleria((g) => (g === tab ? null : g));
    setVistas((v) => { const n = { ...v }; delete n[tab]; return n; });
  };
  /** «Usar»: lo que se mira (o, sin mirar nada, la de hoy, que queda elegida). */
  const usarGaleria = (tab: TabFicha) => {
    const v = vistas[tab] ?? { tipo: 'plantilla' as const, id: efectiva.plantillasTab[tab] };
    cambiar(cambioDeVista(v, tab));
    soltarGaleria(tab);
  };
  /** Tocar una plantilla de la galería: queda elegida y la galería se cierra (sin vista previa, 16/10/2026). */
  const elegirGaleria = (tab: TabFicha, v: VistaGaleria) => {
    cambiar(cambioDeVista(v, tab));
    soltarGaleria(tab);
  };

  const ponerBloque = (tab: TabFicha, id: BloqueId) => {
    setAgregar(null);
    const lugar = sel?.tab === tab ? sel.indice + 2 : undefined;
    cambiar({ op: 'poner', tab, bloque: id, ...(lugar ? { lugar } : {}) });
  };

  const contenidoDe = (tab: TabFicha): ReactNode => {
    const conGaleria = galeriaAbierta(tab) && !!ff.ficha;
    const vista = conGaleria ? vistas[tab] ?? null : null;
    // Mirando una plantilla de la galería, la tab de abajo es la que QUEDARÍA: el mismo motor que guarda, sin guardar.
    const ef = vista && ff.ficha ? fichaConVista(ff.ficha, vista, tab) : efectiva;
    const epico = ef.epica[tab];
    const galeriaNodo = conGaleria && ff.ficha ? (
      <GaleriaTab tab={tab} ficha={ff.ficha} nombreTab={efectiva.nombres[tab]} vista={vista}
        onVista={(v) => setVistas((x) => ({ ...x, [tab]: v }))} onElegir={(v) => elegirGaleria(tab, v)} onUsar={() => usarGaleria(tab)} onCerrar={() => soltarGaleria(tab)}
        registrado={(id) => !!entradaDe(id)} />
    ) : null;
    // ⚠️ CON LA GALERÍA ABIERTA Y NADA PARA MIRAR, ABAJO NO VA NADA (16/10/2026): antes se dibujaba la tab entera con
    // la sugerida y un «Usar la sugerida», y Martín: «Es confuso eso». Abajo sólo se mira lo que armó MaKo.
    const sinVistaPrevia = conGaleria && !vista;
    // ⚠️ LA ÉPICA ES DE LA TAB: el titular gigante es su nombre (el de General y MaKo Mobile v3), con más aire.
    const armador = (
      <>
        {!enEdicion && galeriaNodo}
        {!sinVistaPrevia && <div className={epico ? 'fb-tab fb-tab--epica' : 'fb-tab'}>
          {epico && <h2 className="fb-titular">{efectiva.nombres[tab]}</h2>}
          <Armador tab={tab} lista={ef.tabs[tab]} ctx={ctx} editando={enEdicion && !conGaleria} epico={epico}
            sel={sel?.tab === tab ? sel.indice : null} onSel={(i) => setSel(i == null ? null : { tab, indice: i })}
            onCambio={cambiar} onAgregar={(ancla) => setAgregar({ tab, ancla })} dispositivo={dispositivo} />
        </div>}
      </>
    );
    if (!enEdicion || !ff.ficha) return armador;
    return (
      <div className="fb-edicion">
        <div style={{ minWidth: 0 }}>
          <div className="fb-barra" role="toolbar" aria-label={`Personalizar ${NOMBRE_TAB[tab]}`}>
            <button type="button" className="fb-herr" onClick={ff.deshacer} disabled={!ff.puedeDeshacer || ff.guardando} title="Deshacer (Ctrl+Z)">
              <IconoMenu nombre="restaurar" size={15} /> Deshacer
            </button>
            <span className="fb-sep" aria-hidden />
            <button type="button" className="fb-herr" aria-haspopup="menu" aria-expanded={agregar?.tab === tab}
              onClick={(e) => { const ancla = e.currentTarget; setAgregar((a) => (a?.tab === tab ? null : { tab, ancla })); }}>
              <IconoMenu nombre="agregar" size={15} /> Agregar bloque <span aria-hidden>▾</span>
            </button>
            <button type="button" className="fb-herr" aria-pressed={conGaleria} onClick={() => { setSel(null); setAgregar(null); if (conGaleria) soltarGaleria(tab); else setGaleria(tab); }}>
              {/* «Templates» desde el 16/10/2026 («"Plantilla" ya está en la topbar de edición, y debería llamarse
                  "Templates"», Martín). */}
              <IconoMenu nombre="archivo" size={15} /> Templates
            </button>
            <div className="fb-barra-fin">
              {!delLead.includes(tab) && <span className="fb-panel-linea" style={{ margin: 0, padding: '0 8px' }}>Este lead no ve esta tab.</span>}
              <SelectorDispositivo valor={dispositivo} onCambiar={setDispositivo} />
              <EstiloDeLaHoja ef={efectiva} tab={tab} onCambio={cambiar} />
            </div>
          </div>
          {galeriaNodo}
          {/* ⚠️ LA FICHA REAL, ANGOSTADA, no una vista aparte (como `lk-pagina` del Dashboard): el MISMO armador
              con sus bloques de verdad, en una página del ancho del dispositivo (./ficha-css.ts). */}
          <div className="fb-lienzo" data-dispositivo={dispositivo === 'escritorio' ? undefined : dispositivo}>
            <div className="fb-pagina" data-dispositivo={dispositivo === 'escritorio' ? undefined : dispositivo}>
              {armador}
            </div>
          </div>
        </div>
        <PanelFicha ficha={ff.ficha} tab={tab} onCambio={cambiar} onPlantillas={() => { setSel(null); setGaleria(tab); }} />
      </div>
    );
  };

  const journey = buildJourney({
    createdISO: lead.created_at,
    fechaAgenda: lead.fecha_agenda,
    fechaJ1: lead.fecha_junta_1,
    asistioJ1: lead.asistio_j1,
    fechaJ2: lead.fecha_junta_2,
    asistioJ2: lead.asistio_j2,
    fechaConfirmacion: lead.fecha_confirmacion,
    fechaPrimerPago: lead.fecha_primer_pago ?? null,
    fechaCierre: lead.fecha_cierre,
    estadoLead: lead.estado_lead,
    monto: lead.monto_cierre_usd ?? 0,
    hoyISO: hoy,
    // Las reuniones del recorrido son las etapas `kind: 'reunion'` DE ESTE embudo, con el nombre que les
    // puso el dueño. `etapaActual` sólo decide si se dibuja una reunión sin lugar (la 3ª en adelante).
    etapas: stages, etapaActual: etapa,
  });

  // El nombre de cada tab es el de la ficha del funnel; personalizando, doble clic lo cambia (la clave no cambia).
  const deTab = (tab: TabFicha) => ({ key: CLAVE_DE_TAB[tab], label: efectiva.nombres[tab], content: contenidoDe(tab), renombrable: enEdicion });
  const tabs: LeadTabDef[] = [
    deTab('resumen'),
    // ⚠️ EL ORDEN DE LAS TABS LO DECIDIÓ MARTÍN (05/10 y 27/09/2026): Tracking, Reuniones y Pagos, y después
    // MaKo Analyst pegado al Historial (las dos contestan «qué pasó con esta persona»).
    ...(tabsBloques.includes('tracking') ? [deTab('tracking')] : []),
    ...(tabsBloques.includes('reuniones') ? [deTab('reuniones')] : []),
    ...(tabsBloques.includes('pagos') ? [{ ...deTab('pagos'), badge: pagos.filter((p) => !p.pagado).length }] : []),
    // «MaKo Analyst» dejó de ser una pestaña el 16/10/2026: es el panel «AI Analyst» (ver `analyst`).
    // El recorrido junto al registro de cambios: la otra mitad de «qué pasó».
    {
      key: 'actividad', label: 'Historial',
      content: (
        <>
          <section style={card}>
            <div style={{ ...sectLabel, marginBottom: 16 }}>Recorrido del lead</div>
            <JourneyTimeline steps={journey} />
          </section>
          <AuditHistory leadId={lead.id} stages={stages} />
        </>
      ),
    },
  ];

  const estilo = estiloDeFicha(efectiva.estilo);
  const boton = puede ? (
    <button type="button" className="fb-personalizar" aria-pressed={enEdicion}
      title={enEdicion ? 'Volver a la ficha' : 'Armar la ficha de este funnel'}
      onClick={() => { setEditando((v) => !v); setSel(null); setAgregar(null); setGaleria(null); setVistas({}); }}>
      {/* «Editar» en azul, como el Dashboard («Obvio que el botón de "Personalizar" debe eliminarse... Que sea igual
          que en dashboard o general... El botón en azul de "Editar"», Martín, 16/10/2026). */}
      <IconoMenu nombre={enEdicion ? 'ver' : 'editar'} size={15} /> {enEdicion ? 'Ver' : 'Editar'}
    </button>
  ) : undefined;

  // El «⋯» al lado de «Editar», como el del Dashboard. Lo ve todo el que ve la ficha (el AI Analyst era una pestaña
  // de todos); «Editar» sigue siendo sólo del admin.
  const copiarLink = () => {
    const ws = new URLSearchParams(window.location.search).get('ws');
    const url = `${window.location.origin}/crm/${lead.id}${ws ? `?ws=${encodeURIComponent(ws)}` : ''}`;
    void navigator.clipboard?.writeText(url).then(() => show('Link copiado'), () => show('No se pudo copiar', undefined, 'bad'));
  };
  const menu = (
    <Dropdown value="" placeholder="⋯" align="right" resetAfterSelect sinFlecha ariaLabel="Más opciones de la ficha"
      buttonStyle={{ width: 32, height: 32, padding: 0, justifyContent: 'center', border: '1px solid var(--border-strong)', borderRadius: 999, background: 'var(--surface)', color: 'var(--dim)', fontSize: 16, lineHeight: 1 }}
      options={[
        { value: 'analyst', label: 'AI Analyst', icono: 'mako' },
        { value: 'link', label: 'Copiar el link', icono: 'link' },
      ]}
      onChange={(v) => { if (v === 'analyst') setAnalyst(true); else if (v === 'link') copiarLink(); }} />
  );
  const acciones = <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{boton}{menu}</span>;

  // El panel del AI Analyst: aparte de la ficha (por portal), a la izquierda, y la ficha se corre a la derecha para
  // dejarle lugar (el `<style>` vive sólo mientras está abierto). El clic adentro no cierra la ficha: el evento sube
  // por el árbol de React hasta la caja de la ficha, que lo frena.
  const panelAnalyst = analyst && typeof document !== 'undefined' ? createPortal(
    <aside aria-label={`AI Analyst de ${lead.nombre || 'este lead'}`} onClick={(e) => e.stopPropagation()}
      style={{ position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 90, width: 'min(420px, 100vw)', display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderRight: '1px solid var(--border)', boxShadow: '12px 0 32px rgba(18,21,27,.18)' }}>
      <style>{'[data-ficha-overlay]{padding-left:calc(min(420px, 100vw) + 20px)!important}[data-ficha-ruta]{padding-left:min(420px, 100vw)}'}</style>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--border)', borderTop: '3px solid var(--mako)' }}>
        <IconoMenu nombre="mako" size={18} />
        <strong style={{ flex: 1, fontSize: 15, color: 'var(--ink)' }}>AI Analyst</strong>
        <button type="button" onClick={() => setAnalyst(false)} title="Cerrar" aria-label="Cerrar el AI Analyst"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, border: 'none', borderRadius: 8, background: 'none', color: 'var(--dim)', cursor: 'pointer', padding: 0 }}>
          <IconoMenu nombre="cerrar" size={16} />
        </button>
      </header>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 12px' }}>
        <AnalystDelLead lead={lead} stages={stages} tienePlan={pagos.length > 0} inicial={data.insightGen}
          faltantesIniciales={data.faltantesInsight}
          llamadas={data.insights.map((i) => ({ tipo: i.tipo, fecha: i.started_at, url: i.share_url }))}
          alto="calc(100vh - 90px)" />
      </div>
    </aside>,
    document.body,
  ) : null;

  return (
    <div className={['fb', enEdicion && 'fb--editando', ...estilo.clases].filter(Boolean).join(' ')} style={estilo.vars as CSSProperties}>
      <style>{CSS_FICHA}</style>
      <LeadTabs initial={initialTab} onChange={onTab} irA={irA} fija={{ fondo: fondoTabs }} actions={acciones} tabs={tabs}
        maxNombre={TOPE_NOMBRE_TAB} onRenombrar={enEdicion ? (key, nombre) => {
          const tab = TABS_FICHA.find((t) => CLAVE_DE_TAB[t] === key);
          if (tab) cambiar({ op: 'nombre', tab, nombre: nombre || null });
        } : undefined} />
      {senal && (
        <Senalar objetivo={marcaDato(senal.id)} texto={`Falta: ${senal.label}`}
          onCerrar={() => setSenal(null)} onNoEsta={onNoEsta} />
      )}
      {agregar && (
        <AgregarBloque ancla={agregar.ancla} tab={agregar.tab} lista={efectiva.tabs[agregar.tab]} verPrivado={ctx.verPrivado}
          onElegir={(id) => ponerBloque(agregar.tab, id)} onCerrar={() => setAgregar(null)} />
      )}
      <Toast state={toast} onClose={clear} />
      {panelAnalyst}
    </div>
  );
}
