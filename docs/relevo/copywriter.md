# Relevo — Copywriting (el chat de la tab; cuenta claude4, 11/11/2026)

Rama `copy-outliers-1111`, worktree `C:/dev/wt-copy-outliers-1111`. Se sube a `punta/copywriting-outliers` (hoy en 1142164a1)
y el Cerebro integra. **Despliegue único de hoy: 13:00 UTC, a mano**; lo que salga tiene que estar en main en verde a las 12:57.

## Lo pedido (Martín, 11/11, por el Cerebro)

«lo mismo que te acabo de decir con web generator, aplícalo para copywriting, me gustaría traer outliers. Tenemos la
transcripción de un montón de cosas, tanto de anuncios como de carruseles, como de reels, y videos de YouTube… podríamos mantener
templates con ciertas estructuras, pero también traer los outliers». El Cerebro pidió además la prueba de punta a punta, mirando
con capturas en el ws 3: replicar, editar, guardar, reabrir, las plantillas, MaKo adaptando a la oferta, cada botón, escritorio y
celular.

## Lo hecho

- **8ff1e99fe: la portada de outliers.** Diseño en D18 (docs/diseno-copywriter.md).
  - `/copywriter` abre «Encuentra tu siguiente OUTLIER», con la grilla, la tarjeta y el modal de Image.
  - «Mis guiones» (`?ver=guiones`) lleva a la última página, y «Crear desde cero» (`?nueva`) a las plantillas, que quedan.
  - También en el teléfono.
  - «Replicar» crea la página atada al original (`props.outlier`). MaKo pregunta para qué oferta y la escribe; el original le
    llega en cada pedido, y la página tiene «Ver el original».
  - API de MaKo: `outliers_copywriter` y `replicar_outlier_copywriter`.
- **6cc78461f: lo que mostró la simulación con los datos reales del ws 3.**
  - YouTube quedaba en UN video de 369 por cómo se comparaban los links.
  - Los pies de pocas palabras no son copy.
- **La prueba en producción del 11/11 (ws 3 y ws 9, 375 y 1440) y sus 7 arreglos** (a49c3fa7c … 1142164a1):
  - la barra del teléfono decía «Sin título» con el título escrito;
  - «Ver ejemplo» cortaba el texto a 375;
  - una burbuja de más después de las preguntas de MaKo;
  - «Instala MaKo para escribir» cortada (app/_chat/CajaChat.tsx, compartida);
  - «Ctrl+Z» en el teléfono (y ⌘Z en Mac);
  - «1 bloque nuevos»;
  - la letra de las preguntas en el teléfono.
  (3) «pedir un guion, que MaKo lo escriba y editarlo» anda de punta a punta en el ws 9: el ws 3 no tiene IA a propósito.
- **Tests:** copywriter-outliers 13/0 (13 de 13 roturas cazadas). Pasan además copywriter-ia, copywriter-iniciativa,
  copywriter, copywriter-tipos, copywriter-compartir, movil-mas-secciones, publicar-desde-crear, usar-en-anuncio,
  api-mako-registro, api-mako-rest y doer-recetas-video-imagen.

## Lo que falta

- **El chequeo de tipos:** lo corre el filtro de antes de subir (acotado) y GitHub («Tipos» completo), por orden del Cerebro.
- **Después del despliegue de las 13:00**, en el ws 3 y en el ws 9, a 1440 y a 375, con capturas:
  - la portada de outliers, abrir uno y Replicar;
  - MaKo escribiendo la réplica en el ws 9 y «Ver el original»;
  - «Mis guiones» y «Crear desde cero»;
  - los 7 arreglos;
  - Copywriting primero en Create.
- **Borrar las páginas de prueba** y comprobarlo en la base. Las del 11/11 llevan «[prueba Copywriting 11/11]»; las de Replicar,
  «Como @…». Hoy: ws 9 `ghqvixe3uzr`, ws 3 `g9mzb3l58qt`. Script: `C:/Users/marti/AppData/Local/Temp/claude/fb1d94a1aca5ced3/419b79ec-cbd8-462f-a8bc-088b55605527/scratchpad/limpiar-prueba.mjs` (sin
  `--borrar` sólo lista). Hay que pasarle al Cerebro los ids.
- **Visto y NO arreglado (otra tab):** en el teléfono, el chip «Cliente de Prueba» del super admin tapa el título de la barra (app/m/_ui).
- **Dos caminos al mismo lugar:** «Copiar estructura» de Spy y «Replicar» de Copywriting (hallazgos-copywriter).
- **«Copywriting primero en Create»** NO es de esta rama: ya lo trae `punta/spy-pruebas` (el chat de Competitor Spy tocó la
  barra el 11/11). No se toca `app/_components/nav.ts` acá para no pisarlo; se verifica en producción.
- **Los anuncios propios como fuente** (`ad_transcripts` + el veredicto del Script Analyst).
- **Transcribir al replicar** un reel o un video sin guion (`asegurarGuion` de Spy, con su tope de 20 por día).

## Lo que espera a Martín

- Nada por ahora. Lo de las transcripciones (que casi no hay) está en hallazgos-copywriter, en palabras de producto.

---

## Antes: el relevo de las plantillas (29/10)

### Relevo — Copywriter: plantillas reales y su experto (cuenta claude3, 29/10/2026, tarde)

Rama `plantillas-copywriter-2910` (worktree `C:/dev/wt-copywriter-notion`), desde origin/main `ff908e645` con el plan
`plantillas-reales-2910` (da6d07dee, sólo docs) mergeado. Pedido del Cerebro: la §5 de
[plantillas-reales/copywriter.md](../plantillas-reales/copywriter.md), en su orden. **No pusheo: Integración arma el tren.**

- **Hecho** (afe1be537): el bloque `tabla` de la IA; los 12 ejemplos y sus esqueletos; `youtube-retencion` con su aviso;
  la API con el esqueleto; `copywriter.experto` y `copywriter.adaptar.user`; «Adaptar a mi negocio», «Solo la
  estructura», la franja de restos y el aviso al copiar. Diseño: D16. Cosecha: hallazgos-copywriter.
- **No tocado, a propósito** (lo cambia Create en su tanda 0): app/_crear y lib/copywriter/contexto.ts. Cuando llegue a
  main: pasar `extractoDe`, `chipsDe`, `insignia` y `descripcion` (como `ayuda`) a `PlantillaCrear` en
  app/copywriter/Copywriter.tsx (hoy la insignia va en el `rotulo`), y leer el negocio con `grafoParaChat`.
- **Avisos:** lib/avisos/LICENSE-{CLAUDE-YOUTUBE,MARKETINGSKILLS,PROFOUND}, texto literal; Create avisado (misma carpeta).

---

# Relevo — chat «Copywriter = Notion» (cuenta claude3, 29/10/2026)

Rama `copywriter-notion-2910`, worktree `C:/dev/wt-copywriter-notion`. **Sale de origin/main (7f36fa9c6) con
`copywriter-2810` MERGEADA adentro** (la tanda del 28/10, que estaba en la fila de verificación del Cerebro como
`7eef753da`/`e003e8994`): esta rama la reemplaza. Diseño: [docs/diseno-copywriter.md](../diseno-copywriter.md), D11–D14.
Cosecha: [hallazgos-copywriter.md](../hallazgos-copywriter.md). **No pusheo: el Cerebro verifica y sube.**

## Lo pedido (Martín, 29/10, por el Cerebro)

«quiero que trabajes en "Copywriter", quiero que sea una réplica de Notion, busca inspiraciones de la web o un repo que
sea copia, y replícalo. Quiero que tenga la barra lateral de MaKo para que se pueda pedir cosas por allí y NO quiero otras
tabs internas que hoy aparecen en la topbar ni nada de ONBOARDING».

## Lo hecho

- **El editor es BlockNote 0.56.0** (MPL-2.0 el núcleo; los XL, GPL, no se instalan): bloques, «/», asa ⋮⋮ para arrastrar,
  barra de la selección con «Preguntar a MaKo», listas, desplegables, tablas, «Texto destacado». Lo guardado NO cambió
  (conversor `lib/copywriter/notion-bloques.ts`). D11.
- **«Nueva» → «¿Qué vas a crear hoy?»** con 13 templates (anuncio, copy de Meta, Reel ← el del Editor, stories,
  carrusel, email, 5 VSL de lib/vsl-estructuras.ts, YouTube, en blanco), escritorio y teléfono. Tipos nuevos: vsl, email,
  post, pagina. D12.
- **Sin tabs internas ni onboarding:** nav.ts (Copywriting → /copywriter, key `copywriter`, sin secciones; ads-writer,
  stories, youtube-writer a SIN_FILA), lib/movil-rutas.ts (Copywriting → /m/copywriter), /stories redirige. **La puerta se
  abrió a todos** (`veCopywriter`, `veCopywriterEnApi`). D13.
- **API de MaKo:** `listar_plantillas_copywriter`, `plantillaId` al crear, `editar_documento_copywriter` (MaKo escribe en
  la página con IA). docs/api-mako.md y el snapshot regenerados. D13.
- **La mudanza:** la primera apertura copia los guiones del Ads Writer y el historial de Reels a páginas, una vez por
  negocio (lib/copywriter/mudanza.ts). D14.
- **Capturas** (maqueta con los componentes reales, Chrome sin ventana): C:/dev/revisiones/copywriter-notion-2910/.

## Lo que falta verificar / lo que espera

- **El shell único de Create:** mergeado (create-shell-2910: 2b62724ea → merge 61bc5a3c1; su punta 4e75f2067 → merge
  9c81c1a94) y el Copywriter montado en `PantallaCrear` (D15, d5af2bbca). **Esta rama trae la de Create adentro:** sube
  una vez, con las dos (la de Create redirige /reels a `/copywriter?nuevo=reel`, que vive acá). nav.ts y movil-rutas.ts
  los resolví acá, encima del commit de Create.
- **Commits de esta rama (29/10):** d8093aa14 (Notion) · 5786f7fef · feb62eb06 · 61bc5a3c1 (merge Create) · d5af2bbca
  (shell) · 9c9d02ba1 (tipos de «Duplicar») · 9c81c1a94 (merge Create, punta 4e75f2067) · 0fc58707d (los rojos de
  tests-afectados) · d938b5003 (el pie del super admin con la forma de Offer).
- **Verificación de la mudanza (Integración, 29/10):** ALTA + tres medias (C:/dev/revisiones/2910-verificacion-mudanza-copywriter.md).
  Arregladas en ac588e955 (id estable por origen, «hecha» sólo si entró todo, Reels primero, la celda vieja), con
  tests/copywriter-mudanza.test.ts y el arnés de Integración corrido sobre esta rama
  (C:/dev/revisiones/scratch-cw-copywriter/mudanza-salida.json). Las bajas que quedan, en hallazgos-copywriter («Qué quedó»).
- ✔ **VERDE (29/10, ~08:00) sobre d938b5003:** `tests-afectados --base origin/main --rapido` 5.339 tests de 528 archivos,
  0 rojos; tsc-acotado 0 (53 archivos en 4 tandas + 13 + 5, con los dos `.d.ts` globales, ver hallazgos). Cada arreglo,
  probado rompiéndolo. Capturas nuevas: d14 (pie del super admin), d15 (el cliente no lo ve), t5 (teléfono con
  `?nuevo=reel`: la hoja abierta con el Reel primero).
- `/m/stories` (StoriesM), `/ideas` y el «pronto» de YouTube Writer del teléfono siguen vivos sin fila (las keys `ideas` y
  `youtube-writer` en SIN_FILA con `comingSoon`, porque sus páginas las piden): retirarlos arrastra los tests del
  teléfono (m-creacion, movil-rutas, movil-desvio); va en otra tanda.
- La mudanza ESCRIBE en producción la primera vez que cada negocio abre la tab (copias, no toca lo original).
- `/ads-writer` sigue andando por link (la matriz, «Analizar guion»), sin fila. Qué hacer con eso: Martín.

---

# Relevo — chat «Copywriter» (cuenta claude4, 28-29/10/2026)

Rama `copywriter-2810`, worktree `C:/dev/wt-copywriter-2810`. Diseño: [docs/diseno-copywriter.md](../diseno-copywriter.md).
Cosecha: [hallazgos-copywriter.md](../hallazgos-copywriter.md) (+ una entrada en hallazgos-ads y otra en hallazgos-seguridad).
Nota compartida con el Cerebro: side-session-notes/…/copywriter-2810.md. **No pusheo: el Cerebro verifica y sube.**

## Lo pedido (Martín, 28/10, por el Cerebro)

«Quiero que implementes mila.gg combinado con notion en "copywriter" y que allí se puedan crear los guiones de ads, de
reels, de stories, de youtube... Que tenga una interfaz similar a la de web generator, con la sidebar de mako y el editor a
la derecha». Y después (el Cerebro, por lo que Martín le prometió a Teo): «Tu cliente entra y edita lo que le presentás»
→ «Compartir para editar».

## Lo hecho (todo commiteado en la rama)

- Tanda 1 — la tab, el árbol tipo Notion, el documento por bloques, MaKo en «Discutir»: 83a452501 + 2f4df801e (VERDE dado).
- Tanda 2 — MaKo escribe EN el guion por herramientas, a la vista, como propuesta; `@`; 8 operaciones en la API: 62a9b1b28.
- Tanda 3 — Reel y Story con estructura en la biblioteca; `?nuevo=<tipo>`; «Abrir en Copywriter» en Ads Writer y Stories;
  /youtube-writer lleva al Copywriter a quien lo ve: 1d5bc178c.
- Tanda 4 — «Compartir para editar» sin cuenta (/compartido/<token>, /api/compartido/guion, «Última edición», 3 operaciones
  de la API): 197f91c94.
- Verificación del Cerebro de 2f4df801e: la charla del guion cerrada al admin del negocio (3f0c73eac); guiones largos y
  muchos guiones con el arreglo de raíz del Cerebro (12a413e01 + cherry-pick 7c5a4498c de f92b74992 + test 169fb8e1a).
- Tipos: PanelMaKo (05b64e49b).
- Los rojos de la primera corrida de tests-afectados (29/10, 00:40 UTC: 4.723 tests, 4 rojos): el voseo del copy, mi test
  de la API (11 operaciones) y el renglón de «Analizar guion» que fija tests/ads-writer-analizar: ba1a749db.

## Lo que falta verificar

- ✔ **tests-afectados `--base origin/main --rapido`** sobre ba1a749db: VERDE, 4.723 tests de 451 archivos (29/10).
  VERDE mandado al Cerebro por SendMessage.
- **tsc acotado**: hecho en 6 tandas con `con-turno` el 28/10: 0 errores propios (sólo los 14 de `_opencut`; los 2 de
  `app/conocimientos/Compartir.tsx` en una tanda son el `<style jsx>` que el acotado no carga: la otra tanda lo compila
  limpio). Después sólo cambiaron textos y números de tests (ba1a749db). Falta mandarle el VERDE al Cerebro.
- ✔ **Capturas de las tandas 2, 3 y 4** (escritorio y teléfono, 29/10): C:/dev/revisiones/copywriter-2810/ (t2-*, t3-*,
  t4-*). Lo que midió cada una: el Reel con sus 4 secciones y sólo las estructuras de Reel; YouTube «Todavía no hay de
  YouTube»; el menú ⋯ con «Compartir para editar»; el modal con su link; la vista del link sin MaKo ni selectores, que
  guarda y marca «Leila con el link». La maqueta y sus planes: side-session-notes/…/copywriter-maqueta/.
- Lo que sigue es del Cerebro: la verificación de 7eef753da con refutador (primero la puerta pública que escribe).

## Lo que espera a Martín

- Validar el Copywriter (hoy `adminOnly` y sólo el super admin): el día que lo abra, se cambian lib/copywriter/puerta.ts y
  lib/copywriter/puerta-api.ts, y salen de la barra Stories y YouTube Writer (`SIN_FILA`, lo hace el jefe Sidebar).
- De qué curso sale la estructura de **YouTube** (hoy no tiene: no hay fuente en el repo).
- `grafoParaChat` (rama mako-inteligente-2710-c4): el enganche es `const GRAFO` en lib/copywriter/contexto.ts.

## Quedó sin hacer

- «Compartir para editar» desde el teléfono del dueño (la vista del guion del teléfono no tiene el menú ⋯).
- `borrarSettingSi` no tiene el desvío de valores largos: un documento de más de ~6 KB cuyo índice no entra queda huérfano.
