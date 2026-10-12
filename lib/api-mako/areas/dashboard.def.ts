// =============================================================================
// api-mako/areas/dashboard.def — el DASHBOARD por la API de MaKo (área `metricas`)
// =============================================================================
// Decisiones de Martín (11/10/2026), que no se re-preguntan:
//   · «TODO el Dashboard se consume por la API de MaKo»: leer lo que se puede armar, consultar datos al
//     vuelo, leer una hoja con sus números, y escribir el informe (hojas, gráficos, filtros, elementos,
//     el AI Analyst y su horario).
//   · La API trabaja sobre el informe DE LA PERSONA QUE SE NOMBRE (`persona`, su email): sin nombrar y
//     con UN solo informe guardado en la cuenta, ése; con varios, pide elegir. Sin ninguno guardado,
//     para LEER el informe inicial (dicho como tal); para ESCRIBIR, el del único admin de la cuenta, o
//     pide elegir. La resolución es UNA función pura (`elegirPersona`, dashboard.helpers.ts, con test).
//   · En una AUTOMATIZACIÓN la persona es OBLIGATORIA (nunca «el único informe»: el día que otro guarde
//     uno, el paso empezaría a fallar), y crear, borrar y restablecer NO corren en un flujo (un flujo por
//     lead crearía una hoja por cada lead). Pedido del relevo de Automations, 11/10/2026.
//
// Es el área `metricas` (AREA_INFO: «Dashboard y análisis») y un archivo aparte de metricas.def.ts: allá
// están los números del negocio de las tabs viejas, acá el EDITOR del Dashboard. El registro las junta
// (lib/api-mako/registro.ts: `metricas: [...metricas, ...dashboard]`).
//
// Las reglas que no se ven en los campos:
//   · GATING: la tab Dashboard es del admin (`requireRolWs([], { nav: 'graphics' })`), así que todas van
//     con `{ tab: 'graphics', rolMinimo: 'admin' }`. Un closer ve sólo la hoja Closing en la PANTALLA;
//     por la API no se le abre nada (Ctx.rol sólo distingue admin de miembro).
//   · NADA DEL CATÁLOGO COMO `enum` (conjuntos, tipos, períodos, temas): ataría docs/api-mako.md a
//     lib/graficos-catalogo.ts y cada conjunto nuevo movería la referencia. Se valida en el runner y el
//     error trae `disponibles`; la lista está en `ver_catalogo_dashboard`.
//   · Los NOMBRES de los parámetros son fijos en todas las operaciones (el editor de Automations arma
//     selectores por nombre): `persona`, `hoja`, `componente`, `conjunto`, `metricas`, `dimension`,
//     `periodo`.
//   · PRIVACIDAD POR HTTP (un token vive en la máquina de un tercero): los informes por persona, el detalle
//     de un número y los valores de un campo NO salen por HTTP (traen nombres de personas). Lo que sí sale
//     (datos, hojas, análisis, las cajas de Conclusiones) lleva las dimensiones de personas con ALIAS
//     («Closer 1»): la misma lista POSITIVA que el AI Analyst (`dimensionPublica`, lib/graficos-analisis.ts).
//   · v5 (12/10/2026): NO HAY BLOQUES (el saneo los convirtió en gráficos: `leer_bloque_dashboard` se fue y
//     agregar ya no acepta `bloque`). Los filtros que se GUARDAN en un gráfico son de DEFINICIÓN (no se
//     dibujan en la tarjeta) y su período es un control fijo más. Las cajas «Conclusiones de MaKo» que la API
//     lee y genera son las SUELTAS EN LA HOJA: las de un pop-up leen lo que se abre (una llamada con lo que se
//     dijo) y no las toca ningún canal de la API.
//   · ESCRIBIR ES COMPARE-AND-SET: `preparar()` fija la persona y la VERSIÓN del informe que leyó;
//     `ejecutar()` no escribe si cambió en el medio («tu informe cambió, vuelve a pedirlo»).
//
// SIN `server-only` y sin importar valores de módulos que lo tengan (AGENTS.md, regla 6 de la API).

import type { Gating, OperacionDef, Parametro } from '../tipos';

const TODOS = ['whatsapp', 'app', 'http'] as const;
/** Nombres de personas (el equipo, los leads): no salen a un token que vive en la máquina de un tercero. */
const SIN_HTTP = ['whatsapp', 'app'] as const;
const GATING: Gating = { tab: 'graphics', rolMinimo: 'admin' };

// ── Los parámetros comunes (los NOMBRES son contrato: los lee el editor de Automations) ──────────

const persona: Parametro = {
  nombre: 'persona', tipo: 'string', max: 200, rotulo: 'Persona', ejemplo: 'ana@negocio.com',
  descripcion: 'El email de la persona dueña del informe. Si falta: con un solo informe guardado en la cuenta, ése; con varios, pide elegir. En una automatización es obligatorio.',
};
const hojaObligatoria: Parametro = {
  nombre: 'hoja', tipo: 'string', obligatorio: true, max: 80, rotulo: 'Hoja', ejemplo: 'marketing',
  descripcion: 'La hoja del informe: su id (de leer_hoja_dashboard) o su nombre, como se ve en la pestaña.',
};
const componente: Parametro = {
  nombre: 'componente', tipo: 'string', obligatorio: true, max: 80, rotulo: 'Componente',
  descripcion: 'El id del gráfico o del elemento (de leer_hoja_dashboard), o su título.',
};
const conjunto = (obligatorio: boolean, extra = ''): Parametro => ({
  nombre: 'conjunto', tipo: 'string', max: 40, rotulo: 'Conjunto', ejemplo: 'leads', ...(obligatorio ? { obligatorio: true } : {}),
  descripcion: `El id del conjunto de datos (leads, meta, pagos, llamadas…; la lista en ver_catalogo_dashboard).${extra}`,
});
const metricas = (obligatorio: boolean): Parametro => ({
  nombre: 'metricas', tipo: 'string[]', max: 8, rotulo: 'Métricas', ejemplo: ['leads', 'cierres'], ...(obligatorio ? { obligatorio: true } : {}),
  descripcion: 'Los ids de las métricas del conjunto, en orden (de ver_catalogo_dashboard). Un tipo de gráfico acepta un mínimo y un máximo.',
});
const dimension: Parametro = {
  nombre: 'dimension', tipo: 'string', max: 40, rotulo: 'Dimensión', ejemplo: 'mes',
  descripcion: 'Por qué se agrupa: dia, semana, mes o una categoría del conjunto (etapa, campana, closer…). Sin esto, sólo el total; al editar, «-» la saca.',
};
const desglose: Parametro = {
  nombre: 'desglose', tipo: 'string', max: 40, rotulo: 'Desglose',
  descripcion: 'Una segunda categoría que reparte la primera métrica (columnas apiladas, tabla dinámica). Al editar, «-» lo saca.',
};
const periodo = (extra = ''): Parametro => ({
  nombre: 'periodo', tipo: 'string', max: 20, rotulo: 'Período', ejemplo: 'ult30',
  descripcion: `El período: ult7, ult30, este_mes, mes_pasado, ult12m, todo… (la lista en ver_catalogo_dashboard). Con desde y hasta, uno a medida.${extra}`,
});
const desde: Parametro = { nombre: 'desde', tipo: 'string', max: 10, rotulo: 'Desde', ejemplo: '2026-09-01', descripcion: 'Primer día de un período a medida, YYYY-MM-DD. Va junto con hasta.' };
const hasta: Parametro = { nombre: 'hasta', tipo: 'string', max: 10, rotulo: 'Hasta', ejemplo: '2026-09-30', descripcion: 'Último día de un período a medida, YYYY-MM-DD, inclusive. Va junto con desde.' };
const fecha: Parametro = {
  nombre: 'fecha', tipo: 'string', max: 40, rotulo: 'Fecha',
  descripcion: 'Cuál fecha del conjunto decide qué filas entran (en leads: alta, agenda o cierre). Sin esto, la primera del conjunto.',
};
const filtros: Parametro = {
  nombre: 'filtros', tipo: 'object[]', max: 8, rotulo: 'Filtros',
  descripcion: 'Filtros sobre categorías: cada uno con su campo y una lista de valores (o un texto que contenga).',
  campos: [
    { nombre: 'campo', tipo: 'string', obligatorio: true, max: 60, rotulo: 'Campo', descripcion: 'La categoría que se filtra: una dimensión del conjunto (etapa, campana) o un campo de ver_catalogo_dashboard.' },
    { nombre: 'valores', tipo: 'string[]', max: 50, rotulo: 'Valores', descripcion: 'Los valores que entran, escritos como los muestra el gráfico.' },
    { nombre: 'texto', tipo: 'string', max: 80, rotulo: 'Texto', descripcion: 'En vez de valores: entra lo que contenga este texto.' },
  ],
};
const titulo: Parametro = { nombre: 'titulo', tipo: 'string', max: 80, rotulo: 'Título', descripcion: 'El título que se ve arriba. Sin título, se arma solo con la métrica y la dimensión; al editar, «-» lo saca.' };
// El rótulo dice «IA» y no «MaKo»: tests/editor-acciones.test.ts frena una mayúscula pegada («aK») en un rótulo.
const mako: Parametro = { nombre: 'mako', tipo: 'boolean', rotulo: 'Botón de IA', descripcion: 'false = la tarjeta va sin el botón para preguntarle a MaKo; true lo vuelve a poner. Sin esto, como está (de entrada, prendido).' };

// ── Las operaciones ──────────────────────────────────────────────────────────────────────────

export const DEFS: readonly OperacionDef[] = [
  // ── Lecturas ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'ver_catalogo_dashboard', area: 'metricas', tipo: 'lectura',
    titulo: 'Catálogo del Dashboard',
    descripcion: 'Lo que se puede armar en el Dashboard: los conjuntos de datos con sus fechas, dimensiones y métricas, los tipos de gráfico con lo que pide cada uno, las plantillas de hoja, los estilos, los filtros, los elementos (con las acciones de un botón), los períodos y los campos para filtrar. Úsala ANTES de agregar un gráfico o consultar datos: los ids que piden las otras operaciones salen de aquí. Con `conjunto`, el detalle de ese conjunto con los nombres; con `seccion`, sólo esa parte. Por HTTP acepta ?formato=md|json.',
    parametros: [
      conjunto(false, ' Con esto, el detalle de ese conjunto.'),
      { nombre: 'seccion', tipo: 'string', rotulo: 'Sección', enum: ['conjuntos', 'tipos', 'plantillas', 'estilos', 'filtros', 'elementos', 'periodos', 'campos'], descripcion: 'Sólo esta parte del catálogo. Los campos (para filtrar) sólo salen pidiéndolos.' },
    ],
    salida: 'markdown', formatos: ['md', 'json'],
    canales: TODOS, costo: 'gratis',
    gating: GATING,
  },
  {
    id: 'consultar_datos_dashboard', area: 'metricas', tipo: 'lectura',
    titulo: 'Consultar datos del Dashboard',
    descripcion: 'Arma un gráfico al vuelo y devuelve sus números: un conjunto, sus métricas y, si quieres, una dimensión y un desglose, en un período y con filtros. Lee con las MISMAS funciones que dibuja la pantalla, así que da lo mismo que un gráfico igual del Dashboard. Úsala para cualquier pregunta sobre un número que esté en el catálogo («cuántos leads por campaña en septiembre», «el CAC por mes este año»). Un id que no existe vuelve con los `disponibles`. La pauta de Meta llega con un día de atraso: su período termina ayer. Por HTTP, las categorías con nombres de personas salen como «Closer 1» y no se puede filtrar por ellas. Por HTTP acepta ?formato=md|csv|json.',
    parametros: [
      conjunto(true), metricas(true), dimension, desglose,
      periodo(' Default: últimos 30 días.'), desde, hasta, fecha, filtros,
      { nombre: 'limite', tipo: 'number', entero: true, minimo: 3, maximo: 50, rotulo: 'Límite', descripcion: 'Cuántos grupos de una categoría se muestran (el resto se cuenta). Default 20.' },
      { nombre: 'orden', tipo: 'string', rotulo: 'Orden', enum: ['desc', 'asc'], descripcion: 'Del que más al que menos (desc, default) o al revés, por la primera métrica. El tiempo va siempre en orden.' },
      { nombre: 'comparar', tipo: 'boolean', rotulo: 'Comparar', descripcion: 'true = trae también los totales del período anterior del mismo largo.' },
    ],
    salida: 'markdown', formatos: ['md', 'csv', 'json'],
    canales: TODOS, costo: 'gratis', lenta: true,
    gating: GATING,
  },
  {
    id: 'listar_informes_dashboard', area: 'metricas', tipo: 'lectura',
    titulo: 'Informes del Dashboard por persona',
    descripcion: 'Quién tiene un informe del Dashboard guardado en la cuenta: nombre, email, sus hojas con id y nombre, y cuándo lo cambió por última vez. Si nadie guardó uno, las hojas del informe inicial que ven todos. Úsala para saber a qué `persona` apuntar antes de leer o cambiar un informe. Son personas del equipo: no sale por HTTP.',
    parametros: [],
    salida: 'markdown', formatos: ['md', 'json'],
    canales: SIN_HTTP, costo: 'gratis',
    gating: GATING,
  },
  {
    id: 'leer_hoja_dashboard', area: 'metricas', tipo: 'lectura',
    titulo: 'Leer una hoja del Dashboard',
    descripcion: 'Una hoja del informe de una persona con su configuración y sus números: la cabecera, los filtros de arriba, cada gráfico con su período, lo que lo define, sus filtros y lo que muestra (lo mismo que dibuja la pantalla al abrirla), los elementos (secciones, cajas de Conclusiones de MaKo, botones) y los conectores. Úsala para «¿qué dice mi hoja de Marketing?» o antes de cambiar un gráfico (trae los ids). El texto de una caja de Conclusiones se lee con leer_conclusiones_dashboard. En csv es el MISMO archivo que el botón Exportar. Por HTTP, las categorías con nombres de personas salen como «Cliente 1». Por HTTP acepta ?formato=md|csv|json.',
    parametros: [persona, hojaObligatoria],
    salida: 'markdown', formatos: ['md', 'csv', 'json'],
    canales: TODOS, costo: 'gratis', lenta: true,
    gating: GATING,
  },
  {
    id: 'leer_analisis_dashboard', area: 'metricas', tipo: 'lectura',
    titulo: 'Último análisis del AI Analyst',
    descripcion: 'El último análisis del AI Analyst de una hoja: el resumen, los hallazgos con su número, las recomendaciones y cuándo se hizo, si hay uno corriendo, si el último intento falló y el horario programado. Úsala después de analizar_hoja_dashboard (que corre por detrás) o para «¿qué dijo MaKo de mi hoja?». Por HTTP los nombres de personas quedan como «Closer 1». Por HTTP acepta ?formato=md|json.',
    parametros: [persona, hojaObligatoria],
    salida: 'markdown', formatos: ['md', 'json'],
    canales: TODOS, costo: 'gratis',
    gating: GATING,
  },
  {
    id: 'ver_detalle_numero_dashboard', area: 'metricas', tipo: 'lectura',
    titulo: 'Qué hay detrás de un número',
    descripcion: 'Las cosas que forman un número del Dashboard: los anuncios de un gasto, los leads de unas agendas, las cuotas de un cobro, las llamadas de un closer. Es el detalle que abre la pantalla al hacer clic. Pasa el gráfico de una hoja (`hoja` y `componente`) o uno al vuelo (`conjunto`, `metricas`, `dimension`, `periodo`), y si quieres el grupo (`valor`). Hasta 50 filas. Trae nombres de personas: no sale por HTTP.',
    parametros: [
      persona,
      { nombre: 'hoja', tipo: 'string', max: 80, rotulo: 'Hoja', descripcion: 'La hoja del gráfico (su id o su nombre). Va junto con componente.' },
      { nombre: 'componente', tipo: 'string', max: 80, rotulo: 'Componente', descripcion: 'El gráfico de la hoja (su id o su título). Sin esto, el gráfico al vuelo de conjunto y metricas.' },
      conjunto(false, ' Para un gráfico al vuelo.'), metricas(false), dimension,
      periodo(' Para un gráfico al vuelo. Default: últimos 30 días.'), desde, hasta, fecha, filtros,
      { nombre: 'metrica', tipo: 'string', max: 40, rotulo: 'Métrica', descripcion: 'Cuál métrica del gráfico se abre. Default: la primera.' },
      { nombre: 'valor', tipo: 'string', max: 120, rotulo: 'Valor', descripcion: 'El grupo: una fila del gráfico (una campaña, un closer) o una fecha (2026-10-06, 2026-10). Sin esto, el total.' },
    ],
    salida: 'markdown', formatos: ['md', 'json'],
    canales: SIN_HTTP, costo: 'gratis', lenta: true,
    gating: GATING,
  },
  {
    id: 'listar_valores_campo_dashboard', area: 'metricas', tipo: 'lectura',
    titulo: 'Valores de un campo para filtrar',
    descripcion: 'Los valores que puede tomar un campo en un período, con cuántas filas trae cada uno: para armar un filtro con los textos exactos. Lista vacía quiere decir que no llegó ningún valor (puede ser que el período no tenga filas o que la lectura no haya podido), NO que el campo no exista. Puede traer nombres (closers, clientes): no sale por HTTP.',
    parametros: [
      { nombre: 'campo', tipo: 'string', obligatorio: true, max: 60, rotulo: 'Campo', ejemplo: 'campana', descripcion: 'El campo (campana, closer, leads.etapa…; la lista en ver_catalogo_dashboard, sección campos).' },
      conjunto(false, ' Sólo los valores de ese conjunto.'),
      periodo(' Default: últimos 30 días.'), desde, hasta,
    ],
    salida: 'json', formatos: ['json', 'md'],
    canales: SIN_HTTP, costo: 'gratis', lenta: true,
    gating: GATING,
  },

  // ── Acciones: el informe de UNA persona ─────────────────────────────────────────────────────
  {
    id: 'crear_hoja_dashboard', area: 'metricas', tipo: 'accion',
    titulo: 'Crear una hoja del Dashboard',
    descripcion: 'Crea una hoja nueva en el informe del Dashboard de una persona. Tres formas: desde una plantilla (`plantilla`: marketing, comercial, closing, ads-analyst…; la lista en ver_catalogo_dashboard), en blanco (sin plantilla ni pedido), o con un `pedido` en palabras para que MaKo la arme con IA gratis («los leads por campaña y el CAC de los últimos 90 días»). Con pedido, MaKo la arma ANTES de proponerla y el resumen dice qué gráficos tiene. Devuelve el id de la hoja. No corre en una automatización.',
    parametros: [
      persona,
      { nombre: 'plantilla', tipo: 'string', max: 40, rotulo: 'Plantilla', ejemplo: 'comercial', descripcion: 'El id de una plantilla de hoja (de ver_catalogo_dashboard).' },
      { nombre: 'pedido', tipo: 'string', max: 1200, rotulo: 'Pedido', descripcion: 'Qué quiere ver, en palabras, para que MaKo arme la hoja. Usa esto O plantilla.' },
      { nombre: 'nombre', tipo: 'string', max: 40, rotulo: 'Nombre', descripcion: 'El nombre de la pestaña. Default: el de la plantilla, el que elija MaKo o «Página N».' },
    ],
    confirmacion: 'chat', reversible: true,
    escribe: 'agrega una hoja al informe guardado de esa persona (app_settings, graficos.tablero.<su id>)',
    canales: TODOS, costo: 'ia', lenta: true,
    gating: GATING,
  },
  {
    id: 'editar_hoja_dashboard', area: 'metricas', tipo: 'accion',
    titulo: 'Editar una hoja del Dashboard',
    descripcion: 'Cambia cómo se llama o se ve una hoja del Dashboard: nombre, emoji, subtítulo, estilo de la página o su lugar entre las pestañas. Sólo cambia lo que se pasa. Si ya está así, lo dice y no propone nada.',
    parametros: [
      persona, hojaObligatoria,
      { nombre: 'nombre', tipo: 'string', max: 40, rotulo: 'Nombre', descripcion: 'El nombre nuevo de la pestaña.' },
      { nombre: 'emoji', tipo: 'string', max: 16, rotulo: 'Emoji', descripcion: 'Un emoji al lado del título. «-» lo saca.' },
      { nombre: 'subtitulo', tipo: 'string', max: 140, rotulo: 'Subtítulo', descripcion: 'La línea de abajo del título. «-» la saca.' },
      { nombre: 'tema', tipo: 'string', max: 40, rotulo: 'Estilo', descripcion: 'El estilo de la página: mako, minimal, suave, contraste, elevada o editorial (la lista en ver_catalogo_dashboard).' },
      { nombre: 'posicion', tipo: 'number', entero: true, minimo: 1, maximo: 20, rotulo: 'Posición', descripcion: 'En qué lugar queda la pestaña, contando desde 1 (la primera).' },
    ],
    confirmacion: 'chat', reversible: true,
    escribe: 'cambia la cabecera, el estilo o el orden de una hoja del informe de esa persona',
    canales: TODOS, costo: 'gratis',
    gating: GATING,
  },
  {
    id: 'duplicar_hoja_dashboard', area: 'metricas', tipo: 'accion',
    titulo: 'Duplicar una hoja del Dashboard',
    descripcion: 'Copia una hoja del Dashboard con todos sus gráficos y filtros, al lado de la original. La copia se llama como la original con «(copia)». Devuelve el id de la hoja nueva.',
    parametros: [persona, hojaObligatoria],
    confirmacion: 'chat', reversible: true,
    escribe: 'agrega una copia de la hoja al informe de esa persona',
    canales: TODOS, costo: 'gratis',
    gating: GATING,
  },
  {
    id: 'borrar_hoja_dashboard', area: 'metricas', tipo: 'accion',
    titulo: 'Borrar una hoja del Dashboard',
    descripcion: 'Borra una hoja del informe del Dashboard de una persona, con sus gráficos. No se puede borrar la última hoja. Por la API no se deshace: la pantalla tiene su deshacer, la API no. No corre en una automatización.',
    parametros: [persona, hojaObligatoria],
    confirmacion: 'chat', reversible: false,
    escribe: 'saca la hoja del informe guardado de esa persona',
    canales: TODOS, costo: 'gratis',
    gating: GATING,
  },
  {
    id: 'agregar_grafico_dashboard', area: 'metricas', tipo: 'accion',
    titulo: 'Agregar un gráfico a una hoja',
    descripcion: 'Agrega un gráfico a una hoja del Dashboard: un `tipo` (tabla, serie, barras, circular, numero, tarjetas…) sobre un `conjunto` con sus `metricas` y, según el tipo, una `dimension` y un `desglose`. Los `filtros` y el período que se pasan DEFINEN el gráfico: no se dibujan en la tarjeta y quien mira no los cambia. Lo que el tipo no acepta se rechaza con los `disponibles`, nunca se corrige en silencio. Va abajo de todo, o arriba con lugar. Devuelve el id del gráfico.',
    parametros: [
      persona, hojaObligatoria,
      { nombre: 'tipo', tipo: 'string', max: 40, rotulo: 'Tipo', ejemplo: 'barras', descripcion: 'El tipo de gráfico (de ver_catalogo_dashboard). Va con conjunto y metricas.' },
      conjunto(false, ' Va con tipo.'), metricas(false), dimension, desglose, fecha,
      periodo(' Es el período PROPIO del gráfico (un filtro que lo define). «auto» o sin esto = el filtro de período de la hoja.'), desde, hasta, titulo,
      { ...filtros, descripcion: 'Los filtros que DEFINEN el gráfico («sólo R1», «sin agendas»): no se dibujan en la tarjeta y quien mira no los cambia. Uno por campo.' },
      { nombre: 'comparar', tipo: 'boolean', rotulo: 'Comparar', descripcion: 'true = muestra el cambio contra el período anterior.' },
      mako,
      { nombre: 'lugar', tipo: 'string', rotulo: 'Lugar', enum: ['abajo', 'arriba'], descripcion: 'Dónde va: abajo de todo (default) o arriba de todo.' },
    ],
    confirmacion: 'chat', reversible: true,
    escribe: 'agrega un gráfico a una hoja del informe de esa persona',
    canales: TODOS, costo: 'gratis',
    gating: GATING,
  },
  {
    id: 'editar_grafico_dashboard', area: 'metricas', tipo: 'accion',
    titulo: 'Editar un gráfico del Dashboard',
    descripcion: 'Cambia un gráfico de una hoja: título, tipo, conjunto, métricas, dimensión, desglose, período, límite, comparar, el botón de MaKo o los filtros que lo definen. Sólo cambia lo que se pasa; lo que el tipo nuevo no acepta se rechaza con los `disponibles`. Los `filtros` REEMPLAZAN los que definen el gráfico (una lista vacía los saca); los que quien mira puede mover se quedan. El estilo es de la página: se cambia con editar_hoja_dashboard.',
    parametros: [
      persona, hojaObligatoria, componente, titulo,
      { nombre: 'subtitulo', tipo: 'string', max: 80, rotulo: 'Subtítulo', descripcion: 'La línea chica de abajo. «-» la saca.' },
      { nombre: 'tipo', tipo: 'string', max: 40, rotulo: 'Tipo', descripcion: 'El tipo de gráfico nuevo (de ver_catalogo_dashboard).' },
      conjunto(false, ' Si cambia, pasa también las métricas.'), metricas(false), dimension, desglose, fecha,
      periodo(' Es el período PROPIO del gráfico (un filtro que lo define). «auto» = el filtro de período de la hoja.'), desde, hasta,
      { nombre: 'limite', tipo: 'number', entero: true, minimo: 3, maximo: 50, rotulo: 'Límite', descripcion: 'Cuántos grupos de una categoría se muestran.' },
      { nombre: 'comparar', tipo: 'boolean', rotulo: 'Comparar', descripcion: 'true = muestra el cambio contra el período anterior.' },
      mako,
      { ...filtros, vaciaEsValor: true, descripcion: 'Los filtros que DEFINEN el gráfico: no se dibujan y ganan sobre los de la hoja en el mismo campo. Reemplaza los que tenía; una lista vacía los saca.' },
    ],
    confirmacion: 'chat', reversible: true,
    escribe: 'cambia la configuración de un gráfico de una hoja del informe de esa persona',
    canales: TODOS, costo: 'gratis',
    gating: GATING,
  },
  {
    id: 'quitar_componente_dashboard', area: 'metricas', tipo: 'accion',
    titulo: 'Quitar un componente de una hoja',
    descripcion: 'Saca un gráfico o un elemento de una hoja del Dashboard, con los conectores que lo tocaban. Por la API no se deshace solo: el resumen trae su configuración para volver a agregarlo.',
    parametros: [persona, hojaObligatoria, componente],
    confirmacion: 'chat', reversible: false,
    escribe: 'saca un componente de una hoja del informe de esa persona',
    canales: TODOS, costo: 'gratis',
    gating: GATING,
  },
  {
    id: 'agregar_filtro_dashboard', area: 'metricas', tipo: 'accion',
    titulo: 'Agregar un filtro a una hoja',
    descripcion: 'Agrega un filtro a la barra de arriba de una hoja: un período, una lista de valores de un campo, una búsqueda por texto o un agrupar por día, semana o mes. Uno por cosa: un período, un agrupar y uno por campo. Lo que se elige al mirar no se guarda; esto fija lo que el filtro muestra de entrada. Devuelve el id del filtro.',
    parametros: [
      persona, hojaObligatoria,
      { nombre: 'tipo', tipo: 'string', obligatorio: true, max: 20, rotulo: 'Tipo', descripcion: 'periodo, lista (valores de un campo), texto (lo que contenga) o agrupar (día, semana o mes).' },
      { nombre: 'campo', tipo: 'string', max: 60, rotulo: 'Campo', descripcion: 'Para lista y texto: el campo (campana, closer, leads.etapa…; de ver_catalogo_dashboard, sección campos).' },
      periodo(' Para el tipo periodo.'), desde, hasta,
      { nombre: 'valores', tipo: 'string[]', max: 50, rotulo: 'Valores', descripcion: 'Para lista: los valores elegidos de entrada. Sin esto, todos.' },
      { nombre: 'texto', tipo: 'string', max: 80, rotulo: 'Texto', descripcion: 'Para texto: lo que se busca de entrada.' },
      { nombre: 'agrupar', tipo: 'string', max: 20, rotulo: 'Agrupar', descripcion: 'Para agrupar: auto, dia, semana o mes.' },
    ],
    confirmacion: 'chat', reversible: true,
    escribe: 'agrega un filtro a la barra de una hoja del informe de esa persona',
    canales: TODOS, costo: 'gratis',
    gating: GATING,
  },
  {
    id: 'quitar_filtro_dashboard', area: 'metricas', tipo: 'accion',
    titulo: 'Quitar un filtro de una hoja',
    descripcion: 'Saca un filtro de la barra de arriba de una hoja del Dashboard. Se nombra por su id (de leer_hoja_dashboard) o por su tipo y su campo.',
    parametros: [
      persona, hojaObligatoria,
      { nombre: 'filtro', tipo: 'string', max: 60, rotulo: 'Filtro', descripcion: 'El id del filtro (de leer_hoja_dashboard).' },
      { nombre: 'tipo', tipo: 'string', max: 20, rotulo: 'Tipo', descripcion: 'En vez del id: el tipo del filtro (periodo, lista, texto o agrupar).' },
      { nombre: 'campo', tipo: 'string', max: 60, rotulo: 'Campo', descripcion: 'Con tipo lista o texto: su campo.' },
    ],
    confirmacion: 'chat', reversible: true,
    escribe: 'saca un filtro de la barra de una hoja del informe de esa persona',
    canales: TODOS, costo: 'gratis',
    gating: GATING,
  },
  {
    id: 'insertar_elemento_dashboard', area: 'metricas', tipo: 'accion',
    titulo: 'Insertar un elemento en una hoja',
    descripcion: 'Inserta un elemento en una hoja del Dashboard, según los tipos de ver_catalogo_dashboard: un texto, una imagen, un enlace, un video, una página insertada, una línea o una flecha; una sección a lo ancho (agrupa lo que tiene debajo, y se puede plegar); una caja «Conclusiones de MaKo» (`ia`: lo que se le pide y qué gráficos lee; escribe cuando se la genera con generar_conclusiones_dashboard), o un botón de acción (`accion`). La ficha de una llamada o de un anuncio va sólo adentro de un pop-up y no se inserta por aquí. Una dirección sólo con https; el resumen la muestra ENTERA para que la persona la confirme, porque una dirección que pasó por un modelo puede no ser exacta. Devuelve el id del elemento.',
    parametros: [
      persona, hojaObligatoria,
      { nombre: 'tipo', tipo: 'string', obligatorio: true, max: 30, rotulo: 'Tipo', ejemplo: 'texto', descripcion: 'El tipo de elemento: texto, imagen, enlace, video, insertado, linea, flecha, seccion, ia o accion (la lista en ver_catalogo_dashboard).' },
      { nombre: 'texto', tipo: 'string', max: 2000, rotulo: 'Texto', descripcion: 'El texto (un título, una nota), lo que dice un enlace, el título de una sección o de una caja de Conclusiones, o lo que dice un botón.' },
      { nombre: 'url', tipo: 'string', max: 2000, rotulo: 'Dirección', descripcion: 'La dirección https de una imagen, un enlace, un video o una página insertada.' },
      { nombre: 'titulo', tipo: 'string', max: 80, rotulo: 'Título', descripcion: 'El título de un video o de una página insertada.' },
      { nombre: 'tamano', tipo: 'string', max: 4, rotulo: 'Tamaño', descripcion: 'El tamaño de un texto: s, m, l o xl.' },
      { nombre: 'plegable', tipo: 'boolean', rotulo: 'Se pliega', descripcion: 'Una sección: true = se puede plegar (el «Desplegable»).' },
      { nombre: 'abierto', tipo: 'boolean', rotulo: 'Abierta', descripcion: 'Una sección que se pliega: false = arranca cerrada. Default, abierta.' },
      { nombre: 'fondo', tipo: 'number', entero: true, minimo: 0, maximo: 7, rotulo: 'Fondo', descripcion: 'Una sección: el fondo del grupo, un color de la paleta de la hoja (0 a 7). Sin esto, sin fondo.' },
      { nombre: 'pedido', tipo: 'string', max: 600, rotulo: 'Qué le pides', descripcion: 'Una caja de Conclusiones: lo que MaKo tiene que mirar o contestar («qué separa a las campañas que cierran»).' },
      { nombre: 'componentes', tipo: 'string[]', max: 60, rotulo: 'Gráficos', descripcion: 'Una caja de Conclusiones: sólo estos gráficos de la hoja (sus ids o títulos). Sin esto, todos.' },
      { nombre: 'muestra', tipo: 'string', rotulo: 'Muestra', enum: ['resumen', 'hallazgos', 'recomendaciones', 'texto'], descripcion: 'Una caja de Conclusiones: qué escribe. Default resumen.' },
      { nombre: 'largo', tipo: 'string', rotulo: 'Largo', enum: ['corto', 'medio', 'largo'], descripcion: 'Una caja de Conclusiones: cuánto escribe. Default medio.' },
      { nombre: 'forma', tipo: 'string', rotulo: 'Formato', enum: ['parrafo', 'vinetas', 'tarjetas'], descripcion: 'Una caja de Conclusiones: cómo se ve. Default párrafo.' },
      { nombre: 'accion', tipo: 'string', max: 40, rotulo: 'Acción', descripcion: 'Un botón de acción: qué corre (de ver_catalogo_dashboard, sección elementos).' },
      { nombre: 'lugar', tipo: 'string', rotulo: 'Lugar', enum: ['abajo', 'arriba'], descripcion: 'Dónde va: abajo de todo (default) o arriba de todo.' },
    ],
    confirmacion: 'chat', reversible: true,
    escribe: 'agrega un elemento a una hoja del informe de esa persona',
    canales: TODOS, costo: 'gratis',
    gating: GATING,
  },
  {
    id: 'restablecer_informe_dashboard', area: 'metricas', tipo: 'accion',
    titulo: 'Restablecer el informe del Dashboard',
    descripcion: 'Vuelve el informe de una persona al inicial de MaKo, con sus dos hojas: Marketing y Comercial. Se pierden sus hojas y gráficos propios; por la API no se deshace. No corre en una automatización.',
    parametros: [persona],
    confirmacion: 'chat', reversible: false,
    escribe: 'reemplaza el informe guardado de esa persona por el inicial',
    canales: TODOS, costo: 'gratis',
    gating: GATING,
  },
  {
    id: 'analizar_hoja_dashboard', area: 'metricas', tipo: 'accion',
    titulo: 'Analizar una hoja con el AI Analyst',
    descripcion: 'Pone a MaKo a analizar los gráficos de una hoja y deja el resultado guardado. Lee lo que la hoja muestra, sin nombres de personas, y escribe un resumen, hallazgos con su número y recomendaciones, sólo con IA gratis. Corre POR DETRÁS y puede tardar más de un minuto: contesta «en curso» y el resultado se lee con leer_analisis_dashboard.',
    parametros: [
      persona, hojaObligatoria,
      { nombre: 'componentes', tipo: 'string[]', max: 60, rotulo: 'Gráficos', descripcion: 'Sólo estos gráficos (sus ids). Sin esto, todos los de la hoja.' },
    ],
    confirmacion: 'chat', reversible: false,
    escribe: 'corre el AI Analyst y guarda su resultado en dashboard_analisis (por persona y hoja)',
    canales: TODOS, costo: 'ia', lenta: true,
    gating: GATING,
  },
  {
    id: 'programar_analisis_dashboard', area: 'metricas', tipo: 'accion',
    titulo: 'Programar el análisis de una hoja',
    descripcion: 'Programa cada cuánto MaKo analiza una hoja sola: cada N días, semanas o meses, a una hora del negocio. Con unidad «apagar» se saca el horario. «Cada hora» no se puede: la IA gratis tiene un tope por día.',
    parametros: [
      persona, hojaObligatoria,
      { nombre: 'unidad', tipo: 'string', obligatorio: true, max: 20, rotulo: 'Unidad', descripcion: 'dia, semana, mes, o apagar para sacar el horario.' },
      { nombre: 'cada', tipo: 'number', entero: true, minimo: 1, maximo: 99, rotulo: 'Cada', descripcion: 'Cada cuántas unidades. Default 1.' },
      { nombre: 'hora', tipo: 'number', entero: true, minimo: 0, maximo: 23, rotulo: 'Hora', descripcion: 'La hora del negocio, 0 a 23. Default 9.' },
      { nombre: 'minuto', tipo: 'number', entero: true, minimo: 0, maximo: 59, rotulo: 'Minuto', descripcion: 'El minuto. Default 0.' },
      { nombre: 'diaSemana', tipo: 'number', entero: true, minimo: 0, maximo: 6, rotulo: 'Día semanal', descripcion: 'Con semana: 0 = domingo, 1 = lunes… Default lunes.' },
      { nombre: 'diaMes', tipo: 'number', entero: true, minimo: 1, maximo: 28, rotulo: 'Día del mes', descripcion: 'Con mes: el día, 1 a 28. Default 1.' },
      { nombre: 'componentes', tipo: 'string[]', max: 60, rotulo: 'Gráficos', descripcion: 'Sólo estos gráficos (sus ids). Sin esto, todos los de la hoja.' },
    ],
    confirmacion: 'chat', reversible: true,
    escribe: 'guarda el horario del AI Analyst de esa hoja en dashboard_analisis',
    canales: TODOS, costo: 'gratis',
    gating: GATING,
  },
  {
    id: 'cancelar_analisis_dashboard', area: 'metricas', tipo: 'accion',
    titulo: 'Cancelar el análisis en curso',
    descripcion: 'Corta el análisis de una hoja que está corriendo. El que sigue por detrás termina, pero ya no guarda su resultado; el último análisis bueno queda. Si no hay ninguno corriendo, lo dice.',
    parametros: [persona, hojaObligatoria],
    confirmacion: 'chat', reversible: true,
    escribe: 'marca como cancelada la corrida del AI Analyst de esa hoja en dashboard_analisis',
    canales: TODOS, costo: 'gratis',
    gating: GATING,
  },
  // ── v5: los conectores y las cajas «Conclusiones de MaKo» ─────────────────────────────────────
  {
    id: 'conectar_componentes_dashboard', area: 'metricas', tipo: 'accion',
    titulo: 'Unir dos componentes con una flecha',
    descripcion: 'Une dos componentes de una hoja del Dashboard (gráficos o elementos) con una flecha que los sigue cuando se mueven. No une un componente consigo mismo ni dos veces el mismo par; si ya están unidos, lo dice y no propone nada. Devuelve el id del conector.',
    parametros: [
      persona, hojaObligatoria,
      { nombre: 'origen', tipo: 'string', obligatorio: true, max: 80, rotulo: 'Desde', descripcion: 'El componente donde arranca la flecha: su id (de leer_hoja_dashboard) o su título.' },
      { nombre: 'destino', tipo: 'string', obligatorio: true, max: 80, rotulo: 'Hasta', descripcion: 'El componente donde termina la flecha: su id o su título.' },
      { nombre: 'punta', tipo: 'string', rotulo: 'Punta', enum: ['fin', 'ambas', 'ninguna'], descripcion: 'Dónde lleva punta la flecha. Default, al final.' },
      { nombre: 'trazo', tipo: 'string', rotulo: 'Trazo', enum: ['curva', 'recta', 'codo'], descripcion: 'Cómo se dibuja la línea. Default, curva.' },
    ],
    confirmacion: 'chat', reversible: true,
    escribe: 'agrega un conector a una hoja del informe de esa persona',
    canales: TODOS, costo: 'gratis',
    gating: GATING,
  },
  {
    id: 'quitar_conector_dashboard', area: 'metricas', tipo: 'accion',
    titulo: 'Quitar una flecha entre componentes',
    descripcion: 'Saca un conector de una hoja del Dashboard. Se nombra por su id (de leer_hoja_dashboard) o por los dos componentes que une.',
    parametros: [
      persona, hojaObligatoria,
      { nombre: 'conector', tipo: 'string', max: 60, rotulo: 'Conector', descripcion: 'El id del conector (de leer_hoja_dashboard).' },
      { nombre: 'origen', tipo: 'string', max: 80, rotulo: 'Desde', descripcion: 'En vez del id: uno de los dos componentes que une (su id o su título).' },
      { nombre: 'destino', tipo: 'string', max: 80, rotulo: 'Hasta', descripcion: 'En vez del id: el otro componente que une.' },
    ],
    confirmacion: 'chat', reversible: true,
    escribe: 'saca un conector de una hoja del informe de esa persona',
    canales: TODOS, costo: 'gratis',
    gating: GATING,
  },
  {
    id: 'leer_conclusiones_dashboard', area: 'metricas', tipo: 'lectura',
    titulo: 'Leer las Conclusiones de MaKo de una hoja',
    descripcion: 'Lo último que escribieron las cajas «Conclusiones de MaKo» de una hoja (o la caja que se nombre): su texto y cuándo, si hay una escribiendo, si el último intento falló y su horario. Son las cajas sueltas en la hoja; las de un pop-up leen lo que se abre (una llamada) y no salen por la API. Por HTTP los nombres de personas quedan como «Closer 1». Por HTTP acepta ?formato=md|json.',
    parametros: [
      persona, hojaObligatoria,
      { ...componente, obligatorio: false, descripcion: 'La caja: su id (de leer_hoja_dashboard) o su título. Sin esto, todas las de la hoja.' },
    ],
    salida: 'markdown', formatos: ['md', 'json'],
    canales: TODOS, costo: 'gratis',
    gating: GATING,
  },
  {
    id: 'generar_conclusiones_dashboard', area: 'metricas', tipo: 'accion',
    titulo: 'Generar las Conclusiones de MaKo',
    descripcion: 'Pone a MaKo a escribir una caja «Conclusiones de MaKo» de una hoja (el ↻ de la pantalla): lee los gráficos que la caja mira, sin nombres de personas, y escribe lo que la caja pide, sólo con IA gratis. Corre POR DETRÁS y puede tardar más de un minuto: contesta «en curso» y el texto se lee con leer_conclusiones_dashboard. Las cajas de un pop-up no se generan por aquí.',
    parametros: [persona, hojaObligatoria, { ...componente, descripcion: 'La caja: su id (de leer_hoja_dashboard) o su título.' }],
    confirmacion: 'chat', reversible: false,
    escribe: 'corre la caja de Conclusiones de MaKo y guarda su texto (por persona, hoja y caja)',
    canales: TODOS, costo: 'ia', lenta: true,
    gating: GATING,
  },
];
