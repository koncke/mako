# MaKo recomienda — auditoría del Second Brain, cómo recomiendan otras apps y el motor

> **Pedido de Martín, 26/10/2026 ~01:50, textual:** «Lo que mas me interesa que trabajes durante toda la noche es que MaKo sea
> realmente inteligente... Y comience a dar recomendaciones en todos lados, en el Ops Center, cuando uno esta haciendo una
> automatización, al crear una offer, landing, MaKo en WhatsApp (que no funciona muy bien, no guarda contexto), o lo que sea
> realmente, donde sea que haya un mako... Pero estas recomendaciones y MaKo "pensando" deben ser reales, no le presetees que
> cada ratito debe de hacer recomendaciones basura para cumplir con su "cuota", tiene que ser posta inteligente... Revisa como
> lo hacen otras apps o skills, revisa como lo harias tu mismo si te digo que seas mi asesor de marketing... Aprovecha realmente
> el Second Brain... Revisa si el second brain realmente esta guardando todo el contexto de absolutamente todo, todo el tiempo,
> para que justamente esto nos sirva...»

**Estado (26/10/2026):** el motor, la API y las cuatro pantallas están en la rama `mako-recomienda-2610`. **Falta medirlo con los
datos de producción** (el permiso de lectura lo tiene que dar Martín: §6) y las capturas.

---

## En un minuto

- **El Second Brain NO guarda todo.** Dibuja un mapa con ~21 fuentes, pero lo que MaKo **recuerda al contestar** es sólo
  `mako_knowledge`, y de lo que el negocio vive ahí entra **una sola fuente**: WhatsApp. Además, en un cliente viene **apagada**
  y sólo se usa si el negocio conectó **su** Gemini. Las llamadas de venta, la oferta trabajada, lo que la persona decidió, lo que
  le contó a MaKo en los chats, lo que pasa en las automatizaciones y en las landings: nada de eso llega a la memoria (§1).
- **El motor no espera a que llegue.** Cada recomendación sale de una **señal que mide el código** sobre la base del negocio
  (con su número, su muestra y su fuente). Si no hay una que pase su umbral, **MaKo no dice nada** (§3).
- **Aprende** de lo que la persona acepta o descarta, y **mide** después si lo aceptado cambió algo.
- **Aparece** donde hay un MaKo, en el **bloque de preguntas del Ops Center** (plegado en su tira, de a una), y por la API.

---

## 1. Auditoría del Second Brain

### 1.1 Qué guarda hoy (leído en el código de `origin/main`, c8f1c4a57)

Hay **tres cosas distintas** que se llaman «el Second Brain», y la confusión es parte del problema:

1. **El mapa** (`lib/cerebro-grafo.ts`, el grafo de `/second-brain`): se **calcula en cada pedido** con ~21 fuentes. Es un dibujo:
   no guarda nada y ningún chat lo lee al contestar.
2. **La memoria** (`mako_knowledge`): lo que el chat consulta por similitud (`searchKnowledge`, 4 resultados por turno, en
   `buildSystemPrompt` como «TU METODOLOGÍA»). Sólo entra lo que tiene embedding: **sin el Gemini del negocio, nada nuevo se usa**.
3. **Las herramientas** del turno (leer leads, reuniones, métricas): traen datos **si el modelo se acuerda de pedirlos**.

| Fuente | Dónde vive | ¿Al mapa? | ¿A la memoria? | ¿Al motor de recomendaciones? |
|---|---|---|---|---|
| Conversaciones de WhatsApp con leads | `wa_mensajes` | no | **sólo con «Aprende solo» prendido** (cliente: apagado) y su Gemini; cron cada hora, 6 conversaciones por vuelta | sí, directo (velocidad de respuesta, gente esperando) |
| Llamadas de venta (Fathom) | `closing_analyses` (resumen, objeciones con cita y si se respondió, recs) | sí (nodos) | **no** | sí, directo (objeciones) |
| Lo que el dueño le dice a MaKo en la app | `chart_chats` | un nodo por chat jefe | **no** | no |
| Lo que el dueño le dice a MaKo por WhatsApp | `mako_doer_conv` | no | **no** | no |
| Sesiones de Offer (mensajes, piezas, conclusiones) | `offer_sesiones` | sólo la fecha | **no** | no (lee la oferta guardada) |
| La oferta | `ofertas` | sí | por el perfil | sí (si contesta las objeciones) |
| Leads, etapas, asistencia, motivos de pérdida | `leads`, `lead_audit` | sí | no | sí, directo (no-show, motivos) |
| Automatizaciones y sus envíos | `nutricion_*` | sí | no (sólo al prompt del chat de secuencias) | sí, directo (fallas, nadie contesta) |
| Visitas y scroll de las landings | `landing_visits`, `vsl_events` | no | no | sí, directo (conversión, profundidad) |
| Decisiones del Media Buyer | `media_buyer_decisiones` | no | no | no (tiene su propio motor) |
| Sugerencias del CRM calladas | `app_settings` `crm.sugerencias.calladas` | no | no | no (tiene su propio motor) |
| Emails e Instagram | `email_mensajes`, `ig_mensajes` | no | no | no |
| Lo cargado a mano (metodología, cursos) | `mako_knowledge` | sí | sí | no |

### 1.2 Los huecos, ordenados por cuánto le sirven a una recomendación

1. **Las llamadas de venta no llegan a la memoria.** Una llamada dice más que cien mensajes y ya está analizada (objeciones con
   cita, si se respondieron, recomendaciones de coaching). El motor las lee directo desde hoy; **la memoria no**: si el dueño le
   pregunta a MaKo «¿qué objeción me frena?», MaKo no lo sabe salvo que llame a una herramienta. Siguiente paso: el recolector de
   Fathom del diseño del recolector (`docs/diseno-second-brain-recolector.md` §3), con la cuenta de CADA negocio.
2. **WhatsApp aprende sólo si alguien lo prende, y sólo se usa con su Gemini.** Un cliente arranca apagado (decisión del Cerebro
   del 25/10: gasta la IA del negocio) y lo recolectado sin embedding queda en `estado = 'error'`. Hay que medir cuántos negocios
   lo tienen prendido (§6): si son cero, el Second Brain de los clientes no aprende nada de lo que viven. El motor lo recomienda
   (`second-brain-sin-aprender`) cuando el negocio tiene su IA y conversaciones de las que aprender.
3. **Lo que la persona decidió está repartido y no se aprende entre áreas.** El Media Buyer guarda sus descartes en su tabla, el
   CRM en un setting, y ahora el motor en otro. Ninguno ve los de los demás.
4. **Lo que el dueño le cuenta a MaKo se pierde** («subo el precio en diciembre», «esa landing es de prueba»). Ni los chats de la
   app ni los de WhatsApp se vuelven conocimiento. Es la mitad de «MaKo en WhatsApp no guarda contexto» (lo arregla ese chat).
5. **Las automatizaciones y las landings** están medidas pero no llegan a la memoria. El motor las lee directo: para recomendar
   no hace falta copiarlas al conocimiento.
6. **Offer**: las conclusiones de cada sesión quedan en su tabla; el mapa sólo usa la fecha.
7. **Emails e Instagram**: no se leen en ningún lado del Second Brain.

**El diagnóstico obvio era el equivocado:** «hay que guardar todo en el Second Brain para poder recomendar». No: lo que hace
falta para recomendar ya está en las tablas del negocio, medido. Copiarlo a `mako_knowledge` lo vuelve texto suelto que se
busca por similitud y se pierde el número. El motor lee cada fuente donde vive; la memoria sirve para lo que no es un número
(lo que dijo la gente, lo que decidió el dueño).

### 1.3 La medición por negocio

**Pendiente: el clasificador de permisos de esta sesión negó la lectura de producción («Production Reads»).** Sólo la habilita
Martín. La medición quedó lista en un comando, de sólo lectura (transacción `read only`, cuenta filas, no imprime mensajes,
nombres ni el valor de una credencial):

```bash
node --env-file=<.env.local con DATABASE_URL> scripts/medir-second-brain.mjs --json medicion.json
```

Por negocio: conversaciones con leads de 14 días, llamadas analizadas, chats con MaKo, mensajes del grupo de WhatsApp, entradas
de la memoria (total, de WhatsApp, sin índice), si «Aprende solo» está prendido, si tiene claves de IA, envíos fallados, visitas,
ventas perdidas con motivo y llamadas marcadas. Con eso se completa la tabla de §1.1 con números.

---

## 2. Cómo lo hacen las apps que recomiendan bien (lo que vale copiar)

La investigación completa (siete productos, con fuentes oficiales y de terceros separadas) está en las notas de la sesión; acá
queda lo que se copió y de dónde.

| Regla | De dónde | Cómo quedó en MaKo |
|---|---|---|
| **Silencio por defecto.** Sin algo fuerte, nada. | HubSpot: «If no strong recommendation is available, no suggestions will appear» (knowledge.hubspot.com/workflows/use-action-recommendations-in-workflows). Antiejemplo: Madgicx manda a soporte si pasa un día sin recomendaciones. | `elegirSinIA` puede devolver `[]`; la IA puede devolver `[]` y se respeta; la pantalla no dibuja nada. |
| **Cada una con el dato que la sostiene.** | Intercom (las conversaciones de origen al costado), HubSpot (5 factores con + y −), Madgicx (razón → datos → ajustes). Encuesta StackAdapt (19/08/2026): el 42 % ignora las recomendaciones por genéricas; el 33 % actúa con una explicación clara. | El porqué (`porque`) lo escribe el código con el número de la señal; la IA no puede tocarlo. |
| **Atada a algo del negocio, no a un puntaje.** | Críticas a Google Optimization Score y Meta Opportunity Score (Jon Loomer, jonloomer.com/opportunity-score): suben por aceptar, no por resultados. | No hay puntaje. «Qué cambia» y, a los 10 días, si cambió. |
| **Umbral, muestra mínima y persistencia.** | Intercom: tema 1+ por día durante 7 días, pico en 4 días, excluye abandonadas (intercom.com/help, artículo 11394959). HubSpot: sólo recalcula si cambia ±3 %. | Cada señal declara `umbral` y `nMinimo`; con menos, calla. |
| **Descartar en un toque, con motivo, y lo descartado no vuelve.** | Madgicx (tacho → motivo → «Dismissed» con «Reopen», academy.madgicx.com). Google es el antiejemplo: lo descartado vuelve en semanas. | «Ahora no» (14 días), «No aplica» (nunca), con motivo por la API o por el chat; `reabierta` lo deshace. |
| **Medir después.** | Madgicx (calificación de lo completado); Jon Loomer pide un registro de lo adoptado. | «Hecha» se mide a los 10 días: si el dato sigue igual vuelve diciendo «la aceptaste el … y sigue igual»; si mejoró, va a «lo que mejoró». |
| **Corregir con palabras.** | Linear Triage Intelligence: «guidance» en lenguaje natural ante errores que se repiten (linear.app/docs/triage-intelligence). | «No me recomiendes más lo de la landing, es de prueba» llega con `decidir_recomendacion` y el motivo viaja a la IA. |
| **Autonomía gradual: primero sugerir.** | Linear (auto-aplicar por tipo, marcado y reversible); StackAdapt: 90 % cómodo con que la IA sugiera, 50 % con que actúe sola. | «Hacerlo» lleva a la pantalla o deja el pedido escrito en la caja. Nada se ejecuta solo. |
| **Prioridad por impacto, no por volumen.** | Intercom: una conversación grave puede rankear alto. | `impacto` de cada señal × lo que el negocio aceptó de ese tipo. |
| **Techo.** | AdAmigo: 2 por día en el plan Entry (adamigo.ai/pricing); Intercom: hasta 20 por semana. | Una por vez en el bloque; tope de 2 o 3 en cola por pantalla. |

**Cómo lo haría un asesor de marketing de verdad** (para un negocio que vende por WhatsApp con anuncios de Meta): empieza por lo
más cerca de la plata y va hacia atrás — la velocidad de primera respuesta (HBR 2011, «The Short Life of Online Sales Leads»:
dentro de la primera hora, ~7 veces más chance de una conversación útil; el 23 % de 2.241 empresas nunca respondió), después
el seguimiento, el no-show, el cierre, las objeciones que se repiten, la oferta y recién al final el costo por lead y los
creativos. **No** recomienda tips genéricos, estadísticas sin fuente, subir presupuesto porque la plataforma lo sugiere, ni nada
con 3 casos. Ese orden es el `impacto` de las señales.

**Lo que NO se copió:** la cuota (Madgicx), los puntajes que suben por aceptar (Google, Meta), el auto-apply.

---

## 3. El motor

`lib/recomendaciones-reglas.ts` (lo puro: cuándo existe, cómo se calla, cómo aprende, qué se le acepta a la IA) ·
`lib/recomendaciones-senales.ts` (lo que se mide) · `lib/recomendaciones.ts` (la lectura y la memoria) ·
`app/api/mako/recomendaciones/route.ts` · `app/_chat/RecomendacionesDeMako.tsx`.

### 3.1 Las tres condiciones

Una recomendación existe **sólo si**:

1. **Un dato del negocio la sostiene:** nace de una `Senal` que arma el código, con `valor`, `umbral`, `n` (la muestra) y
   `nMinimo`. Debajo del umbral o con poca muestra, la señal no existe.
2. **Dice qué hacer y qué cambia:** `hacer` y `cambia` son obligatorios; el porqué es el `dato` de la señal, escrito por el código.
3. **No la dijo ya ni la descartaron:** la memoria del negocio (`app_settings` `mako.recomendaciones.memoria`, con
   compare-and-set) guarda cada decisión.

### 3.2 Las señales

| Tipo | Qué mide | Habla cuando | Muestra mínima | Dónde |
|---|---|---|---|---|
| `respuesta-lenta` | De las conversaciones NUEVAS de leads (14 días), cuántas esperaron más de 1 hora la primera respuesta. Si hay muestra en los dos grupos, compara cuántos avanzaron (agendaron o compraron) entre los que esperaron y los que no. | ≥ 30 % | 10 | Ops Center, Automations, WhatsApp |
| `esperando-respuesta` | Personas cuyo último mensaje es suyo, sin respuesta hace más de 12 h y menos de 7 días («gracias», «ok» o un emoji no cuentan). | ≥ 3 | 3 | Ops Center, WhatsApp |
| `no-show-alto` | De las llamadas MARCADAS de 45 días, cuántas no se presentaron. | ≥ 30 % | 8 | Ops Center, Automations, WhatsApp |
| `motivo-perdida` | El motivo de pérdida más repetido (120 días), agrupado sin mayúsculas ni acentos. | ≥ 35 % y 3 veces | 6 | Ops Center, Offer, Landing, WhatsApp |
| `automatizacion-falla` | Envíos fallados de una automatización activa (7 días), con el motivo más común sin teléfonos. | ≥ 15 % y 5 fallas | 10 | Ops Center, Automations |
| `automatizacion-muda` | De los que entraron a una automatización que ESPERA respuesta (tiene un «Contestó» o un AI Step), cuántos respondieron (30 días). | ≤ 5 % | 25 | Ops Center, Automations |
| `landing-no-convierte` | Visitantes de una página (30 días) contra los leads que entraron por ella. | ≤ 1 % | 150 visitantes | Ops Center, Landing |
| `landing-no-la-leen` | De las personas con scroll medido, cuántas llegaron a la mitad. | ≤ 25 % | 100 | Landing |
| `objecion-sin-respuesta` | Una familia de objeción (precio, confianza, tiempo, consultarlo) en los hechos de WhatsApp del Second Brain, las llamadas analizadas (con en cuántas no se respondió) y los motivos de pérdida, que el texto de la oferta no contesta. Sin oferta, calla. | ≥ 15 % y 3 veces | 3 | Offer, Landing, Ops Center, WhatsApp |
| `second-brain-sin-aprender` | «Aprende solo» apagado, con su IA conectada y conversaciones con leads de las que aprender. | ≥ 15 conversaciones | 15 | Ops Center |

**Los umbrales son defaults razonados, no medidos todavía.** Están todos en `UMBRALES` (lib/recomendaciones-senales.ts) para
medirlos juntos con `scripts/probar-recomendaciones.mts` (§6).

### 3.3 Cómo aprende

- **«No aplica»** no vuelve nunca para esa clave (`tipo|objeto`). **Dos «No aplica» de un mismo tipo** sin ninguna aceptada lo
  apagan para el negocio.
- **«Ahora no»** la calla 14 días; después vuelve **sólo si el dato la sigue sosteniendo**.
- **«Hecha»** la calla 10 días (lo que tarda un cambio en verse). Pasado eso, si el dato sigue igual, vuelve **como seguimiento**
  («La aceptaste el 16/10 y sigue igual»); si ya no se sostiene, va a «lo que mejoró».
- **El orden** pondera cada tipo por lo que el negocio hizo con él: (aceptadas + 1) / (aceptadas + descartadas + 2).
- **Lo descartado con su motivo** viaja a la IA para que no lo repita con otras palabras.

### 3.4 La IA redacta; el código decide

Si el negocio tiene **su** IA (o es el espacio de MaKo), su IA recibe las señales (S1, S2…), el perfil y la fase del negocio, y lo
descartado con su motivo, y elige y redacta. El código **descarta** la que cita una señal que no existe o ya usada, la que trae
un número que no está en los datos (`numerosAjenos`), la genérica (`esGenerico`) o la larga. Si la IA decide que nada vale la
pena, se respeta. Corre **después de contestar** (`after()`), se guarda por la huella de las señales (no se gasta IA mientras los
datos no cambien) y la próxima vez sale la de la IA. Sin su IA: el texto de las reglas, nunca la IA de la plataforma.

### 3.5 Por la API

- `que_recomienda_mako` (lectura, del admin, también por HTTP: `GET /api/v1/mako/recomendaciones`): las recomendaciones con su
  porqué, su fuente y el link o el pedido; lo que mejoró; lo descartado. Vacía = «no hay nada que valga la pena; no inventes».
- `decidir_recomendacion` (acción, confirmación por chat, reversible: `POST /api/v1/mako/recomendaciones/decisiones`): hecha,
  ahora-no, no-aplica (con motivo) o reabierta.
- El clasificador trae la lectura con «¿qué me recomiendas?», «dame un consejo», «¿qué debería mejorar?», y la corrección con
  «no me recomiendes eso porque…» (lib/mako-intencion.ts, reglas 3-bis-rec y 3-bis-rec2).

---

## 4. Dónde aparece

| Pantalla | Archivo | Qué ve |
|---|---|---|
| **Ops Center del cliente** (el chat Cerebro) | `app/second-brain/ChatSecondBrain.tsx` | Todo el negocio. |
| **Automations** (el chat del lienzo) | `app/automations/ChatMakoVista.tsx` | Respuesta lenta, no-show, automatizaciones que fallan o nadie contesta. |
| **Offer** | `app/offer/ChatOffer.tsx` | Objeciones que la oferta no contesta, motivo de pérdida. |
| **Web Generator** (el chat del editor) | `app/web-generator/editor/paneles/PanelAgente.tsx` | Páginas que no convierten o no se leen, objeciones. |
| **MaKo en WhatsApp** | por la API (`que_recomienda_mako`) | Cuando le preguntan. **No avisa solo** (reacciona, no avisa). |

En todas, **el bloque de preguntas del Ops Center** (`BloqueDePreguntas` → `deLaTab`): plegado en su tira «Sugerencias de MaKo
(N)» hasta que se la toca, de a una, con la pregunta (qué hacer), el contexto (el porqué con su número y qué cambia) y tres
opciones: lo que la hace, «Ahora no» y «No aplica a mi negocio». **«Hacerlo» no ejecuta nada:** lleva a la pantalla o deja el
pedido escrito en la caja de esa pantalla para que la persona lo lea y lo mande. Sólo lo ve el admin.

**No aparece** en el CRM (tiene sus sugerencias, `lib/sugerencias-crm.ts`) ni en el Media Buyer (su motor, `lib/media-buyer/`).
Juntarlos en el Ops Center es un paso aparte (§6).

---

## 5. Decisiones que tomé (y por qué)

- **La memoria va en un setting del negocio, sin migración.** Es el molde de las sugerencias del CRM (compare-and-set, tope de
  300 decisiones). Una tabla vale la pena cuando haya que consultar decisiones entre negocios o por fecha; hoy no.
- **Sólo el admin.** Lo que se decide vale para todo el equipo y «Hacerlo» abre lo que es del admin.
- **La IA en `after()` y por huella.** Abrir una pantalla no espera a la IA ni la gasta cada vez.
- **WhatsApp no manda recomendaciones solo.** Contesta cuando le preguntan. Un resumen proactivo es decisión de Martín.
- **El motor lee cada fuente donde vive** en vez de copiar todo a la memoria (§1.2, el diagnóstico equivocado).

---

## 6. Lo que queda, con su archivo

1. **Medir en producción** (el permiso lo da Martín): `scripts/medir-second-brain.mjs` (la tabla de §1.1 con números) y
   `scripts/probar-recomendaciones.mts` (el motor contra cada negocio, sin IA y sin escribir, con todas las señales y sus
   umbrales). Con eso, **calibrar `UMBRALES`** y sacar las capturas.
2. **Juntar en el Ops Center** las sugerencias del CRM y las decisiones abiertas del Media Buyer, con una sola memoria.
3. **El recolector de Fathom y de los chats con MaKo** (lo que el dueño cuenta) a la memoria: `lib/recolector.ts`.
4. **«Lo que mejoró» en pantalla** (hoy sólo por la API).
5. **Un tope diario para todo MaKo** (la investigación sugiere 3 por día; criterio, no fuente).
6. **Decisión de Martín:** ¿un resumen semanal por WhatsApp con lo que MaKo recomienda?

**Relacionado:** `docs/diseno-second-brain-recolector.md` · `docs/sugerencias-mako-crm.md` · `docs/hallazgos-recomendaciones.md`.
