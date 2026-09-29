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

export const PARTES: Parte[] = [
  { titulo: 'El tablero, la ficha y el corte por etapa', detalle: 'Kanban · tabla · «Datos sin marcar» · y mover un lead exige lo que esa etapa necesita', estado: 'hecha' },
  { titulo: 'Una sola puerta de alta', detalle: 'createLead con anti-duplicado propio · el lead de landing entra solo · los webhooks avisan cuando fusionan', estado: 'hecha' },
  { titulo: 'La bandeja de propuestas', detalle: '/crm/revisar: lo que escribe un canal se confirma antes de valer, con la MISMA tabla del importador', estado: 'hecha' },
  { titulo: 'El resumen del lead', detalle: '/crm/[id]/resumen para leer en el celular antes y después de la reunión · el análisis de la llamada a un botón', estado: 'hecha' },
  { titulo: 'Aislamiento del CRM por workspace', detalle: 'Ningún módulo de cliente lleva datos del dueño · un lead ajeno dice qué pasó en vez de un 404', estado: 'sigue' },
  { titulo: 'El lead y lo que se le vendió', detalle: 'leads.producto_id existe en la base (mig 0117) y NINGUNA línea de TypeScript la lee ni la escribe', estado: 'cola' },
];

export const BITACORA: Hito[] = [
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
];
