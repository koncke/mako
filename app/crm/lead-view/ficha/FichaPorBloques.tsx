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
import { abreSola, cambioDeVista, claveCerrada, fichaConVista, type VistaGaleria } from './galeria';
import type { CtxFicha } from './tipos';

// La galería sólo la ve el admin, y casi siempre una vez por tab: su código (la caja de la casa, el micrófono) no
// viaja con la ficha de todos. Se abre después de montar (`montado`), así que no hace falta en el server.
const GaleriaTab = dynamic(() => import('./GaleriaTab').then((m) => m.GaleriaTab), { ssr: false });

/** Lee «Ahora no» del navegador. Puede no haber almacenamiento (una ventana privada, un iframe): entonces, nada. */
function leerCerradas(funnelId: number): Set<string> {
  const out = new Set<string>();
  try { for (const tab of TABS_FICHA) { const k = claveCerrada(funnelId, tab); if (window.localStorage.getItem(k) === '1') out.add(k); } } catch { /* sin almacenamiento */ }
  return out;
}

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
  const [montado, setMontado] = useState(false);
  const [cerradas, setCerradas] = useState<Set<string>>(() => new Set());
  const funnelId = ff.ficha?.funnel.id ?? null;
  useEffect(() => {
    setMontado(true);
    if (funnelId != null) setCerradas(leerCerradas(funnelId));
  }, [funnelId]);

  const ctx: CtxFicha = {
    data, lead, stages, etapa, hoy,
    rol: data.rol ?? 'otro', esAdmin: data.rol === 'admin', verPrivado: !!data.verPrivado,
    releer: refrescar,
    parchear: parchear ?? (() => refrescar()),
  };

  // Las tabs que salen, con sus reglas de siempre (las de las dos puertas).
  const verReuniones = tieneEtapaDeReunion(stages);
  const verPagos = muestraPagos({ estado: lead.estado_lead, etapa, cuotas: pagos.length, planEnLead: planEnLead(lead), ...data.cobro });
  const verTracking = data.verTracking ?? true;
  const delLead: TabFicha[] = ['resumen', ...(verTracking ? ['tracking' as const] : []), ...(verReuniones ? ['reuniones' as const] : []), ...(verPagos ? ['pagos' as const] : [])];
  const tabsBloques: TabFicha[] = enEdicion ? ['resumen', 'tracking', ...(verReuniones ? ['reuniones' as const] : []), 'pagos'] : delLead;

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

  // «Solucionar» un dato: a la tab donde se dibuja su campo, y señalado. Una vez por pedido.
  const [irA, setIrA] = useState<{ key: string; n: number } | null>(null);
  const [senal, setSenal] = useState<{ id: StepId; label: string } | null>(null);
  useEffect(() => {
    if (!pedido) return;
    setEditando(false);
    const t = tabDelDato(pedido.id, delLead, {
      listaDe: (tab) => efectiva.tabs[tab], reglasDe: entradaDe, vacio: (p, r) => !!r.estaVacio?.(ctx, p), verPrivado: ctx.verPrivado,
    });
    if (!t) { onNoEsta(); return; }
    const d = [...(data.datos?.avisar ?? []), ...(data.datos?.ocultos ?? [])].find((x) => x.id === pedido.id);
    setIrA({ key: CLAVE_DE_TAB[t], n: pedido.n });
    setSenal({ id: pedido.id, label: d?.label ?? 'este dato' });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sólo cuando llega un pedido nuevo
  }, [pedido?.n]);

  // ── La galería de una tab ─────────────────────────────────────────────────────────────────
  const galeriaAbierta = (tab: TabFicha): boolean => !!ff.ficha && puede && (galeria === tab || abreSola({
    puede, montado, editando: enEdicion, configurada: efectiva.configuradas.includes(tab),
    cerrada: funnelId != null && cerradas.has(claveCerrada(funnelId, tab)),
  }));
  const soltarGaleria = (tab: TabFicha) => {
    setGaleria((g) => (g === tab ? null : g));
    setVistas((v) => { const n = { ...v }; delete n[tab]; return n; });
  };
  /** «Ahora no» (la primera vez): se recuerda en este navegador, por funnel y tab. La tab se queda con la sugerida. */
  const cerrarGaleria = (tab: TabFicha) => {
    if (galeria !== tab && funnelId != null) {
      const k = claveCerrada(funnelId, tab);
      try { window.localStorage.setItem(k, '1'); } catch { /* sin almacenamiento: vuelve a abrirse la próxima vez */ }
      setCerradas((s) => new Set(s).add(k));
    }
    soltarGaleria(tab);
  };
  /** «Usar»: lo que se mira (o, sin mirar nada, la de hoy, que queda elegida). */
  const usarGaleria = (tab: TabFicha) => {
    const v = vistas[tab] ?? { tipo: 'plantilla' as const, id: efectiva.plantillasTab[tab] };
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
        onVista={(v) => setVistas((x) => ({ ...x, [tab]: v }))} onUsar={() => usarGaleria(tab)} onCerrar={() => cerrarGaleria(tab)}
        primeraVez={galeria !== tab} registrado={(id) => !!entradaDe(id)} />
    ) : null;
    // ⚠️ LA ÉPICA ES DE LA TAB: el titular gigante es su nombre (el de General y MaKo Mobile v3), con más aire.
    const armador = (
      <>
        {!enEdicion && galeriaNodo}
        <div className={epico ? 'fb-tab fb-tab--epica' : 'fb-tab'}>
          {epico && <h2 className="fb-titular">{efectiva.nombres[tab]}</h2>}
          <Armador tab={tab} lista={ef.tabs[tab]} ctx={ctx} editando={enEdicion && !conGaleria} epico={epico}
            sel={sel?.tab === tab ? sel.indice : null} onSel={(i) => setSel(i == null ? null : { tab, indice: i })}
            onCambio={cambiar} onAgregar={(ancla) => setAgregar({ tab, ancla })} dispositivo={dispositivo} />
        </div>
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
              <IconoMenu nombre="archivo" size={15} /> Plantillas
            </button>
            <div className="fb-barra-fin">
              {!delLead.includes(tab) && <span className="fb-panel-linea" style={{ margin: 0, padding: '0 8px' }}>Este lead no ve esta tab.</span>}
              <SelectorDispositivo valor={dispositivo} onCambiar={setDispositivo} />
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
    // MaKo Analyst es un chat atado a este lead (punto 19 del 12/10/2026), con el análisis de las llamadas
    // debajo, plegado y sólo si hay algo. La `key` sigue siendo 'insights': viaja en los links (`?tab=`).
    {
      key: 'insights', label: 'MaKo Analyst',
      content: (
        <AnalystDelLead lead={lead} stages={stages} tienePlan={pagos.length > 0} inicial={data.insightGen}
          faltantesIniciales={data.faltantesInsight}
          llamadas={data.insights.map((i) => ({ tipo: i.tipo, fecha: i.started_at, url: i.share_url }))}
          alto={altoChat} />
      ),
    },
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
      onClick={() => { setEditando((v) => !v); setSel(null); setAgregar(null); }}>
      <IconoMenu nombre={enEdicion ? 'ver' : 'editar'} size={15} /> {enEdicion ? 'Ver' : 'Personalizar'}
    </button>
  ) : undefined;

  return (
    <div className={['fb', enEdicion && 'fb--editando', ...estilo.clases].filter(Boolean).join(' ')} style={estilo.vars as CSSProperties}>
      <style>{CSS_FICHA}</style>
      <LeadTabs initial={initialTab} onChange={onTab} irA={irA} fija={{ fondo: fondoTabs }} actions={boton} tabs={tabs}
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
    </div>
  );
}
