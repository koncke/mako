# Competitor Spy de punta a punta, por tipo de persona (10/11/2026)

Pedido de Martín (10/11): «Lo mismo con Competitor Spy… testeos de todo tipo… si hay textos rotos, botones rotos, diseño roto,
funcionalidades que no funcionan… screenshot… feedback sobre cómo se podría mejorar… un testeo bastante profundo de todo». Se usó
la tab en **producción** (hola-mako.com, el despliegue del 10/11), en el navegador de la app y con la sesión de Martín, a 1440 y
a 375, en claro y en oscuro. Se escribió **sólo en el ws 3 (Cliente de Prueba)**. **Apify: US$0 gastados** (el ws 3 no tiene
clave de Spy; lo que se sumó se copió de lo que la plataforma ya había leído, y YouTube va por la cuota gratis de la API).

**En números (las cuatro vueltas):**
- **42 casos** probados el 10/11, **17 pantallas miradas con captura** el 11/11 a la madrugada, **20 capturas de producción**
  a la tarde con todo desplegado, y **13 más** después del despliegue de esos arreglos.
- **32 fallas** encontradas, **las 32 arregladas** (9 + 8 + 10 + 5), cada una con su test probado rompiéndolo
  (`tests/spy-pruebas-10-11.test.ts`, 16 casos y 19 roturas; `tests/mirada-prod-11-11.test.ts`, 14 casos y 16 roturas).
- **8 observaciones** que no se arreglaron acá (abajo, con el porqué y dónde viven), más 4 de la tercera vuelta.
- **4 casos sin probar** (abajo, con el porqué).

Los arreglos van en la punta `punta/spy-pruebas`. Las capturas están en `docs/pruebas/competitor-spy-10-11/` (son de ANTES del
arreglo: muestran la falla).

## Cuarta vuelta (11/11, 16:05–16:45 UTC): los diez arreglos de la tercera, en producción

Producción con 2507c11c7 (despliegue de las 15:55 UTC, trae 8f84d8bce). Navegador de la app, sesión de Martín comprobada con
`/api/auth/me`, `?ws=3`, a 1440 y a 375. Capturas en `docs/pruebas/competitor-spy-10-11/prod2/`.

| # | Arreglo de la tercera vuelta | En producción | Captura |
|---|---|---|---|
| P1 | Buscador: «lead magnet», «avatar» | ✅ «lead magnet» → Copywriting · Create; «avatar» → Video · Create | 02, 03 |
| P2 | «Crear el regalo» → crear | ✅ Los cuatro van a `/copywriter?nueva=&ws=3`: «¿Qué vas a crear hoy?» | 01 |
| P3 | More sin el hueco | ✅ Settings queda a 28 px de Create, el aire de los demás grupos | 04 |
| P4 | 404 del teléfono sin «Ctrl K» | ✅ Sin la frase en el teléfono; en la computadora sigue | 05 |
| P5 | Títulos de lado a lado | ✅ 3 de 15 cortados (los de más de ~60 letras), con las portadas | 06 |
| P6 | Links legibles | ✅ `acquisition.com/fivescalingframeworks`, ningún `utm_` | 07 |
| P7 | Botones de conectar | ✅ «Conectar» (guion de un reel) y «Conectar mi IA» con fondo, borde y peso 600 | 08, 09 |
| P8 | «Acquisition.com» en el teléfono | ✅ Entero; «Su web · revisado hace 15 h» abajo | 12 |
| P9 | Sugeridos sin recargar | ⚠️ **A medias:** desde la papelera de la lista vuelve; **desde la ficha, no** | 10 |
| P10 | «lleva 1 d» | ✅ «la que más espera lleva 1 d en la cola» | 11 |

**Lo que siguió mal, y su arreglo** (los cuatro en `tests/mirada-prod-11-11.test.ts`, casos 9, 11, 12 y 13; 5 roturas cazadas):

| # | Lo que se vio | Arreglo |
|---|---|---|
| Q1 | Desde la ficha, «⋯ › Dejar de mirarlo»: Alex no volvía a Sugeridos. El registro de pedidos: salía el borrado y **nada más** | Después de `irA(null)` no sale ningún pedido (el código ya lo decía de la lista). Los sugeridos se piden ANTES de volver |
| Q2 | La tarjeta dice «Alex Hormozi» y la ficha **«@AlexHormozi»**: el título, «¿Dejar de mirar a @AlexHormozi?», la oferta, los avisos | La ficha usa el nombre de su tarjeta (`nombreDeTarjeta`) en todo lo que se lee |
| Q3 | El detalle de un video: la descripción en una caja de 180 px con barra, y **~165 px vacíos** debajo (el modal mide 800 de alto) (07) | Hasta 320 px a 900 de alto, sin una segunda barra en el modal (medido inyectado: 550/550) (13) |
| Q4 | Teléfono: tres caras de Sugeridos como cuadrados verdes vacíos | La cara de 48 px bajaba el dibujo de 600 px (175 KB); ahora el de 200 px (72 KB) |
| Q5 | Los 3 nombres que no entran no se pueden leer sin abrir la pieza | Se leen enteros al pasar el mouse (`title`) |

**Para otros chats (sin tocar acá):**
- **Copywriting:** «Crear el regalo» cae en «¿Qué vas a crear hoy?», pero entre las plantillas no hay ninguna de regalo (guía,
  checklist). Con la IA conectada se pide escribiendo; sin IA («Instala MaKo para escribir»), no hay por dónde (01).
- **Web Generator:** «Sus páginas» queda en blanco unos segundos mientras carga la vista de su web, sin aviso.

**Lo que quedó en el ws 3:** nada nuevo (Alex se sumó y se sacó dos veces).

## Tercera vuelta (11/11, 14:45–15:30 UTC): producción con TODO desplegado

Producción con e14dd7cde (despliegue de las 11:05 UTC). Navegador de la app, sesión de Martín (super admin, comprobada con
`/api/auth/me`), negocio de prueba (`?ws=3`), a **1440** y a **375**. Capturas en `docs/pruebas/competitor-spy-10-11/prod/`.

**Lo que ya se ve bien (los arreglos de las dos vueltas, mirados):**

| Qué | Captura | Se ve |
|---|---|---|
| Create en la barra a 1440 | 01 | Copywriting, Video, Image, Web Generator. Sin AI Avatar ni Lead Magnet |
| Create en More del teléfono | 03 | El mismo orden, sin AI Avatar ni Lead Magnet |
| `/lead-magnet-generator` y `/m/lead-magnet-generator` | 02, 07 | «Esta dirección no existe», con 404. La API (POST) da 404 «No existe» |
| «Crear el regalo» del Marketing CoPilot (los 4 botones) | 08 | Lleva a `/copywriter?ws=3`. Ningún «Lead Magnet» en la pantalla |
| Lista de Spy, ws 3 | 05, 06 | Leila con su caricatura; Sugeridos sin letras gigantes; Alex Hormozi con su dibujo |
| Gráfico de Leila | 09 | **Con sus portadas** (237 de 242 bajadas; antes, cero) |
| Ficha de Leila | 10 | «A dónde manda» + «Lo que mejor le fue» en una fila de dos, sin tapar «Todas sus piezas» |
| Detalle de un video | 13 | El reproductor de YouTube carga (no es negro); sin la cifra cortada. En un reel: «Frente a su cuenta 15,7×» |
| Funnel de Leila | 14 | «Su funnel · No se ve todavía» (antes, «Webinar en vivo» falso); «Sus páginas» muestra su landing |
| «Sus páginas» de Acquisition.com | 16 | «Capturar / Abrir» (antes, su error en inglés) |
| «Hacer uno así» en un reel | 17 | «Como Leila Hormozi: This is the skill that separates…» entero, y «117 mil me gusta» |
| Teléfono, lista y ficha | 18, 19 | El título ya no queda tapado por la pastilla «Cliente de Prueba»; el gráfico con portadas |
| Negocio de Martín (ws 9), sólo la lista | 20 | «Leila Hormozi · 637 piezas · 152 borradas» (antes, «80 piezas»); Alex, 64 |
| Sumar un sugerido y «⋯ › Dejar de mirarlo» | — | Alex se suma (50 piezas copiadas, gratis) y desaparece de la lista sin recargar |

**Lo que se vio mal, y su arreglo** (test: `tests/mirada-prod-11-11.test.ts`, 11 casos, 11 roturas cazadas):

| # | Lo que se vio | Arreglo |
|---|---|---|
| P1 | Buscar «lead magnet» o «avatar» en la barra: **«Nothing found»** (04). El 404 de las rutas viejas dice que el buscador «entiende también los nombres viejos» | Alias: «lead magnet», «regalo» → Copywriting; «avatar», «ai avatar», «personaje» → Video (`lib/buscador-nav.ts`) |
| P2 | «Crear el regalo» dejaba a la persona en la galería de outliers del Copywriter, sin nada que dijera regalo | Va a la pantalla de crear: `/copywriter?nueva`, «¿Qué vas a crear hoy?» con el campo para pedirlo |
| P3 | More del teléfono: **66 px de hueco** entre Create y Settings (un título vacío que igual ocupa su lugar) | `SeccionM` sin título ni acción no dibuja la cabecera |
| P4 | El 404 en el teléfono: **«presiona Ctrl K»** (07) | En un teléfono esa frase no va |
| P5 | Spy: **14 de 15 nombres de videos de YouTube cortados** aun en dos renglones: el nombre tenía 104 px de 234 (11) | La píldora de vistas sube a la fila de su tipo y el nombre usa todo el ancho: **3 de 15** cortados (12, con el CSS nuevo puesto a mano en producción) |
| P6 | Detalle de un video: la descripción, renglones de `https://www.acquisition.com/…?utm_source=youtube&utm_medium=…` | Cada link se lee como su sitio y su camino: `acquisition.com/fivescalingframeworks` (`linksLegibles`, lib/spy-vista.ts) |
| P7 | Funnel: **«Conectar mi IA» se ve como texto suelto en una caja sin relleno** (14). Igual los otros cuatro botones de conectar de Spy | `BotonIntegracion` les pisaba la clase con estilos en línea: Spy le pasa `CON_SU_CLASE` (15, con el arreglo puesto a mano) |
| P8 | Teléfono: **«Acquisition.con»**, cortado en seco sin «…» (18) | «Revisado hace…» pasa a la segunda línea cuando no hay piezas; y en todo el teléfono, una palabra más larga que la fila baja de renglón |
| P9 | Alex, sumado desde Sugeridos y sacado, **no volvía a Sugeridos** hasta recargar | Al dejar de mirar a alguien, la pantalla vuelve a pedir los sugeridos |
| P10 | Negocio de Martín: «la que más espera **lleva hace 1 d** en la cola» (20) | «lleva 1 d» |

**Observaciones de esta vuelta, sin arreglar acá:**
- **«¿Qué formatos le funcionan?» de Leila** tiene una sola fila («Tutorial», 302 piezas) con sus 40 mejores apiladas en 110 px.
  Es el diseño (las de más arriba, para que no se tapen); con un solo formato, la tarjeta dice poco.
- **Las caricaturas miden 200 px** (`spy/caricatura/instagram-leilahormozi.png`) en una tarjeta de 264 (528 en una pantalla
  retina): se ven blandas. Las hace el Runner con Canva; agrandarlas es rehacerlas.
- **Acquisition.com sigue siendo una «A» gigante**: es un competidor con sólo su web, sin cara de la que hacer caricatura.
- **El teléfono tiene «Offer» en Marketing y la barra de la computadora no**: es de la tab Offer.
- **«Todas sus piezas» le dice a un cliente «Conecta Apify»**: el nombre de un proveedor (es la regla de que cada negocio
  conecta sus claves; el texto es de la tab).
- Los carruseles de Leila en el ws 3 son una copia del 10/11, anterior al arreglo M7: dicen lo que decían. La próxima copia trae
  su tipo.

**Lo que quedó en el ws 3 de esta vuelta:** una página del Copywriter («Como Leila Hormozi: This is the skill that separates…»).
Alex Hormozi se sumó y se sacó.

## Segunda vuelta (11/11): MIRADO con capturas, al lado de la referencia

Martín miró la primera vuelta y dijo que no alcanzaba: se había probado leyendo texto y código, no mirando. Esta vuelta abre cada
pantalla, la captura y la critica al lado de su referencia (fitlo para el catálogo, merrin para el riel: capturas `mirada/00-…`).
Producción todavía tenía el código del 10/11 (compila sola a las 08:05 de Argentina): **lo que sigue es lo que se VE hoy**, y los
arreglos salen con el próximo despliegue. Capturas en `docs/pruebas/competitor-spy-10-11/mirada/`.

| # | Lo que se ve (captura) | Crítica | Arreglo |
|---|---|---|---|
| M1 | El gráfico de Leila con **cero portadas**: 180 tarjetitas de color con el logo (05) | Es lo mismo que Martín marcó en Video. La primera vuelta lo dejaba llegar tarde; el fondo es el peso | ✅ Lo chico de YouTube (gráfico, «Lo que mejor le fue», la película del alta) va con la miniatura chica de YouTube: **4,7 KB contra 85 KB** de la guardada. Instagram no tiene una chica pública: sigue la guardada, que ahora llega tarde |
| M2 | «¿Qué formatos le funcionan?»: **una caja blanca de 739 px con 82 de contenido** (06) | Es lo que ve un CLIENTE hoy (sin la barra de agencia). Con el arreglo del riel de la primera vuelta, también lo habría visto Martín | ✅ Como merrin: el riel queda con la ficha, los seguidores y «¿En qué publica?», y **«A dónde manda» + «Lo que mejor le fue» bajan a una fila de dos tarjetas** debajo. Las dos columnas quedan parejas |
| M3 | Los títulos de los videos cortados: **9 de 10** («52 Minutes of…», «5 Ways to Han…») (07) | Igual que en Video | ✅ El nombre va en dos renglones, como mide la referencia (`clamp 2`) |
| M4 | Detalle de un video: la cuarta cifra dice **«Frente a lo qu… · Falta un trá…»** (08) | Cortado y sin que se entienda («un trámite con YouTube») | ✅ Sin su número, la cifra no se muestra (regla de Martín del 22/10: si no está el dato, no va). Con número, se llama «Frente a su cuenta» y entra |
| M5 | «Sus páginas» de Acquisition.com muestra **su propia página de error, en inglés**: «This page couldn’t load · Reload · Back» (10) | Su web pinta, avisa que pintó, y su JavaScript se rompe dentro de la vista aislada | ✅ Ese texto (el error de Next.js nuevo) cuenta como página de error: la vista se esconde y queda «Capturar / Abrir» |
| M6 | Celular: el título fijo de arriba queda **tapado por la pastilla «Cliente de Prueba»** (12) | Con un nombre largo se tapan 35 px | ✅ Cada lado del encabezado con tope en su columna: la pastilla se achica con su «…» |
| M7 | Carruseles copiados dicen «Publicación», sin láminas (09) | «Sumar» no copiaba si era carrusel, imagen o video | ✅ Se copia (en el ws 9 sólo 18 de 268 lo tienen: las lecturas viejas no lo traían) |
| M8 | «link.acquisition.com · 0% de 637» con una pieza | Se lee como nada | ✅ «menos del 1% de 637» |
| M9 | La lista del ws 3 al entrar: tarjetas verdes vacías hasta que llegan las caras (01) | En el panel oculto tardaron 11 s; pesan 3–63 KB, así que en una ventana a la vista es menos | Sin arreglo: **mirar en Chrome** cuánto tarda de verdad |
| M10 | Las fotos de perfil miden **150 px** y la tarjeta 264 (528 en una pantalla retina) | Se ven borrosas | Sin arreglo: Instagram sólo da esa foto. La caricatura (600 px) no tiene el problema |
| M11 | Negocio de Martín (ws 9): **«Leila Hormozi · 80 piezas · 31 borradas» con 790**; Alex «60 · 63 borradas» (03) | Los conteos cortados de la primera vuelta, vistos donde más se notan | ✅ Ya arreglado (falla 5), sale con el despliegue |
| M12 | Negocio de Martín: **17 de 24 tarjetas son una letra gigante** con «Sin canales todavía» (04) | Una pantalla vacía en producción | **Decide Martín (plata)**: son nombres sin Instagram ni YouTube. Buscar sus redes cuesta ~US$0,08 en total; leerlas después, más |
| M13 | Negocio de Martín: arriba, **«Las caricaturas no se están haciendo: la que más espera lleva 1 d en la cola. Las hace el Runner con Canva.»** (02) | Es verdad (Agencia Generación de Leads sigue «Haciendo su caricatura…») y el texto es técnico | Para el Cerebro: la cola de caricaturas está frenada desde hace un día |
| M14 | Celular: la grilla va de a **una pieza por pantalla** (cada reel, ~640 px) (13) | Se ve poco | Sin arreglo: una columna fue una decisión escrita (§8 del diseño, `tests/spy-telefono-una-columna.test.ts`). Propuesta para Martín: dos columnas |
| M15 | Celular: no hay funnel ni páginas («Su web se mira en la computadora») | Una parte entera de la tab no existe en el teléfono | Propuesta para Martín: al menos «Su funnel» (no necesita la vista de su web) |
| M16 | Celular: la tercera cifra (Mediana) queda sola en su fila (11) | Desparejo | Sin arreglo (menor) |
| M17 | Detalle de un video: el reproductor se ve **negro** (08) | Con el panel oculto no se puede saber si carga | **Mirar en Chrome** |

**Para ver después del despliegue (en una ventana a la vista, Chrome de Martín cuando esté libre):** el gráfico de Leila con sus
portadas de YouTube; la ficha sin la caja vacía y con la fila «A dónde manda / Lo que mejor le fue»; los títulos en dos
renglones; el detalle de un video sin la cifra cortada; «Sus páginas» de Acquisition.com en «Capturar / Abrir»; el encabezado
del celular.

## Las personas y las pantallas

| Persona | Dónde | Qué se probó |
|---|---|---|
| Super admin viendo un negocio como agencia | ws 3, 1440, claro y oscuro | Lista, Sugeridos, sumar, alta por YouTube, ficha (Contenido y Funnel), filtros, orden, búsqueda, páginas, detalle, «Hacer uno así», borrar |
| El mismo, en el teléfono | ws 3, 375 (MaKo Mobile) | La lista, Sugeridos y la ficha |
| Negocio sin clave de Apify ni IA | ws 3 | Qué dice la tab cuando no puede leer Instagram, transcribir ni leer la oferta |
| Super admin en su negocio (ws 9) | sólo la base, en lectura | Portadas guardadas y vencidas, los 17 competidores sin red, el cron de traídas largas. **No se abrió ninguna ficha del ws 9**: abrir una de más de un día lee Instagram y anuncios con la clave de Martín |
| Esencial contra Pro | código | Spy es igual en los dos planes (Esencial = capa «completo», todas las tabs; ningún tope de Spy por plan en `lib/plan-esencial-reglas.ts`). Lo que cambia es si el negocio tiene clave de Apify y su IA |
| Miembro (no admin) | código | Ve y suma igual que el admin; sólo el admin puede «Dejar de mirarlo» (`soloAdmin`, `app/competitor-spy/actions.ts`). No se probó en pantalla: la app no tiene «ver como» un rol y no se crean cuentas |

## Las 9 fallas, todas arregladas

1. **El riel de la derecha se dibujaba encima de «Todas sus piezas»** (captura 05). Con la barra de agencia arriba («Estás viendo
   el dashboard de…»), «A dónde manda» y «Lo que mejor le fue» tapaban la quinta columna de la grilla y el selector de orden. El
   riel medía 850 px fijos con 1.378 de contenido: la regla global `[data-barra-agencia] aside` (para el menú lateral) le fuerza
   a TODO `<aside>` el alto de la ventana. → El riel pasa a `<section>`, como ya hicieron el Dashboard, el Video y el Web
   Generator. `app/competitor-spy/SpyApp.tsx`.
2. **Las portadas del gráfico casi nunca aparecían** (captura 06). Con Leila Hormozi, ~12 portadas de 180: el resto eran la
   tarjetita rosa de Instagram o la negra de YouTube. Las 180 estaban guardadas y respondían bien; el gráfico esperaba 3 s y
   lo que llegaba después no se dibujaba nunca (cada portada pesa ~250 KB). → Las que llegan tarde entran solas a su tarjetita.
   `app/competitor-spy/precarga.ts`, `GraficoSpy.tsx`.
3. **Las fechas salían con el día siguiente a la noche** (capturas 06, 13, 14). A las 22 h de Argentina, un competidor recién
   sumado decía «lo seguimos desde el 11 nov» y el gráfico terminaba en «11 nov»: era el 10. En México pasaba desde las 18 h.
   Se escribían en UTC. → Se dicen en la zona del producto (la de México, la misma en el servidor y en el navegador).
   `lib/spy-vista.ts` (`fechaCorta`), `lib/spy-funnel-tipo.ts` (las citas «Reel del…»).
4. **«Su funnel: Webinar en vivo» para Leila Hormozi, con evidencia falsa** (captura 09). Las citas eran «Episode 1 of Dear Leila
   **is live**, exclusively on YouTube» y «The season finale is now **LIVE**»: en inglés, «ya salió». Su funnel es una descarga
   gratis. → «live» suelto deja de contar; cuenta pegado a lo que se agenda («live training», «live class», «live Q&A») o en
   «join me live». Con sus 637 piezas, ahora dice «No se ve todavía». `lib/spy-funnel-tipo.ts`.
5. **La tarjeta decía menos piezas de las que tenía.** Alex Hormozi: «363 piezas» en la lista, 500 en su ficha. El conteo pedía
   5.000 filas y la base devuelve 1.000 como mucho, sin avisar: pasa en cualquier negocio con más de 1.000 piezas (en el de
   Martín hay ~2.500, así que casi todas sus tarjetas estaban cortas). → Se lee de a páginas. `lib/spy.ts` (`resumenDePiezas`).
6. **«Dejar de mirarlo» desde la ficha no lo sacaba de la lista** (captura 11). Se borraba en la base, pero la lista lo seguía
   mostrando —con el aviso «Alex Hormozi y Acquisition.com tienen la misma web · Juntarlos»— hasta recargar la página. Medido
   con un registro de pedidos: el borrado respondía bien y el pedido de la lista nunca salía. Desde la «×» de la tarjeta sí
   andaba. → Se saca de la lista en el acto. `app/competitor-spy/SpyApp.tsx` (`quitar`).
7. **«Sugeridos» ofrecía 17 competidores vacíos** (capturas 04, 19). De 24 sugeridos, 17 eran sólo un nombre (cargados el 8/11
   por sus anuncios, que no se copian a otro negocio): una grilla de letras gigantes, y «Sumar» dejaba una ficha vacía. → Sólo
   se sugieren los que tienen alguna red; vuelven a aparecer solos cuando tengan una. `lib/spy-sugeridos.ts`.
8. **En la computadora, Alex Hormozi salía como una «A» en «Sugeridos»** (captura 19), y con su dibujo en el teléfono y en
   «Competidores». → La misma cara en los tres lugares. `lib/spy-sugeridos.ts`.
9. **«Hacer uno así» armaba la página con el título cortado a mitad de palabra y los números crudos** (captura 10): «…A bad one
   mult» y «13588 me gusta» al lado de un detalle que decía «14 mil». → Se corta en una palabra entera con «…», y los números
   van como en la ficha. `lib/spy-detalle.ts`, `app/api/competitor-spy/copiar/route.ts`.

## Los casos que funcionan bien

| # | Caso | Resultado |
|---|---|---|
| 1 | Lista del ws 3 (captura 01) | Bien: tarjetas con caricatura, redes, piezas y «Revisado hace…» |
| 2 | Sumar un sugerido (Leila Hormozi) | Bien: copió 637 piezas con sus portadas, sin gastar nada; la película del alta y el loader con su caricatura |
| 3 | Alta por la barra: «Alex Hormozi» | Bien: «Ya los miras», su YouTube con 4.6 M y «Agregar con su nombre»; sin clave de Apify no ofrece Instagram |
| 4 | «¿Es este canal?» antes de agregar (captura 15) | Bien: foto, canal y suscriptores; «Sí, agregar» trajo 500 videos |
| 5 | La película «Ordenando lo que publica…» (captura 16) | Bien, con «Saltar» |
| 6 | No duplicar: después de agregar a Alex | Bien: sale de «Sugeridos», y aparece «tienen la misma web · Juntarlos» |
| 7 | Cifras de la ficha (contenido corto, vistas, mediana, seguidores, suscriptores) | Bien |
| 8 | «¿En qué publica?», «A dónde manda», «Lo que mejor le fue» | Bien (el texto de la fecha, arreglado en la falla 3) |
| 9 | Buscar en sus piezas («money») | Bien |
| 10 | «Qué ver»: Reels, Carruseles e imágenes, Videos de YouTube, Shorts | Bien, con su cantidad |
| 11 | Rendimiento mínimo (3×+) (captura 07) | Bien |
| 12 | Orden: más vistas, más reciente, mejor rendimiento | Bien |
| 13 | Búsqueda sin resultados | Bien: «Nada coincide · Ninguna de sus 637 piezas pasa esta búsqueda · Ver todo», y «Ver todo» limpia |
| 14 | Páginas de la grilla | Bien: «16–30 de 637» y vuelve arriba de la grilla |
| 15 | Portadas de la grilla | Bien: 15 de 15. Si una no llega, queda su texto (no una caja vacía) |
| 16 | Detalle de una pieza (captura 08) | Bien: portada, me gusta, comentarios, su texto, «Ver en Instagram» |
| 17 | Guion sin clave de Apify | Bien: «Para transcribirlo hace falta tu clave de Apify · Conectar» |
| 18 | «Hacer uno así» | Bien: abre la página nueva del Copywriter (el título y los números, en la falla 9) |
| 19 | «Su oferta» sin IA | Bien: «Conecta tu IA para leer su oferta · Conectar mi IA» |
| 20 | «Ver sus anuncios en Meta» | Bien: la Biblioteca con su nombre exacto |
| 21 | «Copiar su sitio» | Bien: va a Replicar del Web Generator con su página |
| 22 | «Capturar» sin la extensión (captura 17) | Bien: «Instala la extensión de MaKo · Cancelar · Instalar» |
| 23 | Píxeles y video de su web (Acquisition.com, captura 02) | Bien: Google Analytics, Tag Manager, Google Ads, TikTok, Vidalytics |
| 24 | Cambiar de competidor desde la miga | Bien |
| 25 | Menú «⋯»: Agregar un canal, Guardar un anuncio, Su país, Dejar de mirarlo | Se abre bien; se probó «Dejar de mirarlo» |
| 26 | «Dejar de mirarlo» desde la «×» de la tarjeta | Bien: pide confirmación y lo saca |
| 27 | Confirmación del borrado | Bien: «¿Dejar de mirar a…? Se borra lo que se leyó de él.» |
| 28 | Tema oscuro (captura 12) | Bien |
| 29 | Teléfono: lista y Sugeridos (captura 13) | Bien, sin desborde (375 de ancho) |
| 30 | Teléfono: ficha (captura 14) | Bien, sin desborde; grilla de a 3 |
| 31 | Portadas guardadas en nuestro almacenamiento | Bien: de 4.597 piezas de los ws 9 y 11, 4.565 tienen la portada en el almacenamiento propio de Spy (una muestra de 12 respondió 200); 21 no tienen una guardada (20 son de YouTube y usan la de YouTube); las 11 que quedaron en el CDN de Instagram dan 403 (vencidas) y se ven con su texto. No hizo falta coordinar con «Image»: Spy ya tiene su almacenamiento desde el 1/11 |
| 32 | Esencial contra Pro | Igual en los dos (ver arriba) |
| 33 | Sólo el admin borra | En el código (ver arriba) |

## Observaciones que no se arreglaron acá

1. **«Sus páginas» casi nunca muestra la página** (capturas 02, 03): con Acquisition.com y con la de Leila cae a «Capturar /
   Abrir», y por un instante se ve un recuadro negro con un ⚠. La vista previa es del Web Generator (`VistaAfuera`), y el chat
   «Web Generator» estaba trabajando: queda para él.
2. **17 competidores del negocio de Martín siguen vacíos** (Shelby Sapp, Jeremy Miner, Dave Ramsey…): se cargaron sólo con el
   nombre para traer sus anuncios, y el cron de las traídas largas corre cada hora pero no arranca ninguna desde el 4/11 porque
   el crédito de Apify está por debajo de la reserva. No es un error: es la plata. **Decide Martín.**
3. **Las portadas pesan de 250 KB a 1 MB** cada una para una tarjeta de 200 px. Es la causa de fondo de la falla 2: el arreglo
   las deja llegar, pero un gráfico de 180 baja ~50 MB. Propuesta: guardar una versión chica al bajarla. No se hizo: hay que
   rehacer las ~4.600 guardadas.
4. **El chat de MaKo desde Spy abre el Ops Center general** (captura 18), con la última charla del negocio (una del Dashboard),
   no una charla sobre el competidor que se está mirando. En el ws 3 pide «Instala MaKo para escribir». No se pudo probar qué
   contesta MaKo sobre un competidor.
5. **Marcar las piezas que se fueron también corta en 1.000** (`marcarDejadas`, `lib/spy.ts`): con más de 1.000 piezas vivas en
   un canal, las de más allá no se marcan. No muestra nada falso (sólo deja de marcar); se arregla igual que la falla 5.
6. **Teléfono: «Acquisition.c»** queda cortado sin «…» al lado de «Revisado hace 37 min» (captura 13).
7. **«link.acquisition.com · 0% de 637» con 1 pieza** en «A dónde manda»: con una pieza, «0%» se lee como nada.
8. **El primer toque en «Cambiar de competidor» y en «⋯» a veces no abrió el menú** (2 de 4 veces), con el panel del navegador
   oculto. No se pudo repetir con la ventana a la vista: puede ser el panel.

## Sin probar

1. **Leer un competidor nuevo por Instagram o sus anuncios**: gasta crédito de Apify, y la reserva está baja. Se probó todo lo
   demás con competidores ya leídos (copia gratis) y con YouTube (cuota gratis).
2. **«Guardar en Spy» desde la extensión** (la Biblioteca de Anuncios): el navegador de la app no tiene la extensión, y el Chrome
   que la tiene es de un cliente (Leandro).
3. **Agregar un canal, Guardar un anuncio y Su país** del menú «⋯»: se vio que están; no se usaron.
4. **Un miembro que no es admin, en pantalla**: no se crean cuentas.

## Mirar en producción después del despliegue

✅ **Hecho el 11/11 a la tarde: «Tercera vuelta», arriba.** Los ocho puntos se ven bien; el 3 (las fechas a la noche) se miró
de día. Queda para después de ESTE despliegue: los diez arreglos P1–P10.

En el navegador de la app, en `/competitor-spy?ws=3`, ficha de Leila Hormozi (`&competidor=42`):
1. Bajar hasta «Todas sus piezas»: «A dónde manda» y «Lo que mejor le fue» ya no tapan la grilla.
2. El gráfico: después de unos segundos, las tarjetitas se llenan con sus portadas.
3. A la noche, «lo seguimos desde el 10 nov» y el gráfico termina en el día de hoy.
4. Pestaña «Funnel»: «Su funnel · No se ve todavía», sin citar los «is live».
5. La lista: «Sugeridos» sin las letras gigantes, y Alex Hormozi con su dibujo.
6. Sumar un sugerido, abrirlo, «⋯ › Dejar de mirarlo»: desaparece de la lista sin recargar.
7. «Hacer uno así» en un reel: el título termina en una palabra entera con «…».
8. En el negocio de Martín (ws 9), la lista: las piezas de cada tarjeta coinciden con su ficha (sin abrir la ficha).

## Lo que quedó en el ws 3

- **Leila Hormozi** (sumada desde «Sugeridos», 637 piezas copiadas). Acquisition.com ya estaba.
- Una página del Copywriter: «Como Leila Hormozi: Comment “PARTNER”…».
- Alex Hormozi y Federico Cristofari se sumaron y se borraron (para probar el alta y el borrado).
