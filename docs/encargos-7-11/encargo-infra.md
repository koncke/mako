# Encargo: Infraestructura — 27 pendientes (7/11/2026)

**Qué es esto.** La lista depurada de pendientes de MaKo: de 634 anotadas el 6/11 quedaron 232 de
trabajo real (`docs/pendientes-depurados-7-11.md`). Éstos son los de tu área, ordenados por el
criterio de Martín: **cliente roto > plata > traba > features**.

## ⚠️ LEÉ ESTO ANTES DE TOCAR CÓDIGO, porque es lo que más tiempo ahorra

El 7/11 se verificaron los cuatro primeros de la lista **y tres estaban ya resueltos**. El
inventario es una foto del 6/11 y entre el 6 y el 7 entraron 601 commits a main.

**Entonces: por cada ítem, PRIMERO verificá contra el código que el síntoma siga existiendo.** Si ya
no existe, escribilo y pasá al siguiente — eso vale tanto como arreglarlo.

Tres trampas medidas ese día, las tres reales:

1. **Un pendiente que enumera «N puntas atadas» envejece punta por punta, no entero.** En «la cadena
   de pago sale del dominio del cliente», tres de cuatro puntas ya estaban hechas y el título seguía
   igual que el primer día.
2. **Un pendiente anotado muchas veces NO es más urgente: es uno que se contó muchas veces.** El más
   repetido del inventario (4 entradas) describía un recuadro gris que se había sacado el día anterior.
3. **Si dice «el número X está mal, debería ser Y», fijate si X e Y son del mismo período.** Uno decía
   «US$238 está mal, es US$426»: eran noviembre y diciembre, los dos correctos. «Arreglarlo» rompía
   noviembre.

## Cómo se entrega

Una punta por tema: `git push origin HEAD:refs/heads/punta/<nombre>`. Llega sola a `main` con verde
(`.github/workflows/punta.yml`). **`integracion` se retiró el 4/11: un push ahí da rojo a propósito.**
No hace falta esperar a que termine la anterior.

⚠️ **«En main» no es «en producción»:** el deploy lo hace un cron a las 11:05 UTC.

Lo que aprendas va a `docs/hallazgos-<área>.md` **en el mismo commit**, y el índice
`docs/hallazgos.md` se actualiza ahí mismo. Sobre todo **cuando el diagnóstico obvio era el
equivocado**: eso es lo que más tiempo ahorra después.

---

### 1. Con la clave 1 de Apify quitada y la 2 puesta, Spy anda y la tarjeta dice «Sin conectar»

_plata · chico · ⟳ estaba anotado 2 veces_

`integracionConectada` mira solo los campos NO opcionales del servicio, y de Apify el unico obligatorio es `APIFY_INSTAGRAM_TOKEN` (la clave 1); las extra son `opcional`. Asi que un negocio que borro la 1 y dejo la 2 ve la tarjeta desconectada aunque Spy este leyendo perfectamente con la 2. Hecho = el estado de la tarjeta mira si hay AL MENOS UNA clave de `CLAVES_APIFY_DE_SPY` con valor real (el patron ya existe en esa misma funcion para las pasarelas con sufijo, lineas 303-307).

**Dónde:** `C:/dev/wt-puntas/lib/credenciales.ts:285-307 (integracionConectada) — OJO: el relevo dice `lib/integraciones.ts`, pero la funcion vive en credenciales.ts; el catalogo de las claves extra en C:/dev/wt-puntas/lib/metodo-catalogo.ts:848-872`

<details><summary>Las otras formas en que estaba escrito</summary>

- La tarjeta de Apify dice «Sin conectar» si se quita la clave 1 y queda la 2
</details>

### 2. Aplicar la migración 0401 (movimientos de suscripción) en producción

_plata · chico_

Correr supabase/migrations/0401_suscripcion_movimientos.sql con scripts/apply-migration.mjs. Hecho = la ficha de suscripción muestra los movimientos mes a mes sin el aviso de columna faltante.

**Dónde:** `C:/dev/wt-puntas/supabase/migrations/0401_suscripcion_movimientos.sql · pendiente anotado en C:/dev/wt-puntas/docs/hallazgos-pagos.md:1799`

### 3. Techos de 1000 filas sin paginar: diez lecturas que truncan con un 200

_plata · grande_

Pasar a leerTodo/leerPorPaginas (con orden único) las que siguen abiertas: closing_analyses entera (428 en ws9), plan_tareas del board del super admin (643/1000), experimento_tareas (212), vsl_events/landing_visits por visitante (612 en ws13), leads y pagos del embudo y la cobranza, cashUsd/soldUsd, bloqueados y ocultos del inbox, leads de las conversaciones, y el patrón por nombre de leads con .limit(100). Hecho = ninguna de las diez corta en silencio.

**Dónde:** `C:/dev/wt-puntas/app/crm/insights-actions.ts:56 · lib/plan-board.ts:101,180,302,405,583,656,735,906 · lib/plan-proyecto-vacio.ts:53,107 · app/admin/dev/roadmap.ts:142 · lib/todo.ts:184,192,373,453 · lib/leads.ts:367,1482,2264,2286 · lib/leads-duplicados.ts · lib/queries.ts:2989 · lib/pagos.ts:411,50`

### 4. El indice docs/hallazgos.md quedo a MEDIO consolidar: 194 filas para 109 areas, no «dos de Carruseles»

_plata · mediano_

La lista trajo esto como «dos filas de Carruseles». Es mucho mas grande: el propio documento declara la regla en su linea 15 («**Una fila por area** (6/11/2026)») y cuenta que ese dia eran 362 filas para 76 areas. Hoy quedan 194 filas de tabla para 109 rotulos de area y solo 53 documentos distintos: Competitors Spy tiene 27 filas, Infraestructura 16, Comunicacion 8, «Planes, capas y cobro» 7, Plan 6, Agency Dashboard 6, y 22 areas mas con 2 a 5. La consolidacion se arranco y se dejo a mitad. Hecho = una fila por documento (53), con el resumen integrado, y el conteo escrito en la cabecera.

**Dónde:** `C:/dev/wt-puntas/docs/hallazgos.md:15 (la regla) y toda la tabla desde :18; las dos de Carruseles son :45 y :48`

### 5. La URL vieja del webhook del WhatsApp no oficial vence MAÑANA (7/11)

_traba · chico · ⟳ estaba anotado 2 veces_

Entrar a /whatsapp y tocar «Reparar espejo» en cada línea que siga muda. Hecho = ninguna línea queda sobre la URL legada. Pasada la fecha, el espejo de esa línea muere en silencio (ya pasó el 10/07).

**Dónde:** `lib/evolution-firma.ts:29 (CORTE_LEGADO) · docs/relevo/pendientes-barrido.md P1 · docs/pendientes.md:267`

<details><summary>Las otras formas en que estaba escrito</summary>

- La URL vieja del webhook de WhatsApp no oficial vence el 7/11
</details>

### 6. El hook `pre-push` del clon del Runner es viejo: dice «rama integracion» y no corre el filtro chico

_traba · chico_

Anotado en el relevo del Runner y en ninguno de los items de la lista. Un pre-push viejo no corre el filtro chico, asi que ese clon puede empujar algo que el pre-push nuevo habria frenado. Se reinstala con lo escrito en `docs/relevo/nube-metodologia.md`. Hecho = el hook de ese clon corre el filtro chico y no nombra una rama que ya no existe.

**Dónde:** `C:/dev/wt-puntas/docs/relevo/runner.md:37-48 (§Sin hacer) · C:/dev/wt-puntas/docs/relevo/nube-metodologia.md (como se instala)`

### 7. `lib/centro-limbo.ts` quedo con cuatro funciones sin ninguna pantalla que las llame

_traba · chico_

Verificado con grep: `chatsParaMandarle` no tiene mas uso que su propia definicion, y `originalParaReenviar` solo aparece en su definicion y en un documento de bitacora; `queHacer` y `textoDelCartel` existen en otros modulos pero no para el limbo. `descartarDelLimboAction` esta declarada en `app/admin/operaciones/acciones.ts` sin boton que la dispare. O sea: hay reglas escritas para reenviar un mensaje del limbo y para decirle a la persona que hacer, y no hay pantalla. Hecho = o la pantalla las usa (el limbo se cierra desde el Ops Center sin SQL), o se borran con su test.

**Dónde:** `C:/dev/wt-puntas/lib/centro-limbo.ts (`originalParaReenviar`, `queHacer`, `chatsParaMandarle`, `textoDelCartel`) · C:/dev/wt-puntas/app/admin/operaciones/acciones.ts (`descartarDelLimboAction`) · C:/dev/wt-puntas/docs/relevo/runner.md:37-48`

### 8. Si el cron del Runner vence el 11/11, el vigia se apaga y la guardia no lo mira

_traba · chico_

El relevo del Runner lo deja escrito: si el cron vence sin rearmarse, la medicion sigue por `medirYa` de la guardia, pero el vigia se apaga y nada avisa. La lista trae el «rearmar el cron antes del 11/11» (que solo puede pedir Martin), pero no esto, que es codigo y no depende de el: que la guardia chequee si el cron existe y lo diga. Hecho = la guardia reporta «el cron del Runner no esta» en vez de quedarse callada.

**Dónde:** `C:/dev/wt-puntas/docs/relevo/runner.md:37-40 (§Sin hacer, primer punto)`

### 9. `punta.yml` no frena el correo noreply@anthropic.com y Vercel bloquea esos deploys

_traba · chico_

La nube viene firmando con `noreply@anthropic.com` y Vercel bloquea esos deploys. Las puntas de rescate se firmaron a mano con el correo del equipo, pero la mezcla de `punta/spy-busqueda` entró a main con `noreply` (9202c22d2). Falta que `punta.yml` frene ese correo como frena `[bot]`. Lo decide Integración.

**Dónde:** `C:/dev/wt-puntas/.github/workflows/punta.yml ; docs/relevo/nube-ramas.md:33-35`

### 10. Seis migraciones anteriores a la 0331 nunca se midieron

_feature · chico · ⟳ estaba anotado 2 veces_

De la 0331 en adelante están medidas: 48 aplicadas, 0 ausentes, 4 «sin verificar» (0336, 0347, 0348, 0352, que sólo recrean algo que ya existía). Quedan sin medir 0298, 0299, 0302, 0314, 0316 y 0330. Correr `node scripts/verificar-migraciones-aplicadas.mjs` (sólo lee) desde la 0298 y aplicar las ausentes en su orden de despliegue (cabecera del .sql). Sin la 0316 El Archivero no guarda de dónde vino cada documento.

**Dónde:** `scripts/verificar-migraciones-aplicadas.mjs · docs/relevo/pendientes-barrido.md P4 · docs/relevo/pendientes-pc/pasos-cerebro-6-11.md §Conteos`

<details><summary>Las otras formas en que estaba escrito</summary>

- Migraciones viejas sin medir: 0298, 0299, 0302, 0314, 0316, 0330
</details>

### 11. El limbo del Runner: 6 mensajes, los primeros vencen el 8/11

_feature · chico · ⟳ estaba anotado 2 veces_

Cerrarlos desde el Ops Center antes del 8/11. Hecho = el limbo en 0.

**Dónde:** `docs/relevo/pendientes-barrido.md P2 · app/admin/operaciones`

<details><summary>Las otras formas en que estaba escrito</summary>

- El limbo del Runner: 6 mensajes y los primeros vencen el 8/11
</details>

### 12. Las 343 operaciones aprobadas de la API de MaKo viven en un worktree sin pushear y se pierden si alguien lo limpia

_feature · chico_

`docs/api-acciones-relevo.json` NO esta en main (ls falla). Esta solo en `C:/dev/mako-api`, rama `wip/api-acciones-0910`, commit bf5d86f73 del 9/10, que `git merge-base --is-ancestor` dice que NO es ancestro de HEAD. Ahi estan las 343 operaciones aprobadas de la corrida de 20 areas (83 llegaron a tener codigo, 260 quedaron solo relevadas y verificadas: crm 42, curso 42, video 30, plan 27, cs 26, chatbot 24, ads 20, negocio 18, equipo 17) y 13 archivos de test que main no tiene. Hay 70 worktrees en la maquina y el disco lleno ya es un problema conocido: si ese se limpia, el relevamiento se va con el. Hecho = el JSON commiteado en main (es solo un documento, no toca codigo) y la cantera anotada en el indice.

**Dónde:** `C:/dev/mako-api (rama wip/api-acciones-0910, bf5d86f73) · C:/dev/mako-api2 (wip/api-acciones-1410, b85971b9b) · C:/dev/wt-puntas/docs/relevo/api-mako.md:160-200`

### 13. Tres scripts dejan perfiles de Chrome en Temp y nada poda tsx-marti (1 GB por día)

_feature · chico_

Un borrado en finally para los mkdtempSync de mako-cdp-, y decidir una tarea semanal que vacíe tsx-marti. Hecho = correr los scripts no deja carpetas y el disco no crece solo.

**Dónde:** `C:/dev/wt-puntas/scripts/mirar-consola.mjs:25 · scripts/mirar-pantalla.mjs:55 · scripts/onboarding-vg-recorrer.mjs:25 · pendiente en C:/dev/wt-puntas/docs/hallazgos-infra.md:9288`

### 14. Aplicar la 0372: sin ella el grupo del Ops Center da «No pude abrir el grupo»

_feature · chico_

Aplicar la 0372. Hecho = el grupo del negocio abre en el Ops Center sin ese cartel.

**Dónde:** `C:/dev/wt-puntas/supabase/migrations/ (la 0372) · app/_chat/grupo/HiloDelGrupo.tsx · pendiente en C:/dev/wt-puntas/docs/hallazgos-ops-center.md:120`

### 15. Aplicar la 0394: «Ignorar» una decisión de la Ticketera no hace nada

_feature · chico_

Aplicar la 0394 (columna ignorada_at). Hoy el botón contesta «Todavía no se puede». Hecho = ignorar una decisión de la Ticketera la saca del bloque del Ops Center.

**Dónde:** `C:/dev/wt-puntas/supabase/migrations/ (la 0394) · lib/admin-decisiones.ts (ignorarDecision) · app/admin/operaciones/PreguntasDelChat.tsx · pendiente en C:/dev/wt-puntas/docs/hallazgos-operaciones.md:3847`

### 16. Aplicar la migración 0407 (plantillas propias)

_feature · chico_

Aplicar la 0407 y confirmar su número antes (hay números repetidos en el directorio). Hecho = «Guardar como plantilla» persiste una plantilla propia.

**Dónde:** `C:/dev/wt-puntas/supabase/migrations/ (la 0407) · pendiente en C:/dev/wt-puntas/docs/hallazgos-plantillas.md:127`

### 17. Aplicar la migración 0406 (email del Calendario enlazado a un broadcast)

_feature · chico_

Aplicar la 0406 antes o junto con el deploy. Hecho = enlazar un Email del Calendario a un broadcast de Email Marketing guarda el enlace y moverlo reprograma el envío.

**Dónde:** `C:/dev/wt-puntas/supabase/migrations/ (la 0406) · lib/calendario-email.ts · app/calendario/EnlazarEmail.tsx · pendiente en C:/dev/wt-puntas/docs/hallazgos-calendario.md:40`

### 18. Los modelos de Gemini escritos a mano siguen repartidos en varios archivos

_feature · chico_

Juntarlos en una constante. Son todos alias `-latest` (no envejecen como un id con versión, pero viven en varios lugares): lib/ai-cheap.ts (MODELOS_RESPALDO y cuatro usos más), lib/model-catalogo.ts:100, lib/offer-ia.ts:75, lib/transcribe-plataforma.ts:113, y tres scripts. Es trabajo de la capa de IA (Infra), no de Spy: Spy no los tocó.

**Dónde:** `C:/dev/wt-puntas/lib/ai-cheap.ts ; lib/model-catalogo.ts:100 ; lib/offer-ia.ts:75 ; lib/transcribe-plataforma.ts:113 ; lista en docs/relevo/nube-spy.md:246-259`

### 19. Tres cosas de la metodología de subida quedaron sin medir

_feature · chico_

(1) Si `repository_dispatch` (vercel.deployment.*) llega a `despues-del-deploy.yml` y si `github.silent` lo corta — el vigía da rojo si en 48 h hubo commits en main y no llegó ninguno. (2) El firewall de Vercel con el runner de GitHub: la prueba de humo puede dar rojo por un 403 y no por una caída. (3) El filtro en la PC con 8 chats: el tope de 90 s se midió en la nube (4 CPU, 15 GB libres); en la notebook va a entrar menos.

**Dónde:** `C:/dev/wt-puntas/docs/relevo/nube-metodologia.md:89-99 ; .github/workflows/despues-del-deploy.yml`

### 20. La migración 0396 sigue sin aplicar y va DESPUÉS del deploy

_feature · chico_

Aplicar `0396_wa_mensajes_automatico.sql` (suma `automatico` a wa_mensajes) y después comprobar que el primer WhatsApp automático queda con `automatico = true`. Va después del deploy a propósito: antes, la versión vieja dejaría automáticos como si los hubiera escrito una persona, y eso rompe la métrica de primer contacto de Código Inmobiliario.

**Dónde:** `C:/dev/wt-puntas/supabase/migrations/0396_wa_mensajes_automatico.sql ; lib/primer-contacto.ts ; docs/relevo/cerebro.md:21 y :80`

### 21. Dos textos de avisos de la plataforma sin corregir (P8, P9)

_feature · chico_

Mirar si existe la plantilla «Tu contraseña cambio» en `mako.plantillas.store` del ws 9 y crearla si falta; y corregir la fila viva #261, donde `gracia` y `liquidacion` dicen «Tu cuenta» sin «publicitaria».

**Dónde:** `docs/relevo/pendientes-barrido.md:152-153`

### 22. La tarjeta de Apify le dice al cliente «un tope de 40 lecturas por dia» y el tope real de Spy es 150

_feature · chico_

La nota del campo `APIFY_INSTAGRAM_TOKEN` quedo con el numero viejo: el tope de Spy con la clave del negocio subio de 40 a 150 el 4/11 (`TOPE_LECTURAS_SPY_POR_DIA`), y 40 es otro cupo (`APIFY_TOPE_POR_DIA`, el del buscador del alta del CRM). Es texto que el cliente lee y que subestima lo que puede gastar. Hecho = la nota con el numero de la constante, y las busquedas (60 corridas) nombradas si corresponde.

**Dónde:** `C:/dev/wt-puntas/lib/metodo-catalogo.ts:854 vs C:/dev/wt-puntas/lib/instagram-perfil.ts:236 (APIFY_TOPE_POR_DIA = 40) y :246 (TOPE_LECTURAS_SPY_POR_DIA = 150), :253 (TOPE_BUSQUEDAS_SPY_POR_DIA = 60)`

### 23. La réplica editable quedó sin ver con la base

_feature · mediano_

Abrir las copias #68 y #69 en el editor y ver si los dos ❌ se fueron; mirar las capturas 1440/390; correr el chat de punta a punta en #70–#72; y mandar las copias #68–#72 a la papelera al cerrar. Los 24 commits ya están en main (33d6a73f1).

**Dónde:** `C:/dev/wt-puntas/docs/hallazgos-editor-landing.md («La réplica editable») ; docs/relevo/nube-ramas.md:31-32`

### 24. Las primitivas de fecha siguen ancladas a Tijuana en ~60 call-sites

_feature · grande_

hoyEnTijuana, ayerEnTijuana, lunesActualEnTijuana y primerDiaDelMesEnTijuana deciden bordes de día que definen cohortes y disparos (no es display): pasarlas a la zona del workspace, escritura y lectura juntas. Hecho = un workspace en otra zona cuenta sus días.

**Dónde:** `C:/dev/wt-puntas/lib/date-utils.ts · anotado en lib/timezone.ts:47 · pendiente en C:/dev/wt-puntas/docs/hallazgos-infra.md:4396`

### 25. No hay auditoría de borrados, y dos buckets no se limpian por prefijo

_feature · mediano_

1) Registro de quién borró un cliente y cuándo (las filas de agencia_clientes y agencia_altas cascadean, así que se lleva el registro de que la agencia lo pidió y el super admin lo firmó, contra lo que dicen las migs 0175 y 0178). 2) video-clips y ads-creatives guardan bajo video-generator/<planId>/ y nueva/, no bajo <ws>/: lo que quede ahí sobrevive al borrado. Hecho = borrar un negocio deja rastro y no deja archivos.

**Dónde:** `C:/dev/wt-puntas/lib/reset-workspace.ts · supabase/migrations/0175, 0178 · pendiente en C:/dev/wt-puntas/docs/hallazgos-infra.md:7096`

### 26. La guarda de cobertura de server actions de la API de MaKo no esta en main: 174 acciones sin declarar y nada que las cace

_feature · mediano_

`scripts/api-cobertura.mjs` y `lib/api-mako/cobertura.ts` NO existen en el arbol (lo verifique con ls); viven solo en la rama cantera `wip/api-acciones-1410`, que el Cerebro decidio el 23/10 no mergear nunca. Sin la guarda, cada server action nueva puede nacer sin su operacion en la API y nadie se entera: la auditoria del 23/10 conto 174 acciones sin declarar. Hay que rehacerla como pieza propia (copiar el archivo y sus tests desde la cantera, como se hizo con `comunidad` el 17/10). Hecho = `node scripts/api-cobertura.mjs` corre en el pre-push y el numero de acciones sin declarar baja de 174, medido.

**Dónde:** `C:/dev/wt-puntas/docs/relevo/api-mako.md:7-12 (la decision y el inventario) · C:/dev/cerebro-herramientas/auditoria-api-mako-23-10.md (las 174) · faltan C:/dev/wt-puntas/scripts/api-cobertura.mjs y C:/dev/wt-puntas/lib/api-mako/cobertura.ts`

### 27. Nadie paso por los 39 pendientes vivos de docs/estado-del-arte.md, y el documento esta en parte vencido

_feature · mediano_

`docs/estado-del-arte.md` tiene una seccion «Pendientes vivos» con 39 items priorizados por riesgo, marcados [FRAGIL] (se pierde o empeora si nadie lo toca) y [ESPERA]. Ninguna de las siete familias lo leyo. Verifique tres contra el codigo y YA ESTAN CERRADOS (las vistas de cohortes con `security_invoker`, mig 0231; `docs/guia-produccion-mauricio.md` ya commiteada; la purga de turnos del agente, que ahora tiene cron). Otros siguen abiertos y medidos (los subtitulos, el `case 'funnel'` sin caller, el TOAST de `wa_mensajes.raw`). Hecho = una pasada que tache lo cerrado y reparta lo que sigue vivo; un documento con 39 items de los que un tercio ya no corresponde no lo abre nadie.

**Dónde:** `C:/dev/wt-puntas/docs/estado-del-arte.md:165-230 (§Pendientes vivos)`
