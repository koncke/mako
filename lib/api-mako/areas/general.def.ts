// =============================================================================
// api-mako/areas/general.def — las operaciones del área `general` (definiciones)
// =============================================================================
// /general es la casa del cliente: objetivos del trimestre, KPIs, capacidad
// instalada. Una entrada por operación: id, qué es, parámetros, por qué canales
// sale, cómo se confirma. SIN server-only y sin importar valores de módulos que lo
// tengan: esto lo importan los tests y el generador de la referencia. Los cuerpos
// van en general.run.ts, cruzados por id. Español neutro (lo lee el cliente).
//
// Lo que se consume en /general pero vive en otra lib (cuotas, desgloses del mes,
// salud de Meta, fatiga, tasa de cierre madura, datos sin marcar, fuentes de datos)
// NO se declara acá: lo declaran crm, metricas y ads, que es donde vive el código.
// El semáforo y la acción prioritaria tampoco: su armado vive solo en
// app/general/page.tsx y hay que extraerlo a lib antes de exponerlo.
//
// Todas llevan `tab: 'general'` y `rolMinimo: 'admin'`: es el requireRolWs([],
// {nav:'general'}) de app/general/actions.ts (closer y setter no ven General).
// =============================================================================

import type { OperacionDef, Gating } from '../tipos';
import { FUENTES_KPI, METRICA_LABEL } from '@/lib/objectives-modelo';

const GATING: Gating = { tab: 'general', rolMinimo: 'admin' };
const TODOS = ['whatsapp', 'app', 'http'] as const;
const FUENTES = FUENTES_KPI.map((f) => f.id);
const METRICAS = Object.keys(METRICA_LABEL);

export const DEFS: readonly OperacionDef[] = [
  // ── Lecturas ────────────────────────────────────────────────────────────────
  {
    id: 'leer_resumen_objetivos', area: 'general', tipo: 'lectura',
    titulo: 'Resumen de objetivos del trimestre',
    descripcion: 'El trimestre en curso en prosa lista para razonar: cada objetivo con su avance y su ritmo («al día» o «atrasado, a esta altura debería ir por X»), los KPIs en rojo ahora mismo y la capacidad instalada (solo si el cupo está declarado). Úsala ANTES de recomendar nada, para saber si el negocio va bien y qué es urgente. Si no hay objetivos cargados lo dice: eso no es un error. Un avance que no se pudo leer sale como «no pude leer», nunca como cero.',
    parametros: [],
    salida: 'texto', canales: TODOS, costo: 'gratis', gating: GATING,
  },
  {
    id: 'ver_trimestre_actual', area: 'general', tipo: 'lectura',
    titulo: 'Trimestre actual y días restantes',
    descripcion: 'En qué trimestre está el negocio HOY según su zona horaria (no la del servidor ni la de quien pregunta): fechas desde y hasta, días transcurridos, días restantes y % consumido. Úsala para contestar «¿cuánto falta para que cierre el trimestre?» o antes de crear un objetivo. No requiere parámetros.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: GATING,
  },
  {
    id: 'listar_objetivos', area: 'general', tipo: 'lectura',
    titulo: 'Objetivos con su avance real',
    descripcion: 'Los objetivos ACTIVOS de un trimestre más los ANUALES del mismo año, cada uno con su avance leído de los datos (cobrado, firmado, cierres, agendas, leads; o el avance manual si la métrica es «libre»), el % de la meta y el ritmo prorrateado linealmente. `actual: null` significa «no se pudo leer» con el motivo en `error`: NUNCA es cero. Úsala para «¿cuánto llevo del objetivo?» o para conseguir el id de un objetivo antes de editarlo o cerrarlo. Sin parámetros usa el trimestre en curso.',
    parametros: [
      { nombre: 'anio', tipo: 'number', entero: true, minimo: 2020, maximo: 2100, descripcion: 'Año del trimestre. Si se omite, el año en curso del negocio.' },
      { nombre: 'quarter', tipo: 'number', entero: true, minimo: 1, maximo: 4, descripcion: 'Trimestre 1 a 4. Si se omite, el trimestre en curso. Los objetivos anuales del año vienen siempre incluidos.' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: GATING,
  },
  {
    id: 'ver_objetivo_principal', area: 'general', tipo: 'lectura',
    titulo: 'Objetivo principal del trimestre',
    descripcion: 'El objetivo que manda en la cabecera de /general, con su avance y ritmo: primero el de cobrado del trimestre, después el de firmado, después cualquiera del trimestre y recién ahí los anuales. Úsala cuando pregunten «¿cómo va el trimestre?» sin más detalle. No tomes el primero de listar_objetivos: puede ser el del año. Devuelve `objetivo: null` si no hay ninguno.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: GATING,
  },
  {
    id: 'ver_tablero_kpis', area: 'general', tipo: 'lectura',
    titulo: 'Tablero de KPIs del período',
    descripcion: 'Cada KPI activo con su valor de HOY (cadencia diaria) o de ESTA SEMANA (lunes a domingo), su % del compromiso y su estado: verde (cumplido), ambar (ajustado), rojo (atrasado) o sin-datos (no se pudo leer la fuente, el manual todavía no se cargó, o el compromiso es 0). Viene ordenado con lo peor primero. `valor: null` NO es cero. Úsala para «¿qué KPI tengo en rojo?», «¿cuánto llevo de X esta semana?» o antes de registrar un valor manual.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: GATING,
  },
  {
    id: 'listar_kpis', area: 'general', tipo: 'lectura',
    titulo: 'Definición de los KPIs',
    descripcion: 'La configuración de los KPIs, sin valores ni colores: nombre, cadencia, compromiso, unidad, umbrales, si es automático (y de qué fuente) o manual, y de qué objetivo cuelga. Úsala para conseguir el id de un KPI antes de editarlo o apagarlo, o para ver también los apagados. Para los valores del período usa ver_tablero_kpis.',
    parametros: [
      { nombre: 'soloActivos', tipo: 'boolean', descripcion: 'true (default) solo los activos; false incluye los apagados.' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: GATING,
  },
  {
    id: 'sugerir_kpis', area: 'general', tipo: 'lectura',
    titulo: 'KPIs que sugiere MaKo',
    descripcion: 'Hasta 8 KPIs candidatos para este negocio, elegidos por las etapas reales de su funnel (si las declaró) y el cuello de su fase, con el porqué de cada uno; prefiere lo que MaKo mide solo. Es una LECTURA: no crea nada. Úsala cuando el tablero está vacío o el dueño pregunta «¿qué debería medir?». Los compromisos son valores por defecto del catálogo, no salen del histórico del negocio. Los nombres que devuelve son los que acepta sembrar_kpis_sugeridos.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: GATING,
  },
  {
    id: 'listar_fuentes_kpi', area: 'general', tipo: 'lectura',
    titulo: 'Fuentes automáticas de KPI',
    descripcion: 'El catálogo cerrado de lo que MaKo puede medir solo (inversión, agendas, leads nuevos, cierres, cobrado, firmado, llamadas analizadas, plays del VSL, contenido publicado), con su unidad y qué mide cada una. Úsala para explicar qué KPIs se llenan solos y para elegir el fuenteId de un KPI automático.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: GATING,
  },
  {
    id: 'medir_fuente_kpi', area: 'general', tipo: 'lectura',
    titulo: 'Medir una fuente en un rango',
    descripcion: 'Lee UNA fuente automática del catálogo en un rango de fechas, con la MISMA definición que usa el tablero de KPIs. Rango máximo: 366 días, salvo cash_usd y sold_usd, que admiten hasta 92 (su lectura no pagina y un rango mayor podría sumar de menos). Devuelve `valor: null` con el motivo si no pudo leer: nunca cero por error. Úsala para preguntas puntuales como «¿cuántas llamadas analizamos esta semana?» sin tener un KPI creado. Las fechas son días calendario; leads_nuevos, vsl_plays y contenido_publicado cortan los bordes del día en UTC, no en la zona del negocio (la salida lo advierte). Usa ver_trimestre_actual si necesitas el hoy.',
    parametros: [
      { nombre: 'fuenteId', tipo: 'string', obligatorio: true, enum: FUENTES, descripcion: 'id de la fuente (de listar_fuentes_kpi).' },
      { nombre: 'desde', tipo: 'string', obligatorio: true, max: 10, descripcion: 'Inicio del rango, inclusive, YYYY-MM-DD.', ejemplo: '2026-09-01' },
      { nombre: 'hasta', tipo: 'string', obligatorio: true, max: 10, descripcion: 'Fin del rango, inclusive, YYYY-MM-DD.', ejemplo: '2026-09-15' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: GATING,
    // inversion_usd pagina hasta 50 consultas seguidas en un rango largo.
    lenta: true,
  },
  {
    id: 'ver_capacidad_instalada', area: 'general', tipo: 'lectura',
    titulo: 'Capacidad instalada de clientes',
    descripcion: 'El cupo de clientes que declaró el dueño, los clientes activos contados del CRM (suscripciones dentro de plazo o indefinidas; pagos únicos dentro de la ventana de entrega) y los lugares libres. `cupo: null` = nadie lo declaró y no se afirma nada; `activos: null` con `error` = no se pudieron contar (no es cero). Úsala antes de recomendar vender más o cuando pregunten «¿puedo tomar otro cliente?».',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: GATING,
  },
  {
    id: 'medir_tramo_r1_r2', area: 'general', tipo: 'lectura',
    titulo: 'Días entre la R1 y la R2',
    descripcion: 'Promedio de días entre la Reunión 1 y la Reunión 2 de los leads con R1 en la ventana pedida (default 60 días hasta hoy) que ya tienen R2 cargada (incluye R2 agendadas a futuro: la lectura no las separa), y sobre cuántos casos. La alerta «los deals se enfrían» del semáforo salta con 3 casos o más y un promedio mayor a 10 días. Úsala para «¿estoy agendando la R2 tarde?». `promedio_dias: null` = no hubo casos, no es cero.',
    parametros: [
      { nombre: 'dias', tipo: 'number', entero: true, minimo: 7, maximo: 180, descripcion: 'Días hacia atrás desde hoy. Default 60.' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: GATING,
  },
  {
    id: 'listar_pendientes_arranque', area: 'general', tipo: 'lectura',
    titulo: 'Pasos de arranque postergados',
    descripcion: 'Los pasos de conexión que el cliente postergó en el onboarding y SIGUEN faltando hoy (se verifica la conexión real, no solo el flag), cada uno con qué falta y en qué pantalla se resuelve. Son las alertas ámbar de arranque del semáforo de /general. Úsala para recordarle qué integración le falta conectar. Lista vacía = nada pendiente.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'externo', gating: GATING,
  },

  // ── Acciones por chat ─────────────────────────────────────────────────────
  {
    id: 'registrar_valor_kpi', area: 'general', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Registrar valor de KPI manual',
    descripcion: 'Propone guardar cuánto se hizo HOY (KPI diario) o ESTA SEMANA (KPI semanal) de un KPI MANUAL ya identificado. El período lo fija el servidor con la zona horaria del negocio al proponer: no se puede cargar un período pasado. Registrar dos veces el mismo período reemplaza el valor anterior. Úsala cuando el dueño reporte «hice 5 seguimientos hoy». Pide antes el id con ver_tablero_kpis; un KPI automático no se registra (MaKo lo mide solo).',
    parametros: [
      { nombre: 'kpiId', tipo: 'string', obligatorio: true, max: 60, descripcion: 'id del KPI manual (de ver_tablero_kpis o listar_kpis).' },
      { nombre: 'valor', tipo: 'number', obligatorio: true, minimo: 0, maximo: 1000000000, descripcion: 'Cuánto se hizo en el período, en la unidad del KPI.' },
      { nombre: 'nota', tipo: 'string', max: 500, descripcion: 'Evidencia o comentario opcional.' },
    ],
    canales: TODOS, costo: 'gratis', gating: GATING,
    reversible: true,
    escribe: 'upsert en kpi_registros por (KPI, inicio del período vigente): pisa el valor anterior de ese período',
  },
  {
    id: 'cerrar_objetivo', area: 'general', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Cerrar un objetivo',
    descripcion: 'Propone cerrar un objetivo ACTIVO ya identificado: deja de listarse y de mandar en la cabecera; sus KPIs siguen colgando de él como historia. Úsala cuando el dueño diga «ese objetivo ya no va» o al cerrar el trimestre. NO se puede reabrir desde MaKo: dilo al proponerlo. Pide antes el id con listar_objetivos.',
    parametros: [
      { nombre: 'id', tipo: 'string', obligatorio: true, max: 60, descripcion: 'id del objetivo (de listar_objetivos).' },
    ],
    canales: TODOS, costo: 'gratis', gating: GATING,
    reversible: false,
    escribe: 'objectives.estado = cerrado (no borra la fila ni sus KPIs)',
  },
  {
    id: 'apagar_kpi', area: 'general', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Apagar un KPI',
    descripcion: 'Propone apagar un KPI activo ya identificado: sale del tablero y de la acción prioritaria; sus registros históricos quedan. Úsala cuando el dueño diga «ese KPI ya no lo sigo». NO se puede reactivar desde MaKo: dilo al proponerlo. Pide antes el id con listar_kpis.',
    parametros: [
      { nombre: 'id', tipo: 'string', obligatorio: true, max: 60, descripcion: 'id del KPI (de listar_kpis o ver_tablero_kpis).' },
    ],
    canales: TODOS, costo: 'gratis', gating: GATING,
    reversible: false,
    escribe: 'kpis.activo = false (no borra la fila ni sus registros)',
  },
  {
    id: 'guardar_capacidad', area: 'general', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Declarar cupo de clientes',
    descripcion: 'Propone guardar cuántos clientes puede atender el negocio a la vez (el único dato de capacidad que no se deriva) y, opcionalmente, cuántos meses ocupa un lugar un cliente de pago único (default 4). Los clientes activos se cuentan solos del CRM: no los pidas. Úsala cuando el dueño diga «puedo llevar 8 clientes». Un cupo lleno hace que MaKo diga que no puede tomar más clientes. Desde MaKo no se puede QUITAR el cupo declarado (solo cambiarlo por otro número): si el dueño quiere borrarlo, indícale que lo haga en /general.',
    parametros: [
      { nombre: 'cupo', tipo: 'number', obligatorio: true, entero: true, minimo: 1, maximo: 100000, descripcion: 'Cupo máximo de clientes activos a la vez.' },
      { nombre: 'mesesEntrega', tipo: 'number', entero: true, minimo: 1, maximo: 120, descripcion: 'Meses que un cliente de pago único ocupa un lugar. Si se omite, queda el valor actual.' },
    ],
    canales: TODOS, costo: 'gratis', gating: GATING,
    reversible: true,
    escribe: 'app_settings capacidad_cupo (y capacidad_meses_entrega si viene)',
  },

  // ── Acciones por pantalla ─────────────────────────────────────────────────
  {
    id: 'guardar_objetivo', area: 'general', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Crear o editar un objetivo',
    descripcion: 'Propone crear (sin id) o editar (con id) un objetivo del año o del trimestre: título, métrica de la que sale el número real y meta. Se revisa y confirma en pantalla porque cambia el norte del negocio (la cabecera, la acción prioritaria y los avisos). Úsala cuando el dueño diga «mi meta del trimestre es X». Para CREAR son obligatorios anio, quarter, titulo, metrica y metaValor. Para EDITAR pasa el id y SOLO los campos que cambian: lo que omitas conserva su valor actual (incluido el avance manual). Antes de crear, revisa listar_objetivos: si ya hay uno activo con la misma métrica en ese período, pasa su id para editarlo. No reabre un objetivo cerrado.',
    parametros: [
      { nombre: 'id', tipo: 'string', max: 60, descripcion: 'id del objetivo a editar (de listar_objetivos). Omitir para crear uno nuevo.' },
      { nombre: 'anio', tipo: 'number', entero: true, minimo: 2020, maximo: 2100, descripcion: 'Año del objetivo. Obligatorio al crear; al editar, omitir = queda el actual.' },
      { nombre: 'quarter', tipo: 'number', entero: true, minimo: 0, maximo: 4, descripcion: 'Trimestre 1 a 4, o 0 para un objetivo ANUAL. Obligatorio al crear; al editar, omitir = queda el actual.' },
      { nombre: 'titulo', tipo: 'string', max: 120, descripcion: 'Cómo se llama, p. ej. «Facturación del trimestre». Obligatorio al crear; al editar, omitir = queda el actual.' },
      { nombre: 'metrica', tipo: 'string', enum: METRICAS, descripcion: 'De dónde sale el número real: cash_usd (cobrado), sold_usd (firmado), cierres, agendas, leads, o libre (lo carga la persona). Obligatorio al crear; al editar, omitir = queda la actual.' },
      { nombre: 'metaValor', tipo: 'number', minimo: 0, maximo: 1000000000, descripcion: 'La meta, en USD para cash_usd y sold_usd, en cantidad para el resto. Obligatorio al crear; al editar, omitir = queda la actual.' },
      { nombre: 'avanceManual', tipo: 'number', minimo: 0, maximo: 1000000000, descripcion: 'Solo para metrica = libre: cuánto se lleva. En las demás se ignora. Al editar, omitir = queda el avance actual.' },
    ],
    canales: TODOS, costo: 'gratis', gating: GATING,
    reversible: true,
    escribe: 'upsert en objectives (crea con id nuevo o edita el existente); no toca el estado',
  },
  {
    id: 'guardar_kpi', area: 'general', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Crear o editar un KPI',
    descripcion: 'Propone crear (sin id) o editar (con id) un KPI: nombre, cadencia, compromiso por período, si lo mide MaKo (auto, con fuenteId del catálogo) o la persona (manual), umbrales y de qué objetivo cuelga. Se revisa en pantalla porque un KPI mal configurado genera una acción prioritaria falsa. Úsala cuando el dueño quiera comprometerse a algo medible («7 videos por semana»). Para CREAR son obligatorios nombre, cadencia, compromiso y fuente. Para EDITAR pasa el id y SOLO los campos que cambian: lo omitido (objetivo, unidad, umbrales, fuente) conserva su valor actual. fuenteId tiene que ser uno de listar_fuentes_kpi. No reactiva un KPI apagado.',
    parametros: [
      { nombre: 'id', tipo: 'string', max: 60, descripcion: 'id del KPI a editar (de listar_kpis). Omitir para crear uno nuevo.' },
      { nombre: 'nombre', tipo: 'string', max: 120, descripcion: 'Nombre corto del KPI. Obligatorio al crear; al editar, omitir = queda el actual.' },
      { nombre: 'cadencia', tipo: 'string', enum: ['diaria', 'semanal'], descripcion: 'Período del compromiso: por día o por semana (lunes a domingo). Obligatorio al crear.' },
      { nombre: 'compromiso', tipo: 'number', minimo: 0, maximo: 1000000000, descripcion: 'Cuánto por período. 0 deja el KPI sin configurar (nunca verde). Obligatorio al crear.' },
      { nombre: 'fuente', tipo: 'string', enum: ['auto', 'manual'], descripcion: 'auto = lo mide MaKo desde una fuente del catálogo; manual = lo registra la persona. Obligatorio al crear.' },
      { nombre: 'fuenteId', tipo: 'string', enum: FUENTES, descripcion: 'Solo si fuente = auto: id de listar_fuentes_kpi.' },
      { nombre: 'unidad', tipo: 'string', enum: ['usd', 'cantidad'], descripcion: 'Solo para KPIs manuales (en los automáticos la fija la fuente). Al crear, default cantidad; al editar, omitir = queda la actual.' },
      { nombre: 'objectiveId', tipo: 'string', max: 60, descripcion: 'id del objetivo del que cuelga (de listar_objetivos). Al crear, omitir = KPI suelto. Al editar, omitir = sigue colgando de donde estaba; «ninguno» lo descuelga a propósito.' },
      { nombre: 'umbralVerde', tipo: 'number', entero: true, minimo: 1, maximo: 200, descripcion: '% del compromiso a partir del cual es verde. Al crear, default 100; al editar, omitir = queda el actual.' },
      { nombre: 'umbralAmbar', tipo: 'number', entero: true, minimo: 1, maximo: 200, descripcion: '% del compromiso a partir del cual es ámbar; no puede superar al verde. Al crear, default 70; al editar, omitir = queda el actual.' },
    ],
    canales: TODOS, costo: 'gratis', gating: GATING,
    reversible: true,
    escribe: 'upsert en kpis (crea con id nuevo o edita el existente); no toca si está activo',
  },
  {
    id: 'sembrar_kpis_sugeridos', area: 'general', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar',
    titulo: 'Crear los KPIs sugeridos',
    descripcion: 'Propone crear de una vez varios KPIs de los que devolvió sugerir_kpis, por NOMBRE exacto: el servidor vuelve a resolver cada nombre contra la sugerencia real (no se puede inventar la fuente ni el compromiso). Se omiten los que ya existen activos con el mismo nombre. Se revisa en pantalla porque crea varias filas. Úsala cuando el dueño acepte las sugerencias («dale, esos»). Si no se indica objetivo, cuelgan del objetivo principal del trimestre.',
    parametros: [
      { nombre: 'nombres', tipo: 'string[]', obligatorio: true, max: 8, descripcion: 'Nombres EXACTOS de sugerir_kpis.' },
      { nombre: 'objectiveId', tipo: 'string', max: 60, descripcion: 'id del objetivo del que cuelgan. Omitir = el objetivo principal del trimestre (o sueltos si no hay).' },
    ],
    canales: TODOS, costo: 'gratis', gating: GATING,
    reversible: true,
    escribe: 'inserta hasta 8 filas en kpis con origen seed (se apagan una por una con apagar_kpi)',
  },
];
