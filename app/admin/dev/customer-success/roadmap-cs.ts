// =============================================================================
// ⚠️ LO VIVO Y LA HISTORIA ESTÁN SEPARADOS (desde el 06/10/2026).
// =============================================================================
// Del 26/09 al 06/10 este panel dibujaba como vivo un programa que ya no existía:
// el temario de 44 clases cargado en el Whop de Mauricio, el cuestionario que su
// cliente contestaba por un link y la reescritura con IA de esas respuestas. El
// 26/09 se borró todo eso (`07d07139`: `app/customer-success/programa/`,
// `lib/programa-catalogo.ts`, `lib/cs-respuestas.ts`, `lib/cs-reescritura.ts`, el
// webhook de Whop y las rutas del cuestionario) y el 06/10 salió la integración
// con Whop entera. Los pasos que decían «hecha» eran ciertos sobre lo que se
// construyó y falsos sobre lo que hoy existe, y un panel así hace que el próximo
// diagnóstico arranque de una premisa falsa.
//
// Desde el 06/10 (tarea interna «roadmap-cs-whop»):
//   · PIEZAS, URGENTE y FUTURO describen HOY. El curso vive en MaKo (mig 0202,
//     `lib/curso*.ts`, la tab /customer-success/curso), la etapa de cada cliente
//     existe (mig 0188) y la cartera tiene pantalla.
//   · HISTORIA guarda lo de agosto, con lo que pasó con cada cosa. Se dibuja aparte,
//     sin estado, y sigue reclamando por título las tarjetas del plan que todavía
//     estén abiertas (#659, #660): así se ven y se cierran, en vez de caer en «Del
//     plan, sin lugar en el roadmap» como trabajo vivo.
//   · ⚠️ Los TRES grupos de URGENTE son espejo de las PARTES de `bitacora.ts` (el
//     contador «N de M» del encabezado). No se agrega ni se renombra un grupo de
//     URGENTE sin tocar allá su fila.
// Lo fija `tests/sin-whop.test.ts`: Whop no aparece en lo vivo.
// =============================================================================

// =============================================================================
// Customer Success — el roadmap de implementación
// =============================================================================
// ⚠️ LEER ESTO ANTES DE AGREGAR UN PASO. Las dos skills que Mauricio ya ejecuta
// hoy (`mapa-ejecucion-4dx` y `dashboard-accountability`) dejaron claro que el
// tablero de sus clientes NO se construye adentro de MaKo, y una versión previa
// de este roadmap lo planteaba así — con `lib/tablero-matriz.ts`, migraciones y
// un validador de la matriz en MaKo. Todo eso estaba mal.
//
// LAS TRES PIEZAS, Y QUIÉN ENTRA A CADA UNA (al 06/10/2026):
//   · MaKo             → lo usa MAURICIO. Su cartera, el kanban de la entrega, la
//                        tab Curso, su seguimiento y sus juntas.
//   · El curso         → el CLIENTE, por su link firmado o por `/mi-curso`, con su
//                        propia cookie (`mako_alumno`), nunca con una sesión de MaKo
//                        (c0e2570b). Ve las clases, manda sus tareas y pasa de etapa.
//   · El tablero       → una app PROPIA por cliente, duplicada del repo privado
//                        `plantilla-accountability` (Next + Supabase + Vercel, uno
//                        por cliente). Ahí entra el EQUIPO del cliente a capturar
//                        evidencia. No es MaKo y no va a serlo.
//
// ── HISTORIA (agosto). Whop era la tercera pieza: ahí el cliente veía los videos
// y ahí estaban su acceso y su cobro. Salió el 06/10. Lo de abajo se conserva
// porque explica por qué la tarea vivió siempre en MaKo y no en el LMS. ──
// POR QUÉ LA TAREA NO VIVÍA EN WHOP (verificado en su API, 2026-08-11). Su API
// tiene cursos, capítulos, lecciones, alumnos y el webhook
// `course_lesson_interaction.completed`, así que la SEÑAL de avance sí la da:
// alcanza para recordar, para saber quién se quedó y para avisarle a Mauricio
// antes de la llamada. Lo que NO tiene es endpoint para LEER las respuestas de
// un assessment (solo para enviarlas), ni un lugar donde guardar datos propios
// por miembro. Y el bucle entero necesita justo eso: leer lo que contestó,
// reescribirlo con lo que se habló en la sesión y devolvérselo para que apruebe.
// Un LMS guarda un examen corregido; esto es un documento a tres manos.
//
// Y el Excel (Mapa MCI/OKR) es la bisagra: sale de las sesiones, se completa con
// seis columnas técnicas en chat, y de ahí el BUILD saca la app del cliente. El
// protocolo es explícito: UN SOLO ARCHIVO, cero cuestionario aparte. Por eso acá
// no hay ningún paso que le pida datos a Mauricio ni que modele MCIs en MaKo —
// la propia metodología dice «MCIs: NO se modelan en base de datos».
//
// QUÉ APORTA MAKO, ENTONCES. Tres cosas que hoy no tiene nadie:
//   1. El bucle de entrega, para que el cliente llegue con la tarea hecha.
//   2. El seguimiento de la cartera, que hoy vive en un Excel y en su cabeza.
//   3. El histórico de los seis clientes anteriores, que es lo único que puede
//      destrabar el bloqueo número uno del programa: definir la evidencia.
// =============================================================================


export type EstadoPaso = 'hecha' | 'sigue' | 'bloqueada' | 'cola';

export type Paso = {
  titulo: string;
  /** UNA línea. Acepta `**negrita**` y `` `código` ``. */
  que: string;
  estado: EstadoPaso;
  quien?: 'Mauricio' | 'Los dos';
  /** El título EXACTO de la tarea en /plan. Sin match, no se muestra número. */
  plan?: string;
  /** Lo que YA existe y se reusa, con archivo:línea. */
  yaEsta?: string[];
  /** Qué falta exactamente. */
  falta?: string[];
  /** Archivos concretos a crear o editar. */
  tocar?: string[];
  /** La trampa. Solo donde cambia una decisión. */
  ojo?: string;
};

export type Grupo = { titulo: string; pasos: Paso[] };

/** Las tres piezas y quién entra a cada una. Es lo primero que se lee, y contesta
 *  la pregunta que la pantalla no contestaba: ¿a dónde entra el cliente?
 *  ⚠️ HOY, no agosto: hasta el 06/10 acá había una fila «Whop» y otra con la tarea
 *  que la IA reescribía, y las dos describían cosas que ya no existían. */
export const PIEZAS: { que: string; quien: string; detalle: string }[] = [
  { que: 'MaKo', quien: 'Mauricio', detalle: 'Su cartera, el kanban de la entrega por etapas, la tab Curso y el seguimiento de cada cliente.' },
  { que: 'El curso', quien: 'El cliente, por su link', detalle: 'Ve las clases, manda sus tareas y pasa de etapa al terminarlas. Entra con su link o por `/mi-curso`, con su propia cookie: nunca con una cuenta de MaKo.' },
  { que: 'El tablero', quien: 'El equipo del cliente', detalle: 'Una app propia por cliente, del repo `plantilla-accountability`. Capturan evidencia y ven su semáforo. No es MaKo.' },
];

export const URGENTE: Grupo[] = [
  {
    // ⚠️ El título es espejo de la PARTE de `bitacora.ts`: no se renombra sin tocar allá.
    // Hasta el 06/10 este grupo eran los pasos del programa borrado (Whop, el cuestionario,
    // la reescritura con IA): se mudaron a HISTORIA, al final del archivo.
    titulo: 'El bucle de entrega',
    pasos: [
      {
        titulo: 'El curso del servicio, adentro de MaKo', estado: 'hecha',
        que: 'La tab Curso: las clases cuelgan de las etapas de la entrega, con su video (link o subido), su tarea y su formulario.',
        yaEsta: [
          'mig 0202 (`curso_clases`, `curso_progreso`, `curso_accesos`, `curso_sesiones`) y las reglas puras de `lib/curso.ts`, con test (eba4f12f).',
          'El programa de Mauricio cargado en el ws1: 107 clases, 63 videos de su planilla del 02/10, 43 formularios y la logística. La semilla es `lib/curso-programa-nqe.ts`.',
          'La tab `/customer-success/curso` y la pestaña Curso de la ficha del cliente (`app/customer-success/FichaCurso.tsx`).',
        ],
        falta: [
          'Los videos: al cargarse el 06/10 no había ninguno grabado. Los graba y los sube Mauricio.',
          'Llevar #694 a la base del ws1 (la columna de la MCI en «El objetivo de cada área» y el puente a las palancas en «Elegir las palancas»): está en la semilla, no en `curso_clases`. Se corre `node --import tsx scripts/curso-aplicar-694.mjs` (seco) y después con `--commit`.',
        ],
        // ⚠️ Cuando `scripts/curso-aplicar-694.mjs --commit` corra contra el ws1, se saca la
        // segunda fila de `falta` y el «falta la base» del `ojo`. Hasta entonces, decir que #694
        // «se hizo» es afirmar algo que la base no tiene.
        ojo: 'La semilla NO es la fuente de verdad: lo cargado se edita en la tab, y volver a correr `scripts/curso-cargar-programa.ts` saltea lo que ya está y revive lo borrado. **Un cambio del temario son dos cosas: la semilla y la base** (#694 tiene la semilla; le falta la base, con `scripts/curso-aplicar-694.mjs`).',
      },
      {
        titulo: 'Que el cliente entre a su curso sin cuenta de MaKo', estado: 'hecha',
        que: 'Su link firmado, o `/mi-curso` con su propia cookie, y la invitación por mail desde la ficha.',
        yaEsta: [
          '`lib/curso-acceso.ts`: el link `c1.<ws>.<lead>.<version>.<hmac>`. Revocar es subir la versión.',
          '`lib/alumno-sesion.ts` + `lib/alumno-acceso.ts`: la cookie `mako_alumno`, que el proxy no toma por sesión (c0e2570b). La invitación, mig 0206.',
        ],
        falta: ['Invitar a los clientes: al 06/10 había 0 invitaciones.', 'Probarlo de punta a punta con un email real.'],
        ojo: '**Nunca `mako_session` ni una fila en `usuarios`**: con eso el alumno leía el CRM de Mauricio, porque un rol desconocido cae a admin.',
      },
      {
        titulo: 'Pasar de etapa al terminar sus tareas', estado: 'hecha',
        que: 'Al enviar la última obligatoria de su etapa, MaKo lo mueve a la siguiente y le avisa.',
        yaEsta: ['`etapaCompleta` (`lib/curso.ts`) + `lib/curso-avance-regla.ts` + `lib/curso-avance.ts`, que mueve por el choke point `moverClienteDeEtapa` (`lib/cs-mover-etapa.ts`).'],
        ojo: 'Cierra al ENVIAR, no al revisar: si cerrara al aprobar, el cliente quedaría esperando a que alguien lo mire. Y una etapa sin obligatorias no se completa sola, a propósito.',
      },
      {
        titulo: 'Avisarle antes y después de cada llamada', estado: 'sigue',
        que: 'El cron manda el previo y el posterior de cada llamada anotada, con lo que le falta de su etapa.',
        yaEsta: ['`app/api/cron/curso-sesiones/` (cada hora) + `lib/curso-mensajes.ts`.'],
        falta: ['Las llamadas se anotan a mano en la ficha: falta sincronizarlas con Calendly.', 'Lo que pidió Mauricio el 8/9: los compromisos de la junta, sacados del Fathom, en el aviso de después.'],
      },
      {
        titulo: 'Recordarle las clases que tiene que ver', estado: 'cola',
        plan: 'Recordatorio a los alumnos de Mauricio de las clases que tienen que ver (email o WhatsApp)',
        que: 'Un recordatorio de los videos de su etapa que todavía no vio, aparte de las llamadas.',
        yaEsta: ['El dato existe: `curso_progreso` guarda `pct` y `visto_at` por clase.', 'El cron de las llamadas corre cada hora: el recordatorio se puede colgar de ahí.'],
        falta: ['Canal, texto, cadencia y dedup.', 'Que tenga qué recordar: los videos subidos y los clientes invitados.'],
      },
      {
        titulo: 'El onboarding de la tab Curso', estado: 'cola',
        que: 'La regla de la casa: toda tab tiene onboarding, y su estado alimenta a MaKo.',
        falta: ['La entrada en `lib/tab-onboarding-catalogo.ts`, el recorrido y el gate en `app/customer-success/curso/page.tsx`.'],
      },
      {
        titulo: 'Que MaKo vea el avance del curso', estado: 'cola',
        que: 'Hoy MaKo no puede contestar por chat cómo va un cliente en su curso.',
        yaEsta: ['Los lectores existen en `lib/curso-datos.ts` y las reglas en `lib/curso.ts`.'],
        falta: ['Una operación de lectura en `lib/api-mako/areas/cs.def.ts` + `cs.run.ts`.'],
      },
      {
        titulo: 'Limpiar los videos huérfanos del bucket', estado: 'cola',
        que: 'Una subida abandonada (se cierra la pestaña a mitad) deja el archivo en `curso-videos` para siempre.',
        falta: ['Un barrido que borre los objetos que ninguna clase nombra.'],
      },
      {
        titulo: 'Dejar de descartar las reuniones de entrega', estado: 'hecha',
        que: 'El cron ya procesa las de entrega. Sus tareas van solas al proyecto de ese cliente.',
        yaEsta: [
          '`TIPOS_AL_PLAN = [equipo, entrega]` en `lib/reunion-auto.ts`. «ventas» y «otra» siguen afuera a propósito.',
          'El reparto quedó acotado a gente del workspace: en una junta de entrega «el otro» puede ser el CLIENTE, que no tiene cuenta acá.',
        ],
        ojo: '**El diagnóstico obvio era el equivocado, dos veces.** Yo escribí que el destino no existía: existe y estaba a 66 líneas del filtro que impedía llegar — `resolverClienteDeReunion` ya archiva todo en «Cliente: X». Y `lib/reunion-gate.ts` no tenía nada que ver: el cron ni lo importa.',
      },
      {
        titulo: 'Avisar cuando una junta no quedó grabada', estado: 'cola',
        que: 'Hoy no pasa nada, en silencio, y el bucle se corta entero.',
        yaEsta: ['`lib/crm-auto.ts:270` (`encuentroGrabable`) ya evita concluir de una grabación ausente: vale reusarlo.', '`lib/importar-en-segundo-plano.ts:74` es el camino manual para pegar las notas de una junta.'],
        falta: ['Lo inverso del cron: reuniones esperadas SIN grabación. Y el aviso, declarado y sin implementar (`lib/avisos-catalogo.ts:243-247`).'],
        ojo: 'Ya falló dos veces documentadas: el 16/7 Artemisa no entró a las juntas de todo un día, y el 31/7 «no jaló la IA, no hubo de Esquer».',
      },
    ],
  },
  {
    titulo: 'La cartera de Mauricio',
    pasos: [
      {
        titulo: 'Que nada entre al tablero sin que alguien lo apruebe', estado: 'hecha',
        que: 'Las tareas de una reunión quedan en un borrador con su link, y el link lo arma el código.',
        yaEsta: ['`lib/reunion-auto.ts:242` deja el borrador en `plan_propuestas`; no crea tareas.', '`:273` avisa por WhatsApp, y el link sale de `lib/link-borrador.ts`, no del modelo.'],
      },
      {
        titulo: 'Saber de qué cliente es cada reunión grabada', estado: 'hecha',
        que: 'Resuelve por tres caminos y devuelve `null` en vez de inventar cuando no está seguro.',
        yaEsta: ['`lib/reunion-cliente.ts:91-130`. Dos call-sites reales: `lib/reunion-auto.ts:205` (lo que elige el cliente PISA lo que dijo el modelo) y `app/api/plan-fathom/route.ts:63`.'],
      },
      {
        titulo: 'Avisar por WhatsApp cuando un compromiso vence', estado: 'cola',
        plan: 'Implementar notificaciones proactivas de MaKo por WhatsApp sobre tareas pendientes',
        que: 'Un barrido diario de vencidos, agrupado por cliente.',
        yaEsta: ['El campo existe hace rato (`lib/todo.ts:40`, `lib/plan-board.ts:51`).', 'El molde que ya recorre todos los workspaces: `app/api/cron/tareas-verificar/route.ts:45-73`.'],
        falta: ['El cron. Verificado: `grep "deadline"` sobre los 18 crons devuelve **cero**.'],
        tocar: ['`app/api/cron/compromisos-vencidos/route.ts` (nuevo)', '`lib/avisos-catalogo.ts`', '`vercel.json`'],
      },
      {
        titulo: 'Avisar cuando un cliente lleva días sin dar señales', estado: 'cola',
        que: 'Hoy un cliente ya ganado no dispara ninguna regla del motor.',
        yaEsta: ['El motor y sus reglas T1-T6 (`lib/crm-auto-plan.ts`), con umbral por workspace.'],
        falta: ['`lib/crm-auto-plan.ts:82` abre con `estado_lead === \'abierto\'` y T6 (`:126`) exige `no_responde` o `perdido`: **un cliente ganado queda fuera de todo**.', 'Definir qué cuenta como señal: última junta, último WhatsApp, avance en el curso (`curso_progreso`).'],
        tocar: ['`lib/crm-auto-plan.ts`'],
      },
      {
        // ⚠️ Decía «cola» con «`plan_proyectos` no tiene etapa ni hito» hasta el 06/10, con la
        // etapa existiendo desde la mig 0188 (05/10). El plan de la tarjeta (una tabla
        // ETAPAS_ENCARGO, una ruta /clientes/[id]/etapas) quedó obsoleto: no se construye.
        // `plan:` = el título de la tarjeta en el tablero según la auditoría del 06/10.
        titulo: 'Guardar en qué etapa del programa va cada cliente', estado: 'hecha',
        plan: 'Guardar la etapa del encargo y el próximo hito de cada cliente (el estado ya se guarda)',
        que: 'Un kanban por producto con las etapas de su entrega. El cliente se mueve arrastrando, desde su ficha, en lote o solo al terminar sus tareas.',
        yaEsta: [
          'mig 0188: `producto_entrega` (las etapas, por producto) y `cliente_entrega` (en cuál está cada cliente, con la CLAVE de la etapa, nunca el rótulo).',
          '`moverClienteDeEtapa` (`lib/cs-mover-etapa.ts`), el único que escribe: deja el historial y dispara las secuencias de entrega.',
          'El kanban, la tabla, la ficha y el lote en `app/customer-success/`. El paso por tareas, en `lib/curso-avance.ts`.',
        ],
        falta: [
          'La FECHA del próximo hito no existe en ningún lado: falta decidir si «Próxima llamada» (la pestaña Curso de la ficha) alcanza.',
          'Ubicar a los 14 clientes del ws1 en su etapa real: al 06/10, 13 caían en Bienvenida por derivación y una fila apuntaba a una etapa que ya no existe. Es trabajo en la pantalla, no código.',
        ],
        ojo: 'La etapa de entrega NO es otro embudo del CRM: es SIMULTÁNEA con la venta (el mismo cliente es «ganado» en ventas y está en «hito 2» en la entrega). Por eso vive en su propia tabla.',
      },
      {
        // ⚠️ Decía «cola» con «hoy la única ruta del área es `app/cs-analyst/page.tsx`»: la
        // pantalla existe desde el 11/08 y `lib/cs-cartera.ts` desde el 26/09. Lo que falta es
        // lo que la tarjeta pedía mostrar. `plan:` según la auditoría del 06/10.
        titulo: 'Ver todos los clientes y su estado en una pantalla', estado: 'sigue',
        plan: 'Arreglar la cartera: compromisos vencidos siempre en 0 y avance mal; la alerta va después',
        que: 'La pantalla existe (`/customer-success`: kanban y tabla por producto) y no muestra el último contacto ni qué compromiso está vencido.',
        yaEsta: [
          '`app/customer-success/` (kanban, tabla, ficha) y `lib/cs-cartera.ts` + `lib/cs-senal.ts`, que hoy lee MaKo por chat.',
          'Las tareas vencidas de cada cliente ya se calculan (`atrasadas`, `app/customer-success/trabajo.ts`).',
        ],
        falta: [
          'Dibujar el último contacto y los compromisos vencidos: los datos existen y ninguna pantalla los muestra desde la poda del 26/09.',
          '`conTrabajo` (`lib/cs-senal.ts`) sin call site: MaKo nunca ve las tareas vencidas de un cliente.',
          'La alerta de baja: sin umbral, sin cadencia, sin entrada en el catálogo de avisos y sin insumo (depende de analizar las llamadas de entrega).',
          '`/cs-analyst` sigue en ComingSoon: darla de alta o borrarla.',
          'El onboarding de la tab.',
        ],
      },
      {
        titulo: 'Que la tarea no pierda a su cliente al confirmarla', estado: 'cola',
        que: 'En el board del cliente, el proyecto resuelto se pierde al aplicar el borrador.',
        falta: ['`lib/todo-rutear.ts:84` decide contra un menú que **excluye** los proyectos de cliente.', 'Dos exports muertos: `proyectoDeCliente` (`lib/reunion-cliente.ts:168`) y `razonArchivado` (`:331`).'],
        tocar: ['`lib/todo-rutear.ts`', '`lib/plan-propuesta.ts`'],
      },
      {
        titulo: 'Que el aviso urgente no se pierda entre los demás', estado: 'cola',
        plan: 'Optimizar notificaciones de MaKo por WhatsApp para Mauricio',
        que: 'La prioridad está declarada en el catálogo y nadie la mira al despachar.',
        yaEsta: ['`lib/avisos-catalogo.ts:24` define `PrioridadAviso` y las ~48 filas la traen.'],
        falta: ['`emitirAviso` (`lib/avisos.ts:73-134`) no lee `prioridad` en ninguna línea.'],
        ojo: 'El feed in-app está muerto en tres capas y tiene ORDEN OBLIGATORIO (`docs/hallazgos-infra.md:872`): `notificaciones` se creó sin `workspace_id` y nunca se aplicó en prod. Aplicarla tal cual le mostraría los avisos de todos a cada cliente.',
      },
    ],
  },
  {
    titulo: 'Que armar el tablero de un cliente cueste menos',
    pasos: [
      {
        titulo: 'Proponerle la evidencia de cada palanca desde lo que ya funcionó', estado: 'cola',
        plan: 'El prompt maestro que arma el tablero de un cliente',
        que: 'MaKo lee las palancas de los seis clientes anteriores y propone cómo se prueba cada una.',
        yaEsta: ['El riel de prompts editables está entero: `lib/prompt-render.ts:44/49/64`, con historial y UI en `/contexto`.'],
        falta: ['El prompt y su alta en `lib/prompt-registry.ts` + `lib/prompt-defaults.ts`.'],
        ojo: '**Es el bloqueo número uno de todo su programa, dicho por él**: Baja Teriyaki estuvo tres semanas detenida en esa sola pregunta, y en TEXX el protocolo de servicio no se podía medir. Su frase: «el cliente sabe qué quiere que pase, no sabe cómo probar que pasó». Es lo único de esta lista que ninguna de sus dos skills puede hacer, porque ninguna ve el histórico de los otros clientes.',
      },
      {
        titulo: 'Proponerle los umbrales con lo que otros clientes ya lograron', estado: 'cola',
        que: 'Verde, amarillo y rojo sugeridos a partir de palancas parecidas que ya corrieron.',
        ojo: 'El segundo atoro. Su pregunta que sí funciona es «qué nivel ya lograste alguna vez» — MaKo puede contestarla con datos de los otros clientes, que es justo lo que el dueño no tiene.',
      },
      {
        titulo: 'Completar las seis columnas técnicas del Excel', estado: 'cola',
        que: 'Capa, alcance, modo de captura, criterio dato→color, quién llena y tipo de enlace.',
        yaEsta: ['La skill `dashboard-accountability` ya las define y las llena en chat (`references/protocolo_intake_excel.md`). El formato es un solo archivo, sin cuestionario aparte.'],
        falta: ['Que MaKo las pre-llene con el histórico antes de esa sesión, en vez de arrancar en blanco.'],
        ojo: '⚠️ **No inventar un cuestionario nuevo.** El protocolo dice UN SOLO ARCHIVO y cero duplicación de captura: lo que MaKo aporte tiene que entrar al mismo Excel.',
      },
      {
        titulo: 'Avisarle cuándo un cliente se está yendo del norte', estado: 'cola',
        que: 'Detectar en las sesiones cuando el dueño trae operación en vez de trabajar su MCI.',
        ojo: 'Es su atoro transversal, y le costó caro: un cliente consumió catorce sesiones en reclutamiento, SEO y arquitectura web sin cerrar su MCI económica. Todo legítimo, nada de eso es norte ni tablero.',
      },
    ],
  },
];

export const FUTURO: Grupo[] = [
  {
    titulo: 'El final del ciclo de un cliente',
    pasos: [
      { titulo: 'Analizar las llamadas de entrega en vez de descartarlas', estado: 'cola', plan: 'Analizar las llamadas de entrega en vez de tirarlas',
        que: 'Hoy se transcriben y se tiran sin que Claude las lea.',
        yaEsta: ['La detección está sólida y corre sola: `lib/closing.ts:154` por título y `:500` con Claude de árbitro.'],
        falta: ['`lib/closing.ts:478-486` escribe `summary: null` y `status: descartada`. Y hace falta un contrato propio: las 7 dimensiones SPIN no aplican a una sesión de entrega.'] },
      { titulo: 'Detectar a tiempo qué cliente está por irse', estado: 'bloqueada', plan: 'Termómetro de baja por cliente',
        que: 'Combina el ánimo de la última sesión, la cuota impaga y las señales del CRM.',
        yaEsta: ['Dos de los tres insumos ya están: `lib/pagos.ts:495` y la clasificación de la reunión como entrega.'],
        falta: ['El ánimo se tira hoy: depende del paso anterior.'] },
      { titulo: 'Poder marcar a un cliente como graduado o dado de baja', estado: 'sigue',
        que: 'El estado existe (activo, graduado, baja, pausado) y hoy sólo se marca pidiéndoselo a MaKo por chat.',
        yaEsta: ['`cs_clientes` (mig 0129) y la operación `marcar_estado_cliente_cs` (`lib/api-mako/areas/cs.def.ts`), con motivo obligatorio para una baja.'],
        falta: [
          'Que la pantalla de Clientes lo muestre y lo deje cambiar: el botón se fue el 26/09 y ningún archivo de `app/customer-success/` lee `cs_clientes`.',
          'El protocolo de graduación: borrador en `docs/protocolos/graduacion.md` (#667), esperando las respuestas de Mauricio.',
        ],
        ojo: 'Hoy la suscripción «activa» se deriva de fechas (`lib/queries.ts:765`): un cliente que se va antes de tiempo **sigue contando en el MRR** hasta que venza el plazo.' },
      { titulo: 'Que el embudo tenga una etapa después de la venta', estado: 'cola',
        que: 'El pipeline termina en la venta y no hay dónde vive un cliente en entrega.',
        ojo: '🔴 **Hoy corrompe datos**: mover una etapa después del cierre con el botón ▼ hace que `terminalEstadoFor` devuelva `abierto` y `app/crm/actions.ts:1771` ponga monto, fecha de cierre e inicio de servicio en `null`. Arreglar eso antes que la etapa.' },
      { titulo: 'Guardar los testimonios de los clientes', estado: 'cola',
        que: 'Con autor, grabación de origen, permiso de uso y estado de publicación.',
        ojo: 'Falso amigo caro: todo lo que matchea «testimonio» en el repo son vocabularios de clasificación de creativos.' },
      { titulo: 'Seguir un caso de éxito desde el resultado hasta publicarlo', estado: 'bloqueada', plan: 'Pipeline de casos de éxito: del resultado al testimonio publicado',
        que: 'Resultado → entrevista → editado → publicado.',
        ojo: 'Sin materia prima todavía: al 29/7 ningún cliente había llegado a la etapa que produce el caso.' },
      { titulo: 'Preguntarle al cliente qué tal estuvo, en cada instancia', estado: 'cola',
        que: 'Arranque, bloque, sesión y pago. Un termómetro, no una encuesta anual.',
        yaEsta: ['Los canales de envío ya existen: `lib/resend.ts` y `lib/evolution-envio.ts`.'],
        ojo: 'NPS quedó descartado con motivo: con ~7 clientes activos no significa nada.' },
    ],
  },
  {
    titulo: 'El arranque de un cliente nuevo',
    pasos: [
      { titulo: 'Traspasar solo del cierre a la entrega', estado: 'cola', que: 'Que al cerrar la venta se creen accesos, carpeta y bienvenida sin intervención.' },
      { titulo: 'Ver en qué paso del arranque está cada cliente nuevo', estado: 'cola', que: 'Para detectar al que se trabó antes de empezar.',
        yaEsta: ['`lib/onboarding-state.ts` ya modela «estado por pasos»: es el molde exacto.'] },
    ],
  },
  {
    titulo: 'La sesión de cada semana',
    pasos: [
      { titulo: 'Armarle el resumen del cliente antes de cada sesión', estado: 'cola', que: 'En qué quedaron, qué se comprometió y qué falta. Llega listo a la llamada.',
        yaEsta: ['El pipeline de reuniones ya guarda el historial por cliente: es una lectura, no un dato nuevo.'] },
      { titulo: 'Medir la promesa que se le hizo a cada cliente', estado: 'cola', que: 'De dónde salió, dónde está hoy y cuánto le falta.' },
      { titulo: 'Detectar solo cuándo un cliente cumplió su promesa', estado: 'cola', que: 'Y disparar lo que sigue: caso de éxito, referido o renovación.' },
    ],
  },
  {
    titulo: 'Que la entrega vuelva a vender',
    pasos: [
      { titulo: 'Guiar la entrevista de caso de éxito', estado: 'cola', que: 'Las preguntas listas y la grabación capturada sola.' },
      { titulo: 'Avisar cuándo pedirle un referido a un cliente', estado: 'cola', que: 'En el momento en que está contento, con el guión listo.' },
      { titulo: 'Saber quién trajo a quién', estado: 'cola', que: 'Un link propio por cliente para reconocer al que refiere.' },
    ],
  },
  {
    titulo: 'La entrega de a muchos',
    pasos: [
      { titulo: 'Agrupar a los clientes por camada', estado: 'cola', que: 'Ver avanzar a toda la tanda junta y no de a uno.' },
      { titulo: 'Manejar las sesiones grupales con sus preguntas', estado: 'cola', que: 'Formulario antes, hoja de Q&A después, registrada por cliente.',
        ojo: 'El grupal requiere sí o sí tener los cursos grabados antes.' },
      { titulo: 'Preguntarle a cada cliente cómo va, sin intervención', estado: 'cola', que: 'Un check-in que detecta al que se enfrió antes de que se vaya.' },
    ],
  },
  {
    titulo: 'Que el servicio no dependa de Mauricio',
    pasos: [
      { titulo: 'Documentar su forma de entregar, una sola vez', estado: 'cola', que: 'Es el entregable «servicio escrito» del sprint.' },
      { titulo: 'Rutear cada evento al que le toca', estado: 'cola', que: 'Consultor, CS o el dueño, con su tarea y su fecha.' },
      { titulo: 'Arreglar «Pregúntale a MaKo»', estado: 'cola', que: 'Preguntar por un cliente y que responda con su historial completo.',
        ojo: 'Mauricio lo reportó roto el 31/7. Es la puerta a todo lo de arriba.' },
    ],
  },
];

/**
 * Lo de agosto, que ya no existe. Se dibuja APARTE y SIN estado (`RoadmapCS.tsx`): un chip
 * «Hecha» o «Sigue» al lado de algo borrado se lee como trabajo vivo, que es exactamente lo
 * que este panel hizo del 26/09 al 06/10. El `estado` queda como registro de cómo estaba
 * cuando murió; el `que` dice qué pasó con cada cosa. Cómo se construyó está en git
 * (`07d07139` y el retiro de Whop en eba4f12f).
 *
 * Los `plan:` se quedan a propósito: si la tarjeta sigue abierta en el tablero (al 06/10, la
 * #659 y la #660), se ve ACÁ con su número y se cierra, en vez de caer en «Del plan, sin
 * lugar en el roadmap» como si fuera trabajo pendiente. Se cierran por propuesta, no desde acá.
 */
export const HISTORIA: Grupo[] = [
  {
    titulo: 'Agosto: Whop y el programa de 44 clases',
    pasos: [
      { titulo: 'Conectar Whop', estado: 'hecha', plan: 'Conectar Whop por API para la plataforma de contenido',
        que: 'Se conectó en agosto (webhook firmado, avance por clase). Salió del producto el 06/10: el curso vive en MaKo.' },
      { titulo: 'Cargar el programa de Mauricio en Whop, por bloques', estado: 'sigue', plan: 'Montar el programa de Mauricio en Whop, por bloques',
        que: 'Quedaron 12 módulos y 44 clases ocultas en su Whop. Sin objeto desde el 06/10: el programa está cargado en MaKo, 107 clases en 9 etapas.' },
      { titulo: 'Guardar lo que el cliente responde en cada bloque', estado: 'hecha',
        que: '`cs_respuestas` y `lib/cs-respuestas.ts` se borraron el 26/09. Hoy las respuestas van a `curso_progreso`.' },
      { titulo: 'Que el cliente entre por un link, sin crearse cuenta', estado: 'sigue',
        que: 'Era el link de un cuestionario (`shares.permiso`) y se borró el 26/09. Hoy es el link del curso.' },
      { titulo: 'Que la IA mejore esas respuestas con lo hablado en la junta', estado: 'hecha', plan: 'Configurar Fathom e IA para actualizar formularios post-reunión',
        que: '`lib/cs-reescritura.ts` se borró el 26/09. Hoy no hay reescritura: volverla a tener es parte de #665.' },
      { titulo: 'Que el cliente corrija y apruebe lo que escribió la IA', estado: 'hecha',
        que: 'Se borró el 26/09 con lo anterior. Hoy el equipo marca la tarea «Revisada».' },
    ],
  },
];

/** Los títulos del plan que reclama este panel, incluida la HISTORIA (ver arriba). */
export const TITULOS_EN_PLAN: string[] =
  [...URGENTE, ...FUTURO, ...HISTORIA].flatMap((g) => g.pasos.map((p) => p.plan).filter((t): t is string => !!t));

/**
 * La tarjeta de un paso de HISTORIA, sólo si sigue ABIERTA; si no, `undefined`.
 *
 * «Abierta» es `progress < 100`, el MISMO criterio que `tareasAbiertas`
 * (`app/admin/dev/roadmap.ts`, `.lt('progress', 100)`), que es lo que el resto del panel llama
 * abierta. Hace falta porque `RoadmapCS` busca la tarjeta en `board.tasks`, que sale de
 * `listPlanBoard()` (`lib/plan-board.ts`, `select('*')` sin filtro) y trae TAMBIÉN las
 * cerradas: sin esto, la fila de Historia decía «#N abierta» y se dejaba abrir sobre una
 * tarjeta ya cerrada (la #659 y la #660 cuando se cierren por propuesta), para siempre.
 */
export const tarjetaAbierta = <T extends { progress: number }>(t: T | undefined): T | undefined =>
  t && t.progress < 100 ? t : undefined;

export const cuantos = (gs: Grupo[]): number => gs.reduce((n, g) => n + g.pasos.length, 0);

export function conteo(gs: Grupo[]): Record<EstadoPaso, number> {
  const out: Record<EstadoPaso, number> = { hecha: 0, sigue: 0, bloqueada: 0, cola: 0 };
  for (const g of gs) for (const p of g.pasos) out[p.estado]++;
  return out;
}
