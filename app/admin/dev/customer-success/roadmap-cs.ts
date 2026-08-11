// =============================================================================
// Customer Success — el roadmap de implementación
// =============================================================================
// ⚠️ LEER ESTO ANTES DE AGREGAR UN PASO. Las dos skills que Mauricio ya ejecuta
// hoy (`mapa-ejecucion-4dx` y `dashboard-accountability`) dejaron claro que el
// tablero de sus clientes NO se construye adentro de MaKo, y una versión previa
// de este roadmap lo planteaba así — con `lib/tablero-matriz.ts`, migraciones y
// un validador de la matriz en MaKo. Todo eso estaba mal.
//
// LAS TRES PIEZAS, Y QUIÉN ENTRA A CADA UNA:
//   · MaKo             → lo usa MAURICIO. Su cartera, su seguimiento, sus juntas.
//   · El tablero       → una app PROPIA por cliente, duplicada del repo privado
//                        `plantilla-accountability` (Next + Supabase + Vercel, uno
//                        por cliente). Ahí entra el EQUIPO del cliente a capturar
//                        evidencia. No es MaKo y no va a serlo.
//   · Whop             → ahí el cliente ve los videos, y ahí están su acceso y
//                        su cobro. Pero la TAREA del bloque NO vive en Whop.
//
// POR QUÉ LA TAREA NO VIVE EN WHOP (verificado en su API, 2026-08-11). Su API
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
 *  la pregunta que la pantalla no contestaba: ¿el cliente entra a MaKo o a Whop? */
export const PIEZAS: { que: string; quien: string; detalle: string }[] = [
  { que: 'MaKo', quien: 'Mauricio', detalle: 'Su cartera de clientes, el seguimiento, las juntas y los compromisos.' },
  { que: 'Whop', quien: 'El cliente', detalle: 'Ve los videos del programa. Ahí están su acceso y su cobro. Su API avisa a MaKo qué clase completó.' },
  { que: 'La tarea del bloque', quien: 'El cliente, por link', detalle: 'La contesta antes de la junta, la IA la reescribe con lo que se habló y él la aprueba. Vive en MaKo: la API de Whop no deja leer respuestas.' },
  { que: 'El tablero', quien: 'El equipo del cliente', detalle: 'Una app propia por cliente, del repo `plantilla-accountability`. Capturan evidencia y ven su semáforo. No es MaKo.' },
];

export const URGENTE: Grupo[] = [
  {
    titulo: 'El bucle de entrega',
    pasos: [
      {
        titulo: 'Conectar Whop', estado: 'sigue', plan: 'Conectar Whop por API para la plataforma de contenido',
        que: 'Credencial por workspace y el webhook de Whop, para saber en MaKo qué clase completó cada cliente.',
        yaEsta: ['`lib/credenciales.ts` (`credWs`) ya resuelve credenciales por workspace para los 19 servicios del catálogo.', 'Verificado: no hay ningún servicio de plataforma de contenido en `lib/integraciones-catalogo.ts:21-61`.', 'Verificado en su API: `course_lesson_interaction.completed` + `List course students` dan el avance por alumno.'],
        falta: ['El cliente de la API, la ruta del webhook y el alta en los DOS catálogos.'],
        tocar: ['`lib/whop.ts` (nuevo)', '`app/api/webhooks/whop/route.ts` (nuevo)', '`lib/integraciones-catalogo.ts`', '`lib/metodo-catalogo.ts`'],
        ojo: 'De Whop se lee **el avance, nunca las respuestas**: su API no tiene endpoint para leerlas. El `env` del catálogo tiene que coincidir EXACTO con lo que lee la lib, o `credWs` devuelve `null` en silencio y la integración se ve conectada sin estarlo. Y `/api/webhooks` ya está en `lib/rutas-publicas.ts`.',
      },
      {
        titulo: 'Cargar el programa de Mauricio en Whop, por bloques', quien: 'Los dos', estado: 'bloqueada',
        que: 'Cada bloque con su video y su tarea, y los clientes activos dados de alta.',
        plan: 'Montar el programa de Mauricio en Whop, por bloques',
        falta: ['Los 5 entregables de Mauricio: timing por bloque, esfuerzo del cliente, llamadas por bloque, qué hace a mano y qué le cuesta entender. El quinto ES la lista de videos a grabar.'],
        ojo: 'Restricciones que puso él: nada de Notion, y «son empresarios que todos tienen TDAH… no creas que le sabe la computadora».',
      },
      {
        titulo: 'Guardar lo que el cliente responde en cada bloque', estado: 'cola',
        que: 'Una fila por bloque y por cliente: es el objeto sobre el que después escribe la IA.',
        falta: ['La tabla entera, con `workspace_id`, y su alta en `TENANT_TABLES` y `TABLAS_RESET`.'],
        tocar: ['`supabase/migrations/`', '`lib/workspace.ts:60`', '`lib/reset-workspace.ts:36`'],
        ojo: '**No como jsonb en `app_settings`**: es last-write-wins sin CAS y un formulario largo con guardado parcial se pisa solo.',
      },
      {
        titulo: 'Que el cliente entre por un link, sin crearse cuenta', estado: 'cola',
        que: 'Desde la clase en Whop, un botón lo lleva a su tarea. Sin login, sin contraseña.',
        yaEsta: ['`lib/shares.ts` ya es esto y nació genérico a propósito: token de 256 bits, del que se guarda solo el sha256, revocable de a uno y revalidado contra la fila viva en cada request. `/compartido/[token]` y `/api/compartido` ya están en `lib/rutas-publicas.ts`.'],
        falta: ['Hoy `puedeVer` solo autoriza LECTURA. Falta el permiso de escritura acotado a UN bloque de UN cliente.'],
        tocar: ['`lib/shares.ts`', '`app/compartido/[token]/`'],
        ojo: 'Es la condición para que esto funcione con «empresarios que todos tienen TDAH… no creas que le sabe la computadora». Un login más es un bloque que no se contesta. Y el permiso se escribe en POSITIVO —este share puede escribir ESTE bloque— nunca «cualquiera menos».',
      },
      {
        titulo: 'Que la IA mejore esas respuestas con lo hablado en la junta', estado: 'cola',
        plan: 'Configurar Fathom e IA para actualizar formularios post-reunión',
        que: 'Después de la sesión, las respuestas del bloque quedan ampliadas con lo que se discutió.',
        yaEsta: ['El molde de «ampliar sin pisar» ya existe y está probado: `lib/plan-propuesta.ts:803` y `lib/detalle-fusion.ts:24`.'],
        falta: ['El prompt de reescritura registrado, y el enganche después de `extraerTareasDeReunion`.'],
        tocar: ['`lib/prompt-registry.ts`', '`lib/reunion-auto.ts`'],
      },
      {
        titulo: 'Que el cliente corrija y apruebe lo que escribió la IA', estado: 'cola',
        que: 'Entra, lo pule y le da el ok. Ahí el bloque queda cerrado.',
        yaEsta: ['`app/plan/revisar/[id]/page.tsx` es el molde exacto, y su comentario dice textual que sirve al dueño **o al cliente**. Aprobar/descartar ya está en `RevisarPropuesta.tsx:251-275`.'],
        falta: ['Que el objeto aprobado sea el bloque, no una propuesta de tareas.'],
      },
      {
        titulo: 'Dejar de descartar las reuniones de entrega', estado: 'cola',
        que: 'Hoy el cron se queda solo con las de equipo y tira las de servicio.',
        yaEsta: ['El pipeline entero y vivo: `vercel.json:41` → `app/api/cron/fathom-plan/route.ts:33` → `lib/reunion-auto.ts:136` → `:242` deja BORRADOR (no crea tareas) → `:273` avisa por WhatsApp.'],
        falta: ['Sacar el filtro de `lib/reunion-auto.ts:139` y darle destino a la reunión de entrega.'],
        tocar: ['`lib/reunion-auto.ts:139`', '`lib/reunion-gate.ts:27-33`'],
        ojo: '**El producto se contradice a sí mismo.** `lib/reunion-gate.ts:27-33` las frena a propósito diciendo «de una llamada de entrega salen tareas para ESE cliente (customer success)» — la regla correcta está escrita y el destino al que apunta no existe. Corolario: cuanto mejor identificado está el cliente en el CRM, más seguro es que su llamada NO deje compromisos.',
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
        falta: ['`lib/crm-auto-plan.ts:82` abre con `estado_lead === \'abierto\'` y T6 (`:126`) exige `no_responde` o `perdido`: **un cliente ganado queda fuera de todo**.', 'Definir qué cuenta como señal: última junta, último WhatsApp, avance en Whop.'],
        tocar: ['`lib/crm-auto-plan.ts`'],
      },
      {
        titulo: 'Guardar en qué etapa del programa va cada cliente', estado: 'cola',
        plan: 'Etapa del encargo, próximo hito y estado por cliente',
        que: 'Venta, Norte, PAS, Palancas, Build. Más el próximo hito con fecha.',
        yaEsta: ['Sus clientes YA son proyectos de su board (`PREFIJO_CLIENTE`, `lib/todo-proyectos-catalogo.ts:36`): la tabla cuelga de ahí.'],
        falta: ['`plan_proyectos` (mig 0093) no tiene etapa ni hito.'],
        ojo: 'No llamarla `FASES`: ya hay tres constantes con ese nombre. Las cinco fases del encargo salen de su propio documento, no se inventan.',
      },
      {
        titulo: 'Ver todos los clientes y su estado en una pantalla', estado: 'cola',
        plan: 'Vista de cartera + alertas de baja al dueño',
        que: 'Una fila por cliente: etapa, último contacto, compromisos vencidos y próximo hito.',
        yaEsta: ['El molde de pantalla cross-cliente, ya auditado: `app/admin/agente/page.tsx:49-66`.'],
        falta: ['La vista. Hoy la única ruta del área es `app/cs-analyst/page.tsx`: 7 líneas que devuelven `<ComingSoon />`.'],
        tocar: ['`lib/cs-cartera.ts` (nuevo)', '`app/cs-analyst/page.tsx`', '`app/_components/nav.ts:182`'],
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
      { titulo: 'Poder marcar a un cliente como graduado o dado de baja', estado: 'cola',
        que: 'Los cuatro desenlaces de `EstadoLead` son todos previos a la venta.',
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

export const TITULOS_EN_PLAN: string[] =
  [...URGENTE, ...FUTURO].flatMap((g) => g.pasos.map((p) => p.plan).filter((t): t is string => !!t));

export const cuantos = (gs: Grupo[]): number => gs.reduce((n, g) => n + g.pasos.length, 0);

export function conteo(gs: Grupo[]): Record<EstadoPaso, number> {
  const out: Record<EstadoPaso, number> = { hecha: 0, sigue: 0, bloqueada: 0, cola: 0 };
  for (const g of gs) for (const p of g.pasos) out[p.estado]++;
  return out;
}
