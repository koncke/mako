# Encargo: Carruseles — 20 pendientes (7/11/2026)

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

### 1. Las fotos de personas que no son el cliente quedan como un recuadro con su guía

_cliente roto · grande · ⟳ estaba anotado 4 veces_

Cuando el ejemplo tiene una persona que no es el cliente, «Editar» deja un recuadro con una guía en vez de una imagen. El paso siguiente es generarla con la IA de imagen del avatar del cliente (Flow). Hecho = la lámina sale con una persona generada y no con un recuadro.

**Dónde:** `lib/carruseles/replica.ts y lib/carruseles/documento.ts (`documentoDeReplica`); docs/hallazgos-carruseles.md:218-219`

<details><summary>Las otras formas en que estaba escrito</summary>

- Una persona en una lámina que no es el cliente queda como un recuadro con su guía
- La persona de una lamina que no es el cliente queda como un recuadro con guia
- Una persona en una lámina que no es el cliente queda como recuadro con guía
</details>

### 2. Nadie miró por qué `laminas` cortó «al techo» con US$0,54 de un tope de US$1,50

_plata · chico_

Diagnosticar el corte: la corrida del 6/11 se detuvo diciendo «al techo» habiendo gastado US$0,54 de un tope pedido de US$1,50. Sospecha a verificar: el techo efectivo se recalcula contra el crédito libre (`techoConCredito` menos la reserva de US$2), no contra lo pedido, y cada tanda de 40 lleva su propio techo de 1,5× (US$0,14). Hecho = el mensaje de corte dice el techo REAL y por qué (crédito, reserva o techo de tanda), no «al techo» a secas.

**Dónde:** `scripts/carruseles-biblioteca.mts:490 (`B.techoConCredito(techoPedido, c0, B.RESERVA_CREDITO_USD)`) y 495 (`const DE_A = 40`); docs/relevo/cerebro.md:19`

### 3. Traer una pieza nueva por su link no existe como comando del script oficial

_plata · mediano_

La receta medida (por link, 244 de 245 a ~US$0,0025; por perfil, US$4,71 y 1 de 245) sólo está implementada dentro del comando `laminas`, que lee las láminas de piezas YA guardadas. Para SUMAR un carrusel que Martín pase por link no hay comando: vivía en una copia temporal, ya borrada. Hecho = un comando que acepte una lista de links y los sume a la biblioteca, con esta entrada al actor de Instagram de Apify, de a 40 links por lectura: `{ "directUrls": ["https://www.instagram.com/p/XXX/"], "resultsType": "posts", "resultsLimit": 1, "addParentData": false }`

**Dónde:** `scripts/carruseles-biblioteca.mts:505 (el único uso de `directUrls`, dentro de `laminas`); docs/hallazgos-carruseles.md:74-80 y :211`

### 4. Lo que entre de ahora en más a la biblioteca no pasa por ninguna curaduría

_traba · mediano_

Una lectura nueva (`leer`) queda visible sin que nadie la mire, y ya se midió que el filtro automático no alcanza: el modelo barato se pasó de estricto (35 de 388 escondidos volvieron) y el filtro gratis `(laminas ?? 0) >= 3 && parece_contenido === true` tiraba 457 piezas por falta de dato, de las cuales 363 servían. Hecho = una pieza nueva entra en un estado «sin mirar» que no se muestra hasta que alguien la aprueba, o el script deja la hoja de descartes para revisar antes de aplicar.

**Dónde:** `lib/carruseles/biblioteca-servidor.ts:87 (`dejo_de_verse_en`), scripts/carruseles-biblioteca.mts (comando `leer`); docs/hallazgos-carruseles.md:210`

### 5. 1.213 carruseles de 1.470 siguen sin tipo

_traba · mediano_

`reclasificar` ya bajó de 1.253 a 1.213 leyendo el texto (portugués, alemán e inglés). Bajar de ahí necesita las láminas bajadas y leerlas con visión — o sea depende del item de las 111 láminas. Hecho = un número de «sin tipo» que no se mueva al correr `reclasificar` y el filtro de tipo con cobertura real.

**Dónde:** `C:/dev/wt-puntas/scripts/carruseles-biblioteca.mts (reclasificar) ; docs/relevo/nube-carruseles-rediseno.md:122-129`

### 6. Los anuncios en video ya guardados siguen apareciendo hasta la próxima lectura de Spy

_feature · chico · ⟳ estaba anotado 3 veces_

El código nuevo ya guarda `medio` para los anuncios (`displayFormat` de Apify) y el explorador no muestra ni cuenta un video, pero lo que YA está guardado no tiene `medio`, y si su miniatura ya se copió a nuestro bucket se perdió la única pista (la carpeta de cuadros de video del CDN de Meta, `/t15.`). Se corrige solo en la próxima lectura de Spy de cada cuenta; si hace falta antes, volver a leer los anuncios de las cuentas seguidas desde Competitors Spy. Hecho = «Anuncios N» no cuenta videos en el ws de prueba.

**Dónde:** `lib/carruseles/anuncios.ts (`esAnuncioEnVideo`), lib/spy-todo-reglas.ts y lib/spy-medio.ts (`medioDeAnuncio`), lib/spy.ts (`guardarMedios`); docs/relevo/nube-carruseles-rediseno.md:205-206`

<details><summary>Las otras formas en que estaba escrito</summary>

- Los anuncios en VIDEO ya guardados no se pueden distinguir de las imágenes
- Los anuncios en video ya guardados no tienen `medio` y no se pueden esconder
</details>

### 7. Revisar a mano `punta/carruseles-thumbnails`, que entró a main sin que nadie lo mire

_feature · mediano · ⟳ estaba anotado 3 veces_

El commit 25fbdc8a1 (ya en main, HEAD a11e7540f) trae el feedback de producción del 6/11 tarde: portada de Image, el CTA fuera, variedad por cuenta, anuncios sin video, flechas en el teléfono, el arreglo de «Editar» y la tab Thumbnails. Nadie lo revisó contra los pedidos de Martín con las capturas. Hecho = una pasada punto por punto contra el pedido citado en docs/relevo/nube-carruseles-rediseno.md:135-139 y las capturas de docs/carruseles/capturas-2026-11-06/; lo que falle vuelve a su chat sin pasar por Martín.

**Dónde:** `docs/relevo/cerebro.md:13; docs/carruseles/capturas-2026-11-06/ (13 capturas, 1440 y 390, claro y oscuro)`

<details><summary>Las otras formas en que estaba escrito</summary>

- Revisar a mano las cinco puntas que entraron a main sin que nadie las mire
- Cinco puntas entraron a main sin que nadie las revisara
</details>

### 8. Los prompts de carruseles y stories están incrustados en el código y el historial vive en memoria

_feature · mediano · ⟳ estaba anotado 3 veces_

`lib/ig-writer.ts` tiene los prompts hardcodeados (deberían pasar por el patrón de prompt editable, skill `add-editable-prompt`) y el historial del chat vive en memoria, así que se pierde. Hecho = los prompts se editan sin desplegar y el historial sobrevive a recargar la página.

**Dónde:** `lib/ig-writer.ts; docs/relevo/pendientes-barrido.md:131`

<details><summary>Las otras formas en que estaba escrito</summary>

- Los prompts de carruseles y stories siguen hardcodeados
- Prompts de `lib/ig-writer.ts` escritos a mano y el historial solo en memoria
</details>

### 9. «Editar» de carruseles nunca se probó con la IA real

_feature · chico · ⟳ estaba anotado 2 veces_

Correr `scripts/carruseles-probar-editar.mts --ws 3 --sin-laminas` y también con un carrusel CON láminas, y comprobar en producción el diseño que falló (/image-editor/b31f62ec-5727-4ac7-bde7-2bb141bf0727). Hecho = el texto es del negocio, las letras son las del editor, no hay recuadros grises y no vuelve «Tu IA no contestó ahora».

**Dónde:** `scripts/carruseles-probar-editar.mts · lib/carruseles/replica-servidor.ts (`replicarEjemplo`) · docs/relevo/nube-carruseles-rediseno.md:193 paso 1 · docs/relevo/cerebro.md:19`

<details><summary>Las otras formas en que estaba escrito</summary>

- «Editar» de carruseles daba «Tu IA no contesto ahora» en produccion
</details>

### 10. 1.213 de 1.470 carruseles siguen sin tipo: el problema es el clasificador, no el comando

_feature · mediano · ⟳ estaba anotado 2 veces_

Es trabajo de CÓDIGO, no un script: `reclasificar` en seco ya dio «1.253 → 1.253», 0 cambios, así que correrlo con --de-verdad no sirve. El 85 % sigue sin tipo y muchos son textos en portugués, alemán e inglés; quedan 512 piezas con `parece_contenido` nulo. Hecho = el clasificador reconoce otros idiomas y el porcentaje sin tipo baja, medido en seco antes de aplicar.

**Dónde:** `lib/carruseles/biblioteca.ts (función `reclasificacion`) · docs/relevo/pendientes-pc/pasos-cerebro-6-11.md §A3`

<details><summary>Las otras formas en que estaba escrito</summary>

- El clasificador deja el 85 % de los carruseles sin tipo
</details>

### 11. «Editar» con una IA real nunca se probó, y el arreglo está en main pero no en producción

_feature · mediano · ⟳ estaba anotado 2 veces_

El arreglo de «Tu IA no contestó ahora» YA está en main (`chatCheapCascade` con 8.000 tokens de salida en lugar de `chatCheap` con 512, la portada bajada con `fetchSeguro`, y el camino de guías mostrando sus láminas). Falta: (1) que entre a producción — el deploy del 11:08 UTC fue ANTES de este commit, y producción compila sola a las 08:05 ART; (2) probarlo con la IA real desde la PC: `node --env-file=.env.local --conditions=react-server --import tsx scripts/carruseles-probar-editar.mts --ws 3 --sin-laminas` (y el mismo con un carrusel CON láminas, y `--que thumbnail --id <id>` para una miniatura). Hecho = el texto es del negocio y no del ejemplo, las letras son las del editor, no hay recuadros grises, y el aviso de falla nombra la causa. Comprobarlo también en pantalla con `/image-editor/b31f62ec-5727-4ac7-bde7-2bb141bf0727`.

**Dónde:** `lib/carruseles/replica-servidor.ts:221-242 (el arreglo), lib/carruseles/replica.ts:457 (`avisoSinIA`) y :481 (`vuelveASinVer`); scripts/carruseles-probar-editar.mts`

<details><summary>Las otras formas en que estaba escrito</summary>

- «Editar» daba «Tu IA no contestó ahora» en producción: verificar que el arreglo lo cerró
</details>

### 12. Carruseles: de la marca del negocio sólo se aplican texto, tipografía y fondo

_feature · mediano · ⟳ estaba anotado 2 veces_

El chat de Imagen sólo recibe persona y núcleo MaKo, sin colores ni logo, así que la marca no se aplica entera (pedido de Leila del 30/10, medido A MEDIAS el 5/11). Falta pasar colores, logo y fuentes al prompt. Hecho = un carrusel generado sale con los colores y el logo del brand board del negocio, no sólo con su fondo. Va atado a que el Segundo Cerebro conozca el brand board (ítem 2.9 de la auditoría).

**Dónde:** `lib/landing-writer.ts:153 (lo que hoy recibe el chat), lib/image-editor/chat/ia.ts y lib/image-editor/chat/prompts.ts (donde hay que pasarlo); docs/relevo/pendientes-pc/auditoria-pedidos-5-11.md:43`

<details><summary>Las otras formas en que estaba escrito</summary>

- La marca completa en el chat de Imagen (colores, logo y fuentes)
</details>

### 13. El carrusel 4:5 sólo se puede hacer en Imagen, no en el Web Generator

_feature · mediano · ⟳ estaba anotado 2 veces_

Pedido de Leila repetido tres veces (2.14, 3.9, 4.10): que el carrusel 4:5 se pueda armar también en el Web Generator, porque en Gamma le sale «mucho más rápido» que emulando Canva. Existe en Imagen. Hecho = el Web Generator ofrece el formato 4:5 con las plantillas de carrusel.

**Dónde:** `app/web-generator (donde hay que ofrecerlo), lib/carruseles/ y app/image-editor/carruseles/ (lo que ya existe); docs/relevo/pendientes-pc/auditoria-pedidos-5-11.md:66`

<details><summary>Las otras formas en que estaba escrito</summary>

- El carrusel 4:5 solo se puede hacer en Imagen, no en Web Generator
</details>

### 14. Sobra el parámetro `largo` en la API y en los links viejos

_feature · chico_

La pantalla usa el deslizador de láminas, pero `largo` (2 a 4, 5 a 7, 8+) sigue en la API y en los links viejos. Limpiarlo o dejarlo documentado como compatibilidad. Lo declara la propia autocrítica del rediseño.

**Dónde:** `C:/dev/wt-puntas/docs/relevo/nube-carruseles-rediseno.md:116 ; lib/api-mako/areas/imagen (buscar_carruseles)`

### 15. El índice docs/hallazgos.md tiene DOS filas de Carruseles apuntando al mismo documento

_feature · chico_

Las líneas 45 y 48 son las dos «Carruseles → hallazgos-carruseles.md» con resúmenes distintos y solapados. Hecho = una sola fila, con el resumen integrado, en el mismo commit que el próximo cambio del documento.

**Dónde:** `docs/hallazgos.md:45 y docs/hallazgos.md:48`

### 16. El parámetro `largo` sobra: la pantalla usa el deslizador de láminas y él sigue en la API

_feature · chico_

`largo` (cortos 2-4, medios 5-7, 8+) sigue viviendo en el filtro, en la URL y en la API de MaKo aunque la pantalla usa el deslizador de láminas de dos puntas. Hecho = o se saca de la API y del parseo de URL dejando sólo el deslizador, o se documenta que queda por los links viejos. Es limpieza, no urgencia.

**Dónde:** `lib/carruseles/explorar.ts:190, :244-247, :341, :446, :472, :562; lib/carruseles/opciones.ts (`LARGOS_CARRUSEL`); docs/relevo/nube-carruseles-rediseno.md:116`

### 17. Las medidas finas de la referencia de Top Carousels sin ajustar contra un monitor real

_feature · chico_

Los valores gruesos ya se ajustaron con las capturas (4 columnas en 1440, modal en dos partes, filtros con deslizadores de dos puntas, colores del múltiplo). Faltan los finos: medidas exactas de tarjeta, tipografías y espaciados, comparando la pantalla contra las capturas en un monitor real. Hecho = una pasada lado a lado con docs/carruseles/referencia-top-carousels/ y docs/carruseles/pulido-2026-11-06/.

**Dónde:** `docs/carruseles/referencia-top-carousels/LEEME.md; app/image-editor/carruseles/ExplorarCarruseles.tsx; docs/hallazgos-carruseles.md:209`

### 18. Los 32 temas de hashtag siguen prendidos sin decidir si conviene apagarlos

_feature · chico_

Traen de todo (los temas de arranque son #marketingdigital, #emprendimiento, #marcapersonal, #ventasonline, #coachdenegocios, #negociosdigitales, #agenciademarketing, #copywriting, #infoproductos, #consultoria, y se sumaron hasta 32). Decidir si se apagan los que traen ruido: se apagan desde el panel de la plataforma («Cuentas» → «Editar la biblioteca de ejemplos») o con el comando `tema`. Hecho = la decisión queda escrita y los temas que sobran, apagados.

**Dónde:** `docs/hallazgos-carruseles.md:213; scripts/carruseles-biblioteca.mts:553 (`case 'tema'`)`

### 19. Correr `reclasificar --de-verdad` con el clasificador nuevo (1.253 → 1.213 sin tipo)

_feature · chico_

El pulido del 6/11 amplió el clasificador a portugués, alemán e inglés y mueve 40 piezas, pero el `--de-verdad` no se corrió después de que eso entrara a main. Correr primero en seco y confirmar que dice «Carruseles sin tipo: 1253 → 1213», y después: `node --env-file=.env.local --conditions=react-server --import tsx scripts/carruseles-biblioteca.mts reclasificar` `node --env-file=.env.local --conditions=react-server --import tsx scripts/carruseles-biblioteca.mts reclasificar --de-verdad` Es GRATIS (no le pide nada a Apify). Hecho = `estado` dice 1.213 sin tipo (y el CTA de lo guardado queda escrito con la 0404, ya aplicada).

**Dónde:** `scripts/carruseles-biblioteca.mts:543 (`case 'reclasificar'`); lib/carruseles/clasificar.ts; docs/relevo/nube-carruseles-rediseno.md:122-129`

### 20. Series y duplicados sin marcar: varias partes del mismo carrusel ocupan la grilla

_feature · mediano_

Por ejemplo las partes de «you can find anything on the internet», o muchas de meal prep de una misma cuenta. El reparto por variedad (máximo 2 de la misma cuenta por tramo de 12) no resuelve el duplicado de CONTENIDO. Hecho = una serie se muestra una vez, con sus partes adentro, o se marca y se esconde la repetida.

**Dónde:** `lib/carruseles/variedad.ts (`conVariedad`), lib/carruseles/explorar.ts (`filtrarCarruseles`); docs/hallazgos-carruseles.md:214`
