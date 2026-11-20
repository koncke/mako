# Serie 3 — Ventas, del lado del partner («encontré una aplicación»)

Contenido para las redes de Martín con su personaje en cubos y su voz clonada, hecho con el método de los videos por código
(HTML + Three.js, `C:/dev/artefactos-animaciones`). Arrancó el 19/11/2026 (cuenta claude5, chat `serie-ventas`).

## Qué pidió Martín (textual, 19/11)

> «tiene que ser un contenido que intente replicar al contenido del formato número 2, que es tipo educación, pero justo
> enseñando algo con una app. Siempre es suponiendo que existe una app que todo el mundo ya conoce… Nunca tenemos que sonar
> publicidad. "Dentro de MaKo vas a poder crear", eso suena a publicidad. En cambio, si decimos "encontré una aplicación que te
> ayuda a…"… y el CTA siempre: comenta X palabra si quieres que te pase… súper importante con los mismos videos que estás
> haciendo, con ese formato medio de caricatura hecho por Claude… dale prioridad… si quieres que te enseñe a hacer este tipo de
> videos, comenta tal cosa… tiene que sonar como que somos los partners de esa persona y le estamos dando una súper sugerencia
> de una aplicación que nos encontramos por ahí».

## Las reglas de la serie

- **Voz de partner, nunca de vendedor.** «Encontré una aplicación que…», «hay una app que estuve probando que está buenísima».
  Nunca «dentro de MaKo vas a poder», «te presento MaKo» ni «MaKo es…» como sujeto que se vende.
- **Primero se enseña, después aparece la app.** El video es educación (cómo se hace X) y la app entra como el atajo que
  encontraste, con su nombre una sola vez: «se llama Máko».
- **CTA siempre igual de forma:** «comenta PALABRA y te la paso». Una palabra distinta por video (así se mide cuál funciona y
  la respuesta automática sabe qué mandar). En pantalla, en MAYÚSCULA.
- **Sólo lo que la app hace HOY.** Antes de guionar, se mira en `lib/funciones-mako.ts` (origin/main) el `hace` y el `noHace`
  de la función. Lo que está en `noHace` («Todavía no: …») no se dice. El AI Avatar no se vende todavía
  (`AI_AVATAR_SE_VENDE = false` en `lib/planes-comparacion.ts`).
- **Números reales.** Precios de otras apps con su fuente y su fecha; las cuentas, revisadas con un script.
- **MaKo Tokens:** nunca «gratis», «ilimitado» ni «sin tope» de algo que gasta.
- **Personaje:** Martín en cubos (`reels/kit/toma.js`, `KIT.martin`). Subtítulos bajo el mentón, nunca sobre la cara.
- **Idioma:** español neutro con «tú», neutro en género, frases cortas.

## ⛔ Regla de Martín (19/11, para todas las series): simple, y el protagonista es lo que muestra la referencia

Martín, al ver el piloto de la serie 1: «no se entiende, sobre todo el hook… copiar los hooks de las estructuras… no
utilizar palabras técnicas… ser más simple». Y sobre el primer ticket: «utilizar el lenguaje más simple, sobre todo en el
hook… "Es una locura la cantidad de dinero que se nos va en suscripciones. Yo en su momento pagaba…"… que tenga sentido la
relación de las apps que salen ahí. No mezcles tanto… el ticket tiene que ser mucho más protagonista… No necesariamente
siempre tiene que salir el muñequito de Martín, y no necesariamente siempre tiene que ser el protagonista».

- **El gancho** sigue la fórmula de la primera frase de la referencia, y se entiende en el primer segundo sin saber nada
  de marketing.
- **Palabras de todos los días.** Nunca «CRM» (→ «tu lista de clientes»), «landing» (→ «tu página de ventas»), «ángulos»,
  «hito», «certeza», «automatizar» si hay una forma común de decirlo («que todo se conecte solo»). En pantalla puede verse
  el nombre real de la función (es la app); en la voz, lo común.
- **Referentes por el nombre corto** (Hormozi, no Alex Hormozi).
- **El muñeco no siempre; el protagonista es lo que muestra la referencia.** En el ticket, el papel ocupa la pantalla y
  Martín va chico en un costado (o no va). Los subtítulos arriba, como la referencia, cuando Martín es chico y está abajo.
- **Series de tickets por familia.** Cada ticket con apps de la MISMA familia (las que se usan juntas), con precios
  verificados ese día, y termina en lo que hace MaKo de esa familia:
  - **Vender** (hecho, `s3-ticket-vender`): GoHighLevel 97 + Zapier 29,99 + respond.io 99 = US$225,99, contra MaKo Pro 97.
  - **Cursos** (hecho, `s3-ticket-cursos`, comenta ALUMNOS): Skool 99 + Kit 39 + Notion 12 = US$150, contra MaKo Pro 97.
    Skool y no Kajabi (179): son alternativas, nadie paga las dos.
  - **Contenido** (hecho, `s3-ticket-contenido`, comenta CONTENIDO): CapCut 17,99 + Submagic 19 + Metricool 25 = US$61,99.
    Sale menos que MaKo: el cierre es «y todavía no vendí nada… además me ayuda a vender», no el ahorro. OpusClip no
    entra (MaKo no corta un video largo en clips); Canva tampoco (sólo muestra pesos).
  - Regla: al menos 3 precios verificados de la familia (pedido del Cerebro); si no, ese ticket no se hace.

## La plantilla de guion (≈ 60-75 palabras, 20-26 s)

| Tramo | Qué dice | Qué se ve |
|---|---|---|
| Gancho (0-2 s) | Una frase que corta: la pregunta incómoda o lo que no hiciste («Este video no lo grabé»). | El personaje grande + UNA imagen que lo pruebe. |
| Cómo se hace (2-3 pasos) | El paso a paso real, en una frase cada uno. | Una tarjeta por paso, atada a la palabra que lo nombra. |
| El giro | «Encontré una aplicación que hace eso por ti…» | La pantalla de la app (dibujada desde el componente, nunca inventada). |
| El nombre | «Se llama Máko.» (una vez) | La chispa dorada y «MaKo». |
| CTA | «Comenta PALABRA y te la paso.» | La palabra gigante + la caja de comentarios escribiéndola. |

El video 1 (CUBOS) es la excepción: no nombra ninguna app, vende el método.

## Las dos referencias de Martín, desarmadas

- **El ticket** (`instagram.com/reels/Df2hpE6ivVk`, 44 s, un personaje voxel en un cuarto): pregunta incómoda con el precio
  («¿Te parece caro pagar 200 al mes de IA?») → la cuenta ítem por ítem, cada uno con su bloque → el total → el reencuadre
  («no lo apunto como software, lo apunto como sueldos») → «comenta AHORRO». Subtítulos arriba con la palabra marcada.
- **«Edit IA Pro»** (`instagram.com/p/DffeOMPgNyA`, 42 s, papel crema y cajas con borde negro): «Este archivo convierte a Claude
  en un editor de video. No en uno: en trece» → la lista de lo que trae, uno por frase → **«y el más loco…»** para el que
  sorprende → «se llama X» UNA vez → «instalarlo es fácil» en 3 pasos → CTA. Barra de progreso por segmentos arriba y cada
  frase en una etiqueta abajo. Lo que sirve: el número con giro en el gancho, «el más loco» para la función estrella y los
  3 pasos de «es fácil».

## Referencias que Martín guardó para esta serie (19/11, chat «Inspiración»)

El detalle de cada una (gancho, estructura, CTA, transcripción y cuadros): `C:/dev/inspiracion/relevo.json` y
`C:/dev/inspiracion/piezas/NN/`; el documento, en `C:/dev/wt-inspiracion/docs/inspiracion/relevo-19-11.md`. (?) = Martín
todavía no la confirmó.

| # | Cuenta | Qué tiene | Cómo la usamos |
|---|---|---|---|
| 12 | @ericgorriz_ | El ticket «¿Te parece caro pagar 200 al mes de IA?», personaje en cubos | La serie de tickets (hecho: vender) |
| 70 / 73 | @samuauren / @artem.novitckii | «Así se ve cuando le das a [herramienta] la cuenta entera de [referente]» | Second Brain: chatear con referentes (`chat-referentes`, Pro). Antes, verificar qué hace hoy |
| 45 (?) | @cosmosai.app | Abre con la cuenta de lo que ya pagas | Otro gancho para los tickets |
| 31 (?) | @fabricanteschinos | «Todo este video lo editó Claude»: el video es la prueba | La línea de CUBOS |
| 46 (?) | @curiosfer | «Mientras duermo, mi Claude…», números reales, CTA «comenta AUTOMÁTICO» | Automations (cuando haya una dibujada) |
| 49 (?) | @wetracked.io | Sketch «persona tonta contra persona lista»: el listo nombra la app | Formato para cualquier «cómo se hace» |
| 63 (?) | @santaia.lab | «Los CRM han muerto» con lápida; un CRM que carga ventas desde WhatsApp | Gancho para GRUPO / la lista de clientes |
| 28 / 52 (?) | @santi.siciliano / @agiwithali | «La IA hizo esto por mí», «POV: hace X por ti» | Gancho corto para Copywriting o Web Generator |
| 21 (?) | @wallsframeacademy | Pantalla partida desde el segundo 0; CTA de una palabra que regala algo | Formato del regalo (CUBOS) |
| 64 (?) | @seyva.studio | Personaje en cubos que dialoga con la IA hecha personaje | Martín en cubos con MaKo como personaje |
| 71 (?) | @sahni.ai | POV corto en bucle con un contador que sube | Sólo con números reales |
| 2, 54, 60 (?) | @proyecto_atom, @saleads.ai, @espiad.app | Competencia directa: número propio en pantalla, «NO COMPRES…», testimonio casero | Mirar, no copiar |

## Ganchos que se usaron o se pueden usar

- «Este video no lo grabé. Y tampoco lo edité.» (CUBOS)
- «¿Te parece caro pagar 97 dólares al mes por una app? Haz la cuenta de lo que probablemente ya pagas.» (TICKET)
- «Si vas a hacer una landing, no empieces de cero.» (LANDING)
- «En ese grupo de WhatsApp hay clientes que no estás llamando.» (GRUPO, pendiente; sin inventar el número)

## Palabras de CTA (una por video)

| Palabra | Video | Qué se manda al comentar |
|---|---|---|
| CUBOS | Cómo hago estos videos | La guía del método (falta armarla y cargar la respuesta automática) |
| TICKET | El ticket de lo que ya pagas | El link de MaKo (pendiente) |
| COPIAR | Copia la página de ventas que ya vende (era LANDING) | El link de MaKo al Web Generator (pendiente) |

## Precios de otras apps (verificados el 19/11/2026, en dólares, pagando mes a mes, en su página oficial)

| App | Plan | Precio | Nota |
|---|---|---|---|
| GoHighLevel | Starter | 97 | gohighlevel.com/pricing |
| Skool | Pro | 99 | skool.com/pricing (+2,9 % por venta) |
| Zapier | Professional | 29,99 | 750 tareas; zapier.com/pricing |
| CapCut | Pro | 17,99 | capcut.com/pricing. ⚠️ La landing (`app/vsl/_sitio/reemplaza.ts`) dice 19,99 |
| Notion | Plus | 12 | Por persona, con «Pay monthly» elegido (los 10 son pagando el año) |
| respond.io | Starter | 99 | De los datos de su propia página («Starter (Monthly)»); la tarjeta muestra 79 anual |
| Kajabi | Basic | 179 | Pestaña mensual |
| Kit | Creator | 39 | 1.000 suscriptores; los 20 son una promoción de 3 meses |
| Submagic | Starter | 19 | Con «Monthly» elegido |
| OpusClip | Starter | 15 | «Starter plan only available in monthly» |
| Metricool | Starter | 25 | Pestaña «Monthly», hasta 5 marcas (20 es pagando el año) |
| Mailchimp | Standard | 20 | Es el precio de promoción de 12 meses: sin usar |
| Canva | Pro | — | Desde Argentina muestra pesos (ARS 8.500): sin usar |
| ManyChat, Gamma, Higgsfield | — | — | 403, antibots o página por JS: sin usar |

Un precio que no se leyó en la página oficial no entra en un video.

⚠️ Antes de publicar cada video, la respuesta al comentario tiene que existir: MaKo contesta comentarios de Instagram
(`lib/api-mako/areas/chatbot.def.ts`), pero está sin probar en producción con estas palabras. Se configura en Automations de
la cuenta de Instagram de Martín (comentario con palabra clave → mensaje directo). Es una escritura en producción: el texto
pasa por el Cerebro a Martín.

### El mensaje que le llega a quien comenta (19/11, para cargar)

Mismo tono que el video: de partner, sin sonar a publicidad, en «tú». Las funciones con candado de Pro lo dicen
(`FUNCIONES_SOLO_PRO` en `lib/topes-plan.ts`: el scraper, replicar landing, la IA de los editores y la comunidad). Los links
son las landings de cada función (`app/vsl/<slug>`).

- **CUBOS** (el método, sin MaKo):
  > ¡Hola! Te paso cómo hago estos videos 👇
  > 1. Le paso a Claude (la IA) la idea en una frase y me escribe el guion por escenas.
  > 2. Pongo la voz con mi voz clonada en ElevenLabs.
  > 3. Claude programa cada escena en HTML con Three.js: el personaje en cubos, las tarjetas y los subtítulos.
  > 4. Un navegador saca una foto de cada cuadro y se arma el video vertical con la voz.
  > ¿Qué parte te interesa más? Te cuento.
- **TICKET**:
  > ¡Hola! La app se llama MaKo. Acá está la cuenta completa de las apps que reemplaza: hola-mako.com/vsl/comparaciones
  > Si me cuentas qué estás pagando hoy, te digo con cuáles te quedarías.
- **COPIAR** (el video de la página de ventas; antes LANDING):
  > ¡Hola! La app es MaKo. Pegas el link de la página de ventas que quieres copiar, la lee y eliges qué replicar: el diseño, la
  > estructura o los ángulos. Replicar está en el plan Pro. Mírala aquí: hola-mako.com/vsl/web-generator
- **GRUPO**:
  > ¡Hola! La app es MaKo. En tu lista de clientes tocas «Extraer de un grupo de WhatsApp», eliges el grupo y entran todos con la
  > etiqueta del grupo, sin duplicados. Está en el plan Pro. Mírala aquí: hola-mako.com/vsl/crm
- **CARRUSEL**:
  > ¡Hola! La app es MaKo. En Image eliges la estructura (lista, paso a paso, antes y después…), sale con tu marca y le
  > pides a su chat que la escriba para tu negocio (el chat de los editores está en el plan Pro). Mírala aquí: hola-mako.com/vsl/image
- **GUION**:
  > ¡Hola! La app es MaKo. En Copywriting eliges la plantilla «Reel que trae mensajes» y su chat te escribe el guion para tu
  > negocio, en la misma página. Mírala aquí: hola-mako.com/vsl/copywriting
- **GANCHO**:
  > ¡Hola! La app es MaKo. En Copywriting eliges la plantilla «10 ganchos para un anuncio» y su chat te los escribe para tu
  > negocio. Mírala aquí: hola-mako.com/vsl/copywriting
- **OFERTA**:
  > ¡Hola! La app es MaKo. Su Offer Coach te hace las preguntas de un mentor, arma tu oferta en una página y te dice qué le
  > falta para vender más. Mírala aquí: hola-mako.com/vsl/offer
- **ALUMNOS** (ticket de cursos):
  > ¡Hola! La app es MaKo: el curso y la comunidad, los mails a tus alumnos y organizar todo, en una sola app (la comunidad
  > está en el plan Pro). Acá está la cuenta de lo que reemplaza: hola-mako.com/vsl/comparaciones
- **CONTENIDO** (ticket de contenido):
  > ¡Hola! La app es MaKo: editas tus videos con subtítulos, programas tus publicaciones y, además, te ayuda a vender (tu lista
  > de clientes y los mensajes, en el mismo lugar). Mírala aquí: hola-mako.com/vsl/comparaciones
- **CURSO**:
  > ¡Hola! La app es MaKo, tipo Skool: el curso por módulos y lecciones con candados, y la comunidad de tus alumnos (la
  > comunidad está en el plan Pro), en la misma app con la que vendes. Mírala aquí: hola-mako.com/vsl/classroom

## Los videos, uno por renglón (para el chat de Carruseles y para reusar)

| Video | Gancho | Palabra | La función de MaKo que muestra |
|---|---|---|---|
| `s3-estos-videos` | «Este video no lo grabé. Y tampoco lo edité.» | CUBOS | Ninguna (el método: Claude + voz clonada + código) |
| `s3-ticket` | «¿Te parece caro pagar 97 dólares al mes por una app?» | TICKET | Lo que reemplaza: GoHighLevel 97, Skool 99, Zapier 29,99, CapCut 17,99 = US$243,98 contra MaKo Pro 97 |
| `s3-ticket-cursos` | Voz y reel hechos | 26,5 s | — | ALUMNOS |
| `s3-ticket-contenido` | Voz y reel hechos | 30,7 s | — | CONTENIDO |
| `s3-landing` | «Si vas a hacer tu página de ventas, no empieces de cero.» | COPIAR | Web Generator › Replicar landing (Diseño · Estructura · Ángulos) |
| `s3-grupo` | «En tus grupos de WhatsApp hay gente que nunca recibió un mensaje tuyo.» | GRUPO | CRM › Extraer de un grupo de WhatsApp |
| `s3-carrusel` | «El carrusel que más se guarda no es el más lindo.» | CARRUSEL | Image › Carruseles: las estructuras, con tu marca, y el chat que las escribe |
| `s3-guion` | «Un reel que trae mensajes tiene tres partes.» | GUION | Copywriting › plantilla «Reel que trae mensajes» (Gancho · Historia · Moraleja) |
| `s3-curso` | «Un curso que nadie termina no vende el siguiente.» | CURSO | Classroom: módulos con candados y la comunidad |
| `s3-gancho` | «Tienes dos segundos antes de que muevan el dedo.» (tema #1 de la Serie 2) | GANCHO | Copywriting › plantilla «10 ganchos para un anuncio» |
| `s3-oferta` | «Mentoría de doce semanas no es una oferta.» (tema #4 de la Serie 2) | OFERTA | Offer Coach: las preguntas de un mentor, la oferta en una página y qué le falta |

## Videos

| id | Estado | Duración | MP4 | Palabra |
|---|---|---|---|---|
| `s3-estos-videos` | Hecho (19/11) | 22,6 s | `C:/dev/artefactos-animaciones/mp4/s3-estos-videos.mp4` | CUBOS |
| `s3-ticket` | Reemplazado (mezclaba familias; Martín, protagonista) | 30,5 s | `mp4/s3-ticket.mp4` | TICKET |
| `s3-ticket-vender` | Hecho (19/11), OK del Cerebro con un ajuste (ticket más grande) | 27,8 s | `C:/dev/artefactos-animaciones/mp4/s3-ticket-vender.mp4` | TICKET |
| `s3-ticket-cursos` | Voz y reel hechos | 26,5 s | — | ALUMNOS |
| `s3-ticket-contenido` | Voz y reel hechos | 30,7 s | — | CONTENIDO |
| `s3-landing` | En curso (voz y reel hechos) | 26,8 s | — | LANDING |
| `s3-grupo` | En curso (voz y reel hechos) | 26,8 s | — | GRUPO |
| `s3-carrusel` | En curso (voz y reel hechos) | 24,6 s | — | CARRUSEL |
| `s3-guion` | En curso (voz y reel hechos) | 22,8 s | — | GUION |
| `s3-curso` | En curso (voz y reel hechos) | 25,5 s | — | CURSO |
| `s3-gancho` | En curso (voz y reel hechos) | 24,7 s | — | GANCHO |
| `s3-oferta` | En curso (voz y reel hechos) | 24,3 s | — | OFERTA |

### Por hacer (la tanda «cómo se hace X», verificada en `lib/funciones-mako.ts`)

| Palabra | Cómo se hace… | La app (lo que hace HOY) |
|---|---|---|
| ESPÍA | ver qué le funciona a tu competencia | Competitor Spy. ⛔ Bloqueado: la pestaña dibujada (`app-spy.html`) muestra a un competidor REAL (sus miniaturas con su cara). Hace falta dibujarla con un competidor de mentira en `C:/dev/artefactos-pestanas/pestanas/spy.tsx` |
| SETTER | que nadie se quede sin respuesta | Automations. ⛔ Bloqueado: en la maqueta la pestaña está vacía (sólo «Nueva automatización»); hace falta una automatización de ejemplo dibujada |
| OUTLIER | encontrar un video para replicar | Video: «Encuentra tu siguiente OUTLIER» y «Replicar» (mirar antes si la pestaña dibujada tiene personas reales) |
| CARRUSEL (outliers) | encontrar el carrusel que mejor le funcionó a tu nicho | Image › «Carruseles que funcionan». ⛔ No está dibujado con datos de mentira |

Hechos de esta lista: GRUPO, CARRUSEL (con las estructuras, no con los outliers), GUION (la plantilla «Reel que trae
mensajes») y CURSO (Classroom).

Los temas se ordenan con el ranking de «Serie 2: educación» cuando llegue (pedido el 19/11).

## Cómo se hace uno (y cuánto llevó el primero)

1. Guion por escenas en `voz/guion-<id>.json` (≈ 3,2 palabras/s; «Máko», «Ei-Ai»).
2. `bash tools/voz_formato.sh <id>`: voz v4, alineación, pausas ≤ 0,3 s, -14 LUFS y el chequeo. **≈ 2,5 min** (1 min fue el
   chequeo reintentando por un 429).
3. `reels/<id>.html` sobre el kit. Para una escena 3D propia con Martín: `KIT.martin(divOculto, {encuadre:'cuerpo'})`, y
   `scene.add(mk.three.chico.root)`; `mk.pinta(T, K, {...})` sigue posando la cara y la boca (dibuja su escena vacía en un
   lienzo de 64 px). **≈ 25 min** la primera versión.
4. Capturas por el turno + hoja de contacto: **≈ 40 s** por ronda de 18 cuadros. Hicieron falta 4 rondas.
5. MP4: `node tools/turno.mjs node tools/render-mp4.mjs reels/<id>.html mp4/<id>.mp4 <dur> reels/voz-<id>.mp3 30`.
6. Ficha `reels/fichas/<id>.json` y aviso a «Galería y series 1 y 4» (ella publica).

### Tiempos medidos (19/11, 7 videos) y cómo ir más rápido

| Paso | Cuánto | Nota |
|---|---|---|
| Guion | 5-10 min | Con la función ya verificada en `lib/funciones-mako.ts` |
| Voz (`voz_formato.sh`) | 15 s a 2,5 min | El chequeo a veces reintenta por un 429 |
| Reel (HTML) | 20-30 min | Copiando la escena 3D de un reel anterior de la serie |
| Capturas de prueba | ~40 s por 18 cuadros | MÁS 10-40 min de fila del navegador |
| MP4 | 0,7-1,3 s por cuadro (un video de 25 s ≈ 10-15 min) | MÁS la fila |

Lo que más tiempo se lleva es la FILA del navegador (otros chats renderizan videos de 30-60 s). Lo que funcionó:
- escribir varios reels mientras se espera y capturarlos todos en UN turno (`C:/dev/serie-ventas/tools/tanda-capturas.sh`);
- los renders, también juntos en un turno (`renders-tanda.sh`), recién cuando las capturas pasaron la crítica;
- las capturas de la app, nítidas (×2 o ×3) y recortadas a lo que se cuenta, con `captura-app.mjs` (tema oscuro).

## Decisiones

- 19/11: el video 1 no nombra a MaKo: el gancho es el método y la palabra es CUBOS.
- 19/11: la voz dice «Ei-Ai» (regla de la voz) y el subtítulo muestra «IA».
- 19/11: el ticket usa sólo 4 apps con precio verificado (GoHighLevel, Skool, Zapier, CapCut): US$243,98 contra MaKo Pro
  US$97, «te ahorras US$146,98». La landing usa 11 apps (US$388,98); con Canva, ManyChat y las demás sin verificar, el video
  no las nombra.
- 19/11: cada video «cómo se hace» cierra igual: «Se llama Máko. Comenta PALABRA y te la paso», con la chispa y «MaKo» UNA vez.
- 19/11: CARRUSEL se hizo con las estructuras (lo dibujado) y no con los outliers (no dibujado, con cuentas reales en producción).
- Las escenas: cada video con su color (azul CUBOS, ciruela TICKET, verde azulado LANDING, verde GRUPO, naranja CARRUSEL,
  índigo GUION, oliva CURSO), el mismo cuarto voxel y el mismo Martín.
