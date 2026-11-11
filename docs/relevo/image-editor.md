# Relevo — Image (la tab entera), 10-11/11/2026

Chat: «Image» (cuenta claude4), el que el Cerebro renombró el 10/11. Antes se llamaba «Biblioteca de carruseles: portadas y
láminas que no se vencen». Lo escribe el chat que hizo el trabajo.

## 11/11/2026 a la tarde (lo más nuevo)

- **Probado en producción** (docs/pruebas/image-11-11.md, 18 capturas): traer de Instagram y de YouTube, otro negocio no lo ve,
  el error del reel con «Reportar a Soporte», y en el editor texto, orden, plantilla, imagen, guardar, reabrir y exportar.
- **No se pudo ver:** el guiado de «Editar» con el panel del navegador oculto (la pestaña se congela). Hace falta el panel a la vista.
- **Subido para el 12/11:** `6373b9651` (un reel se corta por el link, sin pagar) y `f6b719a3a` (sin «Traer» con un reel, sin
  «Guardar búsqueda» con un link).
- **Meta:** medido (US$0,0058 por anuncio por su `?id=`), sin prender: espera el sí de Martín al costo.

## 11/11/2026 a la mañana (lo más nuevo, arriba)

- **Subido a la punta:**
  - `dfc9c6d33`: «Editar» ya no se corta. Pide el JSON compacto y, si la respuesta se corta, pasa al modelo de respaldo.
  - `420372065` y `6ea05855d`: arreglan los rojos 963 y 973.
  - `b84284cd4`: «Traer tu outlier» también de YouTube (mig 0414 aplicada).
  - `2cb16ff17`: la operación `traer_outlier` en la API.
  - Locales, para subir cuando la punta pase a main: `c515f131a` (la nota de Meta) y `4e7923cdf` (el link pegado encuentra
    el carrusel que ya está).
- **«Traer tu outlier»:**
  - Instagram (0413) y YouTube (0414): hechos.
  - YouTube probado en prod desde la PC con ws3.
  - Instagram: la lectura NUEVA (Apify, ~US$0,0025) no se probó. Gastar pide el sí de Martín en este chat.
  - **Meta: sin hacer.** El diseño y lo medido están en docs/hallazgos-carruseles.md, «Sin hacer».
- **La prueba en prod del 11/11** (después del despliegue de las 11:05 UTC): docs/pruebas/image-11-11.md. El método de captura
  con el panel oculto está en docs/hallazgos-pruebas.md.

## Dónde quedó (10/11)

- **Rama `punta/carruseles-bucket`, worktree `C:/dev/wt-carruseles-bucket`** (separado de origin/main). Todo subido, la última
  es `1c7204ebe`. En main antes del despliegue del 11/11: `154277423`, `15ba25f79`, `c1a628fa3`, `aec347eba`, `659e6c1a3` y
  `a292318aa`. `5bd60d3b4`, `3f175d94a` (el arreglo del rojo 903) y `1c7204ebe` esperan que la punta pase a main.
- **No hay despliegue a mano** (Martín, 10/11): sale lo que esté en main a las 08:05 UTC del 11/11, o a las 11:05.
- **La prueba de punta a punta:** [`docs/pruebas/image-10-11.md`](../pruebas/image-10-11.md). 33 casos, 12 fallas, 10
  arregladas. La cosecha está en docs/hallazgos-carruseles.md, hallazgos-ui.md, hallazgos-pruebas.md y hallazgos-infra.md.
- **Datos de la biblioteca, ya en producción:** portadas en Instagram de 91 a 3 y carruseles sin láminas de 168 a 20, que no
  tienen arreglo (17 borrados en Instagram, 3 restringidos). El lote pago costó US$0,44 de la reserva de Spy, con el sí de Martín.

## Lo que falta

- **Después del despliegue:** mirar en producción, en el navegador de la app con `?ws=3`, los casos «falta desplegar» del informe
  (10, 11, 18, 19, 23, 27 y 29) y cerrar con «Ya está: Image — …».
- **«Generar» de punta a punta** en un negocio con IA: el ws 9 o el de MaKo, nunca el de un cliente.
- **Piden una decisión** (el informe, «Propuestas»): el panel «Diseño» del editor (vacío desde el 6/11), los 17 carruseles que
  ya no existen en Instagram y las láminas de los carruseles de Competitors Spy.
- **Menor:** el globo «Contesta aquí para seguir.» tapa en parte la caja de escribir (caso 31).

## Lo que quedó en el negocio de LEANDRO (ws 10): se deja así

Las pruebas del 10/11 a la noche se hicieron en el Chrome de la extensión creyendo que era la sesión de Martín, y era la de
Leandro (el `?ws=` se ignora; memoria «chrome-extension-sesion-leandro»). Abrir el guiado manda las láminas a la IA. Quedó:
- `anthropic_usage` **12812** (10/11 22:17:39 UTC) y **12823** (23:47:08 UTC): `carrusel-replica`, «Ver si un carrusel de
  ejemplo tiene una persona», US$0,001831 y US$0,004917, pagados con el crédito de Claude de la plataforma, no por Leandro;
- `usuarios` **8**, `perfil.aperturas["10:image:donde|dede717d-b196-4c8f-833a-077bddf339d0"]` = vista una vez (22:22:09 UTC), al
  abrir su diseño «Publicación de Instagram». Es la pregunta de MaKo «¿Dónde lo vas a publicar?».

No se creó ni cambió ningún diseño ni ajuste, y no se le mandó nada a él ni a sus leads. **Martín, 10/11, por el Cerebro:
«Dejalo».** No se tocan ni los usos ni la apertura. Si Leandro pregunta por esos dos usos de IA o por qué MaKo no le hizo esa
pregunta en ese diseño, la respuesta es ésta.

---

# (Antes) Relevo — Image Editor (el Canva de MaKo), 14/10/2026 tarde

Chat: «Image Editor» (cuenta claude1). Antes: «Canva en Content Machine» (claude2). Lo escribe el chat que hizo el trabajo.

## El pedido

> «Quiero que implementes end to end un "Canva" dentro de MaKo, tal cual, copialo todo, tanto en
> diseño como funcionalidades. Revisa si hay algún repo que nos ahorre trabajo. Dejalo en "Content
> Machine" en una tab que sea "Image"»

Y sobre la base: **«Copia a Doory, y luego lo modificamos completamente para que sea original de MaKo,
pero quiero la plantilla para ir trabajando».** El 14/10 a la tarde, por el orquestador: cerrar lo
pendiente que no dependa de Martín y dejarle en una línea las opciones de lo que sí.

## Dónde quedó

- **Rama `editor-imagen`, worktree `C:/dev/wt-canva`.** Tandas 1 y 2 en main desde el 14/10 13:26
  (`353c81a8`). Encima: `c7a77fcb` (la vista del presentador) y `5136c1ce` (tanda 3, la base), más la
  cosecha. Si abajo no dice «en main», no se pusheó.
- **EN MAIN desde el 14/10 17:17 (`a4e74003`)**, deploy Ready: el presentador, la tanda 3 y su cosecha. Las
  plantillas en español (`b9a7dae2`) salen en el push siguiente.
- **Tanda 3 hecha:** diseños, «Subidos» y miniaturas en Supabase (mig **0278, ya aplicada en prod**: sólo
  agrega dos tablas y el bucket `image-editor`). Lo que la etapa 1 dejó en el navegador de alguien sube solo
  la primera vez que abre el editor, con su mismo enlace. Plano: `docs/diseno-editor-imagen.md`.
- **Verificado:** el editor andando en un banco (esbuild + Chrome sin ventana, sin dev server: pasa los 5 GB)
  — crear, texto, plantilla, imagen, guardar y reabrir, PNG y PDF, presentador; el server contra la base
  real en el ws 3 (23 pasos, limpiando todo al final); 887 tests de los que barren el árbol en verde.
- **Verificado en producción el 14/10 a la noche, del lado del CLIENTE** (Chrome con la sesión de Mauricio: rol
  global «usuario», admin del ws 1, capa completo): `/image-editor`, `/image-editor/<id>` y
  `/image-editor/presentador` lo mandan a `/crm`; `/api/image-editor/disenos` y `/subidos` contestan 404 «No existe»
  (la puerta, no el proxy: sin sesión el proxy dice 401); en su barra no hay ningún link al editor.
- **NO verificado:** el camino del super admin en producción (la tab, la barra, el `?ws=`, guardar en la base). El Chrome con
  Claude in Chrome no estaba conectado para claude1. Qué mirar con la sesión de Martín: crear un diseño,
  subir una imagen, cerrar y abrir desde otra pestaña (tiene que estar), descargar PNG, el crédito de Doory al pie.

## Abierto a todos los workspaces (15/10)

Martín: **«Que Image aparezca en todos los workspace.»** Sin `adminOnly` en las cuatro secciones, guard = la pregunta
de toda tab (admin del workspace y la tab en su capa; `pm` no la tiene, como el Video Editor), «pronto» en Image
Generator y Thumbnails también en la barra de secciones. Cada negocio ve ahora el crédito de Doory al pie del editor.
La rama `opcion-image-en-clientes` y la decisión `image-ws-cliente` quedaron sin objeto.

**Verificado en producción el 15/10 a la 01:40** con la sesión de un admin de cliente (Mauricio, ws 1, capa completo):
`/image-editor` abre el inicio dentro de MaKo, la barra lateral muestra «Image» en Content Machine, la de secciones
«Editor · Crear con IA PRONTO · Thumbnails PRONTO · Carousels», y `/api/image-editor/disenos` le contesta su lista.
No se creó nada en el ws 1 (cliente real): crear, guardar y descargar están verificados en el banco y contra la base
en el ws 3.

## Lo que decide Martín (en una línea cada una)

- **¿Le escribimos a Siam (autor de Doory) pidiendo MIT?** Sin eso el cartel se queda y no se abre a clientes.
- **¿Fotos de Unsplash con una key de MaKo?** ¿Y un modelo para quitar fondo de objetos?
- **La API del editor: DECLARADA el 15/10** con el permiso de siempre (área `imagen`, 7 operaciones, también por
  WhatsApp: «creame un flyer…» llega con sus herramientas). La pregunta `image-api-gating` se retiró.
- **Estrellas `formato_imagen`:** ¿una plantilla del editor o un formato del Image Generator?
- **Una pestaña de Canva** (`canva.com/design/DAHX-ICTUd4`) en el grupo de los agentes: si se creó en su cuenta, papelera.

## Lo que sigue (no depende de él)

1. ~~Las 10 plantillas en español~~: hecho el 14/10 (texto del lienzo y miniaturas, medidas en la hoja de contactos).
2. Tanda 5: lo de Canva que Doory no trae, por los paquetes de `docs/editor-imagen/relevamiento-canva-funciones.md`.
3. Tanda 4: alojar las fuentes (hoy jsDelivr). Marca, versiones, compartir y comentarios con tablas propias.
4. ~~`docs/editor-imagen/relevamiento-canva-funciones.md`~~: escrito el 14/10; trae los 8 paquetes de la tanda 5 en orden.

## Para retomar

`Leé docs/relevo/image-editor.md y docs/hallazgos-editor-imagen.md y seguimos.`
