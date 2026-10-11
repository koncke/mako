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
  { titulo: 'Marketing y Comercial', detalle: 'Los dos tableros de números con el filtro de fecha compartido', estado: 'hecha' },
  { titulo: 'Mis gráficos', detalle: 'Cada persona arma su informe como en Looker Studio: tipo de gráfico, fuente, dimensión y métricas', estado: 'hecha' },
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
      'app/graficos/EditorGraficos.tsx — el editor',
      'app/graficos/Grafico.tsx — cómo se dibuja cada tipo',
    ],
  },
];
