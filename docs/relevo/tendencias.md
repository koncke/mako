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
1b. [hecho] Piloto con lo que ya había (sin bajar nada): `armar-piezas.mjs` junta el Spy de producción (`C:/dev/tendencias/prod90.json`)
   y lo bajado → `C:/dev/tendencias/piezas.jsonl` (2.532 piezas en 90 días). `lotes.mjs` → 14 lotes de 200 en `lotes/`; 7 agentes
   sonnet los clasifican con `instrucciones-clasificar.md` y `temas.json` → `clasif/lote-NN.json`. Si un lote no tiene su archivo
   en `clasif/`, se vuelve a lanzar SÓLO ese (el mismo prompt: leer instrucciones + temas, clasificar leyendo, validar con node).
   Después: fundir los «nuevo:…» en `alias.json` y correr `analizar.mjs` → `tabla.json`.
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
- ⚠️ **El Spy de producción midió cada pieza UNA vez** (del 4 al 19/11): una pieza medida a los 2 días tiene pocos comentarios
  porque todavía no los juntó, y una cuenta medida el 4/11 no tiene piezas después. Comparar «últimos 30 días contra los 60
  anteriores» desde hoy daría «En baja» en todo. `analizar.mjs` corta cada cuenta en SU última medición y cuenta comentarios sólo
  de piezas medidas con 7 días o más (ventanas corridas 7 días).
- **Método del estado** (en `analizar.mjs`): Nuevo = visto por primera vez hace ≤ 60 días y con ≤ 3 referentes · En crecimiento =
  comentarios por día de los últimos 30 días ≥ 1,3× los de los 60 anteriores, sin bajar las piezas · En baja = piezas o
  comentarios < 0,7× · si no, Saturado. Los comentarios-palabra del CTA se separan de los de conversación con la muestra de texto.

## Piloto (21/11, con lo que ya había)

- 14 lotes clasificados (2.696 piezas; `C:/dev/tendencias/clasif/`). Los «nuevo:…» de los agentes se fundieron en
  `alias.json` (71 entradas; versionado en `docs/tendencias/herramientas/alias.json`).
- `analizar.mjs` → 43 tendencias con estado y 36 temas con pocas señales (`C:/dev/tendencias/tabla.json`). Es un piloto: IA
  (edición y carruseles), YouTube y Low ticket casi no tienen datos todavía; la bajada del paso 2 los llena.
- Temas que no estaban en la lista y aparecieron solos: aparecer en las respuestas de la IA, retener clientes, finanzas del
  negocio, eventos presenciales, criterio y liderazgo con IA, crear software con IA.
- Ajustes del método después del piloto: cada pieza aporta como mucho 5× la mediana de comentarios de su cuenta (un regalo con
  15.000 comentarios decidía solo); el ritmo de comentarios es null (no 0) sin 2 piezas maduras por ventana; con menos de 6
  piezas o un solo referente el tema va a `pocasSenales`.

## El pedido al chat Spy (se manda con el OK del Cerebro a la lista)

- Lista: `C:/dev/tendencias/referentes.json`, los de `datos: "bajar"` (65 Instagram, 36 YouTube).
- Sólo lo liviano de los últimos 90 días (desde el 23/08/2026): `yt-dlp --skip-download --write-info-json --write-comments` por
  pieza. En Instagram, la lista desde el Chrome de Martín, sólo leyendo: pestaña Reels (con las vistas del enlace) más la grilla
  (carruseles). En YouTube, `/videos` y `/shorts` con `--dateafter 20260823`.
- Dónde: `C:/dev/tendencias/<usuario de Instagram>/<id>.info.json` y `vistas.json` (`{"<código>": vistas}` de la lista). Los que
  no tienen Instagram, en `C:/dev/tendencias/<clave>/`. `armar-piezas.mjs` ya lee ese formato.
- Orden: primero los sectores sin datos (IA, Low ticket, YouTube, Anuncios, Closing), después el resto. Un proceso a la vez.
- Después, la transcripción sólo de las piezas con más comentarios de cada tema (la lista la doy yo con `tabla.json`).

## Estado (21/11, ~09:30 UTC)

- OK del Cerebro a la lista; pedido al chat Spy mandado (orden: Anuncios, IA, Closing, YouTube, High ticket, Low ticket, Nicho,
  Viral, Mentalidad; 90 días completos; comentarios de texto en IG y en los 10 videos con más comentarios de cada canal de YouTube).
  El Cerebro quiere **Anuncios analizado primero** para mandárselo a Martín.
- Ronda 2 de referentes (4 agentes): 155 en total (`referentes-extra.json`); avisado al chat Spy (los 7 nuevos de Anuncios van en esa tanda).
- Histórico clasificado (7 lotes `hist-NN`, 1.273 piezas): da la antigüedad y el peso de hace un año; el año desempata el estado.
- Cuando el chat Spy avise que terminó un sector: `node armar-piezas.mjs` → `node lotes.mjs` (sólo arma lotes de lo nuevo) →
  agentes con `instrucciones-clasificar.md` → fundir «nuevo:» en `alias.json` y `nombres.json` → `node analizar.mjs` →
  `node uso.mjs <sector>` → un agente con `instrucciones-uso.md` → `uso/<sector>.salida.json` se junta en `como-usarla.json` →
  `node generar.mjs C:/dev/wt-tendencias/docs/tendencias`.
- Ojo: en los reels con «comenta X» la muestra de comentarios es casi toda la palabra; lo que pide la gente sale de YouTube y
  de los carruseles. Un comentario de una o dos palabras («Ia», «Promtp») cuenta como palabra.
- Juan ADS promociona SaleADS.ai (competidor directo de MaKo) en su YouTube.

## Cambio de Martín (21/11, ~10:00 UTC): ÁNGULOS, tres señales, gráfico; Operaciones y Lifestyle

- Lo visible dice **ángulos**. Salidas: `docs/tendencias/angulos.json` + `mapa.md` (`generar.mjs`). Tres señales por separado
  (insistencia en parte, interacción cada 1.000 vistas, contagio), crecimiento, puntaje por percentiles y estado. Método en
  `docs/hallazgos-contenido.md` («El método de los ÁNGULOS GANADORES»). Diseño de la pestaña: `docs/tendencias/diseno-pestana-angulos.md`
  (paleta validada con dataviz: aqua/azul/naranja + anillo para Nuevo).
- Sectores **Operaciones** (10) y **Lifestyle** (8); lista en 163. Los temas de equipo y delegación pasaron de High ticket y
  Mentalidad a Operaciones (alias). Las 872 piezas «fuera» se releyeron (`refuera-NN`): ~90 Lifestyle, ~14 Operaciones.
- Pendiente: que el chat Spy termine Anuncios → clasificar lo nuevo → `uso.mjs Anuncios` + agente de «cómo usarlo» →
  `generar.mjs` → mandar Anuncios al Cerebro (para Martín) y al chat de Content Machine (local_fc754a71-…) con el diseño.
- ⚠️ (21/11 ~10:15) La extensión Claude in Chrome se desconectó con el apagón: el chat Spy baja SÓLO YouTube hasta que Martín la
  reconecte (la lista de Instagram sale de ese Chrome). Anuncios: 15 cuentas encoladas. Plan: si el YouTube de Anuncios termina
  antes, mandar al Cerebro un Anuncios preliminar (sólo YouTube) y completarlo con Instagram después.

## Encargo nuevo (21/11 ~10:40): SUB-ÁNGULOS concretos, propuestas para producir y el filtro de ángulos en Spy

- Martín quiere empezar a PRODUCIR y ángulos ESPECÍFICOS (una afirmación por ángulo). Fuente: la colección `spy` de Content
  Machine (918 piezas: 503 en español, 415 de Dakota), bajada con ArtifactData a `C:/dev/tendencias/spy-cm/spy/`.
- Circuito (todo en `C:/dev/tendencias/sub/`, instrucciones versionadas en `docs/tendencias/herramientas/sub/`):
  1. 8 lotes (`sub/lotes/s-NN.json`) → 4 agentes sonnet sacan la afirmación de cada pieza → `sub/salida/s-NN.json`.
  2. `node herramientas/sub-afirmaciones.mjs` → `sub/afirmaciones.md` → un agente consolida → `sub/subangulos.json`.
  3. `node herramientas/sub-senales.mjs` → `sub/ranking.json` + `sub/mapa-angulos.json` (id de pieza → sub-ángulos).
  4. Un agente con `instrucciones-propuestas.md` → `sub/propuestas.json` + `sub/resumen-propuestas.md` (para el Cerebro/Martín).
  5. El mapa al chat Spy (escribe el campo `angulos` en cada documento) y el contrato al chat de Content Machine.
