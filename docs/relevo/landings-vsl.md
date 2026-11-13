# Relevo — Landings públicas de `hola-mako.com/vsl` (claude5, desde el 12/11/2026)

Sigue el trabajo de la nube (`docs/relevo/nube-landings-competencia.md`): las 19 landings por función copiadas de su
referencia y el sitio estilo beehiiv (`/vsl/sitio`, `/vsl/comparaciones`). Martín da su feedback mirando un visor.

## El feedback de Martín del 12/11 (textual), y qué se hizo

> «Elimines de todos lados lo de agendar llamada porque hoy en día vamos a hacer que el CTA de todos sea comienza tu prueba
> gratuita… elimina también la sidebar de landings de Maco porque yo debería poder navegar por todo con lo que ya tenemos…
> la tab de precios no hace nada… haz que todo sea navegable tal cual como quedaría. Por ejemplo, si le aprieto el logo de
> Maco, que me vaya [a la portada]. Luego no tiene sentido arriba entrar, ver planes, agenda tu llamada… debería ser
> registrarse, loguearse… ver planes… el botoncito de luna y sol que tenemos… el círculo que se va expandiendo… y que eso se
> mantenga… revises todo lo que falta porque tal vez hay botones que todavía no andan.» Y: «en la landing principal, pusiste
> CRM, Ops Center y Automation, cuando en esa parte debería estar el VSL que yo ya grabé».

(Ese feedback se lo dio a la cuenta claude4 en la sesión de la nube y NO llegó al relevo: lo volvió a pegar en este chat.)

| Pedido | Dónde quedó |
|---|---|
| Ningún «agendar llamada»: el botón es «Pruébalo gratis ahora» (antes «Comienza tu prueba gratuita») | `app/vsl/_competencia/cta.ts` (`RUTA_CTA` = `/planes`, `TEXTO_CTA`, `TEXTO_CIERRE`, que dice hasta qué día se cancela sin pagar: lo que el botón NO dice), en las 19 landings y el sitio. Sigue al interruptor de la prueba (prendida: abajo) |
| Arriba: iniciar sesión y registrarse (sin «Ver planes»: ya está «Precios») | `app/vsl/_sitio/Barra.tsx`: «Iniciar sesión» (/login), «Pruébalo gratis ahora» y, a la derecha del todo, el sol y la luna |
| El sol y la luna, con el barrido de la app, y que se mantenga | `app/vsl/_competencia/TemaSitio.tsx`: un script en línea (anda sin React y en el visor), recuerda el modo en `localStorage['mako.sitio.modo']` |
| El VSL de Martín en la portada nueva | `app/vsl/_sitio/Portada.tsx` (`VSL_PORTADA`, el Panda `25c0684d-…` de la portada de hoy) |
| «Precios» y los links que no andaban | «Industrias» llevaba a `/vsl/mako-<avatar>` (404, nunca se subieron): ahora a `/vsl/coaches`, `/vsl/infoproductores` y `/vsl/inmobiliarias` (publicadas el 23/10). Agencias no tiene página: fuera del menú |
| El visor sin la lista, navegable | `scripts/visor-landings/visor.html`: la página entera, sus links abren la página que corresponde (el logo → la portada nueva, Precios → /planes, Iniciar sesión → /login…), abajo Atrás / Computadora-Teléfono / Copiado-Diseño MaKo |

## La portada nueva y la comparación (12/11/2026, tercera vuelta de Martín)

> «el título principal me gustaría que sea el mejor software para ventas high ticket… ventas, marketing, contenido en una sola
> app… tal vez abajo… ese carrusel de aplicaciones lo pondría en otra sección más abajo, ahí pondría el mismo carrusel de MaKo
> reemplaza las apps que ya estás pagando… MaKo reemplaza a muchísimas más apps… te quedaste muy corto con esas 8. Pero fíjate
> que siempre los logos sean los logos reales originales… el de Facebook está negro… el de Mercado Pago no se nota.»

- Título: «El mejor software para ventas High Ticket.», bajada «**Ventas, marketing y contenido en una sola app.** …», sin la
  frase de debajo del botón.
- **54 apps en 16 trabajos** (`app/vsl/_sitio/reemplaza.ts`, de los competidores de `docs/competencia/landings-por-funcion.md`),
  con el ícono ORIGINAL de cada una en `public/vsl-assets/logos/apps/` (bajado de su sitio; si no tenía, el de Google). Sin las
  apps con las que MaKo se conecta (Calendly, Fathom, Stripe…). Se usa en la comparación y en la tira de debajo del hero.
  `tests/vsl-sitio-reemplaza.test.ts` cuida los archivos y el número.
- El Facebook negro: lo invertía el sol y la luna (la «f» blanca del `<symbol>`). Ahora no se invierten los logos ni su recuadro.
  El Mercado Pago: su apretón de manos pasó de blanco a su azul oscuro (#2D3277) en `app/_components/ServicioVisual.tsx`.
- Las animaciones de la app en «Todo lo que necesitas»: ver la cuarta vuelta.

## Cuarta vuelta de Martín (12/11/2026)

> «prueba lo gratis ahora siempre tiene que estar todo en mayúscula… unificar el color del fondo en todos lados… en la parte de
> pricing está todo en negro… falta el MaKo Accelerator… rediseñes los tres bloques de los planes… compara los planes… vuelve a
> como estaba antes la parte del testimonio de Mauricio… MaKo en números lo eliminaría… no le cambiaste el color de la letra al
> carrusel… logos flotando… funciona con la app que ya usas… Mercado Pago… Plan, Email [sin referencia]… arriba las cuatro esas
> y abajo esas otras… de qué landing te inspiraste… rediseñes la landing de Offer.» Y después: el checkout en el visor, que
> diga que el cobro empieza a los 7 días, y **los 7 días gratis sólo en Pro (97); Esencial (47) se paga directo**.

| Pedido | Dónde quedó |
|---|---|
| «PRUÉBALO GRATIS AHORA» en mayúsculas | `app/vsl/_competencia/cta.ts` (`TEXTO_CTA`) |
| El testimonio de Mauricio como antes | `CasoSitio` usa `CasoMauricio` de `app/vsl/_detalle/FeatureDetail.tsx` (`CSS_CASO` exportado) |
| Sin «MaKo, en números» | fuera de `Portada.tsx` |
| La letra de la tira en modo claro | `esRecuadro` en `TemaSitio.tsx` (un recuadro de logo no tiene texto) |
| Logos flotando, los reales en «Funciona con las apps que ya usas» | `LOGO_INTEGRACION` (`datos.ts`) y `public/vsl-assets/logos/integraciones/` |
| El menú Producto todo igual, sin las cuatro grandes | `GRANDES = []` y `COLUMNAS` en `datos.ts` (MaKo, Today, Sales, Marketing, Create) |
| Precios del sitio en claro y con el Acelerador | `PlanesSitio` dibuja `TarjetasPlanes` de `app/planes/Tarjetas.tsx` (los mismos bloques de /planes) |
| Videos de la app en «Todo lo que necesitas» | `TARJETAS_PORTADA` (`datos.ts`): Competitor Spy y Web Generator (Replicar) con su grabación en `public/vsl-assets/sitio/`, Copywriting con los 32 gurús («Inspirado en») |

## Quinta vuelta (12/11/2026, la misma tarde): Planes, el sol y la luna, el título, las filas

Martín pidió hacer aquí «Planes: 3 bloques, comparar, prueba sólo en Pro» y «Landings Plan, Email y Offer», y sumó: el título
en 3 renglones como máximo; «si estoy en white mode, todo debería ser white mode» (Precios en negro); el segundo en negro al
entrar; los carruseles que se frenan al cambiar de modo; «Todo lo que necesitas» como antes (texto de un lado, video del otro,
intercalando), los videos en bucle y sólo con lo que importa, Replicar sobre una landing de outlier, los gurús fuera de
Copywriting y deslizándose sin texto; la barra arriba también en Industrias («jamás debe desaparecer»); el pie con el texto de
arriba, una sección para lo legal y sin dos «MaKo»; y sin la animación rara del botón al pasar el mouse.

| Pedido | Dónde quedó |
|---|---|
| 7 días gratis sólo en Pro; Esencial se paga al empezar | `planConPrueba` (`lib/planes-mako.ts`): cobro (`lib/compra-plan.ts`), checkout, tarjetas, `/reembolsos`, `/terminos`, Partners |
| Los tres bloques con menos ítems, copiados de otra app | `app/planes/Tarjetas.tsx`, copiado de beehiiv.com/pricing (sin la lista de ✗: va en la comparación) |
| «Compara los planes» con todo lo que incluye | `lib/planes-comparacion.ts` (todo lo que anda, por grupos plegables como beehiiv) y `CompararPlanes` (`app/planes/Vitrina.tsx`) |
| Sin fondo crema en /planes y en el checkout | `app/planes/estilo.ts` (blanco) |
| El checkout en el visor, con cuándo empieza el cobro | `resumenDelPlan` (`app/planes/[plan]/Checkout.tsx`: «Desde el 19 de noviembre»); en el visor, `planes-pro` y `planes-esencial` |
| Todo de un solo modo; sin el segundo en negro; sin frenar los carruseles | `TemaSitio.tsx`: lleva cada color al modo (no invierte), lee una vez, esconde la página hasta tener el modo |
| El título en 3 renglones | `Portada.tsx` (`<br />`) y `estilos.ts` (`9.2cqi`) |
| «Todo lo que necesitas» en filas, con videos | `TARJETAS_PORTADA` y `FilaFuncion`; videos en `public/vsl-assets/sitio/` (Spy sin textos y en bucle; Replicar sobre la landing de Oscar Feito) |
| La barra en Industrias y en el checkout | `app/vsl/[slug]/page.tsx` y `Ficha` (`Checkout.tsx`) |
| El pie | `Pie.tsx` y `columnasDelPie` (`datos.ts`): «Empezar», las familias, Industrias y «Legal» |
| El botón sin la animación de capas | `.s-btn` en `estilos.ts` (al pasar, se aclara apenas) |
| Offer «rompe completamente» | Lo rompía el sol y la luna viejo (invertía su hero negro y sus franjas blancas). Con cada modo parejo queda limpio; el video de Mauricio pasó de 200 a 320 px |
| Plan y Email «sin referencia» | Sí la tienen y la siguen sección por sección: Plan → Motion, Email → la página de email de beehiiv. Lo que los hace ver genéricos son sus visuales (cajas), no su estructura |

**Sin hacer:** grabar Video, Chats, Marketing CoPilot, CRM y Automations como Spy y Replicar (hoy, el visual de su landing), y
los visuales de Plan y Email con la app de verdad. El relevamiento de funciones que no se mencionan (miniaturas de YouTube,
outliers…). Las páginas de Industrias (documentos de Web Generator) siguen ofreciendo «Agenda tu llamada»: cambiarlas es
publicar esos documentos, con el permiso de Martín. La compra de prueba con la tarjeta (Pro empieza en 0, Esencial cobra hoy):
la hace Martín. «Inspirado en» de los referentes quedó sólo en el nombre de cada imagen de la portada (Martín pidió sin texto).

## Sexta vuelta (12/11/2026, noche): nada inventado

Martín, con dos reels de referencia (https://www.instagram.com/reel/DfZFAfzs3Ng/ para Replicar y
https://www.instagram.com/reel/DffGz6yu565/ para la edición de video): «mira fotograma por fotograma cómo lo hace… se los
releves a los chats correspondientes… no tiene sentido esos cursores que están haciendo cosas sobre algo que ya está creado».
Y: «identifica la cantidad de cosas que hiciste inventándote cosas. Eso yo no lo quiero… elimina absolutamente todo… pon un
placeholder con que aquí falta una animación… o si ya la tenemos, reemplázala»; Precios con menos texto, los botones alineados
y los colores de antes; Mauricio exactamente como antes; preguntas con las objeciones reales; el pie con el logo; sin la
columna «MaKo» sola; Agencias en Industrias; MaKo Partners en algún lado; AI Avatar en la portada; y la tabla de referencias.

| Pedido | Dónde quedó |
|---|---|
| Los reels, a sus chats | Replicar → «Probar Web Generator» (local_10fb3135…), el enjambre del editor → «Video Editor» (local_72d0c3fe…), la película de Spy (más carpetas, centrada) → «Spy: funnel del competidor» (local_25016f6c…). Cada uno avisa al chat de landings cuando esté, para volver a grabar |
| Nada inventado | `FaltaAnimacion` (`app/vsl/_competencia/FaltaAnimacion.tsx`). `VisualDeLanding` y `Visual` ya no dibujan maquetas: grabación real (Spy, Replicar), video de Panda, fotos reales, o el recuadro. Los 27 dibujos metidos en 11 diseños, también al recuadro |
| Las filas de la portada | `TARJETAS_PORTADA` (`datos.ts`): Spy y Replicar (grabados), los referentes (sus caricaturas), AI Avatar (sus fotos); el resto, el recuadro con lo que falta (carruseles, copywriting, video, CoPilot, CRM, grupos de WhatsApp, Automations, Chats, tableros, Classroom) |
| Replicar sobre Hormozi | El banco del scratchpad (`banco/replicar3.tsx`): cada caja muestra su pedazo de la landing (`hormozi-libros.webp`) recién cuando la arman, revelado como si se escribiera |
| Precios | `app/planes/Tarjetas.tsx`: `listaCorta` (renglones cortos, con los topes del código), filas comunes con subgrid (los botones a la misma altura), sin notas ni la línea de pagos, los colores de antes (el Acelerador grafito, `data-tema-fijo`) |
| Mauricio, exactamente como antes | `CasoSitio` con la franja clara de la landing (su `::before`) y `data-tema-fijo` |
| Preguntas | `PREGUNTAS_SITIO` (`datos.ts`): 9 objeciones de quien vende High Ticket, con lo que MaKo hace (el setter lleva a agendar, no reserva) |
| Pie y menú | El logo arriba del texto (`Pie.tsx`); Ops Center pasó a «Today» (sin columna «MaKo»); Industrias suma Agencias (`/agency`, pide iniciar sesión); «Empezar» suma MaKo Partners (`/mako-partners`) |

**Qué falta grabar** (cada recuadro dice qué): Spy y Replicar otra vez cuando sus chats cambien la animación; el lienzo de video
con el enjambre como el reel; carruseles (bajar por los outliers, elegir uno y duplicarlo); copywriting (elegir un reel de la
competencia, transcribirlo y escribir el anuncio a toda velocidad, con poco texto); Marketing CoPilot (buscar un diseño que esté
a la altura); el CRM real (una tarjeta que cambia de etapa y el menú «…»: asignar campañas, scrapear un grupo); el scrapeo de un
grupo de WhatsApp (la pestaña, los grupos, los contactos y el cartel de MaKo); el lienzo de Automations; la bandeja de Chats; un
carrusel con todos los tableros y su animación de entrada; las clases del Classroom; y cada recuadro de las 19 landings. Se
graban con la app de verdad: con datos de prueba (el ws 3), nunca con los de un cliente.

### Las referencias de cada página

| Página | Copiada de |
|---|---|
| Portada nueva (`/vsl/sitio`) | beehiiv (beehiiv.com) |
| Comparaciones (`/vsl/comparaciones`) | beehiiv (beehiiv.com/comparisons) |
| Precios (`/planes`) | beehiiv (beehiiv.com/pricing) |
| Checkout (`/planes/<plan>`) | Stripe Checkout |
| Ops Center (`/vsl/mako`) | Holo (tryholo.ai) |
| Dashboard | Reportei (reportei.com/es) |
| Chats | Leadsales (leadsales.io) |
| Plan (`/vsl/prioridades`) | Motion (usemotion.com) |
| Email | beehiiv (beehiiv.com) |
| CRM | GoHighLevel (gohighlevel.com) |
| Automations (`/vsl/seguimiento`) | SetSmart (setsmart.io/es) |
| Agenda | iClosed (iclosed.io) |
| Cobranza | Rebill (rebill.com/es) |
| Marketing CoPilot (`/vsl/ads`) | Master Ads (masterads.ai) |
| Offer | Atlas AI de Done For You (go.doneforyou.com/offer-formula) |
| Competitor Spy | Foreplay (foreplay.co) |
| Ads Analyst (`/vsl/script`) | Gethookd (gethookd.ai) |
| Funnels | Hyros (hyros.com) |
| Video | Cherry Studio (cherrysweet.app) |
| AI Avatar | HeyGen, anuncios UGC (heygen.com/es-mx) |
| Image | PostNitro (postnitro.ai/es) |
| Copywriting | The Copy Machine (theoperatorstack.io/copy-machine) |
| Web Generator | HighLevel AI Studio (gohighlevel.com/ai-studio) |
| MaKo Partners (`/mako-partners`) | LLM Pulse, Tolt y systeme.io |
| Agency Dashboard (`/agency`) | Las páginas de agencias de GoHighLevel y Vendasta |
| Portada de hoy (`/`, documento de Web Generator) | 100ads.ai |
| **Industrias** (`/vsl/coaches`, `/vsl/infoproductores`, `/vsl/inmobiliarias`, documentos del 23/10) | **Sin referencia escrita en el código**: hay que rehacerlas copiando una (y publicarlas es con el permiso de Martín) |

## Séptima vuelta (12/11/2026, noche): outliers verdaderos, nada dibujado

Martín: «No necesitas grabar las pantallas… basta con una screenshot o una pequeña animación… Haz tú la animación de hacer un
pequeño scroll por los outliers de carruseles, selecciona uno y haz que se duplique… Lo mismo con copywriting… AI Avatar… está
horrible». Y después: «tenés que mostrar los outliers verdaderos, no inventarte imágenes… tenés prohibido hacerlo».

| Fila | Qué muestra ahora | De dónde sale |
|---|---|---|
| Spy | La película con 6 carpetas por formato, centrada | `PeliculaDeOrden` real, `public/vsl-assets/sitio/spy.webm` |
| Replicar | La landing de Hormozi construyéndose elemento por elemento, como el reel | `public/vsl-assets/sitio/replicar.webm` |
| Carruseles | La grilla REAL de outliers (la biblioteca de producción), baja, vuelve, elige @lifeofarjav, la tarjeta se duplica y el modal real arma «tu versión» (la réplica real de «MaKo Acelerador Blueprint») | `carruseles.webm`; las lecturas (sólo lectura) y el grabador en el scratchpad: `banco-car/leer-biblioteca.mts`, `leer-replicas.mts`, `banco/grabar-carruseles.mjs` |
| AI Avatar | El personaje de Martín y la misma persona en 3 escenas | `public/vsl-assets/sitio/avatar/` (tomas de `C:/dev/reel-mentores/omni/`) |
| Tableros | Los 13 tableros de la app, de a uno, con su entrada | `public/vsl-assets/sitio/tableros/` (capturas de `docs/diseno/mockups-dashboard/<id>/captura/`) |
| Copywriting | La portada real con los outliers del espacio de MaKo → «Reels» → @den.borgg (70,9×) y su guion transcripto → «Replicar» → la página que MaKo escribió de verdad, renglón por renglón, y su mensaje real en el chat | `copywriting.webm`; scratchpad `banco-copy/` (entrada, grabador, `leer-hilo.mts`) y `banco-car/leer-copy.mts` |

## Octava vuelta (13/11/2026, madrugada): todo desde el código, Hormozi en todos los ejemplos

| Pedido de Martín | Dónde quedó |
|---|---|
| Títulos y bajadas (más largas, de cada landing); «Ver cómo funciona» azul | `TARJETAS_PORTADA` (`app/vsl/_sitio/datos.ts`), `.s-zz-a` |
| Sin «de su curso» en ningún lado | El sitio, la landing de Copywriting, el saludo del chat de un referente (`saludoDelReferente`) y el selector |
| Replicar: el fondo blanco desde el principio y el recuadro que crece | `banco/replica-reel-blanco.tsx` (scratchpad) → `replicar.webm` |
| Carruseles sin botones de MaKo ni su foto | `banco/salida/carruseles-simple.html` → `carruseles.webm` (la copia abre sus 6 láminas) |
| Referentes: clic en Hormozi y su chat pregunta | `banco/salida/referentes.html` → `referentes.webm` (el saludo real) |
| AI Avatar: dos videos completos con «Foto original» | `VIDEOS_AVATAR`: el reel de Martín (`montaje/REEL-v7.mp4`) y el anuncio de Mauricio del auto (`TERCER VIDEO DE IA`); el del QUINTO había salido mal |
| Tableros: carrusel con la entrada de cada uno | `Tableros()` + `SCRIPT_TABLEROS` (`Portada.tsx`); los videos, del banco `banco-tab` (scratchpad) |
| Sin «Producto»; prueba gratis en cada función | `ProductoSitio` / `FilaFuncion` (`.s-zz-acc`) |
| Apps arriba; «MaKo reemplaza apps» sin el 54 y con el ahorro | `TiraSitio` debajo del hero; `TiraReemplaza` + `Ahorro` con `STACK_TIPICO` (`reemplaza.ts`) |
| El caso de Mauricio rediseñado («MaKo le ayudó») | `CasoSitio` (`.s-exito`): la franja que corre, el video, sus meses, antes / con MaKo. Desde el 13/11: «más de US$100k vendidos» (a la fecha, dice Martín), sin las fotos, sin el cierre y sin el botón |
| El ahorro con más apps | `STACK_TIPICO`: GoHighLevel, ManyChat, Canva, CapCut, Higgsfield (en lugar de Foreplay, pedido de Martín), Notion, Gamma, Skool y Mailchimp; sin la nota de los precios |
| Tableros: flechas y puntos afuera, deslizable | La pista es el recuadro (`scroll-snap`, se desliza con el dedo, el trackpad o arrastrando con el mouse); flechas a los costados, nombre y puntos debajo |
| CRM moviendo tarjetas | `banco-crm` (scratchpad) → `crm.webm` |

## Novena vuelta (13/11/2026, tarde): las filas que faltaban, desde el código

Martín: «Continúa con todo hasta finalizar». Cada fila es su componente REAL en un banco de esbuild del scratchpad de la sesión
(`banco-video/`, `banco-grupos/`, `banco-flujo/`, `banco-chats/`, `banco-copilot-hoy/`: build.mjs + entrada.tsx + grabar.mjs; los
estilos, `app/globals.css` compilado con Tailwind → `app.css`), grabado a 1280 × 800 y pasado a 960 × 600 en bucle fundido.

| Fila | Qué se ve | Dónde |
|---|---|---|
| Edita tus videos sin saber editar | El panel REAL de la Edición automática (`enjambre-view.tsx` y su store) sobre tres tomas crudas del personaje de Martín (las de su reel: `C:/dev/reel-mentores/clips-espanol`): sus 7 pausas medidas se marcan y se cortan (19 s → 11 s), los subtítulos de su voz (Whisper), «Palabra gigante», B-roll de MaKo en «una app», un cambio de plano, voz y volumen, la revisión, y «Reproducir el corte final» | `video.webm` |
| Trae los contactos de tus grupos | `TraerDeGrupoWA` + `ExtraccionModal` reales con un grupo de ejemplo (nombres inventados, teléfonos 555): elegir el grupo, «Extraer 43», el avance con los textos de la extensión, el resultado con su etiqueta | `grupos.webm` |

## La prueba gratis, PRENDIDA (12/11/2026, Martín: «Sí, préndela»)

`PRUEBA_GRATIS_PRENDIDA = true` (`lib/planes-mako.ts`): `/planes` dice «7 días gratis» y cobra el día 8 con la tarjeta,
`/reembolsos` y `/terminos` dicen la prueba, y el botón de todo el sitio es «Comienza tu prueba gratuita». El 50% del primer
mes no se ofrece con la prueba prendida (son una cosa o la otra): sus tests (`tests/primer-mes.test.ts`, la simulación del
cobro y las tarjetas con el reloj) se saltean y vuelven solos si el interruptor vuelve a `false`. `tests/planes-tres-bloques`
y `tests/partners-recursos` siguen al interruptor. Medido con `true`: 358 tests de planes y cobros, 347 pasan, 10 se
saltean, 0 fallan. Falta mirar en producción una compra de prueba con la tarjeta de prueba (la hace Martín).

## La barra del sitio en todas las páginas (12/11/2026)

Martín: «me voy a otra tab y después ya no sale la top bar de arriba para seguir navegando… ya no puedo regresar». Cada
landing traía la barra de su referencia, sin el menú del sitio. Ahora arriba de las 19 landings y de `/planes` va la barra del
sitio (`BarraGlobal` en `app/vsl/_sitio/Barra.tsx`), fija al bajar, y la copiada se oculta (`BARRA_PROPIA` en
`app/vsl/_competencia/TemaSitio.tsx`, una clase por diseño; el test exige que esté).

## El visor («Landings de MaKo»)

- El primero (https://claude.ai/artifact/LKcMqfaNfLJXxizHtXqwnQ) lo publicó la cuenta claude4 / la nube: desde otra cuenta
  **no se puede actualizar**.
- **El de claude5: https://claude.ai/artifact/3QRCSF8oaK1ZK2PXADuQow**. Desde esta cuenta se actualiza en la misma URL.
- Qué es: `index.html` (sin lista: la portada nueva y sus links; abajo Atrás, Computadora / Teléfono y Copiado / Diseño MaKo)
  + `paginas/<slug>.html` y `paginas/<slug>-tel.html`, una FOTO de cada página (sin scripts, salvo el del sol y la luna) +
  `assets/` con las hojas de estilo, imágenes y letras. Las páginas de la app a las que llevan los links (`DE_LA_APP` en
  `armar.mjs`: /planes, /login, las de Industrias y las legales) también van.
- **Cómo se arma uno nuevo** (unos 3 minutos, sin `next dev`), con lo nuevo YA desplegado:
  `node scripts/visor-landings/armar.mjs <carpeta> https://hola-mako.com`. Con `<carpeta> <base> indice` escribe sólo el
  índice. Se publica con la herramienta Artifact: `file_path` = `<carpeta>/index.html`, `root` = `<carpeta>` y en `files`
  cada `paginas/*.html` y cada `assets/**`.
- **Si producción va atrás** (como el 12/11): cada página se dibuja desde main sin servidor (`renderToStaticMarkup` de las
  landings de `registro.ts`, `PortadaSitio` con `PLANES_MAKO_DEFAULT` porque `lib/compra-plan.ts` es server-only,
  `ComparacionesSitio` y `VitrinaPlanes` para /planes), con las hojas de estilo de una foto de producción, y los gráficos que se
  dibujan al hidratar (`.recharts-responsive-container`: Cobranza, Dashboard, Plan, Ads Analyst) se copian de la foto de
  producción en el mismo orden y al mismo ancho. Los scripts de esa receta quedaron en el scratchpad de la sesión: la receta es ésta.

## Lo pendiente

- **13/11, tarde (punta b02feedec):** hechos Classroom (PortalAlumno real, `banco-clase` del scratchpad), CRM, tableros
  deslizables, el #418 arreglado (Interactivos.tsx + TemaSitio tras la hidratación). SIGUE, en este orden: el editor de video con
  sus agentes (app/video-editor/_opencut/enjambre: banco con el editor real), Marketing CoPilot (banco en scripts/banco-copilot),
  el scrapeo de grupos (TraerDeGrupoWA con la extensión simulada), Automations (FlujoLienzo con una plantilla real) y Chats.
  Recetas de banco en el scratchpad de la sesión: `banco-crm/` (build.mjs con stubs de next/* y de acciones; grabar.mjs con
  cursor propio), `banco-clase/` (sirve también public/ del worktree). Probar en producción el carrusel y el sonido cuando se
  despliegue (consola sin #418). Esperan a otros: la réplica de carruseles (id del chat de Image) y el OK de Martín para Hormozi
  en Spy (Apify) y para replicar un reel suyo en Copywriting.
- **El editor de video, avisado por su chat (13/11):** el enjambre de agentes ya está en producción. Para grabarlo: un proyecto con
  una toma con voz (la de prueba es `/formatos/plano-secuencia-full.mp4`) → Multimedia › Edición automática › «Editar con MaKo».
  Cada cursor va donde aparece su cambio (corte-01 en el clip que corta, subs-01/02/03 colocando subtítulos, broll-01 con los
  archivos). Del reel de referencia todavía falta el cursor escribiendo el texto y la medida del recuadro. Capturas del chat:
  carpeta de notas del Cerebro, `prueba-video-13-11/07-` y `08-`. Desde el código: banco del editor real (app/video-editor/_opencut).

- **Para la próxima vuelta (13/11):** el scrapeo de grupos (TraerDeGrupoWA + ExtraccionModal, con la extensión simulada), Automations
  (el lienzo), Classroom, el editor de video con sus agentes, una propuesta para Marketing CoPilot (hay banco en
  `scripts/banco-copilot`), Spy con Hormozi (link → sus piezas por formato → carpetas → el gráfico `GraficoSpy` con su entrada;
  en ws 9 Alex Hormozi tiene sólo YouTube y anuncios: falta su Instagram en Spy) y Copywriting con un reel de Hormozi replicado de
  verdad (el guion «Como @AlexHormozi…» de ws 9 está vacío). La réplica de carruseles espera al chat de Image (relevado el 13/11).

- **Carruseles otra vez** cuando se despliegue `punta/probar-image`: la réplica real corta «Tu Acelera/dor».
- **Las pantallas que piden sesión** (CRM, Chats, Automations, scrapeo de grupos, Classroom): Martín inicia sesión en el
  navegador de la app con el espacio de prueba (ws 3) y se capturan.

- Desplegar main (textos del 12/11, sitio estilo beehiiv, fotos de AI Avatar, el CTA, el sol y la luna, el VSL).
- **Las páginas que NO son código y siguen ofreciendo la llamada:** la portada de hoy (`/`, un documento de Web Generator con
  Calendly) y las de Industrias (`/vsl/coaches`, `/vsl/infoproductores`, `/vsl/inmobiliarias`, documentos del 23/10). Se
  cambian publicando esos documentos en producción, con el permiso de Martín (`scripts/landings-mako-v2*.mts --subir`).
- La portada nueva no es `/` todavía: el logo lleva a `/`, que hoy es la portada vieja. Cambiarla la decide Martín.
- Lo que sigue abierto desde la nube: la captura real de «Carruseles que funcionan» para Image; los heros de `/vsl/mako`
  (gráfico del CoPilot), `/vsl/cobranza` (rótulos en inglés) y `/vsl/funnel` (Panda en negro); Closing y Classroom.
