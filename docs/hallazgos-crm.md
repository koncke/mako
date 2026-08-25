# Hallazgos del CRM

Lo que hay que saber antes de tocar el kanban, la ficha del lead, el wizard "¿Qué hacer
ahora?", el selector de horarios, el worklist de "Datos sin marcar" y los requisitos de
etapa. **No es un changelog**: es lo que no se deduce leyendo el código.

**Acá va solo lo que vive en código del CRM** (`app/crm/**`, `app/leads/**`, `lib/leads.ts`,
`lib/pipeline.ts`, `lib/funnel-etapas.ts`, `lib/stage-requirements.ts`, `lib/queries.ts`,
`lib/crm-auto.ts`, `lib/google-calendar.ts`, `lib/auto-reuniones.ts`). Lo que se aprendió en
estos frentes pero vive en otro lado está en su documento — ver
[Lo que vive en otro documento](#lo-que-vive-en-otro-documento). El índice es
[hallazgos.md](hallazgos.md).

⚠️ **Parte de este material es de segunda mano.** Las entradas fechadas entre junio y
agosto de 2026 que dicen `~nombre-de-corrida` salen de los journals de las corridas
multi-agente (134 de 260 nunca habían escrito nada en el repo), no de una relectura del
código de hoy. Antes de actuar sobre una, verificá contra el código: varias ya están
arregladas, y donde el rescate lo sabía, lo dice. El registro completo de las corridas está
en [corridas-multiagente.md](corridas-multiagente.md).

## Lo que más muerde acá

- **Cal.com no es Calendly**: otra empresa, otra firma, otro payload — y su embed manda dos mensajes
  por la misma reserva → [Cal.com es OTRO producto](#-calcom-es-otro-producto-no-una-variante-de-calendly).
- Un error de lectura se pinta como **"✓ Todo marcado"**: el peor bug del CRM porque no
  parece un bug. → [Un error de lectura terminaba en un tilde verde de todo al día](#un-error-de-lectura-terminaba-en-un-tilde-verde-de-todo-al-día)
- La hora **se calculaba en el huso del navegador** y le llegaba mal al invitado por mail.
  → [El instante lo calcula el server con la zona del workspace](#el-instante-lo-calcula-el-server-con-la-zona-del-workspace)
- El **combobox de hora tenía tres caminos de commit** y cada uno guardaba algo distinto de
  lo que decía el eco. → [El eco decía una hora y Enter guardaba otra](#el-eco-decía-una-hora-y-enter-guardaba-otra)
- Importar un CSV **corrompe leads en silencio** y reporta éxito. → [Importar un CSV corrompe leads en silencio y reporta éxito](#importar-un-csv-corrompe-leads-en-silencio-y-reporta-éxito)
- Calendly **se pinta conectado** y el webhook tira las reuniones con 200 OK. → [Calendly se pinta conectado y el webhook descarta las reuniones con 200 OK](#calendly-se-pinta-conectado-y-el-webhook-descarta-las-reuniones-con-200-ok)
- Cambiar **cómo se deriva una etapa** cambia quién entra a las listas que filtran por
  etapa. → [Las etapas de reunión salen del funnel, no de un ternario](#las-etapas-de-reunión-salen-del-funnel-no-de-un-ternario)
- El funnel es **uno por workspace por construcción**: un índice único, tres upserts con
  `onConflict: 'workspace_id'` y un `.maybeSingle()` que degrada a `DEFAULT_PIPELINE` sin
  log. → [El funnel es UNO por workspace por construcción, no por convención](#el-funnel-es-uno-por-workspace-por-construcción-no-por-convención)
- Y el diagnóstico obvio es el equivocado: **el funnel no ubica los leads**, los ubica un
  `switch` con 11 keys fijas. → [El diagnóstico obvio: «el funnel ubica los leads». No los ubica](#el-diagnóstico-obvio-el-funnel-ubica-los-leads-no-los-ubica)

---

## Reglas del dueño que gobiernan todo el CRM

Salen de lo que el dueño repitió (a veces cuatro veces) en 48 sesiones. No son estilo: son
requisitos de producto, y un PR del CRM que las rompe se devuelve.

### Todo movimiento queda en el historial, sin excepción, y firmado por quien lo hizo

Hubo leads sin **un solo** cambio de status registrado, y cambios hechos por la IA que no
dejaron rastro. La regla, textual: *"Recuerda el tema del historial. siempre."* (17/07),
*"TODO debe quedar en el history"* (07/08), *"No actualizaste el HISTORIAL de cambios en
cada tarea o proyecto… Eso es muy grave… Eso tiene que ser regla siempre"* (17/07).

Lo que implica: (a) también los movimientos que hace el **sistema** y los que se corrigen a
mano — si algo se arregla a mano, se registran también los pasos de la corrección;
(b) el actor va explícito y con su motivo: si lo hizo la IA firma **MaKo con ícono de IA**,
no con foto de usuario ni "vos" (*"debería aparecer, y que justamente la IA o MaKo hizo
esos cambios"*, 14/07); (c) la única excepción escrita es el Deshacer, ver
[Deshacer no es historia](#deshacer-no-es-historia).

**Vive en:** `lib/etapa-historial.ts` · `lead_audit` · `lib/leads.ts`

### Ningún cambio es solo para el dueño

*"los cambios que hacemos tienen que impactar siempre para clientes también. Nunca razones
que es solo para el dueño"* (22/07), *"todo esto tiene que modificarse también para los
clientes, que les aparezca lo mismo, hoy en los clientes, sigue igual que antes"* (12/07),
*"no entiendo porque la vista de superadmin y cliente son diferentes en la tab de Plan,
deben ser lo mismo"* (13/07).

La vista de super admin y la del cliente son **la misma pantalla**. Todo lo que se
construye para el dueño se construye para los clientes **en la misma pasada**. Dos cosas
del CRM nacieron rompiendo esto y siguen rotas: la
[conexión de Google Calendar](#-la-ayuda-de-horarios-nació-owner-only-solo-ws1-puede-conectar-google-calendar)
y el [camino de marcar reunión a mano](#-marcar-reunión-a-mano-está-muerto-salvo-para-el-dueño).

### Antes de cambiarle algo a un lead, siempre una confirmación que previsualiza

*"Siempre tiene que saltar una confirmación, y más si se le va a cambiar algo a un lead"*
(06/08). Y la confirmación **muestra lo que va a pasar**, no pregunta a ciegas: *"antes me
confirmes que hay un modal de «confirmación» en donde pueda previsualizar todas las tareas
que le está por mandar… Porque de lo contrario, se van a crear muchas tareas que pueden
estar mal"* (17/07). Aplica a toda acción irreversible o generada por IA.

### Si tiene que apretar F5, está mal

*"Porque hoy tengo que hacer un F5 para verlo"* (04/07). La ficha y el kanban reflejan el
cambio al instante, sin recargar.

### Volver devuelve exactamente de donde saliste, con el scroll

*"cuando le doy a «Volver» me lleva al kanban, pero debería llevarme a la vista de «Datos
sin marcar» incluso en el mismo lugar de scroll que estaba"* (05/07). Cerrar un paso te
devuelve a la vista anterior y a su posición, no al tablero genérico.

### Un mismo dato se edita con un solo formulario, esté donde esté

*"veo que en esa misma tab de «Datos sin marcar» los formularios son diferentes, cuando
deberían ser los mismos ya conocidos"* (04/07). Kanban, ficha del lead y tabla de datos sin
marcar comparten el formulario, no lo forkean.

### El form pregunta primero lo que se puede automatizar, y no pregunta lo que ya sabe

*"Siempre los form PRIMERO me deben preguntar las cosas que se puedan automatizar"* (23/07)
— buscar en Fathom / Calendly / Calendar, leer el contrato o el doc. La carga manual es el
**último recurso**, solo para lo que no se encontró. Y del otro lado: *"No me debe preguntar
«¿Era un lead calificado?» si lo estoy moviendo a GANADO"* (23/07). **Una pregunta absurda
es un bug.** Lo mismo con MaKo: *"Si lo puede hacer MaKo, siempre debería, solo me debe
preguntar en caso de NO encontrar respuesta"* (19/07).

### Sin límites arbitrarios

*"no limites las horas, que se pueda agendar a la madrugada si quieren"* (07/08). Ni horas
de agenda, ni ventana de días de un público, ni cantidad de resultados. **El tope lo pone
la API, no nosotros.** (Ojo: el rango 07–22 de la grilla es lo contrario de esto y sigue
abierto, ver [el pendiente del selector](#-el-selector-de-hora-sigue-sin-desplegable-y-con-las-horas-limitadas).)

### Un bug no se arregla para el caso reportado, se barre en todos los registros

*"Y claro, revisa esto mismo en TODOS los leads, para asegurarnos de que no pase con ningún
otro"* · *"Soluciona eso, primero rapido con ese lead y luego con todos"* (05/07). Después
del fix va el barrido de los datos ya corrompidos.

### Ningún dato cargado a mano es ley

*"Siempre si hay docs que traen mejor data se debe sobre escribir. Ningún dato a mano es
ley"* (27/07). Si llega un documento con mejor información, pisa lo cargado a mano.

### No declarar hecho lo que no se ve funcionando en la app

*"no veo que se haya marcado el progreso en la app. Eso no lo hiciste… revisa porque el
fallo está de tu lado"* (14/07), *"Nada funciona… Tienes que realmente validar y hacerlo
bien"* (02/08), *"Hay muchos gráficos que están mal, te invito a que hagas Claude in Chrome
para verificarlo"* (19/07). Además: **probá vos** — mandá los mensajes, mové un lead y
devolvelo, cambiá el nombre de una campaña pausada. No le devuelvas la prueba al usuario
(*"No funciona… Por favor, prueba tú."*, 20/07). Hay permiso permanente de preview. Y si él
dice que falla, **el fallo es nuestro hasta que se pruebe lo contrario**.

Toda prueba que salga hacia afuera va a **martinkoncke@gmail.com** y **+5493764673479**
(14/07).

### Resolver en una pasada, y si hace falta, con multiagentes

*"Realmente no entiendo en que te estas gastando tantos tokens y aún no solucionas las
cosas que te pedí… cuantos prompts mas para que lo arregles"* (07/08) es la queja que más
se repite al final del período. La salida que él mismo pide: *"corre un multi agente y haz
bien esta vista… puedes utilizar la preview de chrome, los multi agentes, todo"* (30/06),
*"si tienes que correr 10000mil multi agentes para hacer esto bien… pero hazlo bien"*
(22/07), *"ya dimos muchas vueltas, no se que tengas que hacer, si tenes que lanzar multi
agente o lo que sea, pero solucionalo"* (30/07). **Cuando algo ya se corrigió dos veces y
sigue mal, no va otro parche: va una corrida grande que lo cierre.** Prefiere que gastes
recursos antes que entregar a medias.

### Nada de jerga interna ni acento argentino en lo que ve el cliente

*"no quiero que tenga lenguaje complejo o que haga referencia a cosas internas de la app…
Que no ponga «La fabrica de creativos»"*, *"«Vieron tus videos», nuevamente no se entiende.
¿Qué videos? mis reels? mis ads? Sería, vieron tus anuncios"*, *"Baja a tierra a un lenguaje
simple… no quiero tecnicismos como la matriz 3x3"* (30/06). Si el nombre no se entiende
solo, se cambia. MaKo usa acento argentino **solo cuando asesora**; todo lo que produce
**para** el cliente va en español plano (*"No pongas «¿Tenés algún otro documento para
sumar?»"*).

Y en el CRM, la nomenclatura es fija: **Reunión / R1 / R2**, jamás junta, J1 ni J2
(*"Siguen apareciendo estados como en «J1» o «J2» cuando ya habiamos dicho que todo ahora es
«R1»"*, 23/06; volvió a pedirlo el 03/07 por `agendaj2`). Las columnas de base todavía se
llaman `fecha_junta_1` / `agendaj2`: **eso no se muestra nunca en pantalla.**

### Antes de construir algo grande, contá cómo lo vas a presentar

*"antes de hacer el onboarding, dime como lo piensas presentar, así te lo apruebo"* (10/07).
Y antes de construir de cero, buscá un open source que ya lo tenga: *"podemos COPIAR codigo
de proyectos open source como este: github.com/TryGhost/Ghost. Copiar el diseño y las
features… Eso nos ahorrará muuucho trabajo"* (06/08).

### La IA vive dentro de la tab, no en una pantalla aparte

*"una nueva tab con un nuevo chat, cuando ya existía un «Pregúntale a MaKo»"* (10/07). No se
crea una tab/chat nuevo para algo que ya existe. Todo se configura con **prompts y botones**;
nada de configuración manual en ninguna feature (30/06).

---

## Leads: mover de etapa, validar y escribir

### 🔴 El CRM de una clienta abría la agenda de Calendly de OTRO cliente

**Síntoma (13/08/2026, visto en producción por el dueño):** en el CRM del workspace 11
(Leila), el botón «Agendarla por Calendly» abría el embed de **Mauricio Bustos** —su firma,
su foto y su oferta «Calificación para Programa Directivo»— dentro de la app de ella.

**Causa.** `app/crm/calendly-widget.ts` es un módulo `'use client'` y tenía adentro:

```ts
const CAL_URLS: Record<string, string> = {
  agenda:   'https://calendly.com/mauriciobustoseguia/60min',
  agendaj2: 'https://calendly.com/mauriciobustoseguia/calificacion-…',
};
```

Un módulo de cliente **viaja en el bundle y no tiene noción de workspace**: eso se le
servía igual a todos. `calendlyUrlFor(stageKey)` tomaba solo la etapa como parámetro — la
firma ya decía que no podía estar bien, porque la respuesta depende de QUIÉN mira.

**Qué rompía, y es más que la vista.** El prospecto de ella reservaba en el calendario de
él. Y ella no se enteraba nunca: la reserva entra por el event type de él, así que
`wsPorIdentificador('calendly', …)` la rutea al workspace de él y en el de ella la fecha no
aparece jamás. El lead queda «agendado» sin fecha, cae en «Datos sin marcar», y el motivo
real es invisible desde la pantalla. Sumado: se le muestra a un cliente el nombre, la cara y
la oferta de otro.

**La regla: un módulo `'use client'` no puede decidir nada que dependa de quién está
mirando.** Ni una URL, ni un teléfono, ni un email, ni un id. Si el dato cambia por
workspace, lo resuelve el server — y si no está configurado, se DICE; nunca se cae al del
dueño. Eso último es el mismo criterio que `credWs`, que hace bien la mitad difícil: el
fallback a `process.env` corre **solo** si `w === OWNER_WS`.

**Cómo quedó.** `openCalendlyEn(url, …)` recibe la URL como parámetro **obligatorio** (sin
default, ningún call-site puede volver a abrir «la agenda de alguien» sin decir de quién);
`linkDeAgendaAction` la resuelve en el server contra la cuenta del workspace; y
`app/crm/page.tsx` decide qué etapas se agendan por Calendly mirando si ESE cliente tiene
cargado su event type. Sin config, la opción no se ofrece y el aviso dice qué falta.

La red es `tests/sin-datos-del-dueno-en-bundle.test.ts`: recorre todo `app/`, y en cada
módulo `'use client'` falla si encuentra una agenda personal de Calendly hardcodeada
(ignorando el CDN, la API y la documentación). La única excepción está listada **por ruta
exacta** y con su porqué: `/vsl` es la landing pública donde MaKo se vende a sí mismo, no
vive adentro del workspace de nadie.

**Lo que quedó SIN hacer, del mismo barrido:** `lib/closing.ts:117-121` tiene la identidad
del dueño hardcodeada para TODOS los workspaces —
`INTERNAL_EMAILS = {martinkoncke@…, tejadomartin@…}` y `INTERNAL_DOMAINS = {elevate.com.mx}`.
No filtra datos, pero clasifica mal: a otro cliente, una llamada con alguien de
`elevate.com.mx` se le descarta como «interna», y su propio dominio NO se excluye nunca —
así que sus reuniones de equipo entran como candidatas a venta y se pagan a Claude. El
arreglo real es que «mi equipo» sea un dato del workspace, y eso es materia del onboarding.

**Vive en:** `app/crm/calendly-widget.ts` · `app/crm/actions.ts` (`linkDeAgendaAction`) ·
`app/crm/page.tsx` (`calendlyStages`) · `app/crm/CrmBoard.tsx` ·
`tests/sin-datos-del-dueno-en-bundle.test.ts` · pendiente: `lib/closing.ts:117-121`

### El worklist no bajaba la columna, así que el arreglo del día anterior era inerte

**Síntoma (13/08/2026, reportado por Leila en producción):** marca los datos que le
faltaban a un lead, el wizard contesta **«Datos actualizados»**, y el pendiente sigue ahí
diciendo *«Faltan: Monto de cierre · Plan de pagos»*. Marcarlo de nuevo no cambia nada.

**Y el diagnóstico obvio era el equivocado, dos veces.** Primero parecía un problema de
refresco —el modal dice que guardó y la lista no se entera—, pero `onDone` ya llama a
`router.refresh()` y la action ya hace `bust(TAG.leads)` + `revalidatePath`. Después
parecía que el guardado fallaba: tampoco. Contra la base, el lead 1885 estaba **perfecto**
(`estado_lead='ganado'`, `venta_tipo='suscripcion'`, `suscripcion_monto_usd=40`,
`monto_cierre_usd=null` — que es lo correcto para una recurrencia indefinida).

**Causa: quien leía.** `PENDIENTES_COLS` (`lib/queries.ts`) enumera A MANO las columnas
que baja el worklist, y no tenía `venta_tipo` ni `suscripcion_monto_usd`. `faltantesDeLead`
las recibía como `undefined`, concluía «esto es un pago único sin monto» y volvía a pedir
las dos cosas — **dejando inerte la corrección de suscripciones commiteada el día
anterior**, que solo se veía en la ficha porque la ficha usa otra proyección.

**La regla: una proyección de columnas escrita a mano y un motor que lee campos de esa fila
son dos listas que nadie ata, y cuando se separan no falla nada.** La columna ausente llega
`undefined` y el motor decide con el dato en blanco: mismo tipo, misma forma, conclusión
distinta. No hay excepción, no hay log, no hay nada.

⚠️ Y el fallback que parecía cubrirlo **no cubre este caso**: `leerLeadsDePendientes`
reintenta con `'*'` cuando una columna listada **no existe en la base** (migración
pendiente), no cuando **falta en la lista**. Las dos fallas se parecen y solo una tiene red.

La red nueva es `tests/pendientes-columnas.test.ts`: lee el cuerpo de `faltantesDeLead` y de
`deriveStageKey`, extrae cada `lead.<campo>` y falla si alguno no está en `PENDIENTES_COLS`.
Verificado en los dos sentidos — sacando las columnas, el test rompe con el nombre exacto
del campo que falta.

**Vive en:** `lib/queries.ts` (`PENDIENTES_COLS`) · `lib/leads.ts` (`faltantesDeLead`) ·
`tests/pendientes-columnas.test.ts`

### El dato estaba cargado, pero en OTRA columna: el cierre por suscripción no se podía mover

**Síntoma (10/08):** el wizard de "Mover a Miembro activo" mostraba en su propio resumen
**«Suscripción · $40/mes · indefinida»** y, abajo, *«Para pasar a Miembro activo todavía
falta cargar: Monto de cierre»*. Sin salida: el paso que reclamaba el dato era el mismo que
la persona acababa de contestar, y «Completar lo que falta →» devolvía al mismo lugar.

**Causa:** una venta recurrente (#363, mig 0115) guarda su importe en
`suscripcion_monto_usd` (el MRR) y deja `monto_cierre_usd` en **null a propósito** — una
recurrencia indefinida no tiene total. `stepsForStage` solo miraba `monto`. El wizard ya
sabía de suscripciones (el paso, el resumen, `tienePlan`); el corte del monto, no.

**La regla:** cuando un dato pasa a poder vivir en **dos columnas**, la validación es lo
primero que se queda vieja — porque no falla al escribir, falla al leer, y el síntoma
aparece en una pantalla que ya muestra el dato correcto. Buscá los call-sites del corte,
no los del campo nuevo. Acá eran tres (`valoresDeRequisitos` en el wizard,
`faltantesParaMover` para los callers sin pantalla, `faltantesDeLead` para "Datos sin
marcar"), y con dos arreglados el lead volvía a aparecer como incompleto un segundo
después de moverse.

Y el importe alternativo se pasa **solo si la venta ES recurrente hoy**: pasarlo siempre
haría que cambiar una suscripción a pago único diera por cargado un monto que ya no existe.

**Vive en:** `lib/stage-requirements.ts` (`suscripcionMonto` en `StageReqValues`) ·
`app/crm/actions.ts` (`valoresDeRequisitos`) · `lib/leads.ts` (`faltantesParaMover`,
`faltantesDeLead`) · `tests/mover-etapa-validacion.test.ts`

### ⚠️ El historial de cambio de Status del lead queda vacío

**Síntoma:** se mueve un lead y la sección "Status" del historial no muestra nada. *"Pero
donde lo estas creando… Porque el change de Status sigue vacio… Corrigelo rapido con este
lead y con el resto"* (07/08) — es el **último turno** del lote sobre el CRM, y sigue
abierto.

**Regla:** entra por [Todo movimiento queda en el historial](#todo-movimiento-queda-en-el-historial-sin-excepción-y-firmado-por-quien-lo-hizo);
el fix incluye el barrido del resto de los leads, no solo el reportado.

**Vive en:** `lib/etapa-historial.ts` · `lead_audit` · `app/crm/actions.ts`

### ⚠️ Jorge Negrete está en GANADO y no aparece en ninguna vista de negocio

**Síntoma:** el lead marcado como ganado **no suma al total vendido** ni entra en "Camino a
los 14 cierres" — ni en la vista COMERCIAL ni en la GENERAL. Reportado el **29/06** y
todavía pedido el **06/08** (*"Soluciona el error con jorge negrete"*). Es el caso testigo
de dos problemas distintos: el lead llegó a GANADO **sin las reuniones marcadas**
(*"Jorge Negrete está en GANADO cuando aún no se han marcado las reuniones"*) y el agregado
comercial no lo cuenta.

**Vive en:** `lib/queries.ts` (agregados de la vista comercial y `getObjetivoProgreso`) ·
`lib/leads.ts`

### ⚠️ No hay búsqueda avanzada en el CRM

**Síntoma:** no se puede buscar por ID ni con acentos. Pedida el 06/08 pidiendo copiar el
código de la búsqueda del board `/plan`, y reclamada al día siguiente: *"tampoco la busqueda
avanzada en el CRM… Te lo pedí"* (07/08).

**Vive en:** `app/crm/CrmBoard.tsx` (toolbar) · el original a copiar está en el board `/plan`

### ⚠️ El closer y el setter no se auto-asignan aunque haya una sola persona

**Decisión (05/08):** si hay **una sola** persona en el workspace, closer y setter se asignan
solos; al sumar un rol, el otro sigue auto-asignándose. A futuro, configurable por
producto/oferta. **Por qué:** Mauricio está solo en su workspace y aun así el CRM se lo
pedía como dato faltante en todos los leads.

**Estado:** pedido el 02/08 y el 05/08 seguía roto (*"Aún no funciona que el CRM marque
automáticamente el Setter y Closer"*). Relacionado: MaKo se agrega **por default como
setter** en todo workspace y queda asignado a todos los leads en nutrición que no sea
Manual — *"Ningún Setter debería estar en vacío"* (15/07).

**Vive en:** `lib/leads.ts` · `lib/queries.ts` (faltantes) · `app/crm/actions.ts`

### ⚠️ La foto de perfil de los leads nunca apareció

Pedida el 23/06 y nunca implementada. **Vive en:** `app/crm/LeadSheet.tsx` ·
`app/crm/CrmBoard.tsx`

### ⚠️ No se pueden cargar los datos fiscales propios para elegirlos en "Facturado por"

Pedido el 04/07: subir los propios datos fiscales en Configuración y después elegirlos en el
campo `Facturado por` del Deal. **Vive en:** `app/leads/[id]/deal-actions.ts` ·
`/configuraciones`

### ⚠️ `sinR2Motivo` se puede perder en silencio

**Síntoma:** se escribe el motivo de no tener R2, después se cambia `huboR1` a `false`, y el
texto queda escrito en pantalla pero no viaja.

**Causa:** se manda solo si `huboR1 !== false`.

**Vive en:** `app/crm/StageMoveDialog.tsx`, en `confirmar()`

### ⚠️ El wizard de etapa se monta dentro del backdrop de la ficha

**Síntoma:** un click en el backdrop del wizard **cierra los dos**: se pierde lo tipeado y
también la ficha. Preexistente, no lo trajo la migración a `WizardShell`.

**Vive en:** `app/crm/LeadSheet.tsx:187` (`onClick={onClose}`) y `:254`

### ⚠️ `valoresDeRequisitos` es el superset de `faltantesParaMover` y debería construirse sobre ella

Los mismos valores más lo que el wizard acaba de tipear y los pagos. Hoy son **dos listas
que hay que mantener iguales a mano** — exactamente "una cosa, dos lugares". Tocarla es
tocar el camino que usa toda la UI; queda un `PENDIENTE` en el comentario.

**Vive en:** `app/crm/actions.ts:276`

### ⚠️ `faltantesParaMover` decide con `hoyEnTijuana()` fijo

Alimenta `yaPaso()`: define si una reunión "ya pasó" y por lo tanto si se exige
asistencia/Fathom. No es una cohorte persistida sino **gating**, y desde que MaKo valida,
además **traba o destraba un movimiento** un día antes o después para un workspace lejos de
Tijuana. Es la punta de la migración de las primitivas de fecha
([hallazgos-infra.md](hallazgos-infra.md) §5).

**Vive en:** `lib/leads.ts:1570`

### El motivo de pérdida se heredaba del movimiento anterior

**Síntoma:** un lead que ya estuvo en `perdido` se movía a `descal` sin que nadie pidiera el
motivo — quedaba el viejo.

**Causa:** el validador miraba si **había** un motivo, no si era **de este movimiento**.

**Fix:** `StageReqValues` parte en tres — `motivo` (el persistido), `motivoNuevo` (el de ESTE
movimiento) y `etapaActual` (origen; `undefined` = "el caller no está moviendo"). El corte:

```ts
const entrando = !!v.etapaActual && v.etapaActual !== stageKey;
const motivoValido = entrando ? v.motivoNuevo : (v.motivoNuevo ?? v.motivo);
```

**Regla:** la distinción vive en el **movimiento**, no en el valor. Un caller que no sabe de
dónde viene el lead manda `etapaActual: undefined` y no repregunta — por eso
`faltantesDeLead` no lo manda y "Completar datos" nunca le reclama el motivo a un lead ya
perdido.

**Alcance real, para calibrar:** `lib/leads.ts:371` limpia `motivo_perdida` cuando el lead
sale de perdido/descal. La herencia solo ocurre **perdido↔descal**; el escenario "se pierde,
se recupera, se vuelve a perder" no la produce.

**Vive en:** `lib/stage-requirements.ts` · `lib/leads.ts:371`

### Quien valida y quien pinta tienen que derivar la etapa con la misma función

**Síntoma:** la ficha abría "Completar datos" y el guardado se bloqueaba pidiendo un motivo
que la pantalla no mostraba.

**Causa:** el server calculaba la etapa de origen con `pipelineStageOf` (override **crudo**)
y la ficha con override **chequeado contra el funnel vigente**. Divergen exactamente en el
caso masivo que este repo documenta (`lib/leads.ts:1627`: **686 leads en ws1** con override a
etapas que su funnel ya no tiene). Con `pipeline_stage='reactivacion'` huérfano y
`estado_lead='perdido'`, el server veía `entrando = true` y exigía motivo nuevo.

**Regla:** un override puede apuntar a una etapa que el funnel ya no lista; `etapaVigenteDe`
es el **único** lugar donde eso se resuelve.

**Vive en:** `valoresDeRequisitos` (`app/crm/actions.ts:276`) usa `etapaVigenteDe(before,
stagesMove)` de `lib/funnel-etapas.ts`

### Quién revalida al mover un lead, y quién no

`setPipelineStage` acepta `requisitos?: 'validar' | { omitir: motivo }`, y **el default es no
validar**. No es pereza:

- **Sin el parámetro** (los que vienen de un formulario: el wizard del CRM,
  `app/crm/actions.ts`, `createLead`, los upserts de Meta/Calendly). El CRM ya validó con lo
  que la persona **acaba de tipear**, y eso todavía no está persistido: revalidar contra la
  base le volvería a pedir el dato que está escribiendo.
- **`'validar'`** (motor automático, MaKo, el desenlace de nutriciones, el bloqueo de un
  contacto): chequea **antes de escribir nada**. El orden importa — un movimiento rechazado
  no puede dejar `estado_lead` sincronizado con una etapa a la que el lead nunca llegó.
- **`{ omitir }`**: mueve y deja en `lead_audit` una línea `'Etapa sin validar'` con el
  porqué. **Fail closed**: `omitir` vacío vuelve a validar, y sin poder leer el lead no mueve.

**Regla:** "¿este caller valida?" no se contesta por caller, se contesta por **de dónde sale
el dato**. Si el dato está en la pantalla y no en la base, validar contra la base es un falso
negativo.

**Costo, para que nadie lo descubra en un incidente:** `'validar'` agrega una lectura de
`funnel_config` por movimiento y no está cacheada. Irrelevante de a uno; en una corrida del
cron con muchos T2 son N queries de una fila. La salida es memoizar `getFunnel` por request,
**no** aflojar la validación.

**Vive en:** `lib/leads.ts` (`setPipelineStage`) · `lib/stage-requirements.ts`

### Un lead no cambia de etapa sin los datos que esa etapa exige

**Decisión (21/06 y 03/07).** Mover a una etapa que exige información **abre su detalle,
despliega lo que falta y no deja guardar**; cancelar revierte la etapa. Los datos exigidos
incluyen cualificación para CAPI, link de Fathom, plan de cuotas, contrato y motivo si se
agendó fuera de Calendly. **Y todas obligatorias, ninguna blanda.**

**Por qué:** *"si muevo un lead a «Ganado», solo me pide el monto del cierre"* y
*"Jorge Negrete está en GANADO cuando aún no se han marcado las reuniones"*. La validación
tiene que forzar la carga **en el momento**, no dejar el dato colgado: esos campos son los que
después alimentan los mensajes automáticos de WhatsApp/Email.

**Vive en:** `lib/stage-requirements.ts` · `app/crm/StageMoveDialog.tsx`

### "Se perdió" escribía "asistió a la reunión" sin que nadie lo dijera

**Síntoma:** el CRM registraba «asistió» a una reunión cuyo desenlace nadie conocía — el dato
exacto que el pendiente existía para averiguar.

**Causa:** el pendiente 'R' del worklist existe justamente porque nadie sabe si la reunión que
ya pasó ocurrió. Elegir "Se perdió" copiaba `transitionFor(etapa,'perdido')`, y esa transición
del funnel generado trae `asistioJ1: true` (`...asist(p.key, true)`); como el paso
`asistenciaR1` no estaba en la lista de requisitos, `StageMoveDialog` caía en la rama
`{ asistioJ1: move.asistioJ1 }` y el server lo persistía. Después `updateLead` forzaba
`calificado = null` por incoherencia.

**Fix (invierte la lógica):** la asistencia se declara primero como HECHO, y `salidasDeEtapa`
**fuerza el flag a false** en las salidas aunque la transición del funnel diga lo contrario.
Eso está comentado en el código a propósito: el próximo que lea `transitionFor` va a pensar
que es un bug y lo va a "arreglar" de vuelta.

**Vive en:** `lib/pipeline.ts` (`asist`/`DEFAULT_TRANSITIONS` y `salidasDeEtapa`) ·
`app/crm/StageMoveDialog.tsx` · `app/crm/CrmBoard.tsx` (`confirmarQueHacer`) ·
*2026-08-06 ~wizard-que-hacer-ahora-y-horarios-de-google*

### La pregunta que decía "es la última vez que te lo podemos preguntar" era la única que no persistía

**Síntoma:** se contesta "¿Era un lead calificado?" en un pendiente de R2 y el dato se borra
solo, en silencio.

**Causa:** `updateLead` tiene una regla de coherencia: `if (merged.asistio_j1 !== true)
merged.calificado = null`. En un pendiente de R2 (lead con `fecha_junta_2` cargada por
Calendly y `asistio_j1` en null porque nadie marcó la R1), el wizard mandaba
`{ asistioJ2: true, calificado }` — nunca toca `asistio_j1` — así que la regla borraba el
`calificado` recién contestado. Y el lead se iba a Perdido, donde `stepsForStage` corta y
`faltantesDeLead` devuelve `[]` para siempre: nadie lo vuelve a ver, y se pierde también el
evento de CAPI que la pregunta existía para alimentar.

**Regla:** antes de **preguntar** un campo, verificar que el camino de escritura no lo vaya a
descartar por una coherencia aguas arriba. El fix fue un guard `qhCalificadoPersiste` que solo
muestra la pantalla cuando el dato va a sobrevivir, **sin tocar** la regla de `leads.ts` (que
gobierna todas las escrituras del repo).

**Vive en:** `lib/leads.ts:381-383` (regla de coherencia) · `app/crm/CrmBoard.tsx`
(`qhCalificadoPersiste`) · `app/crm/actions.ts` (`completeStageMoveAction`) ·
*2026-08-06 ~wizard-que-hacer-ahora-y-horarios-de-google*

### Desbloquear un contacto no es "volver a abrirlo": machaca el estado real del lead

**Síntoma:** bloquear y desbloquear un contacto de WhatsApp deja al lead en `abierto` sin
etapa, aunque estuviera ganado, perdido, en R2 o no-show.

**Causa:** el unblock hace `updateLead({ estado_lead:'abierto', motivo_perdida:null })` y
`pipeline_stage = null` **sin condición**. El bloqueo tampoco persistió el estado anterior, así
que el round-trip bloquear→desbloquear es **lossy por diseño e irrecuperable**.

**Regla:** revertir una acción es **restaurar lo que había**, no escribir el default. Si no
guardaste el estado previo, condicioná la reversión a que la acción siga siendo la que causó el
estado actual (`estado_lead === 'descalificado' && motivo_perdida === 'Bloqueado en
WhatsApp'`).

Decisión relacionada (23/06): un lead que **responde** entra automáticamente a "Nutrición -
Manual"; **bloquear** pide motivo y lo pasa a "descalificado", con opción de desbloquear. El
estado del lead se deriva del hecho real, no de que alguien se acuerde de marcarlo.

**Vive en:** `app/api/whatsapp/contacts/[id]/block/route.ts:47-48` · `lib/leads.ts:1117` ·
*2026-06-23 ~auditoria-inbox-whatsapp-chatwoot*

### Guardar las cuotas marca el lead como ganado

**Síntoma:** tocar el plan de pagos de un lead que todavía no cerró **lo cierra sin
preguntar**.

**Causa:** `saveCuotasAction` hereda de `saveLeadPlanManual`, que además de reemplazar las
cuotas no pagadas setea `estado_lead='ganado'` y `cerro=true`. Por eso la UI de Deal Details
solo la llama si `cuotasDirty`.

**Regla:** cualquier caller nuevo tiene que saberlo antes de usarla como un simple "guardar
cuotas".

**Vive en:** `app/leads/[id]/deal-actions.ts` (`saveCuotasAction`) · `lib/leads.ts`
(`saveLeadPlanManual`) · *2026-07-03 ~deal-details-contrato-y-comprobante*

### `stageMeta` cae a `stages[0]` y pinta un dato falso

Usar **`stageMetaOpt`** y guardar la **KEY**, no el label. **Vive en:** `lib/pipeline.ts:533`

### Duplicación conocida que no es bug

`app/crm/actions.ts:916` repite el bucle del helper: ordena por `id` y tiene su comentario. Es
duplicación deliberada, no un bug.

---

## El funnel: de dónde salen las etapas

### ⚠️ El editor de funnel nunca tuvo botón de Deshacer

Pedido el 21/06 y reclamado el mismo día: *"Aún no me aparece el botón de deshacer"*.
**Vive en:** el editor del funnel (botón lápiz + Funnel)

### ⚠️ La nomenclatura del funnel sigue mezclada

Se pidió unificar a **"Avanza / Nutrición / Pérdida"** y quedó pedido **dos veces**
(*"Te olvidaste de esto"*): seguía diciendo "Pipeline" en algunos lados (21/06). Del mismo
lote, `agendaj2` seguía apareciendo en pantalla el 03/07. Ver
[la regla de nomenclatura](#nada-de-jerga-interna-ni-acento-argentino-en-lo-que-ve-el-cliente).

### Las etapas de reunión salen del funnel, no de un ternario

`lib/funnel-etapas.ts`: `etapasDeReunion` filtra `kind === 'reunion'`, `slotDeReunion` mapea
índice → `{numero, cual, colFecha, colAt}` y devuelve **`null` desde el índice 2** porque
`leads` solo tiene dos slots. Sin funnel cae a `DEFAULT_PIPELINE`.

**El fix trajo dos colaterales, y ese es el punto de la entrada:**

1. **Población nueva de items 'R'.** Pasar del override crudo a la etapa efectiva hace
   aparecer todos los leads derivados parados en una reunión pasada (Calendly nunca escribe
   `pipeline_stage`). El `push` del item 'R' ocurre **antes** del filtro de
   `pendientes_ignorados` y del `if (faltan.length === 0) continue`, así que son permanentes y
   no ignorables (`CrmBoard.tsx` excluye `tipo==='R'` de "Ignorar todos"). **Se dejó así a
   propósito**: es decisión de producto explícita — el lead está *trabado* y silenciarlo lo
   deja colgado para siempre.
2. **Se caían de BulkHigiene.** El item 'R' viajaba con `faltantes: []`, así que todo lead que
   pasaba de 'A' a 'R' desaparecía del "asignar Setter en lote" — justo los que más lo
   necesitan — y su fila perdía el detalle. **Arreglado**: los faltantes se calculan **antes**
   de decidir el tipo de item y viajan en el 'R', con el detalle en el mensaje
   (`lib/queries.ts:2224`).

**Regla:** cambiar cómo se **deriva** una etapa cambia **quién entra** a las listas que filtran
por etapa. Antes de mergear, preguntá a qué población se le acaba de aplicar una regla que
nadie eligió para ella.

**Vive en:** `lib/funnel-etapas.ts` · `lib/queries.ts:2224` · `app/crm/CrmBoard.tsx`

### El fallback de una función es parte de su contrato

**Casi entra un bug de datos al unificar el mapeo índice→R1/R2 en una sola función.**
`etapasDeReunion(stages?)` cae a `DEFAULT_PIPELINE` cuando no le pasan funnel, y eso es
correcto para quien **consulta** ("¿esta etapa es una reunión?"). Es veneno para quien
**construye o mide** el funnel: con esa versión, `generateFunnel` sobre un pipeline vacío o sin
reuniones heredaría `firstMeeting = 'agenda'` del funnel por defecto y le pintaría a ese
workspace transiciones "Recupera" / "Reagenda" hacia una etapa **que no tiene**. Lo mismo
`funnelReqInfo`: le pediría al worklist una R1/R2 inexistente.

**Regla:** al unificar N copias en una función, el fallback de la copia más tolerante se lo
lleva todo el mundo. Si dos callers necesitan respuestas distintas ante "no hay datos", son
**dos funciones**, y la estricta es la que se usa para escribir.

**La última copia estaba en el cliente:** `app/crm/CrmBoard.tsx` decidía R1/R2 con
`l.stage === 'agendaj2' ? 'r2' : 'r1'` — la key del funnel **por defecto** hardcodeada en una
pantalla que se le muestra a cualquier workspace. Un `grep` de `kind === 'reunion'` no la
encontraba: **la duplicación no siempre se parece al original.**

**Vive en:** `lib/funnel-etapas.ts` expone las dos — `reunionesDe(stages)` estricta (la usan
`generateFunnel` en `lib/pipeline.ts` y `funnelReqInfo` en `lib/stage-requirements.ts`) y
`etapasDeReunion(stages?)` tolerante. `slotPorIndice(i)` devuelve `null` desde el índice 2

### `funnelReqInfo` deriva el nivel de `kind`, y `kind` solo lo traen las etapas GENERADAS

Pasarle `DEFAULT_STAGES` "pelado" da **nivel 0 a todo** y cualquier movimiento pasa sin que
nada avise. El fallback correcto es `generateFunnel(DEFAULT_PIPELINE, []).stages`. **Lo
encontró un test, no la revisión.**

**Vive en:** `lib/stage-requirements.ts:118`

### El funnel del cliente no dice nada de su negocio: el onboarding le aplica siempre la plantilla 0

`app/api/onboarding/route.ts` aplica `FUNNEL_TEMPLATES[0]` hardcodeada, **sin mirar el canal
declarado**. Verificado en prod: ws1, ws3, ws10 y ws11 tienen EXACTAMENTE el mismo pipeline
(lead | Agenda R1 | Agenda R2 | Facturando | Ganado).

**Consecuencia práctica:** usar `funnel_config` como evidencia de cómo vende un cliente ("tiene
etapa Agenda R2, entonces hace dos llamadas") es un **falso positivo**: le cayó por default.
Para saber cómo vende hay que mirar `negocio.fase.diagnostico` (canal) y el panorama del
Archivero.

**Vive en:** `app/api/onboarding/route.ts` · `funnel_config` · *2026-08-01 ~poda-board-leila-ws11*

### `pipeline_stages` es una tabla muerta que se sigue arrastrando

Ningún archivo de `lib/` ni de `app/` la lee: el pipeline real vive en
`funnel_config.data.pipeline`. Encima su PK es `(key)` **global**, así que clonarla a otro
workspace revienta con duplicate key. Sigue viva en `TENANT_TABLES` y en las listas de
copia/reset. No migrarle nada, no clonarla, y si aparece alguna personalización vieja,
llevarla a `funnel_config`.

**Vive en:** `supabase/migrations/0020-0025` · `lib/workspace.ts` (`TENANT_TABLES`) ·
`lib/datos-mau.ts` · `lib/reset-workspace.ts` · *2026-08-01 ~mapa-clonar-workspace*

### El usuario solo edita la fila "Avanza"

**Decisión (22/06).** Las etapas de **Pérdida** son fijas para todos y las de **Nutrición** se
generan automáticamente por etapa; el editor por lista se elimina. **Por qué:** *"todos los
funnels tendrán las mismas opciones de Pérdida"* y el resto se deduce, así se evita que el
usuario tenga que configurar flechas. (Antes había dudado de la tab entera: *"¿fue rebuscarse
mucho?"*.)

**Decisión anterior, que sigue en pie (21/06):** el funnel se edita en **su propia tab** (botón
lápiz + Funnel), donde se agregan/modifican/eliminan etapas y se conectan con flechas tipo
diagrama de flujo, y eso impacta en "Datos sin Marcar". La app **es** un funnel y sus etapas: el
recorrido posible de cada lead tiene que ser editable en un solo lugar.

### Se creó la etapa "Nutrición - Reactivación", y los workspaces nuevos arrancan con templates

**Decisión (05/07).** Un lead en "No responde / Perdido" **no se abandona nunca**, y esto no se
puede configurar a mano en cada workspace nuevo. La caída a "Nutrición - Reactivación" se valida
por **antigüedad del lead**, no solo por la etapa (15/07): *"eran leads de hace mucho tiempo…
les vamos a invitar a que agenden y capaz que ni se acuerdan de qué se trata el servicio"*.

**Decisión (29/06), del mismo par:** "Nutrición - Manual" **lleva deadline**; si vence sin
movimiento, el lead se pone en semáforo rojo y vuelve a "Datos sin marcar". Sin deadline el
estado manual se convierte en un pozo donde los leads se quedan quietos y nadie se entera. Y
marcar un lead como "Nutrición - Manual" **exige una confirmación con MOTIVO** antes de poder
guardar: es la salida de emergencia del funnel, y sin justificación se usa para tapar cualquier
cosa.

### El funnel modela el RECORRIDO y no los ACTIVOS, y eso deja al chatbot inventando

**Vive en:** `lib/pipeline.ts` (`Stage`, `:29-42`) · `lib/leads.ts:1439-1472` (`getFunnel`/`saveFunnel`) ·
`supabase/migrations/0025_funnel_config.sql:15-20`

Una etapa dice a dónde llega el lead. No dice **con qué**: si hay landing, si hay video, si
entró por un formulario de anuncio o por un mensaje frío, si se agendó solo o lo agendaron.
`Stage` no tiene ningún atributo de activo y el brief del negocio (`lib/onboarding.ts:17-49`)
tampoco lo pregunta. Grep de `tiene_landing|canal_adquisicion|prospecc` sobre `lib/` y `app/`:
cero.

Lo más cerca que hay es `leads.origen_lead`, que es **por lead y descriptivo** (ws1: 790
`instant_form` + 65 `calendly`; ws11: 27 `NULL`). Sirve como evidencia para sugerir, nunca
como fuente.

Quien paga la cuenta es todo lo que genera contenido a partir del funnel. El caso completo
—una clienta que prospecta en frío grabando un audio que dice «vi que dejaste tus datos en el
anuncio»— está en
[hallazgos-comunicacion.md → El Chatbot y el funnel](hallazgos-comunicacion.md#el-chatbot-ex-setting--chat-agent-y-el-funnel-del-cliente).

**Dónde va el campo cuando se agregue:** `funnel_config.data` es **jsonb libre** (hoy guarda
`{pipeline, suppressed}`, `lib/leads.ts:1439,1456-1459`), así que un eje nuevo **no necesita
migración**. Y `null` («no declarado») tiene que ser distinto de `[]` («declarado vacío»):
hoy `getFunnel` cae a `DEFAULT_PIPELINE` con `agenda:'reunion'` tanto si no hay fila como si
hubo **error de Supabase** (`:1455,1460` · `lib/pipeline.ts:316,318`), o sea que un cliente
nuevo, o cualquiera durante una caída, recibe el funnel del dueño y nadie se entera.

*2026-08-10 ~chatbot-funnel-leila*

### El canal declarado solo se propaga al funnel por uno de los dos caminos

**Vive en:** `app/api/onboarding/fase/route.ts:35,38` · `app/api/onboarding/route.ts:261-274`

`app/api/onboarding/route.ts` (el wizard) propaga el canal al funnel; el hub
(`fase/route.ts:38`) llama solo a `setDiagnosticoFase` y **no propaga**. Rehacer el
diagnóstico desde el hub deja el funnel viejo, en silencio — que es el mismo síntoma que la
sección de arriba, por la otra puerta. Va a **una** función que llamen los dos. Y `:35`
castea `body.canal as CanalId` sin validar contra `CANALES`.

*2026-08-10 ~chatbot-funnel-leila*

### El funnel es UNO por workspace por construcción, no por convención

**Síntoma que se va a ver.** «Quiero un segundo funnel para el otro producto» suena a
agregar una fila. El insert falla con `23505` y, si alguien saca el índice, la app deja de
mostrar el funnel de nadie sin un solo error en el log.

**Causa — son cuatro cerrojos, no uno, y tres son invisibles al compilador:**

1. `create unique index funnel_config_ws_uk on funnel_config (workspace_id)` — una fila por
   cliente, garantizado por la base.
2. **Tres** escritores upsertean con `{ id: ws, workspace_id: ws }` y
   `onConflict: 'workspace_id'`: `saveFunnel`, `clonarConfigDelDueno` y el `copiarTabla`
   marcado `singleton: true` de datos-mau. El `id` de la fila **es** el id del workspace.
3. `getFunnel()` lee con `.maybeSingle()`. Con dos filas eso devuelve `PGRST116`, que el
   `catch` convierte en `DEFAULT_PIPELINE` con `origen: 'error'` — **sin log**. Todo el CRM
   pasa a pintar el pipeline high-ticket genérico y nadie se entera. `getFunnel` no tiene
   ningún test.
4. `funnel_config` está **exceptuada** de `TENANT_TABLES` (el filtro va a mano, y el
   contrato lo fija un test). Hoy olvidarse el `.eq` da «no encuentra»; con N filas da **el
   funnel de otro cliente**. El proxy no lo ataja.

**Regla.** Multi-funnel no es una columna: es cambiar la identidad de la fila. La salida
aditiva es una tabla `funnels` con PK propia y `funnel_config` intacta durante la
transición — dropear el índice único primero rompe los tres upserts en la ventana que hay
entre la migración y el deploy, y el toast del editor le echa la culpa a «la migración
0025».

**Vive en:** `supabase/migrations/0054_workspaces.sql:93-95` · `lib/leads.ts:1472-1530` ·
`lib/clonar-config.ts:49,95-109` · `lib/datos-mau.ts:174,503-505` · `lib/workspace.ts:57` ·
`tests/tenant-tables-contract.test.ts:16` · `app/funnel/FunnelEditor.tsx:136-142`

### El diagnóstico obvio: «el funnel ubica los leads». No los ubica

**Síntoma.** Al planificar multi-funnel, el instinto dice que hay que prefijar las stage
keys por funnel para que dos pipelines no se pisen.

**Causa real.** `deriveStageKey` **no lee `funnel_config` en absoluto**: es una función
pura sobre `estado_lead` + fechas + asistencias, con las 11 keys canónicas escritas en un
`switch`. El funnel editable define qué COLUMNAS se pintan y cómo se llaman, no dónde cae
un lead. Por eso un cliente con etapas propias hoy ubica sus leads a mano, y por eso
`stageMetaOpt` cae a `DEFAULT_STAGES` para resolver labels de keys que el funnel del
workspace ya no lista — ese fallback es **intencional**, sostiene el historial.

**Regla.** El ámbito de un lead lo tiene que dar una columna (`leads.funnel_id`), **nunca
el nombre de la key**. Prefijar invalidaría todos los `pipeline_stage` guardados, todo
`lead_audit` y `leads.etapa_vista`. Las 11 canónicas significan lo mismo en todos los
funnels y conviene declararlas catálogo cerrado.

**Vive en:** `lib/pipeline.ts:887-909` (`deriveStageKey`/`pipelineStageOf`) ·
`lib/pipeline.ts:859-868` (`stageMetaOpt`) · `supabase/migrations/0122_etapa_vista.sql`

### Lo que SÍ está listo para multi-funnel: el modelo, entero

Contra lo que parece, casi nada de `lib/pipeline.ts` hay que reescribir. `generateFunnel`,
`salidasDeEtapa`, `sanearPipeline`, `mergeFunnelData`, `parseEntradas`, `parseEvento`,
`templateDeCanal` y los templates reciben el pipeline **por parámetro** y no tocan
Supabase. Lo único acoplado a «hay uno» son las **funciones de acceso** de `lib/leads.ts`.
Los ~10 tests del funnel sobreviven sin tocarse.

**Regla.** Si el `data` de la tabla nueva conserva la forma exacta de `funnel_config.data`
(`{pipeline, suppressed, entradas, evento, umbrales}`), el merge que impide que un tecleo
borre `umbrales` se hereda gratis. Cambiar la forma del jsonb «ya que estamos» es tirar esa
red.

**Vive en:** `lib/pipeline.ts:194-266,351-465,569-617,822-826`

### `leads.producto_id` es una columna muerta desde la 0117

La migración del catálogo de productos agregó `leads.producto_id`, y **ninguna línea de
TypeScript la lee ni la escribe**: no está en el tipo `Lead`, ni en `LISTA_COLS`, ni en
`COLS_FILTRO`, ni en `CrmLead`. `seedProductosDesdeOferta()` tampoco tiene un solo
call-site. O sea: la mitad declarada de #374 —«el deal hereda el pricing del producto»— no
existe, aunque la tabla y el CRUD estén.

Al cablearla, dos trampas ya identificadas en el wizard «Ganado»: el paso `producto`
necesita **condición de faltante propia** (`productoId == null`), nunca colgada de
`'monto'` —`stepsForStage` no pide `'monto'` cuando ya hay uno y el bloque entero se cae
del payload, que es el bug que hoy deja `venta_tipo` inasignable—, y hay que pedirlo **solo
al ENTRAR** a la etapa o «Datos sin marcar» reclama producto sobre cientos de cierres
viejos.

Y el precio va como **snapshot, no como JOIN**: el producto siembra
`venta_tipo`/`monto_cierre_usd`/`suscripcion_*` y esos campos del lead siguen siendo la
verdad histórica. `producto_id` es solo la dimensión para agrupar.

**Vive en:** `supabase/migrations/0117_productos.sql:34` · `lib/productos.ts:89-109` ·
`lib/leads.ts:40-159,238-244` · `lib/stage-requirements.ts:20-26,226-242,268-274` ·
`app/crm/actions.ts:192-227,463-474`

### La nutrición enrola por etapa y filtra en memoria: dos funnels se cruzan mensajes reales

**Síntoma que va a aparecer.** Con dos funnels que tengan una etapa homónima (`noshow_r1`,
`nutri`), un lead del funnel A entra en una secuencia del funnel B y le llega un WhatsApp o
un email que no le corresponde. Sin error y sin log.

**Causa.** `leadsDeCohorte('etapa_actual')` trae **todos** los leads abiertos del workspace
y filtra en memoria con `pipelineStageOf(l) === etapa`. No hay ámbito de funnel en ninguna
parte de la consulta. Lo mismo `planLeadAuto`, que hardcodea `'lead'`, `'nutri'`,
`'manual'` y `'reactivacion'`: con un funnel de etapas propias no dispara T1..T6 **en
silencio**, y el cliente concluye «el CRM automático no anda».

**Regla.** `nutricion_secuencias.funnel_id` tiene que estar en el **mismo release** en que
un cliente real pueda crear su segundo funnel. Es el único riesgo de todo el proyecto que
sale de la pantalla y le llega a una persona. Nota que ayuda: `nutricion_secuencias.clave`
**no** es unique global —la 0054 ya la pasó a `(workspace_id, clave)`—, así que sumar
`funnel_id` al índice es un afloje y ninguna fila existente lo viola.

**Vive en:** `lib/nutricion.ts:285-313` · `lib/crm-auto-plan.ts:69-138` ·
`lib/secuencias-huecos.ts:27-79` · `supabase/migrations/0054_workspaces.sql:99-101`

### La etapa del lead NO está guardada, y eso es lo que hace barato el multi-funnel

**El hecho.** `deriveStageKey` (`lib/pipeline.ts:886-903`) calcula la etapa con un switch sobre
`estado_lead` y después mira `fecha_agenda`/`fecha_junta_1`/`fecha_junta_2`/`asistio_j1`/
`asistio_j2`/`nutricion_realizada`; `pipelineStageOf` le antepone el override `pipeline_stage`.
**Ocho columnas, todas del intento, ninguna persistida como «etapa».**

**Por qué importa.** Es lo que permite meter una tabla de participaciones sin reescribir el CRM:
si `leads` sigue trayendo esas ocho columnas con los valores de la participación **vigente**,
`pipelineStageOf(lead)` sigue devolviendo lo correcto y los ~1.200 lectores que pasan por él,
por `etapaVigenteDe` o por `LISTA_COLS` no se tocan. Todos describen «el intento vigente», que
es exactamente lo que describen hoy.

**Regla.** El espejo es viable **porque la etapa es derivada**. Si alguien alguna vez persiste
la etapa como columna de verdad, esa propiedad se pierde y el plan de participaciones se vuelve
un big-bang. Y el espejo necesita **un solo writer**: hoy hay ≥32 escrituras a `leads` en 15
archivos (12 solas en `app/crm/actions.ts`), y colapsarlas en un choke point va ANTES de la
migración, no después.

**Vive en:** `lib/pipeline.ts:886-908` · `lib/leads.ts:238-244` · `app/crm/actions.ts`

### Un lead que reagenda después de perderse pisa su propio historial

**Síntoma.** Un lead 'perdido' aparece en la columna Perdido con una R1 **futura**. Y una
semana cerrada hace meses cambia de número sola en las cohortes.

**Causa.** `upsertLeadFromCalendly` matchea por `telefono_normalizado` y después por email, y
en modo webhook en vivo escribe `basePayload` —que incluye `fecha_agenda`, `fecha_junta_1` y
`junta_1_at`— sobre la fila existente, **sin tocar `estado_lead`**. Y `deriveStageKey` hace
short-circuit por `estado_lead` antes de mirar las fechas. Resultado: la etapa no se mueve, la
fecha de la PRIMERA reunión se pierde para siempre, y el lead migra retroactivamente de cohorte.

**Regla.** Un lead que vuelve no es el mismo intento. Hasta que exista `lead_participaciones`,
cualquier writer que pise fechas de reunión sobre una fila existente tiene que preguntarse qué
pasa con `estado_lead` — el short-circuit lo vuelve invisible.

⚠️ **Verificado contra prod el 2026-08-10, y el resultado BAJA la urgencia:** cero leads
perdidos/ganados/no-responde con una R1 futura. El mecanismo está en el código, pero **no tiene
ninguna víctima viva**. Las 4 filas de `lead_audit` con `Fecha R1` sobrescrita tampoco lo
prueban: un reagendo manual escribe lo mismo. Vale como razón de diseño para las
participaciones; no vale como urgencia. *(Y esa es la mitad del hallazgo que más importa: un
bug leído en el código no es un bug medido en la base, y la diferencia decide si se adelanta o
no una fase entera.)*

**Vive en:** `lib/leads.ts:943-1016,1054-1079` · `lib/pipeline.ts:886-903`

### Dos guards impiden reactivar dos veces al mismo lead

`l.pipeline_stage !== 'reactivacion'` (`lib/crm-auto-plan.ts:126`) y
`if (lead.pipeline_stage === 'reactivacion') return 'skip'` (`lib/crm-auto.ts:211`) hacen que un
lead reactivado una vez **nunca** se pueda volver a reactivar. Es exactamente el escenario que el
dueño describe como real («no cerró, meses después aparece de nuevo»), bloqueado por
construcción. Y el reloj de T6 usa `diasEntre(hoy, l.updated_at)` (`:127`), que se mueve con
cualquier escritura a la fila, no con la actividad del lead.

**Vive en:** `lib/crm-auto-plan.ts:126-127` · `lib/crm-auto.ts:211`

### El corte por funnel de las métricas de arriba del embudo no existe, y no es un TODO

`getFunnelEtapas` (`lib/queries.ts:1182-1290`) mezcla dos fuentes: `imp_click` y `click_form`
salen de `marketing_metrics_daily`/meta_insights, que **no tienen dimensión de funnel ni de
producto**; la fila puente `form_agenda` toma entrada del workspace entero y salida de `leads`.
Filtrar solo la salida da un **porcentaje falso**, no un dato faltante. Igual el CAC
(`:664-693`): el spend de Meta no tiene atribución a funnel en ninguna tabla.

**Regla.** Cuando una métrica no se puede cortar por una dimensión, la pantalla lo **dice**, en
tinta normal. Rotularla «en construcción» sugiere que el número va a llegar; acá no llega sin
atribución en la ingesta.

**Vive en:** `lib/queries.ts:664-693,1182-1290`

*2026-08-10 ~productos-x-funnels (15 agentes) + ~modelo-oferta-producto-funnel (11). El plan:
[productos-y-funnels-plan.md](productos-y-funnels-plan.md) · El modelo:
[modelo-oferta-producto-funnel.md](modelo-oferta-producto-funnel.md)*

---

## Datos sin marcar y el motor automático

### Un error de lectura terminaba en un tilde verde de todo al día

**Síntoma:** el peor de todos, porque no parece un error: la pantalla decía
"✓ Todo marcado — datos al día" cuando en realidad **no se pudo leer**.

**Causa:** el paginado nuevo hizo que `pagos` y `lead_respuestas` **tiraran** donde antes
degradaban en silencio (`const { data } = await ...` sin chequeo). Pero
`_getPendientesDeMarcar` no atrapa y los dos consumidores sí: `app/crm/page.tsx` con
`.catch(() => [])` y `app/general/page.tsx` con `allSettled`. Romper fuerte río arriba y
tragarse la excepción río abajo produce **un falso all-clear en el lugar que el producto trata
como autoridad**.

**Fix:** `pagos` y `lead_respuestas` son lecturas **accesorias**: degradan con `avisos.push()`.
`Pendientes` suma `aviso?: string`, `page.tsx` lo propaga y `CrmBoard` pinta banner si la lista
es parcial y reemplaza el ✓ verde si está vacía. La lectura de `leads` sigue rompiendo fuerte,
a propósito.

**Regla:** si una lectura pasa a lanzar, **seguí la excepción hasta la pantalla**. Un `.catch`
que devuelve `[]` convierte "se rompió" en "no hay nada", y son cosas opuestas.

**Vive en:** `lib/queries.ts` · `app/crm/page.tsx` · `app/general/page.tsx` ·
`app/crm/CrmBoard.tsx`

### ⚠️ Completar los "Datos sin marcar" sigue siendo de a uno

Pedido el 15/07 con **464 pendientes** en pantalla: completarlos **en loop**, no de a uno,
aprovechando que muchos se repiten (mismo setter, etc.). Del mismo día, sin cerrar: que **MaKo
los resuelva solo antes de preguntar** — *"creí que eso ya estaba hecho"*.

**Vive en:** `app/crm/CrmBoard.tsx` (BulkHigiene) · `lib/queries.ts` ·
`lib/crm-auto.ts`

### ⚠️ Los leads con "Nose" o "-" en Empresa no se pueden ignorar en lote

Pedido el 15/07: limpiar esos valores basura dejando el campo **vacío**, que es lo que permite
ignorarlos en lote. **Vive en:** `lib/leads.ts` · script de limpieza

### Un fallo de Chatwoot se escribe como señal de negocio y quema el único intento automático

**Síntoma:** un lead queda en nutrición manual vencida **indefinidamente** y el motor no lo
vuelve a mirar nunca.

**Causa:** en T3, si Chatwoot falla (rate limit, timeout, 5xx) el catch pone `inbound = -1`. Ese
-1 no entra por `if (inbound > 0)` y cae al else, que crea igual la confirmación con clave 'T3';
lo único que distingue "no pudimos leer" de "no hay mensajes" es el **texto de la nota**. Y como
`existeConfirmacion` filtra SOLO por `(lead_id, clave)` sin mirar el estado, la corrida
siguiente devuelve `'skip'` **para siempre**, aunque Chatwoot ya se haya recuperado. T3 es el
único camino automático que reclasifica un lead en 'manual'.

**Regla:** un **no-resultado** no puede compartir la clave anti-loop con un **resultado**.

**Vive en:** `lib/crm-auto.ts:250-298` · `lib/mako-confirmaciones.ts:57-66`
(`existeConfirmacion`) · *2026-07-05 ~review-adversarial-crm-automatico*

### "Datos sin marcar" es un estado de primer nivel, no un aviso tibio

**Decisión (04/07).** Muestra **todos** los datos que faltan según la etapa del lead (menos
Tracking), con botón rojo **a la misma altura del nombre del lead** en el kanban y en la ficha,
y "Solucionar" al lado. Reemplaza al "Te espera", que era tibio y no accionaba nada.

**Decisión (05/07), complementaria:** si falta **cualquier** dato de Deal Details —incluido un
comprobante o un documento fiscal— el lead entra en "Datos sin Marcar" con botón de
**Solucionar** y de **Completar con IA**. El estado tiene que delatar **todo** lo que falta, no
algunos campos, y el usuario tiene que poder resolverlo desde ahí mismo. En el mismo lote: el
**correo de facturación se autocompleta** con el correo del lead salvo que se aclare lo
contrario — es el caso por defecto y pedirlo de nuevo es fricción sin valor.

**Decisión (21/06):** la vista muestra **solo las transiciones posibles** según la etapa del
lead, y antes de mover abre el detalle y obliga a completar los campos. *"Y todas
obligatorias, ninguna blanda"*. **Por qué:** los clientes conocen su funnel de memoria pero
dejan las nutriciones "en abierto", y esos campos son los que alimentan los mensajes
automáticos de WhatsApp/Email.

### Los pendientes se pueden ignorar, salvo la reunión vencida

**Decisión (06/08).** Los "Datos sin marcar" se pueden **IGNORAR**, uno a uno y en masa: siguen
visibles dentro del lead pero no generan warning ni suman al conteo. **Excepción:** una reunión
con status "pasó" y el lead todavía en R1/R2 cae sí o sí en datos sin marcar y **NO se puede
ignorar**; el form ofrece reprogramar.

**Por qué:** hay datos que legítimamente no aplican, pero una reunión vencida sin mover es un
error real. Es la misma razón por la que los items 'R' son permanentes (ver
[Las etapas de reunión salen del funnel](#las-etapas-de-reunión-salen-del-funnel-no-de-un-ternario)).

### El CRM se mueve solo y confirma después

**Decisión (05/07).** MaKo mueve los leads solo: busca la reunión en Fathom 3 horas después de
la R1, vence las nutriciones, lee el chat de WhatsApp. Al entrar al CRM salta un **pop-up NO
cerrable** pidiendo confirmar lo que cambió.

**Por qué:** MaKo se puede equivocar con la transcripción de Fathom, pero marcar a mano es
peor: *"intentar evitar que el usuario marque manualmente Datos sin Marcar, que solo pase si ya
no queda otra opción"*.

**Decisión (15/07):** el motor se dispara **por EVENTO** (cuando un lead cae en Datos sin
marcar), no solo por cron. El cron queda para los que entran por Instant Form. *"¿para qué
necesitamos un cron? cuando literalmente podemos disparar esa acción cada vez que un lead caiga
en Datos sin marcar"*.

**Vive en:** `lib/crm-auto.ts` (T1..T6) · `lib/mako-confirmaciones.ts`

---

## Agenda: horarios, Calendly y Fathom

### Fathom mandaba a No Show llamadas de 64 minutos: un campo de su heurística leído como un hecho

**Síntoma (12/08/2026, lead 1696).** MaKo avisa por WhatsApp *«Terminó la R1 con
contacto@prosesamed.com (64 min)»* y linkea el resumen. En esa misma pantalla:
«¿Asistió a la R1? **No se presentó**», etapa **Nutrición No Show R1** y «Todavía no
hablaron — Sin llamadas analizadas para este lead». La app se contradecía a sí misma en
dos renglones. El dueño: *«Y eso que la reunión ya pasó y SÍ está en el Fathom»*.

**Y el diagnóstico obvio era el equivocado.** Todo apuntaba al cron T1 (`lib/crm-auto.ts`),
que es el que mueve a No Show cuando *«no apareció ninguna grabación en Fathom»*. No fue
él: `lead_audit` decía **autor `Fathom`** — el webhook, que en la MISMA escritura agregó el
link de la grabación y marcó «no vino». El cron nunca tuvo esa falla: su regla es «hay
grabación → asistió, si no → no sé», que es la correcta.

**Causa.** `inviteeSpoke` (`lib/fathom.ts`) contestaba `false` cuando ningún hablante del
transcript traía `speaker.matched_calendar_invitee_email` igual al email del invitado. Pero
ese campo **no es un hecho sobre la asistencia**: es la heurística de Fathom, que matchea el
*nombre* del invitado del calendario contra el *display name* de quien habla. El payload
real de esa llamada:

```
invitee externo: name = "contacto@prosesamed.com"  (el name ES el email: un buzón genérico)
transcript (540 turnos):
  Mauricio Bustos Eguia :: mbustos@elevate.com.mx → 322
  Fernando              :: NULL                   → 218   ← habló 218 veces
```

Un buzón (`contacto@`, `info@`, `recursos.humanos@`) no matchea NUNCA contra una persona.
Medido sobre las 4 llamadas que el webhook marcó «no vino» en ws1: **en las 4 el prospecto
habló** (36–64 min, 100–218 turnos) y en las 4 el campo vino `NULL`. Dos de los display
names eran **nombres de teléfono** — `iPhone`, `motorola edge 70` — que es lo que muestra
Zoom/Meet cuando alguien entra desde el celular. No era un caso raro: era el caso típico.

Sobrevivió meses porque el daño se reparaba a mano y en silencio: en 2 de los 4 un humano
corrigió la asistencia al día siguiente (`CRM | Asistió R1: No -> Sí`) y nadie subió el
reporte.

**Y el segundo efecto, el que no se ve.** El webhook saltea el Closing Analyst cuando
`attended === false` (*«si el lead no asistió, no hay charla que seguir»*). O sea: la
llamada mal clasificada no solo mandaba al prospecto a la nutrición de no-show — también
apagaba el análisis y el borrador de follow-up. Por eso la pantalla decía «Sin llamadas
analizadas» sobre una charla de una hora que estaba entera en Fathom.

**La regla.** Un campo que un proveedor llena con SU heurística solo prueba lo que afirma,
nunca lo que niega: `matched = X` es evidencia de que X estuvo; `matched = null` es «no
pude», no «no vino». Ahora la ausencia solo se afirma cuando el transcript la prueba —
todos los hablantes matcheados y todos de casa (el host o un invitado interno)—; alcanza
**un** hablante sin identificar para devolver `null`, y `applyFathomRecording` trata el
null como «asistió» porque hubo grabación. La asimetría es deliberada: equivocarse hacia
«asistió» lo corrige una persona en un click, y equivocarse hacia «no vino» manda un lead
caliente a la secuencia de no-show, apaga el análisis y no avisa.

**Reparado:** leads 753 y 1696 (los otros 2 ya los había corregido un humano).

**Vive en:** `lib/fathom.ts` (`inviteeSpoke`) · `app/api/webhooks/fathom/route.ts`
(el gate `attended !== false` del `after()`) · `lib/leads.ts` (`applyFathomRecording`:
`attended ?? true`) · `tests/fathom-asistencia.test.ts`

**Lo que quedó SIN hacer:** `applyFathomRecording` no pisa una asistencia ya marcada
—«nunca pisa una decisión humana»— pero no distingue quién la marcó, así que **tampoco
corrige lo que escribió mal el propio Fathom**. Si el webhook redelivera sobre un lead ya
mal marcado, no lo arregla. Vive en `lib/leads.ts:747`.

### El botón que analiza la llamada: por qué el estado vive en la base y no en el componente

**El pedido (13/08).** *«Debería dejar un botón ahí para correr el análisis. Y CLARO que
haya un loader. Y que por más que me salga de la página o lo que sea, se siga analizando.»*
La pantalla del resumen se abre EN EL CELULAR, así que "me salgo de la página" no es un
caso raro: es lo que pasa siempre.

**Las dos mitades, que se resuelven en lugares distintos.**

1. *Que el trabajo siga* → `after()` en `app/api/closing/analizar-lead/route.ts`: la ruta
   responde 202 al toque y el análisis corre después de mandada la respuesta, con el
   `maxDuration` de la ruta (300 s) como techo. Es el mismo patrón del webhook de Fathom.
   Una server action atada al click no sirve: si el navegador corta, se corta.
2. *Que el loader siga* → la tabla `closing_jobs` (mig 0130). Con el estado en un
   `useState`, cerrar la pestaña lo pierde y al volver la pantalla ofrece arrancar otra
   corrida sobre algo que ya está corriendo — y cada corrida le paga a Claude por
   grabación. **La fila es a la vez lo que se pinta y el candado.**

**El candado necesita vencimiento, siempre.** Si la función se cae —timeout, un deploy en
el medio, un throw fuera del `try`— la fila queda en `corriendo` para siempre: la pantalla
muestra «Revisando» eternamente sobre un trabajo que ya nadie hace, y no hay ningún botón
para salir. Por eso `VENCE_MS` (15 min) y por eso un `corriendo` vencido se PINTA como
error con el motivo dicho: de las tres opciones, seguir mintiendo «Revisando» es la única
que no deja nada para hacer.

**Y el error tiene TRES desenlaces, no dos.** Acá el diagnóstico obvio volvió a ser el
equivocado, esta vez contra nosotros mismos: la primera versión contaba
`analizadas + relinkeadas + yaEstaban === 0` y de ahí concluía «no encontré esa llamada en
Fathom, revisá el link». Corrido de verdad contra el lead 1696 devolvió
`{ encontradas: 1, analizadas: 0 }` — la grabación estaba, con sus 540 turnos, y lo que
faltaba era **saldo en la API de Anthropic**. Cuatro contadores en cero se ven idénticos
para «no había nada» y para «no pude», y mandan a la persona a dos lugares distintos.
`analizarLlamadasDeLead` ahora devuelve `fallidas` + `error`, y el error del proveedor
viaja **textual**: resumirlo a «falló el análisis» obliga a buscarlo en los logs de Vercel,
que a los 60 minutos no existen.

**Dónde vive cada decisión.** `lib/closing-job.ts` lleva `server-only` (toca la base), así
que la decisión —qué se pinta, cuándo se puede reintentar, cómo se cuenta el desenlace—
vive en `lib/closing-job-estado.ts`, **sin** `server-only`, por la misma razón que
`exigirClienteDePrueba`: un módulo con `server-only` no lo puede importar ningún test, y
el candado es justo lo que no puede quedarse sin red.

**Vive en:** `supabase/migrations/0130_closing_jobs.sql` · `lib/closing-job-estado.ts` ·
`lib/closing-job.ts` · `app/api/closing/analizar-lead/route.ts` ·
`app/crm/[id]/resumen/AnalizarLlamada.tsx` · `lib/closing.ts` (`analizarLlamadasDeLead`) ·
`tests/closing-job-estado.test.ts`

**Trampa del entorno, verificada el 13/08:** la cuenta de Anthropic estaba **sin saldo**, y
eso NO se ve en ningún lado hasta que algo lo intenta — la API no expone el saldo prepago.
El síntoma que llega es una fila `closing_analyses` con `status='error'` y el mensaje del
proveedor adentro; el `status` de la tab sigue en verde.

**Lo que quedó SIN hacer:** el botón solo aparece cuando NO hay ningún análisis. Re-analizar
una llamada ya analizada (porque salió mal) sigue sin camino desde el resumen — existe en
la tab Insights de la ficha. Vive en `app/crm/[id]/resumen/page.tsx`.

### «Buscar automáticamente» no mira Fathom: mira una tabla que casi siempre está vacía

**Síntoma, dicho por el dueño del negocio en la llamada del 29/07 (01:22:32):** *«yo no estoy
usando el CRM puesto que, pues, está muy complejo, o no me es ágil»*. Y treinta segundos
después, en vivo: aprieta **«Buscar automáticamente»** en el wizard y Martin lee la
respuesta — *«supuestamente no encontró»*. La reunión ESTABA en Fathom. Terminó tipeando la
fecha de la R2 a mano.

**Causa.** `buscarReunionesAutomatico` no le pregunta a Fathom. Lee
`closing_analyses` con `.eq('lead_id', lead.id)` y se queda solo con
`category === 'venta'`. O sea: encuentra la grabación **únicamente si antes corrió el
Closing Analyst, si esa fila quedó enganchada a ESE lead, y si Claude la clasificó como
venta.** Tres condiciones, y las tres fallan calladas:

1. **El análisis nunca corrió** — el más común. Medido el 13/08: la cuenta de Anthropic
   estaba sin saldo, así que toda llamada nueva quedaba con `status='error'` y la búsqueda
   automática de ESOS leads devolvía vacío. Ver «El botón que analiza la llamada».
2. **Corrió pero quedó en otro lead (o en ninguno).** Lo cubre el Paso 0 de
   `analizarLlamadasDeLead`, pero solo si alguien lo dispara.
3. **Se clasificó `entrega_servicio` o `interna`.** Mau da coaching por Zoom con los mismos
   contactos, así que la clasificación errónea es esperable, no rara.

**Y el usuario no puede distinguir ninguna de las tres.** Las tres se ven igual: «no
encontré nada» y un formulario vacío. Es el mismo antipatrón que la fila de
`closing_analyses` sin `fallidas`: un vacío que puede ser «no hay» o «no pude», y que manda
a revisar Calendly cuando el problema estaba en otro lado.

**La regla.** Una búsqueda automática que se apoya en una tabla DERIVADA hereda todas las
formas de fallar de lo que la llena, y las convierte en el mismo silencio. O consulta la
fuente (la API de Fathom, que ya sabe buscar por email), o dice **por qué** vino vacía.

**Vive en:** `lib/auto-reuniones.ts:66-108` (`buscarReunionesAutomatico`) ·
`lib/closing.ts` (`analizarLlamadasDeLead`) · el wizard en `app/crm/StageMoveDialog.tsx`

### Lo que el dueño del negocio pidió del CRM, textual (llamadas 29/07 y 06/08)

No es una lista de bugs: es por qué **no usa** la herramienta. Ordenado por lo que más le
cuesta, con la cita y el archivo donde vive.

| Qué le pasa | Textual | Dónde vive |
|---|---|---|
| Cerrar un lead ganado no se descubre solo | *«no sé cómo decirle que ya lo cerré y me lo llevo para acá»* | arrastrar en `app/crm/CrmBoard.tsx` es el único camino |
| Marcar No Show tampoco | *«es como muy difícil decirle no show… o a lo mejor vas a arrastrarlo»* | ídem |
| Agendar la R2 **durante** la reunión | *«yo estoy con el cliente en la junta y meterme a Maco para agendarlo me genera una fricción… si no lo pongo rápido se me juntan dos»* | el wizard exige salir a Calendly |
| El celular | *«la mayoría andamos en el tema del celular o la tablet»* | solo `/crm/[id]/resumen` está pensado para móvil |
| Lentitud, dicha tres veces | *«se está tardando»*, *«aquí ya me tardé mucho»* | — |
| Un aviso que llega pero se pierde | *«sí te avisó, pero estaba muy escondido entre los otros mensajes»* / *«me llegan un chorro»* | `lib/avisos.ts` — el volumen de MaKo tapa a MaKo |
| Subir el contrato | *«no me deja subir más que PDFs»* (tenía un Word) | el `accept` sale de `lib/formatos-archivo.ts` |
| Una subida que falló y no dejó rastro | *«yo lo había subido… me salió $7,500.01 dólares y por eso no me dejó»* | el archivo no quedó y nadie avisó |

**El patrón que las une: todo lo que el CRM sabe hacer, hay que descubrirlo arrastrando.**
Cerrar, marcar no-show y avanzar de etapa son la misma acción física —un drag— y ninguna
tiene un botón en la ficha. Quien no lo descubrió, no usa el CRM; que es exactamente lo que
pasó.

### ⚠️ El selector de hora sigue sin desplegable y con las horas limitadas

**Síntoma:** en el formulario "¿Qué hacer ahora?" no aparece el desplegable de horas y el rango
está recortado. *"No está el desplegable (no limites las horas, que se pueda agendar a la
madrugada si quieren…)"* (07/08). Del mismo día: el **formato horario** tiene que abrir a 24 hs
sin limitación y usar **un solo** formato (AM o PM), no los dos mezclados — *"te lo habia
dicho"*.

**Tensión con lo que está escrito:** hoy `HORA_DESDE_DEFECTO=7` / `HORA_HASTA_DEFECTO=22` (ver
[la grilla tiene una sola fuente de verdad](#la-grilla-tiene-una-sola-fuente-de-verdad)). Ese
rango nació de que el dueño rechazó el tope de 19, pero **el pedido de agosto lo deroga**: sin
límites.

**Vive en:** `app/crm/horarios-respuesta.ts` · `app/crm/SelectorHora.tsx`

### ⚠️ Reagendar sigue roto

**Síntoma:** *"¿Donde me aparece la opción de reagendar? no podes hacer algo tan simple…"*
(06/08). Lo que hay es un input de fecha que **no reagenda nada** y **no pregunta la hora**.
Falta además resolver el caso de Calendly con eventos **ya pasados**: mover en Google Calendar +
registrar en el history.

**Vive en:** `app/crm/actions.ts` (`reagendarReunionAction`) · `lib/google-calendar.ts` ·
`app/crm/CrmBoard.tsx`

### ⚠️ `moverEnCalendario` y la duración real de un evento existente

Ya propaga `duracionMin`, pero la duración de un evento **existente** la sigue definiendo el
evento. Del mismo flujo quedó vivo: `moverEnCalendario` **no chequea que el evento exista**
antes de prometer en el resumen que se va a mover.

**Vive en:** `app/crm/actions.ts` · `lib/google-calendar.ts`

### ⚠️ La ayuda de horarios nació owner-only: solo ws1 puede conectar Google Calendar

**Síntoma:** para cualquier workspace que no sea el 1, `horariosLibresDeGoogle` devuelve
`sin-conexion` **siempre** y la grilla sale neutra.

**Causa:** conectar la agenda está gateado por `esDuenoAdmin()` en **los dos** route handlers
del OAuth de Google Calendar. La lectura sí es workspace-aware (el refresh token vive en
`app_settings` bajo `google.calendar.refresh_token`, cifrado, y `getSetting` filtra por el
workspace de la sesión), pero nadie más puede completar el OAuth.

**Regla:** degrada bien —reagendar sigue funcionando— pero la feature **nace owner-only de
hecho**, contra [Ningún cambio es solo para el dueño](#ningún-cambio-es-solo-para-el-dueño).

**Vive en:** `app/api/integraciones/google-calendar/route.ts` y su callback (guard
`esDuenoAdmin`) · `lib/google-calendar.ts` · *2026-08-06 ~wizard-que-hacer-ahora-y-horarios-de-google*

### ⚠️ Marcar reunión a mano está muerto salvo para el dueño

**Síntoma latente:** en un funnel custom, el `else` escribiría `fecha_junta_2` para la
**PRIMERA** reunión.

**Causa:** `setMeetingManual`, `markMeetingManualAction` y `calendly-widget.ts` tipan
`which: 'agenda' | 'agendaj2'`, y `CrmBoard:543` **castea una stage key arbitraria** a esas dos.
Hoy no explota porque los dos call-sites están gateados por `calendlyUrlFor()`, cuya tabla tiene
**dos URLs de Calendly personales hardcodeadas** — o sea, es la misma violación de "nada
owner-only" con otra cara.

**Vive en:** `setMeetingManual` (`lib/leads.ts:690`) · `markMeetingManualAction` ·
`app/crm/calendly-widget.ts:10` · `app/crm/CrmBoard.tsx:543`

### ⚠️ El match automático de Fathom por webhook no funciona

El webhook ya está cargado en Vercel y en el env local y sigue sin funcionar (*"no entiendo"*,
15/07). **Vive en:** `app/api/webhooks/fathom/**` · `lib/auto-reuniones.ts`

### El eco decía una hora y Enter guardaba otra

**Síntoma:** tipeás `6:15`, abajo lee "Se entendió: 6:15 PM", Enter guarda **16:15**. Peor: para
el mismo texto, Enter daba `16:15`, Tab daba `18:15` y click afuera `18:15`.

**El diagnóstico obvio era el equivocado.** Parecía un bug de parseo 12h/24h. `parsearHora`
estaba bien: el filtro de la lista es por **substring** y no sabe nada del parseo
(`"16:15".includes("6:15")` es `true`, `"0730".includes("3")` también), y `setActivo(0)` en cada
tecla dejaba el puntero en el primer match alfabético. Enter commiteaba la fila resaltada; Tab y
blur pasaban por `parsearHora`. **Tres caminos de commit, tres resultados.**

**Regla:** en un combobox con escritura libre, **todos los caminos de commit leen la misma
función**. Si el usuario no movió el puntero a mano, manda la hora *entendida*, no la
coincidencia de texto. Y si mostrás un eco, **el eco es el contrato**: lo que se guarda es eso.

**Vive en:** `app/crm/SelectorHora.tsx` — la decisión vive en dos funciones puras exportadas,
`indiceActivo()` (`:249`) e `indiceDeAncla()` (`:276`); `activo` es un puntero explícito
(`-1` = ninguno)

### El instante lo calcula el server con la zona del workspace

**Síntoma:** workspace en Montevideo, closer con la laptop en Ciudad de México. Elige 18:00, el
resumen dice "6:00 PM", se guarda `00:00Z` — 3 h corrido. `fecha_junta_1` y `junta_1_at` podían
caer en **días distintos**, y `moverEventoDeReunion` manda `sendUpdates=all`: **al invitado le
llegaba el mail con la hora equivocada**.

**El diagnóstico obvio era el equivocado.** El comentario del código decía que la excepción era
"«Otro horario» (tipeado a mano)". No era la excepción: era **todo el camino sin agenda
verificada**. `slot.inicioIso` solo existe cuando Google responde; con `slots: null` (sin
conexión, token vencido, 403/429/5xx, timeout, `.catch` del fetch) caían ahí también las horas
elegidas del desplegable. En cualquier workspace **sin Google Calendar enchufado**, el 100% de
los reagendados pasaba por `new Date('YYYY-MM-DDTHH:mm')`, que por spec es hora local del
navegador.

**Regla:** el cliente manda `'HH:MM'` + fecha; **el instante lo calcula el server** con la zona
del workspace. Un `new Date('...T...')` sin offset en código de UI es un bug de zona esperando
al primer usuario en otro huso.

**Vive en:** `reagendarReunionAction` (`app/crm/actions.ts:1267`) recibe `hora: string | null`
en `'HH:MM'`, **nunca un instante**, y resuelve `tzDeWorkspace()` + `instanteDeLocal()` — la
misma función que arma la grilla

### La grilla calculaba con 45' aunque la reunión durara 60

**Síntoma:** un slot marcado libre que al mover pisa la reunión siguiente. R1 de 60' con algo a
las 19:15: el server marca 18:30 libre (18:30 + **45'** = 19:15, no se pisa), y el PATCH lo deja
18:30–19:30 encima.

**Causa:** `CrmMarcar.duracionMin` estaba **declarado y leído pero nunca escrito** —
`PendienteItem` no traía el campo, así que siempre caía a `DURACION_DEFECTO_MIN`. Del otro lado,
`lib/google-calendar.ts` conserva la duración **real** del evento (`duracionMs`).

**Regla:** la duración con la que se calculan los huecos y la que se escribe en el calendario
tienen que ser **el mismo número**. Un campo opcional que nadie llena es un default silencioso:
si lo agregás, buscá **el productor**, no solo el consumidor.

**Vive en:** `duracionDeReunionEnAgendaMin()` en `lib/google-calendar.ts`, expuesta por
`duracionReunionAction`; `CrmBoard` la pide al **abrir** el wizard, no en el paso de la hora,
para que el viaje a Google ocurra mientras el usuario elige la fecha

### La grilla tiene una sola fuente de verdad

`app/crm/horarios-respuesta.ts` es el módulo puro (sin `server-only`) que define
`HORA_DESDE_DEFECTO=7`, `HORA_HASTA_DEFECTO=22`, `PASO_MIN_DEFECTO=15`,
`DURACION_DEFECTO_MIN=45`, `MARGEN_MIN_DEFECTO=30` y las funciones de grilla. `rango` viaja en
**todas** las respuestas 200 de `GET /api/crm/horarios`, incluidos los caminos de error — que es
justo cuando la UI dibuja la grilla sola.

**Por qué 07–22:** el tope de 19 lo rechazó el dueño; 00:00–23:45 son 96 opciones y las 3 AM
parecían ruido. Lo que recorta la lista de verdad es la agenda, no el rango. ⚠️ **El pedido del
07/08 deroga esto**: sin límites de hora, ver
[el pendiente del selector](#-el-selector-de-hora-sigue-sin-desplegable-y-con-las-horas-limitadas).

**Regla:** si el selector define sus propias constantes, con Google caído pinta una grilla y con
Google vivo otra. Importá de ahí. **`slots: null` ≠ `[]`**: `null` es "no verificada" (no se
oculta nada), `[]` es "verificada y sin horarios".

**Vive en:** `app/crm/horarios-respuesta.ts` · `app/api/crm/horarios/route.ts`

### Dos más del mismo flujo: `reagTz` pegado y 122 formateadores por request

- **`reagTz` pegado:** se guardaba solo `if (r.slots)`, así que un día que fallaba después de uno
  que funcionó pintaba "Horarios en America/Montevideo" debajo de "Agenda sin verificar" —
  afirmando una zona justo cuando no se leyó ninguna. Hoy se guarda siempre y se limpia en el
  `.catch`.
- **122 `Intl.DateTimeFormat` por request:** `instanteDeLocal` construía un formateador nuevo,
  dos veces por slot; con 61 slots eran ~15-25 ms. `FMT_TZ` memoizado por zona
  (`horarios-respuesta.ts:232`) lo baja a ~3 ms. El costo de red no se movió: sigue siendo **un**
  `POST /freeBusy`, con el cruce en memoria.

### Un componente declarado dentro del render remonta todo

Las opciones del selector se generan con una **función que devuelve el elemento**, no con un
componente anidado: como componente, React remontaba las 61 filas con cada tecla y tiraba el
scroll al principio.

**Vive en:** `app/crm/SelectorHora.tsx`

### `freeBusy` devuelve `busy: []` cuando el calendario trae `errors`

Se lee como "día entero libre". Hay que chequear `cal.errors?.length` **antes** que `busy`. Ya
está hecho, no lo saques.

Del mismo módulo, dos comportamientos de Google que **no son bugs** y están testeados:
transparentes y rechazados no llegan en `busy` (correcto), pero un **all-day marcado Ocupado sí
llega como intervalo de 24 h** y pisa la grilla entera. Y **solo se consulta `primary`**: un
ocupado en otro calendario del dueño **no** bloquea — limitación conocida.

**Vive en:** `lib/google-calendar.ts:848`

### Leer huecos y mover el evento son permisos distintos, y el traductor de errores decía lo contrario

Dos trampas del mismo módulo:

1. **`POST /freeBusy` funciona con `calendar.readonly`**: los horarios disponibles andan HOY con
   el token viejo de solo lectura que tiene el dueño. Si `horariosLibresDeGoogle` copiaba el
   guard `puedeEscribir()` de `moverEventoDeReunion`, le negaba los horarios justo al único caso
   vivo — está comentado en el código para que nadie lo "arregle".
2. **`leerFallo` estaba escrito para el camino de ESCRITURA.** Reusado en el de lectura, un 403
   por falta de scope de lectura devolvía "El permiso de Google es de solo lectura: reconectá la
   agenda para poder MOVER reuniones", o sea mandaba a diagnosticar exactamente al revés, y
   encima clasificaba como `sin-conexion` una agenda conectada.

**Regla:** un traductor de errores **hereda el contexto para el que fue escrito**; al reusarlo en
otro camino hay que revisar cada mensaje.

**Vive en:** `lib/google-calendar.ts` (`GCAL_SCOPE_LECTURA`, `horariosLibresDeGoogle`,
`puedeEscribir`, `leerFallo`) · *2026-08-06 ~wizard-que-hacer-ahora-y-horarios-de-google*

### Ampliar el scope de Google no re-consiente solo, y `calendar.events` no alcanza

Al sumar la escritura (mover el evento al reagendar) aparecieron tres trampas:

1. **`calendar.events` NO cubre `calendars.get`**, de donde sale el email del calendario: el
   scope pedido tiene que ser la **UNIÓN** de `calendar.readonly` + `calendar.events`, no el
   reemplazo.
2. **Los que ya habían conectado conservan el scope viejo** en su refresh_token y quedan en solo
   lectura sin enterarse. Se detecta con los scopes que devuelve el propio refresh (`j.scope`,
   sin request extra a `/tokeninfo`) y se pide reconectar en la UI; `puedeEscribir()` es
   **optimista** si Google no informa scopes, porque la certeza real la da el 403.
3. **Sin `prompt=consent` Google NO reemite refresh_token** para quien ya había aceptado, así que
   el botón "Reconectar" no haría nada; y hace falta `include_granted_scopes=true` para no perder
   lo ya otorgado.

⚠️ **PENDIENTE de acción manual:** agregar
`https://www.googleapis.com/auth/calendar.events` a la lista de scopes de la pantalla de
consentimiento en Google Cloud Console, o Google puede devolver `invalid_scope`. Es "sensible",
el mismo tier que el readonly que ya se pedía: **no cambia el estado de verificación**.

**Vive en:** `lib/google-calendar.ts:32-49` (`GCAL_SCOPE`) y `:182` (`puedeEscribir`) ·
`app/api/integraciones/google-calendar/route.ts:35-42` · *2026-08-06 ~gcal-write-y-history-completo*

### Calendly se pinta conectado y el webhook descarta las reuniones con 200 OK

**Síntoma clásico del cliente:** conecta Calendly, ve el tilde verde y **no entra ni una
reunión**, sin un solo error en ningún lado.

**Causa real:** `CALENDLY_EVENT_TYPE_J1/J2` están marcados `opcional: true` en el catálogo, así
que `integracionConectada` los ignora y la tab se prende; pero el webhook resuelve el workspace
**comparando el event type contra ESOS valores**, y sin match responde 200 OK con `ignored`, para
que Calendly no reintente. Hoy el hueco está documentado solo en el copy que ve el usuario
(`ademas` en `lib/tab-activacion.ts:151`), **no en el código que decide**.

**Regla:** `opcional: true` significa "el servicio funciona sin esto". Si algún camino lo
necesita para no descartar datos, **no es opcional** — un campo que el catálogo llama opcional y
el ruteo trata como obligatorio produce exactamente un all-clear falso.

**Estado:** la corrida del 06/08 confirma que **sigue abierto**. Lo que sí se cerró es la signing
key, que ahora se lee por workspace con `credWs`.

**Vive en:** `lib/metodo-catalogo.ts:445-447` · `app/api/webhooks/calendly/route.ts` ·
`lib/tab-activacion.ts:151` · *2026-08-06 ~verificar-tareas-ya-hechas*

### Agendar R1 y R2 va siempre por el embed de Calendly

**Decisión (22/06).** Nunca a mano; si no se completa el agendamiento, **el lead no cambia de
etapa**. **Por qué:** es la única forma de que la asistencia, el link de Fathom y las respuestas
del formulario lleguen solas al CRM.

### Una llamada de coaching entraba al CRM como Reunión 2

**Síntoma:** una sesión de entrega de servicio quedaba cargada como la R2 del lead, con su link
y su asistencia marcada.

**Causa:** `buscarReunionesAutomatico` elegía la grabación por fecha y match de email, **sin
filtrar `category`**. El dueño usa Fathom para TODO: solo ~10-40 de ~196 grabaciones son de
ventas.

**Fix:** filtra `category='venta'`; la limpieza histórica se hizo con
`scripts/audit-fathom-links.mjs`.

**Regla:** cuando la fuente externa mezcla varios usos, **el filtro por tipo es parte del
contrato**, no una optimización.

**Vive en:** `lib/auto-reuniones.ts` · *2026-08-07 ~contexto-mako-md*

---

### ⚠️ Cal.com es OTRO producto, no una variante de Calendly

*2026-08-24*

`calendly.com` y `cal.com` son **dos empresas distintas**, con API, firma y payload
distintos. Lo único que comparten es la idea. Confundirlos costó una conversión real: el
ws13 (Código Inmobiliario) vende por una agenda de Cal.com embebida en su landing, se
agendó **durante una prueba en vivo** y MaKo no registró nada — ni el evento ni el lead.

**Las cuatro diferencias que gobiernan el diseño** (traídas de la doc oficial y del fuente
del propio Cal.com, no de memoria):

| | Calendly | Cal.com |
|---|---|---|
| Firma | `Calendly-Webhook-Signature: t=…,v1=…`, se firma `${t}.${body}` → anti-replay gratis | `x-cal-signature-256`: hex pelado sobre el body. **Sin anti-replay por firma** |
| Sobre | `{ event: 'invitee.created', payload }` | `{ triggerEvent: 'BOOKING_CREATED', payload }`, en MAYÚSCULAS |
| Invitado | ES el payload | `payload.attendees[0]` — y el `organizer` es el CLIENTE |
| API | v2 | **la v1 se apagó el 8/4/2026**; v2 exige el header `cal-api-version` |

**La trampa propia de este proveedor: `no-secret-provided`.** Cuando el webhook se da de
alta sin secreto, Cal.com **no omite el header**: manda esa cadena literal. Un guard escrito
como `if (header) verificar()` la trata como si fuera una firma; uno escrito como
`if (!secret) return` deja pasar el webhook **sin verificar nada**, y ahí cualquiera que
descubra la URL puede inventar reservas y meterle leads al CRM de un cliente. Se nombra y
se rechaza explícito, con un mensaje que dice qué hacer — porque el que lo va a leer es
quien configuró el webhook.

**⚠️ El invitado es `attendees[0]`, NUNCA el `organizer`.** En Calendly no hay forma de
equivocarse porque el invitado ES el payload; acá las dos personas viven en el mismo objeto,
y confundirlas crea un lead con los datos del propio negocio — un cliente «agendándose a sí
mismo» en cada reserva.

**Y el embed manda DOS postMessage por UNA reserva** (el evento viejo y el `…V2`), así que
un filtro por `indexOf('bookingSuccessful')` cuenta cada agenda dos veces. Peor: el único
de los dos que trae nombre y mail de quien reserva es justo el que Cal.com marca
`@deprecated`. Se aceptan los dos y se deduplica por el uid del booking — atarse al viejo
es quedar ciego el día que lo apaguen, y atarse al nuevo es perder el lead hoy.

**Qué NO se duplicó, a propósito:** la lógica de negocio. El webhook normaliza la reserva y
de ahí en adelante llama a las MISMAS funciones que Calendly (`upsertLeadFromCalendly`,
`setFechaJunta2`, `cancelarJuntaEnLead`) y a la MISMA comparación de event types
(`mismoEventType`). Dos caminos que escriben leads distinto son dos CRMs; y si cada
proveedor clasificara R1/R2 con su propia comparación, la misma reunión sería R1 por un
lado y R2 por el otro.

**Lo que sí es propio y no se comparte: el espacio de nombres del ruteo.** Cal.com va bajo
el servicio `calcom` en `webhook_routing`, no bajo `calendly`. Un slug como `cierre` o
`llamada` es plausible en los dos, y compartir el índice haría que la reserva de un cliente
se ruteara al workspace de otro.

**Y nace SIN fallback a un secreto de plataforma**, a diferencia de Calendly. Allá ese
fallback existe por compatibilidad y su propio comentario dice que mientras se use, dos
inquilinos comparten secreto y la vía de forja sigue abierta para ellos. Esta integración
no tiene historia que arrastrar: nace cerrada.

**El origen del lead se PARAMETRIZÓ.** `upsertLeadFromCalendly` clavaba
`origen_lead: 'calendly'`, así que la primera reserva de Cal.com quedó etiquetada como
Calendly: la ficha lo decía y el reporte de origen le atribuía la venta a una herramienta
que ese cliente no usa. Un origen inventado no se nota nunca y no se puede corregir
después, porque nada distingue las filas mal etiquetadas.

**Verificado de punta a punta** contra el ws3 (Cliente de Prueba), con limpieza: conectar
desde /integraciones guarda las credenciales → el ruteo se espeja solo → la reserva firmada
crea el lead con el nombre, mail y teléfono de **quien reservó** → la segunda vez actualiza
y no duplica. Y los caminos cerrados: body no-JSON 400, `JSON.parse('null')` 400 (no 500 sin
autenticar), sin header 401, `no-secret-provided` 401 con el mensaje útil, firma de otro
secreto 401.

**Vive en:** `lib/calcom.ts` · `app/api/webhooks/calcom/route.ts` ·
`lib/webhook-routing.ts` (`ROUTING_CREDS`) · `lib/metodo-catalogo.ts` ·
`lib/integraciones-catalogo.ts` · `lib/landing-token.ts` (el postMessage del embed) ·
`tests/calcom-parsers.test.ts` · `tests/landing-agenda-embebida.test.ts`

**Lo que quedó SIN hacer:** el barrido por API (leer la agenda para recuperar reservas cuyo
webhook falló) — Calendly tampoco lo tiene. El registro programático del webhook: hay que
darlo de alta a mano en Cal.com, igual que en Calendly (Chatwoot y Evolution sí lo
registran solos). Y el widget del CRM para agendar DESDE MaKo, que hoy es solo de Calendly
(`lib/calendly-agenda.ts`, `app/crm/calendly-widget.ts`).

### ⚠️ «Falta activar la landing»: pedirle al cliente que declare lo que ya declaró

*2026-08-25 — el dueño: «¿cómo que falta activar la landing? ¿qué sentido tiene?»*

Ninguno. Un cliente conectó Cal.com —pegó el webhook, inventó el secret, cargó el tipo
de evento—, alguien reservó, y el panel le contestó que el contacto no entraba al CRM
porque le faltaba marcar una casilla llamada **«landing»** en otra pantalla. Encima el
nombre miente: esa reserva no vino de su landing, vino de su **agenda**.

**El razonamiento detrás de la puerta era correcto, y su alcance no.** `entradas` del
funnel existe porque el **Pixel se le da a TODOS por defecto**: sin esa puerta, a
cualquiera que lo pegue se le empieza a llenar el CRM de contactos que no pidió. Ese
argumento no aplica a una integración que el negocio **conectó a propósito**:
conectarla ES el acto de declararla. Pedir además la casilla es burocracia que solo
existe por cómo está partido el código.

Ahora un opt-in de `origen_captura: 'agenda'` pasa si el workspace tiene Cal.com o
Calendly conectados. Medido en el ws3, con el mismo opt-in en los dos escenarios:

| | resultado |
|---|---|
| sin la agenda conectada | bloqueado, con su rastro — correcto, ahí la puerta sirve |
| con Cal.com conectado | `lead: 2312, creado: true`, **sin tocar nada en Funnel** |

**Regla — una configuración que el sistema puede DEDUCIR no se pregunta.** Y el test
para saber si sobra: ¿existe algún caso donde el cliente conecte la integración y NO
quiera esos leads? Si no existe, la pregunta es de la arquitectura, no del negocio.

**Vive en:** `app/api/track/optin/route.ts` (`deAgendaConectada`)

### ⚠️ El «?» de todos los campos abría el mismo texto

*2026-08-25 — reportado por el cliente: «la guía de cada cosa aparece siempre el mismo»*

El componente hace `ayuda={c.ayuda ?? servicio.tutorial}`. Un campo **sin** entrada en
`AYUDA_CAMPO` abre el tutorial entero del servicio, así que en Cal.com (4 campos),
Clarity, Whop y GitHub (2 cada uno) **todos abrían lo mismo**: quien tocaba el «?» de
«API key» recibía, desde el paso 1, cómo crear el webhook.

Con un solo campo está bien —el tutorial ES la ayuda de ese campo—. Con dos o más, el
«?» deja de contestar la pregunta del que lo tocó.

**La regla:** el tutorial del **servicio** contesta *«cómo conecto esto»*; el del
**campo**, *«qué pongo AQUÍ»*, que es la pregunta de quien tiene el cursor adentro del
input. Lo cuida `tests/tutoriales-legibles.test.ts`: un servicio con varios campos no
puede tenerlos todos sin ayuda propia.

## Historial, deshacer y confirmaciones

### Deshacer no es historia

**Decisión (04/07 y 05/07).** "Deshacer" tiene **límite de tiempo** y **no deja rastro**; pasado
ese límite la acción se llama "Restaurar" y **esa sí queda** en el historial. El Status solo se
puede deshacer **de a un estado por vez** — *"si quiero regresar muy atrás, tengo que ir de a 1.
Pero es mucho mejor así"*. Y **siempre pide confirmación**.

Textual: *"Cuando se da a Deshacer o Restaurar, JAMÁS se debe guardar otro historial de
cambio"*. Es la única excepción a
[todo movimiento queda en el historial](#todo-movimiento-queda-en-el-historial-sin-excepción-y-firmado-por-quien-lo-hizo).

**Implementación:** `revertMoveAction` alinea `etapa_vista` **después** de aplicar y **antes** de
borrar `lead_audit`. `alinearEtapaVista` **no escribe historial**: ese es el punto, "un cambio
deshecho no es historia". La decisión (`etapaVistaPendiente`, pura) está separada de la escritura
para poder testearla. Cubre también el grupo sin fila `'Etapa'`: revertir `'Asistió R1'` mueve la
etapa **derivada**.

**Vive en:** `app/crm/actions.ts` (`revertMoveAction`) · `lib/etapa-historial.ts`

### El revert de MaKo guarda tus intenciones, no el estado del lead

**Síntoma:** se rechaza una confirmación de MaKo y el lead queda peor que antes — con el
`motivo_perdida` borrado para siempre, o con un `fathom_links` al que le falta el link que agregó
otro.

**Causa:** el "Deshacer" de las confirmaciones aplica `.update(c.revert)` crudo con el patch que
armaste al aplicar. Pero `setPipelineStage` → `updateLead` toca columnas **de rebote** que no
están en tu patch: al reabrir un lead perdido borra `motivo_perdida` (**dato de negocio
destruido pese a que el humano rechazó**), deriva `cerro` del estado nuevo, y estampa
`nutricion_realizada=true` en las etapas de `NUTRI_KEYS`.

**Reglas:**
- El revert tiene que **snapshotear las columnas que la función que llamás puede tocar**, no las
  que vos escribiste.
- Para columnas **array** el patch es un overwrite last-write-wins: revertir `fathom_links` con
  el snapshot viejo borra el link que otro agregó en la ventana (que son **horas o días**, no un
  race exótico). Ahí el revert tiene que ser **quirúrgico** (sacar la url que agregó MaKo), no un
  set.
- **El orden importa:** se aplica el efecto **antes** de insertar la confirmación, y
  `crearConfirmacion` se traga cualquier error del insert y devuelve `false` sin que nadie lo
  mire. Si falla, el lead queda mutado **sin fila para deshacer** y los guards impiden que se
  vuelva a proponer: el cambio huérfano es permanente.

**Vive en:** `lib/crm-auto.ts:204-212` (T6), `:229-246` (T1), `:272-298` (T3) ·
`lib/mako-confirmaciones.ts:94-99` y `:145-150` · `lib/leads.ts:304-325` y `:1341-1343` ·
*2026-07-05 ~review-adversarial-crm-automatico*

### "Eliminar los datos de Mau" no devuelve lo que pisó: lo borra

**Síntoma:** un workspace que ya hizo su propio onboarding del Chat Agent pierde su ensayo entero
(9 casos escritos a mano), su mapa de audios y su voz; después "Eliminar los datos de Mau" le
**borra** esas claves en vez de devolverle las suyas, y queda sin nada.

**Causa:** el ámbito `setting` pasó de copiar 1 clave a copiar 7 (`chat_agent.ensayo`,
`chat_agent.audios_clave`, la voz destilada…). La copia es un **upsert ciego** que no guarda el
valor previo, y el borrado es un **DELETE por clave**, no una restauración. Rompe la regla
escrita en la cabecera del propio archivo: *"Borrar borra lo que TRAJIMOS, no lo que hay"*.

**Variante peor:** `settingsRemap` corre aunque el bloque de settings no haya copiado esa clave,
lee el valor del **DESTINO**, lo traduce contra un mapa de ids del **DUEÑO** (que nunca matchean,
porque `setting_audios.id` es bigserial global) y lo deja en `{}` — y como la clave nunca entró
al recibo, "Eliminar" tampoco la restaura.

**El patrón a copiar** es el ámbito `perfil`: guarda el valor anterior en el recibo y lo
restaura.

**Vive en:** `lib/datos-mau.ts:200-229`, `:599-661` y `:754` ·
*2026-08-02 ~ensayo-chat-agent-y-datos-mau*

---

## Importar y exportar leads

### Importar un CSV corrompe leads en silencio y reporta éxito

**Síntoma:** se importa el CSV que exporta Excel en español ("nombre;email;telefono;empresa") y
la pantalla dice **"✓ N leads nuevos"**. Cada lead quedó creado con la **fila entera** como
nombre, como email, como teléfono y como empresa. Pasa la validación, pasa el dedup, y **no hay
preview ni deshacer**.

**Causa real, en tres capas que fallan sin dar un solo error:**

1. **El delimitador `;` no se detecta** (la coma estaba hardcodeada). Como el match de
   encabezados es por substring, `iNombre`, `iEmail` e `iTel` resuelven **todos al índice 0**.
   Eso además envenena el dedup.
2. **`f.text()` NUNCA falla sobre binario.** Un PDF o un XLSX devuelve mojibake, habilita el
   botón, y el usuario termina leyendo "No encontré una columna Nombre en el CSV" — el problema
   es **el formato**, no la columna, y nadie lo dice. Del mismo par: `file.text()` decodifica
   UTF-8 mientras que ese CSV sale en **ANSI/Windows-1252**, así que los acentos llegan rotos sin
   aviso. En el sentido inverso, al **exportar** hay que agregarle el **BOM** o Excel lo abre en
   1252 y rompe los acentos.
3. **Los contadores del paso 2 mienten** (`total = creados + omitidos`, y las filas vacías se
   saltean con `continue`).

**Reglas:** sniffear el delimitador y **ABORTAR si dos campos caen en el mismo índice**;
decodificar con `TextDecoder('utf-8',{fatal:true})` y caer a windows-1252; y que el preview
devuelva **filas con estado**, no números.

**De paso:** `createLead` declara `origen_lead` en su input pero **el insert no lo escribe**, así
que un lead importado es indistinguible de uno cargado a mano.

**Vive en:** `app/crm/actions.ts:724-825` (`parseCsv`/`previsualizar`/`importar`, `EXPORT_COLS`) ·
`app/crm/ImportarLeadsModal.tsx` · `app/crm/leads-importar.ts` · `lib/leads.ts:172,295-306` ·
*2026-08-06 ~crm-tracking-import-export-audit + ~crm-toolbar-e-importar-exportar*

### ⚠️ La importación de punta a punta sigue sin diseñarse

Pedido el 06/08: qué pasa con un **PDF o una imagen** con contactos, y un **modal de validación
previo** donde el usuario corrija los errores **antes** de cargar. Es exactamente la salida que
pide la entrada de arriba ("preview con filas y estado").

**Vive en:** `app/crm/ImportarLeadsModal.tsx` · `app/crm/actions.ts`

### ⚠️ La exportación sale ilegible y no deja filtrar

Pedido el 06/08: el MD exportado **sale ilegible** y el formulario de exportación **no deja
filtrar por etapas ni por casi nada**.

**Vive en:** `app/crm/actions.ts` (`EXPORT_COLS`) · el modal de exportación del CRM

---

## La ficha del lead

### La ficha vive en dos árboles, y por eso la zona horaria entra por hook

`app/crm/LeadSheet.tsx` (cliente, modal) y `app/crm/[id]/page.tsx` (server). Las mismas cards se
montan en los dos, y eso decide cómo les llega la configuración del workspace: la zona horaria
entra por un **hook** (`useTzWorkspace`, con memo a nivel de módulo: una llamada por carga, no una
por card) y **no por prop** — un prop hay que enhebrarlo por los dos árboles y deja el agujero
abierto para el tercer lugar donde se monte una card.

**La trampa:** el primer render **tiene que** usar el mismo fallback de los dos lados
(`TZ_TIJUANA`). `GeneratedInsightCard` y `TrackingTimelineCard` pintan timestamps ya en el SSR de
`/crm/[id]`; si el valor inicial fuera la zona del navegador —que el server no conoce— revienta
la hidratación. El memo solo se escribe **desde el efecto**, que nunca corre en el server:
llenarlo durante el SSR le pasaría la zona de un inquilino al siguiente.

**Colateral que se ve poco:** en `ChatCard`, el **separador de día** también dependía de la zona.
A las 23:30 en Tijuana ya es otro día en Madrid, y los mensajes se agrupaban bajo la fecha
equivocada. **Una zona horaria no solo cambia una hora impresa: cambia agrupaciones.**

**Vive en:** `app/crm/LeadSheet.tsx` · `app/crm/[id]/page.tsx` · `useTzWorkspace`

### El pop-up del lead es preview; para editar se va a su ruta propia

**Decisión (17/07).** Mezclar preview y edición en el modal quedaba poco profesional y limitado.
Con **ruta propia** se puede ver una sola entidad a fondo y **compartir el link**. Y la regla
general que sale de ahí: **toda entidad importante (lead, ad) tiene su ruta exclusiva** además de
abrirse en su tabla.

⚠️ **Pendiente (15/07):** mapear y darle deep link a todo lo que hoy vive solo en sub-tabs — cada
llamada de ventas analizada, cada anuncio ganador, cada retro, cada task/proyecto.

**Vive en:** `app/crm/[id]/page.tsx` · `app/leads/[id]/**` · `app/crm/LeadSheet.tsx`

### ⚠️ Los chips de campaña y anuncio no redirigen, y quedan desalineados

Pedido el 06/08: en la ficha, el chip de **campaña/anuncio** tiene que redirigir de verdad a la
campaña o al anuncio (abriendo Ads Manager en la campaña), y los chips no deben quedar sueltos
(**2 y 2, no 3+1**).

**Vive en:** `app/crm/LeadSheet.tsx` (Origen del lead) · Ads Manager

### ⚠️ El tracking del VSL marca "no vio el VSL" a leads que sí lo vieron

**Síntoma:** muchos leads no traen el % visto y quedan marcados como "no vio el VSL". Pedido el
**02/08** y todavía abierto el **07/08**: *"dimos muchas vueltas con esto, quiero que
funcione"*.

**Vive en:** `TrackingTimelineCard` · el tracking del VSL (ver también
[hallazgos-infra.md](hallazgos-infra.md) y la cadena de identificación del VSL)

---

## Cohortes, seeds y datos prestados

### `COHORTE_DIAS_*` son env vars que no lee nadie: el umbral real está hardcodeado en cuatro lugares

`COHORTE_DIAS_MADURA` y `COHORTE_DIAS_MADURANDO` tienen **cero ocurrencias** en todo el repo y ni
siquiera están en el catálogo, así que el boot no las hidrata: alguien creyó que configuraba la
madurez de las cohortes y **nunca se cableó**. Los umbrales de verdad (**14 y 5 días**) viven
repetidos en la migración 0084 (dentro del CASE de las vistas `v_cohortes_*`), en `lib/leads.ts` y
en `lib/queries.ts`.

**Lo que hace cara la solución:** el filtro `.eq('estado_madurez','madura')` se resuelve **EN SQL
contra la vista**. Volverlo configurable por cliente no es mover un env: es una **migración** que
saca el CASE de las vistas más un refactor de las queries que hoy filtran server-side.

**Vive en:** `supabase/migrations/0084_cohortes_workspace.sql:45-46` y `:81-82` ·
`lib/leads.ts:1019-1020` · `lib/queries.ts:922-923` · *2026-07-16 ~auditoria-env-vars*

### ⚠️ El progreso del objetivo arranca en la fecha de Mauricio para cualquier workspace sin la setting

`OBJETIVO_DESDE_DEFAULT = '2025-12-08'` es la fecha de arranque **del dueño**, y es el fallback
cuando el workspace no tiene `objetivo_desde` en `app_settings`. A un cliente nuevo le cuenta todo
su histórico contra una fecha que no significa nada para él, **y no avisa**: es un default que
inventa un dato.

**La causa de fondo:** `crearWorkspace` solo inserta la fila en `workspaces` — no seedea
`app_settings`, ni `funnel_config`, ni las secuencias de nutrición (que se insertaron por migración
pre-multi-tenant y por eso solo existen en el ws 1). **Todo el arranque de un cliente nuevo depende
de fallbacks del código.**

**Qué corresponde:** seedear `objetivo_desde` con la fecha de alta del ws. Las metas pueden quedar
en `null`, que es honesto (la card muestra progreso sin meta).

**Vive en:** `lib/queries.ts:2620` (`OBJETIVO_DESDE_DEFAULT`) · `lib/workspace.ts`
(`crearWorkspace`) · `supabase/migrations/0034_nutricion.sql:81` ·
*2026-07-02 ~mapa-onboarding-extraccion-retro*

### ⚠️ Los flujos con paso 'esperar' se cortan en la primera espera

`lib/flujos.ts:43` hace `break` cuando el paso es de tipo `'esperar'`: **falta el cron drenador**.
Una automatización "cuando pase X, hacé Y" que tenga un "esperar N horas" ejecuta hasta ahí y
**muere sin error ni rastro**, con la mitad de los pasos sin correr. Está anotado en dos
comentarios del propio archivo y en ningún doc.

**Consecuencia de producto:** la capacidad se puede nombrar como "lo que viene", pero **no filmar
una demo mostrándola correr**.

**Vive en:** `lib/flujos.ts:7` y `:43` · *2026-07-26 ~catalogo-de-features-de-la-landing*

---

## El canal de venta y la plantilla de funnel

### El canal se guardaba y no lo leía nadie

**Vive en:** `app/api/onboarding/route.ts` (caso `fase`) · `lib/pipeline.ts`
(`TEMPLATE_POR_CANAL`)

**Síntoma.** Ninguno visible. Ese es el punto.

**Causa.** El wizard le preguntaba al cliente cómo vende, guardaba la respuesta en
`onboarding.funnel_tipos`… y a continuación sembraba `FUNNEL_TEMPLATES[0]` —el de dos
reuniones— para todos. `grep onboarding.funnel_tipos` en todo el repo daba **dos
resultados, los dos en utilidades de clonado**: el dato se escribía y no lo consumía
nadie.

**Lo que decide el mapeo NO es el nombre del canal**, y por eso el diagnóstico obvio se
equivoca: `llamadas` suena a `highticket`. Lo único que se consume de una plantilla es
**cuántas etapas `kind: 'reunion'` tiene**, porque `reunionesDe()` y `funnelReqInfo()`
leen solo eso. De ahí salen, en cascada: qué datos exige el wizard para mover un lead,
qué nutrición genera `generateFunnel`, qué secuencias le reclama `huecosDeSecuencias`, el
pendiente «La Reunión N ya pasó» del worklist, y **qué audios se le piden al dueño en el
onboarding del Chat Agent**. Nueve consumidores; ninguno mira el id de la plantilla.

Daño concreto con la siembra vieja para un negocio de carrito: seis pasos de wizard por
una R1 y una R2 que no existen, tres etapas de No Show, siete huecos de secuencia y tres
audios sobre llamadas.

### Sobre-pedir NO es el lado seguro, aunque lo parezca

**Vive en:** `lib/stage-requirements.ts` · `lib/pipeline.ts` (`salidasDeEtapa`)

La intuición dice que ante la duda conviene la plantilla más completa: si sobra una
etapa, el cliente la borra. **Es al revés, y es asimétrico:**

- **Sobre-pedir BLOQUEA.** Con dos reuniones, `funnelReqInfo('ganado')` da `numReuniones:
  2`, y `stepsForStage` exige fecha de R2, asistencia a R2 y Fathom de R2 **aunque no haya
  fecha**. El cliente no puede cerrar un lead sin inventar una segunda reunión.
- **Sub-pedir se posterga.** Agregar una etapa en /funnel es un click y `addStage` nace
  con `kind: 'reunion'`; los requisitos aparecen solos.

La cicatriz está escrita en el propio repo: `salidasDeEtapa` tiene un bloque entero
llamado **«Cierre directo: cerró en esta misma reunión, sin la siguiente»**, que existe
porque la gente tenía que mover el lead dos veces inventando una R2. Ese parche es el
síntoma de la plantilla sobredimensionada.

Y hay evidencia de campo: de los tres clientes reales con canal `llamadas`, **uno le sacó
la R2 a mano** a su funnel.

⚠️ **`llamadas` es genuinamente ambiguo y conviene saberlo:** el texto del canal dice
«agendas una llamada y cierras la venta ahí» (UNA reunión) pero `lib/todo-seeds-data.ts`
—el único lugar que ya era canal-aware— le da a ese mismo canal tareas de «Guion del
setter (R1)» y «Guion del closer (R2)». La pregunta del canal **no captura cuántas
reuniones hay**. Se eligió `simple` por reversibilidad, no por certeza. Si algún día se
quiere afinar sin agregar una pregunta, la señal gratis ya está en el mismo request: la
fase del diagnóstico.

### El gemelo del bug: la siembra pisaba un funnel que ya existía

**Vive en:** `app/api/onboarding/route.ts` (caso `fase`)

El bloque corría **sin ninguna condición** cada vez que se guardaba el diagnóstico desde
el wizard. Un cliente con el onboarding a medias que volviera atrás y rehiciera las seis
preguntas **se comía su propio funnel editado**, en silencio y sin confirmación.

Cambiar una plantilla equivocada por una correcta que **sigue pisando** no arregla eso.
El arreglo es doble: elegir por canal **y** sembrar solo si el funnel está intacto. El
guard va en positivo — se siembra cuando el pipeline es idéntico al que da el fallback;
cualquier diferencia, hasta un label, cuenta como «el cliente ya habló».

### Por qué NO se puede escribir una migración que arregle lo ya sembrado

**Vive en:** `lib/leads.ts` (`getFunnel`/`saveFunnel`) · `lib/pipeline.ts`

`FUNNEL_TEMPLATES[0]` **es** `DEFAULT_PIPELINE` — la misma referencia. Elegir «High-ticket
· 2 reuniones» a mano en el selector de /funnel escribe **byte por byte** lo mismo que
escribía el bug. Y no hay ningún otro rastro: no existe tabla de auditoría del funnel, la
server action no escribe en `lead_audit` ni en ningún log, y el editor autoguarda con un
debounce sin registrar quién ni por qué. El único campo temporal es
`funnel_config.updated_at`, que se pisa en cada guardado.

**Por lo tanto: una migración que reescriba funnels usando como criterio «está en
highticket» es destructiva y no se puede correr.** Y hay un segundo escalón que es fácil
pasar por alto: **«sin fila» no es «vacío»**. `crearWorkspace` no siembra `funnel_config`
y `getFunnel` cae a `DEFAULT_PIPELINE`, así que crearle la fila a un workspace sin fila le
cambia el funnel exactamente igual que reescribírsela a otro.

**El dato que cerró la discusión** (consulta de solo lectura contra producción,
2026-08-09): los cuatro workspaces con canal declarado eligieron **todos** `llamadas`.
Nadie quedó dañado por el bug — y eso es justamente por qué nadie lo vio en meses. El
pasivo a reparar es cero; el arreglo es hacia adelante.

### Qué se rompe si igual se le cambia el funnel a alguien con leads

Cuatro efectos, todos silenciosos, por si algún día hay que hacerlo:

1. `etapaVigenteDe` **descarta** un `pipeline_stage` que ya no existe en el funnel y el
   lead vuelve a la etapa derivada. Ya pasó en escala: cientos de leads del ws1 con
   override a etapas que su funnel ya no tenía.
2. `deriveStageKey` deriva por FECHAS: un lead con `fecha_junta_2` deriva a `agendaj2`,
   que en un funnel `directa` no existe, y ahí `stageMeta` cae a `stages[0]` y **pinta un
   dato falso**.
3. Las secuencias de nutrición cuelgan de una etapa: si la etapa desaparece, quedan
   colgadas.
4. `salidasDeEtapa` y `faltantesParaMover` cambian de respuesta, o sea que cambian los
   requisitos de un lead que ya estaba en curso.

### La plantilla `vsl` usa claves que la derivación no conoce — y NO se tocó

**Vive en:** `lib/pipeline.ts` (`FUNNEL_TEMPLATES`, `deriveStageKey`) ·
`app/crm/CrmBoard.tsx` (`effStage`)

`deriveStageKey` habla once claves canónicas (`lead · nutri · agenda · agendaj2 ·
facturando · noshow_r1 · noshow_r2 · ganado · perdido · descal · noresp`) y `effStage`
**cae a la PRIMERA etapa** cuando la clave derivada no está en el funnel. La plantilla
`vsl` usa `registro / grupo / webinar / checkout`: un lead que agenda por Calendly deriva
`agenda`, esa clave no existe ahí, y la tarjeta aparece en «Registro (landing)». El board
no distingue registrado de asistente.

**No se cambió, a propósito.** Hay tres tests que afirman esas claves **como una
característica** —«las keys canónicas, que este funnel NO tiene, no se cuelan por el
nombre»— y verifican que `slotDeReunion` la detecte igual por `kind`. O sea que hubo una
decisión deliberada, y pisarla de costado dentro de otra tarea sería peor que dejarla
anotada. El arreglo, si se decide: claves canónicas con `label` propio
(`{ ...pk('agenda','reunion'), label: 'Webinar' }`), que mantiene la derivación viva y
cambia solo lo que el cliente lee.

Sigue siendo estrictamente mejor que lo de antes: `webinar → vsl` en vez de dos reuniones
uno-a-uno para un negocio de uno-a-muchos.

### Lo que el mapeo por canal NO arregla

Tres cosas quedan rotas igual, con la plantilla correcta:

- **`generateFunnel` siembra «Reunión excepcional» y «No Show R3» en todo funnel con
  etapa de pago**, tenga o no reuniones. Un e-commerce termina con una etapa llamada
  Reunión excepcional, y `huecosDeSecuencias` le reclama la secuencia de No Show R3.
- **La Reactivación se apaga justo donde más se necesita**: `if (reac && firstMeeting)`,
  así que un funnel sin reuniones (carrito, conversaciones) se queda sin la nutrición de
  re-contacto de fríos — que es la más obvia de un e-commerce. Y el motor del CRM
  automático sigue proponiendo `move: { to: 'reactivacion' }` hacia una etapa que ese
  funnel no tiene.
- **El copy de la nutrición de entrada dice «No agendó»** a quien nunca tuvo que agendar.
  El módulo ya sabe hacer la distinción —la aplica en el `recover`, con
  `next.kind === 'reunion' ? 'Agenda tardío' : 'Retoma'`— y solo la usa en la mitad del par.

### Al pasar, y fuera del alcance: `saveFunnelAction` no valida rol

La server action que reescribe el funnel entero del workspace llama directo a
`saveFunnel`, sin ningún guard. El único control está en la PÁGINA
(`requireRolWs([], { nav: 'crm' })`), y esconder el botón no protege nada. El aislamiento
cross-tenant sí se sostiene (`saveFunnel` resuelve el workspace con `getWorkspaceActual`,
no con un parámetro), así que no es un IDOR: el agujero es de **rol**. Cualquier miembro
del workspace puede reescribir la fuente de verdad del CRM.

## Descartado a propósito (no volver a "arreglarlo")

- **Los items 'R' permanentes y no ignorables.** Decisión de producto: el lead está trabado y
  silenciarlo lo deja colgado para siempre. Si el dueño quiere una válvula de escape, es decisión
  suya, no una corrección. Ver
  [Las etapas de reunión salen del funnel](#las-etapas-de-reunión-salen-del-funnel-no-de-un-ternario).
- **Revalidar los requisitos en los callers que vienen de un formulario.** Parece el cierre
  natural del frente y **no lo es**: el wizard valida con lo que la persona acaba de tipear, que
  todavía no está en la base. Ver
  [Quién revalida al mover un lead](#quién-revalida-al-mover-un-lead-y-quién-no).
- **Empujar a SQL el filtro en JS de `getObjetivoProgreso`.** Es el candidato obvio de una
  auditoría de eficiencia y es un **falso positivo**: (a) incluye `fecha_cierre` NULL, o sea los
  ganados sin fecha, que un `.gte` excluiría; y (b) calcula **dos ventanas** sobre las mismas filas
  (`desde` y últimos 30 días), así que empujar el `desde` a SQL rompe `cierres_30d` cuando
  `desde > hace30`. Una sola query más filtro en JS **es** el diseño eficiente acá.
  **Vive en:** `lib/queries.ts` (`getObjetivoProgreso`) · *2026-07-13 ~plan-autonomo-tanda2*
- **Aprender el techo real de PostgREST desde la primera página corta.** Se implementó y se
  revirtió; el motivo completo está en [hallazgos-infra.md](hallazgos-infra.md) §5.
- **`app/crm/actions.ts:916`**: repite el bucle del helper a propósito (ordena por `id`, tiene su
  comentario). Es duplicación, no bug.

---

## Lo que vive en otro documento

Salieron trabajando el CRM, pero el código no es del CRM y la regla que dejan gobierna a todos sus
llamadores. **Van linkeadas, no copiadas** (una entrada, un lugar):

| Qué | Dónde |
|---|---|
| **Un validador hereda las capacidades del canal donde lo ponés.** MaKo exigía por WhatsApp requisitos que ninguna de sus tools sabe cargar: el dueño quedaba en un bucle infinito de "pedí ese dato" | [hallazgos-ia.md](hallazgos-ia.md) §1 |
| **Un tope nuevo es un truncado nuevo.** Unificar seis bucles `.range()` metió un `MAX_PAGINAS` más bajo que el de tres de ellos, y el `throw` cayó en catches que degradaban | [hallazgos-infra.md](hallazgos-infra.md) §1 |
| **Dos modos de la misma pieza tienen que contestar igual.** El progreso de `WizardShell` decía "Último paso" con un "Siguiente →" abajo | [hallazgos-ui.md](hallazgos-ui.md) §1 |
| Paginado, topes de lectura y zonas horarias (`leerTodo()`/`leerPorPaginas()`; el orden de un bucle paginado tiene que ser **único**) | [hallazgos-infra.md](hallazgos-infra.md) §1 y §2 |
| Tests: `server-only`, CRLF en los guards de texto | [hallazgos-infra.md](hallazgos-infra.md) §3 |
| `getComputedStyle` con la pane oculta, z-index y pila de modales, `WizardShell` | [hallazgos-ui.md](hallazgos-ui.md) §1 y §2 |
| MaKo moviendo etapas | [hallazgos-ia.md](hallazgos-ia.md) |
| El desenlace de las nutriciones | [hallazgos-comunicacion.md](hallazgos-comunicacion.md) |

---

## Nota de proceso

Las lecciones de trabajar con **varias sesiones en el mismo árbol** (typecheck ajeno,
`git add -A`, reportes que se contradicen, y el documento que nadie toca porque los cuatro
agentes se cedieron el paso) están en [hallazgos-infra.md](hallazgos-infra.md) §4.

De este frente en particular: `SelectorHora.tsx`, `CrmBoard.tsx`, `funnel-etapas.ts` y
`google-calendar.ts` dieron errores transitorios que **no eran de quien los veía**
(`TS2552: Cannot find name 'Opcion'` / `'Stage'`, refactors a medio terminar). **El verde se toma
con el árbol estable.**

Y sobre este documento: se escribe para que **lo lea el dueño**, no solo otro agente — depurado,
con títulos, ordenado y visible en `/admin/docs`. *"si yo lo puedo entender fácil eso me habilita
a darle mejores prompts al otro claude"* (07/08).

## Alta de leads y duplicados

### ⚠️ No hay un choke point de alta: hay tres inserts y cuatro dedups que no se hablan

*2026-08-14 · mapeo de 6 agentes sobre todos los caminos de alta*

Medido, no supuesto. Insertan en `leads`:

| Camino | Dónde | Qué hacía con un duplicado |
|---|---|---|
| `createLead()` — alta manual, WhatsApp, importación, confirmar propuesta | `lib/leads.ts` | **nada**: insertaba a ciegas |
| `upsertLeadFromMeta()` | `lib/leads.ts` | matchea y **mergea en silencio** |
| `upsertLeadFromCalendly()` | `lib/leads.ts` | matchea y **mergea en silencio** |
| el importador (`marcarExistentes`) | `app/crm/actions.ts` | **descartaba** la fila aunque la persona la tildara |

Cuatro comportamientos distintos para la misma pregunta, y **ninguno** comparaba por nombre.
Las dos familias —`createLead` y los webhooks— no se llaman entre sí.

Lo que quedó: `lib/leads-duplicados.ts` (sin `server-only`) con la comparación, y `createLead`
tirando `LeadDuplicadoError` **con las coincidencias adentro** — sin los ids, la pantalla no
puede ofrecer «abrí el que ya tenés», que es lo primero que uno quiere hacer.

Tres reglas de comparación que valen más que el código:

- **El teléfono compara por sus últimos 10 dígitos.** La forma más común de que un duplicado se
  cuele es cargarlo desde WhatsApp con `+52` y tipearlo sin él.
- **El nombre compara sin acentos y sin importar el orden.** «Hurtado Gabriela» y «Gabriela
  Hurtado» son la misma persona, y así llega el mismo contacto desde un formulario y desde una
  agenda.
- **⚠️ Pero el nombre solo cuenta si NO hay email ni teléfono.** Dos «Juan Pérez» son dos
  personas distintas mucho más seguido que dos veces el mismo teléfono; con un dato fuerte
  presente, el nombre solo agrega falsos positivos.

**Y el fallback:** si la consulta de duplicados falla, **no** se bloquea el alta. Degradar hacia
«no dejo entrar a nadie» por una consulta caída pierde clientes reales — sería el fallback más
fuerte que el camino feliz.

**PENDIENTE:** los webhooks de Meta y Calendly siguen mergeando en silencio. Es el mismo
problema y no pasaron por acá.

**Vive en:** `lib/leads-duplicados.ts` · `lib/leads.ts` (`createLead`, `duplicadosDeLead`) ·
`app/crm/actions.ts` (el bucle de importación) · pendiente en `lib/leads.ts`
(`upsertLeadFromMeta`, `upsertLeadFromCalendly`)

### «Un canal propone» se acota, no se abandona

El lead de landing ahora entra **solo**. Una automatización que exige confirmar cada caso no
automatiza nada, y el costo está medido: ocho leads reales esperando un click que nadie sabía
que había que dar.

La regla de AGENTS.md no se rompe — **se acota a donde sirve**. El riesgo que cubre es un dato
que llega mal y ensucia el CRM; un formulario que la propia persona completó es el dato **más
confiable** que hay, mucho más que uno transcripto por un modelo. Lo que sí necesita ojo humano
es el **choque**: dos contactos que parecen el mismo. Ahí la máquina no puede decidir sin perder
información —fundir es irreversible y duplicar ensucia— así que ahí, y solo ahí, queda la
propuesta.

**Y el aviso dice con quién choca.** «Confirmalo» a secas, sobre algo que el resto de las veces
entra solo, se lee como que el sistema falló.

**Vive en:** `app/api/track/optin/route.ts`

### ⚠️ `createLead()` descartaba el `visitor_id`, así que el tracking no se podía leer

*2026-08-14*

`visitor_id` estaba declarado en `LeadCreateInput` y **nunca llegaba al insert**. También se
iban `origen_lead` y los UTM. Un lead creado desde la landing nacía sin el identificador de la
visita, y la tab **Tracking** de su ficha —que se busca **por** `visitor_id`— quedaba vacía.

La visita, el play, los clicks y el formulario estaban **todos** medidos en la base. Lo único
que faltaba era el hilo que los ata a la persona, que es exactamente lo que el tracking existe
para hacer. Reportado como «¿de qué sirve entonces?».

**Regla:** un campo declarado en el tipo de entrada y ausente en el `insert` no da error, no
rompe ningún test y no se ve hasta que alguien busca el dato río abajo. Cuando agregues un
campo a un `…CreateInput`, el mismo cambio tiene que tocar el insert — y si no lo toca, el
campo es decorativo.

**Ojo con lo ya creado:** los leads que entraron antes de este arreglo no tienen `visitor_id` y
**no se pueden reparar** — el dato no quedó guardado en ningún lado desde donde recuperarlo. Su
tab Tracking va a seguir vacía; los nuevos sí funcionan.

**Vive en:** `lib/leads.ts` (`createLead`) · `app/api/track/optin/route.ts`

### Los webhooks fusionaban dos contactos sin decirlo

Meta y Calendly matchean por teléfono o email y hacen `update` sobre el lead que ya estaba. Eso
está **bien** —es la misma persona volviendo, y crear una tarjeta nueva partiría su historial en
dos— pero pasaba en absoluto silencio.

Y un match por teléfono **puede equivocarse**: dos personas de la misma empresa cargadas con el
número de la recepción, o un número que la operadora recicló. Ahí el segundo se escribe encima
del primero y no queda rastro de que hubo dos.

**No se frena la fusión.** Frenarla convertiría un webhook —que corre sin nadie mirando— en una
cola de decisiones, y el resultado sería el de los ocho leads esperando. Se hace, y se cuenta:
aviso `lead-fusionado` con el link al lead resultante, con dedup de 60 min porque diez avisos
por el mismo patrón se leen como ruido y se silencian.

**Vive en:** `lib/leads.ts` (`avisarFusion`, `upsertLeadFromMeta`, `upsertLeadFromCalendly`)

### Un bloque de render puesto después del primer `return` es código muerto silencioso

El lápiz de «Tus videos» cambiaba el estado y la pantalla no cambiaba: el bloque del paso estaba
**después** del `if (!activo) return (…)`, que se dispara siempre. Un botón muerto, sin un solo
error que lo delatara.

**Y el test que contaba botones tampoco lo agarró**, porque su `slice` arrancaba en el primer
`if (!activo)` del archivo — que es el del `useEffect`, no el del render. Anclar a la primera
aparición de un patrón que existe dos veces es cómo un test mira el bloque equivocado y da
verde.

**Vive en:** `app/integraciones/ProbarTracking.tsx` · `tests/landing-optin.test.ts`
