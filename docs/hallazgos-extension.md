# Hallazgos de la extensión de Chrome

Lo que hay que saber antes de tocar `extension/**`, el paquete (`scripts/zip-extension.mjs`, `public/mako-puente-*.zip`) y
lo que la página de MaKo le pide a la extensión (`lib/wa-fichas-cliente.ts`). **No es un changelog.** Lo de Google Flow que no
es de la extensión en sí (la API, los créditos, el motor) está en [hallazgos-generativa.md](hallazgos-generativa.md). El índice
es [hallazgos.md](hallazgos.md).

## Leer el WhatsApp Web de la persona sin escribir nada en WhatsApp (24/10/2026, 0.70.0)

**Vive en:** `extension/wa-fichas.js` (content script) · `extension/wa-fichas-reglas.js` (lo puro) · el handler
`WA_FICHAS_PEDIDO` de `extension/background.js` · el listener `MAKO_WA_FICHAS_PIDO` de `extension/mako-puente.js` ·
`tests/wa-fichas-extension.test.ts` (24 de 24 roturas cazadas).

- **Para qué:** Martín trajo 221 participantes de un grupo y ninguno tenía nombre: el listado de WhatsApp no trae nombres
  ([hallazgos-comunicacion.md](hallazgos-comunicacion.md)). Martín sí los ve en su WhatsApp Web, y Apify quedó descartado por
  el costo. Si la extensión lo lee de su navegador, sale gratis y no le suma consultas a la red de su línea.
- **Dónde está:** WhatsApp Web guarda sus modelos en la IndexedDB **`model-storage`**:
  - `contact`: `id` puede ser `…@c.us` o `…@lid`, con `phoneNumber`, `name` (la agenda), `pushname`, `verifiedName` e
    `isBusiness`;
  - `group-metadata`: `id` `…@g.us` y `subject`;
  - `participant`: `groupId` y `participants[]`.

  El esquema **no está documentado**. Sale de gists públicos de 2023 a 2025 y se lee a la defensiva: un campo que no está es
  «no sé». Si WhatsApp lo cambia, la extensión devuelve un `diagnostico` con los nombres de las tablas y las cantidades
  (nunca datos de nadie), y la pantalla lo deja en la consola como `[wa-fichas]`.
- **⚠️ Abrir una base que no existe la CREA.** `indexedDB.open('model-storage')` sin versión, en un navegador donde WhatsApp
  Web todavía no sincronizó, deja una base vacía con ese nombre en el WhatsApp de la persona. Por eso:
  - primero se mira `indexedDB.databases()`;
  - si igual llega `onupgradeneeded`, se aborta la transacción, y una base nueva abortada no queda;
  - nunca se pide una versión: pedirla puede migrar la base de WhatsApp.
- **⚠️ Una conexión abierta traba la actualización de WhatsApp.** Si WhatsApp Web sube la versión de su base mientras la
  extensión lee, nuestra conexión le bloquea el `upgrade`, y con eso su pestaña. Se cierra en `onversionchange` y al terminar.
- **Lo que NO se lee, y por qué:** la categoría, la web, el correo, el «info» o estado y el catálogo de una cuenta de empresa
  se ven en el panel del contacto. Esas tablas no los traen; no está verificado si otra tabla los guarda. Leerlos de la
  pantalla exige abrir el chat, y abrir el chat da el «visto». El Cerebro fue explícito: «ni abrir un chat que marque como
  leído». Antes de intentarlo, medir en vivo qué tablas hay (el `diagnostico` de la primera corrida de Martín lo dice) y qué
  efecto deja abrir el panel.
- **Aislado, no en MAIN:** el content script corre en el mundo aislado de la extensión. En `world: MAIN` la página de WhatsApp
  vería el script y podría tocarlo, y no hace falta: la IndexedDB del origen es la misma desde los dos mundos.
- **Sólo vuelve lo pedido:** la extensión indexa la agenda entera en memoria, pero devuelve sólo los teléfonos que MaKo pidió
  (los de leads que ya están en el CRM). La agenda de Martín no sale de su navegador.

## Una barra-asterisco dentro de un texto rompió tres tests que no tenían nada que ver (24/10/2026)

**Vive en:** `extension/background.js` · el `sinComentarios` y el `vivo()` de `tests/extension-sentinela-persiste.test.ts`,
`tests/puente-un-solo-juicio.test.ts` y `tests/puente-mauricio-sin-flow.test.ts`.

- **Síntoma:** al sumar el handler de las fichas al worker, se pusieron en rojo tres tests de Flow: «no encontré el cálculo de
  `ops`», «el handler ESTADO volvió a marcar una operación…» y el del espejo viejo del popup. Ninguno mira las fichas.
- **El diagnóstico obvio era el equivocado:** parecía que el handler nuevo había alterado el flujo de `ESTADO`. No tocaba
  nada. El culpable era el patrón de URL `'https://web.whatsapp.com/'` seguido de asterisco. Esos tests quitan comentarios
  con una regex de bloque (barra-asterisco … asterisco-barra) y no distinguen un texto de un comentario. La secuencia dentro
  de la URL abrió un «comentario» que se comió todo el código hasta el próximo cierre real, ESTADO incluido.
- **Regla:** en `extension/*.js`, ninguna barra-asterisco dentro de un texto. El worker busca la pestaña por prefijo de URL
  (`t.url.startsWith(…)`, la URL se ve porque hay permiso del sitio), no con el patrón de Chrome. Un test de
  `wa-fichas-extension` lo vigila.
- **Sin hacer:** el arreglo de fondo es que esos tests quiten comentarios sin romper textos, y viven en el área de Flow.
  Mientras tanto, la regla de arriba.

## Probar un content script: cargarlo como lo carga Chrome (24/10/2026)

- Un content script de MV3 es un script **clásico**: no tiene `module`. Por eso un `require` en el test no prueba lo que
  corre. Se carga con `vm.runInNewContext(código, ctx)` y se lee lo que dejó en el global del contexto.
- ⚠️ Lo que vuelve de otro contexto es de otro «realm»: sus `Array` no son los nuestros, y `deepStrictEqual` contesta
  «Values have same structure but are not reference-equal» sobre valores idénticos. Se compara después de
  `JSON.parse(JSON.stringify(x))`.
- Para el acceso a IndexedDB, un `indexedDB` de mentira que registra qué se abrió, con qué modo y si se intentó crear. Así se
  prueba «no crea la base», «sólo `readonly`» y «cierra la conexión», que son las promesas de la política de privacidad.

## Cómo le llega una versión nueva a Martín (y qué pide Chrome)

- Hoy `EXTENSION_EN_TIENDA = false`: se sirve el ZIP (`public/mako-puente-<v>.zip`, lo arma `node scripts/zip-extension.mjs`
  junto con la huella y `lib/extension-version.ts`; `guardas-push` frena un ZIP viejo). Martín usa la carpeta desempaquetada
  `C:\Users\marti\OneDrive\Escritorio\mako-puente`: se reemplazan los archivos y se toca «Recargar» en `chrome://extensions`.
- **⚠️ El ZIP se arma con los archivos del DISCO y `--check` lo compara contra HEAD.** Con `core.autocrlf=true`, la copia del
  disco puede tener CRLF mientras git publica LF, y entonces la huella no coincide: «quedó viejo» con la extensión al día
  (pasó con la 0.70.0; el commit 8a70f492 de la 0.69.0 ya lo había sufrido). Antes de armarlo, pasar a LF los archivos de
  texto de `extension/`. Git no los ve cambiados, porque normaliza igual. Después, `--check` tiene que decir «al día».
- **Un permiso de sitio nuevo (0.70.0: `web.whatsapp.com`)**: en una extensión desempaquetada entra al recargar. Desde la
  tienda, Chrome **desactiva** la extensión hasta que la persona acepta el permiso nuevo. Cuando se publique en la tienda, el
  aviso a los clientes tiene que decirlo, o «la extensión dejó de andar» va a ser el ticket.
- **Una pestaña abierta antes de instalar o actualizar no tiene el content script nuevo.** El worker lo detecta (el
  `sendMessage` falla) y la pantalla dice «Recarga la pestaña de WhatsApp Web». No es un error del código.

## «La extensión no contestó» y los nombres que no salían: lo que se midió en el WhatsApp Web de Martín (25/10/2026, 0.71.0)

**Vive en:** `pestanaDeWhatsappLista` y `reponerPuenteEnMako` (extension/background.js) · `indexarLids`, `buscarGrupos` y
`fichasDe` (extension/wa-fichas-reglas.js) · el «ping» de extension/wa-fichas.js · el puente (extension/mako-puente.js) ·
`pedirFichasDeWhatsappWeb` (lib/wa-fichas-cliente.ts) · `pedidosDeFichas` (app/crm/enriquecer-lote-server.ts) ·
tests/wa-fichas-071.test.ts (8 de 8 roturas cazadas).

- **Síntoma:** Martín, con la 0.70 y 221 leads de un grupo tildados: «La extensión no contestó», ninguna señal de avance, y la
  opción «Desde mi WhatsApp» gris con «Instala la extensión de MaKo» sin poder tocarla.
- **El diagnóstico obvio era el equivocado.** «La lectura tarda o falla» no era: desde su Chrome, un pedido vacío contestó en
  0,85 s con 27.391 contactos, 293 grupos y 291 listas de participantes. El «no contestó» es el corte de 20 s de la página
  cuando la pestaña de WhatsApp Web no está, está dormida o tiene el script viejo; eso lo resuelve ahora el worker
  (`pestanaDeWhatsappLista`: la abre de fondo, la despierta, le pone el script, la recarga, espera la base) y lo cuenta.
- **Y el problema de fondo era otro, que con la 0.70 no se iba a ver nunca:** MEDIDO en su WhatsApp Web (sólo nombres de
  campos y cantidades), en sus grupos los 15.244 participantes son `@lid` (ninguno `@c.us`), el 37 % sin `phoneNumber` en su
  navegador, y el nombre está en **`displayNameLID`** (6.252), casi nunca en `name`/`pushname` (786), que era lo único que
  leía la 0.70. `lid-pn-mapping` y `lid-display-name-mapping` existen pero estaban VACÍAS; `business-profile` guarda sólo
  bots (comandos y prompts): no sirve para «Datos de empresa».
- **Regla:** un participante de grupo se busca por su `@lid`, no por el teléfono. El `@lid` de cada lead lo da Evolution con
  la lista del grupo (`participantesDelGrupo`, una lectura con caché) y el grupo sale del historial del lead («Traído de un
  grupo de WhatsApp»). El nombre se lee también de `displayNameLID`.
- **⚠️ Al actualizar, el puente VIEJO sigue vivo en las pestañas de MaKo abiertas**, sin la extensión detrás, y contestaba
  «no encontré la extensión» antes que el nuevo. Ahora el nuevo no contesta huérfano (`chrome.runtime.id` vacío) y la página
  espera 1,5 s a una respuesta viva antes de creerle. Y el worker repone el puente en `onInstalled` sólo donde no corre
  (`__makoPuenteCargado`): correrlo dos veces en el mismo mundo tira por las declaraciones repetidas.
- **⚠️ Abrir una segunda pestaña de WhatsApp Web le saca la sesión a la primera** (pasó midiendo: la nuestra cargó los chats
  y la de Martín quedó con «Usar aquí»). El worker abre WhatsApp Web SÓLO si no hay ninguna pestaña; para medir, leer desde
  la que ya está (un pedido vacío devuelve el `diagnostico`) y no abrir otra.
- **Cómo se midió sin sacar datos:** desde la pestaña de MaKo, un pedido de fichas con CERO teléfonos devuelve el
  `diagnostico` (tablas y cantidades). Los campos de cada tabla se leyeron con `getAll` en modo lectura e imprimiendo sólo
  las claves; la herramienta del navegador bloquea en la salida los nombres de campo largos que parecen base64.

## Los 221 del grupo de Martín: el nombre de una cuenta de EMPRESA vive en `verified-business-name` (26/10/2026, 0.71.1)

**Vive en:** `verificadosPorLid` y los `verificados` de `indexar`/`indexarLids`/`buscarGrupos` (extension/wa-fichas-reglas.js)
· la lectura de la tabla en extension/wa-fichas.js · `conNombre` y `gruposEnWhatsappDichos` (app/crm/enriquecer-cliente.ts)
· tests/wa-fichas-071.test.ts (1, 2 y 5b).

- **Trampa del test (26/10, push de tren-l):** el test carga las reglas JS con `runInNewContext` y las tipa con un `type
  Reglas` escrito a mano. La 0.71.1 sumó parámetros (`verificados`, `contactos`) y el test los usó, pero el tipo espejo
  seguía con los viejos: `tsx` no mira tipos, así que el test pasaba en verde y recién el chequeo de tipos del push lo frenó
  (5 errores TS2554). **Regla:** quien le suma un parámetro a una función de `wa-fichas-reglas.js` actualiza el `type
  Reglas` del test en el mismo commit.
- **Síntoma:** Martín corrió la 0.71.0 sobre los 221 de «16, 17 y 18 de JUNIO | RETO del Anuncio Ganador»: «De 221, tu
  WhatsApp tiene el nombre de 0… 0 nombres completados», con el grupo encontrado (247). Y él: «literalmente hay muchos que
  tienen toda la info».
- **Dónde vive el nombre de una cuenta de empresa:** en la tabla `verified-business-name` de `model-storage`, por `@lid`
  (`{ id: '…@lid', name, isSmb, level }`, 6.312 filas en su WhatsApp Web). NO en `contact`: ahí esos contactos no tienen
  `name`, `pushname`, `verifiedName` ni `displayNameLID`. Es lo que WhatsApp Web muestra de una empresa que nunca le escribió.
  En ese grupo tiene a 83 de los 247 (81 con teléfono). La 0.71.0 no leía esa tabla.
- **El diagnóstico obvio fue el equivocado DOS veces:**
  1. «No se arma el puente `@lid` ↔ teléfono» (el +, el 9, el 521): no. Medido con los teléfonos de los 221, el cruce da
     221 de 221 por teléfono;
  2. «El dato no existe en su WhatsApp» (lo que decía esta entrada antes): tampoco. Se había medido sólo en `contact`, en
     `message` (ningún `notifyName`) y en las tablas de `@lid`; el nombre estaba en una tabla aparte, que se vio recién al
     contar en la memoria de la página (`verifiedName` en 83 de los modelos de contacto) y buscar de dónde lo cargaba.
  **Regla:** antes de decir «el dato no está», contar en la memoria de la página (`window.require('WAWebContactCollection')`,
  sólo leer) y buscar la tabla que lo alimenta; la extensión lee la tabla, nunca la memoria (sigue en el mundo aislado).
- **Ensayo con el código real sobre sus datos** (sólo lectura, sólo cantidades): la lógica de la 0.71.0 da 0, igual que su
  aviso y con los mismos 17 «en 2 o más grupos»; la de la 0.71.1 da **77 de 221**, todos con su nombre de empresa.
- **Los otros 144 siguen sin nombre, y eso sí es el dato:** el grupo es de anuncios (17 mensajes guardados, todos del
  sistema) y WhatsApp sólo conoce el nombre de quien le escribió o de una empresa. Para tenerlo habría que abrir la info del
  grupo, que es abrir el chat (da el «visto»): no se hace. Llegan cuando escriben.
- **Regla del final:** dice de cuántos sabe el nombre WhatsApp, contando la tabla de empresas («de sus 247, WhatsApp sabe el
  nombre de 83»). Sin ese número, un resultado bajo se lee como que la extensión está rota.

## Una descomprimida no se actualiza sola: la 0.71.1 sí (26/10/2026)

- La 0.71.0 quedó copiada en la carpeta de Martín y su Chrome siguió con la 0.70.0 toda la noche: hace falta tocar «Recargar»
  en chrome://extensions, que no se puede manejar desde Claude in Chrome, y la 0.70.0 no tiene ningún camino vivo a
  `chrome.runtime.reload()` (la única llamada está en `quizasReiniciarNoUsar`, sin llamadores desde el 01/09).
- Desde la 0.71.1, `alDiaConSuCarpeta` (extension/background.js) mira el manifest de SU carpeta (un `fetch` de un recurso
  propio lee el disco en una descomprimida) y, si trae una versión más nueva que la que corre, se recarga UNA vez por versión;
  nunca de la tienda ni con un trabajo de Flow o una lectura de fichas en curso. Al arrancar, después de cada latido y cuando
  la pantalla ve una extensión vieja (`MAKO_EXTENSION_REVISAR`). No es el reinicio que se sacó el 01/09: aquel comparaba
  contra producción y se reiniciaba aunque la carpeta no hubiera cambiado.
- ⚠️ **Un ciclo andando también es trabajo** (0.71.2, la revisión adversarial de tren-l): la alarma corre
  `ciclo().then(alDiaConSuCarpeta)`, y con otro ciclo ya en marcha `ciclo()` vuelve en el acto y la recarga corría en
  paralelo, cortando el POST a /api/flow/puente con los trabajos ya «tomados» (el cliente veía «generando…» diez minutos).
  `hayTrabajoEnCurso` mira `corriendo` primero, y la recarga queda para la próxima alarma.
- ⚠️ Sin verificar en vivo que el `fetch` lea el disco y no una copia en memoria (no se pudo: su Chrome sigue en la 0.70.0).
  Lo dice la primera vez que la carpeta traiga una versión nueva con la 0.71.1 corriendo.

## «Extraer» a la vista: recorrer la lista de miembros SUMA nombres que la base no tiene (26/10/2026, 0.72)

**Vive en:** extension/wa-recorrer.js (`recorrerGrupo`, `pantallaWhatsapp`) · `nombresDeFilas`/`sumarVistos`
(extension/wa-fichas-reglas.js) · el pedido `visible`, `anotarExtraccion`, `abrirDesplegable`, `volverAMako`
(extension/background.js) · la navegación y la animación (extension/popup.js/.html) · tests/wa-extraer-072.test.ts.

- **El diagnóstico obvio era el equivocado otra vez:** «abrir el grupo es sólo para que se vea». No: MEDIDO en el WhatsApp Web
  de Martín (sólo cantidades), la lista «Busca miembros» del grupo de los 221 dibuja el «~nombre» de 53 personas que
  `model-storage` NO tiene (ahí, 1 `pushname` de 247, antes y después de abrirla: WhatsApp los tiene en memoria y no los
  guarda), 40 de ellas con el teléfono al lado. Corrida real con la 0.72.2: `vistos: 40`. Sólo se leen mirando la pantalla.
  **Regla:** para un nombre que «no existe», además de contar en la memoria (entrada de los 221), mirar lo que la interfaz
  DIBUJA: puede venir de memoria que ninguna tabla guarda.
- **Las piezas medidas** (WhatsApp Business, en español, 26/10): la búsqueda es un `input[data-tab="3"]` (antes era un
  contenteditable) y responde a `execCommand('insertText')` desde el mundo aislado; el chat abre con
  pointerdown/mousedown/pointerup/mouseup/click sobre `[data-testid="cell-frame-container"]` (un `.click()` solo, no); la info
  es `[role="complementary"]` con «N miembros» y «Ver todos (N más)»; la lista, un `[role="dialog"]` con UN elemento que
  scrollea y filas de 72 px. Hay `data-testid` estables (`cell-frame-title`, `cell-frame-secondary`, `list-item-N`); las
  clases cambian en cada versión y no se usan.
- **La lista es VIRTUAL y tarda en dibujar:** de a 500 px cada 250 ms se vieron 98 de 247; de a 250 px cada 300 ms, 234. Se
  baja de a media pantalla con `behavior: 'smooth'` y 420 ms entre pasos (~45 s para 247), y si no se mueve dos veces seguidas,
  se corta (no espera hasta el tope).
- **`chrome.action.openPopup` falla la primera vez:** en la primera corrida no se abrió; con reintentos (4, cada 350 ms, el
  último sin `windowId`) se abrió en la segunda. Chrome lo rechaza mientras la ventana todavía no tiene el foco que acaba de
  pedir `windows.update`. El porqué queda en la fila del registro (`desplegable`) y vuelve a la pantalla: sin eso, «no se ve»
  no se puede diagnosticar.
- **Abrir el grupo marca como leídos los mensajes DEL GRUPO** (no los de cada persona). Es el pedido de Martín y lo dice la
  política de privacidad (/privacidad/extension); antes decía «no hace clic, no abre chats, no marca nada como leído».
- **Sólo el pedido que empieza crea su fila del registro** (`anotarExtraccion(..., crear)`): un aviso con un id que no está
  (de antes de recargarse la extensión) creaba una «extracción» fantasma. Encontrado probando, 0.72.2.
- **El QR, como Flow (0.72.3):** Martín pidió «replicar» lo de Flow en el Scraper. Abrir la pestaña si falta y reusar la que
  hay YA estaba (`pestanaDeWhatsappLista`, el mismo molde que `prepararEscenario`). Lo que faltaba era MIRAR LA PANTALLA: con
  la sesión cerrada `model-storage` puede seguir ahí, así que «hay base» no es «hay sesión». `estadoDeSesion` (en
  wa-recorrer.js: wa-fichas.js no toca la pantalla, y su test lo exige) dice 'lista' (está `#side`), 'qr' (el lienzo, el
  `data-ref` o el texto) o 'cargando'; con el QR, la pestaña al frente y CINCO minutos de espera, contándolo. El desplegable
  dice cómo está WhatsApp Web arriba del registro (`WA_ESTADO`, sólo mira). ⚠️ La pantalla del QR NO se midió en vivo
  (cerrarle la sesión a Martín no se hace): si WhatsApp cambia ese dibujo, el síntoma es esperar el minuto de «cargando» y
  decir `sin_sesion`. Medido en vivo que con la sesión abierta NO se confunde (2 s, sin pasar por «qr»).
- **Probar sin desplegar la pantalla:** el mismo pedido que manda MaKo se dispara desde SU pestaña de hola-mako.com con
  `window.dispatchEvent(new CustomEvent('MAKO_WA_FICHAS_PIDO', …))` (el puente lo toma igual), con `pedidos: []` para no leer
  ni guardar datos de nadie. Así se probó la mitad de la extensión en su Chrome real antes del despliegue.

## Sin hacer

- **La corrida con la pantalla nueva desplegada** (la mitad de MaKo de «Extraer»: crear los leads con la etiqueta y guardar
  los nombres): la extensión 0.72.2 ya corre en su Chrome y se probó a la vista (notas del Cerebro, capturas-extraer-072). Al
  desplegar: Nuevo lead › Scraper › el grupo › «Extraer N», y mirar que el desplegable termine en «N nombres en MaKo».
- **El desplegable en su estado final («listo»)** no se capturó: vuelve a MaKo a los 4 s y se cierra. Se ve en su registro.
- **La pantalla del QR, medida:** la primera vez que un cliente (o un perfil aparte) llegue con la sesión cerrada, mirar que
  el desplegable diga «Escanea el QR» y no «cargando».
- **El panel del contacto** (categoría, web, correo, estado, catálogo): `business-profile` no los trae (sólo bots). Medir
  antes de construir.
- **El rubro filtrable en el CRM**: hoy no llega por ningún camino gratis (las tablas no traen la categoría).
