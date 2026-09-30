# Feature: CRM — qué falta en cada tarea abierta (30/09/2026)

Las 25 abiertas, revisadas contra el código por un lector independiente cada una.
**Ninguna es cerrable.**

| | |
|---|---|
| hecha (cerrable) | **0** |
| a medias | **19** |
| sin empezar | **6** |

La sensación de «hay muchas que ya están» es correcta sobre el **trabajo** y equivocada
sobre las **tarjetas**: lo que falla es el título, que sigue nombrando el trabajo entero.

## A medias — una mitad hecha de verdad

| # | Tarea | Qué falta |
|---|---|---|
| 6 | Salvar los datos de Meta | La atribución se guarda. Faltan las **respuestas del formulario** (no hay dónde: `lead_respuestas` es de Calendly) y la fecha de origen |
| 697 | Registrar mensualidad cobrada | Que asiente el cobro (pagado + fecha) en vez de agendar la cuota siguiente. Hoy el guardado **descarta toda cuota pagada** |
| 702 | Guardar el origen del lead | Estamparlo en las tres altas (WhatsApp, importación, manual) y que la tabla del CRM lo muestre |
| 671 | Agendar la Junta 2 | El botón en la **ficha del lead** con día, hora y evento. Hoy sólo existe en el tablero y para una reunión que ya pasó |
| 696 | Leads de la landing al CRM | Que instalar el script valga como declarar la entrada: hoy si nadie tildó «landing», el lead **se descarta** |
| 701 | Clics y scroll en la ficha | Los clics se leen y se descartan una línea antes de la pantalla. El scroll **no se mide en ningún lado** |
| 37 | Datos del trato + tracking | Filtrar los eventos de video **en la query** (hoy recorta 120 por tabla antes) y avisar cuando la lectura falla |
| 627 | Rediseño de funnels | Métricas de conversión por producto, y que la nutrición respete el funnel del lead |
| 621 | Mapeo del apellido en CSV | Todo el título: el parser **no busca ninguna columna «Apellido»**. Lo hecho es la parte de duplicados |
| 698 | Alerta fiscal sutil | El aviso sutil ya está. Falta el interruptor **«este negocio no factura»** |
| 39 | Setter, closer y foto | Dos de tres están. Falta traer el **asignado de Chatwoot** y el relleno retroactivo de los leads viejos |
| 174 | Calendly no entra nada | La signing key está cerrada. Faltan: R1/R2 obligatorios, que el descarte avise, y el copy viejo en pantalla |
| 332 | Fathom + IA post-reunión | Que MaKo **complete las respuestas** con lo que salió en la llamada, sola y marcando quién respondió qué |
| 623 | Enriquecer duplicados | La detección está. El enriquecimiento **no existe**: hoy el duplicado se omite y el dato nuevo se pierde |
| 689 | Detección de Fathom | Enganchar la grabación del lead **sin email** (nombre + fecha), y que el fallo avise en vez de devolver cero |
| 18 | Follow-ups post-llamada | La tanda «No Compró» escrita y prendida, y poder mandar el borrador desde el inbox **oficial** |
| 40 | Timeline desde el funnel | Las reglas ya salen del funnel. La **línea de tiempo y el motor** siguen clavados en R1/R2 |
| 15 | Piloto del CRM automático | La regla que lee el contrato (T5), que el planificador use las etapas del cliente, y **correr el piloto** |
| 626 | Duplicados por teléfono | Hecho en el CRM. Falta en los webhooks de **Meta, Calendly y Cal.com**, que comparan el teléfono exacto |

## Sin empezar

| # | Tarea | Estado |
|---|---|---|
| 38 | Reuniones automáticas | La R2 sigue pisando el link de la R1, y el buscador no lee las grabaciones |
| 798 | Tableros con el funnel del cliente | `getFunnelEtapas` sigue armando las 8 etapas a mano |
| 19 | Cobranza por WhatsApp | El motor no lee la tabla `pagos` ni una vez. Y falta **decidir la cadencia** — es de Mauricio |
| 800 | SLA por etapa | No hay campo de plazo ni marca de cuándo el lead entró a su etapa |
| 622 | Ganados en el CSV | El importador lee cuatro columnas y el alta no puede nacer en «ganado» |
| 20 | Unificar las dos bases | De las tres promesas no hay ninguna |

## Lo que salió de paso, y es lo que más urge

Siete agujeros que nadie había reportado, todos medidos. El detalle está en
[hallazgos-crm](hallazgos-crm).

- **La nutrición no mira el funnel.** `nutricion_secuencias.funnel_id` existe desde la
  migración 0170 y no la lee nadie: con dos embudos vivos, **el mensaje sale del
  equivocado**. Es el único que le llega a una persona.
- **Fathom pisa la R1 con la R2** y avisa «adjuntados: 2» igual.
- **Meta, Calendly y Cal.com** comparan el teléfono exacto: el mismo número con prefijo
  entra como lead nuevo, sin aviso.
- **El tracking devuelve vacío cuando falla**, o sea «no pude leer» dibujado como «no vio
  el VSL».
- **Las respuestas del formulario de Meta se tiran** y no hay dónde guardarlas.
- **`originChannel` se calcula y no lo dibuja nadie.**
- **`saveCuotasAction` descarta toda cuota marcada como pagada.**
