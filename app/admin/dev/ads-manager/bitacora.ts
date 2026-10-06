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
];
