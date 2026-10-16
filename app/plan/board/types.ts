// =============================================================================
// board/types — modelo unificado del tablero /todo (admin y cliente)
// =============================================================================
// Un solo componente <BoardShell> renderiza AMBOS boards (super-admin en
// localStorage, cliente en DB). Cada parent implementa un `Repo` que persiste;
// useBoard tiene toda la lógica (optimista + change history + undo).

// El predicado de «se repite para siempre» vive en un módulo de datos y se IMPORTA: acá
// sólo se declara el campo. El módulo no lleva `server-only` a propósito (lo importan las
// pantallas), así que traerlo desde este archivo —que también viaja al navegador— es gratis.
import { llevaDeadline } from '@/lib/plan-recurrentes';
import type { OpcionesPrioridadManual } from './lugar-al-soltar';
// Las COLUMNAS del kanban (16/10/2026): el estado y sus reglas viven en un módulo de datos sin
// `server-only`, el mismo que lee el server de las dos mitades. Acá sólo se declara el campo.
import { estadoDeAvance, type EstadoTarea, type ResponsableTipo } from '@/lib/todo-estados';
export type { EstadoTarea, ResponsableTipo };

export type Prio = 'alta' | 'media' | 'baja' | 'futuro';
// Quién tocó algo. Los dos últimos son IA pero NO son lo mismo, y confundirlos es
// mentir sobre el producto:
//   'ia'   = MaKo, la IA que corre DENTRO de la app (el Perro puntuando, el doer,
//            la Retro creando tareas). Es una función del producto: le pasa igual
//            al cliente.
//   'code' = Claude Code, el agente de desarrollo que edita el repo y despliega.
//            Nada de lo que hace acá lo puede hacer MaKo, ni le pasa a un cliente.
// Firmar como 'ia' algo que hizo 'code' hace parecer que el Perro trabaja cuando
// en realidad lo escribió un dev con un deploy.
export type Actor = 'user' | 'ia' | 'code';
export const esIA = (a: Actor) => a !== 'user';
export const ACTOR_LABEL: Record<Actor, string> = { user: '', ia: 'MaKo', code: 'Claude Code' };

// La FUENTE de una tarjeta: DE DÓNDE salió (más rico que `origen`, que solo dice quién).
// Fathom (una reunión), WhatsApp, un archivo, o Claude Code (con nombre + link del chat).
export type FuenteTipo = 'manual' | 'mako' | 'fathom' | 'whatsapp' | 'archivo' | 'claude-code' | 'retro' | 'experimento' | 'recurrente';
export type Fuente = { tipo: FuenteTipo; etiqueta?: string; url?: string }; // etiqueta = reunión/archivo/chat; url = link
// Si la tarjeta no tiene fuente explícita, se deriva del origen (compat con lo ya guardado).
export function fuenteEfectiva(t: { origen: Actor; fuente?: Fuente }): Fuente {
  if (t.fuente?.tipo) return t.fuente;
  return { tipo: t.origen === 'user' ? 'manual' : t.origen === 'code' ? 'claude-code' : 'mako' };
}

// Fecha y hora EXACTAS (feedback jul-19): "hace 6 días" no sirve cuando el chat es largo.
// Formato propio (24h, hora local) para no depender de los caprichos del locale ("p. m.").
const MESES_ABR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function fechaHora(ts: number): string {
  try {
    const d = new Date(ts);
    if (!Number.isFinite(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    const anio = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : '';
    return `${dd} ${MESES_ABR[d.getMonth()]}${anio} · ${hh}:${mi}`;
  } catch { return ''; }
}
export type Check = { id: string; text: string; done: boolean };
export type UndoInfo = { field: string; prev: unknown };
export type Hist = { id: string; ts: number; actor: Actor; text: string; undo?: UndoInfo; kind?: 'task' };

/**
 * SANEA EL HISTORIAL QUE VIENE DE LA BASE. El tipo de arriba dice `ts: number` y `actor` de
 * tres valores; la base tenía otra cosa, y el cast `asArr<Hist>(...)` la dejaba pasar entera.
 *
 * Medido el 21/8/2026 sobre el tablero real: **418 entradas con `ts` guardado como string ISO
 * y `actor: 'MaKo'`**, un cuarto valor que no existe en el union. Las escribió
 * `scripts/barrido-aplicar.ts`, que armaba la entrada sobre un `Row` (Record<string, unknown>)
 * — y a un `Row` no lo mira el compilador. Un tipo que solo se declara en la lectura no
 * protege la escritura.
 *
 * Cómo se veía: la fecha se dibujaba bien (`new Date(string)` parsea), así que el bug era
 * INVISIBLE en pantalla salvo por el tooltip, que decía «hace NaN d». Lo que rompía de verdad
 * era la ARITMÉTICA: `Math.max(...ts)` sobre una lista con un string da NaN, y NaN en una
 * comparación es siempre `false`. La regla de «30 días sin tocar» se estaba calculando sobre
 * 362 de 550 tareas con el resultado NaN, o sea silenciosamente sobre ninguna.
 *
 * Por eso el saneo va en la LECTURA y no solo en la reparación de los datos: cualquier
 * script viejo, cualquier import, cualquier fila que quedó de antes vuelve a meter lo mismo, y
 * el síntoma no se ve.
 */
export function sanearHist(v: unknown): Hist[] {
  if (!Array.isArray(v)) return [];
  const out: Hist[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== 'object') continue;
    const h = raw as Record<string, unknown>;
    // epoch, ISO string, o Date. Lo que no se puede fechar se descarta: una entrada sin
    // fecha usable ordenaría mal el historial y envenenaría cualquier cuenta de días.
    const t = typeof h.ts === 'number' ? h.ts : new Date(String(h.ts ?? '')).getTime();
    if (!Number.isFinite(t)) continue;
    // 'MaKo' es como se llama la IA en pantalla, no un actor: el actor de la IA es 'ia'.
    const a = String(h.actor ?? 'ia');
    const actor: Actor = a === 'user' || a === 'ia' || a === 'code' ? a : 'ia';
    out.push({
      id: String(h.id ?? ''), ts: t, actor, text: String(h.text ?? ''),
      ...(h.undo && typeof h.undo === 'object' ? { undo: h.undo as UndoInfo } : {}),
      ...(h.kind === 'task' ? { kind: 'task' as const } : {}),
    });
  }
  return out;
}

export type BoardTask = {
  id: string;
  num: number;              // #n visible
  emoji: string;            // ícono de la tarjeta (antes del título, como el proyecto)
  title: string;
  detalle: string;
  priority: Prio;           // DERIVADA del score (prioFromScore); no la fija el usuario
  score: number;            // 1-100 (MaKo perro guardián). 0 = «Sin priorizar» (`sinPriorizar`)
  /**
   * LA COLUMNA DEL KANBAN (16/10/2026, «hacer el kanban un kanban»): Por iniciar · En proceso ·
   * Atorada · Completada · No cumplen tu criterio. Las claves y las etiquetas, en
   * `lib/todo-estados.ts`. Es un DATO de las dos mitades: `experimento_tareas.estado` (mig 0159)
   * y `plan_tareas.estado` (mig 0294).
   *
   * ⚠️ LO ESCRIBE `repo.mover`, NO EL GUARDADO DE LA TARJETA. El del dueño es un upsert de la
   * fila ENTERA desde la memoria de la pestaña: si el estado viajara ahí, una pestaña abierta
   * hace una hora devolvería de columna cada tarjeta que alguien movió desde otra (o MaKo por la
   * API) apenas le corrigieran un título. `guardarPlanTarea` lo saca del payload y lo deriva del
   * avance SÓLO si el avance cambió (`estadoAlGuardar`); `editPatch` del cliente no lo manda.
   *
   * ⚠️ OPCIONAL, como `recurrente`: una tarjeta optimista o un objeto armado a mano (un test, un
   * script) puede no traerlo. NO se lee suelto: `estadoDe(t)` cae al avance, que es la misma
   * regla del backfill.
   */
  estado?: EstadoTarea;
  /** Por qué está «Atorada», en una línea. Sólo existe con `estado: 'en_seguimiento'` (mig 0294). */
  motivoAtorada?: string | null;
  /**
   * El lugar dentro de su columna, ASCENDENTE (la de menor `orden` arriba). Lo escriben el alta
   * y `repo.mover`; como `estado`, NO viaja en el guardado de la fila entera del dueño.
   */
  orden?: number;
  /**
   * EL JUICIO, separado del número que se muestra (mig 0141). `score` se DERIVA de acá:
   * `curva(scoreBase + deadline − quietud, dependencias)`. Lo escribe quien JUZGA (el
   * Perro, o el dueño al debatir o arrastrar); el reparto determinista NUNCA lo toca.
   * Sin esta separación, el ajuste de una corrida se sumaba a la de la anterior y no había
   * de dónde recuperar el valor original — `curveTaskScores` reasigna por ranking.
   */
  scoreBase?: number;
  scoreRazon?: string;      // por qué el guardián le puso ese score (comparando con el resto)
  deadlineRazon?: string;   // por qué el guardián puso ESA fecha (se debate igual que el score)
  /** Notas libres del dueño. La IA nunca las escribe ni las pisa (mig 0114). */
  notas?: string;
  /** id de lib/mako-capacidades: esta tarea se resuelve DENTRO de MaKo, en esa tab.
   *  Vacío = se hace afuera, que es la mitad del trabajo de un negocio (mig 0115). */
  haceloEn?: string;
  impacto?: number;         // 1-100: cuánto mueve la aguja (dinero / métrica norte)
  esfuerzo?: number;        // 1-100: cuánto cuesta hacerla (menos esfuerzo = mejor)
  progress: number;         // 0-100
  deadline: string;         // '' | YYYY-MM-DD
  /**
   * El Quarter para el que se PLANIFICÓ, formato `2026-Q3`. Vacío = sin asignar.
   *
   * ⚠️ NO ES LO MISMO QUE `deadline` Y POR ESO SON DOS CAMPOS. El deadline dice
   * cuándo VENCE —lo pone el Perro, una reunión o una persona— y el quarter dice
   * cuándo se decidió HACERLO, que sólo lo pone una persona. Derivar uno del otro
   * inventa una decisión que nadie tomó (migs 0155 y 0156).
   */
  quarter?: string;
  labels: string[];         // ids de Label
  checklist: Check[];
  historial: Hist[];
  /**
   * `created_at` en epoch. Viaja al navegador SOLO para que la pantalla pueda calcular el
   * mismo envejecimiento que el servidor (`app/plan/board/envejecer.ts`) y explicar por qué
   * una tarjeta se movió. Sin esto, el chip y el reparto usarían dos definiciones de «hace
   * cuánto» y tarde o temprano dirían cosas distintas.
   */
  creadaEn?: number;
  origen: Actor;            // quién creó la tarjeta (user | ia=MaKo | code=Claude Code)
  fuente?: Fuente;          // DE DÓNDE salió (Fathom/WhatsApp/archivo/Claude Code…); si falta, se deriva del origen
  enPrioridad: boolean;     // "En prioridad" (vista Prioridades, máx 3)
  /**
   * true = este score lo decidiste VOS discutiéndolo con el Perro (mig 0143), igual que en
   * `Label`. La columna existía en `plan_tareas` desde esa migración y NADIE la leía: el
   * candado que protegía a un proyecto debatido no protegía a una tarea debatida, y la
   * recurva de las 9:10 se llevaba puesto el número. Una regla aplicada en un lugar de dos
   * no está implementada.
   */
  scoreManual?: boolean;
  /**
   * true = ESTA TAREA SE REPITE PARA SIEMPRE (mig 0163): la reunión de los miércoles, el
   * seguimiento diario. No es una tarea con inicio y fin, así que no compite en el ranking,
   * no lleva deadline y no cuenta para el avance de su proyecto.
   *
   * ⚠️ NO SE LEE SUELTO. El predicado, el rótulo y el filtro viven en
   * `lib/plan-recurrentes.ts` (`esRecurrente`, `sinRecurrentes`, `ROTULO_RECURRENTE`), que
   * NO tiene `server-only` justamente para que lo puedan importar las pantallas. Escribir
   * `t.recurrente === true` en una pantalla es la primera de las once copias.
   *
   * ⚠️ OPCIONAL, como `scoreManual`: el estado optimista del navegador crea la tarjeta
   * antes de que exista la fila, y una tarea vieja se lee sin el campo hasta que la
   * migración corra. `esRecurrente` contesta `false` en los dos casos, que es la respuesta
   * segura — marcarla de más la saca del ranking sin que nadie lo haya pedido.
   */
  recurrente?: boolean;
  /**
   * CÓMO se repite (mig 0167): una RRULE de RFC 5545, que es lo que guarda Google Calendar
   * — `FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR`. Es el reemplazo del deadline y el quarter
   * que la 0163 le sacó. `null` = se repite y nadie dijo cada cuánto, que es un estado real
   * y distinto de «no se repite».
   *
   * ⚠️ UN SOLO CAMPO, Y ES LA DECISIÓN DE LA MIGRACIÓN. Las 0165 y 0166 lo habían partido
   * en `frecuencia` (enum) + `frecuenciaDia`, y ese modelo no puede decir «varios días de
   * la semana» ni «cada 3 semanas» ni «el segundo martes»: cada una sería otro campo, y una
   * repetición tiene UNA forma por vez — con cuatro, pasar de «cada semana, los lunes» a
   * «cada mes» deja las viejas vivas contradiciendo a la nueva.
   *
   * ⚠️ NO SE LEE SUELTO NI SE ESCRIBE SUELTO. `recurrenciaOk` es el saneo (la columna no
   * tiene `check`: es la única guarda), `recurrenciaDe` la invariante «sin `recurrente` no
   * hay recurrencia», `textoRepeticion` la ÚNICA que la pasa a español y
   * `leerRRule`/`escribirRRule` la ida y vuelta para editarla. Todo en
   * `lib/plan-recurrentes.ts`, que no lleva `server-only` justamente para esto.
   *
   * ⚠️ NO ES UNA FECHA Y NO SE PUEDE VOLVER UNA: una fecha acá la lee el motor de
   * vencimientos como un plazo y vuelve el «la junta semanal está atrasada». Cualquier cosa
   * que no sea una RRULE que este producto sepa leer entra como `null`.
   *
   * Opcional por lo mismo que `recurrente`: la tarjeta optimista nace sin él y una fila
   * vieja se lee sin la columna.
   */
  recurrencia?: string | null;
  /**
   * DE QUIÉN es este trabajo: el lead GANADO del CRM (mig 0172). `null`/ausente =
   * trabajo interno, que NO es lo mismo que «no se sabe» — esta pregunta la contesta
   * una persona eligiendo de una lista, así que vacío significa que eligió que no es
   * de nadie.
   *
   * ⚠️ ES LA CLAVE, Y ANTES NO HABÍA NINGUNA. Hasta la 0172, de quién era un proyecto
   * se adivinaba por el NOMBRE («Cliente: Macario Romero») y `app/customer-success/cruce.ts`
   * documenta cómo falla eso sobre los datos reales: de 14 clientes del ws1, 6 cruzaban,
   * 8 quedaban sin proyecto y 3 proyectos con 30 tareas sin dueño. Un parecido no es una
   * clave; esto sí, y por eso gana sobre el nombre en el cruce.
   */
  clienteLeadId?: number | null;
  /** El nombre con el que se asignó. Es una ETIQUETA para pintar el chip sin ir a buscar
   *  `leads` en cada carga; la clave es `clienteLeadId` y ningún cálculo se apoya acá.
   *  Si el lead se renombra en el CRM, esto queda viejo hasta la próxima asignación. */
  clienteNombre?: string | null;
  /**
   * QUIÉN LA HACE, relativo al dueño del tablero (mig 0159): 'mio' / 'cliente' / 'tercero';
   * `null` = nadie lo dijo, que NO es «mío». Es lo que mira el filtro «Responsable» del kanban
   * (16/10/2026, app/plan/board/kanban.ts).
   *
   * ⚠️ SÓLO LO TIENE EL TABLERO DEL CLIENTE (`experimento_tareas.responsable_tipo`). Lo escribe
   * la extracción de una reunión (`aplicarPropuestas`); `plan_tareas` no tiene la columna, así
   * que en el tablero del dueño llega siempre `undefined` y el filtro no se dibuja (`Repo.responsables`).
   *
   * ⚠️ SE LEE Y NO SE ESCRIBE desde el tablero, a propósito: `editPatch` (TodoBoard.tsx) es
   * PARCIAL y no lo manda, así que ningún guardado puede borrarlo; y `taskToRow` del dueño no
   * tiene a dónde escribirlo. No hay control en pantalla para cambiarlo — el día que lo haya, va
   * por los seis lugares (AGENTS.md).
   */
  responsableTipo?: ResponsableTipo | null;
};

export type Label = { id: string; pid?: string; emoji: string; name: string; color: string; score: number; scoreRazon?: string; impacto?: number; esfuerzo?: number; deadline?: string; detalle: string; notas?: string; historial: Hist[]; fuente?: Fuente; escalon?: number; desbloquea?: string;
  /**
   * Para cuándo se PLANIFICÓ el proyecto (`2026-Q3`), que no es lo mismo que cuándo vence
   * (mig 0162). Se deriva del `deadline` cuando está vacío y nunca lo pisa: si no
   * coinciden, la pantalla avisa — puede ser un error de tipeo o una decisión, y quien
   * sabe cuál de las dos es, es la persona.
   */
  quarter?: string;
  /**
   * true = este score lo decidiste VOS discutiéndolo con el Perro (mig 0143). La corrida
   * automática puede proponer moverlo —lo escribe en la razón— pero no lo pisa. Sin esta
   * marca, un número que salió de una discusión que ganaste es indistinguible de uno que
   * puso una corrida de las 9:10, y mañana se lo lleva puesto.
   */
  scoreManual?: boolean;
  /**
   * true = ESTE PROYECTO SE REPITE PARA SIEMPRE (mig 0164): Customer Success, las reuniones
   * de marketing. Es la regla hermana de `BoardTask.recurrente`, un nivel más arriba, y
   * faltaba: el trabajo recurrente de verdad casi nunca es una tarea suelta, es el
   * CONTENEDOR del que cuelgan las tareas de cada semana.
   *
   * No entra al ranking de proyectos (`priorizarProyectosOwner`), no lleva deadline ni
   * quarter (se los borra `labelToRow`, que es por donde pasan TODAS las escrituras) y no
   * cuenta como «✓» en el avance del plan: «hecho» no existe para algo que no termina.
   *
   * ⚠️ NO ARRASTRA A SUS TAREAS, Y ES LA DECISIÓN, NO UN OLVIDO. «Armar el documento de
   * onboarding de Vertice» cuelga de Customer Success, tiene un entregable y se cierra una
   * sola vez: sacarla del ranking por vivir en un contenedor que se repite la volvería
   * invisible justo cuando hay que hacerla. Las dos marcas son independientes — la del
   * proyecto dice «este contenedor no termina», la de la tarea dice «esta tarea no termina».
   *
   * ⚠️ NO SE LEE SUELTO: `esRecurrente` / `sinRecurrentes` de `lib/plan-recurrentes.ts`, que
   * ya acepta cualquier `{ recurrente?: boolean }` y por eso sirve para un Label sin tocarlo.
   *
   * ⚠️ OPCIONAL por lo mismo que en `BoardTask`: el estado optimista del navegador crea el
   * proyecto antes de que exista la fila, y `esRecurrente` contesta `false` ante `undefined`,
   * que es la respuesta segura.
   */
  recurrente?: boolean;
  /**
   * CÓMO se repite el proyecto (mig 0167). Gemelo exacto de `BoardTask.recurrencia`: la
   * misma RRULE, el mismo saneo (`recurrenciaOk`), la misma invariante (`recurrenciaDe`) y
   * la misma frase (`textoRepeticion`). Un proyecto que se repite —Customer Success, las
   * reuniones de marketing— tampoco lleva deadline ni quarter, así que «Cada semana, los
   * lunes» es todo lo que puede decir sobre cuándo.
   */
  recurrencia?: string | null;
  /**
   * DE QUIÉN es este trabajo: el lead GANADO del CRM (mig 0172). `null`/ausente =
   * trabajo interno, que NO es lo mismo que «no se sabe» — esta pregunta la contesta
   * una persona eligiendo de una lista, así que vacío significa que eligió que no es
   * de nadie.
   *
   * ⚠️ ES LA CLAVE, Y ANTES NO HABÍA NINGUNA. Hasta la 0172, de quién era un proyecto
   * se adivinaba por el NOMBRE («Cliente: Macario Romero») y `app/customer-success/cruce.ts`
   * documenta cómo falla eso sobre los datos reales: de 14 clientes del ws1, 6 cruzaban,
   * 8 quedaban sin proyecto y 3 proyectos con 30 tareas sin dueño. Un parecido no es una
   * clave; esto sí, y por eso gana sobre el nombre en el cruce.
   */
  clienteLeadId?: number | null;
  /** El nombre con el que se asignó. Es una ETIQUETA para pintar el chip sin ir a buscar
   *  `leads` en cada carga; la clave es `clienteLeadId` y ningún cálculo se apoya acá.
   *  Si el lead se renombra en el CRM, esto queda viejo hasta la próxima asignación. */
  clienteNombre?: string | null;
  /**
   * SU PORTADA (mig 0173): `grad:<id>` del catálogo de `lib/portadas.ts`, una URL https
   * de un origen permitido, o vacío. Vacío NO es un dato faltante: es el degradado
   * derivado de `color`, que es lo que se ve hoy y sigue siendo el default.
   *
   * ⚠️ ES DEL PROYECTO Y NO DE LA TAREA, a propósito. Una portada por tarjeta en un
   * Kanban de 396 tareas sería una pared de fotos donde hoy se lee un título; el
   * proyecto es el contenedor, y es el nivel donde una imagen identifica algo.
   *
   * ⚠️ VA EN LOS DOS MAPPERS DE LECTURA, y olvidarlo en uno es DESTRUCTIVO. El guardado
   * del tablero del dueño es un `upsert` de la fila ENTERA armada desde el estado del
   * navegador: un campo que la lectura no trae vuelve como `undefined`, sale como `null`
   * y BORRA la columna en el próximo guardado de cualquier otro campo. Es la quinta vez
   * que este repo agrega una columna al tablero (prioridad, Quarter 0162, recurrencia
   * 0164, cliente 0172) y la trampa es siempre la misma.
   *
   * ⚠️ Y ESTE CAMPO SE ESCRIBE EN `Label`, NO EN `BoardTask`. Los dos tipos terminan con
   * el MISMO comentario de `clienteNombre` y el mismo `};`, así que una inserción por
   * texto cae en el primero — que es lo que acaba de pasar al escribir esto, y lo que
   * AGENTS.md ya tenía medido de la vez anterior.
   */
  portada?: string | null;
  /**
   * EL ENCUADRE VERTICAL de la portada, 0-100 (mig 0174). `null`/ausente = centrado,
   * que es lo que se veía antes de que existiera.
   *
   * Sólo significa algo si la portada es una FOTO: un degradado no se puede
   * reencuadrar, y por eso el control no se dibuja cuando no hay imagen.
   */
  portadaY?: number | null;
  /**
   * SU ÍCONO (mig 0174): `icon:<set>:<nombre>` de Iconify o una URL https del bucket.
   *
   * ⚠️ ES UNA COLUMNA APARTE Y NO EL `emoji`, y la razón está medida: `emoji` se
   * trunca a CUATRO caracteres en la mitad del cliente (`lib/todo.ts:621`), así que
   * una URL ahí queda en «http»; el Perro lo pisa con lo que devuelve el modelo
   * (`lib/plan-board.ts:1131`); y lo leen como TEXTO el prompt de reuniones, el
   * export a Markdown, el CSV y la API de MaKo.
   *
   * La regla de lectura es `icono ?? emoji` y **sólo la aplica la pantalla**: los
   * consumidores de texto siguen leyendo `emoji`, que siempre es un glifo.
   */
  icono?: string | null;
};

/**
 * LA ESCALERA DEL DINERO (mig 0142). Es la regla que ORDENA toda la metodología del Perro,
 * y hasta hoy vivía únicamente adentro de una frase en lenguaje natural: no se podía
 * ordenar por ella, ni mostrarla, ni contar cuántas cosas del tablero caen en cada escalón.
 *
 * Los escalones 1 a 3 le ganan al 4, y el 4 le gana al 5, salvo que el 5 desbloquee
 * explícitamente a uno de los otros — y ahí hay que nombrar a cuál (`desbloquea`).
 */
export const ESCALERA: Record<number, { corto: string; largo: string }> = {
  1: { corto: 'Cobrar', largo: 'Cobrar lo que ya se vendió, o poder cobrar' },
  2: { corto: 'Conversación', largo: 'Traer una conversación nueva con alguien que puede comprar' },
  3: { corto: 'No perder', largo: 'No perder a un cliente que ya está adentro' },
  4: { corto: 'Convertir', largo: 'Convertir mejor lo que ya entra' },
  5: { corto: 'Construir', largo: 'Construir una capacidad que recién después hace alguna de las otras' },
};
// El id VISIBLE de un proyecto (P1, P2…): distinto del #num de las tareas a propósito,
// para que de un vistazo se sepa si un id es de tarea o de proyecto. Estable por orden.
export const pidDe = (l: { pid?: string }, i: number) => l.pid || `P${i + 1}`;
export type BoardUser = { nombre: string; avatarUrl: string };

// Lo que el Perro server-side le dejó a UNA tarjeta. Vuelve al navegador para que el
// board lo aplique en el acto: si no vuelve, la UI sigue mostrando el score viejo y el
// próximo saveTask (upsert de la fila entera) le pisa lo que el Perro acaba de escribir.
export type GuardPatch = {
  id: string; score?: number; scoreRazon?: string; impacto?: number; esfuerzo?: number; deadline?: string; deadlineRazon?: string; haceloEn?: string;
  priority?: Prio; detalle?: string; checklist?: Check[]; historialEntry?: Hist;
  /** A qué proyecto la ruteó el Perro. Sólo viaja cuando la tarea nació SIN proyecto. */
  labels?: string[];
};
/** Ídem para un proyecto nuevo (emoji + descripción + score del Perro). */
export type GuardProjPatch = { id: string; score: number; scoreRazon: string; impacto?: number; esfuerzo?: number; emoji: string; detalle: string };
// `sinPuntuar` es el número de tareas que el Perro NO alcanzó a puntuar. Tiene que
// viajar hasta la pantalla: el 5/8 entraron 20 tareas con el score de fábrica (62), sin
// razón y sin fecha, porque el JSON del modelo se cortó — y nadie se enteró hasta
// mirar la base a mano. Un fallo silencioso en el Perro envenena todo el tablero.
// `recurvadas` / `proyectosMovidos` son el REPARTO que hace el server después de que el
// Perro ubica lo nuevo (`recurvarPlanOwner` / `recurvarProyectosOwner`, lib/plan-board.ts):
// no son decisiones del modelo, son la pirámide rehecha sobre el tablero entero. Van acá
// para que la pantalla pueda decir cuántas cosas se movieron sin volver a consultar.
export type GuardResult = { tareas: Record<Prio, number>; proyectos: number; patches: GuardPatch[]; proyectosPatch: GuardProjPatch[]; sinPuntuar?: number; recurvadas?: number; proyectosMovidos?: number };

// Persistencia inyectada por cada parent. Todo async; useBoard es optimista.
export type Repo = {
  labelMode: 'single' | 'multi';          // admin: 1 proyecto/tarea; cliente: n categorías
  labelSingular: string;                   // "Proyecto" | "Categoría"
  labelPlural: string;                     // "Proyectos" | "Categorías"
  // Habilita "Extraer de una reunión" (G3): lee Fathom y crea tareas. Solo el
  // super-admin de la agencia (usa la Fathom key de la agencia).
  fathomExtract?: boolean;
  /**
   * Habilita LA AUDIENCIA: «Cambiar prioridad», donde se le discute el número al Perro.
   *
   * ⚠️ MISMA FAMILIA QUE `prioridadManual`, Y SE ESCAPÓ EN EL MISMO BARRIDO. El botón lo
   * dibujaban los dos boards, pero `reprio-proponer`/`reprio-aplicar` leen y escriben
   * `plan_tareas`/`plan_proyectos` — las tablas del DUEÑO. En el tablero de un cliente esas
   * tablas están vacías para su workspace, así que la audiencia arrancaba, cobraba el
   * razonamiento del modelo y terminaba en «no encontré la tarea»: un botón que se lee como
   * que la app está rota. Es un booleano y no una función porque lo que falta no es una
   * escritura del board, es un backend entero.
   *
   * ⚠️ Y NO CUBRE A `FechaDebateModal`, que es otra cosa: ahí el modelo sólo OPINA y la
   * fecha la escribe el board por su propio repo, así que funciona en los dos.
   */
  debatePrioridad?: boolean;
  /**
   * La lista CERRADA de proyectos grandes. Cada tablero trae la suya: el del dueño las
   * tabs del producto (lib/plan-proyectos-catalogo) y el de un cliente las ÁREAS de su
   * marketing (lib/todo-proyectos-catalogo) — sus CLIENTES no van acá, los resuelve el
   * server contra el CRM. Cuando está, la extracción de reuniones solo puede proponer
   * proyectos de acá: es lo que impide que una reunión abra un proyecto nuevo con el
   * nombre que se le ocurra al modelo.
   */
  catalogo?: Array<{ nombre: string; emoji: string; que: string }>;
  createTask(draft: BoardTask): Promise<BoardTask>;  // devuelve canónica (id puede cambiar)
  saveTask(task: BoardTask): Promise<void>;          // upsert de una tarea existente
  deleteTask(id: string): Promise<void>;
  createLabel(draft: Label): Promise<Label>;         // devuelve canónica (id server)
  saveLabel(label: Label): Promise<void>;
  deleteLabel(id: string): Promise<void>;
  // El PERRO GUARDIÁN server-side puntúa/describe tareas nuevas ya creadas (por ids),
  // ubicándolas en la pirámide existente + checklists. Lo implementa SOLO el board del
  // dueño (plan_tareas); así Fathom/archivo/alta reciben el MISMO trato que WhatsApp.
  // El board del cliente no lo tiene (usa su Perro client-side) → opcional.
  priorizarNuevas?(ids: string[], proyectoIds?: string[], contexto?: string): Promise<GuardResult | null>;
  /**
   * AMPLIAR una tarjeta que ya existe en vez de crear una segunda igual. Es lo que
   * pasa cuando se cargan varias reuniones seguidas: la misma tarea se habla en tres
   * llamadas. Devuelve los patches para pintarlo sin recargar.
   */
  ampliarTareas?(items: Array<{ id: string; detalle: string }>, fuente?: Fuente): Promise<GuardPatch[]>;
  /**
   * Dependencias (mig 0140). OPCIONALES a propósito: un board que no las guarda es un
   * board sin la columna, y la ausencia tiene que VERSE (el bloque no se dibuja) en vez
   * de dibujarse y no guardar nada. La lista completa vuelve del server porque el guard
   * de ciclo corre allá.
   */
  /**
   * Fijar la prioridad A MANO (el slider del detalle y el pop-up del arrastre).
   *
   * ⚠️ OPCIONAL, Y LA AUSENCIA TIENE QUE VERSE. Lo implementa SOLO el board del dueño:
   * escribe por `/api/plan-board`, que contesta 403 «solo admin» a cualquier cliente, y
   * usa `score_manual` (mig 0143), una columna que `experimento_tareas` no tiene. Un
   * board que no lo trae NO dibuja el control: un slider que existe y contesta 403 es
   * peor que no tenerlo — se lee como que la app está rota, y encima esconderlo no
   * protege nada porque el que decide es el server.
   */
  prioridadManual?(entidad: 'proyecto' | 'tarea', id: string, score: number, opts?: OpcionesPrioridadManual): Promise<{ score: number; movidos: Array<{ id: string; nombre: string; antes: number; despues: number }> }>;
  /** Devolverle la decisión a MaKo (saca el candado de la mig 0143). Va de la mano del anterior. */
  prioridadAlPerro?(entidad: 'proyecto' | 'tarea', id: string): Promise<void>;
  /**
   * ¿ESTE TABLERO DESEMPATA? `true` = pedirle el MISMO número a varias no las deja a todas
   * en ese número: la cascada del server reparte slots únicos.
   *
   * Existe por el lote de prioridad del 04/10/2026, y es lo que le permite al pop-up decir
   * la verdad ANTES de escribir. En el tablero del DUEÑO, `fijarYDesempatar` le da el
   * número exacto a la que se está fijando y empuja un escalón a las que ya lo ocupaban, así
   * que N pedidas «en 85» terminan en [85−(N−1), 85]. En el del CLIENTE no hay cascada
   * —`prioridadManual` escribe el número pelado y devuelve `movidos: []`—, así que ahí las
   * N sí quedan todas en 85.
   *
   * ⚠️ NO SE DERIVA DE LA ENTIDAD. «Es un proyecto, entonces desempata» es falso en el
   * tablero del cliente, donde las categorías tampoco desempatan: lo que decide es QUIÉN
   * ESCRIBE, no qué se escribe. La prop ES la capacidad, igual que las dos de arriba.
   */
  prioridadDesempata?: boolean;
  /**
   * MOVER UNA TARJETA en el kanban (16/10/2026): a otra columna (`estado`) y/o a otro lugar
   * dentro de la columna (`orden`, ver `ordenEntre` en lib/todo-estados.ts). Sin `orden`, va
   * arriba de la columna destino. `motivo` sólo significa algo al ir a «Atorada»
   * (`trasMover`: `undefined` lo conserva si ya estaba atorada, `null` lo borra).
   *
   * Devuelve la tarjeta como quedó en la base (estado, avance, motivo y orden: mover a
   * «Completada» la deja al 100%, sacarla de ahí la reabre en 0%), o `null` si no hay base
   * (la demo). TIRA si el server la rechaza (una recurrente no se completa; un estado que no
   * existe): la pantalla tiene que poder volver la tarjeta a su lugar.
   *
   * ⚠️ UNA ACCIÓN PROPIA Y NO EL GUARDADO DE LA TARJETA, a propósito: ver `BoardTask.estado`.
   * Y NO pregunta la prioridad: «cuando tú muevas una tarjeta, yo no debería preguntarte cuál
   * es la nueva prioridad» → «Es correcto» (Mauricio, 12/10/2026).
   *
   * ⚠️ OPCIONAL porque el tipo lo implementan también tableros armados a mano (tests, la demo
   * de Customer Success); los DOS tableros reales la tienen (TodoBoard y `repoPlan`).
   */
  mover?(id: string, estado: EstadoTarea, orden?: number, opts?: { motivo?: string | null; historial?: Hist[] }): Promise<BoardTask | null>;
  /**
   * ¿LAS TARJETAS DE ESTE TABLERO SABEN QUIÉN LAS HACE? (`BoardTask.responsableTipo`, mig 0159).
   * Es lo que dibuja el filtro «Responsable» del kanban (16/10/2026). Sólo el del CLIENTE:
   * `plan_tareas` no tiene la columna, y un filtro que en el tablero del dueño mete el 100% de
   * las tarjetas en «Sin asignar» se lee como un control roto. La prop ES la capacidad, como
   * `prioridadManual` y `debatePrioridad`.
   */
  responsables?: boolean;
  addDep?(d: { entidad: 'tarea' | 'proyecto'; deId: string; aId: string; clase?: 'bloquea' | 'ordena'; razon?: string }): Promise<{ ok: boolean; error?: string; camino?: string[]; deps?: import('./dependencias').Dep[] }>;
  delDep?(entidad: 'tarea' | 'proyecto', deId: string, aId: string): Promise<{ ok: boolean; deps?: import('./dependencias').Dep[] }>;
};

export const PRIOS: Prio[] = ['alta', 'media', 'baja', 'futuro'];
export const PLABEL: Record<Prio, string> = { alta: 'Alta', media: 'Media', baja: 'Baja', futuro: 'A futuro' };
export const PCOLOR: Record<Prio, string> = { alta: '#D0504A', media: '#C8870C', baja: '#1E9E57', futuro: '#98A0AC' };
export const SWATCHES = ['#98A0AC', '#2F6FED', '#1E9E57', '#C8870C', '#D0504A', '#7C5CFB', '#0E9B8E', '#D6489B'];

/**
 * Como se llama cada color de la paleta.
 *
 * ⚠️ VIVE ACA, AL LADO DE `SWATCHES`, y no en BoardShell. Los dos los necesita ahora
 * tambien el selector de portada —el color del proyecto ES su portada automatica—, y
 * ese componente no puede importar de BoardShell: BoardShell lo importa a el, y seria
 * un ciclo. Una copia del diccionario en el otro archivo es la forma de que dentro de
 * un mes «Ambar» se llame distinto en dos pantallas.
 */
export const COLOR_NAMES: Record<string, string> = {
  '#98A0AC': 'Gris', '#2F6FED': 'Azul', '#1E9E57': 'Verde', '#C8870C': 'Ámbar',
  '#D0504A': 'Rojo', '#7C5CFB': 'Violeta', '#0E9B8E': 'Turquesa', '#D6489B': 'Rosa',
};

/** El nombre de un color, o «Personalizado» si lo eligieron con el selector RGB. */
export const colorName = (c: string): string => COLOR_NAMES[c.toUpperCase()] || COLOR_NAMES[c] || 'Personalizado';
// Vista "Prioridades": tope de tarjetas marcadas. Eran 3 y pasaron a 5 el 22/09/2026, a
// pedido: con tres, la pantalla del día se quedaba corta antes de la tarde.
export const MAX_PRIORIDAD = 5;
export const HIST_CAP = 80;     // tope de entradas del change history por tarea

export const uid = () => 'x' + Math.random().toString(36).slice(2, 9);
export const clampPct = (v: number) => Math.max(0, Math.min(100, Math.round(Number.isFinite(v) ? v : 0)));

export function relTime(ts: number, nowMs: number): string {
  const s = Math.max(0, Math.round((nowMs - ts) / 1000));
  if (s < 45) return 'hace unos segundos';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86400)} d`;
}

// Una tarea Alta (no terminada) está "incompleta" si le falta el deadline. Las tareas al
// 100% no cuentan (ya están hechas, no tiene sentido pedirles plan).
// ⚠️ También miraba la CHECKLIST, hasta que las checklists salieron del producto
// (22/09/2026). Hoy el único dato que el Perro no puede deducir solo es la fecha.
// ⚠️ Y UNA RECURRENTE NO ESTÁ INCOMPLETA POR NO TENER FECHA (mig 0163): lo que se repite
// no vence, así que pedirle un deadline es pedirle un dato que no existe — y esto alimenta
// un triangulito rojo que TITILA, o sea una alarma permanente sobre algo a lo que no le
// falta nada. Es el caso de manual de «un consumidor huérfano de un campo que ya nadie
// escribe»: no falla, titila.
export const altaIncompleta = (t: BoardTask) => t.priority === 'alta' && t.progress < 100 && !t.deadline && llevaDeadline(t);

// ── Score 1-100 ⇄ columna (el guardián pone el score; la columna se DERIVA) ──
export const clampScore = (v: number) => Math.max(0, Math.min(100, Math.round(Number.isFinite(v) ? v : 0)));
export const MAX_PROJ = 100; // prioridad del proyecto: 1-100 (igual que las tareas; con 34+ proyectos, 1-10 se quedaba corto y empataba)
export const clampProj = (v: number) => Math.max(1, Math.min(MAX_PROJ, Math.round(Number.isFinite(v) ? v : 50)));

// Curva las tareas a una PIRÁMIDE sana usando el RANKING del guardián (el modelo
// tiende a inflar: mete casi todo en Alta/Media y casi nada en "A futuro"). Toma el
// orden por score y reasigna scores por banda: top ~15% Alta, ~25% Media, ~30% Baja,
// ~30% A futuro. Devuelve id → score nuevo. (En planes chicos, <5 tareas, no fuerza.)
export function curveTaskScores(items: Array<{ id: string; score: number }>): Record<string, number> {
  const out: Record<string, number> = {};
  const n = items.length;
  if (n === 0) return out;
  // ⚠️ CON POCAS TAREAS NO SE CURVA NADA, Y EL UMBRAL NO ES 5 SINO 20.
  //
  // Esta función reparte por RANKING: mira el ORDEN y descarta los valores que puso el
  // Perro. Con cientos de tareas eso es la disciplina que hace falta —el modelo infla y
  // amontona, y la ley de los grandes números hace que la pirámide sea razonable—. Con
  // pocas es destruir el único juicio que hay.
  //
  // Medido con el umbral viejo: con 5 tareas ya mandaba 2 a «A futuro» con score 2. O sea
  // le decía a alguien que acaba de escribir cinco cosas que dos no importan, sin mirar
  // qué había decidido el Perro sobre ellas. Y con 550 hacía exactamente lo mismo: la
  // forma del reparto era independiente de cuántas cosas había que repartir, que es
  // justo lo que el dueño señaló — *«si tengo pocas tareas no es lo mismo que si tengo
  // muchas»*.
  //
  // Debajo de 20 gana el juicio: el prompt ya le pide la pirámide, y si igual infla lo
  // dice `piramideSana` (app/plan/board/metodologia.ts) en vez de taparlo redistribuyendo.
  // Se probaron dos alternativas antes de esta y las dos eran peores: comprimir el rango
  // hacia el techo mete TODO en Alta, y bajar el piso con una curva exponencial es
  // inventar un exponente sin nada que lo justifique.
  if (n < 20) { items.forEach((x) => { out[x.id] = clampScore(x.score); }); return out; }
  const order = items.map((x, i) => ({ id: x.id, score: x.score, i })).sort((a, b) => b.score - a.score || a.i - b.i);
  order.forEach((o, k) => {
    const frac = k / (n - 1); // 0 = la más importante … 1 = la menos
    let s: number;
    if (frac < 0.15) s = Math.round(93 - (frac / 0.15) * 17);            // 93 → 76  (Alta)
    else if (frac < 0.40) s = Math.round(72 - ((frac - 0.15) / 0.25) * 21); // 72 → 51  (Media)
    else if (frac < 0.70) s = Math.round(48 - ((frac - 0.40) / 0.30) * 22); // 48 → 26  (Baja)
    else s = Math.round(23 - ((frac - 0.70) / 0.30) * 21);              // 23 → 2   (A futuro)
    out[o.id] = Math.max(1, Math.min(100, s));
  });
  return out;
}

// Reparte los scores de proyectos en 1-10 SIN empatar, conservando el orden por score
// (el guardián decide el RANKING; nosotros garantizamos valores distintos y usando la
// escala completa — el modelo tiende a amontonar y empatar). Devuelve id → score nuevo.
export function spreadProjScores(items: Array<{ id: string; score: number }>): Record<string, number> {
  const n = items.length;
  const order = items.map((x, i) => ({ id: x.id, score: x.score, i })).sort((a, b) => b.score - a.score || a.i - b.i);
  const out: Record<string, number> = {};
  let prev = MAX_PROJ + 1;
  order.forEach((o, k) => {
    let v = n <= 1 ? MAX_PROJ : Math.round(MAX_PROJ - k * ((MAX_PROJ - 1) / (n - 1)));
    if (v >= prev) v = prev - 1;   // fuerza estrictamente decreciente (sin empates)
    if (v < 1) v = 1;
    prev = v;
    out[o.id] = v;
  });
  return out;
}
/**
 * ⛔ ACÁ VIVÍA `scoreProyectoDerivado`, Y SE BORRÓ. Léelo antes de volver a escribirlo.
 *
 * Calculaba el score de un proyecto como `max(scores de sus tareas) + bonus de densidad`.
 * El dueño lo rechazó con el argumento que cierra la discusión: *«¿Cómo que "vale lo mismo
 * que su tarea más alta"? Si quisiera hacer eso, ¿para qué me tomé el trabajo de meter IA?
 * Para eso simplemente lo pongo con código. Pero justamente está el Perro Guardián, para
 * asignar prioridades según lo que MUEVE LA AGUJA. Y hay una metodología para eso.»*
 *
 * Y no era discutible: la metodología del propio Perro (GUARDIAN_SYSTEM_TEMPLATE,
 * lib/mako-guardian.ts) ya prohibía, textual, las tres cosas que esa fórmula hacía —
 *   · «EL TAMAÑO DE UN PROYECTO NO ES SU PRIORIDAD» → el bonus de densidad premiaba tamaño;
 *   · «EN TODA LA ESCALA 1-100, sin amontonar… PROHIBIDO empatar» → dejó 12 proyectos
 *     entre 95 y 98, con empates;
 *   · «PROHIBIDO que la razón sea una paráfrasis» → escribía «Vale lo que su mejor tarea:
 *     "…"», que describe el mecanismo en vez de comparar contra otro proyecto.
 *
 * O sea: la regla existía, estaba escrita, y no había UNA SOLA LÍNEA DE CÓDIGO que la
 * mirara. Es «una regla en un prompt no es una regla» (AGENTS.md) cobrada de nuevo.
 *
 * LA LECCIÓN, que es más grande que este archivo: **una invariante entre dos números no se
 * arregla derivando uno del otro.** Que un proyecto quedara por debajo de sus tareas era un
 * síntoma real; la causa era que los juzgaban dos corridas distintas, y la cura es que los
 * juzgue UNA — no reemplazar el juicio por una cuenta, que es tirar la parte cara del
 * sistema para tapar un síntoma barato.
 */
export function prioFromScore(score: number): Prio {
  if (score >= 75) return 'alta';
  if (score >= 50) return 'media';
  if (score >= 25) return 'baja';
  return 'futuro';
}
// score representativo de cada columna (migración de tareas viejas / bajar prioridad a mano)
export const scoreFromPrio: Record<Prio, number> = { alta: 85, media: 62, baja: 37, futuro: 12 };

/**
 * «SIN PRIORIZAR» (16/10/2026): una tarea que nació LIBRE, sin que nadie —ni el Perro— le
 * pusiera un número. Es `score` 0 y nada más: ningún juicio produce un 0 (la prioridad a mano
 * va de 1 a 100, `clampProj` también, y el reparto tiene piso 1).
 *
 * ⚠️ NO ES «A FUTURO», Y POR ESO NO ES `prioFromScore`. `prioFromScore(0)` sigue diciendo
 * 'futuro' porque es la BANDA de un número (y 0 < 25), y la usan el reparto y las cuentas.
 * Pero «A futuro» es un juicio —«esto importa poco»— y una tarea recién cargada de una
 * reunión no fue juzgada: decirle «A futuro» es inventar que alguien decidió que no importa.
 * El chip y el filtro preguntan por `prioFiltroDe`, que contesta las dos cosas.
 *
 * Hasta el 16/10, `toBoard` (desde-todo.ts) convertía el 0 en 62 («Media»), así que «sin
 * priorizar» no se podía ni ver.
 */
export const sinPriorizar = (t: { score: number }): boolean => !(t.score > 0);
export type PrioFiltro = Prio | 'sin_priorizar';
/** Las opciones del filtro de prioridad, en orden (decisión 3 del 16/10/2026). */
export const PRIOS_FILTRO: readonly PrioFiltro[] = ['alta', 'media', 'baja', 'futuro', 'sin_priorizar'];
export const PFILTRO_LABEL: Record<PrioFiltro, string> = { ...PLABEL, sin_priorizar: 'Sin priorizar' };
/** La prioridad que dice el CHIP y que mira el FILTRO: la banda del score, o «Sin priorizar». */
export const prioFiltroDe = (t: { score: number }): PrioFiltro => (sinPriorizar(t) ? 'sin_priorizar' : prioFromScore(t.score));

/** La columna de una tarjeta: su estado, o el que le toca por el avance si no lo trae. */
export const estadoDe = (t: { estado?: EstadoTarea; progress: number }): EstadoTarea => t.estado ?? estadoDeAvance(t.progress);

/**
 * A QUIÉNES MUEVE DE VERDAD UN CAMBIO DE BANDA EN LOTE, Y EN QUÉ ORDEN APLICARLO.
 *
 * «También debería poder subir prioridades desde ahí arriba… de varios juntos» (01/10/2026).
 * La barra de lote ofrece las cuatro BANDAS y no un número, porque la banda es la unidad
 * que la pantalla agrupa: un reorden que no cambia de banda es invisible.
 *
 * ⚠️ LAS QUE YA ESTÁN EN LA BANDA SE QUEDAN AFUERA, y es lo que hace que «subir» nunca
 * baje nada. Con un proyecto en 96 y otro en 30, pedir ALTA tiene que mover al de 30 y
 * dejar al de 96 donde está: ponerlos a los dos en el representativo (85) le BAJARÍA la
 * prioridad a uno mientras el control dice lo contrario.
 *
 * ⚠️ Y EL ORDEN ES DE MENOR A MAYOR, PARA NO DARLOS VUELTA. La escalera de PROYECTOS no
 * admite empates: fijar el segundo en 85 corre al primero a 84, así que el ÚLTIMO aplicado
 * queda arriba. Ordenando por el score que TENÍAN, el que venía más alto se aplica último
 * y sigue siendo el más alto. En tareas no hay cascada y el orden da igual.
 *
 * Vive acá —y no adentro de la barra— por la regla de siempre: la condición de algo que
 * escribe en lote tiene que poder importarla un test.
 */
export function enOrdenParaLaBanda<T>(items: readonly T[], destino: Prio, score: (t: T) => number): T[] {
  return items.filter((t) => prioFromScore(score(t)) !== destino).sort((a, b) => score(a) - score(b));
}

/**
 * LO MISMO PARA UN NÚMERO EXACTO, Y **SIN FILTRAR** — que es la diferencia que importa.
 *
 * «En el cambio de prioridad en lote, no solo debe darme las opciones de alta, media,
 * baja… sino también la barra deslizable para seleccionar el número» (04/10/2026).
 *
 * ⚠️ ACÁ NO SE SACAN LAS QUE YA TIENEN ESE NÚMERO, aunque sea lo simétrico con la banda, y
 * el motivo es que en PROYECTOS filtrar los DA VUELTA. La escalera del dueño no admite
 * empates: `fijarYDesempatar` le da el número exacto al que se está fijando y empuja un
 * escalón hacia abajo a los que ya lo ocupaban. Trazado sobre el código con A=50, B=20 y
 * C=10 pidiendo los tres a 50:
 *   · FILTRANDO a A (que ya está en 50): se aplica B → B=50 y A cae a 49; después C → C=50,
 *     B=49, A=48. **A, que ya estaba arriba, termina última.**
 *   · SIN filtrar y de menor a mayor (C, B, A): A se aplica última y se queda con 50.
 * Y para la que ya tenía el número, la escritura igual significa algo: le pone el candado
 * de `score_manual` (mig 0143). El no-op real lo resuelve el server, que tiene su salida
 * temprana para «mismo número Y ya estaba fijada a mano» (lib/plan-reprio.ts).
 *
 * El orden es el mismo de `enOrdenParaLaBanda` y por el mismo motivo: el ÚLTIMO aplicado
 * queda arriba, así que la que venía más alta se aplica última y sigue siendo la más alta.
 */
export function enOrdenParaElNumero<T>(items: readonly T[], score: (t: T) => number): T[] {
  return items.slice().sort((a, b) => score(a) - score(b));
}

// Score a partir del cual una tarea es EMERGENCIA (entra a Alta aunque no sea del
// proyecto top). Ej: cuenta de Meta suspendida.
export const EMERGENCY_SCORE = 90;

// La columna sale DIRECTO del score (pirámide real). Con 34+ proyectos finitos ya no
// tiene sentido topear a Media todo lo que no sea del Objetivo Principal: la prioridad
// se juzga entre TODAS las tareas. El foco en el norte vive en la vista Prioridades.
// (El 2º arg queda por compatibilidad de call-sites; ya no restringe.)
export function displayPrio(t: BoardTask, _topProjectId?: string | null): Prio {
  return prioFromScore(t.score);
}
export const puedeSerAlta = (t: BoardTask, topProjectId: string | null): boolean =>
  (topProjectId != null && t.labels.includes(topProjectId)) || t.labels.length === 0 || t.score >= EMERGENCY_SCORE;
