// =============================================================================
// Plan — el registro de construcción del área
// =============================================================================
// Alcance: el tablero de tareas (`/plan` del cliente y `/plan/agencia` del super admin),
// que es UNA pantalla montada sobre dos tablas (ver AGENTS.md, «El tablero es UNO y las
// tablas son DOS»), y las puertas por las que le entra trabajo: el alta a mano, las
// reuniones de Fathom, WhatsApp, Claude y el botón de proyecto vacío.
//
// Esta bitácora arranca el 05/10/2026: el área no tenía. Lo de antes —la poda de la
// fricción del Perro del 23/09, la selección en lote del 04/10— vive en
// docs/hallazgos-plan.md, que es donde se escribió en su momento. Acá va lo que Martín
// PIDIÓ, textual, y lo que salió de cada pedido.
//
// NO es un changelog: va el motivo, la trampa y lo que quedó sin hacer.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'Cargar tareas sin preguntas', detalle: 'Las reuniones, WhatsApp, Claude y el proyecto vacío cargan derecho: el borrador nace sin preguntas y la fecha y la prioridad las pone el Perro', estado: 'hecha' },
  { titulo: 'La casilla de selección animada', detalle: 'Tarjetas de tarea y de proyecto con la misma regla del CRM: de ancho 0 a 15 con el hover, y todas a la vista con algo elegido', estado: 'hecha' },
  { titulo: 'Borrar lo que quedó sin call site', detalle: '`PreguntaCampo` y cuatro exports de lib/preguntas-contrato.ts ya no los usa ninguna pantalla', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  {
    fecha: '5 oct', hora: '—', chat: '—', cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'Agregar tareas de una reunión abría un wizard de preguntas',
    pedido: 'Habiamos dicho de sacar absolutamente toda la fricción al agregar tareas y me salta esto luego de intentar agregar tareas del fathom.',
    puntos: [
      'Con la captura del modal de la reunión con Leila: «¿Para cuándo tiene que estar resuelto el aislamiento de datos para evitar que se crucen workspaces?», con calendario y atajos, después de apretar «Agregar 6 al plan».',
    ],
  },
  {
    fecha: '5 oct', hora: '22:32', chat: '—', cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'El alta deja de preguntar, en las tres pantallas y en los cuatro que generaban preguntas',
    puntos: [
      '**No era una pantalla: era un patrón con tres caras.** El modal de las reuniones, el wizard de /plan/revisar (WhatsApp, Claude, proyecto vacío) y, detrás, cuatro productores que las fabricaban con IA: el cron de reuniones, el proyecto vacío, la tool de WhatsApp y la op `sugerir_preguntas_tareas` de la API.',
      'La fricción del Perro ya se había sacado el 23/09 — del alta A MANO. Esta puerta, la de lo que entra de afuera, no pasaba por ninguna de las pantallas que se enumeraron ese día. La pregunta que faltó: **¿por cuántas puertas entra lo que este patrón frena?**',
      'El choke point es `crearPropuesta`: el borrador nace con `notas: []` lo mande quien lo mande. Y `preguntas` salió del TIPO del draft, para que el compilador listara a todos los que las pasaban — fueron diez, tres de ellos scripts viejos.',
      'Lo que esas preguntas contestaban ya lo decide el Perro solo: la fecha y la prioridad, que se cambian a mano en el detalle. Lo que el modelo no pudo deducir va al `detalle` de la tarea.',
      '⚠️ No se verificó con un click en el navegador: «Agregar» crea tareas reales en producción. El botón llama a `aplicar()`, la misma función que corría al final del wizard, y el guard fija ese cableado.',
    ],
    commits: [
      { sha: 'd763c2b9', msg: 'Cargar tareas no pregunta nada: fuera el paso de preguntas en las tres puertas', lineas: 1459, archivos: 24 },
    ],
    archivos: [
      'app/plan/board/TareasRecibidasModal.tsx — «Agregar N al plan» llama a aplicar(); fuera el paso de preguntas y la llamada a la IA que las armaba',
      'app/plan/revisar/[id]/RevisarPropuesta.tsx — quedan los cierres de a uno y confirmar',
      'lib/plan-propuesta.ts — crearPropuesta escribe notas: []; fuera las tres generadoras',
      'tests/alta-sin-preguntas.test.ts — ocho guards, uno por puerta, probados rompiéndolos',
    ],
  },
  {
    fecha: '5 oct', hora: '—', chat: '—', cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'La casilla del Plan, con la animación del CRM',
    pedido: 'También quiero que copies la animación de aparición del checkbox para la selección de multiples tarjetas que hizo el CRM. Es una animación que aparece detrás del título y que se desplaza el título cuando paso el cursor.',
    puntos: [
      'Llegó en medio del trabajo de las preguntas, y se hizo después de cerrar aquello.',
    ],
  },
  {
    fecha: '6 oct', hora: '00:21', chat: '—', cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'La casilla de las tarjetas del Plan se anima con la regla del CRM',
    puntos: [
      'Las tarjetas montaban la casilla con `hover && <input>` desde un estado de React: aparecía de golpe y el título saltaba. Ahora está siempre, en ancho 0, y la abre el hover de `.mk-tarjeta-sel` — **la misma regla** que el CRM y Customer Success, no una copia.',
      'Se hizo en paralelo con la sesión de Customer Success, que pidió el mismo efecto: ella commiteó el selector de la tarjeta y esta sesión le sumó `[data-seleccionando]`, porque en el Plan con algo elegido se ven todas. Los dos trabajos vivían en el mismo `BoardShell.tsx` y se commitearon por hunk.',
      'Medido en la app real, Chromium y WebKit idénticos: reposo 0 px, hover +23 px. Las dos trampas de la medición —el mouse en reposo sobre la barra lateral, que se despliega y tapa la tarjeta, y el scroll suave— están en docs/hallazgos-ui.md.',
    ],
    commits: [
      { sha: 'd988fc98', msg: 'La casilla de las tarjetas del Plan se anima como la del CRM', lineas: 189, archivos: 3 },
    ],
    archivos: [
      'app/plan/board/BoardShell.tsx — CardTile y ProyectoCardTile: casilla siempre montada, sin ancho ni margen lateral inline, cabecera con gap 8',
      'app/globals.css — `.mk-sel-tarjeta[data-seleccionando=\'1\']`',
      'tests/plan-casilla-tarjeta.test.ts — siete guards, ocho roturas probadas',
    ],
  },
];
