# Hallazgos de la extensión de Chrome

Lo que hay que saber antes de tocar `extension/**`, el paquete (`scripts/zip-extension.mjs`, `public/mako-puente-*.zip`) y
lo que la página de MaKo le pide a la extensión (`lib/wa-fichas-cliente.ts`). **No es un changelog.** Lo de Google Flow que no
es de la extensión en sí (la API, los créditos, el motor) está en [hallazgos-generativa.md](hallazgos-generativa.md). El índice
es [hallazgos.md](hallazgos.md).

## «Descargar» volvía con cada versión: qué se ofrece no puede colgar de la versión (3/11/2026)

**Síntoma.** Martín: «Aún la extensión de mako me pide "Descargar"...», ya con la 0.74.3 aprobada en la tienda.
**El diagnóstico obvio era el equivocado.** `docs/pendientes-martin.md` decía «hay que publicar la 0.74.4; ningún cambio de código
lo arregla, el flag hace lo correcto». Publicar no lo arregla nunca: el repo sube en cada push y la tienda sólo cuando alguien
publica y Google aprueba, así que «repo adelante de la tienda» es el estado normal. Se midió de nuevo el mismo día y ya era 0.74.5.
El «modo de falla seguro» del flag (`EXTENSION_EN_TIENDA`) sólo era seguro para el repo: para el cliente, el zip pide Modo de
desarrollador, una carpeta que no se borra y no se actualiza más.
**Regla.** Toda pantalla lleva a «Agregar a Chrome». La versión vieja se protege aparte, y por función:
- una función que pide más versión lo dice en una línea (`lineaDeVersion`), y no manda a actualizar si la tienda no la tiene;
- «quedó vieja» compara contra lo que la persona PUEDE tener (`VERSION_EN_TIENDA`), nunca contra el repo. Comparar contra el repo
  era un aviso sin salida para quien ya tenía la última de la tienda. Por lo mismo, `app/` no usa `EXTENSION_VERSION`: `/perfil/instalar`
  decía «Versión 0.74.5» arriba de un botón que da la 0.74.3.
**Trampas que no se ven leyendo la pantalla:**
- **El desplegable de una copia vive en SU carpeta.** El puente contestaba `versionEsperada: EXTENSION_VERSION`, y con eso toda copia
  sin la última se trababa en «Actualiza… quita MaKo y vuelve a cargarla descomprimida» (extension/popup.js). Ese texto no se puede
  cambiar desde acá. Ahora el puente contesta `'0'`, y avisa la web. No sirve mandarlo vacío: `anotarVersionEsperada` no pisa con
  vacío y lo guardado la seguiría trabando. La de la tienda nunca se trabó (`update_url`), por eso se veía sólo en las copias.
- **Una copia y la de la tienda conviven:** tienen id distinto. Si queda la vieja, sigue latiendo con su versión. Por eso el
  instructivo empieza por «Quitar» para quien viene de una copia.
- **`Icon name="descargar"` en «Agregar a Chrome» sigue diciendo «descargar»:** el test frena el ícono también.
**Vive en:** lib/extension-tienda.ts · app/extension/instalar/ · app/perfil/instalar/ · app/video-generator/puente-avisos.tsx,
OnboardingVideoGen.tsx, extension-instalada.tsx · app/_components/AvisoExtensionVieja.tsx · `/extension` en next.config.ts ·
`versionEsperada` en app/api/flow/puente/route.ts · tests/extension-sin-zip-con-tienda.test.ts.

---

## «Extraer» no volvía a MaKo: la memoria de un service worker no es un dato (30/10/2026, 0.74.4)

**Síntoma.** Martín: «aun no veo... que cuando termina de scrapear debe regresar a la app de mako». `volverAMako` estaba desde la 0.74.0.
**Causa probable, leyendo el código (no se midió en su Chrome: no había ninguno conectado).** `volverAMako` salía sin rastro si no encontraba `viva` en
`extraccionesVivas`, un `Map` en memoria. Chrome mata el service worker tras 30 s sin eventos, y guardar los nombres pasa del lado de la página. Si moría antes del
aviso final, el worker revivía con el mapa vacío y no volvía.
**Regla.** Lo que un worker MV3 necesita al final no se recuerda: viene en el mensaje o en `storage`. El aviso final lo manda la pestaña de la extracción, así que
`sender.tab` ES la de origen, y la de WhatsApp Web se busca. Sigue valiendo no sacar a la persona de donde esté si dejó WhatsApp Web.
**Se confirma** cuando Martín extraiga con la 0.74.4: si sigue sin volver, la causa es otra.
**Vive en:** extension/background.js (`volverAMako`, `WA_EXTRACCION`) · tests/wa-extraer-072.test.ts (test de la pestaña de origen).

---

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

- A los clientes les llega desde la Chrome Web Store, cuando Google aprueba. El ZIP es de desarrollo
  (`public/mako-puente-<v>.zip`, lo arma `node scripts/zip-extension.mjs`
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
- **En producción (26/10, 781d069b3, extensión 0.72.3), «Extraer 105» de «Anuncio Ganador - 09,10,11 de Agosto»:** usó la
  pestaña de WhatsApp que ya estaba, entró al grupo, recorrió los 126 y terminó «105 nuevos · 41 nombres · 41 empresas», cada
  lead en Lead entrante con la etiqueta del grupo. ⚠️ **El desplegable NO se abrió en esa corrida, que se disparó con un clic
  por CDP (Claude in Chrome); sí se abrió en otra corrida de la misma hora con un clic de verdad en otra pestaña.**
  `chrome.action.openPopup` pide que la ventana de Chrome tenga el foco del sistema, y un clic por CDP no se lo da (la ventana
  de adelante era la app de Claude). **Regla para probar:** el desplegable se verifica con el clic de una persona (o mirando
  `desplegable` en el registro); que no se abra desde un script no es un error de la extensión.
- **Probar sin desplegar la pantalla:** el mismo pedido que manda MaKo se dispara desde SU pestaña de hola-mako.com con
  `window.dispatchEvent(new CustomEvent('MAKO_WA_FICHAS_PIDO', …))` (el puente lo toma igual), con `pedidos: []` para no leer
  ni guardar datos de nadie. Así se probó la mitad de la extensión en su Chrome real antes del despliegue.
- **Volver a la pestaña EXACTA (0.74.0).** Martín: «puede tener varios CRM abiertos u otras tab de MaKo. Por eso, que
  identifique dónde fue que le dio click». La extracción vuelve a la pestaña que MANDÓ el pedido (el `sender.tab` del
  mensaje, guardado como `origenTab` en el registro), nunca a «la primera de hola-mako.com»; al terminar y también si se corta
  (error, parado, sin respuesta). Si esa pestaña ya no está no elige otra: lo anota (`volver: 'sin_pestana'`) y el desplegable
  lo dice. MEDIDO en su Chrome (26/10): dos CRM y Ads Writer abiertos, pedido desde el segundo CRM, y al terminar quedó al
  frente ése. tests/wa-extraer-072 (3d), probado rompiéndolo: volver a «la primera de MaKo» lo hace fallar.
- ⚠️ **Qué pestaña quedó al frente no se sabe con un script de Claude in Chrome:** `document.visibilityState` y
  `document.hasFocus()` dieron `visible` y `true` en las TRES pestañas de su grupo a la vez. **Regla:** se mira en una
  captura de la tira de pestañas (computer-use, zoom sobre la tira), no preguntándole a la página.

## Los PERFILES de cada contacto (26/10/2026, 0.73.0 → 0.73.6): cinco cosas medidas en vivo, y dos que casi rompen todo

**Vive en:** `leerPerfiles`, `abrirPerfil`, `panelDeContacto(dig)` (extension/wa-recorrer.js) · `perfilDeInfo` (reglas) ·
`WA_PERFILES_PEDIDO` (background.js) · `perfilesEnTandas`, `candidatosDePerfil`, `sumarPerfiles` (lib/wa-fichas-cliente.ts)
· `perfilLimpio` + `completarFichas` (lib/grupo-wa-reglas.ts, app/crm/grupo-wa-server.ts) · tests/wa-extraer-072 (7 a 8).

Martín: «podría entrar a cada perfil y fijarse si tiene links, redes sociales, email». Y del visto: «No importa».
- **El camino que anda** (medido): en «Busca miembros», el buscador encuentra a cada uno escribiendo `+<número>`; tocar la
  fila abre SIEMPRE un menú («Info. del contacto», «Confirmar código de seguridad», «Enviar mensaje a…»); «Info. del contacto»
  abre el panel a la derecha. ~4 s por perfil con la pausa de persona.
- **El texto de cada opción del menú trae pegado el nombre de su ícono** («ic-info…Info. del contacto»): con `^Info` no se
  encontró ninguna (60 de 60 «sin_ver», 0.73.0). Se busca en cualquier parte del texto. **Regla:** en WhatsApp Web, matchear
  el texto de un botón sin anclar al principio.
- ⚠️ **El panel del contacto no es `[role="complementary"]` ni `section`** (11 de 12 «sin_panel», 0.73.2). Y el primer
  arreglo (0.73.3) **leyó TODA la pantalla**: tomó como título la opción «Info. del contacto» del MENÚ, todavía abierto, y
  subió hasta el contenedor de la app; los 12 «perfiles» salieron con la web y el correo de OTROS chats. No se guardó nada
  porque el server no estaba desplegado. **Regla:** un lector de pantalla que va a ESCRIBIR en un lead valida que lo que lee
  es de esa persona: el título no está en un menú, diálogo ni lista; el panel no contiene #side ni #main; y muestra el
  teléfono pedido (`panelDeContacto(dig)`). Sin eso, no se lee.
- ⚠️ **Chrome mata el service worker si UN pedido pasa de 5 minutos**: 60 perfiles en el pedido de fichas (~5 min) terminaron
  en «La extensión no contestó» (0.73.1), sin avance ni respuesta. **Regla:** nada de un pedido largo; la pantalla pide los
  perfiles de a 12 (~1 min cada uno) con el mismo id (`perfilesEnTandas`).
- ⚠️ **La 0.73.6 no cargó por UN carácter, y el diagnóstico obvio fue el equivocado:** «se recargó demasiadas veces» (~10
  recargas solas en una hora; lo dije yo y no era). El Cerebro leyó chrome://extensions: «No se ha podido cargar el archivo
  "wa-fichas.js" para el script de contenido. No está codificado con UTF-8.» El archivo ERA UTF-8 válido, pero traía un
  U+FFFF LITERAL en `IDBKeyRange.bound('false_', 'false_<U+FFFF>')`: Chrome rechaza los NO CARACTERES (U+FFFE/U+FFFF de cada
  plano, U+FDD0–U+FDEF) en un content script, y python, `file` y `node --check` lo dan por bueno. Se coló porque la
  herramienta de edición convirtió la secuencia de escape en el carácter (y un reemplazo por bash se comió la barra otra
  vez). Sin ícono, sin el puente en hola-mako.com, y también sin Flow. **Regla:** la secuencia de escape, nunca el carácter;
  y para escribirla desde un script, armar la barra con `chr(92)`. Lo frena tests/extension-sin-no-caracteres.test.ts
  (probado con este mismo caso). Igual: al iterar en vivo, juntar los cambios y copiar a su carpeta una sola vez.
- **La «carpeta de Martín» (Escritorio\mako-puente) es un ENLACE** a dashboard-marketing-main/dashboard-marketing/extension:
  un clon en `main` muy atrasado. Cada copia «a su carpeta» queda ahí como archivos modificados o sin seguir. Nadie commitea
  en ese clon.
- **Lo de Leandro (los nombres de un grupo donde la gente escribe): el diagnóstico obvio fue el equivocado otra vez.** La
  hipótesis era el `notifyName` de cada mensaje (0.73.5). MEDIDO en «Networking SINDEMEX» (0.73.7, sólo cantidades): el
  rango de claves `false_<grupo>_…` SÍ trae los mensajes del grupo (1.610), pero ninguno tiene `notifyName` ni otro campo con
  el nombre: un mensaje guarda id, autor, hora y un `msgRowOpaqueData` opaco. Esa fuente no existe en las tablas. Lo que sí
  hay: de 231 miembros, 89 con nombre en las tablas, y la lista de miembros muestra **47 «~nombre» más** con su teléfono
  (de la memoria de WhatsApp; los toma el recorrido desde la 0.72). Y al buscar a cada uno por su número para su perfil, la
  fila dice su nombre aunque no tenga teléfono a la vista (`nombreFila`, 0.73.8). **Regla:** antes de leer una tabla nueva,
  mirar qué CAMPOS trae (`mensajes.campos` del diagnóstico); el nombre que se ve en un grupo sale de la pantalla.
  Lo de Leandro en sí: con una extensión de antes de la 0.72 (sin recorrido) sólo salen los de las tablas. Su versión no se
  midió (la lectura de `flow_puentes` en producción pide permiso).

## La corrida que GUARDA perfiles (27/10/2026, 0.74.0 → 0.74.2): cinco corridas en su Chrome, y tres causas que no eran la obvia

**Vive en:** `esperarDatos` y `escribirBusqueda` (extension/wa-recorrer.js) · `DOMINIO_RE` en `perfilDeInfo`
(extension/wa-fichas-reglas.js) · `conLatido`, el «ocupado» y el PARAR de `WA_EXTRACCION` (extension/background.js) · el
corte de los perfiles dicho (app/crm/TraerDeGrupoWA.tsx, app/crm/AccionesLoteLeads.tsx) · tests/wa-extraer-072 (3e, 3f, 7, 7d).

El Cerebro: «la corrida que guarda perfiles ya se puede hacer de punta a punta». Grupo «Anuncio Ganador - 09,10,11 de
Agosto»: sus 108 ya estaban en el CRM, así que no crea leads y sólo llena lo vacío; tiene 41 empresas.
- **Corrida 1: «La extensión no contestó» a los 50 s, con el registro en «buscando».** El diagnóstico obvio (algo roto en la
  0.74) era el equivocado. **La ventana de la app de Claude está maximizada y SIEMPRE VISIBLE (`WS_EX_TOPMOST`) encima de
  Chrome**: Chrome la cuenta como tapada aunque sea la ventana del frente, sus pestañas quedan OCULTAS y Chrome frena sus
  temporizadores (1 por segundo, y pasados 5 minutos ocultas, 1 POR MINUTO). Escribir el nombre del grupo letra por letra (36
  letras) seguía andando diez minutos después. La pantalla de MaKo se rindió a los 30 s sin noticias, y el recorrido quedó
  vivo en WhatsApp Web. Señal: la captura de pantalla muestra la pestaña en GRIS (Chrome no la dibuja) aunque su script
  conteste en menos de un segundo.
- **Corridas 2 y 3: «0 nombres» y nada más.** Chocaron con ese recorrido colgado («ocupado», en el recorrido y en los
  perfiles) y siguieron como si nada: sin recorrido, sin perfiles, y el corte de los perfiles no se decía en ninguna parte.
- **Corrida 4 (Claude minimizada): recorrió los 126 en ~15 s y abrió 42 perfiles de 60. Datos: 0.** Volvió a la pestaña de
  origen (la 0.74.0 anda).
- **Corrida 5 (0.74.1, con la web sin «https://»): 25 con datos guardados (21 webs, 18 correos, 1 Instagram, 2 redes)**,
  verificados en la ficha de un lead (la web en «Redes y web», el correo en «Contacto»). Capturas: notas del Cerebro,
  capturas-perfiles-guardados.
- **Y otra vez el diagnóstico obvio era sólo una parte:** la primera hipótesis fue la web escrita sin «https://» (así estaba en
  el texto del primer panel, y WhatsApp no la dibuja como link). Pero el MISMO primer panel, en la corrida 5, mostraba además la
  web con «https://», el correo y la dirección, que en la corrida 4 no estaban: **los datos de una cuenta de empresa llegan un
  instante DESPUÉS de abrir su panel** (WhatsApp los pide), y el lector leía en el acto. La 5 los encontró porque ya estaban
  en la memoria de WhatsApp de la corrida anterior. La 0.74.2 espera a que el panel deje de cambiar (si es de empresa y no
  muestra ningún dato, hasta 4 s) y lee el panel como quedó.
- **Reglas:** (1) un lector de un panel que se llena solo espera a que deje de cambiar antes de leer; (2) un paso largo de la
  extensión le manda un latido a la pantalla que espera (cada 10 s, sin texto), y cuando la pantalla da una extracción por
  terminada, lo que siga andando en WhatsApp Web se PARA; (3) «ocupado» y un corte de los perfiles se DICEN; (4) con la pestaña
  oculta no se escribe letra por letra; (5) una web sin «https://» se toma sólo con «www.» o una terminación que no sea una
  palabra («viernes.De 9 a 18» no es una web), y nunca el dominio de un correo.
- **Para probar algo a la vista en su Chrome desde un chat:** mirar qué ventana está al frente y qué la tapa (Claude es
  siempre visible); minimizar Claude SÓLO si no tocó teclado ni mouse en los últimos 2 minutos (`GetLastInputInfo`), y
  restaurarla al terminar. `open_application("Google Chrome")` NO trae su ventana: abre otra suelta (el selector de perfiles),
  que hay que cerrar.

## El tiempo de cada etapa y la pestaña oculta, en el registro (27/10/2026, 0.74.3) · el aviso de extensión vieja en toda la app

**Vive en:** `anotarExtraccion` y `WA_RECORRER_AVANCE` (extension/background.js) · el `oculta` de wa-recorrer.js · el
desplegable · `AvisoExtensionVieja` (app/_components) · tests/wa-extraer-072 (3g), aviso-extension-vieja-app.

- Leandro: «se tarda mucho»; con Aaron se trabó; la corrida del 26/10 quedó en «11 de 126». **Medido el 27/10** en el
  Chrome de Martín: a la vista, el recorrido de 126 miembros tarda ~15 s y cada perfil ~4,4 s (60 en ~4,5 min); con
  Chrome TAPADO, escribir el nombre del grupo seguía diez minutos después. El trabón es la pestaña oculta (ver «La corrida
  que GUARDA perfiles»). Ahora cada fila del registro guarda en qué segundo empezó cada etapa (`tiempos`) y cuánto tardó
  (`duracion`), y si WhatsApp Web corrió oculta (`oculta`, `vecesOculta`); el desplegable y la pantalla de MaKo dicen
  «Chrome quedó tapado por otra ventana y así va lento: tráelo al frente». Un «tarda» se lee en el registro de quien lo dijo.
- **Leila estaba en la 0.70 con la 0.74 vigente.** El aviso de extensión vieja vivía sólo en las pantallas de video; ahora
  va en la esquina de toda la app (con sesión), y lleva al instructivo. Que se actualice SOLA pide la tienda de Chrome al
  día (`VERSION_EN_TIENDA`, lib/extension-tienda.ts): una descomprimida no se actualiza nunca. Es un paso de Martín.

## La Chrome Web Store: la versión publicada se MIDE (27/10/2026)

**Vive en:** `VERSION_EN_TIENDA` (lib/extension-tienda.ts) · scripts/version-en-tienda.mjs ·
tests/extension-sin-zip-con-tienda · la ficha para subir, en
feedback/chrome-web-store/ficha-y-permisos.md (fuera del repo).

- **Tres números para el mismo dato, y dos eran recuerdos.** El pedido decía «la tienda tiene la 0.1.0» (una memoria), el
  código decía 0.5.0 (medido el 02/09) y lo medido el 27/10 con `node scripts/version-en-tienda.mjs` fue la **0.39.1**. La
  versión de la tienda se mide antes de decidir, nunca se copia de un comentario. Y `publicar-extension.mjs --estado` no
  sirve para esto: devuelve el borrador (lo último que se subió), no lo que Google aprobó.
- **Google compara la ficha contra el manifest y contra la política.** Al escribir la ficha se vio que /privacidad/extension
  no decía que, desde la 0.73, la extensión abre el perfil de cada miembro (71d0e5682 lo corrigió). Antes de subir una
  versión, releer la política contra lo que hace esa versión.
- **La subida por API murió sin avisar** (medido el 29/10): `publicar-extension.mjs` respondió `deleted_client` («The
  OAuth client was deleted»). Las tres `CWS_*` siguen en el `.env.local` del clon principal, así que el script NO dice
  «faltan credenciales»: falla recién al pedir el token. Alguien borró la credencial de escritorio en Google Cloud. El
  diagnóstico obvio («vencido el refresh token, se canjea otro») es el equivocado: sin cliente no hay qué canjear; hay que
  crear la credencial de nuevo (pasos 1 a 4 de `--ayuda`). Mientras tanto, el camino es el panel del desarrollador. Y la
  API nunca cambia la ficha (descripción, capturas): eso es siempre desde el panel.
- **El panel de la tienda se maneja con un Chrome APARTE por CDP, no con Claude in Chrome** (29/10, así se subió la
  0.74.3). En chrome.google.com/webstore Chrome le niega a toda EXTENSIÓN leer, tocar o capturar («The extensions gallery
  cannot be scripted»), y el navegador de la app no la abre. Un cliente CDP de afuera sí puede:
  `chrome.exe --user-data-dir=C:devchrome-tiendaperfil --remote-debugging-port=9334 <devconsole>` (Chrome 136+
  ignora el puerto sobre el perfil por defecto). Martín entra UNA vez con martinkoncke@gmail.com (la sesión queda en ese
  perfil) y el resto es `Runtime.evaluate`, `DOM.setFileInputFiles` (el zip y las imágenes) y clics.
  - **Trampa: un valor puesto por JS no siempre se guarda.** La descripción sí (el contador cambió); la pestaña de
    Privacidad decía «Item saved.» y al recargar volvía al texto viejo. Se guardó recién con la ventana adelante
    (`Page.bringToFront` + `Emulation.setFocusEmulationEnabled`), clic real en el campo, Ctrl+A y `Input.insertText`.
    Después de guardar, se RECARGA y se relee: el «Item saved.» no prueba nada.
  - **Trampa: «Remove image» abre un diálogo de confirmación**, y varios clics por JS apilan diálogos que después borran
    lo que no era (se llevó el ícono NUEVO). De a uno y mirando.
  - **Trampa: tras borrar el ícono y el mosaico, las subidas a esos lugares dieron 503 varios minutos** (las capturas sí
    subían). A los ~2 min volvió a andar. Y la sesión de Google que importa es la del PERFIL que maneja Claude.
- **El `.env.local` de las credenciales es el del clon principal** (dashboard-marketing/), no el del worktree del tren, y
  `public/mako-puente.zip` no se versiona: en el tren no existe. Para subir desde el tren hay que cargar las `CWS_*` en el
  entorno (dotenv no pisa lo que ya está) y poner el zip; el de la tienda está en feedback/chrome-web-store/.

## Subir a la tienda por el panel: lo que corrige la subida de la 0.74.5 (3/11/2026)

- **La sesión de Google no dura:** a los 5 días pidió de nuevo la contraseña en ese perfil. «Martín entra UNA vez» era falso: puede tocar en cada subida.
- **El zip ya se versiona:** `git show origin/main:public/mako-puente-<versión>.zip`. Un `git archive` pelado no sirve: `manifestParaPaquete` (`scripts/zip-extension.mjs`) le saca los `localhost` al manifest, porque un permiso sin uso es motivo de rechazo.
- **Rutas del panel:** las pestañas cuelgan de `/edit/` (`/edit/status`, `/edit/package`, `/edit/privacy`, `/edit/listing`); sin `/edit/` dan 404.
- **Subir:** «Upload new package» abre un `input[type=file]`, `DOM.setFileInputFiles` anda, y el panel salta a Store listing sin avisar: la versión se confirma recargando Package.
- **Cerrar ese Chrome con `Browser.close` por CDP:** `taskkill` sin `/F` no alcanza, y forzarlo arriesga las cookies recién guardadas. Cliente CDP: `scripts/cdp-tienda.mjs`.
- **Google avisa que la revisión puede tardar semanas:** al aprobar, `node scripts/version-en-tienda.mjs` y actualizar `VERSION_EN_TIENDA` en `lib/extension-tienda.ts`.

## Sin hacer

- **Publicar la 0.74.5:** la tienda sigue en la 0.74.3 (medido el 3/11), así que lo de la 0.74.4 y la 0.74.5 no le llega a nadie
  que instale desde ahí. Ya no le devuelve el zip a nadie, pero sigue pendiente. Quedó el mosaico GRANDE viejo (1400x560, «Tus
  anuncios… Google Flow»): opcional, reemplazarlo en la próxima versión. La rama `tienda-cws-2710` ya no hace falta.
- **Volver a crear la credencial de la API de la tienda** (`--ayuda`, pasos 1 a 4; la autorización es de Martín), para que
  cada versión nueva se suba con un comando.
- **Sacar la pantalla «Actualiza la extensión» de extension/popup.js** en la próxima versión que se suba. Con `versionEsperada: '0'`
  ya no se muestra, y no se tocó ahora para no sumar una versión más que la tienda no tiene.
- **Las copias con una versión igual o más nueva que la tienda** no ven ningún aviso: siguen sin actualizarse solas hasta que la
  tienda las pase, y recién ahí se les pide cambiarla. No se las empuja antes, y no se midió cuántas son (`flow_puentes.version`
  dice la versión, no si es copia).
- **No se recorrió en un navegador:** el instructivo y el perfil se dibujan en el test (`renderToStaticMarkup`), y el botón del
  Video Generator se lee en el fuente. Mirarlo en producción, con Chrome sin la extensión, la primera vez que se pueda.

- **Cuántos llegan sin teléfono** (Aaron: WhatsApp esconde números en grupos): medirlo en un grupo con la pantalla de
  «Traer de grupo» (`sinNumero`) y en el registro, antes de construir nada.
- **La 0.74.2 en vivo (la espera de los datos de empresa)**: copiada a su carpeta el 27/10, sin correr: Chrome se cerró
  (RAM libre 0,7 GB) antes de la corrida. Probarla en un grupo que NADIE abrió (sin la memoria de WhatsApp), con todos ya en
  el CRM para no crear leads: «16, 17 y 18 de JUNIO» (247) o «19, 20, 21 de Octubre» (158). Medir `conDatos` y `esperaMs`.
- **La versión de la extensión de Leandro** (`flow_puentes.version` del negocio de Leandro, o su chrome://extensions): si es
  anterior a la 0.72, ahí está su «no extrajo nada». Y el `notifyName` de la 0.73.5 quedó sin uso (los mensajes no lo traen):
  sacarlo si en otro WhatsApp Web tampoco aparece.
- **Los «@usuario» de la lista de miembros** (visto el 26/10 en «09,10,11 de Agosto»: filas como «@MiguelCarrenoDonado /
  Michelangelo Marketer»): WhatsApp ya muestra nombres de usuario, sin teléfono a la vista. `nombresDeFilas` sólo toma el
  «~nombre» con su teléfono, así que esas filas no suman. Medir cuántas son y si el `@lid` las cruza antes de construir.
- **El desplegable en su estado final («listo»)** no se capturó: vuelve a MaKo a los 4 s y se cierra. Se ve en su registro.
- **La pantalla del QR, medida:** la primera vez que un cliente (o un perfil aparte) llegue con la sesión cerrada, mirar que
  el desplegable diga «Escanea el QR» y no «cargando».
- **El panel del contacto** (categoría, web, correo, estado, catálogo): `business-profile` no los trae (sólo bots). Medir
  antes de construir.
- **El rubro filtrable en el CRM**: hoy no llega por ningún camino gratis (las tablas no traen la categoría).

## Leer un sitio ajeno sin que Chrome desactive la extensión (03/11/2026, Cerebro)

Para «Guardar en Spy» alcanza con `activeTab`: lee la pestaña sólo al tocar el ícono. Según la documentación de Chrome no muestra advertencia, y por eso no debería desactivar la extensión al actualizar; sin medir. Un permiso de sitios, en cambio, sí la desactiva hasta que cada cliente lo acepte. Igual pasa por revisión, y la descripción y `app/privacidad/extension/page.tsx` ya lo dicen (0.75.0). Detalle: docs/hallazgos-competitors-spy.md, entrada «Guardar en Spy».

## Probar la extensión de verdad sin una persona y sin producción (03/11/2026, Chrome 156)

Un test con `vm` prueba las reglas; esto prueba el permiso, el clic y la inyección. Costó cuatro vueltas, y es corto:

- **Cargarla:** `--remote-debugging-pipe --enable-unsafe-extension-debugging` y `Extensions.loadUnpacked`. Con Chrome oficial, `--load-extension` ya no sirve. Siempre `--headless=new --mute-audio`, y cerrar por su PID.
- **El clic en el ícono:** `Extensions.triggerAction`, y ⚠️ **sobre el target de tipo `tab`, no `page`** («Action can only be triggered on a tab target»): sale de `Target.getTargets` con `filter: [{ type: 'tab', exclude: false }]`. Eso sí otorga `activeTab`. `chrome.action.openPopup` no: es el control negativo.
- ⚠️ **El desplegable llega como `other`, sin dirección y pausado** con `waitForDebuggerOnStart`; recién después dice que es `popup.html`. Buscarlo por la URL no lo encuentra nunca. Y cualquier otro target hay que soltarlo con `Runtime.runIfWaitingForDebugger`: un worker sin soltar contesta «chrome is not defined».
- **Sin tocar producción:** `--host-resolver-rules=MAP hola-mako.com 127.0.0.1:9` (el worker con un token de mentira no le habla a nadie) y `Fetch.enable` en el desplegable ANTES de soltarlo, para contestar lo que iría a MaKo con el intérprete real.
- La herramienta de edición volvió a escribir `\u0300` como el carácter literal (ver «Ningún archivo trae un no carácter»). En la extensión, `\p{M}` y `\p{Cf}` no tienen ese problema.
