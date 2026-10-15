# Relevo — CRM, leads y embudos

**Ventana:** del 05/10/2026 12:33 (commit `6785dc16`) al 10/10/2026 18:59 (`9862c146`).
**Escrito el 10/10/2026 a las 19:10** por la sesión de CRM (cuenta `claude2`), reescribiendo
el briefing anterior (`b5f7fb55`, 10/10 17:10) con todo verificado contra el árbol.
**Rutas de esta área:** `app/crm/**`, `lib/leads.ts`, `lib/funnel*.ts`, `lib/crm*.ts`,
`lib/lead-*.ts`, `lib/campana-*.ts`, `lib/etiquetas*.ts`, `lib/pipeline.ts`.

## 0-Ω4. 15/10/2026 (chat «Pagos», cuenta `claude1`): b2 COMPLETA en `05bc31391`, y lo que choca al integrarla

**`crm-bloques-b2` está en `05bc31391`** (`wtc-b2`), una sola rama, sin pushear ni mergear en `crm-bloques`:
las dos ALTAS, las seis MEDIAS y las seis BAJAS de la revisión de Pagos, cerradas (`c27eb4323` → `906c36467` →
`fca716101` del CRM; `9df9e6817` y `05bc31391` de Pagos). Integrarla lo decide Martín: tablero, ref
`crm-bloques-b2-integrar`. La migración `XXXX_pagos_manual_suscripcion_cancelada.sql` sigue SIN número y ahora
suma `leads.suscripcion_meses_antes`; se numera al integrar, ANTES o junto con el deploy.

**Lo que choca al mezclar b2 con main** (medido con `git merge-tree` contra main del 15/10, no supuesto). Nada de
código choca; son tres archivos, cada uno con su cura:
- `docs/hallazgos-crm.md`: los dos lados agregaron entradas al final. Se queda con las DOS.
- `docs/relevo/crm.md` (este archivo): se editó en main y en b2. Se queda con las dos, ordenadas por fecha.
- `tests/api-mako-http.snapshot.txt`: las dos ramas sumaron ops a la API. **NO se resuelve a mano: se regenera
  después del merge** con `node --import tsx scripts/generar-api-doc.mjs` (escribe también `docs/api-mako.md`) y se
  commitea. Resuelto a mano, la lista diría que sale por HTTP algo que no sale (o al revés), y esa guarda existe
  para que exponer una operación sea una decisión y no un descuido.
`tests/cobranza.test.ts` NO choca aunque b2 y main lo cambiaron: es el mismo cambio línea por línea (el recorte de
`marcarPago` hasta el próximo export, `b87443e9c` en main) y git lo junta solo.

## 0-Ω3. 14/10/2026 ~16:30 (chat «CRM», cuenta `claude1`): las dos ALTAS de b2, ARREGLADAS

**Al ~17:30, b2 está en `fca716101`** (`c27eb4323` → `906c36467` → `fca716101`), sin pushear ni mergear:
- `906c36467`: la segunda vuelta de la revisión de Pagos. Acortar el plan con una cuota protegida ya no duplica, y
  un ajuste del plan aplica sólo la DIFERENCIA (no pisa una cuota movida a mano ni borra una que no es del plan).
  Un lead sin plan y con cuotas a mano: el ajuste se rechaza.
- `fca716101`: tres de las seis medias: «Sin cobro» con impagas, la cuota que la pantalla no vio, y Editar deal que
  decía «guardados». **Las otras tres las toma el chat «Pagos»** en su rama `pagos-b2-medias` (sale de
  `906c36467`): el dedup de la cobranza, el link vivo de una cuota cobrada a mano y el plazo de una suscripción
  al cancelar y reactivar. Cuando pase el hash, se mergea en b2.
- Tests `pagos-campo` 19/0 (22 roturas en rojo en total), pagos/cobros/API 203/203, tsc acotado 0.

**Al mergear b5, ojo con la rama `undecima` de Automations** (`C:/dev/wt-undecima`, sin pushear al 14/10 ~17:30):
`git merge-tree` con `crm-bloques-b5` da UN conflicto, en el import de `flujo-grafo` de `lib/flujo-ia.ts`. Se resuelve
juntando las dos listas (`borrarNodo, padresDe, siguienteDe, medioDe, puedeSumarAIStep, esAnclaDespues,`).
chatbot.def/run, nutricion.ts y docs/api-mako.md se mezclan solos; docs/api-mako.md se regenera después
(`node --import tsx scripts/generar-api-doc.mjs`). Automations avisa sus hunks antes de su próxima tarea (la
«Reentrada» del CRON: EditorDisparadores, lib/disparadores.ts y la inscripción del motor).

Lo de abajo es de las 16:30:
En `crm-bloques-b2` @ `c27eb4323` (`wtc-b2`), sin pushear y sin mergear en `crm-bloques`:
- **Modo 'lista'** (wizard de Ganado, API `guardar_cuotas`): las cuotas protegidas se casan PRIMERO, así que
  ya no duplican la deuda. La API y el wizard dicen lo que no se tocó (el wizard, en el historial y en `sinTocar`;
  mostrarlo en pantalla es de B2).
- **`ajustarPlanAction`**: mezcla el parcial con el plan de la base (`ajustarSobre`) y pide el día de pago si falta.
  El Deshacer escribe el plan anterior tal cual (`planComoEstaba`).
- Tests `pagos-campo` 16/0 con 8 roturas; pagos/cobros/API 197/197; tsc acotado 0. Cosecha en el
  `docs/hallazgos-crm.md` de la rama. «Pagos» revisa el diff.

**Sigue, en el orden de abajo:** las seis medias de b2, el armador de b1 y b5, revisar b1/b5, mergear b1..b5 en
`crm-bloques` y pasárselo a Estrategia 3 cuentas.

## 0-Ω2. 14/10/2026 de madrugada (chat «CRM», cuenta `claude2`): el feedback del 14/10 03:06, EN CURSO

El pedido textual está en `app/admin/dev/crm/bitacora.ts` (hito del 14/10 03:06). Más dos mensajes después:
«Piensa en todos los bloques que un usuario, con los diferentes funnels que tenemos… podría llegar a querer ver en
las tab personalizables de pagos y resumen... Y piensa si deberíamos personalizar otras tabs también, yo creo que si»,
y «También los funnels organico, de Instagram, linkedin, DM Funnel, YouTube, lead magnet, etc... Eso es importante, y
revisa si deberíamos cambiar las configuraciones de "Nuevo CRM" para agregar más casos».

**Dónde está el trabajo.** Rama `fb1410` en `C:/Users/marti/wtcrm5` (sobre origin/main `92a2be21`). La tanda A corre en seis
worktrees, uno por frente, cada uno con su rama `fb1410-aN` encima de `fb1410` (con junction a node_modules; sacarlo con
`cmd /c rmdir` antes de borrar el worktree):
- `wtc-a1`: el reproductor de la grabación EN LÍNEA en Tracking. Causa medida: `public/replay/1/player.css` nunca se
  cargaba, y la escala quedaba en 1.
- `wtc-a2`: la etiqueta vuelve al diseño de antes de `a98318cb`, en el renglón del nombre. La primera se ve normal, «+N» con 2
  o más, y vuelve la píldora «＋ Etiqueta».
- `wtc-a3`: «A revisar» con una fila por lead (foto, número de datos), revisar azul con flecha, ignorar con X (ignora todos
  los ignorables del lead), X para cerrar, y se cierra con un clic afuera o con Escape.
- `wtc-a4`: el ⋯ del CRM sin subtítulos, sin «Avisos» ni «Resumen», y sin el interruptor del CRM automático (el MOTOR sigue:
  lo pidió Automations).
- `wtc-a5`: el clic derecho en el TABLERO (tarjeta, fila, columna, fondo, selección), con la pieza genérica
  `app/_ui/MenuContextual.tsx`. Falta el de la FICHA: va con el constructor.
- `wtc-a6`: el chat de MaKo al costado del CRM, plegado, con las sugerencias de `docs/sugerencias-mako-crm.md` («Hacerlo»
  crea la automatización pausada desde la plantilla) y la lectura `sugerencias_crm` en la API.
Workflows: tanda A `wf_d8dfde6d-689`; catálogo de bloques `wf_70de8f94-88b`, que deja `docs/diseno-ficha-bloques.md`
en wtcrm5 (los journals están en `~/.claude/projects/<proyecto>/debe2ade-…/subagents/workflows/<runId>/journal.jsonl`).
Al terminar: se revisa cada rama, se mergea en `fb1410`, se corren los tests, se cosecha y se pushea.

**CIERRE DEL 14/10 ~15:10: la cuenta claude2 llegó al 98% semanal.** Frené la tanda B1 (`wf_0132bb27-e06`) y NO se pusheó
nada de la tanda B. En producción está hasta la tanda A (fb1410, en `45fe2cb7f`, deploy Ready). Lo que devolvió cada agente
(contrato del motor, pendientes, hallazgos, revisiones) está volcado en **docs/relevo/crm-tanda-b1.md**.
Estado de cada frente; todos salen de `crm-bloques` @ `2c19b2d69`:
- **b1, motor** (`wtc-b1`, rama `crm-bloques-b1`): TERMINADO en 5 commits, de `1c930ec33` a `d04040305`: catálogo, plantillas, config por
  funnel, avisos por funnel, ops ver/cambiar_ficha_funnel y los dos ignorados. Le falta su revisión.
- **b1, armador**: A MEDIAS, en el commit `3eb46606a` («WIP — NO INTEGRAR»): armador, registros por tab, Personalizar y las dos
  puertas, y se fueron ResumenModal y resumen-actions. NO se corrieron sus tests y falta borrar AvisosDatosModal. Hay que retomarlo
  con el prompt ARMADOR de `tanda-b1.js` (scratchpad de la sesión debe2ade; se reconstruye con este relevo) y una nota de que
  lo del commit WIP es suyo.
- **b2, Pagos campo por campo** (`wtc-b2`): 5 commits, `f3a36ffa3`..`0952106fc`. **La revisión dice que NO va tal cual: dos fallas
  ALTAS de plata.** Una: `ajustarPlanAction` recibe un Partial y lo escribe como el plan entero, y borra cuotas o corre los
  vencimientos. Otra: en el modo 'lista', una cuota protegida termina en «insertar». Hay además seis medias (dedup de la cobranza
  con un id que sobrevive, un link vivo de una cuota cobrada a mano, «Sin cobro» con impagas vivas, una cuota nacida después de
  la foto, Editar deal que ignora en silencio, cancelar pisa el plazo). El detalle está en crm-tanda-b1.md. Trae migración XXXX.
- **b3, «Nuevo CRM»** (`wtc-b3`): 3 commits, `54b6bde61`..`8b3392d15`: presets, el modal por tipo y las ops tipos_de_crm/crear_crm.
  No tiene revisión (no era invisible).
- **b4, captura** (`wtc-b4`): 2 commits, `6b11f7602` y `cab2e72d3`. La revisión dice que va bien, con una media: la etapa
  efectiva de MaKo se calcula contra el funnel del negocio y no contra el del lead. Trae migración XXXX (`leads.pagina_registro` y
  `entrada_social`, que va ANTES o JUNTO con el deploy).
- **b5, plantillas del CRM automático** (`wtc-b5`): las piezas en `5129d8dde`, y las plantillas, la galería y las ops A MEDIAS en
  `87889880f` («WIP — NO INTEGRAR»), sin tests corridos ni revisión. Tiene que respetar las reglas que mandó Automations (están en
  el prompt de b5).
**Orden para el que siga:**
1. Retomar el armador de b1 y b5 (o relanzar `tanda-b1.js` con `resumeFromRunId`: los frentes terminados salen del caché).
2. Arreglar las dos altas y las medias de b2.
3. Revisar b1 (motor y armador) y b5.
4. Mergear b1..b5 en `crm-bloques` (sin rebase), numerar las migraciones XXXX con la regla de AGENTS.md y correr los tests de lo
   tocado.
5. Pasarle a Estrategia 3 CUENTAS la rama y el hash: integra ella.
6. Recién después, la **tanda B2**: los bloques de cada tab sobre los registros del armador, la salida de «Editar deal», CS y el clic
   derecho dentro de la ficha.
Con claude2 al 98%, esto lo tiene que hacer otra cuenta o esperar al reinicio del 20/10.

**ESTADO AL 14/10 ~13:15. TANDA B1 CORRIENDO OTRA VEZ (`wf_0132bb27-e06`, el mismo run).** fb1410 ya está en origin/main
(`45fe2cb7f`), y `crm-bloques` mergeó origin/main sin rebase en `2c19b2d69`, la base de los cinco frentes. Uso semanal de
claude2: 88%. Antes de la B2, medir de nuevo. Lo de abajo es la historia de la pausa:
**ESTADO AL 14/10 ~12:20. TANDA B1 EN PAUSA (`wf_0132bb27-e06`), hasta que Estrategia 3 CUENTAS avise que entró su push** (la paré
a los minutos y sin cambios en los worktrees: Estrategia necesita 4 GB libres para pushear, y fb1410 va en ese push. Se
retoma con `resumeFromRunId`. La tanda B la INTEGRA Estrategia: se le pasa rama y hash, y NO se hace `pull --rebase`)
**ANTES DE RETOMAR:**
1. Con el push de Estrategia ya adentro (trae fb1410 y su choque resuelto), mergear `origin/main` en `crm-bloques`, SIN
   rebase.
2. Llevar `crm-bloques-b1..b5` al `crm-bloques` nuevo. Están vacías: `git -C C:/Users/marti/wtc-bN reset --hard crm-bloques`
   después de ver que siguen sin commits.
El chat de Automations pidió esto el 14/10: sus cambios en plantillas-automatizaciones, condiciones-catalogo, el motor
y chatbot.def/run entraron en `282173d6e`, y sin el merge volvería lo que borró. Sus reglas para b5 ya están en el
prompt de `tanda-b1.js`. (script en el scratchpad de la sesión debe2ade,
`tanda-b1.js`; con tope de 3 agentes a la vez por RAM). Martín: «Si, avanza con todo y pushea» → las 7 decisiones del
catálogo están TOMADAS (§1 de docs/diseno-ficha-bloques.md, `1f075a2b8`). Cinco frentes, cada uno en su worktree, que salen
de `crm-bloques`:
- `wtc-b1` el motor (lib/ficha/**, config por funnel, avisos por funnel, el arreglo de los dos ignorados, ops
  ver/cambiar_ficha_funnel) y después el armador (un solo armador para las dos puertas, el modo Personalizar, y se van
  ResumenModal y AvisosDatosModal).
- `wtc-b2` Pagos campo por campo (merge, cuotas por id, lo cobrado puro, la moneda).
- `wtc-b3` los tipos de «Nuevo CRM».
- `wtc-b4` la captura (el @ de IG, la primera entrada social, la página de registro, lo que lee MaKo).
- `wtc-b5` las plantillas T1/T2/T3/T6 en Automations (avisado al chat de Automations).
Si se corta: relanzar con `resumeFromRunId`. Después: revisar, mergear en `crm-bloques`, numerar las migraciones `XXXX`,
tests, y lanzar la **tanda B2**: los bloques de cada tab sobre los registros que deja b1 (Resumen, charlas, Reuniones y
Tracking, Pagos sin «Editar deal», CS). Después cosecha y push: Martín pidió pushear.

**ESTADO AL 14/10 ~11:20.** Los puntos 1 a 5 de abajo están HECHOS: `fb1410` @ `adaa18103` (tests 1478/0) está en manos
de Estrategia 3 CUENTAS, que la suma al push que sigue al de General y Automations. **No mover `fb1410`.** Los worktrees
`wtc-a1..a6` están borrados, pero sus ramas quedan. La tanda B va en la rama `crm-bloques`, en el mismo worktree `wtcrm5`.
`edcf28e3c` es el catálogo `docs/diseno-ficha-bloques.md`: 54 bloques y 8 plantillas por tipo de funnel, más el respaldo y la
de CS. Trae los tipos nuevos de «Nuevo CRM» y 7 decisiones, que están esperando la respuesta de Martín.
Corregí dos cosas a mano. El estilo de la ficha (tipografía, tarjetas y colores) lo pidió él el 13/10, así que no es una
decisión: se reusa `TemaHoja`. «Editar deal →» se va en la tanda B, al cierre.
Queda pendiente para la tanda B: la API (`ignorar_datos_sin_marcar`) escribe `pendientes_ignorados` y el panel escribe
`datos_ignorados`, así que lo que ignora MaKo no se puede volver a mostrar desde «Ver más» (docs/hallazgos-crm.md:63).

**ESTADO AL 14/10 ~06:35 (la app se cayó a las 04:27 y a las 06:10).** La tanda A TERMINÓ y está en `fb1410`
(cherry-pick de las seis ramas, sin choques): `c76f48bb2` reproductor en línea · `f52234dc3`+`fa9d5ca75` etiquetas ·
`99e0a02b5` A revisar · `43a27b56c` tres puntos · `a3496cc32` clic derecho del tablero · `b04e3d1fe` chat de MaKo
con sugerencias · `b4db1eaa7` arreglo de la revisión de A revisar (agrupación pura con test, ignorados sin tope chico).
Los resultados de los seis agentes, con sus hallazgos y pendientes, están en el journal de `wf_d8dfde6d-689`.
**Falta, en este orden:**
1. Dos arreglos de la revisión del chat de MaKo, de gravedad media. El texto de «Un Lead No Avanzó» promete el plazo de la
   etapa y la plantilla espera 3 días fijos; tiene que decir lo que hace. «Ahora no» no tiene vuelta: hace falta «Calladas (N)»
   con «Volver a mostrar». Uno bajo: al cambiar de CRM con el panel plegado, se carga el hilo, y cargar el hilo escribe.
   El agente que los hacía se cortó con la caída sin escribir nada.
2. COSECHAR los hallazgos de la tanda A en docs/hallazgos-crm.md, hallazgos-ui.md y hallazgos-landing.md (la causa del
   reproductor: player.css nunca se cargaba; maxScale 0 = sin tope; el iframe grabado va inert; el MenuContextual de la casa
   y sus guardas; las caras de A revisar sin el proxy de Evolution), y la bitácora con sus commits.
3. Correr los tests de todo lo tocado en fb1410 y pasarle la rama y el hash a Estrategia 3 CUENTAS, que pushea.
4. Retomar el catálogo `wf_70de8f94-88b` (lo frenó la guardia de RAM) y después la tanda B.
5. Borrar `C:/Users/marti/wtc-a1..a6` (primero `cmd /c rmdir` del junction de node_modules, después `git worktree remove`).

**Lo que viene después (tanda B): el CONSTRUCTOR POR BLOQUES.** Martín: «no los hagas con un modal diferente… Que replique la
edición que tenemos en "Dashboard" y "Landing Generator", que sea un constructor por bloques… con templates… que pueda
elegir que bloques poner, que diseño, tamaño». Va para Resumen, Pagos y las tabs que proponga el catálogo. Ahí mismo se
eligen los avisos de «datos sin marcar», y se borran ResumenModal, AvisosDatosModal y los engranajes. En Pagos se edita TODO
en la tab y se depreca «Editar deal →» en todos lados: EditarDeal, `?edit=1` y el «Completar con IA», que está roto en 2 de
las 3 puertas. Lo medido por el relevamiento `wf_7c6f7f1e-959`:
- la cáscara de grilla del Dashboard NO está extraída: son ~450 líneas mezcladas en `app/dashboard/EditorInforme.tsx`.
- La grilla fija de 30 px choca con tarjetas de alto variable.
- El Landing es TipTap: no sirve para la ficha.
- Las cuotas: `saveCuotasAction` cierra el lead como ganado en cada guardado (`lib/pagos.ts:224`).
- `saveDealSectionsAction` reemplaza la sección entera.
- Las dos puertas montan la ficha a mano por duplicado (hace falta UN renderer).

**Pendiente con Automations.** Martín: «elimina el botón de "CRM Automático"... Si quedó algo pendiente, llevalo como template a
automations». Mapeo medido de las reglas del motor contra las plantillas:
- **T2** (no agendó → No Agenda → Reactivación) y **T6** (perdido o no responde a los 30 días → Reactivación) se arman con las
  piezas de hoy, pero la galería no tiene cómo pedir la ETAPA DESTINO del ⚡ Mover (es obligatoria).
- **T3** (nutrición manual vencida) pierde la fecha límite por lead: no hay condición sobre ese dato.
- **T1** (no show por Fathom) no tiene piezas: una espera «N horas después de la reunión» y la condición «asistencia sin marcar».
- El motor NO se apaga hasta que esas plantillas existan (`KEY_CRM_AUTO`).

## 0-Ω. Noche del 13 al 14/10/2026 (chat «CRM», cuenta `claude2`): el feedback del detalle del lead

Martín lo pidió directo (el texto literal está en `app/admin/dev/crm/bitacora.ts`, hito del 13/10
22:57). **Nada de esto está en producción todavía:** al 14/10 01:10 los pushes de TODA la máquina
seguían trabados por RAM (el typecheck completo ya pide ≈ 5,3 GB libres: el tope del heap subió a
4096 el 14/10). Hay DOS worktrees con trabajo sin publicar:

- `C:/Users/marti/wtcrm2` (HEAD `a98318cb`): `origin/main` + los commits de todas las sesiones +
  los del CRM hasta la cabecera compacta. Un script de fondo lo pushea cuando haya RAM
  (`scratchpad/push-cuando-haya-ram.sh`; sale con 2 si `origin/main` se movió → rebasar y relanzar).
- `C:/Users/marti/wtcrm3` (HEAD `4ca15b9a`): encima de `a98318cb`, la oferta del lead
  (`81a28c18`, `4ca15b9a`) y esta cosecha. **Se pasa a la rama del push con un cherry-pick** cuando
  `wtcrm2` llegue, o se pushea desde acá si `wtcrm2` ya está en `origin`.

**CIERRE (14/10 ~03:45, pedido de Martín: «que se pushee todo y que los chats cierren lo que están
haciendo»).** Todo lo del CRM está en la rama `crm-1410` del worktree `C:/Users/marti/wtcrm4`: una copia
limpia sobre origin/main `e4c8a6d7` con los commits del CRM pasados por cherry-pick (sin choques) más los
tres bugs que encontró Automations y la hora al mover a mano. **El push lo hace Estrategia 3 CUENTAS, con
todo junto: desde acá no se pushea.** Los hashes de la bitácora y de este relevo son los de `crm-1410`.
Tests de lo tocado: 7907 verdes y 2 rojos ajenos. El de SelectorFuente lo reescribió CS en `0255c855`; el
otro es el área de `dashboard-analisis-listo`, de Automations. La referencia de la API está al día.

**Las migraciones ya están APLICADAS en prod** (0269, 0270, 0272 y 0274; todas aditivas o de datos): son de las que van antes del
deploy. Los hashes de abajo son los de DESPUÉS del rebase del 14/10.

### ✅ Hecho (commits locales, con tests probados rompiéndolos)

- «A revisar» sólo con datos sin marcar, sin la «Mk» ni «MaKo movió» (`0d07ddc8`). **El motor
  (lib/crm-auto.ts) sigue corriendo**: lo reemplazan las plantillas que se le pidieron al chat de
  Automations, y recién ahí se apaga (flag por workspace `KEY_CRM_AUTO`).
- «Nuevo CRM» arriba del desplegable, «CRM eliminados» (`0d07ddc8`).
- El CRM con nombre propio: renombrarlo ya no renombra el producto ni el curso (`ace3e61d`, mig 0269).
- La grabación de la visita: montaba en un rAF antes de que existiera el recuadro (`913966d4`).
- Datos sin marcar v2: «Ver →», solucionar que lleva al dato y lo señala, ignorar por dato, «Ver
  más», de qué avisa MaKo, «A revisar» por dato, y «¿Era calificado?» en Resumen (`42e57a6c`, mig 0270).
- El mapa de sugerencias de MaKo: `docs/sugerencias-mako-crm.md`, **esperando que Martín lo valide**.
- Autoguardado: lo que se perdía era cerrar un modal con un clic en el fondo (`862757d0`).
- Cabecera compacta: etiquetas al lado del nombre con «+N» (`a98318cb`).
- Pagos punto 1: la OFERTA del lead (desplegable, «Nueva oferta» con nombre, modelo y ticket, y
  «Analizar oferta →» que abre ESA en Offer) (`81a28c18`, `4ca15b9a`, mig 0272). Toqué tres archivos
  de Offer (`page.tsx`, `OfferApp.tsx`, `arbol.ts`) porque no había chat de Offer vivo para pedírselo.

**Sin mirar en el navegador** (la máquina sin RAM para un `next dev`): lo primero al haber deploy
es abrir una ficha con datos sin marcar y probar «Ver →», solucionar, ignorar y el engranaje.

### ⏳ Lo que falta del mismo pedido (en este orden)

1. ~~Autoguardado~~ y 2. ~~cabecera compacta~~: hechos (arriba).
3. **Tarjetas del lead personalizables** (plantillas, campos, arrastrar, vista en vivo) en los tres puntos.
4. ~~**Resumen personalizable**~~: hecho el 14/10 (mig 0274 aplicada). Falta mirarlo en el navegador.
5. ~~**CAPI**~~: revisado el 14/10 (docs/hallazgos-ads.md, «a dónde va hoy ¿Era calificado?»). La
   tarjeta ya no afirma «Meta aprende» donde no llega. **Espera a Martín**: si quiere ofrecer el
   conjunto de datos de CRM (lo que hace que Meta optimice por calificados); nadie lo tiene.
6. **Pagos**: ~~el desplegable de OFERTA~~ (hecho); falta la tab personalizable como Reuniones
   (tipografía, tamaño de tarjetas, colores). Coordinar con Integraciones (worktree
   `C:/dev/wt-pagos`, rama `pagos-pasarela`).
7. **El chat de MaKo al costado del CRM con las sugerencias**: después de que Martín valide el mapa.
8. Del lote de Estrategia: Leads Scraper (sólo fuentes legítimas) y los tipos de funnel que faltan.

### Pedidos a otros chats (13/10), y lo que contestaron el 14/10

- **Automations**: plantillas que reemplacen T1-T6 del CRM automático, revisar si hoy alcanza, y el
  EVENTO de Calendly o Cal por etapa de reunión. **Contestó (14/10):** lo tiene en
  `docs/relevo/chatbot.md` (`25e4600a`), después de tres bugs de Mauricio. Para crear desde una
  plantilla hay UNA puerta: la op `crear_automatizacion_desde_plantilla` o
  `POST /api/chat-agent/secuencias` con `action: 'crear_desde_plantilla'` (las dos terminan en
  `crearDesdePlantilla`, lib/plantilla-crear.ts). Ya existe `lead-no-avanzo` (el plazo de etapa).
  **El motor NO se apaga** hasta que avisen; se apaga por workspace con `KEY_CRM_AUTO`.
- **Customer Success**: el título del curso desde la OFERTA. Se le tocó `renombrarServicioAction`
  (un hunk: ahora renombra el producto, no el CRM). **Contestó (14/10):** lo toma, leyendo la oferta
  principal del producto; espera el hash en main (`ace3e61d`) para leer `nombreVisible`.
- **El push lo hace UNO: Estrategia 3 CUENTAS**, desde su worktree de integración (14/10 ~01:00). No se
  pushea desde acá; se le pasa el HEAD de `C:/Users/marti/wtcrm3`.

## 0-α. Al 13/10/2026 (chat «CRM», cuenta `claude2`, al reanudar lo frenado por la cuota)

Martín, vía «Estrategia 3 cuentas»: «dile a esos chats que continuen y cierren lo que ya habiamos
planificado». Lo nuevo de `mako-feedback-y-tareas.md` NO se tocó: sigue provisional.

### ✅ Cerrado (cada uno con su test probado rompiéndolo)

- **El rojo de main** (`tests/mover-etapa-validacion.test.ts`): el código validaba bien. El test
  leía 1.400 caracteres fijos y el commit de MaKo Mobile metió código en el medio. Ahora lee la
  rama de la opción.
- **Confirmar una propuesta de contactos la RECLAMA antes de crear** (§3): dos pestañas ya no
  crean dos veces. Si no escribió nada, se suelta (`soltarPropuesta`).
- **Quitar una columna pregunta aunque el filtro esconda sus leads.**
- **La nota desde el teléfono se rechaza si es larga**, con `TOPE_NOTA`, en vez de recortarse.
- **«confírmalo en Inbox» → «confírmalo abajo»**: el mismo turno corre en la ficha de escritorio.
- **Instagram: una sola regla** de qué es un usuario (la del buscador).
- **El desplegable no esconde «＋ Nueva» al buscar** (`app/components/Dropdown.tsx`).
- **La cohorte se ve en el panel del tablero**, con `cohorteDeLead`, la misma función de la ruta.
- **«A revisar» resuelve en el lugar**: lista los primeros 12 leads con datos sin marcar y abre
  su ficha encima de la página. «Ver todos» sigue llevando a la cola.
- **Las notas como los chats de MaKo**: emojis, el micrófono (ya estaba) y **adjuntos**. La
  **mig 0267 YA ESTÁ APLICADA en prod**: columnas en `lead_audit` y el bucket privado
  `lead-notas`. Verificado de punta a punta en ws3 y borrado.

**Sin mirar en el navegador.**

**El push:** al cierre, el pre-push no pudo correr el typecheck. La vigía de RAM lo mata en zona
roja y sale «hay errores de tipos» sin ninguno. Lo arregla «Fallas en la PC» en
`scripts/typecheck-lock.mjs`. Los commits se pushean cuando eso esté en main; nunca con
`--no-verify`.

### Ya estaba hecho (las notas de abajo quedaron viejas)

- **El punto 3 del quinto feedback** (desplegable de tipo en las nutriciones, arrastrar cambia el
  tipo): está en `ab720661`.
- **El duplicado del opt-in sin productos** (§3): desde el 09/10 la propuesta guarda
  `datos.funnels` y los aplica quien confirma.

### Sin hacer, con su archivo

- **El espejo etapa↔etiqueta reconoce por el NOMBRE** lo que tocó una persona
  (`lib/etiquetas-motor.ts`).
- **Los dos textos al borrar una etapa se contradicen, y ninguno es exacto.**
  - El tablero (`CrmBoard.tsx`) dice que los leads «pasan a la primera etapa».
  - El editor (`EtapasModal.tsx`) dice que «quedan fuera del embudo».
  - Lo que pasa: vuelven a la etapa que les dan sus datos (`etapaVigenteDe`), y quedan afuera
    sólo si esa etapa no existe en el funnel.
- **El lápiz (color) en las etapas de nutrición**; **la causa del título de /crm**; **los tres
  clasificadores de «Meta está limitando»**.

## 0. Al 12/10/2026, 15:30 (chat «CRM», cuenta `claude3`, al 98% semanal)

### ✅ Sexto feedback del 12/10 (14:54) y el punto 3 del quinto: HECHOS en `ab720661`

El desplegable de tipo va en todas las etapas. El tipo decide la lista y arrastrar a la otra lista cambia el tipo.
Hay un «+» entre etapas. Las secciones del editor van en cajas grises con cabecera («Editar etapas», «Asignar
campañas» con el logo de Meta, el tipo de funnel en lista). La tabla de campañas perdió «N asignadas». Sin mirar en
el navegador.

**Para la próxima:** una etapa propia marcada Nutrición SIGUE GUARDADA en `data.pipeline` (con `marcadaComo`); la saca
del recorrido `generateFunnel` (`recorridoDe`). Una nutrición de catálogo que sube entra al pipeline con SU clave y
apaga sus transiciones. Todo eso decide `cambiarTipo` en lib/etapa-banda.ts.

**SIN HACER** (en docs/hallazgos-crm.md): los prompts que describen el recorrido leen `f.pipeline` y listan las
nutriciones propias como pasos; y una nutrición de catálogo subida al recorrido sigue contando como nutrición para
`NUTRI_KEYS` (lib/leads.ts, app/crm/edit-logic.ts). Siguen sin hacer las notas como los chats de MaKo y «A revisar»
en el desplegable (§0-a).
## 0-a0. Al 12/10/2026, 14:40 (chat «CRM», cuenta `claude3`, al 97% semanal)

### ✅ Quinto feedback del 12/10 (14:10), puntos 1, 2 y 4: HECHOS en `8ed12c64`

En la tabla de campañas del editor del funnel: con lo tildado, «Asignar a este funnel» (sin desplegable); los dos
filtros son un botón «Filtrar» con el ícono de siempre (Estado y Funnel, sin «Todos»); se ven cinco y el «Ver más»
de la casa. Las etapas son tarjetas (fondo blanco, anillo, sombra, más altas). Sin mirar en el navegador.

**Ojo:** el lote ya no ofrece «Sin asignar». Quitar una campaña sigue de a una, en su columna «Funnel».

### ⛔ SIN HACER: el punto 3 (cambia el modelo; no lo arranqué al 97%)

Textual: «El desplegable de las etapas que dice "Etapa, reunión, nutrición" también lo debería tener los de
nutrición... Y si se coloca "Etapa" se desplaza automáticamente hacia arriba, y viceversa. Es decir, también si
arrastro debería cambiar ese desplegable.» El plan:

- **La UI** (`app/crm/EtapasModal.tsx`): `SelectorTipo` también en `filaNutricion`. El `onDrop` de la lista decide
  por el grupo DESTINO (hoy `grupoAgarrado` lo limita al suyo) y soltar en la otra banda es cambiar el tipo.
- **Nutrición → Etapa/Reunión:** una nutrición DERIVADA se inserta como paso del pipeline y se apagan sus ids
  derivados (`idsParaQuitarNutricion`); una propia sale de `data.nutricionesPropias` y entra al pipeline.
- **Etapa → Nutrición:** sale del pipeline y entra a un `data.nutricionesPropias` NUEVO, que `generateFunnel`
  coloca en la banda nutrición como hoy coloca `manual` (lib/pipeline.ts). Lo lee `filaAFunnel` (lib/funnel-fila.ts)
  y lo conserva `mergeFunnelData`. Si la clave es una nutrición conocida, se des-suprime en vez de crearla.
- **La clave de la etapa no cambia**, así que sus leads siguen en su columna. Entrada, pago y cierre quedan afuera
  (`puedeSerReunion`).
- **El server:** una op nueva en `OpEtapa` (`app/crm/actions.ts`), con su deshacer; y el test con su rotura.

**Siguen sin hacer** (§0-a): notas como los chats de MaKo y «A revisar» en el desplegable; y que «Marcar nutrición
manual» se apague cuando el funnel quitó esa etapa (§0-a1).
## 0-a1. Al 12/10/2026, 13:40 (chat «CRM», cuenta `claude3`, al 96% semanal)

### ✅ El editor del funnel (cuarto feedback del 12/10): HECHO en `53cf309f`

Martín pidió a las 13:11, con dos capturas del editor de VSL FUNNEL (textual en la bitácora): el tipo de funnel
arriba de las etapas, UNA opción, que se guarde al elegirla, y con anuncios las campañas de Meta en su lugar con
una flecha para volver (Prospección sin campañas); la entrada sin lápiz ni «Campañas de Meta»; «+ Agregar etapa»
arriba de todo; sin flechas, un asa para arrastrar; las de nutrición editables, arrastrables y que se puedan quitar
todas; Ganado y descartes sin pastilla y con la caja distinta; el tacho rojo. Todo hecho. Sin mirar en el navegador.

**Para la próxima:** el tipo de funnel se guarda como la ENTRADA de siempre (`TIPOS_FUNNEL`, lib/pipeline.ts), no
es un dato nuevo. «Agendan llamada» dejó de ofrecerse y se muestra elegida donde ya estaba declarada. Quitar
«Nutrición - Manual» deja sus leads fuera del tablero (lo dice el diálogo) y el «Marcar nutrición manual» de la
ficha los sigue mandando ahí: si eso molesta, que ese botón se apague cuando la etapa no está.

**Rojo previo en main, no mío:** `tests/mover-etapa-validacion.test.ts` («CABLEADO: la opción del modal de
confirmaciones…») falla sobre `lib/mako-confirmaciones.ts`, que nadie de este chat tocó.

**Siguen sin hacer** (los del tercer feedback, abajo en §0-a): notas como los chats de MaKo (3) y «A revisar» en el
desplegable (4).
## 0-a. Al 12/10/2026, 12:00 (chat «CRM», cuenta `claude3`, al 95% semanal)

### ✅ El tercer feedback del 12/10: HECHO en `40d5ba8c`, salvo dos puntos

Martín mandó ocho puntos a las 11:37 y uno más a las 11:43 (textuales en la bitácora). Hechos: el editor de
etapas en UNA lista en el orden del tablero (1), el país del alta que recuerda la última elegida y si no detecta
el de la zona horaria (2), la barra como tarjeta del ancho del kanban (5), etiquetas con lápiz, sin «Ya la tiene»
y con ✓ para crear (6), la ficha a alto completo (8) y «Campañas de Meta» en la fila de entrada del editor (el
pedido de las 11:43). El 7 (los plazos de etapa como template de Automations) se lo pasé al chat «Chatbot», como
él pidió. Sin mirar en el navegador.

**SIN HACER, por la cuota (95%):**
- **3. Las notas como los chats de MaKo** (adjuntar archivos e imágenes, emojis, y el micrófono que TRANSCRIBE en
  vez de mandar audio). Vive en `app/crm/lead-view/NotasCard.tsx`; el molde es `ComposerWhatsApp`
  (`app/whatsapp/_shared/ComposerWhatsApp.tsx`) y el dictado `transcribirNota` (`app/_components/useDictar`), que
  ya usa MaKo Analyst. Adjuntar en una nota necesita dónde guardar el archivo: hoy una nota es sólo texto.
- **4. «A revisar» sin ir a otra tab**: `app/_components/MakoConfirmGate.tsx` (`irAPendientes` hace
  `router.push('/crm?pendientes=1')`). Sólo tiene el CONTEO (`/api/datos-sin-marcar-count`): mostrar los datos en
  el desplegable pide un endpoint que devuelva la lista.
- **1, a medias**: las etapas de nutrición se renombran con un clic y se quitan con la ✕, pero no tienen el lápiz
  (color y tipo) de las propias. Si «editables como cualquier otra» era eso, falta.

## 0-a2. Al 12/10/2026, 11:00 (chat «CRM», cuenta `claude3`, al 93% semanal)

### ✅ El segundo feedback del 12/10 (once puntos): HECHO en `3e5176c9`

Martín mandó once puntos a las 10:30 sobre lo publicado esa mañana (textuales en la bitácora). Hechos: las
reuniones en un botón que late (1), el borrador del alta (2), la barra como banda (3), todas las etapas en
el editor (9) y los tres puntos de cada etiqueta (8). Contestados sin código: los filtros ya persisten con
F5 (6, confirmado por él), «¿Era calificado?» es sólo para CAPI y está bien que no aparezca (11), y el
**número de lead sigue siendo el id global** (7: «decidelo tú»; el porqué, en `docs/hallazgos-crm.md` →
«El segundo feedback del 12/10»). Sin mirar en el navegador.

**Queda para después, a pedido suyo:** por qué el buscador no encontró `@martin.koncke` (4) y la fuente
GRATIS para buscar por nombre (5: «investigar alternativas a Brave Search… que no cueste dinero»). Y le
debemos la explicación de los «plazos viejos» (10): las etapas que tenían un plazo puesto antes de que se
sacara «Ponerle un plazo» siguen mandando el aviso diario del lead quieto (`lib/lead-quieto-aviso.ts`), y
ya no hay pantalla para verlos ni quitarlos.

## 0-b. Al 12/10/2026 (chat «CRM», cuenta `claude3`, cortado al 86% semanal)

### ✅ El feedback del 12/10 (28 puntos): HECHO en `bdcee029`

Martín mandó 28 puntos entre las 02:08 y las 02:24 (textuales en la bitácora del área,
`app/admin/dev/crm/bitacora.ts`). Se hicieron en seis frentes con archivos disjuntos (etapas;
tablero, alta y teléfono; cabecera de la ficha; campos de la ficha; MaKo Analyst; Instagram)
más dos revisiones de lo invisible: una de un agente y otra de cinco lentes con tres escépticos
por hallazgo. La segunda confirmó y arregló 9 cosas que perdían o filtraban datos sin un
error. Lo aprendido está en `docs/hallazgos-crm.md` (secciones del 12/10), `hallazgos-ui.md` y
`hallazgos-mobile.md`, y las reglas nuevas en AGENTS.md («Una caché en memoria del server es
de TODOS los inquilinos», «Un control que hidrata un dato guardado no escribe si la persona no
tocó nada»).
**Verificado con:** typecheck (0 errores en lo tocado; los 2 TS2307 de `html-to-image` y
`pptxgenjs` son del `node_modules` del clon) y la suite entera. **NADA se miró en el
navegador**: lo visual lo revisa Martín.
**La migración `0258_lead_ingreso_e_instagram.sql`** (dos columnas nullable en `leads`) se
aplicó a prod ANTES del push: el `select` del tablero las pide, y sin ellas el CRM de todos los
workspaces abre vacío.

### Lo que decide Martín (nada de esto está hecho)

1. **El buscador de Instagram por NOMBRE no tiene fuente.** La Custom Search JSON API de
   Google está cerrada a clientes nuevos y se apaga el 1/1/2027. Hoy anda por @ exacto (Meta
   Business Discovery: sólo cuentas de empresa o creador, y cuando la app «MaKo» tenga
   `instagram_basic`, `instagram_manage_insights` y `pages_read_engagement`) y por el nombre
   pegado (`anaperez`, `ana.perez`, `ana_perez`). Opciones: Brave Search (plan gratis), Serper.dev
   (Google, pago por búsqueda) o ninguna. El código lee `GOOGLE_CSE_KEY` / `GOOGLE_CSE_CX` del
   workspace de plataforma (`lib/instagram-buscar.ts`): cambiar de fuente es tocar ese archivo.
2. **Las bandas Activo / Nutrición / Descartado ocultas ahora se GUARDAN** con los demás filtros
   (`app/crm/filtros-guardados.ts`). Revierte su «siempre activos» del 27/09, por su regla del
   10/10 de que los filtros persisten. Confirmar.
3. **¿Número de lead por negocio (#1, #2…)?** Hoy el id es global (`leads_id_seq`): no hay
   mezcla, pero ws9 ve #2472.
4. **«¿Era calificado?» desaparece** en un funnel sin campaña y sin etapa de reunión (las
   pestañas Tracking y Reuniones dependen del funnel).
5. **Las etiquetas no tienen pantalla para renombrar, cambiar color o archivar**
   (`app/crm/EditorEtiquetas.tsx` quedó sin montar al sacar la pestaña): ¿dónde va?
6. **Los plazos viejos de etapa siguen avisando** sin un lugar donde verlos
   (`lib/lead-quieto-aviso.ts`): ¿se borran?
7. **Una nota la edita o la borra su autor o un admin**: lo decidió el frente, no él.
8. Siguen sin respuesta desde el 11/10: los tres arreglos de la §3 y la decisión 1 de la §5.

### Lo que quedó sin hacer (técnico)

- **Las nutriciones generadas no tienen pantalla para apagarlas**: se sacó la subtab Nutrición
  y `generateFunnel` sigue sumando las de `st0>noshow_r2` y `st0>nocompro` cuando aparece una
  segunda reunión.
- **`quitarColumna` cuenta los leads sobre lo que deja ver el filtro**: con un filtro puesto, una
  columna con leads escondidos se borra sin el «¿seguro?» (`app/crm/CrmBoard.tsx`). Es de antes.
- **La nota desde el teléfono sigue recortando a 4000 en silencio** (`app/m/crm/acciones.ts:80`):
  la regla nueva (`TOPE_NOTA`, rechazar en vez de recortar) no la ve.
- **«confírmalo en Inbox»** sale ahora también en la ficha de escritorio, donde Inbox no existe
  (`lib/mako-turno-app-reglas.ts:272-278`).
- **Dos reglas para «es un usuario de Instagram»**: `usuarioInstagram` (app/crm/campo-inline.ts)
  y `usuarioDeTexto` (lib/instagram-buscar.ts). Difieren en casos raros («___»).
- **El buscador de etiquetas con más de 7 esconde «＋ Nueva»** (`app/_components/etiquetas-cliente.tsx`).
- **La causa del título de /crm es una hipótesis**: `TituloTab` ahora vigila el `<head>` y repone
  «MaKo - CRM», pero nadie midió quién lo pisaba (se sospecha del `loading.tsx` de /crm).
- **Tres clasificadores distintos de «Meta está limitando»** en el repo; el del buscador ahora
  pausa con los códigos 4, 17, 32, 613, 80001 y 80002.

## 0-bis. Al 11/10/2026 18:00 (chat «CRM», cuenta `claude3`, cortado al 85% semanal)

**Medido contra el árbol, no copiado de abajo.** Desde este relevo (10/10 20:48) nadie
trabajó el CRM: los commits que tocan sus rutas son de OTRAS áreas y de pasada
(`7527b8c2` y `b21f16ab` del Dashboard en `app/crm/actions.ts` y `deal-actions.ts`;
`ef8626ce` de MaKo Mobile, que en `app/crm/revisar/[id]/acciones.ts` sólo le puso guarda a
DESCARTAR). Los tres pendientes de la §3 siguen abiertos tal cual: la cohorte del panel
(`app/crm/LeadSheet.tsx:225`), `funnelIds` en `FilaImport` (`app/crm/leads-importar.ts:211`,
ausente también en `app/crm/actions.ts`) y el `marcarAplicada` DESPUÉS de crear
(`app/crm/revisar/[id]/acciones.ts:83`). Se le ofrecieron a Martín sin respuesta todavía;
la decisión 1 de la §5 se le presentó con la (c) recomendada.

### ✅ «Producto» → «Funnel»: HECHO el 11/10 a las 16:26 (`53ba6450`, 63 archivos)

Martín contestó a las 15:55: *«Es así: funnel > oferta > productos»* (el catálogo con precio
sigue siendo «producto») y *«arrancalo ahora»*. Cambió sólo lo que se lee, donde la palabra
nombra un funnel: el CRM entero, el teléfono, «Agregar al CRM» de WhatsApp, Ads Manager, el
paso 2 del Pixel, el CRON y las condiciones de Automations, el paso «⚡ Acción», el aviso del
lead quieto y los mensajes de las acciones del CRM por MaKo. El porqué de cada frontera, en
`docs/hallazgos-crm.md` → «"Producto" → "Funnel"». **Sin verificar en el navegador**: se
verificó con tests (304 pass en los 19 archivos del área) y typecheck.

**Lo que quedó pendiente:** las descripciones de las `.def.ts` de la API de MaKo (esperan a que
`lib/api-mako` no tenga cambios ajenos, porque regeneran `docs/api-mako.md`), la dimensión
«Producto» de los gráficos (`lib/graficos-catalogo.ts`, de la sesión del Dashboard) y los prompts.
Y un rojo que NO es de esta tarea: `tests/mover-etapa-validacion.test.ts` («la opción del modal de
confirmaciones valida») falla contra `lib/mako-confirmaciones.ts`, último commit `ef8626ce`
(MaKo Mobile).

Lo de abajo es lo que se sabía ANTES de hacerlo:

Pedido de Martín, textual (11/10/2026, en el chat de la tab Offer, que la reenvió acá):
*«Las ofertas deben estar atados a los productos del CRM... Y quiero cambiar el concepto
"Producto" por "Funnel" en todos lados... Porque un mismo funnel puede tener varias
"ofertas"... Configuralo de esa manera, para que yo pueda seleccionar en que funnel analizar
o crear una nueva oferta. Mandale como tarea al CRM que lo cambie en todos lados.»*

Lo que hay que saber antes de tocar una línea:

- **En el CRM, lo que la pantalla llama «producto» YA ES un funnel por dentro**: la casa del
  lead es `leads.funnel_id`, los «otros productos» son filas de `lead_funnel`, y el nombre que
  se ve sale del producto principal del funnel (`productoDeFunnel`, `lib/funnels.ts:230`). O
  sea que el renombre CORRIGE el rótulo, no cambia el modelo.
- **Y la relación que Martín describe ya existe en la base**: `producto ──oferta_productos──>
  oferta ──funnel_ofertas──> funnel`. Un funnel con N ofertas es `funnel_ofertas`, no
  `oferta_productos`.
- ⚠️ **Hay un SEGUNDO «producto» que no es un funnel**: el catálogo de `lib/productos.ts`
  (tabla `productos`: precio, único/suscripción), que va DENTRO de una oferta y del que cuelgan
  la entrega de Customer Success, los cursos y el onboarding. Si ése también se llama
  «Funnel», la cadena se lee «funnel → oferta → funnel». Pregunta abierta a Martín.
- **El tamaño**: 40 archivos de `app/crm` nombran «producto» (incluye identificadores) y la
  palabra «Embudo» también se ve en 17 (`CrmBoard`, `EtapasModal`, `CrmToolbar`…). Default
  propuesto: «Embudo» también pasa a «Funnel», porque es la misma cosa.
- **Lo que NO se renombra** (regla de AGENTS.md, como /chatbot → /automations): tablas,
  columnas, `producto_id`/`funnel_id`, keys de settings y de onboarding, áreas y operaciones
  de la API de MaKo. Cambia lo que se LEE. Los tests que miran copy se corren antes de pushear.
- **El chat «Offer»** lee del CRM con `listProductos(true)`; se le avisó que el funnel con sus
  ofertas es `funnels` + `funnel_ofertas`. Si cambia una firma, se le avisa por ese chat.

**Qué es esta parte del producto, para quien nunca la vio.** MaKo es una plataforma de
marketing y ventas que Martín Koncke (el dueño) le vende a negocios. El CRM es la tab
`/crm`: un tablero kanban donde cada tarjeta es un **lead** (un contacto interesado) y cada
columna una **etapa** del recorrido de venta (llegó → agendó una reunión → asistió → pagó →
Ganado). El conjunto de etapas se llama **embudo** o **funnel**, y un negocio puede tener
varios: uno por producto que vende. Los leads entran solos (un formulario de Meta, la
landing del cliente, Calendly/Cal.com, WhatsApp) o importados de una planilla.

Vocabulario que se usa acá y no se explica dos veces:

- **ws1, ws11, ws13**: los negocios (workspaces) por número. **ws1 es Mauricio Bustos, un
  CLIENTE** (el primer cliente, por eso la constante se llama `OWNER_WS` — no es el dueño).
  ws11 es Leila, ws13 es Código Inmobiliario, ws3 es el Cliente de Prueba.
- **La casa de un lead**: el producto donde «vive» (`leads.funnel_id` + `leads.pipeline_stage`).
- **`funnel_id = NULL` NO es «sin producto»**: es el embudo del NEGOCIO, el que viene por
  defecto. Es la trampa número uno del área (abajo).

---

## 1. En qué quedó: lo hecho y DESPLEGADO

Todo lo de esta lista está en `main` y desplegado. Un commit por renglón, salvo donde se dice.

**El cambio de modelo de la ventana: un lead está en VARIOS productos** (`f26c0a94`, 06/10,
mig `0207_lead_funnel`). Antes un lead tenía UN solo `funnel_id`, así que ponerlo en un
segundo producto obligaba a MOVERLO —y moverlo le reseteaba la etapa y, si estaba en Ganado,
le limpiaba la venta—. Martín lo reportó textual: *«Le acabo de dar a un lead a "Mover a
prueba" y se desapareció del producto principal de Mauricio. Eso JAMÁS debe pasar… No se debe
"Mover" se debe agregar al otro producto»*. Ahora: la **casa** sigue en `leads.funnel_id`, y
cada otro producto es una fila de la tabla nueva `lead_funnel` con su etapa propia. «Agregar»,
nunca «mover». Entra por la ficha, el tablero, el lote, «Traer de otro producto», el alta, las
campañas y el opt-in de la landing. El detalle y sus trampas:
`docs/hallazgos-crm.md` → «Un lead en VARIOS productos».

**El tablero y la tabla.** Marca de dónde vas a soltar la tarjeta (`3faab70d`); el tablero
sigue desplazándose con el cursor fuera del kanban (`abbb7a12`); acciones en lote
(`403e9f40`); la tabla deja de ser una lista y se le arrastran las filas (`cceda0d3`,
`ef4dcab5`); la casilla de selección sale al pasar el cursor (`9dc1cf2e`); arrastrar dentro
de la misma columna la deja ahí, con «Ordenar → Manual» (`1703c786`, mig
`0200_lead_orden`).

**Campañas de Meta → producto.** Asignar campañas y conjuntos de Meta a un producto desde
«Lead entrante», para que sus leads caigan en ese tablero (`c2a02c1a`, `ebcfbad8`,
`dc8a8ae6`, `721ad387`, mig `0193_lead_campana_meta`). Y filtrar el tablero por campaña y por
creativo (`117ea2bd`).

**El filtro «Anuncio» (10/10, `686c51be`).** Martín: *«Acá al filtrar, en campaña, y en
Origen, aparece lo mismo. Y falta el filtro de ANUNCIO, para filtrar por un ad específico»*.
Eran dos causas y ninguna estaba en la atribución: (a) el `select` del tablero (`LISTA_COLS`
en `lib/leads.ts`) no pedía `utm_content`, que es donde la landing guarda el id del anuncio
—44 de los 52 leads de ws13 lo tienen, con 13 anuncios distintos—, así que la categoría
existía desde el 06/10 y se escondía sola por no tener opciones; (b) el filtro «Origen»
listaba `origenLegible`, que dice lo más específico que se sepa (anuncio → campaña → canal),
o sea las campañas otra vez. Ahora el filtro usa `canalDeLead` (`app/crm/origen-lead.ts`,
nueva) y el rótulo pasa de «Creativo» a «Anuncio». Lo hizo el chat de **Ads Manager**, no
este, porque no había un chat de CRM abierto.

**La ficha del lead.** Producto en el pop-up, campo Web, un solo WhatsApp, la cara del
contacto, sin «Reactivar» (`ee98547d`, `7f5377dc`, migs `0194_lead_web` y
`0195_lead_foto_guardada`); las fotos de WhatsApp se copian a nuestro bucket porque la URL de
WhatsApp vence a los 10 días (`0418a6ab`); la ficha dice por qué un lead no tiene grabación en
vez de inventar duraciones (`6106544d`); cada campo se edita en el lugar.

**Ganado y plata.** El paso a Ganado pregunta el monto del contrato, la tarjeta muestra la
suscripción («$X/mes») y se corrige en Deal Details (`9f9bfc57`); «Completar datos» ya no
devuelve al lead a la etapa de antes y la ficha se relee al guardar (`65ec2298`); al ganar se
puede invitar al curso, por embudo y **apagado por default** (`77279ea4`).

**Reuniones.** En el editor de etapas se marca qué etapa es una reunión (`adf1ca3d`); el
resumen muestra lo que el lead contestó en Cal.com (`0218e6ed`, `6cd9d5dd`); una reunión nueva
limpia la marca de «no asistió» (`6e75cc0c`); lo que contestó en el formulario de Meta se ve
legible en el pop-up, y su WhatsApp nace apagado (`e21003d6`).

**Etiquetas del CRM** (`f92559e0`, `3f3aadd8`, mig `0224_crm_etiquetas`). Pedido de Martín del
08/10: un CRUD de etiquetas por negocio, vinculables a etapas del CRM, que sirvan en las
condiciones de las automatizaciones, disparen CRON y se espejen en WhatsApp. El espejo
etapa↔etiqueta mira **transiciones** con una foto por workspace, no impone por barrido.

**El plazo de cada etapa y el lead quieto** (`5a4e3f04`, 09/10, tarea #800). Pastilla «Plazo»
en el editor de etapas y aviso diario `crm-lead-quieto` para los que pasaron el plazo, sin
moverlos y sin depender del CRM automático. **Nace sin efecto: nadie tiene plazos cargados
todavía.** En el mismo commit, `/crm/revisar` dejó de perder al contacto repetido de la
landing, sus productos y su campaña.

**Dos cosas de navegación.** El CRM entra directo al tablero, sin el panel de activación
delante (`713661d7`, 08/10: es una decisión más nueva de Martín que le gana a la regla
«onboarding en toda tab»). Y «¿Qué hacer ahora?» volvía a no abrir nada por dos capas en la
pila de modales para una sola pantalla (`b57a53ba`).

**Verificado ahora (10/10 19:04):** `tests/crm-orden-manual`, `crm-revisar-propuesta`,
`lead-quieto`, `crm-origen-lead` y `etiquetas-contrato` → **65 pass / 0 fail**.

---

## 2. Lo que NACIÓ en la ventana (el 05/10 no existía)

- **`lead_funnel`** (mig 0207): la tabla que permite un lead en varios productos, con
  `lib/lead-funnel.ts` (agregar, quitar —que promueve la casa—, mover, lote) y
  `lib/lead-funnel-reglas.ts` (puro, con test).
- **`lead_orden`** (mig 0200): el orden manual de cada columna del kanban. UNA fila por
  (embudo, etapa) con la lista de leads, no una posición por lead.
- **`crm_etiquetas`** (mig 0224): el catálogo de etiquetas de cada negocio y qué lead tiene
  cuál, con el espejo a las etapas y a WhatsApp.
- **`leads.meta_campaign_id`** (0193), **`leads.web`** (0194), **`leads.foto_auto_url` +
  `foto_auto_at`** (0195).
- **El plazo por etapa** y el aviso `crm-lead-quieto` (`lib/lead-quieto.ts`,
  `lib/lead-quieto-aviso.ts`).
- **Las acciones en lote del CRM** (`app/crm/AccionesLoteLeads.tsx`) y el arrastre de filas en
  la vista de tabla.
- **El filtro por campaña, creativo/anuncio** (`lib/campana-atribucion.ts`,
  `app/crm/origen-lead.ts`).
- **La asignación de campañas y conjuntos de Meta a un producto**
  (`lib/campana-asignar.ts`, `lib/campana-funnel.ts`, `lib/campana-traer.ts`,
  `app/crm/campanas-actions.ts`, `app/crm/CampanasModal.tsx`).

---

## 3. Lo que quedó a medio hacer o sin verificar, con el archivo donde vive

### ✅ El filtro «Anuncio» como ÁRBOL — TERMINADO y desplegado (lo escribe el chat de Ads Manager, que lo hizo)

A las 19:04 y 19:11 esta sección lo describía como trabajo sin commitear de otra sesión: era
el chat de **Ads Manager** (cuenta `claude2`) y ya está todo en `main`, desplegado y probado en
el navegador sobre Código Inmobiliario (ws13):

- **`bdbf3707`** — el árbol. Martín: *«No separes el filtro de Campaña y Anuncio... Que dentro
  del filtro de "Anuncio" estén las campañas primero como arbol y dentro se pueda seleccionar
  anuncios de esas camapañas»*. Una sola lista «Anuncio»: cada campaña con sus anuncios
  colgados (`arbolDeAnuncios`), cruce «O» entre los dos niveles (`pasaFiltroAnuncio`), y
  tildar/destildar en `app/crm/arbol-seleccion.ts` (puro, con test).
- **`8a39bb02`** — tres ajustes que pidió al verlo: *«El botón de desplegar debe estar a la
  derecha, no a la izquierda, siempre»*, *«quiero que se abra el desplegable cuando clickeo»*
  la campaña, y *«El ancho del desplegable debe ser más grande. Bajo ningún motivo debe tener
  scroll hacia la derecha»*. El panel pasa a 360 px y su lugar sale de `lugarDelPanel`
  (`app/crm/filtro-panel.ts`): nunca pasa el borde derecho de la ventana y nunca se mete
  debajo de la barra lateral.
- **`f531a170`** — destildar la campaña la vuelve a plegar (tildarla la despliega).
- **`0a55645e`** — se fue la fila de chips debajo de «Filtrar» y su «Limpiar»: *«No debe salir
  los chips de abajo del filtro y el botón de "limpiar" si para eso ya está la notificacion en
  filtros»*. Limpiar es «Limpiar filtros (N)» abajo del menú, igual que en el Plan.
- **`0deedbe5`** — los filtros (etapa, origen, campaña, anuncio y «Ordenar») sobreviven a un F5
  y a irse de la tab: se guardan en el navegador por cliente y por embudo.
- **`bd4251c9`** — la cosecha, en `docs/hallazgos-crm.md` («Campaña y Anuncio pasan a ser UN
  árbol…») y en la bitácora del CRM.

`tests/crm-filtro-ads.test.ts`: 17/17, cada guard probado rompiéndolo. Lo que NO se tocó: a
390 px de ancho la página del CRM ya tiene 55 px de scroll lateral ANTES de abrir el filtro
(medido el 10/10 con el panel cerrado); no es del filtro, y nadie lo pidió todavía.

### Lo demás, con su archivo

- **La COHORTE del panel lateral del lead.** El panel (`app/crm/LeadSheet.tsx:225`) no dibuja
  la cohorte que la ruta sí dibuja (`app/crm/[id]/page.tsx:207`), y hay un ⚠️ escrito en el
  archivo explicándolo: no se arregla pasando la prop, porque sale de `labelMadurez` /
  `estadoMadurezLead` en `lib/leads.ts:1980` (2.600 líneas, con dependencias de servidor) y
  `LeadSheet` es `use client`. Se calcula en el server y baja por props, como hace la ruta.
  Abierto desde el 05/10.
- **El duplicado del opt-in de la landing no lleva los productos.** Falta `funnelIds` en
  `FilaImport` (`app/crm/leads-importar.ts:211`, verificado: no está) y en el importador
  (`app/crm/actions.ts`). Hoy ese lead entra al producto del negocio y una persona lo tiene
  que agregar a mano desde la ficha.
- **Confirmar una propuesta MARCA DESPUÉS de crear**
  (`app/crm/revisar/[id]/acciones.ts:83`). El comentario de arriba lo declara a propósito
  desde el 11/08/2026 (`2d4201b2`) y afirma que «dos pestañas o un doble click crean UN solo
  lote». **Eso no lo pude verificar y la lectura del código dice que no se sostiene para dos
  pestañas simultáneas**: las dos crean y recién después una de las dos `marcarAplicada`
  devuelve false; lo que las salva es el dedup del importador, no la guarda. El molde de
  reclamar-antes-de-ejecutar ya existe en el repo: `lib/api-mako/acciones.ts:137` y
  `lib/api-mako/flujo.ts:172` (`marcarAplicada(id, { en_curso: true })` ANTES).
- **El barrido del espejo etapa↔etiqueta no lo ejecuta ningún test** (lo cubren `planEspejo`,
  que es puro, y guardas de fuente), y reconoce lo que tocó una persona por el **NOMBRE** en
  `lead_audit`: una etiqueta renombrada entre dos corridas se espeja igual. Sin medir contra
  datos reales. Vive en `lib/etiquetas-motor.ts` y en el cron
  `app/api/cron/crm-automatico/route.ts` (`conciliarEspejoEtapas`).
- **Dos leads en Ganado sin `fecha_cierre`** (uno en ws1, uno en ws13). Antes cualquier
  corrección les ponía la de hoy; ahora no se les inventa nada. Se completan a mano.
- **Ninguna de las pantallas de la ventana se miró en un navegador**, salvo el modelo de
  `lead_funnel` (verificado el 06/10 en ws4 con un producto de prueba que después se borró) y
  el grabador de sesiones. El resto —Ganado con monto, etiquetas, plazo por etapa, filtros—
  está verificado por tests y por lectura, no por ojo.
- **Las propuestas pendientes de ws11 (Leila): SIN VERIFICAR hoy.** El briefing del 09/10
  decía «5 contactos de su landing esperando en `/crm/revisar`, uno de hoy». No lo pude
  medir: requiere consultar la base. Lo que SÍ está medido y escrito en el repo es más
  viejo: `app/crm/revisar/page.tsx:15` registra **4 leads reales en `pendiente` en ws11 el
  14/08/2026** (Diana Vallin, Ibrahim Dosal, Marina Olvera, Magdiel Cortes). Si entrás,
  mirá la bandeja antes de prometerle nada a nadie.
- **Las tareas del tablero `Feature: CRM`: SIN VERIFICAR.** Vienen del briefing del 09/10 y
  viven en la base, no en el repo: **#671** («Agendar R2» necesita un Calendly conectado para
  probarlo, y sólo lo tiene el ws1), **#18** (el texto de los follow-ups), **#15** (en qué
  cliente se prende el piloto del CRM automático), **#40** (el planificador del CRM automático
  sigue en R1/R2 y necesita una migración para la reunión N) y **#20** (n8n: se apaga o se
  pasa el acceso).

---

## 4. Las trampas de esta área (esto es lo que ahorra tiempo)

**1. `funnel_id = NULL` ES el embudo del negocio, y el producto del negocio se escribe de DOS
formas.** El tablero del negocio pide sus leads con `.is('funnel_id', null)`; un `.eq()` con
null no matchea nada en Postgres (`= NULL` es NULL, no true) y pierde los leads en silencio
—1.530 al 05/10—. Y como **fila** de `lead_funnel` el producto del negocio va con su id REAL
(la FK no admite NULL). Escribir el id del default en `leads.funnel_id` deja al lead **fuera
de TODOS los tableros**, con el producto correcto escrito y sin un error. Toda escritura de la
casa pasa por `casaParaEscribir` (`lib/lead-funnel-reglas.ts`).

**2. «¿Está en este producto?» se contesta por CASA o por FILA, y hay que mirar las dos.** Los
lectores que lo preguntaban se fueron encontrando de a uno: el dedup del alta, «Traer de otro
producto», el lote, la traída de campañas, la validación del orden manual
(`app/crm/orden-actions.ts:71-77`) y el conteo por etapa — en ése, sin sumar las filas, una
etapa con gente agregada decía 0 y se borraba **sin preguntar**. El próximo lector que
pregunte por `leads.funnel_id` solo, mide la mitad.

**3. Lo que lee SÓLO la casa, a propósito (decisión v1 de Martín):** métricas, el CAPI de
Meta, el CRM automático, MaKo, la nutrición, la etiqueta de WhatsApp y Customer Success. Es lo
que hizo posible cambiar el modelo sin tocarlos. No es un olvido; está escrito en la cabecera
de `supabase/migrations/0207_lead_funnel.sql`. La consecuencia de producto está abierta y la
decide Martín (sección 5).

**4. El tablero no ve una columna que su `select` no pide.** Los mappers de `app/crm/crm-map.ts`
leen campos que `LISTA_COLS` (`lib/leads.ts`) tiene que traer. Una categoría de filtro sin
opciones **no se ofrece** (`app/crm/CrmToolbar.tsx:449`), así que una columna que falta no se
ve como un error: se ve como un filtro que no existe. Eso fue exactamente el bug del 10/10, y
el diagnóstico obvio (la atribución) era el equivocado: su test pasaba. Desde `686c51be` hay
un guard del CABLEADO, derivado del tipo `LeadAtribuible` y del cuerpo real de las funciones,
no de una lista copiada.

**5. Mover un Ganado a una etapa ABIERTA le limpia la venta.** No es un bug suelto: está
escrito y es consciente en `lib/lead-desenlace.ts:38` y `lib/leads.ts:918`. La causa es que
`setPipelineStage` manda SIEMPRE `estado_lead`, y la coerción del desenlace corre cuando el
caller tocó un campo que decide la venta. Pasar de «Facturando» a «Falta pago» entra ahí.
Es una línea para cambiarlo y la decide Martín (sección 5).

**6. La etapa que se VE no es `pipeline_stage`.** Es `pipelineStageOf`: el override o la
derivada de las fechas, y en la mayoría de los leads la columna es NULL. Agendar por Calendly,
marcar asistencia o ganar desde la ficha mueven la etapa **derivada** sin escribirla. Por eso
el espejo de etiquetas mira transiciones comparando `pipelineStageOf(antes)` contra después, y
no la columna. (El hallazgo viejo «stageMeta miente» es de esta misma familia.)

**7. El techo de 1000 filas de PostgREST.** Un `.select()` suelto anda perfecto hasta que la
tabla pasa las 1000 y desde ahí pierde datos sin un log. Ya se pagó en este área: el CRM
mostró 4 ganados de 13 (US$52.700) porque `_listLeads` no paginaba. Se lee con `leerTodo` /
`leerPorPaginas` (`lib/supabase-paginado.ts`) y con un orden que termine en una columna
ÚNICA. `.limit(2000)` no sube el techo.

**8. `docs/hallazgos-crm.md` tiene 7.771 líneas: NO se abre entero.** Se busca con `Grep` de
la ruta del archivo que vas a tocar — cada entrada trae adentro su línea `**Vive en:**`. Abrirlo
completo son decenas de miles de tokens para encontrar una cosa.

**9. El fin de línea es POR ARCHIVO en este clon.** `app/crm/[id]/page.tsx` es LF y otros del
mismo directorio son CRLF. Un script de parcheo contesta «0 coincidencias» sobre un ancla
copiada carácter por carácter del propio archivo. Y un guard con regex sobre fuente va con
`\r?\n`, nunca `\n` solo.

**10. La herramienta de búsqueda reescribe `/` como `\` en el CONTENIDO que devuelve.** Un
`//` que vuelve como `\` es la firma. `Grep` sirve para ENCONTRAR, no para CITAR: antes de
reportar un bug que depende de un carácter, releé la línea con `Read`.

**11. Hay varias sesiones sobre este MISMO clon y el árbol no tiene un estado, tiene una
hora.** Un rojo de un test puede no ser tuyo (hoy pasa: ver sección 3). Antes de acusar a
nadie: `git status --short` de los archivos que el error nombra, y `git show HEAD:<archivo>`
para saber si el bug existe en HEAD o sólo en el disco de alguien que está tipeando. Y
**nunca** `git add -A` ni `git commit` pelado: va `git commit <ruta> -F <msg>`.

**12. El próximo número de migración NO es 0225.** En disco hay hasta `0242_canales_zernio`,
y además existen **DOS archivos con el número 0223** (`0223_curso_papelera` y
`0223_flujo_grafo`), que es la colisión clásica de dos sesiones eligiendo el mismo número.
Antes de nombrar una migración nueva: `git pull` y `ls supabase/migrations/ | tail -5`.

---

## 5. Qué espera una decisión de Martín

Ninguna de estas se decide sola y ninguna se re-pregunta si ya está contestada en el chat.

1. **Ganar en un producto AGREGADO no marca al lead como ganado.** Es la v1 a propósito (manda
   la casa), y la consecuencia es que si alguien compra el segundo producto, esa venta no
   existe para Revenue, el CAPI de Meta ni Customer Success hasta que ese producto sea la casa.
   **Opciones:** (a) dejarlo así y que el equipo cambie la casa al ganar; (b) que ganar en
   cualquier producto marque al lead como ganado y la plata se sume por producto; (c) que el
   monto viva en la fila de `lead_funnel` y Revenue sume casa + filas.
2. **La casa de un opt-in de la landing con varios productos es el PRIMERO tildado** en la
   configuración. **Opciones:** (a) alcanza el orden de los tildes; (b) hace falta marcar
   explícitamente cuál es el principal.
3. **Mover entre dos etapas abiertas limpia la venta** (Facturando → Falta pago).
   **Opciones:** (a) dejarlo; (b) limpiar sólo cuando el estado CAMBIA de verdad (Ganado →
   abierta). Es una línea en `setPipelineStage`.
4. **El «Deshacer» de «Monto de cierre» sobre un lead abierto no hace nada**, porque el monto
   decide la venta y el lead no tiene `cerro`. **La pregunta:** ¿el monto puede vivir en un
   lead abierto? Hoy ya lo escriben por otro camino `lib/pagos.ts` y el editor del deal.
5. **La etiqueta que pone una ETAPA no dispara automatizaciones** (sólo dispara ponerla
   directo: la ficha, la API, un paso «⚡ Acción»). Es una decisión del constructor, tomada
   para que mover 200 leads en lote no disparara 200 WhatsApps. **Se la puede dar vuelta.**
6. **Prender en cada cliente lo que nació apagado:** la página de gracias → Ganado, invitar al
   curso al ganar, el WhatsApp de las respuestas del formulario de Meta. Nada nace prendido, a
   propósito.
7. **Los plazos por etapa están vacíos para todos.** El aviso del lead quieto existe y no
   avisa de nada hasta que alguien cargue plazos. ¿En qué cliente se arranca?
8. **Los datos mal cargados de ws11 (Leila), que son suyos y no del código:** Nadia #2605
   tiene como mensualidad 4.235,29, que es el TOTAL del contrato (con 12 cuotas de 4.235,29
   pendientes, eso infla el MRR un 85%); de Fabi #2606, ¿los 444 son USD o pesos?; y Fabi
   sigue en dos productos (Nora #2610 ya no). **Sin verificar hoy**: viene del briefing del
   08-09/10.
9. **Las tareas #671, #18, #15, #40 y #20** del tablero `Feature: CRM` (ver sección 3).

---

## 6. Correcciones al briefing anterior

Lo que el briefing previo daba por abierto y **ya no es cierto**:

- **«`AGENTS.md` sigue citando el opt-in viejo como ejemplo de "un alta que crea N filas"»** —
  **FALSO desde el 09/10.** El commit `5a4e3f04` le agregó el párrafo que lo corrige: *«⚠️ Y
  ANTES DE ESCRIBIR EL BUCLE, PREGUNTÁ SI SON N COSAS O UNA COSA EN N LUGARES. El opt-in de
  arriba ya no crea N fichas: desde el 06/10/2026 (`f26c0a94`) crea UNA y le AGREGA los otros
  productos»*. Verificado en `AGENTS.md`, sección «Un alta que pasa a crear N filas…».
  ⚠️ **`docs/hallazgos-crm.md:7086` todavía lo lista como pendiente** — ese archivo no es
  mío en esta corrida y lo dejé como está; el que lo toque, que lo saque.
- **«Hay que arreglar el filtro de anuncios» / «es una hipótesis sin medir»** — **HECHO el
  10/10 a las 17:08** (`686c51be`), con los datos medidos en ws13 (52 leads, 44 con
  `utm_content`, 13 anuncios). Y ya quedó viejo otra vez: hay un pedido posterior del mismo
  día, en curso y sin commitear (sección 3).
- **«Confirmar una propuesta no marca antes de crear» como simple pendiente** — es más matizado:
  está **decidido a propósito** desde el 11/08 con su comentario, y lo que no se sostiene es la
  afirmación de ese comentario sobre dos pestañas simultáneas (sección 3).
- **Los dos rojos de la suite que el briefing del 09/10 reportaba como ajenos**
  (`tests/curso-tareas-secciones` y `tests/inbox-agregar-al-crm`) ya no son el problema del
  momento. El único rojo que vi hoy en esta área fue `tests/crm-filtro-ads.test.ts` a las
  19:04, ajeno y transitorio: a las 19:11 ya estaba verde (sección 3). **Si lo reportás,
  fechá la lectura y volvé a medir antes de mandar el mensaje** — re-correrlo cuesta
  segundos y acusar a la sesión de al lado de romper el repo cuesta un turno de ella.
