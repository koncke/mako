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

- **El shell único de Create** (`app/_crear/PantallaCrear.tsx` del chat «Create: un solo diseño») estaba SIN commitear: el
  Copywriter todavía usa su armazón (MaKo · páginas · página). Le pedí a ese chat el sha para montarlo; también que no
  toque la fila de Copywriting en nav.ts (ya está acá): **conflicto esperable** en el bloque de Create de nav.ts al juntar
  las dos ramas (se resuelve a mano: las dos filas nuevas).
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
