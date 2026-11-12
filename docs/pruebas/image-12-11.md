# Prueba en producción: Image entero, como lo usaría Martín (12/11/2026)

Lo que pidió el Cerebro el 12/11: probar Image (`app/image-editor`) entero en producción, captura por captura, sin quedarse con el
«listo» de MaKo: replicar un carrusel, un anuncio, una miniatura y «traer tu outlier»; las plantillas; crear, volver, abrir uno
viejo, editar con el chat por texto y por audio, exportar; a 1440 y a 375. Probado entre las 10:10 y las 10:50 UTC, en el
navegador de la app (panel oculto), con la sesión de Martín. `/api/auth/me` antes de escribir: `ws 3, impersonando, Cliente de
Prueba` y después `ws 9, Martin Koncke`.

**Por qué ws 9:** ws 3 no tiene IA. «Replicar» ahí deja la estructura con guías y el aviso «Conecta tu Claude, tu GPT o tu Gemini…»
(caso 3), y el chat del editor dice «Instala MaKo para escribir». Lo que usa IA se midió en el ws 9, que corre con la red de la
plataforma (memoria `cliente-prueba-ws3`). Las capturas están en [image-12-11/](image-12-11/).

**Cómo se miró cada réplica:** cada lámina que dibujó el editor (el `lower-canvas` de fabric, recortado a la página) AL LADO de la
lámina original, en una hoja a 800 × 600. No el «listo» del armado: los píxeles.

## Los casos

| # | Paso | Dónde | Resultado | Captura |
|---|---|---|---|---|
| 1 | Portada de Image, ws 3 | 1440 | **BIEN**: 887 carruseles, buscador con «pega un link». **Crítica:** la tarjeta de MaKo muestra una conversación vieja del Dashboard (22/10) que falló, no la apertura de Image | [01](image-12-11/01-portada-1440.png) |
| 2 | «Editar» un carrusel en ws 3 | 1440 | **NO SE PUDO VER** con el panel oculto: la página no volvió a dibujar (tampoco «Anuncios»). En ws 9, recargado y esperando 8 s, sí anduvo (casos 13 a 16) | [02](image-12-11/02-editar-no-abre-guiado-panel-oculto-1440.png) |
| 3 | Replicar @lifeofarjav en ws 3 (sin IA) | 1440 | **BIEN como «sin IA»**: 2,4 s, «Carrusel · Lista o tips» con guías y el aviso de conectar la IA. No se parece al original (es la estructura de la casa) | [03](image-12-11/03-ws3-replica-sin-ia-guias-1440.png) |
| 4 | Replicar @lifeofarjav (6 láminas, «Claude + Hormozi») en ws 9, oferta «MaKo Acelerador», su cara | 1440 | **FALLA**: 27,8 s, 6 láminas, crema/naranja/negro como el original, pero **«= Tu Acelerad»**: el titular se corta en el borde | [04](image-12-11/04-replica-lamina1-vs-original.jpg) |
| 5 | La misma, láminas 2 a 5 | — | **FALLA**: «PASO 1/2/3» y «EL RESULTADO» son texto BLANCO sin la pastilla naranja del original: casi invisibles sobre crema. Los mockups de pantalla del original no están (la mitad de abajo, vacía) | [05](image-12-11/05-replica-lamina2-vs-original.jpg) · [06](image-12-11/06-replica-lamina3-vs-original.jpg) · [07](image-12-11/07-replica-lamina4-vs-original.jpg) · [08](image-12-11/08-replica-lamina5-vs-original.jpg) |
| 6 | La misma, lámina 6 (el CTA) | — | **FALLA**: «Comenta ACELERADOR y te la envío» blanco sobre crema (en el original va en una caja) | [09](image-12-11/09-replica-lamina6-vs-original.jpg) |
| 7 | Pestaña Anuncios | 1440 | **BIEN** a la vista. **Falla de datos (no de Image):** dos anuncios de @sofiacontreras con título «{{product.name}}» (plantilla de catálogo de Meta sin llenar) | [10](image-12-11/10-anuncios-portada-1440.png) |
| 8 | Replicar el anuncio tuit de @AlexHormozi | — | **FALLA**: 7,5 s. El original es una tarjeta blanca de tuit; la IA «leyó» «pantalla dividida: dos cuadros apilados» (el ejemplo del prompt) y salieron dos fotos de Martín con texto negro encima, ilegible | [11](image-12-11/11-anuncio-hormozi-original-vs-replica.png) |
| 9 | Replicar la miniatura de Dan Martell | — | **REGULAR**: 4,8 s, titular y foto, pero la persona queda chica en una esquina (en el original, grande al centro) y el texto toca la foto | [12](image-12-11/12-miniatura-martell-original-vs-replica.jpg) |
| 10 | «Traer tu outlier»: pegar el link de @vilmanunez | 1440 | **BIEN**: «Ese link no está entre tus outliers.» → «Traer este carrusel» → 2,0 s y se abre con sus 10 láminas | [13](image-12-11/13-traer-link-vilmanunez-abierto-1440.png) |
| 11 | Su «Editar»: el guiado | 1440 | **BIEN**: oferta → «tiene una persona, ¿quién va?» → qué cambio → «Generar las 10 láminas». **Falla de texto:** «Conservo la imagen y el diseño del original» es falso (las fotos no se reusan). **Para decidir:** son 3 preguntas antes de generar; la regla del 11/11 dice que «Replicar» deja la pieza sin preguntas | [14](image-12-11/14-guiado-pregunta-oferta-1440.png) · [15](image-12-11/15-guiado-listo-generar-1440.png) |
| 12 | Generar: el armado en vivo | 1440 | **BIEN** el armado (88 s, el original arriba y cada lámina abajo) | [16](image-12-11/16-armando-en-vivo-1440.png) |
| 13 | El resultado de @vilmanunez, lámina por lámina | — | **FALLA**: 7 de 10 láminas con un hueco amarillo del tamaño de la foto (se buscaban 3 escenas como mucho); «ACELERADOR» negro encima de una foto oscura; sin la cara de Martín en la portada aunque se eligió «Mi cara de marca» | [17](image-12-11/17-traido-replica-lista-1440.png) · [18](image-12-11/18-traido-lamina1-vs-original.jpg) · [19](image-12-11/19-traido-lamina3-vs-original.jpg) · [20](image-12-11/20-traido-lamina7-vs-original.jpg) |
| 14 | Editar con el chat POR TEXTO (ws 9) | 1440 | **FALLA**: «Tu IA está conectada pero no pudo editar el diseño ahora mismo… (image-editor-ia: openai no contestó y esta feature no se degrada ni se paga (openai: chatCheap(openai): You)». En el espacio de MaKo el chat de Image no contesta nunca | [21](image-12-11/21-chat-texto-falla-openai-1440.png) |
| 15 | Grabar un AUDIO en el chat (micrófono simulado con una nota de voz de 4,5 s) | 1440 | **FALLA**: después de grabar, la barra mide 363 px en una tarjeta de 316: «Enviar audio» queda en 413→457 con el corte en 416, casi entero afuera. Es lo que vio Martín en el Video Editor | [22](image-12-11/22-audio-grabado-enviar-cortado-1440.png) |
| 16 | Mandar el audio | 1440 | **REGULAR**: la transcripción es exacta («Cambia el título de la portada a, tu oferta, lista en 7 días.») pero tarda ~105 s con «Enviando…»; y después, la misma falla del caso 14 | [23](image-12-11/23-audio-transcrito-falla-openai-1440.png) |
| 17 | Exportar («Compartir» → PNG) | 1440 | **BIEN**: `Carrusel-MaKo-Acelerador---Carrusel-Inauguracion.zip`, application/zip, 3,3 MB en 5 s (la descarga se interceptó) | [24](image-12-11/24-exportar-png-1440.png) |
| 18 | «Crear desde cero»: las plantillas | 1440 | **BIEN** a la vista: 24 plantillas en 7 grupos (carruseles, miniaturas, publicaciones, historias, anuncios, presentaciones, formatos) | [25](image-12-11/25-plantillas-crear-desde-cero-1440.png) · [27](image-12-11/27-plantillas-publicaciones-historias-1440.png) · [28](image-12-11/28-plantillas-anuncios-presentaciones-1440.png) |
| 19 | «Usar plantilla» (Lista o tips) | 1440 | **PARA DECIDIR**: abre el editor en 1 s con las guías («Tu gancho con un número…»); MaKo no escribe nada. La regla del 11/11 dice que usar una plantilla para escribir termina con la pieza completa | [26](image-12-11/26-plantilla-lista-o-tips-abierta-1440.png) |
| 20 | Volver a la portada y abrir uno viejo | 1440 | **BIEN**: cada diseño abre por su link con sus páginas (16badd73, fb8ea8d0, 7b0fc1c9, 93997332) | — |
| 21 | Portada en el teléfono | 375 | **BIEN**: sin scroll de costado, tarjetas con «Editar» a la vista | [29](image-12-11/29-portada-375.jpg) |
| 22 | El editor en el teléfono | 375 | **REGULAR**: abre; la fila de la página se corta a la derecha y la barra de abajo corta «Herramie…» (ya anotado el 11/11); el «Acelerad» cortado, igual | [30](image-12-11/30-editor-replica-375.jpg) |
| 23 | El guiado en el teléfono | 375 | **BIEN** con un detalle: el globo «Contesta aquí para seguir.» tapa la primera frase de MaKo | [31](image-12-11/31-guiado-375.jpg) |

## Lo que se arregló (ver commits en la rama `punta/probar-image`)

- **La pastilla:** la réplica ahora lee `relleno` (el color de la pastilla o la caja detrás del texto) y lo pone como el resaltado del
  propio texto. Y aunque la IA no lo diga: un rótulo, un dato o un CTA que no se lee sobre el fondo recupera la pastilla con el
  acento de la lámina; un titular toma la tinta del fondo (`colorQueSeLee`, lib/carruseles/replica.ts). Casos 5 y 6.
- **A lo ancho:** una palabra más ancha que su caja achica ese texto y los de su mismo papel y cuerpo. Caso 4.
- **Las fotos:** hasta 8 escenas parecidas, a la vez; un cuadro sin su escena lleva otra de la réplica; una lámina sin ninguna foto
  se arma como tipografía (no deja el hueco). Un texto que la IA puso arriba de una foto no baja hasta meterse en ella; el que va
  sobre una foto lleva sombra, y si era oscuro pasa a blanco. Caso 13.
- **El prompt** ya no trae ejemplos de composición («pantalla dividida…», «rocky beach…»): la IA los copiaba. Caso 8.
- **El guiado** dice lo que pasa: «Copio el diseño del original, con fotos parecidas en lugar de las suyas». Caso 11.
- **El chat del editor en el espacio de MaKo:** `image-editor-ia` y `marca-leer` (las dos «de su IA») usan el crédito de Claude en el
  ws 9, como todo lo interno desde el 11/11. Un negocio sigue con su propia IA. Caso 14.
- **El audio:** el pie del chat de Image es una grilla de una columna que no crece, y la caja la ocupa. Medido con la regla
  inyectada en producción: «Enviar audio» pasa a 354→398, adentro de la tarjeta. Caso 15.

## Lo que no es de Image (avisado al Cerebro)

- El audio cortado del **Video Editor** (su caja usa `app/admin/operaciones/centro.css`, otra hoja): el mismo mecanismo.
- «{{product.name}}» en anuncios de catálogo (los datos de Spy).
- La transcripción de una nota de voz de 4 s: ~105 s (`/api/plan-dictado`).
- La tarjeta de MaKo de la portada muestra conversaciones viejas de otras tabs.
- El polling de `/api/whatsapp/evolution/mensajes?resumen=1` cada ~1 s (más de 1.300 pedidos en pocos minutos de prueba).

## Lo que queda en ws 3 y ws 9 (de esta prueba)

- ws 3: «Carrusel · Lista o tips» (`a0bda22f-63d8-44c1-b972-b2ae3a99e51f`), sin IA.
- ws 9: `16badd73-…` (@lifeofarjav), `fb8ea8d0-…` (anuncio @AlexHormozi), `7b0fc1c9-…` (miniatura Dan Martell), `93997332-…`
  (@vilmanunez, traído), `bbef75cc-…` (plantilla Lista o tips); el carrusel de @vilmanunez traído a ws 9 (ya estaba en la tabla:
  pasó a la plataforma, sin Apify).
