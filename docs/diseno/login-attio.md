# El login copia a Attio — valores medidos el 15/11/2026

Martín, 15/11/2026: *«tampoco me gusta el rediseño que hiciste del login. O sea, está súper
simple. Yo quiero que sea un muy buen rediseño. Cópialo de otra aplicación o algo, pero quiero
un rediseño completo del login»*.

**Fuente: `app.attio.com/welcome/sign-in`**, leída en el navegador a 1440×900 con
`getComputedStyle`. No de memoria.

## Por qué Attio y no otra

Se miraron cuatro de verdad, no de memoria:

| App | Qué es | Por qué sí / no |
|---|---|---|
| **Attio** | CRM | **El molde.** Mismo problema que MaKo, y ya trae la jerarquía del 14/11: Google primario a todo el ancho, «o», correo abajo. |
| Supabase | dashboard | Mismos dos paneles, pero el panel de marca es plano (una cita sobre fondo liso). De acá sale **una sola cosa: el corte móvil** — su panel derecho está `hidden` hasta `xl`. |
| Railway | PaaS | Tarjeta centrada: es exactamente lo que Martín rechazó. |
| Clerk | auth | El formulario es un widget que no terminó de dibujarse; no se pudo medir. |

## Los números (Attio, 1440×900)

| Pieza | Valor leído |
|---|---|
| Cáscara | `padding: 32px 24px 84px` |
| Wordmark | 80×20, centrado arriba, `y=32` — **fuera** del marco |
| **Marco** | `border-radius: 16px` · `border: 0.8px rgba(255,255,255,.07)` · `overflow: hidden` · **sin relleno y sin sombra** (es un contorno, no una tarjeta) |
| Panel izquierdo | **486 px** · `padding: 40px 32px 32px` · columna interna **422 px** (486 − 64) |
| Raya divisoria | el `border-left` del panel derecho, 0,8 px, mismo 7 % |
| Panel derecho | **904 px** → la proporción es **35 / 65** |
| Huecos de la columna | 32 px entre bloques · 12 px dentro del encabezado · 4 px el apretado |
| Título | 18 px / 600 / `-0.36px` / `lh 24px` — **chico**: es un rótulo, no un héroe |
| Cita | 24 px serif (Tiempos Text) / 400 / `lh 27.6px` / `-0.24px` / centrada / **ancho 428 px** |
| Autor | 14 px / 500 / tinta al 60 % |
| Botón Google | alto 36 px · `radius 10px` · a todo el ancho de la columna |
| Campo | alto 36 px · `radius 10px` · `padding: 0 4px 0 10px` |

## El panel de marca: dos capas pintadas, nada más

Es lo que lo saca de «simple», y no pesa: **no hay imagen, ni video, ni librería**. Su SVG
(`viewBox="0 0 900 780"`, `preserveAspectRatio="none"`) son dos `<rect>` a pantalla completa:

1. **Degradado diagonal del color de marca.** `linearGradient` de `userSpaceOnUse`
   (120.75,159.25 → 1476,1710), con los dos `stop` en el **mismo azul de marca**
   `rgb(38,109,240)`: `stop-opacity .04` → `stop-opacity .1`.
2. **Rayas verticales.** `pattern` de `8.1 × 1`, con un `rect x=7.6 width=1 height=1` al
   `rgba(255,255,255,.07)`, y la capa entera a `fill-opacity: 0.3` (≈ 2 % efectivo).

**Attio no anima nada de esto.** Está quieto.

## Qué se copió y qué no

- **Sí:** la estructura entera, la proporción 35/65, los paddings, el contorno sin relleno, el
  ancho de la columna, los huecos, la proporción de la frase (428 px a 24 px de cuerpo ≈ 17,8×)
  y las dos capas del panel (4 %→10 % + raya de 1 px cada 8,1 px al 7 % × 0,3).
- **No, los colores:** Attio es un competidor, no una referencia de estilo que mandó Martín.
  De un competidor se copia la estructura y los números; la tinta es la de la casa
  (`--mako`, `--ink`, `--border`, `--surface`, `--bg`), así el claro/oscuro llega.
- **No, la letra:** Geist, no su serif.
- **No, el testimonio:** el slot de la cita lleva el titular que Martín fijó el 13/11 para
  «todos lados» (*El mejor software para vender High Ticket*). Inventar un cliente y ponerle
  una frase en la boca sería fabricar un testimonio. **Si hay uno real, ese es su lugar.**
- **No, una animación:** la fuente no tiene ninguna, y agregarle movimiento que la fuente no
  tiene es inventar.

## Los 32 px de costado no son `padding`, son el margen de la columna

Único lugar donde la implementación se separa a propósito de la fuente, y hay que saber por qué:
el panel izquierdo es el **contenedor de scroll** (lo pide el alta del 2FA con el QR, que mide 687
de alto). Con `padding: 40px 32px 32px` su caja de contenido daba exactamente los 422 de la
columna — así que **la barra de scroll se los comía a la columna**. Medido a 1440×790 (lo que deja
un portátil de 1440×900 con la barra del navegador): `/login` y `/login/restablecer` con columna
**422** y huecos 32 / 32, y `/login/2fa` —la única que scrollea— con columna **412** y huecos
32 / 42. Poniendo los 32 en el `margin: auto` de la columna, el reparto lo hace el navegador: sin
barra son los 32 / 32 de Attio, con barra la columna **sigue midiendo 422** y se centra en lo que
queda. Vuelto a medir a 1440×900, 1440×790 y 1440×640: 422 en las tres pantallas.

Implementado en `app/login/_ui/login.css` y `app/login/_ui/TarjetaLogin.tsx`. Lo heredan las
tres pantallas: `/login`, `/login/2fa` y `/login/restablecer`.

## La trampa de los dos paneles: el panel ES un contenedor de scroll (15/11/2026)

Para que la marca no se vaya de arriba con el contenido alto (el QR del segundo paso), el que
scrollea es `.lg-panel`, no la ventana. Eso tiene dos consecuencias que no se ven leyendo el CSS
y que se encontraron midiendo:

1. **`document.scrollWidth` deja de servir como prueba de «no hay scroll horizontal».** Con
   `overflow-y: auto` y el otro eje en `visible`, el navegador computa `overflow-x: auto`
   (medido). O sea que un formulario que se desborde a 375 produce una barra DENTRO del panel y
   el documento sigue midiendo 375. Lo que hay que mirar es
   `.lg-panel.scrollWidth` contra `.lg-panel.clientWidth`.
2. **Un contenedor de scroll RECORTA la sombra.** `box-shadow` no cuenta como contenido
   scrolleable: lo que se sale no se alcanza con el scroll, se corta. Y `--focus-ring` es
   `0 0 0 4px var(--primary)`, 4 px POR FUERA de la caja. Con el panel en `padding: 8px 0 24px`
   —como nació el rediseño— cada control a todo el ancho quedaba a **0,0 px** del borde del
   panel y el anillo del teclado se cortaba a los dos costados en todo el rango ≤1024.
   Por eso el panel lleva 6 px de costado ahí (4 del anillo + 2 de aire) y esos 6 se le restan
   al velo, para que la canaleta siga siendo 24 —y 16 en el teléfono— y el formulario mida los
   mismos 343 px a 375.

Y una tercera, del mismo bloque: **el panel centrado no centra la columna.** `.lg-panel` es
flex en columna y `.lg-panel__centro` tiene `max-width: 422px`, así que sin `align-items: center`
la columna se va contra el borde izquierdo del panel. A 375 no se nota (ahí ocupa el ancho
entero); a 768 el formulario quedaba 52 px corrido respecto del logo, que sí está centrado.
