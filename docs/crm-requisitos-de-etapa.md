# Lo que frena o pide algo al mover un lead de etapa — inventario para revisar (27/10/2026)

Pedido de Martín (27/10/2026): «Tengo que ver todos los "forms" viejos que quedaron, como el del contrato o las agendas, para
actualizarlo». Lo obligatorio es **por dato** y lo decide él: esta lista es para que marque qué sigue, qué se va y qué pasa a
opcional. Medido leyendo el código de la rama `crm-chats-2710` (no la base).

## Lo primero: mover NO se bloquea

- **Tablero y ficha** (arrastrar, el desplegable de etapa, «Mover a…»): el lead se mueve siempre y lo que falta queda como
  **pendiente** («Datos sin marcar»). Regla del 17/09 («guardar nunca se bloquea»): `completeStageMoveAction` y
  `setLeadStageAction` en `app/crm/actions.ts` guardan primero y después calculan los pendientes.
- **Sí frenan** (el lead no se mueve):
  - **MaKo** (por chat o WhatsApp) sólo pide **monto** (a Ganado) y **motivo** (a Perdido / Descalificado); lo demás lo mueve
    igual y lo deja dicho (`lib/mako-doer-acciones.ts`, `REQUISITOS_PEDIBLES`).
  - **El CRM automático** (el cron que mueve solo) no mueve si falta algo, y lo anota en el historial (`moverLeadAuto`,
    `lib/leads.ts`).
  - **Un monto de 0** en una venta: tira «monto debe ser positivo» (`lib/lead-desenlace.ts`).
- **Lo que sí traba es el ASISTENTE** (la ventana de preguntas que se abre al mover a ciertas etapas): algunos pasos no dejan
  seguir hasta contestarlos. Está abajo, paso por paso. En todos (salvo «Completar datos») está «Guardar y completar después».

## Lo que se arregló hoy (27/10)

| Antes | Ahora | Dónde vive |
|---|---|---|
| **Contrato**: todo movimiento a Ganado o Facturando abría «¿Completamos el cierre con el contrato?» con «Subir contrato» (desde el tablero, aunque el contrato ya estuviera). No trababa, pero estaba siempre | **Se fue de los movimientos.** Queda sólo en «Completar datos» cuando se piden las secciones del deal; el contrato se sube y se lee en la ficha › Pagos | `app/crm/StageMoveDialog.tsx` (paso `dealAuto`) |
| **R1 / R2 con la reunión cargada a mano**: soltar en R1 abría igual «¿Ya la tuve / ya está agendada / agendarla por Calendly?», y desde la ficha el asistente **buscaba solo** en Calendly y Fathom; una reserva vieja de Calendly **pisaba** la fecha cargada a mano | Con la fecha ya cargada y sin marcar si se tuvo, **se mueve directo** (tablero y ficha). Sin fecha, se pregunta la fecha **a mano** y «Buscarla en Calendly» es un link. La fecha cargada a mano **gana** siempre | `app/crm/mover-etapa.ts` (`reunionYaCargada`), `app/crm/CrmBoard.tsx` (`handleDrop`), `lib/auto-reuniones.ts` |

## El inventario: cada cosa que el movimiento pide

Los requisitos se definen en UN lugar: `lib/stage-requirements.ts` (`stepsForStage`). El asistente es
`app/crm/StageMoveDialog.tsx` (la columna «¿Traba?» dice si el paso deja seguir sin contestarlo).

| Qué pide | A qué etapa | ¿Traba el asistente? | Dónde se define / dónde se pide |
|---|---|---|---|
| **Motivo** de pérdida o descalificación (categoría **y** detalle escrito) | Perdido, Descalificado | **Sí**, los dos | `stage-requirements.ts` · `StageMoveDialog.tsx` paso `motivo` |
| **Fecha de la Reunión 1** (hora opcional) | R1 y todas las de después (salvo «no hubo R1») | **Sí** | `stage-requirements.ts` · paso `fechaJ1` · en el tablero, el diálogo de Calendly (`CrmBoard.tsx`, sólo con el tipo de evento de la R1 cargado) |
| **¿Asistió a la R1?** (con «Reprogramar») | Desde R2, o cuando la R1 ya pasó | **Sí**; y en «Datos sin marcar» **no se puede ignorar** | `stage-requirements.ts` · paso `asistenciaR1` · `lib/datos-aviso.ts` (`NO_IGNORABLES`) |
| **¿Era calificado?** | Igual que la asistencia (no en las de venta) | **Sí** | paso `calificado` |
| **Grabación de la R1** (link de Fathom o «No se grabó») | Igual que la asistencia | **Sí** | paso `fathomR1` |
| **¿Hubo R1? / ¿Hubo R2?** y su motivo | Ganado o Facturando sin la fecha | **Sí** | `StageMoveDialog.tsx` pasos `huboR1` / `huboR2` |
| **Fecha de la Reunión 2** | R2 y después (funnels de dos reuniones) | **Sí** | paso `fechaJ2` |
| **¿Asistió a la R2? / grabación de la R2** | Facturando, Ganado, o la R2 ya pasó | **Sí** | pasos `asistenciaR2` / `fathomR2` |
| **¿Qué compró?** (el producto, con «Otro / personalizado») | Ganado, Facturando (si hay productos) | **Sí** (obligatorio desde agosto) | paso `producto` · `tests/crm-ganado-producto.test.ts` |
| **Tipo de venta y monto** (o la mensualidad; nada si es «Sin cobro») | Ganado (o la etapa de cierre del funnel) | **Sí**, monto > 0 | pasos `ventaTipo` / `monto` / `susPlazo` |
| **Plan de pagos** (las cuotas tienen que sumar el monto) | Ganado, pago único | **Sí** | paso `plan` |
| **Servicio, promesa, datos fiscales, obligaciones** | Sólo en «Completar datos» cuando se piden | **Sí**, si aparecen | pasos `deal*` · valores en `lib/leads.ts` |
| **Documento fiscal y comprobante de pago** | Ganado | No (salieron del asistente; quedan en la ficha) | `stage-requirements.ts` · tab Pagos |
| **Closer, setter, empresa, teléfono** | Nunca al mover; sólo «Completar datos» | Sí, si se piden | pasos de higiene |
| **Motivo y fecha límite** de la nutrición manual | Nutrición - Manual (desde el tablero) | **Sí**, los dos | `CrmBoard.tsx` (`openManualNutri`) |
| **¿Asistió? / ¿calificado?** para Meta | Al mover con la R1 ya pasada y sin marcar | No (opcional) | `app/crm/senales-meta.ts` · `MoverEtapaConfirm.tsx` |

## Lo que queda para que Martín decida (no se tocó)

- **«¿Qué compró?» obligatorio** en cada Ganado o Facturando, aunque el lead ya tenga producto.
- **El motivo de pérdida con detalle escrito obligatorio** (categoría sola no alcanza).
- **La asistencia a una reunión pasada no se puede ignorar** en «Datos sin marcar».
- **Las cuotas tienen que sumar el monto** para seguir en el paso del plan.
- **La nutrición manual pide motivo y plazo** desde el tablero, pero elegida desde la ficha no los pide (inconsistente).
- **El diálogo de Calendly** sólo sale para las etapas `agenda` / `agendaj2` con el tipo de evento cargado: una etapa de reunión
  propia, Cal.com o un evento vinculado no lo ofrecen (`app/crm/page.tsx`).
- **«Agendar» desde el tablero carga sólo la fecha, sin hora**, y deja una hora vieja de Calendly si la había (`setMeetingManual`).
