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

## Sin hacer

- **La cobertura real sobre los 221 con la 0.71** (cuántos con nombre por `displayNameLID` y por `@lid`): sale de la primera
  corrida de Martín con la 0.71 desplegada (la pantalla la dice al terminar).
- **El panel del contacto** (categoría, web, correo, estado, catálogo): `business-profile` no los trae (sólo bots). Medir
  antes de construir.
- **El rubro filtrable en el CRM**: hoy no llega por ningún camino gratis (las tablas no traen la categoría).
