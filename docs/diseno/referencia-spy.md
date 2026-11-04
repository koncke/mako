# La referencia de Competitors Spy, medida

Leída con el navegador el **1/11/2026** sobre `demo.codeandchill.store`, en tema claro, a 1440×900.
Esto no es una impresión de una captura: son el árbol del DOM, las medidas y las reglas CSS tal como
las sirve el sitio.

Existe porque Martín pidió cuatro veces lo mismo y cuatro veces se entregó otra cosa:

> «te pido por favor que visualmente lo copies de otro dashboard, no te inventes cosas»
> «rediseñes **toda la tab** siguiendo una referencia **no que corrijas o intentes mejorar lo que ya
> hiciste**»

**La trampa, y es de método:** las dos primeras vueltas sí tocaron la tab —una reordenó las filas,
la otra cambió los tokens— y las dos se sintieron como trabajo hecho. Pero las dos partieron de la
pantalla que ya estaba y le cambiaron la superficie. Copiar una referencia es **empezar por la
referencia**: abrirla, medirle el esqueleto, y recién después mirar qué de lo nuestro entra ahí.
Si el primer archivo que abriste es el tuyo, no estás copiando.

---

## Por qué estas dos plantillas

Spy es **un catálogo de piezas que se filtra**, más **un análisis de lo que se leyó**. Ninguna
plantilla sola es las dos cosas:

| | Plantilla | Qué se copió |
|---|---|---|
| El catálogo | `fitlo` → `/#/shop/all` | título, pestañas con conteo, barra de herramientas, grilla de tarjetas |
| El análisis | `merrin` → `/` | el riel de 336 px y las celdas pastel de datos |

`fitlo` está descrita en `familias-y-tokens-3.json` como «una tienda (27 tarjetas de producto)», que
es exactamente la forma de Spy. Las dos son de la familia **clara sólida**: fondo que no es blanco,
tarjeta un tono más clara, líneas que son la tinta con alfa.

---

## El esqueleto de `fitlo /shop`

```
div.page.shop
  header.phead         [1109x67]   h1 clamp(28px,2.6vw,38px)/600, ls -.025em, lh 1.04
                                   p  --muted, --fs-base, margin-top 8
  nav.tabs             [1109x43]   border-bottom 1px --line, gap 4, margin-bottom 20
    a                  [h 42]      --fs-md/600, --muted; activa → --ink + barra 2px --accent abajo
      span.badge       [20x20]     --fs-2xs/700, bg --card-3, r 99, pad 0 6
  div.toolbar          [1109x42]   flex wrap, align center, gap 10, margin-bottom 14
    label.inwrap       [360x42]    flex 1 1 240px, max-width 360px — el ícono absoluto a 12 px
      input.input      [h 42]      r 12, inset 0 0 0 1px --line-2, pad 0 13 (38 a la izquierda)
    div.chips                      gap 6
      button.chip      [h 32]      r 10 (en la toolbar, 99), --fs-sm/600, --muted, bg --card
                                   pressed → bg --accent, color --accent-ink, sin sombra
    label.sortby       [183x38]    select r 99, h 38, width auto
  p.shop__count        [h 18]      --muted/600, --fs-sm, margin-bottom 12
  div.pgrid                        grid repeat(4, minmax(0,1fr)), gap --gap (18)
    article.pcard      [264x411]   r --r-xl, SIN borde: su fondo es un TINTE (.tint-1..6)
      a.pcard__media   [264x330]   aspect-ratio 4/5, el creativo a sangre
      div.pcard__dots              abs top 16 left 14; i 18x18 r 50%
                                   shadow 0 0 0 2px --card, inset 0 0 0 1px #0000001f
      button.pcard__save [36x36]   abs top 12 right 12, r 12, bg --card, --shadow
      .pcard__tag      [h 26]      abs bottom 12 left 14, r 99, --fs-xs/700, bg --card
      .pcard__fit      [h 26]      igual pero oscura: bg rgba(22,26,25,.82), color #fff
                                   .pcard__tag + .pcard__fit → bottom 44  (DOS píldoras apiladas)
      div.pcard__foot  [264x66]    flex align-end gap 10, pad 12 14 14 16
        .pcard__text               small --fs-xs/600 --muted (bloque) · b --fs-lg/600 lh1.25 clamp 2
        .pcard__buy    [h 40]      r 99, bg --accent — el número fuerte de la derecha
```

**La tarjeta no tiene borde: tiene un tinte.** Es lo que hace que la grilla se lea como un catálogo
y no como una tabla. En Spy el tinte dice **de qué canal es la pieza**, así que el canal ya no
necesita una fila con un ícono y una palabra.

## El esqueleto de `merrin /`

```
div.page.home
  header.phead                      el mismo .phead
    div.daybar                      chips de aviso: h 32, r 99, bg --card, inset 1px --line
  div.home__grid     grid(minmax(0,1fr) 336px) gap 18  align-items start   ← LAS DOS COLUMNAS
    section.card.hero [759x525]     r --r-lg, bg --card, inset 1px --line + --shadow, pad 18 20 20
      div.hero__tiles               grid de 4, gap 10
        button.kpi     [175x128]    r --r-lg, bg --tile-1..4, pad 16 18 14
          .kpi__label               --fs-sm/600, color --tile-muted
          .kpi__value               --fs-3xl/600, margin-top 10, ls -.01em
          .kpi__foot                --fs-xs/600, margin-top auto, padding-top 8
      div.chead                     h2 --fs-lg/600 · p --fs-sm --muted, margin-bottom 14
    div.stack.home__side [336]      flex column, gap 18
      section.card.mix
        div.mix__bar    [h 12]      flex gap 3; .mix__seg r 4, min-width 6 — la barra apilada
        ul.mix__rows                li: flex align center gap 10, pad 7 0
          .mix__ico     [30x30]     r 9, bg --card-2, inset 1px --line
          .mix__name                b --fs-md/600 (bloque) · small --muted
          .mix__val                 columna, align-end, gap 2
      section.card.floor
        ol.floor__steps             grid de 2, gap 8 — las mini celdas de 144 px
```

**La regla de color que ordena todo:** cada plantilla nombra su serie por **lo que es**, no por un
número (`--ch-web`, `--ch-market`, `--ch-wholesale`, `--ch-studio`). El mismo concepto lleva el mismo
color en la barra, en la fila y en el chip, y así no hay que leer la leyenda. En Spy: el canal tiene
su color (el de la marca, el que ya vive en `ServicioVisual.tsx`) y lo que no es un canal —formatos,
destinos— usa la serie de cuatro de merrin.

## Los tokens, leídos del `:root` en claro

| merrin | valor | la casa (`app/globals.css`) |
|---|---|---|
| `--bg` | `#e6e7ea` | `--bg #efefed` |
| `--card` | `#fbfbfc` | `--surface #fcfcfb` |
| `--card-2` | `#f2f3f5` | `--surface-2 #f0f0ef` |
| `--card-3` | `#e4e5e9` | `--primary-bg #e4e4e1` |
| `--ink` / `--ink-2` / `--muted` | `#17181c` · `#363840` · `#5d606a` | `--ink` · `--dim` · `--faint` |
| `--line` / `--line-2` | `#17181c14` · `#17181c26` | `--border` · `--border-strong` |
| `--good` / `--bad` / `--warn` / `--info` | `#1b7746` · `#b5381a` · `#875700` · `#23559f` | los mismos con `-bg` |
| `--tile-1..4` | `#e5e8cd` `#d9e8e1` `#f0e4cc` `#dbe3ef` | **no existían** — van en `.spy` |
| `--ch-*` | `#64761a` `#c0643c` `#4b6fa3` `#c4952c` | **no existían** — van en `.spy` como `--s1..4` |
| `--gap` | `18px` | la casa tiene `--sect-gap: 16px`; el riel y la grilla van en 18 |
| `--r-sm/md/lg/xl` | `10 · 14 · 18 · 24` | `8 · 14 · 22 · 28` |
| `--shadow` | `0 1px 2px #17181c0d, 0 10px 26px -16px #17181c33` | `--sombra-tarjeta` |
| escala | `11 · 12 · 12.5 · 13.5 · 14 · 15 · 17 · 20 · 22` | `--fs-meta/sm/md/card/sect/kpi` |

Cuerpo en **14 px**, tipografía **Urbanist** (la casa usa Geist; no se cambió).

## El modal de «Mirar a alguien más»: el `.finder` de `merrin`

Medido el **3/11/2026** en `merrin` a 1440×900, en claro y en oscuro. Martín: «No se mejoró ni el modal,
sigue horrible el diseño». El que había medía 480×254 con **`padding: 0`** en la caja: el texto pegado a
los bordes, un campo gris, otro campo blanco y dos botones «Buscar».

Se eligió por la FORMA otra vez. `merrin` es un CRM y tiene dos candidatos: su modal «New customer»
(`.modal`, un formulario) y su buscador de ⌘K (`.finder`, escribir → filas → elegir). Spy busca: el
formulario era el que había, y era el problema.

```
div.scrim                    fixed inset 0, z 60, rgba(18,20,16,.38) — oscuro rgba(0,0,0,.55)
div.finder     [620x…]       fixed top 12vh, left 50%, width min(620px, 100vw - 24px),
                             margin-left max(-310px, 12px - 50vw), r 22, bg --card, overflow hidden
                             shadow --shadow-lg + inset 0 0 0 1px --line-2
  div.finder__in   [h 60]    flex align center, gap 10, pad 0 16, border-bottom 1px --line
    svg            [20]
    input                    flex 1, h 100%, SIN fondo y SIN borde, --fs-xl (17)/500, sin outline
    span.kbd       [26x24]   r 7, bg --card-2, inset 1px --line, 11/700, --muted  «esc»
  div.finder__list           max-height min(56vh, 460px), pad 8, overflow-y auto
    div.finder__group        11/700, ls .06em, MAYÚSCULAS, --muted, pad 10 10 4
    div.finder__item [h 53]  flex align center, gap 12, pad 8 10, r 12;  selected → bg --card-2
      span.finder__ico [36]  r 10, bg --card-2 (una persona: círculo con iniciales)
      span.cell__text        b 14/600, 20 de alto · small 12/500 --muted, 17 de alto
      svg            [18]    la flecha, --muted
  div.finder__foot           flex gap 14, pad 10 16, border-top 1px --line, 12, --muted
```

**Vacío, sin escribir:** muestra lo que ya existe (pedidos, clientes, páginas), no una explicación.
**En el teléfono** (`width <= 760px`): `top: calc(10px + env(safe-area-inset-top))`, lista
`min(64dvh, 520px)`, y con `hover: none` el pie de las teclas se va.

| merrin | Spy (`app/competitor-spy/BuscadorAlta.tsx`) |
|---|---|
| Sus grupos: pedidos, clientes, páginas | «Ya los miras», «Instagram», «YouTube» / «Sitio» / «TikTok», «Sin redes» |
| `--card` · `--card-2` · `--line` · `--line-2` · `--muted` | `--surface` · `--surface-2` · `--border` · `--border-strong` · `--faint` |
| `--shadow-lg` | `--sombra-modal` |
| El acento oliva | `--accent`, el dorado de MaKo (claro y oscuro) |
| `z-index` 60 / 75 | 300, porque la casa apila el banner de alertas y `ModalShell` ahí |

**Lo que se agregó, porque Spy lo necesita y `merrin` no:** las filas esqueleto (`merrin` busca en memoria;
acá Apify tarda ~20 s) y la confirmación con su cara, porque Martín pidió que nada entre sin validar.

Capturas de la referencia y del antes: `side-session-notes/.../spy-modal-0311/`.

## Lo que NO se copió, y por qué

* **El `.pcard__save`** (el corazón de guardar). Spy no tiene «guardar pieza» y una estrella que no
  hace nada es peor que no tenerla.
* **Los deltas** (`↑ 2.2 %`) de las celdas de merrin. Spy lee **una sola vez**: no hay dos
  mediciones, así que un delta sería inventado. Lo dice la cabecera de `SpyApp.tsx`.
* **La barra lateral de 236 px.** Spy es una tab adentro de MaKo; la barra ya existe afuera.
