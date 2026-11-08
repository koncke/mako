# Encargo: Thumbnails — 5 pendientes (7/11/2026)

**Qué es esto.** La lista depurada de pendientes de MaKo: de 634 anotadas el 6/11 quedaron 232 de
trabajo real (`docs/pendientes-depurados-7-11.md`). Éstos son los de tu área, ordenados por el
criterio de Martín: **cliente roto > plata > traba > features**.

## ⚠️ LEÉ ESTO ANTES DE TOCAR CÓDIGO, porque es lo que más tiempo ahorra

El 7/11 se verificaron los cuatro primeros de la lista **y tres estaban ya resueltos**. El
inventario es una foto del 6/11 y entre el 6 y el 7 entraron 601 commits a main.

**Entonces: por cada ítem, PRIMERO verificá contra el código que el síntoma siga existiendo.** Si ya
no existe, escribilo y pasá al siguiente — eso vale tanto como arreglarlo.

Tres trampas medidas ese día, las tres reales:

1. **Un pendiente que enumera «N puntas atadas» envejece punta por punta, no entero.** En «la cadena
   de pago sale del dominio del cliente», tres de cuatro puntas ya estaban hechas y el título seguía
   igual que el primer día.
2. **Un pendiente anotado muchas veces NO es más urgente: es uno que se contó muchas veces.** El más
   repetido del inventario (4 entradas) describía un recuadro gris que se había sacado el día anterior.
3. **Si dice «el número X está mal, debería ser Y», fijate si X e Y son del mismo período.** Uno decía
   «US$238 está mal, es US$426»: eran noviembre y diciembre, los dos correctos. «Arreglarlo» rompía
   noviembre.

## Cómo se entrega

Una punta por tema: `git push origin HEAD:refs/heads/punta/<nombre>`. Llega sola a `main` con verde
(`.github/workflows/punta.yml`). **`integracion` se retiró el 4/11: un push ahí da rojo a propósito.**
No hace falta esperar a que termine la anterior.

⚠️ **«En main» no es «en producción»:** el deploy lo hace un cron a las 11:05 UTC.

Lo que aprendas va a `docs/hallazgos-<área>.md` **en el mismo commit**, y el índice
`docs/hallazgos.md` se actualiza ahí mismo. Sobre todo **cuando el diagnóstico obvio era el
equivocado**: eso es lo que más tiempo ahorra después.

---

### 1. La poda de los 30 dias de Thumbnails es a mano y nadie la automatizo

_feature · chico · ⟳ estaba anotado 4 veces_

Sin la enmienda III.L, lo que se guarda de la YouTube Data API (titulos, vistas) vence a los 30 dias: la pantalla no muestra lo leido hace mas (`vigente`) y hay que borrarlo (`podar`). El documento lo deja como «cada mes: `leer` de nuevo y `podar --de-verdad`», y no hay cron ni tarea programada que lo llame. HECHO cuando exista una tarea programada que corra `leer` + `podar --de-verdad`, o cuando quede anotado como paso fijo del Cerebro con su fecha.

**Dónde:** `C:/dev/wt-puntas/docs/carruseles/thumbnails.md:86 · C:/dev/wt-puntas/lib/spy-reglas.ts:313 (metricasVencidas) · C:/dev/wt-puntas/lib/thumbnails/explorar.ts`

<details><summary>Las otras formas en que estaba escrito</summary>

- Volver a leer y podar cada mes, porque sin la enmienda de YouTube lo guardado vence a los 30 días
- Lo leído de YouTube vence a los 30 días y nadie programó la relectura mensual
- Volver a leer y podar la biblioteca cada mes (vence a los 30 días)
</details>

### 2. Probar «Editar» de una miniatura con una IA real

_feature · chico_

Después de cargar la biblioteca, correr `carruseles-probar-editar.mts --ws 3 --que thumbnail --id <id>`. Hecho = se abre un diseño de 1280×720 en el Image Editor con texto del negocio, no del ejemplo. Nunca se probó: la nube no tiene claves.

**Dónde:** `C:/dev/wt-puntas/scripts/carruseles-probar-editar.mts ; lib/carruseles/replica-servidor.ts (replicarEjemplo con que:'thumbnail')`

### 3. El rubro de un canal lo pone la búsqueda, no un clasificador

_feature · chico_

Un canal de ventas que hace un video de marketing queda en ventas. Es una limitación conocida, no un bug. Hecho = o se clasifica el video (pasada de IA, como el «tema» de carruseles) o queda documentado que el rubro es del canal y no del video.

**Dónde:** `lib/thumbnails/carga.ts; docs/carruseles/thumbnails.md:94`

### 4. Las diez caras nuevas de gurús tienen los `grandes/` agrandados, no el original

_feature · mediano_

Los grandes/ de los diez últimos son los 200×200 de Canva escalados a 600 con bicúbica (los catorce primeros son los 1264 reducidos): en la tarjeta de Spy se ven blandos. Para rehacerlos hay que exportar el original desde Canva (un diseño con la imagen y export-design); los ids de media de los diez están anotados. Hecho = los diez grandes/ a 600 reales y la tarjeta nítida.

**Dónde:** `C:/dev/wt-puntas/public/asesores/grandes/ · lib/asesores/catalogo.ts · ids y procedimiento en C:/dev/wt-puntas/docs/hallazgos-ops-center.md:467`

### 5. La miniatura dibujada de las plantillas de Video sigue sin hacerse

_feature · mediano_

De los enchufes de «plantillas propias», Video espera al editor: los 6 templates nuevos, retirar dos, los clips de Pexels y la miniatura dibujada. Hecho = una plantilla de Video muestra su miniatura en la galería.

**Dónde:** `C:/dev/wt-puntas/app/video-generator/ · lib/plantillas-propias/ · pendiente en C:/dev/wt-puntas/docs/hallazgos-plantillas.md:122`
