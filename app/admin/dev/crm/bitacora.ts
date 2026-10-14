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
  { titulo: 'Un lead en varios productos', detalle: 'Se AGREGA a otro producto, nunca se mueve (mig 0207) · traerlos de otro embudo con filtros y en lote', estado: 'hecha' },
  { titulo: 'El lead quieto', detalle: 'Un plazo por etapa · un aviso por día de los que lo pasaron, sin moverlos · el plazo salió de la pantalla el 12/10 (se arma en Automations)', estado: 'hecha' },
  { titulo: 'La ficha y el tablero del 12/10', detalle: 'Árbol de funnels · alta en cuatro campos con Instagram · MaKo Analyst atado al lead · total estimado por columna', estado: 'hecha' },
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
  },
  {
    "fecha": "8 oct",
    "hora": "19:50",
    "chat": "CRM",
    "cuenta": "claude2",
    "actor": "martin",
    "tipo": "prompt",
    "titulo": "Joan pidió una NOTA en el lead y MaKo creó una tarea",
    "pedido": "Revisa el grupo con Brigitte, Joan le pidió que cargue una NOTA a ese lead y creó una tarea... Cuando justamente creamos toda una documentación API para que MaKo en WhatsApp pueda hacer todas las acciones dentro de la app.",
    "puntos": [
      "Joan, por audio: «Solo agregá esa nota al lead Nicolás».",
      "Una hora antes, «movelo a calificado dentro del CRM» tampoco se hizo."
    ]
  },
  {
    "fecha": "8 oct",
    "hora": "20:50",
    "chat": "CRM",
    "cuenta": "claude2",
    "actor": "claude",
    "tipo": "implementacion",
    "titulo": "Los pedidos sobre un lead llegan a MaKo con su herramienta",
    "puntos": [
      "«Anotá» era «al plan» en tres lugares: clasificador, router y doer.",
      "17 de 19 pedidos comunes del CRM llegaban sin su herramienta. Ahora llegan todos.",
      "En los 178 mensajes reales cambian 4, y los 4 eran pedidos perdidos."
    ],
    "commits": [
      {
        "sha": "40d01258",
        "msg": "MaKo por WhatsApp: los pedidos sobre un lead (nota, etapa, calificado, etiqueta, closer, alta) llegan con su herramienta",
        "lineas": 295,
        "archivos": 4
      }
    ],
    "archivos": [
      "lib/mako-intencion.ts — esPedidoSobreLead y la regla 3-quater",
      "lib/mako-router.ts · lib/mako-doer-in.ts — «anotá en el lead» no es del plan",
      "tests/crm-pedidos-whatsapp.test.ts — el turno real, con las frases de los grupos"
    ]
  },
  {
    "fecha": "9 oct",
    "hora": "11:14",
    "chat": "CRM",
    "cuenta": "claude2",
    "actor": "martin",
    "tipo": "prompt",
    "titulo": "Marcar qué etapas son una reunión (lo pidió por el chat de Chatbot)",
    "pedido": "Si, lo que te pidió chatbot hazlo ahora",
    "puntos": [
      "El pedido, en su tanda sobre /chatbot: «dentro del editor de etapas en el CRM, debería poder seleccionarse qué etapas hacen referencia a una REUNIÓN»."
    ]
  },
  {
    "fecha": "9 oct",
    "hora": "11:25",
    "chat": "CRM",
    "cuenta": "claude2",
    "actor": "claude",
    "tipo": "implementacion",
    "titulo": "El editor de etapas marca qué etapa es una reunión",
    "puntos": [
      "Un botón «Reunión» por etapa; no en la entrada, el pago ni el cierre.",
      "Pregunta antes sólo si una reunión cambia de número: la fecha va por orden.",
      "Probado en ws3: desmarcar y volver a marcar deja el embudo idéntico."
    ],
    "commits": [
      {
        "sha": "adf1ca3d",
        "msg": "CRM: en el editor de etapas se marca qué etapa es una reunión",
        "lineas": 231,
        "archivos": 4
      }
    ],
    "archivos": [
      "lib/etapa-reunion.ts — qué se puede marcar y qué reuniones se corren",
      "app/crm/actions.ts — editarEtapaAction, op reunion",
      "app/crm/EtapasModal.tsx — el botón y la confirmación"
    ]
  },
  {
    "fecha": "9 oct",
    "hora": "15:04",
    "chat": "CRM",
    "cuenta": "claude2",
    "actor": "claude",
    "tipo": "implementacion",
    "titulo": "El plazo de cada etapa y el aviso del lead quieto (#800)",
    "puntos": [
      "Una pastilla «Plazo» por etapa en el editor de etapas.",
      "Aviso diario de los leads que pasaron el plazo, sin moverlos y sin depender del CRM automático.",
      "En una etapa de reunión, el reloj arranca el día de la reunión.",
      "Probado con datos reales en modo prueba (ws4) y la pastilla en el navegador (ws9)."
    ],
    "commits": [
      {
        "sha": "5a4e3f04",
        "msg": "CRM: el plazo de cada etapa y el aviso del lead quieto (#800); la revisión de propuestas lleva productos y campaña",
        "lineas": 1357,
        "archivos": 18
      }
    ],
    "archivos": [
      "lib/lead-quieto.ts — las reglas, puras",
      "lib/lead-quieto-aviso.ts — lee la base y emite crm-lead-quieto",
      "app/crm/EtapasModal.tsx — la pastilla Plazo",
      "app/crm/actions.ts — op plazo y EmbudoEnDetalle.plazos",
      "app/api/cron/crm-automatico/route.ts — corre después del motor"
    ]
  },
  {
    "fecha": "9 oct",
    "hora": "15:04",
    "chat": "CRM",
    "cuenta": "claude2",
    "actor": "claude",
    "tipo": "correccion",
    "titulo": "Confirmar un contacto de la landing ya no lo pierde",
    "puntos": [
      "La revisión muestra el «ya existe»: antes decía «Crear 1 lead» y no creaba nada.",
      "El lead queda en los productos que pidió: agregar, nunca mover.",
      "Conserva la campaña (utm, fbclid y la visita).",
      "Ya no dice «Lo propuso Claude» sobre un formulario de la landing."
    ],
    "commits": [
      {
        "sha": "5a4e3f04",
        "msg": "CRM: el plazo de cada etapa y el aviso del lead quieto (#800); la revisión de propuestas lleva productos y campaña",
        "lineas": 1357,
        "archivos": 18
      }
    ],
    "archivos": [
      "app/crm/revisar/[id]/propuesta-lead.ts — productos, atribución y quién lo propuso",
      "app/crm/revisar/[id]/acciones.ts — los aplica al confirmar",
      "app/api/track/optin/route.ts — la propuesta guarda los productos"
    ]
  },
  {
    "fecha": "9 oct",
    "hora": "22:40",
    "chat": "Integraciones",
    "cuenta": "claude2",
    "actor": "claude",
    "tipo": "correccion",
    "titulo": "«¿Qué hacer ahora?» volvía a no abrir nada",
    "puntos": [
      "Se vio grabando el video de la verificación de Google: el diálogo estaba montado y escondido. El tablero registraba una capa propia encima del wizard, que ya registra la suya, y la pila apagaba al wizard.",
      "La capa del tablero existe ahora sólo con el resultado del reagendado, el único overlay que dibuja él."
    ],
    "commits": [
      {
        "sha": "b57a53ba",
        "msg": "CRM: «¿Qué hacer ahora?» volvía a no abrir nada (dos capas en la pila para una pantalla)",
        "lineas": 58,
        "archivos": 2
      }
    ],
    "archivos": [
      "app/crm/CrmBoard.tsx — `capaQueHacer`",
      "tests/crm-que-hacer-capa.test.ts — 1 rotura"
    ]
  },
  {
    "fecha": "10 oct",
    "hora": "01:18",
    "chat": "Integraciones",
    "cuenta": "claude2",
    "actor": "claude",
    "tipo": "correccion",
    "titulo": "Reagendar ya no mueve un evento del dueño sólo porque está a la hora vieja",
    "puntos": [
      "Grabando el video, reagendar un lead de prueba movió el «Sprint 4» del jueves 8 de Martín al domingo 12 (se restauró a mano). La hora sola no dice de quién es un evento, y un lead con el email del dueño figuraba «invitado» a todo.",
      "Ahora prueba el lead invitado de verdad o un título parecido que no sea una reunión con otra persona; la hora sólo desempata. Sin prueba, el CRM crea un evento nuevo y MaKo dice que no la encontró."
    ],
    "commits": [
      {
        "sha": "98860f7e",
        "msg": "Agenda: reagendar ya no mueve un evento del dueño sólo porque está a la hora vieja",
        "lineas": 267,
        "archivos": 3
      }
    ],
    "archivos": [
      "lib/calendario-reunion.ts — qué evento es la reunión de un lead",
      "lib/google-calendar.ts — los tres lectores la usan",
      "tests/calendario-reunion.test.ts — 3 roturas"
    ]
  },
  {
    fecha: '10 oct', hora: '16:55', chat: 'Ads Manager', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Origen repite Campaña, y falta filtrar por anuncio',
    pedido: 'Acá al filtrar, en campaña, y en Origen, aparece lo mismo. Y falta el filtro de ANUNCIO, para filtrar por un ad específico. Mandale esta tarea al CRM',
    puntos: [
      'Lo pidió mandar al CRM y no había un chat de CRM abierto en la cuenta 2; quedó en su relevo, y enseguida: «Entonces soluciona eso tu mismo».',
    ],
  },
  {
    fecha: '10 oct', hora: '17:50', chat: 'Ads Manager', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El filtro de anuncios existía y no tenía datos: el select no pedía la columna',
    puntos: [
      'El diagnóstico obvio —falta construirlo— era el equivocado: existía desde el 06/10 y su test pasaba. El tablero no pedía `utm_content`, donde la landing guarda el anuncio: en Código Inmobiliario 44 de 52 leads lo tienen, con 13 anuncios con nombre, y el filtro se escondía por no tener opciones.',
      'Origen repetía las campañas porque listaba lo que dibuja la tarjeta (anuncio › campaña › canal). Ahora lista el canal —landing, Cal.com, formulario de Meta—; la tarjeta no cambió. Y «Creativo» pasa a «Anuncio».',
      'De paso: la tarjeta decía «Sin origen» sobre 50 leads que sí lo tienen, porque `origen_lead` tampoco se pedía.',
      'El guard que faltaba mira el cableado: que el select traiga todo lo que leen los mappers. Con el bug original de vuelta, pass 9 / fail 1.',
    ],
    commits: [{ sha: '686c51be', msg: 'CRM: el filtro «Anuncio» aparece, y «Origen» lista el canal y no la campaña', lineas: 147, archivos: 6 }],
    archivos: [
      'lib/leads.ts — LISTA_COLS, las cuatro columnas que faltaban',
      'app/crm/origen-lead.ts — canalDeLead',
      'app/crm/CrmBoard.tsx — el filtro de origen sobre el canal y el rótulo «Anuncio»',
      'tests/crm-filtro-ads.test.ts — el guard del cableado',
    ],
  },
  {
    fecha: '10 oct', hora: '19:01', chat: 'Ads Manager', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Campaña y Anuncio en un solo filtro, como árbol',
    pedido: 'No separes el filtro de Campaña y Anuncio... Que dentro del filtro de "Anuncio" estén las campañas primero como arbol y dentro se pueda seleccionar anuncios de esas camapañas',
    puntos: [
      'Llegó con el filtro «Anuncio» recién arreglado (686c51be): el menú tenía «Campaña» y «Anuncio» como dos listas sueltas.',
    ],
  },
  {
    fecha: '10 oct', hora: '19:18', chat: 'Ads Manager', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El filtro «Anuncio» es un árbol: las campañas arriba y sus anuncios adentro',
    puntos: [
      'Una sola lista en «Filtrar»: cada campaña con cuántos leads trajo y, colgados de ella, sus anuncios. Se tilda la campaña entera o anuncios sueltos.',
      'El cruce pasó de «Y» a «O»: la campaña A entera más un anuncio de la B muestra las dos cosas (con las dos listas separadas daba cero).',
      'Destildar un anuncio de una campaña tildada entera deja tildados los otros, como cualquier árbol con casillas. Esa lógica vive aparte y con test.',
      'Verificado en Código Inmobiliario: «VSL FUNNEL inmobiliarios CI» (44) con sus 13 anuncios; tildar «Pablo 25/09» deja la campaña en parcial y el tablero con sus 2 leads.',
    ],
    commits: [{ sha: 'bdbf3707', msg: 'CRM: el filtro «Anuncio» es UN árbol — las campañas arriba y sus anuncios adentro', lineas: 390, archivos: 5 }],
    archivos: [
      'lib/campana-atribucion.ts — arbolDeAnuncios y pasaFiltroAnuncio',
      'app/crm/arbol-seleccion.ts — tildar y destildar en el árbol',
      'app/crm/CrmToolbar.tsx — el árbol del menú',
      'app/crm/CrmBoard.tsx — una sola lista',
      'tests/crm-filtro-ads.test.ts — cinco guards, cada uno probado rompiéndolo',
    ],
  },
  {
    fecha: '10 oct', hora: '19:44', chat: 'Ads Manager', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Árbol de anuncios: chevron a la derecha, desplegar al tocar, panel más ancho',
    pedido: '1. El botón de desplegar debe estar a la derecha, no a la izquierda, siempre. Para las campañas. 2. Si clickeo una capaña, se seleccionan todos sus anuncios, eso ya lo hace. Pero quiero que se abra el desplegable cuando clickeo eso. 3. El ancho del desplegable debe ser más grande. Bajo ningún motivo debe tener scroll hacia la derecha.',
    puntos: [
      'Llegó al ver el árbol recién desplegado (bdbf3707).',
    ],
  },
  {
    fecha: '10 oct', hora: '19:54', chat: 'Ads Manager', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El chevron a la derecha, la campaña se despliega al tocarla y el panel crece sin scroll lateral',
    puntos: [
      'El chevron va después del número de la campaña; tocar la campaña la elige y la despliega, y sólo el chevron la pliega.',
      'El panel pasa de 262 a 360 px y nunca pasa el borde de la ventana: si no entra, se corre a la izquierda lo justo.',
      'Ese corrimiento topa en el borde del contenido, no en el de la ventana: la primera versión, a 390 px, metía el panel debajo de la barra lateral. Lo vio la captura.',
      'Verificado a 1600 y 390 px sobre Código Inmobiliario: sin scroll lateral en el panel ni agregado a la página.',
    ],
    commits: [{ sha: '8a39bb02', msg: 'CRM: el árbol de «Anuncio» con el chevron a la derecha, tocar la campaña la despliega y el panel más ancho sin scroll lateral', lineas: 144, archivos: 3 }],
    archivos: [
      'app/crm/CrmToolbar.tsx — el chevron, el despliegue al tocar y el lugar del panel',
      'app/crm/filtro-panel.ts — dónde y de qué ancho se abre el panel',
      'tests/crm-filtro-ads.test.ts — ocho roturas, cada una pass 16 / fail 1',
    ],
  },
  {
    fecha: '10 oct', hora: '20:01', chat: 'Ads Manager', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Destildar la campaña la vuelve a plegar',
    pedido: 'Si aprieto seleccionar una campaña se despliega, pero si deselecciono se debe volver a plegar.',
    puntos: [
      'Llegó con el despliegue al tocar recién desplegado (8a39bb02), que abría y nunca cerraba.',
    ],
  },
  {
    fecha: '10 oct', hora: '20:07', chat: 'Ads Manager', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Tildar la campaña la despliega y destildarla la pliega',
    puntos: [
      'Lo que se fija es lo que el toque HIZO: tildada, abierta; destildada, plegada. El chevron sigue abriendo y cerrando sin filtrar.',
      'Se fija el estado, no se alterna: con el buscador abierto todo se ve desplegado, y alternar a ciegas dejaba el registro al revés de lo que se veía.',
      'Verificado en Código Inmobiliario tildando y destildando dos veces seguidas: 15 filas abierta, 2 plegada.',
    ],
    commits: [{ sha: 'f531a170', msg: 'CRM: destildar una campaña del árbol la vuelve a plegar', lineas: 67, archivos: 3 }],
    archivos: [
      'app/crm/arbol-seleccion.ts — conGrupoAbierto',
      'app/crm/CrmToolbar.tsx — la fila de la campaña',
      'tests/crm-filtro-ads.test.ts — dos roturas, pass 17 / fail 1',
    ],
  },
  {
    fecha: '10 oct', hora: '20:25', chat: 'Ads Manager', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Sin chips debajo del filtro: limpiar va adentro del menú, como en el Plan',
    pedido: 'No debe salir los chips de abajo del filtro y el botón de "limpiar" si para eso ya está la notificacion en filtros. Dentro de filtros, de la misma manera que está en el PLAN, sebe aparecer un sutil texto abajo que diga "Limpiar filtros".',
    puntos: [
      'Mandó la captura de la fila de chips con «Anuncio: 004. Leads / Agenda…» y su «Limpiar».',
    ],
  },
  {
    fecha: '10 oct', hora: '20:31', chat: 'Ads Manager', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Se fue la fila de chips; «Limpiar filtros» vive abajo del menú',
    puntos: [
      'La fila de chips y su «Limpiar» se borraron (no tenían otro uso). El número sobre «Filtrar» dice cuántos filtros hay.',
      '«Limpiar filtros (N)» abajo del menú ya estaba, idéntico al del Plan: el test los compara contra el mismo molde.',
      'De paso: el «Limpiar» de los chips no soltaba los anuncios sueltos del árbol; el del menú sí.',
    ],
    commits: [{ sha: '0a55645e', msg: 'CRM: sin la fila de chips debajo de «Filtrar»; limpiar es «Limpiar filtros» adentro del menú, como en el Plan', lineas: 114, archivos: 4 }],
    archivos: [
      'app/crm/CrmBoard.tsx — sin la fila de chips',
      'app/crm/CrmToolbar.tsx — FiltroChips borrado',
      'tests/crm-filtro-ads.test.ts — que no vuelva, y el Limpiar igual al del Plan',
    ],
  },
  {
    fecha: '10 oct', hora: '20:38', chat: 'Ads Manager', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Los filtros del CRM se mantienen al refrescar o volver',
    pedido: 'Si refresco o me voy de pestaña y vuelvo, se deben mantener siempre los filtros. Haz ese cambio rapido',
    puntos: [
      'Hasta acá cada F5 o cada ida a otra tab dejaba el tablero sin filtros.',
    ],
  },
  {
    fecha: '10 oct', hora: '20:46', chat: 'Ads Manager', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Los filtros del CRM quedan guardados en el navegador, por cliente y por embudo',
    puntos: [
      'Etapa, origen, campaña, anuncio y el «Ordenar» elegido se guardan y vuelven al entrar; el buscador no.',
      'Una clave por cliente y por embudo: las etapas son de cada embudo y el super admin mira varios clientes desde el mismo navegador.',
      'La trampa: restaurar y guardar corren juntos, y el guardado de ese momento todavía veía los filtros vacíos y pisaba lo guardado. Se saltea esa una vez.',
      'Verificado en Código Inmobiliario: siguen tras el F5 y tras ir al Plan y volver; limpiados y F5, vuelven limpios.',
    ],
    commits: [{ sha: '0deedbe5', msg: 'CRM: los filtros sobreviven a un F5 y a irse de la tab', lineas: 123, archivos: 3 }],
    archivos: [
      'app/crm/filtros-guardados.ts — qué se guarda y cómo se sanea',
      'app/crm/CrmBoard.tsx — restaurar al entrar y guardar después',
      'tests/crm-filtro-ads.test.ts — dos roturas, pass 20 / fail 1',
    ],
  },
  {
    fecha: '11 oct', hora: '15:10', chat: 'Offer', cuenta: 'claude3',
    actor: 'martin', tipo: 'prompt',
    titulo: '«Producto» pasa a llamarse «Funnel» en todos lados',
    pedido: 'Las ofertas deben estar atados a los productos del CRM... Y quiero cambiar el concepto "Producto" por "Funnel" en todos lados... Porque un mismo funnel puede tener varias "ofertas"... Configuralo de esa manera, para que yo pueda seleccionar en que funnel analizar o crear una nueva oferta. Mandale como tarea al CRM que lo cambie en todos lados.',
    puntos: [
      'Lo escribió en el chat de la tab Offer, que se lo pasó al chat CRM.',
      'En el CRM ese «producto» ya era un funnel por dentro: la casa del lead es leads.funnel_id.',
    ],
  },
  {
    fecha: '11 oct', hora: '15:55', chat: 'CRM', cuenta: 'claude3',
    actor: 'martin', tipo: 'prompt',
    titulo: 'El catálogo sigue siendo «producto»: funnel > oferta > productos',
    pedido: '1. Es así: funnel > oferta > productos...\n2. Si, arrancalo ahora, ya se reestablecieron los tokens',
    puntos: [
      'Contestó las dos preguntas: el catálogo con precio (lo que va dentro de una oferta) no se renombra, y el cambio se hace ya.',
    ],
  },
  {
    fecha: '11 oct', hora: '16:26', chat: 'CRM', cuenta: 'claude3',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Todo lo que nombraba un funnel como «producto» o «embudo» dice «funnel»',
    puntos: [
      'El tablero, su selector, la ficha, importar, la bandeja de revisión, las campañas y el CRM del teléfono.',
      'Fuera del CRM, donde nombra al mismo funnel: Agregar al CRM de WhatsApp, Ads Manager, el paso 2 del Pixel, el CRON y las condiciones de Automations, el paso «⚡ Acción», el aviso del lead quieto.',
      'Queda «producto»: el catálogo con precio, la entrega de Customer Success y los cursos. Y las claves, tablas y operaciones de la API no cambian.',
      'Pendiente: las descripciones de la API de MaKo, la dimensión «Producto» de los gráficos y los prompts.',
    ],
    commits: [{ sha: '53ba6450', msg: 'CRM: lo que la pantalla llamaba «producto» (y «embudo») pasa a llamarse «funnel»', lineas: 436, archivos: 63 }],
    archivos: [
      'app/crm/CrmToolbar.tsx — el selector y el alta de un funnel',
      'app/crm/EtapasModal.tsx — eliminar y renombrar un funnel',
      'lib/lead-funnel.ts — los mensajes de agregar, quitar y mover',
      'lib/flujo-conversacion.ts — el paso «Funnels» del CRON',
      'tests/ — 13 tests que afirmaban el texto viejo',
    ],
  },
  {
    fecha: '12 oct', hora: '02:08', chat: 'CRM', cuenta: 'claude3',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Veinte arreglos de la ficha y el tablero, en un mensaje',
    pedido: 'Feedback:\n\n1. Cuando estoy cambiando el nombre de un funnel, si lo cambié y cierro la tab, debería cambiarse. Porque hoy en día tengo que darle un click afuera del modal de escribir pero dentro del modal, es contraintuitivo. Lo que cambio se queda.\n2. Todos las tabs tienen su nombre al lado de "MaKo", también debe tenerlo la de CRM.\n3. Elimina las tabs de "Nutrición" y "Etiqueta"... Las etiquetas no se configuran allí, eso en cada lead se le debe poder poner una etiqueta. Y las nutriciones deben tomarse como una etapa más... De última, un botón para marcarla como "Nutrición", que sea un desplegable para marcar "Reunión, Nutrición"...\n4. Elimina lo de "Pornerle un plazo", para eso ya tenemos la tab de "Automations" en todo caso eso se configura allí, como una automatización que se lo pase a otra etapa. \n5. En "Nuevo Lead" en la sección de telefono, siempre en todos lados que pida telefono, primero tiene que ir la numeración que ya tenemos con las banderas, el desplegable. En todos lados que se configure telefono es así.\n6. Elimina la "Fecha de agendamiento" y "Fecha de reunión 1 " en nuevo lead, eso no tiene sentido... Y menos si hay funnels que ni siquieran tienen reuniones... Agrega el paso de poner su sitio web.\n7. En el detalle del lead, solo puedo cambiarle la info si le doy click al guion "---" que esta en los campos... Eso no debe funcionar así. Si le doy click a la tarjeta debería ya saltarme el cuadro de texto, y debe ser más grande, no tan chiciquito el cuadro de texto... Basicamente como el ancho de esa tarjeta.\n8. Todas las nuevas etapas que creo, en las columnas, el circulito al lado de la etapa aparece en gris, no se por que...\n9. En la captura que te mando, que sea solo 1 desplegable de "PROSPECCIÓN" que es el funnel, y que sea un desplegable tipo arbol, que dentro de "PROSPECCIÓN" tenga mis etapas, y que ahí se configure eso... O le pueda agregar a otros funnel, etc... Y que ese desplegable esté arriba de donde hoy está "1 sin marcar". Y que la etiqueta pase a estar arriba del nombre donde dice "Círculo ROJO".\n10. Es MUY importante que revises los ID que estas asignando a los leads, porque en mi caso es mi 4to lead y tiene ID de #2646, no se si eso está bien o estás menzclando entre workspace, que sería grave ese problema.\n11. Quiero que a los leads le agregues la opción de configurar la portada y foto de perfil que ya tenemos en varios lugares. Y que si le doy click en el nombre grande, no solo en la tarjeta... Como en la empresa, también se pueda editar.\n12. Elimina el botón de "Cerrar" que está abajo del modal de un lead, para eso ya tenemos la cruz... Ahí debería estar el botón de "Borrar lead" y en rojo.\n13. Si en mi funnel no tengo ninguna etapa marcada como "reunión" no debería aparecer la tab de "reuniones" en el detalle. Y sería bueno que detecte automático si es una etapa de reunión con palabras clave, como "Reunión, R1, R2, agenda, llamada, etc..."\n14. Quiero que el modal del detalle del lead sea bastante más ancho, para aprovechar más el espacio.\n15. En "Datos sin completar" cuando le apreto, que no salga el botón de "Guardar y completar después", elimina ese botón, por defecto ya guarda... Y solo si son más de 1 paso debe saltar la última tab para "confirmar datos", sino, no es necesario.\n16. Cuando hago scroll por el modal, las tabs de arriba deben acompañar el scroll. Deben permanecer fijas, como todo lo que esta arriba.\n17. En "Notas" no permitas que el modal de texto se pueda modificar el tamaño. E implementa el botón de audio que tenemos en varios lugares, para dictarle. Y una nota se debería poder editar o eliminar luego de ser creada.\n18. La tab de "Tracking" recién debería salir si configuré una campaña vinculado a ese funnel, sino que no aparezca.\n19. Cambia el nombre de la tab "Análisis" por "MaKo Analyst" y replica el chat que tenemos en la tab de "Offer", basicamente que sea un chat con la IA que por defecto tenga atado los datos de ese lead, para eso tenemos una API de todo...\n20. En el modal de Nuevo Lead, elimina el botón de "Cancelar" para eso ya está la cruz de arriba.  Y el botón de "Crear Lead" que esté alineado abajo del todo, donde está el botón de "Traer de otro funnel".',
    puntos: [
      'Con dos capturas: las pestañas del navegador, donde todas dicen «MaKo - <tab>» menos el CRM, y la cabecera de la ficha de un lead (#2646) con el funnel y la etapa en dos desplegables.',
      'El punto 10 (que los ids de los leads no se mezclen entre negocios) se midió y no era un bug: el id sale de una secuencia global.',
    ],
  },
  {
    fecha: '12 oct', hora: '02:12', chat: 'CRM', cuenta: 'claude3',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Ingreso estimado en la ficha, y el total por columna',
    pedido: 'Y en "Información principal" pon una opción de "Ingreso Estimado", para poder colocarle un ingreso estimado a ese lead... Y si en una columna hay dinero, debería tener el total arriba del todo, cerca del título de la columna... Obvio que con una aclaración sutil o con un ícono o algo que represente "estimado", solo el verdadero ingreso en Ganados',
    puntos: [],
  },
  {
    fecha: '12 oct', hora: '02:17', chat: 'CRM', cuenta: 'claude3',
    actor: 'martin', tipo: 'prompt',
    titulo: 'La barra de arriba del tablero',
    pedido: '1. Elimina el título de la tab "CRM" con el emoji...\n2. Sube la topbar del todo.\n3. Que el desplegable de FUNNELS esté a la izquierda del todo, previo a los botones de "Kanban/tabla". Y que siempre tenga el ícono del cubo...\n4. Que los botones de "Activo, nutrición, descartado" sean un desplegable dentro de filtros.\n5. Que los 3 puntos estén a la derecha del todo, no antes de "Nuevo lead".',
    puntos: [],
  },
  {
    fecha: '12 oct', hora: '02:18', chat: 'CRM', cuenta: 'claude3',
    actor: 'martin', tipo: 'prompt',
    titulo: 'El alta, simple, y que abra la ficha',
    pedido: 'Y mucho mejor que el modal de "Nuevo Lead" sea simple, solo nombre, email y teléfono, que el resto se pueda configurar dentro... Y una vez que creo se debe abrir el detail automáticamente.',
    puntos: [
      'Reemplaza el punto 6 del primer mensaje: la web y las fechas se cargan dentro de la ficha.',
    ],
  },
  {
    fecha: '12 oct', hora: '02:21', chat: 'CRM', cuenta: 'claude3',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Cuatro campos, e Instagram buscando de verdad',
    pedido: 'Que sean 4 opciones... "Nombre, Email, Telefono, Instagram"... Y que Instagram sea un buscador real de todos los usuarios existentes de instagram, como la barra de busqueda que tiene el propio instagram, y que si escribo "Martin koncke" me salten las opciones con las fotos de perfil y pueda seleccionar."',
    puntos: [],
  },
  {
    fecha: '12 oct', hora: '02:24', chat: 'CRM', cuenta: 'claude3',
    actor: 'martin', tipo: 'prompt',
    titulo: '¿Y si se busca por Google?',
    pedido: 'Pero no puedes hacer la busqueda por Google por ejemplo? Yo creo que en Google se encuentran usuarios de Instagram con el filtro de buscar solo en la url de instagram...\n\nO esa es una que se me ocurrió de como hacerlo, piensa la mejor manera de hacerlo... Ahora que vamos a tener la app de Meta aprobada',
    puntos: [
      'Contestó así a la pregunta de que Instagram no tiene una API para buscar cualquier usuario por nombre.',
    ],
  },
  {
    fecha: '12 oct', hora: '08:35', chat: 'CRM', cuenta: 'claude3',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Los 28 puntos, en seis frentes y dos revisiones de lo que no se ve',
    puntos: [
      'Seis frentes con archivos disjuntos: etapas, tablero y alta, cabecera de la ficha, campos de la ficha, MaKo Analyst e Instagram.',
      'El tipo de una etapa (Etapa, Reunión, Nutrición) es una **marca aparte**, no un `kind` nuevo: así no cambia transiciones, reuniones ni automatizaciones.',
      '⚠️ **El buscador de Instagram por nombre no tiene fuente**: la API de búsqueda de Google está cerrada a clientes nuevos y se apaga el 1/1/2027. Anda por @ exacto (Meta) y por el nombre pegado.',
      'Dos revisiones de lo invisible arreglaron doce cosas que perdían o filtraban datos sin un error. La peor: **la caché del buscador era global**, y un negocio veía lo que había buscado otro, leído con el token de ese otro.',
      'Otra que no se veía: **el teléfono de la ficha se reescribía con +52 con sólo abrirlo y cerrarlo**, porque partir lo guardado en lada y número también inventa.',
      'La migración 0258 (ingreso estimado e Instagram) se aplicó a prod antes del push: el tablero las pide en su `select`.',
      'Sin mirar en el navegador. Quedan para Martín: la fuente del buscador, las bandas ocultas que ahora se guardan, el número de lead por negocio y dónde se editan las etiquetas.',
    ],
    commits: [{ sha: 'bdcee029', msg: 'CRM: el feedback del 12/10 — ficha, tablero, alta con Instagram y MaKo Analyst', lineas: 8645, archivos: 86 }],
    archivos: [
      'lib/etapa-reunion.ts — cuándo una etapa es reunión, y cuándo se marca sola',
      'app/crm/lead-view/CabeceraLead.tsx — el árbol de funnels, la portada y la foto',
      'app/crm/new/NewLeadForm.tsx — el alta en cuatro campos',
      'app/api/crm/instagram-buscar/route.ts — el buscador, con la caché por negocio',
      'lib/mako-analyst-lead.ts — el chat de MaKo atado al lead',
      'app/crm/total-columna.ts — el total estimado por columna',
      'supabase/migrations/0258_lead_ingreso_e_instagram.sql — las dos columnas nuevas',
    ],
  },
  {
    fecha: '12 oct', hora: '10:30', chat: 'CRM', cuenta: 'claude3',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Once arreglos sobre lo publicado esa mañana, sin multiagente',
    pedido: '1. Elimina la sección grande que aparece arriba cuando hay una llamada cercana. En su lugar, luego del botón de filtro, haz que aparezca un nuevo botón con ícono de calendario que esté tintineando, y que se abra un modal para ver lo que hoy en día aparece en ese contenedor grande de arriba,.\n2. Si le doy a nuevo lead siempre debería quedar el borrador, por más que salga del modal o incluso de refrescar la pagina.\n3. Deja la topbar más gruesa y mejor si se puede diferenciar sutilmente del desto.\n4. Revisa la captura que busque mi @ de instagram y no saltó nada, eso esta fallando. \n5. Sería bueno investigar alternativas a Brave Search, ya sea de otras apps o de otras formas de hacerlo que no cueste dinero y que podamos tener el mismo resultado.\n6. Si, deja que se mantengan los filtros incluso si doy F5.\n7. No se si ponerlo por negocio, decidelo tu lo que te parezca mejor y la practica mas comun...\n8. Para renombrarlas o editarlas para eso están las etiquetas dentro del detail de un lead, ahí en ese desplegable debe tener los 3 puntos de opciones en cada etiqueta para hacer esas acciones\n9. En la edición de las etapas faltan las etapas de nutrición que hoy ya tengo en el funnel... Pon todas las etapas directamente, incluso ganado y las de descartado, etc... Solo que Ganado y las de descartado no se deberían poder editar mucho.\n10. No entendí lo de "Plazos viejos:" a que te refieres?\n11. Si, claro que está bien, porque "Era calificado" es un botón para alimentar CAPI, solo para eso.\n\n\nSoluciona todo esto ahora, no importa que estemos al 90%, tal vez puedes dejar para despues lo más pesado, como lo de Instagram y el buscador...\nY no uses multiagente para esto, no es dificil de implementar',
    puntos: [
      'Con tres capturas: el tablero con la sección «Tus reuniones» arriba, el alta buscando su propio @ sin resultados, y el editor de etapas de PROSPECCIÓN sin las de nutrición.',
      'Pidió hacerlo ya aunque la cuenta estuviera al 90%, dejando para después lo pesado (el buscador de Instagram).',
    ],
  },
  {
    fecha: '12 oct', hora: '11:01', chat: 'CRM', cuenta: 'claude3',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Las reuniones en un botón, el borrador del alta, todas las etapas y las opciones de cada etiqueta',
    puntos: [
      'Las reuniones cercanas son un botón de calendario que late después de «Filtrar» y abre un pop-up con lo que mostraba la sección de arriba.',
      'El alta guarda su borrador en el navegador, por workspace de la pestaña: cerrar o recargar no pierde lo escrito.',
      'El editor de etapas lista las de nutrición (quitar una es **apagar** esa nutrición, no borrar una etapa) y Ganado y las de descarte, sólo con el nombre.',
      'Cada etiqueta tiene sus tres puntos en el desplegable de la ficha, incluidas las que el lead ya tiene, que se listan apagadas.',
      '**El número de lead sigue siendo el id global**: es el que vive en las URLs, los avisos, la API y la búsqueda por «#».',
    ],
    commits: [{ sha: '3e5176c9', msg: 'CRM: el segundo feedback del 12/10 — reuniones en un botón, borrador del alta, la banda de arriba, todas las etapas y las opciones de cada etiqueta', lineas: 813, archivos: 16 }],
    archivos: [
      'app/crm/ReunionesProximas.tsx — el botón que late y su pop-up',
      'app/crm/new/borrador-alta.ts — la clave y el saneo del borrador',
      'app/crm/EtapasModal.tsx — las filas de nutrición y las fijas',
      'app/_components/EditarEtiqueta.tsx — renombrar, color y archivar',
    ],
  },
  {
    fecha: '12 oct', hora: '11:37', chat: 'CRM', cuenta: 'claude3',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Ocho ajustes más: etapas en una lista, el país del teléfono, notas como los chats, «A revisar» en el lugar',
    pedido: '1. No separes las secciones en 2 partes, que este todo junto, y en el orden correcto... Y las etapas de nutrición deberían ser editables como cualquier otra etapa.\n2. Si le doy a nuevo lead, y cambio incluso es desplegable de la caracteristica del país, ya debería quedarse guardado eso... Y revisa que al entrar dice "seleccionado" ese desplegable, eso esta mal, debe estar como siempre con la última selección que hice. Y también quiero que se detecte automáticamente el país de origen del usuario por ubicación, como ya lo hacemos en otros lugares, y que por defecto siempre se ponga esa caracteristica.\n3. En notas, el botón de enviar como el de grabar audio debe ser como los otros chats que creamos dentro de MaKo, replica esos chats... Que se pueda adjuntar archivos, imagenes, emojis, etc... Ya tenemos varios chats como ese, lo pusiste en MaKo an2alyst por ejemplo... Solo que en este caso el "grabar audio" en lugar de grabar, transcribe.\n4. En "A revisar" jamás me debe llevar a otra tab, deben salir allí mismo los datos a revisar, en el desplegable.\n5. El contenedor que pusiste en la topbar, que no esté a todo el ancho de la pagina, sino al mismo ancho del kanban, y que tenga los bordes redondeados... Y que no esté pegado arriba, que sea basicamente como un contenedor y atrás el color del bg igual que el resto.\n6. Al momento de crear una nueva etiqueta, que el botón no diga "crear" que sea un icono check. Y en el desplegable de etiquetas, no pongas subtitulo de "ya la tiene", solo pon más opaco las etiquetas que no tenga... Porque hoy por ejemplo, puse una etiqueta y en el desplegable ya sale opaco... Y cambia el botón de tres puntos por un lapiz en las etiquetas.\n7. Si, pasa a una automatización eso de los plazos... Y ponlo como template en automations. Dile esto al chat de "Chatbot" que lo haga el.\n8. En el detail del lead, todo lo que está abajo de las tabs, siento que esta muy compacto, es decir, le falta "largo", tengo que hacer mucho scroll... Soluciona eso.',
    puntos: [
      'Con dos capturas: el editor de etapas de PROSPECCIÓN con una segunda sección aparte, y el alta con el país en «Selecciona…».',
    ],
  },
  {
    fecha: '12 oct', hora: '11:43', chat: 'CRM', cuenta: 'claude3',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Asignar campañas desde el editor del funnel',
    pedido: 'Dentro del editor de funnel, agrega un desplegable para asignar campañas, el mismo que tenemos en los 3 puntos de "Leads entrantes"',
    puntos: [
      'Llegó mientras se trabajaba la tanda de las 11:37, y salió en el mismo commit.',
    ],
  },
  {
    fecha: '12 oct', hora: '12:04', chat: 'CRM', cuenta: 'claude3',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Las etapas en una sola lista, el país que recuerda y se detecta, la barra como tarjeta y la ficha a alto completo',
    puntos: [
      'El editor de etapas es UNA lista en el orden del tablero: las propias, «+ Agregar etapa», Ganado, las de nutrición y los descartes, cada fija con una pastilla que dice qué es.',
      'La fila de entrada del editor tiene «Campañas de Meta», que abre el mismo pop-up de los tres puntos de «Leads entrantes».',
      'El país del alta abre con la última lada elegida, y si no hay, con la del país de la zona horaria. **El «Selecciona…» lo producía nuestro saneo del borrador**, que le sacaba el «+».',
      'La barra del tablero es una tarjeta redondeada del ancho del kanban, con el fondo de siempre detrás.',
      'Etiquetas: un lápiz en vez de los tres puntos, la puesta sólo opaca y un ✓ para crear.',
      'La ficha del lead ocupa la ventana entera, con alto fijo: el cuerpo de abajo de las pestañas ganó ~72 px.',
      'Los plazos de etapa como automatización se los pasé al chat de Chatbot. Quedan para después las notas como los chats (3) y «A revisar» en el desplegable (4).',
    ],
    commits: [{ sha: '40d5ba8c', msg: 'CRM: el tercer feedback del 12/10 — etapas en una lista, campañas en el editor, el país del alta, la barra como tarjeta, etiquetas con lápiz y la ficha más alta', lineas: 281, archivos: 10 }],
    archivos: [
      'app/crm/EtapasModal.tsx — una sola lista y el botón de campañas',
      'app/crm/new/borrador-alta.ts — la lada con su «+», la preferida y la de la zona',
      'app/crm/CrmBoard.tsx — la barra como tarjeta',
      'app/crm/lead-view/ficha-medidas.ts — el alto de la ficha',
    ],
  },
  {
    fecha: '12 oct', hora: '13:11', chat: 'CRM', cuenta: 'claude3',
    actor: 'martin', tipo: 'prompt',
    titulo: 'El editor del funnel: tipo de funnel arriba con sus campañas, todo se arrastra, nutriciones editables',
    pedido: 'El botón de agregar etapa no puede quedar ahí en el medio, eso está muy mal... Ponlo arriba del todo, arriba de lead entrante. Y Nutrición manual y excepcional también deberían ser editables... Todas las etapas de nutrición se deben poder editar, incluso si las quiero eliminar todas... Las etapas de nutrición también se deben poder desplazar arrastrando.\n2. El botón de editar en "lead entrante" debe cambiar... Primero elimina el botón de "Camapaña de Meta" al lado del botón de editar. Luego, cambia el formulario de "Marca hasta tres."... Elimina los subtitulos de las opciones, que solo se pueda elegir 1 opción, elimina el texto "Marca hasta tres.", elimina los botones de "guardar y dejar como estaba" cuando el usuario clickea en algo ya se guarda automáticamente, que las opciones estén referidas al FUNNEL, como "Anuncios a Landing", "Anuncios a WhatsApp", "Prospección", "Anuncios a carrito", "Anuncios a formulario", y que al clickear una opción de anuncios, ahí se ponga por defecto abierta el modal de "Campañas de Meta" en donde estaba el form del tipo de funnel... Si quiero cambiar de funnel una flechita para ir al paso de atras y listo. Solo el funnel "prospección" no debería tener la opción de "Campañas de Meta" por ningún lado, ya que justamente es prospección...\n... Quiero que elimnes el botón de "editar" de lead entrante, que toda la sección de edición del funnel se haga arriba de las etapas.\nEn las etapas, elimina los botones de las flechas, pon al inicio de cada etapa el típico icono de arrastre, para que se entienda que se puede arrastrar. Elimina los chips de "Ganado y descartado" de las etapas que lo tengan, que esas etapas simplemente no tengan nada, pero quiero que el contenedor se diferencie o algo que diferencien a esas etapas. Cambia el ícono de X por un icono de basura en rojo.\n\nSolucionalo ahora',
    puntos: [
      'Con dos capturas del editor de VSL FUNNEL: la lista de etapas con «+ Agregar etapa» en el medio y el formulario «Marca hasta tres» abierto bajo «Lead entrante».',
      'Lo pidió con la cuenta al 96% semanal: «Solucionalo ahora».',
    ],
  },
  {
    fecha: '12 oct', hora: '13:34', chat: 'CRM', cuenta: 'claude3',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El tipo de funnel arriba, sus campañas en el paso 2, y las etapas que se arrastran y se quitan todas',
    puntos: [
      'El funnel se edita ARRIBA de las etapas: el tipo es UNA opción y se guarda al elegirlo, sin «Marca hasta tres» ni botones de guardar.',
      'Un tipo de anuncios abre ahí mismo la tabla de «Campañas de Meta», con una flecha para volver. Prospección no tiene campañas.',
      '**El tipo ES la entrada de siempre** (`TIPOS_FUNNEL`): lo siguen leyendo los audios, el ensayo, las secuencias y el opt-in de la landing.',
      '«+ Agregar etapa» va arriba de todo; las flechas se fueron y cada etapa se arrastra por su asa, también las de nutrición.',
      'Las nutriciones se quitan TODAS, «Nutrición - Manual» incluida. Ganado y descartes sin pastilla, con la caja punteada; borrar es el tacho rojo.',
    ],
    commits: [{ sha: '53cf309f', msg: 'CRM: el editor del funnel — tipo de funnel arriba con sus campañas, etapas que se arrastran y nutriciones que se quitan todas', lineas: 959, archivos: 11 }],
    archivos: [
      'app/crm/EtapasModal.tsx — SeccionFunnel, las filas con asa y tacho',
      'lib/pipeline.ts — TIPOS_FUNNEL, idsParaQuitarNutricion, ordenarNutricion',
      'app/crm/actions.ts — quitarNutricion, ponerNutricion, ordenNutricion',
      'app/crm/CampanasModal.tsx — la tabla en línea',
    ],
  },
  {
    fecha: '12 oct', hora: '14:10', chat: 'CRM', cuenta: 'claude3',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Campañas: «Asignar a este funnel», el filtro de siempre y cinco con «Ver más»; etapas en tarjetas; el tipo también en las nutriciones',
    pedido: '1. Elimina el desplegable de "asignar a funnel", si estoy editando un funnel siempre se asigna a ese que estoy parado... En su lugar un botón de "Asignar a este funnel" Y elimina los 2 filtros de las campañas, en su lugar pon el ícono de filtro de siempre y obvio no va el filtro de "todos los funnels".\n2. Que las campañas sean pocas, unas 5 las que se muestren, y el botón abajo de "ver más" que ya tenemos en varios lugares...\n3. El desplegable de las etapas que dice "Etapa, reunión, nutrición" también lo debería tener los de nutrición... Y si se coloca "Etapa" se desplaza automáticamente hacia arriba, y viceversa. Es decir, también si arrastro debería cambiar ese desplegable.\n4. No hagas tan parecido la lista de etapas a la lista de camapañs, sino se confunde... Haz algo diferente las etapas, tal vez que sean tarjetas más gordas.',
    puntos: [
      'Sobre lo publicado del editor del funnel (f6abbff9), con la cuenta al 97% semanal.',
    ],
  },
  {
    fecha: '12 oct', hora: '14:29', chat: 'CRM', cuenta: 'claude3',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La tabla de campañas asigna al funnel abierto, filtra con el ícono de siempre y muestra cinco; las etapas son tarjetas',
    puntos: [
      'Con lo tildado aparece «Asignar a este funnel»: sin desplegable de funnels, por el mismo camino de antes (la previa y su pregunta).',
      'Los dos desplegables de filtro son UN botón «Filtrar» con el ícono de siempre: Estado y Funnel, sin «Todos»; cada opción se prende y se apaga.',
      'Se ven cinco campañas y el «Ver más» de la casa (useVerMas). La casilla de «todas» tilda sólo las que se ven.',
      'Las etapas son tarjetas: fondo blanco, anillo y sombra, más altas. Ganado y descartes siguen punteados.',
      '**Sin hacer:** el tipo Etapa/Reunión/Nutrición en las nutriciones y el pasaje entre bandas (punto 3): cambia el modelo y quedó en el relevo con su plan.',
    ],
    commits: [{ sha: '8ed12c64', msg: 'CRM: campañas con «Asignar a este funnel», el filtro de siempre y cinco con «Ver más»; las etapas son tarjetas', lineas: 197, archivos: 4 }],
    archivos: [
      'app/crm/CampanasModal.tsx — el botón del lote, el filtro, useVerMas',
      'app/crm/EtapasModal.tsx — SOMBRA_TARJETA, la caja y la fila',
      'tests/crm-campanas-tarjetas-12-10.test.ts',
    ],
  },
  {
    fecha: '12 oct', hora: '14:54', chat: 'CRM', cuenta: 'claude3',
    actor: 'martin', tipo: 'prompt',
    titulo: 'El desplegable de tipo en todas las etapas, el «+» entre etapas y el editor del funnel en cajas grises',
    pedido: '1. Revisa que Facturando y las etapas de nutrición no tienen el desplegable... Todos deberían ser lo mismo, sin excepciones...\n2. El placeholder de "Nueva etapa" debería ser igual de grande que la modificación que le hiciste al alto de las tarjetas.\n3. Si arrastro el cursor entre medio de etapas debería aparecer un botón de "+" para agregar una etapa ahí en el medio.\n4. Elimina el texto "2 asignadas a VSL FUNNEL"\n5. Revisa que la topnbar de buscar campaña, con la barra de busqueda, el filtro y los nombres de las columnas tienen el fondo blanco cuando el resto es de fondo un poco gris, corrige eso y que tengan el mismo fondo medio gris.\n6. De la misma manera, todas las etapas encierralas en un contenedor del mismo gris.\n7. En lugar del texto "Anuncios a Landing", que ahí diga "Asignar campañas" y que tenga el logo de Meta, no el logo del mundo.\n8. Y abajo en el recuadro de etapas, en ese mismo lugar que diga "Editar etapas" y que tenga el logo del kanban.\n9. Y que el paso anterior donde se selecciona el tipo de funnel, que sea igual en diseño, tipo lista, no botones.',
    puntos: [
      'Con una captura del editor de VSL FUNNEL ya publicado (Facturando y las nutriciones sin el desplegable). Con la cuenta al 97% semanal.',
      'A mitad de turno: «Pero no necesitas multi agente para esto... Son cambios faciles».',
    ],
  },
  {
    fecha: '12 oct', hora: '15:26', chat: 'CRM', cuenta: 'claude3',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El tipo de una etapa decide su lista, el «+» entre etapas y las secciones del editor en cajas grises',
    puntos: [
      'El desplegable Etapa/Reunión/Nutrición va en todas, Facturando y las nutriciones incluidas.',
      'Elegir el tipo muda la etapa de lista, y arrastrarla a la otra lista le cambia el tipo. Hay toast con deshacer.',
      'El modelo vive en lib/etapa-banda.ts. Una propia marcada Nutrición sale del recorrido, y una de catálogo sube con su clave.',
      'Hay un «+» entre dos etapas y entre nutriciones. «+ Agregar etapa» tiene el alto de las tarjetas.',
      'Las etapas van en una caja gris con «Editar etapas»; las campañas, con «Asignar campañas» y el logo de Meta.',
      'El tipo de funnel es una lista de tarjetas; la tabla de campañas perdió «N asignadas» y su barra es gris.',
    ],
    commits: [{ sha: 'ab720661', msg: 'CRM: el tipo de una etapa decide su lista, el «+» entre etapas y el editor del funnel en cajas grises', lineas: 803, archivos: 9 }],
    archivos: [
      'lib/etapa-banda.ts — cambiarTipo, insertarEnRecorrido, ordenConClave',
      'lib/pipeline.ts — esNutricionPropia, recorridoDe, generateFunnel',
      'lib/etapa-reunion.ts — puedeTenerTipo, conTipo conserva el pago',
      'app/crm/actions.ts — op tipo con at, agregar con nutricionEn',
      'app/crm/EtapasModal.tsx — elegirTipo, el arrastre entre listas, HuecoAgregar, CabeceraSeccion',
      'app/crm/CampanasModal.tsx — sin «N asignadas», fondo gris en línea',
    ],
  },
  {
    fecha: '13 oct', hora: '22:57', chat: 'CRM', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Feedback del detalle del lead: datos sin marcar, «A revisar», sugerencias de MaKo, Resumen, Pagos y «Nuevo CRM»',
    pedido: "FEEDBACK DEL DETAIL DEL LEAD:\n\nFeedback GENERAL:\n\n1. Elimina completamente el pop-up que salta al darle el botón de \"solucionar\" cuando hay datos sin marcar... En su lugar, al darle a ese botón me tiene que redirijir al dato que falta, ya sea cambiando de tab o desplazando a donde está el dato. Y una vez desplazado a donde está el dato, debería ponerse todo opaco y marcarse donde falta, como lo hacemos con los tutoriales que creamos en MaKo... Y antes de todo esto, el botón de \"Datos sin marcar\" debería decir \"ver ->\" y al darle click, si hay más de un dato sin marcar, debería saltarme un desplegable con los títulos de los datos sin marcar, y en ese desplegable, si el botón con ícono para \"solucionar\" y otro ícono para \"ignorar\"... En caso de ignorar, ya no salta la notificación y todos los ignorados como también los resueltos, pasan a esconderse, para ver los escondidos, abajo debe estar un botón de texto sutil, como el que tenemos en el desplegable de los filtros de \"borrar filtros\", que diga \"Ver más\", y que ahí salten los resueltos e ignorados. En caso de que todos sean resueltos e ignorados, no salta el botón de \"ver más\" sino que todo se ve en el desplegable directamente, y es importante poder configurar que datos quiero que MaKo me notifique que estan sin marcar, para eso, en el título del desplegable como en los 3 puntos de la tab CRM una opción para configurar esto, donde el usuario pueda elegir que datos le parecen importante que MaKo le notifique. Todo esto también afecta al desplegable que aparece en el CRM debajo a la derecha de \"A revisar\".  \n2. En ese desplegable de \"A revisar\", primero elimina la foto de perfil que dice \"Mk\". Segundo, solo deberían aparecer los datos sin marcar del CRM, no las notificaciones de \"MaKo movió 6 leads\", eso lo vamos a eliminar completamente... Ya que quiero que ahora todo eso pase a AUTOMATIONS, que el usuario desde esa tab pueda configurar cuando quiere que un lead se mueva de etapa o pase alguna acción dentro de MaKo. Lo que si te pido es que le mandes un mensaje al chat de \"Automations\" para que cree templates de esto, y que revise si hoy estamos preparado para esto, es decir, si la tab de automations tiene todas las opciones para estas acciones. También te pido que, para que sea fácil para el usuario, y este no tenga que estar saliendo de la tab del CRM y descubriendo que puede automatizar todo esto en otra tab, le vayas dando sugerencias cuando haga ciertas acciones dentro del CRM... Por ejemplo, cuando crea un funnel que tiene una etapa de REUNIÓN, que le des una sugerencia de automatizarlo... (Para el caso de reuniones, quiero que Automations pueda tener una opción para seleccionar un EVENTO del calendly o cal, porque el usuario puede tener muchos eventos en calendly y asignarlos a cada etapa de reunión)... Te pido que mapees todas las sugerencias que le puedes hacer al usuario para automatizar... Por ejemplo, si detectas que hay muchos leads en \"Lead entrante\" y no se mueven, que le sugieras al usuario \"Reactivar\" a todos esos leads... Y si acepta, que crees la etapa de nutrición correspondiente, si no la tenía, y que crees la automatización en \"Automations\". \n3. Todo esto, quiero que sea con el CHAT de MaKo, replica el mismo chat que hay en Automations, que se abre al costado... Que siempre esté plegado y que ahí aparezcan \"notificaciones\" cada que MaKo tenga una sugerencia como esa... No solo de mover leads de etapa, sino de crear secuencias de mensaje, y las que se te ocurran... Te pido que mapees todas las que se te ocurran y me las digas... Y que dispara esa sugerencia, quiero que sea inteligente, que pueda sugerir personalizadamente... Porque no es lo mismo un VSL Funnel que un funnel por prospección... ¿Qué dispara la sugerencia?\n4. También sigo viendo la parte de abajo de las tabs muy compacta, no quiero hacer tanto scroll... Te pido que de alguna manera compactes lo que hay arriba de las tabs. Tal vez poniendo la opción de etiquetas al lado del título, y si tienen más de una etiquta que aparezca como \"+2\" y un desplegable. Revisa como hacer más compacto lo de arriba y menos scroll abajo.\n5. Veo que si edito un nombre, y no le doy \"enter\" no se guarda el cambio... Siempre debería guardarse automáticamente, si cambio algo, lo que sea, dentro de un lead, el nombre de las etapas o lo que sea, si doy click afuera de ese editable, ya debería guardarse.\n6. También me gustaría que sea personalizable lo que se ve en las tarjetas del lead... Personalizable la tarjeta... Tener varios diseños template, como el que tenemos en Clientes, y otros. Y poder elegir que datos se colocan en la tarjeta. Eso me lo imagino en los 3 puntos de arriba, junto a los otros personalizables que tenemos, y que siempre los personalizables muestren en tiempo real como quedaría y que se pueda arrastrar campos, acomodarlos, que sea interactivo...\n\n\nFeedback de la tab RESUMEN:\n\n1. No solo quiero mejorar el diseño de la tab resumen... También quiero que sea PERSONALIZABLE... Porque a muchos usuarios tal vez le interesa ver cosas que a otros no... A algunos les interesa ver su IG, a otros su YouTube, a otros su Web, a otros su LinkedIn, a otros su dirección, a otros su sexo, otros quieren ver la respuesta del instant form, las respuestas del form de opt-in, etc... Entonces te pido que lo hagas personalizable, que sea simple y que el diseño sea bonito.\n2. También quiero que en esta tab se configure la opción de \"¿Era cualificado?\" para alimentar a CAPI... Que no esté más en tracking. Y revisa si tenemos que hacer una configuración de como se alimenta CAPI... Porque ¿Cómo el usuario alimenta X pixel, o X evento del pixel? Tal vez deberíamos hacer configurable esto. Revisa como funciona Meta CAPI.\n\n\nFeedback de la tab PAGOS:\n\n1. Tienes que hacer la pestaña de pagos mucho más sencilla para los usuarios. Para eso ten en cuenta que dentro de un FUNNEL el usuario podría elegir como \"Ganado\" y asignar una OFERTA de las que haya analizado... Entonces primero deberías poner un desplegable para asignar una oferta, o agregar una nueva que se haga desde allí mismo, con unas preguntas mínimas como nombre de la oferta, modelo (pago unico, suscripción) y el ticket y piensa si falta algo muy necesario... Y que una vez creada en el desplegable te de la opción de analizar oferta, que ahí, redirija a la tab de offer.\n2.  También la haría personalizable a esta tab. Como a la tab de Reuniones... Revisa muy bien el diseño y elementos de estos editables, quiero que se vean bien y que se pueda configurar tamaños, iconos, etc... Y que en el modal donde se personaliza todo, también se pueda cambiar personalizaciones generales, como tipografía, tamaños de las cards, colores, etc...",
    puntos: [
      'Lo pidió directo, con la máquina sin RAM para el typecheck: los pushes de todas las sesiones estaban trabados.',
    ],
  },
  {
    fecha: '13 oct', hora: '23:37', chat: 'CRM', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: '«A revisar» sin «Mk» ni «MaKo movió», «Nuevo CRM» arriba, y el CRM con nombre propio',
    puntos: [
      '«A revisar» muestra sólo los datos sin marcar. El motor del CRM automático sigue hasta que Automations tenga sus plantillas (pedido a ese chat).',
      '«Nuevo funnel» pasa a «Nuevo CRM» y va arriba del desplegable; «Funnels eliminados», a «CRM eliminados».',
      'Renombrar el CRM ya no renombra el producto (ni el curso). Mig 0269 aplicada: le copió a cada embudo el nombre que mostraba.',
      'Customer Success renombra el producto, no el CRM; el título del curso desde la oferta quedó pedido a ese chat.',
      'El mapa de sugerencias de MaKo, para que lo valide antes de construirlo: docs/sugerencias-mako-crm.md.',
    ],
    commits: [
      { sha: '5d4e308b', msg: '«A revisar» sólo con los datos sin marcar, y «Nuevo CRM» arriba del desplegable', lineas: 227, archivos: 5 },
      { sha: '85552622', msg: 'El CRM tiene nombre propio: renombrarlo ya no renombra el producto ni el curso', lineas: 238, archivos: 6 },
      { sha: 'e57d8630', msg: 'Mapa de las sugerencias de MaKo en el CRM, para que Martín lo valide', lineas: 84, archivos: 1 },
    ],
    archivos: [
      'app/_components/MakoConfirmGate.tsx — sin las confirmaciones ni la «Mk»',
      'app/crm/CrmToolbar.tsx — «Nuevo CRM» con unshift',
      'lib/funnels.ts — renombrarFunnel sólo el CRM, renombrarProducto',
      'lib/lead-funnel-reglas.ts — nombreVisible',
      'supabase/migrations/0269_funnel_nombre_propio.sql',
      'docs/sugerencias-mako-crm.md',
    ],
  },
  {
    fecha: '14 oct', hora: '00:15', chat: 'CRM', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'La grabación de la visita se queda cargando',
    pedido: 'También revisa en la grabación de la pantalla, en tracking no se está trayendo, lo intenté ver con un lead y se quedó cargando eternamente.',
    puntos: ['Llegó a mitad de la tanda de «Datos sin marcar».'],
  },
  {
    fecha: '14 oct', hora: '00:16', chat: 'CRM', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'La grabación se monta cuando existe el recuadro',
    puntos: [
      'Medido en producción: el requestAnimationFrame del montaje corría antes de que React dibujara el recuadro y salía callado. La grabación andaba montada a mano.',
      'Ahora monta el que llega segundo (lo bajado o el recuadro), y el cuerpo tiene tope de 30 s.',
    ],
    commits: [{ sha: '23fdf8a2', msg: 'La grabación de la visita se quedaba en un recuadro gris: se monta cuando el recuadro existe', lineas: 119, archivos: 2 }],
    archivos: ['app/crm/lead-view/GrabacionModal.tsx — intentarMontar, refLienzo', 'tests/grabacion-montaje.test.ts'],
  },
  {
    fecha: '14 oct', hora: '00:22', chat: 'CRM', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Datos sin marcar: «Ver →», solucionar que lleva al dato, ignorar por dato y de qué avisa MaKo',
    puntos: [
      '«N sin marcar · Ver →». Con un dato va derecho; con más, el desplegable con solucionar e ignorar, y lo escondido detrás de «Ver más».',
      'Solucionar cambia a la tab del campo y lo señala oscureciendo el resto (app/_ui/Senalar). El asistente queda de respaldo.',
      'Ignorar es por dato (mig 0270 aplicada). La asistencia a una reunión pasada no se ignora ni se apaga.',
      'De qué avisa MaKo: el engranaje del desplegable, el de «A revisar» y los tres puntos del CRM. Lo respetan el worklist, el contador y los avisos.',
      '«A revisar»: una fila por dato, con solucionar (abre la ficha en ese dato) e ignorar.',
      '«¿Era calificado?» pasa de Tracking a Resumen.',
    ],
    commits: [{ sha: 'f33f873c', msg: 'Datos sin marcar: «Ver →» abre la lista con solucionar e ignorar, y se elige de qué avisa MaKo', lineas: 1685, archivos: 36 }],
    archivos: [
      'lib/datos-aviso.ts — partirDatos, avisables, TAB_DE_DATO',
      'lib/stage-requirements.ts — pasosResueltos',
      'lib/datos-aviso-config.ts — lo apagado del negocio',
      'app/crm/lead-view/DatosSinMarcarCard.tsx — el renglón y el desplegable',
      'app/_ui/Senalar.tsx — el señalador',
      'app/crm/lead-view/AvisosDatosModal.tsx',
      'supabase/migrations/0270_lead_datos_ignorados.sql',
    ],
  },
  {
    fecha: '14 oct', hora: '00:35', chat: 'CRM', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Lo escrito se perdía al cerrar un modal con un clic en el fondo',
    puntos: [
      'Medido en producción: el nombre del lead sí se guardaba al salir del campo. Lo que se perdía era cerrar el modal con un clic afuera.',
      'El fondo cerraba en el mousedown y desmontaba el campo antes de su blur. Ahora saca el foco primero, y el campo guarda.',
    ],
    commits: [{ sha: 'f86e50d2', msg: 'Cerrar un modal con un clic en el fondo guarda lo que se estaba escribiendo', lineas: 50, archivos: 3 }],
    archivos: ['app/_ui/Modal.tsx — el fondo saca el foco antes de cerrar', 'tests/modal-guarda-al-cerrar.test.ts'],
  },
  {
    fecha: '14 oct', hora: '00:40', chat: 'CRM', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Cabecera del lead más compacta: las etiquetas al lado del nombre, con «+N»',
    puntos: [
      'Las etiquetas pasan al renglón del nombre; las que no entran quedan en un «+N» que abre la lista.',
      'La portada baja de alto. Las dos puertas de la ficha montan lo mismo.',
    ],
    commits: [{ sha: 'ae5912be', msg: 'Ficha del lead más compacta: las etiquetas al lado del nombre con «+N», y la portada más baja', lineas: 92, archivos: 6 }],
    archivos: ['app/crm/lead-view/EtiquetasDelLead.tsx — compacto', 'app/crm/lead-view/CabeceraLead.tsx — el hueco junto al título'],
  },
  {
    fecha: '14 oct', hora: '00:59', chat: 'CRM', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Pagos: la oferta del lead arriba, con «Nueva oferta» y «Analizar oferta →»',
    puntos: [
      'Un desplegable con las ofertas de Offer. «Nueva oferta» va arriba y pide nombre, cómo se cobra y el ticket.',
      'La oferta nueva queda ligada al CRM del lead, así aparece en Offer. Crear es del admin.',
      '«Analizar oferta →» abre ESA oferta en Offer: su conversación, o una nueva para analizarla.',
      'Migración 0272 aplicada: leads.oferta_id y ofertas.modelo (pago único o suscripción).',
    ],
    commits: [
      { sha: '5b480d1e', msg: 'Pagos del lead: la oferta arriba, con «Nueva oferta» y «Analizar oferta →»', lineas: 435, archivos: 8 },
      { sha: 'c49fe3c5', msg: 'Offer abre la oferta que nombra el link: «Analizar oferta →» del lead cae en ESA', lineas: 86, archivos: 5 },
    ],
    archivos: [
      'app/crm/lead-view/OfertaDelLead.tsx',
      'app/crm/oferta-lead-actions.ts — asignar, crear desde el lead',
      'app/offer/arbol.ts — entradaDelLink',
      'supabase/migrations/0272_lead_oferta.sql',
      'tests/oferta-del-lead.test.ts',
    ],
  },
  {
    fecha: '14 oct', hora: '01:40', chat: 'CRM', cuenta: 'claude2',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'Meta CAPI revisado: a dónde va «¿Era calificado?», y la tarjeta ya no afirma de más',
    puntos: [
      'Ningún cliente tiene conjunto de datos de CRM: todo va al píxel del sitio como SubmitApplication y QualifiedLead.',
      'Dos cuentas tienen el token y ningún píxel: lo que marcaban no llegaba a Meta y la tarjeta decía «Meta aprende de esto».',
      'Ahora, si no llega, la tarjeta lo dice y lleva a conectar Meta. Si no se pudo leer, dice lo de siempre.',
      'Elegir el evento a mano no se hizo: lo que mueve la aguja es el conjunto de datos de CRM. Lo decide Martín.',
    ],
    commits: [{ sha: '70918c59', msg: '«¿Era calificado?» dice a dónde va: «no le llega a Meta» donde falta el píxel', lineas: 190, archivos: 8 }],
    archivos: [
      'lib/meta-capi.ts — destinoYToken, adondeVaLaCalificacion',
      'lib/meta-capi-payload.ts — adondeDe',
      'app/crm/lead-view/CalificacionCard.tsx',
      'tests/calificacion-adonde-va.test.ts',
    ],
  },
  {
    fecha: '14 oct', hora: '01:50', chat: 'CRM', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El Resumen del lead, personalizable: qué datos y qué formularios se ven',
    puntos: [
      'Un engranaje en «Información principal» y «Qué muestra el Resumen» en los tres puntos del CRM. Un interruptor por dato; lo decide el admin.',
      'Datos nuevos: YouTube, LinkedIn, dirección y sexo. Nacen apagados; lo que ya se veía sigue prendido.',
      'Lo que la persona contesta en el formulario de la landing ahora queda en el lead (antes sólo viajaba en el WhatsApp) y se ve en Resumen.',
      'Migración 0274 aplicada. Los datos nuevos se editan, quedan en el historial y se deshacen.',
    ],
    commits: [{ sha: 'f2154a58', msg: 'El Resumen del lead, personalizable: qué datos y qué formularios se ven', lineas: 581, archivos: 20 }],
    archivos: [
      'lib/resumen-ficha.ts — el catálogo y los defaults',
      'lib/optin-respuestas.ts — las respuestas de la landing',
      'app/crm/lead-view/ResumenModal.tsx',
      'app/crm/lead-view/InfoPrincipalCard.tsx',
      'supabase/migrations/0274_lead_resumen.sql',
      'tests/resumen-ficha.test.ts',
    ],
  },
  {
    fecha: '14 oct', hora: '02:20', chat: 'CRM', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La oferta del lead y los datos nuevos del contacto, en la API de MaKo',
    puntos: [
      'Regla de Martín del 13/10: toda funcionalidad nueva va a la API. Antes no había ninguna operación sobre las ofertas de Offer.',
      'oferta_del_lead, asignar_oferta_lead y crear_oferta_lead, también por HTTP. Crear es del admin, como en la ficha.',
      'editar_contacto_lead suma web, Instagram, YouTube, LinkedIn, dirección y sexo.',
      'La ficha y la API usan la misma lógica (lib/oferta-lead.ts).',
    ],
    commits: [],
    archivos: ['lib/oferta-lead.ts', 'lib/api-mako/areas/crm.def.ts', 'lib/api-mako/areas/crm.run.ts', 'lib/api-mako/rest.ts', 'docs/api-mako.md'],
  },
  {
    fecha: '14 oct', hora: '03:00', chat: 'Automations', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Mover a mano pregunta la hora',
    pedido: 'con respecto a la fecha, si, sería bueno que si se mueve a mano, se pregunte la hora',
    puntos: ['Lo pasó el chat de Automations: sin la hora, el «1 h antes» no sale nunca a un agendado a mano.'],
    commits: [],
    archivos: [],
  },
  {
    fecha: '14 oct', hora: '03:20', chat: 'CRM', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Tres cosas que MaKo hacía «por detrás» mal, y la hora al mover a mano',
    puntos: [
      'T1 ya no propone No Show a quien CANCELÓ la R1.',
      'Mover de etapa desde el tablero, el ⚡ o una confirmación inscribe en la automatización de esa etapa en el acto.',
      'La etapa que limpia una reserva la firma Calendly o Cal.com, no MaKo.',
      'El paso de la fecha de la reunión pregunta la hora (opcional), en la zona del negocio.',
    ],
    commits: [],
    archivos: [
      'lib/crm-auto-plan.ts — T1',
      'lib/leads.ts — setPipelineStage, auditarEtapaDeLaReserva',
      'app/crm/horarios-respuesta.ts — instanteDeReunionManual',
      'app/crm/StageMoveDialog.tsx — FechaYHora',
    ],
  },
];
