// =============================================================================
// api-mako/areas/experimentos.def — las operaciones del área `experimentos` (definiciones)
// =============================================================================
// Una entrada por operación: id, qué es, parámetros, por qué canales sale, cómo se
// confirma. SIN server-only y sin importar valores de módulos que lo tengan: esto
// lo importan los tests y el generador de la referencia. Los cuerpos van en
// experimentos.run.ts, cruzados por id. Español neutro (lo lee el cliente).
//
// Qué hay en esta área (tab Experiments, /experimentos):
//   · Experimentos: una hipótesis se vuelve medible (métrica del catálogo, dirección,
//     ventana, baseline) y al cerrar MaKo dicta veredicto y deja el aprendizaje.
//   · Conclusiones: las verdades del negocio (experimentos cerrados con veredicto).
//   · Retro: el reporte v3 de una retrospectiva y su plan (aceptar / posponer /
//     descartar / deshacer cada item), más el gate del Perro Guardián.
//
// Decisiones:
//   · Generar una Retro NO entra (8 fases de IA, minutos, stream NDJSON, y el gate
//     del Perro vive inline en app/api/retro/route.ts): se corre desde la tab. Por
//     eso tampoco entra debatir el gate: su «deja» no destraba nada fuera de esa
//     ruta, que vuelve a debatir con su propio motivo. Sí entran leer los reportes,
//     el plan, el seguimiento y el estado del gate.
//   · Crear un experimento es `pantalla` (varios campos libres y una métrica que un
//     modelo puede transcribir mal; al arrancar fija baseline y fechas). Iniciar /
//     cerrar / descartar uno YA identificado por id son `chat`, y el runner vuelve a
//     mirar el ESTADO al confirmar: las funciones de lib no lo chequean (iniciar un
//     cerrado lo reactiva y pisa el baseline; cerrar un cerrado vuelve a pagar la IA
//     y pisa el veredicto; descartar un cerrado lo saca de las verdades).
//   · Borrar una Retro es `pantalla` + admin: borrar es borrar, y borrar la última
//     destraba el gate del Perro.
//   · Las métricas son del funnel GLOBAL de la cuenta (no por anuncio ni campaña),
//     los montos salen en USD convertidos desde MXN con un tipo de cambio fijo, y
//     las fechas se anclan a America/Tijuana. Va dicho en cada salida.
//   · Rol: la página /experimentos hace requireRolWs([]) (solo el ADMIN del
//     workspace; un closer o setter rebota). `gating.tab` mira la CAPA del workspace,
//     no el rol de la persona, así que TODO lo del área lleva además
//     `rolMinimo: 'admin'` (TAB_ADMIN) para replicar esa pantalla: cerrar un
//     experimento vuelve verdad un veredicto, aceptar un item crea experimentos y
//     tareas, y la Retro trae plata y cobranza. Dos excepciones decididas a propósito:
//     `estado_experimentos` queda sin gating (ya se inyectaba en el contexto de MaKo
//     de todo el producto y en /api/agente) y `catalogo_metricas_experimento` queda
//     solo con la tab (es el catálogo fijo de 17 métricas, sin un dato del negocio).
//   · Sin `http`: las que invocan un modelo AL LEER (sugerir, idear) y `ficha_retro`:
//     sus hallazgos, insights y seguimiento los redacta la IA desde fuentes con
//     nombres de leads y empresas (formularios sin atender), el resultado de llamadas
//     de closing sacado de transcripts y cuotas vencidas con nombre y monto
//     (lib/retro-fuentes.ts). El área closing dejó eso detrás de SIN http; esta
//     lectura no puede ser la puerta de atrás. Por HTTP quedan plan_retro (tesis no,
//     solo el plan) y listar_retros.
// =============================================================================

import type { OperacionDef, Parametro } from '../tipos';

const TAB = { tab: 'experimentos' } as const;
const TAB_ADMIN = { tab: 'experimentos', rolMinimo: 'admin' } as const;
const CANALES_TODOS = ['whatsapp', 'app', 'http'] as const;

/** Las 17 keys del catálogo METRICAS de lib/experimentos.ts. Son contrato de base
 *  (columna experimentos.metrica): no se renombran. Copiadas acá porque la def no
 *  puede importar un valor de un módulo con server-only; el runner vuelve a validar
 *  contra el catálogo real al preparar. */
const METRICA_KEYS = [
  'cpl', 'cp_form', 'cpc', 'cpm', 'cpa', 'cac', 'ctr', 'tasa_landing', 'tasa_form',
  'tasa_agenda', 'impressions', 'landing_page_views', 'leads_count', 'agendamientos',
  'vsl_views', 'cierres', 'spend_usd',
] as const;

const ID_EXPERIMENTO: Parametro = { nombre: 'id', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: 'id numérico del experimento en este negocio (sale de listar_experimentos o vista_experimentos).', ejemplo: 12 };
const ID_RETRO: Parametro = { nombre: 'retroId', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: 'id numérico de la Retro (sale de listar_retros).', ejemplo: 3 };
const ITEM_PLAN: Parametro = { nombre: 'itemId', tipo: 'string', obligatorio: true, max: 20, descripcion: 'id del item dentro del plan de esa Retro (p1, p2, …; sale de plan_retro).', ejemplo: 'p2' };
const FECHA = (nombre: 'desde' | 'hasta', que: string): Parametro => ({ nombre, tipo: 'string', obligatorio: true, max: 10, descripcion: `${que}, formato YYYY-MM-DD (inclusive).`, ejemplo: nombre === 'desde' ? '2026-08-01' : '2026-08-31' });

export const DEFS: readonly OperacionDef[] = [
  // ── Lecturas: experimentos ─────────────────────────────────────────────────
  {
    id: 'estado_experimentos', area: 'experimentos', tipo: 'lectura',
    titulo: 'Verdades validadas y experimentos en curso',
    descripcion: 'Bloque de texto con las VERDADES VALIDADAS del negocio (aprendizajes de experimentos cerrados con veredicto «validada», hasta 12) y los experimentos ACTIVOS (hasta 12, todavía sin resultado). Úsalo antes de afirmar cualquier causa-efecto sobre el negocio: lo que está aquí se puede afirmar; lo que no, se propone como experimento. No incluye refutadas ni no concluyentes (para eso, listar_conclusiones_experimentos). No requiere parámetros.',
    parametros: [],
    salida: 'texto', canales: CANALES_TODOS, costo: 'gratis',
  },
  {
    id: 'listar_experimentos', area: 'experimentos', tipo: 'lectura',
    titulo: 'Listar experimentos del negocio',
    descripcion: 'Lista los experimentos del negocio (propuestos, activos, cerrados y descartados), más recientes primero, con id, título, estado, métrica y su unidad, dirección, ventana, fechas y, si cerró, veredicto y aprendizaje. Úsalo para «¿qué experimentos tengo?», para encontrar el id de uno por su título, o para filtrar por estado antes de iniciar, cerrar o descartar. Sin medición en vivo (para eso, vista_experimentos o medicion_experimento).',
    parametros: [
      { nombre: 'estado', tipo: 'string', enum: ['propuesto', 'activo', 'cerrado', 'descartado'], descripcion: 'Filtra por estado. Sin esto, trae todos.' },
      { nombre: 'limite', tipo: 'number', entero: true, minimo: 1, maximo: 200, descripcion: 'Cuántos devolver como máximo (default 50). La respuesta dice cuántos quedaron afuera.' },
    ],
    salida: 'json', canales: CANALES_TODOS, costo: 'gratis', gating: TAB_ADMIN,
  },
  {
    id: 'ficha_experimento', area: 'experimentos', tipo: 'lectura',
    titulo: 'Ficha de un experimento',
    descripcion: 'Trae un experimento completo por id: hipótesis, cambio probado, métrica (con su unidad), dirección, criterio de éxito, ventana, fechas de inicio y fin, baseline guardado y, si cerró, veredicto, resultado y aprendizaje. Úsalo cuando ya tienes el id y necesitas el detalle. No mide en vivo: en un experimento activo el baseline guardado es el de la ventana completa y NO el que se compara mientras corre; ese número sale de medicion_experimento.',
    parametros: [ID_EXPERIMENTO],
    salida: 'json', canales: CANALES_TODOS, costo: 'gratis', gating: TAB_ADMIN,
  },
  {
    id: 'vista_experimentos', area: 'experimentos', tipo: 'lectura',
    titulo: 'Tablero de experimentos en vivo',
    descripcion: 'La vista de la tab Experiments: los ACTIVOS con medición en vivo contra el dato real (baseline comparable, valor actual, delta %, si va en la dirección de éxito, días corridos de total), los propuestos sin arrancar, los cerrados con su veredicto y los descartados, con contadores. Úsalo para «¿cómo van mis experimentos?». Es más lenta que listar_experimentos: mide cada activo por tramos. No trae la serie por tramo (para eso, medicion_experimento).',
    parametros: [],
    salida: 'json', canales: CANALES_TODOS, costo: 'gratis', gating: TAB_ADMIN, lenta: true,
  },
  {
    id: 'medicion_experimento', area: 'experimentos', tipo: 'lectura',
    titulo: 'Medición de un experimento',
    descripcion: 'Cuánto se movió la métrica de UN experimento respecto de su baseline comparable (mismo largo de días que lleva corrido, inmediatamente antes del inicio): valor actual, baseline, delta %, si va en la dirección de éxito, serie por tramo y las ventanas de fechas usadas. Úsalo para «¿va bien el experimento X?» y antes de proponer cerrarlo. En un activo mide en vivo; en un cerrado devuelve lo que quedó guardado al cierre. Un propuesto o un descartado no tiene medición.',
    parametros: [ID_EXPERIMENTO],
    salida: 'json', canales: CANALES_TODOS, costo: 'gratis', gating: TAB_ADMIN, lenta: true,
  },
  {
    id: 'listar_conclusiones_experimentos', area: 'experimentos', tipo: 'lectura',
    titulo: 'Conclusiones: las verdades del negocio',
    descripcion: 'Los experimentos CERRADOS con su veredicto (validada / refutada / no_concluyente), el aprendizaje redactado con el número adentro, baseline y resultado con su unidad, y fechas. Es la tab Conclusions. Úsalo para «¿qué ya probamos?», «¿qué se refutó?» o «¿qué quedó no concluyente y valdría reintentar?». A diferencia de estado_experimentos, incluye TODOS los veredictos.',
    parametros: [
      { nombre: 'veredicto', tipo: 'string', enum: ['validada', 'refutada', 'no_concluyente'], descripcion: 'Filtra por veredicto. Sin esto, trae todos los cerrados.' },
      { nombre: 'limite', tipo: 'number', entero: true, minimo: 1, maximo: 200, descripcion: 'Cuántos devolver como máximo (default 50). La respuesta dice cuántos quedaron afuera.' },
    ],
    salida: 'json', canales: CANALES_TODOS, costo: 'gratis', gating: TAB_ADMIN,
  },
  {
    id: 'catalogo_metricas_experimento', area: 'experimentos', tipo: 'lectura',
    titulo: 'Catálogo de métricas medibles',
    descripcion: 'Las 17 métricas del funnel que un experimento puede usar como termómetro: key exacta, nombre, unidad (usd / pct / num), dirección natural de mejora y cómo se calcula. Úsalo antes de crear un experimento para elegir una key válida. Todas miden el funnel GLOBAL de la cuenta, no un anuncio ni una campaña, y el catálogo no sabe si la fuente de cada una está conectada (vsl_views o cierres pueden no medirse nunca). No requiere parámetros.',
    parametros: [],
    salida: 'json', canales: CANALES_TODOS, costo: 'gratis', gating: TAB,
  },
  {
    id: 'snapshot_funnel_experimentos', area: 'experimentos', tipo: 'lectura',
    titulo: 'Foto del funnel en las 17 métricas',
    descripcion: 'Texto compacto con el valor de cada métrica del catálogo en los últimos N días completos (default 30), con la ventana de fechas dicha. Es el encuadre numérico que MaKo usa para sugerir e idear experimentos. Úsalo para dar contexto rápido antes de proponer una hipótesis. Si la fuente falla devuelve «sin datos» sin distinguir fuente desconectada de fuente caída; un «—» es un valor que no se pudo calcular, no un cero.',
    parametros: [{ nombre: 'dias', tipo: 'number', entero: true, minimo: 1, maximo: 365, descripcion: 'Largo de la ventana en días completos, terminando ayer (default 30).', ejemplo: 30 }],
    salida: 'texto', canales: CANALES_TODOS, costo: 'gratis', gating: TAB_ADMIN,
  },
  {
    id: 'sugerir_experimento', area: 'experimentos', tipo: 'lectura',
    titulo: 'Convertir una hipótesis en experimento',
    descripcion: 'MaKo toma una hipótesis en lenguaje natural (y, opcional, por qué se cree) y devuelve una PROPUESTA estructurada: título, cambio concreto a probar, métrica del catálogo, dirección, objetivo numérico, criterio de éxito, ventana en días, presupuesto y racional. NO guarda nada: para crearlo, pasa esa propuesta a crear_experimento. Úsalo cuando la persona dice «creo que si cambio X mejora Y» y quiere probarlo. Invoca un modelo y tarda.',
    parametros: [
      { nombre: 'hipotesis', tipo: 'string', obligatorio: true, max: 1000, descripcion: 'La apuesta en una o dos frases («si cambio X, mejora Y»).', ejemplo: 'Si acorto el formulario a 3 campos, baja el costo por formulario' },
      { nombre: 'contexto', tipo: 'string', max: 2000, descripcion: 'Lo que la persona vio o por qué lo cree. Se pasa como contexto, sin darlo por hecho.' },
    ],
    salida: 'json', canales: ['whatsapp', 'app'], costo: 'ia', gating: TAB_ADMIN, lenta: true,
  },
  {
    id: 'idear_experimentos', area: 'experimentos', tipo: 'lectura',
    titulo: 'MaKo propone experimentos',
    descripcion: 'MaKo mira la foto del funnel de los últimos 30 días y lo que ya está corriendo o propuesto, y devuelve entre 1 y 5 hipótesis testeables con la misma forma que una propuesta (métrica, dirección, ventana, criterio de éxito). NO guarda nada: la persona elige cuáles crear con crear_experimento. Úsalo cuando preguntan «¿qué debería probar?» o «¿dónde está la palanca?». Invoca un modelo y tarda.',
    parametros: [{ nombre: 'n', tipo: 'number', entero: true, minimo: 1, maximo: 5, descripcion: 'Cuántas ideas (default 3).', ejemplo: 3 }],
    salida: 'json', canales: ['whatsapp', 'app'], costo: 'ia', gating: TAB_ADMIN, lenta: true,
  },

  // ── Lecturas: Retro ────────────────────────────────────────────────────────
  {
    id: 'listar_retros', area: 'experimentos', tipo: 'lectura',
    titulo: 'Listar las retrospectivas corridas',
    descripcion: 'Las Retros del negocio, más recientes primero: id, cuándo se corrió, qué período analizó, título-tesis, resumen, el dato duro destacado (con delta vs el período anterior) y si tiene reporte v3 con plan (cuántos items y cuántos aceptados). Úsalo para «¿cuándo fue la última Retro?», «¿qué decía?» o para ubicar el id antes de leer su plan. Sin el reporte completo (para eso, ficha_retro).',
    parametros: [{ nombre: 'limite', tipo: 'number', entero: true, minimo: 1, maximo: 50, descripcion: 'Cuántas devolver como máximo (default 10). La respuesta dice cuántas quedaron afuera.' }],
    salida: 'json', canales: CANALES_TODOS, costo: 'gratis', gating: TAB_ADMIN,
  },
  {
    id: 'ficha_retro', area: 'experimentos', tipo: 'lectura',
    titulo: 'Reporte completo de una Retro',
    descripcion: 'El reporte v3 de una Retro por id: tesis, fuga en plata, semáforo por área, hallazgos con su evidencia medida, plan priorizado (con el estado que le dio la persona a cada item), seguimiento de la Retro anterior, cobertura de datos (huecos de medición) y si la fase de verificación de números se salteó por tiempo. Úsalo para leer o resumir una Retro concreta. En una Retro vieja sin reporte v3 devuelve título, resumen, destacados y recomendaciones. Omite los gráficos.',
    parametros: [ID_RETRO],
    salida: 'json', canales: ['whatsapp', 'app'], costo: 'gratis', gating: TAB_ADMIN,
  },
  {
    id: 'plan_retro', area: 'experimentos', tipo: 'lectura',
    titulo: 'Plan de una Retro y su estado',
    descripcion: 'Solo el plan de una Retro: cada item con su itemId, tipo (experimento o tarea), título, por qué, impacto estimado, de qué hallazgo nace, la cadena de tareas para poder probarlo, el spec del experimento, y el estado que le dio la persona (aceptada con experimento_id / tarea_id, pospuesta, descartada con motivo, o sin tocar). Úsalo para «¿qué me propuso la Retro?» y para obtener el itemId antes de aceptar, posponer, descartar o deshacer. Para saber si lo aceptado se HIZO, seguimiento_ultima_retro.',
    parametros: [ID_RETRO],
    salida: 'json', canales: CANALES_TODOS, costo: 'gratis', gating: TAB_ADMIN,
  },
  {
    id: 'seguimiento_ultima_retro', area: 'experimentos', tipo: 'lectura',
    titulo: 'Rendición de cuentas de la última Retro',
    descripcion: 'Para cada item del plan de la última Retro con reporte v3, qué pasó DE VERDAD mirando el experimento real (cerrado = hecho) y la tarea real del tablero: Hecho / Hecha, En curso (experimento midiendo), Empezada (tarea con avance), Aceptada y sin tocar, Aceptada pero no está en el tablero, Pospuesta, Descartada o Sin tocar; más el resumen de deuda (total aceptado, hechas, en curso, sin tocar, pendientes). Regla: aceptar no es hacer. Úsalo para «¿cumplí lo de la Retro?». Ojo: si la lectura falla por dentro también devuelve vacío. No requiere parámetros.',
    parametros: [],
    salida: 'json', canales: CANALES_TODOS, costo: 'gratis', gating: TAB_ADMIN,
  },
  {
    id: 'estado_gate_retro', area: 'experimentos', tipo: 'lectura',
    titulo: 'Si el Perro deja correr una Retro',
    descripcion: 'Evalúa la deuda de la última Retro (aceptado vs hecho) y dice si el gate del Perro Guardián BLOQUEA una Retro nueva, en qué modo está (gate / disposicion / off), qué títulos quedaron pendientes y hace cuántos días se corrió la anterior. Úsalo antes de sugerir correr una Retro (se corre desde la tab Experiments, no desde aquí). No bloquea sin Retro previa, sin plan, o si no se aceptó nada. Ojo: si la lectura del seguimiento falla por dentro también da «no bloquea»; en ese caso la salida trae `advertencia` y no hay que afirmarlo como un hecho. No requiere parámetros.',
    parametros: [],
    salida: 'json', canales: CANALES_TODOS, costo: 'gratis', gating: TAB_ADMIN,
  },
  {
    id: 'destacados_periodo_retro', area: 'experimentos', tipo: 'lectura',
    titulo: 'Dato duro de un período',
    descripcion: 'Las 7 métricas destacadas de un período (inversión, formularios, costo por formulario, agendas, costo por agenda, cierres, CAC) con su valor, el del período anterior de igual largo y el delta %, más el valor crudo de las 17 métricas del catálogo. Es el bloque «dato duro» de la Retro, calculado por código sin IA. Úsalo para un resumen numérico honesto de un rango de fechas sin correr una Retro. Un «—» o null es un valor que no se pudo calcular, no un cero. Si «hasta» es hoy o posterior se recorta a ayer y la salida lo dice en `hasta_ajustado`. Tarda con rangos largos.',
    parametros: [FECHA('desde', 'Inicio del período'), FECHA('hasta', 'Fin del período; usa ayer como máximo, hoy está incompleto')],
    salida: 'json', canales: CANALES_TODOS, costo: 'gratis', gating: TAB_ADMIN, lenta: true,
  },
  {
    id: 'cobertura_datos_retro', area: 'experimentos', tipo: 'lectura',
    titulo: 'Huecos de medición del negocio',
    descripcion: 'Qué fuentes o métricas faltan para que una Retro pueda opinar sobre un período (p. ej. nutrición sin secuencias activas, VSL sin medir, cobranza sin cargar), con la acción sugerida. Es la auditoría de cobertura de la Retro, sin IA, pero consulta todas las fuentes del negocio en paralelo y tarda. Si hay una Retro reciente, ficha_retro trae la cobertura guardada sin recalcular. Úsalo para «¿qué me falta conectar para que la Retro sirva?».',
    parametros: [FECHA('desde', 'Inicio del período'), FECHA('hasta', 'Fin del período')],
    salida: 'json', canales: CANALES_TODOS, costo: 'gratis', gating: TAB_ADMIN, lenta: true,
  },

  // ── Acciones: experimentos (chat) ──────────────────────────────────────────
  {
    id: 'iniciar_experimento', area: 'experimentos', tipo: 'accion',
    titulo: 'Arrancar un experimento propuesto',
    descripcion: 'Pasa un experimento «propuesto» a ACTIVO: fecha de inicio hoy, fin = hoy + ventana − 1, y mide el baseline de la métrica en la ventana de igual largo previa. Úsalo cuando la persona dice «arranca el experimento X» sobre uno guardado sin arrancar. Solo sobre estado «propuesto»: uno activo, cerrado o descartado se rechaza (no hay «volver a propuesto»; el camino atrás de un activo es descartarlo). Queda pendiente hasta que la persona confirme.',
    parametros: [ID_EXPERIMENTO],
    confirmacion: 'chat', reversible: false,
    escribe: 'actualiza experimentos: estado=activo, fecha_inicio, fecha_fin y baseline_*',
    canales: CANALES_TODOS, costo: 'gratis', gating: TAB_ADMIN,
  },
  {
    id: 'cerrar_experimento', area: 'experimentos', tipo: 'accion',
    titulo: 'Cerrar un experimento con veredicto',
    descripcion: 'Mide el resultado de un experimento ACTIVO (la métrica desde el inicio hasta el último día completo vs el baseline comparable) y MaKo dicta el veredicto (validada / refutada / no_concluyente) y redacta el aprendizaje con el número adentro. El experimento pasa a «cerrado» y, si se valida, su aprendizaje entra a las verdades que MaKo cita en todo el producto. Úsalo cuando venció la ventana o la persona pide cerrarlo antes; muestra antes la medición (medicion_experimento). Al proponer ya muestra baseline, valor actual, delta y días corridos, y avisa si cierra antes de que termine la ventana. Irreversible: no existe reabrir ni editar el veredicto. Al confirmar vuelve a medir e invoca un modelo.',
    parametros: [ID_EXPERIMENTO],
    confirmacion: 'chat', reversible: false,
    escribe: 'actualiza experimentos: estado=cerrado, veredicto, aprendizaje, resultado_valor, baseline comparable, cerrado_at y config.serie_cierre',
    canales: CANALES_TODOS, costo: 'ia', gating: TAB_ADMIN, lenta: true,
  },
  {
    id: 'descartar_experimento', area: 'experimentos', tipo: 'accion',
    titulo: 'Descartar un experimento',
    descripcion: 'Marca un experimento propuesto o activo como «descartado»: se abandona sin veredicto y sale del tablero, sin borrar la fila. Úsalo cuando la persona dice «olvida ese experimento» o la hipótesis dejó de tener sentido. No hay «restaurar». Sobre uno ya cerrado se rechaza (una verdad no se descarta).',
    parametros: [ID_EXPERIMENTO],
    confirmacion: 'chat', reversible: false,
    escribe: 'actualiza experimentos: estado=descartado',
    canales: CANALES_TODOS, costo: 'gratis', gating: TAB_ADMIN,
  },

  // ── Acciones: plan de la Retro (chat) ──────────────────────────────────────
  {
    id: 'aceptar_item_plan_retro', area: 'experimentos', tipo: 'accion',
    titulo: 'Aceptar un item del plan',
    descripcion: 'Acepta un item del plan de una Retro. Si es un experimento, lo CREA y lo ARRANCA hoy (baseline medido) con el spec que MaKo ya redactó, y crea en el tablero las tareas de su cadena «para poder probarlo» con la prioridad que les pone el Perro Guardián. Si es una tarea, la crea en el tablero con origen «retro». Re-aceptar reusa lo creado (y se rechaza si el experimento que se había creado ya no existe o está descartado). Úsalo cuando la persona dice «dale, haz la 2 del plan»; muestra antes el item (plan_retro). Si hay que aceptar varios, propón y confirma uno por vez: dos cambios simultáneos sobre la misma Retro se pisan, y si pasa la confirmación contesta que no se aplicó y qué quedó creado. Al confirmar puede invocar un modelo.',
    parametros: [ID_RETRO, ITEM_PLAN],
    confirmacion: 'chat', reversible: false,
    escribe: 'inserta en experimentos (activo, con baseline) y en experimento_tareas, y actualiza retros.reporte (estado del item)',
    canales: CANALES_TODOS, costo: 'ia', gating: TAB_ADMIN, lenta: true,
  },
  {
    id: 'posponer_item_plan_retro', area: 'experimentos', tipo: 'accion',
    titulo: 'Posponer un item del plan',
    descripcion: 'Marca un item del plan de una Retro como «pospuesta»: queda registrado que la persona decidió no hacerlo ahora y NO cuenta como deuda para el gate del Perro. Si el item ya estaba aceptado, lo que se creó sigue existiendo. Úsalo cuando dice «eso más adelante». Se deshace con deshacer_item_plan_retro. Ojo: un item aceptado y pospuesto deja de contar como deuda para el gate del Perro aunque el experimento siga corriendo; no lo uses para destrabar el gate. Si el item cambió desde que se propuso, la confirmación no se aplica.',
    parametros: [ID_RETRO, ITEM_PLAN],
    confirmacion: 'chat', reversible: true,
    escribe: 'actualiza retros.reporte (estado del item = pospuesta)',
    canales: CANALES_TODOS, costo: 'gratis', gating: TAB_ADMIN,
  },
  {
    id: 'descartar_item_plan_retro', area: 'experimentos', tipo: 'accion',
    titulo: 'Descartar un item del plan',
    descripcion: 'Marca un item del plan de una Retro como «descartada» con un motivo corto (máximo 60 caracteres). No cuenta como deuda para el gate y el motivo lo lee la memoria de la próxima Retro. Úsalo cuando la persona rechaza la propuesta y dice por qué. Se deshace con deshacer_item_plan_retro. Ojo: un item aceptado y descartado deja de contar como deuda para el gate del Perro aunque el experimento siga corriendo; no lo uses para destrabar el gate. Si el item cambió desde que se propuso, la confirmación no se aplica.',
    parametros: [ID_RETRO, ITEM_PLAN, { nombre: 'motivo', tipo: 'string', max: 60, descripcion: 'Por qué se descarta, en pocas palabras (sin esto queda «sin motivo»).', ejemplo: 'ya lo probamos en junio' }],
    confirmacion: 'chat', reversible: true,
    escribe: 'actualiza retros.reporte (estado del item = descartada, con motivo)',
    canales: CANALES_TODOS, costo: 'gratis', gating: TAB_ADMIN,
  },
  {
    id: 'deshacer_item_plan_retro', area: 'experimentos', tipo: 'accion',
    titulo: 'Deshacer la decisión sobre un item',
    descripcion: 'Borra el estado (aceptada / pospuesta / descartada) de un item del plan para volverlo a «sin tocar». Si la aceptación ya creó un experimento o tareas, QUEDAN creados (re-aceptar reusa el experimento, no duplica). Úsalo para corregir un «sí» equivocado. Ojo: un item aceptado y deshecho deja de contar como deuda para el gate del Perro aunque el experimento siga corriendo; no lo uses para destrabar el gate.',
    parametros: [ID_RETRO, ITEM_PLAN],
    confirmacion: 'chat', reversible: true,
    escribe: 'actualiza retros.reporte (quita el estado del item)',
    canales: CANALES_TODOS, costo: 'gratis', gating: TAB_ADMIN,
  },

  // ── Acciones: pantalla ─────────────────────────────────────────────────────
  {
    id: 'crear_experimento', area: 'experimentos', tipo: 'accion',
    titulo: 'Crear un experimento',
    descripcion: 'Propone crear un experimento con hipótesis, cambio a probar, métrica del catálogo, dirección de éxito, ventana de medición (3 a 90 días) y, opcional, objetivo, criterio de éxito y presupuesto informativo. La persona lo revisa, lo corrige y lo confirma en una pantalla de MaKo. Con arrancar=true (default) queda ACTIVO desde hoy con el baseline medido en la ventana previa; con arrancar=false queda «propuesto» para iniciarlo después. Flujo recomendado: sugerir_experimento, la persona revisa, y crear_experimento con esa propuesta. La métrica es una key de catalogo_metricas_experimento y mide el funnel global de la cuenta. No se puede borrar: se abandona con descartar_experimento y la fila queda.',
    parametros: [
      { nombre: 'titulo', tipo: 'string', obligatorio: true, max: 120, descripcion: 'Título corto del experimento.', ejemplo: 'Formulario de 3 campos' },
      { nombre: 'hipotesis', tipo: 'string', obligatorio: true, max: 1000, descripcion: 'La apuesta en una frase.', ejemplo: 'Si acorto el formulario, baja el costo por formulario' },
      { nombre: 'metrica', tipo: 'string', obligatorio: true, enum: METRICA_KEYS, descripcion: 'Key exacta de la métrica del catálogo que se va a medir.', ejemplo: 'cp_form' },
      { nombre: 'direccion', tipo: 'string', obligatorio: true, enum: ['subir', 'bajar'], descripcion: 'Qué cuenta como éxito: que la métrica suba o que baje.', ejemplo: 'bajar' },
      { nombre: 'ventana_dias', tipo: 'number', obligatorio: true, entero: true, minimo: 3, maximo: 90, descripcion: 'Días de medición.', ejemplo: 14 },
      { nombre: 'cambio', tipo: 'string', max: 1000, descripcion: 'La intervención concreta que se va a hacer.' },
      { nombre: 'objetivo_valor', tipo: 'number', descripcion: 'Objetivo numérico en la unidad de la métrica (USD, % o cantidad, según el catálogo).' },
      { nombre: 'criterio_exito', tipo: 'string', max: 500, descripcion: 'Qué cuenta como éxito, en una frase.' },
      { nombre: 'presupuesto_usd', tipo: 'number', minimo: 0, descripcion: 'Presupuesto informativo en USD. No mueve dinero ni toca campañas.' },
      { nombre: 'racional', tipo: 'string', max: 1000, descripcion: 'Por qué esta métrica y esta ventana.' },
      { nombre: 'origen', tipo: 'string', enum: ['mako', 'manual'], descripcion: 'Quién lo propuso (default mako).' },
      { nombre: 'arrancar', tipo: 'boolean', descripcion: 'true (default): queda activo hoy con baseline medido. false: queda propuesto, sin fechas.' },
    ],
    confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    escribe: 'inserta una fila en experimentos; si arranca, fija fecha_inicio, fecha_fin y el baseline medido en la ventana previa',
    canales: CANALES_TODOS, costo: 'gratis', gating: TAB_ADMIN,
  },
  {
    id: 'borrar_retro', area: 'experimentos', tipo: 'accion',
    titulo: 'Eliminar una retrospectiva',
    descripcion: 'Propone borrar definitivamente una Retro (su reporte, plan y hallazgos); un administrador lo confirma en una pantalla de MaKo. Los experimentos y tareas creados desde su plan sobreviven. Úsalo solo si la persona lo pide con todas las letras: una Retro cuesta minutos y varias llamadas de IA, y borrar la última cambia la memoria y el gate de la siguiente (la anterior pasa a ser «la última» o, si no hay, el gate deja de bloquear).',
    parametros: [{ nombre: 'retroId', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: 'id numérico de la Retro a borrar (sale de listar_retros).', ejemplo: 3 }],
    confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    escribe: 'borra la fila de retros',
    canales: CANALES_TODOS, costo: 'gratis', gating: TAB_ADMIN,
  },
];
