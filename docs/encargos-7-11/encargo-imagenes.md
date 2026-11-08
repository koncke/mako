# Encargo: Editor de imágenes — 25 pendientes (7/11/2026)

**Qué es esto.** La lista depurada de pendientes de MaKo: de 634 anotadas el 6/11 quedaron 232 de
trabajo real (`docs/pendientes-depurados-7-11.md`). Éstos son los de tu área, ordenados por el
criterio de Martín: **cliente roto > plata > traba > features**.

## ⚠️ LEÉ ESTO ANTES DE TOCAR CÓDIGO, porque es lo que más tiempo ahorra

El 7/11 se verificaron los cuatro primeros de la lista **y tres estaban ya resueltos**. El
inventario es una foto del 6/11 y entre el 6 y el 7 entraron 601 commits a main.

**Entonces: por cada ítem, PRIMERO verificá contra el código que el síntoma siga existiendo.** Si ya
no existe, escribilo y pasá al siguiente — eso vale tanto como arreglarlo.

Tres trampas medidas ese día, las tres reales:

1. **Un pendiente que enumera «N puntas atadas» envejece punta por punta, no entero.** En «la cadena
   de pago sale del dominio del cliente», tres de cuatro puntas ya estaban hechas y el título seguía
   igual que el primer día.
2. **Un pendiente anotado muchas veces NO es más urgente: es uno que se contó muchas veces.** El más
   repetido del inventario (4 entradas) describía un recuadro gris que se había sacado el día anterior.
3. **Si dice «el número X está mal, debería ser Y», fijate si X e Y son del mismo período.** Uno decía
   «US$238 está mal, es US$426»: eran noviembre y diciembre, los dos correctos. «Arreglarlo» rompía
   noviembre.

## Cómo se entrega

Una punta por tema: `git push origin HEAD:refs/heads/punta/<nombre>`. Llega sola a `main` con verde
(`.github/workflows/punta.yml`). **`integracion` se retiró el 4/11: un push ahí da rojo a propósito.**
No hace falta esperar a que termine la anterior.

⚠️ **«En main» no es «en producción»:** el deploy lo hace un cron a las 11:05 UTC.

Lo que aprendas va a `docs/hallazgos-<área>.md` **en el mismo commit**, y el índice
`docs/hallazgos.md` se actualiza ahí mismo. Sobre todo **cuando el diagnóstico obvio era el
equivocado**: eso es lo que más tiempo ahorra después.

---

### 1. El comentario de cabecera de las plantillas miente dos veces

_plata · chico_

En plantillas.ts, el comentario de cabecera dice «el credito ya se muestra» (falso: Martin lo saco el 29/10) y «el TEXTO del lienzo sigue en ingles porque la miniatura lo muestra asi» (falso desde el 14/10: b9a7dae2f lo paso a espanol y redibujo las miniaturas; bold-sale-announcement.json dice «FIN DE TEMPORADA»). Ese comentario ya hizo que un plan repitiera el error hasta la revision. HECHO cuando las lineas 4-13 digan lo que el codigo hace hoy.

**Dónde:** `C:/dev/wt-puntas/app/image-editor/mako/plantillas.ts:4-13 · C:/dev/wt-puntas/docs/hallazgos-editor-imagen.md:553-557 · docs/plantillas-reales/image.md 5.1`

### 2. Reemplazar `_doory/` de a poco para que la licencia deje de aplicar

_plata · grande_

Martin saco el credito visible de Doory el 29/10 a su riesgo, pero la Attribution Assurance License sigue aplicando mientras quede codigo suyo, y «in whole or part, with or without modification»: un archivo adaptado alcanza. Hoy `_doory/` son 444 archivos y ~39 mil lineas. El orden medido esta en la tabla: 1) editor/chrome (8 archivos, 630 lineas), 2) editor/strings.ts (1.509), 3) editor/workspace (34 / 4.053), 4) editor/panels (41 / 4.866), 5) editor/dialogs + ui (57 / 5.521), 6) toolbar + drawers + fonts + presenter (58 / 6.617), ultimo editor/engine (107 / 14.924). Cada parte se escribe desde lo que HACE, no copiando y renombrando: renombrar no deja de ser derivado. HECHO cuando no quede ningun archivo de `_doory/`.

**Dónde:** `C:/dev/wt-puntas/docs/hallazgos-editor-imagen.md:45-63 (la tabla con el orden) · C:/dev/wt-puntas/app/image-editor/_doory/ · C:/dev/wt-puntas/app/image-editor/_doory/LICENSE-DOORY`

### 3. La subida de una foto del chat no tiene plazo

_traba · chico_

El XHR va sin `timeout` (copiado de app/customer-success/curso/): con la red trabada, «corriendo» espera a que el navegador se rinda y la persona no sabe que paso. HECHO cuando la subida tenga plazo y, al vencerse, lo diga en «No se aplica» sin tirar el pedido.

**Dónde:** `C:/dev/wt-puntas/docs/hallazgos-editor-imagen.md:736 · el `useAdjuntosDelChat` del chat de Image · C:/dev/wt-puntas/app/customer-success/curso/ (de donde se copio)`

### 4. Tanda 5: lo de Canva que Doory no trae

_traba · grande_

Notas adhesivas, dibujo y tablas (drawers/ToolsPanel.tsx), copiar estilo, lineas en codo y curva, texto alternativo, descargar la seleccion, bloquear y ocultar pagina, «Ir a la pagina». Los 8 paquetes estan en orden en el relevamiento. HECHO cuando cada paquete tenga su fila marcada en ese documento.

**Dónde:** `C:/dev/wt-puntas/docs/editor-imagen/relevamiento-canva-funciones.md (los 8 paquetes) · C:/dev/wt-puntas/docs/hallazgos-editor-imagen.md:454-455 · C:/dev/wt-puntas/docs/relevo/image-editor.md:61`

### 5. Las 10 plantillas de Doory salieron de «Nuevo diseno» pero NO se borraron

_traba · mediano_

Siguen en el panel «Diseno» del editor y en la API (`plantillas`). El plan pide borrarlas con sus JSON y sus WebP. Toca el panel del editor, la API y TRES tests, y dos se rompen a proposito (el 1 de plantillas-crear, «primero lo en blanco», y el 5, la lista literal PLANTILLAS_NUEVO_DISENO): se reescriben con el cambio, no se fuerzan. El relevo de plantillas lo deja explicitamente «para el chat de Image». HECHO cuando no quede ningun slug de Doory en el panel ni en la API y los tres tests esten reescritos y verdes.

**Dónde:** `C:/dev/wt-puntas/app/image-editor/mako/plantillas/ · public/cv/plantillas/ · tests/api-mako-imagen, tests/plantillas-sugeridas-editores, tests/_bloques-tarjeta-hijo · C:/dev/wt-puntas/docs/relevo/nube-plantillas.md:70-73 · docs/plantillas-reales/image.md §5 punto 3`

### 6. Brand board (PDF) en el Segundo Cerebro y varios kits de marca

_traba · grande_

Que MaKo pida el brand board en el onboarding, lo guarde en el Second Brain y lo ofrezca al entrar a cualquier editor («lo hacemos con tu turquesa?»), soportando varios kits (el de ella y el de sus clientes). Sin esto fallan los carruseles.

**Dónde:** `docs/relevo/pendientes-pc/auditoria-pedidos-5-11.md:44 (2.9) · app/second-brain/ · app/onboarding/ · lib/image-editor/chat/ia.ts · lib/editor-video/chat-catalogo.ts`

### 7. «Tus plantillas» de Image no esta en el telefono

_feature · mediano · ⟳ estaba anotado 2 veces_

La pantalla del telefono usa la lista de MaKo y no monta `usePlantillasPropias`, asi que las plantillas propias y «De la comunidad» solo se ven en la computadora. Lo mismo «Hacer el mio» y «Ver ejemplo» de carruseles: en el telefono se crea con la plantilla, sin el dialogo. HECHO cuando en /m/image-editor se vean «Tus plantillas» y «De la comunidad» y se pueda crear desde una.

**Dónde:** `C:/dev/wt-puntas/app/m/image-editor/InicioImagenM.tsx · C:/dev/wt-puntas/docs/relevo/nube-plantillas.md:41 · C:/dev/wt-puntas/docs/hallazgos-editor-imagen.md:798-800`

<details><summary>Las otras formas en que estaba escrito</summary>

- «Tus plantillas» no existe en el teléfono
</details>

### 8. La iniciativa de Image (T12): falta la sugerida de la familia, el slug y la guia de la pestania

_feature · mediano · ⟳ estaba anotado 2 veces_

La apertura con el diseno en blanco («Donde lo vas a publicar?» -> historia 1080x1920, carrusel 1080x1350, anuncio 1080x1080) esta hecha y probada. Faltan tres: (a) «la sugerida de esa familia» como cuarta respuesta, que llega con las plantillas reales; (b) guardar el slug de la plantilla elegida; (c) la GUIA de la pestania (anclas por `donde` sobre sus `data-testid`), que en Image no existe. Y la miniatura de YouTube quedo afuera de la apertura por el tope de cuatro botones (MAX_BOTONES): sigue solo en el panel de tamano. HECHO cuando las tres filas de Image en la tabla de guia.md §6 esten marcadas.

**Dónde:** `C:/dev/wt-puntas/lib/aperturas/image.ts · C:/dev/wt-puntas/app/image-editor/mako/chat/PanelMakoIA.tsx · tests/iniciativa-image.test.ts · C:/dev/wt-puntas/docs/relevo/nube-iniciativa.md:46 · docs/mako-iniciativa/guia.md §6`

<details><summary>Las otras formas en que estaba escrito</summary>

- La iniciativa de MaKo en Image está a medias
</details>

### 9. Las plantillas del editor de imagen: borrar las 10 de Doory y las preguntas al crear

_feature · chico_

Borrar las 10 plantillas de Doory del editor y de la API, las fotos de muestra del ejemplo, y las preguntas al crear (detalle en docs/relevo/nube-plantillas.md). Hecho = la galería de Image no muestra las de Doory y crear no pregunta.

**Dónde:** `C:/dev/wt-puntas/app/image-editor/ · lib/api-mako/areas/ (imagen) · C:/dev/wt-puntas/docs/relevo/nube-plantillas.md · pendiente en C:/dev/wt-puntas/docs/hallazgos-plantillas.md:125`

### 10. La visión de `leerDocumentoIA` no pasa por `sinGemini`

_feature · chico_

Image ya corre sin Gemini (`deSuIA`, `fallback: []`), pero leer una IMAGEN del manual de marca sigue usando el Gemini del negocio si es lo único que tiene. Queda como inconsistencia declarada (D6b).

**Dónde:** `C:/dev/wt-puntas/lib/ai-cheap.ts (sinGemini) ; lib/marca/leer-manual.ts ; docs/relevo/nube-image-marca.md:61-62`

### 11. «MaKo pide la marca cuando falta» quedó como un link, no como apertura

_feature · chico_

Es un link en el saludo del chat de Image, no una apertura de `lib/aperturas/` (el chat de Image no monta `AperturaMako`). Si se quiere el formato de apertura, es trabajo del chat que lleva las aperturas.

**Dónde:** `C:/dev/wt-puntas/docs/relevo/nube-image-marca.md:58-59 ; lib/aperturas/ ; app/image-editor/mako/chat/`

### 12. `contenidoNoConfiable` no neutraliza una etiqueta de cierre con espacio

_feature · chico_

`</etiqueta >` (con espacio antes del >) pasa sin neutralizar. Lo usan TODOS los prompts de MaKo, no solo el chat de Image; en este chat el texto es de la misma persona, asi que aca el riesgo es bajo, pero vive en una funcion compartida. HECHO cuando el test cubra la variante con espacio y pase.

**Dónde:** `C:/dev/wt-puntas/lib/prompt-render-pure.ts (contenidoNoConfiable) · C:/dev/wt-puntas/docs/hallazgos-editor-imagen.md:696`

### 13. Tres trampas chicas del motor y del CSS que quedaron anotadas sin arreglar

_feature · chico_

(a) `ui/Menu` no tiene el prop `overModal` y no se da vuelta hacia arriba: abierto desde la barra inferior tapa su propio boton (la lista del zoom lo esquiva con Popover placement="top"). (b) En un enlace de solo lectura, una pagina angosta pierde el tamano. (c) Los 30 tamanos de Canva menos usados y «Tamano personalizado» viven SOLO en Redimensionar, no en el Inicio ni en el popover de la pagina. HECHO una por una, con su test.

**Dónde:** `C:/dev/wt-puntas/app/image-editor/_doory/editor/ui/Menu.tsx · _doory/editor/dialogs/resizeSizes.ts · C:/dev/wt-puntas/docs/hallazgos-editor-imagen.md:180-182, 541-542, 697`

### 14. El plano del editor (diseno-editor-imagen.md) describe cosas que ya no existen

_feature · chico_

Todavia habla de `inicio/`, de Proyectos, de Noto Sans y del violeta de Canva (reglas 2 y 9), y nada de eso es asi desde el 29/10 (los --cv-* son los tokens de MaKo, la tab monta app/_crear/PantallaCrear.tsx y Noto Sans entra como hoja de Google desde el navegador). Un plano que miente ya hizo repetir el error del texto en ingles. HECHO cuando las reglas 2 y 9 digan lo que el codigo hace hoy.

**Dónde:** `C:/dev/wt-puntas/docs/diseno-editor-imagen.md (reglas 2 y 9) · C:/dev/wt-puntas/docs/hallazgos-editor-imagen.md:539-542`

### 15. Los motivos de «No se aplica» estan escritos para el programador

_feature · chico_

Los descartes que ve la persona dicen cosas como «estilo no es algo de...». Tienen que decir, en el idioma de un dueno de negocio, que no se pudo y por que. HECHO cuando ningun motivo visible nombre un campo del JSON.

**Dónde:** `C:/dev/wt-puntas/lib/image-editor/chat/catalogo.ts (validarOperacion, los motivos) · C:/dev/wt-puntas/docs/hallazgos-editor-imagen.md:700`

### 16. Dos propuestas pendientes del chat duplican las paginas

_feature · chico_

Pedir de nuevo no cierra la propuesta anterior: aceptar las dos duplica las paginas. Hoy pide dos clics y sale el aviso «Cambiaste el diseno», pero el agujero esta. HECHO cuando un pedido nuevo cierre o invalide la propuesta anterior, probado aceptando las dos.

**Dónde:** `C:/dev/wt-puntas/app/image-editor/mako/chat/acciones.ts · C:/dev/wt-puntas/docs/hallazgos-editor-imagen.md:695`

### 17. «Cambiar nombre» de un diseno usa window.prompt

_feature · chico_

Sigue siendo el cuadro del navegador. Tiene que editarse EN EL LUGAR, como el Web Generator. Lo mismo «Nombre de la busqueda» del explorador de carruseles (ExplorarCarruseles.tsx:213). HECHO cuando renombrar sea un campo en la tarjeta y no un prompt del navegador.

**Dónde:** `C:/dev/wt-puntas/app/image-editor/ImageEditorCliente.tsx:115 · C:/dev/wt-puntas/app/image-editor/carruseles/ExplorarCarruseles.tsx:213 · C:/dev/wt-puntas/docs/hallazgos-editor-imagen.md:540`

### 18. Borrar `_doory/editor/collab`: la co-edicion esta apagada

_feature · chico_

18 archivos y 4.396 lineas de co-edicion que no corren (decision 6 de docs/diseno-editor-imagen.md). Borrarlo no es reemplazarlo: es el trozo mas barato de sacar de encima de la licencia. HECHO cuando la carpeta no exista, el typecheck acotado de app/image-editor este limpio y el editor abra y guarde igual.

**Dónde:** `C:/dev/wt-puntas/app/image-editor/_doory/editor/collab/ · C:/dev/wt-puntas/docs/hallazgos-editor-imagen.md:60`

### 19. Tanda 4: alojar las fuentes nosotros en vez de jsDelivr

_feature · mediano_

Hoy las 499 variantes salen de jsDelivr. Un archivo frio tardo 12,6 s y el motor corta la carga a los 8 s (`LOAD_TIMEOUT_MS`): la primera vez el texto puede caer a la fuente del sistema SIN error, y el chat ya pierde texto por fuentes que el editor no tiene. Alojarlas saca el problema de raiz. Regla que queda: nada de `next/font/google` (rompio el build de produccion de todos los chats el 15/10, porque baja la fuente AL COMPILAR); si hace falta, `next/font/local` con el woff2 en el repo. HECHO cuando las fuentes se sirvan de nuestro origen y una carga en frio no caiga a la del sistema.

**Dónde:** `C:/dev/wt-puntas/app/image-editor/mako/fuentes.ts · C:/dev/wt-puntas/app/image-editor/_doory/editor/engine/fonts.ts (LOAD_TIMEOUT_MS) · C:/dev/wt-puntas/docs/hallazgos-editor-imagen.md:216-225 y 375-390`

### 20. El adaptador del editor tiene marca, stock, versiones, compartir y comentarios en `null`

_feature · grande_

Cinco servicios del editor devuelven null y piden tablas propias. Ojo: la marca del negocio (kits en app_settings, 5/11) entro por el PROMPT del chat de Image, no por este hueco: el panel «Marca» del editor sigue vacio. HECHO cuando cada uno tenga su tabla y su pantalla, o cuando el documento diga cual se descarta y por que.

**Dónde:** `C:/dev/wt-puntas/app/image-editor/mako/adaptadorNube.ts:147-151 (brand, stock, versions, sharing, comments) · C:/dev/wt-puntas/docs/hallazgos-editor-imagen.md:461`

### 21. Del armazon de Canva faltan siete detalles

_feature · mediano_

La vista rapida al pasar el mouse por el riel y la pestania «Estilos» de Diseno (chrome/RielCanva.tsx); la mini-barra pegada a la seleccion (falta la posicion en pantalla del objeto); las marcas de la regla con la posicion del elemento (workspace/Rulers.tsx); el «...» por mosaico de la cuadricula (workspace/PageGrid.tsx); «Editando ▾» y el avatar (no hay modos ni co-edicion, puede ir a la basura con collab); y «Carpetas» en Proyectos. HECHO uno por uno, mirandolo al lado de Canva.

**Dónde:** `C:/dev/wt-puntas/app/image-editor/_doory/editor/chrome/RielCanva.tsx · workspace/Rulers.tsx · workspace/PageGrid.tsx · C:/dev/wt-puntas/docs/hallazgos-editor-imagen.md:456-459`

### 22. Un SVG subido se guarda como PNG y se pierde el vector

_feature · mediano_

El bucket de Supabase no acepta SVG ni AVIF (un SVG es un documento activo bajo su dominio), asi que el adaptador los dibuja a PNG antes de subir. Canva conserva el SVG vectorial. Para conservarlo hay que sanearlo en el server y servirlo desde un origen SIN cookies. HECHO cuando un SVG subido se agrande sin pixelarse y el export siga saliendo.

**Dónde:** `C:/dev/wt-puntas/app/image-editor/mako/nube.ts (aRaster) · C:/dev/wt-puntas/docs/hallazgos-editor-imagen.md:344-345 y 462-463`

### 23. Lo que el chat del editor todavia no sabe hacer

_feature · grande_

La lista literal que la IA declara imposible: agregar iconos o graficos de la biblioteca; poner una foto que no este en «fotos»; generar imagenes con IA; quitar el fondo; recortar o cambiar el encuadre; filtros y ajustes de foto; degradados; animaciones; agrupar y desagrupar; cambiar el tamano del diseno (Redimensionar); usar una plantilla; tablas, graficos de datos y codigos QR; y lo que va adentro de un grupo. Las fotos SI se cerraron el 30/10 (agregar_foto y fondo_foto). Dos atan a otros pendientes: quitar fondo esta apagado en el motor, y Claude no genera imagenes (las skills copiables estan atadas a Gemini o Nano Banana). HECHO cada vez que una operacion salga de esa constante con su validacion, su aplicacion y su test.

**Dónde:** `C:/dev/wt-puntas/lib/image-editor/chat/catalogo.ts:96-97 (NO_SE_PUEDE_CHAT_IMAGEN) · app/image-editor/mako/chat/acciones.ts · C:/dev/wt-puntas/docs/hallazgos-editor-imagen.md:445-446`

### 24. El chat de Image en la API de MaKo: las tandas 2 y 3 nunca se hicieron

_feature · grande_

Tanda 2: las operaciones del chat que PROPONEN, con su tabla de propuestas. Tanda 3: «entender el pedido», o sea /api/mako/pedidos con `tab: 'imagen'` ANTES de la IA, como ya lo hace el Video Editor (app/video-editor/_opencut/chat/pedidos.ts). Los objetos del area `imagen` ya estan en el server. Se dejaron para despues del 90 % semanal de claude3 el 16/10 y nunca se retomaron. HECHO cuando por la API (o por WhatsApp) se pueda pedir un cambio al diseno abierto y quede como propuesta.

**Dónde:** `C:/dev/wt-puntas/lib/api-mako/areas/imagen.run.ts · C:/dev/wt-puntas/app/video-editor/_opencut/chat/pedidos.ts (el molde) · C:/dev/wt-puntas/docs/hallazgos-editor-imagen.md:442-444`

### 25. Los botones Discutir / Editar no estan en el chat de Imagen ni en el de Video

_feature · mediano_

`SelectorIntencion` esta en Automations, Copywriter y Web Generator. Sumarlo a los dos chats de edicion y que `lib/image-editor/chat/ia.ts` respete «Discutir» (hoy edita siempre).

**Dónde:** `docs/relevo/pendientes-pc/auditoria-pedidos-5-11.md:50 · app/image-editor/mako/chat/PanelMakoIA.tsx · app/video-editor/_opencut/chat/PanelChat.tsx`
