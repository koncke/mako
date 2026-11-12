# /vsl/web-generator — los valores medidos de su referencia

**Referencia:** HighLevel AI Studio — https://www.gohighlevel.com/ai-studio
**Medido:** 11/11/2026, con Chromium (Playwright) a 1440 × 900 y a 390 × 900, `getComputedStyle` y `getBoundingClientRect`
sobre los elementos reales (también los estados `:hover` del botón y de las preguntas).
**Diseño copiado en:** `app/vsl/_competencia/disenos/web-generator.tsx`. **Contenido:** `app/vsl/_competencia/web-generator.ts`.

⚠️ Sus imágenes (el logo, el fondo del hero, las capturas de la galería) vienen de `images.leadconnectorhq.com`, que el proxy
de la nube no deja pasar (403): se midieron sus CAJAS, no lo que muestran. Ninguna se copia.

⚠️ La noche del 11/11 la página ya NO tenía «Built with AI Studio» ni «Meet your 24/7 AI Team», que nombraba la cabecera de
web-generator.ts: los diseños de MaKo pasaron a su galería («They typed a sentence. Here's what came out») y el caso de
Mauricio a sus testimonios («Why Businesses Use It»), por eso se reordenaron esos dos bloques en el `.ts`.

## Fuentes

| Uso | Familia | Pesos | En MaKo |
|---|---|---|---|
| Todo | Poppins (`Poppins, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`) | 400, 500, 600, 700 | Poppins de Google Fonts, 400, 600 y 700 (`public/vsl-assets/fuentes/poppins/`) |

## Colores

| Qué | Referencia | En MaKo |
|---|---|---|
| Fondo de la barra | `#04192D`; la cápsula `rgba(111,205,255,.14)` | igual |
| Hero | `#07223D` (con una imagen SVG de fondo que no se pudo bajar) | `#07223D` |
| Resaltado del titular del hero | `linear-gradient(90deg, #7CC4FF, #A9D8FF 55%, #D2E9FF)` | `#8DB0F4 → #B4CBF8 → #DCE7FC` |
| Resaltado de los títulos | `linear-gradient(96deg, #3B6FF6, #6D4AF0 55%, #7C3AED)`; el de la galería `119deg, #7C3AED, #3B82F6, #A855F7` | `#2F6FED → #5B8CF0 → #1F57C8` |
| Botón | `linear-gradient(111deg, #7C3AED -2.59%, #3B82F6 54.66%, #A855F7 111.92%)`, `box-shadow: rgba(79,70,229,.85) 0 12px 26px -12px` | `#1F57C8 → #2F6FED → #5B8CF0`, sombra `rgba(47,111,237,.85)` |
| Pestaña activa | fondo `#EEF2FF`, borde `#4F46E5`, ícono en `#4F46E5` | `#EAF1FE`, `#2F6FED` |
| Pastilla activa («Who is») | `#7C3AED`, sombra `0 10px 22px -10px` del mismo | `#2F6FED` |
| Títulos de las piezas de «What is» | `#1D4ED8` | `#1F57C8` |
| Tintas de los testimonios | `#EEF4FF`, `#F5F1FE`, `#F1F4F8`; avatares `#1D4ED8`, `#7C3AED`, `#1E293B` | `#EAF1FE`, `#FFF6DE` (dorado), `#F1F4F8`; `#2F6FED`, `#F2B01E`, `#1E293B` |
| Preguntas | `#EFF4FE`; la abierta con borde `rgba(59,130,246,.35)` | igual, borde `rgba(47,111,237,.35)` |
| Caja del cierre | `#0C1322`, borde `rgba(255,255,255,.08)`; luces `rgba(124,58,237,.32)` y `rgba(59,130,246,.26)` | igual, luces azul de MaKo y dorado |
| Pie | `#07223D`, links `#6482A2` | igual |

## Contenedores y espacios (1440)

- **Barra:** fila de 90 px (`padding: 10px 0`) sobre `#04192D`; cápsula de 1170 × 70, radio 16, `padding: 8px 10px`. Links
  Poppins 15/19,5 400 blancos, `padding: 8px 6px`, 12 px entre ellos; botón 44 px de alto, `padding: 6px 15px`, radio 10,
  16 px 700. A 390: logo y botón (14 px), sin links.
- **Hero:** `#07223D`; grilla de 1140 px (x = 150) con dos columnas de 542 y 56 entre ellas, arriba a 120 px.
  - Badge: `padding: 12px 32px`, radio 9999, fondo `#1C3249`, borde 1 px `#86CBFA`, Poppins 17/22,1 500, `-0.085px`; 20 px abajo.
    A 390: 14/18,2.
  - Titular: 62/65,72 px 600, `letter-spacing: -2.17px`, `#F4F8FE`. A 390: 34/36,04, `-1.19px`, centrado.
  - Bajada: 21/31,5 px 400, `-0.168px`, `#EEF4FC`. A 390: 16/24.
  - Tarjeta de la derecha: 542 × 665, blanco al 96 %, borde 1 px `rgba(154,196,255,.35)`, radio 26, `padding: 16px 16px 18px`,
    `box-shadow: rgba(7,20,40,.2) 0 1px 2px, rgba(7,20,40,.6) 0 34px 80px -20px`.
  - Debajo, su video de producto: 1080 × 608, radio 20 (no va en MaKo).
- **Galería («They typed a sentence. Here's what came out»):** blanca, `padding: 50px 0 60px`; título en dos renglones de
  42/62,4 px 600 (el segundo con el degradado); el escenario 61 px abajo: dos filas con 36 px entre ellas, cada una una pista
  flex con `gap: 31.68px` que se corre en horizontal; tarjetas de ~474 px giradas unos 4°. Cierre: «Yours could be next.»
  17 px 500 `#475467` y el botón a 22 px.
- **Contadores («Trusted by…»):** caja de 1110 con raya de 1 px `#DADADA` arriba y abajo, `padding: 80px 0 76px`; título 42/50,4 px
  600, `-1.47px`, negro; tarjetas de 350 × 170 con 30 px entre ellas, blancas, borde 1 px `#E4E4E4`, radio 22,
  `box-shadow: rgba(0,0,0,.05) 0 2px 10px`, `padding: 26px 22px 28px`; número 46/52,9 700 `-0.92px` con
  `linear-gradient(90deg, #1F2630, #3A3F48 55%, #6B6B70)`; rótulo 15/17,25 500, `letter-spacing: 3px`, mayúsculas, `#111729`.
  A 390: título 28/33,6, rótulo 13,5 px y 2,16 px.
- **«What is AI Studio?»:** título 46/49,22 px 600 `-1.84px` `#101828` en 780 px; bajada 19/30,78 `#475467`. Columnas: texto de
  513 px (x = 165) y un marco de 543 × 362 (x = 732), radio 12, `linear-gradient(165deg, #101828, #0B1220)`,
  `box-shadow: rgba(16,24,40,.06) 0 2px 6px, rgba(16,24,40,.8) 0 30px 64px -30px`. Piezas: título 19 px 600 `-0.418px`,
  texto 15/24,9 `#475467`, 31 px entre una y otra. A 390: título 32,76 px, piezas 17,5 y 14,5/24,07.
- **«What can AI Studio build?»:** contenedor de 1300 (x = 70); título 46/50,6 `-1.748px`; seis pestañas de 208 × 105 con 10 px
  entre ellas, radio 14, `padding: 16px 12px 18px`, borde 1 px `#E7EBF1`, ícono en una caja de 42 × 42 radio 11 (`#F8FAFD`),
  rótulo 14 px 600 `-0.21px`; la activa con una rayita abajo. Vista previa de 1300 × 661, radio 16, borde 1 px `#E7EBF1`,
  `box-shadow: rgba(16,24,40,.03) 0 1px 2px, rgba(16,24,40,.5) 0 22px 50px -30px`; barra de 37 px `#F6F8FC` con los tres
  puntos de 9 px y el rótulo 11,5 px 500 `#7A8697`; cuerpo `#FBFCFE`, `padding: 34px 38px`; título 27/32,4 600 `-0.702px`,
  texto 14,5/23,2 `#475467`; el dibujo de una página de 780 × 321 (radio 13). A 390: título 28/30,8, pestañas de a dos.
- **«Why Businesses Use It»:** contenedor de 1080 (x = 180); título 44/48,4 600 `-1.54px` `#0F1D2E` a la izquierda y el botón a la
  derecha; filas de 611 + 453 con 16 px. Razón: blanca, borde 1 px `#E5EAF2`, radio 20, `padding: 26px 26px 24px`, una rayita de
  color arriba; ícono 42 × 42 radio 12; número 11,5 px 700 `1.15px` `#C3CCDA`; título 21/26,25 600 `-0.504px`; texto
  14,5/23,78 `#55637A`. Testimonio: radio 20, `padding: 26px`; cita 17/24,65 500 `-0.34px`; avatar de 34 px con iniciales
  11,5 px 700; nombre 12,5 px 600. A 390: título 31,98 px, una columna.
- **«Who is AI Studio for?»:** título 46 px, bajada 18/28,8 `#475467` en 560; pastillas de 38 px, `padding: 10px 20px`, radio 9999,
  13,5 px 500 `-0.135px`, borde 1 px `#E7EBF1`; ventana de 552 × 383, radio 20, barra de 45 px `#F8FAFD` con el chip «Live»
  (`#E8F6EF`, `#0F7A45`, 10 px 700); la cadena «After they hit submit» a la derecha (564 px). Botón centrado, 40 px abajo.
- **Preguntas:** título 42/47,04 600 `-1.47px`; dos columnas de 533 con 14 px; cada una `#EFF4FE`, radio 14, resumen
  `padding: 18px 20px` 15,5/21,7 500 `-0.155px` `#101828`, respuesta 14,5/23,925 `#56616F` con `padding: 0 20px 20px`. A 390:
  una columna, 14,5 px.
- **Cierre:** caja de 1040 × 388, `padding: 56px 40px 48px`, radio 28; título 48/52,8 600 `-1.68px`, bajada 17,5/27,125
  `#B9C7DC`, un campo de pedido de 480 × 58 y el botón.
- **Pie:** `#07223D`, `padding: 40px 20px 0`; columnas en x = 150, 471, 770, 1059; título 17/22,1 400 en mayúsculas; links 15 px
  `#6482A2`; raya blanca de 2 px; © 14 px y lo legal a la derecha.

## Movimiento

- Botón: `transition: transform .4s cubic-bezier(0.25, 1, 0.5, 1), opacity .4s, box-shadow .4s`; al pasar el mouse `scale(1.03)`,
  `opacity: .92` y `box-shadow: rgba(79,70,229,.95) 0 18px 34px -12px`.
- Pestañas y pastillas: `transition: … transform .25s cubic-bezier(0.34, 1.56, 0.64, 1)`.
- Preguntas: el borde cambia en `.25s`.
- Contadores: `transition: transform .4s cubic-bezier(0.25, 1, 0.5, 1)`.

## Lo que no se copia

Su logo, el fondo del hero, su video de producto, las capturas de su galería, sus contadores de uso, sus testimonios, el ejemplo
de formulario («Jasmine Rivera»), su cadena «After they hit submit», sus barras de «3 to 6 weeks / Tonight» y su prueba gratis.
