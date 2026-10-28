# Relevo para el chat de la NUBE — Automations (27/10/2026, cuenta claude4)

Escrito por el Cerebro con un lector que verificó con git la cronología del chat de la cuenta 5, cortado por cuota el 27/10 ~20:15 ART.

## Cómo trabajás en la nube
- Arrancás desde la etiqueta `respaldo/automations-2710-nube` (ya tiene lo que el chat dejó sin commitear, como commit WIP). `git fetch origin tag respaldo/automations-2710-nube && git checkout -b automations-nube-2710 respaldo/automations-2710-nube`.
- ENTREGÁS POR ETIQUETA, nunca por rama: cuando una tanda está lista y con sus tests en verde, `git tag nube/automations-2710-<n> && git push origin refs/tags/nube/automations-2710-<n>`. Una rama en origin dispara un build de Vercel (cuesta plata).
- No pushees a main ni a integracion. El Cerebro mezcla tus etiquetas al tren.
- Commit por ruta explícita (nunca git add -A), firmado con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` y `Claude-Cuenta: claude4` pegados.
- Corré tus tests y los que barren el repo (tests/puente-panel-copy si tocás copy; tests/fuentes-leads-webhooks si tocás credenciales; `node scripts/rutas-windows-en-tests.mjs`; `node --import tsx scripts/generar-api-doc.mjs` si tocás lib/api-mako). No corras el tsc entero.
- Producción (Supabase, migraciones, mensajes a clientes) NO se toca desde la nube: anotalo en «Para el Cerebro» al final de este archivo y commitealo.

## Estado al cortarse
**Último encargo:** Del Cerebro (chat local_3f1a66d3), tres mensajes cruzados a las ~19:32 ART del 27/10, que relayan decisiones de Martín. (1) Cuatro pedidos de Mauricio (ws1, cliente): MAU-07 («Si responde» → Mover de etapa a «seguimientos»), MAU-08 (etiqueta de origen «SPRINT 3 DÍAS»), MAU-17 (sacar de la #289 los avisos de cada respuesta al grupo) y MAU-33 (aviso de cuenta frenada una vez por día). (2) Ticket #12 de Leandro (ws10, Fiesta Music, sec=680 «Comentario con 'pruebafm' en Instagram»): responder en público el comentario y los espacios del nombre de un botón. (3) Dos de Leila (ws11): el link del aviso sin `?ws=` y el cron «llega a etapa» que no alcanza a los que ya estaban. Antes ya tenía la tanda de 12 del Cerebro (llamadas de Leandro, Leila y Aaron, grupo Makito, Ticketera). A las ~20:09 ART estaba en Leila 2 (buscando con grep dónde se inscriben «los que ya están en la etapa», sin tocar nada todavía) y la cuota de 5 h lo cortó a las 20:15. Tenía un subagente «Public reply to Instagram comment» (lanzado 20:02) que murió con el mismo corte, sin dejar ningún cambio en el worktree.

## Brief

Sos el chat «Automations» (relevo de la cuenta claude5, que se quedó sin cuota el 27/10 a las ~20:15 ART). Hablás con el Cerebro, que relaya las decisiones de Martín Koncke (dueño de MaKo). Mauricio, Leandro, Leila y Brigitte son CLIENTES, no Martín. Español con voseo, corto y directo.

LO PRIMERO QUE HACÉS, antes de tocar código (Martín: «Recuerda el runner y medir el uso siempre»):
1. Medí el uso real de esta cuenta con get_usage (las dos ventanas, la de 5 h y la semanal). La cuenta es claude4, no la 5. Si el marcador no cuadra con el día de renovación, el Cerebro lo corrige; vos avisale. Al 97% se corta y se hace el relevo.
2. Mirá que el Runner esté activo (sesión «Runner» del grupo «Cerebro», lastActivityAt reciente). Si está parado, avisale al Cerebro por mensaje cruzado: reactivarlo es cosa suya, no tuya.
3. Recién ahí seguí.

DÓNDE ESTÁS PARADO (verificado con git a las ~20:40, no de memoria)
- Worktree propio: C:/dev/wt-aut-2510, rama aut-2510 (también la ve `git worktree list`). Trabajá SÓLO ahí. No uses ni toques C:/dev/wt-push-q (es el tren del Cerebro/Integración, en la rama tren-o).
- aut-2510 está en d9247ab7c, tres commits sobre origin/main (bbb459f33): e77ee8d5e (iniciales seguras), 56be0692d (el chat dice qué IA contestó; pregunta en «Editar» se contesta; «Sale desde»; tarjeta «tal cual»; MAU-33 aviso de cuenta frenada una vez por día) y d9247ab7c (espacios en el nombre de un botón de Instagram). Esos commits NO están en tren-o (2f6ae9abf) ni en main. No los rebases ni los rehagas: ya están entregados al tren como puntas VERDE sin tipos. Si el Cerebro te pide traer tren-o/main, hacé merge, no rebase. Un merge de prueba contra tren-o conflictúa sólo en docs/hallazgos.md y docs/hallazgos-comunicacion.md (se resuelve juntando los dos lados).
- Hay cambios SIN COMMITEAR en wt-aut-2510, tuyos y buenos: lib/links-con-ws.ts, lib/mako-grupo.ts, tests/links-con-ws.test.ts. Es Leila 1 («Este lead no es de esta cuenta»): todo lo que sale al grupo de un negocio pasa por `linksConWs` / `partesConLinksDeWs`, así un link de aviso lleva `?ws=` del negocio. El test pasó 4 de 4 y sus tres roturas caen. No lo reescribas: revisá el diff (`git diff`), corré tests/links-con-ws.test.ts y los tests vecinos que nombren lib/mako-grupo.ts, escribí la cosecha y commiteá.

QUÉ HACER, EN ORDEN
1. Cerrar Leila 1: commit con rutas explícitas (jamás git add -A), cosecha en docs/hallazgos-comunicacion.md (más la línea en el índice docs/hallazgos.md en el MISMO commit), nota en docs/relevo/automations.md y hito en app/admin/dev/chatbot/bitacora.ts. Después pasale la punta al Cerebro con el sha.
2. Ticket #12 de Leandro, mitad 1 (responder en público el comentario). Los espacios del botón ya están (d9247ab7c). El subagente que arrancaba esto murió sin dejar un solo cambio, así que empezás de cero. Diseño ya decidido: campo `en_comentario: true` DENTRO del paso de mensaje de Instagram/Messenger (regla de AGENTS.md: si la capacidad sigue siendo «este nodo manda un mensaje», es un dato adentro del paso, ausente = lo de siempre). Zernio lo permite: POST /v1/inbox/comments/{postId} con { accountId, message, commentId } y header Idempotency-Key (403 = falta el add-on Inbox; 422 = Meta rechazó). Copiá la forma de `responderComentario` (respuesta privada) en lib/zernio.ts. Seguí el camino de `botones` (`grep -n botones` en lib/flujo-grafo.ts, lienzo-grafo.ts, flujo-conversacion.ts, nutricion.ts —ojo: `setSecuenciaPasos` reconstruye campo por campo y BORRA lo que no conoce—, nutricion-grafo-motor.ts, flujo-ia.ts crear/editar/validarIA, api-mako/areas/chatbot.def.ts y .run.ts, app/automations/EditorMensajeSocial.tsx con un interruptor visible sólo cuando el disparador es un comentario). La respuesta pública no gasta la privada (Meta deja una sola) ni depende de la ventana de 24 h. Sólo texto. La IA del lienzo, con disparador de comentario, pone la respuesta pública («¡Te lo mandé por mensaje!») en una tarjeta con `en_comentario: true` ANTES del DM, y el contenido en el DM. Test nuevo tests/instagram-respuesta-publica.test.ts, probado rompiendo cada pieza. Una operación nueva de la API de MaKo va AL FINAL de su área y se mide con las frases del clasificador (AGENTS.md). Cuando estén las dos mitades, el hito de la bitácora lleva `tickets: [12, 11]`.
3. Leila 2: el cron «llega a etapa» no alcanza a los que ya estaban. Listo = al activar una automatización por etapa se ofrece incluir a los que YA están en esa etapa (con el anti-baneo) y la pantalla dice cuántos entran. Primero medí en el código dónde se inscribe a alguien al entrar a la etapa y qué falta para los existentes; después test. Lo que escribió la clienta es dato.
4. Mauricio (ws1): MAU-07 («Si responde» → «Mover de etapa» a «seguimientos»), MAU-08 (paso «Agregar etiqueta» «SPRINT 3 DÍAS» al entrar, y etiquetado en lote de los que ya pasaron) y MAU-17 (en la #289 sacar los avisos de cada respuesta a su grupo; queda sólo «nadie contestó en X horas»). Listo = probado en el ws3 (Cliente de Prueba) que lo que corresponde funciona; el cambio en la automatización del Sprint del ws1 lo confirmás LEYENDO SUS PASOS, no su nombre, y se lo pasás al Cerebro «listo para pedir el sí». Tocar el ws1 en producción, o crear/activar cosas en el ws3, es escribir en producción: NO lo hacés sin el sí; el sí lo pide el Cerebro a Martín en el chat, un sí del Centro no alcanza.
5. Después, sin urgencia: ítem 8 (proponer los textos con el conocimiento del negocio, diciendo de dónde salió cada uno) e ítem 12 (versiones con «restaurar» y un centro de errores).

QUÉ NO HACER SIN EL SÍ (el Cerebro lo gestiona)
- Ítems 1 y 2 de la tanda (avisos de lead de formulario y reserva al grupo; «Completa el disparador» sin recargar): hay que crear y activar automatizaciones en el ws3 = escribir en producción. Falta el sí.
- Ítem 4, la #266 «Un Lead Entró 2» de Brigitte (ws15): devolverle la espera de 1 h y el recordatorio al grupo. Está todo medido en el parte (automations-tanda-27-10.md, carpeta de side-session-notes del Cerebro): se fue con un Publicar de la pantalla el 23/10 14:05:22Z, no fue MaKo ni la API ni la IA. Sólo con el sí.
- Producción de terceros y manda-WhatsApp-real: ídem.

DECISIONES DE MARTÍN QUE RESPETÁS
- Tickets de Leandro: se hacen directo, sin aprobación de Martín; el aviso le sale solo a su grupo al desplegar. Los pedidos de Mauricio van sin aprobación de Martín, pero tocar su ws1 en producción pide el sí.
- IA del chat de Automations: primero la IA que eligió el admin del negocio, Gemini sólo como último respaldo, y el chat dice qué IA contestó. Ya está hecho; no lo revises.
- Los avisos de Notificaciones que nacían apagados salieron de la lista («Sacarlos de Notificaciones»). «MaKo Messages» salió del Super Admin.
- MAU-33: un incidente abierto varios días avisa una vez por día, uno resuelto avisa «ya está». Hecho en 56be0692d (lib/alerta-critica.ts y alerta-critica-texto.ts).
- Ítem 9: el número compartido de Leandro: NO, las automatizaciones sólo le escriben a leads del CRM; el texto para su grupo ya se lo pasaste al Cerebro.
- El diagnóstico obvio puede ser el equivocado (en el ítem 6 el modelo contestaba bien; lo rechazaba NUESTRA revisión): medí antes de cambiar, y probá cada pieza rompiéndola.

CÓMO ENTREGÁS (reglas que no se negocian)
a) Tu punta va «VERDE sin tipos» al Cerebro. Los chats NO corren tsc ni el VERDE completo (memoria tren-de-pushes): corrés tus tests, y los que barren el repo si tocaste copy o credenciales. El tsc acotado lo corre Integración una vez por tren. Escribilo así en la línea del VERDE.
b) Commit por RUTA EXPLÍCITA, nunca `git add -A` ni `git add .`. El mensaje termina con DOS líneas pegadas: `Co-Authored-By: ...` (el modelo que te toque) y `Claude-Cuenta: claude4`. Los commits que heredás dicen claude5: está bien, son de la otra cuenta.
c) Trabajás en tu worktree propio C:/dev/wt-aut-2510, nunca en el de otro chat ni en wt-push-q.
d) No rebasar lo ya entregado al tren (e77ee8d5e, 56be0692d, d9247ab7c). Lo nuevo va en commits nuevos encima.
e) Cosecha: lo aprendido se escribe en el repo, en docs/hallazgos-<área>.md donde vive el código (chatbot, ia, comunicacion, ui) más el índice docs/hallazgos.md en el mismo commit, la regla de código nuevo en AGENTS.md, y el estado en docs/relevo/automations.md. Al reportar decí dónde quedó cosechado.
f) Si la RAM no deja correr algo, un hook lo frena: leé y editá con las herramientas de archivos, corré un test por vez y no insistas en un tsc. Con el vigía de RAM, salida 99 no es un verde: se marca «sin chequear acá».
g) Mensajes al Cerebro por mensaje cruzado, cortos: qué quedó, sha, cómo se probó, qué espera un sí.

## Pendientes, en orden
1. Leila 1: cerrar lo del `?ws=` (commit por ruta explícita, tests vecinos de mako-grupo, cosecha en docs/hallazgos-comunicacion.md + índice docs/hallazgos.md, relevo docs/relevo/automations.md y bitácora app/admin/dev/chatbot/bitacora.ts).
2. Leila 2: el cron «llega a etapa» no alcanza a los que ya estaban (20/10 17:38, «la activé para todos los que están en reactivación… todavía no pasa nada»). Listo = al activar una automatización por etapa se ofrece incluir a los que YA están en esa etapa (con el anti-baneo) y la pantalla dice cuántos entran. Sólo se había empezado a buscar con grep (inscribirExistentes, retroactiv, etc.); no hay código.
3. MAU-07: probar en el ws3 que «Si responde» → «Mover de etapa» funciona; el cambio en la automatización del Sprint del ws1 (confirmar leyendo sus pasos, no su nombre) se le pasa al Cerebro LISTO para pedir el sí. No se empezó.
4. MAU-08: paso «Agregar etiqueta» «SPRINT 3 DÍAS» al entrar en la automatización del Sprint; el cambio en el ws1 y el etiquetado en lote de los que ya pasaron, listos para pedir el sí. No se empezó.
5. MAU-17: en la #289 sacar los avisos de cada respuesta a su grupo; queda sólo lo que él no vería (nadie contestó en X horas). Mismo trámite del sí en el ws1. No se empezó.
6. Ticket #12 de Leandro, mitad 1: responder PÚBLICAMENTE el comentario que disparó el flujo. Zernio lo permite (OpenAPI v1.389.0, POST /v1/inbox/comments/{postId} con accountId, message y commentId, header Idempotency-Key; 403 = falta el add-on Inbox; 422 = Meta rechazó). Diseño pensado: campo `en_comentario: true` DENTRO del paso de mensaje (regla de AGENTS.md), siguiendo el camino de `botones` (flujo-grafo, lienzo-grafo, flujo-conversacion, nutricion.setSecuenciaPasos que borra lo que no conoce, nutricion-grafo-motor, flujo-ia crear/editar/validarIA, api-mako chatbot.def/run, EditorMensajeSocial con un interruptor visible sólo con disparador de comentario), nueva `responderComentarioEnPublico` junto a `responderComentario` en lib/zernio.ts, y test tests/instagram-respuesta-publica.test.ts probado rompiéndolo. El hito de la bitácora con `tickets: [12, 11]` sale cuando estén las dos mitades.
7. Ítem 8: proponer los textos con el conocimiento del negocio, diciendo de dónde salió cada uno (876470842-14).
8. Ítem 12: versiones con «restaurar» y un centro de errores (ideas de VendeChat). Va al final.
9. Ítems 1 y 2 (avisos de lead de formulario y reserva al grupo; «Completa el disparador» sin recargar): para probarlos hay que crear y activar automatizaciones en el ws3, que es escribir en producción. Falta el sí; el Cerebro lo pide a Martín. En el ítem 2 la cita de la demo dice que tras recargar el disparador NO estaba guardado, y leyendo el código no apareció un camino roto evidente.
10. Ítem 4 (#266 de Brigitte, ws15): devolverle la espera de 1 h y el recordatorio es escritura en producción. Sólo con el sí. Está medido: se fue con un Publicar de la pantalla el 23/10 14:05:22Z, no fue MaKo, la API ni la IA; no se sabe quién (no hay registro de publicaciones).
11. Captura «después» de sacar «MaKo Messages» del Super Admin, pendiente por falta de RAM.
12. Avisar al Cerebro de la punta d9247ab7c (en el parte consta 56be0692d) y, cuando se cierre Leila 1, pasar la nueva con sha y la línea «VERDE sin tipos».
13. Sin investigar: el 26/10 el chat del lienzo del ws9 (#700) contestó «Gemini está saturado» dos veces (docs/hallazgos-ia.md). Seis lugares de otras áreas con las iniciales cortadas por índice, anotados en docs/hallazgos-ui.md (no son de Automations).

## Decisiones de Martín que se respetan
- Tickets de Leandro (ws10) y pedidos de Mauricio (ws1): sin aprobación de Martín para hacerlos; tocar el ws1 o escribir en producción pide el sí, y el sí va en el CHAT al Cerebro.
- Chat de Automations: primero la IA que eligió el admin del negocio, Gemini sólo último respaldo, y el chat dice qué IA contestó (ya hecho).
- «Sacarlos de Notificaciones»: los 9 avisos que nacían apagados salen de la lista; «MaKo Messages» fuera del Super Admin (hechos).
- MAU-33 decidido por el Cerebro: un incidente abierto varios días avisa una vez por día y uno resuelto avisa «ya está» (hecho en 56be0692d).
- MAU-17 decidido por el Cerebro: en la #289 se sacan los avisos de cada respuesta al grupo; queda sólo lo que Mauricio no vería (nadie contestó en X horas).
- Ítem 9: el número compartido de Leandro con la distribuidora: la respuesta es NO; las automatizaciones sólo le escriben a leads del CRM.
- Martín: «Recuerda el runner y medir el uso siempre» (27/10): al iniciar una cuenta se mide el uso y el Runner tiene que estar activo.
- Puntas en VERDE por tandas, con sha, VERDE sin tipos; commit por ruta explícita; sin git add -A.

## Lo que espera a Martín (no lo hagas vos)
- El sí para escribir en producción en el ws3 (Cliente de Prueba): activar desde plantilla «Lead de formulario de Meta» y «Un Lead Agendó Llamada», cargar un lead de formulario y una reserva de prueba, y crear/publicar una automatización de prueba para ver «Completa el disparador» (ítems 1 y 2).
- El sí para devolverle a Brigitte (ws15) la espera de 1 h y el recordatorio «RECORDATORIO IMPORTANTE» en «Un Lead Entró 2» (#266).
- El sí para los cambios en la automatización del Sprint del ws1 de Mauricio (MAU-07 mover a «seguimientos», MAU-08 etiqueta «SPRINT 3 DÍAS» y su lote, MAU-17 sacar avisos) cuando estén listos y probados en el ws3.

## Dudas que el lector no pudo verificar
- No hay evidencia de que el Cerebro haya recibido la punta d9247ab7c: el parte automations-tanda-27-10.md (última edición 19:54) nombra 56be0692d y no menciona el commit de los botones.
- No se vio en el log el resultado del grep que confirma APP_BASE_URL en lib/mako-grupo.ts; verifiqué por git que lib/app-url.ts lo exporta (línea 51), pero no corrí ni el test ni tsc (solo lectura).
- El estado de los tests de Leila 1 (4 de 4, roturas 3/3, base 5/0) es lo que dice el chat en su log; no lo re-ejecuté.
- Lo que hay en el archivo de la cola cuenta las herramientas pero muestra truncados los comandos; no se sabe si el chat llegó a pasarle al Cerebro un mensaje cruzado entre las 20:00 y las 20:15 (la última nota del parte es de las 19:54).
- No se pudo confirmar si el cambio en curso del subagente (respuesta pública) dejó algo fuera de wt-aut-2510: git status del worktree muestra sólo los tres archivos de Leila 1, y no aparece ningún worktree nuevo para ese trabajo.
- tren-o avanzó a las 20:38 (2f6ae9abf, 56 commits sobre main): puede traer cosas que choquen con lo de Automations en AGENTS.md o los docs; el merge de prueba sólo marcó conflicto en los dos documentos de hallazgos.

## Para el Cerebro
(anotá acá lo que necesita producción o una decisión)
- **28/10, claude4 (en la PC), lo que espera un sí de Martín:**
  - **MAU-07, ws1 (Mauricio): «Si responde» → «Mover de etapa» a «seguimientos».** El código ya lo hace: una acción dentro
    de «Si responde» corre por `ejecutarDesdeFlujo` con reclamo (no se repite), y «Mover de etapa» lleva el CRM de la etapa
    (`embudoId`; tests/chat-mako-prueba-de-chats.test.ts, flujo-motor-grafo, motor-revision). Falta CONFIGURARLO en la
    automatización del Sprint del ws1: abrirla, confirmar por sus PASOS que es la del Sprint (CRON = una etapa del CRM del
    Sprint; tiene «Si responde»), y en el caso de «respondió» agregar ACTION «Mover de etapa» → «seguimientos» DEL CRM DEL
    SPRINT (no el principal: con `embudoId` del Sprint, `ficha_secuencia_mensajes` lo muestra). Antes, probarlo en el ws3
    (crear y activar una de prueba). Las dos cosas son escribir en producción: no las hice.
  - **MAU-08, ws1: etiqueta «SPRINT 3 DÍAS».** Tampoco es código: una tarjeta TAG «Agregar SPRINT 3 DÍAS» justo después del
    CRON de la automatización del Sprint, y el lote para los que ya pasaron (los leads con inscripción en esa automatización,
    `inscripciones_lead` / `poner_etiqueta_lead`). Crear la etiqueta si no existe (`crear_etiqueta`). Escribir en el ws1: no lo hice.
  - **Leila 1 (ws11), medido el 28/10 (sólo lectura):** el link venía de 4 avisos del 02 al 05/10 (el EJEMPLO de
    `reunion-recordatorio`, agendado «por tiempo», con un lead real de otro cliente), el incidente que cerró
    `motivoNoAgendable` el 06/10. Hoy no hay camino que lo mande. Queda: el ejemplo sigue apuntando a `crm/482`, y la caída
    de la IA del aviso devuelve el ejemplo tal cual (`generarMensajeAviso`); propuesta para otra tanda.
  - **Leila 2 (ws11):** no medí en su base cuántos de «reactivación» quedaban afuera (es leer producción). Al desplegar, si
    ella pausa y vuelve a activar su automatización, MaKo le cuenta y le ofrece sumarlos.
  - **Ticket #17 (Leandro, ws10), su automatización 680 (leída en producción, sin escribir):** no arrancaba nunca: su filtro
    «pruebafm» es la CONDITION «Respuesta del formulario contiene» (mira un formulario, no el comentario) y está PAUSADA. Lo
    que hay que cambiarle, después del despliegue (escribir en su negocio: no lo hice): en el CRON, palabras «pruebafm»
    (o «fiesta», «guía»); sacar esa CONDITION (la tarjeta `nxwrr0r`); en «Enviado, mira tus mensajes» (`nifhef7`) prender
    «Responder en público»; y activarla. La prueba de punta a punta, en memoria y sin mandar nada, da verde.
  - **Ticket #17:** sin probar con un comentario de verdad. El #12 (mismo texto) no lleva hito: decidí vos si
    se cierra con el mismo aviso.
