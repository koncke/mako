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
//
// 17/10/2026 — LAS TABS SON HOJAS, COMO EN EL DASHBOARD (feedback del 16/10, puntos 4, 5 y 9; Martín: «que el sistema
// para cambiar de hoja sea exactamente el mismo que tenemos en Dashboard y General, el desplegable del título con las
// secciones, entonces ahí mismo se puede crear otra hoja... que no salgan las opciones de "Toda la ficha" esos deben ser
// templates... En la vista de edición, elimina la sidebar»):
//   · LA FILA DE PESTAÑAS SE FUE: arriba va el nombre de la hoja abierta con su ▾ (../LeadTabs.tsx), a la altura del
//     nombre del lead (`sangria`, la pone cada puerta). El nombre se cambia ahí mismo, con un clic (sólo el admin).
//   · «NUEVA HOJA», primera en el desplegable: la galería de una hoja que todavía no existe (`nueva`); lo que se elige
//     la CREA (una hoja propia del funnel, lib/ficha/config.ts). Cada hoja tiene su ⋮: Templates, Duplicar, y en las
//     cuatro tabs «Volver a su template»; en las propias, Subir, Bajar y Eliminar (con Deshacer).
//   · SIN BARRA LATERAL: la plantilla de la tab y la de toda la ficha son TEMPLATES (la galería, con miniaturas que son
//     la tab de verdad con los datos de este lead, ./MiniaturaFicha.tsx), y los avisos van por «Obligatorio» en cada
//     bloque y «¿Ignorar siempre?» en «Datos sin marcar».
// =============================================================================

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { EstiloDeLaHoja } from './EstiloDeLaHoja';
import { csvDelLead, nombreArchivoLead } from './exportar-lead';
import { Dropdown } from '@/app/components/Dropdown';
import dynamic from 'next/dynamic';
import { deriveStageKey } from '@/lib/pipeline';
import { tieneEtapaDeReunion } from '@/lib/etapa-reunion';
import { muestraPagos, planEnLead } from '@/lib/muestra-pagos';
import { buildJourney } from '@/lib/journey';
import { marcaDato } from '@/lib/datos-aviso';
import type { StepId } from '@/lib/stage-requirements';
import type { Lead } from '@/lib/leads';
import { bloqueDef, esIdHoja, esTabFicha, NOMBRE_TAB, type BloqueId, type IdHoja, type LugarFicha, type TabFicha } from '@/lib/ficha/catalogo';
import { fichaEfectiva, lugarDe, TOPE_HOJAS, TOPE_NOMBRE_TAB, type BloquePuesto, type CambioFicha, type FichaEfectiva } from '@/lib/ficha/config';
import { plantillaTabPorId } from '@/lib/ficha/plantillas-tab';
import type { PlantillaId } from '@/lib/ficha/plantillas';
import { idDeHojaNueva } from '@/lib/ficha/api';
import { Senalar } from '@/app/_ui/Senalar';
import { Toast, useToast } from '@/app/_ui/Toast';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import type { LeadFullData } from '../../actions';
import { JourneyTimeline } from '../../JourneyTimeline';
import { LeadTabs, type LeadTabDef, type OpcionHoja } from '../LeadTabs';
import { AnalystDelLead } from '../AnalystDelLead';
import { MakoAnalystLead } from '../MakoAnalystLead';
import { Recorrido, useRecorrido } from '@/app/_ui/Recorrido';
import { imprimirFicha } from './imprimir-ficha';
import { PASOS_FICHA_EDICION, RECORRIDO_FICHA_EDICION } from './recorrido-ficha';
import { AuditHistory } from '../AuditHistory';
import { useRefrescarFicha } from '../ficha-cambio';
import { Armador } from './Armador';
import { AgregarBloque } from './AgregarBloque';
import { MiniaturaFicha } from './MiniaturaFicha';
import { cambiaAvisos, useFichaDelFunnel } from './useFichaDelFunnel';
import { SelectorDispositivo } from './SelectorDispositivo';
import { claveDeLugar, dispositivoVisto, estiloDeFicha, indiceDeOcurrencia, lugarDeClave, puedePersonalizar, tabDelDato, type DispositivoFicha } from './armar';
import { entradaDe } from './registro';
import { CSS_FICHA } from './ficha-css';
import { cambioDeNueva, cambioDeVista, fichaConVista, type VistaGaleria } from './galeria';
import type { CtxFicha } from './tipos';

// La galería sólo la ve el admin (desde «Templates»): su código (la caja de la casa, el micrófono) no viaja con la
// ficha de todos, y no hace falta en el server.
const GaleriaTab = dynamic(() => import('./GaleriaTab').then((m) => m.GaleriaTab), { ssr: false });

const MONO = "'Geist Mono', monospace";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };

const enUnTexto = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement && !!t.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]');

export function FichaPorBloques({ data, parchear, altoChat, initialTab, onTab, fondoTabs, pedido, onNoEsta, sangria }: {
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
  /** Cuánto se corre el título de la hoja para quedar a la altura del nombre del lead (punto 9; un largo de CSS). */
  sangria?: string;
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
  const [sel, setSel] = useState<{ tab: LugarFicha; indice: number } | null>(null);
  const [agregar, setAgregar] = useState<{ tab: LugarFicha; ancla: HTMLElement } | null>(null);
  // LA GALERÍA (./GaleriaTab.tsx): la tab (o la hoja propia) donde se abrió con «Templates» y lo que se mira en cada una.
  const [galeria, setGaleria] = useState<LugarFicha | null>(null);
  const [vistas, setVistas] = useState<Partial<Record<string, VistaGaleria>>>({});
  // «NUEVA HOJA»: la clave que va a tener (la elige la pantalla, así va a ella en el acto) y la hoja a la que se vuelve
  // si se cierra sin crearla. `ultima` es la última hoja elegida en el desplegable.
  const [nueva, setNueva] = useState<{ id: IdHoja; volver: string } | null>(null);
  const [ultima, setUltima] = useState<string>(initialTab ?? 'resumen');

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
  // ⚠️ Y DESDE EL 17/10/2026 EL PANEL TIENE DOS MODOS: «analizar» (el AI Analyst del «⋯») y «editar», que se abre SOLO al
  // apretar «Editar» (Martín: «Al momento de EDITAR, también debería salir automáticamente este modal, pero ahora ya no
  // para analizar al lead, sino para editar la vista»). Es el mismo chat, con la hoja abierta atada (../MakoAnalystLead).
  const [panel, setPanel] = useState<null | 'analizar' | 'editar'>(initialTab === 'insights' ? 'analizar' : null);
  // La hoja que se está mirando (la clave de `?tab=`), para el chat de edición: la avisa LeadTabs.
  const [activa, setActiva] = useState<string>(initialTab ?? 'resumen');
  const raizRef = useRef<HTMLDivElement>(null);
  const [senal, setSenal] = useState<{ id: StepId; label: string } | null>(null);
  const ctx: CtxFicha = {
    data, lead, stages, etapa, hoy,
    rol: data.rol ?? 'otro', esAdmin: data.rol === 'admin', verPrivado: !!data.verPrivado,
    releer: refrescar,
    parchear: parchear ?? (() => refrescar()),
    irATab: (clave) => { if (clave === 'insights') { setPanel('analizar'); return; } setIrA({ key: clave, n: Date.now() }); },
    solucionar: (paso) => solucionar(paso, Date.now()),
  };
  function solucionar(paso: StepId, n: number) {
    setEditando(false);
    // Primero las tabs de siempre del lead; después las hojas propias (lib/ficha/config.ts: son el último lugar).
    const lugares: LugarFicha[] = [...delLead, ...efectiva.hojas.map((h) => h.id)];
    const t = tabDelDato(paso, lugares, {
      listaDe: (l) => lugarDe(efectiva, l).bloques, reglasDe: entradaDe, vacio: (p, r) => !!r.estaVacio?.(ctx, p), verPrivado: ctx.verPrivado,
    });
    if (!t) { onNoEsta(); return; }
    const d = [...(data.datos?.avisar ?? []), ...(data.datos?.ocultos ?? [])].find((x) => x.id === paso);
    setIrA({ key: claveDeLugar(t), n });
    setSenal({ id: paso, label: d?.label ?? 'este dato' });
  }

  // Un cambio de la ficha, con la selección que le sigue: el bloque movido sigue elegido, el recién puesto
  // queda elegido, y lo que cambia la lista entera la suelta.
  const cambiar = useCallback((c: CambioFicha) => {
    if (c.op === 'mover') {
      setSel((s) => {
        if (!s || s.tab !== c.tab) return s;
        const desde = indiceDeOcurrencia(lugarDe(efectiva, c.tab).bloques, c.bloque, c.n ?? 1);
        return desde === s.indice ? { tab: c.tab, indice: c.lugar - 1 } : null;
      });
    } else if (c.op === 'poner') {
      setSel({ tab: c.tab, indice: c.lugar ? c.lugar - 1 : lugarDe(efectiva, c.tab).bloques.length });
    } else if (c.op === 'quitar' || c.op === 'lista' || c.op === 'volver' || c.op === 'plantilla' || c.op === 'armar' || c.op === 'restaurar' || c.op === 'quitar-hoja') {
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
        const lista = lugarDe(efectiva, sel.tab).bloques;
        const p = lista[sel.indice];
        const def = p && bloqueDef(p.id);
        if (!p || !def || (!def.quitable && def.tab === sel.tab)) return;
        e.preventDefault();
        const n = lista.slice(0, sel.indice + 1).filter((x) => x.id === p.id).length;
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
  const galeriaAbierta = (tab: LugarFicha): boolean => !!ff.ficha && puede && galeria === tab;
  const soltarGaleria = (tab: LugarFicha) => {
    setGaleria((g) => (g === tab ? null : g));
    setVistas((v) => { const n = { ...v }; delete n[tab]; return n; });
  };
  /** «Usar»: lo que se mira (o, sin mirar nada, la de hoy, que queda elegida). */
  const usarGaleria = (tab: LugarFicha) => {
    const v = vistas[tab] ?? (esTabFicha(tab) ? { tipo: 'plantilla' as const, id: efectiva.plantillasTab[tab] } : null);
    if (v) cambiar(cambioDeVista(v, tab));
    soltarGaleria(tab);
  };
  /** Tocar una plantilla de la galería: queda elegida y la galería se cierra (sin vista previa, 16/10/2026). */
  const elegirGaleria = (tab: LugarFicha, v: VistaGaleria) => {
    cambiar(cambioDeVista(v, tab));
    soltarGaleria(tab);
  };
  /** «Templates» desde el ⋮ de una hoja: su galería, en su lugar. */
  const abrirTemplates = (l: LugarFicha) => {
    setSel(null); setAgregar(null); setGaleria(l);
    setIrA({ key: claveDeLugar(l), n: Date.now() });
  };
  /** Toda la ficha, como templates (la galería de una de las cuatro tabs): otra plantilla, la de MaKo, o volver. */
  const todaLaFicha = (p: PlantillaId | null | 'volver') => {
    cambiar(p === 'volver' ? { op: 'volver' } : { op: 'plantilla', plantilla: p });
    setGaleria(null); setVistas({});
  };

  // ── «Nueva hoja» y lo que se le hace a una hoja desde el desplegable ─────────────────────────
  const abrirNueva = () => {
    const id = idDeHojaNueva();
    setSel(null); setAgregar(null); setGaleria(null);
    setNueva({ id, volver: ultima });
    setIrA({ key: id, n: Date.now() });
  };
  const cerrarNueva = () => {
    if (!nueva) return;
    setVistas((v) => { const n = { ...v }; delete n[nueva.id]; return n; });
    setNueva(null);
    setIrA({ key: nueva.volver, n: Date.now() });
  };
  const cerrarSinVolver = () => {
    if (!nueva) return;
    setVistas((v) => { const n = { ...v }; delete n[nueva.id]; return n; });
    setNueva(null);
  };
  /** Lo que se eligió en «Nueva hoja» la CREA con la clave que ya tenía: la pantalla sigue parada en ella. */
  const crearHoja = (v: VistaGaleria) => {
    if (!nueva) return;
    cambiar(cambioDeNueva(v, nueva.id));
    setVistas((x) => { const n = { ...x }; delete n[nueva.id]; return n; });
    setUltima(nueva.id);
    setNueva(null);
  };
  /** Duplicar una tab o una hoja: una hoja propia nueva con sus bloques, su épica y su nombre (numerado: «Resumen 2»). */
  const duplicar = (l: LugarFicha) => {
    const x = lugarDe(efectiva, l);
    const id = idDeHojaNueva();
    cambiar({ op: 'hoja', hoja: id, nombre: x.nombre, bloques: x.bloques, epica: x.epica });
    setUltima(id);
    setIrA({ key: id, n: Date.now() });
  };
  const borrarHoja = (id: IdHoja) => {
    cambiar({ op: 'quitar-hoja', hoja: id });
    show('Hoja eliminada', () => ff.deshacer());
  };
  /** «Volver a su template» de una tab: su lista, su nombre o su épica difieren de los de su plantilla. */
  const tabTocada = (t: TabFicha): boolean =>
    efectiva.tocadas.includes(t) || efectiva.nombres[t] !== NOMBRE_TAB[t] || efectiva.epica[t] !== !!plantillaTabPorId(efectiva.plantillasTab[t])?.epico;
  /** El ⋮ de una hoja en el desplegable del título (sólo quien personaliza). */
  const opcionesDe = (l: LugarFicha): OpcionHoja[] | undefined => {
    if (!puede || !ff.ficha) return undefined;
    const llenas = efectiva.hojas.length >= TOPE_HOJAS;
    const comunes: OpcionHoja[] = [
      { texto: 'Templates', icono: 'archivo', onElegir: () => abrirTemplates(l) },
      { texto: 'Duplicar', icono: 'duplicar', onElegir: () => duplicar(l), deshabilitada: llenas },
    ];
    if (esTabFicha(l)) return [...comunes, { texto: 'Volver a su template', icono: 'restaurar', onElegir: () => cambiar({ op: 'volver', tab: l }), deshabilitada: !tabTocada(l) }];
    const i = efectiva.hojas.findIndex((h) => h.id === l);
    return [
      ...comunes,
      { texto: 'Subir', icono: 'arriba', onElegir: () => cambiar({ op: 'mover-hoja', hoja: l, lugar: i }), deshabilitada: i <= 0 },
      { texto: 'Bajar', icono: 'abajo', onElegir: () => cambiar({ op: 'mover-hoja', hoja: l, lugar: i + 2 }), deshabilitada: i >= efectiva.hojas.length - 1 },
      { texto: 'Eliminar', icono: 'borrar', onElegir: () => borrarHoja(l), peligro: true },
    ];
  };

  const ponerBloque = (tab: LugarFicha, id: BloqueId) => {
    setAgregar(null);
    const lugar = sel?.tab === tab ? sel.indice + 2 : undefined;
    cambiar({ op: 'poner', tab, bloque: id, ...(lugar ? { lugar } : {}) });
  };

  /** La tab dibujada en chico con los datos de este lead: la miniatura de una plantilla (./MiniaturaFicha.tsx). */
  const nada = () => {};
  const miniaturaEn = (l: LugarFicha) => (lista: BloquePuesto[], epico: boolean) => (
    <MiniaturaFicha>
      <div className={epico ? 'fb-tab fb-tab--epica' : 'fb-tab'}>
        <Armador tab={l} lista={lista} ctx={ctx} editando={false} epico={epico} sel={null} onSel={nada} onCambio={nada} onAgregar={nada} dispositivo="escritorio" />
      </div>
    </MiniaturaFicha>
  );

  // ⚠️ «ESTILO DE LA HOJA» (./EstiloDeLaHoja.tsx) LO ESTÁ VOLVIENDO PIEZA COMPARTIDA EL CHAT DASHBOARD (17/10/2026) y
  // todavía habla de las cuatro tabs: en una hoja propia se le pasa la épica de la hoja en el lugar del Resumen y su
  // cambio se traduce a la hoja. Cuando acepte un lugar, este puente se va (docs/relevo/crm.md lo anota).
  const estiloDe = (l: LugarFicha): { ef: FichaEfectiva; tab: TabFicha; onCambio: (c: CambioFicha) => void } => esTabFicha(l)
    ? { ef: efectiva, tab: l, onCambio: cambiar }
    : { ef: { ...efectiva, epica: { ...efectiva.epica, resumen: lugarDe(efectiva, l).epica } }, tab: 'resumen', onCambio: (c) => cambiar(c.op === 'epica' ? { ...c, tab: l } : c) };

  const contenidoDe = (tab: LugarFicha): ReactNode => {
    const conGaleria = galeriaAbierta(tab) && !!ff.ficha;
    const vista = conGaleria ? vistas[tab] ?? null : null;
    // Mirando una plantilla de la galería, la tab de abajo es la que QUEDARÍA: el mismo motor que guarda, sin guardar.
    const ef = vista && ff.ficha ? fichaConVista(ff.ficha, vista, tab) : efectiva;
    const { bloques, epica: epico } = lugarDe(ef, tab);
    const nombre = lugarDe(efectiva, tab).nombre;
    const galeriaNodo = conGaleria && ff.ficha ? (
      <GaleriaTab tab={tab} ficha={ff.ficha} nombreTab={nombre} vista={vista}
        onVista={(v) => setVistas((x) => ({ ...x, [tab]: v }))} onElegir={(v) => elegirGaleria(tab, v)} onUsar={() => usarGaleria(tab)} onCerrar={() => soltarGaleria(tab)}
        registrado={(id) => !!entradaDe(id)} miniatura={miniaturaEn(tab)} onTodaLaFicha={esTabFicha(tab) ? todaLaFicha : undefined} />
    ) : null;
    // ⚠️ CON LA GALERÍA ABIERTA Y NADA PARA MIRAR, ABAJO NO VA NADA (16/10/2026): antes se dibujaba la tab entera con
    // la sugerida y un «Usar la sugerida», y Martín: «Es confuso eso». Abajo sólo se mira lo que armó MaKo.
    const sinVistaPrevia = conGaleria && !vista;
    // ⚠️ LA ÉPICA ES DE LA TAB: el titular gigante es su nombre (el de General y MaKo Mobile v3), con más aire.
    const armador = (
      <>
        {!enEdicion && galeriaNodo}
        {!sinVistaPrevia && <div className={epico ? 'fb-tab fb-tab--epica' : 'fb-tab'}>
          {epico && <h2 className="fb-titular">{nombre}</h2>}
          <Armador tab={tab} lista={bloques} ctx={ctx} editando={enEdicion && !conGaleria} epico={epico}
            sel={sel?.tab === tab ? sel.indice : null} onSel={(i) => setSel(i == null ? null : { tab, indice: i })}
            onCambio={cambiar} onAgregar={(ancla) => setAgregar({ tab, ancla })}
            avisaDe={(p) => efectiva.avisos.find((a) => a.id === p)?.avisa ?? true} dispositivo={dispositivo} />
        </div>}
      </>
    );
    if (!enEdicion || !ff.ficha) return armador;
    const estilo = estiloDe(tab);
    return (
      <div className="fb-edicion">
        <div style={{ minWidth: 0 }}>
          <div className="fb-barra" role="toolbar" aria-label={`Personalizar ${nombre}`}>
            <button type="button" className="fb-herr" onClick={ff.deshacer} disabled={!ff.puedeDeshacer || ff.guardando} title="Deshacer (Ctrl+Z)">
              <IconoMenu nombre="restaurar" size={15} /> Deshacer
            </button>
            <span className="fb-sep" aria-hidden />
            <button type="button" className="fb-herr" aria-haspopup="menu" aria-expanded={agregar?.tab === tab} data-recorrido="fb-agregar"
              onClick={(e) => { const ancla = e.currentTarget; setAgregar((a) => (a?.tab === tab ? null : { tab, ancla })); }}>
              <IconoMenu nombre="agregar" size={15} /> Agregar bloque <span aria-hidden>▾</span>
            </button>
            <button type="button" className="fb-herr" aria-pressed={conGaleria} data-recorrido="fb-templates" onClick={() => { setSel(null); setAgregar(null); if (conGaleria) soltarGaleria(tab); else setGaleria(tab); }}>
              {/* «Templates» desde el 16/10/2026 («"Plantilla" ya está en la topbar de edición, y debería llamarse
                  "Templates"», Martín). */}
              <IconoMenu nombre="archivo" size={15} /> Templates
            </button>
            <div className="fb-barra-fin">
              {esTabFicha(tab) && !delLead.includes(tab) && <span className="fb-barra-linea">Este lead no ve esta tab.</span>}
              <SelectorDispositivo valor={dispositivo} onCambiar={setDispositivo} />
              <span data-recorrido="fb-estilo" style={{ display: 'inline-flex' }}><EstiloDeLaHoja ef={estilo.ef} tab={estilo.tab} onCambio={estilo.onCambio} /></span>
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
      </div>
    );
  };

  /** «Nueva hoja»: la galería de una hoja que todavía no existe; abajo, lo que armó MaKo con la caja (para «Crear la hoja»). */
  const contenidoNueva = (id: IdHoja): ReactNode => {
    if (!ff.ficha) return null;
    const vista = vistas[id] ?? null;
    return (
      <>
        <GaleriaTab tab={id} ficha={ff.ficha} nombreTab="la hoja nueva" vista={vista} nueva
          onVista={(v) => setVistas((x) => ({ ...x, [id]: v }))} onElegir={crearHoja} onUsar={() => { if (vista) crearHoja(vista); }} onCerrar={cerrarNueva}
          registrado={(b) => !!entradaDe(b)} miniatura={miniaturaEn(id)} />
        {vista?.tipo === 'mako' && (
          <div className={vista.epica ? 'fb-tab fb-tab--epica' : 'fb-tab'}>
            <Armador tab={id} lista={vista.bloques} ctx={ctx} editando={false} epico={vista.epica} sel={null} onSel={nada} onCambio={nada} onAgregar={nada} dispositivo="escritorio" />
          </div>
        )}
      </>
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

  // El nombre de cada hoja es el de la ficha del funnel; quien personaliza lo cambia en el título (la clave no cambia).
  const puedeGuardar = puede && !!ff.ficha;
  const deTab = (l: LugarFicha): LeadTabDef => ({
    key: claveDeLugar(l), label: lugarDe(efectiva, l).nombre, content: contenidoDe(l), renombrable: puedeGuardar, opciones: opcionesDe(l),
  });
  const tabs: LeadTabDef[] = [
    deTab('resumen'),
    // ⚠️ EL ORDEN DE LAS TABS LO DECIDIÓ MARTÍN (05/10 y 27/09/2026): Tracking, Reuniones y Pagos, y después
    // MaKo Analyst pegado al Historial (las dos contestan «qué pasó con esta persona»).
    ...(tabsBloques.includes('tracking') ? [deTab('tracking')] : []),
    ...(tabsBloques.includes('reuniones') ? [deTab('reuniones')] : []),
    ...(tabsBloques.includes('pagos') ? [{ ...deTab('pagos'), badge: pagos.filter((p) => !p.pagado).length }] : []),
    // Las hojas propias, después de las cuatro y antes del Historial; y la que se está creando, al final.
    ...efectiva.hojas.map((h) => deTab(h.id)),
    ...(nueva && !efectiva.hojas.some((h) => h.id === nueva.id) ? [{ key: nueva.id, label: 'Nueva hoja', content: contenidoNueva(nueva.id) }] : []),
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
  /** Entrar o salir de «Editar». Entrar abre el chat de MaKo en modo edición; salir lo cierra (si era ese). */
  const alternarEdicion = (entrar: boolean) => {
    setEditando(entrar); setSel(null); setAgregar(null); setGaleria(null); setVistas({});
    setPanel((p) => (entrar ? 'editar' : p === 'editar' ? null : p));
  };
  const guia = useRecorrido(RECORRIDO_FICHA_EDICION, { autoabrir: enEdicion });
  const boton = puede ? (
    <button type="button" className="fb-personalizar" aria-pressed={enEdicion} data-recorrido="fb-editar"
      title={enEdicion ? 'Volver a la ficha' : 'Armar la ficha de este funnel'}
      onClick={() => alternarEdicion(!editando)}>
      {/* «Editar» en azul, como el Dashboard («Obvio que el botón de "Personalizar" debe eliminarse... Que sea igual
          que en dashboard o general... El botón en azul de "Editar"», Martín, 16/10/2026). */}
      <IconoMenu nombre={enEdicion ? 'ver' : 'editar'} size={15} /> {enEdicion ? 'Ver' : 'Editar'}
    </button>
  ) : undefined;

  // El «⋯» al lado de «Editar», como el del Dashboard. Lo ve todo el que ve la ficha (el AI Analyst era una pestaña
  // de todos); «Editar» sigue siendo sólo del admin.
  /** «Exportar (CSV)»: los datos de este lead, en dos columnas (./exportar-lead.ts). */
  const exportarCsv = () => {
    const csv = csvDelLead([
      ['Lead', `#${lead.id}`], ['Nombre', lead.nombre], ['Email', lead.email], ['Teléfono', lead.telefono],
      ['Empresa', lead.empresa], ['Web', lead.web], ['Instagram', lead.instagram],
      ['Etapa', stages.find((x) => x.key === etapa)?.label ?? etapa], ['Campaña', data.campana?.texto], ['Anuncio', data.adNombre],
      ['Creado', lead.created_at?.slice(0, 10)],
    ]);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = nombreArchivoLead(lead.id, lead.nombre);
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    show('CSV descargado');
  };
  const copiarLink = () => {
    const ws = new URLSearchParams(window.location.search).get('ws');
    const url = `${window.location.origin}/crm/${lead.id}${ws ? `?ws=${encodeURIComponent(ws)}` : ''}`;
    void navigator.clipboard?.writeText(url).then(() => show('Link copiado'), () => show('No se pudo copiar', undefined, 'bad'));
  };
  /** «Exportar (PDF)»: la ficha como se ve, en el diálogo de imprimir (./imprimir-ficha.ts). */
  const exportarPdf = () => {
    const r = raizRef.current;
    if (!r) return;
    const caja = r.closest<HTMLElement>('[data-ficha-ruta], [role="dialog"]') ?? r;
    void imprimirFicha(caja, `Ficha de ${lead.nombre || `#${lead.id}`}`);
  };
  const menu = (
    <Dropdown value="" placeholder="⋯" align="right" resetAfterSelect sinFlecha ariaLabel="Más opciones de la ficha"
      buttonStyle={{ width: 32, height: 32, padding: 0, justifyContent: 'center', border: '1px solid var(--border-strong)', borderRadius: 999, background: 'var(--surface)', color: 'var(--dim)', fontSize: 16, lineHeight: 1 }}
      options={[
        { value: 'analyst', label: 'AI Analyst', icono: 'mako' },
        { value: 'link', label: 'Copiar el link', icono: 'link' },
        { value: 'csv', label: 'Exportar (CSV)', icono: 'descargar' },
        { value: 'pdf', label: 'Exportar (PDF)', icono: 'descargar' },
        ...(puede ? [{ value: 'guia', label: 'Guía de edición', icono: 'pregunta' as const }] : []),
      ]}
      onChange={(v) => {
        if (v === 'analyst') setPanel('analizar');
        else if (v === 'link') copiarLink();
        else if (v === 'csv') exportarCsv();
        else if (v === 'pdf') exportarPdf();
        else if (v === 'guia') { if (!enEdicion) alternarEdicion(true); guia.reabrir(); }
      }} />
  );
  const acciones = <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{boton}{menu}</span>;

  // El panel del AI Analyst: aparte de la ficha (por portal), a la izquierda, y la ficha se corre a la derecha para
  // dejarle lugar (el `<style>` vive sólo mientras está abierto). El clic adentro no cierra la ficha: el evento sube
  // por el árbol de React hasta la caja de la ficha, que lo frena.
  // Editando, el chat sabe en qué hoja está (la clave de la API y su nombre); en el Historial, ninguna.
  const lugarActivo = lugarDeClave(activa, efectiva.hojas);
  const edicion = panel === 'editar' && lugarActivo ? { tab: lugarActivo, nombre: lugarDe(efectiva, lugarActivo).nombre } : null;
  const panelAnalyst = panel && typeof document !== 'undefined' ? createPortal(
    <aside aria-label={panel === 'editar' ? 'Editar la ficha con MaKo' : `AI Analyst de ${lead.nombre || 'este lead'}`} onClick={(e) => e.stopPropagation()} data-recorrido="fb-mako"
      style={{ position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 90, width: 'var(--fb-analyst-ancho)', display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderRight: '1px solid var(--border)', boxShadow: '12px 0 32px rgba(18,21,27,.18)' }}>
      {/* ⚠️ EL ANCHO SIGUE A LA PANTALLA (recorrido del 17/10/2026): con 420 fijos, a 1024 la ficha quedaba en ~560 px y
          se cortaban los botones de la calificación. Un tercio de la pantalla, entre 320 y 420; en un teléfono, entero. */}
      <style>{':root{--fb-analyst-ancho:min(420px, max(320px, 32vw))}@media (max-width:720px){:root{--fb-analyst-ancho:100vw}}[data-ficha-overlay]{padding-left:calc(var(--fb-analyst-ancho) + 20px)!important}[data-ficha-ruta]{padding-left:var(--fb-analyst-ancho)}'}</style>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--border)', borderTop: '3px solid var(--mako)' }}>
        <IconoMenu nombre="mako" size={18} />
        <strong style={{ flex: 1, fontSize: 15, color: 'var(--ink)' }}>{panel === 'editar' ? 'Editar con MaKo' : 'AI Analyst'}</strong>
        <button type="button" onClick={() => setPanel(null)} title="Cerrar" aria-label="Cerrar el AI Analyst"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, border: 'none', borderRadius: 8, background: 'none', color: 'var(--dim)', cursor: 'pointer', padding: 0 }}>
          <IconoMenu nombre="cerrar" size={16} />
        </button>
      </header>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 12px' }}>
        {panel === 'editar' ? (
          <div style={{ height: 'calc(100vh - 90px)', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <MakoAnalystLead leadId={lead.id} nombre={lead.nombre ?? ''} edicion={edicion} />
          </div>
        ) : (
          <AnalystDelLead lead={lead} stages={stages} tienePlan={pagos.length > 0} inicial={data.insightGen}
            faltantesIniciales={data.faltantesInsight}
            llamadas={data.insights.map((i) => ({ tipo: i.tipo, fecha: i.started_at, url: i.share_url }))}
            alto="calc(100vh - 90px)" />
        )}
      </div>
    </aside>,
    document.body,
  ) : null;

  return (
    <div ref={raizRef} className={['fb', enEdicion && 'fb--editando', ...estilo.clases].filter(Boolean).join(' ')} style={estilo.vars as CSSProperties}>
      <style>{CSS_FICHA}</style>
      <LeadTabs initial={initialTab} irA={irA} fija={{ fondo: fondoTabs }} actions={acciones} tabs={tabs} sangria={sangria} onActiva={setActiva}
        onChange={(key) => { setUltima(key); if (nueva && key !== nueva.id) cerrarSinVolver(); onTab?.(key); }}
        onNueva={puedeGuardar && efectiva.hojas.length < TOPE_HOJAS ? abrirNueva : undefined}
        maxNombre={TOPE_NOMBRE_TAB} onRenombrar={puedeGuardar ? (key, nombre) => {
          const l = lugarDeClave(key, efectiva.hojas);
          if (!l) return;
          // Una hoja propia no se queda sin nombre; una de las cuatro vuelve al de siempre.
          if (esIdHoja(l) && !nombre) { show('La hoja necesita un nombre', undefined, 'bad'); return; }
          cambiar({ op: 'nombre', tab: l, nombre: nombre || null });
        } : undefined} />
      {senal && (
        <Senalar objetivo={marcaDato(senal.id)} texto={`Falta: ${senal.label}`}
          onCerrar={() => setSenal(null)} onNoEsta={onNoEsta} />
      )}
      {agregar && (
        <AgregarBloque ancla={agregar.ancla} tab={agregar.tab} nombre={lugarDe(efectiva, agregar.tab).nombre} lista={lugarDe(efectiva, agregar.tab).bloques} verPrivado={ctx.verPrivado}
          onElegir={(id) => ponerBloque(agregar.tab, id)} onCerrar={() => setAgregar(null)} />
      )}
      <Toast state={toast} onClose={clear} />
      {panelAnalyst}
      {puede && <Recorrido id={RECORRIDO_FICHA_EDICION} pasos={PASOS_FICHA_EDICION} abierto={guia.abierto} onCerrar={guia.onCerrar} />}
    </div>
  );
}
