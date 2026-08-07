# Hallazgos del CRM

Lo que hay que saber antes de tocar el wizard "¿Qué hacer ahora?", el selector de
horarios, el worklist de pendientes y los requisitos de etapa. **No es un changelog**:
es lo que no se deduce leyendo el código.

Origen: corridas multi-agente de 08/2026 (selector de horas + 5 bugs del CRM; después,
requisitos de etapa y fuente única del funnel). Regla de la cosecha en `AGENTS.md`.

**Acá va solo lo que vive en código del CRM** (`app/crm/**`, `lib/leads.ts`,
`lib/pipeline.ts`, `lib/funnel-etapas.ts`, `lib/stage-requirements.ts`, `lib/queries.ts`,
`lib/crm-auto.ts`). Lo que se aprendió en estos mismos frentes pero vive en otro lado está
en su documento: paginado, zonas horarias y tests en
[hallazgos-infra.md](hallazgos-infra.md); `WizardShell` y la pila de modales en
[hallazgos-ui.md](hallazgos-ui.md); MaKo moviendo etapas en
[hallazgos-ia.md](hallazgos-ia.md); el desenlace de las nutriciones en
[hallazgos-comunicacion.md](hallazgos-comunicacion.md). El índice es
[hallazgos.md](hallazgos.md).

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
| **`stageMeta` cae a `stages[0]`** y pinta un dato falso | `lib/pipeline.ts:533` | Usar **`stageMetaOpt`** y guardar la KEY, no el label. |
| **`funnelReqInfo` deriva el nivel de `kind`, y `kind` solo lo traen las etapas GENERADAS** | `lib/stage-requirements.ts:118` | Pasarle `DEFAULT_STAGES` "pelado" da nivel 0 a todo y **cualquier movimiento pasa sin que nada avise**. El fallback correcto es `generateFunnel(DEFAULT_PIPELINE, []).stages`. Lo encontró un test, no la revisión. |
| **Un componente declarado dentro del render remonta todo** | `SelectorHora.tsx` | Las opciones se generan con una **función que devuelve el elemento**. Como componente anidado, React remontaba las 61 filas con cada tecla y tiraba el scroll al principio. |
| **Paginado, topes de lectura y zonas horarias** | `lib/supabase-paginado.ts`, `lib/date-utils.ts` | Las trampas están en [hallazgos-infra.md](hallazgos-infra.md) §1 y §2. Resumen: `leerTodo()`/`leerPorPaginas()`, y el orden de un bucle paginado tiene que ser **único**. |
| **Tests: `server-only`, CRLF en los guards de texto** | `tests/*.test.ts` | [hallazgos-infra.md](hallazgos-infra.md) §3. |
| **`getComputedStyle` con la pane oculta, z-index de modales** | UI general | [hallazgos-ui.md](hallazgos-ui.md) §2. |

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

### El fallback de una función es parte de su contrato

**Casi entra un bug de datos al unificar el mapeo índice→R1/R2 en una sola función.**
`etapasDeReunion(stages?)` cae a `DEFAULT_PIPELINE` cuando no le pasan funnel, y eso es
correcto para quien **consulta** ("¿esta etapa es una reunión?"). Es veneno para quien
**construye o mide** el funnel: con esa versión, `generateFunnel` sobre un pipeline vacío o
sin reuniones heredaría `firstMeeting = 'agenda'` del funnel por defecto y le pintaría a
ese workspace transiciones "Recupera" / "Reagenda" hacia una etapa **que no tiene**. Lo
mismo `funnelReqInfo`: le pediría al worklist una R1/R2 inexistente.

**Dónde:** `lib/funnel-etapas.ts` expone las dos, y la diferencia es el fallback —
`reunionesDe(stages)` estricta (la que usan `generateFunnel` en `lib/pipeline.ts` y
`funnelReqInfo` en `lib/stage-requirements.ts`) y `etapasDeReunion(stages?)` tolerante (la
que usan los consultores). `slotPorIndice(i)` devuelve `null` desde el índice 2: `leads`
tiene **dos** pares de columnas de reunión, y de ahí sale el `{}` de la tercera.

**Regla:** al unificar N copias en una función, el fallback de la copia más tolerante se lo
lleva todo el mundo. Si dos callers necesitan respuestas distintas ante "no hay datos", son
**dos funciones**, y la estricta es la que se usa para escribir.

**La última copia estaba en el cliente**: `app/crm/CrmBoard.tsx` decidía R1/R2 con
`l.stage === 'agendaj2' ? 'r2' : 'r1'` — la key del funnel **por defecto** hardcodeada en
una pantalla que se le muestra a cualquier workspace. Un `grep` del `kind === 'reunion'`
no la encontraba: la duplicación no siempre se parece al original.

### Quién revalida al mover un lead, y quién no

`setPipelineStage` acepta `requisitos?: 'validar' | { omitir: motivo }`, y **el default es
no validar**. No es pereza:

- **Sin el parámetro** (los que vienen de un formulario: el wizard del CRM,
  `app/crm/actions.ts`, `createLead`, los upserts de Meta/Calendly). El CRM ya validó con
  lo que la persona **acaba de tipear**, y eso todavía no está persistido: revalidar contra
  la base le volvería a pedir el dato que está escribiendo.
- **`'validar'`** (motor automático, MaKo, el desenlace de nutriciones, el bloqueo de un
  contacto): chequea **antes de escribir nada**. El orden importa — un movimiento rechazado
  no puede dejar `estado_lead` sincronizado con una etapa a la que el lead nunca llegó.
- **`{ omitir }`**: mueve y deja en `lead_audit` una línea `'Etapa sin validar'` con el
  porqué. **Fail closed**: `omitir` vacío vuelve a validar, y sin poder leer el lead no
  mueve.

**Regla:** "¿este caller valida?" no se contesta por caller, se contesta por **de dónde
sale el dato**. Si el dato está en la pantalla y no en la base, validar contra la base es
un falso negativo.

**Costo, para que nadie lo descubra en un incidente:** `'validar'` agrega una lectura de
`funnel_config` por movimiento y no está cacheada. Irrelevante de a uno; en una corrida del
cron con muchos T2 son N queries de una fila. La salida es memoizar `getFunnel` por
request, **no** aflojar la validación.

### La ficha del lead vive en dos árboles

`app/crm/LeadSheet.tsx` (cliente, modal) y `app/crm/[id]/page.tsx` (server). Las mismas
cards se montan en los dos, y eso decide cómo les llega la configuración del workspace: la
zona horaria entra por un **hook** (`useTzWorkspace`, con memo a nivel de módulo: una
llamada por carga, no una por card) y no por prop, porque un prop hay que enhebrarlo por
los dos árboles y deja el agujero abierto para el tercer lugar donde se monte una card.

**La trampa:** el primer render **tiene que** usar el mismo fallback de los dos lados
(`TZ_TIJUANA`). `GeneratedInsightCard` y `TrackingTimelineCard` pintan timestamps ya en el
SSR de `/crm/[id]`; si el valor inicial fuera la zona del navegador —que el server no
conoce— revienta la hidratación. El memo solo se escribe **desde el efecto**, que nunca
corre en el server: llenarlo durante el SSR le pasaría la zona de un inquilino al
siguiente.

**Colateral que se ve poco:** en `ChatCard`, el **separador de día** también dependía de la
zona. A las 23:30 en Tijuana ya es otro día en Madrid, y los mensajes se agrupaban bajo la
fecha equivocada. Una zona horaria no solo cambia una hora impresa: cambia **agrupaciones**.

---

### Tres lecciones de este frente viven en otro documento

Salieron trabajando el CRM, pero el código no es del CRM y la regla que dejan gobierna a
todos sus llamadores. **Van linkeadas, no copiadas** (una entrada, un lugar):

- **Un validador hereda las capacidades del canal donde lo ponés.** MaKo exigía por
  WhatsApp requisitos que ninguna de sus tools sabe cargar: el dueño quedaba en un bucle
  infinito de "pedí ese dato". → [hallazgos-ia.md](hallazgos-ia.md) §1.
- **Un tope nuevo es un truncado nuevo.** Unificar seis bucles `.range()` metió un
  `MAX_PAGINAS` más bajo que el de tres de ellos, y el `throw` cayó en catches que
  degradaban. → [hallazgos-infra.md](hallazgos-infra.md) §1.
- **Dos modos de la misma pieza tienen que contestar igual.** El progreso de `WizardShell`
  decía "Último paso" con un "Siguiente →" abajo. → [hallazgos-ui.md](hallazgos-ui.md) §1.

---

## 4. Lo que quedó sin hacer

Cerrado en la última corrida y **sacado de esta lista**: el chrome forkeado del wizard, el
mapeo índice→R1/R2 (las tres copias más la del cliente en `CrmBoard.tsx`), los hardcodes de
`America/Tijuana` en display de la ficha, los callers de `setPipelineStage` sin validación
y los bucles `.range()` a mano. Los residuales de otras áreas se cerraron también y están
anotados en sus documentos.

Lo que sigue abierto **en código del CRM**:

| Qué | Dónde | Por qué |
|---|---|---|
| **`moverEnCalendario` y la duración real** | `app/crm/actions.ts` | Ya propaga `duracionMin`, pero la duración de un evento **existente** la sigue definiendo el evento. |
| **`faltantesParaMover` decide con `hoyEnTijuana()` fijo** | `lib/leads.ts:1570` | Alimenta `yaPaso()`: si una reunión "ya pasó" y por lo tanto si se exige asistencia/Fathom. No es una cohorte persistida sino **gating**, y desde que MaKo valida, además **traba o destraba un movimiento** un día antes o después para un workspace lejos de TJ. Es la punta de la migración de las primitivas de fecha ([hallazgos-infra.md](hallazgos-infra.md) §5). |
| **`valoresDeRequisitos` es el superset de `faltantesParaMover`** y debería construirse sobre ella | `app/crm/actions.ts:276` | Los mismos valores más lo que el wizard acaba de tipear y los pagos. Hoy son dos listas que hay que mantener iguales a mano — exactamente "una cosa, dos lugares". Tocarla es tocar el camino que usa toda la UI; queda un `PENDIENTE` en el comentario. |
| **El camino de "marcar reunión a mano" está muerto salvo para el dueño** | `setMeetingManual` (`lib/leads.ts:690`), `markMeetingManualAction`, `app/crm/calendly-widget.ts:10` | Tipan `which: 'agenda' \| 'agendaj2'` y `CrmBoard:543` castea una stage key arbitraria a esas dos: en un funnel custom, el `else` escribiría `fecha_junta_2` para la PRIMERA reunión. Hoy no explota porque los dos call-sites están gateados por `calendlyUrlFor()`, cuya tabla tiene **dos URLs de Calendly personales hardcodeadas** — o sea, es la misma violación de "nada owner-only" con otra cara. |
| **`sinR2Motivo` se puede perder en silencio** | `app/crm/StageMoveDialog.tsx`, `confirmar()` | Se manda solo si `huboR1 !== false`; si se escribe el motivo y después se cambia `huboR1` a `false`, el texto queda escrito y no viaja. |
| **El wizard de etapa se monta dentro del backdrop de la ficha** | `app/crm/LeadSheet.tsx:187` (`onClick={onClose}`) y `:254` | Un click en el backdrop del wizard **cierra los dos**: se pierde lo tipeado y también la ficha. Preexistente, no lo trajo la migración a `WizardShell`. |
| **`app/crm/actions.ts:916` repite el bucle del helper** | ídem | Ordena por `id` y tiene su comentario: es duplicación, no bug. |

### Descartado a propósito (no volver a "arreglarlo")

- **Los items 'R' permanentes y no ignorables**: decisión de producto, ver §3.
- **Revalidar los requisitos en los callers que vienen de un formulario.** Parece el cierre
  natural del frente y **no lo es**: el wizard valida con lo que la persona acaba de
  tipear, que todavía no está en la base. Ver §3, "Quién revalida al mover un lead".
- **Aprender el techo real de PostgREST desde la primera página corta.** Se implementó y se
  revirtió; el motivo completo está en [hallazgos-infra.md](hallazgos-infra.md) §5.

---

## 5. Nota de proceso

Las lecciones de trabajar con **varias sesiones en el mismo árbol** (typecheck ajeno,
`git add -A`, reportes que se contradicen, y el documento que nadie toca porque los cuatro
agentes se cedieron el paso) están en [hallazgos-infra.md](hallazgos-infra.md) §4.

De este frente en particular: `SelectorHora.tsx`, `CrmBoard.tsx`, `funnel-etapas.ts` y
`google-calendar.ts` dieron errores transitorios que **no eran de quien los veía**
(`TS2552: Cannot find name 'Opcion'` / `'Stage'`, refactors a medio terminar). **El verde
se toma con el árbol estable.**
