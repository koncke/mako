# Encargo: Editor de video — 10 pendientes (7/11/2026)

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

### 1. Recalibrar los subtítulos para Anton (MAX_CHARS, CUERPO, Y venían de Segoe UI Black)

_feature · chico_

Anton es más angosta: si esos números salieron de mirar cuadros, los renglones quedan cortos. Sin verificar, y la sesión que los eligió ya cerró. Hecho = un render con Anton mirado cuadro a cuadro y los tres números ajustados.

**Dónde:** `C:/dev/wt-puntas/scripts/montar-anuncio-vertical.sh (MAX_CHARS=18, CUERPO=52, Y=950) · pendiente en C:/dev/wt-puntas/docs/hallazgos-video-pipeline.md:956`

### 2. La curva de retencion por video no se puede ver

_feature · chico_

`curvaRetencion` acepta `videoId` y nadie se lo pasa. Pedido: «que todos los videos se puedan medir».

**Dónde:** `docs/relevo/pendientes-pc/pedidos-otras-cuentas-6-11.md:206-207 · app/admin/dev/vsl-tracking/bitacora.ts:34`

### 3. Muapi como segundo motor de video

_feature · grande_

Hay disenio escrito (`459bd7c0f`) y `git grep -i muapi` no da nada en `lib/` ni `app/`. Hecho = un video generado por Muapi como alternativa a Flow.

**Dónde:** `docs/relevo/pendientes-pc/pedidos-otras-cuentas-6-11.md:147-149 · docs/diseno-ai-avatar-estudios.md:53`

### 4. El «Creador de formatos» que pidio Martin

_feature · mediano_

`app/video-generator/formatos-datos.ts` existe y nadie lo importa. Falta la pantalla y el flujo.

**Dónde:** `docs/relevo/pendientes-pc/pedidos-otras-cuentas-6-11.md:155-157 · app/video-generator/formatos-datos.ts · docs/hallazgos-generativa.md:4622`

### 5. Nada del Video Editor (subtítulos, B-roll y clips) se miró en un navegador

_feature · mediano_

La nube no corre el editor (necesita WebGPU y el WASM). Falta: palabras clave (subtítulos automáticos con el interruptor, el panel, guardar un preset y verlo en Plantillas «De tu marca»); B-roll (`probar-broll-ia.mts --ws 3`, conectar Pexels, «Proponer», borde punteado, Dejar/Sacar y Ctrl+Z); clips (`probar-clips-ia.mts --ws 3`, «Buscar los mejores momentos», «Ver», «Abrir», y probar con un video de 30 min o más).

**Dónde:** `C:/dev/wt-puntas/scripts/probar-broll-ia.mts y scripts/probar-clips-ia.mts ; docs/relevo/nube-video-clips.md:37-48`

### 6. Los 6 templates nuevos de Video no entraron

_feature · mediano_

Sumar los 6 templates nuevos, retirar `gancho-escrito` y `oferta-glitch`, sumar los clips de Pexels y la miniatura dibujada (`MiniaturaPlantilla`). Lo que no entró está listado en la cabecera del archivo de ejemplos. Es trabajo del chat de Video.

**Dónde:** `C:/dev/wt-puntas/lib/editor-video/plantillas-ejemplos.ts (la cabecera) ; docs/relevo/nube-plantillas.md:43-46`

### 7. Montar un anuncio desde el chat y renderizar en servidor no existen

_feature · grande_

Lo que pidió Martín el 25/10 y no se construyó: (1) la operación montar_anuncio_video (la API sólo lee, con ver_montaje_anuncio); (2) editar un video pedido por chat y que salga renderizado (el Video Editor exporta sólo en el navegador, no hay render en servidor ni en MaKo Desktop). Martín quiere las dos vías, «también con servidor de MaKo». Hecho = se pide un montaje por chat y vuelve el archivo.

**Dónde:** `C:/dev/wt-puntas/lib/api-mako/areas/video.def.ts · app/video-editor/_opencut/services/renderer/ · pendiente en C:/dev/wt-puntas/docs/hallazgos-video-pipeline.md:1304`

### 8. El worker usa la duración de la PRIMERA toma para todas y la pantalla afirma «no una palabra»

_feature · mediano_

Pasarle segundosPorToma entero al script y que plan-cortes-anuncio tope cada toma con la suya; medir segundosAntes del audio real o rotularlo estimado; e invocar el verificador de palabras (verificar-corte-anuncio.mjs está en el Dockerfile y no lo llama nadie, así que palabrasPerdidas no llega nunca). Hecho = una toma más larga que la primera no pierde lo que se dice después del tope, y la frase de la pantalla está medida.

**Dónde:** `C:/dev/wt-puntas/worker/montar-cola.mjs:126-132 · scripts/plan-cortes-anuncio.mjs:78 · app/video-generator/PasoMontaje.tsx:144-152 · app/api/montaje/worker/route.ts:43 · scripts/verificar-corte-anuncio.mjs · pendiente en C:/dev/wt-puntas/docs/hallazgos-video-pipeline.md:1100 y :1139`

### 9. El Video Editor no tiene Deshacer, no reordena tomas y no tiene música

_feature · grande_

Ctrl+Z (una pila de planes en un useRef, con las operaciones puras ya en editor-cortes.ts); el arrastre para mover un tramo de lugar (el plan ya lo soporta: es un array ordenado); y la música, esperando Epidemic Sound Connect (una fila en PISTAS y anda). Hecho = los tres andan en el editor.

**Dónde:** `C:/dev/wt-puntas/app/video-editor/_opencut/ · lib/editor-cortes.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-video-pipeline.md:1139`

### 10. Cada video de avatar empuja anuncios viejos afuera del historial (tope de 10)

_feature · mediano_

Los videos de avatar son un plan del historial del Video Generator, con MAX_HISTORIAL = 10: hacer muchos saca anuncios viejos con el único puntero a sus clips (los LOOKS no tienen ese problema, viven en ai-avatar.looks). Hecho = los videos de avatar no comparten el tope con los anuncios.

**Dónde:** `C:/dev/wt-puntas/app/ai-avatar/actions.ts (crearVideoAction) · app/video-editor/avatar/actions.ts · app/video-generator/video-datos.ts (MAX_HISTORIAL) · pendiente en C:/dev/wt-puntas/docs/hallazgos-ai-avatar.md:280`
