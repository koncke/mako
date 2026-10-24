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
- **Un permiso de sitio nuevo (0.70.0: `web.whatsapp.com`)**: en una extensión desempaquetada entra al recargar. Desde la
  tienda, Chrome **desactiva** la extensión hasta que la persona acepta el permiso nuevo. Cuando se publique en la tienda, el
  aviso a los clientes tiene que decirlo, o «la extensión dejó de andar» va a ser el ticket.
- **Una pestaña abierta antes de instalar o actualizar no tiene el content script nuevo.** El worker lo detecta (el
  `sendMessage` falla) y la pantalla dice «Recarga la pestaña de WhatsApp Web». No es un error del código.

## Sin hacer

- **La cobertura real sobre los 221** (cuántos con nombre, con empresa y en 2 o más grupos): sale de la primera corrida de
  Martín con la 0.70 (lo muestra la pantalla al terminar), junto con el `diagnostico` de qué tablas tiene su WhatsApp Web.
- **El panel del contacto** (categoría, web, correo, estado, catálogo): ver arriba. Medir antes de construir.
- **El rubro filtrable en el CRM**: hoy no llega por ningún camino gratis (las tablas no traen la categoría).
