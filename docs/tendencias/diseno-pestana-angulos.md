# La pestaña «Ángulos» de Content Machine: propuesta de diseño

21/11/2026. Para el chat de Content Machine. Los datos están en `docs/tendencias/angulos.json`: un objeto por sector, con `grafico`
(los puntos) y `angulos` (el ranking). Diseñado con el skill dataviz. La paleta pasó el validador en claro y en oscuro.

## Qué se ve, de arriba hacia abajo

1. **Una fila de filtros.**
   - El sector, con un solo control. Es el único filtro obligatorio.
   - Al lado, los cuatro estados como chips que se prenden y se apagan.
   - Sin más texto.
2. **El gráfico de burbujas del sector.**
   - **X = contagio:** cuántos referentes distintos tratan el ángulo. Son números enteros, con un pequeño desvío para que no se
     encimen.
   - **Y = interacción:** comentarios cada 1.000 vistas, en escala logarítmica con marcas legibles (0,5 · 1 · 2 · 5 · 10 · 20). Los
     valores van de 0,1 a 16, y en escala lineal todo queda pegado abajo.
   - **Tamaño = piezas:** el área es proporcional. Radio mínimo de 4 px (marcador de 8 px) y máximo de 28 px.
   - **Color = estado.**
   - **Dos líneas finas punteadas** en la mediana del sector de X y de Y. Arriba a la derecha va una etiqueta gris
     («Ganadores»). Ese cuadrante es lo que pidió Martín.
   - **Etiqueta directa sólo en los 3 de mayor puntaje.** Los demás se ven al pasar el cursor.
   - Los ángulos sin vistas (`y: null`) van en una franja «sin vistas» debajo del eje, no en cero.
3. **El ranking de ángulos ganadores.** Es la tabla del gráfico y la vista accesible: puesto, ángulo, estado (ícono y palabra),
   puntaje (una barra fina de 0 a 100 con el número) y las tres señales en columnas cortas.
   - **Insistencia:** «Den Borg: 26 de 46».
   - **Interacción:** «1,3 c/1.000».
   - **Contagio:** «6 referentes».
   - **Crecimiento:** «▲ ×1,4».

   Al abrir una fila aparecen «Cómo usarlo» (el gancho y la palabra del CTA), lo que pide la gente y las 3 piezas de ejemplo, con
   su miniatura y su link.

## Colores (validados con `validate_palette.js`, `--pairs all`)

| Estado | Claro | Oscuro | Además del color |
|---|---|---|---|
| En crecimiento | `#1baf7a` (aqua) | `#199e70` | ícono ▲ |
| Saturado | `#2a78d6` (azul) | `#3987e5` | ícono ● |
| En baja | `#eb6834` (naranja) | `#d95926` | ícono ▼ |
| Nuevo | sin relleno: anillo de 2 px en tinta principal (`#0b0b0b` / `#f0efec`) | — | ícono ✦ |

- Son tres colores y una forma. Las burbujas admiten como mucho tres tonos; el cuarto estado va como anillo, no como un color
  inventado.
- No uso verde contra rojo: falla la prueba de daltonismo (deutan, ΔE 4,1).
- El aqua queda por debajo de 3:1 sobre la superficie clara. Por eso el estado nunca va sólo en color: siempre lleva el ícono y la
  palabra en la leyenda, en la etiqueta y en la tabla.
- Hay un anillo de 2 px del color de la superficie alrededor de cada burbuja, para separar las que se superponen.
- Los textos van en tinta, nunca en el color del estado.

## Al pasar el cursor por una burbuja

Una tarjeta chica con: el nombre del ángulo, el estado (ícono y palabra), el puntaje y las tres señales en una línea cada una
(«insiste Ramiro Cubría: 34 de sus 121 piezas», «1,6 comentarios cada 1.000 vistas», «9 referentes»). Al final, el ejemplo con
más comentarios. La zona sensible es más grande que la burbuja. Un clic baja a su fila del ranking.

## Lo que no va

- No va un segundo eje Y.
- No va un número sobre cada burbuja.
- No van colores por referente.
- No van los ángulos con `llegaDelIngles`: van aparte, en una línea al pie («Llega del inglés: …»).
- El método (`metodo` en el JSON) va detrás de un «¿Cómo se mide?» plegado, no en la pantalla.

## Modo claro primero

Martín trabaja las páginas de trabajo en claro. El oscuro existe, con sus propios pasos de la paleta, no invertido.
