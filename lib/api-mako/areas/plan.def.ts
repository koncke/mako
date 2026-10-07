// =============================================================================
// api-mako/areas/plan.def — las operaciones del área `plan` (definiciones)
// =============================================================================
// Una entrada por operación: id, qué es, parámetros, por qué canales sale, cómo se
// confirma. SIN server-only y sin importar valores de módulos que lo tengan: esto
// lo importan los tests y el generador de la referencia. Los cuerpos van en
// plan.run.ts, cruzados por id. Español neutro (lo lee el cliente).
//
// LA REGLA DEL PLAN: un agente NUNCA crea, edita, cierra ni borra tareas directo.
// Todo entra por un BORRADOR (plan_propuestas) que una persona revisa en
// /plan/revisar/<id>, y al aplicarlo corre el Perro Guardián (puntúa, rutea al
// proyecto, arma la checklist). Lo único que va por chat son cambios chicos sobre UNA
// cosa ya identificada por id (tildar un paso, cambiar el avance, una dependencia).
//
// Hay DOS tableros: el del super-admin (ids de texto, #num, dependencias) y el de
// cada cliente (ids numéricos). Las lecturas funcionan con los dos; las que solo
// existen en uno lo dicen en la descripción.
//
// Canales: las lecturas que llaman a un modelo (costo `ia`) NO salen por HTTP — un
// token en la máquina de un tercero no debería poder quemar IA en bucle. Las
// reuniones de Fathom tampoco: traen participantes (personas).
// =============================================================================

import type { OperacionDef } from '../tipos';
// El tope del `detalle` es UNO: el mismo número que recorta el que escribe (plan-board) y
// el que lo amplía. Declararlo a mano acá sería la segunda copia, y la que se queda vieja.
import { TOPE_DETALLE } from '@/lib/detalle-contrato';
import { TOPE_PRUEBA_CIERRE } from '@/lib/cierre-tarjeta';

const TODOS = ['whatsapp', 'app', 'http'] as const;
const SIN_HTTP = ['whatsapp', 'app'] as const;
const TAB = { tab: 'todo' } as const;
/** Lo que llama a un modelo: en la app, un closer o setter (la tab `todo` los incluye)
 *  no puede dispararlo en bucle. */
const TAB_ADMIN = { tab: 'todo', rolMinimo: 'admin' } as const;

export const DEFS: readonly OperacionDef[] = [
  // ── Lecturas ──────────────────────────────────────────────────────────────
  {
    id: 'ver_plan', area: 'plan', tipo: 'lectura',
    titulo: 'Ver el plan del negocio',
    descripcion: 'Vista rápida del plan del negocio: los proyectos y las tareas ABIERTAS, con su id y un link. Para decidir antes de proponer tareas (a qué proyecto va cada una, si ya existe, qué id ampliar o cerrar) usa listar_tareas_plan, que dice qué tablero es y trae score, deadline y avance. Tope: 300 tareas. No requiere parámetros.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'listar_tareas_plan', area: 'plan', tipo: 'lectura',
    titulo: 'Tareas abiertas con score',
    descripcion: 'El plan abierto con todo lo que sirve para decidir, y la lectura a usar ANTES de proponer_tareas_plan (asignar cada tarea a un proyecto que ya existe y detectar si lo que piden YA está: en ese caso no lo dupliques, da su id y ofrece ampliarla): cada tarea con score (1-100, lo pone el Perro Guardián), prioridad, avance en %, deadline y proyecto por NOMBRE (el que hay que usar al proponer para no duplicar proyectos), más los proyectos con su score. Sirve para avisar qué está en Alta o vencido. Dice qué tablero es (plan = super-admin, todo = cliente). Tope: 300 tareas, las de mayor score, y dice cuántas quedaron afuera. No requiere parámetros.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'ver_tarea_plan', area: 'plan', tipo: 'lectura',
    titulo: 'Ficha completa de una tarea',
    descripcion: 'Todo lo de UNA tarea: título, detalle, score y su razón, deadline y su razón, avance, historial reciente (quién tocó qué: user, ia = MaKo, code = Claude Code), fuente (reunión, WhatsApp, archivo), notas, quarter y qué la bloquea. Pide por id, o por número visible (#412) en el tablero del super-admin.',
    parametros: [
      { nombre: 'id', tipo: 'string', descripcion: 'id de la tarea (de listar_tareas_plan o buscar_tareas_plan). También acepta «#412».', max: 80 },
      { nombre: 'num', tipo: 'number', descripcion: 'número visible #N (solo tablero del super-admin). Pasa id o num.', entero: true, minimo: 1 },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'ver_proyecto_plan', area: 'plan', tipo: 'lectura',
    titulo: 'Ficha de un proyecto',
    descripcion: 'Un proyecto del plan: nombre, emoji, detalle, score y su razón, deadline, sus tareas abiertas y las hechas, y el avance agregado en %. Pide por id, por P# (tablero del super-admin) o por el nombre exacto.',
    parametros: [
      { nombre: 'proyectoId', tipo: 'string', descripcion: 'id del proyecto, su P# o su nombre exacto (de listar_proyectos_plan).', obligatorio: true, max: 160 },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'listar_proyectos_plan', area: 'plan', tipo: 'lectura',
    titulo: 'Proyectos ordenados por prioridad',
    descripcion: 'Todos los proyectos del plan ordenados por score, de mayor a menor. El norte viene aparte en `objetivo_principal`, y NO siempre es el primero de la lista: los que traen `se_repite: true` se repiten para siempre, no compiten por un puesto y su score no es un puesto. Cada uno con tareas abiertas, hechas, avance en % y si su score lo fijó el dueño debatiéndolo. Responde «¿cuál es mi foco ahora?» y «¿en qué proyecto va esto?». No requiere parámetros.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'ver_prioridades_plan', area: 'plan', tipo: 'lectura',
    titulo: 'Qué hacer ahora',
    descripcion: 'Las tareas abiertas de mayor score que se pueden empezar YA: excluye las bloqueadas por una dependencia abierta (siguen siendo importantes, pero no ejecutables) y dice cuántas quedaron afuera por eso. Si TODAS las abiertas están bloqueadas, devuelve igual las de mayor score marcadas `bloqueada: true`, para saber qué destrabar primero. Responde «¿qué hago hoy?».',
    parametros: [
      { nombre: 'limite', tipo: 'number', descripcion: 'cuántas tareas (default 10).', entero: true, minimo: 1, maximo: 50 },
      { nombre: 'proyectoId', tipo: 'string', descripcion: 'acotar a un proyecto (id, P# o nombre exacto).', max: 160 },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'listar_tareas_vencidas', area: 'plan', tipo: 'lectura',
    titulo: 'Tareas vencidas o por vencer',
    descripcion: 'Tareas abiertas cuyo deadline ya pasó o cae dentro de los próximos N días, con los días que faltan (negativo = vencida hace esos días) y la razón del deadline. Responde «¿qué se me venció?» y «¿qué vence esta semana?». Los días se cuentan en días de calendario contra la fecha de hoy en la zona horaria del negocio (el campo `ventana.hoy`).',
    parametros: [
      { nombre: 'dias', tipo: 'number', descripcion: 'ventana hacia adelante en días (default 7). 0 = solo las vencidas y las de hoy.', entero: true, minimo: 0, maximo: 90 },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    // ⚠️ POR QUÉ NO ALCANZABA CON `listar_tareas_vencidas`. Esa mira el DEADLINE, y una
    // tarea sin fecha no aparece en ninguna lista de vencidas por mucho que lleve
    // parada. El ranking SÍ la castiga desde hace meses (`castigoQuietud`), o sea que el
    // score se hunde solo y no había forma de preguntar por qué ni a quiénes les pasó.
    id: 'listar_tareas_paradas', area: 'plan', tipo: 'lectura',
    titulo: 'Tareas que nadie toca hace tiempo',
    descripcion: 'Las tareas abiertas que llevan N o más días sin que una PERSONA las toque, de la más parada a la menos, con cuándo nacieron. Responde «¿qué está trabado?», «¿qué vengo arrastrando?» y «¿de qué no se habla hace un mes?». No es lo mismo que las vencidas: una tarea SIN deadline puede llevar meses parada y no aparecer ahí. Lo que hace MaKo no cuenta como tocarla — si contara, el Perro reseteando scores dejaría el tablero entero como recién movido. Las recurrentes no entran: no se completan, se repiten.',
    parametros: [
      { nombre: 'dias', tipo: 'number', descripcion: 'días mínimos sin moverse (default 30, que es cuando el ranking empieza a castigarla).', entero: true, minimo: 1, maximo: 365 },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'listar_tareas_sin_datos', area: 'plan', tipo: 'lectura',
    titulo: 'Tareas sin deadline',
    descripcion: 'Las tareas abiertas a las que les falta fecha límite: lo que el Perro Guardián no pudo decidir y conviene completar. Devuelve la lista con su total. No requiere parámetros.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'buscar_tareas_plan', area: 'plan', tipo: 'lectura',
    titulo: 'Buscar tareas por texto',
    descripcion: 'Búsqueda literal en el plan: todas las palabras, en cualquier orden, que EMPIEZAN una palabra («CAC» no encuentra «notificaciones»). Por defecto mira solo el título; se pueden sumar detalle, notas y razones. «#412» busca por número. Para buscar por significado y no por palabras, en WhatsApp o en la app existe cruzar_tareas_con_plan.',
    parametros: [
      { nombre: 'q', tipo: 'string', descripcion: 'el texto a buscar, o #número.', obligatorio: true, max: 200 },
      { nombre: 'campos', tipo: 'string[]', descripcion: 'dónde buscar (default solo titulo).', enum: ['titulo', 'detalle', 'notas', 'razones'], max: 4 },
      { nombre: 'incluirHechas', tipo: 'boolean', descripcion: 'true para buscar también en las tareas terminadas (default false).' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'listar_dependencias_plan', area: 'plan', tipo: 'lectura',
    titulo: 'Qué depende de qué',
    descripcion: 'Las dependencias del plan: «B no puede empezar hasta que A termine» (bloquea) o «A va antes que B pero no lo frena» (ordena), con los títulos de las dos puntas, su razón y quién la puso. Solo existe en el tablero del super-admin; en el de un cliente contesta que no hay.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'listar_borradores_plan', area: 'plan', tipo: 'lectura',
    titulo: 'Borradores de tareas pendientes',
    descripcion: 'Los borradores que esperan que una persona los confirme: tareas sacadas de una reunión o un archivo, mandadas por otra persona, propuestas por WhatsApp o Claude Code, o cierres propuestos. Cada uno con su link a /plan/revisar. Responde «¿tengo algo para confirmar?». Dice cuántos devolvió y si el límite dejó otros afuera.',
    parametros: [
      { nombre: 'limite', tipo: 'number', descripcion: 'cuántos borradores traer, los más nuevos primero (default 30).', entero: true, minimo: 1, maximo: 100 },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'ver_borrador_plan', area: 'plan', tipo: 'lectura',
    titulo: 'Ver un borrador de tareas',
    descripcion: 'El contenido de UN borrador: tareas propuestas (con quién la asumió, si amplía una que ya existe, en qué minuto de la grabación se dijo), cierres con su evidencia, bajas sugeridas (informativas: no se ejecutan) y las que ya se cargaron. El id viene de listar_borradores_plan o del link /plan/revisar/<id>: cópialo tal cual, nunca de memoria.',
    parametros: [
      { nombre: 'id', tipo: 'string', descripcion: 'id del borrador (empieza con «prop»).', obligatorio: true, max: 80 },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'ver_estado_borrador', area: 'plan', tipo: 'lectura',
    titulo: 'Estado de un borrador',
    descripcion: 'Estado liviano de un borrador que MaKo puede estar llenando en segundo plano (archivos subidos): procesando, pendiente, aplicada, descartada o fallado, cuántas tareas lleva y el resumen. Sirve para sondear sin traer todo el contenido.',
    parametros: [
      { nombre: 'id', tipo: 'string', descripcion: 'id del borrador (empieza con «prop»).', obligatorio: true, max: 80 },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'ver_borrador_de_reunion', area: 'plan', tipo: 'lectura',
    titulo: 'Qué salió de una reunión',
    descripcion: 'Dado el recordingId de una grabación de Fathom, el borrador que dejó, EN CUALQUIER ESTADO: cuántas tareas se cargaron, cuántas propias y de otras personas siguen pendientes, o si se descartó. Evita volver a leer (y pagar) una reunión que ya se leyó.',
    parametros: [
      { nombre: 'recordingId', tipo: 'number', descripcion: 'recording_id de la API de Fathom (en WhatsApp o en la app sale de listar_reuniones_fathom; por la API, del propio Fathom). NO es el número de la URL fathom.video/calls/<id>.', obligatorio: true, entero: true, minimo: 1 },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'listar_reuniones_fathom', area: 'plan', tipo: 'lectura',
    titulo: 'Últimas reuniones de Fathom',
    descripcion: 'Una página de las grabaciones recientes del Fathom del negocio: título, fecha, duración en minutos, link, cantidad de participantes y tipo (equipo, ventas, entrega u otra, calculado contra el CRM y el equipo), más qué borrador dejó cada una. Las de ventas no van al plan: sus compromisos son del lead. Para seguir, pasa el cursor que devuelve. Necesita Fathom conectado.',
    parametros: [
      { nombre: 'cursor', tipo: 'string', descripcion: 'el cursor de la página anterior (campo siguiente_cursor).', max: 400 },
      { nombre: 'recordedAfter', tipo: 'string', descripcion: 'solo las grabadas después de esta fecha, ISO (AAAA-MM-DD o con hora).', max: 40 },
      { nombre: 'limit', tipo: 'number', descripcion: 'cuántas por página (default 15).', entero: true, minimo: 1, maximo: 25 },
    ],
    salida: 'json', canales: SIN_HTTP, costo: 'externo', lenta: true, gating: { tab: 'todo', integracion: 'fathom' },
  },
  {
    id: 'cruzar_tareas_con_plan', area: 'plan', tipo: 'lectura',
    titulo: 'Detectar tareas que ya existen',
    descripcion: 'El control anti-duplicados del Perro Guardián: para cada tarea candidata decide si es NUEVA o si ya existe en el plan escrita de otra forma (mismo objetivo, mismo entregable), con el id de la existente y confianza alta o media. Úsala antes de proponer un lote grande: las que ya existen van con `enriquece` o por proponer_ampliar_tareas. Ojo: si no marca ninguna, puede ser que no haya duplicados o que el modelo no respondió bien; ante la duda, revisa con buscar_tareas_plan.',
    parametros: [
      {
        nombre: 'candidatas', tipo: 'object[]', descripcion: 'las tareas nuevas a comparar contra las abiertas del plan.', obligatorio: true, max: 40,
        campos: [
          { nombre: 'titulo', tipo: 'string', descripcion: 'título de la candidata.', obligatorio: true, max: 200 },
          { nombre: 'detalle', tipo: 'string', descripcion: 'detalle de la candidata (se usan los primeros 120 caracteres).', max: 2000 },
        ],
      },
    ],
    salida: 'json', canales: SIN_HTTP, costo: 'ia', lenta: true, gating: TAB_ADMIN,
  },
  {
    id: 'buscar_duplicados_tarea', area: 'plan', tipo: 'lectura',
    titulo: 'Duplicados de una tarea',
    descripcion: 'Dada UNA tarea del plan (por id), cuáles de las otras tareas abiertas son en el fondo el mismo trabajo aunque estén escritas distinto, con la razón. Semántica, no coincidencia de palabras. Útil antes de proponer bajas o para fusionar contexto.',
    parametros: [
      { nombre: 'id', tipo: 'string', descripcion: 'id de la tarea (de listar_tareas_plan), o «#412».', obligatorio: true, max: 80 },
    ],
    salida: 'json', canales: SIN_HTTP, costo: 'ia', lenta: true, gating: TAB_ADMIN,
  },
  {
    id: 'listar_proyectos_vacios', area: 'plan', tipo: 'lectura',
    titulo: 'Proyectos sin tareas abiertas',
    descripcion: 'Los proyectos sin ninguna tarea abierta (incluye los que tienen todo terminado). Un proyecto vacío no vale poco: le falta trabajo. En WhatsApp o en la app, es lo que se le pasa a proponer_tareas_proyecto_vacio. Solo existe en el tablero del super-admin. No requiere parámetros.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'ver_senales_negocio', area: 'plan', tipo: 'lectura',
    titulo: 'Qué ya está resuelto',
    descripcion: 'Lo que MaKo ya sabe del negocio sin preguntar, cada señal en sí o no: Meta, Calendly, WhatsApp y Fathom conectados, funnel cargado, leads en el CRM, llamadas analizadas, avatares, razones y oferta definidos, VSL con visitas, nutrición activa; más la fase y el canal del diagnóstico. Sirve para NO proponer tareas de cosas ya hechas. Una señal en no puede ser falta de evidencia, no prueba de que falte.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'sugerir_proyecto_plan', area: 'plan', tipo: 'lectura',
    titulo: 'Sugerir nombre de proyecto',
    descripcion: 'Dada una descripción en palabras del usuario, MaKo sugiere nombre corto (tipo nombre de pestaña), emoji y detalle para un proyecto. NO crea nada: el nombre se pasa en `proyecto` de proponer_tareas_plan y el Perro Guardián decide al aplicar si nace o si va a uno existente.',
    parametros: [
      { nombre: 'descripcion', tipo: 'string', descripcion: 'qué es el proyecto, en las palabras del usuario.', obligatorio: true, max: 1500 },
    ],
    salida: 'json', canales: SIN_HTTP, costo: 'ia', gating: TAB_ADMIN,
  },

  // ── Acciones por chat (UNA cosa identificada, reversible) ─────────────────
  {
    id: 'descartar_borrador_plan', area: 'plan', tipo: 'accion', confirmacion: 'chat', reversible: false,
    titulo: 'Descartar un borrador',
    descripcion: 'Descarta un borrador PENDIENTE sin crear nada (la persona dijo que no le sirve). Solo los borradores de una reunión o un archivo se reviven volviendo a leer esa misma fuente; los demás no se pueden recuperar, y el resumen lo dice. Si el borrador trae compromisos de otras personas, también salen del reparto. Pide el id de listar_borradores_plan; queda pendiente hasta que la persona confirme.',
    parametros: [
      { nombre: 'id', tipo: 'string', descripcion: 'id del borrador (empieza con «prop»).', obligatorio: true, max: 80 },
    ],
    escribe: 'plan_propuestas.estado pasa de pendiente a descartada',
    canales: TODOS, costo: 'gratis', gating: TAB,
  },
  // ⛔ ACÁ VIVÍA `tildar_checklist_tarea`, y se fue el 23/09/2026. Las checklists salieron
  // del producto el 22/09 («de última un bullet point») y los pasos se mudaron adentro del
  // `detalle`; la migración dejó CERO items, medido: 334 tareas del tablero del dueño y 212
  // del cliente, ninguna con checklist. O sea que la operación seguía publicada —en la
  // referencia, en la skill del cliente y en las tools del doer— y su ÚNICA respuesta
  // posible era «la tarea no tiene un paso con id X». Una capacidad que no puede hacer nada
  // no es código muerto: es una promesa que un agente va a intentar cumplir, gastando un
  // turno y devolviendo un error que culpa al dato.
  {
    id: 'actualizar_avance_tarea', area: 'plan', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Cambiar el avance de una tarea',
    descripcion: 'Cambia el avance (0-99 %) de UNA tarea y deja rastro en el historial; la columna (por hacer, en curso) se deriva sola del avance. También sirve para reabrir una tarea hecha. Para marcarla HECHA (100 %) usa proponer_cierre_tareas, que pide la evidencia. No toca score, deadline ni proyecto.',
    parametros: [
      { nombre: 'id', tipo: 'string', descripcion: 'id de la tarea (de listar_tareas_plan), o «#412».', obligatorio: true, max: 80 },
      { nombre: 'progreso', tipo: 'number', descripcion: 'avance nuevo en %, de 0 a 99.', obligatorio: true, entero: true, minimo: 0, maximo: 99 },
    ],
    escribe: 'el avance y el historial de la tarea (plan_tareas o experimento_tareas)',
    canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'agregar_dependencia_plan', area: 'plan', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Declarar una dependencia',
    descripcion: 'Declara que una tarea o proyecto depende de otro: «B no puede empezar hasta que A termine» (bloquea) o «A va antes pero no frena a B» (ordena), con la razón. Antes de proponerla verifica que las dos puntas existan y que no se forme un círculo. No escribe puntos: la urgencia sube sola por la cadena. Solo en el tablero del super-admin.',
    parametros: [
      { nombre: 'entidad', tipo: 'string', descripcion: 'si las dos puntas son tareas o proyectos.', obligatorio: true, enum: ['tarea', 'proyecto'] },
      { nombre: 'deId', tipo: 'string', descripcion: 'id del que ESPERA (B).', obligatorio: true, max: 80 },
      { nombre: 'aId', tipo: 'string', descripcion: 'id del que va PRIMERO (A).', obligatorio: true, max: 80 },
      { nombre: 'clase', tipo: 'string', descripcion: 'bloquea (default) u ordena.', enum: ['bloquea', 'ordena'] },
      { nombre: 'razon', tipo: 'string', descripcion: 'qué produce A que B necesita. Sin esto no se puede auditar.', obligatorio: true, max: 300 },
    ],
    escribe: 'una fila en plan_dependencias (origen ia)',
    canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'quitar_dependencia_plan', area: 'plan', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Quitar una dependencia',
    descripcion: 'Quita una dependencia existente entre dos tareas o dos proyectos (la arista de deId hacia aId, de listar_dependencias_plan). Solo en el tablero del super-admin.',
    parametros: [
      { nombre: 'entidad', tipo: 'string', descripcion: 'tarea o proyecto.', obligatorio: true, enum: ['tarea', 'proyecto'] },
      { nombre: 'deId', tipo: 'string', descripcion: 'id del que espera.', obligatorio: true, max: 80 },
      { nombre: 'aId', tipo: 'string', descripcion: 'id del que va primero.', obligatorio: true, max: 80 },
    ],
    escribe: 'borra una fila de plan_dependencias',
    canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'guardar_termino_glosario', area: 'plan', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Guardar un término del glosario',
    descripcion: 'Guarda qué significa una sigla o apodo del negocio (la respuesta a «¿qué es X?»), para que las próximas lecturas de reuniones y archivos lo entiendan. Si el término ya estaba, cambia su definición en vez de duplicarlo. Usa solo lo que la persona dijo, nunca una definición inventada.',
    parametros: [
      { nombre: 'termino', tipo: 'string', descripcion: 'la sigla o palabra (hasta 80 caracteres).', obligatorio: true, max: 80 },
      { nombre: 'definicion', tipo: 'string', descripcion: 'qué significa, en palabras de la persona (hasta 400 caracteres).', obligatorio: true, max: 400 },
    ],
    escribe: 'una entrada de conocimiento en el área glosario del negocio (o cambia la que ya había) y calcula su embedding',
    canales: TODOS, costo: 'ia', gating: TAB_ADMIN,
  },

  // ── Acciones por pantalla (/plan/revisar) ─────────────────────────────────
  {
    id: 'proponer_tareas_plan', area: 'plan', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/plan/revisar', reversible: true,
    titulo: 'Proponer tareas al plan',
    descripcion: 'PROPONE agregar tareas al plan: deja un BORRADOR con las tareas. Úsala cuando pasan una lista de cosas para el plan, aunque venga desordenada. Resuelve lo DEDUCIBLE antes (a qué proyecto va y si ya existe, con listar_tareas_plan). Lo que no puedas deducir va escrito en el `detalle` de la tarea: el alta NO hace preguntas, y la prioridad y la fecha las decide el Perro Guardián al aplicar. Devuelve un LINK: pásalo TAL CUAL, sin pedir «sí» ni repetir la lista. Nada se crea hasta que la persona confirma en esa pantalla.',
    parametros: [
      {
        nombre: 'tareas', tipo: 'object[]', descripcion: 'las tareas a agregar, con lo deducible resuelto.', obligatorio: true, max: 30,
        campos: [
          { nombre: 'titulo', tipo: 'string', descripcion: 'qué hay que hacer, corto e imperativo.', obligatorio: true, max: 200 },
          { nombre: 'detalle', tipo: 'string', descripcion: 'EL CAMPO MÁS IMPORTANTE: qué es, por qué, qué sería «listo» y todo el contexto que dio la persona. Lo que no quede aquí se pierde.', max: TOPE_DETALLE },
          { nombre: 'proyecto', tipo: 'string', descripcion: 'NOMBRE legible del proyecto (nunca un id). Si ya existe, el nombre exacto de listar_tareas_plan. Es una propuesta: no le digas a la persona en qué proyecto quedó.', max: 120 },
          { nombre: 'deadline', tipo: 'string', descripcion: 'fecha límite AAAA-MM-DD, solo si la dijeron.', max: 10 },
          { nombre: 'prioridad', tipo: 'string', descripcion: 'se ignora al aplicar: la decide el Perro Guardián.', enum: ['alta', 'media', 'baja', 'futuro'] },
        ],
      },
    ],
    escribe: 'un borrador en plan_propuestas; las tareas se crean recién cuando la persona confirma',
    canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'proponer_cierre_tareas', area: 'plan', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/plan/revisar', reversible: true,
    titulo: 'Proponer cerrar tareas hechas',
    descripcion: 'Propone marcar como HECHAS tareas que ya existen, cada una con la evidencia de por qué (qué se entregó, dónde se ve). Deja un borrador de cierres: la persona confirma cada uno en la pantalla, y puede decir «está a medias». Cerrar no es borrar: la tarjeta queda con su historial. Sin evidencia de al menos 10 caracteres el cierre no entra. Devuelve un LINK: pásalo tal cual.',
    parametros: [
      {
        nombre: 'cerrar', tipo: 'object[]', descripcion: 'las tareas a cerrar.', obligatorio: true, max: 40,
        campos: [
          { nombre: 'id', tipo: 'string', descripcion: 'id de la tarea (de listar_tareas_plan).', obligatorio: true, max: 80 },
          { nombre: 'evidencia', tipo: 'string', descripcion: 'por qué está hecha, con la prueba (mínimo 10 caracteres).', obligatorio: true, max: TOPE_PRUEBA_CIERRE },
          { nombre: 'confianza', tipo: 'string', descripcion: 'alta = lo verificaste; media = lo deduces (default).', enum: ['alta', 'media'] },
        ],
      },
      { nombre: 'resumen', tipo: 'string', descripcion: 'una línea de qué es este lote.', max: 300 },
    ],
    escribe: 'un borrador de cierres en plan_propuestas; las tareas se cierran recién al confirmar',
    canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'proponer_ampliar_tareas', area: 'plan', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/plan/revisar', reversible: false,
    titulo: 'Proponer sumar contexto a tareas',
    descripcion: 'Cuando algo que entra YA está en el plan, en vez de duplicarlo se le suma el contexto nuevo. Deja un borrador donde cada ítem apunta a la tarea existente: al confirmar, el detalle se fusiona (lo viejo primero, nunca se pisa) y el historial dice de dónde salió. No toca score, deadline ni proyecto. Devuelve un LINK: pásalo tal cual.',
    parametros: [
      {
        nombre: 'items', tipo: 'object[]', descripcion: 'las tareas existentes y lo que se les suma.', obligatorio: true, max: 30,
        campos: [
          { nombre: 'id', tipo: 'string', descripcion: 'id de la tarea existente (de listar_tareas_plan).', obligatorio: true, max: 80 },
          { nombre: 'detalle', tipo: 'string', descripcion: 'el contexto nuevo a sumar.', obligatorio: true, max: TOPE_DETALLE },
          { nombre: 'razon', tipo: 'string', descripcion: 'por qué es la misma tarea.', obligatorio: true, max: 400 },
        ],
      },
      { nombre: 'resumen', tipo: 'string', descripcion: 'una línea de qué es este lote.', max: 300 },
    ],
    escribe: 'un borrador en plan_propuestas con tareas marcadas «enriquece»; se amplían recién al confirmar',
    canales: TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'proponer_tareas_proyecto_vacio', area: 'plan', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/plan/revisar', reversible: true,
    titulo: 'Proponer tareas para proyecto vacío',
    descripcion: 'Para un proyecto sin tareas abiertas (de listar_proyectos_vacios), MaKo intuye las tareas que tendría y deja un borrador. Es lo más especulativo que produce: nunca crea tareas, la persona las revisa y corrige. Solo en el tablero del super-admin. Devuelve un LINK: pásalo tal cual.',
    parametros: [
      { nombre: 'projId', tipo: 'string', descripcion: 'id del proyecto vacío (de listar_proyectos_vacios).', obligatorio: true, max: 80 },
    ],
    escribe: 'un borrador en plan_propuestas con las tareas intuidas',
    canales: SIN_HTTP, costo: 'ia', lenta: true, gating: TAB_ADMIN,
  },
];
