# Relevo — mapa de TENDENCIAS del mercado (chat «tendencias», hijo del Cerebro)

Encargo del Cerebro (21/11/2026): mapa de tendencias por sector (Orgánico de nicho, Orgánico viral, Anuncios, Closing y ventas, IA
con sus subsectores, YouTube, High ticket, Low ticket, Mentalidad y coaching), con datos de MUCHOS referentes y los comentarios como
señal de qué está caliente. Va a la pestaña «Tendencias» de Content Machine (https://claude.ai/artifact/FeLyfHY62GRHbLBAJX6QUz),
que rehace el chat de Content Machine (local_fc754a71-87b7-4a34-8133-0307a31abe12). La bajada la hace el chat Spy
(local_557794c1-f009-4764-b4de-dd9b15b0e16e). UN solo proceso pesado a la vez en la PC.

- Worktree: `C:/dev/wt-tendencias`, rama `tendencias` → se sube a `punta/tendencias`.
- Datos crudos (fuera del repo): `C:/dev/tendencias/`.
- Entregables: `docs/tendencias/mapa.md`, `docs/tendencias/tendencias.json`, cosecha en `docs/hallazgos-contenido.md` + índice.

## Pasos

1. [hecho, esperando el OK del Cerebro] Sectores y referentes → `docs/tendencias/referentes.md` (89 en 11 sectores; la fuente
   es `docs/tendencias/herramientas/referentes.mjs`, que escribe `C:/dev/tendencias/referentes.json`). Antes: sectores y referentes: lista de 6-12 por sector con Instagram y YouTube. Fuentes: los 32 de
   `lib/asesores/catalogo.ts`, los autores de Knowledge (`app/conocimientos/catalogo.ts` → `CURSOS_TODOS`), los 77 links
   (`C:/dev/inspiracion/relevo.json`), el Spy de producción (54 competidores, volcado en el scratchpad de los ángulos:
   `gurus-b/comp.json`) y la web. Se pasa al Cerebro ANTES de bajar nada.
2. Pedirle al chat Spy lo liviano de los últimos 90 días (texto, fecha, vistas, me gusta, cantidad de comentarios, CTA, tipo) →
   `C:/dev/tendencias/<cuenta>/`. Después, transcripción sólo de las piezas con más comentarios.
3. Análisis por tema dentro de cada sector: referentes que lo tratan, 30 días contra los 60 anteriores, comentarios cada 1.000
   vistas, antigüedad → Nuevo / En crecimiento / Saturado / En baja.
4. Entregables y pase al chat de Content Machine.

## Lo que ya se sabe (paso 1)

- **Lo bajado de Instagram con yt-dlp trae una MUESTRA de comentarios con texto y fecha** (`comments` del `video.info.json`:
  5.403 comentarios en 819 de las 997 piezas de `C:/dev/referentes-videos/`), **pero NO trae las vistas** (`view_count` vacío en
  las 997). Las vistas salen de la lista de la pestaña Reels (texto del enlace) en el Chrome de Martín.
- Muchos comentarios son la palabra del CTA («Video», «CLASE»): para medir si un tema está caliente hay que separar los
  comentarios-palabra de los comentarios de conversación.
- Instagram sin sesión no deja verificar un usuario con curl (perfil real y uno inexistente dan el mismo HTML). YouTube sí:
  `youtube.com/@handle` da 404 si no existe.
- Dos agentes (sonnet, web) verificaron usuarios y buscaron referentes nuevos → copiados a `C:/dev/tendencias/handles-verificados.json`
  y `C:/dev/tendencias/referentes-nuevos.json`.
- **El Spy de producción ya tiene 2.545 piezas de los últimos 90 días** (`spy_piezas`, con vistas y comentarios; sólo lectura
  con un GET a la REST, como `rest.mjs`). Las cuentas que ya están ahí no se vuelven a bajar. Tiene también el canal `anuncios`
  (biblioteca de Meta) de Hormozi y Sofía.
- **Corpus histórico para la antigüedad de cada tema:** 10.567 piezas con fecha en el scratchpad de los ángulos
  (`…/0ee425c6-…/scratchpad/afirm/corpus.json`, armado por `corpus.py` del mismo lugar).
- **Herramientas** (versionadas en `docs/tendencias/herramientas/`, copia de trabajo en `C:/dev/tendencias/herramientas/`):
  `yt-chequeo.mjs` (¿existe el canal?, último video, cuántos en 90 días, sin claves), `referentes.mjs` (la lista), `analizar.mjs`
  (de `piezas.jsonl` + `clasificacion.json` a `tabla.json` con el estado de cada tema).
- **Método del estado** (en `analizar.mjs`): Nuevo = visto por primera vez hace ≤ 60 días y con ≤ 3 referentes · En crecimiento =
  comentarios por día de los últimos 30 días ≥ 1,3× los de los 60 anteriores, sin bajar las piezas · En baja = piezas o
  comentarios < 0,7× · si no, Saturado. Los comentarios-palabra del CTA se separan de los de conversación con la muestra de texto.
