# Hallazgos del CRM

Lo que hay que saber antes de tocar el wizard "¿Qué hacer ahora?", el selector de
horarios, el worklist de pendientes y los requisitos de etapa. **No es un changelog**:
es lo que no se deduce leyendo el código.

Origen: corrida multi-agente de 08/2026 (selector de horas + 5 bugs del CRM). Regla de
la cosecha en `AGENTS.md`.

---

## 1. Agenda y horarios

### El eco decía una hora y Enter guardaba otra

**Síntoma:** tipeás `6:15`, abajo lee "Se entendió: 6:15 PM", Enter guarda **16:15**.
Peor: para el mismo texto, Enter daba `16:15`, Tab daba `18:15` y click afuera `18:15`.

**El diagnóstico obvio era el equivocado.** Parecía un bug de parseo 12h/24h. `parsearHora`
estaba bien: el filtro de la lista es por **substring** y no sabe nada del parseo
(`"16:15".includes("6:15")` es `true`, `"0730".includes("3")` también), y `setActivo(0)`
en cada tecla dejaba el puntero en el primer match alfabético. Enter commiteaba la fila
resaltada; Tab y blur pasaban por `parsearHora`. Tres caminos de commit, tres resultados.

**Dónde:** `app/crm/SelectorHora.tsx` — hoy la decisión vive en dos funciones puras
exportadas, `indiceActivo()` e `indiceDeAncla()` (`:249`, `:276`), y `activo` es un
puntero explícito (`-1` = ninguno).

**Regla:** en un combobox con escritura libre, **todos los caminos de commit leen la misma
función**. Si el usuario no movió el puntero a mano, manda la hora *entendida*, no la
coincidencia de texto. Y si mostrás un eco, el eco es el contrato: lo que se guarda es eso.

### La hora se guardaba en la zona del navegador

**Síntoma:** workspace en Montevideo, closer con la laptop en Ciudad de México. Elige
18:00, el resumen dice "6:00 PM", se guarda `00:00Z` — 3 h corrido. `fecha_junta_1` y
`junta_1_at` podían caer en **días distintos**, y `moverEventoDeReunion` manda
`sendUpdates=all`: **al invitado le llegaba el mail con la hora equivocada**.

**El diagnóstico obvio era el equivocado.** El comentario del código decía que la excepción
era "«Otro horario» (tipeado a mano)". No era la excepción: era **todo el camino sin agenda
verificada**. `slot.inicioIso` solo existe cuando Google responde; con `slots: null`
(sin conexión, token vencido, 403/429/5xx, timeout, `.catch` del fetch) caían ahí también
las horas elegidas del desplegable. En cualquier workspace sin Google Calendar enchufado,
el 100% de los reagendados pasaba por `new Date('YYYY-MM-DDTHH:mm')`, que por spec es hora
local del navegador.

**Dónde:** `reagendarReunionAction` (`app/crm/actions.ts:1267`) hoy recibe
`hora: string | null` en `'HH:MM'`, **nunca un instante**, y resuelve
`tzDeWorkspace()` + `instanteDeLocal()` — la misma función que arma la grilla.

**Regla:** el cliente manda `'HH:MM'` + fecha; **el instante lo calcula el server** con la
zona del workspace. Un `new Date('...T...')` sin offset en código de UI es un bug de zona
esperando el primer usuario en otro huso.

### La grilla calculaba con 45' aunque la reunión durara 60

**Síntoma:** un slot marcado libre que al mover pisa la reunión siguiente. R1 de 60' con
algo a las 19:15: el server marca 18:30 libre (18:30 + **45'** = 19:15, no se pisa), y el
PATCH lo deja 18:30–19:30 encima.

**Causa:** `CrmMarcar.duracionMin` estaba **declarado y leído pero nunca escrito** —
`PendienteItem` no traía el campo, así que siempre caía a `DURACION_DEFECTO_MIN`. Del otro
lado, `lib/google-calendar.ts` conserva la duración **real** del evento (`duracionMs`).

**Dónde:** `duracionDeReunionEnAgendaMin()` en `lib/google-calendar.ts`, expuesta por
`duracionReunionAction`; `CrmBoard` la pide al **abrir** el wizard, no en el paso de la
hora, para que el viaje a Google ocurra mientras el usuario elige la fecha.

**Regla:** la duración con la que se calculan los huecos y la que se escribe en el
calendario tienen que ser **el mismo número**. Un campo opcional que nadie llena es un
default silencioso: si lo agregás, buscá el productor, no solo el consumidor.

### La grilla tiene una sola fuente de verdad

`app/crm/horarios-respuesta.ts` es el módulo puro (sin `server-only`) que define
`HORA_DESDE_DEFECTO=7`, `HORA_HASTA_DEFECTO=22`, `PASO_MIN_DEFECTO=15`,
`DURACION_DEFECTO_MIN=45`, `MARGEN_MIN_DEFECTO=30` y las funciones de grilla. `rango` viaja
en **todas** las respuestas 200 de `GET /api/crm/horarios`, incluidos los caminos de error
— que es justo cuando la UI dibuja la grilla sola.

**Por qué 07–22:** el tope de 19 lo rechazó el dueño; 00:00–23:45 son 96 opciones y las
3 AM son ruido. Lo que recorta la lista de verdad es la agenda, no el rango.

**Regla:** si el selector define sus propias constantes, con Google caído pinta una grilla
y con Google vivo otra. Importá de ahí. **`slots: null` ≠ `[]`**: `null` es "no verificada"
(no se oculta nada), `[]` es "verificada y sin horarios".

### Otras dos del mismo flujo

- **`reagTz` pegado:** se guardaba solo `if (r.slots)`, así que un día que fallaba después
  de uno que funcionó pintaba "Horarios en America/Montevideo" debajo de "Agenda sin
  verificar" — afirmando una zona justo cuando no se leyó ninguna. Hoy se guarda siempre y
  se limpia en el `.catch`.
- **122 `Intl.DateTimeFormat` por request:** `instanteDeLocal` construía un formateador
  nuevo, dos veces por slot; con 61 slots eran ~15-25 ms. `FMT_TZ` memoizado por zona
  (`horarios-respuesta.ts:232`) lo baja a ~3 ms. El costo de red no se movió: sigue siendo
  **un** `POST /freeBusy`, con el cruce en memoria.

---

## 2. Trampas del entorno (las que no avisan)

| Trampa | Dónde | Qué hacer |
|---|---|---|
| **`freeBusy` devuelve `busy: []` cuando el calendario trae `errors`** — se lee como "día entero libre" | `lib/google-calendar.ts:848` | Chequear `cal.errors?.length` **antes** que `busy`. Ya está, no lo saques. |
| **Transparentes y rechazados no llegan en `busy`** (correcto), pero un **all-day marcado Ocupado sí llega como intervalo de 24 h** y pisa la grilla entera | mismo | Hay test. Es comportamiento de Google, no bug. |
| **Solo se consulta `primary`** | mismo | Un ocupado en otro calendario del dueño **no** bloquea. Limitación conocida y escrita. |
| **PostgREST corta en 1000 filas** — `.limit()` no sube el techo del servidor | `lib/supabase-paginado.ts` | Usar `leerTodo()`. Ordena por `id` siempre: sin `ORDER BY`, el offset de la página 2 lee otro orden. |
| **`stageMeta` cae a `stages[0]`** y pinta un dato falso | `lib/pipeline.ts:533` | Usar **`stageMetaOpt`** y guardar la KEY, no el label. |
| **`server-only` tira al importarse desde el runner de tests** | `lib/etapa-historial.ts` y cía. | Parchear `Module._load` antes del `import()` dinámico (funciona porque tsx compila los tests a CJS). |
| **Los guards de texto leen de más en Windows** | `tests/*.test.ts` | Normalizar CRLF: sin eso el corte por `'\n}\n'` no encuentra el fin de la función. Costó un falso positivo. |
| **Un componente declarado dentro del render remonta todo** | `SelectorHora.tsx` | Las opciones se generan con una **función que devuelve el elemento**. Como componente anidado, React remontaba las 61 filas con cada tecla y tiraba el scroll al principio. |
| **`getComputedStyle` con la pane oculta devuelve valores viejos** | UI general | Verificar por el style inline o un `data-*`. |

---

## 3. Etapas, requisitos y worklist

### El motivo de pérdida se heredaba

**Síntoma:** un lead que ya estuvo en `perdido` se movía a `descal` sin que nadie pidiera
el motivo — quedaba el viejo.

**Causa:** el validador miraba si **había** un motivo, no si era **de este movimiento**.

**Dónde:** `lib/stage-requirements.ts` — `StageReqValues` ahora parte en tres: `motivo` (el
persistido), `motivoNuevo` (el de ESTE movimiento) y `etapaActual` (origen; `undefined` =
"el caller no está moviendo"). El corte:

```ts
const entrando = !!v.etapaActual && v.etapaActual !== stageKey;
const motivoValido = entrando ? v.motivoNuevo : (v.motivoNuevo ?? v.motivo);
```

**Regla:** la distinción vive en el **movimiento**, no en el valor. Un caller que no sabe
de dónde viene el lead manda `etapaActual: undefined` y no repregunta — por eso
`faltantesDeLead` (`lib/leads.ts`) no lo manda y "Completar datos" nunca le reclama el
motivo a un lead ya perdido.

**Alcance real, para calibrar:** `lib/leads.ts:371` limpia `motivo_perdida` cuando el lead
sale de perdido/descal. La herencia solo ocurre **perdido↔descal**; el escenario "se
pierde, se recupera, se vuelve a perder" no la produce.

### `pipelineStageOf` vs `etapaVigenteDe`: usar el mismo criterio que la UI

**Síntoma:** la ficha abría "Completar datos" y el guardado se bloqueaba pidiendo un motivo
que la pantalla no mostraba.

**Causa:** el server calculaba la etapa de origen con `pipelineStageOf` (override **crudo**)
y la ficha con override **chequeado contra el funnel vigente**. Divergen exactamente en el
caso masivo que este repo documenta (`lib/leads.ts:1627`: 686 leads en ws1 con override a
etapas que su funnel ya no tiene). Con `pipeline_stage='reactivacion'` huérfano y
`estado_lead='perdido'`, el server veía `entrando = true` y exigía motivo nuevo.

**Dónde:** `valoresDeRequisitos` (`app/crm/actions.ts:276`) usa `etapaVigenteDe(before,
stagesMove)` de `lib/funnel-etapas.ts`.

**Regla:** **quien valida y quien pinta tienen que derivar la etapa con la misma función.**
Un override puede apuntar a una etapa que el funnel ya no lista; `etapaVigenteDe` es el
único lugar donde eso se resuelve.

### Las etapas de reunión salen del funnel, no de un ternario

`lib/funnel-etapas.ts` (nuevo): `etapasDeReunion` filtra `kind === 'reunion'`,
`slotDeReunion` mapea índice → `{numero, cual, colFecha, colAt}` y devuelve **`null` desde
el índice 2** porque `leads` solo tiene dos slots. Sin funnel cae a `DEFAULT_PIPELINE`.

**El fix trajo dos colaterales, y ese es el punto de la entrada:**

1. **Población nueva de items 'R'.** Pasar del override crudo a la etapa efectiva hace
   aparecer todos los leads derivados parados en una reunión pasada (Calendly nunca escribe
   `pipeline_stage`). El `push` del item 'R' ocurre **antes** del filtro de
   `pendientes_ignorados` y del `if (faltan.length === 0) continue`, así que son
   permanentes y no ignorables (`CrmBoard.tsx` excluye `tipo==='R'` de "Ignorar todos").
   **Se dejó así a propósito**: es la decisión de producto explícita — el lead está
   *trabado* y silenciarlo lo deja colgado para siempre. Si el dueño quiere una válvula de
   escape, es decisión suya, no una corrección.
2. **Se caían de BulkHigiene.** El item 'R' viajaba con `faltantes: []`, así que todo lead
   que pasaba de 'A' a 'R' desaparecía del "asignar Setter en lote" — justo los que más lo
   necesitan — y su fila perdía el detalle. **Arreglado**: los faltantes se calculan
   **antes** de decidir el tipo de item y viajan en el 'R', con el detalle en el mensaje
   (`lib/queries.ts:2224`).

**Regla:** cambiar cómo se **deriva** una etapa cambia **quién entra** a las listas que
filtran por etapa. Antes de mergear, preguntá a qué población se le acaba de aplicar una
regla que nadie eligió para ella.

### Un error de lectura terminaba en "✓ Todo marcado — datos al día"

**Síntoma:** el peor de todos, porque no parece un error.

**Causa:** el paginado nuevo hizo que `pagos` y `lead_respuestas` **tiraran** donde antes
degradaban en silencio (`const { data } = await ...` sin chequeo). Pero
`_getPendientesDeMarcar` no atrapa y los dos consumidores sí: `app/crm/page.tsx` con
`.catch(() => [])` y `app/general/page.tsx` con `allSettled`. Romper fuerte río arriba y
tragarse la excepción río abajo produce **un falso all-clear en el lugar que el producto
trata como autoridad**.

**Dónde:** `lib/queries.ts` — `pagos` y `lead_respuestas` son lecturas **accesorias**:
degradan con `avisos.push()`. `Pendientes` suma `aviso?: string`, `page.tsx` lo propaga y
`CrmBoard` pinta banner si la lista es parcial y reemplaza el ✓ verde si está vacía. La
lectura de `leads` sigue rompiendo fuerte, a propósito.

**Regla:** si una lectura pasa a lanzar, seguí la excepción hasta la pantalla. Un `.catch`
que devuelve `[]` convierte "se rompió" en "no hay nada", y son cosas opuestas.

### Deshacer y `etapa_vista`

`revertMoveAction` alinea `etapa_vista` **después** de aplicar y **antes** de borrar
`lead_audit`. `alinearEtapaVista` (`lib/etapa-historial.ts`) **no escribe historial**: ese
es el punto, "un cambio deshecho no es historia". La decisión (`etapaVistaPendiente`, pura)
está separada de la escritura para poder testearla. Cubre también el grupo sin fila
`'Etapa'`: revertir `'Asistió R1'` mueve la etapa **derivada**.

### Los dots del WizardShell mienten si `total` no es confiable

`app/_components/WizardShell.tsx` ya no deriva la fila de `total` a secas: la posición
actual siempre es verdad, y la cola **solo existe si se puede contar**. `futuros = -1`
(faltan, cantidad desconocida) pinta tres puntitos de 4px, no puntos-paso. Colapsa cuatro
casos: `total` desconocido, `idx >= total`, `enUltimo` con `total` mayor (la única señal
confiable de "no hay más" es `enUltimo`), y **salto hacia adelante** — si el wizard se
saltea pantallas, `total` deja de servir y el estado se marca **en render**, no con
`useEffect`: con efecto, el primer frame del salto sigue mostrando la fila vieja, que es
justo la mentira.

---

## 4. Lo que quedó sin hacer

| Qué | Dónde | Por qué |
|---|---|---|
| **El wizard con ramas de verdad no usa `WizardShell`** — forkeó el chrome entero (header + dots + cuerpo + footer) con su propia máquina de `visitados` | `app/crm/StageMoveDialog.tsx` (~1038-1080) | Migrarlo exige aceptar `pasos: readonly string[]` + `pasoActual` como modo alternativo. Sus puntitos siguen siendo los viejos. Revisar también el z-index de su loader, que no pasa por `useCapaModal`. |
| **El mapeo índice→R1/R2 sigue duplicado** en tres lugares | `lib/pipeline.ts:359` (`asist()`) y `lib/stage-requirements.ts:106` deberían consumir `lib/funnel-etapas.ts` | Deuda contra "una cosa, un lugar", anotada como PENDIENTE en la cabecera del módulo. |
| **12 hardcodes de `America/Tijuana`** en display | `lead-view/*` (5), `lib/calendly.ts`, `lib/date-utils.ts`, `lib/lead-insights.ts`, `lib/mako-*.ts`, `webhooks/calendly` | `hoyEnWorkspace()` / `tzActual()` (`lib/timezone.ts`) ya existen para migrarlos. Violan "nada owner-only". |
| **Callers que van directo a `setPipelineStage`, sin validación** | `lib/mako-doer-acciones.ts:61`, `lib/mako-confirmaciones.ts:179`, crm-auto | Cerrarlos exige tocar `lib/leads.ts`. |
| **`leerTodo` privado + 6 bucles `.range()` copiados a mano** | `lib/landing-analyst.ts:124`, `evolution-contactos`, `evolution-mensajes`, `ads-analyst`, `importar-server`, `barrido-dump` | Ahora hay un lugar al que migrarlos: `lib/supabase-paginado.ts`. |
| **`moverEnCalendario` y la duración real** | `app/crm/actions.ts` | Ya propaga `duracionMin`, pero la duración de un evento **existente** la sigue definiendo el evento. |

### Descartado a propósito (no volver a "arreglarlo")

- **Aprender el techo real de PostgREST desde la primera página corta.** Se implementó y se
  **revirtió**: una página corta es indistinguible del final de la tabla, así que la única
  detección honesta cuesta un request extra en **cada** lectura chica (3 por carga del CRM,
  +100-180 ms) para blindar una configuración que este proyecto no tiene. `PAGINA_POSTGREST
  = 1000` es el default de Supabase. **Si se baja `db-max-rows`, se baja la constante en el
  mismo commit** — está escrito en el módulo.
- **Los items 'R' permanentes y no ignorables**: decisión de producto, ver arriba.

---

## 5. Nota de proceso

Con **sesiones paralelas**, el typecheck rompe por archivos que no son tuyos: durante esta
corrida `SelectorHora.tsx` y `CrmBoard.tsx` dieron errores transitorios ajenos
(`TS2552: Cannot find name 'Opcion'`, y un refactor a medio terminar en
`google-calendar.ts` con imports en conflicto contra copias locales todavía vivas). **El
verde se toma con el árbol estable**, y conviene commitear seguido y explícito: `git add
-A` se lleva los archivos a medias de la otra sesión.

Un agente reportó como "arreglado" algo que otro seguía editando, y dos reportes se
contradecían sobre el mismo archivo. **Verificá contra el código, no contra el resumen del
agente anterior.**
