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

## Décima vuelta (13/11/2026, noche): el feedback de la llamada con Leila (Fathom 202965885, lo pasó el Cerebro)

| Pedido | Estado | Dónde |
|---|---|---|
| Titular y revisar los copies | Hecho. El titular quedó «El mejor software para vender High Ticket» (Martín, 13/11 noche: «ese sería nuestro principal», en todos lados): hero, pie y título de /vsl/sitio | `HeroSitio` (`Portada.tsx`), `Pie.tsx`, `app/vsl/sitio/page.tsx` |
| Producto en «Adquisición de clientes» y «Entrega del servicio» | Hecho, con sus animaciones: el tablero de entrega (`KanbanEntrega`) y Cobranza (la pestaña Pagos de una clienta con una cuota vencida) | `APARTADOS_PORTADA` y `apartado` en `TARJETAS_PORTADA` (`datos.ts`) |
| Mini landings por funnel (VSL, WhatsApp, Instagram con lead magnet, YouTube) | Hecho, con el contenido de `docs/marketing-copilot/funnels-simples.md` | `app/vsl/_sitio/funnels-datos.ts`, `Funnels.tsx`, `app/vsl/funnels/[funnel]/page.tsx`; sección en la portada y columna en el pie |
| CRM: entrar a la ficha (de dónde vino, qué hizo, % del VSL) | Hecho: el tablero, «Ver info», «Abrir ficha», el Origen y la pestaña Tracking (3 visitas, VSL al 78 %) | `crm-ficha.webm` (`banco-ficha`) |
| «Se conecta con tu Claude y tu GPT» | Hecho: lo que hay de verdad (tu clave de Claude/OpenAI/Gemini y el conector «MaKo para Claude»; para ChatGPT no hay conector y no se dice) | `SeccionesIA.tsx` → `ConectaTuIA` |
| El costo de la IA, en su sección | Hecho con los gastos REALES de 30 días (sólo lectura): Martín US$15 de Claude, un cliente (Mauricio, sin nombre) US$11; Gemini gratis | `SeccionesIA.tsx` → `CostoDeLaIA` |
| Reemplaza apps: HeyGen, OpusClip, sólo Notion | Hecho: US$392 contra MaKo Pro (HeyGen Creator 29, OpusClip Pro 29; el Cerebro: «el plan que se paga para usarla de verdad») | `reemplaza.ts` |
| Industrias: Agencias, Coaches, Infoproductores, Inmobiliarias | Hecho | `ORDEN_INDUSTRIAS` (`datos.ts`) |
| Comparativa de planes con movimiento | Hecho (cabecera pegada, Pro resaltado, grupos en tarjetas, tildes que aparecen, filas que entran) | `CompararPlanes` (`app/planes/Vitrina.tsx`), `app/planes/estilo.ts` |
| Prueba sólo en el de 97, botón grande | Hecho: «Comienza tu prueba gratuita» | `botonDelPlan` (`lib/compra-plan-reglas.ts`), `.mkpl-btn.prueba` |
| Casos: Axel y otro | Hecho con los cuatro testimonios que Martín ya publicó (Axel, Securiters, QS Media, Social Media Lab), como «los que trabajaron con Martín» | `MasCasos.tsx` |
| Mercado Pago en el checkout | No es de landings: el chat de la pasarela (`app/planes/[plan]/Checkout.tsx`); avisado al Cerebro | — |

**En pausa (13/11, noche), hasta que Martín decida** publicar las páginas de Industrias y hacer de la portada nueva la `/` (avisa
el Cerebro). Spy con Hormozi NO espera un OK de gasto (Martín ya dijo que se gaste Apify): la clave de Apify cargada en Spy da 401 y
la tiene que pegar Martín en Integraciones → Apify. Copywriting con un reel de Hormozi espera su OK a la maqueta nueva.

**Todas las filas de la portada ya son la app grabada** (13/11, noche), salvo Copywriting con Hormozi (espera el OK de Martín para
replicar un reel suyo). Las de esta tanda: Marketing CoPilot (`copilot.webm`, la vista «Hoy» de MediaBuyer), Chats (`chats.webm`,
la bandeja y el «Borrador de MaKo»), CRM con la ficha (`crm-ficha.webm`), Automations (`automations.webm`, el lienzo con «Un Lead
Entró» y el AI Step), Entrega (`entrega.webm`) y Cobranza (`cobranza.webm`). Producción probada a 1440 y 375 (d3f6bd9b3): sin #418,
el carrusel y el sonido andan (capturas en la carpeta de notas, `landings-prod-1311/`).

**Los bancos se mudaron a `C:/dev/bancos-portada/`** (13/11, noche): esbuild no podía leer la carpeta Temp («being used by another
process») y ningún banco del scratchpad compilaba. Ahí están todos (`banco-video`, `banco-grupos`, `banco-flujo`, `banco-chats`,
`banco-copilot-hoy`, `banco-ficha`, `banco-crm`, `banco-clase`), con `build.mjs`, `entrada.tsx` y `grabar.mjs`, y sobreviven a la
sesión. Grabar pide 3 GB de RAM libres (la guardia corta antes).

## Undécima vuelta (14/11/2026): Martín mirando el visor — menos secciones, animaciones que se lean

Martín, textual en lo esencial: «dentro de la animación de Competitor Spy… aparecen las caricaturas de todos los gurús y que se
selecciona Hormozi… la animación de ordenar las tarjetas con sus reels… replicar el carrusel, que replica realmente el carrusel…
copywriting también falta… edición de video… está todo muy chiquitito abajo y al costado… Marketing CoPilot… hazlo más visual,
investiga cómo lo hacen otros… en el CRM… menos información, menos texto, menos botones… elimina la parte de traer los contactos de
grupo de WhatsApp… [Chats] los logos de las diferentes aplicaciones… y que se vea que se puede mandar mensajes por ahí… los tableros
todavía son imágenes… velocidad de llamada, de última… elimina toda la sección de lo que entrega lo que vendiste, que quede la parte
de tu comunidad… elimina a cada cliente esa etapa… cobrar cada cuota… tu funnel armado en MaKo debería estar en industria… una landing
cada uno… elimina se conecta con tu Claude y tu GPT… lo que dicen los que trabajaron con Martín… tu IA a precio de proveedor… la tabla
con todas las landings… con link a la referencia… revísalas todas, critícate».

| Pedido | Dónde quedó |
|---|---|
| Spy: las caricaturas, Hormozi, sus piezas ordenándose | `spy.webm`: SpyApp REAL con los 25 competidores del espacio de MaKo (lectura) y sus caricaturas → toca @AlexHormozi → su caricatura crece al centro y sus 64 piezas reales salen y se ordenan por vistas (`C:/dev/bancos-portada/banco-spy-gurus`) |
| Carruseles: que replique de verdad | `carruseles.webm`: la tarjeta se duplica, las 6 láminas del original suben y abajo entra «Tu versión», la RÉPLICA REAL que armó Image el 13/11 (image_disenos 01988b77) dibujada con el motor del editor (`renderPageToCanvas`), y la cámara se acerca a los pares (`banco-replica` + `banco-carruseles-replica`) |
| Copywriting | `copywriting.webm`: el anuncio REAL de @AlexHormozi (spy_piezas 3318) → «Replicar» → «¿Para qué oferta lo escribo?» con las ofertas reales → el guion que MaKo escribió de verdad con ese anuncio (mako.copywriter.doc.gndml1jt53x), su Gancho y su Historia (`banco-copy-horm`) |
| Video: chiquito abajo y al costado | `video.webm`: el mismo banco con una CÁMARA que se acerca a lo que pasa (la línea de tiempo cortando, el video subtitulando, el registro de los agentes) y el corte final de cerca (`banco-video`) |
| Marketing CoPilot más visual | `copilot.webm`: como los otros (Triple Whale, Hyros, Madgicx, AdAmigo: una decisión a la vez, el antes → después grande y un botón), la cámara entra a «4 cambios para hoy» y a cada propuesta: subir 50 → 60, pausar, bajar 40 → 28, con su «Aplicar» |
| CRM: menos información | `crm-ficha.webm`: el tablero → «Ver info» → la ficha con SÓLO lo que contestó y su origen, y Tracking (3 visitas, VSL al 78 %); lo demás de la ficha no se muestra en la grabación (`banco-ficha/simplificar.mjs`) |
| Chats: los logos y mandar por cada uno | `chats.webm`: WhatsApp, Instagram, Messenger y Email aparecen grandes y vuelan a su conversación; se escribe y se manda por Instagram, y por WhatsApp el borrador de MaKo |
| Tableros: imágenes; velocidad al final | Velocidad de llamada pasó al final (`TABLEROS`). En el sitio de verdad corren su entrada (React); en el visor, el script de `mirar/visor-interactivos.py` |
| Fuera: grupos de WhatsApp, «Cada cliente, en su etapa», «Cobra cada cuota», «Entrega lo que vendiste», «Se conecta con tu Claude y tu GPT», «Lo que dicen los que trabajaron con Martín», «Tu IA a precio de proveedor» | `TARJETAS_PORTADA` (`datos.ts`), `Portada.tsx`; `SeccionesIA.tsx` y `MasCasos.tsx` borrados. Lo de los testimonios: irá una cita de quien ya usa MaKo |
| Comunidad, no «tu escuela», y que se vea | «Tu comunidad, dentro de MaKo.» al final de la lista; `comunidad.webm`: el curso (la clase, play, «Marcar como hecha») y la comunidad tipo Skool del portal (el feed, un like, un comentario) (`banco-clase/grabar-comunidad.mjs`) |
| Funnels en Industrias, una landing cada uno | Columna «Funnels» en el menú Industrias (computadora y teléfono). Cada funnel es una landing: hero con su recorrido que se prende paso a paso, las partes de MaKo que lo arman, cada paso con la grabación de la app, «¿Es para ti?» y el cierre (`Funnels.tsx`, `funnels-datos.ts`) |

**Ninguna fila de la portada queda con el recuadro de «falta animación».**

### La tabla de landings, sub-landings y su referencia (14/11/2026)

| Landing | Ruta | Referencia |
|---|---|---|
| Portada nueva | `/vsl/sitio` | [beehiiv](https://www.beehiiv.com/) |
| Comparaciones | `/vsl/comparaciones` | [beehiiv · comparisons](https://www.beehiiv.com/comparisons) |
| Precios | `/planes` | [beehiiv · pricing](https://www.beehiiv.com/pricing) |
| Checkout | `/planes/pro`, `/planes/esencial` | [Stripe Checkout](https://stripe.com/payments/checkout) |
| Competitor Spy | `/vsl/competitor-spy` | [Foreplay](https://www.foreplay.co/) |
| Marketing CoPilot | `/vsl/ads` | [Master Ads](https://masterads.ai/) |
| Video | `/vsl/video` | [Cherry Studio](https://cherrysweet.app/) |
| AI Avatar | `/vsl/ai-avatar` | [HeyGen · UGC video ads](https://www.heygen.com/es-mx/business/marketing/ugc-video-ads) |
| Image (carruseles) | `/vsl/image` | [PostNitro](https://postnitro.ai/es) |
| Copywriting | `/vsl/copywriting` | [The Copy Machine](https://theoperatorstack.io/copy-machine) |
| Web Generator | `/vsl/web-generator` | [HighLevel AI Studio](https://www.gohighlevel.com/ai-studio) |
| Offer | `/vsl/offer` | [Atlas AI · Done For You](https://go.doneforyou.com/offer-formula) |
| Chats | `/vsl/whatsapp` | [Leadsales](https://leadsales.io/) |
| CRM | `/vsl/crm` | [GoHighLevel](https://www.gohighlevel.com/) |
| Automations | `/vsl/seguimiento` | [SetSmart](https://setsmart.io/es) |
| Agenda | `/vsl/agenda` | [iClosed](https://www.iclosed.io/) |
| Cobranza | `/vsl/cobranza` | [Rebill](https://www.rebill.com/es) |
| Email | `/vsl/email` | [beehiiv](https://www.beehiiv.com/) |
| Dashboard | `/vsl/dashboard` | [Reportei](https://reportei.com/es/) |
| Ads Analyst | `/vsl/script` | [Gethookd](https://www.gethookd.ai/) |
| Funnels (lo que Meta aprende de tu CRM) | `/vsl/funnel` | [Hyros](https://hyros.com/) |
| Ops Center | `/vsl/mako` | [Holo](https://tryholo.ai/) |
| Plan | `/vsl/prioridades` | [Motion](https://www.usemotion.com/) |
| Funnel · VSL con llamada | `/vsl/funnels/vsl` | Sin referencia propia: el molde de la portada ([beehiiv](https://www.beehiiv.com/)) |
| Funnel · Anuncios a WhatsApp | `/vsl/funnels/whatsapp` | Ídem |
| Funnel · Instagram con lead magnet | `/vsl/funnels/instagram` | Ídem |
| Funnel · YouTube orgánico | `/vsl/funnels/youtube` | Ídem |
| Industrias · Agencias | `/agency` | [GoHighLevel](https://www.gohighlevel.com/) y [Vendasta](https://www.vendasta.com/) |
| Industrias · Coaches, Infoproductores, Inmobiliarias | `/vsl/coaches`, `/vsl/infoproductores`, `/vsl/inmobiliarias` | **Sin referencia** (documentos de Web Generator del 23/10; rehacerlas y publicarlas es con el OK de Martín) |
| MaKo Partners | `/mako-partners` | [LLM Pulse](https://llmpulse.ai/affiliate), [Tolt](https://tolt.com/platform/affiliate-portal) y [systeme.io](https://systeme.io/) |
| Portada de hoy | `/` (documento de Web Generator) | [100ads](https://100ads.ai/) |

## Duodécima vuelta (14/11/2026, noche): Martín otra vez, y la revisión de todas las landings

Martín: Spy «antes del gráfico… la animación que ya vimos de acomodar las tarjetas todavía tiene que seguir estando»; «dile al chat de
Competitor Spy que elimine todos los competidores que tengan logos… que les ponga el rostro… todos los gurús… con su caricatura»;
Copywriting «copiar un reel de Alex Hormozi y no un carrusel»; «no me gusta directamente la animación de Marketing CoPilot»; «la
separación entre una sección y otra… más grande y los cuadros… todos del mismo tamaño»; Automations «que se puedan enviar por Instagram,
por WhatsApp, por email»; Comunidad «un montón de botones y de texto… la sidebar… no sale».

| Pedido | Estado |
|---|---|
| Spy: el orden de tarjetas antes del gráfico | Hecho (`spy.webm`): las caricaturas → Hormozi → la lectura con `PeliculaDeOrden` (la bola y las carpetas por formato, «64 piezas ordenadas») → el gráfico de vistas por fecha, de cerca. Banco: `revisarAction` y la primera `piezasAction` vacía disparan la lectura animada como en la app |
| Spy sin logos, todos con su caricatura, y los gurús y las cuentas que se scrapean | Pasado al chat «Spy: funnel del competidor» (local_25016f6c) con las palabras de Martín. Cuando avise, se vuelve a grabar Spy |
| Copywriting: un reel de Hormozi | Pasado al chat «Probar Copywriting» (local_d39f67c7): que replique un short de @AlexHormozi con el flujo nuevo cuando su arreglo esté desplegado y pase el id del guion. Hoy sigue el anuncio |
| Marketing CoPilot de nuevo | Pasado al chat de la maqueta del CoPilot (local_68b7fbdb): la pantalla NUEVA (las cinco tarjetas y el piloto), con cámara; deja el video en `C:/dev/bancos-portada/copilot-nuevo/` |
| Más aire y recuadros iguales | Hecho: 176 px entre filas (112 en el teléfono) y cada recuadro 16:10; tableros con las flechas por fuera (abajo en el teléfono) y AI Avatar dentro del mismo recuadro (`estilos.ts`) |
| Automations por WhatsApp, Instagram y email | Hecho (`automations.webm`): tres plantillas reales, una por canal, cada una de cerca, con el canal marcado abajo |
| Comunidad con la barra del curso y menos botones | Hecho (`comunidad.webm`): la barra «Programa Escala High Ticket» siempre a la vista, sin buscador ni anterior/siguiente; la comunidad sin la barra de categorías ni «Escribe algo» |

**La revisión de las 28 páginas** (capturas, recortes y textos en `C:/dev/bancos-portada/revision-1411/`). Hecho: el texto con degradado
invisible y las tarjetas de «MaKo, lo de siempre» (dos arreglos de `TemaSitio.tsx`, ver hallazgos-landing); el texto cortado a 375 en
Video, Image y Ads (`minmax(0, 1fr)`); el lema del pie «El mejor software para vender High Ticket» en las 7 landings que decían «El mejor
SaaS…», en `/` (título, tarjeta y la portada sin JS) y en el test que la cuidaba; «¿Lo quieres funcionando…?»; los títulos que no
cumplían lo que promete el sitio (Ads «Tus anuncios de Meta, revisados todos los días.», CRM «Todo lo que hizo cada lead, en su
ficha», Email «Tus emails, escritos y enviados desde tu CRM.», Funnel «Tus ventas reales le enseñan a Meta a quién mostrar tus
anuncios.», Plan «Tus tareas más importantes, elegidas por tu IA»); los regionalismos de Ads («traccionen», «arrancamos», «no anda»),
«deadlines», «papel tapiz», «copiado de Canva», «Estamos en el negocio…», «Integraciones potentes», «¿Qué estás esperando?»; la
contradicción de Offer («Sin cambiar la oferta» en la página que vende trabajar la oferta). Los recuadros de «falta» con grabación
disponible (heros de Ads, Copywriting, Image, Video, CRM, Automations, Chats, Cobranza, Dashboard y los sueltos de Ads y Ops Center).
SIN hacer: las filas de capacidades (`Visual` de `_detalle`) siguen con su recuadro; el checkout (chat de la pasarela); Comparaciones a
375 corta nombres de la tabla; AI Avatar sin margen izquierdo desde la franja de cifras; el cierre vacío de Web Generator y sus tres
tarjetas de Mauricio; Spy repite la misma grabación en seis secciones; «44 fuentes» (Dashboard) contra «31 integraciones» (sitio).

## Decimotercera vuelta (14/11/2026, noche): el audio de feedback y la segunda lista del Cerebro

El audio que pasó Martín (WhatsApp, 13/11 22:09, transcripto con Whisper; una revisión de la portada fila por fila). Martín: «Aplica
este feedback, no quites la parte de Mauricio» (el audio proponía sacarla: QUEDA).

| Del audio | Dónde quedó |
|---|---|
| Anuncios, sección aparte (no mezclar con YouTube ni Instagram) | La fila de Marketing CoPilot habla sólo de anuncios: «Gestiona tus anuncios de Meta con IA.» |
| CRM: el título no dice qué resuelve | «Gestiona tus leads de forma automática.» (portada y H1 de /vsl/crm) |
| «Automatiza tu WhatsApp, Instagram y email», y que se vea cómo responde solo | El título, y `automations.webm` = el lienzo de las tres plantillas + «Probar» de Instagram (el simulador real: el lead escribe y la automatización contesta con el texto de su plantilla) |
| Tableros: que se vea la animación de entrada | En el visor no cargaban: el carrusel pide el video por `data-src`, que el visor no reescribe (va por el `poster`). Y pasa cada 4,8 s (la entrada dura 3,8) |
| «Tu curso y tu comunidad, alojados en MaKo» | El título de la fila |
| MaKo reemplaza apps: sólo las muy conocidas | `appsDeLaTira` (`reemplaza.ts`): ManyChat, Canva, CapCut, Notion, Skool, GoHighLevel, Kajabi, Hotmart, Circle, Systeme.io, ClickFunnels, HubSpot, Mailchimp, ActiveCampaign, HeyGen, Higgsfield, Gamma, OpusClip, Descript, Pipedrive. La comparación sigue con todas. **Falta** Zapier, Make y Metricool (no hay logo en el repo y hay que confirmar que MaKo los reemplaza) y ElevenLabs (MaKo se CONECTA con ella: no va) |
| Tus apps, conectadas: en carrusel | Dos filas que se deslizan en sentidos opuestos (también en el teléfono) |
| La objeción de GoHighLevel, bien presentada | La primera pregunta: con lo que se paga por GoHighLevel Starter (US$97) se tiene MaKo Pro, y se deja de pagar ManyChat y CapCut; qué hace MaKo además. Los precios salen de `STACK_TIPICO` |

**La segunda lista del Cerebro**, hecha: Creem fuera de Cobranza (la landing filtra `creem`; nos rechazó el 5/11); Copywriting sin
«Aceptar, Descartar o Reintentar» (pregunta primero y escribe la pieza entera); el checkout («El primer cobro es el día 8…» en Pro, «Se
cobra al empezar…» en Esencial, y la tarjeta dibujada en vez del «▭»); cada grabación sólo en su función (`VisualDeLanding` con
`falta`: Image y Spy muestran el recuadro con el nombre de su sección; Chats ya no repite su video en las filas); CRM con los botones en
azul y en una línea, las cifras legibles y la pestaña «Captar» con letra oscura (`data-tema-fijo`); Offer con el botón en una línea, la
lista con su interlineado y sus seis piezas sin el cuadro azul gigante; el pie del sitio en las 19 landings (`PieGlobal`, el copiado se
oculta); la portada a 375 con la marca arriba del pie; Dashboard a 375 sin el recuadro corrido; la banda de tinta de Copywriting fija en
oscuro; «Competitor Spy»; AI Avatar con los anuncios reales en sus seis filas; Agenda sin las cajas altas con un ícono; Web Generator
y el funnel de VSL con su video empezando en la landing ya armada (`replicar.webm` rotado). Capturas recortadas, en la carpeta de notas
`landings-1411b/`.

**Las páginas que el Cerebro no miró** (Plan, Ads Analyst, Automations, Web Generator, Chats, Funnel; hojas enteras a 1440 y 375 con
`mirar/repaso.mjs` del scratchpad): Automations tenía el mismo defecto de las cajas con un ícono (las seis tarjetas de «Todo lo que hace
tu setter con IA», 180 px vacíos arriba: ahora el ícono va sobre el texto) y el video del hero chico en un marco de 700 de alto (ahora
1040 de ancho, el marco a su medida); Funnel cortaba «a quién mostrar tus anuncios» debajo del video (el resaltado tenía `nowrap`); el
cierre de Ads Analyst tenía «en tu negocio?» celeste sobre gris (contraste 2 a 1: ahora el azul de la marca); Chats a 375 tapaba el
texto del recuadro de «falta» con la pastilla, y el recuadro no entraba en su ventana (ahora la llena). Plan y Web Generator, sin
nada nuevo: sólo sus recuadros de «falta», que están en la lista de abajo.

**Lo último del Cerebro (14/11, noche), hecho:** Spy vuelve a mostrar la grilla de Competidores en «Sigue a tus competidores»
(`FILA_CON_SU_GRABACION`; el recuadro de «falta» queda en las otras filas: la extensión, el análisis, Replicar); el «te avisamos 2 días
antes» del checkout de Pro EXISTE (`/api/cron/aviso-fin-de-prueba`, un correo nuestro cada día a las 10 de Argentina, `lib/prueba-plan.ts`):
queda; Offer a 375 con el mismo aire de los dos lados; el hueco del carrusel de integraciones (ver hallazgos); AI Avatar con seis anuncios
reales distintos (dos de Martín y cuatro de Mauricio, `ANUNCIOS_AVATAR`). Y el video nuevo de Marketing CoPilot (la maqueta, vuelta 17:
tomas quietas con tarjetas enteras, 920 px). Muestra el porqué a lo ancho entre 700 y 1000 px, el arreglo de la rama del CoPilot
(c88731616): tiene que desplegarse junto con esto.

### Lo que falta grabar para los recuadros de «falta» (71, contando repetidos), por las páginas que enlaza la portada

Se graban después del despliegue, con el banco de cada uno (C:/dev/bancos-portada/) o en ws 9 / ws 3.

| Página | Qué grabar |
|---|---|
| Competitor Spy (4) | Guardar un anuncio desde Chrome con la extensión; seguir competidores (la vista «Seguidos»); «qué le funciona y por qué» (el análisis de una pieza); de la idea a tu anuncio (Replicar desde Spy) |
| Web Generator (3) | Los diseños de landing (la galería real); el editor de Web Generator; una landing publicada |
| Image (5) | Las plantillas; Formatos; el chat de MaKo en Image; el kit de marca; el lienzo |
| Copywriting (3) | Un ejemplo real de cada plantilla: anuncio a cámara (PAS), reel que trae mensajes, email de cierre |
| Video (2) | La línea de tiempo antes y después de editar (el banco del editor ya la tiene: dos cuadros) |
| CRM (1) | La pantalla de cada pestaña del ciclo (Captar, Nutrir, Cerrar, Cobrar, Reactivar) |
| Automations (3) | «No agendaste aún»; «Dónde se traba»; una sesión de la API de MaKo con Claude |
| Chats (7) | Las pantallas de sus filas (hilo del lead, etiquetas, asignar…) |
| Dashboard (2) | El informe; «Salud del funnel» |
| Offer (1) | El chat de Offer armando la oferta |
| Agenda (2) | La agenda con las reuniones de cada cliente |
| Cobranza (3) | «Este mes», «Plan de cuotas», «A quién cobrarle» |
| Email (2) | Una secuencia armándose; los disparadores del funnel |
| Funnels (2) | Los eventos que se mandan a Meta |
| Ops Center (9) | El chat de MaKo, Ads Writer, el Second Brain, roles, Integraciones, la lista de conversaciones, «Aprende solo» |
| Plan (16) | El tablero con las tareas puntuadas, el score, el objetivo principal, el borrador de una reunión, subir archivos, la hoja Productividad |
| Ads Analyst (6) | El chat respondiendo, la retención del VSL por bloque, «corregiste el ángulo», la caja para pedirle a MaKo |

## Decimocuarta vuelta (14/11/2026, madrugada): el pedido largo de Martín

Hecho: el ahorro suma Zapier (US$29,99, más caro que Make) y Metricool (US$25); la tira mezclada por categoría, con todas las del
ahorro y sin Descript ni Pipedrive (test: toda app del ahorro está en la tira); «Tu CRM trackea tus leads de forma automática»;
«Gestiona tus anuncios, tu Instagram y tu YouTube con IA»; la promesa del Acelerador atada a llamadas y ventas, a la medida de la
oferta (y su test); las preguntas frecuentes, generales; los tableros: cuatro hojas con entrada nueva en la app y el póster en el
primer cuadro; Chats en 14 s (los cuatro logos → la pregunta de Tomás → la respuesta); Automations en 12 s (se arma «Te escribieron por
Instagram» → «Probar» acoplado → el lead escribe y le contestan); el CRM muestra SÓLO el tracking, con los eventos llegando de a uno;
el editor de video con la línea de tiempo en todos los encuadres. Los bancos: `C:/dev/bancos-portada/` (`codificar-bucle.sh` deja
cualquier toma en bucle).

**Falta, en manos de otros chats** (pedidos con las palabras de Martín): el CoPilot nuevo (anuncios, Instagram y YouTube, decisiones
grandes) — copilot-maqueta; la réplica REAL de un reel de Hormozi para Copywriting (no hay reels de Alex en Spy y ninguno de Leila
está transcripto) — probar-copywriting; los competidores de Spy sin logos y con caricatura — el chat de Spy (puede necesitar el sí de
Martín para escribir en producción). Después del despliegue: regrabar Spy y Copywriting.

## La noche del 14/11/2026: copiar cada referencia al 100% (Martín: «trabaja toda la noche»)

Martín, textual: «quiero que te concentres en que la copia salga muy fiel a todas las animaciones y cosas que tiene la landing original…
lo hagas con todas las landings… los videos que tienen, las animaciones, los hover, todo, absolutamente todo».

**Hecho y subido esa noche** (punta/landings-vsl): la portada de Spy sólo con referentes y sin textos; CoPilot con logos, «la campaña» y
zoom por decisión; CRM con el lead en su etapa, el arrastre y la ficha con todo el tracking (VSL, mapa de calor, video de la visita, línea
de tiempo); curso y comunidad sin textos de más; Comparaciones con la tabla entera, la cabecera fija y las flechas de a apps enteras, y
tarjetas limpias; el ahorro en dos columnas y sin HeyGen; el checkout sin el subtítulo de Mercado Pago, sin el renglón repetido ni subtotal.

**En curso, con agentes** (uno por landing, como mucho tres a la vez por la RAM; el candado de navegador es C:/dev/bancos-portada/.grabando):
CRM contra GoHighLevel (desde las 09:00); Agenda contra iClosed (desde las 09:50); Web Generator, segunda vuelta (llenar los corchetes de
plantilla de la galería y grabar el hero, que hoy dice «falta»; la primera vuelta es f6a10202a). ENTREGADOS: Chats (90845e9c5). Offer (75cd787d0; el video flota al bajar; mismo «para decidir» de claro/oscuro que /vsl/ads). Copywriting (bb6a9be89; faltan la tercera pestaña de ejemplos y la charla del «Chief»). Marketing CoPilot (bc770ddf3; **para decidir con Martín:** en modo claro las bandas oscuras pasan a
celeste por la regla del 12/11, y en Master Ads son verde profundo: si quiere la copia fiel, `data-tema-fijo` en esas secciones). Image
(4949ad5d5; falta el marco «Chat de MaKo»; con ella, las preguntas de la portada en TODAS las landings en producción, `LandingCompetencia.tsx`).
AI Avatar (77f345a01: el reproductor, la cinta, las filas, el testimonio). Video (c7a37be50, la versión B de Cherry; faltan grabar dos escenas de «Lo que hace»: los outliers,
`app/video-editor/OutliersVideo.tsx` en un banco con `hormozi.json`, y el chat del editor). **A verificar con Martín:** las 31 imágenes de
`public/formatos/presets/` parecen de Mauricio (cliente), no de él (docs/hallazgos-ai-avatar.md); no se usan en nada nuevo.
Automations (a9d476b7d, la toma final; el banco: `C:/dev/bancos-portada/banco-flujo/`, `grabar-combo3.mjs` → `medir-combo3.py` →
`codificar-bucle.sh`) y Competitor Spy (a319a85f4: las 12 pestañas con su grabación real, la lluvia y la órbita; sin hacer: los íconos animados
del menú y el pie de Foreplay, el segundo botón de cada fila). **Para decidir (Spy):** `lib/funciones-mako.ts` dice que Spy todavía no lee
solo todos los días y `plan-spy.md` dice que los Seguidos se leen a diario desde el 13/11; la landing dice «al sumarlo y cada vez que abres
su ficha» hasta que se aclare. **Lo que sigue, en este orden:** Cobranza (Rebill), Email (beehiiv), Dashboard (Reportei), Ads Analyst
(Gethookd), Funnels (Hyros), Ops Center (Holo), Plan (Motion). Con varios agentes escribiendo `docs/hallazgos-landing.md` y `docs/hallazgos.md`, cada commit lleva SÓLO la entrada de su landing: se
arma el archivo de HEAD más esa sección y se stagea sin tocar la copia de trabajo (`git hash-object -w --stdin` + `git update-index
--cacheinfo`; el script: scratchpad `stage-parcial.py`). El brief de cada agente: scratchpad `brief-landing-v2.txt` (el común, con todas las trampas de la noche; cada pedido sólo da NOMBRE,
SLUG, ARCHIVO, REF, URL y lo propio de la landing). El de antes: `brief-landing.txt` (si se perdió: el de
Video en el transcript del 14/11). La lista de referencias: scripts/visor-landings/armar.mjs, `PAGINAS`.

**Pendiente de Martín:** las banderas del checkout salen de flagcdn.com y el visor (artefacto) no carga imágenes de afuera; para que se vean
en todos lados hay que bajarlas y servirlas nosotros (pide permiso: bajar archivos). En producción se ven.

## Decimoquinta vuelta (14/11/2026): checkout, precios, preguntas, tableros, Automations y Spy

Hecho (commits de punta/landings-vsl del 14/11):
- **Checkout:** sin la barra de arriba y sin scroll en la computadora (la página mide la pantalla); Mercado Pago con su logo y su azul
  (la fila y el botón); Visa, Mastercard y Amex con sus logos; sin «Pagas en la página segura de Stripe», sin la nota del primer cobro y
  sin texto debajo del botón; «Suscripción recurrente»; lo que incluye cada plan escrito para el checkout (`INCLUYE_EN_EL_CHECKOUT`);
  WhatsApp obligatorio y el botón apagado hasta completar todo; el pie en una línea.
- **La prueba gratis también en Esencial**, sin ningún texto que aclare cuál sí y cuál no (test).
- **La promesa del Acelerador**, con las palabras de Martín: Martín Koncke instala el sistema de adquisición de clientes a la medida de
  la oferta y, como mínimo, se recupera la inversión, garantizado por contrato.
- **/planes:** el título y el subtítulo de la portada; las preguntas de la portada; comparar planes como Attio (cabecera fija con
  precio y botón, Pro resaltado, filas cortas con su (i), acordeón en el teléfono). **Todas las landings** muestran las preguntas de
  la portada (`app/vsl/_sitio/preguntas.ts`).
- **Tableros:** las cinco hojas sin entrada (Cold Calling, Comercial, General, Operación, Velocidad) la tienen en la app
  (`entradaDeTarjetas`); los 13 recortados desde su primer cuadro con contenido; el carrusel carga todos al verse.
- **Automations:** WhatsApp (se arma «Un Lead Entró» entero y le llega el mensaje al lead) y después Instagram (el lead escribe y le
  contestan), 15 s. **«El CRM trackea tus leads de forma automática.»**
- **Competitor Spy (landing):** el hero acompaña al scroll (se achica, sube y se desvanece); una pantalla por pestaña, que cambia al
  tocar y al pasar el mouse; la grilla de Competidores y la réplica de un carrusel donde corresponden.

**Falta:**
- **Spy:** grabar la pantalla de cada pestaña (la ficha de un competidor, los sugeridos, el análisis, la transcripción, la extensión,
  pegar un anuncio, sus páginas), DESPUÉS de que el chat de Spy borre los competidores con logo y sume los gurús (espera el sí de
  Martín en su chat) y se despliegue. El relevo de Foreplay para implementar, en la carpeta de notas `foreplay-relevo/`.
- **Comparaciones como beehiiv:** una tabla general (MaKo fijo y los competidores que rotan) con ✓ / vacío / valor, y las tarjetas de
  abajo «MaKo vs X» (notas: `referencias-comparar/beehiiv-comparisons.md`). No se empezó.
- **Marketing CoPilot: HECHO** (copilot-2: anuncios con sus decisiones, Instagram y YouTube con lo que propone). En Instagram y YouTube el
  CoPilot NO decide (no tienen piloto): el texto de la fila lo dice así. El título («Gestiona tus anuncios, tu Instagram y tu YouTube con
  IA») es de Martín. Muestra el porqué a lo ancho de la rama del CoPilot (c88731616): desplegar juntos.
- **Copywriting: HECHO** con un short REAL de Alex Hormozi (spy:6) replicado por MaKo, del chat probar-copywriting (`copy-reel-hormozi/`,
  la página animada en `C:/dev/bancos-portada/banco-carruseles-replica/salida/copy-reel.html`). Las respuestas «para quién» y «qué
  promete» las escribió ese chat con lo que MaKo dice de sí: Martín las tiene que confirmar. El flujo con preguntas está en
  punta/probar-copy: desplegar juntos.
- **Spy:** el plan del chat de Spy (`foreplay-relevo/plan-spy.md`): primero la pestaña «Anuncios» de la ficha; Apify da 401 desde el
  13/11 (hace falta una clave válida en Integraciones → Apify). La landing no promete lo que Spy todavía no hace.

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
