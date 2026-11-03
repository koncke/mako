# Modo oscuro y el movimiento, CAPTURADOS EN VIVO — Merrin, 31/10/2026

Esto no es lectura de código: se apretó el botón y se grabó lo que pasó, con un gancho sobre
`Element.prototype.animate` y sobre `document.startViewTransition`.

## El cambio de tema, grabado

```
1. startViewTransition
2. <html>.animate(
     { clipPath: ["circle(0px at 649.78px 35px)", "circle(926.89px at 649.78px 35px)"] },
     { duration: 450, easing: "cubic-bezier(.65,0,.35,1)", pseudoElement: "::view-transition-new(root)" })
```

El centro (649.78, 35) es **el centro del botón que se apretó**; 926.89 es la distancia a la esquina
más lejana de la ventana. Coincide exacto con lo decodificado del fuente, así que el mecanismo está
confirmado por dos caminos.

Y en el CSS, lo que lo hace visible:

```css
::view-transition-old(root) { mix-blend-mode: normal; animation: none; }
::view-transition-new(root) { mix-blend-mode: normal; animation: none; }
```

Sin apagar el cruzado por defecto, el barrido circular queda tapado por un fundido de las dos capas.

## ⚠️ El cambio de PESTAÑA no anima

Medido en Merrin con el mismo gancho: se hizo clic en «Deals», se esperaron 2 s y el grabador registró
**cero eventos**. Ni `.animate()` ni `startViewTransition`. La pantalla cambia de golpe.

En `fitlo` sí aparece `startViewTransition` en el bundle, pero es **el que trae React** (su soporte
nativo), no código de la plantilla, y no se disparó al navegar. O sea: **la única animación de cambio
de estado que estas plantillas tienen de verdad es la del tema.** Si MaKo quiere animar el cambio de
pantalla, es una decisión nuestra.

## El modo oscuro NO es el claro oscurecido

Esto es lo que más importa de todo el archivo, porque es el error que se comete por defecto.

| | claro | oscuro | qué pasó |
|---|---|---|---|
| `--accent` | `#5f6e14` oliva oscuro | `#b9c95c` lima brillante | **se invierte la luminosidad**: sobre fondo oscuro el acento tiene que ser CLARO |
| `--accent-ink` | `#fff` | `#1b1f05` | y por eso el texto de encima se da vuelta también |
| `--good` | `#1b7746` | `#69c792` | los semáforos se vuelven PASTEL, no se aclaran un poco |
| `--bad` | `#b5381a` | `#f2967a` | ídem — un rojo saturado sobre negro vibra |
| `--c1` | `#b0612d` | `#e3956a` | la paleta categórica entera sube en luz y baja en saturación |
| `--line` | `#17181c14` (tinta con alfa) | `#eeeef014` | la línea sigue siendo la tinta con alfa: **cambia la tinta, no la regla** |
| `--rim` | `#17181c26` | `#ffffff26` | el borde de luz pasa a blanco puro con alfa |
| `--shadow` | tinte de tinta | `#0000004d` / `#0009` | en oscuro la sombra es NEGRO REAL y más opaca: sobre un fondo oscuro una sombra tenue no existe |
| `--side` | `#fbfbfc` (más claro que el fondo) | `#0c0d0f` (**más oscuro** que el fondo) | la barra lateral invierte su relación con el fondo |
| `--paper` | `#fffefc` | `#fffefc` **igual** | una factura es papel: no se oscurece |
| `--mono-ink` | `#17181c` | `#17181c` **igual** | lo que se imprime tampoco |

Tokens de oscuro, completos (Merrin):

```
--bg #111214 · --card #1a1b1e · --card-2 #16171a · --card-3 #27282c
--ink #eeeef0 · --ink-2 #cfd0d5 · --muted #a2a4ac
--line #eeeef014 · --line-2 #eeeef029 · --rim #ffffff26
--shadow 0 1px 2px #0000004d, 0 12px 30px -16px #0009
--shadow-lg 0 2px 6px #0006, 0 30px 70px -24px #000c
--accent #b9c95c · --accent-ink #1b1f05 · --accent-hi #c6d56c · --accent-soft #b9c95c26 · --accent-text #c9d879
--side #0c0d0f · --side-ink #eceef0 · --side-muted #9b9ea6 · --side-hover #ffffff0b · --side-line #ffffff12
--side-tile #1e2414 · --side-card #16171a
--good #69c792 · --warn #e3ae58 · --bad #f2967a · --info #8bb2ee  (los -soft, todos con alfa 24)
--tile-1 #2a2e1a · --tile-2 #1d2d27 · --tile-3 #32291b · --tile-4 #1f2735 · --tile-ink #eeeef0
--c1 #e3956a · --c2 #e0b456 · --c3 #4cc1b8 · --c4 #8aa9e0
--k-call #b9c95c · --k-demo #85a6e3 · --k-visit #4cc1b8 · --k-shoot #e2b35a · --k-task #9b9ea8
--paper #fffefc · --paper-ink #1d1e22 · --mono-ink #17181c · --stamp #b5381a
```

**La regla que queda:** en oscuro no se oscurece la paleta, **se invierte la luminosidad y se baja la
saturación**, y el color del texto viaja con su fondo (`--accent` / `--accent-ink`). Lo único que se
mantiene igual es lo que representa papel.

## Una cosa que NO conviene copiar

Al pasar a oscuro, la plantilla deja `<meta name="theme-color">` en **`#e6e7ea`**, que es el fondo del
tema CLARO. En el teléfono eso pinta la barra del navegador del color equivocado. En `fitlo` el código
sí la pone bien (`#111514` en oscuro). Parece un descuido de Merrin: se copia el mecanismo, no el
valor.
