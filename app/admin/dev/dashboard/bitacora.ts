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
  {
    fecha: '11 oct', hora: '—', chat: CH, cuenta: 'claude3', actor: 'martin', tipo: 'prompt',
    titulo: 'Las dos tabs de Mauricio como estaban, y los gráficos con el diseño de antes',
    pedido: 'Quiero que personalices las 2 tabs de Mauricio como estaban en este editor, que tengan todos los graficos de antes acomodados en el mismo lugar que estaban y con el mismo diseño. Quiero que los graficos editables se parezcan más a esos que a los que me propusiste, tengan ese diseño.',
    puntos: ['«Esos» son los gráficos de las tabs viejas de Marketing y Comercial; el editor de alrededor sigue siendo el de Looker.'],
  },
  {
    fecha: '11 oct', hora: '—', chat: CH, cuenta: 'claude3', actor: 'claude', tipo: 'implementacion',
    titulo: 'El informe inicial es la réplica de Marketing y Comercial, y los gráficos son de MaKo',
    puntos: [
      'Marketing: las cuatro KPI estrella (Ad Spend con su chip contra el período anterior), la Salud del Funnel con el embudo de trapecios y sus cuatro de eficiencia, Tendencias y la tabla de anuncios. Comercial: Sold, Cash y Outstanding, A quién cobrarle, la tendencia mensual, la Salud del Funnel comercial con sus cuatro, el SCL y las cohortes mensuales y semanales.',
      'Gráficos con el diseño de las tabs viejas: el número de 44 px con su rótulo en mono, el filete de color, el subtítulo, los ejes y tooltips con los tokens de la app. En el estilo se suman Subtítulo, Filete de color arriba y Comparar con el período anterior. Tipo nuevo: Embudo vertical.',
      'Métricas nuevas para que los números sean los de antes: impresiones, clics y vistas de landing y del VSL en el resumen del negocio (con CPM, CPC y los costos por vista), no-show y el SCL (agenda → primer pago) en los leads.',
      'El informe de Mauricio (ws1) se reemplazó por la réplica: el que tenía era el inicial viejo, que el editor había guardado solo al abrirlo. Desde ahora mirar no guarda: sólo editar.',
      'No se pudo copiar «Audiencia y alcance»: se leía en vivo de Meta y no está en la base.',
    ],
    archivos: [
      'lib/graficos-catalogo.ts — la réplica (tableroInicial), las métricas y el estilo nuevo',
      'lib/graficos-datos.ts — vistas del VSL, no-show, SCL y el período anterior',
      'app/dashboard/Grafico.tsx — el diseño de MaKo y el embudo vertical',
      'app/dashboard/EditorInforme.tsx — la tarjeta, los controles nuevos y mirar sin guardar',
    ],
  },
  {
    fecha: '11 oct', hora: '—', chat: CH, cuenta: 'claude3', actor: 'martin', tipo: 'prompt',
    titulo: 'Feedback general del Dashboard: veinte puntos',
    pedido: 'FEEDBACK GENERAL: 1. El LOGO de la tab, ya lo tenemos en la sidebar, pon ese. Me refiero al que actualmente aparece arriba a la izquierda. 2. Al lado del logo no debería decir "Dashboard" allí deberían estar justamente las "tabs" que el usuario fue creando. 3. Hay un texto de "Guardado" flotando en la topbar. Elimina eso. 4. Al final de las tabs que aparecen, debería aparecer otra, tipo placeholder que diga "Nueva hoja", para crear una nueva. 5. Faltan muchas cosas que sacaste que teniamos con Mauricio. Vuelvelo a agregar... Como el filtro de fecha... Los gráficos interactivos, el gráfico de México... Etc.... En Comercial está diferente la parte de "A quién cobrarle", antes era un desplegable... Estoy seguro de que había otro dato de lo cobrado total... Y con las opciones de "Marcar como cobrada"... Sería bueno que identifiques botones de acción dentro de MaKo que podríamos usar. Y también que se pueda personalizar más las secciones, para justamente permitir en este caso como estaba antes. 6. No hay botón para eliminar una página... Debería funcionar si le doy click derecho a una página... Salir opciones, como eliminar, duplicar, cambiar nombre... Que ya aparecen en editar, pero también si no estoy editando debería aparecer los 3 puntos. 7. Al darle editar, las tabs no deberían quedar abajo de la barra con los botones de edición, siempre en el mismo lugar. 8. Para que sea mucho más fácil, no permitas editar el estilo de cada componente... En su lugar, en la topbar de edición poder editar el estilo de toda la página y que impacte a todos los componentes. Como lo tenemos en el editor de CURSOS... Que se pueda elegir color, tipografía, incluso diferentes plantillas de estilos de diseño. Eso te permite a ti ya pre-diseñar los componentes y que queden bien siempre. 9. Elimina de la sidebar la sección de "Datos", para eso ya tenemos el botón en la topbar. 10. No pongas siempre desplegada la sidebar de "Configuraciones", que si no tengo seleccionado hoy dice "Empecemos"... SImplemente si no tengo seleccionado nada que desaparezca, y que si selecciono algo que aparezca. 11. Como implementamos los 2 anteriores, la sidebar que está más a la derecha que tiene 2 botones de "Datos" y "Propiedades" desaparece, pierde sentido. 12. El botón de "Añadir control", no debería ser algo que aparezca en la tab de edición, sino que justamente es una forma de añadir filtros en la vista. Y faltan más opciones de "Añadir Control"... Y cuando agrego uno de esos, siempre configurado en el mismo lugar, como en una topbar del lienzo que se desplaza con el scroll y tiene los controles que le puse. 13. Ahora, es importante poder agregar un control a cada grafico... Por si quiero algo personalizado. Solo revisa que eso no produzca bugs. Como por ejemplo, que se pisen los filtros sin sentido. Piensa como hacerlo. 14. Ahí vi que "Control" se agrega abajo del todo... Eso está mal, siempre arriba como en una topbar. 15. Creo que estaría bueno que la topbar siempre esté por defecto, con el título y que se pueda agregar un subtitulo. E incluso un EMOJI, como lo tenemos en varios lugares. 16. Hoy en día, en la vista, el lienzo aparece como dentro de un recuadro, detrás un BG, y separado de la topbar de las pestañas... Eso no debería pasar. Todo se debe sentir como uno mismo. 17. Ten en cuenta en el diseño, que el usuario puede habilitar el darkmode y se debe adaptar los colores. 18. Faltán opciones en el editable que Looker permite... Como añadir texto, imagen, formas, flechas... 19. Al momento de crear un nuevo lienzo, replica el modal que tenemos en "Automations", en donde al principio tenemos la opción de "Pídeselo a MaKo" y abajo se le ofrece TEMPLATES... 20. Cuando termines todo... Haz el tutorial de como utilizar esta tab de "Dashboard" tal como lo tenemos en el tutorial de "CURSO", que sea como un recorrido.',
    puntos: ['Mandó una captura de la hoja Comercial en producción (hola-mako.com/dashboard?hoja=comercial) con «Dashboard» y «Guardado» arriba y una tercera hoja «Página 3».'],
  },
  {
    fecha: '11 oct', hora: '—', chat: CH, cuenta: 'claude3', actor: 'martin', tipo: 'prompt',
    titulo: 'Exportar el Dashboard a CSV o PDF',
    pedido: 'Y también agrega el botón de "Exportar" para poder exportar los datos como csv, o incluso como PDF con los gráficos bien colocados.',
    puntos: ['Llegó en medio del feedback de veinte puntos; va como el punto 21.'],
  },
  {
    fecha: '11 oct', hora: '—', chat: CH, cuenta: 'claude3', actor: 'martin', tipo: 'prompt',
    titulo: 'Las tabs de Analysts como plantillas, y el AI Analyst con CRON',
    pedido: "También: 1. Implementa como TEMPLATE, y en el caso de Mauricio, como tabs, todas las tabs de la sidebar en la sección de \"analysts\". Excepto las partes donde se ejecuta tareas, no análisis... Por ejemplo en la parte de \"Analizar nuevo guion\", esas cosas me las voy a llevar para sus respectivas tabs de \"Copy Generator\"... O la funcionalidad de analizar una web en \"Landing Analyst\"... Pero si puedes poner un template de landing con la cantidad de datos que tenemos, de clicks, retención, mapa de calor, grabaciones, etc... 2. También agrega un botón en la topbar del editable que sea \"AI Analyst\", que justamente sea MaKo analizando ese o esos gráficos... Y que se pueda configurar CRON para que lo analice cada X tiempo, o cuando se le da a actualizar análisis... Ya que en varias tabs, como \"Ads Analyst\" tenemos mucho análisis de IA de MaKo. 3. Y en este caso elimina las tabs que ya hayas puesto como tamplate de la sidebar.",
    puntos: ['Llegó en medio del feedback de veinte puntos: van como los puntos 22, 23 y 24.'],
  },
  {
    fecha: '11 oct', hora: '10:55', chat: CH, cuenta: 'claude3', actor: 'claude', tipo: 'implementacion',
    titulo: 'El Dashboard v3: los veinticuatro puntos, en producción',
    puntos: [
      'Arriba: el ícono de la tab, las hojas con «Nueva hoja» y su menú (clic derecho y ⋮ también mirando), sin «Guardado»; la barra de edición debajo, así las hojas no se mueven. Propiedades sólo con algo elegido; sin panel Datos ni riel.',
      'Estilo por PÁGINA con seis plantillas, una sola superficie y modo oscuro; cabecera con emoji, título y subtítulo; insertar texto, imagen, formas y flechas.',
      'Filtros en una barra pegada arriba del lienzo y en cada gráfico, sin pisarse: el del gráfico reemplaza al de la página en su campo. Lo elegido mirando no se guarda.',
      'Lo de Mauricio de vuelta: filtro de fecha, clic en un número para ver el detalle y «Filtrar la página por esto», el mapa de México con los nombres que manda Meta, «A quién cobrarle» desplegable con «Marcar cobrada» y el cobrado total.',
      '«Nueva hoja» con «Pídeselo a MaKo» (gratis) y plantillas; recorrido como el de Curso; Exportar a CSV y a PDF con los gráficos en su lugar.',
      'Ads Analyst, Landing, Closing y Productividad como plantillas, y como hojas del informe de Mauricio. Productivity Analyst salió de la sidebar; Ads, Landing y Closing se quedan por sus tareas.',
      'AI Analyst: MaKo lee los gráficos de la hoja (sin nombres de personas) y dice qué pasa y qué hacer, a mano o cada día, semana o mes (mig 0247).',
      'Arreglos medidos en Chrome al integrar: la barra de filtros no quedaba pegada, el AI Analyst tapaba una columna, la edad salía desordenada y la hoja Landing tardaba 51 s.',
    ],
    commits: [{ sha: '623ff3c', msg: 'Dashboard v3: hojas en la fila del logo, estilo por página, filtros pegados, Exportar, AI Analyst y las tabs de Analysts como plantillas', lineas: 18697, archivos: 88 }],
    archivos: ['app/dashboard/EditorInforme.tsx', 'lib/graficos-catalogo.ts', 'lib/graficos-plantillas-analysts.ts', 'lib/graficos-analisis-server.ts', 'supabase/migrations/0247_dashboard_analisis.sql'],
  },
  {
    fecha: '11 oct', hora: '—', chat: CH, cuenta: 'claude3', actor: 'claude', tipo: 'cosecha',
    titulo: 'Lo que dejó el v3: la barra que no pegaba, lo que Meta no da por región y la key de Gemini del ws1',
    puntos: [
      'docs/hallazgos-graficos.md reescrito con lo del v3; correcciones en hallazgos-ads (el mapa, medido), hallazgos-ia (Google le bloqueó el proyecto a la key de Gemini del ws1), hallazgos-crm («Marcar cobrada» sin guarda de rol) y hallazgos-infra (verificar con la máquina llena).',
      'AGENTS.md: un overflow que scrollea tiene que TENER alto (Pagina con flex 1 lo anula).',
    ],
  },
  {
    fecha: '11 oct', hora: '—', chat: CH, cuenta: 'claude3', actor: 'martin', tipo: 'prompt',
    titulo: 'Todo el Dashboard por la API de MaKo, y que Automations lo consuma',
    pedido: 'Revisa que todo esto se pueda consumir en la API de MaKo, absolutamente todo. Y también mandale tarea al chat de chatbot para que se pueda configurar en automations y consumir esto tambien',
    puntos: ['Dos respuestas suyas a preguntas: los closers ven sólo la hoja Closing; la API trabaja sobre el informe de la persona que se nombre (sin nombrar y con un solo informe, ése; con varios, pide elegir).'],
  },
  {
    fecha: '11 oct', hora: '—', chat: CH, cuenta: 'claude3', actor: 'martin', tipo: 'prompt',
    titulo: 'Las decisiones de la tarde: proveedores, cobranza, cohortes y las tres tabs de Analysts',
    pedido: '1. Si, siempre tiene que probar con otros provedoores.\n2. Cualquiera con acceso a esa tab.\n3. Que muestre todas y para eso tenemos filtros dentro de un elemento.\n4. Lo de ads analyst migralo a la tab de "Ads Writer" y eliminalo.\n5. Lo que Landing Analyst mandalo a Landing Generator y eliminalo.\n6. Lo de Closing puede ir completo al dashboard. Solo debes agregar el elemnto link, video o insertar embed.',
    puntos: ['1 a 3 contestan las decisiones pendientes del v3: la key de Gemini del ws1 bloqueada, la guarda de «Marcar cobrada» y las cohortes con el filtro de 30 días.'],
  },
  {
    fecha: '11 oct', hora: '—', chat: CH, cuenta: 'claude3', actor: 'martin', tipo: 'prompt',
    titulo: 'La topbar como la de Looker: las hojas en un desplegable, filtros arriba y Compartir',
    pedido: '1. Elimina todos las tabs de arriba, mejor que sea un desplegable en donde está el título grande abajo de la topbar... Que ahí sea un desplegable para elegir otra tab o en su defecto crear una nueva con el placeholder "Nueva hoja", que siempre el placeholder sea la primera opción.\n2. Elimina los 3 puntos de la derecha que tiene la opción de "Reestablecer informe" eso no tiene sentido, eliminalo.\n3. Los botones de MaKo deben ser más pequeños y sutiles, solo el logo con el fondo negro, nada más.\n4. El botón de MaKo para analizar toda la hoja y el botón de exportar que estén dentro donde hoy está los 3 puntos con "Restablecer informe". Y también el botón de tutorial allí.\n5. El emoji, el título y el subtitulo debería poder editarse ahí mismo si le doy click, no hace falta entrar a la vista de edición.\n6. Elimina el icono de dashboard de la topbar. El título pasa a ser la topbar, junto al botón de editar y los 3 puntos.\n7. Los botones de filtro también en la topbar, y mejora el diseño... Teniamos un link diseño de filtro de fecha, y ahora está muy confuso. Y que siempre esté disponible el botón de filtro con la barra de busqueda en la topbar, que siempre estén allí, solo que en edición puedo elegir agregar o quitar filtros. Y no se debería poder agregar filtros desde la vista que no sea edición.\n8. La topbar se tiene que ver igual a la de looker como en la captura. En lugar de los botones de "Archivo, vista, pagina, ayuda", ahí va el subtitulo.  El tema de formas, flechas, texto, fijate como lo posiciona Looker, que sea igual.\n9. Agrega el botón de "Compartir" que funcione exactamente igual que lo que ya tenemos en "Compartir" en la vista de CONOCIMIENTOS de SuperAdmin, que se pueda crear un link de acceso a esos graficos y también invitar por email.',
    puntos: [
      'Mandó dos capturas: el Dashboard en producción (las hojas como pestañas arriba, «AI Analyst», «Exportar», «Editar», «⋯») y la topbar de Looker Studio en edición (título «Informe sin título», debajo Archivo · Vista · Página · Ayuda; a la derecha Restablecer, Compartir ▾, Ver y ⋮; y la barra de herramientas: deshacer, rehacer, selección, zoom, Añadir página, Añadir datos, Combinar, Añadir un gráfico, Añadir un control, código, imagen, texto, línea, formas, Tema y diseño).',
      'Llegó con el uso semanal de la cuenta 3 por encima del 90%: quedó para la ventana siguiente (docs/relevo/dashboard.md).',
    ],
  },
];
