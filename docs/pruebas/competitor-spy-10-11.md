# Competitor Spy de punta a punta, por tipo de persona (10/11/2026)

Pedido de Martín (10/11): «Lo mismo con Competitor Spy… testeos de todo tipo… si hay textos rotos, botones rotos, diseño roto,
funcionalidades que no funcionan… screenshot… feedback sobre cómo se podría mejorar… un testeo bastante profundo de todo». Se usó
la tab en **producción** (hola-mako.com, el despliegue del 10/11), en el navegador de la app y con la sesión de Martín, a 1440 y
a 375, en claro y en oscuro. Se escribió **sólo en el ws 3 (Cliente de Prueba)**. **Apify: US$0 gastados** (el ws 3 no tiene
clave de Spy; lo que se sumó se copió de lo que la plataforma ya había leído, y YouTube va por la cuota gratis de la API).

**En números:**
- **42 casos** probados.
- **9 fallas** encontradas, **las 9 arregladas**, cada una con su test probado rompiéndolo (`tests/spy-pruebas-10-11.test.ts`, 8
  casos; 10 roturas, las 10 cazadas).
- **8 observaciones** que no se arreglaron acá (abajo, con el porqué y dónde viven).
- **4 casos sin probar** (abajo, con el porqué).

Los arreglos van en la punta `punta/spy-pruebas`. Las capturas están en `docs/pruebas/competitor-spy-10-11/` (son de ANTES del
arreglo: muestran la falla).

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
