// =============================================================================
// disenos-partes — las TARJETAS de cada hoja con diseño propio, como BLOQUES de la grilla (6/11/2026)
// =============================================================================
// Martín, 6/11/2026: «Los dashboard puede que estén, pero se rompen todos en la vista de EDICIÓN y hay algunos que los botones
// no son funcionales. Haz que todo sea funcional y editable… Y quiero que todos los bloques nuevos se conviertan en bloques
// utilizables». Hasta ese día una hoja copiada (Closing ← Halden, Marketing ← Kestrel…) se MIRABA con su diseño entero
// (`Hoja.diseno`) y se EDITABA en otra pantalla: la grilla de siempre, con los gráficos de los que el diseño lee. Desde ese día
// cada tarjeta del diseño es un elemento de la grilla (`Elemento.diseno`): se ve igual mirando y editando, y se elige, se mueve,
// se agranda, se configura y se borra como cualquier pieza. Y se inserta en CUALQUIER hoja (el menú «Insertar», «Bloques»).
//
// Este módulo es el CATÁLOGO: qué tarjetas tiene cada diseño, cómo se llaman, de qué piezas leen y dónde caen en la grilla de
// 12 columnas (medido dibujando el diseño entero al ancho del lienzo: docs/relevo/nube-dashboards.md, «Edición»). Y la
// MIGRACIÓN de una hoja guardada con su diseño entero (`conBloquesDeDiseno`), que corre al leerla (`sanearHoja`).
//
// ⚠️ SIN `server-only` y sin importar VALORES de lib/graficos-catalogo.ts (que importa éste): sólo tipos.
// ⚠️ EL ID DE UNA PARTE ES UNA CLAVE que guardan las hojas: no se renombra. Un diseño que todavía no tiene sus partes
//    (`partes: []`) no se migra: sigue con su diseño entero mirando y la grilla editando.
// ⚠️ LA MIGRACIÓN NO BORRA NADA: lo que la hoja tenía va, tal cual, a la sección plegada «Todas las piezas», abajo de los
//    bloques. Es lo que antes se veía con «Ver todo en la grilla», y de ahí siguen leyendo los bloques.
// =============================================================================

import type { Componente, DisenoHoja, Elemento } from './graficos-catalogo';

export type DisenoId = DisenoHoja['id'];

/** Una tarjeta de un diseño. `lee`: las piezas (`Hoja.diseno.piezas`) de las que sale lo que dibuja. x/y/w/h, en la grilla. */
export type ParteDiseno = {
  id: string; nombre: string; lee: readonly string[]; x: number; y: number; w: number; h: number;
  /**
   * Una tarjeta que el diseño dibuja SÓLO con un dato que no siempre llega (`HechosDeLaHoja`): mirando sin él, el bloque no ocupa
   * lugar (la grilla sube lo de abajo). Editando se ve, con lo que es, para poder moverlo o borrarlo.
   */
  soloSi?: keyof HechosDeLaHoja;
};
/** Lo que una tarjeta puede necesitar para dibujarse y no viene de sus piezas. Lo arma la pantalla. */
export type HechosDeLaHoja = { contacto: boolean; general: boolean };

/** Un diseño: su nombre en la biblioteca, la plantilla de la que salen sus piezas, en qué informe vive y sus tarjetas. */
export type InfoDiseno = { nombre: string; plantilla: string; informe: 'dashboard' | 'general'; partes: readonly ParteDiseno[] };

const p = (id: string, nombre: string, lee: readonly string[], x: number, y: number, w: number, h: number, soloSi?: keyof HechosDeLaHoja): ParteDiseno =>
  ({ id, nombre, lee, x, y, w, h, ...(soloSi ? { soloSi } : {}) });

export const DISENOS: Readonly<Record<DisenoId, InfoDiseno>> = {
  closing: {
    nombre: 'Closing', plantilla: 'closing', informe: 'dashboard',
    partes: [
      p('cabecera', 'Título y agenda', [], 0, 0, 12, 2),
      p('tasa', 'Tasa de cierre', ['tasa', 'embudo', 'analizadas', 'puntaje', 'desenlace'], 0, 2, 7, 6),
      p('desenlace', 'Cómo terminaron', ['desenlace'], 7, 2, 5, 6),
      p('semana', 'Llamadas de esta semana', ['semana'], 0, 8, 5, 6),
      p('ultimas', 'Últimas llamadas', ['ultimas'], 5, 8, 4, 6),
      p('proxima', 'Próxima llamada', [], 9, 8, 3, 6),
      p('closers', 'Tasa de cierre por closer', ['closers'], 0, 14, 5, 5),
      p('ia', 'Qué decide tus cierres', ['ia'], 5, 14, 4, 5),
      p('duracion', 'Duración promedio', ['duracion', 'analizadas'], 9, 14, 3, 5),
      p('contacto', 'Primer contacto', [], 0, 19, 12, 9, 'contacto'),
    ],
  },
  cobranza: {
    nombre: 'Cobranza', plantilla: 'cobranza', informe: 'dashboard',
    partes: [
      p('cabecera', 'Título y período', [], 0, 0, 12, 3),
      p('deben', 'Te deben', ['atraso'], 0, 3, 6, 7),
      p('kpis', 'Los cuatro números', ['cobrado', 'vence', 'falta', 'demora'], 6, 3, 6, 7),
      p('meses', 'Lo que vencía cada mes', ['meses'], 0, 10, 8, 9),
      p('perseguir', 'A quién perseguir', ['perseguir'], 8, 10, 4, 9),
      p('ultimos', 'Lo último que entró', ['ultimos'], 0, 19, 4, 11),
      p('pagaron', 'Los que más pagaron', ['pagaron'], 4, 19, 4, 11),
      p('funnel', 'Pendiente por funnel', ['funnel'], 8, 19, 4, 11),
    ],
  },
  foco: {
    nombre: 'Focus', plantilla: 'foco', informe: 'general',
    partes: [
      p('cabecera', 'Título y resumen', [], 0, 0, 12, 4, 'general'),
      p('hoy', 'Hoy', [], 0, 4, 4, 9, 'general'),
      p('viene', 'Lo que viene', [], 4, 4, 4, 9, 'general'),
      p('meta', 'La meta', [], 8, 4, 4, 9, 'general'),
      p('tareas', 'Mis tareas', [], 0, 13, 5, 13, 'general'),
      p('semana', 'La semana', [], 5, 13, 7, 13, 'general'),
      p('proyectos', 'Proyectos', [], 0, 26, 7, 10, 'general'),
      p('espera', 'Te está esperando', [], 7, 26, 5, 10, 'general'),
    ],
  },
  'mi-dia': {
    nombre: 'Mi día', plantilla: 'mi-dia', informe: 'general',
    partes: [
      p('cabecera', 'Saludo y agenda', [], 0, 0, 9, 8, 'general'),
      p('llamada', 'Preparar llamada', [], 0, 8, 4, 3, 'general'),
      p('pregunta', 'Preguntarle a MaKo', [], 4, 8, 4, 3, 'general'),
      p('numeros', 'Los cuatro números', [], 0, 11, 9, 4, 'general'),
      p('accesos', 'Accesos', [], 0, 15, 9, 5, 'general'),
      p('vence', 'Lo que vence', [], 0, 20, 4, 9, 'general'),
      p('funnel', 'Tu funnel hoy', [], 4, 20, 4, 9, 'general'),
      p('okrs', 'Cómo vas con tus OKRs', [], 0, 29, 9, 7, 'general'),
      p('deben', 'Los que te deben', [], 0, 36, 4, 7, 'general'),
      p('semaforo', 'El semáforo', [], 4, 36, 4, 7, 'general'),
      p('mes', 'El mes', [], 9, 0, 3, 8, 'general'),
      p('dia', 'Tu día', [], 9, 8, 3, 8, 'general'),
      p('recordatorios', 'Recordatorios', [], 9, 16, 3, 9, 'general'),
    ],
  },
  general: {
    nombre: 'General', plantilla: 'general', informe: 'general',
    partes: [
      p('cabecera', 'Título y resumen', [], 0, 0, 12, 3, 'general'),
      p('mes', 'Este mes', [], 0, 3, 5, 14, 'general'),
      p('flujo', 'Entró e invertiste', ['meses'], 5, 3, 7, 14, 'general'),
      p('necesita', 'Te necesita', [], 0, 17, 4, 13, 'general'),
      p('vence', 'Lo que vence', [], 4, 17, 4, 13, 'general'),
      p('deben', 'Te deben', ['deben'], 8, 17, 4, 13, 'general'),
      p('funnel', 'Tu funnel hoy', [], 0, 30, 4, 8, 'general'),
      p('llamadas', 'Próximas llamadas', [], 4, 30, 4, 8, 'general'),
      p('salud', 'Salud del negocio', [], 8, 30, 4, 8, 'general'),
    ],
  },
  operacion: {
    nombre: 'Operación diaria', plantilla: 'operacion', informe: 'general',
    partes: [
      p('cabecera', 'Título y resumen', [], 0, 0, 12, 3, 'general'),
      p('numeros', 'Los cuatro números', ['agendas', 'pendiente', 'cierres', 'cobrado'], 0, 3, 12, 3, 'general'),
      p('mesames', 'Mes a mes', ['meses'], 0, 6, 8, 10, 'general'),
      p('espera', 'Te está esperando', [], 8, 6, 4, 10, 'general'),
      p('funnel', 'Tu funnel hoy', [], 0, 16, 4, 10, 'general'),
      p('llamadas', 'Llamadas que vienen', [], 4, 16, 4, 10, 'general'),
      p('deben', 'Te deben', ['deben'], 8, 16, 4, 10, 'general'),
      p('tildar', 'Para tildar hoy', [], 0, 26, 4, 10, 'general'),
      p('salud', 'Salud del negocio', [], 4, 26, 4, 10, 'general'),
      p('meta', 'Meta del trimestre', [], 8, 26, 4, 10, 'general'),
    ],
  },
  comercial: {
    nombre: 'Comercial', plantilla: 'comercial', informe: 'dashboard',
    partes: [
      p('cabecera', 'Saludo y frase', ['apertura', 'plata', 'costo'], 0, 0, 12, 3),
      p('vendido', 'Lo vendido', ['plata', 'apertura'], 0, 3, 8, 9),
      p('motivos', 'Por qué no se cerró', ['motivos'], 8, 3, 4, 14),
      p('tasa-cierre', 'Tasa de cierre', ['tasa', 'apertura'], 0, 12, 2, 5),
      p('ticket', 'Ticket promedio', ['ticket'], 2, 12, 2, 5),
      p('ciclo', 'Días hasta el cierre', ['ciclo'], 4, 12, 2, 5),
      p('costo', 'Costo por cierre', ['costo'], 6, 12, 2, 5),
      p('ventas', 'Ventas por período', ['semanas', 'meses'], 0, 17, 8, 9),
      p('embudo', 'De agenda a cierre', ['embudo', 'motivos'], 8, 17, 4, 9),
      p('hoy', 'Llamadas de hoy', [], 0, 26, 4, 8),
      p('origen', 'De dónde vienen', ['origen', 'tasa'], 4, 26, 5, 8),
      p('closers', 'Quién cierra', ['closers', 'tasa'], 9, 26, 3, 8),
    ],
  },
  marketing: {
    nombre: 'Marketing', plantilla: 'marketing', informe: 'dashboard',
    partes: [
      p('cabecera', 'Título y período', ['apertura'], 0, 0, 12, 3),
      p('kpis', 'Los seis números', ['cpa', 'roas', 'agendas', 'gasto', 'ctr', 'cpl'], 0, 3, 9, 3),
      p('tendencias', 'Tendencias', ['tendencias'], 0, 6, 9, 8),
      p('tabla', 'Por anuncio y campaña', ['anuncios', 'campanas', 'tendencias'], 0, 14, 9, 15),
      p('pauta', 'Lo que trae la pauta', ['funnel', 'anuncios'], 9, 3, 3, 14),
      p('redes', 'Qué red trae agendas', ['plataforma'], 9, 17, 3, 10),
    ],
  },
  landing: {
    nombre: 'Landing', plantilla: 'landing', informe: 'dashboard',
    partes: [
      p('cabecera', 'Saludo y visitas de hoy', ['visitas'], 0, 0, 12, 2),
      p('barra', 'Período y frase', ['apertura'], 0, 2, 12, 2),
      p('visitas', 'Visitas', ['apertura', 'visitas'], 0, 4, 3, 4),
      p('mitad', 'Llegan a la mitad', ['mitad', 'scroll'], 3, 4, 3, 4),
      p('final', 'Llegan al final', ['final', 'scroll'], 6, 4, 3, 4),
      p('tocan', 'Tocan un botón', ['tocan'], 9, 4, 3, 4),
      p('puntaje', 'Puntaje de la página', ['puntaje', 'diagnostico'], 0, 8, 4, 8),
      p('columnas', 'Visitas por día', ['visitas'], 4, 8, 8, 8),
      p('cuando', 'Cuándo entran', ['cuando'], 0, 16, 7, 6),
      p('origen', 'De dónde llegan', ['origen'], 7, 16, 5, 6),
    ],
  },
  chat: {
    nombre: 'Chat Analyst', plantilla: 'chat-analyst', informe: 'dashboard',
    partes: [
      p('cabecera', 'Título y período', ['apertura'], 0, 0, 12, 2),
      p('recibidos', 'Mensajes recibidos', ['recibidos', 'chats', 'dias'], 0, 2, 4, 12),
      p('respondidos', 'Respondidos', ['apertura', 'esperando'], 4, 2, 4, 4),
      p('rapidos', 'En menos de 15 min', ['rapidos', 'apertura'], 8, 2, 4, 4),
      p('tiempo', 'Tiempo de respuesta', ['mediana', 'lento'], 4, 6, 4, 7),
      p('enviados', 'Mensajes enviados', ['dias'], 8, 6, 4, 7),
      p('por-dia', 'Por día', ['respondidos'], 0, 14, 8, 17),
      p('tipos', 'Por tipo', ['tipos'], 8, 13, 4, 8),
      p('setters', 'Por setter', ['setters'], 8, 21, 4, 9),
    ],
  },
  automatizaciones: {
    nombre: 'Automatizaciones', plantilla: 'automatizaciones', informe: 'dashboard',
    partes: [
      p('cabecera', 'Título y período', ['apertura'], 0, 0, 12, 3),
      p('pulso', 'El pulso', ['apertura', 'respuesta', 'entraron', 'recorrido', 'dias'], 0, 3, 8, 14),
      p('recorrido', 'El recorrido', ['recorrido', 'tabla', 'horas'], 8, 3, 4, 14),
      p('fallos', 'Dónde falló', ['fallos', 'tabla'], 0, 17, 4, 11),
      p('confiable', 'Qué tan bien salen', ['vol', 'fal'], 4, 17, 4, 11),
      p('pregunta', 'Pregúntale a MaKo', [], 8, 17, 4, 11),
      p('mas-mandan', 'Las que más mandan', ['tabla', 'vol', 'fal'], 0, 28, 8, 12),
      p('horas', 'Horas de respuesta', ['horas'], 8, 28, 4, 12),
    ],
  },
  cs: {
    nombre: 'CS Analyst', plantilla: 'cs-analyst', informe: 'dashboard',
    partes: [
      p('cabecera', 'Título y cartera', ['apertura', 'sesiones'], 0, 0, 12, 2),
      p('cartera', 'La cartera por etapa', ['carriles', 'etapas', 'tabla'], 0, 2, 12, 13),
      p('motivos', 'Por qué piden atención', ['motivos', 'senal'], 0, 15, 6, 7),
      p('salud', 'Cómo está la cartera', ['contacto', 'bajas', 'apertura'], 6, 15, 6, 7),
    ],
  },
  productividad: {
    nombre: 'Productividad', plantilla: 'productividad', informe: 'dashboard',
    partes: [
      p('cabecera', 'Título y tablero', ['apertura'], 0, 0, 12, 2),
      p('tarjetas', 'Las cuatro tarjetas', ['avance', 'estancadas', 'alta', 'cumplimiento'], 0, 2, 12, 4),
      p('semanas', 'Lo que vence', ['vence'], 0, 6, 6, 7),
      p('quieta', 'Lo más quieto', ['huele'], 6, 6, 3, 7),
      p('huele-mal', 'Lo que huele mal', ['huele'], 0, 13, 5, 7),
      p('tareas', 'Tus tareas', ['apertura'], 5, 13, 4, 7),
      p('proyectos', 'Proyectos', ['proyectos'], 9, 6, 3, 9),
      p('prioridad', 'Activas por prioridad', ['piramide'], 9, 15, 3, 5),
    ],
  },
  contenido: {
    nombre: 'Contenido e IA', plantilla: 'ia-contenido', informe: 'dashboard',
    partes: [
      p('cabecera', 'Título y período', ['apertura'], 0, 0, 12, 3),
      p('costo', 'Costo de la IA', ['costo'], 0, 3, 3, 5),
      p('llamada', 'Costo por llamada', ['prom'], 3, 3, 3, 5),
      p('bien', 'Salieron bien', ['listos', 'pedidos', 'flow'], 6, 3, 3, 5),
      p('pedidos', 'Pedidos a Flow', ['pedidos', 'flow'], 9, 3, 3, 5),
      p('gasto', 'Lo gastado por día', ['dias'], 0, 8, 8, 11),
      p('flow', 'Videos e imágenes', ['flow'], 8, 8, 4, 11),
      p('modelos', 'Qué modelo cuesta más', ['modelos'], 0, 19, 4, 9),
      p('funciones', 'Para qué se usa', ['funciones'], 4, 19, 4, 9),
      p('quien', 'Quién le escribe', ['quien'], 8, 19, 4, 9),
    ],
  },
  curso: {
    nombre: 'Curso o comunidad', plantilla: 'curso', informe: 'general',
    partes: [
      p('cabecera', 'Título y números', ['alumnos', 'ventas', 'cobrado'], 0, 0, 12, 2),
      p('vieron', 'Clases que vieron', ['tendencia', 'semana', 'apertura'], 0, 2, 8, 9),
      p('areas', 'Por área', ['area'], 0, 11, 12, 6),
      p('avance', 'Cuánto avanzan', ['avance', 'estado', 'atencion'], 8, 2, 4, 9),
      p('necesitan', 'Quién te necesita', ['quien', 'contacto'], 0, 17, 4, 12),
      p('publicar', 'Lo que vas a publicar', [], 4, 17, 4, 12),
      p('hoy', 'Hoy', [], 8, 17, 4, 12),
    ],
  },
  servicio: {
    nombre: 'Agencia o servicio', plantilla: 'servicio', informe: 'general',
    partes: [
      p('cabecera', 'Saludo y cartera', ['apertura', 'clientes', 'etapas', 'producto', 'quien'], 0, 0, 9, 8),
      p('numeros', 'Los seis números', ['clientes', 'avanzaron', 'apertura', 'deuda', 'cobrado', 'etapas'], 0, 8, 9, 6),
      p('etapas-semana', 'Avanzaron de etapa', ['ritmo', 'avanzaron'], 0, 14, 9, 9),
      p('deben', 'Lo que te deben', ['deben', 'deudores'], 0, 23, 4, 12),
      p('necesita', 'Quién te necesita', ['quien'], 4, 23, 4, 12),
      p('atajos', 'Atajos', [], 0, 35, 9, 2),
      p('por-etapa', 'Clientes por etapa', ['etapas'], 0, 37, 4, 9),
      p('salud', 'Salud del negocio', [], 4, 37, 4, 9),
      p('vence', 'Lo que vence', [], 0, 46, 9, 10),
      p('calendario', 'Calendario', [], 9, 0, 3, 12),
      p('prioridades', 'Prioridades', [], 9, 12, 3, 10),
      p('viene', 'Lo que viene', [], 9, 22, 3, 9),
    ],
  },
  instagram: {
    nombre: 'Instagram y redes', plantilla: 'instagram', informe: 'general',
    partes: [
      p('cabecera', 'Título y números', ['apertura', 'ctr', 'gasto', 'cpm', 'plataformas'], 0, 0, 12, 3),
      p('proxima', 'Próxima publicación', [], 0, 3, 7, 15),
      p('anuncios', 'Anuncios con clientes', ['anuncios'], 7, 3, 5, 15),
      p('leads', 'Leads de tus anuncios', ['leads'], 0, 18, 7, 10),
      p('mejor', 'El que más trajo', ['anuncios'], 7, 18, 5, 10),
      p('semana', 'Esta semana', [], 0, 28, 12, 8),
      p('redes', 'Cada red', ['plataformas'], 0, 36, 4, 11),
      p('quien-ve', 'Quién te ve', ['edad', 'genero', 'region'], 4, 36, 4, 11),
      p('origen', 'De dónde llegan tus leads', ['origen'], 8, 36, 4, 11),
    ],
  },
  anuncio: {
    nombre: 'Anuncio ganador', plantilla: 'ads-analyst', informe: 'dashboard',
    partes: [
      p('cabecera', 'Título y período', [], 0, 0, 12, 2),
      p('vacia', 'Sin anuncios analizados', ['veredicto'], 0, 2, 12, 6),
      p('agendas', 'Agendas por día', ['dia'], 0, 8, 6, 6),
      p('veredictos', 'Qué hacer con cada uno', ['veredicto'], 6, 8, 3, 6),
      p('muestra', 'Con cuánta muestra', ['confianza'], 9, 8, 3, 6),
      p('ganadores', 'Qué guion rinde más', ['ganadores', 'apertura'], 0, 14, 4, 5),
      p('costos', 'Cuánto cuesta', ['cpa', 'cierre', 'sinretorno'], 4, 14, 4, 5),
      p('escalar', 'Listos para escalar', ['veredicto', 'invertido', 'apertura'], 8, 14, 4, 5),
      p('meses', 'Agendas por mes', ['meses'], 0, 19, 4, 5),
      p('semanas', 'Agendas y cierres', ['dia'], 4, 19, 4, 5),
      p('invertido', 'Lo invertido por mes', ['meses'], 8, 19, 4, 5),
      p('gancho', 'El gancho en el tiempo', ['gancho'], 0, 24, 7, 4),
      p('ganador', 'El que más agendó', ['guiones'], 7, 24, 5, 4),
    ],
  },
  hooks: {
    nombre: 'Hooks y retención', plantilla: 'hooks-retencion', informe: 'dashboard',
    partes: [
      p('cabecera', 'Título y período', ['apertura'], 0, 0, 12, 3),
      p('vacia', 'Aún sin guiones', ['guiones', 'gancho', 'video'], 0, 3, 12, 6),
      p('numeros', 'Cuánto ven tus anuncios', ['hook', 'cta', 'thruplay', 'guiones'], 0, 9, 8, 12),
      p('ganchos', 'Qué gancho retiene', ['gancho'], 8, 9, 4, 12),
      p('guiones', 'Cada guion', ['tabla'], 0, 21, 7, 11),
      p('caida', 'En qué parte se van', ['video'], 7, 21, 5, 11),
      p('avatares', 'Hook rate por avatar', ['avatar'], 0, 32, 4, 10),
      p('medidor', 'Tu gancho', ['hook', 'cta', 'thruplay'], 4, 32, 4, 10),
      p('ia', 'Qué gancho funciona', ['ia'], 8, 32, 4, 10),
    ],
  },
  vsl: {
    nombre: 'VSL y YouTube', plantilla: 'vsl-analyst', informe: 'dashboard',
    partes: [
      p('cabecera', 'Título y período', ['apertura', 'tramos'], 0, 0, 12, 4),
      p('vacia', 'Aún sin play', ['apertura', 'tramos'], 0, 4, 12, 6),
      p('play', 'Le dieron play', ['dia', 'apertura', 'vistas', 'costo', 'agendaron'], 0, 10, 5, 12),
      p('curva', 'Dónde se van', ['curva', 'final', 'dia'], 5, 10, 4, 12),
      p('videos', 'Tus videos', ['videos'], 9, 10, 3, 12),
      p('tramos', 'Los que más ven, más agendan', ['tramos', 'videos'], 0, 22, 12, 13),
      p('ultimos', 'Los últimos días', ['dia'], 0, 35, 7, 12),
      p('fugas', 'Dónde más se van', ['curva'], 7, 35, 5, 12),
      p('cien', 'De cada 100', ['dia'], 0, 47, 5, 11),
      p('ia', 'Qué dice tu video', ['ia'], 5, 47, 7, 11),
    ],
  },
  inmobiliaria: {
    nombre: 'Inmobiliaria', plantilla: 'inmobiliaria', informe: 'dashboard',
    partes: [
      p('cabecera', 'Título y período', [], 0, 0, 12, 2),
      p('numeros', 'Cuatro números', ['asistencia', 'cierre', 'ticket', 'ciclo'], 0, 8, 12, 4),
      p('vacia', 'Aún sin interesados', ['apertura'], 0, 2, 12, 6),
      p('proyectos', 'Tus proyectos', ['proyectos'], 0, 12, 12, 10),
      p('tablero', 'Interesados por etapa', ['etapa', 'tablero', 'proyectos'], 0, 22, 12, 19),
      p('origen', 'De dónde llegan', ['origen'], 0, 41, 4, 13),
      p('semanas', 'Interesados por semana', ['semanas'], 4, 41, 5, 13),
      p('asesores', 'Quién vende', ['asesores'], 9, 41, 3, 13),
      p('motivos', 'Por qué no compran', ['motivos'], 0, 54, 4, 13),
      p('medidor', 'Agendan una visita', ['apertura'], 4, 54, 4, 13),
      p('avances', 'Los que avanzan', ['tablero', 'proyectos'], 8, 54, 4, 13),
    ],
  },
  'cold-calling': {
    nombre: 'Cold Calling', plantilla: 'cold-calling', informe: 'dashboard',
    partes: [
      p('cabecera', 'Título y grabar llamada', ['llamadas', 'dias', 'agendaron', 'terminan'], 0, 0, 12, 3),
      p('vacia', 'Aún sin llamadas', ['llamadas', 'dias'], 0, 3, 12, 6),
      p('llamadas', 'Llamadas', ['llamadas', 'dias', 'agendaron', 'terminan'], 0, 9, 8, 10),
      p('siguen', 'Lo que sigue', ['terminan'], 8, 9, 4, 10),
      p('numeros', 'Cuatro números', ['contacto', 'agendaron', 'dias', 'leads', 'llamadas'], 0, 19, 12, 3),
      p('llamados', 'A quién llamaste', ['leads'], 0, 22, 5, 12),
      p('quien', 'Quién llamó', ['quien'], 5, 22, 4, 6),
      p('terminan', 'Cómo terminan', ['terminan'], 8, 28, 4, 9),
    ],
  },
};

export const partesDe = (id: string): readonly ParteDiseno[] => (DISENOS as Record<string, InfoDiseno | undefined>)[id]?.partes ?? [];
export const parteDe = (id: string, parte: string): ParteDiseno | undefined => partesDe(id).find((x) => x.id === parte);
/** ¿Este diseño ya se dibuja en bloques? (los que todavía no, siguen con su diseño entero). */
export const enBloques = (id: string): boolean => partesDe(id).length > 0;

/** El nombre de un bloque, para el panel y la biblioteca: «Tasa de cierre · Closing». */
export function nombreDeBloque(d: { id: string; parte: string }): string {
  const info = (DISENOS as Record<string, InfoDiseno | undefined>)[d.id];
  const parte = parteDe(d.id, d.parte);
  return parte && info ? `${parte.nombre} · ${info.nombre}` : 'Bloque';
}

/** ¿Se dibuja este bloque mirando? Una tarjeta que pide un dato que no llegó, no (`soloSi`). Un bloque que no es de diseño, sí. */
export function seDibujaMirando(c: Componente, hechos: HechosDeLaHoja): boolean {
  if (c.clase !== 'elemento' || c.tipo !== 'diseno' || !c.diseno) return true;
  const parte = parteDe(c.diseno.id, c.diseno.parte);
  return !parte?.soloSi || hechos[parte.soloSi];
}

/** Los ids que leen los bloques de una hoja: se piden aunque estén en una sección plegada (`pedidosDeHoja`). */
export function idsQueLeenLosBloques(componentes: readonly Componente[]): Set<string> {
  const out = new Set<string>();
  for (const c of componentes) if (c.clase === 'elemento' && c.tipo === 'diseno' && c.diseno) for (const id of Object.values(c.diseno.piezas)) out.add(id);
  return out;
}

/** El título de la sección plegada con lo que la hoja tenía: lo que antes se veía con «Ver todo en la grilla». */
export const SECCION_PIEZAS = 'Todas las piezas';

const ALTO_SECCION = 2;
const COLS = 12;

/** Un id para la tarjeta `parte` de la hoja `hojaId`: SIEMPRE el mismo (la hoja se migra al leerse, en el server y en el navegador). */
export function idDeBloque(hojaId: string, parte: string, usados: Set<string>): string {
  const base = `${hojaId.slice(0, 22)}-b-${parte}`.slice(0, 38).replace(/-+$/, '');
  let id = base, n = 2;
  while (usados.has(id)) id = `${base.slice(0, 36)}${n++}`;
  usados.add(id);
  return id;
}

function elementoBase(id: string, tipo: Elemento['tipo'], texto: string, x: number, y: number, w: number, h: number): Elemento {
  return {
    id, clase: 'elemento', tipo, texto, tamano: 'm', alinear: 'izquierda', color: null, relleno: true, url: '',
    ajuste: 'cubrir', direccion: 'derecha', grosor: 2, x, y, w, h,
  };
}

/** La sección plegada «Todas las piezas» de una hoja (la misma que deja la migración). */
export function seccionDePiezas(hojaId: string, y: number, usados: Set<string>): Elemento {
  return { ...elementoBase(idDeBloque(hojaId, 'piezas', usados), 'seccion', SECCION_PIEZAS, 0, y, COLS, ALTO_SECCION), tamano: 'l', seccion: { fondo: null, plegable: true, abierto: false } };
}

/** Un bloque del diseño `d` (su tarjeta `parte`), leyendo de `piezas`. */
export function bloqueDeDiseno(id: string, d: DisenoId, parte: ParteDiseno, piezas: Record<string, string>, y: number): Elemento {
  return { ...elementoBase(id, 'diseno', '', parte.x, y + parte.y, parte.w, parte.h), diseno: { id: d, parte: parte.id, piezas: { ...piezas } } };
}

/**
 * LA MIGRACIÓN de una hoja con su diseño ENTERO (el modelo hasta el 6/11/2026): arriba, una tarjeta del diseño por bloque, en
 * el lugar que tiene en el diseño; abajo, en una sección plegada («Todas las piezas»), todo lo que la hoja tenía, en el mismo
 * orden y con los mismos ids (de ahí leen los bloques). Nada se borra. Devuelve null si el diseño todavía no tiene sus
 * partes, si la hoja ya tiene bloques de diseño, o si con los bloques se pasaría de `max` (sigue como estaba).
 */
export function conBloquesDeDiseno(hojaId: string, componentes: readonly Componente[], diseno: Pick<DisenoHoja, 'id' | 'piezas'>, max: number): Componente[] | null {
  const partes = partesDe(diseno.id);
  if (!partes.length) return null;
  if (componentes.some((c) => c.clase === 'elemento' && c.tipo === 'diseno')) return null;
  if (componentes.length + partes.length + 1 > max) return null;
  const usados = new Set(componentes.map((c) => c.id));
  const bloques = partes.map((parte) => bloqueDeDiseno(idDeBloque(hojaId, parte.id, usados), diseno.id, parte, diseno.piezas, 0));
  const fondo = bloques.reduce((m, b) => Math.max(m, b.y + b.h), 0);
  const seccion: Elemento = {
    ...elementoBase(idDeBloque(hojaId, 'piezas', usados), 'seccion', SECCION_PIEZAS, 0, fondo, COLS, ALTO_SECCION),
    tamano: 'l', seccion: { fondo: null, plegable: true, abierto: false },
  };
  const arriba = componentes.reduce((m, c) => Math.min(m, c.y), Number.POSITIVE_INFINITY);
  const corrimiento = fondo + ALTO_SECCION - (Number.isFinite(arriba) ? arriba : 0);
  return [...bloques, seccion, ...componentes.map((c) => ({ ...c, y: c.y + corrimiento }))];
}

/** ¿Es la sección «Todas las piezas» que agregó la migración? (su id sale de `idDeBloque`, con la parte «piezas»). */
export const esSeccionDePiezas = (c: Componente): boolean =>
  c.clase === 'elemento' && c.tipo === 'seccion' && c.texto === SECCION_PIEZAS && /-b-piezas\d*$/.test(c.id);

/**
 * Lo que la hoja tenía ANTES de pasar a bloques: sin los bloques de diseño ni la sección «Todas las piezas», y con sus filas de
 * antes (la migración las corrió hacia abajo). Lo leen las guardas de que el saneo no pierde ni mueve una pieza
 * (tests/graficos-plantillas-v5.test.ts, tests/graficos-analysts.test.ts…), y es lo que se compara con lo escrito en la plantilla.
 */
export function sinBloquesDeDiseno<T extends Componente>(componentes: readonly T[]): T[] {
  const seccion = componentes.find(esSeccionDePiezas);
  const corrida = seccion ? seccion.y + seccion.h : 0;
  // Lo que está ARRIBA de «Todas las piezas» y no es un bloque también es del diseño en bloques (9/11/2026): una pieza puesta entre
  // las tarjetas, como «Cada lead nuevo» de «Velocidad de llamada». La migración deja todo lo de antes DEBAJO de la sección.
  return componentes
    .filter((c) => !(c.clase === 'elemento' && c.tipo === 'diseno') && c !== seccion && !(seccion && c.y < seccion.y))
    .map((c) => (corrida && c.y >= corrida ? { ...c, y: c.y - corrida } : c));
}

// ── La biblioteca «Bloques» del editor (6/11/2026) ──────────────────────────────────────────────────────────────────────────
// Martín: «quiero que todos los bloques nuevos se conviertan en bloques utilizables». Cualquier tarjeta de un diseño entra en
// cualquier hoja de su mismo informe (los de General leen los datos de General; los del Dashboard, sus conjuntos).

/** Los diseños que se ofrecen en la biblioteca de un informe, en el orden del catálogo. */
export const disenosDelInforme = (informe: 'dashboard' | 'general'): DisenoId[] =>
  (Object.keys(DISENOS) as DisenoId[]).filter((d) => DISENOS[d].informe === informe && DISENOS[d].partes.length > 0);

/** De dónde sacar las piezas que la hoja no tiene: la plantilla del diseño, instanciada con ids nuevos. */
export type FuenteDeBloque = { piezas: Readonly<Record<string, string>>; componentes: readonly Componente[] };
export type InsertarBloque = {
  hojaId: string;
  componentes: readonly Componente[];
  /** El diseño de la hoja (sus piezas también sirven si es el mismo). */
  diseno: Pick<DisenoHoja, 'id' | 'piezas'> | null | undefined;
  d: DisenoId;
  parte: string;
  fuente: FuenteDeBloque | null;
  max: number;
  maxIa: number;
};

const fondoDe = (cs: readonly Componente[]) => cs.reduce((m, c) => Math.max(m, c.y + c.h), 0);
const esIa = (c: Componente) => c.clase === 'elemento' && c.tipo === 'ia';

/**
 * Inserta la tarjeta `parte` del diseño `d`. Lee de las piezas que la hoja ya tiene de ese diseño (las de otro bloque suyo, o las de
 * la hoja si es su diseño); las que falten las trae de `fuente`, SÓLO las que esa tarjeta lee, plegadas en «Todas las piezas». El
 * bloque va arriba de esa sección: lo que queda debajo de una sección es de ella. Devuelve el id del bloque, o por qué no entró.
 */
export function insertarBloque(o: InsertarBloque): { componentes: Componente[]; id: string } | { error: string } {
  const parte = parteDe(o.d, o.parte);
  if (!parte) return { error: 'Ese bloque ya no existe' };
  const existe = (id: string | undefined) => !!id && o.componentes.some((c) => c.id === id);
  const piezas: Record<string, string> = {};
  if (o.diseno?.id === o.d) Object.assign(piezas, o.diseno.piezas);
  for (const c of o.componentes) if (c.clase === 'elemento' && c.tipo === 'diseno' && c.diseno?.id === o.d) Object.assign(piezas, c.diseno.piezas);
  let ias = o.componentes.filter(esIa).length;
  const traidas: Componente[] = [];
  for (const k of parte.lee) {
    if (existe(piezas[k])) continue;
    delete piezas[k];
    const id = o.fuente?.piezas[k];
    const c = id ? o.fuente!.componentes.find((x) => x.id === id) : undefined;
    if (!c) continue;
    if (!traidas.some((x) => x.id === c.id)) {
      if (esIa(c)) { if (ias >= o.maxIa) continue; ias++; }
      traidas.push(c);
    }
    piezas[k] = c.id;
  }
  const seccion = o.componentes.find(esSeccionDePiezas);
  const nueva = traidas.length > 0 && !seccion;
  if (o.componentes.length + 1 + traidas.length + (nueva ? 1 : 0) > o.max) return { error: 'La hoja ya tiene el máximo de piezas' };
  const usados = new Set(o.componentes.map((c) => c.id));
  const id = idDeBloque(o.hojaId, parte.id, usados);
  // El bloque: arriba de «Todas las piezas» (que baja lo que mide), o al final de la hoja.
  const y = seccion ? seccion.y : fondoDe(o.componentes);
  const bloque = bloqueDeDiseno(id, o.d, parte, piezas, 0);
  bloque.x = parte.x + parte.w <= COLS ? parte.x : 0;
  bloque.y = y;
  let cs: Componente[] = o.componentes.map((c) => (seccion && c.y >= y ? { ...c, y: c.y + parte.h } : c));
  cs = [...cs, bloque];
  if (traidas.length) {
    // Las piezas traídas, una debajo de la otra, justo debajo del título de la sección (lo que estaba ahí baja).
    let sec = seccion ? (cs.find((c) => c.id === seccion.id) as Elemento) : null;
    if (!sec) {
      sec = { ...elementoBase(idDeBloque(o.hojaId, 'piezas', usados), 'seccion', SECCION_PIEZAS, 0, fondoDe(cs), COLS, ALTO_SECCION), tamano: 'l', seccion: { fondo: null, plegable: true, abierto: false } };
      cs = [...cs, sec];
    }
    const desde = sec.y + sec.h;
    const alto = traidas.reduce((a, c) => a + c.h, 0);
    cs = cs.map((c) => (c.id !== sec!.id && c.id !== id && c.y >= desde ? { ...c, y: c.y + alto } : c));
    let fila = desde;
    for (const c of traidas) { cs.push({ ...c, x: 0, y: fila } as Componente); fila += c.h; }
  }
  return { componentes: cs, id };
}
