# Hallazgos de MaKo (IA)

Lo que hay que saber antes de tocar el doer (`lib/mako-doer-*.ts`), las tools
(`lib/mako-tools.ts`) o las confirmaciones diferidas (`lib/mako-confirmaciones.ts`).
**No es un changelog.**

Origen: corrida multi-agente de 08/2026 (validación de movimientos de etapa). Regla de la
cosecha en `AGENTS.md`.

---

## 1. Un validador hereda las capacidades del canal donde lo ponés

**Síntoma:** el dueño escribe «mové a Juan a Agendado» por WhatsApp. MaKo contesta «falta
cargar la Fecha de la Reunión 1, pedí ese dato». El dueño la dice. MaKo vuelve a contestar
lo mismo. Para siempre.

**Causa:** se cerró un agujero real —MaKo movía a Ganado sin monto— exigiendo **todos** los
requisitos del wizard del CRM. Pero las 11 tools del doer solo saben escribir `monto` y
`motivo`. La fecha de una reunión, la asistencia, el link de Fathom y los Deal Details
viven en Calendly/Fathom/la ficha, y **ninguna tool los carga**. El error hasta le mentía
al modelo: le decía «pedí ese dato» y no había dónde ponerlo.

**El diagnóstico obvio era el equivocado:** el bug no estaba en la validación (que es
correcta y sigue) sino en **de dónde se copió**. El wizard del CRM puede exigir la fecha de
la R1 porque la carga en el mismo paso; WhatsApp no.

**Dónde:** `REQUISITOS_PEDIBLES` + `veredictoRequisitos()` en `lib/mako-doer-acciones.ts`.
Se **pide** lo que el canal sabe cargar; lo que no puede cargar **no bloquea pero tampoco
se calla**: se mueve con `{ omitir }`, que deja en `lead_audit` qué quedó sin cargar y por
qué, y viaja en el resumen que el dueño lee antes de decir que sí.

**Regla:** antes de exigir un dato, preguntá **por dónde se carga ese dato desde acá**. Si
no hay camino, no es una validación: es un callejón sin salida, y el usuario no tiene forma
de saber que está en uno.

## 2. Una acción diferida sobrevive al deploy que le cambia las reglas

Corolario del anterior, y se pasa por alto siempre: las `mako_pendientes` creadas **antes**
de la validación nueva se ejecutan **después**. Con la primera versión, el dueño apretaba
"sí" sobre una propuesta que él mismo había pedido y le rebotaba.

**Regla:** todo cambio en la validación de una acción diferida tiene que contestar **qué
pasa con las que ya están en la cola**. La cola es estado viejo corriendo con código nuevo.

## 3. Se valida al proponer *y* al ejecutar, y no es duplicación

- **Al proponer** (`proponer_cambio_etapa`): para que MaKo pida el monto o el motivo **en
  la misma respuesta**, en vez de proponer algo que rebota después del "sí".
- **Al ejecutar** (`ejecutarAccion`): porque entre la propuesta y el "sí" **pasan horas** y
  el dato pudo cargarse o borrarse en el medio.

Los dos caminos llaman al mismo `veredictoRequisitos()`; lo que no puede pasar es que
contesten distinto. Sin poder leer el lead se manda `'validar'`, así `setPipelineStage`
**falla cerrado** en vez de mover a ciegas.

## 4. El botón sin motivo dejaba el motivo de la pérdida anterior

`lib/mako-confirmaciones.ts`, rama `op:<key>`: "Marcar Perdido" no trae motivo, así que la
salida se registraba con el motivo de una pérdida **anterior** o sin ninguno. Es la misma
herencia que se arregló del lado del validador (ver [hallazgos-crm.md](hallazgos-crm.md)
§3, "El motivo de pérdida se heredaba"), un nivel más arriba: el validador ya distingue
"motivo de ESTE movimiento", pero solo sirve si el caller **manda uno**. Hoy siempre lleva
el del `op` y, si no hay, uno armado con la regla y el título de la confirmación.

**Regla:** cuando el validador aprende a distinguir un dato nuevo, revisá **quién lo
manda**. Un caller que no lo manda pasa la validación con el dato viejo.

## 5. La hora que MaKo repite es display

`lib/mako-tools.ts:243` formateaba la hora de la R1/R2 en `America/Tijuana` — o sea, un
cliente en otro huso escuchaba a MaKo decirle la hora **del dueño**. Es display puro y se
migró a `tzActual()`, resuelto **una vez por listado, no por fila**.

**Regla:** lo que la IA le dice al cliente es UI. Todo lo que pasa por un `toLocaleString`
en `lib/mako-*` se trata igual que una card.

---

## 6. Lo que quedó sin hacer

| Qué | Dónde | Por qué |
|---|---|---|
| **No hay tool que escriba `fechaJ1`, `asistenciaR1/R2`, `calificado`, `fathom*` ni los `deal*`** | `lib/mako-doer-acciones.ts` (input_schema de las 11 tools) | Mientras no exista, mover a una etapa de reunión o de cierre desde WhatsApp se registra con `{ omitir }`: pasa, pero declarando qué quedó sin cargar. Si se agrega la tool, **sumar el `StepId` a `REQUISITOS_PEDIBLES` en el mismo commit** — si no, el canal sabe cargarlo y sigue sin pedirlo. |
| **`faltantesParaMover` decide con `hoyEnTijuana()` fijo** | `lib/leads.ts:1570` | Acá no es una cohorte persistida sino **gating**: decide si una reunión "ya pasó" y por lo tanto si se exige asistencia/Fathom. Para un workspace en Madrid el borde del día está ~9 h corrido, y eso hoy **bloquea o destraba a MaKo** un día antes o después. Ver [hallazgos-infra.md](hallazgos-infra.md) §2. |
