// =============================================================================
// Configuraciones — el registro de construcción del área
// =============================================================================
// Alcance: el contenedor de `/configuraciones` (una fila de tabs con
// Notificaciones, Identidades fiscales y Equipo cargando en el lugar) y, sobre
// todo, la tab de Notificaciones — que es donde se movió TODO en septiembre:
// qué avisa MaKo, por qué canal, a quién, con qué texto y cada cuánto insiste.
//
// ⚠️ El área vivía con el `vive[]` del contenedor solo, así que su panel de
// historial no veía ni uno de los once commits en los que el área se movió de
// verdad: el panel de notificaciones vive en `app/perfil/`, el catálogo de voz en
// `lib/avisos-catalogo.ts` y el store de plantillas en `lib/plantillas.ts`. Es
// exactamente el punto ciego que AGENTS.md describe —«¿qué archivo caliente no lo
// declara ninguna área?»— y por eso las rutas se sumaron con esta bitácora.
//
// De dónde salió esto: fecha, hora, sha y tamaño de `git log`/`git show
// --numstat` sobre las rutas del área; los `pedido` son TEXTUALES del chat; la
// cuenta, del marcador (`~/.claude/cuenta-activa.txt`). El nombre de la sesión
// sale de docs/chats.md, que llega hasta el 8/8 — de ahí en adelante va «—» en
// vez de un nombre inventado.
//
// NO es un changelog: va el motivo, la trampa y lo que quedó sin hacer.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'El contenedor con sus tabs', detalle: 'Una sola fila —Notificaciones, Identidades fiscales, Equipo— cargando en el lugar, más el link a Método · la tab NO viaja en la URL: arranca en Notificaciones por default, así que `/configuraciones` aterriza ahí', estado: 'hecha' },
  { titulo: 'Los mensajes se editan como se ven', detalle: 'La MISMA pantalla de `/mensajes` (`PlantillasView`) con el endpoint del cliente: lista a la izquierda, el chat de WhatsApp a la derecha, y el detalle para el texto, el interruptor y el flujo · parametrizar el endpoint en vez de copiar el componente', estado: 'hecha' },
  { titulo: 'UN interruptor por mensaje', detalle: 'Eran dos —`notification_prefs.avisos[id]` y `plantillas.store[id].enabled`—, consultados en cadena: apagar cualquiera silenciaba el aviso y prender uno solo no hacía nada · la migración de datos fue ANTES del cambio de código', estado: 'hecha' },
  { titulo: 'La lista blanca de lo que ve un cliente', detalle: 'SEIS avisos, elegidos a mano por el dueño, de 65 que tiene el catálogo · lista blanca y no marcar-lo-que-se-esconde: un aviso nuevo no se ve hasta que alguien lo agregue a propósito', estado: 'hecha' },
  { titulo: 'El techo de la insistencia', detalle: 'En dos capas: `sanearInsistir` en el código (5 veces, 30 min, ventana 8-21) y el CHECK de la mig 0180 · verificado en prod: un pedido de «99 veces cada 1 minuto» volvió como 5 cada 30', estado: 'hecha' },
  { titulo: 'Un canal a la vez, con su bandeja', detalle: 'Los tiles de WhatsApp y Email abren SU canal: el input de destinatarios de ese canal y debajo sus mensajes · los de WhatsApp como chat, los de email como una bandeja de correo, con el remitente leído de `/api/email/dominio` y nunca escrito a mano', estado: 'hecha' },
  { titulo: 'Los avisos administrativos, sólo del super-admin', detalle: 'Los 59 que no están en la lista blanca siguen saliendo y ya no se dibujan en la pantalla del cliente · se ven y se editan desde `/mensajes`', estado: 'hecha' },
  { titulo: 'Cada cuánto llega cada mensaje', detalle: 'El primer paso del detalle dejó de ser prosa: el HECHO que lo dispara arriba y, debajo, «cada cuánto, como máximo» · lo aplica el choke point con el MAYOR entre lo elegido y el dedup del call site, así que la pantalla sólo puede espaciar — nunca producir un mensaje de más', estado: 'hecha' },
  { titulo: 'El detalle es un lienzo', detalle: 'Qué lo dispara → el mensaje → por dónde te llega, y colgando del mensaje «si no contestas» → te insiste · las flechas salen del dato y los controles son los que ya existían, montados adentro de cada nodo · el chrome se comparte con el flujo de conversación del Chat Agent', estado: 'hecha' },
  { titulo: 'La tab en la URL', detalle: '`ConfigInnerTabs` no lee `?tab=`, así que un link a una tab que no sea Notificaciones no existe · el molde para hacerlo es `app/admin/ui/` (leer en el server + `router.replace` sin scroll)', estado: 'cola' },
  { titulo: 'Email para los avisos, no sólo para los reportes', detalle: 'Cada aviso elige su canal (`canales: { wa, email }` en su plantilla) y el choke point de `lib/avisos.ts` lo despacha · el email nace APAGADO en todos: prenderlo cuesta plata y quema la reputación del dominio para todo el producto, así que sólo un valor explícito lo enciende', estado: 'hecha' },
  { titulo: 'El correo se ve como un correo', detalle: 'La bandeja previsualiza con `renderEmailHtml`, el MISMO que arma el que sale, en un iframe · el mail ganó banda de marca, título, botón y las negritas que un `sinMarcas` le borraba, y perdió el dorado retirado en los links', estado: 'hecha' },
  { titulo: 'El texto de un REPORTE no llega al mail', detalle: '`lib/reportes.ts` arma el cuerpo con los datos y NO importa `lib/plantillas`: lo que el cliente edita del «Reporte semanal» es una muestra que el correo ignora · o el reporte deja de ofrecer edición de texto, o `despacharReporte` pasa a usar la referencia', estado: 'cola' },
  { titulo: 'Los crons de reporte no iteran inquilinos', detalle: 'Los tres `app/api/cron/reporte-*` no tienen `correrPorWorkspace`, y `getNotifPrefs()` y `getDestinatarios()` caen al dueño: hoy ningún cliente recibe un reporte · la pantalla lo muestra igual porque describe lo que el mensaje dice, no lo que el cron hace', estado: 'cola' },
  { titulo: 'Prender `meta-cuenta-frenada` de verdad', detalle: 'Nace prendido desde el 29/09, y las transiciones de meta-health siguen sin cablear: el aviso no puede salir todavía · cuando se cablee, ya está encendido', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  {
    fecha: '30 sep', hora: '11:55', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Los ocho que estaban mal, con dos capturas',
    pedido: 'Hay muchas cosas que no hiciste que te pedí... Que onda? Por que te lo tengo que repetir... 1. Te dije que el RECORDATORIO se debe configurar dentro del MENSAJE. 2. No cambiaste los títulos de MENSAJE y RECORDATORIO. 3. Qué es ese botón de \"Nada más\" no tiene sentido.!!! Quitalo... Son 2 botones como te dije, o por tiempo o por acción. 4. Estas PRECONFIGURANDO el cron, pusiste \"Los lunes a la mañana\" pero hard codeado, cuando JUSTAMENTE lo estamos haciendo editable... 5. No agregaste los parametros en el mensaje, para enviar datos dentro de MaKo 6. Por defecto se pone una nueva acción luego de un mensaje, que es eso? Por que se comporta de esa manera random... No debería agregar nada por defecto... Y lo peor, no me deja apretar el botón de + al lado de cada caja, porque al intentar arrastrar ek cursor, desaparece el botón de + 7. El título de la automatización NO puede ser más chico que el desplegable de abajo de categoría, tiene que ser más grande... 8. El mensaje de \"Sin publicar\" debería estar en todo caso abajo, al lado del botón de publicar... Que sentido tiene que esté arriba... Realmente muchas cosas mal, por favor, lanza multi agente o haz lo que tengas que hacer para hacerlo bien',
    puntos: [
      'Cuatro de los ocho ya los había pedido en la tanda anterior y no se habían hecho: RECORDATORIOS adentro del MENSAJE, los dos títulos, los parámetros de datos y los dos botones del CRON.',
      'Y dos eran defectos que había dejado la verificación en SU workspace: el paso «Crear una tarea» que apareció solo, y el ＋ inalcanzable.',
    ],
  },
  {
    fecha: '30 sep', hora: '15:40', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Los ocho, con un relevo de 10 agentes por delante',
    puntos: [
      'DOS nodos: CRON y MENSAJE. «Si no contestas» y «Te insiste» se fueron adentro del panel del mensaje, bajo el rótulo RECORDATORIOS — con la cadencia en día/semana/mes y las palabras de corte editables.',
      'El CRON son DOS botones y apagan al volver a apretarlos: lo único que «Nada más» tenía de propio era apagar. Y se fue la línea del catálogo que se leía como una preconfiguración; el hecho nativo sigue, en la tarjeta y rotulado «Hoy sale solo».',
      'El ＋ vive ahora adentro de un span que arranca en el borde de la tarjeta: medido, el hueco de 8 px lo apagaba en el paso 9 de 10 del camino del cursor. Y sólo sale donde el paso va a caer de verdad.',
      'El título del mensaje pasó a la escala de tipografía (15,5 contra los 14 del desplegable, que es lo que se reclamó) con el ancho pineado, porque un input no mide su texto y agrandar la letra habría agrandado el salto de la caja al hacer click.',
      '«Sin publicar» y el flash bajaron al lado de «Publicar»: estaban a 544 px de distancia, en esquinas opuestas.',
      'Los parámetros: un catálogo de 11 datos y links con la regla de admisión «sólo lo que el emisor ya tiene en la mano». Antes hubo que enseñarles a los DOS renderers a no partir los tokens — la itálica `_x_` se comía los guiones bajos de {{lead_nombre}}.',
      'Verificado en el navegador punto por punto, y el borrador y el paso que dejaron las pruebas en el ws1 se borraron en el acto.',
    ],
    archivos: [
      'lib/flujo-aviso.ts — dos nodos, el detalle del mensaje',
      'lib/variables-aviso.ts — el catálogo y el partido de tokens',
      'lib/variables-resolver.ts — los valores, en el server',
      'lib/flujos-tipos.ts — la cadencia en unidades y el saneo de las palabras',
      'lib/insistencias.ts — las palabras de corte por negocio',
      'app/_components/Lienzo.tsx — el puente de hover del ＋',
      'app/agencia/FlujoAviso.tsx — RECORDATORIOS adentro, el CRON de dos botones',
      'app/agencia/EditorMensaje.tsx — el selector de datos',
      'tests/variables-aviso.test.ts — 13 guards, las 9 roturas probadas',
    ],
  },
  {
    fecha: '30 sep', hora: '02:20', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La sección CRON: un mensaje sale por TIEMPO o por una ACCIÓN, y el tiempo no existía',
    puntos: [
      'La mitad ACCIÓN ya corría (los cinco EVENTOS con su choke point). La mitad TIEMPO no existía para nadie: los tres crons de reporte resuelven al workspace del DUEÑO, así que ninguna pantalla podía agendar nada — hay notification_prefs en cuatro workspaces y ningún cron las lee.',
      'Lo nuevo son cuatro piezas: el vocabulario y el cálculo (lib/cron-aviso.ts, puro y con 18 tests), la tabla (mig 0183), el drenador (lib/avisos-programados.ts + un cron a */10) y la sección de la pantalla.',
      'NO se reusó la RRULE del tablero: su `Freq` es cerrado en DAILY|WEEKLY|MONTHLY|YEARLY, `leerRRule(\'FREQ=HOURLY\')` devuelve null y hay un test que lo blinda — o sea que «cada X horas» exigía ampliar un tipo que importan quince archivos del board del plan.',
      'La próxima ocurrencia se ancla en la AGENDADA anterior y no en `now()`: anclar en el envío real corre el horario siete minutos por semana. Y avanza salteándose las perdidas, para que un cron caído un día mande UNA vez.',
      'La zona se congela en la fila y la pantalla la DICE («9:00 de America/Tijuana»): seis de los diez workspaces activos no tienen zona y caen a Tijuana, así que «a la mañana» era una afirmación sin medir.',
      'Se sacó de la pantalla el desplegable «cada cuánto, como máximo» —«realmente no me hace ningun tipo de sentido»— después de medir que los 108 avisos activos lo tienen en 0. El CAMPO y sus dos lectores quedan: lib/notify.ts es el único espaciado de los tres reportes.',
      '`Disparador.tsx` se borró (la sección CRON lo reemplazó) y sus tres guards se pusieron ROJOS, que es lo que hizo que alguien enumerara qué tenía de propio: el «sin botón de Guardar» y el revertir-si-falla se mudaron, el desplegable no volvió.',
      'Verificado en el navegador las cinco unidades, y el drenador contra la base: empujando una fila al pasado mandó 1, avanzó proxima_at al horario correcto y guardó su ancla. ⚠️ Eso le mandó un «Reporte semanal» REAL al grupo del ws1 a las 14:43 UTC; la fila de prueba se borró.',
      'Tres bugs que salieron de verificar y no de leer: un click en un PORTAL llegaba al handler del lienzo y deseleccionaba el nodo; el modo del segmentado derivado sólo de los datos hacía que «Por una acción» no se pudiera elegir; y la tabla no estaba en TENANT_TABLES, o sea que el drenador de un cliente leía las filas de todos.',
    ],
    archivos: [
      'lib/cron-aviso.ts — el vocabulario y la próxima ocurrencia',
      'lib/avisos-programados.ts — guardar, y drenar con compare-and-set',
      'supabase/migrations/0183_avisos_programados.sql',
      'app/api/cron/avisos-programados/route.ts + vercel.json',
      'app/agencia/FlujoAviso.tsx — SeccionCron y EditorCron',
      'lib/workspace.ts — la tabla entra a TENANT_TABLES',
      'app/_components/Lienzo.tsx — un click en un portal no es un gesto',
      'tests/cron-aviso.test.ts — 25 guards, las 13 roturas probadas',
    ],
  },
  {
    fecha: '30 sep', hora: '22:10', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Nueve cosas más: borrador, Publicar, CRON, MENSAJE y RECORDATORIOS',
    pedido: '1. Sigue sin formatearse en la vista previa a editar. 2. El botón de guardar debería estar abajo en donde hoy está acción , y en este caso eliminar \"mensaje al lead\", ya que no estamos configurando el chatbot. Y siempre siempre debería guardar todos los cambios como borrador. \"Acción\" debería estar al acercar el cursor sobre una tarjeta, debería aparecer al costado derecho un simbolo + 3. Elimina el texto \"Toca para editarlo...\" y que los botones de zoom con el de acomodar la pantalla estén abajo a la izquierda. Y el % de zoom no debería estar entre medio de los botones. 4. El botón de \"Activa\" debería estar arriba a la derecha y llamarse \"Activar\". 5. A la derecha del todo debería estar la X de cerrrar, en lugar del botón de \"Cerrar el editor\", y siempre que se cierra y haya cambios, debe preguntarme si quiero publicar o guardar como borrador. Para ello el botón de abajo en lugar de guardar, que se llame \"Publicar\". Y que siempre que me salgo de la vista, de la manera que sea, se guarde como borrador, que no se pierda nada. Pero solo cuando le doy a publicar, se publica. 6. El título de la automatización bien a la izquierda, arriba. Y que se pueda cambiar el título, como siempre, simplemente haciendo click en él. También debería poder cambiarse la categoría. 7. El editable de \"Qué lo dispara\" debería tener muchísimo menos texto, el menor texto posible... Y no tiene para nada sentido el desplegable de \"cada cuanto, como máximo\", realmente no me hace ningun tipo de sentido... El cron debería ser uno de dos... O el usuario lo configura para que salga en TIEMPO... 1 vez a la semana, al mes, al año, diariamente... Cada X horas... O lo configura que se dispare mediante una ACCIÓN. Y no deben poder editarse los 2 al mismo tiempo, primero se selecciona tiempo o acción y luego se selecciona el desplegable. Y el título de esa sección debe ser \"CRON\"... 8. La siguiente sección, debe tener el título de \"MENSAJE\". Y dentro, hace falta configurar llamados a datos dentro de MaKo... 9. Lo de \"Si no contesta\" debería llamarse \"RECORDATORIOS\", y no debería ser una nueva sección, sino una opción dentro de la sección de mensaje, que se pueda activar o desactivar... Y elimina el texto innecesario de abajo',
    puntos: [
      'Vino con cuatro capturas del detalle abierto. Los seis primeros son pantalla; el 7, el 8 y el 9 piden MOTOR —un cron por mensaje, variables de datos y recordatorios por día/semana/mes— y por eso salieron a medir antes de dibujar nada.',
      'El 5 es el que más cambia el modelo: hasta acá el texto se guardaba y salía; ahora hay dos estados, y el motor sólo puede ver el publicado.',
    ],
  },
  {
    fecha: '30 sep', hora: '23:40', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Los seis de pantalla: borrador con autoguardado, Publicar abajo, y el título y la categoría se editan',
    puntos: [
      'El texto se edita en BORRADOR y se compara contra lo publicado: escribir guarda solo (900 ms de respiro), salir de la vista guarda por los dos caminos que se pueden ver (el desmonte y `visibilitychange`), y cerrar con cambios pregunta con dos botones que cierran los dos — «Dejar como borrador» / «Publicar y cerrar».',
      'El borrador es el ÚNICO campo del store que NO se hereda del dueño: heredado, cada cliente abría el mensaje con un «Sin publicar» que no escribió, y al publicar publicaba el borrador de la agencia.',
      'El chrome quedó como cualquier editor: el título editable a la izquierda (click en él, como en el resto de la casa) con la categoría de desplegable debajo, «Activar» y la ✕ a la derecha del todo, y «Publicar» abajo a la derecha — donde antes estaban los botones de agregar pasos.',
      'Agregar un paso salió del pie y pasó al ＋ que aparece al costado de la tarjeta, que es lo que dice DÓNDE va a caer. «Mensaje al lead» se fue: no estamos configurando el chatbot.',
      'El filtro de «qué pasos dibuja el lienzo» estaba escrito CINCO veces en el componente y el índice del ＋ depende de él: se mudó al módulo del grafo, que es quien define los ids.',
      'Verificado en el navegador: la negrita se pinta en la previa sin asteriscos crudos, el lienzo es el recuadro entero (1130x618), «Publicar» a 12 px de la esquina, el ＋ agrega el paso, escribir dispara un POST `borrador`, publicar manda los dos en orden, y al reabrir el borrador sigue ahí.',
      'PENDIENTE (piden motor, medido y sin escribir): el CRON por TIEMPO (punto 7), las variables de datos y los links de MaKo dentro del mensaje (punto 8) y los RECORDATORIOS por día/semana/mes con palabras de corte configurables (punto 9).',
    ],
    archivos: [
      'lib/plantillas.ts — borrador, título y categoría en el store',
      'lib/flujo-aviso.ts — pasosDibujados/insertarPasoTras/quitarPasoDibujado',
      'app/agencia/TemplateDetalleModal.tsx — el chrome y el ciclo borrador→publicar',
      'app/agencia/FlujoAviso.tsx — el ＋ por tarjeta, el pie lo pone quien monta',
      'app/_components/Lienzo.tsx — el panel del nodo abre por encima del zoom',
      'tests/flujo-aviso.test.ts — 12 guards nuevos, los 8 probados rompiéndolos',
    ],
  },
  {
    fecha: '30 sep', hora: '17:05', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Diez cosas del lienzo',
    pedido: '1. El mensaje tiene cosas como ** pero no se formatea, eso está mal... 2. Cuando le doy a editar, el lienzo tiene que ocupar absolutamente todo el recuadro, incluso donde dice "cerrar el editor", de lo contrario, se ve muy chico. 3. El mesaje también se tiene que formatear en el editor. 4. "Que lo dispara" solo tiene tiempo, cuando hay acciones que pueden disparar esto... Como que llegue un lead al CRM, deberías poner todo lo que podría disparar un mensaje. 5. Hay un botón azul detrás del lienzo, no tiene sentido. 6. No tiene sentido el "Te llega al grupo de whatsapp" es un paso que no hace nada. 7. No se pueden arrastrar por el lienzo las tarjetas. Si deberían. 8. No se puede agregar un nuevo paso... 9. En el editor del mensaje dice "negrita, italica..." eso quitalo, no tiene sentido el texto, basta con los botones. 10. El botón de "Probar con IA" no hace nada. me escribe algo en azul abajo, pero no cambia el texto.',
    puntos: [
      'Vino con cinco capturas del detalle abierto. Tres de los diez puntos —el disparador por evento, arrastrar las tarjetas y agregar pasos— piden motor y almacenamiento, no pantalla.',
      'El 6 dejó una regla que vale para cualquier lienzo de esta casa: un nodo es algo que OCURRE. Por dónde sale un mensaje es un campo del mensaje, no un paso del flujo.',
    ],
  },
  {
    fecha: '30 sep', hora: '21:30', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Los diez: el lienzo es el recuadro, las tarjetas se arrastran y el disparador ofrece los eventos que existen',
    puntos: [
      'El texto se PINTA con su formato, en la burbuja y en el editor. El modelo sigue siendo las marcas del canal (`*negrita*`), que es lo que WhatsApp entiende; lo que cambió es cómo se escribe: un contenteditable que serializa de vuelta a marcas. Las tres trampas —el caret, `execCommand`, el pegado— están en el hallazgo.',
      'El lienzo ocupa TODO el recuadro y el chrome flota encima. Antes la topbar, la cabecera y el pie le comían ~180 px de 620 y el grafo entraba al 33%.',
      'El disparador ofrece los CINCO eventos que tienen choke point cableado, y se suman al disparador nativo en vez de reemplazarlo. Lo ejecuta `dispararEvento`, que ya existía y corría sin pantalla desde el 29/09.',
      'Se pueden agregar pasos (una acción o un mensaje al lead) y arrastrar las tarjetas, con la posición guardada por mensaje. Un paso agregado SIN evento elegido se dibuja con su advertencia: sólo corre por el camino del evento, y un paso que no corre y no lo dice es el control que se dibuja y no hace nada.',
      'Se fue el nodo «te llega»: su advertencia —los dos canales apagados— se mudó al nodo del mensaje. Y «Probar con IA» pasó a aplicar el texto en vez de dejarlo mirándose abajo.',
      '`Recordatorios` se absorbió en el lienzo: con dos componentes escribiendo el mismo `Flujo` por `setFlujo`, que lo reemplaza entero, el segundo en guardar se llevaba puesto al primero.',
      'Verificado en el navegador, los diez: el lienzo pasó de 344x420 a 1130x618, la negrita se pinta, arrastrar mueve 160 px y sobrevive al F5, agregar una acción crea su nodo, y «Que lo escriba MaKo» cambia el texto de 189 a 201 caracteres.',
    ],
    archivos: [
      'app/_components/Lienzo.tsx — arrastre de nodos y chrome flotante',
      'app/_components/TextoMarcas.tsx — el dialecto de WhatsApp, pintado',
      'app/agencia/EditorMensaje.tsx — contenteditable sobre el modelo de marcas',
      'app/agencia/FlujoAviso.tsx — el único dueño del flujo del mensaje',
      'lib/flujo-aviso.ts — el grafo, con eventos, pasos y posiciones',
      'tests/flujo-aviso.test.ts + tests/lienzo.test.ts — 25 guards',
    ],
  },
  {
    fecha: '30 sep', hora: '11:40', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'El lienzo va ACÁ, no en el Chat Agent',
    pedido: 'Se ve igual, no cambio nada... NO veo el lienzo',
    puntos: [
      'Vino con una captura de hola-mako.com/configuraciones, con el detalle de un mensaje abierto. El pedido original —«que los editables del flujo de conversación sea como el editable de Manychat»— se había construido en /chatbot: el relevo midió dónde estaban las filas y él estaba mirando esta pantalla.',
      'El propio relevo lo había marcado en su lista de «no medido»: «cuál de las dos pantallas quiere… es la ambigüedad que más cambia el alcance». Era la pregunta, no una nota al pie.',
    ],
  },
  {
    fecha: '30 sep', hora: '14:20', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El detalle de un aviso es un lienzo, y el chrome se comparte con el otro flujo',
    puntos: [
      'Cuatro nodos: qué lo dispara → el mensaje (la burbuja real) → por dónde te llega, y colgando del mensaje, «si no contestas» → te insiste. Las flechas salen del dato: la frecuencia, el paso `insistir` y los canales.',
      'Los controles son LOS MISMOS, montados adentro de cada nodo con su propio guardado (`Disparador`, `EditorMensaje`, `Recordatorios`). Reescribirlos habría dejado dos escrituras del mismo dato — lo que esta tab ya pagó con los dos interruptores de canal.',
      'El chrome del lienzo se extrajo a `app/_components/Lienzo.tsx` el mismo día que apareció el segundo: paneo, zoom, encuadre, el panel y las curvas viven una sola vez. Los seis guards del gesto se mudaron con él y se pusieron rojos al mudarse, que es la suerte.',
      'Dos cosas que el formulario apilado no podía decir: que el recordatorio cuelga de la RESPUESTA y no de la salida del mensaje, y POR DÓNDE te llega — que no se veía en ninguna parte desde que los chips de canal se sacaron del detalle. Con los dos canales apagados, el nodo lo dice y la flecha se pone roja.',
      'GOTCHA que costó una vuelta: `margin: 0 auto` en un item flex ENCOGE en vez de centrar, así que el lienzo quedó en 344 px dentro de un panel de 1130 y se dibujó al 33%. El auto-encuadre TAPA la causa: hace bien su trabajo con el ancho que le dieron.',
      'Y el guard que perseguía eso no lo cazaba: recortaba 1400 caracteres antes del montaje y el contenedor estaba ochenta líneas más arriba. Lo descubrió romperlo.',
    ],
    archivos: [
      'app/_components/Lienzo.tsx — el chrome compartido por los dos flujos',
      'lib/lienzo-grafo.ts — los tipos, la geometría y las curvas',
      'lib/flujo-aviso.ts — el grafo de un aviso',
      'app/agencia/FlujoAviso.tsx — los nodos y sus editores',
      'tests/flujo-aviso.test.ts + tests/lienzo.test.ts — 16 guards, cuatro probados rompiéndolos',
    ],
  },
  {
    fecha: '29 sep', hora: '20:10', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'El disparador tiene que ser editable — por segunda vez',
    pedido: 'Y el "Qué lo dispara" NO es editable...',
    puntos: [
      'Es la reafirmación del punto 4 de la tanda anterior: «El primer paso debería ser el disparador y eso se DEBE poder configurar... ¿Qué lo dispara? Un evento o está configurado por tiempo cada X tiempo por ejemplo», junto con el 5: «Falta poder editar la frecuencia».',
      'La respuesta anterior había sido dibujarlo en prosa, con la medición al lado: para 60 de 65 mensajes lo que los hace salir es el call site. Era cierta y contestaba media pregunta.',
    ],
  },
  {
    fecha: '29 sep', hora: '21:40', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El primer paso se configura: cada cuánto, como máximo',
    puntos: [
      'La mitad que SÍ es una decisión del negocio es CADA CUÁNTO, y ya tenía motor: el `dedupTtlMin` del choke point decidía la frecuencia de cada aviso con reclamo atómico, sólo que cableado en cada call site. Lo que faltaba no era un mecanismo nuevo — era que ese número saliera de la pantalla.',
      'La regla que gobierna el control: se puede ESPACIAR, nunca APRETAR. El choke point toma el MAYOR entre lo elegido y lo que pide quien emite, así que en el peor caso salen menos mensajes. Con un `??` en vez del `Math.max`, elegir «cada vez» borraría el dedup que un cron necesita para no repetir la misma alerta cada hora.',
      'Lo aplican los DOS despachadores: `emitirAviso` para los 62 avisos y `despacharReporte` para los tres reportes. El corte va en lugares opuestos a propósito — en un aviso DESPUÉS del feed (el hecho pasó igual y queda en la bitácora) y en un reporte ANTES (ahí el feed ES el mensaje).',
      'El reclamo atómico se mudó a `lib/espaciado.ts` porque ahora lo usan los dos: con una copia en cada uno, la de reportes habría nacido sin el compare-and-set, que es la parte que hace que funcione.',
      'GOTCHA que no daba ningún error: los reportes se llaman `reporte_diario` con guion BAJO y el catálogo los guarda con guion MEDIO. Buscar la config con el primero contesta el default, y el desplegable queda decorativo justo en los tres mensajes que más se abren. Va un mapa explícito (`ID_DE_REPORTE`), no un `replace` de guiones.',
      'Verificado en el navegador eligiendo y RECARGANDO, no mirándolo dibujado: un desplegable optimista se ve igual cuando guardó y cuando no. «Cada vez» → «Máximo uno por día» → la API devuelve 1440 → F5 → sigue puesto. Y se dejó como estaba: el único workspace donde esa pantalla se ve es el ws1, que es un cliente real.',
    ],
    archivos: [
      'lib/disparador-mensaje.ts — las opciones, el saneo y la regla del mayor de los dos (sin `server-only`)',
      'lib/espaciado.ts — el reclamo atómico, compartido por los dos despachadores',
      'app/agencia/Disparador.tsx — el primer paso del detalle, que guarda al elegir',
      'tests/disparador-frecuencia.test.ts — 12 guards, cinco de ellos probados rompiéndolos',
      'docs/hallazgos-comunicacion.md — las cinco entradas de esta tanda',
    ],
  },
  // ── 28 sep: la tarea del plan, y lo que el pedido NO decía ────────────────
  {
    fecha: '28 sep', hora: '16:20', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Notificaciones editables: qué se avisa, cada cuánto y qué lo dispara',
    pedido: 'Quiero implementar esta tarea de mi plan "Notificaciones editables: qué se avisa, cada cuánto y qué lo dispara" estoy seguro que hay otras tareas o detalles al respecto. Pero basicamente, me imagino que en la tab de notificaciones, dentro de configuraciones, los usuarios de MaKo puedan elegir no solo que mensajes quieren recibir en el grupo de WhatsApp, sino también como quieren recibirlo, editar el mensaje, la acción que lo dispara, que contiene el mensaje, etc...',
    puntos: [
      'Lo que el pedido no decía y apareció al abrir el código: el store de plantillas y flujos estaba **cableado a `OWNER_WS`** mientras `dispararEvento` corre con el workspace del evento. O sea que los flujos del dueño ya se estaban disparando en los grupos de los clientes. El pedido era «que el cliente pueda editar»; la precondición era que hubiera algo suyo que editar.',
      'La herencia quedó copy-on-write POR ENTRADA: el cliente lee el texto del dueño hasta que escribe el suyo, y `mutar` lee lo efectivo y escribe sólo lo propio. Materializar la entrada al tocarla habría congelado a cada cliente en el texto del día que abrió la pantalla.',
      '`resetTextoPlantilla` BORRA la clave, no escribe `texto: \'\'` — una cadena vacía es un override que gana sobre el texto del dueño, así que «volver al original» dejaba el mensaje en blanco.',
      'La insistencia («cada cuánto») nació con techo en las dos capas que pide AGENTS.md: `sanearInsistir` en un módulo sin `server-only` (para que haya test) y un CHECK en la mig 0180. Sin la segunda, cualquier camino nuevo a la tabla escribe lo que quiera.',
    ],
    commits: [
      { sha: '13b53c71', msg: 'avisos: los flujos son de cada cliente, y la insistencia tiene techo', lineas: 567, archivos: 10 },
      { sha: '3b901b21', msg: 'avisos: el cliente edita qué dice cada uno y si insiste, desde Configuraciones', lineas: 314, archivos: 4 },
    ],
    archivos: [
      'lib/plantillas.ts — el store por workspace con herencia del dueño',
      'lib/flujos-tipos.ts — el paso `insistir`, sus topes y `esAcuse` (sin `server-only`: es lo que permite el test)',
      'supabase/migrations/0180_insistencias.sql — la tabla, con `cada_min >= 30` y `veces between 1 and 5`',
      'app/api/cron/insistencias/route.ts — el drenaje, con compare-and-set para no mandar dos veces',
    ],
  },
  {
    fecha: '28 sep', hora: '18:22', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'El editable tipo chat ya existe: copialo',
    pedido: 'Copia el editable que replica un chat de whatsapp en la tab de notificaciones... Lo tenemos en varios lugares. Para ver y editar los mensajes. Y veo que hay varios que no se pueden editar, todos se deberían poder.',
    puntos: [
      'La señal estaba en el plural: **«lo tenemos en varios lugares»**. Cuando el dueño nombra que algo ya existe en más de un lado, la tarea es encontrarlo y compartirlo, no escribirlo de nuevo.',
      'El primer intento fue un editor nuevo, colapsable por fila. El dueño lo rechazó con una captura: «No hiciste nada… te pedí que se viera como en /mensajes». Lo que hacía falta era parametrizar el `endpoint` de `PlantillasView` —mismo protocolo, otro guard: `getSesionAdmin` allá, admin del workspace acá— y montarla.',
      'De ahí salió también `app/whatsapp/_shared/BurbujaMaKo.tsx`: la burbuja estaba duplicada a mano en dos archivos, cada uno con un ⚠️ pidiendo sincronizar el otro. Dos copias con un comentario que pide sincronizarlas son dos copias que se van a desincronizar.',
    ],
    commits: [
      { sha: 'de0ee6ff', msg: 'avisos: el mensaje se ve como llega, y ahora se edita TODO', lineas: 336, archivos: 4 },
      { sha: 'def22db2', msg: 'notificaciones: la pantalla de /mensajes, no una copia', lineas: 548, archivos: 8 },
    ],
    archivos: [
      'app/agencia/PlantillasView.tsx — la pantalla compartida, ahora con `endpoint` por prop',
      'app/api/perfil/plantillas/route.ts — el mismo protocolo con el guard del cliente',
      'app/whatsapp/_shared/BurbujaMaKo.tsx — la burbuja, una sola vez',
    ],
  },
  {
    fecha: '28 sep', hora: '19:54', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Sólo «Dentro de la app», y muy muy pocos avisos por default',
    pedido: 'Solo debe permanecer "Dentro de la app" el resto todo se debe configurar dentro del nuevo bloque tipo chat. También te pido que filtres los avisos, ya que un usuario podrá crear nuevos. Ahora mismo son muchísimos, mas de lo necesario. Que por defecto cada cuenta traiga muy muy poquitos y que los pueda configurar. Se criterioso, tal vez hayan algunos avisos que no deban desaparecer',
    puntos: [
      '«Se criterioso, tal vez hayan algunos avisos que no deban desaparecer» era la parte difícil: al cambiar un default masivo, los avisos que el pedido NO nombra caen a apagado por omisión. Entre ellos estaban el Pixel caído y el anuncio retenido por Meta — apagarlos de rebote es una regresión en silencio, y quien la descubre es un cliente que se quedó sin enterarse. Se conservaron cuatro, enumerados a mano.',
      'Sacar los 15 toggles de WhatsApp habría RE-PRENDIDO cinco avisos que dos clientes reales habían silenciado (ws1: 1, ws13: 4), porque cada uno tenía dos interruptores y el que dejaba de leerse era justo el que ellos habían apagado. La migración de datos fue primero, en su propio script.',
      'Y había `{"enabled":true}` residuales del clon de configuración que hace `clonar-config` al crear un workspace: un override que nadie pidió pisa el default y lo vuelve mentira. El limpiador borra `{}` y `{enabled:true}`, y **no toca los `enabled:false`**, que sí son decisiones.',
    ],
    commits: [
      { sha: 'b0180aa7', msg: 'notificaciones: un solo interruptor por mensaje, y los 15 toggles se van', lineas: 140, archivos: 4 },
      { sha: 'e22a633e', msg: 'notificaciones: cinco mensajes prendidos, y la tab se queda con lo de la app', lineas: 371, archivos: 6 },
    ],
    archivos: [
      'lib/avisos-catalogo.ts — el campo `porDefecto` (`on` / `off` / `siempre`)',
      'scripts/migrar-apagados-a-plantillas.mjs — los 5 silenciados, migrados ANTES del cambio de código',
      'scripts/limpiar-overrides-redundantes.mjs — los residuales del clon, sin tocar los deliberados',
    ],
  },
  {
    fecha: '28 sep', hora: '23:21', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Los seis que ve un cliente, nombrados a mano',
    pedido: 'Deja a: 1. Reporte semanal (lunes) 2. Agendó, no confirmó y hay que llamarlo 3. Recordatorio de reunión próxima 4. Reunión ocurrió / grabación lista (Fathom) 5. Mensaje de WhatsApp entrante (al dueño) 6. Cuota vencida → cobrar — Elimina este que estaba prendido: Reporte diario matutino — El resto, junto a los que eliminaste dejalos en SuperAdmin, para que yo los vea, pero mejor si los usuarios tienen pocas opciones, así no confunde',
    puntos: [
      'Antes de esto se intentó marcar los 13 «administrativos» para esconderlos. Funcionaba y era frágil: obliga a acordarse de marcar cada aviso nuevo, y el que se olvide aparece en la pantalla de todos los clientes sin que nadie lo haya decidido. La lista blanca falla del lado seguro y se lee de un vistazo, que es lo que permite discutirla con el dueño.',
      'Y costó una corrección aparte: «Pero siguen apareciendo como editables para el usuario, te dije que los sacaras». **«No editable» no era lo pedido** — trece filas en solo-lectura llenan la pantalla de cosas que el cliente no puede tocar. Lo que desaparece es la FILA, no el aviso: los 59 siguen saliendo.',
      'De 65 en el catálogo, el cliente ve 6 y el super-admin sigue viendo los 65.',
    ],
    commits: [
      { sha: '508efea5', msg: 'avisos: los administrativos se leen pero no se editan, y menos texto en pantalla', lineas: 106, archivos: 4 },
      { sha: 'c548fe45', msg: 'avisos: los administrativos salen de la lista del cliente, no sólo del editor', lineas: 22, archivos: 2 },
      { sha: 'bc2395fe', msg: 'avisos: el cliente ve SEIS, elegidos a mano', lineas: 173, archivos: 5 },
    ],
    archivos: ['lib/avisos-catalogo.ts — `AVISOS_DEL_CLIENTE` y `esAvisoDelCliente`'],
  },
  {
    fecha: '28 sep', hora: '23:23', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'cosecha',
    titulo: 'Seis cosas de las notificaciones que no se deducen del código',
    puntos: [
      'Dos campos que apagan lo mismo son un switch que miente — y al unificar, la migración de datos va ANTES del código.',
      'Un override que nadie pidió (del clon de configuración, de una prueba) pisa el default y lo vuelve mentira.',
      'Para decidir qué ve un cliente: lista blanca, nunca marcar lo que se esconde.',
      'Cambiar un default masivo apaga cosas que nadie pidió apagar: lo que ya venía funcionando se enumera aparte.',
      'El editable tipo chat estaba copiado a mano en dos lados, con un comentario pidiendo sincronizarlos.',
      'Antes de construir, buscar dónde está: `/mensajes` ya hacía el 90% de lo pedido.',
    ],
    commits: [{ sha: '1c4b6264', msg: 'docs: la cosecha de las notificaciones editables', lineas: 100, archivos: 1 }],
    archivos: ['docs/hallazgos-comunicacion.md — las seis entradas'],
  },

  // ── 29 sep: los canales, de a uno ─────────────────────────────────────────
  {
    fecha: '29 sep', hora: '00:09', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Los tiles arriba, y el email con cara de email',
    pedido: '1. Prende meta-cuenta-frenada por defecto 2. Que "Dentro de la app" pase a estar arriba del todo. 3. En lugar de: Mensaje nuevo de WhatsApp. Mejor "Nuevo mensaje de WhatsApp". 4. Elimina "Mensaje nuevo del WhatsApp de la empresa" que todo entre en la misma que el anterior. 5. Que "Dentro de la app" sea como los cuadros de WhatsApp y Email, para que no ocupen tanto espacio como lista. También revisa si la app debería tener alguna otra notificación dentro de la app. 6. Elimina el texto "Los mensajes, como llegan", en su lugar que ahí estén los cuadros de WhatsApp y Email. Y que al darle GESTIONAR ahí aparezca el cuadro donde se configura el numero de telefono o el email en su defecto (que no aparezcan ambos, si le doy a WhatsApp ese input, y viceversa) abajo el chat. 7. Cuando le doy a gestionar Email debería permitirme gestionar esos templates. Pero en lugar de la UI de WhatsApp, que aparezca una UI de Gmail, puedes inspirarte en: https://www.figma.com/community/file/992130027176964480/gmail-ui-part-2-reading-composing-emails o en cualquiera que encuentres por la web, tipo diseño.',
    puntos: [
      'El punto 5 tenía una pregunta adentro («revisá si la app debería tener alguna otra notificación»). Medido: el provider dispara pop-up en TRES lugares y son dos avisos —`wa-mensaje` (dos canales de WhatsApp, un solo interruptor) y `wa-plantilla`—, los dos ya en el catálogo. Una tercera entrada sería un interruptor para algo que nunca pasa, que es lo que el propio catálogo prohíbe.',
      'El remitente de la bandeja de email se escribió de memoria: «MaKo <equipo@hola-mako.com>». Es exactamente lo correcto en el ws1 —es su `resend_from`— y **falso para cualquier cliente con su dominio conectado**, porque el De: es el negocio del cliente. Se pregunta a `/api/email/dominio`, y si no se puede leer la línea no se dibuja.',
      'Por email hoy salen sólo los tres REPORTES (`lib/notify.ts` es el único `sendEmail` de los avisos), así que la bandeja lista tres — para un cliente, uno. Listar los seis habría sido ofrecer editar un correo que no existe.',
      'Con el bloque de la app arriba de todo, su barra de «Guardar preferencias» quedaba detrás de 620 px de chat: los chips pasaron a guardar al toque, revirtiendo el chip si el server dice que no.',
      'Y el link de cada reporte apuntaba a `/perfil?tab=notificaciones`, una tab que ya no existe: aterrizaba en un cartel que dice que se configura en Configuraciones. Un link que funciona y no sirve, que ningún test ve.',
    ],
    commits: [{ sha: 'ef070b55', msg: 'notificaciones: los canales se gestionan de a uno, y el email se ve como un correo', lineas: 1495, archivos: 14 }],
    archivos: [
      'app/perfil/NotificacionesPanel.tsx — los tiles de la app arriba, los canales abajo, un canal abierto a la vez',
      'app/perfil/DestinatariosCanal.tsx — el editor de destinatarios de UN canal, en la página',
      'app/perfil/DestinatariosLista.tsx — la pieza compartida que quedó al retirarse el modal',
      'app/perfil/BandejaEmail.tsx — la bandeja de correo, con el remitente leído',
    ],
  },
  {
    fecha: '29 sep', hora: '12:07', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'El mail tiene que verse como un mail, y hay uno solo',
    pedido: '1. Cuando le pongo editar, no deberia cubrir la barra lateral izquierda de "emails", solo la seccion del mensaje... 2. Los templates de email deben estar formateados como si fuera un email producido, como los que te envian de marketing tipo HTML, eso se puede hacer en email. 3. Solo hay 1 template, crea mas. 4. No me gusta que los botones de arriba sean igual que WhatsApp y Email, hazlos diferentes, mas sutiles. 5. No quiero que "Direcciones de email" y "Numeros de WhatsApp" sea una seccion diferente, que este todo en el mismo recuadro.',
    puntos: [
      'El punto 3 NO se resolvía sumando ids a `AVISOS_DEL_CLIENTE`: esa lista es el permiso del SERVIDOR (contesta 403 a `texto` y a `reset`) y además alimenta la vista de WhatsApp, así que dos filas nuevas aparecían también en el chat. La causa real era que por email sólo salían los tres reportes y el cliente ve uno. Lo que lo resuelve es que cada aviso elija su canal.',
      'El punto 2 estaba bloqueado por una frontera: `renderEmailHtml` vivía en `lib/resend.ts`, que lleva `server-only` por la API key, así que la pantalla no podía usarlo y dibujaba el texto plano — con los `*asteriscos*` de WhatsApp que el mail real no tiene. Es una función PURA: se mudó a `lib/email-html.ts` y se re-exporta.',
      'El punto 1 no se arreglaba moviendo el montaje: `TemplateDetalleModal` es una tarjeta de 620px con su propio borde, y las celdas de la bandeja tenían `maxHeight`. El alto se declara en la FILA del grid; el detalle recibe `alto` y `marco`.',
      'El punto 4 tiene un porqué más allá del gusto: un tile de canal ABRE algo y dice a dónde llega, y esto son dos interruptores que no mandan nada a ningún lado. Dos cosas que hacen cosas distintas no pueden verse igual — que es la misma regla que obliga a lo contrario cuando SÍ son lo mismo (el chip de `PrefsDeMensaje` era una copia a mano de `CanalToggle`, y pasó a ser la misma pieza).',
      '⚠️ Dos cosas medidas que son DECISIÓN, no código: `lib/reportes.ts` no importa `lib/plantillas`, así que editar el texto del reporte no cambia el mail; y los tres crons de reporte no iteran inquilinos, así que hoy ningún cliente recibe uno.',
    ],
    commits: [{ sha: 'cde23c01', msg: 'notificaciones: el mail se ve como un mail, y cada aviso elige por dónde llega', lineas: 1527, archivos: 19 }],
    archivos: [
      'lib/email-html.ts — el render del correo, fuera de `server-only` (lo importa la pantalla)',
      'lib/mensaje-canales.ts — el ÚNICO lugar que sabe de qué tienda sale el canal de cada mensaje',
      'lib/avisos.ts — el gate por canal y el envío por email en el choke point',
      'app/perfil/BandejaEmail.tsx — la bandeja, con el correo renderizado en un iframe',
    ],
  },
  {
    fecha: '29 sep', hora: '12:07', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'Cuatro lectores y cuatro escépticos: los cuatro relevos quedaron refutados',
    puntos: [
      'El relevo se corrió ANTES de escribir una línea, con un refutador por lector y el default en `refutado: true`. Los cuatro cayeron, y lo que encontraron cambió el plan en tres lugares — no fue ceremonia: la salida obvia de cada uno era la equivocada.',
      '`AVISOS_DEL_CLIENTE` es un permiso de servidor y no una lista de vista (403 en `texto`); sumar los reportes habría dado dos filas que dicen «apagado» mientras el cron las sigue mandando, porque no declaran `porDefecto`.',
      '`marcasAHtml` tenía que correr DESPUÉS de `escapeHtml`, no antes: al revés, los `<strong>` salen escapados y el lector ve las etiquetas.',
      'El iframe del preview no necesita medirse: con el alto declarado en la celda, el correo scrollea adentro — y así el sandbox puede quedar sin `allow-same-origin`, que era el precio de medirlo.',
      'Y el hallazgo que ningún síntoma iba a dar: `emitirDelCatalogo` leía la plantilla en el contexto AMBIENTE, antes de resolver `opts.ws`. Un cron que itera inquilinos consultaba el interruptor del DUEÑO ahí y el del cliente ocho líneas más abajo.',
    ],
    archivos: ['docs/hallazgos-comunicacion.md — las siete entradas de esta tanda'],
  },
  {
    fecha: '29 sep', hora: '00:09', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Los tests del modal retirado seguían en verde sobre código que nadie puede abrir',
    puntos: [
      '`DestinatariosModal` quedó con CERO call sites al mudarse el editor a la página, y **cuatro assertions seguían leyendo su archivo** — que el link del grupo se pueda copiar, que nada se rechace en silencio, que lo tipeado no se pierda. Las cuatro en verde, mientras el editor VIVO salía sin el botón de copiar: o sea sin la única salida cuando WhatsApp se niega a sumar a alguien por su configuración de privacidad.',
      'Un test que lee un archivo por su ruta no se entera de que ese archivo murió: contesta sobre el texto, no sobre el producto.',
      'Lo que el modal tenía de propio se enumeró antes de borrarlo: el link con su copiar, el aviso de quién no entró, la nota de que sacar a alguien de la lista no lo echa del grupo, y el rechazo del borrador a medio escribir. Sin el último, un número incompleto se manda igual, el saneo del server lo descarta y la pantalla dice «Guardado ✓».',
      'El test que murió con su sujeto (el `portalTo` del menú de ladas, que existía porque el menú quedaba detrás del modal) lo reemplaza uno que cuenta el CALL SITE y otro que pregunta si el modal volvió. Probado rompiéndolo en las dos direcciones: 10 pasan / 1 falla cada vez.',
    ],
    archivos: [
      'tests/destinatarios-telefono.test.ts — los guards, apuntados al editor vivo',
      'AGENTS.md — la regla: al reemplazar una pieza, sus tests se mueven con ella en el mismo commit',
    ],
  },
];
