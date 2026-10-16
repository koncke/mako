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
  { titulo: 'Borrar lo que quedó sin call site', detalle: 'Se fueron `PreguntaCampo` y tres textos del contrato de preguntas que no leía nadie (14/10)', estado: 'hecha' },
  { titulo: 'La tarjeta queda donde se soltó', detalle: 'Al soltar en el Kanban se corren las de abajo un punto, sin cruzarse ni cambiar de columna; el deshacer las devuelve', estado: 'hecha' },
  { titulo: 'Las tablas también', detalle: 'Arrastrar una fila de la tabla de tareas (la de la vista Tareas y la de adentro de un proyecto) corre a las de abajo igual que el Kanban (14/10)', estado: 'hecha' },
  { titulo: 'El Perro no deshace el arrastre', detalle: 'La corrida diaria del Perro dejaba de nuevo encima a la vecina corrida en 240 de 513 lugares; ahora en ninguno (14/10)', estado: 'hecha' },
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
  {
    fecha: '6 oct', hora: '—', chat: '—', cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'Revisar el arrastre del Kanban: el drop sobre el hueco y el orden',
    pedido: 'en el plan funciona diferente, ya que la posición son PRIORIDADES, creo que el plan ya lo hace. Si lo hace bien, que no modifique nada',
    puntos: [
      'Llegó por la sesión de Customer Success, que lo había arreglado en su tablero. El primer punto era de ella: un drop que no llega cuando el hueco aparece bajo el cursor quieto. La frase de arriba es de Martín sobre el segundo.',
    ],
  },
  {
    fecha: '6 oct', hora: '—', chat: '—', cuenta: 'claude1', actor: 'claude', tipo: 'investigacion',
    titulo: 'El drop llega siempre; el orden falla entre tareas empatadas',
    puntos: [
      'Arrastrado en el navegador antes de tocar: 6 de 6 drops llegaron al pop-up, 4 con el hueco bajo el cursor quieto. Ese arreglo de Customer Success no hace falta en el Plan.',
      'El orden, contra el tablero real: en 472 de 618 lugares (76%) la tarjeta queda corrida 1 a 3 lugares. 208 tareas abiertas comparten 85 números, y entre dos con el mismo no hay entero que la deje en el medio: decide `num`.',
      'Elegir mejor el número arregla sólo el 21%. Las dos curas de verdad —correr a los vecinos, o una posición a mano— chocan con decisiones anteriores, así que no se tocó código: lo decide Martín.',
    ],
    archivos: [
      'docs/hallazgos-plan.md — «El punto medio es correcto y la tarjeta igual NO queda donde se soltó»',
    ],
  },
  {
    fecha: '7 oct', hora: '—', chat: '—', cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'Unificar el tope de la prueba al cerrar una tarjeta',
    pedido: 'Haz esta tarea aquí: “Unificar el tope de la prueba al cerrar una tarjeta”',
    puntos: [
      'Era el SIN HACER del cierre del tablero del Chatbot (06/10): el borrador aceptaba una prueba de 400 caracteres y el historial la cortaba en 219.',
    ],
  },
  {
    fecha: '7 oct', hora: '18:48', chat: '—', cuenta: 'claude2', actor: 'claude', tipo: 'correccion',
    titulo: 'La prueba de un cierre tiene UN tope, y entra entera a la tarjeta',
    puntos: [
      '**Un tope, en un módulo puro** (`lib/cierre-tarjeta.ts`): lo usan el saneo del borrador, los dos escritores del renglón —super admin y cliente— y la API de MaKo, que tenía el 400 copiado a mano.',
      '⚠️ **El 240 no protegía nada.** Ningún saneador del historial recorta el texto y la tarjeta lo dibuja entero: era un número que sólo cortaba la prueba. Por eso el tope único es el del borrador (400) y no el del renglón — bajarlo a 219 habría tirado evidencia por un límite que no existe.',
      '**Y si una prueba pasa del tope, el corte se ve**: termina en «…» en el borrador, donde la persona la lee antes de confirmar.',
    ],
    commits: [
      { sha: '6641b6d8', msg: 'Plan: la prueba de un cierre tiene UN tope, y lo que entró al borrador queda entero en la tarjeta', lineas: 129, archivos: 5 },
    ],
    archivos: [
      'lib/cierre-tarjeta.ts — `TOPE_PRUEBA_CIERRE`, `recortarPrueba` y `renglonDeCierre`',
      'tests/cierre-tarjeta.test.ts — 4 tests con los tres largos medidos, ocho roturas probadas',
    ],
  },
  {
    fecha: '9 oct', hora: '—', chat: '—', cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'Las tres decisiones que esperaban: el arrastre, los scores del 03/10 y la proyección',
    pedido: '«Cuando soltás una tarjeta entre dos que tienen la misma prioridad, ¿qué querés que pase?» → «Correr las de abajo (Recomendado)». «La corrida del 03/10 reordenó la prioridad de 14 proyectos según la llamada con Leila del 1/10. ¿Qué hago con esas prioridades?» → «Dejarlos (Recomendado)». «¿Qué hago con docs/proyeccion-04oct.md, que nunca se cargó al tablero?» → «Mostrame qué cambiaría (Recomendado)».',
    puntos: [
      'Contestadas en un pop-up de opciones, al retomar el Plan en la cuenta 2. El texto de arriba es la pregunta y la opción elegida, tal cual.',
      'Después, con el costo del arrastre medido (la mitad de las veces se corren 0 o 1 tareas, el 10% peor 29, máximo 52), la segunda pregunta: «Con esos números, ¿cómo sigo con el arrastre del Kanban?» → «Correr las de abajo igual (Recomendado)». La primera estimación («de 2 a 5») era mía y estaba mal.',
    ],
  },
  {
    fecha: '9 oct', hora: '14:38', chat: '—', cuenta: 'claude2', actor: 'claude', tipo: 'implementacion',
    titulo: 'Soltar una tarea en el Kanban la deja donde se soltó: se corren las de abajo',
    puntos: [
      '**Una regla pura, tres lectores** (`app/plan/board/lugar-al-soltar.ts`): el Kanban la usa para sugerir el número, el server del dueño la corre con el tablero recién leído y el tablero del cliente la corre en el navegador.',
      'Contra las 184 abiertas del tablero real (561 lugares): 561 quedan donde se soltaron, ninguna vecina sube ni cambia de columna. Se corren p50 1, p90 29, máximo 52, un punto cada una y sin cruzarse.',
      '**Dos trampas que encontró escribir la verificación**: el botón «Cambiar» se apagaba con el mismo número —soltar una de 62 entre dos de 62 cambia el lugar y no el número— y el server tenía el mismo atajo. Las dos dejaban el lugar imposible de aplicar.',
      'La BASE de cada vecina se corre igual que su número: el Perro re-curva desde ahí cada día. El deshacer devuelve a las vecinas con compare-and-set.',
      '⚠️ Sin verificar con un arrastre en el navegador: el dev server de otra sesión no contestaba y la máquina tenía 0,6 GB libres. Cómo medirlo, en el relevo del Plan.',
    ],
    commits: [
      { sha: '27ef6b28', msg: 'Plan: soltar una tarea en el Kanban la deja donde se soltó, corriendo las de abajo', lineas: 572, archivos: 10 },
    ],
    archivos: [
      'app/plan/board/lugar-al-soltar.ts — `hacerLugar`, `sugerirNumero`, `lugarEn`, `baseCorrida`',
      'lib/plan-reprio.ts — la rama de tareas de `fijarPrioridadAMano` corre a las vecinas y devuelve las que se escribieron',
      'tests/plan-lugar-al-soltar.test.ts — 13 tests, ocho roturas probadas',
    ],
  },
  {
    fecha: '9 oct', hora: '—', chat: '—', cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'Qué cargar de la proyección del 04/10',
    pedido: '«¿Qué cargo de la proyección del 04/10 al tablero?» → «Sólo las 7 que faltan».',
    puntos: [
      'Después de ver el cruce: cuatro bloques ya coincidían, dos fechas eran distintas (Prospección y Anuncios), tres cosas existían sin fecha y siete no existían. La opción elegida decía «sin fecha: el Perro las prioriza. No toco ninguna fecha existente».',
    ],
  },
  {
    fecha: '9 oct', hora: '15:22', chat: '—', cuenta: 'claude2', actor: 'claude', tipo: 'implementacion',
    titulo: 'Las 7 tareas de la proyección que faltaban, cargadas sin fecha',
    puntos: [
      'Por el camino de siempre (borrador y aplicación), así el Perro las ruteó y las puntuó como a cualquier alta: #835 a #841, con prioridades de 81 a 87.',
      '⚠️ **El Perro les puso fecha a las siete (del 10 al 16/10), y no hay forma de pedirle «sin fecha» en un borrador.** Se las saqué después, con su entrada en el historial, porque lo acordado era sin fecha.',
      'Antes de crearlas se verificó contra el código que siguieran sin hacer: el embudo del super admin ya estaba declarado, así que la primera quedó en «darle acceso al CRM».',
      'Al aplicar, el Perro subió «Feature: Cobros y planes» de 80 a 81; ninguno de los 14 proyectos de la corrida del 03/10 cambió.',
    ],
    archivos: [
      'docs/relevo/plan-perro-guardian.md — el cruce de la proyección y lo que se cargó',
    ],
  },
  {
    fecha: '14 oct', hora: '16:10', chat: 'Plan - Perro Guardián', cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'Arrastrar una fila de la tabla de tareas corre a las de abajo, igual que el Kanban',
    puntos: [
      'La tabla de la vista Tareas y la de adentro de un proyecto mandan ahora el LUGAR al pop-up, con la misma regla del Kanban (`hacerLugar`). Antes mandaban el punto medio solo: el mismo gesto daba otro resultado según la vista.',
      '⚠️ **Pasar el lugar no alcanzaba**: la tabla desempataba dos filas con el mismo número por el orden de llegada, no por `num` como el Kanban y el server. La soltada quedaba bien en la base y la tabla la dibujaba en otro lugar. Va el mismo desempate.',
      'Sin verificar con un arrastre en el navegador: la máquina estaba sin RAM (el vigía mató hasta el chequeo de tipos acotado).',
    ],
    archivos: [
      'app/plan/board/Tablas.tsx — `soltarFila`; `useArrastreFilas` entrega `resto` y `pos`; el desempate por `num`',
      'tests/plan-lugar-al-soltar.test.ts — 3 guards nuevos, seis roturas probadas (15/1 cada una)',
    ],
  },
  {
    fecha: '14 oct', hora: '16:43', chat: 'Plan - Perro Guardián', cuenta: 'claude1', actor: 'claude', tipo: 'correccion',
    titulo: 'La corrida del Perro deshacía el arrastre en casi la mitad de los lugares',
    puntos: [
      'Medido simulando la corrida sobre el tablero real (174 abiertas, 513 lugares): **240 de 513** arrastres se deshacían la primera vez que corría el Perro, que es cada día y después de cada alta de tareas.',
      '⚠️ **El diagnóstico del 09/10 era el equivocado**: se creyó que correr también la base de las vecinas alcanzaba. La corrida reparte por RANKING, así que la vecina volvía al número de su puesto.',
      'La cura (`respetarFijadas`): una tarjeta no fijada no cruza a una fijada salvo que el Perro la ponga 3 puntos o más del otro lado. **513 de 513** quedan en su lugar; el tablero sin arrastres sale idéntico. El 3 está medido (con 1 se deshacían 169, con 2 cuatro).',
      'Cuatro formas de ubicar a la fijada en el orden del Perro fallaron antes (65, 103, 80 y 28 deshechos): el Perro distingue tarjetas que en pantalla se ven con el mismo número.',
      'De paso: el chequeo de tipos «acotado» chequeaba el repo entero (`extends` hereda el `include`). Corregido en la memoria y en hallazgos-infra.',
    ],
    archivos: [
      'app/plan/board/lugar-al-soltar.ts — `respetarFijadas`, `MARGEN_CRUCE`',
      'lib/plan-board.ts — `recurvarPlanOwner` corrige el reparto alrededor de lo fijado',
      'tests/plan-lugar-al-soltar.test.ts — 6 tests nuevos, cinco roturas probadas',
    ],
  },
  {
    fecha: '16 oct', hora: '—', chat: '—', cuenta: 'claude3', actor: 'martin', tipo: 'prompt',
    titulo: 'Hacer el kanban un kanban, Fathom sin fricción y «Re-priorizar todo»',
    pedido: 'Implementa end-to-end los cambios del PLAN que pidió Mauricio... Hacer el kanban un kanban... Y optimiza la velocidad de importación de tareas de Fathom... Que hoy en día tardan un montón porque "cruzan" con las otras tareas... Quiero que elimines eso y toda la fricción. Quiero hacerlo "libre", que se creen sin prioridad, y luego de última un botón en los 3 puntos de arriba del plan para "re-priorizar" todo, y eso puede correr en segundo plano y no impedir que el usuario siga utilizando todo...',
    puntos: [
      'Lo de Mauricio sale de dos reuniones (12/10 y 8/9): «el espíritu más importante del Kanban es el flujo… No la clasificación», columnas por iniciar / en proceso / atorada / completada, la prioridad como filtro, y «cuando tú muevas una tarjeta, yo no debería preguntarte cuál es la nueva prioridad».',
      'Se partió en cuatro tandas: el modelo (el estado es la columna), la pantalla del kanban, Fathom sin fricción y «Re-priorizar todo». Las decisiones están en docs/hallazgos-plan.md, una entrada por tanda.',
    ],
  },
  {
    fecha: '16 oct', hora: '09:00', chat: '—', sesion: 'local_0f38f4d5-0e64-411e-b6c8-6d6ead20baed', cuenta: 'claude3', actor: 'claude', tipo: 'implementacion',
    titulo: '«Re-priorizar todo»: el botón de los tres puntos que ordena el plan en segundo plano',
    puntos: [
      'Una entrada en el menú de los tres puntos de los DOS tableros y una operación de la API de MaKo. Arranca un trabajo que recorre las tareas abiertas del Plan de a 20: el Perro de siempre (la red gratis) les pone el número y saca de «Sin proyecto» lo que estaba ahí. Mientras corre, una línea chica «Re-priorizando 40/185» y nada más: el tablero se sigue usando. Al terminar, un toast.',
      'El trabajo es una FILA (`plan_repriorizaciones`, mig 0297): lo empujan el sondeo del tablero abierto y un cron cada minuto, así que sigue aunque se cierre la pestaña. Uno a la vez por tablero, garantizado por la base.',
      'Respeta lo fijado a mano, no toca fechas ni el detalle, nunca toca lo de la Retro ni los experimentos, y una tanda que falla se reintenta entera con el error escrito en la fila; a la tercera se corta.',
      '⚠️ **Lo que estaba escrito era falso**: el candado de «la fijaste a mano» (`score_manual`) existía en la tabla del cliente desde la 0143, aunque tres comentarios y AGENTS.md decían que no. Faltaba quién lo usara: desde hoy el slider del cliente lo pone y «Devolver a MaKo» lo saca.',
      'Lo que el trabajo escribe viaja a la pestaña abierta: los dos tableros guardan la tarjeta entera, y sin eso el próximo guardado le devolvía el número viejo. De paso: la pantalla no se enteraba de la «base» del juicio que reescribe el Perro.',
      'Sin verificar en el navegador (no hay `next dev` en esta máquina): probado con 27 tests contra la base de mentira, rompiendo el código 29 veces.',
    ],
    commits: [
      { sha: 'd4631f43', msg: 'Plan kanban (tanda 4, «Re-priorizar todo»): el trabajo en segundo plano por tandas, el candado del cliente y la API de MaKo', lineas: 2618, archivos: 29 },
    ],
    archivos: [
      'lib/plan-repriorizar-nucleo.ts — lo puro: la foto, la tanda, la vara, el reintento, lo que se dibuja',
      'lib/plan-repriorizar.ts — los dos tableros, avanzar por tandas, el sondeo y el cron',
      'app/plan/board/Repriorizar.tsx — el sondeo, la línea chica y el toast; BoardShell monta la entrada del menú',
      'supabase/migrations/0297_plan_repriorizar.sql — la fila del trabajo (aplicada el 16/10)',
      'tests/plan-repriorizar.test.ts — 27 tests, 29 roturas',
    ],
  },
  {
    fecha: '16 oct', hora: '—', chat: '—', cuenta: 'claude3', actor: 'claude', tipo: 'implementacion',
    titulo: 'La revisión adversarial de la rama: lo que se pisaba mientras alguien esperaba',
    puntos: [
      'Dos revisores reprodujeron los defectos con las funciones reales. Casi todos eran el mismo: algo en segundo plano decidía con una foto vieja, o escribía su resultado en otro momento que el que lo hacía visible, y en ese hueco alguien más escribía.',
      '«Re-priorizar todo» relee cada tarea antes de escribirla (ya no pisa una prioridad fijada a mano mientras el modelo piensa), cuenta el intento al tomar la tanda (una cortada por Vercel se repetía para siempre) y la pantalla mira también los trabajos que no arrancó.',
      'Fathom: las lecturas cruzan ANTES de mostrar el borrador (el autosave del modal borraba el cruce y «Cargar» duplicaba), una fila «Leyendo…» ya no queda así para siempre, y un 503 de Fathom no cierra la reunión como vacía.',
      'Los Deshacer vuelven el avance en el mismo mover (el del teléfono reabría al 0%) y una pestaña vieja del dueño no reabre lo completado en otro lado.',
      '⚠️ El diagnóstico obvio era el equivocado: la ventana de «hasta 90 s» no estaba en cada tanda (el modelo contesta antes de escribir) sino en el cierre del dueño, que publicaba el reparto recién después de juzgar los proyectos.',
      'Quedó sin hacer: soltar entre dos tarjetas con el mismo lugar (es cosmético), y la carga desde el modal de una reunión ya leída que no se alcanzó a cruzar. Los detalles en docs/hallazgos-plan.md.',
    ],
    commits: [
      { sha: '2e3765e9', msg: 'Plan kanban (revisión adversarial): lo que se pisaba mientras alguien esperaba', lineas: 1314, archivos: 36 },
    ],
    archivos: [
      'lib/plan-repriorizar.ts — relee antes de escribir, el intento al tomar, el reparto antes de los proyectos',
      'lib/reunion-cruce.ts y lib/cruce-borrador.ts — cruzar antes de mostrar, y la marca que no borra una copia vieja',
      'lib/plan-propuesta.ts y lib/reunion-auto.ts — la fila «procesando» que nadie cerraba, el sello con sus tareas',
      'lib/todo-estados.ts, lib/plan-mover.ts y app/plan/board/useBoard.ts — los Deshacer en una escritura',
      'tests: plan-repriorizar (34), plan-kanban-server (12), fathom-sin-friccion (28) — 25 roturas nuevas, 25 cazadas',
    ],
  },
];
