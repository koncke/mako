# Diseño: lo que hacen los chats alimenta el Second Brain del super admin (16/10/2026, SIN CONSTRUIR)

**Para:** el coordinador y Martín, antes de construir (así lo pidió el coordinador). Se lee en 5 minutos.

> Martín: «Y también con el Second Brain... Porque justamente de aquí sale el trabajo que un second brain se puede
> alimentar». El coordinador: «lo que los chats deciden y aprenden (las decisiones de la Ticketera, los hallazgos y los
> entregables) alimenta el Second Brain de MaKo (ws9). Proponé el diseño mínimo: qué entra, cuándo y dónde, sin
> duplicar lo que ya vive en docs/».

## En un minuto

- **Nada se copia.** El grafo del Second Brain ya es una PROYECCIÓN que se arma al leer (`construirCerebro()`,
  `lib/cerebro-grafo.ts`, 21 lecturas, sin tabla de nodos). Lo de los chats entra igual: **tres lectores nuevos**, no
  filas nuevas ni markdown copiado.
- **Qué entra:** las decisiones contestadas de la Ticketera, los hallazgos por área (un nodo por documento, con sus
  temas como datos y el link al documento) y lo entregado por cada jefe.
- **Dónde:** una carpeta madre nueva, **«Construcción»**, que existe SÓLO en el workspace de la plataforma (el corte va
  en el servidor: un cliente no la ve ni la recibe).
- **Cuándo:** al abrir el Second Brain, como todo lo demás. No hay cron ni sincronización.
- **Lo que decide Martín:** sólo si quiere esto como carpeta del mismo mapa (la recomendación) o como un mapa aparte.

## Qué entra, y de dónde se lee

| Nodo | Se lee de | Un nodo por | Datos (el hover) | Arista |
|---|---|---|---|---|
| **Decisión** | `admin_decisiones` (mig 0277), sólo las contestadas y no archivadas | tarjeta | la pregunta, la respuesta de Martín (`respuesta` + `respuesta_texto`), cuándo, qué destraba | → el jefe del chat que preguntó (`chat`), con motivo «lo preguntó» |
| **Hallazgos de un área** | `docs/hallazgos-<área>.md`, leído en el servidor | documento (no por entrada: serían 1.390 nodos, medido el 16/10) | los títulos `##` como lista, la fecha de la última entrada, y el link a `/admin/docs/<archivo>` | → el jefe de su tab (el índice `docs/hallazgos.md` ya dice qué área es cada uno) |
| **Lo entregado** | `operaciones_pedidos` con cierre `hecho`/`comprobado` + los hitos con commits de las bitácoras (ya viajan en el build) | jefe (agregado: «CRM · 61 cosas entregadas») | las últimas 5 con su fecha y su commit | → el jefe |
| **Jefe** | la lista de tabs (`app/admin/operaciones/tabs.ts`) cruzada con lo de arriba | jefe con algo | sus sub-chats, su proyecto del Plan | → el área del producto |

Las tres primeras son de **autoría distinta** y el mapa ya sabe pintarlo con el borde (`Autoria`): una decisión es
«lo escribiste tú»; un hallazgo y lo entregado, «lo dedujo MaKo».

## Lo que NO entra, y por qué

- **El texto de los hallazgos.** Vive en `docs/` y se lee en `/admin/docs`: el nodo es un índice con link. Copiarlo a
  `mako_knowledge` para buscarlo por significado sería la segunda copia, la que se queda vieja (la regla de la casa).
  Si la búsqueda por significado hace falta, se indexa con una huella del archivo (se recalcula cuando el archivo
  cambia) y el resultado devuelve el link, nunca el texto guardado.
- **Las conversaciones de los chats.** Son de Claude Code, viven en la PC y no son del negocio.
- **Cada mensaje o cada commit como nodo.** Es la lección pagada del grafo: un nodo es «una cosa que alguien puede
  señalar y decir eso es mío»; un commit suelto no lo es, y 300 hojas vuelven el mapa un diente de león (el tope de
  hojas es 30%).

## Dónde y para quién

- **La carpeta «Construcción»** va al Nivel 1 (`NIVEL1`, `lib/cerebro-modelo.ts`) con tres áreas: Decisiones,
  Aprendido, Entregado. Colores: tokens `--grafo-*` nuevos, medidos contra el fondo oscuro como los demás.
- **Sólo la plataforma.** El corte va donde se arma el grafo, por `capa` del workspace (`wsSuperAdmin()`), nunca
  escondiendo el botón. Un cliente no recibe estos nodos ni en el JSON.
- **Leer `docs/` en producción** pide sumar la ruta del Second Brain a `outputFileTracingIncludes` (`next.config.ts`),
  como ya está `/admin/docs`: sin eso, anda en local y sale vacío en producción.

## Lo que falta medir antes de construir

- Cuántos nodos agrega al mapa de la plataforma (medir con `scripts/medir-grafo.mjs` antes y después): 31 documentos
  de hallazgos + ~25 jefes + las decisiones contestadas.
- Si `construirCerebro()` en el workspace de la plataforma da algo hoy (el diseño AI-native lo marca como no medido).

## Relación con el diseño grande

Es la parte (c) de `docs/diseno-mako-ai-native.md` («el Centro del super admin pasa a ser su Second Brain») bajada a lo
mínimo: no necesita la pieza de chat única ni mover `/mako`. Puede ir antes o después de la etapa 1 de ese diseño.
