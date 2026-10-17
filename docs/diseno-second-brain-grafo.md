# Diseño: el grafo del Second Brain, reconstruido (17/10/2026)

**Para:** el Cerebro, el Ops Center y la próxima sesión del Second Brain. Se lee en 5 minutos. Sale del feedback de
Martín del 17/10 (puntos 11, 12 y 13). Lo decidido acá no se le pregunta a Martín.

## En un minuto

- **El grafo es la memoria del negocio, partida en piezas chicas.** Cada nodo es UNA cosa del negocio con su tipo,
  su resumen corto y de dónde salió. Un chat (MaKo o un jefe) pide los nodos que le sirven y no todo el contexto.
- **Nada se copia.** El grafo se sigue armando al leer, de las tablas de siempre (`construirCerebro()`,
  `lib/cerebro-grafo.ts`). No hay tabla de nodos ni migración: la fuente manda y el grafo no se queda viejo.
- **La pantalla sólo dibuja el grafo**, siempre en oscuro. Al tocar un nodo, el detalle va en la barra lateral y nunca
  aparece nada abajo. Editar un área abre una caja encima.
- **El super admin suma una segunda capa, «Construcción»**: las áreas de MaKo, sus chats jefe, las bitácoras y los
  hitos. Reemplaza la vista de áreas de `/admin/dev` (`MapaAreas.tsx`), que se depreca.

## Lo que copiamos, y de quién

| App | Lo que tiene | Lo que tomamos |
|---|---|---|
| Obsidian | El grafo sale de las notas; la «vista local» muestra una nota y sus vecinos a 1-2 saltos | El grafo se deriva de la fuente; un chat recibe la **vista local** de lo que pregunta |
| Tana | Cada nodo tiene un *supertag* (su tipo) y campos tipados; un campo que apunta a otro nodo es un vínculo | Cada nodo trae `tipo` y `datos` (nombre → valor); una relación de la base es una arista con su motivo |
| Heptabase | La tarjeta se abre al costado sin perder el lienzo | La barra lateral del grafo es el detalle; editar va en una caja encima |
| Mem | Lo relacionado aparece solo | Las aristas laterales salen de los datos (una razón usa un formato, una landing promete algo), nunca de una IA |
| GraphRAG | Comunidades jerárquicas con un resumen cada una; búsqueda local (semillas + vecinos) y global (resúmenes) | Carpeta y área son las comunidades, con su resumen de una línea. Una pregunta concreta recibe vecinos; una general, el índice |
| Graphiti / Zep | Grafo temporal: cada hecho entra como un episodio con su fecha (`valid_at`) y se suma sin recalcular todo | Cada nodo trae `nace` (cuándo apareció su fila). De ahí salen «lo último» y la animación del nodo nuevo |

## La fuente de cada nodo

El id es estable y sale de la clave de la fuente (un id inestable rearma el mapa entero: `huellaDe()`,
`lib/cerebro-layout.ts`). `nace` es el `created_at` de la fila; las claves de `app_settings` sólo tienen
`updated_at`, que se usa como «a más tardar» y se dice así.

| Tipo | Se lee de | Id | Se conecta con | Lo ve |
|---|---|---|---|---|
| Tu negocio, fase, cuello, canal, objetivo | brief + `negocio.fase.diagnostico` + `objetivo_*` | `raiz`, `fase`, … | como hoy | cliente |
| Documento | `archivero_files` | `doc:<id>` | los datos que aportó | cliente |
| Plano del resumen, dato del brief, voz, cara | `mako.archivero.*`, `mako.personalidad`, `mako.persona` | `pan:`, `campo:`, `voz` | como hoy | cliente |
| **Oferta** (nuevo) | `ofertas` | `oferta:<id>` | sus productos (`oferta_productos`), sus funnels (`funnel_ofertas`), su lead magnet | cliente |
| Producto | `productos` | `prod:<id>` | la oferta que lo incluye (antes: el campo del brief) | cliente |
| **Lead magnet de Offer** (nuevo) | `lead_magnets` (los de `mako.entregable` siguen como `ent:`; si uno se llama igual, es el mismo y no entra dos veces) | `lm:<id>` | su oferta | cliente |
| **Funnel** (nuevo: todos, no sólo el default) | `funnels` | `funnel:<id>` | sus ofertas; el default además tiene sus etapas | cliente |
| Etapa del funnel | el funnel default | `etapa:<clave>` | la cadena de etapas; **los leads de hoy van como DATO** (cuántos hay en cada una), nunca un nodo por lead | cliente |
| **Leads** (nuevo, agregado) | `leads`, contados con la regla del CRM (`conteoPorEtapa`) | `leads` | UN nodo: cuántos, cuántos nuevos en 7 días, de dónde vienen, cuántos sin closer ni setter; colgado del funnel principal | cliente |
| Avatar, razón, formato | `mako.avatares`, `mako.razones`, `mako.formatos_recom` | `av:`, `raz:`, `fmt:` | como hoy | cliente |
| Nutrición, landing, audio, vocabulario | como hoy | `sec:`, `land:`, `audio:`, `glosario` | como hoy | cliente |
| **Objetivo y KPI** (nuevo: «los gráficos y los datos del negocio») | `objectives`, `kpis` (los números de /general) | `okr:<id>`, `kpi:<id>` | el KPI mide su objetivo; los dos, sus funnels | cliente |
| **Chat con MaKo** (nuevo) | `chart_sessions` de quien mira | `chat:<id>` | el área de lo que habló (por las palabras de su título) | sólo quien mira: es SU chat |
| **Chat de Offer** (nuevo) | `offer_sesiones` (las 6 más recientes) | `offerchat:<id>` | la oferta principal | cliente |
| Área MaKo (con su bitácora), chat jefe, hito | `app/admin/dev/areas.ts` + `registros.ts` (todo en el build) | `dev:<slug>`, `jefe:<título>`, `hito:<slug>:<n>` | hito → su área y su chat; jefe → cada área donde anotó; área ↔ área si comparten código; las áreas → su familia | **sólo el super admin**, capa «Construcción» |

**Las hojas del Dashboard no entran** (se pensó al revés al empezar): viven en `graficos.tablero.<persona>`, son la
vista de CADA persona sobre los datos, no un dato del negocio. Los números que el negocio se propuso medir son los
objetivos y los KPI, y ésos sí entran.

Quedan afuera, como hoy y por lo mismo: un nodo por lead o por mensaje (volumen), la semilla de catálogo de MaKo
disfrazada de dato del cliente, y la actividad del Plan (son tareas, no conocimiento). Los topes de forma del grafo
(hojas ≤ 30 %, hub ≤ 4,5×) se miden con `scripts/medir-grafo.mjs` antes y después de cada tipo nuevo.

## Cuándo nace un nodo, y la animación

- Nace cuando nace su fila. No hay sincronización: al abrir el Second Brain se arma el grafo de lo que hay.
- **El nodo que viaja.** El navegador guarda los ids que vio la última vez (por workspace; es una comodidad de quien
  mira, va en `localStorage` y sin él no pasa nada). Los ids nuevos entran viajando desde el borde de la tab hasta su
  lugar, de a uno, con un rastro tenue (900 ms, hasta 6; con movimiento reducido, sin viaje). Con la tab abierta, el
  grafo se vuelve a pedir cada 2 minutos si la pestaña está a la vista, y sólo se redibuja si cambió su huella.

## Qué ve cada quien

- **Cliente** (el admin con la tab en su capa, `esAdminDeTab('second-brain')`): su negocio.
- **Closer y setter:** no ven el grafo (como hoy).
- **Super admin** (`puedeOperar`): su negocio y, con el selector «Negocio · Construcción», la construcción de MaKo.
  Son dos grafos, no uno mezclado: la construcción es de la plataforma y el negocio es del workspace que se mira.
  El corte va en el servidor: a quien no opera no se le arma ni se le manda.

## Cómo lo consume un chat (para ahorrar tokens)

**Hoy:** el turno de MaKo manda en cada mensaje el prompt de sistema entero (8-11 kB, `buildSystemPrompt` en modo
completo), y las dos herramientas que leen el negocio rearman el cerebro entero en cada llamada (27-40 kB de JSON, o el
vault con tope de 60.000 caracteres).

**Nuevo: la recuperación por vista local** (`lib/cerebro-recuperar.ts`, puro y probado):

1. **Semillas:** los nodos que la pregunta nombra (la misma búsqueda por palabras del grafo, `matchNodo`; sin IA) más
   los ids que el chat pida.
2. **Vecinos:** un salto por las aristas, del más conectado al menos (la vista local de Obsidian).
3. **Sin semillas, el índice:** las carpetas y las áreas con su conteo y una línea cada una (la búsqueda global de
   GraphRAG). Es lo que un chat pide primero para saber qué hay.
4. **Paquete con presupuesto:** una línea por nodo (`[tipo] nombre: resumen · datos · ↔ vecinos`) hasta el
   presupuesto de tokens que pida el chat (1.500 por defecto).

**Por la API de MaKo** (`lib/api-mako`, área `negocio`, con el mismo corte que las otras lecturas del cerebro):
`cerebro_indice` (el índice) y `cerebro_recuperar` (pregunta o ids, profundidad, presupuesto). Un jefe la llama por
HTTP con el token del workspace; MaKo la usa como herramienta. Pasar el turno de MaKo a pedir nodos en vez de
mandar todo es un cambio de `lib/mako-context.ts` y va aparte, con la medición en la mano.

**La medición** se hace con un caso real (el workspace de prueba, el 3; nunca el 1): las mismas preguntas contra el
contexto entero y contra la recuperación, en caracteres y tokens. El número queda en los hallazgos.

## Lo que se depreca

- **`/admin/dev` (la vista de áreas, `MapaAreas.tsx`)**: es la otra «foto» de la construcción (la barra con las 122
  áreas y sus trampas). La capa «Construcción» del grafo la reemplaza; `/admin/dev` lleva al grafo. Las páginas de cada
  área (`/admin/dev/<área>`, con su bitácora) se quedan: son el detalle al que lleva cada nodo.
- **No se depreca** el grafo de graphify (`/api/admin/graph`): es el grafo del código, no de la construcción.
- «App viva» no es una pantalla: es una nota de memoria. No hay nada que borrar.

## Por partes

1. **11 y 12** (ya): la pantalla en oscuro, la cabecera, los controles en su lugar, la barra lateral nueva, nada abajo.
2. **13a:** los tipos nuevos del cliente con su `tipo` y su `nace`, «lo último», y la animación del nodo que viaja.
3. **13b:** la capa «Construcción» del super admin, y `/admin/dev` al grafo.
4. **13c:** la recuperación para los chats, sus dos operaciones en la API de MaKo, y la medición.

Cada parte va en computadora y teléfono, con su test probado rompiéndolo y su cosecha en
`docs/hallazgos-second-brain.md`.
