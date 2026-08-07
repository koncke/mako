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

---

## Cosecha retroactiva (2026-08-07)

Rescatado de los journals de las 261 corridas multi-agente de junio a agosto de 2026:
**134 de 260 nunca habían escrito nada en el repo**. El registro completo de las corridas
está en [corridas-multiagente.md](corridas-multiagente.md).

⚠️ **Es material de segunda mano.** Sale de lo que devolvieron los subagentes en su
momento, no de una relectura del código de hoy. Cada entrada dice de qué corrida y de qué
fecha viene. **Antes de actuar sobre una, verificá contra el código**: varias ya están
arregladas, y donde el rescate lo sabía, lo dice.

### Trampas: el diagnóstico obvio era el equivocado

#### Un fallo de Chatwoot se escribe como señal de negocio y quema el único intento automático

En T3, si Chatwoot falla (rate limit, timeout, 5xx) el catch pone `inbound = -1`. Ese -1 no entra por `if (inbound > 0)` y cae al else, que crea igual la confirmación con clave 'T3'; lo único que distingue «no pudimos leer» de «no hay mensajes» es el texto de la nota. Y como `existeConfirmacion` filtra SOLO por (lead_id, clave) sin mirar el estado, la corrida siguiente devuelve 'skip' para siempre aunque Chatwoot ya se haya recuperado. T3 es el único camino automático que reclasifica un lead en 'manual', así que el error transitorio quema el único intento y el lead queda en nutrición manual vencida indefinidamente. Regla: un no-resultado no puede compartir la clave anti-loop con un resultado.

**Vive en:** lib/crm-auto.ts:250-298; lib/mako-confirmaciones.ts:57-66 (existeConfirmacion) · *2026-07-05 · ~review-adversarial-crm-automatico*

#### COHORTE_DIAS_* son env vars que no lee nadie: el umbral real está hardcodeado en cuatro lugares que no se hablan

`COHORTE_DIAS_MADURA` y `COHORTE_DIAS_MADURANDO` tienen cero ocurrencias en todo el repo y ni siquiera están en el catálogo, así que el boot no las hidrata: alguien creyó que configuraba la madurez de las cohortes y nunca se cableó. Los umbrales de verdad (14 y 5 días) viven repetidos en la migración 0084 (dentro del CASE de las vistas `v_cohortes_*`), en lib/leads.ts y en lib/queries.ts. Y como el filtro `.eq('estado_madurez','madura')` se resuelve EN SQL contra la vista, volverlo configurable por cliente no es mover un env: es una migración que saca el CASE de las vistas más un refactor de las queries que hoy filtran server-side.

**Vive en:** supabase/migrations/0084_cohortes_workspace.sql:45-46 y :81-82, lib/leads.ts:1019-1020, lib/queries.ts:922-923 · *2026-07-16 ~auditoria-env-vars*

#### Desbloquear un contacto no es «volver a abrirlo»: machaca el estado real del lead

El unblock hace `updateLead({ estado_lead:'abierto', motivo_perdida:null })` y `pipeline_stage = null` sin condición. Si el lead estaba 'ganado', 'perdido', en R2, no-show, o tenía una columna puesta a mano en el Kanban, todo eso se pierde — y el bloqueo tampoco persistió el estado anterior, así que el round-trip bloquear→desbloquear es lossy por diseño e irrecuperable. Regla: revertir una acción es restaurar lo que había, no escribir el default; si no guardaste el estado previo, condicioná la reversión a que la acción siga siendo la que causó el estado actual (`estado_lead === 'descalificado' && motivo_perdida === 'Bloqueado en WhatsApp'`).

**Vive en:** app/api/whatsapp/contacts/[id]/block/route.ts:47-48; lib/leads.ts:1117 · *2026-06-23 ~auditoria-inbox-whatsapp-chatwoot*

#### Los event types de Calendly figuran `opcional: true` y NO lo son: la tab se pinta conectada y el webhook tira las reuniones con 200 OK

Síntoma clásico del cliente: conecta Calendly, ve el tilde verde y no entra ni una reunión, sin un solo error en ningún lado. Causa real: `CALENDLY_EVENT_TYPE_J1/J2` están marcados opcionales en el catálogo, así que `integracionConectada` los ignora y la tab se prende; pero el webhook resuelve el workspace comparando el event type contra ESOS valores, y sin match responde 200 OK con `ignored`, para que Calendly no reintente. Un campo que el catálogo llama opcional y el ruteo trata como obligatorio produce exactamente un all-clear falso. Hoy el hueco está documentado solo en el copy que ve el usuario (`ademas` en lib/tab-activacion.ts:151), no en el código que decide. Regla: `opcional: true` significa «el servicio funciona sin esto» — si algún camino lo necesita para no descartar datos, no es opcional. La corrida más reciente (2026-08-06) confirma que sigue abierto; lo que sí se cerró es la signing key, que ahora se lee por workspace con `credWs`.

**Vive en:** lib/metodo-catalogo.ts:445-447 · app/api/webhooks/calendly/route.ts (resolución de ws + `ignored`) · lib/tab-activacion.ts:151 · *2026-08-06 ~verificar-tareas-ya-hechas*

#### `pipeline_stages` es una tabla muerta que se sigue arrastrando

Ningún archivo de lib/ ni de app/ la lee: el pipeline real vive en funnel_config.data.pipeline. Encima su PK es (key) GLOBAL, así que clonarla a otro workspace revienta con duplicate key. Hoy sigue viva en TENANT_TABLES y en las listas de copia/reset (verificado: solo aparece en lib/workspace.ts, lib/datos-mau.ts y lib/reset-workspace.ts). No migrarle nada, no clonarla, y si se toca alguna personalización vieja, llevarla a funnel_config.

**Vive en:** supabase/migrations/0020-0025 · lib/workspace.ts (TENANT_TABLES) · lib/reset-workspace.ts · *2026-08-01 · mapa-clonar-workspace*

#### Importar leads por CSV tiene tres formas de fallar sin dar un solo error

(1) `f.text()` NUNCA falla sobre binario: un PDF o un XLSX devuelve mojibake, habilita el botón y el usuario termina leyendo «No encontré una columna Nombre en el CSV» — el problema es el formato, no la columna, y nadie lo dice. (2) El delimitador `;` (el Excel en español) hace que toda la fila sea UN campo, y como el match de encabezados es por substring, `iNombre`, `iEmail` e `iTel` resuelven todos al índice 0: se crean leads con `nombre = "Juan Pérez;juan@x.com;+54911…"` y ese mismo string en email y teléfono, que además envenena el dedup. (3) Los contadores del paso 2 mienten (`total = creados + omitidos`, las filas vacías se saltean con `continue`). Reglas: sniffear el delimitador y ABORTAR si dos campos caen en el mismo índice; decodificar con `TextDecoder('utf-8',{fatal:true})` y caer a windows-1252; y que el preview devuelva filas con estado, no números. De paso: `createLead` declara `origen_lead` en su input pero el insert no lo escribe, así que un lead importado es indistinguible de uno cargado a mano.

**Vive en:** app/crm/actions.ts:724-825 (parseCsv/previsualizar/importar) + app/crm/ImportarLeadsModal.tsx + lib/leads.ts:172,295-306 · *2026-08-06 crm-tracking-import-export-audit*

#### El CSV que exporta Excel en español usa `;` y viene en Windows-1252

El parser de importación tenía la coma hardcodeada, sin detección de delimitador. Con el encabezado "nombre;email;telefono;empresa" el matching flexible `h.includes(n)` resuelve TODOS los campos al índice 0: cada lead se crea con la fila entera como nombre, como email, como teléfono y como empresa, pasa la validación, pasa el dedup y reporta "✓ N leads nuevos". No es un error: es corrupción silenciosa, y no hay preview ni deshacer. Del mismo par: `file.text()` decodifica UTF-8 mientras que ese CSV sale en ANSI/1252, así que los acentos llegan rotos sin aviso; y en el sentido inverso, al exportar hay que agregarle el BOM o Excel lo abre en Windows-1252 y rompe los acentos. Regla: detectar el delimitador y FALLAR si el encabezado no resuelve coherente (dos campos al mismo índice = abortar), en vez de importar basura.

**Vive en:** app/crm/actions.ts (parseCsv, EXPORT_COLS), app/crm/leads-importar.ts · *2026-08-06 ~crm-toolbar-e-importar-exportar*

#### Google Calendar: ampliar el scope no re-consiente solo, y `calendar.events` no alcanza

Al sumar la escritura (mover el evento al reagendar) aparecieron tres trampas. (1) `calendar.events` NO cubre `calendars.get`, de donde sale el email del calendario: el scope pedido tiene que ser la UNIÓN de `calendar.readonly` + `calendar.events`, no el reemplazo. (2) Los que ya habían conectado conservan el scope viejo en su refresh_token y quedan en solo lectura sin enterarse — hay que detectarlo con los scopes que devuelve el propio refresh (`j.scope`, sin request extra a /tokeninfo) y pedir reconectar en la UI; `puedeEscribir()` es optimista si Google no informa scopes, porque la certeza real la da el 403. (3) Sin `prompt=consent` Google NO reemite refresh_token para quien ya había aceptado, así que el botón «Reconectar» no haría nada; y hace falta `include_granted_scopes=true` para no perder lo ya otorgado. PENDIENTE de acción manual: agregar `https://www.googleapis.com/auth/calendar.events` a la lista de scopes de la pantalla de consentimiento en Google Cloud Console, o Google puede devolver `invalid_scope` (es «sensible», el mismo tier que el readonly que ya se pedía: no cambia el estado de verificación).

**Vive en:** lib/google-calendar.ts:32-49 (GCAL_SCOPE) y :182 (puedeEscribir) · app/api/integraciones/google-calendar/route.ts:35-42 · *2026-08-06 · gcal-write-y-history-completo*

#### «Se perdió» escribía «asistió a la reunión» sin que nadie lo dijera

El pendiente 'R' del worklist existe justamente porque nadie sabe si la reunión que ya pasó ocurrió. Elegir «Se perdió» copiaba `transitionFor(etapa,'perdido')`, y esa transición del funnel generado trae `asistioJ1: true` (`...asist(p.key, true)`); como el paso `asistenciaR1` no estaba en la lista de requisitos, `StageMoveDialog` caía en la rama `{ asistioJ1: move.asistioJ1 }` y el server lo persistía. Resultado: el CRM registraba «asistió» a una reunión cuyo desenlace nadie conocía — el dato exacto que el pendiente existía para averiguar —, y después `updateLead` forzaba `calificado = null` por incoherencia. El fix invierte la lógica: la asistencia se declara primero como HECHO y `salidasDeEtapa` FUERZA el flag a false en las salidas aunque la transición del funnel diga lo contrario. Eso queda comentado en el código a propósito: el próximo que lea `transitionFor` va a pensar que es un bug y lo va a «arreglar» de vuelta.

**Vive en:** lib/pipeline.ts (asist/DEFAULT_TRANSITIONS y salidasDeEtapa) · app/crm/StageMoveDialog.tsx · app/crm/CrmBoard.tsx (confirmarQueHacer) · *2026-08-06 ~wizard-que-hacer-ahora-y-horarios-de-google*

#### La pregunta que decía «es la última vez que te lo podemos preguntar» era la única que no persistía

`updateLead` tiene una regla de coherencia: `if (merged.asistio_j1 !== true) merged.calificado = null`. En un pendiente de R2 (lead con `fecha_junta_2` cargada por Calendly, `asistio_j1` en null porque nadie marcó la R1), el wizard mandaba `{ asistioJ2: true, calificado }` — nunca toca `asistio_j1` — así que la regla borraba el `calificado` recién contestado, en silencio. Y el lead se iba a Perdido, donde `stepsForStage` corta y `faltantesDeLead` devuelve `[]` para siempre: nadie lo vuelve a ver, y se pierde también el evento de CAPI que la pregunta existía para alimentar. La regla que queda: antes de PREGUNTAR un campo, verificar que el camino de escritura no lo vaya a descartar por una coherencia aguas arriba — el fix fue un guard `qhCalificadoPersiste` que solo muestra la pantalla cuando el dato va a sobrevivir, sin tocar la regla de leads.ts (que gobierna todas las escrituras del repo).

**Vive en:** lib/leads.ts:381-383 (regla de coherencia) · app/crm/CrmBoard.tsx (qhCalificadoPersiste) · app/crm/actions.ts (completeStageMoveAction) · *2026-08-06 ~wizard-que-hacer-ahora-y-horarios-de-google*

#### Leer huecos y mover el evento son permisos distintos, y el traductor de errores decía lo contrario de lo que pasaba

Dos trampas del mismo módulo. (1) `POST /freeBusy` funciona con `calendar.readonly`: los horarios disponibles andan HOY con el token viejo de solo lectura que tiene el dueño. Si `horariosLibresDeGoogle` copiaba el guard `puedeEscribir()` de `moverEventoDeReunion`, le negaba los horarios justo al único caso vivo — está comentado en el código para que nadie lo «arregle». (2) `leerFallo` estaba escrito para el camino de ESCRITURA: reusado en el de lectura, un 403 por falta de scope de lectura devolvía «El permiso de Google es de solo lectura: reconectá la agenda para poder MOVER reuniones», o sea mandaba a diagnosticar exactamente al revés, y encima clasificaba como `sin-conexion` una agenda conectada. Regla: un traductor de errores hereda el contexto para el que fue escrito; al reusarlo en otro camino hay que revisar cada mensaje.

**Vive en:** lib/google-calendar.ts (GCAL_SCOPE_LECTURA, horariosLibresDeGoogle, puedeEscribir, leerFallo) · *2026-08-06 ~wizard-que-hacer-ahora-y-horarios-de-google*

#### «Eliminar los datos de Mau» no devuelve lo que pisó: lo borra

El ámbito `setting` pasó de copiar 1 clave a copiar 7 (`chat_agent.ensayo`, `chat_agent.audios_clave`, la voz destilada…). La copia es un upsert ciego que no guarda el valor previo, y el borrado es un DELETE por clave, no una restauración. Un workspace que ya hizo su propio onboarding del Chat Agent pierde su ensayo entero (9 casos escritos a mano), su mapa de audios y su voz; después «Eliminar los datos de Mau» le borra esas claves en vez de devolverle las suyas y queda sin nada. Rompe la regla escrita en la cabecera del propio archivo: «Borrar borra lo que TRAJIMOS, no lo que hay». El ámbito `perfil` sí guarda el valor anterior en el recibo y lo restaura: ese es el patrón a copiar. Variante peor: `settingsRemap` corre aunque el bloque de settings no haya copiado esa clave, lee el valor del DESTINO, lo traduce contra un mapa de ids del DUEÑO (que nunca matchean, porque `setting_audios.id` es bigserial global) y lo deja en `{}` — y como la clave nunca entró al recibo, «Eliminar» tampoco la restaura.

**Vive en:** lib/datos-mau.ts:200-229, :599-661 y :754 · *2026-08-02 ~ensayo-chat-agent-y-datos-mau*

#### Una llamada de coaching entraba al CRM como Reunión 2

`buscarReunionesAutomatico` elegía la grabación por fecha y match de email, sin filtrar `category`. El dueño usa Fathom para TODO: solo ~10-40 de ~196 grabaciones son de ventas, así que una sesión de entrega de servicio quedaba cargada como la R2 del lead, con su link y su asistencia marcada. Hoy filtra `category='venta'`; la limpieza histórica se hizo con scripts/audit-fathom-links.mjs. Regla general: cuando la fuente externa mezcla varios usos, el filtro por tipo es parte del contrato, no una optimización.

**Vive en:** lib/auto-reuniones.ts · *2026-08-07 contexto-mako-md*

#### Guardar las cuotas marca el lead como ganado

`saveCuotasAction` hereda de `saveLeadPlanManual`, que además de reemplazar las cuotas no pagadas setea `estado_lead='ganado'` y `cerro=true`. Por eso la UI de Deal Details solo la llama si `cuotasDirty`: tocar el plan de pagos de un lead que todavía no cerró lo cierra sin preguntar. Cualquier caller nuevo tiene que saberlo antes de usarla como un simple «guardar cuotas».

**Vive en:** app/leads/[id]/deal-actions.ts (saveCuotasAction) · lib/leads.ts (saveLeadPlanManual) · *2026-07-03 ~deal-details-contrato-y-comprobante*


### Reglas que quedan

#### El revert guarda tus intenciones, no el estado del lead

El «Deshacer» de las confirmaciones de MaKo aplica `.update(c.revert)` crudo con el patch que vos armaste al aplicar. El problema es que `setPipelineStage` → `updateLead` toca columnas DE REBOTE que no están en tu patch: al reabrir un lead perdido borra `motivo_perdida` (y no vuelve nunca: dato de negocio destruido pese a que el humano rechazó), deriva `cerro` del estado nuevo, y estampa `nutricion_realizada=true` en las etapas de NUTRI_KEYS. Regla: el revert tiene que snapshotear las columnas que la función que llamás puede tocar, no las que vos escribiste. Y para columnas array el patch es un overwrite last-write-wins: revertir `fathom_links` con el snapshot viejo borra el link que otro agregó en la ventana (que son horas o días, no un race exótico) — ahí el revert tiene que ser quirúrgico (sacar la url que agregó MaKo), no un set. Aparte, el orden: se aplica el efecto ANTES de insertar la confirmación, y `crearConfirmacion` se traga cualquier error del insert y devuelve false sin que nadie lo mire; si falla, el lead queda mutado sin fila para deshacer y los guards impiden que se vuelva a proponer — el cambio huérfano es permanente.

**Vive en:** lib/crm-auto.ts:204-212 (T6), :229-246 (T1), :272-298 (T3); lib/mako-confirmaciones.ts:94-99 y :145-150; lib/leads.ts:304-325 y :1341-1343 · *2026-07-05 · ~review-adversarial-crm-automatico*


### Decisiones tomadas, y por qué

#### El funnel del cliente no dice nada de su negocio: el onboarding le aplica siempre la plantilla 0

app/api/onboarding/route.ts aplica FUNNEL_TEMPLATES[0] hardcodeada, sin mirar el canal declarado. Verificado en prod: ws1, ws3, ws10 y ws11 tienen EXACTAMENTE el mismo pipeline (lead | Agenda R1 | Agenda R2 | Facturando | Ganado). Consecuencia práctica: usar funnel_config como evidencia de cómo vende un cliente («tiene etapa Agenda R2, entonces hace dos llamadas») es un falso positivo — le cayó por default. Para saber cómo vende hay que mirar negocio.fase.diagnostico (canal) y el panorama del Archivero.

**Vive en:** app/api/onboarding/route.ts (aplicación de FUNNEL_TEMPLATES[0]) · funnel_config · *2026-08-01 · ~poda-board-leila-ws11*

#### El filtro en JS de getObjetivoProgreso es load-bearing: no lo empujes a SQL

Parece el candidato obvio de una auditoría de eficiencia (trae filas y filtra en memoria), pero es un falso positivo: (a) incluye fecha_cierre NULL, o sea los ganados sin fecha, que un .gte excluiría; y (b) calcula DOS ventanas sobre las mismas filas (desde y últimos 30 días), así que empujar el `desde` a SQL rompe cierres_30d cuando desde > hace30. Una sola query más filtro en JS ES el diseño eficiente acá. Descartado a propósito.

**Vive en:** lib/queries.ts (getObjetivoProgreso) · *2026-07-13 · plan-autonomo-tanda2*


### Lo que quedó sin hacer

#### Los flujos con paso 'esperar' se cortan en la primera espera

`lib/flujos.ts:43` hace `break` cuando el paso es de tipo 'esperar': falta el cron drenador. O sea que una automatización «cuando pase X, hacé Y» que tenga un «esperar N horas» ejecuta hasta ahí y muere sin error ni rastro, con la mitad de los pasos sin correr. Está anotado en dos comentarios del propio archivo y en ningún doc. Consecuencia de producto: la capacidad se puede nombrar como «lo que viene», pero no filmar una demo mostrándola correr.

**Vive en:** lib/flujos.ts:7 y :43 · *2026-07-26 · ~catalogo-de-features-de-la-landing*

#### El progreso del objetivo arranca en la fecha de Mauricio para cualquier workspace sin la setting

`OBJETIVO_DESDE_DEFAULT = '2025-12-08'` es la fecha de arranque del dueño y es el fallback cuando el workspace no tiene `objetivo_desde` en app_settings. A un cliente nuevo le cuenta todo su histórico contra una fecha que no significa nada para él, y no avisa: es un default que inventa un dato. La causa de fondo es que `crearWorkspace` solo inserta la fila en `workspaces` — no seedea app_settings ni funnel_config ni las secuencias de nutrición (que se insertaron por migración pre-multi-tenant y por eso solo existen en el ws 1), así que todo el arranque de un cliente nuevo depende de fallbacks del código. Corresponde seedear `objetivo_desde` con la fecha de alta del ws; las metas pueden quedar en null, que es honesto (la card muestra progreso sin meta).

**Vive en:** lib/queries.ts:2620 (OBJETIVO_DESDE_DEFAULT) · lib/workspace.ts (crearWorkspace) · supabase/migrations/0034_nutricion.sql:81 · *2026-07-02 ~mapa-onboarding-extraccion-retro*

#### La ayuda de horarios nació owner-only: solo ws1 puede tener Google Calendar conectado

Conectar la agenda está gateado por `esDuenoAdmin()` en los DOS route handlers del OAuth de Google Calendar. La lectura de horarios sí es workspace-aware (el refresh token vive en `app_settings` bajo `google.calendar.refresh_token`, cifrado, y `getSetting` filtra por el workspace de la sesión), pero como ningún workspace que no sea el 1 puede completar el OAuth, para todos los demás `horariosLibresDeGoogle` devuelve `sin-conexion` siempre y la grilla sale neutra. Degrada bien —reagendar sigue funcionando— pero la feature nace owner-only de hecho, contra la regla «nunca owner-only, todo workspace-aware». Del mismo flujo quedó vivo: `moverEnCalendario` no chequea que el evento exista antes de prometer en el resumen que se va a mover.

**Vive en:** app/api/integraciones/google-calendar/route.ts y su callback (guard esDuenoAdmin) · lib/google-calendar.ts · *2026-08-06 ~wizard-que-hacer-ahora-y-horarios-de-google*

