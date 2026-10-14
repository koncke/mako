# MaKo nada por detrás: el inventario y el plan (14/10/2026)

> Pedido de Martín (14/10/2026, textual en app/admin/dev/chatbot/bitacora.ts): «Depreca absolutamente todas las cosas que
> MaKo haga por detrás... Y si encuentras cosas como estas que deberían estar en el flujo pero no hay una condición para eso
> o falta crear algo, crealo dentro de automations». Regla en la memoria `mako-nada-por-detras`.
>
> Salió de una corrida de sólo lectura (workflow wf_a7729a89-429, 14/10): cuatro buscadores (inscripción, envío, grafo, lo
> que está fuera de Automations), un verificador por zona contra HEAD y un sintetizador. 162 ítems, todos confirmados.
> Las líneas citadas son de `e4c8a6d7`: se corren. ESTE ARCHIVO ES EL PLAN DE TRABAJO: se tacha lo hecho, con el commit.

Repo `C:/dev/wt-undecima`. HEAD se movió durante la lectura (`e4c8a6d7`). Volví a comprobar las líneas clave y no cambiaron: `nutricion.ts:4015`, `:4099`, `:4854`; `nutricion-grafo-motor.ts:216`, `:746`; `plantillas-automatizaciones.ts:257`; `nutricion-reinscripcion.ts:167`, `:190`. No edité nada, no corrí la app y no toqué la base.

## DECIDIDO por Martín (14/10/2026)

1. **Si el lead contesta** (§1-C): ~~opción visible en cada camino, «Si contesta: se corta / sigue», con «sigue» de
   fábrica~~ → **REEMPLAZADO el mismo 14/10 a la tarde.** Martín: «"Si el lead contesta" NO debería ir en el CRON, debería
   ser una CONDITION... Es obvio eso». Es la condición **«No contestó desde que entró»** (`contesto`, sección Mensajes);
   que el lead conteste no corta nada por su cuenta. Lo de fábrica sigue siendo «sigue»: sin la condición, el camino
   sigue. Las que existían se convierten con scripts/migrar-contesto-condicion.ts (la condición después de cada DELAY de
   un camino que decía «se corta»); la bienvenida de «Un Lead Agendó Llamada» sigue saliendo.
2. **Protecciones** (§4), textual: «Todas configurables, y también más visibles, ya sea con un aviso o advertencia».
3. **Una reunión cancelada cuenta como «no agendó»** (§2.1, el bug de lectura de `catalogoDeLead` / `agendoDe`).
4. **«Pausar» congela** (§1-D): al reactivar, cada lead sigue en su paso y lo vencido sale al reactivar.

## 0. Lo primero, en seis líneas

1. Hace falta **UNA condición nueva**, `reunion_en_pie`, para responder «¿se canceló o ya pasó?». No hace falta ninguna tarjeta nueva.
2. Antes de borrar la guarda hay que resolver un hueco técnico: **un reintento no vuelve a pasar por la condición** (`nutricion.ts:4854` sólo mueve `proximo_envio_at`). Si no se arregla, vuelve el caso del 25/09.
3. **La condición visible de hoy tiene el mismo bug 5.** `REUNION_POR_DELANTE` (`reunion_en ≤720`, `plantillas-automatizaciones.ts:257`) lee una fecha sin hora como el mediodía de México (`nutricion-grafo-motor.ts:762`, que llama a `reunionFuturaMs`). El arreglo `329d1443` sólo tocó la guarda escondida.
4. «Salió de la etapa» ya se puede poner: es `sigue_en_etapa_cron`. Habría cortado el bug 5 a las 02:02:44 y no está en «Un Lead Agendó Llamada».
5. **Stop:** alcanza con la salida vacía. Falta rotularla «Termina» y, sólo para caminos en paralelo, darle la opción «Termina toda la automatización».
6. Bug 5: con el código vivo entonces, **la reserva de Calendly de las 02:05 sí reiniciaba el flujo**. El hallazgo del 13/10 (`docs/hallazgos-chatbot.md:4271-4285`) se equivoca en la segunda vuelta (sección 5).

---

## 1. Inventario único

Las zonas que lo vieron van entre corchetes: I (inscripción), E (envío), G (grafo), F (fuera).

**Descartados (real=false): ninguno.** El verificador confirmó todos los ítems.

**Reclasificados o que no son «por detrás»** (una línea cada uno):
- `evento-accion-falla-avisa-grupo` pasa de integridad a **negocio**. Es MaKo escribiéndole al grupo por su cuenta (`flujos.ts:415-421`).
- `salir-de-etapa-venta-no-corta`: no es una regla escondida, es que falta una. Se arregla con `sigue_en_etapa_cron` (`condiciones-catalogo.ts:524-527`).
- `rama-vacia-termina`: es lo que dibuja el lienzo. Lo que falta es cortar los OTROS caminos (sección 3).
- `anti-ban 20 h`, `topes WA/email` y `horario-de-envio`: se ven y se configuran en Configuraciones. Lo oculto son sus excepciones (sección 4).
- `variantes-al-azar` y `plataforma-email-rebote-baja`: visibles.
- `zernio-lead-solo-si-escucha`: depende del CRON. Lo único oculto es el caso `standby` (`zernio-entrante.ts:145`).
- `cancelacion-sin-condicion-ni-cron`: es un **bug de lectura** (integridad), no una decisión. `catalogoDeLead` lee `junta_X_at ?? fecha_junta_X` (`nutricion-grafo-motor.ts:757-758`), así que una cancelada sigue viéndose en `reunion_agendada`, en `agendo` (`agendoDe`, `condiciones-catalogo.ts:268`) y en `reunion_en` CON etapas. No afecta a `asistio_reunion`.
- `reserva-inscribe-en-su-etapa`, `tope-saltos` y `emisor-cancela`: integridad. Se dejan.

### A. La reunión (el caso que lo disparó)

| id fusionado [zonas] | Qué decide | Dónde | Hoy se puede con | Propuesta mínima |
|---|---|---|---|---|
| **reunion-ya-paso** [I,E,G] | Antes de cada mensaje o ⚡ Acción (incluida «MaKo en WhatsApp») de un flujo con `preparaReunion`, cierra la **inscripción entera** con un 'omitido' «la reunión ya pasó». En un paso del carril corre ANTES que `decidirToqueDelCarril` y usa el mediodía (`anclada`). La zona es UTC−6 fija (`TZ_OFFSET_MX`, `nutricion-reinscripcion.ts:35`): en el ws1 corta a las 22:59 de Tijuana. No mira la asistencia. | `nutricion.ts:4084-4107`; `nutricion-reinscripcion.ts:163-192` | `reunion_en` sólo en parte (mediodía, tope de 720 h, corta un solo camino) | **`reunion_en_pie`** (2.1) + regla del reintento (2.2) + migración (2.3). Después se borra. |
| reunion-ya-paso-al-inscribir-a-mano [I,G] | Un «Ir a», una ⚡ inscribir, MaKo o la API no inscriben en un flujo de reunión si ésta ya pasó. | `nutricion.ts:2286-2294`, `2309-2316`; `nutricion-inscripcion-manual.ts:110` | — | Se borra junto con la guarda: el lead entra y decide la condición. |
| prepara-reunion-por-forma [I,G] | Clasifica el flujo por su forma (familia `agendado_*`, CRON en una etapa de tipo reunión, o DELAY «antes de la reunión») y eso prende seis cosas: la guarda, el rechazo manual, `reunion_at`, el reuso, el corte del AI Step y el encadenado. Sólo conoce `agenda` y `agendaj2` (`pipeline.ts:484`): una etapa de reunión de un embudo propio no la prende. | `nutricion-familias.ts:120-130`; usos en `nutricion.ts:1474, 1616, 1728, 2163, 2193-2200, 2288, 3571, 4099, 5140`; `nutricion-desenlace.ts:202` | nada | Desaparece sola: cada consecuencia pasa a algo visible (2.1, 2.4-a, 2.4-f). `reunion_at` queda como dato técnico de la «Reentrada». |
| delay-antes-sin-reunion [I,E,G] | `sin_reunion` en un DELAY «antes» cierra la **inscripción entera** con el motivo «ya pasó», aunque se haya cancelado. | `nutricion-grafo-motor.ts:228-235`; `nutricion.ts:4015` | — | Que cierre sólo el hilo (como `sin_hora`, `:4017`) con el motivo «no hay reunión por delante». Quien quiera cortar todo usa 3-b. |
| carril-sin-hora / tolerancia-12 / no-espera [E,G] | El recordatorio sale sólo si la reunión tiene hora y coincide con la fecha. Con más de 12 min de atraso se omite. Si está en [relleno], con requiere o con el canal apagado, se pierde. Un mensaje del carril para revisar crea un borrador **encima** de otro (`!carril` en `nutricion.ts:4572/4618/4650/4680`). | `nutricion-grafo-motor.ts:520-551`; `recordatorio-lead.ts:58`; `nutricion.ts:4135-4190` | nada | Es la semántica del DELAY: sin hora no hay «cuándo». Va **a la vista en la tarjeta DELAY**: «sin reunión con hora, este camino termina» y «si se pasó la hora, no se manda», con el campo de tolerancia (`toleranciaMin` ya existe y el motor no lo pasa, `nutricion.ts:4147-4150`). El borrador apilado del carril es otro bug aparte. |
| carril-lead-no-abierto [E,G] | Un recordatorio no sale si `estado_lead ≠ abierto`. | `nutricion-grafo-motor.ts:537` | `sigue_en_etapa_cron` (los estados terminales derivan a ganado, perdido, descalificado o no responde: `pipeline.ts:1479-1484`), más `estado_lead=abierto` en la misma fila si se quiere paridad con un override manual | Una condición entre cada DELAY «antes» y su mensaje. El mensaje sigue siendo carril, porque `minutosAntesDeReunion` sube por las condiciones (`nutricion-grafo-motor.ts:379-381`). Después se borra la línea 537. |
| ai-step-no-contesta-tras-reunion [G] | El AI Step deja de contestar si «su reunión ya pasó», con la regla del mediodía. | `nutricion.ts:5126, 5140`; `setter-conversacion.ts:353, 370` | `reunion_en`, en parte | Una fila opcional en el AI Step, «Deja de contestar si…», con una `FilaCondicion` del catálogo (en la migración, `reunion_en_pie` negada). Se saca `preparaReunion` de `charlaDelLead`. |
| salir-de-etapa-venta-no-corta [I] | Nada corta un flujo cuando el lead sale de la etapa del CRON (venta). | `nutricion.ts:1978-2008` (sólo entrega) | **`sigue_en_etapa_cron`** | Ponerla en la plantilla y en #213 (2.3). |
| salir-de-etapa-entrega-cierra [I] | En la entrega, cambiar de etapa cierra las 'activa' de la etapa que se deja. | `nutricion.ts:1978-2008, 2136`; `cs-mover-etapa.ts:294-299, 327` | `sigue_en_etapa_cron` (ámbito entrega) | Insertarla delante de cada mensaje de las automatizaciones de `entrega_actual` y borrar `cerrarEntregaDeEtapa`. |
| recordatorio emisor #228, config de antes, aviso de media hora [F] | El emisor viejo tiene sus propios filtros y sólo corre con Calendly. Sin fila (o con la fila archivada) toma `chatbot.recordatorio_reunion`. | `reunion-recordatorio.ts:262, 277-281, 331`; `app/api/cron/reunion-recordatorio/route.ts:43` | lo que tiene la plantilla `lead-agendo` | Medir qué negocios tienen `activo:true` en esa clave y ninguna fila viva. Después borrar el fallback y `mandarRecordatoriosDeReunion`. |

### B. Reentrada, reuso y «una sola vez»

| id [zonas] | Qué decide | Dónde | Propuesta |
|---|---|---|---|
| una-vez-por-flujo [I] | `unique (lead_id, secuencia_id)`: los CRON por evento (etiqueta, pago, IG) disparan una sola vez en la vida del lead. Una 'cancelada' no vuelve a entrar nunca. | `nutricion.ts:1621-1626, 2181-2184`; `pago-entrante.ts:22-25` | **«Reentrada» en la tarjeta CRON**: «Una sola vez» (por defecto) / «Otra vez si es otra reunión» / «Cada vez que vuelve a entrar». `reactivarInscripcion` ya sirve para las tres (`nutricion-reinscripcion.ts:435-460`). |
| reuso-al-reagendar + misma-reunion-por-dia + reuso-sin-saber-que-reunion [I,G] | Reinicia el flujo de reunión si la R1 nueva cae en otro DÍA de México. Con `reunion_at` en null, sólo si «no le llegó nada». La R2 nunca cuenta. `reunionQuePreparaMs` no descarta una R1 cancelada. | `nutricion-reinscripcion.ts:154-161, 207-209, 262-351` | La opción «Otra vez si es otra reunión». La migración la deja puesta en los flujos que hoy tienen `preparaReunion`. Usar la zona del negocio y no −6. Con «antes sin hora, ahora con hora, el mismo día», tratarla como la misma reunión sólo si ya le llegó algo. |
| respondio-queda-para-siempre + desenlace-respondio-cierra [G] | Las de la galería nacen sin estrategia. Una 'respondio' nunca se cierra y no se reusa al reagendar; además queda «ocupado» para el residuo. | `nutricion-desenlace.ts:230-232`; `plantilla-crear.ts:104-110`; `nutricion-reinscripcion.ts:226, 298-301` | Cerrar como 'completada' cuando terminan el carril o la charla, sin depender de la estrategia, o que la «Reentrada» acepte una 'respondio' sin próximo envío. |
| ir-a no repite / objetivo_hecho, encadenar [I,E,G] | El «Ir a» no entra si el lead ya estuvo, ni si ya cumplió el objetivo de la estrategia destino. Si lo rechaza, éste ya quedó cerrado (`nutricion.ts:4027`). | `nutricion-inscripcion-manual.ts:105-107`; `nutricion-desenlace.ts:164-212` | `ya_estuvo` va a la «Reentrada» del destino. `objetivo_hecho` se reemplaza con `agendo`/`pago`/`calificado` delante del «Ir a». El «Ir a» ya no está en la salida (`flujo-legado.ts:412-428`): migrar los que queden. |

### C. Respuesta y AI Step

| id [zonas] | Qué decide | Dónde | Propuesta |
|---|---|---|---|
| ~~pausa-por-respuesta + respondio-solo-carril + carril-sobrevive~~ **HECHO (14/10, a la tarde): la condición «No contestó desde que entró»** (la opción por camino de `c0c46bad` duró unas horas) [E,G,F] | Cualquier entrante (WhatsApp no oficial o Zernio; no el oficial ni el email) pausa TODAS las inscripciones activas del lead, también las de email. Sólo se salva el carril. | `nutricion.ts:4922-4956, 3959-3967`; `nutricion-grafo-motor.ts:441-455, 554-587` | Una opción visible **por camino** (en la flecha del CRON): «Si contesta: se corta / sigue». La migración deja «se corta» en todo lo que no es carril. Alternativa: la condición «Contestó desde que entró a esta automatización». |
| respuesta-tardia-reabre [G] | Una 'completada' con envíos pasa a 'respondio' si el lead escribe. | `nutricion.ts:4958-4988` | Va con la «Reentrada» y con el «Deja de contestar si…» del AI Step. |
| ai-step-elige-la-primera [G] | La primera respuesta la contesta la automatización de id más bajo; desde la segunda, la del último intercambio. | `nutricion.ts:5247-5258`; `setter-conversacion.ts:345-356` | Un solo criterio visible: la más reciente. |
| si-responde-rama-vacia-pasa-a-persona [G] | Una rama sin respuesta cierra la charla «como de una persona», para siempre. | `nutricion.ts:5645-5664` | Una ⚡ operación nueva, «La sigue una persona» (registro de la API, sin tarjeta nueva). Una rama vacía sólo termina esa respuesta. |
| cierre-charla-objetivo-insistencia, contesta-sola-puertas, calificacion-automatica [G] | Cierra con [FIN:BIEN/MAL] o con 3 repeticiones. La IA marca `calificado=false` en cada respuesta y eso impide que salga sola. Revisa plata, links y despedidas sobre el texto ya redactado. | `nutricion.ts:5367-5402, 5411-5459`; `setter-conversacion.ts:236-266` | Decirlo en el AI Step. La calificación ya tiene equivalente: el escenario «Puede no calificar» (`ai-step-escenarios.ts:54`) más ⚡ `marcar_calificado` (`editor-acciones.ts:251`). Sacar `evaluarCalificacion` o volverlo opción del AI Step. |

### D. Envío

| id [zonas] | Qué decide | Dónde | Propuesta |
|---|---|---|---|
| sale-sola-invisible + a-quien-pagó / cliente-sale-solo [E,G,F] | Que salga sola o quede como borrador lo deciden `paso.revisar` o `envio_automatico`, y la casilla ya no está en el editor. Con `fecha_primer_pago`, sale siempre. Hay tres definiciones de «pagó» que no coinciden. | `nutricion-grafo-motor.ts:614-624`; `EditorMensajeWhatsApp.tsx:11-13, 210-215`; `evolution-envio.ts:22-26`; `nutricion-residuo.ts:172-173` | Devolver la casilla «Sale sola / La reviso yo», pintada con `revisarHeredado`. Sacar la excepción del cliente o decirla en la casilla. Unificar las tres definiciones de «pagó» en una función. |
| borrador-pendiente-frena [E,G] | Un borrador pendiente de CUALQUIER automatización frena cada 6 h al próximo mensaje para revisar y a las acciones. | `nutricion.ts:4280-4296, 4572-4686`; `evolution-envio.ts:28-54` | Decirlo en la bandeja y en la acción («espera a que se mande el de arriba»). Que el freno sea por automatización. |
| tope-antiguedad (entrada y segunda mirada) [I,E,G] | Se vuelve a mirar al mandar el primer mensaje y cierra el hilo. Sólo funciona con una raíz. | `nutricion.ts:4203-4220`; `flujo-grafo.ts:1611-1636` | **No borrar la segunda mirada hasta que exista la regla 2.2.** Después alcanza la condición `antiguedad`. Pasar `antiguedad_max_horas` a la tarjeta. |
| canal-apagado-omite-o-espera [E,G] | Omite o espera 24 h según lo que quede después. En el carril se pierde. IG y Messenger cuentan siempre como prendidos. | `nutricion.ts:4368-4396, 4453-4456` | Una sola regla visible al lado del interruptor: «canal apagado = ese mensaje se saltea». |
| mako-tarjeta-fuera-de-horario [E,G] | «MaKo en WhatsApp» sale fuera de horario, aunque el horario no se pueda leer. | `nutricion.ts:3486-3496, 3813-3814` | Una casilla en Configuraciones › Horario, «Los avisos al equipo salen igual», prendida de fábrica. |
| mako-tarjeta-dedup-12h [E,F] | Dedup de 12 h por lead entre automatizaciones (la tarjeta de antes, «Si responde», la API). En Notificaciones no se baja de 12 h. | `mako-tarjeta.ts:362-385`; `avisos.ts:195-210` | Pasar las tarjetas de antes a `partes` y quitar el dedup. Si hace falta espaciar, se hace con DELAY y condición. |
| ~~pausar-automatizacion-cierra~~ **HECHO (14/10): «Pausar» congela; al reactivar sale lo vencido** (falta la corrida-evento «se pausó») [I,G,F] | «Pausar» cierra como 'completada', sin rastro, a cada inscripción que vence. Al reactivar, nadie retoma. | `nutricion.ts:431-438, 3939-3957`; `flujos.ts:283-294` | **Pausar = congelar**: el motor saltea las vencidas de una pausada sin tocarlas. Al reactivar hay que decidir si se reprograman o se descartan. |

### E. Inscripción

| id [zonas] | Qué decide | Dónde | Propuesta |
|---|---|---|---|
| cohorte-etapa-abiertos-90d [I] | El barrido del CRON de etapa toma sólo leads abiertos y con un hito en los últimos 90 días. El evento de la ficha no filtra: dos puertas del mismo CRON deciden distinto. | `nutricion.ts:1142-1179`; `leads.ts:3010` | Medir cuántos leads viejos están parados en etapas con CRON. Después sacar los filtros; quien quiera acotar usa `estado_lead` o `antiguedad`. |
| cohortes-de-antes, evento-inscribe-sin-cohorte, familia-post-agenda, campos-de-antes, requiere, asistido, desenlaces de antes, residuo [I,E,G,F] | Todo el legado: ventanas fijas, el evento `lead_nuevo` que inscribe en las del VSL sin preguntar nada, las dos mitades de «Agendó», `requiere`/`ancla`, el desenlace por silencio, el residuo con su re-pregunta. | `nutricion.ts:1181-1332, 1873-1881, 1225-1251, 4222-4252`; `nutricion-desenlace.ts:238-327`; `nutricion-residuo*.ts` | **Una corrida de migración**: medir filas vivas con esos triggers o campos, publicarlas convertidas (`legadoAGrafo`) y limpiar también `delay_horas`/`ancla` de los flujos explícitos (`SecuenciaPerfil.tsx:272-277`). Después borrar las ramas. El residuo, sólo si sigue vivo, necesita «Está en otra automatización activa» y «Última reunión hace más de N días». |
| entrega-silenciosa-bloquea [I] | La fila que nace 'cancelada' bloquea para siempre al cliente en las automatizaciones de la etapa destino. | `nutricion.ts:2010-2054` | Que la pantalla de quitar la etapa pregunte «¿disparar las automatizaciones de la etapa destino?». |
| etiqueta-sin-horario-solo-evento [I] | La etiqueta puesta en lote o por el espejo no dispara. | `nutricion-grafo-motor.ts:869-872`; `etiquetas.ts:468-482` | Decirlo en la tarjeta CRON de etiqueta. |
| manual-no-reabre (respondio/handoff) [I] | No reinscribe a quien está en charla o con una persona. | `nutricion-inscripcion-manual.ts:94-114` | Lo decide Martín: preguntarlo en el «sí». La parte de 'cancelada' es protección (sección 4). |
| movimiento-a-mano-sin-evento [I] | `setPipelineStage` (kanban, ⚡ y confirmaciones) no dispara el CRON al instante. El comentario de `leads.ts:2983-2987` es falso. | `leads.ts:2779-2787`; `app/crm/actions.ts:1206` | (integridad) Disparar `enrolarPorEvento('etapa')` desde `setPipelineStage` cuando cambia la etapa efectiva. |
| reserva-limpia-etapa-a-mano (+ borra el no-show) [I,F] | La reserva saca la etapa puesta a mano y la firma **«MaKo»** (`AUTOR_SISTEMA`, `etapa-historial.ts:49`). | `leads.ts:1959-1977, 1992-1998`; `nutricion-etapa.ts:148-164` | Lo decide Martín. Lo mínimo y sin riesgo: firmarlo «Calendly»/«Cal.com». Ese «MaKo lo puso» llevó al diagnóstico equivocado. Pasarlo a automatización exige un CRON nuevo «Reservó una reunión», que hoy no existe (`disparadores.ts:555-565`). |

### F. Fuera de Automations (otros chats; una línea cada uno)

- **CRM** (`crm-auto` T1/T2/T3/T6 y plazos por etapa). T1 manda a No Show a quien canceló, porque lee la hora de una cancelada (`crm-auto-plan.ts:212-221`). T2 y T6 ya se pueden armar con CRON Etapa → DELAY → `sigue_en_etapa_cron` → ⚡ `proponer_cambio_etapa`. T1 necesita un DELAY «después de la reunión» y la operación «asistencia por grabación de Fathom». El espejo etiqueta↔etapa se ve en el CRM.
- **Avisos del store** (sólo super admin): `reunion-cancelada` (avisa aunque no haya cambiado nada, `calendly/route.ts:657-666`), lead nuevo de Meta y de landing (NO vienen prendidos por defecto), fusión de leads, `reunion-ocurrio-fathom`, `cs-cliente-sin-contacto`, objetivos, Plan (además CIERRA tareas, `todo-seeds.ts:117-136`), insistencias, `avisos_programados`, resumen de la mañana, reportes (el diario y el horario corren sólo para el ws1), cuota por vencer. Hay además un **segundo motor** vivo: `dispararEvento` (`flujos.ts:102-127`), con 7 llamadas desde webhooks. Faltan los Eventos de MaKo «Un lead cancela una reunión» (Calendly y Cal.com), «Terminó una reunión», «Entra un lead» y `cuota_por_vencer`.
- **Pagos y curso**: `pago-gana-lead`, `curso-al-ganar` (no hay operación «invitar al curso»), `gracias-gana-lead`, mensajes de sesión, recordatorio de clases y paso automático de etapa (en ese caso llegan dos mensajes, `curso-avance.ts:108-114`). Post-llamada: gasta IA sin interruptor (`post-llamada.ts:119-158`).
- **Pedido de Martín (CRM):** que el asistente de mover pregunte la HORA (`completeStageMoveAction`, `app/crm/actions.ts:509-560`, guarda sólo la fecha). Escribe `junta_1_at` y con eso el carril y la condición quedan exactos.

---

## 2. Propuesta mínima en Automations

### 2.1 La condición nueva `reunion_en_pie`: una sola pregunta — HECHO (14/10, sin push)

Junta lo que hoy hacen la guarda (`nutricion.ts:4099`), el rechazo manual (`:2294`), el `sin_reunion` en lo que no es su hilo, el corte del AI Step (`:5140`), `REUNION_POR_DELANTE` (`plantillas-automatizaciones.ts:315, 327-328, 333, 336, 365`), `r1_pendiente` (la retirada, con 12 h de gracia, `condiciones-catalogo.ts:553-560`) y el `>= hoy` de `agendado_sin_confirmar`.

En `CONDICIONES`, sección 'Agenda y llamadas', junto a `reunion_en` (`condiciones-catalogo.ts:546`):
```ts
{ id: 'reunion_en_pie', reuniones: true, seccion: 'Agenda y llamadas', ambito: 'adquisicion',
  rotulo: ['Su reunión sigue en pie', 'Su reunión ya pasó o se canceló'], negable: true,
  valor: NINGUNO, fuentes: ['lead'], evaluar: enPieEntre }
```
- **Regla:** está en pie si NO está cancelada (`at && fecha === null`), si `asistio == null` (el verificador marcó que `reunionEnPie` no la mira; es más estricto que hoy y más seguro) y si su fin es posterior a ahora. El fin es la hora; con una fecha sola, las 23:59:59 **en la zona del negocio** (darle a `finDeLaReunionMs` un `tz`; la zona ya la usa el carril, `zonaCarril`, `nutricion.ts:3539`).
- **Sin etapas elegidas** mira la R1 o la R2. **Con etapas**, los lugares de `lugaresDeFila` (`condiciones-catalogo.ts:303-320`).
- **Datos:** sumar a `LugarReunion` / `catalogoDeLead` (`nutricion-grafo-motor.ts:746-764`) `finMs` y `cancelada` por lugar, más `enPie: boolean`. No hace falta ninguna fuente nueva.
- **Bug de lectura, de paso:** que `r1.fechaMs`/`r2.fechaMs` den null en una cancelada. Arregla `reunion_agendada` y `reunion_en` con etapas. Ojo: también cambia `agendo` (vía `agendoDe`) y por lo tanto `form_sin_agenda`, `vsl_sin_agendar` y `vsl_poco`. Un cancelado pasa a «no agendó»; lo tiene que validar Martín.
- **«Probar»:** el lead de prueba no tiene reunión (`simulador-grafo.ts:256`). Darle una (por ejemplo, mañana a las 10:00), o «Un Lead Agendó Llamada» no muestra nada.

### 2.2 Regla técnica previa: el reintento vuelve a pasar por su condición — HECHO (14/10, sin push)

Hoy un fallo (+4 h o +24 h, `nutricion.ts:4854`), un borrador que espera (6 h) o el anti-ban dejan la fila parada en el mensaje, y la condición de arriba no se vuelve a evaluar. La guarda escondida existía justamente por eso (AGENTS.md:2678-2700, el caso del 25/09).

Lo mínimo: antes de mandar un mensaje cuyo **padre inmediato es una condición** (`padresSinVuelta`; `problemasDeForma` no deja dos condiciones seguidas, así que basta mirar un nivel), y siempre que no se mande en la misma corrida en que se resolvió, volver a evaluar esa condición **sin repartir paralelos**. Si ya no lleva a este nodo, se cierra el hilo con un rastro.

Con esto se pueden borrar después también la segunda mirada de la antigüedad (`nutricion.ts:4212-4219`) y la del residuo (`:4114-4125`).

**Rastro:** cuando una condición termina un camino que tenía un mensaje por delante, dejar un 'omitido' con el texto de la fila (`textoCondicion`). Hoy sólo queda en el primer paso (`nutricion.ts:4004-4010`), y sin rastro el bug 5 no se pudo diagnosticar.

### 2.3 Migración: qué tiene que llevar la condición explícita para no cambiar de comportamiento — script listo (scripts/migrar-condicion-reunion.ts), corre después del deploy

**Plantilla `lead-agendo`** (`plantillas-automatizaciones.ts:313-347`). Sea `EN_PIE = { campo: 'reunion_en_pie' }`:
- `la_r`, las dos ramas de `la_p`, `la_c` y `la_m`: cambiar `REUNION_POR_DELANTE` por `EN_PIE, SIGUE_EN_LA_ETAPA` en la misma rama (es un AND, sin tarjetas nuevas).
- Carril (`la_e24→la_w24`, `la_e60→la_w60`, `la_e30→la_mk2`, `la_e15→la_w15`, `la_me24→la_m2`): una condición `[[SIGUE_EN_LA_ETAPA]]` entre cada DELAY y su mensaje. Son 5 tarjetas: reemplazan a la línea 537 y a la guarda, que miraban cada toque. Lo de cancelada, pasada o sin hora lo sigue cubriendo el DELAY (2.4-c). Si Martín las ve como «tarjetas por agregar», la alternativa es dejar sólo `la_r` y aceptar que a un lead que sale de la etapa le lleguen los recordatorios.
- AI Step `la_ia`: «Deja de contestar si: Su reunión ya pasó o se canceló».

**Plantilla `lead-no-asistio`** (`:365`): `ln_c` pasa a `[[EN_PIE], null]`. Hoy, con una fecha sola después del mediodía, insiste a quien ya reagendó para hoy. Con `asistio==null` la reunión a la que faltó deja de contar sola.

**Flujos vivos.** Se identifican corriendo `preparaReunion` (`nutricion-familias.ts:120`) sobre todas las `nutricion_secuencias` sin archivar (sólo lectura). Por las notas: **#213 ws1** (Mauricio, PRENDIDA, editada el 12/10), #212 y #221 si siguen vivas, y el «Un Lead Agendó Llamada» del ws13 (#241, aviso → 5 min → WhatsApp). Ninguno tiene una condición de reunión: `flujo-legado.ts:278-299` no la agrega al convertir. Para #213 hay que releer sus pasos, porque Mauricio los tocó. Según el diseño del 11/10 (`docs/diseno-undecima-tanda.md:320-340`):
- `n2jl2v4` («Ya le escribiste» → n136j5s, si no → o0) pasa a tener dos ramas: `[[ya_contactado, EN_PIE, SIGUE]→n136j5s]`, `[[EN_PIE, SIGUE]→o0]`, y si no → fin. No puede ir otra condición pegada.
- `[[EN_PIE, SIGUE]]` delante de `u11aviso`, delante de `o1` (después de `nh92v3h`) y delante de `ne9jyr0` (después de `n4z5uil`); `[[SIGUE]]` en el carril (`u11e60`, `u11e15`); y el «Deja de contestar si…» en `nb7dt1y`.
- Correr con `--dry-run`: es un cliente (memoria «Cambios impactan a clientes»).

**Recién después se borra:**
- `nutricion.ts:4099-4107`, `:2288-2294` y el `sinReunion` de `nutricion-inscripcion-manual.ts:110`.
- `reunionFutura` en `nutricion.ts:5140`.
- Las llamadas de reuso a `preparaReunion` pasan a la «Reentrada».
- Tests a reescribir: `tests/reunion-ya-paso.test.ts`, `tests/motor-entrada-etapa.test.ts:180` (busca el `if (anclada || preparaReunion(sec))` con una regex), `tests/nutricion-inscripcion-manual.test.ts:173` y `tests/reunion-fecha-sola-del-dia.test.ts`.
- **AGENTS.md:2678-2700**: reescribir la regla como «un mensaje que habla de un MOMENTO lleva una CONDITION visible delante, y el reintento la vuelve a pasar». Si no, la próxima sesión vuelve a poner la guarda.

### 2.4 El resto, en pocas piezas (ninguna es una tarjeta nueva)

- **a. CRON «Reentrada»** (sección 1-B).
- **b. ~~Por camino, «Si contesta: se corta / sigue»~~ HECHO como condición: «No contestó desde que entró»** (sección 1-C).
- **c. DELAY «antes de la reunión»**: el texto visible y el campo de tolerancia (sección 1-A).
- **d. Mensaje**: la casilla «Sale sola», y que el borrador pendiente se diga.
- **e. Pausar = congelar.**
- **f. AI Step**: «Deja de contestar si…», y que el cierre por objetivo o por insistencia se diga.
- **g. ⚡** «La sigue una persona».
- **h. Configuraciones › Horario**: la casilla de «MaKo en WhatsApp».
- **i. Condiciones nuevas, sólo si el residuo sigue vivo**: «Está en otra automatización activa» y «Última reunión hace más de N días».
- **j. Migración del legado** (sección 1-E).

**Orden sugerido:** 2.1 → 2.2 → plantillas → migración de #213/#241 en ws3 primero → borrar la guarda → `sigue_en_etapa_cron` en entrega → a, b, e → el resto.

---

## 3. «Stop»

- **Hoy ya existe, por camino.** La rama o el «Si no» sin flecha devuelve `fin` con «la condición termina aquí» (`nutricion-grafo-motor.ts:215-216`), y el motor cierra ESE hilo (`nutricion.ts:3989-4011`, `alcance 'hilo'`). La inscripción termina si no le quedan otros caminos (`nutricion-hilos.ts:225-241`). **No hace falta la tarjeta.**
- **Lo que falta es que se vea.** La salida vacía se dibuja como un punto con «＋», sin decir que termina (`flujo-conversacion.ts:963-964, 989-992`). Hay que rotularla «Termina». — **HECHO (14/10): las filas con rótulo sin flecha dicen «Termina».**
- **«Cortar en cualquier momento»** (por ejemplo, se cancela durante un DELAY de 3 días): el motor no despierta un hilo dormido, pero no hace falta. **DELAY → CONDITION → mensaje** evalúa la condición al vencer la espera, justo antes de mandar; durante la espera no sale nada, así que el efecto es el mismo. Los dos casos en que no alcanza:
  1. **El reintento** (sección 2.2): es la pieza clave.
  2. **Los caminos en paralelo**: cada uno necesita su condición. Si eso resulta incómodo, lo mínimo es una propiedad de la salida vacía: «Termina este camino / **Termina toda la automatización**». `resolverControl` devuelve `fin` con `alcance: 'inscripcion'`, la misma vía que ya usa `sin_reunion` (`nutricion.ts:4015`). Para «Un Lead Agendó Llamada» no hace falta: cada camino lleva la suya.
- **No existe** una ⚡ para sacar al lead de OTRA automatización. Hoy no se necesita.

---

## 4. Protecciones de plataforma: DECISIONES para Martín

| Protección | Qué protege | Sin ella | ¿Se configura hoy? |
|---|---|---|---|
| «Misma persona» (20 h; WhatsApp 3-72, email 1-168), `nutricion.ts:4398-4408, 2620-2694` | El baneo de la línea no oficial; no encimarse a un mensaje escrito a mano | Ráfagas al mismo lead | **Sí.** Oculto: cuentan los mensajes a mano (`wa_mensajes` from_me) y los masivos; IG, Messenger y «Si responde» no pasan por él |
| Reunión a ≤48 h → 3 h, `nutricion.ts:411-412, 2630-2645` | Que la preparación no quede frenada 20 h antes de la reunión | El «1 h antes» frenado | No; ni siquiera se ve |
| El carril ignora anti-ban, cupo en la corrida y horario, `nutricion.ts:3481-3536, 4403, 4883` | Que el recordatorio salga a su hora | «15 min antes» frenado por el horario | No. Cuenta para el cupo de las corridas siguientes y frena 20 h a los otros caminos |
| Topes WhatsApp 40/día y 6/hora, email 100, `nutricion.ts:3497-3536` | La línea y el dominio | Baneo | **Sí.** Oculto: IG y Messenger gastan el cupo de WhatsApp en la corrida; sin límites legibles no sale nada |
| ⚡ sin cupo ni anti-ban, `nutricion.ts:3472-3476, 4259-4271` | Que «mover etapa» no espere a los WhatsApp | — | No. Falta listar qué operaciones le mandan algo al lead |
| Residuo: 1 por hora y 10 por día, `nutricion.ts:2536-2553, 4414-4426` | Que no tape la post-agenda | Más de 60 juntas al volver la línea | No (`limites-envio.ts:19` lo deja afuera a propósito) |
| Contacto bloqueado → omitido y sigue, `nutricion.ts:4560-4561` | No escribirle a quien bloqueó | — | No. Sólo lo mira el no oficial; ni el oficial, ni el email, ni lo social |
| Plantilla de Meta no aprobada, `nutricion.ts:4697-4728` | Límite del proveedor | Envíos que Meta rechaza | — |
| Email: baja, sin email, sin dominio, `nutricion.ts:4747-4798, 4842-4849` | La baja es legal | Escribirle a quien pidió que no | Sin hilos, cierra la inscripción como **'cancelada'**: en un flujo de un solo camino corta también los WhatsApp siguientes y nunca se reusa. «Sin dominio» es configuración, no protección |
| IG/Messenger: la ventana de Meta de 24 h | Límite de Meta | — | `puede_escribir_*` |
| Respuesta fija una vez cada 20 h, `nutricion.ts:5697-5713` | El «¡Gracias!» repetido | Uno por cada mensaje del lead | No |
| Inscripción manual que no reabre una cancelada o una baja, `nutricion-inscripcion-manual.ts:94-114` | La baja | Escribirle a quien se dio de baja | — (pero ahí caen también el archivado y la entrega silenciosa, que no son bajas) |
| Borrador para quien no pagó por la línea no oficial, `evolution-envio.ts:1-24` | El envío en frío | Envío directo | Por mensaje, con un dato que ya no se ve (sección 1-D) |
| Avisos de sistema (Meta frenada sin dedup, Pixel apagado que no se apaga), `alerta-critica.ts:205-235`; `avisos-catalogo.ts:538` | Que el cliente se entere de una caída | — | /mensajes (super admin). Regla del 13/10: «MaKo a todos los grupos» |

---

## 5. Bug 5: la causa, medida el 14/10

La síntesis de la corrida acertó en que la reserva de Calendly de las 02:05 reinició el flujo, y se quedó con «el DELAY
reiniciado» como explicación. Los avisos de `notificaciones` del ws1 la cierran. La tarjeta de MaKo de la #213 salió a las
02:05:16. A las 02:08:16 el lead contestó un mensaje que Mauricio le mandó a mano (un código). `pausarPorRespuesta` frenó el
camino principal (el audio vencía ~02:10) y no salió nada más. Detalle en docs/hallazgos-chatbot.md («No salió el mensaje»).
Es el ítem «pausa-por-respuesta» de la sección 1-C: el primero a resolver.

## 6. Lo que quedó sin mirar

- **La base:** nada se midió. Habría que ver: flujos con `preparaReunion`, filas vivas con triggers de antes (`agendado_*`, `vio_vsl_*`, residuo), `antiguedad_max_horas`, `envio_automatico`, la clave `chatbot.recordatorio_reunion` en `activo:true` sin fila, flujos activos en el store, `avisos_programados`, `respondio` sin próximo envío en las de la galería, y 'completada' sin envío en las pausadas.
- **Código:** `pausarPorRespuesta` por dentro; el emisor `reunion-recordatorio` y su marca compartida con el carril; `lib/canal-zernio.ts` (la ventana de 24 h); `chatbot.run.ts`; qué operaciones del registro le mandan algo al lead; `nutricion-hilos.ts` entero; `aviso-evento.ts` después de la línea 120; `api-mako/flujo.ts`; `nutricion-paso-accion.ts`; el cron `nutricion` entero; doer-flush; onboarding-extraccion; cerrar-por-commits; n8n (fuera del repo).
- **Sin comprobar:** con `vercel ls`, que `cf494e2a` fuera el deploy vivo a las 01:57 UTC. También la hipótesis de que, si `fecha_junta_1` puesta a mano no coincide con el día de `junta_1_at`, la regla estricta del carril descarta la reunión (`nutricion-reinscripcion.ts:111-113`).
- **Fuera de la zona:** `wa-mensaje-entrante` se emite también cuando MaKo contestó (`nutricion.ts:5461-5475`), y `reporte-diario`/`reporte-horario` corren sin `runWithWorkspace`.

## Apéndice: los 162 ítems, por zona

Clase corregida por el verificador. `negocio` = se depreca y pasa al flujo; `proteccion_plataforma` = decide Martín;
`integridad_tecnica` = se queda (no es una decisión).

### inscripcion (29)

| id | qué decide | clase | dónde | hoy se puede con |
|---|---|---|---|---|
| `reunion-ya-paso` | Antes de cada mensaje de un flujo de reunión, MaKo corta el flujo entero si la reunión ya pasó | negocio | lib/nutricion.ts:4084-4107, lib/nutricion-reinscripcion.ts:181-192, lib/nutricion-reinscripcion.ts:163-179 | reunion_en (en parte: regla laxa, fecha sola = mediodía MX, «no sé» → salida no) |
| `delay-antes-reunion-sin-reunion` | Un DELAY «antes de la reunión» sin reunión por delante cierra el flujo entero, no sólo su rama | negocio | lib/nutricion-grafo-motor.ts:228-235, lib/nutricion.ts:3978-3981, lib/nutricion.ts:4013-4017 | reunion_en delante del DELAY (reunion_agendada NO sirve: cuenta también reunione |
| `prepara-reunion-por-forma` | MaKo decide sola que un flujo «prepara una reunión» y eso le prende cuatro reglas ocultas | negocio | lib/nutricion-familias.ts:100-130, lib/nutricion-familias.ts:60-62, lib/pipeline.ts:484 | nada |
| `reunion-ya-paso-al-inscribir-a-mano` | Una inscripción pedida a mano o por «Ir a» no entra a un flujo de reunión si la reunión ya pasó | negocio | lib/nutricion.ts:2286-2294, lib/nutricion.ts:2309-2316, lib/nutricion-inscripcion-manual.ts:36-40 | nada |
| `una-vez-por-flujo` | Un lead entra UNA sola vez en la vida a cada automatización | negocio | lib/nutricion-reinscripcion.ts:4-11, lib/nutricion.ts:1621-1626, lib/nutricion.ts:2172-2184 | nada |
| `reuso-al-reagendar` | Si el lead agenda OTRA reunión, MaKo le reinicia desde cero el flujo de reunión | negocio | lib/nutricion-reinscripcion.ts:213-238, lib/nutricion-reinscripcion.ts:262-314, lib/nutricion-reinscripcion.ts:383-405 | nada |
| `misma-reunion-por-dia` | MaKo decide que es «la misma reunión» comparando el DÍA en hora de México, aunque después llegue la hora real | negocio | lib/nutricion-reinscripcion.ts:194-209, lib/nutricion-reinscripcion.ts:303-307, lib/nutricion-reinscripcion.ts:137-161 | nada |
| `reuso-sin-saber-que-reunion` | Si no se sabe qué reunión preparaba, MaKo reinicia el flujo sólo si al lead no le llegó nada | negocio | lib/nutricion-reinscripcion.ts:246-252, lib/nutricion-reinscripcion.ts:282-291, lib/nutricion-reinscripcion.ts:309-313 | nada |
| `familia-post-agenda` | Las dos mitades de «Agendó» se excluyen entre sí, y MaKo elige cuál le toca a cada lead | negocio | lib/nutricion-familias.ts:20-39, lib/nutricion-familias.ts:151-159, lib/nutricion.ts:1225-1251 | ya_contactado |
| `cohorte-etapa-abiertos-90d` | El CRON de etapa sólo barre leads ABIERTOS y con algún hito en los últimos 90 días | negocio | lib/nutricion.ts:1142-1179 | estado_lead (en parte); para los 90 días sobre el último hito, nada (antiguedad  |
| `cohortes-de-antes-ventanas-fijas` | Los CRON «de antes» traen ventanas y umbrales fijos que no se ven | negocio | lib/nutricion.ts:389-391, lib/nutricion.ts:1138-1140, lib/nutricion.ts:1181-1332 | etapa_actual + form_sin_agenda, vsl_pct, vsl_sin_agendar, vsl_poco, antiguedad,  |
| `evento-inscribe-sin-cohorte` | Un lead nuevo de Meta entra a «Vio el VSL» y a «Vio poco del VSL» sin que nadie mire el VSL | negocio | lib/nutricion.ts:1873-1881, lib/nutricion.ts:2093-2161, lib/nutricion.ts:2113-2118 | form_sin_agenda / vsl_sin_agendar / vsl_poco como primera condición |
| `tope-antiguedad` | «Sólo leads de menos de N h» se aplica al entrar y otra vez al mandar el primer mensaje | negocio | lib/nutricion.ts:1517-1553, lib/nutricion.ts:1576, lib/nutricion.ts:1715 | antiguedad |
| `residuo-cohorte` | Quién entra a «Tuvo reunión hace +45 días y no cerró» lo decide una regla fija | negocio | lib/nutricion-residuo.ts:22-29, lib/nutricion-residuo.ts:41-47, lib/nutricion-residuo.ts:86-123 | estado_lead, pago, asistio_reunion, tiene_telefono (en parte) |
| `residuo-vigente-al-mandar` | Antes de cada mensaje del residuo, MaKo vuelve a preguntar todo y corta si el lead pagó, agendó u otra automatización le habla | negocio | lib/nutricion.ts:3875-3883, lib/nutricion.ts:4109-4125, lib/nutricion-residuo-cohorte.ts:113-131 | pago, estado_lead, reunion_en (en parte); para «otra automatización le habla», n |
| `residuo-ritmo` | El residuo sale de a 10 por día y 1 por hora, y lo escalona MaKo | proteccion_plataforma | lib/nutricion-residuo.ts:49-84, lib/nutricion-residuo.ts:249-276, lib/nutricion.ts:1605-1610 | nada |
| `residuo-bloqueado` | El residuo deja afuera a los teléfonos bloqueados y a los leads sin teléfono | proteccion_plataforma | lib/nutricion-residuo.ts:161-164, lib/nutricion-residuo.ts:227-232, lib/nutricion-residuo-cohorte.ts:72 | tiene_telefono (sólo la parte del teléfono) |
| `salir-de-etapa-venta-no-corta` | Si el lead sale de la etapa del CRON (venta), el flujo sigue como si nada | negocio | lib/nutricion.ts:1951-2008, lib/nutricion.ts:2131-2138, lib/leads.ts:2698-2812 | sigue_en_etapa_cron |
| `salir-de-etapa-entrega-cierra` | En la ENTREGA, cambiar de etapa le cierra al cliente lo pendiente de la etapa que deja | negocio | lib/nutricion.ts:1951-2008, lib/nutricion.ts:2129-2138, lib/nutricion-etapa.ts:221-242 | sigue_en_etapa_cron (ámbito entrega) |
| `entrega-silenciosa-bloquea` | Mover clientes «en silencio» al quitar una etapa les bloquea para siempre las automatizaciones de la etapa nueva | negocio | lib/nutricion.ts:2010-2054 | nada |
| `reserva-limpia-etapa-a-mano` | Una reserva de Calendly saca al lead de la etapa puesta a mano y lo pasa a Agenda R1, firmado por «MaKo» | negocio | lib/leads.ts:1970-1977, lib/leads.ts:1992-1998, lib/leads.ts:2910-2926 | nada hoy (ver corrección) |
| `reserva-inscribe-en-su-etapa` | Una reserva inscribe al instante en el CRON de la etapa efectiva del lead | integridad_tecnica | lib/nutricion.ts:2089-2093, lib/nutricion.ts:2062-2075, lib/nutricion.ts:2119-2128 | etapa_actual (el CRON) |
| `movimiento-a-mano-sin-evento` | Mover a mano por el kanban o por el asistente no dispara al instante el CRON de etapa | integridad_tecnica | lib/leads.ts:2698-2812, lib/leads.ts:2779-2787, lib/leads.ts:2952-3014 | nada |
| `pausar-automatizacion-cierra` | Pausar una automatización cierra, sin mandar nada, a todos los que estaban adentro | negocio | lib/nutricion.ts:431-438, lib/nutricion.ts:3939-3957, lib/nutricion-inscripcion-manual.ts:18-21 | nada |
| `ir-a-no-repite-objetivo-hecho` | «Ir a otra automatización» no entra si el lead ya pasó por ahí o si ya cumplió el objetivo de la otra | negocio | lib/nutricion.ts:4019-4034, lib/nutricion.ts:2252-2256, lib/nutricion.ts:2308-2315 | agendo / pago / calificado delante del «Ir a» (para objetivo_hecho); para ya_est |
| `manual-no-reabre` | Inscribir a mano no reabre una inscripción cancelada, en charla o en manos de una persona | proteccion_plataforma | lib/nutricion-inscripcion-manual.ts:16-35, lib/nutricion-inscripcion-manual.ts:105-116 | nada |
| `etiqueta-sin-horario-solo-evento` | «Se le puso la etiqueta» sin horario dispara sólo en el momento; nunca si se puso en lote o por el espejo de una etapa | negocio | lib/nutricion-grafo-motor.ts:858-872, lib/nutricion.ts:1067-1087, lib/nutricion.ts:1693 | nada |
| `emisor-no-lleva-leads` | El recordatorio y el «Evento de MaKo» no se inscriben en el motor: si llega una fila, se cancela | integridad_tecnica | lib/nutricion.ts:1130-1137, lib/nutricion.ts:2281-2284, lib/nutricion.ts:3888-3901 | nada |
| `integridad-inscripcion` | Candados técnicos de la inscripción: una vez por automatización, compare-and-set, de a una y paginado | integridad_tecnica | lib/nutricion.ts:1655-1662, lib/nutricion.ts:1696-1709, lib/nutricion.ts:1690 | nada |

### envio (33)

| id | qué decide | clase | dónde | hoy se puede con |
|---|---|---|---|---|
| `reunion-ya-paso` | Antes de cada paso de un flujo «que prepara una reunión», si la reunión pasó se cierra todo el flujo | negocio | C:/dev/wt-undecima/lib/nutricion.ts:4084-4108, C:/dev/wt-undecima/lib/nutricion-reinscripcion.ts:59-61, C:/dev/wt-undecima/lib/nutricion-reinscripcion.ts:163-192 | reunion_en (op menor_igual, 720 h), sólo en parte: corta sólo su camino, con fec |
| `delay-sin-reunion-cierra-todo` | Un DELAY «antes de la reunión» sin reunión por delante cierra todos los caminos, no sólo el suyo | negocio | C:/dev/wt-undecima/lib/nutricion.ts:4013-4017, C:/dev/wt-undecima/lib/nutricion-grafo-motor.ts:228-235 | nada: un reunion_en delante del DELAY evita llegar sin reunión, pero no cambia q |
| `carril-sin-hora` | Un recordatorio no sale si la reunión no tiene hora: se cierra ese camino | negocio | C:/dev/wt-undecima/lib/nutricion-grafo-motor.ts:520-542, C:/dev/wt-undecima/lib/nutricion.ts:4168-4176, C:/dev/wt-undecima/lib/nutricion-reinscripcion.ts:110-115 | nada |
| `carril-lead-no-abierto` | Los recordatorios se cortan si el lead ya no está «abierto» | negocio | C:/dev/wt-undecima/lib/nutricion-grafo-motor.ts:537, C:/dev/wt-undecima/lib/nutricion.ts:4147-4151 | estado_lead (= abierto), pero colgada de CADA DELAY «antes de la reunión», no só |
| `carril-tolerancia-12-min` | Un recordatorio que se atrasó más de 12 minutos no sale y el camino sigue | negocio | C:/dev/wt-undecima/lib/nutricion-grafo-motor.ts:543-549, C:/dev/wt-undecima/lib/recordatorio-lead.ts:58, C:/dev/wt-undecima/lib/nutricion.ts:4135-4146 | nada |
| `carril-no-espera` | Un recordatorio que no puede salir AHORA se pierde, no espera | negocio | C:/dev/wt-undecima/lib/nutricion.ts:4178-4190, C:/dev/wt-undecima/lib/nutricion.ts:4289-4295, C:/dev/wt-undecima/lib/nutricion.ts:4572 | nada |
| `carril-exento-antiban-topes-horario` | Los recordatorios de reunión se saltan el anti-ban, los topes y el horario de envío | proteccion_plataforma | C:/dev/wt-undecima/lib/nutricion.ts:3481-3496, C:/dev/wt-undecima/lib/nutricion.ts:3522-3526, C:/dev/wt-undecima/lib/nutricion.ts:4403-4404 | nada |
| `mako-tarjeta-fuera-de-horario` | «MaKo en WhatsApp» (aviso al grupo) sale aunque el negocio esté fuera de horario | negocio | C:/dev/wt-undecima/lib/nutricion.ts:3494-3496, C:/dev/wt-undecima/lib/nutricion.ts:3813-3814, C:/dev/wt-undecima/lib/nutricion-grafo-motor.ts:404-409 | nada |
| `respondio-solo-carril` | Cuando el lead contesta, se corta todo lo que no sea recordatorio | negocio | C:/dev/wt-undecima/lib/nutricion.ts:3905-3908, C:/dev/wt-undecima/lib/nutricion.ts:3959-3967, C:/dev/wt-undecima/lib/nutricion.ts:4064-4069 | respondio (negada, «Nunca te escribió»), sólo en parte: mide «alguna vez» y no « |
| `residuo-re-pregunta` | El flujo del «residuo» re-pregunta al mandar si el lead sigue siendo residuo, y si no, lo cierra | negocio | C:/dev/wt-undecima/lib/nutricion.ts:3874-3883, C:/dev/wt-undecima/lib/nutricion.ts:4109-4125, C:/dev/wt-undecima/lib/nutricion-residuo-cohorte.ts:113-131 | en parte: estado_lead (= abierto), pago (negada), tiene_telefono; no hay condici |
| `residuo-un-turno-por-hora` | El residuo manda como mucho 1 por hora y 10 por día (cableado) | proteccion_plataforma | C:/dev/wt-undecima/lib/nutricion.ts:3741-3748, C:/dev/wt-undecima/lib/nutricion.ts:4414-4426, C:/dev/wt-undecima/lib/nutricion.ts:2526-2553 | nada |
| `antiban-misma-persona` | Freno de horas entre dos mensajes a la misma persona, por canal | proteccion_plataforma | C:/dev/wt-undecima/lib/nutricion.ts:3871, C:/dev/wt-undecima/lib/nutricion.ts:4398-4408, C:/dev/wt-undecima/lib/nutricion.ts:2620-2694 | Automations › Configuraciones › Límites › «Misma persona» (las horas, WhatsApp 3 |
| `excepcion-reunion-cerca` | Con la reunión a 48 h o menos, el freno de WhatsApp baja a 3 h (cableado) | proteccion_plataforma | C:/dev/wt-undecima/lib/nutricion.ts:407-412, C:/dev/wt-undecima/lib/nutricion.ts:2625-2645, C:/dev/wt-undecima/lib/nutricion.ts:2685-2690 | nada |
| `topes-whatsapp-email` | Topes de WhatsApp por día y por hora, y de email por día | proteccion_plataforma | C:/dev/wt-undecima/lib/nutricion.ts:3497-3536, C:/dev/wt-undecima/lib/nutricion.ts:3792, C:/dev/wt-undecima/lib/nutricion.ts:3812 | Automations › Configuraciones › Límites (Por día, Por hora, Email por día) |
| `acciones-sin-cupo-ni-antiban` | Las ⚡ Acciones no gastan ni respetan el tope ni el freno de 20 h | proteccion_plataforma | C:/dev/wt-undecima/lib/nutricion.ts:3513-3521, C:/dev/wt-undecima/lib/nutricion.ts:3472-3476, C:/dev/wt-undecima/lib/nutricion.ts:4259-4271 | nada |
| `horario-de-envio` | Horario de envío del negocio | negocio | C:/dev/wt-undecima/lib/nutricion.ts:3486-3496, C:/dev/wt-undecima/lib/nutricion.ts:2426-2428, C:/dev/wt-undecima/lib/nutricion.ts:2464-2483 | Automations › Configuraciones › Horario (PESTANAS_CONFIGURACIONES, Configuracion |
| `sale-sola-invisible` | Si un WhatsApp sale solo o queda como borrador lo decide un dato que ya no se ve | negocio | C:/dev/wt-undecima/lib/nutricion-grafo-motor.ts:614-624, C:/dev/wt-undecima/lib/nutricion.ts:4534-4535, C:/dev/wt-undecima/app/automations/EditorMensajeWhatsApp.tsx:11-13 | nada |
| `a-quien-pago-sale-solo` | A un lead que ya pagó, el WhatsApp le sale directo aunque el mensaje diga «revisar» | negocio | C:/dev/wt-undecima/lib/evolution-envio.ts:16-26, C:/dev/wt-undecima/lib/nutricion.ts:4290, C:/dev/wt-undecima/lib/nutricion.ts:4566 | pago (sólo para ramificar; «sale sola o borrador» no es una tarjeta) |
| `borrador-pendiente-frena` | Un borrador sin mandar frena los pasos siguientes del lead, de a 6 horas | negocio | C:/dev/wt-undecima/lib/nutricion.ts:4280-4296, C:/dev/wt-undecima/lib/nutricion.ts:4572-4575, C:/dev/wt-undecima/lib/nutricion.ts:4618-4621 | nada |
| `tope-antiguedad-primer-paso` | El primer mensaje vuelve a mirar «llegó hace más de N h» al mandar y cierra | negocio | C:/dev/wt-undecima/lib/nutricion.ts:4203-4220, C:/dev/wt-undecima/lib/nutricion.ts:1532-1534, C:/dev/wt-undecima/lib/flujo-grafo.ts:1611-1636 | antiguedad («Llegó hace menos de») |
| `campos-de-antes-en-el-motor` | Los campos de antes (`requiere`, `ancla`, `envio_automatico`) siguen decidiendo por detrás | negocio | C:/dev/wt-undecima/lib/nutricion.ts:4222-4252, C:/dev/wt-undecima/lib/nutricion.ts:4192-4201, C:/dev/wt-undecima/lib/nutricion.ts:1359-1369 | ya_contactado, respondio, DELAY «antes de la reunión» (lo que legadoAGrafo pone  |
| `canal-apagado-omite-o-espera` | Con el canal apagado, el paso se saltea o espera 24 h según lo que quede adelante | negocio | C:/dev/wt-undecima/lib/nutricion.ts:4368-4396, C:/dev/wt-undecima/lib/nutricion.ts:4453-4456, C:/dev/wt-undecima/lib/envio-flags.ts:23-31 | nada |
| `contacto-bloqueado` | A un contacto bloqueado no se le manda, y el flujo sigue | proteccion_plataforma | C:/dev/wt-undecima/lib/nutricion.ts:4560-4561, C:/dev/wt-undecima/lib/nutricion.ts:4859-4870, C:/dev/wt-undecima/lib/evolution-block.ts:28-33 | nada (no hay condición «Contacto bloqueado») |
| `plantilla-meta-no-aprobada` | Por el WhatsApp oficial, una plantilla no aprobada no sale | proteccion_plataforma | C:/dev/wt-undecima/lib/nutricion.ts:4697-4728 | nada |
| `email-baja-sin-email-sin-dominio` | Email: baja, sin email o sin dominio propio | proteccion_plataforma | C:/dev/wt-undecima/lib/nutricion.ts:4747-4766, C:/dev/wt-undecima/lib/nutricion.ts:4780-4798, C:/dev/wt-undecima/lib/nutricion.ts:4839-4855 | email_baja, tiene_email |
| `social-sin-freno` | Instagram y Messenger no pasan por el freno «misma persona» | proteccion_plataforma | C:/dev/wt-undecima/lib/nutricion.ts:4400-4404, C:/dev/wt-undecima/lib/nutricion.ts:4457-4493 | puede_escribir_instagram / puede_escribir_messenger |
| `variantes-al-azar` | El texto de un WhatsApp se sortea entre sus variantes | proteccion_plataforma | C:/dev/wt-undecima/lib/nutricion-canal.ts:111-124, C:/dev/wt-undecima/lib/nutricion.ts:4498-4508 | editor del mensaje («↻ N», EditorMensajeWhatsApp.tsx:1184-1187) |
| `mako-tarjeta-dedup-12h` | Una tarjeta «MaKo en WhatsApp» de antes se deduplica 12 h por lead | negocio | C:/dev/wt-undecima/lib/mako-tarjeta.ts:329-385, C:/dev/wt-undecima/lib/avisos.ts:146-148, C:/dev/wt-undecima/lib/avisos.ts:180-183 | nada (el interruptor y el «cada cuánto» viven en Configuraciones › Notificacione |
| `ir-a-no-reinicia` | «Ir a otra automatización» no reinicia una ya terminada ni entra si su objetivo ya está hecho | negocio | C:/dev/wt-undecima/lib/nutricion.ts:4019-4035, C:/dev/wt-undecima/lib/nutricion.ts:2252-2256, C:/dev/wt-undecima/lib/nutricion.ts:2309-2315 | nada |
| `reintentos-sin-tope` | Reintentos de un mensaje fallado, sin tope | integridad_tecnica | C:/dev/wt-undecima/lib/nutricion.ts:4431-4438, C:/dev/wt-undecima/lib/nutricion.ts:4556-4559, C:/dev/wt-undecima/lib/nutricion.ts:4849-4855 | tiene_telefono (para «sin teléfono») |
| `relleno-vacio-ia` | Copy con [relleno], mensaje vacío y respaldo de la IA | integridad_tecnica | C:/dev/wt-undecima/lib/nutricion.ts:1371-1376, C:/dev/wt-undecima/lib/nutricion.ts:4359-4366, C:/dev/wt-undecima/lib/nutricion.ts:4509-4524 | la casilla «MaKo lo adapta a cada persona» (sólo para el respaldo de la IA) |
| `filas-del-emisor-y-tarjeta-borrada` | Inscripciones que no deberían existir: del emisor, sin automatización, tarjeta borrada | integridad_tecnica | C:/dev/wt-undecima/lib/nutricion.ts:3888-3901, C:/dev/wt-undecima/lib/disparadores.ts:90, C:/dev/wt-undecima/lib/nutricion.ts:3939-3958 | nada |
| `turno-cas-esperas-cortas` | Turno del negocio, compare-and-set, esperas cortas y topes de vueltas | integridad_tecnica | C:/dev/wt-undecima/lib/nutricion.ts:3204-3231, C:/dev/wt-undecima/lib/nutricion.ts:3553-3577, C:/dev/wt-undecima/lib/nutricion.ts:3646-3701 | nada |

### grafo (53)

| id | qué decide | clase | dónde | hoy se puede con |
|---|---|---|---|---|
| `reunion-ya-paso` | Antes de cada paso de un flujo que «prepara una reunión», si la reunión ya pasó se cierra la automatización entera | negocio | lib/nutricion.ts:4084-4107, lib/nutricion-reinscripcion.ts:59-61, lib/nutricion-reinscripcion.ts:163-192 | reunion_en (Próxima reunión en ≤ N h): vale sólo donde está puesta, cierra sólo  |
| `prepara-reunion-por-forma` | El motor decide solo qué automatizaciones «preparan una reunión» | negocio | lib/nutricion-familias.ts:100-130, lib/nutricion.ts:3570-3577, lib/nutricion.ts:4099 | nada |
| `delay-antes-sin-reunion-cierra-todo` | Un DELAY «N antes de la reunión» sin reunión por delante cierra la automatización entera | negocio | lib/nutricion-grafo-motor.ts:228-236, lib/nutricion.ts:4013-4017 | reunion_en delante del DELAY, con «Si no» vacío (cierra sólo ese camino) |
| `carril-sin-hora-cierra-camino` | Un recordatorio no sale si la reunión sólo tiene fecha | negocio | lib/nutricion-grafo-motor.ts:520-542, lib/nutricion.ts:4163-4176, lib/nutricion-reinscripcion.ts:96-127 | nada |
| `carril-tolerancia-12min` | Un recordatorio que se atrasó más de 12 minutos no sale y el camino sigue | negocio | lib/nutricion-grafo-motor.ts:543-551, lib/recordatorio-lead.ts:58, lib/nutricion.ts:4135-4146 | nada |
| `carril-lead-no-abierto` | No se le recuerda la reunión a un lead cerrado o perdido | negocio | lib/nutricion-grafo-motor.ts:530-537, lib/nutricion.ts:3862, lib/nutricion.ts:4147-4151 | estado_lead (Estado del lead = abierto) delante del recordatorio |
| `carril-sobrevive-respuesta` | Si el lead contesta, los recordatorios siguen y el resto del flujo se corta | negocio | lib/nutricion-grafo-motor.ts:554-587, lib/nutricion-grafo-motor.ts:441-455, lib/nutricion.ts:4941-4956 | nada |
| `carril-sin-horario-antiban-topes` | Los recordatorios de la reunión ignoran el horario, el freno de 20 h y los topes | proteccion_plataforma | lib/nutricion-grafo-motor.ts:450-469, lib/nutricion.ts:3481-3496, lib/nutricion.ts:3522-3536 | nada |
| `mako-tarjeta-fuera-de-horario` | «MaKo en WhatsApp» sale al grupo a cualquier hora | negocio | lib/nutricion-grafo-motor.ts:404-409, lib/nutricion-grafo-motor.ts:450-455, lib/nutricion.ts:3495-3496 | nada |
| `carril-marca-y-reintento` | Un recordatorio no sale dos veces y, si falla, se reintenta a los 5 minutos | integridad_tecnica | lib/nutricion.ts:3614-3644, lib/nutricion.ts:4185-4190, lib/nutricion.ts:4852-4854 | nada (técnico) |
| `pausa-por-respuesta` | Cualquier mensaje del lead pausa TODAS sus automatizaciones | negocio | lib/nutricion.ts:4922-4956, lib/evolution-mensajes.ts:204, lib/zernio-entrante.ts:83-84 | respondio («Nunca te escribió»), en parte: mira si escribió alguna vez |
| `respuesta-tardia-reabre` | Si el lead contesta a una automatización ya terminada, pasa a «Respondió» | negocio | lib/nutricion.ts:4958-4988 | nada |
| `respondio-queda-para-siempre` | Quien contestó a una automatización creada desde una plantilla queda adentro para siempre y no vuelve a entrar | negocio | lib/nutricion-desenlace.ts:230-232, lib/plantilla-crear.ts:104-110, lib/setting-estrategia.ts:282-288 | nada |
| `ai-step-elige-la-primera` | Cuando el lead está en varias automatizaciones, contesta sólo la primera | negocio | lib/nutricion.ts:5247-5258, lib/nutricion.ts:5034-5039 | nada |
| `ai-step-no-contesta-tras-reunion` | El AI Step deja de contestar si la reunión ya pasó o la charla se cerró | negocio | lib/setter-conversacion.ts:330-376, lib/setter-conversacion.ts:421-423, lib/nutricion.ts:5123-5140 | reunion_en, dentro de «Si responde» y en parte (la misma regla del mediodía) |
| `si-responde-rama-vacia-pasa-a-persona` | En «Si responde», una rama sin respuesta hace que MaKo no le conteste más | negocio | lib/nutricion.ts:5645-5664, lib/setter-conversacion.ts:378-410 | nada |
| `cierre-charla-objetivo-insistencia` | MaKo cierra la charla por su cuenta: aceptó, dijo que no, o repitió la objeción tres veces | negocio | lib/nutricion.ts:5367-5381, lib/setter-conversacion.ts:341-356 | nada |
| `calificacion-automatica` | MaKo marca al lead como NO calificado en el CRM por la charla | negocio | lib/nutricion.ts:5383-5402, lib/nutricion.ts:5419 | El escenario «Puede no calificar» (lib/ai-step-escenarios.ts:54) con la ⚡ Acción |
| `contesta-sola-puertas` | Aunque el caso diga «Sola», MaKo no contesta sola si habla de plata, trae un link sin completar o es una despedida | negocio | lib/setter-conversacion.ts:236-266, lib/nutricion.ts:5411-5459 | nada |
| `respuesta-fija-una-vez-20h` | Un mensaje fijo de «Si responde» sale como mucho una vez cada 20 h por tarjeta | proteccion_plataforma | lib/nutricion.ts:5697-5713, lib/nutricion.ts:5776-5777 | nada |
| `accion-respuesta-una-vez` | Una acción de «Si responde» corre una sola vez por cada respuesta | integridad_tecnica | lib/nutricion.ts:5796-5821 | nada (técnico) |
| `asistido-legado-handoff` | Las secuencias viejas en modo «asistido» congelan la inscripción en 'handoff' | negocio | lib/nutricion.ts:5259-5286, lib/nutricion-desenlace.ts:222-224 | «Si responde» con «avisar al equipo» en «Si no» (lo que genera legadoAGrafo, lib |
| `requiere-legado` | Condiciones escondidas dentro de un paso viejo (`requiere`) | negocio | lib/nutricion.ts:4222-4252, lib/nutricion.ts:4993-5024, lib/nutricion-grafo-motor.ts:626-656 | ya_contactado (Ya le escribiste) y «Si responde» |
| `tope-antiguedad-al-mandar` | «Llegó hace menos de N h» se vuelve a mirar al mandar el primer mensaje, aunque ya se pasó por la condición | negocio | lib/nutricion.ts:4203-4220, lib/nutricion.ts:1532-1553, lib/flujo-grafo.ts:1602-1636 | antiguedad, justo delante del mensaje |
| `residuo-se-revalida` | La reactivación del «residuo» se corta si el lead pagó, agendó u otra automatización le habla | negocio | lib/nutricion.ts:4109-4125, lib/nutricion.ts:3875-3883 | pago, agendo / reunion_agendada y estado_lead, en parte |
| `residuo-uno-por-corrida` | El residuo sale de a uno por corrida (y 10 por día) | proteccion_plataforma | lib/nutricion.ts:4414-4426, lib/nutricion.ts:3744-3748, lib/nutricion-residuo.ts:66 | nada |
| `borrador-pendiente-frena` | Un borrador sin aprobar frena los mensajes y acciones del lead, también de OTRAS automatizaciones | negocio | lib/evolution-envio.ts:28-36, lib/nutricion.ts:4280-4296, lib/nutricion.ts:4572-4575 | nada |
| `cliente-sale-solo` | A quien ya pagó el mensaje le sale solo aunque la tarjeta diga «Revisar antes de enviar» | negocio | lib/nutricion.ts:4566, lib/nutricion.ts:4600, lib/nutricion.ts:4642 | pago (Pagó) para separar ramas, pero hoy no se puede poner el «revisar» de un me |
| `canal-apagado-omite-o-espera` | Con el canal apagado, el paso se omite si queda algo enviable más adelante, y si no, espera para siempre | negocio | lib/nutricion.ts:4368-4396, lib/nutricion.ts:4453-4456, lib/nutricion-grafo-motor.ts:283-311 | nada (tiene_telefono y tiene_email miran el lead, no el canal del negocio) |
| `email-sin-remitente` | Un email sin dominio propio no sale y, con otros caminos vivos, cierra el suyo | proteccion_plataforma | lib/nutricion.ts:4754-4766, lib/nutricion.ts:4839-4849 | nada |
| `opt-out-sin-email-cierra` | Un lead dado de baja del email, o sin email, cierra el camino | proteccion_plataforma | lib/nutricion.ts:4747-4753, lib/nutricion.ts:4842-4849 | email_baja y tiene_email |
| `contacto-bloqueado` | A un contacto bloqueado no se le manda y el flujo sigue de largo | proteccion_plataforma | lib/nutricion.ts:4560-4561, lib/nutricion.ts:5727 | nada |
| `anti-ban-20h` | Freno de 20 h entre mensajes al mismo lead por WhatsApp (y por email) | proteccion_plataforma | lib/nutricion-grafo-motor.ts:928-947, lib/nutricion.ts:4398-4408 | nada (es configuración del negocio) |
| `horario-y-cupos` | Horario de envío y topes por hora y por día | proteccion_plataforma | lib/nutricion.ts:3472-3536 | nada (es configuración) |
| `pausar-termina-inscripciones` | «Pausar» una automatización no la pausa: termina a los leads que estaban adentro | negocio | app/automations/SecuenciaPerfil.tsx:1177, lib/nutricion.ts:431-438, lib/nutricion.ts:3494-3506 | nada |
| `tarjeta-borrada-cierra-camino` | Si se borra la tarjeta donde está parado un lead, su camino termina | integridad_tecnica | lib/nutricion-grafo-motor.ts:75-94, lib/nutricion.ts:3948-3957 | nada |
| `emisor-cancela` | Una inscripción en una automatización de recordatorio o de evento de MaKo se cancela | integridad_tecnica | lib/nutricion.ts:3888-3901, lib/disparadores.ts:90 | nada (técnico) |
| `tope-saltos-y-bucles` | Un flujo que da más de 20 saltos sin esperar, o un «Ir a» a sí mismo, se corta | integridad_tecnica | lib/nutricion-grafo-motor.ts:245-259, lib/nutricion.ts:4018-4022, lib/nutricion-grafo-motor.ts:890-902 | nada (técnico) |
| `ir-a-otra-automatizacion` | Un «Ir a» a otra automatización termina ésta e inscribe en la otra, sin reiniciar lo que ya terminó | negocio | lib/nutricion.ts:4019-4034, lib/nutricion.ts:5601-5611, lib/flujo-legado.ts:412-428 | nada |
| `rama-vacia-termina` | Una salida sin flecha termina ese camino (el único «Stop» que existe hoy) | negocio | lib/nutricion-grafo-motor.ts:207-225, lib/nutricion-grafo-motor.ts:241, lib/nutricion.ts:3711-3717 | Una rama o el «Si no» vacío de cualquier CONDITION |
| `accion-que-falla-sigue` | Si una ⚡ Acción falla, el flujo sigue igual | integridad_tecnica | lib/nutricion.ts:4273-4278, lib/nutricion.ts:4306-4356 | nada |
| `condicion-sin-hechos` | Si no se pudo leer lo que necesita una condición, no se decide | integridad_tecnica | lib/nutricion.ts:3834-3855, lib/nutricion.ts:3997-4000, lib/nutricion.ts:5576-5583 | nada (técnico) |
| `relleno-no-sale` | Un mensaje con texto de relleno ([tu problema]) no sale nunca: espera de a 24 h | integridad_tecnica | lib/nutricion.ts:1371-1376, lib/nutricion.ts:4359-4366 | nada |
| `desenlace-respondio-cierra` | «Respondió» cierra la inscripción como lograda (fuera del lienzo) | negocio | lib/nutricion-desenlace.ts:71-83, lib/nutricion-desenlace.ts:238-256, lib/nutricion-grafo-motor.ts:874-888 | nada |
| `desenlace-legado-agendo-pago` | En las secuencias viejas, agendar o pagar las interrumpe y mueve al lead de etapa | negocio | lib/nutricion-desenlace.ts:238-256, lib/nutricion-grafo-motor.ts:884-888 | agendo / pago delante de cada mensaje (lib/flujo-legado.ts:286-297) |
| `desenlace-silencio-fallo` | Las secuencias viejas dan al lead por perdido tras N horas de silencio: lo mueven, avisan y encadenan | negocio | lib/nutricion-desenlace.ts:258-327, lib/setting-estrategia.ts:393 | DELAY + CONDITION + ⚡ Acción (mover de etapa, MaKo en WhatsApp), que es lo que g |
| `encadenar-hito-hecho` | Encadenar a otra secuencia se saltea si el lead ya cumplió su objetivo o ya estuvo en ella | negocio | lib/nutricion-desenlace.ts:164-212, lib/setting-estrategia.ts:334 | nada |
| `reuso-reinicia` | Si el lead agenda otra reunión, la automatización que «prepara una reunión» le vuelve a correr entera | negocio | lib/nutricion-reinscripcion.ts:262-314, lib/nutricion-reinscripcion.ts:377-460, lib/nutricion.ts:1447-1460 | nada |
| `cobranza-se-corta-al-pagar` | Marcar una cuota como pagada corta los recordatorios de cobranza al grupo | negocio | lib/pagos.ts:295-316, lib/flujo-corridas.ts:172-204 | nada |
| `corrida-evento-cortada` | La corrida de un evento de MaKo se corta si la automatización cambió de forma, se pausó o se archivó mientras dormía | integridad_tecnica | lib/flujos.ts:271-306 | nada (técnico) |
| `evento-condicion-reintenta` | Una CONDITION de evento que no puede leer al lead se reintenta 3 veces cada 5 min y después corta | integridad_tecnica | lib/flujos.ts:182-201, lib/flujo-pasos.ts:156-178 | nada (técnico) |
| `evento-accion-falla-avisa-grupo` | Si una ⚡ Acción de un aviso falla, MaKo escribe al grupo | negocio | lib/flujos.ts:415-421, lib/flujo-pasos.ts:103-109 | nada |
| `ancla-reunion-legado` | Un paso viejo anclado a la reunión se re-ancla si el lead reagendó | integridad_tecnica | lib/nutricion.ts:4192-4201, lib/nutricion.ts:1359-1369 | DELAY «antes de la reunión» |

### fuera (47)

| id | qué decide | clase | dónde | hoy se puede con |
|---|---|---|---|---|
| `recordatorio-lead-filtros-ocultos` | El recordatorio al lead (24 h / 1 h / 15 min) se salta solo a cancelados, asistidos y cerrados | negocio | lib/reunion-recordatorio.ts:331, lib/reunion-recordatorio.ts:332, lib/recordatorio-lead.ts:98 | reunion_en sin etapas (regla laxa: descarta la cancelada y la pasada, nutricion- |
| `recordatorio-config-de-antes` | Sin automatización, el recordatorio al lead lee una configuración vieja que ya nadie ve | negocio | lib/reunion-recordatorio.ts:277-281, lib/reunion-recordatorio.ts:235-242, lib/recordatorio-lead.ts:61 | nada (reemplaza una automatización entera) |
| `aviso-media-hora-solo-calendly` | El aviso al equipo «en media hora entrás a la reunión» tiene reglas fijas y sólo existe con Calendly | negocio | app/api/cron/reunion-recordatorio/route.ts:43, lib/reunion-recordatorio.ts:45, lib/reunion-recordatorio.ts:52 | plantilla lead-agendo «Un Lead Agendó Llamada»: ya trae la_e30 (DELAY antes_reun |
| `crm-auto-t1-noshow` | Reunión pasada sin marcar: MaKo busca la grabación y marca «asistió» o «No Show» | negocio | lib/crm-auto-plan.ts:216-233, lib/crm-auto-plan.ts:18, lib/crm-auto.ts:331-450 | parcial: asistio_reunion (lectura) y ⚡ marcar_asistencia_reunion / proponer_camb |
| `crm-auto-t2-no-agenda` | Lead sin agendar: a los 2 días MaKo lo pasa a «No Agenda» y a los 7 a «Reactivación» | negocio | lib/crm-auto-plan.ts:235-262, lib/crm-auto.ts:288-308, lib/crm-auto.ts:274-284 | CRON Etapa lead → DELAY tiempo 2 días → CONDITION agendo (negada) + sigue_en_eta |
| `crm-auto-t3-manual-vencida` | Nutrición manual vencida: MaKo le pregunta al dueño el desenlace | negocio | lib/crm-auto-plan.ts:265-271, lib/crm-auto.ts:452-470 | parcial: CRON Etapa manual + DELAY tiempo + ⚡ avisar_al_equipo; no hay DELAY has |
| `crm-auto-t6-reactivacion` | No responde / Perdido hace 30 días: MaKo reabre al lead en «Reactivación» | negocio | lib/crm-auto-plan.ts:274-288, lib/crm-auto.ts:311-329 | CRON Etapa (No responde / Perdido) → DELAY tiempo 30 días → CONDITION sigue_en_e |
| `crm-lead-estancado-aviso` | Aviso al equipo de «leads que el CRM automático movió», uno por día | negocio | lib/crm-auto.ts:492-505, lib/crm-auto.ts:542, lib/avisos-catalogo.ts:949 | nada hoy (lo emite T2/T6); con la plantilla, una tarjeta «MaKo en WhatsApp» dent |
| `plazos-por-etapa-ocultos` | Plazos por etapa guardados siguen avisando y moviendo, y ya no hay dónde verlos | negocio | lib/lead-quieto-aviso.ts:15-25, lib/lead-quieto-aviso.ts:186, lib/crm-auto.ts:64-82 | CRON Etapa + DELAY tiempo N días + CONDITION sigue_en_etapa_cron + «MaKo en What |
| `espejo-etiqueta-etapa` | Etiqueta vinculada a una etapa: mueve al lead, y la etapa pone/saca la etiqueta (también en WhatsApp) | negocio | lib/etiquetas.ts:360-366, lib/etiquetas.ts:627-640, app/api/cron/crm-automatico/route.ts:22-28 | CRON Etiqueta + ⚡ proponer_cambio_etapa; CRON Etapa + ⚡ poner_etiqueta_lead / sa |
| `cobranza-ventana-entrada` | Qué cuota entra a la cobranza lo decide el código (vencida hasta 7 días, 1 día antes, una vez por cuota) | negocio | lib/cobranza.ts:66-74, lib/cobranza.ts:104-117, app/api/cron/cobranza/route.ts:59-77 | para la entrada, nada; cuotas_vencidas (condiciones-catalogo.ts:605) y pago con  |
| `cobranza-corte-al-pagar` | Al marcar la cuota pagada, MaKo corta sola la cadencia de cobranza | negocio | lib/pagos.ts:303-309, lib/flujo-corridas.ts:188-200, app/admin/dev/configuraciones/bitacora.ts:555 | parcial: CONDITION pago con cuota N (pagoDeFila, condiciones-catalogo.ts:402-408 |
| `cuota-por-vencer-store-viejo` | «Cuota por vencer» sale por el store viejo de /mensajes y su flujo, no por Automations | negocio | app/api/cron/cobranza/route.ts:65-95, lib/flujos.ts:141-157, lib/avisos-catalogo.ts:998 | nada (EVENTOS_MAKO no tiene cuota_por_vencer, disparadores.ts:216-232) |
| `flujos-viejos-por-webhook` | Los webhooks siguen corriendo los «flujos» viejos de /mensajes (agendó, canceló, reunión ocurrió, formulario Meta) | negocio | lib/flujos.ts:102-127, lib/flujos-tipos.ts:20-25, lib/plantillas.ts:398-423 | lead.agendo → CRON Etapa Agenda R1/R2; lead.form_meta → CRON Funnel (lead nuevo) |
| `reunion-cancelada-aviso` | «Se canceló la reunión» le llega al grupo del negocio y no es una automatización | negocio | app/api/webhooks/calendly/route.ts:661-674, lib/avisos-catalogo.ts:792, lib/avisos-catalogo.ts:290 | nada (no hay CRON ni Evento de MaKo de cancelación) |
| `cancelacion-sin-condicion-ni-cron` | No hay forma fiable en el lienzo de saber que una reunión se canceló | integridad_tecnica | lib/leads.ts:1757-1776, lib/nutricion-grafo-motor.ts:757-758, lib/condiciones-catalogo.ts:336-351 | reunion_en sin etapas (con su «Si no» sin conectar = termina) |
| `reserva-limpia-etapa-y-noshow` | Reservar por Calendly / Cal.com saca al lead de la etapa puesta a mano y borra su «no asistió» | negocio | lib/leads.ts:1962-1977, lib/nutricion-etapa.ts:148-164, lib/leads.ts:1429 | nada (es lo que deja al lead en «Agenda R1» para el CRON) |
| `lead-nuevo-aviso-meta-landing` | «Entró un lead por formulario de Meta / por tu landing»: aviso al grupo fuera de Automations | negocio | app/api/webhooks/meta-leads/route.ts:315-323, lib/avisos-catalogo.ts:870, app/api/track/optin/route.ts:411 | nada como aviso al equipo (el CRON Funnel inscribe al lead, pero no hay Evento d |
| `lead-fusionado-aviso` | «Junté un contacto con uno que ya tenías»: aviso al grupo cuando una reserva o un formulario cae en un lead existente | negocio | lib/leads.ts:810-820, lib/leads.ts:1985, lib/avisos-catalogo.ts:571 | nada |
| `fathom-marca-asistencia` | La grabación de Fathom marca «asistió» sola (y con eso cambia la etapa) | negocio | app/api/webhooks/fathom/route.ts:159-167, lib/leads.ts:1532-1554, lib/fathom-auto.ts:164 | nada (no hay CRON «terminó una reunión»); asistio_reunion sólo lee el resultado |
| `post-llamada-borrador` | Después de cada llamada de venta, MaKo redacta un borrador de WhatsApp para el setter | negocio | app/api/webhooks/fathom/route.ts:203-211, lib/post-llamada.ts:119-160 | nada (no hay CRON de reunión ocurrida ni acción «borrador de seguimiento de la l |
| `reunion-ocurrio-fathom-aviso` | «Terminó la reunión con X» al grupo, armado por código | negocio | app/api/webhooks/fathom/route.ts:212-218, lib/avisos-catalogo.ts:805, lib/avisos-catalogo.ts:309-317 | nada |
| `respuesta-pausa-todo` | Cualquier mensaje del lead pausa TODAS sus automatizaciones (menos el carril del recordatorio) | negocio | lib/evolution-mensajes.ts:195-205, lib/nutricion.ts:4946-4956, app/api/webhooks/zernio/route.ts:165-171 | nada (no hay «seguir aunque responda») |
| `pago-gana-lead` | Un pago aprobado en la pasarela pasa al lead a Ganado y da de alta el plan | negocio | lib/cobros.ts:409-412, lib/cobros.ts:503-529, lib/cobros.ts:423 | parcial: CRON Pagos «Se aprueba un pago» (EVENTOS_PAGO, disparadores.ts:186-191) |
| `curso-al-ganar` | Al pasar a Ganado, MaKo invita al curso por email | negocio | lib/crm-curso-al-ganar.ts:1-40, app/crm/curso-al-ganar-actions.ts:1 | nada (no hay operación de la API «invitar al curso»: cs.def.ts y curso.def.ts no |
| `gracias-gana-lead` | Quien abre la página de gracias pasa a Ganado | negocio | lib/landing-gracias.ts:1-24, lib/landing-gracias.ts:81 | nada (visito_landing no distingue página y no hay CRON de visita) |
| `curso-sesiones-previo-posterior` | Mensajes al cliente antes y después de cada llamada de la entrega, con copia al dueño | negocio | app/api/cron/curso-sesiones/route.ts:1-30, lib/curso-mensajes.ts:648-720, lib/curso-mensajes-texto.ts:107-113 | nada (DELAY antes_reunion sólo mira R1/R2; no hay CRON de sesión de entrega) |
| `curso-recordatorio-clases` | A los 3 días sin entrar al portal, MaKo le manda al cliente sus videos sin ver | negocio | lib/curso-mensajes.ts:1017-1075, lib/curso-mensajes-texto.ts:522-530, lib/curso-mensajes-texto.ts:585-597 | dias_sin_entrar y entro_portal (condiciones-catalogo.ts:663, 668) como CONDITION |
| `curso-paso-automatico-etapa` | Cuando el alumno termina las tareas, MaKo lo pasa de etapa y le escribe | negocio | lib/curso-avance.ts:1-30, lib/curso-avance.ts:90-130, lib/curso-mensajes.ts:186 | completo_modulo / envio_tarea como CONDITION; faltan el CRON «envió una tarea» y |
| `cs-cliente-sin-contacto` | Cliente 21 días sin contacto: aviso al grupo del negocio (3 por día) | negocio | lib/cs-sin-contacto.ts:120-150, lib/cs-contacto.ts:163, lib/cs-contacto.ts:173 | parcial: CRON Entrega + DELAY tiempo + CONDITION; no hay condición «días sin con |
| `objetivos-avisos` | Objetivo atrasado, meta cumplida y «planificá el Q»: avisos al grupo con umbrales fijos | negocio | app/api/cron/objectives-vigilante/route.ts:51-54, app/api/cron/objectives-vigilante/route.ts:100-150 | nada (no hay eventos de Objetivos) |
| `plan-avisos-equipo` | Plan: tareas cerradas solas, tareas sacadas de reuniones, proyectos por vencer y retro, avisados al grupo | negocio | lib/todo-seeds.ts:135-160, app/api/cron/tareas-verificar/route.ts:1-30, lib/reunion-auto.ts:226 | nada |
| `insistencias-cortes-fijos` | Un aviso con «insistir» vuelve hasta 5 veces y un «ok» en el grupo cierra TODAS | negocio | lib/insistencias.ts:12-20, lib/insistencias.ts:69, lib/flujos-tipos.ts:176 | DELAY + CONDITION en una automatización de Evento; falta una CONDITION «alguien  |
| `avisos-programados-store` | Mensajes agendados por tiempo desde /mensajes, fuera de Automations | negocio | app/api/cron/avisos-programados/route.ts:1-20, lib/avisos-programados.ts:150-200 | CRON Recurrente con «El grupo de MaKo» (mandarRecurrenteAlGrupo, nutricion.ts:17 |
| `avisos-resumen-cola` | Algunos avisos se guardan y salen juntos en el resumen de la mañana | negocio | lib/avisos.ts:228-236, lib/avisos-agrupables.ts:1, app/api/cron/avisos-resumen/route.ts:34-55 | nada |
| `reportes-diario-horario-semanal` | Reportes diario, horario y semanal armados por código | negocio | app/api/cron/reporte-diario/route.ts:18-24, app/api/cron/reporte-horario/route.ts:18-27, app/api/cron/reporte-semanal/route.ts:1-60 | nada |
| `tarjeta-mako-dedup-12h` | «MaKo en WhatsApp» desde «Si responde» (o una tarjeta vieja) no se repite por lead en 12 h y la apaga un interruptor oculto | negocio | lib/mako-tarjeta.ts:362-382, lib/avisos.ts:180, lib/api-mako/areas/chatbot.run.ts:849 | nada |
| `desenlace-silencio-legado` | Desenlace por silencio de las automatizaciones de antes: mueve de etapa y avisa «no confirmó» | negocio | lib/nutricion-desenlace.ts:1-20, lib/nutricion-desenlace.ts:267-310, app/api/cron/nutricion/route.ts:135 | DELAY + CONDITION respondio (negada) + ⚡ proponer_cambio_etapa + «MaKo en WhatsA |
| `zernio-lead-solo-si-escucha` | Instagram / Messenger: el lead sólo se crea si alguna automatización escucha ese evento | negocio | lib/zernio-entrante.ts:140-156 | el CRON Instagram/Messenger de hoy |
| `plataforma-topes-envio` | Topes anti-ban del motor (por día, por hora, uno por persona cada 20 h) y lo que no se configura | proteccion_plataforma | app/api/cron/nutricion/route.ts:8-13, lib/limites-envio.ts:1-25, lib/limites-envio.ts:104-115 | nada (son topes, no flujo) |
| `plataforma-borrador-a-no-pagos` | A un lead que no pagó, el WhatsApp automático sale como borrador del setter | proteccion_plataforma | lib/evolution-envio.ts:1-22, lib/reunion-recordatorio.ts:166-173, lib/curso-mensajes.ts:30-36 | nada |
| `plataforma-bloqueado-y-envio-apagado` | Contacto bloqueado o envío apagado: no se le escribe | proteccion_plataforma | lib/reunion-recordatorio.ts:311-312, lib/reunion-recordatorio.ts:344, lib/curso-mensajes.ts:90-110 | nada (protección) |
| `plataforma-email-rebote-baja` | Un rebote permanente o un «es spam» da de baja al lead del email | proteccion_plataforma | app/api/webhooks/resend/route.ts:80-91 | email_baja (condiciones-catalogo.ts:451), para leerlo |
| `plataforma-avisos-de-sistema` | Avisos de sistema al grupo: Meta frenada (insistente), WhatsApp caído/volvió, Pixel apagado, landing cambió, Flow, pruebas, anuncio retenido | proteccion_plataforma | lib/alerta-critica.ts:205-235, lib/alerta-critica.ts:155, lib/lineas-vigilante.ts:134 | nada |
| `integridad-dedup-y-marcas` | Dedup por reserva, marcas por toque y compare-and-set | integridad_tecnica | app/api/webhooks/calendly/route.ts:446-458, lib/reunion-recordatorio.ts:357-378, lib/avisos-programados.ts:150-160 | nada |
| `integridad-meta-poll-sin-evento` | Un lead que entra por el poll de Meta no dispara aviso, flujo ni inscripción inmediata | integridad_tecnica | lib/meta-leads.ts:169-195, app/api/webhooks/meta-leads/route.ts:313-328 | nada |
| `integridad-r2-sin-evento-etapa` | Reservar una R2 (o cancelar) no dispara el evento de etapa al instante | integridad_tecnica | lib/leads.ts:1416-1450, app/api/webhooks/calendly/route.ts:440-470, app/api/webhooks/calcom/route.ts:198-238 | nada |

