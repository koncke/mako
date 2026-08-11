// =============================================================================
// Customer Success — el roadmap de implementación
// =============================================================================
// Es EL Roadmap del área: reemplaza al genérico (un área tiene UN roadmap).
//
// TRES REGLAS, y las tres salieron de un reclamo del dueño:
//
//  1. SOLO CUSTOMER SUCCESS. CS es lo que pasa DESPUÉS del pago: el bucle de
//     entrega, la plataforma del cliente, el seguimiento de la cartera, la
//     graduación y el generador de tableros. NO entra el costo de la IA de la
//     plataforma, ni la vista móvil, ni el CRM de ventas, ni los acuerdos
//     comerciales con Mauricio. Eso vive en el board /plan y en
//     docs/sprint-servicio-mauricio.md.
//
//  2. EL ESTADO ESTÁ VERIFICADO CONTRA EL CÓDIGO, no deducido. Cada paso trae
//     `yaEsta` con archivo:línea. Salió de una corrida de 8 agentes
//     (wf_f634446a-942, 11/08/2026) después de que este roadmap diera por
//     pendiente algo que estaba hecho. **Un roadmap que miente sobre el estado
//     es peor que no tener roadmap**: hace perder el tiempo dos veces, una
//     construyendo lo que ya existe y otra descubriéndolo.
//
//  3. LA FILA DICE UNA LÍNEA; EL DETALLE VA EN UN MODAL. Es el mismo renglón que
//     las otras siete áreas (`FilaRoadmap` en ../_registro/Registro.tsx) y el
//     detalle no se pierde: se abre. Sin abrir, la pantalla se barre entera.
//
// EL ORDEN ES POR DEPENDENCIA. `lib/tablero-matriz.ts` va primero porque es la
// piedra angular: bloquea el generador, el formulario, el seguimiento por
// palancas y el semáforo del área. Verificado: hoy no existe en disco.
// =============================================================================

/** Los tres primeros son los de la casa (`Parte`); `bloqueada` distingue «no
 *  arrancó» de «no PUEDE arrancar», que es lo único que cambia qué se hace hoy. */
export type EstadoPaso = 'hecha' | 'sigue' | 'bloqueada' | 'cola';

export type Paso = {
  titulo: string;
  /** UNA línea, la que se lee en la fila. Acepta `**negrita**` y `` `código` ``. */
  que: string;
  estado: EstadoPaso;
  /** Solo cuando NO lo hace Martín. */
  quien?: 'Mauricio' | 'Los dos';
  /** El título EXACTO de la tarea en /plan. Sin match, no se muestra número. */
  plan?: string;
  // ── El modal ──────────────────────────────────────────────────────────────
  /** Lo que YA existe y se reusa, con archivo:línea. Es lo que evita rehacerlo. */
  yaEsta?: string[];
  /** Qué falta exactamente. Si el paso está hecho, va vacío. */
  falta?: string[];
  /** Los archivos concretos a crear o editar. */
  tocar?: string[];
  /** La trampa. Solo donde cambia una decisión. */
  ojo?: string;
};

export type Grupo = {
  titulo: string;
  /** Qué queda desbloqueado. Una línea: es el porqué del orden. */
  desbloquea: string;
  pasos: Paso[];
};

export const OBJETIVO = 'Que el cliente haga el trabajo de la entrega y Mauricio solo ponga el criterio: ve el video del bloque, completa la tarea, la discuten en la llamada, la IA la reescribe con el Fathom y él la aprueba.';

export const URGENTE: Grupo[] = [
  // ───────────────────────────────────────────────────────────────────────────
  {
    titulo: 'El esquema del tablero',
    desbloquea: 'El generador, el formulario del cliente, el seguimiento por palancas y el semáforo del área. Es la piedra angular: hoy no existe en disco.',
    pasos: [
      {
        titulo: 'Preguntarle a Mauricio cuántos datos lleva cada palanca', quien: 'Los dos', estado: 'cola',
        que: 'El cuestionario dice nueve, su tabla lista diez y la que dictó en la reunión tiene siete.',
        falta: ['Una respuesta de Mauricio. Es una pregunta de cinco minutos.'],
        ojo: 'Modelar antes de cerrarlo es modelar una suposición, y después migrar una tabla con datos adentro.',
      },
      {
        titulo: 'Definir cómo se guarda el tablero de un cliente', estado: 'cola', plan: 'La matriz vinculada y su validador: el esquema del tablero de un cliente',
        que: 'El tipo de la matriz vinculada: MCI → objetivo LAG → área → palanca → ficha → umbrales → evidencia → corte.',
        yaEsta: [
          '`lib/landing-spec.ts:44` — el molde exacto: tipo puro, sin `server-only`, importado por el generador y por la UI.',
          'Nada más. Verificado: `MCI` y `validarMatriz` solo aparecen como strings de este mismo roadmap.',
        ],
        falta: ['El archivo entero. Es lo que bloquea cinco pasos a la vez.'],
        tocar: ['`lib/tablero-matriz.ts` (nuevo, **sin `server-only`** para que un test lo importe)'],
      },
      {
        titulo: 'Que el sistema rechace un tablero mal armado', estado: 'cola',
        que: 'Área sin objetivo · MCI sin área · objetivo con más de 3 palancas · palanca repetida · responsable sin autoridad · habilitadora sin objetivo. Más el traslape de umbrales.',
        yaEsta: ['El cuestionario de Mauricio ya trae las 6 auditorías escritas: no hay que inventarlas.'],
        falta: ['La función y su test. Las cinco primeras se escriben en código sin ambigüedad.'],
        tocar: ['`lib/tablero-matriz.ts`', '`tests/tablero-matriz.test.ts` (nuevo)'],
        ojo: 'Una regla que solo vive en la prosa de un prompt no es una regla: necesita el texto Y la validación determinista.',
      },
      {
        titulo: 'Crear las tablas donde vive el tablero de cada cliente', estado: 'cola',
        que: 'Tablas de MCI, objetivo por área y palanca, con `workspace_id` y RLS.',
        yaEsta: ['El molde de migración numerada y el checklist de alta están en la skill `author-numbered-migration`.'],
        falta: ['La migración, y el alta en los DOS registros que se separan solos.'],
        tocar: ['`supabase/migrations/0125_*.sql`', '`lib/workspace.ts:60` (`TENANT_TABLES`)', '`lib/reset-workspace.ts:36` (`TABLAS_RESET`)'],
        ojo: '`getTenantDb()` sobre una tabla que NO está en `TENANT_TABLES` no filtra nada y no avisa. Y no puede llamarse `FASES`: ya hay tres constantes con ese nombre que compilan sin conflicto.',
      },
    ],
  },
  // ───────────────────────────────────────────────────────────────────────────
  {
    titulo: 'El generador de tableros',
    desbloquea: 'Su mayor sangría de tiempo: seis tableros en cola, codeados de madrugada.',
    pasos: [
      {
        titulo: 'Escribir el prompt que arma el tablero, editable sin código', estado: 'cola', plan: 'El prompt maestro que arma el tablero de un cliente',
        que: 'Que **llene** y después emita: proponga evidencia y umbrales desde los otros clientes, y devuelva la tabla de huecos con responsable y fecha.',
        yaEsta: [
          '`lib/prompt-render.ts:44` (`getPromptText` = override ?? default), `:49` (`renderPrompt` interpola `{{slot}}`), `:64` (`savePromptOverride`, con 30 versiones de historial). El riel está entero.',
          'La UI para editarlo ya existe en `/contexto`.',
        ],
        falta: ['El prompt y su alta en `lib/prompt-registry.ts` + `lib/prompt-defaults.ts`.'],
        tocar: ['`lib/prompt-registry.ts`', '`lib/prompt-defaults.ts`'],
        ojo: '⚠️ Hay **27 keys usadas en runtime que NO están en el registry**: se resuelven con su default y son invisibles desde la UI, y nada en el compilador ni en el pre-push lo detecta. No sumar la 28.',
      },
      {
        titulo: 'Que Claude Code genere el tablero desde el cuestionario', estado: 'cola', plan: 'La skill de Claude Code que emite el tablero del cliente',
        que: 'Toma la matriz validada y escribe el código del tablero.',
        yaEsta: [
          '`lib/agente-skill.ts:56` — fuente única con dos salidas (descarga con token y marketplace público).',
          '`scripts/generar-plugin.mjs:33-35` escribe los 4 archivos de `plugin/`, y el **pre-push falla** si quedaron viejos.',
          '`scripts/generar-plugin.mjs:37-51` ya tiene la guarda que impide filtrar credenciales al repo público.',
        ],
        falta: ['La skill nueva colgada de ese mismo riel.'],
        tocar: ['`lib/agente-skill.ts`', '`scripts/generar-plugin.mjs`'],
        ojo: 'MaKo no emite código en runtime en ningún lado: lo único que genera son specs JSON coercionados a un tipo. El generador va afuera, como skill.',
      },
      {
        titulo: 'Probarlo contra un tablero que Mauricio ya armó a mano', quien: 'Los dos', estado: 'cola',
        que: 'Esquer o Baja Teriyaki. Si no reproduce lo que construyó a mano, no sirve.',
        falta: ['La corrida y el ajuste del prompt con el resultado.'],
      },
    ],
  },
  // ───────────────────────────────────────────────────────────────────────────
  {
    titulo: 'La plataforma del cliente',
    desbloquea: 'Que el cliente vea el video del bloque antes de la reunión, sin que viva en WhatsApp ni en Drive.',
    pasos: [
      {
        titulo: 'Conectar Whop, la plataforma donde el cliente ve los videos', estado: 'sigue', plan: 'Conectar Whop por API para la plataforma de contenido',
        que: 'Cliente de la API con credencial por workspace. No se desarrolla la plataforma: se conecta.',
        yaEsta: [
          '`lib/credenciales.ts` → `credWs` ya resuelve credenciales por workspace para los 19 servicios del catálogo.',
          'Verificado: **no hay ningún servicio de plataforma de contenido** en `lib/integraciones-catalogo.ts:21-61` ni en `lib/metodo-catalogo.ts`. Las 24 menciones de «Whop» en el repo son prosa.',
        ],
        falta: ['El cliente de la API y el alta en los DOS catálogos.'],
        tocar: ['`lib/whop.ts` (nuevo)', '`lib/integraciones-catalogo.ts`', '`lib/metodo-catalogo.ts`', '`lib/capas.ts` (si la categoría tiene que verla el cliente)'],
        ojo: '⚠️ El `env` del catálogo tiene que coincidir EXACTO con lo que lee la lib: si no, `credWs` devuelve `null` en silencio (`lib/integraciones.ts:122`) y la integración se ve conectada sin estarlo.',
      },
      {
        titulo: 'Que cada cliente comparta SU material, no el del workspace 1', estado: 'cola', plan: 'Sacar el `const WS = 1` de la ruta que comparte material',
        que: 'Hoy **todo share que existe nace con `workspace_id = 1`**.',
        yaEsta: [
          'Lo de abajo ya está listo: la columna existe (`0098_branding_shares.sql`) y las funciones ya reciben `ws` (`lib/shares.ts:137,144,152,237,253`).',
          'El consumo público ya lee el ws del share: `app/compartido/[token]/page.tsx:52`.',
          'El mecanismo entero está vivo y es fail-closed: `lib/shares.ts:69` (`resolverToken` revalida contra la fila viva), `:105` (`puedeVer`, único punto de autorización).',
        ],
        falta: ['Solo el emisor: `app/api/compartir/route.ts:25` tiene `const WS = 1` usado en los SEIS caminos (`:45, :70, :144, :170, :189, :193`).'],
        tocar: ['`app/api/compartir/route.ts`'],
      },
      {
        titulo: 'Arreglar el link de curso compartido que da error 404', estado: 'cola',
        que: 'El share se crea, el mail sale, y el invitado ve un 404. Son dos listas de cursos que tienen que coincidir y nada las ata.',
        yaEsta: ['El bug está localizado: `app/conocimientos/Conocimientos.tsx:30` arma `TODOS`, y `app/compartido/[token]/page.tsx:46` resuelve contra `[...CURSOS, CURSO_VSL]` — `CURSO_PRODUCTO_APP` está en la primera y no en la segunda.'],
        falta: ['Unificar el catálogo en un módulo que consuman los dos lados.'],
        tocar: ['`app/conocimientos/cursos.ts` (nuevo)', '`app/conocimientos/Conocimientos.tsx`', '`app/compartido/[token]/page.tsx`'],
        ojo: 'Cada curso nuevo que se sume hereda el bug. Es el patrón «una cosa, un lugar» sin aplicar.',
      },
      {
        titulo: 'Poder subir una clase sin hacer un deploy', estado: 'cola',
        que: 'Hoy sumar una clase exige un deploy: los cursos son archivos `.ts` de la agencia.',
        yaEsta: [
          '`app/conocimientos/CursoPortal.tsx:202-203` ya reproduce video, recursos y transcripción lazy — y ya lo consume alguien **sin login** desde `app/compartido/[token]/CursoCompartido.tsx:41`.',
          '`mako_knowledge` (migraciones 0033/0049) ya es tenant-scoped y tiene `curso` y `area`.',
        ],
        falta: [
          'Tabla de programa → bloques → clases por workspace.',
          'Que `/conocimientos` deje de ser super-admin (`app/conocimientos/page.tsx:23-24` hace `getSesionAdmin()` → `redirect`).',
        ],
        tocar: ['`supabase/migrations/`', '`app/conocimientos/page.tsx`', '`app/_components/nav.ts:321` (hoy la entrada vive en la familia Admin)'],
        ojo: 'Con Whop encima, este paso puede no hacer falta: son dos diseños distintos y hay que elegir uno. Decidirlo ANTES de escribir la tabla.',
      },
      {
        titulo: 'Saber qué bloque del programa completó cada cliente', estado: 'bloqueada',
        que: 'Qué bloque completó cada uno. Es el insumo del seguimiento y del bucle.',
        falta: ['Todo. Cero resultados de `curso_progreso|progreso_curso|leccion_completada` en migraciones, `lib/` y `app/api/`.'],
        ojo: '`registrarVisita()` (`lib/shares.ts:159`) NO sirve: responde «¿abrió el link?», no «¿qué bloque completó?» — y su propio comentario avisa que puede perder visitas. Depende de la decisión Whop vs portal propio.',
      },
      {
        titulo: 'Cargar el programa de Mauricio y sus clientes en la plataforma', quien: 'Los dos', estado: 'bloqueada',
        que: 'La estructura del programa con el video de cada bloque, y los clientes activos adentro.',
        plan: 'Montar el programa de Mauricio en Whop, por bloques',
        falta: ['Los 5 entregables de Mauricio: timing, esfuerzo, llamadas por bloque, qué hace a mano y qué le cuesta entender. El quinto ES la lista de videos a grabar.'],
        ojo: 'Restricciones que puso él: nada de Notion, y «son empresarios que todos tienen TDAH… no creas que le sabe la computadora».',
      },
    ],
  },
  // ───────────────────────────────────────────────────────────────────────────
  {
    titulo: 'El bucle de entrega',
    desbloquea: 'Que el trabajo pase de la cancha de Mauricio a la del cliente. Es el corazón del encargo.',
    pasos: [
      {
        titulo: 'Distinguir una llamada de venta de una de entrega', estado: 'hecha',
        que: 'Ya funciona, y sin gastar IA cuando el título alcanza.',
        yaEsta: [
          '`lib/closing.ts:154` — heurística por título (`RE_SERVICIO_EXPLICITO`, `:129`) devuelve `entrega_servicio` sin llamar a Claude.',
          '`lib/closing.ts:500-501` — Claude como árbitro final cuando el título no alcanza.',
          'Corre solo: `vercel.json:37` → `app/api/cron/closing-sync/route.ts`, 1 fila por grabación en `closing_analyses`.',
        ],
      },
      {
        titulo: 'Saber de qué cliente es cada reunión grabada', estado: 'hecha',
        que: 'Ya funciona por tres caminos, y **devuelve `null` en vez de inventar** cuando no está seguro.',
        yaEsta: [
          '`lib/reunion-cliente.ts:91-130` (`resolverClienteDeReunion`): email del invitado contra `leads`, y el título como segunda vía.',
          'Dos call-sites reales: `lib/reunion-auto.ts:205-222` (lo que elige el cliente PISA lo que dijo el modelo) y `app/api/plan-fathom/route.ts:63-64`.',
        ],
      },
      {
        titulo: 'Dejar de descartar las reuniones de entrega', estado: 'cola',
        que: 'Hoy el cron las **descarta**: se queda solo con `tipo === \'equipo\'`.',
        yaEsta: [
          'El pipeline entero y vivo: `vercel.json:41` → `app/api/cron/fathom-plan/route.ts:33-34` → `lib/reunion-auto.ts:136` → `:170` extraer → `:242` dejar BORRADOR (no crea tareas) → `:273` aviso por WhatsApp.',
        ],
        falta: ['Sacar el filtro de `lib/reunion-auto.ts:139` y darle destino a la reunión de entrega.'],
        tocar: ['`lib/reunion-auto.ts:139`', '`lib/reunion-gate.ts:27-33`'],
        ojo: '⚠️ **Es la falla más grave del área, y el producto se contradice a sí mismo.** `lib/reunion-gate.ts:27-33` frena esas reuniones a propósito diciendo «de una llamada de entrega salen tareas para ESE cliente (customer success), no para tu plan» — o sea: la regla correcta está escrita y **el destino al que apunta no existe**. Corolario perverso: cuanto mejor identificado está el cliente en el CRM, más seguro es que su llamada NO deje compromisos.',
      },
      {
        titulo: 'Guardar lo que cada cliente responde en cada bloque', estado: 'cola',
        que: 'El objeto sobre el que el cliente escribe y la IA reescribe. No existe ninguno.',
        falta: ['La tabla entera, con `workspace_id`, y su alta en `TENANT_TABLES` y `TABLAS_RESET`.'],
        tocar: ['`supabase/migrations/`', '`lib/workspace.ts:60`', '`lib/reset-workspace.ts:36`'],
        ojo: '**No como jsonb en `app_settings`**: es last-write-wins sin CAS, y un formulario largo con guardado parcial se pisa solo. La fase del negocio ya pagó ese costo: al vivir como JSON, «cumplí el hito» no tiene dónde guardarse.',
      },
      {
        titulo: 'Que la IA mejore las respuestas con lo hablado en la junta', estado: 'cola', plan: 'Configurar Fathom e IA para actualizar formularios post-reunión',
        que: 'Después de la junta, las respuestas del bloque quedan ampliadas con lo que se habló.',
        yaEsta: [
          'El molde de «ampliar sin pisar» ya existe y está probado: `lib/plan-propuesta.ts:803` y `lib/detalle-fusion.ts:24` funden dos textos sin destruir el original.',
        ],
        falta: ['El prompt de reescritura registrado, y el enganche en el pipeline después de `extraerTareasDeReunion`.'],
        tocar: ['`lib/prompt-registry.ts`', '`lib/reunion-auto.ts`', '`lib/cs-bucle.ts` (nuevo)'],
      },
      {
        titulo: 'Que el cliente corrija y apruebe lo que escribió la IA', estado: 'cola',
        que: 'Ve lo que reescribió la IA, lo corrige y le da el ok. Es el cierre del bucle.',
        yaEsta: [
          '`app/plan/revisar/[id]/page.tsx:1-28` — el molde exacto, y su comentario de cabecera dice textual que sirve al dueño **o al cliente**. Scopea al ws del que mira (`:27`).',
          'Aprobar/descartar ya implementado en `RevisarPropuesta.tsx:251-275`.',
        ],
        falta: ['Que el objeto aprobado sea el formulario del bloque, no una propuesta de tareas.'],
        ojo: 'Hoy el contenido de negocio que escribe la IA **no tiene aprobación, solo corrección**: el brief se autoguarda `onBlur` y los avatares son solo lectura. No hay ningún registro de que el cliente lo haya leído.',
      },
      {
        titulo: 'Avisar cuando una junta no quedó grabada', estado: 'cola',
        que: 'Detectar la ausencia, avisar y ofrecer completar a mano. Hoy no pasa nada, en silencio.',
        yaEsta: [
          '`lib/crm-auto.ts:270-289` (`encuentroGrabable`) — el gate que ya evita concluir de una grabación ausente. Vale reusarlo.',
          '`lib/importar-en-segundo-plano.ts:74` — el camino manual genérico para pegar notas de una junta.',
        ],
        falta: ['Lo inverso del cron: reuniones esperadas SIN grabación. Y el aviso, que está declarado y sin implementar (`lib/avisos-catalogo.ts:243-247`, `yaImplementado: \'no\'`).'],
        ojo: 'Sin esto el bucle se corta entero cada vez que falla la grabación, y ya falló dos veces documentadas.',
      },
    ],
  },
  // ───────────────────────────────────────────────────────────────────────────
  {
    titulo: 'El seguimiento de la cartera',
    desbloquea: 'Que Mauricio deje de sostener el estado de 7 clientes en la cabeza y en un Excel. No espera al bucle.',
    pasos: [
      {
        titulo: 'Que nada entre al tablero sin que alguien lo apruebe', estado: 'hecha',
        que: 'Nada entra al tablero sin que alguien lo confirme.',
        yaEsta: [
          '`lib/reunion-auto.ts:242` deja un BORRADOR en `plan_propuestas`; no crea tareas.',
          '`:273` avisa por WhatsApp con el link, y el link lo arma el CÓDIGO (`lib/link-borrador.ts`), no el modelo.',
        ],
      },
      {
        titulo: 'Avisar por WhatsApp cuando un compromiso vence', estado: 'cola', plan: 'Implementar notificaciones proactivas de MaKo por WhatsApp sobre tareas pendientes',
        que: 'Barre `deadline` vencido agrupado por cliente y avisa una vez por día.',
        yaEsta: [
          'El campo existe hace rato: `lib/todo.ts:40`, `lib/plan-board.ts:51,244`.',
          'El molde que ya recorre todos los workspaces sin filtrar por integración: `app/api/cron/tareas-verificar/route.ts:45-73`.',
        ],
        falta: ['El cron. Verificado: `grep "deadline"` sobre los 18 crons devuelve **cero**.'],
        tocar: ['`app/api/cron/compromisos-vencidos/route.ts` (nuevo)', '`lib/avisos-catalogo.ts`', '`lib/notif-catalogo.ts:159` (`AVISOS_WA_EN_VIVO`)', '`vercel.json`'],
      },
      {
        titulo: 'Avisar cuando un cliente lleva días sin dar señales', estado: 'cola',
        que: 'Hoy un cliente ganado no dispara ninguna acción del motor.',
        yaEsta: ['El motor y sus reglas T1-T6: `lib/crm-auto-plan.ts`, con umbral por workspace.'],
        falta: [
          '`lib/crm-auto-plan.ts:82` abre con `if (l.estado_lead === \'abierto\')` y la única regla de afuera (T6, `:126`) exige `no_responde` o `perdido`. **Un lead `ganado` queda fuera de todo.**',
          'Definir qué cuenta como señal: última reunión, último WhatsApp, último cambio en su proyecto, avance en la plataforma.',
        ],
        tocar: ['`lib/crm-auto-plan.ts`'],
      },
      {
        titulo: 'Guardar en qué etapa va cada cliente y su próximo hito', estado: 'cola', plan: 'Etapa del encargo, próximo hito y estado por cliente',
        que: 'Etapa del encargo, próximo hito con fecha y estado manual. Es lo único que no se deriva de nada.',
        yaEsta: ['Sus clientes YA son proyectos de su board (`PREFIJO_CLIENTE`, `lib/todo-proyectos-catalogo.ts:36`): la tabla cuelga de ahí, no es una entidad nueva.'],
        falta: ['`plan_proyectos` (mig 0093) no tiene etapa ni hito.'],
        tocar: ['`supabase/migrations/`', '`lib/workspace.ts:60`', '`lib/reset-workspace.ts:36`'],
        ojo: 'No llamarla `FASES`: ya hay tres constantes con ese nombre. Y `FaseDef.hito` es un falso amigo — es constante de la fase, igual para todos los clientes.',
      },
      {
        titulo: 'Ver todos los clientes y su estado en una pantalla', estado: 'cola', plan: 'Vista de cartera + alertas de baja al dueño',
        que: 'Una fila por cliente: último contacto, compromisos abiertos, vencidos y próximo hito.',
        yaEsta: ['El molde de pantalla cross-cliente, ya auditado: `app/admin/agente/page.tsx:49-66`.'],
        falta: ['La vista. Hoy la única ruta del área es `app/cs-analyst/page.tsx`: **7 líneas** que devuelven `<ComingSoon />`.'],
        tocar: ['`lib/cs-cartera.ts` (nuevo)', '`app/cs-analyst/page.tsx`', '`app/_components/nav.ts:182` (sacar `comingSoon`)'],
        ojo: 'La tab «Clientes» de `/admin` es un falso amigo: lista **workspaces** (los clientes de MaKo), no los clientes de Mauricio.',
      },
      {
        titulo: 'Que la tarea no pierda a su cliente al confirmarla', estado: 'cola',
        que: 'En el board del cliente, el proyecto resuelto se pierde al aplicar el borrador.',
        falta: [
          '`lib/plan-propuesta.ts:827` re-rutea todo, y `lib/todo-rutear.ts:84` decide contra un menú que **excluye explícitamente los proyectos de cliente**.',
          'Dos exports muertos: `proyectoDeCliente` (`lib/reunion-cliente.ts:168-188`, la única función que CREA la categoría) y `razonArchivado` (`:331`). Cero call-sites.',
        ],
        tocar: ['`lib/todo-rutear.ts`', '`lib/plan-propuesta.ts`', '`lib/reunion-cliente.ts`'],
      },
      {
        titulo: 'Que el aviso urgente no se pierda entre los demás', estado: 'cola', plan: 'Optimizar notificaciones de MaKo por WhatsApp para Mauricio',
        que: 'Los metadatos existen y nadie los usa al despachar.',
        yaEsta: ['`lib/avisos-catalogo.ts:24` define `PrioridadAviso` y las ~48 filas la traen.'],
        falta: ['`emitirAviso` (`lib/avisos.ts:73-134`) **no lee `prioridad` en ninguna línea**: un `alta` y un `baja` salen por el mismo canal con el mismo formato.'],
        tocar: ['`lib/avisos.ts`'],
        ojo: '⚠️ El feed in-app está muerto en tres capas y tiene ORDEN OBLIGATORIO (`docs/hallazgos-infra.md:872-876`): la tabla `notificaciones` se creó **sin `workspace_id`** y nunca se aplicó en prod; `lib/notificaciones.ts:76-101` traga el error con un `catch` mudo. Aplicarla tal cual le mostraría los avisos de todos a cada cliente.',
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// A FUTURO — lo que estaba en la propuesta original (/vsl/mako-cs)
// ─────────────────────────────────────────────────────────────────────────────
// Rechazada el 8/7 por timing, no por precio. Está acá como TRABAJO, no como
// documento de venta: los mismos pasos, el mismo formato. Lo que ya se descartó
// con motivo (NPS, CES, churn rate, gamificación, momentos wow, escudo de
// disputas, blindaje legal, firma de contrato, asignación de consultor) NO está:
// un roadmap con pasos que nadie va a hacer no es un roadmap.

export const FUTURO: Grupo[] = [
  // ───────────────────────────────────────────────────────────────────────────
  {
    titulo: 'El final del ciclo',
    desbloquea: 'Anticipar una baja, cerrar bien y que el cliente feliz vuelva a vender. Es lo que le sirve para los contratos que vencen en octubre.',
    pasos: [
      {
        titulo: 'Analizar las llamadas de entrega en vez de descartarlas', estado: 'cola', plan: 'Analizar las llamadas de entrega en vez de tirarlas',
        que: 'Hoy se transcriben y se descartan sin que Claude las lea.',
        yaEsta: ['La detección está sólida y corre sola (ver el primer paso del bucle). Los datos ya existen.'],
        falta: [
          '`lib/closing.ts:478-486` escribe `summary: null`, `status: \'descartada\'` y todo el bloque `NULL_V2`. Por el otro camino, `:533-545` deja `score`, `dims`, `moments` y `recs` en null porque `ventaOk` es false.',
          'Un contrato de salida propio: las 7 dimensiones SPIN no aplican a una sesión de entrega. Hacen falta otras: ánimo, compromisos asumidos, fricción, señal de riesgo.',
          'Una pantalla que las muestre: `entrega_servicio` **solo aparece en `lib/closing.ts`** en todo el repo.',
        ],
        tocar: ['`lib/closing.ts` (`descartadaRow`, `analyzedRow`, `getClosingViewData`)', '`lib/prompt-registry.ts`', '`supabase/migrations/`', '`app/cs-analyst/`'],
      },
      {
        titulo: 'Detectar a tiempo qué cliente está por irse', estado: 'bloqueada', plan: 'Termómetro de baja por cliente',
        que: 'Combina el ánimo de la última llamada, la cuota impaga y las señales del CRM.',
        yaEsta: ['Dos de los tres insumos ya están: `lib/pagos.ts:495` (`getCuotasPendientes`) y la clasificación de la reunión como entrega.'],
        falta: ['El tercer insumo —el ánimo— hoy se tira: depende del paso anterior.'],
      },
      {
        titulo: 'Poder marcar a un cliente como graduado o dado de baja', estado: 'cola',
        que: 'Los cuatro desenlaces de `EstadoLead` son todos PRE-venta.',
        falta: ['`lib/leads.ts:38` no tiene ningún estado posterior a `ganado`.'],
        tocar: ['`supabase/migrations/`', '`lib/leads.ts`', '`lib/queries.ts` (`_getMrrActivo`)'],
        ojo: '⚠️ Hoy la suscripción «activa» se **deriva de fechas** (`lib/queries.ts:765-766`): un cliente que se va antes de tiempo **sigue contando en el MRR** hasta que venza el plazo.',
      },
      {
        titulo: 'Que el embudo tenga una etapa después de la venta', estado: 'cola',
        que: 'El pipeline termina en `ganado` y no hay dónde vive un cliente en entrega.',
        falta: ['`lib/pipeline.ts:316` le da `kind: \'cierre\'` y el `switch` de `generateFunnel` (`:399-441`) no tiene case para eso. La UI además inserta toda etapa nueva ANTES del cierre (`FunnelEditor.tsx:187`).'],
        tocar: ['`lib/pipeline.ts`', '`lib/leads.ts`', '`app/crm/actions.ts`', '`app/funnel/FunnelEditor.tsx`', '`lib/stage-requirements.ts:146`'],
        ojo: '🔴 **Esto HOY corrompe datos.** Un usuario puede mover una etapa custom después de `ganado` con el botón ▼ (`FunnelEditor.tsx:345`), y `terminalEstadoFor` (`lib/pipeline.ts:953-961`) devuelve `abierto` para cualquier key no canónica → `app/crm/actions.ts:1771-1773` pone `monto_cierre_usd`, `fecha_cierre` y `fecha_inicio_servicio` en `null`. **Destruye el Revenue y el CAPI del lead.** Arreglar eso antes que la etapa.',
      },
      {
        titulo: 'Guardar los testimonios de los clientes', estado: 'cola',
        que: 'Con texto, autor, `lead_id`, grabación de origen, **permiso de uso** y estado de publicación.',
        falta: ['No hay tabla ni tipo. Alta manual primero; la extracción automática desde los transcripts, después.'],
        tocar: ['`supabase/migrations/`', '`lib/` (módulo nuevo)'],
        ojo: 'Falso amigo caro: todo lo que matchea «testimonio» en el repo son vocabularios de clasificación de CREATIVOS (`lib/ads-analyst.ts:43,46,54`, `lib/script-angles.ts:19`) o tipos de bloque de landing. Quien busque `caso-exito` lo encuentra primero y se equivoca de área.',
      },
      {
        titulo: 'Seguir un caso de éxito desde el resultado hasta publicarlo', estado: 'bloqueada', plan: 'Pipeline de casos de éxito: del resultado al testimonio publicado',
        que: 'Resultado → entrevista → editado → publicado, por estados.',
        falta: ['La tabla y la vista. Y la señal que lo dispara: hoy no hay «promesa cumplida» en ningún lado.'],
        ojo: 'Sin materia prima todavía: al 29/7 ningún cliente de Mauricio había llegado a la etapa que produce el caso.',
      },
      {
        titulo: 'Preguntarle al cliente qué tal estuvo, en cada instancia', estado: 'cola',
        que: 'Arranque, módulo, 1:1, grupal y pago. Un termómetro, no una encuesta anual.',
        yaEsta: ['Los canales de envío ya existen: `lib/resend.ts` y `lib/evolution-envio.ts`.'],
        falta: ['Todo lo demás. Verificado: `grep -rni "encuesta|nps|satisfacc"` sobre `lib/` y `app/` devuelve **cero código**.'],
        ojo: 'NPS quedó descartado con motivo: con ~7 clientes activos no significa nada. Lo que se mide es la instancia, no el año.',
      },
    ],
  },
  // ───────────────────────────────────────────────────────────────────────────
  {
    titulo: 'El arranque de un cliente nuevo',
    desbloquea: 'Que el pago se vuelva cliente listo sin que Mauricio mueva un dedo.',
    pasos: [
      { titulo: 'Traspasar solo del cierre a la entrega', estado: 'cola',
        que: 'Que al marcar el cierre se creen los accesos, la carpeta y la bienvenida sin intervención.',
        falta: ['Depende de que exista la etapa posterior a la venta.'] },
      { titulo: 'Ver en qué paso del arranque está cada cliente nuevo', estado: 'cola',
        que: 'Para detectar al que se trabó antes de empezar, que es donde más se cae la gente.',
        yaEsta: ['`lib/onboarding-state.ts` ya modela «estado por pasos»: es el molde exacto.'] },
    ],
  },
  // ───────────────────────────────────────────────────────────────────────────
  {
    titulo: 'La sesión de cada semana',
    desbloquea: 'Que el trabajo recurrente no dependa de la memoria de Mauricio.',
    pasos: [
      { titulo: 'Armarle el resumen del cliente antes de cada sesión', estado: 'cola',
        que: 'Quién es, en qué quedaron, qué se comprometió y qué falta. Llega listo a la llamada.',
        yaEsta: ['El pipeline de reuniones ya guarda el historial por cliente: es una lectura, no un dato nuevo.'] },
      { titulo: 'Que cada consultor defina sus propias fases del programa', estado: 'cola',
        que: 'Hoy las fases son constantes de código, iguales para todos los negocios.',
        tocar: ['`lib/fase-diagnostico.ts`', '`supabase/migrations/`'] },
    ],
  },
  // ───────────────────────────────────────────────────────────────────────────
  {
    titulo: 'Medir el resultado del cliente',
    desbloquea: 'La señal de «promesa cumplida», que es lo que enciende los casos de éxito y la renovación.',
    pasos: [
      { titulo: 'Medir la promesa que se le hizo a cada cliente', estado: 'cola',
        que: 'De dónde salió, dónde está hoy y cuánto le falta. Se apoya en la matriz del tablero.' },
      { titulo: 'Mostrar los números del cliente: tareas, sesiones y cuellos', estado: 'cola',
        que: 'Tareas asignadas y cumplidas, sesiones entregadas y dónde se traba. El progreso real, no la sensación.' },
      { titulo: 'Marcar las primeras victorias de cada cliente', estado: 'cola',
        que: 'Para usarlas temprano, cuando todavía sirven para sostener el compromiso.' },
      { titulo: 'Detectar solo cuándo un cliente cumplió su promesa', estado: 'cola',
        que: 'Y disparar lo que sigue: caso de éxito, pedido de referido o ascenso de plan.',
        falta: ['Depende de que la promesa esté medida (paso anterior).'] },
    ],
  },
  // ───────────────────────────────────────────────────────────────────────────
  {
    titulo: 'Que la entrega vuelva a vender',
    desbloquea: 'Que cada cliente feliz alimente el funnel en vez de terminar en nada.',
    pasos: [
      { titulo: 'Guiar la entrevista de caso de éxito', estado: 'cola',
        que: 'Las preguntas listas y la grabación capturada sola, para no improvisar cada vez.' },
      { titulo: 'Avisar cuándo pedirle un referido a un cliente', estado: 'cola',
        que: 'En el momento en que está contento, con el guión listo.' },
      { titulo: 'Saber quién trajo a quién', estado: 'cola',
        que: 'Un link propio por cliente, para poder reconocer al que refiere.' },
    ],
  },
  // ───────────────────────────────────────────────────────────────────────────
  {
    titulo: 'La entrega de a muchos',
    desbloquea: 'El modelo grupal, que es el camino declarado de Mauricio a los US$50K/mes.',
    pasos: [
      { titulo: 'Agrupar a los clientes por camada', estado: 'cola',
        que: 'Ver avanzar a toda la tanda junta y no de a uno.' },
      { titulo: 'Manejar las sesiones grupales con sus preguntas', estado: 'cola',
        que: 'Formulario antes, hoja de Q&A después, y cada pregunta registrada por cliente.',
        ojo: 'El grupal requiere sí o sí tener los cursos grabados antes: depende de la plataforma.' },
      { titulo: 'Subir la grabación con cada pregunta marcada en su minuto', estado: 'cola',
        que: 'Para que el que faltó vaya directo a lo suyo.' },
      { titulo: 'Preguntarle a cada cliente cómo va, sin intervención', estado: 'cola',
        que: 'Un check-in periódico que detecta al que se enfrió antes de que se vaya.' },
    ],
  },
  // ───────────────────────────────────────────────────────────────────────────
  {
    titulo: 'Que el servicio no dependa de Mauricio',
    desbloquea: 'Que pueda delegar la entrega sin que baje la calidad. Es el norte del encargo.',
    pasos: [
      { titulo: 'Documentar su forma de entregar, una sola vez', estado: 'cola',
        que: 'Los procesos vivos adentro de MaKo. Es el entregable «servicio escrito» del sprint.' },
      { titulo: 'Rutear cada evento al que le toca', estado: 'cola',
        que: 'Consultor, CS o el dueño, con su tarea y su fecha. Sin esto, delegar es reenviar mensajes.' },
      { titulo: 'Arreglar «Pregúntale a MaKo»', estado: 'cola',
        que: 'Preguntar por un cliente y que responda con su historial completo.',
        ojo: 'Mauricio lo reportó roto el 31/7. Es la puerta a todo lo de arriba.' },
    ],
  },
];

/** Los títulos que este roadmap reclama del tablero. Derivado de los dos bloques. */
export const TITULOS_EN_PLAN: string[] =
  [...URGENTE, ...FUTURO].flatMap((g) => g.pasos.map((p) => p.plan).filter((t): t is string => !!t));

export const cuantos = (gs: Grupo[]): number => gs.reduce((n, g) => n + g.pasos.length, 0);

export function conteo(gs: Grupo[]): Record<EstadoPaso, number> {
  const out: Record<EstadoPaso, number> = { hecha: 0, sigue: 0, bloqueada: 0, cola: 0 };
  for (const g of gs) for (const p of g.pasos) out[p.estado]++;
  return out;
}
