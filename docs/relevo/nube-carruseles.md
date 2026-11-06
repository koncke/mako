# Relevo — Carruseles que funcionan, en la nube (pedido de Martín del 4/11/2026)

> **6/11/2026: la pantalla se rediseñó entera** (copiada de la interfaz de Top Carousels, sin la bajada, «compacta» ni las
> pestañas «Esta semana» y «Cuentas»; «Hacer el mío» pasó a ser «Editar», con la IA del negocio). Lo vigente está en
> [nube-carruseles-rediseno.md](nube-carruseles-rediseno.md); lo de abajo es la historia.

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
| 3 | La biblioteca de ejemplos: carruseles públicos de Instagram de una lista de cuentas y de temas (hashtags), la misma para todos los negocios, al lado de lo de cada negocio en el explorador; el panel de la plataforma en «Cuentas»; la API (`ver_biblioteca_carruseles`, `cambiar_biblioteca_carruseles`, y `buscar_carruseles` con `origen`); el script de la PC que la llena | `punta/carruseles-biblioteca` | subida, **sin cargar**: falta la 0392 y correr el script |
| 4 | Correcciones de la primera carga (lo que midió el Cerebro el 4/11 ~21:20 UTC): el tipo de cada carrusel con un clasificador más amplio y el texto de la portada; lo personal baja en el orden (no se esconde); `verificar` para confirmar una cuenta; el plan en seco dice lo esperado; aviso de cuentas que traen casi nada | `punta/carruseles-biblioteca-2` | subida: falta la 0393 y `reclasificar` |

## Migración sin aplicar

- **0391_spy_medio_carruseles.sql** — sólo agrega `spy_piezas.medio` y `spy_piezas.laminas`. Sin ella todo anda: el
  explorador muestra las publicaciones sin saber cuáles son carruseles (sin el chip de láminas, y las fotos sueltas no se
  pueden esconder). **El número lo elegí barriendo main y todas las ramas de origin (0390 era la última)**: no pude pedírselo
  al Cerebro; si estaba reservado, se renumera antes de aplicar. Se aplica con `node scripts/apply-migration.mjs`.

- **0392_carruseles_biblioteca.sql** — las tres tablas de la biblioteca (cuentas, temas y publicaciones), GLOBALES (sin
  `workspace_id`), con RLS y sin permisos para la clave pública. Sólo agrega. **El número lo elegí barriendo main, las 207 ramas
  y las 159 etiquetas de origin (0391 era la última)**; si estaba reservado, se renumera antes de aplicar. Orden de despliegue
  indiferente: sin las tablas, el explorador muestra sólo lo de cada negocio y el script lo dice ANTES de gastar.
  **La biblioteca NO depende de la 0391**: guarda si es carrusel y sus láminas en sus propias columnas.

- **0393_carruseles_biblioteca_contenido.sql** — una columna, `parece_contenido`, en las publicaciones de la biblioteca. Sólo
  agrega. Número elegido barriendo main, 209 ramas y 159 etiquetas (0392 era la última). Orden indiferente: sin ella la pantalla
  calcula la señal del texto y el script no la manda.

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

## La biblioteca de ejemplos: cómo se llena (desde la PC)

La nube no llega a Apify ni a la base: la carga corre en la PC, desde la raíz del clon, con el `.env.local` (producción). Usa la
clave de Spy del negocio de la PLATAFORMA (`APIFY_INSTAGRAM_TOKEN`) y **nunca la imprime**. Todo lo que gasta pasa por dos
techos: el que se pide (por defecto US$2) y lo que deja libre el crédito del mes por encima de **US$2 para Spy**; sin poder
leer el crédito, no gasta. Sin la 0392, sale con «Falta aplicar la migración 0392… No se gastó nada.».

1. Aplicar la 0392 (la aplica el Cerebro): `node scripts/apply-migration.mjs supabase/migrations/0392_carruseles_biblioteca.sql`.
2. Ver el estado (no gasta ni escribe):

```bash
node --env-file=.env.local --conditions=react-server --import tsx scripts/carruseles-biblioteca.mts estado
```

3. Buscar los @ de los referentes del Ops Center (gasta hasta US$0,50; no escribe nada):

```bash
node --env-file=.env.local --conditions=react-server --import tsx scripts/carruseles-biblioteca.mts buscar --techo-usd 0.5
```

4. Sumar a la lista los buenos (uno por comando; el id del referente sale de `buscar`):

```bash
node --env-file=.env.local --conditions=react-server --import tsx scripts/carruseles-biblioteca.mts sumar @usuario --nombre "Nombre" --referente hormozi
```

5. La primera carga EN SECO (dice el plan, el crédito y cuánto puede gastar; no gasta ni escribe):

```bash
node --env-file=.env.local --conditions=react-server --import tsx scripts/carruseles-biblioteca.mts leer --techo-usd 2 --max-carruseles 300
```

6. La carga DE VERDAD (siembra los diez temas de arranque, lee, baja las miniaturas a nuestro bucket y guarda):

```bash
node --env-file=.env.local --conditions=react-server --import tsx scripts/carruseles-biblioteca.mts leer --de-verdad --techo-usd 2 --max-carruseles 300
```

Para sacar a un creador que lo pidió (o desde la pantalla, «Cuentas» → «Sacar de la biblioteca»):

```bash
node --env-file=.env.local --conditions=react-server --import tsx scripts/carruseles-biblioteca.mts sacar @usuario --motivo "Lo pidió el creador"
```

Para sumar un tema (el `#` entre comillas: en la consola, una palabra que empieza con `#` es un comentario):

```bash
node --env-file=.env.local --conditions=react-server --import tsx scripts/carruseles-biblioteca.mts tema '#ventasonline' --nombre "Ventas"
```

**Los temas de arranque** (los elegí pensando en los negocios de MaKo; se editan en la pantalla): #marketingdigital,
#emprendimiento, #marcapersonal, #ventasonline, #coachdenegocios, #negociosdigitales, #agenciademarketing, #copywriting,
#infoproductos, #consultoria. De cada uno se guardan sólo los carruseles, del que mejor rinde al que menos, clasificados por
tipo y sin repetidos. Una fuente leída hace menos de una semana no se vuelve a leer (salvo con `--solo @cuenta` o
`--solo '#tema'`).

**Qué probar después de la carga** (en el ws 3, que no sigue a nadie en Spy):
1. `/image-editor?ver=carruseles` muestra ejemplos con «De la biblioteca de ejemplos…» arriba y la línea para seguir cuentas.
2. Cada tarjeta: el @ abre su perfil, el ↗ la publicación; las de la lista llevan outlier, las de los temas no.
3. «Filtros» → «De dónde» (sólo aparece si hay de los dos lados); guardar uno de la biblioteca y verlo en «Guardados»; «Hacer el
   mío» sobre uno de la biblioteca.
4. En el negocio de la plataforma: «Cuentas» → «Editar la biblioteca de ejemplos» (sumar, sacar, apagar un tema). En otro
   negocio, ese panel no aparece y la acción contesta «La biblioteca de ejemplos la edita la plataforma.».

## Correcciones de la primera carga (4/11/2026): qué correr

Quedan US$1,07 libres este mes: **nada de esto pide otra carga grande.** Desde la raíz del clon, con el `.env.local`:

1. Aplicar la **0393**: `node scripts/apply-migration.mjs supabase/migrations/0393_carruseles_biblioteca_contenido.sql`.
2. Volver a clasificar lo guardado (GRATIS; primero en seco, que dice cuántos «sin tipo» quedan y muestra la primera línea de
   15 que siguen sin tipo, para mirar a ojo por qué):

```bash
node --env-file=.env.local --conditions=react-server --import tsx scripts/carruseles-biblioteca.mts reclasificar
```

```bash
node --env-file=.env.local --conditions=react-server --import tsx scripts/carruseles-biblioteca.mts reclasificar --de-verdad
```

3. Confirmar la cuenta de Sofía Contreras (trajo 1 publicación; unos US$0,003). Si sale «no parece» o «dudosa», sacarla con
   `sacar` o cambiarla por la buena:

```bash
node --env-file=.env.local --conditions=react-server --import tsx scripts/carruseles-biblioteca.mts verificar @sofiacontreras --referente sofia-contreras
```

4. Los @ de los referentes: los carga el superadmin en la pantalla («Cuentas» → «Editar la biblioteca de ejemplos») o con
   `sumar`, después de confirmarlos (hasta 20 por corrida, unos US$0,003 cada uno). Por ejemplo:

```bash
node --env-file=.env.local --conditions=react-server --import tsx scripts/carruseles-biblioteca.mts verificar @hormozi --referente hormozi
```

   «✔ confirmada» se suma; «? dudosa» y «✖ no parece» los decide una persona mirando el perfil. `buscar` sigue existiendo, pero
   sólo lista parecidos ordenados (no confirma nada).
5. `estado` ahora dice cuántos carruseles siguen sin tipo, cuántos parecen personales y qué cuentas trajeron casi nada.
6. La próxima `leer` (en seco primero) dice lo ESPERADO con lo medido (unos 10 carruseles por tema y 9 por cuenta) y lo
   PROBABLE en dólares, y al terminar cuenta cuántas publicaciones traían el texto de la portada. **Ese número dice si el actor
   manda `alt`:** si da 0, el tipo de los carruseles de los temas va a seguir saliendo sólo del pie.

**Qué mirar en la pantalla después:** «Mayor outlier» con los ejemplos: la foto del embarazo de @leilahormozi tiene que quedar
después de los carruseles con tipo o con cierre (sigue a la vista, con su 9,7×); «Filtros» → tipo, con más tipos que antes.

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
