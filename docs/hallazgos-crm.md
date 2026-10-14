# Hallazgos del CRM

Lo que hay que saber antes de tocar el kanban, la ficha del lead, el wizard "¿Qué hacer
ahora?", el selector de horarios, el worklist de "Datos sin marcar" y los requisitos de
etapa. **No es un changelog**: es lo que no se deduce leyendo el código.

**Acá va solo lo que vive en código del CRM** (`app/crm/**`, `app/leads/**`, `lib/leads.ts`,
`lib/pipeline.ts`, `lib/funnel-etapas.ts`, `lib/stage-requirements.ts`, `lib/queries.ts`,
`lib/crm-auto.ts`, `lib/google-calendar.ts`, `lib/auto-reuniones.ts`, `lib/mako-confirmaciones.ts`,
`lib/fathom-auto.ts`, y el Closing: `lib/closing.ts`, `lib/post-llamada.ts`; de la API de MaKo,
`lib/api-mako/areas/crm.*` y `closing.*`). Lo que se aprendió en
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

## Configurar el funnel: qué es seguro tocar y qué no

### ⚠️ Renombrar una etapa es seguro; el `kind` y el ORDEN no, y el editor los deja como sea

**El miedo era el equivocado, y medirlo lo cerró.** Se temía que renombrar «R1 / R2» rompiera
automatizaciones. No: **toda la lógica cuelga de la CLAVE canónica, del `kind` y del ORDEN**, y
la única comparación por label en todo el repo es `mismoPipeline`, que es deliberada. Ya hay
tres workspaces en producción con labels propios («1ª sesión sin costo», «En revision»,
«TASACION / PRE LISTING») y el CRM funciona.

Dos riesgos que parecían graves y se midieron como falsos:

· **La nutrición NO se rompe al renombrar.** `nutricion_secuencias.etapa` se lee sólo cuando el
  trigger es `etapa_actual`, y en toda la base hay 7 filas con ese trigger, **las 7 inactivas y
  archivadas, con 0 inscripciones históricas**. Esa rama nunca corrió.
· **El CRM automático tampoco.** `deriveStageKey` es un switch puro sobre claves canónicas sin
  ninguna noción del funnel, así que un lead recién entrado da `'lead'` se llame como se llame
  la entrada de ese workspace. Medido: **cero leads en toda la base tienen
  `pipeline_stage='lead'`** — nada lo escribe al crear.

**Lo que SÍ rompe, y con un caso real y caro.** Medido el 28/09/2026 sobre el funnel que una
inmobiliaria armó a mano, traído de producción:

| clave | kind | label |
|---|---|---|
| `lead` | entrada | Lead (Instant form) |
| `agenda` | grupo | En revision |
| **`ganado`** | **grupo** | **Calificado** ← la venta, tipada como grupo |
| **`st0`** | **CIERRE** | **NO Calificado** ← el DESCARTE, tipado como cierre |
| `st1` | reunion | TASACION / PRE LISTING |

Corriendo `funnelReqInfo` + `stepsForStage` con ese pipeline:

· «NO Calificado» da `esVenta: true` y pide fecha de R1, asistencia, el Fathom, el **closer** y
  el **monto de cierre**. O sea que **el sistema pide el monto de la venta para DESCALIFICAR a
  alguien**.
· «Calificado» —cuya clave hace que `terminalEstadoFor` escriba `estado_lead='ganado'`— da
  `esVenta: false` y no pide nada. **La venta real no pide monto.**
· Y el cierre no es la última etapa, así que **la última exige MENOS que la cuarta**: el orden
  de exigencia está invertido, y mover un lead más allá del cierre le borra el monto.

**La consecuencia, en una consulta:** ese workspace tiene **5 leads en `ganado` y CERO con monto
de cierre cargado**. Sus ventas no tienen un peso anotado y el Segundo Cerebro cuenta a los
descalificados como cierres. **Nada falló nunca**: la pantalla lo dejó guardar y no dijo una
palabra.

**La regla:** cuando una pantalla deja configurar algo de lo que después cuelga el
comportamiento, el editor tiene que decir qué quedó mal armado. `sanearPipeline` sólo
comprobaba que fuera una lista con claves — que es una validación de FORMA, y el daño vive en
el SIGNIFICADO.

⚠️ **AVISA, NO BLOQUEA** («guardar NUNCA se bloquea», decisión del 17/09). Un funnel a medio
armar se guarda igual; lo que no puede es quedar roto Y callado. Y el aviso **nombra la
etapa**: «hay un problema en tu funnel» no sirve cuando el cliente tiene cinco y no sabe cuál
tocar.

⚠️ **Y el test mide las DOS mitades.** Que marque el funnel roto, y que **NO marque ninguna de
las 7 plantillas que sembramos nosotros**: un guard que también marca lo bueno se ignora en una
semana, y con él se ignora el caso real.

**Vive en:** `lib/pipeline.ts` (`problemasDePipeline`) · `app/funnel/FunnelEditor.tsx` ·
`tests/funnel-estructura.test.ts`

### ⚠️ Lo que falta para el onboarding del CRM — y la mitad que YA estaba construida

Martín pidió (27/09) que el CRM tenga un onboarding para configurar las etapas: «saber si es
presencial, si vende con llamadas, solo con WhatsApp, venta carrito». **La mitad ya existe y
nadie lo sabía:**

· `CANALES` (`lib/fase-diagnostico.ts`) son **exactamente** los cinco que él enumera:
  llamadas, conversaciones, carrito, webinar, presencial.
· `FUNNEL_TEMPLATES` (`lib/pipeline.ts`) son 7 plantillas, **incluida `presencial`**.
· `TEMPLATE_POR_CANAL` + `templateDeCanal` ya siembran las etapas del canal declarado, y
  `templateDeCanal` falla cerrado.

**Lo que falta es la PUERTA**, y son tres huecos medidos:

1. **Ni `crm` ni `funnel` están en `TAB_ONBOARDINGS`** (declara 11 tabs, ninguna es ésa). El
   prefijo de uno nuevo tiene que ser `crm_`: dos pasos que comparten nombre se marcan solos
   entre sí, y hay test que lo persigue.
2. **La siembra corre UNA sola vez en la vida del cliente** (el paso `fase` del wizard global), y
   el hub no propaga el canal: cambiar «cómo vendo» después **no mueve el funnel**. Y
   `funnels.canal` está NULL en los 11 funnels de producción, así que el override por funnel
   no se usa.
3. **`entradas` está vacío en 6 de los workspaces con `declarado=true`** (ws 1, 4, 10, 13, 14,
   15) — el único que lo declaró es el ws11, y es justo el único que recibe formularios sin
   reserva (6 de 8). A los otros, un opt-in de formulario **se les descartaría**; lo único que
   los salva hoy es la excepción de Cal.com. Y la tarjeta donde eso se declara la monta
   **sólo** `app/funnel/page.tsx`: el onboarding y el Segundo Cerebro montan el editor SIN
   ella, y /funnel no está en el nav.

⚠️ **Y por qué la entrada del catálogo NO se agrega sin la pantalla:** declarar el onboarding
de una tab la GATEA. El CRM es la primera tab de todos los roles (el fallback de
`tab-access`), así que un onboarding declarado y sin pantalla que lo complete deja a todo el
mundo afuera del CRM. Es «una guarda bloquea sólo lo que se arregla haciendo lo que ella
pide», aplicada al peor lugar posible.

**Y lo que NO hace falta, medido:** «ellos no tienen closer» no bloquea nada. El camino de
MOVER un lead no pasa esos campos —`app/crm/actions.ts` lo dice textual: «Higiene
(setter/closer/empresa/deal/comprobante) NO gatea el movimiento»— y con un solo usuario el
closer se autoasigna. Es higiene, no un requisito.

**Vive en:** `lib/tab-onboarding-catalogo.ts` · `lib/fase-diagnostico.ts` ·
`app/funnel/EntradasCard.tsx` · `app/api/onboarding/route.ts`

- **«Se ven 4 ganados de 13»** no era un filtro: `_listLeads` no paginaba y PostgREST cortó en
  1000 los leads más viejos, que eran los clientes cerrados. La misma lectura estaba copiada
  en seis lugares más → [`_listLeads` y sus seis copias](#️-_listleads-faltaban-9-de-13-ganados-y-la-misma-lectura-estaba-copiada-seis-veces).
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
- **Cargarle una reunión a un lead GANADO le borra el ingreso**, y marcar asistencia o
  calificado le avisa a Meta sin vuelta atrás: `updateLead` escribe más de lo que le pasás.
  → [`updateLead` no es un UPDATE](#-updatelead-no-es-un-update-borra-columnas-que-no-le-pasaste-y-le-avisa-a-meta)

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

### Guardar nunca se bloquea por datos que faltan (reemplaza «ninguna blanda»)

**Decisión vigente (17/09, Martín, tarea 08-T22).** Mover de etapa y cambiar un dato se
guardan **siempre, Ganado incluido**. Lo que la etapa pide y falta vuelve como
`pendientes`: se avisa en el toast del movimiento («Queda pendiente: … · Completar
ahora»), queda marcado en la card y en la ficha, y MaKo lo pide después (08-T23), nunca
mientras la persona está operando. Queda en el historial como `Datos pendientes`, con
quién lo guardó así — no es lo mismo que un dato que nadie vio.

**La decisión que reemplaza (21/06 y 03/07):** mover a una etapa que exigía información
abría el detalle y **no dejaba guardar**; cancelar revertía. «Todas obligatorias, ninguna
blanda.» Venía de *"si muevo un lead a «Ganado», solo me pide el monto"* y de *"Jorge
Negrete está en GANADO cuando aún no se han marcado las reuniones"*.

**Por qué cedió — lo que se midió:**

- Mauricio, 08/09 [34:00]: *«me meto al CRM y me pregunta un chorro de cosas… quiero
  nomás cambiar este… yo veo esto que me dice define no sé cuántas cosas y ya lo
  abandono»*. Actualizaba el CRM **una vez por semana**.
- **La regla no protegía lo que decía proteger.** Se justificaba por Meta, pero a Meta le
  llegan exactamente DOS datos del CRM, y ninguno depende de mover la etapa:
  `calificado` → evento `Lead`, y `asistió a la R1` + `calificado` → `QualifiedLead`
  (`lib/leads.ts`, `updateLead`). **No existe evento de compra: pasar a Ganado no le manda
  nada a Meta.** Con la regla dura, esos dos datos llegaban una semana tarde o nunca.
- Por eso son los únicos que se siguen ofreciendo en el momento: dos toques opcionales en la
  confirmación de mover, solo si faltan y si la R1 ya pasó (`app/crm/senales-meta.ts`).

**El diagnóstico obvio era el equivocado.** El brief suponía que Mauricio había visto el
wizard de etapa. La grabación dice otra cosa: *«define no sé cuántas cosas»* y *«qué pasó
con algo de hace una semana»* son el texto literal de la lista «Datos sin marcar»
(`«La Reunión 1 del X ya pasó… — define qué sigue»`, el único «define» de todo el CRM), más
cada card incompleta titilando en rojo. Lo que lo espantaba era **la entrada**, no solo el
movimiento. Por eso el cambio tocó las dos cosas: la lista informa en vez de ordenar, y las
cards marcan lo pendiente sin parpadear.

**Lo que se mantuvo:** la confirmación al soltar una card (pedido del 07/08: arrastrar es fácil
de hacer sin querer) y la lista «Datos sin marcar» como lugar donde está todo lo pendiente.
Faltar datos sigue sin ser un error; ahora tampoco es un freno.

**La ficha mueve igual que el tablero.** Elegir otra etapa en `LeadSheet` o en
`[id]/LeadDetailBody` confirma y mueve (`MoverEtapaConfirm`), y si queda algo pendiente
lo dice con «Completar ahora / Después». Las etapas de reunión y la nutrición manual
siguen abriendo el wizard, igual que en el tablero: ahí hay una fecha o un plazo que
decidir (`pideWizardAlElegir`, en `mover-etapa.ts`). Los chips de Meta son UNA pieza
(`SenalesMetaChips`), que el tablero importa en vez de copiar.

⚠️ **Trampa: un funnel sin `kind` no sabe cuáles son reuniones.** `slotDeReunion` deriva las
reuniones del `kind: 'reunion'` de cada etapa, y `DEFAULT_STAGES` no lo trae. Es lo que
recibe la ficha cuando no se pudo leer el funnel (`getLeadFullAction`). Sin respaldo, mover
a Agenda R1 desde la ficha salteaba la pregunta de la fecha. `pideWizardAlElegir` cae a
`agenda`/`agendaj2` cuando ninguna etapa trae `kind`.

**Qué pasa con lo que no se completó — verificado camino por camino (para 08-T23).**
Todo guardado HACIA ADELANTE que deja algo sin completar escribe una línea en `lead_audit`,
porque los caminos de la interfaz terminan en dos acciones del server y las dos llaman a
`registrarPendientes`:

| Camino | Acción del server | Línea en `lead_audit` |
|---|---|---|
| Soltar una card en el tablero | `setLeadStageAction` | `Datos pendientes` |
| Ficha: elegir otra etapa (`MoverEtapaConfirm`) | `setLeadStageAction` | `Datos pendientes` |
| Wizard: «Guardar y completar después» o «Confirmar» | `completeStageMoveAction` | `Datos pendientes` |
| «¿Qué hacer ahora?» | `resolverQueHacerAction` → `completeStageMoveAction` | `Datos pendientes` |
| Movimiento automático (MaKo, crm-auto, nutrición) | `setPipelineStage` con `{ omitir }` | `Etapa sin validar` |
| Deshacer / Restaurar desde el historial | `undoStageMoveAction` / `revertAuditChangeAction` | ninguna, a propósito: un cambio deshecho no deja historia |
| Nutrición manual | `markManualNutritionAction` | ninguna: su propio formulario pide el motivo y el plazo |

⚠️ **La trampa para quien haga que MaKo lo pida: la línea es HISTORIA, no la lista viva.**
Dice quién dejó qué sin completar y cuándo, y **no se borra cuando después alguien lo
completa**. Lo que falta AHORA sale en vivo de `faltantesDeLead` / `getPendientesDeMarcar`.
Si MaKo arma sus preguntas desde la línea del historial, va a pedir datos que ya se cargaron,
que es peor que no preguntar. La línea sirve para saber desde cuándo y quién (por ejemplo,
para decidir cuándo preguntar); qué preguntar sale de la derivación en vivo. Tampoco alcanza
con mirar `Datos pendientes`: los movimientos automáticos dejan `Etapa sin validar`.
Deduplicado: solo se compara contra la última línea del lead; la misma lista no se repite.

**Lo que quedó sin hacer:**

- **Enter sobre un chip de Meta confirma el movimiento sin registrar el toque.** `Confirm`
  (`app/_ui/Confirm.tsx`) escucha Enter en fase de captura sobre `document`, así que
  confirma antes de que el botón del chip reciba su click. El daño es acotado: se guarda sin
  la señal opcional, que es lo mismo que no tocarla, y con mouse o con Espacio anda bien. El
  arreglo es de `Confirm`, un componente compartido: que Enter no confirme cuando el foco
  está en otro botón del diálogo.
- **Que MaKo pida lo pendiente** es 08-T23, otra tarea. Lo pendiente ya es consultable: sale
  de `faltantesDeLead` / `getPendientesDeMarcar`, y cada guardado incompleto deja una línea
  `Datos pendientes` en `lead_audit`.

**Vive en:** `app/crm/actions.ts` (`registrarPendientes`, `setLeadStageAction`,
`completeStageMoveAction`) · `app/crm/CrmBoard.tsx` (`handleDrop`, el toast, las cards) ·
`app/crm/StageMoveDialog.tsx` (la salida) · `app/crm/senales-meta.ts` ·
`app/crm/MoverEtapaConfirm.tsx` + `app/crm/mover-etapa.ts` (la ficha) · `lib/queries.ts`
(el texto de la lista) · `tests/guardar-sin-bloquear.test.ts`

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

*2026-09-16 api-mako-areas:* la regla vive hoy en `lib/leads.ts:532-534`, y muerde fuera del
wizard también: marcar que no vino a la R1 borra el calificado, y volver a marcar que sí vino
no lo devuelve. Ver la entrada siguiente.

### ⚠️ `updateLead` no es un UPDATE: borra columnas que no le pasaste y le avisa a Meta

**Síntoma:** un lead GANADO pierde su monto y su fecha de cierre cuando alguien le carga a mano
la fecha de una reunión vieja. Nadie tocó el ingreso.

**Causa:** `setMeetingManual` reabre todo lead que no esté `abierto` (`lib/leads.ts:849-850`).
Su comentario dice por qué (:845-848): se pensó para los MOVIMIENTOS del kanban, donde un
Ganado → R2 sin reabrir «no hace nada». Pero la misma función carga una fecha desde
`markMeetingManualAction` (`app/crm/actions.ts:1744`) y desde la API, que la ofrece para
completar datos viejos, y ahí la premisa del comentario ya no vale. El resto lo deriva
`updateLead` solo:

- `estado_lead: 'abierto'` → `cerro = null` (:513) → `monto_cierre_usd` y `fecha_cierre` en
  null (:535-537), y `motivo_perdida` en null (:523-525). El monto queda en el historial; la
  fecha de cierre **no**, porque no está en `AUDIT_FIELDS` (:914-932): esa se pierde.
- `asistio_j1 !== true` → `calificado = null` (:532-534).
- Y **después** de guardar dispara Meta CAPI (decide en :552-564, manda en :606-630): `Lead`
  cuando `calificado` pasa a true, `QualifiedLead` cuando `asistio_j1` y `calificado` quedan
  los dos en true. Lo manda todo camino que termine en `updateLead`: marcar asistencia,
  marcar calificado, cargar una reunión con asistencia y la asistencia que marca Fathom
  (`applyFathomRecording`, :894-896).

**Reversible en el CRM no es reversible en Meta.** Y como el no-show borra el calificado,
deshacerlo y volver a calificar manda el `Lead` **otra vez**. Ojo con la etiqueta:
`proponer_cambio_etapa` está declarada `reversible: true` y su propio `escribe` dice que
«puede mandar la conversión a Meta» (`lib/api-mako/areas/crm.def.ts:288`).

**Regla:** antes de llamar `updateLead` desde un camino nuevo, enumerá lo que DERIVA (cerro,
motivo, calificado, montos de cierre) y lo que DISPARA (CAPI, y la etiqueta de WhatsApp en
:634), y decilo antes del «sí». La API lo hace en `preparar` (`crm.run.ts:444-446` y
`:722-732`) y se niega a cargarle una reunión a un ganado. Es la familia de
[El revert de MaKo guarda tus intenciones](#el-revert-de-mako-guarda-tus-intenciones-no-el-estado-del-lead):
lo que se toca de rebote no está en tu patch.

**Lo que quedó SIN hacer:** la pantalla no avisa. `markMeetingManualAction` reabre un ganado
y le borra el ingreso sin preguntar. La cura va en `setMeetingManual`
(`lib/leads.ts:849-850`): reabrir solo cuando el que llama es un movimiento, no cuando carga
una fecha. No se tocó porque la lib es compartida con el kanban.

**Vive en:** `lib/leads.ts` (`updateLead`, `setMeetingManual`, `AUDIT_FIELDS`) ·
`app/crm/actions.ts` (`markMeetingManualAction`) · `lib/api-mako/areas/crm.run.ts`
(`marcar_reunion_manual`, `marcar_asistencia_reunion`) · `lib/api-mako/areas/crm.def.ts` ·
*2026-09-16 api-mako-areas*

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

*2026-09-16 api-mako-areas:* por la misma razón —el estado tiene que vivir en la base— la API
de MaKo **no** ofrece sincronizar las llamadas, re-analizar una ni re-evaluarla con MaKo:
`syncClosingCalls`, `analyzeOne` y `reviseWithMako` (`lib/closing.ts:780`, `:906`, `:977`)
pagan IA de forma síncrona y no escriben fila de estado; `closing_jobs` es por lead, no por
llamada. Se hacen desde `/closing`. Tampoco hay «grabaciones de Fathom sin analizar»:
`preClassify` (:177) necesita saber quién es del equipo, eso lo resuelve
`internosDelWorkspace` (:157), que es privada, y sin ella el parámetro cae a `SIN_INTERNOS`
**sin avisar**: un integrante del equipo invitado cuenta como prospecto externo (:180, :190) y
la reunión sale candidata a venta, o sea a pagar.

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

### ⚠️ El barrido de Fathom engancha R1 y R2 con el lead de antes, y la segunda borra la primera

**Síntoma:** el barrido informa «enganché 2 grabaciones» y en la ficha del lead aparece una.

**Causa:** `adjuntarFathomAuto` recorre `j1` y `j2` con el MISMO objeto `lead`, leído al
principio de la corrida (`lib/fathom-auto.ts:71-90`). `applyFathomRecording` arma
`fathom_links = [...lead.fathom_links, nueva]` desde ese objeto (`lib/leads.ts:881-886`) y lo
escribe entero (:897-899). La segunda llamada no ve el link que la primera acaba de escribir y
lo pisa. `adjuntados` suma 2 igual (`fathom-auto.ts:88-89`).

Pasa desapercibido porque se cura solo: con menos de 2 links el lead vuelve a ser candidato
(:61) y la corrida siguiente completa el que falta, mientras la reunión siga dentro de la
ventana (`diasAtras`, 5 días por defecto). Es el mismo last-write-wins sobre un array que ya
mordió al revert de MaKo.

Y el contador tampoco distingue «no hay» de «no pude»: si Fathom no contesta, la lectura cae a
`[]` (:33), y si `applyFathomRecording` tira, cuenta como «no enganchado» (:88). «Revisé 12,
enganché 0» sale igual en los dos casos.

**Regla:** una función que recibe la fila y escribe un array derivado de ella necesita la fila
FRESCA en cada llamada. Si se la llama en un bucle sobre el mismo objeto, se relee entre
llamadas, o la función relee la columna antes de escribir.

**Lo que quedó SIN hacer:** refrescar `lead.fathom_links` entre J1 y J2
(`lib/fathom-auto.ts:75-90`), o que `applyFathomRecording` relea la columna
(`lib/leads.ts:881-887`). No se tocó porque las dos libs son compartidas; la operación
`adjuntar_grabaciones_fathom` de la API lo avisa en su resumen
(`lib/api-mako/areas/closing.run.ts:516-521`). Marcar asistencia desde acá también manda CAPI:
ver [`updateLead` no es un UPDATE](#-updatelead-no-es-un-update-borra-columnas-que-no-le-pasaste-y-le-avisa-a-meta).

**Vive en:** `lib/fathom-auto.ts` (`adjuntarFathomAuto`) · `lib/leads.ts`
(`applyFathomRecording`) · *2026-09-16 api-mako-areas*

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

### Reagendar movía cualquier evento que el dueño tuviera a la hora vieja (09/10/2026)

**Síntoma:** grabando el video de la verificación de Google, «Reagendar» de un lead de prueba
en el CRM (ws9) movió la instancia del jueves 8 a las 15:00 de «Sprint 4» —una serie del
dueño, sin invitados— al domingo 12 a las 10:00. Se restauró a mano desde Google Calendar
(«sólo este evento»). No avisó a nadie porque no tenía invitados; con invitados, les habría
llegado el cambio.

**Causa:** `buscarEventoDeReunion` aceptaba un evento con UNA de tres pruebas, y dos no
probaban nada:
- «arranca a ±10 min de la reunión vieja»: la hora sola dice que hay algo a esa hora, no de
  quién es. La reunión vieja del lead era a las 15:00, y Sprint 4 también.
- «el lead está invitado»: el lead tenía el email del DUEÑO, y Google lista al dueño en sus
  propios eventos con `self: true`. Ese lead «estaba invitado» a todo lo que el dueño tiene.

⚠️ **El diagnóstico obvio era el equivocado:** «la ventana de 10 minutos es muy ancha».
Con cualquier ventana la hora sola sigue sin decir de quién es el evento: con 1 minuto,
Sprint 4 se movía igual.

**La regla que queda:** al evento al que se le pega un PATCH con `sendUpdates=all` se lo
identifica con una PRUEBA —el lead invitado de verdad, o un título parecido sobre un evento
que no es con otra persona— y la cercanía a la hora vieja sólo desempata. Un invitado con
`self: true` es el dueño de la agenda y no prueba nada sobre el lead. Vale igual para
`eventoExacto` (cancelar y cambiar) y `proximasReunionesCon` (las que MaKo ofrece mover).

**Lo que cambia para quien usa el CRM:** si la reunión no tiene al lead invitado ni su nombre
en el título, «Reagendar» CREA un evento nuevo en vez de mover el viejo (recuperable: el viejo
queda a la vista), y MaKo por WhatsApp contesta que no la encontró. Es el precio elegido:
lo de antes podía mover la agenda de un tercero y avisarle a sus invitados.

**Vive en:** `lib/calendario-reunion.ts` (la regla, pura y con test) ·
`lib/google-calendar.ts` (`buscarEventoDeReunion`, `eventoExacto`, `proximasReunionesCon`) ·
`tests/calendario-reunion.test.ts` (la agenda de ese día como fixture; probado rompiéndolo)
· *2026-10-10*

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

**Y hay una segunda forma de que Calendly deje de entrar, sin tocar nada de esto:** que el
proveedor DESHABILITE la suscripción. Pasó del 10/09 al 19/09/2026 — nueve días sin una sola
agenda, con la tab en verde y el endpoint sano — y cuesta 8 reservas: una persona que nunca
existió en el CRM y un lead al que el motor siguió nutriendo porque su `fecha_junta_1` quedó
vacía. Se recupera con `scripts/backfill-calendly.ts`. El detalle, con las tres trampas de la
API de Calendly y la prueba firmada que parecía desmentir el arreglo, en
[hallazgos-infra.md](hallazgos-infra.md) → «Una suscripción de webhook se DESHABILITA sola».

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

---

## Closing: el análisis de las llamadas y el follow-up

El botón que analiza una llamada, su candado (`closing_jobs`) y la búsqueda automática están
más arriba, en [Agenda](#agenda-horarios-calendly-y-fathom). Lo del modelo y su costo, en
[hallazgos-ia.md](hallazgos-ia.md).

### ⚠️ Corregir el desenlace de una llamada le cambia el score, aunque nadie toque un puntaje

**Síntoma:** se marca una llamada como ganada, o se corrige su resumen, y su score cambia. Se
mueven el panorama, el ranking de closers y la tendencia.

**El diagnóstico obvio era el equivocado:** «alguien editó un puntaje». No. `reviseAnalysis`
recalcula **siempre** el score como promedio de las dimensiones, llegue o no una dimensión
corregida (`lib/closing.ts:948-956`). El score guardado es el global del modelo
(`clampScore(a.score)`, :581), que no es el promedio de sus dimensiones, así que la primera
edición de **cualquier** campo lo reemplaza. De paso estampa `origen_clasif: 'manual'` (:957)
aunque solo se haya tocado texto. El `edit_history` sí registra `score_antes` y
`score_despues` (:965-968): el rastro está, lo que no está es la intención.

Recalcular cuando se corrige un puntaje es a propósito: el pedido fue que corregir las
valoraciones tenga «efecto sobre el puntaje final» ([hallazgos-ia.md](hallazgos-ia.md)). El
bug es hacerlo cuando no se tocó ninguno.

La pantalla `/closing` tiene el mismo efecto y no avisa (`app/api/closing/revise/route.ts:46`).
La API calcula el score nuevo en `preparar` y lo dice antes del «sí»
(`lib/api-mako/areas/closing.run.ts:390-398`).

**Regla:** una edición recalcula solo lo que depende de lo que se editó.

**Lo que quedó SIN hacer:** recalcular solo si `input.dims` trae algo
(`lib/closing.ts:948-952`). No se tocó: la lib es compartida y cambia lo que ya muestra
`/closing`.

**Vive en:** `lib/closing.ts` (`reviseAnalysis`) · `app/api/closing/revise/route.ts` ·
`lib/api-mako/areas/closing.run.ts` (`marcar_resultado_llamada`, `corregir_puntajes_llamada`) ·
*2026-09-16 api-mako-areas*

### ⚠️ `lib/closing.ts` lee `closing_analyses` sin paginar: pasadas las 1000 filas, vuelve a pagar lo ya analizado

**Síntoma esperado** (sale de leer el código, no se midió): una llamada ya analizada se vuelve
a pagar a Claude, y su valoración corregida a mano vuelve a la del modelo.
En `/closing` la tendencia pierde los primeros meses.

**Causa:** tres `select` pelados que PostgREST corta en 1000 filas sin avisar.

1. **El Paso 0 de `analizarLlamadasDeLead`** (`lib/closing.ts:677-679`), que re-engancha
   gratis lo ya analizado: no ve las filas de más allá de las 1000.
2. **`doneByRec`** (:692-695): una grabación analizada que quedó afuera no está en el mapa, así
   que se corre `analyzeMeeting` otra vez (:727-730) — se paga — y `upsertRow` pisa score,
   dimensiones y desenlace. Conserva el `edit_history` (:602-611), pero no los números que ese
   historial describe.
3. **`getClosingViewData`** (:1047-1054): las ventas vienen por `call_date` descendente, así que
   se pierden las más viejas. Los contadores (`allRes`) cuentan hasta 1000, y su error ni se
   mira: solo se chequea el de ventas (:1057). `/closing` queda corta sin enterarse; la API lo
   compensa con un `count` aparte y una advertencia (`closing.helpers.ts:48-61`).

**Y el Paso 0 le saca la llamada a otro lead sin dejar rastro.** Si coincide el email del
invitado, re-engancha aunque la fila ya estuviera en otro lead (:680-687, y lo mismo en
:718-725): un `update` directo a `closing_analyses`, sin historial en ninguno de los dos leads.
Por eso tampoco hay una operación «re-enganchar esta llamada a este lead»: no existe como
función, vive inline acá.

**Regla:** toda lectura de `closing_analyses` que decida qué se paga pasa por `leerTodo`
(`lib/supabase-paginado.ts`), como ya hace `closing.helpers.ts:93`.

**ARREGLADO el 17/09/2026.** Las tres pasan por `leerClosingAnalyses` (`leerTodo` ordenado por
`recording_id`, único por inquilino). El orden por `call_date` de `/closing` se hace en memoria,
con los sin fecha al final: `call_date` se repite y no sirve para paginar. Y el Paso 0 y el set
«done» **lanzan** si la lectura falla: antes `done.data ?? []` dejaba el set vacío y se volvían a
pagar todas las llamadas del lead. Lo mismo en `lib/ads-analyst.ts` con `script_analyses`
(`leerScriptAnalyses`, por `ad_id`). Queda sin paginar `app/crm/insights-actions.ts:56`, que lee
la tabla entera para contestar «¿este lead tiene llamada?».

**Y los números de `/closing` se calculan en dos lugares.** Closers, factores, tendencia y
embudo vivían solo en el `useMemo` `ag` de `app/closing/ClosingBrowser.tsx:129`;
`lib/api-mako/areas/closing.helpers.ts:128-186` los copia para la API. Si cambia el criterio en
uno, el otro miente. **Pendiente:** mudarlos a un módulo sin `server-only` que importen los dos.

**Vive en:** `lib/closing.ts` (`analizarLlamadasDeLead`, `upsertRow`, `getClosingViewData`) ·
`app/closing/ClosingBrowser.tsx` · `lib/api-mako/areas/closing.helpers.ts` ·
*2026-09-16 api-mako-areas*

### ⚠️ El follow-up post-llamada puede redactarse sobre OTRA llamada, y vuelve a analizar sin candado

**Síntoma:** «sin análisis de la llamada — no redacto a ciegas» sobre una llamada analizada
hace tres días, o un borrador de WhatsApp sobre la charla equivocada.

**Causa, en dos partes:**

1. **La llamada se elige por un token, con una caída silenciosa.** `analisisDeLaLlamada`
   (`lib/post-llamada.ts:84-100`) busca por el `embed_token` sacado del `share_url`. Si el link
   no trae `/share/`, si la fila tiene `embed_token` null o si no encuentra, cae a «la más
   reciente del lead en las últimas 48 h» (:91-99). Con R1 y R2 en dos días elige la que no
   era; con la llamada fuera de la ventana, ninguna. El webhook de Fathom pasa el `share_url`
   del payload tal cual (`app/api/webhooks/fathom/route.ts:157-161`).
2. **Vuelve a analizar adentro, sin el candado.** `redactarFollowUpPostLlamada` corre
   `analizarLlamadasDeLead` antes de redactar (:152-156). El candado de `closing_jobs` lo toman
   la ruta del botón (`app/api/closing/analizar-lead/route.ts:50`) y las dos operaciones de la
   API (`closing.run.ts:487` y `:574`); **no** lo toman el webhook de Fathom ni
   `analizarLlamadaLeadAction` (`app/crm/insights-actions.ts:31`). Si coinciden, se paga dos
   veces la misma grabación.

**Efecto de la mitigación, para no confundirlo con un bug:** la operación de la API toma el
MISMO candado y lo cierra con el detalle del follow-up (`closing.run.ts:574-589`). Mientras
tanto, `estado_analisis_lead` y la pantalla de Insights del lead muestran «Revisé las llamadas
para el follow-up…» en lugar del resumen del último análisis.

**Regla:** una búsqueda por identificador exacto no cae a «la más reciente». Si el id no
resuelve, se dice. La API ya exige que el token del link coincida con el de la fila antes de
proponer (`closing.run.ts:554-561`); el webhook sigue con la caída.

**Lo que quedó SIN hacer:** un parámetro en `redactarFollowUpPostLlamada` para no volver a
analizar cuando la llamada ya está analizada (`lib/post-llamada.ts:152-156`). No se tocó: lib
compartida con el webhook.

**Vive en:** `lib/post-llamada.ts` (`analisisDeLaLlamada`, `redactarFollowUpPostLlamada`) ·
`app/api/webhooks/fathom/route.ts` · `app/crm/insights-actions.ts` ·
`lib/api-mako/areas/closing.run.ts` (`redactar_followup_post_llamada`) ·
*2026-09-16 api-mako-areas*

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

### ⚠️ Resolver una confirmación que ya estaba resuelta no hace nada, y contesta «listo»

**Síntoma:** dos personas —o la pestaña del CRM y MaKo por WhatsApp— resuelven la misma
confirmación. La segunda recibe éxito y no pasó nada: su «rechazar» no revirtió, porque el
otro ya había confirmado.

**Causa:** `resolverConfirmacion` hace `if (c.estado !== 'pendiente') return;`
(`lib/mako-confirmaciones.ts:147`), sin error y sin decir qué encontró. La acción del modal
devuelve `{ ok: true }` igual (`app/crm/mako-confirm-actions.ts:24-33`). Y el cierre de la
fila (:196-199) no filtra por `estado = 'pendiente'`: dos resoluciones simultáneas leen las
dos «pendiente» en :144 y aplican las dos ramas — un rechazo que revierte y una opción que
mueve de etapa, sobre el mismo lead.

**Regla:** una función que aplica una decisión devuelve **si la aplicó**. Un `return` mudo
convierte en éxito todo lo que venga después, y ningún caller lo puede distinguir.

La API lo mitiga leyendo el estado antes (`resolver_confirmacion_crm`,
`lib/api-mako/areas/crm.run.ts:616-619`), con una lectura por id escrita a mano en
`crm.helpers.ts:42-46` (`estadoConfirmacion`) porque la lib no la exporta. Es leer y después
actuar: achica la ventana, no la cierra.

**Lo que quedó SIN hacer:** que `resolverConfirmacion` devuelva `{ aplicada, estado }`, que el
cierre filtre por `estado = 'pendiente'` y cuente las filas, y exportar la lectura por id para
borrar la copia del helper. ⚠️ **No reclamar ANTES del efecto sin pensarlo:** si
`setPipelineStage` tira porque falta un dato, la confirmación queda pendiente **a propósito**
para que el humano la resuelva desde la ficha (:186-189). Un reclamo previo rompe eso.

**Vive en:** `lib/mako-confirmaciones.ts` (`resolverConfirmacion`) ·
`app/crm/mako-confirm-actions.ts` · `lib/api-mako/areas/crm.helpers.ts`
(`estadoConfirmacion`) · *2026-09-16 api-mako-areas*

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

**Una causa más, que sale de leer el código (16/09/2026, no medida):** `getTrackingEvents`
(`lib/leads.ts:1650-1692`) pide `limit` filas **por tabla** (120 por defecto) y **después**
descarta de `vsl_events` lo que no es de video (:1684). Desde el snippet v14 esa tabla recibe
también `salio`, `volvio`, `cierre`, `click` y `agendo`, así que a un visitante con muchos
eventos de página las 120 filas más recientes pueden ser todas de página y el `play` queda
afuera: la ficha dice que no vio el VSL. El largo del resultado no dice si hubo recorte.

Y el vacío tampoco distingue «no pude»: el `catch` devuelve `[]` (:1690-1692), y los errores
de las dos queries ni llegan al catch (`data ?? []`, :1667 y :1670), así que una tabla que
falla deja la línea de tiempo a medias sin aviso. La API lo compensa pidiendo 200 y cortando a
60, con una nota de «puede ser que falló la lectura» (`lib/api-mako/areas/crm.run.ts:249-259`);
la ficha (`app/crm/[id]/page.tsx:69`, `app/crm/actions.ts:183`) y `lib/lead-insights.ts:366`
siguen con 120. **Pendiente:** filtrar los tipos de video EN la query de `vsl_events`, no
después, y devolver el error en vez de `[]`.

**Vive en:** `TrackingTimelineCard` · `lib/leads.ts` (`getTrackingEvents`) · el tracking del VSL (ver también
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
(al 16/09/2026 los umbrales en JS están en `lib/leads.ts:1288-1289` y `lib/queries.ts:997-998`)

### ⚠️ La madurez de una cohorte se mide con el «hoy» de UTC, no con el del workspace

**Síntoma esperado** (sale de leer el código, no se midió): para un workspace al oeste de UTC,
desde la tarde (las 17:00 en Tijuana con UTC−7) una cohorte ya pasó a `madurando` o `madura` con un día
de adelanto sobre su calendario. Entra a los KPIs de cohortes maduras de /comercial y /general
mientras para el cliente todavía está madurando.

**Causa:** tres «hoy», los tres de UTC:

- Las vistas `v_cohortes_semanales` y `v_cohortes_mensuales` calculan `estado_madurez` con
  `CURRENT_DATE - ultima_j1_cohorte` (`supabase/migrations/0084_cohortes_workspace.sql:43-48` y
  `:78-84`). `CURRENT_DATE` es la fecha de la sesión de Postgres, que en Supabase es UTC. Y el
  filtro `.eq('estado_madurez','madura')` corre en SQL (`lib/queries.ts:448` y `:557`), así que
  la lib no puede corregirlo después.
- `getDistribucionPipeline` arma `hoyUTC` en JS (`lib/queries.ts:980-999`). Hoy lo lee solo la API.
- `estadoMadurezLead` → `diasDesdeJ1` (`lib/leads.ts:1281-1303`) hace lo mismo para la madurez de
  UN lead (`getJuntasProximas`, las tools de MaKo).

**Regla:** todo «hoy» que decide un estado de negocio sale de la zona del workspace
(`hoyEnWorkspace`, `lib/timezone.ts:139`), también adentro de una vista SQL: se pasa como
parámetro o la madurez se calcula en la lib.

**Lo que quedó SIN hacer:** las tres. Y va con la entrada de arriba: sacar el CASE de las vistas
es la misma migración que haría configurable el umbral.

**Vive en:** `supabase/migrations/0084_cohortes_workspace.sql` · `lib/queries.ts`
(`getDistribucionPipeline`, `getResumenComercialMaduras`) · `lib/leads.ts` (`diasDesdeJ1`) ·
*2026-09-16 api-mako-areas*

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

## Lecturas del embudo, el ciclo y la cobranza

### ⚠️ `_listLeads`: faltaban 9 de 13 ganados, y la misma lectura estaba copiada seis veces

**Síntoma (09/09/2026):** Mauricio veía 4 ganados en el CRM; eran 13. US$52.700 fuera del
tablero. También faltaban 44 abiertos, 9 perdidos y 4 descalificados.

**El diagnóstico obvio era el equivocado.** Los 13 tenían `etapa_vista='ganado'` y el funnel
de ws1 tenía la etapa: ni filtro ni etapa. `_listLeads` (`lib/leads.ts`) hacía un `.select()`
suelto con `.order('created_at', desc)`; ws1 llegó a 1.066 leads y el corte de 1000 dejó
afuera los 66 más viejos — los que ya habían cerrado. La mecánica y cómo reconocerlo, en
[hallazgos-infra.md](hallazgos-infra.md) → «El techo de 1000 filas no da error».

**El arreglo tiene dos mitades**, y la segunda es la que se olvida: paginar con `leerTodo` por
`id` (único) y **después** ordenar por `created_at` en memoria. Paginar ordenando por
`created_at` reparte los empates distinto en cada página y saltea filas.

**Y no era el único.** La caza del 17/09 encontró el mismo `.select()` sobre `leads`, sin
paginar, en seis lugares más, todos del mismo workspace y todos truncando ya (ws1: 1.108
leads; con teléfono 1.106; abiertos 1.032):

| Dónde | Qué se perdía |
|---|---|
| `getLeadsByEmail` (`lib/closing.ts`) | el índice email → lead con el que el Closing pega cada reunión a su lead |
| `evaluarAutoWorkspace` (`lib/crm-auto.ts`) | 66 leads que el CRM automático no evaluaba nunca, y un `totalLeads: 1000` que se mostraba como dato |
| `_getTramosSCL` (`lib/queries.ts`) | el ciclo de venta se promediaba sobre una muestra arbitraria |
| `app/api/whatsapp/conversations/route.ts` | 106 contactos del inbox salían como desconocidos, sin link al CRM |
| `app/api/chat-agent/onboarding/conversaciones/route.ts` | lo mismo, con un `.limit(2000)` que devolvía 1.000 |
| `leadsDeSegmento` (`lib/email-marketing.ts`) | ver [hallazgos-comunicacion.md](hallazgos-comunicacion.md) |

Las siete pasan hoy por `leerTodo` ordenado por `id`. Efecto visible de eso: cuando dos leads
comparten email, `getLeadsByEmail` elige ahora siempre el id más bajo, antes era arbitrario.

**Lo que quedó SIN hacer:**

- ⚠️ **Regresión introducida en la misma corrida — `duplicadosDeLead` (`lib/leads.ts:367`).**
  El `.limit(500)` sin orden se reemplazó por un `ilike` por palabra del nombre
  (`patronesDeNombre`, `lib/leads-duplicados.ts`) + `.order('id').limit(100)`. El patrón cambia
  vocales, `n` y `c` por `_` (comodín) para tolerar acentos, y con eso casi no filtra: medido en
  ws1, «Ana» → `%___%` matchea **1.107 de 1.108**, «Juan» 238, «María» 181. El `limit(100)` deja
  los 100 más viejos y un duplicado más nuevo entra como lead nuevo, sin aviso. Solo corre
  cuando el lead no trae email ni teléfono. Arreglo: `leerTodo` del conjunto filtrado, o
  descartar las palabras cuyo patrón queda casi todo en `_` y avisar si vuelven exactamente 100.
- `app/crm/insights-actions.ts:56` (`leadTieneLlamadaAction`) lee `closing_analyses` entera sin
  paginar (428 en ws9): es el mismo patrón que se arregló en `lib/closing.ts`.
- `lib/leads.ts:2286` (`getVisitasLandingMap`, gemelo de `getVslEngagementMap` sobre
  `landing_visits`) y las lecturas de UN visitante en `:1482` y `:2264` (hasta 612 eventos de
  `vsl_events` por visitante, ws13). Y `:1401`: `.limit(400)` de Panda por `fecha`, así que un
  video viejo pierde su duración.
- `getVslEngagementMap` ahora hace varias consultas por tandas y un `catch` devuelve el mapa
  vacío: para la cohorte `vio_poco_vsl` (`lib/nutricion.ts`) vacío significa «nadie vio el VSL»
  y la inscribe entera. El error tendría que subir.

**Vive en:** lib/leads.ts (`_listLeads`, `duplicadosDeLead`, `getVslEngagementMap`, `getVisitasLandingMap`) · lib/leads-duplicados.ts · lib/closing.ts · lib/crm-auto.ts · lib/queries.ts · app/crm/insights-actions.ts · *2026-09-09 (commit `5e829b5d`) y 2026-09-17 caza de paginado*

### ⚠️ Las lecturas de leads y pagos del embudo, el ciclo y la cobranza no paginan

**Estado al 17/09/2026:** `getTramosSCL` ya pagina (entrada de arriba). Las otras cinco siguen
peladas; hoy no truncan porque filtran por columnas ralas (ws1: 120 leads con R1, 61 que
asistieron, 13 con primer pago, 14 ganados), y las dos sin filtro de `pagos` tienen decenas de
filas. Siguen siendo deuda.

**Síntoma esperado** (sale de leer el código, no se midió): ninguno visible. Pasadas las 1000
filas, conteos y totales salen cortos, siempre hacia abajo, y qué filas se caen no está definido.

**Causa:** `.select()` pelados que PostgREST corta en 1000 sin avisar. El paginado del 02/09 cubrió
`marketing_metrics_daily` ([hallazgos-ads.md](hallazgos-ads.md) → «Ocho getters de `/marketing`
truncan a 1000 filas»), no `leads` ni `pagos`:

| Lectura | Qué trae | Dónde se ve |
|---|---|---|
| `getFunnelEtapas` (`lib/queries.ts:1234-1238`) | leads con R1 en la ventana | el embudo de /marketing |
| `getSCL` (`lib/queries.ts:912-916`) | leads con agenda y primer pago, sin ventana | /comercial |
| `getTramosSCL` (`lib/queries.ts:1783-1785`) | **la tabla `leads` entera** | /comercial |
| `getDistribucionPipeline` (`lib/queries.ts:971-974`) | todo lead que asistió a la R1 | solo la API |
| `getOutstandingDetalle` (`lib/pagos.ts:409-411`) | **la tabla `pagos` entera**; la ventana de /comercial se aplica DESPUÉS, en JS (`:442-444`) | el Outstanding de /comercial |
| `getCuotasPendientes` (`lib/pagos.ts:501-506`) | cuotas sin pagar, por vencimiento: si corta, se caen las que vencen más tarde | las alertas de /general y los reportes |

**Lo que no se ve leyendo:** las dos peores son las que no tienen filtro, porque crecen con toda la
historia del negocio y no con la ventana. Es la misma regla que costó en /marketing: el techo se
mide contra la lectura más grande, y la más grande es la que no filtra.

**Mientras tanto:** la API de MaKo cuenta las filas con un `count` exacto y pone la salvedad
adentro de la respuesta (`contarFilas` + `avisoRecorte`, `lib/api-mako/areas/metricas.helpers.ts`;
usos en `metricas.run.ts:212-214`, `:390-392`, `:427-429`, `:685-687`, `:703-704` y `:724-726`).
Eso DICE el recorte, no lo arregla: las pantallas siguen cortas y sin aviso.

**Regla:** la cura va en la lib, con `leerTodo`/`leerPorPaginas` (`lib/supabase-paginado.ts`) y un
orden único que termine en `id`.

**Lo que quedó SIN hacer:** paginar las cinco que quedan (todas menos `getTramosSCL`).

**Vive en:** `lib/queries.ts` (`getFunnelEtapas`, `getSCL`, `getTramosSCL`, `getDistribucionPipeline`) ·
`lib/pagos.ts` (`getOutstandingDetalle`, `getCuotasPendientes`) ·
`lib/api-mako/areas/metricas.helpers.ts` · *2026-09-16 api-mako-areas*

### ⚠️ `getTramoJ1J2Reciente` cuenta las R2 agendadas a futuro como si ya hubieran pasado

**Síntoma esperado** (sale de leer el código, no se midió): la alerta «los deals se enfrían» de
/general salta de más, y la Retro informa un tramo R1 → R2 más largo que el real.

**Causa:** filtra la R1 dentro de la ventana y la R2 no nula, pero no acota la R2 a `<= hoy`
(`lib/queries.ts:2823-2828`). Una R2 agendada para dentro de tres semanas suma esos días al
promedio. Lo leen el semáforo de /general (`app/general/page.tsx:123`) y la Retro
(`lib/retro-fuentes.ts:276`), donde el «hoy» es el fin del período. Y no tiene `.range()`: pasadas
las 1000 filas corta sin error, como las de la entrada de arriba.

**Mientras tanto:** la API de MaKo topea la ventana a 180 días (`lib/api-mako/areas/general.def.ts:116`), avisa en la
nota que incluye R2 a futuro y agrega una advertencia si los casos llegan a 1000
(`lib/api-mako/areas/general.run.ts:320-324`).

**Lo que quedó SIN hacer:** `.lte('fecha_junta_2', hoy)` y paginar, en `lib/queries.ts`.

**Vive en:** `lib/queries.ts:2817-2843` (`getTramoJ1J2Reciente`) · `app/general/page.tsx:123` ·
`lib/retro-fuentes.ts:276` · *2026-09-16 api-mako-areas*

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
| **Un número pegado con su «+código» quedaba con DOS códigos, y avisar lada y número en el mismo evento pisa la lada.** El selector de país del alta, la ficha y otros cinco montajes (12/10/2026) | [hallazgos-ui.md](hallazgos-ui.md) → «Un control que parte un dato en dos…» |
| **Un observador que reescribe lo que observa compara contra lo que el navegador DEVUELVE.** El título «MaKo - CRM» y el bucle infinito con `/reportes-` (12/10/2026) | [hallazgos-ui.md](hallazgos-ui.md) → «Un observador que reescribe…» |
| **MaKo Analyst de la ficha es el turno del teléfono prestado**: el contexto del lead va por turno y no se guarda, y la privacidad del chat es un PREFIJO (12/10/2026) | [hallazgos-mobile.md](hallazgos-mobile.md) → «El turno del teléfono, prestado a la ficha del lead» |
| La nota desde /m sigue recortando a 4000 en silencio al crearla (12/10/2026) | [hallazgos-mobile.md](hallazgos-mobile.md) → «Lo que quedó sin hacer» |

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

### ⚠️ La llave que evita proponer dos veces el mismo lead se arma en cuatro lugares, con dos formatos

**Síntoma esperado:** la misma persona propuesta por WhatsApp y por Claude deja **dos**
propuestas en `/crm/revisar`, y el dueño confirma un duplicado creyendo que son dos personas.
O al revés: un lote nuevo devuelve el link de uno viejo y sus contactos de más no se proponen
nunca.

**Causa:** `crearPropuesta` deduplica por `ref`, y la `ref` de un lead la arma cada llamador:

| Camino | Dónde | La llave |
|---|---|---|
| tool de WhatsApp `proponer_lead` | `lib/mako-doer-acciones.ts:652` | `wa:lead:<solo dígitos>` o el nombre |
| `proponer_lead` fuera de WhatsApp | `lib/api-mako/areas/crm.run.ts:419` | la misma, copiada |
| lote de la API | `lib/api-mako/areas/crm.helpers.ts:204` | `lead:<teléfono tal cual o email>,…` |
| `POST /api/agente/lead` | `app/api/agente/lead/route.ts:104` | la misma que el lote |

Dos formatos que no se cruzan nunca: el prefijo es otro, y uno limpia el teléfono a dígitos y
el otro lo usa crudo (`+52 664…` y `52664…` son dos llaves). Ninguno compara como compara el
alta, por los últimos 10 dígitos (ver [No hay un choke point de alta](#-no-hay-un-choke-point-de-alta-hay-tres-inserts-y-cuatro-dedups-que-no-se-hablan)).
La del lote además se corta a 200 caracteres y choca con otro lote que comparta los primeros
~15 contactos (el detalle, en [hallazgos-api-mako.md](hallazgos-api-mako.md)).

**Y `nueva: false` no dice cuál de los dos casos es.** `crearPropuesta` devuelve la existente si
está `pendiente` **o** `aplicada` (`lib/propuestas.ts:94-98`, a propósito: ver
[hallazgos-landing.md](hallazgos-landing.md) → «Descartar una propuesta encadenaba…»), pero no
devuelve el estado. La tool de WhatsApp contesta «Ya había una propuesta pendiente»
(`lib/mako-doer-acciones.ts:663`) sobre un lead que puede estar cargado hace semanas.

**Regla:** una llave de idempotencia es una clave, y una clave la arma UNA función. Si la
lista no entra en el tope, se hashea: cortarla la convierte en un prefijo.

**Lo que quedó SIN hacer:** una función única para la `ref` de un lead, que normalice el
teléfono como el dedup de alta, y que `crearPropuesta` devuelva el estado de la existente. Y
`crm.run.ts:414-425` copia el saneo de la tool vieja para no mentir el origen: si cambia uno,
hay que cambiar el otro a mano.

**Vive en:** `lib/propuestas.ts` (`crearPropuesta`) · `lib/mako-doer-acciones.ts`
(`proponer_lead`) · `lib/api-mako/areas/crm.run.ts` (`proponer_lead`) ·
`lib/api-mako/areas/crm.helpers.ts` (`proponerLote`) · `app/api/agente/lead/route.ts` ·
*2026-09-16 api-mako-areas*

### Un bloque de render puesto después del primer `return` es código muerto silencioso

El lápiz de «Tus videos» cambiaba el estado y la pantalla no cambiaba: el bloque del paso estaba
**después** del `if (!activo) return (…)`, que se dispara siempre. Un botón muerto, sin un solo
error que lo delatara.

**Y el test que contaba botones tampoco lo agarró**, porque su `slice` arrancaba en el primer
`if (!activo)` del archivo — que es el del `useEffect`, no el del render. Anclar a la primera
aparición de un patrón que existe dos veces es cómo un test mira el bloque equivocado y da
verde.

**Vive en:** `app/integraciones/ProbarTracking.tsx` · `tests/landing-optin.test.ts`

### «Sin fila» no es «vacío»: el `origen` del funnel sale de una COLUMNA, no de la forma del jsonb

La migración de `funnels` (0170, la 0126 del modelo) le da fila a TODOS los workspaces: a los
que ya tenían `funnel_config` les copia su `data`, y a los tres que no tenían (ws **3, 5 y 9**)
les crea una con `data = '{}'::jsonb` y `declarado = false`. El objetivo declarado de la fase es
que nada cambie: «ningún prompt empieza a afirmar un funnel que nadie declaró».

El lector viejo decidía así (`lib/leads.ts`, antes del rename):

    if (!data || !data.data) return buildFunnel(DEFAULT_PIPELINE, [], { origen: 'sin-fila' });

**Y `{}` en JavaScript es TRUTHY.** Un `getFunnelDefault()` escrito por traducción directa lee
`data.data = {}`, cae al camino de abajo y devuelve `origen: 'declarado'` con el
`DEFAULT_PIPELINE`: tres workspaces pasan de «no declaró nada» a «declaró el funnel genérico»,
sin error y sin un solo log.

No es cosmético. Hay tres lectores de `origen` en producción —`lib/objectives.ts` (qué KPIs
proponer), `lib/venta-por-llamada.ts` y `lib/acento-workspace.ts`— y el contrato que se rompe es
el que impide que un prompt afirme «dejó sus datos en el anuncio» sobre alguien que nunca lo
declaró.

**La regla:** `origen` se deriva de la columna `funnels.declarado`, nunca de la forma de `data`.
Es la misma familia que el otro caso ya escrito acá («sin fila» ≠ «vacío»), y por eso el mapeo
fila → `FunnelConfig` vive en `lib/funnel-fila.ts`, **sin `server-only`**: la regla tiene que
poder importarse desde un test.

**Probado rompiéndolo:** cambiando `const declarado = f.declarado === true` por
`const declarado = Boolean(f.data)`, `tests/funnel-declarado.test.ts` pasa de 6/6 a **2 fallos y
4 pases** — caen exactamente los dos casos que la migración crea en prod.

**Vive en:** `lib/funnel-fila.ts` · `lib/funnels.ts` · `supabase/migrations/0170_funnels.sql` ·
`tests/funnel-declarado.test.ts` · *2026-09-26 F1 multi-funnel*

### El orden de despliegue de la 0170 es el INVERSO del de la 0167/0168

`0168_frecuencia_vieja_fuera.sql` dejó escrita la regla «agregar → desplegar → sacar»: una
migración que DROPEA se aplica después del deploy. La 0170 es la otra mitad y se aplica **antes
o junto** con su deploy: el código deja de leer `funnel_config` en el mismo commit, así que
entre un deploy sin tabla y la migración `getFunnelDefault()` devuelve `origen:'error'` y todo
el mundo ve el `DEFAULT_PIPELINE`.

No se pierde nada (en esa ventana nadie escribe), pero el CRM pinta columnas genéricas y los
prompts dejan de saber el embudo. Lo que hace fácil equivocarse es que el reflejo aprendido con
la 0168 —«primero el código»— acá produce exactamente el síntoma que la fase venía a evitar.

**La regla:** una migración ADITIVA cuyo código nuevo ya lee la tabla nueva va primero; una que
SACA algo va después. El .sql lo dice en su cabecera, que es donde lo va a leer el que la aplique.

**Vive en:** `supabase/migrations/0170_funnels.sql` · *2026-09-26 F1 multi-funnel*

### Contar filas deja de distinguir en cuanto la migración le da una a todos

La señal `funnel-cargado` (`lib/plan-senales.ts`) preguntaba «¿hay filas en `funnel_config` de
este workspace?». Ya había fallado una vez —la tabla no estaba en `TENANT_TABLES`, contaba las
filas de todos los inquilinos y la señal salía verde para los 6— y el arreglo fue el `.eq` a
mano.

Con `funnels`, ese mismo conteo vuelve a dar verde para los 9, por otro camino: el guard en
positivo de la 0170 («un ws SIEMPRE tiene exactamente un funnel default») garantiza que la fila
exista. **La existencia de la fila dejó de ser información.** Lo que la señal pregunta de verdad
es si el cliente DECLARÓ su embudo, y eso es `declarado = true`.

Lo mismo le pasa a `scripts/reparar-senal-funnel.ts`, que distinguía «tiene funnel propio» por
la fila.

**La regla, que vale para cualquier backfill:** cuando una migración le crea fila a todos, todo
chequeo de existencia sobre esa tabla se invierte en silencio. Antes de escribir el INSERT,
grepeá quién cuenta filas ahí.

**Vive en:** `lib/plan-senales.ts` (`funnelDeclarado`) · `scripts/reparar-senal-funnel.ts` ·
*2026-09-26 F1 multi-funnel*

### El clon y «los datos de Mau» escribían el funnel por su `id = workspace_id`

`funnel_config` era singleton y su `id` **es igual al `workspace_id`** en las 6 filas de prod
(lo escribe `saveFunnel` con `{ id: ws, workspace_id: ws }`). De ahí salieron TRES upserts con
`onConflict: 'workspace_id'` —`saveFunnel`, `clonarConfigDelDueno` y el ámbito `singleton` de
`datos-mau`— y los tres suponen que la fila se puede identificar por el workspace.

Con `funnels` eso deja de valer: la tabla tiene identity propia y N filas por workspace. Los
tres pasaron a **UPDATE sobre el funnel default** (`.eq('workspace_id').eq('es_default', true)`),
nunca a insertar una fila nueva — un segundo `es_default` lo rechaza `funnels_ws_default_uk`,
que es justamente el guard de que hay uno solo.

Y el que menos se ve: **«devolver los datos de Mau» BORRABA la fila**. Sobre `funnels`, borrar
el default dejaría al workspace en cero funnels, que es un estado que el modelo no contempla. La
devolución lo **vacía** (`data = {}`, `declarado = false`), que es el equivalente exacto de lo
que hacía antes: volver a «sin declarar».

**Lo que quedó SIN hacer:** el ámbito «El funnel» de datos-mau trae un solo funnel (el default
del dueño). Con N funnels habrá que decidir si se traen todos.

**Vive en:** `lib/clonar-config.ts` · `lib/datos-mau.ts` (`funnelDefault`,
`eliminarDatosDelDueno`) · `lib/reset-workspace.ts` · `lib/workspace.ts` (`crearWorkspace`) ·
*2026-09-26 F1 multi-funnel*

### El diagnóstico obvio era el equivocado: ws3 ya no es el cliente de prueba con datos

`docs/modelo-oferta-producto-funnel.md` mide, el 10/08: «1.000 leads (ws1 880, **ws3** 120)» y
«2 productos en total (ws1 y **ws3**)». Medido de nuevo el 26/09 contra prod: **ws3 está en
cero** — sin leads, sin productos, sin `funnel_config`, sin `answers`. Sus únicas dos filas en
toda la base son dos `app_settings` de avisos.

El clon de demo con los datos de Mauricio es **ws4 «Cliente de Diseño»**, creado el 16/08 (seis
días después de esa medición): su blob `mako.onboarding.answers` es **byte-idéntico** al de ws1
(1155 caracteres, `=` en SQL devuelve true) y tiene 300 leads.

Cualquier query o script que use ws3 como «el workspace de prueba con datos» **mide cero y no
falla**. Y la memoria del proyecto también dice ws3.

**Vive en:** `docs/modelo-oferta-producto-funnel.md` (donde dice ws3, hoy hay que leer ws4) ·
`lib/auth-session.ts` (`exigirClienteDePrueba`) · *2026-09-26 F1 multi-funnel*

### `oferta_ticket` es texto libre: el precio del brief NO es un número

Medido en los 6 workspaces que tienen el grupo `oferta` cargado: **4 de 6** tienen una frase
donde el código espera un monto — «Entre USD 5,000 y USD 10,000» (ws1), «MVP $500 - $1,000 USD;
escalado $5,000 USD o más» (ws10), «800 MXN/mes» (ws11, otra moneda), «2000 a 10000» (ws13).
Solo ws14 («500») parsea limpio.

El `parseFloat` de `seedProductosDesdeOferta` devuelve `NaN` en silencio y el producto queda con
`monto_usd: null` — visible hoy en el producto id=1 de ws1. El mismo molde sobre
`ofertas.precio_usd` (numeric) haría exactamente lo mismo.

**La regla:** el ticket del brief va a un campo TEXT (`ofertas.precio_nota`). El numérico se
pide aparte o no se pide.

**Vive en:** `lib/productos.ts` (`seedProductosDesdeOferta`) · `lib/onboarding.ts` (grupo
`oferta`) · `supabase/migrations/0169_ofertas.sql` · *2026-09-26 F1 multi-funnel*

### Un guard de seed quemado no se vuelve a abrir, y no se distingue de un seed exitoso

**ws4 tiene `mako.productos.seeded = '1'` y CERO productos.** El seed corrió, marcó su bandera y
el producto no quedó. `seedProductosDesdeOferta` no va a volver a intentarlo nunca, aunque los 5
campos `oferta_*` estén cargados.

Todo seed idempotente por `app_settings` tiene este modo de falla, y no hay forma de distinguir
«ya sembró» de «sembró y lo borraron»: la bandera es un booleano y lo sembrado es otra tabla.

**Lo que quedó SIN hacer:** si `seedOfertaDesdeBrief()` copia el molde con un `SEED_KEY` propio,
ws4 **sí** va a sembrar su oferta (la key nueva no existe en ningún ws) y el par oferta↔producto
le va a quedar cojo, porque no hay producto al que ligarla en `oferta_productos`. Hay que decidir
si el seed de la oferta crea también el producto faltante.

**Vive en:** `lib/productos.ts:112-132` · *2026-09-26 F1 multi-funnel*

### El diagnóstico obvio era el equivocado: el plan pide una pantalla de ofertas, y el dueño pidió lo contrario

`docs/productos-y-funnels-plan.md` §F2 dice, escrito: «Pantalla propia con `Pagina` + `PageHeader`
+ `Section` y entrada en `app/_components/nav.ts`». Es lo primero que lee cualquiera que agarre la
fase, y **hacerlo sería desobedecer una corrección explícita del dueño**: la oferta y el catálogo
se cargan **dentro del ONBOARDING**, reusando el paso `productos` y el molde de `ProductosView`, y
**NO** en Configuraciones ni en una tab nueva.

Son dos fuentes con fecha distinta que se contradicen, y gana la más nueva. El documento del plan
se escribió el 10/08; la corrección llegó después, con la misma frase que ya estaba en su intro
(«el catálogo vive en el ONBOARDING y no en Configuraciones») y que la §F2 no había recogido.

**Dónde quedó:** `app/onboarding/OfertasView.tsx`, montado en el paso `productos` de
`OnboardingWizard.tsx` (arriba de `ProductosView`) y como sub-vista «La oferta» del área `oferta`
de `/second-brain` (`AreasHub.tsx`). Cero entradas nuevas en el nav.

**Vive en:** `docs/productos-y-funnels-plan.md` (§F2) · `app/onboarding/OfertasView.tsx` ·
*2026-09-26 F2 ofertas*

### `desde_brief` invierte otra vez a quien cuenta filas: tener una oferta dejó de significar que la declaró

Es el mismo escalón que el backfill de `funnels`, un piso más arriba y con una diferencia que
importa: acá el que reparte las filas **no es una migración, es un seed que corre en cada carga**
(`seedOfertaDesdeBrief`, guard `mako.ofertas.seeded`). Todo workspace que tenga `oferta_nombre` en
el brief —hoy 6 de 9— termina con una fila en `ofertas`, aunque nadie haya abierto la pantalla.

O sea: `select count(*) from ofertas where workspace_id = N` contesta «tiene brief», no «declaró
su oferta». Lo que distingue es la columna **`desde_brief`**:

| `desde_brief` | Qué significa | De dónde salen los 5 campos |
|---|---|---|
| `true` | la fila la sembró el brief | del blob `app_settings['mako.onboarding.answers']` |
| `false` | alguien la declaró de verdad | de las columnas; un NULL es **«no lo cargaron»** |

⚠️ **Y el NULL no cae al brief cuando `desde_brief` es false**, a propósito: si cayera, una oferta
nueva y vacía heredaría la promesa de la principal y ningún prompt podría distinguirlas. La regla
entera vive en `resolverOfertaPrincipal()` (`lib/oferta-modelo.ts`, **sin `server-only`** para que
se pueda testear) y la fija `tests/oferta-brief.test.ts`.

**Probado rompiéndolo:** haciendo que la rama `desde_brief` lea las columnas en vez del blob,
**1 fallo / 8 pases**; tratando «sin fila» como una fila declarada y vacía, **2 fallos / 7 pases**.

**Vive en:** `lib/oferta-modelo.ts` · `lib/ofertas.ts` (`seedOfertaDesdeBrief`) ·
`tests/oferta-brief.test.ts` · *2026-09-26 F2 ofertas*

### «No puedo comprobarlo» no es «venció», y de eso cuelga si un ángulo de venta se usa

El ángulo «Oferta directa (urgencia)» (`lib/guion-angulos.ts`) **exige** una restricción real
documentada y **prohíbe** inventarla — y hasta la 0169 era un requisito de contrato **sin ningún
campo donde cumplirse y sin ninguna línea que lo mirara**. Una regla que sólo vive en un prompt no
es una regla.

La segunda capa es `urgenciaVigente(oferta, hoy)`, y tiene **tres** salidas, no dos:

- `true` — hay `urgencia_hasta` y no pasó.
- `false` — hay `urgencia_hasta` y venció. Sólo acá se apaga el ángulo.
- `null` — **no se puede comprobar**: los cupos, la capacidad y un «arranca pronto» sin fecha los
  declara una persona y el sistema no tiene con qué verificarlos.

Devolver `false` en el tercer caso —el reflejo— apagaría el ángulo de todo el que declaró cupos,
que es la forma más común de urgencia legítima. Por eso el chip de urgencia en la pantalla es
**cerrado** (fecha / cupos / capacidad / inicio) y lleva la fecha en un campo aparte: sobre un
textarea libre no se puede contestar ninguna de las tres.

**Probado rompiéndolo:** devolviendo `false` en vez de `null` sin `urgencia_hasta`, **2 fallos /
7 pases**.

**Vive en:** `lib/oferta-modelo.ts` (`urgenciaVigente`, `urgenciaUsable`) ·
`app/onboarding/OfertasView.tsx` · *2026-09-26 F2 ofertas*

### El resolver único y el ciclo de imports: las answers viajan por parámetro

`perfilNegocioTexto()` (`lib/onboarding.ts`) tiene que llamar a `ofertaPrincipal()`, y
`ofertaPrincipal()` necesita el blob de respuestas, que lo lee `getAnswers()` — en
`lib/onboarding.ts`. Escrito de la forma obvia, los dos módulos se importan entre sí.

El ciclo probablemente funcionaría (las dos son `export async function`, o sea hoisted), y eso es
exactamente lo que lo vuelve caro: falla el día que alguien convierta una en `const` y el síntoma
es un TDZ en runtime, en producción, sobre la función que alimenta ~20 features.

**La regla que queda:** `lib/ofertas.ts` **no importa `lib/onboarding.ts`**. Las answers entran
por parámetro (`ofertaPrincipal(answers)`), que además deja la dependencia a la vista en cada
call-site en vez de esconderla adentro.

**Vive en:** `lib/ofertas.ts` (cabecera) · `lib/onboarding.ts` (`perfilNegocioTexto`) ·
*2026-09-26 F2 ofertas*

### El seed de la oferta NO crea el producto que falta — y eso contesta la pregunta que dejó F1

F1 dejó abierto qué hacer con **ws4**, que tiene `mako.productos.seeded = '1'` y **cero productos**:
con un `SEED_KEY` propio, el seed de la oferta sí va a correr ahí y el par oferta↔producto le va a
quedar cojo.

**Decidido: queda cojo, y está bien.** El catálogo `productos` es lo que el CRM **factura**; crear
un producto fantasma para llenar `oferta_productos` le mete al cliente una línea de facturación que
él nunca cargó, y esa es la que después hereda el pricing de un cierre real. El seed liga la oferta
al producto que YA exista con el mismo nombre normalizado (o al único, si hay uno solo) y, si no
hay ninguno, deja el puente vacío para que el dueño lo ligue desde la pantalla.

**Vive en:** `lib/ofertas.ts` (`seedOfertaDesdeBrief`) · *2026-09-26 F2 ofertas*

### El detector de voseo también lee `lib/prompt-registry.ts`, no sólo las pantallas

El test se llama «ninguna pantalla del repo le habla al cliente de vos» y el nombre engaña: barre
también el campo `context` de cada prompt del registro. Es correcto —ese texto se pinta en
`/configuraciones` y lo lee el cliente— y no es lo que uno espera al escribir la ficha de un
prompt nuevo, que se siente documentación interna. Un «acá» ahí tira `npm test` entero.

**Vive en:** `tests/puente-panel-copy.test.ts` · `lib/prompt-registry.ts` ·
*2026-09-26 F2 ofertas*

### Lo que quedó SIN hacer de F2, con el archivo donde vive

- **`lib/clonar-config.ts` y `lib/datos-mau.ts` no conocen `ofertas`.** Clonar la config del dueño
  al workspace de prueba se lleva `productos` y el `funnel`, y **no** la oferta: el clon queda con
  catálogo y sin promesa. No se agregó en esta pasada a propósito — `ofertas` tiene dos índices
  únicos parciales (`es_principal`, `desde_brief`) y el destino ya trae su propia oferta sembrada,
  así que un insert ciego choca con 23505. Hay que clonar **sobre la fila que el destino ya tiene**,
  como se resolvió con `funnels`.
- **`lead_magnets` (mig 0169) nace con CRUD y sin lectores.** El imán sigue viviendo en
  `app_settings['mako.entregable']` (`lib/entregable.ts`, ~14 lectores, y es un ARRAY desde el
  30/07 — no el «blob singleton» que dice el doc del modelo). Mudar el dato y sus lectores en
  pasadas distintas es cómo se arma la segunda copia que se queda vieja: van juntos o no van.
- **`leads.oferta_id` (mig 0169) sigue sin un solo lector**, igual que `leads.producto_id` desde la
  0117. Se escribe en F3, con las participaciones.
- **El BOFU (`funnels.canal`) todavía no lo lee `encuentroGrabable()`** (`lib/encuentro-ws.ts`),
  que sigue siendo workspace-wide. Está en el release-gate del modelo, no en esta fase.
- **Las ofertas no se ven en el CRM**, a propósito: el pedido de esta corrida dice «sin tocar el
  CRM todavía», y el wizard de cierre que elige oferta es F3.

---

## Revisión adversarial de F1+F2 (26/09) — leyendo el código, no los reportes

### Una VISTA no tiene RLS, y fue el único objeto de las tres migraciones sin revoke

`alter table … enable row level security` **no existe para una vista**, y una vista corre con los
permisos de su DUEÑO: aunque `funnel_ofertas` y `oferta_productos` tengan RLS, quien pueda hacerle
SELECT a `v_funnel_productos` lee las filas de TODOS los workspaces. Las tres migraciones revocan
a `anon`/`authenticated` en cada tabla y la vista quedó sin su línea — no por descuido, sino
porque el molde que se copia (`revoke all on <tabla>`) está mentalmente atado al
`enable row level security` de al lado, que ahí no aplica.

Medido en prod el 26/09, y es lo que lo vuelve real y no teórico:

| objeto | ACL hoy |
|---|---|
| `v_cohortes_semanales` (vista, mig 0001) | `anon=arwdDxtm`, `security_invoker` apagado |
| `funnel_config`, `productos` (tablas, migs numeradas) | sólo `postgres` + `service_role` |

O sea que **el camino del grant a `anon` depende de QUIÉN aplique el DDL** (el `postgres` de
`scripts/apply-migration.mjs` ya no lo da; `supabase_admin` y el editor de Supabase sí), y lo
único que mantiene afuera a las tablas nuevas es el revoke explícito.

Quedó `alter view … set (security_invoker = on)` + `revoke all`, y un test que barre **todas** las
vistas de `supabase/migrations/`. La lista de excusas va por NOMBRE DE VISTA, no por archivo: las
`v_cohortes_*` se re-crean en la 0013 y en la 0084, así que exceptuar un archivo dejaría entrar
cualquier vista nueva escrita ahí.

**Vive en:** `supabase/migrations/0171_funnel_ofertas.sql` · `tests/funnel-declarado.test.ts` ·
*2026-09-26 revisión adversarial F1+F2*

### El guard de «leer el funnel y volver a guardarlo» faltaba en el cuarto call-site

F1 lo agregó en `declararEntradasAction` y ya estaba en `guardarEntradas` y en
`saveFunnelDefault`. El que quedó afuera es el paso **«funnel por canal»** del onboarding
(`app/api/onboarding/route.ts`, case `diagnostico`), y ahí el efecto se INVIERTE:

    const actual = await getFunnelDefault();
    const intacto = mismoPipeline(actual.pipeline, DEFAULT_PIPELINE) && !actual.suppressed.length;
    if (intacto) await saveFunnelDefault(tpl.pipeline, tpl.suppressed ?? []);

Con `origen: 'error'`, `actual.pipeline` **ES** `DEFAULT_PIPELINE` y `suppressed` viene vacío, así
que `intacto` da true SIEMPRE: una caída de Supabase convierte el guard en su contrario y siembra
la plantilla del canal **encima del funnel editado del cliente**. El comentario de veinte líneas
que está justo arriba dice textual que ese bloque no puede pisar un funnel existente.

`saveFunnelDefault` relee y tira con `origen: 'error'`, así que la ventana real es angosta (la
primera lectura falla y la segunda no), pero es la misma forma exacta del bug que F1 arregló al
lado.

**La regla que queda, y por eso hay test:** el guard no se cuenta por call-sites conocidos sino
por la pregunta «¿este archivo LEE el funnel y también lo GUARDA?». `tests/funnel-declarado.test.ts`
la hace sobre `lib/` y `app/`.

⚠️ **Y la primera versión de ese test daba verde con el guard borrado**, porque los tres
call-sites nombran `origen === 'error'` en su comentario explicativo. Un test que busca una
condición sobre el archivo CRUDO encuentra la prosa. Va sobre el fuente sin comentarios.

**Vive en:** `app/api/onboarding/route.ts` · `tests/funnel-declarado.test.ts` ·
*2026-09-26 revisión adversarial F1+F2*

### Una FK no mira DE QUIÉN es la fila, y en una tabla puente eso alcanza

`getTenantDb` filtra los SELECT y estampa el `workspace_id` de los INSERT. Lo que **no** hace es
verificar que el id referenciado sea de este workspace: para Postgres, una FK sólo pregunta si el
id EXISTE. En `oferta_productos`, `funnel_ofertas` y `lead_magnets.oferta_id` —los tres nacidos en
esta corrida, los tres alimentados por ids que vienen del body de un POST— eso deja crear, en MI
workspace, una fila que apunta al producto o a la oferta de OTRO cliente.

**Lo que se rompe no es la privacidad, es la integridad**, y por eso no tiene síntoma: `estado()`
cruza las ligas contra `listProductos()` / `listarOfertas()`, que sí vienen scopeadas, así que el
id ajeno no matchea nada y la liga **no se ve, no se puede desligar desde la pantalla** y ensucia
`v_funnel_productos`.

Quedó `esDelWorkspace(tabla, id)` en las tres puertas. Es el mismo criterio que ya usaban
`saveFunnelDe` y `upsertOferta` con el UPDATE que no tocó ninguna fila: **nunca dar por buena una
operación sobre una fila que el workspace no tiene**. De paso, `upsertLeadMagnet` era el único
escritor de los tres sin ese guard de cero filas.

**Vive en:** `lib/ofertas.ts` (`esDelWorkspace`, `ligarProducto`, `ligarOfertaAFunnel`,
`upsertLeadMagnet`) · *2026-09-26 revisión adversarial F1+F2*

### `urgenciaUsable()` no la llama nadie, y la bitácora del producto decía que sí

El reporte de F2 y la bitácora de `/admin/dev` afirmaban que el chip de urgencia con fecha aparte
existe «así `urgenciaUsable()` apaga el ángulo EN CÓDIGO cuando vence». Medido con un grep sobre
`lib/`, `app/`, `scripts/` y `tests/`: los únicos usos son el test y dos comentarios. El catálogo
de `lib/guion-angulos.ts` es una constante estática con `activo: true` y **ninguno de sus
consumidores lee la oferta**.

O sea que la regla «sin restricción real el ángulo no se usa» sigue viviendo SOLO en la prosa del
prompt — exactamente lo que AGENTS.md § «Una regla en un prompt no es una regla» dice que no
alcanza, y lo que esa línea de la bitácora afirmaba haber cerrado.

**Lo hecho es el CAMPO (`urgencia_hasta`) y la función que lo evalúa; falta el call-site**, y va
donde se arma el catálogo de ángulos para un pedido concreto. Se corrigió el texto en los dos
lugares en vez de cablearlo: cablearlo toca el catálogo de ángulos, que no es de esta fase.

**El olor, para la próxima:** una función exportada, con test, cuyo grep devuelve sólo la
declaración y el test. Es «Escribir la salida no es ofrecerla» con una vuelta más — acá el
call-site faltante estaba *documentado como existente*, así que leer la bitácora lo confirmaba.

**Vive en:** `lib/oferta-modelo.ts` · `lib/ofertas-ia.ts` ·
`app/admin/dev/products-offers/bitacora.ts` · *2026-09-26 revisión adversarial F1+F2*

### `urgenciaVigente` compara en UTC, y el único llamador le pasa el reloj del navegador

`hoy.toISOString().slice(0,10)` es la fecha **UTC**. `OfertasView` pasa `new Date()` del browser,
así que para un cliente en México (UTC-6) desde las 18:00 locales el día UTC ya es el siguiente y
una urgencia que vence hoy se rotula «vencida» unas horas antes.

**No se arregló, y el motivo importa:** pasar la fecha local del navegador tampoco es correcto —el
negocio puede estar en otra zona que quien mira—. Lo correcto es `hoyDelWorkspace(ws)`
(`lib/api-mako/areas/crm.helpers.ts`), que es de donde sale «hoy» en el resto del repo; pero ese
«hoy» es async y por-workspace, y `lib/oferta-modelo.ts` es PURO a propósito. La fecha tiene que
seguir entrando por parámetro, **resuelta por el llamador**. Queda anotado en el docstring.

**Vive en:** `lib/oferta-modelo.ts` (`urgenciaVigente`) · `app/onboarding/OfertasView.tsx` ·
*2026-09-26 revisión adversarial F1+F2*

### Las tres migraciones no decían su orden de DESPLIEGUE, y la 0169 sí lo necesita

La 0170 lo traía en su cabecera; la 0169 y la 0171 sólo declaraban el orden entre migraciones. La
regla que esta misma corrida escribió en `AGENTS.md` pide las dos cosas.

Y la 0169 lo necesita de verdad: `GET /api/onboarding/ofertas` llama a `listarOfertas()`, que es
el **único lector de estas tablas sin `.catch`** (a propósito: una lista de ofertas que falla en
silencio se ve igual que un negocio sin ofertas). Sin la tabla devuelve 500 y `OfertasView` pinta
el error en rojo en dos lugares que hoy no lo tienen — el paso `productos` del onboarding y
`/second-brain` → área Oferta.

Lo que NO se rompe en esa ventana, y es deliberado: `ofertaPrincipal()` cae al brief con un log,
así que las ~20 features que leen `perfilNegocioTexto()` siguen recibiendo promesa y precio.

**Vive en:** `supabase/migrations/0169_ofertas.sql` · `supabase/migrations/0171_funnel_ofertas.sql`
· *2026-09-26 revisión adversarial F1+F2*

### Lo que se REVISÓ y se descartó, con el porqué

- **`nutricion_secuencias.funnel_id … on delete cascade` (0170).** Borrar un funnel borra sus
  secuencias y, por cascada, sus envíos e inscripciones. Con una columna NULLABLE que significa
  «sirve a todos», `on delete restrict` sería más honesto. **No se tocó: lo manda el documento**
  (`docs/modelo-oferta-producto-funnel.md:302`), y hoy no existe ningún camino que borre un funnel
  —`lib/funnels.ts` no tiene `borrarFunnel`—, así que es latente. El día que se escriba ese botón,
  hay que decidir esto primero. Y `on delete set null` es PEOR: la secuencia pasaría a «sirve a
  todos» y empezaría a enrolar a todo el mundo, que es justo el riesgo que la 0170 documenta.
- **`getFunnelDefault` dejó de caer a `OWNER_WS` cuando no hay workspace.** El lector viejo hacía
  `getWorkspaceActual() ?? OWNER_WS` con el `.eq` a mano; `funnels` está en TENANT_TABLES, así que
  ahora el proxy filtra por `ws ?? -1` y un admin sin workspace ve `sin-fila` + `DEFAULT_PIPELINE`
  en vez del funnel de ws1. Es un cambio de comportamiento **y es el correcto** (fail-closed), y
  no es visible: `leads` también es tenant, así que ese board ya venía vacío.
- **`filaDefault()` no filtra `activo = true` y `listarFunnels()` sí.** Un funnel default
  desactivado se editaría sin estar en el desplegable. No hay UI para desactivar un funnel: se
  deja.
- **`perfilNegocioTexto()` NO emite el mismo texto que ayer**, contra lo que dice el reporte de F2
  («sale idéntico»). Los rótulos del grupo `oferta` pasaron de la PREGUNTA del esquema («¿Cómo se
  llama tu oferta?: X») al rótulo corto («Nombre: X») para ~20 features. El cambio es deliberado,
  está explicado en el docstring de la función y es una mejora; lo que estaba mal era la
  afirmación de paridad, que es la que apaga la revisión.
- **Los call-sites del rename.** Se recorrieron los 40 usos de `*Default` uno por uno: los que
  tienen un lead en la mano usan la variante del lead, y los mixtos (`leadsFiltrados`,
  `conteoPorEtapa`, `_getPendientesDeMarcar`, el board del CRM) se quedan en el default **con el
  comentario que dice qué hay que resolver por lead el día de F3**. No apareció ninguno mal
  repartido.
- **El tablero, el worklist y los reportes.** `app/crm/page.tsx` y `lib/queries.ts` cambiaron sólo
  el nombre de la función y conservan sus `.catch(() => undefined)`; `deriveStageKey` —que es lo
  que ubica a cada lead— es un switch puro que no lee ninguna de las dos tablas. El único cambio
  visible de toda la corrida es la UI de ofertas, que era el entregable de F2.

---

## Cosecha de F1+F2 (26/09) — lo que el próximo no puede deducir leyendo

### Las tres migraciones están ESCRITAS y SIN APLICAR, y el orden no es el del documento

El modelo (`docs/modelo-oferta-producto-funnel.md`) numera de 0125 a 0131, pero el repo ya iba
por **0168** cuando se escribieron. Quedaron renumeradas **manteniendo el orden de aplicación**
que manda el modelo, y cada `.sql` dice en su cabecera a qué número del documento corresponde:

| Aplicar | Archivo | Es la del doc | Cuándo, respecto del deploy |
|---|---|---|---|
| 1º | `supabase/migrations/0169_ofertas.sql` | 0125 | **ANTES.** `listarOfertas()` es el único lector nuevo sin `.catch`: sin la tabla, el GET da 500 y la vista de ofertas pinta error en rojo |
| 2º | `supabase/migrations/0170_funnels.sql` | 0126 | **ANTES o JUNTO.** El código dejó de leer `funnel_config` en el mismo commit: deployar sin la tabla deja a todos en `origen:'error'` + `DEFAULT_PIPELINE` |
| 3º | `supabase/migrations/0171_funnel_ofertas.sql` | 0127 | **ANTES o JUNTO** con la 0170: tiene FK contra `funnels.id` |

Ninguna se aplicó: lo decide el humano después de mirar el deploy. Y **el orden es el inverso
al de la 0167/0168**, que se aplicaban después porque SACABAN algo que el código ya no usaba.
Acá las tres AGREGAN algo que el código ya lee.

**Vive en:** las tres cabeceras de `supabase/migrations/0169..0171` · `AGENTS.md` (la regla) ·
*2026-09-26 cosecha F1+F2*

### El rename se hizo SIN alias, y ese es el mecanismo — no una preferencia de estilo

**Qué cambió de forma.** `getFunnel()`, `getPipelineStages()`, `getFunnelTransitions()` y
`saveFunnel()` **ya no existen** en `lib/leads.ts`. Viven en `lib/funnels.ts`, partidas en dos
preguntas distintas: `getFunnelDefault()` («¿cómo vende este cliente?» — catálogos, prompts, el
editor, las columnas del board) y `getFunnelDeLead(lead)` («¿qué recorrido le toca a ÉL?» —
requisitos de etapa, validar un movimiento, la ficha). El mapeo fila → `FunnelConfig` quedó en
`lib/funnel-fila.ts`, PURO y sin `server-only`, para poder testear la regla sin Supabase.

**Por qué NO se dejó un alias.** Un `export const getFunnel = getFunnelDefault` compila, pasa
los tests y no rompe nada — hoy, con un funnel por workspace, las dos funciones devuelven lo
mismo. El día que un cliente cree el segundo, hay que revisar exactamente los mismos call-sites,
pero sin el compilador señalándolos y sin nadie que recuerde por qué. El alias no ahorra el
trabajo: lo posterga y lo vuelve invisible. Romper la compilación fue el único momento barato
para decidir los 33 usos uno por uno — y la prueba de que hacía falta es que **aparecieron más
de los relevados**: `etapasDelFunnel()` de la API de MaKo tenía 6 call-sites que el checklist no
listaba, y hubo que partirla igual (`etapasDelFunnelDefault()` / `etapasDelFunnelDeLead(lead)`).

**Regla.** Cuando una función se parte en dos significados y hoy los dos devuelven lo mismo, se
renombra **sin alias**: el rojo del compilador ES la lista de tareas, y es la única que nadie
puede ignorar. Corolario para el que busque: `getFunnel(` ya no existe en el repo, y
`grep funnel_config` sobre `lib/`, `app/` y `scripts/` solo devuelve comentarios históricos —
hay un test que lo fija (`tests/funnel-declarado.test.ts`).

**Vive en:** `lib/funnels.ts` (el docstring lo explica) · `lib/funnel-fila.ts` ·
`lib/api-mako/areas/crm.helpers.ts` · *2026-09-26 cosecha F1+F2*

### El prerrequisito de F3 no es la tabla: es el choke point, y hoy son 47 escrituras, no 32

F3 es `lead_participaciones` (la 0128 del modelo) y funciona por un **espejo**: `leads` sigue
trayendo las ocho columnas del intento vigente, así que `pipelineStageOf()` y sus ~1.200
lectores no se tocan. Pero un espejo necesita **un solo writer**, y por eso colapsar las
escrituras a `leads` en un choke point va **ANTES** de la migración, no después.

El modelo dice «≥32 escrituras en 15 archivos» y esa medición es del 10/08. **Medido hoy: 47 en
17 archivos** (43 `update`, 3 `insert`, 1 `delete`), repartidas así:

- `lib/leads.ts` **14** · `app/crm/actions.ts` **12** — las dos que concentran, y el candidato
  natural a choke point.
- `lib/pagos.ts` 3 · `lib/meta-write.ts`, `lib/mako-confirmaciones.ts`, `lib/crm-auto.ts`,
  `lib/api-mako/areas/crm.helpers.ts` 2 cada uno.
- Una cada uno: `lib/nutricion.ts`, `lib/etapa-historial.ts`, `lib/email-marketing.ts`,
  `app/crm/[id]/deal-actions.ts`, `app/api/whatsapp/contacts/[id]/block/route.ts`,
  `app/api/webhooks/chatwoot/route.ts`, `app/api/track/vsl/route.ts`,
  `app/api/extract-deal-fiscal/route.ts`, `app/api/extract-contract/route.ts`,
  `app/api/email/unsubscribe/route.ts`.

**Dos trampas al medirlo.** (1) El número **crece solo**: nadie agrega un `.update()` pensando
«estoy encareciendo F3», así que el conteo de cualquier documento está viejo el día que se lee —
hay que volver a medirlo antes de empezar, no confiarlo. (2) Un grep de una sola línea
(`from('leads')` y `.update(` en el mismo renglón) devuelve **35 de 47**: doce escrituras parten
el encadenado en dos líneas (9 en `lib/leads.ts`, 2 en `lib/pagos.ts`, 1 en
`app/api/track/vsl/route.ts`). Contar sin cubrir la forma multilínea deja afuera justo el
archivo que más pesa.

**Vive en:** `docs/modelo-oferta-producto-funnel.md` §3 «El prerrequisito que no se puede
saltear» · `lib/leads.ts` · `app/crm/actions.ts` · *2026-09-26 cosecha F1+F2*

### Lo que queda SIN hacer después de F1+F2, con el archivo donde vive

Los pendientes propios de cada fase están arriba, en su entrada; esto es lo que bloquea seguir:

- **F3 entero** — `lead_participaciones`, `leads.oferta_id` y `leads.producto_id` (las dos
  columnas existen y no las lee una sola línea de TypeScript). Antes: el choke point de arriba.
- **`nutricion_secuencias.funnel_id` tiene que estar en el MISMO release** en que un cliente
  real pueda crear su segundo funnel. La columna la crea la 0170, pero nadie la lee todavía:
  `lib/nutricion.ts`, `lib/crm-auto-plan.ts` y `lib/secuencias-huecos.ts` siguen siendo
  funnel-ciegos. Es el único riesgo del proyecto que **sale de la pantalla y le llega a una
  persona**: un WhatsApp del funnel equivocado.
- **`encuentroGrabable()` sigue siendo workspace-wide** (`lib/encuentro-ws.ts`): no lee
  `funnels.canal`, que es la mitad BOFU del modelo. Release-gate, no esta fase.
- **El clon y «Datos de Mau» no conocen `ofertas`** (`lib/clonar-config.ts`, `lib/datos-mau.ts`):
  hay que clonar SOBRE la fila que el destino ya tiene, como se resolvió con `funnels`.
- **`lead_magnets` nace con CRUD y sin lectores**: el imán sigue en
  `app_settings['mako.entregable']` (`lib/entregable.ts`, ~14 lectores). El dato y sus lectores
  se mudan juntos o no se mudan.
- **El wizard de cierre sigue sin preguntar por la oferta**: el desplegable que sí salió
  (abajo) elige qué funnel DIBUJA el tablero, no a qué oferta pertenece un lead. Eso es F3.

**Vive en:** `docs/productos-y-funnels-plan.md` (el estado, arriba de todo) ·
*2026-09-26 cosecha F1+F2*

## El selector de oferta del tablero elige el DIBUJO, no filtra los leads

El pedido fue sacar «1.142 de 1.142» de al lado de «Descartado» y poner ahí el desplegable
de producto/funnel/oferta. Lo que quedó: `/crm?funnel=<id>` lee las etapas y las
transiciones de ESE funnel (`getFunnelDe`) en vez de las del negocio, y el tablero se dibuja
con ellas. **Los leads son los mismos**: sin `lead_participaciones` (F3) no hay con qué
decir que un lead pertenece a una oferta y no a otra, así que filtrarlos sería inventar.
Cambiar de funnel es cambiar de página a propósito — las etapas se resuelven en el server y
no hay estado de cliente que sincronizar.

⚠️ **Y medido antes de escribir el control: los 9 workspaces tienen UN funnel («Funnel
principal», el que les creó la 0170) y CERO ofertas.** O sea que el desplegable, tal cual lo
pedía el enunciado, nacía con una sola opción y sin nada que elegir — un control que abre,
muestra una cosa y no hace nada, que se lee como que está roto y no como que falta crear
algo. Por eso la última fila no es un funnel sino una salida («Crear otra oferta»), y lleva
al único lugar donde hoy se crean, que es el cerebro. Antes de poner un selector sobre una
tabla nueva, **contá las filas que va a tener el día del deploy**, no las que va a tener
cuando la feature esté completa.

⚠️ **Y el id de la URL se valida contra los funnels DE ESTE workspace, no contra sí
mismo.** `getFunnelDe` ya va por `getTenantDb`, así que un id ajeno no devuelve datos de
nadie — devuelve `sin-fila`, o sea el pipeline GENÉRICO. No es una fuga; es algo más
difícil de ver: el tablero se dibujaría con el genérico mientras el desplegable, que no
encuentra ese id, sigue mostrando el del negocio. **Dos superficies contando cosas
distintas del mismo tablero, sin un solo error.** Por eso la validación no puede vivir en
la ola de lecturas paralelas: lo que se pide depende de su resultado, así que `listarFunnels()`
va antes y sola. Vale para cualquier `?algo=<id>` que elija con qué se dibuja una pantalla —
el fallback silencioso del lector no alcanza si otro control muestra el valor.

**Vive en:** `app/crm/CrmToolbar.tsx` (`SelectorFunnel`) · `app/crm/page.tsx` (el
`searchParams.funnel`) · *2026-09-26*

## Sacar la fricción del CRM: dónde quedó (27/09) y las tres que esperan a Mauricio

El relevamiento completo —32 frenos, con archivo y línea— está en
[docs/friccion-crm.md](friccion-crm.md) y se lee con los ojos en **`/admin/friccion`**.
Esa pantalla es la fuente de verdad del estado: dice arriba de todo, en el header, que
nada está aplicado, y se actualiza a medida que las tandas entran.

**Se acordó aplicarlo POR TANDAS, y que cada tanda venga con sus pasos de prueba.** Es
pedido explícito de Martín: quiere probar lo que se cambia, no leer que se cambió.

### Tanda 1 — HECHA y desplegada (`50df1cb2`)

Los tres bugs que no necesitaban decisión de nadie. El detalle está en el mensaje del
commit; lo que hay que saber para no deshacerlo:

- **`trabado` en `WizardShell` ya no apaga la salida.** La distinción que faltaba y que
  vale para cualquier pieza con estado de carga: lo que no se puede interrumpir es una
  **escritura** a mitad de camino (`pending`); cancelar una **lectura** no cuesta nada y
  no deja nada a medias. La ✕ y el clic afuera miran `pending`; el Atrás y el Confirmar
  siguen mirando `trabado`. Si alguien vuelve a unificarlos, vuelve el pop-up sin salida.
- **Escape lo cierra la capa de ARRIBA, y son dos mitades.** La ficha (`LeadSheet`)
  escucha en fase de CAPTURA sobre `window`, así que corre ANTES que cualquier diálogo
  anidado y su propio `stopPropagation` no la salva — para cuando corre, ya ganó. Se
  abstiene con `profundidadModales() > 0`, y `WizardShell` cierra lo suyo cuando
  `capa.visible`. **Las dos mitades hacen falta:** sólo la primera deja Escape mudo
  adentro de un wizard.

### Lo que NO entró, y por qué importa cómo se buscó

**«El mismo aviso 3 veces en la ficha»** quedó afuera de la tanda 1. Ese renglón se
escribió desde el relevamiento y **su `Vive en:` nunca llegó a `friccion-crm.md`**, así
que no está ubicado. Lo que ya se probó sin éxito: `grep` de `pendientesLead|pendientesDe|
faltanDatos|Faltan datos|datosPendientes` sobre `LeadSheet.tsx` y `[id]/LeadDetailBody.tsx`
(cero), y `grep` de `var(--bad)|var(--warn)` sobre `LeadSheet.tsx` (dos, ninguno es). El
próximo que lo tome: mirar los hijos de la ficha (las tabs), no la ficha.

⚠️ **La lección del renglón, que vale para todo este documento: una línea de una lista de
trabajo sin su `Vive en:` es una línea que alguien va a tener que volver a encontrar.**

### Tandas 2 y 3 — SIN EMPEZAR, y la 2 espera luz verde

- **Tanda 2 · «Propongo sacarlo» (9).** Cambian lo que se ve, así que se pidió el visto
  bueno antes de tocarlas: las dos pantallas de «no lo tengo» del cierre, el pendiente
  imposible de R2, la pestaña «Deal Details» vacía, las siete pestañas en inglés, la
  pestaña «Notas», el cartel de la «ventana informativa», la amenaza del subtítulo de
  CAPI, el rojo de Pendientes y los errores que no se cierran.
- **Tanda 3 · «Propongo cambiarle la forma» (10).**
- **Y las TRES que esperan a Mauricio** (están primeras en `/admin/friccion`): si el texto
  obligatorio de «por qué no usaste Calendly» es un freno a propósito; si la confirmación
  de cada arrastre sigue valiendo ahora que hay deshacer de 5 s + historial; y si al
  corregir un teléfono quiere previsualización antes o deshacer después.

### Verificado el 27/09: nada de la lista se había arreglado solo

La pregunta «¿esto ya no estará hecho?» se contesta con **`git show --name-only --format=""
<los commits del área desde el relevamiento>`** — cuatro segundos. Los cuatro commits del
CRM posteriores al 25/09 tocaban `page.tsx`, `CrmBoard` y `CrmToolbar` (el selector de
oferta) y ninguno tocaba `StageMoveDialog.tsx`, `stage-requirements.ts` ni la ficha, que es
donde vive casi toda la lista. **0 de 32.**

⚠️ **Y ese comando es la respuesta, no el punto de partida.** Se lanzaron 32 agentes para
verificarlo cuando el `git log` ya estaba corrido y contestado; Martín cortó la corrida.
La regla quedó en memoria ([[orquestacion-al-tamano]]): una corrida de verificación se
justifica cuando el estado del código es DESCONOCIDO, no cuando el historial ya lo dice y
sólo falta leerlo. El único rescate de esa corrida vale igual que el resto y está abajo.

⚠️ **Matiz medido que la lista tenía de más:** la pantalla «✓ Datos actualizados» salía
**sólo** en el camino «Completar datos» (`completarDatos={stageMove.move.to === from}`),
no al arrastrar un lead de etapa — ahí el wizard ya cerraba directo con el toast de
deshacer. La lista la describía como si saliera siempre.

**Vive en:** `docs/friccion-crm.md` (el relevamiento) · `app/admin/friccion/page.tsx` (el
estado, y lo que se lee) · `app/_components/WizardShell.tsx` · `app/crm/LeadSheet.tsx` ·
`app/crm/StageMoveDialog.tsx` · *2026-09-27*

## La página que reporta trabajo dice, arriba de todo, qué está APLICADO

`/admin/friccion` nació con tres CARDS grandes arriba (lo que esperaba respuesta) y tres
bloques de lista abajo (las propuestas). Martín: *«No entiendo las 3 cards grandes con la
diferencia de la lista de abajo… ¿Por qué no pusiste todo en una lista o todas en cards? ¿O
las de abajo ya las aplicaste?»*. Las dos mitades del reporte, y **la segunda es la grave**:

1. **Una card no dice «esto te toca a vos», dice «esto es más importante».** La distinción
   que se quería marcar —tu decisión contra mi propuesta— no se puede pintar con el tamaño
   de la caja: al cruzar el borde de la sección parece otro documento. Hoy todo es fila;
   `costo` y `pregunta` son campos opcionales que agregan un renglón, no otro lenguaje. Es
   la regla de la casa que ya estaba escrita («un grupo de cosas del mismo tipo es una
   lista», «dos piezas con el mismo esqueleto son una pieza con dos configuraciones»).
2. **No se podía saber qué estaba hecho, y eso no era un problema de forma.** La pantalla
   no decía en ningún lado que nada estaba aplicado, así que la pregunta no tenía respuesta
   posible mirándola. Va en el `estado` del `PageHeader`, que es lo primero que se lee.

**La regla que queda: toda pantalla que reporte trabajo propuesto declara su ESTADO antes
que su contenido.** Una lista de mejoras sin esa línea se lee como un changelog, y quien la
mira no puede distinguir lo que ya cambió de lo que alguien quiere cambiar.

Y dos cosas de forma que salieron en la misma pasada:

- **El costo era un número rojo de 22 px**, la escala que tenía cuando eso era una card. Al
  volverse una fila nadie se la bajó — el olor que `AGENTS.md` ya nombra («un elemento con
  el tamaño de cuando era OTRA cosa»).
- **Los títulos de los grupos ahora son todos un VERBO que contesta lo mismo**: qué pasa con
  esas filas. Antes mezclaban un veredicto («Sacar») con un tiempo verbal que sonaba a hecho
  («Me lo llevo»), y no se podía saber cuáles esperaban algo de quien leía.

⚠️ **Y el guard de voseo caza NOMBRES DE VARIABLE, no sólo copy.** La constante `DECIDIS`
lo hizo fallar, y ese commit dejó `main` con un test rojo porque **el pre-push no corre
`npm test`** — el hueco que `AGENTS.md` documenta y que hay que cubrir a mano cuando se
tocan nombres.

**Vive en:** `app/admin/friccion/page.tsx` · *2026-09-27*

## El importador rebotaba .xlsx por una razón que había dejado de ser cierta (27/09/2026)

El síntoma que se reportó: «arrastras un .xlsx y dice guárdala como CSV, y un PDF escaneado
sí lo lee». Lo que estaba abajo NO era una limitación: era un comentario que se había
quedado viejo y que nadie volvió a leer.

`app/crm/leads-importar.ts` decía, textual:

> Planillas: NO se soportan a propósito. Un .xlsx es un ZIP con XML adentro y parsearlo
> pide una dependencia entera; guardar la hoja como CSV es un click en Excel o en Sheets.

Estaba bien argumentado y era cierto el día que se escribió. Para el 27/09 el repo ya tenía
el lector desde semanas antes —`lib/office-a-texto.ts`, jszip (que ya estaba en el árbol
porque la usa mammoth) + regex sobre el XML— escrito para el **importador del plan**, otra
tab. Cero dependencias nuevas. La decisión se había vuelto falsa sin que nada avisara.

**La regla:** un comentario que justifica un «no» con una condición del entorno —«hace falta
una librería», «la API no lo devuelve», «el proveedor no lo permite»— lleva la condición
escrita y se re-lee antes de darlo por cerrado. El olor que lo delata acá: **el importador
leía un PDF ESCANEADO y no leía una planilla.** Cuando una capacidad supuestamente difícil
está resuelta y una fácil no, la que está mal es la explicación, no el producto.

⚠️ **Y el camino correcto no era el obvio.** Lo natural, con `archivoATexto` ya enchufado,
era mandar el .xlsx por donde va el PDF: texto → cascada barata → JSON de contactos. Eso
funciona y está mal: `xlsxATexto` devuelve las celdas **separadas por TAB**, o sea una tabla
delimitada, así que entra por el MISMO parser exacto del CSV. Lo que viaja en esas columnas
son teléfonos y emails, que es exactamente la clase de dato que un modelo puede transcribir
mal sin que nadie lo note hasta que falta una conversación de WhatsApp. El cambio fue un
parámetro (`parseCsv(text, delim = ',')`) y una función de veinte líneas.

⚠️ **Gana la primera hoja CON encabezados, no la primera hoja.** La hoja 1 de una planilla
real es muchas veces una portada, un resumen o un tablero. Quedarse con ella contesta «no
encontré una columna Nombre» sobre un archivo que la tiene una pestaña más allá: un error
verdadero sobre la pregunta equivocada. Medido con un .xlsx de dos hojas armado a mano.

**Vive en:** `app/crm/leads-importar.ts` (`filasDesdePlanilla`) · `app/crm/importar-server.ts`
· `tests/importar-planilla.test.ts` · *2026-09-27 friccion-tanda-3*

## «Todavía no sé cuántos» se leía como «no hay ninguno», y el botón lo afirmaba (27/09/2026)

El modal de exportar decía **«No hay nada para bajar»**, en gris y deshabilitado, mientras la
consulta del conteo estaba corriendo. La línea:

```ts
if (enUltimo) return (cuantos ?? 0) > 0;
const hayAlgo = (cuantos ?? 0) > 0;
```

`cuantos` es `number | null`, y el `null` significa «la consulta no volvió todavía». El `?? 0`
lo convierte en un HECHO del negocio —«tu filtro no selecciona ningún lead»— con un dato que
no se tenía. Es la misma familia que «no poder leer un dato no es un valor del dato», del
lado de la pantalla.

Y lo que lo vuelve gratis de arreglar: **el conteo no gobierna la descarga.**
`exportLeadsAction(f)` hace su propia consulta con el mismo filtro; `cuantos` se usa sólo
para el nombre del archivo. O sea que el botón frenaba por un dato que ni necesitaba.

**La regla:** un estado ternario —cargando / vacío / con datos— no se colapsa a booleano con
un `??`. El `??` está bien para un default de presentación («—», «0 leads») y nunca para el
`disabled` de un botón ni para el texto que afirma algo. Antes de escribir `(x ?? 0) > 0`,
preguntá qué dice la pantalla cuando `x` es null: si dice algo distinto de «estoy
averiguando», está mintiendo.

**Vive en:** `app/crm/ExportarLeadsModal.tsx` · *2026-09-27 friccion-tanda-3*

## Sacar la pregunta del asistente dejaba el wizard trabado cuando Calendly fallaba (27/09/2026)

El paso «¿Buscamos los datos automáticamente?» pasó a buscar solo — correcto, porque MaKo ya
engancha Fathom en cada carga del CRM y la respuesta era siempre la misma. Lo que ese cambio
destapa es la guarda de al lado:

```ts
case 'auto': return autoReporte != null;   // sin buscar, se sale con "Cargar a mano"
```

El comentario dice la verdad y se volvió mentira con el cambio: el botón «Cargar a mano» era
la única forma de avanzar sin reporte, y `buscarAuto` NO deja reporte cuando la action
devuelve error (`setErr(r.error); return;`). Con Calendly caído quedaba un wizard sin reporte
y sin botón, pidiendo algo que la persona no puede resolver.

**La regla, que es la de siempre vista desde el otro lado:** al automatizar un paso que tenía
una salida manual, la salida manual **no se borra — se re-encuadra**. Acá aparece cuando la
búsqueda falló, que es el único momento en que alguien la quiere, y la guarda pasó a mirar
«¿terminó de buscar?» en vez de «¿hay resultado?». Un automatismo sin interruptor, cuando
falla, no se arregla: se abandona.

**Vive en:** `app/crm/StageMoveDialog.tsx` (paso `auto`, `puedeAvanzar`) ·
*2026-09-27 friccion-tanda-3*

## El detalle de una fila del worklist es un DATO, y partirlo va del lado que DIBUJA (27/09/2026)

`PendienteItem.mensaje` llega del server con el detalle pegado al final:

> «La Reunión 1 del 12/09 ya pasó y todavía no se marcó cómo salió · pendiente: Setter
> asignado · Empresa · Link de Fathom (R1)»

Con 20 pendientes son 20 párrafos donde lo único que cambia está al final. La tentación es
acortar `mensaje` en `lib/queries.ts`, y ahí se rompen dos cosas que no se ven desde el CRM:
ese mismo campo lo lee **Vista General** para su alerta roja y lo leen los avisos, y los
`faltantes` son lo que hace que «Marcar en lote» encuentre esos leads.

**La regla:** cuando un dato sirve para dos cosas —informar a una pantalla y alimentar una
acción— el recorte va del lado del que dibuja, no del que produce. Acá el motivo y los chips
se derivan en `app/crm/worklist-fila.ts` (puro, sin `server-only`, con test) y `mensaje` sigue
entero.

**Vive en:** `app/crm/worklist-fila.ts` · `app/crm/CrmBoard.tsx` (`SinMarcar`) ·
*2026-09-27 friccion-tanda-3*

## Sacar un pop-up son TRES lugares, y el catálogo de notificaciones es el que se olvida (27/09/2026)

Borrar `IaUsageToast` dejó tres puntas colgando, y ninguna la ve el compilador:

1. **El montaje** (`app/layout.tsx`) — esa sí la ve, el import queda sin usar.
2. **Su entrada en `lib/notif-catalogo.ts`** — un interruptor en Configuraciones ›
   Notificaciones para algo que ya no se enciende. El propio archivo lo dice: *«Ofrecerle al
   usuario un interruptor para algo que nunca se enciende es peor que no ofrecerlo: apaga
   algo que ya estaba apagado y cree que hizo algo»*.
3. **Su ruta en el `vive[]` de un área de `/admin/dev`** (`ai-spend-cuotas`). Esta la cazó
   `tests/dev-areas.test.ts`, que chequea contra el disco que cada ruta exista — el único
   guard del repo para las rutas escritas a mano.

Y una cuarta que no es una ruta: **el camino de audio que sólo usaba ese aviso.** El beep de
WhatsApp era el único consumidor del sample de `/notif.mp3`, así que al sacar el sonido
quedaron vivos un `fetch` y un `decodeAudioData` en cada carga de la app para algo que no se
reproduce más.

⚠️ **Y los tests que usan un id del catálogo como EJEMPLO se rompen por el ejemplo, no por la
propiedad.** `tests/notificaciones.test.ts` probaba «el interruptor general no pisa el ajuste
individual» con `wa-mensaje` (que ese día dejó de sonar) y «lo que nunca suena queda en false»
con `ia-uso` (que ese día dejó de existir). Los dos siguen valiendo: se les cambió el ejemplo,
no la aserción. Es el modo de falla que `AGENTS.md` ya nombra —los tests miran los catálogos
POR SU NOMBRE— y lo cazó `npm test`, que **no corre en el pre-push**.

**Vive en:** `lib/notif-catalogo.ts` · `app/admin/dev/areas.ts` ·
`app/_components/NotificationsProvider.tsx` · *2026-09-27 friccion-tanda-3*

## Las «tres olas» al entrar al CRM eran una ola y dos awaits de cola (27/09/2026)

El relevamiento decía «tres olas de consultas que ni corren en paralelo», y medido en
`app/crm/page.tsx` la forma era otra: UN `Promise.all` con seis lecturas bien armado, y
después **dos `await` sueltos** (`getEquipoAction()` y los event types de Calendly) que no
dependen de nada de la ola. O sea dos viajes más sobre una carga que ya había terminado de
leer lo que importa.

Entran a la ola arrancándolos ANTES del `try` y esperándolos adentro del `Promise.all`; los
dos tienen su propio `.catch`, así que no pueden quedar como rechazo sin manejar entre que se
crean y que se esperan. La lectura que sí queda serializada es `listarFunnels()`, y está
documentado por qué: el id que viene por la URL se valida contra ella antes de pedir las
etapas.

⚠️ **Y lo que se reportó como «no pasa nada al hacer clic» no era el tiempo: era que no había
esqueleto.** El CRM es `force-dynamic`, así que sin un `loading.tsx` el router no tiene nada
con qué reemplazar la pantalla anterior y la deja a la vista hasta que el server contesta.
Paralelizar ayuda; lo que cambia el síntoma es el archivo de 70 líneas.

**Vive en:** `app/crm/page.tsx` · `app/crm/loading.tsx` · *2026-09-27 friccion-tanda-3*

## Cuatro filas «aplicadas» que no lo estaban, y la que lo estaba a la mitad (27/09/2026)

Un panel de 16 agentes releyó el plan de fricción entero contra el código. De las 23 filas
que `/admin/friccion` daba por aplicadas, **cuatro no lo estaban** — y ninguna de las cuatro
se distingue de las hechas mirando la pantalla, porque la pantalla lee el flag, no el código.

**Lo que las agrupa: todas se marcaron desde la pantalla donde se vio el síntoma.**

| Fila | Dónde se aplicó | Dónde NO |
|---|---|---|
| «7 de las 8 pestañas en inglés» | `LeadSheet.tsx` (el modal) | `app/crm/[id]/page.tsx` (la ruta) |
| «La pestaña Notas» · «la de Chat» | el modal | la ruta |
| «Deal Details que solo dice que está vacía» | el modal | la ruta |
| «Este dato entrena… (CAPI)» | `CrmBoard.tsx` (wizard «¿Qué hacer ahora?») | `StageMoveDialog.tsx` |
| «El rojo de Pendientes, y el mismo aviso 3 veces» | — | **las dos mitades** |
| «Errores que no se pueden cerrar ni resolver» | el chat del lead | la barra de error del tablero |

⚠️ **Y la ruta `/crm/[id]` no es una pantalla muerta**, que es lo que la hacía fácil de
olvidar: se llega desde el WhatsApp que avisa de un lead nuevo de la landing
(`app/api/track/optin/route.ts`), desde el Closing Analyst y desde el «Solucionar» de la
propia ficha. O sea que el cliente que sigue ese link veía la versión anterior del producto.

**La regla operativa, y es barata:** al marcar una fila como aplicada, `grep` del síntoma —no
del archivo que tocaste— y contá los resultados. «Overview» aparecía una vez más de la que
se arregló. Es «sacar un patrón es ENUMERAR dónde está» (AGENTS.md) con una guarda concreta:
el flag `aplicado` se pone DESPUÉS del grep, no después del commit.

⚠️ **Y una fila que junta DOS arreglos se marca hecha cuando se hace UNO.** «El rojo de
Pendientes, y el mismo aviso 3 veces» estuvo dos días en verde con **cero** cambios en el
código: son dos trabajos con una sola casilla. Una fila, un arreglo.

**Vive en:** `app/admin/friccion/page.tsx` · `docs/friccion-crm.md` ·
*2026-09-27 friccion-lo-que-falta*

## «El mismo aviso 3 veces» eran CUATRO, y el que sobrevivió más era el que nadie buscó (27/09/2026)

El síntoma estaba escrito desde el relevamiento y su `Vive en:` nunca se encontró; las notas
del proyecto lo daban por no ubicado. Aparece completo al abrir un lead en `/crm/[id]`:

1. `app/crm/[id]/LeadDetailBody.tsx` — un chip «N datos sin marcar» al lado del nombre, con
   **punto rojo parpadeando** (`blinkRed 1.4s infinite`) y **sin** guard de `!editing`.
2. el mismo archivo — `<DatosSinMarcarCard>` arriba de las tabs, **con** guard de `!editing`.
3. `app/crm/lead-view/GeneratedInsightCard.tsx` — «Para generar faltan datos» + la **misma
   enumeración**, dentro de la tab de Análisis.
4. `app/crm/[id]/EditLeadForm.tsx` — una tarjeta **roja** con punto parpadeante y un chip por
   dato, sólo en modo edición.

**Por qué los greps anteriores no lo encontraban:** se buscó el COMPONENTE
(`DatosSinMarcarCard`) y de los cuatro sólo uno lo usa. Los otros tres son el mismo aviso
**reescrito a mano** en tres formas distintas. Un patrón duplicado a mano no aparece buscando
el nombre de la pieza que lo implementa bien — hay que buscar lo que el usuario VE: acá, la
cadena `sin marcar` y el `faltantes.map(...).join(' · ')`.

⚠️ **Y el guard asimétrico es lo que lo hacía invisible en la revisión:** el chip NO tenía
`!editing` y el renglón SÍ, así que en lectura se veían 1+1+1 y en edición 1+1+1 pero de un
juego distinto. Nadie ve los cuatro a la vez, y cada pantalla por separado parece razonable.

**La cura de fondo no fue borrar tres, fue sacar el guard:** el `!editing` existía porque el
formulario dibujaba el suyo. Con un solo aviso que vale en los dos modos, no hay dos piezas
que se parecen — hay una.

**Vive en:** `app/crm/[id]/LeadDetailBody.tsx` · `app/crm/[id]/EditLeadForm.tsx` ·
`app/crm/lead-view/GeneratedInsightCard.tsx` · *2026-09-27 friccion-lo-que-falta*

## Un parámetro OPCIONAL hizo que la misma pregunta se contestara distinto en dos pantallas (27/09/2026)

`faltantesParaInsights(lead, tienePlan, pipeline?)` tenía el tercer argumento opcional. De
sus tres llamadores, **uno lo pasaba**:

| Llamador | Pasa `pipeline` | Qué mira |
|---|---|---|
| `app/crm/actions.ts` (el modal) | **sí** | el embudo del workspace |
| `app/crm/[id]/page.tsx` (la ruta) | no | el pipeline GENÉRICO |
| `lib/lead-insights.ts` (el gate del server) | no | el pipeline GENÉRICO |

Sin `pipeline`, `faltantesDeLead` resuelve la etapa contra el funnel por defecto, así que
devuelve OTRA lista. El resultado: la tab de Análisis del modal y la de la ruta decían cosas
distintas del MISMO lead, y el botón de generar se podía bloquear —por el gate del server—
con una lista que la persona nunca vio en pantalla.

**La regla:** un parámetro del que depende QUÉ SE CONTESTA no puede ser opcional. Un opcional
se olvida, y no falla: contesta otra cosa. Si el llamador no lo tiene, que vaya a buscarlo —
ése era el trabajo. Acá el gate del server resuelve el suyo con `getPipelineStagesDefault()`,
que es lo que debería haber hecho desde el principio.

⚠️ **El olor, y sirve para cualquier función así:** un `?` en un parámetro que se llama como
un contexto (`pipeline`, `stages`, `ws`, `tz`, `locale`). Ese tipo de parámetro no es una
opción de la función: es de qué mundo está hablando. Si se puede omitir, la mitad de los
llamadores va a hablar de otro mundo.

**Vive en:** `lib/lead-insights.ts` (`faltantesParaInsights`) · *2026-09-27 friccion-lo-que-falta*

## Escribir una etapa que el embudo no tiene no falla: el motor reporta que movió (27/09/2026)

`lib/crm-auto.ts` movía leads a `reactivacion`, `noshow_r1` y `noshow_r2` sin mirar si el
funnel del workspace tiene esas etapas. El `update` de Postgres es perfectamente válido —la
columna es texto— así que el motor reporta el movimiento, el historial lo registra, y el
tablero **no puede dibujar una columna que no existe**: `mapToCrmLead` descarta el override
huérfano y, si la derivada tampoco está, `effStage` manda el lead a la **primera columna**.

Medido en el relevamiento: **1.057 de los 1.138 leads del ws1** dibujados como si estuvieran
en «Nuevo».

Dos cosas distintas, y las dos hacían falta:

- **Descartar el override para UBICARLO está bien.** No hay columna donde ponerlo.
- **Borrar el hecho no.** Es «no poder hacer X con este dato no es que el dato sea falso»
  (AGENTS.md) aplicado a un view-model: el override sobrevive en `stageFuera` y la tarjeta
  lleva un chip que dice dónde está de verdad. Decirlo no mueve nada; mover 1.057 leads es
  una decisión de quien es dueño de los datos.

⚠️ **Y la guarda va en el CHOKE POINT, no en las tres reglas que escriben esas etapas.**
`moverAuto` es por donde pasan las siete reglas del motor: puesta ahí, la regla nueva que
alguien escriba mañana la hereda sin acordarse. Con el rechazo REGISTRADO, porque «el motor
no movió nada» y «el motor movió a una columna que no existe» se ven exactamente igual desde
afuera.

⚠️ Y el chequeo se abstiene si no puede leer el embudo (`etapasPorWs` guarda `null` y
contesta `true`): un motor que se apaga porque falló una lectura es peor que uno que mueve de
más, y una falla de lectura no es un hecho sobre el embudo.

**Vive en:** `lib/crm-auto.ts` (`moverAuto`, `etapaDibujable`) · `app/crm/crm-map.ts`
(`stageFuera`) · *2026-09-27 friccion-lo-que-falta*

## Medir en el navegador lo que no se puede reproducir en el navegador (27/09/2026)

El selector de producto «no estaba alineado» con «+ Nuevo lead». Se reportó **dos veces** y
las dos se contestó leyendo el código. La tercera se midió, y el número apareció enseguida:

- envoltorio `<span style={{ flex: 'none', minWidth: 190 }}>` alrededor de un `Dropdown` sin
  `width` → el `Dropdown` es `width: 'auto'`, o sea del tamaño de su contenido: **166,7 px**
  dentro de un hueco de **190** → **23,3 px muertos a la derecha**.
- con `width={190}` en el `Dropdown` → **0**.

⚠️ **Lo que costó fue llegar a medirlo, y de ahí sale lo que sirve.** El dev server del
directorio estaba vivo y servía **404 en TODAS las rutas, incluida `/api/auth/me`**; Next 16
chequea por DIRECTORIO y no por puerto, así que no deja levantar un segundo para el mismo
árbol («Run taskkill /PID … to stop it» en el log, no un error de puerto ocupado). Y con el
server ya reiniciado y sano, el navegador con la extensión seguía dando 404 donde `curl` con
la misma cookie daba 200.

**La salida: reproducir el MECANISMO, no la pantalla.** Las dos filas del CRM con sus estilos
inline exactos en un HTML suelto, medidas con `getBoundingClientRect`. Contesta la pregunta
que importaba —¿un flex item con `minWidth` mayor que su contenido deja hueco a la derecha?—
con un número, en un minuto, y sin depender de que la app arranque.

No reemplaza a verificar la pantalla de verdad, y hay que decir cuál de las dos se hizo. Lo
que sí reemplaza es razonar sobre el CSS tres veces seguidas y contestar «ya está».

**Vive en:** `app/crm/CrmToolbar.tsx` (`SelectorFunnel`) ·
`tests/crm-ficha-y-selector.test.ts` · *2026-09-27 friccion-lo-que-falta*

## Un test que persigue la AUSENCIA de algo se lee a sí mismo (27/09/2026)

`assert.ok(!/flexWrap: 'wrap'/.test(card))` falló sobre un componente que no tiene `wrap`: la
cadena estaba en el **comentario** que explica por qué no lo tiene.

Es la misma familia que «el analizador se lee a sí mismo» del Pixel, con el lector del otro
lado: acá el que lee es el test, y lo que lo delata es que la aserción falla justo cuando el
código está bien. **Todo test que busque que algo NO esté en un fuente mira el código sin los
comentarios.**

```ts
const sinComentarios = (t: string) => t.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
```

⚠️ **El orden importa: los de línea PRIMERO.** Si se sacan los de bloque antes, un `//` que
contenga un `/*` abre un bloque que se come el resto del archivo — el mismo bug que ya tuvo
el guard de voseo, y que ahí dejó 71 líneas sin mirar.

**Vive en:** `tests/crm-ficha-y-selector.test.ts` · *2026-09-27 friccion-lo-que-falta*

## Retirar una RUTA es enumerar sus links y decidir el destino de CADA UNO (28/09/2026)

«Quiero eliminar la ruta de funnel, que todo se edite como un pop-up dentro del mismo
CRM». El reflejo es borrar el `page.tsx` y arreglar lo que rompa. Lo que encontró el
barrido: **ocho lugares enlazaban a `/funnel`, y el destino correcto NO era el mismo para
los ocho** — tres destinos distintos para una sola ruta retirada.

| Quién enlazaba | A dónde va ahora | Por qué |
|---|---|---|
| El menú «···» del CRM y el lápiz de cada producto | el **pop-up** del CRM | es lo que se pidió: editar las etapas mirando el tablero que esas etapas dibujan |
| El panel de tracking de la landing (**lo aprieta el CLIENTE**) y el onboarding del Chat Agent | `/onboarding?tab=funnel` | prometen «activar la landing como entrada de leads» y **esa casilla no está en el pop-up**: vive en la tarjeta de entradas del editor completo |
| La sub-tab «Funnel» de Configuraciones, el `match` del nav, el título de tab | **se borran** | un destino que rebota no es un destino |

⚠️ **La ruta se REDIRIGE, no se borra.** Dos de los links los sigue un cliente desde su
propia landing, y afuera del repo viven marcadores y avisos de WhatsApp ya mandados con
esa URL. `app/funnel/page.tsx` quedó como `redirect(await rutaConWs(...))`, traduciendo el
`?f=` del viejo al `?funnel=` que usa el CRM. Y **`FunnelEditor` y `EntradasCard` siguen
existiendo en esa misma carpeta**: lo que se retira es la ruta, no los componentes — los
montan `/onboarding` y `/second-brain`, y Next sólo hace ruta de un `page.tsx`.

⚠️ **Y UN LINK QUE PROMETE UN CONTROL TIENE QUE ATERRIZAR DONDE ESTÁ ESE CONTROL.** El
botón del cliente decía «Activar la landing como entrada de leads». Mandarlo a
`/onboarding` pelado lo dejaba en «Matriz», la primera de **once** pastillas, buscando una
palabra que no conoce. Por eso el hub de onboarding pasó a leer su tab de `?tab=` (se lee
en el server y se escribe con `router.replace`, que es la regla de la casa) — sin eso el
link es peor que ninguno: la persona busca hasta que se cansa y concluye que el producto
está roto.

**Lo que quedó como guard:** `tests/funnel-estructura.test.ts` barre `git ls-files app lib`
y falla si algún archivo vuelve a enlazar la ruta. Dos afinados que costaron una vuelta
cada uno y valen para cualquier guard de este tipo:

- **Se busca un LINK, no la palabra.** El primer patrón aceptaba `/funnel` rodeado de
  comillas **o de espacios** y cazó **quince falsos positivos**: la ruta se nombra en la
  prosa de los comentarios de medio repo («el editor de /funnel autoguarda en cada
  tecla»). El patrón bueno exige que `/funnel` **arranque** una cadena.
- **Y se saltean las líneas de comentario**, porque la convención de la casa es nombrar una
  ruta entre backticks — o sea que el guard se acusaba a sí mismo por los comentarios que
  explican que la ruta se retiró.

⚠️ **Y COMPROBAR UN `redirect()` DE APP ROUTER CON `domcontentloaded` DA QUE NO REDIRIGE.**
Medido: `curl` sin sesión da el 307 del middleware (que es OTRA cosa: nunca llegó a la
página), y con sesión da **200 con el HTML entero y el cuerpo vacío** — el destino viaja
adentro del payload RSC (`/crm?funnel=7;307;`) y lo aplica el navegador. Con
`waitUntil: 'domcontentloaded'` Playwright vuelve ANTES de eso y reporta la URL vieja, o sea
un redirect perfectamente sano leído como roto. Se espera el CAMBIO DE URL
(`waitForURL`), nunca la carga del documento.

Las tres verificadas así: `/funnel` → `/crm`, `/funnel?f=7` → `/crm?funnel=7`, y
`/funnel?f=abc` → `/crm` (un id que no es un número se ignora).

**Vive en:** `app/funnel/page.tsx` · `app/onboarding/OnboardingTabs.tsx` (`tabDeUrl`) ·
`lib/landing-token.ts` · `tests/funnel-estructura.test.ts` · *2026-09-28 crm-etapas-popup*

## El pop-up de etapas NO es el editor adentro de una caja (28/09/2026)

La salida barata era `<Modal><FunnelEditor /></Modal>`. Son 527 líneas que dibujan las
transiciones, las nutriciones suprimidas, las plantillas de canal y la tarjeta de entradas,
autoguardan el jsonb **entero** con un debounce por tecla, y asumen que son la pantalla
(`<main>`, altos en `vh`, su propia URL). Habría traído las seis decisiones de «Montar una
PANTALLA adentro de un modal» y, sobre todo, habría contestado lo contrario de lo que se
pidió — *«y que sea simple la edición, nada compleja»*: lo mismo en una ventana más chica.

`app/crm/EtapasModal.tsx` hace UNA cosa: la lista de etapas que se ve detrás, con su
nombre, su orden, agregar y quitar.

⚠️ **CADA CAMBIO ES UNA OPERACIÓN, no un «Guardar» al final.** Al tablero le llegan las
etapas ya **DERIVADAS** — el pipeline crudo nunca sale del server — así que mandar la lista
reconstruida desde la pantalla le haría perder todo lo que la derivación agrega y quita,
sin un solo error. Se pide «renombrá ésta», «subí ésta», y `editarEtapaAction` lee, parcha
y guarda del lado del server. Es el mismo contrato que ya usaba el menú «···» de la
columna, con una operación más: `mover`.

⚠️ **`mover` sólo recorre el PIPELINE, y eso no se ve mirando la pantalla.** Tres de las
cuatro terminales (`perdido`, `descal`, `noresp`) **no están en el pipeline**: las agrega
`generateFunnel` al final en cada lectura. Moverlas «funcionaría» —el guardado no falla— y
la pantalla las volvería a dibujar donde estaban: la peor forma de no hacer nada.

⚠️ **Y UN BOTÓN QUE SIEMPRE FALLA ES PEOR QUE UNO APAGADO.** Medido en el navegador con el
funnel del ws1: «Facturando» es la última etapa propia y su ↓ salía **encendido**, pero el
intercambio es contra «Ganado» —el cierre, que va último— y el server lo rechaza siempre.
Se apaga toda flecha cuyo vecino sea fijo. Esto no sale del código: sale de abrir el
pop-up y leer el `disabled` de cada botón.

**Y el pop-up refresca el tablero en CADA cambio, no al cerrar.** Las columnas se leen en
el server: sin `router.refresh()`, quien renombra una etapa y mira detrás del pop-up ve el
nombre viejo. Es exactamente el síntoma que se reportó tres veces como «no cambió
absolutamente nada».

**Verificado en el navegador** (ws1, contra la base real, sobre el funnel descartable
«Prueba 3» y devolviéndolo como estaba): agregar → renombrar → subir → bajar → quitar, las
cinco con su efecto y cero errores de consola.

**Vive en:** `app/crm/EtapasModal.tsx` · `app/crm/actions.ts` (`editarEtapaAction`,
`etapasDeFunnelAction`) · `tests/funnel-estructura.test.ts` · *2026-09-28 crm-etapas-popup*

## Un menú de acciones no lleva la flecha del desplegable (28/09/2026)

Reportado así: *«En las columnas son tres puntos "..." no 2 y una flecha»*. El menú de la
columna reusa el `Dropdown` del repo —hace falta, porque el tablero vive dentro de un
`overflowX: auto` y un menú en flujo normal se recorta contra el borde de la columna— y ese
primitive dibujaba el `▾` **sin preguntar**, en la línea 330. Con los dos juntos el control
se leía `⋯ ▾`, o sea un desplegable a medio dibujar.

La flecha dice «acá se elige un valor y el elegido queda escrito»; los tres puntos dicen
«acá hay cosas para hacer». Son dos controles distintos y el primitive los servía igual.
Va `sinFlecha`, y el que lo pide es el llamador.

**Vive en:** `app/components/Dropdown.tsx` · `app/crm/CrmBoard.tsx` · *2026-09-28 crm-etapas-popup*

## `router.refresh()` deja la lista UN PASO ATRÁS cuando lo que cambió es QUÉ EXISTE (29/09/2026)

Medido en el navegador, y es lo que más costó de la tanda. Con
`router.push('/crm') + router.refresh()` después de archivar un embudo:

| Momento | La base | El selector |
|---|---|---|
| tras eliminar «Prueba 2» | `activo = false` | sigue mostrándola |
| tras recuperarla | `activo = true` | muestra la lista de ANTES de recuperarla |

Cuatro segundos de espera y `networkidle` no alcanzaron: la pantalla va siempre una mutación
atrás. **Un borrado que parece no haber pasado es peor que uno lento** — la persona lo aprieta
de nuevo, o concluye que la app está rota.

**La regla: cuando lo que cambia no es una FILA sino QUÉ EXISTE —qué embudos hay, qué
workspaces, qué tabs— se navega DURO y se paga la recarga entera.** `router.refresh()` es la
herramienta para «los datos de esta pantalla cambiaron»; acá cambia el conjunto del que cuelga
media pantalla, incluido el `?funnel=N` de la URL, que puede haber dejado de resolver.

⚠️ **Y la navegación dura es la CUARTA forma de navegar de AGENTS.md**, así que va con
`conWs(destino, useWs())`. Sin el `?ws=`, el super admin que está mirando a un cliente termina
en SU propio CRM — que es exactamente el caso del 16/08 con el reset del cliente de prueba.

⚠️ **Y el corolario del efecto que se pregunta UNA vez.** El renglón «Embudos eliminados» sólo
se dibuja cuando hay alguno, y su `useEffect` tenía `[]`: corría al montar, con cero
archivados, y nunca más. O sea que **la puerta de vuelta se volvía invisible justo después de
la única acción que crea algo para recuperar**, y el archivado quedaba indistinguible de un
borrado. Se re-pregunta cuando cambia la lista de embudos, que es la señal real.

**Vive en:** `app/crm/EtapasModal.tsx` · `app/crm/CrmToolbar.tsx` ·
`tests/funnel-estructura.test.ts` · *2026-09-29 crm-embudo-popup*

## Eliminar un embudo es ARCHIVARLO, y la columna ya existía (29/09/2026)

«Con mucho cuidado si un funnel tiene leads. Y siempre guardando una copia de seguridad en
caso de eliminar un funnel con leads, por si el usuario lo quiere "recuperar"».

**La copia de seguridad no hubo que inventarla:** `funnels.activo` existe desde la mig 0170 y
`listarFunnels` ya filtraba por ella. Archivar saca el embudo de la pantalla y deja la fila, su
`data` entera (el pipeline, las entradas, las nutriciones suprimidas) y sus leads —que siguen
con su `funnel_id` apuntando ahí— intactos. Una tabla de respaldo aparte habría sido un segundo
lugar con los mismos datos, que se queda viejo.

⚠️ **EL DEFAULT NO SE ARCHIVA, y el guard va en el SERVER.** El índice parcial
`funnels_ws_default_uk` garantiza que un workspace tiene EXACTAMENTE uno, y medio repo asume
que existe: `getFunnelDefault`, el CRM sin `?funnel=`, el onboarding, los prompts. Archivarlo no
daría error — daría un workspace cuyo embudo por defecto no se puede leer.

⚠️ **Y RENOMBRAR PUEDE NO SER LA TABLA `funnels`.** La pantalla muestra el nombre del
**PRODUCTO**: todos los funnels se llaman «Funnel principal» porque lo puso la migración, y
`listarFunnels` lo tapa con el del producto principal (`v_funnel_productos`). Escribir
`funnels.nombre` y refrescar deja la pantalla EXACTAMENTE IGUAL — un guardado que funciona, no
da error, y no se ve. Se escribe donde se LEE.

⚠️ **Y EL CONTEO DE LEADS NO PUEDE DEVOLVER 0 CUANDO FALLA.** «Este embudo no tiene leads»
sobre uno lleno es lo que hace que alguien lo elimine tranquilo. Va con `head: true` +
`count: exact` (traerlos para contarlos toparía en 1000 y daría un número redondo perfectamente
plausible sobre un embudo de 1.145) y un error TIRA en vez de contestar cero.

**Vive en:** `lib/funnels.ts` (`archivarFunnel`, `restaurarFunnel`, `renombrarFunnel`) ·
`lib/leads.ts` (`contarLeadsDeFunnel`) · *2026-09-29 crm-embudo-popup*

## El embudo se configura en UN lugar, y las terminales salen de la lista (29/09/2026)

Tres pedidos de Martín que son el mismo: *«No está la edición de NUTRICIÓN dentro de la edición
del funnel, te propongo que sea otra subtab dentro del modal»*, *«Que no aparezcan en el
editable las etapas que no se puedan editar... Como "Ganado" etc»*, y —al día siguiente, sobre
el editor completo que había quedado vivo en /onboarding— *«Tienes que eliminar esto, ya te lo
habia pedido»*.

El pop-up quedó con **tres subtabs, cortadas por PREGUNTA**: por dónde PASA un lead (Etapas),
qué se le manda cuando se enfría (Nutrición), y cómo LLEGÓ (Cómo entran). Y el editor de 527
líneas se borró: dos editores del mismo jsonb —uno que autoguarda por tecla y otro que manda
operaciones— es la forma de que el embudo quede distinto según por dónde se lo tocó.

⚠️ **LAS DOS DECISIONES SOBRE LAS TERMINALES NO SE CONTRADICEN.** El 28/09: «están SIEMPRE, son
únicas, y sí se les puede cambiar el nombre». El 29/09: «que no aparezcan en el editable». Se
cumplen las dos poniéndolas FUERA de la lista que se reordena, como pastillas bajo «En todos tus
embudos» — siguen renombrándose, y dejan de ocupar la mitad del pop-up con seis botones
apagados. Medido: en el funnel del ws1 eran 4 etapas propias y 4 terminales, o sea la mitad de
las filas.

⚠️ **Y AL BORRAR UNA PANTALLA, SUS TESTS SE MUEVEN CON ELLA — NO SE BORRAN.** Al eliminar el
editor cayeron seis tests, y uno de ellos guardaba algo que el pop-up NO tenía: los avisos de
`problemasDePipeline`, que son los que impiden que un embudo quede roto **y callado** (el caso
real de la inmobiliaria que tipó su descarte como «cierre» y el sistema le pedía el MONTO DE LA
VENTA para descalificar a alguien). Borrar el test habría borrado la capacidad sin que nada
fallara. Se mudó, y el cálculo cambió de lado: `problemasDePipeline` mira el `kind` y el ORDEN
del pipeline **crudo**, que nunca sale del server, así que se calcula en `embudoEnDetalleAction`
y baja como texto.

**Vive en:** `app/crm/EtapasModal.tsx` · `app/crm/EmbudoEntradas.tsx` · `app/crm/actions.ts`
(`embudoEnDetalleAction`) · *2026-09-29 crm-embudo-popup*

## Una clave AUSENTE no es un cero, y ahí se caía la feature entera (29/09/2026)

El pedido era sacar la fricción: *«si intento eliminar una columna que NO tiene ningún lead,
no debería haber nada de fricción. Solo que me salte el pop-up de deshacer»*. El conteo por
etapa se armaba así:

```ts
const out: Record<string, number> = {};
for (const l of leads) out[deriveStageKey(l)] = (out[...] ?? 0) + 1;
```

Una etapa **vacía no entra al mapa**, así que el lector recibe `undefined` — y la pantalla lo
lee, con razón, como «no pude contar» y pregunta. **La fricción volvía exactamente en el único
caso donde no tenía que estar**, y el código se veía correcto: cuenta bien lo que hay.

Lo delató el navegador, no el código: se quitó una etapa de un embudo sin un solo lead y saltó
el diálogo igual. La cura es una línea —`for (const st of cfg.stages) out[st.key] = 0;`— y la
regla es la de siempre: **un valor nulo y una clave ausente no son lo mismo**, y acá la
diferencia era toda la feature.

**Vive en:** `app/crm/actions.ts` (`conteosDeEtapasAction`) · *2026-09-29 crm-embudo-popup*

## Deshacer un borrado tiene que devolver la MISMA clave, no una igual (29/09/2026)

El camino barato para deshacer «quitaste una etapa» es volver a llamar a `agregar` con el
mismo nombre. No sirve: **`agregar` acuña una clave nueva**, y la clave es lo que ata un lead
a su etapa (`deriveStageKey` devuelve claves canónicas, y `leads.stageFuera` las compara por
igualdad). El resultado sería una columna con el mismo nombre y los leads afuera — que es peor
que no deshacer, porque *parece* que funcionó.

Por eso `editarEtapaAction` devuelve, al eliminar, la etapa ENTERA y su índice
(`{ etapa: { key, label, dot, kind }, at }`), y hay una op `insertar` que la vuelve a poner
tal cual. El toast de 5 segundos la usa.

⚠️ **Y `deshacer` vive FUERA del `try`.** Declarado adentro, el `return` de abajo no lo puede
nombrar — el compilador lo dice, pero es la misma trampa de scope que en el puente a Flow
costó cobrarle dos veces a un cliente, y ahí no la dijo nadie.

**Vive en:** `app/crm/actions.ts` · `app/crm/EtapasModal.tsx` · *2026-09-29 crm-embudo-popup*

## Lo que hace lento a un pop-up no es lo que dibuja: es lo que pide de más (29/09/2026)

*«Cuando entro a editar un producto queda en "cargando", no debería tardar nada eso»*. Lo que
tardaba eran dos consultas que no hacían falta:

- **`listarFunnels()` sólo para el nombre y el `es_default`.** El nombre ya lo tiene la
  pantalla —lo dibuja el selector, y viaja como prop— y el `es_default` viene **en la misma
  fila** que el pipeline. Eran la vista `v_funnel_productos` más la tabla `productos`, en el
  camino crítico de abrir.
- **El conteo de leads por etapa.** Ése sí hay que traerlo —la etapa se DERIVA, no es una
  columna— así que se mudó a su propia lectura que llega DESPUÉS. El pop-up abre con lo que
  necesita; hasta que el conteo llega, quitar una etapa pregunta (el default seguro es la
  fricción, nunca borrar sin avisar).

**La regla: antes de optimizar una consulta, preguntá si hace falta.** Las dos que se sacaron
contestaban preguntas que ya tenían respuesta a mano.

⚠️ **Y un «Cargando…» escrito no es un loader.** Un texto no dice que algo está pasando: dice
que algo dice que está pasando. Va el giro.

**Vive en:** `app/crm/actions.ts` (`embudoEnDetalleAction`, `conteosDeEtapasAction`) ·
*2026-09-29 crm-embudo-popup*

## Reordenar contra el server es lento por diseño: el orden lo pinta el navegador (29/09/2026)

*«Cuando muevo de lugar una columna o etapa, se tarda muchísimo, no debería tardar tanto en
moverse»*. Cada flecha hacía: escribir en el server → releer el detalle → releer los conteos →
recién ahí repintar. Tres viajes para mover una fila un lugar.

Va OPTIMISTA: el orden se pinta al instante con estado local, el server confirma detrás y la
relectura resincroniza. Si el server rechaza, el estado local se descarta y vuelve el de la
base — que es lo que hace que esto no mienta.

⚠️ **Y el arrastre manda las CLAVES, no el pipeline.** La op `reordenar` recibe `string[]` y el
server reordena el pipeline que ya tiene: una clave que no exista se ignora, y **lo que el
navegador no nombró se conserva al final**. Sin eso último, un arrastre borraría `ganado` del
embudo — vive en el pipeline y no se dibuja en la lista, así que nunca viaja.

**Vive en:** `app/crm/EtapasModal.tsx` · `app/crm/actions.ts` · *2026-09-29 crm-embudo-popup*

## Diferir una consulta a una SEGUNDA server action no la saca del camino crítico (29/09/2026)

Es la corrección de lo que está escrito unas secciones más arriba, y vale la pena leer las
dos: **el arreglo era correcto en el razonamiento y no movió el número**.

«Al abrir sigue tardando mucho en cargar». Lo anterior había sacado dos consultas del
detalle y mudado el conteo de leads a `extrasDelEmbudoAction`, con el argumento de siempre:
la pantalla abre con lo que necesita y el dato caro llega después. La action bajó de ~550 a
**250 ms** medidos en el server. Y el tiempo hasta dibujar la primera etapa siguió en
**1036 ms**, contra los 1053 de antes.

Lo que faltaba era medir el CAMINO, no la consulta. Con un `fetch` instrumentado en el
navegador, desde el click:

```
click                                    +0 ms
sale  embudoEnDetalleAction            +121 ms   ← el montaje de React
vuelve                                 +439 ms   (318 ms de viaje)
sale  extrasDelEmbudoAction            +442 ms   ← 3 ms después de la anterior
vuelve                                 +752 ms
primera fila dibujada                  +941 ms
```

⚠️ **Las dos actions no corren en paralelo: se ENCOLAN.** Next.js despacha los server
actions de a uno, así que la segunda sale 3 ms después de que vuelve la primera. Diferir una
lectura cara a otra action no la saca del camino — la pone DETRÁS, y la suma (318 + 310) es
peor que la única consulta de antes.

**Lo que sí lo arregló: no preguntar.** Las etapas ya estaban en pantalla, arriba, dibujadas
como las columnas del tablero — `CrmBoard` recibe `stages` del server en cada carga. El
pop-up abre pintando ESO y el server confirma detrás. Medido: **941 ms → 167 ms**, con las
dos listas idénticas (verificado comparando la lista al abrir contra la lista tres segundos
después: no parpadea).

Tres cosas que lo hacen honesto:

- **El mapeo vive en UN lugar** (`etapasVisibles`, en `lib/pipeline.ts`) y lo llaman el server
  y el tablero. Con dos copias, el pop-up abre mostrando una lista y medio segundo después
  muestra otra, que se lee como que la app cambia sola.
- **La semilla va sólo si el pop-up abre sobre el embudo QUE SE ESTÁ MIRANDO.** Desde el
  desplegable se edita otro producto sin cambiar de tablero, y ahí estas etapas son de otro
  embudo: pintarlas sería mostrar la lista equivocada durante medio segundo.
- **Lo que el tablero no sabe sigue esperando al server**: si se ofrece «Eliminar producto»
  (depende de `es_default`), las nutriciones, y por dónde entra la gente. Pintar las casillas
  de entradas vacías le diría a un negocio que las declaró que no tiene ninguna.

**Vive en:** `app/crm/EtapasModal.tsx` · `app/crm/CrmBoard.tsx` · `lib/pipeline.ts` ·
*2026-09-29 crm-embudo-popup*

## La etapa de ENTRADA es un `kind`, no la posición 0 (29/09/2026)

*«Por defecto, la primer etapa debería ser "Lead entrante", no se debería poder mover, y
tampoco nadie puede poner algo atrás de esa etapa. Y desde allí debería salir el desplegable
para configurar»*.

La salida barata es `etapas[0]`. No sirve: **arrastrar otra etapa encima la convertiría en la
entrada** sin que nadie lo decida, que es justo lo que el pedido prohíbe. La entrada es la que
el pipeline declara `kind: 'entrada'` — lo que ya distinguían las cinco plantillas
(`pk('lead', 'entrada')`).

Medido contra producción antes de atarlo a eso, porque una regla sobre un campo que no está
poblado es una feature que desaparece: **de 15 embudos, los 11 con pipeline propio declaran
exactamente una entrada y los otros 4 tienen el pipeline vacío**, así que caen a
`DEFAULT_PIPELINE`, que también la trae. El respaldo «si ninguna la declara, es la primera»
existe igual, porque de ese lápiz cuelga la ÚNICA pantalla donde se declara cómo entra la
gente: un embudo sin entrada no perdería una fila, perdería la puerta.

⚠️ **Y las CUATRO puertas al orden se cierran en el SERVER**, no en la pantalla: eliminar,
mover, reordenar (un arrastre) e insertar (el deshacer de un borrado). La pantalla ya no lo
ofrece; el que decide es el server, y una pestaña vieja o un pedido armado a mano entran por
cualquiera de las cuatro.

**Y el rótulo por defecto era `«Lead (Instant form)»`** — el nombre de UNA de las cinco formas
de entrar, en la etapa por la que entran las cinco. Quien vende por carrito leía el nombre de
un producto de Meta que no usa. Cambiar el default **no alcanza**: los 10 embudos que ya
habían guardado su pipeline tienen NUESTRA cadena congelada adentro del jsonb. Va con
backfill (mig 0182), comparando contra la cadena EXACTA — el único renombrado de verdad
(«Contacto nuevo», ws11) no matchea y queda intacto. Verificado después: 10 cambiados, 0
viejos, 1 intacto, y el orden sin tocar.

**Vive en:** `lib/pipeline.ts` · `app/crm/actions.ts` · `supabase/migrations/0182_lead_entrante.sql` ·
*2026-09-29 crm-embudo-popup*

## Cada hijo directo del cuerpo de un `Modal` trae 18 px arriba y abajo (29/09/2026)

`.mk-modal__cuerpo > *:not(.mk-modal__fondo) { padding: 18px 0; }`. Está bien para el DETALLE
de algo —bloques de distinta naturaleza que se separan solos— y sorprende en cualquier otra
cosa: dos bloques sueltos (una aclaración y una lista) quedan con **~48 px** de hueco entre
ellos, que se lee como que falta algo ahí en el medio.

No se pelea con `marginTop` negativos: el contenido del paso va adentro de **un solo** `div`,
y el espaciado lo decide quien escribe la pantalla. Es el mismo criterio que `sinFiletes` —la
regla del cuerpo es para el detalle, no para un formulario.

**Vive en:** `app/_ui/ui.css` · `app/crm/CrmToolbar.tsx` · *2026-09-29 crm-embudo-popup*

## Una rotura que el guard no ve no prueba el guard: prueba la rotura (29/09/2026)

Los cuatro guards de esta tanda se probaron rompiéndolos, y **uno de los doce intentos no
rompió nada**: para comprobar que el test ve si `Modal` deja de emitir `data-sin-filetes`, el
atributo se cambió por `data-sin-filetes-NO`… que el propio regex `/data-sin-filetes/` sigue
matcheando. El archivo dio 25 / 0 y por un momento pareció un guard flojo.

El guard estaba bien; la rotura estaba mal. Renombrando a `data-filetes` dio 24 / 1.

**La regla: la rotura tiene que ser lo que el guard persigue, no algo parecido.** Y si una
rotura sale verde, la primera hipótesis es la rotura — es más barata de comprobar que el
guard, y es la que más veces gana.

**Vive en:** `tests/funnel-estructura.test.ts` · *2026-09-29 crm-embudo-popup*

## Una receta de migración escrita en un documento ES código (30/09/2026)

El hallazgo más caro de la tanda, y no estaba en ningún `.ts`: estaba en
`docs/modelo-oferta-producto-funnel.md`, listo para copiar y pegar.

```sql
update leads l
   set participacion_activa_id = p.id,
       funnel_id = p.funnel_id,          -- ⬅ esta línea
  from lead_participaciones p ...
```

Y `listLeadsDeFunnel(null)` —el tablero del embudo POR DEFECTO— filtra con
`.is('funnel_id', null)` (`lib/leads.ts:302`). Medido contra producción: **`leads.funnel_id`
está en NULL en las 1.530 filas de los 6 workspaces con datos**. O sea que correr ese
backfill hace que ninguno matchee el filtro: **el CRM queda en cero para todo el mundo**,
sin un error, sin un log y sin una fila borrada.

Nadie lo había corrido. Pero el documento tenía el `where not exists` que lo hace
re-ejecutable, el orden de los pasos y el comentario de cuándo re-correrlo — o sea, estaba
escrito para que alguien lo ejecutara. **Un SQL en un documento no es una nota: es una
instrucción con la autoridad del repo**, y el que la siga dentro de tres semanas no va a
tener el contexto de por qué esa columna en NULL es un valor y no un hueco.

**La regla: lo que se documenta como ejecutable se audita como código.** El guard barre
`supabase/migrations/` **y** `docs/` buscando un `update leads … set … funnel_id =`, y
falla. Y va con su pareja: un segundo guard fija que el lector siga tratando NULL como el
embudo del negocio — si eso cambia, el backfill deja de ser peligroso y el primer guard
estaría prohibiendo algo inocente. Los dos se leen juntos o ninguno se entiende.

⚠️ Y de paso, en el mismo bloque: `alter table leads add column if not exists funnel_id
… references funnels(id)`. La columna YA existe (mig 0181) y a propósito **sin** foreign
key, así que con la columna puesta Postgres **no agrega la FK**: es un no-op silencioso que
deja creyendo que la restricción está.

⚠️ **Y EL GUARD SE ACUSÓ A SÍ MISMO en el mismo commit que lo escribió.** Esta entrada que
estás leyendo pega el SQL culpable adentro de un bloque de código —para eso existe una
autopsia— y el barrido la marcó: 2.687 tests, 1 rojo, sobre un documento. Es el tercer caso
del mismo día de «un guard que mira la PALABRA no distingue el código del texto que lo
explica», que este repo ya tenía escrito dos veces (`FunnelEditor`, «Cómo entran»). Los
`docs/hallazgos-*.md` se excluyen por NOMBRE, con el porqué al lado — y se verificó que el
guard siga cazando el caso real devolviendo el backfill al documento del modelo: 9 / 1.

**Vive en:** `docs/modelo-oferta-producto-funnel.md` · `lib/leads.ts` ·
`tests/leads-por-producto.test.ts` · *2026-09-30 crm-tanda-4*

## `funnel_id = null` y el id del embudo por defecto son EL MISMO LUGAR (30/09/2026)

Es la trampa que hace que todo lo de arriba importe, y muerde en cada pantalla nueva que
quiera decir «en qué producto está esto».

El aviso de duplicados es el caso: para poder ofrecer «muévelo aquí» hay que saber si el
lead que choca está en OTRO producto. Comparar los dos números crudos
(`lead.funnel_id !== funnelActual`) diría «está en otro producto» sobre **cada lead que
existe hoy** — porque los 1.530 tienen NULL y el tablero del negocio es el que los dibuja.
O sea que ofrecería mover al tablero donde ya están.

Va normalizando los DOS lados a `null` antes de comparar (`enOtroProducto`, en
`lib/leads-duplicados.ts`, sin `server-only` para que se pueda testear). Y hay un tercer
valor que no es ninguno de los dos: **`undefined`**, que es lo que devuelve la columna
cuando la consulta no la pidió — `LISTA_COLS` no la trae, porque el tablero filtra en el
server. `undefined` es «no sé», y leerlo como «está en otro lado» es el mismo bug con otra
cara.

**Vive en:** `lib/leads-duplicados.ts` · `lib/leads.ts` · *2026-09-30 crm-tanda-4*

## Lo IMPORTADO no llevaba el producto, y el alta sí: el mismo bug arreglado por un solo camino (30/09/2026)

`altaDeLead` pasa `funnel_id` desde el 28/09 con el comentario puesto («sin esto se iba al
funnel del negocio y desaparecía de la pantalla donde se acababa de cargar»).
`importarLeadsRevisadosAction` **no recibía el funnel**, así que todo CSV importado desde
un producto secundario nacía en el embudo del negocio y desaparecía de la pantalla donde se
lo acababa de importar. Doscientos contactos, sin un error.

**La regla, que es la de la casa vista desde el otro lado:** cuando arregles algo en UN
camino de escritura, enumerá los otros. `leads.funnel_id` tiene exactamente dos escritores
(`app/crm/actions.ts` y `lib/leads.ts:createLead`) y son el mismo punto — lo que cambia es
quién lo llama. Un `grep` del campo los lista en un segundo, y el que faltaba estaba a 800
líneas del que ya estaba bien.

⚠️ Y el parámetro quedó OPCIONAL a propósito: de los tres llamadores, la pantalla que
confirma lo que propuso un canal (`/crm/revisar`) **no tiene ningún producto a la vista**.
Ahí `undefined` significa el del negocio, que es donde caían todos hasta hoy.

**Vive en:** `app/crm/actions.ts` · `app/crm/ImportarLeadsModal.tsx` ·
*2026-09-30 crm-tanda-4*

## «Traer un lead de otro producto» no puede pasar por la tabla de revisión (30/09/2026)

El camino obvio para «importar leads de otro producto» es reusar la tabla de revisión del
importador: la misma pantalla, la misma confirmación. **Llega muerta**, y el porqué es una
cadena de tres piezas que ninguna es un bug:

1. `indiceContactos` (`app/crm/importar-server.ts`) escanea la tabla `leads` del tenant
   **sin filtro de funnel** — correcto, porque un duplicado lo es en todo el workspace.
2. Por eso todo lead traído de otro producto llega con `motivo: 'duplicado'` — correcto,
   porque efectivamente ya existe.
3. Y `TablaRevisionLeads` no deja tildar una fila con motivo (`disabled={fuera}`) — que
   también tiene su razón.

Resultado: la lista entera llega atenuada y destildable, y el botón dice «No hay nada
tildado» sobre gente que existe. El server ya aceptaba el caso (`permitirDuplicado`); lo
que no lo aceptaba era la pantalla.

**Por eso el segundo origen NO pasa por ahí**: no hay nada que revisar. Son leads que ya
existen y sólo cambian de tablero. Y **mueve, no copia** — con el producto viviendo en una
sola columna, traer a alguien acá es sacarlo de allá.

⚠️ **Y entra por la etapa de ENTRADA del embudo destino**, no con la que traía: la etapa es
una CLAVE del embudo A y puede no existir en el B. Conservarla dibuja al lead recién traído
como «fuera del embudo», que es la peor bienvenida posible. Es además lo que se pidió
(«que lo cargue automáticamente como lead entrante»), así que acá el pedido y lo correcto
coincidieron — conviene decirlo, porque no siempre pasa.

**Vive en:** `app/crm/ImportarLeadsModal.tsx` · `app/crm/actions.ts` ·
*2026-09-30 crm-tanda-4*

## Una persona con DOS visitor_id pierde el segundo, y ya pasa (30/09/2026)

Medido antes de diseñar nada, y es el dato que decide si el pedido de «otra campaña, otro
anuncio, otro VSL» es real o teórico:

| | |
|---|---|
| visitantes que miraron **más de una landing** | **750** |
| visitantes que miraron más de un video | 8 (el ws1 tiene 2 videos) |
| leads del ws1 con `visitor_id` | 59 de 1.146 |
| leads del ws1 con `meta_ad_id` | **1.030** de 1.146 |
| `visitor_id` compartido por más de un lead | sí, hasta 3 |

`leads.visitor_id` es **una columna**. Que un visitor_id esté en tres leads se ve en una
consulta; lo que **no se puede ver** es lo contrario —una persona con dos visitas—, porque
el segundo valor no tiene dónde guardarse. Y `app/api/track/vsl/route.ts` lo hace
explícito: `if (error || !lead || lead.visitor_id) return;` — **la segunda cookie se
descarta en silencio**.

O sea que el recorrido por producto no falta por falta de pantalla: falta porque el dato no
se está guardando. Y la atribución tiene dos caminos con coberturas muy distintas (5% por
visitor_id contra 90% por `meta_ad_id`), así que cualquier diseño que se apoye sólo en el
tracking de landing mide el 5% de los leads.

**Vive en:** `lib/leads.ts` · `app/api/track/vsl/route.ts` · *2026-09-30 crm-tanda-4*

## El modelo que falta: la PERSONA es una fila, el RECORRIDO es otra cosa (30/09/2026)

Tres diseños independientes y un juez, sobre «un lead en varios productos». Gana
`lead_participaciones` (una fila por lead × funnel × intento) y **se descarta explícitamente**
la alternativa barata —duplicar la fila del lead por producto— por una razón medida:

Con dos filas por persona, `email` y `telefono_normalizado` dejan de ser únicos, y ésas son
la llave de **seis `.maybeSingle()` que TIRAN** (no que degradan): `lib/leads.ts:813, 822,
899, 909, 1247, 1256` — las puertas de ingesta de Meta y Calendly. Más `email_opt_out`
partido en dos, que es una baja legal aplicada a media persona.

El plan quedó en cuatro fases, y **la fase 1 no necesita ninguna migración** (es la que se
hizo en esta tanda: el aviso por producto, el dedup entre productos y mover con su etapa de
entrada). Lo que falta, con las decisiones que no son técnicas, está en el veredicto de la
corrida; las cuatro preguntas son: si el traído conserva la etapa equivalente, si se puede
traer cualquiera o sólo los cerrados, si sacar de un producto cierra el recorrido o lo
borra, y si el mapa de páginas y videos por producto lo declara el cliente o se suma todo.

⚠️ **Y lo que hay que contar antes de empezar:** quién cuenta leads hoy y qué pasa con su
número. `_listLeads` (7 llamadores, workspace entero) cuenta PERSONAS y tiene que seguir
contándolas, o MaKo duplica al contestar «cuántos leads tengo». `cohortes_maduras_count` es
al revés: por participación es correcto y por persona es falso. No es el mismo cambio para
los dos.

**Vive en:** `docs/modelo-oferta-producto-funnel.md` · *2026-09-30 crm-tanda-4*

## Borrar un embudo de verdad deja a sus leads invisibles, porque `funnel_id` no tiene FK (30/09/2026)

«Eliminar» un producto lo ARCHIVA (`activo = false`) y eso está bien. Cuando se sumó el borrado
definitivo, la pregunta que decide todo es qué pasa con su gente — y la respuesta estaba en el
esquema, no en el código:

| tabla | FK a `funnels` | al borrar |
|---|---|---|
| `nutricion_secuencias` | sí, `on delete cascade` | se borran |
| `funnel_ofertas` | sí, `on delete cascade` | se borran |
| **`leads`** | **ninguna** (mig 0181, a propósito) | **no pasa nada** |

O sea que un `delete from funnels` deja a los leads con un `funnel_id` que ya no resuelve a nada.
`listLeadsDeFunnel` los busca por igualdad exacta, así que **no aparecen en ninguna pantalla,
para siempre**: no falla, no avisa y no borra una fila. Con los 1.146 del ws1 ahí, es la clase de
pérdida que se descubre semanas después.

**La regla: antes de escribir un borrado, mirá qué apunta a eso y CÓMO.** Un `cascade` es una
decisión tomada; la ausencia de FK **no** es «nada apunta acá», es «nadie decidió qué pasa». Las
personas no son configuración: vuelven al embudo del negocio, y el rescate va ANTES del delete —
al revés, si el borrado sale bien y el rescate falla, el dato que decía dónde estaban se fue con
la fila.

⚠️ **Y borrar de verdad exige DOS decisiones en DOS momentos**: sólo se puede sobre algo que ya
está archivado (`if (fila.activo) throw`). Es el guard en positivo que hace que nada se pierda de
un clic, y es lo que convierte «Eliminar» en reversible sin tener que prometerlo.

**Vive en:** `lib/funnels.ts` (`eliminarFunnelDefinitivo`) · *2026-09-30 crm-tanda-5*

## Un buscador de una línea y una tabla con filtros no son dos tamaños de lo mismo (30/09/2026)

«Traer un lead de otro producto» se implementó primero como un renglón al pie del alta que
desplegaba un buscador. Martín lo rechazó en la misma tanda: *«cuando le doy, debe reemplazar al
formulario de arriba, con un botón de atrás claro… que aparezcan todas las columnas, los filtros,
la barra de busqueda. Y que se pueda hacer selección múltiple»*.

Lo que estaba mal no era el tamaño: era que **el modal pedía dos cosas a la vez**. Cargar a
alguien nuevo y buscar a alguien que ya está son dos tareas, y ninguna es un paso de la otra. Por
eso ahora son dos VISTAS de la misma caja, con «Atrás» y no «Cancelar»: se vuelve al alta, no se
cierra el modal.

⚠️ **Y la vista la decide el PADRE, no el formulario.** La de traer necesita 1040 px y un título
distinto; un form no puede cambiar el tamaño de la caja que lo contiene. El form sólo avisa
(`onTraer`), y el padre cambia ancho, alto y título — con el alto FIJO, o la caja salta al ir y
volver.

⚠️ **Y «tildar todos» tilda lo VISIBLE, no lo que hay.** Con 1.146 leads y un filtro puesto que
deja 20, un «todos» que se lleve los 1.146 mueve de tablero a gente que la persona nunca vio.
Medido en el navegador: con «jesus» escrito, tildar todos dice «Mover 20 aquí».

⚠️ Y la lista corta en 300 **diciéndolo** («Se muestran 300 de 1146»). Una lista que corta en
silencio se lee como que ahí termina el producto.

**Vive en:** `app/crm/TraerDeOtroProducto.tsx` · `app/crm/CrmBoard.tsx` · *2026-09-30 crm-tanda-5*

## Las NUTRICIONES: pocas por defecto, y editables como las etapas

Pedido de Martín (30/09/2026): «El editor de "Nutrición" debe ser parecido al de Etapas, solo
que hay que agregarle de que depende que se dispare esa nutrición… Pon por defecto muy
pocas nutriciones. Pon la de "No Agenda" - "No Show" - "Reactivación"».

### ⚠️ EL DIAGNÓSTICO OBVIO ERA EL EQUIVOCADO: no estaba roto, estaba SIN COMMITEAR

Martín abrió `hola-mako.com/crm`, miró la subtab y escribió **«No cambió nada el editor de
nutrición»**. Se lee exactamente como un bug de la feature, y manda a releer el código que
se acaba de escribir. No había nada que releer: los cinco archivos estaban **modificados y
sin commitear** en el árbol compartido, porque la sesión siguió con otros pedidos antes de
cerrar ése. Producción estaba sirviendo la versión de antes, que es lo correcto.

**La regla: un «no cambió nada» sobre PRODUCCIÓN se contesta con `git log` y `vercel ls`,
nunca releyendo el fuente.** En este clon hay dos sesiones y el árbol de trabajo casi nunca
está limpio, así que «lo escribí» y «está desplegado» son dos preguntas y sólo una la
contesta el editor. Y el corolario del trabajo en curso: **un pedido que se implementa y no
se commitea en la misma tanda es trabajo que para el que lo pidió no existe** — y que el
próximo reporte va a describir como una feature rota.

### «Funnel principal» en el título y «Negocio que Escala» en el desplegable

Martín: «no entiendo porque se llama "Funnel principal" cuando en el desplegable me dice
"Negocio que escala", eso está muy mal». Las dos pantallas leían el mismo embudo y decían
cosas distintas: `listarFunnels` tapaba el nombre crudo con el del producto principal y la
action del pop-up devolvía `cfg.nombre` pelado.

⚠️ **Y el TIPO ya declaraba lo correcto.** `EmbudoEnDetalle.nombre` dice, textual, «el
nombre que la persona ve: el del producto si lo hay, si no el del embudo» — y la
implementación devolvía el otro. Un comentario en el tipo no es una implementación, y
cuando el tipo y el código se contradicen **gana el código y nadie se entera**: no hay
error, hay un nombre plausible.

⚠️ **Y no era cosmético: ese título es un INPUT.** Lo que se ve es el `defaultValue` del
campo que renombra, y `guardarNombreEmbudo` compara contra él para decidir si escribe. O
sea que quien renombraba arrancaba desde el valor equivocado, y escribir el nombre que YA
tenía el producto contaba como un cambio.

La cura es el cruce en UNA función (`productosPorFunnel`, `lib/funnels.ts`) que llaman los
dos lectores, y un guard que cuenta cuántos lugares resuelven el nombre: si son dos, vuelven
a divergir. El otro lector de `v_funnel_productos` (`renombrarFunnel`) se queda: pide el
`producto_id` para ESCRIBIR, que es otra pregunta.

**Vive en:** `lib/funnels.ts` · `app/crm/actions.ts` · `app/crm/EtapasModal.tsx`

### Las cuatro cosas que estaban mal en la lista de nutriciones

| Síntoma | Causa |
|---|---|
| La casilla de «Reunión excepcional» se destildaba, se guardaba, y al reabrir volvía tildada | `noshow_r3` era un `transitions.push` escrito a mano: no pasaba por `nut()`, o sea que **ignoraba `suppressed`**. Un control que se desmarca solo se lee como que la app no guarda |
| Un embudo SIN reuniones no tenía forma de reactivar a nadie | La Reactivación entera colgaba de `firstMeeting`. Lo que de verdad necesita una reunión es su arista de **vuelta** («Reagenda»), no su existencia — y eso ya lo fijaba `tests/reunion-slot-fuente-unica.test.ts`, que se puso rojo al hacerlo mal |
| Una fila que decía, literal, «No Paga → Reunión excepcional»: una nutrición cuyo origen es otra nutrición | `ETAPAS_SIN_SECUENCIA` existía desde hacía meses y vivía en `lib/secuencias-huecos.ts`, que tiene `server-only`. **La decisión estaba tomada y la pantalla no la podía leer** |
| «Reactivación» aparecía DOS veces con el mismo nombre, y destildar una dejaba la nutrición corriendo | La lista era una fila por ARISTA. Reactivación sale de «No responde» Y de «Perdido»: es UNA nutrición con dos orígenes. Ahora se agrupa por DESTINO y el toggle escribe todos sus ids (`tambien`) |

⚠️ **Y el rótulo salía del catálogo de FÁBRICA.** `etiqueta()` miraba `cfg.labels` —que sólo
tiene las terminales renombradas— y de ahí caía al catálogo, que no conoce las claves de un
pipeline propio: **el ws13 veía `st0` y `st1`**, y la plantilla de VSL `registro`, `grupo`,
`webinar` y `checkout`. `cfg.stages` va primero, y con eso «si yo cambio el nombre, si pongo
R1, R2… las nutriciones deben respetar eso» se cumple solo, sin un campo más.

### Cuántas poner: se midió antes de elegirlas

Los **13 embudos vivos suman 99 casillas**, 7,6 de promedio, y la forma más común da 9. De
esas 9 sólo 5 son de verdad una nutrición: las otras cuatro son una reunión disfrazada, una
nutrición de una nutrición, y la Reactivación contada dos veces. Con `NUTRICIONES_POR_DEFECTO`
un producto de UNA reunión nace con exactamente tres —No Agenda, No Show y Reactivación—, que
es lo que él pidió.

⚠️ **Y se calcula, no se escribe a mano por plantilla.** Las ids de `suppressed` son
`"desde>hacia"` y el `desde` sale de las CLAVES del pipeline: una lista fija se rompe en
cuanto alguien le agrega una reunión. Va en `suppressedInicial(pipeline)` y se aplica en
`crearFunnel`, que es el choke point — de sus tres llamadores **uno solo** pasaba la lista.

⚠️ **Y SÓLO AL CREAR.** Suprimir una nutrición **borra su etapa del tablero** (`nut()` sale
antes de `place()`), así que aplicarlo a los embudos que ya existen tiraría a la primera
columna a todo lead parado ahí. Este repo ya pagó esa cuenta con 1.057 leads del ws1.

**Vive en:** `lib/pipeline.ts` · `lib/funnels.ts` · `app/crm/EtapasModal.tsx` · `tests/nutricion-editor.test.ts`

### Un renglón de menú SIN rótulo son dos botones, no un renglón con adornos

Martín, sobre el menú de la columna: «el botón de mover no debería tener la palabra mover,
solo las flechas… en realidad, deberían ser 2 botones diferentes, solo que están en la misma
linea». El renglón con `acciones` del `Dropdown` le da el `flex: 1` al RÓTULO, así que
vaciarlo no lo saca: deja **media fila que se ve clicable y no hace nada**, que es peor que
el rótulo que se vino a sacar. Por eso `soloAcciones` es una rama propia del primitive.

⚠️ **Y el hover de ese menú va INLINE, no por el velo de `.crm-hover`:** el `Dropdown` se
dibuja por PORTAL sobre el `<body>`, así que la regla del `<main>` de la ruta no lo alcanza.
Es uno de los caminos que el comentario del velo enumera.

**Vive en:** `app/components/Dropdown.tsx` · `app/crm/CrmBoard.tsx` · *2026-09-30 crm-tanda-6*

## «Feature: CRM»: 0 de 25 cerrables, 19 con una mitad hecha (30/09/2026)

Cosechado del pedido «revisa todo el proyecto Feature: CRM y marca como completadas las
tareas que ya estén». Salió de 25 lectores —uno por tarea abierta— con refutación
adversarial de dos lentes sobre cualquiera que se propusiera cerrar.

**Vive en:** el proyecto `crm-automtico-leads` del ws9 · `lib/plan-board.ts` (`cerrarPlanTareaOwner`)

### El resultado, y por qué NINGÚN refutador llegó a trabajar

| veredicto | cuántas |
|---|---|
| **hecha** (cerrable) | **0** |
| a medias | 19 |
| sin empezar | 6 |

Los refutadores no se dispararon ni una vez: ningún lector llegó a proponer un cierre. Eso
**no es un relevo flojo, es la vara**, y la vara es parte de la pregunta: «una sola promesa
sin cubrir = no está hecha» es lo correcto para CERRAR —cerrar algo a medias borra del
tablero el trabajo que falta— y es durísima con los títulos de este proyecto, que nombran
varias cosas a la vez («Datos del trato + cuotas + reuniones + tracking + chat» son cinco).

⚠️ **Y el corolario que vale para cualquier auditoría de tablero: el entregable no es la
lista de lo que se cierra, es la lista de lo que FALTA.** Sale la misma conclusión que la
corrida del mismo día sobre «Feature: Plan» (2 de 13): la sensación de «hay muchas que ya
están» es correcta sobre el TRABAJO y equivocada sobre las TARJETAS. Lo que falla es el
título, que sigue nombrando el trabajo entero.

### Los siete agujeros que el barrido encontró de paso, y son los que valen

Ninguno estaba reportado; los siete salieron de ir a leer el código para contestar otra
pregunta. Todos con su archivo:línea porque se midieron, no se dedujeron.

| Dónde | Qué |
|---|---|
| `lib/nutricion.ts` · `lib/crm-auto-plan.ts` · `lib/secuencias-huecos.ts` | **`nutricion_secuencias.funnel_id` existe desde la mig 0170 y NO LA LEE NADIE.** Los tres módulos del motor son funnel-ciegos, así que con dos embudos vivos **el mensaje puede salir del equivocado**. Es el único agujero de la lista que le llega a una persona |
| `lib/fathom-auto.ts:75-90` | El barrido recorre j1 y j2 con el MISMO objeto `lead` y `applyFathomRecording` deriva `fathom_links` de ahí: **la segunda grabación pisa el link de la primera** — y el contador informa `adjuntados: 2` igual |
| `lib/leads.ts:854` · `:1288` · `:940` | Los webhooks de **Meta, Calendly, Cal.com y Fathom** comparan el teléfono por igualdad EXACTA (`.eq('telefono_normalizado', …)`) mientras `duplicadosDeLead` compara por los ÚLTIMOS 10 DÍGITOS. O sea que las puertas de MÁS volumen dejan entrar «+52 998…» contra «998…» como lead nuevo, sin aviso |
| `lib/leads.ts:1812-1856` | `getTrackingEvents` pide 120 filas **por tabla** y recién después descarta lo que no es video, así que con muchos eventos de página el `play` queda afuera del recorte; y devuelve `[]` cuando la lectura falla, o sea que «no pude leer» se dibuja como «no vio el VSL» |
| `lib/meta-leads.ts:47-55` | `parseLeadFields` saca 4 campos del `field_data` y **tira las respuestas del formulario de Meta**. Y no hay dónde ponerlas: `lead_respuestas` está cerrada a Calendly por su `CHECK (reunion IN ('R1','R2'))` (mig 0062). La `created_time` tampoco se persiste: un lead rescatado de hace 60 días nace con la fecha de la ingesta |
| `app/crm/crm-map.ts:104` | `originChannel` se calcula y **no lo renderiza nadie**. Es una salida huérfana de manual, y la columna «Origen» de la tabla no mira nunca `origen_lead` |
| `app/crm/[id]/deal-actions.ts:167` | `saveCuotasAction` filtra `!c.pagado`: **el guardado descarta toda cuota marcada como pagada**, así que «Registrar mensualidad cobrada» no puede asentar un cobro ni arreglándole el helper |

### Un detalle puede citar evidencia que no existe en ningún lado

El detalle de #38 manda a ver un «candado por etapa» y una «revisión de 18 agentes»:
`grep -rn "candado"` no devuelve ningún candado por etapa del CRM y «18 agentes» no aparece en
`docs/`. Es la misma familia que las 155 de 260 citas apuntando a la nada que midió la
auditoría del 24/09, y tiene la misma cura: **antes de cerrar una tarjeta hay que ubicar lo
que su detalle cita, o borrarlo del detalle** — si no, la próxima revisión vuelve a gastar
el tiempo buscándolo.

### Y el proyecto gemelo vacío sigue vivo

`Agente: CRM automático` (score 47) tiene **0 tareas**: la fusión con «Feature: CRM» ya se
hizo y el proyecto vacío nunca se tachó. Por la regla de la casa —tema compartido + cero
trabajo abierto— hay que tacharlo al fondo con su motivo, y es una decisión de Martín.

**Vive en:** el ws9 · *2026-09-30 crm-auditoria-25*

## La importación AUTORIZA el duplicado que la pantalla dice que descartó (03/10/2026)

La pantalla de revisión dibuja la fila repetida **gris, con la casilla vacía y el cartel «ya
existe»**, y el server la importa igual, con la guarda anti-duplicado **explícitamente
apagada**. No hay error, no hay aviso, y el botón promete un número menor que el que crea.

Las cuatro piezas, cada una correcta por separado:

| Dónde | Qué hace |
|---|---|
| `app/crm/leads-importar.ts:219` | toda fila nace con `incluir: true` |
| `app/crm/leads-importar.ts:144-163` | `recalcular` escribe `motivo` y **nunca toca `incluir`** |
| `app/crm/TablaRevisionLeads.tsx:60` y `:88` | `tildar` exige `!f.motivo` y el botón va `disabled={fuera}`: **la fila marcada no se puede destildar**, y se dibuja sin ✓ porque el render es `f.incluir && !fuera` |
| `app/crm/actions.ts:1498` y `:1507` | el server saltea sólo con `!f.incluir \|\| chocaAcá`, y a esa misma fila le pasa `permitirDuplicado: !!f.motivo` → **`true` justo para las marcadas** |

El comentario de `:1488-1494` explica la intención y es razonable — *«tildar un duplicado
ahora sirve… lo que se pidió es avisar y dejar decidir»*. Lo que no se ve desde ahí es que
**la decisión que la pantalla ofrece no existe**: el único control que baja `incluir` para
una fila marcada está deshabilitado justo para esas filas. El único camino que la baja es el
botón «Sólo nuevas» (`:61`), que nadie está obligado a apretar — y que *parece redundante*,
porque la casilla ya se ve vacía.

Vive desde el **14/08/2026** (`2dfa4bab`, «el anti-duplicado avisa en vez de decidir»): siete
semanas, con el único testigo posible siendo contar los leads después de importar.

⚠️ **Y el contador de la pantalla no lo puede delatar**, porque mide bien: `contar`
(`leads-importar.ts:234-238`) suma `tildadas` sólo entre las que **no** tienen motivo, así
que el botón dice «Crear 80 leads» y el server crea 80 **más** las repetidas. Los dos números
son correctos sobre preguntas distintas, que es cómo un bug así sobrevive a que alguien mire.

**La regla que queda:** si la pantalla DESHABILITA un control, el server tiene que aplicar lo
que ese control deshabilitado significa. Un campo que la UI no puede cambiar no es una
decisión de la persona: es un **default**, y el default es la política real del sistema.

**Vive en:** `app/crm/actions.ts:1498` · `app/crm/TablaRevisionLeads.tsx:88` · *2026-10-03 depuracion-crm*

## El workspace donde va a pasar la prospección no tiene canal, ni agenda, ni motor (03/10/2026)

El plan del 03/10 es importar **+1.000 contactos en frío al CRM de MaKo**, filtrar los 100
mejores, escribirles el **17/10** y cerrar el **18/10**. Eso ocurre en el workspace del super
admin (**ws9**), y medido contra producción ese workspace está así:

| Qué hace falta | Estado hoy en ws9 |
|---|---|
| Leads cargados | **3** (ws1 tiene 1.154) |
| Línea de WhatsApp para escribir | **no hay fila** en `evolution_instancias` (sólo ws1 y ws11 conectadas) |
| Interruptor de envío | **no hay fila** de `envio_whatsapp_enabled` → `lib/envio-flags.ts:23-30` es fail-closed: **apagado** |
| Agenda donde reservan | **cero** credenciales `CALENDLY_*` / `CALCOM_*`, y sus tres filas de routing son agente, landing y fathom |
| Motor de seguimiento | **no hay fila** de `crm_auto_enabled` → apagado (el piloto corrió en ws1 y ws11, no acá) |
| Vendedor asignable | **un solo usuario y es `admin`** → `vendedorUnicoDelWorkspace` (`lib/leads.ts:419`) filtra `u.rol !== 'admin'` y devuelve `null`: los 1.000 nacen **sin setter ni closer** |

Ninguna de las 25 tarjetas abiertas del CRM nombra una sola de esas seis filas. **No es
código: es configuración**, y por eso no aparece en ninguna auditoría del repo — las
auditorías miran el código, y acá el código está bien.

**El patrón que generaliza:** cuando el plan muda la operación a un workspace nuevo, lo que
falta no son features sino **las filas que ese inquilino nunca creó**. Se mide con una
consulta por interruptor, y conviene hacerla ANTES de priorizar trabajo, porque mueve el
orden entero: de nada sirve arreglar el importador si después no hay por dónde escribir.

**Vive en:** el ws9 · `lib/envio-flags.ts:23-30` · `lib/leads.ts:409-423` · *2026-10-03 depuracion-crm*

## Mil filas no entran en el presupuesto de la pantalla, y al cortar reintentar DUPLICA (03/10/2026)

`MAX_FILAS_IMPORT = 3000` (`app/crm/leads-importar.ts:59`) sobre una ruta con
`maxDuration = 60` (`app/crm/page.tsx:35`), y el bucle de `importarLeadsRevisadosAction`
(`app/crm/actions.ts:1481-1517`) es **secuencial**, con varias esperas a la base por lead
(el chequeo de duplicados, la búsqueda del vendedor único, el insert).

Es el patrón de «el entorno tiene un tope y tu código declara otro»: el número de la
constante promete 3.000 sobre un límite físico que no los aguanta. Y acá la consecuencia no
es sólo que corte — **lo ya creado queda**, así que volver a apretar reimporta desde el
principio… contra el portón de la entrada de arriba, que autoriza el duplicado. Las dos
cosas por separado son molestas; juntas, un reintento multiplica la base.

Lo que falta no es el comparador (eso son #621, #623 y #626): es **el volumen** — el tope
real medido, el insert en lote, y que al cortar la pantalla diga **cuántos entraron** para
que el reintento empiece donde quedó.

**Vive en:** `app/crm/actions.ts:1481-1517` · *2026-10-03 depuracion-crm*

## La depuración del 03/10: de 25 tarjetas abiertas a 6 con fecha

Seis lectores midieron las 25 contra HEAD, un cruzador buscó solapes y lo que faltaba, y
tres refutadores atacaron por CLASE de afirmación (cerrar · postergar · meter al P1), con
el default calibrado distinto en cada uno. **6 veredictos de 25 cayeron.**

Lo que más valió, y no lo podía ver ningún lector solo:

- **Dos tarjetas pueden pasarse el mismo defecto y dejarlo en CERO tarjetas.** #37 lo cerró
  diciendo «eso es el pendiente medido de #701» y #701 lo postergó diciendo «vive en la
  misma función que ya es el pendiente de #37». Las dos citan `getTrackingEvents`. Cuando un
  veredicto justifica una salida con *«eso lo cubre la otra»*, hay que ir a leer qué dice la
  otra: la mitad de las veces dice lo mismo al revés.
- **Tres lectores describieron la misma pantalla de tres formas incompatibles** (#621 «la
  fila repetida se saltea», #623 «se descarta en silencio», #626 «pinta entra y cuenta
  error») y **las tres estaban equivocadas**: el server hace algo peor que las tres. Tres
  descripciones distintas de una misma pantalla no son tres matices — son la señal de que
  nadie leyó el camino entero.
- **Un refutador cambió el sujeto de una tarjeta y con eso su fecha.** #174 («Calendly: el
  cliente conecta y no entra nada») se había leído como un problema de un cliente nuevo del
  1/11; medido, el cliente nuevo sin agenda conectada **es Martín**, y eso la corre al 17/10.

**Vive en:** `app/admin/dev/crm/auditoria.ts` · `docs/depuracion-crm-03oct.md` · *2026-10-03 depuracion-crm*

---

## «Eliminar etapa» se ofrecía en 102 columnas que el server rechaza (01/10/2026, arreglado el 04/10)

Leila, en vivo sobre la columna «Nutrición No Show R1» (00:11:07): *«No se pudo. Esta etapa
no es del pipeline, no se la puede eliminar solo»*. Martín lo reconoció ahí mismo: *«creo
que hay un error… tengo que ver ahí de qué depurar eso»*.

**La causa son DOS condiciones distintas para la misma pregunta**, a dos archivos de
distancia:

| | qué preguntaba |
|---|---|
| el menú de la columna | `!esTerminal(c.key)` (`app/crm/CrmBoard.tsx`) |
| el server | `pipeline.some((st) => st.key === op.key)` + no terminal + no entrada (`app/crm/actions.ts`) |

Las etapas de **nutrición no están en `pipeline`**: las agrega `generateFunnel` en cada
lectura. Así que el menú ofrecía borrarlas y el server las rechazaba SIEMPRE.

**Medido contra producción antes de escribir una línea:** 102 columnas de los 16 embudos
ofrecían «Eliminar etapa» y ninguna se podía borrar.

⚠️ **Y la medición de producción se había quedado CORTA, y lo corrigió el test.** Contó sólo
las 102 de nutrición, comparando contra `pipeline`; las **entradas** sí están en `pipeline`
y el server las rechaza igual («por esa etapa entra tu gente»), o sea una más por embudo:
16 de regalo. El test falló en su primera corrida con `sobraban de otra banda: lead=pipeline`
y ahí apareció. Contar contra UNA de las tres guardas del server es medir un tercio.

La regla que queda: **cuando el menú y el server contestan la misma pregunta, la condición
del menú se deriva enumerando las guardas del SERVER, no la que uno recuerda.** Y el guard
que lo fija (`tests/eliminar-etapa-coherente.test.ts`) prueba las dos mitades: la decisión
contra `generateFunnel`, y el cableado leyendo la línea del menú — extrayéndola, porque
`esTerminal` aparece legítimamente en otras ocho líneas de ese componente y un `match` sobre
el archivo entero daba verde con el bug puesto.

**Vive en:** `app/crm/CrmBoard.tsx` → `colsBorrables` · *2026-10-04*

## El `null` de un campo de TRES estados ya está ocupado, y el default lo convierte en un «sí» (04/10/2026)

`applyFathomRecording(lead, which, url, attended)` resuelve `const asistValue = attended ?? true`
(`lib/leads.ts:1100`), con su porqué correcto escrito al lado: el `null` significaba «no me
consta la asistencia, pero hubo grabación con el invitado presente». O sea que **ese `null` ya
afirmaba algo**.

El 04/10 se abrió una fuente nueva para los links de reunión —los que una persona pegó a mano en
la ficha, en `lib/auto-reuniones.ts:122-131— y, con razón, se negó a que eso afirmara la
asistencia: `asistioJ1: anaLinkR1 ? true : null`. Sólo la grabación ANALIZADA la afirma; un link
pegado prueba que la reunión se grabó, no quién estuvo.

Los dos lados estaban bien. Lo que no existía era el contrato entre ellos: `lib/crm-auto.ts:307`
—la regla T1 del CRM automático, en un archivo que ninguno de los dos paquetes tocaba— pasaba ese
`null` tal cual, y el `?? true` lo convertía en **`asistio_j1 = true`**. Resultado: un lead al que
alguien le pegó un link se marcaba como asistido, cambiaba de etapa y **disparaba el QualifiedLead
de Meta**, que el `revert` de la propia regla no deshace.

- **Antes de reusar el `null` de un campo para un caso nuevo, leé qué afirma ya ese `null`.** Si
  hay un `??` río abajo, el campo está ocupado: cada pregunta, su campo (acá, `marcarAsistencia`).
- **El contrato entre dos archivos que no se tocan no lo cubre ningún test de ninguno de los dos.**
  Lo encontró una revisión que leyó el camino de punta a punta; el guard quedó en
  `tests/crm-auto-asistencia.test.ts`, que fija los DOS lados.
- Es la misma familia que «un `&&` que junta un hecho con un permiso hace desaparecer el hecho»,
  con el signo cambiado: acá un `??` junta «no sé» con «sí» y hace aparecer un hecho que nadie vio.

**Vive en:** `lib/crm-auto.ts:307` · `lib/leads.ts:1100` · `lib/auto-reuniones.ts:172` · *2026-10-04 arreglar-crm*

## «Vuelve a pedirme algo que ya tengo» es una molestia para la persona y una CONCLUSIÓN FALSA para el motor (04/10/2026)

La tarjeta #38 describía el síntoma que se ve: el asistente sigue pidiendo a mano una grabación
que ya está guardada en la ficha. Eso se lee como fricción.

El costo real era el opuesto y vivía en otro archivo. `lib/crm-auto.ts:295` decide la regla T1
preguntando por `auto.fathomR1/R2`, y `buscarReunionesAutomatico` sacaba esos links **sólo** de
`closing_analyses`: `fathom_links` no aparecía en `lib/auto-reuniones.ts`. Sin link, la rama de
abajo concluye **No Show** y mueve al lead — sobre una reunión cuya grabación estaba guardada a la
vista, en su propia ficha.

**Cuando un defecto se reporta como «me vuelve a pedir algo que ya tengo», preguntá quién MÁS lee
ese dato.** Un buscador que no encuentra algo es una molestia; un motor que lee el mismo resultado
vacío concluye lo contrario de la verdad y lo escribe. El síntoma que llega es siempre el de quien
mira la pantalla, nunca el del proceso que corre solo.

**Vive en:** `lib/auto-reuniones.ts:122-131` · `lib/crm-auto.ts:295` y `:347` · *2026-10-04 arreglar-crm*

## Un contador que cuenta INTENTOS no puede informar RESULTADOS (04/10/2026)

El barrido de Fathom informaba `adjuntados: 2` cuando a un mismo lead se le enganchaban R1 y R2 en
la misma corrida — y la segunda **pisaba** el link de la primera, porque `applyFathomRecording`
armaba el array nuevo desde el objeto `lead` que el bucle había leído al principio.

El contador decía la verdad sobre OTRA pregunta: cuántas veces la función devolvió `addedLink:
true`. Las dos vueltas lo devolvían. El bug vivió desde julio **en el archivo que un operador abre
a mano con un botón de admin**, y el único testigo posible era contar los links en la ficha.

**Si un proceso escribe un array completo armado en memoria, el contador sale de lo que quedó en la
base** — o la única forma de auditarlo es ir a mirar fila por fila. La cura del pisado fue releer
dentro de la escritura (el choke point de los tres caminos), no arreglar el bucle que lo disparaba:
así lo hereda el cuarto camino que alguien escriba mañana.

**Vive en:** `lib/leads.ts:1079-1140` · `lib/fathom-auto.ts:143-195` · *2026-10-04 arreglar-crm*

## Antes de revertir un «bug» bien medido, grepeá `tests/` buscando el guard que lo FIJA (04/10/2026)

«La importación crea el duplicado que la pantalla dice que descartó» se lee como una regresión de
siete semanas, y el arreglo obvio es cerrar el portón del server.

No era una regresión: era una decisión deliberada **y fijada por un test**.
`tests/leads-duplicados.test.ts:126-129` exige `permitirDuplicado: duplicado` («el tilde de la
persona es la autorización») y prohíbe explícitamente la condición vieja. Dar vuelta el server
habría roto ese guard y revertido una decisión del 14/08 que alguien tomó con su porqué escrito.

Lo que estaba mal era la otra mitad: **la pantalla no podía tomar esa decisión**, porque la casilla
estaba deshabilitada justo en esas filas. El arreglo correcto fue dejar que se mueva, y que los
tres lectores —la casilla, el contador del botón y el portón del server— pasen por UNA función
(`entra` en `app/crm/leads-importar.ts:58`).

⚠️ **Y la segunda mitad, que la corrida no vio:** `/crm/revisar/[id]` siembra sus filas con
`incluir: true` y `yaExiste: false`, así que el motivo «ya existe» lo descubre el SERVER, después
de que la pantalla se dibujó. Honrar ese tilde es crear el duplicado **y atribuirle la decisión a
alguien que nunca la vio**. El server ahora baja el tilde de todo duplicado que la pantalla no
mostró (`app/crm/actions.ts`, `vioDuplicado`): un tilde sobre algo que la interfaz no exhibió no es
una decisión, es el default.

**Vive en:** `app/crm/actions.ts` (`vioDuplicado`) · `app/crm/leads-importar.ts:58` · *2026-10-04 arreglar-crm*

## Eran SEIS lectores, no tres: la pregunta es qué columnas tienen la PROPIEDAD (04/10/2026)

El encargo medía tres `.maybeSingle()` sobre `telefono_normalizado`, una columna que no es única:
con dos filas, PostgREST devuelve `PGRST116` y el webhook entero muere.

Eran seis. En las MISMAS tres funciones, la línea siguiente lee por `email` con el mismo patrón, y
`leads.email` tampoco tiene índice único — el único de la tabla es `id`.

**Cuando un defecto se mide sobre UNA columna, la pregunta no es «¿dónde más está esta columna?»
sino «¿cuáles columnas tienen la propiedad que lo causa?»** — acá, no ser única. La respuesta sale
de las migraciones con un `grep`, y la lista de las que SÍ son únicas es cortísima.

**Vive en:** `lib/leads.ts` (`primerLeadPor`) · `supabase/migrations/` · *2026-10-04 arreglar-crm*

## Un guard que lee fuente tiene que BORRAR los comentarios, y no por higiene (04/10/2026)

Dos guards nuevos pasaron en verde sobre la rotura que tenían que cazar, en el primer intento, por
una razón que no es la lógica: **el propio arreglo escribe la cadena perseguida dentro de su
comentario**. La convención de esta casa es explicar en el comentario qué código se sacó, así que
todo guard que busque una ausencia la va a encontrar ahí al lado.

- El borrado va en ORDEN: primero los comentarios de línea COMPLETOS, después los de bloque. Al
  revés, un `/*` que vive dentro de un `//` abre un bloque que se cierra páginas más adelante y se
  lleva puesto todo lo que hay en el medio (ya pagado en el guard de voseo).
- Y nunca con un regex de «todo lo que sigue a `//` hasta el fin de línea»: se come el `//` de una
  URL dentro de una cadena.
- ⚠️ **Y el `doesNotMatch` sobre el texto de una fila no puede cazar su versión vieja** si la fila
  sigue existiendo adentro de un ternario. Lo que distingue la versión buena de la vieja es la
  FORMA en que se arma la lista (un spread condicional), no el texto de la fila.

**Vive en:** `tests/crm-importar-duplicados.test.ts` (`soloCodigo`) · `tests/crm-auto-asistencia.test.ts` · *2026-10-04 arreglar-crm*

## Arreglar una función que no lee nadie es arreglar algo que no se ve (04/10/2026)

Al cablear el origen del lead en la lista del CRM aparecieron DOS funciones candidatas en el mismo
archivo: `channelOf` y `origenLegible`. Las dos convertían un lead en «de dónde vino», las dos
estaban a cuatro líneas de distancia, y **sólo una se dibuja**.

`channelOf` alimentaba el campo `originChannel`, que tenía exactamente dos apariciones en todo el
repo: la escritura y la declaración del tipo. Cero lectores. `origin`, el que la tarjeta pinta y
el que arma las opciones del filtro, sale de `origenLegible`.

El arreglo entró en las dos, así que la pantalla quedó bien — pero el guard que lo fijaba apuntaba
a las dos, y una era humo. **Un guard sobre una función huérfana da verde sobre una pantalla que
miente**, y encima la mantiene viva: es un lector sintético que impide borrarla. `channelOf` y
`originChannel` se borraron, y el guard quedó sobre la única que alguien ve.

**Vive en:** `app/crm/crm-map.ts:16` · `tests/crm-origen-lead.test.ts` · *2026-10-04 arreglar-crm*

## Un «hay workaround» acota la urgencia del CAMINO medido, no la del dato (04/10/2026)

«Registrar mensualidad cobrada» crea la cuota con `pagado: false`: el botón que dice «cobrada»
fabrica una deuda. Se había pospuesto con el argumento de que hay camino a mano —agregar la cuota,
guardar, marcarla pagada— y ese camino existe y funciona.

Lo que no se midió es qué OTROS botones de la misma pantalla tocan el dato que el botón roto
produjo. `aplicarExtraccion` (`DealDetailsCard.tsx:318-321`) reemplaza las cuotas conservando
**sólo las pagadas**: `next.cuotas = [...next.cuotas.filter((c) => c.pagado), ...extraidas]`. Con
la mensualidad naciendo impaga, «Completar con IA» o «Subir contrato» **la borran**, sin aviso.

**Antes de bajar una tarjeta por workaround, enumerá qué más toca lo que el botón roto dejó mal.**
Un `filter(c => c.pagado)` escrito para proteger lo cobrado se vuelve destructivo en cuanto algo
nace sin cobrar por error.

**Vive en:** `app/crm/[id]/DealDetailsCard.tsx:318-321` y `:253` · `app/crm/[id]/deal-actions.ts:183` · *2026-10-04 arreglar-crm*

## El tramo comercial del tablero medía el embudo fijo de dos reuniones (04/10/2026)

### El diagnóstico obvio era el equivocado: las keys SÍ existían

La hipótesis con la que arrancó el trabajo era que `lib/retro-datos.ts` buscaba las etapas por
key canónica —`por.get('form_agenda')`, `por.get('agenda_asistio')`,
`por.get('asistio_calificado')`, `por.get('calificado_cierre')`— y que con un funnel propio
esas keys **no existían**, así que los cuatro `por.get` devolvían `undefined`.

Medido: **las cuatro keys existían siempre**. `getFunnelEtapas` las emitía incondicionalmente,
porque su lista de pasos estaba escrita a mano y no miraba el funnel de nadie. O sea que un
`grep` de `por.get(` encuentra al CONSUMIDOR y no encuentra la causa, y quien parchee sólo el
consumidor no arregla nada.

Lo que medía cero era la **COHORTE**. Los cuatro pasos se contaban sobre
`leads where fecha_junta_1 ∈ ventana`:

```ts
.select('asistio_j1, calificado, estado_lead, fecha_junta_1')
.gte('fecha_junta_1', start).lte('fecha_junta_1', end)
```

Las plantillas `directa` (lead → pago) y `conversaciones` (lead → charla → pago) **no tienen
ninguna etapa `kind: 'reunion'`**, así que ningún lead de esos workspaces tiene `fecha_junta_1`.
La cohorte sale vacía, y con ella `asistencias`, `limpias` **y los cierres** — `cierres` se
contaba sobre esas mismas filas. Cuatro renglones en cero, el `pct` en null, cero errores en el
log. Un cliente que cerró veinte ventas veía el embudo comercial entero apagado.

### Con UNA reunión el daño es distinto y se esconde mejor

`simple`, `presencial` y `vsl` tienen una sola etapa de reunión. Ahí `agenda_asistio` funciona
—`slotPorIndice(0)` le da `fecha_junta_1`/`asistio_j1` sea cual sea la key de esa etapa— y lo que
se rompe es el paso siguiente: `asistio_calificado` mide «cuántas pasan a la R2» sobre un funnel
sin R2, así que su salida es 0 **por construcción**. Y esa salida es el DENOMINADOR de
`calificado_cierre`, o sea que los cierres vuelven en `null`.

**La regla: un paso de medición cuyo denominador es la salida del paso anterior hereda sus
ceros.** Antes de dar por bueno un tramo de pasos encadenados, preguntá qué pasa cuando uno del
medio no aplica — no da error, apaga a todos los de abajo.

### Lo que varía es CUÁNTAS reuniones, y no es una elección de diseño

La tabla `leads` tiene exactamente DOS pares de columnas de reunión
(`fecha_junta_1`/`asistio_j1` y `fecha_junta_2`/`asistio_j2`), y `slotPorIndice`
(`lib/funnel-etapas.ts`) ya topea ahí: una tercera reunión no tiene dónde guardar su fecha. Así
que el tramo comercial tiene exactamente tres formas posibles —0, 1 o 2 reuniones— y por eso la
resolución es una tabla de tres entradas y no un motor.

La resolución vive en `lib/funnel-comercial.ts`, **sin `server-only`** (si no, ningún test la
puede importar) y **tolerante** con el molde de `umbralesDelWorkspace` (`lib/crm-auto.ts`): sin
funnel a mano —la lectura falló, o el workspace no declaró nada— cae al tramo de dos reuniones,
que es exactamente lo que el código hacía siempre. Devuelve dos cosas, y de la misma tabla para
que no puedan divergir: los PASOS (key, label, benchmark, umbral, de qué contador sale cada lado)
y los ROLES (`agendas`, `r1`, `r2`, `cierres`, `base`), que es lo que los tableros consumen en
vez de la key.

Los roles resueltos viajan dentro de `FunnelMes.roles`: el que ya leyó el funnel es
`getFunnelEtapas`, así que resolverlo otra vez en cada consumidor sería una segunda respuesta a
la misma pregunta **y** otra lectura a la base.

### Sin reuniones, la cohorte se ancla en el ALTA del lead

Es la decisión del paquete y conviene que quede escrita. Un funnel sin reuniones no tiene
ninguna fecha de encuentro donde anclar la cohorte, así que el paso `lead_cierre` cuenta sobre
`leads where created_at ∈ ventana`: «de los que entraron en el período, cuántos compraron». Mismo
contrato de cohorte que los otros dos tramos, con la única fecha que todo lead tiene.

⚠️ **Y `mkt.cierres_en_ventana` NO sirve para esto, aunque sea lo primero que aparece.** Esa
cuenta usa `cerro = true` —el booleano VIEJO— más `fecha_cierre`, mientras todo el resto del
archivo dice «Cierre = `estado_lead` 'ganado' (Fase 8), no el viejo booleano cerro». Son dos
definiciones de cierre y mezclarlas haría que el mismo tablero contara distinto según el funnel.

⚠️ **Y la consulta de la cohorte del alta se pide SÓLO si algún paso la nombra**
(`necesitaEntradas`): un funnel de reuniones no paga una lectura más por esto.

⚠️ **Y esa cohorte NO se lee como filas donde alcanza un COUNT.** En `getFunnelEtapas` hacen
falta dos totales, así que van dos `count: 'exact', head: true`; en `getFunnelSeries` hacen falta
las filas (hay que repartirlas por semana), así que va `leerTodo` ordenado por `id`. Un
`.select()` suelto topea en las 1000 de PostgREST **sin dar error**, y con 1.066 leads en un
workspace eso es un total redondo que miente — en la serie semanal se vería como semanas viejas
vacías, que es indistinguible de «ese mes no vendimos».

### Lo que le llega al modelo son las notas, no la pantalla

`lib/api-mako/areas/metricas.run.ts` escribía las etapas del CRM a mano en sus `notas`
—«Agenda→Asistió, Asistió→Calificado, Calificado→Cierre»— y en la `descripcion` de
`ver_serie_funnel_semanal` enumeraba las ocho keys. Para un negocio sin reuniones eso le afirma
al modelo tres etapas que no tiene, y el modelo **no ve la pantalla**: lo único que le llega es
ese JSON. Los rótulos ahora salen de `f.etapas` y la descripción dice que las claves del CRM
dependen del embudo y hay que leer las que vengan.

### Lo que quedó SIN hacer

- **Nadie declaró todavía un funnel sin reuniones.** El código está listo y la mejora no se ve
  hasta que un workspace tenga una plantilla que no sea `highticket`; eso es una decisión del
  dueño (o del onboarding, que ya mapea canal → plantilla en `FUNNEL_POR_CANAL`,
  `lib/pipeline.ts`). No se pudo medir cuántos workspaces vivos tienen 0 o 1 reunión: hace falta
  una consulta a `funnels.data.pipeline` en producción.
- **`app/marketing/page.tsx` dibuja el embudo con rótulos propios** (`Impresión`, `Click`,
  `Landing`, `VSL`) y sólo lee `imp_click`, que es de Meta y no cambia con el funnel: quedó
  intacto. Si algún día pinta el tramo comercial, tiene que salir de `funnel.roles` y no de las
  keys.
- **`lib/queries.ts:getFunnelEtapas` lee el funnel por su cuenta** en vez de recibirlo. Los
  cuatro llamadores no lo tienen en la mano, así que un parámetro opcional sería un segundo lugar
  donde contestar la misma pregunta; el costo es una lectura de `funnels` por llamada (la función
  no está cacheada).

**Probado rompiéndolo** (`tests/funnel-comercial.test.ts`, 13 pasan / 0 fallan con el arreglo):
devolver siempre el tramo de dos reuniones —el bug original— deja **8 / 5**; hacer que el tramo
sin reuniones cuente sobre la cohorte de la R1, **11 / 2**; sacarle el tope de dos a
`reunionesMedibles`, **12 / 1**; dejar de resolver `base`, **10 / 3**; volver a cablear una key
canónica en `getFunnelEtapas`, **12 / 1**.

**Vive en:** `lib/funnel-comercial.ts` · `lib/queries.ts` (`getFunnelEtapas`, `_getFunnelSeries`) · `lib/retro-datos.ts:220` y `:320` · `lib/api-mako/areas/metricas.run.ts:205` y `:240` · `tests/funnel-comercial.test.ts` · *2026-10-04 paquete #798*


---

## La tarjeta más urgente del CRM afirmaba TRES cosas y dos eran falsas (04/10/2026)

«Salvar los datos de Meta antes de que los borre (URGENTE)», score 87, la más alta del
proyecto. Decía que Meta borra las respuestas de los formularios a los 90 días, que el
anuncio y la campaña de origen **nunca** se guardan —«eso no es una ventana, es un agujero
permanente»— y que había que correr un rescate contra reloj.

Lo que lo destapó no fue una medición: fue que el dueño leyera la fila y contestara **«no
entiendo muy bien eso… si los datos que guarda Meta ya MaKo los guarda en el CRM en todos
los leads entrantes»**. Medido contra la API de Meta y contra la base:

| Lo que la tarjeta afirmaba | Lo medido |
|---|---|
| Meta borra respuestas que estamos perdiendo | El único formulario que recibió leads (**686**, ws1) pregunta exactamente los 4 campos que el parser ya saca. **0 respuestas descartadas** |
| El anuncio y la campaña «nunca se guardan» | Se guardan desde siempre: **1.039 de 1.041** leads los tienen, y se dibujan en la ficha |
| Hay que correr un rescate de los últimos 90 días | Meta entrega hoy 685 leads, el más viejo de hace 89 días — y re-pollearlos no traería **ni una** respuesta nueva |

**La tarjeta se contradecía sola**: tres líneas debajo de «nunca se están guardando» citaba
`lib/leads.ts:753-760`, que es el código que los guarda. Un detalle que enumera un problema
y a renglón seguido cita la solución es la firma de un diagnóstico que quedó viejo y que
nadie volvió a leer entero.

### Lo que sí era cierto estaba en otro cliente, y nadie lo había mirado

`parseLeadFields` saca cuatro campos por coincidencia de palabra clave y tira el resto. Hoy
eso no pierde nada **porque el formulario de ese cliente no pregunta nada más**. Pero el
ws13 tiene **cinco formularios con preguntas personalizadas** («¿en qué plazo busca
vender?», «¿cuál es su situación actual?», con opciones cerradas) y **cero leads**. El día
que entre el primero, esa respuesta se descarta en silencio, no hay columna donde ponerla, y
Meta la borra a los 90 días.

O sea: la urgencia era real y estaba **fechada al revés**. No corría contra el reloj de lo
que se está perdiendo; corre contra el reloj de cuándo ese cliente prenda sus anuncios.

- **Cuando una tarjeta dice «URGENTE» y un porcentaje alto, lo primero que se mide es su
  premisa, no su alcance.** Acá el alcance era cero y la premisa valía para otro workspace.
- **El universo de la medición es el conjunto de CLIENTES, no el cliente que reportó.** Mirar
  sólo el ws1 habría cerrado la tarjeta como fantasma y dejado al ws13 perdiendo respuestas
  dentro de un mes, que es el peor de los dos errores posibles.
- ⚠️ **Y lo que se construyó NO fue lo que la tarjeta pedía.** El rescate no se corrió (no
  hay nada que rescatar); lo que se hizo es que no haya nada que rescatar la próxima vez.
  Cuando la premisa de una tarjeta cae, el trabajo correcto casi nunca es su «Listo cuando».

### El dato irrecuperable no se pisa con una ingesta posterior, y el mecanismo es que la clave NO VIAJE

Meta borra `field_data` a los 90 días. Si se escribiera como las otras cinco columnas de
atribución —`input.x ?? null`— el UPDATE de un lead que vuelve a entrar **le borraría las
respuestas que Meta ya no tiene**. `columnasCrudasDeMeta` devuelve la clave sólo si esta
ingesta trae el dato; con un spread, `undefined`, `null` y `[]` colapsan a lo mismo y lo
guardado gana. **Para una columna que guarda algo irrecuperable, «no lo mandó» y «lo mandó
vacío» tienen que ser el mismo caso, y la forma de conseguirlo es no emitir la clave.**

Y la columna nació **sin default y nullable** a propósito: un `default '[]'` les pondría a
los 1.549 leads existentes una respuesta vacía con cara de medida, y ningún lector podría
distinguir «no vino de Meta» de «Meta mandó un formulario vacío».

### Y el descarte, que no dejaba ni un `console.warn`

Hasta hoy, un campo que el parser no reconocía desaparecía sin rastro: «no llegó» y «lo
tiramos nosotros» se veían iguales. Ahora `parseLeadFields` devuelve también los `name` que
no matchearon ningún keyword y el choke point de escritura los deja en el historial del
lead. Es la regla de la casa aplicada a una ingesta: **una política puede rechazar; no puede
no dejar rastro.**

**Vive en:** `lib/meta-leads-campos.ts` (el parser, sin `server-only` para que tenga test) · `lib/leads.ts` (`metaFields`, `dejarRastroDeDescartes`) · `app/api/webhooks/meta-leads/route.ts` · `supabase/migrations/0187_meta_field_data.sql` · *2026-10-04 cerrar-crm*

---

## Al lead que entra SOLO se le aplicaba el criterio más estricto que al que carga una persona (04/10/2026)

#626 se leía como «falta decidir cómo comparar teléfonos». No faltaba decidir nada: el
criterio estaba escrito, testeado y en uso —`telefonoComparable`, los últimos 10 dígitos— en
`duplicadosDeLead` (el alta manual) y en `lib/evolution-mensajes.ts:108`. Lo que faltaba era
aplicarlo **donde el lead entra sin que nadie mire**: los webhooks comparaban con `.eq`.

La asimetría es lo que hay que recordar. `5219981234567` llegando por WhatsApp y
`9981234567` tipeado a mano eran dos personas para la ingesta — y el resultado no es una
ficha de más: son **dos leads inalcanzables**, porque dos filas con el mismo
`telefono_normalizado` rompen con `PGRST116` el `.maybeSingle()` de la ingesta siguiente.

**Cuando un criterio de identidad existe en dos lugares y no en otros dos, la pregunta no es
cuál es el criterio: es quién NO lo aplica.**

- **La consulta EXACTA va primero**, y no es paranoia: es lo que permite afirmar que el
  cambio no empeora nada. Con sólo el `like('%<últimos 10>')` y su `limit`, un match que hoy
  es exacto y limpio puede volverse ambiguo y el tope puede esconder al exacto detrás de
  veinte parecidos. Con la exacta adelante, el sufijo sólo opina donde antes no había nada.
- **Ante un patrón ambiguo, abstenerse**, por la asimetría del daño: crear una ficha de más
  es reversible (alguien las funde); escribir la agenda, las respuestas y la atribución de
  Meta **encima de la persona equivocada** no lo es y no deja una línea en el historial. Un
  IGSID de Instagram también termina en diez dígitos.

### Y el control que le faltaba a #623 no era un botón: era un ID

«Enriquecer al que ya existe» necesita saber **a quién**, y `indiceContactos` devolvía
`Set`s: existencia, no identidad. Un `Map` ingenuo habría mentido —con dos leads que
comparten el email, `get()` devuelve uno arbitrario—. **`has()` contesta «ya existe» y el
VALOR contesta «a quién completar»: son dos preguntas, y la segunda se puede quedar sin
respuesta.**

⚠️ **Y un destino nuevo es una pregunta APARTE, no un tercer valor de la casilla.** Hacer un
enum de tres en el tilde habría roto el guard del 03/10 y revertido en silencio la decisión
del 14/08. Con `incluir` («¿hace algo?») + `enriquecer` («¿y qué hace?») compuestos en
`destinoDe`, los tres lectores —la casilla, el contador del botón y el portón del server—
siguen pasando por UNA función y el guard viejo sigue verde.

**Vive en:** `lib/leads.ts` (las ingestas por webhook) · `lib/leads-duplicados.ts` (`camposParaCompletar`, sin `server-only`) · `app/crm/leads-importar.ts` (`DestinoFila`, `destinoDe`) · *2026-10-04 cerrar-crm*

---

# Los insights de la llamada ya estaban escritos: lo que faltaba era quién los ENLAZA

**El diagnóstico obvio era el equivocado.** El pedido («un apartado para los insights que
salieron de la llamada») se lee como que hay que producir y guardar algo nuevo, y el primer
reflejo es una tabla. No hacía falta ninguna: el Closing Analyst YA persiste una fila por
grabación en `closing_analyses` con el resumen de la charla, el desenlace, las objeciones
(abiertas o respondidas), los momentos y el próximo paso, y `lib/lead-resumen.ts` ya la leía
por lead para la pantalla que MaKo linkea por WhatsApp. Lo que faltaba era un lector
compartido, el apartado, y —la parte caro-silenciosa— **que la fila llegue al lead**.

Tres cosas medidas que explican por qué no llegaba:

- **`syncClosingCalls` le pone `lead_id` a su fila SÓLO cuando el email del invitado matchea
  un lead** (`matchMeetingToLead`). Una grabación matcheada por NOMBRE (`lib/fathom-auto.ts`,
  que a propósito no afirma la asistencia) o pegada a mano en la ficha se analiza igual y
  **nunca llega a la ficha**: el análisis existe, se pagó, y la pantalla dice que no hay nada.
  El re-link por `share_url` existía desde siempre (Paso 0 de `analizarLlamadasDeLead`) y no
  lo llamaba nadie salvo el botón.
- **`redactarFollowUpPostLlamada` es el único camino que dispara el análisis solo, y se va
  antes de disparalo si el lead no tiene teléfono** (`lib/post-llamada.ts:132`, el guard de
  «lead sin teléfono» está ARRIBA del `analizarLlamadasDeLead` de la línea 153). O sea que un
  lead cargado por email, sin teléfono, no tiene insights nunca — y es el mismo lead que
  `fathom-auto` sí sabe enganchar. Dos guardas correctas por separado que juntas dejan un
  hueco.
- **`lead_respuestas` NO sirve para guardar esto**, y la trampa es que parece el lugar: su
  CHECK la ata a Calendly (`reunion in ('R1','R2')`, `supabase/migrations/0062_lead_respuestas.sql:14`).
  Lo que el lead contestó al agendar y lo que dijo hablando son dos cosas; meterlas en la
  misma tabla es la mezcla que la decisión del dueño vino a cortar.

**La regla que queda: en el choke point va la mitad GRATIS; la que cobra necesita
presupuesto.** `applyFathomRecording` (`lib/leads.ts`) es el choke point por el que pasan los
tres caminos que enganchan una grabación, y es el lugar correcto para el disparo — pero ahí
no se puede pagar: ese mismo camino lo dispara el render del CRM con un `void`
(`adjuntarFathomAutoThrottled`), y una llamada al modelo de 90-120 s colgada de un render se
paga y se pierde cuando la plataforma mata la función. Se partió en dos: enlazar el análisis
que ya existe (un SELECT por `embed_token` y un UPDATE) va en el choke point; analizar una
grabación nueva lo drena el cron de closing, que ya reparte un deadline absoluto y reserva
`RESERVA_LLAMADA_MS` por llamada.

⚠️ **Y UNA COLA CALCULADA NO TIENE MEMORIA DEL FRACASO.** La cola del drenaje no se escribe:
se calcula («tiene grabación y ninguna llamada analizada»), que es lo que la hace cubrir los
tres caminos y el cuarto que se escriba mañana. El precio es que un lead cuya grabación no
está en Fathom —un link pegado a mano que apunta a otra cosa— vuelve a entrar en CADA ronda y
paga el barrido de Fathom para no analizar nada, para siempre. Se cierra excluyendo a quien ya
tenga fila en `closing_jobs`: esa fila la deja `cerrarAnalisis` con lo que encontró o con el
motivo, así que significa «a este ya se le intentó», y el único que puede volver a gastar es
la persona desde el botón.

⚠️ **Y DOS COSAS DE LA MISMA LLAMADA NO PUEDEN DECIDIR POR SEPARADO DÓNDE SE DIBUJAN.** El
bloque de la grabación reparte los links entre R1 y R2 por su ETIQUETA; el análisis trae
además un `tipo` que escribió el modelo leyendo el transcript. Si cada uno decide solo, el
link de la R2 queda en un bloque y lo que se dijo en esa llamada en el otro, dentro de la
MISMA tarjeta. Manda la etiqueta y el `tipo` es el respaldo; la función que lo decide
(`etiquetaEsR2`) vive en un módulo sin `server-only` y la llaman los dos.

**Lo que quedó SIN hacer:** el hueco de `lib/post-llamada.ts` (un lead sin teléfono no
dispara el análisis por el webhook) sigue abierto — hoy lo tapa el drenaje del cron, con hasta
una hora de retraso, pero el camino inmediato sigue atado a tener teléfono. Y el apartado pide
sus datos desde el navegador (`insightsDeLlamadaAction`) en vez de bajar por props: es a
propósito, porque `ReunionesCard` se dibuja desde dos parents (el modal del CRM, que es
client, y `/crm/[id]`, que es server) y bajarlos por props obligaba a tocar los dos.

**Vive en:** `lib/insights-llamada.ts` (el lector, el enlace y el drenaje) ·
`lib/insights-llamada-reparto.ts` (el reparto R1/R2 y la cola, sin `server-only`) ·
`lib/leads.ts` (`applyFathomRecording`, el choke point) · `app/api/cron/closing-sync/route.ts`
(el drenaje, uno por ronda) · `app/crm/lead-view/InsightsLlamadaCard.tsx` ·
`app/crm/lead-view/ReunionesCard.tsx` · `tests/insights-llamada.test.ts` · *2026-10-04 #332*

---

## La columna de pago entra como venta — y el cruce no filtraba por etapa: filtraba por TELÉFONO

**El pedido** (Martín, 04/10/2026, textual): *«Si, que lo detecte, pero no solo los "Ganados"
sino, todos los leads de cualquier etapa... Eso es importante para evitar duplicados.»* La
tarjeta (#622) sale de que Leila carga a mano sus clientes de pago recurrente y TODOS caían en
«Lead (Instant form)»: gente que ya pagó, esperando a que alguien les agende una primera
reunión.

### ⚠️ EL DIAGNÓSTICO OBVIO ERA EL EQUIVOCADO, y las dos mitades están medidas

La sospecha era que el cruce anti-duplicados de la importación filtraba por etapa. **No
filtra, y nunca filtró.** `indiceContactos` (`app/crm/importar-server.ts`) lee `leads` con
`leerPorPaginas` sin un solo `.eq` de etapa, de `estado_lead` ni de funnel: el único recorte
es el `workspace_id` que pone `getTenantDb`, que es aislamiento y no un filtro de producto.
Medido ese día contra producción: **entran las 1.549 filas de los 6 workspaces con leads, y
72 de ellas están en un estado terminal** (ws1: 14 ganado + 16 perdido + 8 descalificado + 2
no responde; ws4: 2; ws9: 3; ws10: 1; ws11: 12; ws13: 14) — y entran todas.

Lo que **sí** dejaba leads afuera del cruce era otra cosa, y es por donde se colaban los
duplicados: **el índice comparaba los DÍGITOS COMPLETOS del teléfono.**

| dígitos del `telefono` guardado | leads de ws1 |
|---|---|
| 10 | **1** |
| 12 | 3 |
| 13 | **1.027** |
| 14 | 3 |
| 15 | 3 |
| 16 | **115** |
| 21 / 40 | 1 / 1 |

Los de 13 y 16 entraron desde WhatsApp y desde Meta, con código de país. O sea que un CSV con
números locales —como se tipea una lista de clientes— **matcheaba 1 de 1.154**: los otros
1.153 se importaban como leads nuevos, y las dos fichas quedaban inalcanzables para la ingesta
siguiente, porque dos filas con el mismo `telefono_normalizado` rompen con PGRST116 el
`.maybeSingle()` de Calendly y del instant form.

Y el criterio ya existía: `telefonoComparable` (los últimos 10 dígitos) es el que usan el alta
manual (`duplicadosDeLead`, que FRENA con eso) y el inbox de WhatsApp. **Esta puerta era la que
aplicaba el criterio MÁS ESTRICTO** — el mismo modo de falla que el #626 ya había arreglado
para las ingestas, visto del otro lado.

**La regla que queda:** cuando se va a comprobar «¿esto filtra por X?», se mide igual aunque la
respuesta sea no, y después se mira **qué OTRA cosa deja filas afuera**. Un índice construido
con una clave más estricta que la del resto del repo no filtra: contesta de menos, y contesta
de menos en silencio.

**Cómo quedó:** dos mapas y la precedencia escrita. `exactos` (dígitos completos) y `sufijos`
(últimos 10), y `buscarTelefono` prueba el exacto PRIMERO — el mismo orden que
`elegirPorTelefono` y que las ingestas, así que el cruce más ancho no puede volver ambiguo
ningún match que antes era limpio. Un sufijo compartido por dos leads deja la clave en `null`:
«ya existe» sigue siendo cierto y la oferta de completar desaparece, que es lo correcto porque
no hay a quién. Pares que hoy comparten los últimos 10 dígitos sin compartir los completos:
**0 en los 6 workspaces**. Y la lectura trae además `telefono_normalizado` (0 filas hoy lo
tienen con el `telefono` vacío, pero es la llave de match de todos los webhooks).

⚠️ **La comparación vive SIN `server-only`**, en `app/crm/leads-importar.ts`
(`clavesDeTelefono` + `buscarTelefono`), por la regla de la casa: el índice necesita Supabase,
la COMPARACIÓN no, y es lo único que se puede equivocar.

### La etapa de venta NO se cablea por nombre, y el funnel de ws13 lo prueba

`etapaDeGanado(stages)` (`lib/pipeline.ts`, al lado de `terminalEstadoFor`) busca en el
pipeline de ESE embudo la etapa cuya clave resuelve a `'ganado'`. Dos cosas medidas sobre los
**16 embudos de producción** (04/10/2026):

- Los 16 tienen una etapa con clave `ganado`, así que no hace falta ningún fallback.
- **Quince coinciden y el de ws13 no:** armado a mano, tiene `ganado` tipada como `grupo` y su
  `kind: 'cierre'` en `st0`, que es el DESCARTE («NO Calificado») — el mismo embudo que
  `problemasDePipeline` ya denuncia. Buscando por `kind`, un cliente que pagó entraría en el
  descarte, y encima `terminalEstadoFor('st0')` da `'abierto'`: la venta no sumaría en ninguna
  parte. La CLAVE manda porque es lo que lee `terminalEstadoFor`; el `kind` lo configura el
  cliente en /funnel.

Si el embudo no la tiene, `etapaDeGanado` devuelve `null`, la propuesta no se honra y la
respuesta lo DICE («Este embudo no tiene etapa de cierre: esos leads entraron en la primera
etapa»). Escribir en `pipeline_stage` una clave que el embudo no tiene no falla y deja al lead
en una columna que el tablero no dibuja: así desaparecieron 1.057 leads.

**Y el movimiento NO le agregó una columna a `createLead`:** el lead se crea igual que todos y
después pasa por `setPipelineStage`, que es por donde pasa el tablero — sincroniza
`estado_lead`, escribe el monto y deja la línea en el historial. Una segunda forma de poner una
etapa se desincroniza, y lo que queda mal es el número que suma la facturación.

### «1.200» no es uno con veinte

`montoDeTexto` existe por esto: `Number('1.200')` da **1,2**, así que un cliente de 1.200
entraría al CRM como una venta de un dólar con veinte, sin un solo error. Las dos convenciones
son reales y se confunden entre sí («1.200,50» y «1,200.50»), y la regla es el separador que
aparece ÚLTIMO. Tres cosas más que salieron de ahí:

- **Una fecha no sobrevive al parser, a propósito.** «2026-03-15» devuelve `null`: un monto
  inventado a partir de una fecha es peor que no proponer nada. Por eso un header con «fecha»
  tampoco puede SER la columna de pago — «Fecha de pago» matchea 'pago' y suele venir ANTES
  que el monto, así que sin la exclusión `findIndex` se queda con la fecha y el archivo que SÍ
  traía el importe entra sin importe.
- **Un 0, un negativo y lo fuera de escala no son un pago.** El negativo no se toma por valor
  absoluto: eso convertiría una devolución en una venta. Y el tope (`MAX_MONTO_IMPORT`) es lo
  que evita que una celda con un teléfono pegado entre como una venta de mil millones.
- **La lista de alias es corta a propósito:** están afuera «total», «precio» y «venta», que
  aparecen en catálogos de productos sin decir que alguien pagó. «Total cobrado» entra igual,
  por 'cobrado'.

### Lo que encontró ROMPER los tests (dos agujeros en el test, no en el código)

Las 17 roturas están anotadas con sus números en el encabezado de
`tests/crm-importar-pago.test.ts`. Dos dieron **VERDE sobre la rotura** y valen aparte:

1. **Un assert de salida puede estar midiendo otra pieza.** El test de «una columna ya mapeada
   no puede ser la de pago» pasaba con la exclusión quitada: con los alias de hoy, ninguna
   columna ya mapeada sobrevive al parser del importe (un nombre y un email no tienen dígitos;
   un teléfono los tiene y lo frena el tope; una empresa es texto). O sea que estaba midiendo
   el parser. Se convirtió en un guard de la CONDICIÓN, con el porqué escrito: protege del
   alias que todavía no existe.
2. **Un guard que lee el BLOQUE entero encuentra lo que el bloque dice de sí mismo** — otra
   vez. Un `assert.match` de `entraGanado` sobre el cuerpo de la action seguía verde con el
   portón cambiado por `f.comoGanado` pelado, porque esa función aparece también arriba, en el
   `some(...)` que decide si hay que resolver la etapa. Se recorta la CONDICIÓN del call site
   y se afirma además su largo.

### Lo que quedó SIN hacer

- **Un PDF o una foto con columna de pago no se detecta.** Ese camino pasa por la IA
  (`SISTEMA_EXTRAER` en `app/crm/importar-server.ts`), cuyo JSON no tiene campo de pago: la
  propuesta sólo existe para CSV y planillas, que entran por `filasDesdeCsv`. No es un
  descuido — un importe que pasa por un modelo deja de ser exacto, y es justo el campo que se
  escribe en la facturación.
- **`/crm/revisar/[id]` (lo que propuso un canal) nunca trae `pagoEnArchivo`**, así que ahí la
  propuesta no aparece. Es correcto hoy: esas filas las siembra `RevisarLead.tsx` desde un
  webhook, no desde un archivo con columnas.
- **La MONEDA del importe no se pregunta.** Se escribe en `monto_cierre_usd` tal como vino, que
  es exactamente lo que ya hace el wizard del tablero cuando una persona tipea el monto al
  mover una tarjeta a Ganado — así que no se introduce una ambigüedad nueva, pero sigue
  abierta la de siempre (`app/crm/actions.ts`, la llamada a `setPipelineStage`). Un CSV
  mexicano con pesos entra como dólares.
- **El cruce de la importación no compara por NOMBRE.** `indiceContactos` arma mapas de email
  y de teléfono; `buscarDuplicados` sí compara nombres cuando no hay dato fuerte, y ese camino
  no pasa por acá. No crea duplicados —una fila sin email ni teléfono se descarta por
  `sin-contacto` antes de llegar—, pero deja 3 leads de ws9 (sin email y sin teléfono)
  imposibles de cruzar por cualquier puerta.

**Vive en:** `app/crm/leads-importar.ts` (`pagoDeCelda`, `montoDeTexto`, `ALIAS_PAGO`,
`entraGanado`, `clavesDeTelefono`, `buscarTelefono`) · `app/crm/importar-server.ts` (el índice
con sus dos mapas y `marcarExistentes`) · `lib/pipeline.ts` (`etapaDeGanado`) ·
`app/crm/actions.ts` (`importarLeadsRevisadosAction`: la etapa y el contador `ganados`) ·
`app/crm/TablaRevisionLeads.tsx` (la propuesta y su chip) · `app/crm/ImportarLeadsModal.tsx` ·
`tests/crm-importar-pago.test.ts` · *2026-10-04 #622*


---

## Lo que le pasa en el CRM al que PAGA sin agendar (04/10/2026)

Lo midió la sesión del Perro Guardián y lo verificó contra producción la del CRM, el
04/10/2026. Vino de `hallazgos-planes-y-cobro.md`, que es donde se descubrió.

1. **RIESGO LATENTE, hoy en CERO, y el disparador está identificado.** Si un lead queda
   `abierto` después de pagar, el CRM automático lo manda a «Nutrición - No Agenda» a los 2
   días y a «Reactivación» a los 7: **le escribe "no agendaste la llamada" a alguien que
   acaba de pagarte.** Hoy no pasa, y el motivo es frágil: la regla saltea todo lead que no
   esté `abierto` (`lib/crm-auto.ts:246`) y **de los 19 leads con pago cobrado en los 6
   workspaces con datos, ninguno quedó abierto** — el camino que marca el pago hoy también
   cierra el estado. Un camino de cobro nuevo que escriba la plata y no toque `estado_lead`
   lo despierta. Medido por la sesión del CRM el 04/10/2026 sobre los leads con fila en
   `pagos` (mig 0060): **un carrito, un Whop o un cobro manual que no escriba ahí quedó
   fuera del universo**, y ése es justo el camino que el plan nuevo agrega. El arreglo es
   declarar el embudo «Venta directa · sin reunión», que ya existe (`lib/pipeline.ts:928`).

   ⚠️ **Y la forma de escribirlo es parte del hallazgo.** La primera redacción decía «le
   escribe» en presente sobre algo que mide cero. Un hallazgo que afirma un bug vivo y no lo
   es le hace perder autoridad a todo el documento; uno que dice «esto pasa si alguien
   agrega X» se vuelve útil el día que alguien agrega X.
2. **`TRIGGER.pago` está declarado `auto: true, autoHoy: false`** (`lib/pipeline.ts:103`):
   el embudo sabe que el pago debería mover la etapa y **no hay quién lo dispare**.
3. **Cero integraciones de ecommerce.** El grep de `shopify|woocommerce|tiendanube|
   mercadolibre|hotmart|kajabi|gumroad|paypal` sobre `lib` y `app` da **0**. A un negocio
   que vende productos el CRM le queda como una planilla que mueve a mano. No está roto —
   está vacío, que es peor de detectar.

---

---

## Un CSV con teléfonos locales duplicaba 1.153 de 1.154 contactos, y el filtro que buscábamos no existía (04/10/2026)

Martín, sobre la tarjeta de detectar pagos al importar: **«que lo detecte, pero no solo los
"Ganados" sino, todos los leads de cualquier etapa… Eso es importante para evitar
duplicados»**. O sea que la hipótesis era que el cruce anti-duplicados filtraba por etapa y
por eso no veía a los que ya estaban.

**Ese filtro NO existe, y nunca existió.** `indiceContactos`
(`app/crm/importar-server.ts`) lee `leads` con `leerPorPaginas` sin un solo `.eq`: el único
recorte es el `workspace_id` que pone `getTenantDb`, que es aislamiento y no un filtro de
producto. Medido contra producción: entran **1.549 de 1.549** leads al cruce, **incluidos los
72 en estado terminal** (ganado, perdido, descalificado, no responde).

**Pero sí había leads afuera del cruce, por otra cosa, y era el bug que crea el duplicado.**
El índice comparaba los **dígitos COMPLETOS** del teléfono:

| cuántos dígitos tiene el teléfono guardado (ws1) | leads |
|---|---|
| 10 (como se tipea un número local) | **1** |
| 13 (con código de país — entraron por WhatsApp) | 1.027 |
| 16 | 115 |

Un CSV con números locales —que es exactamente cómo se tipea una lista de clientes—
matcheaba **1 de 1.154**: los otros **1.153 se importaban como leads nuevos**. Y el daño no
termina en la ficha repetida: dos filas con el mismo `telefono_normalizado` rompen con
`PGRST116` el `.maybeSingle()` de la ingesta siguiente, así que **las dos quedan inalcanzables
para Calendly y para el instant form**.

El criterio correcto ya estaba escrito y testeado en la casa —`telefonoComparable`, los
últimos 10 dígitos, el que usan el alta manual y el inbox de WhatsApp— y ésta era la
última puerta que aplicaba el más estricto. Es la misma asimetría que la de los webhooks,
arreglada horas antes: **al lead que llega sin que nadie mire se le pide más que al que carga
una persona.**

- **Cuando alguien reporta un síntoma y propone la causa, la causa también se mide.** Acá el
  síntoma era real (duplicados) y la causa propuesta no existía. Buscar el filtro por etapa
  y no encontrarlo es lo que obligó a mirar qué otra cosa dejaba leads afuera.
- **El número que lo delata no es el total: es la distribución.** «1.549 de 1.549 entran al
  cruce» se lee como que está todo bien. «1 de 1.154 tiene 10 dígitos» dice dónde está el
  problema, y sale de la misma consulta.

**Vive en:** `app/crm/importar-server.ts` (`indiceContactos`) · `lib/leads-duplicados.ts` (`telefonoComparable`) · *2026-10-04 cuatro-decisiones*

---

## El opt-in de una landing nunca pasó un `funnel_id`, así que todo caía al embudo genérico (04/10/2026)

Martín: **«la configuración que falta es que el pixel deberíamos poder ASIGNAR a un PRODUCTO.
Con la implementación que hicimos, para que lleguen los leads a ese CRM y no a otro»**.

Medido antes de escribir una línea: `app/api/track/optin/route.ts` **no nombra `funnel_id` ni
una vez** — cero coincidencias en todo el archivo. O sea que el lead de una landing no
estaba *mal* asignado: **no se asignaba**, y `createLead` lo dejaba en el embudo por defecto
hiciera lo que hiciera el negocio con sus productos.

Y la asignación **cuelga de la URL de la página, no del token**, por una razón que vale para
cualquier cosa que alguien quiera colgar de ese token: `getOrCreateLandingToken` acuña **UN
token por workspace** y determinista (un HMAC de `landing:<ws>` guardado en el único setting
`landing_token`). No hay un segundo token que asignar, así que atar el producto ahí sería
decir «todas mis landings venden lo mismo». `landing.config` ya es una tabla POR PÁGINA desde
que `clarityProjectId` necesitó exactamente eso.

⚠️ **Y el gate que habría dejado muda a la versión nueva del Pixel.** `ganaConLaNueva`
decidía si pedirle al cliente repegar el código mirando si su landing usaba ciertos **hosts
de video**. A una página sin video le habría contestado «para esta página miden igual, no hay
apuro» — sobre la única versión que le agrega algo, porque el scroll le sirve a cualquier
página. **Un gate que decide si vale la pena actualizar tiene que preguntar por la VERSIÓN,
no por el motivo de la versión anterior**: el motivo caduca y el gate se queda contestando
sobre un mundo que ya no es.

**Vive en:** `app/api/track/optin/route.ts` · `lib/landing-funnel.ts` · `lib/landing-config.ts` · `lib/landing-token.ts` (`ganaConLaNueva`) · *2026-10-04 cuatro-decisiones*

---

## Un análisis que sólo se ata al lead por EMAIL pierde todas las reuniones que se matchearon de otro modo (04/10/2026)

Martín, sobre los insights de la llamada: **«las respuestas del Calendly son diferentes,
debería haber un apartado para los insights que salieron de la llamada»**. O sea: no se
pisan, se muestran aparte.

Lo que apareció al construirlo es más caro que el apartado. El Closing Analyst ya persistía
una fila por grabación con resumen, objeciones y próximo paso —no hizo falta ninguna tabla
nueva— pero `syncClosingCalls` **sólo escribe `lead_id` cuando el email del invitado
matchea**. Una grabación matcheada por NOMBRE, o un link que alguien pegó a mano en la ficha,
se analizaba igual y **el análisis no llegaba nunca a la ficha de nadie**: trabajo pago,
guardado, y huérfano.

El enganche se mudó al choke point por donde pasan los tres caminos (`applyFathomRecording`),
y es barato a propósito: un SELECT por `embed_token` y un UPDATE, sin Fathom y sin modelo. Lo
que cuesta plata —correr el analista sobre lo que no tiene análisis— se quedó en el cron,
con tope.

- **Cuando una pieza ya existe pero «no se ve», preguntá por la LIGA antes que por la
  pantalla.** Acá el dato estaba, la pantalla faltaba, y entre los dos faltaba un `lead_id`
  que sólo se escribía en el camino feliz.
- **Y un segundo lector del mismo dato es un segundo relato.** `lib/lead-resumen.ts` tenía su
  propia copia del query y del mapeo: con dos lectores, la ficha y el resumen del celular
  pueden contar dos versiones de la misma llamada. Quedó uno.

**Vive en:** `lib/insights-llamada.ts` · `lib/leads.ts` (`applyFathomRecording`) · `app/crm/lead-view/InsightsLlamadaCard.tsx` · *2026-10-04 cuatro-decisiones*


---

## El plazo por etapa del CRM: un lector sin escritor, y el aviso que el motor nunca mandaba (05/10/2026)

Las dos mitades del «Listo cuando» del SLA por etapa, y ninguna era una decisión del dueño:
el plazo colgaba de las cuatro perillas GLOBALES de `umbralesDelWorkspace`
(lib/crm-auto.ts) y el motor movía leads sin que nadie se enterara.

**El plazo NO puede colgar del objeto `Stage`, aunque sea un dato de una etapa.**
`applyTemplate` (app/funnel/FunnelEditor.tsx) hace `setPipeline(tpl.pipeline)` y `pk()`
reconstruye cada Stage desde `DEFAULT_STAGES`: un campo colgado del Stage sobrevive por
spread accidental y **se borra con UN clic en «Aplicar plantilla», sin error y sin log**. Es
textualmente el aviso que `lib/pipeline.ts` dejó escrito cuando `entradas` se mudó a
`funnels.data`, y acá volvía a aplicar. Vive en `funnels.data.umbrales.porEtapa` —un mapa
`key de Stage → días`— que `saveFunnelDe` conserva porque mergea en vez de reemplazar.

**El plazo declarado es el PISO de la salida, no un reemplazo del umbral que decide el
destino.** Era el bug fácil: con `lead: 10` y el corte de frío global en 7, la versión
ingenua movía el lead a Reactivación a los 7 días — o sea que el plazo declarado habría sido
una promesa que el motor no cumple. Va `Math.max(plazoEtapa, diasSinAgendaFrio)`, y con los
defaults eso da exactamente lo de hoy (`Math.max(2, 7) = 7`).

**Y lo miran DOS de las cuatro reglas, por decisión:** T1 mide horas desde una reunión con
fecha y hora (un plazo en días de la etapa no contesta esa pregunta) y T3 cuelga de
`nutricion_manual_deadline`, una fecha que una PERSONA escribió para ESE lead — un plazo de
etapa encima sería el código contradiciendo una decisión.

✅ **Cerrado el 09/10/2026: ver «El lead QUIETO» más abajo.** Lo de este párrafo era cierto
y además le faltaba la mitad: aunque hubiera habido pantalla, el plazo sólo le servía a T2 y
T6 (tres columnas, y sólo con el motor prendido).

⚠️ **LO QUE QUEDÓ SIN HACER, Y ES LO QUE FALTA PARA CERRARLO: no hay pantalla que escriba
`funnels.data.umbrales`.** No es una regresión de esta tanda — ninguna de las cuatro
perillas globales tuvo escritor nunca (AGENTS.md ya lo tenía anotado como «un lector sin
escritor»), y el plazo por etapa hereda la misma situación: hoy se declara pasándolo en el
`extra` de `saveFunnelDe` y nada más. Los call-sites de esa función están en
`app/crm/actions.ts:2309`, `:2826`, `:2873` y `:2907`, y el control le toca al pop-up del
embudo (subtab «por dónde pasa»). Mientras eso no exista, el plazo por etapa es una
capacidad sin forma de declararla desde el producto.

### El aviso: UNO por corrida, no uno por lead

El motor mueve la cartera entera de una pasada, así que emitir adentro del loop son **30
WhatsApps por una corrida de 30 leads** — la misma forma de «una acción en LOTE necesita UN
deshacer, no N». El texto se arma una vez con todo lo APLICADO (`resumenEstancados`, puro y
con test), y el dedup de ~20 h convierte las nueve corridas diarias del cron
(`vercel.json`: `20 15-23 * * *`) en un mensaje por día.

Tres cosas que el aviso no puede hacer, y las tres estaban ya escritas en otra parte:

- **No afirma lo que no verificó.** Al resumen entran sólo los resultados `auto` y
  `confirma` —los dos aplicaron el cambio—, nunca un `skip`. Un `skip` es «el lead cambió
  entre el plan y el apply», y contarlo le diría al dueño que movimos algo que no se movió.
- **No sale el nombre INTERNO de la etapa.** `noresp` o `st0` son keys de una tabla y quien
  abre el WhatsApp no tiene de dónde sacarlas, así que la caché del embudo del motor pasó a
  guardar `key → rótulo` en vez de sólo las keys — y con eso `etapaDibujable` y el aviso
  leen la MISMA estructura, en una sola query por workspace.
- **Va `texto` y no `contexto`.** Con `contexto`, `emitirDelCatalogo` le paga a un modelo
  para redactar el mensaje con esos números adentro, y un dato exacto que pasa por un LLM
  deja de ser exacto. El hecho igual queda en el feed aunque el WhatsApp esté apagado:
  `emitirAviso` escribe la fila ANTES de mirar el interruptor y antes del espaciado.

⚠️ **Y un aviso nuevo son TRES registros más el catálogo de voz.** La entrada en
`CATALOGO_AVISOS` (para poder leerlo y editarlo), su área en `AREA_POR_AVISO` (el rótulo de
la primera línea: habla de contactos, así que es «👤 LEAD» y no «🔧 SISTEMA»),
`AVISOS_AGRUPABLES` (el motor ya movió: no hay nada que hacer corriendo) y
`AVISOS_WA_EN_VIVO` — sin este último el aviso sale igual y **lo que se pierde es la
posibilidad de apagarlo**, que es peor que el aviso.

### Dos trampas del ENTORNO que costaron una vuelta cada una

- ⚠️ **Un backtick dentro de un `node -e "…"` desde Bash lo COME la sustitución de
  comandos.** Al escribir un comentario que nombraba un tipo entre backticks, bash intentó
  ejecutarlo (`ReadonlySet: No such file or directory`), el script contestó `ok` y el
  archivo quedó con **la palabra borrada y el comentario mintiendo**. Está escrito para los
  template literals del repo y vale igual para el argumento de `node -e`: el parche va en un
  `.mjs` del scratchpad, nunca en una cadena que pase por el shell.
- ⚠️ **El tipo del cruce contra las etapas es `{ has(k) }`, no `ReadonlySet`.** Lo único que
  el saneo necesita del embudo es poder preguntar si la etapa existe; pedir un Set obligaba
  al motor a armar una segunda estructura con la misma información, que es el segundo lugar
  donde vive el mismo dato.

**Vive en:** `lib/crm-auto-plan.ts` (`PlazosPorEtapa`, `plazoDeEtapa`, `sanearPlazosPorEtapa`, `resumenEstancados`) · `lib/crm-auto.ts` (`umbralesDelWorkspace`, `etapasDelWs`, `avisarEstancados`) · `lib/avisos-catalogo.ts` · `lib/avisos-agrupables.ts` · `lib/notif-catalogo.ts` · `tests/crm-auto-sla-etapa.test.ts` · *2026-10-05 paquete-800*

---

## El lead QUIETO: el plazo de cada etapa, y un aviso que no depende del motor (09/10/2026)

**El diagnóstico obvio era el equivocado.** La entrada de arriba cerraba con «falta la
pantalla que escriba `umbrales.porEtapa`», y escribir esa pantalla habría dejado un control
que no hace nada en casi todas las etapas: el plazo lo leen T2 y T6, o sea **«Lead
entrante», «Nutrición - No Agenda» y las de los fríos, y sólo en los negocios con el CRM
automático prendido** (nace apagado por cliente). Un plazo en «Agenda R2» o «Facturando» se
guardaba y no pasaba nada. Lo que #800 pedía desde el principio era otra cosa: *avisar
cuando NO pasa nada*, en cualquier etapa, sin mover a nadie.

Quedó así:

- **El campo:** una pastilla «Plazo» por etapa en el editor de etapas del CRM (también en la
  entrada; nunca en el cierre ni en las cuatro terminales: un lead en Ganado no está quieto,
  ya terminó). Guarda en `funnels.data.umbrales.porEtapa`, el mismo mapa que ya leía el motor,
  así que en las tres columnas de T2/T6 además sigue siendo el piso de la salida automática.
- **El aviso:** `crm-lead-quieto`, aparte de `crm-lead-estancado`. Aquél dice «moví N»; éste
  dice «N siguen quietos» y no toca a nadie. Corre en el cron del CRM automático, **después**
  del motor (lo recién movido ya no está quieto) y **sin mirar `crm_auto_enabled`**. Sin un
  solo plazo declarado no lee ni un lead. Uno por día (dedup de ~20 h).

**`leads` no guarda desde cuándo está un lead en su etapa, y la respuesta sale del
historial.** Cada cambio de etapa —el de una persona y el que sale solo de la derivación por
fechas— deja una fila `Etapa` en `lead_audit` con la clave nueva, y `etapa_vista` dice cuál
fue la última registrada (medido el 09/10: 2.084 filas sobre 1.277 leads, y `etapa_vista`
vacía en 1 lead de 1.592). Desde cuándo = la última fila de ESA etapa. Y **«no sé» es un
tercer estado** (`entradaALaEtapa` devuelve null): si `etapa_vista` es otra que la de hoy, o
la última fila dice otra clave, el cambio todavía no se registró y no se afirma nada. Sin
filas y con la vista al día vale la fecha de alta — que puede quedarse corta en días, nunca
larga respecto del plazo; por eso el mensaje dice «más de N días» con N = el plazo, nunca los
días exactos de cada lead.

⚠️ **En una etapa de REUNIÓN el reloj arranca el día de la reunión** (`relojDesde`). Un lead
en «Agenda R1» con la reunión dentro de diez días está esperando, que es lo que esa columna
significa; el quieto es el que tuvo la reunión y nadie marcó si asistió. Medido: en ws1 hay 2
leads en Agenda R1 con la reunión por delante — sin esto salían en el aviso.

⚠️ **Y una trampa del arnés de roturas:** la primera vez que se rompió el cableado de
`relojDesde` dio «1 fallo», y ese fallo era el de OTRO test que ya estaba rojo por un cambio
propio (el test del orden en el cron buscaba la primera llamada, y el modo `dry` agregó una
antes). Una rotura se lee contra una línea de base en VERDE, nunca contra una que ya tenía un
rojo: el número parece una detección y no lo es.

**Verificado con datos reales sin mandar nada:** plazos de prueba en el embudo de ws4 (leads
ficticios), el aviso en modo `dry` y los plazos sacados: 89 quietos en cuatro etapas, el texto
con los rótulos del embudo y el link al CRM. El `?dry=1` del cron muestra lo mismo para
cualquier negocio.

**La pastilla, mirada en el navegador** (ws9, Playwright contra el `next dev` del clon): las
cuatro etapas propias la muestran —«Lead entrante» incluida, al lado del lápiz—; poner 4 días,
recargar la página y que vuelva del server; un 999 se ignora sin borrar el que había; y vacía
vuelve a «Plazo». ws3 no sirvió: hoy rebota al onboarding.

**Sin hacer:** el aviso no distingue un lead «quieto» porque el negocio lo dejó ahí a
propósito (un plazo largo lo resuelve).

**Vive en:** `lib/lead-quieto.ts` (puro: `puedeTenerPlazo`, `plazosValidos`, `entradaALaEtapa`, `relojDesde`, `leadsQuietos`, `textoLeadsQuietos`) · `lib/lead-quieto-aviso.ts` · `lib/funnels.ts` (`umbralesDe`, `funnelsConUmbrales`) · `app/crm/actions.ts` (op `plazo`, `EmbudoEnDetalle.plazos`) · `app/crm/EtapasModal.tsx` (`PlazoEtapa`) · `app/api/cron/crm-automatico/route.ts` · `tests/lead-quieto.test.ts` · *2026-10-09 #800*

---

## La línea de tiempo del lead nombraba DOS reuniones que el embudo podía no tener

**Síntoma.** El funnel es configurable por workspace desde la 0170, así que un negocio
cuyas etapas `kind: 'reunion'` se llaman «Diagnóstico» y «Propuesta» veía su Kanban con
esos nombres y, en la ficha del mismo lead, una línea de tiempo que decía **«Reunión 1» y
«Reunión 2»**. No falla nada: son dos vocabularios para la misma cosa, y un título que
necesita glosario está en otro idioma.

**Causa real.** `buildJourney` (lib/journey.ts) armaba los hitos de reunión con dos ramas
cableadas (`if (r1date…) 'Reunión 1'` / `if (i.fechaJ2…) 'Reunión 2'`) y jamás recibía el
pipeline. La fuente única del mapeo «quién es reunión, en qué orden y qué par de columnas
le toca» ya existía desde antes (`reunionesDe` + `slotPorIndice`, lib/funnel-etapas.ts) y
la consumían `generateFunnel` y `funnelReqInfo` — la línea de tiempo era el tercer lector
que no se había enchufado. Es «una regla aplicada en dos lugares de tres no está
implementada, está documentada», con el agravante de que los otros dos sí estaban bien.

**Lo que queda (y las tres decisiones que no se ven en la firma).**

- **Sin embudo no se inventa nada.** `etapas` es opcional y, cuando no llega —o cuando el
  embudo no declara ninguna etapa `kind: 'reunion'`—, el recorrido cae a los dos rótulos de
  siempre. Importa porque los dos call-sites de pantalla caen a `DEFAULT_STAGES` cuando la
  lectura del funnel falla, y **`DEFAULT_STAGES` no trae `kind`** (el `kind` lo agrega
  `DEFAULT_PIPELINE`): o sea que el camino de error pasa solo por la rama que se abstiene,
  sin un `if` extra. Un chequeo que no puede mirar se abstiene.
- ⚠️ **Un slot CON DATO que el embudo de hoy ya no reclama se dibuja igual.** Si alguien
  reconfigura su funnel a UNA reunión, los leads que ya tenían la segunda hecha seguirían
  teniendo `fecha_junta_2` en la base. Derivar los hitos del embudo y nada más los habría
  borrado de la pantalla: la fecha es un hecho que pasó, y un cambio de configuración no
  puede llevárselo. Va un barrido de los slots que el embudo no cubrió, con el rótulo
  genérico. Es la misma familia que «"no puedo hacer X con este dato" no es "este dato es
  falso"», aplicada al render.
- ⚠️ **La TERCERA reunión no tiene dónde vivir, y eso se DICE.** `leads` sólo tiene
  `fecha_junta_1/_2` + `asistio_j1/_j2`, así que a partir del índice 2 `slotPorIndice`
  devuelve null. Omitir ese hito dejaba la línea de tiempo terminando ANTES de donde el
  lead está parado, sin un solo error — la falla silenciosa de siempre. Se dibuja sólo
  cuando `etapaActual` es esa etapa (si no, sería un renglón permanente que no informa
  nada) y declara el hueco: «Sin fecha registrada», estado `pending`. **Ése es el único
  caso que necesita la migración del slot de la reunión N; todo el resto ya funciona sin
  tocar el esquema.**

**La trampa del entorno.** `app/crm/LeadSheet.tsx` está en **CRLF** y sus tres vecinos del
mismo cambio (`lib/journey.ts`, `app/crm/[id]/page.tsx`, `lib/api-mako/areas/crm.run.ts`)
en LF, dentro del mismo directorio. Un parche escrito con `\n` contesta «0 coincidencias»
sobre un ancla copiada carácter por carácter, y si igual escribe deja el archivo mezclado
sin que se vea en ningún diff. El salto se detecta por archivo y se devuelve igual.

**Lo que quedó SIN hacer**, con el archivo donde vive:

- `lib/crm-auto-plan.ts` — el **PLANIFICADOR** del CRM automático sigue razonando en R1/R2:
  `planLeadAuto` lee `l.fecha_junta_1 / fecha_junta_2 / asistio_j1 / asistio_j2` directo y
  su copy dice «R1 del …» / «R2 del …» (líneas ~178-189), con `which: 'j1' | 'j2'`. Las
  COLUMNAS son slots genéricos, así que las dos primeras reuniones de cualquier embudo ya
  se revisan bien; lo que falta son dos cosas distintas: (a) que la descripción nombre la
  etapa como la ve el dueño —no necesita migración, necesita que `planLeadAuto` reciba las
  etapas, y `lib/crm-auto.ts` ya las tiene cacheadas en `etapasDelWs()`—, y (b) la reunión
  N≥3, que **sí** necesita la migración 0188 y un backfill que siga leyendo
  `fecha_junta_1/_2` o los recorridos existentes se vacían.
- **La migración 0188 NO se escribió a propósito.** Una columna que nadie lee todavía es un
  esquema que envejece solo; va en el mismo paquete que su lector. Cuando se escriba:
  AGREGA, así que se despliega ANTES o JUNTO con el código que la lee.

**Vive en:** `lib/journey.ts` (`buildJourney`, `EtapaReunion`, `reunionesDelRecorrido`, `datosDeSlot`) · `lib/funnel-etapas.ts` (`reunionesDe`, `slotPorIndice`) · `app/crm/LeadSheet.tsx` · `app/crm/[id]/page.tsx` · `lib/api-mako/areas/crm.run.ts` (`journey_lead`) · `tests/journey-reuniones-embudo.test.ts` · *2026-10-05 paquete-40*


---

## El Pixel contaba como clic del lead el sello del constructor de la landing (05/10/2026)

Martín, mirando la ficha de un lead: **«aquí en el tracking, aún no se está mostrando la
grabación, los clicks, aún sigue redirigiendo a clarity»**. De ese pedido salieron dos
defectos que no estaban en el pedido, y éste es el caro.

El snippet captura **todo** clic de la página — y una landing hecha con un constructor
lleva pegado el badge del constructor. Medido contra producción: **208 de los 441 clics del
ws1 son el «Edit with Lovable»**, casi la mitad, y el PRIMER renglón del recorrido de un
lead decía «Hizo clic en "Edit with" — lovable.dev/projects/…». Lo primero que se leía de
lo que hizo una persona era el cartelito del editor.

En el ws11 y el ws13 el mismo patrón da **0**: no es un problema de todos, es de quien usa
ese constructor. Por eso no se puede descartar «lo raro» a ojo — hay que contar.

- **Se filtra AL LEER, no al capturar.** El snippet vive en la página del cliente, así que
  un arreglo allá sólo vale para quien vuelva a pegar el código, y no limpia los 208 que ya
  están guardados. En el lector vale para los dos lados.
- **El evento no se borra de la base: lo que se saca es el renglón.** Si mañana hace falta
  medir cuánta gente toca el badge, el dato está — una política puede rechazar, no puede no
  dejar rastro.
- ⚠️ **Y el filtro se prueba en las DOS direcciones.** La mitad fácil es que el ruido no
  pase; la cara es que el contenido del negocio SÍ pase. Un patrón goloso acá no deja un
  error: borra de la ficha clics que ocurrieron de verdad, y eso no se recupera. Por eso
  `wix.com` sólo cuenta con `/editor` (un sitio publicado con Wix vive en ese host) y
  `framer.com` sólo con `/projects`. Medido rompiéndolo: aflojar el de Wix tira el test de
  «un clic del negocio SÍ entra».

**Vive en:** `lib/clic-ruido.ts` · `lib/leads.ts` (el gate del lector de eventos) · `tests/clic-ruido.test.ts` · *2026-10-05 ficha-tracking*

---

## Una FUSIÓN no es un REORDEN, y la diferencia sólo se ve en el navegador (05/10/2026)

El mismo pedido —«que se muestre allí mismo»— se implementó primero fusionando: el
recorrido dejó de ser una tarjeta suelta y pasó a vivir dentro de la de Comportamiento, con
lo externo al final y más chico. Leído en el código, el pedido estaba cumplido.

Medido en el navegador, no: **el primer renglón quedaba a 798,5 px del tope, en un área
visible de 583**. O sea que seguía habiendo que scrollear para ver lo único que la pestaña
promete, que era exactamente el reclamo. Lo que ocupaba esos 800 px era lo que iba ANTES:
«Origen del lead» (320 px) y los números con la retención por video.

Con el recorrido primero dentro de la tarjeta y «Origen» mandado al final: **281 px**, y
entra en la ventana por los dos caminos (el panel lateral y `/crm/<id>`).

- **Mover algo adentro de un contenedor no lo mueve en la pantalla.** La pregunta no es
  «¿está en la tarjeta correcta?» sino «¿a cuántos píxeles del tope queda?», y eso no se
  contesta leyendo JSX.
- **Lo de afuera manda tanto como lo de adentro.** Dos tarjetas que ni se tocaron —Origen y
  los números— eran las que producían el defecto.
- Es la regla de la casa aplicada al layout: un gesto no se verifica leyendo el handler. Un
  ORDEN tampoco se verifica leyendo el componente.

### Y las dos puntas de una oferta miran el MISMO universo

El otro defecto que apareció midiendo: el botón «Ponles un nombre» abría un pop-up **sin una
sola fila que contestar en 59 de los 64 leads que lo mostraban**. El contador de «videos sin
identificar» incluía el balde de eventos sin `video_id` —los viejos que no se pudieron
atribuir— y el pop-up descarta justo ése, porque no hay contra qué guardar un nombre.

Las dos mitades eran correctas por separado. **Cuando una pantalla OFRECE algo y otra lo
RESUELVE, las dos tienen que contar sobre el mismo conjunto**, o la oferta promete lo que no
existe. Y no falla ruidoso: abre un pop-up vacío, que se lee como que la app está rota.

**Vive en:** `app/crm/lead-view/ComportamientoCard.tsx` (`nombrables`) · `app/crm/LeadSheet.tsx` y `app/crm/[id]/page.tsx` (el orden de la tab) · *2026-10-05 ficha-tracking*

---

## Un script que valida DESPUÉS de escribir ya hizo el daño (05/10/2026)

Pagado en esta misma tanda, con la guarda puesta y escrita por mí. Un script de parcheo
comprobaba que el archivo no quedara con los saltos de línea MEZCLADOS… después del
`write`. El assert saltó, el script abortó — y el archivo ya estaba en disco, mezclado.

La regla ya estaba en `AGENTS.md` («se niega a escribir si el resultado quedaría mezclado»,
molde: `escribir()` en `scripts/curso-categoria-portada.mjs`) y la implementé al revés.
**Validar y escribir no son dos pasos en cualquier orden: es UN paso que empieza por
validar.** Mejor no hacer el trabajo que dejarlo a medias.

⚠️ **Y el LF suelto que lo disparó no era mío**: lo había dejado un agente de la corrida
anterior en un `import`, uno solo, en un archivo de 348 CRLF. Eso no se ve en ningún diff,
no lo caza el typecheck y rompe cualquier ancla posterior sobre ese archivo. Cuando un
parche falle sobre un archivo que acaba de tocar otro, **lo primero es contar los saltos**,
no releer el ancla.

**Vive en:** `AGENTS.md` (§ del fin de línea por archivo) · *2026-10-05 ficha-tracking*

---

## `funnel_id = NULL` ES el embudo del negocio, así que un `.eq()` pierde 1.530 leads en silencio (05/10/2026)

Lo que más cuesta de filtrar por embudo no es escribir el filtro: es que **`NULL` no
significa «este lead no tiene embudo», significa «el embudo por defecto»**. Son los 1.530
leads que existen desde antes de que hubiera más de uno.

Entonces, cuando una secuencia declara el embudo POR DEFECTO, la consulta honesta no es
`.eq('funnel_id', N)` — ésa deja afuera a todos los viejos sin dar un error, sin un log y
sin una fila rara: la cohorte simplemente sale más chica. Es `.or('funnel_id.is.null,
funnel_id.eq.N')`, porque el id crudo del default y el `NULL` son **el mismo lugar**.

⚠️ **Y esto es exactamente lo que alguien va a «simplificar» dentro de tres meses**, porque
un `.or()` con un `is.null` adentro se lee como ruido defensivo. Queda escrito acá y en el
comentario del módulo: el día que se cambie por un `.eq()`, lo que se rompe no avisa — deja
de enrolar a 1.530 personas y la pantalla sigue diciendo que la secuencia está activa.

**Vive en:** `lib/nutricion-ambito.ts` · `lib/leads.ts` (`listLeadsDeFunnel`, que pide los del default con `.is('funnel_id', null)`) · *2026-10-05 cerrar-crm*

## Las tabs de la ficha son FIJAS, y la que se esconde se lleva el único lugar donde se edita

Síntoma: en un embudo sin reuniones (WhatsApp, carrito) la tab «Reuniones» está vacía
siempre, y el marcado de «¿era calificado?» —uno de los dos únicos datos del CRM que
viajan a Meta CAPI— no se puede poner por ningún camino.

Lo medido sobre los 1.549 leads de producción (05/10/2026):

- **1.350 de 1.549 (87%)** no tienen ni `fecha_junta_1`, ni `fecha_junta_2`, ni
  `fecha_agenda`, ni `asistio_j1`. Abren «Reuniones» y leen «todavía no agendó ninguna
  reunión». La tab está en el array sin condición, al lado de «Resumen», «Tracking»,
  «Análisis» e «Historial»; la ÚNICA condicional es «Pagos» (`pagos.length` en el modal,
  `esVenta || tienePlan` en la ruta).
- **128 de 1.549 (8%)** tienen `visitor_id`. O sea que «Tracking» está tan vacía como
  «Reuniones» para el 92%, y por el mismo motivo: nació pensada para el embudo de VSL.
- **68 leads tienen `calificado` marcado, y CERO de ellos sin `fecha_junta_1`.** No es una
  casualidad de los datos: `updateLead` lo FUERZA (`lib/leads.ts`, «Aplicar reglas de
  coherencia»: sin `fecha_junta_1` → `asistio_j1 = null` y `calificado = null`; con
  `asistio_j1 !== true` → `calificado = null`). Y los tres lugares que lo editan ya vienen
  apagados por la misma condición: `EditLeadForm` (`calificadoDisabled = asistioJ1 !== true`),
  `senalesAOfrecer` («sin fecha de R1 no hay reunión de la que hablar») y el paso
  `calificado` del wizard de `CrmBoard`.

**La trampa, y vale para cualquier tab que se esconda:** el dato no está preso en la TAB,
está preso en una INVARIANTE DEL SERVIDOR. Esconder «Reuniones» en un embudo sin reuniones
no empeora nada, pero mudar el botón a «Tracking» tampoco arregla nada: `updateLead` lo
borra en el mismo guardado. Antes de mover o esconder una tab hay que enumerar qué se EDITA
adentro, y después preguntar si lo que lo bloquea es la pantalla o una regla de coherencia.
Hoy se edita: `InfoPrincipalCard` en Resumen (inline, `saveLeadMetaAction`), `NotasCard` en
Resumen, nombrar videos en Tracking, `AgendarR2` en Reuniones, el deal en Pagos. El resto de
Reuniones en modo lectura es solo chips.

**Y la derivación ya está servida:** las dos fichas reciben `stages` (el pipeline del
funnel), así que «¿este embudo tiene una etapa `kind:'reunion'`?» se contesta sin una query
nueva. Pero `getFunnelDeLead` hoy devuelve el funnel DEFAULT ignorando el lead
(`lib/funnels.ts`), y **solo 2 de 1.549 leads tienen `funnel_id`**: en un workspace con
varios embudos (ws1 tiene 3, ws11 3, ws15 2, ws17 2) la derivación va a mirar la forma del
embudo equivocado. No es un riesgo nuevo —`stages` ya gobierna requisitos, journey y
columnas con la misma limitación— pero sí es el techo de cualquier cosa «por embudo» en la
ficha hasta que exista `lead_participaciones`.

**Y el canal ya se declara, no hace falta inventar la pregunta:** `funnels.canal`
(3 de 16 filas lo tienen: 'presencial') más el canal del negocio del diagnóstico, resueltos
por `canalEfectivo(cfg.canal, diag?.canal)`, y `TEMPLATE_POR_CANAL` ya mapea los 5 canales a
plantilla. Lo que falta no es el dato: es que la ficha lo lea.

**Vive en:** `app/crm/LeadSheet.tsx` (array de tabs) · `app/crm/[id]/page.tsx` (el MISMO
array, duplicado) · `app/crm/lead-view/ReunionesCard.tsx` · `lib/leads.ts` (`updateLead`) ·
`app/crm/senales-meta.ts` · `lib/funnels.ts` (`getFunnelDeLead`) · `lib/pipeline.ts`
(`FUNNEL_TEMPLATES`, `TEMPLATE_POR_CANAL`) · *2026-10-05*

## `ChatCard` existe, lee el hilo de WhatsApp del lead, y no la llama nadie

La vista de la conversación de WhatsApp dentro de la ficha está escrita y completa
(`app/crm/lead-view/ChatCard.tsx`: lee `/api/whatsapp/lead/<id>`, mergea mensajes, separa
por día en la zona del workspace, tiene botón de reintentar). **Cero call-sites en HEAD**:
la tanda 2 de fricción sacó las tabs «Notas» y «Chat», y Notas volvió como tarjeta del
Resumen pero Chat no volvió a ningún lado. Sobrevive solo en
`.claude/worktrees/awesome-banach-8b60f0/`.

Importa porque **1.545 de 1.549 leads tienen teléfono (99,7%)**: si algún día se reemplaza
«Reuniones» por «Conversación» en los embudos de chat, el componente no hay que escribirlo,
hay que volver a enchufarlo. Y el motivo por el que se sacó no era que no sirviera: era que
estaba en TODOS los embudos, incluido el de llamadas donde no aporta.

**Vive en:** `app/crm/lead-view/ChatCard.tsx` (huérfano) · `app/whatsapp/WhatsAppApp.tsx`
(`?lead=<id>`, que es a dónde hay que ir hoy para leer el hilo) · *2026-10-05*

## «Calificado» no se puede marcar en un embudo sin reuniones, y lo que sí se manda a Meta no lleva el id del lead

**El diagnóstico obvio era el equivocado.** La pregunta era si el envío a Meta depende del
embudo. No depende: `sendMetaCAPIEvent` (`lib/meta-capi.ts:97`) no sabe qué es un embudo —
toma el píxel del workspace con `credWs('META_PIXEL_ID')` y manda. Lo que bloquea es otra
cosa, dos renglones de `updateLead`:

```
lib/leads.ts:845   if (!merged.fecha_junta_1) { merged.asistio_j1 = null; merged.calificado = null; }
lib/leads.ts:849   if (merged.asistio_j1 !== true) { merged.calificado = null; }
```

`calificado` se pone en `null` **antes** del save. Y la decisión de emitir se calcula sobre
ese valor ya anulado (`lib/leads.ts:877`: `actual.calificado !== true && merged.calificado
=== true`), así que no es que el evento falle: **nunca se intenta**. No hay error, no hay
log, la pantalla dice que guardó. En un embudo de WhatsApp sin llamada, `fecha_junta_1` es
null por definición → el dato se descarta en silencio.

Los **seis** caminos que escriben `calificado` pasan todos por ahí, así que ninguno escapa:
la ficha (`app/crm/[id]/EditLeadForm.tsx:229` → `saveLeadEditorAction`, `app/crm/actions.ts:2262`),
el wizard «¿Qué hacer ahora?» (`app/crm/CrmBoard.tsx:2507` → `app/crm/actions.ts:488`), las
dos señales que se ofrecen al mover (`app/crm/senales-meta.ts`, mismo destino), MaKo por chat
(`lib/api-mako/areas/crm.run.ts:470`) y los dos revert del historial
(`app/crm/actions.ts:2052` y `:2118`). El séptimo es `lib/nutricion.ts:1706`, que escribe
`calificado: false` con un UPDATE directo salteando `updateLead` — da igual para Meta, porque
`false` no emite nada, pero es el único que no respeta las invariantes.

La UI además lo bloquea antes: `EditLeadForm.tsx:103` (`calificadoDisabled = asistioJ1 !==
true`) y `crm.run.ts:474`, que rechaza con *«no tiene marcado que asistió a la R1»*.

**Medido en producción (05/10):** 1.451 de 1.549 leads no se pueden marcar calificado hoy
(1.351 no tienen fecha de R1 y 100 la tienen sin asistencia marcada). 1.448 de esos tienen
email o teléfono, o sea que **serían atribuibles**. Marcados hay 58. De los 16 embudos, dos
no tienen ninguna etapa `kind: 'reunion'` (ws13 y ws15); ws13 igual tiene 9 calificados
porque usa `fecha_junta_1` para su evento grupal — el campo de reunión está haciendo de
campo de otra cosa.

**Lo que se le manda a Meta son TRES eventos y ninguno es la compra:** `Lead` y
`QualifiedLead` desde `updateLead` (`lib/leads.ts:925` y `:938`) y `Schedule` desde el
webhook de Calendly (`app/api/webhooks/calendly/route.ts:442`). Pasar a Ganado no manda nada
— está declarado en `app/crm/senales-meta.ts` y hay un aviso que se lo dice al dueño
(`lib/avisos-catalogo.ts:578`, `capi-cierres-no-reportados`).

**Y el payload va corto para lo que Meta pide en integraciones de CRM.** `CAPIDataEntry.user_data`
(`lib/meta-capi.ts:46`) sólo admite `em` y `ph`. No manda `lead_id` — el id que Meta genera
en el formulario instantáneo — aunque la columna existe y está poblada: **1.041 de 1.549
leads tienen `meta_lead_id`**. Tampoco manda `fbc` (hay 76 leads con `fbclid` guardado),
ni `fbp`, ni `external_id`, ni IP/user-agent. Para la optimización «Clientes potenciales de
conversión» de Meta, el `lead_id` es el identificador de match recomendado; sin él el match
cae a email/teléfono hasheados, que es el piso.

**`QualifiedLead` no es un evento estándar de Meta** (los estándar son `Lead`, `Schedule`,
`CompleteRegistration`, `SubmitApplication`, `Purchase`…). Un evento personalizado se recibe
igual, pero **para poder elegirlo como objetivo de campaña hay que configurarlo del lado de
Meta**: asignarle un slot en Aggregated Event Measurement o armarle una conversión
personalizada en el Administrador de eventos; y para que la optimización por etapa de CRM
funcione, el conjunto de datos tiene que tener habilitado ese flujo. Si no, Meta acepta los
eventos y las campañas no pueden optimizar contra ellos. O sea: **mandarlo no alcanza**, y
hoy nada en el repo ni en la pantalla de /integraciones le pide al cliente ese paso.

**Lo que ya se está perdiendo por otro lado:** `sendMetaCAPIEvent` sale por `return` cuando
no hay píxel (`lib/meta-capi.ts:109`). ws11 tiene `META_ACCESS_TOKEN` pero **no** tiene
`META_PIXEL_ID`, y tiene 12 leads con `calificado = true`: esos 12 eventos se descartaron
con un `console.error` y nadie se enteró. Con píxel cargado hay 5 workspaces (1, 4, 13, 14, 15).

**Vive en:** `lib/leads.ts` (`updateLead`, las dos invariantes y los dos disparos) ·
`lib/meta-capi.ts` (el payload) · `app/crm/senales-meta.ts` · `app/crm/actions.ts` ·
`app/crm/[id]/EditLeadForm.tsx` · `lib/api-mako/areas/crm.run.ts` ·
`lib/stage-requirements.ts:201` · *2026-10-05*

## El «Video sin identificar» de la ficha no es un video: es el BALDE, y por eso no se puede nombrar

Síntoma, reportado dos veces: «sigue sin dejarme poner de qué video es el "Video sin
identificar"», y «en caso de que ya no haya video para identificar, porque solo hay 1,
está mal que aparezca eso allí».

El diagnóstico obvio era el equivocado. «No me deja nombrarlo» se lee como que falta un
control, y el control existía: el pop-up `NombrarVideosModal`. Lo que pasa es que ese
renglón **no es un video** y nunca va a poder tener nombre.

`getVslEngagement` (`lib/leads.ts`) agrupa la retención por `video_id` y abre una entrada
aparte para las filas que llegaron SIN id — la clave `''` del mapa, con `videoId: null`
escrito al crearla y nunca más. Es el balde: mediciones reales que no se pudieron
atribuir a ningún video concreto, de antes de la v5 del snippet. No hay contra qué
guardar un nombre, y el pop-up lo descartaba justo por eso. O sea que la pantalla
invitaba a hacer algo imposible, y el rótulo —«Video sin identificar»— era literalmente
la invitación.

**Y la segunda mitad es peor, porque el renglón aparecía en leads que tienen UN video.**
Esa misma consulta lee `vsl_events` **sin filtrar por tipo**, así que ahí vienen también
los eventos de la PÁGINA (`pageview`, `click`, `scroll`, `salio`, `volvio`, `cierre`).
Todos llegan con `video_id` null → caen en el balde; y `avanceDe` los descarta por
`esEventoDeVideo` → el balde queda en `plays: 0, maxPct: null`. Resultado: **cualquier
lead que haya visitado la landing tenía una fila fantasma «sin identificar · sin
reproducir»** al lado de su video real.

No era un renglón de más. Con dos entradas, `porVideo.length > 1` daba true, así que la
tarjeta creía que había varios videos: **escondía el minicard «Retención del VSL» y
dibujaba el desglose «Retención por video» para un solo video.** Un bug de layout y un
bug de dato con la misma causa, y ninguno de los dos se lee como «la lista tiene una fila
que no corresponde».

La regla que queda, y es la de siempre con otra cara: **una lista que agrupa por una
clave necesita decidir qué hacer con el grupo SIN clave, y la decisión no es «mostrarlo
como uno más».** Si no se puede actuar sobre él, no se ofrece; si no informa nada, no se
dibuja; y si informa, se rotula por lo que ES y no por lo que le falta.

Lo que lo cierra en código: los dos predicados viven juntos en `lib/landing-videos.ts`
(sin `server-only`, para que tengan test que los EJECUTE) y los llaman las dos puntas —
la lista que se dibuja y el pop-up que se ofrece. `videoNombrable` («¿hay id contra el
que guardar?») y `filaDeRetencionInforma` («¿esto dice algo?») son **dos preguntas
distintas**: un balde con reproducciones informa y no se puede nombrar.

⚠️ Y el universo es UNO para toda la tarjeta: `filas` alimenta el contador, la lista, la
oferta de nombrar y lo que recibe el pop-up. Un segundo `filter` sobre `porVideo` es cómo
`varios` vuelve a dar true con un video solo.

**Vive en:** `lib/landing-videos.ts` (`videoNombrable`, `filaDeRetencionInforma`,
`FilaRetencion`) · `lib/leads.ts:1928` (el balde) · `lib/vsl-retencion.ts`
(`esEventoDeVideo`, que es por qué el balde queda vacío) ·
`app/crm/lead-view/ComportamientoCard.tsx` · `app/crm/lead-view/NombrarVideosModal.tsx` ·
`tests/crm-tracking-ficha.test.ts` · *2026-10-05*

## Una medición de píxeles puede ser cierta y no ser la pregunta

El 04/10 a la noche se dio vuelta el orden de la pestaña Tracking de la ficha: el
recorrido («Actividad registrada») arriba de todo y «Origen del lead» al fondo. El
argumento estaba medido en el navegador y era correcto: con Origen primero, el primer
renglón del recorrido quedaba a 798,5 px del tope en un área visible de 583 — había que
scrollear para ver lo único que la pestaña promete.

Al día siguiente Martín lo pidió al revés, textual: «la primera sección debe ser "Origen
del lead" y luego "Comportamiento" y por ultimo "Actividad registrada"».

La medición no estaba mal: estaba contestando «¿qué entra en la primera pantalla?» cuando
la pregunta era «¿en qué orden se lee esto?». Él la lee como una frase —de dónde vino →
qué hizo → evento por evento— y eso es una **decisión de producto**, no una optimización
de scroll. Es la regla de la casa ya escrita («lo que el dueño decidió es una RESTRICCIÓN
del problema»), y lo que la hizo fácil de pisar es que del otro lado había un número.

**Si la pantalla vuelve a quedar apretada, lo que se acorta es lo de arriba, nunca el
orden.** Y el comentario que justificaba el orden anterior tuvo que cambiar con el
código, en los TRES archivos: un comentario que dice lo contrario de lo que el código
hace es peor que ninguno, porque el próximo lo «arregla» volviéndolo atrás.

**Vive en:** `app/crm/lead-view/ComportamientoCard.tsx` · `app/crm/LeadSheet.tsx` ·
`app/crm/[id]/page.tsx` · el orden lo fija `tests/crm-tracking-ficha.test.ts` ·
*2026-10-05*

## Un modal dentro de otro: el Escape ya tenía guarda, el CLICK no

La ficha del lead en modal (`LeadSheet`) es un overlay propio con `<div onClick={onClose}>`
de backdrop. Todo lo que se monte adentro —el wizard de etapas, la confirmación, el pop-up
de nombrar videos— es **descendiente de ese div en el árbol de React**, y en React los
eventos suben por el árbol de COMPONENTES. Así que un click en el fondo del wizard (el
`padding: 20` alrededor de su panel) cierra su diálogo **y la ficha entera**.

⚠️ **Un `createPortal` NO lo evita.** El portal cambia dónde se dibuja el nodo, no por
dónde propaga el evento: la burbuja sigue el árbol de React, no el DOM. Es la trampa que
hace que la cura «portalealo al body» parezca suficiente y no lo sea.

Esto convivió sin síntoma porque el único camino que montaba el wizard desde la ficha era
mover de etapa, y ahí `onDone` cierra la ficha de todos modos (la tarjeta ya no vive en
esa columna). Dejó de ser inocuo al agregar «Completar datos», donde la ficha TIENE que
quedarse: un click al costado del wizard te saca de la ficha a mitad del formulario.

Es el gemelo por CLICK del bug de Escape que `profundidadModales()` ya resolvía —el mismo
que el 27/09 cerraba la ficha de un cliente al apretar Escape en el detalle de una tarea—.
La cura es un envoltorio con `onClick={(e) => e.stopPropagation()}` alrededor de lo que se
monta adentro.

**La regla: todo overlay que cierre con un click en su backdrop y que monte otros modales
adentro necesita las DOS guardas, y el Escape es la que se nota.** La del click espera a
que exista un camino en el que cerrar el de abajo sea una pérdida.

**Vive en:** `app/crm/LeadSheet.tsx` (el envoltorio y el `if (!quedarse) onClose()`) ·
`app/_components/WizardShell.tsx:490` (su backdrop) · `app/_components/pila-modales.ts`
(la mitad del Escape) · *2026-10-05*

## «¿Qué hacer ahora?» volvió a no abrir: dos capas en la pila para una sola pantalla (09/10/2026)

**Síntoma:** en producción, el botón «¿Qué hacer ahora?» de una reunión que ya pasó no abría
nada. El diálogo estaba montado, con su texto, adentro de un contenedor en `display:none` y
z 130. Se vio grabando el video de la verificación de Google.

**Causa:** `CrmBoard` registraba `useCapaModal(!!queHacer)` mientras el formulario estaba
abierto, y el `WizardShell` de adentro registra SU capa. React corre los efectos del hijo
ANTES que los del padre: el wizard entraba primero a la pila, la capa del tablero quedaba
arriba sin dibujar nada, y `decidirVisible` apagaba al wizard.

**La regla:** un componente registra capa sólo por el overlay que ÉL dibuja. Si lo que abre
es un hijo que ya registra la suya, la capa del padre sobra, y como entra a la pila después,
tapa al hijo. Acá la del tablero existe sólo con el resultado del reagendado (`reagOut`), el
único overlay que dibuja `CrmBoard`.

⚠️ No lo cazaba nada: compila, la regla pura de la pila está bien y tiene test, y el síntoma
es un botón que «no hace nada». Lo encontró abrir la pantalla y mirar el DOM.

**Vive en:** `app/crm/CrmBoard.tsx` (`capaQueHacer`) · `app/_components/pila-modales.ts` ·
`tests/crm-que-hacer-capa.test.ts` (probado rompiéndolo: 1 fallo) · commit `b57a53ba` ·
*2026-10-09*

## Un arnés que rompe código dice «NO MUTÓ» y se lee como un test flojo

Probar un test rompiéndolo es la regla de la casa. El arnés que lo automatiza —mutar un
archivo, correr, restaurar desde memoria— tiene una trampa propia en este clon: con
`core.autocrlf=true` el árbol queda **MEZCLADO entre archivos**, y una ancla con `\n` no
calza en un archivo CRLF.

Medido el 05/10/2026 sobre la ficha del lead: `LeadSheet.tsx` y `ComportamientoCard.tsx`
en disco son CRLF puro, `app/crm/[id]/page.tsx` y los tests son LF. Tres de diecisiete
mutaciones contestaron «NO MUTÓ» — y las tres eran de las assertions que más importaban
(`completarDatos`, `faltantes` y el `stopPropagation`). Leído rápido, eso dice «ese test
no sirve»; con el salto corregido, las tres caen.

**Un arnés de rotura detecta el salto del archivo que va a mutar y convierte sus propias
anclas a ÉSE.** Y una mutación que no muta tiene que decirlo con un rótulo distinto de
«el test no falló», porque son dos hechos opuestos.

⚠️ Y la cara de ESCRITURA del mismo problema, pagada en la misma tanda: un
`cat >> archivo.ts` con heredoc le metió **46 líneas LF a un archivo CRLF**
(`lib/landing-videos.ts`), dejándolo mezclado. No falla, no se ve en ningún listado y no
aparece en el diff. Se midió con node —`(s.match(/\r\n/g)||[]).length` contra
`(s.match(/[^\r]\n/g)||[]).length`— y se normalizó a CRLF, que es lo que el checkout
sirve. Las herramientas de edición del harness sí preservan el salto; `cat >>` no.

**Vive en:** `tests/crm-tracking-ficha.test.ts` (la tabla de las 17 roturas y su
advertencia) · *2026-10-05*

## Editar cada campo EN EL LUGAR: el camino corto le saca el evento a Meta (05/10/2026)

Pedido textual de Martín: «sería bueno que ya no exista el botón de "editar" en la ruta de
cada lead, sino que simplemente en cada campo un lápiz y que se pueda editar allí mismo. O
mucho mejor si no conlleva lápiz, sino que como el nombre, simplemente le doy click arriba y
ya puedo sobre escribir».

**El molde ya existía y no hubo que inventarlo:** `app/_components/EditableInline.tsx`, que
es lo que ya usa el nombre del lead, y que es un `contentEditable` A PROPÓSITO (un `<input>`
no mide su texto: su ancho sale del atributo `size` contado en el dígito «0» de la fuente, y
por eso un título editable se corta). Lo que faltaba son los campos que NO son texto, y ahí
el gesto es otro: `app/crm/lead-view/CampoEditable.tsx` (fecha → el click abre el campo de
fecha; sí/no → el click abre los tres chips ahí mismo; persona → el click abre el
desplegable del equipo).

### ⚠️ EL DIAGNÓSTICO OBVIO ERA EL EQUIVOCADO: `saveLeadMetaAction` no sirve para esto

El camino natural para «guardar un campo de la ficha» ya estaba escrito, con su historial
puesto: `saveLeadMetaAction` → `saveLeadMeta` → `logLeadChanges`. Es el que usan el nombre,
la empresa, el email y el teléfono, y funciona.

Y para «¿era calificado?» y las asistencias **es el camino equivocado**, porque
`saveLeadMeta` es un UPDATE de columnas explícitas y los eventos `Lead` / `QualifiedLead` de
Meta CAPI se disparan **dentro de `updateLead`** (`lib/leads.ts`, los dos
`sendMetaCAPIEvent`). Escribir `calificado` por el camino corto guarda la columna y deja a
Meta sin el evento — que es exactamente el dato por el que el cliente marca esa casilla, y
exactamente la pregunta que Martín hizo el mismo día («¿le llega igual a Meta la info
dependiendo el funnel?»). No hay error, no hay log, y la pantalla dice que sí.

Por eso el catálogo de `app/crm/campo-inline.ts` declara, campo por campo, por dónde se
escribe (`VIA_INLINE`): `lead` para lo que tiene invariante o evento, `meta` para lo que no.
Dos campos, dos preguntas; no es un detalle de implementación.

### ⚠️ `updateLead` LE BORRA EL MONTO DE CIERRE A TODO LEAD EN «FACTURANDO»

Lo más caro de la tanda, y es **anterior a este trabajo**. `updateLead` aplica, sin mirar lo
que mandó el caller:

```ts
if (merged.cerro !== true) { merged.monto_cierre_usd = null; merged.fecha_cierre = null; }
```

Y hay leads con monto y con `cerro` en null: `lib/pagos.ts:216` y
`app/crm/[id]/deal-actions.ts:142` escriben `monto_cierre_usd` DIRECTO, sin pasar por
`updateLead`. Un lead en «Facturando» tiene estado `abierto` (`terminalEstadoFor` devuelve
`abierto` para todo lo que no sea ganado/perdido/descal/noresp), así que corregirle «asistió
a R1» le vacía la venta — en el lead y en Revenue, sin un error, sin un toast y sin una línea
en el historial que diga quién lo sacó.

**Ya muerde hoy por otro camino:** `revertAuditChangeAction` (el «Deshacer» del historial)
llama a `updateLead` campo por campo para «Asistió R1», «Asistió R2», «Calificado», «Fecha
R1/R2», «Fecha de agendamiento» y «Motivo». Deshacer cualquiera de esos en un lead de
Facturando le borra el monto.

Acá se puso un rescate LOCAL —`montoEnRiesgo(before)` en `campo-inline.ts`, y el
`guardarCampoLeadAction` reescribe monto y fecha de cierre después del `updateLead`— porque
tocar la invariante de `updateLead` es un cambio de semántica para ~20 call sites. **Lo que
queda sin hacer es la cura de fondo**: que la coerción se aplique sólo cuando el caller tocó
`estado_lead` / `cerro` / `monto_cierre_usd`, y entonces el rescate local y el de
`revertAuditChangeAction` sobran.

### Lo que NO se vuelve clickeable, y por qué rebotaría de verdad

`updateLead` fuerza `asistio_j1` a null si no hay `fecha_junta_1`, y `calificado` a null si
`asistio_j1 !== true`. Un chip clickeable ahí guardaría y volvería solo al valor anterior: un
campo que invita a editar y rebota se lee como que la app está rota. Así que la asistencia
lleva `bloqueado={!lead.fecha_junta_1}` y «calificado» directamente no se dibuja si no
asistió. La salida está al lado: la fecha de arriba se corrige con un click y con eso la
asistencia se habilita.

Y dos que tampoco: closer/setter no se ofrecen cuando el equipo está vacío y nadie está
asignado (un desplegable de una sola opción promete una decisión que no existe, el mismo
criterio del selector de producto), y si el asignado es **MaKo** no se edita, porque lo
escribió el motor al pasar el lead a una nutrición automática.

### La R1 muestra `fecha_agenda` cuando no tiene `fecha_junta_1`, y el campo editable la precarga

El display de la R1 era `fecha_junta_1 ?? fecha_agenda` — el lead que reservó y todavía no
tiene fecha de junta confirmada (`lib/crm-auto.ts:330` lo dice: «R1 sin fecha_junta_1 (solo
tenía fecha_agenda): fijamos la fecha real primero»). Si el campo editable abriera vacío
sobre una fecha que se está viendo, es la definición de un control que rebota. Abre
PRECARGADO con la fecha de agendamiento y lo que guarda es `fecha_junta_1`, que es lo que
hace a mano el automático.

### Qué gesto quedó en qué campo

| Campo | Gesto | Por dónde escribe |
|---|---|---|
| nombre · empresa · email · teléfono | click y sobre escribir (`EditableInline`, ya estaba) | `saveLeadMetaAction` |
| fecha R1 · fecha R2 · confirmación de pago | el click abre el campo de fecha | `updateLead` |
| asistió R1 · asistió R2 · ¿era calificado? | el click abre Sí / No / — ahí mismo | `updateLead` (dispara CAPI) |
| closer · setter | el click abre el desplegable del equipo | `saveLeadMeta` |

Los tres guardan al salir (blur) o con Enter, Escape cancela y vuelve el valor anterior, y el
cambio queda en el historial del lead porque pasan por `logLeadChanges` — el MISMO camino que
«Deshacer» del historial, no uno nuevo. El `stopImmediatePropagation` del Escape hace falta en
los dos controles propios: los Escape de los modales viven en `document` y en captura, así que
sin eso cancelar una fecha cerraría además la ficha entera (es el bug que `EditableInline` ya
tenía resuelto).

Y los dos montajes de la ficha —`app/crm/[id]/page.tsx` y `app/crm/LeadSheet.tsx`— lo
heredaron sin tocar una línea, porque la tarjeta es la misma por las dos puertas.

### ⚠️ LO QUE QUEDA SIN HACER: el botón «Editar» NO se pudo sacar, y esto es lo que cuelga de él

Sacar el botón es sacar lo que cuelga, y lo que cuelga no tiene otro lugar donde vivir:

1. **El Deal Details entero** (`app/crm/[id]/DealDetailsCard.tsx`, 799 líneas): servicio,
   promesa, datos fiscales, obligaciones, plan de cuotas, contrato y el Cierre
   (monto/fecha/inicio). Su modo edición es la prop `editing`, que **sólo** la pasa
   `EditLeadForm`, y guarda por `dealRef.current.save()` desde el mismo botón. Su propio
   comentario dice «UN SOLO modo de edición: el de la ficha; acá NO hay botón Editar deal
   propio».
2. **Motivo de pérdida** (perdido / descalificado), con sus chips de sugerencias. No se lee
   en ninguna tarjeta de la ficha, así que no hay «ahí mismo» donde editarlo.
3. **Deadline de nutrición manual**, obligatorio cuando la etapa es `manual`. Tampoco se lee
   en la ficha.
4. **Fecha de agendamiento** como campo propio (hoy sólo se ve como respaldo de la R1).
5. **Los links de Fathom** en sus dos slots fijos R1/R2 (y su excepción `fathom_omitido`).
6. **«Borrar lead»**, con su confirmación.
7. **La confirmación con el diff legible** antes de guardar («Estás por aplicar estos
   cambios: Nombre: X → Y…»).
8. **Tres deep-links de afuera que abren ese modo**: `app/crm/LeadSheet.tsx:211` («Editar deal
   →»), `:327` («Editar lead →») y `app/crm/[id]/DealDetailsCard.tsx:405`
   (`?edit=1&tab=cobranza&ia=1`, «✦ Completar con IA»). Más `?solucionar=1` cuando lo único
   que falta son datos estáticos (`soloEdit` en `LeadDetailBody.tsx`).

El camino para que el botón se pueda ir es el 1: darle al `DealDetailsCard` su propio modo de
edición dentro de la pestaña Pagos, y recién entonces mudar 2-7 a un lugar donde se lean.
Mientras eso no exista, sacar el botón es sacar la edición del deal.

**De paso:** `equipoOpts` estaba escrito dos veces (el formulario de edición y el campo nuevo
de la ficha ofrecen la misma lista); quedó en `app/crm/equipo-opciones.ts`, una sola copia.

**Vive en:** `app/crm/campo-inline.ts` (el catálogo y el rescate del monto) ·
`app/crm/lead-view/CampoEditable.tsx` (los tres gestos) ·
`app/crm/lead-view/chip-tri.tsx` · `app/crm/equipo-opciones.ts` ·
`app/crm/actions.ts` (`guardarCampoLeadAction`, al lado de `revertAuditChangeAction`, que es
el mismo camino) · `app/crm/lead-view/ReunionesCard.tsx` ·
`tests/crm-campo-inline.test.ts` (12 pases, con las 9 roturas y su número) · *2026-10-05*

## «¿Era calificado?» no se podía cargar sin reunión, y el botón que faltaba no era el problema

**El síntoma**, textual de Martín (05/10/2026): «es bien importante que esté claro la sección
de "¿Era calificado?" que hoy en día lo tenemos solo editable en las reuniones… con todos los
funnels que tenemos y algunos funnel NO tienen reuniones, esa data tan valiosa que le envía a
Meta CAPI para que nos traigan mejores leads, jamás se pueden editar».

⚠️ **EL DIAGNÓSTICO OBVIO ERA EL EQUIVOCADO.** El pedido se lee como «falta un control en la
tab Tracking», y un control nuevo ahí habría guardado, no habría dado ningún error y la
siguiente lectura habría traído la columna en NULL. La invariante estaba en `updateLead`
(`lib/leads.ts`), dos líneas:

```ts
if (!merged.fecha_junta_1) { merged.asistio_j1 = null; merged.calificado = null; }
if (merged.asistio_j1 !== true) { merged.calificado = null; }
```

O sea que un lead de un funnel de WhatsApp —sin `fecha_junta_1`— **no podía tener
`calificado` ni escrito por el camino que sí avisa a Meta**. Lo que había que mover era la
regla; el control es la consecuencia. Quedó en `lib/calificado-reunion.ts`
(`calificadoSeDescarta`): el único caso que descarta el dato es que CONSTE que no vino a una
R1 con fecha. La ausencia de reunión no es una contradicción, es otro funnel.

### Lo medido primero: el camino único NO era la tab de reuniones, eran CUATRO

| Quién escribe | Dónde | Cómo quedaba |
|---|---|---|
| El chip de la ficha (tab Reuniones) | `app/crm/lead-view/ReunionesCard.tsx` | sólo se dibujaba con `asistio_j1 === true` |
| El formulario de «Editar» | `app/crm/[id]/EditLeadForm.tsx:98` | `calificadoDisabled = asistioJ1 !== true`, gris |
| El wizard de etapa (las «señales a Meta») | `app/crm/senales-meta.ts` → `StageMoveDialog` / `MoverEtapaConfirm` | sólo ofrece si hay R1 con fecha pasada |
| MaKo por chat (`marcar_calificado`) | `lib/api-mako/areas/crm.run.ts` | rechazaba al proponer con `asistio_j1 !== true` |

Los cuatro escriben por `updateLead`, que es el ÚNICO que dispara el evento a Meta — eso
estaba bien y no se tocó. Lo que estaba mal es que los cuatro aplicaban la regla vieja por
su cuenta, cada uno con su propia expresión. Ahora llaman al mismo predicado.

⚠️ **Y el formulario de «Editar» es el que más cuesta encontrar**, porque su bloque comercial
sólo se dibuja si el lead llegó a una reunión (`showComercial`): para el lead de un funnel sin
llamadas el control no existía, y para el que tenía la R1 agendada sin asistencia marcada
existía GRIS. La misma pregunta, editable en una pestaña y gris en la otra. Lo encontró un
`grep` de `asistio_j1 !== true` al cerrar, no el relevo del principio.

### Las métricas NO se inflan, y eso se midió antes de aflojar la invariante

La sospecha razonable es que permitir `calificado` sin asistencia infle «limpias» y la tasa
de cierre. No pasa: **todos los consumidores filtran la asistencia en positivo**, en SQL y en
TypeScript.

- `supabase/migrations/0001`, `0013` y `0084`: `COUNT(*) FILTER (WHERE asistio_j1 = TRUE AND
  calificado = TRUE) AS limpias` — las cuatro vistas de cohortes.
- `lib/queries.ts:1294`: `rows.filter(r => r.asistio_j1 === true && r.calificado === true)`.
- `lib/analisis-negocio.ts`: la lectura de calificación pagina con `eq: { asistio_j1: true }`.

O sea que un lead calificado sin reunión queda fuera del embudo de cohortes, que es lo
correcto: ese embudo mide reuniones.

### ⚠️ BLOQUEANTE MEDIDO: el evento a Meta NO tiene idempotencia, y marcar dos veces manda dos

`updateLead` detecta la transición y dispara (`lib/leads.ts:922-946`):

```ts
const fireLeadEvent = actual.calificado !== true && merged.calificado === true;
```

Eso cubre re-guardar el MISMO valor (no hay transición → no hay evento). **No cubre marcar →
desmarcar → marcar**: son dos transiciones, y salen dos eventos `Lead`. El transporte sí
sabe deduplicar —`CAPIEventParams.eventId` → `event_id` (`lib/meta-capi.ts:33` y `:135`)— y
`updateLead` **no lo pasa**: el único call site que lo usa es
`app/api/webhooks/calendly/route.ts:447` (`eventId: \`schedule:<email>:<startTime>\``). No se
inventó un candado: un `eventId` determinista (`calificado:<leadId>`) tampoco sería un
candado completo, porque la deduplicación de Meta por `event_name` + `event_id` tiene
ventana. Queda para que lo decida Martín, con el dato: **hoy desmarcar y volver a marcar
cuesta un evento de más por vuelta**.

### Lo que queda sin hacer

1. **La idempotencia de arriba** — `lib/leads.ts:922-946` + `lib/meta-capi.ts:33`.
2. **El wizard de etapa sigue sin ofrecerlo sin reunión** (`app/crm/senales-meta.ts`), y es a
   propósito: ése es el momento de MOVER, no el de esa pregunta. No parte el estado (misma
   columna, mismo camino, los dos leen `lead`), pero si mañana se quiere ofrecer ahí, la
   condición `if (!lead.fechaJ1) return nada` es la que hay que abrir.
3. **Qué hay que declarar del lado de Meta** para que el evento sirva en un funnel sin
   reuniones: lo está investigando otro agente, no es código.

**Vive en:** `lib/calificado-reunion.ts` (la regla, pura, 5 call sites) ·
`lib/leads.ts` (`updateLead`, la invariante) ·
`app/crm/lead-view/CalificacionCard.tsx` (el control en la tab Tracking) ·
`app/crm/lead-view/ReunionesCard.tsx` y `app/crm/[id]/EditLeadForm.tsx` (los otros dos
controles, mismo candado) ·
`app/crm/[id]/page.tsx` y `app/crm/LeadSheet.tsx` (los dos montajes) ·
`lib/api-mako/areas/crm.run.ts` + `crm.def.ts` (el canal de MaKo) ·
`tests/crm-calificado-sin-reunion.test.ts` (7 pases, con las 11 roturas y su número) ·
*2026-10-05*

---

## El boton «Editar lead →»: el bloqueante de ayer no existia

**Sintoma.** Martin pidio DOS veces que el boton de editar dejara de existir y que cada
campo se corrigiera con un click sobre el valor. La primera vez se contesto que no se
podia porque **«de el cuelga el Deal Details entero (799 lineas)»**.

**Esa afirmacion era falsa, y la medicion es de dos greps.** El boton era un
`<Link href={/crm/{id}?edit=1}>` y lo que abria era `app/crm/[id]/EditLeadForm.tsx`
(430 lineas). `DealDetailsCard` (799) tiene **tres** call sites y ninguno es el boton:
`app/crm/[id]/page.tsx:244` y `app/crm/LeadSheet.tsx:213` lo montan de LECTURA en la tab
Pagos, y `EditLeadForm.tsx:293` lo montaba con `editing` + un `ref`.

Lo que si colgaba del boton, medido, es **el modo EDICION del deal**: ~20 campos mas el
plan de cuotas, con guardado transaccional (`saveDealSectionsAction` y, solo si las cuotas
cambiaron, `saveCuotasAction`, que hard-setea `estado_lead = ganado`). Eso no se puede
partir en campos: cada tecla cerraria el lead. O sea que la afirmacion de ayer tenia una
mitad cierta —el deal— y la uso para bloquear la otra, que eran **los 15 campos** del
formulario. Separarlas era todo el trabajo.

⚠️ **La regla que queda: un «no se puede porque X cuelga de esto» se contesta contando los
CALL SITES de X.** Si X se monta en otro lado, no cuelga; y si cuelga solo una de sus dos
caras, lo que hay que separar son las caras, no abandonar el pedido.

### Lo que faltaba de verdad: 4 de 15, y eran los que mantenian vivo el boton

Medido campo por campo contra `app/crm/campo-inline.ts` (el catalogo de lo editable en la
ficha), que tenia OCHO entradas:

| Ya era editable en la ficha | Faltaba |
|---|---|
| Nombre · Empresa · Email · Telefono (`EditableInline` en `InfoPrincipalCard`) | **Fecha de agendamiento** |
| Fecha R1 · Fecha R2 · ¿Asistio R1? · ¿Asistio R2? · ¿Era calificado? | **Motivo de salida** |
| Fecha de confirmacion · Closer · Setter | **Fecha limite de la nutricion manual** |
| | **Links de Fathom R1/R2** |
| | **Borrar lead** (existia en el modal, NO en la ruta) |

Once de quince ya estaban. **La lista de lo que falta es el trabajo real y se mide antes de
escribir una linea** — sin ella el pedido se lee como «rehacer la ficha».

### Los links de Fathom: el formulario BORRABA datos y nadie lo sabia

Su `buildFathom(u1, u2)` reconstruia `fathom_links` desde cero con dos slots, asi que
**todo link que no cayera en esos dos se perdia al guardar** — sin aviso y sin linea en el
historial. Editando campo por campo eso seria peor (tocar la R1 borraria la R2), asi que el
parche va por slot: `ponerLinkFathom` reemplaza EN SU POSICION el primer link de esa reunion
y no toca nada mas. Que link es de la R2 lo decide `etiquetaEsR2`, la misma funcion que
reparte los analisis entre los dos bloques.

⚠️ **Y la validacion del link NO EXISTIA en la ficha.** El formulario solo ponia un
`placeholder="https://fathom.video/…"`: guardaba cualquier cosa. La regla si estaba escrita
—pero en el canal de MaKo (`lib/api-mako/areas/crm.run.ts:715`), o sea que **el bot era mas
estricto que la pantalla**. Es «una regla aplicada en un lugar de dos esta documentada, no
implementada» en su forma mas cara: la pantalla es por donde entran los datos a mano. Ahora
la regex vive una sola vez, en `campo-inline.ts`.

⚠️ **Y pegar el link en el bloque de la reunion destapo otro escondite:** `tuvoR2` no miraba
las grabaciones, asi que un lead con la grabacion de la R2 cargada por el webhook de Fathom
(que no escribe `fecha_junta_2`) **no dibujaba el bloque de la R2 y el link desaparecia de
la pantalla**. Mientras el link era de lectura daba igual; en cuanto el bloque es el unico
lugar donde se edita, esconderlo es perderlo.

### El guardado campo por campo es OTRA semantica, y lo que se perdio esta enumerado

El formulario guardaba TODO al apretar, con un diff y una confirmacion. Ahora cada campo se
guarda solo. Lo que eso cambia, medido:

- **Las tres dependencias siguen cubiertas y el candado es el de siempre**: `updateLead`
  fuerza `asistio_j1` a null sin `fecha_junta_1`, `asistio_j2` sin `fecha_junta_2`, y
  `calificado` por `calificadoSeDescarta`. La ficha no los dibuja clickeables en esos casos
  (un campo que invita a editar y rebota se lee como que la app esta rota).
- **El motivo va por `updateLead` y NO por el camino corto**, porque la invariante es suya:
  «motivo solo tiene sentido en perdido/descalificado». Por `saveLeadMeta` un lead reabierto
  se quedaba con el motivo viejo.
- **La unica validacion de campo que el formulario tenia de verdad se conservo**: «Para
  Nutricion - Manual tienes que poner una fecha limite». Vive en `valorDeCampo` y no en la
  pantalla, porque de esa fecha cuelga el aviso de nutricion vencida
  (`lib/crm-auto-plan.ts`): vaciarla saca al lead del radar en silencio.
- **La confirmacion en lote se reemplaza por el Toast con Deshacer**, que es la decision ya
  escrita en `app/_ui/Toast.tsx` (mas barato y mas honesto que preguntar si estas seguro).
  No es una perdida: es el criterio de la casa.
- **Lo que NO se replica y no hacia falta**: los chips de «Precio / Timing / No calificado /
  Fantasma / Otro» del motivo. Siguen donde se DECIDE la salida (`StageMoveDialog`); en la
  ficha se corrige uno ya escrito, y cinco botones para eso son la caja que el pedido venia
  a sacar.

### Sacar el boton es sacar la RUTA: el formulario se borro, y su action tambien

`?edit=1` sigue vivo pero significa **solo el deal** (`app/crm/[id]/EditarDeal.tsx`), que es
a donde llegan los dos links que lo usan y que Martin no cuestiono: el «Editar deal →» de la
tab Pagos (`LeadSheet.tsx:214`) y el «Completar con IA» del propio `DealDetailsCard.tsx:405`,
que ademas necesita `&ia=1`.

⚠️ **Y `saveLeadEditorAction` se BORRO en vez de quedarse sin callers.** Una server action es
una URL: esa escribia los 15 campos **y la etapa** (`setBoardStageOverride`) sin mas guard
que la sesion del workspace. Dejarla viva es la version afilada de «una pantalla huerfana a
la que se llega por un link viejo» — nadie la ve en ningun menu y sigue escribiendo.

Y al borrar el archivo, **tres guards se pusieron rojos y uno de ellos media otra cosa**:
`tests/funnel-estructura.test.ts` enumera con `git ls-files`, que lista el **indice**, asi
que seguia leyendo el archivo borrado hasta que la supresion se stageo. Es la contracara de
«`npm test` antes del `git add` no ve los archivos nuevos».

### Lo que la rotura enseno

Las siete roturas del arnes dieron 34/1 cada una **menos una**: «la ruta se queda sin Borrar
lead» daba **35/0** con el boton renombrado a «Quitar». El assert era
`assert.match(f, /Borrar lead/)` y «Borrar lead» es TAMBIEN el `title` del `ConfirmDialog`
dos lineas mas abajo — o sea el guard encontrando lo que el archivo dice de si. Reanclado al
texto del `<button>`: 34/1.

### Lo que quedo SIN hacer

- **El deal sigue sin editarse en el lugar.** Es la decision tomada aca y esta argumentada
  (guardado transaccional + `saveCuotasAction` cierra el lead), pero si algun dia se pide, el
  trabajo es darle a cada seccion su propio guardado — no partir el `save()` del ref.
- **`solTab` con el valor `edit`** sigue declarado en `lib/queries.ts:2154` y
  `app/crm/CrmBoard.tsx:172` y lo pasa `app/crm/page.tsx:191`: **nadie lo lee para navegar**.
  Era el camino al formulario y quedo como un valor muerto en un tipo.
- **Agregar un link de Fathom a la R2 exige que la R2 exista** (fecha, asistencia o una
  grabacion ya cargada). Es coherente con el candado de la asistencia y no esta dicho en la
  pantalla.

**Vive en:** `app/crm/campo-inline.ts` (el catalogo: 13 campos, 5 gestos, `ponerLinkFathom` y
`FATHOM_URL`) ·
`app/crm/lead-view/CampoEditable.tsx` (`TextoEditable`, `EnlaceFathomEditable`) ·
`app/crm/lead-view/MotivoYPlazoCard.tsx` (las dos tarjetas que montan las DOS fichas) ·
`app/crm/lead-view/ReunionesCard.tsx` (el agendamiento y el slot de Fathom por reunion) ·
`app/crm/[id]/EditarDeal.tsx` (lo que quedo de `EditLeadForm.tsx`, borrado) ·
`app/crm/[id]/LeadDetailBody.tsx` (sin lapiz, con «Borrar lead») ·
`app/crm/actions.ts` (`guardarCampoLeadAction`, con la via `fathom`) ·
`tests/crm-campo-inline.test.ts` (19 pases, con las 7 roturas y su numero) ·
*2026-10-05*

## Mover una fila necesita un DESTINO, y el destino NO puede costar una forma nueva

**Vive en:** `app/crm/CrmBoard.tsx` (la vista de tabla) · `app/plan/board/Tablas.tsx`
(`useArrastreFilas`, el molde que NO se copió)

Pedido de Martín (05/10/2026): «aplica lo que te pedí de mover filas, ya tenemos esa
animación». La animación existe y es compartida (`app/plan/board/arrastre-copia.ts`), así
que la parte difícil no era el gesto: era **qué escribe el gesto**.

**El diagnóstico obvio era el equivocado, dos veces seguidas.**

**Primer error — copiar el hook.** En el plan la fila se suelta **ENTRE** otras dos y lo
que cambia es el `score`: hay un orden manual que reordenar, y el hook devuelve un número
sugerido por la POSICIÓN. En el CRM no existe ese orden — los leads no se rankean entre sí,
y mover un lead significa **cambiarle la etapa**. Sobre una tabla plana, soltar una fila en
otro renglón no tiene ningún significado que escribir.

**Segundo error, y es el que costó una tanda: agrupar la tabla por etapa.** De la
observación correcta («hace falta un destino») salió una solución que cambiaba la pantalla
ENTERA para habilitar un gesto. Martín la rechazó en una línea: **«No separes las etapas,
se ve horrible, para eso están los filtros...»** — y tenía razón por partida doble: el
agrupado se ve SIEMPRE, mientras que el gesto que justificaba existe sólo mientras alguien
arrastra. Se pagó una forma permanente por una capacidad momentánea.

**La regla que queda: un destino de arrastre no puede costar una forma nueva.** Si para
habilitar un gesto hay que reorganizar lo que se ve cuando nadie lo está haciendo, el
destino está mal elegido. El que sobrevive acá es **OTRA FILA**: se suelta el lead sobre
otro y adopta su etapa. Huella visual en reposo: **cero**.

Lo que lo hace legible, y las tres valen para cualquier destino fila-a-fila:

- **La fila sólo es destino si la etapa CAMBIA de verdad.** Resaltar una fila que no va a
  hacer nada es ofrecer un movimiento que no existe.
- **Se marca con un filete y un fondo, nunca con un hueco.** En una tabla, abrir un espacio
  del alto de una fila empuja todo lo de abajo y el ojo pierde la referencia de dónde
  estaba soltando. (En el Kanban el hueco SÍ va: ahí la columna es corta y el hueco dice
  el índice.)
- **El `onDragLeave` lleva el guard `contains(relatedTarget)`**, o pasar por encima de un
  hijo de la fila dispara un leave y el resaltado parpadea.

⚠️ **Y el drop llama a `handleDrop`, el MISMO del Kanban.** Ese camino ya sabe lo que la
tabla no: que «Nutrición - Manual» pide su plazo, que las etapas de Calendly abren la
agenda, que hay señales que ofrecerle a Meta, y que al soltar va el toast con «Deshacer»
que escribe **en el server**. Escribir la etapa desde la tabla sería la segunda
implementación de mover un lead, muda y sin deshacer.

⚠️ **Y no hizo falta copiar `useArrastreFilas`.** Sus 200 líneas vienen de que un `<tr>`
**no se puede posicionar** (`position` no aplica a `display: table-row`), así que
reconstruye una tabla entera para la copia que sigue al cursor. La tabla del CRM es una
grilla de `div`: el nodo se clona tal cual con `montarCopia`, la pieza que el Kanban del
CRM ya montaba. **Antes de copiar un hook grande, mirá si su tamaño viene de un problema
que vos no tenés.**

## La casilla de una tarjeta sale al pasar el cursor, y se esconde con `opacity`

**Vive en:** `app/globals.css` (`.mk-sel-tarjeta`) · `app/crm/CrmBoard.tsx` (la tarjeta)

«En la tarjeta, no debe estar el recuadro de selección múltiple por defecto, solo si paso
el cursor» (05/10/2026). Va por CSS y no por estado: el `:hover` no existe en un estilo en
línea, y menos el hover del PADRE, que es lo que la revela.

- ⚠️ **Se oculta con `opacity`, NUNCA con `display`.** Con `display: none` la casilla no
  ocupa lugar, así que al pasar el cursor aparece y **empuja el nombre del lead 23 px a la
  derecha**: la tarjeta entera salta cada vez que el mouse la toca.
- ⚠️ **Y sigue visible si está marcada** (`data-marcada`). Una casilla tildada que se
  esconde al sacar el cursor deja la selección invisible: la barra diría «3» y no habría
  forma de saber cuáles son los tres.
- Y `:focus-visible`, o con el teclado se llega a un control que no se ve.

## La barra de acciones en lote del CRM, y por qué no es la del plan

**Vive en:** `app/crm/AccionesLoteLeads.tsx` · `app/plan/board/AccionesLote.tsx` (el molde)

`BarraLote` del plan **ya es genérica sobre la entidad** y sirve a dos (tareas y
proyectos), así que la salida obvia es pasarle una tercera configuración. Se midió antes de
escribir y no se puede: su firma pide un `Board` y adentro usa `showUndo`,
`aplicarCascadaManual`, `soltarCandadoManual`, `labels`, `labelById` y `repo`. Un lead no
tiene board, ni score, ni recurrencia, ni proyecto — **de sus seis acciones, cinco se
apagarían** y la sexta (borrar) es la única compartida.

Lo que sí se comparte, que es lo que hace que las dos se vean y se usen igual: la clase
`.mk-icon-btn` con su `data-tone`, el `Dropdown` con `resetAfterSelect`, el molde de tres
ranuras (`flex: 1` en los costados, el grupo del medio en `flex: none`) y la casilla
marcada que limpia. **Lo que podría divergir es el CSS, y el CSS está compartido.**

⚠️ **`bulkFillLeadFieldAction` SÓLO RELLENABA VACÍOS, y eso es correcto en un lugar y un
bug en el otro.** En el worklist de higiene los leads los eligió un FILTRO («a estos les
falta el Setter»), así que pisar sería cambiar un dato que nadie miró. En la barra de
selección es al revés: los tildó una persona, de a uno, mirándolos. Con el comportamiento
viejo, asignarle un Closer a doce leads que ya tienen otro **no escribía nada y contestaba
«0 actualizados»** — un control que no puede hacer nada, con un cero perfectamente
plausible. Va un parámetro `pisar` cuyo default es `false` (el worklist no cambia) y la
confirmación dice **cuántos** va a reemplazar: sin ese número, «asignar» no es una decisión.

⚠️ **Y mover en lote devuelve TRES números, no uno.** Mover no bloquea (decisión del
17/09): lo que la etapa pida y falte queda pendiente. Con un «N movidos» pelado, un lote
que quedó a medias se lee como un éxito. Y `StageMoveResultado` es una **unión**: la rama
`ok: false` NO movió el lead, así que contarla como movida producía exactamente ese número
mentiroso.

**Lo que se dejó AFUERA a propósito:** meter los seleccionados en una secuencia de
nutrición. Es la única acción de la lista que **manda mensajes**, y la línea del chatbot es
la NO OFICIAL — lo que la protege es el ritmo, no una API. Un botón que dispara N
conversaciones de una necesita su propia pantalla, con el ritmo a la vista.

⚠️ **PENDIENTE: el gesto no se verificó en un navegador.** La regla de la casa es
arrastrarlo de verdad, y no se pudo sin escribir en producción (el entorno local apunta a
la Supabase de prod y mover un lead del ws1 mueve el lead de un cliente real). Si se
verifica, va contra el **Cliente de Prueba (ws3)**.

## Campañas y conjuntos de Meta → producto: lo que decide el embudo de un lead que entra solo

**Vive en:** `lib/campana-config.ts` (el mapa, la precedencia, los tres estados) ·
`lib/campana-funnel.ts` (la resolución) · `lib/leads.ts` (`upsertLeadFromMeta`) ·
`app/api/track/optin/route.ts` · `app/crm/CampanasDelProducto.tsx` · mig 0193

Pedido de Martín (05/10/2026): asignar campañas y/o conjuntos de Meta a un PRODUCTO desde la
tarjeta de «Lead entrante» del pop-up del embudo. Un lead NUEVO de esa campaña nace en el
tablero de ese producto, por las tres puertas (webhook del formulario, poll de 90 días,
opt-in de la landing).

**Tres mediciones de producción cambiaron el diseño antes de escribir una línea**, y las tres
valen para quien toque atribución:

- **El `utm_campaign` de los leads de landing YA ES el id de la campaña**: 35 de 35 en un
  cliente, 72 de 119 en otro (el resto trae un nombre). Por eso la landing se enruta con una
  comparación EXACTA (`esIdMeta`) y sin llamar a Meta en una ruta pública. Un nombre nunca
  matchea, y eso es lo seguro: cae a la regla de la landing.
- **`leads.adset_id_origen` existía desde la 0001 con CERO filas escritas** en los 7
  workspaces. Se usa ésa para el conjunto en vez de crear un `meta_adset_id`: dos columnas para
  el mismo dato es cómo alguien lee la vacía creyendo que está vacía por otra razón.
- **`marketing_metrics_daily` tiene `ad_id` y `adset_id` en la misma fila** (mig 0009). En la
  landing no viaja el conjunto, viaja el ANUNCIO (`utm_content`): el conjunto sale de ahí. Sin
  eso, asignar un conjunto enrutaba el formulario y no la landing de la MISMA campaña. Límite:
  un anuncio sin un día de métricas no está, y ese lead se enruta por la campaña.

**Las cuatro decisiones, y por qué cada una:**

- **Un MAPA por id, no una lista por embudo.** Una campaña cae en UN producto (el lead tiene un
  solo `funnel_id`); con la clave en el id, asignarla a otro la MUEVE y el estado ambiguo no se
  puede escribir.
- **Setting propio (`meta.campanas`), no `funnels.data`.** Ese jsonb lo reescriben entero
  varias operaciones del pop-up; un campo nuevo ahí se borra en el primer guardado de un
  escritor que no lo conoce.
- **La campaña MANDA sobre la landing** en el opt-in, porque así lo planteó Martín (campaña →
  producto; la landing es por dónde pasó). Sin campaña asignada decide la landing como antes.
- **Un lead que YA existe NO se mueve** si vuelve por la campaña de otro producto: queda una
  línea en su historial («Volvió a entrar por «X», que es de Y. Sigue en su tablero»).

⚠️ **Y `funnelIdDeCampana` devuelve TRES estados, no un `number | null`.** «Nadie asignó esta
campaña» y «la asignaron al producto del negocio» serían los dos `null`, y el opt-in no podría
saber si la campaña tiene que ganarle a la landing o dejarla decidir. Es «antes de reusar el
`null` de un campo, leé qué afirma ya ese `null`» (AGENTS.md).

### Lo que encontró la revisión adversarial, y es trampa para quien venga después

- ⚠️ **El pop-up del embudo recibe el producto principal de DOS formas.** Desde el lápiz del
  selector del tablero (`onEditarEtapas(f.id)` en TODAS las filas) llega con su id NUMÉRICO;
  desde otros caminos llega `null`. `EmbudoEnDetalle.id` dice «null = el del negocio» y
  **miente a medias**: también puede ser el número con `esDefault: true`. Todo lo que se monte
  adentro de `EtapasModal` y guarde algo «del producto» normaliza con
  `emb.esDefault ? null : emb.id`. Acá, sin normalizar, el principal no mostraba sus campañas y
  rechazaba asignar cualquiera — el primer caso que Martín iba a probar.
- ⚠️ **Leer-modificar-escribir un setting con `getSetting` borra la configuración entera ante
  una lectura caída.** `getSetting` convierte un error en `null`, el saneo lo vuelve `[]`, y el
  guardado escribe `[la nueva]`. Las escrituras leen con `getSettingEstricto`, que existía
  justo para eso; el RUTEO sigue tolerante a propósito (un lead tiene que entrar igual).
- ⚠️ **Validar el ganador DESPUÉS de la precedencia deja que una asignación muerta tape a una
  viva.** Conjunto → producto archivado, su campaña → producto vivo: el lead caía al del
  negocio. La validación (`esViva`) va ANTES de elegir.

### Lo que quedó SIN hacer

- **El lead que cae a PROPUESTA en el opt-in** (duplicados o alta fallida) no lleva el producto,
  ni el de la campaña ni el de la landing. Es un hueco anterior a esto y está documentado por su
  propio test («el camino del DUPLICADO no finge llevar el producto», `tests/landing-optin.test.ts`):
  `FilaImport` no declara `funnel_id`.
- **La segunda mitad del pedido original: el detalle del lead mostrando las métricas de la
  landing de ESA campaña, y el desplegable de producto en la ficha cambiando esas métricas.**
  No está. Lo que lo destraba: (1) los leads de landing no copian el id a `meta_campaign_id`
  (vive en `utm_campaign`), así que «de qué campaña vino» todavía son dos columnas según la
  puerta; (2) `landing_visits` no guarda atribución por visita, así que el recorrido de una
  persona por dos campañas sólo se puede registrar de acá en adelante; (3) una persona en dos
  productos a la vez necesita otro modelo (una fila por participación) — y con dos embudos
  vivos, `nutricion_secuencias.funnel_id` no lo lee nadie y la misma persona recibiría los
  WhatsApps de los dos.

### Traer los leads que la campaña YA tiene (segunda tanda, 05/10/2026)

**Vive en:** `lib/campana-atribucion.ts` (qué lead es de qué campaña, y cuáles se mueven) ·
`lib/campana-traer.ts` (el movimiento) · `app/crm/campanas-actions.ts` · `app/crm/CampanasModal.tsx`

Pedido de Martín: «Es importante que si selecciono una campaña, me traiga todos los leads. No
solo los futuros». Y la sección, que giraba un spinner en lugar de dibujarse, pasó a ser una
tabla en un modal (buscador, filtros, orden, conjuntos desplegables), abierta desde la sección y
desde el «⋯» de la columna de entrada.

- **`leads.meta_campaign_id` nació ese mismo día: lo viejo no lo tiene.** La campaña de un lead
  histórico se RECONSTRUYE con datos exactos que ya estaban: `utm_campaign` cuando es un id, y el
  ANUNCIO (`meta_ad_id` del formulario, `utm_content` de la landing) cruzado con
  `marketing_metrics_daily`, que tiene anuncio, conjunto y campaña en la misma fila. Medido:
  1.105 de 1.148 leads de Meta del cliente más grande (96%), 277 de 299 en otro, 36 de 36 en un
  tercero. **El nombre de la campaña no agrega NINGUNO**, así que no se matchea por nombre.
- ⚠️ **TRAER NO ES `moverLeadsAFunnelAction`, Y USARLA HABRÍA SIDO EL ERROR CARO.** Esa acción
  pone a cada lead en la ENTRADA del embudo nuevo, que es correcto para traer a UNA persona a
  empezar de cero. Para la historia de una campaña es destructivo: un lead que ya pagó volvería a
  «Lead entrante», y con 896 leads de una sola campaña (medido) el tablero entero se resetea.
  `moverEnLote` cambia SÓLO `funnel_id`; si la etapa guardada no existe en el embudo nuevo, el
  tablero lo ubica por lo que hizo y le pone el chip de «fuera del embudo» (`crm-map.ts`).
- **La precedencia conjunto > campaña vale también para lo viejo**, y se calcula con la
  configuración YA guardada: si un conjunto de esa campaña está en otro producto, sus leads se
  quedan allá — igual que los que entren mañana. Traer y rutear no se pueden contradecir.
- **La lista de Meta no alcanza para ofrecer campañas.** Trae las de HOY: una campaña borrada, o
  una cuenta que se desconectó, no aparece, y sus leads siguen en el CRM. La tabla completa con
  los nombres de las métricas, así que también sirve con Meta caído o sin conectar.
- ⚠️ **Asignar pregunta si va a mover leads, y sólo entonces.** Una campaña nueva (cero leads)
  se asigna con un clic —el «sin fricción» que se pidió es para ésas—; una vieja dice «¿Traer
  896 leads…?» con de qué producto salen. Después queda el «Deshacer» (devuelve cada lead a SU
  producto y la campaña a donde estaba, no a «sin asignar»).

### La trampa de verificar esto en un cliente real

⚠️ **Hacer clic en una fila «para ver la pregunta» ESCRIBIÓ en la config de un cliente.** La
pregunta depende de un número que calcula el server (cuántos leads se moverían), y en el cliente
más grande todos los leads de esa campaña ya estaban en el producto principal: la previa dio 0, no
hubo pregunta, y el clic asignó la campaña. No se movió ningún lead y se revirtió en el acto (la
fila del setting no existía antes: se borró). **La regla: antes de hacer clic en un control cuyo
camino lo decide un dato del server, ese dato se MIDE con una lectura** (`planDeTraida` por `tsx`),
y el clic va donde la rama esperada está garantizada — acá, el producto «Prueba», donde la previa
daba 10.

- **ws3 y ws9 no sirven para probar el CRM**: el primero cae al onboarding global y el segundo a
  la activación de la tab. Por eso `moverEnLote` vive en `lib/` y no adentro de la acción: se
  ejerció por `tsx --conditions=react-server` contra leads sembrados en ws9 (mover, historial,
  segundo plan = 0, devolver) y se borró lo sembrado.
  - (06/10, segunda vez que se paga) **El que SÍ dibuja el CRM es el ws4, «Cliente de Diseño»**:
    300 leads de mentira (`@prueba.local`) y el onboarding cerrado. ⚠️ **Pero comparte el token y
    el PIXEL de Meta del ws1**: ahí se puede MIRAR y reordenar dentro de una columna (sólo escribe
    `lead_orden`), y NO mover de columna — un cambio de etapa puede mandarle un evento falso al
    pixel de un cliente real. Los leads de prueba se siembran con `pipeline_stage` puesto por SQL
    (no pasa por la app, no dispara nada) en una columna vacía, y se borran al terminar.
- **En dev el modal tardó 19 s en llenarse y no es el server**: las tres lecturas suman ~2 s en
  paralelo (544 + 741 + 963 ms), pero el modo estricto llama dos veces a la acción y las server
  actions se encolan. En producción es una sola llamada.

### Lo que quedó SIN hacer de esta tanda

- **«Solo los nuevos» no existe.** Si alguien quiere asignar una campaña vieja SIN traer su
  historia, hoy no puede: la pregunta ofrece «Traer N» o «No asignar». Se dejó así porque el
  pedido fue traerlos todos; si aparece el caso, es un segundo botón en la misma pregunta
  (`asignarCampanaAction(…, traer = false)` ya existe).
- **Crear la campaña con su producto, y asignar desde la tabla de Ads Manager**, se le pasó al
  chat de Ads Manager con el contrato: reusar `asignarCampanaAction` y `lib/campana-config.ts`,
  no una segunda implementación.
- **Que una campaña caiga en otra etapa que no sea la entrada** (p. ej. «Agenda llamada») quedó
  como pregunta a Martín, con la recomendación de no hacerlo: la etapa la decide lo que el lead
  HACE (agendar, asistir, pagar), y eso ya se automatiza.

## Un `throw` de una server action borra los ids del duplicado (05/10/2026)

**Vive en:** `app/crm/actions.ts` → `crearLeadDesdeWhatsappAction`, `choqueDeLead` ·
el guard en `tests/inbox-agregar-al-crm.test.ts`

`LeadDuplicadoError` trae las coincidencias adentro **justamente** para que la pantalla
pueda ofrecer «abre el que ya tienes» en vez de un cartel — está escrito así en el
comentario de `ChoqueDeLead`. Lo que ese razonamiento no cubre es que una server action que
TIRA llega al navegador como un mensaje genérico: Next redacta el error en producción, así
que los ids se pierden en el camino y lo único que queda del otro lado es un string.

El alta desde una conversación de WhatsApp tiraba. Ahora devuelve `{ id } | ChoqueDeLead`,
el mismo contrato que el alta del tablero ya había resuelto así, y el armado del choque
—que estaba copiado adentro de `crearLeadEnTableroAction`— pasó a una función que usan los
dos caminos: con una copia por camino, el día que cambie cómo se nombra un embudo lo arregla
uno solo.

Y con el dato de vuelta, la pantalla puede decidir: **con UN solo candidato se abre ÉSE**
—lo identifica el teléfono, que es la misma llave con la que la conversación busca su
lead— y **con varios no se elige el primero**, se dice con quién choca (es la regla de la
casa: «si hay más de un candidato, no se elige el primero»).

## El alta desde el chat existía en una bandeja de dos (05/10/2026)

**Vive en:** `app/whatsapp/EmpresaInbox.tsx` (`agregarAlCrm`) · `app/whatsapp/WhatsAppApp.tsx`

Tarjeta #830. «Agregar al CRM» desde una conversación se había escrito en el #381 **para la
bandeja oficial** (Chatwoot). La no oficial (Evolution) —que es la que usa el chatbot y la
que el 05/10 quedó por default— no lo tenía, así que para alguien que escribió por WhatsApp
y no estaba en el CRM la única salida era irse a `/crm` y cargarlo a mano con el teléfono
copiado. El mecanismo estaba completo; le faltaba una pantalla.

Medido en el ws1 contra producción, con las 225 conversaciones del espejo:

| | cuántas | qué ofrece la ficha lateral |
|---|---|---|
| ya tienen lead | 52 | «Ver detalle del lead» |
| **con teléfono y sin lead** | **140** | antes: «Buscar en CRM» (o sea, nada) |
| sin teléfono (grupos) | 33 | «Buscar en CRM», que ahí sí es lo correcto |

De esas 140, en **23** WhatsApp no da nombre y el `nombre` ES el teléfono. El lead nace con
eso y por eso se abre **la ficha editable en el acto**: es el momento en que una persona ve
el dato antes de que valga, que es lo que la confirmación existe para hacer.

⚠️ **El `leadId` se escribe en el estado local en el acto.** La conversación se enlaza sola
al lead por teléfono, pero en la PRÓXIMA carga (`resolverLeadIdsPorTelefono`): sin eso el
botón sigue ofreciendo el alta sobre un contacto que ya está, y el segundo clic choca con el
duplicado que acaba de crear. Se actualizan las tres copias —`convs`, `busqLeads` y el
`convsCache` del módulo—, igual que hace el bloqueo de contacto.

⚠️ **Y el lead nace con `funnel_id` en NULL**, que es donde el tablero dibuja a los del
embudo del negocio (`funnelId == null ? q.is('funnel_id', null)`). Es el comportamiento que
ya tenía el alta de la bandeja oficial y no se cambió acá: si alguien está mirando OTRO
producto, el lead no aparece en ese tablero. Es la misma decisión pendiente que los leads
fuera del embudo, no un bug nuevo — pero conviene saberlo antes de reportarlo como «lo
agregué y no está».

> **Resuelto el 08/10/2026**: el alta elige el producto. Ver «"+ Agregar al CRM" desde WhatsApp metía a
> todos en el embudo principal», más abajo.

**Cómo se verificó, sin apretarlo:** el botón crea un lead de verdad en el CRM de un cliente
real (el entorno local apunta a producción), así que el arnés mide que el control EXISTA,
esté habilitado y que **el clic en su centro LLEGUE a él** —`elementFromPoint` devuelve el
propio botón— y recorre las dos ramas con datos reales: «Teresa De Jesus» (lead 21) ofrece
«Ver detalle» y «Ellie Burgueño» (sin lead) ofrece el alta. Las filas de la lista **no son
`<button>`**, así que enumerarlas por `querySelectorAll('button')` devuelve 0 y se lee como
«la bandeja está vacía»: se clickean por texto.

## Las sesiones de ENTREGA quedaban como «Reunión 2», y la regla buena NO es el primer pago (06/10/2026)

**Vive en:** `app/api/webhooks/fathom/route.ts` (el escritor) · `lib/insights-llamada-reparto.ts`
(`esGrabacionDeEntrega`) · `app/crm/lead-view/ReunionesCard.tsx` (donde se veía)

Síntoma (captura de Martín, lead #21 del cliente más grande): debajo de la R2 aparecían ocho, once
filas «Reunión 2 (Fathom)», todas sesiones de entrega del servicio. «Esas reuniones se visualizan
en Customer Success, no aquí.»

- **El escritor era UNO, y no el que se sospecha por el nombre.** `fathom-auto` y `crm-auto`
  están limpios (el primero saltea leads con 2+ links y mira ±3 días). El culpable es el
  **webhook de Fathom**: si la fecha de la grabación no coincide con R1 ni con R2, cae al fallback
  «R1 ya resuelta → es la R2», así que a un cliente que ya tuvo su R2 le etiquetaba como R2 CADA
  reunión que grabara. 45 links en 6 clientes, todos posteriores al cierre. Y por cada una,
  además, disparaba el evento de R2, **pagaba un análisis del Closing Analyst** (que recién
  después descartaba por «no es venta») y le avisaba al dueño «Terminó la R2».
- ⚠️ **EL DIAGNÓSTICO OBVIO ESTABA MAL: «posterior al primer pago» no marca la entrega.** El
  apartado se cobra en la R1, así que la R2 de VENTA cae después del pago en 9 de 20 ventas (el
  #21: pago 29/05, R2 01/06). Con esa regla se borraba la R2 real. Lo que separa es el
  **cierre**: medido contra la categoría del Closing Analyst, 28 de 28 entregas y 19 de 19 ventas
  bien. Y la comparación es **estricta**: con `>=` hay 3 falsos positivos (R2 que se cierran en la
  misma llamada).
- **El título no sirve** para separar: «Junta X y Y» y «X y Mauricio Bustos» se solapan (el
  detector `RE_SERVICIO_EXPLICITO` caza 0 de 28 entregas). **La categoría del Closing Analyst es
  la más precisa, pero llega DESPUÉS del webhook** (el análisis corre en el `after()`): al escribir
  sólo hay fecha y lead.
- **Lo que quedó:** `esGrabacionDeEntrega` (pura, con test) y el webhook sale ANTES de enganchar,
  de disparar el evento y de pagar el análisis. La grabación no se pierde: el sync del Closing
  Analyst la guarda en `closing_analyses` con su `lead_id`, y la pestaña «Llamadas» de Customer
  Success la lee de ahí.
- **Los 45 ya enganchados se SACARON de `fathom_links`** (no se re-etiquetaron: `FathomLink` no
  tiene fecha, y clasificar al leer obligaba a cruzar `closing_analyses` en cada lector de R1/R2).
  Respaldo previo, escritura con `sql.json`, una línea por lead en el historial, y verificado: cada
  cliente quedó con sus 2 de venta y el jsonb como array. El primer R2 (el slot) no se tocó nunca.
- ⚠️ **Trampa para el que venga:** hay DOS definiciones de «es R2»: `etiquetaEsR2` y `ES_R2` de
  `lib/auto-reuniones.ts`, que además acepta «seguimiento». Y `docs/hallazgos-customer-success.md`
  decía que `fathom_links` sólo tenía ventas: hasta hoy no era cierto.

### Lo que quedó SIN hacer

- ~~**El webhook llama `dispararEvento` sin `ws`** y `lib/flujos.ts` cae a `OWNER_WS`: un webhook de
  Fathom de otro workspace correría los flujos del ws1. Bug aparte, no tocado.~~ **ARREGLADO el
  06/10/2026, y no era uno: eran OCHO llamadas** (Calendly ×3, Cal.com ×2, Chatwoot, Meta y
  Fathom). Ver `docs/hallazgos-comunicacion.md` → «Y el `ws` que `dispararEvento` usaba no
  venía».
- **Las entregas ANTERIORES a un cierre cargado tarde** (12 sesiones de un lead cuyo cierre se
  cargó meses después) sólo las caza la categoría: la fecha no las ve.
- **ws9 y ws11 tienen entregas sin `lead_id`** en `closing_analyses`; el día que matcheen por
  email, la guarda del webhook ya los cubre.

## La ficha del lead, 06/10/2026: producto en el pop-up, Web, un WhatsApp, la cara y sin «Reactivar»

**Vive en:** `app/crm/LeadSheet.tsx` · `app/crm/[id]/LeadDetailBody.tsx` ·
`app/crm/lead-view/InfoPrincipalCard.tsx` · `app/crm/lead-view/CaraDelLead.tsx` ·
`app/_components/foto-contacto.ts` · `lib/contacto-lead.ts` · mig 0194

- **El desplegable de producto decía «Funnel principal»** en la ruta, que es el nombre que puso la
  migración y el mismo en todos los workspaces. Ahora las dos puertas muestran el producto
  (`f.producto || f.nombre`), igual que el selector del tablero. El pop-up no lo tenía: es el
  MISMO `ProductoDelLead`.
- **«Dirección» era el domicilio FISCAL del deal**, no un dato de contacto. Se reemplazó por
  `leads.web` (mig 0194, aplicada ANTES del push): se edita en el lugar, entra al historial y se
  deshace como el resto. El link pone `https://` si falta y NO linkea otro esquema (un
  `javascript:` en un campo libre es un link que ejecuta código).
- **Los desplegables caían a la IZQUIERDA con un nombre largo**: `space-between` + `wrap` mandaba
  la columna a otro renglón, pegada al borde izquierdo. El nombre cede (`flex: 1 1 320px`) y la
  columna lleva `marginLeft: auto`: si no entra, baja pegada a la derecha.
- **La foto: lo elegido → WhatsApp → Gravatar → iniciales**, una pieza para el CRM y Customer
  Success (`foto-contacto.ts`, nació en `app/customer-success/foto-cliente.ts`). Se PRUEBA antes de
  dibujar (un `onError` cae directo a las iniciales y nunca prueba la segunda), y el `?ws=` va en
  la URL de WhatsApp (un `<img>` no pasa por el parche de fetch).
  - ⚠️ **«La foto del email» es Gravatar.** La de Gmail no es pública: 550 de 1155 leads del
    cliente más grande son de Gmail y la mayoría queda en iniciales. No es un bug.
  - ⚠️ **La de WhatsApp vence a los 10 días** (`evolution_contactos.foto_url`, firmada con `oe`):
    hoy están vencidas 1298 de 1807 en el ws1. Martín aprobó guardarla («Sí, guarda las fotos sin
    problemas»): ver la sección siguiente.

### La foto de WhatsApp se GUARDA, y lo que eso no puede arreglar (06/10/2026, segunda tanda)

**Vive en:** `lib/fotos-contacto.ts` (el trabajo) · `lib/contacto-lead.ts` (`venceFotoWa`,
`numeroCanonico`, `fotosVigentes`, `leadsParaGuardarFoto`, puras y con test) ·
`app/api/cron/fotos-contacto/route.ts` (diario, 09:40 UTC) · mig 0195

- **Columna propia, no `avatar_url`.** `leads.foto_auto_url` es la copia automática y
  `avatar_url`/`icono` la cara que eligió una persona, que gana siempre. Mezclarlas haría que el
  cron pise una foto elegida. El guard lo fija leyendo el fuente sin comentarios.
- **El vencimiento es un dato, no una suposición**: `oe` son los segundos de expiración en hex.
  Se copian sólo las URLs que valen al menos 6 h más; una vencida da 403 y no se puede bajar.
- ⚠️ **EL TOPE NO LO PONE EL CÓDIGO: LO PONE CUÁNTAS URLs VALEN HOY.** La agenda de Evolution
  (`fetchContactosEvolution`, que lee la base de Evolution y no le habla a la línea) trajo 5199
  contactos en el ws1 y sólo **509** con una URL vigente: WhatsApp Web refresca la foto de un
  contacto cuando lo vuelve a sincronizar, no por pedirlo. El primer relleno copió **32** leads
  en el ws1 y **11** en el ws11 (1 falló). El cron diario copia las que se van refrescando, así
  que la cobertura crece de a poco y **no va a llegar al 100%**: el que nunca escribe nunca
  refresca. No es un bug del cron.
- **La clave es la línea, no el texto del teléfono.** `52·1·10` y `52·10` son el mismo celular
  mexicano (el 1 viejo de móvil), así que se canoniza antes de cruzar. Y si dos números
  DISTINTOS comparten los últimos 10 dígitos, esa clave se descarta entera: elegir uno pone en la
  ficha la cara de otra persona.
- **La descarga se acota**: `AbortSignal.timeout(8000)`, sólo `image/*`, hasta 2 MB. Una sola
  descarga colgada no puede llevarse el cron entero (tope de la ruta: 300 s, 200 fotos por
  workspace por vuelta).
- Se sube a `avatars/leads/<ws>/<lead>.jpg` con upsert y la URL lleva `?v=<ts>`: sin eso el
  navegador sigue mostrando la foto vieja después de un refresco.

### La cabecera del pop-up, y la regla «Ganado → Customer Success» (06/10/2026)

- **«Está todo amontonado»** era la columna derecha del pop-up: la ✕, el rótulo «Producto», dos
  desplegables y el aviso de datos sin marcar, apilados. Ahora la cabecera es cara + nombre + ✕, y
  abajo UNA fila: producto (con un ícono en vez del rótulo: `ProductoDelLead rotulo={false}`),
  etapa, y el aviso empujado a la derecha. Verificado en el navegador a 1440 y a 390 px: en el
  teléfono baja de renglón y el aviso queda a la derecha.
- **«Cuando un lead cae a Ganado, las reuniones que vienen van a Customer Success»** no pidió
  código: `esGrabacionDeEntrega` ya compara contra `fecha_cierre`, y `fecha_cierre` se escribe
  sola al pasar a Ganado (`lib/leads.ts`, la normalización de `cerro`). La regla de Martín y la del
  código son la misma. Sólo un ganado viejo no tiene la fecha.

### Lo que quedó SIN hacer

- **«Quitar de este producto», sólo para quien esté en más de uno**: hoy un lead vive en
  EXACTAMENTE un producto (`leads.funnel_id`) y `ProductoDelLead` lo MUEVE. Medido: una sola
  persona de todo el sistema figura en dos productos, y es porque tiene dos fichas (mismo teléfono,
  ws11). Para que el botón tenga a quién aplicarse hay que decidir el modelo: participación en
  varios productos (con el riesgo de que dos secuencias de nutrición le escriban a la vez) o tratar
  las fichas duplicadas de la misma persona como «está en dos». Lo decide Martín.
  ⚠️ **En Customer Success SÍ existe** (mig 0196, `cliente_entrega_fuera`): ahí un cliente puede
  estar en varios productos (su casa del CRM + filas de `cliente_entrega`) y el mismo pedido se
  implementó en esa pantalla. Lo que falta es sólo la versión del CRM.
- **Customer Success no pasa todavía `fotoGuardada`** a `useFotoContacto`: avisado el 06/10.

## Soltar una tarjeta adentro de su columna la deja ahí: el orden manual (06/10/2026)

**Vive en:** `app/crm/orden-kanban.ts` (puro, con test) · `app/crm/orden-actions.ts` ·
`lib/crm-orden.ts` · `app/crm/CrmBoard.tsx` (`handleDrop`, `reordenarColumna`) ·
`app/crm/CrmToolbar.tsx` (`OrdenFiltro`) · mig 0200

Síntoma (pedido de Martín, llegó por el chat de Customer Success): el hueco del arrastre seguía al
cursor también en la MISMA columna, y `handleDrop` cortaba con `effStage(lead) === stageKey`, así
que la tarjeta volvía a su lugar. **Un hueco que promete un lugar que no se respeta.** La regla de
Martín: «es como poner un ORDENAMIENTO dentro de filtros… volver a ordenar por fecha… y si quiero
volver a la posición que había dejado las tarjetas es simplemente quitar filtros».

- **«Manual» es la BASE cuando hay algo arrastrado**, no un filtro puesto: así «Limpiar» vuelve a
  las posiciones arrastradas y el número de «Filtrar» no cuenta lo que la persona misma armó. Y
  se CALCULA (`ordenElegido ?? base`, por embudo) en vez de inicializarse: con un `useState` fijo
  lo arrastrado desaparecía en cada F5 y el criterio de un embudo quedaba puesto en el otro.
- **Se guarda la columna ENTERA con un VECINO**, no un índice: con un filtro o el buscador puesto,
  «el tercero» de lo que se ve no es el tercero de la columna. Dónde cae y cómo queda la columna
  son la pieza de Customer Success (`app/customer-success/orden-manual.ts`), importada.
- ⚠️ **UNA DIFERENCIA A PROPÓSITO CON CUSTOMER SUCCESS: los que la lista no nombra van ARRIBA.**
  La lista se guarda entera al arrastrar, así que los únicos que no figuran son los que llegaron
  después. A una columna de entrega casi no entra nadie; al CRM entran leads todos los días, y al
  final quedaban enterrados debajo de la columna que alguien ordenó una vez.
- **`funnel_id` NULL es el embudo del negocio**, igual que en `leads`, así que el índice único va
  con `NULLS NOT DISTINCT` (Postgres 15+, prod corre 17.6). Sin eso el `upsert` no choca contra
  nada y cada arrastre en el embudo del negocio insertaría una fila nueva.
- **En otra columna, el lugar se guarda recién cuando el movimiento SE HACE** (los dos caminos:
  directo y tras la confirmación). Si se cancela, no hay lugar que respetar.
- ⚠️ **EL DIAGNÓSTICO PRESTADO NO APLICABA.** Customer Success midió en su editor de etapas que
  soltar con el cursor quieto sobre el hueco se perdía (0 de 2) y lo arregló cancelando el
  `dragenter`. En el CRM se midió antes de copiar el arreglo: **4 de 4 drops llegaron** con el
  cursor quieto sobre el hueco, así que no se agregó. Un arreglo sin un caso que lo muestre no se
  puede verificar, y deja código que nadie sabe por qué está.

### Lo que quedó SIN hacer

- **Las etapas con diálogo propio** (Nutrición - Manual, las de agenda) no guardan el lugar donde
  cayó la tarjeta: entra por fecha de llegada.
- **El CRM no arrastra un LOTE** (sólo una tarjeta), así que el orden manual tampoco.
- **Una etapa borrada deja su fila en `lead_orden`**: no molesta (se lee por etapa viva) y no se
  poda.

## Un lead en VARIOS productos: `lead_funnel` — «agregar», nunca «mover» (06/10/2026)

**Vive en:** `supabase/migrations/0207_lead_funnel.sql` · `lib/lead-funnel-reglas.ts` (puro,
con test) · `lib/lead-funnel.ts` · `app/crm/lead-funnel-actions.ts` ·
`app/crm/lead-view/ProductoDelLead.tsx` · `app/crm/CrmBoard.tsx` (`moverEnProducto`) ·
`app/crm/crm-map.ts` · `lib/leads.ts` (`listLeadsDeFunnel`, `agregadosDelTablero`) ·
`app/api/track/optin/route.ts` · `app/crm/campanas-actions.ts` · `lib/campana-traer.ts`

Síntoma (Martín, 06/10 15:28): «Le acabo de dar a un lead a "Mover a prueba" y se desapareció
del producto principal de Mauricio. Eso JAMÁS debe pasar». El lead (2381, ws1) además había
perdido la etapa: de «Agenda R2» a «Lead». Se devolvió a mano ese mismo día.

**Causa:** el modelo viejo era «un lead = una columna `leads.funnel_id`». Con eso, estar en dos
productos sólo se podía hacer de dos formas, y las dos rompían: MOVER (resetea la etapa y, en un
Ganado, le limpiaba la venta) o CLONAR (el opt-in con N productos creaba N fichas de la misma
persona: Calendly y Meta actualizaban sólo la más vieja, la nutrición le escribía N veces, las
métricas contaban doble y el CAPI mandaba un QualifiedLead por ficha).

**El modelo que quedó:**
- **La CASA** sigue siendo `leads.funnel_id` (NULL = el producto del negocio) + `pipeline_stage`.
  Métricas, CAPI, CRM automático, MaKo, nutrición, la etiqueta de WhatsApp y Customer Success
  leen SÓLO la casa. Es la decisión v1, y es lo que hizo posible cambiar el modelo sin tocar a
  ninguno de ellos.
- **Cada OTRO producto** es una fila de `lead_funnel` con la etapa de ESE tablero. Nunca hay fila
  para la casa.
- **Quitar la casa promueve la fila más vieja** (su producto y su etapa pasan a `leads`). No se
  deja la casa vacía con una marca de «fuera», como hace Customer Success: `funnel_id` lo leen la
  nutrición, las confirmaciones de MaKo, Customer Success y el dedup, y los cuatro lo seguirían
  tratando como de ese producto.
- **Mover la tarjeta de un agregado escribe sólo su fila**, sin abrir ningún diálogo: la nutrición
  manual, la agenda y las señales a Meta son del recorrido de la casa.

⚠️ **EL PRODUCTO DEL NEGOCIO SE ESCRIBE DE DOS FORMAS, Y SÓLO UNA LO ENCUENTRA EL TABLERO.** Como
casa va NULL (el tablero del negocio pide `.is('funnel_id', null)`); como fila va con su id real
(la FK no admite NULL). Escribir el id del default en `leads.funnel_id` deja al lead **fuera de
TODOS los tableros**, con el producto correcto escrito en la fila y sin un error. Ya lo hacían dos
caminos antes de este cambio (el desplegable de la ficha al «devolver» un lead y el rescate de
`eliminarFunnelDefinitivo`). Toda escritura de la casa pasa por `casaParaEscribir`; medido en el
navegador: quitar la casa 22 con el negocio como fila dejó `funnel_id = NULL`.

⚠️ **«ESTÁ EN ESTE PRODUCTO» ES POR CASA O POR FILA, y cada lector que lo pregunta tiene que mirar
las dos.** Se fueron encontrando de a uno: el dedup del alta (`enOtroProducto`, `choqueDeLead`),
«Traer de otro producto» (marca a los que ya están), el lote, la traída de campañas
(`leadsATraer`), la validación del orden manual (`orden-actions.ts`, que si no descartaba a los
agregados en silencio) y el conteo por etapa (`extrasDelEmbudoAction`: sin sumar las filas, una
etapa con gente agregada decía 0 y se borraba **sin preguntar**). El próximo lector que pregunte
«¿quién está en este producto?» por `leads.funnel_id` solo, mide la mitad.

**`getTenantDb()` es fail-open, y la 0207 lo sabía:** `lead_funnel` entró a `TENANT_TABLES` y a
`TABLAS_DE_INQUILINO` en el mismo commit que la tabla. Medido: la fila que creó el navegador nació
con `workspace_id = 4`, el del cliente que se estaba mirando.

### Tres cosas que salieron del mismo trabajo

- **`updateLead` le borraba la venta a cualquiera al corregir otro campo** (la entrada de arriba,
  «`updateLead` LE BORRA EL MONTO…»): la cura de fondo quedó HECHA. La decisión se mudó a
  `lib/lead-desenlace.ts` (pura, con test) y la coerción corre sólo si el caller tocó un campo que
  decide la venta. ⚠️ El diagnóstico obvio («sólo borra el monto») se quedaba corto: la regla vieja
  también le INVENTABA la fecha de cierre de hoy a un Ganado sin fecha en la siguiente corrección
  cualquiera, y le BLOQUEABA toda edición a un Ganado con monto ≤ 0 guardado por otro camino.
  ⚠️ Y la trampa: «tocó `estado_lead`» no es «lo cambió». `setPipelineStage` manda `estado_lead`
  en cada movimiento, así que mover entre dos etapas ABIERTAS (Facturando → Falta pago) sigue
  limpiando la venta. Decisión de Martín, abajo. El rescate local `montoEnRiesgo` quedó como red
  (reescribe los mismos valores) y su comentario dice por qué.
- **El CRM automático nombra las reuniones como el embudo** (`rotuloReunion`, cae a R1/R2), pero
  sólo en el TEXTO de la confirmación. ⚠️ El historial sigue escribiendo «Asistió R1» desde
  `AUDIT_FIELDS`, y `revertAuditChangeAction` deshace una línea buscando ESE literal
  (`REVERTIBLES`, `case 'Asistió R1'`). Si alguien pasa el rótulo del embudo a `AUDIT_FIELDS`, el
  «Deshacer» de esas líneas deja de funcionar sin un error. La clave anti-loop `T1:j1` tampoco se
  tocó (cambiarla re-propone las T1 ya resueltas del ws1).
- **Cómo se verificó:** en el navegador, sobre el ws4 con un producto de prueba que después se
  borró: agregar (antes «＋ / No está» y sin X; después X en los dos), arrastrar en el producto
  agregado (Lead → Facturando, la casa intacta, cero diálogos), quitar + deshacer (la fila vuelve
  con su etapa y su fecha de entrada), quitar la CASA (promueve) y el lote con su deshacer (borra
  sólo las filas que creó). Las trampas del entorno de esa verificación están en
  `docs/hallazgos-infra.md` → «Verificar en un worktree».

### Lo que quedó SIN hacer

- **Ganar en un producto AGREGADO no marca al lead como ganado.** Es la v1 a propósito (la casa
  manda), pero tiene una consecuencia de producto: si alguien compra el segundo producto, la venta
  no existe para Revenue, el CAPI ni Customer Success hasta que ese producto sea la casa. Decide
  Martín.
- **La casa de un opt-in con varios productos es el PRIMERO tildado** en la configuración de la
  landing. ¿Alcanza el orden, o hace falta marcar el principal? Decide Martín.
- **Mover entre dos etapas abiertas sigue limpiando la venta** (ver arriba): ¿se limpia sólo
  cuando el estado CAMBIA (Ganado → abierta)? Es una línea en `setPipelineStage`. Decide Martín.
- **El «Deshacer» de «Monto de cierre» sobre un lead abierto no hace nada**, porque el monto es un
  campo que decide la venta y el lead no tiene `cerro`. ¿El monto puede vivir en un lead abierto
  (como ya lo escriben `lib/pagos.ts` y el editor del deal)? Decide Martín.
- **Dos Ganados sin `fecha_cierre`** (uno en el ws1, uno en el ws13): antes cualquier corrección
  les ponía la de hoy; ahora no les inventa nada. Se completan a mano.
- **El camino del duplicado del opt-in no lleva los productos**: entra al negocio y una persona lo
  agrega desde la ficha. Falta `funnelIds` en `FilaImport` (`app/crm/leads-importar.ts`) y en el
  importador (`app/crm/actions.ts`).
- **`AGENTS.md` → «Un alta que pasa a crear N filas…» sigue citando el opt-in** como ejemplo
  medido, y ese código ya no existe. La regla sigue valiendo; falta la línea que lo diga
  (archivo compartido: se coordina antes).
- **Calendly (los 5xx que apagaban la suscripción) y la fuga de `dispararEvento`** (los flujos del
  ws1 corriendo con eventos de otros clientes) salieron de la misma corrida y los terminó la sesión
  de Chatbot: ver `docs/hallazgos-comunicacion.md`.

_Corrida del 06/10/2026: el núcleo lo escribió la sesión de claude1 y nueve agentes las pantallas;
la cuota se cortó a mitad de la verificación (4 de 9 devolvieron resultado). La integración, la
prueba en el navegador, el commit (`f26c0a94`) y esta cosecha los hizo la sesión de claude2._


---

## «Sin cobro»: el ticket promedio no está calculado en ningún lado (07/10/2026)

Pedido de Martín (06/10): los becados son un tipo de venta «Sin cobro» que da el monto por
contestado y no baja el ticket (`f6b33ed0`, #747).

**El diagnóstico obvio era el equivocado:** buscar «ticket promedio» para excluirlo encuentra un
solo lugar (`lib/queries.ts`, cash ÷ nº de pagos), que un becado no toca. El ticket de VENTA es
IMPLÍCITO: «Sold $X · N cierres» en /comercial y `ingreso_usd / ganados` en
`lib/metricas-negocio.ts` (y el costo por cierre de `analisis-negocio`). Lo que lo baja es el
CONTEO que viaja con la suma — un monto null suma 0, pero el cierre cuenta. **Excluir algo «del
promedio» es excluirlo del DENOMINADOR**; se busca por `monto_cierre_usd` + el filtro de ganados
(el barrido de `tests/venta-sin-cobro.test.ts`), nunca por la palabra.

- **Las suscripciones YA entran como cierres de US$0** en el Sold (su importe vive en
  `suscripcion_monto_usd`), contra lo que dicen las notas de la API de MaKo. Es la misma
  distorsión, previa. Decisión de Martín si una suscripción es un «cierre».
- **`.neq(col, x)` de PostgREST no devuelve las filas con `col` NULL** (NULL <> x es NULL). Sólo
  es seguro sobre una columna NOT NULL (`venta_tipo` lo es, mig 0116); en una nullable va
  `.or('col.is.null,col.neq.x')`.
- **Un campo de prefill se graba en los CUATRO constructores de `MoveLeadInfo`**
  (`app/crm/StageMoveDialog.tsx`): `ventaTipo` estaba declarado y ninguno lo llenaba, así que el
  wizard reabría siempre en «Pago único». Y el `placeholder` local entra en la UNIÓN de
  requeridos: una exención que sólo vive en `stepsForStage` no alcanza. Sigue sin llegar al
  tablero (`CrmLead` no trae `venta_tipo`).
- **Cuando una respuesta apaga la pregunta que la produce, la salida vive en otra pantalla**: con
  «Sin cobro» el paso del tipo de venta deja de mostrarse (ya no falta el monto), así que la
  respuesta era irreversible. Va «Quitar "Sin cobro"» en la ficha, con compare-and-set sobre el
  valor viejo.
- `venta_tipo` no está en `AUDIT_FIELDS` (`lib/leads.ts`): para «Sin cobro» se agregó un
  `logLeadEvent` explícito; las transiciones único ↔ suscripción siguen sin rastro.

## Lo que contestó en el formulario de Meta: legible, en el pop-up y en un WhatsApp que nace apagado (07/10/2026)

**Vive en:** `lib/meta-leads-campos.ts` (`preguntaLegible`, `respuestaLegible`,
`resumenRespuestas`) · `app/crm/lead-view/RespuestasFormulario.tsx` · `app/crm/LeadSheet.tsx` ·
`app/crm/[id]/page.tsx` · `app/crm/actions.ts` (`respuestasForm`) · `lib/variables-aviso.ts` +
`lib/variables-del-lead.ts` (`{{lead_formulario}}`) · `lib/avisos-catalogo.ts`
(`lead-formulario-meta`) · `app/api/webhooks/meta-leads/route.ts`

Pedido de Martín: «¿Qué necesitan Código Inmobiliario para sus clientes? Que NO tienen
Landing, sino que corren ads a formulario de Meta… Poder visualizar las rptas de ese form en
el detail del lead?».

⚠️ **EL DIAGNÓSTICO OBVIO («a Código Inmobiliario le faltan las respuestas») NO ERA.** Medido:
el ws13 tiene **cero** leads de formulario (47: 41 de landing y 4 de Cal.com). Los que corren
formularios son SUS clientes (`agencia_clientes`: ws15 y ws17): el ws15 tenía 4 leads de
`instant_form`, los 4 con dos preguntas propias. Y las respuestas ya se guardaban
(`leads.meta_field_data`, mig 0187) y la ruta `/crm/[id]` ya las dibujaba. Lo que faltaba eran
tres cosas, y ninguna era «guardarlas»:

1. **El pop-up del tablero no las dibujaba.** Sólo la ruta, y el tablero abre el pop-up: en el
   uso diario no se veían. Ahora es UNA pieza (`RespuestasFormulario`) en las dos puertas, y el
   pop-up las recibe resueltas del server (`respuestasForm`, `getLeadFullAction`), no lee el
   `field_data`.
2. **Meta manda la CLAVE, no el texto.** El `name` de una pregunta propia es su texto en
   minúsculas con guiones bajos («¿qué_tipo_de_propiedad_buscas_vender?») y una opción de
   selección también («una_casa»). La pregunta se devuelve con espacios y mayúscula; la
   respuesta, SÓLO si no tiene espacios (es una opción). ⚠️ **Lo que la persona tipeó queda
   como lo tipeó** («san telmo»): corregirle la mayúscula es afirmar algo que no escribió.
3. **El WhatsApp no podía salir bien de ninguna forma.** `lead-formulario-meta` no tenía
   `porDefecto` (nadie lo recibía; el ws1 además lo apagó a mano), y el webhook le pasaba el
   `texto` armado en código — así que lo que alguien escribiera en /chatbot **no se mandaba
   nunca**, y el texto de fábrica preguntaba «¿Le disparo la nutrición de bienvenida?» sobre un
   lead al que la línea siguiente ya inscribía. Ahora el webhook manda los DATOS (`lead` +
   `datos`) y el texto sale de la plantilla; con `aporta: ['lead']` el editor ofrece las
   variables del lead. **Nace apagado por decisión de Martín** («el whatsapp dejalo como
   borrador, no activado en chatbot»): prenderlo para todos le mandaría al ws1 un WhatsApp por
   cada uno de sus ~1.000 leads de Meta.

⚠️ **Y UN TOKEN SIN VALOR SALE CRUDO, A PROPÓSITO.** Es la regla del resolvedor («crudo se
nota»), y en un WhatsApp automático un `{{lead_telefono}}` crudo se lee como un mensaje roto.
Por eso el webhook dice lo que falta: «sin teléfono» y «Sin preguntas extra en el formulario.».
Verificado resolviendo el texto por el mismo camino que el motor (`getPlantilla` +
`referenciaResuelta`) sobre el ws4: cero tokens sin resolver, link con su `?ws=`, y el aviso
apagado.

### Lo que quedó SIN hacer

- **Prenderlo para los clientes que lo quieran** (ws15, ws17): desde /chatbot de cada uno.
  Decisión de Martín o de la agencia.
- **`lead-de-landing` tiene el MISMO defecto que tenía éste**: el opt-in le pasa el `texto`
  armado (`app/api/track/optin/route.ts`, el `emitirDelCatalogo('lead-de-landing'`), así que su
  texto tampoco se puede editar desde /chatbot.
- **Las respuestas del formulario de la LANDING no se guardan en el lead**: `body.respuestas`
  sólo arma el resumen del WhatsApp. La ficha de un lead de landing no las puede mostrar.
- ~~MaKo no las ve~~ **Resuelto el 08/10** (`ddfb07e8`): ahora `ficha_lead` trae
  `formulario_meta`. Antes, MaKo le contestó a Joan «en su ficha no hay detalles» sobre una
  respuesta que estaba guardada. La trampa, en `docs/hallazgos-api-mako.md` («Una herramienta
  con una lista cerrada de campos…»). Siguen sin verlo `reuniones_proximas`, `insight_lead`,
  `generar_insight` y el paso del chatbot.

_Hecho directo por la sesión de claude2 (`tests/meta-formulario-legible.test.ts`, probado
rompiéndolo: seis roturas, las seis caen)._

## La invitación al curso AL GANAR: el CRM decide cuándo, Customer Success invita (07/10/2026)

**Vive en:** `lib/crm-curso-al-ganar.ts` (`alGanarInvitarAlCurso`, el interruptor) ·
`lib/crm-curso-al-ganar-reglas.ts` (con test) · `app/crm/curso-al-ganar-actions.ts` ·
`app/crm/CrmBoard.tsx` (el «⋯» de la columna Ganado) · los tres enganches: `updateLead`
(`lib/leads.ts`), `saveLeadPlanManual` (`lib/pagos.ts`) y `moverEtapaEnProducto`
(`lib/lead-funnel.ts`) · la invitación misma: `invitarAlCursoSinSesion` (`lib/curso-invitar.ts`,
de Customer Success)

Pedido de Martín, por el chat de Customer Success: «poder automatizar la invitación al curso cuando
un lead cae a Ganado, así no se tiene que estar invitando manualmente... Pero que sea opcional».

⚠️ **«CAER A GANADO» NO ES UN SOLO CAMINO: SON TRES, y el obvio cubre uno.** `setPipelineStage`
termina en `updateLead`, y por ahí pasan el tablero, el wizard, MaKo, Customer Success y la página
de gracias. Pero `saveLeadPlanManual` escribe `estado_lead: 'ganado'` con un update directo (guardar
cuotas CIERRA el lead), y un producto agregado gana en `lead_funnel` sin tocar `estado_lead`. Los
tres llaman al mismo enganche, y los tres preguntan por la TRANSICIÓN (`pasaAGanado`): re-guardar un
ganado no es una venta nueva. Lo que se dejó afuera a propósito: el `revert` de una confirmación de
MaKo (`lib/mako-confirmaciones.ts`), que devuelve un estado y no vende nada, y `setBoardStageOverride`,
que escribe la columna y no el desenlace.

⚠️ **LA PRIMERA VERSIÓN COPIABA LA INVITACIÓN, Y ERA LA EQUIVOCADA.** Se armó con las piezas de
Customer Success (`linkDeAcceso`, `firmarAccesoCurso`, `invitarAlCursoPorEmail`, `marcarInvitacion`)
porque su única puerta era una action con sesión. En paralelo, Customer Success escribió la
invitación ÚNICA sin sesión, con lo que la copia no tenía: **el reclamo** (`reclamarInvitacion`,
compare-and-set, mig 0219). Sin él, dos de los tres caminos disparando en el mismo segundo —el wizard
gana y guarda las cuotas— leían «sin invitar» y mandaban dos mails. Ahora el CRM decide CUÁNDO y la
invitación es de ellos; `tests/crm-curso-al-ganar.test.ts` falla si vuelve a aparecer una pieza de
la invitación en el CRM.

- **El interruptor es por EMBUDO, nace apagado** (`crm.curso_al_ganar`, una lista de prendidos: lo
  que no está, no invita) y se lee **estricto al escribir**: con la base caída, `getSetting` da null y
  guardar «vacío + éste» apagaba en silencio los otros embudos. Se ofrece sólo en la columna Ganado y
  sólo si el producto tiene clases; prender lo exige el server también.
- **No es un `useState` sembrado de la prop**: el tablero no se desmonta al cambiar de embudo, así
  que se guarda lo que esta pestaña cambió CON su embudo y gana sólo sobre ése.
- **Apagado cuesta una lectura de un setting** y sale; prendido, va por detrás (`after`) y deja SIEMPRE
  una línea en el historial con actor MaKo (`lineaDelCurso`): «ya estaba invitado» y «no corrió» no
  pueden verse iguales en la ficha.

⚠️ **UN TEST QUE RECORTA EL FUENTE ENTRE DOS ANCLAS DECIDE DÓNDE SE PUEDE ESCRIBIR.** El enganche se
puso primero entre el bloque del CAPI de calificado y la etiqueta de WhatsApp, y
`tests/meta-capi-lead-id.test.ts` (que recorta exactamente ese tramo y exige que mida < 2.500) cayó.
No era un bug del test: es su forma de decir «esto es el CAPI y nada más». El bloque se mudó después
de la etiqueta.

### Lo que quedó SIN hacer

- **No se mandó un mail de verdad**: ningún workspace de prueba tiene curso (ws3 y ws4 sin producto
  con clases). La cadena se verificó en el ws4 con la invitación real de Customer Success
  (1080f74c): página de gracias → Ganado → enganche → «No lo invité al curso: sus productos no tienen
  clases» en el historial. El primer mail real sale el día que alguien lo prenda en un cliente.
- **Las pantallas no se miraron en el navegador** (el interruptor del «⋯» de Ganado): un servidor
  local con la máquina al 96% de CPU no contestó, y el CRM del ws1 tardó 7 minutos contra la base de
  producción. Cubierto por typecheck y tests.
- **Hubo una ventana con dependencia cruzada**: este commit importa `lib/curso-invitar.ts`, y se
  retuvo hasta que Customer Success lo publicó. Lo que lo ordenó fue avisarse por mensaje entre
  sesiones; nada del repo lo habría frenado antes del build.
- **Un lead que gana en un producto AGREGADO no se invita**: Customer Success contesta `no-ganado`
  porque su cartera sale de `estado_lead`, que en un agregado no cambia. Es coherente con la ficha de
  CS (no lo ve como cliente), y queda en el historial.

_Hecho directo por la sesión de claude2 (`tests/crm-curso-al-ganar.test.ts`, probado rompiéndolo:
diez roturas, las diez caen)._

## «Completar datos» devolvía al lead a la etapa de antes: la ficha del tablero es una FOTO (08/10/2026)

**Vive en:** `app/crm/LeadSheet.tsx` (`releer`, `FichaCambioProvider`) · `app/crm/lead-view/ficha-cambio.tsx`
(`useRefrescarFicha`) · `app/crm/actions.ts` (`completeStageMoveAction`, paso 5, `soloCompletar`) ·
`app/crm/StageMoveDialog.tsx` · `lib/lead-funnel.ts` (`quitarDeProducto`, `deshacerQuitar`)

Feedback de Leila (ws11): «3 veces lo moví a conversación abierta y hace loop, además lo moví al
embudo de empresa y le cargué el nombre de la empresa», y en un audio: «Guardar. Ya estoy guardando. Y
me dice sin empresa… si cierro la conversación… ahora sí me dejó».

⚠️ **EL DIAGNÓSTICO OBVIO («no guarda la empresa» / «la etapa pide la empresa y frena») NO ERA.** La
empresa se guardó bien, en la misma columna que se valida, y «Conversación abierta» no tiene ningún
requisito que frene (la empresa es higiene: se pide y nunca bloquea). Lo que pasó lo dice el
historial: el #2608 tiene tres «Etapa conversando → lead» de Leila, la primera seguida 1 s después
por «Empresa null → Celis…». Ésa es la firma de `completeStageMoveAction` con `to = 'lead'`:
`saveLeadMeta` guarda la empresa sin auditar, `setPipelineStage` mueve a la etapa VIEJA y audita la
Etapa, y recién al final `logLeadChanges` audita la Empresa.

- **La causa: el pop-up de la ficha es una foto.** `getLeadFullAction` la trae al abrir y el
  `router.refresh()` de cada tarjeta refresca el tablero de atrás, no el estado de cliente del pop-up.
  Con la foto vieja, la cabecera sigue diciendo «Sin empresa» y «1 sin marcar», y «Solucionar» abre
  «Completar datos» con `to` = la etapa de ANTES de moverlo. Empezó con a000a28f (05/10), cuando
  «Solucionar» pasó a resolverse dentro del pop-up en vez de navegar a la ruta, que sí se refresca.
- ⚠️ **Y no era sólo un loop: des-ganaba.** El #2605 perdió el Ganado 25 minutos por el mismo camino
  (movido a Ganado desde el desplegable, después «Solucionar» → Guardar con la etapa vieja).
- **El arreglo va en las dos capas.** El server: «Completar datos» manda `soloCompletar` y NO llama a
  `setPipelineStage` (sólo sincroniza el monto de un Ganado); lo pendiente se mide en la etapa donde
  quedó. Así ninguna pantalla vieja —una pestaña olvidada incluida— puede mover un lead al
  completar. La pantalla: la ficha se relee después de cada escritura; las tarjetas que guardan avisan
  por `useRefrescarFicha`, que es el choke point de «la ficha cambió» (un contexto, porque las mismas
  tarjetas viven en la ruta, donde no hace falta). `tests/ficha-se-relee.test.ts` falla si una tarjeta
  vuelve a llamar `router.refresh()` suelto.
- ⚠️ **NO SE RESOLVIÓ «MOVIENDO A LA ETAPA ACTUAL».** Era la salida que aparecía primero y la
  refutación la tumbó: «la etapa actual» sale de las etapas del funnel por defecto (`getFunnelDeLead`
  ignora `lead.funnel_id`), y en un embudo con claves propias deriva otra y movería al lead; además,
  sin `deadline`, `setPipelineStage` le borra el plazo a uno en nutrición manual.

⚠️ **QUITAR LA CASA NO SINCRONIZABA EL DESENLACE.** `quitarDeProducto` promovía la fila escribiendo sólo
`funnel_id` + `pipeline_stage`: con la fila en «Ganado», la tarjeta quedaba en Ganado con
`estado_lead = abierto`, fuera del revenue (el #2605, de 05:32 a 05:47). Ahora, si la etapa promovida
es un desenlace, el estado la sigue por `updateLead` y el deshacer lo devuelve.

### Lo que quedó SIN hacer

- **Quitar el producto donde GANÓ**, con la otra fila abierta: el estado no se toca a propósito
  (updateLead con «abierto» borra el monto y la fecha de cierre de esa venta). Queda una tarjeta en una
  etapa abierta con el lead ganado. Es una decisión de Martín: ¿sacar el producto donde se vendió
  des-gana al lead?
- **`getFunnelDeLead` devuelve siempre el embudo DEFAULT** (`lib/funnels.ts`), aunque el lead viva en
  otro: la ficha evalúa y muestra las etapas del principal. En ws11 las claves coinciden y no rompe;
  en un embudo con claves o reuniones distintas, los requisitos y el selector de la ficha estarían mal.
- **El tablero también guarda una foto** (`localStage` en `CrmBoard.tsx`, que no se limpia al
  refrescar). El server ya no deja que eso mueva a nadie al completar, pero lo que se ve puede quedar
  viejo.
- **La pantalla no se miró en el navegador** (la máquina no daba). Cubierto por el guard y por la
  prueba de `quitarDeProducto` contra la base en el ws4.

_Hecho directo por la sesión de claude2 sobre el diagnóstico de un workflow de 4 lectores + 4
refutadores (`tests/ficha-se-relee.test.ts`, nueve roturas, las nueve caen)._

## Ganado: el wizard «puso el monto que se le cantó» y la tarjeta decía $0 — sí lo había guardado (08/10/2026)

**Vive en:** `app/crm/StageMoveDialog.tsx` (lectura del contrato, paso del monto, placeholder de
requisitos) · `lib/venta-tipo.ts` (`montoDeTarjeta`, `suscripcionDeFila`) · `app/crm/crm-map.ts` ·
`app/crm/CrmBoard.tsx` · `lib/leads.ts` (`AUDIT_FIELDS`) · `app/crm/[id]/deal-actions.ts` +
`DealDetailsCard.tsx`

Feedback de Leila (ws11), sobre «Revisa y confirma» con «Suscripción: $4,235.29/mes · 12 meses»:
«aquí no me preguntó cuánto es, puso el monto que se le cantó jaja», y con la tarjeta en $0: «y ni
siquiera lo guardó».

⚠️ **EL DIAGNÓSTICO OBVIO («no lo guardó») ERA EL EQUIVOCADO.** Se guardó, en `suscripcion_monto_usd`
(Nadia 4.235,29, Fabi 444), y la tarjeta leía `monto_cierre_usd ?? 0`, que en una suscripción queda
NULL a propósito. Regla: la plata de un cierre se lee con `montoDeTarjeta` / `suscripcionDeFila`,
nunca con el monto de cierre pelado. Medido: en ws11, 5 de las 9 suscripciones ganadas dibujaban $0.

- **De dónde salió el número:** el lector de contratos devolvió el TOTAL (12.000 MXN/mes × 6 =
  72.000 MXN / 17 = 4.235,29) y `ok.add('monto')` sacó el paso de la lista: nunca se preguntó. Al
  elegir suscripción, ese total pasó a ser la MENSUALIDAD.
- ⚠️ **`ok.add(paso)` hace dos cosas: esconde la pregunta Y manda el valor aunque el server no lo
  pida.** Así una lectura del contrato pisaba una mensualidad ya cargada. Lo que viene de una IA o de
  un documento se PRECARGA, sin `ok.add`, y sólo si el paso se pide. (Excepción a propósito: el plan
  de cuotas, que mostrado traba «Siguiente» por `cuotasCuadran`.)
- **Los meses del contrato no son el plazo de la suscripción**: en el de Nadia eran la implementación y
  seguía a 10.000 MXN/mes. La mensualidad se SUGIERE (total/meses, un botón), nunca se precarga, y el
  plazo tampoco.
- ⚠️ **El placeholder de requisitos del wizard es la 4ª copia de `valoresDeRequisitos`**, y entra
  siempre en la unión de lo que se pide: sin `suscripcionMonto`, reabrir una suscripción pedía el monto
  vacío y «Guardar y completar después» escribía NULL encima de la mensualidad.
- El historial no registraba la suscripción (`AUDIT_FIELDS`), y Deal Details no la dejaba editar:
  ahora sí, con su línea «de cuánto a cuánto».

### Lo que quedó SIN hacer

- **Los datos de ws11 los corrige Leila** (ficha → Pagos → «Editar deal»): Nadia dice 4.235,29/mes
  (lo real ≈ US$705,88) con 12 cuotas de 4.235,29 (US$50.823) pendientes, que hoy inflan el MRR de
  ws11 un 85%; Fabi, ¿444 USD o pesos? Y #1791, #1850, #2344 y las de monto viejo de 40.
- `undoStageMoveAction` repone el monto de cierre pero no la suscripción. Siguen dando $0 para una
  suscripción: el subtítulo del recorrido (`lib/journey.ts`), `lib/objectives-fuentes.ts`,
  `lib/metricas-negocio.ts`, `lib/lead-insights.ts` y el Sold de /comercial (ya anotado).
- El prompt del lector (`CONTRACT_EXTRACT_DEFAULT`) sigue devolviendo el total convertido a ~17.

_Hecho por un agente en worktree propio sobre el diagnóstico refutado (`tests/ganado-monto.test.ts`,
trece roturas, las trece caen); probado en el ws4 con un lead de prueba borrado después._

## «+ Agregar al CRM» desde WhatsApp metía a todos en el embudo principal (08/10/2026)

**Vive en:** `app/whatsapp/_shared/BotonAgregarAlCrm.tsx` · `app/whatsapp/page.tsx` ·
`WhatsAppApp.tsx` · `EmpresaInbox.tsx` · `OnboardingCanalWhatsApp.tsx` · `app/crm/actions.ts`
(`crearLeadDesdeWhatsappAction`) · `lib/lead-funnel-reglas.ts` (`nombreVisible`) · `lib/funnels.ts`
(`leerFunnels`)

Feedback de Leila (ws11): «ella está en marca personal. Primero de por sí me entra al funnel
principal, o sea que la tengo que eliminar de funnel principal». Medido: los 6 leads que nacieron por
ahí (todos ese día) nacieron en el principal, y a los 6 los agregó a mano a otro producto entre 12 y
16 s después; a 4 los sacó del principal. Ahora, con 2 o más productos, el clic abre la lista y el
lead nace en el elegido; si ya existía, se lo AGREGA a ese producto.

- ⚠️ **«No pude leer» se volvía «hay uno».** `listarFunnels` devuelve `[]` ante un error: una pantalla
  que pregunta sólo con 2+ productos volvía al bug justo cuando la base fallaba, y el server decía «Ese
  producto no existe.» sobre un id válido. Quien tiene que distinguir el fallo usa `leerFunnels`
  (null = falló). La red de verdad es el server: sin producto elegido, relee y con 2+ no crea.
- ⚠️ **El segundo montaje**: `OnboardingCanalWhatsApp` monta `<WhatsAppApp />` sin props. Con la prop
  opcional ese camino la perdía en silencio: una prop que cambia qué se escribe en la base va
  OBLIGATORIA, y el compilador encuentra los montajes.
- **La regla del nombre de un producto estaba copiada en 11 lugares** (dos sin el trim). Ahora es
  `nombreVisible`, y un test barre app/ y lib/. Candidata a la tabla «Una cosa, un lugar» de AGENTS.md.

### Lo que quedó SIN hacer

- `agregarAProducto` y `productosCrm` siguen validando con `listarFunnels` (con la lectura caída dicen
  «no existe»). `OnboardingCanalWhatsApp` tampoco pasa `puedeChatbot`/`mostrarOficial`/
  `puedeAgregarLinea` (ya pasaba antes). Nora (#2610) y Fabi (#2606) siguen en los dos productos: lo
  decide Leila. No se miró en un navegador.

_Hecho por un agente en worktree propio (`tests/inbox-agregar-al-crm.test.ts`, doce roturas, las doce
caen); la escritura, probada en ws3 con un embudo temporal borrado después._

## Las etiquetas del CRM: el lote, el espejo con las etapas y lo que archivar promete (08/10/2026)

**Vive en:** `lib/etiquetas.ts` · `lib/etiquetas-motor.ts` · `lib/etiquetas-reglas.ts` · `lib/leads.ts`
(`setPipelineStage`, `setBoardStageOverride`, `updateLead`, `upsertLeadFromCalendly`,
`espejarEtiquetasDeEtapa`, `COLS_ETAPA_PREVIA`) · `lib/lead-funnel.ts` (`moverEtapaEnProducto`) ·
`app/crm/actions.ts` (`moverLeadsDeEtapaAction`) · `app/crm/EditorEtiquetas.tsx` ·
`app/crm/EtapasModal.tsx` · `app/crm/AccionesLoteLeads.tsx` · `app/crm/lead-view/EtiquetasDelLead.tsx` ·
`app/_components/etiquetas-cliente.tsx` · `app/api/cron/crm-automatico/route.ts` ·
`lib/email-marketing.ts` · `lib/datos-mau.ts` · `lib/clonar-config.ts` ·
`supabase/migrations/0224_crm_etiquetas.sql`

Punto 12 del pedido de Martín del 08/10/2026 (literal en `docs/chatbot-flujo-ramas-diseno.md`): un
CRUD de etiquetas, vinculables a etapas, que sirvan en las condiciones, disparen automatizaciones y
se espejen en WhatsApp y en Chatwoot. Lo de WhatsApp y Chatwoot está en
[hallazgos-comunicacion.md](hallazgos-comunicacion.md); el disparador del lado del motor, en
[hallazgos-chatbot.md](hallazgos-chatbot.md).

### ⚠️ El lote disparaba por la puerta de atrás

**Síntoma:** la regla era «una acción en lote no dispara automatizaciones», y `ponerEtiquetaLote` no
disparaba. Igual, mover 200 leads a una etapa vinculada desde la barra de lote habría disparado la
automatización de la etiqueta 200 veces, por la línea no oficial del cliente.

**Causa:** ⚠️ «basta con no disparar en el lote de etiquetas» era el diagnóstico equivocado. El
movimiento de etapa en lote (`moverLeadsDeEtapaAction` → `setLeadStageAction` → `setPipelineStage`,
de a uno) no sabe que es un lote: pasa por el gancho de la etapa, que pone la etiqueta vinculada como
si la hubiera puesto una persona. Y la revisión encontró la segunda puerta: el barrido horario
inscribía después a todos los que tenían la etiqueta, la hubiera puesto quien la hubiera puesto.

**Regla:** la etiqueta que pone una ETAPA (origen 'etapa') nunca dispara ni vuelve a mover: el evento
de ese movimiento es la etapa, que tiene su propio disparador. Sólo dispara un poner directo (la
ficha, la API, un paso «⚡ Acción»). Y sin horario, el disparador por etiqueta es sólo el evento
(`barridoInscribe`, en hallazgos-chatbot.md). Antes de afirmar «esto no dispara» se enumeran TODOS
los caminos que escriben la tabla del disparador, no sólo el que se está mirando. Es una decisión
del constructor; Martín la puede dar vuelta.

### El espejo etapa↔etiqueta es de TRANSICIONES, con foto: un barrido que impone deshace decisiones

**Síntoma:** el espejo sólo corría en los movimientos explícitos (`setPipelineStage`,
`setBoardStageOverride`, `moverEtapaEnProducto`). Agendar por Calendly, marcar asistencia o ganar
desde la ficha mueven la etapa DERIVADA sin escribirla, así que «Agendó» no se ponía nunca y la
etiqueta de la etapa anterior quedaba para siempre.

**Causa:** la etapa que se ve es `pipelineStageOf`: el override o la derivada de las fechas. Nadie
llamaba al espejo cuando cambiaba la derivada.

⚠️ **El arreglo obvio era el equivocado:** un barrido que, por cada etiqueta vinculada, se la pone a
los que están en su etapa y se la saca a los que no, deshace decisiones de personas (una vinculada
que alguien sacó a mano vuelve en una hora; la que se puso sobre un lead que no se pudo mover
desaparece) y contradice el contrato «cambiar el vínculo vale de aquí en adelante»: vincular
«Cualificado», puesta a mano a 300 leads, se la sacaría a todos los que no están en esa etapa.

**Regla:** el espejo mira TRANSICIONES. Los ganchos van en `updateLead` y en `upsertLeadFromCalendly`
(comparan la etapa vista antes y después), y el barrido del cron (`conciliarEspejoEtapas`, en el
crm-automatico) compara contra una FOTO de la etapa vista la vez anterior (`app_settings`
'etiquetas.espejo.etapas', por workspace):

- la primera corrida es línea de base y no toca nada;
- una clave nueva cuenta como entrada sólo en un producto que ya se miraba;
- la foto se fecha DESPUÉS de aplicar, o el historial del propio barrido se lee como una persona que
  tocó.

Y la etapa que el lead DEJA se lee de `pipelineStageOf(antes)`, no de `pipeline_stage`, que en la
mayoría de los leads es NULL (`COLS_ETAPA_PREVIA`). `setPipelineStage` espeja dos veces la misma
transición (manda el desenlace por `updateLead` y después espeja él): la idempotencia del motor
corta y no deja historial de más. Un flag `espejarEtiquetas: false` no hace falta, y rompía la guarda
de `updatelead-no-borra-venta`, que fija `await updateLead(id, sync)`.

Límites del barrido, sin medir contra datos reales: reconoce lo que tocó una persona por el NOMBRE
en `lead_audit` (una etiqueta renombrada entre corridas se espeja igual), y ningún test lo ejecuta
(lo cubren `planEspejo`, que es puro, y guardas de fuente).

### Un flag que atraviesa capas sin salir del server va por AsyncLocalStorage

**Síntoma:** mover 200 leads de etapa en lote sincronizaba cada etiqueta espejada con WhatsApp y
Chatwoot (el espejo de mensajes, Evolution y tres llamadas a Chatwoot por lead) adentro de una server
action con `maxDuration = 60`: el lote se cortaba a la mitad sin devolver el conteo.

**Causa:** el flag de lote no llegaba al espejo.

⚠️ **Pasarlo como parámetro de `setLeadStageAction` era el arreglo equivocado:** es una server action
exportada, así que el parámetro queda expuesto al navegador, y rompía las guardas que fijan «el lote
pasa por el MISMO `setLeadStageAction`».

**Regla:** un flag que tiene que atravesar varias capas sin cambiar firmas ni salir del server va por
AsyncLocalStorage, como `wsStore` (`conLoteDeEtiquetas`, `loteStore`). Lo hereda todo lo que el lote
toque, incluido el espejo de `updateLead`. La sincronización diferida tiene UN tope global (40), deja
rastro en el historial de los que no se pasaron («eran más de 40 a la vez») y corre también si el lote
se corta.

### El dedup de una copia normaliza como el índice único de la tabla

**Síntoma:** copiar las etiquetas en «Completar con los datos de Mau» con `dedupPor: 'nombre'` hacía
caer el ámbito entero. Y las copias al workspace de prueba no traducían los ids de etiqueta de los
pasos (las condiciones y `accion.params.etiquetaId`) ni la columna `etiqueta_id`: en el ws3 la
condición nunca se cumplía y el disparador no corría.

**Causa:** `crm_etiquetas` es única por `lower(btrim(nombre))` entre las VIVAS, y
`nutricion_secuencias.clave` es única incluso con archivadas: un dedup exacto choca con el índice en
un caso y en el otro reusa una clave. Y `remapearJson` sólo mira las claves de primer nivel de cada
paso.

**Regla:** el dedup de una copia normaliza igual que el índice único de la tabla y declara por tabla
si mira sólo las vivas (`normalizarDedup`, `dedupEntreVivas`). Las etiquetas se copian ANTES que las
secuencias (sin la copia no hay mapa viejo→nuevo) y se traducen las tres referencias; lo que no está
en el mapa queda en null.

### Un segmento de email que no existe no se guarda ni se manda: tira

**Síntoma:** un segmento que el validador no conocía se guardaba como «activos», y el envío le
escribía a todos los activos (1.044 en el ws1) sin un error. Con las etiquetas, un `etiqueta:<id>`
le habría escrito a todos. Y /email ofrecía «Se le puso una etiqueta» sin elegir cuál: la secuencia
quedaba activa y muda para siempre.

**Causa:** tres caídas silenciosas: `crearBroadcast` hacía `esSegmentoValido(x) ? x : 'activos'`,
`actualizarBroadcast` ignoraba el inválido y `filtroSegmento` tenía `case 'activos': default:`.

**Regla:** un segmento inválido tira (`validarSegmento`). El de etiqueta se resuelve ANTES de
`filtroSegmento`, contra `crm_lead_etiquetas`, paginando en las dos puntas. Un disparador por etiqueta
sin etiqueta no se guarda (va por `setTriggerSecuencia`, que la exige), y /email manda el disparador
sólo si CAMBIÓ: reenviarlo en cada guardado frenaba guardar el texto cuando la etiqueta se había
archivado en el medio.

### Archivar apaga, y el texto dice lo que hace

**Síntoma:** archivar una etiqueta prometía «las condiciones que la nombran dejan de cumplirse», y el
motor las seguía cumpliendo para los leads que ya la tenían (y el barrido los seguía inscribiendo):
el dueño decidía con un dato falso. Y el selector de un paso que la usaba quedaba en «Elige una
etiqueta», sin decir a cuál apuntaba.

**Causa:** archivar sólo escribe `archivada_at` (nunca se borra: lo que la nombra apunta a su id), y
`hechosDeLeads` y `leadsConEtiqueta` no lo miraban.

**Regla:** se eligió una sola verdad: archivar APAGA (el motor saca las archivadas con
`etiquetasQueCuentan`, `lib/nutricion-grafo-motor.ts`), y el texto de `archivar_etiqueta` y de
`usoTexto` lo dice. Un selector cuyo valor elegido está archivado lo pide y lo muestra «Nombre
(archivada)»; el lienzo pide `?archivadas=1`.

### Trampas menores

- **`tests/nutricion-etapa.test.ts` exige que `setBoardStageOverride` mida menos de 4000 caracteres,
  comentarios incluidos**, y con el gancho medía 5149. Lo nuevo de esa función va como helper AFUERA
  de su bloque, y el porqué largo va al docblock del helper (`espejarEtiquetasDeEtapa`). Quedan unos
  90 caracteres de margen.
- **Un count con `head: true` sobre `crm_etiquetas` sin la 0224 contestó 204, `count: null` y sin
  error**: no prueba que la tabla exista (ver [hallazgos-infra.md](hallazgos-infra.md)).
- **`funnel_id` NULL en el vínculo a una etapa es el producto del NEGOCIO**, igual que en
  `leads.funnel_id`, y no «la casa de cada lead» como decía el diseño. Escrito en la 0224 y en
  `lib/etiquetas.ts`.
- **Poner una etiqueta vinculada NO mueve al lead en tres casos**, y cada uno queda en su historial:
  la etapa es un cierre (pide monto o motivo), el lead ya está cerrado en su casa, o el lead no está
  en ese producto.
- Los chips de la ficha se releen cuando otro control cambia la etiqueta (mover de etapa), y
  `etiquetas_lead` por HTTP ya no manda el email de quien la puso en `puesta_por`.

### Lo que quedó SIN hacer

- **Aplicar la 0224 ANTES del deploy**: el código nuevo lee las dos tablas.
- **Correr una vez `sincronizar_etiquetas_whatsapp` en el ws1** (escribe en prod). Hoy el CRUD ofrece
  para mapear las 5 etiquetas basura del 11/09 (ALQUILER, LALALALA, PAP, Molestar en Marzo,
  Importante); la sincronización nueva poda las que ya no están en el celular.
- **No espejan etiqueta↔etapa**: `agregarAProducto` y `quitarDeProducto`, el rescate al borrar un
  producto (`lib/funnels.ts`), el webhook de Chatwoot y el bloqueo de un contacto, que escriben
  `pipeline_stage` directo.
- **`EtapasModal` no avisa cuántas etiquetas apuntan a una etapa** antes de borrarla o renombrarla:
  un vínculo a una key que ya no existe se descubre al usarlo («la etapa ya no existe» en el
  historial). `app/crm/EtapasModal.tsx`.
- **`usoDeEtiqueta` no cuenta los flujos de /mensajes** (viven en el store de plantillas): un paso
  «⚡ Acción» de un aviso que pone la etiqueta no se cuenta antes de archivarla. `lib/etiquetas.ts`.
- **Sacar una etiqueta no cierra lo pendiente de las secuencias que disparó** (es del motor, como
  `cerrarEntregaDeEtapa`).
- **`reclamarEspaciado` deja una fila de `app_settings` por cada par (etiqueta, lead) que disparó**
  (`mako.aviso.last.etiqueta:<id>:<hash>`), y nadie la limpia.
- **Las copias, lo que falta**: `lib/clonar-config.ts` copia `mako.plantillas.store` tal cual (los
  «⚡ Acción» de /mensajes conservan el `etiquetaId` del dueño), y ninguno de los dos clonadores
  traduce el `funnel_id` de las condiciones de etapa ni `ir_a.destino.secuencia_id`.
  `lib/clonar-config.ts` (`KEYS_COPIABLES`) · `lib/datos-mau.ts`.
- No se miró en un navegador el selector «(archivada)», los chips releídos ni el selector de /email.

_08/10/2026, cuenta 2. Parte E de la corrida `wf_8096a9d7-b3f` (`f92559e0`), revisión
`wf_c1c0d3d3-ae3` (etiquetas-1 a 6, datos-1 a 7) y arreglos `wf_92e4c306-856` (`3f3aadd8`)._

## El CRM entra directo: una decisión más nueva de Martín le gana a «onboarding en toda tab» (08/10/2026)

**Vive en:** `app/crm/page.tsx` · `lib/tab-activacion.ts` (`TABS_ACTIVACION.crm`) ·
`tests/crm-entra-directo.test.ts`

Martín, en el audio del feedback del curso: «vos actualmente en el CRM tenés como el pre
onboarding del CRM, yo lo que quiero hacer es quitar eso… tengo que quitar toda la fricción
que hay en el CRM y que se entre automáticamente». El que probaba dijo: «no entiendo nada,
siento que es mucho texto también».

⚠️ **Choca con una regla vieja suya, y gana la nueva:** «onboarding en toda tab». El panel no
se borró del todo. Lo que decía (qué conectar para que los leads entren solos) sigue en
`TABS_ACTIVACION.crm`, y MaKo lo contesta si se lo preguntan (`ver_activacion_tab`). Se fue la
pantalla que frenaba, no el dato. El test fija las dos cosas: que la página no ponga ningún
panel delante y que la entrada `crm` siga existiendo.

**Lo que quedó SIN hacer:** no se miró en un navegador el CRM de un workspace sin nada
conectado. Ahora entra a un tablero vacío, y ese tablero no dice qué conectar.

_08/10/2026, cuenta 2, sin subagentes. Commit `713661d7`._

## Migrar desde otro CRM: lo que esconde la doc de cada API, y lo que le falta a nuestro importador (08/10/2026)

**Vive en:** `docs/migracion-crm.md` (la investigación completa, con las URLs) ·
`app/crm/leads-importar.ts` · `app/crm/actions.ts` (`importarLeadsRevisadosAction`) ·
`lib/leads.ts` (`createLead`)

Lo pidió Martín en el audio del feedback del curso: «averiguar cuáles son esas plataformas… de CRM
conocidas, averiguar si tienen API… con un botón podés empezar la migración en lote». Es sólo
investigación, para que él decida antes de construir.

- ⚠️ **«Tiene API» no quiere decir «trae las conversaciones».** De los 12 CRMs, sólo GoHighLevel
  entrega por token los mensajes de WhatsApp, SMS, email e Instagram. Kommo, el más usado para
  vender por WhatsApp en LatAm, **no entrega su historial de chats**: la Chats API sólo lee un
  canal que registra su soporte, nunca el WhatsApp que el cliente ya tenía conectado.
- ⚠️ **Varios conectan con un token pegado, pero el token sale de «crear una integración
  privada»** (GHL, Kommo, HubSpot). Si eso choca o no con «el cliente nunca crea una app», lo
  decide Martín. Sólo Pipedrive (app privada por link, sin revisión) y HubSpot (OAuth de MaKo,
  hasta 25 cuentas) cumplen la regla al pie de la letra.
- Trampas de la doc: Pipedrive devuelve los campos personalizados como hashes de 40
  caracteres; RD Station corta cada consulta en 10.000 registros; monday deja 1.000 llamadas por
  día en sus planes baratos; Zoho separa las cuentas por región y sólo un admin lee las notas;
  la API de Clientify es un addon pago.
- ⚠️ **Nuestro importador sirve para cargar una lista, no para migrar un CRM.** Medido en el
  código: `createLead` no recibe la fecha de creación, así que 10.000 leads viejos entrarían
  como «leads de hoy» en las métricas. Tampoco hay columna para el id del CRM de origen, y
  ninguna automatización (`lib/nutricion*.ts`, `lib/crm-auto*.ts`) lee `origen_lead`, así que
  nada impide que un lead importado reciba mensajes. Además, la action corre una fila por vez
  con el tope de 60 s de `/crm`. La migración tiene que ir por tandas que se retoman solas (el
  molde es `lib/onboarding-extract.ts`), no por esa action.

**Lo que quedó SIN hacer:** todo lo de construir. Las cuatro decisiones de Martín están arriba de
`docs/migracion-crm.md`: el token de una integración privada, si los leads entran quietos, las
conversaciones y la fecha original. Tampoco se sabe qué CRM usan de verdad nuestros clientes.

_08/10/2026, cuenta 2, con un subagente de investigación (sólo web y lectura del repo)._

## «Es una reunión»: marcar una etapa cambia requisitos, transiciones y DÓNDE se lee la fecha (09/10/2026)

**Vive en:** `lib/etapa-reunion.ts` · `app/crm/actions.ts` (`editarEtapaAction`, op `reunion`) ·
`app/crm/EtapasModal.tsx` (`BotonReunion`, `marcarReunion`) · `tests/etapa-reunion.test.ts`

Martín, por el chat de Chatbot: «dentro del editor de etapas en el CRM, debería poder
seleccionarse qué etapas hacen referencia a una REUNIÓN». El Chatbot deja de decir R1/R2 y su
condición «Asistió / No asistió» va a ofrecer sólo las etapas marcadas, leyéndolas con
`reunionesDe`. Hasta ahora `kind: 'reunion'` sólo lo ponía `generateFunnel` al armar un embudo de
plantilla: un negocio que armó el suyo a mano no tenía cómo marcarla.

⚠️ **No es sólo la pantalla.** Medido en ws3 desmarcando «Agenda R2»:
- el nivel de requisitos de Facturando bajó de 4 a 2 y el de Ganado de 5 a 3, porque
  `funnelReqInfo` cuenta las reuniones;
- `generateFunnel` sacó 6 transiciones: el no-show de la R2, «asistió, no compró», y perdido y
  descalificado desde la R2;
- volver a marcarla dejó el embudo idéntico, con las demás etapas intactas.

Marcar la primera reunión de un embudo hace que los leads de Facturando y Ganado empiecen a
pedir la fecha y la asistencia de la reunión 1: aparecen en «Datos sin marcar». Es el
significado, no un error, y guardar nunca se bloquea.

⚠️ **La fecha va por ORDEN, no por etapa.** La tabla `leads` tiene dos pares de columnas
(`fecha_junta_1/junta_1_at` y `fecha_junta_2/junta_2_at`), y la primera reunión del embudo usa
el primero (`slotPorIndice`). Marcar una etapa que va ANTES de una reunión existente la corre al
segundo lugar, y las fechas ya cargadas se verían en otra etapa. Por eso el pop-up pregunta sólo
en ese caso (`cambioDeReuniones`); si nadie se corre, se marca sin fricción. La tercera reunión
no tiene columnas y lleva «Sin fecha». Los requisitos sólo miran la reunión 1 y la 2, así que
una tercera no pide nada imposible.

⚠️ **Lo que NO puede ser reunión** son la entrada, el pago, el cierre, las de grupo y las cuatro
terminales: perderían su tipo, y al desmarcarlas volverían como un paso cualquiera. Apagada,
una etapa vuelve a `'paso'`, lo mismo que una etapa nueva, y no a «sin tipo». La regla la
cumple la action, porque `op` es el argumento de una server action.

**Lo que quedó SIN hacer:**
- No se miró el botón en un navegador.
- Corregir el orden de los datos cuando una reunión se corre de número: hoy sólo se avisa, y
  la fecha queda en el lugar de su número viejo.

**Desde el 12/10/2026** el botón es un desplegable de tipo (Etapa / Reunión / Nutrición) y el NOMBRE marca solo una
etapa como reunión. Lo que eso enseñó —la marca aparte, la llamada que no pasó, y la etapa desmarcada antes del 12/10 que
se volvía a marcar— está en «El tipo de una etapa es una MARCA aparte…», más abajo.

_09/10/2026, cuenta 2, sin subagentes. Commit `adf1ca3d`._

---

## Confirmar una propuesta de la landing perdía al lead, sus productos y su campaña (09/10/2026)

**El relevo del 06/10 lo anotaba chico** («el duplicado del opt-in no lleva los productos») y
era tres agujeros en la misma pantalla, `/crm/revisar/<id>`, que es por donde entra todo
contacto de la landing que ya existía en el CRM (o cuyo alta directa falló):

1. **El «ya existe» no se mostraba, y el botón mentía.** `RevisarLead` sembraba las filas con
   `yaExiste: false`; el server lo descubría al confirmar y —con razón: no puede honrar una
   decisión que nadie vio— bajaba el tilde y la contaba como omitida. La pantalla decía
   «Crear 1 lead», la persona apretaba, volvía al CRM y no había pasado nada: ni ficha nueva,
   ni la ficha vieja tocada. Ahora la página corre `marcarExistentes` antes de dibujar y el
   repetido nace destildado, igual que en el importador, con «Duplicar / Completar».
2. **Los productos no viajaban.** El opt-in sabía en qué productos se anotó la persona y la
   propuesta no lo guardaba (el comentario del opt-in lo decía: «un campo puesto acá no lo
   leería nadie»). El lead nacía en el embudo del negocio; el que ya existía no se agregaba a
   ninguno. Ahora `datos.funnels` viaja, y al confirmar: el nuevo nace en el primero y se lo
   AGREGA a los demás; si se elige completar la ficha que estaba, se la agrega a todos
   («agregar, nunca mover»).
3. **La atribución tampoco.** La propuesta guardaba utm, fbclid y la visita
   (`visitor_id`), pero la tabla sólo copia nombre, email, teléfono y empresa, e
   `importarLeadsRevisadosAction` crea con `origen_lead: importacion`. El lead nacía sin
   campaña, sin fbclid para Meta y sin la sesión grabada. Ahora se le escriben al lead CREADO
   (nunca a una ficha que ya existía: su primer contacto es el que la trajo).

**La regla que queda:** si una propuesta guarda campos que la tabla de revisión no muestra,
alguien tiene que leerlos al confirmar — y se leen de la PROPUESTA (la guardó el server), no
del navegador. Es «escribir la salida no es ofrecerla» con la salida en un jsonb: el opt-in
escribía `fbclid` «en los dos caminos» con un comentario que lo exigía, y el segundo camino
no lo leía nadie.

⚠️ **Y la pantalla decía «Lo propuso Claude» sobre todo**, también sobre un formulario de la
landing o un pedido por WhatsApp: el texto era una constante con el origen sólo como sufijo.
`quienPropuso` lo saca del `origen` de la propuesta.

**Mirado en el navegador** (ws9, `next dev` propio, una propuesta de prueba creada y borrada):
dice «Llegó de tu landing», el botón cuenta «Crear 1 lead», y «No sumarlos» la descarta y
vuelve al CRM sin errores. Si lo único que pidió es el producto del negocio no se nombra:
«pidió Funnel principal» no informaba nada.

**Sin hacer:** confirmar marca la propuesta DESPUÉS de crear (dos pestañas pueden crear dos
veces; el ejecutor de flujos ya reclama antes). El camino del REPETIDO (Duplicar / Completar
+ los productos) tiene test pero no se miró en pantalla: ningún workspace de prueba tiene un
lead con email al que duplicar sin tocar datos reales.

**Vive en:** `app/crm/revisar/[id]/propuesta-lead.ts` (puro) · `app/crm/revisar/[id]/page.tsx` · `app/crm/revisar/[id]/RevisarLead.tsx` · `app/crm/revisar/[id]/acciones.ts` · `app/crm/actions.ts` (`ImportLeadsResult.ids`) · `app/api/track/optin/route.ts` (`datos.funnels`) · `tests/crm-revisar-propuesta.test.ts` · *2026-10-09*

## El filtro de anuncios existía y no tenía datos: el select del tablero no pedía la columna (10/10)

**Síntoma.** Martín: *«en campaña, y en Origen, aparece lo mismo. Y falta el filtro de
ANUNCIO»*. En la captura (Código Inmobiliario, ws13) el menú «Filtrar» tenía Etapa,
Origen, Campaña y Ordenar.

**El diagnóstico obvio era el equivocado: «falta construir el filtro».** Existía desde el
06/10 (`117ea2bd`, la categoría «Creativo»), con su atribución pura y un test que pasaba —
el de la landing, que lee el anuncio de `utm_content`—. Lo que faltaba era el DATO: el
tablero arma sus filas con `LISTA_COLS` (`lib/leads.ts`), una lista de columnas escrita a
mano, y esa lista traía `utm_campaign` pero **no `utm_content`**. La función entendía el id
del anuncio y nunca le llegaba; la categoría se escondía sola porque «una sin opciones no se
ofrece». Medido en ws13: 44 de 52 leads con el anuncio en `utm_content`, 13 anuncios
distintos, los 13 con nombre en `marketing_metrics_daily` — y el tablero no veía ninguno.

Y la misma lista dejaba afuera otras tres que los mappers leen: `meta_campaign_id` y
`adset_id_origen` (la campaña) y **`origen_lead`**, por la que la tarjeta decía «Sin origen»
sobre 50 leads que sí lo tienen («landing», «calcom»).

**El otro síntoma tenía otra causa.** El filtro «Origen» listaba `origenLegible`, que
contesta lo más específico que se sepa —el anuncio, si no la campaña, y recién al final el
canal—. Eso está bien para la TARJETA y mal para un filtro que desde el 06/10 tiene a
«Campaña» y «Anuncio» al lado: los 44 leads de anuncios caían en el origen con el nombre de
su campaña. Ahora el filtro lista `canalDeLead` (`app/crm/origen-lead.ts`); la tarjeta no
cambió.

**La regla que queda: una lista de columnas escrita a mano se queda vieja en cuanto un
mapper empieza a leer un campo nuevo, y no falla — el campo llega `undefined`.** El test de
la función no lo ve, porque le pasa el campo a mano. Lo que lo ve es un guard del CABLEADO:
`tests/crm-filtro-ads.test.ts` deriva las columnas que hacen falta del tipo
`LeadAtribuible` y del cuerpo real de `origenLegible` y `canalDeLead`, y exige que estén en
`LISTA_COLS`. Rompiéndolo con el bug original (sin `utm_content`): pass 9 / fail 1.

⚠️ **Y agregar una LECTURA hizo saltar un guard que cuenta ESCRITURAS.** El de la landing
(`tests/atribucion-landing.test.ts`) cuenta las menciones de `utm_content` contra las de
`fbclid` en `lib/leads.ts`, para que todo lugar que escribe un utm escriba también el fbclid.
Ya descontaba dos formas de lectura (líneas con backtick y `x.campo`); una columna en la
lista de un select era la tercera. Se descuenta por la forma del literal —sólo minúsculas,
guion bajo, espacios y una coma—, y no metiendo `fbclid` en el select para emparejar la
cuenta, que habría sido engañar al guard. Sigue cazando lo suyo: sin el fbclid del insert o
del `setIfEmpty`, 9/1.

**Vive en:** `lib/leads.ts` (`LISTA_COLS`) · `app/crm/origen-lead.ts` (`canalDeLead`) ·
`app/crm/crm-map.ts` · `app/crm/CrmBoard.tsx` (el filtro y el rótulo «Anuncio») ·
`tests/crm-filtro-ads.test.ts` · `tests/atribucion-landing.test.ts` · *686c51be — 2026-10-10,
hecho por el chat de Ads Manager a pedido de Martín*

## Campaña y Anuncio pasan a ser UN árbol, y con eso el cruce pasa de «Y» a «O» (10/10)

**El pedido.** Martín, sobre el menú que había quedado con «Campaña» y «Anuncio» al lado:
*«No separes el filtro de Campaña y Anuncio... Que dentro del filtro de "Anuncio" estén las
campañas primero como arbol y dentro se pueda seleccionar anuncios de esas camapañas»*. Qué
anuncio era de qué campaña había que adivinarlo por el nombre.

**Lo que no se ve al juntar dos listas en un árbol: el cruce cambia de signo.** Dos
categorías del menú se cruzan con «Y» (etapa Y origen), y así se cruzaban campaña y anuncio:
elegir la campaña A y un anuncio de la campaña B daba **cero** leads. En un árbol las dos
selecciones son de la MISMA lista, y lo que espera cualquiera que tilde dos casillas es «lo
uno O lo otro». La regla vive en una función (`pasaFiltroAnuncio`) y el tablero la llama; con
«Y» de vuelta el test cae (14/1).

**Y la casilla de un hijo, con su padre tildado entero, no se podía destildar.** Tildar la
campaña la elige ENTERA (también sus leads sin anuncio conocido) y no tilda sus anuncios uno
por uno: los cubre. Destildar uno de esos anuncios, escrito de la forma obvia —sacarlo de la
lista de anuncios sueltos—, no cambia nada, porque nunca estuvo ahí y la campaña lo sigue
cubriendo. Lo correcto es lo de cualquier árbol con casillas: «todos menos éste» (se suelta
la campaña y quedan tildados sus otros anuncios). Esa lógica salió del componente a un módulo
puro (`app/crm/arbol-seleccion.ts`) para que un test la EJECUTE; adentro del menú sólo se la
podía leer.

**El número de una campaña cuenta LEADS, no la suma de sus anuncios.** Un lead que vino por
la campaña sin anuncio conocido es de la campaña y no de ningún anuncio: en Código
Inmobiliario la campaña dice 44 y sus 13 anuncios suman menos. Y los anuncios cuelgan de la
campaña de SUS leads (el par que trae cada lead), no de una adivinada por el nombre.

⚠️ **Para la verificación: un `[style*="padding-left: 32px"]` no encuentra lo que React
dibujó con `padding` + `paddingLeft`.** El navegador funde las dos en el atajo `padding`, y el
selector por texto de estilo contesta «no hay ninguno» sobre trece filas a la vista. Se busca
por el texto del botón.

**Y al agrandar el panel, el borde que importa a la IZQUIERDA no es el de la ventana.**
Martín pidió el panel más ancho y *«Bajo ningún motivo debe tener scroll hacia la derecha»*.
Más ancho y pegado al botón pasa el borde derecho en un celular, así que el lugar se calcula
(`lugarDelPanel`, `app/crm/filtro-panel.ts`): si no entra, se corre a la izquierda lo justo. La
primera versión topaba ese corrimiento en el borde de la VENTANA y, medido a 390 px, el panel
quedaba con su primer tercio debajo de la barra lateral (68 px, fija y por encima de todo).
El tope es el borde del contenido (`closest('main')`), y el test barre anchos de ventana y
posiciones de botón con los dos topes. Lo encontró la captura, no el test: el primer test
afirmaba exactamente la regla equivocada y daba verde.

⚠️ **Y a 390 px la página del CRM YA scrollea 55 px de costado con el filtro cerrado.** No es
del panel —medido antes y después de abrirlo, el mismo número— y quedó sin tocar: si alguien
reporta «scroll lateral en el CRM desde el celular», no es el filtro.

**Y guardar los filtros en el navegador tiene una trampa de orden.** Se restauran en un
layout effect al entrar y se guardan en un effect cada vez que cambian (`0deedbe5`,
`app/crm/filtros-guardados.ts`). Los dos corren en el MISMO commit, y el guardado de ese commit
ve los filtros del render de antes —vacíos al entrar, los del embudo anterior al cambiar—: sin
saltearlo una vez, pisa lo guardado con nada, y el F5 «no se acuerda» aunque el código de
restaurar esté perfecto. La clave lleva cliente y embudo, y una etapa que ya no existe en el
embudo no vuelve (dejaría el tablero vacío sin casilla para destildarla).

**Vive en:** `lib/campana-atribucion.ts` (`arbolDeAnuncios`, `pasaFiltroAnuncio`) ·
`app/crm/arbol-seleccion.ts` · `app/crm/CrmToolbar.tsx` (el árbol del menú y los chips) ·
`app/crm/CrmBoard.tsx` (una sola lista) · `app/crm/filtro-panel.ts` · `tests/crm-filtro-ads.test.ts` ·
*bdbf3707 y 8a39bb02 — 2026-10-10, hecho por el chat de Ads Manager a pedido de Martín*

## ws11: 12 cuotas de US$4.235,29 de una sola persona, casi seguro pesos (10/10/2026)

De los US$51.098,77 pendientes de ws11, 50.823,48 son 12 cuotas de un mismo lead (del 08/11/2026
al 08/10/2027, cargadas el 08/10, sin `monto_cierre_usd`). Casi seguro es un monto en pesos
cargado como dólares, y todo lo que suma lo pendiente (Outstanding, MRR, una torta) lo infla. No
se tocó: es un dato del cliente. Y el «pendiente» de cualquier gráfico se filtra por
`fecha_esperada` dentro del rango, como ya hace el Outstanding de `/comercial`; `pagado = false`
a secas incluye las cuotas futuras.

De paso: los 433 `closing_analyses` de ws9 son llamadas de Martín (146 internas, 144 de entrega,
79 de prueba, 17 de venta) y **ninguna tiene `lead_id`**: no se cruzan con el CRM de MaKo.

**Vive en:** `pagos` (ws11) · `closing_analyses` (ws9). *Corrida `wf_01c22b1b-91a`, 10/10/2026.*

## «Marcar cobrada»: la action no tiene guarda de rol, no mira de quién es la cuota, y deshacer no reabre la cobranza (11/10/2026)

Salió al cablear «Marcar cobrada» en el Dashboard (`app/dashboard/bloques/BloqueCobranza.tsx`):

- **`marcarPagoAction` (`app/crm/actions.ts`) no tiene guarda de rol propia.** En el Dashboard la protege
  la puerta admin de la página; por la ficha del CRM y por el doer (`marcar_pago_cobrado`, sin
  `rolMinimo`) la puede usar cualquiera con CRM. Si la regla es «sólo admin marca cobrado», va adentro de
  la action, no en el botón. **Lo decide Martín.**
- **Y no comprueba que la cuota sea del lead que recibe.** Por eso el Dashboard saca el par (pago, lead)
  de la MISMA fila del server (`Fila.r` del lector de pagos) y nunca lo arma en el navegador.
- **Deshacer «Marcar cobrada» devuelve el dato pero no la secuencia:** `marcarPago(true)` cierra los
  recordatorios de cobranza (`lib/pagos.ts`) y el deshacer no los reabre. Previo al Dashboard.
- **Las lecturas de pagos de Comercial no paginan:** `getOutstandingDetalle` (`lib/pagos.ts`) lee TODA la
  tabla del workspace (medido: ws1 = 34, ws11 = 21 cuotas). Cuando alguien pase las 1000, el
  Outstanding y «A quién cobrarle» van a dar de menos sin un error.

**Vive en:** `app/crm/actions.ts` (`marcarPagoAction`) · `lib/pagos.ts`. *2026-10-11 Graphics.*

## Cobrar desde la ficha (11/10/2026, la pasarela de pagos)

El modelo de la pasarela vive en [hallazgos-planes-y-cobro.md](hallazgos-planes-y-cobro.md) → «La
pasarela». Acá, lo que es del CRM.

### `findLeadByContacto` no encuentra lo que `createLead` guarda, y con dos elige en silencio

**Síntoma:** buscar «juan@x.com» no encuentra un lead guardado como «Juan@X.com» (y crearlo choca por
duplicado), y con dos leads del mismo email se queda con el más viejo avisando sólo en un `console.warn`.
**Causa:** `primerLeadPor` compara con `eq` sobre el email en minúsculas, pero `createLead` sólo le hace
`trim`. La mig 0061 afirma que «el código ya normaliza el email de entrada a lowercase», y `createLead` no
lo hace. **Regla:** quien ata algo a un lead por email cuenta antes (`limit 2`), corta si hay más de uno,
y le pasa el email ya en minúsculas a `createLead`. **Vive en:** `lib/leads.ts` (`primerLeadPor`,
`createLead`) · `app/admin/cobros/actions.ts` (`leadDelComprador`).

### Un test protegía la incoherencia que había que arreglar

`tests/crm-ficha-y-selector.test.ts` fijaba con regex «venta o plan» en `/crm/[id]` y «hay cuotas» en el
modal (`LeadSheet`): dos condiciones distintas para la MISMA tab Pagos. La regla «las dos puertas
iguales» no se podía cumplir sin romperlo. **Regla:** un guard de FORMA también congela un bug; ahora
pide la misma variable (`verPagos`, de `lib/muestra-pagos.ts`) en las dos.
**Vive en:** `tests/crm-ficha-y-selector.test.ts` · `lib/muestra-pagos.ts`.

### El comprobante de pago: cinco copias de un predicado

`p.pagado && !p.comprobante_path` estaba copiado en cinco lugares y marcaba para siempre «Datos sin
marcar: Comprobante de pago» a todo cobro confirmado por la pasarela. Ahora es UNA función pura
(`faltaComprobante`, que exime a los que tienen `proveedor`) y los cinco la llaman.
**Vive en:** `lib/pago-comprobante.ts` · `lib/queries.ts` · `app/crm/actions.ts` · `app/crm/[id]/page.tsx` ·
`lib/api-mako/areas/crm.helpers.ts`.

### Una cuota se marcaba sin mirar de qué lead era

`registrarCobroDeProveedor` buscaba la cuota a saldar sólo por id: un `pagoId` que viniera de otro lado
saldaba la cuota de otra persona. Ahora filtra también por el lead, y `crearCobroAction` no acepta un
`pagoId` del navegador. **Vive en:** `lib/pagos.ts` · `app/crm/[id]/cobros-actions.ts`.

### El `Confirm` de `app/_ui` no entra en la pila de modales (deducido, no probado en el navegador)

Montado adentro de la ficha en modal, Escape cerraría la ficha entera: `LeadSheet` escucha en `window`
en captura, antes que el listener del Confirm. Se envolvió con `useCapaModal(true, { anidada: true })`
en la lista de cobros; el «Borrar lead» de `LeadSheet` probablemente tiene el mismo problema.
**Vive en:** `app/_ui/Confirm.tsx` · `app/crm/[id]/CobrosDelLead.tsx`.

_11/10/2026 — pasarela de pagos; `tests/muestra-pagos.test.ts` y `tests/pago-comprobante.test.ts`
probados rompiéndolos._

## «Producto» → «Funnel»: la palabra nombraba DOS cosas, y sólo una se renombró (11/10/2026)

Martín pidió cambiar el concepto «Producto» por «Funnel» «en todos lados», y la jerarquía que
fijó es **funnel > oferta > productos**. El renombre (`53ba6450`) sólo es correcto si se separa
qué nombraba cada «producto», porque en el código la misma palabra apuntaba a dos tablas:

| Lo que dice la pantalla | Qué es por dentro | Quedó |
|---|---|---|
| El «producto» del CRM (selector, ficha, «traer de otro…», campañas, Pixel, «Agregar al CRM») | una fila de `funnels` (`leads.funnel_id`, `lead_funnel`), con el nombre de `productoDeFunnel` | **funnel** |
| El catálogo con precio (único/suscripción), lo que entrega Customer Success, los cursos | `productos` (`lib/productos.ts`), dentro de una oferta | **producto** |

- **La regla para decidir cada aparición: de dónde salen los datos**, no cómo se llama la
  variable. `funnels` / `lead_funnel` / `funnel_id` → funnel; `productos` / `listProductos` /
  `producto_id` / `oferta_productos` → producto. Las variables y funciones siguen llamándose
  `productos` (`TraerDeOtroProducto`, `agregarAProducto`): lo que cambia es lo que se LEE.
- ⚠️ **En Automations los dos conviven en la misma fila.** `productosConEtapas`
  (`lib/setting-secuencias.ts`) devuelve una fila POR FUNNEL, con las etapas de venta del funnel
  y las de entrega de su producto principal, más los productos sueltos que sólo tienen entrega.
  Por eso el paso del CRON pasó a «Funnels» (`PASO_PRODUCTOS`) y el disparador de ETAPA dice
  «funnel», pero el de ENTREGA (`producto_id`, `TRIGGER_ENTREGA`) sigue diciendo «Elige el
  producto»: el kanban de entrega es del producto, no del funnel.
- **La relación «un funnel tiene varias ofertas» ya existía:** es `funnel_ofertas` (mig 0171),
  no `oferta_productos`. El chat de la tab Offer estaba por armar su selector con
  `listProductos`, que es el catálogo de precios; se le avisó y pasó a `leerFunnels()` +
  `ofertasDeFunnels()`.
- **El historial del lead no se migró:** las entradas nuevas dicen «Funnel» en el campo y las
  viejas «Producto». Nadie filtra por ese campo (medido con grep), así que no rompe nada.

**Lo que quedó sin hacer, con dónde vive:**
- Las descripciones de `lib/api-mako/areas/crm.def.ts` (y otras `.def.ts`) siguen diciendo
  «producto»: generan `docs/api-mako.md`, que al 11/10 tenía cambios sin commitear de otra
  sesión. Se hace cuando `lib/api-mako` esté limpio, regenerando con
  `node --import tsx scripts/generar-api-doc.mjs`.
- La dimensión «Producto» de los gráficos (`lib/graficos-catalogo.ts`, `cat('producto', 'Producto')`):
  el archivo estaba en curso en la sesión del Dashboard.
- Los prompts de IA (`lib/flujo-ia.ts`, el doer) siguen diciendo «producto» a propósito: cambiar
  la palabra que lee un modelo es cambiar lo que contesta.

**Vive en:** `lib/funnels.ts` · `lib/setting-secuencias.ts` · `lib/flujo-conversacion.ts` ·
`app/crm/CrmToolbar.tsx`. *Chat CRM, 2026-10-11, sin multi-agente (la guardia de RAM lo frenó).*

## La fecha de una reunión cargada en la ficha no pasa por `updateLead` (11/10/2026)

Lo encontró la undécima tanda de Automations al hacer que una reunión cargada a mano inscriba al instante en el flujo de
su etapa (M1-b, `docs/diseno-undecima-tanda.md`). El motor y su porqué, en [hallazgos-chatbot.md](hallazgos-chatbot.md).

- **⚠️ El lugar obvio era el equivocado.** «Inscribir cuando cambia la etapa derivada» en `updateLead` no cubría el caso
  para el que existe: la fecha de la ficha se guarda por `saveLeadMeta` (un UPDATE directo), y `updateLead` sólo ve la
  asistencia y el estado.
- **Un guardado de varios pasos pasa por etapas derivadas intermedias.** `completeStageMoveAction`
  (`app/crm/actions.ts`) guarda la fecha, después la asistencia y recién al final el override: con «cualquier cambio de
  la derivada», un «no asistió» camino a «No Show» inscribía en lo de 'noshow_r1', que el barrido nunca alcanza.
- **Regla:** se inscribe sólo HACIA una etapa de tipo reunión (`entraAEtapaDeReunion`), desde `updateLead`,
  `saveLeadMeta` y `setMeetingManual` (al final, con `disparoDeEtapa: false` en su `updateLead`). Y al reservar una R1
  desde el webhook, un override de «no agendó» puesto a mano (lead/nutri/reactivación/no-show) se limpia en el mismo
  update y queda auditado como «Etapa» por MaKo (`limpiaEtapaAlReservar`): sin eso, ~7 % de las agendas del ws1 no
  entraban al flujo. Una R2 no toca nada.

**SIN HACER:** una reserva de R2 no dispara el evento al instante (`app/api/webhooks/{calendly,calcom}/route.ts`, rama
j2): entra por el barrido de la hora.

**Vive en:** `lib/leads.ts` (`enrolarPorEtapaDerivada`, `auditarEtapaDeLaReserva`) · `lib/nutricion-etapa.ts` ·
`lib/nutricion-familias.ts` · *2026-10-11 undécima tanda (w2-motor-reuniones)*

## La cabecera de la ficha: un árbol, la portada y las pestañas que dependen del funnel (12/10/2026)

Feedback de Martín del 12/10 (puntos 9, 11-14, 16, 18, 19). Las dos puertas de la ficha montan ahora UNA cabecera
(`CabeceraLead`, sobre `CabeceraDetalle`) y UNA pestaña de MaKo Analyst (`AnalystDelLead`).

- **El árbol funnel › etapa pinta la casa con las etapas y la etapa de la PANTALLA, no las del server.** La respuesta de
  `productosDeLaFichaAction` es una foto que sólo se relee tras agregar/quitar/mover en un agregado: después de mover la
  casa con el wizard, su `etapa` queda vieja. `funnelsDelArbol` reemplaza la casa por lo de la pantalla (que sí se relee).
  Sin respuesta del server el árbol tiene SÓLO la casa: «Agregar» en un funnel donde no se sabe si está afirmaría algo.
- **«El funnel del lead tiene una campaña» se compara con el del negocio como `null` en las DOS puntas** (mapa
  `meta.campanas` y `leads.funnel_id`), traduciendo el id real del del negocio a `null` por si alguna fila vieja lo trae.
  Y se lee ESTRICTO: con la base caída la pestaña Tracking SE DIBUJA (la tolerante devolvía `[]` = «sin campaña» para todos).
- **Un `max-height` no alcanza para un sticky: el que scrollea tiene que TENER alto.** En el pop-up es el cuerpo
  (`flex: 1; minHeight: 0`) y la cabecera queda afuera de él; en la ruta scrollea el documento (sin `overflow` en ningún
  ancestro) y la cabecera con portada se va con el scroll a propósito: la ruta se abre desde un WhatsApp, en un teléfono.

**SIN HACER:**
- `Lead` (lib/leads.ts) no declara `portada`, `portada_y` ni `avatar_y` aunque `getLead` las trae: la cabecera las
  declara aparte (`LeadConCara`, app/crm/lead-view/CabeceraLead.tsx). Moverlas al tipo cuando nadie más lo esté tocando.
- `CabeceraDetalle` tiñe la fila con `${color}12`, y `colorDe` devuelve `hsl(...)`: donde el color sale de ahí (la ficha
  de un cliente de la plataforma y ahora la del lead) el CSS queda inválido y la fila sale sin tinte. Leído en el código,
  no medido en pantalla (app/_components/CabeceraDetalle.tsx, `FilaDetalle`; el del tablero usa el color del proyecto).
- «¿Era calificado?» (`CalificacionCard`) vive en Tracking y en Reuniones: en un funnel sin campaña y sin etapa de
  reunión ya no se ve en ninguna pestaña. Decisión de Martín si hace falta en el Resumen.
- El esqueleto de carga del pop-up (app/crm/LeadEditModal.tsx) sigue sin portada: salta al abrir. (El ancho ya sale
  de `ANCHO_FICHA_LEAD`, app/crm/lead-view/ficha-medidas.ts: lo cambió el frente B en la misma corrida.)

**Vive en:** `app/crm/lead-view/CabeceraLead.tsx` · `app/crm/lead-view/arbol-funnels.ts` ·
`app/crm/lead-view/ProductoDelLead.tsx` · `lib/tracking-ficha.ts` · `lib/tracking-ficha-server.ts` ·
`app/crm/lead-cabecera-actions.ts` · *2026-10-12 corrida crm-feedback-12-10 (frente C-cabecera-y-marco)*

## Lo que se edita ADENTRO de la ficha: la tarjeta abre el campo, el teléfono con país, notas e ingreso estimado (12/10/2026)

Feedback de Martín del 12/10 (puntos 5, 7, 15, 17, 21 y 28).

- **«Sólo puedo cambiarla si le doy click al —»: el campo medía lo que decía.** `EditableInline` es un `inline-block` y,
  vacío, dice «—»: un blanco de 10 px en una tarjeta de 300; la fecha y la persona eran un botón del tamaño de su texto.
  La cura es `CajaCampo` (CampoEditable.tsx): un clic en cualquier punto que no sea ya un control abre el campo de
  adentro (cada pieza marca su disparador con `data-campo-abrir`) y, adentro de ella, el texto ocupa el ancho. Tres
  trampas: (1) un clic que llega por un PORTAL (el menú del `Dropdown`, el toast) burbujea por el árbol de React hasta la
  tarjeta aunque no esté en su DOM: sin `caja.contains(target)`, elegir una opción reabría el desplegable; (2) el clic que
  SALE de la edición (el `pointerdown` le saca el foco, el `click` la reabría): se mira en el `pointerdown` si había un
  campo abierto; (3) un pop-up que vive adentro de la tarjeta (el del WhatsApp no oficial) lleva `data-no-abre`.
- **Es un COMPONENTE y no un estilo exportado**: Reuniones, Motivo/Plazo y Calificación no son `'use client'`, y un valor
  importado de un `'use client'` llega al server como una referencia de cliente.
- **El teléfono con el país primero no puede cambiar el formato guardado.** Lo de Calendly está como vino («+52 1 55…»);
  `telefonoAGuardar` (campo-inline.ts) no escribe ni deja línea en el historial si la persona no cambió nada. ⚠️ Comparar
  DÍGITOS, que era lo que hacía esta versión, NO alcanzaba: un número guardado sin código de país volvía con «52»
  adelante con sólo abrir y cerrar la tarjeta. El caso y la regla, en «Partir un valor guardado…» de la revisión, abajo.
- **El ingreso estimado NO es una venta**: columna aparte (`ingreso_estimado`, mig 0258) por `saveLeadMeta`, nunca por
  `updateLead` (que aplica monto ⇔ cerro y avisa a Meta) ni en `monto_cierre_usd`, que es lo que cuenta Revenue.
- **Una nota es una fila de `lead_audit` (`campo = 'Nota'`), no de una tabla propia.** Editar/borrar (notas-actions.ts)
  lleva `campo = 'Nota'` en el WHERE (sin él, un id cualquiera del historial se reescribe desde el navegador); la versión
  original queda en `valor_anterior`, y borrar deja «Nota borrada» sin el texto.
- **Sin «Guardar y completar después», cerrar «Completar datos» guarda** si la persona contestó algo; abrir y cerrar sin
  tocar no escribe. Al MOVER de etapa el botón sigue: ahí guardar es mover.
- **Dos trampas al probar los tests rompiéndolos.** (a) Un sacador de comentarios ingenuo (`/\/\*[\s\S]*?\*\//`) se come
  código desde un `accept=".pdf,image/*"`: StageMoveDialog perdía su `const enResumen` y el guard daba rojo sobre código
  sano; un bloque se reconoce cuando abre un renglón o un `{`. (b) El arnés que rompe y RESTAURA con
  `texto.replace(roto, original)` interpretó el `` $` `` de un template literal del original como «todo lo anterior» y
  duplicó media `campo-inline.ts` (16 KB → 23 KB) al restaurar. El reemplazo va como función también en un arnés.

**SIN HACER:**
- La migración 0258 se aplicó a prod el 12/10 ANTES del push (verificado: el `select` de las dos columnas responde). Lo que enseña el orden: sin ella no se caía sólo el tablero: `LISTA_COLS`
  (lib/leads.ts) la pide, `leerTodo` (lib/supabase-paginado.ts) TIRA ante el error de PostgREST, y con él `listLeads` y
  `listLeadsDeFunnel` — el cron de Fathom (lib/fathom-auto.ts:108), las herramientas de MaKo (lib/mako-tools.ts), /m
  (lib/crm-movil.ts) y la API de MaKo (lib/api-mako/areas/crm.helpers.ts). El alta sí sobrevive: `createLead` nombra
  `instagram` sólo cuando trae valor. (La segunda revisión lo descartó como defecto —el orden ya está escrito en la
  cabecera de la migración—, pero el alcance es lo que tiene que saber quien integra.)
- Los guards que barren con `git ls-files` no ven los archivos nuevos hasta el `git add`. La revisión les hizo
  `git add -N` a los 23 nuevos de la corrida y volvió a correr los barredores (ver la sección siguiente).
- «Una nota la cambia quien la escribió, o un admin» es una decisión de esta corrida, no un pedido: si Martín quiere que
  cualquiera la toque, es una línea en `notaQueSePuedeTocar`.
- Editar o borrar una nota no tiene «Deshacer» en el toast (el historial sí lo registra).
- Los sí/no del encabezado de cada reunión no tienen `CajaCampo`: comparten la fila con la fecha y el título.

**Vive en:** `app/crm/lead-view/CampoEditable.tsx` · `app/crm/lead-view/InfoPrincipalCard.tsx` ·
`app/crm/lead-view/NotasCard.tsx` · `app/crm/notas-actions.ts` · `app/crm/campo-inline.ts` · `app/crm/StageMoveDialog.tsx`
· `app/crm/crm-map.ts` · `lib/leads.ts` · `supabase/migrations/0258_lead_ingreso_e_instagram.sql` ·
*2026-10-12 corrida crm-feedback-12-10 (frente D-campos-notas-datos)*

## La revisión de lo invisible del feedback del 12/10: lo que no se veía y perdía datos (12/10/2026)

Revisor de la corrida (datos, servidor, permisos, envíos) sobre los seis frentes. Lo que encontró y la regla que deja:

- **Un buscador que sólo entrega lo ELEGIDO pierde lo ESCRITO.** En el alta, tipear «@martinkoncke» y apretar «Crear
  lead» sin tocar «Usar @martinkoncke» creaba el lead SIN Instagram, sin un aviso: el campo se veía lleno y no viajaba
  (el componente no emite input, a propósito, y el alta mandaba sólo `perfil?.usuario`). Ahora el buscador avisa lo
  escrito (`onTexto`) y el alta manda `instagramDelAlta(elegido, escrito)` (app/crm/campo-inline.ts), con la MISMA
  regla que el server (`usuarioInstagram`): un nombre no es un usuario y no se manda. La regla: un campo con lista de
  sugerencias manda también lo escrito cuando es un valor válido.
- **Un cambio que el server hace SOLO se avisa en TODAS las puertas que llaman la action, no en la pantalla que se
  estaba mirando.** `reunionPorNombre` vive en `editarEtapaAction`, y a esa action la llaman el pop-up de etapas (que lo
  decía con su «Deshacer») y el «···» de la columna del tablero, que ignoraba `reunionSola`: renombrar una columna
  «Llamada» le cambiaba el tipo en silencio — y con eso dónde se guardan las fechas de reunión de sus leads. Se busca con
  `grep` del nombre de la ACTION. Arreglado en `opEtapa` (app/crm/CrmBoard.tsx), con su guard.
- **Partir un valor guardado en un control estructurado y volver a unirlo NO es neutro.** En los teléfonos del
  workspace (app/configuraciones/TelefonosPanel.tsx) editar sólo la etiqueta reescribía «+52 686 399 6369» como
  «+52 6863996369», y uno guardado sin código de país que no empieza con ninguno (un «044…») volvía con «+52» adelante:
  OTROS dígitos y otro `numero_norm`. Si la lada y el número son los que salieron de partirlo, viaja el original. La
  pregunta para cualquier control que hidrata un dato guardado: ¿qué manda si nadie lo toca?
  ⚠️ **Y la ficha NO lo hacía, aunque esta misma revisión la dio por buena** (lo cazó la segunda revisión).
  `telefonoAGuardar` comparaba DÍGITOS, y `splitTelefono` (lib/paises.ts), cuando ninguna lada coincide, devuelve la lada
  por defecto (+52) con TODOS los dígitos como resto: la partición INVENTA dígitos. Un lead con `telefono = '2233550684'`
  (alta vieja de texto libre, o CSV) quedaba `522233550684` con sólo abrir la tarjeta «Teléfono» y hacer clic afuera —
  también con la ✕ de la ficha—: escribía `telefono` y `telefono_normalizado`, dejaba una línea «Teléfono» en el
  historial y el toast «Guardado», y desde ahí el WhatsApp no oficial (`EnviarNoOficial`) salía a un número mexicano.
  Nadie lo nota porque el match por los últimos 10 dígitos lo sigue encontrando. Medido igual con «044 686 399 6369»,
  «3764 67-3479», «0223 155 123456» y «8112345678». Y el test de la ficha probaba sólo números que YA empezaban con una
  lada: el caso que rompe es el que no. Ahora el editor guarda la PARTICIÓN con la que abrió (`inicial`, un ref en
  `TelefonoEditable`) y, si la lada y los dígitos son ésos, no escribe. **La comparación es contra lo que se le MOSTRÓ a
  la persona, no contra una normalización de lo guardado: la normalización también inventa.** Por lo mismo la celda del
  teléfono en la revisión de la importación (`TablaRevisionLeads`) quedó como texto libre, a propósito. Y la otra mitad
  —un número PEGADO con su «+código» que quedaba con dos códigos— vive en la pieza compartida: ver «Lo que vive en otro
  documento».
- **Los barredores que leen `git ls-files` dieron verde en los seis frentes porque no veían los 23 archivos nuevos.**
  Con `git add -N`, el guard de voseo cazó un «acá» en el `title` del total de las columnas (app/crm/total-columna.ts).
  El `add -N` va ANTES de correr los barredores, no al integrar.
- **El typecheck de un worktree con `node_modules` enlazado al clon da rojos que no son del cambio.** Dos `TS2307`
  (`html-to-image` y `pptxgenjs`, en lib/editor-landing/) porque el clon está atrasado y su `node_modules` no tiene
  dependencias que el `package.json` del worktree ya declara. Antes de leer un «Cannot find module» ahí:
  `ls node_modules/<paquete>`.
- **El buscador de Instagram por NOMBRE hoy no anda, y no por un bug** (lo midió el frente F): la Custom Search JSON API
  de Google está cerrada a clientes nuevos y se apaga el 1/1/2027, y las claves `GOOGLE_CSE_KEY`/`GOOGLE_CSE_CX` del
  workspace de plataforma no existen. Queda Meta Business Discovery: sólo por el @ exacto y sólo cuentas de empresa o
  creador, con la conexión de Meta del negocio. Sin esas dos cosas la lista dice «Sin resultados» y deja el @ a mano.

**SIN HACER:**
- Quitar una columna desde su «···» cuenta los leads sobre `filtered` (lo que el filtro deja a la vista), no sobre la
  cartera: con un filtro puesto, una columna con leads escondidos se va sin el «¿seguro?» (app/crm/CrmBoard.tsx,
  `quitarColumna`). Es de antes de esta corrida.
- Lo que dejó anotado el frente A (de segunda mano, no medido acá): `EditorEtiquetas` sin pantalla (renombrar, color y
  archivar sólo por API); los plazos ya guardados siguen avisando (lib/lead-quieto-aviso.ts) sin dónde verlos ni
  sacarlos; el filtro «Nutrición» del tablero no lee `marcadaComo`; el buscador de etiquetas con más de 7 esconde
  «＋ Nueva» (app/_components/etiquetas-cliente.tsx).
- Dos reglas para «¿es un usuario de Instagram?»: `usuarioInstagram` (app/crm/campo-inline.ts) y `usuarioDeTexto`
  (lib/instagram-buscar.ts). Difieren en un usuario sin letras ni números («___»). Juntarlas en una.
- El número 0258 choca con un 0258 local de otro worktree sin pushear (`wt-gamma`): se dejó, porque el repo ya tolera
  números repetidos (0024, 0025, 0128…) y lo que ordena es el nombre del archivo, no el número.

**Vive en:** `app/crm/new/NewLeadForm.tsx` · `app/crm/new/InstagramBuscador.tsx` · `app/crm/campo-inline.ts` ·
`app/crm/CrmBoard.tsx` · `app/configuraciones/TelefonosPanel.tsx` · `app/crm/total-columna.ts` ·
`app/api/crm/instagram-buscar/route.ts` · *2026-10-12 corrida crm-feedback-12-10 (revisor)*

## El tipo de una etapa es una MARCA aparte, y el nombre sólo puede sugerir reunión cuando PASA a decirlo (12/10/2026)

Feedback de Martín del 12/10 (puntos 3, 4, 8 y 13): el botón «Reunión» del pop-up de etapas pasó a ser un desplegable
Etapa / Reunión / Nutrición; se fueron las subtabs Nutrición y Etiquetas y la pastilla «Plazo»; y una etapa que se crea
o se renombra con nombre de reunión queda marcada sola, con un toast y «Deshacer». Lo que hay que saber antes de tocarlo:

- **Nutrición NO es un `kind`: es `marcadaComo` (lib/pipeline.ts).** `kind` lo leen ~40 archivos —`generateFunnel`
  deriva las transiciones, `reunionesDe` el lugar de las fechas, los requisitos, el CRM automático, la API de MaKo— y un
  valor que ninguno conoce cae en el `default` de cada uno, cada uno a su manera. Con la marca, una etapa «Nutrición»
  sigue siendo `kind: 'paso'` para todos ellos. `marcadaComo: 'etapa'` significa «la persona dijo que NO es reunión»: el
  nombre deja de contar. La marca sobrevive porque `sanearPipeline` conserva la etapa entera y cada op la copia con un
  spread; el «Deshacer» de quitar una etapa la perdía (volvía como «Etapa») hasta que `tone` y `marcadaComo` viajaron en
  `EtapaQuitada` (app/crm/actions.ts).
- ⚠️ **Lo que habla de una llamada que NO pasó no es una reunión, y la lista de palabras lo olvidó** (segunda revisión).
  «llamada» está en `PALABRAS_REUNION`, así que «No contestó la llamada», «Llamada perdida», «No atendió la llamada»,
  «Reagendar llamada» y «Sin respuesta a la llamada» se marcaban solas. Creada después de la R1, una de ésas ERA la R2:
  con la R1 completa, mover a Facturando pasaba de no pedir nada (nivel 2) a pedir `fechaJ2` y `asistenciaR2` (nivel 4);
  «Datos sin marcar» marcaba todos los leads de Facturando y Ganado; un movimiento con `requisitos: 'validar'`
  (lib/mako-confirmaciones.ts) tiraba `RequisitosFaltantesError`; `generateFunnel` sumaba las nutriciones
  `st0>noshow_r2` y `st0>nocompro`, que nacen prendidas; y el CRM automático podía mover leads a «No Show R2». El único
  aviso era el toast de 5 s. Ahora `NO_ES_REUNION` excluye «no contest/atend/respond», «perdido/a», «sin respuesta»,
  «re-agend» y «volver a». **Regla:** una palabra nueva en `PALABRAS_REUNION` se prueba contra sus negaciones («no …»,
  «… perdida», «reagendar …») antes de sumarla. Marcar de más no es cosmético: mueve requisitos, nutriciones y el motor.
- ⚠️ **«Sin marca» no quiere decir «nadie decidió»: los datos de antes de la marca no tenían cómo decirlo** (segunda
  revisión). La marca automática se saltea las etapas con `marcadaComo`, porque lo elegido a mano le gana al nombre. Pero
  la op vieja `reunion` con `es: false` (del 09/10 al 12/10) guardaba `kind: 'paso'` SIN marca, porque la marca no
  existía: un negocio que desmarcó «Agenda R2» porque no hace segunda reunión, al renombrarla «Agenda R2 (no usamos)», la
  veía volver a ser la R2 —con su lugar de fechas, sus requisitos y su nutrición de no-show—, revirtiendo en silencio una
  decisión explícita. El diagnóstico obvio («si no tiene marca, nadie eligió») era el equivocado. Ahora
  `reunionPorNombre(etapas, key, labelAnterior)` marca sólo si el nombre PASA a decir reunión: si el de antes ya lo decía,
  alguien ya tuvo la oportunidad de decidir. **Regla:** un campo nuevo que registra una DECISIÓN no existe en las filas
  viejas; antes de leer su ausencia como «no decidió», preguntá qué escribía el camino de antes.
- **Por el nombre cuentan sólo las etapas del recorrido** (`tieneEtapaDeReunion`, que decide si la ficha dibuja la
  pestaña Reuniones). Las nutriciones GENERADAS no traen `kind`, así que `puedeSerReunion` las deja pasar, y una se llama
  «Reunión excepcional» (la que `generateFunnel` agrega a todo embudo con etapa de pago): sin el corte por banda,
  cualquier embudo con un pago abría la pestaña sin tener una sola reunión.
- **Una op que no se conoce se RECHAZA.** El último `else` de `editarEtapaAction` era el `agregar`: cualquier op que
  llegara de una pestaña con el bundle viejo —o de un pedido armado a mano— agregaba una «Nueva etapa». Por lo mismo la op
  vieja `reunion` sigue viva en el server: una pestaña abierta antes del deploy todavía la manda.
- **El color de las etapas viejas se DERIVA al leer y no se escribe** (`conColores`, adentro de `generateFunnel`): dejan
  de verse grises en todos los tableros sin migración y sin tocar `funnels.data`; el pipeline crudo, el que se guarda, no
  pasa por ahí. Una etapa nueva nace con un color que no use otra (`colorParaNueva`), mirado contra los colores
  EFECTIVOS y no contra los guardados.

**SIN HACER:**
- Las nutriciones que genera `generateFunnel` (`st0>noshow_r2`, `st0>nocompro`, …) nacen prendidas y, desde que se fue
  la subtab Nutrición, no hay pantalla para apagarlas: la op `nutricion` de `editarEtapaAction` sigue en el server sin
  call site (app/crm/actions.ts).
- Las etapas desmarcadas con la op vieja (09/10 al 12/10) siguen sin marca. Ya no se re-marcan al renombrar, pero
  `tieneEtapaDeReunion` las sigue contando por el nombre para la pestaña Reuniones (sólo dibuja una pestaña; no mueve
  datos). Un backfill que les ponga `marcadaComo: 'etapa'` NO se puede hacer a ciegas: «paso sin marca con nombre de
  reunión» también es la etapa vieja que nadie tocó nunca y que el punto 13 quiere contar como reunión.

**Vive en:** `lib/etapa-reunion.ts` (`PALABRAS_REUNION`, `NO_ES_REUNION`, `reunionPorNombre`, `tieneEtapaDeReunion`,
`conTipo`) · `lib/pipeline.ts` (`marcadaComo`, `conColores`, `colorParaNueva`) · `app/crm/actions.ts`
(`editarEtapaAction`, `marcarSiPareceReunion`) · `app/crm/EtapasModal.tsx` · `lib/lead-quieto-aviso.ts` (cabecera: qué
quedó del plazo) · `tests/etapa-reunion.test.ts` · `tests/etapas-color-nombre.test.ts` · *2026-10-12 corrida
crm-feedback-12-10 (frente A-etapas y segunda revisión)*

## La segunda revisión del 12/10: lo que se perdía o se filtraba sin un error (12/10/2026)

Segunda pasada sobre datos, servidor, permisos, envíos y costo, después del primer revisor. Nueve hallazgos, los nueve
reales y arreglados. Acá van los de código del CRM; los de etapas y el teléfono de la ficha están integrados arriba, en
su tema, y los de piezas compartidas, en su documento (ver «Lo que vive en otro documento»).

- **Un tope que RECORTA en un camino y no existe en el otro pierde texto, y lo pierde al EDITAR.** Crear una nota no
  tenía tope y editarla hacía `slice(0, 4000)`: una nota dictada de 5000 caracteres entraba entera, alguien le corregía
  una letra, y al guardar se perdía la cola con el toast «Nota guardada». La ficha, Customer Success, /m y MaKo leen
  `valor_nuevo`; el texto entero sólo quedaba en `valor_anterior`. Ahora `TOPE_NOTA` (app/crm/notas-reglas.ts, un módulo
  sin `'use server'` porque un archivo de server actions no exporta constantes) es UNO para el alta y la edición, y los
  dos RECHAZAN. ⚠️ `maxLength` en la caja no alcanza: frena lo que se TIPEA, no lo que entra por código, y el dictado
  (`BotonDictar`) escribe el valor por código; el freno de verdad es el del server. Es la regla de AGENTS.md («Un tope se
  aplica ANTES…»: el tope es una constante compartida) rota por un camino nuevo.
- **Una fecha que queda ESCRITA para siempre se formatea en la zona del negocio, como la pinta la pantalla.** «Nota
  borrada» dejaba en `lead_audit` «escrita el DD/MM/AAAA» con `getUTCDate`/`getUTCMonth`: una nota de las 18:30 en
  Tijuana (01:30 UTC del día siguiente) quedaba registrada un día después del que mostraba la tarjeta. Ahora
  `fechaDeNota(iso, tz)` con `tzActual()`, que es `zonaDelNegocio`. Un rastro de auditoría que contradice lo que se vio
  es peor que no tenerlo.
- ⚠️ **Una caché en `globalThis` es de TODOS los inquilinos del proceso.** El buscador de Instagram guardaba lo que Meta
  contestó de un @ como `m:<usuario>`, sin el workspace, y lo leía ANTES de mirar si este negocio tiene conexión de Meta.
  Un negocio sin Meta que escribía «@juan.prospecto» recibía el perfil si otro cliente lo había buscado en los 10 minutos
  anteriores: se filtraba la prospección de otro inquilino, y con datos leídos con SU token. Ahora `m:<ws>:<usuario>`.
  **Regla:** si el valor sale de una credencial o un dato de UN cliente, el `ws` va en la clave; una clave global sólo
  vale cuando la fuente es de la plataforma y la respuesta sería idéntica para cualquiera (la de Google, `g:<texto>`, que
  existe por la cuota). Barrido del 12/10 (las `new Map` a nivel de módulo de lib/ y app/): las demás que guardan algo
  leído con credenciales de un cliente —lib/meta-desgloses.ts, lib/moneda-meta.ts, lib/panda.ts,
  lib/youtube-analytics.ts, lib/timezone.ts, lib/crm-auto.ts— van por ws, y lib/meta-ads-create.ts por página + cuenta;
  el resto son throttles, formatos, cachés del navegador o lecturas de algo público (lib/pixel-servido.ts por la URL de
  la página, lib/imagenes-stock.ts por el texto).
- **Un freno que se arma DESPUÉS de la llamada que tiene que frenar no frena nada.** La pausa `mx:<ws>` («se deja de
  preguntar un rato y queda UNA línea en el log») sólo se alcanzaba si la primera llamada —la cuenta de Instagram de la
  página— salía bien. Pero un token vencido (190) o un permiso que falta (10, 200: lo esperable mientras los permisos de
  la app MaKo estén pendientes) fallan justo en ESA llamada: cada búsqueda (cada pausa de 500 ms) volvía a pegarle a
  Graph y escribía una línea. Y los códigos de límite (4, 17, 32, 613, 80001, 80002) caían en `error`, que no se cachea.
  El 17 es por TOKEN: insistir alarga el bloqueo del mismo token con el que el cliente pauta. Ahora el motivo viaja con
  el error (`motivoDeErrorGraph`, lib/instagram-buscar.ts) y el catch de la llamada previa también pausa ante
  `sin-permiso` y `limite`. **Regla:** un circuito que corta por motivo se arma en TODOS los catch que ven el motivo,
  empezando por el de la llamada preliminar.

**SIN HACER:**
- Tres clasificadores distintos de «Meta está limitando», con listas distintas: `esLimite` en lib/instagram-buscar.ts
  (4, 17, 32, 613, 80001, 80002), `MetaRateLimitError` en lib/meta-ads.ts (sólo el 17 con subcódigo 4) y el regex de
  lib/onboarding-extract.ts:137 (4, 17, 613). Una cosa, un lugar: juntarlos (el de Ads es de su área).
- La nota desde el teléfono sigue recortando a 4000 en silencio al crearla: vive en app/m/crm/acciones.ts y está anotada
  en [hallazgos-mobile.md](hallazgos-mobile.md).

**Vive en:** `app/crm/notas-reglas.ts` · `app/crm/notas-actions.ts` · `app/crm/actions.ts` (`addLeadNoteAction`) ·
`app/crm/lead-view/NotasCard.tsx` · `app/crm/campo-inline.ts` (`telefonoAGuardar`) ·
`app/crm/lead-view/CampoEditable.tsx` (`TelefonoEditable`) · `lib/paises.ts` (`splitTelefono`) ·
`app/api/crm/instagram-buscar/route.ts` · `lib/instagram-buscar.ts` · `tests/crm-ficha-campos-12-10.test.ts` ·
`tests/instagram-buscar.test.ts` · *2026-10-12 corrida crm-feedback-12-10 (segunda revisión)*

## El segundo feedback del 12/10: el editor de etapas, las etiquetas y el número de lead (12/10/2026)

Pedido de Martín (12/10/2026, 10:30), once puntos sobre lo que se había publicado esa mañana. Lo que no se ve
en el código:

- **Una columna de nutrición NO es una etapa del pipeline: quitarla es APAGAR la nutrición.** El editor de
  etapas listaba sólo el recorrido (`etapasVisibles().propias`), y las columnas de la banda Nutrición del
  tablero no existían ahí: «faltan las etapas de nutrición que hoy ya tengo en el funnel». Son el destino de
  una transición que deriva `generateFunnel`, así que su ✕ va por la op `nutricion` con TODOS los ids de esa
  nutrición (`quitarNutricion`, app/crm/EtapasModal.tsx), nunca por `eliminar`, que el server rechaza para lo
  que no es del pipeline. Renombrarlas sí va por `renombrar`: lo que no es del pipeline cae en `labels`.
- **Las fijas (Ganado y las tres de descarte) volvieron al editor, sólo con el nombre.** El 29/09 Martín las
  había sacado («ya lo pueden hacer en los 3 puntos de la columna») y el 12/10 las pidió de vuelta: «Pon
  todas las etapas directamente, incluso ganado y las de descartado... no se deberían poder editar mucho».
  El comentario de cabecera del modal dice las dos fechas, para que nadie las vuelva a sacar leyendo sólo
  la primera.
- **El desplegable de etiquetas de la ficha EXCLUYE las que el lead ya tiene, así que justo ésas no se
  podían editar.** Los tres puntos por etiqueta (`editable` en `SelectorEtiqueta`) listan también las
  puestas, APAGADAS («Ya la tiene»): el `Dropdown` de la casa deja las `acciones` de un renglón vivas aunque
  el renglón esté `disabled`, que es lo que permite editar sin poder elegirla dos veces.
- **El borrador del alta repite la trampa de los filtros guardados: restaurar y guardar corren en el mismo
  commit**, y el guardado de ese momento ve los campos vacíos. Sin el salto de la primera corrida
  (`primeraVez`, app/crm/new/NewLeadForm.tsx) borraba el borrador que se acababa de leer. Va sólo en el
  modal: la ruta /crm/new navega al crear, y un borrador borrado al enviar se perdería si el server rechaza.
- **El número de lead sigue siendo el id global (decisión del 12/10, se le delegó: «decidelo tú»).** El id
  vive en las URLs (`/crm/2646`), en los links de los avisos, en la API de MaKo y en la búsqueda por
  «#2646»; un número por negocio sería un SEGUNDO identificador, y «#12» en la búsqueda pasaría a ser
  ambiguo entre el id y el número. Es lo que hacen los CRM grandes (HubSpot, Pipedrive y Salesforce
  numeran el registro globalmente); la numeración por cuenta es de documentos (facturas, tickets).

**SIN HACER:**
- El buscador de Instagram no encontró `@martin.koncke` (captura de Martín). Sin medir por qué: lo probable
  es que la app de Meta todavía no tenga `instagram_basic` / `pages_read_engagement`, o que la cuenta no sea
  de empresa o creador (Business Discovery no ve cuentas personales). Y la fuente para buscar por nombre,
  sin elegir (Martín pidió investigar alternativas gratis a Brave). Las dos quedaron para después, a pedido.
- El editor de etiquetas de la ficha no tiene el vínculo a una etapa ni la etiqueta del WhatsApp: siguen en
  `app/crm/EditorEtiquetas.tsx`, sin montar.

**Vive en:** `app/crm/EtapasModal.tsx` (`filaQuieta`, `quitarNutricion`) · `lib/pipeline.ts`
(`etapasVisibles().nutricion`) · `app/_components/etiquetas-cliente.tsx` (`editable`) ·
`app/_components/EditarEtiqueta.tsx` · `app/crm/new/borrador-alta.ts` · `app/crm/ReunionesProximas.tsx` ·
`tests/crm-segundo-feedback-12-10.test.ts` · *2026-10-12, chat «CRM» (claude3), sin agentes*

## El tercer feedback del 12/10: el «Selecciona…» del país lo producía nuestro saneo (12/10/2026)

Pedido de Martín (12/10/2026, 11:37): «al entrar dice "seleccionado" ese desplegable, eso esta mal, debe estar
como siempre con la última selección que hice». Lo que no se ve en el código:

- **El diagnóstico obvio era el equivocado.** Parecía que al alta le faltaba un default; lo tenía (`DIAL_DEFAULT`).
  Lo que dejaba el desplegable vacío era el saneo del BORRADOR, escrito esa misma mañana:
  `txt(o.lada, 6).replace(/\D/g, '')` le sacaba el «+» a `+54`, y `54` no es ninguna opción de `PAISES`
  (todas son `+NN`). O sea que sólo fallaba cuando HABÍA borrador — por eso no se vio al escribirlo, con el
  campo limpio. **Un saneo devuelve el valor en el formato que el CONSUMIDOR compara**, y se prueba con un valor
  que hace el viaje entero (se escribe con el control, se guarda, se lee, se vuelve a dibujar). Ahora
  `sanearLada` devuelve `+NN` y sólo si está en la lista; acepta el `54` de los borradores viejos.
- **La última lada ELEGIDA es una preferencia aparte del borrador**, y se escribe en el `onLada` del control,
  nunca en un efecto: hidratar con la detectada por zona no puede convertirse en «lo que eligió»
  (AGENTS.md → «Un control que hidrata un dato guardado no escribe si la persona no tocó nada»). El orden al
  abrir es borrador → preferida → zona horaria del navegador (`paisDeCuentaMeta`, el lector de zonas de
  Ads Manager) → `DIAL_DEFAULT`, en `ladaInicial`, puro y con test.
- **La ficha del lead tenía un alto MÁXIMO, no un alto**: con poco contenido se achicaba, y con mucho dejaba
  ~96 px de margen. Ahora el alto es fijo (`ALTO_FICHA_LEAD`) y el chat de MaKo Analyst se calcula con el mismo
  margen; los dos números viven en `lead-view/ficha-medidas.ts`, que también lee el esqueleto de carga.

**SIN HACER:** las notas como los chats de MaKo (punto 3) y «A revisar» con los datos en el desplegable (punto
4); el detalle, en `docs/relevo/crm.md` §0. Los plazos de etapa como template de Automations se le pasaron al
chat «Chatbot».

**Vive en:** `app/crm/new/borrador-alta.ts` (`sanearLada`, `ladaInicial`) · `app/crm/new/NewLeadForm.tsx`
(`elegirLada`) · `app/crm/lead-view/ficha-medidas.ts` · `app/crm/EtapasModal.tsx` ·
`tests/crm-segundo-feedback-12-10.test.ts` · *2026-10-12, chat «CRM» (claude3), sin agentes*

## El editor del funnel del 12/10: el tipo de funnel ES la entrada, y «Manual» no se podía quitar (12/10/2026)

Pedido de Martín (12/10/2026, 13:11): el tipo de funnel arriba de las etapas, una sola opción, y las etapas de
nutrición «editables… incluso si las quiero eliminar todas… desplazar arrastrando». Lo que no se ve en el código:

- **El tipo de funnel NO es un dato nuevo.** La tentación era un campo `tipoFunnel`; cinco lectores (audios, ensayo,
  secuencias, generador de landings, estructurador de campañas) y el opt-in de la landing leen `funnels.data.entradas`.
  Cada tipo ES una entrada (`TIPOS_FUNNEL`, lib/pipeline.ts) y se guarda con la misma action: un campo aparte habría
  dejado a los seis leyendo el dato viejo sin un error. «Anuncios a formulario» devuelve a la pantalla
  `formulario_anuncio` (el Instant Form), que el catálogo conservaba sin ofrecerlo.
- **«Nutrición - Manual» no tenía cómo quitarse**: `generateFunnel` la coloca SIEMPRE (no sale de ninguna transición),
  y el ✕ del editor sólo existía para las nutriciones derivadas. La marca nueva es `*>manual` en `suppressed`
  (`idNutricionFija`), y quitar se pide por CLAVE (`quitarNutricion`): el server calcula qué transiciones apagar
  (`idsParaQuitarNutricion`), así el navegador no necesita saber de qué etapas sale cada nutrición.
- **El orden de la banda Nutrición no era un dato**: lo decidía el orden de colocación de `generateFunnel`. Vive en
  `data.ordenNutricion` y lo aplica el LECTOR (`ordenarNutricion` en `buildFunnel`), reordenando en el mismo lugar del
  arreglo y renumerando la `col`, así el tablero y el editor leen lo mismo. `mergeFunnelData` conserva el campo en los
  demás guardados.
- **La tabla de campañas se reusa EN LÍNEA** (`CampanasModal enLinea`), no se copia: es «el mismo que tenemos en los 3
  puntos de Leads entrantes».

**SIN HACER:** que «Marcar nutrición manual» (la ficha del lead) se apague cuando el funnel quitó esa etapa: hoy manda
al lead a una columna que no se dibuja. El rojo previo de `tests/mover-etapa-validacion.test.ts` (no es de este cambio).

**Vive en:** `app/crm/EtapasModal.tsx` (`SeccionFunnel`, `filaNutricion`, `filaFija`) · `lib/pipeline.ts`
(`TIPOS_FUNNEL`, `idsParaQuitarNutricion`, `ordenarNutricion`) · `lib/funnel-fila.ts` · `app/crm/actions.ts` ·
`app/crm/CampanasModal.tsx` · `tests/crm-funnel-editor-12-10.test.ts` · *2026-10-12, chat «CRM» (claude3), sin agentes*

## Las campañas del editor del funnel: cinco a la vista, y el «todas» tilda lo que se ve (12/10/2026)

Pedido de Martín (12/10/2026, 14:10): «Asignar a este funnel», el ícono de filtro de siempre, cinco campañas con
«Ver más», y las etapas en tarjetas para que no se confundan con la tabla. Lo que no se ve en el código:

- **Cortar a cinco cambia qué tilda la casilla de «todas».** El mapa `visibles` se armaba con `filas` (todas las que
  pasan el filtro); con el corte, tildar «todas» se habría llevado las escondidas detrás del «Ver más» y el lote las
  habría asignado sin que nadie las viera. Se arma con `filasVistas`, lo mismo que la tabla dibuja.
- **La marca del arrastre pisaba el borde de la tarjeta.** `MARCA` era un `boxShadow` y la tarjeta nueva dibuja su
  anillo con `boxShadow` (sin `border`, que le suma alto): la tarjeta destino perdía el borde mientras se arrastraba.
  La marca SUMA su raya a `SOMBRA_TARJETA`.
- **Un filtro sin «Todos»:** cada opción se prende y se apaga con un clic; sin nada prendido se ven todas.

**SIN HACER:** el punto 3 del mismo pedido (el tipo Etapa/Reunión/Nutrición en las nutriciones y el pasaje entre
bandas): el plan está en docs/relevo/crm.md §0. Y el lote ya no ofrece «Sin asignar» (se quita de a una).

**Vive en:** `app/crm/CampanasModal.tsx` · `app/crm/EtapasModal.tsx` (`SOMBRA_TARJETA`, `MARCA`) ·
`tests/crm-campanas-tarjetas-12-10.test.ts` · *2026-10-12, chat «CRM» (claude3), sin agentes*

## El tipo de una etapa decide su lista: la nutrición propia se queda en el pipeline (12/10/2026)

Pedido de Martín (12/10/2026, 14:10 y 14:54): el desplegable Etapa/Reunión/Nutrición en todas las etapas, «si se
coloca "Etapa" se desplaza automáticamente hacia arriba, y viceversa», y arrastrar a la otra lista cambia el tipo.
Lo que no se ve en el código:

- **La marca «Nutrición» dejaba la etapa en el recorrido, y había una guarda que lo FIJABA.** `marcadaComo` se
  diseñó el mismo día para no cambiar nada (`tests/etapa-reunion.test.ts`: «marcar Nutrición NO cambia transiciones»).
  Martín lo dio vuelta: ahora `generateFunnel` coloca y encadena sólo el recorrido (`recorridoDe`) y las marcadas van
  a la banda. La guarda se reescribió con la decisión nueva, citando por qué cambió.
- **La nutrición propia NO se mudó a otra clave del jsonb.** Era la salida obvia (`data.nutricionesPropias`). Pero
  ~10 caminos guardan `data.pipeline` tal cual lo leyeron (el onboarding, la API de MaKo, cada op del editor); con la
  etapa en otra clave, el primero que guardara sin conocerla la borraba. Se queda en el pipeline con la marca, antes
  del cierre (`armarPipeline`), y `problemasDePipeline` mira el recorrido para no leerla como «algo después del cierre».
- **Una nutrición de catálogo que sube al recorrido entra con SU clave** (`nutri`, `manual`…) y se suprimen sus
  transiciones; al bajar se des-suprimen y conserva el nombre en `labels`. La clave es lo que ata a los leads a su
  columna: con una clave nueva se habrían quedado afuera.
- **El pago conserva su tipo** al pasar por Etapa o Nutrición (`conTipo`): un arrastre de Facturando a la banda y
  de vuelta no puede perder «No paga aún» ni lo que pide al mover un lead.
- **Una revisión con agentes se cortó a pedido de Martín** («no necesitas multi agente para esto... Son cambios
  faciles»): no dejó hallazgos. Los dos de abajo salieron de leer los lectores a mano.

**SIN HACER:**
- Los prompts que describen el recorrido leen `f.pipeline` y listan una nutrición propia como un paso
  (lib/campaign-structurer.ts, lib/ig-writer.ts, lib/landing-analyst.ts, lib/landing-writer.ts, lib/video-planner.ts;
  también `funnel.pipeline` en lib/objectives.ts y lib/cerebro-grafo.ts). Es como era antes del cambio; el arreglo es
  `recorridoDe(f.pipeline)`.
- Una nutrición de catálogo subida al recorrido sigue contando como nutrición para `NUTRI_KEYS`: mover un lead ahí
  marca `nutricion_realizada` y abre la sección de nutrición de la ficha (lib/leads.ts, app/crm/edit-logic.ts).

**Vive en:** `lib/etapa-banda.ts` · `lib/pipeline.ts` (`esNutricionPropia`, `recorridoDe`, `generateFunnel`) ·
`lib/etapa-reunion.ts` (`puedeTenerTipo`, `conTipo`) · `app/crm/actions.ts` · `app/crm/EtapasModal.tsx` ·
`tests/crm-etapas-banda-12-10.test.ts` · *2026-10-12, chat «CRM» (claude3), sin agentes*

## Pasar un lead a «Agenda» a mano pide la FECHA de la reunión y nunca la HORA (13/10/2026)

Lo encontró el chat de Automations (`claude2`) buscando por qué no salió «Un Lead Agendó Llamada» en el ws1 (bug 5 de la
reunión del 13/10). El asistente de mover de etapa (`StageMoveData`, app/crm/actions.ts) trae `fechaJ1` / `fechaJ2` y
no trae hora: graba `fecha_junta_1` y deja `junta_1_at` en null. Sólo Calendly (y «Reagendar», que sí acepta hora) la pone.
Consecuencias en Automations: un recordatorio «1 hora antes de la reunión» no tiene a qué hora anclarse, y a un lead agendado
a mano no le llega nunca. Hasta el arreglo del 13/10 (`laReunionYaPaso`, lib/nutricion-reinscripcion.ts), una R1 de HOY
cargada después de las 12 hacía que MaKo diera la reunión por pasada y cortara el flujo entero, también el primer mensaje.
**Sin hacer:** pedir también la hora (opcional) en ese paso del asistente, igual que «Reagendar» (`instanteDeLocal` con la
zona del workspace). Ojo: la hora de una reunión NO entra en `lead_audit` (`AUDIT_FIELDS` tiene la fecha y no `junta_1_at`).

**Vive en:** `app/crm/actions.ts` (`StageMoveData`, el paso de la reunión del asistente) · `lib/leads.ts` (`AUDIT_FIELDS`)

## Un pago de menos BORRABA la diferencia, y un pago fuera del plan no tenía dónde entrar (13/10/2026)

**El pedido.** Mauricio, en la reunión del 13/10 (min. 87, leído en el transcript): «yo no pude ponerle el tema
cuando es un pago diferente». Martín: «tengo que terminar de configurar la pestaña de pagos en el CRM para que esté
bien fácil de manejar». Antes, en el min. 66 de la misma reunión, el «0» de pagos no se dejaba editar.

**El diagnóstico obvio era el equivocado.** Parecía que faltaba un campo de monto: el registro manual de «Marcar
pagada» YA dejaba cambiar el monto. Lo que estaba mal es lo que pasaba DESPUÉS: `marcarPagoManualAction` escribía el
monto nuevo en la cuota y la marcaba pagada, así que una cuota de USD 500 cobrada con USD 300 quedaba «pagada por
300» y los 200 que faltaban **desaparecían** del plan, del Outstanding y de «A quién cobrarle». Sin error, y con el
cliente debiendo plata que ninguna pantalla mostraba.

**Cómo quedó.**
- **Un pago de menos pregunta qué pasa con la diferencia**, pegado al botón de confirmar: «Quedan pendientes»
  (default: una cuota NUEVA con el mismo vencimiento, numerada después de la última porque el índice único es
  `(lead_id, numero)`) o «Es un descuento». La diferencia se inserta ANTES de marcar: si el insert falla, la cuota
  vuelve a su monto y no se marca nada.
- **«Registrar otro pago»** (y «Registrar un pago» en una ficha sin cuotas): un cobro fuera del plan (un adelanto,
  un extra, otro esquema). Entra como una cuota nueva y se marca por `marcarPago`, el choke point de siempre (lo
  cobrado del lead y el corte de los recordatorios de cobranza). **No toca el monto de cierre**: si fue una venta
  nueva, se corrige en el deal.
- **Con una diferencia pendiente no se ofrece el «Deshacer» del toast**: desmarcar la cuota dejaría viva la cuota
  nueva de la diferencia y el plan sumaría de más.
- **Una sola implementación, dos puertas**: la regla vive en `lib/pagos-diferencia.ts` (pura, con test) y la escritura
  en `cobrarCuota` / `registrarPagoSuelto` (lib/pagos.ts). La ficha y la API de MaKo las llaman: `marcar_pago_cobrado`
  acepta `montoUsd` y `resto`, y `registrar_pago_suelto` es nueva (regla de Martín del 13/10: toda funcionalidad nueva
  va a la API).

**SIN HACER:** el «0» de pagos que Martín le pidió tocar a Mauricio en el min. 66 de la reunión no se pudo ubicar con
certeza (la ficha tiene varios ceros); si es el contador de cuotas, hoy «Registrar un pago» cubre el caso. Y un pago
de MÁS se registra entero en la cuota (el plan suma de más y el banner de Editar lo dice): no se reparte entre las
cuotas siguientes.

**Vive en:** `lib/pagos-diferencia.ts` · `lib/pagos.ts` (`cobrarCuota`, `registrarPagoSuelto`, `marcarPago`) ·
`app/crm/[id]/deal-actions.ts` · `app/crm/[id]/DealDetailsCard.tsx` (`PayModal`, `PagoSueltoModal`) ·
`lib/api-mako/areas/crm.*` · `tests/pagos-diferencia.test.ts` ·
*13/10/2026, claude2*
