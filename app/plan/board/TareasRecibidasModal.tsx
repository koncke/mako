'use client';

// =============================================================================
// TareasRecibidasModal — "confirmá estas tareas" al entrar al plan
// =============================================================================
// Dos cosas caen acá, y las dos SIN crear nada por atrás:
//
//   · MaKo detectó sola reuniones nuevas del equipo en Fathom, sacó los compromisos
//     y los dejó esperando (cron fathom-plan). Entrás al plan y te los muestra.
//   · Otra persona te mandó las tareas que asumiste en la reunión que tuvieron
//     ("Martín te envió estas tareas…").
//
// TODAS JUNTAS, no de a una: si MaKo leyó tres reuniones, el WhatsApp avisa una vez
// y acá se ven las tres en la misma pantalla (agrupadas por reunión, con su fecha).
// Antes se mostraba solo la primera y los números no cerraban con el mensaje.
//
// Confirmás lo que va (y sacás lo que no) y recién ahí se crean, con el Perro
// puntuándolas server-side —una sola pasada sobre todo el lote— igual que cualquier
// otra tarea. "Ahora no" cierra sin descartar: siguen esperándote.

import { useEffect, useMemo, useRef, useState } from 'react';
import { GuardianIcon } from './GuardianIcon';
import { WizardShell } from '@/app/_components/WizardShell';
import { SvcIcon } from '../../_components/ServicioVisual';
import { ReunionTareas, type FilaTarea, type TareaYaCargada } from './ReunionTareas';
import { PreguntaCampo } from './guardian-form';
import { ayudaDePregunta, type TipoPregunta } from '@/lib/preguntas-contrato';
import { pareceLaMisma, textoRepetidas, type TareaEnTablero } from '@/lib/tareas-dedup';
import { type Label, type Prio } from './types';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

type PropTarea = { titulo: string; proyecto?: string; deadline?: string; detalle?: string; prioridad?: Prio; dueno?: string; duenoEmail?: string; esDeOtro?: boolean; minuto?: number; minutos?: number[]; incluir?: boolean;
  /** el cruce anti-duplicados YA guardado (mig 0123): no se vuelve a correr. */
  enriquece?: { id: string; razon: string; confianza?: 'alta' | 'media' }; ampliar?: boolean;
  /** el dueño destildó la AMPLIACIÓN: no se le suma nada a la tarjeta. */
  omitir?: boolean };
// El `tipo` es el del contrato, NO un `string` suelto: mientras fue string, el
// compilador no podía avisar que esta pantalla y la de /plan/revisar dibujaban cosas
// distintas para el mismo valor (y de hecho lo hacían).
type PropPregunta = { pregunta: string; tipo?: TipoPregunta; opciones?: string[]; sobre?: string[] };

/** Título comparable: sin acentos, sin puntuación, en minúscula. */
const normTit = (t: string): string =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
export type PropuestaPendiente = {
  id: string; resumen: string; origen?: string; tareas: PropTarea[]; createdAt: string;
  /** El estado REAL de la fila. Una reunión ya aplicada o descartada se sigue pudiendo
   *  abrir —lo que salió de esa charla no desaparece— pero en modo lectura. */
  estado?: 'pendiente' | 'aplicada' | 'descartada';
  enviadoPor?: string; fuenteTitulo?: string; fuenteUrl?: string; fuenteFecha?: string; ref?: string;
  /** si trae preguntas, se confirma en el wizard /plan/revisar, no acá. */
  preguntas?: PropPregunta[];
  /** las que MaKo dice que YA ESTÁN HECHAS. Igual que las preguntas: mandan al wizard,
   *  porque cada una se mira de a una con su evidencia delante. */
  cerrar?: Array<{ id: string; titulo?: string; evidencia: string; confianza?: string }>;
  /** las tuyas que ya cargaste: el borrador siguió abierto por las de los demás. */
  aplicadas?: Array<{ titulo: string; tareaId: string; minutos?: number[] }>;
  /** cuándo corrió el cruce anti-duplicados (mig 0123). Sin esto se rehacía en cada apertura. */
  cruzadoAt?: string;
};

async function api(body: Record<string, unknown>): Promise<Record<string, unknown> & { ok: boolean; error?: string }> {
  return fetch('/api/plan-propuesta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) }));
}

/** El recordingId que dejó el cron en `ref` (fathom:12345) — habilita mandarle a otros. */
const recordingDeRef = (ref?: string): number | undefined => {
  const n = Number((ref ?? '').startsWith('fathom:') ? ref!.slice(7) : NaN);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * ¿Esta fila AMPLÍA una tarjeta que ya existe, en vez de crear una nueva?
 *
 * `ampliar === false` es «no es la misma», dicho por el dueño: esa vuelve a ser candidata
 * nueva. `omitir` es «no hagas nada con esto».
 *
 * Vive afuera del componente para que la cuenta de altas y la de ampliaciones salgan de
 * la MISMA definición: cuando cada una tenía la suya, el botón prometía 16 altas sobre
 * una reunión que no creaba ninguna.
 */
/** «3 para cargar · 16 para ampliar» — lo que va a pasar, en el título. */
const resumenAccion = (nuevas: number, amplia: number): string =>
  [nuevas ? `${nuevas} ${nuevas === 1 ? 'tarea' : 'tareas'} para cargar` : '',
    amplia ? `${amplia} para ampliar` : ''].filter(Boolean).join(' · ') || 'nada para cargar';

/** El botón NOMBRA lo que hace. Nunca «Cargar N» cuando no crea ninguna. */
const etiquetaAccion = (nuevas: number, amplia: number): string =>
  nuevas && amplia ? `Cargar ${nuevas} y ampliar ${amplia}`
    : nuevas ? `Cargar ${nuevas} al plan`
      : amplia ? `Ampliar ${amplia} que ya ${amplia === 1 ? 'está' : 'están'}`
        : 'Cargar al plan';

export const esAmpliarFila = (f: { enriquece?: { id: string }; ampliar?: boolean; esDeOtro?: boolean; omitir?: boolean }): boolean =>
  !!f.enriquece?.id && f.ampliar !== false && !f.esDeOtro && !f.omitir;

/** Fila con la marca de a qué borrador pertenece, para aplicar cada uno por separado. */
/** `proyectoPropuesto` = el nombre que dijo MaKo, aunque ese proyecto no exista todavía. */
type FilaConProp = FilaTarea & { propId: string; proyectoPropuesto?: string };

import { useCapaModal } from '@/app/_components/pila-modales';

export function TareasRecibidasModal({ props: todos, labels, existentes, onListo, onClose, onDescartadas, onAbrirTarea, renderTaskCard, oculto }: {
  props: PropuestaPendiente[];
  labels: Label[];
  /** Lo que YA está en el tablero, para no volver a ofrecer lo que ya existe. */
  existentes?: TareaEnTablero[];
  /** hay otro modal adelante: se esconde SIN desmontarse (para no perder la revisión). */
  oculto?: boolean;
  /** abrir la tarjeta de una tarea YA cargada (el modal se esconde detrás y vuelve al cerrarla). */
  onAbrirTarea?: (id: string) => void;
  /** pinta una tarea YA creada con la tarjeta real del board (null si ya no existe). */
  renderTaskCard?: (id: string) => React.ReactNode;
  /** se aplicó: el board recarga para mostrar las tareas nuevas ya puntuadas. */
  onListo: () => void;
  /** cerrar SIN decidir: los borradores siguen esperando (se reabren desde Fathom). */
  onClose: () => void;
  /** se descartaron de verdad: ya no hay nada pendiente. */
  onDescartadas: () => void;
}) {
  // Los borradores de REUNIÓN traen sus preguntas cerradas y se responden acá, en el
  // paso previo a cargar. Los de WhatsApp (que además proponen bajas) siguen yendo al
  // wizard de /plan/revisar, que es donde se resuelven de a una.
  // CERRADO = ya se aplicó entero o se descartó. La reunión igual se abre —lo que salió
  // de una charla no desaparece— pero en modo LECTURA: sin «Agregar al plan» (el server
  // lo rechaza con «la propuesta ya fue aplicada») y sin autosave (guardarRevision exige
  // 'pendiente' y devolvía false en silencio, así que cada corrección se tiraba al vacío).
  const cerrado = todos.length > 0 && todos.every((p) => p.estado === 'aplicada' || p.estado === 'descartada');
  // DESCARTADO ≠ SIN NADA. Si de esta reunión salió aunque sea una tarea al plan, decir
  // «la descartaste» a secas es falso: lo que se descartó fue lo que quedaba, no la
  // reunión. Lo que se descartó se sigue viendo, tachado, para que se entienda qué pasó
  // con cada cosa en vez de que desaparezca.
  const descartadoConCargas = todos.some((p) => p.estado === 'descartada' && (p.aplicadas?.length ?? 0) > 0);
  // Pila de modales: abrir la tarjeta de una tarea desde acá esconde ESTE modal y al
  // cerrarla volvés al mismo lugar de la revisión, con el scroll donde estaba.
  const capa = useCapaModal(!oculto);
  // Un borrador que propone CIERRES va al wizard sí o sí, aunque no traiga preguntas.
  // No es una limitación: es la decisión de diseño del canal. Un cierre se mira de a uno,
  // con su evidencia delante y tres respuestas posibles («sí» / «está a medias» / «no»),
  // porque la precisión medida de un «ya está hecho» dicho por IA fue 8 de 17. Confirmarlo
  // acá, en una lista con casillas, es exactamente la pantalla que no queremos.
  const alWizard = (p: PropuestaPendiente) => (p.origen !== 'fathom' && !!p.preguntas?.length) || (p.cerrar?.length ?? 0) > 0;
  const props = todos.filter((p) => !alWizard(p));
  const conPreguntas = todos.filter(alWizard);
  // Las preguntas de los borradores que SÍ se confirman acá.
  const preguntasTodas = props.flatMap((p) => (p.preguntas ?? []).map((q) => ({ ...q, propId: p.id })));
  const [paso, setPaso] = useState<'tareas' | 'preguntas'>('tareas');
  const [respuestas, setRespuestas] = useState<Record<number, string>>({});
  // Las preguntas se piden RECIÉN cuando el dueño terminó de elegir, y sobre las tareas
  // que de verdad va a cargar. Antes venían del cron —armadas sobre TODO lo que sacó la
  // reunión— y le preguntaban por trabajo que había destildado o pasado a otro; encima
  // salían genéricas, porque una pregunta que habla de 40 tareas a la vez no puede ser
  // concreta. Se muestran DE A UNA, como el resto de los formularios de la app.
  const [preguntasIA, setPreguntasIA] = useState<PropPregunta[] | null>(null);
  const [pensando, setPensando] = useState(false);
  /** El Perro está cruzando contra el tablero. Mientras dure, la pantalla NO deja
   *  cargar: si no, se confirma un lote que dos segundos después iba a quedar marcado
   *  como repetido, y quedan duplicados en el board. */
  const [cruzando, setCruzando] = useState(false);
  /** El cruce terminó en ESTA sesión: el autosave lo sella en la base (`cruzado_at`)
   *  para que no se vuelva a correr la próxima vez que se abra la reunión. */
  const [cruzado, setCruzado] = useState(false);
  const [qIdx, setQIdx] = useState(0);
  // Init perezoso (el padre monta con una key que depende de los ids: si cambian, es
  // un componente nuevo y no hace falta re-sincronizar por efecto).
  const [filas, setFilas] = useState<FilaConProp[]>(() => {
    const idPorNombre = new Map(labels.map((l) => [l.name.trim().toLowerCase(), l.id]));
    const abiertas = (existentes ?? []).filter((t) => !t.hecha);
    // Además del tablero, se cruza contra las tareas de los OTROS borradores de este
    // mismo modal: la misma reunión grabada por dos personas llega como dos borradores
    // distintos, con los mismos compromisos escritos con otras palabras. Se MARCA con
    // el umbral bajo (pareceLaMisma) — nunca se descarta, porque a ese umbral el
    // parecido a veces es solo parecido.
    const deOtrosBorradores: TareaEnTablero[] = [];
    /**
     * ¿La fila nace tildada? UN solo lugar donde se decide, por orden de autoridad:
     *   1. Lo que YA decidió el dueño (`incluir`, `ampliar`) — manda siempre.
     *   2. Es de otra persona → no.
     *   3. El cruce la marcó CON CONFIANZA ALTA → no (se le suma contexto, no se crea).
     *      Con confianza media entra TILDADA: un falso positivo destildado esconde un
     *      pedido real de una reunión, y eso ya pasó.
     *   4. Si no, sí.
     */
    const tildada = (t: PropTarea): boolean => {
      if (t.ampliar === false) return true;          // «no es la misma», dicho por el dueño
      if (t.incluir === false) return false;
      if (t.esDeOtro) return false;
      return t.enriquece?.confianza !== 'alta';
    };
    const yaEnPlan = (titulo: string): { id: string; razon: string } | null => {
      const enBoard = abiertas.find((x) => pareceLaMisma(x.titulo, titulo).si);
      if (enBoard) return { id: enBoard.id, razon: `ya está en tu plan como «${enBoard.titulo}»` };
      const enOtro = deOtrosBorradores.find((x) => pareceLaMisma(x.titulo, titulo).si);
      if (enOtro) return { id: '', razon: `la misma reunión ya la trae como «${enOtro.titulo}»` };
      return null;
    };
    return props.flatMap((p) => p.tareas.map((t) => ({
      propId: p.id,
      // El borrador se descartó: la fila se sigue viendo, TACHADA. Que lo que decidiste
      // no hacer desaparezca de la pantalla es peor que verlo: al volver a la reunión no
      // se entiende qué pasó con cada cosa.
      descartada: p.estado === 'descartada',
      titulo: t.titulo, detalle: t.detalle ?? '', prioridad: (t.prioridad ?? 'media') as Prio,
      proyectoId: t.proyecto ? idPorNombre.get(t.proyecto.trim().toLowerCase()) ?? null : null,
      // El nombre CRUDO que propuso MaKo. Si ese proyecto todavía no existe en el
      // tablero, `proyectoId` queda null y —sin guardar esto— el nombre se perdía al
      // aplicar: la tarea entraba SIN proyecto aunque el server sabe crearlo por nombre.
      proyectoPropuesto: (t.proyecto ?? '').trim(),
      dueño: t.dueno, dueñoEmail: t.duenoEmail, esDeOtro: t.esDeOtro, minuto: t.minuto, minutos: t.minutos,
      // `incluir` sale de UN solo cálculo (`tildada`), abajo: mientras estuvo acá y
      // además adentro del spread del cruce, la segunda pisaba a la primera y cuál
      // ganaba dependía del orden de las líneas.
      incluir: tildada(t),
      // ¿Esta ya está en el plan? La misma reunión se puede grabar dos veces (un
      // notetaker por participante) y el mismo compromiso puede volver en la junta
      // siguiente. Se marca y —solo si el cruce está seguro— nace DESTILDADA.
      // El cruce GUARDADO manda sobre el léxico: si el borrador ya trae el resultado del
      // Perro, ése es el bueno (y con él viene la decisión que tomó el dueño en `ampliar`).
      ...(t.enriquece
        ? { enriquece: t.enriquece, ampliar: t.ampliar, omitir: t.omitir }
        : yaEnPlan(t.titulo) ? { enriquece: yaEnPlan(t.titulo)! } : {}),
      // La fecha de la REUNIÓN. Si el borrador no la trae (lo dejó una versión vieja
      // del cron), va SIN fecha: caer a createdAt mostraba la hora a la que corrió el
      // cron como si fuera la hora de la reunión — "tuviste una reunión hoy" cuando la
      // reunión había sido tres semanas antes.
      reunion: { recordingId: recordingDeRef(p.ref), titulo: p.fuenteTitulo ?? '', fecha: p.fuenteFecha ?? null, url: p.fuenteUrl ?? null },
    })).map((fila) => { deOtrosBorradores.push({ id: '', titulo: fila.titulo, hecha: false }); return fila; }));
  });

  // Solo se pregunta por lo que REALMENTE vas a cargar. MaKo arma las preguntas cuando
  // lee la reunión; vos reasignás ("no es mía") y destildás recién al confirmar, horas
  // después. Sin esto te preguntaba por el trabajo de otro: cada pregunta declara de qué
  // tareas habla (`sobre`) y se cae sola si ninguna sobrevivió de tu lado.
  const preguntas = useMemo(() => {
    const vivos = new Set(filas.filter((f) => f.incluir && !f.esDeOtro).map((f) => normTit(f.titulo)));
    const hablaDeAlgoMio = (t: string): boolean => {
      const n = normTit(t);
      if (vivos.has(n)) return true;
      // El modelo a veces recorta o alarga el título al citarlo: vale que uno contenga al otro.
      for (const v of vivos) if (v.length > 12 && n.length > 12 && (v.includes(n) || n.includes(v))) return true;
      return false;
    };
    // Sin `sobre` (borradores viejos) no hay con qué decidir: se muestran, como antes.
    // Una comparación ("¿A o B?") pierde el sentido si B se fue: ahí se piden TODAS.
    return preguntasTodas.filter((q) => !q.sobre?.length
      || (q.tipo === 'comparacion' ? q.sobre.every(hablaDeAlgoMio) : q.sobre.some(hablaDeAlgoMio)));
  }, [preguntasTodas, filas]);

  const [guardando, setGuardando] = useState<'' | 'aplicar' | 'descartar'>('');
  // En qué tab está parado el usuario: null = «Mías». Cambia el pie entero.
  const [personaActiva, setPersonaActiva] = useState<string | null>(null);
  // El nodo del pie donde `PanelPersona` portalea sus tres botones. Va como STATE y no
  // como `useRef`: un ref no dispara render, así que el portal se pintaba un ciclo
  // tarde — o sea nunca, porque el nodo aparece y desaparece con la tab.
  const [pieSlot, setPieSlot] = useState<HTMLDivElement | null>(null);
  const [err, setErr] = useState('');
  const nombreProyecto = (id: string | null) => labels.find((l) => l.id === id)?.name;
  // ⚠️ LAS QUE AMPLÍAN NO SE CUENTAN ACÁ. Si no, el botón promete crear tareas que no va
  // a crear: el dueño abrió una reunión donde las 16 filas eran ampliaciones y el botón
  // decía «Cargar 16 al plan». Le dio, no apareció ninguna tarea nueva —correcto, no
  // había— y el modal se lo volvió a preguntar. El otro modal (la extracción manual) ya
  // las descontaba (`ReunionExtractModal` → `nIncluidas`); este se había quedado a mitad
  // de camino: sumó `nAmpliar` para el rótulo y no lo restó de la cuenta de altas.
  const nIncluidas = filas.filter((f) => f.incluir && !f.esDeOtro && !esAmpliarFila(f)).length;
  /**
   * Las que NO se crean pero SÍ se tocan: el cruce dijo que ya están en el plan y lo que
   * se hace es sumarles el contexto de la reunión a la tarjeta que ya existe.
   *
   * ⚠️ EL BOTÓN NO LAS CONTABA, y eso lo hacía mentir sobre lo que iba a hacer: decía
   * «Agregar 15 al plan» sobre una reunión donde además ampliaba 5 tarjetas. El dueño lo
   * vio: «solo me aparece agregar, cuando SÍ había cosas para ampliar». El otro modal
   * (la extracción manual) ya decía las dos cosas; este se había quedado con la mitad.
   *
   * `ampliar === false` es «no es la misma»: esa vuelve arriba como candidata nueva y la
   * cuenta `nIncluidas`. `incluir === false` puesto a mano acá es «no le sumes nada».
   */
  const nAmpliar = filas.filter(esAmpliarFila).length;
  const hayMias = filas.some((f) => !f.esDeOtro);
  const nOtras = filas.filter((f) => f.esDeOtro).length;
  // Las que ya entraron al plan en una pasada anterior (el borrador quedó abierto por
  // las de los demás). No se re-cargan: se muestran con link a su tarjeta.
  const yaCargadas: TareaYaCargada[] = props.flatMap((p) => (p.aplicadas ?? []).map((a) => ({ ...a, url: p.fuenteUrl ?? null })));

  // LAS HUÉRFANAS → FILAS NORMALES. El borrador las anotó como cargadas pero en el
  // tablero no hay tarjeta con ese id. `renderTaskCard` devolviendo null es lo único que
  // sabe eso de verdad. Se meten en `filas` como cualquier candidata (tildadas, marcadas
  // con `faltante`) para que se vean con la MISMA fila que el resto: con su checkbox, su
  // «no es mía» y su «corregir contexto». Antes tenían un contenedor propio que no dejaba
  // corregir nada y un botón «ver la tarjeta →» que abría un modal vacío.
  const yaInyectadas = useRef(false);
  useEffect(() => {
    if (yaInyectadas.current || !renderTaskCard) return;
    const huerfanas = yaCargadas.filter((y) => !renderTaskCard(y.tareaId));
    if (!huerfanas.length) { yaInyectadas.current = true; return; }
    yaInyectadas.current = true;
    setFilas((fs) => [
      ...huerfanas
        .filter((y) => !fs.some((f) => f.titulo === y.titulo))
        .map((y): FilaConProp => ({
          propId: props[0]?.id ?? '', titulo: y.titulo, detalle: '', prioridad: 'media',
          proyectoId: null, incluir: true, esDeOtro: false, minutos: y.minutos, faltante: true,
        })),
      ...fs,
    ]);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  // Mientras se aplica NO se puede cerrar ni salir: son N tareas creadas + el Perro
  // puntuándolas por tandas, y cortarlo a la mitad deja el board a medio armar. El
  // navegador avisa si intentás refrescar o cerrar la pestaña.
  // …salvo cuando la que navega es la PROPIA app al terminar: `onListo()` recarga, y
  // como el reload corre en el mismo bloque sincrónico que el setGuardando(''), React
  // todavía no desmontó este listener → el navegador mostraba el cartel de "recargar /
  // salir del sitio" JUSTO al cargar bien las tareas. Si el usuario lo cancelaba, el
  // trabajo ya estaba hecho en el server pero el modal seguía mostrando todo igual.
  // La bandera lo neutraliza solo para esa navegación nuestra (la identidad del handler
  // no interviene, así que no hay forma de que el removeEventListener falle en silencio).
  const saliendo = useRef(false);
  useEffect(() => {
    if (guardando !== 'aplicar') return;
    const avisar = (e: BeforeUnloadEvent) => {
      if (saliendo.current) return;
      e.preventDefault(); e.returnValue = '';
    };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [guardando]);

  const aplicar = async () => {
    setGuardando('aplicar'); setErr('');
    // Un lote por borrador: cada reunión conserva su contexto para el Perro, pero el
    // Perro corre UNA sola vez sobre todo (lo arma el server).
    // Lo que respondió en el paso de preguntas viaja como CONTEXTO del Perro: es
    // justamente lo que la reunión no dejó claro.
    // Las respuestas viajan al Perro del borrador de ESA reunión, no al de todas: lo que
    // aclaraste de la reunión con Fran no es contexto de la reunión con Mauricio.
    // El contexto para el Perro sale de las preguntas que el dueño REALMENTE contestó
    // —`preguntasVivas`, que es la lista que vio en pantalla—, no de las guardadas en
    // el borrador. Los índices de `respuestas` son de esa lista: mapearlos contra otra
    // le pegaba la respuesta a la pregunta equivocada, o la perdía entera cuando las
    // preguntas las había armado MaKo recién (esas no tienen propId).
    const dichasDe = (propId: string): string => preguntasVivas
      .map((q, i) => {
        const suya = !('propId' in q) || (q as { propId?: string }).propId === propId;
        return suya && respuestas[i] ? `${q.pregunta} → ${respuestas[i]}` : '';
      })
      .filter(Boolean).join(' · ');
    const lotes = props.map((p) => ({
      id: p.id,
      contexto: [contextoDe(p), dichasDe(p.id)].filter(Boolean).join(' '),
      // ⚠️ LAS AMPLIACIONES VIAJAN TAMBIÉN. Este filtro pedía `f.incluir`, y una
      // ampliación tiene `incluir: false` por definición (no se crea, se le suma el
      // contexto a la tarjeta que ya está). O sea que la pantalla decía «se le suma a
      // esta tarea» y NO se le sumaba nada: la fila no llegaba nunca al server.
      tareas: filas.filter((f) => f.propId === p.id && !f.esDeOtro && (f.incluir || esAmpliarFila(f)))
        // Si no matcheó ningún proyecto existente, viaja el NOMBRE propuesto: el server
        // crea la categoría si no la encuentra (lib/plan-propuesta.ts). Antes acá se
        // mandaba undefined y la tarea nacía suelta.
        // Las repetidas viajan IGUAL, sin ninguna marca de "creala aunque exista": el
        // server las reconoce y le suma el contexto a la tarjeta que ya está en vez de
        // duplicarla. `forzar` se borró — era la única vía por la que una decisión
        // humana podía dejar la misma tarea escrita dos veces.
        // `enriquece` y `ampliar` van: con el id del cruce el server AMPLÍA esa tarjeta
        // en vez de re-adivinar por título (que es léxico y crea duplicados).
        .map((f) => ({ titulo: f.titulo, detalle: f.detalle, prioridad: f.prioridad, proyecto: nombreProyecto(f.proyectoId) ?? (f.proyectoPropuesto || undefined), minuto: f.minuto, minutos: f.minutos, enriquece: f.enriquece, ampliar: f.ampliar })),
      // Lo que queda del lado de otras personas (con las reasignaciones que hiciste
      // recién): el borrador NO se cierra mientras haya algo para repartir.
      restantes: filas.filter((f) => f.propId === p.id && f.esDeOtro)
        .map((f) => ({ titulo: f.titulo, detalle: f.detalle, prioridad: f.prioridad, dueno: f.dueño, duenoEmail: f.dueñoEmail, esDeOtro: true, minuto: f.minuto, minutos: f.minutos })),
    })).filter((l) => l.tareas.length > 0);
    const j = await api({ action: 'aplicar-lote', lotes });
    setGuardando('');
    if (j.ok) { saliendo.current = true; onListo(); }
    // El error crudo puede ser una página de error del server (no JSON). Traducirlo:
    // "SyntaxError: Unexpected token 'A'" no le dice nada a nadie.
    else setErr(/JSON|Unexpected token/i.test(String(j.error ?? ''))
      ? 'Se cortó la conexión con el server antes de terminar. Revisa el plan: puede que algunas ya hayan entrado.'
      : String(j.error ?? 'No pude cargarlas.'));
  };

  const descartar = async () => {
    setGuardando('descartar');
    // Solo los que siguen vivos: descartar uno ya aplicado no hace nada y encima lo
    // sacaba de la lista de reuniones leídas.
    for (const p of todos.filter((x) => (x.estado ?? 'pendiente') === 'pendiente')) await api({ action: 'descartar', id: p.id });
    setGuardando('');
    onDescartadas();
  };

  const de = props.find((p) => p.enviadoPor?.trim())?.enviadoPor?.trim();
  const varias = props.length > 1;
  const soloPreguntas = props.length === 0 && conPreguntas.length > 0;
  const titulo = soloPreguntas ? 'MaKo te dejó un borrador para revisar'
    : de ? `${de} te envió estas tareas`
      : varias ? `MaKo leyó tus ${props.length} reuniones` : 'MaKo leyó tu reunión';
  const sub = soloPreguntas ? 'Necesita que le aclares un par de cosas antes de cargarlas.'
    // Ya cargaste lo tuyo y volviste: lo que queda es repartir lo de los demás.
    : (!hayMias && yaCargadas.length)
      ? `${yaCargadas.length === 1 ? 'Tu tarea ya está' : `Tus ${yaCargadas.length} tareas ya están`} en el plan. ${nOtras === 1 ? 'Queda 1 de otra persona' : `Quedan ${nOtras} de las otras personas`} para repartir.`
    : varias
      ? `${filas.length} compromisos en total: ${filas.length - nOtras} tuyos${nOtras ? ` y ${nOtras} de los demás` : ''}.`
      : (props[0]?.resumen || `${filas.length} compromisos de la reunión.`);

  // AUTOSAVE de la revisión. Reasignar veinte tareas y corregirles el texto es trabajo
  // real; vivía solo en el estado de este modal y un F5 —o cerrar y volver— lo borraba
  // entero. Se guarda con retardo (no en cada tecla) y nunca durante el aplicado.
  /** La fila como la espera el server. Una sola definición: el autosave y el guardado
   *  inmediato del cruce mandan lo MISMO — si divergen, uno de los dos pierde campos. */
  const aPayload = (f: FilaConProp) => ({
    titulo: f.titulo, detalle: f.detalle, prioridad: f.prioridad,
    proyecto: nombreProyecto(f.proyectoId) ?? (f.proyectoPropuesto || undefined),
    dueno: f.dueño, duenoEmail: f.dueñoEmail, esDeOtro: f.esDeOtro,
    minuto: f.minuto, minutos: f.minutos, incluir: f.incluir,
    // El resultado del cruce viaja con la tarea: es lo que evita rehacerlo.
    enriquece: f.enriquece, ampliar: f.ampliar, omitir: f.omitir,
  });
  const primeraRef = useRef(true);
  useEffect(() => {
    if (primeraRef.current) { primeraRef.current = false; return; }
    if (guardando) return;
    const id = setTimeout(() => {
      for (const p of props) {
        // Un borrador cerrado no acepta escrituras: guardarRevision exige 'pendiente' y
        // devuelve false sin decir nada. Mejor no intentarlo que fingir que se guardó.
        if ((p.estado ?? 'pendiente') !== 'pendiente') continue;
        const suyas = filas.filter((f) => f.propId === p.id);
        if (!suyas.length) continue;
        void api({ action: 'guardar', id: p.id, cruzado, tareas: suyas.map(aPayload) });
      }
    }, 900);
    return () => clearTimeout(id);
    // `cruzado` también dispara el guardado: cuando el cruce termina SIN encontrar nada,
    // `filas` no cambia y sin esta dependencia el sello nunca se escribiría — o sea que
    // el análisis se volvería a pagar en cada apertura, que es justo lo que se vino a
    // cerrar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, cruzado]);

  // EL PERRO CRUZA. El léxico solo agarra lo que se parece en palabras, y eso alcanza
  // para poco: medido contra un caso real (la misma llamada grabada por dos notetakers),
  // de 17 compromisos repetidos el criterio léxico avisaba 5. "Montar la automatización
  // del flujo post-agenda" y "Configurar la automatización del envío de audios
  // post-agendamiento" son el mismo trabajo y comparten el 15% de las palabras: eso lo
  // ve el Perro, no un Jaccard. Corre UNA vez al abrir, sobre lo que no marcó el léxico.
  // Best-effort: si falla, quedan las marcas del léxico y no se bloquea nada.
  const cruzadoRef = useRef(false);
  useEffect(() => {
    if (cruzadoRef.current) return;
    // YA SE CRUZÓ: no se vuelve a preguntar. `cruzadoAt` (mig 0123) se sella la primera
    // vez y lo que encontró viaja dentro de cada tarea. Antes esto corría en CADA
    // apertura del modal: se pagaba la misma llamada de IA una y otra vez, y —peor—
    // mientras corría las tareas se veían como nuevas y se podían cargar, así que
    // entrar y confirmar rápido creaba el duplicado que el cruce iba a marcar dos
    // segundos después.
    if (todos.every((p) => !!p.cruzadoAt)) { cruzadoRef.current = true; return; }
    const aCruzar = filas.filter((f) => !f.esDeOtro && !f.enriquece);
    if (!aCruzar.length) { cruzadoRef.current = true; return; }
    cruzadoRef.current = true;
    setCruzando(true);
    (async () => {
      // Contra el tablero Y contra las tareas de los OTROS borradores. Lo segundo es
      // el caso que más duele: la misma llamada grabada por dos personas llega como dos
      // borradores y, si no se cruzan entre sí, se confirma dos veces el mismo trabajo.
      // Los del borrador no tienen id de tarjeta, así que viajan con uno sintético.
      const delBoard = (existentes ?? []).filter((t) => !t.hecha).map((t) => ({ id: t.id, titulo: t.titulo, detalle: '' }));
      const otros = filas.filter((f) => !f.esDeOtro && !aCruzar.includes(f))
        .map((f, k) => ({ id: `borrador:${k}`, titulo: f.titulo, detalle: f.detalle }));
      const universo = [...delBoard, ...otros];
      if (!universo.length) { setCruzando(false); return; }
      const j = await fetch('/api/plan-fathom', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cruzar', uso: 'Cruzar tareas de reunión con el plan',
          candidatas: aCruzar.map((f) => ({ titulo: f.titulo, detalle: f.detalle })),
          existentes: universo,
        }),
      }).then((r) => r.json()).catch(() => ({ ok: false }));
      setCruzando(false);
      // Se selle o no con resultados, el borrador queda marcado: «ya se cruzó» y «no
      // encontró nada» son la misma cosa para la próxima apertura. Si la llamada FALLÓ
      // (`ok:false`) no se sella, para que se pueda reintentar entrando de nuevo.
      if (j?.ok) setCruzado(true);
      if (!j?.ok || !Array.isArray(j.cruces) || !j.cruces.length) return;
      const porTitulo = new Map<string, { id: string; razon: string; confianza: 'alta' | 'media' }>();
      for (const c of j.cruces as Array<{ i: number; idExistente?: string; razon?: string; confianza?: string }>) {
        const cand = aCruzar[c.i];
        const ya = universo.find((t) => t.id === c.idExistente);
        if (!cand || !ya) continue;
        const enBorrador = ya.id.startsWith('borrador:');
        porTitulo.set(cand.titulo, {
          id: enBorrador ? '' : ya.id,
          razon: `${enBorrador ? 'la misma reunión ya la trae como' : 'ya está en tu plan como'} «${ya.titulo}»${c.razon ? ` — ${c.razon}` : ''}`,
          confianza: c.confianza === 'alta' ? 'alta' : 'media',
        });
      }
      if (!porTitulo.size) return;
      // SOLO UN CRUCE DE CONFIANZA ALTA DESTILDA LA TAREA SOLA.
      //
      // Un falso positivo acá no es un detalle: la tarea llega destildada, el dueño no la
      // ve entre veinte, y un pedido real de una reunión se pierde en silencio. Pasó y es
      // grave — «Contratar el plan de $100 para no agotar los créditos» (pagar una
      // suscripción de IA) se marcó como duplicada de «Reglas de presupuesto según la
      // plata real» (programar el motor que mueve el presupuesto de los anuncios), porque
      // las dos «hablan de presupuesto». Con la confianza en media la tarea se sigue
      // avisando —el cartel verde explica de qué la marcó— pero entra TILDADA: el dueño
      // decide, y el default no esconde trabajo.
      // SE GUARDA ACÁ MISMO, no por el autosave.
      //
      // El autosave es un debounce de 900 ms que muere con el componente: si cerrás el
      // modal antes, el `clearTimeout` del cleanup se lo lleva. Para las ediciones a
      // mano da igual (volvés y reescribís), pero esto costó ~40 segundos de IA y es
      // exactamente lo que no se puede perder — verificado en prod: `cruzado_at` estaba
      // NULL en TODAS las filas y ningún `enriquece` había llegado a la base, así que el
      // análisis se rehacía cada vez que se abría la reunión.
      const conCruce = filas.map((f) => {
        const hit = !f.esDeOtro && !f.enriquece ? porTitulo.get(f.titulo) : undefined;
        return hit ? { ...f, enriquece: hit, incluir: hit.confianza === 'alta' ? false : f.incluir } : f;
      });
      setFilas(conCruce);
      for (const p of props) {
        if ((p.estado ?? 'pendiente') !== 'pendiente') continue;
        const suyas = conCruce.filter((f) => f.propId === p.id);
        if (!suyas.length) continue;
        void api({ action: 'guardar', id: p.id, cruzado: true, tareas: suyas.map(aPayload) });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lo que MaKo detectó como ya existente: se dice ARRIBA, no después de crear. Si el
  // usuario re-tilda alguna, deja de contarse (su decisión manda) y se crea igual.
  const nRepetidas = filas.filter((f) => f.enriquece && !f.esDeOtro).length;
  const nForzadas = filas.filter((f) => f.enriquece && f.incluir && !f.esDeOtro).length;
  const avisoRepetidas = nRepetidas
    ? `${textoRepetidas(nRepetidas)} — ${nRepetidas === 1 ? 'la dejé destildada' : 'las dejé destildadas'}${nForzadas ? `, y ${nForzadas} las volviste a tildar: esas las creo igual` : ''}.`
    : '';

  // Las que se muestran: las que armó MaKo para lo elegido; si no pudo (sin IA, o
  // decidió que no hace falta ninguna), caen las del borrador filtradas por `sobre`.
  const preguntasVivas = preguntasIA ?? preguntas;
  const qActual = preguntasVivas[qIdx];
  const esUltimaQ = qIdx >= preguntasVivas.length - 1;

  /** Terminó de elegir: MaKo mira SOLO lo elegido y arma las preguntas de eso. */
  const irAPreguntas = async () => {
    const elegidas = filas.filter((f) => f.incluir && !f.esDeOtro);
    // Solo ampliaciones: no hay tarea nueva sobre la que preguntar nada, así que se
    // aplica derecho. Con el `return` de antes el botón quedaba muerto — se veía
    // habilitado y no pasaba nada al tocarlo.
    if (!elegidas.length) { if (nAmpliar) void aplicar(); return; }
    setPensando(true);
    const j = await api({
      action: 'preguntar', id: props[0]?.id ?? '',
      tareas: elegidas.map((f) => ({ titulo: f.titulo, detalle: f.detalle, proyecto: nombreProyecto(f.proyectoId) ?? f.proyectoPropuesto })),
    });
    setPensando(false);
    const qs = (j?.ok && Array.isArray(j.preguntas) ? (j.preguntas as PropPregunta[]) : []);
    // Sin preguntas (ni de MaKo ni del borrador) se carga derecho: no se inventa un paso.
    const finales = qs.length ? qs : preguntas;
    if (!finales.length) { void aplicar(); return; }
    setPreguntasIA(qs.length ? qs : null);
    setRespuestas({}); setQIdx(0); setPaso('preguntas');
  };

  const aplicando = guardando === 'aplicar';

  // El paso de preguntas usa el MISMO chrome que todos los cuestionarios de la app
  // (WizardShell: ✦ MAKO + puntitos + una pregunta grande y centrada + Atrás/Siguiente).
  // Antes era una lista propia dentro de este modal y se veía como otra cosa; no hay
  // razón para que el formulario de una reunión no se parezca al de un lead.
  if (paso === 'preguntas' && preguntasVivas.length) {
    const resp = respuestas[qIdx] ?? '';
    return (
      <div style={{ display: oculto ? 'none' : 'block' }}>
        <WizardShell
          titulo={[props[0]?.fuenteTitulo, resumenAccion(nIncluidas, nAmpliar)].filter(Boolean).join(' · ')}
          total={preguntasVivas.length} idx={qIdx}
          pregunta={qActual?.pregunta ?? ''}
          // De qué tarea habla + CÓMO se contesta. Lo segundo sale del tipo
          // (lib/preguntas-contrato.ts): decir «elegí una opción» sobre un calendario
          // o sobre una escala de 1 a 5 es contradecir el campo que está abajo.
          sub={[
            qActual?.sobre?.length ? `Por: ${qActual.sobre.map((t) => `«${t}»`).join(' · ')}` : '',
            qActual ? ayudaDePregunta((qActual.tipo ?? 'opcion') as TipoPregunta, (qActual.opciones?.length ?? 0) > 0) : '',
          ].filter(Boolean).join(' — ')}
          puedeAvanzar={!guardando}
          enUltimo={esUltimaQ}
          confirmLabel={etiquetaAccion(nIncluidas, nAmpliar)}
          pending={!!guardando}
          // El loader del aplicado tiene que estar ACÁ. El overlay lindo que dibuja este
          // modal (más abajo, con el spinner y el «no cierres ni refresques») vive en el
          // OTRO return: cuando `paso === 'preguntas'` esta rama corta antes y no se
          // renderiza nunca. O sea que al confirmar desde la última pregunta —que es el
          // camino normal de una reunión de Fathom— lo único que pasaba en pantalla era
          // que el botón cambiaba a «Guardando…», con el cuerpo de la pregunta intacto
          // detrás. Crear las tareas y que el Perro las puntúe tarda minutos: sin loader
          // se lee como que la app se colgó. Va por `cargando` de la pieza y no por un
          // overlay propio a propósito — uno con z-index propio queda POR DEBAJO del
          // modal (ver el comentario del loader en WizardShell).
          cargando={aplicando ? (
            <>
              <div>Cargando {nIncluidas} {nIncluidas === 1 ? 'tarea' : 'tareas'} al plan…</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--dim)', lineHeight: 1.5, marginTop: 6, maxWidth: 380 }}>
                El Perro las está puntuando contra tu plan y armando las checklists. Con muchas tareas puede tardar un par de minutos.
                <br /><b>No cierres ni refresques</b> hasta que termine.
              </div>
            </>
          ) : null}
          atrasLabel={qIdx > 0 ? 'Atrás' : 'Volver a las tareas'}
          onAtras={() => (qIdx > 0 ? setQIdx((i) => i - 1) : setPaso('tareas'))}
          onSiguiente={() => setQIdx((i) => i + 1)}
          onConfirmar={() => void aplicar()}
          onClose={onClose}
          // Mientras carga NO se puede cerrar: son N tareas creadas + el Perro
          // puntuándolas por tandas, y cortarlo a la mitad deja el board a medio armar.
          bloqueante={!!guardando}
          siguienteLabel={resp ? 'Siguiente →' : 'Saltear →'}
        >
          {/* El MISMO campo que dibuja /plan/revisar. Antes esta pantalla tenía su
              propia versión y no coincidían: una 'escala' salía como una lista de
              radios con las etiquetas "1".."5" —idéntica a un multiple choice, pero
              con números en vez de respuestas—, no había campo de fecha, ni forma de
              escribir una respuesta propia, ni rama para 'comparacion'. */}
          {qActual && <PreguntaCampo q={qActual} value={resp} onChange={(v) => setRespuestas((r) => ({ ...r, [qIdx]: v }))} autoFocus />}
        </WizardShell>
      </div>
    );
  }

  return (
    // Cerrar clickeando AFUERA, como cualquier modal de la app. Cerrar no descarta
    // nada: el borrador sigue esperando y se vuelve desde el botón de Fathom. Lo único
    // que no se puede interrumpir es el aplicado (ahí sí queda el board a medio armar).
    <div onClick={() => { if (!guardando && !pensando && !cruzando) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: capa.z, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: oculto || !capa.visible ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ position: 'relative', width: '100%', maxWidth: 620, maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' }}>

        {/* Cargando: tapa TODO el modal. Crear N tareas + puntuarlas por tandas puede
            tardar más de un minuto, y hasta ahora no se veía nada pasar.
            Tapa también mientras MaKo arma las preguntas (`pensando`): es la MISMA
            espera larga detrás del MISMO botón, un paso antes, y sin el velo lo único
            que cambiaba era el texto del botón. */}
        {(aplicando || pensando || cruzando) && (
          <div role="status" aria-live="polite" style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
            {/* El velo va en SU capa: un `opacity` sobre el contenedor apagaría también
                el spinner y el texto. Y sale de --surface, no de un blanco fijo — en
                tema oscuro un blanco al 86% es un flash. */}
            <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'var(--surface)', opacity: 0.94, backdropFilter: 'blur(3px)' }} />
            <span style={{ position: 'relative', width: 34, height: 34, borderRadius: '50%', border: '3px solid var(--border-strong)', borderTopColor: 'var(--primary)', boxSizing: 'border-box', display: 'inline-block', animation: 'makoSpinTR .7s linear infinite' }} />
            <style>{'@keyframes makoSpinTR{to{transform:rotate(360deg)}}'}</style>
            {cruzando ? (
              // Una línea. Lo que el usuario necesita saber es QUÉ está pasando, no cómo
              // funciona por dentro ni una promesa sobre la próxima vez.
              <div style={{ position: 'relative', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Cruzando con tu plan…</div>
            ) : pensando ? (
              <>
                <div style={{ position: 'relative', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>MaKo está mirando lo que elegiste…</div>
                <div style={{ position: 'relative', fontSize: 13, color: 'var(--dim)', lineHeight: 1.5, maxWidth: 380 }}>
                  Prepara las preguntas de contexto sobre estas {nIncluidas} {nIncluidas === 1 ? 'tarea' : 'tareas'}, para que el Perro las priorice con criterio.
                </div>
              </>
            ) : (
              <>
                <div style={{ position: 'relative', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Cargando {nIncluidas} {nIncluidas === 1 ? 'tarea' : 'tareas'} al plan…</div>
                <div style={{ position: 'relative', fontSize: 13, color: 'var(--dim)', lineHeight: 1.5, maxWidth: 380 }}>
                  El Perro las está puntuando contra tu plan y armando las checklists. Con muchas tareas puede tardar un par de minutos.
                  <br /><b>No cierres ni refresques</b> hasta que termine.
                </div>
              </>
            )}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
          <GuardianIcon size={34} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '.14em', color: 'var(--accent)' }}>✦ MAKO · TAREAS PARA CONFIRMAR</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginTop: 2 }}>{titulo}</div>
          </div>
          {/* Mientras carga no hay salida: cerrar a mitad deja tareas creadas y el
              Perro sin correr. */}
          <button onClick={onClose} aria-label="Cerrar" disabled={!!guardando}
            style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', cursor: guardando ? 'not-allowed' : 'pointer', fontSize: 14, opacity: guardando ? 0.4 : 1 }}>✕</button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--primary-weak)', background: 'var(--primary-bg)' }}>
            {props.some((p) => p.origen === 'fathom') && <span style={{ flex: 'none' }}><SvcIcon k="fathom" size={17} box={28} radius={8} /></span>}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{sub}</div>
              {!!avisoRepetidas && <div style={{ fontSize: 12.5, color: 'var(--warn)', lineHeight: 1.5, marginTop: 4, fontWeight: 600 }}>⚠ {avisoRepetidas}</div>}
              {/* Con varias, el link a cada grabación va en el encabezado de SU bloque
                  (acá arriba sería el de una sola, elegida al azar). */}
              {!varias && props[0]?.fuenteUrl && (
                <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 3 }}>
                  <a href={props[0].fuenteUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 600 }}>ver la grabación</a>
                </div>
              )}
            </div>
          </div>

          {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600 }}>{err}</div>}

          {/* Borradores que MaKo dejó con preguntas: no se confirman acá, pero TIENEN
              que verse — si no, MaKo dice "entrá al plan" y no hay nada. */}
          {conPreguntas.map((p) => (
            <a key={p.id} href={`/plan/revisar/${p.id}`}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--warn)', background: 'var(--warn-bg, var(--surface-2))', textDecoration: 'none' }}>
              <span style={{ fontSize: 18 }}>💬</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                  MaKo dejó {p.tareas.length} {p.tareas.length === 1 ? 'tarea' : 'tareas'} con {p.preguntas!.length} {p.preguntas!.length === 1 ? 'pregunta' : 'preguntas'}
                </span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>{p.resumen || 'Necesita contexto tuyo antes de cargarlas.'}</span>
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>Responder →</span>
            </a>
          ))}

          {(filas.length > 0 || yaCargadas.length > 0) && <ReunionTareas
            filas={filas}
            labels={labels}
            onFila={(i, patch) => setFilas((fs) => fs.map((f, k) => (k === i ? { ...f, ...patch } : f)))}
            reunion={{ titulo: props[0]?.fuenteTitulo ?? '', fecha: props[0]?.fuenteFecha ?? props[0]?.createdAt, url: props[0]?.fuenteUrl ?? null, recordingId: recordingDeRef(props[0]?.ref) }}
            cabecera="Destildá lo que no vaya. El perro les pone la prioridad final."
            yaCargadas={yaCargadas}
            onAbrirTarea={onAbrirTarea}
            renderTaskCard={renderTaskCard}
            // Para «es otra tarea»: solo las ABIERTAS, que son a las que tiene sentido
            // sumarles contexto (a una cerrada no se le amplía nada).
            delTablero={(existentes ?? []).filter((t) => !t.hecha).map((t) => ({ id: t.id, titulo: t.titulo }))}
            pieAcciones={pieSlot}
            onPersonaActiva={setPersonaActiva}
          />}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 22px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)', flexWrap: 'wrap' }}>
          {/* Descartar es explícito y borra TODO lo que está en pantalla; cerrar con la
              ✕ las deja esperando para la próxima. */}
          {/* Este footer es SOLO el de la lista de tareas: el paso de preguntas se
              dibuja con WizardShell, que trae su propio Atrás/Siguiente. */}
          {/* DESCARTAR solo cuando queda algo TUYO. Si lo único pendiente son
              compromisos de otras personas, este botón los tiraba a la basura sin
              repartirlos — y encima se llamaba «Descartar lo que queda», como si fuera
              tu resto. Lo que corresponde ahí es mandárselos desde la tabla, no borrarlos. */}
          {/* PARADO EN LA TAB DE OTRA PERSONA, EL PIE ES DE ESA PERSONA.
              «Agregar N al plan» carga LO TUYO, y en esa tab no hay nada tuyo: el botón
              prometía una acción que no correspondía a lo que estabas mirando. Los tres
              botones de ella (descargar / enviar / cargar en su plan) estaban abajo de
              las tarjetas, o sea al final de una lista de 24 — donde no los veía nadie.
              Se portalean acá desde `PanelPersona`, que es quien tiene el estado. */}
          {personaActiva ? (
            <>
              <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>
                Lo de <b style={{ color: 'var(--ink)' }}>{personaActiva}</b> no entra a tu plan:
              </span>
              {/* A la derecha, en el mismo lugar donde estaba «Agregar N al plan»: es el
                  botón que reemplaza, así que la mano va al mismo lado. */}
              <div ref={setPieSlot} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', marginLeft: 'auto' }} />
            </>
          ) : cerrado ? (
            <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>
              {descartadoConCargas
                ? 'Lo que se cargó al plan está arriba; el resto lo descartaste. Para volver a trabajar esta reunión, extraela de nuevo desde la lista.'
                : 'Esta reunión ya está cerrada: mírala todo lo que quieras. Para volver a trabajarla, extráela de nuevo desde la lista.'}
            </span>
          ) : hayMias ? (
            <button type="button" onClick={() => void descartar()} disabled={!!guardando}
              style={{ padding: '11px 18px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontWeight: 600, fontSize: 13.5, cursor: guardando ? 'default' : 'pointer', fontFamily: SANS }}>
              {guardando === 'descartar' ? 'Descartando…' : varias ? 'Descartar todo' : 'Descartar'}
            </button>
          ) : <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>Lo que queda es de otras personas: mándaselo desde la lista.</span>}
          {hayMias && !cerrado && !personaActiva && (
            <button type="button" onClick={() => void irAPreguntas()} disabled={nIncluidas + nAmpliar === 0 || !!guardando || pensando || cruzando}
              style={{ padding: '12px 24px', borderRadius: 11, border: 'none', background: nIncluidas + nAmpliar ? 'var(--primary)' : 'var(--border)', color: nIncluidas + nAmpliar ? '#fff' : 'var(--faint)', fontSize: 14, fontWeight: 700, cursor: nIncluidas + nAmpliar && !guardando && !pensando ? 'pointer' : 'default', fontFamily: SANS, opacity: pensando ? 0.7 : 1 }}>
              {/* El botón dice las DOS cosas que va a hacer. Con solo `nIncluidas` mentía
                  por omisión: «Agregar 15» sobre una reunión que además ampliaba 5. */}
              {guardando === 'aplicar' ? 'Cargando…'
                : pensando ? 'MaKo está mirando lo que elegiste…'
                  : nIncluidas && nAmpliar ? `Agregar ${nIncluidas} y ampliar ${nAmpliar} →`
                    : nIncluidas ? `Agregar ${nIncluidas} al plan →`
                      : nAmpliar ? `Ampliar ${nAmpliar} que ya ${nAmpliar === 1 ? 'está' : 'están'} →`
                        : 'Elige al menos una'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Contexto para el Perro: de dónde salieron estas tareas (mejora su puntuación). */
function contextoDe(prop: PropuestaPendiente): string {
  const de = prop.enviadoPor?.trim();
  return de
    ? `Se las mandó ${de} desde la reunión${prop.fuenteTitulo ? ` «${prop.fuenteTitulo}»` : ''}: son compromisos que asumió esta persona ahí.`
    : `Salieron de la reunión${prop.fuenteTitulo ? ` «${prop.fuenteTitulo}»` : ''} (Fathom): son compromisos que se asumieron ahí.`;
}
