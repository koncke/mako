# /vsl/copywriting — los valores medidos de su referencia

**Referencia:** «The Copy Machine», de The Operator Stack — https://theoperatorstack.io/copy-machine
**Medido:** 11/11/2026, con Chromium (Playwright) a 1440 × 900 y a 390 × 900, `getComputedStyle` y `getBoundingClientRect`
sobre los elementos reales, y abriendo sus dos desplegables («What's inside, at a glance» y «Show the rewrites»).
**Diseño copiado en:** `app/vsl/_competencia/disenos/copywriting.tsx`. **Contenido:** `app/vsl/_competencia/copywriting.ts`.

## Fuentes

| Uso | Familia | Pesos | En MaKo |
|---|---|---|---|
| Titulares, números, títulos de renglón | DM Serif Display | 400 y 400 itálica | la misma (Google Fonts) |
| Textos, botones, cejillas en mayúscula | Libre Franklin | 400, 500, 600, 700, 800 | la misma (variable 400–800) |
| Cejillas «de máquina», el pie, los roles | Courier Prime | 400, 700 | la misma |
| El texto de los ejemplos reescritos | Georgia (del sistema) | 400 | igual |

Las fuentes viven en `public/vsl-assets/fuentes/{dm-serif-display,libre-franklin,courier-prime}/`.

## Colores (sus variables)

| Qué | Referencia | En MaKo |
|---|---|---|
| Fondo de la página | `#F1E8D6` | igual |
| Papel de las tarjetas | `#FBF6EA` (y `#F6EFDD` el destacado) | igual |
| Filete | `#DBCDB0` (y `#ECE2CA` el claro) | igual |
| Tinta / banda oscura | `#191512` | igual |
| Texto | `#3F382F`; gris `#5C534A` | igual |
| Crema sobre oscuro | `#F7EFDD`; `#D8CDB3` | igual |
| Naranja quemado (botones, la palabra de color, el número 3) | `#C0491F`, al pasar `#A03D16` | azul `#2F6FED`, al pasar `#1F57C8`; el número 3 en dorado `#F2B01E` |
| Verde petróleo (cejillas, números, itálicas de color, panel «Your first hour») | `#14514C` | azul oscuro `#1F57C8` |
| Píldora y monogramas | `#DDE7E4` con texto `#0E3F3A` | `#E3EBFC` con texto `#1F57C8` |
| Banda «Three real pages…» | `#E8ECDF`, filete `#CBD1BF` | igual |
| «Who it isn't for» | fondo `#F7E3D8`, borde `rgba(192,73,31,.28)`, rótulo `#A03D16`, negritas `#8F2418` | igual |

## Contenedor y espacios (1440)

- **Contenedor:** 1180 px con 32 px de margen (contenido de 1116, de x = 162 a 1278). A 390: 16 px.
- **Barra:** su banda de Black Friday (47 px, `#191512`) y debajo la marca (34 px de alto, en x = 162).
- **Hero:** grilla 592 + 480, 44 de separación, `padding: 30px 32px 52px`.
  - Píldora: `padding: 7px 14px`, radio 999, Libre Franklin 11,5 px 700, `letter-spacing: 1.38px`, mayúsculas, con un punto.
  - Titular: 22 px debajo, DM Serif Display 62/62 px, `-0.93px`; la última línea en itálica y la palabra de color en el naranja.
    A 390: 42,9/42,9 px.
  - Bajada: 27 px debajo, Libre Franklin 18,5/29,6 px `#3F382F`, negritas 700 en tinta, 573 px.
  - Botón: 32 px debajo, píldora 270 × 50, `padding: 16px 28px`, 14/17,5 px 700, crema sobre naranja; link de texto al lado,
    15 px 600 en petróleo, subrayado, con «→».
  - Checks: 13 px debajo, 10 px entre sí, círculo de 20 px petróleo con la tilde, texto 16/23,2 px, comienzo 600 en tinta.
    A 390: 15/21,75 px, y el link va DESPUÉS de los checks.
  - Tarjeta: 480 px, papel, borde, radio 16, `padding: 20px 18px`; imagen 442 × 548 radio 8; botón a lo ancho 442 × 44
    (`padding: 13px 20px`); «What's inside, at a glance» (`<details>` cerrado) con filete arriba, rótulo Courier Prime
    11,5 px 700 `letter-spacing: 1.84px` y un «+» en un círculo de 22 px. Abierto: celdas con borde, radio 8, rótulo Courier
    Prime 10,5 px 700 y valor Libre Franklin 13/17,55 px 600; la primera y la última a todo el ancho.
- **Banda «Three real pages and ads, rewritten»:** `#E8ECDF`, 108 px, `padding-block: 24px`; tres avatares de 40 px; título
  DM Serif Display 29/34,8 px; bajada 12 px; «Show the rewrites» 11 px 600 y un botón redondo de 40 px naranja que late
  (`examples-icon-pulse` 3,2 s y la flecha `examples-cta-arrow`). Abierta: titular 46 px, intro 16/26,4 px de 730 px,
  tres pestañas 372 × 85 (radio 8, `padding: 18px`, la activa en tinta con sombra `#B7A68B 0 3px 0`) y dos paneles de
  557 px (radio 10, cabecera de 51 px, pie en Courier Prime 10 px).
- **«What buyers wrote back»:** fondo `#FBF6EA`, `padding: 46px 0 34px`; cejilla Courier Prime 12 px 700 `1.56px`; titular
  DM Serif Display 40/43,2 px `-0.7px` (640 px) con itálica; intro 15/24 px; carrusel de tarjetas de 372 × 452, 16 de
  separación, radio 16, `padding: 28px 24px 22px`; la primera en tinta; cita 15/24 px; pie de tarjeta con filete, avatar o
  monograma de 44 px, nombre 14 px 700 y rol Courier Prime 12/18 px. A 390: tarjetas de 328 px que se deslizan.
- **«Start with the copy you need next.»:** `padding: 48px 0`; cejilla centrada; titular 36/43,2 px; cuatro columnas iguales
  con filete a la izquierda (`padding: 0 26px 0 25px`); símbolo 38 × 38 radio 8 `#EEE9DB`; título DM Serif Display
  20/24 px; texto 16/26,4 px `#5B5245`; pie 12 px `#847763`; «Something else to write?» 30 px debajo, con filete, 14 px.
  A 390: dos columnas sin filete.
- **Banda «Copy only you can run»:** `#191512`, `padding: 34px 0`; grilla 400 / 364 / 280 con 36 de separación; rótulo 11 px
  800 `2.86px`; titular DM Serif Display 29/36,25 px; texto 15,5/25,575 px `#D8CDB3`; su ilustración del «papel tapiz»
  (280 × 280, una grilla de bloques iguales con uno distinto).
- **«What you get»:** `padding-top: 56px`; titular 44/44 px y a la derecha el rótulo 11 px 700 `2.42px`, con doble filete
  debajo; lista en una tarjeta (radio 16); renglones `padding: 22px 26px`, número en círculo de 36 px (DM Serif Display
  17 px), 38 de separación, título 27/29,7 px, texto 15/24,75 px de 949 px; el renglón 3 destacado (`#F6EFDD`, número
  naranja). A 390: `padding: 18px 16px`, 22 de separación.
- **Fila de tres:** 412 / 330 / 330 con 22 de separación. Panel petróleo radio 20, `padding: 34px 32px`; rótulo 11 px 800;
  titular DM Serif Display 30/36 px; texto 15,5/25,575 px. Tarjetas `padding: 26px 24px`, rótulo 10,5 px 800 `2.52px`,
  texto 14,5/23,2 px; «Who it isn't for» con una ✕ en círculo a la izquierda de cada punto.
- **Preguntas:** tarjeta de 372 px, `padding: 24px 22px`; rótulo 10,5 px 800 con filete de 2 px debajo; preguntas
  13,5 px 600 con `padding: 14px 0`; la primera abierta, con el círculo naranja y «−»; respuestas 13/20,15 px.
- **Cierre:** `padding: 40px 0 64px`, centrado; titular DM Serif Display 40/42 px `-0.4px`; texto 16 px de 560 px; botón
  270 × 50. A 390: 30/31,5 px.
- **Pie:** filete arriba; fila de productos centrada (Libre Franklin 11,5 px 700, 18 de separación) con filete abajo; línea
  de abajo con «© The Operator Stack» (Courier Prime 13 px), su lema y los links legales en petróleo, subrayados.

## Movimiento

- Botones: `transition: background .14s, color .14s`, al pasar el cursor el naranja oscurece.
- Link de texto: el color pasa de petróleo a naranja (.14 s).
- El botón redondo de «Show the rewrites»: latido de 3,2 s y la flecha que baja.
- Sin animaciones de entrada.
