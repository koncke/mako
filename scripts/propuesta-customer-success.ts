// =============================================================================
// propuesta-customer-success — el trabajo de Customer Success al board /plan
// =============================================================================
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/propuesta-customer-success.ts
//
// NO inserta en plan_tareas: crea UNA propuesta y devuelve el link /plan/revisar/<id>.
// El Perro puntúa, pone deadline, rutea y arma la checklist al aplicar — por eso acá
// no va ni `prioridad` ni `deadline`.
//
// El material sale de docs/sprint-servicio-mauricio.md (las 7 reuniones del 4/7 al 6/8)
// y de app/admin/dev/customer-success/roadmap-cs.ts.
//
// ⚠️ El barrido anti-duplicados ya se hizo a mano contra las 461 abiertas y encontró
// SEIS que ya existían. Van como `enriquece`, no como tareas nuevas: #109 (vista de
// cartera), #287 (avisos de Mauricio), #327 (notificaciones proactivas), #521 (bases
// mobile), #29 (semáforo que razona) y #332 (Fathom actualiza formularios). Crear su
// gemela habría sido el error que el catálogo de proyectos vino a cerrar.
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { getSupabaseServer } from '../lib/supabase';
import { runWithWorkspace, getTenantDb } from '../lib/workspace';
import { crearPropuesta, type PropuestaTarea, type PropuestaPregunta } from '../lib/plan-propuesta';
import { APP_BASE_URL } from '../lib/app-url';

const d = (que: string, porque: string, detalles: string[], listo: string) =>
  `**Qué hay que hacer**\n${que}\n\n**Por qué**\n${porque}\n\n**Detalles concretos**\n${detalles.map((x) => `- ${x}`).join('\n')}\n\n**Listo cuando**\n${listo}`;

// ── Las que YA existen: se amplían, no se duplican ───────────────────────────
const AMPLIAR: { num: number; titulo: string; razon: string; detalle: string }[] = [
  {
    num: 109,
    titulo: 'Vista de cartera + alertas de baja al dueño',
    razon: 'Es la misma vista que pide el frente 03 del sprint de Mauricio. Lo nuevo es que NO puede seguir dependiendo de 107 y 108: el sprint la necesita sin puntaje de riesgo.',
    detalle: d(
      'Que la cartera se pueda entregar SIN el termómetro de baja: una fila por cliente con último contacto, compromisos abiertos, vencidos y próximo hito. El semáforo de riesgo (que sí depende de 107/108) se suma después.',
      'Es el frente 03 del Sprint de Servicio, y hoy la tarea está bloqueada detrás de dos dependencias que no van a estar en las 4 semanas que quedan. Mauricio la pidió tres veces desde el 16/7, cada vez dentro de MaKo — aunque el documento del sprint dijera «un tablero simple, no MaKo». Gana lo posterior.',
      [
        'Está MÁS cerca de lo que parece: sus seis clientes YA son proyectos de su tablero con el prefijo canónico (lib/todo-proyectos-catalogo.ts → PREFIJO_CLIENTE, renombrados en scripts/reordenar-boards-clientes.ts:52-59), y sus reuniones YA caen en el cliente correcto (lib/reunion-cliente.ts:88-115).',
        'El molde de la pantalla cross-workspace ya existe y ya fue auditado: app/admin/agente/page.tsx:49-66 (service-role sin scope a propósito, gateado con getSesionAdmin()).',
        'NO son 15 clientes: al 29/7 el recuento nominal de Mauricio da ~7 activos. Dimensionarla para 15 la sobredimensiona 2×.',
        'Los datos que NO se derivan de nada y necesitan tabla: etapa del encargo (0-4), próximo hito con su fecha, y el estado que el consultor fija a mano.',
      ],
      'Mauricio abre una pantalla y ve sus ~7 clientes con su último contacto y qué compromiso está vencido, sin que exista todavía ningún puntaje de riesgo.',
    ),
  },
  {
    num: 287,
    titulo: 'Optimizar notificaciones de MaKo por WhatsApp para Mauricio',
    razon: 'Hay evidencia nueva y medida del 6/8: el aviso correcto SÍ salió, se perdió entre el ruido, y le costó media reunión.',
    detalle: d(
      'Sumar la evidencia del 6/8 al diagnóstico: el problema no es que falten avisos, es que el que importa no se distingue.',
      'Confirma la tarea con un costo concreto en vez de una hipótesis, y explica por qué apagar avisos uno por uno no alcanza.',
      [
        'El 6/8 [00:54:30] MaKo SÍ le avisó de la reunión con Alan Garza y el mensaje quedó sepultado. Martín: «ahí lo vi que te avisó, pero estaba muy escondido entre los otros mensajes». Mauricio: «Ah, es que me llegan un chorro. Ya, ya desactivé los otros».',
        'El costo real fue medible: [00:53:30] «El problema es que es ahorita en 20 minutos… ya no tengo el tiempo contigo que tenía porque no la había visualizado». La reunión se cortó a la mitad.',
        '⚠️ Ojo con la salida fácil: él ya apagó avisos por su cuenta. Silenciar más lo deja sin los que sí sirven — el problema es de JERARQUÍA, no de volumen.',
      ],
      'Mauricio puede distinguir de un vistazo el aviso accionable del informativo, sin haber apagado nada más.',
    ),
  },
  {
    num: 327,
    titulo: 'Implementar notificaciones proactivas de MaKo por WhatsApp sobre tareas pendientes',
    razon: 'Le falta la mitad más barata y más visible: el barrido de VENCIDOS. Hoy la tarea habla de pendientes del día; lo que el sprint necesita es «este compromiso venció».',
    detalle: d(
      'Sumar al alcance el barrido de `deadline < hoy`, agrupado por cliente. No es una sección más del reporte diario: es una consulta que hoy no existe en ningún cron.',
      'Es lo único del frente 03 del Sprint con CERO líneas escritas, y a la vez lo más barato de todo el encargo. Mauricio lo ve al día siguiente, y es la primera cosa doer que va a recibir por WhatsApp.',
      [
        'Verificado: `grep -rn "deadline" app/api/cron/` → cero resultados. La materia prima está entera (experimento_tareas.deadline, progreso, historial); el barrido no está escrito.',
        'El molde es la misma consulta al revés: app/api/cron/tareas-verificar/route.ts:48-73 ya recorre los workspaces y ya emite un aviso agrupado por día (`tareas-autocompletadas`, lib/todo-seeds.ts:147).',
        'El otro molde, para «hace N días que no llega nada»: app/api/cron/tracking-vigilante/route.ts:82 — nació de 18 días muertos sin que nadie lo notara.',
        '⚠️ El dedup de avisos es por TIPO, no por entidad (lib/avisos.ts): un TTL sobre un evento discreto se traga el segundo cliente. Con 7 clientes eso significa perder 6 avisos.',
      ],
      'Un compromiso vencido de un cliente de Mauricio le llega por WhatsApp al día siguiente, agrupado, y no se traga a los otros seis.',
    ),
  },
  {
    num: 521,
    titulo: 'Bases mobile dentro del sistema global',
    razon: 'Hay evidencia de uso real que la sube de hipótesis a bloqueante: el 6/8 Mauricio intentó usar MaKo desde el teléfono, en vivo, y no pudo.',
    detalle: d(
      'Sumar la evidencia del 6/8 y el caso de uso que la vuelve bloqueante: agendar durante una llamada, desde el celular.',
      'Deja de ser «que se vea bien» y pasa a ser «hoy no se puede usar cuando más se necesita».',
      [
        'El 6/8 [00:52:01], intentándolo en vivo: «No, no, aquí en el teléfono me tendría que tener en la computadora».',
        '[00:51:17] «Súper, porque muchos, la mayoría andamos en el tema del celular o la tablet».',
        'Martín reconoció el estado en la misma llamada [00:51:05]: «estoy haciendo de que se vea bien en celular, porque hoy se ve medio todo un poco desordenado».',
        'Y venía con lentitud: [00:51:30] «ya entré a Maco, aunque se está tardando poquito» · [00:51:47] «aquí ya me tardé mucho».',
      ],
      'Mauricio puede abrir MaKo desde el celular en medio de una llamada y hacer lo que necesita sin pasar a la computadora.',
    ),
  },
  {
    num: 29,
    titulo: 'Semáforo que razona alertas, no que solo linkea',
    razon: 'Es exactamente el reclamo textual de Mauricio, y el documento que se le presentó ya lo vendía como HECHO. Eso cambia la prioridad y le da el nombre que él usa.',
    detalle: d(
      'Que cada alerta del semáforo traiga el guión de qué hacer según el motivo, en vez de un link a la pantalla donde el problema se ve.',
      'Es la bajada concreta del «doer, no thinker», y sirve a TODOS los workspaces — no es trabajo a medida para Mauricio.',
      [
        '⚠️ La ironía que hay que tener presente: la propuesta /vsl/mako-cs marca «Semáforo del negocio» con el tag `listo` y su copy dice literalmente «no te muestra el problema, te dice cuál atacar primero». Se vendió como hecho el comportamiento que después se reclamó como faltante.',
        'Hoy son reglas hardcodeadas inline en app/general/page.tsx:107-195 y cada alerta termina en un `<Link href>` o en un modal.',
        'El puente ya existe y no hay que inventarlo: lib/mako-capacidades.ts, 17 capacidades con `ruta` + `como[]` imperativo, lista cerrada a propósito.',
        'El nombre que usa la propuesta es «Guiones de recuperación»: cuando un cliente se pone en rojo, MaKo da el guión correcto según el motivo. Aplica idéntico al lead en rojo de cualquier workspace.',
      ],
      'Una alerta roja del semáforo ofrece la acción, no el link — y la acción se puede ejecutar desde ahí.',
    ),
  },
  {
    num: 332,
    titulo: 'Configurar Fathom e IA para actualizar formularios post-reunión',
    razon: 'Es literalmente el PASO 4 del bucle de 5 pasos que se definió con Mauricio el 31/7. Y le falta lo que decide si funciona: qué pasa cuando Fathom no grabó.',
    detalle: d(
      'Encuadrarla como el paso 4 del bucle de entrega, y resolver el camino cuando la grabación no está.',
      'El bucle de 5 pasos es el único activo metodológico que salió de las 8 semanas del sprint, y esta tarea es su cuarto paso. Sin el camino alternativo, el bucle se corta entero cada vez que falla la grabación.',
      [
        'El paso 4, textual (31/7 [03:48:00]): «con la transcripción de la reunión de Fathom, la IA va a modificar las respuestas de la tarea que completó tu cliente para perfeccionarlo, para ampliarlo con toda la información que tuvo de las llamadas».',
        'Mata el trabajo manual que hoy hace Mauricio: 16/7 [01:16:15] «Siempre lo redacto yo como una hipótesis y luego en la junta lo vamos peinando».',
        '⚠️ Dependencia dura, y ya falló DOS veces documentadas: 16/7 [00:01:15] Artemisa no entró a las juntas de todo un día; 31/7 [03:50:09] «no jaló la IA, no hubo de Esquer».',
        'El paso 5 depende de este: el cliente entra a la plataforma, revisa lo que hizo la IA, lo pule y aprueba.',
      ],
      'Después de una junta, las respuestas del cliente quedan reescritas solas — y cuando no hay grabación, el sistema lo dice y ofrece el camino manual en vez de quedarse callado.',
    ),
  },
];

// ── Las nuevas ───────────────────────────────────────────────────────────────
const NUEVAS: PropuestaTarea[] = [
  {
    titulo: 'Conectar Whop por API para la plataforma de contenido',
    proyecto: 'Feature: Integraciones',
    detalle: d(
      'Dar de alta Whop como integración y conectarlo por API, para que el avance del cliente en el programa se vea desde MaKo. No se desarrolla la plataforma: se conecta.',
      'Cierra el compromiso más viejo del Sprint de Servicio: la comparativa de plataformas se prometió el 8/7 y lleva cinco semanas sin entregarse. Whop se eligió por ser la alternativa gratuita con API.',
      [
        'Alcance acotado por el propio Martín el 6/8 [01:11:00]: «no vamos a desarrollarlo dentro de Maco… lo que sí voy a hacer es la conexión de API. No es que voy a desarrollar un software, sino de que lo voy a conectar nada más a Maco para que lo puedas ver también desde ahí».',
        'La regla la RE-IMPUSO Mauricio ese día [01:10:44]: «estamos claros que no queremos desarrollar… queremos pagar un service, un software as a service que ya está ahí, que se adecúa más o menos». Ese «más o menos» es la licencia para no optimizar.',
        'Circle y Thinkific solo se nombraron el 4/7 y el 8/7, y del lado de Martín. Del 16/7 en adelante no vuelven a aparecer.',
        'Va por el camino normal de una integración nueva: lib/<provider>.ts con credenciales por-workspace y registrado en los DOS catálogos (ver la skill add-provider-integration). El error clásico es que el `env` del catálogo no coincida con lo que lee la lib: credWs devuelve null en silencio.',
      ],
      'Desde /integraciones se conecta Whop con la credencial del workspace, y MaKo lee el avance de al menos un cliente real.',
    ),
  },
  {
    titulo: 'Montar el programa de Mauricio en Whop, por bloques',
    proyecto: 'Feature: Conocimientos',
    detalle: d(
      'Armar la estructura del programa por bloques dentro de Whop, con el video de cada bloque, y dar de alta a los clientes actuales.',
      'Es el paso 1 del bucle de 5 pasos: que el cliente vea el video del bloque ANTES de la reunión. Sin eso, Mauricio sigue explicando la metodología en vivo, cliente por cliente, cada vez.',
      [
        'El diagnóstico es del 16/7 [01:28:04]: «lo que te está haciendo falta son los tutoriales. Eso es lo principal… tú le intentas enviar lo que sea a un cliente y el cliente te dice "no lo entiendo". Entonces, al final, por eso es que decides terminar haciéndolo tú».',
        '⚠️ BLOQUEADO por Mauricio: espera sus 5 entregables (timing por bloque · esfuerzo del cliente · cuántas llamadas por bloque · qué hace él a mano hoy · qué le cuesta más entender al cliente). Prometidos el 6/8 [01:09:37] «Ya los tengo, ya te lo envío hoy mismo», sin confirmación de recepción.',
        'El quinto entregable ES la lista de videos a grabar: los puntos que más le cuestan entender al cliente (31/7 [03:27:30]).',
        'Restricciones dichas por él: nada de Notion (16/7 [01:42:12] «ellos no lo van a hacer ahí jamás») y 31/7 [03:05:26] «son empresarios que todos tienen TDAH… la mayoría no creas que le sabe la computadora».',
      ],
      'Los clientes activos de Mauricio están dados de alta en Whop y pueden ver el video del bloque que les toca.',
    ),
  },
  {
    titulo: 'Sacar el `const WS = 1` de la ruta que comparte material',
    proyecto: 'Feature: Conocimientos',
    detalle: d(
      'Que compartir un curso deje de estar clavado al workspace 1, y que `curso` sea un recurso por workspace apoyado en `mako_knowledge`.',
      'Hoy la plomería para compartir material existe y es buena, pero solo sirve para el workspace del dueño: cualquier otro cliente que quiera compartir su propio material no puede.',
      [
        'app/api/compartir/route.ts:25 tiene `const WS = 1;` y `RECURSOS = [\'curso\', \'branding\']`.',
        'Lo que ya está y no hay que rehacer: lib/shares.ts + app/compartido/[token]/ (link público con invitados, revocación y rotación de token, migraciones 0098/0099/0102).',
        '`mako_knowledge` ya es tenant-scoped y ya tiene `curso` y `area` (migración 0049): la base para un portal por workspace está puesta.',
        'El portal /conocimientos hoy es getSesionAdmin()-only y su contenido es un .ts de 8.335 líneas hardcodeado: eso es aparte, y no bloquea esta tarea.',
      ],
      'Un workspace que no es el 1 comparte su propio material por link y el invitado lo abre.',
    ),
  },
  {
    titulo: 'La matriz vinculada y su validador: el esquema del tablero de un cliente',
    proyecto: 'Feature: Customer Success',
    detalle: d(
      'Escribir `lib/tablero-matriz.ts`: el tipo de la matriz vinculada de 14 columnas y el validador determinista de las 6 auditorías de vinculación.',
      'Es el contrato de datos del frente 01, y Mauricio ya lo entregó escrito: su Cuestionario Maestro de Objetivos, Palancas y Umbrales termina exactamente en esa tabla, con su propia capa de verificación.',
      [
        'Las 14 columnas: MCI · Objetivo LAG · Área · Responsable · Base · Meta · Frecuencia · Palanca · Cómo se mide · Verde · Amarillo · Rojo · Evidencia · Corte.',
        'Las 6 auditorías, que son el saneo: área sin objetivo vinculado a una MCI · MCI sin área que la sirva · objetivo con más de tres palancas · palanca repetida en dos áreas con otro nombre · responsable sin autoridad · área habilitadora crítica sin objetivo propio. Las cinco primeras se escriben en código sin ambigüedad.',
        'Va SIN `server-only` para que un test lo importe, molde lib/landing-spec.ts. Es la regla de AGENTS.md: una regla que solo vive en la prosa de un prompt no es una regla.',
        'Su principio de diseño, dicho el 31/7 [03:38:14]: «La inteligencia artificial no funciona por procesos, funciona por estándares».',
        '⚠️ La ficha de palanca tiene 9 campos según el texto del cuestionario, 10 en la tabla del Bloque 4, y 7 en la que él dictó en la reunión. Hay que cerrarlo con él antes de modelar.',
      ],
      'Una matriz mal armada falla en un test con el nombre de la auditoría que la rechazó, sin que intervenga ningún modelo.',
    ),
  },
  {
    titulo: 'El prompt maestro que arma el tablero de un cliente',
    proyecto: 'Feature: Contexto de MaKo',
    detalle: d(
      'Escribir el prompt maestro del frente 01 en el registro de prompts, para que se edite desde /contexto sin push y con historial.',
      'Es la mayor sangría de tiempo de Mauricio: codea a mano el tablero de cada cliente, de madrugada, y tiene seis en cola. Acordado el 8/7 [01:18:59]: «el tener un prompt maestro que sea mucho más robusto… y que sea un skill».',
      [
        '⚠️ EL REENCUADRE, y es lo que decide si sirve: su cuello NO es codear. Sus propios documentos dicen que el bloqueo #1 de todo el programa es DEFINIR LA EVIDENCIA (tres semanas paradas con Patricia en una sola pregunta: cómo se prueba que se hizo) y el #2 es poner el umbral. Un prompt que toma un cuestionario ya lleno resuelve el ÚLTIMO tramo. Tiene que LLENAR primero: proponer evidencia y umbrales a partir de lo que ya funcionó en sus otros clientes, y devolver la tabla de huecos con responsable y fecha.',
        'Va a lib/prompt-registry.ts y queda editable en /contexto (ver la skill add-editable-prompt). Cada push cuesta ~US$0,09: un prompt hardcodeado se paga en cada ajuste.',
        '⚠️ El prompt que se lee NO es el que recibe el modelo: brandSystem() antepone MAKO_NUCLEO. Y editar el template no cambia nada si hay override en app_settings[\'mako.prompt-overrides\'].',
        'Él ya viene trabajando solo en esto: 31/7 [00:15:01] «instalé Visual Studio… he estado trabajando con skills y con formatos y cada vez es menos tiempo… estoy empezando a aprender a trabajar por loops».',
      ],
      'El prompt genera la matriz de un cliente nuevo con los huecos marcados, y se puede editar desde /contexto sin tocar el repo.',
    ),
  },
  {
    titulo: 'La skill de Claude Code que emite el tablero del cliente',
    proyecto: 'Feature: Customer Success',
    detalle: d(
      'Publicar una skill de Claude Code que tome la matriz validada y escriba el código del tablero, generada DESDE el código y con `--check` en el pre-push.',
      'MaKo no emite código en runtime en ningún lado (verificado por grep: lo único que genera son specs JSON coercionados a un tipo). Meter un generador de código adentro sería construir un producto nuevo —sandbox, build, preview— para un sprint de dos meses.',
      [
        'El riel ya existe y tiene guardas: lib/agente-skill.ts:56 es una sola fuente con dos salidas (personal con token vía app/api/agente/skill/route.ts, y la genérica al repo público vía scripts/generar-plugin.mjs --check).',
        '⚠️ Una skill .md no puede importar nada, así que la copia se sincroniza con un script y el pre-push falla si quedó vieja. Sin eso, es exactamente la cicatriz del contrato del `detalle`: se actualizó de un lado, nadie tocó el otro, y siguió saliendo mal durante días.',
        '⚠️ Si el tablero necesita ids, rutas o umbrales exactos, NO los transporta el modelo: los pone el código. Un dato exacto que pasa por un LLM deja de ser exacto.',
        'Validación barata: probarlo contra un tablero que Mauricio YA hizo a mano (Esquer o Baja Teriyaki). Si no lo reproduce, no sirve.',
      ],
      'Mauricio corre la skill sobre un cuestionario lleno y obtiene el tablero, sin escribir el planteo desde cero.',
    ),
  },
  {
    titulo: 'El formulario del bucle: que el cliente haga la tarea antes de la llamada',
    proyecto: 'Feature: Customer Success',
    detalle: d(
      'Los pasos 2 y 5 del bucle: el cliente completa la tarea del bloque antes de la reunión, y después vuelve a aprobar lo que la IA reescribió.',
      'Es el paso que mueve el trabajo de la cancha de Mauricio a la del cliente, y el que él mismo nombró como su cuello de botella.',
      [
        'Paso 2, textual (31/7 [03:47:12]): «tu cliente hace la tarea previo a la llamada… tal vez la llamada es on demand y se agenda a través de Calendly una vez que se termine la tarea, o sea, obligatorio que tu cliente se termine la tarea para avanzar en el proceso, si no se terminó la tarea está en su cancha el problema».',
        'Paso 5 [03:48:15]: «tu cliente tiene que entrar a la plataforma, ver lo que hizo la IA según la reunión que tuvieron y terminar de pulirlo… dar su ok, dar su aprobación». Mauricio completa: «o corregir algo que vea que no se entendió».',
        'El cuello que ataca, en sus palabras (29/7 [01:55:37]): «Gran parte de mi cuello botella es invertirle mucho tiempo en estar con los clientes para que ellos me den y yo llenar el formato de Excel».',
        'La forma la propuso él mismo (31/7 [03:21:12]): «haciendo un formulario mediante inteligencia artificial, que la IA razone qué pregunta personalizada le tiene que hacer».',
        '⚠️ Restricción suya: «no quisiera automatizarlo al cien por ciento… no quiero automatizar algo que todavía no está estandarizado» [03:21:28].',
      ],
      'Un cliente de Mauricio completa la tarea de un bloque por su cuenta y la llamada se agenda recién cuando la terminó.',
    ),
  },
  {
    titulo: 'Etapa del encargo, próximo hito y estado por cliente',
    proyecto: 'Feature: Customer Success',
    detalle: d(
      'La tabla chica que guarda lo que no se deriva de nada: en qué etapa del programa está cada cliente, cuál es su próximo hito con fecha, y el estado que el consultor fija a mano.',
      'Es lo único del frente 03 que necesita almacenamiento nuevo. Todo lo demás (compromisos, reuniones, tareas por cliente) ya se deriva de lo que existe.',
      [
        '⚠️ NO puede llamarse `FASES`: el repo ya tiene TRES constantes con ese nombre que compilan sin conflicto — lib/fase-diagnostico.ts:80 (fases 1-5 del negocio), lib/mako-fases.ts:12 (pestañas de MaKo) y app/admin/dev/pricing/modelo.ts (FASES_TIEMPO). La metodología de Mauricio trae fases 0-4 del ENCARGO, que es un cuarto eje. Sugerido: `ETAPAS_ENCARGO`.',
        'Van tablas y no un jsonb en app_settings: app_settings es last-write-wins sin CAS y un formulario largo con guardado parcial se pisa solo. La fase del negocio ya pagó ese costo — al vivir como JSON, «cumplí el hito» no tiene dónde guardarse.',
        'Cuelga del proyecto que ya existe (`Cliente: NOMBRE` en su board), no es una entidad nueva.',
        '⚠️ Toda tabla nueva entra a TENANT_TABLES (lib/workspace.ts:60-79) Y a TABLAS_RESET (lib/reset-workspace.ts:29-60). Se separan solas y nada avisa: getTenantDb() sobre una tabla que no está en TENANT_TABLES no filtra nada y no da error.',
      ],
      'Cada cliente de Mauricio muestra su etapa y su próximo hito, y marcar un hito cumplido queda guardado.',
    ),
  },
  {
    titulo: 'Protocolo de graduación y salida de un cliente',
    proyecto: 'Feature: Customer Success',
    detalle: d(
      'Escribir el protocolo de cierre: qué se entrega, cómo se cierra y cuándo. Es la fase 4 del programa de Mauricio, que hoy no está definida.',
      'Él lo llamó «outboarding» y dijo que no sabe cómo cortar. Y tiene reloj: en octubre y noviembre empiezan a vencer los contratos de sus clientes.',
      [
        'Es un DOCUMENTO, no software. «Graduación» aparece una sola vez en todo el repo y es dentro del texto de una clase del curso (app/conocimientos/curso.ts:6590). El pipeline del CRM muere en `ganado` (lib/pipeline.ts:46-59).',
        '⚠️ El frente 04 del sprint prometía 5 casos de éxito y NO tiene materia prima: 29/7 [00:24:28] «No tengo ningún cliente que todavía ha llegado a las juntas o a la implementación de los tableros con las juntas, no tengo ninguno todavía». Y 31/7 [00:07:00] «no tengo nada de casos de éxito documentados, ni mostrados en landing, ni nada».',
        'Lo que sí tiene reloj y conviene poner en su lugar: la oferta de renovación. 8/7 [01:20:25] «en octubre y noviembre van a empezar a vencerse ya. Entonces, ¿qué les voy a ofrecer? No está claro». Ya está como prioridad del Perro en su propio board.',
        'Lo que sí existe hoy como material: las 4 respuestas de su encuesta anónima (31/7 [00:06:46]) y el cuestionario de 5 preguntas cerrado el 8/7.',
      ],
      'Existe un documento que dice qué se entrega al graduar, cómo se cierra y qué se le ofrece después — y Mauricio lo aprobó.',
    ),
  },
  {
    titulo: 'Pipeline de casos de éxito: del resultado al testimonio publicado',
    proyecto: 'Feature: Customer Success',
    detalle: d(
      'Un pipeline por estados que va de «el cliente logró la promesa» a «el testimonio está publicado», con la guía de entrevista adentro.',
      'Cierra el loop entrega → marketing, que es lo que la propuesta original llamaba «la entrega vuelve a vender». Y sirve a todos los workspaces: hoy MaKo tiene el vocabulario de creativos sin nada que lo alimente.',
      [
        'MaKo ya conoce `caso-exito` y `testimonio` como ángulos de creativo (lib/ads-analyst.ts:43,54, lib/angulos-data.ts), pero no hay ninguna entidad que los produzca: `grep` de testimonio como entidad → cero.',
        'El mecanismo para publicar ya existe: lib/shares.ts + app/compartido/[token]/.',
        '⚠️ Empezar por el detector, no por el pipeline: si el frente 03 mide «promesa cumplida», esto es una vista más sobre el mismo dato. Y el detector depende de que exista la matriz del frente 01.',
        'Es una tabla chica: estado, cliente, fecha del resultado, link de la grabación, link del publicado.',
      ],
      'Un cliente que llegó a su meta aparece en el pipeline con el siguiente paso claro, y nada se pierde entre el resultado y el video.',
    ),
  },
  {
    titulo: 'Auto-límite del consumo de IA sobre la cuenta de Claude de Mauricio',
    proyecto: 'Feature: Modelos IA',
    detalle: d(
      'Contratar un plan propio de US$200 y limitar el desarrollo de MaKo a un porcentaje del Cloud de Mauricio, con el consumo visible para él.',
      'Es el riesgo de relación más grande del encargo, y ya se cobró tres días de trabajo de un cliente suyo.',
      [
        '6/8 [00:04:02]: «tuve como tres días sin poder trabajar y tuve que pedir disculpas a mi cliente». Desarrollar MaKo sobre su cuenta se comió los créditos con los que él arma los tableros de sus clientes: el frente 01 del sprint se bloqueó a sí mismo.',
        'El acuerdo YA está cerrado y sin ejecutar. 6/8 [00:07:15]: «yo mismo limitarme a un cierto porcentaje y después de ese porcentaje no tocar más tu Cloud hasta la siguiente [renovación]» + [00:07:15] «Por mi propia cuenta yo voy a contratar otro plan de 200».',
        'Causa raíz encontrada en vivo: los micro-cobros no venían de la suscripción sino de la API de la consola de Anthropic, con RECARGA AUTOMÁTICA activada. Se desactivó en la llamada.',
        'Lo que él pidió no es gastar menos: 6/8 [00:14:27] «estoy ok con gastar… Mi problema es no saber, o sea, no quiero sorpresas».',
        'Y el reproche de fondo, que es el mismo con el que rechazó los US$9.000: [00:04:45] «siento que a lo mejor estás desarrollando, pero no sé si estás compartiendo también como esa restricción de lograr objetivos».',
      ],
      'Mauricio puede ver cuánto consumió el desarrollo de MaKo sobre su cuenta, y existe un tope que lo frena antes de dejarlo sin créditos.',
    ),
  },
  {
    titulo: 'El mapa de México pinta el estado equivocado, no un cero',
    proyecto: 'Feature: Dashboard',
    detalle: d(
      'Reemplazar el match por `startsWith` entre los nombres de Meta y los del GeoJSON por un diccionario explícito, y devolver `null` («sin dato») en vez de `0` cuando no hay match.',
      'Mauricio lo reportó el 8/7 [01:42:50] como «el mapa marca cero en Ciudad de México cuando debería haber datos». El diagnóstico obvio —falta el dato— es el equivocado: el dato existe y se lo lleva el estado de al lado.',
      [
        'app/marketing/ad-charts.tsx:514-519. `valueFor()` matchea con `norm()` (:60), que solo saca acentos y baja a minúsculas, y cae a un fallback bidireccional `k.startsWith(n) || n.startsWith(k)`.',
        'Las dos fallas a la vez: la feature «Ciudad de México» no matchea «mexico city» ni por igualdad ni por prefijo → cae en el `return 0`. Y la feature «México» (el Estado) SÍ matchea, porque `"mexico city".startsWith("mexico")` es true → se queda con el valor de CDMX.',
        'Un match por startsWith entre dos catálogos de nombres propios no es un match: es una colisión esperando al nombre más corto.',
        '⚠️ Hay que armar el diccionario mirando una respuesta REAL de Meta con `breakdowns:\'region\'`, no de memoria. Y `GEOURL` (:48) es un fetch a raw.githubusercontent.com desde un componente cliente: conviene bajar el GeoJSON al repo.',
        'El detalle está escrito en docs/hallazgos-ads.md.',
      ],
      'CDMX pinta su valor real, el Estado de México pinta el suyo, y un estado sin dato se distingue de uno en cero.',
    ),
  },
  {
    titulo: 'Agendar la Junta 2 sin salir de la llamada',
    proyecto: 'Feature: CRM',
    detalle: d(
      'Que mover un lead a Junta 2 y reservar el horario se pueda hacer en pocos segundos, desde donde ya se está mirando al lead, y desde el celular.',
      'Es fricción medida en vivo, y ya le hizo perder el registro de una junta: terminó cargándola a mano en su calendario.',
      [
        '6/8 [00:49:00]: «yo estoy con el cliente en la junta y meterme a Maco para hacer eso, para agendarlo, pues me genera una fricción… yo estoy en la junta y si no lo pongo rápido, me pasa lo que me ha pasado antes, que se me juntan dos». Y [00:49:25] «Entonces yo necesito apartar rápido el espacio».',
        'Consecuencia real ese mismo día [00:47:34]: «no la pude registrar en Maco porque no me acuerdo dónde».',
        'Va junto con la vista móvil: lo intentó desde el teléfono y no pudo.',
        'Ojo con el alcance: NO es rehacer el CRM. Es un camino corto desde la ficha del lead a «reservar la Junta 2», con el horario tomado.',
      ],
      'Mauricio agenda la Junta 2 desde el celular, en medio de una llamada, sin buscar dónde está.',
    ),
  },
  {
    titulo: 'Dejar escrito el acuerdo de propiedad del código de MaKo',
    proyecto: 'Legal y fiscal',
    detalle: d(
      'Poner por escrito lo que se acordó de palabra el 6/8 sobre la propiedad y el acceso al código de MaKo.',
      'Mauricio abrió el tema por su cuenta y le dedicó 25 minutos; quedó cerrado de palabra y sin registro. Es su inversión y su infraestructura, y hoy no hay nada firmado.',
      [
        'Lo acordado, textual (6/8 [00:36:53]): «jamás te voy a cobrar por eso… no te voy a cobrar por Maco». Y [00:37:00]: «todo el repositorio tuyo y que esté todo viviendo dentro de tu infraestructura… cuando yo lo migre, tú me dices, Martín, quiero tener Maco en mi infraestructura… y yo te lo comparto y ya tú haces lo que quieras».',
        'La única contraprestación [00:37:16]: «Lo único que te pido es que no lo compartas con otras personas, así no me copian la idea». Mauricio: «No, claro que no». Y [00:35:43] «No te voy a pedir regalías, no te preocupes».',
        'Por qué lo abrió [00:32:15]: «Dios no quiera y te contrata Elon Musk… ¿dónde está mi chingado Maco? ¿Dónde está todo lo que invertí de tiempo y de dinero?» y [00:34:41] «yo quiero estar claro contigo de proteger mi inversión».',
        '⚠️ El estado técnico que confesó en vivo y hay que contemplar: todo corre sobre SU Supabase, SU repositorio y SU Vercel — y hoy la misma infra la usan también Leila y Leandro [00:24:07].',
      ],
      'Existe un documento que los dos leyeron y aceptaron, con qué pasa con el código, con la infraestructura y con los otros clientes que hoy corren ahí.',
    ),
  },
  {
    titulo: 'Reencuadrar el sprint con Mauricio: los 5 pasos y el frente 04',
    proyecto: 'Feature: Customer Success',
    detalle: d(
      'Mandarle por escrito los 5 pasos y los 5 entregables, y renegociar el frente 04 antes de que venza el sprint.',
      'El activo metodológico de las 8 semanas está enterrado en un transcript de 4 horas que nadie volvió a abrir, y el frente 04 no se puede entregar. Las dos cosas se arreglan con una conversación, no con código.',
      [
        'La prueba de que está enterrado: el 6/8 [01:10:26] ninguno de los dos se acordaba de la lista de cinco. «Y habían, eran cinco en total, me acuerdo. Si no, ahí yo reviso la grabación». Recuperaron tres.',
        'Los 5 pasos y los 5 entregables están completos en docs/sprint-servicio-mauricio.md y en la tab /admin/dev/customer-success. No hace falta revisar ninguna grabación.',
        'El reencuadre que da criterio de terminado: los frentes 01, 02 y 03 son tres piezas del MISMO bucle, no cuatro frentes sueltos. «Montar el bucle para UN cliente» se puede dar por hecho; «avanzar 4 frentes» no.',
        '⚠️ Además hay que corregir el documento del sprint en siete puntos donde dice lo contrario que las reuniones: se cerró el 8/7 y no el 10/7; son US$500 EXTRA sobre el deal vigente; el «10 de septiembre» no se dijo nunca; el frente 03 se mudó adentro de MaKo y lo pidió él; son ~7 clientes activos y no 15.',
        'Y verificar dos cosas que quedaron en el aire: si mandó los 5 entregables el 6/8, y si pagó la segunda cuota que vencía el 10/8 (el 6/8 quedó impaga con problema de caja declarado).',
      ],
      'Mauricio tiene por escrito el bucle y los entregables, y el frente 04 quedó reemplazado por algo que sí se puede entregar antes de que venza el sprint.',
    ),
  },
];

// ── Las preguntas: HECHOS, nunca «qué prioridad le das» ──────────────────────
const PREGUNTAS: PropuestaPregunta[] = [
  { pregunta: '¿Para cuándo necesitás el bucle de 5 pasos andando con UN cliente de Mauricio, de punta a punta?', tipo: 'fecha', opciones: ['Esta semana', 'Antes de fin de agosto', 'Antes del 10 de septiembre', 'Todavía no hay fecha'] },
  { pregunta: 'El frente 04 no tiene materia prima: ningún cliente llegó a la etapa que produce el caso de éxito. ¿Con qué lo reemplazamos?', tipo: 'opcion', opciones: ['Con la oferta de renovación de oct/nov', 'Solo el protocolo de graduación escrito', 'Dos casos parciales narrados', 'Se deja como está y se entrega tarde'] },
  { pregunta: '¿Qué tiene que cubrir Whop además de los videos del programa?', tipo: 'multi', opciones: ['Solo los videos', 'Comunidad', 'Llamadas grupales', 'Cobro y control de acceso'] },
  { pregunta: '¿Con cuántos clientes de Mauricio dados de alta damos el frente 02 por cerrado?', tipo: 'opcion', opciones: ['Uno de prueba', 'Los ~7 activos', 'Los 15 históricos'] },
  { pregunta: 'El paso 4 depende de Fathom y la grabación ya falló dos veces. ¿Qué hace el sistema cuando no hay transcripción?', tipo: 'opcion', opciones: ['El cliente completa a mano', 'Se pide re-subir el audio', 'Queda pendiente y avisa', 'Se salta el paso en silencio'] },
  { pregunta: 'El semáforo de palancas (que MaKo obligue con evidencia, umbral y dueño), ¿para quién se construye?', tipo: 'opcion', opciones: ['Para todos los workspaces', 'Solo para el de Mauricio primero', 'Se prototipa en el de prueba'] },
  { pregunta: '¿Está cobrada la segunda cuota del sprint, que vencía el 10 de agosto?', tipo: 'opcion', opciones: ['Sí, ya entró', 'No, sigue pendiente', 'Se renegoció'] },
  { pregunta: 'De todo esto, ¿qué bloquea a qué? Marcá lo que NO puede arrancar hasta que Mauricio mande sus 5 entregables.', tipo: 'multi', opciones: ['Montar el programa en Whop', 'Conectar Whop por API', 'El prompt maestro de tableros', 'El formulario del bucle'] },
];

async function main() {
  const svc = getSupabaseServer();
  const { data: wss } = await svc.from('workspaces').select('id, nombre, capa').eq('capa', 'superadmin');
  const ws = (wss ?? [])[0] as { id: number; nombre: string } | undefined;
  if (!ws) throw new Error('no encontré el workspace con capa=superadmin');
  console.log(`workspace superadmin: #${ws.id} «${ws.nombre}»`);

  // Los ids de las que se amplían se resuelven por `num` contra la base: escribirlos a
  // mano es la forma segura de apuntar a la tarea equivocada dentro de tres semanas.
  const ampliar = await runWithWorkspace(ws.id, async () => {
    const db = await getTenantDb();
    const { data } = await db.from('plan_tareas').select('id, num, title').in('num', AMPLIAR.map((a) => a.num));
    const porNum = new Map((data ?? []).map((t) => [t.num as number, t as { id: string; num: number; title: string }]));
    const out: PropuestaTarea[] = [];
    for (const a of AMPLIAR) {
      const fila = porNum.get(a.num);
      if (!fila) { console.warn(`  ⚠️  #${a.num} no existe en el tablero: se saltea`); continue; }
      console.log(`  ampliar #${a.num} → ${fila.title}`);
      out.push({ titulo: a.titulo, detalle: a.detalle, enriquece: { id: fila.id, razon: a.razon, confianza: 'alta' } });
    }
    return out;
  });

  const tareas = [...NUEVAS, ...ampliar];
  const id = await crearPropuesta({
    ws: ws.id,
    origen: 'claude-code',
    resumen:
      `Customer Success: el trabajo del Sprint con Mauricio (los 5 pasos, Whop, el prompt maestro de tableros, el seguimiento y la graduación) más los bugs que él reportó. ` +
      `${NUEVAS.length} nuevas y ${ampliar.length} que ya existían y se amplían en vez de duplicarse (#109, #287, #327, #521, #29 y #332 — el barrido las encontró a mano contra las 461 abiertas). ` +
      `El programa completo, con los 12 módulos de la propuesta original, vive en /admin/dev/customer-success.`,
    tareas,
    // `preguntas: PREGUNTAS` ya no viaja: el alta dejó de preguntar (05/10/2026).
    eliminar: [],
    cerrar: [],
  });

  console.log(`\n${tareas.length} tareas (${NUEVAS.length} nuevas + ${ampliar.length} ampliadas) · ${PREGUNTAS.length} preguntas`);
  console.log(`\n${APP_BASE_URL}/plan/revisar/${id}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
