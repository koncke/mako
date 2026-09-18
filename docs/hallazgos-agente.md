# Hallazgos — el agente del cliente (skill, hook y telemetría)

Todo lo que vive en `lib/agente-*.ts`, `app/api/agente/**` y el tutorial de
`app/integraciones/IntegracionesBoard.tsx`: la skill que el cliente instala en SU Claude
Code, el hook que reporta sus sesiones, y lo que MaKo hace con eso.

---

## La telemetría no puede vivir en la skill, y no es una cuestión de estilo

**Vive en:** `lib/agente-plugin.ts`

La regla de AGENTS.md —«una regla en un prompt no es una regla»— acá tiene una
consecuencia concreta que conviene tener escrita, porque la alternativa es tentadora:
sale mucho más barato agregarle a la skill «al terminar, mandale el resumen a MaKo» que
construir un hook.

El problema no es que se cumpla el 90% de las veces. Es **cuáles** son ese 10%. Una
sesión reporta si el modelo llega al final y se acuerda; o sea que reportan las sesiones
**que terminaron bien**. Las que se cortan a la mitad, las que el usuario abandona
enojado, las que se quedan sin cuota —exactamente las que dicen dónde falla el
producto— no reportarían nunca. El dato no llegaría incompleto: llegaría **sesgado
justo en contra de para qué se lo junta**.

Por eso son dos piezas separadas y se presentan como dos pasos distintos en el tutorial:
la skill (paso 2) la lee el modelo, el hook (paso 3) lo corre el runtime. Juntarlos en un
solo paso hace que el usuario instale la skill y asuma que ya reporta.

---

## Cómo se evita que la redacción tenga una copia: se genera, no se copia

**Vive en:** `lib/agente-plugin.ts` + `lib/agente-redaccion.ts`

El tapado de credenciales tiene que correr **en la máquina del cliente**, antes de que el
texto salga por la red. El proyecto del cliente no puede importar `@/lib`, así que el
camino obvio es copiar la tabla de expresiones al script — y esa copia se queda vieja,
que es la cicatriz del contrato del `detalle` que documenta AGENTS.md.

Acá no hay copia y **tampoco hay un `scripts/sync-*.mjs`**: el script se arma en el
momento de pedirlo, y se generan las dos cosas:

- **la tabla**, serializando cada `RegExp` por su `.source` y sus `.flags`;
- **el algoritmo**, con `redactarCon.toString()`.

De ahí salen dos restricciones que hay que respetar al tocar `redactarCon`:

1. **Tiene que ser autocontenida.** Si usa cualquier cosa del módulo (una constante, otra
   función, un import), el script generado la referencia sin tenerla: **rompe en la
   máquina del cliente y no acá**. Por eso `MARCA` se declara adentro.
2. **Las reglas entran por PARÁMETRO, no por nombre.** Un bundler que minifique renombra
   las variables de módulo y la referencia deja de resolver; un parámetro se renombra de
   forma consistente adentro de la propia función.

La segunda no se puede verificar leyendo: hay que correr el script generado. Para eso
existe el modo `autoprueba` y el test «el script del cliente tapa EXACTAMENTE igual que
el servidor», que lo corre **en otro proceso** y compara contra la redacción del
servidor sobre el mismo corpus.

---

## Dos reglas de redacción que se pisan: el texto sale roto y la alarma se infla

**Vive en:** `lib/agente-redaccion.ts` · **Encontrado:** probando el hook de punta a
punta contra un servidor de mentira, no leyendo el código ni con los tests que ya había.

**Síntoma.** Con el texto `mi ANTHROPIC_API_KEY=sk-ant-api03-…`, lo que salía era:

```
ANTHROPIC_API_KEY=«tapado» de Anthropic tapada»
```

**Causa.** Las reglas se aplicaban una atrás de otra sobre el texto ya modificado. La
regla de Anthropic corría primero y dejaba `ANTHROPIC_API_KEY=«clave de Anthropic
tapada»`; después la regla de `.env` matcheaba `ANTHROPIC_API_KEY\s*[=:]\s*\S+`, y ese
`\S+` **agarra solo hasta el primer espacio** — o sea la palabra `«clave` — dejando el
resto del reemplazo colgando afuera.

**Por qué importa aunque el secreto quedara tapado.** No era un agujero: la clave no se
escapaba. Eran dos cosas:

- un texto roto que después alguien tiene que leer en SuperAdmin, y
- **el contador de `redacciones` contando 4 donde hubo 3**. Ese contador no es
  cosmético: es la alarma que avisa si el filtro de «solo turnos humanos» está dejando
  pasar salidas de herramientas. Una alarma que cuenta de más no se puede mirar, y una
  que no se mira es una que no existe.

**Arreglo.** Cada regla deja un **marcador temporal** —un NUL, el número, otro NUL— en vez de su
texto final, y recién al terminar se cambian todos por el texto de verdad. Y cuando una
regla se come marcadores de otra, esos se **descuentan** del contador: ese secreto ya se
contó y desaparece adentro del reemplazo nuevo.

El NUL no es capricho: el marcador tiene que ser algo que **no pueda aparecer en un texto
tipeado por una persona**. Con espacios o guiones, «hay 3 cosas» se comería el reemplazo
de otra regla. Hay un test que fija exactamente eso.

**La regla que queda:** en una cadena de reemplazos por expresión regular, **el
reemplazo de una regla es entrada de la siguiente**. Si los reemplazos son texto legible
—y acá lo son a propósito, «clave de Anthropic tapada» es más útil que `[REDACTED]`—
hay que sacarlos del camino mientras corre el resto.

---

## Lo que no se pudo verificar desde acá, y cómo se compensó

**Vive en:** `lib/agente-plugin.ts`

El nombre exacto de los campos que Claude Code le pasa a un hook por stdin no se puede
confirmar desde este repo. Un hook que espera `prompt` y recibe otra cosa **no reporta
nada y no avisa** — el peor modo de falla posible para telemetría, porque se ve idéntico
a «el cliente no lo instaló».

Tres cosas compensan eso, y si alguien toca el script conviene no sacarlas:

1. **Plan B por transcript.** Si no viene `prompt`, el script busca el último turno
   humano en el `transcript_path`.
2. **Modo `probar`.** `node .claude/hooks/mako-telemetria.mjs probar` manda una sesión de
   prueba y dice si llegó. El cliente lo comprueba el día uno en vez de descubrirlo en un
   mes.
3. **El buffer no se borra si el POST falla.** El próximo cierre reintenta, y el endpoint
   hace upsert por `(workspace, sesión)`, así que no duplica.

Y una decisión de la que depende que nadie se enoje: **el hook siempre sale con 0**
(salvo en `probar`). Una sesión del cliente no se rompe nunca porque la telemetría no
pudo salir.

---

## Lo que quedó sin hacer

- **Nada postea todavía desde una instalación real.** Todo lo verificado es contra un
  servidor de mentira y con los tests; falta un cliente con el hook puesto de verdad.
  Los nombres de los eventos (`UserPromptSubmit`, `SessionEnd`) y los campos del stdin
  son la parte a confirmar. Vive en `lib/agente-plugin.ts` (`AGENTE_HOOK_SETTINGS`).
- **El acta no dice de qué se trató la sesión**, solo lo que se puede contar: turnos,
  minutos, herramientas usadas, proyecto. El tema hay que sacarlo de los turnos, y hoy
  eso no lo hace nadie. Vive en `app/admin/agente/page.tsx`, que a propósito no llama a
  ninguna IA.
- **La purga de turnos a los 90 días** se apoya en `purgar_despues` y **no hay nada que
  la corra**. Vive en `supabase/migrations/0124_agente_telemetria.sql`. Hoy la columna
  está escrita y los turnos no se borran solos.

---

## La skill no tenía los números, y la causa no era un olvido: era una decisión ajena

**Vive en:** `lib/agente-contexto.ts` · `lib/cerebro-grafo.ts` · **Encontrado:** 02/09/2026,
corrida de 47 agentes, a partir de «no creo que esté tomando ABSOLUTAMENTE todos los datos
de cada cliente».

**Síntoma.** El Claude del cliente sabía su oferta, sus avatares y su voz, y no podía
contestar cuánto invirtió ni cuántas reuniones se hicieron. Mauricio lo pidió textual:
«quiero ver un trimestre: inversión en Meta, impresiones, llegadas al landing VSL, juntas
agendadas, juntas 1 realizadas, j2 realizadas… ¿puedo bajar la data?».

**El diagnóstico obvio era el equivocado.** No faltaba cablear una fuente: **el cable no
existía**. `construirCerebro()` hace 21 lecturas y las 21 son de onboarding — cero
referencias a `marketing_metrics_daily`, `spend`, impresiones o leads en sus 988 líneas. Y
eso **está bien** y está escrito acá al lado: el grafo excluye el volumen a propósito
(«ni agregados aportan un nodo»), porque un nodo es algo que alguien señala y dice «eso es
mío».

**La causa real es que la skill colgaba del mismo pozo.** `agente-contexto.ts` reusa los
getters del cerebro, así que **heredó una restricción de diseño GRÁFICO como si fuera un
límite de DATOS**. Las siete rutas de `/api/agente/*` no tocaban una sola tabla de métricas.

**La regla que queda:** cuando una capa nueva se construye reusando los getters de otra,
hereda también sus EXCLUSIONES — y las exclusiones de la primera se decidieron para su
medio, no para el nuevo. Antes de reusar un ensamblador, preguntá qué dejó afuera **a
propósito** y si ese propósito aplica acá. Un grafo que no muestra un contador y una API
que no lo devuelve se ven iguales en el código y son cosas distintas.

**Lo que sí se puede contestar, y sin migración:** las tres fuentes existen, tienen fecha
por fila y están en `TENANT_TABLES` (o sea que `getTenantDb()` las aísla sola):
`marketing_metrics_daily` (gasto e impresiones por día), `landing_visits` + `vsl_events`
(el tráfico propio) y `leads` (`fecha_agenda`, `fecha_junta_1`/`asistio_j1`,
`fecha_junta_2`/`asistio_j2`, `fecha_cierre`). Vive en `lib/metricas-negocio.ts`.

---

## Cuatro formas de que el reporte de un trimestre salga mal sin dar error

**Vive en:** `lib/metricas-negocio.ts` (las cuatro están implementadas y comentadas ahí).

1. **`asistio_j1` es TRI-ESTADO y el NULL no es un «no vino».** El único camino automático
   a `true` es que el CRM automático encuentre una **grabación de Fathom**; sin esa
   integración, `encuentroGrabable()` deja el campo en NULL a propósito. O sea que un
   negocio que hizo sus 40 reuniones sale con «0 realizadas». Y el funnel del dashboard
   deriva el no-show como `programadas − realizadas`, que mete a **todos los sin marcar**
   adentro del no-show: el número es plausible y está inflado. Van tres columnas separadas
   (`realizadas` / `noshow` / `sin_marcar`), nunca una resta.
2. **Las fechas de reunión se PISAN al reagendar y se BORRAN al cancelar.** Una R1
   reservada en enero y movida a abril cuenta en abril y desaparece del primer trimestre;
   una reunión futura cancelada deja `fecha_junta_1 = NULL` y sale del reporte entera. El
   número honesto es «reuniones que HOY tienen fecha en este período», y hay que decirlo
   con esas palabras.
3. **Hay tráfico que no es tráfico, y son tres fuentes distintas.** La columna `prueba`
   (mig 0134, el probador de /integraciones), el **preview del editor de Lovable**
   (`id-preview--*.lovable.app`, `*.lovableproject.com` — hay `esPreviewDeEditor()` en
   `lib/landing-paginas.ts`, no se copia la regla) y el **autoplay** del VSL (`auto`, mig
   0136 — se filtra con `not is true`, nunca con `eq false`: `auto` es NULL en todo lo
   anterior a esa migración y NULL es «no lo sé»).
4. **Las dos mitades del informe usan CALENDARIOS distintos.** `marketing_metrics_daily.fecha`
   es día local del workspace (lo escribe `ayerEnTijuana`), y el resto del dashboard corta
   `created_at` con `.slice(0,10)`, que es **UTC**. Poner las dos series lado a lado corre
   los eventos propios hasta 8 horas al día siguiente — justo cuando se las compara. Se
   convierte con `hoyEnTz(zona, …)`, y las columnas `DATE` se cortan directo (una DATE no
   tiene zona; convertirla sería inventarle una).

**Y la quinta, que no es del dato sino de la moneda:** `spend` viene en la **moneda de la
cuenta publicitaria** (MXN en la de Mauricio) y `TIPO_DE_CAMBIO_USD_MXN` es una constante
**escrita a mano** en `lib/config.ts`, sin retroactividad. Un trimestre viejo convertido a
dólares usa la tasa de hoy. El número primario es el crudo; el USD va como derivado y con
la tasa a la vista.

---

## Un `null` y un `0` no se dicen igual, y en una planilla la diferencia es una mentira

**Vive en:** `lib/metricas-modelo.ts` (`FilaMetricas`, `celda`).

Un `0` en la columna «inversión» AFIRMA un hecho del negocio («no invertiste»). Un `null`
dice lo único que sabemos («no tenemos de dónde leerlo» — el workspace no tiene Meta
conectado). Colapsarlos es la versión numérica de «un verde que cierra la pregunta sobre
algo que se está perdiendo».

Por eso el reporte lleva un bloque `cobertura` que dice, por fuente, si hay datos y **qué
mirar si no los hay**; en el CSV un `null` sale como **celda vacía**, nunca como `0` ni
como la palabra «null»; y en el markdown sale como raya. Hay un test que fija exactamente
eso, porque es lo primero que se pierde en un refactor: `tests/metricas-modelo.test.ts`.

Y el corolario del rango: **un mes sin una sola fila APARECE igual**, con ceros. Las claves
salen del rango PEDIDO y no de los datos que volvieron — si se omitiera, el que lee la
tabla no puede distinguir «no pasó nada» de «no se midió», y esas dos cosas llevan a
decisiones opuestas.

---

## Exponer las tools de otro módulo: la lista va en POSITIVO, aunque hoy sean todas de lectura

**Vive en:** `lib/agente-consultas.ts` (`CONSULTAS_AGENTE`, :37-51) · `app/api/agente/consultar/route.ts`.

`/api/agente/consultar` corre `runMakoTool` —las MISMAS herramientas que MaKo adentro de
la app— en vez de reimplementar nueve lecturas. Eso es «una cosa, un lugar» y es correcto.
Lo que **no** se puede hacer es derivar la lista de lo expuesto de `MAKO_TOOLS`: la cabecera
de ese módulo dice que los «proponer» (escrituras) llegan en la próxima fase, así que una
lista derivada expone sola la primera que alguien agregue allá. La lista nombra lo que SÍ
entra, y un test falla cuando `MAKO_TOOLS` crece — obliga a **decidir**, en vez de que la
decisión la tome el default.

**Y los nombres de los parámetros se sacan del `input_schema`, no de lo que parezca.** Tres
de los nueve no se llaman como uno esperaría (`buscar_tutorial` pide `tema`,
`buscar_conocimiento` pide `query`, `reuniones_recientes` no acepta `limite`), y un nombre
equivocado **no da error**: la lib lee una clave que no llegó y contesta «pasa un texto para
buscar», como si el agente no hubiera mandado nada. Los cruza `tests/agente-consultas.test.ts`
contra el fuente de `mako-tools.ts` — se lee del archivo porque ese módulo lleva
`server-only` y no se puede importar desde un test.

⚠️ **16/09/2026 — esta lista en positivo ya no coincide con la del registro de la API de
MaKo.** El registro declara sin `'http'` dos de las diez: `historial_whatsapp`
(`lib/api-mako/areas/whatsapp.def.ts:54-60`, bajo la regla «las conversaciones con
personas no salen por HTTP») y `reuniones_lead` (`lib/api-mako/areas/crm.def.ts:60-67`,
porque `fathomR1`/`fathomR2` traen el `share_url` de Fathom — el link público a la
grabación y la transcripción de una llamada de venta, armado en
`lib/auto-reuniones.ts:120-138`). Esta puerta vieja las sirve igual por bearer
(`CONSULTAS_AGENTE`, `lib/agente-consultas.ts:40-41`), y la skill instalada las enseña
(`lib/agente-skill.ts:317-318`). `tests/api-mako-http.snapshot.txt` no lo ve: mira el
registro, no `/api/agente/*`. Mientras esas dos entradas existan, la regla no se cumple.

**Pendiente (decisión de producto):** sacarlas de `CONSULTAS_AGENTE` rompe las skills ya
instaladas; dejarlas es aceptar que la conversación y el link de la grabación salen por
HTTP. No lo decidió la corrida. El lado del registro está en `docs/hallazgos-api-mako.md`
→ «Lo que el registro declara sin `'http'` puede salir igual por una puerta vieja». Ojo:
ahí dice que `reuniones_lead` «ahora es `SIN_HTTP`», y lo es en el registro, no en esta
puerta. *2026-09-16 api-mako-areas*

---

## El texto de la skill lo lee el CLIENTE, así que no va en rioplatense

**Vive en:** `lib/agente-skill.ts` · **Lo cazó:** `tests/puente-panel-copy.test.ts`, no una
revisión.

Al sumarle las secciones nuevas a la skill se colaron un «decile» y un «decilo». La regla ya
está en AGENTS.md («la voz de MaKo es rioplatense, y el texto DEL CLIENTE no») y aun así se
escribió, porque el resto del archivo tiene la voz de la casa en los comentarios y la
frontera no se ve al escribir. **Lo que la hace cumplir es el test, no la regla.** Vale la
pena recordarlo cada vez que se le agrega una sección a un `.md` generado: el archivo es
mitad documentación interna y mitad producto.

---

## El pie de `contextoParaAgente` habla en HTTP, y lo leen canales que no tienen esa URL

**Vive en:** `lib/agente-contexto.ts:146-157` · `lib/api-mako/areas/negocio.run.ts:88-97` ·
**Encontrado:** 16/09/2026, corrida api-mako-areas.

El núcleo termina con «Si necesitas más… `GET /api/agente/contexto?seccion=…`». Está escrito
para la skill de Claude del cliente, que tiene esa URL. Envuelto en la API de MaKo como
`contexto_negocio`, lo leen también MaKo por WhatsApp y el chat de la app, que no la tienen
y no saben que lo que corresponde es volver a llamar la operación con `seccion`. Un modelo
que lee una instrucción de otro canal intenta cumplirla, o la informa como una capacidad que
no tiene.

**Cómo está hoy.** El runner lo traduce con un `replace` sobre el texto ya armado
(`negocio.run.ts:93`: la URL entre backticks pasa a `contexto_negocio con seccion=«razones»`).
Funciona, y es frágil de la peor forma: la regex copia el formato de una línea de OTRO
módulo (`agente-contexto.ts:152`) y ningún test la corre. Si alguien cambia los backticks o
la ruta allá, el `replace` no matchea, no da error, y la URL vuelve a llegar a WhatsApp.

**La regla que queda:** cómo se pide más lo dice el canal que sirve el texto, no el núcleo
compartido. Un texto compartido que nombra su propio transporte obliga a cada canal nuevo a
parchearlo por afuera.

**Sin hacer:** que `contextoParaAgente` reciba por parámetro cómo se pide una sección, en vez
de traerlo escrito. Mientras tanto, un test que corra el runner sobre la salida real y falle
si queda `/api/agente/contexto` adentro.

---

## La instalación se probó en vivo y se trabó tres veces: la pantalla tenía DOS caminos y uno estaba en letra chica

**Vive en:** `app/_components/TutorialAgente.tsx` · `lib/agente-skill.ts` ·
**Encontrado:** 09/09/2026, instalándole la skill al dueño en su Claude, con él mirando.

El dueño **no usa la terminal: usa la app de escritorio**, y la pantalla estaba escrita para
la terminal con la app como nota al pie. Tres tropiezos, y ninguno es un bug de código:

1. **Dos slash-commands pegados en un solo mensaje NO corren.** El bloque copiaba
   `/plugin marketplace add …` y `/plugin install …` juntos, con un «uno por vez» escrito
   arriba que nadie lee cuando hay un botón que dice «Copiar los comandos». Hubo que
   decírselo por voz. Lo que destrabó fue el bloque alternativo —pedirle la instalación con
   palabras—, que vivía abajo, en gris y en letra chica.
2. **«Ponlo ahí» sobre un archivo que empieza con punto es una instrucción imposible.** La
   skill decía «pídeselo al usuario y guárdalo ahí con permisos 600», sin la ruta absoluta y
   sin avisar que el explorador de Windows esconde los dotfiles. Textual, del dueño:
   «Nomás me dice que lo ponga ahí. No dice dónde». Terminó apretando Ctrl+Shift+. para ver
   la carpeta oculta.
3. **El botón de copiar decía «¡copiado!» en el bloque equivocado.** Las claves de copiado
   eran dos para cuatro cosas copiables, y el bloque de la app usaba la del token.

**Las reglas que quedan:**

- **Dos caminos distintos no son uno principal y una nota al pie: se PREGUNTA cuál.** Si la
  pantalla sabe que hay dos entornos, pregunta en cuál está la persona y muestra uno. Una
  alternativa en gris abajo de todo la lee quien ya no la necesita.
- **Un botón que copia dos comandos es un botón que arma el error.** Si hay que mandarlos de
  a uno, se copian de a uno; el texto que lo aclara no alcanza contra el botón que lo
  contradice.
- **Una instrucción sobre un archivo dice la RUTA ABSOLUTA, resuelta**, y si el archivo
  empieza con punto lo dice y da el atajo para ver ocultos. Un `~/.algo` no es una ruta para
  quien no vive en una terminal.
- **Y el dato secreto no viaja por donde no tiene que viajar.** El token vive en un archivo
  justamente para no pasar por Anthropic, así que la skill da el comando armado para que lo
  corra la PERSONA en su terminal. Pegarlo en el chat sigue estando, como alternativa
  explícita y avisando que ahí sí viaja.
- **Una clave de estado de UI por cosa**, o el «¡copiado!» aparece donde no se apretó nada.

⚠️ Y lo que esto dice del método: **el que instala también escribió la pantalla**, así que
para él la letra chica no es chica. Lo único que encontró los tres tropiezos fue verlo
instalar a alguien que no sabe dónde está parado.

---

## Lo que quedó sin hacer (métricas del agente)

- **El reporte no tiene grano `trimestre`.** Se pide con `desde`/`hasta` y `grano=mes`, que
  alcanza, pero «Q1 2026» hay que traducirlo a fechas a mano. Vive en
  `lib/metricas-modelo.ts` (`GRANOS`).
- **`reach` y `frequency` no están y no pueden estar sumados** (no son aditivos). El único
  valor correcto lo da Meta en vivo, y **solo por ANUNCIO o por CAMPAÑA**:
  `/api/ad-insights` y `/api/entity-insights` devuelven `period.reach`. ⚠️
  `/api/account-insights` **NO** los devuelve —solo `demograficos`, `plataformas`,
  `regiones`, y ni siquiera le pide `frequency` a Meta—, así que a nivel CUENTA ese número
  hoy no existe.
- **Los plays del VSL tienen TRES fuentes y el reporte usa una** (`vsl_events`). Las otras
  dos viven en `marketing_metrics_daily` con `plataforma='panda'` (`video_plays`) y la
  historia de YouTube. No se mezclan porque miden cosas distintas, pero un total «de
  verdad» las necesitaría.
- **`curvaRetencion()` e `histogramaAbandono()` (`lib/vsl-retencion.ts`) son código muerto**:
  sus únicos importadores son los tests. La lógica está escrita y testeada y ninguna
  pantalla, API ni reporte la llama. Lo mismo `getVslSerie` (`lib/queries.ts`), que además
  solo acepta «últimos N días terminando hoy».
- **Las R2 sin match de lead no están en `leads`**: el webhook nunca crea un lead desde una
  segunda reunión (en Calendly van a `review_queue` como `j2_sin_match`; en Cal.com se
  pierden con un `console.warn`). El total real de R2 puede ser mayor que el del reporte.
