# Prueba en producción: «Traer tu outlier» y carruseles de punta a punta (11/11/2026)

Lo que pidió el Cerebro el 11/11, probado en **producción** después del despliegue de las 11:05 UTC (`ada98995d`, que trae
`0c937f8cb`). Se probó entre las 14:50 y las 15:15 UTC, en el negocio de prueba: **ws 3, «Cliente de Prueba»**. Antes de escribir,
`/api/auth/me?ws=3` devolvió `ws: 3` e `impersonando: true`. Todo en el navegador de la app, a 1440 y a 375.

**Cómo se capturó:** el panel del navegador estaba OCULTO. La receta que da la página ENTERA a 1440 es `resize_window` y, en el
mismo lote y sin espera, `zoom` de `[0, 0, 1440, 900]`. Una captura en blanco o a medio aparecer es la pintura atrasada: se midió
el estado con JS y se repitió. Ver docs/hallazgos-pruebas.md.

## Los casos

| # | Qué | Dónde | Resultado | Captura |
|---|---|---|---|---|
| 1 | La portada de Image, con lo desplegado: el buscador dice «…o pega un link de Instagram» | 1440 | **PASA**. 886 carruseles (885 + el traído desde la PC) | [01](image-11-11/01-portada-1440.png) |
| 2 | Pegar el link de un carrusel REAL que no está (`@vilmanunez`, `DflDIt_nyzx`) | 1440 | **PASA**: «Ese link no está entre tus outliers.» y «Traer este carrusel» | [02](image-11-11/02-link-que-no-esta-1440.png) |
| 3 | «Traer este carrusel» | 1440 | **PASA**: «Trayendo…», 9,3 s, y se abre solo con sus 10 láminas. Las 10 están en NUESTRO bucket (200, JPEG, 90-257 KB) | [03](image-11-11/03-traido-abierto-1440.png) |
| 4 | Otro negocio no lo ve: el mismo link en el negocio de Martín (ws 9) | 1440 | **PASA**: «Ese link no está entre tus outliers», 0 tarjetas | [04](image-11-11/04-otro-negocio-no-lo-ve-1440.png) |
| 5 | Error a propósito: el link de un REEL real | 1440 | **PASA**: «Ese link es un reel o un video: aquí se traen carruseles y publicaciones con imagen.» con «Reportar a Soporte» como último hijo. **Falla menor:** pagó la lectura (8,3 s, US$0,0027) y debajo del error seguía «Traer este carrusel». Arreglado en `6373b9651` y `f6b719a3a` (sale el 12/11) | [05](image-11-11/05-reel-error-reportar-1440.png) |
| 6 | Recargado, el link encuentra el traído (el buscador por link, `4e7923cdf`) | 1440 | **PASA**: 1 carrusel, 1/10, «Comenta HOUSE26». Sin múltiplo: el creador no se leyó entero | [06](image-11-11/06-traido-en-la-grilla-1440.png) |
| 7 | Lo mismo en el teléfono | 375 | **PASA**: entra sin scroll de costado | [07](image-11-11/07-traido-celular-375.jpg) |
| 8 | «Editar» del traído: el guiado (oferta, avatar, qué cambiar) | 1440 y 375 | **NO SE PUDO VER.** Con el panel oculto, el clic (de la herramienta, desde JS o llamando a `onReplicar`) no abría el guiado, y a 375 la pestaña se congeló entera (ni navegar en 300 s). Es lo mismo que el 10/11, y ese día abrió en una ventana a la vista. Necesita el panel a la vista | — |
| 9 | La versión editable del traído, con la MISMA función que «Generar» (`replicarEjemplo`, desde la PC, en ws3) | — | **PASA**: 10 láminas en 14,5 s. Sin IA en ws3: «Carrusel · Lista o tips» con guías y el aviso «Conecta tu Claude, tu GPT o tu Gemini…» | — |
| 10 | El diseño abierto en el editor | 1440 | **PASA**: el panel «Diseño» trae las plantillas de MaKo (el caso 17 del 10/11, desplegado) | [08](image-11-11/08-editor-abierto-1440.png) |
| 11 | Editar un TEXTO (doble clic, escribir) | 1440 | **PASA**: «7 diseños que venden solos». **Crítica:** el titular más largo se encima con el párrafo de la guía (la plantilla no se reacomoda) | [09](image-11-11/09-texto-editado-1440.jpg) |
| 12 | Cambiar el ORDEN («Bajar página») | 1440 | **PASA**: la portada pasa a ser la página 2 | [10](image-11-11/10-orden-cambiado-1440.jpg) |
| 13 | Una PLANTILLA del panel «Diseño» («Usar en esta página» o «Agregar como página nueva») | 1440 | **PASA**: «Creencia al revés» como página 3, con «Deshacer». 11 páginas | [11](image-11-11/11-plantilla-agregada-1440.jpg) |
| 14 | Una IMAGEN («Elementos» → el foco) | 1440 | **PASA**: entra en el centro de la página, con su paleta | [12](image-11-11/12-elementos-1440.jpg) · [13](image-11-11/13-imagen-agregada-1440.jpg) |
| 15 | Guardar y REABRIR | 1440 | **PASA**: «Se guardaron todos los cambios». Recargado: 11 páginas, la 1 es «Punto 1». En la base: 2 «7 diseños que venden solos», 3 «Creencia al revés» con el foco (`group:Idea`) | [14](image-11-11/14-reabierto-1440.png) |
| 16 | EXPORTAR («Compartir» → PNG) | 1440 | **PASA**: `Carrusel-Lista-o-tips.zip`, application/zip, 1.200.857 bytes (las 11 páginas). La descarga se interceptó: no se bajó nada a la PC | — |
| 17 | YouTube: el link de un video que no está, en «Thumbnails» | 1440 | **PASA**: «Ese video no está entre tus outliers.» y «Traer esta miniatura»; el buscador dice «…o pega un link de YouTube» | [15](image-11-11/15-youtube-no-esta-1440.png) |
| 18 | «Traer esta miniatura» | 1440 | **PASA**: 1,5 s, y se abre (@andres__solis, 602 vistas, 21:04) | [16](image-11-11/16-youtube-traida-1440.png) |
| 19 | YouTube en el teléfono | 375 | **PASA**: 1,0 s, ancho 375. **Crítica:** la hoja ocupa toda la pantalla y deja media en blanco entre los datos y los botones | [17](image-11-11/17-youtube-no-esta-375.jpg) · [18](image-11-11/18-youtube-traida-375.jpg) |
| 21 | Error a propósito a 375: el link de una publicación que NO existe | 375 | **PASA**: «Instagram no me dio esa publicación: puede ser privada o estar borrada.» con «Reportar a Soporte». **Crítica:** tardó cerca de un minuto, con «Trayendo…» todo ese rato. ⚠️ No es gratis: Apify cobró US$0,0027 por el ítem del error (corrida `eQLBIKMeBGvP7dZ8f`) | [19](image-11-11/19-error-reportar-375.jpg) |
| 22 | El duplicado en el editor del teléfono | 375 | **PASA**: abre con sus 11 páginas, sin scroll de costado. **Crítica:** la fila de la página se corta a la derecha (el nombre queda en «P», el último ícono a medias) y la barra de abajo corta «Herramientas» | [20](image-11-11/20-editor-375.jpg) |
| 23 | Editar un texto en el teléfono y guardar | 375 | **PASA**: «1. Mira lo que funciona», «Se guardaron todos los cambios», y en la base (15:21:48 UTC) | [21](image-11-11/21-texto-editado-375.jpg) |
| 24 | El guiado de «Editar», otra vez, en una pestaña nueva y con la sesión recién entrada | 1440 | **NO SE PUDO VER**: el panel seguía oculto y no abrió | — |
| 25 | Después del despliegue de las 15:55 UTC (`2507c11c7`, trae `2d409ba9c`): el link de un REEL | 1440 y 375 | **PASA**: «Ese link es de un reel: aquí se traen carruseles y publicaciones con imagen.», sin «Traer» y sin «Guardar búsqueda». Gratis. **Detalle:** en el teléfono no queda ningún botón para borrar el link | [22](image-11-11/22-reel-sin-boton-1440.png) · [25](image-11-11/25-reel-sin-boton-375.jpg) |
| 26 | Un error DEFINITIVO no se reofrece: el link de un carrusel que salió de la biblioteca (`DfSspEuktt9`, `DfVYJY2lHVf`) | 1440 y 375 | **PASA**: «Ese carrusel salió de los ejemplos: no lo puedo sumar.» con «Reportar a Soporte», y en lugar de «Traer» queda «Quitar filtros». 1,5 s, sin Apify | [23](image-11-11/23-error-definitivo-sin-reofrecer-1440.png) · [24](image-11-11/24-error-definitivo-sin-reofrecer-375.jpg) |
| 20 | Oscuro | — | **NO PROBADO**: el tema de MaKo es un interruptor de la cuenta (no sigue al sistema), y cambiarlo es tocar la preferencia de Martín | — |

## Lo medido (costo y tiempo de UNA lectura)

| Fuente | Cómo | Costo | Tiempo |
|---|---|---|---|
| Instagram, un carrusel | `apify~instagram-scraper`, `maxItems: 1` | **US$0,0027** (corrida `3tm75HeDJFJeWOMPD`) | 9,3 a 14,8 s (con las láminas al bucket) |
| Instagram, un reel | lo mismo: se pagaba para terminar en «es un reel» | US$0,0027 → **US$0** desde `6373b9651` (se reconoce por el link) | — |
| YouTube, un video | YouTube Data API, `videos.list` + `channels.list` | **gratis** (2 unidades de 10.000 por día) | 1,0 a 2,9 s |
| Biblioteca de anuncios de Meta, UN anuncio por su `?id=` | `apify~facebook-ads-scraper`, `resultsLimit: 1` (sólo medido, no guardado) | **US$0,0058** (corrida `l6YIB0Xe0vYv14PxC`, evento `apify-default-dataset-item`) | 8,5 s |

⚠️ El costo que devuelve la lista de corridas apenas termina puede decir **US$0**: el cobro por resultado se asienta unos segundos
después. Se lee de la corrida (`/actor-runs/{id}`: `usageTotalUsd` y `chargedEventCounts`).

## Lo que queda en ws 3 (de esta prueba)

- Traídos: 2 carruseles (`@den.borgg` −1594, desde la PC; `@vilmanunez` −1595, desde la pantalla) y 3 miniaturas (Victor Martin
  Formenti, Andrés Solís, Nexum AI). Sólo los ve ws 3.
- Un diseño: «Carrusel · Lista o tips» (`26b5a830-d4aa-4b7d-8e70-a16a7699d2ea`), 11 páginas, editado.
- Gasto: 4 lecturas de Instagram (US$0,0108, una de ellas el link inexistente) y 1 de Meta sin guardar (US$0,0058), con la clave de
  Apify de la plataforma. En total, US$0,0166.

## Lo que falta

- **El guiado de «Editar» a la vista** (caso 8): necesita el panel del navegador a la vista, o una ventana de Martín.
- **Meta:** medido (US$0,0058 por anuncio, el link `?id=` trae UN anuncio con su página, su imagen y si sigue activo), sin
  prender. El diseño, en docs/hallazgos-carruseles.md («Sin hacer»).
- **Propuestas** (no son fallas):
  - una marca de «Traído por ti» en la tarjeta;
  - la apertura propia de Image en la tarjeta de MaKo: en ws 3 sigue mostrando una conversación vieja del Dashboard que falló;
  - que la plantilla de guías reacomode el texto cuando el titular crece;
  - la hoja del teléfono a la medida del contenido.
