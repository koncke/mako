# Relevo — Cerebro (el chat orquestador; antes «Estrategia 3 cuentas»)

<sub>Escrito por el Cerebro de la cuenta 3 el 16/10/2026 ~01:15 hora AR, con la ventana de 5 h al 97%.
Material de primera mano. Lo de antes del 15/10 está en `docs/relevo/estrategia-3-cuentas.md`.</sub>

## ⏩ Relevo del 21/10 noche (cuenta claude4 al 97 %) — LEER PRIMERO

**Estado:** `integracion` = `main` en producción hasta el run 217. En `C:/dev/wt-push-q` puede quedar un merge local sin
subir: mirar `git log origin/integracion..HEAD`. El resumen para Martín (qué salió hoy y qué le toca) está en
`resumen-cerebro-21-10.md`, en la carpeta del proyecto en OneDrive.

**Herramientas** (el scratchpad muere con la sesión; están copiadas en `C:/dev/cerebro-herramientas/`):
- `sh esperar-deploy.sh <sha completo>`: espera el run de integracion y el deploy de Vercel. Se corre en segundo plano.
- `node nota-revision.cjs <journal.jsonl del workflow> <salida.md> "<título>" <claves,separadas>`: arma la nota de una revisión.
- `node unir-filas.cjs docs/hallazgos.md`: después de `git checkout -m docs/hallazgos.md`, une las filas del índice que chocaron.
- Las notas de revisión van a `C:/Users/marti/AppData/Roaming/Claude/side-session-notes/local_797d5445-2365-464d-ae3d-1d71aa7baa8c/`.

**Cómo se integra hoy:**
1. `git merge --no-edit <sha>`.
2. Tests: `MAKO_TESTS_SIN_ESPERA=1 node scripts/tests-afectados.mjs --base <HEAD de antes> --cortar --concurrencia 2 --tanda 100 --compartir`.
3. Tipos: `node scripts/tsc-acotado.mjs <archivos>`. Si el vigía lo mata (exit 99, 0 bytes), probá con MENOS archivos: los 4 de un área entran donde los 18 no. Si un área ya los chequeó limpio y su punta no comparte archivos con lo que cambió en integracion (`comm` de las dos listas), alcanza.
4. `MAKO_SIN_ANTES_DE_SUBIR=1 git push origin HEAD:refs/heads/integracion`.
5. Esperar el deploy. Avisar «Ya está» a cada chat.
6. Migraciones con `node C:/dev/wt-push-q/scripts/apply-migration.mjs <sql>`, corrido DESDE `dashboard-marketing/` (ahí está el `.env.local`).

**Reglas aprendidas hoy:**
- Lo visual (layout, CSS) entra sin revisión adversarial: Martín lo ve. Plata, privacidad, sesión y herramientas que usan todos, SIEMPRE con revisión.
- Un chat con los tests en verde que sólo espera tipos no hace fila: manda «VERDE sin tipos» con la lista de archivos.
- Si la fila del candado no avanza: `node scripts/antes-de-subir.mjs --cola`. Ver `docs/hallazgos-infra.md` («El candado se retiene mientras se espera RAM»).
- Un bitácora/hito solo no se sube suelto (cuesta un build): va con el próximo lote.

**Migraciones de hoy:** 0317 (Plan, columna propia), 0322 (PC del cliente; **NO volver a correrla nunca**: confirmaría las PC pendientes sin el «sí»), 0323 (pagos `resto_de` y `es_mensualidad`; idempotente, se corrió antes y después del deploy).

**Pendiente de integrar:**
- **Infra**: `e978851f5` (rama infra-ram-sin-candado: el candado no se retiene esperando RAM; arreglo de las 2 medias de `revision-infra-candado-tandas-21-10.md`) y `f8a05c031` (infra-tipos-piso: «Tipos» = tsc entero y las tandas sólo de respaldo con OK PARCIAL). Ambas en VERDE. Hay que verificar los arreglos con una revisión corta e integrar. Al integrar el candado, su entrada en hallazgos-infra va DENTRO de la sección que ya está, sin duplicar.

**En curso, URGENTE (cliente roto): Florencia, ws21.** Onboarding arregla tres cosas:
- En el Ops Center de ella, que Martín ve entrando como super admin al ws21, aparecen las respuestas sin las preguntas. Las preguntas del nombre y del negocio nunca se guardaron.
- El «Nombre del negocio» no es editable en ningún lado y hoy dice «mi marca personal: Florencia Ayelen Carballo».
- El script que repara su funnel, producto y PDF, en seco, se aplica sólo con el «sí» de Martín.
Cuando esté en producción, MaKo Alert le avisa a su grupo.

**Pendiente de Martín:** está en el resumen de OneDrive (2FA, ejecutables 0.3.2, hilo de Google, pedido 9a143455, Florencia ws21, claves del ws1, Leila ws11, lectura de producción para Infra).

## Qué es este chat

Martín tira ideas de todo tipo acá; el Cerebro las reparte al chat JEFE de cada tab (se llama como la tab:
Automations, CRM, Dashboard, Web Generator, Video Editor, Pagos, Onboarding, Infra, Strategy, MaKo Mobile,
Centro de Operaciones), junta las puntas y es el ÚNICO que sube. Decide con criterio; a la Ticketera sólo lo
100% necesario (precio, clientes, seguridad que no se deshace, gasto). Nunca una decisión en el chat.

## Cómo se sube hoy (probado 25 veces el 15-16/10)

1. Worktree de integración: `C:/dev/wt-push-q` (con junction de node_modules). Se suman las puntas con
   `git merge --no-edit <sha>`, nunca rebase. Conflictos de `docs/hallazgos.md`: el script del scratchpad
   `unir_indice.py` (une filas por la base del merge); en `docs/hallazgos-*.md`, quedarse con las dos partes.
2. Antes de subir: `node scripts/tsc-bitacoras.mjs` (0), `node scripts/rutas-windows-en-tests.mjs` (0), SIEMPRE
   `tests/puente-panel-copy.test.ts` (la guarda de voseo barre el repo: un «acá» de cualquier chat tiró los runs 39 y 43)
   y `tests/progreso.test.ts` (un hito sin `sesion` tiró el 36), y los tests
   del área. NO el tsc completo local (la máquina no tiene RAM).
3. `git push origin HEAD:refs/heads/integracion`. GitHub Actions corre tipos + guardas + los 10.800 tests
   (~10 min) y, con verde, avanza `main` por fast-forward; Vercel despliega solo (~2 min).
4. Seguir el run por la API de GitHub (token de `git credential fill`) y el deploy con `npx vercel ls`.
5. Regla de cola: NO cancelar un run en curso por una punta nueva salvo que arregle algo ROTO en producción
   (cada cancelación son 10 min sin que nada llegue; Martín: «No se estan pusheando las cosas...»).
6. Después de cada deploy: avisarle a cada chat que lo suyo está Ready y reportarle a Martín en bullets de producto.

Trampas medidas: un test con una ruta `C:\` como DATO falla en Linux (hay guarda); un hito `prompt` sin `puntos`
tira el typecheck (hay guarda); SendMessage NO cruza carpetas de config (ENOINBOX): la frontera es la carpeta.

## Estado al escribir esto

- `main` = run 24 (`25d18fc30`). Run 25 (`b51d22388`, crédito de Claude + regla PII + título 5 s + guarda de rutas)
  corriendo.
- **PENDIENTE APENAS EL RUN 25 ESTÉ READY:** correr el script de Onboarding que guarda las claves del crédito
  de Claude (cuentas 1 y 2, Max 20x) cifradas en el ws9: `scripts/credito-claude-a-plataforma.mts`, desde el
  worktree de Onboarding, con el `.env.local` del clon (tiene `ANTHROPIC_CREDITO_CUENTA1/2`). Martín lo
  autorizó: «Vinculalas a MaKo». Verificar con la primera llamada real (una fila en anthropic_usage con el motivo).
- **Run 26, ya listo para sumar:** web-anim `25340eb12` (secciones altas invisibles en la publicada: bug de
  producción), dashboard-bloques `b2189353c` (red del Dashboard con el crédito), y este relevo.
- Ticketera esperando a Martín: `cobrar-mako-en-mexico` (freno por +52 listo en `pagos-mexico-guarda` a075e1ae5,
  NO integrar hasta la A) y `garantia-grupal`.
- Martín tiene que abrir el chat «Centro de Operaciones › Review» (el visor de revisión) y avisar.

## Lo que está en curso en cada jefe

- **Centro de Operaciones**: 11 puntos del 16/10 en este orden: (1) pregunta estilo Claude en el chat + (2) botón
  Ticketera + (11) Uso visible; (5) sin accesorios + (10) en qué trabaja + (9) «Nuevo chat»; (4) organización
  (el Cerebro aparte, un pedido sólo en el chat que lo trabajó, sesiones con nombre de carpeta fuera) + (8);
  (3) historial y pendientes JUNTO con (12) el Plan (cada jefe = un proyecto del Plan); después (7) dictado y
  adjuntos y (13) Second Brain (diseño primero). El (6) Review va al sub-chat. Punto B (Runner por terminal)
  en revisión adversarial.
- **Automations**: el AI Step con red de plataforma (PII → sólo crédito) y que escuche las notas de voz;
  después la mudanza de los avisos por familias (61). Mudanza del reporte semanal ya pedida.
- **Onboarding**: el crédito de Claude y la regla PII hechos; sigue la red de la primera semana.
- **Dashboard**: afinar `pii` caja por caja en las Conclusiones.
- **Pagos**: quieto hasta México y la garantía.
- **Video Editor**: tanda 5 (verlo en Chrome) y medir las fuentes: esperan que Martín deje Chrome sin minimizar.
- **Web Generator**: tanda 8 cerrada.
- **CRM**: el armador de la ficha por bloques (b1).
- **Infra**: receta del acotado y guardas, hechas.

## Lo decidido el 15-16/10 que no hay que volver a preguntar

- Opción A (Ticketera `clientes-usan-su-claude`): MaKo dentro del Claude/ChatGPT del cliente + su crédito de Max
  por BYOK; lo que responde en vivo, con API. Mapa: `docs/mapa-ia-24h.md`.
- Datos de los clientes de un cliente (PII) NUNCA a un proveedor gratis que entrena; orden de la red: crédito
  de Claude → key de Gemini con facturación → gratis sólo sin PII. El Plan nunca paga IA.
- Las TRES cuentas de Claude son de Martín (no volver a plantear lo contrario).
- Cancelar el plan: botón «Darme de baja» propio; plazo de reembolso 5 días hábiles.

## Al cortar (16/10 ~01:30 AR)

- Crédito de Claude ACTIVO: el script guardó las dos claves cifradas en el ws9 (releídas iguales). Falta ver la primera fila real en anthropic_usage.
- Run 26 (`4825aa05a`: secciones altas + Dashboard con crédito + este relevo) corriendo al cortar.
- Para el run 27: dashboard-bloques `318f80b0d` (las Conclusiones caja por caja con o sin datos de clientes; reemplaza a b2189353c).
- Martín tiene el resumen de todo lo subido en `que-revisar-16-10.md` (carpeta de la sesión, fuera del repo).

## Al cortar (16/10 ~06:05 AR, ventana de 5 h al 94%)

- main = run 35 (`701efb8e2`). Run 36 (`5148f0012`) corriendo: Editar con MaKo (Dashboard), seguridad de /api/chart-insights, Pagos 42e704a28 + 31d245ed1 (revisión), Automations 360196182 (bugs A, punto 4, aviso D), MaKo Mobile More completo + cortes de rol, crédito del chat de Offer. En wt-push-q, encima: Onboarding 2d029f783 (lecturas estrictas) para el run 37.
- **Retenido a propósito:** el onboarding nuevo de Offer (`af7b9fae1`, C:/dev/wt-onboarding-offer). No sube hasta que Offer lo recorra en el ws3 con `npm run dev` + Playwright (escritorio y 390 px) y mande capturas. El único conflicto con Onboarding es `app/admin/dev/onboarding/bitacora.ts` (dejar las entradas de los dos, por hora).
- **Plan (sin jefe, lo lleva el Cerebro):** workflow `plan-kanban-de-verdad` (wf_323c84eb-4a9) en C:/dev/wt-plan-kanban, rama plan-kanban; SPEC en el scratchpad de la sesión (plan-wf/SPEC.md). Al terminar: integrar su punta (trae migración `estado` en plan_tareas: la tanda 1 la aplica).
- Repartido el 16/10: CRM ficha v2 (T1 en curso, config POR FUNNEL), Pagos (pendientes: marca de origen del pago suelto + índice único de links), Dashboard («Sugerido» hecho; Editar con MaKo hecho), Video Editor (Sugerido en video e imagen, hecho), Web Generator (módulo «entender el pedido»), Automations (B: avisos por detrás → automatizaciones; el de anuncios del ws1 se apagó a mano el 16/10 con OK por criterio), Offer (onboarding nuevo).
- Leandro (ws10) tiene la clave de la cuenta 2 como key propia (script `claude-propio-de-un-negocio.mts`, corrido el 16/10). El crédito de Claude: SÓLO onboarding (`CREDITO_HABILITADO_PARA`: offer, El Archivero, onboarding-extract).

## Al cortar (16/10 ~10:40 AR, uso semanal de la cuenta 3 al 88%)

- main = run 43 (`babf5e2a5`). Run 44 (`7c2fc7488`) corriendo: Second Brain tanda 1 (Centro, a26929c4d) + B2/B3 de Automations (alerta de anuncios como automatización, f3e3302db). La tanda 45 (Plan + pedidos f0e93221b) sube sola con `esperar_y_subir.sh` cuando el 44 dé verde.
- **Después del Ready del 44:** avisar a Automations que corra la mudanza `--eventos=meta_cuenta_frenada,meta_cuenta_recuperada --aplicar`.
- **Después del Ready del 45 (el Plan):** correr las DOS sentencias de reconciliación de la cabecera de `supabase/migrations/0294_plan_kanban_estado.sql`. Las migraciones del Plan se renumeraron a 0300/0301 (ya aplicadas; el número es sólo el nombre del archivo).
- En curso: Centro (Second Brain etapa 2 tanda 2 → etapa 5), CRM (ficha v2: Resumen → T1 verificación → Reuniones/Tracking → tarjeta del kanban → T2; T3 = CS con Pagos), Automations (pedidos sueltos en su chat, campanita y «sin grupo»), Offer («10 horas semanales», selección múltiple, «[Completar:» con mayúscula), Video Editor (tanda 3: acciones que proponen + gancho de pedidos en video e imagen; la tanda 5 POSPUESTA por Martín), Dashboard (gancho de pedidos en «Editar con MaKo»), Web Generator (Groq en la edición con IA, «mi otro producto», «Crear ahora»), Onboarding (posible fuga PII en `chatCheapToolsCascade` + modelo muerto de OpenRouter en `MODELO_DOCS`).
- Antes de cada push: SIEMPRE `tests/puente-panel-copy.test.ts` y `tests/progreso.test.ts` (tiraron los runs 36, 39 y 43).

## Al cortar (16/10 ~11:00 AR, uso semanal de la cuenta 3 al 92%)

- main = run 44 (`7c2fc7488`). Run 45 (`2e88e9737`) corriendo: Plan (con 0300/0301 renumeradas), Video Editor tandas 2-3 (0302 renumerada, APLICADA), «entender el pedido» en Editar con MaKo, la fuga de PII de Onboarding (08892dc41), botones de Web Generator, `export {}` en los hijos de tests. La 46 sube sola (`esperar_y_subir.sh`): pedidos en el chat del Video Editor (6e2634a5a) y Offer tanda 3 (1294fbdfb).
- **Después del Ready del 45:** correr las dos sentencias de reconciliación de `supabase/migrations/0294_plan_kanban_estado.sql` (cabecera).
- Migraciones: 0298, 0299, 0302 aplicadas por el Cerebro; 0300/0301 (Plan) aplicadas por el workflow; **0303 y 0304 reservadas para el chat del Image Editor (Video Editor)**: las aplica el Cerebro cuando llegue la punta.
- Onboarding: cortar la red propia del doer de WhatsApp con datos de clientes (por turno) y borrar las dos filas copiadas de la plataforma en el ws1 (con huellas). Decidido por el Cerebro con la regla PII del 16/10.
- Second Brain: Centro, tanda 2 (barra, /mako → /second-brain, «Antes»). CRM: ficha v2 (Resumen → T1 → Reuniones/Tracking → tarjeta del kanban → T2 → T3).

## CIERRE (16/10 ~11:30 AR, cuenta 3 al 95% semanal: vuelve el 21/10) — LO PRIMERO PARA QUIEN SIGA

**main = run 44 (`7c2fc7488`).** Todo lo demás está en `C:/dev/wt-push-q` (HEAD de este commit) y en `origin/integracion`,
SIN llegar a main, porque el run 45 cae en UN test:

- **`tests/agenda-whatsapp.test.ts` → «movela al viernes» sin decir qué**: «actuar: no trae listar_tareas_plan
  (llegaron 38…)». El presupuesto del turno de WhatsApp (12.000, `lib/doer-herramientas.ts`) deja afuera
  `listar_tareas_plan`. **NO es el Video Editor** (probado: con sus 34 acciones fuera de WhatsApp sigue fallando).
  Sospecha fuerte: el **Plan** (`lib/api-mako/areas/plan.def.ts`: `mover_tarea_plan` y las de «Re-priorizar todo»,
  nuevas, con la raíz «mover» que matchea «mové»). El run 45 no traía el Second Brain 2/3, así que tampoco es eso.
  Arreglo esperado: que `listar_tareas_plan` siga entrando para un «mové eso al viernes» (relevancia o presupuesto),
  corriendo los tests del turno (agenda, crm, automatizaciones, recetas, ficha). NO debilitar el test.
- Ya arreglados en wt-push-q: el log de Fathom que el guard contaba como reasignación (2ca9b19b8), los hijos de tests
  sin `export {}` (tipos), y varios «acá» de la guarda de voseo.

**Lo que espera en wt-push-q para salir apenas el 45 pase** (en orden de importancia):
1. La **fuga de PII** (Onboarding 08892dc41 + cfa840191): keys de la plataforma copiadas en la fila del ws1 contaban
   como del negocio; y el modelo muerto de OpenRouter. **Prioridad.**
2. El **Plan** completo (kanban por estado, Fathom sin fricción, «Re-priorizar todo»). Migraciones 0294, 0300, 0301
   YA aplicadas. **Después del Ready: correr las DOS sentencias de reconciliación de la cabecera de
   `supabase/migrations/0294_plan_kanban_estado.sql`.**
3. Video Editor tandas 2-3 (0299 y 0302 APLICADAS) y pedidos en su chat; Dashboard (pedidos en Editar con MaKo);
   Web Generator (botones, «mi otro producto»); Offer tanda 3; MaKo Mobile (`varias`); Second Brain tandas 2-3
   (36fcaa16e); Automations (nombres de plantillas, 0f5c45223).

**Sin sumar todavía:** Video Editor `c7e0779aa` (chat del Image Editor, tanda 1): sumarlo y **aplicar la 0303**
(`image_editor_chats`) antes o con el deploy. 0304 reservada (propuestas del Image Editor, tanda 2, sin hacer).
Centro: tanda 4 del Second Brain usa la **0305** (le corregí la 0299 que iba a usar).

**Abierto, con dueño y relevo propio:** Onboarding (corte de la red del doer de WhatsApp con datos de clientes, plan en
docs/relevo/onboarding.md; borrar las dos filas copiadas del ws1 espera el «sí» de Martín en ese chat), Automations
(pedidos sueltos en su chat: regresiones anotadas en hallazgos-chatbot; campanita y «sin grupo»), Web Generator
(producto en texto libre), CRM (ficha v2: Resumen → Reuniones/Tracking → tarjeta → CS), Video Editor (Image Editor
tandas 2-3; la tanda 5 del editor de video POSPUESTA por Martín). Todos esos chats están en 92-95% semanal.
- **Centro cerró con la punta `01a3d49e5` (centro-chat: tanda 4 del Second Brain + servidor de las tandas 7-10), SIN sumar.**
  Trae `supabase/migrations/0303_chart_chats_bloques.sql`, que CHOCA con la 0303 del Image Editor (`c7e0779aa`). Al
  sumarla: renombrar la de Centro a **0305** (y sus menciones), aplicarla con `node scripts/apply-migration.mjs`
  (sólo agrega; el código la tolera ausente). Lo que sigue del Second Brain está en docs/relevo/centro-operaciones.md.

## ACTUALIZACIÓN DEL CIERRE (16/10 ~12:05 AR, 96% semanal)

- **Todo lo terminado está en main** (run 46, `3c5803547`): el Plan, la fuga de PII, Video Editor 2-3 + pedidos, el chat del
  Image Editor (tanda 1), Second Brain tandas 1-4 + servidor 7-10, Offer 3, Dashboard, Web Generator, MaKo Mobile.
  El test del turno de WhatsApp lo arregló Video Editor (`mover_tarea_plan` no viaja cuando se mueve a un día).
- Migraciones aplicadas: 0294, 0295, 0296, 0298-0303, 0305. **0304 reservada** (propuestas del Image Editor). La
  reconciliación de la 0294 corrió: 0 filas que corregir.
- **Pendiente, cada uno con su relevo:** Image Editor tandas 2-3 (docs/relevo/video-editor.md, 0304), Second Brain
  pantallas 10/8/7/9 y luego 6/5 y la etapa 5 (docs/relevo/centro-operaciones.md), CRM ficha v2 (Resumen → Reuniones/
  Tracking → tarjeta → CS), Automations (pedidos en su chat con las regresiones anotadas, campanita, «sin grupo»),
  Onboarding (corte del doer de WhatsApp con PII; borrar las 2 filas copiadas del ws1 cuando Martín diga sí),
  Web Generator (producto en texto libre), Video Editor tanda 5 POSPUESTA por Martín.
- **Checklist para Martín (16/10 ~14:50 AR, 97% semanal):** `/admin/runway/checklist` (app/admin/runway/checklist/), lo
  hecho el 15 y 16/10 y lo que queda, con casillas que se guardan en app_settings (`runway.checklist.1610`). Cada ítem
  tiene un id FIJO: el texto se corrige, el id no se toca (perdería la marca). Al cerrar algo de «Lo que queda», se
  agrega su ítem a «Lo que se hizo» con un id nuevo. Ojo: ningún archivo de app/ puede llevar el string `'/onboarding'`
  (tests/onboarding-hub-retirado.test.ts frenó el run 60 por un link «Abrir» de la checklist).
- **Feedback del 16/10 a la tarde (CRM, Onboarding, Second Brain):** guardado textual en **docs/feedback-16-10-crm-onboarding-second-brain.md**, con un puntero
  arriba de los relevos de CRM, Onboarding y Centro. Hecho lo simple del CRM (`9f595cc6f`); el resto, con su archivo,
  en ese documento. Agregado también a la checklist de /admin/runway/checklist («Lo que queda»).
- **Trampa (16/10 noche):** las guardas que recorren el repo (voseo en tests/puente-panel-copy.test.ts, la de
  `/onboarding`, …) leen `git ls-files`: un archivo NUEVO sin `git add` pasa en verde en local. `git add` antes de
  correrlas. Lo de esta noche (feedback del CRM, ~15 commits) está en docs/feedback-16-10-crm-onboarding-second-brain.md.

## CIERRE DE LA NOCHE DEL 16/10 (~19:50 AR, cuenta 3 al 99% semanal: vuelve el 21/10)

- **Hecho y subido** (el feedback del CRM de la tarde, ~20 commits, todos con su test probado rompiéndolo): «Asignar
  campañas», renombrar un CRM, «A revisar» (basurero, «Ignorar todos», «Revisar» abre el «Ver», el engranaje con
  «¿Ignorar siempre?»), la cabecera del lead, borrar la vista de pendientes, «Templates», «Estilo de la hoja», la
  galería que no se abre sola, el «Ver» de la ficha como «A revisar», «Obligatorio» por bloque, «Editar» + «⋯» (AI
  Analyst, Copiar el link, Exportar CSV), la ficha más rápida, «Asignar evento», el botón y el chat de MaKo del CRM a la
  izquierda con el muñeco y la cara del Second Brain, y el Second Brain en modo claro.
- **Lo que falta, con su archivo:** docs/feedback-16-10-crm-onboarding-second-brain.md y, para la nube,
  docs/relevo/nube.md («Por dónde seguir»). Lo grande: las tabs de la ficha como hojas del Dashboard (punto 5), el
  onboarding sin el análisis de Offer, «Skills» en el Second Brain, el PDF y la guía del «⋯», Google Calendar.
- ⚠️ **Nadie lo miró en pantalla**: la PC no tuvo RAM para `next dev` en toda la noche. Lo primero de la próxima
  sesión local es recorrerlo en el ws3 (receta en docs/hallazgos-crm.md).

## CUENTA 4 (17/10, ~00:00-01:30 AR) — el Cerebro sigue en la cuenta 4 (claude4), semanal al 0%, renueva el mar 20/10 16:59

- **Alta de la cuenta 4:** cuentas.tsv, marcador, cartero (carpeta 7d03ccd6 → claude4, fuente «app»), `CUENTAS` de
  /admin/dev y la regex del historial. Los cinco lugares, en hallazgos-operaciones.md («La cuenta 4…»).
- **Jefes abiertos por el Cerebro con start_session** (ya se puede: hallazgos-operaciones), cada uno con su brief:
  - CRM (`local_64949e84…`)
  - Onboarding (`local_0702928b…`)
  - Centro de Operaciones (`local_aac76313…`)
  - Automations (`local_f74a2156…`)
  - Runner (`local_354ef1cd…`, la vuelta de cada 2 min de la app)
  - Video Generator (`local_54b66516…`: el puente a Flow con el MÉTODO de flow-mcp; el repo no tiene licencia, así que no se copia código)
  - Dashboard (`local_ca08f72a…`: los OKR con varios CRM)
- **Sin abrir por RAM** (0,75 GB libres con 8 chats): Pagos, Web Generator, Offer, Video Editor, MaKo Mobile y Plan. Se abren a
  medida que un jefe cierre.
- **Migraciones:** la 0306 es de Dashboard (`funnel_ids` en objectives y kpis; la aplica el Cerebro antes del deploy que la
  lee). La próxima libre es la 0307. La 0304 sigue reservada para el Image Editor.
- **Al Centro, en este orden:**
  1. el panel de Uso ofrece `claude4 -n Runner` y la 4 no tiene función en el $PROFILE;
  2. Martín quiere «un clic + el permiso de la PC», nunca PowerShell;
  3. después, mandar prompts desde el Second Brain (la tanda 5, adelantada).
- **Llamadas del 16/10, REPARTIDAS con el OK de Martín (17/10 ~01:00).** Cada jefe abierto recibió sus tarjetas:
  - Automations: #868 Brigitte primero, después #845, #850, #851, #852, #849, #847, #882, #846, #869, #873, #874 y #875;
  - CRM: #855, #854, #856, #843, #844, #880, #890 y #891;
  - Dashboard: #857, #858, #859, #860, #862, #876 y #886;
  - Centro: #848, #864, #883 y #884;
  - Pagos: #866, #867 y #871.
  La revisión de la extracción está en hallazgos-plan.md.
- **Plan ordenado (17/10 ~01:30):** 35 tarjetas pasaron del proyecto del cliente al de su tab. #878 y #879 fueron a
  «Cliente: Mauricio», #875 a Email, y #877 se cerró (la cuenta ya se compró). Se borró «Cliente: Mauricio Bustos» (P84), un
  duplicado que creó la importación. Las 13 que el extractor dejó afuera son #880-#892.
- **Jefes sin abrir, por RAM, con sus tarjetas esperando:**
  - Plan: #870 y el arreglo del extractor (hallazgos-plan);
  - Video Editor: #853, el editor que se rompe;
  - Web Generator: #861 y #863;
  - Offer: #865, #887 y #888;
  - MaKo Mobile: #872, y las listas de Markdown del hilo del teléfono.
- **Abiertos después:**
  - «MaKo en WhatsApp» (`local_d3ed9496…`): el VIGÍA de los grupos de clientes, cada 15 min, que depura cada falla. Primer caso: ws18 (Pablo Chavez), con Calendar conectado y MaKo diciendo que no puede escribir. Tarjeta #885. No toca lib/doer-herramientas.ts hasta que pase la punta del corte de PII de Onboarding.
  - «Pagos» (`local_d0cd6fc8…`).
- **Ticketera `acceso-repo-mauricio` → A (sólo lectura), 17/10 00:46, SIN APLICAR.** El modo automático frenó el cambio
  de permisos en GitHub y también el `recoger`. Lo hace Martín: GitHub → hola-mako/dashboard-marketing → Settings →
  Collaborators → mauriciobustoseguia y mbustos-digital de Write a Read. Tarjeta #892.
- **wt-push-q:** el alta de la cuenta 4 y la cosecha ya están en main (run 79 verde, deploy Ready). Este relevo sube con la
  próxima punta.

## 17/10 ~01:15 AR — la app se cayó (01:05) y GitHub quedó sin acceso

- **Caída de la app a las 01:05, por RAM:** coincidió con nueve chats trabajando y una tanda de tests del Cerebro. El
  relevo automático retomó los ocho jefes. El Runner conservó su tarea de cada 2 min (44297a23). **Con 9-10 chats NO correr
  tandas de tests en el Cerebro**: que lo cubran los tests que corrió cada jefe y el run de Actions.
- **⚠️ GITHUB SIN ACCESO DESDE LA PC.** El git de la PC (Git Credential Manager, token `gho_`) estaba logueado como
  **mbustos-digital**, uno de los dos usuarios de Mauricio. Tras la decisión de la Ticketera (`acceso-repo-mauricio` → A),
  ese usuario recibe 404, así que fetch y push dan «Repository not found». Todos los pushes de la PC salían con su usuario. Para
  arreglarlo, una de dos:
  - Martín loguea git con SU usuario: `cmdkey /delete:git:https://github.com` y después un `git fetch` en el clon, que abre el login;
  - o, si mbustos-digital es suyo, le devuelve Write.
  Sin esto no sale nada.
- **Esperando en wt-push-q para el primer push:**
  - la punta 1 de Automations (2c64c61aa: «Sin grupo de MaKo» y la campanita; sin migraciones);
  - la punta 1 de Onboarding (24ce402a8: el doer de WhatsApp sin datos de clientes en la red gratis, por turno; sin migraciones);
  - este relevo.
  Al subir, avisarle a «MaKo en WhatsApp» que ya puede tocar lib/doer-herramientas.ts.
- **Migraciones asignadas:**
  - 0306: Dashboard (`funnel_ids` en objectives y kpis);
  - 0307: Pagos (`pagos.baja_at`, #871);
  - 0308: Pagos (las columnas de `cobros` para el cliente de una agencia, #866 y #867).
  La próxima libre es la 0309. Las aplica el Cerebro antes del deploy que las lee.
- **Mensajes que no salieron:** la app frena los mensajes entre chats después de ~10 automáticos hasta que Martín escribe. Quedaron
  sin enviar el OK de la 0307/0308 a Pagos y el aviso de GitHub a todos los jefes menos Automations.
- **Nube / RAM (pedido de Martín: «comprar RAM» como Grok Bot):** `list_start_targets` da nube NO disponible
  («no_readable_git_checkout»: la carpeta del proyecto en la app es la de OneDrive de arriba, no el repo) y ningún SSH
  guardado. Dos caminos:
  - Nube de Claude Code: incluida en el plan. Hace falta abrir el proyecto en la carpeta del repo, crear el entorno en
    claude.ai/code con las variables del .env.local y la GitHub App en la org hola-mako;
  - un servidor propio por SSH: es gasto, así que lo decide Martín.

## 17/10 ~03:20 AR — ESTADO PARA RETOMAR (el contexto del Cerebro llegó al 96%)

- **wt-push-q = 5d18f155d, SIN SUBIR.** Espera a que termine el run 89 (20b129409: «Voy a trabajar en…» en vivo,
  los selectores de 360 px arreglados). Trae: el grafo al tocar Second Brain (9b4ba4eda + 3cd7776d3), las bitácoras
  de CRM (8a70d70a8 y 4e330cbee) y Automations 6122a1e3e (#882, #873, #849). Antes de pushear: `git fetch` +
  `merge-base --is-ancestor origin/integracion HEAD`.
- **APENAS EL RUN 89 ESTÉ EN PRODUCCIÓN:** borrar las marcas de `~/.claude/operaciones/turnos/*.json` (respaldo en
  turnos-respaldo-0325/). Se avanzaron a las 02:54 AR, antes de que existiera el servidor de turnos, y por eso la
  conversación del Ops Center sale vacía. El servidor deduplica por uuid (lib/operaciones-reglas.ts:293).
- **Cartero de la PC: 1.8.1** (instalado). El Runner tiene su paso b del modelo (tarea 3ee7f888).
- **Migraciones:** 0306 (Dashboard), 0307 y 0308 (Pagos) y 0310 (CRM, el pago guarda su funnel) están APLICADAS. La
  **0309 está LIBRE** (Ops Center terminó sin migración). La próxima libre es la 0309 y después la 0311.
- **Chats de la cuenta 4:**
  - CRM `local_64949e84`
  - Onboarding `local_0702928b`
  - Automations `local_f74a2156` (con #847)
  - Pagos `local_d0cd6fc8`
  - Dashboard `local_ca08f72a`
  - MaKo en WhatsApp `local_d3ed9496` (el vigía)
  - Video Generator `local_54b66516`
  - Runner `local_354ef1cd`
  - **Ops Center nuevo** `local_49626440` (adjuntos → Review con los «Ya está» → el Runner y la nube en la lista → el clic)
  - Ops Center viejo `local_aac76313` (cerrado, al 85%)
  - **Infra** `local_1baeb7d9`: scripts/tests-afectados.mjs, para que no fallen más los pushes
  - Web Generator, EN LA NUBE (task_fc296a8e): deja su rama `web-generator-nube`, que hay que ir a buscar.
- **Reglas de Martín de esta noche** (todas en AGENTS.md y en la memoria):
  - el «Ya está» y «Voy a trabajar en…» los dice cada chat en el Ops Center;
  - TODO lo de un área lo dice su chat, no el Cerebro;
  - el modelo justo para cada trabajo.
- **Ticketera:**
  - `envio-whatsapp-al-activar` → B, aplicado;
  - `acceso-repo-mauricio` → A, SIN APLICAR: Mauricio sigue con escritura en GitHub y lo cambia Martín. El git de la PC ya entra como hola-mako.

## 17/10 ~09:00 AR (12:00 UTC) — ESTADO PARA RETOMAR

- **Producción hasta el run 97:** el arreglo de /general (el ejemplo de la Meta sin `funnelIds`).
  - El 98, el 99 y el 100 cayeron por barredoras (link-con-workspace, onboarding-hub-retirado, undecima-email-propio) y por Tipos (centro-preguntas-chat). Arreglados.
  - **El run 101 (f2bdab6b4) lleva TODO lo pendiente:**
    - el «Quitar» de pagos (#891) y el Video Editor sin GPU (#853);
    - CRM (#854 y #893);
    - Onboarding A, B y C (la guardia contra el abuso);
    - Ops Center 3 (A, B, el urgente parte 2 y el renombre);
    - la Ticketera, punta 1 (la mig 0311 ya aplicada);
    - Infra (el verde más barato) y los títulos de AI Avatar;
    - el cartero **1.14.2 con `medir`**.
- **Apenas el 101 esté en producción:**
  1. instalar el cartero desde wt-push-q (`node scripts/operaciones/cartero.mjs instalar`);
  2. pasarle al Runner (local_354ef1cd…) el paso **0b**: get_usage → `cartero.mjs medir <5h%> <reset> <sem%> <reset>`;
  3. medir el timing del run para Infra;
  4. avisar el «Ya está» a Ticketera, Pagos, AI Avatar, CRM, Onboarding y Ops Center 3.
- **En cola, sin integrar:**
  - Second Brain b6b5c02dd (espera su VERDE);
  - Sidebar, punta 1 (espera su VERDE) y punta 2 con la mig **0312** (es suya);
  - Clients;
  - Offer y Plan (abiertos 17/10).
  - La próxima migración libre es la **0313**.
- **Reglas nuevas de Martín (en la memoria):**
  - no preguntar nada;
  - priorizar solo: cliente roto > plata/riesgo > lo que lo traba > features;
  - el corte al 97% (hook ~/.claude/guardia/corte-97.mjs);
  - la Ticketera es sólo de usuarios.
- **Con la RAM al límite (16 chats):** en local, guardas + los tests de lo cambiado + frontera; lo pesado lo corre Actions, que falla rápido (~2 min).
- **Auditoría de las 54 tarjetas de las llamadas:** 12 cerradas en el Plan; las demás repartidas a sus chats (C:/dev/auditoria-1610.json).
- **Runner:** si MaKo no recibe vueltas (operaciones_carteros.visto_at quieto), stop_session al Runner y mandarle de nuevo sus pasos. `vigilar` a veces hace 0 consultas: bug pasado al Ops Center 3.

## 17/10 ~09:30 AR (12:30 UTC) — ESTADO PARA RETOMAR (contexto del Cerebro al 84%)

- **Producción: run 102.** Lleva Pagos #891, Video Editor #853, CRM #854/#893, Onboarding A-D, Ops Center 3 (A, B, en
  qué está cada mensaje, renombre), la Ticketera punta 1, el workflow más barato de Infra (12 min el verde) y AI Avatar.
- **Run 103 (57e27c4bc), corriendo:** MaKo en WhatsApp «reprogramar» (cliente roto) y Dashboard (#876, #872, #857,
  #858 y Experiments).
- **En wt-push-q sin subir (va después del 103):**
  - Second Brain 233b57297 (#848/#864/#884 y el grafo 11-13);
  - Clients b63e5ddcf (Clients + MaKo Partners; los choques del índice ya resueltos);
  - el cartero **1.14.3** (`medir` con la cuenta activa), YA instalado en la PC.
  - Su chequeo liviano corre en segundo plano (C:/dev/guardas12.txt).
- **Puntas que esperan su VERDE:**
  - Sidebar → tomar `sidebar-email` (puntas 1 y 2 juntas, mig 0312, que es suya);
  - Automations `undecima`;
  - Offer c17ee4835;
  - Plan;
  - Ops Center 3: C/D/E/F/G, la lista, el teléfono y el bug de vigilar.
  - La próxima migración libre es la **0313**.
- **Runner:** tarea 3169963f con `medir` (0b) y `vigilar`. Con la 1.14.3 anota claude4. Si se traba: stop_session y
  mandarle sus pasos de nuevo.
- **Cada vez que algo llega a producción:** avisar al jefe para que escriba su «Ya está» en su chat. Los cierres del Plan
  los confirma Martín de a uno (propuesta en /plan/revisar), salvo los que yo cerré con evidencia de la auditoría.
- **Trampa de hoy:** en Git Bash, `--revisar "/ruta"` se convierte en ruta de disco → `MSYS_NO_PATHCONV=1` (se lo pasé
  al Ops Center 3).

## 17/10 ~10:30 AR (13:30 UTC) — ESTADO PARA RETOMAR (contexto del Cerebro al ~91%)

- **Producción: run 103.** Lleva MaKo «reprogramar» y Dashboard (#876, #872, #857, #858 y Experiments).
- **Run 104 rojo:** CRM #880 rompió tests/m-ficha-bloques. Lo saqué con un REVERT (c3f0d449e revertido); CRM lo vuelve a mandar con el test del teléfono ajustado.
- **Run 105 rojo:** lib/vista-de-otro.ts (Onboarding E) enlazaba /customer-success. Ahora va a /partners, y clients-rutas quedó al día.
- **Run 106 (f99e1e375), corriendo:**
  - Second Brain 233b57297;
  - Clients 3eaaabf96;
  - Ops Center 3 C/D/F + links (cd233436f, `maxDuration = 300` en la ruta del cartero);
  - MaKo en WhatsApp f00d84362 (ticket desde el grupo);
  - Onboarding E (#881 y #850), la barra de lote del CRM, y las bitácoras de Pagos y CRM.
- **Cartero instalado: 1.14.3** (`medir` con la cuenta activa). El Runner mide cada vuelta (tarea 3169963f).
- **Ops Center 3 CERRÓ al 80%.** Hay que abrir un **Ops Center 4** con docs/relevo/centro-operaciones.md. Pendientes:
  - E (los pasos en vivo) y G (nombre y email de las cuentas), con los borradores en side-session-notes;
  - la lista sin «Sin asignar»;
  - el diseño del teléfono (el Uso arriba);
  - el bug de `vigilar` con 0 consultas;
  - el cierre con MSYS_NO_PATHCONV;
  - el Plan a pedido desde el chat, que pide revisión de seguridad.
  - Sólo puedo abrirlo en un turno que empiece con un mensaje de Martín; las tarjetas no le gustan.
- **Esperan:**
  - Sidebar `sidebar-email` (VERDE, mig 0312; después de Clients en main);
  - CRM #880 rehecho;
  - Ticketera punta 2 (cartero 1.15.0 sobre 1.14.3, el bug automático; pedir revisión del cartero) y los errores de toda la app;
  - MaKo en WhatsApp: `avisar_arreglo_al_grupo` y el aviso a Joan;
  - Automations `undecima`, Offer, Plan, Infra `--rapido`.
- **Cuando el 106 esté en producción:** avisar el «Ya está» a Second Brain, Clients, Ops Center (que cerró: lo dice el 4), MaKo en WhatsApp y Onboarding (E). Después, avisarle a Sidebar que mergee Clients y a CRM que enchufe LlevarAPartners.
- **Herramientas del Cerebro** (scratchpad de la sesión):
  - unir-filas.cjs resuelve el índice docs/hallazgos.md fila por fila;
  - afectados.cjs;
  - el chequeo liviano es guardas + los tests cambiados + frontera, link-con-workspace y puente-panel-copy.

- **13:45 UTC, en wt-push-q para la tanda que sigue al 106:** #880 reaplicada (revert del revert + 33c94ee2d con el test del teléfono), Automations ab756dca0 (VERDE), Ops Center 3 857b80c98 (merge + relevo), Onboarding ea513a3aa (docs) y Offer c17ee4835 (VERDE: #888 #865 #887 #895; el choque de imports de Conclusion.tsx quedó con los dos lados). Chequeo liviano + push apenas termine el 106.

- **14:30 UTC:** el run 107 cayó en Tipos (app/onboarding/arranque-ui.ts sin `guardadaEn`, que Offer #895 hizo obligatorio). Arreglado en 0d2ebd214, que ya está subido y lleva TODO: Offer, Automations, #880, Dashboard, Plan, MaKo en WhatsApp (aviso de arreglo y ticket desde el grupo) e Infra `--rapido`. Esperan: Sidebar `sidebar-email` (mig 0312) y Ticketera punta 2. El aviso a Joan lo tiene que aprobar Martín en el chat de MaKo en WhatsApp, porque el clasificador lo frenó. Falta abrir el Ops Center 4.
- **14:40 UTC:** Ticketera puntas 2 y 3 (0949d7792) integradas en wt-push-q: el cartero 1.15.0 lleva el bug automático al Cerebro y los errores de toda la app van a tickets (mig 0313 aplicada). Al llegar a producción: REINSTALAR el cartero 1.15.0 (`node scripts/operaciones/cartero.mjs instalar` desde wt-push-q) y avisarle a la Ticketera su «Ya está». Sube en la tanda que sigue al run 109.

## 17/10 ~11:45 AR (14:45 UTC) — ESTADO PARA RETOMAR

- **Producción: 1bae61a77 (run 110 verde, deploy Ready).** El run 109 cayó en Tipos con el test de Infra (`compartibles`); lo arregló 72285d901, que ya iba en esta tanda. Trae Offer, Automations, CRM #880, Dashboard 74a7576a4, Plan, MaKo en WhatsApp (18c9b1eb7 y edb8ffd38), Second Brain, Clients, Onboarding D/E, Infra `--rapido` y Ticketera 2-3. **El cartero 1.15.0 ya está REINSTALADO.**
- **«Ya está» avisados:** Offer, Automations, CRM, Dashboard, Plan, MaKo en WhatsApp, Second Brain, Clients, Onboarding y Ticketera.
  - **Infra NO lo recibió** (tope de 10 mensajes; ver hallazgos-operaciones «Los dos topes»). Hay que mandárselo después del próximo mensaje de Martín.
- **Run 111 (f3d6f0612), corriendo:**
  - Dashboard 5933718c1: red por bloque, #886 y #896;
  - Sidebar 51cbc9df8: la barra nueva, el email en Chats, el tema por persona y la mig 0312 aplicada.
  - Al llegar a producción, avisar el «Ya está» a Sidebar y a Dashboard.
- **En wt-push-q para la tanda que sigue:** MaKo en WhatsApp 8d90f8357 («agendarle» en el ws18; el aviso al grupo de Pablo va recién con eso en producción) y estos hallazgos.
- **MaKo Mobile end to end (pedido 103d1f01 del Ops Center):** corre como Agent en segundo plano, en C:/dev/wt-mobile, rama mobile-e2e-1710. No se le pudo abrir chat porque el turno era automático.
  - Entrega puntas «VERDE <sha>» al Cerebro.
  - El cierre del cartero con 103d1f01 lo corre el Cerebro cuando lo último esté en producción.
  - Ya sabe que la sidebar nueva cambia el teléfono.
- **Sin encontrar:** `dashboard-cierres-run103.json`, que Dashboard dice haber dejado en la «carpeta de notas del Cerebro». No está ni en el scratchpad ni en ~/.claude ni en C:/dev. Hay que pedírselo de nuevo.
- **El pedido «Sí mándalo siempre, sin aprobación» a MaKo en WhatsApp quedó retenido** (otro modo de permisos). Martín lo tiene que aprobar en ese chat o escribirlo en el del Cerebro.
- **15:10 UTC:** el run 111 está en producción (f3d6f0612 Ready): Dashboard 5933718c1 y Sidebar 51cbc9df8.
  - **Sin avisar por el tope de 10:** Sidebar, Dashboard e Infra. Mandarles el «Ya está» después del próximo mensaje de Martín.
  - Subido 02ffcf29f: MaKo en WhatsApp 8d90f8357 y 118148d1e (la falla se registra sola como ticket), la bitácora de Clients y este relevo.
  - Esperan: Ticketera punta 4 (6fa9e6431, avisarArregloAlGrupo), la bitácora de Automations (bf44b3cf1), la de Dashboard (b88893a00) y los dos arreglos de «Marcar hecha» del Plan (explicación de más de 400 caracteres; «Ya no estaba abierta» falso con otro proyecto).
- **15:40 UTC:** el run 112 (02ffcf29f) está en producción. Subido 23da7a136:
  - Automations (bitácora), CRM «Llevar a MaKo Partners» (119a48574), Onboarding F (3a47301ed), Plan (12c0f6066: los dos arreglos de «Marcar hecha»);
  - Infra 5e9570953, más mi arreglo de tipos e3ec09bf4;
  - Ticketera punta 4 (d43ff381b: aviso al grupo sólo con la prueba del deploy, revisado).
  - **MaKo Mobile 86ba6dae6 quedó AFUERA:** rompe tests/chats-datos.test.ts:514 (la línea de WhatsApp con un 4º argumento) y tests/chats-verificacion.test.ts:96 (el lead abre /m/chats/lead:7 en vez de /m/crm/7/chat). Ya se lo devolví al agente.
- **En wt-push-q para la tanda que sigue:** Infra 4d10a74a1 (las dos fases con `--compartir`, tandas de 100; reemplaza al 5e9570953).
- **DECIDIDO, falta avisarle a Infra** (tope de 10): SÍ al `npm test` completo y aislado UNA vez por semana, con un workflow programado de ~11 min. Cuesta ~45 min al mes y caza un falso verde por contagio ahora que Actions comparte proceso.
- **16:15 UTC:** el run 113 (23da7a136) y el 114 (c3e6c2e4a) dieron verde. El 114 trae Infra 4d10a74a1 y MaKo Mobile c1f930979 + 9cb1f7c69. Subo d89fb57fd (el botón WhatsApp de la ficha del teléfono va a Chats).
  - **MaKo Mobile TERMINÓ** (agente). Lo pendiente está en docs/relevo/mako-mobile.md. Con d89fb57fd en producción: correr el cierre 103d1f01 del cartero.
  - **Para Infra (tope de 10), los tiempos del run 113** (la fase 1 con `--compartir=barredoras`, la 2 con `--compartir`):
    - afectados 202 s (antes 279): 298 aislados en 8 tandas + 146 barredoras en 2 grupos de 37 y 34 s;
    - tipos 155 s;
    - los demás 68 s (antes 182): 692 compartidos en 2 grupos de 38 y 22 s + 49 aislados;
    - total del job ≈ 485 s (antes ≈ 676 s); 0 flaky.
- **17:00 UTC:** en producción el run 115 (68cc6d74a, MaKo Mobile entero, el pedido 103d1f01 CERRADO en el Centro con --revisar /chats) y el 116 (f0ab59099).
  - El 116 trae el lote 3 de Automations: e0f1f3b5b, más de26fe351 con el formulario de Meta (#279 pausada).
  - La revisión adversarial del motor de avisos encontró UN defecto real: `--pausar` sin `--eventos=` pausaba #260 y la cuenta recuperada. Lo arreglé en 71891c5cb y está en hallazgos-comunicacion.
  - Automations pausó #270, #272 y #275-#278 en producción: desde el run 110, los dos primeros les llegaban a todos los negocios.
- **«Ya está» SIN mandar (tope de 10), para el próximo mensaje de Martín:**
  - Sidebar y Dashboard (run 111);
  - CRM Partners, Onboarding F (cierra #850), Plan (los dos arreglos de «Marcar hecha»), Ticketera 4 y Automations (bitácora + lote 3) (runs 113/116);
  - Infra (4d10a74a1 y los tiempos del 113, más arriba; SÍ al `npm test` semanal).
- **17:20 UTC:** sube Automations 034ae2e34, la familia «reuniones» del lote 3. El recordatorio de reunión ya no cae a la configuración de antes: estaba apagada en ws1 y ws11, así que no cambia lo que sale. El de 24 h del ws1 sale por la secuencia 212/213.
  - **DECIDIDO, falta decírselo a Automations y al Plan** (tope de 10): `reunion-tareas-al-plan` (lib/reunion-auto.ts) lo toma el chat **Plan**, que es el dueño del archivo, para que no haya dos escribiendo ahí.
  - `lead-no-confirmo` (la tarjeta «avisar al equipo» visible en la automatización «preparar») lo sigue Automations.

## 17/10 ~15:00 AR (18:00 UTC) — ESTADO PARA RETOMAR (Cerebro)

- **Producción: hasta el run 119** (86bc162be): More con todas las tabs, el guardián, Reportar problema en el teléfono, el rediseño de CRM y Plan del teléfono, y docs/pendientes.md.
- **Lista de pendientes:** https://claude.ai/artifact/S7AyYhfn2CF652wGN953i4 (296 puntos). La copia del repo es docs/pendientes.md, y la actualiza SÓLO el Cerebro, con las listas de los agentes.
- **Pedido ab083ae3** (Mobile en todas las tabs + rediseño + la lista de pendientes): la lista está hecha y Mobile 3 terminó. Siguen Mobile 1 (creación, C:/dev/wt-mobile) y Mobile 2 (negocio y More, C:/dev/wt-general-epico). El cierre va con lo último en producción.
- **Pedido 41f3572c** (14:44): agentes lanzados, todos con worktree propio y node_modules por junction:
  - Ops Center 4, en C:/dev/wt-ops4: Responder deslizando y el menú de WhatsApp, Chats+Cerebro+Nuevo chat juntos, el «atrás» lento, el Uso arriba y los pendientes del Centro;
  - Limpieza de disco (Sonnet): estaba al 100%; el Cerebro ya liberó 5 GB;
  - Pendientes B1 (seguridad y datos), B2 (CRM y clientes), B3 (Web y Offer), B4 (Ads y plata) y B5 (Plan, Dashboard y MaKo), en C:/dev/wt-pend-b1 a b5. Sus listas están en scratchpad/pend/B*.json.
- **Sin agente todavía:**
  - AUT.json (25 de Automations): el chat Automations está en «nada por detrás»; mandárselo cuando se pueda escribirle;
  - B6.json (18 de editores y super admin): va después de Mobile 1.
- **Candado de lo pesado:** C:/dev/pesado.lock (tsc, build, Chrome, más de 30 tests). Los Mobile usan además C:/dev/mobile-build.lock.
- **Revisión adversarial:** toda punta «⚠️ REVISAR» (plata, seguridad, envíos) pasa por un workflow de revisión antes de subir.
- **20:45 UTC — corte de consumo.** La SEMANAL de la cuenta 4 llegó a 71% (17 puntos en 1,5 h, por 7 agentes y 4 revisiones). Cada agente entrega lo urgente y cierra. Features y pulido van a los relevos «para después del 20/10». B6 no se lanzó. Los refutadores del guion de revisión pasaron a Sonnet.
  - En producción (run 124): el Ops Center en el teléfono (los 4 puntos de las 14:44), con el cartero 1.15.5 INSTALADO. Cerrados en el Centro: 6cb02e4a y b32ebe58. Contestados: a6256280 (regla «en producción sólo lo desplegado», en la memoria) y 864f2de1 (borrar archivos de Martín y la hibernación: NO, es una regla dura; le pasé los pasos).
  - Subido a8bbf0015 (run 125):
    - B1 9e3f1460c (seguridad; la revisión no encontró roturas para clientes);
    - Ops4 af531f4ea (Plan desde el chat de sólo lectura, cartero 1.15.7 SIN instalar hasta producción);
    - B3 42e586a8f (la migración 0316 SIN aplicar; el código anda sin ella).
  - **Después del deploy:**
    - instalar el cartero 1.15.7;
    - crear la fila del mail «Tu contraseña cambió» desde su plantilla en el ws9 (B1);
    - al Runner le falta el paso 2d (`otraVez`) de lib/runner.ts. No es urgente: sin él, lo nuevo espera el cron de 2 min.
  - **Rechazados por la revisión, devueltos:**
    - B5 1fced50fe: 9 defectos; el más grave, el historial del grupo a la IA gratis;
    - B4 65e299c2e: 9 defectos; las cuotas destildadas en el ws1 quedan impagas, el cron de pausa pausa a quien paga y la capa pm ve «No está en tu plan». Se le pidió una punta sin esas tres piezas.
  - B1 sigue con 4 agujeros viejos de datos a la IA gratis (el texto del turno, el glosario en el system, wsDeGrupoJid→ws1, anthropic-usage→ws1). B2 está terminando su VERDE.
- **21:20 UTC:**
  - **En producción:** el run 125 (a8bbf0015: B1 seguridad, Plan desde el chat de sólo lectura, B3; el cartero 1.15.7 instalado) y el run 126 (b1ff19e86: B4 lo seguro, B2 CRM y clientes, B1 tanda 2).
  - **Integrado:** B5 ab627b464. Su segunda revisión cerró lo grave. Quedan, para después del 20/10:
    - (media, plata en reportes) lib/graficos-datos.ts:256: la hoja por fecha de cierre filtrada por un funnel de agregados pone la venta en la casa, y los OKR (funnelDelMomento) la ponen en el agregado;
    - (baja) lib/reunion-auto.ts:618: «terminó de leer» aunque quede a medias;
    - (baja) lib/leer-reunion-en-segundo-plano.ts:125: «siguió leyendo y no encontró nada» cuando Fathom no contestó.
  - **Defectos viejos que encontraron las revisiones**, para después del 20/10, en el CRM:
    - el Deshacer del tablero de una abierta a Ganado borra el monto y su rastro (app/crm/actions.ts:2471);
    - «Restaurar» pone la fecha de la venta en hoy;
    - /mako/revisar convierte una lista vacía en null (app/mako/revisar/[id]/RevisarAccion.tsx:77).
  - **Después del deploy de B5:** `node --conditions react-server --import tsx scripts/mudanza-avisos-plataforma.mts --eventos=reunion_tareas_al_plan --aplicar` (nace pausada). Antes de prenderla, una CONDITION que excluya al ws13.
  - **Después del deploy de B1:** crear la fila «Tu Contraseña Cambió» en el ws9.
  - **Migraciones SIN aplicar:** 0314 (Chatwoot, de B1-infra) y 0316 (archivero_origen, de B3). El código anda sin ellas.
  - **Ops Center 5:** trabajando en los 11 puntos del chat (pedidos 9cbdcb57, c70103dc y 62187256).
  - **SEMANAL de la cuenta 4:** 76%.
- **21:55 UTC:**
  - **En producción:** el run 127 (B5 y la punta 1 del Ops Center 5) y el run 128 (la punta 2).
  - **Cerrados en el Centro:** c70103dc, 62187256, 9cbdcb57 y 41f3572c.
  - La fila #280 «Tareas de Reuniones al Plan» se creó PAUSADA. Martín la prende con una CONDITION que excluya al ws13.
  - «Tu Contraseña Cambió» no sale con la mudanza: es un evento de persona. Se crea desde su plantilla en SuperAdmin.
  - El teléfono de Martín es ANDROID (está en la memoria).
  - docs/pendientes.md quedó marcado DESACTUALIZADO; se concilia después del 20/10.
  - Todos los agentes terminaron; no queda ninguno corriendo.
  - **SEMANAL cuenta 4:** ~76%. Lo que queda, en cada relevo «para después del 20/10».
- **23:30 UTC:**
  - **En producción:** el run 129 (29392086f: MaKo en vista del Dashboard no edita, lo decide el server; el plan para unificar los chats en docs/diseno-chats-de-mako.md) y el run 130 (b61321827: Ops Center 6).
  - **Cerrados en el Centro:** 05688f9a, 341f0257 y dd9f3560.
  - **Avisarle al chat Sidebar** cuando se pueda escribirle: Ops6 tocó nav.ts (`arribaDe`) para sacar el Second Brain de la barra del super admin.
  - **Para después del 20/10:**
    - unificar los chats de MaKo;
    - el texto del razonamiento en «Trabajando…» (pide revisión de qué viaja);
    - borrar el mazo viejo (Mazo.tsx, Tablero.tsx);
    - SheetM a media altura en todas las hojas;
    - las fotos del Centro en otro dispositivo (decide Martín).
  - **SEMANAL cuenta 4:** ~78%. No queda ningún agente corriendo.

## 18/10 ~01:45 UTC (17/10 22:45 AR) — ESTADO PARA RETOMAR (Cerebro al 93% de contexto)

**Martín escribió DIRECTO en el chat del Cerebro.** El tope de 10 mensajes se reinició y se puede volver a escribir a los jefes. Su pedido de 10 puntos (con 4 capturas) quedó repartido así:
- **Ops Center 7** (Sonnet, worktree C:/dev/wt-ops4, rama ops7-1710). Trabaja en:
  - el «+» y la carita alineados, el Completado ENTERO (no se corta) y los íconos (Ops Center con la estrella, Nuevo chat con el círculo);
  - MaKo en WhatsApp fuera de la lista y sin «Sin incidentes nuevos»; el aviso de Completado que no salía;
  - el Runner que pide medir solo;
  - el chat que trabaja y no dice «Trabajando…» (4); el Second Brain que no se cierra al tocar un chat (5);
  - chats DORMIDOS si no tienen aviso ni trabajo (6); Markdown en todo texto, con links azules (2b).
  - Al llegar: ⚠️ REVISAR si tocó el cartero; si no, integrar y subir. Después cerrar en el Centro d8b9023a y 8e3ce267.
- **Grafo** (Sonnet, C:/dev/wt-grafo, rama grafo-movil-1710). Primera punta: el grafo en el teléfono (tocar nodos, apaisado, barra lateral) y UN solo grafo con filtros. Segunda punta: los nodos «Negocio» de cada workspace salen de lo que MaKo SABE, sin la estructura vieja (punto 1).
- **CRM Deshacer** (Opus, C:/dev/wt-crm-deshacer). Rediseño con foto antes/después: el d60daf299 NO entra (5 defectos; informe en scratchpad/revision-crm-deshacer.md). Al llegar, revisión ⚠️ (plata, ws1).
- **Conciliar pendientes** (Sonnet): reescribe docs/pendientes.md y scratchpad/pendientes.json. Al llegar:
  - `node scratchpad/armar-pendientes.cjs <scratchpad> C:/dev/wt-push-q/docs/pendientes.md` (OJO: el agente ya escribe el md; usar el json sólo para la página);
  - republicar la página EN LA MISMA URL https://claude.ai/artifact/YSbMq8d8XbV4UFY9NM7t3g... NO: la de pendientes es https://claude.ai/artifact/S7AyYhfn2CF652wGN953i4 (Artifact con file_path scratchpad/pendientes.html, que ya está publicado ahí);
  - mandarle el link a Martín y ponerlo en un cierre (punto 2: «no me lo enviaste por el Ops Center»).
- **Prototipo de coherencia** (Sonnet): docs/prototipos/coherencia-1710.html. Trae Home+Dashboard unidos en Dashboard (3), More/perfil como su referencia A en el teléfono Y en la computadora (7), y las tarjetas del CRM, Clients y Plan con la estética de su referencia B (8). Al llegar: leerlo entero, sacarle la envoltura html/head, publicarlo como artifact y mandárselo.
- **Sidebar nueva**, prototipo ya publicado: https://claude.ai/artifact/YSbMq8d8XbV4UFY9NM7t3g. Martín no lo comentó todavía. El de coherencia se monta sobre él.
- **Para después del 20/10** (la semanal de la cuenta 4 iba 79%):
  - punto 9: la tab Chats con el diseño del chat del Ops Center;
  - punto 10: AI Avatar rehecho copiando HeyGen (Martín: «no crees jamás nada de 0 y tampoco tengas miedo a DEPRECAR»);
  - implementar los prototipos;
  - unificar los chats de MaKo (docs/diseno-chats-de-mako.md).
  - Si Martín cambia la app a otra cuenta con margen, se pueden arrancar antes.
- **«Ya está» viejos sin mandar** (Sidebar, Dashboard, Infra, CRM, Onboarding, Plan, Ticketera, Automations): lo suyo ya está en producción y Martín lo supo por los cierres. No se mandan, para no gastar.
- **Producción: run 130** (b61321827). No hay nada subido sin deploy.

## Estado al 17/10 ~23:55 (claude4 al 82% semanal, reinicia 20/10 17:00 ART)

- **En producción (run 133, d497b6523, deploy Ready):** Deshacer del CRM con foto firmada + dedup de cobranza; grafo «Negocio» con lo que MaKo sabe; Ops Center 7 punta 1. Cierres de d8b9023a y 8e3ce267 en la cola del cartero (con los links de pendientes y del prototipo).
- **Trabajando:**
  - Ops Center 7 punta 2 («Nuevo chat» sin modal, la IA ubica y nombra): agente ada783a66f872731d, rama ops7-1710 en C:/dev/wt-ops4.
  - Chat **Sidebar** (local_789aebfb): sidebar nueva + Home→Dashboard (Focus fija) + More con la foto, desde los dos prototipos.
  - Chat **CRM** (local_64949e84): tarjetas de CRM/Clients/Plan desde docs/prototipos/coherencia-1710.
  - Los tres devuelven un VERDE sin pushear: los integra y pushea el Cerebro.
- **Sin hacer:** medir la cuenta 2 sola (necesita un Runner en esa cuenta); «Trabajando…» de raíz en el cartero (subir el estado en cada pasada de `vigilar`); Chats tab (pt 9) y AI Avatar estilo HeyGen (pt 10), después del 20/10.
- **Regla nueva de Martín (17/10 ~23:30):** «¿por qué no delegás?». Repartir a los chats que conocen el área, de a uno, según la RAM libre (la guardia frena con menos de 2,5 GB) y la cuota.

### 18/10 ~00:10: cuenta 4 en 85% semanal
- **En producción:** run 134 (196fa1101), «Nuevo chat» sin modal. MaKo en WhatsApp mandó los dos primeros avisos de arreglo (ws18 y ws13); su punta 293f9d72b (el script leía la tabla de Vercel por stdout y sale por stderr) está integrada en wt-push-q, sin pushear: va en el próximo push, junto con la de Sidebar.
- **A medias, NO se pushea hasta su VERDE:** Sidebar (`sidebar-v2` @ 84327aa84, corriendo su VERDE) y CRM (tarjetas, trabajando).
- Al 97% se corta: lo que quede a medias se queda en su rama, con su relevo.

### 18/10 ~02:20 ART (87% semanal)
- **En producción desde la última nota:**
  - run 135: sidebar nueva, Dashboard unido con Focus y More con la foto.
  - run 136: ticket #5, el «Claude vetado» que no era un veto.
  - run 137: tarjetas de CRM, Clients y Plan.
  - run 138: el círculo del Plan y las caras del teléfono.
  - run 139: el negocio sin IA ya no abre bug y pide conectar su IA, con la guarda del ws1.
- **Espera a Martín:** separar el ws1 de las claves de la plataforma. `hidratarCredenciales` copia la fila de OWNER_WS (=ws1, Mauricio) a process.env, así que el ws1 no puede tener una IA propia y su chat de MaKo no contesta (tickets #5 y #6, devueltos como pedido). Recomendado: que las claves de la plataforma salgan del ws9 o del entorno. Es de día y con cuidado: toca de dónde lee la IA toda la plataforma.
- **Sin ver en pantalla:** Clients en computadora; el menú de la foto de la sidebar. El chat CRM vio el resto en el ws9 sin escribir.
- **Sin revisar (Ticketera):** otros lugares que le piden una key de IA al ws1 (onboarding, /metodo). `contarKeysIA` del doer de WhatsApp cuenta las copias como del negocio: es del chat «MaKo en WhatsApp».

## RELEVO FINAL del 18/10 ~12:30 ART: la cuenta 4 al 95%, cierre

Se reinicia el 20/10 a las 17:00 ART (20:00 UTC). Hasta entonces, nada nuevo con esta cuenta.

**En producción hoy (runs 132 a 147):**
- Deshacer del CRM con dedup.
- Grafo «Negocio».
- Ops Center 7 y «Nuevo chat» sin modal.
- Sidebar nueva, Dashboard unido y More con foto.
- Tarjetas de CRM, Clients y Plan, y Clients arreglado.
- Ticket #5 («Claude vetado» que no era).
- El negocio sin IA ya no abre bug.
- El ws1 separado de las claves de la plataforma; probado con ping a Groq y Gemini en el ws9.
- «Ops Center» con la estrella en todos los ws.
- MaKo Alert escondido.
- Onboarding: datos de otro ws, explicación, preguntas, halagos, estrella.
- Chat del Ops Center: scroll, 40.000 caracteres, lo de la app en segundos.
- Cartero 1.15.8 instalado.

**Pusheado, sin confirmar el deploy:** 783190442 (la marca «desde la app» y los docs del feedback). Mirar `vercel ls -m githubCommitSha=78319044293cfc6ad2f3873de1f4d3f146f880d3` desde `dashboard-marketing-main/dashboard-marketing`, que es la carpeta enlazada a Vercel.

**A medias, NO pusheado:**
- **Onboarding** (rama onboarding-v3, C:/dev/wt-onboarding-v3): corre un VERDE con cinco cambios:
  - no esperaba la respuesta;
  - el PDF que no encontraba la oferta, ahora sin salir de la tab;
  - los puntitos «escribiendo»;
  - sin «Antes de terminar» ni «Última cosa»;
  - entra solo al Ops Center.

  Falta el reemplazo de las dos preguntas de Meta Ads. Integrar SÓLO con su VERDE; el sha llega a esta sesión.

**Los «Ya está» de hoy:** los escribieron CRM, Sidebar, Dashboard, Ticketera, Second Brain, Onboarding (pt 15) y Ops Center 3. Regla: en cada deploy, el Cerebro avisa a cada jefe y el jefe dice «Ya está: …» (memoria ya-esta-en-el-ops-center).

**Espera a Martín:**
- La clave de Cerebras del ws1: ¿de MaKo o de Mauricio?
- Avisarle a Mauricio que conecte su IA; después cerrar los tickets #5 y #6.

**Para después del 20/10** (orden sugerido; el detalle en docs/feedback-18-10.md):
1. El chat unificado: el onboarding primero, con su subida de archivos.
2. Offer, Chats y «Analizar con MaKo» del Dashboard, en el chat del Ops Center.
3. El onboarding del CRM en su tab (sale del general).
4. Las preguntas de fase multicanal.
5. Las imágenes y adjuntos desde la app al Ops Center (diseño en docs/relevo/centro-operaciones.md §punto 4).
6. La Ticketera con el diseño anterior.
7. «Uso» en los ws.
8. Columnas editables del Plan.
9. «Editar» con el patrón de Web Generator.
10. Los botones de Chats.
11. La animación de carga y el vuelo de la estrella.
12. La sidebar: lo que pidió Martín en el pt 10 (MaKo Partners al perfil, todo desplegado, Ops Center dentro de la sección, claro/oscuro, el logo plegado) y el pliegue al entrar al Second Brain.
13. El grafo único del super admin y el nombre «Mapa».

**El vigía (MaKo Alert):** su cron (job 29debd9d) murió con su sesión. Para retomarlo, ver §0 y §5 de docs/relevo/mako-en-whatsapp.md.

## 20/10 ~21:00 ART: la cuenta 4 se renovó (cuota en 0%)

- ⚠️ **ERROR DEL CEREBRO CORREGIDO:** saqué la cuenta de `~/.claude.json` (decía mbustos@) y puse `claude1` en el marcador. Martín: «ahora mismo estoy en la cuenta de leandrotejadogonzalvez@gmail.com... ¿Por qué asumiste que era la cuenta 1?». La cuenta es la **4**. `~/.claude.json` va con retraso y NO sirve para saber la cuenta: sólo el marcador o Martín.
- **Integrado:** la rama de la nube `claude/admiring-wozniak-odby79` (5bebe33f8). Es la investigación de Martín en la cuenta 1: las reglas del Cerebro pasaron a AGENTS.md. Va en 16eacbc30.
- **Repartido (Martín: «Continuá con todo»):**
  - **Onboarding:** 13b (entrar al chat Onboarding y el tutorial), 3 (el composer del Ops Center), 2 (la animación en el teléfono) y 10b (el CRM a medida).
  - **Sidebar:** el pt 10 (claro/oscuro, criaturas sin cambiar de color, MaKo Partners al perfil, el logo plegado, Ops Center dentro de la sección, todo desplegado) y el pliegue al entrar al Second Brain.
  - **Ops Center 3:** imágenes y adjuntos desde la app, y pegar capturas.
- **Cola, cuando terminen estos y haya RAM (a 4,3 GB, de a 3):**
  - Ticketera con el diseño anterior.
  - Dashboard: «Editar» con el patrón de Web Generator y «Analizar con MaKo» con el chat único.
  - CRM: columnas editables del Plan.
  - Second Brain: grafo único del super admin y el nombre «Mapa».
  - Chats: el pt 11.
  - Offer y los chats de MaKo con el chat único (pts 5 y 7).
  - «Uso» en los ws (pt 2).
  - El onboarding del CRM en su tab.
- **Espera a Martín:** los recordatorios programados del ws13 y la clave de Cerebras del ws1.
- **Mecánica:**
  - Lo que el Runner no logra entregar porque queda retenido llega acá con «REENVIAR A <sesión>:», y se reenvía tal cual.
  - El chat «Debate» es para las preguntas y las opiniones.
