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
| LANDING | Cómo armar una landing que vende | El link de MaKo al Web Generator (pendiente) |

## Precios de otras apps (verificados el 19/11/2026, en dólares, pagando mes a mes, en su página oficial)

| App | Plan | Precio | Nota |
|---|---|---|---|
| GoHighLevel | Starter | 97 | gohighlevel.com/pricing |
| Skool | Pro | 99 | skool.com/pricing (+2,9 % por venta) |
| Zapier | Professional | 29,99 | 750 tareas; zapier.com/pricing |
| CapCut | Pro | 17,99 | capcut.com/pricing. ⚠️ La landing (`app/vsl/_sitio/reemplaza.ts`) dice 19,99 |
| Notion | Plus | 10 o 12 | La página leída dice «$10 per member/month» sin aclarar si es anual: sin usar |
| Metricool | Starter | 25 | Sólo de un resumen de la página, no del texto: sin usar |
| Mailchimp | Standard | 20 | Es el precio de promoción de 12 meses: sin usar |
| Canva | Pro | — | Desde Argentina muestra pesos (ARS 8.500): sin usar |
| ManyChat, Gamma, Higgsfield | — | — | 403, antibots o página por JS: sin usar |

Un precio que no se leyó en la página oficial no entra en un video.

⚠️ Antes de publicar cada video, la respuesta al comentario tiene que existir: MaKo contesta comentarios de Instagram
(`lib/api-mako/areas/chatbot.def.ts`), pero está sin probar en producción con estas palabras.

## Videos

| id | Estado | Duración | MP4 | Palabra |
|---|---|---|---|---|
| `s3-estos-videos` | Hecho (19/11) | 22,6 s | `C:/dev/artefactos-animaciones/mp4/s3-estos-videos.mp4` | CUBOS |
| `s3-ticket` | Hecho (19/11) | 30,5 s | `C:/dev/artefactos-animaciones/mp4/s3-ticket.mp4` | TICKET |
| `s3-landing` | En curso (voz y reel hechos) | 26,8 s | — | LANDING |
| `s3-grupo` | En curso (voz y reel hechos) | 26,8 s | — | GRUPO |
| `s3-carrusel` | En curso (voz y reel hechos) | 24,6 s | — | CARRUSEL |
| `s3-guion` | En curso (voz y reel hechos) | 22,8 s | — | GUION |
| `s3-curso` | En curso (voz y reel hechos) | 25,5 s | — | CURSO |

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
