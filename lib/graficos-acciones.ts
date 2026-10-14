// =============================================================================
// graficos-acciones — qué se puede hacer desde un número del Dashboard
// =============================================================================
// Punto 5 del feedback de Martín (11/10/2026): «Los gráficos interactivos... Sería bueno que identifiques
// botones de acción dentro de MaKo que podríamos usar». Un clic en un número (una KPI, una barra, una
// porción, una fila) abre su DETALLE: la lista de las cosas que lo forman (app/dashboard/Detalle.tsx,
// leída por lib/graficos-detalle.ts), y en cada fila las ACCIONES de este archivo. Arriba, «Filtrar la
// página por esto».
//
// PURO y sin `server-only`, a propósito: lo importan la pantalla (para dibujar los botones), el server (para
// armar la respuesta) y los tests. Nada del registro de la API de MaKo (lib/api-mako/registro.ts no se
// importa desde un `use client`), y nada de IA: los botones llaman a las server actions de PANTALLA que ya
// existen, y quien aprieta el botón es la persona que confirma.
//
// Lo que no se ve en la firma:
//   · Sólo REVERSIBLES y sin plata. Marcar calificado (manda conversiones a Meta que no se deshacen), marcar
//     que no asistió (borra el calificado) y tocar un presupuesto NO van acá: necesitan un Confirm con la
//     consecuencia pegada, y eso es su pantalla. El test lo frena.
//   · Qué acciones se ofrecen depende de la CAPA del workspace (`tabEnCapa`, calculado en el server y
//     devuelto en la respuesta del detalle). Sin eso, un workspace sin CRM ve botones que fallan.
//   · Los ids de una fila salen de la MISMA fila del server (`Fila.r`): la cuota y su lead viajan juntos,
//     porque `marcarPagoAction` no comprueba que la cuota sea de ese lead.

import { CAMPOS, ENTIDADES, fuenteDe, type DestinoDetalle, type EntidadDetalle, type FiltroDim, type Formato, type IdEntidad } from './graficos-catalogo';
import type { FilaEntidad } from './graficos-agregar';
import { diasAntes } from './date-utils';
import { PIEZA_COMPLETA } from './graficos-migrar-v5';

/**
 * Lo que se clickeó. KPI → `{ dimension: null, valor: null }`; una barra, una fila o una porción → su
 * dimensión y la CLAVE del grupo (para una categoría es la etiqueta; para el tiempo, la fecha en que empieza
 * el día, la semana o el mes — «03/10» no se puede volver a leer). `metrica`: qué serie o qué escalón del
 * embudo, cuando no es la primera.
 */
export type SelDetalle = { dimension: string | null; valor: string | null; metrica?: string };

/** Qué tabs tiene el workspace: decide qué acciones se dibujan. La calcula el server. */
export type Capacidades = { crm: boolean; ads: boolean; closing: boolean; plan: boolean };
export const SIN_CAPACIDADES: Capacidades = { crm: false, ads: false, closing: false, plan: false };

/** Los ids de una fila del detalle (lib/graficos-catalogo.ts, `ENTIDADES[...].ids`). */
export type IdsFila = Partial<Record<IdEntidad, string>>;

/** El rótulo del estado de una cuota cobrada. Lo escribe el lector de pagos y lo mira «Marcar cobrada». */
export const ESTADO_COBRADO = 'Cobrado';

/**
 * Las dimensiones que el detalle usa para NOMBRAR una fila y que traen nombres de personas (`<conjunto>.<dim>`):
 * el lead, el cliente de una cuota o de una entrega, las llamadas (el título suele decir con quién fue; la de
 * venta se nombra con el lead o el email del invitado) y el título de una tarea (suele decir a quién). Ninguna
 * viaja a un modelo de IA (AGENTS: un dato con nombres de personas no se le manda a ninguno): quedan FUERA de
 * `DIMENSIONES_PUBLICAS` (lib/graficos-analisis.ts), y tests/graficos-interactividad.test.ts cruza las dos
 * listas — la próxima que se sume acá tiene que quedar afuera de allá, o el test cae.
 *
 * v5 (12/10/2026): suman los conjuntos que reemplazan a los bloques. El cliente de una cuota por cobrar y el
 * de la cartera de Customer Success son leads; el título de una tarea suele decir a quién; y una fila de
 * `llamadas_dimensiones` se nombra con la llamada (el lead o el email del invitado). Los guiones NO: se
 * nombran con el anuncio, que escribió quien armó la campaña (como `meta.anuncio`).
 */
export const DIMENSIONES_PERSONA: readonly string[] = [
  'leads.lead', 'pagos.cliente', 'entrega.cliente', 'llamadas.llamada', 'llamadas_venta.llamada', 'tareas.tarea',
  'cobranza.cliente', 'cartera.cliente', 'ejecucion.tarea', 'llamadas_dimensiones.llamada',
];

export type AccionId = 'abrir_ficha' | 'marcar_cobrada' | 'ver_anuncio' | 'ver_llamada' | 'abrir_tarea';
type Periodo = { desde: string; hasta: string };
export type AccionDef = {
  id: AccionId;
  titulo: string;
  /** Los ids que la fila tiene que traer, TODOS. */
  requiere: IdEntidad[];
  /** La tab que el workspace tiene que tener. */
  capa: keyof Capacidades;
  /**
   * `ficha` abre la ficha del lead encima · `llamada` abre la ficha de la llamada encima · `cobrar` llama a
   * marcarPagoAction con Deshacer · `link` navega.
   */
  tipo: 'ficha' | 'llamada' | 'cobrar' | 'link';
  href?: (ids: IdsFila, p: Periodo) => string;
};

/**
 * Las acciones, entidad por entidad. Lo que ya existe en MaKo, sin una sola implementación nueva:
 *   · lead    → la ficha (LeadEditModal, la misma de los desgloses de /general).
 *   · cuota   → «Marcar cobrada» (marcarPagoAction, app/crm/actions.ts), con Deshacer de 5 s.
 *   · anuncio → /anuncio/<ad_id>, la página del anuncio solo (misma puerta que el Ads Manager).
 *   · llamada → su ficha (app/dashboard/entidades/FichaLlamada.tsx), dibujada en la caja del detalle como la
 *               del lead. Hasta el 11/10/2026 era un link a /closing?call=<id>; la tab Closing se eliminó.
 *   · tarea   → /plan?tarea=<id>, que abre esa tarjeta.
 */
export const ACCIONES: readonly AccionDef[] = [
  { id: 'abrir_ficha', titulo: 'Abrir ficha', requiere: ['lead'], capa: 'crm', tipo: 'ficha' },
  { id: 'marcar_cobrada', titulo: 'Marcar cobrada', requiere: ['pago', 'lead'], capa: 'crm', tipo: 'cobrar' },
  {
    id: 'ver_anuncio', titulo: 'Ver anuncio', requiere: ['anuncio'], capa: 'ads', tipo: 'link',
    href: (ids, p) => `/anuncio/${encodeURIComponent(ids.anuncio ?? '')}?desde=${p.desde}&hasta=${p.hasta}`,
  },
  { id: 'ver_llamada', titulo: 'Ver llamada', requiere: ['llamada'], capa: 'closing', tipo: 'llamada' },
  { id: 'abrir_tarea', titulo: 'Abrir tarea', requiere: ['tarea'], capa: 'plan', tipo: 'link', href: (ids) => `/plan?tarea=${encodeURIComponent(ids.tarea ?? '')}` },
];

export type AccionFila = { id: AccionId; titulo: string; tipo: AccionDef['tipo']; href?: string };

/** Las acciones de UNA fila: las que tienen todos sus ids, cuya tab está en la capa, y que tienen sentido en su estado. */
export function accionesDeFila(fila: { ids: IdsFila; estado: string | null }, puede: Capacidades, periodo: Periodo): AccionFila[] {
  const out: AccionFila[] = [];
  for (const a of ACCIONES) {
    if (!puede[a.capa]) continue;
    if (!a.requiere.every((k) => typeof fila.ids[k] === 'string' && fila.ids[k] !== '')) continue;
    // Una cuota ya cobrada no se vuelve a cobrar (desmarcarla es un error de carga: va en su ficha).
    if (a.id === 'marcar_cobrada' && fila.estado === ESTADO_COBRADO) continue;
    out.push({ id: a.id, titulo: a.titulo, tipo: a.tipo, ...(a.href ? { href: a.href(fila.ids, periodo) } : {}) });
  }
  return out;
}

// ── Las acciones EN LA FILA de una tabla (v5, `Grafico.tabla.acciones`) ───────────────────────────

/**
 * Qué id de entidad nombra una fila de una tabla agrupada por `dimension`: la fila trae `ref` = `r[dimension]`
 * (lib/graficos-agregar.ts), y la entidad declara en `ids` qué clave de `r` es cada id. «A quién cobrarle»
 * agrupa por `cliente` → el id `lead`; las llamadas por `llamada` → el id `llamada`. `null` = esa dimensión no
 * es un id de la entidad del conjunto: la tabla no lleva acciones (no se sabe a quién).
 */
export function idDeDimension(fuenteId: string, dimension: string | null): IdEntidad | null {
  const ent = ENTIDADES[fuenteId];
  if (!ent || !dimension) return null;
  const par = (Object.entries(ent.ids) as Array<[IdEntidad, string]>).find(([, ref]) => ref === dimension);
  return par ? par[0] : null;
}

/**
 * Las filas del detalle (la lista de entidades del gráfico ENTERO, con sus ids de la MISMA fila del server)
 * por el valor del id que nombra cada fila de la tabla. Un valor que aparece en DOS filas del detalle (dos
 * cuotas del mismo cliente) no entra: elegir la primera sería cobrar una cuota que nadie eligió.
 */
export function filasPorId(filas: readonly FilaDetalle[], id: IdEntidad): Map<string, FilaDetalle> {
  const out = new Map<string, FilaDetalle>();
  const repetidos = new Set<string>();
  for (const f of filas) {
    const v = f.ids[id];
    if (!v) continue;
    if (out.has(v)) repetidos.add(v);
    else out.set(v, f);
  }
  for (const v of repetidos) out.delete(v);
  return out;
}

// ── Las acciones del ELEMENTO «Acción» (v5, I8 del contrato) ──────────────────────────────────────

/**
 * Un botón suelto en la hoja o en un pop-up. Martín (12/10/2026): «Sincronizar llamadas: el cron de siempre +
 * un elemento "Acción" en la hoja Closing». Cada una pasa por la PUERTA que ya existe (app/api/closing/**, con
 * su guarda de rol: admin o closer, app/api/closing/puerta.ts): acá no hay una implementación nueva de nada.
 *
 *   · `donde`: 'hoja' = no necesita contexto (sincronizar); 'llamada' = adentro del pop-up de una llamada,
 *     con su recording_id (el `ref` del clic); 'entidad' = la ficha de lo que se abrió, sea lo que sea.
 *   · `escribe`: pide confirmar ANTES, con la consecuencia pegada al botón (AGENTS.md). Las que sólo abren algo
 *     no confirman.
 *   · `tipo`: 'post' llama a la ruta con su tope (`postearTarea`, que no afirma un fallo cuando se vence);
 *     'revisar' abre la ficha de la llamada con el formulario de revisión abierto; 'ficha' abre la ficha de lo
 *     que se abrió (la llamada, el lead) o, para un anuncio, su página.
 *   · Sin `capa`, a propósito: quien decide es la RUTA (la puerta de Closing mira la capa y el rol). La pantalla
 *     no tiene la capa a mano, y un campo que nadie lee es una regla escrita en ningún lado.
 * El test (tests/graficos-ia-elemento.test.ts) exige que cada `puerta.ruta` exista y pase por `puertaClosing`.
 */
export type AccionElementoId = 'sincronizar_llamadas' | 'reanalizar_llamada' | 'revisar_llamada' | 'abrir_ficha';
export type AccionElementoDef = {
  id: AccionElementoId;
  /** El rótulo por default del botón (quien arma la hoja lo puede cambiar). */
  titulo: string;
  donde: 'hoja' | 'llamada' | 'entidad';
  escribe: boolean;
  /** Lo que pasa si se confirma, en una frase: va pegado al botón (sólo las que escriben). */
  consecuencia?: string;
  tipo: 'post' | 'revisar' | 'ficha';
  /** La ruta que ya existe y su tope (el `maxDuration` de la ruta más un margen). */
  puerta?: { ruta: string; topeMs: number; cuerpo: (ref: string | null) => Record<string, unknown> | null };
  /** Lo que dice mientras corre, con cuánto puede tardar (un giro mudo de minutos se lee colgado). */
  enCurso?: string;
};

export const ACCIONES_ELEMENTO: readonly AccionElementoDef[] = [
  {
    id: 'sincronizar_llamadas', titulo: 'Sincronizar llamadas', donde: 'hoja', escribe: true, tipo: 'post',
    consecuencia: 'Trae de Fathom las llamadas nuevas y las analiza.',
    // POST /api/closing/sync (maxDuration 300). Es la MISMA puerta del botón del bloque de antes.
    puerta: { ruta: '/api/closing/sync', topeMs: 305_000, cuerpo: () => ({}) },
    enCurso: 'Sincronizando · hasta 5 min',
  },
  {
    id: 'reanalizar_llamada', titulo: 'Re-analizar', donde: 'llamada', escribe: true, tipo: 'post',
    consecuencia: 'Pisa el análisis y lo corregido a mano.',
    // POST /api/closing/analyze (maxDuration 120): la MISMA de la ficha. Sin una llamada, no hay pedido.
    puerta: { ruta: '/api/closing/analyze', topeMs: 125_000, cuerpo: (ref) => (ref && /^\d+$/.test(ref) ? { recording_id: Number(ref) } : null) },
    enCurso: 'Re-analizando · hasta 2 min',
  },
  { id: 'revisar_llamada', titulo: 'Revisar', donde: 'llamada', escribe: false, tipo: 'revisar' },
  { id: 'abrir_ficha', titulo: 'Abrir la ficha', donde: 'entidad', escribe: false, tipo: 'ficha' },
];

export const accionElementoDe = (id: string | null | undefined): AccionElementoDef | undefined => ACCIONES_ELEMENTO.find((a) => a.id === id);

// ── Lo que se abrió: la entidad de un pop-up y sus PIEZAS (v5, I3/I4 del contrato) ────────────────

/** Las entidades que tienen ficha que partir en piezas (app/dashboard/entidades/**). */
export type TipoEntidad = 'llamada' | 'anuncio' | 'lead';
export type ContextoEntidad = { tipo: TipoEntidad; ref: string };

/**
 * Qué se abrió con un clic, si es una entidad con ficha: el pop-up de una tabla de llamadas por «Llamada» abre
 * ESA llamada; el de un cuadrante de guiones por «Guion», ese anuncio. El clic trae `ref` = `r[dimension]` (la
 * fila del server, lib/graficos-agregar.ts), y sólo nombra a la entidad si la dimensión ES la entidad: la que
 * la nombra (`nombre[0]`) o la de su id (`ref`). Una barra por closer no abre a nadie, aunque traiga un ref.
 * Lo usan el pop-up (P5) para pasarle el contexto a las piezas y a las cajas de IA, y el server de las cajas
 * para no creerle al navegador qué es cada cosa.
 */
export function contextoDeClic(sel: { fuente: string; dimension: string | null; ref?: string | null }): ContextoEntidad | null {
  const ent = ENTIDADES[sel.fuente];
  if (!ent || !sel.dimension || !sel.ref) return null;
  const tipo = ent.entidad === 'llamada' || ent.entidad === 'anuncio' || ent.entidad === 'lead' ? ent.entidad : null;
  if (!tipo) return null;
  if (sel.dimension !== ent.nombre[0] && sel.dimension !== ent.ref) return null;
  // Los tres se nombran con un número: un recording_id de Fathom, un ad_id de Meta, el id de un lead.
  return /^\d{1,20}$/.test(sel.ref) ? { tipo, ref: sel.ref } : null;
}

/**
 * Las piezas de cada ficha, en el orden del menú. `completo` (PIEZA_COMPLETA, lib/graficos-migrar-v5.ts) es la
 * ficha ENTERA, la que la migración de los bloques pone en los pop-ups «Llamada» y «Anuncio». Las demás son
 * sus secciones sueltas: quien arma el pop-up elige cuáles y dónde. Lo de la llamada sale de GET
 * /api/closing/llamada (y el transcript, de Fathom en vivo); lo del anuncio, de /api/ad-insights y
 * /api/ads-analyst/view; lo del lead, de su ficha del CRM. Ninguna pieza lee otra cosa.
 * ⚠️ Los «action items» de Fathom NO están: su API no los entrega por grabación (el listado ignora el filtro
 * por recording_id, lib/fathom-api.ts), y bajarlos sería barrer todas las reuniones en cada apertura.
 */
export const PIEZAS_ENTIDAD: Readonly<Record<TipoEntidad, ReadonlyArray<{ id: string; nombre: string }>>> = {
  llamada: [
    { id: PIEZA_COMPLETA, nombre: 'La ficha entera' },
    { id: 'cabecera', nombre: 'Puntaje y desenlace' },
    { id: 'reproductor', nombre: 'Grabación' },
    { id: 'resumen', nombre: 'Resumen' },
    { id: 'proximo_paso', nombre: 'Próximo paso' },
    { id: 'dimensiones', nombre: 'Dimensiones' },
    { id: 'fortalezas', nombre: 'Fortalezas y a mejorar' },
    { id: 'objeciones', nombre: 'Objeciones' },
    { id: 'coaching', nombre: 'Coaching' },
    { id: 'momentos', nombre: 'Momentos' },
    { id: 'transcript', nombre: 'Transcript' },
  ],
  anuncio: [
    { id: PIEZA_COMPLETA, nombre: 'La ficha entera' },
    { id: 'creativo', nombre: 'Creativo' },
    { id: 'numeros', nombre: 'Números del período' },
    { id: 'diario', nombre: 'Rendimiento diario' },
    { id: 'audiencia', nombre: 'Audiencia' },
    { id: 'guion', nombre: 'Guion' },
    { id: 'diagnostico', nombre: 'Diagnóstico' },
    { id: 'transcript', nombre: 'Transcript' },
  ],
  lead: [
    { id: PIEZA_COMPLETA, nombre: 'La ficha' },
    { id: 'resumen', nombre: 'Resumen' },
    { id: 'pagos', nombre: 'Pagos' },
  ],
};
export const piezaDe = (tipo: TipoEntidad, pieza: string) => PIEZAS_ENTIDAD[tipo].find((p) => p.id === pieza);

/**
 * Qué entidad abre el pop-up de este gráfico (la misma regla que `contextoDeClic`, sin el clic): lo que el panel
 * de una pieza o de una caja necesita saber MIENTRAS se arma el pop-up, cuando todavía no hay nada abierto.
 */
export function entidadDeGrafico(g: { fuente: string; dimension: string | null }): TipoEntidad | null {
  const ent = ENTIDADES[g.fuente];
  if (!ent || !g.dimension || (g.dimension !== ent.nombre[0] && g.dimension !== ent.ref)) return null;
  return ent.entidad === 'llamada' || ent.entidad === 'anuncio' || ent.entidad === 'lead' ? ent.entidad : null;
}

/**
 * Con qué nace un elemento «Acción» o «Ficha» al insertarlo: el saneo descarta uno sin acción o sin pieza
 * (lib/graficos-catalogo.ts, `sanearElemento`), así que el que inserta tiene que traerlas. En la hoja, la única
 * acción que no necesita contexto (sincronizar); en el pop-up de una llamada, re-analizarla; en otro, abrir su
 * ficha. Una Ficha nace entera (`completo`).
 */
export function accionInicial(entidad: TipoEntidad | null): { id: AccionElementoId; rotulo: string } {
  const id: AccionElementoId = !entidad ? 'sincronizar_llamadas' : entidad === 'llamada' ? 'reanalizar_llamada' : 'abrir_ficha';
  return { id, rotulo: ACCIONES_ELEMENTO.find((a) => a.id === id)!.titulo };
}
export const piezaInicial = (tipo: TipoEntidad): { tipo: TipoEntidad; pieza: string } => ({ tipo, pieza: PIEZA_COMPLETA });

/**
 * ¿Este botón se puede usar acá? `null` = sí; si no, el motivo corto que dice el panel (nunca un botón que no
 * hace nada: AGENTS.md). Una acción de una llamada fuera del pop-up de una llamada no tiene a quién.
 */
export function accionElementoDisponible(a: AccionElementoDef, contexto: ContextoEntidad | null): string | null {
  if (a.donde === 'llamada' && (contexto?.tipo !== 'llamada' || !contexto.ref)) return 'Sólo en el pop-up de una llamada';
  if (a.donde === 'entidad' && !contexto?.ref) return 'Sólo adentro de un pop-up';
  return null;
}

/**
 * El campo de los controles (CAMPOS) que corresponde a una dimensión de categoría: lo que usa «Filtrar la
 * página por esto». Uno compartido (Campaña) gana sobre el propio del conjunto, así filtra también los
 * gráficos de los otros conjuntos donde significa lo mismo. `null` = el tiempo o algo que no existe.
 */
export function campoParaFiltrar(fuenteId: string, dimension: string | null): string | null {
  if (!dimension) return null;
  const d = fuenteDe(fuenteId)?.dimensiones.find((x) => x.id === dimension);
  if (!d || d.clase !== 'categoria') return null;
  return CAMPOS.find((c) => c.en[fuenteId] === dimension)?.id ?? null;
}

const TIEMPOS = new Set(['dia', 'semana', 'mes']);
export const esDimensionTiempo = (d: string | null | undefined): boolean => !!d && TIEMPOS.has(d);
const dos = (n: number) => String(n).padStart(2, '0');

/** El tramo de días de un grupo de tiempo, desde su clave (el lunes de la semana, el 1 del mes). */
export function rangoDeClave(dim: string, clave: string): Periodo | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clave)) return null;
  if (dim === 'dia') return { desde: clave, hasta: clave };
  if (dim === 'semana') return { desde: clave, hasta: diasAntes(clave, -6) };
  if (dim === 'mes') {
    const [y, m] = clave.split('-').map(Number);
    const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { desde: `${y}-${dos(m)}-01`, hasta: `${y}-${dos(m)}-${dos(ultimo)}` };
  }
  return null;
}

export type PlanDetalle = {
  desde: string;
  hasta: string;
  /** Los filtros del gráfico y el del grupo clickeado, ya en las dimensiones del conjunto del detalle. */
  filtros: FiltroDim[];
  /** Los filtros del gráfico que el conjunto del detalle no puede aplicar (sus nombres): se dicen, no se callan. */
  noAplica: string[];
  /** El grupo clickeado no existe en el conjunto del detalle: listar sería listar TODO, y eso mentiría. */
  grupoPerdido: boolean;
};

/**
 * Cómo se lee el detalle: los filtros del gráfico (en las dimensiones de SU conjunto) traducidos al conjunto
 * del detalle por los CAMPOS compartidos, más el grupo clickeado — una categoría es un filtro más; un día,
 * una semana o un mes acotan el período. `agrupar` es el «agrupar por» que la vista le puso al gráfico: con
 * él, la clave clickeada es de una semana aunque el gráfico diga «por día».
 */
export function planDetalle(origen: string, destino: DestinoDetalle, filtros: FiltroDim[], sel: SelDetalle, periodo: Periodo, agrupar?: string | null): PlanDetalle {
  const traducir = (dim: string): string | null => {
    if (origen === destino.fuente) return dim;
    return CAMPOS.find((c) => c.en[origen] === dim)?.en[destino.fuente] ?? null;
  };
  const nombreDe = (dim: string) => CAMPOS.find((c) => c.en[origen] === dim)?.nombre ?? dim;
  const out: PlanDetalle = { desde: periodo.desde, hasta: periodo.hasta, filtros: [], noAplica: [], grupoPerdido: false };
  for (const f of filtros) {
    const d2 = traducir(f.dimension);
    if (d2) out.filtros.push({ ...f, dimension: d2 });
    else out.noAplica.push(nombreDe(f.dimension));
  }
  if (sel.dimension && sel.valor != null) {
    if (esDimensionTiempo(sel.dimension)) {
      const dimT = esDimensionTiempo(agrupar) ? agrupar! : sel.dimension;
      const r = rangoDeClave(dimT, sel.valor);
      if (!r) out.grupoPerdido = true;
      else {
        if (r.desde > out.desde) out.desde = r.desde;
        if (r.hasta < out.hasta) out.hasta = r.hasta;
      }
    } else {
      const d2 = traducir(sel.dimension);
      if (d2) out.filtros.push({ dimension: d2, valores: [sel.valor] });
      else out.grupoPerdido = true;
    }
  }
  return out;
}

/**
 * Lo leído, recortado al tramo clickeado cuando el conjunto se lee ENTERO (una fecha «hoy», `sinRango`): ese
 * lector no mira el período, así que el día, la semana o el mes del grupo se aplican acá. Sin esto, el detalle
 * de «las tareas creadas el 03/10» de un gráfico de tareas «hoy» listaba TODAS las tareas.
 */
export function recortarAlTramo<T extends { f: string | null }>(filas: T[], plan: Periodo, sel: SelDetalle, sinRango: boolean): T[] {
  if (!sinRango || !esDimensionTiempo(sel.dimension) || sel.valor == null) return filas;
  return filas.filter((x) => !!x.f && x.f >= plan.desde && x.f <= plan.hasta);
}

/** Una fila del detalle, lista para dibujar. */
export type FilaDetalle = {
  id: string;
  nombre: string;
  /** Lo que va chico abajo: la campaña y el conjunto de un anuncio, la etapa de un lead. */
  linea: string | null;
  /** La última fecha de la entidad en el período (la reunión, el pago). */
  fecha: string | null;
  /** En el orden de `columnas` de la respuesta. */
  valores: Array<number | null>;
  ids: IdsFila;
  estado: string | null;
};
export type ColumnaDetalle = { id: string; nombre: string; formato: Formato };
export type RespuestaDetalle =
  | {
    ok: true;
    /** `null` = ese número no tiene cosas atrás que listar: el detalle sólo ofrece filtrar. */
    entidad: EntidadDetalle | null;
    plural: string | null;
    columnas: ColumnaDetalle[];
    filas: FilaDetalle[];
    /** Las que aportaban y no entraron por el tope. */
    fuera: number;
    /** Las filas sin id (no se pueden listar como una cosa). */
    sinId: number;
    noAplica: string[];
    desde: string;
    hasta: string;
    puede: Capacidades;
    /** El hoy del negocio: la fecha con que se marca un cobro. */
    hoy: string;
  }
  | { ok: false; error: string };

/**
 * De una entidad agrupada a la fila que se dibuja: el nombre y la línea con las dimensiones que declara
 * `ENTIDADES`, los ids con sus referencias, y los valores de las columnas que se muestran (la métrica que
 * decide quién entra puede no ser una de ellas). `metricas` es el orden en que se agregó.
 */
export function aFilaDetalle(fuenteId: string, fe: FilaEntidad, metricas: string[], columnas: string[]): FilaDetalle | null {
  const ent = ENTIDADES[fuenteId];
  if (!ent) return null;
  const juntar = (dims: string[]) => dims.map((k) => fe.d[k]).filter((x): x is string => !!x && !!x.trim()).join(' · ');
  const ids: IdsFila = {};
  for (const [k, ref] of Object.entries(ent.ids) as Array<[IdEntidad, string]>) {
    const v = ref === ent.ref ? fe.id : fe.r[ref];
    if (v) ids[k] = v;
  }
  return {
    id: fe.id,
    nombre: juntar(ent.nombre) || '(sin nombre)',
    linea: juntar(ent.linea) || null,
    fecha: fe.hasta ?? null,
    valores: columnas.map((c) => { const i = metricas.indexOf(c); return i < 0 ? null : fe.valores[i] ?? null; }),
    ids,
    estado: fe.d.estado ?? null,
  };
}

// ── La leyenda que prende y apaga series (lo que hacía el selector de métricas de la vieja Tendencias) ──

/**
 * Prende o apaga la serie `k`. La ÚLTIMA visible no se apaga: un gráfico sin series se lee como «no hay
 * datos». Devuelve el mismo conjunto si no cambió nada (React no redibuja).
 */
export function alternarSerie(prev: ReadonlySet<string>, k: string, claves: readonly string[]): ReadonlySet<string> {
  const n = new Set(prev);
  if (n.has(k)) { n.delete(k); return n; }
  if (!claves.some((x) => x !== k && !n.has(x))) return prev;
  n.add(k);
  return n;
}
/** ¿La serie `k` está apagada? Si quedaron TODAS apagadas (cambiaron las métricas del gráfico), ninguna. */
export const serieOculta = (ocultas: ReadonlySet<string>, k: string, claves: readonly string[]): boolean =>
  ocultas.has(k) && claves.some((x) => !ocultas.has(x));
