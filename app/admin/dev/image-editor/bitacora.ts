// =============================================================================
// Image Editor — el registro de construcción de la copia de Canva
// =============================================================================
// ESTO NO ES UN CHANGELOG. El changelog está en `git log`. Acá va lo que git no guarda: qué
// pidió Martín con sus palabras y por qué se resolvió así. El plano está en
// docs/diseno-editor-imagen.md; lo aprendido, en docs/hallazgos-editor-imagen.md.
//
// Las horas de los prompts son las del chat (no del commit); las de la implementación, las del
// commit. Se agrega AL FINAL del array (orden cronológico). La pantalla lo lee al revés.

import type { Hito, Parte } from '../_registro/tipos';

const CH = 'Image Editor (Canva)';

/** Las fases del área y en qué anda cada una. */
export const PARTES: Parte[] = [
  { titulo: 'Doory adentro de MaKo', detalle: 'El editor de Doory (fabric.js 7) portado, con el crédito que pide su licencia, guardado local por workspace y sólo para el super admin', estado: 'hecha' },
  { titulo: 'El re-vestido de Canva', detalle: 'Barra superior, riel izquierdo con su panel, barra del objeto, barra inferior e inicio de Canva, con la paleta y las proporciones medidas', estado: 'hecha' },
  { titulo: 'Guardar en Supabase', detalle: 'Diseños, «Subidos» y miniaturas en la base y el bucket del workspace; lo que estaba en el navegador sube solo', estado: 'hecha' },
  { titulo: 'Marca, versiones, compartir y comentarios', detalle: 'Las herramientas de Canva que piden tablas propias; hoy el editor las esconde', estado: 'cola' },
  { titulo: 'El catálogo propio', detalle: 'Fuentes alojadas, íconos y emoji con licencia libre, formas propias, plantillas y fotos de Unsplash', estado: 'cola' },
  { titulo: 'Lo que a Doory le falta de Canva', detalle: 'Texto en formas, tablas, cuadrículas, dibujar, copiar estilo, efectos de texto, quitar fondo de objetos', estado: 'cola' },
  { titulo: 'Abrirlo a todos los negocios', detalle: 'Visible y abierto en todos los workspaces con la pregunta de toda tab; el crédito de Doory lo ve cada negocio', estado: 'hecha' },
  { titulo: 'API de MaKo', detalle: 'El área imagen: listar, ver textos, plantillas, crear, cambiar textos, copiar y eliminar, también por WhatsApp', estado: 'hecha' },
  { titulo: 'Carruseles que funcionan', detalle: 'Las funciones de un explorador de carruseles con los de las cuentas que el negocio sigue en Spy: buscar, filtros, outlier, esta semana, guardados, plantillas propias por tipo y «Hacer el mío» con la estructura de uno', estado: 'sigue' },
];

export const BITACORA: Hito[] = [
  {
    fecha: '14 oct', hora: '—', chat: CH, cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'Un Canva dentro de MaKo, en la tab Image',
    pedido: 'Quiero que implementes end to end un "Canva" dentro de MaKo, tal cual, copialo todo, tanto en diseño como funcionalidades. Revisa si hay algún repo que nos ahorre trabajo. Dejalo en "Content Machine" en una tab que sea "Image"',
    puntos: [
      'Se relevaron los repos: Doory (el único Canva completo sobre fabric.js 7, licencia de atribución), Tela y fabritor (sólo piezas), los clones del tutorial de Next + fabric, vue-fabric-editor (Vue). Polotno y LayerHub quedan afuera (SDK pago / repos borrados).',
      'Se relevó Canva desde fuentes públicas (el Chrome no tenía sesión): paleta, proporciones, rótulos, inicio, diálogos y atajos.',
    ],
  },
  {
    fecha: '14 oct', hora: '—', chat: CH, cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'La base: Doory, para ir trabajando',
    pedido: 'Copia a Doory, y luego lo modificamos completamente para que sea original de MaKo, pero quiero la plantilla para ir trabajando',
    puntos: [
      'Doory exige mostrar el crédito del autor cada vez que se abre el editor; modificarlo no saca la obligación. Queda el cartel puesto y el editor sólo para el super admin hasta resolverlo (permiso escrito del autor, o reescribirlo sin su código).',
    ],
  },
  {
    fecha: '14 oct', hora: '06:01', chat: CH, cuenta: 'claude2', actor: 'claude', tipo: 'implementacion',
    titulo: 'Doory corriendo en /image-editor',
    puntos: [
      'El frontend de Doory portado a app/image-editor/_doory (sin tests ni su app), con los imports reescritos, sus tokens prefijados --cv- y limitados a .cv, y los textos en español neutro.',
      'Guarda en IndexedDB, una base por workspace, con el adaptador de invitado de Doory en modo cuenta; fuentes de Google Fonts por Fontsource.',
      'La tab Image apunta al editor y es su primera sección; el guard es por persona (sólo el super admin).',
      'La paleta de Canva medida ya está en los tokens; el armazón todavía es el de Doory.',
    ],
    commits: [
      { sha: '7c82507d', msg: 'Image Editor (tanda 1): Doory portado como base del Canva de MaKo, en la tab Image', lineas: 69698, archivos: 531 },
    ],
  },
  {
    fecha: '14 oct', hora: '—', chat: CH, cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'Que se termine',
    pedido: 'No se pusheo? Avanza y termina',
    puntos: [
      'Lo contestó la tanda 2 (el armazón de Canva y el catálogo propio), que salió en el push integrado del orquestador.',
    ],
  },
  {
    fecha: '14 oct', hora: '—', chat: CH, cuenta: 'claude2', actor: 'claude', tipo: 'implementacion',
    titulo: 'El editor con el armazón de Canva y el catálogo propio',
    puntos: [
      'Barra superior con el degradado de Canva (Inicio, Archivo, Redimensionar, deshacer, guardado, título con medidas, Presentar, Compartir); riel izquierdo Diseño · Elementos · Texto · Marca · Subidos · Herramientas · Proyectos · Apps con su panel flotante; barra del objeto flotante; barra inferior con Notas, zoom, Páginas y pantalla completa; inicio de Canva.',
      'Catálogo: ~60 fuentes de Google Fonts con sus pesos reales, las 10 plantillas de Doory, íconos y emoji de Iconify con licencia libre.',
      'Sin verificar en el navegador: el dev server local no aguanta compilar el editor con la máquina llena.',
    ],
  },
  {
    fecha: '14 oct', hora: '—', chat: CH, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'Cerrar lo pendiente (por el chat orquestador)',
    pedido: 'Martín quiere cerrar lo pendiente al 100%. Lo que NO depende de esa decisión, cerralo; y armame en una línea las opciones de lo que sí depende, para que él elija rápido.',
    puntos: [
      'Lo que no dependía de él: verlo andar, el presentador roto y la tanda 3 (guardar en la base). Lo que sí: Image mirando un cliente, la licencia de Doory, las fotos con key y la API mientras sea sólo suyo.',
    ],
  },
  {
    fecha: '14 oct', hora: '16:12', chat: CH, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'El editor visto andando, y la vista del presentador',
    puntos: [
      'Sin dev server (pasa los 5 GB): un banco con esbuild y Chrome sin ventana. Crear, texto, plantilla, imagen soltada, guardar y reabrir, PNG y PDF: todo anduvo, sin errores en la consola.',
      '«Vista de presentador» abría una página de Vite que no existe en MaKo; ahora abre /image-editor/presentador y se conecta con el editor.',
    ],
    commits: [
      { sha: 'c7a77fcb', msg: 'Image Editor: «Vista de presentador» abre una ventana que existe', lineas: 135, archivos: 9 },
    ],
  },
  {
    fecha: '14 oct', hora: '16:49', chat: CH, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'Los diseños pasan a la base',
    puntos: [
      'Diseños, «Subidos» y miniaturas en Supabase (mig 0278, aplicada): se ven desde otra máquina y la API y las Estrellas tienen de dónde leer.',
      'Dos pestañas sobre el mismo diseño no se pisan: la segunda ofrece recargar o guardar una copia.',
      'Lo que estaba guardado en el navegador sube solo la primera vez que se abre el editor, con su mismo enlace.',
      'Probado contra la base real en el Cliente de Prueba y en el banco: guardar, subir una imagen, descargarla en PNG con la imagen adentro, eliminar.',
    ],
    commits: [
      { sha: '5136c1ce', msg: 'Image Editor: los diseños y «Subidos» pasan a la base (tanda 3)', lineas: 1485, archivos: 21 },
    ],
  },
  {
    fecha: '15 oct', hora: '—', chat: CH, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'Image en todos los workspaces (por el chat orquestador)',
    pedido: 'Que Image aparezca en todos los workspace.',
    puntos: [
      'Antes se midió por qué no la veía: con Content Machine plegada la fila no existe, y mirando un cliente o como admin de un cliente estaba escondida a propósito (adminOnly).',
    ],
  },
  {
    fecha: '15 oct', hora: '—', chat: CH, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'Image abierta a todos los negocios',
    puntos: [
      'La tab Image se ve en todos los workspaces (salvo la capa pm, que no tiene Content Machine) y el editor deja entrar a cualquier admin del negocio, como el Video Editor.',
      'Image Generator y Thumbnails siguen diciendo «pronto», ahora también en la barra de secciones de arriba.',
      'Cada negocio ve el crédito de Doory al pie del editor: lo pide la licencia.',
    ],
  },
  {
    fecha: '15 oct', hora: '—', chat: CH, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'El editor en la API de MaKo',
    puntos: [
      'MaKo, la skill y quien tenga un token pueden listar los diseños, ver sus textos, crear uno en blanco o desde una plantilla, cambiarle los textos, copiarlo y eliminarlo, con el permiso de la tab.',
      'Por WhatsApp, «creame un flyer…» llega con las herramientas del editor (antes se anotaba como tarea).',
      'Lo que no hace: dibujar ni descargar. Devuelve el link para abrirlo en el editor.',
    ],
  },
  {
    fecha: '4 nov', hora: '14:20', chat: 'Carruseles (nube)', sesion: 'cli_daed829d-dde6-5b48-8dd1-048974536370', cuenta: 'nube', actor: 'martin', tipo: 'prompt',
    titulo: 'Copiar las funciones de un explorador de carruseles a la sección de imagen',
    pedido: 'Te deje abierto esto: https://topcarousels.com/explore. Quiero que scrapees entero, mires y copies las funcionalidades y todos los carruseles de ejemplo para ponerlos en MaKo en la sección de imagen generator. — Y asegurate de que todo este siempre en ops center.',
    puntos: [
      'Llegó por el Cerebro, con lo medido: sus términos prohíben bajar, raspar y republicar la biblioteca, y cada carrusel es de su creador. Se copian las FUNCIONES con datos propios; la biblioteca no se toca.',
      'De dónde salen los carruseles: las publicaciones públicas de las cuentas que cada negocio sigue en Competitors Spy, leídas con su clave y su tope; se muestran con su creador y el link al original.',
      'Lo que tiene que quedar: explorar (buscar, filtros, orden, grilla de dos tamaños, guardados, búsquedas guardadas), el outlier de Spy, lo de esta semana, las cuentas, «Hacer el mío» con la estructura y no el contenido, plantillas propias por tipo y todo por la API.',
    ],
  },
  {
    fecha: '4 nov', hora: '14:45', chat: 'Carruseles (nube)', sesion: 'cli_daed829d-dde6-5b48-8dd1-048974536370', cuenta: 'nube', actor: 'claude', tipo: 'implementacion',
    titulo: 'Carruseles que funcionan, adentro de Image',
    puntos: [
      'Image tiene «Carruseles que funcionan»: los carruseles de las cuentas que sigues en Competitors Spy, cada uno con su creador y el link a su publicación original.',
      'Cada uno dice cuántas veces rindió lo que una publicación típica de su cuenta (el mismo número que Spy), y se ordena por eso, por fecha o por interacción.',
      'Se busca por tema o por @cuenta, se filtra por fecha, láminas, formato y outlier, y se ve lo de esta semana, lo guardado y las cuentas, con su análisis en Spy a un clic.',
      'Las búsquedas se guardan con un nombre, y en «Nuevo diseño» aparecen arriba los que mejor funcionan esta semana. Lo mismo en el teléfono.',
      'Spy ahora sabe si una publicación es un carrusel y cuántas láminas trae (hace falta aplicar la migración 0391; sin ella todo sigue andando).',
      'MaKo lo puede hacer por la app y WhatsApp: ver en qué paso está, buscar y guardar.',
    ],
    archivos: [
      'lib/carruseles/explorar.ts — lo puro: de dónde salen, el outlier de Spy, buscar, filtrar, ordenar, la URL y los guardados',
      'lib/carruseles/explorar-servidor.ts — lee lo que Spy trajo y escribe guardados y búsquedas con compare-and-set',
      'app/image-editor/carruseles/ — la pantalla, la franja de «Nuevo diseño» y sus acciones',
      'lib/spy-medio.ts y supabase/migrations/0391_spy_medio_carruseles.sql — carrusel, imagen o video, y sus láminas',
      'lib/api-mako/areas/imagen.* — estado_carruseles, buscar_carruseles y guardar_carrusel',
    ],
    revisar: '/image-editor?ver=carruseles',
  },
  {
    fecha: '4 nov', hora: '18:20', chat: 'Carruseles (nube)', sesion: 'cli_daed829d-dde6-5b48-8dd1-048974536370', cuenta: 'nube', actor: 'claude', tipo: 'implementacion',
    titulo: 'Carruseles de MaKo por tipo y «Hacer el mío»',
    puntos: [
      '«Nuevo diseño» abre con ocho carruseles de MaKo por tipo: lista, paso a paso, historia, antes y después, mito vs. realidad, opinión, caso con números y preguntas.',
      'Cada tarjeta muestra lo que se va a crear (la portada con el nombre del negocio y las láminas detrás), y «Ver ejemplo» lo enseña lleno con un negocio ficticio, aparte.',
      'El diseño nace con la estructura del tipo: una guía de qué escribir en cada lámina, la barra de progreso, la flecha y la última lámina para pedir algo.',
      'En «Carruseles que funcionan», «Hacer el mío» toma la estructura de uno (tipo, láminas, con qué abre y qué pide al final), la muestra para cambiarla y crea uno nuevo. Sus palabras no se copian: van en las notas de quién es y el link.',
      'MaKo lo puede hacer por la app y WhatsApp (crear_carrusel_desde_referencia), y buscar_carruseles ya dice la estructura de cada uno.',
    ],
    archivos: [
      'lib/carruseles/tipos.ts — los ocho tipos: su estructura, su estilo y su ejemplo de un negocio ficticio',
      'lib/carruseles/documento.ts — el documento del editor de un carrusel, una página por lámina',
      'lib/carruseles/referencia.ts y texto.ts — la estructura de una referencia, nunca su texto',
      'lib/carruseles/crear-servidor.ts — «Hacer el mío» para la pantalla y la API',
      'app/image-editor/carruseles/MiniaturaCarrusel.tsx, DialogosCarrusel.tsx y useCarruselesDeImage.tsx — la miniatura, «Ver ejemplo» y «Hacer el mío»',
    ],
    revisar: '/image-editor',
  },
  {
    fecha: '4 nov', hora: '19:29', chat: 'Carruseles (nube)', sesion: 'cli_daed829d-dde6-5b48-8dd1-048974536370', cuenta: 'nube', actor: 'martin', tipo: 'prompt',
    titulo: 'Una biblioteca de carruseles de ejemplo, real desde el primer día',
    pedido: 'Pedido nuevo de Martín: que el explorador de carruseles en Image tenga ejemplos reales desde el primer día, aunque el negocio no siga a nadie en Spy. QUÉ: una biblioteca de ejemplos compartida, sumada a lo que ya muestra el explorador (lo de las cuentas que sigue el negocio queda igual). DE DÓNDE: directo de cuentas públicas de Instagram, con la misma lectura que ya usa Spy. De topcarousels.com NO sale nada: ni bajar su biblioteca, ni leer su /explore, ni copiar su lista de cuentas. CUENTAS: arranca con los gurús del Ops Center que tengan Instagram. La lista la edita el superadmin, para sumar los @ que pase Martín. CÓMO SE MUESTRA: miniatura, @creador bien visible, link al post original, sus números públicos y el outlier. Nunca como plantilla de MaKo; «Hacer el mío» sigue usando sólo la estructura. El superadmin puede sacar a un creador que lo pida, y sale de todos lados. LECTURA: […] deja un script para correr desde la PC: en seco primero, con techo de gasto en dólares y sin imprimir claves. — Y a las 19:36: Martín la quiere grande […]. DECISIÓN DE MARTÍN (4/11): se muestran como en Spy: públicos, con el @ del creador y el link al original. […] SE SUMA a la lista de cuentas: buscar por tema los carruseles que mejor funcionan (por hashtag, con el mismo acceso de Spy a Apify), quedarse sólo con los carruseles, ordenarlos por rendimiento y clasificarlos por tipo, sin repetidos. Elige tú los temas iniciales, pensando en los negocios de MaKo, y déjalos editables para el superadmin. PRIMERA CARGA: el script recibe los topes por parámetro. Por defecto, hasta 300 carruseles y US$2. […] el script dice cuánto queda antes de gastar y frena sin romper nada si no alcanza.',
    puntos: [
      'Llegó por el Cerebro, en dos mensajes (19:29 y 19:36). Lo del medio que se cortó es cómo se sube y qué migración aplica el Cerebro.',
      'Sigue sin salir nada de topcarousels.com: la biblioteca se lee de Instagram directo, con la misma lectura de Spy.',
    ],
  },
  {
    fecha: '4 nov', hora: '20:05', chat: 'Carruseles (nube)', sesion: 'cli_daed829d-dde6-5b48-8dd1-048974536370', cuenta: 'nube', actor: 'claude', tipo: 'implementacion',
    titulo: 'La biblioteca de ejemplos en «Carruseles que funcionan»',
    puntos: [
      '«Carruseles que funcionan» muestra, además de lo de las cuentas que sigue el negocio, una biblioteca de ejemplos que ven todos los negocios: con el @ del creador, el link a su publicación, sus números y, de las cuentas de la lista, el outlier.',
      'Un negocio que no sigue a nadie ya ve ejemplos, con la línea para seguir a las cuentas de su rubro arriba.',
      'Sale de dos fuentes: una lista de cuentas (se leen enteras) y temas por hashtag, de los que se guardan sólo los carruseles que mejor rinden, clasificados por tipo y sin repetidos.',
      'Arranca con diez temas para los negocios de MaKo (marketing digital, marca personal, ventas, coaching, agencias, copywriting, cursos…). La plataforma suma y saca cuentas y temas en «Cuentas», y puede sacar a un creador que lo pida: deja de verse en todos lados y no vuelve a entrar.',
      'La carga la hace un script en la PC: en seco primero, con techo en dólares, deja libres US$2 del crédito para Spy y no imprime la clave. Por defecto, hasta 300 carruseles y US$2.',
      'MaKo lo puede ver y cambiar por la app y WhatsApp (sólo en el negocio de la plataforma), y buscar_carruseles filtra por de dónde vienen.',
    ],
    archivos: [
      'supabase/migrations/0392_carruseles_biblioteca.sql — las cuentas, los temas y las publicaciones: globales, sin workspace (sin aplicar)',
      'lib/carruseles/biblioteca.ts — lo puro: ids en negativo, cómo entra al explorador, sacar y volver, el plan de lectura y su techo',
      'lib/carruseles/biblioteca-servidor.ts — la lee y la edita la plataforma',
      'scripts/carruseles-biblioteca.mts — la carga desde la PC',
      'app/image-editor/carruseles/EditarBiblioteca.tsx — el panel de la plataforma en «Cuentas»',
      'lib/api-mako/areas/imagen.* — ver_biblioteca_carruseles y cambiar_biblioteca_carruseles',
    ],
    revisar: '/image-editor?ver=carruseles',
  },
  {
    fecha: '4 nov', hora: '21:22', chat: 'Carruseles (nube)', sesion: 'cli_daed829d-dde6-5b48-8dd1-048974536370', cuenta: 'nube', actor: 'martin', tipo: 'prompt',
    titulo: 'Corregir lo que salió de la primera carga de la biblioteca',
    pedido: 'La biblioteca ya está en producción con datos reales: esto salió de la primera carga y hay que corregirlo. MEDIDO 4/11, ~21:20 UTC: 160 carruseles guardados, de 10 temas y 7 cuentas. […] PARA CORREGIR: 1. 142 de los 160 quedaron «sin tipo» (87 de temas, 55 de cuentas). El filtro por tipo casi no sirve así: mira por qué el texto no alcanza y clasifícalos mejor, sin inventar. 2. El orden por outlier sube publicaciones personales. El primero de @leilahormozi es una foto de su embarazo («Anytime now….», 9,7×). No sirven como ejemplo de carrusel: busca una forma medible de bajarlas sin esconder lo que funciona, y deja dicho qué cubre y qué no. 3. `buscar` por nombre trae sobre todo cuentas equivocadas […]. Hace falta otra forma de confirmar la cuenta, o que el superadmin cargue los @. 4. Los temas devolvieron 15 a 30 publicaciones de las 80 pedidas; el plan decía «hasta 300» y entraron 97. Corrige lo que promete el plan en seco. 5. @sofiacontreras devolvió 1 publicación: la cuenta probablemente no es la de ella. CRÉDITO: quedan US$1,07 libres este mes para la biblioteca. Nada de lo que corrijas puede necesitar otra carga grande para probarse.',
    puntos: [
      'Llegó por el Cerebro, con lo medido en producción. Lo cortado son los ejemplos de cuentas equivocadas y cómo se sube.',
    ],
  },
  {
    fecha: '4 nov', hora: '21:40', chat: 'Carruseles (nube)', sesion: 'cli_daed829d-dde6-5b48-8dd1-048974536370', cuenta: 'nube', actor: 'claude', tipo: 'correccion',
    titulo: 'La biblioteca de ejemplos: más tipos, lo personal abajo y cuentas confirmadas',
    puntos: [
      'Más carruseles dicen su tipo: se leen listas en inglés y con otros sustantivos («5 formas», «3 lessons»), frases en inglés y el texto de la portada que escribe Instagram, cuando viene. Lo que no dice nada sigue sin tipo.',
      'Lo guardado se vuelve a clasificar gratis, sin pedirle nada a Apify.',
      'Las publicaciones personales (un pie corto sin nada de contenido, o una portada de personas sin texto) van después en «Mayor outlier» y «Más interacción». Se siguen viendo, con su número.',
      'Una cuenta se confirma leyendo su perfil (nombre, verificada, seguidores, publicaciones) antes de sumarla; buscar por nombre ya no da ninguna por buena.',
      'El plan dice cuántos carruseles se esperan con lo medido, no el tope, y una cuenta que trae casi nada se marca «¿es su cuenta?» en la pantalla.',
    ],
    archivos: [
      'lib/carruseles/clasificar.ts — el tipo de un carrusel y si parece contenido, sin IA',
      'supabase/migrations/0393_carruseles_biblioteca_contenido.sql — la señal guardada al leer (sin aplicar)',
      'scripts/carruseles-biblioteca.mts — reclasificar (gratis), verificar, lo esperado y las cuentas dudosas',
      'app/image-editor/carruseles/EditarBiblioteca.tsx — «¿es su cuenta?» y el @ que abre el perfil',
    ],
    revisar: '/image-editor?ver=carruseles',
  },
  {
    fecha: "5 nov", hora: "17:20", chat: "Iniciativa (nube)", sesion: "cli_d5a9b850-5f45-5173-b8c4-5c551ce46310", cuenta: "nube",
    actor: "claude", tipo: "implementacion",
    titulo: "MaKo toma la iniciativa en el Image Editor: «¿Dónde lo vas a publicar?» con el diseño en blanco",
    puntos: [
      "Con una página sin nada y la charla vacía, el chat pregunta un hecho y la respuesta pone el lienzo a la medida de una historia, un carrusel o un anuncio, sin IA y sin la app de escritorio.",
      "Lo contestado vale para ese diseño, y mientras habla el saludo y las sugerencias se esconden.",
    ],
    revisar: "/image-editor",
    archivos: [
      "lib/aperturas/image.ts — la apertura y las medidas, puras",
      "app/image-editor/mako/chat/PanelMakoIA.tsx — el montaje en el chat del editor",
      "tests/iniciativa-image.test.ts — probado rompiéndolo (2 roturas)",
    ],
  },
  {
    fecha: '5 nov', hora: '12:00', chat: 'Image marca (nube)', sesion: 'cli_45e914c6-514d-5f5d-b151-4d8e5f267b67', cuenta: 'nube', actor: 'martin', tipo: 'prompt',
    titulo: 'La marca completa en Image, el manual en el Second Brain y sin Gemini',
    pedido: 'Tres cosas en Image. Medí antes de tocar: lo de abajo viene de una auditoría que no corrió la app. 1. La marca completa en el chat de Imagen: colores, logo y fuentes en el prompt. Con el presupuesto de contexto chico: cada token lo paga el cliente. 2. Brand board en el Segundo Cerebro: el negocio sube el PDF o la imagen de su marca, MaKo extrae colores, fuentes y logo, y el usuario los confirma. Varios kits por negocio (una agencia tiene muchos), uno por defecto. Lo usan Image, Video y Web Generator. MaKo lo pide cuando falta, sin trabar nada. 3. Sin Gemini por defecto en Image: cambialo a la IA del cliente. Además, si te queda claro al leer: SelectorIntencion (Discutir / Editar) falta en el chat de Imagen y en el de Video. Sumalo a la API de MaKo.',
    puntos: [
      'Llegó por el Cerebro (5/11), con la llamada de Leila del 30/10: sus carruseles sólo tomaban el fondo de su marca. Lo cortado son las rutas de archivos y cómo se sube.',
    ],
  },
  {
    fecha: '5 nov', hora: '12:34', chat: 'Image marca (nube)', sesion: 'cli_45e914c6-514d-5f5d-b151-4d8e5f267b67', cuenta: 'nube', actor: 'claude', tipo: 'implementacion',
    titulo: 'Tu marca en Image, Video y Web Generator, con kits en el Second Brain',
    puntos: [
      'En el Second Brain, «Voz y cara» → «Marca»: se sube el manual (PDF o imagen), MaKo saca colores, fuentes y logo, y la persona lo corrige y lo guarda. Varios kits y uno por defecto.',
      'El chat de Image usa la marca: sus colores, las fuentes que el editor tiene y el logo como una foto para poner. Con varios kits, se elige cuál. Sin marca, el chat invita a subir el manual.',
      'Los carruseles de MaKo salen con los colores, las fuentes y el logo del kit (antes, sólo el fondo del tipo).',
      'Video y Web Generator también leen la marca (colores y fuentes).',
      'El chat de Image corre con la IA del negocio (su Claude, su GPT), nunca con Gemini.',
      '«Discutir | Editar» en los chats de Image y de Video: «Discutir» contesta sin tocar nada.',
      'En la API de MaKo: ver_kits_marca, guardar_kit_marca, elegir_kit_marca y borrar_kit_marca.',
    ],
    archivos: [
      'lib/marca/kits.ts — los kits: el saneo, los cambios, el bloque del prompt y lo que lee la IA',
      'lib/marca/leer-manual.ts — MaKo lee el manual (un borrador, sin guardar)',
      'app/second-brain/MarcaView.tsx — la pantalla de la marca',
      'lib/carruseles/marca-kit.ts — el estilo de un carrusel con la marca',
      'lib/chat-editor-discutir.ts — «Discutir» en los chats de Image y Video',
      'lib/model-catalogo.ts — image-editor-ia y marca-leer con la IA del negocio (`deSuIA`)',
    ],
    revisar: '/second-brain?area=voz&vista=marca',
  },
  {
    fecha: '5 nov', hora: '12:30', chat: 'Múltiplo (nube)', cuenta: 'nube', actor: 'martin', tipo: 'prompt',
    titulo: 'El «3,7×» de Top Carousels en Spy y en Carruseles, igual en toda la app',
    pedido: 'Martín, dueño de MaKo, pidió el 5/11: en Top Carousels cada carrusel tiene un botón «3.7×» o «1.4×», igual que en vidIQ, y quiere lo mismo en Competitors Spy y en la sección de carruseles de Image, con reels, carruseles, videos de YouTube y anuncios. — Por el Cerebro: que cada pieza muestre su múltiplo calculado de la misma forma en toda la app, en UNA función pura con test, con la fórmula de su llms.txt: lo que hizo la pieza ÷ la mediana de hasta 20 piezas del mismo creador y formato, las más cercanas en el tiempo; al menos 7 para comparar; sin publicidad pagada, sorteos, comentarios apagados ni lo de menos de una semana. Carruseles e imágenes: me gusta + comentarios; reels y YouTube: vistas, cortos y largos aparte; anuncios: los días activos frente a la mediana del anunciante, con su propio rótulo. El chip en la esquina, lo fuerte resaltado, el tooltip con de qué mediana sale; filtrar por mínimo y ordenar en Spy; en la API y en el chat.',
    puntos: [
      'Llegó por el Cerebro; no se tocó topcarousels.com: la fórmula está en su texto público para agentes.',
      'Reemplaza a las dos cuentas que había (contra la mediana de toda la cuenta, con 3 piezas).',
    ],
  },
  {
    fecha: '5 nov', hora: '13:20', chat: 'Múltiplo (nube)', sesion: 'cli_cea1ca1d-9db2-5b0e-bc67-a60994a6e527', cuenta: 'nube', actor: 'claude', tipo: 'implementacion',
    titulo: 'El «3,7×» en cada pieza de Spy y de Carruseles',
    puntos: [
      'Cada pieza de Competitors Spy lleva su «3,7×» en la esquina: cuántas veces lo que suele hacer esa cuenta, frente a sus publicaciones del mismo formato más cercanas en el tiempo. Lo fuerte (2× o más) va resaltado y el título dice de qué mediana sale.',
      'En Spy se filtra por mínimo (1×+, 2×+, 3×+…) y se ordena por «Mejor rendimiento»; el detalle de una pieza lo dice, o dice por qué no hay número («Sin datos suficientes», «Menos de una semana», «Sorteo»…).',
      'Carruseles de Image y la biblioteca de ejemplos usan el mismo número; los que llegaron por un tema siguen sin número, y el chip dice por qué.',
      'Los anuncios dicen «3× activo»: los días que lleva al aire frente a sus otros anuncios. Es una señal, no un resultado, y lo dice.',
      'YouTube queda listo y apagado hasta el trámite con YouTube (la enmienda III.L): antes «Lo que mejor le fue» lo calculaba sin mirarlo.',
      'MaKo lo dice en el chat: «Lo que mejor le fue» y el número de cada pieza en la ficha de un competidor, y cada carrusel trae de dónde sale su número.',
    ],
    archivos: [
      'lib/multiplo-rendimiento.ts — la única cuenta: formato, métrica, vecinas en el tiempo, exclusiones y cómo se dice',
      'lib/spy-detalle.ts — «Lo que mejor le fue» sobre esa cuenta (se borró `vecesSuMediana`)',
      'lib/spy-vista.ts — el orden «Mejor rendimiento» y el filtro por mínimo',
      'app/competitor-spy/TarjetaPieza.tsx, DetallePieza.tsx, MejoresPiezas.tsx, SpyApp.tsx — el chip, el detalle y la barra',
      'lib/carruseles/explorar.ts y biblioteca.ts — el outlier del explorador, el mismo número',
      'lib/api-mako/areas/spy.run.ts e imagen.run.ts — lo que dice MaKo',
      'tests/multiplo-rendimiento.test.ts — 12 tests, probado rompiéndolo',
    ],
    revisar: '/competitor-spy',
  },
  {
    fecha: '6 nov', hora: '01:23', chat: 'Carruseles rediseño (nube)', cuenta: 'nube', actor: 'martin', tipo: 'prompt',
    titulo: 'Rehacer la tab de carruseles: ejemplos editables, la interfaz de Top Carousels y los anuncios',
    pedido: 'Martín, textual: «no se entiende bien la funcionalidad». — Por el Cerebro: 1. Lo principal al entrar son los ejemplos de carruseles; ahí se elige uno para editar, y recién entonces aparece la vista de edición; la barra lateral de MaKo no se muestra salvo mientras se edita. 2. Copiar la interfaz de Top Carousels: el encabezado «Encuentra tu siguiente OUTLIER» y sus botones, el filtro, las opciones, el diseño de las tarjetas y pasar a la siguiente slide dentro de la tarjeta; sólo la interfaz, nunca sus datos ni sus puntajes. 3. Sacar el texto «De las cuentas que sigues en Competitors Spy y de la biblioteca de ejemplos.», el botón «compacta» y las pestañas «Esta semana» y «Cuentas»; lo que hacían pasa a filtros. 4. Filtro «CTA»: los carruseles que piden «Comenta X palabra», con una regla probada con ejemplos reales. 5. Todos los carruseles tienen que ser EDITABLES, guiándose por «replicate» del Web Generator; generar con IA, con el avatar del cliente, usando su propia IA conectada. 6. «Hacer el mío» salta a un paso «Elige el tipo» que quedó viejo: del ejemplo a la edición, sin pasos que no aporten. 7. Espía de anuncios en imagen: investigar fuentes (la Biblioteca de Anuncios de Meta, Apify, Foreplay, Atria), términos y precios, y sumarlo a esta tab con filtros si se puede con lo que MaKo ya tiene; lo que pida una cuenta o un pago nuevo, anotado para Martín.',
    puntos: [
      'Llegó por el Cerebro. Sacar los carruseles («scrapea todo») lo corre el Cerebro desde la PC; nada se baja de Top Carousels.',
    ],
  },
  {
    fecha: '6 nov', hora: '02:15', chat: 'Carruseles rediseño (nube)', sesion: 'cli_2d35006a-fe6c-5d03-8553-0079fb075fc8', cuenta: 'nube', actor: 'claude', tipo: 'implementacion',
    titulo: 'Carruseles nuevos: los ejemplos primero, «Editar» con tu IA, el filtro CTA y los anuncios de Spy',
    puntos: [
      'Al entrar a Carruseles se ven sólo los ejemplos, sin el chat al costado: «Encuentra tu siguiente OUTLIER», Guardados, Búsquedas guardadas, Seguir cuentas y la búsqueda grande.',
      'Una fila de filtros: Carruseles o Anuncios, Filtros (publicado, láminas, tipo, de dónde), Outlier, CTA, Cuentas y el orden. Se fueron la bajada, «compacta» y las pestañas «Esta semana» y «Cuentas».',
      'En la tarjeta se pasan las láminas (flechas, o el dedo en el teléfono), con el outlier, el CTA que pide («Comenta «GUÍA»») y «Editar».',
      '«Editar» reemplaza a «Hacer el mío»: MaKo lee las láminas con la IA del negocio, escribe el texto para su negocio, pone su foto donde el ejemplo tiene una persona y abre el diseño editable. Se ve armándose lámina por lámina. Sin IA, el mismo diseño con guías y «Conectar mi IA».',
      'Anuncios: los que Spy trajo de las cuentas que sigue el negocio, ordenados por días al aire.',
      'En la API de MaKo: buscar_carruseles filtra por CTA y por anuncios, y editar_ejemplo_carrusel arma la versión del negocio.',
    ],
    archivos: [
      'app/image-editor/carruseles/ExplorarCarruseles.tsx — la pantalla (copiada de la interfaz de Top Carousels)',
      'app/image-editor/carruseles/EditarCarrusel.tsx — «Editar», armándose en vivo',
      'lib/carruseles/replica.ts y replica-servidor.ts — del ejemplo al diseño editable, con la IA del negocio',
      'lib/carruseles/cta.ts — el filtro CTA',
      'lib/carruseles/anuncios.ts — los anuncios de Spy en la misma tab',
      'supabase/migrations/0404_carruseles_laminas_cta.sql — las láminas y el CTA de la biblioteca (sin aplicar)',
      'scripts/carruseles-biblioteca.mts — `laminas`: trae las láminas de lo guardado (lo corre el Cerebro)',
    ],
    revisar: '/image-editor?ver=carruseles',
  },
  {
    fecha: '6 nov', hora: '11:00', chat: 'Carruseles y Thumbnails (nube)', sesion: 'cli_51816bfa-5baf-5efc-81a6-fc18bc5235f4', cuenta: 'nube', actor: 'martin', tipo: 'prompt',
    titulo: 'Lo que vio en producción: OUTLIER como portada, sin CTA ni Biblioteca, sólo imágenes, «Editar» y una tab Thumbnails',
    pedido: 'Martín, textual: «La tab de "Encuentra tu siguiente OUTLIER" tiene que ser la principal, no "¿Qué vas a crear hoy?"... solo quiero carruseles que le sirvan a dueños de negocio... elimina el filtro de "CTA" porque todos le van a servir a dueños, ojo, no necesariamente solo los que tienen CTA, hay algunos que si sirven, reflexiones, o cosas así, que por cierto en el filtro de CTA pusiste puros de DenBorg, no creo que ella sea la que mas carruseles haga... Muchos no tengo el botón para desplazar a la derecha para ver las otras slides... Luego, en anuncios trajiste un montón de videos, cuando estamos viendo solo imagenes. No quiero que esté activado el filtro semanal por defecto. En filtros sigue diciendo "Tamaño de la tarjeta" eso no lo quiero, solo grande... Y enlimina lo de "biblioteca" eso no lo quiero, aparte que esta horrible... También quisiera una tab que sea "Thumbnails", para traer de la misma manera miniaturas top en el mercado, estoy seguro que debe haber una API o un repo o algo que traiga eso...»',
    puntos: [
      'Llegó por el Cerebro, con «Editar» fallando en producción («Tu IA no contestó ahora»). La hora del pedido es aproximada: llegó en el brief de la sesión.',
    ],
  },
  {
    fecha: '6 nov', hora: '12:10', chat: 'Carruseles y Thumbnails (nube)', sesion: 'cli_51816bfa-5baf-5efc-81a6-fc18bc5235f4', cuenta: 'nube', actor: 'claude', tipo: 'implementacion',
    titulo: 'Image abre con los ejemplos; «Editar» sin láminas anda; Thumbnails de YouTube',
    puntos: [
      'Al entrar a Image se ven los ejemplos («Encuentra tu siguiente OUTLIER»); las plantillas quedaron detrás de «＋ Crear desde cero», también en el teléfono. El link de antes (?ver=carruseles) lleva ahí.',
      'Se fueron el filtro CTA (el CTA sigue en la tarjeta), la pastilla «Biblioteca» y «Tamaño de la tarjeta». Ya no arranca con «Últimos 7 días».',
      'Una cuenta no llena la pantalla: como mucho 2 de la misma en cada 12 tarjetas, salvo que elijas esa cuenta.',
      'En «Anuncios» sólo imágenes: los videos no se ven ni cuentan.',
      'Las flechas para pasar las láminas se ven siempre en el teléfono.',
      '«Editar» con un carrusel sin láminas ya escribe la versión con tu IA (antes no probaba tu Claude y cortaba la respuesta); si falla, dice por qué y de quién es, y el diseño con guías se ve.',
      'Thumbnails: miniaturas de YouTube de canales de ventas, marketing, emprendimiento y servicios, con filtros, «Ver en YouTube» y «Editar» en un diseño de 1280 × 720. El múltiplo espera el trámite con YouTube: mientras tanto, las vistas.',
    ],
    archivos: [
      'app/image-editor/page.tsx y ruta.ts — los ejemplos como portada; ?ver=crear para las plantillas',
      'lib/carruseles/variedad.ts — que una cuenta no llene la pantalla',
      'lib/carruseles/anuncios.ts, lib/spy-medio.ts, lib/spy-todo-reglas.ts — los anuncios en video, afuera',
      'lib/carruseles/replica.ts y replica-servidor.ts — «Editar» sin láminas, los avisos y la miniatura de YouTube',
      'lib/thumbnails/ y app/image-editor/carruseles/Thumbnails.tsx — la tab Thumbnails',
      'supabase/migrations/0409_thumbnails_biblioteca.sql — la biblioteca de miniaturas (sin aplicar)',
      'scripts/thumbnails-biblioteca.mts y carruseles-probar-editar.mts — lo que corre el Cerebro desde la PC',
      'docs/carruseles/thumbnails.md — la fuente elegida y cómo se carga',
    ],
    revisar: '/image-editor',
  },
  {
    fecha: '9 nov', hora: '—', chat: 'Carruseles guiados (nube)', sesion: 'cli_5f4ff1ba-719e-5966-b929-17178ada9614', cuenta: 'nube', actor: 'martin', tipo: 'prompt',
    titulo: 'Replicar un carrusel tiene que ser un proceso guiado por MaKo, con la oferta, el avatar y la tipografía fiel',
    pedido: 'Martín, casi textual (llegó en el brief del Cerebro): «Le acabo de dar a crear un carrusel, me llevó directamente al editor y no está bueno eso… lo hizo totalmente mal, no replicó bien el diseño. Sí, son editables las letras, pero se superponen unas con otras, no era la tipografía correcta». «Directamente empieza a replicarlo y dice lo voy a hacer con tu oferta, pero ni siquiera me pregunta qué oferta, si el usuario puede tener muchas ofertas». Al elegir un carrusel, una pestaña donde MaKo pregunta en su chat, «con el tutorial que se opaca la pantalla, que le vaya señalando la pregunta»: qué oferta, qué avatar «si es solo texto, que lo detecte y no le pregunte eso» y qué quiere cambiar. «Hay muchos carruseles que también tienen imágenes… replicarlo con la generación de imágenes que ya tenemos conectada», «copiarle el carrusel de una competencia, pero sacar el avatar de la competencia y reemplazarlo por el mismo». «Nuevo carrusel» muestra los outliers y se elimina «¿Qué vas a crear hoy?». La barra del chat de MaKo nunca desaparece: «si no, yo no tengo forma de entrar, cuando entro a la página de Image, de ver los carruseles que ya estaba creando».',
    puntos: [
      'La hora del pedido no se sabe: llegó en el brief de la sesión de la nube.',
      'El caso de prueba es el carrusel de @growithalex (instagram.com/p/DYfVqEmk_to, 9 láminas), que Martín está haciendo a mano.',
    ],
  },
  {
    fecha: '9 nov', hora: '—', chat: 'Carruseles guiados (nube)', sesion: 'cli_5f4ff1ba-719e-5966-b929-17178ada9614', cuenta: 'nube', actor: 'claude', tipo: 'implementacion',
    titulo: 'Replicar un carrusel pregunta antes: la oferta, el avatar si tiene persona y qué cambiar',
    puntos: [
      'Image abre con el chat de MaKo a la izquierda y los ejemplos en el centro. «Nuevo carrusel» lleva a los ejemplos; las plantillas siguen detrás de «Crear desde cero», donde están las que guardó el negocio.',
      '«Editar» en un ejemplo ya no abre el editor: abre una pestaña con el original y MaKo pregunta en el chat, con la pantalla opacada y la pregunta señalada.',
      'MaKo pregunta para cuál oferta es (o la escribes), con qué foto tuya reemplaza a la persona sólo si el carrusel tiene una, y qué cambiar (textos, tu marca o lo que escribas). Si no sabe si tiene persona, lo dice y te deja contestar.',
      'La oferta elegida va en el pedido con sus datos (qué promete, para quién, qué incluye, garantía y precio) y una oferta de otro negocio se rechaza antes de llamar a la IA. La API de MaKo acepta lo mismo (ofertaId, avatar, cambio).',
      'Al generar, cada lámina de tu versión sale al lado de su original para juzgarla antes de abrir el editor.',
      'Quedó escrito, sin pantalla todavía: elegir la fuente comparando el recorte contra fuentes candidatas, ajustar cada texto a su caja sin que se pisen, los pasos de cada lámina para sacar el texto o cambiar a la persona, y el lettering como capa que se regenera sola.',
    ],
    archivos: [
      'lib/carruseles/guiado.ts — las preguntas, el orden y el pedido que sale (puro)',
      'app/image-editor/carruseles/ReplicarGuiado.tsx — el chat que pregunta y el centro con el original',
      'app/image-editor/guia-image.ts — la guía de Image (la pregunta señalada con el velo)',
      'app/_crear/PantallaCrear.tsx — `nueva` y `alNuevo`: lo que la tab pone en lugar de «¿Qué vas a crear hoy?»',
      'app/api/image-editor/carruseles/leer/route.ts — ¿tiene persona? (con la IA del negocio)',
      'lib/carruseles/replica.ts y replica-servidor.ts — la oferta, la foto elegida y los colores de la marca en el pedido',
      'lib/carruseles/tipografia-medida.ts — encajar, no superponer, elegir la fuente comparando',
      'lib/carruseles/plancha.ts — los pasos de cada lámina y la capa de lettering',
      'docs/relevo/nube-carruseles-guiado.md — el diseño y lo que falta',
    ],
    revisar: '/image-editor',
  },
];
