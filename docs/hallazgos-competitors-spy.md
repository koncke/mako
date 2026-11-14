# Hallazgos — Competitors Spy (y las APIs de afuera que mira)

Dos tandas, las dos del **31/10/2026**: primero lo que se aprendió **relevando** las cuatro fuentes de
afuera antes de escribir una línea, y después lo que apareció **construyendo la Etapa 1** (la lista, la
ficha por bloques, el onboarding y el área `spy` de la API — etiqueta `nube/competitors-spy-3110`). La
tab ya no es `ComingSoon`: vive en `app/competitor-spy/`, con la nav key `market-an`, y el plan por
etapas sigue en [diseno-competitors-spy.md](diseno-competitors-spy.md). Acá van **las trampas**, que es
lo que se pierde si queda sólo en el plan.

Casi todas las de la primera tanda son del mismo tipo: **una API que devuelve otra cosa en vez de un
error.** Casi todas las de la segunda son del tipo opuesto: **un guard o una regla nuestra que marca
de más, y manda a arreglar algo que estaba bien.**

---

## `postgres` devuelve `vistas` como texto, y la mediana las PEGA: «35.736.643.029 vistas» (14/11/2026)

- **Síntoma:** el número del reel de prueba (`numeroDeSeguidos`, `lib/spy-seguidos-reglas.ts`) calculado en un script con las piezas
  reales de `spy_piezas` daba 35 mil millones de vistas.
- **Causa:** `postgres` (el cliente de los scripts que leen la base directo) devuelve las columnas `bigint` como TEXTO. `valorDe`
  (`lib/multiplo-rendimiento.ts`) acepta `"70919" >= 0` y `mediana` hace `(s[m - 1] + s[m]) / 2`: con dos textos los pega
  («70919» + «580385») y después divide. No da error.
- **La app no lo sufre:** lee por Supabase, que devuelve números. **Regla:** un script que le pasa filas de `sql` a las funciones
  puras convierte antes `vistas`, `megusta`, `comentarios` (y los ids) con `Number(…)`.
- Con los números bien, seguir sólo a Federico Cristofari da **11.209** vistas (la mediana de sus últimos 20 reels); sumar a Víctor
  Heras lo sube a 81.257. Es el número de la animación del CoPilot en la portada.

## Después de `irA(null)` no sale NINGÚN pedido: lo que tiene que llegar al server, va antes (11/11/2026)

**Vive en:** `app/competitor-spy/SpyApp.tsx` (`quitar`, `irA`). Lo fija `tests/mirada-prod-11-11.test.ts` (caso 9).

**Síntoma:** en producción, «⋯ › Dejar de mirarlo» desde la ficha de Alex Hormozi lo sacaba de la lista, pero no lo devolvía a
«Sugeridos» hasta recargar. El arreglo de la tercera vuelta (`recargarSugeridos()` después de volver a la lista) pasó sus tests y
salió desplegado, y en producción no hizo nada.

**El diagnóstico obvio era el equivocado:** parecía que `sugeridosAction` devolvía la lista vieja. El registro de pedidos del
navegador decía otra cosa: después del borrado **no salió ningún pedido más**, ni el de los sugeridos ni el de la lista. Desde la
papelera de la tarjeta (sin `irA`), el mismo código mandó los tres pedidos y Alex volvió. `irA` cambia la dirección con
`window.history.pushState`; lo que se llama después no llega al server. Ya estaba escrito arriba de `sacarDeLaLista` para la
lista (10/11), y por eso la lista se arregla a mano; los sugeridos cayeron en la misma trampa.

**La regla:** en Spy, una acción del server que tiene que llegar se llama ANTES de `irA(...)`. Y un arreglo que depende de un
pedido se mira en el registro de pedidos del navegador, no sólo en la pantalla: un test que lee el código no ve si el pedido sale.

**En la misma vuelta:** la ficha decía «@AlexHormozi» (lo guardado) y su tarjeta «Alex Hormozi»: todo lo que se lee de la ficha
pasa por `nombreDeTarjeta` (`nombreC`). Y el modal del detalle tiene alto FIJO (`min(90vh, 800px)`): una caja con tope en
píxeles deja un hueco debajo en un video apaisado; el tope sale de ese alto menos lo demás.

## La tercera mirada, con todo desplegado: lo que la referencia no decía (11/11/2026)

**Vive en:** `app/competitor-spy/SpyApp.tsx` (`.spy-pcard__pie`, `recargarSugeridos`, el aviso de la cola) · `lib/spy-vista.ts`
(`linksLegibles`). Informe: `docs/pruebas/competitor-spy-10-11.md`, «Tercera vuelta». Test: `tests/mirada-prod-11-11.test.ts`.

- **El pie de fitlo no sirve para un video de YouTube.** fitlo pone la píldora del número AL LADO del nombre porque sus nombres son
  cortos («Merino tee»). Con los títulos de Leila, aun en dos renglones, 14 de 15 quedaban cortados: el nombre tenía 104 px de 234.
  La píldora sube a la fila de su tipo y el nombre va debajo, de lado a lado (3 de 15 cortados, los de más de ~60 letras).
  **Copiar la referencia también es medirla con NUESTROS datos.**
- **Una descripción de YouTube es casi toda rastreo:** `?utm_source=…&utm_medium=…&utm_campaign=…`. Lo que importa es a dónde
  manda: `linksLegibles` deja el sitio y el camino.
- **`sugeridosAction` existía y nadie la llamaba:** dejar de mirar a alguien sumado desde «Sugeridos» no lo devolvía ahí hasta
  recargar. Ahora `quitar` y `quitarDeLaLista` vuelven a pedir los sugeridos.
- **`haceCuanto` ya trae el «hace»:** «la que más espera lleva hace 1 d en la cola» salía así desde el 6/11. Una frase que
  necesita la duración sola le saca el «hace».

## En «Todas sus piezas», las publicaciones (carruseles e imágenes) salen sin miniatura (11/11/2026)

Recorriendo la grilla de Federico Cristofari (ws 9, `competidor=20`) para la maqueta de Marketing CoPilot, ninguna tarjeta de tipo «Publicación» tenía `<img>` en las páginas 10 a 16. Son 71 piezas. Los reels y los videos sí la tienen: viven en el almacenamiento público `spy-miniaturas/spy/<red>/<id>.jpg`.

En «Lo que mejor le fue» sí apareció una publicación con imagen (`instagram/DHSB3f3sMPl`, «Tarde de mates»). No lo seguí más.

Es coherente con lo que dice el relevo orgánico: con Meta oficial, las láminas del carrusel quedan en null. Para mostrar los carruseles de alguien (la cara de su Instagram), hace falta la primera lámina.

**Sin hacer:** confirmar la causa. Lo más probable es la de `lib/spy-miniaturas-relleno.ts`: las miniaturas que no se bajaron a tiempo quedan apuntando al CDN de la red, que vence y da 403, y el relleno sólo las rescata mientras la URL sirve. No lo verifiqué. Vive en `lib/spy-miniaturas.ts` y `lib/spy-miniaturas-relleno.ts`.
## «Su web» puede ser un acortador que abre un video de YouTube, y la oferta sale citada en inglés (11/11/2026)

**Síntoma:** la nota de la oferta de Federico Cristofari (ws 9, `competidor=20`, 46/100) cita frases en inglés: «This event is for you if you own a business…», «We generated $145,000 in one month…», «October 26, 27, and 28». Es un creador argentino que publica en español.

**El diagnóstico obvio era el equivocado:** no tiene una web en inglés. Su «web» (la que muestra «Sus páginas») es `linktw.in/pywydg`. Ese link no lleva a una página: abre su video de YouTube «Forget everything you know about content…», y la descripción del video manda a otro link, `linktw.in/fc-fede-yt`.

**Lo que se leyó:** YouTube devuelve el título y la descripción doblados al idioma de quien pide («Auto-dubbed»). Con un navegador en inglés, la descripción llega traducida. El original dice «Registro al evento 26,27,28 de octubre…».

- **Lo que está medido:** abriendo el link con Chrome sin ventana en inglés, la descripción sale en inglés y marcada «Auto-dubbed».
- **Lo que no verifiqué:** que el lector del Spy (`lib/spy-oferta.ts`, los `enlaces`) pida en inglés. Es lo más probable.

**La regla que queda:**
- Cuando «su web» resuelve a `youtube.com/watch`, no es una página de venta: es un video.
- Si se lee, se pide en el idioma del negocio (`Accept-Language`), o se toma la descripción original.
- La nota de la oferta no tendría que citar una traducción automática como si fuera el texto del negocio.

**Sin hacer:** el lector de la web del Spy no distingue un acortador que abre YouTube de una página. Vive en `lib/spy-oferta.ts`.
## La prueba en producción del 10/11/2026: lo que se rompía sin dar error

Informe caso por caso: [pruebas/competitor-spy-10-11.md](pruebas/competitor-spy-10-11.md). Nueve fallas, nueve arregladas
(`tests/spy-pruebas-10-11.test.ts`). Acá van las trampas, no el changelog.

- **Un `.limit()` de más de 1000 no trae más de 1000.** `resumenDePiezas` pedía `.limit(5000)` y PostgREST devolvió 1000 sin
  avisar: la tarjeta de Alex Hormozi decía «363 piezas» con 500 en su ficha, y en el ws 9 (~2.500 piezas) casi todas las
  tarjetas estaban cortas. **Regla: toda lectura de `spy_piezas` que pueda pasar de 1000 filas va por `leerPorPaginas`.** Queda
  una igual: `marcarDejadas` (`lib/spy.ts`), que con más de 1000 piezas vivas en un canal deja de marcar las de más allá.
- **Un `<aside>` en una pantalla es un riel del alto de la ventana para quien mira como agencia.** La regla global
  `[data-barra-agencia] aside` (app/globals.css) es para el menú lateral pero toma cualquier `<aside>`: el riel de la ficha
  quedó en 850 px con 1.378 de contenido, y lo que sobraba se dibujaba encima de la grilla. Sólo se ve con la barra de agencia
  arriba, así que el cliente no lo ve y Martín sí. Ya lo esquivaron el Dashboard, el Video y el Web Generator.
- **Una fecha «corta» en UTC es el día siguiente todas las tardes en México.** `fechaCorta` usaba `getUTCDate()`: a las 22 h
  de Argentina, «lo seguimos desde el 11 nov» el 10. Tampoco sirve la zona del navegador (la lista y la ficha se dibujan primero
  en el servidor y la fecha distinta rompe la hidratación): va en la zona del producto, fija.
- **El diagnóstico obvio era el equivocado, dos veces, con «Webinar en vivo».** Leila Hormozi salía como webinar por reels que
  dicen «Episode 1 of Dear Leila is live» (= ya salió). El primer arreglo —descartar «is/now live»— dejó el webinar igual: quedaban
  «unfiltered answers, live» (su programa en YouTube) y el verbo («Live Like the 1%»), y con «masterclass» en una sola pieza
  alcanzaba la regla de dos débiles. **«live» suelto en inglés no es una señal**: ahora cuenta pegado a lo que se agenda («live
  training/class/Q&A…») o en «join me live» (`SOLO_EN_CONTEXTO`, lib/spy-funnel-tipo.ts). Para medir: `clasificarFunnel` sobre
  las piezas reales del competidor, bajadas de la base en lectura; con 637 piezas tarda un segundo.
- **«Las portadas no cargan» no era el almacenamiento.** Las 180 del gráfico estaban guardadas y respondían 200; el gráfico
  esperaba 3 s (`TOPE_PRECARGA_MS`) y lo que no llegaba no se dibujaba nunca. La causa de fondo es el PESO: 250 KB a 1 MB por
  portada para una tarjeta de 200 px. Ahora llegan tarde; achicarlas al guardarlas sigue pendiente.
- **«El borrado no se refleja» no era una carrera con otra lectura.** Medido con un registro de `fetch`: desde la ficha, después
  de `irA(null)` (un `history.pushState`), la server action `competidoresAction` NO SE MANDA; desde la «×» de la tarjeta (sin
  navegar) sí. La causa dentro de Next no se encontró; el arreglo no depende de ella (se saca de la lista en el acto). Si otra
  acción tiene que correr justo después de un `pushState`, conviene medir que salga.
- **«El cron de las traídas largas está roto» tampoco.** Corre cada hora (`cron.rotacion.spy-todo` se mueve), pero desde el 4/11
  no empieza ninguna corrida: el crédito de Apify está bajo la reserva y `pasoDeCanal` contesta `sin-credito` sin decirlo en
  ninguna pantalla. El registro `spy.todo` del ws 9 quieto desde el 4/11 es la señal. Los 17 competidores sólo con nombre siguen
  vacíos por eso; es una decisión de plata.
- **Abrir una ficha del ws 9 gasta la clave de Martín.** Una ficha de más de 24 h lee Instagram (Apify) al abrirse
  (`debeLeerAlAbrir`), y `traerTodo` arranca la traída larga. Para probar sin gastar: en el ws 3 (sin clave), «Sumar» un sugerido
  copia lo ya leído gratis, y el alta por YouTube va por la cuota gratis de la API.
- **Los sugeridos sin ninguna red se dejan de ofrecer** (`tieneDondeLeerlo`, lib/spy-sugeridos.ts): «Sumar» uno así dejaba al
  cliente una ficha vacía, porque sus anuncios no se copian a otro negocio.

**La segunda vuelta (11/11), MIRANDO con capturas, encontró ocho más que la primera no vio leyendo:**

- **Martín y el cliente no ven la misma ficha.** Con la barra de agencia, la regla de `<aside>` cortaba el riel en 850 px (y lo
  dejaba tapar la grilla); sin ella —el cliente— el riel medía 1.378 y «terminan en la misma línea» estiraba «¿Qué formatos le
  funcionan?» a **739 px con 82 de contenido**. Arreglar el `<aside>` habría llevado la caja vacía a la vista de Martín. **Una
  pantalla se mira también sin la barra de agencia** (sacarle `data-barra-agencia` al `<html>` en la consola alcanza). El arreglo
  copia la tercera fila de merrin: el riel lleva lo del alto de la columna de al lado y lo demás baja.
- **Una miniatura para 34 px no se baja de 85 KB.** La chica de YouTube (`i.ytimg.com/vi/<id>/mqdefault.jpg`) pesa 4,7 KB, es la
  misma imagen y no vence: `miniaturaChica` (lib/spy-vista.ts) la usa para todo lo chico. Instagram no tiene una pública.
- **Una web ajena puede pintar bien, avisar que pintó, y romperse después** dentro del marco aislado: acquisition.com quedó en
  «This page couldn’t load» (el error de cliente de Next.js nuevo, que `esPaginaDeError` no conocía). El aviso de pintado se
  repite a 1,2 y 3 s; si el error llega después de eso, todavía se ve.
- **«Sumar» no copiaba `medio` ni `laminas`**: un carrusel copiado decía «Publicación».
- **El CSS de SpyApp vive en una plantilla de texto: un comentario con comillas invertidas la cierra y rompe el archivo
  entero.** Los tests de esta tab leen el archivo como TEXTO y dieron verde; lo frenó `scripts/hooks-en-orden.sh` en el push
  (eslint no lo pudo leer). En esos comentarios, las clases van entre «».

---

## Los outliers de video para la tab Video: lo que ya pagamos y tiramos (9/11/2026, nube)

**Pedido** (Martín): conseguir los reels y anuncios que más funcionan, para que sean lo primero de la tab Video. El informe
entero, con la recomendación, la fórmula y el contrato de datos: [investigacion-outliers-video.md](investigacion-outliers-video.md).
Acá van las trampas.

- **El diagnóstico obvio («hay que buscar una API de outliers») era el equivocado: la biblioteca de carruseles ya los paga y
  los tira.** `filasDeLectura` descarta todo `formato === 'REELS'` y `medio === 'video'`. Medido el 4/11: de 40 publicaciones
  por cuenta quedan 9 carruseles; las otras ~31 se cobraron (US$0,0023 cada una) y se perdieron. Es la misma familia que
  «el dato más barato es el que ya pagaste y estás tirando» (2/11).
- **La tabla ya los acepta y el explorador se los comería.** `carruseles_biblioteca_piezas` tiene `vistas` y admite
  `medio = 'video'`, pero `recortarBiblioteca` filtra `medio !== 'imagen'`: un reel guardado ahí saldría como carrusel. Antes
  de guardar uno, ese filtro pasa a `medio === 'carrusel'`.
- **La búsqueda OFICIAL de hashtags de Instagram parece la salida legal y no sirve.** `top_media` no deja pedir `username`:
  sin autor no hay mediana de su cuenta ni creador que replicar. Además pide App Review, cuyos usos permitidos (campañas
  propias, sentimiento, concursos) no incluyen descubrir lo viral de un nicho, y topea en 30 hashtags cada 7 días.
- **El «×» va contra la cuenta; el nicho es el filtro, no el denominador.** Contra la mediana del nicho ganan siempre las
  cuentas grandes. Y la ayuda de vidIQ dice «promedio», no mediana: la casa se queda con la mediana de `lib/multiplo-rendimiento.ts`,
  que es la única cuenta y no se duplica.
- **TikTok no tiene formato para el «×».** `formatoDeMultiplo` devuelve `null` para `canal === 'tiktok'`: un TikTok saldría
  `sin-formato` sin un error. Y no hay camino legal comercial para TikTok ajeno: Research API es académica, Display API es
  sólo la cuenta propia, Commercial Content API es de anuncios europeos.
- **«Tus outliers» ya tiene fuente legal en casa:** `lib/zernio-organico.ts` trae los posts propios con vistas. Su 0 mientras
  Zernio sincroniza (`sinMetricas: 'pendiente'`) no es «nadie lo vio».
- **`piezaDeApify` no lee la duración de un reel** (`videoDuration`): la plantilla de video la necesita.
- **Desde abril de 2026, `view_count` de `business_discovery` suma Facebook** en los reels publicados en los dos lados.
- ⚠️ **La nube no llega a las fuentes:** el proxy rechaza `api.apify.com`, `graph.facebook.com`, `developers.facebook.com`,
  `ads.tiktok.com` y `www.tiktok.com`, y `www.googleapis.com` da 403 sin clave. Los precios de afuera salen de buscadores y
  se verifican antes de pagar; las dos pruebas gratis (el oEmbed de TikTok y la tienda de Apify) están en el informe para
  correrlas desde la PC.

**Vive en:** `lib/carruseles/biblioteca.ts` (`filasDeLectura`, `recortarBiblioteca`) · `lib/multiplo-rendimiento.ts`
(`formatoDeMultiplo`) · `lib/instagram-perfil.ts` (`piezaDeApify`) · `lib/zernio-organico.ts` · `docs/investigacion-outliers-video.md`.

---

## «Copiar su sitio» abría el Diagnóstico, no Replicar (9/11/2026, nube)

**Vive en:** `app/competitor-spy/SusPaginas.tsx` («Copiar su sitio»), `lib/editor-landing/replica-extension-cliente.ts`
(`hrefReplicar`), `app/web-generator/panel-reglas.ts` (`?replicar=`).

- **El síntoma:** «Copiar su sitio» sobre una página que Spy no podía mostrar (Beacons de Den Borg) fallaba otra vez. **La causa:**
  el botón llevaba a `/web-generator?analizar=<url>`, que abre el DIAGNÓSTICO: vuelve a bajar la página por el servidor (el mismo
  que no la pudo bajar para la vista previa) y, aunque la bajara, no replica nada.
- **No había ninguna dirección que abriera Replicar con una página**: `?vista=replicar` abre el cuadro vacío y la dirección sólo
  llegaba desde la caja. Se sumó `?replicar=<url>` (arranca leyendo, como el link pegado en la caja), y «Copiar su sitio» la usa.
  Si el servidor no la baja, Replicar ofrece «Copiar con la extensión» (hallazgos-editor-landing.md, 9/11).
- **Lo capturado con «Capturar» todavía no guarda el diseño, y ya no hace falta para replicar**: la réplica se saca en la pestaña
  real cuando se pide, con la extensión. Guardar el HTML ajeno en un bucket privado (`lib/spy-pagina-capturada.ts`, la migración
  que pedía un número) sólo serviría para replicar SIN volver a abrir la página; queda anotado, no se hizo.

## El diagnóstico obvio era el equivocado

### Un anuncio en video se guardaba sin decir que lo era, y el arreglo había ido a la otra fuente (6/11/2026, tarde)

**Síntoma:** el explorador de Image mostraba videos en «Anuncios», que es una pantalla para copiar imágenes. El arreglo de
la mañana leyó el `displayFormat` del actor de Apify (`anuncioDeApify`, lib/spy-todo-reglas.ts) y dio por hecho que lo viejo
se iba a completar en la próxima lectura.

**Lo obvio era que el dato viene de Apify, y los 300 anuncios guardados no vinieron de ahí.** Medido contra producción: los
300 tienen `fuente: 'recorrido'`, o sea los leyó la EXTENSIÓN (`lib/spy-captura.ts`) desde el Chrome de Martín; por Apify no
entró ninguno. La extensión también lo decía, dos veces, y las dos se tiraban: `extension/spy-leer.js` manda un token
`['v', poster]` por cada `<video>` dibujado (acá se usaba sólo como miniatura de respaldo) y la Biblioteca escribe el reloj
del video sobre el creativo («0:15», «0:00 / 1:28»), que `RE_TIEMPO_DE_VIDEO` sacaba del copy sin anotar qué significaba.

**Lo que gobierna código nuevo:**
- `anuncioDe` devuelve `medio: 'video'` con cualquiera de las dos señales (`medioDeLaTarjeta`), y el token `'v'` se exige del
  CDN de Meta igual que la miniatura: lo que llega lo manda un navegador.
- **Nunca «imagen» por ausencia de señal de video:** una tarjeta cuyo `<video>` todavía no se dibujó muestra sólo su portada
  como imagen. Sin señal queda `null`, y quien lo muestra decide (lib/carruseles/anuncios.ts).
- **Antes de prometer «lo arregla la próxima lectura», contar por dónde entraron las filas que ya están (`fuente`) y cuántas
  siguen vivas.** Acá 279 de 300 ya tenían `dejo_de_verse_en`: un anuncio que bajó no vuelve en una lectura nueva.

⚠️ **Y la lectura cruda de Meta NO queda en ninguna parte.** `spy_lecturas_canal` (mig 0363) acepta el canal «anuncios» en
su `check`, pero **nadie escribe ahí**: `lib/spy-captura-db.ts` lo dice en su cabecera («lo leído de Meta es de quien lo
leyó», no se comparte entre negocios). Son 0 filas. Lo que la lectura no copió a `spy_piezas` se perdió, y un `check` que
permite un valor no es prueba de que alguien lo escriba.

El detalle (qué se midió campo por campo, y qué hace el explorador con un «no sé») está en
[hallazgos-carruseles.md](hallazgos-carruseles.md) → «El arreglo cubrió la fuente que NO trajo ni un anuncio».
### El país del competidor: la columna existía, nadie la escribía, y el único que preguntaba se tapaba solo (6/11/2026)

**Lo medido.** `spy_competidores.pais` está desde la migración 0359 con su comentario escrito («El país en que se lo
mira, en ISO-2. Decide si se le pueden prometer anuncios o no») y un `check` de dos letras. Barrido completo: cinco
lugares la leen (`lib/spy.ts:93` el tipo, `:164` el select, `lib/spy-reglas.ts:353`, `lib/spy-funnel.ts:399`,
`lib/api-mako/areas/spy.run.ts:218`) y **cero la escriben**. Llegaba `null` siempre, desde el día uno.

**La parte que no se ve.** `adLibraryCubreComercial` existe justamente para «que la pantalla prometa lo que hay en vez
de mostrar una lista vacía que parece *este competidor no pauta*». Y su ÚNICO llamador la tapa con un cortocircuito:

```
if (… && c.c.pais && !adLibraryCubreComercial(c.c.pais)) out.push(SIN_ANUNCIOS_EN_ESTE_PAIS);
```

Con `pais` null —o sea siempre— ese `&&` se come el aviso honesto. **Una guarda contra el dato ausente, puesta bien,
desactiva la función entera cuando el dato nunca llega.** Y no hay forma de notarlo leyendo el código del aviso: está
correcto. Hay que ir a ver quién escribe la columna. En `app/` `adLibraryCubreComercial` no tenía ni un llamador.

**Lo que costaba.** La Biblioteca de Meta sólo entrega anuncios comerciales de la UE y el Reino Unido (28 países);
fuera de ahí devuelve sólo política, con HTTP 200 y lista vacía. Para un competidor mexicano la ficha decía **«Sin
anuncios activos en Meta · lo miré el …»**, que es una afirmación sobre él, cuando el hecho es que nunca se pudo
mirar. Y el enlace a la Biblioteca iba con `country=ALL`.

**La regla que queda.** «Se miró y no había» y «nunca se pudo mirar» son **dos frases distintas**, y la segunda nombra
el país. Lo pregunta la ficha en «⋯ Más acciones» (un HECHO suyo, no una acción), no el alta —que es un campo y un
Enter— y **no se pide por su cuenta**: sin el dato se sigue diciendo lo de antes, nunca un «falta». `null` se puede
volver a poner («No lo sé»): un país equivocado hace más daño que ninguno.

**Dos trampas del entorno:**

- **Lo que se guarda en una columna ISO-2 se valida contra `PAISES` ANTES del `update`.** El `check` de la base no
  vuelve como «no válido»: vuelve como un error de Postgres en medio de la acción, con su texto en la pantalla.
- **Las banderas son IMÁGENES, no emoji** (`flagUrl`, lib/paises.ts): en Windows el emoji de bandera se dibuja como
  las dos letras, porque Segoe UI Emoji nunca las incluyó.

**Y un guard propio que se puso rojo contra código correcto.** `tests/spy-anuncios-apify.test.ts` caso 5 buscaba el
texto JSX literal `Sin anuncios activos en Meta · lo miré el {fechaCorta(…)}`. La frase sigue diciéndose, pero ahora
dentro de una plantilla (`${…}`), porque arriba hay un ternario: el guard medía la FORMA del JSX, no el hecho. Es la
tercera vez que pasa en esta tab: un guard de fuente afirma lo que el código HACE, y al cambiar la forma de alrededor
hay que releerlo, no relajarlo.
### «Spy mira sólo 50 por vez» eran TRES topes distintos, y el que sobraba cortaba datos ya bajados (6/11/2026)

**Lo medido.** `TOPES.piezasPorVuelta` (50, lib/spy-reglas.ts) tiene cuatro usos, y el barrido completo muestra que
**ninguno toca Meta**:

| Camino | Tope | Dónde | Qué cuesta subirlo |
|---|---|---|---|
| YouTube Data API | `piezasPorVuelta` | lib/spy-youtube.ts:386,390 · lib/spy.ts:769 | una llamada por página; y YA tiene su camino largo (`VIDEOS_POR_LECTURA_COMPLETA`) |
| Meta / Business Discovery | **`PIEZAS_A_LEER` = 25** | lib/instagram-perfil.ts:105 | la credencial, y un límite que Meta no acepte tira la consulta ENTERA |
| Apify | **`PIEZAS_DE_APIFY` = 100** | lib/instagram-perfil.ts:130 | nada: «el actor YA DEVUELVE todas las que trajo» |
| Lo que la persona CAPTURÓ en su navegador | `piezasPorVuelta` | lib/spy-captura-db.ts:79 | **nada: ya está bajado** |

**El que importaba era el cuarto, y no estaba en el pedido.** En «Guardar en Spy», los anuncios ya están dibujados en
la pestaña de la persona y el servidor los interpreta; cortar en 50 es **pérdida pura**, y encima silenciosa: el
desplegable decía «50 anuncios en la ficha de Ana» sin decir «de 213». La captura tiene su techo de verdad mucho más
arriba (`TOPE_TOKENS` = 20.000 tokens, ~2.800 anuncios).

**La regla que queda.** Un tope de «traer de afuera» y un tope de «quedarme con lo que ya tengo» **no pueden ser la
misma constante**: el primero tiene precio y el segundo no. Son dos campos de `TOPES`
(`piezasPorVuelta` / `piezasDeUnaCaptura`), cada uno con su comentario diciendo qué cuesta subirlo. Y si el segundo
igual corta, **se dice cuántos quedaron afuera** (`sinGuardar`), con la misma forma que ya tenía `otros` («N de otros
anunciantes no se guardaron»).

**Dos cosas que NO se tocaron, y por qué:**

- **Meta sigue en 25 y es un trámite, no código**: sin la credencial de Business Discovery no se puede medir, y en la
  Graph API un límite que no acepta no devuelve «no acepto»: falla la consulta entera.
- **YouTube sigue en 50 por vuelta a propósito**: el competidor que publica mucho ya está cubierto por la lectura
  completa (`VIDEOS_POR_LECTURA_COMPLETA`, el camino de «traer todo»). Subir la vuelta de rutina pagaría más llamadas
  en TODAS las lecturas para resolver un caso que ya tiene su camino.

**Y un dato del barrido:** el 50 **no tenía ni un test**. `grep piezasPorVuelta` sobre `tests/` daba cero: se podía
cambiar sin que nada se quejara, en las dos direcciones.
### La cola de caricaturas frenada: «falta un cron» era el diagnóstico equivocado (6/11/2026)

**El síntoma.** Si el Runner no genera —la causa conocida: su cuenta de Claude sin Canva conectado, que **no anota
ningún error**—, la pendiente espera, la tarjeta del competidor sigue diciendo «Haciendo su caricatura…» para siempre
y no hay nada en ninguna pantalla. `masVieja` tenía **un solo lector en todo el repo**:
`scripts/spy-caricaturas-pendientes.mjs`, que corre a mano.

**El diagnóstico obvio, y por qué era el equivocado.** «No hay cron ni pantalla que lea `masVieja`» lleva derecho a
un cron: `listarCola` recorre TODOS los negocios, así que hace falta la clave de servicio, unas `DepsTodos` nuevas del
lado del servidor (las de `lib/spy-caricatura-servidor.ts` son de UN negocio e ignoran su argumento `ws`), una ruta
`/api/cron/…` y una fila en `vercel.json` — **que una corrida no puede tocar desde un worktree** (la agrega quien
integra: `tests/cron-registrado.test.ts`). Es decir: el camino obvio no estaba disponible, y es cinco veces más
grande.

**Lo que ya estaba.** `masVieja` tiene dos mitades y se habían confundido: la de **todos** los negocios (la que
necesita el Runner, para elegir a quién le pide la próxima) y la de **este** negocio, que es la que una pantalla
necesita. Y la segunda ya estaba a mano: el registro vive en `app_settings` del negocio, y `listarCompetidores`
(lib/spy.ts) **ya lo lee en cada pedido** para decidir qué tarjeta dice «Haciendo su caricatura…». Faltaba quedarse
con la fecha, no con el booleano. Cero claves de servicio, cero crons, cero migraciones.

**La regla que queda.** Un número que no debería crecer se dibuja **donde vive la cosa que mide**, con el dato que ya
llega en el pedido, y **sólo para quien puede hacer algo con él**: el Runner es nuestro, así que `frenadaDesde` lo
manda el server sólo al super admin (en la página y en la ruta del refresco, las dos). A un cliente «la cola está
frenada» no le dice nada que pueda hacer, y su tarjeta ya muestra su foto sin cartel. El agregado por negocio es
`esperaMasVieja`; el de todos los negocios se queda donde estaba, en el Runner.

**El umbral tiene techo, y no es una opinión.** `COLA_FRENADA_MS` = 6 h, y tiene que quedar **por debajo de
`ESPERA_TRAS_FALLO_MS`** (24 h): pasada esa espera, una pendiente que falló deja de estar «pendiente» y la frase no
se diría nunca. El test lo fija con un `assert` sobre las dos constantes, no con un número escrito a mano.

**Y lo que no cuenta como «frenada»**, porque Canva sí contestó: la que falló y espera su reintento, la que se
rindió a los tres fallos, la que ya está, un referente dibujado y una foto que no es nuestra. Una cola «frenada» es
sólo la que **nadie tocó**.

**Sin hacer:** la vista de TODOS los negocios juntos sigue siendo del Runner (un comando). Si alguna vez se quiere en
el tablero del super admin, ahí sí hace falta la clave de servicio y la fila de `vercel.json`.
### El acortador se resolvía a su propia página de «link expirado», y nadie lo habría visto (6/11/2026)

**Lo que se medía.** El 4/11 quedó pedido «correr los dos curl de `linktw.in/pywydg` desde la PC» con tres
hipótesis: redirige por HTTP, redirige por JavaScript, o es una página de «continuar» con botón. Se corrió.
**Las tres estaban equivocadas, y la respuesta era peor que cualquiera de ellas.**

**Lo medido** (`curl`, 6/11/2026, 71.859 B):

- HTTP **200**, cero redirecciones, sin cabecera `Location` (cabecera propia: `X-Short-Link: true`).
- **Ninguna** etiqueta `<meta http-equiv="refresh">`.
- 140 caracteres de texto a la vista: «Redirecting… · Open in YouTube · Open in app · Open in browser».
- Su JS se manda a **diez** lugares distintos: la app de Android, la de iOS, TikTok, X, Chrome por
  `googlechrome://navigate?url=`, y el destino calculado — todos a través de una **variable**.
- El destino de verdad (`https://youtu.be/99n0XhdDq0Y`) está **sólo en el `href` de un botón**.

**La falla.** `redireccionDelCliente` (lib/pagina-real.ts) se queda con el primer `location` que tenga la
dirección **escrita a la vista**, y en un acortador de verdad la única escrita así es su **rama de error**:
`location.replace('/expired')`. Resultado medido: devolvía **`https://linktw.in/expired`** y la pantalla
mostraba esa página —«link expirado»— como si fuera la del competidor, con `estado: 'abierta'` y el marco
verificado. El cliente toca la página del competidor y llega a un cartel de link vencido.

**Por qué no se iba a ver nunca.** No hay error, ni log, ni vacío: hay una página que carga bien y dice algo
razonable. La prueba que existía usaba HTML inventado con **un solo** `location.href = "https://…"`, que es
justo la forma que un acortador real no tiene. Un acortador de verdad no escribe su destino: lo calcula.

**La regla que queda.** **Una página que puede mandar a más de un lado no se sigue a ninguno.** Si en su JS hay
más de una asignación a `location`, no se sabe cuál corre, y acá «no sé» se dibuja «Abrir», nunca un destino
inventado. Y la otra mitad: `soloRedirige(html)` dice «esto es un acortador o un “continuar en…”, no la página
que se quería ver» — la ruta lo deja en «Abrir» en vez de mostrar su «Redirecting…» adentro del marco.
`tests/spy-paginas-verificadas.test.ts` caso 7 lo vigila con la FORMA medida (diez asignaciones, una sola
escrita, y ésa es `/expired`): sacar el corte devuelve literalmente `https://linktw.in/expired`.

**Sin hacer:** el destino de verdad está en el `href` de «Open in browser». Leerlo es otra cosa que seguir una
redirección —un `href` de una página ajena puede ser cualquier cosa— y hoy no se hace: queda «Abrir».

### Cablear lo capturado a su oferta no alcanzaba: la espera del fallo lo dejaba invisible 24 horas (6/11/2026)

**El pedido** era chico: una página que la extensión ya capturó tiene que alimentar la lectura de su oferta, porque
una web con barrera (el «comprueba que eres una persona» de Cloudflare en el Beacons de Den Borg) no se baja desde el
servidor y Offer se quedaba sin leerla. El cambio obvio es un plan B en `leerSuOferta` (lib/spy-oferta.ts). **Y con
eso solo, la función anda y la pantalla sigue sin mostrar nada.**

**Por qué.** Cuando la bajada falla, la oferta queda en `no-pudo` con `fallos: 1`, y `hayQueLeer` no la vuelve a
mirar hasta `ESPERA_TRAS_FALLO_MS` — **24 horas**, y una semana entera con tres fallos (`FALLOS_HASTA_ESPERAR`). El
recorrido real es: la persona abre al competidor, lee «No pude leer su web.», **va y la captura** con la extensión,
vuelve a abrirlo… y ve lo mismo. Hoy, mañana y —con tres fallos encima— los siete días siguientes. La espera está
bien pensada para lo que la puso (no reintentar en cadena contra una web que no contesta), y es exactamente lo
contrario de lo que hace falta cuando aparece **información nueva**.

**La regla que queda.** Una fuente nueva para algo que ya falló **le borra la espera a ese algo**. Acá:
`sinEspera()` (lib/spy-oferta.ts) devuelve lo guardado con `fallos: 0` y `desde` en la época, y
`reintentarOfertaYa()` (lib/spy-oferta-servidor.ts) lo escribe con compare-and-set; lo llama
`guardarPaginaCapturada` **después** de guardar la página. Si lo último SALIÓ bien, no toca nada: no se vuelve a
pagar la IA por una lectura que ya está.

**Y la trampa de imports, que es un ciclo.** El camino natural —importar `paginasCapturadas` de
`lib/spy-pagina-capturada-servidor.ts`— **cierra un ciclo**: ese archivo ya importa `ofertaGuardada` de
`lib/spy-oferta-servidor.ts`. Se lee del módulo **puro** (`lib/spy-pagina-capturada.ts`:
`claveDePaginasCapturadas` + `leerPaginasCapturadas` + `capturaDe`) con el `getSettingEstricto` que ese archivo ya
tenía: dos líneas y ningún ciclo. `tests/spy-oferta.test.ts` caso 8 lo fija con un `doesNotMatch` sobre el import
del `-servidor`, porque el ciclo no da error: rompe al inicializar, y sólo en algunos órdenes de carga.

**Dos cosas más, medidas:**

- **La bajada del servidor le GANA a la capturada**, no al revés: una captura es de cuando se capturó y lo que el
  servidor puede bajar hoy está más fresco. La capturada entra sólo si la bajada falló o trajo menos de `MIN_TEXTO`.
- **Una página guardada por su FOTO no alimenta la oferta, y es correcto**: `juzgarCaptura` acepta una captura con
  poco texto si trae foto, y `MIN_TEXTO` (200) la rechaza después. No es un error — una foto no es una oferta — pero
  es silencioso: en la pantalla la página está guardada y su oferta sigue diciendo que no la pudo leer.

**Sin hacer:** cambiar de fuente cambia `huellaDe`, así que el primer competidor que se lea de lo capturado **vuelve
a pagar la IA una vez** (es el mismo precio que una web que cambió). Y el desafío de un antibots **no se evade**: se
usa lo que la persona ya miró en su navegador.

### Los 19 formatos: lo que faltaba era una MARCA, no una repasada (6/11/2026)

**El pendiente decía** «falta decidir y correr una repasada» de todo lo ya analizado con los 11 formatos viejos. Medido
contra el código, la repasada no hacía falta y era lo caro:

- **Los 19 ids son un SUPERCONJUNTO de los 11.** Lo medido (`git show` del commit de los formatos): los viejos eran
  `pov, storytime, antes-despues, tutorial, lista, opinion, resena, testimonio, detras, entrevista, otro`, y los ocho
  que entraron son `caso-de-exito, mito, recap-evento, preguntas, reaccion, tendencia, frase, promo`. **Ningún valor
  guardado quedó inválido**, así que no hay nada que migrar en `spy_piezas.analisis`: un `tutorial` de entonces sigue
  siendo un `tutorial`, y releerlo lo paga el negocio para no cambiar nada.
- **Lo que SÍ quedó mal es lo que cayó en `otro`**, porque el formato que de verdad era podía no existir cuando se lo
  leyó. Esas son las piezas que dejaron «¿Qué formatos le funcionan?» más vacío de lo que corresponde.
- **Y «los formatos nuevos no se usan al analizar» ya estaba HECHO**: el prompt recibe los 19 con su definición
  (`{{formatosQueSon}}` ← `GUIA_DE_FORMATOS`), con su test. El pendiente de la lista era un fantasma.

**Por qué no se arreglaba solo.** `faltaAnalisis` relee una vez lo que no tiene la CLAVE `formato` (lo de antes del
4/11), y un `otro` ya la tiene: pasaba el filtro y no se volvía a leer nunca. Los dos criterios convivían sin que nada
lo avisara, que es justo lo que decía el pendiente.

**La regla que queda.** Un análisis que la IA hizo **lleva escrito con qué catálogo lo hizo** (`analisis.formatosV`,
`VERSION_FORMATOS` en lib/spy-detalle.ts), y lo que se marcó con un catálogo más chico **y quedó en el cajón de sastre**
se relee UNA vez. Sin esa marca no hay forma de distinguir un `otro` de hoy de un `otro` de los 11 viejos, y cualquier
intento de arreglarlo o relee todo (caro) o no relee nada (el estado anterior).

**Dos cortes que la marca hace posibles, y que importan porque la IA es del NEGOCIO:**

- Se relee **sólo** lo que quedó en `otro`, no todo lo viejo.
- Es **una** vez: `ANALISIS_SIN_DATOS` —lo que se guarda de una pieza que la IA no devolvió— también lleva la marca. Sin
  eso, esa pieza pediría lectura para siempre, que es exactamente la trampa que el comentario de `faltaAnalisis` ya
  avisaba para el caso anterior.

**Sin hacer, y es un agujero silencioso:** el system prompt pasa por `renderPrompt('spy.analisis.system', …)`, así que un
negocio que **guardó su propio prompt antes del 4/11** sigue con su texto, que no tiene el hueco `{{formatosQueSon}}`:
su IA recibe los 19 ids **sin saber qué es cada uno**. El test de los formatos mira la plantilla por defecto, no los
prompts guardados. Vive en `lib/prompt-registry.ts` (la ranura declarada) y en `lib/spy.ts` (el `renderPrompt`).
### Lo que de Spy NO es código, y el número de migración del relevo ya está tomado (6/11/2026)

**El número de migración del relevo está vencido.** `docs/relevo/nube-spy.md` dice «hace falta un bucket privado, o sea
una migración: **pido el número**» y los encargos repiten «el número libre es 0410». Medido el 6/11 en disco:
**0410 y 0411 ya existen** (`0410_correo_bajas.sql`, `0411_carruseles_revisada.sql`). Es la segunda vez que pasa en
esta tab —el 31/10 el relevo decía 0306 y en disco el más alto era 0357—, así que vale como regla y no como anécdota:
**el número de la próxima migración no se lee de un relevo ni de un pendiente**; se barre el disco de todos los
worktrees y, con coordinador, se le pide a él (AGENTS.md → «El próximo número de migración es un recurso COMPARTIDO»).

**Y lo de Spy que no se destraba escribiendo código**, con lo que lo destraba y dónde vive. Trece de los treinta y tres
encargos del 6/11 son éstos: no tiene sentido volver a triarlos.

| Qué | Qué lo destraba | Dónde vive |
|---|---|---|
| El guion de un video de YouTube (7 pruebas, 503) y su costo por minuto | la IA del negocio contra el servicio real, y una decisión de Martín: ¿un negocio SIN su Gemini transcribe con la clave de la plataforma? Hoy AGENTS lo prohíbe | `lib/spy-transcripcion-servidor.ts` (`tramoDeYoutube`) |
| La primera lectura real de anuncios por Apify (¿trae `pageID`?) | una clave de Apify con crédito, desde la PC: la nube no llega a Apify | `scripts/probar-anuncios-apify.mjs` · `lib/spy-todo-reglas.ts` |
| El competidor 13 del ws 11 con 12 piezas, y el YouTube de Leila | la base de producción desde la PC (son 6 consultas de LECTURA, ya escritas) | `docs/relevo/nube-spy.md:99-107` y `:191-208` |
| ¿Compartir las lecturas ahorra algo? | leer `spy_lecturas_canal.ahorros` en producción | `lib/spy-compartido-db.ts` (`anotarAhorro`) |
| La cola de caricaturas contra la base real | el Runner en la PC, con Canva conectado en su cuenta de Claude | `scripts/spy-caricaturas-pendientes.mjs` y `spy-caricatura-guardar.mjs` |
| Que el fin de crédito de Apify diga lo que se supuso | una corrida real que se quede sin crédito | `lib/spy-todo-reglas.ts` (`esFaltaDeCredito`) |
| «Capturar» en un Chrome de verdad, y publicar la extensión | la tienda de Chrome (es un trámite de Martín) y una persona que pase la barrera | `public/mako-puente-0.77.0.zip` · `extension/spy-pagina.js` |
| Media docena de pantallas con un competidor real, y cuánto tarda la ficha | mirar producción con Den Borg: la vista de prueba no tiene el CDN de Meta | `app/competitor-spy/` |
| «Sugeridos», la oferta de un competidor y el guion de un reel, con un negocio real | un negocio con su IA y su Apify | `/api/competitor-spy/oferta` · `lib/spy-transcripcion-servidor.ts` |
| Guardar el diseño de «Copiar su sitio» | un bucket PRIVADO: una migración (número por pedir) y cambiar el lado que lee, porque hoy todo asume una URL pública | `lib/spy-miniaturas.ts` · `supabase/migrations/0361_spy_miniaturas_guardadas.sql` |
| Las 50 piezas por vuelta de Meta | la credencial de Business Discovery: un límite que la Graph API no acepta tira la consulta ENTERA, y sin credencial no se mide | `lib/instagram-perfil.ts` (`PIEZAS_A_LEER`) |

**El código de todos está escrito** (lo verifiqué uno por uno: `tramoDeYoutube`, `ver_sugeridos`/`sumar_sugerido`,
`bloqueOfertaDeOtro`, `ANUNCIOS_POR_APIFY = true`, el cron `spy-todo` en `vercel.json:236`, los dos scripts del
Runner). Lo único que falta es correrlos donde se puede.

**Y un pendiente FANTASMA menos:** «los formatos nuevos del catálogo en el análisis de piezas» ya estaba hecho — el
prompt recibe los 19 con su definición (`{{formatosQueSon}}` ← `GUIA_DE_FORMATOS`, `lib/spy.ts`), con su test. Lo que
faltaba de verdad era otra cosa, y está arriba en «Los 19 formatos».
### Juntar repetidos: la rama de los nombres de varias palabras estaba MUERTA, y lo dijo la rotura (6/11/2026)

**El cambio** era ofrecer «Juntarlos» para las cargas repetidas de la misma persona, mudando las piezas en vez de
borrar una (borrar se las lleva por `on delete cascade` y no se deshace).

**Lo que encontró el probar rompiéndolo.** `mismoNombre` tenía dos ramas: una palabra metida en el otro nombre
(«hormozi» ⊂ «@AlexHormozi») y varias palabras que tienen que estar TODAS («Sofia Contreras» ⊂ «Sofia Contreras
Coach»). Cambiar el `every` de la segunda por un `some` —el bug clásico, que haría emparejar «Marcos Pérez» con «Ana
Pérez»— **no ponía NADA en rojo**. La rama no se ejecutaba nunca: las palabras se contaban sobre el nombre ya pasado
por `nombreComparable`, **que saca los espacios**, así que «Ana Pérez» era UNA palabra («anaperez») y el `if` de
«varias» era inalcanzable. Se cuenta sobre el nombre crudo y la rotura ya cae.

**La regla que queda.** Un test que no cae al romper lo que vigila no vale, **y «no cae» puede querer decir que el
código que vigila no corre**. Es el caso contrario al de un guard que mide la forma equivocada: acá el guard estaba
bien y el código estaba muerto. Hay que romper CADA rama, no el caso de más arriba.

**Dos cosas más que el pedido fijó y conviene no redescubrir:**

- **Un DOMINIO no se empareja con una persona**, a propósito: «acquisition.com» y «@AlexHormozi» pueden ser lo mismo o
  pueden ser su empresa y él. En el código no existe ninguna comparación nombre-contra-dominio, así que la aserción
  que lo dice **documenta la decisión, no la vigila**: ningún cambio de una línea la pone en rojo. Está para que no se
  agregue.
- **Quién queda lo decide la cantidad de PIEZAS, nunca el nombre.** «sofiacontreras» puede ser la fila con 200 piezas
  leídas: el nombre se arregla, las piezas no se recuperan. Después empatan por cuentas conocidas, por última mirada y
  por id (el que se cargó primero, que es el que el cliente tiene enlazado).

**El orden en el servidor NO es cosmético** (lib/spy-juntar.ts): mudar y DESPUÉS borrar. `spy_piezas` tiene
`on delete cascade`, así que borrar primero se lleva todo lo leído de esa persona sin vuelta atrás; si la mudanza se
corta, no se borra nada y quedan los dos repetidos, que es el estado de antes. Y las piezas que el que queda YA tiene
no se pueden mudar: la tabla es única por (negocio, competidor, canal, ref) y la mudanza entera se caería — se van con
la copia, que es la misma pieza leída dos veces.

**Sin hacer:** la oferta leída, los guiones y las páginas capturadas del que se va se van con él. Sale gratis porque
al completarse con su web el que queda tiene una web nueva y `hayQueLeer` lee su oferta sola al abrir su ficha; pero
los guiones de sus reels se vuelven a pedir (una lectura de Apify por reel que se abra). Y los pares se ofrecen de a
UNO: con tres cargas de la misma persona, la tercera aparece después de juntar las dos primeras.

### Un emoji en el nombre tiraba la pantalla de Spy, y lo encontramos buscando OTRA cosa (6/11/2026)

**Cómo apareció.** Buscando la causa del ticket #39 («la pantalla CRM se rompió», React #418, ws 15).
El CRM resultó estar limpio —todas sus iniciales ya salen de `iniciales()`— pero el mismo bug estaba
vivo en **los tres lugares de Spy**: `SpyApp.tsx` (`const inicial`), `BuscadorAlta.tsx` (ídem) y
`DetallePieza.tsx` (`nombre.slice(0, 1)`).

**Por qué en Spy es peor que en cualquier otra tab:** los nombres los trae **Instagram**, donde el
emoji en el nombre es la norma, no la excepción. «🔥 Alex Hormozi» es un nombre de perfil normal.

**La falla.** `charAt(0)` y `slice(0, 1)` toman la primera **unidad UTF-16**, no el primer carácter:
de un emoji, media pieza. El HTML del server no puede llevar media pieza (sale «�»), el navegador sí
la tiene, y React ve dos textos distintos al hidratar y **tira el árbol entero**: no se rompe el
avatar, se cae la pantalla. Ya había pasado dos veces, en `/calendario` (ticket #10, 27/10) y en el
CRM (ticket #39, 1/11).

⚠️ **Por qué sobrevivió a DOS barridos.** La guarda de toda la app
(`tests/iniciales-con-emoji.test.ts`) buscaba las formas de **muchas** palabras —`split(/\s+/)` con
`.map((w) => w[0])`, `${p[0][0]}${p[1][0]}`—. Una inicial de **UNA letra** no tiene ninguna de esas
formas, así que pasaba limpia. **La guarda medía la forma del código viejo, no la falla.** Ahora el
caso 3 del mismo test marca cualquier `charAt(0)` / `slice(0, 1)` / `[0]` seguido de `toUpperCase()`
que **tire el resto** (la línea que conserva el resto con `slice(1)` es poner la mayúscula, y no corta
nada: ésa no se marca).

⚠️ **Y un falso positivo que vale saber:** `app/admin/_polar/orbit/components/Avatar.tsx` usa
`charAt(0)` y **no** es un bug, porque antes limpia todo lo que no sea `[a-zA-Z ]`: el emoji ya no
está cuando indexa. Los ports de código ajeno (`_opencut`, `_doory`, `_polar`) quedan afuera de la
guarda por eso.

**Lo que NO se pudo cerrar: el ticket #39 no se reprodujo.** Medido en `errores_app` (producción):
pasó **una sola vez**, el 1/11 11:35, en `/crm?funnel=17` del negocio 15, y **no volvió en cinco días**
de uso diario. Su mensaje es `args[]=HTML` (la estructura no coincide), no `args[]=text` como el del
emoji y como el de `/plan` (ticket #52, ws 11, 3 veces, ya resuelto en `30af8f732`: el plazo de la
tarjeta se calculaba en el server). Con una sola aparición y sin forma de reproducirlo, **no se tocó
el CRM a ciegas**: se arregló la clase donde sí estaba viva y se dejó la guarda que la caza en
cualquier pantalla nueva.

### `ad_type=ALL` de la Ad Library no significa «todos los anuncios»

El enum de `ad_type` es **temático** (`ALL, EMPLOYMENT_ADS, FINANCIAL_PRODUCTS_AND_SERVICES_ADS,
HOUSING_ADS, POLITICAL_AND_ISSUE_ADS`); la cobertura **geográfica** es un filtro aparte y fijo que no se
puede cambiar. Fuera de la UE y el Reino Unido, la API devuelve **sólo anuncios de política y temas
sociales** — y para un competidor comercial argentino devuelve **una lista vacía con HTTP 200**, no un
error. Textual en `facebook.com/ads/library/api/`, en la nota de `ad_reached_countries`: *«Ads that did
not reach any location in the EU will only return if they are about social issues, elections or
politics»*.

**Es la trampa que hace construir media tab antes de descubrirlo.** Y la web pública de la Biblioteca
replica exactamente la misma asimetría (verificado deslogueado el 31/10: el detalle de un anuncio de
Argentina no tiene gasto ni alcance; el mismo tipo de anuncio en España trae la sección «Transparency
by location → European Union»). **No hay atajo por la UI.**

**Regla:** antes de prometer datos de anuncios de un país, probar `ads_archive` con ESE país y
`ad_type=ALL`. Si vuelve vacío, no es un bug.

### `search.list` de YouTube ya no cuesta 100 unidades: tiene balde propio de 100 LLAMADAS/día

Cambio del **1/6/2026** (`developers.google.com/youtube/v3/revision_history`), hoy en
`/determine_quota_cost`: *«a default quota allocation of 100 search.list calls, 100 videos.insert calls,
and 10,000 units per day combined for all other endpoints»*. **El costo por llamada bajó a 1, pero el
tope es de 100 llamadas por día para TODA la app**, no por usuario ni por workspace.

Todo tutorial, todo blog y toda memoria de modelo anteriores a junio de 2026 dicen «search.list cuesta
100 de 10.000» — y de ahí se deduce «100 búsquedas por día, me alcanza». **La cuenta da lo mismo y la
conclusión es otra:** con el sistema viejo las búsquedas competían con el resto y se podían priorizar;
con el nuevo el tope es duro y no se amplía gastando menos en otra cosa. **Cualquier feature con forma
de buscador está muerta a escala.**

**Regla:** el camino es `channels.list` → `contentDetails.relatedPlaylists.uploads` →
`playlistItems.list` → `videos.list` en lotes de 50 (≈0,04 unidades por video hidratado, ~250.000
videos/día de techo). El playlist de subidas **se lee de la API**, no se deriva cambiando `UC`→`UU`.

### `tags` de un video ajeno SÍ vienen — pero sólo por `videos.list`

El síntoma es «la API no devuelve las etiquetas de videos de otros canales», y la causa es el
**endpoint**: `search.list` nunca trae `snippet.tags`; `videos.list?part=snippet` sí. La única
deprecación de `tags` del revision history (12/5/2021) es la de **playlists**, no la de videos, y es la
fuente de la confusión. Verificado además en vivo: los tags de un video de otro canal están públicos en
el `<meta name="keywords">` de la propia página de YouTube.

**Regla:** si los tags vienen vacíos, mirar de qué endpoint salió el video antes de concluir que la API
no los da.

### Derivar «vistas por hora» está prohibido por DEFECTO, y la solución no es técnica

Developer Policies **III.E.4.h**: *«Your API Clients must not… access or use API Data to create new or
derived data or metrics»*, y nombra el caso: *«a score that factors in likes, total views, or any other
API Data»*. O sea: **el VPH, el score de SEO y el ranking de competidores — el producto entero de
vidIQ — están explícitamente prohibidos.** Y **III.E.4.b** pone el tope: los datos de un tercero son
*«Non-Authorized Data»* y **no se guardan más de 30 días**.

**Nadie busca la solución donde está:** no es una excepción técnica, es la política **III.L**, nueva
desde el **1/6/2026** (`developers.google.com/youtube/terms/derived-metrics-policy`), que se habilita
aceptando la enmienda **«Section 5: Use Cases → Analytics & Reporting»** dentro del pedido de
ampliación de cuota. Con ella quedan permitidos, textualmente, los scores propios, los leaderboards de
*«Top YouTuber by View Growth»*, las curvas de 36 meses, el análisis de sentimiento y la estimación de
ingresos (con leyenda prominente de que es estimación de un tercero).

**Regla:** la enmienda se acepta **antes** de escribir el primer snapshot. Sin ella, la sanción
declarada es *«quota reduction or termination of your API access»*, y esa key es la misma que usa
`lib/youtube.ts` en producción.

### El scraping de Instagram sin login viola los ToS igual que con login — **y tampoco da el dato**

Terms of Use de Instagram, **§4.2** (`help.instagram.com/581066165581870`): prohíbe recolectar
información *«in an automated way without our express permission, **regardless of whether such automated
access or collection is undertaken while logged-in to an Instagram account**»*. El argumento «pero es
público sin login» no existe. Y en la misma sección: *«You can't sell, license, or purchase any account
or data obtained from us»* — **comprar datos raspados también está cubierto**.

Y lo útil, medido el 31/10 en un perfil público sin sesión: se ven nombre, bio, seguidores y los
**primeros ~12 posts**, y **no se ve ni un like ni una vista**, ni en la grilla ni en el post
individual. El muro de login cae en el primer «Show more posts» — no son «unos scrolls». **El camino
ilegal tampoco funciona:** `business_discovery` es a la vez el único legal y el más completo (da
`like_count` y el `view_count` de reels, que la página pública no muestra).

### GitHub miente sobre la licencia, y el buscador no encuentra el repo bueno

- **`NOASSERTION` no significa nada.** `subzeroid/instagrapi` y `thp/urlwatch` figuran así y sus
  `LICENSE` son **MIT** y **BSD-3-Clause**; `facebookresearch/Ad-Library-API-Script-Repository` figura
  igual y ahí sí es una **licencia propietaria de Meta** que ata el uso a sus APIs. Hay que abrir el
  archivo y leerlo.
- **Lo que rankea primero en Google no es lo que sirve.** Buscando «ad spy open source» sube
  `nimrodyar/AdsLab`: 0 stars, sin descripción y **sin licencia**. El candidato bueno
  (`athm793/meta-ads-scraper`, Apache-2.0, Next.js 16) **no aparece en ninguna búsqueda web**: se
  encuentra entrando a `github.com/topics/ad-library`. **Las páginas de topics de GitHub rankean los
  repos de nicho mejor que cualquier buscador.**
- **Los directorios de alternativas (AlternativeTo, SaaSHub) no sirven para licencias:** no detectaron
  ni una de las cuatro AGPL-3.0 del relevamiento.
- **Y stars altas no son señal de calidad en la familia Instagram:** la búsqueda por stars devuelve
  malware mezclado con herramientas legítimas (un ladrón de cookies con 446★, uno que promete ver posts
  privados con 1.105★). Leer la descripción antes de abrir el repo.

---

## Topes y vacíos del entorno que no dan error

| Fuente | Qué hace en vez de fallar |
|---|---|
| **`ads_archive` con un país no-UE** | HTTP 200 con lista vacía. No dice «esta fuente no cubre tu país». |
| **`spend` e `impressions` de la Ad Library** | **Devuelve tramos de TEXTO** (`<100`, `1K-5K`, `>1M`), no números. Un parser que espera `number` recibe un string y, si lo coacciona, produce `NaN` o un 1 — un número inventado. Y la doc de Meta **se saltea el tramo 500K–1M**. |
| **`instagram_business_account` en la Graph API** | Si la página no tiene un Instagram vinculado, Meta **omite el campo**. No da error. Ya medido en casa el 22/10 y escrito en `lib/instagram-perfil.ts`: así se descubrió que el token de la plataforma (ws9) no tiene **ningún** permiso de Instagram y la página «Hola MaKo» no tiene Instagram. |
| **Contadores de Instagram ocultos por el dueño** | El dueño puede ocultar likes, comentarios, vistas, reposts y compartidos **uno por uno**, y entonces **el campo no viene**. Un `?? 0` muestra «0 likes» sobre un post con miles. **Todos nullable de verdad.** |
| **`dislikeCount` de YouTube** | Privado desde el 13/12/2021: **no devuelve 0, no devuelve el campo.** Mismo `?? 0`, mismo dato inventado. |
| **`viewCount` de YouTube** | **Cambió de definición el 24/8/2026**: cuenta la vista en el momento en que el video empieza a reproducirse. Toda serie histórica que cruce esa fecha tiene un **salto artificial** que se lee como un despegue. Hay que marcar el corte en el gráfico. |
| **`media_url` de Instagram** | Se **omite** en videos con audio con copyright o reels con descargas desactivadas. La doc de Meta dice textual que hay que tratarlo como opcional y caer a `permalink` o `thumbnail_url`. |
| **`profile_picture_url` de Instagram** | Es una URL del CDN de Meta que **vence**. Sirve para dibujar una lista, **nunca para guardar**: persistirla produce avatares rotos semanas después. Ya está escrito en `lib/instagram-perfil.ts`. |
| **Paginación del edge `/media`** | Trae cursores `before`/`after` pero **sin** campos `next`/`previous`: las query strings se arman a mano. Y **no soporta ordenar**. |
| **`captions.download` sobre un video ajeno** | `forbidden`: *«requires the user to have permission to edit the video»*. `captions.list` (50 unidades) sólo dice que las pistas existen. **No hay vía legal para transcribir el video de un competidor.** |
| **Rate limits de `ads_archive`** | **Meta no los publica.** Las cifras de «200 llamadas/hora» que circulan en blogs de vendors **no están en la doc**. Existe el error `613` documentado y el límite genérico de plataforma. No tratarlo como medido. |
| **Ampliar la cuota de YouTube** | No es un formulario: exige un **API Compliance Audit** con el caso de uso declarado. |

---

## Lo que gobierna código nuevo

1. **Son DOS permisos, no uno.** La **licencia** (copyright) habilita a copiar el código; los **términos
   del proveedor** (contrato) habilitan a usar el dato. MIT no autoriza a raspar Meta. Está en
   AGENTS.md porque es la confusión que hace que alguien integre un scraper «porque la licencia es MIT».
2. **Dos retenciones distintas en la misma tabla, separadas desde la primera migración.** YouTube: las
   **métricas** (views, likes, subs, comments y sus snapshots) hasta **36 meses** con la enmienda III.L;
   **títulos, descripciones, nombres de creadores y texto de comentarios, 30 días siempre** — se
   refrescan o se borran. Si nacen en la misma columna, después es una migración.
3. **Un contador ausente no es cero.** Vale para Instagram y para YouTube, y es la misma distinción que
   este repo ya pagó cara con el 0% de retención. `landing-vigilancia.ts` lo tiene escrito en su
   cabecera: *una lectura que falló es «NO SÉ», jamás «lo sacaron»*.
4. **Un rango se dice rango.** Nunca un tramo (`1K-5K`) convertido en un punto de un eje.
5. **Nada de «vs» ni de duelos en la UI.** La política III.L prohíbe explícitamente enmarcar una
   comparación como *«war»*, *«battle»* o una rivalidad que incite hostigamiento. La tab se llama Spy;
   la pantalla mira el mercado, no ataca a una persona.
6. **Ni cara, ni nombre, ni @ de un gurú real en la galería pública** (decisión de Martín, 29/10).
   Arquetipos de estilo. Dentro del análisis privado de un negocio, el competidor que *ese* negocio
   eligió sí se ve como fuente.

---

---

## Lo que se aprendió CONSTRUYENDO la Etapa 1 (31/10, después del relevamiento)

Lo de arriba se midió **antes** de escribir código, leyendo las APIs. Lo de acá apareció **al
escribirlo**, y ninguna se deduce leyendo el código que quedó.

### Un vocabulario que tiene que compartirse no puede vivir en un módulo con `server-only`

El plan decía «los vocabularios de ángulo y gancho se comparten en vez de duplicarse», y eso era
**imposible de cumplir**: `HOOK_TYPES`, `BEAT_KINDS`, `TAG_VOCAB` y `ANGLES` vivían dentro de
`lib/ads-analyst.ts`, que lleva `import 'server-only'` porque llama a Claude. Y una definición de
área de la API (`lib/api-mako/areas/*.def.ts`) **no puede importar un VALOR de un módulo con
`server-only`** — lo exige `tests/api-mako-registro.test.ts`, que sigue los imports transitivamente.

El síntoma no es un error claro: es que la salida barata (copiar la lista) funciona perfecto y deja
**dos vocabularios que se separan solos**. Y cuando se separan, «lo que hace la competencia» y «lo
que hacemos nosotros» dejan de ser comparables, que es justo para lo que sirve la tab.

**Regla:** una lista con la que más de un lugar tiene que estar de acuerdo va en un módulo PURO, sin
`server-only` y sin imports. Las cuatro se mudaron a `lib/ads-analyst-vocabulario.ts`, y
`lib/ads-analyst.ts` las vuelve a exportar, así que ningún importador de antes cambió.

### Dos guards propios se pusieron ROJOS contra código correcto, los dos por buscar una palabra

Las dos veces el guard encontraba **su propia explicación**:

- el que mira que la migración no tenga columna para la foto leía el `.sql` con el stripper de
  comentarios de **TypeScript**, que saca `//` y los bloques y **no saca los `--` de un `.sql`**:
  encontraba la frase «sin `no_megusta`, que YouTube no devuelve» de la propia cabecera;
- el que mira que no se use `search.list` buscaba ese texto, y encontraba la constante
  `ENDPOINT_PROHIBIDO = 'search.list'` que lo documentaba, en el mismo archivo.

**Regla:** un guard que lee fuente afirma **lo que el código HACE** —las columnas declaradas, las
rutas que se llaman— y no si alguien escribió una palabra. El de las rutas quedó enumerando lo que
pasa por `traer()` y comparándolo contra `RUTAS_PERMITIDAS`; el de la migración, con un stripper de
`--`. Es la misma clase de error que «una verificación equivocada sale más cara que no verificar»:
los dos marcaban de más, y los dos mandaban a arreglar algo que estaba bien.

### El número de la próxima migración NO se lee del relevo: está 51 números atrasado

`docs/relevo/nube.md` dice «la próxima libre es la **0306**» y en disco el número más alto es el
**0357** (348 archivos). Y hay huecos —0304, 0315, 0329, 0344, 0345, 0346, 0351, 0355— que **no se
rellenan**: el repo ya tiene colisiones históricas (0024, 0025, 0039, 0060, 0061, 0069 duplicados) y
sumar otra cuesta más que saltearse un número.

**Regla:** el número sale de listar el directorio y mirar el más alto, nunca de un documento. Un
documento con un número adentro envejece el día que alguien más pushea.

### Ampliar un juego de campos de la Graph API no es aditivo: UN campo desconocido tira la consulta ENTERA

El plan pedía «ampliar `CAMPOS_PERFIL`» con siete campos (`like_count`, `view_count`, …). Hacerlo
literalmente **apuesta la lectura de @ que ya está en producción** (Offer y el alta de un lead) a que
los siete existen en la versión de Graph de cada cliente: en la Graph API, un campo que Meta no
reconoce devuelve un **400 para toda la consulta** («Tried accessing nonexisting field»), no una
respuesta sin ese campo.

Y **no se puede medir desde la nube**: Business Discovery no tiene credencial desde el 22/10 (el
token de la plataforma no tiene ningún permiso de Instagram), pero **1 de las 11 conexiones de
clientes —la de ws11— sí la tiene y hoy le funciona**. O sea que el riesgo no es teórico y la
comprobación no está disponible.

**Lo que se hizo, y la regla:** el juego ancho quedó en una constante aparte
(`CAMPOS_PERFIL_PIEZAS`), y quien la pide se banca el fallo —`leerPerfilInstagram({ conPiezas: true })`
reintenta UNA vez con el juego de siempre si Meta rechaza un campo—, así que la ficha degrada a «sin
números» en vez de quedarse sin perfil. **Un juego de campos que ya está en producción crece detrás
de un fallback, no en el lugar.** El día que alguien lo confirme con una credencial de verdad, las
dos constantes se pueden unir, y ese día se anota acá.

⚠️ Y `conPiezas` **entra en la clave de la caché** de `leerPerfilInstagram`. Sin eso, una lectura
angosta de hace un rato le contesta a la tab sin los números, y la ficha diría «no publica sus me
gusta» sobre una cuenta que sí los publica: un dato inventado por una caché.

### «No pude leer la landing» ya está resuelto en casa, y el campo que lo dice no es la lista vacía

`mirarLanding` (lib/landing-vigilancia.ts) devuelve `analisis.ok` y `analisis.error`. El código obvio
—«si hay piezas las guardo, si no digo que no tiene nada»— escribe **«esta landing no tiene nada»
sobre una página que no se pudo leer**, y la vuelta siguiente la línea de tiempo dice que el
competidor le sacó el video y el formulario. Y hay un detalle que lo hace más fácil de pisar:
**`AnalisisLanding.piezas` es un `Set`, no un array**, así que `.length` es `undefined` —falsy, sin
error— y el ternario se cae del lado equivocado solo.

**Regla:** antes de guardar lo que devolvió una lectura se pregunta si la lectura SALIÓ BIEN, y eso se
lee del campo que lo dice, no de que la lista venga vacía.

### `visto_primera_vez` hay que EXCLUIRLO de la mitad que actualiza el upsert

Es el único dato de la tab que no se puede conseguir mirando a mano, y un upsert de una sola pasada
lo reescribe en cada vuelta: todas las piezas quedan «vistas por primera vez: hoy» y la tab pierde su
razón de existir, sin dar ningún error. Por eso `guardarVistas` (lib/spy.ts) **parte el upsert en
dos**: las piezas que ya estaban se actualizan sin tocar esa columna, y las nuevas se insertan con
ella.

### Lo que gasta el presupuesto de 12.000 caracteres son las PALABRAS del área, no la cantidad de operaciones

Medido el 31/10 con `tests/ops-center-clasificador-app.test.ts`: el peor turno pesa **15.325 de
15.500** caracteres (margen **175**), y es «mandá un mail a todos mis leads con la promo». Sumar un
área **entera de seis operaciones no movió ese número ni un carácter**.

El motivo: el registro se corta en 12.000 ordenando por puntaje contra el pedido, así que una
operación nueva **le saca el lugar a otra** en vez de sumar; lo que sí suma son las lecturas del área
que el clasificador ANCLA al turno. Y eso lo decide `AREA_KEYWORDS` (lib/mako-intencion.ts), no el
tamaño del área: una palabra como `anuncio` o `campaña` ahí habría metido las seis operaciones del
spy en los turnos más pesados del repo y habría roto ese test.

**Regla:** al declarar un área nueva, lo que hay que escribir corto no es la lista de operaciones —es
el regex de `AREA_KEYWORDS`, y con palabras que no signifiquen otra cosa en MaKo.

### Dos cosas que hay que tocar para que una tab deje de ser «Coming soon», y el compilador no ve ninguna

1. **`lib/capas.ts`.** `navEnCapa` es fail-OPEN para las capas con `navKeys: null`, pero dos capas
   tienen lista explícita, y la del **super admin es una de ellas**. Una tab que no esté en esa lista
   **redirige** — o sea que el síntoma es que el super admin no puede entrar a la tab que acaba de
   construir, en su propio workspace, que es desde donde Martín la abre. (El comentario de
   `lib/capas.ts:295` ya registra este mismo bug pasando antes.)
2. **`lib/movil-rutas.ts`.** La ruta del teléfono de una tab «Coming soon» **se DERIVA de la marca
   `comingSoon`**: `rutaMovil` cae a `/m/pronto/<key>`. Al sacar la marca, la tab **pierde su pantalla
   de teléfono en la misma edición**, y `tests/movil-toda-tab.test.ts` exige entonces una decisión
   escrita: su pantalla, `SOLO_ESCRITORIO` con el motivo, o `EN_CAMINO` con quién la escribe. Graduar
   una tab y mandarla al teléfono son el mismo commit, o una decisión explícita.

### Un deep link a otra tab se escribe LEYENDO su contrato, no de memoria

El botón «Replicar su sitio» de la ficha salió apuntando a `/web-generator?replicar=<url>`, que es lo
que uno escribe de memoria porque la función se llama así. El Web Generator entiende
**`?analizar=<url>`** (`derechaDeQuery`, `app/web-generator/panel-reglas.ts`), y `replicar` es un
valor de **otro** parámetro (`?vista=plantillas|temas|papelera|replicar`).

Con el parámetro inventado la query **se ignora en silencio**: la pantalla abre en su vista por
omisión y el botón parece andar. No hay error, no hay 404, y nadie lo nota hasta que alguien dice
«le di a replicar y no pasó nada». Es la versión barata de «una ruta que apunta a la nada no rompe
nada, y por eso es cara».

**Regla:** antes de escribir un link a otra tab, leer qué parámetros acepta su página. Los nombres de
las funciones y los de la query no son el mismo vocabulario.

### El plan de esta tab no está en `main`

El commit del plan (`b4d7726d1`) y los dos documentos viven en `origin/integracion` y en
`origin/nube/diseno-competitors-spy`, **no en `origin/main`**. Una sesión que clone y se pare en
`main` no encuentra `docs/hallazgos-competitors-spy.md` ni `docs/diseno-competitors-spy.md` y
concluye que la investigación no existe. Se trabaja desde `integracion`.

### Seis rojos que la compuerta habría elegido, y dos frases que prometían de más (31/10, al integrar)

**El diagnóstico obvio era el equivocado: no los trajo la mezcla.** Aparecieron al integrar y la primera lectura
fue «un verde de la rama no vale en el tren». Pero las causas ya estaban en `bb93f81f2`, la punta entregada, y los
seis tests los elegía `scripts/tests-afectados.mjs` sobre esa misma punta (medido: 830 elegidos con 32 archivos
cambiados). La regla y la trampa de esa medición están en [hallazgos-infra.md](hallazgos-infra.md). De los 11 rojos
de la mezcla con Knowledge, 6 eran de Spy, 3 de Knowledge ([hallazgos-conocimiento.md](hallazgos-conocimiento.md))
y 2 del propio arreglo de la integración: `tests/doer-falla` fija como texto la llamada que se había cambiado.

El sexto es `tests/api-mako-cobros`: `spy` tenía que ir antes de `cobros` en las áreas de la API
([hallazgos-api-mako.md](hallazgos-api-mako.md)). Y hubo uno más que **sólo aparece después de arreglar otro**:
al darle a `market-an` su entrada en el catálogo, `tests/funciones-mako` (test 6) pide sumar Competitor Spy a la
lista de lo que sólo ve el super admin. Tapado por el primero, no estaba entre los 11.

Salir de `ComingSoon` no sólo toca la nav y las capas (la sección de arriba): la key entra en **tres listas
más**. `lib/funciones-mako.ts` (toda key viva es de una función) y `tests/guia-catalogo.test.ts`
(`SIN_GUIA_TODAVIA`) dan rojo recién en la batería completa; `app/admin/dev/areas.ts` no da rojo, pero seguía
diciendo «Hoy es ComingSoon». Los otros dos rojos: `tests/integracion-sin-salir` (el onboarding mandaba a
`/integraciones`: la regla de Martín es no salir nunca de la tab) y `tests/offer-instagram`, que fijaba el
texto de la consulta de Business Discovery que Spy parametrizó. Y `tests/sin-instagram`: ningún paso de un
onboarding puede nombrar a Instagram, porque esa tab se retiró. El paso se llama «Conectar Meta», que además es
lo que abre: el modal de Meta. Instagram sigue explicado en el texto de adentro.

Y el onboarding prometía dos cosas que no son. **«YouTube pide una clave de su API»:** desde el 27/10 no se
pide (`lib/metodo-catalogo.ts`; `claveDeYoutube` cae en la de la plataforma). **«Desde hoy guarda una foto por
día»:** el cron es la Etapa 2 y no existe; la historia avanza sólo con «Revisar ahora». Cuando entre el cron,
esa frase puede volver.

**Regla:** al sacar una tab de `ComingSoon`, correr `tests/funciones-mako`, `tests/guia-catalogo` y
`tests/integracion-sin-salir` y `tests/sin-instagram` antes de entregar. Y `'market-an'` queda en `SIN_GUIA_TODAVIA`: esa lista sólo
se achica, pero esta tab nació sin guía y la escribe su tanda.

---

### La pantalla era la ausencia de datos, y el diagnóstico obvio («falta el cron») era el equivocado (31/10, Martín la abrió)

**Síntoma.** Martín abrió la tab en producción: «Que carajos es este diseño, ve y hazlo todo de nuevo... Copia de una app». Una tarjeta «Sin revisar» y cuatro acordeones diciendo que no había nada, detrás de un wizard que él ya había pedido no poner.

**La causa no era falta de datos.** Yo mismo había escrito en esta tab que «no revisa sola» como lo que le faltaba. Falso: `mirarCompetidor` ya leía todo en una pasada, y las fechas con las que se arma el tiempo las declara LA FUENTE (`timestamp` de Instagram, `publishedAt` de YouTube), así que llegan en la primera lectura. Lo que faltaba era llamarla al agregar. Se había copiado **nuestra** ficha del CRM en vez de una app de la categoría, y se dio el límite legal sobre el DATO por permiso para diseñar la pantalla de cero: son dos preguntas distintas.

**Y el cron tampoco da lo que parece.** «Desde cuándo corre este anuncio» no lo trae una foto diaria en América Latina: la Ad Library devuelve vacío con HTTP 200 y los anuncios entran pegados a mano, sin nada que volver a leer. El cron sólo sumaría deltas y «dejó de verse» entre visitas de Instagram, YouTube y la landing. Por eso no se dibuja nada que pida dos mediciones.

**De dónde salió lo nuevo**, midiendo once productos con el navegador: ninguno tiene lista a la izquierda con detalle a la derecha, ninguno secciona por canal con acordeones, ninguno tapa la pantalla con un wizard. Foreplay Spyder da la estructura (de sus capturas: no se entró a la app viva), Meta y Google el buscador fijo y el vacío único, Atria y TikTok la tarjeta, Semrush la sección que se borra. El detalle de cada pieza está en los comentarios de `app/competitor-spy/SpyApp.tsx` y `TarjetaPieza.tsx`.

**Reglas que quedan para cualquier ranura sin dato** (valen para toda la app):
- **Cargando y vacío son dos estados.** TikTok afirma «No search results found» un segundo antes de mostrar sus tarjetas; nuestra pantalla hacía eso para siempre. `estadoDeResultados` (`lib/spy-vista.ts`) lo decide y se puede probar.
- **El motivo de una lectura no se guarda en ningún lado**, y por eso sin la lectura en la mano no se afirma nada: se vuelve a leer al abrir (`debeLeerAlAbrir`, una vez por sesión, para no gastar cuota en bucle con un perfil ilegible).
- **Instagram contesta `ok` con cero piezas cuando la conexión no entrega números.** Eso no es «no publica nada»: `esLecturaRecortada` lo manda a «no pude», con «Conectar Meta» ahí mismo. Es el estado más frecuente: de 11 conexiones, sólo una tiene permisos.
- **El control apagado de Meta**: su filtro de idioma se ve deshabilitado y dice adentro por qué. Un canal sin cargar es un chip que dice «Agregar», no una caja vacía.
- **El cero se imprime cuando es un hecho contado y se saca cuando no se midió** (Meta, Google, SimilarWeb). Y un `null` tampoco es siempre «no lo publica»: si lo tachó la poda de los 30 días, decirlo le atribuye algo al dueño de la cuenta (`contadorDeTarjeta` dice «Sin leer»).
- **Un dominio derivado de un texto de YouTube se calcula al dibujar y no se guarda**: el texto vive 30 días, y una columna sobreviviría a su fuente.

**El mensaje del tope mandaba a hacer algo imposible.** «Quita uno antes de agregar otro» no tenía cómo hacerse hasta esta vuelta: no existía quitar, ni en la pantalla ni en la API. Ahora están «Dejar de mirarlo» y `dejar_de_mirar`.

## Lo que quedó SIN hacer

Actualizado el **31/10/2026**, al rehacer la pantalla: la lista, la ficha por bloques y el onboarding de
la Etapa 1 ya no existen. La 0359 **está aplicada** (la aplicó el Cerebro y la verificó contra el
catálogo), así que el punto de abajo que dice lo contrario es viejo. Lo que sigue abierto:

- **Lo que el relevamiento mostró y esta vuelta no hizo.** Vive en `app/competitor-spy/SpyApp.tsx`:
  la pantalla del teléfono (`app/m/competitor-spy/page.tsx`, y `market-an` sigue en `EN_CAMINO` de
  `lib/movil-rutas.ts`; el mismo componente ya se adapta a 375 px); el chip de país de la barra (nadie
  escribe `pais` todavía); «Seguir a este» desde una pieza; la captura de su sitio; la ilustración
  propia del vacío; el avatar real y la miniatura de Instagram, que vencen y no tienen columna a propósito.

- **Los dos trámites de la Etapa 0, que bloquean y tardan días. Son de Martín o del Cerebro.**
  1. **Aceptar la enmienda III.L de YouTube** («Section 5: Use Cases → Analytics & Reporting», en el
     pedido de ampliación de cuota). Hasta que esté, el VPH y el outlier **devuelven `null` por
     código**: el interruptor es `ENMIENDA_III_L` en `lib/spy-reglas.ts`, y la pantalla dice que falta
     un trámite en vez de mostrar un cero. **Vive en:** `lib/spy-reglas.ts` (`ENMIENDA_III_L`,
     `vistasPorHora`, `multiploDelCanal`). Al aceptarla se cambia a `true`, se anota la fecha acá, y
     recién entonces la retención de métricas pasa de 30 días a 36 meses.
  2. **Conseguir que Business Discovery ande:** vincular un Instagram profesional a la página de la
     plataforma y pedir `instagram_basic` para el token de ws9 (medido el 22/10: hoy no hay ninguno;
     de 11 conexiones de clientes, sólo ws11 tiene permisos de Instagram). Sin esto el bloque de
     Instagram dice que la conexión no entrega los números, y los demás bloques funcionan igual.
- **Aplicar la migración `0359_competitors_spy.sql`.** La nube no tiene `.env.local` ni acceso a la
  base: la migración está escrita y **sin aplicar**. El código la tolera ausente (`lib/spy.ts`
  detecta el `42P01` de Postgres y la pantalla dice que la tab todavía no está lista). La aplica una
  sesión local con `node scripts/apply-migration.mjs supabase/migrations/0359_competitors_spy.sql`.
- **El cron de snapshots (la Etapa 2, y es la que justifica la tab).** Hoy la historia sólo avanza
  cuando alguien aprieta «Revisar ahora»: `visto_primera_vez` ya se guarda bien, pero sin una pasada
  diaria la línea de tiempo tiene agujeros. Falta `app/api/cron/spy-snapshots/route.ts` con
  `correrRonda` (`lib/cron-workspaces.ts`), escalonado desde el día uno —competidores calientes
  diario, fríos semanal— porque la cuota de YouTube no aguanta todo diario (≈8.080 de 10.000 unidades
  con 4.000 canales; a 5.000 revienta). **No se escribió a propósito:** el cron tiene que declararse
  en `vercel.json` (`{ "path": "/api/cron/spy-snapshots", "schedule": "<UTC>" }`, lo exige
  `tests/cron-registrado.test.ts`) y **la regla del repo prohíbe tocar `vercel.json` desde un
  worktree** — lo agrega quien integra. Entra entero en el commit que lo registre.
- **La pantalla del teléfono.** `market-an` quedó anotada en `EN_CAMINO` (`lib/movil-rutas.ts`): en
  More se ve como «En la computadora». El diseño ya está decidido en
  [diseno-competitors-spy.md](diseno-competitors-spy.md) §8 — un bloque por pantalla, plegados; la
  galería a una columna; los filtros en una hoja que sube desde abajo— y lo que **no** va al teléfono
  se dice en vez de desaparecer: replicar el sitio (es el editor) y el recorrido con la extensión (es
  Chrome de escritorio). **Vive en:** `lib/movil-rutas.ts` (`EN_CAMINO`, `SECCIONES_MAS`, `rutaMovil`)
  y la página nueva `app/m/competitor-spy/page.tsx`, que va en el MISMO deploy que su fila.
- **La galería de anuncios de `athm793/meta-ads-scraper`** (Apache-2.0): `AdGrid`, `AdModal`,
  `FiltersPanel` y el clasificador de `hooks.ts`. Hoy los anuncios se ven como una lista en el bloque
  de la ficha; la galería con riel de filtros es lo que se copia cuando haya volumen de anuncios que
  justifique una pantalla propia. **Su scraper de Playwright no se copia nunca** (§4.1 del plan).
- **La galería pública de plantillas y las tendencias del nicho (Etapa 5).** No existe, y con ella
  entra la regla de Martín del 29/10: **ni cara, ni nombre, ni @ de un gurú real; arquetipos de
  estilo**. Hoy sólo existe la ficha PRIVADA, donde el @ del competidor que ese negocio eligió sí se
  ve — la distinción está escrita en `lib/spy-reglas.ts`. Las tendencias son un subproducto de la
  historia acumulada por el cron, así que van después de la Etapa 2.
- **Dos decisiones de Martín, en [diseno-competitors-spy.md](diseno-competitors-spy.md) §9:** si los
  anuncios de Meta van por el recorrido a la vista con la extensión (riesgo de ToS, el mismo que ya
  aceptó para WhatsApp, pero esta vez el dato se le muestra a un cliente que paga, que es justo lo que
  nombra la cláusula 4), y si Apify se usa para los perfiles de Instagram de competidores. **Mientras
  no decida, la tab funciona:** los anuncios entran por la vía que no tiene problema de términos —los
  pega la persona— y eso ya está construido (`guardarAnuncioPegado`, `lib/spy.ts`).
- **Unir `CAMPOS_PERFIL_PIEZAS` con `CAMPOS_PERFIL`** el día que alguien confirme el juego ancho con
  una credencial de verdad. Hoy son dos constantes y un reintento, por el 400 que tira toda la
  consulta (ver arriba). **Vive en:** `lib/instagram-perfil.ts`, `lib/instagram-perfil-server.ts`.
- **El `?? 0` que quedó en el video estudio**, que no es de esta tab pero pone en rojo un guard
  compartido: `lib/api-mako/areas/video-estudio.run.ts:528` devuelve un `No pude…` sin `falla: true`,
  así que `tests/guarda-por-defecto.test.ts` está rojo desde el 27/10 (commit `9012f6070`) y ese «no
  pude» de MaKo **no abre ticket solo**. Es una línea; se dejó para el chat del video, que es el dueño
  del archivo.
- **Sin verificar**, para que nadie lo tome como medido: si `playlistItems` tiene tope de paginación por
  playlist; si `videos.list?id=` acepta más de 50 ids (la doc no declara un máximo, 50 es el batch de
  facto de las client libraries); si la **Unified Login** de Instagram soporta `business_discovery` (el
  overview no lo lista y la referencia sigue diciendo Facebook Login — si lo soporta, se ahorra el
  requisito de la Página de Facebook); si `paidProductPlacementDetails` es público para videos ajenos
  (no figura entre las partes restringidas al dueño; si lo es, detecta qué videos del competidor
  declaran promoción paga); y **si los siete campos de `CAMPOS_PERFIL_PIEZAS` existen de verdad en
  Business Discovery** — están documentados, pero sin credencial no se probó ni uno.

## La animación de «Sort my footage» era un video, no un componente (1/11/2026)

**Pedido** (Martín): copiar de yanny.space/studio la animación de «Sort my footage» a Competitors Spy.

- ⚠️ **En esa página no hay ninguna animación que leer: es un MP4 de 13 s** (`assets/sort/sort.mp4`). No hay código ni valores: se miró cuadro por cuadro,
  cada 2 segundos, y se reconstruyó. Las miniaturas entran desde afuera y forman una bola, aparecen las carpetas, cada una vuela a la suya y sube la
  cuenta, y el cierre es todo desenfocado con la frase escrita encima.
- **Lo que no se copió: los números de mentira.** Ahí son 1.065 archivos de un demo. Acá son las piezas que se acaban de leer, y sin piezas no se monta.
  Las carpetas salen de lo que Spy sabe de una pieza: canal, formato y etapa.
- **Se dispara en una lectura pedida o en la primera de una ficha vacía.** La relectura sola de una ficha que ya tiene piezas va callada: si no, entrar a mirar
  costaba seis segundos de animación. «Saltar» la corta, y con «reducir movimiento» no corre.
- **140 miniaturas como tope de dibujo:** con más, una computadora normal se traba. El número que se lee sigue siendo el real (`repartirMiniaturas`).

**Sin hacer:** las de Instagram no tienen imagen: la del CDN de Meta vence y no se guarda (0359), así que su miniatura es su texto. Para tener la foto en
la animación habría que pasar la URL viva desde la lectura sin guardarla. Y no se probó con una lectura real: el arnés usa datos falsos.

**Vive en:** lib/spy-orden.ts · app/competitor-spy/OrdenSpy.tsx · tests/spy-orden.test.ts.

## Apify para leer Instagram: una clave nueva, no la vuelta del scraper (1/11/2026)

**Pedido** (Martín): conectar Apify para que Spy lea Instagram.

- ⚠️ **Lo que se retiró el 25/10 fue el Leads Scraper, no «Apify».** Por eso es otra clave (`APIFY_INSTAGRAM_TOKEN`) y otra fuente (`apify-spy`), que sólo pide lib/spy.ts. Reusar `APIFY_TOKEN` habría despertado también el buscador del alta del CRM y Offer, que preguntan mientras se escribe y lo pagaría quien pegó la clave. `tests/leads-scraper-retirado.test.ts` sigue prohibiendo el scraper y ahora fija este límite.
- ⚠️ **Spy leía Instagram sin decir de qué negocio era** (`leerPerfilInstagram` sin `ws`): nunca usó la Meta del cliente, siempre la de la plataforma. Por eso el error decía «la página no tiene un Instagram vinculado» aunque el cliente tuviera el suyo.
- ⚠️ **Un fallo se cachea 10 minutos.** Sin meter en la clave si hay clave de Spy, pegarla y tocar «Revisar ahora» seguía diciendo «no pude».
- **El actor manda `likesCount: -1` con los «me gusta» ocultos.** Es «no se sabe», nunca un número.
- ⚠️ **Dos permisos (docs/funnel-coach.md §5):** Apify lee perfiles públicos sin pasar por la API de Meta, lo que va contra los términos de Instagram. Lo decidió Martín, corre con la clave de cada negocio y con tope de 40 por día; la vía oficial sigue primero. La memoria del 29/10 («fuentes sólo legales, nada de scraping masivo») no cambió para el resto.

**Sin probar contra Apify de verdad:** no hay clave todavía. La forma de `latestPosts` está tomada del código del 22/10 y de la documentación del actor.

**Vive en:** lib/instagram-perfil-server.ts · lib/instagram-perfil.ts · lib/spy.ts · lib/metodo-catalogo.ts (`apify-instagram`).

---

## El diagnóstico obvio era el equivocado: «copiar una referencia» no es «mejorar lo que hay» (1/11/2026)

**El síntoma.** Martín pidió cuatro veces lo mismo —«rediseñá toda la tab siguiendo una
referencia»— y cuatro veces recibió otra cosa. Las tres primeras vueltas **sí tocaron la tab**: una
reordenó las filas (7 → 5), otra cambió los radios, los tamaños y la sombra por los tokens medidos.
Las dos se midieron, las dos dieron números mejores (462 px → 229 px hasta la primera pieza) y las
dos se rechazaron en el acto: «se ve horrible otra vez», «es la cuarta vez que te lo pido».

**La causa, y es de método.** Las tres vueltas empezaron abriendo `SpyApp.tsx`. Partiendo de la
pantalla propia, lo único que se puede hacer es cambiarle la superficie: mover cajas y reemplazar
valores. El esqueleto —qué hay, en qué orden, en qué columnas— sobrevive intacto, porque nunca se
puso en duda. Y el esqueleto es justamente lo que se ve.

**La regla que queda:** *copiar una referencia es empezar por la referencia.* Abrirla en el
navegador, medirle el árbol y las reglas, escribir el esqueleto, y recién entonces preguntarse qué
de lo nuestro entra ahí. **Si el primer archivo que abriste es el tuyo, no estás copiando: estás
mejorando, que es lo que te pidieron no hacer.** Medir el resultado no lo arregla — las dos vueltas
malas tenían mejores números que la pantalla original.

**El corolario que ahorra tiempo:** la referencia no se elige por el rubro, se elige por la FORMA.
Spy es «un catálogo que se filtra», así que la referencia útil no fue ningún producto de espionaje
de anuncios: fue **una tienda de ropa** (`fitlo /shop`), que tiene exactamente esa forma. Y como el
análisis no entra en un catálogo, el riel salió de otra plantilla (`merrin`). Dos referencias, una
por pieza, en vez de forzar una sola.

**Qué cambió de esqueleto** (medidas y reglas en `docs/diseno/referencia-spy.md`):

- El análisis dejó de ser una banda plegada **arriba** de las piezas y pasó a un **riel de 336 px a
  la derecha**. Por eso ahora puede estar siempre abierto: dejó de competir con el catálogo. La
  banda arrancaba plegada justamente porque competía — el síntoma estaba visible y se trató como un
  problema de altura.
- Las seis píldoras grises de la identidad se fueron: los números son **celdas pastel de datos** en
  el riel y la frescura es una línea gris debajo del título.
- La tarjeta **no tiene borde, tiene un tinte**, y el tinte dice de qué canal es la pieza. Con eso
  desaparece la fila «ícono + nombre del canal» que llevaba arriba de cada tarjeta.

**Vive en:** app/competitor-spy/SpyApp.tsx · app/competitor-spy/TarjetaPieza.tsx ·
docs/diseno/referencia-spy.md

---

## Un guard que busca un identificador encuentra la declaración, no el uso (2/11/2026)

**Pasó dos veces en una hora**, con dos guards distintos, y las dos veces el test pasó en VERDE
sobre código que yo acababa de romper a propósito:

1. `tests/spy-youtube-largos.test.ts` comprobaba que existiera `PAGINAS_MAX`. Con
   `PAGINAS_MAX = 1` —que es exactamente el bug que el guard existe para frenar— pasó en verde.
2. `tests/spy-alta-duplicados.test.ts` comprobaba que apareciera `nombreComparable(`. Con la
   comparación cambiada a `x.nombre === nombre` pasó en verde, porque la función seguía
   existiendo una línea más arriba, en `const buscado = nombreComparable(nombre)`.

**La regla:** un guard que mira el código **no busca un identificador, busca la FORMA DEL USO**.
`/PAGINAS_MAX/` no sirve; `/const PAGINAS_MAX = (\d+);/` y después `Number(...) > 1` sí.
`/nombreComparable\(/` no sirve; `/nombreComparable\(x\.nombre\)\s*===/` sí.

**Y el corolario, que es el que hace que se note:** un guard nuevo **se prueba rompiendo lo que
vigila**, antes de confiar en él. Los dos de arriba se escribieron, dieron verde, y recién al
romper el código a propósito se vio que no servían. Un guard que no se pone rojo cuando la cosa
está rota es peor que no tener guard: da permiso para seguir.

**Vive en:** tests/spy-youtube-largos.test.ts · tests/spy-alta-duplicados.test.ts

---

## Una caché no la rompe la caché: la rompe lo que le pasa quien la llama (2/11/2026)

Dos bugs seguidos la misma noche, los dos en código que acababa de escribir y los dos invisibles
desde adentro de la función.

**El primero.** `guardarMiniaturas` baja imágenes y las sube a nuestro bucket. Corre ADENTRO de
`guardarVistas`, que corre adentro de la acción que dispara el usuario con «Revisar ahora». Con 50
piezas, de a 6 y hasta 8 s cada una, el peor caso eran **72 segundos sólo de imágenes**, y Spy no
declara `maxDuration`: la lectura entera —la que trae los datos— se habría caído por culpa de las
fotos. **Lo que hace lento a algo no es su propio código, es dónde está enchufado.**

**El segundo, y es el que enseña más.** Con el presupuesto puesto, la función era correcta y aun
así no servía: `esNuestra(v.miniatura)` daba `false` para TODAS, siempre. Porque lo que le llega de
la API es **la URL fresca del CDN**, nunca la nuestra — la nuestra está en la base, y la función
nunca la veía. Resultado: el presupuesto se gastaba cada vez en las PRIMERAS imágenes y nunca
llegaba a las que faltaban. Se podía tocar «Revisar ahora» diez veces y las últimas treinta
miniaturas no se bajaban jamás. La función estaba bien; **el dato que le pasaban estaba mal**.

**La regla que queda:** cuando agregues una caché o un «si ya lo tengo, no lo hago», **mirá qué le
pasa quien la llama, no sólo cómo está escrita por dentro**. Si la clave con la que decide viene de
afuera y se regenera en cada vuelta, la caché nunca acierta y no se nota: no falla, sólo no sirve.
Y la segunda: **medí el peor caso en TIEMPO de lo que agregaste, y comparalo con el tope de donde
corre.** 50 × 8 s no es «un poco más lento», es otra cosa.

**Cómo se ven, porque ninguna de las dos da error:** la primera, un «Revisar ahora» que se cae con
muchas piezas y anda con pocas. La segunda, algo que converge para los primeros elementos y nunca
para los últimos. Las dos pasan todos los tests que no midan el tiempo ni cuenten las llamadas.

**Vive en:** lib/spy-miniaturas.ts (`PRESUPUESTO_MS`) · lib/spy.ts (`yaBajada`) ·
tests/spy-miniaturas.test.ts

## El dato más barato es el que ya pagaste y estás tirando (2/11/2026)

**El pedido:** Martín, ítem 10 — «con un dato, traer todas sus redes», más la landing o el funnel que
tenga en la bio. Yo lo tenía anotado como trabado: hace falta un actor de BÚSQUEDA de Apify, que es
otro costo y otra decisión suya.

**Era trabado a medias.** La vista previa del alta ya lee el perfil con Apify y devuelve `web`, el
link de la bio. La pantalla incluso lo MUESTRA («Su sitio: acme.com»). Y al confirmar,
`agregarCompetidor` guardaba sólo el canal que se pegó: **`lib/spy.ts` no mencionaba `perfil.web` en
ninguna línea.** O sea que el dato llegaba, se dibujaba y se tiraba.

**La regla que queda, y es la que vale más que el arreglo:** antes de declarar trabado un pedido de
«traer más datos», mirá qué datos YA te devuelve la llamada que estás haciendo. Una lectura de perfil
trae nombre, foto, seguidores, bio y el link de la bio; si la pantalla muestra un campo que la base
no guarda, ahí hay una mitad gratis. **Lo que se ve y lo que se guarda son dos cosas distintas** —es
el mismo hallazgo que las miniaturas de YouTube, que se dibujaban desde una URL ajena y no estaban
archivadas en ningún lado.

⚠️ **El link viaja desde la PANTALLA, no se vuelve a leer en el servidor.** Releer el perfil dentro
de `agregarCompetidor` habría sido pagar dos veces el mismo dato y gastar del tope diario
(`APIFY_TOPE_POR_DIA`), que es exactamente lo que deja al negocio sin poder agregar a nadie el resto
del día.

⚠️ **Y SE CLASIFICA CON `queEs`, no con una expresión nueva.** Tres casos que una regex propia habría
dejado pasar: una bio que enlaza a otra cuenta de Instagram (guardaría instagram.com como su «página
de venta»), una bio con texto en vez de link, y una bio que repite el canal que ya se pegó. `queEs`
los distingue solo, y además ya tiene el tope de 500 caracteres y el `https://` para un dominio
pelado.

⚠️ **La decisión vive en `lib/spy-reglas.ts` y no en `lib/spy.ts` por una razón concreta:** `spy.ts`
importa `server-only` y ningún test puede importarlo. Una regla metida ahí sólo se puede cuidar
emparejando el archivo como texto, que es cómo dos guards de esta semana pasaron en verde sobre
código roto.

### Y una trampa del test, que es el hallazgo de método

El primer test rechazaba la bio de Instagram con `canalDeLaBio(otraIg, 'instagram')`. **Sacarle la
lista blanca de campos al código dejaba el test en 7 / 0**: el descarte del «mismo campo» devolvía
`null` igual y tapaba el agujero. El caso que vale es con OTRO canal pegado —
`canalDeLaBio(otraIg, 'youtube_id')`— porque ahí la lista blanca es lo ÚNICO que impide guardar
instagram.com como landing.

**La regla:** un test que prueba un rechazo tiene que elegir el caso donde **esa** regla es la única
que puede rechazar. Si otra guarda del mismo camino devuelve lo mismo, el test pasa con el código
roto y no te enterás. Probarlo rompiéndolo es lo que lo mostró.

**Vive en:** lib/spy-reglas.ts (`canalDeLaBio`) · lib/spy.ts (`agregarCompetidor`, `queEs`) ·
app/competitor-spy/SpyApp.tsx (`ModalAlta` → `onPegar`) · app/competitor-spy/actions.ts ·
tests/spy-canal-de-la-bio.test.ts

## Sus otras redes por búsqueda: el costo medido apurado sale 100 veces más bajo (3/11/2026)

**Síntoma:** al medir el actor de búsqueda (`apify~google-search-scraper`) la corrida decía
**US$0,00005**. Parecía gratis.
**Causa real:** es un actor PAY_PER_EVENT y el evento de la página («search-page-scraped»,
US$0,0045) se asienta DESPUÉS de que la corrida termina. Leído a los 4 s sólo figuraba el
arranque. Asentado: **US$0,00455 por búsqueda**. `scripts/probar-otras-redes-apify.mjs` espera 15 s
y suma evento por precio; **`usageTotalUsd` solo no es lo que se paga** en un actor por eventos.

**Otras trampas del mismo actor, medidas:**
- **Exige `maxTotalChargeUsd` ≥ US$0,50** (con 0,02, como los de Instagram, contesta 400
  `max-total-charge-usd-below-minimum`). Es un techo, no un cobro: `TECHO_USD_POR_CORRIDA_REDES`.
- **Buscar por nombre trae a otras personas, y se vio en la primera prueba:** «Sofia Contreras»
  devolvió CINCO Instagram distintos. Por eso la búsqueda devuelve candidatos y **no escribe**
  (`lib/spy-otras-redes.ts` no importa la base; un test lo vigila) y sólo el «Sí, es esta persona»
  guarda, por el mismo camino que pegarlo a mano.
- **El `/c/<alias>` de YouTube es su canal pero no se ofrece:** ningún endpoint lo resuelve, y
  convertirlo en `@alias` es adivinar — un `@` adivinado puede ser el canal de otro.

**Lo que estaba roto sin que nadie lo viera:** un link a su **TikTok en la bio se guardaba como su
LANDING** — `queEs` clasificaba tiktok.com como un sitio cualquiera. Ahora TikTok es un campo
(migración 0365) y `queEs` lo reconoce con la misma `redDeUrl` que lee los resultados.

**Regla:** de una red que el competidor YA tiene no se ofrece nada. El que está lo eligió el
negocio; los demás con su nombre son otra gente.

## El modal de Spy: copiar es elegir la pieza por lo que HACE (3/11/2026)

**Síntoma:** Martín, 3/11 — «No se mejoró ni el modal, sigue horrible el diseño... Y no tiene sentido que tenga 2
tabs». El #8 figuraba HECHO: se había arreglado cómo FUNCIONA y no cómo se VE.

**Lo medido en producción antes de tocar nada:** la caja medía 480×254 con **`padding: 0`**. `ModalShell` no pone aire
y `.spy-modal` tampoco: el texto iba pegado a los bordes en TODOS los modales de la tab. Era un bug, no un gusto. Y el
campo gris no era nuestro: venía de `campo` en `InstagramBuscador.tsx`, que en el alta del CRM combina con el formulario.

**El diagnóstico obvio era el equivocado:** «copiar un modal» manda a copiar el modal de `merrin` («New customer»), que
es un formulario, y un formulario es lo que había. La pieza que hace lo mismo que esto —escribir, ver filas, elegir— es
**su buscador de ⌘K (`.finder`)**, y ése no se llama modal en ningún lado. Medidas en
[diseno/referencia-spy.md](diseno/referencia-spy.md). **Regla: la referencia se elige por lo que hace, no por cómo se
llama** (es el mismo hallazgo de fitlo, una tienda de ropa, un nivel más abajo).

### Cuatro cosas que gastaban del tope sin que nadie lo viera

El tope (`APIFY_TOPE_POR_DIA`, 40) es lo que deja a un negocio sin poder agregar a nadie, y ninguna de estas da error:

- ⚠️ **La búsqueda por nombre no contaba.** La cabecera de `lib/instagram-buscar-apify.ts` decía que el tope la cubría
  («peor caso US$0,48 por día»), pero sólo `leerPerfilInstagram` contaba. Escribir nombres no tenía techo. Ahora pasa por
  `gastarBusquedaDeSpy`, y sin cupo la pantalla lo dice en vez de «no encontré a nadie» (`limite`).
- ⚠️ **La misma persona se pagaba dos veces.** La clave de la caché lleva la lista de fuentes, y el buscador y la vista
  previa piden listas distintas: escribir su @ gastaba una lectura y confirmarla, otra. `claveLeido` comparte lo leído bien
  entre todos. Lleva el ancho (`anchas`/`angostas`): una lectura sin piezas no puede contestarle a quien pide piezas, o
  diría «no publica sus me gusta» de quien sí los publica.
- ⚠️ **Un tope con reserva habría tapado a la vista previa.** `reservaApify` hace fallar antes a lo que nadie pidió con un
  clic, y ese fallo se cachea 10 minutos. Con la misma clave, la fila que no se completó le contestaba «no pude» a quien
  la elegía. La reserva entra en la clave.
- ⚠️ **Un link de su perfil se buscaba como un NOMBRE.** `usuarioDeTexto` no acepta enlaces, así que la ruta gastaba 20 s de
  búsqueda en un texto que ya decía quién es. `queSeHace` manda `@usuario`, y a quien ya se mira no se lo busca.

### Y dos más que no son de plata

- ⚠️ **La vista previa no podía leer con la clave de Spy.** Llamaba con las fuentes por defecto, que no incluyen `apify-spy`,
  y con sólo esa clave contestaba «no pude leer» habiendo con qué. El mismo bug que el CRM arregló el 2/11: **una lista de
  fuentes por defecto es un lector distinto en cada llamada**. Ahora hay `leerPerfilParaElAlta`, y la lista vive ahí.
- ⚠️ **Completar va por una ruta, no por una server action.** Next pone en FILA las actions de una pantalla: cinco lecturas
  de ~10 s habrían dejado esperando el «Sí, agregar», sin nada que lo explique. Un `fetch` no hace fila y se cancela.

### Y la búsqueda no trae a quien buscás

Medido en producción con «leila hormozi»: Apify trajo @leila.hormozi.1368, @leihormoz, @leillahormozi y
@leila_hormozi63, sin una sola foto, y **a la verdadera no**. @leilahormozi existe y se lee en 5 s. Por eso con un nombre se
prueba además su @ pegado (`usuarioDelNombre`), y esa fila sale sólo si la cuenta existe: lo dice la lectura, no una suposición.

**Lo que NO se pudo medir:** qué negocios tienen cada clave de Apify, porque leer `credenciales` lo frenó el permiso de
la sesión; el código pide las dos. `spy_lecturas_canal` estaba en **0 filas** el 3/11: la poda todavía no tiene qué borrar, y
`anotarAhorro` tampoco tiene con qué medirse.

**Vive en:** app/competitor-spy/BuscadorAlta.tsx · lib/spy-alta-reglas.ts · lib/spy-que-es.ts ·
lib/instagram-perfil-server.ts · app/api/competitor-spy/perfil · app/api/cron/spy-poda · tests/spy-buscador-alta.test.ts

**Probado rompiéndolo:** 39 roturas, una por vez y restaurada, y las 39 dieron rojo (`tests/spy-buscador-alta.test.ts` y `tests/instagram-perfil-fuentes.test.ts`, más
`tests/cron-registrado.test.ts` para la agenda). Sacarle a `cualesCompletar` el tope, que lea lo ya completo o que repita lo
pedido; la foto directa al CDN en las dos pantallas; el proxy abierto o que siga una redirección; el campo gris; la barra que
guarda sin confirmar; la búsqueda sin contar; el cron caído que contesta 200.

## Unfunnelizer: qué copiar para Spy, y lo que Spy ya guarda y tira (03/11/2026, Cerebro)

Martín: «investiga esto para copiarlo en la extension de MaKo» y «Obvio que esto va para la funcionalidad de Competitors Spy». Se investigó sin instalarla: ficha, documentos y el código de MaKo. Se copia la función, nunca su código, textos ni imágenes.

**Lo que se encontró en casa:**
- ⚠️ Los píxeles ya se leen y se tiran: `pixelesMetaDe` (`lib/landing-analisis.ts:389`) guarda `meta-px:` en `etiquetas`, y `nombresDe` los descarta al dibujar.
- ⚠️ Las columnas de anuncios están y nadie las llena: `diasCorriendo` y `etapaDeTendencia` existen, pero `guardarAnuncioPegado` (`lib/spy.ts:691`) sólo guarda enlace y copy, y `pagina_anuncios` no la escribe nadie.
- ⚠️ La poda de YouTube alcanza a todos los canales: `podarVencido` borraría a los 30 días lo leído de la Biblioteca, que no se relee. Y por eso `etiquetas` no sirve para datos nuevos: hace falta una columna propia.
- `RE_CHECKOUT` (`lib/landing-conversion.ts:50`) ya reconoce Stripe, Hotmart y Mercado Pago, pero Spy no lo usa. VTurb y Vidalytics no aparecen en ningún lado.
- ⚠️ No tocar `HOSTS_VIDEO` para esto: es el flujo del Pixel de los clientes, y esa cabecera avisa del riesgo de mandarles avisos falsos.

**La regla que queda:**
- Lo que se lee con la extensión se interpreta en el SERVIDOR: si cambia el diseño de un sitio, se arregla con un deploy y no con otra revisión de Chrome.
- `activeTab` no muestra advertencia, así que no debería desactivar la extensión a los clientes al actualizar (deducido de la documentación de Chrome, sin medir). Un permiso de sitios sí.
- Lo leído de Meta NO entra en `spy_lecturas_canal`: compartirlo entre negocios sería justo la transferencia a terceros que prohíben sus términos.

**Qué NO se copia:** la descarga de VSL, el «fetch-relay» contra el hotlink, el modo Brute y la página desbloqueada. La política de Chrome prohíbe facilitar esa descarga y eludir muros, y reincidir puede cerrar la cuenta que distribuye la extensión a los clientes que pagan.

**Sin hacer:**
- Tanda A, en el servidor: hecha, ver la entrada siguiente.
- Tanda B, «Guardar en Spy» en la extensión: hecha, y lo que estaba sin comprobar se midió. Ver «Guardar en Spy», abajo.

## Sus píxeles, su checkout y su video: lo que se midió construyéndolo (03/11/2026)

**Vive en:** `lib/spy-funnel.ts`, `spy_piezas.funnel` (0373), `app/competitor-spy/SuFunnel.tsx`.

**El diagnóstico obvio era el equivocado:**
- ⚠️ «Ver sus anuncios» buscando el dominio abre y miente. Con `keyword_unordered`, `acquisition.com` se parte en dos palabras: ~24.000 anuncios de cualquiera, el primero de Naukri.com, sin error. Con `keyword_exact_phrase` y el dominio entre comillas salen los de Alex Hormozi.
- ⚠️ Una lectura más completa no puede pisar a la anterior. El servidor no ve lo que carga Tag Manager; el navegador no ve lo que frena un bloqueador. Si una reemplazara a la otra, los píxeles aparecerían y desaparecerían según quién leyó último. Por eso son dos lugares (`pagina` y `navegador`) y se dibuja la unión.

**Medido con páginas de verdad, sin escribir nada:**
- acquisition.com: Google Analytics, Tag Manager, Google Ads, TikTok y Vidalytics. **El píxel de Meta no se ve desde el servidor**, y es el caso común: lo carga Tag Manager. Por eso la pantalla dice «Tag Manager puede cargar más» y nunca «no tiene».
- skool.com, con 455 KB de HTML y 2 MB de scripts propios: nada. Es un «no se ve desde afuera», que no es «no tiene».
- vidalytics.com contestó 429 al servidor: una lectura que falló, y no escribe nada.

**La regla que queda:**
- Un id se ancla en la forma de cargarlo (`gtm.js?id=`, `fbq('init',`, `gtag('config',`), nunca en el texto suelto: un artículo que enseña a instalar un píxel no es un píxel. Se descartan los comentarios, `<pre>`, `<code>` y los rellenos (`GTM-XXXXXX`, `123456789`).
- Lo que viene de la columna se vuelve a validar: sólo `https://`, porque termina en un `href`.
- Lo que se repite se agrupa, como los píxeles: un sitio con tres productos en Stripe y tres en Hotmart se dibujaba «Stripe Stripe Stripe Hotmart Hotmart Hotmart» (julioiero.com, en producción, visto el 12/11). Ahora es una pastilla por plataforma con «+2» (`checkoutsPorPlataforma`).
- `guardarFunnel` va aparte de `guardarVistas` y no tira: sin la columna, un upsert con `funnel` adentro perdería la lectura entera de la landing.

**Sin hacer:**
- La columna se agregó en producción el 4/11/2026, con el sí de Martín en el chat del Cerebro.
- Lectura real en el negocio de prueba (4/11/2026, Acquisition.com, ws3): Vidalytics, Google Analytics, Tag Manager, Google Ads y TikTok quedaron en `spy_piezas.funnel`, sin ninguna fila en otro negocio. Falta mirar la pestaña en la pantalla, una vez desplegada.
- Los videos que el analizador dice ver en un bundle (`reBundle`) pueden ser una librería que nadie monta (react-player trae las URL de YouTube y Vimeo). Se hereda tal cual de `analizarHtml`.

## «Guardar en Spy»: lo medido en la Biblioteca real, con la extensión de verdad (03/11/2026)

**Vive en:** `extension/spy-leer.js`, `extension/spy-reglas.js`, `extension/popup.js`; `lib/spy-captura.ts`, `lib/spy-captura-db.ts`; `app/api/competitor-spy/extension/route.ts`. La decisión de Martín («Sí, con un clic»): `docs/diseno-competitors-spy.md` §9.1.

**El diagnóstico obvio era el equivocado:**
- ⚠️ `chrome.action.openPopup` abre el desplegable y **no otorga `activeTab`** (Chrome 156: «Cannot access contents of the page» antes y después, y `tab.url` no viene). Hace falta el clic en el ícono. Por eso, sin `tab.url` el botón no aparece: cuando el worker abre el desplegable durante una extracción, no se ofrece nada.
- ⚠️ Buscar el dominio en la Biblioteca trae anuncios de otros aunque sea frase exacta: de 28 tarjetas de `"acquisition.com"`, 19 eran de Alex Hormozi y 9 de otros anunciantes que nombran ese dominio. Guardar «lo que se ve» habría llenado su ficha de ajenos. Entran sólo los que coinciden por Página, nombre o dominio de destino, y el desplegable dice cuántos quedaron afuera.
- ⚠️ El navegador ve más que el servidor, pero no todo. En acquisition.com vio tres cuentas de Google Analytics contra una, y **el servidor** vio Vidalytics, que el navegador todavía no había cargado. Ninguno de los dos vio el píxel de Meta. Por eso una lectura no reemplaza a la otra.

**Medido el 3/11/2026:**
- `performance` desde el mundo aislado ve lo mismo que la página: 117 de 117 recursos en un sitio, 216 de 216 en la Biblioteca. Las variables de la página no: `dataLayer` da `undefined`. Un píxel cargado por Tag Manager se ve por la dirección que pidió.
- Las direcciones alcanzan sin la consulta: `gtm.js?id=`, `g/collect?tid=`, `ccm/collect?tid=AW-`, `events.js?sdkid=`, `tr?id=`. Del resto de la consulta sale el correo del visitante y su identificador: `spy-leer.js` deja sólo `id`, `tid`, `sdkid`, `u` y `view_all_page_id`.
- La Biblioteca, sin sesión, con ~95 KB por 28 tarjetas. El id se dice «Library ID:», «Identificador de la biblioteca:» o «Identificação da biblioteca:»; la fecha, «Started running on Jul 29, 2026», «En circulación desde el 29 jul 2026» o «Veiculação iniciada em 29 de jul de 2026»; un anuncio inactivo trae el rango («30 jun 2026 - 11 ago 2026»).
- ⚠️ **Las plataformas son íconos sin texto** y el **id de la Página no está en lo dibujado**: sólo en la dirección, si se abrió por `view_all_page_id`. Por eso `plataformas` queda vacía y `pagina_anuncios` puede ser un nombre (`ahormozi`); con un nombre, «Ver sus anuncios» busca por frase exacta.
- Punta a punta, con la extensión real y sin tocar producción: en acquisition.com dijo «Guardar en la ficha de…» y guardó Analytics, Tag Manager, Google Ads y TikTok; en la Biblioteca dijo «Agregar como competidor» y sacó 19 anuncios de Alex Hormozi con sus fechas, destino e imagen.

**La regla que queda:**
- Lo que se lee con `activeTab` se interpreta en el servidor. El lector no sabe qué es un anuncio.
- Lo dibujado en una pestaña no dice lo que falta: `marcarDejadas` no se llama nunca desde acá. «Dejó de verse» sólo si la Biblioteca dice la fecha en que terminó.
- De un sitio sólo salen direcciones y su título. La persona puede tocar el botón con una sesión abierta, y lo que ese sitio le muestra a ella no es asunto de MaKo.
- Abrir el desplegable no cuenta qué sitio se está mirando: la lista de competidores viene entera y se compara en el navegador.
- La miniatura sólo puede ser del CDN de Meta: la baja el servidor, y si no, un token cualquiera le hace pedir lo que quiera.

**Sin hacer:**
- ~~Falta verlo escrito de verdad~~ **Medido en producción el 12/11, sólo lectura:** la columna `funnel` está, y en el ws3 Acquisition.com tiene los mismos píxeles que se midieron acá (Analytics, Tag Manager, Google Ads, TikTok y Vidalytics). Hay 8 landings con funnel en tres negocios. **Todavía ninguna con lo del navegador** (`navegador` vacío en todas): «Guardar en la ficha de…» sobre un sitio no se usó en producción.
- ⚠️ **Dos landings leídas bien quedaron sin funnel** (ws3, Leila Hormozi, 11/11; ws11, viralidad.com, 6/11), y otra fila con la misma página en otro negocio sí lo tiene. Leídas de nuevo el 12/11 en local, `leerFunnel` las lee bien en 17 y 11 ms: no es el lector. Lo que encaja: algo tiró DESPUÉS de `guardarVistas` y antes de escribir el funnel, el `catch` de `mirarCompetidor` dijo «no pude leer su sitio» y la fila ya estaba. Sin los logs de esa hora no se confirma. Se arregla solo con la próxima lectura.
- ⚠️ **Los anuncios que trae Apify dicen «lo guardaste desde tu navegador».** `lib/spy-todo.ts` (4/11, otro trabajo) los guarda con `piezaDeAnuncio`, que pone `fuente: 'recorrido'`. En producción son los 318 de ws9 y ws11 (262 en 15 segundos: no pueden ser clics, la extensión guarda hasta 50 por vez). La API de MaKo se lo dice así al cliente (`NOMBRE_FUENTE`, `que_esta_haciendo`). Hace falta una fuente propia, y eso es una migración (el `check` de `spy_piezas.fuente`) más corregir esas filas.
- Publicar la 0.75.0 lo decide el Cerebro: la 0.74.5 sigue en revisión. **Al subir esta parte a main**, `EXTENSION_VERSION` pasa a 0.75.0 y la tienda queda atrás (`EXTENSION_EN_TIENDA`), así que la app vuelve a ofrecer el zip.
- Sin medir: que `activeTab` no desactive la extensión al actualizar desde la tienda (deducido de la documentación). El clic se midió con `Extensions.triggerAction`, no con una persona.
- **La miniatura que no se llega a bajar se pierde:** `guardarMiniaturas` tiene 9 s de presupuesto, y un anuncio no se relee solo. La que no entró queda apuntando al CDN, que vence, hasta que se vuelva a guardar esa pestaña.
- La imagen se guarda en `spy/anuncios/<id>`, sin el negocio: dos negocios con el mismo anuncio reusan el archivo. No es la lectura compartida (no hay manera de ver el de otro), pero el archivo es uno.
- Cuando la 0.75.0 esté publicada, «Tag Manager puede cargar más» (`SuFunnel.tsx`) debería decir cómo verlo: abrir su sitio y tocar el ícono de MaKo.

## El buscador traía cuentas chicas: el diagnóstico obvio («otro actor de Apify») era el equivocado (4/11/2026)

**Síntoma:** Martín buscó «Víctor Heras» y vinieron @victorheras (5,2 mil), @victoria.herasymchukk (59),
@victor.heras.167 (14)… y ninguna de las grandes que el buscador del propio Instagram muestra primero
(victorherasemprendedor, 492 mil; herasmedia, 248 mil).

**El diagnóstico obvio era el equivocado:** «el actor de Apify busca mal, hay que buscar uno mejor». Pero el buscador de
Instagram ordena por relevancia CON la sesión de quien busca (a quién sigue, quién es grande, qué buscó otra gente); un
scraper sin sesión sólo puede emparejar texto, y ahí 14 seguidores y 492 mil empatan. Ningún actor sin sesión arregla eso.
Lo que ordena por popularidad sin sesión es Google, y además escribe los seguidores en la descripción del resultado:
con eso se ordena sin leer cada perfil. **Regla: cuando un proveedor ordena «mal», preguntá primero con qué dato ordena
el que ordena bien, y si ese dato se puede tener sin su sesión.**

**Otros tres del mismo pedido, ninguno daba error:**
- ⚠️ **La barra principal no buscaba: filtraba.** Sólo comparaba contra los competidores que ya se miran; con un nombre
  nuevo mostraba un cartel con otro botón. Para Martín «no hace nada». Ahora abre el mismo buscador que el «+».
- ⚠️ **«den.borgg» era un SITIO.** `queEs` tomaba cualquier «algo.algo» por un dominio pelado: el @ escrito sin la arroba
  se ofrecía como la página https://den.borgg y nunca se leía. Y «instagram.com/herasmedia» sin https caía en la misma
  regla y se guardaba como su landing. Un sitio ahora pide un dominio de primer nivel de verdad (`esDominio`).
- ⚠️ **El link de un canal de YouTube no traía la foto** aunque `channels.list` la devuelve en la misma respuesta que ya
  se pagaba (`snippet.thumbnails`): se tiraba. Ahora la confirmación y la ficha la usan.

**Y el @ exacto tardaba porque se preguntaba en fila:** la Meta del negocio (hasta 12 s), la de la plataforma, Google y
recién Apify. De once negocios con Meta, uno tiene permisos de Instagram: las esperas de adelante casi nunca traían nada.
Con la clave de Spy, Apify va primero (`leerExacto`). El actor en sí sigue tardando unos segundos: eso no se arregla
desde acá, y por eso la pantalla no promete «inmediato».

**Sin probar contra el servicio de verdad** (la nube no llega a Apify ni a Google): la forma de la descripción de Google
(«492K Followers» en inglés, «492 mil seguidores» en español: el lector entiende las dos), cuánto tarda una corrida de dos
páginas, y que el lector de perfiles acepte cinco usuarios en una corrida con `maxItems` 5.

**Vive en:** lib/spy-buscar-reglas.ts · lib/spy-buscar.ts · app/api/competitor-spy/buscar/route.ts ·
app/competitor-spy/BuscadorAlta.tsx · lib/instagram-perfil-server.ts (`leerPerfilesEnLote`) · lib/spy-que-es.ts ·
lib/spy-youtube.ts (`leerCanalCorto`) · tests/spy-buscar.test.ts · tests/instagram-perfil-fuentes.test.ts

## La ficha automática: lo que no daba error (4/11/2026)

> Martín, 4/11: «la IA ya debería analizar por sí sola todo, sin pedirlo… muchas veces aparecen tarjetas vacías sin la
> miniatura, y segundos después, cuando la animación ya empezó, ahí aparece la miniatura».

**El diagnóstico obvio era el equivocado, dos veces:**
- ⚠️ **Las tarjetas vacías de la animación no eran miniaturas rotas: eran miniaturas que todavía no habían llegado.** La
  película esperaba 700 ms a que se pudieran pintar, y empezaba igual. Las de Instagram vienen del CDN de Meta y tardan
  más que eso. Ahora se bajan TODAS antes de arrancar (`new Image()` con el mismo `referrerPolicy` que la `<img>`, si no el
  CDN contesta 403), hasta 8 s, y la que no llegó entra con su texto. Mientras tanto se ve sólo la criatura.
- ⚠️ **Sospeché que un avatar PNG con transparencia rompía la comparación de fotos** (`grayscale().raw()` con dos canales,
  144 bytes, y `dHash` en null). Lo medí antes de escribirlo como hallazgo: con esta versión de sharp sale un solo canal.
  Quedó el test con un PNG con alfa, como red, y no la afirmación.

**Tres que callaban:**
- ⚠️ **El análisis «a pedido» caía a la IA de la plataforma.** Sin la clave de Claude del negocio, `analizarCompetidor`
  llamaba a `chatClaude`; no se gastaba porque el veto frena `spy`, pero el negocio con sólo su Gemini no podía analizar
  nada. Ahora es `chatCheapCascade` (su Claude, su GPT, su Gemini) y sin ninguna dice «Conecta tu…».
- ⚠️ **Mandar siempre «las primeras 40» repetía y pagaba lo ya leído**, y una pieza que la IA no devolvía quedaba
  pendiente para siempre (cada lectura la volvía a mandar). Ahora van sólo las pendientes, y lo que no volvió se marca
  leído sin datos (`ANALISIS_SIN_DATOS`). Y el ref se busca sin mayúsculas: un modelo que lo devuelve en minúsculas no
  encontraba la fila con `.eq('ref', …)`.
- ⚠️ **Una tanda que no dice qué promete borraba la oferta.** El análisis de 30 reels de una charla devuelve `promete`
  vacío, y se escribía encima del que había. `ofertaQueQueda` sólo pisa con una que trae algo.

**Regla:** lo que corre solo y en segundo plano necesita una marca de «ya lo hice» que no dependa de que la IA conteste
bien; si no, lo que falla una vez se paga en cada vuelta.

**Sin probar contra el servicio de verdad:** que el análisis automático con la IA de un negocio real termine en los 300 s
de la ruta (3 tandas de 30), y la búsqueda de redes completa contra Google y Apify (los dobles salen de las respuestas
medidas el 3/11).

**Vive en:** lib/spy-analisis-reglas.ts · lib/spy.ts (`analizarCompetidor`, `guardarAnalisis`, el sitio de la bio) ·
app/api/competitor-spy/analizar/route.ts · app/api/competitor-spy/redes/route.ts · lib/spy-otras-redes.ts ·
lib/spy-otras-redes-reglas.ts · lib/spy-foto-hash.ts · app/competitor-spy/redes-recordar.ts ·
app/competitor-spy/OrdenSpy.tsx · app/competitor-spy/SpyApp.tsx · tests/spy-analisis.test.ts · tests/spy-otras-redes.test.ts

## «No me hizo la caricatura»: no fallaba la generación, nadie la pedía (4/11/2026)

> Martín (por el Cerebro): «me traje a @den.borgg y no me hizo la caricatura como habíamos quedado».

**El diagnóstico obvio era el equivocado:** «falla Flow». `pedirCaricatura` (lib/spy-caricatura-flow.ts) estaba escrita
desde el 3/11 con su prompt aprobado, y **no tenía un solo llamador**: compilaba, tenía sus comentarios y nunca corría. Le
faltaban dos cosas que nadie tenía: los `rasgos` que el prompt exige y quién la disparara.

**Y debajo había otro que tampoco daba error:** el pedido iba con una ruta propia (`spy/caricaturas/…`) para guardarla en
el bucket de Spy, pero la cola sólo le firma la subida al puente si la ruta pasa `RUTA_SUBIDA` (`firmarSubidas`,
lib/flow-cola.ts). Con la propia, el puente no subía nada y lo único que volvía era la url de Flow, que vence en una
hora. Ahora va con `rutaDeSubida` y el servidor la copia al bucket de Spy.

**Regla:** una función que hace algo caro y lo hace bien no está terminada hasta que alguien la llama; antes de dar por
«ya existe» una pieza, `grep` de sus llamadores.

**Sin probar contra el servicio de verdad:** la caricatura entera (la IA mirando la foto, el puente de Flow tomando el
pedido). La nube no llega a ninguno de los dos.

**Vive en:** lib/spy-caricatura-auto.ts · lib/spy-caricatura-reglas.ts · lib/spy-caricatura-flow.ts ·
app/api/competitor-spy/caricatura/route.ts · lib/spy.ts (`listarCompetidores`) · app/competitor-spy/SpyApp.tsx ·
tests/spy-caricatura-auto.test.ts

## Traer todo: la lectura de siempre iba a borrar el historial (4/11/2026)

> Martín, 4/11: «que no traiga solo 50 reels o videos, que traiga muchos más, si puede, todos directamente».

**El diagnóstico obvio era el equivocado:** «sube el número». Subir los 50 a 500 en la lectura de siempre se cae a los
60 s de la ruta (cien publicaciones tardan uno o dos minutos en Apify), y además rompe otra cosa que no daba error.

⚠️ **`marcarDejadas` marcaba como «borrada» toda pieza que no viniera en la lectura**, sin mirar hasta dónde llegaba esa
lectura. Con una lectura que trae lo último y una corrida larga que trae años, cada «Revisar ahora» habría marcado todo el
historial como «borradas» (y ya pasaba en YouTube: un canal que publica Shorts a diario sacaba de la ventana videos que
seguían ahí). Ahora cuenta sólo lo publicado desde lo más viejo que trajo la lectura, y una pieza sin fecha no se marca
(`seFueron`).

**Y dos que callaban:** `listarPiezas` cortaba en 200 con un `.limit` (con todo lo traído, la ficha mostraba una parte
sin decirlo), y la lectura de YouTube dejaba de paginar al tener 20 largos: «todos» nunca habría pasado de ahí.

**Regla:** lo que marca algo como «se fue» tiene que saber hasta dónde miró. Una ausencia sólo es evidencia dentro de la
ventana que se leyó.

**Sin probar contra el servicio de verdad:** las corridas largas de Apify (empezar, mirar, leer el dataset) y el actor
de anuncios entero, que queda apagado hasta medirlo con `scripts/probar-anuncios-apify.mjs`.

**Vive en:** lib/spy-todo-reglas.ts · lib/spy-todo.ts · app/api/competitor-spy/todo/route.ts · lib/spy.ts
(`marcarDejadas`, `listarPiezas`, `vistaDeInstagram`) · lib/spy-youtube.ts (`PAGINAS_COMPLETAS`) ·
lib/instagram-perfil.ts (`piezasDeApify`) · scripts/probar-anuncios-apify.mjs · tests/spy-todo.test.ts

## El detalle en un gráfico: los formatos no se iban a llenar nunca (4/11/2026)

> Martín, 4/11 (puntos 7 y 9): «quiero que eso sea el Detail de cada competidor… como va poniendo todos sus contenidos en un
> gráfico» y «debería fácilmente estar el botón de "Copiar estructura"». La especificación, en el diseño §15.

⚠️ **«¿Qué formatos le funcionan?» habría quedado vacío para todo competidor que ya existía.** La IA del negocio le pone el
formato a cada pieza al analizarla, y una pieza ya analizada no se vuelve a mandar (`faltaAnalisis` miraba sólo «¿hay un
análisis?»). Sin nada que lo dijera: la sección no se dibuja cuando no hay formatos, que es lo correcto para un competidor
nuevo y una mentira para uno viejo. Ahora un análisis sin formato cuenta como pendiente UNA vez (`guardarAnalisis` escribe
siempre un formato, `otro` si la IA no lo vio, y `ANALISIS_SIN_DATOS` también lo trae), y va DESPUÉS de lo que nunca se leyó.

**Una escala logarítmica con el tope en una potencia de 10 exacta sumaba una década vacía.** El techo se calculaba con
`ceil(log10(max) + 1e-9)`: con 10.000 de máximo daba 10^5, y todo el gráfico quedaba aplastado en la parte de abajo. Lo cazó
el test que pide que 100, 1.000 y 10.000 queden a la misma distancia; va `- 1e-9`.

**«Corto» ya estaba definido:** la primera versión de `tipoParaCopiar` decidía un short con su propia expresión (hasta 60 s)
y el resto de Spy usa `esShort` (hasta 180 s, la regla de YouTube desde 2024): un video de dos minutos era un short en la
ficha y un video largo al copiarlo. Ahora los dos preguntan `tipoDeContenido`.

⚠️ **Cruzar el ancho del teléfono reiniciaba el gráfico entero.** La primera versión volvía a la criatura (`bajadas = null`) cada vez
que cambiaba lo que se dibuja, y la muestra depende del ancho (180 miniaturas en la computadora, 90 en el teléfono): rotar una
tableta o achicar la ventana volvía a bajar todo y a correr la animación desde cero. No lo mostraba ningún test: lo mostró una
captura de página entera en Chromium, que cambia el tamaño de la vista, con las 89 animaciones otra vez en su primer cuadro. Ahora
cada miniatura se pide UNA vez y lo bajado se acumula, y la animación corre una vez por gráfico (su tipo y su red); un cambio a mitad
de camino la corta y deja cada una en su lugar.

**La precarga de las miniaturas era una copia por animación.** La película del orden ya la tenía escrita adentro; el gráfico
la necesitaba igual. Se mudó a `app/competitor-spy/precarga.ts` y la usan las dos.

**«Copiar estructura» no abre una tab que a quien mira no le corresponde:** la ruta de Spy pregunta la puerta del Copywriter
(`esAdminDeTab('copywriter')` + `veCopywriter()`), y sin ella devuelve el texto para el portapapeles. Una tarjeta que abre el
detalle es un `div` con rol de botón, no un `<button>`: adentro van bloques.

**Lo que no va, a propósito:** la «Anatomía del guion» y la curva de «siguen mirando» del video. No hay guion de un video
ajeno ni retención pública: un bloque sin datos no se dibuja.

**Sin probar contra el servicio de verdad:** que la IA del negocio devuelva el formato con la forma pedida (se lee por valor o
por nombre, con o sin tildes), el gráfico en pantalla con un competidor real, y la página nueva del Copywriter.

**Vive en:** lib/spy-detalle.ts · app/competitor-spy/GraficoSpy.tsx · app/competitor-spy/DetallePieza.tsx ·
app/competitor-spy/precarga.ts · app/api/competitor-spy/copiar/route.ts · lib/spy-analisis-reglas.ts (`faltaAnalisis`) ·
lib/spy.ts (`leerAnalisis`, `guardarAnalisis`, `leerPieza`) · tests/spy-detalle.test.ts

## «Pongo un espacio y sólo me trae Instagram»: YouTube tiraba los videos de Google (4/11/2026)

> Martín, 4/11: «pongo un espacio… solamente me trae Instagram. Es como que directamente ya no busca a usuarios de
> YouTube… debería buscarlos, tanto por nombre de usuario, por arroba, por link».

**La causa, medida en el código:** con un nombre de varias palabras, YouTube salía SÓLO de Google (`"nombre"
site:youtube.com`), y `canalesDeGoogle` tiraba todo resultado que fuera un video (`/watch`, `/shorts`, `youtu.be`)
porque «un video no dice de qué canal es sin leerlo». Es casi todo lo que Google devuelve para esa consulta: el grupo de
YouTube quedaba vacío. Y dos más que lo empeoraban: el nombre pegado se probaba como @ en Instagram y no en YouTube, y
sin la clave de la YouTube Data API la lectura de un canal devolvía `null` igual que «no existe», así que la lista se veía
completa sin serlo.

**Lo que quedó:** los videos de Google se leen con `videos.list` (1 unidad por todos, sin `search.list`) y se ofrece el
canal de cada uno; un nombre prueba también su @ en YouTube; y el grupo de YouTube dice qué pasó cuando no trae a nadie
(«Ningún canal con ese nombre», «No pude buscar en YouTube», «Conecta Apify…»).

**Regla:** un filtro que tira lo que no entiende tiene que medirse contra lo que la fuente devuelve de verdad. «Un video no
es un canal» era cierto y dejaba la fuente vacía.

**Sin probar contra el servicio:** que Google traiga videos con esa forma para un nombre real, y la lectura de
`videos.list` con la clave de la plataforma.

**Vive en:** lib/spy-buscar-reglas.ts (`planDeBusqueda`, `videoDeUrl`, `videosDeGoogle`, `youtubeEstado`) ·
lib/spy-buscar.ts (`leerCanalHallado`, `canalesDeLosVideos`) · lib/spy-youtube.ts (`canalesDeVideos`,
`leerCanalesDeVideos`) · app/api/competitor-spy/buscar/route.ts · app/competitor-spy/BuscadorAlta.tsx · tests/spy-buscar.test.ts

## «12 publicaciones de 500, y no buscó su YouTube ni su web»: la traída larga callaba, y su web era su página de enlaces (4/11/2026)

> Martín, 4/11: «tampoco está haciendo el ejercicio de buscar en YouTube y también buscar su web… Yo busqué literalmente el
> usuario exacto y ya me apareció el primer resultado… y en correlación mirar las biografías para traer sus webs».

**Lo que midió el Cerebro en producción:** Den Borg (ws 9, competidor 17) llegó a 255 publicaciones con la traída larga: la
traída SÍ anda cuando se la empuja. El de 12 es OTRO competidor (id 13, ws 11). El 17 tenía `youtube_id` vacío y su «web»
era `beacons.page/denborg`, una página de ENLACES.

**Las causas, medidas en el código (ninguna da error):**
- **La traída larga sólo avanzaba con la ficha abierta.** La pantalla pregunta cada 20 s y deja de preguntar a los 15
  minutos; sin nadie mirando, una corrida terminada no se recogía nunca. → Cron de cada hora (`/api/cron/spy-todo`).
- **Una corrida que terminaba SIN NADA contaba como la de la semana.** Apify contesta «terminé» también cuando Instagram no le
  dio nada (los ítems vienen como `{ error, errorDescription }`): el competidor quedaba siete días con lo de la lectura de
  siempre (12), sin una línea que lo dijera. → Se anota para mañana, y la pantalla lo dice.
- **El `porque` de la traída se calculaba y no se mostraba.** «Sin clave», «sin cupo» o «Apify no trajo nada» llegaban a la
  pantalla y no se dibujaban. → Una línea suave debajo del competidor (`avisoDeTraida`).
- **Sus otras redes salían sólo de Google, y Google trae videos** (el mismo bug de la búsqueda: se tiraban). Y nadie probaba
  su MISMO usuario en la otra red, que es lo primero que hizo Martín a mano.
- **Una página de enlaces (beacons, linktr.ee…) se guardaba como su web**, y su web de verdad estaba adentro, sin leer.

**Lo que quedó: `cadenaDeRedes` (lib/spy-cadena.ts), de lo más barato a lo más caro, sin escribir nada:** (1) lo que él
enlaza en su bio y lo que enlaza su página de enlaces (se ABRE con `fetchSeguro`; los enlaces que la página dibuja con
JavaScript se leen de sus datos) — eso es seguro; (2) su mismo usuario en la red que falta (`@den.borgg` y `@denborgg`, 1
unidad de YouTube) — entra solo con su mismo nombre o su misma foto, si no se pregunta; (3) Google, SÓLO si todavía le falta
Instagram o YouTube, y los videos se leen como su canal. La bio de Instagram ya viaja en la lectura compartida (`perfil.bio`,
`perfil.web`), así que la cadena no vuelve a pedir el perfil. Su web se guarda sólo si no tenía o la que tenía era su página de
enlaces (`ponerWebEncontrada`, compare-and-set).

**Y uno que apareció al poner el cron: el tope de 6 corridas largas por día vivía en la MEMORIA del proceso.** Con la ficha
abierta, todas las preguntas caían en la misma instancia y alcanzaba; con un cron de cada hora, cada vuelta puede caer en una
instancia nueva que arranca en cero, y el tope dejaba de topear sobre la clave del negocio. Ahora se reserva en la base
(`spy.todo.dia`, compare-and-set) ANTES de empezar la corrida.

**Regla:** un contador que protege plata vive donde lo ven todas las instancias. Uno en memoria sirve mientras un solo
proceso hace el trabajo, y deja de servir en silencio el día que se le suma un cron.

**Sin probar contra el servicio:** que beacons.page sirva sus enlaces sin JavaScript (se probó con una página armada con las
dos formas), que Apify devuelva los ítems de error con esa forma, y el cron en Vercel.

**Vive en:** lib/spy-cadena.ts (`cadenaDeRedes`) · lib/spy-otras-redes.ts (`buscarOtrasRedes`) · lib/spy-otras-redes-reglas.ts
(`esAgregador`, `enlacesDeHtml`, `loQueEnlaza`, `usuariosParaProbar`, `veredictoDe`) · lib/spy.ts (`ponerWebEncontrada`) ·
lib/spy-reglas.ts (`canalDeLaBio`) · lib/spy-todo.ts (`reservarCorrida`) · lib/spy-todo-reglas.ts (`usadasHoy`,
`avisoDeTraida`) · app/api/cron/spy-todo/route.ts · app/api/competitor-spy/redes/route.ts · app/competitor-spy/SpyApp.tsx ·
tests/spy-cadena.test.ts

## La caricatura por cola: la hace el Runner con Canva, y el camino de Flow se borró (4/11/2026)

> Martín, 4/11 (por el Cerebro): «cada vez que se genere un nuevo competidor, hacer una especie de levantar un ticket
> para generar esa imagen y ya con eso se pone la imagen ahí».

**Por qué se cambió de camino:** el de antes (la IA del negocio describía la cara y el puente de Google Flow la generaba)
no salió **ni una vez** en producción: el Cerebro midió que todos los puentes estaban sin sesión, así que la pantalla lo
pedía, se rendía callada y la tarjeta quedaba con la foto. Y le cobraba al negocio dos veces. Se borró entero (motor, ruta
y el bucle de la pantalla), para no dejar dos caminos vivos.

**Lo que quedó:** al leer un competidor con su foto ya en NUESTRO Storage, queda pendiente en `spy.caricaturas`; el Runner
la lista (`spy-caricaturas-pendientes.mjs`: sólo ws, id y la URL de la foto) y la guarda (`spy-caricatura-guardar.mjs`). El
contrato, en docs/relevo/nube-spy.md. Una sola lógica para el servidor y los scripts: lib/spy-caricatura-cola.ts, sin
`server-only` y con lo que habla con la base inyectado, así el test corre la cadena entera.

**Tres decisiones que no se ven en el código:**
- **Una caricatura por PERSONA, no por negocio.** Se guarda por su cuenta (`spy/caricatura/instagram-den_borgg.png`) y se
  marca lista en todo competidor con la misma red y el mismo usuario; los que comparten una cuenta son un grupo (también
  encadenado: A y B comparten Instagram, B y C YouTube) y el grupo se lista una vez. Lo único que cruza negocios es la
  imagen: nunca quién mira a quién.
- **Los fallos se juntan en UNO.** La primera versión elegía «el que entró primero a la cola»: con el fallo anotado en el
  competidor del negocio del lado, la próxima vez se le pedía al otro, que arrancaba en cero — tres intentos por negocio
  en vez de tres por persona. Ahora se elige primero al que ya falló (lo cazó el test 5b, escrito porque esa rotura daba
  verde).
- **«No hay Canva» no es un fallo.** Canva depende de la cuenta de Claude del Runner: sin él no se anota nada y la
  pendiente espera. Lo que lo delata es `masVieja` (la fecha de la pendiente más vieja) creciendo en la lista del super
  admin; la pantalla no dice nada.

**La receta, medida por el Cerebro con Den Borg (~30 s):** `upload-asset-from-url` → `generate-image` con
`imageReferences` y `SQUARE_1_1` → `get-generate-image-job` hasta `SUCCESS` → `get-assets`. **El conector entrega una vista
de 200 × 200 aunque el original mida 1264**: el tamaño se LEE del archivo (`medidasDeImagen`) y no se supone. Y **el prompt
aprobado dice «the man»**: Den Borg es una mujer, así que el género y los rasgos los completa el Runner mirando la foto,
nunca un texto fijo.

**Regla:** cuando un proveedor entrega «una vista» de un archivo, el tamaño se lee de los bytes que llegaron, no del
original que se pidió.

**Sin probar contra el servicio:** los scripts contra la base de producción (la primera prueba es Den Borg, ws 9,
competidor 17) y la búsqueda por prefijo del Storage (`caricaturaGuardada`).

**Vive en:** lib/spy-caricatura-reglas.ts (`estadoEnCola`, `colaDeCaricaturas`, `mismaPersona`, `medidasDeImagen`,
`caraDeTarjeta`) · lib/spy-caricatura-cola.ts (`encolarCaricatura`, `listarCola`, `guardarCaricatura`, `anotarFallo`) ·
lib/spy-caricatura-servidor.ts (`encolarAlLeer`) · lib/spy-miniaturas.ts (`caricaturaGuardada`) · lib/spy.ts
(`mirarCompetidor`) · scripts/spy-caricaturas-pendientes.mjs · scripts/spy-caricatura-guardar.mjs ·
scripts/spy-caricatura-base.mjs · app/competitor-spy/SpyApp.tsx · tests/spy-caricatura-cola.test.ts

## «Sugeridos»: los competidores de la plataforma en todos los negocios, sin cobrarle a nadie (4/11/2026)

> Pedido de Martín (por el Cerebro, 4/11): los que carga el negocio de la plataforma aparecen en todos los negocios como
> catálogo «Sugeridos», sin cobrarle al cliente; se suman a su lista sin duplicarlos, y nunca se ven los de otro cliente.

**Lo que quedó:** un bloque «Sugeridos» debajo de los competidores (también cuando el negocio todavía no mira a nadie), con
la misma tarjeta y «Sumar». Sumarlo COPIA lo que la plataforma ya leyó (sus publicaciones vivas, su foto, sus números y su
caricatura si ya está hecha) y deja anotada la traída larga como hecha hoy: no se le pide nada a Apify ni a YouTube con la
clave del negocio. Lo nuevo, después, sigue las reglas de siempre (la lectura compartida primero). En la API de MaKo:
`ver_sugeridos` y `sumar_sugerido`, por el mismo camino que la pantalla.

**Tres cosas que no se ven en el código:**
- **Sólo la plataforma, y por capa.** El negocio de la plataforma sale de `wsSuperAdmin()` (capa `superadmin`), nunca de
  un 9 escrito; y cada fila se vuelve a mirar contra ese negocio (`soloDeLaPlataforma`), así una consulta mal filtrada no
  alcanza para que se cuele a quién mira otro cliente. El test lo prueba con una base que devuelve filas de todos.
- **Los anuncios no se copian.** Lo traído de la Biblioteca de Anuncios no se le pasa a un tercero (los términos de Meta
  no dejan transferir lo recolectado): el cliente trae los suyos con su propia lectura. Tampoco viaja la `oferta`: está
  escrita contra el negocio de la plataforma, no contra el del cliente.
- **Lo borrado no se copia como vivo.** Una pieza que la plataforma vio desaparecer (`dejo_de_verse_en`) no entra:
  copiada por `guardarVistas`, nacería como «a la vista».

**Lo que se resigna:** la fecha de «visto por primera vez» de lo copiado es la de hoy (la escribe sólo el insert de
`guardarVistas`, a propósito); la fecha de publicación sí viaja.

**Sin probar contra el servicio ni en pantalla:** el bloque no se dibujó con datos (la pantalla entera trae las actions
del servidor y no entra en el banco de prueba); usa las mismas clases que la tarjeta de los competidores.

**Vive en:** lib/spy-sugeridos.ts (`listarSugeridos`, `agregarSugerido`, `soloDeLaPlataforma`, `piezasACopiar`,
`esLaMismaPersona`) · lib/spy-sugeridos-server.ts · lib/spy-todo.ts (`marcarTraidaHoy`) · app/competitor-spy/actions.ts
(`sugeridosAction`, `sumarSugeridoAction`) · app/competitor-spy/page.tsx · app/competitor-spy/SpyApp.tsx
(`RejillaSugeridos`) · lib/api-mako/areas/spy.def.ts y spy.run.ts (`ver_sugeridos`, `sumar_sugerido`) ·
tests/spy-sugeridos.test.ts

## Los logos de cada red, uno solo en toda la tab, y «¿En qué publica?» por red y por formato (4/11/2026)

> Pedido de Martín (por el Cerebro, 4/11): los mismos logos de Instagram y YouTube que el buscador, en todos lados donde
> se ve la red de una pieza; y «¿En qué publica?» de verdad, sin «100% videos».

**La causa del «100% videos»:** el reparto contaba por el tipo GUARDADO, y todo lo de YouTube se guarda como `video`
(shorts y largos por igual): un canal de YouTube daba «100% videos» aunque la mitad fueran shorts. Ahora sale de
`tipoDeContenido` (reels, carruseles e imágenes, shorts, videos largos, anuncios), y por red con su logo
(`repartoDePublicaciones`). Su web no es una publicación: no entra al total.

**Los logos:** `LogoRed` vivía adentro del buscador y el resto dibujaba íconos genéricos. Ahora es una pieza
(app/competitor-spy/LogoRed.tsx) que usan el buscador, las miniaturas del gráfico (en la esquina), sus filtros, el
detalle de una pieza y «¿En qué publica?». ⚠️ Los logos de marca se dibujan con los `<symbol>` de `<BrandDefs>`: la
pantalla lo monta una vez, y el detalle también (va por portal). Sin eso, el logo sale vacío y sin error.

**De paso:** «Cada miniatura es un video» se fue (narraba lo que ya se ve); queda «Se ven N de M» sólo cuando hay más
piezas que miniaturas.

**Vive en:** app/competitor-spy/LogoRed.tsx · lib/spy-detalle.ts (`repartoDePublicaciones`) · app/competitor-spy/GraficoSpy.tsx
· app/competitor-spy/DetallePieza.tsx · app/competitor-spy/SpyApp.tsx (`RielAnalisis`, `CajaMix`) ·
app/competitor-spy/BuscadorAlta.tsx · tests/spy-logos.test.ts

## «Contenido» y «Funnel»: dos pestañas, el selector adentro del gráfico y cada miniatura con su proporción (4/11/2026)

> Pedido de Martín (por el Cerebro, 4/11), mirando la ficha en producción: sólo dos pestañas; el selector y los filtros
> adentro de la tarjeta del gráfico; cada miniatura con su proporción real; sin «Revisar ahora»; sin textos que narran
> lo que ya se ve; y la criatura de MaKo sin la tarjeta blanca detrás mientras analiza.

**Lo que quedó:**
- **Dos pestañas.** «Contenido» = el gráfico, sus piezas y sus anuncios debajo, con el riel al costado. «Funnel» = su web
  (con su funnel y «Copiar su sitio») y lo que se leyó de su oferta. «Miniaturas» se fue: las tarjetas de YouTube ya
  llevan su miniatura apaisada y su título.
- **El selector y los filtros de red van adentro de la tarjeta del gráfico**, arriba del dibujo.
- **Proporción real** (`proporcionDe`, `medidaEnElGrafico`): reel y short 9:16, publicación y anuncio 1:1, video largo y
  web 16:9. En el gráfico el lado más largo mide lo mismo para todas (un video apaisado no ocupa más lugar); en las
  tarjetas, el `aspect-ratio` de la imagen.
- **Sin «Revisar ahora».** Queda «Probar de nuevo» sólo cuando una lectura FALLÓ; «no encontré publicaciones» ya no
  ofrece releer.
- **Mientras carga, la tarjeta del gráfico no se dibuja** (`data-cargando`): la criatura queda sobre el gris de la página.

**Una trampa que no se ve:** un test (spy-orden, el 5) contaba DOS botones de releer apagados durante la película —
«Revisar ahora» y «Revisar de nuevo»—; sacar uno lo ponía rojo. Lo que cuidaba no era el número sino que ninguno se
pueda tocar mientras corre la animación: ahora afirma eso sobre el que queda.

**Sin hacer todavía:** el detalle de una pieza rediseñado con su transcripción (#10). «Funnel» con el analizador de
ofertas quedó en la entrada de abajo.

**Vive en:** app/competitor-spy/SpyApp.tsx (`Pestana`, el panel «Contenido») · app/competitor-spy/GraficoSpy.tsx ·
app/competitor-spy/TarjetaPieza.tsx · lib/spy-detalle.ts (`proporcionDe`, `medidaEnElGrafico`) · tests/spy-contenido.test.ts

## «Su oferta» con el analista de Offer: el mismo analista hablaba de «tú» y podía pagarlo MaKo (4/11/2026)

> Pedido de Martín (por el Cerebro, 4/11): «en "Su Funnel" debe "exponer" su OFERTA con el analizador de oferta que ya
> tenemos construido, y debe traer automáticamente sus web para analizarlas». Y del encargo: «IA: cada negocio paga la suya,
> y el crédito de Claude de la plataforma no se usa acá».

**Lo que quedó:** la pestaña «Funnel» dibuja, debajo de su web, el diagnóstico de Offer (`VistaDiagnostico`, las 9 notas
con su porqué, la tesis, lo que ya hace bien) y el puntaje que calcula el código. Lo trae sola la ruta
/api/competitor-spy/oferta al abrir un competidor con web: contesta en el acto, el trabajo sigue en un `after()` y la
pantalla pregunta cada 8 s mientras dice «leyendo», con la criatura. Sin botón. En la API, `su_oferta_con_notas` (lectura).

**Tres cosas que no se ven en el código:**
- **El analista de Offer escribe de «tú» al «dueño».** Su prompt es para diagnosticar la oferta PROPIA, y la regla de idioma
  dice «lo lee el dueño». Con la web de un competidor, el texto salía «tu promesa no dice…»: leído por otro negocio, parece
  hablar de la suya. No se armó otro analista: `bloqueOfertaDeOtro` (lib/offer-reglas.ts) se pega al system YA RENDERIZADO
  (si fuera un slot del template, un prompt editado en /configuraciones no lo tendría) y pide tercera persona y citas de su
  web. Los consejos para el dueño de esa oferta («Para subirla», «Lo primero que cambiaría», los avisos, lo que le falta
  para estar lista) no se dibujan: `VistaDiagnostico` con `deOtro`.
- **`pedir` de Offer prueba el crédito de Claude de la plataforma y la red de plataforma** cuando las claves del negocio no
  contestan, y con el onboarding en curso el crédito está habilitado para la feature `offer`. Sin un corte, un negocio
  recién llegado le pagaba a MaKo el diagnóstico de la oferta de un competidor. `soloDelNegocio` corta antes de los dos.
- **La landing que guarda Spy no tiene su texto** (`spy_piezas` canal `landing` guarda sus piezas y su funnel, no el
  copy). Su web se vuelve a bajar con la puerta de Offer: `extraerLanding(url, { talCual: true })` y, si un antibots frena
  a los servidores o casi no hay texto, el lector de afuera. No hay otro `fetch` de URLs.

**Se lee una vez y listo:** la huella del texto de sus webs (`huellaDe`) decide. A la semana se baja otra vez (no cuesta
IA) y sólo si cambió se diagnostica de nuevo; una web nueva se lee sola. Un fallo deja el motivo y el diagnóstico de antes,
y espera un día (una semana, a los 3 seguidos). Cada escritura es compare-and-set contra lo que escribió ESE trabajo:
un diagnóstico pesa 5-8 KB, así que `cambiarSettingSi` compara por `updated_at` y no por el valor en la URL.

**Sin probar contra el servicio:** que el modelo de un negocio real cumpla la tercera persona (es una instrucción en el
prompt: no hay un chequeo en el código que la corrija), y lo que trae la web de un competidor de verdad (un
constructor de páginas que arma todo con JavaScript cae al lector de afuera).

**Vive en:** lib/spy-oferta.ts · lib/spy-oferta-servidor.ts · app/api/competitor-spy/oferta/route.ts ·
app/competitor-spy/SuOferta.tsx · lib/offer-reglas.ts (`bloqueOfertaDeOtro`) · lib/offer-ia.ts (`deOtro`,
`soloDelNegocio`) · app/offer/Conclusion.tsx (`VistaDiagnostico`, `deOtro`) · tests/spy-oferta.test.ts

## «No estás trayendo la transcripción»: no había transcripción, y el video de cada reel se tiraba al leerlo (4/11/2026)

> Pedido de Martín (por el Cerebro, 4/11): «En cada uno de los videos cuando entro no estás trayendo la transcripción, y
> tampoco me gusta el modal que hiciste, rediseñalo bien… Tampoco me gusta el botón de copiar estructura».

**Medido en el código, por qué no llegaba:** no había un camino de transcripción. El detalle decía, en su cabecera, «el guion
de un video ajeno no se lee (no hay forma legal de transcribirlo)», y el dato que hacía falta se tiraba: Apify trae
`videoUrl` en cada reel y `piezaDeApify` (lib/instagram-perfil.ts) no lo copiaba. Guardarlo tampoco servía: el enlace del
CDN de Instagram VENCE en días.

**Lo que quedó:** al abrir el detalle de un reel, /api/competitor-spy/transcribir pide su video fresco a Apify (UNA
publicación, `videoDeUnaPublicacion` en lib/spy-todo.ts —el único archivo que puede tener la clave de Spy junto con los de
siempre—, con un tope de 40 por día contado en la base), lo baja por la puerta SSRF-segura y lo escucha la IA del negocio
(`transcribirAudio` con `pii` y `sinGroq`, como el audio de un anuncio). Mientras, «Transcribiendo…»; el guion queda en
`spy.transcripcion.<competidor>.<pieza>` y no se vuelve a pagar hasta que vence a los 30 días (el reloj del texto de una
pieza). Un reel sin voz queda dicho («es sólo música o imagen») y tampoco se vuelve a pagar.

**Tres trampas:**
- **Un mp4 cortado no se puede escuchar.** `pedirClavado` corta en su techo y devuelve lo leído (está bien para una web).
  Para un video, se pide un byte más que el tope y, si lo pasa, «pesa demasiado»: nunca se escucha medio archivo.
- **`.mk-btn` sin tamaño queda chico.** El botón de antes era `mk-btn mk-btn--primary` sin `--md` ni `--lg`: con la hoja
  real de la casa mide unos 20 px de alto, y eso era parte del «no me gusta». Ahora `mk-btn--lg`.
- **Un pedido que no contestó no es «transcribiendo».** Si la ruta falla, el bloque no se dibuja: un punto latiendo para
  siempre se lee como que algo está pasando.

**Lo que NO se hizo, y por qué:** el guion de YouTube. `captions.download` pide ser el dueño del canal (OAuth) y bajar el video
va contra sus términos; Martín decidió Apify «sólo para Spy» sobre Instagram. Queda como decisión suya (docs/relevo/nube-spy.md).

**Sin probar contra el servicio:** que el actor devuelva `videoUrl` para un enlace de reel (`directUrls` con un solo
enlace), cuánto pesa un reel de verdad y que la IA de un negocio escuche un mp4 de Instagram.

**Vive en:** lib/spy-transcripcion.ts · lib/spy-transcripcion-servidor.ts · app/api/competitor-spy/transcribir/route.ts ·
lib/spy-todo.ts (`videoDeUnaPublicacion`, `tieneClaveDeSpy`) · lib/spy-todo-reglas.ts · app/competitor-spy/DetallePieza.tsx ·
lib/spy-detalle.ts (`vecesSuMediana`) · tests/spy-guion.test.ts

## Tercera vuelta (Martín revisó con Den Borg, 4/11/2026): lo que el Cerebro midió desde la PC

**Vive en:** `app/competitor-spy/BuscadorAlta.tsx`, `lib/spy-otras-redes.ts`, `lib/spy-google-corrida.ts`, `lib/spy-cadena.ts`,
`lib/spy-todo.ts`, `lib/spy-todo-reglas.ts`, `app/competitor-spy/SpyApp.tsx`.

- **«Escribí tal cual @herasmedia y no me trajo al perfil».** La fila «Usar @x · Tal como lo escribiste» confirmaba sin leer: la
  tarjeta salía con una letra «H». No era Apify (40 de 40 corridas `SUCCEEDED`, el perfil se lee en 10 s): era el `elegir` del
  buscador. Ahora va por `elegirPerfil`, el mismo camino de un perfil hallado. Lo fija `tests/spy-buscador-alta.test.ts`.
- **«No pude buscar sus otras redes ahora».** El actor de Google tardó 57 y 48 s (las dos `SUCCEEDED`) y nosotros cortábamos a
  los 45: Apify terminaba y cobraba, y el resultado pagado se tiraba. Ahora la corrida se EMPIEZA asíncrona y se sigue 35 s; si no
  terminó, queda anotada en el negocio (`spy.google.<huella>`, sin el texto buscado) y el pedido siguiente la RETOMA sin pagar
  otra. La pantalla vuelve a pedir sola, sin texto. ⚠️ El cupo del día se gasta al EMPEZAR, no al retomar: por eso `gastar` pasó
  de la cadena a la búsqueda. Lo fija `tests/spy-google-corrida.test.ts`.
  - **La regla que queda:** con un proveedor que cobra por corrida, un `run-sync` con un timeout nuestro tira lo pagado cuando
    tarda más. Se empieza asíncrona y se anota el `run` antes de esperarla.
- **El crédito de Apify del negocio.** Plan FREE: US$5 por mes; una traída larga de 300 publicaciones costó US$0,69. La traída
  larga ahora lee `GET /v2/users/me/limits` y se achica a un cuarto de lo que queda por encima de una reserva de US$2 (lo de todos
  los días: leer, dar de alta, transcribir); si no alcanza, espera. Un 402 al empezar también es «sin crédito». Se le dice sólo al
  admin y sin cartel de error. Sin poder leer el crédito, sigue como siempre (no es «sin crédito»). Lo fija `tests/spy-todo.test.ts`.
- **La caricatura de Den Borg.** El camino de la tarjeta está bien y tiene su test de punta a punta. El hueco era otro: si la
  imagen no cargaba, la tarjeta quedaba sin cara. Ahora cae a su foto de perfil (`caerAFoto`).

## Tercera vuelta: la ficha de un competidor rediseñada (4/11/2026)

**Vive en:** `app/competitor-spy/SpyApp.tsx`, `app/competitor-spy/GrillaPiezas.tsx`, `app/competitor-spy/MejoresPiezas.tsx`,
`app/competitor-spy/BuscadorAlta.tsx`, `app/competitor-spy/GraficoSpy.tsx`, `app/competitor-spy/page.tsx`, `app/competitor-spy/precarga.ts`,
`lib/spy-vista.ts`, `lib/spy-detalle.ts`, `lib/spy-buscar-reglas.ts`.

Martín, con Den Borg en producción. Lo que se hizo, pedido por pedido (lo fija `tests/spy-ficha-tercera.test.ts`):

- **«Agregar YouTube» abría un campo con un botón.** Ahora es el MISMO buscador del alta (`BuscadorAlta` con `para`): arranca con
  su nombre sin lo que va después de « - » (`nombreParaBuscar`) y muestra sólo la red pedida (`gruposPermitidos`); desde el menú,
  sólo sus redes, sin «Ya los miras» ni «Sin redes».
- **Volver a todos los competidores** era una miga de 18 px en gris. Ahora es un botón con la flecha y las caras de los demás, y al
  lado el cambio directo a otro (copiado del «←» de la cabecera de un ítem en Shopify y Linear).
- **El ⋯ del perfil, arriba a la derecha.** ⚠️ El `Dropdown` de la casa toma `width` para el BOTÓN: con `width={210}` el ⋯ quedaba
  encima del texto. Va `width={40}` y `menuMinAncho={210}`.
- **La grilla de sus piezas: a todo el ancho y por páginas** (`GrillaPiezas`). Antes vivía al lado del riel y crecía de a 60: con
  160 piezas, 13.600 px de página. Ahora una página son filas enteras (`columnasQueEntran` × 3), y el paginador nunca esconde
  una sola página detrás de «…» (`botonesDePaginas`).
- **«Lo que mejor le fue», al lado de los formatos.** Cierra el riel y se estira hasta donde terminan los formatos; si el riel es
  más alto, se estiran los formatos. ⚠️ Para que la caja se estire sin empujar la grilla, la tarjeta va en `position: absolute`
  dentro de una caja `flex: 1`: en flujo normal le sumaría su alto a la columna y nunca «llegaría» al final. Se ordena por cuántas
  veces la mediana de SU grupo hizo cada pieza (`mejoresPiezas`): un short y un video largo no se comparan en vistas crudas.
- **Los anuncios, dentro de Contenido**, como un formato más del desplegable (`tipoEnLaGrilla`). `tipoDeContenido` no los nombra a
  propósito: lo usan los gráficos, que los agrupan aparte.
- **La entrada:** las miniaturas se acomodan en una grilla en el centro, de la mejor a la peor, y cada una vuela a su lugar en el
  gráfico (~1,6 s, el mismo gesto de antes con otro origen). La película de «ordenar» (6 s) sigue sólo después de una lectura pedida.
- **En el teléfono**, el riel con `flex-wrap: wrap` en columna hacía que la base de 280 px fuera un ALTO: las tarjetas quedaban con
  un hueco abajo (los seguidores, 223 px para 107 de contenido). Va `nowrap`.

### La velocidad, medida (vista de prueba, no producción)

Con la misma vista de la ficha (`SpyApp` con 166 piezas de Den Borg inventadas), con una demora simulada de 700 ms para traer las
piezas y miniaturas que tardan entre 0,2 y 2,8 s, en Chromium a 1440 px, 3 vueltas cada una:

| | Gráfico dibujado | Elementos en la página | Tarjetas en la grilla |
|---|---|---|---|
| Antes | 3,84 – 3,99 s | 2.369 | 66 |
| Después | 3,17 – 3,22 s | 1.664 | 15 |

Lo que bajó: las piezas del competidor abierto llegan con la página (antes se pedían por una action DESPUÉS de hidratar, y las
actions hacen fila), las cuatro lecturas del server van en paralelo, y la grilla dibuja una página y no 60 tarjetas. Lo que NO
mide esta vista: la red real del CDN de Meta. Por eso el tope de espera de las miniaturas bajó de 8 a 3 s (las que no llegan entran
con su texto, sin cajas vacías). ⚠️ En producción hay que medir lo mismo con un competidor real: es lo que pidió el Cerebro.

## Tercera vuelta: sus anuncios por su nombre, y verificados (4/11/2026)

**Vive en:** `lib/spy-funnel.ts` (`busquedaDeSusAnuncios`, `enlaceSusAnuncios`), `lib/spy-captura.ts` (`anunciosDeQuien`).

Martín, con Den Borg: «En su biblioteca de anuncios la buscó como su página [su web], cuando debió buscarla por su Instagram, todo
el mundo publicita con su cuenta personal, o de última con el nombre del negocio... Y darse cuenta si es o no es». La captura del
Cerebro: la Biblioteca abierta con `q="beacons.page"`, 54 anuncios de cualquiera.

- **La causa era doble.** El enlace buscaba el dominio de su web ANTES que su nombre, y su web era una página de enlaces (Beacons):
  es de todos. Y la verificación (`anunciosDeQuien`) daba por suyo cualquier anuncio que mandara a ese dominio, así que una captura
  de esa búsqueda guardaba anuncios ajenos. Además comparaba la Página con su nombre ENTERO («Den Borg - Estrategia de Marca
  Personal»), que ninguna Página tiene.
- **Ahora:** el enlace busca su nombre corto (el de su perfil, sin lo que va después de « - »: así se llama la Página con que pauta),
  después su @, y su web sólo si es SUYA. Un anuncio es suyo por su Página (el nombre entero, el corto o su @), por su Página
  guardada, o por mandar a SU web; mandar a una página de enlaces no dice nada (del anuncio sólo se guarda el dominio al que manda).
- ⚠️ **No medido:** si la búsqueda por frase exacta de la Biblioteca encuentra a la Página por su nombre o sólo el texto de los
  anuncios. Lo que sí está garantizado es que lo que se GUARDA pasa la verificación. Con su Página guardada (`pagina_anuncios`
  con un id) el enlace va directo a ella.
- **La regla que queda:** un dominio identifica a alguien sólo si es suyo. Una página de enlaces, un checkout (Hotmart) o una
  plataforma (Skool) son de miles: antes de comparar por dominio, se pregunta `esAgregador`.

Lo fijan `tests/spy-captura.test.ts` y `tests/spy-funnel.test.ts` (los dos, probados rompiéndolos).

## Tercera vuelta: qué funnel usa, con evidencia, y sus páginas al final (4/11/2026)

**Vive en:** `docs/catalogo-funnels-y-formatos.md` (la investigación, con fuentes, y su tabla §4), `lib/spy-catalogo-leer.ts`,
`lib/spy-catalogo-datos.ts` (GENERADO con `node --import tsx scripts/spy-catalogo-a-codigo.mts`), `lib/spy-funnel-tipo.ts`,
`lib/spy-oferta.ts` (`enlaces`, `paginas`), `app/competitor-spy/SuFunnelTipo.tsx`, `SuOferta.tsx`, `SusPaginas.tsx`.

Martín, con Den Borg: «Quiero que se analice qué funnel utiliza... denborg es obvio que hace funnel de eventos presenciales... la
oferta debería ir arriba... no pongas nada abajo de las web». El Cerebro: la clasificación sale del catálogo y con evidencia de sus
piezas, no por adivinanza.

- **El catálogo es la fuente y el código lo lee, no lo copia.** 22 funnels y 19 formatos, cada uno con frases fuertes, débiles, lo
  que lo descarta y los hosts que lo delatan. La tabla del documento se convierte en `lib/spy-catalogo-datos.ts` con un script, y
  `tests/spy-funnel-tipo.test.ts` falla si los dos se separan. Una línea de «qué es» por funnel (`que:`) es lo que se dibuja.
- **Sin evidencia, «no sé».** Una frase fuerte alcanza; sin fuerte hacen falta dos débiles distintas de DOS piezas distintas (un post
  con «conferencia» y «speakers» puede ser la conferencia de otro). Una pieza que dice «por Zoom» baja sus fuertes a débiles, sus
  palabras sueltas no cuentan y no confirma como «otra pieza»: sin eso, dos posts de un seminario online daban «evento presencial».
- **La compuesta que decide a Den Borg es «fecha + entradas»** («22 de noviembre… últimos boletos»): ninguna frase fija la cubre.
- **Su página de enlaces no es su web: es una lista.** De Beacons o Linktree se leen las páginas que enlaza (hasta 3) y se guardan
  todas (hasta 8) para «Sus páginas». Leer la página de enlaces daba un diagnóstico de su lista de botones.
- **Una lectura de antes no tenía el texto de sus páginas** (la evidencia del funnel): `hayQueLeer` la vuelve a leer UNA vez. Con el
  mismo texto la huella es la misma y la IA no se paga de nuevo; con una página de enlaces sí (ahora se leen otras páginas).
- **La vista previa es la del Diagnóstico del Web Generator** (`srcPaginaDiagnostico`, `sandbox="allow-scripts"`), con su puerta: el
  admin y esa tab en el plan (`conVistaPrevia`, la pide la página). Sin eso, la tarjeta con «Abrir».
- **La oferta, partida en dos:** arriba, al lado del funnel, el puntaje en un anillo, la tesis como titular, lo más flojo, lo que
  vende y lo que ataca y tu oferta no dice; abajo, las 9 notas. La tesis va una vez (al diagnóstico de abajo se le pasa sin ella).
- **Por API:** `que_esta_haciendo` dice qué funnel usa, con su evidencia marcada como contenido de un tercero.
- ⚠️ **Trampa de la verificación:** una captura de página entera de Playwright dibuja en blanco un iframe que sí cargó; se mira con
  la página quieta (`fullPage: false`) y bajando hasta él.
- ⚠️ **No medido:** los formatos nuevos del catálogo (caso de éxito, mito, recap de evento…) todavía no los usa el análisis de piezas
  (`FORMATOS`, lib/spy-detalle.ts): va en otra punta. Y lo que diga el funnel con un competidor real hay que mirarlo en producción.

Lo fija `tests/spy-funnel-tipo.test.ts` (11 casos, nueve roturas probadas: catálogo, compuesta, descarte, débiles de dos piezas,
host, landing repetida, página de enlaces, la vuelta y «nada debajo de sus páginas»).

## Tercera vuelta: los formatos del catálogo, para la IA y sin ella (4/11/2026)

**Vive en:** `lib/spy-detalle.ts` (`FORMATOS`, `GUIA_DE_FORMATOS`, `formatoPorTexto`, `formatosDe`), `lib/spy.ts` (el prompt del
analista), `lib/prompt-registry.ts` (el slot `formatosQueSon`), `app/competitor-spy/DetallePieza.tsx`.

Martín: «Tanto para funnels como para formatos de contenido al momento de clasificar "lo que le funciona" quiero que hagas una
investigación profunda de todos los tipos de formatos».

- **Los formatos son los 19 del catálogo** (§3 del documento: tutorial, lista, storytime, POV, antes y después, testimonio, caso
  de éxito, opinión, mito, reseña, detrás de escena, recap de evento, entrevista, preguntas, reacción, tendencia, frase, promoción
  y otro). Antes eran 11 y la IA no sabía qué era cada uno: recibía sólo los ids. Ahora recibe una línea por formato
  (`{{formatosQueSon}}`). Un prompt editado en /configuraciones antes de esto no tiene el slot: sigue andando con los ids.
- **Lo que la IA no clasificó se lee del texto, sólo con una frase clara** del catálogo («POV:», «antes y después», «7 errores»).
  Las débiles no cuentan: «antes de grabar… después» no es un antes y después. Sirve sin IA conectada y para lo analizado antes,
  que quedó «otro». El detalle de la pieza dice el mismo formato que la cuenta.
- ⚠️ **Lo que costó esta vuelta:** el `tsc` acotado se corrió con una LISTA de archivos escrita a mano y dejó afuera
  `lib/api-mako/areas/spy.run.ts`, donde un script de Python había escrito un `\n` real adentro de un texto: la punta salió sin
  compilar (se arregló en `00b329e8`). **Se corre con `--rama`**, que toma todo lo que la rama cambió. Y en un script que escribe
  código, un `\n` que tiene que quedar escrito va `\\n` (o el texto entre comillas triples crudas).

Lo fija `tests/spy-formatos-catalogo.test.ts` (4 casos, cuatro roturas probadas: falta un formato, falta el slot, se aceptan las
débiles, la cuenta mira sólo a la IA).

## Una página que nos bloquea: se respeta, sin cartel técnico (4/11/2026)

**Vive en:** `lib/landing-extraer.ts` (`esDesafioDeBot`), `lib/landing-fetch.ts`, `app/api/competitor-spy/pagina/route.ts`,
`app/competitor-spy/SusPaginas.tsx`.

Martín, con una captura de «Sus páginas» de Den Borg: la vista previa decía «La página respondió 403: está bloqueando la lectura
automática.». Textual: «Y revisa esto, que no se bloquee, y que funcione todo». Medido por el Cerebro desde la PC:
`beacons.page/denborg` redirige a `beacons.ai/denborg`, y ése contesta el «Just a moment...» de Cloudflare con y sin
User-Agent de Chrome: un desafío que pide ejecutar JavaScript.

- **El cartel salía porque la ruta del iframe dibuja su error ADENTRO del iframe**, y desde la pantalla no se ve. Ahora la pantalla
  pregunta antes (`/api/competitor-spy/pagina`, la misma lectura de siempre): si abre, el iframe; si no, sólo «Abrir» para verla en
  el navegador de la persona. Mientras pregunta, la carga de la casa. El porqué queda en el log y no viaja a la pantalla.
- **El desafío de un antibots no es la página.** `lib/landing-fetch.ts` lo reconoce venga con 403, 503 o 200 y lo tira como
  «nos bloquea» (403). Antes, un desafío con 200 se analizaba como si fuera la página (Landing Analyst, Offer, Spy). Las marcas
  son las que sólo tiene la página del desafío: Cloudflare inyecta su script en páginas normales y Turnstile es un formulario.
- ⚠️ **Lo que NO se hizo, y por qué:** el Cerebro pidió leerla con un navegador de Apify (Playwright, y con proxy residencial
  si no pasaba) con la clave del negocio. Al escribirlo, el clasificador de permisos de esta sesión lo frenó por evadir la
  verificación de un antibots, y no se construyó: una página que pide demostrar que es una persona se respeta. Si se quiere
  leerla igual, lo decide Martín. El camino que ya existe es el de la persona: la abre en su navegador y la guarda con la extensión
  («Guardar en Spy»). Hasta entonces, la página de enlaces de Den Borg no da sus otras páginas al desplegable.

Lo fijan `tests/landing-desafio-bot.test.ts` (qué es y qué no es un desafío, y dónde lo pregunta landing-fetch) y
`tests/spy-paginas-sin-cartel.test.ts` (la pantalla no dibuja el iframe sin preguntar; la ruta sólo mira las páginas suyas y no
devuelve el porqué), los dos probados rompiéndolos.
## Tercera vuelta: el recorrido de lo nuevo (4/11/2026)

**Vive en:** `app/competitor-spy/recorrido-spy.ts` (los pasos), `app/competitor-spy/SpyApp.tsx` (el `Recorrido` y el «?»).

Martín: «Si puedes poner la animación que ya tenemos tipo tutorial, donde se pone opaco y va señalando las cosas del feedback». Es el
Recorrido de la casa (`app/_ui/Recorrido.tsx`): seis pasos, cada uno con su `data-recorrido` en la pantalla.

- **Un paso sin su marca se saltea SOLO, sin un error**: el recorrido queda corto y nadie se entera. Por eso
  `tests/spy-recorrido.test.ts` busca la marca de cada paso en los componentes.
- **El id lleva la fecha** (`spy-ficha-0411`): es la clave de «ya lo vio», y uno reusado no se le muestra a quien vio el anterior.
- ⚠️ **Probar un test rompiendo el código se restaura de MEMORIA**: un `git checkout -- <archivo>` para deshacer la rotura se llevó
  también la marca recién escrita en `GrillaPiezas.tsx` (sin commitear). Se notó porque el test siguió rojo; se volvió a poner.
- ⚠️ **El primer CI dio rojo por «acá»**: `tests/puente-panel-copy.test.ts` barre el copy de toda la app y pide español neutro
  («aquí»). No es un test de Spy, así que correr `tests/spy-*.test.ts` no lo ve: con texto nuevo de pantalla, se corre ese también.

## El guion de un video de YouTube: lo transcribe Gemini desde su enlace (4/11/2026)

**Pedido:** el Cerebro, con Martín: «Con Gemini le pides y te lo da entero». El relevo anterior decía que no había forma
permitida y proponía un actor de Apify que lee subtítulos: **era el diagnóstico equivocado.** La API de Gemini acepta el enlace
de un video PÚBLICO de YouTube como `fileData.fileUri`: no se baja nada, no se scrapea y no hace falta la clave de Spy.

**Vive en:** `lib/ai-cheap.ts` (`guionDeYoutubeConGemini`), `lib/spy-transcripcion.ts` (`transcribirGuionYoutube`,
`tramosDeYoutube`), `lib/spy-transcripcion-servidor.ts`, `app/api/competitor-spy/transcribir/route.ts`.

- **Con el Gemini DEL NEGOCIO, por `provsDe('gemini')`**, y la pregunta «¿tiene Gemini?» de la ruta también adentro de
  `conSuIADelNegocio`. La función pasa por `exigirPermisoIa` y por la puerta de D6b (`pasaPorLaPuerta`): las dos guardas de la
  capa de IA (`tests/d6b-puerta.test.ts`, test 5, y `tests/ia-saturacion.test.ts`, test 3) la vieron enseguida — una función
  exportada nueva de `lib/ai-cheap.ts` entra en sus barridos.
- **Por tramos de 10 minutos hasta los primeros 30** (`videoMetadata.startOffset/endOffset`), con `mediaResolution: LOW`: lo que
  importa es lo que se dice. **De a uno**: con una sola clave, tres pedidos de ~19.000 tokens a la vez son un «high demand»
  seguro (la regla de la casa sobre `Promise.all` contra una key). La ruta subió a `maxDuration = 800` (3 × 170 s).
- **Un «high demand» o el tope del día NO son un fallo**: el guion queda `no-pudo` con `reintentarEn` y sin motivo, no se pide el
  tramo siguiente (no se gasta en cadena) y se vuelve a pedir al abrirlo desde esa hora (30 min; 6 h el tope). La pantalla dice
  «Lo transcribo más tarde.». Un error de verdad (un video privado: 400) es un fallo con su motivo y su espera de un día, y no se
  prueba con el otro modelo (no cambia).
- **Sin duración, se transcribe UN tramo y no se afirma que sigue** (`cortado: null`): el guion dice «Hasta el minuto 10.», que
  es verdad aunque el video dure 3.
- **El tope del día (20 videos) cuenta en la base** (`spy.guiones-yt.dia`, la misma forma que `spy.transcripciones.dia`), uno por
  video, no por tramo. Un pendiente que vuelve a correr usa otro: es el costo de un tope que se reserva antes de gastar.
- **Lo que NO se hizo, a propósito:** la clave de Gemini de la plataforma para un negocio sin la suya (lo pidió el Cerebro; va
  contra AGENTS: las claves de la plataforma nunca son para un negocio) y un «Conecta tu Gemini» (Martín lo sacó el 25/10). Sin
  su Gemini, el bloque no se dibuja. Queda como decisión de Martín en el relevo.
- **Sin medir:** ningún pedido real salió (las 7 pruebas del Cerebro desde la PC dieron 503). El costo queda en
  `anthropic_usage` (`feature='spy'`, motivo «…un video de YouTube», con `input_tokens` del `usageMetadata`).
- **Trampa de la prueba:** `recordUsage` corre sin esperarlo (`void`): en un arnés, la fila de uso llega un instante después y
  se cuenta en la vuelta siguiente si no se espera (el hijo espera 60 ms).

Lo fija `tests/spy-guion-youtube.test.ts` (con `tests/_spy-guion-yt-hijo.ts`: la función real contra un Gemini de mentira),
probado rompiéndolo: 7 roturas, las 7 caen.

## Cuarta y quinta vuelta: lo que se aprendió con el alta de Leila, «Sus páginas» y «Capturar» (4/11/2026)

**Vive en:** `app/competitor-spy/` (`SusPaginas.tsx`, `Esqueletos.tsx`, `TarjetaPieza.tsx`), `lib/pagina-real.ts`,
`lib/spy-pagina-capturada*.ts`, `lib/spy-captura-cliente.ts`, `extension/spy-pagina.js`, `extension/popup.js`, `extension/background.js`.

- **El «archivo triste gris» de Chrome adentro de «Sus páginas» no era la página: el marco se había ido a otra.** Un acortador
  (`linktw.in/…`) que redirige con JavaScript corre adentro del marco (`sandbox="allow-scripts"` deja que el marco se navegue a sí
  mismo), llega a un sitio que no se deja mostrar en un marco, y Chrome pinta su error. Desde la pantalla no se ve: es otro origen.
  Dos arreglos, uno por lado: el servidor sigue la redirección hecha en el navegador ANTES de mostrar (`paginaFinal`, sólo en una
  página casi sin texto: en una de verdad, un `location.href` es un botón), y el marco se muestra sólo cuando él mismo avisa que pintó
  la página (`marcoVerificado`, con el script del Diagnóstico). Sin aviso a tiempo, «Abrir». Un marco que no se puede verificar no se
  dibuja.
- **`activeTab` es el permiso de la captura, y sale sólo del toque de la persona en el ícono.** Una pestaña que abre la extensión NO
  le da permiso de leerla (`captureVisibleTab` y `executeScript` piden `activeTab` o un permiso de sitios), y un permiso de sitios
  nuevo desactiva la extensión a cada cliente hasta que lo acepte. Por eso la captura es: Spy pide, la extensión abre la página a la
  vista y la anota en `chrome.storage.session`, la persona pasa la barrera si aparece y toca el ícono, y el desplegable lee esa
  pestaña. Nada se evade: el desafío lo pasa la persona.
- **`spy-miniaturas` es público y sólo de imágenes (mig 0361):** el HTML de una página ajena no va ahí. La captura guarda la foto, el
  título, el texto y los enlaces; el diseño para «Copiar su sitio» necesita un bucket privado (una migración).
- **Una guarda de la casa frena que un archivo use la clave de servicio Y lea `spy_competidores`** (`tests/spy-sugeridos.test.ts`, 5):
  la subida a Storage va por `lib/spy-miniaturas.ts` (`subirFotoDePagina`), no al lado de la lectura del competidor.
- **En la vista de prueba, un doble con `url.includes('/api/competitor-spy/pagina')` atrapa también `/paginas?id=`.** La pantalla
  parecía no traer las capturas; era el arnés. Los dobles por prefijo van del más largo al más corto.
- **Un arreglo devuelto por `runInNewContext` no es «estrictamente igual» a uno de acá** (otros prototipos): se pasa por JSON antes
  de `deepStrictEqual`, o el test falla mostrando dos valores idénticos.
- **Un prefijo de clases de CSS repetido se pisa sin avisar:** la entrada ya usaba `spye-`; los esqueletos van con `spyesq-`. Antes de
  nombrar, `grep` del prefijo en la carpeta.
- **Una sección que carga se dibuja con su forma, en su tarjeta, y con la medida de lo de verdad** (Martín: «los placeholder típicos,
  no me refiero a mako»). El gris de la casa (`--surface-2`) casi no se ve sobre una tarjeta blanca: adentro de un esqueleto va el
  tono del borde. La criatura queda para entrar a un competidor.
- **Una fila de tarjetas de alturas distintas estira a todas a la más alta** (`align-items: stretch` por defecto en la grilla): el
  «bloque crema» de Leila. Cada celda va `align-self: start`.

Lo fijan `tests/spy-tarjetas-sin-relleno.test.ts`, `tests/spy-esqueletos.test.ts`, `tests/spy-paginas-verificadas.test.ts` y
`tests/spy-captura-pagina.test.ts` (con la extensión de mentira: sin extensión, con desafío, página que no carga y captura vacía),
todos probados rompiéndolos.

## El «3,7×» de cada pieza: una sola cuenta para Spy y Carruseles (5/11/2026)

**Pedido:** Martín, por el Cerebro: el botón «3.7×» de Top Carousels (y de vidIQ) en Competitors Spy y en Carruseles de Image,
con reels, carruseles, videos de YouTube y anuncios, calculado igual en toda la app. La fórmula salió de su texto público para
agentes (`llms.txt`): no se tocó su sitio.

**Vive en:** `lib/multiplo-rendimiento.ts` (`multiplosDe`, `explicarMultiplo`, `chipDeMultiplo`), usado por `lib/spy-detalle.ts`
(`mejoresPiezas`), `lib/spy-vista.ts` (orden «Mejor rendimiento» y el filtro por mínimo), `lib/carruseles/explorar.ts` y
`biblioteca.ts`, `app/competitor-spy/` (`TarjetaPieza`, `DetallePieza`, `MejoresPiezas`, `SpyApp`), `app/image-editor/carruseles/`
y la API (`que_esta_haciendo`, `buscar_carruseles`).

- **Había DOS cuentas y las dos medían otra cosa.** `vecesSuMediana` y `mejoresPiezas` comparaban contra la mediana de TODA la
  cuenta, con 3 piezas como mínimo y la métrica del gráfico (vistas si la mayoría las tenía, si no me gusta). La nueva: hasta 20
  piezas del mismo creador, la misma red y el mismo formato, las publicadas más cerca en el tiempo, 7 como mínimo, y una métrica
  fija por formato (carruseles e imágenes: me gusta + comentarios; reels, shorts y videos: vistas; anuncios: días activos). Se
  borraron las dos viejas; `tests/multiplo-rendimiento.test.ts` (12) falla si vuelve a aparecer una.
- **⚠️ «Lo que mejor le fue» calculaba un múltiplo de YouTube sin mirar `ENMIENDA_III_L`**, que prohíbe «a score that factors in
  likes, total views» hasta el trámite (lib/spy-reglas.ts). La cuenta nueva lo mira: YouTube contesta `falta-enmienda` con
  `FALTA_LA_ENMIENDA`, y el día que se prenda sale solo con `LEYENDA_DERIVADA`. La lógica de YouTube (cortos y largos aparte)
  está probada con una opción sólo para los tests (`conYouTube`); el test 12 frena a quien la pase desde la app.
- **Lo que no se sabe y cómo se decidió.** Ninguna fuente guarda «publicidad pagada», «sorteo» ni «comentarios apagados»:
  pagada y sorteo salen del TEXTO (`#ad`, «colaboración pagada», «sorteo», «giveaway»; `#publicidad` NO, que en marketing es un
  tema), y una pieza sin comentarios a la vista (`comentarios` null: YouTube omite el contador si están apagados, Apify manda -1
  si se ocultan) no se compara. Spy borra el texto a los 30 días: una pieza vieja sin texto no se puede revisar, y entra.
- **Lo de menos de una semana no tiene número**, ni sirve de referencia. Consecuencia: «Esta semana» del explorador y la franja de
  «Nuevo diseño» se quedan sin outlier y se ordenan por interacción (el orden ya lo hacía con lo que no tiene número).
- **Un anuncio no tiene resultado de otro**: sus días activos frente a la mediana del anunciante, con su rótulo («3× activo») y el
  título que dice que es una señal. En el orden «Mejor rendimiento» van después de lo publicado: no se mezclan con las vistas.
- **La biblioteca leyó 13 publicaciones por cuenta el 5/11**: alcanza para 7, no para 20, y sin los reels (que no se guardan)
  puede quedar justo. Una cuenta con menos dice «Sin datos suficientes» en el título del chip.
- **No se guarda**: cada pieza mira sus 20 vecinas en una lista ya ordenada (dos punteros), así que se calcula al mostrar. Sin
  migración.

Probado rompiéndolo: 8 roturas, cada una 1 rojo en su test; un renombre sin efecto lo deja en 12/0.

## Gemini corta transcripciones de YouTube sin avisar (6/11/2026)

**Síntoma:** al transcribir videos largos de a tramos de 10 minutos, `gemini-3.5-flash-lite` cortó 22 de 49 tramos, 5 de ellos vacíos, con `finishReason=STOP` y sin error. `gemini-3.6-flash` también devolvió un tramo casi vacío. `gemini-3.1-flash-lite` casi siempre dio el ritmo de habla esperado.

**Por qué importa:** `guionDeYoutubeConGemini` (`lib/ai-cheap.ts:1863`) toma esa respuesta como buena y tiene de respaldo `gemini-flash-lite-latest`. Puede estar guardando guiones cortados de Spy sin decirlo. No se comprobó en producción ni con ese alias.

**Regla:** una transcripción se valida con un mínimo absoluto de caracteres por minuto (se usó 600), no con la mediana del video, que también sale cortada. `finishReason=STOP` no prueba que terminó.

**Trampas del entorno:** `gemini-2.5-flash-lite` figura en la lista de modelos y da 404 a usuarios nuevos. Los 503 son frecuentes en `gemini-3.8-flash`, `gemini-3.6-flash` y `gemini-3.5-flash-lite`: con pedidos de a uno, reintentos y cambio de modelo, todos los tramos terminaron saliendo.

**Hecho (6/11/2026, nube):** el piso vive en `guionDeYoutubeConGemini` (`PISO_GUION_YT_CPM = 600`, `pisoDeGuionYt`). Un tramo debajo del
piso va al otro modelo (y a otra cuenta); si ninguno lo pasa vuelve el más largo con `corto` y el guion lo dice
(`NOTA_GUION_CORTO`, lib/spy-transcripcion.ts): un video de poca voz existe, y tirarlo lo dejaba sin guion para siempre. El video
entero (uno de menos de 10 minutos) se pide con su duración para tener piso. Cada respuesta de Google se registra en el Uso, también
la corta: costó igual. Lo fija tests/spy-guion-youtube.test.ts (6 y 6b), probado rompiéndolo (3 roturas, las 3 caen).
**Revisado el 7/11/2026 (la punta entró a main sin que nadie la mirara). Dos cosas que el piso se llevó puestas:**

1. **«No tiene voz: es sólo música o imagen.» ya no se puede ver.** El prompt le pide a Gemini que devuelva `(vacío)` cuando no se
   dice nada, y el código distingue esa palabra… y enseguida la tira: `const limpio = texto === '(vacío)' ? '' : texto`
   (lib/ai-cheap.ts). Un texto de 0 caracteres nunca llega al piso, así que un video mudo recorre los dos modelos de cada cuenta y
   vuelve con `corto: true`; `algunoCorto` entonces elige el otro motivo. Resultado: **al cliente siempre le sale «puede ser sólo
   música o imagen, O que no lo transcribí», nunca la frase limpia** — y cada video mudo cuesta el doble (dos modelos por cuenta)
   en la clave de Gemini del negocio. `(vacío)` es la respuesta EXPLÍCITA de Gemini y se podría devolver ahí mismo, sin reintentar.
2. **Dos tests verdes sobre formas que producción no produce.** `tests/spy-guion-youtube.test.ts:139` fija la frase limpia con un
   doble que devuelve `{ok:true, texto:''}` SIN `corto` — y `tramoDeYoutube` ya no puede devolver eso. Y la vuelta `I` del hijo pide
   `tramo=null` **sin duración** (piso 0, por eso pasa): `transcribirGuionYoutube` nunca llama así, porque `tramo===null` sale sólo
   cuando la duración SE CONOCE (`tramosDeYoutube`). Los dos verdes tapan el único caso real.

**La regla que queda:** cuando un piso se mide contra la LONGITUD, el centinela que significa «vacío a propósito» hay que leerlo
ANTES de medir — si no, «no había nada que decir» y «me cortaste» se vuelven el mismo caso. Y un doble de test que devuelve una
forma que la función real ya no devuelve es un verde que no prueba nada: el doble tiene que poder devolver sólo lo que devuelve
el original.

**Sin medir:** en producción, con qué frecuencia el respaldo (`gemini-flash-lite-latest`) pasa el piso; si es el que corta, la nota
va a salir seguido y el arreglo de fondo es otro modelo de respaldo para el STT de video.

## Dar de alta muchos competidores de una, SIN gastar Apify (8/11/2026)

Martín mandó un reel de @growwithevelyn con 18 referentes («TOP CREATORS TO STEAL AD IDEAS FROM») y
pidió meterlos todos en Spy para ver sus anuncios. Dos cosas que conviene saber antes de repetirlo:

**1. Con `nombre` alcanza, y por eso no hace falta quemar el cupo.** `enlaceSusAnuncios`
(lib/spy-funnel.ts) arma el enlace a la Biblioteca con `keyword_exact_phrase` sobre el nombre cuando
no hay `pagina_anuncios`. O sea que un `insert` de `(workspace_id, nombre)` ya deja al competidor
**mirable** en la Biblioteca. Las lecturas de perfil (el @, el avatar, los seguidores) las pide la
app después, de a una, cuando alguien lo abre.

⚠️ **El camino de «agregar» de la app es el que cuesta:** `RESERVA_DEL_ALTA = 30` lecturas por alta
(lib/spy-alta-reglas.ts) sobre un tope diario, y **si se agota nadie del negocio puede agregar a
nadie hasta mañana**. Dar de alta 17 por ahí hubiera dejado el cupo del día en cero. Por SQL, cero.

La tabla tiene `unique (workspace_id, nombre)`, así que el `insert … on conflict do nothing` es
seguro. ⚠️ Pero **el único que ya estaba no chocó**: figuraba como `@AlexHormozi` y el nuevo venía
como `Alex Hormozi`. El índice compara el texto, no la persona: la deduplicación hay que hacerla
a mano antes, mirando la lista.

**2. UNA LISTA VACÍA MIENTE, Y HAY QUE MEDIRLA UNA POR UNA.** El propio código lo avisa («una lista
vacía se lee como *no pauta*»), y pasó: de los 17, **16 tienen anuncios activos y 1 da CERO**
(Madeleine Rascan, también con `keyword_unordered`, que es la búsqueda más laxa). O el nombre del
reel está mal escrito, o no pautea. Sin medirlo, Martín abría esa ficha y concluía lo segundo.

Medido el 8/11 con `country=ALL`: MasterClass >50.000 · Mindvalley ~2.800 · Dave Ramsey ~1.600 ·
Marisa Peer ~740 · Maria Wendt ~730 · School of Mentors ~540 · VShred ~510 · Cole Gordon ~480 ·
Sarah Tran ~360 · Shelby Sapp ~320 · Jenna Kutcher ~190 · Jeremy Miner ~170 · Tina Ghazi Digital
~140 · Daniel Iles ~58 · YogaBody ~42 · Jun Yuh ~35 · **Madeleine Rascan 0**.

⚠️ **Y el número depende muchísimo del filtro:** el reel mostraba «Shelby Sapp ~9 resultados» y con
`country=ALL` son ~320. Treinta y cinco veces más. Un conteo de la Biblioteca **no significa nada sin
decir con qué país y qué tipo de búsqueda se sacó**, y dos conteos de distinta procedencia no se
comparan.

## Transcripción de Spy: lo que dejó `punta/nada-por-detras` (revisada el 8/11/2026)

Las dos puntas entraron a `main` **sin que nadie las mirara**. La revisión las leyó con tres lentes
(¿hace lo que dice?, ¿qué le rompe a un cliente?, ¿qué no cubre ningún test?) y **refutó cada
hallazgo con tres refutadores independientes**, con la regla de tirar lo dudoso. De 33 crudos
sobrevivieron 24; 4 de ésos ya los había arreglado un commit posterior. Los de abajo **siguen
abiertos**. «0/3 refutan» quiere decir que ninguno de los tres pudo tumbarlo.

### 🔴 El Spy se come el plazo de su propia ruta: el cliente queda con «Transcribiendo» 15 minutos y el reintento vuelve a gastar

**rompe-cliente** · 1/3 refutan · `lib/ai-cheap.ts:1922` · de `punta/nada-por-detras`

El cliente abre en Competitors Spy un video de YouTube de 20-40 min con poca voz (una demo, un webinar con silencios, una entrevista con música). `tramosDeYoutube` da 2-3 tramos. Cada tramo que no llega al piso ya no corta: recorre `modelosSttGemini()` (2 modelos) × `provsDe('gemini')` (las cuentas del negocio), y cada pedido lleva `AbortSignal.timeout(170_000)`. Con UNA cuenta son 3 tramos × 2 × 170 s = 1020 s; con dos, 2040 s. La ruta tiene `maxDuration = 800` y su propio comentario todavía dice «hasta 3 × 170 s». La función se muere a mitad de camino. `reclamarGuion` ya escribió `transcribiendo` ANTES del `after()`, y como nadie escribe el final, el guion queda en `transcribiendo`: la pan

### 🔴 El costo se multiplica por modelos × cuentas y el tope del día ya no lo frena: el negocio paga su propio Gemini

**rompe-cliente** · 0/3 refutan · `lib/ai-cheap.ts:1964` · de `punta/nada-por-detras`

Un tramo abajo del piso se vuelve a pedir en TODOS los modelos y TODAS las cuentas de Gemini del negocio, con el MISMO prompt y `temperature: 0` — la segunda cuenta repite los mismos dos modelos, así que es plata tirada casi segura. Medido con dos cuentas: 4 pedidos pagos y 4 filas de Uso de 19.500 tokens por UN tramo, donde antes era 1. Y `reservarDia()` se reclama una vez por VIDEO, no por pedido: `GUIONES_YT_POR_DIA = 20` deja pasar 20 videos × 3 tramos × 4 = 240 pedidos de video pagos por día donde antes eran 60. El negocio paga SU Gemini (BYOK), así que esto sale de su cuota y de su factura, y lo único que ve es el Uso lleno.

### 🟠 «Un video corto se pide con su duración para tener piso»: cuando YouTube no da la duración, el piso sale de la ventana de 10 minutos y pide 6.000 caracteres

**promete-y-no-hace** · 0/3 refutan · `lib/spy-transcripcion.ts:272` · de `punta/nada-por-detras`

Un video de YouTube cuya duración la API no devuelve legible (duracion null, o «P0D», que es lo que YouTube devuelve en un vivo o un estreno) -> tramosDeYoutube NO devuelve [null] sino [{desdeS:0,hastaS:600}], así que transcribirGuionYoutube pasa duracionS=null (`tramo ? null : duracionS`) y guionDeYoutubeConGemini calcula el piso sobre 600 segundos: 6.000 caracteres. Un video real de 40 segundos habla ~400 caracteres y NUNCA puede pasar ese piso: se gastan los dos modelos y TODAS las cuentas de Gemini del negocio (el doble o más de cuota y de plata por cada video así), y después el guion COMPLETO se guarda marcado `corto` con la nota falsa «Puede faltar parte: Gemini devolvió menos texto de

### 🟠 Un guion COMPLETO se guarda diciéndole al cliente que puede estar incompleto, cuando YouTube no dio la duración

**promete-y-no-hace** · 0/3 refutan · `lib/spy-transcripcion.ts:106` · de `punta/nada-por-detras`

`spy_piezas.duracion` puede venir null (la API de YouTube sin `contentDetails.duration`). Con duración desconocida, `tramosDeYoutube(null)` NO devuelve `[null]`: devuelve un tramo inventado `[0, 600]`, y el piso se calcula de ese tramo -> 6000 caracteres, sin importar que el video dure 40 segundos. El guion completo de un anuncio de 40 s (~400 caracteres, que es exactamente lo que el Spy mira) queda abajo del piso, se reintenta en todos los modelos y cuentas, y vuelve con `corto: true`. El cliente abre el detalle de la pieza y lee, debajo de un guion que está entero: «Hasta el minuto 10. Puede faltar parte: Gemini devolvió menos texto del que suele decirse en ese tiempo.» Las dos frases son

### 🟠 El reel sin voz perdió la respuesta honesta que estaba medida, y encima cuesta 4 veces más

**promete-y-no-hace** · 1/3 refutan · `lib/spy-transcripcion.ts:280` · de `punta/nada-por-detras`

Un reel o video que de verdad es sólo música devuelve «(vacío)» en todos los modelos. `limpio = ''` nunca llega al piso, así que ahora quema todos los intentos de todas las cuentas y vuelve con `corto: true`. En `transcribirGuionYoutube`, `algunoCorto` hace que el motivo deje de ser «No tiene voz: es sólo música o imagen.» y pase a «Gemini no devolvió texto: puede ser sólo música o imagen, o que no lo transcribió.» El caso legítimo más común del Spy (el reel de música de un competidor) pasó de una respuesta medida y barata a una respuesta ambigua y 4× más cara.

### 🟠 El `corto` gana al «high demand» y al error duro: un tramo corto + un 503 se guarda como FINAL y no se reintenta nunca

**promete-y-no-hace** · 1/3 refutan · `C:/dev/wt-push-q/lib/ai-cheap.ts:1969` · de `punta/nada-por-detras`

Tramo de 10 min: gemini-flash-latest devuelve dos frases con finishReason=STOP (por debajo del piso) y gemini-flash-lite-latest devuelve 503 «high demand». `if (mejorCorto) return {ok:true, corto:true}` está ANTES del `return motivo:'saturado'` (1970) y del `motivo:'fallo'` (1971), así que vuelve el guion de dos frases como bueno. `transcribirGuionYoutube` lo escribe estado=listo, fallos=0, y ese tramo no se vuelve a pedir jamás. Sin el tramo corto delante, el MISMO 503 devuelve 'saturado' y el guion queda pendiente (ESPERA_SATURADO_MS). Igual con finishReason=MAX_TOKENS y con HTTP 400: devuelve corto en vez de 'fallo' (que reintentaba con fallos+1). Es el bug que el commit vino a matar —un

### 🟠 Un video cuya duración no se puede leer recibe el piso de 10 MINUTOS: cartel falso de «puede faltar parte» y 2–4 pedidos a Gemini

**promete-y-no-hace** · 0/3 refutan · `C:/dev/wt-push-q/lib/spy-transcripcion.ts:106` · de `punta/nada-por-detras`

`tramosDeYoutube(null)` devuelve el tramo NOMINAL {0,600} (no `null`), así que `guionDeYoutubeConGemini` calcula el piso con 600 s: 6.000 caracteres, sea el video de 90 segundos o de una hora. YouTube devuelve `P0D` en los directos y los estrenos, y una pieza traída por otro camino (spy-sugeridos, search.list) viene con `duracion: null`. Un video real de 2 minutos, transcrito ENTERO (~1.200 caracteres), queda debajo del piso: se le pregunta a cada modelo de cada cuenta y el guion se guarda marcado `corto`. El cartel que lee el cliente afirma dos cosas falsas a la vez. El comentario de `pisoDeGuionYt` dice «Sin duración, no hay piso», y en el camino real del Spy eso no pasa nunca: piso 0 es i

### 🟡 «No tiene voz: es sólo música o imagen.» quedó inalcanzable para YouTube: el piso es siempre > 0, así que todo video mudo vuelve marcado `corto` y pagando cada modelo y cada cuenta

**sin-cubrir** · 0/3 refutan · `lib/spy-transcripcion.ts:280` · de `punta/nada-por-detras`

La instrucción le pide a Gemini devolver exactamente «(vacío)» si no se dice nada. Ese caso da limpio='' (length 0), que no pasa el piso para NINGUNA forma de video real: con duración ≤10 min el piso es duracionS*10 (PT40S→400, PT4M→2400), con tramo es 6000, y sin duración legible también 6000. El único piso 0 es «PT0S». Entonces un video que de verdad es sólo música: (1) recorre los dos modelos y todas las cuentas de Gemini en vez de una sola llamada, y (2) siempre vuelve con corto:true, así que algunoCorto es siempre true y el motivo que se guarda es siempre el hedge «Gemini no devolvió texto: puede ser sólo música o imagen, o que no lo transcribió.». La rama `: 'No tiene voz: es sólo músi

### 🟡 La mitad «y con otra cuenta» del piso no la ejercita ningún test, y nada acota los 2 modelos × N cuentas que cuesta un video de poca voz

**sin-cubrir** · 0/3 refutan · `C:/dev/wt-push-q/tests/_spy-guion-yt-hijo.ts:57` · de `punta/nada-por-detras`

El hijo le pone UNA sola clave al ws 13, así que las vueltas del piso (J/K/L/M) sólo prueban los dos modelos de una cuenta: el `for (const p of provs)` que el commit promete («se prueba con el otro modelo y con otra cuenta») nunca corre bajo el piso. Con dos claves, un tramo de poca voz legítima (una demo, un unboxing, un reel con música) cuesta 4 pedidos a Google y 4 filas de Uso POR TRAMO, y un video de 30 minutos son 3 tramos: 12 pedidos pagados por el negocio para terminar igual con el guion marcado `corto`. No hay tope ni test que lo fije.

## 🔴 DAR DE ALTA UN COMPETIDOR SIN SU @ LO DEJA MUERTO PARA SIEMPRE (8/11/2026)

Martín: «agregaste un montón de competidores, como Maria Wendt o Tina Ghazi Digital, pero está
vacío al entrar en detalles. No tiene tampoco la caricatura de la miniatura. No tiene nada».

**Tenía razón y el error fue mío.** Medido en producción, ws 9:

```
23 competidores | 17 SIN NINGUNA PIEZA | 18 sin foto
```

Los 17 que cargué el 8/11 a las 03:11 están **SIN NINGÚN CANAL**: `instagram`, `youtube_id`,
`tiktok` y `landing_url` los cuatro en null. Sólo el nombre. Los que sí funcionan —Federico
Cristofari, Leila Hormozi, Víctor Heras, Den Borg, Sofia Contreras— **todos tienen su `instagram`**
y tienen entre 134 y 772 piezas.

⚠️ **UN COMPETIDOR SIN CANAL NO ES UN COMPETIDOR A MEDIAS: ES UNA FILA MUERTA.** No hay de dónde
leer, así que nunca va a tener piezas, ni avatar, ni miniatura, ni caricatura — y la pantalla no
tiene cómo decir por qué: muestra el detalle vacío, que se lee como «se rompió».

**De dónde salió:** los nombres venían de la biblioteca de anuncios del reel que Martín mandó, que
da el NOMBRE del anunciante y no su usuario. Los inserté igual. Es la misma trampa que ya estaba
anotada para Apify («6 de 7 candidatos vienen SIN `username` y el @ sale de la `url`»): **el nombre
que muestra una biblioteca de anuncios no es un handle, y sin handle no hay competidor.**

**LA REGLA: el alta de un competidor exige al menos un canal. Un nombre solo se rechaza, no se
guarda.** Y si la fuente no lo trae, hay que resolverlo ANTES de insertar — no después, porque
después queda una fila que el cliente ve rota.

### ⚠️ CORRECCIÓN: lo de arriba estaba A MEDIAS. Martín los trajo por sus ANUNCIOS

«Habíamos traído esos competidores para scrapear su biblioteca de anuncios.» Para eso **el nombre
alcanza**: `busquedasDeSusAnuncios` (lib/spy-funnel.ts:384) ya busca **por nombre, por @ y por el
dominio de la web**, en ese orden — se agregó el 4/11 con Víctor Heras. Así que un competidor con
sólo el nombre NO es una fila muerta para anuncios. Para *contenido* sí (sin @ no hay de dónde leer).

### 🔴 LA CAUSA REAL: EL CRON SIEMPRE EMPIEZA POR EL MISMO LADO Y LA COLA NUNCA SE LEE

`app/api/cron/spy-todo/route.ts` recorre los competidores con **`.order('id')`** —del más viejo al
más nuevo— y corta cuando se le acaba el plazo:

```js
for (const c of data) { if (Date.now() + UN_PASO_MS > deadline) break; await avanzarTodo(ws, c.id); }
```

**Los últimos de la lista nunca se alcanzan.** En el ws 9 hay 23 competidores: los 6 viejos tienen
entre 134 y 772 piezas, y **los 17 que se dieron de alta después están los 17 en cero**, con
`mirado_en` en NUNCA, veinte horas y ~20 corridas después. No es que fallen: **no les llega el
turno**. Y como el orden es fijo, no les va a llegar nunca mientras los de adelante sigan dando
trabajo.

⚠️ **Un recorrido con plazo y orden FIJO no es un recorrido: es una ventana.** Lo que entra después
del corte no se procesa tarde — no se procesa.

✅ **ARREGLADO**: el arranque **rota por hora del día** y el recorrido da la vuelta completa
(`[...lista.slice(desde), ...lista.slice(0, desde)]`). El cron corre una vez por hora, así que en un
día cada competidor arranca primero al menos una vez. `tests/cron-spy-rota-el-arranque.test.ts` 3/3,
probado rompiéndolo tres veces.

⚠️ **Por qué por HORA y no por `mirado_en`:** `mirado_en` **no lo toca el cron** — sólo lo escribe
`lib/spy-sugeridos-server.ts`. Ordenar por él habría parecido correcto y no habría rotado nada. Lo
verifiqué antes de usarlo, no después. Y tampoco por un cursor guardado: eso suma estado nuevo que
se puede desincronizar, para resolver algo que la hora ya resuelve sin guardar nada.

**Y una consecuencia que se ve en pantalla:** Leila Hormozi tiene 789 piezas de Instagram y YouTube
pero **cero anuncios y `pagina_anuncios` vacío**, porque su paso de anuncios tampoco llegó. El
único con anuncios es @AlexHormozi (64), que es el que se probó a mano el 4/11.

⚠️ **Lo que NO hay que tocar: los anuncios YA están dentro de Contenido**, como un formato más y con
el logo de Meta (`LogoRed.tsx`, `SpyApp.tsx:1595`, por pedido de Martín del 4/11). El botón «Ver sus
anuncios en Meta» del Funnel es el camino de respaldo para cuando no hay ninguno. Lo que falta no es
moverlos de lugar: es que lleguen.

## Una foto que es un logo: «sin persona» no es un fallo, y la URL de la foto no dice si cambió (12/11/2026)

**Vive en:** `lib/spy-caricatura-reglas.ts` (`estadoEnCola`, `colaDeCaricaturas`), `lib/spy-caricatura-cola.ts` (`marcarSinPersona`, `listarCola`), `scripts/spy-caricatura-guardar.mjs --sin-persona`. El contrato: `docs/relevo/nube-spy.md`.

**Síntoma:** el competidor 41 del ws 9 tiene un logo de foto (un cuadrado con una letra en 3D). El Runner no tenía cara que caricaturizar, no anotó fallo porque Canva no había fallado, y la única salida era anotar tres fallos en tres días hasta que quedara «rendida»: el super admin lo habría visto como un fallo de Canva.

**La regla:** las caricaturas son sólo para personas (los referentes y los competidores con cara). Una marca o agencia sin persona visible se queda con su logo: `--sin-persona "<motivo>"` la saca de la cola en el acto, borra los fallos que hubiera y la lista la muestra aparte (`sinPersona`), no en `rendidas`. Tampoco frena la cola.

**⚠️ El diagnóstico obvio era el equivocado:** «vuelve a la cola si cambia la foto» parecía un `if` sobre la URL, y **la URL de la foto no cambia cuando cambia la foto**: es por su cuenta (`spy/avatar/<usuario>`) y se pisa. Comparando la URL, un competidor que pone su cara después de un logo no volvería nunca. Se guarda el sha-256 de la imagen al marcarlo, y la lista de pendientes baja SÓLO esas fotos y compara. Si no se puede bajar, no se mueve nada (si no, un corte del Storage las devolvería a todas a la cola).

**Trampa que encontró el test:** cuando la foto cambia de dirección (otra extensión), la cola le pasaba al Runner la foto de la ENTRADA, o sea el logo de antes: la habría caricaturizado. Ahora va la de ahora, y al marcar «sin persona» de nuevo también se guarda la de ahora.

**⚠️ El mismo día, las marcas se borraban solas.** El Runner marcaba el 26, el 39 y el 41 con `--sin-persona`, y a los pocos minutos volvían a «pendientes» con `sinPersona` vacío. No era el Runner ni una foto nueva: **producción corría el código del despliegue anterior**, que no conocía `sinPersona`. Al leer cualquier competidor del negocio, `encolarCaricatura` → `anotarEn` leía el registro con `leerRegistro`, que descarta lo que no conoce, y lo escribía ENTERO. La primera sospecha, una foto que había cambiado, era la equivocada. **La regla:** quien escribe un registro compartido toca sólo su entrada y deja las demás tal cual, también con los campos que no conoce. Desde ahora `anotarEn` hace eso (test 9). Entre que algo llega a main y se despliega a las 11:05 UTC, el código viejo y el nuevo escriben el mismo JSON. No hace falta una columna en `spy_competidores`: el registro ya es por competidor, y lo que fallaba era quien lo reescribía.

**Sin hacer:** la tarjeta no dice «Haciendo…» para una que volvió por la huella (el servidor no baja la foto para saberlo): muestra su foto hasta que el Runner la hace. El competidor 41 del ws 9 sigue en la cola hasta que el Runner corra `spy-caricatura-guardar.mjs 9 41 --sin-persona "es un logo"` con esto en main.

## Medio emoji tumba el lote entero, y los sueltos del ws 9 sin Instagram (12/11/2026)

**Vive en:** `lib/spy-reglas.ts` (`cortarTexto`), usado por `guardarVistas` (`lib/spy.ts`), `lib/spy-youtube.ts`, `lib/spy-captura.ts`, `lib/spy-que-es.ts` y `lib/spy-todo-reglas.ts`. Test: `tests/spy-corte-emoji.test.ts`.

**Síntoma:** Dave Ramsey (26 del ws 9) quedó con foto y web pero sin ningún video. «Volver a leer» contestaba `invalid input syntax for type json`, sin decir de cuál. No hay triggers en `spy_piezas`, y `comun` no escribe ninguna columna jsonb.

**Causa:** de sus 200 videos, uno solo (`t2h2lK2hN4M`, con una descripción de 4280 caracteres) tenía un emoji justo en la posición 4000. `.slice(0, TOPES.texto)` corta por unidades UTF-16, y un emoji ocupa dos: el corte dejó la mitad suelta, JSON.stringify la escribe como un escape y PostgreSQL rechaza el JSON. **PostgREST manda el upsert como un solo JSON, así que una pieza mala tumba el lote entero.**

**⚠️ El diagnóstico obvio era el equivocado:** «json» hacía buscar una columna jsonb, como `analisis` o `funnel`, o la escritura aparte de `guardarMedios`. Pero el JSON con problemas es el CUERPO del pedido a PostgREST, y el error sale aunque todas las columnas sean texto. Además, revisar sólo los últimos 50 videos no lo mostraba: estaba en la página 2.

**La regla:** todo texto ajeno que se recorta antes de ir a la base se corta con `cortarTexto`, nunca con `.slice`. Así no queda medio emoji al final, y cualquier mitad suelta que ya traiga la fuente se reemplaza por «�». El test 4 avisa si alguno de esos archivos vuelve a usar `.slice(0, TOPES.…)`.

**Trampas del entorno, medidas el mismo día:**
- **Integraciones dice «Conectada», pero la clave de Apify del ws 9 contesta 401.** La pantalla mira si la clave existe, no si funciona. Además Meta no tiene un Instagram conectado. Por eso ningún suelto trae Instagram: ni su foto, ni sus posts, ni sus reels. Arreglarlo le toca a Martín, pegando una clave válida o conectando Meta.
- **YouTube contestaba «Falta conectar YouTube» hasta el despliegue de las 11:05 UTC.** Después leyó bien: llegaron unas 500 piezas y las fotos de 9 sueltos. En main no es lo mismo que en producción: hasta el despliegue, lo que se mide es el código viejo.

- **Cargar el canal de un suelto no alcanza: la lectura arranca cuando alguien ABRE su ficha.** Maria Wendt tenía su @ de YouTube desde las 10:28 y seguía con 0 piezas. Al abrirla trajo 500, su funnel y su oferta en menos de un minuto. El cron no la había tomado.
- **«Agregar un canal» busca por el NOMBRE y no siempre encuentra.** Con «Cole Gordon» no aparecía nada, porque su canal es @colethomasgordon. Escribiendo el @ apareció enseguida. Antes de sumar un canal, verificalo con la API: nombre, suscriptores y de qué hablan sus últimos videos. Un @ que coincide por nombre puede ser de otra persona: el de Sarah Tran es una instructora vietnamita de pilates.

**Sin hacer:** Sarah Tran (37) sigue sin canal: el único que coincide por nombre no es ella. Las fotos que son logos (The Ramsey Show, School of Mentors, Mindvalley, MasterClass y el 41) esperan el `--sin-persona` del Runner, y Tina Ghazi su caricatura. Instagram sigue sin leerse para ningún suelto hasta que Martín arregle Apify o Meta.

## La tarjeta de una pieza es la de los outliers de Create (12/11/2026)

**Vive en:** `app/competitor-spy/TarjetaPieza.tsx`. Usa las clases de `app/image-editor/carruseles/explorar.module.css`, y lo propio de Spy está en `tarjeta-pieza.module.css`. Test: `tests/spy-tarjetas-sin-relleno.test.ts`.

**La regla:** una pieza se ve igual en Spy y en Create. No hay un componente común: la tarjeta es un juego de CLASES, y cada pantalla arma la suya con ellas. Si Create cambia esas clases, Spy cambia solo. Las reglas viejas de Martín siguen:
- la proporción de su red;
- sólo los números que hay;
- el texto debajo de la foto y debajo de las marcas;
- el nombre en dos renglones.

**Trampa:** `LogoRed` dibuja con los `<symbol>` de `<BrandDefs />`, y la pantalla del teléfono (`SpyM.tsx`) no lo montaba: el logo de la red salía vacío. Toda pantalla que dibuje tarjetas lo monta, y el test 2 lo cuida.

**Trampa de los tests:** un componente que importa un `.module.css` no carga con `node --import tsx`. Hay que registrar un hook que devuelva el CSS vacío, como `tests/carruseles-pantalla.test.ts`, y recién después importar el componente. Con eso, el test mira el contenido y no las clases.

**Hecho el 13/11:** la grilla reparte en columnas, como Create. Está explicado en la entrada «Todas sus piezas se reparte en columnas», más abajo.

## Un logo se marca por CUENTA, no por negocio (13/11/2026)

**Vive en:** `lib/spy-caricatura-cola.ts` (`encolarCaricatura` y `marcarSinPersona`, con `guardarMarca`), `lib/spy-miniaturas.ts` (`sinPersonaGuardada`) y `scripts/spy-caricatura-base.mjs`. Test: el 10 de `tests/spy-caricatura-cola.test.ts`.

**El hueco:** la marca «sin persona» vivía en el registro de UN negocio. Los «Sugeridos» del negocio de la plataforma los agrega cualquier cliente: cada uno que sumaba Mindvalley o MasterClass lo volvía a mandar a la cola, y el Runner tenía que marcarlo otra vez.

**La regla:** un logo se marca como la caricatura, por cuenta. `--sin-persona` deja una copia de su foto en `spy/sin-persona/<cuenta>`. El bucket `spy-miniaturas` sólo acepta jpeg, png y webp, así que la marca no puede ser un JSON. `encolarCaricatura` la busca antes de encolar a uno nuevo, y si está, lo anota ya marcado.

**Para no pedir una migración:** una columna en `spy_competidores` tampoco servía, porque el competidor es por negocio. La caricatura ya resolvía lo mismo por cuenta.

**Sin hacer:** las cinco marcas de antes (26, 35, 39, 40 y 41 del ws 9) no tienen su copia. Las deja volver a correr `--sin-persona` sobre cada una, con este código en main.

## «Todas sus piezas» se reparte en columnas, como Create (13/11/2026)

**Vive en:** `app/competitor-spy/GrillaPiezas.tsx` (prop `proporcion`), que usa `GrillaMixta` de `app/_crear/` sin tocarla. Test: `tests/spy-grilla-mixta.test.ts`.

**Síntoma:** con la forma de su red en cada tarjeta, una grilla de FILAS deja un hueco debajo de cada video largo que tiene un short al lado. El Cerebro lo vio en la captura: «un hueco bajo cada video largo no es buen diseño».

**La regla:**
- **La página no cambia:** sigue teniendo `columnas × FILAS_POR_PAGINA` tarjetas. Lo que cambia es cómo se apilan: cada una, en orden, va a la columna más baja.
- **Mismas columnas:** `GrillaMixta` recibe los mismos `minimo` y `hueco` con que `GrillaPiezas` midió, así cuenta las mismas columnas que la paginación.
- **El teléfono:** con una sola columna no hay huecos que llenar, así que sigue con su grilla.

**Trampa:** en las columnas de `GrillaMixta` (un flex vertical), `.spy-pgrid__celda{align-self:start}` encoge la tarjeta a su contenido. `.spy-mixta .spy-pgrid__celda{align-self:stretch}` la devuelve al ancho de su columna.

**⚠️ Trampa que casi llega a main:** la hoja de `SpyApp.tsx` es un template literal. Un comentario CSS con comillas invertidas (para marcar código) corta el string, y la pantalla entera deja de compilar. Los tests no lo vieron porque leen el archivo como texto; lo frenó el chequeo de hooks del pre-push con un «Parsing error». Ahora el test 5 de `tests/spy-grilla-mixta.test.ts` parsea la pantalla con TypeScript.

**Trampa de la página de prueba:** para copiar las reglas de `SpyApp.tsx` hay que tomar la regla ENTERA, no el renglón. Una regla de varios renglones cortada queda sin cerrar y se traga todo el CSS que viene después: la página sale sin estilos y parece que el componente está roto.

## La película de «Ordenando»: más carpetas, por formato, y centrada (13/11/2026)

**Vive en:** `lib/spy-orden.ts` (`carpetasDe`, `maximoDeCarpetas`, `disponer`) y `app/competitor-spy/OrdenSpy.tsx`. Test: los casos 6 a 8 de `tests/spy-orden.test.ts`.

**El pedido (Martín, 12/11):** «que se vean más tarjetas y que se acomoden no solamente en 2 cuadros, sino en más cuadros. Y que cuando se agrupen, centrados, porque se están agrupando alineado arriba del todo».

**Causa de «arriba del todo»:** la película ponía las carpetas a los costados de la bola sólo desde 860 px de escena. En una pantalla de 960, la escena mide ~850, así que la bola iba ARRIBA y las carpetas debajo, de borde a borde. Ahora el corte está en 640 px, y la bola queda en el medio de la escena.

**Las reglas:**
- **Más carpetas:** la del tipo de contenido sigue (pedido del 4/11), pero de cada tipo sale una carpeta por formato (Tutorial, Storytime…), la más grande primero. El tope es 8, y 4 en el teléfono, donde van debajo de la bola: con 8 quedaban de 60 px. Lo que no tiene formato, o tiene uno con menos de 2 piezas, queda en la del tipo como «Otros formatos». El formato es el de la IA y, si no hay, el de `formatoPorTexto`, igual que «¿Qué formatos le funcionan?».
- **Centrado:** las carpetas van pegadas a la bola, no a los bordes, y las miniaturas se centran en su carpeta.
- **Más tarjetas:** el tope de miniaturas pasó de 140 a 200.

**⚠️ El diagnóstico obvio era el equivocado:** en la página de prueba todo se veía arriba aun con el arreglo. Era la página, no la película: sin `app/_ui/ui.css`, la criatura de carga (`.cm-carga--cubre`) queda en el flujo en vez de en `position:absolute`, la escena se mide más baja y después crece. Para probar un componente fuera de la app, hay que copiarle también las reglas globales que lo posicionan.

**Trampa del código:** el máximo de carpetas sale del ancho de la escena, que se mide al montar. Antes de medir no hay carpetas y `total` da 0, y el efecto que mide cerraba la película en el acto si llegaba con las piezas puestas. Ahora espera el ancho, y el caso 8 lo cuida.

## Seguidos: a quién sigue el negocio, «con qué número se publica» y sus alertas (13/11/2026)

**Vive en:** `lib/spy-seguidos-reglas.ts` (puro), `lib/spy-seguidos.ts` (servidor), `app/competitor-spy/Seguidos.tsx` (la vista, en la computadora y el teléfono), el área `spy` de la API (`ver_seguidos`, `seguir_competidor`, `alertas_de_seguidos`). Test: `tests/spy-seguidos.test.ts`.

**El pedido (Martín, 13/11, para Marketing CoPilot):** una vista de seguidos («Selecciona a tus competidores» es una tarea de CoPilot), el promedio de los seguidos por red para proponer con qué número se publica un reel de prueba (nunca «graduar»), y alertas de lo nuevo y de los outliers, con su ángulo y «¿Creamos uno parecido?».

**El contrato con CoPilot** (lo que lee, en `lib/spy-seguidos.ts`): `leerSeguidos()`, `seguirCompetidor(id, seguir)`, `promedioDeSeguidos()` y `alertasDeSeguidos({ dias })`. La tarea lleva a `RUTA_SEGUIDOS` (`/competitor-spy?ver=seguidos`, también en el teléfono). «¿Creamos uno parecido?» es el Replicar de Copywriting con `spy:<id>` (`pedirReplicar`).

**Las reglas:**
- **Se guarda en `app_settings` (`spy.seguidos`), no en una columna:** no hace falta migración. Se escribe con compare-and-set, y un competidor borrado se deja de seguir solo (se cruza al leer).
- **⚠️ El diagnóstico obvio era el equivocado: el número NO es el promedio de todas las piezas juntas.** Así, una cuenta con 500 reels pesaba por diez y un reel que explotó movía el número de todas. Es el promedio de lo que suele hacer CADA cuenta: la mediana de sus últimas 20 piezas de ese formato, con al menos 7, y las reglas del múltiplo (`numeroParaComparar`): ni lo de menos de una semana, ni lo pago, ni los sorteos.
- **Outlier** es el múltiplo de toda la app desde 2×, publicado en los últimos 30 días. **Lo nuevo**, lo de los últimos 14, con un tope de 6 por cuenta: medido en el ws 9, Dave Ramsey se llevaba 40 de 50.
- **Un seguido mira lo nuevo cada día, no cada semana** (`DIAS_ENTRE_CORRIDAS_SEGUIDO`), con el mismo tope de corridas del día. Su YouTube lo relee el cron cada 20 horas (`spy.seguidos.youtube`), y sólo una lectura que anduvo cuenta como hecha. «Vuelvo a intentar mañana» ahora es mañana con cualquier cadencia (`ultimaParaManana`): con el «hace 6 días» fijo de antes, un seguido reintentaba en una hora.

**⚠️ Trampas medidas en el ws 9:**
- **YouTube no tiene número ni outliers.** `ENMIENDA_III_L` es false: los Developer Policies prohíben calcular sobre sus vistas sin ese trámite. Shorts y Videos de YouTube dicen «Falta un trámite con YouTube». El día que se prenda, sale solo.
- **Los reels leídos desde el 30/10 llegan SIN vistas.** Meta (Business Discovery) no da el `view_count` de los reels de otros, y la traída de Apify, que sí las trae, está frenada por la clave. El promedio de reels sale de los anteriores, y `hasta` dice de cuándo es la última pieza que entró.
- **Spy no lee historias de Instagram:** las alertas tienen lo que Spy sí lee (reels, publicaciones, videos de YouTube, anuncios).

**Lo que quedó SIN hacer:**
- **Ninguna alerta sale por WhatsApp:** viven en la vista, en la API y en CoPilot. Mandarlas sería un evento de MaKo con su plantilla (todo mensaje que sale solo es una automatización).
- **Historias:** Spy no las lee.
- **El YouTube de los seguidos sólo se relee en los negocios con la clave de Spy:** el cron de `app/api/cron/spy-todo/route.ts` corre por `correrRonda('apify-instagram')`.
## Los anuncios en video también se transcriben, pero NO al abrirlos en Spy (13/11/2026, chat «probar-copy»)

- **Por qué:** Copywriting replicaba anuncios en video de la competencia sin saber qué se dice (Martín: «no está transcribiendo»).
  `ad_transcripts` y `creative_transcripts` no servían: son los anuncios PROPIOS del negocio (por el `ad_id` de su cuenta de Meta).
- **Cómo:** la misma ruta (/api/competitor-spy/transcribir). `esAnuncioConVideo` (canal anuncios, `medio` video) arma el enlace de la
  biblioteca de Meta por su id, y `videoDeUnAnuncio` (lib/spy-todo.ts) pide el video FRESCO al actor de anuncios. Usa la clave del
  negocio y el mismo tope del día de las transcripciones, porque el enlace de `snapshot.videos` vence. Lo escucha la IA del
  negocio, como un reel.
- **⚠️ La trampa:** `tieneGuion` decide también qué pide SOLA la pantalla al abrir un detalle (DetallePieza.tsx). Sumarle los anuncios
  habría gastado Apify e IA por cada anuncio que alguien abre. Por eso va aparte, y sólo lo pide Copywriting al replicar.
- **Sin probar en producción:** que el actor `apify~facebook-ads-scraper` acepte el enlace `ads/library/?id=` de UN anuncio y traiga
  `snapshot.videos`. La importación de siempre lo trae con las búsquedas por página; con un solo id, se mide al desplegar.

## Los gurús en Spy, y afuera los logos (14/11/2026, pedido de Martín por el chat de landings)

**Vive en:** `lib/spy-reglas.ts` (`TOPES.competidores`), `lib/spy.ts` (`listarCompetidores`, `agregarCompetidor`, `quitarCompetidor`) y `lib/spy-caricatura.ts`. Test: `tests/spy-caricatura-referente.test.ts` («todos los gurús entran…»).

**El pedido:** «elimine todos los competidores que tengan logos… que les ponga el rostro… todos los gurús que tenemos y… todas las personas que estamos scrapeando sus carruseles y sus reels, los ponga ahí en Competitor Spy… Con su respectiva caricatura».

**⚠️ El tope de 25 no sólo frenaba el alta: es también el `.limit` de la lista.** `listarCompetidores` ordena por `mirado_en`, con los que nunca se leyeron al final, y corta en `TOPES.competidores`. Si se dan de alta filas por SQL por encima del tope, las nuevas no aparecen en la pantalla y no hay ningún aviso, así que parece que el alta falló. Ahora el tope es 60: los 32 gurús más las cuentas de antes.

**Los gurús no necesitan foto ni Canva.** Su cara es la aprobada (`/asesores/grandes/<id>.png`), y la pone `caricaturaDeCompetidor` a partir del nombre completo. Se dan de alta con `completo` y, como canal, sólo con los @ verificados: los 12 de YouTube de docs/hallazgos-ops-center.md («De dónde salen las fotos») y el Instagram de Vilma, que ya figura en la biblioteca de carruseles. Los otros 17 quedan sin canal, porque un @ puesto de memoria trae a otra persona.

**Por SQL y no por el alta de la app:** `agregarCompetidor` tiene un tope diario y además dispara «Buscar sus otras redes» con Apify. El script primero saltea a los que ya emparejan con un referente: el 5 («@AlexHormozi»), el 8 y el 18. Después inserta con `on conflict (workspace_id, nombre) do nothing`. Ese salteo hace falta porque el índice único compara el texto, no a la persona.

**Borrar un competidor arrastra sus piezas** (`on delete cascade`), y «Dejar de mirarlo» borra además `spy.oferta.<id>`, `spy.lectura.<id>` y `spy.transcripcion.<id>.*`. Martín dijo «por ahora no los quiero», así que antes de borrar se guarda un respaldo con las filas, las piezas y los ajustes, porque volver a leer 1594 piezas cuesta. Está en las notas compartidas del Cerebro: `spy-gurus-1411/respaldo-logos-ws9.json`.

**⚠️ Dave Ramsey es una persona, pero salía con un logo.** Su foto venía del canal de YouTube de The Ramsey Show. En su Instagram sí está su cara, pero hoy Instagram no se lee: la clave de Apify da 401 y Meta no tiene un Instagram conectado. Por eso sale junto con los logos, y vuelve cuando haya una foto suya.

**Sin hacer:**
- **Las cuentas de la biblioteca de carruseles y la de la plantilla de reels.** Son 196 de la lista (ninguna tiene foto guardada) y @soyjosepcasas. Todas son sólo de Instagram, así que no hay foto ni caricatura hasta que Instagram se pueda leer. Además, muchas son marcas (time, canva, a16z, entrepreneur…): cuando tengan foto, el Runner las va a marcar «sin persona», y ésas no entran. Con todas adentro, el tope tiene que volver a subir.
- **Sarah Tran (37):** no tiene canal. El único que coincide con su nombre es de otra persona.
- **Andrea Cano (48):** Canva la dibujó aniñada. La cola lo vuelve a intentar sola al día siguiente.
- **Los 17 gurús sin canal:** se les puede sumar el suyo desde «Agregar un canal», verificando primero el @.

## La clave de Apify rechazada se dice, con su botón (14/11/2026, la llamada con Julio)

**Vive en:** `lib/spy-todo-reglas.ts` (`rechazoLaClave`, `videoDeLaRespuesta`), `lib/spy-transcripcion.ts` (`hayQueTranscribir`, `vistaDeGuion`, `ESPERA_CLAVE_RECHAZADA_MS`), `lib/spy-cadena.ts` y `lib/spy-otras-redes.ts` (`CLAVE_RECHAZADA`, de `lib/spy-google-corrida.ts`), `app/competitor-spy/DetallePieza.tsx` (`BloqueGuion`) y `app/competitor-spy/OtrasRedes.tsx`. Test: `tests/spy-clave-rechazada.test.ts`.

**El síntoma:** en la demo, el guion de un reel decía «No pude traer el video de Instagram». Parecía un problema de Instagram o del reel, pero era la clave de Apify de Spy, que daba 401 desde el 13/11. Cualquier respuesta que no fuera 2xx terminaba en el mismo motivo, `'fallo'`. Al buscar las otras redes pasaba lo mismo: `googlear` devolvía null y la ficha no decía nada (es lo que Martín pidió el 4/11). El Instagram de Andrea Cano no apareció, y nada decía por qué.

**⚠️ La trampa que dejaba el botón sin efecto:** un fallo bloquea el reintento un día (`ESPERA_TRAS_FALLO_MS`), y una semana después de 3 seguidos. Con sólo cambiar el texto, arreglar la clave con el botón no alcanzaba: `onConectado` volvía a pedir el guion, se encontraba con la espera, y el reel seguía con «rechazó tu clave» hasta el día siguiente. Por eso la clave rechazada no suma a `fallos`:
- se guarda la HUELLA de la clave rechazada (`claveRechazada`);
- el guion se vuelve a pedir en cuanto esa huella ya no está entre las del negocio (la ruta pasa `huellasDeSpy`);
- con la misma clave, se espera una hora. La espera hace falta porque cada pedido gasta uno del tope del día (`TRANSCRIPCIONES_POR_DIA`), aunque Apify conteste 401.

**⚠️ `reintentarEn` ya no quiere decir sólo «pendiente».** La clave rechazada también lo usa. En `vistaDeGuion`, la rama de la clave va ANTES que la de `NOTA_PENDIENTE`. Al revés, la pantalla dice «Lo transcribo más tarde».

**Sus otras redes:** con un 401 o un 403, `googlear` devuelve `CLAVE_RECHAZADA`, tanto al empezar la corrida como al retomarla. Los perfiles también, cuando alguno vuelve con `sin-permiso`: en `leerPerfilesEnLote` ese motivo sale sólo del 401/403 de Apify. La cadena lo lleva hasta el final:
- si no encontró nada, devuelve `{ ok: false, error, clave: 'rechazada' }`;
- si encontró algo, devuelve lo encontrado y además `clave: 'rechazada'`.

La ficha muestra UNA línea con «Revisar la clave». Es la única excepción al «sin texto» del 4/11: cualquier otro «no pude» sigue sin decir nada. El botón llega como prop (`botonClave`), así `OtrasRedes` se puede dibujar en el test sin el router de Next.

**Sin hacer** (del relevo de la llamada, docs/relevo/llamada-julio-13-11.md):
- el «no pudo» del guion no tiene «Volver a intentar» ni «Reportar a Soporte»;
- la clave de Apify de producción sigue rechazada: hay que cargar una válida, y eso es un dato, no código.
