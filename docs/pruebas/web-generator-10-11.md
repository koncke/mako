# Web Generator de punta a punta, por tipo de persona (10/11/2026)

Pedido de Martín (10/11): «Lo mismo con Web Generator… testeos de todo tipo… si hay textos rotos, botones rotos, diseño roto,
funcionalidades que deberían funcionar de tal manera pero no funcionan… screenshot… feedback sobre cómo se podría mejorar… un
testeo bastante profundo de todo». Se usó la tab en **producción** (hola-mako.com, la versión desplegada esa tarde), en el
navegador de la app y con la sesión de Martín. Se escribió **sólo en el ws 3 (Cliente de Prueba)**; en el ws 9 (MaKo) sólo se
miró la lista. Referencia de todo lo visual: Gamma (AGENTS.md, «PROHIBIDO INVENTAR»).

**En números:**
- **33 casos** probados.
- **10 fallas** del Web Generator: **7 arregladas** (cada una con su test, probado rompiéndolo) y **3 anotadas** sin arreglar.
- **3 fallas de otras tabs** vistas de paso, anotadas para sus chats.
- **6 casos sin probar** (abajo, con el porqué).
- **7 propuestas** para que decida Martín.

Los arreglos van en la punta `punta/web-generator-pruebas` y salen con el despliegue siguiente. Las capturas están en
`docs/pruebas/web-generator-10-11/` (las 01-23 son de producción ANTES del arreglo; la 24 y la 25, de producción con el arreglo
puesto a mano en la pestaña, para medirlo).

## Las personas y las pantallas

| Persona | Dónde | Qué se probó |
|---|---|---|
| Superadmin mirando el negocio de prueba | ws 3, 1440, claro y oscuro | Entrada, lista, Panel, plantillas, crear, editor (texto, deshacer, bloques, formulario), publicar, SEO, dominio, despublicar, la publicada, el formulario hasta el CRM, réplica |
| Visitante de una landing | hola-mako.site, 1440 y 375 | La publicada, el formulario vacío y lleno, la página de gracias, los botones |
| Superadmin en su negocio (MaKo) | ws 9, sólo mirar | La lista con las landings de los funnels de MaKo |
| Teléfono (375, emulado como Android) | ws 3 | La lista del teléfono (visitas, leads y estado), la landing abierta, el editor de escritorio apretado |
| Miembro del negocio | — | Sin probar: no hay «ver como» un rol y no se crean cuentas. La página y su API piden admin del negocio |
| Esencial contra Pro | — | Sin probar en vivo: el tope (Esencial 3 publicadas y 1 dominio; Pro sin tope; prueba 1) sólo se aplica a quien paga por la pasarela, y el ws 3 no paga. Verlo pedía cambiarle el plan: toca cobros, no se hizo |

## Las 7 fallas arregladas

1. **La landing publicada salía en Google y WhatsApp con los huecos de la plantilla, y lo escrito en «SEO» no llegaba**
   (capturas 10 y 13). La pestaña del navegador decía «[Nombre de la guía] (gratis)» y la descripción «Descarga gratis [nombre de
   la guía] y [lo que va a lograr quien la lea].», aunque el título ya estaba escrito; el diálogo de Publicar prometía «Lead
   magnet / descarga». 11 de las 12 plantillas traen un título y una descripción por página, con huecos, que la persona no ve en
   ningún lado, y le ganaban al único que puede escribir (Publicar → SEO). → Un título o una descripción con huecos que la persona
   no ve no se publica; en el inicio manda lo que escribió en «SEO»; y la vista previa del diálogo sale de la misma regla que la
   publicada. `lib/editor-landing/seo-pagina.ts` (nuevo), `server-reglas.ts`, `DialogoPublicar.tsx`;
   `tests/web-generator-pruebas-1011.test.ts` (recorre las 12 plantillas) y `tests/editor-landing-server.test.ts`.
2. **Textos pegados: «Guía gratuitaTus primeros 10 clientesUna guía corta…»** (captura 06), en «Redirigir a» del formulario, en
   los enlaces del menú de la página y en la vista previa de Google. Lo que está en columnas (la portada con el formulario al
   costado) se juntaba sin espacio; y un título con una negrita se cortaba en la negrita. → Se separa entre bloques, y el nombre
   de una sección es su título aunque esté en una columna. `lib/editor-landing/doc.ts` (`textoDe`, `tituloDeTarjeta`).
3. **«Agregar bloque»: 36 tarjetas con la segunda línea cortada por la mitad** (captura 04: «El texto más grande de la sección»
   se leía a medias, y los nombres perdían la parte de abajo de las letras). → Cada fila mide lo que su contenido (captura 25).
   `app/web-generator/gamma.css`.
4. **En oscuro, las tarjetas de «Agregar bloque» no tenían nombre** (captura 22): sólo se veía la descripción. El color que usaban
   pasó a ser un borde casi transparente el 31/10. → El texto claro del tema. `app/web-generator/gamma.css`.
5. **MaKo preguntaba «¿Ya está lista para que la vean?» apenas creada la landing** (captura 03), con 30 huecos sin completar.
   → No lo pregunta mientras queden huecos. `lib/aperturas/web.ts`, `PanelAgente.tsx`, `tests/iniciativa-web.test.ts`.
6. **Y lo volvía a preguntar apenas se anulaba la publicación.** → Una página que estuvo publicada en esa visita no vuelve a
   estar «lista para que la vean». Mismos archivos.
7. **La caja del chat decía «Instala MaKo para»** (captura 01; a 375, «Instala /»): sin la app de escritorio, la frase no entraba
   al lado del botón «Instalar MaKo». La frase sigue en un renglón (Martín pidió eso el 24/10); el botón baja a su propio
   renglón, a la derecha (captura 24). `PanelAgente.tsx`.

## Las 3 fallas anotadas sin arreglar

- **La réplica deja un espacio antes de la puntuación** donde la original tenía un link («fair usage guidelines .», «hosted in
  Europe ,»). Sale del armado del texto en la réplica por el servidor; no ubiqué la línea.
- **La página «Gracias» de la plantilla Lead magnet publica «Descargar ahora» con enlace vacío** (captura 11): el botón no va a
  ningún lado. Es un hueco más de la plantilla, pero no se ve como hueco. Ver la propuesta 1.
- **En el editor, el título de la portada ocupa 4 o 5 renglones** cuando hay formulario o imagen al costado (capturas 03 y 19):
  90 px en una columna de 430. Publicada a 1440 se ve bien (captura 10). Gamma achica la tarjeta entera al ancho del lienzo; acá
  el lienzo reacomoda. Ver la propuesta 6.

## Fallas de otras tabs, vistas de paso

- **Barra lateral, en oscuro: la foto de perfil queda blanca sobre blanco** («CD» no se lee; captura 21, abajo a la izquierda).
  `app/_components/Sidebar.tsx`.
- **CRM: cada tarjeta pide la foto de WhatsApp del lead y da 404** (158 errores en la consola con el ws 3 abierto).
- **CRM: el lead dice «Llegó por: Landing», sin decir cuál** (captura 12).

## Los casos, uno por uno

| # | Caso | Resultado |
|---|---|---|
| 1 | Entrar a /web-generator del ws 3 | Abre la última landing tocada (la decisión del 24/10). Bien (captura 01) |
| 2 | La caja del chat sin la app de escritorio | «Instala MaKo para»: **falla 7** |
| 3 | «Ver tus landings» → «Ver todo en el Panel» | La lista y el Panel cargan (unos 3 s de «Cargando…») (captura 02) |
| 4 | Panel → Plantillas | Las 9 plantillas cargan. La vista queda con el desplazamiento de la anterior (no se ve el título): menor |
| 5 | Plantilla «Minimal» → «¿De qué quieres crearla?» → Lead magnet | 12 tipos; crea la landing en ~3 s. Bien |
| 6 | La pregunta de MaKo recién creada | **Falla 5** (captura 03) |
| 7 | Escribir el título y el subtítulo sobre los huecos | Se escribe, los huecos se van, y se guarda (recargado). Bien |
| 8 | Deshacer y rehacer | Vuelve al hueco y rehace. Bien |
| 9 | «Agregar bloque» | Abre como el de Gamma, con 9 grupos. **Falla 3** (captura 04) |
| 10 | Formulario: «Editar formulario» → agregar un campo → Teléfono | Bien (captura 05). «Correo electrónico» se parte en dos renglones en su pastilla: menor |
| 11 | Formulario: «Redirigir a» | Ofrece las secciones y la página «Gracias»; **falla 2** en el nombre de la portada (capturas 06 y 07) |
| 12 | «Compartir» | Una vez no abrió: era la página todavía sin hidratar (el panel del navegador estaba oculto). Hidratada, abre siempre |
| 13 | Publicar | Propone `hola-mako.site/lead-magnet-descarga` «Disponible», publica en ~3 s, «Tu sitio está actualizado» (capturas 08 y 09) |
| 14 | La publicada a 1440 | Se ve bien. **Falla 1**: el título y la descripción para Google y WhatsApp (captura 10) |
| 15 | Mandar el formulario vacío | El navegador frena en «Nombre». Bien |
| 16 | Mandarlo lleno (sin teléfono, con un correo de prueba) | Redirige a la página «Gracias» del sitio: «¡Tu guía va en camino!» (captura 11) |
| 17 | El botón «Descargar ahora» de «Gracias» | Enlace vacío: anotada |
| 18 | El contacto en el CRM del ws 3 | Llegó a «Lead entrante» con su correo, «Llegó por: Landing» (captura 12) |
| 19 | Publicar → SEO | **Falla 1** y **2**: la vista previa prometía otro título y la descripción salía pegada (captura 13) |
| 20 | Publicar → Navegación | Barra superior, sin barra, pie. Abre |
| 21 | Publicar → Dominios | Muestra la de MaKo. Un dominio mal escrito → «No es un dominio válido» (captura 14). No se conectó uno real: lo da de alta en el alojamiento |
| 22 | «Quiero la guía», al final de la publicada | Lleva a la sección del formulario. Bien |
| 23 | Vista de teléfono dentro del editor | El lienzo a 390 y la portada apilada (captura 15). El «⋮» de la sección pisa «GUÍA GRATUITA»: menor |
| 24 | La publicada en un teléfono (375) | Sin desborde, título de 42 px, formulario a lo ancho (captura 16) |
| 25 | El editor de escritorio abierto a 375 | Apretado, con la caja cortada y la franja de la vista de cliente encima de la barra (captura 17). Con el teléfono detectado se sirve la versión de teléfono |
| 26 | La versión de teléfono | La lista con visitas, leads y estado, y la landing abierta (captura 18). «Sin publicar» y «Borrador» dicen lo mismo dos veces: menor |
| 27 | Replicar desde la pantalla | La caja se apaga con «Instalar MaKo», igual que Generar |
| 28 | Replicar por la ruta del servidor (la misma que usa la pantalla) | Leyó tally.so en 2,2 s (10 secciones) y armó la réplica con el texto literal en 4,6 s (captura 19). Sin la foto de la ventana, «10 secciones quedaron sin diseño». Los espacios antes de la puntuación: anotada |
| 29 | Anular la publicación | Pide confirmar, «La dirección deja de mostrar la página», y la dirección pasa a 404 al instante (captura 20). **Falla 6** |
| 30 | Modo oscuro: editor, chat y Panel | Bien (capturas 21 y 23). **Falla 4** (captura 22) |
| 31 | La lista del ws 9 | Trae las landings de los funnels de MaKo. Bien |
| 32 | El tope del plan | Leído en el código (arriba, en las personas) |
| 33 | La vista de un miembro | Sin «ver como»; pide admin |

## Sin probar, y por qué

- **Crear con IA (Generar), Editar con MaKo y el chat del editor:** sin la app de escritorio, ninguna caja de MaKo deja escribir
  (la regla del 25/10), y el navegador de la app no la tiene. Además el ws 3 no tiene IA conectada.
- **Pedirle a MaKo «muéstrame mis páginas»:** el Ops Center también está apagado sin la app, y su API pide la llave de un negocio
  (no se creó ninguna).
- **Replicar con la copia idéntica desde la pantalla** (la que saca la foto en una ventana): la caja está apagada sin la app.
- **Conectar un dominio propio de verdad:** lo da de alta en el alojamiento; sólo se probó que frene uno mal escrito.
- **Un miembro** y **Esencial contra Pro:** ver la tabla de personas.

## Propuestas para Martín (no hechas)

1. **Antes de publicar, avisar lo que falta:** «Te quedan 12 textos por completar y un botón sin enlace». Hoy se publica con los
   huecos tal cual. No está en Gamma (Gamma no tiene huecos), por eso no se hizo.
2. **Replicar no es un chat:** pegar un link podría no pedir la app de escritorio. Hoy está apagado igual que Generar.
3. **El nombre de la landing:** creada desde una plantilla se llama como el tipo («Lead magnet / descarga»), y ese nombre es el
   título de Google cuando la persona no escribe uno. En Gamma, el documento toma el primer título que escribís.
4. **El CRM podría decir de qué landing vino el contacto** («Llegó por: Landing» no dice cuál).
5. **En el teléfono, «Sin publicar» y «Borrador»** dicen lo mismo en la misma fila.
6. **El lienzo del editor como en Gamma:** que achique la tarjeta entera en vez de reacomodarla, así el título de la portada se ve
   como en la publicada.
7. **El dominio, validado mientras se escribe**, en vez de después de tocar «Añadir dominio».

## Lo que quedó en el ws 3

- La landing **#95 «Lead magnet / descarga»** (despublicada) y la **#96 «The simplest way to create forms»** (la réplica). Se
  pueden mandar a la papelera.
- El contacto **«Prueba Web Generator 10-11»** (prueba-webgen-1011@example.com) en «Lead entrante».
- La página «Página de gracias» (#31) que ya estaba, sin tocar.
- En el navegador de la app: el modo oscuro se volvió a dejar en claro.

## Las capturas

`docs/pruebas/web-generator-10-11/`: 01 entrada · 02 Panel · 03 plantilla creada y la pregunta de MaKo · 04 «Agregar bloque» con
textos cortados · 05 editar formulario · 06 «Redirigir a» con la sección pegada · 07 redirige a «Gracias» · 08 Publicar · 09
publicada · 10 la publicada a 1440 · 11 «Gracias» tras el formulario · 12 el contacto en el CRM · 13 la vista previa de SEO que no
coincide · 14 dominio inválido · 15 vista de teléfono en el editor · 16 la publicada a 375 · 17 el editor de escritorio a 375 · 18
la lista del teléfono · 19 la réplica · 20 anular la publicación · 21 editor en oscuro · 22 bloques en oscuro sin nombres · 23
Panel en oscuro · 24 DESPUÉS: la caja del chat entera · 25 DESPUÉS: los bloques enteros.
