# Sprint de Servicio · Mauricio Bustos (Customer Success)

**Qué es este documento.** El mapa de lo que Mauricio compró de verdad, contra lo que MaKo
tiene hoy, y el plan de las semanas que quedan. No es un changelog: es lo que hay que saber
**antes** de escribir una línea para este encargo, porque la mitad de las trampas son de
encuadre, no de código.

Se lee antes que `hallazgos-*.md` cuando el trabajo es del Sprint. Contexto de arranque,
como [embudo-y-high-ticket.md](embudo-y-high-ticket.md).

Escrito el **2026-08-11**, en la corrida `wf_bf78bf97-f34` (6 agentes de mapeo + síntesis).

---

## Lo que más muerde acá

- **El Sprint dice explícitamente que NO es MaKo Customer Success.** Cualquier cosa que se
  construya adentro de la app va contra el alcance escrito → [El encuadre](#el-encuadre-lo-que-compró-no-es-lo-que-le-presenté).
- **Mauricio ya es ws1, y `OWNER_WS = 1`.** Cada `?? OWNER_WS` de la app cae en su
  workspace. Lo favorece hoy y esconde bugs que sufren los otros cinco →
  [Lo que ya existe](#lo-que-ya-existe-y-casi-nadie-sabe).
- **Sus 15 clientes ya viven adentro de MaKo**, como proyectos `Cliente: X` de su tablero,
  alimentados por sus propias reuniones. El Frente 03 no arranca de cero: arranca de una
  vista → [Frente 03](#frente-03--seguimiento-de-15-clientes).
- **Su cuello de botella NO es codear el tablero.** Sus propios documentos dicen que el
  bloqueo #1 del programa entero es *definir la evidencia*, y el #2 *poner el umbral* →
  [El reencuadre del Frente 01](#el-reencuadre-el-generador-no-es-un-generador-de-código).
- **MaKo no emite código en runtime, en ningún lado.** El generador de tableros no puede
  vivir adentro de la app: va como skill de Claude Code → [Frente 01](#frente-01--el-prompt-maestro-de-tableros).

---

## El encuadre: lo que compró no es lo que le presenté

Dos documentos, dos alcances, y la diferencia es el 90% del dinero.

| | Propuesta original | Lo que compró |
|---|---|---|
| Dónde vive | `/vsl/mako-cs` (`public/vsl-assets/mako-cs.html`, rewrite en `next.config.ts:47`) | Google Doc «Sprint de Servicio - Mauricio Bustos», 2026-07-10 |
| Qué es | 12 módulos, 52 features, módulo dentro de MaKo | 4 frentes acotados, **fuera** de MaKo |
| Plata | US$9.000 (6 × US$1.500), pago único | **US$500/mes × 2 meses** |
| Fechas | — | **10 jul → 10 sep 2026**. Pagos 10/jul y 10/ago |

Su frase, textual, en el documento del Sprint:

> «lo que vos pediste nunca fue contratar un Customer Success. Lo que pediste fue dejar de
> perder madrugadas codificando tableros, y una plataforma donde tus clientes vean los
> videos sin que vivan en tu WhatsApp.»

Y el alcance negativo, escrito para que no hubiera ambigüedad:

> «**No es MaKo Customer Success.** No se construye el módulo dentro de la app: ni el
> generador de tableros integrado, ni la gestión de curso y comunidad desde MaKo, ni el
> growth loop, ni el onboarding automatizado, ni NPS y churn.»

**La regla que queda:** en este encargo, todo lo que se construya *adentro* de MaKo tiene
que justificarse por sí solo como feature del producto para **todos** los workspaces —que
es la regla que el repo ya tiene ([AGENTS.md](../AGENTS.md), «ningún cambio es solo para el
dueño»)— y **no se factura como Sprint**. Si no pasa ese filtro, va afuera o no va.

### La razón de calendario (es lo que fija la prioridad)

En **octubre y noviembre vencen los contratos de sus clientes**. El Sprint existe para
producir las tres cosas con las que les vende lo que sigue: *su tiempo liberado*, *cinco
casos de éxito documentados*, y *un servicio ordenado que se pueda repetir*. Cualquier
tarea que no aporte a una de esas tres, sobra.

---

## Los tres documentos que mandó (2026-08-11)

Mauricio entregó su metodología escrita. No son material de lectura: son **la especificación
del Frente 01**.

| Documento | Qué es | Para qué sirve acá |
|---|---|---|
| `Cuestionario_Maestro_Norte_Estrategico_MB.md` | Bloques A–J. Produce el rumbo: 2 MCIs + objetivos LAG por área | El formulario de entrada de la fase 1 |
| `Cuestionario_Maestro_Objetivos_Palancas_Umbrales_MB.md` | Bloques 0–8. Produce **la matriz vinculada** y la carta de expectativas | **El esquema de datos del tablero** |
| `Análisis de fases…` | Las 5 fases del encargo (0 Venta → 4 Build), con sesiones meta y **el atoro de cada una** | Dice dónde se pierde el tiempo de verdad |

### La matriz vinculada es el contrato

El segundo cuestionario termina en una tabla de **14 columnas** que es, literalmente, el
formato de salida del tablero:

```
MCI · Objetivo LAG · Área · Responsable · Base · Meta · Frecuencia · Palanca ·
Cómo se mide · Verde · Amarillo · Rojo · Evidencia · Corte
```

Y trae **su propia capa de validación determinista**, que es exactamente lo que
[AGENTS.md](../AGENTS.md) exige («una regla en un prompt no es una regla»):

- **Auditoría de vinculación**, 6 verificaciones sobre la matriz completa: área sin
  objetivo vinculado a una MCI · MCI sin área que la sirva · objetivo con más de tres
  palancas · palanca repetida en dos áreas con distinto nombre · responsable sin autoridad
  · área habilitadora crítica sin objetivo propio.
- Sobre la ficha individual: traslapes de rango entre verde/amarillo/rojo, umbrales sin
  sujeto, contradicciones de frecuencia, campos pendientes, metas por unidad mal divididas.
- La prueba de lectura al revés: **tomá cualquier palanca y remontala hasta una MCI. Si no
  llega, sobra.**

Las 5 primeras son escribibles en código sin ambigüedad. Ese es el saneo.

### El reencuadre: el generador no es un generador de código

Esto es lo que cambia el plan, y sale de sus propios documentos, no de una opinión.

El `Análisis de fases` dice dónde se atora el programa:

| Fase | Atoro escrito por él |
|---|---|
| 1 · Norte Estratégico | **El dato base no existe.** TEXX: 19 días con la MCI 1 abierta esperando la cifra de margen. Baja Teriyaki sin baseline. Esquer con un ERP cuyo inventario no es confiable |
| 3 · Palancas y umbrales | **Definir la evidencia — «es el bloqueo número uno de todo el programa».** Con Patricia el proyecto estuvo **tres semanas parado** en una sola pregunta: cómo se prueba que se hizo. Segundo atoro: poner el umbral |
| 4 · Build y arranque | **Los catálogos faltantes.** En TEXX se detectaron **trece**, cada uno bloqueando una palanca |

Y la línea que lo resume:

> «Lo que destraba la fase: **el contexto, no el formulario**. […] Cuando el área sabe qué
> sostiene, la ficha se llena sola.»

**Conclusión:** un prompt maestro que toma un cuestionario ya lleno y escupe el código del
tablero resuelve el último tramo de su problema. Las tres semanas se pierden **antes**, en
llenar la ficha. El generador tiene que hacer las dos cosas:

1. **Llenar** — proponer evidencia y umbrales a partir de lo que ya funcionó en los otros
   clientes, correr las 6 auditorías, y devolver la **tabla de huecos con responsable y
   fecha** (que es un entregable que él ya usa).
2. **Emitir** — recién ahí, el tablero.

Él ya tiene el corpus para la parte 1: **seis clientes con tableros hechos**. Es exactamente
lo que el Sprint llama «estudiamos juntos los tableros que ya hiciste y extraemos los
patrones comunes».

---

## Lo que ya existe (y casi nadie sabe)

Verificado contra el código, no deducido.

- **Mauricio es `ws1`, y `OWNER_WS = 1`** (`lib/workspace.ts:264-267`). Consecuencia: cada
  `?? OWNER_WS` escrito a mano cae en su workspace. Hoy lo favorece —el feed de
  notificaciones le funciona solo a él— y esconde que a los otros cinco workspaces les
  devuelve vacío en silencio (`app/api/notificaciones/route.ts:18`).
- **Sus clientes ya son proyectos de su tablero.** Seis, con el prefijo canónico
  (`lib/todo-proyectos-catalogo.ts` → `PREFIJO_CLIENTE`), renombrados en
  `scripts/reordenar-boards-clientes.ts:52-59`:
  `Cliente: Grupo Esquer` · `Cliente: Baja Teriyaki` · `Cliente: Vértice Industrial` ·
  `Cliente: Aspro` · `Cliente: TEXX` · `Cliente: Macario Romero — HMO`.
  Son los mismos que aparecen en su `Análisis de fases`. **El mapa entre su consultoría y
  MaKo ya está tendido.**
- **Sus reuniones ya se convierten en tareas del cliente correcto.**
  `lib/reunion-cliente.ts:88-115` (`resolverClienteDeReunion`) resuelve por tres caminos con
  nivel de confianza y **devuelve `null` en vez de inventar**. El barrido de agosto movió 37
  tareas a su cliente real (commit `2742a8e`) respetando las 12 que él había reasignado a
  mano.
- **Los proyectos de sus clientes ya tienen «qué ya está / qué falta»** derivado de sus
  propias tareas (commit `974b4a4`). Ojo: sus proyectos viven en `tarea_categorias` con
  columna `nombre`, **no** en `plan_proyectos` con `name`.
- **El molde de la pantalla cross-workspace ya existe y ya fue auditado**:
  `app/admin/agente/page.tsx:49-66` (service-role sin scope a propósito, gateado con
  `getSesionAdmin()`, con mapa `id→nombre`).
- **El cron que recorre workspaces y avisa una ausencia** es
  `app/api/cron/tracking-vigilante/route.ts:82`, y el que ya emite un aviso agrupado por día
  es `app/api/cron/tareas-verificar/route.ts:48-73`.

### Lo que NO existe (grepeado, no supuesto)

`MCI` · objetivo LAG por área · métrica ↔ persona responsable · carta de expectativas ·
junta recurrente como entidad (acá `junta` es *reunión de venta con un lead*) · **alerta de
compromiso vencido** (`grep -rn "deadline" app/api/cron/` → cero) · NPS/CES/churn ·
testimonio como entidad · graduación/outboarding · etapa posterior a `ganado`
(`lib/pipeline.ts:46-59`).

**`/cs-analyst` no es esto.** Es un `ComingSoon` de 6 líneas y su alcance previsto
(`docs/dev-tabs-mapa.md:379-381`) es *retención de los leads del cliente*, no gestión de los
clientes de un consultor. Meter el Frente 03 ahí confunde dos productos y quema una `key` de
`nav.ts`, que es contrato.

---

## Los 4 frentes contra el código

### Frente 01 — El prompt maestro de tableros

**Estado:** lo más valioso y lo más definido, ahora que llegaron los cuestionarios.

MaKo **no emite código en runtime en ningún lado** (verificado por grep; lo único que genera
son specs JSON coercionados a un tipo, molde `parseLandingSpec` en `lib/landing-writer.ts:250`).
Así que se parte en dos, y la mitad de adentro es la que hace que la de afuera no sea genérica:

- **Adentro:** `lib/tablero-matriz.ts` — módulo **puro, sin `server-only`** (para que un test
  lo importe) con el tipo de la matriz vinculada y **el validador de las 6 auditorías + el
  traslape de umbrales**. Molde: `lib/landing-spec.ts`. Más el prompt maestro en
  `lib/prompt-registry.ts`, editable en `/contexto` sin push (cada push cuesta ~US$0,09).
- **Afuera:** una skill de Claude Code que consume ese spec y escribe el tablero.
  **Generada desde el código**, con `--check` en el pre-push — el riel ya existe
  (`lib/agente-skill.ts:56`, `scripts/generar-plugin.mjs`). Una skill `.md` no puede
  importar nada, y esa segunda copia es exactamente la cicatriz del contrato del `detalle`.

⚠️ **Si el tablero necesita ids, rutas o umbrales exactos, no los transporta el modelo**
([AGENTS.md](../AGENTS.md)).

**Validación barata:** probarlo contra un tablero **ya hecho** (Esquer o Baja Teriyaki)
antes que contra uno nuevo. Si no reproduce lo que él ya construyó a mano, no sirve.

### Frente 02 — Plataforma de contenido

**Estado: el 80% de este frente no es software, y hay que decirlo de entrada.**

La plomería existe y es buena: `lib/shares.ts` + `app/compartido/[token]/` (links públicos
con invitados, revocación y rotación de token, migs `0098`/`0099`/`0102`) y `mako_knowledge`
con `curso` y `area` (mig `0049`), que ya es tenant-scoped.

Lo que falta del lado del código es **un día**: sacar el `const WS = 1` de
`app/api/compartir/route.ts:25` y que `curso` sea un recurso por workspace. Lo que falta del
lado de él son **los otros 59 días: grabar y escribir el contenido**.

Si eso no se dice antes de empezar, el frente 02 se lee como «el software no anda» y
contamina la percepción de los otros tres.

### Frente 03 — Seguimiento de 15 clientes

**Estado: es el que más cerca está de estar hecho, y nadie lo sabe.**

Sus clientes ya son proyectos, sus reuniones ya caen en el proyecto correcto, y sus tareas ya
tienen deadline, progreso e historial. Lo que falta es **una vista y un cron**, no un modelo
de datos.

Alertas que se reusan tal cual:

| Necesidad | Pieza viva |
|---|---|
| «Hace N días que no da señales» | Regla **T6**, `lib/crm-auto-plan.ts:130-141` (umbral `diasReactivacion` por ws) |
| «Escribió y nadie contestó» | `wa-mensaje-entrante`, vivo (`lib/chat-agent-handoff.ts:127`) |
| «Hace >48 h que no llega nada» | `app/api/cron/tracking-vigilante/route.ts:82` — el molde exacto |
| «Evidencia que no llegó» | `lib/plan-senales.ts` (13 señales positivas), **invertido** |
| «Plata vencida» | `getCuotasPendientes`, `lib/pagos.ts:487-539` (patrón `vencidas`/`porVencer`) |
| «¿Cómo va el cliente X?» por WhatsApp | `lib/mako-tools.ts`, 9 tools tenant-scoped |

Lo único con **cero líneas escritas** es el barrido de compromisos vencidos, y es el más
barato: `tareas-verificar` ya recorre workspaces y ya emite un aviso agrupado por día. Es la
misma consulta al revés.

Lo que sí necesita almacenamiento nuevo es lo que no se deriva de nada: **fase de la
metodología (0-4), próximo hito y su fecha, y el estado que el consultor fija a mano.** Eso
es una tabla chica colgada del proyecto que ya existe, no una entidad nueva.

⚠️ **Decisión pendiente y no es técnica:** el Sprint dice *«un tablero simple —no MaKo—»*.
Pero el tablero más simple posible es el que se para sobre los datos que él ya tiene adentro
de MaKo. Hay que resolverlo con él antes de escribir.

### Frente 04 — Graduación y casos de éxito

**Estado: cero código, y está bien que así sea por ahora.**

El pipeline muere en `ganado`; no hay entidad testimonio; «graduación» aparece una sola vez
en todo el repo y es adentro del texto de una clase del curso
(`app/conocimientos/curso.ts:6590`).

Los 5 casos de éxito son 5 entrevistas grabadas y editadas. Lo único que el software puede
aportar es **detectar quién está listo** (promesa cumplida) — y eso depende de que la matriz
del Frente 01 exista, así que va después. **Empezar por el protocolo escrito, no por el
pipeline.**

Cimientos si algún día se construye: `lib/capas.ts` (única fuente de qué compró cada
cliente; un estado de ciclo de vida se agrega ahí, no con un `if`) y
`lib/onboarding-state.ts` (el molde de «estado por pasos», invertido = outboarding).

---

## Las dos cosas que él pidió y no son de ningún frente

Cuestan poco y son las que le demuestran que se lo escuchó.

1. **«MaKo tiene que ser más *doer* y menos *thinker*.»** El semáforo de `/general` está
   construido con reglas hardcodeadas inline (`app/general/page.tsx:107-195`) y cada alerta
   termina en un `<Link href>`. Analiza y linkea; no ejecuta. El puente ya existe:
   `lib/mako-capacidades.ts` (17 capacidades con `ruta` + `como[]` imperativo). Convertir
   cada link en una capacidad con acción sirve a **todos** los workspaces.
   Ironía útil para la conversación: la propuesta `/vsl/mako-cs` marca «Semáforo del
   negocio» como **`listo`** y su copy dice *«no te muestra el problema, te dice cuál atacar
   primero»*. **El documento vendió como hecho el comportamiento que él después reclamó.**

2. **El mapa marca cero en Ciudad de México.** Localizado y verificado. El detalle está en
   [hallazgos-ads.md](hallazgos-ads.md) → «El mapa de México no pinta cero: pinta el estado
   equivocado».

---

## Decisiones abiertas

1. **¿El Frente 03 vive adentro de MaKo o afuera?** El Sprint dice «no MaKo»; la realidad es
   que sus datos ya están adentro. Si va adentro, se construye como feature del producto
   para todos los workspaces y **no se cobra como Sprint**.
2. **¿Los clientes de sus clientes son workspaces?** **No.** No existe un tier «consultor»
   (`lib/auth-session.ts:16-22`) y `listarWorkspaces()` no filtra por dueño, así que darle un
   workspace por cliente le daría visibilidad de los clientes de Martín. Son filas adentro de
   ws1. **Esta regla va a `AGENTS.md` cuando se escriba la primera línea.**
3. **¿Dos MCIs o uno?** El sistema impone uno: *«Solo puede haber UN norte»*
   (`lib/mako-guardian.ts:786`) y la vista Prioridades es Objetivo Principal + 3 tareas.
   Recomendado: **modelar dos, mostrarle uno al Perro.** Cambiar la regla del Perro por un
   caso es tocar el corazón de la priorización.
4. **¿Los umbrales los fija un humano o los infiere el LLM?** **Humano, con default sugerido
   por MaKo.** Su propio cuestionario dice que los pone el líder del área, no el dueño. Un
   umbral inferido por un modelo no es auditable.
5. **¿Tablas o `app_settings`?** **Tablas.** `app_settings` es last-write-wins sin CAS y un
   formulario largo con guardado parcial se pisa solo. La fase ya pagó ese costo: al vivir
   como JSON, «cumplí el hito» **no tiene dónde guardarse**.
6. **El nombre.** La metodología trae **fases 0-4 del encargo**, y en el repo ya hay **tres**
   `FASES` distintos que compilan sin conflicto (`lib/fase-diagnostico.ts:80`,
   `lib/mako-fases.ts:12`, `app/admin/dev/pricing/modelo.ts`). No puede llamarse `FASES`.
   Sugerido: `ETAPAS_ENCARGO`.

---

## Lo que quedó sin verificar

- **Las reuniones con Mauricio posteriores al 4 de julio de 2026.** Las graba **él**, no
  Martín: no están en el Fathom de `tejadomartin@gmail.com` (188 reuniones, 2021-09 →
  2026-08, ninguna es una «Weekly: Mauricio <> Martín») y no llegan por mail. El único
  acceso es por link de compartir, y hay **uno solo**: el del 4 de julio. **La metodología de
  5 pasos para reducir su carga con los clientes sigue sin leerse** — no está en el repo, ni
  en Drive, ni en el Fathom accesible.
- Los 9 campos de la ficha de palanca están en el cuestionario, pero **la tabla del Bloque 4
  lista 10 filas** (la 10 es «Catálogo o formato que hace falta»). Antes de modelar, aclarar
  con él si son 9 o 10.
- Si la tabla `notificaciones` está aplicada en producción. La migración `0048` existe en el
  repo; lo que sí está verificado es que **no tiene `workspace_id`** y **no está en
  `TENANT_TABLES`**.
- Los nombres exactos de región que devuelve Meta con `breakdowns:'region'` para México.

---

*Corrida `wf_bf78bf97-f34` · 2026-08-11 · 6 agentes de mapeo + síntesis, reverificado a mano
en los puntos que sostienen una decisión.*
