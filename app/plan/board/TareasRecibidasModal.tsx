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
// Confirmás lo que va (y sacás lo que no) y recién ahí se crean. "Ahora no" cierra sin
// descartar: siguen esperándote.
//
// ⛔ SIN IA Y SIN ESPERA (16/10/2026, «Fathom sin fricción»). Martín: «Que hoy en día tardan un
// montón porque "cruzan" con las otras tareas... Quiero que elimines eso y toda la fricción». Este
// modal corría el cruce con IA contra el tablero al abrirse («Cruzando con tu plan…», 20-40 s, con
// «Agregar» apagado) y el server, al cargar, ruteaba y puntuaba con el Perro. Las dos cosas se
// fueron: el borrador llega YA cruzado desde el server (lib/reunion-cruce.ts, en el cron y en la
// lectura en segundo plano) y «Agregar» carga en segundos, sin IA (`aplicarPropuestas`). Si el
// cruce todavía no llegó, se carga igual: el server tiene su propio anti-duplicado. Las tareas
// entran SIN PRIORIDAD; la pone «Re-priorizar todo».
//
// ⛔ SIN PASO DE PREGUNTAS (05/10/2026). «Agregar N al plan» carga derecho. Antes, al
// apretarlo, MaKo armaba preguntas sobre lo elegido («¿Para cuándo tiene que estar
// resuelto…?») y las mostraba de a una en un WizardShell antes de crear nada. Martín:
// «habíamos dicho de sacar absolutamente toda la fricción al agregar tareas y me salta
// esto luego de intentar agregar tareas del fathom». Lo que esas preguntas contestaban
// (la fecha y la prioridad) se cambia a mano en el detalle — y desde el 16/10/2026 la
// prioridad la pone «Re-priorizar todo», no el alta. Se sacó también de /plan/revisar y
// de los que las generaban (ver docs/hallazgos-plan.md, «Cargar tareas no pregunta nada»).

import { useEffect, useRef, useState } from 'react';
import { GuardianIcon } from './GuardianIcon';
import { SvcIcon } from '../../_components/ServicioVisual';
import { ReunionTareas, type FilaTarea, type TareaYaCargada } from './ReunionTareas';
import { pareceLaMisma, textoRepetidas, type TareaEnTablero } from '@/lib/tareas-dedup';
import { type Label, type Prio } from './types';

import type { PropuestaTarea } from '@/lib/plan-propuesta';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

/**
 * La tarea de un borrador, EL TIPO DEL SERVER — no una copia.
 *
 * Era una copia escrita a mano, con los doce campos enumerados, y ese es el olor que
 * AGENTS.md nombra: «un tipo copiado a mano para no importar del server es la señal de
 * que falta esta frontera», y la copia se queda vieja sin que nada falle. Se quedó vieja:
 * al sumarle la CUBETA del criterio al borrador, esta pantalla no la podía ver.
 *
 * Se importa con `import type`, que se borra en compilación: el `server-only` de
 * `lib/plan-propuesta` no viaja, y el compilador sí avisa del próximo campo.
 */
type PropTarea = PropuestaTarea;

export type PropuestaPendiente = {
  id: string; resumen: string; origen?: string; tareas: PropTarea[]; createdAt: string;
  /** El estado REAL de la fila. Una reunión ya aplicada o descartada se sigue pudiendo
   *  abrir —lo que salió de esa charla no desaparece— pero en modo lectura. */
  estado?: 'pendiente' | 'aplicada' | 'descartada';
  enviadoPor?: string; fuenteTitulo?: string; fuenteUrl?: string; fuenteFecha?: string; ref?: string;
  /** las que MaKo dice que YA ESTÁN HECHAS. Mandan al wizard /plan/revisar, porque cada
   *  una se mira de a una con su evidencia delante. Es lo ÚNICO que lo manda ahí: las
   *  preguntas se fueron del alta (ver la cabecera). */
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
export const esAmpliarFila = (f: { enriquece?: { id: string }; ampliar?: boolean; esDeOtro?: boolean; omitir?: boolean }): boolean =>
  !!f.enriquece?.id && f.ampliar !== false && !f.esDeOtro && !f.omitir;

/** Fila con la marca de a qué borrador pertenece, para aplicar cada uno por separado. */
/** `proyectoPropuesto` = el nombre que dijo MaKo, aunque ese proyecto no exista todavía. */
/** `orig` = la tarea TAL CUAL vino del borrador. Todo lo que el modal manda al server
 *  parte de ella: lo que la pantalla no edita viaja sin que nadie lo tenga que listar. */
type FilaConProp = FilaTarea & { propId: string; proyectoPropuesto?: string; orig?: PropTarea };

/**
 * La fila como la espera el server. UNA sola definición para el autoguardado, el guardado
 * del cruce y el «Cargar»: si divergen, uno de los tres pierde campos.
 *
 * ⚠️ PARTE DE LA TAREA ORIGINAL (`orig`) Y PISA SOLO LO QUE ESTA PANTALLA EDITA. Antes era
 * una lista de campos, y el autoguardado REESCRIBE el borrador: todo campo que la lista no
 * nombraba se borraba la primera vez que alguien abría el modal, sin error. `deadline` ya
 * estaba afuera (medido el 17/9: hoy ningún borrador trae uno, 0 de 2.281 tareas, así que
 * todavía no se había perdido nada). La primera víctima real iba a ser el veredicto del
 * criterio de Mauricio. El único filtro de campos es el del server (`limpiarTarea`,
 * lib/plan-propuesta.ts).
 *
 * De quién es SÍ se pisa: una tarea que reasignaste a «Mías» no puede llegar diciendo que
 * es de otro porque así venía del borrador. `undefined` pisa igual —y JSON lo omite—, que
 * es justo «ya no es de nadie más».
 */
export function filaAlServer(
  f: Pick<FilaConProp, 'orig' | 'titulo' | 'detalle' | 'prioridad' | 'dueño' | 'dueñoEmail' | 'esDeOtro' | 'minuto' | 'minutos' | 'incluir' | 'enriquece' | 'ampliar' | 'omitir'>,
  proyecto: string | undefined,
): Record<string, unknown> {
  return {
    ...f.orig,
    titulo: f.titulo, detalle: f.detalle, prioridad: f.prioridad, proyecto,
    dueno: f.dueño, duenoEmail: f.dueñoEmail, esDeOtro: f.esDeOtro,
    minuto: f.minuto, minutos: f.minutos, incluir: f.incluir,
    // El resultado del cruce viaja con la tarea: es lo que evita rehacerlo.
    enriquece: f.enriquece, ampliar: f.ampliar, omitir: f.omitir,
  };
}

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
  // Un borrador que propone CIERRES va al wizard, y es lo ÚNICO que lo manda ahí.
  // No es una limitación: es la decisión de diseño del canal. Un cierre se mira de a uno,
  // con su evidencia delante y tres respuestas posibles («sí» / «está a medias» / «no»),
  // porque la precisión medida de un «ya está hecho» dicho por IA fue 8 de 17. Confirmarlo
  // acá, en una lista con casillas, es exactamente la pantalla que no queremos.
  // ⚠️ Tener PREGUNTAS ya no manda al wizard: un borrador viejo de WhatsApp que las trae
  // se confirma acá como cualquier otro, y las preguntas se ignoran (ver la cabecera).
  const alWizard = (p: PropuestaPendiente) => (p.cerrar?.length ?? 0) > 0;
  const props = todos.filter((p) => !alWizard(p));
  const conCierres = todos.filter(alWizard);
  // ⛔ Acá vivían `cruzando` (el cruce con IA en curso: tapaba el modal y apagaba «Agregar») y
  // `cruzado` (el sello que escribía el autosave). Se fueron el 16/10/2026: el cruce y su sello
  // los hace el server, antes de que nadie abra esto (ver la cabecera).
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
      orig: t,
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
      // Lo que dijo el criterio de compromisos, si el workspace tiene uno. Viaja hasta
      // la fila para poder DIBUJARLO: el borrador ya lo trae guardado, y sin copiarlo
      // acá la persona ve filas destildadas sin ninguna razón al lado.
      cubeta: t.cubeta, porQue: t.porQue,
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

  // Mientras se aplica NO se puede cerrar ni salir: son N tareas creándose, y cortarlo a la
  // mitad deja el board a medio armar. El navegador avisa si intentás refrescar o cerrar.
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
    // Un lote por borrador: el server los aplica juntos, sin IA (16/10/2026).
    const lotes = props.map((p) => ({
      id: p.id,
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
        // La MISMA forma que el autoguardado (`filaAlServer`): lo que el modal no edita
        // llega igual, y de quién es lo decide lo que hiciste acá.
        .map(aPayload),
      // Lo que queda del lado de otras personas (con las reasignaciones que hiciste
      // recién): el borrador NO se cierra mientras haya algo para repartir.
      restantes: filas.filter((f) => f.propId === p.id && f.esDeOtro)
        .map((f) => ({ ...aPayload(f), esDeOtro: true })),
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
  const soloCierres = props.length === 0 && conCierres.length > 0;
  const titulo = soloCierres ? 'MaKo te dejó un borrador para revisar'
    : de ? `${de} te envió estas tareas`
      : varias ? `MaKo leyó tus ${props.length} reuniones` : 'MaKo leyó tu reunión';
  const sub = soloCierres ? 'Cree que hay tareas que ya están hechas.'
    // Ya cargaste lo tuyo y volviste: lo que queda es repartir lo de los demás.
    : (!hayMias && yaCargadas.length)
      ? `${yaCargadas.length === 1 ? 'Tu tarea ya está' : `Tus ${yaCargadas.length} tareas ya están`} en el plan. ${nOtras === 1 ? 'Queda 1 de otra persona' : `Quedan ${nOtras} de las otras personas`} para repartir.`
    : varias
      ? `${filas.length} compromisos en total: ${filas.length - nOtras} tuyos${nOtras ? ` y ${nOtras} de los demás` : ''}.`
      : (props[0]?.resumen || `${filas.length} compromisos de la reunión.`);

  // AUTOSAVE de la revisión. Reasignar veinte tareas y corregirles el texto es trabajo
  // real; vivía solo en el estado de este modal y un F5 —o cerrar y volver— lo borraba
  // entero. Se guarda con retardo (no en cada tecla) y nunca durante el aplicado.
  /** La fila como la espera el server: ver `filaAlServer`, arriba. */
  const aPayload = (f: FilaConProp) => filaAlServer(f, nombreProyecto(f.proyectoId) ?? (f.proyectoPropuesto || undefined));
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
        // Sin `cruzado`: el sello lo escribe el server cuando el cruce corre (lib/reunion-cruce.ts).
        void api({ action: 'guardar', id: p.id, tareas: suyas.map(aPayload) });
      }
    }, 900);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas]);

  // ⛔ ACÁ CORRÍA EL CRUCE CON IA («EL PERRO CRUZA»), en el navegador, al abrir el modal: una
  // llamada a /api/plan-fathom `cruzar` con el tablero y los otros borradores, y el modal tapado
  // hasta que volviera. Lo que aportaba —el parecido que el léxico no ve: «Montar la automatización
  // del flujo post-agenda» y «Configurar la automatización del envío de audios post-agendamiento»
  // comparten el 15% de las palabras— sigue estando, del lado del server y ANTES de que se abra esto
  // (lib/reunion-cruce.ts): el borrador trae `enriquece` en cada tarea que ya está, y la fila lo
  // dibuja. Acá quedan el léxico de arriba (`yaEnPlan`) y lo que el server ya escribió.

  // Lo que MaKo detectó como ya existente: se dice ARRIBA, no después de crear. Si el
  // usuario re-tilda alguna, deja de contarse (su decisión manda) y se crea igual.
  const nRepetidas = filas.filter((f) => f.enriquece && !f.esDeOtro).length;
  const nForzadas = filas.filter((f) => f.enriquece && f.incluir && !f.esDeOtro).length;
  const avisoRepetidas = nRepetidas
    ? `${textoRepetidas(nRepetidas)} — ${nRepetidas === 1 ? 'la dejé destildada' : 'las dejé destildadas'}${nForzadas ? `, y ${nForzadas} las volviste a tildar: esas las creo igual` : ''}.`
    : '';

  const aplicando = guardando === 'aplicar';

  return (
    // Cerrar clickeando AFUERA, como cualquier modal de la app. Cerrar no descarta
    // nada: el borrador sigue esperando y se vuelve desde el botón de Fathom. Lo único
    // que no se puede interrumpir es el aplicado (ahí sí queda el board a medio armar).
    <div onClick={() => { if (!guardando) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: capa.z, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: oculto || !capa.visible ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ position: 'relative', width: '100%', maxWidth: 620, maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' }}>

        {/* Cargando: tapa TODO el modal mientras se crean. Sin IA, son segundos. */}
        {aplicando && (
          <div role="status" aria-live="polite" style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
            {/* El velo va en SU capa: un `opacity` sobre el contenedor apagaría también
                el spinner y el texto. Y sale de --surface, no de un blanco fijo — en
                tema oscuro un blanco al 86% es un flash. */}
            <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'var(--surface)', opacity: 0.94, backdropFilter: 'blur(3px)' }} />
            <span style={{ position: 'relative', width: 34, height: 34, borderRadius: '50%', border: '3px solid var(--border-strong)', borderTopColor: 'var(--primary)', boxSizing: 'border-box', display: 'inline-block', animation: 'makoSpinTR .7s linear infinite' }} />
            <style>{'@keyframes makoSpinTR{to{transform:rotate(360deg)}}'}</style>
            {/* Una línea: QUÉ está pasando. Ya no hay Perro que espere (16/10/2026): entran sin
                prioridad y en segundos. */}
            <div style={{ position: 'relative', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Cargando {nIncluidas} {nIncluidas === 1 ? 'tarea' : 'tareas'}…</div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
          <GuardianIcon size={34} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '.14em', color: 'var(--accent)' }}>✦ MAKO · TAREAS PARA CONFIRMAR</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginTop: 2 }}>{titulo}</div>
          </div>
          {/* Mientras carga no hay salida: cerrar a mitad deja la carga a medias. */}
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

          {/* Borradores que proponen CIERRES: no se confirman acá, pero TIENEN que
              verse — si no, MaKo dice "entrá al plan" y no hay nada. */}
          {conCierres.map((p) => {
            const n = p.cerrar?.length ?? 0;
            return (
              <a key={p.id} href={`/plan/revisar/${p.id}`}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--warn)', background: 'var(--warn-bg, var(--surface-2))', textDecoration: 'none' }}>
                <span style={{ fontSize: 18 }}>✓</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                    {n === 1 ? '1 tarea parece hecha' : `${n} tareas parecen hechas`}
                  </span>
                  {p.resumen && <span style={{ display: 'block', fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>{p.resumen}</span>}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>Revisar →</span>
              </a>
            );
          })}

          {(filas.length > 0 || yaCargadas.length > 0) && <ReunionTareas
            filas={filas}
            labels={labels}
            onFila={(i, patch) => setFilas((fs) => fs.map((f, k) => (k === i ? { ...f, ...patch } : f)))}
            reunion={{ titulo: props[0]?.fuenteTitulo ?? '', fecha: props[0]?.fuenteFecha ?? props[0]?.createdAt, url: props[0]?.fuenteUrl ?? null, recordingId: recordingDeRef(props[0]?.ref) }}
            cabecera="Destilda lo que no vaya. Entran sin prioridad."
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
            // Carga DERECHO: no hay paso de preguntas en el medio (ver la cabecera).
            // «Agregar» NUNCA espera al cruce (16/10/2026): si el server todavía no lo selló, se carga
            // igual y el anti-duplicado del server (`mismaTarea`) hace su parte.
            <button type="button" onClick={() => void aplicar()} disabled={nIncluidas + nAmpliar === 0 || !!guardando}
              style={{ padding: '12px 24px', borderRadius: 11, border: 'none', background: nIncluidas + nAmpliar ? 'var(--primary)' : 'var(--border)', color: nIncluidas + nAmpliar ? '#fff' : 'var(--faint)', fontSize: 14, fontWeight: 700, cursor: nIncluidas + nAmpliar && !guardando ? 'pointer' : 'default', fontFamily: SANS }}>
              {/* El botón dice las DOS cosas que va a hacer. Con solo `nIncluidas` mentía
                  por omisión: «Agregar 15» sobre una reunión que además ampliaba 5. */}
              {guardando === 'aplicar' ? 'Cargando…'
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

// ⛔ Acá vivía `contextoDe`: la nota «de dónde salieron» que el Perro leía al puntuar el lote. Se
// fue el 16/10/2026 con el Perro de la carga (`aplicarPropuestas` ya no puntúa).
