# Prueba de punta a punta: Image (10/11/2026)

Pedido de Martín (10/11, noche), por el Cerebro: probar «Image» como la usaría cada persona y arreglar lo roto. «Textos rotos,
botones rotos, diseño roto, funcionalidades que no funcionan».

**Cómo se probó.** En producción (hola-mako.com), con la sesión de Martín:
- en el Chrome de Martín (Claude in Chrome), a 1536×730;
- en el navegador de la app de Claude, a 1440×900 y 375×812, como superadmin viendo el **Cliente de Prueba (ws 3)** como
  administrador.

Se escribió sólo en el ws 3: un guardado y un diseño de prueba. Lo de la biblioteca de carruseles es el catálogo de la plataforma,
y su arreglo de datos ya estaba aprobado.

**Ojo con las fechas.** Los arreglos de código de esta tanda están en main, pero salen con el despliegue automático del 11/11 a las
08:05 UTC. Por eso varios casos dicen «arreglado, falta desplegar»: en producción todavía se ven como antes. El arreglo de DATOS
(portadas y láminas) ya está en producción.

Resultado: **PASA** · **FALLA** (sin arreglar) · **ARREGLADO** (en producción) · **ARREGLADO, falta desplegar** (en main).

## Los casos

| # | Qué | Pantalla | Resultado | Captura |
|---|---|---|---|---|
| 1 | Las portadas de los outliers cargan (antes: el ícono roto con el texto alternativo) | 1440, ws 3 | **ARREGLADO**: datos (91 → 3 portadas en Instagram) y, para las que mueran mañana, la pantalla (`imagenes-vivas.ts`, falta desplegar) | [01](image-10-11/01-outliers-1440.png) |
| 2 | La flecha de las láminas en la tarjeta (1/10 → 2/10 → 3/10 y volver) | 1440 | **PASA** | |
| 3 | Carruseles con todas sus láminas (Martín: «todos deben tenerlo») | 1440 | **ARREGLADO** en datos: sin láminas de 168 a 20. Los 20 no se pueden (17 borrados en Instagram, 3 restringidos) | |
| 4 | Carrusel abierto: flechas, teclado, contador, Guardar, Ver original, Parecidos | 1440 | **PASA** | [10](image-10-11/10-carrusel-abierto-nota.jpg) |
| 5 | Buscador («nature»: 796 → 3, en la URL; vacío vuelve a 796) | 1440 | **PASA** | |
| 6 | Orden: Mayor outlier, Más nuevos, Más viejos, Más interacción, Traídos hace poco (ordena de verdad, va en la URL) | 1440 | **PASA** | [02](image-10-11/02-orden-abierto.png) |
| 7 | Filtros: ocultar «Tutorial» (796 → 723, «Ver 723 carruseles»), «Quitar filtros» vuelve a 796 | 1440 | **PASA** | |
| 8 | Cuentas: elegir «Vilma Núñez» deja sus 16, el chip lleva su nombre | 1440 | **PASA** | |
| 9 | Guardados: guardar suma 1, la vista lo muestra, quitarlo la deja vacía | 1440, ws 3 | **PASA** | |
| 10 | Guardados vacío ofrecía «Quitar filtros» sin filtros | 1440 | **ARREGLADO, falta desplegar**: «Volver» (c1a628fa3) | |
| 11 | Anuncios recién abierto mostraba «Quitar filtros» y «Guardar búsqueda» sin filtros | 1536 | **ARREGLADO, falta desplegar** (c1a628fa3) | |
| 12 | «Seguir cuentas» lleva a Competitors Spy | 1536 | **PASA** | |
| 13 | «Crear desde cero»: «¿Qué vas a crear hoy?» con 41 plantillas | 1440, ws 3 | **PASA** | [03](image-10-11/03-crear-desde-cero.png) |
| 14 | Usar una plantilla crea el diseño y abre el editor («Carrusel · Lista o tips», 7 páginas) | 1440, ws 3 | **PASA** | |
| 15 | Editor: el texto se edita con doble clic y queda guardado al recargar | 1440, ws 3 | **PASA** | [04](image-10-11/04-editor-texto-editado.png) · [05](image-10-11/05-editor-tras-recargar.png) |
| 16 | Editor, «Compartir»: PNG, JPG, PDF, SVG, Video o GIF (no se descargó nada) | 1440, ws 3 | **PASA** | |
| 17 | Editor, panel «Diseño»: buscador y «Todas las plantillas» que nunca encuentran nada («Ninguna plantilla coincide con “lista”») | 1440, ws 3 | **FALLA**: vacío a propósito desde el 6/11; ver «Propuestas» | |
| 18 | El «⋯» de la lista de diseños «sin fondo»: las filas de abajo lo tapaban (medido con `elementFromPoint`: los 4 ítems tapados) | 1536 | **ARREGLADO, falta desplegar** (15ba25f79) | |
| 19 | Guiado: con la pregunta de MaKo marcada, el menú lateral se abría ENCIMA del chat (la captura de Martín) | 1536 | **ARREGLADO, falta desplegar** (c1a628fa3) | [06](image-10-11/06-falla1-barra-sobre-el-chat.jpg) |
| 20 | Guiado en la computadora: pregunta la oferta, el velo señala la pregunta | 1536 | **PASA** | [07](image-10-11/07-guiado-escritorio.jpg) |
| 21 | «Tu versión» de @lifeofarjav mostraba 1 de 6 láminas | 1536 | **ARREGLADO**: tiene sus 6 (datos) y, si falta alguna, lo dice (falta desplegar) | |
| 22 | Celular: la grilla entra a 375 sin scroll de costado | 375 | **PASA** | [08](image-10-11/08-celular-375.jpg) |
| 23 | Celular: «Editar» armaba la versión EN EL ACTO, con la IA del negocio, sin preguntar | 375 | **ARREGLADO, falta desplegar**: el mismo guiado de la computadora (659e6c1a3) | [09](image-10-11/09-celular-editar-arma-solo.jpg) |
| 24 | Oscuro: la grilla y los filtros | 1536 | **PASA** | |
| 25 | Thumbnails: 84 miniaturas, ninguna rota | 1536 | **PASA** | |
| 26 | Guiado completo: oferta escrita a mano, «Sólo los textos», y «Listo: 11 láminas…» con «Generar las 11 láminas», «Cambiar algo» y «Ahora no» | 551, ws 10 (ver abajo: NO fue sólo lectura) | **PASA** | [12](image-10-11/12-guiado-listo-para-generar.jpg) |
| 27 | Guiado en una ventana angosta (551): abría en las láminas, con la pregunta escondida detrás de «MaKo» y sin el velo | 551 | **ARREGLADO, falta desplegar**: abre en el chat (`movilDeEntrada`) | [11](image-10-11/11-guiado-angosto-abre-en-laminas.jpg) |
| 28 | «Generar» | — | **NO PROBADO**: escribe y usa la IA del negocio. En el ws 3, que no tiene IA, el panel oculto del navegador de la app no procesaba el clic de «Editar» (el mismo clic, en el Chrome a la vista, sí abre el guiado) | |
| 29 | Anuncios entrando por el link (`?que=anuncios`): «Guardar búsqueda» sin filtros | 551 | **ARREGLADO, falta desplegar**. El arreglo del caso 11 lo empeoraba (salían los dos botones): se corrigió con el orden que de verdad se usa | [13](image-10-11/13-anuncios-por-link.jpg) |
| 30 | Thumbnails: abrir una miniatura (Ver en YouTube, Guardar, Editar) | 551 | **PASA** | [14](image-10-11/14-thumbnail-abierto.jpg) |
| 31 | El globo «Contesta aquí para seguir.» tapa en parte la caja de escribir | 551 | **FALLA** (menor) | [12](image-10-11/12-guiado-listo-para-generar.jpg) |
| 32 | Esencial contra Pro: Image es sólo de Pro (candado y «Pasar a Pro») | — | **NO PROBADO EN VIVO**: aplica sólo a quien paga el Esencial por la pasarela, y ningún negocio de prueba lo paga (no se crean cuentas). Lo fija `tests/plan-esencial.test.ts` | |
| 33 | Un miembro o un cliente de agencia | — | **NO PROBADO**: la app deja ver un negocio sólo como administrador | |

## Propuestas (no son arreglos: piden una decisión)

- **El panel «Diseño» del editor (caso 17).** Quedó vacío el 6/11, cuando se borraron las 10 plantillas de Doory, y desde
  entonces su buscador y su selector no encuentran nada. La referencia (Canva) lista ahí las plantillas. Las de MaKo ya
  existen («Nuevo diseño», `app/image-editor/plantillas-crear.ts`), y `servicioPlantillas` (`app/image-editor/mako/plantillas.ts`)
  dice que «el día que las plantillas propias se sirvan desde el panel, se llena acá». Las reales arman su documento en el
  navegador; las de carrusel necesitan el kit y la marca del negocio, que se leen en el server.
- **Los 17 carruseles que ya no existen en Instagram.** Muestran «N láminas» con una sola imagen y sin flecha, y su «Ver
  original» lleva a una página muerta. Esconderlos (`dejo_de_verse_en`) es la pasada a ojo de la biblioteca: no se tocó.
- **Los carruseles de Competitors Spy** (las cuentas que sigue el negocio) nunca guardan láminas: muestran «5 láminas» con una
  sola imagen (@leilahormozi). Es de `lib/spy.ts`.

## Límites de la prueba

- **El navegador de la app, con el panel oculto, congela la página.** Un script sin esperas tardó más de 45 s, y una navegación
  quedó colgada 300 s con 1,9 GB libres. Además, un `setState` llamado a mano no cambiaba la pantalla. Lo que dependía de eso
  (el guiado en el ws 3) se probó en el Chrome de la extensión, a la vista. ⚠️ **Ese Chrome tiene la sesión de LEANDRO (ws 10),
  no la de Martín, y el `?ws=` se ignora.** Y abrir el guiado NO es sólo mirar: manda las láminas a la IA para saber si hay una
  persona. Quedaron en su negocio 2 usos de IA (`anthropic_usage` 12812 y 12823, US$0,0067 pagados con el crédito de la
  plataforma) y una apertura vista (`usuarios` 8, `perfil.aperturas["10:image:donde|dede717d…"]`, al abrir su diseño en el
  editor). Ningún diseño, ningún ajuste y ningún mensaje. Se le avisó al Cerebro y no se borró nada.
- **El celular** se vio a 375×812 en el navegador de la app: la grilla, el carrusel abierto y el «Editar» que armaba solo (caso
  23). El guiado nuevo del teléfono se ve después del despliegue.
- **Las capturas** del navegador de la app salen achicadas a 800×500; las del Chrome, a 551 de ancho, que es el ancho que tenía
  su ventana.

## Lo que falta

- Mirar en producción, después del despliegue del 11/11 a las 08:05 UTC, los casos «falta desplegar»: 10, 11, 18, 19, 23, 27 y 29.
- `Generar` de punta a punta en un negocio con IA (caso 28), y el aviso de «sin IA» en el ws 3.
- Las propuestas de arriba: el panel «Diseño», los 17 carruseles borrados y las láminas de Competitors Spy.
- El globo que tapa la caja (caso 31).

## Resumen

**33 casos.** 18 pasan y 3 no se pudieron probar en vivo (28, 32 y 33). **Se encontraron 12 fallas:**
- **10 arregladas.** 3 ya están en producción por los datos (casos 1, 3 y 21). Las otras 7 están en main y esperan el
  despliegue del 11/11 (casos 10, 11, 18, 19, 23, 27 y 29).
- **2 sin arreglar:** el panel «Diseño» del editor (caso 17, pide una decisión) y el globo que tapa la caja (caso 31).

Aparte, 20 carruseles siguen sin láminas y no tienen arreglo: 17 ya no existen en Instagram y 3 están restringidos (ver
«Propuestas»).
