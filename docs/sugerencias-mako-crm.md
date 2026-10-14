# Sugerencias de MaKo en el CRM: qué propone y qué la dispara

Lo pediste el 13/10/2026: «mapees todas las que se te ocurran y me las digas… ¿Qué dispara la
sugerencia?». Esto es el mapa para que lo valides **antes** de construirlo. Nada de esto existe
todavía.

## Cómo se ve

- El chat de MaKo al costado del CRM, el mismo de Automations, **siempre plegado**.
- Cuando MaKo tiene una sugerencia, el chat plegado muestra un punto con el número.
- Cada sugerencia es **una línea** y dos botones: **«Hacerlo»** y **«Ahora no»**.
- «Hacerlo» abre el chat con la automatización ya armada (por el mismo camino que «Crear con
  IA») y, si hace falta, crea la etapa que falta. Queda **sin publicar** hasta que la publiques.
- «Ahora no» la calla 30 días para ese CRM.

## Qué la dispara: cuatro clases de disparo

| Clase | Cuándo se mira | Ejemplo |
|---|---|---|
| **1. Armás el CRM** | en el momento, una sola vez por etapa | creás una etapa de reunión |
| **2. Repetís un gesto** | al hacer el gesto, contando tu historial de 14 días | movés a mano 5 leads de A a B |
| **3. El tablero llega a un estado** | una vez por día | 34 leads parados en «Lead entrante» |
| **4. Llega algo nuevo** | cuando llega | el primer lead de un formulario que no estaba conectado |

**Lo que la vuelve personalizada** (no es lo mismo un VSL que prospección):

- **El tipo de CRM**: cómo vendés (llamada, chat, carrito, webinar, presencial) y cómo te llega
  la gente (landing, solo agenda, chat entrante, prospección, carrito). Las dos ya están
  guardadas en cada CRM.
- **Lo que tenés conectado**: Calendly o Cal, Fathom, WhatsApp, Stripe o Mercado Pago. Sin
  WhatsApp no te propone un mensaje por WhatsApp.
- **Lo que ya tenés armado**: nunca te propone una automatización que ya existe.
- **Tus números**: los umbrales («parados hace más de N días») cambian según el tipo de CRM.

## 1. Mientras armás el CRM

| Disparo | Qué te propone | Para qué CRM |
|---|---|---|
| Creás (o marcás) una etapa de **reunión** | Recordatorio antes de la reunión y marcar solo si asistió (con la grabación de Fathom) o si fue No show. Atado al **evento** de Calendly o Cal de esa etapa | llamada, webinar, presencial |
| Creás un CRM que entra por **landing** | Nutrición a los que dejan datos y no agendan, y la etapa «No agenda» si no está | VSL |
| Creás un CRM de **prospección** | Seguimiento a los que no responden (a los 2 y 5 días) y pasarlos a Perdido a los 10 | prospección |
| Creás un CRM de **webinar** | Recordatorio del webinar y la grabación a los que no fueron | webinar |
| Creás la etapa de **pago** | Cobrar con link y mover el lead solo cuando paga | llamada, carrito |
| Creás o usás **Ganado** | Bienvenida al cliente, invitarlo al curso si el producto tiene clases y pedirle los datos fiscales | todos |
| Creás **Perdido** | Pedir el motivo y volver a escribirle a los 30 días | todos |

## 2. Cuando repetís un gesto

| Disparo | Qué te propone |
|---|---|
| Movés a mano **5 o más leads** de la misma etapa A a la misma B en 14 días | «Hace 5 veces que movés de A a B. ¿Lo hago solo?». Si los cinco tenían algo en común (la reunión ya pasó, contestaron, pagaron), lo usa como condición |
| Mandás **el mismo mensaje** a 3 o más leads de una etapa | Dejarlo como secuencia de esa etapa |
| Marcás **No show** a mano 3 veces | Mensaje para reagendar a los No show |
| Pegás el **link de Fathom** a mano 3 veces | Conectar Fathom para que lo enganche solo |

## 3. Cuando el tablero llega a un estado

| Disparo (se mira una vez por día) | Qué te propone |
|---|---|
| Leads **parados en «Lead entrante»** más de N días (N: 2 en chat, 3 en landing, 7 en llamada) | «Tenés 34 leads parados. ¿Los reactivo?». Crea la etapa de reactivación si no la tenés, la automatización, y los mete |
| **Reuniones que ya pasaron** sin marcar asistencia (5 o más) | Marcarlas solo con Fathom |
| **No show** acumulados sin ningún mensaje después | Escribirles para reagendar |
| Una etapa donde **se te cae más gente** que en las otras (la mitad o más no avanza) | Probar un recordatorio o un mensaje en esa etapa |
| **Ganados sin cobro** registrado, o cuotas vencidas | Recordatorio de cuotas |
| **Perdidos hace 60 a 90 días** | Volver a escribirles con la oferta de hoy |
| **Nutrición manual vencida** (3 o más) | Pasarlos a reactivación |

## 4. Cuando llega algo nuevo

| Disparo | Qué te propone |
|---|---|
| El **primer lead** de un formulario o una landing que no estaba conectado a ningún CRM | Conectarlo a uno |
| El **primer DM** de Instagram o Messenger | Que MaKo los conteste |
| Un lead que **vuelve a la landing** o mira el VSL dos veces | Avisarle al closer |

## Lo que necesito que decidas

1. **¿Te sirve esta lista?** Sacá las que no y sumá las que falten.
2. **Los umbrales** de arriba (5 gestos, 14 días, N días parados) ¿están bien para arrancar?
3. **«Hacerlo» deja la automatización sin publicar** (vos la publicás). ¿O preferís que quede
   prendida al aceptar?

Lo que depende de Automations (las acciones de mover etapa, el evento de Calendly o Cal por
etapa de reunión, las plantillas) se lo pedí a ese chat el 13/10.
