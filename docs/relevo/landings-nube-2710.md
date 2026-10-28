# Relevo para el chat de la NUBE — Landings (27/10/2026, cuenta claude4)

Escrito por el Cerebro con un lector que verificó con git la cronología del chat de la cuenta 5, cortado por cuota el 27/10 ~20:15 ART.

## Cómo trabajás en la nube
- Arrancás desde la etiqueta `respaldo/landings-2710-nube` (ya tiene lo que el chat dejó sin commitear, como commit WIP). `git fetch origin tag respaldo/landings-2710-nube && git checkout -b landings-nube-2710 respaldo/landings-2710-nube`.
- ENTREGÁS POR ETIQUETA, nunca por rama: cuando una tanda está lista y con sus tests en verde, `git tag nube/landings-2710-<n> && git push origin refs/tags/nube/landings-2710-<n>`. Una rama en origin dispara un build de Vercel (cuesta plata).
- No pushees a main ni a integracion. El Cerebro mezcla tus etiquetas al tren.
- Commit por ruta explícita (nunca git add -A), firmado con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` y `Claude-Cuenta: claude4` pegados.
- Corré tus tests y los que barren el repo (tests/puente-panel-copy si tocás copy; tests/fuentes-leads-webhooks si tocás credenciales; `node scripts/rutas-windows-en-tests.mjs`; `node --import tsx scripts/generar-api-doc.mjs` si tocás lib/api-mako). No corras el tsc entero.
- Producción (Supabase, migraciones, mensajes a clientes) NO se toca desde la nube: anotalo en «Para el Cerebro» al final de este archivo y commitealo.

## Estado al cortarse
**Último encargo:** Cerebro (mensaje de las ~18:07 ART del 27/10) pidió 4 cosas del feedback de las llamadas y, antes, a pedido de Martín (~16:50): «asegurate de que funcione bien la API con todos los comandos, si una persona quiere editar lo que sea debería poder. Con prompts en mako». A las 19:43 ART el chat entregó la punta 6da648600 (puntos 1 y 2) y cerró con una pregunta al Cerebro sin respuesta: «¿Dejo ahora la frase nueva como borrador de la #32 en producción, o espero a que pase el tren?». No hay actividad registrada después de las 19:43. Al cortarse no tenía nada a medias: worktree limpio, todo commiteado. El punto 3 (borrador de la #32) estaba sin empezar y el punto 4 (réplica con animaciones) bloqueado esperando una dirección.

## Brief

BRIEF · chat «Landings» (Web Generator) · relevo de claude5 a claude4 · 27/10/2026

Quién sos: el chat «Landings» (Web Generator, ex Landing Generator, el editor copiado de Gamma). Te habla el Cerebro (cita a Martín). Respondé en español, voseo, sin relleno. Martín es el dueño; Mauricio es cliente.

LO PRIMERO QUE HACÉS (en este orden)
1. Medí el uso de tu cuenta (claude4) y reactivá el RUNNER antes de nada, como pide la memoria «Al iniciar una cuenta nueva, PRIMERO» y «corte al 97%». Después seguí.
2. Firmá/commiteá con «Claude-Cuenta: claude4» pegado a la línea Co-Authored-By. Confirmá la cuenta con head -1 ~/.claude/cuenta-activa.txt antes de commitear.
3. `git fetch -q origin` y mirá el estado: en C:/dev/wt-landings-2510 (rama landings-2510-b, punta 6da648600, limpio, sin cambios sin commitear). Corré `git merge-base --is-ancestor 6da648600 origin/main`; hoy da NO (origin/main = bbb459f33). Sí están en la rama del tren tren-o (verificado el 27/10 ~20:38 ART, tren-o = 2f6ae9abf).
4. Leé primero docs/relevo/landing-generator.md (en tren-o: tabla «Lo que se edita a mano en una landing ↔ el comando que lo cambia por prompt (27/10/2026)» al final, y el bloque del 27/10 cerca de la línea 127) y docs/hallazgos-editor-landing.md (entradas «Replicar y adaptar» y la del formato de texto).

QUÉ ESTÁ ENTREGADO (no lo rehagas, no lo rebases)
- 6c0f1433c: todo lo editable a mano, también por prompt: comando nuevo dar_formato_texto_landing (negrita, cursiva, subrayado, tachado, color, tamaño, alineación; bloques y páginas de MaKo), colores del botón de diseño en configurar_boton_landing (color, colorTexto), cambiar_imagen_landing ahora cambia la imagen de un bloque y de un ítem de diseño optimizado; el reconocedor de pedidos (lib/mako-intencion.ts) y la relevancia del presupuesto por turno ya dejan pasar «pon en negrita…» por WhatsApp.
- 6da648600 (encima de 6c0f1433c): «Replicar y adaptar» (Leila, ticket 876470842-27, prometido para el 27/10): cuadro de crear con «Replica esta landing» / «Replica y adapta a tu oferta», panel Replicar con «Tal cual» / «Adaptada a tu oferta», replicar_landing acepta adaptar; más iniciales seguras en PanelComentarios (React #418 con emoji) y la guarda tests/iniciales-con-emoji ampliada a nombre.trim()[0].
- Las dos puntas YA ESTÁN en tren-o. No las rebases ni las re-armes: si necesitás cambiar algo de ellas, hacelo en commits nuevos encima, en tu rama.

TU TRABAJO (pendiente, de más a menos importante)
A. Landing principal (#32 del ws9, la que sirve hola-mako.com): dejar la frase nueva como BORRADOR, SIN publicar (publicar es de Martín; el sí va en el chat). Decidido por el Cerebro con lo que dijo Martín en la llamada (ticket 876825880-01): titular «El mejor SaaS para ventas High Ticket, de punta a punta»; sacar «VSL Funnel» como promesa central de los dos títulos que hoy lo prometen (poner «tu venta High Ticket»); poner el scraper en la bajada. Antes de tocar nada, releé la #32 en producción (el 27/10 a las 18:18 decía «El mejor software para vender High Ticket con VSL Funnel»; puede haber cambiado). El respaldo en código (app/vsl/landing-contenido.ts:22, «Todo lo que tu VSL Funnel necesita») sólo se ve si no hay documento publicado: actualizalo también en código si corresponde, pero el borrador va en el documento. El chat anterior le preguntó al Cerebro si lo hacía ya o esperaba al tren y no hay respuesta registrada; el pedido original decía «lo dejás como borrador», así que procedé y avisá.
B. Prueba por prompt en producción, sin publicar nada, sobre la copia #44 (un prompt por fila de la tabla del relevo), después de que el Cerebro suba el tren y despliegue. Antes de probar confirmá que lo desplegado incluye 6da648600 (pushear no es desplegar). replicar_landing con adaptar gasta IA del ws9: probala una sola vez. Al terminar, las copias #44, #45 y #46 (todas sin publicar) van a la papelera (no borrado permanente).
C. Réplica con animaciones (ticket 876825880-07, prioridad baja): BLOQUEADA hasta tener la dirección exacta. «sendipro.com» no resuelve en DNS (ENOTFOUND, con y sin www) y la búsqueda no la encuentra. El diagnóstico del ticket era el equivocado: la copia fiel NO saca los scripts, sólo los rastreadores (Píxel, GTM, Hotjar…) (lib/editor-landing/replicar-reglas.ts). Pedile la dirección al Cerebro; no inventes. Listo = replicada con animaciones, o un aviso de qué no se pudo copiar.
D. No es tuyo: seis casos de inicial a mano en Automations, Calendario, Classroom, Mobile y un componente compartido están anotados en docs/hallazgos-ui.md. No los toques.

REGLAS DE ENTREGA (las dice la memoria; cumplilas)
(a) Tu punta va al Cerebro «VERDE sin tipos»: NO corras tsc ni el VERDE completo del repo. Corré los tests de lo que tocaste, más los que barren el repo si tocaste copy o credenciales (ver memoria tren-de-pushes y verde-sin-tipos-tsc-acotado). Decile en la línea del VERDE: «sin tipos: lo corre Integración en el tren». Rompé a propósito cada pieza nueva y mostrá que su test la atrapa. Ojo: el 27/10 el tren tuvo que arreglar a mano un test que el chat anterior no corrió (tests/web-generator-ventana-en-el-clic.test.ts, fijaba el código previo a «Replicar y adaptar»): si tocás el editor o el cuadro de crear, buscá con grep los tests que leen esos archivos como texto antes de dar el VERDE.
(b) Commiteá por ruta explícita, NUNCA git add -A (hay sesiones paralelas). Firmá cada commit con «Claude-Cuenta: claude4» pegado a la línea Co-Authored-By.
(c) Trabajá en tu worktree propio: C:/dev/wt-landings-2510 (rama landings-2510-b) o uno nuevo cortado de tren-o si preferís, pero nunca en C:/dev/wt-push-q (es del Cerebro).
(d) No rebases lo ya entregado al tren (6c0f1433c y 6da648600): hacé merge de origin/main/tren-o si necesitás ponerte al día, nunca rebase.
(e) Cosecha al terminar: lo aprendido va a docs/hallazgos-editor-landing.md (o el área donde viva el código), el índice docs/hallazgos.md en el MISMO commit, el relevo docs/relevo/landing-generator.md y la bitácora app/admin/dev/landing-generator/bitacora.ts. Al reportar, decí dónde quedó cosechado.
(f) Pasale al Cerebro las puntas con sha y viñetas cortas en palabras de producto (nombres de negocios y personas, no códigos). Podés dejar tablas largas en la carpeta compartida C:/Users/marti/AppData/Roaming/Claude/side-session-notes/local_3f1a66d3-690f-4ebc-bd98-7dcf1cf14bb8/<tema>/LEEME.md (el informe que le llega se corta a 400 caracteres).

DECISIONES DE MARTÍN A RESPETAR
- «Y asegurate de que funcione bien la API con todos los comandos, si una persona quiere editar lo que sea debería poder. Con prompts en mako me refiero» (27/10). Cumplido salvo la prueba por prompt en producción (punto B).
- La red animada de MaKo no tiene comando porque tampoco se edita a mano: es parte del diseño. El efecto de entrada de su sección sí se cambia.
- Landings de MaKo, copias de prueba y la #32: NADA se publica sin el sí de Martín en el chat. Un sí del Centro de Operaciones no alcanza para producción ni terceros.
- No hay límite de preguntas a Martín sino al revés: decidí con criterio y no repreguntes lo que ya contestó otro chat.
- La landing principal usa «High Ticket» y el scraper, sin «VSL Funnel» como promesa central (decidido por el Cerebro con lo que dijo Martín en la llamada).

TRAMPAS YA PISADAS
- El heredoc/shell se come las barras invertidas (\ y regex): usá Edit para tests con regex, no node -e en línea.
- Heredoc/CRLF: los archivos de lib/mako-intencion.ts y varios son CRLF; el índice de git queda en LF. Verificá con git ls-files --eol antes de commitear.
- La guardia de RAM corta tests y tsc con «salida 1 sin texto»: no es un error de tipos. Usá --test-concurrency=1 y esperá la reserva del Cerebro.
- El registro de la API exige títulos de 3 a 6 palabras y descripción en cada parámetro; regenerá la doc con `node --conditions=react-server --import tsx scripts/generar-api-doc.mjs` cuando cambies un comando.
- El presupuesto de herramientas por turno de la app es 12.000 caracteres y la frase del formulario está en 11.962: cualquier descripción nueva larga en landing-editor.def.ts la saca. Medilo con scripts/presupuesto-turno-app.mts.

Hecho = (A) borrador de la #32 dejado y verificado leyéndolo, sin publicar; (B) prueba por prompt documentada y copias a la papelera; (C) respondido con la dirección real o dejado como bloqueado con el motivo. Y reportá al Cerebro con sha, tests y dónde cosechaste.

## Pendientes, en orden
1. Landing principal (#32 del ws9, la que sirve hola-mako.com): dejar la frase nueva como BORRADOR, sin publicar (publicar es de Martín). Decidido por el Cerebro: titular «El mejor SaaS para ventas High Ticket, de punta a punta», sacar «VSL Funnel» como promesa central de los títulos («tu venta High Ticket» en los dos títulos que hoy lo prometen) y poner el scraper en la bajada. Hoy hola-mako.com dice «El mejor software para vender High Ticket con VSL Funnel». El respaldo en código es app/vsl/landing-contenido.ts:22 (solo se ve si no hay documento publicado). Es trabajo sobre producción (navegador/API de MaKo sobre la #32), no código; el chat preguntó si lo hacía ahora o esperaba al tren y no tuvo respuesta.
2. Prueba por prompt en producción, sin publicar nada, sobre la copia #44 (un prompt por fila de la tabla del inventario): espera el deploy del tren (las puntas no están en main). Incluye dar_formato_texto_landing, colores de botón de diseño, imagen de bloque, y replicar_landing con adaptar (esta última gasta IA del ws9).
3. Copias de prueba #44, #45 y #46: siguen sin publicar; van a la papelera después de la prueba por prompt.
4. Réplica con animaciones (ticket 876825880-07): BLOQUEADA. sendipro.com no resuelve en DNS (ENOTFOUND, con y sin www) y la búsqueda no la encuentra; el navegador integrado no tiene permiso para ese dominio. Diagnóstico del ticket equivocado: la copia fiel NO saca los scripts, sólo los rastreadores (Píxel, GTM, Hotjar…) (replicar-reglas.ts). Hace falta la dirección exacta para medir qué animaciones no se copian y avisarlo, o replicar. Está anotado en docs/hallazgos-editor-landing.md.
5. Seis casos de inicial a mano (nombre.trim()[0]) en otras áreas (Automations, Calendario, Classroom, Mobile y un componente compartido) quedaron anotados con su archivo en docs/hallazgos-ui.md, sin arreglar (no son de Landings).
6. tsc acotado nunca corrido sobre ninguna de las dos puntas (RAM insuficiente); lo corre Integración en el tren.

## Decisiones de Martín que se respetan

## Lo que espera a Martín (no lo hagas vos)
- Nada pendiente de Martín en este chat. La frase de la landing principal ya la decidió el Cerebro (con lo que dijo Martín en la llamada) y se deja como borrador; publicarla sí es de Martín.
- La dirección exacta de la landing con animaciones que quería replicar (Leila/ticket 876825880-07): «sendipro.com» no existe en DNS. Quien la tenga (Martín o el Cerebro) tiene que pasarla; sin eso el punto 4 no avanza.

## Dudas que el lector no pudo verificar
- No verifiqué qué hay hoy en la #32 ni en hola-mako.com (es producción; solo leí lo que el chat dijo a las 18:18). El brief debe pedir releerla antes de tocar.
- No verifiqué si el tren ya se desplegó ni si hola-mako.com ya sirve las puntas: origin/main sigue en bbb459f33 al momento de esta lectura; tren-o está en 2f6ae9abf (20:38 ART).
- La pregunta final del chat al Cerebro («¿borrador de la #32 ahora o espero al tren?») no tiene respuesta registrada. El pedido original del Cerebro ya decía «lo dejás como borrador», así que el sucesor puede proceder, pero un Cerebro que ya contestó en otro chat queda fuera de mi vista.
- No abrí las dos LEEME.md del Cerebro (.../side-session-notes/local_3f1a66d3.../todo-editable-por-prompt-2710/LEEME.md y feedback-llamadas-2710/LEEME.md); existen. Tampoco corrí tests ni tsc (consigna del encargo).
- La cuenta del chat anterior se cortó a las ~20:15 pero el log del chat termina a las 19:43; el tramo 19:43–20:15 no deja rastro en el log (no hay mensajes ni herramientas).

## Para el Cerebro
(anotá acá lo que necesita producción o una decisión)
