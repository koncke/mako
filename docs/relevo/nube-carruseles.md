# Relevo — Carruseles que funcionan, en la nube (pedido de Martín del 4/11/2026)

Lo escribe la sesión de la nube que hizo el trabajo. **Esta sesión no puede escribirle al Cerebro:** todo lo que hace falta
está acá. La nube no llega a la base, a Apify ni a topcarousels.com: lo de abajo se probó con datos inventados y un banco
(el componente real en Chromium, a 1280 y 390, claro y oscuro).

## El pedido

> «Te deje abierto esto: https://topcarousels.com/explore. Quiero que scrapees entero, mires y copies las funcionalidades y
> todos los carruseles de ejemplo para ponerlos en MaKo en la sección de imagen generator.» y «Y asegurate de que todo este
> siempre en ops center».

**Lo que NO se hizo, a propósito** (el Cerebro ya se lo avisó a Martín): no se baja, no se raspa y no se republica su
biblioteca. Se copian las FUNCIONES con datos propios.

## Estado

| Etapa | Qué | Rama | Estado |
|---|---|---|---|
| 1 | «Carruseles que funcionan» en Image (`/image-editor?ver=carruseles`): buscar por tema y @cuenta, filtros (publicado, láminas, formato, imágenes sueltas), outlier, cuentas, orden (outlier, nuevos, viejos, interacción, traídos), grilla de dos tamaños, guardados, búsquedas guardadas, esta semana, la pestaña «Cuentas» con su análisis en Spy; la franja de «Nuevo diseño»; el teléfono; la API (`estado_carruseles`, `buscar_carruseles`, `guardar_carrusel`) | `punta/carruseles-explorar` | subida |
| 2 | Ocho carruseles de MaKo por tipo en «Nuevo diseño» (miniatura con el nombre del negocio, «Ver ejemplo» con un negocio ficticio) y «Hacer el mío» en el explorador (la estructura de uno, no su contenido); la API (`crear_carrusel_desde_referencia`, y `buscar_carruseles` dice la estructura) | `punta/carruseles-crear` | subida |

## Migración sin aplicar

- **0391_spy_medio_carruseles.sql** — sólo agrega `spy_piezas.medio` y `spy_piezas.laminas`. Sin ella todo anda: el
  explorador muestra las publicaciones sin saber cuáles son carruseles (sin el chip de láminas, y las fotos sueltas no se
  pueden esconder). **El número lo elegí barriendo main y todas las ramas de origin (0390 era la última)**: no pude pedírselo
  al Cerebro; si estaba reservado, se renumera antes de aplicar. Se aplica con `node scripts/apply-migration.mjs`.

## Qué probar en el negocio de prueba (ws 3)

1. Sin cuentas en Spy: `/image-editor` muestra la línea «Sigue a las cuentas de tu rubro…» con «Seguir una cuenta» y la «×»;
   `/image-editor?ver=carruseles` muestra lo mismo en grande.
2. Sumar una cuenta de Instagram en Competitors Spy y abrir su ficha (trae las publicaciones). Volver a Image: la franja
   «Carruseles que funcionan» aparece arriba de las plantillas, y «Ver todos» abre el explorador.
3. En el explorador: buscar por una palabra de un carrusel y por `@cuenta`; Outlier 2×+; «Esta semana»; guardar uno (el
   marcador) y verlo en «Guardados»; «Guardar búsqueda» y usarla; la vista compacta; «Cuentas» → «Analizar la cuenta» abre su
   ficha en Spy; el ↗ abre la publicación original.
4. Con la 0391 aplicada: volver a abrir la ficha de la cuenta en Spy y mirar que los carruseles traen el chip de láminas.
5. Desde el chat de MaKo (la tarjeta de la izquierda): «¿qué carruseles funcionan esta semana?» y «guardá ese carrusel».
6. En el teléfono: Image → «Carruseles que funcionan».
7. `/image-editor`: arriba, «Carruseles» con ocho tipos; cada miniatura lleva el nombre del negocio. «Ver ejemplo» de
   «Historia» abre las siete láminas de un negocio ficticio y «Usar esta estructura» crea el diseño «Carrusel · Historia».
   Abrirlo: cada lámina trae su guía, la barra de progreso crece y la última no tiene flecha.
8. En el explorador, pasar el mouse por un carrusel → «Hacer el mío»: la confirmación dice tipo, láminas, con qué abre y qué
   pide; cambiar el tipo o las láminas cambia la vista previa; «Crear mi carrusel» abre el diseño (las notas de la primera
   página dicen de quién es la estructura).
9. Por el chat: «hacé uno con la estructura de ese carrusel de @cuenta» → tarjeta con el resumen → confirmar → link al diseño.

## Para leer desde la PC (la nube no llega a ese dominio)

Lo público que su `robots.txt` permite, para afinar los TIPOS y sus estructuras (no para copiar texto ni imágenes):
`https://topcarousels.com/llms-full.txt`, `/carousel-ideas/*` (92), `/carousel-examples/*` (10), `/blog/*` (45),
`/instagram-carousel-statistics`, `/viral-instagram-carousels`, `/top-instagram-carousels`, `/score-my-account`,
`/chatgpt-claude`, `sitemap.xml`. Interesa: qué tipos clasifican, el esqueleto de cada uno (gancho, láminas, cierre) y cómo
definen el «outlier score» (contra qué mediana y con qué métrica). Si su definición difiere de la de Spy, se dice en la
pantalla; no se cambia el número de Spy.

## Lo que sigue

- Que MaKo escriba el texto de cada lámina con los datos del negocio (hoy son guías). Va por el chat del editor, que ya cambia
  textos de un diseño abierto, o como una operación nueva; necesita la IA del negocio.
- «Hacer el mío» y «Ver ejemplo» en el teléfono.
- Las cuentas que el negocio sigue SÓLO para carruseles (sin el resto de Spy): hoy se suman en Competitors Spy.
