# Fricción del CRM

Cada momento en que el CRM interrumpe, pregunta o hace esperar. Relevado el 25/09 sobre
el código, con los números de la base de Mauricio (1.138 leads).

Orden: **lo que más molesta arriba** = cuán seguido aparece × cuánto cuesta atravesarlo.

---

## 1 · Lo que necesito que decidas

Las tres salen de reglas que pediste vos, así que sacarlas es cambiar tu propia regla.

| Qué te frena hoy | Cuesta | La pregunta |
|---|---|---|
| **Agendar una reunión**: menú de 3 opciones + asistente de 3 pasos para mover un lead una columna. Si elegís «ya está agendada», te obliga a escribir por qué no usaste Calendly | 8 pantallas y ~10 clics por día | ¿El texto obligatorio lo querés como desincentivo, sabiendo que **nada lo lee**? |
| **Cada arrastre pide confirmación** (regla tuya, 06/08) | 5 pantallas y 5 clics por día | ¿Vale también para algo que ya se puede deshacer en 5 segundos y queda en el historial? |
| **Corregir un teléfono**: la ficha no deja editar nada, hay que ir a otra pantalla, prender «Editar», guardar y confirmar en un modal | 5 clics, 2 recargas, y perdés el scroll | ¿La previsualización del cambio la querés **antes** (modal) o **después** (deshacer)? |

---

## 2 · Me lo llevo sin preguntarte

Bugs y esperas que no protegen nada. **~3 clics y 5 pantallas trabadas por día.**

- El **«Revisando qué datos faltan…»** que tapa el asistente: no avanza, no vuelve, no se cierra.
- La pantalla **«✓ Datos actualizados»** al final: solo repite lo que acabás de hacer.
- **Escape cierra la ficha entera** y se lleva lo que estabas escribiendo. Un clic afuera, igual.
- El **número rojo que late para siempre** en Pendientes, y el punto rojo **repetido 3 veces** en la ficha.

---

## 3 · Sacar

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

## 4 · Cambiar de forma

La protección sirve; no tiene por qué frenar.

| Qué | Cada cuánto | Qué se rompe si se saca |
|---|---|---|
| Entrar al CRM: pantalla vieja, sin esqueleto, hasta que terminan **tres olas** de consultas que ni corren en paralelo | Cada entrada y después de **cada cambio** | Nada. Ojo: esa pasada es la que cierra el historial de etapas sin cron — hay que mudarla, no perderla |
| El tablero abre con **1.138 tarjetas**; el pipeline que trabajás son ~34 | Siempre | Nada. Arrancar con nutrición y salidas apagadas; el botón ya existe |
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
| El motivo de la pérdida, escrito a mano | Es el único dato que **solo lo tenés vos**. *(Sí se pueden juntar sus dos pantallas en una)* |
| La fecha límite de «Nutrición - Manual» | El plazo **ES** la etapa: sin fecha el lead queda invisible para siempre |
| La confirmación antes de generar Insights | Gasta plata de IA, y son dos llamadas encadenadas |
| Subir el comprobante al marcar una cuota | Da la fecha **real** del cobro. Ya se puede saltear |
| La pantalla final del reagendado | Cuenta algo que no se sabía al confirmar: si Google movió el evento |

---

## 6 · Tres cosas que no son fricción, pero conviene saber

- **1.057 leads están en la columna equivocada**: tienen etapas que tu funnel ya no contiene
  (`reactivacion`, `noshow_r1`, `noshow_r2`) y el tablero los tira a la primera columna.
- De **66 confirmaciones** del CRM automático que resolviste, **35 las deshiciste**. Lo que
  hasta ayer te bloqueaba la entrada acierta poco más de la mitad de las veces.
- **Ya no hay ningún modal bloqueante en la puerta del CRM** (se sacó el 25/09). El panel de
  activación y el onboarding obligatorio nunca te aparecen: tu workspace está exento.
