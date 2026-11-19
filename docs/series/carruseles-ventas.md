# Carruseles de ventas («encontré una aplicación»)

Los mismos temas que la serie 3 de videos (`docs/series/serie-3-ventas.md` en la rama de `serie-ventas`), pero en carrusel: se
elige un carrusel que ya funcionó y se replica lámina por lámina, del lado del partner que recomienda una app, con la palabra
del CTA al final. Arrancó el 19/11/2026 (cuenta claude5, chat `carruseles-ventas`). Es lo que va a seguir el chat que pruebe a
hacerlos DENTRO de MaKo (Image › «Editar» un ejemplo, `lib/carruseles/replica-servidor.ts`): si allá no sale igual de fiel,
lo que falta está anotado acá.

## Qué pidió Martín (textual, 19/11)

> «me gustaría ya empezar a implementar el contenido de ventas también, pero con carruseles… te puedes inspirar mucho de las
> temáticas que vas a hacer con los videos de Claude de la serie de contenido de ventas… Puedes elegir uno que se vea muy bien,
> que vaya bien con la temática, y replicarlo para lo que nos interesa. Es súper importante que tenga la palabra CTA, pero que no
> rompas completamente la estructura de la referencia: seguir la referencia es muy importante… muchos carruseles de todo tipo y
> de todas las funcionalidades, sobre todo de las que están en la landing… Ir anotando el proceso de cómo se hace, los
> aprendizajes, para luego pasarlo a un chat que intente replicar lo que hicimos pero dentro de MaKo».

## 1. Cómo se elige la referencia

1. **Se lee la biblioteca de outliers de MaKo** (producción, sólo lectura: `carruseles_biblioteca_piezas`, 1.590 carruseles de
   456 cuentas el 19/11) y se ordena por **cuántas veces la mediana de su cuenta** (me gusta + 2 × comentarios, contra la
   mediana de los carruseles de esa cuenta; cuentas con 3 o más carruseles). Es el mismo «outlier» que muestra Image.
2. **Se filtra por `cta_via = 'comentario'`**: los que ya piden comentar una palabra (247 con láminas guardadas). Así el CTA es
   parte de la estructura original y no hay que inventarle un lugar.
3. **Se elige por FORMA, no por tema.** La pregunta es: ¿la estructura de la referencia cuenta lo mismo que quiero contar? Las que
   mejor van para «encontré una app»:
   - **paso a paso con pantallas** (`DaZFc_kkttt`, «Claude + Hormozi», x455): una función que se usa en 3 pasos;
   - **el equipo de bots** (`DcnHxFDgv2y`, «a company of bots», x169, 12.886 comentarios): varias funciones como «empleados»;
   - **la misma plata, dos vidas** (`DfKknqNAKYv`, «Same $20. Netflix or Claude», x3): el ticket, lo que ya pagas;
   - **«las apps que uso»** (`Del4gFkmTyW`, `DfHpnVxkaS4`): un repaso de varias funciones;
   - **«cómo hago X con IA»** (`DevY6-ogAEe`, carruseles virales con Claude): el proceso de una función de punta a punta.
4. **Se descarta** lo que necesita una foto de una persona real que no sea el personaje, o una escena que no se puede dibujar sin
   inventar (pantallas de otra app, números de otro).

Las láminas de cada referencia se bajan de la biblioteca misma (`laminas_imagenes`, en el Storage de Supabase): no hace falta
Instagram ni Apify. Las de la lista de Martín (`C:/dev/inspiracion/links-martin-19-11.txt`) que NO están en la biblioteca se bajan
con `C:/dev/artefactos-animaciones/tools/ig_carrusel.cjs` (la página /embed/, sin sesión). ⚠️ El `curl` de la página /embed/
no trae las láminas (ver «Errores»).

## 2. Cómo se replica

Lámina por lámina, con la referencia al lado:

| Se conserva | Se cambia |
|---|---|
| La cantidad de láminas y el ritmo (qué hace cada una) | El tema: la función de MaKo |
| La jerarquía: qué es grande, qué es chico, dónde va el color | Las palabras, en voz de partner |
| La estética: fondo, paleta, tipografías parecidas, sombras, adornos | El logo de la herramienta: la estrella de MaKo |
| Las pantallas en tarjetas blancas con sombra | Las pantallas: las de MaKo, dibujadas con sus componentes |
| Los adornos que señalan (flechas a mano, el recuadro que brilla) | La persona: el personaje en cubos, o el retrato de la app si es un referente |
| La caja del CTA y su lugar | La palabra del CTA |

- **Las pantallas son las de la app**, nunca una captura retocada ni un dibujo: se monta el componente real con
  `renderToStaticMarkup` (el registrador de `C:/dev/artefactos-pestanas/herramientas/registrar.mjs`, el CSS compilado de
  `C:/dev/artefactos-pestanas/app.css`) con el negocio de mentira **Nutri Vale** (Valentina Ríos, «Transformación 90 días»,
  US$ 1.500). Se captura a 2x y va adentro de la tarjeta blanca.
- **Lo que la app RESPONDE** (un chat, un análisis) sale de la app o de su prompt real, nunca escrito a mano.
- **El texto se verifica en `origin/main`** antes de escribirlo: `lib/funciones-mako.ts` (`hace` / `noHace`), y el código de la
  función. Lo que está en `noHace` no se dice.
- **Las láminas son HTML a PNG de 1080×1350**, capturadas con Playwright por el turno
  (`node C:/dev/artefactos-animaciones/tools/turno.mjs node C:/dev/carruseles-ventas/tools/capturar.cjs laminas <html> <carpeta>`),
  y se MIRAN una por una al lado de la referencia antes de entregar.

## 3. La plantilla de texto

| Lámina | Qué dice | Ejemplo (IA + Hormozi) |
|---|---|---|
| Portada | La promesa de la referencia, con la función en lugar de su herramienta; la bajada con «Encontré una app que…» | «IA + Hormozi = Tu Coach» / «Encontré una app que lo convierte en tu coach de negocio, *paso a paso.*» |
| Pasos | Un verbo + lo que se toca, con el nombre de pantalla TEXTUAL de la app («Nuevo chat», «Second Brain») | «Elige a Hormozi» / «Toca «Nuevo chat». Hay 32 referentes…» |
| Resultado | Lo que hace la app, con una respuesta real | «Ahora audita todo tu negocio.» |
| CTA | La pregunta de la referencia + «Comenta “PALABRA” y te la paso.» | «¿Quieres la guía paso a paso?» / «Comenta “HORMOZI” y te la paso.» |

⛔ **Regla de Martín del 19/11 para todas las series** («no se entiende, sobre todo el hook… copiar los hooks de las
estructuras… no utilizar palabras técnicas… ser más simple»): el gancho sigue la fórmula de la primera frase de la referencia y se
entiende en un segundo sin saber de marketing. Nunca «CRM» (→ «tu lista de clientes»), «landing» (→ «tu página de ventas»),
«lead», «setter», «prompt», «funnel», «SPIN», «B-roll», «CTA», «downsell»; en una PANTALLA de la app sí se ve el nombre real.
Los referentes, por su nombre corto (Hormozi). El personaje en cubos no tiene que salir siempre: el protagonista es lo que muestra
la referencia. Los 5 primeros se repasaron con esta regla (`tools/arreglo-simple.py`).

**El ticket va por familias** (pedido de Martín a la serie 3): cada cuenta con apps que se usan juntas. El cierre del carrusel
AHORRO suma sólo la sala de ventas: HighLevel 97 + respond.io 99 + Zapier 29,99 = US$ 225,99 (verificados el 19/11).

Reglas de la voz (las de la serie 3):
- Partner, nunca vendedor: «encontré una app que…»; nunca «dentro de MaKo vas a poder». El nombre «MaKo» aparece una vez (en la
  portada, en el lugar del logo de la herramienta de la referencia).
- Español neutro con «tú», neutro en género, frases cortas.
- Nada «gratis» ni «ilimitado» de algo que gasta MaKo Tokens. Números reales (32 referentes = `ASESORES.length`).
- Una palabra de CTA distinta por carrusel, en MAYÚSCULA y entre comillas, igual que la referencia.

## 4. Los carruseles

Los temas salen de la serie 3 (`docs/series/serie-3-ventas.md` en `punta/serie-ventas`, «Los videos, uno por renglón»): CUBOS
(el método, sin MaKo), TICKET, COPIAR, GRUPO, CARRUSEL, GUION, CURSO, GANCHO y OFERTA, cada uno con su palabra. Las referencias
que guardó Martín para esta serie las clasificó el chat «Inspiración»: las láminas están en `C:/dev/inspiracion/piezas/NN/`
(#01, #13, #36, #69 y #76 seguras; #55, #57, #58 y #62 en duda: son de tipografías y fondos).

| # | Tema | Referencia | Palabra | Estado |
|---|---|---|---|---|
| 1 | Chatear con referentes (Hormozi como coach) | `DaZFc_kkttt` @lifeofarjav, 6 láminas, x455 | HORMOZI | Hecho (19/11) |
| 2 | Lo que ya pagas (el ticket), sala por sala | `DfHpnVxkaS4` @vilmanunez, 7 láminas, x4,5 | AHORRO | Hecho (19/11) |
| 3 | El equipo de agentes: setter, analista de llamadas, cobrador | `DcnHxFDgv2y` @albert.olgaard, 7 láminas, x169 | EQUIPO | Hecho (19/11) |
| 4 | Siete cosas que hago con una sola app (Spy, Copywriting, Automations, Video, Image, Classroom, Second Brain) | `Del4gFkmTyW` @tinnaloaizaofficial, 12 láminas, x2,2 | SIETE | Hecho (19/11) |
| 5 | Nueve referentes que te enseñan más que la facultad | `DTA2kpHCLOW` @awakpenn, 11 láminas, x225 | REFERENTES | Hecho (19/11) |
| 6 | Páginas que venden: cópialas (Web Generator › Replicar) | `DfHzvg_mTiU` @textura.us, 9 láminas (la guardó Martín) | COPIAR | Hecho (19/11) |
| 7 | Deja de hacer carruseles aburridos (las estructuras de Image) | `De2Durokr-D` @adarshxdesign, 7 láminas (la guardó Martín) | CARRUSEL | Hecho (19/11) |
| 8 | WhatsApp + IA = tu lista (sacar la gente de un grupo) | `DaZFc_kkttt` otra vez (la del 1) | GRUPO | Hecho (19/11) |
| 9 | Deja de escribir ganchos aburridos (plantilla «10 ganchos» de Copywriting) | `DfQb-eqnJ3Q` @ramiro.cubria, 7 láminas, x41, 16.680 comentarios | GANCHO | Hecho (19/11) |
| 10 | La oferta en 7 tuits (las 9 partes con que la app la puntúa) | `Dfv2Z-HiA00` @AlexHormozi, 8 láminas | OFERTA | Hecho (19/11) |
| 11 | Deja de improvisar tus reels (plantilla «Reel que trae mensajes») | `Dffx80AmQZW` @ramiro.cubria, 5 láminas | GUION | Hecho (19/11) |

Las referencias de Ramiro Cubría, Víctor Heras y Hormozi las juntó el chat de Referentes: `C:/dev/referentes-videos/carruseles-de-venta.md`
(estructura lámina por lámina y por qué vende; láminas en `C:/dev/referentes-videos/<cuenta>/pub/<id>/`). **Falta CURSO:** la referencia
que mejor va («Mata la pregunta del precio», de Hormozi, `Dfyl114CP0z`) es de dibujos de palitos, una idea por lámina; hay que
dibujarlos (SVG) o elegir otra. Los casos de cliente de Ramiro piden cifras reales de un cliente con su permiso: no se usaron.

Los archivos: `C:/dev/carruseles-ventas/<slug>/` (`carrusel.html`, `laminas/NN.png`, `piezas/` con las pantallas dibujadas) y los
scripts en `C:/dev/carruseles-ventas/tools/` (`dibujar-*.tsx`, `escribir-*.py`, `arreglo-*.py`, `capturar.cjs`). Las referencias, en
`C:/dev/carruseles-ventas/ref/<código>/`. Cada uno llevó 2 o 3 vueltas de MIRAR y corregir (lo que se corrigió, en «Errores»).

**Antes de publicar cualquiera:** la respuesta automática a su palabra tiene que existir (lo mismo que la serie 3), y la guía
que promete el de HORMOZI hay que armarla.

Una palabra por pieza, también entre el video y el carrusel del mismo tema (TICKET es la del video del ticket; el carrusel usa
AHORRO): así se mide qué pieza trae los comentarios.

## 5. Para el chat que lo prueba DENTRO de MaKo

La prueba: hacer los mismos carruseles en Image, como lo haría un cliente, y ponerlos al lado de los de acá (el artefacto los
tiene con su referencia). Las 5 referencias están en la biblioteca de ejemplos (`carruseles_biblioteca_piezas`, por su `ref`).

1. Image › la biblioteca › buscar la cuenta (@lifeofarjav, @vilmanunez, @albert.olgaard, @tinnaloaizaofficial, @awakpenn) ›
   la tarjeta › «Editar» (el guiado: `lib/carruseles/guiado.ts`, `PedidoGuiado`).
2. En el pedido, lo de la plantilla de texto de arriba: el tema (la función de MaKo), la voz de partner («encontré una app…»,
   «se llama MaKo» una vez) y la palabra del CTA. La réplica ya sabe que el original pide comentar una palabra
   (`promptDeReplica`, `cta`) y pide «una palabra que tenga sentido para este negocio»: hay que decirle CUÁL.
3. Comparar lámina por lámina con la nuestra: cantidad de láminas, jerarquía, estética, texto, CTA.

Lo que de entrada NO va a salir igual, y es lo que hay que iterar (o decidir que no hace falta):
- **Las pantallas de MaKo.** Acá se dibujan con el componente real. La réplica pone la «plancha» del original (la lámina sin
  sus letras) o una imagen generada con IA: no tiene de dónde sacar una pantalla de la app. Para el negocio de un cliente no
  hace falta (no vende MaKo); para el contenido de Martín, sí.
- **La persona.** Acá es el personaje en cubos (o el retrato del referente que muestra la app). La réplica pone la foto del
  cliente generada con IA (su avatar).
- **Lo que la referencia promete.** La IA no sabe que «24/7» es falso para el setter; acá se verificó en el código. Para un
  cliente vale lo mismo con SU oferta: el Second Brain es lo que tiene que frenar una promesa que el negocio no cumple.
- **Los números de otras apps.** Acá sólo entran los verificados; la IA de la réplica no tiene esa lista.

## 6. Errores que aparecieron (y la regla que dejan)

- **`DffeOMPgNyA` (la referencia «del mismo estilo» de la serie 3) es un VIDEO, no un carrusel**, aunque su link sea `/p/`: un
  `/p/` puede ser un reel. Antes de elegir, se mira el `medio`.
- **El `curl` de `instagram.com/p/<código>/embed/captioned/` no trae las láminas** (0 `display_url`): las sirve el JavaScript.
  Para los que están en la biblioteca, se usan sus `laminas_imagenes`; para los demás, `ig_carrusel.cjs` con navegador.
- **No había ninguna conversación con un gurú en producción** (`chart_chats` con `…referente-…`: 0 filas el 19/11), así que la
  respuesta del resultado se generó con el contexto REAL del gurú (`contextoDeReferente('hormozi')` + `CONTEXTO_SECOND_BRAIN`)
  y el negocio de mentira, por script (`C:/dev/carruseles-ventas/respuesta-hormozi.json`). Sin el resto del system del turno
  (`VOZ_APP`, `REGLA_NO_EXISTE`), la respuesta nombró el curso («100M Money Models»), que Martín no quiere que se nombre: esa
  frase no va en la lámina. Dentro de MaKo el chat usa el system entero.
- **Lo que la referencia promete no siempre es verdad en MaKo: se verifica la frase, no la función.** «They work 24/7» (la
  lámina 6 de `DcnHxFDgv2y`) es falso para el setter con IA: sin horario de oficina, contesta SOLO de 9 a 21 hora del negocio
  (`HORARIO_RESPUESTA_SOLA`, `lib/setter-conversacion.ts`), hasta 3 respuestas solas por día (`TOPE_RESPUESTAS_SOLAS_24H`), y
  lo que habla de plata queda en borrador (`HABLA_DE_PLATA`). La lámina se cambia por algo que sí hace.
- **«Inspirado en», no «es»:** el chat con un gurú es MaKo con su método (`saludoDelReferente`: «Te ayudo con el método de Alex
  Hormozi, llevado a tu negocio»). «Te contesta como lo haría Hormozi» se cambió por «te contesta con el método de Hormozi», y
  la portada lleva el «Inspirado en Alex Hormozi» que muestra la app.
- **El chat adjunta imágenes y PDF** (`ACCEPT_ADJUNTOS_CHAT`, `lib/mako-adjuntos.ts`): un `.docx` en la pantalla de ejemplo
  hubiera sido un archivo que la caja no deja elegir.
- **Precios de otras apps: sólo los 4 verificados por la serie 3** (HighLevel 97, Skool 99, Zapier 29,99, CapCut 17,99, el
  19/11, en su página oficial). Los de `STACK_TIPICO` de la landing no alcanzan: CapCut ahí dice 19,99. La suma se hace con un
  script (la primera a mano dio 243,97; es 243,98).
- **Las capturas de pestañas con fotos de personas reales se recortan** (las landings de referencia del Web Generator).
- **Una pantalla en negro en la lámina = una imagen que no está.** El `cp` de las capturas iba en el mismo comando que un
  heredoc de Python que el Bash no pudo leer; el comando entero no corrió y nadie avisó. El teléfono y el monitor del carrusel
  del equipo salieron negros. Los scripts largos van a un archivo (`tools/escribir-*.py`), y cada lámina se MIRA.
- **Lo que se ve chico en la referencia también se ve chico acá, pero el gris vacío no.** Las pantallas del carrusel 1 salieron
  con la mitad de la tarjeta en gris: el panel de chat se dibujó a 900 × 900. Se dibuja al tamaño de lo que se cuenta (620 × 400
  para un mensaje con adjuntos) y la tarjeta toma esa proporción.
- **La caja de terminal en mono no se parte bien:** 38 px de IBM Plex Mono en 620 px de ancho cortaba cada renglón en dos y la
  caja se comía el pie. Mono a 34 px, `white-space: nowrap`, y renglones de ≤ 30 letras.
- **Un ejemplo de la app puede venir roto: se elige la lámina, no el ejemplo entero.** En «Ver ejemplo», 6 de 54 láminas (en «Mito vs.
  realidad», «Antes y después», «Paso a paso» y «Opinión») (dibujados con `documentoDeCarrusel` + `PaginaCarrusel` y las fuentes del catálogo) hay títulos largos que se
  montan sobre el texto de abajo. Para el carrusel 7 se eligieron las 4 láminas limpias de cada estructura; la falla queda anotada
  en `docs/hallazgos-contenido.md` para Image.
- **Tuits con la voz de Martín, nunca con las palabras de la referencia.** El formato de tuits de Hormozi se copia; sus frases no
  («hasta que te digan que eres caro…» es suya). Cada tuit sale de algo que la app sabe medir (las 9 partes de una oferta,
  `lib/offer-marco.ts`) y se revisa el género («alguien como ella» se cambió por «alguien parecido»).
- **La palabra del CTA cambia el largo:** «Comment “GIFT”» entra en una línea; «Comenta “HORMOZI”» no, y empujó el resto fuera de
  la caja. Se mide con la palabra real.
