# Relevo — El rediseño de Carruseles, en la nube (pedido de Martín del 6/11/2026)

Lo escribe la sesión de la nube que hizo el trabajo. La nube no llega a la base, a Apify ni a las claves: lo de abajo se probó
con tests que corren el código y con un banco (el componente real en Chromium, con datos inventados). **Lo que necesita la
base o gastar, lo corre el Cerebro desde la PC**, con los comandos exactos de abajo.

## El pedido

> «Rediseñá por completo la tab de carruseles de MaKo. No tengas miedo de borrar lo que hay… Lo principal al entrar son los
> ejemplos de carruseles… Copiá la interfaz de Top Carousels: el encabezado "Encuentra tu siguiente OUTLIER" y sus botones, el
> filtro, las opciones, el diseño de las tarjetas y poder pasar a la siguiente slide dentro de la tarjeta… Sacá el texto "De
> las cuentas que sigues en Competitors Spy…", el botón "compacta" y las pestañas "Esta semana" y "Cuentas"… Filtro "CTA"…
> Que todos los carruseles sean EDITABLES, guiándote por "replicate" del Web Generator… con el avatar del cliente, usando su
> propia IA conectada… "Hacer el mío" saltaba a "Elige el tipo"… Investigá apps y fuentes reales para ver anuncios de la
> competencia… y sumalo a esta misma tab con filtros si lo podés hacer con lo que MaKo ya tiene.»

## Qué quedó (todo en `punta/carruseles-rediseno`)

- **La pantalla** (`/image-editor?ver=carruseles`): al entrar, sólo los ejemplos, sin el chat de MaKo al costado (el chat
  vuelve al abrir un diseño). Arriba «Encuentra tu siguiente OUTLIER», las pastillas (Guardados, Búsquedas guardadas, + Seguir
  cuentas y, para la plataforma, Biblioteca) y la búsqueda grande. Abajo, una fila de filtros: Carruseles | Anuncios, Filtros
  (publicado, láminas, tipo, de dónde, mostrar), Outlier, CTA, Cuentas y el orden. Se fueron la bajada, «compacta» y las
  pestañas «Esta semana» y «Cuentas» (un link viejo con `vista=semana` abre con «Últimos 7 días»).
- **La tarjeta:** las láminas se pasan adentro (flechas al pasar el mouse, el dedo en el teléfono, puntos y «2/7»), el
  outlier, guardar, el creador, el gancho, me gusta y comentarios, el CTA («Comenta «GUÍA»») y «Editar» + el original.
- **Filtro CTA** (`lib/carruseles/cta.ts`): los que piden comentar una palabra o mandarla por mensaje. Probado con textos con
  la forma de los pies reales (`tests/carruseles-cta.test.ts`).
- **Anuncios** (`lib/carruseles/anuncios.ts`): los que Spy trajo de las cuentas que sigue ese negocio, con su clave de Apify,
  ordenados por días al aire. Nada de una biblioteca de anuncios de la plataforma (los términos de Meta: ver la cosecha).
- **«Editar»** reemplaza a «Hacer el mío»: del ejemplo a la edición en un paso. MaKo lee las láminas con la IA DEL NEGOCIO,
  escribe el texto para su negocio (nunca las palabras del ejemplo), pone su foto donde el ejemplo tiene una persona, y arma un
  diseño editable que se ve construyéndose (copiado del «Replicar» del Web Generator). Sin IA o sin láminas guardadas, arma el
  mismo diseño con una guía en cada lámina y lo dice. Al terminar abre el diseño en el editor.
- **API de MaKo:** `buscar_carruseles` suma `que` (carruseles o anuncios), `cta` y el orden «aire»; operación nueva
  `editar_ejemplo_carrusel` (con un «sí», no sale por HTTP, gasta la IA del negocio). `crear_carrusel_desde_referencia` queda
  (gratis, sólo guías).
- **Capturas:** `docs/carruseles/rediseno-2026-11-06/` (computadora, teléfono, anuncios, CTA, oscuro, la tarjeta con el mouse
  encima, «Editar» armándose y terminado).

## Lo que corre el Cerebro desde la PC

Todo desde la raíz del clon, con el `.env.local` (producción). Los comandos sin `--de-verdad` no gastan ni escriben.

1. **La migración 0404** (`laminas_imagenes`, `cta`, `cta_via` en `carruseles_biblioteca_piezas`). Sin ella todo anda: la
   tarjeta muestra la portada y «N láminas», y el CTA se calcula del texto al leer. Número elegido barriendo main y las 219
   ramas `punta/*` y `claude/*` (0403 era la última); si estaba reservado, se renumera antes de aplicar.

   ```bash
   node scripts/apply-migration.mjs supabase/migrations/0404_carruseles_laminas_cta.sql
   ```

2. **El CTA de lo ya guardado** (GRATIS: no le pide nada a Apify). En seco muestra cuántos piden una palabra y unos de cada
   lado para mirarlos:

   ```bash
   node --env-file=.env.local --conditions=react-server --import tsx scripts/carruseles-biblioteca.mts reclasificar
   ```

   ```bash
   node --env-file=.env.local --conditions=react-server --import tsx scripts/carruseles-biblioteca.mts reclasificar --de-verdad
   ```

3. **Las láminas de cada carrusel** («scrapea todo»): pide cada carrusel por su link al actor de Instagram de Apify, baja sus
   láminas a nuestro storage (`spy-miniaturas`) y las guarda. Cuentas: las de la biblioteca de ejemplos que ya están (la lista
   de creadores + los 32 temas, unos 1.378 carruseles visibles). Nada de Top Carousels.

   ```bash
   node --env-file=.env.local --conditions=react-server --import tsx scripts/carruseles-biblioteca.mts laminas --max 1400
   ```

   ```bash
   node --env-file=.env.local --conditions=react-server --import tsx scripts/carruseles-biblioteca.mts laminas --de-verdad --techo-usd 3 --max 1400
   ```

   **Cuánto cuesta:** ~US$0,0023 por carrusel → unos **US$3,2** por los 1.378. La corrida deja US$2 de reserva para Spy y
   cada tanda de 40 lleva un techo de 1,5× (US$0,14), así que con la clave gratis de US$5 al mes corta antes de terminar: lo
   que no entró se sigue con el mismo comando (sólo lee lo que todavía no tiene láminas), en otra corrida o con una segunda
   clave de Apify cargada en Spy del negocio de la plataforma (el script usa todas: `estado` dice cuánto crédito queda). Storage: unas 7 láminas por carrusel, del orden de 1 GB.

4. **Lo que se lea de ahora en más** (`leer`) ya trae las láminas y el CTA con la 0404 aplicada: no hace falta otro paso.

## Cómo probarlo de punta a punta (en el ws3, Cliente de Prueba)

1. Image → «Carruseles» (`/image-editor?ver=carruseles`): ver la grilla, pasar láminas adentro de una tarjeta, prender «CTA»,
   pasar a «Anuncios» (sólo si ese negocio sigue cuentas con anuncios en Spy).
2. «Editar» en un carrusel de la biblioteca **con láminas** (después del paso 3):
   - con la IA del negocio conectada: se ven «Leo sus láminas / Escribo tu versión con tu IA / Armo el diseño editable» y las
     láminas apareciendo; al terminar abre el diseño. Revisar que el texto sea del negocio y no del ejemplo;
   - con una foto de cara de marca (Second Brain) o un look de AI Avatar: la foto va donde el ejemplo tiene una persona;
   - sin IA conectada: el diseño con guías y «Conectar mi IA».
3. Por la API de MaKo: «haz mi versión del carrusel <id>» en el chat de la app (pide un «sí»).

## Lo que quedó sin hacer o por decidir

- **Las capturas de Top Carousels no llegaron:** `docs/carruseles/referencia-top-carousels/` no está en main ni en ninguna
  rama, y la nube no abre su sitio. La pantalla se copió de la descripción del pedido. Cuando estén, se ajustan los valores.
- **Una persona en una lámina que no es el cliente** queda como un recuadro con su guía: generarla con la IA de imagen y el
  avatar del cliente es el paso siguiente (Flow).
- **Una biblioteca de anuncios para todos** necesita Foreplay o Atria con cuenta paga a nombre de MaKo y permiso escrito de
  reventa: lo decide Martín (la comparación, en `docs/hallazgos-carruseles.md`).
- **No se tocó la sidebar:** «Carruseles» sigue siendo una vista de Image (`?ver=carruseles`).

## Pulido del 6/11/2026 (la sesión que terminó el rediseño, en `punta/carruseles-pulido`)

Con las capturas de Top Carousels ya en el repo (`docs/carruseles/referencia-top-carousels/`). Capturas nuevas: `docs/carruseles/pulido-2026-11-06/` (computadora 1440 y teléfono 390, claro y oscuro: grilla, tarjeta con el mouse, carrusel abierto, filtros, parecidos, y el resultado de «Editar»).

**Hecho:** (1) el CTA agarra «envía/manda/escribe PALABRA por DM», «Comenta o envía X por DM» y el portugués «comente: Viver de POT»; (2) el tipo se lee en portugués, alemán e inglés (**1.253 → 1.213 sin tipo**, ver abajo); (3) el carrusel abierto, modal en dos partes; (4) el modal de filtros con deslizadores de dos puntas (múltiplo, interacciones, láminas), publicado, tipo, de dónde, «Ocultar tipos», orden, tamaño de tarjeta y la leyenda de colores; el múltiplo lleva color por nivel; (5) 4 columnas en 1440, «Editar» al pasar el mouse junto a parecidos y guardar (liviano y visible en celular), pastillas y filtros en una fila que se desliza en el teléfono, sin el «16» suelto, @creador entero y la fecha abajo; (6) «Editar»: letras reales del editor, texto que llena la lámina, sin recuadro «Tu foto», y un camino digno sin láminas.

### Autocrítica

- **¿Tiene sentido?** Sí: entrar, ver ejemplos, tocar uno, verlo grande y apretar «Editar». Se sacó lo que no aportaba: el desplegable de filtros, el menú «Outlier», los puntitos de láminas y el botón negro en cada tarjeta (le ganaba a los ejemplos).
- **¿Se entiende sin explicación?** El múltiplo tiene color y leyenda en el modal; «Parecidos» y «Creadores parecidos» dicen de dónde salen en su `title`. Lo que NO se entiende solo y quedó: «Parecidos» cambia la grilla a una banda «Parecidos a …» con «Volver», sin otro rastro.
- **¿Cada botón hace algo?** Sí, uno por uno en el banco: abrir (imagen y título), Editar (arma), guardar, parecidos (banda), flechas y contador, creadores parecidos (filtra a ese creador), ver original, Filtros (aplica, quita), CTA, Cuentas y Orden.
- **Lo que se encontró y se cambió en la pasada:** el visor del carrusel abierto dejaba franjas negras a los costados y las flechas bajo el pliegue; «Editar» en el teléfono quedaba debajo de todo (ahora va en el pie fijo de la caja); la etiqueta «6 láminas» se partía en dos renglones; «gritado» del CTA por letras tapaba una palabra clave en pies cortos.
- **Lo que NO está probado:** el flujo de «Editar» con una IA real (la nube y la PC no la gastaron); el diseño se miró con lo que devolvería un modelo, armado a mano (`scripts/banco-carruseles/replica-html.mts`), no con una respuesta real. Tampoco el `tsc` (la PC no tenía memoria: lo corre GitHub).
- **Qué sobra todavía:** el parámetro `largo` (2 a 4, 5 a 7, 8+ láminas) sigue en la API y en los links viejos aunque la pantalla usa el deslizador de láminas; el «tema» de la referencia no existe (sólo el tipo).

### Lo que le queda al Cerebro desde la PC

Con el `.env.local` de producción, desde la raíz del clon. Los de arriba (0404, CTA y láminas) siguen siendo los mismos; sumá:

1. **El tipo de lo ya guardado** (GRATIS, no le pide nada a Apify). En seco muestra «Carruseles sin tipo: 1253 → 1213»; después, de verdad:

   ```bash
   node --env-file=.env.local --conditions=react-server --import tsx scripts/carruseles-biblioteca.mts reclasificar
   node --env-file=.env.local --conditions=react-server --import tsx scripts/carruseles-biblioteca.mts reclasificar --de-verdad
   ```

   Quedan **1.213 sin tipo** de 1.470 (8 sin texto, que vence a los 30 días). Bajarlos de ahí necesita las láminas (`laminas`, ya descrito arriba) y leerlas con visión.
2. **Mirar «Editar» con una IA real en el ws3** con un carrusel CON láminas y otro SIN: que el texto sea del negocio, que las letras sean las del editor y que no haya recuadros grises.
3. **Decidir el «tema»** (finanzas, salud, marketing…): clasificar cada carrusel con IA para sumar el filtro de la referencia.
