// =============================================================================
// Ads Manager — el registro de construcción del área
// =============================================================================
// Alcance: la tab que muestra el estado VIVO de Meta cruzado con el CRM, y desde
// la que se opera (encender, pausar, presupuesto, renombrar, crear, asignar a un
// producto). Vive en app/ads-manager/ —CampanasBrowser.tsx es el 90% del área— y
// en app/api/ads-manager/.
//
// ⚠️ ESTA BITÁCORA NACIÓ EL 6/10/2026, con el área ya construida. Lo anterior está
// en docs/hallazgos-ads.md, que es largo y está ordenado por corrida; acá entra
// sólo lo que tiene un pedido textual de Martín detrás.
//
// NO es un changelog. Lo que git ya guarda no se repite: va el motivo, la trampa
// y —sobre todo— cuándo el diagnóstico obvio era el equivocado.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'Dónde vive cada acción', detalle: 'Crear arriba a la derecha · el resto en el ⋯ · un solo «Filtrar» y un «Actualizar» a la altura de las tabs · lo que opera sobre lo elegido, en la barra de la selección', estado: 'hecha' },
  { titulo: 'Un interruptor, no dos botones', detalle: 'Activar/pausar en lote es UN control de arrastre: encendido = los N están activos, y con una mezcla va apagado', estado: 'hecha' },
  { titulo: 'Las acciones en lote que faltaban', detalle: 'Presupuesto (sólo donde se edita en ESE nivel), producto, renombrar, agregar conjunto/anuncio y eliminar · con ícono Y texto', estado: 'hecha' },
  { titulo: 'Ícono del catálogo, nunca un emoji', detalle: 'Los 💲🎯🗑 de la barra, el 👥 por fila, el segundo ✎ del presupuesto, el ⓘ del chip de problemas y el 📅/📝 del modal de renombrar · con guard sobre los cuatro .tsx del área', estado: 'hecha' },
  { titulo: 'Asignar a un producto del CRM', detalle: 'Celda por fila + lote, reusando las actions del CRM · el conjunto sin producto propio dice el de SU campaña · con un solo producto la columna no se dibuja', estado: 'hecha' },
  { titulo: 'Producto MÚLTIPLE por campaña', detalle: 'Choca con que un lead tiene un solo funnel_id (lib/campana-config.ts) · las tres salidas están medidas y la decisión es de Martín', estado: 'cola' },
  { titulo: 'El presupuesto pasa por un cartel, y en la moneda de la cuenta', detalle: 'La celda y el lote preguntan «viejo → nuevo» antes de escribir · se tipea en USD y se convierte a la moneda de la cuenta (lib/presupuesto-cambio.ts) · el presupuesto total no se edita como diario · lo escrito sobrevive a la caché vencida del árbol · falta la primera prueba en una cuenta real', estado: 'hecha' },
  { titulo: 'Un video se usa cuando Meta lo procesó, y un reintento no publica dos veces', detalle: 'La tarjeta espera a Meta (los tres modales, una sola subida) · las rutas preguntan por los videos antes de crear · clave de idempotencia por payload en campaign-create, ad-add y adset-add · falta aplicar la 0215, publicar de verdad y medir un video pesado', estado: 'sigue' },
  { titulo: 'Ver y cambiar dónde se muestra un conjunto que ya corre', detalle: '«Dónde se muestra» en el detalle de un conjunto · los lugares se editan en el editor de público, con el geo tocado sólo si cambió y sólo lectura ante lo que no se entiende · los pines se leen, se ven en el mapa y se les cambia el radio · falta la primera prueba real en una campaña en pausa de Martín y decidir cómo se CREA un pin', estado: 'sigue' },
  { titulo: 'Usar un video de MaKo sin bajarlo y volverlo a subir', detalle: '«Mis creativos» en los tres modales: los anuncios montados y las tomas sueltas del bucket propio, por file_url · la url se deriva en el server, nunca viaja del navegador · falta la primera prueba en una cuenta real (Meta en ws9) y el worker de montaje; la imagen no tiene de dónde salir (#298)', estado: 'sigue' },
];

export const BITACORA: Hito[] = [
  {
    fecha: '5 oct', hora: '23:40', chat: 'Ads Manager', cuenta: 'claude1',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Rediseñar la tab entera: ocho puntos sobre dónde va cada cosa',
    pedido: '1. Elimina el texto "Estado + rendimiento · 01/10/2026 – 04/10/2026"\n2. El botón de nueva campaña debe de estar arriba a la derecha del todo, reemplazando a "Los ultimos 30 días"\n3. Más a la derecha, el icono con los 3 puntos, con la opción de "Agregar creativos a una campaña" y "Agregar conjunto a una campaña". Y dentro también las opciones del desplegable de MaKo de "Analizar con Meta" y "Ordenar nombres". Elimina ese desplegable de MaKo.\n4. A la misma altura de las tabs, bien a la derecha, debe estar el botón de filtrado, que combine las fechas, estados y columnas. Te recomiendo que copies el desplegable de filtrado que tenemos en el plan, que tiene categorias y que si abres una ahí te muestra las opciones.\n5. Rediseña la tabla, ya tenemos otros diseños de tablas más bonitos.\n6. La selección multiple: primero rediseña la topbar que aparece, ya tenemos otros diseños mas bonitos. Y luego, faltan muchas otras acciones en lote que se pueden aplicar. No solo activar y pausar o eliminar... Te recomiendo que te fijes de optimizarlo, utilizar iconos porque serán muchas... Pensas como proponer eso, porque "Activar y pausar" son dos botones que podría ser uno, como un botón de arrastre tipico de activo o pausa. Y falta por ejemplo, cambiar presupuesto, asignar a producto, etc... Y revisa que aparecen 2 botones de "Limpiar selección" eso no debería de aparecer, ni existir. Para eso copia como lo hacemos en otros lugares como el plan, que simplemente tengo un checkbox que selecciona todo y si lo vuelvo a apretar des-selecciona todo.\n7. La asignación a producto debería ser multiple, una campaña podría estar asignada a varios productos, pero hoy solo permite seleccionar 1. Y también es importante que si se asigna una campaña a un producto, automáticamente sus adset se deben asignar. Y por último, si una cuenta tiene 1 solo producto, se debe asignar por default todo a ese.\n8. Elimina el texto "Estado en vivo de Meta + rendimiento del rango cruzado con cierres/cash del CRM..."',
    puntos: [
      'El punto 6 trae la propuesta adentro y es la que gobierna el resto: **«Activar y pausar son dos botones que podría ser uno»**. Eso no es un cambio de estilo — es que el estado de N filas se expresa con UN control, y con una mezcla va apagado.',
      'Los dos «Limpiar selección» no eran un bug de render: eran dos botones escritos en dos lugares. La cura que pidió es la del plan —el checkbox de la cabecera selecciona todo y lo suelta—, así que el botón no se arregla, se BORRA.',
      '⚠️ El punto 7 es el único que no se pudo hacer: **producto múltiple choca con que un lead tiene un solo `funnel_id`**. Se le reportó con las tres salidas (partir por conjunto —que ya funciona—, múltiple con prioridad —desempate silencioso— o un lead por producto —cambia el modelo del CRM—) y la decisión quedó abierta. Las otras dos mitades del punto SÍ salieron: la herencia campaña→conjunto y el default con un solo producto.',
    ],
    archivos: [
      'app/ads-manager/BarraAcciones.tsx — MenuAcciones (el ⋯), FiltrosMenu (el filtro con categorías) y BarraLoteAds (la barra de la selección)',
      'app/ads-manager/CampanasBrowser.tsx — la cabecera, las tabs, la tabla y el cableado de los lotes',
      'app/ads-manager/ProductoCelda.tsx — la celda de producto, con las actions del CRM',
      'lib/campana-asignar.ts — la regla de cuándo preguntar antes de mover leads, compartida con el CRM',
    ],
  },
  {
    fecha: '6 oct', hora: '01:05', chat: 'Ads Manager', cuenta: 'claude1',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Los cuatro ajustes: el look del filtro, íconos sin subtítulos, y nada de emoji',
    pedido: '1. Que el diseño del botón de filtrar sea como el que te adjunto. Y que diga "Filtrar" con el ícono ese.\n2. En el desplegable de los 3 puntos, pon íconos para que se entiendan mejor. Y "Actualizar estado" sacalo de allí. Que sea un botón con el ícono de actualizar a la derecha de los filtros. Y también saca "Ordenar nombres" que sea una opción para renombrar la nomenclatura al momento de la selección multiple. Y saca los subtitulos de esos botones...\n3. En la selección multiple no exageres con poner solo iconos y nada de botones con texto, porque se acumularon todos a la izquierda y no se entiende... No pongas emoji, siempre iconos para que sea mas profesional. Y falta botones para agregar conjunto o anuncios nuevos a esa campaña.\n4. Como esta lo anterior, por lo tanto elimina el botón de "+conjunto" que hay en cada fila... Como también el "+anuncio" en los adset.',
    puntos: [
      '**El punto 3 corrige mi lectura del punto 6 anterior.** Él había escrito «utilizar iconos porque serán muchas» y yo lo leí como «sólo íconos»: salieron seis botones mudos apilados a la izquierda. Las dos mitades importan — el texto es lo que hace legible la barra y el ícono lo que la hace rápida de barrer.',
      '**«No pongas emoji, siempre iconos para que sea mas profesional»** es una regla, no un arreglo de esos tres botones. Un emoji se dibuja distinto en cada sistema y no hereda el color del botón; un `<Icon>` de app/_components/icons.tsx sí.',
      '⚠️ **Y los emoji no estaban donde los busqué.** El guard que escribí leía el bloque de la barra y el de las acciones por fila, o sea los dos lugares donde yo ya sabía que había. El navegador encontró otros cuatro: un SEGUNDO ✎ en la celda del presupuesto —al lado del del nombre, que ya era un ícono—, el ⓘ del chip «Con problemas», y un 📅 y un 📝 adentro del modal de renombrar. El guard quedó sobre los cuatro .tsx del área.',
      'El 4 sale del 3 por consecuencia: con agregar conjunto/anuncio en la barra de la selección, los botones por fila eran la segunda forma de hacer lo mismo. La fila quedó para CORREGIR lo que ya existe (textos, público) y no para crear.',
      '**Y agregar sólo se dibuja con UNA fila tildada.** Un conjunto cuelga de una campaña, no de seis: el botón que no puede decidir de cuál, no se dibuja.',
    ],
    archivos: [
      'app/ads-manager/BarraAcciones.tsx — el botón «Filtrar» con el embudo, el ⋯ sin `sub`, y BotonLote (ícono + texto)',
      'app/ads-manager/CampanasBrowser.tsx — el botón de «Actualizar estado» al lado del filtro, rowActionsFor sin los de agregar, y los cinco glifos que pasaron a íconos',
      'tests/ads-barra.test.ts — los guards, cada uno con el resultado de romperlo anotado',
    ],
  },
  {
    fecha: '7 oct', hora: '17:49', chat: 'Ads Manager', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Cerrar las tareas abiertas del proyecto Ads Manager',
    pedido: 'Revisa todas las tareas del proyecto Ads Manager y continua y cierra todas las que puedas',
    puntos: [
      'Es un pedido sobre el TABLERO, no sobre una pantalla: cada tarea se midió contra el código de hoy antes de tocarla, con su refutación, y el plan ajustado mandó sobre el detalle original. La primera fue la #349, el cartel del presupuesto.',
      '**Y la #349 escondía algo más urgente que lo que pedía.** La tarea era un cartel; la medición encontró que la celda convertía siempre a pesos, y que desde el commit del mismo día que abrió la escritura a cada cliente, una cuenta en dólares escribía 17,3 veces lo tipeado. Un cartel encima de esos números lo habría avalado.',
    ],
  },
  {
    fecha: '7 oct', hora: '17:49', chat: 'Ads Manager', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El presupuesto pasa por un cartel, y en la moneda de la cuenta (#349)',
    puntos: [
      'Primero la unidad y después el cartel. Se tipea en dólares y se convierte a la moneda de la cuenta en los CUATRO lugares donde se tipea un presupuesto (wizard, agregar conjunto, la celda y la barra de lote), con una sola tabla de tasas. Para el ws1 el número que viaja a Meta es idéntico al de antes: el test lo compara contra la fórmula vieja en 5.000 montos.',
      'Un solo cartel para una fila y para N, y un solo camino a `writeBudget`: el «sí» del cartel. Dice de qué a qué, en la moneda de la cuenta y en dólares, cuántas quedan afuera, y marca un salto de ×5 en las DOS direcciones — un cero de menos frena la campaña.',
      '⚠️ **Dos trampas de teclado que no se ven leyendo el código, medidas en el navegador:** el Enter del editor llegaba al botón del cartel recién enfocado (un Enter = abrir y confirmar, 1 POST sin que el cartel se viera), y un Enter mantenido confirmaba solo. La segunda se cerró en `Confirm`, así que vale para todas las pantallas.',
      'De paso, cuatro cosas que ya estaban rotas: el presupuesto total era editable como diario, guardar sin tocar reescribía 500 → 502 por el redondeo, el lote afirmaba «cambiado en N» con fallos, y una recarga dentro de los 2 minutos de la caché devolvía la fila al monto viejo.',
      'Verificado con Playwright contra el dev server, con /api/meta-health y /api/meta-write simulados y todo otro POST abortado: 30 de 30, sin tocar ninguna cuenta. Lo que falta es la primera prueba REAL, mirando, en una campaña en pausa.',
    ],
    archivos: [
      'lib/presupuesto-cambio.ts — la unidad que se tipea, la tabla de tasas, el salto ×5, qué fila se edita y qué optimista sobrevive a una recarga',
      'app/ads-manager/CampanasBrowser.tsx — `pideBudget`, el cartel (`MensajePresupuesto`), la celda y el editor, y `writeBudget` que ahora dice si salió',
      'app/ads-manager/BarraAcciones.tsx — el lote tipea en la misma unidad que la celda, sólo dígitos',
      'app/_ui/Confirm.tsx — una tecla mantenida no confirma',
      'tests/ads-presupuesto-confirma.test.ts — 13 tests, cada guard probado rompiendo lo que fija',
    ],
    commits: [
      { sha: '025f44ec', msg: 'Ads Manager: el presupuesto pasa por un cartel, y en la moneda de la cuenta (#349)', lineas: 868, archivos: 12 },
    ],
  },
  {
    fecha: '7 oct', hora: '18:21', chat: 'Ads Manager', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'La revisión de la #349: lo que el commit afirmaba y no hacía',
    puntos: [
      '**El optimista del presupuesto se soltaba por reloj, a los 120 s, y la caché del árbol de Meta sirve lo VENCIDO.** `unstable_cache` es stale-while-revalidate: la primera lectura después de vencer devuelve la entrada vieja. Escribir, no mirar nada y pausar otra fila a los 3 minutos devolvía la fila al monto de antes — el mismo caso que el commit decía cerrar. Ahora el árbol anota cuándo EMPEZÓ a leerse y la escritura toma la hora del header `Date`: las dos del servidor.',
      '⚠️ **La prueba del navegador había dado verde sobre eso** porque el `/api/meta-health` simulado no tenía caché. Y el test que lo «fijaba» comparaba la ventana con el `revalidate`: dos números iguales, sobre la suposición equivocada de que uno acota al otro.',
      'Dos carreras más del mismo optimista: un `cargar()` en el medio se llevaba el monto de una escritura en vuelo (se anotaba recién al volver OK), y un fallo dejaba la fila en el árbol cargado aunque hubiera una escritura anterior confirmada.',
      'Agregar conjunto escribía «no pude leer la moneda» como «cobra en dólares»: en el ws1, 50 tipeados bajo «USD» creaban 50 MXN/día. Ahora toma la moneda del árbol de respaldo, y sin ninguna no crea.',
      'Tres guards seguían verdes con lo que fijaban roto (13 / 0 con cada mutación): buscaban que la llamada EXISTIERA y no la línea que decide. Reescritos, y cada uno probado rompiéndolo. Y la cosecha contaba a la barra de lote como «la cuarta vez» del ×17,3: el lote nunca multiplicó.',
    ],
    archivos: [
      'lib/presupuesto-cambio.ts — `presupuestosVigentes` decide por cuándo empezó la lectura, y `horaDeEscritura`',
      'lib/meta-health.ts — `inicioLecturaISO`, anotado antes del primer pedido a Meta',
      'app/ads-manager/CampanasBrowser.tsx — `writeBudget` anota antes del POST y vuelve a lo de antes si falla',
      'app/ads-manager/AgregarConjuntoModal.tsx — la moneda con respaldo, y el rótulo con la unidad que de verdad viaja',
      'tests/ads-presupuesto-confirma.test.ts — 18 tests',
    ],
    commits: [
      { sha: '6f5c43fc', msg: 'Ads Manager: lo escrito sobrevive a la caché vencida, y la revisión de la #349', lineas: 491, archivos: 9 },
    ],
  },
  {
    fecha: '7 oct', hora: '19:03', chat: 'Ads Manager', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Un video se usa cuando Meta lo procesó, y un reintento no publica dos veces (#59)',
    puntos: [
      '**El bug del 25/09 no era la causa del botón Publicar trabado**, como se había anotado. Los 16 videos que ws1 publicó llevaban miniatura y ninguno fue rechazado; los 14 fracasos de ws13 eran la app del cliente en modo desarrollo. Era real y latente: los TRES modales —no dos— escribían `processing: false` sobre lo que Meta todavía procesaba.',
      'Una sola subida para los tres modales (Nueva campaña tenía su propia copia), la tarjeta en «Procesando» hasta que Meta dice listo, y un 422 si Meta no pudo. Las tres rutas que publican vuelven a preguntar antes de crear nada.',
      'La idempotencia: el duplicado real no es el doble clic sino la respuesta perdida con el borrador intacto. La clave sale de la FIRMA de lo que se manda —después de un parcial, la misma clave haría recortar anuncios que nunca se crearon— y hay DOS reglas de reintento, porque en un lote la campaña de la fila es la que ya existía.',
      '⚠️ Una decisión distinta del plan: con la migración 0215 sin aplicar se publica sin idempotencia en vez de dar 503 a todos, porque cualquier sesión puede pushear antes de que alguien la aplique. Mientras falte, «Reintentar es seguro» es falso.',
      'Verificado: 4510 tests, diecisiete roturas cazadas, y 20 de 20 en el navegador con la subida y la publicación simuladas (ningún POST llegó a Meta ni a la base). Falta lo que hace Martín: aplicar la 0215, publicar mirando, crear un formulario en su página y medir un video pesado.',
    ],
    archivos: [
      'app/ads-manager/creativeUpload.ts — la subida, la espera a Meta y el POST con tope',
      'app/ads-manager/NuevaCampanaModal.tsx — la bandeja retoma la espera desde el borrador, y la clave viaja en él',
      'app/api/ads-manager/creative-upload/route.ts — 422, espera de 25 s, GET de consulta que limpia el staging',
      'lib/meta-idempotencia.ts — la clave por firma, las dos reglas y el registro estricto',
      'lib/campana-videos.ts — qué videos lleva una publicación y qué cuenta como listo',
      'supabase/migrations/0215_meta_campaign_drafts_idem.sql — SIN aplicar; va antes del deploy',
    ],
    commits: [
      { sha: 'f6ed4c33', msg: 'Ads Manager: un video se usa cuando Meta lo procesó, y un reintento no publica dos veces (#59)', lineas: 2095, archivos: 22 },
    ],
  },
  {
    fecha: '7 oct', hora: '19:47', chat: 'Ads Manager', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'La revisión de la #59: la firma sola duplicaba, y la fila decía menos de lo que había en Meta',
    puntos: [
      '**El «Reintentar es seguro» era falso apenas se tocaba algo.** Después de un 504 la revisión deja editar, y corregir una palabra cambiaba la firma: otra clave, y el server creaba una SEGUNDA campaña. Congelar la firma no era la cura —después de un parcial el cliente recorta y necesita otra clave—: lo que distingue los dos casos es si el server ya contestó. La clave sin respuesta queda ABIERTA y manda hasta que el server la cierre, y vive fuera del modal (en los dos chicos, cerrar y reabrir la perdía).',
      'Una respuesta a la clave abierta puede hablar del payload de ANTES: no se pinta como el éxito de lo que está en pantalla ni se le recorta su `created` — un «a medias» de otro lote borraba anuncios que nunca se crearon.',
      'La fila del registro decía menos de lo que había en Meta: los terminales no reescribían los ids en memoria (una campaña «publicada» sin campaña), el DELETE del rollback no se leía, y adset-add exigía la miniatura con el conjunto ya creado — «vuelve a intentar» sobre una clave que contestaba «a medias» para siempre. Ahora la miniatura va antes y un conjunto vacío se borra.',
      '⚠️ **Dos guards en verde sobre lo que existían para cazar**, reproducido primero sobre HEAD: pass 11 / fail 0 con el chequeo de videos del lote borrado, y lo mismo sin el workspace del insert del lote. Uno recortaba desde el POST (y el modo simple está arriba), el otro leía sólo el primer insert.',
      'Y tres más chicos: «no pude leer» descartaba la tarjeta como si Meta hubiera dicho algo, la fila nacía con el objetivo Leads por default, y el staging de un video dependía de que la pestaña siguiera abierta.',
    ],
    archivos: [
      'lib/meta-idempotencia.ts — `claveAMandar` y `trasRespuesta`: la clave abierta y qué la cierra',
      'app/ads-manager/creativeUpload.ts — dónde vive la clave abierta, y la espera que distingue «procesando» de «no pude leer»',
      'app/api/ads-manager/adset-add/route.ts — la campaña antes del registro, lo creado en memoria, y el conjunto vacío que se borra',
      'lib/ads-staging.ts — el nombre del staging y cuándo sobra; creative-upload lo barre en cada subida',
      'tests/ads-publicar-registro.test.ts y tests/ads-staging.test.ts — nuevos; dieciocho roturas cazadas en total',
    ],
    commits: [
      { sha: 'c5a5c933', msg: 'Ads Manager: la revisión de la #59 — la clave sin respuesta manda, y la fila dice todo lo que hay en Meta', lineas: 1019, archivos: 22 },
    ],
  },
  {
    fecha: '7 oct', hora: '20:26', chat: 'Ads Manager', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Usar un video que MaKo ya generó, sin bajarlo y volverlo a subir (#797)',
    puntos: [
      '**«¿Sólo el montado o también las tomas?» no era la decisión que no bloquea: era la que decidía si la feature mostraba algo.** En producción hay CERO montajes listos (dos pendientes, el worker nunca tomó uno) y 31 tomas filmadas. Van las dos: los montados primero y las tomas después, rotulados.',
      'La url NUNCA viaja del navegador. El bucket es público y la ruta no lleva el workspace: el navegador manda una referencia, el server ARMA la url con la misma ruta que la escribió y exige que lo guardado sea exactamente eso. Con la sesión de ws9, la referencia de una toma de ws1 contesta 404 sin tocar Meta.',
      'La rama nueva no borra (el montado es la única copia), no guarda el guion como transcripción (el cron se saltearía ese anuncio para siempre) y la miniatura es una data: hecha en el navegador o nada: la url del .mp4 viajaría a Meta como image_url y el creativo se rechaza.',
      '⚠️ **El «regalo» para los videos pesados de la #59 era falso**: el video del disco ya iba a Meta por file_url firmado. Y de paso, Nueva campaña cruzaba las descripciones de MaKo cuando un creativo no tenía miniatura.',
      'Verificado: 4554 tests, quince roturas cazadas, build en 0, y 17 de 17 en el navegador con Meta simulado. Falta lo que hace Martín: conectar Meta en su workspace, generar un anuncio ahí y crear uno en pausa mirando.',
    ],
    archivos: [
      'lib/creativo-mako.ts — qué se ofrece y qué se acepta: la url derivada, la referencia, el origen',
      'lib/creativo-mako-fuentes.ts — los montados, las tomas y resolver una referencia, en el workspace de la sesión',
      'app/api/ads-manager/mis-creativos/route.ts — la lista; «no pude leer» es un 500, nunca []',
      'app/api/ads-manager/creative-upload/route.ts — subirCreativoMako, antes de exigir path y sin borrar nada',
      'app/ads-manager/MisCreativosMako.tsx — el panel de los tres modales',
      'app/ads-manager/creativeUpload.ts — usarCreativoMako, makeThumbDeUrl y una sola lectura de la respuesta',
      'tests/creativo-mako.test.ts y tests/ads-creativo-mako.test.ts — 16 tests, cada guard probado rompiéndolo',
    ],
    commits: [
      { sha: '772ae3ec', msg: 'Ads Manager: usar un video que MaKo ya generó, sin bajarlo y volverlo a subir (#797)', lineas: 1236, archivos: 15 },
    ],
  },
  {
    fecha: '7 oct', hora: '21:01', chat: 'Ads Manager', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'La revisión de la #797: la ref de una toma nombraba el casillero y no el clip',
    puntos: [
      '**Se podía publicar un video distinto del que se vio.** La ref `toma:<plan>:<n>` nombraba el número de toma y el server subía lo que esa toma guardara al hacer clic: si se volvía a filmar entre abrir la lista y elegir, a Meta iba el clip nuevo con la miniatura y la descripción de MaKo del viejo. Ahora la ref lleva el clip y una toma que cambió contesta 409 «Esa toma cambió. Vuelve a elegirla.».',
      'Y el 409 tiene salida: en Nueva campaña el panel queda abierto y la lista se pedía una sola vez, así que elegir otra vez daba el mismo 409. Cada fallo de un video de MaKo vuelve a montar el panel.',
      '⚠️ **Dos guards en verde sobre lo que existían para cazar**, medido corriendo el test de HEAD sobre cada rotura: uno miraba el ORDEN del wrapper y no que la lectura corriera adentro (leer antes de fijar el workspace pasaba), el otro exigía el literal estricto y no prohibía el `catch` que lo traga.',
      'Diecisiete roturas cazadas, cada una con su número en el comentario del test. No se abrió el navegador ni se llamó a Meta.',
    ],
    archivos: [
      'lib/creativo-mako.ts — la ref con el clip (`refDeCreativo`, `leerRefCreativo`, `creativosDeTomas`) y `tomaPedida`',
      'lib/creativo-mako-fuentes.ts — `resolverCreativoMako` distingue «ya no está» de «cambió»',
      'app/api/ads-manager/creative-upload/route.ts — el 409, antes de llamar a Meta',
      'app/ads-manager/NuevaCampanaModal.tsx — `vueltaMako`: el panel vuelve a pedir la lista tras un fallo',
      'tests/creativo-mako.test.ts y tests/ads-creativo-mako.test.ts — los guards que ahora cazan su bug',
    ],
    commits: [
      { sha: '5488bbe0', msg: 'Ads Manager: la revisión de la #797 — la ref de una toma lleva el clip que se vio, y dos guards cazan su bug', lineas: 350, archivos: 10 },
    ],
  },
  {
    fecha: '7 oct', hora: '21:37', chat: 'Ads Manager', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Ver y cambiar dónde se muestra un conjunto que ya corre (#715)',
    puntos: [
      '**Los lugares de los conjuntos reales son PINES.** Se leyeron con un GET tres conjuntos de tres cuentas conectadas antes de escribir el parser: los que se arman en Meta son puntos sin dirección, con radios de 12, 8 y 16 km que nuestra lista no ofrecía, y `location_types` trae `frequently_in` en los dos lados. El plan suponía direcciones y dejaba el pin para después: sin el tipo pin la feature no servía para el caso inmobiliario que la pidió.',
      'El detalle de un conjunto dice «Dónde se muestra» (incluye, excluye, radio con su unidad, el pin abre el mapa) con una lectura propia: si falla lo dice y no tumba las métricas. «Cambiar lugares» abre el MISMO editor que «Público» de la fila, y guardar relee sólo eso.',
      'El POST reemplaza el targeting entero, así que el geo se toca SÓLO si la firma de los lugares cambió, con lista blanca por clave y por campo de fila: lo que no se entiende deja los lugares en sólo lectura y re-escribir tira antes de borrar. La consecuencia («Cambia dónde gasta. Meta lo revisa y reinicia el aprendizaje.») va pegada al botón.',
      '⚠️ **Una decisión distinta del plan:** el radio que vino de Meta se re-emite con su unidad mientras nadie lo cambie (`radioMeta`). La `unidad` pegada al lugar que proponía el plan habría mandado «+25 km» elegido en el selector como 25 millas. Y el valor actual entra al desplegable como «(actual)»: decía «Seleccionar…» sobre 12 km.',
      'Verificado: 4577 tests, quince roturas cazadas (ocho del parser y siete del cableado), y 27 de 27 en el navegador con Meta simulado, incluidas las dos pantallas de creación y un borrador con un pin. Falta lo que hace Martín: cambiar lugares de verdad en una campaña de prueba en pausa en su cuenta, y decidir cómo se CREA un pin.',
    ],
    archivos: [
      'lib/meta-geo.ts — `lugaresDesdeMeta`, `aplicarLugares`, `radioMetaVigente`, el tipo pin y `lugarPin`',
      'app/ads-manager/EditarPublicoModal.tsx — los lugares en el editor, sólo lectura y la consecuencia pegada al botón',
      'app/ads-manager/EntityDetalle.tsx — «Dónde se muestra», con su lectura y `versionGeo`',
      'app/ads-manager/LugaresLectura.tsx — la vista de lectura de los dos',
      'app/ads-manager/LugarPicker.tsx — el radio del pin y el valor «(actual)»',
      'app/ads-manager/CampanasBrowser.tsx — la segunda puerta al editor y la versión que sube al guardar',
      'tests/meta-geo.test.ts y tests/ads-lugares-conjunto.test.ts — 10 tests nuevos, cada uno probado rompiendo lo que fija',
    ],
    commits: [
      { sha: '335837cb', msg: 'Ads Manager: ver y cambiar dónde se muestra un conjunto que ya corre (#715)', lineas: 902, archivos: 13 },
    ],
  },
  {
    fecha: '7 oct', hora: '22:05', chat: 'Ads Manager', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'La revisión de la #715: el mismo lugar de los dos lados son dos filas',
    puntos: [
      '**La dona rompía el editor.** Meta acepta el mismo pin incluido con un radio grande y excluido con uno chico, y el selector identificaba la fila sólo por el lugar: agrandar el anillo agrandaba el agujero (público en 0) y sacar el agujero se llevaba el anillo. Ahora una fila es lugar y lado, y dos filas iguales del mismo lado quedan en sólo lectura. Se eligió eso y no mandar toda dona a sólo lectura: es una segmentación legítima.',
      '**El guard del pin sin radio no tenía test**: la fila que lo «probaba» traía unidad y caía en otra rama. Borrarlo daba 14 de 14 en verde; con la fila nueva, 13 / 1.',
      '⚠️ **Las fixtures salían de cuentas de clientes, fuera del plan**, con ids reales de ciudades y coordenadas corridas unos km. Pasaron a valores sintéticos, y queda la pregunta para Martín: ¿se rehace la medición en su cuenta cuando tenga Meta conectado?',
      'Y las citas de líneas del hallazgo del merge en el navegador, que el commit había corrido. Seis roturas cazadas, cada una con su número en el comentario del test; sin navegador ni Meta.',
    ],
    archivos: [
      'lib/meta-geo.ts — `mismaFila`, `quitarLugar`, `cambiarRadio`, `claveFila`, y el corte de filas repetidas en `leerBolsa`',
      'app/ads-manager/LugarPicker.tsx — quitar, el radio y el `key` de React por fila',
      'tests/meta-geo.test.ts — la dona, el pin sin radio ni unidad, y las fixtures sintéticas',
      'tests/ads-lugares-conjunto.test.ts — el selector pasa por las funciones de fila',
    ],
    commits: [
      { sha: '6fe99555', msg: 'Ads Manager: la revisión de la #715 — el mismo lugar de los dos lados son dos filas', lineas: 264, archivos: 7 },
    ],
  },
];
