# Encargo: Competitors Spy — 15 pendientes (7/11/2026)

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

### 1. Sin probar: que la lectura de la oferta hable en tercera persona con un negocio real

_plata · chico_

El diagnóstico de Offer sobre la web del competidor usa `bloqueOfertaDeOtro` para hablar de él en tercera persona, con la IA del negocio y sin crédito de la plataforma (`soloDelNegocio`). Nunca corrió contra un modelo real ni contra una web de verdad.

**Dónde:** `C:/dev/wt-puntas/docs/relevo/nube-spy.md:62 ; /api/competitor-spy/oferta`

### 2. Volver a analizar con IA las piezas ya analizadas para que tomen los 19 formatos del catálogo

_traba · mediano_

Los 19 formatos del catálogo ya están y la IA recibe qué es cada uno, pero lo ya analizado no se vuelve a mandar solo: queda con el formato viejo. Falta decidir y correr una repasada. Lo mismo bloquea «los formatos nuevos del catálogo en el análisis de piezas», que el relevo marca pendiente.

**Dónde:** `C:/dev/wt-puntas/docs/relevo/nube-spy.md:79-80 ; spy_piezas.analisis (el formato va dentro del mismo jsonb)`

### 3. El guion de videos de YouTube nunca se pidió de verdad: las 7 pruebas dieron 503

_feature · chico · ⟳ estaba anotado 2 veces_

Transcribir un video real con el Gemini del negocio y medir el costo por minuto (`usageMetadata`), que queda en `anthropic_usage` con feature='spy'. Hecho = un guion completo en pantalla y un renglón de costo medido. Hoy no hay ni un pedido real.

**Dónde:** `C:/dev/wt-puntas/lib/spy-transcripcion-servidor.ts (tramoDeYoutube) ; lib/ai-cheap.ts (modelosSttGemini) ; docs/relevo/nube-spy.md:83`

<details><summary>Las otras formas en que estaba escrito</summary>

- El guion de un video de YouTube nunca salió de verdad: las 7 pruebas dieron 503
</details>

### 4. Spy no tiene pantalla de telefono

_feature · grande · ⟳ estaba anotado 2 veces_

No existe `app/m/competitor-spy/page.tsx` (lo verifique: la carpeta no esta) y `market-an` sigue anotada en `EN_CAMINO`, asi que en More se ve como «En la computadora». El diseno esta decidido (diseno-competitors-spy.md §8: un bloque por pantalla plegados, galeria a una columna, filtros en una hoja que sube). Lo que NO va al telefono se dice en vez de desaparecer: replicar el sitio y el recorrido con la extension. ATENCION: la tab sale de `EN_CAMINO` en el MISMO commit que su pantalla o el guardian falla. `GraficoSpy` se monta tal cual (probado a 390 px con datos inventados, hasta 90 miniaturas).

**Dónde:** `C:/dev/wt-puntas/lib/movil-rutas.ts:507-519 (EN_CAMINO, 'market-an'); falta crear C:/dev/wt-puntas/app/m/competitor-spy/page.tsx; el componente a montar: C:/dev/wt-puntas/app/competitor-spy/GraficoSpy.tsx`

<details><summary>Las otras formas en que estaba escrito</summary>

- Spy no tiene pantalla en el teléfono
</details>

### 5. Sin probar: el guion de un reel (que el actor devuelva `videoUrl` con `directUrls`)

_feature · chico_

El guion de un reel se pide solo al abrir el detalle: Apify trae su video fresco (UNA publicación con la clave de Spy, tope de 40 por día) y lo escucha la IA del negocio. Falta comprobar que el actor devuelve `videoUrl` con `directUrls` de UN reel y que la IA de un negocio escucha ese mp4.

**Dónde:** `C:/dev/wt-puntas/docs/relevo/nube-spy.md:63 ; lib/spy-transcripcion-servidor.ts`

### 6. Sin probar: el acortador `linktw.in/pywydg` de verdad en «Sus páginas»

_feature · chico_

Correr los dos curl que dejó la nube para saber si redirige por HTTP, por JavaScript/refresh, o si es una página de «continuar» con botón (en ese caso queda «Abrir», sin marco). Desde la nube no se llega.

**Dónde:** `C:/dev/wt-puntas/docs/relevo/nube-spy.md:121-131 (los comandos, textuales)`

### 7. Medir en producción la velocidad de la ficha con Den Borg

_feature · chico_

En la vista de prueba bajó de 3,9 s a 3,2 s hasta el gráfico (2.369 → 1.664 elementos), pero la vista de prueba NO tiene el CDN de Meta. Repetir la medición en producción con Den Borg. Método y números en docs/hallazgos-competitors-spy.md.

**Dónde:** `C:/dev/wt-puntas/docs/hallazgos-competitors-spy.md ; docs/relevo/nube-spy.md:77`

### 8. Medir en la base el YouTube de Leila (ws 9), que la nube dejo pedido

_feature · chico_

La nube dejo la consulta escrita para que la corra el Cerebro contra produccion. Hecho = la medicion corrida y anotada en el relevo.

**Dónde:** `docs/relevo/nube-spy.md:99 · (consultas en el mismo archivo, ~:191-205)`

### 9. Los formatos nuevos del catalogo todavia no entran en el analisis de piezas

_feature · chico_

El tipo de funnel con citas y la oferta arriba ya estan; el relevo deja explicito que los formatos nuevos del catalogo en el analisis de piezas quedan pendientes.

**Dónde:** `docs/relevo/nube-spy.md:79`

### 10. Los competidores duplicados que ya estan en la base no se arreglan solos

_feature · chico_

El arreglo del alta impide los NUEVOS duplicados, no limpia los viejos: «sofiacontreras» vs «Sofia Contreras», «hormozi» vs «@AlexHormozi» vs «acquisition.com». Hay que borrarlos a mano desde el tacho de la tarjeta, y solo puede el administrador del negocio. ATENCION: `acquisition.com` no se va a juntar con Hormozi nunca (un dominio no se empareja con una persona; hacerlo pediria una tabla de dominios). Borrar se lleva TODAS sus piezas (`on delete cascade`) y no se deshace.

**Dónde:** `C:/dev/wt-puntas/app/competitor-spy/SpyApp.tsx:760 (el tacho de la tarjeta), :1989 (la confirmacion); C:/dev/wt-puntas/app/competitor-spy/actions.ts:43-54 (soloAdmin), :216 (quitarCompetidorAction)`

### 11. El chip de pais de la barra: la columna existe y nadie la escribe

_feature · chico_

`spy_competidores.pais` se LEE (`adLibraryCubreComercial(pais)` para saber si la Ad Library de ese pais cubre lo comercial, y `busquedaDeSusAnuncios` lo recibe) pero grep de escrituras (`pais:`) no encuentra NINGUNA en todo Spy: siempre llega null. Hecho = el chip en la barra que lo setea, o deducirlo del perfil, y que la busqueda de anuncios lo use.

**Dónde:** `C:/dev/wt-puntas/lib/spy.ts:93,164 (la columna en el select); C:/dev/wt-puntas/lib/spy-reglas.ts:353 (adLibraryCubreComercial); C:/dev/wt-puntas/lib/spy-funnel.ts:399,404; la barra en C:/dev/wt-puntas/app/competitor-spy/SpyApp.tsx`

### 12. Nadie vigila la cola de caricaturas: si se atasca, no se ve en ninguna pantalla

_feature · chico_

`masVieja` (desde cuando espera la pendiente mas vieja) solo sale por el JSON del script; grep -rn masVieja no encuentra ninguna pantalla ni ruta que lo lea. Y no hay cron: la cola es 100% a mano. Consecuencia: una cola parada (Canva desconectado, nadie corre el script) es invisible. Hecho = el super admin ve la cola y su `masVieja` sin correr un script, o un aviso cuando pasa de X dias.

**Dónde:** `C:/dev/wt-puntas/lib/spy-caricatura-cola.ts:84 (type Cola), C:/dev/wt-puntas/lib/spy-caricatura-reglas.ts:209-254`

### 13. Nadie miró si la caché compartida ahorra algo

_feature · chico_

Leer `spy_lecturas_canal.ahorros`. Si queda en cero, nadie mira a los mismos competidores y la tabla no se ganó el lugar: es la única medida de si el ítem 13 sirvió. Hecho = el número escrito en el relevo, con fecha.

**Dónde:** `lib/spy-compartido-db.ts (`anotarAhorro`) · docs/pendientes-martin.md:1005-1007`

### 14. Medir el competidor 13 del ws 11, que quedó en 12 piezas

_feature · chico_

Lo pidió la sesión de la nube expresamente al Cerebro, porque desde la nube no se ve la base. Hecho = saber por qué quedó corto y si la traída larga lo completa.

**Dónde:** `docs/relevo/nube-spy.md:191 → «Qué medir en la base de producción»`

### 15. Competitors Spy no tiene pantalla propia en el teléfono

_feature · grande_

Está `EN_CAMINO` en lib/movil-rutas.ts desde antes del pedido: un teléfono ve la cubierta «se usa en la computadora». Lo nuevo (gráfico, detalle, «Copiar estructura») ya se probó a 390 px en Chromium y entra sin scroll de costado con hasta 90 miniaturas. Cuando se escriba la pantalla, montar `GraficoSpy` tal cual.

**Dónde:** `C:/dev/wt-puntas/lib/movil-rutas.ts (EN_CAMINO) ; app/m/ ; docs/relevo/nube-spy.md:213-218`
