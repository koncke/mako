# /vsl/video — los valores medidos de su referencia

**Referencia:** Cherry Studio, editor de reels con IA — https://cherrysweet.app/
**Medido:** 11/11/2026 y otra vez el **14/11/2026** (Cherry cambió su portada en el medio), con Chromium (Playwright) a 1440 × 900
y a 390 × 844: `getComputedStyle`, `getBoundingClientRect`, su script de interacciones y un video de cada animación. El relevo
sección por sección, con las capturas y los videos, está en la carpeta de notas: `referencias-landings/video-cherry/relevo.md`.
**Diseño copiado en:** `app/vsl/_competencia/disenos/video.tsx`. **Contenido:** `app/vsl/_competencia/video.ts`.

⚠️ **Cherry tiene tres versiones de su portada en el mismo enlace** (`?ver=a|b|c`: con video de ventas, sin él, sólo el video).
Desde el 12/11 todos ven la **B** (su script: `PRUEBA = false`), y es la que se midió el 14/11. La del 11/11 era la A (titular de
60 px con el video entre el titular y los botones). Además esconde secciones con `hidden` (el comparador «Arrastra y mira lo que
le quita a tu video» sigue en su HTML, escondido): se mira el DOM, no sólo la captura.

## Su orden (versión B, 14/11)

Barra · hero con vitrina · calendario «Tu semana de contenido se publica sola» · fila de dos (Instagram 7fr + «Tres pasos» 5fr) ·
«Lo que hace» · «Marcas que se hicieron virales» · mosaico «Tu IA puede hacer videos así» · conector con Claude y ChatGPT ·
simulador · (comparador, escondido) · banda rasgada «Y todo lo que rodea al video» · cinta «trabaja con» · precios · «Lo que más
nos preguntan» · banda final · pie. En MaKo van: hero, fila de dos (comparador + tres pasos), «Lo que hace», banda, preguntas y
banda final. Lo que no va y por qué: la cabecera de `video.ts`.

## Fuentes

| Uso | Familia | Pesos |
|---|---|---|
| Titulares, números, calcomanías | Outfit | 800, 900 |
| Texto y botones | Space Grotesk | 400–700 |
| Cejillas, rótulos | DM Mono | 500 |
| Pistas a mano («toca cada paso», «arrástrame», «tócalas») | Caveat | 700 |

Viven en `public/vsl-assets/fuentes/{outfit,space-grotesk,dm-mono,caveat}/`.

## Colores (su tema claro)

`--fondo #ECE3DD`, `--tinta #140C11`, `--tinta-2 rgba(20,12,17,.68)`, `--tinta-3 .48`, `--borde .09`, `--foco .05`, `--pastilla .06`,
`--sombra rgba(70,40,50,.22)`. Su rosa `#FF2D8A` / `#D8156E` / `#FF5AA3` → el azul de MaKo `#2F6FED` / `#1F57C8` / `#6E9BF5`.
Verde `#6ED49C`, ámbar `#FFC93C` (el anillo que late), crema `#F4ECE7`, negro de calcomanía `#0B0709`.

## Medidas a 1440

- **Página:** `body` padding 0 24 60; `main` 1160 px, grilla con gap 16. **Panel «vol»:** radio 30, borde 1 px, fondo
  `radial-gradient(120% 90% at 78% 72%, foco, transparent 60%), linear-gradient(#FFF, #FBF7F4)`, sombra en cuatro capas.
- **Hero:** padding 64 40 0; cejilla DM Mono 10.5 / 12.6, 0.14em; **h1 Outfit 900 84 / 75.6, −3.78 px** (clamp 44–84, 11.5vw;
  25ch); la marca en una «caja» de color girada −2.5° y bajada 4 px; bajada 17 / 25.5, 44ch; botones 16 / 700, padding 17 26
  (negro y de línea); nota 13 px. **Vitrina** de 350 px: tarjetas 230 × 287 (4:5, radio 22) a −9°, −3°, 3° y 9°, calcomanías 16 px
  (padding 11 15 12, anillo blanco de 4 px) y el disco del logo de 82 px.
- **Fila de dos:** 7fr / 5fr (667 + 477); tarjetas padding 24 22, gap 16; h2 Outfit 42 / 39.5 −1.89 px; íconos de 42 px
  (radio 13); números de los pasos 42 px, negro +5° y el del medio de color −6°.
- **Lo que hace:** padding 48 48 48 36, columnas 1.1fr / .9fr, gap 40; h2 58 / 52.2 −2.61 px; pasos con padding 14 14 14 10 y
  radio 22, número 44 px a −7° / +6°, título 21 / 22.05; barra de 3 px de **7,5 s**; marco 360 × 450 radio 30; calcomanía
  arriba a la derecha a 7°.
- **Comparador:** caja de 240 px (190 en el teléfono), radio 22; mango blanco de 3 px con el círculo de 48 px.
- **Banda rasgada:** padding 44 40 36; h2 66 / 59.4 −2.97 px, 13ch; hoja girada −1.2°, radio 28, padding 22 16 20, línea
  punteada a 10 px; cuatro calcomanías (giradas ±6°) con su rótulo negro Outfit 22 (anillo blanco de 4 px) y texto 13.5 / 18.2;
  chips 14 px; palabra calada 300 px con trazo de 2 px. El borde rasgado es una máscara (tira de 30 px arriba y abajo) y detrás va
  el papel crema `#F7F1EA` 5 px más alto.
- **Preguntas:** cabecera suelta (padding 28 6 2, h2 62 / 55.8); panel con dos columnas de 527 px (gap 40), resumen 15.5 / 20.9
  700 con padding 17 0, + de 24 px que gira 45°; abiertas la 1.ª y la 3.ª.
- **Banda final:** padding 70 40 60; h2 92 / 81 −4.6 px, 12ch; texto 16 / 24 500; abanico de 260 px con tres tarjetas de 210 px
  (−10°, 0°, 10°) que corta el borde.

## A 390

`body` padding 0 16 110 (lugar para el botón fijo). h1 44.85 / 40.4; h2 de la fila 31.2; de «Lo que hace» 35.1; de la banda
39; de las preguntas 37; de la banda final 46.8. Vitrina de 300 px con tarjetas de 150 y sólo dos calcomanías y el disco de
50 px; todo en una columna; la hoja en dos columnas; el marco `min(74vw, 320px)`.

## Animaciones e interacciones (su script, reescrito en el `<script data-visor>` del diseño)

- **Entrada al bajar:** sólo lo que empieza fuera de la pantalla: `opacity 0 → 1` y `translate 0 34px → 0` en 0,8 s
  `cubic-bezier(.16,1,.3,1)`; las calcomanías caen de `scale 1.45` con un rebote (0,55 s `cubic-bezier(.34,1.56,.64,1)`) y un
  retraso al azar de 180 a 440 ms.
- **Vitrina:** sigue al mouse (`--mx`, `--my`: tarjetas ±10 / ±6 px, calcomanías ±16 / ±9 px, `translate .35s ease-out`) y se
  abre al bajar (`--abre` de 0 a 1 mientras el hero sale: las de afuera ±64 / 26 px).
- **Lo que hace:** el paso abierto llena su barra en 7,5 s y pasa al siguiente; la escena vuelve a empezar; fuera de la vista
  se pausa; el siguiente late (anillo ámbar, 1,5 s) hasta que se toca uno; la calcomanía del marco salta (0,55 s).
- **Comparador:** se pasea solo una vez (1,8 s, ±28 %) al aparecer; «arrástrame» empuja 9 px y se va con el primer arrastre.
- **Calcomanías:** al pasar el mouse `scale 1.07`; al tocarlas se menean (0,5 s: −6°, 5°, −3°).
- **Palabra calada:** corre ±120 px con el scroll de su banda.
- **Botones:** NO se mueven al pasar el mouse; sólo `scale(.98)` al apretar.
- **Videos:** corren a lo sumo 4 (2 en el teléfono), los que se ven, y se frenan mientras se baja.
- **Botón fijo (teléfono):** aparece cuando el del hero quedó arriba y antes de la banda final.
- Con «menos movimiento», nada corre solo.
