# Relevo — Replicar un carrusel, guiado por MaKo (pedido de Martín del 9/11/2026)

Lo escribe la sesión de la nube que hace el trabajo, en la rama `punta/carruseles-guiado`. La nube no llega a la base, a Flow
ni a la IA de ningún negocio: lo de abajo se probó con tests y con datos inventados. Lo que falta medir con la IA real está
marcado **SIN MEDIR**.

## El pedido, en sus palabras

1. «Le acabo de dar a crear un carrusel, me llevó directamente al editor y no está bueno eso… no replicó bien el diseño. Sí,
   son editables las letras, pero se superponen unas con otras, no era la tipografía correcta.» Y al replicar: «empieza a
   replicarlo y dice lo voy a hacer con tu oferta, pero ni siquiera me pregunta qué oferta».
2. Un proceso guiado, como el de video: al elegir un carrusel se abre una pestaña donde MaKo pregunta en su chat, «con el
   tutorial que se opaca la pantalla, que le vaya señalando la pregunta»: qué oferta (las suyas, cliqueables), qué avatar
   (SÓLO si el carrusel tiene una persona: «si es solo texto, que lo detecte y no le pregunte eso») y qué quiere cambiar.
3. Imágenes: «replicarlo con la generación de imágenes que ya tenemos conectada»: sacar el avatar de la competencia y poner
   el suyo, o copiar el estilo y agregar otra cosa.
4. Tipografía fiel y editable.
5. «Nuevo carrusel» muestra los OUTLIERS; se elimina «¿Qué vas a crear hoy?».
6. La barra del chat de MaKo nunca desaparece: «si no, yo no tengo forma de… ver los carruseles que ya estaba creando».
7. Los carruseles animados (con video): otro tema, sólo anotado (abajo).

## El diseño, en una pantalla

El mismo esqueleto que el proceso de video (`docs/plantillas-video/mensaje-para/PROCESO.md`): **la referencia → descubrir
qué quiere → la base → generar de a una lámina → que la persona lo vea al lado del original → editable**.

```
/image-editor                         (PantallaCrear, como toda tab de Create)
┌──────────────┬───────────────────────────────────────────────────────────────┐
│ MaKo (chat)  │  Outliers: la biblioteca ordenada por rendimiento             │
│  ← tus       │  (la grilla de siempre: ExplorarCarruseles)                   │
│  diseños     │  «Crear desde cero» es una pastilla: abre un carrusel vacío   │
└──────────────┴───────────────────────────────────────────────────────────────┘
        │ «Replicar» en un carrusel
        ▼
/image-editor?replicar=<id>          (la pestaña guiada)
┌──────────────┬───────────────────────────────────────────────────────────────┐
│ MaKo, sobre  │  El original, lámina por lámina, a tamaño real                │
│ ESTE carrusel│  ░░░░ velo: la pantalla se opaca y señala la pregunta ░░░░░    │
│ ¿Para cuál   │  (el VeloGuia de la casa, con el ancla en la pregunta)        │
│ oferta?      │                                                               │
│ [Oferta A★]  │  Después de «Generar»: cada lámina, original | tuya, al lado  │
│ [Oferta B]   │                                                               │
└──────────────┴───────────────────────────────────────────────────────────────┘
```

### 1. La tab (pedidos 5 y 6)

- `/image-editor` es `PantallaCrear` **siempre**: a la izquierda el chat de MaKo (su «←» da vuelta la tarjeta a «Nuevo
  carrusel» y los diseños del negocio), en el centro los outliers. Antes la portada era la grilla SOLA, sin la tarjeta, y por
  eso Martín no encontraba sus diseños.
- «Nuevo carrusel» (el primer renglón de la lista) muestra los outliers, no las plantillas. «¿Qué vas a crear hoy?» se va de
  Image: `PantallaCrear` gana la prop `nueva` (lo que la tab pone en lugar de la caja y las plantillas). Las demás tabs de
  Create no cambian.
- «Crear desde cero» queda como una pastilla del explorador: crea un carrusel vacío de 1080 × 1350 (`ID_CARRUSEL`) y lo abre.
- `?ver=crear` (los links viejos, el teléfono, el editor) abre lo mismo que `/image-editor`: nada se rompe.

### 2. El descubrimiento (pedidos 1 y 2)

Lo decide el CÓDIGO, sin IA, en `lib/carruseles/guiado.ts` (puro, con su test). Cada pregunta es una apertura de la casa
(`Apertura` de lib/aperturas/reglas.ts: una pregunta de hecho, de 2 a 4 botones, el primero recomendado, uno de callar) y se
dibuja con `AperturaMako`, la pieza de todos los chats. El orden:

| # | Pregunta | Cuándo se hace | Botones |
|---|---|---|---|
| 1 | «¿Para cuál oferta es?» | siempre | sus ofertas activas, la principal primero (de a 2, con «Ver más»); sin ofertas: «Cargar una oferta» (va a /offer) y «Lo escribo yo» |
| 2 | «¿Quién va en lugar de la persona?» | SÓLO si la lectura dice que hay una persona; si la lectura no pudo decirlo, también, con «No tiene persona» | «Mi cara de marca», «Mi último look», «Sin persona»; sin foto cargada: «Subir mi foto» (va a AI Avatar) |
| 3 | «¿Qué cambio además del texto?» | siempre | «Sólo los textos» ★, «Textos y mis colores» (con kit de marca), «Lo escribo yo» |
| 4 | El resumen: «N láminas para «Oferta», con tu cara de marca, cambiando sólo los textos.» | al final | «Generar» ★, «Cambiar algo» |

- **La lectura** (¿hay una persona?, ¿hay lettering?) la hace la IA del negocio mirando las primeras láminas, en paralelo a la
  primera pregunta (la oferta no depende de la imagen). Sin IA conectada, la lectura no se hace y la pregunta 2 se hace con
  «No tiene persona» como opción: preguntar de más cuesta un toque; no preguntar pone la cara del competidor.
- **«Lo escribo yo»** pasa la caja del chat a contestar esa pregunta: lo que se escriba es la respuesta, no un pedido al
  Cerebro (así anda sin la app de escritorio). Escrito en cualquier otro momento, se anota como pedido extra y la pregunta
  sigue.
- **El velo** es el de la casa (`VeloGuia`, app/_ui/guia/): la pestaña se opaca, el chat queda a la vista y la pregunta lleva
  el aro. El ancla es `im-pregunta` (catálogo nuevo `app/image-editor/guia-image.ts`). Tocar otra parte pausa el velo, como en
  todas las tabs.
- **La oferta elegida viaja al prompt como DATOS** (nombre, promesa, para quién, precio, garantía; `bloqueDeOferta`), con la
  regla «si un dato no está, no se inventa». Antes la IA escribía con «lo que se sabe del negocio», sin saber de qué oferta.

### 3. Las imágenes (pedido 3)

Lo que se genera es la lámina ENTERA con la IA de imagen conectada (Flow, por `encolar('generar_imagen')`; las imágenes de
Flow no gastan créditos), conservando todo y cambiando sólo lo pedido. El camino ya estaba medido el 7/11
(`lib/carruseles/clon-reglas.ts`, «Clonar es CONSERVAR»): el prompt dice primero qué NO se toca. Por lámina:

1. **La plancha:** la lámina original, **un** cambio: sin el texto (y sin el lettering que se rehace aparte).
2. **La persona,** si se eligió un avatar: desde la plancha (base) y con UNA referencia (la cara), **un** cambio: esa persona
   en lugar de la del original. Dos ediciones seguidas es el techo de la casa («no se genera encima de una generación»).
3. Cada lámina se muestra **original | tuya** al lado, al 100 %, antes de abrir el editor («chequear antes de entregar»).

Sin Flow conectado se dice eso y se ofrece el camino de siempre (`replica.ts`: los textos sobre el color del original). Nunca
un fondo inventado.

### 4. La tipografía (pedido 4) — lo recomendado, implementado

a) **La lámina sin texto** (la plancha, arriba).
b) **Encima, capas de texto EDITABLES con la tipografía MEDIDA del original** (`lib/carruseles/tipografia-medida.ts`):
   - la caja, el texto, el color, el peso y la itálica de cada bloque salen de la lectura de la lámina;
   - **la fuente se elige COMPARANDO**: el recorte del original contra la misma frase dibujada con cada candidata del
     catálogo del editor (`app/image-editor/mako/fuentes.ts`), con un puntaje de parecido de los trazos (`parecidoDeTrazos`:
     cuánto se pisan las dos tintas + el perfil de columnas y de filas, que mide el ancho y la altura x). Se dibuja en el
     navegador, que ya carga las fuentes del editor; la regla es pura y se prueba con máscaras;
   - **nunca se superponen**: cada texto se achica hasta entrar en su caja (`encajarEnCaja`) y dos cajas que se pisan se
     separan o se achican (`sinSuperponer`). Lo superpuesto A PROPÓSITO en el original (el «best» y el «font» de
     @growithalex) se conserva: lo declara la lectura, no se adivina.
c) **El lettering** (3D, nubes, lo que ninguna fuente imita): una capa de IMAGEN que guarda su texto
   (`capaDeLettering`). Al cambiar la palabra se regenera SÓLO esa caja, con el recorte como referencia y una frase
   («Same lettering style, it now says "X"»).
d) **Lo editable viene después de lo fiel:** primero la imagen, encima el texto. Se juzga al 100 %, al lado del original.

### 5. Lo que NO se construye

- La edición por partes de la imagen a mano (decisión del 7/11, sigue). Lo de hoy es la IA generando la lámina entera.
- Los carruseles animados (con video): anotados abajo, sin tocar.

## Por partes

| Parte | Qué | Estado |
|---|---|---|
| 1 | Este diseño | ✅ |
| 2 | `lib/carruseles/guiado.ts`: las preguntas, el orden, «Lo escribo yo», el resumen y el pedido que sale | ver abajo |
| 3 | `lib/carruseles/tipografia-medida.ts`: encajar, no superponer, elegir la fuente comparando | ver abajo |
| 4 | `lib/carruseles/plancha.ts`: los pasos de cada lámina, sus prompts y la capa de lettering | ver abajo |
| 5 | La oferta en el prompt de la réplica y en la ruta (`ofertaId`, `avatar`, `cambio`) | ver abajo |
| 6 | La pantalla: la tab con el chat siempre, «Nuevo carrusel» = outliers, la pestaña guiada con el velo | ver abajo |
| 7 | La orquestación con Flow (subir la lámina, pedir la plancha, esperar, guardar) | SIN HACER (abajo) |

## Lo que queda anotado

- **Los carruseles animados** (una lámina con video): necesitan el camino de video (Flow `generar_clip` o ApiMart) y un
  documento del editor que sepa guardar video. Otro tema: no se tocó.
- **El prompt de la plancha está SIN MEDIR.** Es corto, en inglés y con lo que se conserva primero, como el que se midió el
  7/11, pero «sacar el texto» no se probó. El caso de prueba es el de @growithalex (`instagram.com/p/DYfVqEmk_to`, 9 láminas),
  que Martín está haciendo a mano: cuando su paso a paso esté en `docs/plantillas-carrusel/` (rama `punta/creator-activo`), se
  copian de ahí las frases que funcionaron.
- **Compartir con la tab Video.** El chat «Tab Video» arma el mismo patrón; la pieza que se puede compartir es la máquina de
  preguntas: una lista de pasos con su condición y sus botones, y un estado que avanza con cada toque (`lib/carruseles/guiado.ts`
  tiene esa forma a propósito). Si la de video sale primero en otra pieza, se muda acá a la suya; si no, la de video puede
  tomar `avanzarGuiado` tal cual.
