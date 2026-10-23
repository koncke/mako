# Feedback de la llamada «Mau <> Martin» del 22/10/2026

- **Fuente:** Fathom 195129619 (https://fathom.video/calls/871165870), 2 h 33 min.
- **Transcript entero:** `C:/dev/cerebro-herramientas/llamada-mau-22-10.txt`. Fathom confunde a veces quién habla.
- **Calendario:**
  - **hoy 22/10 hay reunión** con Mauricio para validar los arreglos;
  - **el sábado 24/10 empiezan a salir los mensajes**, 50 por día, hasta el viernes 13/11 (21 días corridos para 1.050 leads);
  - el Sprint pasó al 24-26/11.
- **Lo que traba el lanzamiento es lo marcado P0.** Tiene que estar en producción antes de la reunión de hoy.

## CRM → chat «CRM»

| # | Min | Qué | Prio |
|---|-----|-----|------|
| C1 | 26:00-28:23 | **«Traer de otro funnel» (en «Nuevo lead» de la columna):** son tres arreglos. (a) El botón de agregar obliga a bajar hasta el fondo y tiene que estar siempre a la vista. (b) Muestra «300 de 1050, buscá o filtrá para ver el resto»: tiene que poder traer los 1.050, con un «seleccionar todos» que agarre todos los que matchean el filtro y no sólo los 300 que se ven. (c) Los que ya están en este CRM siguen apareciendo, en gris, y no dejan ver los 300 siguientes: no tienen que aparecer. | **P0** |
| C2 | 02:13:00-02:14:40 | **Varios leads tildados y arrastrados con el mouse a otra etapa tienen que moverse TODOS.** La barra de acciones en lote ya anda. Mauricio va a mover 50 por día a «Prospección activa» así. Además, la cajita que aparece al pasar el cursor junto a la foto no se entiende para qué es. | **P0** |
| C3 | 04:32-04:50 | **Mover un lead de etapa tarda.** La tarjeta se queda en la etapa vieja mientras carga. Tiene que moverse al instante (optimista) o mostrar un loader. | P1 |
| C4 | 19:30 | **Crear una etapa nueva tarda mucho y no hay loader.** | P1 |
| C5 | 16:15 | **«Editar» del CRM (el botón en «3 días»):** el desplegable de CRMs queda POR ENCIMA del pop-up. Es un z-index. | P1 |
| C6 | 24:31-24:44 | **Los tres puntos de «Lead entrante» lo mandaron a otro lado** («te llevo a otro lugar»). Reproducirlo. | P1 |
| C7 | 10:00 | **Las pestañas de la ficha del lead están escondidas** en el desplegable de «Resumen ▾». Mauricio no encontraba «Pagos». Tienen que verse. | P1 |
| C8 | 22:29-24:01 | **R1 del funnel high ticket:** cuando un lead del Sprint pasa a R1 del CRM principal, la ficha tiene que mostrar de dónde vino (el webinar/Sprint o un anuncio). | P2 |
| C9 | 25:11 | «Nuevo lead» está debajo de los tres puntos. Ya está pedido el 21/10: va DENTRO de los tres puntos de la columna. | (en curso) |

## Pagos y Cobros → chat nuevo «Cobros»

| # | Min | Qué | Prio |
|---|-----|-----|------|
| P1 | 05:00-09:00, 12:39 | **El dashboard de Cobros sólo lee el funnel original (VSL)**, no el de renovaciones ni el low ticket. Falta un selector de qué CRM o CRMs lee Cobros. Mauricio tiene clientes de renovación que ya le pagaron y no los ve. | P1 |
| P2 | 10:00-12:19 | **Ficha → Pagos en el CRM de renovaciones muestra el plan del PRIMER servicio:** «cuota 1 cobra el 01/04», datos de cuando ese cliente pagó la primera vez. Los pagos tienen que ser independientes por CRM/servicio: cuando un cliente entra a un CRM nuevo (una renovación), el plan de pagos arranca de cero. Ojo con no romper lo que ya cobró. | P1 |
| P3 | 11:41-11:48 | **Las fechas «01/04» no se entienden** (¿día/mes?). Tienen que decir «4 de octubre». | P1 |

## Offer → chat nuevo «Offer»

| # | Min | Qué | Prio |
|---|-----|-----|------|
| O1 | 01:42:50-01:46:05 | **El diagnóstico inventa datos de OTRO funnel:** «solo dos ventas de 24 asistentes», «cuello de botella crítico en la conversión de llamadas». El Sprint tiene cero ventas. Una oferta nueva sin datos tiene que decirlo, y los números salen sólo del funnel de ESA oferta. Es grave, porque este contexto es el que usa MaKo para prospectar. | **P0** |
| O2 | 01:44:37-01:44:50 | **«Tienes seis ofertas activas en MaKo»: falso.** | **P0** |
| O3 | 01:43:55-01:44:03 | **Puso «por Zoom»** y nadie dijo Zoom (es Meet u otra plataforma). No tiene que inventar hechos. | P0 |
| O4 | 01:10:49 | **Volvió a preguntar «¿es pago único?»**, que ya había preguntado. | P1 |
| O5 | 43:11 | **Saluda de nuevo en cada mensaje.** | P1 |
| O6 | 44:45 | **Tarda muchísimo** en procesar una respuesta y hacer la siguiente pregunta. Medirlo. | P1 |
| O7 | 31:44-32:24 | **No puede leer la landing** sprint.mauriciobustos.com: «No se pudo abrir la página, la página está bloqueada, lectura automática». ChatGPT sí la lee. Mauricio habló con el hosting y le pasaron una recomendación por WhatsApp a Martín; pedírsela a Martín si hace falta. | P1 |
| O8 | 33:06-36:58 | **Subir el .zip de la landing o una CARPETA no anduvo** («porque es una carpeta, creo que no se puede»): sólo entró el index. Tiene que aceptar un .zip, extraer el html y el texto, y explicar qué leyó. | P1 |
| O9 | 39:44-40:18 | **Mientras analiza muchos documentos, tiene que decir «los analizo y te aviso cuando termine»**, dejar seguir usando la app y avisar al terminar por el grupo de WhatsApp de MaKo y/o con una notificación en la app. | P1 |
| O10 | 56:01-56:27 | **El micrófono no muestra que está grabando.** Mauricio no sabía si grababa y tuvo que borrar y repetir. Si el mic es el de la caja compartida del Ops Center, se lo paso al chat «Ops Center»: avisar antes de tocarlo. | P1 |
| O11 | 01:49:30-01:49:38 | **El PDF que entregó «está muy raro».** Revisar cómo se arma. | P1 |
| O12 | 29:00-29:28 | **El selector de oferta confunde:** había que entrar al desplegable, tocar «Negocio que escala», volver atrás y recién ahí aparecía «Sprint». Hacerlo obvio. | P1 |
| O13 | 01:49:58 | Al terminar, «¿cuál es el propósito?». Al cerrar el análisis tiene que decir qué hace MaKo con esto: usa el contexto para prospectar. | P2 |

## Automations → chat «Automations»

| # | Min | Qué | Prio |
|---|-----|-----|------|
| A1 | 02:05:44-02:10:10 | **El chat de MaKo no armó la secuencia.** Armó dos WhatsApp. Al pedirle que agregue los textos pegados, contestó «indícame qué cambios…», y después «hizo cualquier cosa»: una tarjeta con un audio «Sprint de audio» y una variable que no existe. Con un pedido explícito tiene que OBEDECER y armar exactamente esos mensajes. | **P0** |
| A2 | 02:09:04 | **Modos «Discutir» y «Editar» en el chat, como Lovable.** Discutir sugiere sin tocar el lienzo; Editar hace exactamente lo que se pide. | **P0** |
| A3 | 02:11:00-02:15:21 | **Goteo:** al pasar 50 leads a «Prospección activa», que no salgan juntos: uno, esperar 4-5 min, el siguiente. Tiene que ser configurable por automatización: minutos entre envíos, tope por día (50) y días de la semana. El plan cuenta 21 días corridos del sáb 24/10 al vie 13/11, con fin de semana. Hoy el tope es de la LÍNEA, 40/día con 6 reservados, o sea 34 para una campaña: no llega a 50. | **P0** |
| A4 | 01:51:13-01:53:01 | **No hay plantilla de prospección:** «apertura a una lista que muevo a una etapa». Mauricio buscó y no encontró ninguna que sirva. | P1 |
| A5 | 01:57:58 | **MaKo dijo «esta etapa no existe»** justo después de crear «Prospección activa» en el CRM. ¿El chat ve las etapas viejas (cache)? | P1 |
| A6 | 02:10:16 | **Martín: «voy a dejar lista la automatización».** Dejarla armada y PAUSADA en el ws1, en el CRM «3D»/Sprint, con disparador «entra a Prospección activa» y la secuencia honesta de `campana-sprint-mauricio.md`, para validarla hoy. El «ya me llegó tu pago» NO se arma (es engañoso). | **P0** |
| A6 (corrección) | 23/10 | Corregido el 23/10 por Martín: es a propósito, la técnica de levantamuertos (confirmar un pago para después disculparse, sólo para que respondan el primer mensaje). No se marca ni se toca. | |
| A7 | 14:46-15:41, 02:19:50 | Después de «Ganado»: el link del grupo de WhatsApp (Mauricio lo pasa) y la nutrición en el grupo hasta el evento. Se ve en otra reunión: anotarlo. | P2 |

## Ops Center (pedido del 21/10 22:54, no de la llamada)

- **La computadora entra al Ops Center.** Está en la rama `inicio-ops-center` @56ffe0f60.
- **El teléfono sin «Reload» y con la animación de MaKo.** Está en la rama `movil-carga-sin-error` @6662984de.
- Las dos están hechas y esperan VERDE. Pasan a Integración.

## Lo que hace Mauricio (no es código)

- Crear el grupo de WhatsApp del Sprint y pasar el link.
- Cambiar la fecha de la landing al 24-26/11.
- Ajustar los precios de los bonos.
- Sin upsells por ahora.
- (Comentó que no usó el Web Generator «porque no tenía crédito»).
