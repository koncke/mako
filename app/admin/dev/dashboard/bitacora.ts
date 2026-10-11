// =============================================================================
// Dashboard — el registro de construcción de Graphics (Marketing · Comercial · Mis gráficos)
// =============================================================================
// ESTO NO ES UN CHANGELOG. El changelog está en `git log`. Acá va lo que git no guarda: qué
// pidió Martín con sus palabras y por qué se resolvió así. Lo aprendido, en
// docs/hallazgos-graficos.md.
//
// Las horas de los prompts son las del chat (no del commit); las de la implementación, las del
// commit. Se agrega AL FINAL del array (orden cronológico). La pantalla lo lee al revés.

import type { Hito, Parte } from '../_registro/tipos';

const CH = 'Graphics';

/** Las fases del área y en qué anda cada una. */
export const PARTES: Parte[] = [
  { titulo: 'El editor de informes', detalle: 'La tab entera es un Looker Studio: hojas, 40 tipos de gráfico, estilo editable y control de período', estado: 'hecha' },
  { titulo: 'Todos los datos de MaKo', detalle: '24 conjuntos en 10 áreas: negocio, marketing, CRM, comunicación, automations, plan, CS, second brain, onboarding e IA', estado: 'hecha' },
  { titulo: 'Lo que las tabs viejas tenían y el editor no', detalle: 'Cohortes, el desglose clickeable de cada número, el chat con MaKo por gráfico y los anuncios ganadores', estado: 'cola' },
  { titulo: 'Números de MaKo', detalle: 'Graphics mirando el workspace de MaKo para la ventana del 1/11 al 15/12 · espera conectar sus datos', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  {
    fecha: '10 oct', hora: '22:45', chat: 'MaKo Pricing', cuenta: 'claude3', actor: 'martin', tipo: 'prompt',
    titulo: 'Graphics para elegir los gráficos que cada uno quiera',
    pedido: 'Otra que podría estar en "Graphics" para ver los graficos más importantes, como ese gráfico de torta, pero con datos reales de cuanto es el % que se va en cada cosa... (Esto es un proyecto aparte, que justamente quiero poder personalizar los graficos para todos los usuarios, que tengan una herramienta de selector de gráficos para elegir los que quieran)... importante que sean funcionales, reales...',
    puntos: ['Llegó al chat «Graphics» como relevo del chat «MaKo Pricing», junto con la revisión del proyecto «Feature: Dashboard» del tablero.'],
  },
  {
    fecha: '10 oct', hora: '23:10', chat: CH, cuenta: 'claude3', actor: 'martin', tipo: 'prompt',
    titulo: 'Copiar Google Data Studio',
    pedido: 'No te preocupes por lo específico, ya lo voy a configurar cuando la tab esté lista... Lo que quiero ahora es poder PERSONALIZAR la tab. Poder elegir gráficos y atarle datos. Revisa como lo hacen otras apps de datos, como la de Google Data Studio. Puedes copiar la app de Google Data Studio para esto.',
    puntos: ['La torta queda para que la arme él: la pregunta de cuál torta (la de MaKo o la de cada cliente) dejó de ser una decisión previa.'],
  },
  {
    fecha: '10 oct', hora: '23:40', chat: CH, cuenta: 'claude3', actor: 'martin', tipo: 'prompt',
    titulo: 'Revisar el diseño de Looker y buscar algo hecho',
    pedido: 'Revisa el diseño que utiliza Looker... Como es el editable para copiarlo. Y también si encuentras algún proyecto de github o algo que nos pueda ahorrar tiempo, sería ideal',
    puntos: [
      'No hay un constructor de tableros embebible con licencia libre: Metabase y Grafana son AGPL y aplicaciones enteras, Superset es Python.',
      'Sí sirven las piezas: react-grid-layout (MIT) para arrastrar y agrandar, y recharts, que ya estaba. Se fijó la 2.2.4: la 2.3.0 tenía 5 días.',
    ],
  },
  {
    fecha: '11 oct', hora: '00:05', chat: CH, cuenta: 'claude3', actor: 'martin', tipo: 'prompt',
    titulo: 'Que sea igual al editor de Looker',
    pedido: 'No, no se ve igual al editor de Looker, te pido que lo hagas igual',
    puntos: [
      'Mandó una captura del editor de Looker Studio con la hoja «Add data to report» abierta.',
      'Se copió pieza por pieza: la cabecera del informe con Restablecer y Ver, la barra gris, el lienzo con la página blanca, CONFIGURACIÓN / ESTILO con las fichas verdes y azules, el panel Datos y la hoja de conectores.',
    ],
  },
  {
    fecha: '11 oct', hora: '—', chat: CH, cuenta: 'claude3', actor: 'claude', tipo: 'implementacion',
    titulo: 'Mis gráficos: el editor de informes estilo Looker Studio',
    puntos: [
      'Cada gráfico es un tipo (cuadro de resultados, serie temporal, barras, circular, tabla) atado a una fuente (Anuncios de Meta, Leads del CRM, Pagos), con su dimensión del período, una dimensión y sus métricas. Nada de SQL libre: el server valida cada gráfico contra el catálogo.',
      'El informe se guarda por persona y workspace: mirar a un cliente con ?ws= no le cambia su vista.',
      'Medido con los datos del ws1: gasto US$1.164 en 30 días, 85 leads, costo por agenda US$83,18.',
      'De paso: /marketing y /comercial ya no tiran un rango que termina después de hoy (lo acotan a hoy).',
    ],
    archivos: [
      'lib/graficos-catalogo.ts — qué se puede dibujar y con qué datos',
      'lib/graficos-agregar.ts — de filas a lo que se dibuja (puro, con test)',
      'lib/graficos-datos.ts — el lector de cada fuente',
      'lib/graficos-tablero.ts — el informe de cada persona',
    ],
  },
  {
    fecha: '11 oct', hora: '01:00', chat: CH, cuenta: 'claude3', actor: 'martin', tipo: 'prompt',
    titulo: 'El Dashboard entero es el editor, con hojas, todos los gráficos y todos los datos',
    pedido: 'Elimina las tab de Marketing y Comercial que hay por defecto... Todo la tab de Dashboard debe ser el editable, no lo pongas como un recuadro abajo. Elimina la topbar, el título de la tab, el filtro de fecha (que eso cada uno lo va a agregar si quiere...) Y justamente falta la opción de nueva "hoja" que eso sería lo que hoy es la tab de comercial y marketing. Y faltan un montón de gráficos que puedes agregar, como en la captura y más... También rediseña más simple la parte de "Agregar datos", ya que Data Studio lo hace más complicado porque tiene muchas fuentes... Pero nosotros solo tenemos la fuente de la propia app de MaKo y de todos los datos que viven dentro. También revisa que se pueda editar el estilo de cada gráfico... Porque hoy no se puede. Por último, revisa todos los datos de MaKo que se podrían poner allí... Absolutamente todos del CRM, del Second Brain, del Onboarding, de Customer Success, de todo... Para eso también tenemos una API documentada.',
    puntos: ['Mandó dos capturas de la galería «Añadir un gráfico» de Looker Studio, de la Tabla a los Embudos de conversión.'],
  },
  {
    fecha: '11 oct', hora: '—', chat: CH, cuenta: 'claude3', actor: 'claude', tipo: 'implementacion',
    titulo: 'El Dashboard como editor de informes: hojas, 40 tipos, estilo y 24 conjuntos de datos',
    puntos: [
      '/dashboard ES el editor, sin topbar ni filtro de fecha; /marketing y /comercial traen a sus hojas del informe inicial, y /graficos al Dashboard.',
      'Hojas (añadir, renombrar, duplicar, mover, eliminar), control de período como componente de la hoja, y el período de cada gráfico: «Automático» sigue al control.',
      'La galería de Looker con 40 tipos en 17 grupos: tablas, cuadros de resultados, series, columnas y barras (apiladas y al 100%), histograma, circular, combinados, áreas, dispersión, tabla dinámica, bala, rectángulos, sankey, indicadores, cascada, cronología y embudos. Faltan los mapas: no hay datos geográficos.',
      'ESTILO editable: título, colores por serie, etiquetas de datos, leyenda, ejes, cuadrícula, fondo, borde, esquinas, números compactos, objetivo y máximo.',
      '«Añadir datos» es una lista simple: la fuente es una, MaKo, con 24 conjuntos en 10 áreas medidos contra la base (21 con datos en el ws1).',
    ],
    archivos: [
      'app/dashboard/EditorInforme.tsx — el editor',
      'app/dashboard/Grafico.tsx — cómo se dibuja cada tipo',
      'lib/graficos-catalogo.ts — conjuntos, tipos, estilo, hojas y período',
      'lib/graficos-datos.ts — los 24 lectores',
    ],
  },
];
