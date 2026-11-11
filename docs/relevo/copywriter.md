# Relevo — Copywriting (el chat de la tab; cuenta claude4, 11/11/2026)

Rama `copy-outliers-1111`, worktree `C:/dev/wt-copy-outliers-1111`. Se sube a `punta/copywriting-outliers` (hoy en 08dd1cedb,
rebasada sobre main ada98995d) y el Cerebro integra. Producción tiene hasta e2cb5fb8e (el despliegue de las 11:05 UTC del 11/11).

## Lo pedido (Martín, 11/11, por el Cerebro)

«lo mismo que te acabo de decir con web generator, aplícalo para copywriting, me gustaría traer outliers. Tenemos la
transcripción de un montón de cosas, tanto de anuncios como de carruseles, como de reels, y videos de YouTube… podríamos mantener
templates con ciertas estructuras, pero también traer los outliers». Más la prueba de punta a punta en producción, mirando, a
1440 y 375: (1) Copywriting primero en Create, (2) los outliers sin perder las plantillas, (3) pedir un guion, que MaKo lo escriba
y editarlo.

## Lo hecho y probado en producción (11/11)

- **En producción (e2cb5fb8e), probado:** la portada «Encuentra tu siguiente OUTLIER» (ws 3: 1,2k; ws 9: 2,3k), los filtros, el
  buscador, el modal con «SU GUION» transcripto y su «×», Replicar (MaKo pregunta la oferta y escribe; «Ver el original» entero),
  «Mis guiones», «Crear desde cero» con las plantillas, y el orden de Create (Copywriting, Video, Image, Web Generator; también en
  «More» del teléfono). (3) anda en el ws 9 a 1440 y a 375; el ws 3 no tiene IA a propósito.
- **Arreglado DESPUÉS del despliegue (en la punta, sale en el próximo):**
  - «Todos» intercala los formatos (eran 24 carruseles en inglés seguidos);
  - el modal muestra la pieza arriba y el texto abajo (era una caja blanca casi vacía);
  - en una página vacía (la de Replicar) MaKo escribe en el renglón vacío (quedaba «Escribe "/"…» arriba);
  - si la réplica repite 5 palabras seguidas del original, la propuesta lo avisa (pasó: «no es suerte, es sistema»);
  - la caja trabada se mide cuando cambia su ancho (el primer arreglo, desplegado, no alcanzó: docs/hallazgos-chat.md);
  - teléfono: «Mis guiones» y «Crear desde cero» debajo del título (no se veían), y llegan a su vista (el paso al teléfono
    perdía `nueva` y `ver`: lib/movil-creacion.ts).
- **Páginas de prueba:** borradas y comprobado en la base (fila, documento y charla): ws 9 `ghqvixe3uzr`, `gwp14mkuww8`,
  `gdioc06j32n`; ws 3 `g9mzb3l58qt`. Script: `C:/Users/marti/AppData/Local/Temp/claude/fb1d94a1aca5ced3/419b79ec-cbd8-462f-a8bc-088b55605527/scratchpad/limpiar-prueba.mjs`.

## Segunda vuelta en producción (2507c11c7, 15:55 UTC del 11/11)

- **Vistos y bien:** el modal con la pieza arriba; en el teléfono los botones debajo del título, «Crear desde cero» → plantillas
  y «Mis guiones» → la lista; la réplica empieza en «Gancho» (sin renglón vacío) y avisa la frase copiada.
- **Seguían mal y van en la punta (sale en el próximo despliegue):** el intercalado se deshacía después de la primera vuelta
  (`44bcd2e5a`); la caja trabada seguía cortada con la página en segundo plano (`0738ce0d1`, ahora con `MutationObserver`);
  el aviso no miraba el título propuesto (`4322790ff`).
- **Páginas de prueba de esta vuelta:** ws 9 `gzq1mp4ggrs`, borrada y comprobada en la base.

## Tercera vuelta: lo que pidió Martín con capturas (11/11, noche) — SALE EL 12/11 A LAS 11:05 UTC

- **En la punta (39dd39bbd y 9ced6db76):** Replicar escribe el guion ENTERO solo (oferta principal, sin «Aceptar»; las otras
  ofertas, como botones debajo); la portada va en el centro de Create con el chat de MaKo a la izquierda y «Nueva página» vuelve a
  ella; tarjetas de copy (texto primero, YouTube 16:9); fila de plantillas en la portada; la portada liviana. Recorrido y lista de
  lo que frenaba: la nota `copywriting-recorrido-1111.md` en la carpeta de notas del Cerebro.
- **ANTES de la velocidad** (producción 2507c11c7, ws 9, 1440): 7,5 MB de HTML, 3,8 s al primer byte, 5,3 s hasta poder usarla,
  8,9 s a la carga entera, 2.291 tarjetas, 46.030 elementos, filtros Reels 1,0 s · Todos 1,7 s · YouTube 7,2 s · Todos 2,2 s.
  Se mide igual: `performance.getEntriesByType('navigation')` y un `MutationObserver` alrededor del clic en el filtro.
- **LA PRUEBA DE MAÑANA, apenas producción tenga 39dd39bbd o posterior** (con capturas a 1440 y 375, en el ws 9):
  1. el DESPUÉS de la velocidad con los mismos números;
  2. tres réplicas reales AL LADO de su original con el cuerpo entero: el YouTube «¿Se puede vivir como creador de contenidos en
     Argentina?» (tiene transcripción, pieza 2605), el reel «Cobrar mejor no es suerte, es sistema» (pieza 1115) y un anuncio;
  3. la ida y vuelta: portada → Replicar → guion → «←» → «Nueva página» → portada, con el chat a la izquierda;
  4. las plantillas en la portada;
  5. borrar las páginas de prueba (script de arriba) y comprobarlo en la base. La página de Martín `gd0cztjgxek` es SUYA: no se borra.

## Lo que falta

- **Mirar en producción, después del próximo despliegue, los arreglos de arriba** (a 1440 y 375).
- **⚠️ Avisado al Cerebro:** a las ~15:05 UTC la IA del ws 9 contestó «API key not valid» de Gemini (502 a los 110 s); 15 minutos
  antes había escrito bien. El mensaje le muestra al usuario el texto técnico y le pide «pega una nueva» (errorDeCascada).
- **Visto y NO arreglado (otra tab):** en el teléfono, el chip «Cliente de Prueba» del super admin tapa el título de la barra (app/m/_ui).
- **Dos caminos al mismo lugar:** «Copiar estructura» de Spy y «Replicar» de Copywriting (hallazgos-copywriter).
- **El texto del modal llega cortado a 600 letras** (`TEXTO_EN_TARJETA`); «Ver el original» de la página sí lo trae entero.
- **Los anuncios propios como fuente** (`ad_transcripts` + el veredicto del Script Analyst): sólo hay en negocios de clientes.
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
