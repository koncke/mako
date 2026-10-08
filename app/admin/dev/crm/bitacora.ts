// =============================================================================
// CRM — el registro de construcción del área
// =============================================================================
// Alcance: los leads del negocio. El tablero por etapa, la tabla, «Datos sin
// marcar», la ficha, el alta (manual, importada, por webhook, por landing y por
// canal), la bandeja de propuestas y el resumen del lead para el celular.
// Vive en: app/crm/*, lib/leads.ts, lib/pipeline.ts, lib/leads-duplicados.ts,
// lib/stage-requirements.ts, lib/propuestas.ts, lib/lead-resumen.ts.
//
// De dónde salió esto: los mensajes de commit de agosto de 2026 (que en este
// repo explican el POR QUÉ y son la fuente principal), docs/hallazgos-crm.md
// para las trampas vivas, y docs/chats.md para el nombre de cada sesión — que
// llega solo hasta el 8 de agosto, así que de ahí en adelante el `chat` es el
// título corto con el que se trabajó la tanda («Productos X Funnels»,
// «Integraciones», «CRM»).
//
// NO es un changelog. Lo que git ya guarda no se repite: va el motivo, la
// trampa y —sobre todo— cuándo el diagnóstico obvio era el equivocado.

import type { Hito, Parte } from '../_registro/tipos';
// ⚠️ ESTO SE QUEDA VIEJO SOLO, y se quedó: Martín lo miró el 30/09 y dijo «creo que el
// Roadmap era viejo, cosas que ya habíamos hecho». Tenía razón — el área había recibido
// 41 commits en septiembre (el embudo por producto, el pop-up que lo edita, los leads
// entre productos) y ninguno figuraba acá. Cuando se cierre una parte o nazca otra, se
// toca ESTA lista: el contador «N de M» del encabezado sale de acá, así que un roadmap
// viejo no se lee como incompleto, se lee como que el área no avanzó.
export const PARTES: Parte[] = [
  { titulo: 'El tablero, la ficha y el corte por etapa', detalle: 'Kanban · tabla · «Datos sin marcar» · y mover un lead exige lo que esa etapa necesita', estado: 'hecha' },
  { titulo: 'Una sola puerta de alta', detalle: 'createLead con anti-duplicado propio · el lead de landing entra solo · los webhooks avisan cuando fusionan', estado: 'hecha' },
  { titulo: 'La bandeja de propuestas', detalle: '/crm/revisar: lo que escribe un canal se confirma antes de valer', estado: 'hecha' },
  { titulo: 'El resumen del lead', detalle: '/crm/[id]/resumen para leer en el celular · el análisis de la llamada a un botón', estado: 'hecha' },
  { titulo: 'Un embudo por producto', detalle: 'Cada producto con sus etapas, su TOFU y su tablero de leads (mig 0181)', estado: 'hecha' },
  { titulo: 'El embudo se edita DENTRO del CRM', detalle: 'Etapas, entradas y nutriciones en un pop-up · el editor viejo y la ruta /funnel se retiraron', estado: 'hecha' },
  { titulo: 'Los leads se mueven entre productos', detalle: 'Traerlos de otro embudo con filtros y en lote · y aviso si esa persona ya está en otro', estado: 'hecha' },
  { titulo: 'Aislamiento del CRM por workspace', detalle: 'Ningún módulo de cliente lleva datos del dueño · un lead ajeno dice qué pasó en vez de un 404', estado: 'sigue' },
  { titulo: 'El lead y lo que se le vendió', detalle: 'leads.producto_id sigue sin una sola línea que la lea o la escriba: hoy el vínculo es funnel_id', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  {
    fecha: '4 oct', hora: '16:01', chat: 'CRM depuracion', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Todo lo que se pueda sin intervencion suya',
    pedido: 'Bien, ahora comienza a solucionar absolutamente todo lo que puedas hacer sin mi ayuda o intervencion, lo que ya tengas claridad... No importa si esta a futuro o lo que sea, hazlo todo.',
    puntos: [
      'El filtro no es «lo urgente» sino **«¿necesito que Martin decida algo?»**. De las 25 del CRM eso da SEIS mas una nueva: todas con archivo y linea medidos el 03/10, ninguna con una decision adentro.',
      'Lo que NO entro por eso: prender el motor automatico, conectar su linea de WhatsApp y su agenda, filtrar los 100 en la planilla, tachar el proyecto gemelo y escribir el texto de las nutriciones. Cinco cosas, y ninguna es codigo.',
    ],
  },
  {
    fecha: '4 oct', hora: '16:01', chat: 'CRM depuracion', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Siete arreglos en cuatro paquetes, y el bloqueante que aparecio al juntarlos',
    puntos: [
      '**Cuatro paquetes en paralelo, sin un solo archivo compartido** — importacion+origen, leads+fathom, calendly y la cuota. El reparto por archivo es lo correcto y GARANTIZA salidas huerfanas, asi que cerro una revision cruzada que leyo los caminos de punta a punta.',
      '⚠️ **Y encontro un bloqueante que no era de ningun paquete.** Abrir una fuente nueva de links —los que una persona pega a mano en la ficha— y negarse, con razon, a que eso afirme la asistencia significa devolver `null`. Y `applyFathomRecording` resuelve `attended ?? true`: **ese `null` entraba como un SI**. El lead quedaba marcado como asistido, cambiaba de etapa y disparaba el QualifiedLead de Meta, que el revert no deshace. Los dos lados estaban bien; **el contrato entre ellos no existia**, y vivia en `lib/crm-auto.ts`, que ningun paquete tenia asignado.',
      '**Lo que se borro era una trampa cargada, no codigo muerto.** `importLeadsCsvAction` tenia cero call sites y era el camino «sin revision»: le pasaba al porton filas con `incluir: true` de fabrica, o sea exactamente el bug que el porton venia a cerrar, esperando a que alguien la llamara.',
      '**Y `channelOf` convertia un lead en «de donde vino» sin que nadie leyera el resultado.** El arreglo del origen habia entrado en las DOS funciones del archivo y solo una se dibuja — un guard sobre la huerfana da verde sobre una pantalla que miente, y ademas la mantiene viva.',
      '**La mitad que la corrida no vio:** /crm/revisar siembra sus filas con el tilde puesto y sin saber si son duplicados (el motivo lo descubre el server despues de que la pantalla se dibujo). Honrar ese tilde es crear el duplicado Y atribuirle la decision a alguien que nunca la vio.',
      '2997 tests en verde. Los cinco guards nuevos se probaron rompiendolos; el del bloqueante cayo en las cuatro roturas (1, 2, 1 y 1 fallo).',
    ],
    commits: [
      { sha: '01cf2164', msg: 'CRM: las seis que no necesitaban una decision, y el bug que destapo juntarlas', lineas: 2676, archivos: 30 },
    ],
    archivos: [
      'lib/crm-auto.ts — el bloqueante: `marcarAsistencia` y las filas de confirmacion que cuelgan de lo que de verdad paso',
      'app/crm/leads-importar.ts — `entra()`, la unica respuesta a «¿esta fila entra?» para los tres lectores',
      'app/crm/origen-lead.ts — el catalogo de origenes (nuevo)',
      'lib/fathom-auto.ts · lib/auto-reuniones.ts · lib/leads.ts — las grabaciones, el vendedor unico y los seis `.maybeSingle()`',
      'docs/hallazgos-crm.md · docs/hallazgos-integraciones.md · AGENTS.md — la cosecha y las dos reglas nuevas',
    ],
  },
  {
    fecha: '3 oct', hora: '22:06', chat: 'CRM depuracion', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Con el panorama encima, que entra y que sale del CRM',
    pedido: 'Bueno, con todo este panorama, ahora si hazme una depuracion de las tareas del proyecto de CRM y proponme que si y que no',
    puntos: [
      '«Con todo este panorama» es la parte que cambia el trabajo: el runway del 03/10 (US$2.000 de un solo cliente, la venta del 1/11 al 15/12) y, sobre todo, que el usuario numero uno de este CRM de aca al 18/10 **es Martin prospectando en frio con 1.000 contactos importados**. Ese CRM tiene hoy **3 leads**.',
      'La misma pregunta sin ese marco ya se habia contestado el 30/09 y dio **0 de 25 cerrables**. Con el marco puesto, la pregunta deja de ser «¿esta hecho?» y pasa a ser «¿el negocio corre sin esto?» — y ahi si corta.',
    ],
  },
  {
    fecha: '3 oct', hora: '22:06', chat: 'CRM depuracion', cuenta: 'claude2',
    actor: 'claude', tipo: 'investigacion',
    titulo: '25 abiertas a 6 con fecha, y tres cosas que no tenian tarjeta',
    puntos: [
      '**El reparto: 6 entran, 15 se posponen, 4 se van del tablero.** Entran las cinco que Martin ya habia mandado al P1 el 01/10 (#621, #702, #39, #38, #174) mas una nueva por el bug de abajo. Se cierran #37 y #698 (hechas), y #627 y #15 se funden en #798 y #40 **arrastrando su texto**, que es la unica forma de que lo que falta no desaparezca.',
      '⚠️ **LA IMPORTACION AUTORIZA EL DUPLICADO QUE LA PANTALLA DICE QUE DESCARTO.** La fila repetida se dibuja gris, con la casilla vacia y el cartel «ya existe», y el server la crea igual con `permitirDuplicado: true`. Cuatro piezas correctas por separado: nace con `incluir: true`, `recalcular` solo escribe `motivo`, la UI no deja destildar una fila marcada, y el server saltea solo con `!f.incluir`. Vive desde el 14/08. El boton dice «Crear 80 leads» y entran 80 **mas** las repetidas — y el contador no lo delata porque mide bien: cuenta solo las limpias.',
      '⚠️ **EL WORKSPACE DONDE VA A PASAR LA PROSPECCION NO TIENE CANAL, NI AGENDA, NI MOTOR.** Medido en prod: sin linea de WhatsApp, sin interruptor de envio (fail-closed = apagado), cero credenciales de agenda, el motor automatico apagado, y **un unico usuario que es admin** — asi que `vendedorUnicoDelWorkspace` lo filtra y los 1.000 nacerian sin setter ni closer. **No es codigo: son filas que ese inquilino nunca creo**, y por eso ninguna auditoria del repo lo encuentra.',
      '**Dos tarjetas pueden pasarse el mismo defecto y dejarlo en CERO tarjetas.** #37 lo cerro diciendo «eso es el pendiente de #701» y #701 lo pospuso diciendo «vive en la funcion que ya es el pendiente de #37». Cuando un veredicto justifica una salida con «eso lo cubre la otra», hay que ir a leer que dice la otra.',
      '**Tres lectores describieron la misma pantalla de tres formas incompatibles y las tres estaban mal**: el server hace algo peor que las tres. Tres descripciones distintas de una misma pantalla no son tres matices — es que nadie leyo el camino entero.',
      '**Un refutador cambio el SUJETO de una tarjeta y con eso su fecha**: #174 se leia como «un cliente nuevo que conecta su agenda» (venta del 1/11); medido, el cliente nuevo sin agenda conectada **es Martin**, y eso la corre al 17/10.',
      '**Calibrar el refutador por CLASE fue lo que hizo que cortara.** Un solo refutador con una sola vara da el 80% de refutacion que esta casa ya midio; con tres varas distintas —cerrar es irreversible, posponer puede costar plata, meter al P1 es lo que ya rompio el plan dos veces— cayeron 6 de 25, y los seis por motivos distintos.',
    ],
    commits: [
      { sha: '984ca9cd', msg: 'Depuracion de «Feature: CRM»: 25 abiertas -> 6 con fecha', lineas: 0, archivos: 5 },
    ],
    archivos: [
      'docs/depuracion-crm-03oct.md — la propuesta: que entra, que se pospone y que se va, con lo que el 17/10 necesita y no tiene tarjeta',
      'docs/hallazgos-crm.md — los tres hallazgos medidos y lo que enseño la corrida',
      'AGENTS.md — la regla: si la pantalla DESHABILITA un control, el server aplica lo que ese control significa',
      'app/admin/dev/crm/auditoria.ts — la nota de que la foto del 30/09 tiene una medicion mas nueva que le gana',
    ],
  },
  {
    fecha: '30 sep', hora: '11:33', chat: 'CRM tanda 6', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'El editor de nutricion, el titulo que dice otro nombre y las flechas sin rotulo',
    pedido: '1. El editor de "Nutricion" debe ser parecido al de Etapas, solo que hay que agregarle de que depende que se dispare esa nutricion... Por ejemplo, la nutricion de "No show" tiene obligatoriamente que el lead venga de "Agenda R1"... Pero debe ser dinamico, si yo cambio el nombre, si pongo R1, R2, etc... Las nutriciones deben respetar eso. Y faltan muchas cosas en esa vista, no hay opcion de agregar, de eliminar, etc... Pon por defecto muy pocas nutriciones. Pon la de "No Agenda" - "No Show" - "Reactivacion", ya si el usuario quiere puede crear mas. / 2. Que la linea divisoria este debajo de "Nuevo producto" y que el "Productos eliminados" este centrado. / 3. Y en los 3 puntos, el boton de mover, no deberia tener la palabra mover, solo las flechas. Deberia estar primero de todos ese boton, y en realidad, deberian ser 2 botones diferentes, solo que estan en la misma linea. / 4. No cambio nada el editor de nutricion. / 5. Y no entiendo porque se llama "Funnel principal" cuando en el desplegable me dice "Negocio que escala" eso esta muy mal...',
    puntos: [
      '⚠️ **El 4 no era un bug: era trabajo SIN COMMITEAR.** El editor de nutricion se habia implementado entero —cinco archivos, verificado en el navegador— y la sesion siguio con los pedidos siguientes sin cerrar ese. Martin abrio `hola-mako.com` y vio la version anterior, que es lo correcto. El reporte se lee exactamente igual que una feature rota y manda a depurar codigo que esta bien.',
      '⚠️ **Y el 5 tampoco era cosmetico.** Ese titulo es un `<input>`: es el `defaultValue` del campo que renombra el producto y el valor contra el que se compara para decidir si escribir. Con «Funnel principal» ahi, quien renombraba arrancaba desde el valor equivocado — y tipear el nombre que el producto YA tenia contaba como un cambio.',
      'El 1 llego con su medicion al lado: los 13 embudos vivos suman **99 casillas**, 7,6 de promedio y 9 en la forma mas comun. De esas 9, solo 5 son de verdad una nutricion.',
    ],
  },
  {
    fecha: '30 sep', hora: '11:33', chat: 'CRM tanda 6', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La nutricion pasa a ser una lista editable, y el nombre del embudo sale de UN lugar',
    puntos: [
      '**La subtab deja de ser casillas.** Una fila por nutricion con su segundo renglon («Sale de X · por que»), su ✕ y un «Agregar» al pie. «Sale de X» es TEXTO y no un desplegable: Martin dijo «obligatoriamente», asi que lo decide la FORMA del recorrido — un selector ahi prometeria poder cambiar un hecho. Lo dinamico es el nombre, que sale de la clave de la etapa.',
      '**Cuatro cosas estaban mal en la lista, y ninguna daba error.** `noshow_r3` era un `transitions.push` a mano que IGNORABA `suppressed` (se destildaba y volvia tildada sola); la Reactivacion entera colgaba de `firstMeeting`, asi que un embudo sin reuniones no podia reactivar a nadie; `ETAPAS_SIN_SECUENCIA` vivia detras de `server-only` —una decision tomada que la pantalla no podia leer, y una fila que decia literal «No Paga → Reunion excepcional»—; y una nutricion con dos origenes se dibujaba como dos casillas con el mismo nombre, asi que apagar una la dejaba corriendo.',
      '**El rotulo salia del catalogo de FABRICA**: `cfg.labels` solo tiene las terminales renombradas y de ahi caia al catalogo, que no conoce las claves de un pipeline propio. El ws13 veia `st0` y `st1`. Con `cfg.stages` primero, «si yo cambio el nombre, si pongo R1, R2...» se cumple solo, sin un campo mas.',
      '**Las tres por defecto se CALCULAN** (`suppressedInicial`), no se escriben por plantilla: las ids de `suppressed` salen de las claves del pipeline y una lista fija se rompe en cuanto alguien agrega una reunion. Va en `crearFunnel`, que es el choke point — de sus tres llamadores uno solo pasaba la lista. Y SOLO al crear: suprimir una nutricion borra su etapa del tablero, y este repo ya pago esa cuenta con 1.057 leads del ws1.',
      '**El nombre del embudo queda en UNA funcion** (`productosPorFunnel`), que llaman el desplegable y el pop-up. El otro lector de la vista se queda: `renombrarFunnel` pide el `producto_id` para ESCRIBIR, que es otra pregunta. El guard cuenta cuantos lugares resuelven el nombre — si son dos, vuelven a divergir.',
      '**Un renglon de menu sin rotulo son DOS botones** (`soloAcciones`), no un renglon con el texto vacio: el renglon con `acciones` le da el `flex: 1` al rotulo, asi que vaciarlo deja media fila que se ve clicable y no hace nada. Y su hover va inline, porque el `Dropdown` se dibuja por PORTAL y el velo de `.crm-hover` del `<main>` no lo alcanza.',
      '**Las guardas se probaron rompiendolas**: 13 roturas, 13 cazadas. La de `NUTRICIONES_POR_DEFECTO` sin `reactivacion` tira 2 de 8; las otras doce, una cada una. Suite entera: 2788 en verde.',
    ],
    commits: [
      { sha: 'f0117f0e', msg: 'crm: el editor de nutriciones, el titulo que decia otro nombre y las flechas sin rotulo', lineas: 763, archivos: 13 },
    ],
    archivos: [
      'lib/pipeline.ts — las nutriciones por defecto, `suppressedInicial` y `ETAPAS_SIN_SECUENCIA` (sin `server-only`, para que la pantalla las pueda leer)',
      'app/crm/EtapasModal.tsx — la subtab de nutricion: quitar, agregar y el «de que depende»',
      'lib/funnels.ts — `productosPorFunnel`, el unico cruce funnel → producto → nombre',
      'app/components/Dropdown.tsx — `soloAcciones` y el filete debajo de «Nuevo producto»',
    ],
  },
  {
    fecha: '30 sep', hora: '05:40', chat: 'CRM tanda 4', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Diez cosas: el desplegable, el hover, las columnas, el aviso y los leads en varios productos',
    pedido: '1. Si abro un desplegable, todo lo de abajo lo tiene que englobar el recuadro, sino, no se entiende... Y aun sigue el texto informal de "Como entra tu gente" por favor, eliminalo. Y si le doy al lapiz, deberia aparecer una X de cerrar, y si cierro ahi nuevamente el lapiz. / 2. En todos los botones si les paso el cursos deberia pasar algo. / 3. En las columnas del CRM, si agarro una, deberia dejar arrastrar tambien, para cambiar el orden. Como tambien si le doy click a un titulo, dejarme cambiar el nombre. / 4. En los tres puntos, si no se peude eliminar, no pongas directamente esa opcion, no la dejes en gris. Y en lugar de "Agregar etapa despues" simplemente "Agregar etapa". Y tambien pon un boton doble, que este en la misma linea y se divida a la mitad. Que tenga los iconos de flechas al costado, y que cada uno sirva para mover la etapa de lugar. Obvio a los que no se puedan mover, que no tengan esto. / 5. Me sigue apareciendo el mensaje de "MaKo movio 3 leads" por mas que estoy parado en otro funnel/producto. / 6. Elimina todo el recuadro de "Todavia no hay leads para mostrar / Importa un CSV o carga tu primer lead para empezar." / 7. En todos las columnas, siempre al principio un "placeholder" mas finito que las cards normales, que diga "Nuevo lead". / 8. Elimina el boton de "Importar csv" para eso ya estan los 3 puntos de arriba del todo... Que simplemente sea "Importar leads". Y que dentro del pop-up que aparece, me de la opcion de importar leads de otro producto, para que sea facil. Y elimina el chip de "CRM automatico: ON" y ponlo como opcion en los tres puntos, y en lugar de que diga "ON" que este el tipico boton de encendido que se desplaza hacia un lado, tambien que tenga un signo de pregunta al lado del titulo que explique que hace eso. / 9. Dentro del detail de un lead deberia salir el mismo desplegable de productos, para que se puedan ver los detalles de ese lead en el recorrido de ese funnel. Si ese lead NO esta en el producto que seleccione, que me de la opcion de cargarlo y que lo cargue automaticamente como lead entrante... Tambien te pido que revises muy bien los datos de leads en multiples funnels... Por ejemplo, un lead pudo entrar al funnel 1 por X campana y X anuncio, y haber mirado X parte del VSL... Pero en el funnel 2, pudo haber entrado por otra campana, otro anuncio, y haber mirado OTRO VSL, con otro % de reproduccion... Y asi con todos los datos, se tienen que diferenciar. / 10. En nuevo lead me tiene que dar la opcion de traer un lead de otro producto, que este aparte esa opcion claro, no dentro del formulario. Tambien tienes que asegurarte que los leads no se dupliquen entre productos... si se detecta que se esta agregando un lead nuevo, pero que ya esta en otro funnel, que coincide con nombre, email, numro o algo, que le advierta que el lead ya existe y que le pregunte si lo quiere traer.',
    puntos: [
      '⚠️ **El 9 no es un pedido de pantalla: es un pedido de MODELO.** «Un lead pudo entrar al funnel 1 por X campaña… pero en el funnel 2, por otra campaña, otro anuncio, otro VSL». Hoy la persona es UNA fila y su recorrido son columnas de esa misma fila: un solo recorrido, una sola atribución, un solo `visitor_id`.',
      'Y el 2 era mucho más grande de lo que parece: medido, **145 de 149 botones del CRM no reaccionaban al cursor**, y los 4 que sí lo hacían usaban cuatro mecanismos distintos.',
    ],
  },
  {
    fecha: '30 sep', hora: '05:40', chat: 'CRM tanda 4', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Ocho de diez, y un backfill escrito en un doc que vaciaba el CRM de los 6 workspaces',
    puntos: [
      '⚠️ **LO MÁS CARO NO ERA UN PEDIDO: era una receta de migración escrita en `docs/modelo-oferta-producto-funnel.md`**, lista para copiar, con un `update leads set funnel_id = p.funnel_id`. El tablero del embudo por defecto busca los leads con `is(funnel_id, null)` y **los 1.530 de los 6 workspaces lo tienen en NULL**: correrla dejaba el CRM en cero para todo el mundo, sin un error y sin una fila borrada. Un SQL en un documento no es una nota — es una instrucción con la autoridad del repo. Desarmada, con un guard que barre migraciones Y docs.',
      '**El velo de hover va en el choke point y con `box-shadow`, no con `background`.** De los 145 botones mudos, **129 escriben `background` inline y 129 `color`**, y un estilo en línea le gana a cualquier regla de hoja. Lo que estaba libre: `filter` (0/145), `outline` (0), `box-shadow` (1). Una regla en `ui.css` + la clase en el `<main>` de las tres rutas: 145 de 145, y los botones que todavía no existen la heredan.',
      '**Los leads entre productos, la mitad que sí se puede hoy:** el aviso de duplicado dice EN QUÉ producto está el que ya tienes y ofrece tres salidas (Abrir · Moverlo aquí · Crear igual); hay un buscador aparte del formulario para traer uno de otro producto; y el modal de importar tiene un segundo origen para traerlos en lote. Mueve, y lo dice con esa palabra: con el producto en una sola columna, traer a alguien acá es sacarlo de allá.',
      '⚠️ **Y entra por la etapa de ENTRADA del embudo destino**, que es lo que se pidió y además lo único que no miente: la etapa del embudo A es una clave SUYA y puede no existir en el B — conservarla dibuja al lead recién traído como «fuera del embudo».',
      '⚠️ **`importarLeadsRevisadosAction` no pasaba el funnel**: todo CSV importado desde un producto secundario nacía en el embudo del negocio y desaparecía de la pantalla donde se lo acababa de importar. El alta manual tenía el mismo bug arreglado desde el 28/09 por el otro camino, y nadie cruzó los dos.',
      '⚠️ **`funnel_id = null` y el id del embudo por defecto son EL MISMO LUGAR**, y hay un tercer valor que no es ninguno de los dos: `undefined`, que es lo que devuelve la columna cuando la consulta no la pidió. Comparar los números crudos diría «está en otro producto» sobre cada lead que existe hoy.',
      '**Medido para el 9, y decide el diseño:** 750 visitantes ya miraron más de una landing, `leads.visitor_id` es UNA columna, y el tracking del VSL descarta la segunda cookie en silencio. O sea que el recorrido por producto no falta por falta de pantalla: falta porque el dato no se está guardando.',
      '⚠️ **Y el guard nuevo se acusó a sí mismo en el commit que lo escribió**: la entrada de hallazgos que documenta el backfill pega el SQL culpable adentro de un bloque de código. 2.687 tests, 1 rojo, sobre un documento. Tercer caso del mismo día de «un guard que mira la PALABRA no distingue el código del texto que lo explica».',
    ],
    archivos: [
      'app/_ui/ui.css + app/globals.css — el velo de hover, en el choke point, con su token en los dos temas',
      'app/crm/MoverPartido.tsx — el botón doble, en UN lugar: vertical en el pop-up, horizontal en la columna',
      'app/crm/lead-view/ProductoDelLead.tsx — el desplegable de productos en la ficha del lead',
      'app/crm/CrmBoard.tsx — columnas arrastrables, título clicable, placeholder «Nuevo lead» y el menú sin opciones en gris',
      'app/crm/CrmToolbar.tsx + CrmAutoToggle.tsx — el header sin «Importar CSV» ni el chip, y el CRM automático como fila del menú',
      'app/crm/EtapasModal.tsx — la caja que engloba el panel, y el lápiz que se vuelve una ✕',
      'app/crm/ImportarLeadsModal.tsx — el segundo origen: traer leads de otro producto',
      'app/crm/new/NewLeadForm.tsx — el aviso de duplicado con sus tres salidas y el buscador aparte',
      'app/_components/MakoConfirmGate.tsx — el aviso de MaKo, acotado al producto que se está mirando',
      'lib/leads.ts + lib/leads-duplicados.ts — moverLeadDeFunnel, el duplicado que nombra el producto y enOtroProducto',
      'docs/modelo-oferta-producto-funnel.md — el backfill desarmado, con la medición al lado',
      'tests/leads-por-producto.test.ts — 10 guards, probados con 14 roturas',
    ],
  },
  {
    fecha: '30 sep', hora: '01:20', chat: 'CRM embudo pop-up', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Las líneas otra vez, la lentitud otra vez, la etapa de entrada y el alta en 3 pasos',
    pedido: '1. Te pedí que eliminaras las lineas divisorias. / 2. Al abrir sigue tardando mucho en cargar... / 3. Por defecto, la primer etapa debería ser "Lead entrante", no se debería poder mover, y tampoco nadie puede poner algo atrás de esa etapa. Y desde allí debería salir el desplegable para configurar. Para ello, mejor un botón de lapiz, en lugar de las flechas y la X, ya que no serán necesarios. / 4. Nuevo producto hazlo modular el formulario, en 3 pasos, no todo junto.',
    puntos: [
      '⚠️ **Las líneas se pidieron TRES veces.** Las dos primeras se sacaron las de la LISTA; las que quedaban las dibujaba `Modal` —cabecera, entre bloques del cuerpo y pie— y este archivo no las podía tocar. Por eso la prop terminó en la primitive y no acá: quien la pide, la pide para la caja entera.',
      '⚠️ Y el 2 es el segundo reporte de lo mismo: **el arreglo anterior era correcto y no movió el número**. Ver la implementación de abajo.',
    ],
  },
  {
    fecha: '30 sep', hora: '01:20', chat: 'CRM embudo pop-up', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El pop-up abre en 167 ms porque dejó de preguntar lo que ya estaba en pantalla',
    puntos: [
      '⚠️ **Diferir una consulta a una SEGUNDA server action no la saca del camino crítico: la pone DETRÁS.** Next.js las despacha de a una. Medido con un `fetch` instrumentado desde el click: la primera sale a +121 ms y vuelve a +439; la segunda sale a **+442** —3 ms después— y vuelve a +752. Por eso sacar dos consultas del detalle bajó la action de ~550 a 250 ms **sin mover el tiempo hasta dibujar**: 1036 ms contra 1053.',
      '**Lo que lo arregló fue no preguntar.** Las etapas ya estaban dibujadas arriba, como las columnas del tablero, y viajan como prop desde el server en cada carga. El pop-up abre pintando eso y el server confirma detrás: **941 ms → 167 ms**, con las dos listas idénticas (comparadas al abrir y tres segundos después: no parpadea).',
      '⚠️ **El mapeo se mudó a `etapasVisibles` en `lib/pipeline.ts` y lo llaman los DOS.** Con dos copias, el pop-up abre mostrando una lista y medio segundo después muestra otra. Y la semilla va **sólo** si abre sobre el embudo que se está mirando: desde el desplegable se edita otro producto sin cambiar de tablero. Lo que el tablero no sabe —si se ofrece «Eliminar producto», las nutriciones, las entradas declaradas— sigue esperando al server, porque pintar las casillas vacías le diría a un negocio que las declaró que no tiene ninguna.',
      '⚠️ **La etapa de entrada es un `kind`, no la posición 0.** Atarla al índice haría que arrastrar otra etapa encima la convirtiera en la entrada, que es justo lo que el pedido prohíbe. Medido antes de atarlo: de 15 embudos, los 11 con pipeline propio declaran exactamente una `entrada` y los otros 4 caen al default, que también la trae. Su único control es el lápiz —tres botones apagados dicen lo mismo que uno útil, pero se leen como que la app está rota— y de ahí cuelga «Cómo entra tu gente», pegado a su fila y no al final de la lista.',
      '**Y las CUATRO puertas al orden se cierran en el server**, no en la pantalla: eliminar, mover, reordenar (un arrastre) e insertar (el deshacer de un borrado). La pantalla ya no lo ofrece; el que decide es el server.',
      '⚠️ **El rótulo por defecto decía «Lead (Instant form)»** — el nombre de UNA de las cinco formas de entrar, en la etapa por la que entran las cinco. Cambiar el default no alcanza: 10 embudos tenían NUESTRA cadena congelada en su jsonb. Va con backfill (mig 0182) comparando contra la cadena exacta, así el único renombrado de verdad («Contacto nuevo», ws11) queda intacto. Verificado: 10 cambiados, 0 viejos, 1 intacto, orden sin tocar.',
      'El alta de producto quedó en **tres pasos, uno por pantalla**, con alto FIJO (los tres miden distinto y una caja que se encoge entre dos pantallas de la misma tarea ya se pidió no hacer dos veces) y validando cada paso lo suyo: un error que sale al final manda a buscar cuál de las tres preguntas fue.',
      '⚠️ **Y un gotcha del `Modal` que costó un renglón:** cada hijo directo de `.mk-modal__cuerpo` trae `padding: 18px 0`, así que dos bloques sueltos quedaban con ~48 px de hueco en el medio. El contenido del paso va adentro de UN solo `div`.',
      'Los cuatro guards nuevos se probaron rompiéndolos, 12 roturas. ⚠️ **Una no rompió nada**: para ver si el test caza que `Modal` deje de emitir `data-sin-filetes`, se lo cambió por `data-sin-filetes-NO`, que el propio regex sigue matcheando. El guard estaba bien; la rotura estaba mal.',
    ],
    archivos: [
      'app/crm/EtapasModal.tsx — la semilla, la etapa de entrada con su lápiz, y «Cómo entra tu gente» pegado a su fila',
      'app/crm/CrmBoard.tsx — le pasa al pop-up las etapas que ya dibujó, sólo si es el embudo que se está mirando',
      'lib/pipeline.ts — `etapasVisibles` (el mapeo, en UN lugar) y el rótulo «Lead entrante»',
      'app/crm/actions.ts — las cuatro puertas al orden del pipeline, del lado del server',
      'app/crm/CrmToolbar.tsx — el alta de producto en tres pasos, con alto fijo',
      'app/_ui/Modal.tsx + app/_ui/ui.css — `sinFiletes`: apaga los tres filetes de la caja',
      'supabase/migrations/0182_lead_entrante.sql — el backfill del rótulo, contra la cadena exacta',
    ],
  },
  {
    fecha: '29 sep', hora: '23:40', chat: 'CRM embudo pop-up', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Once cosas mal en el pop-up, cuatro en el alta y tres en el desplegable',
    pedido: '1. Dos botones de cerrar... No entiendo la logica de eso... Elimina el botón de abajo. / 2. Elimina todas las lineas divisorias, quedan mal. / 3. Elimina "En todos tus embudos", si quieren cambiar el nombre ya lo pueden hacer en los 3 puntos de la columna. / 4. "Eliminar este embudo" debería ser "Eliminar producto" y debe estar abajo del todo a la izquierda. A la altura del botón de "Cerrar" azul que hay. Pero este botón de eliminar solo como texto rojo, no como botón. / 5. Si intento eliminar una columna que NO tiene ningún lead, no debería haber nada de fricción. Solo que me salte el pop-up de deshacer que dura 5 segundos. Lo mismo con un producto sin leads. En caso de que si tengan leads cualquiera de las 2 opciones, debería saltar otro pop-up de confirmación, no un recuadro abajo. / 6. Cuando muevo de lugar una columna o etapa, se tarda muchísimo. / 7. Debería poder agarrar y arrastrar las etapas a donde yo quiera. Replica el diseño que hicimos en el plan. / 8. Solo si clickeo en el texto del título de esa etapa debería abrirme el input, no en toda la fila. / 9. Agregar etapa si le paso el cursor debería reaccionar y al apretarle como mínimo que me pida el nombre. / 10. Cuando entro a editar un producto queda en "cargando", no debería tardar nada eso... Y en todo caso un LOADER siempre, no el texto de cargando. / 11. Elimina la tab de "Cómo entran", eso debería estar como un paso al momento de crear un nuevo producto. Y en esas opciones hay más de las necesarias y está sobre explicado... 1. Llenan un formulario. 2. Agendan llamada. 3. Te escriben. 4. Tú les escribes. 5. Compran en el carrito... Y que es eso de "Así entra mi gente" no puede ser más informal ese texto de ese botón. --- Nuevo producto: 1. No pongas como placeholder cosas de Maurcio, como Sistema DOS, eso está muy mal. Jamás lo hagas. 2. Esta exageradamente finito ese modal. 3. Elimina textos innecesarios. --- Desplegable: 1. No pongas un check. 2. El producto que estoy parado debería estar primero. 3. Pon solo el lapiz, no un recuadro al rededor.',
    puntos: [
      '⚠️ **El placeholder decía «Sistema DOS™», el producto de Mauricio.** «Eso está muy mal. Jamás lo hagas»: un ejemplo tiene que ser genérico, o no es un ejemplo — es el nombre de un cliente en la pantalla de otro.',
      '⚠️ Y el 5 es el más grande de la lista: no es cosmético, es cuándo el producto PREGUNTA. La fricción se paga cuando hay algo que perder, y si no lo hay alcanza con dejar la salida puesta cinco segundos.',
    ],
  },
  {
    fecha: '29 sep', hora: '23:40', chat: 'CRM embudo pop-up', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Sin fricción cuando no hay nada que perder, y las etapas se arrastran',
    puntos: [
      '⚠️ **Una clave AUSENTE no es un cero, y ahí se caía la feature entera.** El conteo por etapa sumaba sólo lo que aparecía, así que una etapa VACÍA no entraba al mapa y el lector recibía `undefined` — que la pantalla lee como «no pude contar» y pregunta. La fricción volvía exactamente en el único caso donde no tenía que estar, con el código viéndose correcto. Lo delató el navegador.',
      '⚠️ **Deshacer devuelve la MISMA clave, no una igual.** Con `agregar` la etapa vuelve con una clave nueva y los leads quedan afuera: peor que no deshacer, porque PARECE que funcionó. La op de eliminar devuelve la etapa entera y su índice, y hay un `insertar` que la repone tal cual.',
      'Lo lento del pop-up eran dos consultas que contestaban preguntas ya resueltas (el nombre que la pantalla ya dibuja, y un booleano que venía en la misma fila). La cara —el conteo por etapa— salió del camino crítico y llega después, con la fricción como default seguro mientras tanto.',
      'Mover una etapa iba contra el server: tres viajes para correr una fila un lugar. Ahora es optimista. Y el arrastre replica el molde de las filas del plan: imagen vacía, copia propia movida con `transform` sobre un ref, y el destino sólo se repinta cuando CAMBIA.',
      '⚠️ **El arrastre manda las CLAVES, no el pipeline** — y lo que el navegador no nombra se conserva al final. Sin eso, un arrastre borraría `ganado`: vive en el pipeline y no se dibuja en la lista, así que nunca viaja.',
      'Las entradas quedaron en 5 opciones y se mudaron al alta del producto. `formulario_anuncio` (el Instant Form de Meta) NO se borró del catálogo: distingue el objetivo de campaña y lo que MaKo dice en la primera frase, y los workspaces que ya lo declararon lo siguen viendo marcado.',
    ],
    archivos: [
      'app/crm/EtapasModal.tsx — el pop-up entero: arrastre, sin fricción, loader y el pie con «Eliminar producto»',
      'app/crm/actions.ts — `conteosDeEtapasAction`, las ops `insertar` y `reordenar`, y el detalle sin las consultas de más',
      'app/crm/CrmToolbar.tsx — el alta de producto (más ancha, con el paso de entradas) y el selector con el actual primero',
      'app/components/Dropdown.tsx — sin el ✓ y con el ícono de acción sin recuadro',
      'lib/pipeline.ts — las cinco entradas simples + `carrito`, y `ENTRADAS_OFRECIDAS`',
    ],
  },
  // ── 29 de septiembre: el embudo ENTERO en el pop-up del CRM ───────────────
  {
    fecha: '29 sep', hora: '20:10', chat: 'CRM embudo pop-up', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Siete cosas del pop-up, y después: el editor viejo también se va',
    pedido: '2. No está la edición de NUTRICIÓN dentro de la edición del funnel, te propongo que sea otra subtab dentro del modal. / 3. Haz que el modal sea más ancho. / 4. Falta la opción de ELIMINAR, renombrar, los funnel. Con mucho cuidado si un funnel tiene leads. Y siempre guardando una copia de seguridad en caso de eliminar un funnel con leads, por si el usuario lo quiere "recuperar". / 5. Que no aparezcan en el editable las etapas que no se puedan editar... Como "Ganado" etc... / 6. Debería poder editar las etapas, renombrarlas, eliminarlas, dentro del editor de etapas, eso es basico. Junto con editar el nombre del funnel/producto... / 7. Elimina los textos innecesarios, como "Cada cambio se guarda al momento." --- Y después, sobre /onboarding?tab=funnel: "Tienes que eliminar esto, ya te lo habia pedido".',
    puntos: [
      '⚠️ **El 1 de esa lista era un bug MÍO**: /onboarding entero en «Esta pantalla se rompió al dibujarse», en producción. Lo causó una función de tres líneas que yo había agregado el día anterior cruzando la frontera `use client`.',
      '⚠️ **Y el último mensaje corrige mi lectura del primero.** Yo había dejado el editor completo vivo en /onboarding razonando que la tarjeta de entradas vivía ahí. Él ya había pedido que todo se editara en el CRM: dejar las dos pantallas era peor que no haber movido nada.',
    ],
  },
  {
    fecha: '29 sep', hora: '20:10', chat: 'CRM embudo pop-up', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Un solo lugar para el embudo, y el editor de 527 líneas borrado',
    puntos: [
      'Tres subtabs cortadas por PREGUNTA: por dónde PASA un lead (Etapas), qué se le manda cuando se enfría (Nutrición) y cómo LLEGÓ (Cómo entran). El ancho a 760 y el alto FIJO, porque las tres miden cosas muy distintas y un `max-height` haría saltar la caja al tocar una pastilla.',
      '⚠️ **Las dos decisiones sobre las terminales no se contradicen.** El 28/09: «están SIEMPRE y sí se les puede cambiar el nombre». El 29/09: «que no aparezcan en el editable». Se cumplen las dos sacándolas de la lista que se reordena y dejándolas como pastillas abajo — medido, eran 4 de las 8 filas del pop-up.',
      '⚠️ **Eliminar es ARCHIVAR, y la columna ya existía**: `funnels.activo` está desde la mig 0170 y `listarFunnels` ya filtraba por ella. Nada se destruye: la fila, su `data` y sus leads quedan enteros, y se recuperan desde «Embudos eliminados». Una tabla de respaldo aparte habría sido un segundo lugar con los mismos datos.',
      '⚠️ **Renombrar escribe en `productos`, no en `funnels`**, cuando el embudo tiene producto: la pantalla muestra el nombre del PRODUCTO, así que tocar el otro es un guardado que funciona, no da error y no se ve.',
      '⚠️ **Lo que más costó, y sólo salió del navegador**: `router.refresh()` deja la lista UN PASO ATRÁS cuando lo que cambia es QUÉ EXISTE. Tras eliminar, el selector seguía mostrando el embudo; tras recuperarlo, mostraba la lista de antes — con la base diciendo la verdad en las dos. Va navegación DURA con `conWs`.',
      'Y al borrar el editor cayeron seis tests: uno guardaba los avisos de embudo roto, que el pop-up NO tenía. Borrarlo habría borrado la capacidad sin que nada fallara. Se mudaron con la pieza.',
    ],
    archivos: [
      'app/crm/EtapasModal.tsx — el pop-up: tres subtabs, el título editable y el archivado',
      'app/crm/EmbudoEntradas.tsx — «¿cómo entra tu gente?», mudado del editor viejo',
      'app/crm/actions.ts — `embudoEnDetalleAction` (incluye los problemas del pipeline), renombrar, archivar y restaurar',
      'lib/funnels.ts — `archivarFunnel` (el default no se archiva), `restaurarFunnel`, `renombrarFunnel`',
      'lib/leads.ts — `contarLeadsDeFunnel`: con `head:true`, y un error TIRA en vez de contestar cero',
    ],
  },
  // ── 28 de septiembre: las etapas se editan DENTRO del CRM ────────────────
  {
    fecha: '28 sep', hora: '19:40', chat: 'CRM etapas pop-up', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Que la ruta del funnel desaparezca y todo se edite en un pop-up del CRM',
    pedido: '1. Quiero eliminar la ruta de funnel, que todo se edite como un pop-up dentro del mismo CRM. Así es más simple. Y que sea simple la edición, nada compleja. / 2. En las columnas son tres puntos "..." no 2 y una flecha.',
    puntos: [
      'Viene de la tanda anterior, donde se le habían puesto los tres puntitos a la cabecera de cada columna y un lápiz a cada producto del selector: los dos llevaban a `/funnel`, una pantalla aparte.',
      '⚠️ **«Nada compleja» es la mitad del pedido y la más fácil de no escuchar.** La salida barata era montar el editor de 527 líneas adentro de un `Modal`: cumple «pop-up dentro del CRM» y contesta exactamente lo contrario de lo que se pidió.',
    ],
  },
  {
    fecha: '28 sep', hora: '19:40', chat: 'CRM etapas pop-up', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El pop-up de etapas, y la ruta /funnel retirada a un redirect',
    puntos: [
      'El pop-up hace UNA cosa: la lista de etapas que se ve detrás —nombre, orden, agregar, quitar—. Cada cambio es una **operación** contra `editarEtapaAction`, no un «Guardar» al final: al tablero le llegan las etapas ya DERIVADAS, así que mandar la lista reconstruida desde la pantalla le haría perder lo que la derivación agrega y quita, sin un solo error.',
      '⚠️ **Retirar la ruta fue enumerar sus ocho links y darles TRES destinos distintos.** Los dos del CRM abren el pop-up; los dos que prometen «activar la landing como entrada de leads» —y uno lo aprieta el CLIENTE desde su propia landing— van a `/onboarding?tab=funnel`, porque esa casilla **no está en el pop-up**; y los tres que sólo rebotarían (la sub-tab de Configuraciones, el `match` del nav, el título) se borran.',
      '⚠️ **Y la ruta se REDIRIGE, no se borra.** Afuera del repo viven marcadores y avisos de WhatsApp ya mandados con esa URL: un 404 ahí es peor que la pantalla vieja.',
      'La nueva operación `mover` recorre sólo el PIPELINE: las tres terminales derivadas no viven ahí —las pone `generateFunnel` en cada lectura— así que moverlas «funcionaría» y la pantalla las volvería a dibujar donde estaban.',
      '⚠️ **Y lo que sólo salió abriéndolo en el navegador**: el ↓ de la última etapa propia salía ENCENDIDO y siempre fallaba, porque el intercambio es contra el cierre. Un botón que se puede apretar y nunca funciona se lee como que la app está rota.',
      'Los tres puntitos: el `Dropdown` del repo dibujaba su `▾` sin preguntar, así que el control se veía «⋯ ▾». La flecha dice «acá se elige un valor»; tres puntos dicen «acá hay cosas para hacer».',
      'Verificado contra la base real (ws1) sobre el funnel descartable «Prueba 3» y devolviéndolo como estaba: agregar → renombrar → subir → bajar → quitar, las cinco con efecto y cero errores de consola.',
    ],
    archivos: [
      'app/crm/EtapasModal.tsx — el pop-up; una operación por cambio, nunca el pipeline entero',
      'app/crm/actions.ts — `editarEtapaAction` (+ la op `mover`) y `etapasDeFunnelAction`, la lectura que lo alimenta',
      'app/funnel/page.tsx — el redirect a /crm, con `rutaConWs` y traduciendo `?f=` a `?funnel=`',
      'app/onboarding/OnboardingTabs.tsx — `tabDeUrl`: la tab del hub viaja en `?tab=`, para poder MANDAR a alguien a «El funnel»',
      'app/components/Dropdown.tsx — `sinFlecha`: un menú de acciones no lleva la flecha del desplegable',
    ],
  },
  // ── agosto: los datos del cierre ───────────────────────────────────────────
  {
    fecha: '10 ago', hora: '17:58', chat: 'Chatbot', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El dato estaba cargado, pero en otra columna: el cierre por suscripción',
    puntos: [
      'Una venta recurrente guarda su importe en `suscripcion_monto_usd` (el MRR) y deja `monto_cierre_usd` en null **a propósito**: una recurrencia indefinida no tiene total. `stepsForStage` solo miraba `monto`, así que el wizard mostraba «Suscripción · $40/mes» en su propio resumen y **al confirmar reclamaba el monto, sin ningún paso donde cargarlo**. El lead quedaba trabado contra un requisito que ya estaba cumplido en otra columna.',
      '⚠️ **El corte se decide en TRES lugares y hay que tocarlos juntos**: el wizard, los callers sin pantalla y «Datos sin marcar». Con dos arreglados el lead volvía a aparecer incompleto un segundo después de moverse — o sea que un arreglo parcial acá se ve exactamente igual que no haber arreglado nada.',
      'Y el matiz que evita el bug inverso: el monto de suscripción se pasa **solo si la venta ES recurrente hoy**. Si no, cambiarla a pago único daría por cargado un monto que ya no existe.',
    ],
    commits: [{ sha: '26204528', msg: 'crm: un cierre por suscripción ya no pide "Monto de cierre"', lineas: 76, archivos: 5 }],
    archivos: ['lib/stage-requirements.ts — `StageReqValues` y los requisitos por etapa; el corte vive acá, no en la pantalla'],
  },

  // ── agosto: nada escribe directo ───────────────────────────────────────────
  {
    fecha: '11 ago', hora: '—', chat: 'Productos X Funnels', cuenta: 'claude1',
    actor: 'martin', tipo: 'prompt',
    titulo: '«Debe terminar en un LINK que se confirma DENTRO de MaKo»',
    pedido: 'SIEMPRE cuando se envía una petición por Claude o cualquier canal, debe terminar en un LINK que se confirma DENTRO de MaKo.\n\nSIEMPRE la preview de confirmación tiene que ser EXACTAMENTE igual a la preview cuando intento IMPORTAR un lead del CRM, que aparece como una tabla. Así sea 1 lead o los que sean.',
    puntos: [
      'El porqué ya estaba pagado y escrito en AGENTS.md: **un dato exacto que pasa por las manos de un LLM deja de ser exacto**. Un teléfono con un dígito cambiado entra al CRM, no matchea su chat de WhatsApp ni su Calendly, y no se nota hasta que falta una conversación. La confirmación no es burocracia: es el único momento en que un humano ve el dato antes de que valga.',
      'La segunda mitad del pedido es la que más se subestima: **la preview no puede ser una pantalla nueva**. Quien ya aprendió a revisar una importación no tiene que aprender una segunda vista para revisar lo mismo — y dos vistas del mismo momento divergen. Acá el costo de que divergieran era que en una se pudiera corregir un teléfono y en la otra no.',
    ],
  },
  {
    fecha: '11 ago', hora: '17:07', chat: 'Productos X Funnels', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Un canal PROPONE; una persona confirma. Nada escribe directo',
    puntos: [
      '**El diagnóstico de por qué se rompió sola:** el plan YA funcionaba así (`plan_propuestas` → `/plan/revisar`) y funcionaba bien. Cuando se agregó el alta de leads del agente, escribió directo en `leads` — no porque alguien decidiera saltear la revisión, sino porque **no había ningún lugar del que la revisión saliera sola**. Era la costumbre de un módulo, no una regla.',
      'La tabla `propuestas` (mig 0128) es **genérica a propósito**, con `tipo` + `datos`: una tabla por área garantizaba que la tercera también fuera propia y que cada una reinventara estado, idempotencia y caducidad.',
      '⚠️ **Idempotencia en las DOS puntas o no sirve**: `ref` al proponer (un formulario dispara dos veces con mala conexión) y `.eq(\'estado\',\'pendiente\')` al aplicar (dos pestañas, un doble click). Sin las dos, el dueño confirma un duplicado creyendo que son dos personas.',
      'La tabla de revisión se **extrajo** de `ImportarLeadsModal` a `TablaRevisionLeads` y ahora la usan los dos caminos, y la confirmación delega en `importarLeadsRevisadosAction` — la misma acción del importador, que ya sanea, re-resuelve duplicados **contra la base** y respeta el tope. Una segunda ruta de alta con sus propias validaciones es donde las dos se separan, y el día que se separen una deja entrar lo que la otra rechaza.',
      '**Una sola fila sigue siendo una tabla, a propósito:** el encabezado con los nombres de columna es lo que hace evidente qué valor cayó en qué campo, que es justo lo que hay que revisar cuando el dato lo transcribió un modelo.',
      'Y la trampa del entorno que quedó escrita en la skill: el U+FFFD que apareció en la base **llegó ya roto**, no se rompió adentro — fue el JSON pegado inline en la shell de Windows. El cuerpo se manda desde un ARCHIVO: un nombre mal escrito entra al CRM y no hay nada del lado del servidor que lo pueda notar.',
    ],
    commits: [
      { sha: 'c03b7e59', msg: 'Un canal PROPONE; una persona confirma. Nada escribe directo', lineas: 598, archivos: 10 },
      { sha: '2d4201b2', msg: 'La confirmación usa LA MISMA tabla que el importador, y acepta un lote', lineas: 818, archivos: 10 },
    ],
    archivos: [
      'lib/propuestas.ts — la tabla genérica y su ciclo de vida',
      'app/crm/revisar/[id]/RevisarLead.tsx — la pantalla EDITABLE: si solo preguntara «¿confirmás?» obligaría a aceptar el dato mal y arreglarlo después',
      'app/crm/TablaRevisionLeads.tsx — la preview única, compartida con el importador',
    ],
  },

  // ── agosto: el resumen del lead ────────────────────────────────────────────
  {
    fecha: '11 ago', hora: '17:39', chat: 'Productos X Funnels', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La pantalla que faltaba: el resumen del lead, antes y después de la reunión',
    puntos: [
      '**El diagnóstico obvio era el equivocado.** El dueño mostró su WhatsApp: «muchos están incompletos, como el que te pregunta ¿Querés que te pase el resumen y las objeciones acá? y al final no hace nada». No faltaba cablear la respuesta: el aviso se emitía **en el instante del webhook de Fathom**, y el Closing Analyst corre después, adentro del `after()`. Cuando MaKo ofrecía el resumen, el resumen todavía no existía.',
      '`/crm/[id]/resumen` es de una columna, para el celular, y **no gasta IA**: todo sale de `closing_analyses` y del formulario de Calendly. Sirve para los dos momentos — antes muestra quién es y qué contestó al agendar; después arranca por el desenlace, con las objeciones ABIERTAS primero.',
      '⚠️ **`respuesta_decisor` guarda el Sí/No a «¿alguien MÁS participa en la decisión?».** Rotularla «¿Decide solo?» **invierte el sentido**, y el dato se ve igual de correcto: se entraba a la llamada con la estrategia dada vuelta.',
      '⚠️ **`MakoConfirmGate` dispara un modal bloqueante en todo `/crm*`**: una pantalla nueva bajo ese prefijo **nace tapada**. Por eso existe `esVistaSinChrome`, separado de `isPublicLandingPath` (que significa otra cosa y gobierna los pollers).',
      'Pedido del dueño sobre los mensajes: «No quiero que en WhatsApp me diga absolutamente nada de lo que pasó en la reu… Solo el link.» El análisis vive en la pantalla, que lo muestra completo y actualizado; repetirlo en el chat lo **congela** en el momento del envío y hace que abrir el link se sienta redundante justo cuando es lo único que importa.',
      '**Un lead de otra cuenta no es un 404.** El 404 crudo de Next («This page could not be found») afirma la cosa equivocada —la página existe y el lead existe, lo que no coincide es la cuenta— y no ofrece salida. Al super admin se lo redirige con `?ws=` (mecanismo ya auditado en `proxy.ts`), y `workspaceDeLeadParaAdmin` devuelve **el número de workspace y nada más**, para no abrir una segunda puerta a los datos ajenos. Al resto, `PermissionState` con motivo `ajeno`. Y el texto **no dice de quién es el lead**: probando ids, un error que nombra al dueño reconstruye la cartera de clientes ajena.',
      '**El botón para analizar la llamada necesitó dos mitades en lugares distintos**, porque esa pantalla se abre en el celular y «me salgo de la página» es lo que pasa siempre: que el TRABAJO siga es `after()` en la ruta (202 al toque, `maxDuration 300`); que el LOADER siga es la tabla `closing_jobs` (mig 0130), que es a la vez lo que se pinta y el candado. El candado **vence a los 15 min**: sin vencimiento, una función caída deja la fila en `corriendo` para siempre y la pantalla en «Revisando» sin ningún botón para salir.',
      '⚠️ **El desenlace tiene TRES casos, no dos.** La primera versión contaba `analizadas + relinkeadas + yaEstaban === 0` y concluía «no encontré la llamada en Fathom». Corrida real sobre el lead 1696: `{ encontradas: 1, analizadas: 0 }` — la grabación estaba con sus 540 turnos y lo que faltaba era **saldo en la API de Anthropic**. Cuatro contadores en cero se ven iguales para «no había» y para «no pude», y mandan a la persona a dos lugares distintos.',
    ],
    commits: [
      { sha: 'b4714a82', msg: 'Los mensajes de MaKo dejan de preguntar al vacío: un link al resumen del lead', lineas: 1363, archivos: 16 },
      { sha: '7bdf8993', msg: 'El WhatsApp solo avisa y linkea; y cada mensaje arranca con su rótulo', lineas: 334, archivos: 7 },
      { sha: 'bd366a46', msg: 'Un lead de otra cuenta no es un 404: dice qué pasó, y al super admin lo lleva', lineas: 110, archivos: 3 },
      { sha: 'f9f6fc80', msg: 'resumen: botón para analizar la llamada, con estado que sobrevive a irse', lineas: 622, archivos: 10 },
    ],
    archivos: [
      'app/crm/[id]/resumen/page.tsx — la vista de una columna; lib/lead-resumen.ts arma el contenido',
      'lib/closing-job-estado.ts — qué se pinta, cuándo se puede reintentar y cómo se cuenta el desenlace. SIN server-only, para que se pueda testear',
    ],
  },

  // ── agosto: el aislamiento ─────────────────────────────────────────────────
  {
    fecha: '13 ago', hora: '20:19', chat: 'Integraciones', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El CRM de una clienta abría la agenda de Calendly de otro cliente',
    puntos: [
      '🔴 `app/crm/calendly-widget.ts` es `\'use client\'` y tenía las URLs de Calendly **del dueño** hardcodeadas en un `Record` por `stageKey`. Un módulo de cliente viaja en el bundle y **no tiene noción de workspace**: eso se servía igual a todos.',
      '**La firma ya lo decía**, y ahí está la regla que queda: `calendlyUrlFor(stageKey)` tomaba solo la etapa, y la respuesta depende de **quién mira**. Una función cuya respuesta depende del inquilino y cuyos parámetros no lo mencionan es un leak esperando el momento.',
      'Rompía mucho más que la vista: el prospecto de ella reservaba en el calendario de él, y **ella no se enteraba nunca** — la reserva entra por el event type de él y el webhook la rutea a su workspace. En el de ella la fecha no aparece jamás. Más la exposición del nombre, la cara y la oferta de un cliente dentro de la app de otro.',
      'Cómo queda: `openCalendlyEn(url, …)` recibe la URL como parámetro **obligatorio y sin default**, así ningún call-site puede volver a abrir «la agenda de alguien» sin decir de quién; la resuelve el server contra la cuenta del workspace y **sin config devuelve null + el motivo**, nunca cae a la del dueño.',
      'La red que impide que vuelva: `tests/sin-datos-del-dueno-en-bundle.test.ts` recorre `app/` y falla si un módulo `\'use client\'` trae una agenda personal. La única excepción va por **ruta exacta** y con su porqué escrito (/vsl es la landing pública de MaKo).',
      '⚠️ **Quedó vivo del mismo barrido:** `lib/closing.ts:117-121` tiene `INTERNAL_EMAILS` / `INTERNAL_DOMAINS` del dueño para **todos** los workspaces. No filtra datos, pero clasifica mal las llamadas de los demás.',
    ],
    commits: [{ sha: '80b6af39', msg: 'seguridad: el CRM de una clienta abría la agenda de Calendly de otro cliente', lineas: 277, archivos: 6 }],
    archivos: ['docs/hallazgos-crm.md → «El CRM de una clienta abría la agenda de Calendly de OTRO cliente»'],
  },

  // ── agosto: el alta de leads ───────────────────────────────────────────────
  {
    fecha: '14 ago', hora: '17:11', chat: 'Integraciones', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El alta de leads no tenía choke point, y el visitor_id se caía en el camino',
    puntos: [
      '**Un mapeo de 6 agentes sobre TODOS los caminos de alta, y el resultado fue que no había uno solo:** tres inserts distintos a `leads` y cuatro lógicas de duplicado que no se hablaban. `createLead()` (alta manual, alta desde una conversación de WhatsApp, importación y confirmación de propuestas) **no chequeaba nada**; los webhooks de Meta y Calendly sí matcheaban pero hacían merge **en silencio**; el importador avisaba y funcionaba **al revés** —descartaba la fila duplicada aunque la persona la tildara, o sea que el tilde no hacía nada—; y **nadie comparaba por nombre**.',
      'Las tres reglas de comparación que valen la pena, en `lib/leads-duplicados.ts` (sin `server-only`, porque lo que se puede equivocar es la COMPARACIÓN y tiene que testearse sin base): el teléfono compara por sus **últimos 10 dígitos** (la forma más común de colar un duplicado es cargarlo desde WhatsApp con +52 y tipearlo sin él); el nombre compara sin acentos y **sin importar el orden**; ⚠️ pero **el nombre solo cuenta si no hay email ni teléfono** — dos «Juan Pérez» son dos personas distintas mucho más seguido que dos veces el mismo teléfono.',
      '⚠️ **Si la consulta de duplicados falla, NO se bloquea el alta.** Degradar hacia «no dejo entrar a nadie» por una consulta caída pierde clientes reales: sería el fallback más fuerte que el camino feliz, que este repo ya pagó una vez.',
      '**La regla «un canal propone, una persona confirma» no se abandonó: se acotó a donde sirve.** El riesgo que cubre es un dato que llega mal, y un formulario que la propia persona completó es el dato **más** confiable que hay. Lo que sí necesita ojo humano es el CHOQUE con alguien que ya está: fundir es irreversible y duplicar ensucia. La prueba de que sobre-pedir tampoco es el lado seguro son los **ocho leads** que se quedaron esperando un click que nadie sabía que había que dar.',
      '⚠️ **Y el más grave, del día siguiente: `createLead()` DESCARTABA el `visitor_id`.** Estaba en `LeadCreateInput` y nunca llegaba al insert, así que el lead que entra desde la landing nacía sin el identificador de la visita — y la tab Tracking de su ficha, que se busca POR `visitor_id`, quedaba vacía. La visita, el play, los clicks y el formulario estaban **todos medidos en la base** y no se podían atar a la persona, que es exactamente lo único para lo que existe el tracking. Se iban igual `origen_lead` y los UTM: sin eso, un lead de landing es indistinguible de uno cargado a mano.',
      '**Los webhooks ya no fusionan callados.** Fusionar está bien —es la misma persona volviendo, y crear una tarjeta nueva partiría su historial en dos— pero un match por teléfono puede equivocarse: dos personas de la misma empresa cargadas con el número de la recepción, o un número que la operadora recicló, y ahí el segundo se escribe encima del primero sin dejar rastro. **No se frena la fusión** (frenarla convertiría un webhook —que corre sin nadie mirando— en una cola de decisiones, o sea el caso de los ocho leads otra vez): se hace, y se cuenta, con aviso `lead-fusionado` y dedup de 60 min.',
    ],
    commits: [
      { sha: '2dfa4bab', msg: 'leads: entran solos desde la landing, y el anti-duplicado avisa en vez de decidir', lineas: 445, archivos: 6 },
      { sha: '5d125365', msg: 'leads: el visitor_id no llegaba al insert, y los webhooks ya no fusionan callados', lineas: 223, archivos: 8 },
    ],
    archivos: [
      'lib/leads-duplicados.ts — la comparación, testeable sin base',
      'lib/leads.ts — `createLead` tira `LeadDuplicadoError` CON las coincidencias adentro: sin los ids la pantalla no puede ofrecer «abrí el que ya tenés»',
      'app/api/track/optin/route.ts — el alta automática desde la landing; si falla, la persona cae a propuesta y no se pierde',
    ],
  },

  // ── agosto: la ficha y las grabaciones ─────────────────────────────────────
  {
    fecha: '16 ago', hora: '00:40', chat: 'CRM', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Dos botones de la ficha que prometían y no entregaban',
    puntos: [
      '**«Me lleva a esta página donde no se ve nada».** Cierto: la URL quedaba en `?date=Last 3 days`, o sea que Clarity **descartó** el `?CustomUserId=` que le mandábamos y mostró la lista entera del proyecto — 35 sesiones, ninguna identificable. El botón prometía «lo que hizo ÉL» y entregaba «lo que hizo todo el mundo», **que es la peor clase de link: parece que anda**.',
      'El dato sí está del lado de Clarity (la landing manda `clarity("identify", visitorId)`, verificado en el HTML en vivo). Lo que falta es el **nombre exacto del parámetro de filtro** en la URL de su panel, que no está documentado y no se puede probar sin sesión iniciada. Hasta entonces el id queda a la vista y copiable de un clic, con el camino escrito. Y embeberlo está descartado **con evidencia**: `clarity.microsoft.com` responde `X-Frame-Options: SAMEORIGIN` — no es una decisión de diseño, es que el navegador lo rechaza.',
      '**El segundo botón ofrecía una grabación que ya no existía.** Aparecía con solo tener identificador, sin mirar de cuándo era la visita; Clarity guarda las grabaciones **30 días**. Medido en el workspace 1: de 36 leads con `visitor_id`, **12 son más viejos que la retención** —el más antiguo del 31/3— y a los 12 se les ofrecía una grabación imposible. Ahora se gatea por `grabacionVigente(ultimaActividad)`, mirando el evento **más nuevo** y no el alta: alguien de marzo que volvió ayer sí tiene grabación.',
      '**Y no se esconde en silencio.** Ahí SÍ hubo algo que ver, así que la card dice por qué ya no está: esconderlo a secas repetiría el problema por el otro lado, que es que se lea como que la medición nunca funcionó.',
    ],
    commits: [
      { sha: 'eeccfb14', msg: 'crm: el link de Clarity no llegaba filtrado, y el id queda copiable en la ficha', lineas: 38, archivos: 4 },
      { sha: 'f3a134f1', msg: 'crm: la grabacion no se ofrece cuando Clarity ya la borro', lineas: 110, archivos: 6 },
    ],
    archivos: ['app/crm/lead-view/ComportamientoCard.tsx — la tarjeta de comportamiento del lead: grabación, mapa de calor y retención por video'],
  },
  // ── octubre: lo que salió de la llamada con Leila ──────────────────────────
  {
    fecha: '1 oct', hora: '00:11', chat: 'Debug de la llamada con Leila', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Eliminar una etapa del embudo no se podía, y nadie sabía por qué',
    pedido: 'LEILA, intentando borrar «Nutrición No Show R1» en vivo: «No se pudo. Esta etapa no es del pipeline, no se la puede eliminar solo». MARTÍN: «Creo que hay un error… tengo que ver ahí de qué depurar eso».',
    puntos: [
      'Es la primera de nueve cosas que Martín dictó mirando la pantalla en esa llamada. Ninguna quedó anotada en el momento: la transcripción no existía en el disco y hubo que reconstruirla desde los logs de los subagentes de una corrida del 03/10.',
    ],
  },
  {
    fecha: '4 oct', hora: '12:56', chat: 'Debug de la llamada con Leila', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El menú ofrecía borrar 102 columnas que el server rechaza',
    puntos: [
      '**Dos condiciones distintas para la misma pregunta, a dos archivos de distancia.** El menú preguntaba `!esTerminal(c.key)`; el server exige además estar guardado en `pipeline` y no ser la ENTRADA. Las etapas de nutrición **no están en `pipeline`**: las agrega `generateFunnel` en cada lectura, así que el menú las ofrecía y el server las rechazaba SIEMPRE.',
      '**Medido contra producción antes de escribir una línea: 102 columnas de los 16 embudos.** El menú no estaba a veces mal — estaba mal en todos los embudos del producto, y nadie lo había reportado hasta que Leila lo tocó en vivo.',
      '⚠️ **Y la medición se había quedado corta: la corrigió el test en su PRIMERA corrida.** Contó sólo las de nutrición, comparando contra `pipeline`. Las entradas SÍ están ahí y el server las rechaza igual («por esa etapa entra tu gente»), o sea una más por embudo. Contar contra UNA de las tres guardas del server es medir un tercio.',
      '**El guard viejo se mudó con la pieza.** `funnel-estructura.test.ts` fijaba `esTerminal(c.key) ? [] : [{ value: eliminar` palabra por palabra; ahora apunta a `colsBorrables`, y quién es borrable de verdad lo prueba el test nuevo contra `generateFunnel`. Un guard que queda apuntando a la condición vieja no avisa: se pone rojo y se lo borra.',
      '**El cableado se prueba EXTRAYENDO la línea, no buscando en el archivo.** `esTerminal` aparece legítimamente en otras ocho líneas de `CrmBoard.tsx`: un `match` sobre el fuente entero daba verde con el bug puesto.',
    ],
    commits: [
      { sha: '78108a08', msg: 'El menú de una columna sólo ofrece borrar lo que el server sabe borrar', lineas: 190, archivos: 4 },
    ],
    archivos: [
      'app/crm/CrmBoard.tsx — `colsBorrables`: lo que el server acepta borrar, ni una más',
      'tests/eliminar-etapa-coherente.test.ts — la decisión contra `generateFunnel` y el cableado leyendo la línea del menú',
    ],
  },
  {
    fecha: '4 oct', hora: '14:12', chat: 'Debug de la llamada con Leila', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Marcar en el runway y en el tablero lo que ya está terminado',
    pedido: 'Marca en la ruta de runway y en el proyecto de CRM las que ya están terminadas.',
    puntos: [
      'Cierra la tanda que arrancó con «comienza a solucionar absolutamente todo lo que puedas hacer sin mi ayuda o intervención». Nueve tarjetas cerradas en el tablero con su evidencia al commit `01cf2164`, y la pantalla mostrándolo.',
    ],
  },
  {
    fecha: '4 oct', hora: '14:40', chat: 'Debug de la llamada con Leila', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Lo terminado se ve marcado: el lector de /admin/dev lo escondía',
    puntos: [
      '**`roadmapDe` filtra por progress < 100 EN LA CONSULTA**, así que para él una tarea cerrada no existe. Para /admin/dev eso es correcto —su pregunta es «¿qué queda?»— y acá es justo lo contrario: las nueve recién cerradas desaparecían, o sea que lo hecho se leía igual que lo que nunca existió. Va un lector propio que trae abiertas y cerradas, con el título y la prioridad saliendo del tablero en cada carga.',
      '**Se acota al universo de la depuración.** El proyecto arrastra once tareas cerradas de antes que nadie decidió acá: medido, 37 filas sin filtro contra 26 con él (las 25 revisadas + la nueva). Lo que se abra después entra igual y sale «sin revisar», que es lo que no se puede esconder.',
      '⚠️ **El porqué de una fila cerrada no es el de la decisión.** El motivo de un «se pospone» es un argumento para NO hacerla: al lado de un ✓ se lee como una contradicción. #697 decía «mientras tanto se corrige a mano… es una línea» sobre una tarea ya resuelta. Va un campo `hecho` que gana cuando está cerrada; el de un «se queda» sobrevive solo, porque dice qué se rompía sin eso.',
      'Y el verde pasa a significar «hecha», no «se queda»: dos cosas distintas no pueden compartir color en la misma barra.',
    ],
    commits: [
      { sha: 'c2dfdfdf', msg: 'runway: las tareas terminadas del CRM se ven marcadas, no desaparecen', lineas: 142, archivos: 3 },
    ],
    archivos: [
      'app/admin/runway/tareas.ts — el lector que trae abiertas Y cerradas, con el porqué de no reusar `roadmapDe`',
      'app/admin/runway/datos.ts — los veredictos de la depuración y el campo `hecho`',
    ],
  },
  {
    fecha: '4 oct', hora: '19:40', chat: 'Debug de la llamada con Leila', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'La tarjeta mas urgente del CRM no se entendia, y por eso se cayo',
    pedido: 'Haz la configuración de salvar los datos... Que por cierto, no entiendo muy bien eso... Si los "datos" que guarda Meta ya MaKo los guarda en el CRM en todos los leads entrantes... Pero bueno, revisalo y cierra todas las otras tareas que puedas cerrar',
    puntos: [
      '**El pedido trae la refutacion adentro, y tenia razon.** La tarjeta #6 era la de score mas alto del proyecto (87) y afirmaba tres cosas: que se estaban perdiendo respuestas, que el anuncio y la campana «nunca» se guardan, y que habia que correr un rescate. Dos eran falsas y la tercera no tenia nada que rescatar.',
      'Lo que lo destapo fue que el dueno leyera la fila de la pantalla y dijera que no la entendia. Ninguna de las dos auditorias anteriores habia dudado de la premisa.',
    ],
  },
  {
    fecha: '4 oct', hora: '20:10', chat: 'Debug de la llamada con Leila', cuenta: 'claude2',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'Medido contra la API de Meta: 0 respuestas descartadas sobre 686 leads',
    puntos: [
      '**El unico formulario que recibio leads pregunta exactamente los 4 campos que ya se guardaban.** 686 leads, 0 respuestas perdidas. Y el anuncio y la campana estan en 1.039 de 1.041 leads y se dibujan en la ficha desde antes: la tarjeta se contradecia sola, citando tres lineas mas abajo el codigo que hace lo que decia que no se hacia.',
      '**Lo que si era cierto vivia en OTRO cliente.** El ws13 tiene cinco formularios con preguntas personalizadas y cero leads: la urgencia era real y estaba fechada al reves — no corre contra lo que se pierde hoy, corre contra el dia que ese cliente prenda sus anuncios.',
      '⚠️ **El universo de la medicion es el conjunto de CLIENTES, no el que reporto.** Mirar solo el ws1 habria cerrado la tarjeta como fantasma y dejado al ws13 perdiendo respuestas dentro de un mes.',
      'Y de las 15 tareas abiertas que se midieron contra el codigo, **ninguna volvio como «ya esta hecha»**: 11 parciales y 4 abiertas. Lo cerrable se habia cerrado el dia anterior.',
    ],
  },
  {
    fecha: '4 oct', hora: '21:30', chat: 'Debug de la llamada con Leila', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Lo que Meta borra queda guardado, y cuatro tarjetas mas que eran codigo',
    puntos: [
      '**No se construyo lo que la tarjeta pedia.** El rescate no se corrio porque no hay nada que rescatar; lo que se hizo es que no haya nada que rescatar la proxima vez: mig 0187 guarda el formulario crudo y la fecha real de Meta, y el descarte deja rastro en el historial del lead.',
      '⚠️ **La columna no se pisa con vacio, y el mecanismo es que la clave NO VIAJE.** Escrita como las otras cinco (`input.x ?? null`), una ingesta posterior le borraria al lead las respuestas que Meta ya no tiene. Con el spread condicional, «no lo mando» y «lo mando vacio» son el mismo caso y gana lo guardado.',
      '**#626**: al lead que entra SOLO se le aplicaba el criterio mas estricto que al que carga una persona. El criterio por los ultimos 10 digitos ya estaba escrito y testeado; faltaba aplicarlo donde nadie mira.',
      '**#623**: el control que faltaba no era un boton, era un ID — `indiceContactos` devolvia Sets, o sea existencia y no identidad.',
      '**#798**: el diagnostico obvio era el equivocado. Las keys canonicas SI existian; lo que medi­a cero era la COHORTE, porque `fecha_junta_1` es null en todo lead de un funnel sin reuniones.',
      'Cerradas #6, #623, #626 y #798. #671 y #701 quedaron al 50% con lo que falta escrito: una necesita verse en el navegador de un cliente real y la otra que el dueno decida si vale repegar el Pixel.',
    ],
    commits: [
      { sha: '640785a5', msg: 'CRM: lo que Meta borra queda guardado, y cuatro tarjetas mas que eran codigo', lineas: 3382, archivos: 31 },
    ],
    archivos: [
      'lib/meta-leads-campos.ts — el parser del formulario de Meta, sin server-only para que tenga test',
      'supabase/migrations/0187_meta_field_data.sql — las respuestas crudas y la fecha real de Meta',
      'lib/funnel-comercial.ts — las etapas del embudo de cada cliente para el tramo comercial',
      'app/crm/leads-importar.ts — el tercer destino de una fila repetida: enriquecer',
    ],
  },
  {
    fecha: '4 oct', hora: '22:05', chat: 'Debug de la llamada con Leila', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Las cinco decisiones que destrabaron el CRM',
    pedido: '1. Si, deber\u00eda aparecer en tracking los clicks que hizo, junto a la grabaci\u00f3n del scroll... Hazlo. Y si no tiene el Pixel de MaKo conectado, all\u00ed mismo un bot\u00f3n para conectarlo.\n2. Eso es una tarea para Chatbot, no para el CRM... Enviasela al chat interno que estamos trabajando el chatbot, deber\u00eda hacer recordatorios a clientes como en el grupo de MaKo en WhatsApp.\n3. Si, cargar el pixel en una landing ya deber\u00eda contar... Ahora, la configuraci\u00f3n que falta es que el pixel deber\u00edamos poder ASIGNAR a un PRODUCTO. Con la implementaci\u00f3n que hicimos, para que lleguen los leads a ese CRM y no a otro.\n4. Es que las respuestas del Calendly son diferentes, deber\u00eda haber un apartado para los insights que salieron de la llamada.\n5. Si, que lo detecte, pero no solo los "Ganados" sino, todos los leads de cualquier etapa... Eso es importante para evitar duplicados.',
    puntos: [
      'Las cinco salieron de preguntarle las decisiones que bloqueaban el trabajo, una por tarjeta, despues de medir que ninguna de las 15 abiertas estaba hecha. Cuatro se implementaron y una cambio de equipo.',
      '**La #2 decidio una arquitectura sin nombrarla.** Al contestar «para eso estamos configurando el chatbot, que cada usuario lo pueda editar», los dias de la cobranza dejaron de vivir en el codigo: el cron decide cuando ENTRA una cuota y la cadencia se edita en el lienzo como cualquier flujo.',
    ],
  },
  {
    fecha: '4 oct', hora: '23:50', chat: 'Debug de la llamada con Leila', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Las cuatro decisiones, y un duplicado que medi­a 1.153 leads',
    puntos: [
      '⚠️ **#622: el diagnostico obvio era el equivocado, y lo propuso el pedido.** Martin supuso que el cruce anti-duplicados filtraba por etapa. Ese filtro NO EXISTE: entran 1.549 de 1.549 leads, incluidos los 72 terminales. Lo que si dejaba gente afuera era el telefono comparado por digitos COMPLETOS — de 1.154 leads con telefono, UNO tiene 10 digitos, asi que un CSV con numeros locales duplicaba 1.153. Y las dos fichas quedaban inalcanzables para la ingesta siguiente.',
      '**#696: el opt-in no nombraba `funnel_id` ni una vez.** El lead de una landing no estaba mal asignado: no se asignaba. Ahora el Pixel se asigna a un producto y el lead cae en SU embudo; cuelga de la URL y no del token, porque hay un solo token por workspace.',
      '**#332: el analisis de la llamada existia y no llegaba a la ficha.** `syncClosingCalls` solo ata el analisis al lead cuando el EMAIL del invitado matchea, asi que una grabacion pegada a mano se analizaba —pagando— y quedaba huerfana. El enganche se mudo al choke point de las tres entradas.',
      '**#701: el scroll, con dos frenos y la version marcada.** Y el gate que lo habria dejado mudo: `ganaConLaNueva` decidia si pedir repegar el Pixel mirando hosts de VIDEO, asi que a una landing sin video le decia «miden igual» sobre la unica version que le servia.',
      '**Y la tarjeta de cobranza (#19) se fue a «Feature: Chatbot»** con el relevo medido. Quedo al 50%, no cerrada: anda el mensaje al grupo y falta el del cliente, que es la otra mitad que Martin pidio.',
    ],
    commits: [
      { sha: '865dffb4', msg: 'CRM: las cuatro decisiones de Martin, y un duplicado que medi­a 1.153 leads', lineas: 2903, archivos: 34 },
    ],
    archivos: [
      'lib/landing-funnel.ts — a que embudo entra un lead segun la pagina que lo trajo',
      'lib/insights-llamada.ts — el analisis de la llamada, enganchado y leido en un solo lugar',
      'app/crm/importar-server.ts — el cruce por los ultimos 10 digitos',
      'lib/landing-token.ts — el scroll en el snippet, v19',
    ],
  },
  {
    fecha: '5 oct', hora: '00:20', chat: 'Debug de la llamada con Leila', cuenta: 'claude2',
    actor: 'claude', tipo: 'cosecha',
    titulo: 'Tres sesiones sobre un clon: el arbol no tiene un estado, tiene una hora',
    puntos: [
      'El 04/10 hubo TRES sesiones a la vez sobre este clon y en un mismo dia se pago tres veces el mismo error: leer el arbol como si fuera un hecho. Una sesion vio cuatro errores de sintaxis en un archivo que otra estaba tipeando y los reporto como ajenos; un minuto despues daba cero.',
      '⚠️ **Un `tmp-` sin commitear es un candado para TODOS, y el que lo escribe es el unico que no lo sufre.** Un script de diagnostico con un error de tipos bloqueo el push de las otras dos sesiones ~3 horas y costo dos pushes desde worktree limpio; su autor no se entero nunca.',
      'Y los dos ejemplos de pantalla que nombraban gente real: el onboarding proponia «Negocio que Escala™» —la oferta de Mauricio— como ejemplo de oferta a todos los clientes. El guard del vecino se EXTENDIO a los placeholders en vez de escribir otro, probado rompiendolo.',
    ],
    archivos: [
      'AGENTS.md — la regla de las tres sesiones y del tmp- como candado',
      'docs/hallazgos-crm.md — el duplicado del telefono, el funnel_id del opt-in y el analisis huerfano',
      'tests/variables-aviso.test.ts — el guard de nombres reales, extendido a los placeholders',
    ],
  },
  {
    fecha: '5 oct', hora: '00:30', chat: 'Debug de la llamada con Leila', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'El tracking de la ficha manda a Clarity en vez de mostrar',
    pedido: 'Lo que veo es que aquí en el tracking, aún no se está mostrando la grabación, los clicks, aún sigue redirigiendo a clarity, eso solucionalo, que se muestre allí mismo.\nY también en el botón de "Ponles nombre" al vídeo que no tiene etiqueta, sería bueno que si le doy se abra un pop-up allí mismo para asignarle nombre, no que una redirección a otro lado.',
    puntos: [
      'Vino con una captura de la ficha de un lead. Dos de los tres defectos que se arreglaron NO estaban en el pedido: aparecieron al medir por que la pantalla se veia asi.',
    ],
  },
  {
    fecha: '5 oct', hora: '02:00', chat: 'Debug de la llamada con Leila', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El sello del constructor era la mitad de los clics del lead',
    puntos: [
      '⚠️ **208 de los 441 clics del ws1 son el badge «Edit with Lovable»** que la landing lleva pegado, y el PRIMER renglon del recorrido de un lead era el cartelito del editor. En el ws11 y el ws13 el mismo patron da 0: no se puede descartar «lo raro» a ojo, hay que contar. Se filtra AL LEER y no al capturar, porque un arreglo en el snippet solo vale para quien repegue el codigo y no limpia los 208 ya guardados.',
      '**La grabacion de Clarity NO se puede embeber**: re-medido, contesta X-Frame-Options SAMEORIGIN. El boton queda y ahora DICE que abre Clarity, que es lo honesto.',
      '⚠️ **Una fusion no es un reorden.** La primera version metio el recorrido adentro de la tarjeta y en el codigo el pedido se leia cumplido; en el navegador seguia a 798,5 px del tope con 583 visibles. Lo que lo arreglo fue el ORDEN —«que hizo» antes que «de donde vino»—: 281 px, medido por los dos caminos.',
      '**Y «Ponles un nombre» abria un pop-up sin nada que contestar en 59 de 64 leads**: el contador incluia el balde de eventos sin video_id, que es justo el que el pop-up descarta. Cuando una pantalla OFRECE y otra RESUELVE, las dos cuentan sobre el mismo conjunto.',
      'De paso quedaron #627 cerrada y #800, #18 y #40 al 50% con lo que falta escrito adentro: a #800 le falta la PANTALLA que declare el plazo por etapa (ninguna escribe funnels.data.umbrales), a #18 el texto que escribe Martin, y a #40 el planificador.',
    ],
    commits: [
      { sha: '99d89e07', msg: 'CRM: lo que hizo el lead se lee en la ficha, y cuatro tarjetas mas', lineas: 2544, archivos: 30 },
    ],
    archivos: [
      'lib/clic-ruido.ts — el sello del constructor no es un clic de la persona',
      'app/crm/lead-view/ComportamientoCard.tsx — el recorrido primero, y el contador acotado',
      'app/crm/lead-view/NombrarVideosModal.tsx — nombrar un video sin salir de la ficha',
      'lib/ventana-24h.ts — fuera de las 24 h el boton de enviar no se dibuja',
    ],
  },
  {
    fecha: '5 oct', hora: '09:40', chat: 'Debug de la llamada con Leila', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Replicar Clarity, el dataset de Meta, y el boton de editar que seguia ahi',
    pedido: '1. Si, replica clarity, si de igual manera dentro de clarity no sale el VSL... Y tambi\u00e9n crea una pantalla con el mapa de calor y otras cosas y graficos que mide el pixel de MaKo y todo. Eso podr\u00eda vivir en Landing Analyst.\n2. Explicame que es el dataset, si ya tenemos un tutorial en integraciones de como el usuario lo debe configurar, as\u00ed como tenemos un tutorial de como traer el access token, y de lo contrario deber\u00edamos crearlo.\n\nY aparte: «Que pas\u00f3 con el bot\u00f3n de editar que te ped\u00ed que no exista m\u00e1s? Y que ahora solo sea un lapiz o cosas as\u00ed...»',
    puntos: [
      '**El punto 1 trae la refutacion adentro, y gano el.** Yo habia recomendado NO replicar Clarity con el argumento de que un replay propio no puede grabar dentro de un iframe de otro dominio y el VSL es eso. Su «si de igual manera dentro de clarity no sale el VSL» era verificable y era cierto.',
      'Y el boton de editar lo pidio DOS veces: la primera no se hizo y yo se lo conte al final de una respuesta larga, donde se perdio. Si algo que pidio no se hizo, va primero y solo.',
    ],
  },
  {
    fecha: '5 oct', hora: '12:30', chat: 'Debug de la llamada con Leila', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Replay propio, el dataset con su tutorial, y la ficha sin boton',
    puntos: [
      '**Clarity tampoco muestra el VSL**, documentado por Microsoft: «Clarity can\u0027t capture third-party iFrames and HTML Canvas elements. They appear in your recording as shown». Y en los mapas de calor solo cuenta clics de iframes del MISMO dominio. El argumento con el que yo habia recomendado no replicar no distinguia entre las dos opciones.',
      '⚠️ **La privacidad del replay paso la prueba byte a byte**: se escribio en cuatro campos y el texto NO esta en lo que se mando (viajan asteriscos, uno por caracter). rrweb NO tapa los inputs por defecto —solo la contrasena—, al reves que Clarity: `maskAllInputs` es el piso. Lo que se graba mal no se arregla despues.',
      '**Y el replay estaba incompleto cuando lo reporte.** La verificacion de punta a punta lo midio: grababa y mandaba 10 KB en 45 s, y NO guardaba nada — faltaban los artefactos de rrweb en el repo, la migracion sin aplicar, y el healthcheck publicaba un tope 4x mas grande que el que la puerta aplica.',
      '**El dataset de Meta: declarar el evento es una llamada de API**, no un pedido al cliente. Lo unico sin endpoint es el dataset de CRM, y para eso se escribio el tutorial que no existia (Meta tenia siete y ninguno pasaba por «Conectar origenes de datos»).',
      '**El bloqueante del boton «Editar» era falso**: se reporto que colgaba el Deal Details (799 lineas) y el boton abria EditLeadForm (430); el Deal Details se monta aparte como la tab Pagos.',
      '⚠️ Quedo SIN LEER la verificacion en el navegador de la ficha sin boton: la corrida seguia cuando se cerro la cuenta.',
    ],
    commits: [
      { sha: '07540703', msg: 'Replay de sesion propio, el dataset de CRM de Meta, y la ficha sin boton «Editar»', lineas: 7032, archivos: 52 },
    ],
    archivos: [
      'lib/replay-contrato.ts — la forma del lote, los topes, la retencion y el apagador, en un solo lugar',
      'scripts/replay-libs.mjs — los artefactos de rrweb en public/, con su guard de pre-push (el numero trece)',
      'docs/relevo/crm.md — el estado para la sesion de la otra cuenta',
    ],
  },
  {
    "fecha": "5 oct",
    "hora": "14:57",
    "chat": "Funnel y oferta del CRM",
    "cuenta": "claude1",
    "actor": "martin",
    "tipo": "prompt",
    "titulo": "Acciones en lote, la tabla como la del plan, y mover filas",
    "pedido": "También revisa el diseño de la tabla, que se parezca más a como lo tenemos en el plan. Con acciones útiles. Y aplica lo que te pedí de mover filas, ya tenemos esa animación.\nMuy importante que implementes las acciones en LOTE, tanto para la vista de tablas como kanban... Copia todo del plan. Y piensa que acciones en lote valdría la pena.",
    "puntos": [
      "**Cuatro acciones en lote y una afuera a propósito**: etapa, closer, setter y producto sí; meter los seleccionados en una secuencia de nutrición no — es la única que MANDA MENSAJES, y la línea del chatbot es la no oficial.",
      "**La barra del plan no se pudo importar**: su `BarraLote` es genérica pero pide un `Board`, y de sus seis acciones cinco se apagarían para un lead. Se comparte el aspecto (la clase, el Dropdown, el molde de tres ranuras), no la pieza."
    ]
  },
  {
    "fecha": "5 oct",
    "hora": "15:19",
    "chat": "Funnel y oferta del CRM",
    "cuenta": "claude1",
    "actor": "claude",
    "tipo": "implementacion",
    "titulo": "La barra de lote en las dos vistas, y la tabla con casilla, orden y acciones",
    "puntos": [
      "⚠️ **`bulkFillLeadFieldAction` sólo rellenaba vacíos**: correcto para el worklist, donde los leads los eligió un filtro, y un bug en una selección deliberada — asignar un Closer a doce que ya tenían otro contestaba «0 actualizados». Va un `pisar` que por defecto es false.",
      "⚠️ **Y el primer push TIRÓ EL BUILD**: `export const TOPE_LOTE` en un archivo `use server`. El typecheck lo dio por bueno y el deploy quedó en Error con producción sirviendo la versión anterior. Cosechado en AGENTS.md y, desde el punto 5, con un guard para todo el repo."
    ],
    "commits": [
      {
        "sha": "403e9f40",
        "msg": "Acciones en lote en el CRM, y la tabla deja de ser una lista",
        "lineas": 739,
        "archivos": 4
      },
      {
        "sha": "cceda0d3",
        "msg": "Arrastrar filas en la tabla del CRM, y el `export const` que tiro el build",
        "lineas": 162,
        "archivos": 3
      }
    ],
    "archivos": [
      "app/crm/AccionesLoteLeads.tsx — la barra",
      "app/crm/actions.ts — moverLeadsDeEtapaAction y eliminarLeadsAction, por el choke point de a uno"
    ]
  },
  {
    "fecha": "5 oct",
    "hora": "15:46",
    "chat": "Funnel y oferta del CRM",
    "cuenta": "claude1",
    "actor": "martin",
    "tipo": "prompt",
    "titulo": "La tabla agrupada por etapa se ve horrible",
    "pedido": "No separes las etapas, se ve horrible, para eso están los filtros...\nY en la tarjeta, no debe estar el recuadro de selección multiple por defecto, solo si paso el cursor",
    "puntos": [
      "**Agrupar la tabla fue el segundo diagnóstico equivocado del arrastre**: de «mover una fila necesita un destino» salió una forma PERMANENTE para una capacidad que existe sólo mientras alguien arrastra. El destino que sobrevivió es otra FILA."
    ]
  },
  {
    "fecha": "5 oct",
    "hora": "16:07",
    "chat": "Funnel y oferta del CRM",
    "cuenta": "claude1",
    "actor": "martin",
    "tipo": "prompt",
    "titulo": "El nombre corrido por defecto en la tarjeta",
    "pedido": "Los nombres no deben estar desplazados por default, solo cuando paso el cursor se debe desplazar",
    "puntos": [
      "**El salto con el hover era lo QUERIDO**: yo lo había evitado con `opacity` y eso dejaba 23 px de sangría permanente. Una preferencia de diseño suya, no una regla técnica.",
      "⚠️ **La medición cazó lo que la lectura no**: con la casilla en ancho cero el nombre quedaba a 4 px en Chromium y 2 en WebKit — el margen que el navegador le pone a todo checkbox."
    ],
    "commits": [
      {
        "sha": "ef4dcab5",
        "msg": "La tabla vuelve a ser plana, y la casilla de la tarjeta sale al pasar el cursor",
        "lineas": 200,
        "archivos": 2
      },
      {
        "sha": "9dc1cf2e",
        "msg": "La casilla de la tarjeta deja de ocupar lugar hasta el hover",
        "lineas": 89,
        "archivos": 3
      }
    ]
  },
  {
    "fecha": "5 oct",
    "hora": "18:07",
    "chat": "Funnel y oferta del CRM",
    "cuenta": "claude1",
    "actor": "martin",
    "tipo": "prompt",
    "titulo": "Asignar campañas a un producto desde «Lead entrante»",
    "pedido": "Aún no tengo la opción de asignar campaña a un producto en la etapa de lead entrante",
    "puntos": [
      "Es el punto 5 del pedido original: «que podamos asignar una campaña y/o adsets a un determinado producto... la configuración de la primera etapa en todo funnel de \"Leads entrantes\", que se pueda tener un desplegable o algo para seleccionar las campañas que deberían caer allí»."
    ]
  },
  {
    "fecha": "5 oct",
    "hora": "18:47",
    "chat": "Funnel y oferta del CRM",
    "cuenta": "claude1",
    "actor": "claude",
    "tipo": "implementacion",
    "titulo": "Campañas y conjuntos de Meta → producto, por las tres puertas",
    "puntos": [
      "**Tres mediciones cambiaron el diseño**: el `utm_campaign` de la landing YA ES el id de la campaña (35/35 y 72/119), `adset_id_origen` existía y nadie lo escribía (0 filas), y `marketing_metrics_daily` tiene ad_id y adset_id juntos — el conjunto de un lead de landing sale del anuncio sin llamar a Meta.",
      "**La campaña manda sobre la landing**, como lo dijo Martín, y un lead que ya existe NO se mueve si vuelve por otro producto: queda escrito en su historial.",
      "⚠️ **La revisión adversarial (8 agentes) encontró siete problemas antes del push**, y el peor lo habría encontrado él en el primer intento: el pop-up del principal abierto desde el lápiz del selector no mostraba sus campañas ni dejaba asignar ninguna. Seis arreglados; el séptimo era un hueco viejo.",
      "**Migración 0193 aplicada ANTES del push** y verificada en information_schema: sin la columna, el webhook perdía los leads del formulario (contesta 200 y Meta no reintenta)."
    ],
    "commits": [
      {
        "sha": "c2a02c1a",
        "msg": "Asignar campañas y conjuntos de Meta a un producto, desde «Lead entrante»",
        "lineas": 1113,
        "archivos": 14
      }
    ],
    "archivos": [
      "lib/campana-config.ts — el mapa, la precedencia y los tres estados (puro, con test)",
      "lib/campana-funnel.ts — la resolución: embudos vivos, el del negocio como null, el conjunto desde el anuncio",
      "app/crm/CampanasDelProducto.tsx — el selector en la tarjeta de «Lead entrante»",
      "supabase/migrations/0193_lead_campana_meta.sql — leads.meta_campaign_id"
    ]
  },
  {
    "fecha": "5 oct",
    "hora": "22:37",
    "chat": "Funnel y oferta del CRM",
    "cuenta": "claude1",
    "actor": "martin",
    "tipo": "prompt",
    "titulo": "Campañas de Meta: tabla, menú de la columna, traer lo viejo",
    "pedido": "1. Una vez que marco las opciones de \"Marca hasta tres.\" y le doy guardar, debería ocultarse esas opciones, y como mucho quedar editable sutilmente... 2. En la opción de los 3 puntos de \"Lead entrante\" debería estar la opción para asignar una campaña. 3. Veo que \"Campañas de Meta\" tiene un loader... Entiendo que busca las campañas, pero el loader debería aparecer dentro del desplegable en todo caso, no en toda la sección, la sección siempre debe estar presente. Propongo que no sea un loader, que sea una sección directamente, porque es algo importante que requiere tener una barra de busqueda, filtros, ordenamientos... Si son muchas campañas debería poder buscar facilmente... Si le doy a los 3 puntos debería abrir un modal solo de eso. Haz que sea formato tabla, procura que se vea bonito y minimalista. Ya tenemos varios diseños de tablas. 4. Es importante que no haya tanta fricción al asignar una nueva campaña, porque podrían haber nuevas campañas todo el tiempo... Por eso, te propongo le pases al chat de Ads Manager que también agregue la opción de seleccionar producto al crear una campaña y que ahí se vayan cargando los leads de esa camapaña automáticamente. También en la vista de tabla de Ads Manager la opción de asignar a X producto. 5. Es importante que si selecciono una campaña, me traiga todos los leads. No solo los futuros. Por ejemplo, si yo estoy creando un nuevo producto, pero tengo una campaña que lleva tiempo, si la selecciono debería traerme esos leads... 6. También te consulto si consideras que estas opcioens deberían activarse también en otras etapas, como \"Agenda llamada\", para que un lead entrante ingrese por allí directo. O si de ante mano, para no complicar habilitar esta opción en cualquier etapa y que el usuario elija en que columna quiere que caigan los leads entrantes.",
    "puntos": [
      "Seis puntos: plegar la declaración, el «⋯» de la entrada, la sección siempre presente con la tabla en un modal, menos fricción (y pasarle al chat de Ads Manager el selector de producto), traer los leads viejos, y una pregunta sobre otras etapas."
    ]
  },
  {
    "fecha": "5 oct",
    "hora": "23:34",
    "chat": "Funnel y oferta del CRM",
    "cuenta": "claude1",
    "actor": "claude",
    "tipo": "implementacion",
    "titulo": "La tabla de campañas, y asignar trae los leads que la campaña ya tiene",
    "puntos": [
      "**La campaña de un lead viejo se reconstruye con datos exactos** (utm_campaign con id, y el anuncio cruzado con las métricas): 96% de los leads de Meta del cliente más grande. El nombre no agrega ninguno.",
      "⚠️ **Traer mueve sólo el producto, no la etapa.** `moverLeadsAFunnelAction` habría mandado a un lead que pagó de vuelta a «Lead entrante» — y una sola campaña tiene 896.",
      "**Pregunta sólo si va a mover leads**: una campaña nueva se asigna con un clic; una vieja dice cuántos y de dónde. Después queda el «Deshacer».",
      "La tabla también sirve sin Meta: completa con las campañas que conocen las métricas."
    ],
    "commits": [
      {
        "sha": "ebcfbad8",
        "msg": "Campañas de Meta: tabla en un modal, y asignar trae los leads que ya tiene",
        "lineas": 1372,
        "archivos": 10
      }
    ],
    "archivos": [
      "app/crm/CampanasModal.tsx — la tabla (buscador, filtros, orden, conjuntos)",
      "lib/campana-atribucion.ts — de qué campaña es cada lead, y cuáles se mueven (puro, con test)",
      "lib/campana-traer.ts — el movimiento en lote, sin tocar la etapa",
      "app/crm/EmbudoEntradas.tsx — la declaración plegada después de guardar"
    ]
  },
  {
    "fecha": "5 oct",
    "hora": "23:34",
    "chat": "Funnel y oferta del CRM",
    "cuenta": "claude1",
    "actor": "claude",
    "tipo": "correccion",
    "titulo": "Verificar escribió: un clic «para ver la pregunta» asignó una campaña en un cliente real",
    "puntos": [
      "La pregunta depende de un número del server; en ese cliente la previa dio 0 y el clic asignó directo. No se movió ningún lead y se revirtió en el acto.",
      "**Regla**: antes de hacer clic donde la rama la decide un dato del server, ese dato se mide con una lectura, y el clic va donde la rama esperada está garantizada."
    ]
  },
  {
    "fecha": "5 oct",
    "hora": "23:54",
    "chat": "Ads Manager",
    "cuenta": "claude1",
    "actor": "claude",
    "tipo": "implementacion",
    "titulo": "Elegir el producto al crear la campaña, y asignarla desde la tabla de Ads Manager",
    "puntos": [
      "Es el punto 4 del pedido de las 22:37, que el chat del CRM le pasó al de Ads Manager con el contrato: reusar las acciones de `app/crm/campanas-actions.ts`, sin segunda implementación ni escritura del setting.",
      "**Al crear**: selector opcional en la revisión, por defecto «sin producto». Si la asignación falla, la campaña queda creada y se avisa: no se revierte.",
      "**En la tabla**: columna «Producto (CRM)» en campañas y conjuntos, con la misma pregunta que el CRM y su «Deshacer». Sólo se dibuja si quien mira puede asignar.",
      "La regla de cuándo se pregunta y qué dice quedó en `lib/campana-asignar.ts`, y el modal del CRM pasó a importarla: una sola copia."
    ],
    "commits": [
      {
        "sha": "07073522",
        "msg": "Elegir el producto al crear la campana, y asignarla desde la tabla de Ads Manager",
        "lineas": 349,
        "archivos": 5
      }
    ],
    "archivos": [
      "app/ads-manager/ProductoCelda.tsx — la celda de producto de la tabla",
      "app/ads-manager/NuevaCampanaModal.tsx — el selector al crear",
      "lib/campana-asignar.ts — cuándo se pregunta y qué dice la pregunta (puro, con test)"
    ]
  },
  {
    "fecha": "6 oct",
    "hora": "00:52",
    "chat": "Funnel y oferta del CRM",
    "cuenta": "claude1",
    "actor": "martin",
    "tipo": "prompt",
    "titulo": "La ficha del lead: producto, Web, un WhatsApp, la cara, sin Reactivar, y las reuniones de entrega",
    "pedido": "1. En el detalle del lead, en el pop-up, falta el desplegable de productos, por si quiero poner a ese lead en otros productos. 2. Saca en el resumen el dato de \"Dirección\" eso no importa. En su lugar, pon \"Web\" 3. Si eliminamos el WhatsApp OFICIAL, solo debe quedar 1 botón de WhatsApp. 4. Y sería bueno que siempre traigas la foto de perfil del lead, buscala en WhatsApp y sino tiene, la foto del email... 5. Elimina lo de \"Reactivar\" en el detalle del lead, eso no tiene sentido, que siempre esté el mensaje sutil. 6. Revisa que en el detalle del lead, en reuniones, se están marcando muchas como R2, cuando claramente son ya de entrega de servicio... Eso tienes que solucionarlo. Se tiene que poder diferenciar cuando pasan a ser reuniones de entrega de servicio, y esas reuniones se visualizan en Customer Success, no aquí. Y también fijate que los desplegables de productos y etapa están mal ubicados a la izquierda, deberían estar a la derecha.",
    "puntos": [
      "Seis puntos sobre la ficha del lead, con dos capturas (el pop-up y la ruta /crm/21)."
    ]
  },
  {
    "fecha": "6 oct",
    "hora": "00:55",
    "chat": "Funnel y oferta del CRM",
    "cuenta": "claude1",
    "actor": "martin",
    "tipo": "prompt",
    "titulo": "La tabla de campañas: la casilla selecciona, «todos» y lote; el nombre del producto",
    "pedido": "1. El botón de checkbox no debería asignar, porque se entiende en todo MaKo que esa es la selección multiple... Y falta el checkbox más arriba para seleccionar a todo. Y luego una topbar aparece para poder asignar en lote. 2. El producto no debe decir \"Este\" eso es muy informal y no se entiende, debe tener el nombre del producto o los productos.",
    "puntos": [
      "Lo pidió probando la tabla en producción."
    ]
  },
  {
    "fecha": "6 oct",
    "hora": "01:13",
    "chat": "Funnel y oferta del CRM",
    "cuenta": "claude1",
    "actor": "claude",
    "tipo": "implementacion",
    "titulo": "La casilla selecciona, «todos» arriba, asignar en lote, y la columna con el nombre del producto",
    "puntos": [
      "La columna Producto es `ProductoCelda`, la misma pieza que la tabla de Ads Manager: dice el nombre y asigna de a una.",
      "Acciones en LOTE, con el mapa escrito una sola vez y un solo «Deshacer»; las de a una delegan en ellas.",
      "Cada lead cuenta UNA vez aunque se elijan una campaña y su conjunto juntos (`repartirPorItem`, con test)."
    ],
    "commits": [
      {
        "sha": "721ad387",
        "msg": "Campañas de Meta: la casilla selecciona, «todos» arriba, asignar en lote y el nombre del producto",
        "lineas": 286,
        "archivos": 6
      }
    ]
  },
  {
    "fecha": "6 oct",
    "hora": "01:15",
    "chat": "Funnel y oferta del CRM",
    "cuenta": "claude1",
    "actor": "martin",
    "tipo": "prompt",
    "titulo": "Filtro del CRM por campaña o por creativo",
    "pedido": "Por otro lado, en el CRM pon un filtro por creativo o por campaña, para ver de que ads vinieron los leads.",
    "puntos": []
  },
  {
    "fecha": "6 oct",
    "hora": "01:36",
    "chat": "Funnel y oferta del CRM",
    "cuenta": "claude1",
    "actor": "claude",
    "tipo": "implementacion",
    "titulo": "Filtrar el CRM por campaña y por creativo",
    "puntos": [
      "La clave es el ID (`campanaDeLead` + `adIdDeLead`), así una campaña renombrada es una sola fila con su nombre de hoy.",
      "Los leads del formulario traen el anuncio y no la campaña: su campaña sale de `getAnunciosMap`, una lectura cacheada nueva.",
      "Las opciones cuentan sobre lo que dejan pasar los otros filtros: con una campaña elegida, Creativo muestra sólo sus anuncios."
    ],
    "commits": [
      {
        "sha": "117ea2bd",
        "msg": "CRM: filtrar por campaña y por creativo, para ver de qué anuncios vinieron los leads",
        "lineas": 262,
        "archivos": 7
      }
    ]
  },
  {
    "fecha": "6 oct",
    "hora": "02:02",
    "chat": "Funnel y oferta del CRM",
    "cuenta": "claude1",
    "actor": "claude",
    "tipo": "implementacion",
    "titulo": "La ficha: producto en el pop-up, Web, un WhatsApp, la cara, sin Reactivar, y la entrega no es R2",
    "puntos": [
      "⚠️ **El diagnóstico obvio era el equivocado**: «posterior al primer pago» borraba la R2 real en 9 de 20 ventas (el apartado se cobra en la R1). Lo que separa la entrega es el CIERRE, comparado estricto.",
      "El escritor era el webhook de Fathom (no fathom-auto ni crm-auto): ahora corta antes de enganchar, de disparar el evento y de pagar el análisis.",
      "Los 45 links de entrega de 6 clientes salieron de `fathom_links`, con respaldo; siguen en `closing_analyses` y Customer Success los muestra.",
      "La foto: una pieza común con Customer Success (`foto-contacto.ts`). «La foto del email» es Gravatar: la de Gmail no es pública."
    ],
    "commits": [
      {
        "sha": "ee98547d",
        "msg": "Ficha del lead: producto en el pop-up, Web, un WhatsApp, la cara, sin «Reactivar», y la entrega no es R2",
        "lineas": 634,
        "archivos": 16
      }
    ],
    "archivos": [
      "app/api/webhooks/fathom/route.ts — la guarda de la entrega",
      "lib/insights-llamada-reparto.ts — esGrabacionDeEntrega (pura, con test)",
      "app/_components/foto-contacto.ts — la cadena de la cara, compartida con Customer Success",
      "supabase/migrations/0194_lead_web.sql — leads.web"
    ]
  },
  {
    "fecha": "6 oct",
    "hora": "02:33",
    "chat": "Funnel y oferta del CRM",
    "cuenta": "claude1",
    "actor": "martin",
    "tipo": "prompt",
    "titulo": "Cabecera del pop-up, guardar las fotos, campañas sólo en la entrada, Ganado → Customer Success",
    "pedido": "1. Los 2 desplegables uno abajo del otro, el texto de \"producto\" y encima \"2 sin marcar Solucionar →\" esta todo amontonado, no esta bien en diseño, te dejo a tu criterio, pero que eso quede bien. 2. Si, guarda las fotos sin problemas. 3. Está bien que las campañas solo caigan en la primera etapa. No, sin botón de solo los nuevos. 4. Es fácil, cuando un lead cae a \"Ganado\" ahí ya las reuniones que vienen van para Customer Success.\n\nTambién revisa que debe existir la opción de \"Quitar de este producto\", pero solo para los leads que estén en más de 1 producto.",
    "puntos": []
  },
  {
    "fecha": "6 oct",
    "hora": "02:46",
    "chat": "Funnel y oferta del CRM",
    "cuenta": "claude1",
    "actor": "claude",
    "tipo": "implementacion",
    "titulo": "La cabecera del pop-up es una fila, y las fotos de WhatsApp se guardan en nuestro bucket",
    "puntos": [
      "Cabecera: cara, nombre y ✕; abajo una fila con producto (ícono en vez del rótulo), etapa y el aviso a la derecha. Verificada a 1440 y a 390 px.",
      "La foto de WhatsApp vence a los 10 días: ahora se copia a `avatars/leads/<ws>/<lead>.jpg` (columna propia, nunca la cara elegida) y un cron diario sigue copiando.",
      "⚠️ El tope no es el código: de 5199 contactos de la agenda del cliente más grande sólo 509 tenían la URL vigente. Primer relleno: 43 leads.",
      "«Ganado → Customer Success» ya era la regla: `fecha_cierre` se escribe sola al pasar a Ganado. «Quitar de este producto» queda para decidir: hoy un lead vive en un solo producto."
    ],
    "commits": [
      {
        "sha": "0418a6ab",
        "msg": "Las fotos de WhatsApp se guardan en nuestro bucket, y la cabecera del pop-up es una fila",
        "lineas": 407,
        "archivos": 11
      }
    ],
    "archivos": [
      "lib/fotos-contacto.ts — copia las fotos vigentes al bucket",
      "lib/contacto-lead.ts — vencimiento, línea canónica y qué copiar (puras, con test)",
      "app/api/cron/fotos-contacto/route.ts — el cron diario",
      "supabase/migrations/0195_lead_foto_guardada.sql — leads.foto_auto_url / foto_auto_at",
      "app/crm/LeadSheet.tsx — la fila de controles del pop-up"
    ]
  },
  {
    "fecha": "6 oct",
    "hora": "10:41",
    "chat": "Funnel y oferta del CRM",
    "cuenta": "claude1",
    "actor": "martin",
    "tipo": "prompt",
    "titulo": "Arrastrar dentro de la columna: el orden manual (llegó por el chat de Customer Success)",
    "pedido": "cuando se hace esto, es como poner un \"ORDENAMIENTO\" dentro de filtros... normalmente se ordena por orden de llegada. Para quitar eso y volver a antes, simplemente es volver a ordenar por fecha y listo. Y luego si quiero volver a la posición que había dejado las tarjetas es simplemente quitar filtros.",
    "puntos": []
  },
  {
    "fecha": "6 oct",
    "hora": "11:16",
    "chat": "Funnel y oferta del CRM",
    "cuenta": "claude1",
    "actor": "claude",
    "tipo": "implementacion",
    "titulo": "Soltar una tarjeta adentro de su columna la deja ahí, y «Ordenar» pasa a «Manual»",
    "puntos": [
      "Se guarda la columna entera con un vecino (mig 0200, `lead_orden`), con «Reordenado» y su deshacer.",
      "«Filtrar» gana «Ordenar»: Manual / Fecha de llegada. Con algo arrastrado, «Manual» es la base y «Limpiar» vuelve a él.",
      "⚠️ A diferencia de Customer Success, los leads que llegan después del último arrastre van arriba: al CRM entran todos los días.",
      "⚠️ El «drop perdido» que midió Customer Success no se reprodujo en el CRM (4 de 4 llegaron): ese arreglo no se copió."
    ],
    "commits": [
      {
        "sha": "1703c786",
        "msg": "CRM: arrastrar una tarjeta dentro de su columna la deja ahí, y «Ordenar» pasa a «Manual»",
        "lineas": 542,
        "archivos": 11
      }
    ],
    "archivos": [
      "app/crm/orden-kanban.ts — cómo se ordena cada columna (puro, con test)",
      "app/crm/orden-actions.ts — guardar la columna",
      "lib/crm-orden.ts — leerla",
      "supabase/migrations/0200_lead_orden.sql — lead_orden"
    ]
  },
  {
    "fecha": "6 oct",
    "hora": "15:28",
    "chat": "Funnel y oferta del CRM",
    "cuenta": "claude1",
    "actor": "martin",
    "tipo": "prompt",
    "titulo": "«Mover a prueba» sacó un lead del producto principal: agregar, nunca mover",
    "pedido": "1. Le acabo de dar a un lead a \"Mover a prueba\" y se desapareció del producto principal de Mauricio. Eso JAMÁS debe pasar... No se debe \"Mover\" se debe agregar al otro producto... Y para eso en el desplegable, tal como lo hacemos en Customer Success, cuando está en más de 2 productos, salta el botón de X para sacarlo de alguno... Y si hay productos en los que no está, en lugar del botón de X, un ícono que indique que se lo peude agregar. Solucionalo y que me aparezca nuevamente el lead que moví...\n2. De todo lo que te dije, revisa si nos quedó algo pendiente o algo que yo deba decidir para avanzar.\n3. Revisa el proyecto CRM del plan, y todo lo que puedas finalizar, hazlo. Y lo que si o si requiera que preguntes, preguntame.",
    "puntos": []
  },
  {
    "fecha": "6 oct",
    "hora": "18:49",
    "chat": "CRM",
    "cuenta": "claude2",
    "actor": "claude",
    "tipo": "implementacion",
    "titulo": "Un lead en varios productos: la casa sigue en el lead y cada otro producto es una fila (mig 0207)",
    "puntos": [
      "Ficha (pop-up y ruta): X donde está (con 2+), ＋ donde no está; la etapa de al lado es la del producto que se mira.",
      "Tablero, lote, «Traer», alta, campañas y opt-in de la landing AGREGAN; se borraron las dos acciones que movían.",
      "⚠️ El producto del negocio se escribe NULL como casa y con su id como fila: con el id, el lead desaparecía de todos los tableros.",
      "Viajan juntos: updateLead ya no borra la venta al corregir otro campo, y el CRM automático nombra las reuniones como el embudo.",
      "Verificado en el navegador sobre el ws4 (agregar, arrastrar, quitar la casa, el lote y sus deshacer). El lead que se había movido ya estaba de vuelta."
    ],
    "commits": [
      {
        "sha": "f26c0a94",
        "msg": "CRM: un lead está en VARIOS productos — «agregar», nunca «mover» (mig 0207)",
        "lineas": 3841,
        "archivos": 42
      }
    ],
    "archivos": [
      "supabase/migrations/0207_lead_funnel.sql — lead_funnel",
      "lib/lead-funnel-reglas.ts — en qué productos está y qué se puede hacer (puro, con test)",
      "lib/lead-funnel.ts — agregar, quitar (promueve la casa), mover en un producto, lote",
      "app/crm/lead-view/ProductoDelLead.tsx — el desplegable de la ficha",
      "lib/lead-desenlace.ts — cuándo se toca la venta al guardar"
    ]
  },
  {
    "fecha": "7 oct",
    "hora": "20:19",
    "chat": "CRM",
    "cuenta": "claude2",
    "actor": "martin",
    "tipo": "prompt",
    "titulo": "Las respuestas del formulario de Meta, para los clientes de Código Inmobiliario",
    "pedido": "Ya está la implementación de \"Resumen de lo completado en el formulario.\"\nQue necesitan Codigo Inmobiliarios para sus clientes? Que NO tienen Landing, sino que corren ads a formulario de Meta... Poder visualizar las rptas de ese form en el detail del lead?",
    "puntos": []
  },
  {
    "fecha": "7 oct",
    "hora": "20:23",
    "chat": "CRM",
    "cuenta": "claude2",
    "actor": "martin",
    "tipo": "prompt",
    "titulo": "Hacer las tres, con el WhatsApp apagado",
    "pedido": "Hacé las 3, el whatsapp dejalo como borrador, no activado en chatbot",
    "puntos": []
  },
  {
    "fecha": "7 oct",
    "hora": "20:44",
    "chat": "CRM",
    "cuenta": "claude2",
    "actor": "claude",
    "tipo": "implementacion",
    "titulo": "Lo que contestó en el formulario de Meta: en el pop-up, legible, y su WhatsApp nace apagado",
    "puntos": [
      "Medido antes: los que corren formularios son los clientes de Código Inmobiliario (ws15), no el ws13; las respuestas ya se guardaban.",
      "El pop-up del tablero ahora las muestra: una sola pieza en la ruta y en el pop-up, resueltas en el server.",
      "Meta manda la clave y no el texto: la pregunta y las opciones se vuelven legibles; lo tipeado queda como se tipeó.",
      "El WhatsApp sale de la plantilla con {{lead_formulario}} y nace apagado: se prende en /chatbot por cliente."
    ],
    "commits": [
      {
        "sha": "e21003d6",
        "msg": "CRM: lo que contestó en el formulario de Meta se ve en el pop-up, legible, y su WhatsApp nace apagado",
        "lineas": 294,
        "archivos": 11
      }
    ],
    "archivos": [
      "lib/meta-leads-campos.ts — preguntaLegible, respuestaLegible, resumenRespuestas",
      "app/crm/lead-view/RespuestasFormulario.tsx — la sección, en las dos puertas",
      "lib/avisos-catalogo.ts — lead-formulario-meta: texto con variables, apagado",
      "app/api/webhooks/meta-leads/route.ts — manda los datos, no el texto"
    ]
  },
  {
    "fecha": "7 oct",
    "hora": "22:55",
    "chat": "CRM",
    "cuenta": "claude2",
    "actor": "martin",
    "tipo": "prompt",
    "titulo": "Invitar al curso al ganar, y la página de gracias pasa a Ganado (por Customer Success)",
    "pedido": "Una tarea que quiero que le mandes al CRM es muy importante, poder automatizar la invitación al curso cuando un lead cae a Ganado, así no se tiene que estar invitando manualmente... Pero que sea opcional, activar esa automatización. Y también mandale que automatice mediante el pixel de MaKo que si alguien cae en una TKY Page, se pueda automatizar pasar al lead a Ganado directamente, así por ejemplo, si alguien tiene compra carrito o lo que sea, y cae en esa TKY Page, se pase automático a ganado y a su vez si se tiene activado la invitación del curso automático, que sea todo automático.",
    "puntos": []
  },
  {
    "fecha": "7 oct",
    "hora": "23:59",
    "chat": "CRM",
    "cuenta": "claude2",
    "actor": "claude",
    "tipo": "implementacion",
    "titulo": "Pixel: quien llega a la página de gracias pasa a Ganado (apagado por default)",
    "puntos": [
      "Cada página del Pixel tiene «Es la página de gracias» en el paso 2; nace apagado.",
      "El lead sale de su visitor_id: sin lead no se crea uno y con dos no se elige; esas visitas quedan anotadas.",
      "Gana por los mismos caminos que el tablero, así que la invitación al curso encadena sola.",
      "La visita no prueba la compra: quien tenga la URL la abre sin pagar."
    ],
    "commits": [
      {
        "sha": "76cfa80f",
        "msg": "Pixel: quien llega a la página de gracias pasa a Ganado (apagado por default)",
        "lineas": 464,
        "archivos": 10
      }
    ],
    "archivos": [
      "lib/landing-gracias.ts — alVisitarPagina, ganarPorGracias",
      "lib/landing-gracias-reglas.ts — a quién es la visita, los pasos, las visitas sin ficha",
      "app/api/track/vsl/route.ts — el pageview pregunta después de guardar la visita",
      "app/integraciones/AsignarProducto.tsx — el interruptor en el paso 2"
    ]
  },
  {
    "fecha": "8 oct",
    "hora": "02:46",
    "chat": "CRM",
    "cuenta": "claude2",
    "actor": "claude",
    "tipo": "implementacion",
    "titulo": "Invitar al curso al pasar a Ganado, por embudo y apagado por default",
    "puntos": [
      "El interruptor está en el «⋯» de la columna Ganado; sólo admin y sólo si el producto tiene clases.",
      "Los tres caminos que pasan un lead a Ganado llaman al mismo enganche, sólo en la transición.",
      "La invitación es la de Customer Success, con su reclamo: dos disparos no mandan dos mails.",
      "Cada intento deja una línea en el historial con actor MaKo, salga o no."
    ],
    "commits": [
      {
        "sha": "77279ea4",
        "msg": "CRM: invitar al curso al pasar a Ganado, por embudo y apagado por default",
        "lineas": 491,
        "archivos": 10
      }
    ],
    "archivos": [
      "lib/crm-curso-al-ganar.ts — el interruptor y el enganche",
      "lib/crm-curso-al-ganar-reglas.ts — la transición y la línea del historial",
      "app/crm/CrmBoard.tsx — la opción en el «⋯» de Ganado",
      "lib/leads.ts · lib/pagos.ts · lib/lead-funnel.ts — los tres caminos a Ganado"
    ]
  },
  {
    "fecha": "8 oct",
    "hora": "06:05",
    "chat": "CRM",
    "cuenta": "claude2",
    "actor": "martin",
    "tipo": "prompt",
    "titulo": "La grabación de la visita no anda, y el feedback de Leila sobre el CRM",
    "pedido": "Porque esto aún no funciona... Si literalmente dice en el historial que estuvo más de 10 segundos... Revisalo bien y hazlo funcionar.\n\nPor otro lado, Leila me mandó feedback del CRM, soluciona eso también",
    "puntos": [
      "Leila, en el audio: «cuando la quiero cargar la empresa, ahí es donde me hace el loop… Guardar… y me dice sin empresa».",
      "Leila: «aquí no me preguntó cuánto es, puso el monto que se le cantó» y «ni siquiera lo guardó».",
      "Leila: «ella está en marca personal. Primero de por sí me entra al funnel principal»."
    ]
  },
  {
    "fecha": "8 oct",
    "hora": "07:50",
    "chat": "CRM",
    "cuenta": "claude2",
    "actor": "claude",
    "tipo": "implementacion",
    "titulo": "«Completar datos» ya no devuelve al lead a la etapa de antes, y la ficha se relee al guardar",
    "puntos": [
      "La ficha del tablero era una foto: «Solucionar» guardaba con la etapa de antes y movía al lead.",
      "«Completar datos» guarda y no mueve; las tarjetas que guardan avisan a la ficha.",
      "Quitar la casa: si la etapa promovida es Ganado, el lead queda ganado; el deshacer lo devuelve."
    ],
    "commits": [
      {
        "sha": "65ec2298",
        "msg": "CRM: «Completar datos» ya no devuelve al lead a la etapa de antes, y la ficha se relee al guardar",
        "lineas": 327,
        "archivos": 16
      }
    ],
    "archivos": [
      "app/crm/LeadSheet.tsx — releer",
      "app/crm/lead-view/ficha-cambio.tsx — el aviso",
      "app/crm/actions.ts — soloCompletar",
      "lib/lead-funnel.ts — quitarDeProducto"
    ]
  },
  {
    "fecha": "8 oct",
    "hora": "07:50",
    "chat": "CRM",
    "cuenta": "claude2",
    "actor": "claude",
    "tipo": "implementacion",
    "titulo": "El Ganado pregunta el monto del contrato y la tarjeta muestra la suscripción",
    "puntos": [
      "Sí se guardaba, en otra columna: la tarjeta ahora dice «$444/mes».",
      "Lo que lee el contrato se precarga y el paso del monto queda a la vista.",
      "La mensualidad y el plazo se corrigen en Deal Details y quedan en el historial."
    ],
    "commits": [
      {
        "sha": "9f9bfc57",
        "msg": "CRM: el Ganado pregunta el monto del contrato, la tarjeta muestra la suscripción y se corrige en el Deal",
        "lineas": 581,
        "archivos": 12
      }
    ],
    "archivos": [
      "app/crm/StageMoveDialog.tsx",
      "lib/venta-tipo.ts — montoDeTarjeta",
      "app/crm/[id]/deal-actions.ts"
    ]
  },
  {
    "fecha": "8 oct",
    "hora": "07:50",
    "chat": "CRM",
    "cuenta": "claude2",
    "actor": "claude",
    "tipo": "implementacion",
    "titulo": "«+ Agregar al CRM» desde WhatsApp deja elegir el producto",
    "puntos": [
      "Con 2 o más productos, el clic abre la lista y el lead nace en el elegido.",
      "Si ya existía, se lo agrega a ese producto.",
      "El nombre de un producto sale de una sola función (había 11 copias)."
    ],
    "commits": [
      {
        "sha": "2522cd55",
        "msg": "WhatsApp: «+ Agregar al CRM» deja elegir el producto y el lead nace ahí",
        "lineas": 584,
        "archivos": 20
      }
    ],
    "archivos": [
      "app/whatsapp/_shared/BotonAgregarAlCrm.tsx",
      "app/crm/actions.ts — crearLeadDesdeWhatsappAction"
    ]
  },
  {
    "fecha": "8 oct",
    "hora": "07:50",
    "chat": "CRM",
    "cuenta": "claude2",
    "actor": "claude",
    "tipo": "implementacion",
    "titulo": "La grabación de sesiones graba, se puede mirar, y la ficha dice la verdad",
    "puntos": [
      "La ficha ya no inventa «duró menos de 10 s»: la visita del #2593 es anterior al grabador.",
      "El r.js v2 graba a quien mira sin tocar y la foto entra en el beacon, sin repegar el Pixel.",
      "El reproductor nunca había podido abrir una grabación: ahora sí."
    ],
    "commits": [
      {
        "sha": "6106544d",
        "msg": "La ficha del lead dice por qué no tiene grabación, sin inventar duraciones",
        "lineas": 576,
        "archivos": 6
      },
      {
        "sha": "1075e528",
        "msg": "El grabador graba a quien mira sin tocar, y las grabaciones ya se pueden ver",
        "lineas": 878,
        "archivos": 7
      },
      {
        "sha": "9008bde1",
        "msg": "Las versiones publicadas del grabador ya no se pueden reescribir por accidente",
        "lineas": 59,
        "archivos": 3
      }
    ],
    "archivos": [
      "lib/replay-leer.ts · lib/replay-ficha.ts",
      "scripts/replay-envoltorio.js · public/replay/2/r.js",
      "lib/replay-reproductor.ts"
    ]
  },
  {
    "fecha": "8 oct",
    "hora": "12:52",
    "chat": "CRM",
    "cuenta": "claude2",
    "actor": "martin",
    "tipo": "prompt",
    "titulo": "Los pedidos de Joan: agenda, formulario por WhatsApp, el lead de Brigitte y el Pixel",
    "pedido": "Te paso las solucitudes de Joan:\n* El calendar integrado bien, pero no me deja modificar la agenda (crear editar y esas cosas). Fijate que lo estuvo intentando en el WhatsApp de MaKo con Código Inmobiliario.\n* No me trae la info del formulario al whatsApp cuando le pregunto. (Esto es cuando le pregunta en MaKo en WhatsApp por un cliente y no le trae esa info, fijate en el grupo de Brigitte)\n* Y lo más importante: Llego un nuevo lead form de Brigitte pero no se cargo en el CRM\n* Tampoco están pudiendo pegar el Pixel de MaKo, les salta este error. (Creo que esta tarea se la podes mandar a integraciones que estuvo trabajando en el pixel)",
    "puntos": [
      "El Pixel se lo pasé a Integraciones, como pidió Martín: botón «Descargar» en /integraciones (6a43d32e).",
      "La agenda también fue a Integraciones: el código es suyo y el doer lo estaba editando API de MaKo."
    ]
  },
  {
    "fecha": "8 oct",
    "hora": "13:08",
    "chat": "CRM",
    "cuenta": "claude2",
    "actor": "martin",
    "tipo": "prompt",
    "titulo": "El CRM sin el pre-onboarding (vía Customer Success, del audio del feedback del curso)",
    "pedido": "vos actualmente en el CRM tenés como el pre onboarding del CRM, yo lo que quiero hacer es quitar eso… tengo que quitar toda la fricción que hay en el CRM y que se entre automáticamente",
    "puntos": [
      "Le gana a la regla vieja «onboarding en toda tab»: lo que decía el panel sigue para MaKo."
    ]
  },
  {
    "fecha": "8 oct",
    "hora": "16:45",
    "chat": "CRM",
    "cuenta": "claude2",
    "actor": "claude",
    "tipo": "implementacion",
    "titulo": "Los leads de Brigitte entran solos, y MaKo ve lo que contestaron en el formulario",
    "puntos": [
      "No era el webhook: la página de Brigitte no está suscripta. Ahora el poll corre cada 10 min.",
      "El poll deja al webhook los leads de menos de 5 minutos, para no saltear el aviso.",
      "MaKo decía «no hay detalles» con la respuesta guardada: ficha_lead ahora la trae.",
      "El CRM entra directo al tablero, sin el panel de activación delante."
    ],
    "commits": [
      {
        "sha": "713661d7",
        "msg": "CRM: entra directo al tablero, sin el panel de activación delante",
        "lineas": 60,
        "archivos": 2
      },
      {
        "sha": "e869a24e",
        "msg": "Leads de Meta: el poll corre cada 10 minutos y deja al webhook los recién llegados",
        "lineas": 159,
        "archivos": 5
      },
      {
        "sha": "ddfb07e8",
        "msg": "MaKo: ficha_lead trae lo que el lead contestó en el formulario de Meta",
        "lineas": 131,
        "archivos": 5
      }
    ],
    "archivos": [
      "vercel.json · lib/meta-leads-poll-reglas.ts — cada 10 min y el guardia del webhook",
      "lib/mako-tools.ts · lib/meta-leads-campos.ts — formulario_meta en ficha_lead",
      "app/crm/page.tsx — sin PanelActivacion"
    ]
  }
];
