# Relevo: Automations (ex /chatbot) y las secuencias

> **ESTADO AL 14/10/2026 ~17:20 AR (`claude1`, chat «Chatbot», worktree `C:/dev/wt-undecima`, rama `undecima`).**
> Verificado contra git y la base a las ~16:00: lo de abajo (13:20) es cierto; las dos migraciones que quedan dan 0 en
> dry run. **HECHO: el 1 de la lista (TikTok fase 0)**, `c9cdbdf3a`: el AI Step contesta por Instagram y Messenger
> (detalle y lo que quedó sin hacer en docs/hallazgos-chatbot.md → «TikTok fase 0»). SIN probar contra un DM real.
> **HECHO también el 2** (`d488977f0`): `probar_secuencia` manda UN escenario. **SIGUE:** el 4 y el 5;
> el 3 (feedback 6 y 11, lienzo) al final, por choque con otros chats. **Coordinación:** la rama `crm-bloques-b5` del chat
> «CRM» (C:/Users/marti/wtc-b5) tiene 2 commits sin integrar sobre archivos de Automations (5129d8dde y 87889880f «A
> MEDIAS»): se le preguntó qué toca; no hubo respuesta a las 17:20.

> **ESTADO AL 14/10/2026 ~13:20 AR (`claude2` al 88 % semanal: lo que sigue NO está arrancado).** TODO lo de «nada por
> detrás» está EN PRODUCCIÓN (282173d6e, Ready) y las TRES migraciones corridas y verificadas leyendo la base:
> `migrar-si-contesta` (la mañana), `migrar-condicion-reunion` (#213 ws1, #241 ws13) y `migrar-contesto-condicion` (8:
> #198, #209, #210, #238, #244, #245, #247, #249; las 8 pasan `validarParaGuardar` y `validarGrafo`; respaldo previo en
> el scratchpad de la sesión 461dd390, `respaldo-contesto-2026-10-14.json`). Ya no hay guarda escondida de «la reunión ya
> pasó» ni corte por respuesta: lo dicen «Su reunión sigue en pie» y «No contestó desde que entró». Probar tiene la barra
> de escenarios. Rama `undecima` = origin/main (45fe2cb7f), sin nada propio pendiente.
> **SIGUE, en orden (nada empezado):**
> 1. TikTok fase 0: que el AI Step conteste por Instagram/Messenger (`pausarPorRespuesta` con `soloPausa` sólo anota;
>    plan en docs/diseno-tiktok-linkedin.md §4). Después fase 1-2; el botón TikTok en la grilla del CRON va AL LADO DEL
>    DE IG (Martín, 14/10). Falta de Martín: una cuenta TikTok Business de prueba (LATAM) para ws3.
> 2. `probar_secuencia` de la API manda TODOS los pasos: que acepte un escenario (lib/setting-secuencias.ts).
> 3. Feedback del 13/10: 6 (arrastrar para reordenar tarjetas y mensajes) y 11 (subir un audio rápido en WhatsApp).
> 4. El resto del §2.4 de docs/diseno-mako-nada-por-detras.md (protecciones configurables y con aviso, AI Step «Deja de
>    contestar si…», «Sale sola», «Reentrada» del CRON, texto visible del DELAY «antes de la reunión»).
> 5. Videos redondos (`/message/sendPtv`), registro de acciones (sin dueño), la cola de siempre.
> El chat CRM (frente b5, worktree C:/Users/marti/wtc-b5) está pasando el CRM automático a plantillas y toca
> plantillas-automatizaciones, condiciones-catalogo, el motor y chatbot.def/run: se le pasaron las reglas de contesto/EN_PIE.
> Tests rotos que NO son del área (otros chats): vista-general-modelo, cobranza.

> **ESTADO AL CIERRE (12/10/2026 ~12:00 hora AR, `claude3` al 95 % semanal: no se arrancó nada más).** Todo lo hecho está
> en main y desplegado: undécima (a29af1a9 + datos aplicados), duodécima (f9308753), decimotercera (9295305e), y la barra
> (Offer en Sales Machine, «pronto» y Content Machine sólo super admin, Customer Success familia propia y al final). Se
> trabaja en el worktree `C:/dev/wt-undecima` (rama `undecima`; push con `git push origin undecima:main` tras rebasear):
> el clon de OneDrive no se puede poner al día con origin (trabajo ajeno sin commitear).
> **Decimocuarta (12/10 ~12:30 AR, también en main):** la caja «Pídeselo a MaKo» es la del Landing Generator (`app/landing-generator/CajaPedido.tsx`,
> la montan las dos), el chat de MaKo se abre a la derecha, sin el chip «Conecta tu…», y la tarjeta de Instagram/Messenger con
> el desplegable de cuentas de Zernio (cada tarjeta guarda la suya; el motor manda sólo por ella). Sin hacer: el chip «Sin
> conectar», Probar y Publicar miran si hay ALGUNA cuenta y no la elegida; las condiciones de Instagram no miran la cuenta.
> **13/10/2026 (`claude2`, chat «Chatbot» de la cuenta 2, en `C:/dev/wt-undecima`, rama `undecima`, SIN PUSH hasta que
> «Fallas en la PC» arregle el typecheck: `tsc` muere sin mensaje en esta PC, el vigía de RAM lo mata):** Martín pidió
> «que continúen y cierren lo planificado». HECHOS: el 1 (`ae462b56`: plantilla «Un Lead No Avanzó» + la condición
> «Sigue en la etapa del CRON»; medido: 0 embudos con plazos guardados, nada que migrar) y el 2 (`6e53ff79`: MaKo no crea
> sobre lo publicado; el ↻ de Probar frena por un medio sin conectar). La limpieza §8.7 (el 6) tiene su medición al día:
> 0 filas vivas con `{{mensaje_mako}}`, 0 con el CRON del recordatorio, 0 plantillas con el dato. Lo que sigue: el 3
> (Dashboard; Graphics cerró el área `metricas` con 25 operaciones y espera el id del aviso «El AI Analyst terminó»).
> **13/10 ~23:00 — más hecho (sin push):** el 3, primera mitad (`2ea2cf81`): el Evento de MaKo «El AI Analyst termina un
> análisis» (`analisis_listo` → aviso `dashboard-analisis-listo`, datos `analisis_hoja/resumen/hallazgos/link` armados con
> `valoresDelAnalisis`, plantilla «El AI Analyst Terminó», objetivo nuevo «Medir»). FALTA la emisión (es de Graphics, en
> `analizarHoja`; se le pasó el id) y la segunda mitad: las acciones del Dashboard en «⚡ Acción» (Graphics cerró el área
> `metricas`: 25 operaciones, todas `confirmacion: 'chat'`, selector persona → hoja → componente; `leer_bloque_dashboard` y
> `bloque` ya no existen).
> **ORDEN NUEVO (13/10, Martín por «Estrategia 3 CUENTAS»: «pasale todos los feedback de las 3 reuniones a los chats y diles
> que lo implementen completo... De punta a punta»), fuente `C:/Users/marti/Downloads/mako-feedback-y-tareas.md`, YA
> VALIDADO:** primero los que FRENAN A MAURICIO: (4) las líneas del «＋» no se sueltan ni se guardan al arrastrarlas
> (Fathom 858927676 @36:37); (5) no salió el mensaje automático de la automatización que configuraron en la llamada, de raíz
> (@85:50); (8) recordatorios por WhatsApp: los temporizadores no coinciden con los textos (858473424 @44:05). Después,
> terminar lo frenado (el 3 segunda mitad, Grupos de WhatsApp, la limpieza §8.7 con su medición en 0) y el resto del
> feedback: (1) la IA no deja configurar «hacer todo sola» en ciertos escenarios (858927676 @13:22); (2) separar bienvenida y
> seguimiento según si el lead ya habló con Mauricio (@25:25); (3) en esa automatización el delay después del video pasa de
> 1 día a 2 horas y sale la tarjeta de recordatorio del día anterior (@27:54); (6) arrastrar para reordenar tarjetas y
> mensajes (858545195 @74:42); (7) un botón para pausar a mano un flujo en prueba (@85:00); (9) el pop-up del recorrido
> recién cuando la IA terminó (@64:00); (10) el error de crear con IA con su causa (@65:34); (11) guardar o subir un audio
> en WhatsApp rápido (@75:18). «De punta a punta» = código, migración, API de MaKo si es capacidad nueva, tests probados
> rompiéndolos, verlo en ws3, bitácora con el pedido literal, relevo y hallazgos.
> **Bug 5, diagnóstico en curso (13/10 ~23:30, medido en la base):** la #241 de ws13 («Un Lead Agendó Llamada»: aviso al
> grupo → espera 5 min → WhatsApp «Hola {{nombre}}… Joan te saluda!») tiene 12 inscripciones y las 12 quedan `completada` a
> los ~2 s de entrar, con `paso_actual` 0 o 1, `ultimo_paso_at` NULL y sin `proximo_envio_at`: no pasan por la espera ni
> mandan el WhatsApp. La #213 de ws1 NO es esto (su condición «Ya le escribiste» sigue por las dos ramas). Fathom de la
> llamada 858927676: «call_id not found or access denied» con esta cuenta. Siguiente: ver en lib/nutricion.ts por qué una
> inscripción se cierra después de la tarjeta de aviso (la acción `avisar_al_equipo` como primera tarjeta) en vez de agendar
> la espera.
> **Corrección (13/10 ~23:50):** la #241 NO es el bug: esas inscripciones son de ANTES de que le agregaran la espera y el
> WhatsApp (13/10 14:08 UTC); hasta ahí el flujo terminaba en el aviso. Reproducido el motor puro sobre sus pasos de hoy:
> agenda la espera de 5 min y sigue al WhatsApp. Por los minutos de los otros puntos de esa llamada, el flujo tocado sería la
> #213 de ws1 (editada el 12/10 22:56 AR: video → 2 h, sin el recordatorio del día anterior), pero en ws1 no aparece un lead
> de prueba en esa ventana (sólo #778 y #23, ganados, sin inscribirse). Falta saber QUÉ se probó: la transcripción de Fathom
> no se puede leer con la cuenta 2 (se le pidió a Martín). Hipótesis a medir con ese dato: (a) el lead ya estaba inscripto
> (una inscripción por lead y automatización), (b) una espera en minutos espera al cron (cada cuánto corre el motor).
> **13/10 ~24:00 — dos pedidos nuevos de Martín (validados):**
> (A) «toda feature nueva va a la API de MaKo» (memoria `api-mako-con-cada-feature`): las plantillas nuevas ya salen solas
>  (`IDS_PLANTILLAS` sale de la galería; docs y plugin al día). FALTA lo grande: en main la API sólo edita automatizaciones SIN
>  ramas, así que tarjetas y condiciones (IG, AI Step, MaKo en WhatsApp, «Sigue en la etapa del CRON») no se configuran por la
>  API; esas operaciones están en la rama sin subir `wip/api-acciones-0910` (C:/dev/mako-api): se propuso tomar su parte de
>  Automations después de los bugs 5, 4 y 8. Bug 5 confirmado por Martín: «Un Lead Agendó Llamada» de Mauricio (#213 ws1).
> (B) Del chat CRM: lo que hace el «CRM automático» (lib/crm-auto.ts, reglas T1-T6 en `AUTO_REGLAS` lib/pipeline.ts:388, flag
>  `KEY_CRM_AUTO`, cron /api/cron/crm-automatico) pasa a Automations: (1) plantillas que muevan de etapa y hagan las acciones,
>  una por categoría; (2) revisar si hoy Automations tiene todo (mover etapa, asistencia/grabación de Fathom, días sin agendar,
>  el chat de WhatsApp) y decirle a Martín qué falta; (3) elegir un EVENTO de Calendly o Cal.com y atarlo a cada etapa de
>  reunión. El CRM NO apaga el motor hasta que las plantillas lo reemplacen (avisarle, o apagarlo con el flag por workspace).
>  La puerta para crear desde una plantilla: la op `crear_automatizacion_desde_plantilla` (API) o `POST /api/chat-agent/secuencias`
>  `{ action: 'crear_desde_plantilla', plantilla, disparador? }` → `crearDesdePlantilla` (lib/plantilla-crear.ts).
> **Bug 5, PISTAS MEDIDAS (13/10 ~24:10, #213 ws1, Martín confirmó que es ésta):**
> - lead 2636 (Jesús Gil, reunión 20/10 17:00 UTC): su inscripción (202) está ESTACIONADA en `nodo_actual = 'u11t1440'`, el
>   recordatorio del día anterior que se BORRÓ del flujo en la llamada (punto 3 del feedback), con `proximo_envio_at` 19/10
>   17:00. Hay que medir qué hace el motor con un `nodo_actual` que ya no existe (¿cierra sin mandar los de 60 y 15 min?) y,
>   si es eso, la regla: borrar una tarjeta con leads estacionados los tiene que mover a la siguiente (o Publicar avisar).
> - lead 2593 (Guillermo Wong, reunión 13/10 17:00 UTC): su inscripción (201) quedó `completada` el 13/10 a las 16:45:21, justo
>   en el toque de 15 min. Falta mirar en el registro de envíos si le SALIERON los de 60 y 15 min o se cerró sin mandar.
> - No hubo inscripciones nuevas en la #213 desde el 10/10: el lead que agenda entra por el webhook de agenda (Calendly), no
>   por moverlo a mano.
> **Respuestas de Martín (13/10 ~24:15), textual:** «1. Si, el lead de prueba lo creamos, se llama "Marco Bustos". 2. No, eso
> debería ser una configuración de automations del usuario en todo caso... No lo configures tu, de última ponlo como template.
> Siempre piensa en todo como un template, en todo caso, si es muy interno de MaKo, como que no pagó su suscripción o algo así...
> Y esas automatizaciones yo debería configurarlas en SuperAdmin, en este caso SuperAdmin debería tener una opción que el resto
> no, para poder mandar mensajes a todos los grupos con MaKo. 3. Si, quiero que pueda hacer cosas en el dashboard en incluso en
> todas las tabs, piensa que otras cosas podría hacer una automatización en las otras tabs.»
> Qué sale: (1) bug 5 = el lead de prueba «Marco Bustos» en la #213 de ws1: medir su inscripción; (2) el aviso del AI Analyst
> NO lo decide el código: el evento se emite SIEMPRE (programado y a mano, con el origen como dato) y el negocio decide con la
> plantilla «El AI Analyst Terminó» (avisarle a Graphics); y NUEVO: automatizaciones internas de MaKo (ej. un cliente no pagó
> su suscripción) se configuran en SuperAdmin, con una tarjeta que sólo tiene SuperAdmin: «MaKo a todos los grupos» (manda a
> los grupos de MaKo de todos los clientes); (3) ⚡ Acción con acciones del Dashboard y de TODAS las tabs (pensar cuáles).
> **Bug 5, el lead de prueba (13/10 ~24:40, medido):** Martín: «lo creamos con el botón de "nuevo lead" en el workspace de
> Mauricio», nombre «Marco Bustos». NO EXISTE en `leads` (ni en ws1 ni en otro), ni en `propuestas`, ni con su teléfono
> (5216862805657). El único rastro es un contacto de WhatsApp de ws1 en `evolution_contactos` (del 29/09). En ws1 no se creó NINGÚN
> lead desde el 10/10. O el alta de «Nuevo lead» no lo guardó (bug del CRM: medir `createLead` con ese teléfono, ¿duplicado?
> ¿error tragado?), o lo borraron después de la llamada: se le preguntó a Martín. Sin lead no hay inscripción: la #213 no tenía
> a quién mandarle.
> **14/10 06:40 (reloj de la PC, Argentina) — Martín, después del corte de la app: «"Si el lead contesta" NO debería ir en el CRON, debería ser una CONDITION...
> Es obvio eso».** Rehecho (commit «Si el lead contesta es una CONDITION»): que el lead conteste no corta nada; la condición
> «No contestó desde que entró» (`contesto`) va después de cada espera; el panel del CRON, `si_contesta` y la operación
> `cambiar_si_contesta_secuencia` se fueron. Hallazgo en docs/hallazgos-chatbot.md. También borrada la guarda escondida
> «la reunión ya pasó» (el ÚLTIMO commit de la rama, aparte). **ORDEN NUEVO DEL DEPLOY, en DOS pushes:**
> 1. Push de la rama SIN su último commit (la guarda): los 6 de 857f5ccc9..0b034457e + la condición `contesto`, y lo de
>    `1a2fd15f` si todavía no salió.
> 2. Con eso desplegado, las dos migraciones (dry run medido el 14/10):
>    `ENV_FILE=C:/dev/mako-api/.env.local node --import tsx scripts/migrar-condicion-reunion.ts --apply` (#213 ws1, #241 ws13) y
>    `ENV_FILE=C:/dev/mako-api/.env.local node --import tsx scripts/migrar-contesto-condicion.ts --apply` (10 automatizaciones:
>    las 3 prendidas sólo pierden la clave; a las apagadas de ws10, ws11 y ws15 se les pone la condición).
>    ⚠️ Al revés cortan: el código de antes no conoce `reunion_en_pie` ni `contesto` (la fila no se cumple).
> 3. Recién ahí, el push del commit de la guarda.
> Martín respondió también: el botón TikTok va en la grilla del CRON AL LADO DEL DE IG; LinkedIn queda afuera (explicado);
> «¿cómo deprecar Zernio para TikTok?» = pedir Business Messaging API directo (respuesta en el chat). Y pidió: en «Probar»,
> una barra de contactos (estilo WhatsApp/IG) con un contacto por escenario, y elegir el escenario al probar por WhatsApp.
> **14/10 ~12:30: `migrar-si-contesta.ts --apply` CORRIDO** (10 automatizaciones; la 2ª pasada da 0). El push lo hace
> «Estrategia 3 CUENTAS» con `1a2fd15f` (mi rama de antes del rebase, hasta «Pausar congela»). Los 6 commits de después
> (857f5ccc9..0b034457e en la rama de hoy) van en el push siguiente, por cherry-pick. Después del deploy: la 2ª migración
> (`migrar-condicion-reunion.ts --apply`) y el commit que borra la guarda.
> **ESTADO 14/10 ~12:00 (rama `undecima`, 15 commits sobre origin/main, SIN push: espera turno de «Estrategia 3 CUENTAS»;
> SIN tsc completo todavía, hay 2,6 GB libres):** hecho y con tests probados rompiéndolos —
>  · bug 5 de raíz: «Si contesta: sigue / se corta» por camino (panel del CRON, API `cambiar_si_contesta_secuencia`);
>  · bug 4: soltar una flecha sobre la pastilla de una espera; bug 8: la zona del ws1 era Buenos Aires → `America/Tijuana`
>    (en DATOS, ya vale, sin deploy; hallazgo en docs/hallazgos-infra.md);
>  · `reunion_en_pie` (+ cancelada = no agendó), el reintento re-evalúa la condición de arriba, «Pausar» congela, «Termina»
>    en las filas sin flecha;
>  · feedback del 13/10: 1 («Sola» con plata y en «Lo demás», con aviso; reemplaza la decisión del 06/10), 7 (⏹ Detener en
>    Probar), 9 (el recorrido espera a MaKo), 10 (el error de crear con IA dice qué quedó mal); el 2 y el 3 ya estaban en la
>    #213; «Publicar en Creaciones» en el ⋯.
> FALTA, en orden: el push (con la migración `migrar-si-contesta` antes) → la 2ª migración + borrar la guarda (§2.3) →
> feedback 6 (arrastrar para reordenar tarjetas y mensajes) y 11 (subir un audio rápido en WhatsApp) → el resto del §2.4 de
> docs/diseno-mako-nada-por-detras.md (protecciones configurables y con aviso, AI Step «Deja de contestar si…», la casilla
> «Sale sola», la «Reentrada» del CRON, el texto visible del DELAY «antes de la reunión») → TikTok fase 0 (que el AI Step
> conteste por Instagram/Messenger; docs/diseno-tiktok-linkedin.md) → videos redondos (`/message/sendPtv`) → registro de
> acciones (sin dueño) → la cola de siempre (Dashboard en ⚡, automatizaciones de SuperAdmin, Grupos de WhatsApp).
> **ORDEN DEL DEPLOY de «nada por detrás» (14/10 ~10:00), en DOS pasos:**
> 1. Push con `c0c46bad` (si contesta) + la condición `reunion_en_pie` + el reintento (§2.2). ANTES:
>    `ENV_FILE=C:/dev/mako-api/.env.local node --import tsx scripts/migrar-si-contesta.ts --apply`.
> 2. Con eso desplegado: `... scripts/migrar-condicion-reunion.ts --apply` (dry run medido: sólo las PRENDIDAS, #213 ws1 y
>    #241 ws13; la #249 del ws11 y la #210 del ws4 están apagadas y no se tocan). Recién después, un commit que borra la
>    guarda escondida (`if (anclada || preparaReunion(sec))` → sólo `anclada`, y el `sinReunion` de la inscripción a mano;
>    tests reunion-ya-paso, motor-entrada-etapa, nutricion-inscripcion-manual, reunion-fecha-sola-del-dia) y su push.
> ⚠️ Al revés corta los flujos: el código de producción no conoce `reunion_en_pie` (la fila no se cumple).
> Hallazgo de la corrida: la #249 («Seguimiento a leads que no cierran», CRON en No compró + Agenda + Facturando) caía bajo
> la guarda y se le cortaba todo el seguimiento de después de la reunión. Al borrarla, hace lo que dice su lienzo.
> **14/10 ~08:30 — Martín, directo en este chat: «Continua con todo lo pendiente... Y también: Implementar TikTok y
> LinkedIn».** Hecho: (1) «Si el lead contesta» por camino, `c0c46bad` (sin push todavía; el push es por turno con «Estrategia
> 3 CUENTAS»). ⚠️ ANTES del deploy correr `ENV_FILE=C:/dev/mako-api/.env.local node --import tsx scripts/migrar-si-contesta.ts
> --apply` (dry run medido: 10 automatizaciones; #213, #241 y #210 con la bienvenida en «sigue»). Verlo en ws3 después del
> deploy. (2) TikTok/LinkedIn investigado: docs/diseno-tiktok-linkedin.md. TikTok sí, por Zernio, sólo para contestar; LinkedIn
> no (sin vía legal); ManyChat YA tiene TikTok. Para arrancar TikTok hace falta de Martín: una cuenta TikTok Business de
> prueba (LATAM) para ws3, el cupo de Zernio y dónde va el botón TikTok en la grilla de CRON (hoy 4+3). Fase 0 (que el AI Step
> conteste por Instagram/Messenger) no depende de eso. Sigue en el orden: `reunion_en_pie` (§2.1), el reintento (§2.2),
> migración y borrar la guarda (§2.3), «Pausar» congela, protecciones configurables y visibles, bugs 4 y 8.
> **CIERRE (14/10 ~07:00, pedido de Martín vía «Estrategia 3 CUENTAS»: «que se pushee todo y que los chats cierren»).**
> Hecho y en main (e4c8a6d7): bug 5 de la fecha sin hora (329d1443), el emisor del AI Analyst (60186944). Commiteado sin
> push en la rama `undecima`: la cosecha del inventario (6b9363f4) y este cierre. **Martín DECIDIÓ las cuatro preguntas**
> (docs/diseno-mako-nada-por-detras.md, «DECIDIDO»): «si contesta» por camino con «sigue» de fábrica; protecciones todas
> configurables y con aviso; cancelada = no agendó; «Pausar» congela. **NADA de eso está implementado.** Orden para retomar:
> 1) «Si contesta: se corta / sigue» por camino (lib/nutricion.ts `pausarPorRespuesta` + la flecha del CRON en
>    app/automations; #213 a «sigue» en la bienvenida); 2) `reunion_en_pie` (lib/condiciones-catalogo.ts,
>    lib/nutricion-grafo-motor.ts `catalogoDeLead`) con la cancelada = no agendó; 3) el reintento vuelve a pasar por su
>    condición (lib/nutricion.ts ~4854); 4) migrar plantillas y #213/#241 (ws3 primero, --dry-run) y borrar la guarda;
>    5) «Pausar» congela (lib/nutricion.ts ~431, ~3939); 6) protecciones configurables y visibles; 7) el resto del §2.4.
> En cola, también: el botón «Publicar» de las estrellas (ya entró 92a2be21: `<BotonPublicar tipo="automatizacion" …/>`
> en el «⋯»), los videos redondos (`/message/sendPtv`), el registro de acciones (sin dueño), y marcar como resueltos en
> docs/hallazgos-crm.md los cuatro del CRM cuando salga su push (los hizo el chat CRM, en C:/Users/marti/wtcrm4).
> **14/10 ~04:30, inventario hecho:** docs/diseno-mako-nada-por-detras.md (162 reglas escondidas, plan §2, «Stop» §3,
> protecciones para Martín §4). **Bug 5, causa REAL (medida en `notificaciones`):** la reserva de Calendly sí reinició la
> #213 (su aviso salió 02:05:16); a las 02:08 el lead CONTESTÓ un mensaje a mano de Mauricio y `pausarPorRespuesta` frenó
> el audio de los 5 min. Siguiente: lo que Martín decida de §4 y de «si contesta»; mientras, §2.1 (`reunion_en_pie`) y §2.2
> (el reintento vuelve a pasar por su condición), que no cambian el comportamiento.
> **PEDIDO GRANDE de Martín (14/10 ~01:10): «Depreca absolutamente todas las cosas que MaKo haga por detrás»** (textual en la
> bitácora; regla en la memoria `mako-nada-por-detras`). Toda regla escondida del motor (ej. «la reunión ya pasó» en
> procesarEnvios) pasa a una CONDITION visible y configurable; si falta, se crea; los flujos vivos se rehacen con la condición
> explícita. «Stop»: sólo si no se puede con lo que hay. Inventario: workflow wf_a7729a89-429 (cuatro zonas, verificado).
> Y CORRIGE el bug 5: el lead se volvió a agendar por CALENDLY (con hora) a las 02:05 y tampoco salió: hay otra regla.
> **Estrellas (punto 10 de Martín, 13/10), pedido del chat «API de MaKo» (14/10 ~00:45):** el enchufe de automatizaciones
> ya está escrito en su rama `api-acciones-1310` (C:/dev/mako-api2, sin merge todavía; avisan cuando llegue a main). Lo
> nuestro: en el «⋯» de cada automatización `<BotonPublicar tipo="automatizacion" origenId={sec.id} nombre={sec.nombre} />`
> (app/creaciones/PublicarCreacion.tsx); opcional `<BotonEstrella …/>` en las plantillas. NO antes del merge: el import
> rompe el typecheck. Si se toca lib/flujo-copia.ts o crearDesdeCopia, correr tests/creaciones-automatizacion.test.ts.
> **Bug 5, CAUSA y arreglo (14/10 ~00:30, commit 329d1443):** lo que sobrevivió del lead borrado es `lead_audit` (sin FK):
> el 2660 pasó a «agenda» con la R1 «2026-10-12» SIN hora a las 19:57 de México. El motor lee una fecha sola como mediodía
> y cerró la inscripción por «la reunión ya pasó». Ahora una fecha sola vale hasta el final del día (`laReunionYaPaso`).
> Hallazgo en docs/hallazgos-chatbot.md. Falta verlo en ws3 (alta a mano con R1 de hoy, después de las 12).
> **Pedido de Martín (13/10, durante esto):** «se pueden enviar los videos redondos de WhatsApp, si podemos agregar esa
> opción a las automatizaciones». Medido: nuestro Evolution (2.3.7) tiene `/message/sendPtv`. Sin hacer.
> **Bug 5, cierre del dato (13/10 ~24:50):** Martín: el lead «Marco Bustos» SÍ existía; Mauricio lo borró después porque era
> de prueba. Con el lead se fueron su inscripción y todo rastro: la causa no se puede medir sobre ese lead. Siguiente: reproducir
> en ws3 con una copia de la #213 (alta con «Nuevo lead», etapa de agenda, ver si inscribe y qué manda). Y un PEDIDO NUEVO de
> Martín: «Yo como SuperAdmin quiero tener registro de todas las acciones que hace un usuario» (memoria
> `registro-acciones-superadmin`; preguntado si lo hace este chat o el de Admin).
> **PENDIENTE, en este orden:**
> 1. **Plazos de etapa del CRM → plantilla de Automations** (pedido de Martín reenviado por el chat CRM, 12/10: «Si, pasa
>    a una automatización eso de los plazos... Y ponlo como template en automations. Dile esto al chat de "Chatbot" que lo
>    haga el.»): CRON = entra a una etapa, DELAY de N días, CONDITION «sigue en esa etapa», ⚡ Acción mover de etapa y/o
>    «MaKo en WhatsApp» al equipo. Vivos sin pantalla: `funnels.data.umbrales.porEtapa`, `lib/lead-quieto-aviso.ts` (reglas
>    en `lib/lead-quieto.ts`), la op `plazo` de `editarEtapaAction` (app/crm/actions.ts, sin call site), lectores T2/T6 de
>    `lib/crm-auto-plan.ts` y `lib/crm-movil.ts`. Qué hacer con los plazos ya guardados: decidir con Martín.
> 2. **Lo que dejó abierto la decimotercera:** crear con MaKo sobre una fila con tarjetas publicadas y el borrador vacío da
>    409 en el chat; el ↻ de Probar no revisa los medios sin conectar.
> 3. **Dashboard en Automations** (abajo, en cola): la API del Dashboard ya está en su v5 final (6e709bc3, Graphics).
> 4. **Grupos de WhatsApp** (abajo, en cola).
> 5. **Lo que espera a Martín:** pagar ElevenLabs (US$6 past_due) y cargar `MAKO_ELEVENLABS_API_KEY` (Voz de MaKo; el
>    voice_id de «David» sin verificar); cargar `ZERNIO_API_KEY` y `ZERNIO_WEBHOOK_SECRET` en Vercel prod (hoy no están).
> 6. La limpieza §8.7 de la undécima (commit aparte; ya hay 0 filas vivas con {{mensaje_mako}} o el recordatorio viejo).
> 7. Sin dueño: migrar cursos desde Skool/Hotmart (feedback de Fiesta Music).
>
> **HECHA, SIN PUSH (12/10/2026, `claude3`, un agente solo): la DECIMOTERCERA tanda** (8 puntos con capturas; pedido literal
> en el último hito de la bitácora). Worktree `C:/dev/wt-undecima` (rama `undecima`). Lo aprendido:
> `docs/hallazgos-chatbot.md` → «Decimotercera tanda» (y en hallazgos-ui, el campo que mide cero adentro de un Modal):
> (1) la barra de «Pídeselo a MaKo» es la de WhatsApp, con el logo y el ejemplo que se escribe (el alto se colapsaba en el
> primer render del Modal: la animación andaba); (2) al enviar, el modal se cierra, la fila nace YA y su lienzo abre con el
> chat de MaKo creando (capa con «Creando tu automatización»); (3) Probar frena con un medio sin conectar (`medioQueFrena`,
> la cuenta de Publicar) y abre su modal; (4) el logo de MaKo; (5) Zernio con EL modal de Integraciones (`ServicioSuelto` →
> `ServicioModal`); (6) el chat es el hilo de WhatsApp (`ChatHilo`) con los colores de MaKo; (7) el ✦ anota en el chat de
> MaKo con la tarjeta; (8) el ✦ en el email (asunto y cuerpo) y en los DM (cortos, sin audio). **Sin migraciones ni datos.**
> Test nuevo: `tests/automations-decimotercera.test.ts` (16 roturas, 16 cazadas).
>
> **Antes del push:** Martín mira lo visual (el chat, la capa, la barra y el modal de Zernio). **Pendiente, con su archivo,
> en los hallazgos:** el 409 de crear sobre una fila con tarjetas publicadas y el borrador vacío; los rearranques de Probar
> no miran los medios.
>
> **Decisiones** (se pueden dar vuelta): si MaKo falla al crear, la fila queda vacía y pausada con el error en su chat (no
> se borra); el ✦ del título también con el lienzo vacío; la nota de voz al chat de MaKo se transcribe y viaja como texto;
> el chat sin clip (MaKo no recibe archivos); Zernio se abre aunque la capa no liste su tarjeta.
>
> **HECHA, SIN PUSH (12/10/2026 ~08:00, `claude3`): la DUODÉCIMA tanda** (feedback de la prueba con Fiesta Music; el
> pedido, en el último hito de la bitácora). Worktree `C:/dev/wt-undecima` (rama `undecima`), corrida `wf_ec999673-272`.
> Diseño: `docs/diseno-duodecima-tanda.md`. Lo aprendido: `docs/hallazgos-chatbot.md` → «Duodécima tanda» (y en
> hallazgos-ui y hallazgos-integraciones, lo de la barra y los tutoriales). Crear con IA respeta el canal y el catálogo,
> un chat de MaKo por automatización (en `app_settings`, sin migración) con preguntas con opciones, MaKo edita (cambiar y
> quitar), condiciones de Instagram, Zernio desde el CRON, el filtro de canales, el ✦, el aviso de Probar y la tab sin la
> puerta del QR. Fuera de Automations: el clic en Operate y los tutoriales cortos. **Sin migraciones ni datos** (lo de
> ws10 es una prueba del cliente: #243 archivada, #244 y #245 pausadas, 0 inscripciones; se arreglan con MaKo después).
>
> **Antes del push:**
> 1. Medir en Vercel prod `ZERNIO_API_KEY` y `ZERNIO_WEBHOOK_SECRET` (`vercel env ls`). Sin la primera, todo negocio sin
>    key propia ve el campo de la key en el modal; sin la segunda, el webhook no se registra (queda sólo en el log).
> 2. Martín mira los tutoriales de Meta, Resend, Cal.com y Fathom (`lib/metodo-catalogo.ts`).
> 3. origin/main avanzó 34 commits desde `e58ff6c9` (a `2a9b0777`): toca 7 archivos de la tanda (Sidebar, la ruta de Publicar, ChatAgentApp,
>    EditorDisparadores, SecuenciaPerfil, `lib/disparadores.ts`, `lib/prompt-registry.ts`), AGENTS.md, el índice de
>    hallazgos y este relevo (borró el bloque «EN CURSO»). El merge va a mano. Suite al cierre: 8414 / 3 rojos de HEAD,
>    ajenos (`confirm-encima-de-modales` ya está verde en main; `mover-etapa-validacion` y `plan-filtro-cliente`, no).
>
> **Pendiente, con su archivo, en los hallazgos:** el freno del medio al cambiar el CRON de una activa; el 401/402 de la
> key propia; la key de Zernio guardada sin verificar. (`ctx.disparadorActual`, `sembrarPrimero` y el `aviso` de
> Publicar quedaron enchufados al cierre.)
>
> **Decisiones para Martín** (§5 del diseño, se tomó la recomendada):
> - el chat en `app_settings` (la otra: la mig 0258);
> - sin el respaldo flash-lite (un 429 con Groq caído termina en «no pude»);
> - la pregunta de canal sólo con una señal social débil, y un tope de 2 rondas con «Elige tú» siempre;
> - «Te sigue» en vivo (quien sólo comentó cae en «si no»), y «Tiene Instagram» = tenemos su conversación por Instagram;
> - «Instagram conectado» lo dice Zernio también en el CRON (ws 1, 9 y 15 pasan a «Sin conectar»), y Zernio se conecta
>   desde el CRON (sin key propia, cobra desde la 3.ª cuenta);
> - el ✦ con recuadro claro de 44 y el logo de 32;
> - el QR salta solo una vez por visita (WhatsApp, Instagram y Messenger); el lienzo y el recorrido con 0
>   automatizaciones;
> - el aviso de Probar sale aunque se cierre Probar; el CRON que propone una edición se guarda al tocarlo;
> - lo que no existe se saca con aviso o se reintenta; un flujo social va sin «Si responde» ni AI Step;
> - tutoriales de 3 a 5 pasos (se borró la ayuda de `META_ACCESS_TOKEN`); renombrar con MaKo no entra.
>
> Y dos que tomaron los paquetes: «Omitir» del recorrido apaga su reapertura (`ChatAgentApp.tsx`), y el click derecho
> «crear suelta» también hace saltar el QR (`FlujoLienzo.tsx`). Repartido: Landing Generator (presentación en vez de
> landing, la tira de imágenes). Sin dueño: migrar cursos desde Skool/Hotmart.
>
> **HECHA (11/10/2026 ~22:50, `claude3`): la UNDÉCIMA tanda, `a29af1a9`, pusheada desde el worktree `C:/dev/wt-undecima`.**
> Mig 0257 aplicada antes del deploy. Lo aprendido: `docs/hallazgos-chatbot.md` → «Undécima tanda». **Datos APLICADOS el
> 12/10 ~02:00 UTC, con el simulacro leído y releídos de la base:** zona (ws1 y ws4 Tijuana, ws11 Cancún, ws13 canonizado;
> respaldo `backups/zona-negocio-2026-10-12T01-55-55-263Z.json`), remitente del ws1 a vacío, y los flujos: ws1 #198 «Un Lead
> Entró» y #213 «Un Lead Agendó Llamada» (prendidas, un AI Step c/u), #238 sólo su CRON; archivadas #228, #239, #240, #223,
> #224; ws13 #241 «Un Lead Agendó Llamada» (sólo el aviso, prendida, 9 leads de «Pre R1» pre-sembrados); ws4 #209 y #210
> rehechas y pausadas. Inscripciones 201 y 202: recordatorios el 12/10 y el 19/10 17:00 UTC. La 203 (lead 2645) estaba en
> `nz7zsf8`, la condición que se juntó: se REMAPEÓ a mano a `n2199q6` (compare-and-set) con su mismo horario (02:36 UTC).
> Respaldo de los flujos en `backups/undecima-flujos-*.json` (del worktree). **Falta:** `scripts/voz-mako-agregar.mts` (frena
> hasta que Martín pague ElevenLabs, US$6 past_due, y cargue `MAKO_ELEVENLABS_API_KEY`; el voice_id de «David» sin
> verificar), y la limpieza del §8.7 en commit aparte (ya hay 0 filas vivas con {{mensaje_mako}} o el recordatorio viejo).
> Las 36 decisiones con la recomendada primero: `docs/diseno-undecima-tanda.md` §9. El clon de OneDrive sigue sin poder
> ponerse al día con origin/main (trabajo ajeno sin commitear): se trabaja en worktrees.
> **EN COLA:** la tarea del Dashboard (abajo) — ⚠️ Graphics avisó (11/10 ~22:55) que empieza la v5 del Dashboard (los
> «Bloques de MaKo» se van y cambian las operaciones del área): pedirle el estado ANTES de cablear selectores en ⚡ Acción.
>
> **HECHA (11/10/2026 ~12:20, `claude3`): la DÉCIMA tanda, `4e2ebc7d`, desplegada (Ready).** AI Step v2 (un caso
> por tarjeta, objetivo, «✦ Armar el resto», ensayo, respuesta en audio), Configuraciones (horario + límites),
> galería v2 y editores. Diseños: `docs/diseno-ai-step-v2.md`, `docs/diseno-automations-configuraciones.md`,
> `docs/diseno-automations-galeria-v2.md`. Lo aprendido: `docs/hallazgos-chatbot.md` → «Décima tanda». Datos, medidos
> después: mig 0251 aplicada; «Aviso de nuevo agendado» creado y prendido en ws1 (#239) y ws13 (#240) antes del deploy;
> AI Step v2 aplicado (#198 y #213 del ws1, respaldo en `backups/ai-step-v2-2026-10-11T15-20-50-160Z.json`; volver a un
> deploy anterior es DESTRUCTIVO, §8.5). `scripts/migrar-cron-de-antes.mts` sigue SIN aplicar: falta la fase 1 del motor.
> **Decisiones pendientes de Martín:** (1) lo migrado quedó SIN objetivo (los sugeridos se imprimen, no se escriben);
> (2) el editor de «MaKo en WhatsApp» tiene el tamaño del de WhatsApp pero sin audio, archivos ni varios mensajes;
> (3) el email de MaKo ya no sale desde el motor (lo pidió él: «No permitas enviar emails con los email de MaKo»);
> medido 11/10: ninguna automatización prendida tiene pasos de email, así que hoy no corta nada; (4) el resto del motor
> manda en hora de Ciudad de México al ws1, que es de Baja California («Contesta sola» ya usa la del negocio).
> **Coordinación:** el hash `4e2ebc7d` ya se le mandó a la sesión «Integración Mercado Pago y Stripe» (CRON «Pagos»,
> 7º botón, grilla 4+3).
> **EN COLA (11/10 ~16:10, pedido de Martín reenviado por el chat Graphics): Automations CONFIGURA y CONSUME el
> Dashboard.** Martín: «mandale tarea al chat de chatbot para que se pueda configurar en automations y consumir esto
> tambien». Graphics ya puso 22 operaciones en la API (área metricas, `lib/api-mako/areas/dashboard.*`, commit
> 6e85d8d7). Lo nuestro: (1) un Evento de MaKo «El AI Analyst terminó» (`analisis_listo`, aviso
> `dashboard_analisis_listo`, datos `{ hoja, hojaId, persona, link }`) — ⚠️ SIN `{{mensaje_mako}}` ni textoDelCodigo
> (rechazado en la undécima, punto 4): el mensaje se arma con datos citables (hoja, resumen, hallazgos, link) en una
> tarjeta «MaKo en WhatsApp»; avisarle el id a Graphics, que agrega la emisión en `lib/graficos-analisis-server.ts`;
> (2) las acciones del Dashboard que tengan sentido en un flujo en el selector de ⚡ Acción (`lib/editor-acciones.ts`),
> con selectores persona → hoja → componente y conjuntos (`app/api/flujos/opciones/route.ts`,
> `app/_components/CamposAccion.tsx`); ofrecerlas sólo con disparadores que no son de un lead es decisión de Martín;
> (3) más adelante, junto con Grupos de WhatsApp: la salida de una acción al paso siguiente y un evento
> `numero_umbral`. Va DESPUÉS de la undécima (toca lib/disparadores.ts, avisos-catalogo y plantillas). El mensaje
> completo de Graphics, con líneas, está en la transcripción de este chat (11/10 ~16:10 hora local).
> **EN COLA, después de la décima:** «Grupos de WhatsApp» (la tarjeta para mandar a uno o más grupos, el grupo como
> medio del AI Step, y condiciones de grupo: está en el grupo X, mandó un mensaje, llegó cualquier mensaje, mandó
> una palabra). Pedido textual en el hito siguiente de la bitácora.
>
> **HECHO (11/10/2026 ~04:15, `56581a3f`):** lo de abajo está en producción; lo aprendido en
> `docs/hallazgos-chatbot.md` → «"MaKo en WhatsApp" = una automatización más». Sin ver con clics (lo mira Martín).
>
> **(Era) EN CURSO (11/10/2026 ~01:45, chat «chatbot», `claude3`): «MaKo en WhatsApp» = una automatización más.** Martín
> (con enojo, pedido varias veces): «debe ser IDENTICO… quedaron cosas muy viejas que quiero que las depreques. Todo
> ahora es lo mismo». Decisiones: **todos los negocios arrancan VACÍOS** (los mensajes de MaKo del cliente dejan de
> salir hasta que cada negocio los agrega desde la galería) y **nada de opciones nuevas**: cada cuánto / insistir se
> arman con CONDITION y DELAY en las plantillas. Alcance: 'reunion-recordatorio' (aviso al equipo 30 min antes),
> 'wa-mensaje-entrante', 'cuota-vencida'; el reporte semanal pasa a SuperAdmin. El diseño va a
> `docs/diseno-mako-en-whatsapp-unificado.md`; lo corre el workflow `wf_e017428b-b53` (diseñar → implementar →
> revisar motor/datos → arreglar). Si este chat se corta: retomar ese run (`resumeFromRunId`) o leer el diseño.
> Regla en la memoria: `mako-en-whatsapp-es-una-automatizacion`.
>
> **Actualización del 11/10/2026 ~01:00 (chat «chatbot», `claude3`): la NOVENA tanda** (`f2d4f25a` + `18369310`):
> tarjeta **AI Step** (una forma del «Si responde» con los casos adentro), **«⋯» en los Mensajes de MaKo** (Activar/
> Pausar y Eliminar = ocultar, recuperable desde «Nueva automatización»), **«Agendó» unificado** en la galería y en
> Mauricio, y **arrastrar con el botón del medio**. Los datos de Mauricio van con `scripts/novena-tanda-ws1.mts`
> (deja respaldo). Sin decidir: el texto propio del aviso de cada caso se pierde al plegar, y un caso que contesta y
> avisa manda dos avisos. Todo en `docs/hallazgos-chatbot.md` → «Novena tanda».
>
> **Actualización del 10/10/2026 a las 21:40 (chat «chatbot», cuenta `claude3`), medida y no copiada:**
> - **Decididas las dos de la octava tanda (§6):** la espera en minutos que parte la tarjeta **queda así**; y el
>   recordatorio de un negocio nuevo va **como plantilla de la galería**, no creado al alta: «Ningún negocio tiene
>   que arrancar con ninguna automatización creada, para eso ya tenemos los templates». **Hecho** en `9755da4c`
>   (CRON fijo «Agendó una reunión», uno por negocio). El pendiente de la galería de la §4 ya no está.
> - **Verificado lo que la §4 marcaba «SIN VERIFICAR»:** las 10 filas del recordatorio están (#228 del ws1
>   prendida, #229-#237 pausadas), ninguna tocada desde la mudanza; y las 198/221/223/224/226 tienen sus cambios
>   del 10/10.
> - **Las 9 pausadas (#229-#237) se ARCHIVARON** con el «sí» de Martín: eran automatizaciones que esos negocios no
>   crearon, idénticas a la plantilla. Queda sólo la del ws1 (#228, prendida). El script de la mudanza ya no las
>   recrea.
> - **ws1 limpio** («Archiva todas las que no haya pedido»): archivadas #220, #226 y #227. Quedan #198, #212 y
>   #213 (las de sus audios) y el recordatorio #228, todas prendidas.
> - **La caída y la vuelta del WhatsApp y la grabación de Fathom los configura SÓLO el super admin**
>   (`AVISOS_SOLO_SUPERADMIN`): salieron de la lista del cliente y la API y MaKo no dejan tocarlos. Revierte lo del
>   09/10 («las dos cosas»). Detalle en `docs/hallazgos-comunicacion.md`, al final.
> - **Todavía no salió ningún recordatorio por el camino nuevo** (no hubo reuniones desde la mudanza). El primero
>   real: el toque de 24 h del lead 2593, el **12/10 a las 17:00 UTC**.
> - Sigue sin verse con clics en producción ninguna de las ocho tandas (§4).

**Área:** la tab **Automations** y el motor de secuencias (nutrición). **Ventana de este relevo:
05/10/2026 → 10/10/2026.** Escrito el 10/10/2026 a la noche, cuenta `claude2`.

**Qué es esto, para alguien que nunca lo vio.** Es el constructor de automatizaciones del producto:
una pantalla con un **lienzo** (como ManyChat o un diagrama de flujo) donde el dueño de un negocio
arma lo que le va a salir solo a un lead — «cuando alguien agenda una reunión, mandale un WhatsApp;
si no contesta en 12 h, mandale otro; si contestó, pará y avisame». Cada cosa del lienzo es una
**tarjeta** (un WhatsApp, un email, una espera, una condición, una etiqueta, una acción) y el
arranque es un **CRON** (el disparador: una etapa del CRM, una etiqueta, un evento, un horario).
Lo que la pantalla dibuja lo ejecuta el **motor de nutrición**, que corre por cron en el server.
El WhatsApp sale por la línea **NO oficial** (Evolution, un WhatsApp Web automatizado): no hay
ventana de 24 h ni plantillas aprobadas, y el riesgo real es que baneen la línea.

---

## 1. Cómo se llama hoy y dónde vive el código

**La tab se llama `Automations`.** Era «Chatbot» hasta el 09/10/2026 (`04f40af4`), y Martín lo pidió
textual: «Cambia el nombre de la tab "Chatbot" por "Automations", el nombre en la sidebar, la ruta,
todo.»

| Qué | Dónde |
|---|---|
| La pantalla | **`app/automations/`** (32 archivos; la raíz es `page.tsx` → `ChatAgentApp.tsx`) |
| El lienzo compartido | `app/_components/Lienzo.tsx` (lo usan Automations y /mensajes) |
| El lienzo de esta tab | `app/automations/FlujoLienzo.tsx` |
| El modelo del flujo | `lib/flujo-grafo.ts`, `lib/flujo-conversacion.ts`, `lib/flujo-edicion.ts` |
| El motor | `lib/nutricion.ts`, `lib/nutricion-grafo-motor.ts`, `lib/nutricion-hilos.ts` |
| La ruta vieja | `app/chatbot/page.tsx` → redirige a `/automations` **con la query entera** |
| El nombre de la ruta | `lib/ruta-automations.ts` (`RUTA_AUTOMATIONS`, `RUTAS_VIEJAS_AUTOMATIONS`) |

⚠️ **Lo que NO se renombró, y no se renombra: las claves guardadas en la base.** La key `setting`
del nav (capas, roles, `onboarding.tab.setting`), el área `chatbot` de la API de MaKo, la API
interna `/api/chat-agent/*`, el proyecto «Agente: Chatbot» del tablero y la carpeta
`app/admin/dev/chatbot/` (la bitácora). Cambiar una clave guardada le reabre el onboarding a los
clientes o les deja la tab sin permiso, **y eso no lo ve ningún test: se ve en la cuenta de un
cliente** (está escrito así en `lib/ruta-automations.ts`). Lo cuida `tests/ruta-automations.test.ts`.

Así que si buscás algo y encontrás «chatbot», puede ser correcto: la ruta cambió, las claves no.

---

## 2. En qué quedó: TODO está en `main` y DESPLEGADO

Medido por mí el 10/10/2026 a la noche:

- `HEAD` = `origin/main` = **`9862c146`** (10/10 18:59). No hay nada de esta área retenido.
- `git merge-base --is-ancestor` confirma en `origin/main`: **`b8af255e`**, **`37727baa`**, **`c309b390`**.
- `npx vercel ls`: el último deploy de **Production** está **Ready**, 3 minutos de edad; el de las
  **17:38** (también Ready) ya llevaba la octava tanda.
- **749 tests del área, 0 rojos** (corrí `tests/automations-*`, `chatbot-*`, `flujo-*`, `lienzo-*`,
  `recordatorio-*`, `nutricion-*`: 30 s).

En la ventana entraron **ocho tandas de feedback de Martín**. Los commits que importan:

| Commit | Cuándo | Qué |
|---|---|---|
| `b8af255e` | 10/10 15:33 | **Octava tanda** (43 archivos, 2.648 líneas): copiar/pegar flujos, el lazo, el horario de oficina, CRON en recuadros, CONDITION con contenedores, el modal de «Nueva automatización» |
| `37727baa` | 10/10 15:47 | el menú del lazo no cuenta el CRON. **Salió de mirarlo en el navegador**: decía «Eliminar 3 tarjetas» y borraba 2 |
| `c309b390` | 10/10 14:07 | **el recordatorio de la reunión es una automatización más** y su pantalla especial se fue |
| `04f40af4` | 09/10 23:11 | el renombre a Automations |
| `5619de24` | 09/10 20:21 | el panel del CRON nuevo (seis botones gigantes, varios CRON, Recurrente) |
| `b2034e9c` | 09/10 19:47 | el lienzo tipo ManyChat: «Entonces», arrastrar flechas, el DELAY en la flecha, el click derecho |
| `3c1cd8fe` | 08/10 09:03 | **el lienzo con RAMAS** (CRON, condiciones, «Si responde», esperas, «Ir a») |
| `0a244608` | 08/10 19:45 | el modelo con **hilos en paralelo** |

### Lo que trajo la octava tanda (lo último, y es lo que menos ojos tiene encima)

- **Copiar y pegar flujos ENTRE NEGOCIOS** (`lib/flujo-copia.ts`, `lib/flujo-copia-negocio.ts`):
  «Copiar flujo» en el «⋯» de la lista, Ctrl+C / Ctrl+V de tarjetas en el lienzo, «Copiar todo /
  Duplicar todo / Eliminar todo» en el click derecho del CRON, el aviso «Copiaste «X». ¿Crearla?»
  al entrar y «Pegar lo copiado» al crear. Decisión de Martín: **lo que no existe en el negocio que
  pega queda vacío y marcado en rojo** (una etiqueta, un producto); un audio pasa a texto con su guion.
- **El lienzo: el botón DERECHO panea y el IZQUIERDO hace el lazo** de selección (lo no elegido se
  atenúa). La punta de una flecha se arrastra a otra tarjeta o al vacío; soltarla en cualquier lado
  abre el menú de tarjeta nueva; una sola papelera por flecha; sacar una flecha o una tarjeta ya no
  mueve a las demás (`congelarPosiciones`, `lib/lienzo-posiciones.ts`).
- **«Si responde» pasó a ser una condición normal** (decisión de Martín: la flecha punteada «no tiene
  sentido»). Se borra y se reconecta desde el CRON.
- **Horario de oficina** (antes «Limitar horario»): interruptor, horas de media en media hora, huso en
  la misma fila (`mako.timezone`), **sin botón de guardar** — guarda solo.
- **Modal de «Nueva automatización»**: ancho, con los seis CRON, «Pídesela a MaKo», «Pegar lo copiado»
  y las 7 plantillas de fábrica.
- **La tarjeta de WhatsApp** dibuja hasta dos burbujas con hora y ✓✓ y «+N mensajes…».

### El recordatorio de la reunión (`c309b390`), que es el caso más delicado

Es lo primero que hace la tab para un negocio: avisarle al lead que tiene reunión (24 h, 1 h y 15 min
antes, con el link). Hasta el 10/10 era una **fila especial** con su propia pantalla; ahora es una
automatización como cualquier otra, con el CRON `reunion_recordatorio` («Agendó una reunión»).

⚠️ **Pero NO lo manda el motor de nutrición: lo manda el emisor de siempre**
(`mandarRecordatoriosAlLead`, `lib/reunion-recordatorio.ts`), que ya resuelve la R1 y la R2, las
reagendas del mismo día, la tolerancia de cada toque y no repetir un toque (`claveToque`). Lo único
que cambió es **de dónde lee los toques**: ahora de la fila (`lib/reunion-recordatorio.ts:259`, un
select a `nutricion_secuencias` por `trigger_tipo`). Así la mudanza no cambió qué sale ni cuándo, y
las marcas de lo ya mandado siguen valiendo. El porqué está escrito en la cabecera de
`lib/recordatorio-automatizacion.ts` — **leela antes de tocar esto.**

Lo que se borró: `app/automations/RecordatorioFlujo.tsx` (378 líneas), `lib/recordatorio-grafo.ts`
(160) y la ruta `/api/chat-agent/recordatorio-reunion`. Publicar y Activar **validan la forma** que
el emisor sabe mandar (CRON → espera antes de la reunión → WhatsApp, en fila) y rechazan lo demás:
`frenoDelRecordatorio` en el lienzo y `setSecuenciaPasos` en el server.

El script que crea la fila de cada negocio es `scripts/recordatorio-a-automatizacion.mts`
(**simulacro por default**; escribe con `--aplicar`).

---

## 3. Lo que NACIÓ en la ventana (el 05/10 no existía)

Esto es lo que más cambió, y es por qué cualquier documento anterior al 08/10 sobre esta área está
viejo: **una automatización dejó de ser una lista de mensajes y pasó a ser un GRAFO.**

1. **El flujo con ramas** (mig `0223_flujo_grafo`, 08/10). Antes los pasos eran una fila lineal; hoy
   cada paso es un **nodo con `id` estable y su `siguiente`**, y el orden del array **no** es el orden
   del flujo. La entrada es `raizSalida(pasos)`, nunca `pasos[0]`. Nacieron cuatro clases de nodo que
   no son mensajes: `esperar`, `condicion`, `respuesta` («Si responde») e `ir_a`.
2. **Hilos en paralelo** (mig `0228_hilos_paralelos`, 08/10): varias flechas salen a la vez del CRON o
   de una tarjeta, y cada una es un hilo que corre solo.
3. **Varios CRON por automatización** (mig `0241_secuencia_disparadores`): arranca por CUALQUIERA de
   ellos. Quién la dispara se lee con `vistasPorDisparador` (`lib/disparadores.ts`) — leer
   `trigger_tipo` ve sólo el primero.
4. **Guardar ≠ publicar** (mig `0240_secuencia_borrador`): hay un borrador que se autoguarda y un
   «Publicar» que promueve. `validarParaGuardar` es la vara del borrador; `validarGrafo` la de Publicar.
5. **Las posiciones del lienzo se guardan** (mig `0233_secuencia_posiciones`): sólo lo que la persona
   movió, relativo al CRON derivado, en su propia columna (nunca adentro de `pasos`).
6. **Instagram y Messenger como canales**, por Zernio (mig `0242_canales_zernio`, 09/10). La tab de
   Instagram sigue AFUERA (se retiró el 06/10); volvieron sólo como canales. ⚠️ Ahí **sí** manda la
   ventana de 24 h de Meta, al revés que WhatsApp.
7. **El email que llega como disparador** (mig `0245_email_entrantes`) — **sin prender**.
8. **El paso «⚡ Acción»** (08/10, `1035b951`): un paso del lienzo corre cualquier acción de la API de
   MaKo sin pedir un «sí», porque el dueño la confirmó al configurar el paso.
9. **La galería de 7 plantillas** al crear (`lib/plantillas-automatizaciones.ts`).
10. **Copiar y pegar flujos** y **el horario de oficina** (la octava tanda, arriba).
11. **Chatwoot se BORRÓ** del repo el 09/10 (el WhatsApp oficial). El código quedó en la etiqueta de
    git `archivo/chatwoot-2026-10-09`. Código nuevo **no** importa `lib/chatwoot.ts`.

---

## 4. Lo que está a medio hacer o sin verificar, con el archivo

**Nada de esta área se verificó con clics en PRODUCCIÓN.** Lo que sí se vio: la octava tanda se miró
en el navegador en **dev local sobre el ws9, sin guardar nada** (paneo con el derecho, el lazo con 3
elegidas y la cuarta atenuada, el menú del CRON, el modal con 6 CRON y 7 plantillas, el panel del
CRON y el horario). Está anotado en el hito del 10 oct 15:47 de `app/admin/dev/chatbot/bitacora.ts`.
Las tandas 2.ª a 7.ª **no se vieron nunca con clics** en ningún lado.

Lo que falta mirar, en orden de riesgo: arrastrar una flecha y soltarla en el vacío · Ctrl+C/Ctrl+V
entre dos negocios · el borrador al recargar · el CRON Recurrente · grabar y escuchar un audio en
Safari · el reloj del horario · el recordatorio con sus piezas nuevas · la pastilla del DELAY.

Pendientes concretos:

- **La galería NO tiene «Recordatorio de la reunión»** (`lib/plantillas-automatizaciones.ts`: tiene 7
  plantillas y ninguna es ésa). Su CRON es fijo y la galería sólo sabe pedir una etapa. **Consecuencia:
  un negocio NUEVO no tiene la fila, así que su emisor usa la configuración de antes
  (`chatbot.recordatorio_reunion`, que quedó como respaldo) y el recordatorio no se ve en la lista.**
  ⚠️ Y el comentario de `lib/recordatorio-automatizacion.ts:32` ya promete esa plantilla («y la
  plantilla de la galería»): el código dice una cosa y la galería otra.
- **Arrastrar lo elegido con el lazo JUNTO no está**: el lazo elige, copia y borra en lote, pero cada
  tarjeta se mueve sola (`app/_components/Lienzo.tsx`).
- **«Pídesela a MaKo» del modal no lleva el pedido escrito**: crea la automatización vacía y abre la
  caja de Crear con IA (`app/automations/GaleriaPlantillas.tsx`).
- **Publicar no compara la base**: con dos pestañas abiertas gana la última que publica
  (`app/api/whatsapp/secuencias/route.ts`).
- **«Si la subida falla, la grabación vuelve a la barra» falta** en `GrabadorAudioPaso`, en el
  `usarAudio` del editor de WhatsApp y en `/whatsapp`: una nota de voz cuyo envío falla **se pierde**.
- **El 402 de Zernio llega como «Zernio no contestó»** (`app/api/zernio/route.ts:58`): sólo distingue
  el 401. Un cliente sin pagar lee un error que no dice qué pasa.
- **Crear con IA elige un solo CRON**, y la copia de configuración no copia la lista de CRON.
- **Las ramas de la línea oficial del onboarding son código muerto**
  (`app/automations/OnboardingChatAgent.tsx`; el componente sí se usa, desde `SecuenciaPerfil.tsx:1025`
  y `app/email/OnboardingCanalEmail.tsx`).
- **Copias sin llamadores** en `app/agencia/FlujoAviso.tsx` (`VistaEmailAviso`, `BotonMakoAviso`,
  `BotonVolver`, `RedactaAviso`) y `/api/chat-agent/onboarding/resumen`.
- **Cerrar la #350 del plan** (el reproductor de audios: era CSS) cuando se vea con clics.
- **Dos scripts de datos esperan el «sí»** (hoy en simulacro): `scripts/quitar-ir-a.mts` y
  `scripts/plantillas-viejas.mts`.

**SIN VERIFICAR por mí (lo midió la sesión que lo hizo el 10/10 ~14:00, no lo volví a medir):** que la
fila del recordatorio esté creada en los 10 negocios, con la del **ws1 (#228) PRENDIDA** y las otras 9
pausadas, y que los arreglos de datos de las secuencias 198/221/223/224/226 estén en producción
(Martín los aprobó a las 11:25 con el antes y el después). Eso son filas de la base, no código:
para confirmarlo hay que consultar `nutricion_secuencias`.

⚠️ **Hay otra sesión trabajando en este mismo clon ahora, y está tocando el CRM.** Al cerrar este
relevo (10/10 a la noche) `git status` mostraba, sin commitear y **sin ser míos**:
`app/crm/CrmBoard.tsx`, `app/crm/CrmToolbar.tsx`, `lib/campana-atribucion.ts`,
`tests/crm-filtro-ads.test.ts` y el archivo nuevo `app/crm/arbol-seleccion.ts` — y aparecieron dos
más en los minutos que tardé en escribir esto. **Dejalos donde están**: ninguno es de esta área, y
un `git checkout --` sobre ellos borra trabajo ajeno. Lo único mío es `docs/relevo/chatbot.md`.

---

## 5. Las trampas del área (esto es lo que ahorra tiempo)

1. **`setSecuenciaPasos` (`lib/nutricion.ts`) reconstruye cada paso CAMPO POR CAMPO y tira lo que no
   conoce.** Un campo nuevo del nodo que no esté en `camposDelFlujo` se **pierde en el primer
   guardado**, sin un error. Ya costó las `variantes` borradas en silencio, y es la puerta que se
   olvida: la marca `suelta` de «Si responde» fue la **sexta** vez.
2. **Un TIPO de nodo nuevo son CINCO puertas** (`lib/lienzo-grafo.ts`, `grafoDeSecuencia`, el panel de
   `FlujoLienzo.tsx`, el motor y `setSecuenciaPasos`). Si la capacidad nueva sigue siendo «este nodo
   manda un mensaje», es un **campo** adentro del paso y una rama en el motor, no un nodo nuevo.
3. **Todo lo que recorre `pasos` tiene que saltear lo que no es un mensaje.** La prueba de una
   secuencia, el generador de copy, la ficha que lee MaKo y las tools de la API trataban una acción
   como un mensaje vacío: **salía un WhatsApp de prueba en blanco por cada acción**. Antes de sumar un
   tipo de paso: `grep` de `.pasos` y de `setSecuenciaPasos`.
4. **El diagnóstico obvio del zoom borroso era el equivocado.** No era resolución: era
   `willChange: 'transform'` en la capa del lienzo — con esa pista Chrome pinta el bitmap una vez y lo
   estira al cambiar la escala. Sacarla lo arregló (`app/_components/Lienzo.tsx`).
5. **⚠️ La primera medición del lazo dio CERO y el lazo andaba.** El arrastre de prueba arrancaba en
   el rincón de abajo a la derecha, **encima de «Publicar»** (`data-no-pan`), que el lienzo no toma a
   propósito. Repetido desde el fondo vacío: funcionaba perfecto. **Antes de diagnosticar un gesto,
   mirá DÓNDE empezó.**
6. **Un menú que cuenta lo elegido tiene que contar lo que la acción HACE.** El CRON entra en el lazo
   pero no se copia ni se borra como tarjeta: el menú decía «Eliminar 3» y borraba 2. **Lo vio el
   navegador, no un test** (`37727baa`).
7. **Minutos entre dos mensajes NO se pueden dormir.** El motor duerme las pausas adentro de la
   corrida con tope de 10 s, así que elegir minutos **PARTE la tarjeta** con una espera en el medio
   (`partirConEspera`, `lib/flujo-edicion.ts`). Es un default que puso Claude: **a confirmar con Martín.**
8. **El WhatsApp de esta tab es el NO oficial.** No existe la ventana de 24 h ni las plantillas
   aprobadas: no escribas un gate que cuelgue de ellas. Lo que protege la línea es el RITMO y el
   CONTENIDO. Pero Instagram y Messenger (por Zernio) **sí** tienen la ventana de 24 h de Meta.
9. **Un flujo que arranca por una ETAPA no hereda la guarda «la reunión ya pasó»** (decide por el
   `trigger_tipo`). Quien arme un flujo así —una plantilla, Crear con IA, la API— tiene que poner
   «Próxima reunión en ≤ 720 h» después de CADA espera por tiempo, antes de lo que habla de la reunión.
   Si no, un audio de preparación le llega al lead **después** de la llamada.
10. **«Agendó» significa «tiene una reunión cargada», pasada o futura** — también a quien faltó a una.
11. **Hay DOS migraciones numeradas `0223`**: `0223_flujo_grafo.sql` (esta área) y
    `0223_curso_papelera.sql` (el curso). Pasó justo lo que AGENTS.md advierte: dos sesiones eligieron
    el mismo número a la vez. Y faltan los números 0234-0239 y 0243-0244. **Antes de nombrar una
    migración: `git pull` y `ls supabase/migrations/ | tail -5`.**
12. **Leer el portapapeles pide permiso.** El aviso «Copiaste un flujo» al entrar y «Pegar lo copiado»
    del modal no aparecen sin permiso, y no se insiste. Ctrl+C / Ctrl+V del lienzo usan los eventos
    `copy`/`paste`, que no piden nada.
13. **`next dev` en un worktree tropieza igual que el build** con el junction de `node_modules`
    («Symlink … points out of the filesystem root»): hace falta la misma raíz temporal en
    `next.config.ts`, y restaurarla después (ese cambio NO se commitea).
14. **Un guard con regex sobre un fuente tiene que tolerar CRLF** (`\r?\n`, nunca `\n` solo): en este
    clon de Windows los archivos llegan en CRLF.

---

## 6. Lo que espera una decisión de Martín

### De la octava tanda (lo más fresco)

- **El delay de MINUTOS entre dos mensajes parte la tarjeta con una espera** (el motor no puede dormir
  minutos adentro de una corrida). Opciones: (a) dejarlo así, que es lo implementado; (b) no ofrecer
  minutos y topear en segundos; (c) un tick frecuente del cron para minutos exactos, que es trabajo de
  infraestructura.
- **La plantilla «Recordatorio de la reunión» en la galería**: hoy un negocio nuevo no tiene la fila.
  Opciones: (a) sumarla a la galería; (b) crearla sola al dar de alta un negocio; (c) dejar el respaldo
  viejo y que el recordatorio no se vea en la lista de esos negocios.

### De las tandas 6.ª y 7.ª (siguen sin respuesta)

- **Los Mensajes de MaKo en WhatsApp**: hoy el flujo (pasos, CRON) se guarda en el acto y «Publicar»
  publica sólo el texto. En una automatización normal **todo** sale con Publicar. ¿Se unifica?
- **El aviso de 30 minutos al dueño** sólo corre con Calendly. ¿Se extiende a todos? Código
  Inmobiliario usa Cal.com. Es mandar avisos nuevos a clientes.
- **«Activar» no frena** una automatización con la línea de WhatsApp desconectada (ws13), ni una nueva
  con el CRON viejo de la post-agenda (`agendado_sin_confirmar`) junto a las secuencias 212/213. ¿Lo frena?
- **Los dos scripts de datos**, en simulacro: `scripts/quitar-ir-a.mts` y `scripts/plantillas-viejas.mts`
  (ws1: 4 flujos manuales vacíos y un paso «⚡ Acción» viejo; ws4: 2 flujos vacíos). ¿Se corren con `--aplicar`?
- **Los 7 mensajes de MaKo que arma el código** (reporte semanal, recordatorio, Fathom, mensaje
  entrante, línea caída y volvió): hoy se ven como ejemplo y no se editan. ¿Pasan a mandar lo que
  escribe el cliente? En /mensajes (la agencia) todavía se editan.
- **Sin horario, las post-agendas en vivo del ws1 pueden salir de noche**: ¿se le pone un horario?
- **Los recordatorios de clases (9 a 21) y las insistencias al grupo (8 a 21)** siguen con su ventana
  fija. ¿Pasan a seguir el horario del negocio?
- **El email que llega como disparador** necesita: prender «Receiving» en Resend, que el cliente cargue
  el MX y el secreto del webhook. Hoy está escrito y apagado.
- **ws11 tiene su cuenta de Zernio pausada por falta de pago** (402).
- **Del ws9**: el CRON «Agendó una reunión» no ve las reuniones cargadas a mano sin hora; `{{hora}}`
  sale en la zona del negocio; los títulos de 6 mensajes son más largos que los del catálogo.
- **A Mauricio (ws1)**: la 198 manda «Te dejo aquí el video» (el de antes de la reunión) a quien **no**
  agendó, y la 226 linkea el mismo video como «de repaso».
- **ws4 #210** es la post-agenda vieja del onboarding, y ws13 «Nueva Agenda VSL» (un mensaje propio con
  evento) nunca sale.
- Decisiones de diseño que siguen abiertas: ¿se retira la condición «Agendó», que dice lo mismo que
  «Tiene reunión agendada»? ¿Mover una tarjeta se deshace con Ctrl+Z? ¿«Probar» muestra por qué rama
  siguió? ¿Varios remitentes de email por negocio (hoy «Vincular nuevo» REEMPLAZA)? ¿Una sola «Mover de
  etapa» que elija por lead el producto principal o uno agregado?

---

## 7. Lo que CORREGÍ de la versión anterior de este documento

La versión anterior se escribió el 10/10 a las **15:34** (`651c5690`), y la ventana siguió hasta las
**18:59**. Tres afirmaciones suyas eran falsas:

1. **«La octava tanda NO está pusheada ni vista con clics.»** Las dos mitades son falsas.
   `b8af255e` y `37727baa` están en `origin/main` y **desplegadas** (el deploy de Production de las
   17:38 ya las lleva, verificado con `npx vercel ls`), y la tanda **sí se vio con clics** en dev local
   sobre el ws9 — tanto que `37727baa` **salió** de mirarla («Visto en el navegador: con el CRON adentro
   del lazo decía "Eliminar 3 tarjetas" y borraba 2»). Dejó de ser cierta con `37727baa` (15:47) y con
   el push que la llevó a `main`.
2. **«El área `chatbot` de `/admin/dev` no apunta a `hallazgos-chatbot`.»** Falsa desde **`c309b390`**:
   `app/admin/dev/areas.ts:547` tiene `hallazgos: 'hallazgos-chatbot'`, y la misma entrada ya se llama
   `titulo: 'Automations'` con `slug: 'chatbot'`.
3. **`app/automations/RecordatorioFlujo.tsx` figuraba como pendiente a limpiar.** **`c309b390` lo
   borró** (378 líneas), junto con `lib/recordatorio-grafo.ts` y
   `/api/chat-agent/recordatorio-reunion`. El archivo ya no existe.

Lo que sí sigue siendo cierto de esa versión, y verifiqué: que la galería no tiene «Recordatorio de la
reunión» (7 plantillas, ninguna es ésa), que «Pídesela a MaKo» no lleva el pedido escrito, que el lazo
no arrastra lo elegido junto, y que el delay en minutos parte la tarjeta.

**Y si querés el porqué de cada decisión, no está acá:** el pedido **literal** de Martín de cada tanda
está en `app/admin/dev/chatbot/bitacora.ts` (hitos del 8, 9 y 10 de octubre) y lo que costó
implementarlo, en `docs/hallazgos-chatbot.md` (secciones «Sexta tanda», «Séptima tanda» y «Octava
tanda», que son las últimas del archivo). Esos dos documentos son de primera mano; este relevo es un
resumen.
