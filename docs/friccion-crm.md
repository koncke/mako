# Fricción del CRM

Cada momento en que el CRM interrumpe, pregunta o hace esperar. Relevado el 25/09 sobre
el código, con los números de la base de Mauricio (1.138 leads).

Orden: **lo que más molesta arriba** = cuán seguido aparece × cuánto cuesta atravesarlo.

---

## 1 · Lo que necesito que decidas — ✅ APLICADAS el 27/09, en la versión que CONSERVA la protección

Las tres salen de reglas que pediste vos, así que sacarlas es cambiar tu propia regla.
**La pregunta sigue abierta**: se aplicó lo que saca la fricción sin perder lo que cada
regla protegía, y si preferís la versión anterior es un cambio de una línea en cada una.

⚠️ **Y DOS DE LAS TRES PREGUNTAS TENÍAN LA PREMISA EQUIVOCADA.** Esto cambia la respuesta,
así que va antes que nada:

1. «el texto obligatorio, sabiendo que **nada lo lee**» → **sí lo lee alguien.** Va al
   historial del lead (se dibuja en su pestaña) y sale por la API de MaKo, o sea por
   WhatsApp y por la skill del cliente. Lo que no hay es un lector que DECIDA algo con él.
   Y la misma acción hecha por MaKo ya lo tenía opcional: **la app era más estricta que su
   propia API.** Por eso no se sacó el campo, se sacó el candado.
2. «cada arrastre pide confirmación» → las dos redes que la vuelven redundante existen y
   están medidas: el deshacer de 5 s **escribe en el server** (no revierte sólo la
   pantalla) y el movimiento queda en el historial. Quedó **condicional**: sigue
   apareciendo cuando hay algo que ofrecerle a Meta, que es el único momento en que esos
   dos datos se pueden dar.
3. «¿previsualización antes o deshacer después?» → la contestó el repo en todo lo demás.
   Va el deshacer, y también escribe en el server.

Y una que conviene saber: `undoStageMoveAction` **borra todo `lead_audit` de los últimos
90 s**, así que apretar «Deshacer» en el toast que el propio guardado dispara se lleva el
texto de la excepción que te acababa de obligar a escribir.

| Qué te frena hoy | Cuesta | La pregunta |
|---|---|---|
| **Agendar una reunión**: menú de 3 opciones + asistente de 3 pasos para mover un lead una columna. Si elegís «ya está agendada», te obliga a escribir por qué no usaste Calendly | 8 pantallas y ~10 clics por día | ¿El texto obligatorio lo querés como desincentivo, sabiendo que **nada lo lee**? |
| **Cada arrastre pide confirmación** (regla tuya, 06/08) | 5 pantallas y 5 clics por día | ¿Vale también para algo que ya se puede deshacer en 5 segundos y queda en el historial? |
| **Corregir un teléfono**: la ficha no deja editar nada, hay que ir a otra pantalla, prender «Editar», guardar y confirmar en un modal | 5 clics, 2 recargas, y perdés el scroll | ¿La previsualización del cambio la querés **antes** (modal) o **después** (deshacer)? |

---

## 2 · Me lo llevo sin preguntarte — ✅ APLICADA (tanda 1, `50df1cb2`)

Bugs y esperas que no protegen nada. **~3 clics y 5 pantallas trabadas por día.**

- El **«Revisando qué datos faltan…»** que tapa el asistente: no avanza, no vuelve, no se cierra.
- La pantalla **«✓ Datos actualizados»** al final: solo repite lo que acabás de hacer.
- **Escape cierra la ficha entera** y se lleva lo que estabas escribiendo. Un clic afuera, igual.
- El **número rojo que late para siempre** en Pendientes, y el punto rojo **repetido 3 veces** en la ficha.

---

## 3 · Sacar — ✅ APLICADA (tanda 2, `eb572aad`)

No protegen nada.

| Qué | Cada cuánto | Dónde vive |
|---|---|---|
| Dos pantallas cuya única acción posible es «no lo tengo» (documento fiscal, comprobante) | 9 de cada 10 Ganados | `StageMoveDialog.tsx` |
| Un pendiente **imposible de resolver**: «Respuestas de Calendly (R2)». Se exige hasta en etapas que no tienen R2 | **20 de tus 31 leads con R2** | `stage-requirements.ts` |
| 7 de las 8 pestañas de la ficha, en inglés | Siempre | `LeadSheet.tsx` |
| La pestaña **Notas** | 4 notas en toda la base, de todos los clientes | `NotasCard.tsx` |
| La pestaña **Deal Details** que solo dice que está vacía, con 3 redacciones distintas | **1.124 de 1.138 leads** | `LeadSheet.tsx` |
| El cartel que explica qué es una «ventana informativa» — jerga nuestra | Leads con reunión futura | `[id]/page.tsx` |
| «Este dato entrena las campañas de Meta (CAPI) y es la última vez que te lo podemos preguntar» | 26 leads hoy | `CrmBoard.tsx` |
| El rojo de la pantalla de Pendientes: el mismo color que «Perdido» y que los errores | Siempre | `CrmBoard.tsx` |
| Errores crudos que no se pueden cerrar ni resolver, y el chat del lead que falla sin reintentar | Cuando algo se cae | `ChatCard.tsx` |

---

## 4 · Cambiar de forma — ✅ APLICADA el 27/09/2026

La protección sirve; no tiene por qué frenar.

**Los diez están hechos** (commit `c72966b5`). Lo que se aprendió haciéndolo está en
[hallazgos-crm.md](hallazgos-crm.md) — sobre todo el del Excel, donde el comentario que
explicaba por qué no se podía había dejado de ser cierto semanas antes, y el del botón de
exportar, que afirmaba «no hay nada para bajar» mientras todavía estaba contando.

Dos cosas quedaron a propósito distintas de lo relevado:

- **El pop-up de WhatsApp se queda; lo que se fue es el SONIDO.** La columna de «qué se
  rompe» decía «un mensaje no se ve hasta abrir la tab», y eso sigue siendo verdad: el
  contador de la sidebar es más chico que un aviso. Se saca lo que no se puede ignorar
  —el beep con cada mensaje entrante— y se deja lo que informa. Si igual molesta, es un
  `dejaVer('wa-mensaje')` y sale.
- **El Excel NO necesitó una dependencia nueva.** Esa nota estaba equivocada: el lector
  ya estaba en el repo desde el importador del plan.

| Qué | Cada cuánto | Qué se rompe si se saca |
|---|---|---|
| Entrar al CRM: pantalla vieja, sin esqueleto, hasta que terminan **tres olas** de consultas que ni corren en paralelo | Cada entrada y después de **cada cambio** | Nada. Ojo: esa pasada es la que cierra el historial de etapas sin cron — hay que mudarla, no perderla |
| El tablero abre con **1.138 tarjetas**; el pipeline que trabajás son ~34 | Siempre | ⛔ **Probado y REVERTIDO el 27/09**: arrancaba solo con Activo y Martín lo devolvió — «que estén siempre activos». El diagnóstico sigue en pie; el remedio no |
| El asistente pregunta si querés que busque solo | Cada «Solucionar» con reunión | Nada: **ya engancha Fathom solo** en cada carga |
| «Ignorar» un aviso pide una confirmación de 3 renglones sobre algo reversible | Seguido: 21 leads ignorados | Cambiarla por «hecho · deshacer» conserva la red |
| Cada fila del worklist es un párrafo; «Ignorar todos» son 44 palabras | Siempre | El detalle **tiene que seguir en el dato** o «Marcar en lote» pierde esos leads |
| El cartel de costo de IA **tapa** la tarjeta de MaKo, abajo a la derecha | Todo el día | Nada: el gasto sigue en Integraciones |
| Pop-up **con sonido** de WhatsApp encima del tablero | Con cada mensaje | Un mensaje no se ve hasta abrir la tab |
| «+ Nuevo lead» se lleva la pantalla entera y al volver perdés filtro y scroll | Cada alta a mano | Nada; todo el resto del CRM ya son modales |
| Un Excel se rechaza y te manda a convertirlo a CSV (un PDF escaneado sí lo lee) | Cada lista que llega en Excel | Hay que sumar una dependencia |
| Exportar: el botón queda gris mientras cuenta, y el formato se pregunta siempre | Cada exportación | El conteo avisa si un filtro dejó afuera media base |

---

## 5 · Mantener

| Qué | Por qué |
|---|---|
| Las dos preguntas de Meta al mover (¿asistió? ¿calificado?) | Son los **únicos dos datos** que le llegan a Meta. Ya son opcionales: el botón mueve igual |
| El motivo de la pérdida, escrito a mano | Es el único dato que **solo lo tenés vos**. ✅ *Sus dos pantallas ya son una (27/09): los chips y el detalle se responden juntos, y el detalle sigue siendo obligatorio* |
| La fecha límite de «Nutrición - Manual» | El plazo **ES** la etapa: sin fecha el lead queda invisible para siempre |
| La confirmación antes de generar Insights | Gasta plata de IA, y son dos llamadas encadenadas |
| Subir el comprobante al marcar una cuota | Da la fecha **real** del cobro. Ya se puede saltear |
| La pantalla final del reagendado | Cuenta algo que no se sabía al confirmar: si Google movió el evento |

---

## 5.b · Lo único que queda abierto, y es una decisión de producto

**Un formulario inalcanzable con una columna huérfana detrás.** El paso `r2Motivo` de
`StageMoveDialog` sólo se dibuja si los requisitos piden `r2Respuestas`, y desde la tanda 2
eso no lo emite nadie: el paso está muerto. Era el **único camino de UI** que escribía
`r2_agenda_externa_motivo` — y esa columna SÍ se lee, como exención permanente del
requisito de R2 (`lib/leads.ts`, el `||` de `r2RespuestasOk`). Hoy ese `||` es letra muerta
para todo lead nuevo.

No se toca sin decidirlo, porque las dos salidas son opuestas: **borrar** el paso y la
exención (y entonces nadie puede volver a eximir a un lead), o **devolverle un camino** a
esa columna. Lo que no puede quedar es lo de hoy: un formulario al que no se llega con una
columna que el código sigue consultando.

---

## 6 · Tres cosas que no son fricción, pero conviene saber

- **1.057 leads están en la columna equivocada**: tienen etapas que tu funnel ya no contiene
  (`reactivacion`, `noshow_r1`, `noshow_r2`) y el tablero los tira a la primera columna.
  **Al 27/09 ya no miente y ya no crece**: cada uno lleva un chip punteado que dice dónde
  está de verdad («Reactivación · fuera del embudo»), y el CRM automático dejó de escribir
  etapas que el embudo del workspace no tiene — antes lo hacía sin mirar, y el `update` de
  Postgres es válido, así que el motor reportaba que movía y el tablero mostraba otra cosa.
  ⚠️ **Lo que sigue siendo una decisión tuya:** qué hacer con los 1.057 que ya están. Se los
  puede dejar marcados donde caen, migrarlos a una etapa del embudo actual, o devolverle al
  embudo esas tres etapas. Mover 1.057 leads no se hace sin que alguien lo pida.
- De **66 confirmaciones** del CRM automático que resolviste, **35 las deshiciste**. Lo que
  hasta ayer te bloqueaba la entrada acierta poco más de la mitad de las veces.
- **Ya no hay ningún modal bloqueante en la puerta del CRM** (se sacó el 25/09). El panel de
  activación y el onboarding obligatorio nunca te aparecen: tu workspace está exento.
