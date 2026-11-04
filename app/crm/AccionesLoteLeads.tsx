'use client';

// =============================================================================
// AccionesLoteLeads — la barra que aparece al tildar leads (tabla y Kanban)
// =============================================================================
// Pedido de Martin el 05/10/2026, textual: «Muy importante que implementes las
// acciones en LOTE, tanto para la vista de tablas como kanban... Copia todo del
// plan. Y piensa que acciones en lote valdria la pena».
//
// ⚠️ POR QUE NO SE IMPORTA `AccionesLote` DEL PLAN. Se midio antes de escribir:
// `BarraLote` (app/plan/board/AccionesLote.tsx) es generica sobre la ENTIDAD y ya
// sirve a dos (tareas y proyectos), asi que la tentacion es pasarle una tercera
// configuracion. No se puede: su firma pide un `Board` y adentro usa
// `board.showUndo`, `board.aplicarCascadaManual`, `board.soltarCandadoManual`,
// `board.labels`, `board.labelById` y `board.repo`. Un lead no tiene board, ni
// score, ni recurrencia, ni proyecto — o sea que de las seis acciones de aquella
// barra, CINCO se apagarian y la sexta (borrar) es la unica compartida.
//
// Lo que SI se comparte, que es lo que hace que las dos se vean y se usen igual:
//   · la clase `.mk-icon-btn` con su `data-tone`, que es donde vive el aspecto;
//   · el `Dropdown` de `app/components/Dropdown` —el mismo control, con el mismo
//     `resetAfterSelect` de un desplegable de ACCION—;
//   · el molde de TRES RANURAS (`flex: 1` en los dos costados y el grupo del medio
//     en `flex: none`), que es lo unico que deja el centro en el centro real;
//   · la casilla marcada de la izquierda que LIMPIA, y el numero al lado con
//     `role="status"`. «El boton de quitar seleccion no debe existir, solamente el
//     check en el mismo lugar, a la izquierda del todo, marcado» (25/09/2026).
// Copiar el COMPORTAMIENTO y compartir el ASPECTO es lo contrario de duplicar la
// pieza: lo que divergeria es el CSS, y el CSS es el que esta compartido.
//
// ─────────────────────────────────────────────────────────────────────────────
// QUE ACCIONES ENTRAN, Y POR QUE ESTAS CUATRO
//
// El criterio no fue «que se puede escribir» sino «que se hace HOY abriendo N
// fichas de a una». Las cuatro salen de eso:
//
//   · ETAPA. Lejos la mas util: mover doce a Nutricion, descartar veinte. Es el
//     gesto que el Kanban ya ofrece de a uno arrastrando.
//   · CLOSER y SETTER. Es el dato que mas se repite en un lote de leads y ya tenia
//     su camino en lote (`BulkHigiene`), pero SOLO para rellenar vacios.
//   · PRODUCTO. ⚠️ AGREGA, NO MUEVE (desde el 06/10/2026). Nacio llamando a
//     `moverLeadsAFunnelAction`, que le cambiaba la casa a cada lead y lo sacaba del
//     tablero donde estaba; Martin: «No se debe "Mover" se debe agregar al otro
//     producto». Ahora es `agregarLoteAProductoAction` (mig 0207): una fila por lead
//     en la etapa de entrada de ese producto, la casa intacta. Y como sumar no saca a
//     nadie de ningun lado, actua AL TOQUE y deja UN Deshacer para el lote entero
//     (el molde de Customer Success), que borra solo las filas que este lote creo.
//
//   · ETIQUETA (mig 0224, 08/10/2026). Pone una etiqueta del CRM a los tildados, AL TOQUE y
//     con UN Deshacer para el lote (como producto: suma y se revierte). ⚠️ EN LOTE NO DISPARA
//     LAS AUTOMATIZACIONES DE ESA ETIQUETA NI MUEVE DE ETAPA (lib/etiquetas-motor.ts, el molde
//     de ManyChat): con una secuencia colgada de «Seguimiento», ponerla a 200 leads seria el
//     envio masivo que el parrafo de abajo deja afuera, entrando por otra puerta.
//
//   · COMPLETAR (24/10/2026). «Desde mi WhatsApp» y «Datos de empresa» sobre los tildados. Martín: «¿cómo comienzo a
//     scrapear los datos de mis leads?... Eso debería poder hacerlo en lote, con el multiple check, no sólo cuando cargo
//     nuevos de grupos». Vivían sólo en el modal de traer de un grupo (siguen ahí); el lugar principal es éste. Sólo escriben
//     lo vacío (el nombre donde está el número, la empresa y los datos de empresa donde no hay nada), no crean, no mueven y
//     no le mandan nada a nadie. Tardan minutos: corren con su avance y un «Parar», y la pregunta antes dice cuántos y
//     cuánto. «Datos de empresa» gasta la red de la línea: tope por día, sin tope por corrida desde el 25/10 (f14; app/crm/grupo-wa-server.ts). Sólo el
//     admin (`puedeCompletar`), como en el grupo. Las máquinas, compartidas con el modal: app/crm/enriquecer-cliente.ts.
//
//   · PASAR A OTRO FUNNEL (28/10/2026, ticket #21 de Leila: «limpiar la casilla de contacto nuevo de lidermente y pasarlo a
//     Funnel general»). Va en el MISMO desplegable «Funnel», debajo de los de agregar, y abre su propia pregunta
//     (app/crm/PasarAOtroFunnel.tsx): a diferencia de agregar, SACA del funnel que se mira. No es el «mover» que se borró el
//     06/10 (ver lib/lead-funnel.ts, `pasarAOtroFunnel`).
//   · ELIMINAR va a la PAPELERA de 30 días desde el mismo día (ticket #22, mig 0340): el aviso trae su «Deshacer», y la
//     pantalla «Papelera» (menú de funnels) los devuelve tal cual. Descalificar o perder en bloque pide UN motivo para todos.
//   · MANDAR MENSAJE (la difusión de Automations, `onMandarMensaje`): la barra sólo pone la selección; la hoja es de ellos.
//
// Y una que se dejo AFUERA a proposito: meter los seleccionados en una secuencia
// de nutricion. Esa es la unica de la lista que MANDA MENSAJES, y la linea de
// WhatsApp del chatbot es la NO OFICIAL: lo que la protege es el ritmo, no una
// API (ver AGENTS.md). Un boton que dispara N conversaciones de una no es una
// accion en lote mas — necesita su propia pantalla, con el ritmo a la vista.
//
// ⚠️ TODA ACCION QUE NO SE DESHACE PREGUNTA ANTES, NOMBRANDO EL NUMERO. No es
// ceremonia: la barra escribe sobre filas que pueden no estar todas a la vista (en el
// Kanban se tilda en cuatro columnas y se scrollea), y etapa, closer/setter y borrar
// no tienen deshacer en lote. Es el molde que ya usa `BulkHigiene` en el propio
// CrmBoard («Asignar Setter "Mauricio" a 12 leads»). PRODUCTO es la excepcion porque
// SI tiene deshacer (ver arriba): preguntar ahi seria friccion sobre algo reversible.
// =============================================================================

import { useEffect, useEffectEvent, useImperativeHandle, useRef, useState, useTransition } from 'react';
import type { CSSProperties, Ref } from 'react';
import { Confirm, SANS, MONO } from '@/app/_ui';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { IconoFunnel, IconoMenu } from '@/app/_ui/iconos-menu';
import { preguntaDeFrenar } from './automatizacion-lead';
import { frenarLeadsEnAutomatizacionesAction } from '@/app/automations/automatizaciones-del-lead-actions';
import { Dropdown } from '@/app/components/Dropdown';
import type { Stage } from '@/lib/pipeline';
import type { MiembroEquipo } from './actions';
import {
  moverLeadsDeEtapaAction,
  eliminarLeadsAction,
  bulkFillLeadFieldAction,
} from './actions';
import { agregarLoteAProductoAction, quitarLoteDeProductoAction } from './lead-funnel-actions';
import { TANDA_LOTE, colaDelAviso, correrEnTandas } from './lote-tandas';
import { TANDA_AGREGAR, enTandas } from './traer-seleccion';
import { TANDA_ETIQUETAS_LOTE } from '@/lib/etiquetas-reglas';
import { SelectorEtiqueta, type Etiqueta } from '@/app/_components/etiquetas-cliente';
import { TOPE_LOTE_COMPLETAR, TOPE_PERFILES_DIA, fichaLimpia, minutosDePerfiles, type FichaWa } from '@/lib/grupo-wa-reglas';
import { VERSION_FICHAS, alPararExtraccion, avisarExtraccion, enfocarWhatsappWeb, motivoDeFichas, nuevoIdExtraccion, pedirFichasDeWhatsappWeb, perfilesEnTandas } from '@/lib/wa-fichas-cliente';
import { lineaDeVersion } from '@/lib/extension-tienda';
import { useExtensionFichas } from './usar-extension-fichas';
import { completarFichasDeLeadsAction, completarPerfilesDeLeadsAction, pedidosDeFichasAction } from './enriquecer-actions';
import { correrPerfiles, gruposEnWhatsappDichos, guardarFichasEnTandas, preguntaDePerfiles, resumenDeFichas, resumenDePerfiles } from './enriquecer-cliente';
import { miles } from './traer-seleccion';
import { recuperarLeadsAction } from './actions';
import { preguntaDePapelera } from '@/lib/leads-papelera-reglas';
import { avisarPapelera } from './PapeleraLeads';
import { PasarAOtroFunnel } from './PasarAOtroFunnel';
import { motivoFinalDe, motivosDeSalida, pideMotivo } from './motivos-salida';
import { seleccionDeDifusion, type SeleccionDifusion } from './seleccion-difusion';

/**
 * ¿Hay una corrida de «Completar» viva en esta pestaña? A nivel de MÓDULO y no de estado: si la barra se desmontara y se
 * volviera a montar (otra selección), un estado nuevo diría «no» y se largaría una segunda corrida sobre la misma línea, con la
 * mitad del espaciado que la protege (la revisión del 24/10/2026).
 */
let corridaViva = false;

/** Lo minimo que la barra necesita de un lead. No recibe el `CrmLead` entero a
 *  proposito: lo unico que mira es a quien va a escribirle y que tiene puesto. */
export type LeadDeLote = {
  id: number;
  name: string;
  stage: string;
  closer: string;
  setter: string;
  /** Está en una automatización (22/10/2026): con alguno así, la barra ofrece «Frenar». */
  enAutomatizacion?: boolean;
};

export type ProductoDeLote = { id: number; nombre: string; esDefault: boolean };

/** Valor del renglón «Pasar a otro funnel…» del desplegable «Funnel» (los demás son ids de funnel). */
const PASAR = '__pasar';

/** Lo que una accion le deja al padre para que lo cante en un toast. */
export type ResultadoLote = {
  texto: string;
  hubo: boolean;
  /**
   * UN deshacer para el lote entero, cuando la accion lo tiene (hoy: agregar a un
   * producto). El padre lo cuelga del «Deshacer» de su aviso: la barra se desmonta al
   * limpiar la seleccion, asi que un aviso propio moriria con ella. Tira si no pudo.
   */
  deshacer?: () => Promise<void>;
  /** El tono del aviso: `warn` cuando quedó a medias (paró, se cortó o faltan), para que no se lea como un «listo». */
  tono?: 'warn';
  /**
   * El resultado ya se mostró en el desplegable de la extensión (0.72.0): el padre NO pone su aviso abajo (Martín, 26/10/2026:
   * «no me gusta que salga el cartel negro abajo y el "extrayendo" arriba... quiero que todo eso salga en la extensión»).
   */
  enLaExtension?: boolean;
};

const btnIcono: CSSProperties = { cursor: 'pointer' };
const estiloDrop: CSSProperties = { height: 34, padding: '0 10px', borderRadius: 9, gap: 5, fontSize: 12.5 };

function IconoEtapa() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="5" height="16" rx="1" /><rect x="10" y="4" width="5" height="10" rx="1" /><rect x="17" y="4" width="4" height="6" rx="1" />
    </svg>
  );
}
function IconoPersona() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function IconoEtiqueta() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.5" />
    </svg>
  );
}
type LoteEtiqueta = { ok?: boolean; error?: string; cambiados?: number[]; yaEstaban?: number; sinSincronizar?: number };
async function loteEtiqueta(action: 'poner_lote' | 'sacar_lote', leadIds: number[], etiquetaId: number): Promise<LoteEtiqueta> {
  const r = await fetch('/api/crm/etiquetas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, leadIds, etiquetaId }) });
  return r.json() as Promise<LoteEtiqueta>;
}


/** Lo que se esta por hacer, ya elegido y todavia sin confirmar. */
type Pendiente =
  | { tipo: 'etapa'; stage: Stage }
  | { tipo: 'pasar' }
  | { tipo: 'persona'; campo: 'closer' | 'setter'; valor: string; pisa: number }
  | { tipo: 'borrar' }
  | { tipo: 'frenar' }
  | { tipo: 'whatsapp' }
  | { tipo: 'empresa'; cuenta: CuentaPerfiles };

/** La cuenta de «Datos de empresa» antes de consultar: con teléfono propio, cuántos faltan, cuántos quedan hoy y cuántos ahora. */
type CuentaPerfiles = { total: number; pendientes: number; quedanHoy: number; estaCorrida: number; linea: string | null; sinPais: number };

/**
 * Los funnels a los que se puede AGREGAR la seleccion: todos menos el que se esta mirando (ahi ya estan
 * todos los tildados). `esDefault` viaja como `fid: null`, que es como las actions de lead-funnel nombran
 * al producto del negocio. Exportado para el clic derecho del tablero (app/crm/menu-contextual-crm.ts):
 * el menu ofrece los MISMOS destinos que este desplegable, no una lista propia.
 */
export function destinosDeLote(productos: ProductoDeLote[], funnelActivo: number | null): Array<{ fid: number | null; nombre: string }> {
  return productos
    .map((p) => ({ fid: p.esDefault ? null : p.id, nombre: p.nombre }))
    .filter((p) => p.fid !== funnelActivo);
}

/**
 * LAS MISMAS ACCIONES DE LA BARRA, PEDIDAS DESDE AFUERA: el clic derecho sobre un seleccionado
 * (app/crm/CrmBoard.tsx, `elegirContextual`). No es un segundo camino: cada una abre la MISMA pregunta
 * que su desplegable (con el numero, y el «ya tenian otro» de closer/setter) o corre la misma accion al
 * toque con su Deshacer (etiqueta, funnel). Llamarlas sin barra montada no hace nada: el ref es null.
 */
export type ManijaLote = {
  moverDeEtapa: (stageKey: string) => void;
  asignar: (campo: 'closer' | 'setter', valor: string) => void;
  etiquetar: (e: Etiqueta) => void;
  agregarAFunnel: (funnelId: number | null) => void;
  eliminar: () => void;
  /** «Frenar automatización» de los tildados que están en una (22/10/2026). */
  frenar: () => void;
};

export function AccionesLoteLeads({ elegidos, stages, productos, equipo, funnelActivo, onLimpiar, onListo, estilo, ref, puedeCompletar = false, onCorriendo, columnaEntera, onMandarMensaje }: {
  elegidos: LeadDeLote[];
  stages: Stage[];
  productos: ProductoDeLote[];
  equipo: MiembroEquipo[];
  /** El embudo que se esta mirando: no se ofrece mover al mismo. */
  funnelActivo: number | null;
  onLimpiar: () => void;
  /** Termino: el padre refresca y canta el resultado. */
  onListo: (r: ResultadoLote) => void;
  estilo?: CSSProperties;
  /** Para el clic derecho del tablero (ver `ManijaLote`). */
  ref?: Ref<ManijaLote>;
  /** «Completar» (desde su WhatsApp y datos de empresa): sólo el admin, la misma puerta que las acciones (enriquecer-actions.ts). */
  puedeCompletar?: boolean;
  /**
   * Arrancó o terminó una corrida de «Completar». El tablero deja la barra montada mientras corre, aunque la selección se vacíe
   * por otro camino (el clic derecho, la casilla de una columna): sin barra no hay avance ni «Parar».
   */
  onCorriendo?: (corre: boolean) => void;
  /**
   * Lo tildado ES una columna entera (la casilla de su cabecera, sin filtros): el número dice de cuál («los 394 de Contacto
   * nuevo»), y la difusión la manda a la columna, no a una lista de ids.
   */
  columnaEntera?: { etapa: string; label: string; funnelId: number | null } | null;
  /** «Mandar mensaje»: abre la hoja de la difusión de Automations. Sin esto, el botón no se dibuja. */
  onMandarMensaje?: (s: SeleccionDifusion) => void;
}) {
  const [pide, setPideEstado] = useState<Pendiente | null>(null);
  const [corriendo, start] = useTransition();
  /** «Moviendo 75 de 221…»: un lote de a uno va de a tandas y tarda (~0,5 s por lead); sin esto parece colgado. */
  const [avance, setAvance] = useState<string | null>(null);
  /** «Completar» corriendo: tarda minutos, así que va con su «Parar» (se mira entre una tanda y la siguiente). */
  const [largo, setLargo] = useState(false);
  const [contando, setContando] = useState(false);
  const parar = useRef(false);
  /** Los tildados de AHORA (al terminar una corrida se limpia la selección sólo si sigue siendo la misma). */
  const idsAhora = useRef<number[]>([]);
  /** ¿La extensión de este navegador lee las fichas de WhatsApp Web? (el atributo lo pone extension/mako-puente.js). En vivo. */
  const extWa = useExtensionFichas();
  /**
   * «Desde mi WhatsApp» SIN la extensión (25/10/2026). Martín: «Si me dice "Instala la extensión de MaKo", si le apreto debería
   * automáticamente salirme el desplegable». La opción ya no está gris: abre la instalación en otra pestaña y la barra espera;
   * cuando la extensión aparece en esta pestaña (la 0.71.0 se repone sola en las pestañas de MaKo abiertas), arranca sola.
   */
  const [esperaExt, setEsperaExt] = useState(false);
  /** «Desde mi WhatsApp» corriendo a la vista: su avance y su «Parar» están en el desplegable de la extensión (0.72.0). */
  const [enExtension, setEnExtension] = useState(false);
  const n = elegidos.length;
  const ids = elegidos.map((l) => l.id);
  /** La etapa de los tildados si es UNA: la que «Pasar» busca en el destino. */
  const etapaComun = n > 0 && elegidos.every((l) => l.stage === elegidos[0].stage) ? elegidos[0].stage : null;
  /** El motivo de descalificar o perder, uno para todos: la categoría (un chip) y un detalle opcional. */
  const [motivoCat, setMotivoCat] = useState('');
  const [motivoDet, setMotivoDet] = useState('');
  idsAhora.current = ids;
  /** Mientras algo corre, ninguna otra acción de la barra: cada pregunta abierta con `loading` tapaba el «Parar». */
  const ocupado = corriendo || largo || contando;
  const ocupadoAhora = useRef(false);
  ocupadoAhora.current = ocupado;
  /**
   * Abre una pregunta, SALVO que algo esté corriendo: con `loading` abierta tapaba el «Parar», y su «Cancelar» quedaba apagado
   * (la revisión del 24/10/2026). La guarda vive acá y no en cada entrada, para que el clic derecho (`ManijaLote`) siga llamando
   * a las MISMAS funciones que los desplegables (tests/crm-menu-contextual.test.ts).
   */
  const setPide = (p: Pendiente | null) => { if (p && ocupadoAhora.current) return; setPideEstado(p); };

  const rotCuenta = columnaEntera ? `Los ${n} de «${columnaEntera.label}»` : `${n} ${n === 1 ? 'lead seleccionado' : 'leads seleccionados'}`;
  // Los tildados que están en una automatización: sólo a ésos los frena «Frenar» (22/10/2026).
  const idsEnAut = elegidos.filter((l) => l.enAutomatizacion).map((l) => l.id);
  const cuantos = `${n} ${n === 1 ? 'lead' : 'leads'}`;

  // ⚠️ CUANTOS TIENEN YA UN VALOR PUESTO. Es lo unico que convierte «asignar» en una
  // decision: sin este numero, pisar el Closer de ocho leads que ya lo tenian se ve
  // igual que rellenarle el hueco a ocho que no.
  const conValor = (campo: 'closer' | 'setter') => elegidos.filter((l) => (l[campo] ?? '').trim()).length;

  // Los productos a los que se puede agregar (ver `destinosDeLote`).
  const destinos = destinosDeLote(productos, funnelActivo);

  const cerrar = () => setPide(null);

  /** Lo que piden el desplegable «Etapa» y el clic derecho: la MISMA pregunta. */
  const pedirEtapa = (k: string) => { const s = stages.find((x) => x.key === k); if (s) { setMotivoCat(''); setMotivoDet(''); setPide({ tipo: 'etapa', stage: s }); } };
  /** Lo que piden «Closer»/«Setter» y el clic derecho, con cuántos ya lo tenían. */
  const pedirPersona = (campo: 'closer' | 'setter', v: string) => { if (v) setPide({ tipo: 'persona', campo, valor: v, pisa: conValor(campo) }); };

  /**
   * Agregar una etiqueta a los tildados, AL TOQUE (se deshace desde el aviso). Los que ya la tenían
   * se cuentan aparte, como en producto. Sin disparar nada: ver la cabecera.
   */
  const etiquetar = (e: Etiqueta) => {
    if (ocupadoAhora.current) return; // mientras corre «Completar», nada más (también desde el clic derecho)
    start(async () => {
      try {
        // DE A TANDAS (27/10/2026, Leila: «quedaron 79 sin etiqueta»; Martín: «no tiene que haber limitaciones»). La ruta toma
        // `TANDA_ETIQUETAS_LOTE` por pedido y antes se le mandaban todos juntos. Si una tanda falla, se para y se DICE cuántos
        // quedaron sin la etiqueta.
        const puestos: number[] = [];
        let yaEstaban = 0, sinSincronizar = 0, hechos = 0;
        let corte: string | null = null;
        for (const tanda of enTandas(ids, TANDA_ETIQUETAS_LOTE)) {
          const r = await loteEtiqueta('poner_lote', tanda, e.id)
            .catch((x: unknown): LoteEtiqueta => ({ ok: false, error: x instanceof Error ? x.message : 'No se pudo' }));
          if (!r.ok) { corte = r.error || 'No se pudo'; break; }
          puestos.push(...(r.cambiados ?? []));
          yaEstaban += r.yaEstaban ?? 0;
          sinSincronizar += r.sinSincronizar ?? 0;
          hechos += tanda.length;
        }
        if (corte != null && !hechos) {
          onListo({ texto: corte, hubo: false });
        } else {
          const ya = yaEstaban ? ` · ${yaEstaban} ya ${yaEstaban === 1 ? 'la tenía' : 'la tenían'}` : '';
          const fuera = sinSincronizar ? ` · ${sinSincronizar} sin sincronizar` : '';
          const faltan = ids.length - hechos;
          const cortado = corte != null ? ` · se cortó: ${faltan} ${faltan === 1 ? 'quedó' : 'quedaron'} sin la etiqueta (${corte})` : '';
          onListo({
            texto: (puestos.length ? `«${e.nombre}» a ${puestos.length}${ya}` : 'Ya la tenían') + fuera + cortado,
            hubo: puestos.length > 0,
            deshacer: puestos.length
              ? async () => {
                for (const tanda of enTandas(puestos, TANDA_ETIQUETAS_LOTE)) {
                  const q = await loteEtiqueta('sacar_lote', tanda, e.id);
                  if (!q.ok) throw new Error(q.error || 'No se pudo deshacer');
                }
              }
              : undefined,
          });
        }
      } catch (err) {
        onListo({ texto: err instanceof Error ? err.message : 'No se pudo', hubo: false });
      }
      onLimpiar();
    });
  };

  /**
   * Agregar los tildados a un producto, AL TOQUE. Los que ya estaban ahi (por casa o por
   * fila) los saltea el server y se cuentan aparte: «12 agregados» sobre 15 tildados sin
   * decir por que se leeria como tres fallos.
   */
  const agregarA = (funnelId: number | null, nombre: string) => {
    start(async () => {
      try {
        // De a tandas (24/10/2026): el server corta en 2.000 sin decirlo, y los cortados se contaban como «ya estaban».
        const agregados: number[] = [];
        let fallaron = 0;
        let error: string | null = null;
        for (const tanda of enTandas(ids, TANDA_AGREGAR)) {
          const t = await agregarLoteAProductoAction(tanda, funnelId);
          if (!t.ok) { error = t.error; break; }
          agregados.push(...t.agregados);
          fallaron += t.fallaron;
        }
        const r = error != null && !agregados.length ? { ok: false as const, error } : { ok: true as const, agregados, fallaron };
        if (!r.ok) {
          onListo({ texto: r.error, hubo: false });
        } else {
          const n = r.agregados.length;
          // Con un corte no se sabe cuántos «ya estaban» y cuántos no llegaron: no se cuenta, se dice el corte.
          const yaEstaban = error != null ? 0 : Math.max(0, ids.length - n - r.fallaron);
          const ya = yaEstaban ? ` · ${yaEstaban} ya ${yaEstaban === 1 ? 'estaba' : 'estaban'}` : '';
          const mal = r.fallaron ? ` · ${r.fallaron} no se pudieron` : '';
          const corte = error != null ? ` · se cortó (${error}): revisa los que faltan` : '';
          onListo({
            texto: n ? `${n} a ${nombre}${ya}${mal}${corte}` : `Ya estaban en ${nombre}${mal}${corte}`,
            hubo: n > 0,
            deshacer: n
              ? async () => {
                // El deshacer, también de a tandas: el server toma hasta 2.000 por pedido.
                for (const tanda of enTandas(agregados, TANDA_AGREGAR)) {
                  const q = await quitarLoteDeProductoAction(tanda, funnelId);
                  if (!q.ok) throw new Error(q.error);
                }
              }
              : undefined,
          });
        }
      } catch (e) {
        onListo({ texto: e instanceof Error ? e.message : 'No se pudo', hubo: false });
      }
      onLimpiar();
    });
  };

  /**
   * Lo que pide el desplegable «Completar». «Datos de empresa» cuenta ANTES de preguntar (cuántos, cuánto tarda, cuántos quedan
   * hoy y en qué línea).
   * ⚠️ «COMPLETAR» NO VA EN `start` (useTransition), Y ES A PROPÓSITO. En el React de Next 16, lo que se pone en la parte
   * síncrona de una transición async (`setLargo(true)`, el primer avance) no se dibuja hasta que la acción ENTERA termina:
   * durante minutos no había «Parar», ni avance, ni casilla trabada (la revisión del 24/10/2026, medido en
   * react-dom-client). Son async planos con su propio estado (`contando`, `largo`), como el modal del grupo.
   */
  const pedirCompletar = async (v: string) => {
    if (ocupado || corridaViva) return;
    if (v === 'whatsapp') {
      if (extWa === 'si') { setPide({ tipo: 'whatsapp' }); return; }
      setEsperaExt(true);
      // Si la carpeta de una extensión descomprimida ya trae la nueva, se recarga sola (0.71.1+): ni hace falta instalar.
      window.dispatchEvent(new CustomEvent('MAKO_EXTENSION_REVISAR'));
      window.open('/extension/instalar', '_blank', 'noopener');
      return;
    }
    if (v !== 'empresa') return;
    setContando(true); setAvance('Contando…');
    try {
      const c = await completarPerfilesDeLeadsAction({ ids, soloContar: true });
      if (!c.ok) { onListo({ texto: c.error, hubo: false, tono: 'warn' }); return; }
      const sinPais = c.sinPais ? ` · ${miles(c.sinPais)} sin código de país (no se consultan: corrige su teléfono)` : '';
      if (!c.total) { onListo({ texto: `Ninguno de los ${cuantos} tiene un teléfono que sea sólo suyo${sinPais}.`, hubo: false, tono: 'warn' }); return; }
      if (!c.pendientes) { onListo({ texto: `Ya se consultaron los ${miles(c.total)} con teléfono${sinPais}.`, hubo: false }); return; }
      if (!c.estaCorrida) {
        onListo({ texto: `Hoy ya se hicieron las ${miles(TOPE_PERFILES_DIA)} consultas de tu línea (cuidan tu WhatsApp de un bloqueo). Faltan ${miles(c.pendientes)}: tócalo mañana.`, hubo: false, tono: 'warn' });
        return;
      }
      setPideEstado({ tipo: 'empresa', cuenta: { total: c.total, pendientes: c.pendientes, quedanHoy: c.quedanHoy, estaCorrida: c.estaCorrida, linea: c.lineaNombre ?? null, sinPais: c.sinPais ?? 0 } });
    } catch (e) {
      onListo({ texto: e instanceof Error ? e.message : 'No se pudo', hubo: false, tono: 'warn' });
    } finally { setContando(false); setAvance(null); }
  };

  // Al aparecer la extensión que se fue a instalar, arranca sola (con los tildados de ahora).
  const arrancarAlInstalar = useEffectEvent(() => { setEsperaExt(false); if (!ocupadoAhora.current && n > 0) void correrWhatsapp(); });
  useEffect(() => { if (esperaExt && extWa === 'si') arrancarAlInstalar(); }, [esperaExt, extWa]);

  /** Arranca una corrida larga: su estado ANTES del primer `await` (se dibuja ya), el candado y el aviso al tablero. */
  const empezarLargo = (primerAvance: string): boolean => {
    if (corridaViva) return false;
    corridaViva = true;
    parar.current = false;
    setLargo(true); setAvance(primerAvance);
    onCorriendo?.(true);
    return true;
  };
  /** La termina: suelta todo, canta el resultado y limpia la selección SÓLO si terminó entera y sigue siendo la misma. */
  const terminarLargo = (r: ResultadoLote, entera: boolean, deEstos: readonly number[]) => {
    corridaViva = false;
    setLargo(false); setAvance(null);
    onCorriendo?.(false);
    onListo(entera ? r : { ...r, tono: 'warn' });
    const misma = idsAhora.current.length === deEstos.length && idsAhora.current.every((id) => deEstos.includes(id));
    // A medias (el tope del día), la selección queda: el aviso pide tocarlo mañana, y para eso tienen que seguir tildados.
    if (entera && misma) onLimpiar();
  };

  /**
   * «Completar desde mi WhatsApp» sobre los tildados: sus teléfonos → la extensión lee lo que SU WhatsApp Web ya guardó (sin
   * clics, sin red) → se guarda de a tandas, SÓLO en estos leads. La pregunta se cierra antes de arrancar: si quedara abierta,
   * taparía el avance y el «Parar».
   */
  // ⚠️ CADA PASO SE VE (25/10/2026). Martín: «en el proceso tampoco pasó nada, no hay ninguna acción que el usuario vea para
  // saber que está corriendo bien». De qué grupos vinieron, lo que cuenta la extensión («Abriendo WhatsApp Web…», «Buscando el
  // grupo «X»…»), «Completando N de M…» y un final que dice qué encontró y qué no.
  // ⚠️ DESDE LA 0.72.0 (26/10/2026) EL AVANCE Y EL FINAL VIVEN EN LA EXTENSIÓN. Martín: «no me gusta que salga el cartel negro
  // abajo y el "extrayendo" arriba en la topbar de selección múltiple, quiero que todo eso salga en la extensión, en el
  // desplegable». El pedido va «a la vista»: la pestaña de WhatsApp al frente, el desplegable abierto con cada paso, y el
  // grupo de donde vinieron, recorrido. La barra no dice nada mientras tanto; sólo si falla ANTES de la extensión (sin
  // teléfonos, sin la extensión) queda el aviso de siempre, porque en el desplegable no hay nada.
  const correrWhatsapp = async () => {
    cerrar();
    setEsperaExt(false);
    const deEstos = [...ids];
    if (!empezarLargo('')) return;
    setEnExtension(true);
    const id = nuevoIdExtraccion();
    const soltar = alPararExtraccion(id, () => { parar.current = true; });
    let r: ResultadoLote = { texto: 'No se pudo', hubo: false };
    let entera = false;
    try {
      const t = await pedidosDeFichasAction(deEstos);
      if (!t.ok) { r = { texto: t.error, hubo: false }; return; }
      if (!t.pedidos.length) { r = { texto: `Ninguno de los ${cuantos} tiene teléfono.`, hubo: false }; return; }
      const titulo = t.grupos.length === 1 ? t.grupos[0] : `${miles(t.pedidos.length)} leads del CRM`;
      const f = await pedirFichasDeWhatsappWeb(t.pedidos.map((p) => ({ telefono: p.telefono, lid: p.lid })), {
        grupos: t.grupos, visible: true, titulo, id,
      });
      if (!f.ok) {
        // Sin la sesión iniciada, la pestaña que abrió la extensión va al frente: ahí está el código para escanear.
        if (f.motivo === 'sin_sesion') enfocarWhatsappWeb();
        // Sin la extensión, el desplegable no tiene nada: el aviso de siempre. Con ella, el error ya está allá.
        r = { texto: motivoDeFichas(f.motivo), hubo: false, enLaExtension: f.motivo !== 'extension' && f.motivo !== 'sin_respuesta' };
        if (r.enLaExtension) avisarExtraccion(id, { estado: f.motivo === 'parado' ? 'parado' : 'error', texto: r.texto });
        return;
      }
      // Qué tablas tiene su WhatsApp Web, sin datos de nadie: si WhatsApp cambia cómo guarda, esto dice por qué no volvió nada.
      console.info('[wa-fichas]', f.diagnostico);
      if (f.diagnostico && !f.diagnostico.contactos) {
        r = { texto: 'No encontré contactos guardados en tu WhatsApp Web. Recarga esa pestaña, espera a que carguen tus chats y vuelve a tocar.', hubo: false, enLaExtension: true };
        avisarExtraccion(id, { estado: 'error', texto: r.texto });
        return;
      }
      // El PERFIL de cada uno (0.73.2), de a tandas, en el grupo de donde vinieron (el primero, si son varios).
      const limpias = f.fichas.map(fichaLimpia).filter((x): x is FichaWa => !!x);
      const pf = t.grupos.length
        ? await perfilesEnTandas(t.pedidos.map((p) => ({ telefono: p.telefono })), limpias, { grupo: t.grupos[0], id, parar: () => parar.current })
        : null;
      const fichas = pf ? pf.fichas : limpias;
      // Si los perfiles se cortaron, se dice al final (antes no quedaba rastro).
      const cortePerfiles = pf?.corte && pf.corte !== 'parado' ? ` Los perfiles: ${motivoDeFichas(pf.corte)}` : '';
      avisarExtraccion(id, { fase: 'guardando', guardados: 0, total: fichas.length });
      const a = await guardarFichasEnTandas(fichas, (tanda) => completarFichasDeLeadsAction({ ids: deEstos, fichas: tanda }), {
        parar: () => parar.current,
        alAvanzar: (guardados, total) => avisarExtraccion(id, { fase: 'guardando', guardados, total }),
      });
      r = { texto: resumenDeFichas(t.pedidos.length, fichas, a) + gruposEnWhatsappDichos(f.grupos) + cortePerfiles, hubo: a.nombres + a.empresas > 0, enLaExtension: true };
      avisarExtraccion(id, {
        estado: a.parado ? 'parado' : a.error ? 'error' : 'listo', nombres: a.nombres, empresas: a.empresas, perfiles: a.perfiles ?? 0,
        texto: a.error ?? `De ${miles(t.pedidos.length)} leads del CRM.`,
      });
      entera = !a.parado && !a.error;
    } catch (e) {
      r = { texto: e instanceof Error ? e.message : 'No se pudo', hubo: false };
      avisarExtraccion(id, { estado: 'error', texto: r.texto });
    } finally { soltar(); setEnExtension(false); terminarLargo(r, entera, deEstos); }
  };

  /** «Datos de empresa» sobre los tildados, después de la pregunta con la cuenta. El tope del día lo cuenta el server. */
  const correrEmpresa = async (cuenta: CuentaPerfiles) => {
    cerrar();
    const deEstos = [...ids];
    if (!empezarLargo(`Consultando perfiles: 0 de ${miles(cuenta.estaCorrida)}…`)) return;
    let r: ResultadoLote = { texto: 'No se pudo', hubo: false };
    let entera = false;
    try {
      const a = await correrPerfiles(cuenta, (hechas, saltear) => completarPerfilesDeLeadsAction({ ids: deEstos, hechas, saltear }), {
        parar: () => parar.current,
        alAvanzar: (hechas, meta) => setAvance(`Consultando perfiles: ${miles(hechas)} de ${miles(meta)}…`),
      });
      r = { texto: resumenDePerfiles(a), hubo: a.completados > 0 };
      entera = !a.parado && !a.error && a.pendientes <= 0;
    } catch (e) {
      r = { texto: e instanceof Error ? e.message : 'No se pudo', hubo: false };
    } finally { terminarLargo(r, entera, deEstos); }
  };

  const ejecutar = () => {
    if (!pide) return;
    start(async () => {
      try {
        if (pide.tipo === 'etapa') {
          // Con el CRM que se mira: los AGREGADOS a él se mueven en su fila (23/10/2026, ver la action).
          // ⚠️ DE A TANDAS (24/10/2026, app/crm/lote-tandas.ts): los 221 de una vez se cortaron en 121 a los 60 s.
          // Descalificar o perder en bloque: UN motivo para todos (el mismo formato que el wizard de a uno).
          const motivo = pideMotivo(pide.stage.key) && motivoCat ? motivoFinalDe(motivoCat, motivoDet) : null;
          const t = await correrEnTandas(ids, TANDA_LOTE, (tanda) => moverLeadsDeEtapaAction(tanda, pide.stage.key, funnelActivo, motivo),
            (k) => setAvance(`Moviendo ${k} de ${ids.length}…`));
          const movidos = t.resultados.reduce((s, r) => s + r.movidos, 0);
          const conPendientes = t.resultados.reduce((s, r) => s + r.conPendientes, 0);
          const fallaron = t.resultados.reduce((s, r) => s + r.fallaron, 0);
          // TRES numeros, no uno: ver la cabecera de la action. El de pendientes solo
          // se nombra si lo hay — un «0 con datos pendientes» es ruido.
          const falta = conPendientes ? ` · a ${conPendientes} les falta un dato` : '';
          const mal = fallaron ? ` · ${fallaron} no se pudieron` : '';
          onListo({ texto: `${movidos} a ${pide.stage.label}${falta}${mal}${colaDelAviso(t, ['movió', 'movieron'])}`, hubo: movidos > 0 });
        } else if (pide.tipo === 'persona') {
          const r = await bulkFillLeadFieldAction(pide.campo, pide.valor, ids, true);
          const campo = pide.campo === 'closer' ? 'Closer' : 'Setter';
          onListo({ texto: `${campo} «${pide.valor}» en ${r.updated}`, hubo: r.updated > 0 });
        } else if (pide.tipo === 'frenar') {
          // UNA escritura sobre los que están en una automatización (Automations): no queda a medias.
          const r = await frenarLeadsEnAutomatizacionesAction(idsEnAut);
          onListo({ texto: r.ok ? r.resumen : r.error, hubo: r.ok && r.frenados > 0 });
        } else if (pide.tipo === 'borrar') {
          // A la PAPELERA (mig 0340), de a tandas y con su avance (app/crm/lote-tandas.ts). El aviso trae UN «Deshacer» que los
          // recupera a todos, también de a tandas; y el renglón «Papelera» del menú de funnels se vuelve a contar.
          const t = await correrEnTandas(ids, TANDA_LOTE, (tanda) => eliminarLeadsAction(tanda), (k) => setAvance(`A la papelera: ${k} de ${ids.length}…`));
          const borrados = t.resultados.reduce((s, r) => s + r.borrados, 0);
          const mandados = t.resultados.flatMap((r) => r.mandados);
          const fallaron = t.resultados.reduce((s, r) => s + r.fallaron, 0);
          const motivos = [...new Set(t.resultados.map((r) => r.motivo).filter((m): m is string => !!m))];
          const mal = fallaron ? ` · ${fallaron} no se pudieron${motivos.length ? ` (${motivos.join(' · ')})` : ''}` : '';
          if (mandados.length) avisarPapelera();
          onListo({
            texto: `${borrados} a la papelera${mal}${colaDelAviso(t, ['eliminó', 'eliminaron'])}`, hubo: borrados > 0,
            deshacer: mandados.length ? async () => {
              const v = await correrEnTandas(mandados, TANDA_LOTE, (tanda) => recuperarLeadsAction(tanda));
              avisarPapelera();
              const no = v.resultados.reduce((s, r) => s + r.fallaron, 0) + v.quedan.length + v.inciertos.length;
              if (v.error || no) throw new Error(`${no} no volvieron: están en «Papelera»`);
            } : undefined,
          });
        }
      } catch (e) {
        onListo({ texto: e instanceof Error ? e.message : 'No se pudo', hubo: false });
      }
      setAvance(null);
      cerrar();
      onLimpiar();
    });
  };

  /** Agregar a un funnel por su id (`null` = el del negocio), con el nombre que lo canta el aviso. */
  const agregarAFunnel = (fid: number | null) => {
    if (ocupado) return;
    agregarA(fid, destinos.find((p) => p.fid === fid)?.nombre ?? 'otro funnel');
  };
  /** Lo que elige el desplegable «Funnel»: agregar a uno (al toque), o «Pasar a otro funnel…» (su pregunta). */
  const elegirFunnel = (v: string) => {
    if (v === PASAR) { setPide({ tipo: 'pasar' }); return; }
    agregarAFunnel(v === 'default' ? null : Number(v));
  };

  // Antes del `return null` de abajo: un hook despues de un return temprano cambia de orden entre renders.
  useImperativeHandle(ref, () => ({
    moverDeEtapa: pedirEtapa,
    asignar: pedirPersona,
    etiquetar: (e: Etiqueta) => { if (!corriendo) etiquetar(e); },
    agregarAFunnel,
    eliminar: () => setPide({ tipo: 'borrar' }),
    frenar: () => { if (idsEnAut.length) setPide({ tipo: 'frenar' }); },
  }));

  if (n === 0 && !largo) return null;

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
        background: 'var(--surface)', border: '1px solid var(--border-strong)',
        borderRadius: 12, ...estilo,
      }}>
        {/* ── IZQUIERDA: la casilla marcada (limpia) y el numero. ──────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <input type="checkbox" checked readOnly onClick={largo ? undefined : onLimpiar}
            title={largo ? 'Completando: para primero' : 'Quitar la selección'} aria-label={`${rotCuenta}. Quitar la selección`}
            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary)', flex: 'none' }} />
          <span role="status" title={rotCuenta} aria-label={rotCuenta}
            style={{ flex: 'none', minWidth: 24, fontFamily: MONO, fontSize: 13, fontWeight: 700, color: 'var(--primary)', lineHeight: 1 }}>
            {n}
          </span>
          {avance && <span role="status" title={avance} style={{ fontFamily: SANS, fontSize: 12.5, color: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{avance}</span>}
          {/* Esperando la extensión que se fue a instalar: se dice, con cómo dejar de esperar. */}
          {esperaExt && !largo && (
            <>
              {/* Corto, para que entre al lado de los botones (en el Chrome de Martín salía «cuando esté, emp…»); lo completo, al pasar. */}
              <span role="status" title={`${extWa === 'vieja' ? 'Actualiza' : 'Instala'} la extensión de MaKo en la otra pestaña: cuando esté, esto empieza solo.`}
                style={{ fontFamily: SANS, fontSize: 12.5, color: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {extWa === 'vieja' ? 'Actualiza' : 'Instala'} la extensión: empieza sola
              </span>
              <button type="button" onClick={() => setEsperaExt(false)}
                style={{ flex: 'none', height: 30, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
            </>
          )}
          {/* «Parar» de «Completar»: frena entre una tanda y la siguiente, y lo dice para que no parezca que no oyó. Con la
              extensión a la vista, el «Parar» está en su desplegable (0.72.0). */}
          {largo && !enExtension && (
            <button type="button" data-parar-completar onClick={() => { parar.current = true; setAvance('Parando al terminar esta tanda…'); }}
              style={{ flex: 'none', height: 30, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
              Parar
            </button>
          )}
        </div>

        {/* ── MEDIO: lo que CAMBIA el lead. Con palabra, porque un icono suelto no
             dice QUE etapa ni QUE persona (misma razon que la barra del plan). ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 'none', justifyContent: 'center' }}>
          <Dropdown
            value="" resetAfterSelect placeholder="Etapa" ariaLabel={`Mover ${cuantos} de etapa`}
            icono={<span style={{ display: 'flex', color: 'var(--dim)' }}><IconoEtapa /></span>}
            buttonStyle={estiloDrop} disabled={ocupado}
            options={stages.map((s) => ({ value: s.key, label: s.label, color: s.dot }))}
            onChange={pedirEtapa} />

          {/* El equipo puede estar vacio: ahi el desplegable no se dibuja. Un control
              con cero opciones se lee como que la app esta rota. */}
          {equipo.length > 0 && (['closer', 'setter'] as const).map((campo) => (
            <Dropdown key={campo}
              value="" resetAfterSelect placeholder={campo === 'closer' ? 'Closer' : 'Setter'}
              ariaLabel={`Asignar ${campo === 'closer' ? 'Closer' : 'Setter'} a ${cuantos}`}
              icono={<span style={{ display: 'flex', color: 'var(--dim)' }}><IconoPersona /></span>}
              buttonStyle={estiloDrop} disabled={ocupado}
              // Una persona va con su avatar (la foto o sus iniciales), no con un ícono (general 10).
              options={equipo.map((m) => ({ value: m.nombre, label: m.nombre, avatar: m.foto_url ?? null }))}
              onChange={(v) => pedirPersona(campo, v)} />
          ))}

          {/* Agregar a otro producto: solo si hay OTRO adonde ir. Sin pregunta: suma y
              se deshace desde el aviso. */}
          {destinos.length > 0 && (
            <Dropdown
              value="" resetAfterSelect placeholder="Funnel" ariaLabel={`Agregar ${cuantos} a otro funnel`}
              icono={<span style={{ display: 'flex', color: 'var(--dim)' }}><IconoFunnel /></span>}
              buttonStyle={estiloDrop} disabled={ocupado}
              options={[
                ...destinos.map((p) => ({ value: String(p.fid ?? 'default'), label: p.nombre, sub: 'Agregar: siguen también aquí' })),
                { value: PASAR, label: 'Pasar a otro funnel…', sub: 'Salen de este y entran en otro' },
              ]}
              onChange={elegirFunnel} />
          )}

          {/* Agregar una etiqueta: al toque, con Deshacer. «＋ Nueva» la crea de paso. «Agregar» y no
              «Poner» (sexta tanda, TAG 1: «En lugar de "Poner" y "Sacar", se formal escribiendo
              siempre... "Agregar" y "Eliminar". Revisa que no esté ese error en otro lado»). */}
          <SelectorEtiqueta value={null} accion placeholder="Etiqueta" ariaLabel={`Agregar una etiqueta a ${cuantos}`}
            icono={<span style={{ display: 'flex', color: 'var(--dim)' }}><IconoEtiqueta /></span>}
            buttonStyle={estiloDrop} disabled={ocupado}
            onElegir={(e) => { if (!ocupado) etiquetar(e); }} />

          {/* «Completar» (24/10/2026): lo vacío de los tildados, desde su WhatsApp o del perfil de empresa. Sólo el admin. Sin la
              extensión, la opción de WhatsApp se ve apagada y dice qué falta (una opción que no hace nada no se ofrece muda). */}
          {puedeCompletar && (
            <Dropdown
              value="" resetAfterSelect placeholder="Completar" ariaLabel={`Completar los datos de ${cuantos}`}
              icono={<span style={{ display: 'flex', color: 'var(--dim)' }}><IconoMenu nombre="persona-mas" size={15} /></span>}
              buttonStyle={estiloDrop} disabled={ocupado}
              options={[
                {
                  // No va gris sin la extensión (25/10/2026): tocarla abre la instalación y arranca sola al volver.
                  value: 'whatsapp', label: 'Desde mi WhatsApp', icono: 'whatsapp',
                  sub: extWa === 'si' ? 'Nombre, empresa y grupos en común' : extWa === 'vieja' ? lineaDeVersion(VERSION_FICHAS, 'Actualiza la extensión de MaKo') : 'Instala la extensión de MaKo',
                },
                { value: 'empresa', label: 'Datos de empresa', icono: 'web', sub: 'Web, Instagram, correo y dirección' },
              ]}
              onChange={(v) => void pedirCompletar(v)} />
          )}
        </div>

        {/* ── DERECHA: lo irreversible, solo. ──────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
          {/* «Mandar mensaje» (28/10/2026, la difusión de Automations): la hoja es de ellos; acá sólo va la selección. */}
          {onMandarMensaje && (
            <button type="button" className="mk-icon-btn" data-mandar-mensaje-lote
              title={`Mandar un mensaje a ${columnaEntera ? `los ${n} de «${columnaEntera.label}»` : cuantos}`}
              aria-label={`Mandar un mensaje a ${cuantos}`}
              onClick={() => onMandarMensaje(seleccionDeDifusion(ids, columnaEntera))} disabled={ocupado} style={btnIcono}>
              <IconoMenu nombre="enviar" size={16} />
            </button>
          )}
          {/* «Frenar automatización» (22/10/2026): sólo si alguno de los tildados está en una. No se deshace: pregunta. */}
          {idsEnAut.length > 0 && (
            <button type="button" className="mk-icon-btn" data-tone="bad" data-frenar-lote
              title={`Frenar la automatización de ${idsEnAut.length} ${idsEnAut.length === 1 ? 'lead' : 'leads'}`}
              aria-label={`Frenar la automatización de ${idsEnAut.length} ${idsEnAut.length === 1 ? 'lead' : 'leads'}`}
              onClick={() => setPide({ tipo: 'frenar' })} disabled={ocupado} style={btnIcono}>
              <IconoMenu nombre="pausar" size={16} />
            </button>
          )}
          <button type="button" className="mk-icon-btn" data-tone="bad"
            title={`Mandar ${cuantos} a la papelera`} aria-label={`Eliminar ${cuantos}`}
            onClick={() => setPide({ tipo: 'borrar' })} disabled={ocupado} style={btnIcono}>
            {/* El tacho de la casa (app/_ui/BotonBorrar.tsx, general 9): el mismo dibujo y rojo siempre. */}
            <IconoBorrar size={16} />
          </button>
        </div>
      </div>

      {/* ── La pregunta. Cada una NOMBRA el numero y lo que va a pasar. ────────── */}
      {pide?.tipo === 'etapa' && (
        <Confirm
          title={`¿Mover ${cuantos} a ${pide.stage.label}?`}
          /* Mover NO se bloquea (decision del 17/09): lo que la etapa pida y falte queda
             pendiente. Decirlo aca es lo que evita que el resultado se lea como un fallo.
             Descalificar o perder pide UN motivo para todos (28/10/2026): sin elegir, queda pendiente como siempre. */
          message={pideMotivo(pide.stage.key) ? (
            <span style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span>¿Por qué? Va a los {n}. Sin elegir, el motivo queda pendiente en cada ficha.</span>
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {motivosDeSalida(pide.stage.key).map((m) => (
                  <button key={m} type="button" data-motivo-lote={m} onClick={() => setMotivoCat(motivoCat === m ? '' : m)}
                    style={{ padding: '5px 11px', borderRadius: 999, border: `1px solid ${motivoCat === m ? 'var(--primary)' : 'var(--border-strong)'}`,
                      background: motivoCat === m ? 'var(--primary)' : 'var(--surface)', color: motivoCat === m ? '#fff' : 'var(--ink)',
                      fontFamily: SANS, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                    {m}
                  </button>
                ))}
              </span>
              {motivoCat && (
                <input value={motivoDet} onChange={(e) => setMotivoDet(e.target.value)} placeholder="Detalle (opcional)" maxLength={300}
                  style={{ height: 34, padding: '0 10px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13 }} />
              )}
            </span>
          ) : 'Lo que la etapa pida y falte queda pendiente en cada ficha.'}
          confirmLabel="Mover" tone="primary" loading={corriendo}
          onConfirm={ejecutar} onCancel={cerrar} />
      )}
      {pide?.tipo === 'pasar' && (
        <PasarAOtroFunnel ids={ids} destinos={destinos} funnelActivo={funnelActivo} etapaOrigen={etapaComun}
          onCerrar={cerrar}
          onListo={(r) => { cerrar(); onListo(r); onLimpiar(); }} />
      )}
      {pide?.tipo === 'persona' && (
        <Confirm
          title={`¿${pide.campo === 'closer' ? 'Closer' : 'Setter'} «${pide.valor}» en ${cuantos}?`}
          /* El numero que convierte esto en una decision. Sin pisar a nadie no se advierte
             nada: una advertencia que no advierte enseña a ignorar las que sí importan. */
          message={pide.pisa > 0
            ? `${pide.pisa} ${pide.pisa === 1 ? 'ya tenía otro y se reemplaza' : 'ya tenían otro y se reemplazan'}.`
            : 'Ninguno lo tiene puesto todavía.'}
          confirmLabel="Asignar" tone="primary" loading={corriendo}
          onConfirm={ejecutar} onCancel={cerrar} />
      )}
      {pide?.tipo === 'frenar' && (() => {
        const q = preguntaDeFrenar({ leads: idsEnAut.length, nombre: idsEnAut.length === 1 ? elegidos.find((l) => l.id === idsEnAut[0])?.name : null });
        // Los tildados que NO están en una automatización no se tocan: se dice, para que el número no sorprenda.
        const fuera = n - idsEnAut.length;
        return (
          <Confirm title={q.titulo}
            message={fuera > 0 ? `${q.mensaje} ${fuera === 1 ? 'El otro tildado no está' : `Los otros ${fuera} tildados no están`} en ninguna.` : q.mensaje}
            confirmLabel="Frenar" tone="danger" loading={corriendo}
            onConfirm={ejecutar} onCancel={cerrar} />
        );
      })()}
      {pide?.tipo === 'whatsapp' && (
        <Confirm
          title={`¿Completar ${cuantos} desde tu WhatsApp?`}
          message={'Lee lo que tu WhatsApp Web ya sabe de cada uno (nombre, empresa y grupos) y lo pone sólo donde falta. Si WhatsApp Web no está abierto, lo abre. No abre chats y no les llega nada.'
            + (n > TOPE_LOTE_COMPLETAR ? ` Se toman los primeros ${miles(TOPE_LOTE_COMPLETAR)} de los ${miles(n)} tildados.` : '')}
          confirmLabel="Completar" tone="primary"
          onConfirm={() => void correrWhatsapp()} onCancel={cerrar} />
      )}
      {pide?.tipo === 'empresa' && (
        <Confirm
          title="¿Traer los datos de empresa?"
          message={preguntaDePerfiles(pide.cuenta, minutosDePerfiles(pide.cuenta.estaCorrida), pide.cuenta.linea)
            + (pide.cuenta.sinPais ? ` ${miles(pide.cuenta.sinPais)} sin código de país no se consultan (corrige su teléfono).` : '')
            + (n > TOPE_LOTE_COMPLETAR ? ` Se toman los primeros ${miles(TOPE_LOTE_COMPLETAR)} de los ${miles(n)} tildados.` : '')}
          confirmLabel={`Consultar ${miles(pide.cuenta.estaCorrida)}`} tone="primary"
          onConfirm={() => void correrEmpresa(pide.cuenta)} onCancel={cerrar} />
      )}
      {pide?.tipo === 'borrar' && (
        <Confirm
          title={preguntaDePapelera(n, elegidos[0]?.name).titulo}
          message={preguntaDePapelera(n, elegidos[0]?.name).mensaje}
          confirmLabel="Mandar a la papelera" tone="danger" loading={corriendo}
          onConfirm={ejecutar} onCancel={cerrar} />
      )}
    </>
  );
}
