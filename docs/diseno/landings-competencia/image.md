# /vsl/image — los valores medidos de su referencia

**Referencia:** PostNitro, la portada en español — https://postnitro.ai/es
**Medido:** 11/11/2026, con Chromium (Playwright) a 1440 × 900 y a 390 × 900, `getComputedStyle` y `getBoundingClientRect`
sobre los elementos reales.
**Diseño copiado en:** `app/vsl/_competencia/disenos/image.tsx`. **Contenido:** `app/vsl/_competencia/image.ts`.

## Fuentes

| Uso | Familia | Pesos | En MaKo |
|---|---|---|---|
| Titulares, números | Archivo | 600, 800 | la misma (Google Fonts, OFL, variable) |
| Texto, botones, preguntas | Instrument Sans | 400, 500, 600, 700 | la misma (variable 400–700) |
| Cejillas, pestañas de los marcos, títulos del pie | JetBrains Mono | 700 | la misma (variable) |

Viven en `public/vsl-assets/fuentes/{archivo,instrument-sans,jetbrains-mono}/`.

## Colores

| Qué | PostNitro | En MaKo |
|---|---|---|
| Fondo de la página y secciones grises | `#F5F8F7` | igual |
| Secciones blancas | `#FFFFFF`, borde de arriba 1 px `#E9EFED` | igual |
| Tinta (titulares) | `#07120F` | igual |
| Texto | `#384843`; secundario `#5A6C67` | igual |
| Bordes | `#D5E0DC` | igual |
| Marca (botones, marcos, pestañas, tildes, cejillas, la pregunta abierta, los números de los pasos) | verde `#087A68` | azul `#2F6FED` (hover `#1F57C8`) |
| Tarjetas oscuras | `#07120F`, título blanco, texto `#9FB4AE`, línea mono `#0DC7A9` | igual, el ícono en `#8FB2F7` |
| Miniaturas de plantillas | sus capturas | negra, azul, dorada `#F2B01E` y blanca |

## Contenedores y espacios (1440)

- **Página:** contenido de 1296 px (padding 0 / 72).
- **Barra:** dos cajas blancas flotantes (radio 8, padding 4 / 8). Links 13 / 13 700; botón de 30 px de alto, 12 px 600,
  radio 8, con ícono; «Iniciar sesión» 12 px 700.
- **Hero:** sección con padding 136 0 0 (debajo de la franja y la barra), grilla de dos columnas (574 px + el resto),
  gap 48. Cejilla Instrument Sans 11 / 24 700, 0.66 px, mayúsculas, caja blanca con borde 1 px `#D5E0DC`, radio 8,
  padding 0 / 12, margen de abajo 20.8. h1 Archivo 56 / 57.12 800, -1.792 px. Bajada 18 / 27.9. Botón de 42 px, radio 8,
  16 px 600, padding 0 22 0 14.67, con ícono. Nota 12 / 19.2 `#5A6C67`.
- **Marco de selección:** pestaña JetBrains Mono 10 / 16 700 blanca sobre el color (radio 3 3 0 0, padding 1.6 / 6.72);
  caja blanca con borde 1 px del color, padding 17.6; un cuadradito de 7 px en cada esquina. En las filas, la captura va
  sobre un fondo gris claro con una cuadrícula.
- **Franja de prueba social:** blanca, borde 1 px arriba y abajo, padding 16.8 / 72, gap 25.6, textos de 12–13 px en
  negrita.
- **Secciones:** padding 96 / 72. Centradas: cejilla JetBrains Mono 11 / 17.6 700, 1.21 px, mayúsculas, del color; h2
  Archivo 37.6 / 41.36 800, -0.9776 px; párrafo 16 / 25.6 de 768 px. A la izquierda: h2 Archivo 42.4 / 46.64 600,
  -0.848 px; párrafo 16.8 / 26.88. Las numeradas: «01 DISEÑO» con su raya hasta los 768 px.
- **Plantillas:** miniaturas 4:5 de ~205 px con sombra, en una fila; debajo, un renglón y un botón de línea.
- **Tres pasos:** grilla de 3, gap 43.2; «01» del color con su raya; ícono en un cuadrado con borde + título Archivo 18.4
  / 23.92 600; texto 15.68 / 25.09. Botón de línea blanco (borde 1 px `#CED4DA`, 16 px 600, 42 px, radio 8).
- **Filas de «01 Diseño»:** dos columnas, gap 57.6; 86.4 px entre filas; texto y marco alternan de lado. h3 Archivo 27.2 /
  32.64 600, -0.408 px; párrafo 16 / 26.4; lista con tildes (gap 18.4; cada renglón con gap 12.8, tilde en círculo del
  color, título 16 / 22.4 600, texto 15.2 / 23.56).
- **Tarjetas oscuras:** `#07120F`, radio 9, padding 16 / 18.4, gap 12; título Archivo 15 / 18.75 700 blanco; línea mono
  12 px; texto 13 / 19.5.
- **Testimonios:** tres columnas en mampostería de tarjetas con borde 1 px, radio 9, iniciales o foto del autor.
- **Preguntas:** columna de 768 px centrada; cada una con borde 1 px (la abierta, del color), radio 9, margen de abajo 8;
  pregunta 16 px 700 con padding 13.6 / 17.6 y su flecha; respuesta 16 / 25.6.
- **Pie:** blanco, padding 64 72 0. La marca (logo y párrafo 14 / 21.7) y cuatro columnas con su título en JetBrains Mono
  10 / 16 700, 1.1 px, mayúsculas, y links 13 / 18.85 500 con gap 5.6. Abajo, el © a la izquierda y los links legales a la
  derecha, 13 px.

## A 390

- h1 33.6 / 34.27, el hero centrado (cejilla, titular, bajada, botón) y el marco debajo.
- h2 centrado 25.6 / 28.16; h2 a la izquierda 28 / 30.8; h3 de las filas 20.8 / 24.96.
- Secciones con padding 64 / 20; las filas en una columna, el marco arriba del texto; las plantillas en dos columnas; los
  pasos, las tarjetas oscuras y los testimonios en una.
- Pie con padding 40 / 20 y todas las columnas apiladas en una.

## Animaciones

PostNitro anima con JavaScript al hacer scroll y las miniaturas al pasar el mouse. En MaKo: el texto y el marco del hero
suben 12 px al cargar (nada arranca invisible), las miniaturas suben e inclinan apenas al pasar el mouse, los botones suben
1 px, las tarjetas oscuras 2 px, y la flecha de cada pregunta gira al abrirla. Todo apagado con `prefers-reduced-motion`.
