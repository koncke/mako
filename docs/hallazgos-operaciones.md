# Hallazgos — Centro de Operaciones

El Centro (`/admin/operaciones`, `scripts/operaciones/cartero.mjs`) deja pedidos firmados para los chats
de Claude Code de la PC de Martín. El diseño, con lo que no puede hacer, en
[diseno-centro-de-operaciones.md](diseno-centro-de-operaciones.md). Acá va lo que costó y no se deduce
del código.

---

## La Ticketera del cliente, la barra que «no hace nada», el Uso que salta y la caja con el texto bajo (23/10/2026)

Cuatro pedidos de Martín mirando la vista de un cliente (`/second-brain?chat=40`), medidos en producción con la sesión del ws10.

- **«Si estoy dentro de la ticketera y entro [al Second Brain] no hace nada».** La URL SÍ cambiaba (`?panel=mapa`) y el grafo
  llegaba del servidor; la pantalla seguía en Soporte porque la Ticketera del cliente era un estado suelto (`ticketsCliente`)
  que nadie cerraba, y el panel la dibuja ANTES que el grafo. La del super admin no fallaba por una razón que no estaba escrita:
  vive en la URL (`?ticketera=`, seguida con `useSearchParams`) y su «Second Brain» la cerraba a mano. **Regla:** lo que ocupa
  el panel vive en la URL, y lo que hace cada entrada de la barra está UNA vez, en `lib/ops-center-navegar.ts`
  (`tocarEnLaBarra`): lo tocado se ve siempre, desde cualquier panel. **Y la Ticketera se cierra ANTES del `router.push`**
  (`cerrarTicketera(false)`): reescribir la URL con `replaceState` en medio de una navegación deja a Next en la URL vieja (el
  mismo choque del grafo que no se iba, más abajo). tests/ops-center-navegacion.test.ts recorre los 8 estados del panel.
- **«El chat [de Soporte] se ve horrible, está roto».** No era el hilo: Soporte ya usaba `HiloMako` y `CajaChat`, las piezas
  del Cerebro. Le faltaba el `<div className="co-caja">` alrededor de la caja: el marco, el relleno y el campo de un renglón
  son de esa clase, y sin ella salía sin borde, con el tirador del `<textarea>` y sin el «+». **Regla:** quien monta
  `CajaChat` en un `PanelDeChat` la envuelve en `.co-caja` (como Conversacion.tsx, ChatSecondBrain.tsx y ChatMakoVista.tsx).
  La criatura era la «de Soporte» porque sale del NOMBRE (una verde y redonda); ahora es MaKo con `ASPECTO_MAKO`.
- **«Me sigue saltando el desplegable» (el Uso del super admin, la segunda vez que lo pide).** El desplegable era
  `.co-uso__panel`: absoluto, encima del botón. El del cliente abre el modal «Tus cuentas de IA». Ahora el super admin abre
  ESE modal (`tusCuentas`, con `TusCuentasIA`) y debajo lo suyo: las cuatro cuentas de Claude Code, la API y las computadoras.
  `TusCuentasIA` trae CSS, y Uso.tsx lo renderizan tests en node: llega como prop desde PiezasCentro.tsx. En el teléfono, la
  fila «Uso y Runners» pasó a «Uso» y su hoja a «Tus cuentas de IA».
- **«Pídele un cambio» bajo dentro de la caja (el chat del lienzo de Automations).** El diagnóstico obvio era el CSS de la fila;
  era la MEDIDA: ese chat vive montado en una ranura con `display: none`, `CajaChat` midió el campo ahí (`scrollHeight` 0) y
  escribió `height: 0px`; el `min-height` de 24 px le ganaba a un renglón de 40, y el texto quedaba abajo, cortado y con
  flechas de scroll. Nunca se volvía a medir porque sólo se mide al cambiar el texto. **Regla:** un alto medido en 0 no se
  escribe (`altoDelCampo`, lib/centro-caja.ts) y la caja se vuelve a medir cuando aparece (un `ResizeObserver` en CajaChat).
  Probado en la pantalla de producción sacándole el `0px`: 40 px y centrado.

**Vive en:** `lib/ops-center-navegar.ts` · `app/second-brain/ChatSecondBrain.tsx` · `app/second-brain/pagina.tsx` ·
`app/tickets/soporte/ChatSoporte.tsx` · `PiezasSoporte.tsx` (`ListaTickets`) · `app/admin/operaciones/PanelChat.tsx`
(`acciones`) · `Uso.tsx` · `PiezasCentro.tsx` · `app/m/operaciones/CentroAppMovil.tsx` · `app/_chat/CajaChat.tsx` ·
`lib/centro-caja.ts`

**Sin hacer:** el Uso del super admin no se miró en pantalla (la sesión del Chrome es de un cliente, y una sesión de super
admin local pide firmar el segundo factor a mano): lo mira Martín. Un link `/second-brain?ticketera=tickets` en el TELÉFONO
del cliente no abre su Ticketera (la suya es /m/tickets; lib/movil-rutas.ts no traduce ese query para el cliente).

---

## Las computadoras de los clientes no van en «Tus cuentas de IA»: un pedido del 22/10 que cambió al verlo (23/10/2026)

- **Síntoma:** Martín, en producción: «en mi SuperAdmin me aparece conectada la computadora de Mauricio, eso esta muy mal,
  no tiene nada que ver, estas cruzando workspace».
- **El diagnóstico obvio era el equivocado: no era una fuga.** Lo había pedido él el 22/10 («Lo mismo en SuperAdmin. Y poder
  "Desconectar" dispositivos»), estaba escrito con su cita en `computadorasAction`, y cada máquina iba agrupada y rotulada
  por negocio («Mauricio Bustos (ws1)»). Sólo la veía el super admin con su segundo factor. Lo que estaba mal era DÓNDE: el
  modal se llama «Tus cuentas de IA», todo lo de alrededor habla de lo suyo (sus cuentas de Claude Code, su saldo, su uso),
  y en el medio aparecía la MacBook de un cliente con su correo, su ciudad y un «Desconectar». **Regla:** el título de una
  pantalla es un contrato sobre de QUIÉN es lo que muestra; lo de otro inquilino va donde ese inquilino ya es el tema (su
  ficha), aunque quien mira tenga derecho a verlo. Y cuando Martín cambia de opinión al ver lo que pidió, gana lo nuevo: la
  cita vieja queda en el comentario para que nadie lo revierta creyendo que es un bug.
- **Medido antes de cortar** (el 22/10 también salió de un malentendido):
  - el panel del propio cliente (`TusCuentasIA`, por `/api/ia-pc/estado`) YA muestra las computadoras de su negocio, y el
    modal del super admin lo monta arriba: sus propias computadoras ya estaban ahí, sin duplicar nada;
  - la lectura de TODOS la heredaban tres caminos: el modal de la computadora (Uso.tsx), la hoja del teléfono
    (RunnerMovil.tsx) y la lectura por GET del Centro. Por eso el corte va en la LECTURA y no en la vista: `listarTodasLasPc`
    ya no existe, y lo que queda es `listarPcDelNegocio(ws)`. La ruta exige el negocio (`?ws=`).
- **Adónde fue:** Clientes → la ficha del cliente → Equipo, debajo de su equipo, que es de quien son las computadoras
  (app/admin/ComputadorasDelNegocio.tsx). «Desconectar» se fue con el dato: en la ficha sí sirve para el soporte, y pide
  confirmar diciendo de quién es el chat que deja de usarla.
- **En el teléfono no hay una ficha:** /m/cs no tiene la ficha con Equipo. Se llega con «Versión de computadora» (en Más).
- **Lo que encontró la revisión adversarial (10 agentes sobre el commit, cada hallazgo verificado aparte):**
  - **la misma mezcla por OTRA puerta:** el Ops Center abierto con el `?ws=` de un cliente (un link viejo de
    /tickets/decisiones o /admin/runway, o un marcador) dibujaba el Centro de la plataforma, y su «Tus cuentas de IA» lee el
    negocio de la PESTAÑA (`/api/ia-pc/estado` → `getWorkspaceActual`): salían las computadoras de ese cliente debajo de las
    cuentas de Martín, con «Desconectar» y «Nuevo dispositivo». No era de este cambio (la puerta sólo pedía `puedeOperar`,
    que mira el ws de la SESIÓN), pero es justo lo que él reclamó. Ahora la puerta, mirando a otro negocio, lleva al Ops
    Center de ESE cliente (/second-brain, el criterio de `quienOpera`), en la computadora y en el teléfono. **Regla:** una
    pantalla que dice «tus» se pregunta por el negocio de la pestaña en la PUERTA, no en cada pieza que lee;
  - otro super admin sin la guarda del Centro habría visto en cada ficha el error de la acción: la sección se dibuja sólo con
    `puedeOperar` (`verComputadoras`, app/customer-success/pantalla.tsx);
  - «Crédito de Claude para Mauricio» en el mismo modal NO se movió: es una decisión escrita de Martín
    (app/admin/operaciones/UsoCredito.tsx). Si algún día la objeta como objetó la computadora, va al lado de la sección nueva.

**Vive en:** lib/ia-pc.ts (`listarPcDelNegocio`) · app/admin/operaciones/acciones.ts (`computadorasDelNegocioAction`,
`desconectarComputadoraAction`) · app/api/operaciones/lectura/route.ts · app/admin/ComputadorasDelNegocio.tsx ·
app/admin/AdminView.tsx · tests/ia-pc-varias.test.ts (el 4).

**Sin hacer:**
- que Martín lo mire: «Tus cuentas de IA» sin la computadora de Mauricio, y la de Mauricio en Clientes → su ficha → Equipo;
- la ficha en el teléfono, si algún día la hay.

## La foto que se manda por la caja, vista en otro dispositivo: la «decisión pendiente» ya estaba tomada (23/10/2026)

- **Síntoma:** una foto mandada desde la computadora se veía en el teléfono como un renglón con su nombre (y al revés).
  Desde el quinto Ops Center (17/10) figuraba como «es una decisión de Martín, no un arreglo», en el relevo, en este
  documento y en docs/pendientes.md («depende de Martín»).
- **El diagnóstico obvio era el equivocado:** no faltaba la decisión. Martín la había tomado el 18/10 («cuando envío
  imágenes por aquí o adjunto cosas también deberían aparecer en el Center»), y quedó escrita en la memoria del Centro:
  las fotos del Ops Center SÍ quedan del lado del servidor, en un bucket privado, con URL firmada y sólo para quien puede
  operar. El 20/10 se hizo con eso lo de la app de Claude (`operaciones-turnos/`), y nadie volvió a esta fila. **Regla:**
  antes de dejar algo como «depende de Martín», se busca la decisión en la memoria y en las bitácoras. Una pendiente que
  ya se contestó traba igual que una sin contestar, y encima le cuesta a él una pregunta repetida.
- **Lo que protege el canal a la PC no es borrar:** es que el cartero sólo baja lo que nombra un trabajo firmado y en
  vuelo (`seLeDa`) y que compara el sha256 firmado. Borrar el original al entregar cuida el storage, y se sigue haciendo.
  Lo que queda es la MINIATURA de 640 px que ya armaba el navegador que la mandó, en `operaciones-enviados/<ref>`: el
  `ref` es el del original adentro del texto firmado. Por eso el servidor sabe qué adjuntos son fotos (`fotosDeFirmado`)
  sin adivinar por la extensión, y no se puede guardar una «miniatura» de algo que no es una foto de ese trabajo
  (`problemaDeMiniatura`).
- **La subida va por la RUTA de adjuntos, no por una server action:** las actions se encolan de a una, y subir fotos
  detrás del envío habría hecho esperar al refresco de la conversación. La lectura (`GET ?enviadas=`) también, y junta en
  una ida las burbujas que se abren juntas (`crearPedidorDeFotos`).
- **Una carrera que no se ve en la computadora:** el otro dispositivo refresca y puede traer el trabajo antes de que sus
  miniaturas terminen de subir: suben DESPUÉS de mandar, con el id del trabajo, y de a una. Por eso la burbuja sabe
  cuántas fotos ESPERA (`fotos`, del texto firmado). Lo incompleto (ninguna, o 1 de 2) se cree 10 s, y la burbuja vuelve a
  preguntar una vez a los 12 s. Sólo lo completo se guarda mientras sirve la URL, y un fallo de red no se guarda nunca.
- **IndexedDB guarda la copia del que manda, ANTES de subir** (la revisión lo pidió: si la pestaña se cierra a mitad de la
  subida, ese navegador la sigue teniendo después de un F5). Se barren las de los trabajos que ya no están en la cola
  (`barrerEnviadasViejas`), nunca lo recién mandado. Con la cola vacía no se barre: una lectura que falló no es «no hay
  trabajos».

**Lo que encontró la revisión adversarial, verificado uno por uno (23/10, 9 agentes sobre el commit, no sobre el disco):**
- **El defecto medio no lo vio el revisor sino el crítico de completitud:** la conversación se dibuja por POSICIÓN
  (`key={`l${i}`}` en Hilo.tsx), y la lista se corre sola (turnos que llegan después, la cola de 100 que suelta el más
  viejo). Una burbuja que pasaba a ser de OTRO mensaje mostraba las fotos del anterior hasta que llegaban las suyas: la foto
  equivocada en un mensaje. Va `key={w.id}` en la burbuja. **Regla:** un componente con estado sembrado de un id, adentro
  de una lista dibujada por índice, lleva la clave de ese id.
- **Lo que el revisor marcó medio y no era:** «cancelar no borra la miniatura». La mecánica es cierta, pero en la app no
  hay botón de cancelar (`cancelarPedidoAction` no la importa nadie) y lo cancelado se sigue dibujando con su texto. Si
  algún día hay botón, el arreglo es borrar `fotosDeFirmado(firmado)` en `cancelarPedido`.
- **Una falla del storage parecía «no tiene foto»:** storage-js no RECHAZA la promesa ante un error, devuelve
  `{ data: null, error }`, así que el `.catch` estaba muerto y el GET contestaba `ok: true, fotos: {}`. Ahora tira, la ruta
  contesta 503 y el navegador no lo guarda.
- **El original nunca sube:** si el navegador no puede redibujar la foto, `miniatura()` devuelve null (antes, el original
  con su EXIF, la ubicación incluida). Y es foto lo que el trabajo FIRMÓ como foto (`a.mime`), no el tipo del navegador.
- **La caché duraba una hora:** supabase-js sube con `max-age=3600` por defecto (también en su CDN). Va
  `private, max-age=600`, lo que dura la URL.
- **Un cuerpo sin Content-Length se leía entero** antes del tope (pedidos «chunked»): ahora sin un largo válido no se lee.
- **La retención de 14 días dependía de mandar otra foto:** el barrido corre ahora también al LEER (como mucho una vez por
  hora por instancia), vacía la cola de vencidas de a 100, y el GET no firma lo de más de 14 días aunque no haya pasado.
- **El test de la subida daba verde sin mirar la miniatura:** en node no hay `createImageBitmap`, así que `miniatura()`
  caía al original y el test sólo comparaba la URL. Ahora simula el lienzo y compara el CUERPO que sube; probado con 19
  roturas, cada una con el test que la caza (al pie de tests/centro-fotos-enviadas.test.ts).
- **La segunda vuelta (6 agentes sobre el delta de los arreglos) encontró lo que los arreglos mismos trajeron:**
  - el arreglo de «la copia local antes de subir» decodificaba TODAS las fotos a la vez (`Promise.all`): 20 fotos de 12 MP
    del Samsung son un pico de memoria que el commit anterior, de a una, no tenía. Ahora de a una: decodifica, guarda y
    sube, y recién ahí la siguiente. **Regla:** un arreglo que reordena un bucle se revisa por lo que cambia de orden, no
    sólo por lo que agrega;
  - un solo reintento a los 12 s no alcanza para 15 fotos que suben de a una: la burbuja vuelve a preguntar con espera
    doble (12, 24, 48 s…) mientras el mensaje tenga menos de 3 minutos (`proximoIntento`);
  - la foto local llevaba el nombre del ARCHIVO y la burbuja compara con el FIRMADO (saneado, recortado a 120): con un
    espacio al final se veía la foto Y su renglón. Va `a.nombre`;
  - el barrido de IndexedDB usa la cola de cuando cargó la pestaña: otra pestaña del mismo navegador pudo mandar algo
    después. No se borra una copia de la última hora (`copiaVieja`, por la fecha de sus archivos).
  - El servidor y las regresiones (el teléfono, HiloMako, los tests que leen estos archivos, los globales de los tests)
    salieron limpios.
- **Medido en el fuente instalado (storage-js 2.106.1):** `list` devuelve sólo ese nivel, sin recursión; un objeto que no
  existe en `createSignedUrls` es un error POR ÍTEM (`signedUrl: null`); con `upsert` el `created_at` queda el del primer
  alta. `after()` en un route handler de Next 16 atrapa lo que tire. No se vio en una pantalla: el guard no deja entrar a
  otra sesión.

**Vive en:** lib/operaciones-reglas.ts («Las fotos enviadas») · lib/operaciones-adjuntos.ts (`guardarMiniaturaEnviada`,
`fotosEnviadasDe`, `barrerMiniaturasViejas`, `barrerSiToca`) · app/api/operaciones/adjuntos/route.ts ·
app/admin/operaciones/fotos-enviadas.ts, fotos-remotas.ts, FotosEnviadas.tsx, Hilo.tsx · tests/centro-fotos-enviadas.test.ts.

**Sin hacer:**
- que Martín lo pruebe: una captura desde la computadora y abrir ese chat en el teléfono;
- un PDF o un documento en otro dispositivo sigue siendo su nombre (sólo las fotos tienen miniatura);
- la conversación entera sigue dibujada por posición (`items.push({ k: `l${i}`, l })` en Hilo.tsx): la burbuja de fotos
  ya tiene su clave, lo demás de cada línea no. `claveDeLinea` (lib/centro-estable.ts) ya existe; cambiarla se mide contra
  `Linea` memorizada (`982d7564c`, el refresco que trababa), que es de otro chat del Ops Center;
- el barrido de `operaciones-turnos/` (lo adjuntado en la app de Claude) y de lo subido que nunca se firmó
  (lib/operaciones-adjuntos.ts, cabecera).

## La estrella con una tarjeta abierta: el fondo del modal la tapa (22/10/2026, CR4)

- **Síntoma** (el caso de uso de CR4): en /plan, con una tarea abierta, «cerrala» desde la estrella. La estrella no se podía
  tocar: la tarea es un modal, la estrella (`.ch-tab-mako`) y su panel viven en z 55, y la pila de modales arranca en 130
  (app/_components/pila-modales.ts). Pasa lo mismo con la ficha de un cliente en Clientes y con la del lead en el CRM.
- **Arreglo, opt-in** (`encimaDeModales` en app/_chat/MakoEnLaTab.tsx): con un modal abierto, la estrella va en
  `zEncimaDeModales(profundidad)`, arriba del fondo y de la caja del de arriba. El panel abierto así entra a la pila como
  capa `anidada`: la tarjeta de abajo se sigue viendo, y su Escape pregunta `esElDeArriba()`. Si no, una tecla cierra el
  panel Y la tarjeta (son dos listeners en `document`, y `stopPropagation` no alcanza).
- **El CRM NO lo pasa**: su ficha ya tiene a MaKo adentro, el Analyst a la izquierda. Una estrella encima taparía el «+» de
  esa caja.
- **El `id` de la tarea del Plan es genérico** (`ver_tarea_plan`, `mover_tarea_plan`: `id`, no `tareaId`), así que
  `tarea` y `proyecto` van con `param: null`: meterlo solo lo pondría en cualquier herramienta con un `id` obligatorio. El
  system ya dice «usa ese id». **Un cliente de Clientes ES un lead** (`leadId`): va como `lead`, y las herramientas de
  lead lo toman solas.

## «Espera tu respuesta» mentía: era el «Completado» sin ver, tapado por lo que el chat le escribió a otro (22/10/2026)

Martín: «hay muchos chats que dicen "Espera tu respuesta" y cuando entro, no veo el mensaje de "Completado" o el bloque de
preguntas». Medido ese día en la base: UNA sola sesión tenía preguntas abiertas (3 de `cartero preguntar`). Las demás filas eran
un «Ya está» sin su ✓, que la fila dibujaba con el MISMO texto (`TEXTO_SEGUNDO_RENGLON.revisar`).

- **El diagnóstico obvio era el equivocado:** no eran preguntas contadas de más. Era un «Completado» que existía, pero quedaba
  arriba, tapado por los mensajes técnicos que el chat le escribió DESPUÉS a otro chat (la respuesta a un pedido del Cerebro).
- **Arreglo:** la fila dice «Completado», en verde. Lo que el chat le escribe a otro chat (los turnos entre un mensaje de otro
  chat y el próximo de Martín, menos un «Ya está») va plegado en una línea, «Avance: …» (lib/centro-chats.ts →
  `turnosParaOtro`). Al abrir el chat, el hilo va a ese «Ya está» sin ✓ (`yaEstaSinVer`, Conversacion.tsx).
- **Una regla vieja que no se pisó:** el «Completado» sigue hasta el ✓ aunque el chat haya escrito después (Martín, 18/10,
  tests/centro-ya-visto.test.ts). El pedido «Completado si el último turno arrancó con Ya está» la contradecía; lo que faltaba
  era verlo, no que se apagara.
- **El bloque de decisiones, como lo pidió al usarlo:** la franja blanca era el fondo del panel en el pie de la caja (`.co-caja-wrap`
  sin fondo); ahora tiene el del chat y el bloque es una tarjeta flotante. Se pliega con una flecha, y se recuerda por chat y
  por las preguntas: una nueva lo abre. Los links se tocan, también sin https (lib/links-texto.ts → `conDominiosComoLinks`).
  Sin pantalla de resumen: «‹ Anterior», los puntos y «Siguiente ›», y con la última salen todas.
- **Trampa: un link adentro de un `<button>` no se abre** (HTML no lo deja). La opción del bloque es un `div` con rol de botón,
  y tocar el link no elige la opción.
- **Trampa: «el bloque de decisiones» eran TRES tarjetas.** Las decisiones de la Ticketera (Pregunta.tsx), las de AskUserQuestion
  de la app y las de `cartero preguntar` se veían iguales y estaban en el mismo lugar. Los ajustes de Martín entraron sólo en la
  última: verificado en producción el 22/10, la de «Cuesta dinero» del chat Infra seguía sin flotar, sin flecha y con links que no
  se tocaban. Ahora es UN bloque (PreguntasDelChat.tsx → `BloqueDePreguntas`, con `itemsDelBloque`): una tarjeta, una flecha, un
  plegado y una navegación para las tres fuentes, en la computadora y en el teléfono. Cada una se contesta como siempre: la de la
  Ticketera se guarda al elegirla (Pregunta.tsx → `CuerpoTicketera`), las del chat salen todas cuando están todas, y las de la app
  se contestan en la app. Una clave en el «Otra» de la Ticketera tampoco se guarda (iba a admin_decisiones sin tapar).
- **Y lo de una tab que le pregunta a la persona va por el mismo bloque** (Martín, con captura del /crm de ws1: «Mira lo mal que se
  ve esto»). Las sugerencias del CRM eran una lista suelta arriba del hilo de la estrella, cada una con su «Hacerlo» y su «Ahora no»,
  con un scroll propio que se comía la mitad del panel. Ahora la estrella las recibe como `preguntas` (MakoEnLaTab →
  BloqueDePreguntas, `PreguntaDeLaTab`) y van de a una, arriba de la caja. Arriba del hilo queda sólo lo que no es una pregunta: el
  aviso de que no se pudieron leer y «Calladas (N)».
- **Pero en el bloque quedaron invasivas** (Martín, en producción: «no se entiende que son sugerencias y luego que son muy
  invasivas»). La causa era la regla del plegado, no el diseño: `usePlegado` se abre solo cuando cambia la firma de lo que espera,
  que es lo correcto para la pregunta de un chat. Con las sugerencias adentro, cada sugerencia nueva del CRM abría la tarjeta, y
  decía «1 pregunta esperando». Ahora van aparte (`vistaDelBloque`): plegadas en su tira «Sugerencias de MaKo · N ▾», con el ícono
  `idea`; se abren sólo tocándola, y abiertas dicen «Sugerencia de MaKo». La firma del plegado cuenta sólo las preguntas
  (`soloPreguntas`), y una pregunta nueva de un chat sigue abriendo el bloque y deja las sugerencias en su tira (`llegoUnaPregunta`).
  **Regla:** algo que no se pidió no se abre solo. Sólo lo que espera una respuesta puede abrir el bloque.
- **Las flechas solas y sin la ayuda debajo** (Martín, 22/10: «alcanza con las flechas»; «Fuera "Elige con 1 a 4 · con ésta
  salen todas"»). ‹ y › llevan su rótulo para quien no ve y se apagan en las puntas. El pie sólo se dibuja con un error o un botón.
  **Trampa al romperlo:** devolver la ayuda adentro del pie no hacía fallar nada, porque el pie ya no se dibujaba sin botón. Una
  condición de afuera tapa lo de adentro, así que el test dibuja también el caso con el botón (una pregunta de varias).
  tests/ops-center-bloque-flechas.test.ts.
- **La barra como la lista de Automations** (feedback 4, 22/10). Arriba, en una fila: el «?», la búsqueda con su borde y el
  embudo. Abajo, junto al Uso: Ticketera (con un ícono de ticket nuevo, `ticket`) y Second Brain. «Nuevo chat» es la fila punteada
  de `.chb-nueva`; el teléfono sigue con el círculo verde.
  **El filtro de Automations no se puede montar acá tal cual:** `FiltroLista` está atado a las filas de Automations
  (`FilaFiltrable`, lib/chatbot-lista-filtro.ts). Por eso es el MISMO Dropdown (`secciones` + `varios` + «Quitar filtros») con un lib
  propio, lib/ops-center-filtro.ts. El Área es el jefe del nombre (`partesDelNombre`), y el Estado sólo lo tiene el super admin,
  que sabe qué chat trabaja o espera. **El tutorial ya se podía reabrir** (`useRecorrido().reabrir`), pero ningún botón lo
  llamaba. tests/ops-center-barra.test.ts.
- **Trampa de los tests: no hay DOM** (ni jsdom ni testing-library). `renderToStaticMarkup` dibuja sólo el estado inicial, así que
  lo que se ve tras un toque no se puede dibujar. Lo que decide qué se ve va en una función pura (`vistaDelBloque`) y se prueba en
  todos sus estados; el cuerpo abierto se dibuja suelto (`CuerpoDeLaTab`). tests/ops-center-sugerencias-plegadas.test.ts.
- **Trampa: la cabecera de la estrella decía «Chat nuevo» con una criatura redonda hasta que llegaba la lista,** y recién ahí
  saltaba a «Cerebro» con la estrella. Sin la fila, `nombre` caía en `SIN_TITULO`. Con `entrarAlCerebro` y nada pedido ni elegido,
  ahora es el Cerebro desde el primer cuadro (useChatCliente.ts → `vaAlCerebro`). Pasaba también al entrar al Ops Center del cliente.

## «Tarda y se traba» al entrar al Ops Center: no era el servidor ni los muñecos, era el historial de TODOS los chats (23/10/2026)

**Síntoma (Martín, feedback 5b):** «al entrar al Ops Center en la computadora tarda, y el diseño se traba uno o dos segundos».

**Lo medido en producción** (`/admin/operaciones`, el 23/10, con `long-animation-frame` y `longtask`): el HTML terminaba a los
1,3 s y la página estaba cargada a los 1,4 s. Después, React (el scheduler, `MessagePort.onmessage`) trabajaba **~1,9 s
seguidos**, con tareas de 300 a 620 ms, y volvía cada 2 o 3 s con tareas de 100 a 330 ms: el refresco.

**Los diagnósticos obvios eran los equivocados:**
- No era el servidor: el HTML llegaba antes de los 1,4 s.
- No eran los 66 muñecos animados en SVG: con las animaciones pausadas, los cuadros eran igual de lentos.
- **Trampa de la medición:** en la ventana del grupo de la extensión de Chrome, TODA página pesada va a 1 o 2 fps, también el CRM.
  Una página vacía va a 134. Ahí la cadencia de cuadros no mide nada; el tiempo de JavaScript sí.

**La causa, medida con los datos de producción en Node** (un arnés que lee lo mismo que `datosDelCentroSiOpera`, sólo lectura):
- `lineasDe` (useCentro.ts), el historial de los 57 chats de la lista, costaba **247 ms** en cada refresco.
- De eso, **141 ms** eran `respuestasDelChat` (lib/centro-preguntas.ts). Por cada chat aplanaba los carteros y resolvía la sesión
  de cada tarjeta contra todos ellos, aunque la sesión de una tarjeta no depende del chat.
- Ahora la sesión se guarda una vez por par (decisiones, carteros), con un `WeakMap` por identidad: **5 ms**. Sirve igual a
  `preguntasDelChat`, que se llama por fila.
- Además, abrir un chat con un «Completado» sin ✓ dibujaba TODO su historial (el `verTodo` del 22/10). Ahora dibuja hasta ese
  «Ya está» y unos de antes (`tandaHasta`).
- Los lotes de `leerUltimosTurnos` se leían en serie: 2,2 s en frío. Ahora van en paralelo.

**La entrada:** la criatura de MaKo del teléfono (`EntradaApp`) ahora también está en la computadora (app/second-brain/EntradaOps.tsx).
Nace y flota sobre el Ops Center hasta que la conversación se dibujó, y vuela a la criatura de la cabecera. Va una vez por
documento. `.co` pasó a `position: relative`; ningún absoluto de adentro dependía de que no lo fuera.

**El después, medido igual (tren 17, 23/10/2026 00:50, en caliente, con el MISMO chat abierto, Cobros):** en la entrada, 517 ms
de tareas largas en total, la peor de 176 ms; antes, ~1,9 s seguidos, con tareas de hasta 624 ms. El refresco dejó tareas de 63 a
152 ms; antes llegaban a 330. La criatura entra sola sobre el Ops Center y se va cuando se dibujó la conversación. El HTML sigue
en 1,3–1,5 s.

**Trampas de esa medición:**
- `/admin/operaciones` sin `?centro=` abre el último chat, y el número cambia mucho según cuál sea. Se compara con el mismo chat
  fijo en la URL.
- Una captura de pantalla de la extensión EN PLENA carga infló la entrada a 3,4 s.
- La primera visita después de un deploy es en frío: el HTML a 3,9 s y la página a 13 s.

**Regla:** algo que se calcula por chat no recorre en cada vuelta lo que no depende del chat. Se lo calcula una vez por refresco y
se lo busca. tests/ops-center-carga.test.ts.

**Un chat TRABAJANDO trababa en cada refresco (23/10/2026, después del 5b): era todo lo que llegaba nuevo sin cambiar.** Medido
en producción con el chat «IA del cliente», que estaba trabajando: React trabajaba de 1 a 3,6 s cada pocos segundos. Las causas
están en app/admin/operaciones/useCentro.ts:
- `refrescar` hacía `set` de la cola, los carteros, las decisiones, los pasos, las cuentas y los vistos con arreglos NUEVOS
  aunque valieran lo mismo.
- `setAhora(Date.now())` cambiaba el reloj de `conVigia` al milisegundo, y con eso se rehacían TODOS los chats cada 2,5 s.
- Las preguntas, tareas y marcas del chat abierto llegaban como objetos nuevos en cada `pedirTurnos`.
- `lineasDeConversacion` armaba de nuevo cada turno plegado («Avance: …»), así que el `Hilo` memorizado no acertaba nunca.

**Cómo quedó** (lib/centro-estable.ts):
- `mismoValor` devuelve el de antes si vale lo mismo, en cada `set` del refresco y del chat abierto.
- Los chats se completan con el reloj al minuto (`ahoraLista`), que es lo que usa `viejo` (4 min).
- Los chats y sus líneas mantienen su referencia si valen lo mismo (`estabilizarLista`, `claveDeLinea`), y el plegado se guarda
  en un `WeakMap`.
- `Linea` va con `memo` y su propia comparación (`mismaLinea`): un trabajo en camino se redibuja con el reloj y el Runner, y lo
  demás no. tests/ops-center-refresco-estable.test.ts.

**Trampa de la medición:** en la ventana del grupo de la extensión aparecieron tareas de 10 a 45 s SIN NINGÚN script atribuido en
`long-animation-frame`: es trabajo del navegador, no de la app. Se distingue por eso, y a la app se la mide por lo atribuido al
scheduler de React (`MessagePort.onmessage`).

**SIN HACER:** la lista (`FilaCentro`) se redibuja entera en cada render del `Cuerpo`. Recibe el `Centro` entero y closures
nuevos, y memorizarla así podría dejar acciones viejas pegadas.

**SIN HACER (lo que encontró la investigación del 23/10, por orden de impacto probable):**
- `pedidos` viaja entero al navegador: 721 KB, 450 pedidos. Se hidrata con el resto (`DatosCentro`).
- `listarPedidos` trae `firmado`, y `leerDecisiones` usa `select('*')`.
- `fotoCentroAction` (cada 8 s) y `pushesCentroAction` (hasta 8 s contra Vercel) son server actions, que Next corre de a una.
  Abrir otro chat espera detrás.
- El refresco hace `set` siempre con referencias nuevas: todo `Cuerpo` se vuelve a dibujar aunque nada cambie.
- El cliente:
  - `HiloMako` no está memorizado y re-parsea el Markdown de cada mensaje en cada render.
  - La lista llega en unas 6 respuestas sueltas y salta en cada una.
  - /second-brain no tiene `loading.tsx`.
  - `guardOnboarding` corre dos veces (lib/tab-access.ts).

## Un refresco que falla desarmaba el Ops Center: el `centro` null de una vuelta del servidor (22/10/2026)

El Cerebro, midiéndolo en producción: en cada deploy (cada 30 minutos), durante uno o dos minutos, varios POST a /admin/operaciones
y algunos GET `?_rsc` dieron 503. Con cada uno la Ticketera volvía a «Cargando…» (la primera vez quedó trabada más de 12 s, hasta
recargar) y la lista perdía sus «Completado» y se reordenaba.

- **El diagnóstico obvio era el equivocado:** no era la lectura de la Ticketera, que ya guardaba lo que tenía. Era que TODO se volvía
  a montar: `ChatSecondBrain` decidía el árbol con la prop cruda (`props.centro ? <ConCentro>… : <Cuerpo centro={null}>`), y una
  vuelta del servidor que no pudo leer la sesión (`datosDelCentroSiOpera` → null) cambiaba de árbol. La Ticketera arrancaba de
  cero y la lista salía en el modo del cliente. **Regla:** una pantalla cuyo árbol depende de un dato del servidor se queda con
  el último que vio; lo que se lee después pasa igual por la guarda de cada acción.
- **Trampa: una server action con 503 TIRA** (Next 16: «An unexpected response was received from the server»). `refrescar`
  (useCentro.ts) no la atajaba. Ahora queda lo último que se vio y el intervalo de 8 s reintenta.
- **Trampa: una lectura colgada trababa la Ticketera para siempre.** `lectorDeBandeja` (mazo-reglas.ts) no soltaba `leyendo` si la
  acción no volvía. Ahora tiene tope (15 s). Con tickets a la vista, un tropiezo suelto no se dice: sólo 3 seguidos.
- **Medido en el deploy del tren 7** (dpl_4ssL45J1ND, Ready 20:14:48; el Cerebro, desde el Chrome de Martín): de 20:14:58 a 20:22,
  294 pedidos a /admin/operaciones, /crm y /api/auth/me (RSC), y ninguna respuesta que no fuera 200. La ráfaga de 503 del tren 5 no
  se repitió, así que no quedó `x-vercel-error` para leer. Lo que hay que cuidar es lo de arriba: una vuelta sin sesión que trae
  `centro` null.
- **Trampa: un tiempo medido en el Chrome de esta PC con poca RAM mide la PC, no producción.** Con 1 GB libre, cada pedido desde el
  Chrome tardaba entre 13 y 16 s; el mismo pedido desde curl, 0,3 s. Antes de decir que producción está lenta, se mide con curl.
- **SIN HACER:** si la ráfaga vuelve, capturar `x-vercel-error` en ese deploy (no sale de proxy.ts, cuyo 503 es sólo local). Y la
  página del teléfono (app/m/operaciones/page.tsx) redirige a /inicio si una vuelta del servidor no puede leer la sesión: eso no se
  tocó.
- **Y la criatura de la cabecera contaba con OTRO número que la fila** (Martín, 22/10, 18:45: la fila del «Cerebro» avisaba y la
  criatura de arriba dormía, «No se entiende»). La fila usa `k.avisos(c)` (useCentro.ts: las esperas con el vigía y el
  «Completado» sin ✓). La cabecera recibía `esperaDe(chat, k.esperas)`, sin el «Completado», y lo mismo pasaba con las dos del
  teléfono (ChatsMovil.tsx). El diagnóstico obvio, «hay una pregunta que no se dibuja», también era el equivocado. **Regla:** la
  criatura de la cabecera y la de la fila salen de UN número, `avisos`, en la computadora y en el teléfono. Duerme sólo con la
  fila en gris (la regla del 17/10). **Trampa:** tests/centro-ops7.test.ts fijaba la cabecera del teléfono con `esperaDe`: el test
  protegía el error.
- **SIN HACER:** el teléfono no va solo al «Ya está» al abrir el chat (la computadora sí). El plegado se recuerda en el
  navegador de cada dispositivo.

## Una clave pegada en el Ops Center no se puede tapar después: no sale (22/10/2026)

Martín contestó en el bloque de decisiones la pregunta de Apify del Cerebro con «Otra:» y su token pegado (pedido 253f6e11).
Quedó guardado en tres lugares: `operaciones_pedidos.texto` y `.firmado`, y la respuesta de la pregunta
(`app_settings` → `operaciones.preguntas.<local>`, en `respuesta.otra`). En el turno que sube el cartero no quedó. Se tapó con
`apify_api_…(tapada)`, cambiando sólo la clave y escribiendo con comparar-y-escribir. Fuera de la base no apareció en ningún
texto (el buzón, los transcripts y las notas). Lo que la inutiliza de verdad es generar una nueva.

- **Trampa: lo del Ops Center del super admin sale FIRMADO desde el navegador** (app/admin/operaciones/mandar.ts). El servidor
  no puede taparlo sin romper la firma, como sí hace el chat del negocio (lib/mako-turno-app.ts → `taparClaves`). Por eso
  NO SALE: `mandar` la frena antes de firmar, y `encolarPedido` no guarda un pedido que la traiga (una pestaña de antes).
  La caja y el «Otra» lo dicen apenas aparece, con el botón a /integraciones (app/_chat/AvisoClave.tsx).
- **Trampa: `taparClaves` no conocía las de Apify** (`apify_api_` + 36). Una regla nueva de clave va en PROPIAS_ANTES de
  lib/claves-en-el-chat.ts, con el servicio de /integraciones para su botón.
- Lo que Martín escribe en la app de Claude y sube el cartero se guarda tapado (lib/centro-turnos-db.ts → `guardarTurnos`).
- **SIN HACER:** el cartero sube el turno sin tapar (lo tapa el servidor al guardarlo); el transcript de la sesión en la PC
  conserva lo que se pegó en la app de Claude.

## Un script no le puede escribir a una sesión; un chat sí, menos a sí mismo (15/10/2026)

No hay una vía documentada para que un proceso le mande un mensaje a una sesión de Claude Code. Cada
sesión se anota en `<config dir>/sessions/<pid>.json` con un named pipe (`messagingSocketPath`,
`peerProtocol: 1`) y un `.key` que lo autentica: es el protocolo INTERNO de la versión 2.1.295, y
apoyarse en él rompe con cualquier actualización de la app (que se actualiza sola). Lo que entrega es
un CHAT que llama a `SendMessage` con la dirección `uds:<messagingSocketPath>`: es inequívoca, porque los
nombres se repiten entre cuentas y dentro de una.

⚠️ **Y `SendMessage` no deja que un chat se escriba a sí mismo** («is this session itself»). Medido en la
primera prueba de punta a punta: el pedido iba al mismo chat que hacía de Cartero. Por eso el cartero no
ofrece como destino un chat que se llame «Cartero…» (`esElCartero`), y el pedido de esa prueba quedó «No
se pudo» con su motivo, que es el camino del error funcionando.

**Vive en:** `scripts/operaciones/cartero.mjs` · *chat «Centro de Operaciones», 15/10/2026*

## «Un pedido se entrega una vez» necesita DOS candados

El compare-and-set en la base (`update … where estado = 'escrito'`) evita que dos carteros o un
reintento se lleven el mismo pedido. Pero el que decide el estado es el servidor, y un servidor
comprometido puede volver a poner un pedido viejo en `escrito`: con la firma intacta, se entregaría de
nuevo. El segundo candado vive en la PC: `entregados.json` guarda los ids que salieron, y el cartero
rechaza un id que vuelve («Ya se había entregado: no sale dos veces»). El test corre el cartero real
contra un servidor HTTP falso que miente.

Lo mismo con el texto: **el servidor no arma ni reconstruye el texto firmado**. Lo guarda como llegó y
lo devuelve como está; el cartero verifica la firma sobre ese string y entrega lo que dice. Así no hay
dos implementaciones de una «canonicalización» que tengan que coincidir. Lo que sí está duplicado es
el VALIDADOR del pedido (TS en `lib/operaciones-reglas.ts`, JS en el cartero, que corre sin
dependencias), y lo ata un test diferencial sobre una batería de 17 textos.

**Vive en:** `lib/operaciones.ts` (`cicloCartero`) · `scripts/operaciones/cartero.mjs` (`ciclo`,
`leerFirmable`) · `tests/operaciones.test.ts`

## WebCrypto firma en r||s; Node verifica en DER si no se le dice

`crypto.subtle.sign` con ECDSA P-256 devuelve la firma en el formato IEEE P1363 (`r||s`, 64 bytes).
`crypto.verify` de Node espera DER por defecto, y con una firma P1363 **contesta `false` sin error**: se
lee como «la firma no es válida» sobre una firma perfecta. Va `dsaEncoding: 'ieee-p1363'` en los dos
lados de Node (el servidor, que sólo chequea coherencia, y el cartero, que decide). El test firma con
Node en ese mismo formato para imitar al navegador.

**Vive en:** `lib/operaciones.ts` (`firmaCoincide`) · `scripts/operaciones/cartero.mjs` (`quienFirmo`)

## Cada chat pesa lo mismo en la app que en la terminal

Medido el 15/10 sobre los 17 chats vivos: cada uno es un proceso de Claude Code (`claude.exe`), con
**~520 MB de memoria comprometida** (mediana; de 466 a 778) y entre 86 y 338 MB residentes. Con esos 17
quedaban 4,3 GB libres de 15,7. Una sesión de terminal es el mismo proceso, así que **lo que pesa es la
cantidad de chats, no la cuenta en la que corren**: repartirlos entre tres cuentas reparte la cuota, no
agrega RAM.

## Tres cuentas a la vez: lo que no estaba armado (15/10/2026)

Martín decidió que las tres cuentas corran juntas, la de la app y dos en terminal. Medido ese día:

- **Cada directorio de configuración tiene su propio registro de sesiones.** Un chat de la app no ve
  las sesiones de terminal de otra cuenta, y `SendMessage` NO cruza de un directorio a otro (medido el 16/10: ver
  «SendMessage no cruza carpetas»). La frontera es la carpeta, no la cuenta: hay **un Runner por carpeta**.
- **`~/.claude-martin` (cuenta 2) nunca se logueó por terminal** y sus `settings.json` tienen `hooks: {}`:
  una sesión ahí corre sin bitácora, sin guardia de RAM, sin relevo tras caída y sin avisos de cuota.
- **El marcador de cuenta es UNO** (`~/.claude/cuenta-activa.txt`, ruta fija en `bitacora-sesion.sh`):
  con tres en paralelo, dos firmarían con la cuenta equivocada. Una sesión de terminal sabe su cuenta
  por `CLAUDE_CONFIG_DIR`; la app, por su carpeta ([dos-cuentas.md](dos-cuentas.md)).
- **`get_usage` es una herramienta de la APP**: en la terminal no existe, así que la cuota de las
  cuentas de terminal no se mide como hoy (etapa 2).

## La prueba de punta a punta: lo que pasa al levantarla

- **`next dev` desde un worktree con el `node_modules` enlazado** se levanta desde un worktree DENTRO
  del clon (`.claude/worktrees/<id>`) con `turbopack.root` apuntando al clon, sólo para esa prueba
  (AGENTS.md). Al desarmarlo, `.next/dev/node_modules/` tenía dos enlaces más (`postcss-…`, `sharp-…`)
  que se sacaron con `rmdir` antes del `worktree remove`.
- **El vigía de RAM lo mató a mitad** (3,7 GB privados con 683 MB libres): es la guardia haciendo su
  trabajo. Lo que ya había pasado quedó en la base, y ahí se verificó: el pedido al chat «Estrategia 3
  cuentas» en `entregado`. La pantalla con «Entregado» no llegó a capturarse; se mira en producción.
- **`getByRole('button', { name: 'Copiar' })` de Playwright también encuentra «Copiar clave»**: el
  nombre matchea por substring. Con `exact: true`. Y como el token se muestra una sola vez, el primero
  se perdió y hubo que acuñar otro.
- **La sesión de prueba se firmó a mano** con el `AUTH_SECRET` del `.env.local`, por 30 minutos y sin
  salir de la PC: la de `/api/auth/dev-login` es `sub: 'dev'`, y el Centro la rechaza a propósito.

## La primera pantalla se rechazó por diseñada de memoria; la segunda copia GitHub Actions (15/10/2026)

**Síntoma.** Martín vio `/admin/operaciones` y la rechazó («horrible»). Lo que se veía: un cartel ámbar a
lo ancho de la página, un desplegable muerto («Ningún cartero subió chats todavía»), «Sólo esto» en azul
lleno al lado de «Y de ahora en más» en texto, un «Firmar y mandar» dorado, gigante y apagado, y tres
secciones apiladas del mismo peso con un hueco en el medio.

**Causa.** No era un detalle de estilo: la pantalla se dibujó sin abrir ninguna referencia. De ahí salió
la regla de AGENTS.md «NINGUNA pantalla se diseña de cero: se COPIA de una app que ya resolvió eso».

**Lo que se copió, y de dónde.** La pestaña Actions de github.com/vercel/next.js (la lista, un workflow
y una corrida, abiertas el 15/10 con Chrome sin sesión) y, para el panel de «Run workflow» —que sólo se
ve con sesión—, la guía oficial «Manually running a workflow». El mapa:

| GitHub Actions | Centro |
|---|---|
| «All workflows» + la lista de workflows a la izquierda | «Todos los pedidos» + los chats, agrupados por cuenta |
| Caches / Deployments, abajo de la columna | Carteros (con la clave del dispositivo y el token) |
| Caja «N workflow runs» con filtros Event · Status · Branch · Actor | Caja «N pedidos» con filtros Cuenta · Estado |
| Fila: ícono de estado, título, «workflow #N: …», rama, fecha y duración, «…» | Fila: ícono de estado, texto del pedido, «chat #N: firmado por Martín», alcance, fecha y «llegó en», «…» |
| Franja «This workflow has a workflow_dispatch trigger» + «Run workflow ▾» | Franja del chat («Lo entrega el cartero de la cuenta 3») + «Nuevo pedido ▾» |
| El panel: «Use workflow from Branch», los inputs, «Run workflow» | El panel: «Alcance: Sólo esto», el pedido, «Firmar y mandar» |
| La corrida: volver, título #N, Triggered · Status · Duration, el grafo de jobs | El pedido: volver, título #N, Firmado · Estado · Tardó · Destino, el recorrido Firmado → Tomado → Entregado → Hecho |

Dos decisiones que salen de copiar y no de gusto: «Nuevo pedido» sólo aparece con un chat elegido (en
GitHub, «Run workflow» sólo está en un workflow), y por eso no hay desplegable de chats que pueda quedar
muerto; y lo que falta (un cartero sin señal, un chat cerrado) se dice en la franja de ese chat, no en
un cartel de página.

**La propuesta, viva:** `docs/prototipos/centro-operaciones.html` (también publicada como página para que
Martín la valide). Computadora y celular, con tokens de la casa.

**Vive en:** `app/admin/operaciones/CentroOperaciones.tsx` (lo que se reemplaza) ·
`docs/prototipos/centro-operaciones.html` (lo propuesto)

## La Ticketera no avisaba: `chat` es un NOMBRE, no una sesión (15/10/2026)

**Síntoma.** Martín: «Y ya respondí todas esas tarjetas y al parecer no te llegó... No sirve de nada la
ticketera si no te llega». Medido a las 05:50 contra producción: **30 tarjetas abiertas, 30 contestadas,
29 sin `recogida_at`**, y `operaciones_carteros` **vacía**. El coordinador las repartió a mano a nueve chats.

**Causa.** La respuesta quedaba en la base y nadie la empujaba: el chat que preguntó tenía que correr
`decisiones.ts contestadas` por las dudas. Y aunque algo la empujara, **no había a quién**: la tarjeta
guarda `chat`, un nombre para la pantalla («2FA», «Pricing · Strategy», «Plan») que en varios casos no es
el título de ningún chat, y dos chats pueden llamarse igual («Customer Success» y «Ads Manager» aparecían
dos veces en la lista de sesiones). El diagnóstico obvio («falta un cron que mire») era la mitad: el bug
de fondo era que la tarjeta no sabía quién preguntó.

**Lo que quedó.** Lo empuja el cartero que ya existía, en su misma vuelta (sin máquina nueva):

- `admin_decisiones.destino` (mig 0288) guarda la sesión que pregunta, y la pone quien publica. Sin
  destino, el servidor busca UN chat con ese título entre los de todos los carteros; con cero o con dos,
  no adivina (`destinoDeDecision`, lib/decisiones-aviso.ts).
- Se avisa una vez por RESPUESTA: `aviso_de` es el `respondida_at` avisado. Si Martín la cambia, se avisa
  de nuevo. Lo que no llegó (o no se sabe) se reintenta hasta 5 veces, y un reclamo sin acuse vence a las 2 h.
- El reclamo es compare-and-set sobre la respuesta y el intento anterior, y el acuse viaja con el mismo
  formato de id que el de un pedido. Si el chat está cerrado, la tarjeta espera a la vuelta en que se abra.
- El mensaje lo arma el cartero con un texto fijo y el `ref` validado (`mensajeAviso`): no viaja texto de
  la base, así que no necesita firma. Que el aviso lleve la respuesta adentro necesita firmarla al
  contestar (fase 2).
- `decisiones.ts contestadas <ref>` dice en qué anda el aviso de cada una («avisada», «espera a que se
  abra el chat», «sin cartero corriendo», «Hay 2 chats que se llaman…»).

**Probado contra producción** (05:58-06:07, con el cartero real y las sesiones reales de esta PC; el
servidor fue `cicloCartero` corriendo local, con un token temporal): una tarjeta de prueba dirigida al
coordinador se reclamó, se le entregó por SendMessage, el acuse la dejó `entregado` y la vuelta siguiente
no la repitió; con la respuesta cambiada se volvió a reclamar. La tarjeta, la fila del cartero y el token se
borraron después: antes no existían.

**Dos trampas del arnés que no son del código:** `execFileSync` del cartero desde el mismo proceso que hace
de servidor se traba hasta el timeout (el servidor no puede contestar), y los paquetes de un script del
scratchpad no se resuelven (no hay `node_modules`): va `createRequire` apuntando al repo.

**Vive en:** `lib/decisiones-aviso.ts` · `lib/operaciones.ts` (`avisosParaElCartero`) ·
`scripts/operaciones/cartero.mjs` (`mensajeAviso`) · `scripts/decisiones.ts` ·
`supabase/migrations/0288_decisiones_aviso.sql` · `tests/decisiones-aviso.test.ts`

## «No veo el botón del Centro en mobile»: faltaba la pantalla, no la puerta (15/10/2026)

**Síntoma.** Martín no encontraba el Centro en el teléfono. El primer diagnóstico (del coordinador) fue que
More no podía ofrecer una tab de super admin: `SECCIONES_MAS` → `puedeVerKey` no conoce `ADMIN_FAMILIAS`.

**Causa real.** More YA tenía una sección «Super admin», con la Ticketera, desde el 14/10
(`app/m/mas/page.tsx`); ese diagnóstico miró `SECCIONES_MAS` y no la página. Lo que faltaba era la
PANTALLA del Centro en `/m`: sin ella, un botón llevaba a la cubierta de «se usa en la computadora».
Y lo de super admin **no va en `SECCIONES_MAS` a propósito**: de ahí sale también la barra del rol, y
una tab de plataforma podría subir a la barra de alguien que no es super admin.

**Lo que quedó.** `/m/operaciones` sólo para mirar, copiado de la lista de GitHub Actions en el teléfono
(una fila por pedido con su estado, el detalle en una hoja), con el mismo guard que escritorio
(`puedeOperar`). Su puerta, en «Super admin» al lado de la Ticketera, y la sección entera se apaga
mientras el super admin mira a un cliente (`!ctx.impersonando`), como el Sidebar.

**Vive en:** `app/m/operaciones/` · `app/m/mas/page.tsx` · `lib/movil-rutas.ts` (`rutaMovil`,
`rutaEscritorio`) · `tests/operaciones.test.ts`

## «Pedido» es la palabra de Martín: lo del Centro se llama «trabajo» (15/10/2026)

**Síntoma.** Martín abrió el Centro en el teléfono y escribió «Me dice que todavía no hay pedidos, cuando
tenemos muchos». La cola estaba vacía de verdad (el cartero no está instalado). Él leyó «pedidos» como SUS
pedidos: lo que les pide al coordinador y a los chats.

**Causa.** Un choque de nombres nuestro, no un malentendido suyo, y se iba a poner peor: la sección
Progreso trae una pestaña «Pedidos» que sí son los suyos. Dos cosas distintas con el mismo nombre en la
misma pantalla. El vacío, además, no decía la causa real.

**Lo que quedó.** En escritorio, en el teléfono y en el prototipo, lo que el Centro despacha es un
«trabajo» (como GitHub nombra la corrida, *run*, y no la petición). El vacío dice la causa: sin token,
«falta crear el token del cartero»; con token, «Todavía no mandaste ningún trabajo a los chats». Las claves
de la base y de la API no cambiaron, y un test frena «pedido» en los textos de esas pantallas.

**Vive en:** `app/admin/operaciones/CentroOperaciones.tsx` · `app/m/operaciones/` ·
`lib/api-mako/areas/operaciones.def.ts` (la descripción que lee MaKo) · `tests/operaciones.test.ts`

## Progreso: «78 pendientes» que eran 7, y lo que la pantalla no puede ver (15/10/2026)

Martín, desde el teléfono: «Sigo sin ver los pendientes y poder refrescar en el centro». El Centro pasó a
tener cuatro pestañas (En curso · Pedidos · Pushes · Trabajos) en la computadora y en el teléfono, y las
tres de Progreso **no dependen del cartero ni de su token**: salen de lo que ya existe.

**De dónde sale cada una, y qué NO puede ver.**
- **En curso y Pedidos** salen de las bitácoras de `/admin/dev` (`app/admin/dev/<área>/bitacora.ts`), que
  viajan dentro del build. Dicen lo DESPLEGADO: lo que un chat tiene escrito en la PC sin subir, y los
  chats abiertos ahora, no están. Eso lo va a traer el cartero cuando esté instalado; la pantalla lo dice.
- **Un pedido aparece recién cuando un chat lo anota** en su bitácora. Lo que Martín pidió y nadie anotó
  no existe para la pantalla.
- **Pushes** sale de la API de Vercel (`/v6/deployments`, `VERCEL_API_TOKEN`, que ya estaba en
  producción): el commit, el estado, cuánto tardó y la cuenta del trailer `Claude-Cuenta`.
- **No hay lista de commits por push**: el token de GitHub de la plataforma (la credencial `GITHUB_TOKEN`
  del ws 9, usuario `mbustos-digital`) contesta **404** en `hola-mako/dashboard-marketing` y también en
  `mbustos-digital/dashboard-marketing` desde la transferencia del repo. Medido el 15/10. Y debajo del 404
  había un segundo problema, que lo tapaba: el repo seguía cableado al owner viejo en tres lugares (lo
  arregló otro chat en dcad6ddd2). El cierre de tareas del Plan por commits (`lib/cerrar-por-commits.ts`)
  está mudo hasta que el token tenga acceso a `hola-mako/dashboard-marketing`.

**La trampa: el diagnóstico obvio de «pendiente» estaba mal.** La primera regla era la natural, «la
respuesta de un pedido es lo que le sigue en la bitácora hasta el pedido siguiente», y la pestaña decía
**78 pendientes**. Medido sobre las bitácoras reales: de 80 pedidos «pendientes» en 14 días, **72 tenían
trabajo hecho más abajo en su misma área** y **77 venían seguidos de otro pedido**. Los chats anotan en
TANDA: los cuatro pedidos de un mensaje de Martín, uno detrás del otro, y después lo que hicieron. Con la
regla natural, sólo el último de la tanda recibía la respuesta. Y la segunda mitad del mismo error: una
implementación anotada sin `commits` no cerraba nada, y la mayoría no los anota.

La regla que quedó (`cadenas` en `lib/progreso-reglas.ts`): los pedidos seguidos son una tanda y comparten
la respuesta que viene después; una implementación o una corrección cierran aunque no traigan commit. Con
eso, **7 pendientes, 11 en curso, 268 hechos**. El detalle de cada pedido dice «Anotado junto con N
pedidos más: lo que sigue responde a todos», porque a cuál de la tanda responde cada paso la bitácora no
lo dice. Lo fija `tests/progreso.test.ts`, probado rompiéndolo (sin juntar la tanda: 6 pasan, 1 falla;
sin la implementación como cierre: 6 y 1).

**Lo que todavía puede mentir:** un pedido cuyo trabajo se anotó en OTRA área queda pendiente (el de las
«estrellas de GitHub», anotado en API de MaKo, figura pendiente con las Estrellas en producción desde el
14/10). Se juntan áreas sólo cuando el MISMO texto se anotó en las dos a la misma hora.

**Refrescar:** en el teléfono, tirar hacia abajo (la pantalla está dentro de `PantallaM`); en la
computadora, «Actualizar» en el encabezado, con la hora del dato, sin perder la pestaña (`router.refresh`).

**La unidad es el PEDIDO (15/10, segunda vuelta).** Martín: «Lo que quiero ver allí es lo que te pedí, los
pushes de lo terminado, los pendientes que estamos trabajando ahora mismo, las cosas que ya están
terminadas, empezadas, etc...». Tres listas sueltas (En curso · Pedidos · Pushes) lo obligaban a cruzarlas a
mano. Ahora Pedidos es la pestaña de entrada, en cuatro grupos (Trabajando ahora = empezado y movido en 48 h ·
Sin empezar · Empezado, sin movimiento · Terminado), y cada fila muestra su CAMINO (anotado → lo tomó un chat
→ en producción) sin abrir nada. «En curso» por área quedó como pestaña «Áreas».

**«Terminado» es «en producción», y eso sí es exacto:** la pantalla lee la bitácora de la versión
PUBLICADA, así que todo lo que ve ya está subido. Lo que NO es exacto es **en qué push** llegó cada uno, y
los dos diagnósticos obvios están mal, medidos contra git:
- **Por la hora** («el primer push después de que se anotó»): sobre 202 pedidos con commit, **acertó 110 y
  erró 92**. El commit sale en el push de otro chat, o espera al del coordinador.
- **Por la punta exacta del ÚLTIMO commit** (el que lo termina): **0 de 88** en tres días. Una primera versión
  aceptaba CUALQUIER commit del pedido y unía 7, pero nombraba el push de un commit de 21 horas antes para un
  pedido terminado hace 3: lo daba por subido un día antes. El último commit anotado casi nunca encabeza un
  push (va con la cosecha, o adentro de un merge).

Lo único exacto sin git es el commit que ENCABEZA un push: en el detalle de un pedido, ese commit dice «subió
hace X», y en la pestaña Pushes ese push dice qué pedido trae (`pushDelCommit` y `pedidosDeLosPushes` en
lib/progreso-reglas.ts). La fila dice «En producción» y no nombra un push. Unir cada pedido con su push
necesita preguntarle a GitHub si el commit es ancestro del deploy (`compare`), y eso espera al token.

**«Trabajando ahora» es lo ANOTADO.** Sin el cartero corriendo, lo que un chat hace en este minuto y todavía
no escribió (commits sin subir, una rama viva) no se ve; la pantalla lo dice, igual que dice que un pedido
que nadie anotó no está en «Sin empezar».

**Vive en:** `lib/progreso-reglas.ts` (las reglas, puras) · `lib/progreso.ts` (las lecturas) ·
`app/admin/operaciones/{CentroPestanas,Progreso}.tsx` · `app/m/operaciones/ProgresoMovil.tsx` ·
`tests/progreso.test.ts`

## El cartero instalado: lo que falta para que entregue solo, y una tarjeta que no le llega a nadie (15/10/2026)

Martín acuñó el token y el cartero de claude1 quedó instalado en la PC (`instalar`, `token`, `cartero
claude1 app ~/.claude`, `carpeta 68eda2ab… claude1`). La primera vuelta, a mano, contra producción: vio 53
chats de la cuenta, 2 abiertos, y no tenía nada que entregar.

- **Instalado no es entregando.** Las vueltas las corre un chat «Cartero» con su cron, y ese chat no existe:
  lo abre Martín (un chat no puede crear otra sesión). Sin él, la hora del cartero envejece y el Centro lo
  muestra inactivo. Y sin ninguna clave de firma cargada en la PC (`clave <SPKI>`), un trabajo firmado se
  rechaza; los avisos de la Ticketera no la necesitan.
- **Con el chat cerrado, el aviso espera; no se pierde ni hace loop.** El servidor reclama un aviso sólo si
  el cartero reportó ESE chat abierto en la misma vuelta (`if (!mio?.vivo) continue` en lib/operaciones.ts),
  así que no gasta intentos. Si se cierra entre la consulta y la entrega, vuelve como «no entregado» y se
  reintenta, hasta `AVISO_MAX_INTENTOS`. Leído en el código y confirmado con una vuelta real; una entrega
  real todavía no se probó (no había ninguna respuesta con su chat abierto).
- **El diagnóstico obvio era el equivocado, y casi se persigue un error que no existía.** «Martín contestó
  plan-50-tareas-cargar y no llegó» parecía la Ticketera sin guardar: `respuesta` era null y la última
  respuesta guardada de cualquier tarjeta era de las 05:37. La tarjeta simplemente no estaba contestada (lo
  confirmó el coordinador). Antes de culpar al guardado, se mira si hay respuesta y desde cuándo.
- **Pero esa tarjeta, contestada, no le llegaría a nadie:** se publicó con el chat «Plan» y sin `destino`, y
  ningún chat se llama «Plan» (son «Plan - Perro Guardián»). `destinoDeDecision` no adivina por parecido.
  Toda tarjeta se publica con el `destino` de la sesión que pregunta; sin él, el nombre tiene que ser el
  título EXACTO del chat.

## El Centro como app de chats: lo que dicen los datos antes de rediseñar (15/10/2026)

Martín pidió copiar Grok entero: una lista de chats, con el punto verde por «en curso», el historial adentro
de cada chat, sin la pestaña Trabajos y quizás sin Pedidos. Medido sobre los pedidos de 14 días y los chats
del cartero, antes de dibujar nada:

- **Un pedido casi siempre vive en un chat:** de 289, a 274 los trabajó un solo chat, a 7 dos y a 1 tres.
  Pero **26 se pidieron en un chat (el coordinador) y los trabajó otro**, y **7 no los tomó nadie**: ésos
  no tienen chat donde vivir. Una vista por estado que cruce los chats sigue haciendo falta, o los
  pendientes desaparecen.
- **Juntar chats por NOMBRE pierde y mezcla:** de los 37 chats que anotaron en sus bitácoras en 14 días,
  sólo 17 coinciden por título con los 53 que subió el cartero de claude1 (los demás son de otras cuentas o
  se renombraron), y el cartero tiene 5 títulos repetidos («CRM», «General», «Ads Manager»…). La llave es
  la sesión, no el título — la misma lección que el `destino` de la Ticketera.
- **El punto verde sólo es verdad con el cartero corriendo:** el estado ocupado o libre de cada chat lo sube
  el cartero en cada vuelta; sin el chat Cartero es una foto vieja, y se dibuja como tal.
- **Grok sin sesión no muestra nada que copiar** (sólo la caja de escribir): la lista, el historial y el
  estado se ven con la cuenta de Martín, que inicia sesión él.
- **Un chat SÍ sabe su sesión, y el supuesto contrario casi dejaba a la lista sin llave.** La Ticketera
  sacaba el `destino` del `from-session` de un mensaje, como si un chat no pudiera saber su propio id. Lo
  sabe: `CLAUDE_CODE_HOST_SESSION_ID` (el `local_…` de la app, el mismo que sube el cartero) y
  `CLAUDE_CODE_SESSION_ID` en una terminal (`cli_…`). Desde el 16/10 cada hito de trabajo de una bitácora
  lleva su `sesion` (lo exige tests/progreso.test.ts y lo dice AGENTS.md); lo anterior queda «por nombre»,
  aparte y marcado, sin pegarse a ningún chat del cartero.
- **El modelo está en `lib/centro-chats.ts`** (la lista con su punto y su edad, los pedidos de cada chat,
  los que se pidieron en uno y trabajó otro, los trabajos firmados por sesión de destino, y la
  conversación de cada chat). «Avance» es la vista por estado de lib/progreso-reglas.ts, sin cambios.

## El rediseño de punta a punta: la caja para escribirle a un chat, y lo que faltaba para que llegue (16/10/2026)

**Síntoma.** Martín abrió la pestaña Chats en producción (15/10, 19:01) y la rechazó entera: «Toda la vista de chat
está horrible la verdad... Eliminando las tabs innecesarias, los textos innecesarios, títulos, subtitulos, avisos,
etc... No solamente eso, NO es funcional, no puedo mandar un prompt por allí a mis otras cuentas.»

**Causa.** Dos, y la segunda no era de estética. La pantalla mostraba conversaciones y no dejaba escribir: mandar
vivía en un formulario aparte («Cartero y trabajos»), con un desplegable de chats. Y aunque se escribiera, **nada
llegaba**: medido en la PC ese mismo día,

| Lo que hace falta para que un trabajo llegue | Cómo estaba (15/10, 23:00) |
|---|---|
| Una clave de firma aceptada en la PC (`claves.txt`) | **no existía**: todo trabajo firmado salía «No se pudo» en la primera vuelta |
| El cartero de cada cuenta | sólo el de la cuenta 1; se declararon la 2 y la 3 (`cartero claudeN app ~/.claude` + `carpeta`) |
| Alguien que corra las vueltas | **nadie**: ningún chat «Cartero»; la última vuelta, a las 17:29 UTC |
| La cuenta del chat, corriendo | la app estaba en la 3 (12 de 13 chats abiertos); la 1 (53 chats) y la 2 (27) no corrían en ningún lado |
| Una cuenta de terminal logueada | sólo `~/.claude-cuenta3` (15/10 03:20); `~/.claude-martin` nunca, y `~/.claude` tiene credenciales de julio |

La cola de producción tenía **0 trabajos**: nadie había podido mandar uno.

**Lo que quedó.** La pantalla es una app de chat, copiada de las que resuelven lo mismo (varias sesiones de un
agente, cada una con su estado). Las capturas se bajaron y se miraron el 15/10 (en el scratchpad de esa sesión):

| De dónde | Qué se copió |
|---|---|
| Claude Code web (sesiones con punto de estado) y Claude web | la barra: accesos con ícono arriba, filas de una línea con el punto a la izquierda, lo de la cuenta abajo de todo |
| Codex (escritorio y teléfono) | las sesiones agrupadas con «Mostrar más» y la edad a la derecha; acá el grupo es la CUENTA |
| WhatsApp (iOS, iPad, web), Linear Inbox, Slack | la fila de dos renglones con lo último que pasó, la hora y el tick ADENTRO de la burbuja, las píldoras de día, la conversación a pantalla completa en el teléfono con la caja fija abajo |
| Claude / ChatGPT / Perplexity | la caja redondeada con el texto arriba y una barrita abajo (la opción a la izquierda, enviar a la derecha) |
| Grok | Avance y Pushes como accesos de la barra que abren su vista con el nombre como único título |

- **La caja va abajo de cada conversación** (`Conversacion.tsx`): Enter manda, Shift+Enter baja de renglón. Firma por
  `mandar.ts`, el mismo camino en la computadora y en el teléfono, y lo que espera lo dice en una línea («Sale cuando
  abras este chat en la cuenta 1»). Una caja que mandaría algo que la PC va a rechazar NO manda: ofrece crear o copiar
  la clave (`comoSale`, lib/centro-chats.ts).
- **La barra agrupa por cuenta** (`seccionesDeChats`): con tres cuentas hay tres «CRM», y el título no los separa. Lo
  anotado sin sesión (antes del 16/10) va en su propia sección, plegada, al final: no recibe trabajos y repetía el
  título de su sesión al lado de ella.
- **Los ticks son los de WhatsApp**: ✓ escrito, ✓✓ entregado, ✓✓ azul hecho, ✕ no salió (con el motivo debajo). El
  cierre que deja el chat aparece como su respuesta.
- **La poda**: se fueron el título, el subtítulo, la frase de dónde sale el estado, las pestañas, la hora de «Al día»
  y el botón Actualizar (se refresca solo cada 8 s con la pestaña a la vista). «Áreas» se fue entera: lo que decía es
  la lista de chats. La vista `pedidos` pasó a llamarse `avance` (un `?tab=pedidos` viejo abre los chats).
- **Cargar**: la página ya no espera a Vercel (hasta 8 s de timeout; los pushes llegan después por `pushesCentroAction`)
  y tiene su esqueleto (`loading.tsx`, en la lista blanca de tests/layout-sin-suspense.test.ts).

**Lo que costó y no se deduce del código:**

- ⚠️ **Un test de refresco que no saca al chat no prueba el refresco.** El de `completarChats` refrescaba con el cartero
  VIENDO todavía al chat, así que borrar el reseteo del estado daba 9 en verde: el estado se pisaba igual. La rotura
  que lo prueba es la de un chat que el cartero dejó de ver.
- ⚠️ **El guard de «trabajo» lee cada cadena entre comillas**, también los ids: `vista === 'pedidos'` lo ponía rojo.
  Por eso la vista se llama `avance`, que además es su nombre en pantalla.
- **«Sin nada anotado» en 40 filas no distingue a ninguna** (AGENTS.md → una fila de una lista dice lo que la
  distingue): una fila sin nada que contar es de un renglón.
- **Dribbble y Behance bloquean `curl` y WebFetch** (202 con `x-amzn-waf-action: challenge` y cuerpo vacío; 403). Lo que
  anduvo: las páginas archivadas en el Wayback Machine (CDX con `filter=statuscode:200`, sufijo `id_`), sacar de ahí los
  `/shots/` y bajar la imagen de `cdn.dribbble.com/userupload/…` con `?resize=2000x1500`, que no está bloqueado.
- **Mirar la pantalla sin servidor cuando no hay RAM**: con 1,5 GB libres no entra un `next dev`. Las capturas salieron
  de los componentes REALES empaquetados con el esbuild que trae tsx, con las acciones del server, `next/navigation` y
  la clave reemplazadas por datos ficticios, las hojas de la casa concatenadas (sin las directivas de Tailwind) y
  Chrome `--headless=new --mute-audio --screenshot`. No reemplaza mirarla en producción: no pasa por el guard ni por la
  base.

**Vive en:** `app/admin/operaciones/{CentroApp,Conversacion,Hilo,PanelCartero}.tsx` · `mandar.ts` · `centro.css` ·
`lib/centro-chats.ts` (`completarChats`, `comoSale`, `vistaPrevia`, `seccionesDeChats`) · `app/m/operaciones/` ·
`tests/centro-chats.test.ts` · `tests/operaciones.test.ts`

## Grok Bot: cada chat es un empleado con su muñeco, y el que espera algo lo muestra (16/10/2026)

**El pedido.** Martín, la misma noche, al coordinador: «Quiero que copie a Grok, que tiene un mejor diseño, y sobre
todo me gusta el concepto de los muñequitos de IA o "empleados"». La referencia resultó ser **Grok Bot** (xAI,
lanzado el 11/08/2026): «AI teammates with names, jobs, and context that compounds over time», con habilidades,
rutinas y aprobaciones (docs.x.ai/grok-bot/overview).

**Cómo se miró, porque la doc oficial no trae una sola captura.** La nota de lanzamiento (x.ai/news/introducing-grok-bot)
tiene su video en `media.x.ai`; bajado con un user-agent de navegador y `Referer: https://x.ai/` (sin eso contesta un
HTML de 5 KB), 106 s, y mirado en hojas de contacto de 3×3 (`ffmpeg fps=1/4,tile=3x3`) y cuadros a resolución completa
recortados. Ahí está la pantalla real: la lista de Bots, cada uno con un muñeco de forma simple y color propio (gota,
hexágono, triángulo, cuadrado redondeado, con dos trazos blancos de ojos), su nombre, lo último que dijo y la hora; el
«Para:» con la lista de Bots, y la conversación con el muñeco y el nombre del Bot sobre cada mensaje.

⚠️ **El repo que circuló como referencia (`github.com/grok-bot-app/grok-bot`) NO es de xAI**: dice «Official product by
xAI» en el encabezado y «unofficial community guide» en la licencia, tiene 0 estrellas, etiquetas de relleno para
búsquedas e instaladores sin firmar en Releases. No se bajó ni se corrió nada de ahí (lo midió el coordinador).

**Lo que quedó (`Muneco.tsx`):**
- **Muñecos PROPIOS**: formas de la casa en la paleta categórica (`--grafo-*`, pasteles), ojos oscuros redondos con
  brillo y una sonrisa (los de xAI son colores fuertes con dos trazos blancos y sin boca). SVG sin dependencias ni ids.
- **El aspecto sale del título normalizado**, no de la sesión: el CRM es el mismo empleado en las tres cuentas. Las
  áreas principales tienen su aspecto FIJO (`EQUIPO`): con el hash, dos de ellas salían iguales; lo demás va por hash.
  `--grafo-funnel` quedó afuera: al lado de `--grafo-panorama` son dos verdes que no se distinguen a 38 px.
- **Los ojos dicen el estado**: despierto (abierto), parpadeando (trabaja), cansado (foto vieja), dormido (cerrado).
  Con movimiento reducido, quieto.
- **El que espera algo lo muestra** (el «vuelve a pedir aprobación» de Grok Bot): las tarjetas de la Ticketera sin
  contestar van a su empleado con `esperasPorChat`, por la sesión (`destino`) o por un título exacto y único —la MISMA
  regla con la que el cartero avisa la respuesta, `destinoDeDecision`—; con dos chats del mismo nombre no adivina. El
  muñeco lleva el globito y la conversación, arriba de la caja, «Una tarjeta espera tu respuesta · Contestar».

**Lo que confirmaron las otras referencias** (una corrida de 3 agentes, 28 capturas bajadas y miradas: los Companions de
Grok en iOS, Sintra, Marblism, Heynet, Wamino, Emotes, Notion AI, Duolingo y Copilot): el estado va en la CARA del
muñeco y no en un cartel; «te espera» es una insignia naranja con número; lo quieto, el muñeco apagado; la conversación
vacía muestra al personaje grande y, después, uno chico al lado de cada respuesta. Grok marca la presencia con un punto
verde sobre el avatar y el humor con un globito de pensamiento.

**Si algún día se cambian los muñecos por una biblioteca**: los estilos de DiceBear `critters`, `moods`, `gaze`,
`notionists`, `lorelei`, `open-peeps` y `thumbs` son CC0 (uso comercial, se pueden modificar, no piden crédito); `micah`,
`adventurer`, `personas`, `fun-emoji` y `big-smile` son CC BY 4.0 (piden crédito). Se fija el cuerpo por área y sólo
varían ojos y boca: con semilla al azar salen caras tristes o con barbijo. Hoy no hace falta: los nuestros no tienen
dependencia ni licencia que cuidar.

**Vive en:** `app/admin/operaciones/Muneco.tsx` · `lib/centro-chats.ts` (`esperasPorChat`) · `acciones.ts`
(`fotoCentroAction` trae las tarjetas) · `tests/centro-empleados.test.ts`

## El cartero pasa a llamarse Runner, y cada texto dice qué hacer (15/10/2026)

**El pedido.** Martín, mirando el Centro en producción: «Jamás pongas mensajes no claros como "Este dispositivo todavía
no firma.", es mucho mejor "Crea tu Token para comenzar a chatear"», y «No quiero que se llame más "cartero", sino un
nombre más formal, tecnico... profesional... mejora el diseño de ese modal».

**Runner, copiado de GitHub Actions.** Un self-hosted runner es un proceso en TU máquina que consulta una cola en la
nube, hace el trabajo ahí y reporta cómo salió: es lo que hace el cartero. No choca con «Puente» (Google Flow) ni con
«Pasarela» (pagos). El modal copia GitHub → Settings → Actions → Runners, mirado en el Chrome de Martín ese día
(hola-mako/dashboard-marketing no tiene runners, así que se miró la lista vacía y el alta «Add new self-hosted runner»):
la caja con un renglón por runner (punto, nombre, etiquetas, estado) y el botón primario arriba a la derecha; el alta
como pasos con un bloque de código para copiar. Acá los pasos son tres: crear el chat (sus instrucciones, que antes
vivían sólo en este documento, ahora están en `lib/runner.ts` y se copian con un botón), su token, y tu Token.

**Dos tokens, dos nombres.** «Tu Token» (palabra de Martín) es la clave de firma de ESTE dispositivo; el «token del
Runner» (`mkop_…`) es el que conecta al Runner con MaKo. Antes eran «clave» y «token de los carteros» y en pantalla
se leían como la misma cosa. El chat Runner acepta los dos pegados (`clave` y `token`).

**Las claves no se renombraron**: `cartero.mjs`, `operaciones_carteros`, `/api/operaciones/cartero`,
`ver_carteros_operaciones` siguen igual (la regla de «trabajo»/«pedido»). La PC reconoce al chat por su título:
`esElCartero` acepta «Runner» y «Cartero», también como sub-chat («Centro de Operaciones › Runner», mirando el último
tramo), así el renombre de Martín y la convención del chat jefe no lo vuelven un destino. Instalado como 1.3.0.

**Lo que costó medir:**
- **El guard de los textos no veía el texto JSX que sigue en el renglón de abajo.** La primera versión tomaba
  `>texto<` en un mismo renglón; `<Icon … />Runners` sigue con su `<span>` abajo, y devolverle «Cartero» a ese botón a
  propósito dio 0 fallos. Ahora toma el texto después del `>` de una ETIQUETA (no de un `=>`) hasta el próximo `<` o
  `{`, y descarta lo que parece código.
- **Una interpolación no es texto**: `${carteros.length}` adentro de un template daba un falso «cartero». Se borran las
  `${…}` antes de mirar.
- **El motivo de un trabajo que no salió lo escribe la PC, no MaKo** (`rechazar`, `acuse` en cartero.mjs, y «Venció…»
  en lib/operaciones.ts). Reescribirlo como acción («El chat se cerró: ábrelo y vuelve a mandarlo») exige reinstalar el
  script; las filas viejas conservan el texto de antes.

**Vive en:** `lib/runner.ts` · `app/admin/operaciones/PanelRunner.tsx` · `lib/centro-chats.ts` (`textoDeEnvio`) ·
`scripts/operaciones/cartero.mjs` (`esElCartero`, los motivos) · `app/m/operaciones/CentroMovil.tsx` (`RunnerMovil`) ·
`tests/centro-textos.test.ts`

## El avance pasa a cada chat, como los milestones de Linear, y la cuenta es un chip (15/10/2026)

**El pedido.** «Elimina lo de "Avances y pushes", quiero que cada chat tenga arriba, en su topbar un botón para ver los
avances, que despliegue la sidebar derecha, que sea algo similar a lo que tenemos en "offer"», con un roadmap «simple,
épico y entendible», el estado como el color del punto («gris = no empezado») y «Pedido hace» y los pushes en el detalle.
Y «No quiero que exista "cuenta 1, cuenta 2, 3" en la sidebar de chats... eso debe estar dentro de cada chat, con un chip».

**Copiado de** la barra derecha de Offer (`app/offer/PiezasRail.tsx`: la tarjeta que estira con flex, el título con su
conteo fijo y la lista que scrollea; en el teléfono, la barra «8/13» que se abre) y del panel «Project Milestones» de
Linear, mirado en su documentación (linear.app/docs/project-milestones, un video del panel de detalles del proyecto): el
rombo que cambia según el estado, el que está en curso en amarillo, el nombre y la fecha. Linear no se pudo abrir sin
cuenta: la referencia es su doc, y se dice.

**Qué es un nodo** (`avanceDelChat`, lib/centro-chats.ts): una línea del historial del chat. Un pedido de la bitácora que
trabajó ese chat (con SUS pasos y SUS commits), uno que se le pidió ahí y trabajó otro (con los de todos y quién lo
trabajó), o un trabajo firmado que se le mandó desde el Centro (su título es su primer renglón; el color sale de los
ticks: entregado = en curso, sin salir = rojo). La cuenta de cada paso viaja ahora en `PasoP.cuenta`.

**Lo que costó ver:**
- **En el teléfono la conversación abre en lo último**, así que una barra arriba del hilo quedaba fuera de la vista. Va
  `position: sticky` contra `.m-sheet__cuerpo`, que es lo que scrollea.
- **«Subió hace X» sólo se sabe cuando el commit ENCABEZA un push** (`pushDelCommit`: por la hora acertaba 110 de 202).
  Lo que la bitácora de la versión publicada nombra ya está en producción por construcción, así que el resto dice «En
  producción», que es exacto. Y mientras Vercel no contestó, `pushes` es null, no `[]`: con la lista vacía el avance
  diría «En producción» igual, pero nunca afirma un «subió» sin leerla.
- **Sin los grupos por cuenta, dos «CRM» quedan iguales en la lista.** Hasta que la punta siguiente los una por nombre,
  la fila lleva el chip de la cuenta SÓLO en los títulos repetidos (`titulosRepetidos`).
- **«Pedido hace» se escribe «Lo pediste hace»**: el guard de las pantallas del Centro no deja la palabra «pedido» en lo
  que se dibuja (tests/operaciones.test.ts), y «lo pediste» dice lo mismo.

**Lo que quedó:** el avance mira 14 días (el «Ver todos» de la vista vieja se fue con ella); `novedades`
(lib/progreso-reglas.ts) quedó sin quien lo llame, sólo con su test: era la lista de Pushes. La barra no tiene el
porcentaje de Linear («23% of 63»): un nodo es una cosa pedida, no un milestone con issues adentro.

**Vive en:** `app/admin/operaciones/Avance.tsx` · `lib/centro-chats.ts` (`avanceDelChat`, `seccionesDeChats`,
`titulosRepetidos`) · `app/admin/operaciones/Conversacion.tsx` (el botón y la cabecera) · `app/m/operaciones/ChatsMovil.tsx` ·
`tests/centro-avance.test.ts`

## Un chat es su nombre, el jefe agrupa a sus sub-chats, y cada empleado tiene su muñeco elegido (15/10/2026)

**El pedido.** «todos los chats de todas las cuentas se llamen igual. Y que yo tenga los 3 puntos en cada chat para poder
configurar cosas, como cambiarle el nombre»; «quiero que cada chat esté englobado en su chat "jefe" que siempre se debe
llamar como la tab en la que estamos trabajando, como CRM... ESO no lo quiero decidir yo, lo decide el chat jefe»; y
«Crea más diseños variados de las figuras tipo trabajadores... Y que si le doy click pueda elegir cambiar a otro».

**La regla de antes se dio vuelta, a propósito.** Hasta esa noche «un chat es una sesión, nunca un título» (con 5 títulos
repetidos en el cartero, juntar por nombre pegaba el trabajo de uno a otro). Martín decidió lo contrario: el mismo
trabajo se llama igual en las tres cuentas y el Centro lo une (`unirPorNombre`). Lo que se conservó es el camino al
nombre: un hito con su sesión toma el título que esa sesión tiene HOY, así un chat renombrado no se parte. El riesgo
viejo (dos chats distintos con el mismo nombre en una cuenta) ahora se resuelve renombrando uno, no adivinando.

**Copiado de:** los hilos de Discord en la barra de canales para el jefe y sus sub-chats (el hilo debajo de su canal,
corrido, con la línea que dobla); el «⋯» al pasar por la fila, de las barras de ChatGPT y Claude; y el selector de
muñeco, del armador de Notion Faces (faces.notion.com, mirado ese día: las piezas a la izquierda, la grilla de tres con el
elegido en azul y el dado, el retrato grande a la derecha).

**Lo que costó ver:**
- **En el teléfono no hay dos hojas** (SheetM: «Una hoja sobre otra REEMPLAZA»). Abrir «Opciones» en una hoja nueva
  cerraba la de la conversación, y como la nueva dependía del chat abierto, se cerraba también: el «⋯» no hacía nada.
  Opciones, Renombrar y el muñeco van ADENTRO de la hoja de la conversación, con su «‹» para volver.
- **Renombrar no tiene una puerta nueva**: a cada sesión del chat le llega un trabajo firmado que le pide
  `set_session_title` sobre sí misma (`textoDeRenombre`). La cerrada lo recibe al abrirse. El Runner podría renombrar
  sesiones cerradas (tiene la herramienta), pero eso pide un tipo de trabajo nuevo en la cola firmada: no se hizo.
- **El muñeco se guarda por nombre**, así que renombrar lo perdía: al renombrar, lo elegido se copia al nombre nuevo.
  Y guardar uno es leer-cambiar-escribir el mapa entero: se lee ESTRICTO (con la lectura tolerante, una caída de la base
  lo escribiría vacío).
- **Los ojos no se eligen**: dicen el estado del chat. La «cara» que se elige es la boca y las mejillas.
- **El test del equipo cazó la variedad nueva**: con la cara y el accesorio por hash del título entero, «Chatbot» y
  «Automations» (la misma área renombrada) dejaban de ser el mismo empleado. El jefe lleva cara y accesorio fijos; un
  sub-chat los saca de su nombre, para distinguirse.

**Lo que quedó:** el jefe no puede CREAR un sub-chat visible (start_session no está habilitado en esas sesiones): lo crea
Martín con un clic y lo nombra «Jefe › Sub», o el jefe renombra uno existente. Los grupos del jefe no se pliegan.

**Vive en:** `lib/centro-chats.ts` (`unirPorNombre`, `porJefe`, `partesDelNombre`, `nombreValido`, `textoDeRenombre`) ·
`lib/centro-munecos.ts` · `lib/centro-munecos-db.ts` · `app/admin/operaciones/ElegirMuneco.tsx` · `Muneco.tsx` ·
`CentroApp.tsx` (el «⋯» y los modales) · `app/m/operaciones/ChatsMovil.tsx` · `tests/centro-munecos.test.ts`

## SendMessage no cruza carpetas: un Runner por CARPETA, y el buzón es de la PC (16/10/2026)

**El pedido.** Martín: «habiamos dicho de no usar más a Claude desde la app de desktop, sino desde powershell o algo así
que ahí si permite tener 3 cuentas abiertas al mismo tiempo». Cada cuenta corre en su terminal con su
`CLAUDE_CONFIG_DIR` (el perfil de PowerShell: `claude1` → `~/.claude`, `claude2` → `~/.claude-martin`, `claude3` →
`~/.claude-cuenta3`), y el Runner tiene que entregarles a las tres.

**Medido.** Desde la app (`~/.claude`), `SendMessage` al canal de la sesión de terminal de la cuenta 2 contesta
«ENOINBOX: no-key — refusing to send to an unvouched pipe». La sesión deja su `.key` en `<carpeta>/sessions/` y el que
manda la busca en SU carpeta; `ListAgents` también lista sólo las de la propia. Copiar la `.key` a otra carpeta lo
haría andar, y es justo lo que NO se hace: es la protección contra un canal que nadie avaló.

**El diagnóstico obvio era el equivocado: la frontera no es la cuenta, es la CARPETA.** El 15/10 se armó «un cartero por
cuenta». Pero la app guarda las sesiones de CUALQUIER cuenta en `~/.claude`, que es también la carpeta de `claude1`: un
Runner en la app (o en la terminal de la cuenta 1) le llega a la app entera y a la terminal de la 1, y a la terminal
de la 2 o la 3, nunca. Y al revés: LEER sí cruza (son archivos), así que cualquier Runner ve las tres cuentas enteras
y sólo cambia a quién le puede entregar. De ahí el diseño (cartero 1.4.0):

- **Cada chat vivo sube `runner`**: si hay una sesión viva llamada Runner (o Cartero) en su carpeta. El registro trae el
  `name` de las dos clases de sesión (la de la app y la de `claude2 -n Runner`, medido en `claude --help` ese día).
- **MaKo reclama sólo `entregables`** (vivos con un Runner en su carpeta, siempre un subconjunto de lo que ese
  cartero subió vivo: `sanearEntregables`). Lo demás queda «escrito» hasta que se abra ese Runner, en vez de vencerse
  en el buzón. Un cartero de antes, sin la lista, reclama todos sus vivos, como siempre.
- **El buzón es de la PC, no del Runner**: lo reclamado va con la carpeta del chat, y cada Runner entrega sólo lo de la
  suya. Dos Runners en la MISMA carpeta (la app y `claude1` comparten `~/.claude`) no mandan lo mismo: el primero que
  lo lista crea `<id>.mano` con `wx` (atómico) y se lo queda; si el dueño se cerró sin acusarlo, lo toma otro.
- **El vencimiento (30 min) vale para lo de cualquier carpeta**: si sólo cada Runner venciera lo suyo, lo de un Runner
  cerrado no lo vencería nadie y quedaría «tomado» para siempre.
- **La carpeta propia sale de `CLAUDE_PID`**: Claude Code se lo pasa a los comandos que corre, y la sesión está en
  `<carpeta>/sessions/<pid>.json`. Si no, `CLAUDE_CONFIG_DIR` (lo pone `claude2`). `ciclo` sin `--cuenta` da la vuelta
  por las cuentas que tienen una fuente en su carpeta: el de `~/.claude` por las tres (la app), el de
  `~/.claude-martin` sólo por la 2.
- **La pantalla lo dice**: una sesión de terminal abierta sin Runner en su carpeta no dice «sale ya» aunque la cuenta
  tenga otro Runner dando vueltas: «Abre el Runner en la terminal de la cuenta 2 para que salga» (`comoSale`).

**Lo que costó ver:**
- **Los tests heredan el `CLAUDE_PID` de la sesión que los corre**: el cartero del test creía estar en `~/.claude` (ahí
  está la sesión real) y no entregaba nada. Los tests le dicen su carpeta con `CARTERO_CONFIG_DIR`.
- **En la terminal no hay `set_session_title`** (es de la app) y `/rename` existe pero lo escribe la persona, no el
  modelo. El renombre desde el Centro le pide al chat de terminal que deje en el cierre «Escribe /rename … en la terminal
  de este chat» (`textoDeRenombre`). Un chat de terminal nace con nombre si se abre con `claude2 -n "CRM"`.
- **Entre el cartero nuevo y el servidor viejo** (antes del deploy): el servidor ignora `entregables` y reclama todos los
  vivos; un trabajo para una terminal sin Runner espera 30 min en el buzón y sale «Se cerró el Runner de esa terminal:
  ábrelo y vuelve a mandarlo». Con el deploy, no se reclama.

**Lo que encontró la revisión adversarial** (dos revisores y un refutador por hallazgo; los 13 se confirmaron, todos
arreglados con su test en `tests/cartero-carpetas.test.ts`):
- **Un cierre se podía PERDER, y era el diagnóstico obvio el equivocado**: «se sube y se borra» valía con un cartero
  por cuenta. Con el buzón compartido, el Runner de la cuenta 1 subía los cierres de la PC sin el acuse que estaba en
  el buzón de la 2; MaKo aplica un cierre sólo sobre un pedido ENTREGADO, no lo tomaba, y la PC lo borraba igual. Ahora
  cada vuelta sube los acuses de TODAS las cuentas, MaKo devuelve `cierresIds`, y un cierre se borra sólo si entró (o
  después de un día).
- **El vencimiento por cuenta dejaba cosas «entregando» para siempre**: cada Runner da la vuelta por las cuentas de su
  carpeta, así que lo de la cuenta 1 sólo lo vencía el Runner de `~/.claude`. Recorre todos los buzones.
- **Un Runner que se cerró con algo en la mano no se reemplaza mandándolo otra vez**: no se sabe si alcanzó a mandarlo.
  Sale «El Runner se cerró a mitad de la entrega: míralo en el chat» (`tomar`).
- **Cualquier chat que corriera `ciclo` o `pendientes` se quedaba con el buzón**: probar el script desde un chat lo
  marcaba como suyo y nunca lo mandaba. Si la sesión que lo corre está registrada y no se llama Runner, no corre
  (`exigirRunner`; medido desde este chat: «no es el Runner»).
- **Con el nombre no alcanza**: un chat «Runner» al que nadie le pegó las instrucciones no da vueltas. Cuenta si además
  dejó su latido en los últimos 6 minutos (`latidos/`, lo escribe cada vuelta).
- **`entregados.json` perdía ids** con dos Runners acusando a la vez (leer-cambiar-escribir): ahora es un archivo por
  id (`entregados/`), y el json viejo se sigue leyendo. Y entre listar y marcar, el gemelo vuelve a mirar si el acuse
  ya lo sacó del buzón.
- **La pantalla elegía la sesión sin Runner** cuando el mismo chat estaba abierto en dos cuentas (`pesoSesion`), el
  panel ofrecía `claude2 -n Runner` para un chat de la app, y `scripts/decisiones.ts` decía «se avisa en la próxima
  vuelta» de un chat al que nadie llega (`explicarAviso`).

**Lo que quedó:** las carpetas de terminal no tienen los hooks de `~/.claude` (bitácora, guardia de RAM, avisos de
cuota): ver «Tres cuentas a la vez».

**Vive en:** `scripts/operaciones/cartero.mjs` (`dirPropio`, `carpetasConRunner`, `verChats`, `pendientes`, `tomar`,
`exigirRunner`, `latir`, `vuelta`) · `lib/operaciones-reglas.ts` (`runner`, `sanearEntregables`) · `lib/operaciones.ts` (`cicloCartero`) ·
`lib/centro-chats.ts` (`comoSale`, `textoDeRenombre`) · `lib/runner.ts` (`COMANDO_TERMINAL`, las instrucciones) ·
`tests/cartero-carpetas.test.ts` (la PC entera, contra un servidor falso)

## La pregunta de cada chat como la de Claude Code, y la Ticketera adentro del Centro (16/10/2026)

**El pedido.** Martín: «prefiero ahí donde está "Una tarjeta espera tu respuesta en la Ticketera" que salga lo mismo que
hoy sale en claude, las opciones», «La ticketera con los desplegables queda para el botón de "ticketera" de arriba», y
mirándolo en producción: «Me dice "Espera tu respuesta" y aún no me salta lo que te pedí tipo claude» y «No veo el botón
de la ticketera dentro del Centro».

**De dónde se copió la pregunta.** La app de escritorio no trae el dibujo de AskUserQuestion en su paquete (el
`app.asar` sólo tiene la notificación: la pantalla se carga de claude.ai), así que se leyó del CLI 2.1.299 de esta PC,
que sí lo trae: las opciones numeradas con su título y su descripción, «(Recommended)», «Type something.» como último
renglón, «Enter to select · Tab/Arrow keys to navigate · Esc to cancel», y «Review your answers / Submit answers» al
final. Se copió todo menos el repaso del final: acá cada respuesta se guarda al elegirla (como la Ticketera), así no
hay un envío que se pueda perder. La descripción de una opción es nueva (`detalle`, hasta 140 letras); las opciones de
antes que la traen en el texto («Sí — porque…») se parten en la raya.

**De qué chat es una tarjeta se decide UNA vez** (`lib/centro-preguntas.ts`): su `destino` manda; sin él, el nombre, y
sólo si un único chat se llama así. El globito del muñeco, la pregunta de arriba de la caja y la respuesta en la
conversación salen de esa misma función: un test fija que el globito y la pregunta cuentan lo mismo.

**El diagnóstico obvio era el equivocado: «elimina la ruta» no era «saca el ítem de la barra».** El 15/10 Martín reclamó
que la Ticketera NO estaba en la barra de admin («Eso esta mal»). Se dejó el ítem (y la fila de More) como atajo a la
Ticketera adentro del Centro (`?ticketera=`): una sola Ticketera, con dos puertas.

**Lo que costó ver** (de la revisión adversarial: dos revisores y un refutador por hallazgo, 7 de 7 confirmados; el
commit 81d842745 dice 5 porque se escribió antes de la segunda tanda):
- **La pregunta abierta se seguía por su POSICIÓN**: el refresco de cada 8 s mete adelante una tarjeta que frena, y lo que
  Martín escribía para una se guardaba en la otra (medido por el refutador). Ahora por su id (`preguntaAbierta`), y si
  la abierta se contesta en otro lado mientras escribe, se dice. Y un rechazo de la acción (sin red, un deploy nuevo) ya
  no la deja en «…».
- **Next no vuelve a montar una página cuando sólo cambia la query, y la prop tampoco sigue a la URL.** El ítem
  «Ticketera» de la barra, estando en el Centro, cambiaba la URL y no la pantalla. Seguir a la prop no alcanzaba: un
  `replaceState` con el estado de Next (lo que hacía `anotarEnUrl`) no le avisa al router, que se queda con la URL
  vieja. Ahora `anotarEnUrl` pasa `null` (el router copia su estado y se entera) y la vista sigue a `useSearchParams`.
  Lo mismo hacía «Ver la lista» del mazo vacío (un link a la misma página): adentro del Centro cambia la vista ahí.
- **Una página de /m a la que nadie llega es un test rojo** (`tests/movil-mismas-rutas.test.ts`: cada página de /m
  tiene que volver a sí misma). El proxy manda todo /m/* a su URL de escritorio, y ésa ahora cae en el Centro: las
  páginas viejas del teléfono no se dejan como redirect, se borran (la URL vieja igual llega, por el mapa de rutas).
- **`/admin/runway` perdía la query** (era la única puerta que no la pasaba por `aLaTicketera`), el botón que cierra la
  Ticketera dejaba `?ticketera=` en la URL, y las acciones revalidaban dos rutas que ya no dibujan nada.

**Vive en:** `lib/centro-preguntas.ts` · `app/admin/operaciones/Pregunta.tsx` · `TicketeraCentro.tsx` · `CentroApp.tsx` ·
`app/m/operaciones/TicketeraMovil.tsx` · `app/tickets/decisiones/reglas.ts` (`aLaTicketera`) · `lib/movil-rutas.ts` ·
`tests/centro-preguntas.test.ts`

## El Uso de las tres cuentas sale de la barra de estado de cada Runner (16/10/2026)

**El pedido.** Martín: «El "Uso" debe ser visible siempre, me imagino como un desplegable donde hoy está "Cartero". Y que
"Cartero" (que ya no debería llamarse así), sea también el mismo desplegable... Que ahí se vean ambas cosas», y en
producción: «Falta el poder visualizar el USO».

**De dónde sale (medido en el CLI 2.1.299 de esta PC).** En la terminal no hay `get_usage` (es de la app) ni nada guardado
en la carpeta de config (`~/.claude-martin` no tiene ningún caché de cuota). Lo que sí hay: la barra de estado de Claude
Code recibe por stdin `rate_limits.five_hour` y `rate_limits.seven_day`, cada una con `used_percentage` y `resets_at`
**en segundos unix**, y admite `refreshInterval`. El Runner se abre con esa barra (`--settings` apuntando a
`runner-settings.json`, que escribe `cartero.mjs instalar`): así se mide sin tocar la configuración de Martín, sólo en
esa sesión. `cartero.mjs uso` anota la cuota de la cuenta de su carpeta; cada vuelta la sube; MaKo la guarda en
`operaciones_carteros.cuota` (de la mig 0285, sin usar hasta hoy). De la cuenta que está en la app, la semanal sale de
`~/.claude/uso-semanal.txt` (lo que mide `get_usage`, con la cuenta en el 4º campo), si es más nueva.

**Lo que no se ve y se cuida:** pasado el reinicio de una ventana, su porcentaje ya no vale (se dice «Se reinició»); una
medición de más de 30 minutos lleva su edad; el botón muestra la semana MÁS usada (la que se termina primero); y una vuelta
sin medición no borra la que había.

**Lo que encontró la revisión adversarial** (un revisor y un refutador por hallazgo, 5 de 5 confirmados, con su test):
- **El diagnóstico obvio era el equivocado: «medido» no es cuándo corrió la barra.** La barra corre cada minuto aunque no
  llegue ninguna respuesta de la API (el CLI guarda la observación real, pero no la pasa por stdin): re-sellar el mismo
  número escondía un Runner que dejó de dar vueltas. Ahora la edad es la de la última OBSERVACIÓN: otros números, o que
  la sesión haya hablado con la API (`cost.total_api_duration_ms`).
- **«Runner activo» no puede salir de `visto_at`**: el Runner de ~/.claude recorre las tres cuentas y les refresca la
  fecha. Activo es que su terminal MIDA (una 5 horas medida hace poco); si no, «Sin el Runner de su terminal».
- **La semanal de la app puede ser de otra cuenta** (el 4º campo lo pone un marcador que se atrasa): si su reinicio no es
  el que vio la terminal de esa cuenta, no se usa. Y al ganar ella, la 5 horas vieja de la terminal no viaja con su fecha.
- **El botón prefiere lo medido hace poco**, y si sólo hay números viejos, los muestra con su edad.

**No verificado:** que la barra de estado reciba la cuota en una sesión de terminal real de cada cuenta (se probó el
comando con la entrada medida en el CLI, no con un Runner abierto). Lo dice el Centro: hasta que el Runner de una cuenta
se abra con su comando, esa cuenta sale «Se mide cuando su Runner está abierto con su comando».

**Vive en:** `lib/centro-uso.ts` · `app/admin/operaciones/Uso.tsx` · `scripts/operaciones/cartero.mjs` (`uso`,
`cuotaDeBarraDeEstado`, `cuotaDe`) · `lib/runner.ts` (`COMANDO_TERMINAL`) · `tests/centro-uso.test.ts`

## Sin accesorios, en qué trabaja cada chat, y un «Nuevo chat» que el Centro no puede abrir solo (16/10/2026)

**El pedido.** «Elimina los accesorios de los personajes», «Cuando un chat dice "Trabajando..." debo saber en qué está
trabajando» y «Falta la opción de "Nuevo chat" tipo placeholder arriba de todos los chats».

- **Sacar una pieza del muñeco no puede romper lo guardado**: los elegidos viven en app_settings con su `accesorio`, y
  `sanearAspecto` exigía las cuatro piezas. Ahora lee tres e ignora la cuarta: lo elegido se sigue viendo, sin ella.
- **«En qué trabaja» es lo último EN CURSO** (un pedido empezado, o un trabajo que le llegó y no cerró), no lo último que
  pasó: un trabajo escrito que todavía no le llegó no es en lo que está. En un flex, el texto largo no lleva «…»: la fila
  lo dibuja como bloque.
- **Medido: el Centro no puede abrir un chat de Claude Code.** Una página web no abre una terminal, start_session no está
  habilitada en esas sesiones, y la pestaña de terminal de la app (que sí carga el perfil de PowerShell: `Get-Command
  claude2` da la función) sólo la abre una sesión de la app, con Martín aprobando cada comando y sin dejar escribir nada
  fuera de ASCII. Así que «Nuevo chat» arma el comando exacto (`claude2 -n 'CRM › Funnels'`, la comilla doblada para
  PowerShell) y Martín lo pega. Lo que queda: que el Runner de esa terminal lo abra solo pide un tipo de trabajo firmado
  nuevo («abrir un chat»), y eso toca el formato de lo firmado: no se hizo sin el OK de Martín.

**Vive en:** `app/admin/operaciones/NuevoChat.tsx` · `lib/runner.ts` (`comandoNuevoChat`) · `lib/centro-chats.ts`
(`enQueTrabaja`) · `lib/centro-munecos.ts` · `tests/centro-fila.test.ts`

## «Review» y el dictado: lo que entra por el cierre y lo que se firma (16/10/2026)

**Los pedidos.** El 6: «"Review"... que graficamente me diga que tengo que ir a revisar de las cosas que ha implementado,
si puede dejarme el link». El 7: «Agrega la funcionalidad de dictar con audio, como ya lo hacemos en otros lados... Y la
de adjuntar archivos o imagenes al chat».

- **Lo que se revisa lo deja el chat, no se adivina.** El cierre suma `--revisar "/crm?lead=12"` (cartero 1.6.0) y el hito
  de la bitácora, `revisar`. Sólo una ruta interna: el Runner la rechaza al escribirla y el servidor la vuelve a sanear
  (`rutaParaRevisar`). Es la MISMA regla que `esHrefInterno` de la Ticketera, pero escrita aparte: ese módulo importa
  `operaciones-reglas`, e importarla al revés era circular. Un test fija que las dos digan lo mismo.
- **«Avance» se llama «Plan», con dos sub-tabs** (copiadas del control segmentado de Linear): «Plan» (el Plan del jefe y
  lo pedido) y «Review» (lo terminado con página, con «Revisar»). Mientras el visor no exista, «Revisar» abre la página
  misma: un link al visor daba 404. El interruptor es `VISOR_REVISAR` (lib/centro-chats.ts) y un test falla si no dice lo
  mismo que el archivo del visor: lo enciende el chat del visor en su commit.
- **El dictado es el de la casa** (`app/_components/useDictar.ts`, el del alta del Plan y del chat de MaKo del
  teléfono): el texto se PEGA en la caja y se firma al mandar, como lo escrito. El audio no viaja a la PC.
- **Los adjuntos NO están, a propósito.** El trabajo firmado lleva sólo texto; un archivo tiene que subirse a MaKo y que
  el Runner lo BAJE a la PC, que es una puerta nueva hacia la PC de Martín. El diseño mínimo: subirlo a un bucket privado,
  poner en el texto FIRMADO su ruta y su sha256, y que el Runner lo baje con su token y lo descarte si la huella no
  coincide. Se construye con el OK de Martín.

**Vive en:** `lib/operaciones-reglas.ts` (`rutaParaRevisar`, `sanearCierres`) · `scripts/operaciones/cartero.mjs` (`cierre`)
· `lib/centro-chats.ts` (`porRevisar`, `enlaceRevisar`) · `app/admin/operaciones/Microfono.tsx` ·
`tests/centro-revisar.test.ts`

## «Copiar comando» con el nombre vacío: un objeto nunca es falso (16/10/2026)

`nombreValido` devuelve `{ ok, … }`, y en tres lugares se lo usaba como booleano: `!nombreValido(…)` en
`CentroApp.tsx` y `ChatsMovil.tsx` daba siempre `false`, y `valido ?` en `NuevoChat.tsx` siempre verdadero. Con el
nombre vacío se armaba `claude1 -n ''`. **El typecheck no lo ve**: un objeto en una condición es TypeScript válido.
Lo encontró el relevamiento de la etapa 2, no un test. Se mira `.ok`, y `tests/centro-fila.test.ts` lo fija.

## El Plan adentro de cada jefe: las operaciones de la API, aplicadas en el acto, por una RUTA (16/10/2026)

**El pedido.** «Los chats y el Centro deberían poder conectarse con el PLAN... Crear tareas nuevas, marcar como
completadas, etc». La convención ya estaba: los proyectos del tablero del super admin se llaman como una tab, y los
jefes también. Cada jefe ES un proyecto.

- **El proyecto se llama «Feature: CRM», no «CRM».** El tablero guarda el nombre canónico con su prefijo. La primera
  versión comparaba el nombre entero y la lista salía SIEMPRE vacía con datos reales; el test pasaba porque su fixture
  decía «CRM». Lo encontró la revisión. Se compara con `nucleo()` (lib/plan-proyectos-catalogo.ts), y el fixture usa
  los nombres como los guarda el tablero. Un jefe que no es un proyecto del catálogo («Automations») lo dice en pantalla.
- **Sin puerta nueva de escritura.** Se lee con `listar_tareas_plan` + `ver_proyecto_plan` (hasta 100 abiertas del
  proyecto, sin el tope de las 300 de más puntaje de toda la lista) y se escribe con `proponer_tareas_plan` y
  `proponer_cierre_tareas` aplicadas EN EL ACTO (`aplicarEnElActo`, lib/api-mako/flujo.ts), el camino de las
  automatizaciones. Quien confirma es Martín con su clic.
- **Es una RUTA (`/api/centro/plan`), no una server action.** Al aplicar corre el Perro (30 a 60 s), y el navegador
  manda las server actions DE A UNA: como acción, mandarle algo a otro chat quedaba esperando a que el Perro terminara.
- **Nada queda a medias.** Antes de proponer se mira si ya hay una abierta con ese título («Ya está en el Plan»): sumarla
  otra vez la fusionaba con ésa o dejaba el borrador colgado en /plan/revisar. Si el borrador no se aplica, se descarta.
  `aplicarEnElActo` ahora devuelve `datos` con el borrador y cuántas nacieron: con 0, el aviso dice «Ya estaba: le
  sumé esto» en vez de «Sumada».
- **Un mensaje NO se vuelve tarea solo.** La propuesta era «los pedidos de Martín a un jefe son tareas de ese proyecto».
  No se hizo así: un mensaje del Centro puede ser una pregunta o un «dale», y el Plan ya se limpió una vez de 64
  proyectos inventados. «Sumar al Plan» es un clic, sin preguntas, en cada pedido sin terminar.

**SIN HACER:**
- Cuando un chat cierra un trabajo «hecho», proponer el cierre de su tarea: falta el vínculo trabajo ↔ tarea (una
  columna en `operaciones_pedidos` o una marca en el detalle). Vive en `lib/operaciones.ts` → `cicloCartero`.
- Lo «SIN HACER» de los relevos (`docs/relevo/*.md`, 13 renglones en 4 archivos) cargado como tareas de su jefe.
- El alta queda firmada con el origen de la tool heredada (WhatsApp) y `ctx.actor` no se usa: lo compensa el texto del
  detalle y de la evidencia, que dicen «Centro de Operaciones».

**Vive en:** `lib/centro-plan.ts` · `lib/centro-plan-reglas.ts` · `app/api/centro/plan/route.ts` ·
`app/admin/operaciones/PlanJefe.tsx` · `tests/centro-plan.test.ts`

## El avance «casi nulo» no era la ventana de 14 días: el historial colgaba de nombres que ningún chat tiene (16/10/2026)

**El pedido.** «Elimina lo de "Antes del 16/10"... Eso debería estar dentro de los mismos chats, como el historial y el
progreso... Deberías traer mayor historial porque el "progreso" de la mayoría es casi nulo... Sobre todo me interesa ver
las cosas que pedí y están pendientes».

- **El diagnóstico obvio era el equivocado.** «Traer más historial» sonaba a abrir la ventana de 14 días. Medido: con
  TODAS las fechas sólo suman 92 pedidos (295 → 387). Lo que vaciaba el avance era otra cosa: **75 de los 81 chats de las
  bitácoras se conocen sólo por un nombre que ningún chat vivo tiene** («Chatbot» 62 hitos, «Graphics» 33, «Funnel y oferta
  del CRM» 20...), y todo eso caía en «Antes del 16/10». Ahora va al jefe que se llama como el ÁREA de su bitácora: con
  los carteros reales, CRM pasó a tener 61 pedidos terminados, Automations 47, Customer Success 26 (y 3 pendientes).
- **Lo pendiente no estaba en ningún chat.** Un pedido sin pasos (nadie lo empezó) sólo iba a `pidioAca`, que desde la
  punta 3 no se dibuja: los pendientes, justo lo que Martín quería ver, no salían en ningún lado. Ahora van al chat donde
  se pidieron (es el que los tiene que hacer).
- **Un jefe sin chat abierto se lista sólo con algo sin terminar** («Local Dev Environment», 6 pendientes): dice que ese
  jefe hace falta. Lo terminado queda en su historial y aparece cuando alguien abre un chat con ese nombre.
- **El peso:** los pedidos de todas las fechas son 575 KB (eran 448 KB con 14 días); lo terminado hace más de 14 días
  viaja corto (`pedidosDelCentro`). Si crece, el paso siguiente es pedir el historial al abrir el chat.
- **Los relevos no se parsean:** son prosa, y sólo 4 tienen «SIN HACER» (13 renglones). Lo pendiente de un relevo va al
  PLAN como tarea del proyecto de su tab (punta 4b), que es de donde el Centro lee lo pendiente.
- **Trampa de herramienta:** un reemplazo cuya ancla es el PRINCIPIO de un renglón deja el resto del renglón pegado
  después del texto nuevo. Pasó en la cosecha de la punta 3 y partió una regla de `AGENTS.md` en dos; las anclas van
  con el renglón entero.

**Vive en:** `lib/centro-chats.ts` (`chatsDeBitacoras`, `completarChats` paso 3, `gruposDelAvance`) ·
`lib/progreso-reglas.ts` (`pedidosDelCentro`) · `tests/centro-chats.test.ts` · `tests/centro-avance.test.ts`

## El Cerebro aparte, los jefes por tab, y un pedido sólo en el chat que lo trabajó (16/10/2026)

**El pedido.** «No estás aplicando la modularización y organización de chats... dentro de ese chat dice "Lo trabajó Centro
de Operaciones"... Si lo trabajó otro, no debería salir allí... hay otro que se llama "dashboard-marketing-7d"... Quiero
chats con los nombres de las tabs que sean "jefes"», y que el orquestador no es un jefe más.

- **Un chat jefe se reconoce por el nombre de una tab, y la lista ya existía en dos registros**: las etiquetas de la barra
  (`app/_components/nav.ts`) y los títulos de las áreas (`app/admin/dev/areas.ts`, que nombran también lo que no tiene
  tab: «Closing Analyst»). Se arma en el servidor (`app/admin/operaciones/tabs.ts`) y viaja como una lista chica: el
  registro de áreas es grande. Lo que no coincide va a «Sin asignar», plegado: renombrarlo lo pasa a su jefe.
- **El Cerebro es UN chat con sus nombres de antes** («Estrategia 3 cuentas» en las otras cuentas, hasta que se renombren:
  sólo Martín puede firmar ese renombre, desde su dispositivo). Mismo muñeco que tenía.
- **«Lo trabajó…» en el chat que pasó el pedido era el diagnóstico obvio y era el equivocado**: no faltaba el chip de la
  cuenta (lo que se había pedido antes), sobraba la línea. Un pedido sale sólo en el chat que lo trabajó; `pidioAca` se
  sigue calculando (dice de dónde vino) pero no se dibuja.

**Vive en:** `lib/centro-chats.ts` (`CEREBRO`, `esCerebro`, `seccionesDeChats`) · `app/admin/operaciones/tabs.ts` ·
`tests/centro-jefes.test.ts`

## El Centro adentro del Second Brain: se monta su MOTOR, no su pantalla (17/10/2026)

**El pedido.** Martín, 17/10 de madrugada: «quiero dejar de mandar prompts por aquí, quiero mandar prompts por MaKo en el
Second Brain, terminemos de configurar eso así ya comenzamos». Es la tanda 5 de docs/diseno-mako-ai-native.md («el Centro
como adaptador de la pieza»), adelantada.

**El diagnóstico obvio era el equivocado, dos veces.**
- *Montar `CentroApp` adentro del Second Brain*: las dos páginas son la misma grilla `.co` (barra + panel), así que salen
  dos barras de chats una al lado de la otra.
- *Copiar el estado del Centro en `ChatSecondBrain`*: es justo la falla que el diseño ya marcaba («hoy está escrita dos
  veces», CentroApp y ChatsMovil). Con tres copias del refresco, de la firma y del renombre, se separan en una semana.

Lo que se monta es el MOTOR. `useCentro` tiene la cola y los Runners (cada 8 s), los pushes después de dibujar, la
Ticketera de cada chat, el borrador y el alcance, `mandar` por `firma.mandar`, Renombrar y el muñeco. `PiezasCentro.tsx`
tiene la fila, la lista, la conversación y los menús, y `datosDelCentroSiOpera` hace la lectura del servidor.
CentroApp, CentroAppMovil, ChatSecondBrain y SecondBrainCentroM montan esas piezas. Cada pantalla pone sólo lo suyo:

- el Centro, la Ticketera entera, los Runners y el comando de «Nuevo chat»;
- el Second Brain, la sección «Claude Code».

**Lo que costó ver:**
- **Un hook no puede ser condicional, y el Second Brain lo abre todo el mundo.** El motor se monta en un componente
  aparte (`ConCentro`) sólo cuando el servidor mandó los datos, y le pasa el motor al cuerpo por una función
  (`children(k)`). Sin datos no corre ningún intervalo ni ninguna lectura de IndexedDB.
- **La guarda va ADENTRO de la lectura, no en la página.** Las páginas del Centro tienen la guarda y la lectura en su
  cuerpo, y el test las mira ahí. Una tercera página que leyera la cola por su cuenta tendría que acordarse de la guarda.
  Por eso `datosDelCentroSiOpera` devuelve null si no `puedeOperar`, y lo hace en sus dos primeras líneas, antes de leer
  nada (con test).
- **`?chat=` ya era el número de una conversación con MaKo.** Un chat de Claude Code va en `?centro=<clave>`. Volver del
  Mapa conserva cuál estaba abierto (`hrefVolver`); si no, la página rearmada abría el jefe de MaKo.
- **En el teléfono, la conversación no puede vivir adentro de la hoja «Tus chats».** Una hoja sobre otra REEMPLAZA
  (SheetM.tsx): al elegir un chat se cierra «Tus chats», y si la hoja de la conversación vivía adentro, se desmontaba
  con ella. Así no se abría nunca, y sin error. Por eso ChatsM va en dos partes: `parte="lista"` adentro y
  `parte="hoja"` afuera, con el chat abierto en el padre.
- **El script que rompía el código para probar el test se cayó a mitad y dejó un archivo roto.** Python en esta PC
  imprime en cp1252, y el «ℹ» de la salida de `node --test` lo tiró (UnicodeEncodeError) ANTES de restaurar. Se restauró
  a mano. La regla para un script que rompe y restaura: `PYTHONIOENCODING=utf-8`, y la restauración en un `finally`.
- **El chequeo de tipos acotado no entró en la RAM** con cuatro chats trabajando. La primera vez el vigía lo mató
  (salida 99), y con el heap bajado se quedó sin memoria (134). Entró a la tercera, con 2,5 GB libres: 13 archivos sin
  errores. Hay que esperar a que se libere la RAM: bajar el heap no lo hace entrar.

**Vive en:**
- `app/admin/operaciones/useCentro.ts`, `PiezasCentro.tsx` y `datos.ts`;
- `app/second-brain/ChatSecondBrain.tsx` (`ConCentro`, la sección «Claude Code»);
- `app/m/second-brain/SecondBrainCentroM.tsx`;
- `app/m/operaciones/ChatsMovil.tsx` (`parte`);
- `tests/second-brain-centro.test.ts`.

## Ops Center: una sola pantalla, Review con todo y el Uso de las cuatro cuentas (17/10/2026)

**El pedido.** Martín, mirando /admin/operaciones en producción (17/10, ~01:30), por el Cerebro, en siete puntos. Esta
punta trae tres:
- el 2: «El Second Brain y el Centro deberían ser exactamente lo mismo en SuperAdmin», con «Ops Center» de nombre y
  «Second brain» como sub-tab debajo de la Ticketera;
- el 4: «no sale el uso de las otras 2 cuentas, y no sale qué plan tiene, o el uso de 5 horas»;
- el 6: «Se terminaron y pushearon cosas y no las puedo ver en Review».

Los puntos 4 y 6 los hicieron dos subagentes Sonnet en el mismo worktree, con archivos que no se pisaban.

**Una sola pantalla, dos puertas.** El atajo era redirigir /admin/operaciones a /second-brain, o montar `CentroApp`
adentro del Second Brain (salían dos barras). Ninguno sirve:
- con la redirección, la barra marca la entrada equivocada y se pierde la guarda propia de la página del Centro;
- montar `CentroApp` es la copia que ya se había descartado.

Quedaron dos PUERTAS, cada una con su guarda: la de MaKo en /second-brain y `puedeOperar` en /admin/operaciones. Las dos
llaman a `PantallaSecondBrain` (app/second-brain/pagina.tsx), que también arma el Mapa. `CentroApp.tsx` se borró.
- **`?chat=` decía dos cosas.** En /second-brain es el número de una conversación con MaKo; en /admin/operaciones, la
  clave de un chat de Claude Code (los links de siempre). Ahora un número es MaKo y cualquier otra cosa, Claude Code, con
  `chatDeClave` (también acepta la sesión).
- **«Second Brain» como sub-tab cambia la LISTA, no el panel.** Tocarlo muestra los chats con MaKo y el Mapa; si no, la
  lista son los chats de Claude Code. Volver te deja en el último chat de Claude Code que tenías abierto.
- **Tres tests leían la FORMA de las páginas, no lo que protegen**: second-brain-chat, operaciones y
  tickets-decisiones-mazo («leerDecisiones() después de puedeOperar», «responder={responderDecision}» en la página).
  Ahora la lectura vive en datos.ts. Se reescribieron para seguir protegiendo lo mismo donde vive ahora: la guarda antes
  de leer, una sola acción que contesta, el Mapa sólo adentro de su `if`.

**Review: el diagnóstico obvio era el equivocado.** Parecía que los chats no terminaban o que el estado fallaba, y lo
terminado estaba bien. Lo que lo dejaba afuera era `&& n.revisar` en `porRevisar`: sólo entraba lo que tenía página
propia, y casi ningún chat la deja. Ahora entra todo lo terminado. Sin página, el link lleva a la tab del jefe
(`rutaDeLaTab`, `destinoDeReview`).
- **El orden de los ítems manda.** 27 nombres se repiten entre la barra del cliente y la del super admin («CRM» es `/crm`
  y `/admin/dev/crm`). La tab del producto va primero, como en `nombresDeTabs`, y un test lee los dos órdenes.
- **Un jefe válido no siempre es una tab.** 63 de las 130 áreas no tienen ítem en la barra («Closing Analyst», «Puente a
  Google Flow»): su Review va sin botón.
- **Renombrar la tab cambió adónde lleva un chat.** Con «Ops Center», un chat «Centro de Operaciones» lleva a la ficha de
  desarrollo (`/admin/dev/centro-operaciones`), no a la pantalla. Para que lleve a /admin/operaciones hay que renombrar
  el chat a «Ops Center».

**El Uso: la ventana de 5 horas faltaba por la PANTALLA.** `Barra` devolvía null sin la ventana, y la cuenta de la app
sólo trae la semanal. Mirar el dato era el diagnóstico equivocado. Del lado de la PC hay otra causa: cartero.mjs
descarta la de 5 horas si tiene más de 30 minutos. Además:
- **La lista del Uso salía de los carteros**: una cuenta sin Runner no aparecía y parecía que no existía. Ahora
  `cuentasDeUso` da siempre las cuatro (`CUENTAS`), con «Sin Runner todavía».
- **El plan** («Max») entra por `Cuota.plan`. La PC todavía no lo manda. Sin plan, la clave NO existe (no `plan: null`),
  porque el test diferencial de la barra de estado compara con `deepEqual`.
- **centro-textos se corta en el primer archivo que falta (ENOENT)** y no revisa los que siguen. Mientras CentroApp.tsx
  no estaba, nadie miraba Uso.tsx.
- **`renderToStaticMarkup` sirve para probar una pantalla sin navegador**, si el componente no tiene hooks
  (`ListaUso`) o se dibuja cerrado (`BotonUso`).
- **Un archivo borrado del disco y no de git rompe 23 guardas de OTRAS áreas.** Las guardas que recorren el árbol leen
  `git ls-files`, y CentroApp.tsx seguía en el índice: ENOENT en la del CRM, la de cobros, la de cursos… Parecía que el
  cambio había roto medio repo. Un archivo que se borra va con `git rm`, en el mismo momento.

**Vive en:**
- app/second-brain/pagina.tsx y ChatSecondBrain.tsx (`enSB`, `irAlSecondBrain`, `irAClaudeCode`, la Ticketera);
- app/admin/operaciones/page.tsx y PiezasCentro.tsx (`PieCentro`, `NuevoChatCentro`);
- lib/centro-chats.ts (`porRevisar`, `rutaDeLaTab`, `destinoDeReview`) y lib/centro-uso.ts (`cuentasDeUso`, `sanearPlan`);
- tests/centro-revisar.test.ts, centro-uso.test.ts y tickets-decisiones-mazo.test.ts.

## La conversación como un chat de verdad: lo que contestó sale del transcript (17/10/2026)

**El pedido.** Martín, mirando el Centro en producción: «Y sobre todo, los chats no se entienden... No se entiende la
conversación que se tiene». La conversación mostraba títulos de hitos («Corrección · 19:32 — …», «Hecho · 04:34 — …») y
líneas como «Lo pediste en Estrategia 3 cuentas». Lo que el chat CONTESTÓ no estaba en ningún lado: el Centro sólo veía
la bitácora, los trabajos y sus cierres.

**Lo que contestó cada chat ya estaba en la PC.** Primero se pensó en «subir el transcript», y es el diagnóstico obvio
equivocado: pesa decenas de MB y está lleno de herramientas y razonamiento. Lo que se encontró:
- **El registro de cada sesión de la app** (`claude-code-sessions/<org>/<x>/local_*.json`) ya trae `lastTurnReport`
  (el texto final del último turno), `postTurnSummary`, `model`, `effort`, `cliSessionId` y `cwd`.
- **El transcript** está en `<carpeta de config>/projects/<cwd con todo lo que no es letra o número cambiado por «-»>/<sesión>.jsonl`.
  Para un chat de la app, en `~/.claude` y con el `cliSessionId`; para uno de terminal, en su carpeta y con su
  `sessionId`. Medido con el chat Onboarding de la cuenta 4.

Así quedó:
- La PC lee del transcript **sólo lo nuevo, por posición en BYTES** (`turnos/<local>.json`). Con posiciones en
  caracteres, una tilde corría todo.
- `turnosDeLineas` (pura, con test) saca lo que se le dijo y la respuesta FINAL de cada turno: el último texto antes del
  próximo mensaje o del fin del turno (`stop_hook_summary`). Si un chat no está trabajando, su última respuesta ya vale.
- MaKo guarda los últimos 60 turnos de cada chat en `app_settings`, **sin migración** (lib/centro-turnos-db.ts). La marca
  de la PC avanza sólo si MaKo dice `turnosOk`.

**Lo que hay que limpiar de un transcript, medido sobre uno real:**
- los `<system-reminder>` vienen PEGADOS al prompt;
- los mensajes de otras sesiones vienen envueltos en `<cross-session-message from=… name=…>`, con un renglón antes y
  otro después;
- los avisos automáticos (`<task-notification>` y compañía) no los dijo nadie;
- la app escribe en nombre del modelo «You've hit your session limit…» (`isApiErrorMessage`, `model: '<synthetic>'`).

**Un trabajo del Centro también llega como mensaje** («Pedido de Martín desde el Centro…», con su id en la línea del
`cierre`). Se marca con ese id y no se dibuja dos veces, porque ya está con sus ticks.

**Un mensaje nuevo cierra el turno anterior, aunque no se muestre.** El aviso de la Ticketera no se dibuja, pero termina
el turno de antes. El test esperaba lo contrario y el que estaba mal era el test.

**Los hitos siguen en el Plan.** `lineasDeConversacion` deja en la conversación los turnos, los trabajos y las respuestas
a la Ticketera. `avanceDelChat` sigue leyendo los pedidos de la bitácora.

**De cada turno salen DOS textos**, por la regla de Martín de que cada chat abre con «Voy a trabajar en…» y cierra con
su «Ya está»:
- el PRIMERO sale en el acto, y se ve mientras trabaja;
- el ÚLTIMO sale al terminar, si es otro (`cierreDe`).

La primera versión sólo guardaba el último, y un chat que trabajaba una hora no mostraba nada.

**«Trabajando» y «dormido» con el Runner caído.** El estado de cada chat sale del registro vivo de la PC
(`sessions/<pid>.json`, `busy` o `idle`), y lo sube el Runner en cada vuelta. Cuando la app se cayó, el Runner dejó de
dar vueltas, y la pantalla mostró una foto de hacía 40 minutos como si fuera de ahora: caras dormidas y «13 %». Ahora:
- la lista dice «Sin noticias del Runner desde las HH:MM» (`sinNoticiasDesde`);
- con la foto vieja, la cara es «cansado» y no «dormido» (`animoDe`, Muneco.tsx);
- un chat que trabaja sin haber escrito nada lo dice (`trabajaSinEscribir`).

**Sin medir:** cómo se ve con chats reales. Hace falta el cartero 1.8.0 instalado y unas vueltas. La primera vuelta de
cada chat sube la cola de su historia (los últimos 2 MB del transcript).

**Del punto «a» (todo chat abierto se ve)**, se midió en la PC (17/10):
- «Pagos» y «MaKo en WhatsApp» están en la carpeta de la cuenta 4 y el cartero los ve. Caían en «Sin asignar», que iba
  PLEGADA; ahora va abierta.
- «Runner» lo excluye el cartero a propósito: no se le puede escribir.
- Los chats de la nube no quedan en ningún archivo de la PC.
Las dos cosas que faltan, con su archivo, están en el relevo.

**Vive en:** scripts/operaciones/cartero.mjs (`turnosDeLineas`, `turnosNuevos`, `turnosDeLaVuelta`, `carpetaDelCwd`) ·
lib/operaciones-reglas.ts (`TurnoChat`, `sanearTurnos`, `unirTurnos`) · lib/centro-turnos-db.ts · lib/operaciones.ts
(`cicloCartero` → `turnosOk`) · app/admin/operaciones/acciones.ts (`turnosCentroAction`) · lib/centro-chats.ts
(`lineasDeConversacion`) · Hilo.tsx (`Turno`) · useCentro.ts (`mirar`, `turnosDe`) · tests/centro-turnos.test.ts

## La cuenta «Automático», el modelo y el esfuerzo: lo que se elige y lo que no se puede (17/10/2026)

**El pedido.** Martín, en el mismo feedback:
- el punto 3: «Al enviar un prompt por el Second Brain no me deja seleccionar qué cuenta... Si no selecciono nada que lo
  decida solo, pero debería poder seleccionar»;
- el punto 7: «que los jefes y el cerebro tengan la capacidad de ahorrar tokens, dando instrucciones precisas y
  eligiendo qué modelo de IA debe correr».

**Elegir la cuenta es elegir a cuál de SUS sesiones va el trabajo.** Un chat es un nombre con una sesión por cuenta
(`unirPorNombre`). La lectura obvia era «mandarlo a cualquier cuenta», y es la equivocada: una cuenta en la que el chat
no está abierto no tiene a quién entregarle. Por eso el selector ofrece sólo las cuentas donde el chat vive, y abrirlo en
otra es el «un clic» (docs/diseno-nuevo-chat-un-clic.md).

«Automático» (`sesionAutomatica`, lib/centro-cuentas.ts) elige así:
1. Primero la sesión que recibe ya: abierta, al día, con Runner en su carpeta y el de su cuenta vivo.
2. Entre ésas, la de más cuota libre, y lo libre lo decide la ventana MÁS gastada (5 horas o semanal).
3. Lo que no se sabe va después de lo que se sabe: tratar «sin dato» como «todo libre» mandaba todo a la cuenta sin
   medir.

**El modelo y el esfuerzo no se pueden cambiar en un chat de terminal.** `set_session_model` y `set_session_effort` son
herramientas de la APP: un chat de terminal no tiene cómo recibir el cambio desde afuera, y la sesión no puede cambiarse
el suyo (el sistema lo prohíbe: «a session must not silently re-price its own turns»). Así funciona:
- en un chat de terminal, el selector aparece apagado y dice por qué;
- en uno de la app, el modelo y el esfuerzo viajan FIRMADOS, opcionales: sin elegir nada, el texto firmado es idéntico al
  de antes (la regla quedó en AGENTS.md);
- la PC se los pasa al Runner con la sesión (`comoCorre`, cartero.mjs 1.7.0), y el Runner los aplica antes de entregar;
- «Automático» no toca nada: lo decide el Cerebro;
- vuelven a «Automático» después de mandar, como el alcance. Así el Runner no cambia el modelo en cada trabajo, y cada
  cambio puede pedirle permiso a Martín en la app.

**Sin medir:** si la app le pide permiso a Martín cada vez que el Runner cambia el modelo de OTRA sesión. La herramienta
dice que sí («any other session, and the app asks the user first»), salvo en modo auto. Si pregunta siempre, el Runner se
frena esperando: hay que mirarlo en la primera prueba.

**Vive en:** lib/centro-cuentas.ts · lib/operaciones-reglas.ts (`MODELOS`, `ESFUERZOS`, `armarFirmable`) ·
app/admin/operaciones/useCentro.ts y PiezasCentro.tsx (`SelectoresDeEnvio`) · app/m/operaciones/ChatsMovil.tsx ·
scripts/operaciones/cartero.mjs (`comoCorre`) · lib/runner.ts (el paso b) · tests/centro-cuentas.test.ts,
tests/operaciones.test.ts y tests/cartero-carpetas.test.ts

## La cuenta 4, y una sesión de la app SÍ abre chats visibles (17/10/2026)

**Una sesión de la app ya puede crear chats.** Lo de arriba («el Centro no puede abrir un chat de Claude Code (medido)», 16/10) quedó viejo para la app de escritorio. La noche del 16 al 17/10, el Cerebro de la cuenta 4 abrió siete chats con `mcp__ccd_session__start_session`: CRM, Onboarding, Centro de Operaciones, Automations, Runner, Video Generator y Dashboard. Cada uno llevaba título y brief, y quedó en la barra lateral. La herramienta aparece como diferida y se carga con ToolSearch. El chat creado arranca solo con su brief y le avisa a quien lo abrió cuando termina un turno. Lo que sigue sin poder hacer una sesión de la app es abrir una de TERMINAL (otra carpeta de config). Para eso, Martín pidió (17/10) «un clic + el permiso de la PC», nunca pegar un comando: está repartido al chat del Centro.

**Sumar una cuenta son cinco lugares, y uno NO.** Los cinco:
- una línea en `~/.claude/cuentas.tsv`;
- el marcador `~/.claude/cuenta-activa.txt`;
- el cartero: `cartero.mjs cartero claudeN app ~/.claude` y `cartero.mjs carpeta <uuid> claudeN`. El uuid es la carpeta NUEVA que aparece en `%APPDATA%\Claude\claude-code-sessions` el día que se loguea;
- `CUENTAS` en `app/admin/dev/_registro/tipos.ts`, porque un hito firmado con una cuenta que no está ahí rompe /admin/dev;
- la regex de `scripts/gen-dev-historial.mjs`, que hasta el 17/10 era `claude1|claude2` y dejaba sin cuenta, sin avisar, todo lo de la 3.

Lo que NO se toca es `CUENTAS_TERMINAL` (lib/runner.ts), salvo que la cuenta tenga su función en el `$PROFILE`: si no, el Centro ofrece un comando que falla. Pasó: el panel de Uso le ofreció a Martín `claude4 -n Runner` y PowerShell contestó «not recognized». Arreglado el 17/10: sólo se ofrece comando a una cuenta con su función en el `$PROFILE` (`tieneTerminal`, lib/runner.ts). A la de la app se le dice «Abre su Runner en la app de Claude para conectarlo», y «Nuevo chat» no arranca en ella. Lo fija tests/runner-cuenta-app.test.ts.

**Cómo se supo que era otra cuenta sin preguntar.** `get_usage` dio 0% con reset el 20/10 19:59 UTC; la 3 renueva el 21/10 08:59 UTC. El `userEmail` del contexto traía un gmail que no era de ninguna de las tres, así que esta vez sí describía la cuenta abierta. `list_sessions` vino vacío porque la barra está partida por cuenta. El aviso de «99% semanal» del hook era de la cuenta 3 y no aplicaba.

**Vive en:** `~/.claude/cuentas.tsv` · `~/.claude/operaciones/config.json` · `app/admin/dev/_registro/tipos.ts` · `scripts/gen-dev-historial.mjs` · docs/relevo/cerebro.md («CUENTA 4»)

## La conversación vacía: la PC avanzó sus marcas antes de que MaKo supiera guardar los turnos (17/10/2026)

**Síntoma:** en el Ops Center, la conversación de cada chat salía vacía, aunque los chats llevaban horas trabajando.

**Causa:** el cartero 1.8.0 lee cada transcript desde una marca en bytes (`~/.claude/operaciones/turnos/<local>.json`) y la
avanza cuando la vuelta sale bien. Se instaló a las 02:54 AR, ANTES de que se desplegara el servidor que guarda los turnos.
Las marcas quedaron al final de cada transcript, y lo anterior no se volvió a subir nunca.

**Arreglo:** con el servidor ya en producción, apartar las marcas (`mv turnos/*.json turnos-respaldo-…/`). En la vuelta
siguiente el Runner sube los últimos tres días de cada chat. Repetirlo no duplica nada, porque el servidor deduplica por
uuid (lib/operaciones-reglas.ts, `unirTurnos`). Medido: 54 chats en `app_settings` (`operaciones.turnos.*`) a los 2 minutos.

**Regla:** un cartero que AVANZA una marca se instala después del servidor que recibe lo que sube, nunca antes.

## Adjuntos hasta la PC, los «Ya está» en Review, el Runner y la nube en la lista (17/10/2026)

**El pedido.** Martín: «Realmente quiero comenzar a dar feedback de las cosas pero me estás trabando». El relevo del
Ops Center (cuenta 4) hizo cinco puntas chicas: el grafo al tocar «Second Brain», adjuntar en la caja, los «Ya está»
en Review, el Runner y la nube en la lista, y el clic sin PowerShell (este último, a medir con Martín).

**Adjuntos: lo que protege es la FIRMA, no el servidor.** Lo obvio era «MaKo valida el archivo y la PC lo baja». Pero
con MaKo comprometida, MaKo es justamente quien miente. Así quedó:
- el NAVEGADOR calcula el sha256 de los bytes que sube y lo firma con el trabajo (`subirAdjuntos`, mandar.ts);
- si MaKo devuelve otro hash, la caja no firma;
- la PC compara lo que baja con ESE hash, con el tamaño y con el tipo por los primeros bytes (`bajarAdjuntos`, cartero.mjs);
- el nombre en disco lo arma la PC, con la extensión del TIPO y nunca la que trajo («virus.exe» de tipo PNG se guarda
  como `2-virus.png`).

**La revisión de seguridad del Cerebro encontró dos defectos que los tests no veían** (cartero 1.9.1). Los dos son
trampas del entorno, no de la lógica:
- **`Number(r.headers.get('content-length'))` da 0 cuando no hay header.** Una respuesta «chunked» no trae
  content-length, el tope «pasaba», y `arrayBuffer()` leía todo a la RAM: 50 MB reproducidos en Node 24. Con gzip, el
  content-length es el COMPRIMIDO. El arreglo: pedir `accept-encoding: identity`, rechazar lo comprimido y leer
  `r.body` en partes, cortando apenas pasa lo firmado. El test manda 400 partes de 64 KB y mira que se corte en las
  primeras.
- **Un trabajo `tomado` no tenía salida.** El acuse era su único camino, y cancelar y vencer miran sólo lo `escrito`.
  Con los adjuntos la ventana crece: el Runner baja el archivo entre reclamar y escribir el buzón, y su Bash corta a los
  120 s. Ahora lo tomado sin acuse vence a las 2 horas (`TOMADO_VENCE_MS`) como «no sé si llegó» y borra sus adjuntos.
  Además, MaKo da un adjunto sólo en los 15 minutos después de tomado.

**Un campo que cambia lo que la PC HACE se habilita por versión.** La regla del campo opcional dice «un cartero de antes
lo ignora». Con el modelo eso alcanzaba. Con un adjunto es una pérdida silenciosa: el trabajo saldría sin sus archivos y
nadie lo diría. Por eso la caja no muestra el «+» hasta que el Runner de esa cuenta suba la versión que baja adjuntos
(`aceptaAdjuntos`). La versión se compara por número: «1.10.0» es mayor que «1.9.1». La regla quedó en AGENTS.md.

**La subida es una ruta y no una server action**: la action corta el cuerpo en 1 MB y una captura pesa más. El tope es
el de Vercel (~4,5 MB, un 413 en texto plano), el mismo del chat con MaKo: 4 archivos y 4 MB en total. Una captura de
hasta 1,5 MB va tal cual, porque el texto de una captura se lee mejor en PNG. Una foto más grande se achica.

**Los «Ya está» en Review.** Cada «Ya está» es el último texto de un turno (rol `el`, del transcript). Va a Review y no
al Plan: el Plan son los pedidos y los trabajos, y un «Ya está» cierra uno de ellos. Contarlo dos veces inflaría el
«8/13». Sobre la ruta que deja:
- lo que parece una ruta muchas veces es un ARCHIVO: `/c/dev/wt-centro-chat`, `app/x.tsx`, `cartero.mjs`;
- `rutaDeYaEsta` los descarta y pasa cada candidato por `rutaParaRevisar`, la misma regla que Review.

**El Runner y la nube en la lista** (cartero 1.10.0):
- **El Runner ya no se esconde.** Esconderlo era una decisión vieja («al Runner no se le escribe»), y un test la fijaba
  (cartero-carpetas: «el Runner no es un chat»). Martín la dio vuelta («todo chat abierto se ve»), así que el test ahora
  fija la regla nueva. El Runner sube con `esRunner`: se ve, su caja dice por qué no, y nunca está en `entregables`
  (ni en la PC ni en MaKo). Sus vueltas no se suben como conversación.
- **Un chat de la nube no se une con el de la PC que se llama igual.** Por nombre se unían, y la sesión de la nube
  quedaba elegible como destino sin tener canal. Su grupo es `nube:<nombre>`.
- **Sin medir:** la forma real de una fila de `list_sessions` para un chat de la nube. El 17/10 no había ninguno en la
  cuenta 4 (ni archivado). Por eso el id se acepta amplio (`NUBE_RE`: lo que no es `local_`/`cli_`).

**Lo que costó del entorno:**
- **El chat anterior seguía corriendo** cuando arrancó el relevo y commiteó en el mismo worktree entre dos comandos.
  Antes de tocar nada hay que mirar `list_sessions {linked:true}` y `git log`, y pedirle que suelte el worktree.
- **`git apply --3way` deja los archivos con CRLF** en este clon (`core.autocrlf=true`). Un script que reemplaza
  texto con `\n` no lo encuentra («el texto aparece 0 veces»), sin romper nada. Pasó al rearmar la punta 4 sobre la 2b.
- **Un heredoc con backticks en el Bash falla** («unexpected EOF»): los scripts de edición van a un archivo.
- **El typecheck acotado con 13 archivos lo mató el vigía de RAM** (1,5 GB libres). En tandas de hasta 5 archivos pasó.
- **Un hook sin `'use client'` no puede traerse un VALOR de un módulo `'use client'`** (`achicarImagen`, de
  app/m/mako/subir.ts, en useCentro.ts). Los tests del Centro pasaban y el run cayó en tests/frontera-use-client.test.ts:
  para ese barrido es un server usando una referencia de cliente. El Cerebro mudó la función a
  app/m/mako/achicar-imagen.ts, sin la directiva. Antes de pasar una punta se corren también ese test y los barridos que
  recorren el repo (`grep -lE "ls-files|archivosDelRepo|readdirSync" tests/*.test.ts`), no sólo los del área.
- **Un test con una ruta de Windows (`C:\dev\x`, la ruta de un archivo de la PC) rompe la guarda de rutas**
  (tests/rutas-windows-en-tests.test.ts) si no está en `PERMITIDOS` de scripts/rutas-windows-en-tests.mjs, con su
  motivo. Pasó tres veces seguidas el 17/10 (adjuntos, Runner y nube, el clic): los tests del área pasaban y caía el
  barrido. La línea va en el MISMO commit que el test.
- **Tres tests fijaban la FORMA de una línea** (el import de mandar.ts, la llamada a `firma.mandar`, `mensaje(l.p)`).
  Un cambio que sólo agrega un argumento los rompía. Se abrieron para seguir exigiendo lo mismo.

**Vive en:**
- scripts/operaciones/cartero.mjs (`bajarAdjuntos`, `mimePorFirma`, `nombreEnDisco`, `anotarNube`, `leerNube`);
- lib/operaciones-adjuntos.ts y app/api/operaciones/adjuntos/route.ts;
- lib/operaciones-reglas.ts (`problemaDeAdjuntos`, `aceptaAdjuntos`, `NUBE_RE`, `TOMADO_VENCE_MS`);
- lib/centro-chats.ts (`yaEstaDelChat`, `rutaDeYaEsta`, `comoSale`) y app/admin/operaciones/AdjuntosCaja.tsx;
- tests/centro-adjuntos.test.ts, centro-ya-esta.test.ts y centro-runner-nube.test.ts.

## El clic, medido: `detached` muere con la herramienta, el Explorador no (17/10/2026)

**El pedido.** Martín quiere abrir un chat de terminal con «un clic + el permiso de la PC», nunca pegando un comando en
PowerShell (docs/diseno-nuevo-chat-un-clic.md). El diseño decía `spawn('powershell.exe', …, { detached: true })`. Antes de
construir había que mirar que la ventana se viera. La medición la hizo el primer chat «Ops Center» el 17/10 a las ~07:15
UTC, con el OK de Martín («Sí, ábrela», un trabajo firmado desde el Centro), y desde la herramienta Bash de una sesión de
la APP, la misma que usa el Runner.

**El diagnóstico obvio era el equivocado.** «En Windows, un hijo `detached` tiene su propia ventana» lo dice la doc de
Node, y es cierto fuera de esta herramienta:
- lanzado desde la herramienta Bash, el PowerShell `detached` MUERE apenas termina la llamada: ni ventana ni comando. Lo
  más probable es que la herramienta corra cada comando en un job de Windows que mata a sus hijos, y `detached` no los
  saca del job;
- atado (`spawnSync`) corre bien, carga el perfil de Windows PowerShell 5.1, y `claude2` existe.

**Lo que SÍ abre una ventana visible y duradera:**
- se escribe un `.cmd` con `powershell.exe -NoExit -EncodedCommand <b64>` y se abre con `explorer.exe <ruta>`. El
  Explorador vive fuera del job;
- la ventana es de **Windows Terminal** (`WindowsTerminal.exe`, con el título que se le dio), no de powershell.exe: en
  Windows 11 la consola por defecto es la Terminal. Para buscarla por título, se busca ahí;
- `explorer.exe` **devuelve 1 aunque abra bien**. Su código no sirve de acuse: la prueba es que el chat nuevo aparezca en
  `sessions/<pid>.json` de su carpeta en la vuelta siguiente.

**Y una trampa que el diseño no veía: el primer mensaje no puede ir como argumento.** La función del perfil hace
`claude @args`, y Windows PowerShell 5.1 no escapa las comillas dobles al pasarle un texto a un ejecutable: un argumento
con `"` llega partido en varios. Con `(Get-Content -Raw …)`, un mensaje que dijera `" --algo "` terminaría siendo una
opción de Claude. Así quedó:
- el primer mensaje va a `aperturas/<id>.txt`;
- el chat arranca con un pedido FIJO que arma la PC («Lee el archivo <ruta> y haz lo que dice»);
- un nombre con `"` se rechaza en la firma.

**Sin medir:** que `claudeN -n '<nombre>' '<pedido>'` arranque la sesión interactiva con ese pedido (la ayuda de la CLI
dice que sí), y el caso de la cuenta de la app (sólo puede PROPONER el chat).

**La revisión de seguridad del Cerebro sobre el clic (cartero 1.11.1) encontró dos defectos con forma de regla:**
- **Un interruptor de seguridad que falla ABIERTO.** `const prendido = resto[0] !== 'off'` parece apagar con «off», pero
  «OFF», «apagar», «--off» o «off » PRENDÍAN la apertura y contestaban ok. Era el único interruptor para cortarla. La
  regla: un interruptor se compara contra una lista cerrada («on» u «off», normalizados), y cualquier otra cosa es un
  error que no toca nada.
- **Lo reclamado sin vencimiento en la PC.** `abrir` miraba sólo el `vence` de la firma (14 días), nunca cuándo se
  reclamó. Si la vuelta se cortaba entre `ciclo` y `abrir`, la ventana podía abrirse días después, con MaKo ya dándola
  por perdida y el acuse descartado; y si Martín la había vuelto a mandar, se abrían dos. Ahora una apertura vence a los
  30 minutos, menos que las 2 horas de `TOMADO_VENCE_MS`, así el acuse llega con el trabajo todavía tomado. La vencen
  `abrir` y la vuelta, porque `abrir` puede no correr nunca.

Y tres endurecimientos baratos:
- el `.cmd` se borra en la vuelta siguiente, porque se podía volver a correr sin firma;
- «ya abierto» se anota ANTES de lanzar, con `wx`;
- el error que manda MaKo va al contexto del Runner en un renglón y hasta 200 caracteres. Es texto remoto, y el Runner
  es un modelo que puede correr `clave` y `abrir-permitir`.

**Vive en:** docs/diseno-nuevo-chat-un-clic.md («3. La PC», «Medido» y «Lo que dejó la revisión») ·
scripts/operaciones/cartero.mjs (`abrir`, `vencerAperturas`, `textoRemoto`) · tests/centro-abrir.test.ts · la nota de
la medición, en la carpeta de notas compartida del Cerebro (`ops-center-medicion-clic-17-10.md`).

## Que salga en segundos: `vigilar` y la consulta liviana (17/10/2026, cartero 1.12.0)

**El pedido.** Martín: «Envié un mensaje y no pasó nada por varios segundos... Debería automáticamente comenzar a
trabajar». El Cerebro lo midió: el trabajo a Video Generator se mandó a las 07:55 UTC, salió del buzón a las 07:56:57 y
se acusó a las 07:57:11. Era el cron de 2 minutos del Runner.

**Lo obvio era bajar el cron, y no alcanza.** El cron arranca un TURNO del modelo cada vez, y la vuelta completa
(`ciclo`) sube los chats y los turnos de los transcripts. Hacerla cada pocos segundos es caro y pesado. `esperar` ya
existía, pero hacía eso mismo: la vuelta completa cada 15 s, y salía por stderr con código 2. Lo que quedó:
- **una consulta liviana**, `GET ?hay=<cuentas>&abre=<cuentas>`, que devuelve sólo un número y no escribe nada. Cuenta
  lo `escrito` para los entregables que cada cuenta subió en su última vuelta, y los `nuevo` sólo de las cuentas que la
  PC abre: si no, una vuelta completa no los reclamaría, y la PC preguntaría en falso para siempre;
- **`vigilar`**, dentro del MISMO turno del cron: la vuelta completa, la consulta cada ~4 s y, apenas hay algo, otra
  vuelta y sale.

**Tres cuidados que se prueban con un MaKo de mentira:**
- **El Bash del Runner corta a los 120 s**: `vigilar` no arranca una vuelta que, con margen (1,5 × la última, mínimo
  2 s), no entra en lo que queda. El tope es 105 s;
- **si la consulta falla, cae a la vuelta completa**, con 30 s mínimo entre una y otra, no al silencio;
- **si `hay` dice que sí y la vuelta no reclama nada**, espera antes de repetirla: sin eso, la vuelta completa corría
  cada 4 s.

Un test con un tope MENOR que el margen mínimo de una vuelta (2 s) pasaba sin consultar nunca. Por eso las pruebas usan
topes de 6-8 s.

**Vive en:** scripts/operaciones/cartero.mjs (`vigilar`, `hayAlgo`) · lib/operaciones.ts (`hayParaElCartero`) ·
app/api/operaciones/cartero/route.ts (el GET `?hay=`) · lib/runner.ts (el paso 2a) · tests/centro-vigilar.test.ts.

## Un mensaje del Runner queda RETENIDO si el chat destino corre en otro modo de permisos (17/10/2026)

**Síntoma:** Martín mandó un pedido grande al Cerebro desde el Ops Center. El Runner lo entregó y lo acusó «ok», pero el
Cerebro no lo vio durante una hora.

**Causa:** la app RETIENE un mensaje entre sesiones cuando el que recibe corre en otro modo de permisos que el que manda.
El Runner estaba en «auto» y el Cerebro en «Omitir permisos». El mensaje queda esperando que alguien lo apruebe en la
pantalla del chat destino. El Runner no se entera: su SendMessage salió bien y su acuse ya está escrito.

**Arreglo:** el chat destino en el MISMO modo que el Runner. Al pasar al Cerebro a «auto», el mensaje se liberó solo. Un
Runner no se puede subir a «Omitir permisos» si no se lanzó con --dangerously-skip-permissions.

**Regla:** todos los chats que reciben del Runner van en su mismo modo. Un acuse «ok» del Runner prueba que se mandó,
no que se leyó.

**Lo que quedó sin explicar:** entre las 09:07 y las 09:59 UTC el Runner dijo «vuelta hecha» pero MaKo no recibió
ninguna (operaciones_carteros.visto_at quieto), y no tomaba mensajes nuevos. Se destrabó al parar su turno con
stop_session y reprogramar el cron con `vigilar` (1.12.0). Si vuelve a pasar, mirar visto_at antes de creerle al Runner.

## Los dos topes de la app sobre el Cerebro cuando Martín no le escribe (17/10/2026)

**Síntoma:** con Martín hablando sólo por el Ops Center, el Cerebro se queda sin poder repartir. Le pasaron dos cosas:
- `start_session` contesta «Start sessions only on the user's own words to you here» al abrir el chat de MaKo Mobile.
- Al avisar los «Ya está» del run 110, el mensaje número 11 contesta «Not delivered: this session has already messaged
  Claude Desktop sessions 10 times since your user last typed here» y no sale.

**Causa:** la app no toma un pedido firmado que llega por el Runner como si Martín lo hubiera escrito en el chat del
Cerebro. Para ella, un turno que empieza con un mensaje de otra sesión o con una tarea de fondo es automático. Con eso
aplica dos frenos anti-bucle:
- **no abre sesiones;** sólo deja PROPONER, con una tarjeta, y a Martín no le gustan;
- **corta los SendMessage a sesiones de Claude Desktop al décimo** hasta que Martín escriba en el chat del Cerebro.

El diagnóstico obvio («el Runner no tiene permisos») era el equivocado: el pedido llegó bien. El tope es del chat que
reparte. A un subagente lanzado con Agent no se le aplica.

**Regla:**
- Un pedido del Ops Center que necesita un chat NUEVO arranca como `Agent` en segundo plano, con el brief completo y su
  cosecha. Arranca sin tarjeta, pero no aparece en la lista del Ops Center. Si Martín lo quiere ver ahí, se le abre su
  chat en el próximo mensaje que escriba en el Cerebro.
- Los avisos de una tanda se mandan juntos y sólo a quien tiene algo nuevo. Si el lote pasa de diez, primero van los
  que cambian lo que hace un chat (un rojo, una punta que esperar) y después los «Ya está». Lo que no salió queda en
  docs/relevo/cerebro.md para mandarlo después del próximo mensaje de Martín.

## El chat abierto, el «Trabajando…» y las preguntas de los chats (17/10/2026, Ops Center de la cuenta 4)

**Renombrar sacaba del chat, y redirigir después no alcanzaba.** Martín: «me dejó en una tab tipo "No existe este
chat"». La clave de un chat ES su nombre (`nombre:video generator`, `unirPorNombre`), y la URL también lo llevaba: con
el nombre nuevo nace otro chat y el viejo deja de existir. El arreglo obvio («redirigir al terminar de renombrar») no
cubre nada: el nombre nuevo llega MINUTOS después, con la vuelta del Runner, y un F5 o un link viejo caen igual.
**Regla:** lo que sigue a un chat usa su SESIÓN, que no cambia (`seguirChat`, `claveParaUrl`, lib/centro-chats.ts); un
nombre viejo sólo sirve para buscar en los trabajos mandados (`destino_titulo` → `destino`), y el renombre mismo es uno.

**El «Trabajando…» tenía un hueco de hasta dos minutos.** `vigilar` entrega en segundos, pero su consulta liviana no sube
el estado de los chats: el «busy» llega con la vuelta COMPLETA siguiente. Entre «Entregado» y «busy» el chat ya trabaja y
la pantalla lo mostraba quieto. **Regla:** un `entregado` sin respuesta del chat cuenta como trabajando por 3 minutos
(`chatTrabajando`, `RECIEN_ENTREGADO_MS`).

**El motivo de una espera tiene ORDEN.** Sin cuota, el Runner de esa cuenta tampoco corre: su `visto_at` envejece y la
pantalla diría «el Runner no responde», que lleva a abrir un Runner que ya está abierto. La cuota va primero. Y si
NINGÚN Runner da noticias es la PC (dormida o apagada), no una cuenta (`porQueTarda`, con `sinNoticiasDesde`).

**Contestar una pregunta: lo que manda es lo firmado.** Marcar «contestada» en la base no le dice nada a la PC, que sólo
entrega lo firmado. Por eso la respuesta sale primero por mandar.ts, con la marca `[pregunta <id>]` adentro del texto, y
el servidor la marca sólo si el trabajo existe, es de esa sesión y dice EXACTAMENTE `textoDeRespuesta`
(`contestarPreguntaAction`). La conversación esconde ese trabajo y lo dibuja dentro de su pregunta: aparte, se leería la
marca.

**El globito de las preguntas sin abrir cada chat.** Las preguntas viven una clave por chat (como los turnos), pero la
lista necesita, en cada refresco, cuántas espera CADA chat. Leer 60 claves cada 2,5 s no va: una clave índice
(`operaciones.preguntas-abiertas`) se recalcula para el chat que se escribe, cada vez que se escribe.

**Una regla de CSS del teléfono escondía el botón.** `@media (hover: none)` escondía `.co-preg__pie` entero, que era sólo
la ayuda del teclado. Con «Responder» adentro (una pregunta de «varias»), en el teléfono no se podía contestar, y en la
computadora se veía bien. **Regla:** antes de meter un botón en una pieza que ya existe, buscar sus `@media`.

**Vive en:** lib/centro-chats.ts (`estadoDelEnvio`, `chatTrabajando`, `seguirChat`, `seccionesDeChats`) ·
lib/centro-preguntas-chat.ts y su `-db` · app/admin/operaciones/PreguntaChat.tsx · scripts/operaciones/cartero.mjs
(`preguntar`, 1.14.0) · tests/centro-envio, centro-renombre, centro-jefes, centro-preguntas-chat, cartero-carpetas.

**Sin hacer (docs/relevo/centro-operaciones.md):** B (la caja con «+», listas en vivo, el borrador que nunca se pierde),
C y D (el «Ya está» con links y la tarjeta del Plan, sin Review), E (los pasos en vivo: otra vez cartero.mjs), F (la
Criatura), G (las cuentas) y los links azules. Sin medir en una pantalla real: nada de esto se vio en un navegador.

## El Plan que se arma solo, la tarjeta del «Ya está», la Criatura y los links (17/10/2026, Ops Center de la cuenta 4)

**El Plan de cada chat no se puede escribir en la vuelta del Runner.** Lo obvio era «cuando entra un "Ya está", cerrar su
tarea ahí mismo». Pero cada alta o cierre del Plan pasa por el Perro (30 a 60 s) y la vuelta la corre el Bash del Runner,
que corta a los 120 s: dos pasos y la vuelta muere, sin entregar nada. **Regla:** lo lento que sale de una vuelta del
Runner se ANOTA en la vuelta (rápido, en app_settings) y se APLICA en `after()`, con presupuesto, y lo que no entra queda
para la vuelta siguiente (lib/centro-plan-auto.ts). Un candado con vencimiento evita que dos vueltas seguidas apliquen
lo mismo (no es atómico; el resto lo frena `sumarTareaAlPlan`, que mira si ya hay una abierta con ese título).

**Sumar opciones a una lista que también SORTEA cambia lo que ya se veía.** La criatura de un chat que nadie eligió sale
de su nombre con `hash % FORMAS.length`: con 9 cuerpos en vez de 7, TODOS los chats cambiaban de cara de golpe. **Regla:**
las piezas nuevas van al final y el sorteo usa las de antes (`DE_SIEMPRE`, lib/centro-munecos.ts).

**Un test de «se dibujan distintas» que no veía un cuerpo repetido.** Comparaba el SVG entero de la criatura: con el
«Diamante» cayendo al dibujo del círculo, el SVG igual cambiaba, porque los ojos y el brillo se corren con cada cuerpo.
Se compara la PIEZA sola (`Cuerpo`, `Boca`).

**Un <textarea> no tiene colores.** Para que un link se vea azul mientras se escribe, una capa debajo pinta el mismo
texto y el <textarea> se vuelve transparente, SÓLO mientras hay un link (sin links, la caja de siempre: nada que pueda
correr el cursor). Las dos tienen que tener la misma letra, el mismo renglón, el mismo padding y el mismo borde, o el
cursor cae en otra letra (en el teléfono el campo tiene 10 px 14 px y 1 px de borde: la capa, 11 px 15 px).

**El Markdown de la casa es de todos.** Los links clickeables los pidió el Ops Center: `Markdown` los dibuja sólo con
`enlaces` (opt-in), y los otros chats de MaKo quedan como estaban (tests/centro-links.test.ts lo vigila).

**La misma tanda subida dos veces creaba una tarea de más** (la revisión de la ola 1, 21/10/2026). El «Voy a trabajar
en…» que se dice con otra tarea abierta no crea otra, pero no quedaba anotado como visto. Si la vuelta no avanzaba sus
marcas (fallaron las preguntas), la PC re-subía la tanda; la abierta ya estaba cerrada por el «Ya está» de la misma tanda,
y ese «Voy a…» creaba una tarea que nadie cerraba. **Regla:** lo que se lee de una tanda tiene que dar lo mismo leído dos
veces (`saltados`), y lo que depende de que la vuelta avance va DESPUÉS de saber si avanza: el Plan se anota después de
las preguntas, sólo con `turnosOk` (lib/operaciones.ts).

**Vive en:** lib/centro-plan-auto-reglas.ts y lib/centro-plan-auto.ts · app/admin/operaciones/Avance.tsx (YaEstaMensaje,
TareasVinculadas) · lib/centro-munecos.ts · lib/links-texto.ts y app/admin/operaciones/ConLinks.tsx.

**Sin hacer:** que un chat maneje el Plan a PEDIDO de Martín («tráeme las más prioritarias», «bórralas»): necesita una puerta
de la PC al Plan, y es de revisión de seguridad. Sin medir en una pantalla real: nada de esto se miró en un navegador.

## El «atrás» lento del teléfono, WhatsApp en cada mensaje y las 0 consultas de `vigilar` (17/10/2026, cuarto Ops Center)

**El «atrás» del teléfono: lo obvio era la red, y era React.** Martín: «Cuando estoy en un chat y le doy para atrás en
mobile, tarda bastante en reaccionar». El «atrás» cierra la hoja (`SheetM` → `history.back()` → `popstate`). La primera
sospecha era Next: si el `popstate` volviera a pedir la página (`force-dynamic`) al servidor, sería un viaje entero. Leído en
Next 16.2.6 (`restore-reducer.js` → `startPPRNavigation` con `HistoryTraversal`): con el mismo árbol de rutas reusa los nodos
de la caché y NO pide nada. Lo que sí pasaba, medido:
- `ChatsM` (app/m/operaciones/ChatsMovil.tsx) calculaba el historial de CADA fila (`historialDelChat` + `vistaPrevia` +
  `enQueTrabaja`) en cada render, aunque useCentro.ts ya tenía esos mapas memorizados; y volvía a dibujar las ~90 filas con
  sus SVG al abrir, al cerrar y con CADA TECLA de la caja (el borrador vive en el motor);
- el hilo (`Hilo`) volvía a parsear el Markdown de cada respuesta en cada tecla.

**Medido** (la pantalla de VERDAD —`CentroAppMovil`— armada con esbuild contra los chats de las bitácoras del repo y una cola
del tamaño de producción —87 chats, 419 pedidos, 150 trabajos, 60 turnos en el chat abierto—, en Chrome headless como un
iPhone de 390 px con la CPU ×4; la mediana de 7 vueltas, del toque al cuadro siguiente):

| El toque | Antes (86bc162be) | Después |
|---|---|---|
| Escribir una letra en la caja | 139,4 ms | 23,3 ms |
| Abrir un chat (tareas largas) | 443,7 ms (426) | 251,9 ms (221) |
| El «atrás», hasta el cuadro siguiente | 53,6 ms | 39,5 ms |
| El «atrás», hasta ver la lista (con los 220 ms de la hoja que baja) | 309 ms | 291 ms |
| El refresco solo con un chat abierto (tareas largas en 8,5 s) | 170 ms | 132 ms |

**Lo que el número dice y lo que no:** el «atrás» en sí ya era corto en Chrome; lo que trababa al teléfono era ESCRIBIR (cada
tecla redibujaba todo), ABRIR (60 respuestas con su Markdown) y el refresco cada 2,5 s con algo en camino, que cae encima de
cualquier gesto. Abrir mejoró sobre todo por dibujar los últimos 25 mensajes («Ver mensajes anteriores», como WhatsApp y
Telegram: `TANDA_HILO`); las envolturas de WhatsApp (`Deslizable`) le sumaban ~60 ms. Si en el iPhone el «atrás» sigue
lento, lo que queda por medir es el gesto de iOS y el router de Next en un `next start`, no React.

**Regla:** en una pantalla del teléfono que se refresca sola, una fila de una lista larga es un componente `memo` con props
que no cambian entre toques (los mapas del motor, callbacks estables por ref), y lo que se calcula por chat se calcula UNA
vez en el motor. Un `historialDelChat(c, …)` adentro de un `.map` de filas es el defecto (tests/centro-whatsapp.test.ts lo
vigila).

**Cómo se mide sin `next build`** (la PC no tenía RAM ni candado para un build): un `entry.tsx` que monta el componente real,
esbuild con stubs para `server-only`, `next/link`, `next/navigation` y las acciones del servidor, y CDP sobre Chrome headless
(`Emulation.setCPUThrottlingRate`, `--mute-audio`). Antes y después: el mismo bundle desde `git stash -u`. ⚠️ El `jsdom` del
`node_modules` del clon está ROTO (le falta `@asamuzakjp/css-color`): una medición con jsdom no arranca; la de Chrome sí.

**`vigilar` con 0 consultas (cartero 1.15.1).** El Runner reportó tres `vigilar --max-seg 100` sin una consulta liviana, el
último de 78 s. La guarda de margen pedía, ANTES de cada consulta, que entrara una espera MÁS una vuelta completa ×1,5 con la
duración de la PRIMERA vuelta (la que sube los chats de cada cuenta de la carpeta: 30-80 s): el bucle no corría nunca. El
margen se mira para lo que cuesta cada cosa: consultar mientras entre una espera (la consulta corta a los 10 s y el tope deja
15 s al Bash); la vuelta completa, sólo si entra; y si llega algo NUEVO y no entra, sale con `otraVez: true` (paso 2d del
Runner). La base es la primera consulta: un pendiente que la PC no reclama no hace correr al Runner sin parar.

**`--revisar` desde Git Bash (1.15.1).** MSYS convierte todo argumento que empieza con `/` en una ruta de la carpeta de Git
(`/admin/operaciones` → `C:/Program Files/Git/admin/operaciones`), y el cierre se rechazaba. Se recupera en `cierre()`
(`rutaDesdeMsys`). NO se le pide al chat `MSYS_NO_PATHCONV=1 node …`: los chats usan también PowerShell, donde esa línea no
corre.

**WhatsApp en un chat con una IA: qué viaja y qué no.** La PC entrega SÓLO lo firmado, así que «Responder» y «Reenviar» van
en el texto (`> ↩ «CRM»: …` y `↪ Reenviado de «…»`, lib/centro-mensajes.ts) y la burbuja los vuelve a leer. Reaccionar,
Destacar, Fijar y Eliminar para mí son marcas de Martín en MaKo (`operaciones.marcas.<sesión>`): mandarle un 👍 al chat le
costaría un turno de la ventana de 5 horas. «Eliminar para todos» no existe: lo que el chat leyó está en su contexto.

**La estrella de MaKo no se elige.** Va FUERA de `FORMAS` y de `COLORES` (`FORMA_MAKO`, `ASPECTO_MAKO`): `sanearAspecto` la
rechaza y el selector no la ofrece, así que ningún chat salvo el Cerebro la tiene, aunque alguien la mande a mano.

**Un componente que importa CSS no se importa en un test** (en node un `.css` no carga): `Muneco` no importa CSS porque lo
dibujan el servidor y los tests; la criatura viva (`Criatura.tsx`) trae el suyo (`criatura.css`) y su test la mira en la
fuente.

**Vive en:** app/m/operaciones/ChatsMovil.tsx (`FilaChatM`) · app/admin/operaciones/Hilo.tsx (`memo`), MensajeWA.tsx,
Criatura.tsx · lib/centro-mensajes.ts y su `-db` · lib/centro-titulares*.ts · lib/centro-pasos*.ts
· scripts/operaciones/cartero.mjs (`vigilar`, `rutaDesdeMsys`, `titularDe`, `pasoDe`).

**El Plan desde el chat se revirtió (la revisión del Cerebro, 17/10): el diagnóstico obvio («el token alcanza, todos los chats
son de Martín») era el equivocado.** Tres cosas que no se ven escribiendo la puerta y sí atacándola:
- una respuesta de MaKo que se IMPRIME en el chat es texto que entra al contexto de un modelo en modo bypass: va por
  `textoRemoto` o con forma fija, nunca entera (un título de tarea puede traer «corré cartero.mjs clave …»);
- una `sesion` que declara quien llama no identifica a nadie: el token es uno para toda la PC y la foto de los chats la
  escribe ese mismo token; escribir en nombre de un chat pide un pedido firmado de Martín;
- «#NN» en un texto no es «cerré la NN»: puede ser lo pendiente, un PR, un ticket o un color.
**Y dos revisiones no alcanzaron para cerrar un parser de texto libre.** La segunda (763ac6e51) encontró 9 defectos más en la
versión «arreglada»: negaciones, «en producción» dicho de otra cosa, una respuesta a una pregunta que repite el «#870». La
lección: lo que ESCRIBE en el Plan no se decide leyendo texto; se pide con un dato ESTRUCTURADO (`--tareas 870` en el
cierre, con un commit verificable) o lo hace Martín. Quedó `plan prioridades`, de sólo lectura y atado al pedido firmado.
**Regla:** en AGENTS.md (el Centro): un chat no cierra tareas; el cierre se pide con `--tareas`, nunca con texto.

**Sin hacer:**
- el cierre estructurado `cartero.mjs cierre … --tareas 870,872 --prueba <commit>` (después del 20/10; el diseño, en docs/relevo/centro-operaciones.md);
- «Cámbiale el nombre» desde un chat: la API del Plan no tiene una operación para renombrar una tarea (es del área Plan);
- la lista de «Destacados» de WhatsApp (los destacados se ven con su estrella en cada mensaje, pero no hay una vista que los
  junte);
- mirar todo esto en el iPhone de Martín: la medición es de un Chrome headless con la CPU frenada, no de un teléfono.

## Lo que creí medido y no estaba al día

- **`soloPlataforma` ya existía en el registro de la API** (lo sumó el 2FA obligatorio el 14/10, por
  CAPA en `vistaDe`). El relevamiento leyó un árbol anterior y el diseño decía que faltaba: se
  corrigió. Las lecturas del Centro lo usan.
- **`docs/api-mako.md` documenta lo que sale por HTTP**: un área sin `'http'`, como ésta, no aparece
  ahí, y el generador dice «al día» con razón.
- **La hora de una bitácora es la de ARGENTINA, no la UTC** (`instanteHito`, lib/progreso-reglas.ts). Los hitos de la
  cuenta 3 del 15/10 se anotaron con la hora UTC de los mensajes (23:18 sobre un commit de las 20:18 -0300): el avance
  los ponía tres horas en el futuro. Se corrigieron; la hora sale de `git log --format=%ci`. Y la FECHA también: los
  mensajes de los chats y varios documentos del Centro dicen «16/10» para lo que en Argentina fue la noche del 15/10
  (la fecha UTC). `date` en la PC lo contesta en un comando.

## Lo que quedó sin hacer

- **El clic sin PowerShell (punta 5, 17/10)**: medido (arriba, «El clic, medido»), en construcción. Falta el caso de
  la cuenta de la app, que sólo puede PROPONER el chat.
- **Los adjuntos subidos y nunca firmados** (se cerró la pestaña entre subir y firmar) quedan en el bucket `archivero`,
  con el prefijo `operaciones/`. No hay barrido (lib/operaciones-adjuntos.ts).
- **Adjuntar texto** (txt, md, csv, un log): hoy la caja acepta sólo fotos y PDF, lo mismo que el chat con MaKo. Un
  archivo de texto no tiene firma por bytes: hay que decidir cómo se valida antes de que baje a la PC.
- **Escribirle a un chat de la nube**: hoy se ve y no tiene caja. `SendMessage` llega a las sesiones de la nube (lo
  dice `ListAgents`), así que el Runner de la app podría entregarles. Sin medir.
- **La forma de una fila de `list_sessions` para un chat de la nube**: medirla con el primero que haya.
- **En el Second Brain (17/10) no están la Ticketera entera, los Runners con el Uso ni el «Nuevo chat» de Claude Code**:
  siguen en /admin/operaciones. Cada chat sí muestra su pregunta arriba de la caja, y la caja ofrece crear y copiar el
  Token. Si Martín los pide ahí, entran por la barra de `ChatSecondBrain.tsx` con `TicketeraCentro`, `BotonUso` y
  `NuevoChat`, montados sobre el mismo `useCentro`.
- ~~El chat «Cartero» con su cron~~: corre desde el 15/10 en la cuenta 3 («pasó hace 41 s») y la PC acepta un Token
  (`cartero.mjs estado`, 15/10). Falta que Martín lo renombre a «Runner» (la línea, en docs/relevo/centro-operaciones.md).
- ~~**La Ticketera no muestra si el aviso llegó**~~: hecho el 17/10. La bandeja de los tickets dibuja `avisado_at` (al cliente) y
  `aviso_estado` (al Cerebro) en un bloque «Avisos», y el mazo viejo dice en cada contestada si el aviso llegó al chat. Medido
  antes: ninguna de las dos pantallas los leía. Ver docs/hallazgos-ticketera.md → «La Ticketera no mostraba si el aviso llegó».
- **Fase 2 del aviso**: firmar la respuesta al contestar, para que el aviso la lleve adentro.
- **El chat Runner en cada cuenta que esté corriendo** (15/10): sin él, lo que se escribe en la caja queda «escrito».
  Sus instrucciones se copian desde el Centro (Runners → Nuevo Runner; viven en `lib/runner.ts`). Y el Token de cada
  dispositivo, pegado en el Runner.
- ~~Los textos de Avance y Pushes~~: las dos vistas se fueron en la punta 2 (el avance está en cada chat).
- **Abrir el Runner de cada cuenta en su terminal** (lo hace Martín: `claude2 -n Runner` en PowerShell y pegarle las
  instrucciones; los pasos en docs/relevo/centro-operaciones.md). Desde la 1.4.0 (16/10) una cuenta tiene varias fuentes
  (la app y su terminal), la PC ya las tiene declaradas, y `SendMessage` está medido: no cruza carpetas.
- ~~Implementar el rediseño de `docs/prototipos/centro-operaciones.html`~~: lo reemplazó el de punta a punta del 16/10.
- **Dos ideas de Sintra y Grok Bot que no se hicieron** (16/10): una caja de pedido GENERAL arriba del equipo («¿Qué
  necesitás hoy?», con un «Para:» que elige al empleado, como el de Grok Bot) y chips con contadores («3 te esperan»).
  Hoy se le escribe a un empleado desde su conversación, y el globito ya cuenta lo que espera.
- **Progreso con lo que está en la PC**: los chats abiertos y lo escrito sin subir llegan con el cartero
  (sube sus chats en cada vuelta); hoy Pedidos y Áreas sólo ven lo desplegado.
  ⚠️ **Lo «sin subir» se cuenta con `git cherry`, no con «ahead N»:** el 15/10 el coordinador midió un clon
  con 17 commits «por delante» de main y 16 ya estaban en main (copias de un rebase); uno solo era real.
  Contado con `ahead`, la pantalla mostraría como pendiente trabajo que ya está subido.
- **El push de cada pedido terminado**: con el token de GitHub, `compare/<commit>...<deploy>` los une a todos;
  hoy la fila dice «En producción» sin nombrarlo (por la hora acertaba 110 de 202; por la punta, 0 de 88).
- **El token de GitHub de la plataforma (404 desde la transferencia)**: sin él no hay commits por push ni
  cierre de tareas del Plan por commits. El repo cableado al owner viejo ya se arregló (dcad6ddd2); falta
  que Martín le dé al token acceso a `hola-mako/dashboard-marketing`.
- **Las cuentas de terminal**: logueadas las tres (Martín, 16/10: «Listo las 3 cuentas»); falta su marcador por
  directorio y sus hooks, y abrir el Runner en cada una.
- **La opción C** (un hook con `asyncRewake` en la carpeta del Cartero, que lo despierta sin gastar
  turnos): documentado que despierta a una sesión ociosa; no probado con `Stop`. Necesita el OK de
  Martín porque es configuración.
- **El teléfono, para MANDAR**: desde el 16/10 la caja también está en `/m/operaciones` (por `mandar.ts`), con la clave
  DEL teléfono, que la PC tiene que aceptar aparte. Falta verlo en su iPhone de verdad (el teclado sobre la hoja).
- **Etapa 2 (la cuota)** y **etapa 3 (el señalador)**.
- **Proponer un pedido desde un chat de MaKo** con `confirmacion: 'pantalla'` (se firma en la pantalla):
  no está en el registro.

## El Uso de la cuenta 1 mostraba los números de la cuenta 4 (17/10/2026)

**Síntoma:** a las 17:48, Martín ve en Claude que la cuenta de Mauricio (claude1) va 97% en la semanal y se restablece
el miércoles. El Centro decía 33% y «el martes».

**Causa:** `cartero medir` 1.14.2 escribía en `uso/<cuenta>.json` la cuenta de la configuración, no la que estaba
activa. A las 09:26 guardó los números de la cuenta 4, que era la del Runner (get_usage), en `claude1.json`. La 1.14.3
arregló el código, pero nadie corrigió el archivo que ya estaba mal. Como la cuenta 1 no tiene Runner, nadie la volvió a
medir: el dato malo quedó como vigente ocho horas. El diagnóstico obvio («toma la info de otra cuenta en cada medición»)
era a medias: el código ya estaba bien y el problema era el dato viejo que había quedado.

**Arreglo:** se reescribió `claude1.json` con la captura de Martín. El original está en `claude1.json.mal-17-10`.
El Ops Center 5 suma «medido hace X» y apaga una medición vieja: desde las 6 horas (`USO_VENCIDO_MS`, lib/centro-uso.ts) la
cuenta dice «Sin medir hace X», su barra se apaga y el número del botón no la usa (sin otra cuenta al día, «—»). Una cuenta
sin Runner y con número dice «Sin Runner · se mide a mano».

**Regla:** cuando se arregla un error que ESCRIBE datos, en el mismo trabajo se buscan y corrigen los datos que ya
escribió. Un dato sin fecha a la vista que nadie vuelve a medir se lee como vigente.

**Segunda vez, 20/10/2026.** Martín: «El uso quedó mal en Mauricio... Que no vuelva a pasar nunca más». Un chat puso
`~/.claude/cuenta-activa.txt` en claude1 durante unos minutos, con la app en la cuenta 4. A las 20:14 UTC el Runner midió con
get_usage y `medir` anotó en `uso/claude1.json` la semana de la 4: 6% y 2%, con reinicio el 2026-10-27T20:00:00.496Z. Se
subió a `operaciones_carteros`. El arreglo del 17/10 era el correcto (usar el marcador), pero el marcador MISMO puede estar
mal, y nada lo contrastaba. Datos corregidos por el Cerebro: `uso/claude1.json.mal-20-10`, y la fila claude1 con
`cuota=null`. **El arreglo de fondo es la huella de la semana:** cada cuenta reinicia su semana siempre a la misma hora, así
que el reinicio dice de quién es una medición. `cuotaDe` ya la usaba para la línea de uso-semanal.txt, pero `medir` no.
- Desde el cartero 1.16.1 (`problemaDeHuella`), `medir` no escribe nada si el reinicio coincide (±5 min) con el de OTRA
  cuenta vigente; el error la nombra: «no anoté la cuota: es de claude4, no de claude1 (el marcador está mal)».
- Tampoco escribe si mueve la semana de ESTA cuenta antes de que venza, salvo con `--renovada`, para cuando Martín dice que
  esa cuenta se renovó.
- MaKo hace lo mismo en `cicloCartero` (`cuentaDeLaSemana`, lib/centro-uso.ts), y así frena también a un cartero viejo.

**Regla:** un dato que se anota a nombre de alguien se contrasta con una huella propia de ese alguien (acá, la hora de su
reinicio). El marcador de cuenta es un dato más, y puede estar mal.
**Los límites que quedan** (revisión del Cerebro, 20/10, antes de subirlo):
- **Dos cuentas reales cuya semana reinicia con menos de 5 min de diferencia chocan siempre:** cada una rechaza a la otra, semana tras semana. Hoy no pasa: las conocidas reinician en días y horas distintos. Si pasa, el error lo dice en cada vuelta del Runner, y se resuelve achicando `MISMA_SEMANA_MS`, porque la API varía ~1 s.
- **Una cuenta RENOVADA queda sin medir hasta que alguien pase `--renovada`** (B). La renovación la avisa Martín, y el Cerebro corre `medir --renovada`. Mientras tanto, la tarjeta envejece a «Sin medir hace X», que es lo seguro.
- **Del lado de MaKo, una fila MALA que ya entró bloquea a la buena:** `cuentaDeLaSemana` le cree a la fila que llegó primero. Si vuelve a pasar, se limpia la fila mala (`cuota=null`), como la del 20/10.
- **Sólo con la ventana de 5 h** (sin semana) no hay huella: `medir` la anota a nombre del marcador. El Runner manda siempre las dos.

## El Uso escondía el 99% de Leandro 2: la medición no se borraba, la apagaba la pantalla (22/10/2026)

**Síntoma.** Martín, con una captura: «Cuando no mide hace mucho tiempo no debería desaparecer los % de uso que tenía la
última vez... el caso de Leandro 2, esa cuenta ya estaba al 99% semanal, y ahora ya no aparece... no puedo ver qué cuentas
ya no me queda espacio». La tarjeta de claude4 decía «Sin medir hace 14 h» con las dos barras vacías.

**El diagnóstico obvio era el equivocado.** «Se pisa o se borra la medición vieja» no pasaba: a las 14:47 UTC la fila de
claude4 en `operaciones_carteros` tenía su cuota entera (5 h: 11%, reinicio 01:59 UTC; semana: 99%, reinicio 27/10 19:59 UTC;
medida a las 00:44 UTC). `cicloCartero` sólo escribe la cuota cuando llega una nueva. La escondía la PANTALLA, por la regla
del 17/10 (entrada de arriba): pasadas 6 h (`USO_VENCIDO_MS`), `Barra` dibujaba ancho 0 y «Sin medir hace X». La cuenta 1 sí
tiene `cuota=null`, pero porque el Cerebro limpió a mano la fila mala del 20/10, no por el código.

**Arreglo** (lib/centro-uso.ts, Uso.tsx): `UsoVentana.ultimo` es lo que dijo la última medición, haya pasado o no el reinicio.
La tarjeta siempre lo dibuja con su barra. Lo que cambia con la edad es CÓMO se dice:
- al día: «47% usado» y abajo «Medido hace 2 min», como siempre;
- vieja (más de 30 min): «99% · medido hace 14 h», en gris, sin «usado», con la barra de su color pero más tenue;
- ya reiniciada: el último número en gris, la barra apagada y «Se reinició ayer a las 22:59 (sin medir desde entonces)».
Hubo también un chip «Sin lugar» para la semana al 90% o más; se fue el mismo día (Martín: «No pongas el chip de "Sin
lugar", no necesito eso»). La semana llena se ve por su número y su barra roja, que ya no se esconden.

**Regla:** un número que se DIBUJA no se esconde por viejo: se dice su edad. Lo que DECIDE con él (el botón, «Automático»,
`libreDe`) sigue leyendo `pct`, que es null pasado el reinicio, y `vencido`. Así lo del 17/10 (no leer un dato viejo como de
ahora) se cumple igual, sin esconder el dato. Lo fija tests/centro-uso-ultimo.test.ts, que usa la fila de producción tal cual.

## La API en el Uso: el crédito de cada plan Max, desde lo que MaKo registra (22/10/2026)

**El pedido.** Martín: «En USO de SuperAdmin quiero ver también el USO de la API, que como tenemos 4 cuentas de Claude x20,
deberían ser 800 usd al mes...». Debajo de las cuentas del desplegable del Uso (y en la hoja «Uso y Runners» del teléfono)
está la sección «API»: arriba «US$0,25 de US$800 este mes», y por cuenta lo gastado de sus US$200, lo que queda, cuándo se
renueva, o «Falta vincular» con lo que hay que hacer. Qué deja leer Anthropic y por qué el número sale del registro de MaKo,
en docs/hallazgos-ia.md («Qué deja leer Anthropic del crédito de los planes Max»).

**El total con un hueco (revisión del 22/10/2026):** con la clave de una cuenta sin leer («No pude leerlo»), el total de
arriba salía igual, sin lo de esa cuenta. Ahora `totalCredito` da null si de alguna cuenta no se sabe si está vinculada.

**Vive en:** lib/credito-api.ts (las reglas, puro) · lib/credito-api-db.ts (la lectura) · `creditoApiAction` (acciones.ts,
con la guarda de siempre) · app/admin/operaciones/UsoCredito.tsx · tests/credito-api.test.ts.

**Trampas que se cazaron al escribirlo:**
- **La función que lee llega NUEVA en cada redibujo.** `useCentro` no memoriza sus funciones y el Centro se refresca cada
  pocos segundos: con `[leer]` como dependencia del efecto, la sección pediría la lectura del registro en cada refresco. Se
  pide UNA vez al abrir, con la función del primer dibujo en una ref (el test lo fija).
- **Los tests del Uso parten el HTML por `<section`** para leer cada cuenta: la sección de la API es un `div role="group"`.
  Si fuera una `<section>`, se leería como una quinta cuenta.
- **La pantalla no importa nada del servidor**: lib/credito-api.ts importa lib/veto-claude.ts (la marca del crédito), así que
  la pantalla toma de ahí sólo los TIPOS. El total llega armado del servidor.

**Lo que quedó SIN hacer:**
- **El día de cobro de cada plan** no se sabe. El crédito llega con cada cobro del plan, no el 1 del mes. Hoy se mide el mes
  calendario de Argentina y la fila dice «se renueva con el cobro del plan». Con el día cargado en `CUENTAS_DEL_CREDITO`
  (lib/credito-api.ts, `diaDeCobro`), la fila dice la fecha y cuenta de cobro a cobro (ya probado).
- **Las cuentas 3 y 4 no tienen el crédito vinculado** (no hay ANTHROPIC_CREDITO_CUENTA3/4 ni en el `.env.local` ni en la
  fila del ws9). La 4 puede recién desde el 23/10 (7 días de suscripta).
- **`scripts/credito-claude-a-plataforma.mts` guarda sólo las claves de `CLAVES_CREDITO_PLATAFORMA` (la 1 y la 2)**, y el
  onboarding usa sólo esas. Que use también la 3 y la 4 es una decisión de Martín («Yo debo decirte cuando utilizar
  créditos»). Mientras tanto, si se carga su clave, la sección las ve vinculadas y con US$0 gastado.

## El menú que se cerraba solo, las fotos que no se veían y lo demás de WhatsApp (17/10/2026, quinto Ops Center)

**El menú de un mensaje se cerraba solo: no era un redibujo, era Android.** Martín: «al mantener apretado un mensaje, el
menú se cierra solo enseguida». Lo obvio era que el refresco (cada 2,5 s) desmontara el menú. Su captura es de un ANDROID
(Samsung), no del iPhone que decía el relevo: Android dispara su propio `contextmenu` al mantener apretado, unos ms DESPUÉS
de los 450 ms en que se abre el menú, y el menú de la casa (MenuContextual) se cierra con cualquier `contextmenu` afuera
(su regla del clic derecho), con `resize` (el teclado que se cierra) y con `blur`. **Regla:** lo que se abre manteniendo
apretado va en la hoja de WhatsApp (`HojaMensajeWA`, MensajeWA.tsx), que sólo cierra un toque que EMPIEZA con ella abierta,
Escape, el «atrás» o elegir algo; levantar el dedo que la abrió no elige nada. Está en AGENTS.md (el Centro).

**La foto adjunta no se veía en la burbuja: no era la URL firmada ni el mensaje optimista.** La burbuja nunca dibujó
imágenes: el trabajo guarda sólo los NOMBRES y el bucket BORRA el binario cuando la PC lo baja (es la protección del canal,
lib/operaciones-adjuntos.ts). No hay de dónde firmar una URL después de entregado. Se resolvió del lado del navegador que la
mandó: el original en memoria y una miniatura de 640 px en IndexedDB (`enviado:<id>`, fotos-enviadas.ts). En otro
dispositivo se ve el nombre, como un documento de WhatsApp.

**Las listas numeradas de Martín se renumeraban.** Un `<ol>` numera desde 1, y con un renglón en el medio cada tramo vuelve a
1. La burbuja dibuja la marca que escribió (`marcas` en `bloquesDeMensaje`, lib/centro-caja.ts).

**«Uso y Runners» no scrolleaba hasta el final en el teléfono: era la hoja, no la lista.** SheetM mide el cuerpo con el alto
de «alto» y en «medio» lo corre hacia abajo: lo último queda DEBAJO de la pantalla aunque se scrollee hasta el fondo. Esa hoja
abre ahora en «alto»; el defecto es de todas las hojas que abren en «medio» con cuerpo largo (docs/hallazgos-mobile.md).

**El «atrás» cierra la capa de arriba con la MISMA URL.** Una entrada más en el historial con la URL de ahora (con su `?sheet=`):
SheetM ve su parámetro y no se cierra; el visor o la hoja del mensaje sí (`useAtrasCierra`, atras.ts). Y en un portal: dentro de
la hoja del teléfono (que se mueve con `transform`) un `position: fixed` queda encerrado en ella.

**Lo que se dibuja dentro del hilo no importa CSS, y el motor no importa valores de un `'use client'`.** El hilo se dibuja en los
tests (en node un `.css` no carga): el visor salió de AdjuntosCaja.tsx (que trae chat.css) a Visor.tsx, y pegar a pegar.ts. Y
useCentro.ts no lleva `'use client'`: lo que llama de las fotos vive en fotos-enviadas.ts (tests/frontera-use-client.test.ts lo
cazó en `antes-de-subir`, no el tsc acotado).

**Vive en:** app/admin/operaciones/MensajeWA.tsx (`HojaMensajeWA`), atras.ts, Visor.tsx, FotosEnviadas.tsx y fotos-enviadas.ts,
Microfono.tsx (`BotonMandar`), Emojis.tsx, MiFoto.tsx, pegar.ts · lib/centro-chats.ts (`avisaYaEsta`, `segundoRenglon`) ·
lib/centro-uso.ts (`USO_VENCIDO_MS`) · tests/centro-ops5.test.ts.

**Sin hacer:**
- ~~la foto enviada en OTRO dispositivo (hoy, su nombre)~~ HECHO el 23/10: la decisión ya la había tomado Martín el 18/10
  (arriba, «La foto que se manda por la caja, vista en otro dispositivo»);
- ~~las miniaturas `enviado:*` de IndexedDB no se barren nunca~~ HECHO el 23/10: ya no se escriben, y las de antes se barren;
- el aviso de «Completado» sin ver es por dispositivo (localStorage), no viaja al teléfono (useCentro.ts → `vistos`);
- SheetM en «medio» con un cuerpo largo, para todas las hojas (app/m/_ui/SheetM.tsx);
- nada de esto se vio en una pantalla real: ni la hoja del mensaje en el Android de Martín, ni los globos, ni los emojis.


## «Second Brain» no se saca de la barra para todos, el Uso se contradecía y el Runner volvió a esconderse (17/10/2026, sexto Ops Center)

Nueve pedidos de Martín al mirar el Ops Center en su Android (19:31 a 19:45). Lo que no era obvio:

**Sacar «Second Brain» de `nav.ts` habría dejado a los clientes sin su chat con MaKo.** El pedido dice «elimina la de second
brain», pero la entrada `mako` es la puerta del chat de CADA cliente, closer y setter incluidos; el Ops Center no existe para ellos
(`puedeOperar` es del super admin con su workspace). Lo que sobra es la fila del SUPER ADMIN. Por eso `ARRIBA` sigue entera y quien
decide es `arribaDe(adminShell, puedeVer)` (nav.ts), que usan la barra (Sidebar.tsx) y, con la misma regla, More del teléfono
(`masCompleto`). El super admin MIRANDO a un cliente (`adminShell` falso) sigue viendo el Second Brain del cliente. El redirect de
`/second-brain` usa `quienOpera()`, que pide su propio workspace: mirando a un cliente no redirige. **Regla:** «sacá esta entrada» se
resuelve por QUIÉN la ve, no borrando el ítem; el guardián (`tests/movil-toda-tab.test.ts`) ahora también recorre lo de arriba.

**El Uso se contradecía porque dos renglones salían de dos estados distintos.** «Runner activo» sale de `estadoRunnerUso` y «Su uso
aparece cuando su Runner esté conectado» estaba escrito a mano para «sin medición». Un Runner conectado puede no tener medición
todavía (la cuenta de la app sólo trae la semanal, y una medición nueva tarda una vuelta). **Regla:** el texto de «vacío» de una
pieza se deriva del mismo estado que el renglón de al lado (`textoSinMedicion(vivo)`), nunca se escribe aparte.

**El Runner estaba en la lista a propósito (17/10, «todo chat abierto se ve») y Martín lo desdijo.** Se saca en la PANTALLA
(`sinElRunner`, useCentro.ts), no en `completarChats`: la PC lo sube marcado `esRunner` y de esa marca sale que no se le entrega
nada (tests/centro-runner-nube.test.ts); sacarlo antes le quitaría al guard lo que lo protege. Por nombre sólo el exacto
(«Runner», «Cartero», «Centro de Operaciones › Runner»): «Offer › Runner de pruebas» es un sub-chat de Offer.

**Un «Completado» sin ver ahora avisa como «Espera tu respuesta».** Eran dos avisos distintos (globito verde a la derecha y hora en
verde, contra renglón naranja y globito en la criatura). Pasó a uno: `segundoRenglon(…, sinVer)` devuelve `revisar` (mismo estilo
que `espera`) y `avisosDe` suma uno al globito de la criatura y al orden de la lista (lo que espera a Martín va arriba). Se apaga
al abrir el chat (`avisaYaEsta`, por dispositivo, igual que antes).

**La cabecera.** La criatura queda a la izquierda del título; tocarla la cambia y tocar el nombre lo renombra EN EL LUGAR (Enter
guarda, Escape y salir del campo lo dejan como estaba: salir NO guarda, porque un renombre manda un trabajo firmado a cada sesión).
Computadora y teléfono comparten `renombrarChat` (useCentro.ts). El título de `SheetM` pasó de `string` a `ReactNode`. «Tu foto de
perfil» salió del chat (no vuelve: se cambia en Tu cuenta) y con ella `achicarImagen`/`ponerMiFoto` del teléfono.

**El logo de Claude** era un dibujo de doce rayos. `react-icons` (ya dependencia) trae el de simple-icons: se embebió su ruta y
`tests/centro-ops6.test.ts` la compara con `SiClaude`, así que una ruta tocada a mano falla.

**«Trabajando…» se despliega** (Trabajando.tsx, una pieza para todos los chats): cerrado, el paso de ahora; abierto, los de antes
tildados y el de ahora animado. Muestra lo que YA sube la PC: el nombre de la herramienta y la frase del Bash (lib/centro-pasos.ts).
⚠️ NO es el texto del razonamiento de Claude: subirlo pide revisar qué viaja a MaKo (relevo, después del 20/10).

**Vive en:** app/_components/nav.ts (`arribaDe`) · lib/ops-center-ruta.ts · lib/centro-chats.ts (`segundoRenglon`, `avisosDe`,
`sinElRunner`) · app/admin/operaciones/{Trabajando,Uso,Conversacion,PiezasCentro,useCentro,TicketeraCentro}.tsx ·
app/m/operaciones/ChatsMovil.tsx · tests/centro-ops6.test.ts.

**Sin hacer:**
- el mazo y la lista de «Preguntas de los chats» ya no los dibuja nadie, pero sus archivos siguen (app/tickets/decisiones/Mazo.tsx,
  app/admin/runway/Tablero.tsx, sus rutas-puerta y tests): borrarlos es otra tanda;
- el razonamiento real (texto) de un chat en «Trabajando…»: ⚠️ después del 20/10, con revisión de qué viaja;
- nada de esto se vio en el Android de Martín: tests y tipos, no pantalla.

---

## Un «Completado» con «…»: el título de la FILA usado donde iba el texto (17/10/2026, séptimo Ops Center)

Martín: «los mensajes de "Completado" tienen 3 puntos al final y no llego a leer todo, esos son los mensajes más importantes».

**El diagnóstico obvio era el equivocado.** Parecía un `line-clamp` o un `text-overflow` del CSS de la tarjeta; no había ninguno en
`.co-ya`. Era el dato: `YaEstaMensaje` dibujaba como título `n.titulo`, el de la FILA de las listas (`tituloDeTexto`: el primer
renglón cortado a 72 caracteres y «…»), y como cuerpo todo lo que venía DESPUÉS del primer renglón. Lo que pasaba de los 72
caracteres de ese renglón no se dibujaba en ningún lado, y los chats escriben ahí su resumen. **Regla:** un título hecho para una
lista no se reutiliza donde va el texto; la tarjeta usa `partesDeYaEsta` (lib/centro-chats.ts): el renglón entero, como título si
cabe en 110 caracteres y, si no, como primer párrafo. Un cuerpo de más de 1500 caracteres pliega sólo su detalle y deja a la vista
la cola (`partirPendiente`: desde «Sigue», «Pendiente», «Falta» o «Prueba»; sin esas marcas, el último párrafo).

**Los cortes que quedan, y son silenciosos** (sin «…»; cortan justo la cola, que es lo último que se escribe):
- la PC sube hasta 4000 caracteres por turno (scripts/operaciones/cartero.mjs, `TOPE_TURNO`); la tarjeta ahora lo dice
  («Cortado a los 4000 caracteres»), pero subir el tope es del cartero (sin tocar acá);
- el cierre estructurado (`cierre --hecho … --sigue …`) corta cada campo a 600 en la PC y en `sanearCierres`; y la tarjeta de ese
  cierre dibujaba `hecho || decidido`: con `hecho`, lo «decidido» no se veía nunca (ahora sí).

**La caja.** Antes el «+» medía 34 (teléfono) con borde, la carita 36×42, el campo 42 y mandar 42, todo alineado abajo: la altura
del «+» era la única que no era la del renglón. En la computadora el campo se centraba (`align-self: center`) y medía 36 contra 40
de los botones. Ahora UNA medida (`--caja-toque`: 40 mouse, 44 dedo y teléfono) y el campo de un renglón mide lo mismo. Medido en
Chrome con el CSS real: los cuatro comparten centro y borde de abajo con 1, 2 y 4 renglones, y el centro del último renglón cae
en el de los botones. ⚠️ La capa de links de la computadora (`.co-caja__resalte`) no tenía el relleno del textarea (6 px de
diferencia): la capa y el campo comparten ahora UNA regla; si se toca el relleno o el renglón de uno, se toca el otro.

**El ícono.** La estrella se pide con `estrella` (Criatura.tsx), no por el nombre: «solo el Cerebro» es regla de `aspectoDe`, y
sumar «Ops Center» a esa lista habría vuelto estrella a todo chat con ese nombre. «Nuevo chat» es `CirculoNuevo` (verde, con «+»):
el muñeco gris era el de un chat que existe.

**El aviso del «Completado» no salía en ningún chat que no se hubiera abierto (17/10, 21:30).** Medido con los turnos reales (61
chats en `operaciones.turnos.*`, 0,9 MB): hoy sólo 4 chats terminaron con un «Ya está» (los demás cierran en prosa: «Terminé el
feedback del CRM…», que no es un «Completado» para la pantalla). Pero `avisaYaEsta` miraba `vistaPrevia(lineasDe)` y `lineasDe` se
armaba con `turnos[c.clave]`, y esos turnos viajan SÓLO del chat que se mira (`pedirTurnos`): la fila de uno cerrado no sabía su
último mensaje. El diagnóstico probable (el estado por dispositivo, o que sólo cuente los de después del deploy) no era: `desde`
sólo descarta lo anterior a la primera apertura. **Regla:** un aviso por chat sale de lo que trae el refresco de TODOS
(`leerUltimosTurnos`: los 3 últimos turnos de los últimos 3 días, recortados a 300 caracteres, con caché por `updated_at` para no
releer 0,9 MB cada 8 s), nunca de la conversación abierta; y ese texto cortado no se dibuja como conversación
(`turnosParaLaLista` lo niega para el chat que se mira).

**«MaKo en WhatsApp» (el vigía):** 44 de sus 60 turnos son «Sin incidentes nuevos.» (un cron cada 15 min). Se esconde de la lista
mientras su último turno es ése (`vigiaCallado`), no borrándolo: es el chat jefe de la vigilancia, y un incidente de verdad lo hace
volver y avisar como «Espera tu respuesta» (`incidenteSinVer` suma una espera). El chat que se está mirando no se esconde.

**«Runner conectado, todavía sin medir» era falso, y MaKo no puede pedirle la medición a ese Runner porque no existe.** Datos
reales: la cuenta 2 no tiene ningún chat Runner (28 chats, 1 sesión viva suelta, `cuota: null`); la 1 y la 3 no tienen sesiones
vivas; sólo el Runner de la cuenta 4, que corre con el paso 0b, mide (0 % de 5 h, 78 % de la semana, hace segundos). «Conectado» era
`visto_at` fresco, y lo mantiene el Runner de la app, que da la vuelta por las cuatro carpetas. Lo que mide el Uso es la barra de
estado de SU Runner de terminal (`--settings`, `cartero.mjs uso`) o `get_usage` de la app, y `get_usage` sólo habla de la cuenta
de la app. Un trabajo firmado «medí tu uso» no tiene a quién llegar (y el cartero rechaza todo trabajo al Runner: «Al Runner no se
le escribe»). Se cambió el texto por lo cierto («Sin medir: su terminal no tiene Runner abierto»). Medir solo exige abrir el Runner
de esa cuenta con su barra de estado: un «Nuevo chat» firmado con nombre «Runner» y `--settings` (cartero `abrir`, ⚠️ pide
revisión: lanza un proceso) sería el camino; no se tocó.

**«Trabajando…» no salía (22:40).** Medido con la PC viva: el estado ocupado de cada chat llega a MaKo con la vuelta del Runner, cada
~2 minutos (`operaciones_carteros.visto_at` no se movió en 4 minutos de muestreo), y los pasos en vivo llegan cada ~15 s, sólo de los
chats ocupados. Un chat que empezó después de la última vuelta no decía nada y uno que ya terminó seguía diciendo «Trabajando…». La
cadena de la pantalla estaba bien (con el estado cierto, el Cerebro real dibuja «Trabajando…»). **Regla:** un chat con pasos de hace
segundos ES un chat ocupado (`completarChats`, 1b). Queda: uno que piensa sin haber usado herramientas todavía espera a la vuelta;
el arreglo de raíz es que `vigilar` suba el estado en cada pasada (cartero, ⚠️ REVISAR; no se tocó).

**El grafo no se iba al tocar un chat (22:40) — SIN VERIFICAR EN EL NAVEGADOR.** Hipótesis por el código: el efecto de la URL
(`anotarEnUrl`) reescribía con `replaceState` antes de que terminara el `router.push`, y Next quedaba otra vez en `?panel=mapa&centro=…`
(el mismo choque `replaceState` + router de docs/hallazgos-second-brain.md). Con el grafo abierto no se anota la URL. Si Martín lo
vuelve a ver, el siguiente paso es medirlo en el navegador (CDP).

**Dormido, y el formato (22:40).** Un chat abierto que no trabaja ni espera nada ya no es «despierto» (`animoDe(c, avisos)`). El
Markdown de los chats mostraba crudo todo lo que el parser no sabía (listas numeradas, `código`, cursiva, títulos de 4 almohadillas,
tablas): se sumó, sin tocar lo de antes. Dos trampas que salieron al probar con texto real: el prefijo «Ya está» se comía el `**` que
abría el título («Ya está: **el filtro**» quedaba «el filtro**»), y un link entre paréntesis («(ver https://x.com/a).») se llevaba el «)».
Una cursiva sólo vale si el `*` abre una palabra: «lib/*.ts y app/*.tsx» no es una cursiva.

**«Nuevo chat» sin modal (23:00).** Martín: un modal para crear un chat es «contra IA». Ahora abre un chat vacío con su caja y con el primer
mensaje la IA barata de la plataforma (chatCheap, es texto de Martín y no datos de clientes: el Plan nunca paga IA) decide si va a un
chat que ya existe, a un empleado nuevo o a un jefe nuevo, y el nombre. **Lo que cuesta si se hace mal:** (1) lo que contesta el modelo
NO puede llegar a un trabajo firmado sin validar: el nombre pasa por la lista blanca de la PC (`NOMBRE_NUEVO_RE`, que rechaza hasta
un «¿» o un emoji), y un «jefe» o un «empleado» que ya existen tienen que volverse «existente» o se crean chats repetidos; (2) el Cerebro
y el Runner no pueden ser destino de un tema nuevo; (3) sin IA, con una respuesta que no es JSON o con una que no vale, decide la regla
(el jefe que el mensaje nombra, el más largo gana), porque nunca se le pregunta nada. Sale a los 4 segundos por el camino de siempre
(`abrirChat` o `mandarTextoA`, firmados) y la cuenta la elige MaKo (la que puede abrir y menos gastó en la semana). Las piezas que se
dibujan van aparte del motor (ChatNuevoPiezas.tsx) para poder probarlas: el motor importa la acción del servidor.

**Vive en:** lib/centro-chats.ts (`partesDeYaEsta`, `partirPendiente`, `cortadoPorLaPC`) · app/admin/operaciones/{Avance,Hilo,NuevoChat}.tsx
· centro.css (`.co-ya__*`, `.co-caja__fila`, `--caja-toque`) · app/m/operaciones/operaciones.css · app/_components/{Criatura,Sidebar}.tsx
· app/m/mas/page.tsx · lib/{operaciones-reglas,centro-turnos-db}.ts (`resumirTurnos`, `leerUltimosTurnos`) · app/admin/operaciones/{useCentro,acciones,datos,Uso,Muneco}.ts(x) · app/_components/Markdown.tsx · lib/links-texto.ts · app/second-brain/ChatSecondBrain.tsx · lib/centro-chat-nuevo.ts · app/admin/operaciones/{ChatNuevo,ChatNuevoPiezas}.tsx · tests/centro-ops7.test.ts · tests/centro-nuevo-chat.test.ts.

**Sin hacer:** nada se vio en el Android de Martín (medido en Chrome de escritorio con el CSS real, y tests); el tope de 4000 / 600
del cartero; `nav.ts` no se tocó (el Sidebar compara con `OPS_CENTER.key`); la medición automática de una cuenta sin Runner (arriba).

## Los pedidos del Ops Center a chats en modo «auto» quedaban RETENIDOS (18/10/2026)

- **Síntoma:** Martín le mandó a Onboarding un pedido de 13 puntos desde el Ops Center y «no hizo nada». El Runner lo entregó, pero el chat lo retuvo esperando aprobación. Martín lo veía como ignorado.
- **Causa:** el Runner corre en `bypassPermissions` y la mayoría de los chats en `auto`. La app retiene los mensajes que llegan de una sesión en otro modo, salvo que vengan de la sesión que abrió ese chat (el Cerebro). Subir un chat a bypass no se puede si no se lanzó con `--dangerously-skip-permissions`.
- **Regla:**
  - Un envío del Runner que queda retenido se le pasa ENTERO al Cerebro («REENVIAR A <sesión>: …»). El Cerebro se lo reenvía a ese chat, como su padre, y ahí sí entra.
  - Un chat nuevo se abre desde el Cerebro o en el mismo modo que el Runner.
- **Chats en `auto` al 18/10:** Onboarding, Ops Center 3, CRM, Ticketera, Dashboard, Second Brain, MaKo Alert, Automations, Infra, Pagos y AI Avatar.

## Un solo chat: la caja del Ops Center como UNA pieza (20/10/2026)

- **Síntoma:** Martín: «Te pedí que unificaras el chat del Ops Center en todos lados, su diseño y funcionalidades... Y en el
  onboarding y en otros lugares el chat sigue siendo diferente». La regla era del 18/10 y había quedado «después del 20/10».
- **Causa:** no había una pieza para reusar. La caja del Ops Center vivía como JSX en línea en DOS archivos
  (Conversacion.tsx y ChatsMovil.tsx). Cada pantalla de MaKo armó la suya (un <textarea>, `ComposerWhatsApp`, `ChatHilo`), y
  el Ops Center de los clientes (ChatSecondBrain.tsx) tenía otra, con otro orden y sin el «+».
- **Lo obvio era el error:** «copiar el composer del Ops Center». El onboarding lo hizo (rama onboarding-v3) y quedó una
  TERCERA copia. Lo que unifica es una pieza y una guarda que impida la copia.
- **El arreglo:**
  - `app/_chat/CajaChat.tsx`, con todo lo de la caja del Ops Center. Lo de cada pantalla va por props: a quién, qué se manda,
    qué va arriba (la cita, el texto largo pegado), qué va en el «+», qué acepta «Documento» (`accept`) y si Enter manda.
  - Arrastrar y soltar sigue siendo de la PANTALLA, porque la zona es la conversación entera.
  - La usan el Ops Center (computadora y teléfono) y el Ops Center de los clientes en la computadora.
- **La trampa de la guarda:** buscar «mako» en el código es inútil (95 archivos con un campo de texto lo nombran). Sirve
  «dibuja `HiloMako`, le habla a /api/mako/chat o /api/m/mako, o su caja le escribe "a MaKo"», más una caja propia. Así
  encontró `app/whatsapp/WhatsAppAdvisor.tsx` («Pregúntale a MaKo…»), que el inventario del 20/10 no tenía.
- **Regla:** en AGENTS.md («UNA SOLA CAJA PARA HABLAR CON MaKo»). tests/chat-unico.test.ts lleva la lista de lo que falta, y
  una migración que no saca su archivo de «pendiente» falla.
- **Lo que encontró la revisión de la ola 1 (21/10):**
  - con Enter que manda (la computadora), «1. ¿Cuántos leads…?» seguía la lista y hacían falta tres Enter para mandarlo.
    Ahora un ítem SOLO que es una pregunta se manda (`enterEnLista({ conUno: false })`); cualquier otro sigue la lista,
    como pidió Martín el 17/10. ⚠️ El primer arreglo («con un solo ítem, manda») impedía EMPEZAR una lista con Enter: lo
    encontró la segunda revisión. El teléfono sigue igual;
  - con `ocupado` el botón giraba entero: no se podía dictar el siguiente mensaje, y quien dictaba perdía el botón de
    terminar mientras el dictado seguía escribiendo. Ahora sólo la flecha espera (`BotonMandar ocupado`).
- **Sin hacer:**
  - **El chat de MaKo del teléfono** (app/m/mako/Composer.tsx, el Ops Center de los clientes en el celular). Tiene tres cosas
    que la pieza no tiene: la nota de voz manteniendo apretado, el teclado de iOS (`visualViewport`) y la vista previa a
    pantalla completa de lo adjuntado (VistaAdjuntosM). Migrarlo hoy le sacaría funciones. Primero se le suman a la pieza.
  - **El hilo sigue siendo dos:** `Hilo` (Ops Center, turnos de Claude Code) y `HiloMako` (MaKo, con sus tarjetas).
  - **Las otras pantallas**, cada una de su chat (la lista, en el test).

## «Espera tu respuesta» sin pregunta: el chat cerró con el recuadro de la app, que no llega al Ops Center (20/10/2026)

**Síntoma:** Martín: «Debate me dice que espera mi respuesta, pero ya respondí... Y no veo que se esté utilizando la funcionalidad que creamos de respuestas múltiples». En su Ops Center, el hilo de Debate terminaba en un mensaje de 40 minutos antes.

**El diagnóstico obvio era el equivocado:** «Debate no recibió la respuesta». Sí la recibió: `operaciones.turnos.local_752add17…` tiene la respuesta de Martín de las 21:10Z.
- Después, Debate cerró sus dos turnos SÓLO con herramientas: `SendMessage` y `mcp__ccd_turn__wrap_up`, con `recap`, `ask` y `actions` (botones). No escribió texto.
- El cartero (`turnosDeLaVuelta`) sube sólo bloques de texto: ni el resumen ni la pregunta llegaron. El recuadro de próximo paso existe sólo en la app de Claude.
- Le pasa a cualquier chat que cierra así, que es justo lo que el system prompt de la app empuja a hacer.

**Regla:** una decisión para Martín va por `cartero.mjs preguntar` (AGENTS.md, desde el 17/10), y el turno termina con una línea de texto. El arreglo de fondo, encargado a Ops Center 3 el 20/10, es que el cartero suba el `recap` de un wrap_up como turno y su `ask`/`actions` como una pregunta de opciones.

**Arreglado (20/10, Ops Center 3):**

- **Arreglo (cartero 1.17.2):**
  - El `wrap_up` se lee como un mensaje del chat: su `recap` es el texto del turno (`cierreWrapUp`).
  - Con `ask` y dos o más botones se arma una PREGUNTA de las de 1.14.0 (`preguntaDeWrapUp`): pregunta = ask, opciones = los
    botones (título = label, detalle = message), la primera recomendada, con las mismas reglas que `preguntar`. Martín la
    contesta en el formulario, y la respuesta le llega al chat como siempre.
  - Con un solo botón, el `ask` va como texto, porque no hay formulario de una sola opción.
  - **El id de la pregunta es FIJO** (sale del id del `tool_use`): releer el transcript sube la misma, y MaKo no la repite
    ni le pisa la respuesta (`unirPreguntas` se queda con la que tiene).
  - No se sube si el chat ya hizo esa pregunta con `preguntar` (`preguntasSinRepetir`).
- **Y del lado del cartero:** lo que un chat le muestra a Martín al terminar NO es sólo su texto. Cualquier forma de cerrar que la app dibuje
  (hoy, `wrap_up`) tiene que llegar al Ops Center, o el Ops Center miente sobre en qué quedó el chat.

**La pregunta de un wrap_up se SUPERA (20/10, la revisión de caja-voz; cartero 1.17.3):**
- **Síntoma (comprobado con transcripts reales):** el arreglo de arriba volvía a dar el mismo síntoma por otro lado. La
  pregunta del recuadro de la app quedaba abierta para siempre: 3, 6 y 8 abiertas por chat, y 31 de 31 con un mensaje
  posterior en su chat. Martín contesta como le sale: el botón de la app, la caja del Ops Center o Remote Control. Sólo el
  formulario la cerraba, y un clic días después le firmaba al chat una orden vencida.
  - ⚠️ «Un mensaje posterior» NO es «Martín contestó» (la revisión de la ola 1 lo volvió a medir el 21/10: de 21 preguntas de
    5 días, 14 las supera primero un mensaje de OTRO chat; 3 son relevos de la respuesta de Martín por el Cerebro y 4, la
    misma pregunta hecha otra vez a los segundos). Por eso la pantalla dice «Ya no espera tu respuesta», no «Contestada».
- **Arreglo:**
  - la pregunta lleva `origen: 'wrap_up'`;
  - queda `superada` cuando entra un turno `yo` u `otro` POSTERIOR a su `at`, o un wrap_up más nuevo del mismo chat
    (`superarPreguntas`). Se aplica al guardar los turnos (`superarConTurnos`) y al guardar la pregunta, por si el turno
    llegó antes;
  - una superada no cuenta en el globito, no se contesta, y el formulario se lee como «Ya no espera tu respuesta»;
  - las de `preguntar` no se tocan: ésas las cierra la respuesta. Y una de `preguntar` igual a una de wrap_up abierta no
    se descarta en silencio: la que queda se marca `tambienPreguntar` (`unirPreguntas`), así la cierra sólo una respuesta.
    Al guardar, las de antes se superan ANTES de unir: una que ya quedó atrás no frena a la misma pregunta hecha de nuevo.
  - ⚠️ **Lo obvio era el error: «sacarle el `origen`» para que no la supere un turno** (91fae9527; lo encontró la segunda
    revisión de la ola 1). El `origen` también decide el TEXTO de la respuesta: sin él, `textoDeRespuesta` no pone el
    `message` del botón, y la copia del cliente (que todavía lo tenía) firmaba otro texto; la base no la marcaba y, sin
    origen, ningún turno la superaba. Abierta para siempre, la queja de Martín otra vez. **Regla:** un campo que ya decide
    algo no se reusa para decidir otra cosa: la marca nueva va aparte.
- **La misma pregunta, dos veces:** `preguntasSinRepetir` deduplicaba dentro de UNA vuelta, y `vigilar` da una cada 10 s.
  Ahora `unirPreguntas` descarta una nueva igual (mismo chat, mismo texto normalizado) a una que siga abierta. El cartero
  sube la última de cada chat, con el tope ANTES de mandar y las más nuevas primero (el servidor se quedaba con las 20
  más viejas).
- **Sin perder la pregunta:**
  - si MaKo no puede guardarla, la vuelta no avanza las marcas;
  - si no volvió en `preguntasIds`, la marca de ESE chat no avanza (`marcasQueAvanzan`), con un tope de 30 vueltas
    para no dejar al chat mudo;
  - `armarPregunta` quita los caracteres de control como el servidor;
  - un `preguntas/<uuid>.json` malformado ya no tumba todas las vueltas de la cuenta.
- **La respuesta lleva el `message` del botón** (lo mismo que el clic en la app), hasta 300 caracteres.
- **Regla:** una pregunta que no cerró quien la contesta tiene que cerrarse sola cuando la conversación siguió, o el Ops
  Center miente igual que antes.

## Lo que encontró la revisión de la caja única y del wrap_up como pregunta, antes de subirla (20/10/2026)

Revisión adversarial de la rama `caja-voz` (cartero 1.17.2). No subió hasta arreglar lo importante. El detalle está en las notas compartidas, `revision-caja-voz-20-10.md`.
- **Una pregunta armada de un wrap_up no se cierra sola.** Martín contesta como le sale: el botón de la app, la caja del Ops Center o Remote Control. Sólo el formulario la cerraba, y quedaba «Espera tu respuesta» para siempre, con una orden vieja que se podía firmar días después. **Regla:** una pregunta de wrap_up queda superada con cualquier mensaje posterior en ese chat.
- **Deduplicar dentro de una vuelta no alcanza:** `vigilar` da una vuelta cada 10 s y el mismo wrap_up (o `preguntar` + el wrap_up que exige la app) llega en vueltas distintas. Se deduplica contra lo guardado.
- **Una línea de transcript de más de 4 MB (`LECTURA_MAX`) deja al chat MUDO:** sin salto de línea en la ventana, la marca no avanza y no sube nada más de ese chat. Ya pasaba en 1.16.1. Un PDF de ~3,5 MB adjunto en la app alcanza.
- **Apagar la caja mientras MaKo trabaja es una regresión** en el Ops Center del cliente: «mandando» (el botón) no es «apagar el campo».

**Arreglado (20/10, Ops Center 3, cartero 1.17.3; tests/caja-voz-revision.test.ts):**
- la pregunta superada, la deduplicación contra lo guardado y no perder la pregunta: arriba, en la entrada del wrap_up;
- la caja: `ocupado` hace girar SÓLO el botón (el chat del cliente lo usa en vez de `enviando`);
- un pegado de Word o Excel con texto e imagen vuelve a ser el documento «Texto pegado».

**Sin hacer (no frenan; los tres de adjuntos de turnos):**
- Los binarios de `operaciones-turnos/` quedan huérfanos cuando el turno sale de los 60 últimos: falta borrarlos en
  `guardarTurnos`. El encabezado de `lib/operaciones-adjuntos.ts` («EL BINARIO NO QUEDA») miente.
- La URL de subida firmada no ata el tipo ni el tamaño: un bucket propio con `file_size_limit` y `allowed_mime_types`.
- Una línea de transcript de más de 4 MB (`LECTURA_MAX`; un PDF de ~3,5 MB en base64) deja al chat MUDO: la marca no
  avanza. Hay que saltarla con aviso, y alinear `MAX_BYTES_ADJUNTO_TURNO` (30 MB) con lo que se lee de verdad.
- `subirAdjuntosDeTurnos` corre sin el presupuesto `fin` de `vigilar`.
- El subtítulo de la fila queda vacío en el hueco de un trabajo recién entregado (antes de que el Runner diga `busy`).

## La miniatura de la caja decía «PDF» para un Word (20/10/2026, desde el chat del Web Generator)

- **Síntoma:** desde el 18/10 la caja toma Word, Excel, PowerPoint y texto, pero `ListaAdjuntos` (AdjuntosCaja.tsx)
  dibujaba todo documento con el rótulo fijo «PDF». Se vio al usar las piezas en el chat del editor de landings.
- **Ahora:** la extensión del archivo (`etiquetaDoc`: «DOCX», «XLSX»…). Y `AdjuntoCaja` tiene un `estado` opcional
  («leyendo» / «error») que la miniatura pone en `data-estado`: el Centro no lo usa; el editor lo pinta con su hoja.
- **Sin hacer:** tocar la miniatura de un Word abre el `Visor`, que lo pone en un iframe con su `blob:`: el navegador no
  lo muestra (lo baja o queda en blanco). Pasa igual en el Centro.

## El cartero nuevo se instala DESPUÉS del deploy del servidor que lo entiende (21/10/2026)

La revisión de la ola 1 (cartero 1.17.3) encontró que el orden importa en una sola dirección. Un cartero viejo (1.16.1)
contra el servidor nuevo anda: el servidor no pide versión y lo que no trae `origen` no se toca. Un cartero NUEVO contra
el servidor viejo falla de dos maneras:
- `?adjunto-turno=1` cae en `cicloCartero` y da 503: el chat con una captura queda en fallidos y mudo hasta el deploy;
- el servidor viejo guarda las preguntas de wrap_up SIN `origen`, y después del deploy nunca se superan.

**La regla:** primero el deploy, después `cartero.mjs instalar`. Y un cambio del protocolo cartero ↔ servidor se revisa en
las dos combinaciones de versión. *Cerebro, claude4.*

## Un chat retira la pregunta que ya no hace falta (21/10/2026, cartero 1.17.4)

**Vive en:** `retirarDeLaLista` (lib/centro-preguntas-chat.ts) · `retirarPregunta` (lib/centro-preguntas-chat-db.ts) ·
`?retirar-pregunta=1` en app/api/operaciones/cartero/route.ts · `cartero.mjs retirar <id> [--chat <local_…>]`. Probado en
tests/centro-preguntas-retirar.test.ts. La regla para los chats, en AGENTS.md.

- **Síntoma:** Martín dijo «no más preguntas», y Debate no tenía cómo sacar la 53053bcb (y otras tres) de su chat del Ops
  Center: una pregunta de `preguntar` la cierra sólo una respuesta, y la PC ya había borrado su archivo al subirla.
- **El arreglo:** `retirar` borra la que todavía no subió (sólo la de ESE chat) y le pide a MaKo la que ya está, que queda
  `superada`: no espera, no se contesta, y se lee como las superadas. Por el id entero o sus primeros 8, como lo nombra un
  chat; con dos abiertas que empiezan igual no adivina.
- **Trampa:** `sanearPregunta` guardaba `superada` sólo de una de wrap_up, así que marcar una de `preguntar` se borraba
  en la lectura siguiente. Ahora la guarda de cualquier origen (lo que sube la PC sigue sin poder traerla).
- **Trampa:** un cartero 1.17.4 contra un servidor viejo: el pedido cae en `cicloCartero`, que contesta «falta la cuenta
  del cartero». El comando lo reconoce y dice «falta el deploy», en vez de decir que la retiró. Igual: deploy primero.
- **Lo obvio era el error: «un 503 de producción en el log del cartero».** cartero.log tenía decenas de «no pude subir lo
  que Martín adjuntó en local_22222222-…: MaKo no dio dónde subirlo (503)». Ese chat no existe: es el `OTRO` de
  tests/centro-app-adjuntos.test.ts, cuya falla de mentira el cartero escribía en el log REAL (lee `CARTERO_DIR` al
  cargarse, y el test no lo ponía). **Regla:** un test que importa el cartero pone `CARTERO_DIR` en una carpeta temporal
  antes de importarlo; y una línea rara del log se busca primero en los tests (por el id), antes que en producción.

**Sin hacer:** otros tests que importan cartero.mjs sin `CARTERO_DIR` (centro-abrir-pantalla, centro-largos,
centro-textos, tickets-cartero…) no escriben el log hoy porque no llaman a lo que loguea; no hay una guarda que lo
impida.

## El panel de un chat es UNO para todos los Ops Center (21/10/2026)

- **Síntoma:** el Ops Center de un cliente se veía como otra app al lado del de Martín (capturas del 21/10). Lo que pasó, con la
  medición, en [hallazgos-second-brain.md](hallazgos-second-brain.md#el-ops-center-del-cliente-es-el-del-super-admin-las-mismas-piezas-no-un-parecido-21102026).
- **Lo que cambió en el Centro:** la cabecera, la columna del hilo, el soltar archivos y la caja de Conversacion.tsx salieron a
  app/admin/operaciones/PanelChat.tsx (`PanelDeChat`, `CabeceraDeChat`), y la fila de la barra a `FilaDeChat` (PiezasCentro.tsx).
  Las filas de un mensaje (`FilaMia`, `FilaDelChat`) se exportan de Hilo.tsx. `FilaCentro` y Conversacion las montan sin cambiar
  lo que dibujan.
- **Regla:** algo nuevo de la conversación del Ops Center va en el panel o en las filas, y le llega al cliente solo. Un cambio de
  la cabecera en Conversacion.tsx ya no existe: está en PanelChat.tsx.
- **MensajeWA.tsx** suma `sin` (las opciones que un chat no tiene: el cliente no reenvía) y `mensajes` en `BarraFijados` (un hilo
  que no es de líneas del Centro).

## MaKo en cada tab a la izquierda, y las criaturas siempre vivas (21/10/2026, noche)

Martín (~23:10): «el chat de MaKo en las otras tabs se debe abrir siempre a la izquierda», «los iconos de las criaturas siempre debe
ser el icono de MaKo, se envía lo que sea que envíen al cerebro» y «las criaturas, siempre, donde sea que estén deben tener su
animación de movimiento, y parpadeo». Código: app/_chat/MakoEnLaTab.tsx, Muneco.tsx, centro.css, criatura.css.

- **La pieza de las tabs no es otro chat:** es la conversación «Cerebro» del Ops Center del cliente (useChatCliente.ts), con su
  panel, su hilo y su caja. Cada tab la monta con `<MakoEnLaTab tab="…" />`; la migración de cada tab es de su chat (el CRM la
  pidió primero).
- **El panel se pega a la barra de la app, no al borde de la pantalla:** la barra mide 68 o 244 px según esté fija, y cambia sin
  un `resize`. Se mide con un ResizeObserver sobre `[data-sidebar]`.
- **El motor se monta con el panel abierto:** una tab que nunca abre a MaKo no pide nada.
- **Lo de cada tab entra por la pieza, no al lado (22/10, pedido del CRM):** `arriba` (las sugerencias, sobre el hilo), `aviso` (el
  globito de la estrella plegada) y, abierto, `--ancho-panel-mako` en <html> (440 px; 0 cerrado) para que la tab le deje el margen
  con `padding-left: var(--ancho-panel-mako, 0px)`. Una tab que mide el panel por su cuenta se desfasa cuando la barra se fija.
- **Lo que MaKo terminó en OTRA tab también suma al globito (22/10, pedido del chat Automations).** El turno de Automations
  sigue aunque la persona se vaya. Si termina sin que nadie lo mire, queda en lib/mako-trabajos.ts y sale el evento
  `mako:trabajo-terminado`. La estrella lo lee al montar y con cada evento (TrabajosDeMako.tsx): globito = `aviso` + eso, y
  abierta dice «MaKo terminó en Automations › …» con su link. **Trampa: esa lista vive sólo en la memoria de la pestaña.** Un
  `<a>` a mano recarga la página y la borra antes de que Automations la marque vista; el `Link` de la casa navega sin recargar
  y pone el `?ws=`. tests/ops-center-trabajos-mako.test.ts.
  **SIN HACER:** recargar la página pierde lo que no se vio (la lista no se guarda). Y la estrella está montada en el CRM, el
  Plan, Clientes y el editor del Dashboard (22/10): en las demás tabs no se ve hasta que su chat la monte.
- **El desfase de cada criatura sale de su ASPECTO, no de su nombre.** Con el nombre, la estrella del «Ops Center» de la barra y la
  del «Cerebro» dejaban de ser la misma criatura (tests/centro-ops7.test.ts lo fija comparando el HTML). Sin desfase, todas
  parpadeaban a la vez, como un tablero.

## En la computadora se entra al Ops Center: el super admin TIENE workspace (21/10/2026)

**Vive en:** `casaEnLaComputadora` (lib/ops-center-ruta.ts) · el repartidor app/inicio/page.tsx · fijado en
tests/inicio-ops-center.test.ts. La regla para código nuevo, en AGENTS.md («La pantalla de entrada se decide en /inicio»).

- **Síntoma:** Martín, 21/10 22:54: «en desktop siempre al iniciar me lleva a dashboard, cuando dijimos que debería ir a Ops
  Center siempre». El teléfono ya entraba al Ops Center desde el 20/10 (`ENTRADA_MOVIL`); la computadora no.
- **Lo obvio era el error: «el super admin va a /clients».** Lo decía el comentario del repartidor («un admin sin impersonar
  arranca en su panel de gestión») y la rama existía: `if (ws == null) redirect(… '/clients')`. Pero **nunca corría para
  Martín**: medido en producción ese día, su usuario (id 1) es `rol=admin` con `workspace_id=9` (la plataforma, capa
  `superadmin`), y `resolverDesdeCookies` le devuelve `imp ?? sesion.ws` = 9. Pasaba de largo, caía en el `redirect('/general')`
  del final, y /general redirige al Dashboard. **Regla:** «sin impersonar» no es «sin workspace»; lo que distingue al super
  admin en su casa de él mirando a un cliente es `quienOpera()` / `estaImpersonando()`, nunca `getWorkspaceActual() == null`.
- **La casa es la fila «Ops Center» de la barra de quien entra:** `/admin/operaciones` para el que opera (`quienOpera`, la
  guarda del Centro: con 2FA y su workspace de plataforma) y `/second-brain` para el cliente, su closer y su setter, y el super
  admin con `?ws=N`. El test compara las dos rutas con los `href` de nav.ts. El que opera no pasa por el onboarding (el wizard
  es de un negocio); el resto sí, antes. Un admin sin workspace sigue en /clients: no tiene Ops Center que abrir.
- **Los caminos de entrada que esquivaban al repartidor:** «Inspeccionar» del super admin (AdminView, FichaWorkspace) y
  «Entrar» de MaKo Partners iban derecho a `/general?ws=N`; el «Ir al inicio» del cartel «No está en tu plan» iba a la casa
  del plan (/crm o /plan); la vuelta de Google sin su cookie caía a `'/'`, que es la LANDING pública; el rebote de
  /admin/agente, también a `'/'`. Ahora todos van a `/inicio` (con su `?ws=`). El login con contraseña, el 2FA, «Ya estás
  adentro» y el `start_url` de la PWA ya iban a /inicio.
- **Trampa: el logo de la barra NO es un link** desde el 14/10 (Martín: «si clickeo MaKo no pase nada», Sidebar.tsx → `Marca`).
  No es un camino de entrada y no se tocó.

**Sin hacer:**
- `app/error.tsx`: «Ir al inicio» sigue yendo a `'/'` (la landing). Ese boundary también cubre la landing pública, donde
  `/inicio` mandaría al visitante a /login, y no importa nada de la app a propósito; falta una forma de distinguir sin imports.
- Ctrl K: «home» e «inicio» siguen llevando al Dashboard (lib/buscador-nav.ts → `ALIAS`, con su test en sidebar-nueva).
- El teléfono, sin tocar (lo lleva otro chat): «Entrar» de Partners en app/m/partners/PartnersM.tsx sigue yendo a `/general`.
- `homeDeCapa` (lib/tab-access.ts), el rebote de una tab que el rol no ve, sigue en /crm o /plan: no es la entrada.
- Nada de esto se miró en un navegador: es un redirect del servidor que pide la sesión de Martín con 2FA.

## MakoEnLaTab: un pedido de la tab al Cerebro vive en la PIEZA, no en el panel (22/10/2026)

- **El caso:** el «Hacerlo» de una sugerencia del CRM le escribía al chat propio del CRM. Con la estrella de todas las
  tabs, tiene que salir al Cerebro. `MakoEnLaTab` suma `pedido` (`{ texto, vez }`): abre el panel y lo manda UNA vez por
  `vez`.
- **Por qué en la pieza:** el panel (`PanelDelCerebro`) se DESMONTA al cerrar. Un `useRef` del último pedido mandado
  adentro del panel se pierde, y al reabrir el mismo pedido volvía a salir. La pieza guarda el último `vez` y el panel
  sólo recibe lo que falta mandar.
- **Sale al Cerebro y cuando se puede:** espera `k.esJefe` (la lista llegó y se eligió el Cerebro) y usa lo que devuelve
  `k.enviar`: con el hilo cargando o MaKo trabajando devuelve `false`, y el efecto reintenta cuando cambian `cargado` o
  `trabajo`. Cerrar el panel antes suelta el pedido: no sale «solo» más tarde.
- **La regla para la próxima tab que migre:** lo que esa tab le inyectaba a SU chat va como `pedido`, y NOMBRANDO su
  contexto. El Cerebro no sabe desde qué tab ni qué CRM le escriben (en el CRM: `pedidoParaElCerebro`).

**Vive en:** app/_chat/MakoEnLaTab.tsx (`pedido`, `porMandar`, `ultimaVez`) · tests/sugerencias-crm.test.ts
*22/10/2026, chat «CRM» (claude3).*

## Las decisiones como en Claude: un bloque arriba de la caja, de a una; y AskUserQuestion no se contesta desde acá (22/10/2026)

Martín, con captura del chat «Cerebro»: «Las decisiones deben salir como en Claude, un bloque arriba del chat con las opciones,
y tipo form de 1 pregunta, respondo 1 y va a la siguiente». Y después: «las preguntas tipo bloque de Claude en la app… siempre
deben aparecer en la app de Ops Center». Código: app/admin/operaciones/PreguntasDelChat.tsx, lib/centro-chats.ts
(`preguntasParaElBloque`, `preguntasDeLaApp`), lib/centro-preguntas-chat.ts (origen `ask`), scripts/operaciones/cartero.mjs
1.18.0 (`preguntasDeAsk`). Test: tests/ops-center-decisiones.test.ts.

- **Ya había un bloque así, para otra cosa:** `Pregunta.tsx` (arriba de la caja, copiado de AskUserQuestion) es el de las
  decisiones de la Ticketera (`admin_decisiones`). Las preguntas de los chats (`cartero preguntar` y los botones de un
  wrap_up) iban como tarjeta ADENTRO del hilo (`PreguntaChat.tsx`), y la que el chat dejaba atrás quedaba con «Ya no espera tu
  respuesta». Ahora van al bloque de arriba, de a una («1 de 3», «Atrás», el repaso y «Enviar»; con una sola, tocar la manda).
  En el hilo, la contestada es un mensaje de Martín, «Decisión: …», con la pregunta citada, y la superada no se dibuja.
- **Mandarlas «todas juntas» no cambia el camino de la firma:** cada respuesta sale firmada sola, en orden (`contestarPregunta`).
  El servidor sólo marca una pregunta si el trabajo dice EXACTAMENTE su `textoDeRespuesta`, así que un texto con varias no la
  marcaría. Si una falla, las que salieron quedan y el resto sigue en el bloque.
- **Una respuesta desde el Ops Center NO destraba un AskUserQuestion. Medido en 27 de los transcripts:** mientras espera, al
  chat no le entra ningún mensaje. El resultado llega sólo de la UI de la app («The user answered…»), y la mensajería entre
  sesiones retiene lo que llega con un turno en curso. La respuesta firmada quedaría detrás de la pregunta. Por eso el cartero
  1.18.0 la SUBE (se ve en el bloque, de sólo lectura, con «contéstala en la app»), y la regla en AGENTS.md es preguntar con
  `cartero preguntar`. MaKo la da por superada con lo primero que el chat escribe después: hasta que se contesta, no escribe nada.
- **El cartero nuevo hay que instalarlo:** `node scripts/operaciones/cartero.mjs instalar`, con el Runner quieto. Sin eso,
  la PC sigue con la 1.17.4 y las de AskUserQuestion no suben.

## La guarda del chat único no veía «Pídele un cambio a MaKo» (22/10/2026, OC2)

tests/chat-unico.test.ts reconoce una pantalla de MaKo por su hilo, su API o una caja que le escribe «a MaKo». La regex pedía el
verbo PEGADO a «a MaKo» («Pídele a MaKo»), así que el panel del Dashboard («Pídele un cambio a MaKo», PanelEditarMako.tsx) y
la caja de «Pídeselo a MaKo» (app/web-generator/CajaPedido.tsx, la usan Automations, CRM y Dashboard) no estaban en la lista.
En cambio sí estaba app/dashboard/EditorMako.tsx, que no es un chat: edita el pedido y las sugerencias del botón de un
gráfico. Ahora la regex acepta hasta 40 caracteres en el medio y «Pídeselo», la lista tiene las pantallas reales, y el chat
viejo del teléfono (app/m/mako/ChatMako.tsx con su Composer) se borró. **Una guarda por regex se prueba con el texto real de
cada pantalla**: el inventario se armó a mano y la regex nunca se corrió contra él.

## El Ops Center sólo muestra lo que es para Martín: lo que se dicen los chats no se dibuja (22/10/2026)

Martín, desde el teléfono y con captura (pedido f7fb8e80): «me salen estos textos largos innecesarios en muchos chats... No
los quiero». En su «Cerebro» se leía entero un mensaje de Integración al Cerebro («READY. 87365c830 está EN PRODUCCIÓN…»),
dibujado como si fuera suyo y con «Cerebro › Integración» de cita. Código: lib/operaciones-reglas.ts (`esParaMartin`,
`esResumenDeCompactacion`, `sanearTurnos`), lib/centro-chats.ts (`lineasDeConversacion`, `vistaPrevia`). Test:
tests/ops-center-solo-para-martin.test.ts.

- **De dónde salía la cita:** el cartero sube cada `<cross-session-message>` como un turno `otro` con el `name` del que lo
  mandó (cartero.mjs → turnosDeLineas), y Hilo.tsx lo dibujaba con ese nombre arriba (`co-burbuja__cita`). Era lo diseñado
  el 17/10, cuando había pocos chats; hoy la coordinación es la mayoría de lo que se dicen.
- **Medido en la base ese día** (`operaciones.turnos.*` del ws de la plataforma, 71 chats, 1.937 turnos): 1.581 del chat,
  77 de Martín y **279 de otro chat** (195 del Cerebro). Y apareció lo que nadie había pedido: **14 turnos «de Martín» eran
  el resumen que Claude Code escribe al compactar** («This session is being continued from a previous conversation…»): la
  línea del transcript es un `user` con `isCompactSummary`, y el cartero no la mira. Es el «texto largo» más largo de todos.
- **Dónde se arregló:** en el SERVIDOR, no en el cartero. Lo que se dibuja pasa todo por `lineasDeConversacion` (la
  computadora y el teléfono montan Hilo), y lo guardado pasa por `sanearTurnos` al leer: así vale también para lo de antes,
  sin migrar nada ni esperar una versión nueva del Runner.
- **El `otro` se sigue GUARDANDO a propósito:** un mensaje de otro chat después de una pregunta de wrap_up la deja atrás
  (lib/centro-preguntas-chat.ts). Sólo no se dibuja, ni cuenta como «lo último» de la fila. La compactación, en cambio, no
  sirve para nada (hasta superaba preguntas como si Martín hubiera contestado): no se guarda ni vuelve.
- **Regla (AGENTS.md):** el Ops Center sólo muestra lo que es para Martín. Lo que tiene que leer, se lo dice el chat a él en
  su respuesta. Algo nuevo que dibuje turnos pasa por `lineasDeConversacion`.

**SIN HACER:** el cartero podría no subir la compactación (`isCompactSummary`), pero no hace falta mientras el servidor la
saque, y cambiarlo pide reinstalar el Runner.

## El cambio de cuenta del 23/10: el Cerebro viejo no podía abrir chats, «›» se rompe al abrirlos y subir `integracion` no subía `main` (23/10/2026)

Ese día Martín pasó de claude1 a claude2 a las 12:13 ART, porque la ventana de 5 horas de la 1 se agotó. Cuatro trampas,
ninguna con error a la vista:

- **Un Cerebro DESARCHIVADO no tenía `start_session`; uno NUEVO, sí.** En claude1 el Cerebro era la sesión de agosto
  `e680c815`, desarchivada y renombrada. Buscó la herramienta de cuatro formas y no estaba, así que no pudo abrir ni el
  Runner: lo intentó por terminal (`claude1 -n Runner`), que se trabó en el selector de tema. El uso de la cuenta lo
  subió a mano, renombrándose «Cerebro › Runner» para una vuelta. En claude2 el Cerebro fue un chat creado ese día y
  abrió el Runner y cinco chats con `start_session` sin trabas. No está probado que la causa sea la edad de la sesión;
  lo que sí está medido es que el camino nuevo anduvo. **Regla:** al cambiar de cuenta, el Cerebro es un chat nuevo.
- **`start_session` cambia «›» por «'» en el título.** «Cerebro › Integración» nació como «Cerebro ' Integración», y
  el Ops Center une los chats por nombre. **Regla:** renombrar en el acto con `set_session_title`.
- **Sin minutos de Actions, subir `integracion` NO avanza `main`.** El Cerebro de claude1 subió el arreglo del ws13
  (`cd3827f44`, con antes-de-subir en verde) a `integracion` a las 12:02 y reportó que «GitHub Actions lo chequea y
  avanza main». Pero Actions no tiene minutos desde el 22/10, así que `main` siguió en `594ecd41b` con un cliente roto
  hace diez días. Lo subió el Cerebro de claude2 a las 12:36 (Ready a las 12:40). **Regla:** después de cada push,
  `git ls-remote origin refs/heads/main`; mientras no haya minutos, `main` lo sube el Cerebro.
- **La ventana de 5 horas es de la CUENTA.** Al agotarse se cortaron los 11 chats de claude1 entre las 11:56 y las 12:02.
  El Cerebro había escrito «los demás chats siguen trabajando; ellos no comparten mi límite», y era falso. Planes quedó
  con trabajo sin commitear en su worktree. **Regla:** con la ventana arriba del 85 %, cada chat commitea o escribe lo que
  tiene en el disco antes de seguir.

Y una de método que ahorró horas: **lo que un chat dice «listo» o «tomado para el tren» se verifica con git.** Diez
lectores (Sonnet, 4 minutos) sobre las cronologías de claude1, con `git merge-base --is-ancestor`, encontraron que
ninguna de las 7 puntas «tomadas» estaba en `main`. También apareció una punta que nadie tenía en la lista (Chats de las
tabs, `256f46e07`), el «P1 de Stripe» que ya estaba en main desde antes y la punta real del CRM, que era otra
(`60bd69812`, no `886cb3545`). Las herramientas están en `C:/dev/cerebro-herramientas/`: `listar.cjs` (chats por cuenta),
`cola.cjs` (la cronología de un transcript desde una hora), `digest.cjs` (sólo los mensajes del usuario) y
`workflow-relevo-chats-cuenta.js`. El método quedó en `docs/relevo/cerebro.md`, «LEER PRIMERO».
