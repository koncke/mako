# Relevo — Cerebro (el chat orquestador; antes «Estrategia 3 cuentas»)

<sub>Escrito por el Cerebro de la cuenta 3 el 16/10/2026 ~01:15 hora AR, con la ventana de 5 h al 97%.
Material de primera mano. Lo de antes del 15/10 está en `docs/relevo/estrategia-3-cuentas.md`.</sub>

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
