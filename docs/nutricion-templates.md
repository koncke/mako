# Templates de WhatsApp — Nutrición VSL funnel

Set completo de plantillas para cargar en Meta (vía Chatwoot → inbox "Whatsapp Mauricio").
Fuente de verdad: este archivo. Cuando Meta apruebe, se cargan los nombres en
`nutricion_secuencias.pasos` y el motor (`/api/cron/nutricion`) las dispara.

## Reglas aplicadas (correcciones de compliance)

- **Una sola variable `{{nombre}}`** en todas (es lo único garantizado en la tabla `leads`; el motor hoy pasa solo el nombre). Se quitaron variables que no existen (`{{nombre_empresa}}`, `{{area_critica}}`, etc.).
- **CTA en el cuerpo como texto** (link de Calendly), sin botón — evita el rechazo por "CTA duplicada" y es consistente con los templates ya aprobados.
- **Idioma**: `es_MX`. **Link CTA**: `https://calendly.com/mauriciobustoseguia/60min`.
- **Categoría**: `utility` solo para recordatorios/confirmaciones de una cita o transacción real; `marketing` para todo lo de re-enganche/venta. Meta rechaza/pausa el marketing disfrazado de utility — **si dudás, mandá como marketing**.

> Nota: al cargar cada template en Meta, el nombre debe ir en snake_case (como acá). Si Mauricio renombra alguno, pasame el nombre final y lo enchufo al motor.

---

## 1. form-sin-agenda · MARKETING
**Trigger**: instant form de Meta, sin agendar. **Cadencia**: 3 toques (día 0, 1, 3).

**`nutri_form_1`**
> Hola {{nombre}}, soy Mauricio Bustos. Completaste el formulario porque querés que tu empresa crezca sin depender de vos en todo. Te ofrezco una sesión de 30 min sin costo para diagnosticar qué te está frenando — no es venta, es análisis. Agendá acá: https://calendly.com/mauriciobustoseguia/60min

**`nutri_form_2`**
> {{nombre}}, un dato: la mayoría de los dueños que nos contactan tienen crecimiento pero no les alcanza el tiempo. Eso no se arregla con más marketing, sino con estructura, ritmo de ejecución y accountability. En 30 min de diagnóstico vemos exactamente qué te frena: https://calendly.com/mauriciobustoseguia/60min

**`nutri_form_3`**
> {{nombre}}, te lo dejo por última vez: tengo algunos espacios esta semana para diagnósticos sin costo, de 30 min. Si después ves que hay un fit, hablamos; si no, al menos te llevás un análisis fresco de tu negocio. Acá el link: https://calendly.com/mauriciobustoseguia/60min

## 2. vio-vsl-sin-agendar · MARKETING
**Trigger**: tiene `visitor_id`, vio el VSL (≥50%), sin agendar. **Cadencia**: 2 toques (día 1, 4).

**`nutri_vsl_1`**
> Hola {{nombre}}, soy Mauricio. Vi que miraste el video sobre el Sistema DOS™. ¿Querés agendar tu Diagnóstico Estratégico sin costo para ver cómo aplicarlo en tu empresa? Tengo lugares esta semana: https://calendly.com/mauriciobustoseguia/60min

**`nutri_vsl_2`**
> {{nombre}}, una última cosa. Muchos dueños que vieron ese video descubrieron cómo sistematizar su operación y crecer sin estar en cada decisión. ¿Vemos en 30 min si te aplica? Sin costo y sin compromiso: https://calendly.com/mauriciobustoseguia/60min

## 3. vio-poco-vsl · MARKETING
**Trigger**: tiene `visitor_id`, vio el VSL pero <30%, sin agendar. **Cadencia**: 2 toques (día 1, 4).

**`nutri_vslcorto_1`**
> Hola {{nombre}}, soy Mauricio. Vi que entraste a la landing pero no llegaste a ver el video completo. En 23 min muestra exactamente cómo ordenar tu empresa para que crezca sin depender de vos. Y si preferís ir directo al grano, agendá un diagnóstico de 30 min sin costo: https://calendly.com/mauriciobustoseguia/60min

**`nutri_vslcorto_2`**
> {{nombre}}, si el video no es lo tuyo, vamos directo: una reunión de 30 min, sin costo, donde sacamos un diagnóstico estratégico de tu negocio en vivo. ¿Te late? https://calendly.com/mauriciobustoseguia/60min

## 4. agendado-sin-confirmar · UTILITY
**Trigger**: agendó (`fecha_agenda`) pero no confirmó asistencia. **Cadencia**: 2 toques (1 día post-agenda, 1 día antes de la cita).

**`conf_agenda_1`**
> Hola {{nombre}}, soy del equipo de Mauricio Bustos. Tenés agendado tu Diagnóstico Estratégico con nosotros. ¿Me confirmás que vas a poder asistir? Si necesitás reprogramar, podés hacerlo acá: https://calendly.com/mauriciobustoseguia/60min

**`conf_agenda_2`**
> {{nombre}}, te recordamos tu Diagnóstico con Mauricio. ¿Seguís confirmado? Si cambió algo, reprogramá sin problema acá: https://calendly.com/mauriciobustoseguia/60min

## 5. no-show-j1 · UTILITY
**Trigger**: tenía J1 y no asistió (`asistio_j1=false`). **Cadencia**: 2 toques (a las ~2h, +1 día).

**`noshow_j1_1`**
> Hola {{nombre}}, soy Mauricio. No pudimos conectar en tu Diagnóstico de hoy — sin drama, sé que el día se complica. Ese análisis es clave para ver dónde está el cuello de botella en tu ejecución. Tengo lugares mañana, reagendá acá: https://calendly.com/mauriciobustoseguia/60min

**`noshow_j1_2`**
> {{nombre}}, te dejo el seguimiento. El Diagnóstico sigue en pie y sigue siendo el primer paso para ordenar tu empresa. Elegí el horario que te funcione: https://calendly.com/mauriciobustoseguia/60min

## 6. post-j1-sin-avanzar · MARKETING
**Trigger**: asistió a J1 (`asistio_j1=true`) pero no avanza (`calificado` sin definir). **Cadencia**: 3 toques (día 0, 2, 5).

**`postj1_1`**
> {{nombre}}, gracias por la reunión de hoy. Vimos que tu empresa crece pero el tiempo no te alcanza para estar en todo — ese es justo el problema que resuelve el Sistema DOS™. ¿Te quedó clara la diferencia entre cómo trabajás hoy y lo que podríamos implementar?

**`postj1_2`**
> {{nombre}}, ¿pudiste pensar en lo que hablamos? Las empresas que aplican el Sistema DOS™ bajan fuerte su dependencia del dueño en pocos meses. Si te quedó alguna duda antes de avanzar, contámela.

**`postj1_3`**
> {{nombre}}, en la reunión me dijiste que tu mayor reto es la ejecución. Exacto — para eso el Sistema DOS™ instala rutinas, accountability y ritmo. El siguiente paso es armar tu plan juntos. ¿Lo agendamos? https://calendly.com/mauriciobustoseguia/60min

## 7. post-j1-calificado-sin-j2 · MARKETING
**Trigger**: calificado en J1 (`calificado=true`) pero sin J2 agendada (`fecha_junta_2` null). **Cadencia**: 2 toques (día 1, 4).

**`calif_j2_1`**
> {{nombre}}, quedamos en avanzar a la segunda sesión para armar tu plan con el Sistema DOS™. Te dejo el link para que elijas horario: https://calendly.com/mauriciobustoseguia/60min

**`calif_j2_2`**
> {{nombre}}, sigo con un lugar reservado para tu segunda sesión. Ahí bajamos todo a un plan concreto de 90 días. ¿La agendamos esta semana? https://calendly.com/mauriciobustoseguia/60min

## 8. no-show-j2 · UTILITY
**Trigger**: tenía J2 y no asistió (`asistio_j2=false`). **Cadencia**: 2 toques (a las ~4h, +1 día).

**`noshow_j2_1`**
> Hola {{nombre}}, soy Mauricio. No pudimos vernos en la sesión de hoy — entiendo, pasa. Me gustaría retomar donde quedamos y dejarte tu plan armado. ¿Reagendamos? Tengo lugares mañana: https://calendly.com/mauriciobustoseguia/60min

**`noshow_j2_2`**
> {{nombre}}, te dejo esto por si se te pasó. Lo que vimos en la primera sesión sigue vigente y el plan está a un paso. ¿Lo retomamos? https://calendly.com/mauriciobustoseguia/60min

## 9. post-j2-sin-cerrar · MARKETING
**Trigger**: asistió a J2 (`asistio_j2=true`) pero no cerró (`cerro` no true). **Cadencia**: 3 toques (día 0, 2, 5).

**`postj2_1`**
> {{nombre}}, gracias por tu tiempo hoy. Con lo que vimos, te dejo 3 cosas para arrancar ya: 1) definí quién lidera operaciones, ventas y finanzas, 2) fijá tus 3 objetivos para los próximos 90 días, 3) instalá una reunión semanal de 60 min de accountability. Esos pasos hacen la diferencia. Cualquier duda, acá ando.

**`postj2_2`**
> {{nombre}}, ¿cómo vas con los 3 puntos que vimos? Muchos llegan acá y no saben por dónde empezar — es normal. Estructurar tu equipo de dirección y afinar tus objetivos es justo el trabajo del Sistema DOS™. Contame cómo lo ves.

**`postj2_3`**
> {{nombre}}, último mensaje por acá: la brecha entre saber qué hacer y hacerlo es enorme, y por eso el Sistema DOS™ no es una consultoría sino un acompañamiento de 90 días que instala disciplina en tu equipo. Si lo viste claro en la sesión, podemos empezar esta semana. ¿Lo charlamos? https://calendly.com/mauriciobustoseguia/60min

## 10. confirmado-sin-pago · UTILITY (cobranza neutra)
**Trigger**: confirmó verbal (`fecha_confirmacion`) pero sin primer pago. **Cadencia**: 3 toques (día 0, 1, 3). *Copy neutralizado para que pase como utility; si Meta lo rechaza, recategorizar a marketing.*

**`pago_1`**
> Hola {{nombre}}, confirmamos tu lugar en el Sistema DOS™. Para dejarlo formalizado, ¿procedemos con el primer pago? Si tenés alguna duda o querés ver opciones de pago, contame y lo resolvemos.

**`pago_2`**
> {{nombre}}, te escribo para coordinar el primer pago y dejar tu inicio agendado. Si necesitás financiar la inversión o ajustar algo, lo vemos sin problema. ¿Cómo preferís avanzar?

**`pago_3`**
> {{nombre}}, te dejo el último recordatorio para formalizar tu lugar en el Sistema DOS™. ¿Lo cerramos? Si algo te frena, contámelo y lo resolvemos juntos.

## 11. post-pago-bienvenida · UTILITY
**Trigger**: registró primer pago (`fecha_primer_pago`). **Cadencia**: 1 toque inmediato.

**`bienvenida_1`**
> ¡Bienvenido al Sistema DOS™, {{nombre}}! Recibimos tu pago y ya sos parte. En las próximas horas te llega el acceso y los siguientes pasos para arrancar. Cualquier cosa, por acá estamos.

## 12. reactivacion-viejo · MARKETING
**Trigger**: lead `abierto`, >14 días sin movimiento, sin agendar. **Cadencia**: 2 toques (día 0, 4).

**`react_1`**
> Hola {{nombre}}, soy Mauricio. Hace un tiempo mostraste interés en Negocio que Escala™ pero no llegamos a agendar. ¿Seguís buscando que tu empresa crezca sin depender de vos en todo? Tengo 30 min esta semana para un diagnóstico sin costo: https://calendly.com/mauriciobustoseguia/60min

**`react_2`**
> {{nombre}}, último intento por acá: si antes no era el momento, capaz ahora sí. Tengo un espacio esta semana para ayudarte a ver por qué el negocio no crece al ritmo que querés. 30 min, sin costo: https://calendly.com/mauriciobustoseguia/60min

## 13. ultimo-intento-antes-noresp · MARKETING
**Trigger**: lead `abierto`, ya nutrido, +21 días sin agendar ni asistir. **Cadencia**: 1 toque final.

**`ultimo_1`**
> Hola {{nombre}}, te escribo una última vez. Quedó pendiente tu Diagnóstico de 30 min, sin costo y sin compromiso — te ayuda a ver con claridad dónde está el cuello de botella de tu negocio. Si te sigue interesando, agendá acá y lo resolvemos: https://calendly.com/mauriciobustoseguia/60min

---

## Resumen

| # | Etapa | Categoría | Templates |
|---|-------|-----------|-----------|
| 1 | form-sin-agenda | marketing | 3 |
| 2 | vio-vsl-sin-agendar | marketing | 2 |
| 3 | vio-poco-vsl | marketing | 2 |
| 4 | agendado-sin-confirmar | utility | 2 |
| 5 | no-show-j1 | utility | 2 |
| 6 | post-j1-sin-avanzar | marketing | 3 |
| 7 | post-j1-calificado-sin-j2 | marketing | 2 |
| 8 | no-show-j2 | utility | 2 |
| 9 | post-j2-sin-cerrar | marketing | 3 |
| 10 | confirmado-sin-pago | utility | 3 |
| 11 | post-pago-bienvenida | utility | 1 |
| 12 | reactivacion-viejo | marketing | 2 |
| 13 | ultimo-intento-antes-noresp | marketing | 1 |

**Total: 13 etapas, 28 templates.** Apenas el lead responde a cualquiera, se abre la ventana de 24h y la conversación sigue libre (setter/Mauricio), sin necesidad de template.
