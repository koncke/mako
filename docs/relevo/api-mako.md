# Relevo — La API de MaKo y sus tokens

**Área:** `lib/api-mako/**` (el registro de operaciones), `app/api/v1/**` (el transporte HTTP),
`app/api-mako/**` (la tab que la muestra y acuña los tokens).
**Ventana:** 05/10/2026 → 10/10/2026. **Escrito el 10/10/2026 sobre `origin/main` = `9862c146`.**

> **14/10/2026, 03:40 — CERRADO por pedido de Martín** («que se pushee todo y que los chats cierren lo que están
> haciendo. Nada más»). Cuenta 2, chat «API de MaKo».
>
> **✅ ENTRÓ A MAIN el 14/10 (1ac180f2..92a2be21, lo pusheó Estrategia).** Lo de abajo queda como registro.
> **Para PUSHEAR (lo pushea Estrategia con todo junto): rama `estrellas-1410` = `e8d94c07`** (incluye
> el merge de `origin/main` = `74a56363`, con el área calendario al lado de creaciones), worktree `C:/dev/push-estrellas`. Cuatro commits:
> 1. El token detallado deja de valer cuando su creador pierde el acceso (cierra la fila de § 3.2).
> 2-3. Las ESTRELLAS: mig **0273** (YA APLICADA en prod), `lib/creaciones*.ts`, la galería `/creaciones`,
>    BotonEstrella, PublicarCreacion; el id de lo publicado es texto.
> 4. El área `creaciones` registrada (8 ops, REST estilo GitHub, docs y snapshot regenerados), la cosecha
>    (`docs/hallazgos-creaciones.md`, dos reglas en AGENTS.md) y un «Probá» de CURSOS que tenía rojo el guard
>    de voseo en main.
> Tests: los 251 de la API y los guards tocados, en verde. **Sin typecheck completo** (orden de Estrategia por la
> RAM: lo corre el pre-push de quien pushee) **y sin verificar en el navegador** (no hubo RAM para un `next dev`).
> **Cuando entre a main, avisarles a Automations y Graphics** (ponen su botón «Publicar» y el enchufe de
> dashboard). Content Machine espera una decisión de Martín sobre qué es un «formato» (ver
> `docs/hallazgos-creaciones.md`).
>
> **A MEDIAS — NO SE PUSHEA: rama `wip/api-acciones-1410` = `b85971b9`**, worktree `C:/dev/mako-api2` (encima
> de `api-acciones-1310`, que tiene los mismos commits de las estrellas). Lo que falta, área por área:
> - **comunidad** (41 ops) y **plan** (28 ops): implementadas, tests de su área en verde. Faltan: integrar sus
>   filas REST (las trae el journal de la corrida; `integrar-rest-1310.ts` del scratchpad `3e9e0b4f…` las
>   escribe), el título «Exportación» en `recursos.ts`, regenerar docs y snapshot, y la revisión de seguridad
>   (los dos revisores se cortaron). **Comunidad tiene un bloqueante abierto: 11 escrituras «firmadas»
>   (publicar, comentar, likes, votar, seguir, perfil…) no tienen persona con un token detallado** y hoy
>   fallan al proponer. Y `lib/doer-herramientas.ts:117-123` dice que `cambiar_fecha_tarea_plan` no existe:
>   ahora existe sólo por HTTP (revisar el comentario).
> - **crm, curso, video, cs, chatbot, ads, negocio, equipo, landing+contenido, email+whatsapp** y el grupo
>   **metricas/closing/mako/general/experimentos/integraciones**: trabajo a medias de los agentes que cortó el
>   límite de sesión. **curso** incluye `invitar_al_curso`, pedido por Customer Success (sin `cualquierEtapa`: por
>   la API sólo ganados; el diseño está en `areas/curso.json` del scratchpad).
> - **El guard del punto 5** (`scripts/api-cobertura.mjs`, `lib/api-mako/cobertura.ts`,
>   `tests/api-mako-cobertura.test.ts`): inventario de 1273 capacidades, 295 cubiertas por regla de carpeta y 55
>   tabs declaradas. **Faltan clasificar 931** (acciones de servidor y rutas de /api) y declarar lo que no tenga
>   operación: hoy, deuda medida en Offer y Landing Generator; a revisar Instagram en Automations, pagos y Mobile.
>   El test falla a propósito hasta entonces.
>
> **Cómo se retoma:** `Workflow({scriptPath: "C:/Users/marti/.claude/projects/C--Users-marti-OneDrive-Escritorio-dashboard-marketing-main-dashboard-marketing/3e9e0b4f-a156-403b-a930-b0dc660360b4/workflows/scripts/api-mako-acciones-1310-wf_8cb38f84-f1e.js", resumeFromRunId: "wf_8cb38f84-f1e"})`
> con `limite: 2` en los args (los que terminaron vuelven del caché; los prompts de los pendientes ya dicen
> «sin tsc completo» y «retomá lo que quedó en el árbol»). El worktree tiene que estar en `wip/api-acciones-1410`.
> Después: integrar REST, docs, snapshot, suite, typecheck, build, e2e en ws 9, revisión, clasificar el guard (de
> a 2), cosecha y merge. **Ojo con el número de migración:** mirar también los otros worktrees.

**Qué es esto, para quien nunca lo vio.** MaKo es la plataforma de Martín (marketing, CRM,
automatizaciones, cursos). Cada negocio cliente es un **workspace** (`ws`): «ws 9» es el workspace
donde se prueban las cosas de punta a punta, «ws 1» es el de Mauricio Bustos (un cliente, NO el
dueño). La **API de MaKo** es un registro único donde cada cosa que se puede *leer* o *hacer* en la
plataforma se declara UNA vez (`lib/api-mako/areas/<área>.def.ts` = el contrato,
`<área>.run.ts` = el cuerpo), y de esa única declaración salen, sin copiar:

- las *tools* que ve MaKo cuando le hablás por WhatsApp o en la app,
- las rutas HTTP `/api/v1/**` que consume un Claude Code afuera, n8n o Zapier,
- la referencia `docs/api-mako.md` (generada) y la *skill* de Claude que se instala en la máquina
  de cada cliente,
- el catálogo del paso «⚡ Acción» del lienzo de automatizaciones.

**Medido el 10/10 sobre HEAD** (corriendo el registro, no leyendo un doc):
**526 operaciones en 19 áreas** — 323 lecturas, 201 acciones, 2 controles. **398 salen por HTTP**, y
hay exactamente 398 rutas REST estilo GitHub como alias (`lib/api-mako/rest.ts`), que es lo que
exige `tests/api-mako-rest.test.ts`. `PROBLEMAS_DE_CARGA` vino vacío (ningún id repetido).
Tres áreas son de **sólo lectura** por la API: `metricas` (23), `video` (14), `integraciones` (9).

> ⚠️ **Corrección a la memoria:** decía «498 ops». Eran 498 el 08/10; hoy son 526.

---

## 1. En qué quedó: lo hecho y desplegado

Todo esto está en `main` y pusheado a `origin/main`.

| Qué | Commit | Fecha |
|---|---|---|
| La tab `/api-mako`, **tokens varios con nombre**, catálogo liviano (`?compacto=1`, `?area=`, `?operacion=`) | `f2c0a04b` | 08/10 04:21 |
| **Un paso de un flujo corre cualquier acción**, por el mismo choke point (`ejecutarDesdeFlujo`) | `fafe007b`, `63a0f95a` | 08/10 03:51 |
| Meter un lead en UNA secuencia; un lead en varios productos del CRM (5 ops, ninguna por HTTP) | `40d8f052` | 08/10 05:03 |
| **«Copiá GitHub tal cual»**: tokens detallados que ESCRIBEN DIRECTO, permisos por área, vencimiento, 398 rutas REST, convenciones de GitHub, la pantalla con su aspecto | `b51155c9` | 08/10 08:52 |
| Área `curso` (11 ops, sólo HTTP) + la guía «Migrar un curso con Claude» | `c4309144` | 08/10 14:24 |
| `tareas` y el video por `<iframe>` (Panda/Wistia/Bunny) en crear y editar una clase | `3b684747` | 08/10 15:55 |
| **El token clásico deja de guardarse en claro: hash + pista** | `dc25a921`, `0f12fe27` | 09/10 14:37 |
| `cambiar_crons_secuencia`: cambiar qué dispara una automatización, de pantalla y sin HTTP | `e61ad47e` | 09/10 21:47 |
| La tab Chatbot pasa a llamarse **Automations** (`/automations`); el ÁREA sigue siendo `chatbot` | `04f40af4` | 09/10 23:11 |
| `ejecutarDesdeFlujo` corre una vez por etiqueta; `listar_cursos`/`ver_curso` también por el canal `app` | `10b5bded` | 09/10 21:38 |
| Chatwoot fuera: la def y el runner de `ver_activacion_tab` **derivan** la lista de tabs en vez de copiarla | `aa790ddf` | 09/10 |
| «No pude verificar el token» pasa a ser 503, no 401 | `dd58b168` | 07/10 19:38 |

**Las decisiones de Martín del 08/10 (el «copiá GitHub tal cual») están HECHAS las cuatro:**
tokens varios con nombre ✓, permisos por área (`Sin acceso` / `Solo lectura` / `Lectura y escritura`,
`lib/api-mako/permisos.ts`) ✓, vencimiento (7/30/60/90 días, fecha hasta un año, o sin;
`lib/api-mako/tokens-forma.ts`, default 30 días, tope 50 tokens) ✓, URLs REST como alias sin
renombrar las viejas ✓. Verificado leyendo el código hoy, no el commit.

**Topes vigentes** (`lib/api-mako/version.ts`): 120 pedidos/min por workspace, 240/min por IP,
256 KB de cuerpo. Versión de API por fecha: `2026-10-08`.

---

## 2. Lo que nació en la ventana (el 05/10 no existía)

1. **La tab `/api-mako`** entera, con el aspecto de GitHub (`app/api-mako/github.css` tiene los
   valores de Primer). Tres vistas: `docs` (como docs.github.com), `tokens` (como Settings →
   Personal access tokens) y `registro` (como el Security log). La ve **todo admin de workspace**.
   Su onboarding es su estado vacío: sin ningún token, abre en «Tokens».
2. **Los tokens detallados** (`mako_pat_…`): varios por workspace, con permisos por área y
   vencimiento, y que **escriben en el acto** — salvo lo que cuesta plata, que sigue devolviendo un
   link a una pantalla (`lib/api-mako/rutas-http.ts:148`: `directo = detallado && esAccion && costo !== 'dinero'`).
3. **Las 398 rutas REST** (`GET /api/v1/crm/leads`, `PATCH …`): alias por recurso, con verbos de
   GitHub. Las rutas por operación no se tocaron.
4. **El canal de los flujos:** un paso «⚡ Acción» del lienzo corre cualquier acción sin pedir un
   «sí» cada vez (el dueño confirmó al configurar el paso). `lib/api-mako/flujo.ts`.
5. **El área `curso`** y la guía para que un Claude migre un curso entero con un token.
6. **El token clásico por hash.** El de la skill (`agente_token`, prefijo `mkoag_`) se guarda como
   sha256 + una pista no secreta (`mkoag_e_…a1b2`) y se muestra UNA vez.
   `lib/agente-token-nucleo.ts` es nuevo, puro y con test.
7. **`api_llamadas.token_id`** (migración `0222_api_llamadas_token.sql`, aplicada el 08/10): la
   bitácora dice QUÉ TOKEN pidió cada llamada. Con escrituras directas, ésa es la pregunta.
8. **La bitácora del área en `/admin/dev`**: `app/admin/dev/api-mako/bitacora.ts`, con los pedidos
   textuales de Martín y el estado de cada parte (`hecha` / `cola` / `sigue`).

---

## 3. Lo que quedó a medio hacer, y dónde vive

### 3.1 La rama `wip/api-acciones-0910` — lo grande que falta

Vive en el worktree **`C:/dev/mako-api`** (existe, limpio, en `bf5d86f7`). **No está pusheada y no
es ancestro de `main`** (verificado con `git merge-base --is-ancestor`: nada de ella llegó a main).
Dos commits: `987bd737` (las operaciones nuevas por área) y `bf5d86f7` (el JSON del relevamiento +
`scripts/integrar-rest-wip.ts`). **222 archivos, +45.360 / −4.901** contra main.

El pedido que la originó, Martín el 08/10 a la noche, literal:

> «Falta todo lo de las tareas en el apartado de CURSOS… También falta la comunidad… Estoy seguro
> que en el resto de cosas, como CRM, Plan, etc deben faltar acciones posibles. Investiga bien e
> implementalo todo.»

La corrida fue `wf_c0a3860e-135` (20 áreas × relevar → verificar → implementar → revisar) y se cortó
tres veces: límite de uso y dos cierres de sesión.

**Medido hoy, leyendo `docs/api-acciones-relevo.json` (`<área>.verificar.aprobadas`): 343 operaciones
aprobadas para implementar**, repartidas así. Las 8 áreas con la clave `implementar` son las que
alcanzaron a tener código escrito (**83 ops**); las otras 12 sólo llegaron a «verificar».

| Llegó a implementar (83) | | Sólo relevada y verificada (260) | |
|---|---|---|---|
| comunidad (área NUEVA) | 41 | crm | 42 |
| landing | 12 | curso | 42 |
| contenido | 9 | video | 30 |
| email | 8 | plan | 27 |
| whatsapp | 8 | cs | 26 |
| general | 3 | chatbot | 24 |
| experimentos | 1 | ads | 20 |
| integraciones | 1 | negocio | 18 |
| | | equipo | 17 |
| | | closing | 5 |
| | | metricas | 5 |
| | | mako | 4 |

**El área `comunidad` sólo existe en esa rama** (`lib/api-mako/areas/comunidad.{def,helpers,run}.ts`).
Las TABLAS sí están en main: `supabase/migrations/0217_comunidad.sql`. O sea: la comunidad tipo Skool
funciona en el producto y no se puede tocar por la API.

La rama trae además 13 archivos de test nuevos (`tests/api-mako-<área>-acciones.test.ts`) que no
existen en main.

### 3.2 Lo demás que quedó abierto

| Qué | Dónde vive | Estado |
|---|---|---|
| **Un token no se apaga cuando su creador pierde el acceso.** `creadoPor` se guarda y no se vuelve a mirar, y `autenticar()` fija `rol: 'admin'` para TODO token | `lib/api-mako/tokens.ts` (`resolverTokenApi`), `lib/api-mako/http.ts` | `cola` en `app/admin/dev/api-mako/bitacora.ts:30` — verificado hoy: `creadoPor` sólo se escribe y se dibuja, nunca se consulta |
| **`/api/agente/plan` y `/lead` (POST) no miran el alcance**: un token principal acuñado como `lectura` propone igual | `app/api/agente/plan/route.ts`, `app/api/agente/lead/route.ts` | verificado hoy: la palabra «alcance» no aparece en ninguno de los dos |
| **Las 25 tools viejas están declaradas dos veces** y ya divergieron de la def | `lib/mako-tools.ts`, `lib/mako-doer-acciones.ts` | estado `sigue`; antes hay que arreglar la def de `proponer_tareas_plan` |
| **Las descripciones dicen «PROPONE… hasta el sí»**, que con un token detallado es falso (escribe en el acto). La documentación lo aclara; el texto de la def, no | `lib/api-mako/areas/*.def.ts` | abierto |
| **La skill y `plugin/` no enseñan las rutas REST** ni los tokens detallados | `lib/agente-skill.ts`, `plugin/skills/` | abierto |
| **La bitácora de `/admin/dev` está atrasada**: no tiene `dc25a921`, `0f12fe27` ni `e61ad47e` | `app/admin/dev/api-mako/bitacora.ts` | el último hito es del 08/10 15:55 |
| Lo que GitHub tiene y acá no: modo sudo, webhooks salientes, OAuth, paginación con header `Link`, `Time-Zone`, `documentation_url` público, más runners con `yaEstaba` | `docs/hallazgos-api-mako.md` § «La API copiada de GitHub» | lista cerrada el 08/10 |
| La tabla «Lo que quedó sin hacer en el núcleo» (10 filas: idempotencia de propuestas, `reclamada_at`, actor fuera de `resultado`…) | `docs/hallazgos-api-mako.md:621` | abierta |

**SIN VERIFICAR** (no miré la base de datos): el relevo del 08/10 dice que quedaron ~33 filas de
prueba en `api_llamadas` del ws 9 y dos líneas de historial en el lead 2472 del ws 9. Los tokens de
prueba sí se eliminaron.

**SIN MEDIR** (aviso que dejó el chat del CRM el 09/10): el cuello del clasificador del doer que se
arregló para el CRM (`esPedidoSobreLead`) existiría también para ads, chatbot y email — un verbo sin
tilde y sin un objeto conocido cae al default `capturar`.

**No es mío pero está tocado sin commitear en este clon (10/10, otras sesiones):**
`app/crm/CrmBoard.tsx`, `app/crm/CrmToolbar.tsx`, `app/crm/arbol-seleccion.ts` (nuevo),
`lib/campana-atribucion.ts`, `tests/crm-filtro-ads.test.ts`, `docs/relevo/chatbot.md`,
`docs/relevo/customer-success.md`. Déjenlos donde están.

---

## 4. Lo que el briefing anterior decía y YA NO ES CIERTO

El briefing anterior de esta área es de **`0563fc63`, 09/10 13:20**. Lo comprobé entero.

1. **«No se sabe qué compila» (la rama wip).** → **Falso ahora.** Corrí `npx tsc --noEmit` en
   `C:/dev/mako-api` el 10/10: **5 errores, todos en `tests/api-mako-ads-acciones.test.ts`**
   (`d.gating` posiblemente `undefined` ×4 y un `.split` sobre `never`). Todo el resto de los 222
   archivos typechequea. La rama está mucho más sana de lo que decía.
2. **Los avisos de merge estaban equivocados.** Decía que había que cuidar `lib/mako-intencion.ts`
   (por `40d01258`) y descartar el hunk de `package.json`. Medido hoy con
   `git merge-tree --write-tree origin/main wip/api-acciones-0910`: **19 archivos en conflicto, y
   ninguno de esos dos está.** Los reales son
   `lib/api-mako/areas/{chatbot.def,chatbot.run,curso.def,email.run}.ts`, `app/crm/actions.ts`,
   `app/customer-success/curso-ficha-actions.ts`, `app/api/email/secuencias/route.ts`,
   `app/api/chat-agent/secuencias/route.ts`, `lib/{nutricion,nutricion-generator,plan-reprio,pixel-estado,secuencias-variantes,setting-secuencias}.ts`
   y 4 tests — **más un modify/delete**: `app/api/chat-agent/recordatorio-reunion/route.ts`
   **se borró en main** y la rama lo modifica (el recordatorio pasó a ser una automatización,
   `c309b390`).
3. **Los números por área estaban mal en varias filas.** Los reales (del JSON) están en la tabla
   de § 3.1. Diferencias: `integraciones` es **1** y decía 5; `email` **8** y decía 12; `crm` **42**
   y decía 37; `negocio` **18** y decía 22; `closing` **5** y decía 7; `chatbot` **24** y decía 26;
   `metricas` **5** y decía 6; `video` **30** y decía 31; `contenido` **9** y decía 8;
   `general` **3** y decía 4. Y la columna «ya en la API» del briefing viejo no coincide con el
   registro de hoy (decía `cs` 8 y son **4**; `crm` 56 y son **68**; `ads` 27 y son **60**).
4. **El briefing viejo no sabía nada de lo del 09/10 a la tarde y noche**, porque se escribió a las
   13:20: el token clásico por hash (`dc25a921`, 14:37, y su revisión `0f12fe27`, 15:04),
   `cambiar_crons_secuencia` (`e61ad47e`, 21:47) y el renombre a Automations (`04f40af4`, 23:11).
5. **⚠️ El mensaje de `dc25a921` dice «NO se corrió con --aplicar». Eso ya no es cierto y es la
   trampa más caliente del área.** La conversión **se aplicó en producción el 09/10 a las 16:07
   (−03)**: 3 settings (ws 1, ws 9, ws 11) y 5 filas en claro borradas del índice; releído, 0 en
   claro y 3 por hash. La prueba está en `docs/hallazgos-seguridad.md` § «Las cohortes y el token
   de la API, cerrados», escrito por `1e45cebf` (09/10 16:29). **Consecuencia: no se vuelve a un
   deploy anterior a `dc25a921`** — el código viejo no sabe leer el hash y las tres skills
   instaladas dejan de autenticar sin un error que lo explique.

---

## 5. Las trampas del área (esto es lo que ahorra horas)

1. **El área se llama `chatbot`; la tab se llama Automations.** Desde `04f40af4` la tab es
   `/automations`, pero la CLAVE del área (del registro, de las operaciones, de los permisos de los
   tokens) sigue siendo `chatbot`. Está escrito en `lib/api-mako/tipos.ts` (`AREA_INFO`). No
   renombrar.
2. **Los ids de las operaciones son CONTRATO.** Los usa el doer de WhatsApp, la skill instalada en
   la máquina de cada cliente y las pendientes ya guardadas en la base con su `tipo`. Renombrar uno
   rompe las tres: se agrega un `alias` y se deja el nombre.
3. **`canales` es una lista en POSITIVO.** Declarar `tipo: 'lectura'` no es decidir que salga por
   HTTP a un token que vive en la máquina de un tercero. `tests/api-mako-http.snapshot.txt` (398
   líneas) es la lista de lo que sale; **exponer algo nuevo es regenerar ese snapshot, o sea
   decidirlo**.
4. **Los permisos por área van en `gatingOk`, no en la ruta.** Ése fue el diagnóstico obvio y
   equivocado del 08/10: `gatingOk` corre también **al CONFIRMAR**, y filtrando en la ruta un token
   con escritura sólo en «mako» confirmaba pendientes de cualquier área.
5. **Un token detallado NO vale en `/api/agente/*`, a propósito.** `/api/agente/skill` arma el
   archivo de la skill con el token principal: aceptar ahí un token «Solo leer» entregaba el
   principal, que propone. `tests/api-mako-tokens.test.ts` lo fija leyendo el fuente.
6. **Ningún `'use client'` puede importar un VALOR del registro ni de una def** (~400 descripciones
   al bundle de cada cliente). Y **una `.def.ts` no puede importar valores de un módulo
   `server-only`**: el generador de docs corre con `node --import tsx` sin `--conditions
   react-server` y revienta en el pre-push. `tests/api-mako-registro.test.ts` cuida las dos cosas.
7. **`docs/api-mako.md` es GENERADO**: `node --import tsx scripts/generar-api-doc.mjs`. Si cambiás
   una descripción y no lo regenerás, el pre-push frena el push de cualquiera que integre.
8. **Si una ruta de `/api/v1` no está en `PUBLICOS`** (`lib/rutas-publicas.ts`), el middleware la
   corta con «no autenticado» antes de que nadie mire el bearer — y en local no se nota.
9. **Un id repetido NO lanza al cargar**: se anota en `PROBLEMAS_DE_CARGA`, la operación coja
   contesta su error cuando la piden, y lo que frena el push es el test. Una guarda que se porta
   distinto en local y en producción ya costó meses una vez (`gateConfigurado`).
10. **`User-Agent` es obligatorio** (como GitHub): sin él, 403. Y un `X-MaKo-Api-Version` que no
    existe es 400.
11. **El validador tiraba toda lista vacía**, así que `tareas: []` contestaba «no pasaste nada» y la
    tarea no se podía sacar. Para eso existe `vaciaEsValor` en `lib/api-mako/validar.ts`.
12. **`aplicarEnElActo` tiraba `datos`**: una escritura que crea algo no devolvía su id. Ya viaja
    hasta la respuesta, pero si agregás un camino de escritura nuevo, acordate.
13. **La tab crea una clase AL PRINCIPIO del módulo y la API al final**, a propósito: por la API,
    que crea en orden, quedaban al revés.
14. **«Ya está así» no es un fallo.** Un runner que devuelve `yaEstaba` cuenta como éxito para un
    flujo; si no, «cuando agenda, movelo» alarmaba al dueño en cada reagenda.
15. **La bitácora se escribe en TODAS las salidas**, no sólo en la feliz: un token válido que tantea
    404, 405 y 400 es justo lo que contesta «¿me filtraron el token?».
16. **No se puede reanudar una corrida de agentes desde otra sesión** (el caché es de la misma
    sesión): hay que lanzar una nueva con las listas del JSON. *Sin verificar — lo dejó escrito el
    chat que se cortó el 09/10.*

---

## 6. Qué espera una decisión de Martín

1. **Qué se hace con `wip/api-acciones-0910` (343 operaciones).** Es la decisión grande.
   - **(a) Retomarla entera**: corrida nueva por área con las listas de
     `docs/api-acciones-relevo.json`, diciéndole a cada implementador que hay trabajo a medias
     (`git diff 938c17b0 -- <sus archivos>`), y después el revisor de seguridad de las 20 áreas.
     Antes: arreglar los 5 errores de `tests/api-mako-ads-acciones.test.ts` y resolver los 19
     conflictos con main.
   - **(b) Traer sólo lo que ya tiene código** (las 8 áreas con `implementar`: 83 ops, `comunidad`
     entre ellas) y volver a relevar el resto más adelante.
   - **(c) Descartar la rama** y relevar de nuevo sobre main, que ya avanzó 670 commits.
   Mi recomendación: **(b)**, y dentro de (b) primero `comunidad` — es un área entera que el
   producto ya tiene y la API no.
2. **Comunidad: con qué AUTOR publica la API.** El implementador eligió «la persona que confirma, o
   la que creó el token; sin persona, no se publica» (está en la cabecera de `comunidad.def.ts`, en
   la rama). Confirmar o cambiar.
3. **El token que sobrevive a su creador.** Opciones: (a) `resolverTokenApi` revisa el rol actual de
   `creadoPor` con caché; (b) al sacar a alguien del workspace se revocan sus tokens; (c) se deja
   así. GitHub hace (a)+(b).
4. **El alcance en `/api/agente/plan` y `/lead` (POST).** Hoy un token principal acuñado como
   `lectura` propone igual. La decisión D del 08/10 fue «`/api/agente` se mantiene tal cual»:
   ¿se revisa, o queda?
5. **Las descripciones que dicen «PROPONE… hasta el sí».** Con un token detallado es falso. Opciones:
   (a) dos textos por operación (uno para el doer, otro para HTTP); (b) dejar que lo aclare sólo la
   documentación, como hoy.
6. **`documentation_url` apunta a `/api-mako?tab=docs…`, que pide login.** Un integrador de un
   cliente sin cuenta en MaKo no la abre. ¿Se publican docs públicas?
7. **Publicar `plugin/` en el repo público** (hoy tiene `README.md` y `skills/`).
8. **Borrar las ~33 filas de prueba en `api_llamadas` del ws 9** y las dos líneas de historial del
   lead 2472 del ws 9. *Sin verificar si siguen ahí.*

---

### Para seguir, en orden

1. `docs/hallazgos-api-mako.md` — las trampas con su síntoma y su causa, incluidas las tres veces
   que el diagnóstico obvio era el equivocado.
2. `docs/api-mako-diseno.md` § 10 — las cinco decisiones de Martín del 08/10, con su porqué.
3. `app/admin/dev/api-mako/bitacora.ts` — el registro de construcción, con los pedidos textuales.
   Su cabecera dice la cosa que más vale leer de todo el área: *la API se construyó entera en dos
   días de septiembre y el 08/10 Martín la volvió a pedir sin recordar que existía. Lo que faltaba
   nunca fue la API: era que se VIERA y que la usaran el doer y los flujos.*
4. `docs/api-mako.md` — la referencia generada (10.564 líneas). No se edita a mano.
