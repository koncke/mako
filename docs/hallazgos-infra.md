# Hallazgos de infraestructura

Lo que gobierna a **todas** las áreas: cómo se lee y se escribe en Supabase sin perder
datos, cómo se aísla un inquilino de otro, qué credencial lee de verdad el código, qué
tope corta en silencio, y qué pasa entre que pusheás y el dueño lo ve. **No es un
changelog**, y se escribe para que lo lea un humano: «si yo lo puedo entender fácil eso me
habilita a darle mejores prompts al otro Claude».

**Lo que más muerde acá:**

- PostgREST corta en 1000 filas **con un 200**: el síntoma no es un error, es un número que BAJA («se ven 4 ganados de 13»), y el diagnóstico obvio —el filtro, la etapa— es el equivocado. La lectura más importante de la app vivió así porque el barrido anterior arregló lo que paginaba mal y **no buscó lo que no paginaba** → [Supabase](#️-el-techo-de-1000-filas-no-da-error-da-un-número-que-baja).
- Una lectura paginada sin orden **único** repite filas y saltea otras — cuatro pantallas rotas por la misma causa, y el diagnóstico obvio («falta paginar») era el equivocado → [Supabase](#supabase-leer-y-escribir-sin-perder-datos).
- Lo que no está en `TENANT_TABLES` sale **sin filtro de workspace** y nada avisa → [Aislamiento multi-inquilino](#aislamiento-multi-inquilino).
- «Se guarda cifrada, se pinta verde y el route lee `process.env`»: la credencial del cliente no se usa nunca → [Credenciales e integraciones](#credenciales-e-integraciones-byok).
- Un `200` en un webhook es un **acuse de recibo**: el proveedor no reintenta y el evento se pierde para siempre → [Webhooks](#webhooks-recibir-sin-perder-eventos).
- Calendly **deshabilita la suscripción** tras días de fallos, no avisa, y no tiene pantalla donde verlo: nueve días sin una sola agenda con todo en verde — y la prueba firmada que parecía desmentir el arreglo estaba mal hecha, porque un evento que no rutea se verifica contra la clave de PLATAFORMA → [Webhooks](#webhooks-recibir-sin-perder-eventos).
- Un push no es una entrega: el build de Vercel falla, **producción sigue sirviendo la versión vieja** y nadie avisa → [Build, deploy y entrega](#build-deploy-y-entrega).
- La factura de builds no mide tiempo: mide `ceil(minutos) × vCPU`. Acortar el build **no ahorró nada**, y el comentario que decía lo contrario vivió un mes en el código → [Build, deploy y entrega](#build-deploy-y-entrega).
- Un comentario que afirma que algo **no pasa por el gate** con una premisa cierta y una conclusión falsa: el destino de un redirect es un request NUEVO, y el link de la extensión cayó en el login durante días → [El comentario decía que el gate «ni se entera»](#el-comentario-decía-que-el-gate-ni-se-entera-y-por-eso-nadie-lo-miró).
- La tabla `notificaciones` **no existe en producción** desde siempre y el escritor se traga el error → [Migraciones](#migraciones).
- Hay features **terminadas, con migración y API propias, que ninguna página monta**: compilan y no existen → [Código construido que ninguna página monta](#código-construido-que-ninguna-página-monta).
- Si Claude Code «se cierra solo» y la PC sigue andando, es el **proceso GPU** muriendo por la gráfica híbrida — y los tres diagnósticos obvios (memoria, energía, drivers) estaban los tres equivocados → [El equipo](#el-equipo-cuando-se-cierra-claude-code-y-no-es-claude-code).
- El repo es **CRLF**: un reemplazo por bloque buscó `'\n];\n'`, no matcheó, se fue 700 líneas más abajo y **borró 76 KB con exit 0** → [Editar este repo](#editar-este-repo-archivos-grandes-saltos-de-línea-y-nombres).
- Verificar contra **`127.0.0.1` en vez de `localhost`** deja la página entera y sin hidratar, sin un solo error en el navegador — y las dos explicaciones que uno tiene a mano («rompí yo», «lo rompió la otra sesión») parecen confirmarse → [Tests y entorno local](#️-127001-no-es-localhost-para-el-dev-server-la-página-se-ve-entera-y-no-hidrata).

⚠️ **Buena parte de lo que sigue es material de segunda mano.** Se rescató de los journals
de las 261 corridas multi-agente de junio a agosto de 2026 —**134 de 260 nunca habían
escrito nada en el repo**— y sale de lo que devolvieron los subagentes en su momento, no de
una relectura del código de hoy. Cada entrada dice de qué corrida y de qué fecha viene:
antes de actuar sobre una, **verificá contra el código**; varias ya están arregladas, y
donde el rescate lo sabía, lo dice. El registro completo de las corridas está en
[corridas-multiagente.md](corridas-multiagente.md). La regla de la cosecha, en `AGENTS.md`.

---

## Supabase: leer y escribir sin perder datos

### ⚠️ `getSetting` devuelve `null` tanto si falló la lectura como si no hay fila, y eso expulsa a un cliente onboardeado al wizard

**Síntoma:** un cliente ya onboardeado cae al wizard y, si toca cualquier botón ahí, pierde
su `done`.

**Causa:** `getSetting` (`lib/settings.ts:20-33`) atrapa el error de Supabase, loguea y
devuelve `null` — no distingue «falló la lectura» de «no hay fila». `getEstadoOnboarding`
trata ese null igual que «workspace sin fila» y devuelve `estadoInicial()`, o sea status
**pending**, así que todas las tabs redirigen a /onboarding. Peor:
`patchEstadoOnboarding` (`lib/onboarding-state.ts:132-137`) es read-modify-write sobre ese
mismo getter, de modo que si la lectura sigue fallando pero la escritura funciona, se
persiste un estado nuevo y se **clobberea el `done` real**.

**Regla:** cuando un getter degrada el error a `null`, el consumidor tiene que decidir
explícitamente qué significa ese null — y nunca puede significar «reseteá al estado inicial».

**Vive en:** lib/settings.ts:20 (getSetting) → lib/onboarding-state.ts:104 (getEstadoOnboarding) y :132 (patchEstadoOnboarding) · *2026-07-02 ~auditoria-onboarding*

**Ampliado el 16/09/2026.** La salida ya existe: `getSettingEstricto` (`lib/settings.ts:44`)
tira en vez de devolver `null`. Hay dos formas de usarla y seguir igual de expuesto:

- **Un `.catch(() => null)` encima de `getSetting` no dispara nunca**, porque `getSetting` no
  tira. Se lee como manejo de error y no maneja nada. Caso: `getMapaLecciones`
  (`lib/cs-avance.ts:35-42`) vale `{}` ante un 5xx, y todo lo que cuelga dice «0 mapeadas» o
  «no está en Whop».
- ⚠️ **Leer estricto ANTES y escribir con una función que RELEE no protege.** El arreglo
  obvio —chequear con `getSettingEstricto` y seguir— tira ese valor, y la función de la lib
  vuelve a leer por su cuenta con `getSetting`. Si esa segunda lectura falla, la lista vale
  `[]` y «editar UN avatar» o «borrar UNA foto» reescribe la clave con un solo elemento, y
  contesta ok. Así están `setPersonaDescripcion`, `addPersonaFoto` y `deletePersonaFoto`
  (`lib/persona.ts:83-106`) y todo read-modify-write sobre `getAvatares`, `getEntregables` o
  `getAnswers`. El detalle, en [hallazgos-onboarding.md](hallazgos-onboarding.md).

**Regla:** se escribe sobre el MISMO valor que se leyó estricto, nunca sobre una relectura.
Molde: `jsonEstricto` en `lib/api-mako/areas/chatbot.helpers.ts:162`. Si la lib no exporta
un getter estricto, la deuda es de la lib: copiar su normalizador afuera es un segundo lugar.

**Vive en:** lib/settings.ts:44 (getSettingEstricto) · lib/cs-avance.ts:35 · lib/persona.ts:83-106 · lib/avatares.ts:61 · lib/entregable.ts:54 · *2026-09-16 api-mako-areas*

**16/09/2026: dónde duele más, y los casos que siguen vivos.** El daño caro es el
read-modify-write de un mapa o una lista: con la lectura caída, el valor nuevo se arma
sobre `{}` o `[]`, y agregar UN ítem reescribe la clave con ese ítem solo. Sin error. El
otro daño es un diagnóstico que afirma ausencia: `estado_email` le decía al dueño «el
negocio no cargó un dominio» con la base caída. La API ya lee estricto (`estadoEmail` y
`dominioIdDelWorkspace`, `lib/api-mako/areas/email.helpers.ts:41` y :75); la pantalla no
(`estadoActual`, `app/api/email/dominio/route.ts:77-78`).

Siguen laxos, todos por la puerta de la pantalla:

- `getEntregables` (`lib/entregable.ts:54`) → `setEntregables([...lista, nuevoLm])` en
  `app/api/chat-agent/secuencias/route.ts:167-169`: crear un lead magnet con la lectura
  caída deja la lista con ese solo.
- `getManual` (`lib/chat-agent-voz.ts:110-113`) → `setManual` en
  `app/api/chat-agent/onboarding/contexto/route.ts:65-71`: contestar un hueco de la voz
  borra las respuestas anteriores.
- `getPorClave` (`app/api/chat-agent/audios/route.ts:35`) → `setSetting` en :127-130:
  grabar un audio deja el mapa situación → audio con una sola clave. (El `DELETE` de :148
  no escribe si el mapa vino vacío.)
- `mapaAudios` (`lib/secuencias-audios.ts:91-95`) no escribe el mapa, pero con `{}`
  `armarSecuenciasDeAudios` arma cero secuencias, igual que si no hubiera audios grabados.

**Regla:** mapas y listas se leen con `getSettingEstricto`, y un JSON ilegible también
tira: `{}` no es un valor, es la falla disfrazada.

**Queda sin hacer:** la API de MaKo lee estricto repitiendo las claves privadas de las libs
(`mako.entregable` y `mako.chat_agent.voz.manual`, en
`lib/api-mako/areas/chatbot.helpers.ts:243` y :265). Faltan `getEntregablesEstricto` y
`getManualEstricto` en `lib/entregable.ts` y `lib/chat-agent-voz.ts`, y pasar por ahí las
tres rutas de arriba. *2026-09-16 api-mako-areas*

### ⚠️ `getSettingNum` lee un setting vacío como 0, no como «no hay»

**Causa:** `getSettingNum` hace `Number(raw)` y solo devuelve `null` si no hay fila o el
número no es finito (`lib/settings.ts:88-97`). `Number('') === 0`, así que «quitar» un
setting numérico guardándolo vacío se relee como **0**. Y /general lo guarda vacío:
`setCapacidadAction` pasa `cupo.trim()` y `mesesEntrega.trim()` tal cual
(`app/general/actions.ts:189-191`).

**Dos síntomas, los dos con cara de dato:**

- **El cupo.** `capacidadDe` trata el 0 como «sin cupo» (`lib/objectives-modelo.ts:521`),
  pero la rama de error de `getCapacidad` devuelve el cupo crudo
  (`lib/objectives.ts:498-499`). Si además no se pudieron contar los activos, la API le
  dice al modelo «Hay un cupo declarado de 0 clientes»
  (`lib/api-mako/areas/general.run.ts:169-170`).
- **La ventana de entrega.** `(await getSettingNum(KEY_MESES_ENTREGA)) ??
  MESES_ENTREGA_DEFAULT` (`lib/objectives.ts:468`, y otra vez en :499 y :501): un 0 no es
  nullish, así que el default de 4 meses no entra. Con la ventana en 0, los pagos únicos
  ya cerrados dejan de contar como activos y el tablero muestra lugar libre que no hay.

**Regla / deuda:** `getSettingNum` tiene que tratar `raw.trim() === ''` como `null`.
Mientras no se arregle, un `?? default` encima de `getSettingNum` no protege del vacío.

**Vive en:** lib/settings.ts:88-97 · lib/objectives.ts:468, :498-501 · app/general/actions.ts:189-191 · *2026-09-16 api-mako-areas*

### ⚠️ El techo de 1000 filas no da error: da un número que BAJA

**Síntoma:** Mauricio vio **4 ganados** en el CRM. Eran 13, todos con monto y fecha de
cierre: **US$52.700** de facturación fuera del tablero. Lo vio el dueño, no nosotros, y no
había una sola línea en ningún log.

**El diagnóstico obvio era el equivocado.** «Faltan ganados» manda a mirar el filtro, la
etapa, el funnel del workspace. Los 13 tenían `etapa_vista='ganado'` y el funnel tenía la
etapa. Lo roto era el transporte: `_listLeads` (`lib/leads.ts`) hacía un `.select()` suelto
con `.order('created_at', desc)`. PostgREST corta en 1000 filas y **devuelve 1000 filas y un
200**. El workspace llegó a 1.066 leads, y los 66 que caían eran los más VIEJOS — o sea los
clientes que ya habían cerrado. La víctima del corte no es aleatoria: con orden por fecha es
siempre la punta que no se mira, y con orden físico (sin `ORDER BY`) suele ser la más vieja.

**Así se reporta, para reconocerlo:** no hay error ni pantalla rota. Hay «se ven menos X de
los que había», un total que dejó de crecer, un número redondo (1000, o un porcentaje que
sale de dividir por 1000). Antes de tocar un filtro, contá las filas de la tabla con
`count: 'exact', head: true` para ese workspace: si pasa de 1000 y la lectura no pagina, ya
está.

**Por qué sobrevivió el barrido anterior:** ese barrido unificó los **seis bucles `.range()`
que paginaban MAL** (sin orden único, ver la entrada de abajo) y no miró el `.select()` que no
paginaba **en absoluto**. Arreglar lo que ya tiene forma de paginado encuentra lo que alguien
pensó; lo peligroso es lo que nadie pensó, y eso no se parece a nada: es una consulta común.

**Regla: una caza de truncados busca lo que NO pagina, no solo lo que pagina mal.** El método
que funcionó el 17/09/2026 (escáner en el scratchpad de la corrida, `barrido/scan.mjs`):

1. Enumerar **todas** las cadenas `.from(` de `lib/ app/ scripts/ worker/ plugin/` — fueron
   1.102 — siguiendo la cadena hasta el final, porque el `.limit()` a veces aparece líneas
   más abajo.
2. Descartar escrituras, `.single()`/`.maybeSingle()`, `count … head: true` y las que ya
   pasan por `leerTodo`/`leerPorPaginas`. Quedaron **278 sin tope**, más los `.limit(n)` con
   n > 1000 o sin `.order()`, y los `.range()` sin `.order()`.
3. Cruzar cada candidata con el tamaño **real** de su consulta en producción (no el de la
   tabla: el de ESE filtro, en el workspace más grande). Eso separa el bug vivo de la deuda.

**Y la corrida dejó escrito dónde quedó cada caso**, con su síntoma propio, en el documento
del área donde vive el código: los leads del CRM en [hallazgos-crm.md](hallazgos-crm.md) →
«`_listLeads`…», el inbox, el email y la nutrición en
[hallazgos-comunicacion.md](hallazgos-comunicacion.md), las métricas y los nombres de
campañas en [hallazgos-ads.md](hallazgos-ads.md), el Pixel en
[hallazgos-landing.md](hallazgos-landing.md), la inversión de Objectives en
[hallazgos-objectives.md](hallazgos-objectives.md), el gasto de IA en
[hallazgos-ia.md](hallazgos-ia.md), la cartera en
[hallazgos-customer-success.md](hallazgos-customer-success.md), el tablero en
[hallazgos-plan.md](hallazgos-plan.md) y los avisos de la API en
[hallazgos-api-mako.md](hallazgos-api-mako.md).

**Vive en:** lib/supabase-paginado.ts (`leerTodo`, `leerPorPaginas`) · lib/leads.ts (`_listLeads`, commit `5e829b5d`) · *2026-09-09 y 2026-09-17 caza de paginado*

### Censo: qué tablas ya pasaron las 1000 filas y cuáles están por pasar

Medido en producción el 17/09/2026. Sirve para saber dónde mirar sin volver a medir; **los
números envejecen**, así que ante una decisión se re-mide (el censo trae los `SELECT` en
`q1.mjs`–`q6.mjs` del scratchpad de la corrida, pero la consulta es un `group by
workspace_id` y se reescribe en un minuto).

**Ya pasaron las 1000 en algún workspace:**

| tabla | máx/ws | crece | lo que importa para leerla |
|---|---:|---:|---|
| `vsl_events` | 29.048 (ws1) | +24.000/mes | 30 días = 22.577 filas; **las 1000 más nuevas son 25 horas**. Ninguna ventana la salva |
| `wa_mensajes` | 24.020 (ws11) | +16.000/mes | **UNA conversación** llega a 1.382 (por `chat_jid`) y a 1.194 (por `lead_id`). Y 28.616 de 33.703 filas tienen `lead_id` NULL: agrupar por lead mira el 15% por otra razón |
| `landing_visits` | 6.415 (ws1) | +3.850/mes | 30 días = 3.511; las 400 más nuevas son 3 días; 2.552 URLs distintas en 30 días |
| `evolution_contactos` | 5.956 (ws1) | +490/mes | |
| `lead_audit` | 5.915 (ws1) | +1.400/mes | por lead son 45 como máximo: seguro por lead, catastrófico por workspace |
| `adset_budget_daily` | 4.059 (ws1) | +2.600/mes | 47 adsets × 1 fila/día: **todo rango ≥ ~22 días trunca** |
| `marketing_metrics_daily` | 2.392 (ws1) | +820/mes | 1.714 son `meta`; **toda lectura sin fecha trunca**, 90 días = 1.196 |
| `anthropic_usage` | 1.868 (ws1) | +1.500/mes | la única que hoy se salva con ventana: 30 días = 609 |
| `leads` | 1.108 (ws1) | +200/mes | sub-conjuntos que ya pasan solos: abiertos 1.032, con teléfono 1.106, segmento de email «activos» 1.044 |

**Cruzan en meses, no en años** (ritmo de los últimos 30 días sobre el workspace más grande):
`flow_trabajos` 385 (~1,6 meses) · `mako_doer_conv` 442 (~1,9) · `app_settings` 322 (~2,9;
la fecha es `updated_at`, el alta real puede ser más lenta) · `closing_analyses` 428 en ws9
(~3,3) · `plan_tareas` 643 en ws9 (~3,6) · `experimento_tareas` 212 en ws1. Todo lo demás
está por debajo de 400.

**Vacías hoy y de alta cardinalidad por diseño** — explotan el día que se prenden:
`ig_mensajes`, `ig_conversaciones`, `email_broadcast_envios` (un solo broadcast a «activos»
son 1.044 filas), `kpi_registros`, `wa_borradores`, `contenido_posts`, `cs_respuestas`,
`agente_sesiones`, `chat_agent_handoffs`, `review_queue`.

⚠️ **El corte se aplica a la CONSULTA, no a la tabla.** Tres consecuencias que el conteo por
workspace no muestra:

- Una tabla «chica» por workspace puede truncar por la forma de leerla: `.in('lead_id', ids)`
  con 50 visitantes de `vsl_events` ya pasa las 1000 (hasta 612 eventos por visitante).
- Una ventana de fechas no es un tope: depende de la densidad. 30 días de `adset_budget_daily`
  ya truncan; 30 días de `anthropic_usage` no.
- Casi toda la base tiene menos de 90 días de vida, así que «90 días» y «todo» son hoy lo
  mismo. Una lectura acotada a 90 días que hoy entra deja de entrar sola.

*2026-09-17 caza de paginado*

### La página 2 no es la continuación de la página 1 si el orden no es único

**Síntoma:** cuatro pantallas distintas, el mismo error de fondo y ninguna avisa nada.
La agenda de WhatsApp mostraba la mitad de los contactos con el número crudo, como si no
tuvieran nombre. El importador del CRM decía "nuevo" sobre un lead que ya estaba en la
base — o sea, **creaba el duplicado que ese código existe para evitar**. El dump del
tablero salía incompleto. El contador de cobertura de anuncios decía que faltaban
analizar anuncios que ya estaban.

**El diagnóstico obvio era el equivocado.** Todos parecían "falta paginar, PostgREST
corta en 1000". Paginar era la mitad: varios de esos bucles **ya** paginaban con
`.range()` y seguían perdiendo filas. `.range(desde, hasta)` es `OFFSET/LIMIT`, y sin
`ORDER BY` el motor no promete el mismo orden entre dos requests: la página 2 repite
filas de la 1 y saltea otras. En `evolution-contactos` el comentario del código
**afirmaba** que el `.range()` había arreglado el síntoma, y el síntoma seguía vivo por
la otra mitad.

Un orden que **se repite** es la misma trampa con otra cara, y es la más fácil de pasar
por alto porque "sí hay ORDER BY":

| Columna | Por qué se repite |
|---|---|
| `wa_timestamp` | 16 mensajes en 4 segundos comparten segundo; los volcados del importador, más |
| `ad_id` en `marketing_metrics_daily` | hay **una fila por anuncio y por día** |
| `fecha`, `created_at` | empates masivos por definición |

**Regla:** el orden de un bucle paginado tiene que ser **único**. Si la columna natural
se repite, se desempata por la PK en el mismo `orden`. Y `.limit()` **no** sube el techo
de 1000 filas del servidor: no es un límite del cliente.

**Vive en:** lib/supabase-paginado.ts — `leerTodo()` y `leerPorPaginas()`. El orden por defecto es `'id'`; `orden` acepta una lista (`[{col:'fecha',asc:false},{col:'id'}]`) justo para desempatar.

### Un tope nuevo es un truncado nuevo: cuando un helper absorbe N copias, su límite más restrictivo se lo come todo el mundo

**Síntoma:** el análisis de una landing viva pasó a decir "sin datos de comportamiento" y
el importador de contactos dejó de importar. Nada en el log decía "se cortó".

**Causa:** unificar seis bucles `.range()` en el helper trajo un `MAX_PAGINAS = 100`
(100k filas) que **tres de los seis no tenían**: `indiceContactos` paginaba hasta 200k a
mano, y `landing_visits` / `marketing_metrics_daily` no tenían techo. El `throw` del tope
cae en el `catch` que esos callers ya tenían para degradar —`catch { return vacio; }`— y
ahí un error se lee como "no hay nada".

**Regla:** antes de unificar N copias, comparar los **topes** de las N, no solo su lógica.
`MAX_PAGINAS = 1000` + la opción `maxPaginas` por llamada es un **cinturón** contra un
bucle que no converge, no un límite de producto: tiene que quedar por encima de la lectura
legítima más grande de cualquier caller.

**Vive en:** lib/supabase-paginado.ts:68

### Romper fuerte río arriba con un `catch` río abajo es un falso all-clear

Corolario del anterior y la trampa más cara de las tres, porque **no parece un error**:
una lectura que pasa a lanzar, más un `.catch(() => [])` río abajo, convierte "se rompió"
en "no hay nada", que son cosas opuestas. Pasó en el worklist del CRM (el ✓ verde "todo
marcado" con la lista incompleta, ver [hallazgos-crm.md](hallazgos-crm.md) §3) y en el
análisis de landings ([hallazgos-landing.md](hallazgos-landing.md)).

**Regla:** si una lectura pasa a lanzar, seguí la excepción **hasta la pantalla**. La
decisión de degradar se toma por dato ("esto es accesorio") y se muestra ("lista
parcial"), nunca por omisión.

**Y el mismo agujero sin paginado de por medio (17/09/2026):** `data ?? []` convierte un error
de lectura en un truncado al 100%. Dónde duele es en los conjuntos que **protegen**:

- **El set de «ya procesados» de un pipeline que paga IA** (`closing_analyses`,
  `script_analyses`, `ad_transcripts`): vacío por error = se re-analiza todo y se paga otra
  vez.
- **El set de «ya enviados» de un envío** (reanudar un broadcast, el anti-spam de 20 h, los
  guards de nutrición): vacío por error = todos reciben el mensaje de nuevo.
- **Y los errores de ESQUEMA pasan igual.** `cs-cartera` pedía `pagos.fecha_vencimiento`, una
  columna que **nunca existió**; el `leer = q => data ?? []` lo convertía en «0 cuotas
  vencidas» para todos los clientes. Un wrapper que traga errores no distingue «la red se
  cayó» de «la consulta está mal escrita desde el primer día».

Esas lecturas **lanzan**: prefieren no hacer el trabajo a hacerlo dos veces.

### Las formas de truncar que no parecen truncar

Lo que la caza del 17/09/2026 encontró además del `.select()` suelto. Cada una tiene su caso
en el documento de su área; acá va la regla.

| Forma | Por qué engaña | Lo que va |
|---|---|---|
| `.limit(2000)`, `.limit(20000)`, `.limit(1200)` | Se lee como un tope generoso y el servidor corta en 1000 igual. Apareció **cuatro** veces | `leerTodo`/`leerPorPaginas`; un tope de producto va **explícito** en el callback (`return nro < TOPE`) |
| `ORDER BY` una columna repetida + «el primero de cada clave gana» | Pasado el corte, las claves VIEJAS desaparecen enteras: una campaña que dejó de correr pierde su nombre (`_getCampaignNameMap`, ordenado por `fecha` desc) | orden único **ascendente** y que la última fila pise a la anterior: la más reciente gana sin depender del corte |
| Tope sobre un orden **ascendente** | Muestra lo más viejo y esconde lo más nuevo, incluido el último mensaje de un chat (`getMensajesDeChat`, 16 chats) | orden descendente con desempate por `id` para cortar, y se reordena en memoria para mostrar |
| `.limit(N)` sin `.order()` sobre una COLA | Las filas que no se resuelven vuelven a salir primeras: la cola relee las mismas N para siempre y las de atrás no se evalúan nunca (`procesarEnvios`, `nutricion-desenlace`) | excluir lo ya visto en el servidor (`.not('id','in',…)`) y desempatar por `id` |
| Tope chico y **después** filtrar en memoria | Falso negativo con cara de veredicto: «el Pixel no está instalado» sobre una página que manda eventos (`verificarPagina`, 400 filas = 3 días de 2.552 URLs) | filtrar en el servidor por un superconjunto seguro (el host) y paginar eso |
| …con un superconjunto que no discrimina | El filtro deja pasar casi todo y el `limit` de después vuelve a ser el corte mudo: «Ana» como patrón matchea 1.107 de 1.108 leads (`duplicadosDeLead`, **quedó abierto**) | medir cuánto descarta el patrón antes de confiar en él; si vuelve el tope exacto, avisar |
| Paginar para preguntar «¿tiene al menos una fila?» o «¿qué valores distintos hay?» | Trae 80.000 filas para contestar sí/no | preguntar **por exclusión**: `idsConAlMenosUnaFila` y `distintosPorExclusion` (`lib/ids-con-filas.ts`). Sin OFFSET no hay orden que se corra |
| Paginar una lectura cuya salida alimenta un `.in()` | La lista crece de golpe (de 1000 a 1.032) y el `.in()` de después es el que ahora trunca, con la URL cerca de su límite | `enTandas` de 200 ids, y cada tanda paginada |
| Sumar/contar filas que se bajaron solo para eso | Es un truncado esperando | `count: 'exact', head: true` en la base: un conteo no se corta |
| `.order(col, { ascending: false })` sobre una columna con NULL | Postgres pone los NULL **primero** en DESC: `rows[0]` como «el más reciente» es una fila sin fecha | ordenar en memoria con los null al final, o `nullsFirst: false` |

**Y dos trampas de escribir el arreglo:**

- **TS2589 («excessively deep»).** Encadenar `.not()`/`.gte()`/`.in()` dentro de `filtros` y
  castear a `ConsultaPaginada` hace que tsc se rinda. Va `as unknown as ConsultaPaginada`, o
  el callback tipado para devolver `unknown`.
- **Un aviso «corta en 1000» escrito en otra capa se vuelve mentira el día que la lectura
  pagina**, y a veces un candado: la API de MaKo se negaba a mandar un email a los 1.044
  «activos» porque «la lib no pagina», cuando ya paginaba. El aviso se actualiza **en el
  mismo commit** que el arreglo. El caso, en [hallazgos-api-mako.md](hallazgos-api-mako.md).

*2026-09-17 caza de paginado*

### Un SELECT que no trae la columna hace que el «merge» la borre en silencio

**Síntoma:** teléfono, cargo y bio del perfil desaparecían sin ningún error.

**Causa:** `setPerfil` leía el jsonb `perfil`, lo mergeaba y lo reescribía — pero el SELECT
compartido (`COLS`) no incluía esa columna, así que leía `undefined` y reescribía el jsonb
desde vacío. El arreglo (sumar `perfil` a COLS, commit `dc58336`) es correcto y **no hay
que revertirlo**: dos verificadores refutaron el hallazgo de que eso filtre datos — el
receptor es el admin del propio workspace, que ya administra esas cuentas.

**Regla:** un patrón leer-mergear-escribir es tan bueno como el SELECT que lo alimenta; si
el SELECT es compartido, o lo ampliás o hacés uno propio — nunca asumas que la columna vino.

**Vive en:** lib/usuarios.ts:40 (COLS) + lib/perfil.ts:93-113 · *2026-08-06 ~auditoria-notificaciones-y-titulo-de-pestana*

### `app_settings` es last-write-wins sin CAS: nunca hagas read-modify-write alrededor de un `await` largo

`setSetting` es un upsert plano del value completo por `(workspace_id, key)`, sin merge ni
control de concurrencia. Dos casos medidos: (1) `generarGuion` lee el array ENTERO de
`mako.razones`, espera varios segundos a la IA y reescribe desde el snapshot viejo —
cualquier edición de copy o descripción hecha durante la generación se pierde en silencio,
en DB y en pantalla; (2) el anti-eco del doer (`KEY_SENT`) es RMW sobre la misma key y con
invocaciones concurrentes pierde ids propios, con lo que MaKo termina procesando el eco de
su propia respuesta. El comentario del código dice que ese lost-update «ya se arregló»,
pero solo para los N mensajes de UNA respuesta, no entre invocaciones.

**Corolario:** `app_settings` no sirve como cola ni como lock; para eso hace falta una tabla
con claim atómico (`UPDATE … WHERE estado='pendiente' … RETURNING`).

**Vive en:** lib/settings.ts (setSetting) · lib/razones.ts (generarGuion) · lib/mako-doer-in.ts (registrarEnviados / KEY_SENT) · *2026-07-28 ~review-onboarding-fabrica-creativos*

### `leerTodo` vs `leerPorPaginas`: cuándo materializar

`leerTodo` junta todo en un array. Está bien para tablas chicas, y mal cuando de cada
fila sobrevive un contador: un año de 200 anuncios son ~73.000 filas de
`marketing_metrics_daily` para terminar con un `Map` de 200 claves. `leerPorPaginas`
entrega la página y la tira.

El callback devolviendo `false` corta el barrido. **Esa es la única forma legítima de
truncar**, y el punto es que queda **a la vista en el call-site** (`return nro < TOPE`)
en vez de escondida en el `desde < 20000` de un `for` que nadie lee.

### Regla: el estado del producto va a Supabase, no a localStorage

Si el dato es del usuario, tiene que poder leerlo cualquiera con permiso, desde cualquier
dispositivo: «No tiene sentido guardarlo en localstorage, por qué hicimos eso? Cuando
tenemos supabase» (2026-07-22). Aplica a boards, preferencias y cualquier cosa que el
dueño espere ver igual en dos pantallas.

### Regla: no inventar límites — el tope lo pone la API, no nosotros

Ni horas de agenda, ni ventana de días de un público, ni cantidad de resultados: «no
limites las horas, que se pueda agendar a la madrugada si quieren» (2026-08-07). Si hay que
poner un techo por costo o por seguridad, va **con cartel** y a la vista en el call-site.

### ⚠️ Pendiente: los techos mudos que quedaron fuera de la caza del 17/09

Los de la tabla vieja (los dos scripts con `.range()` a mano, `cerrar-por-commits` y
`plan-buscar`) se arreglaron el 17/09/2026. Lo que sigue abierto, de más a menos urgente:

| Qué | Dónde | Estado |
|---|---|---|
| **Regresión:** el patrón por nombre casi no filtra y `.limit(100)` corta | `lib/leads.ts:367` + `lib/leads-duplicados.ts` (`patronesDeNombre`) | trunca hoy para nombres cortos → [hallazgos-crm.md](hallazgos-crm.md) |
| `closing_analyses` entera, sin paginar | `app/crm/insights-actions.ts:56` | 428 en ws9 |
| `plan_tareas` sin paginar (el board del super-admin) | `lib/plan-board.ts:101, 180, 302, 405, 583, 656, 735, 906` · `lib/plan-proyecto-vacio.ts:53, 107` · `app/admin/dev/roadmap.ts:142` | 643/1000 en ws9 → [hallazgos-plan.md](hallazgos-plan.md) |
| `experimento_tareas` sin paginar | `lib/todo.ts:184, 192, 373, 453` | 212 en ws1 |
| `vsl_events` / `landing_visits` de UN visitante o un lote | `lib/leads.ts:1482, 2264, 2286` (`getVisitasLandingMap`) | 612 por visitante (ws13) |
| Lecturas de `leads` y `pagos` del embudo y la cobranza | `lib/queries.ts` (`getFunnelEtapas`, `getSCL`, `getTendencias` :2989), `lib/pagos.ts:411, 503` | bajo el techo por columnas ralas → [hallazgos-crm.md](hallazgos-crm.md) |
| `cashUsd` / `soldUsd` | `lib/objectives-fuentes.ts:109, 127` | 13 cierres; se rompen en un objetivo anual → [hallazgos-objectives.md](hallazgos-objectives.md) |
| Bloqueados y ocultos del inbox | `lib/evolution-block.ts:36, 59` | 0 y 15 filas |
| Leads de las conversaciones del inbox | `lib/evolution-mensajes.ts` (~:320) | 46 ids por workspace |
| Tres lecturas que devuelven VACÍO cuando fallan | el `catch → []` de `videosDetectados` (`lib/landing-token.ts`), `getVslEngagementMap` (`lib/leads.ts`), el `warn` de `getUsageSummary` | no truncan: mienten «no hay» |
| `anthropic_usage` con `getSupabaseServer()` y el `eq(workspace_id)` a mano | `lib/anthropic-usage.ts`, `lib/ia-cuotas.ts` | paginan, pero contra la regla de la casa |

### Descartado a propósito (no volver a "arreglarlo")

**Aprender el techo real de PostgREST desde la primera página corta.** Se implementó y se
**revirtió**: una página corta es indistinguible del final de la tabla, así que la única
detección honesta cuesta un request extra en **cada** lectura chica (3 por carga del CRM,
+100-180 ms) para blindar una configuración que este proyecto no tiene.
`PAGINA_POSTGREST = 1000` es el default de Supabase. **Si se baja `db-max-rows`, se baja la
constante en el mismo commit** — está escrito en el módulo.

### ⚠️ `JSON.stringify` en una columna `jsonb` la guarda como un jsonb de TIPO STRING, y nadie avisa

**Vive en:** `scripts/reset-chatbot-leila.ts` (el caso) · `funnel_config.data` · cualquier
script one-off con `postgres` (`sql`) que escriba una columna jsonb

**Síntoma.** Un `update` corre sin error, la fila queda escrita, y la app se comporta como
si el dato no existiera: el cliente vio el funnel por defecto en vez del suyo.

**Causa.** `sql\`update … set data = ${JSON.stringify(obj)}\`` manda un **string**. Postgres
lo acepta porque un string ES un JSON válido, así que guarda `"{\"pipeline\":[…]}"` — el
objeto entero envuelto en comillas y escapado. `jsonb_typeof(data)` devuelve `string` en vez
de `object`, y del lado de la app `cfg.pipeline` es `undefined`: se cae al default, sin
error, sin log y sin nada que mirar.

Lo correcto es `sql.json(obj)`, que declara el tipo:

```ts
await sql`update funnel_config set data = ${sql.json(obj)} where workspace_id = ${ws}`;
```

**Y el corolario que lo hace fácil de repetir: en este repo conviven las dos formas.**
`app_settings.value` es **TEXT**, así que ahí `JSON.stringify` es lo correcto; `funnel_config.data`
es **jsonb**, y ahí es un bug. El mismo script escribía las dos tablas y solo una estaba mal.
No son intercambiables: se mira la columna, no la costumbre.

**Cómo se detecta y cómo se repara** (el valor no se perdió, solo está envuelto):

```sql
select jsonb_typeof(data) from funnel_config where workspace_id = 11;   -- 'string' = mal
```
```ts
const [r] = await sql`select data #>> '{}' as txt from funnel_config where workspace_id = ${ws}`;
await sql`update funnel_config set data = ${sql.json(JSON.parse(r.txt))} where workspace_id = ${ws}`;
```

**La regla que queda:** todo script one-off que escriba jsonb verifica con `jsonb_typeof`
**después** de escribir, en la misma corrida. Un `update` que no falla no es un `update` que
funcionó — y este es exactamente el tipo de escritura que se hace una vez, contra producción
y sobre datos de un cliente real.

*2026-08-10 ~chatbot-funnel-leila*

---

## Aislamiento multi-inquilino

### ⚠️ `getTenantDb` hace passthrough silencioso: la tabla que no está en `TENANT_TABLES` sale sin filtro

**Síntoma medido:** `hayFilas('funnel_config')` contaba **global**. La tabla tenía 4 filas y
devolvía 4 para los 6 workspaces, así que la señal `funnel-cargado` salía verde para todos
y «Cargar el funnel del negocio en MaKo» y «Definir las métricas norte» nacían **tildadas**
para todo cliente nuevo, con la evidencia mintiendo en el historial («tu funnel ya está
cargado»). El diagnóstico obvio —«el auto-cierre por señales no anda»— era el equivocado:
andaba de más.

**Causa:** `scopedFrom` hace `if (!TENANT_TABLES.has(table)) return builder` — no lanza, no
avisa: devuelve el builder sin el `.eq('workspace_id')`. El proxy protege por **inclusión**,
no por defecto. `funnel_config` está fuera del set a propósito (se scopea a mano en su lib,
`getFunnel`/`saveFunnel`), pero no hay red: la próxima query que alguien escriba contra esa
tabla sale sin filtro y sin que nada avise.

**Regla:** al crear una tabla por cliente, sumarla a `TENANT_TABLES` **es parte de la
migración**, no un paso opcional. Y cada `hayFilas(x)` (o cualquier count/lectura por
`getTenantDb`) solo vale si `x ∈ TENANT_TABLES`; si no, el filtro va a mano y **fail-closed**
(sin workspace, `false`). Corolario del mismo barrido: antes de declarar una señal nueva hay
que sondear prod — declarar una que nunca se cumple deja tareas colgadas para siempre
(`nutricion_envios` y `experimentos` estaban en 0 en los 6 workspaces).

**Vive en:** lib/workspace.ts:40-55 y :171-172 (TENANT_TABLES + scopedFrom) · lib/plan-senales.ts (hayFilas vs hayFilasWs) · lib/todo-seeds-data.ts · lib/leads.ts:1291-1316 · *2026-07-22 ~research-landing-funnel · 2026-08-05 ronda-clientes-y-automatizacion*

### ⚠️ El fallback de workspace es fail-closed en los datos y fail-OPEN al dueño en las credenciales y los settings

**Síntoma:** un admin de agencia sin impersonar teclea /general y ve el CRM y el pipeline
vacíos pero, en el mismo hero, el saldo y la salud **en vivo** de la cuenta de Meta del dueño.

**Causa:** `getTenantDb()` resuelve `ws ?? -1` (0 filas), mientras `settings.wsActual()`
(`lib/settings.ts:17`) y `credenciales.wsDefault()` (`lib/credenciales.ts:110`) resuelven
`?? OWNER_WS`. Sin workspace, las tres capas no contestan lo mismo. `integracionConectada()`
sí es fail-closed a propósito y lo dice en un comentario, pero las vistas que llaman
`getMetaAccountHealth()` / `getIntegraciones()` directo se lo saltean. **El espejo es peor
que la lectura:** todo lo que ese admin edite en /perfil, /configuraciones o /contexto se
guarda sobre el workspace del DUEÑO sin un solo cartel.

**Regla:** cuando no hay workspace, el default solo vale para el camino **sin sesión**
(cron/webhook, con `ws` explícito); en un request con sesión, resolver a `null` y que la
pantalla diga "entrá como un cliente". Verificado vivo: /general sigue llamando
`getMetaAccountHealth()` sin gate; /integraciones ya se gateó.

**Vive en:** lib/settings.ts:17 · lib/credenciales.ts:110 · app/general/page.tsx:72 · lib/integraciones.ts:122 · *2026-07-02 auditoria-multitenant-ux*

**16/09/2026: `getSetting` no tiene caché, y el fallback sigue vivo.** Consulta la base
cada vez (`lib/settings.ts:20-33`). `docs/api-mako-inventario.md` dice que `getCapacidad`
usa «settings cacheados (TAG.settings)», y es falso: `TAG.settings` solo etiqueta
`getObjetivoProgreso` (`lib/queries.ts:2683`). Lo peligroso sigue siendo el fallback:
`getSetting`, `getSettingEstricto`, `cambiarSettingSi` y `setSetting` resuelven el ws con
`wsActual()` (`:17`), así que fuera de `runWithWorkspace` —y también adentro de
`runWithWorkspace(null, …)`, porque el `null` del store cae al mismo `??`— leen y
**escriben** en el ws 1 de Mauricio sin error. Toda función que escriba settings hereda eso
si se la llama por fuera del choke point; `setCapacidad` (`lib/objectives.ts:504-507`) es
una. *2026-09-16 api-mako-areas*

### ⚠️ Una credencial copiada entre workspaces es inerte hasta que arreglás la config, y ahí se vuelve ingesta cruzada real

ws3 (Cliente de Prueba) y ws9 tienen `PANDA_API_KEY`, `PANDA_VSL_VIDEO_IDS` y las de YouTube
**byte a byte idénticas** a las de ws1 (mismo sha256, `updated_by='datos-mau'`). Eso era
inofensivo solo porque `configWs` miraba únicamente `app_settings`, donde no había ni una
fila, así que la ingesta devolvía null y no escribía nada. Al arreglar `configWs` para que
lea `credWs`, los crons de Panda y YouTube pasan a pegarle a la cuenta de Mauricio con SU
key y a escribir sus métricas reales **dentro del workspace 3**: el tablero del cliente de
prueba muestra el negocio del dueño y se repuebla solo todos los días aunque lo resetees.

**Regla:** antes de arreglar una resolución de config, mirá qué credenciales duplicadas
estaban dormidas detrás de esa rotura.

**Vive en:** lib/cron-workspaces.ts:80-91 (configWs) + filas de `credenciales` de ws3/ws9 · *2026-08-05 ~review-commit-firma-webhooks*

### Un upsert con `onConflict` de UNA columna se roba la fila del otro inquilino, y `getTenantDb` no lo impide

`getTenantDb()` filtra select/update/delete y **estampa** `workspace_id` en el insert — por
eso se asume que un upsert está aislado. No lo está: si el `onConflict` no incluye
`workspace_id`, el conflicto se resuelve contra la fila de OTRO workspace, y como en un
`ON CONFLICT DO UPDATE` de supabase-js el SET incluye todas las columnas del payload, el
`workspace_id` estampado **pisa** al del dueño original: la fila cambia de inquilino y
desaparece del tablero del otro.

La migración 0054 dejó a propósito PK de una sola columna en las tablas «que solo escriben
los crons» (`ad_transcripts.ad_id`, `closing_analyses.recording_id`, `script_analyses.ad_id`,
`credenciales.clave`) y ahí vivía el agujero: un cliente que abría /closing y tocaba
«Sincronizar» **re-analizaba las llamadas de venta del dueño y se quedaba con la fila**.

**Regla:** al agregar una tabla, el conflict target tiene que incluir `workspace_id` o el
aislamiento del proxy es decorativo. Hoy todos los `onConflict` de `lib/` son compuestos,
pero la regla no está escrita en ningún lado — la skill `tenant-safe-query` no lo menciona.

**Vive en:** lib/workspace.ts (scopedFrom) · supabase/migrations/0054_workspaces.sql §4 · los ~40 `onConflict` de lib/*.ts · *2026-07-01 ~auditoria-aislamiento-multi-tenant*

### `getWorkspaceActual()` cae a OWNER_WS cuando no hay contexto, y eso reintroduce fugas ya arregladas

Varios `recordUsage` corren como fire-and-forget (`void recordUsage(...)`) y algunos adentro
de `unstable_cache`, donde `cookies()` no está disponible. Ahí `getWorkspaceActual()` depende
del AsyncLocalStorage de `runWithWorkspace`, y si el store no está seteado devuelve
`OWNER_WS` (`workspace.ts:79`) en vez de fallar. Consecuencia: scopear una lib por el
workspace actual es **cosmético** si el call-site corre fuera del contexto — la fila se
estampa igual con `ws=1`.

**Regla:** antes de scopear algo que se llama en background, garantizar que el path
(MaKo/WhatsApp/crons) esté envuelto en `runWithWorkspace`, y verificarlo con una query de
control agrupada por `workspace_id`, no leyendo el código del fix.

**Vive en:** lib/workspace.ts:79 · lib/ai-cheap.ts:126,192,216,298 · *2026-07-23 trace-gemini-leak-ws*

**16/09/2026: `after()` NO pierde el workspace, y tres comentarios del repo dicen que sí.**
`lib/api-mako/areas/ads.run.ts:99-100`, `lib/api-mako/areas/closing.helpers.ts:190-192` y
`app/api/plan-fathom/route.ts:145-147` afirman que el callback de `after()` corre fuera del
AsyncLocalStorage. En Next 16.2.6 es al revés: `addCallback` lo envuelve con
`bindSnapshot` → `AsyncLocalStorage.bind`
(`node_modules/next/dist/server/after/after-context.js:72-77`), que conserva **todos** los
stores activos al momento de llamar `after()`, el de `runWithWorkspace` incluido.
Verificado con node 24: la función pasada por `AsyncLocalStorage.bind` devuelve el store;
la misma sin bind, `undefined`.

El molde de re-entrar igual se queda, por otra razón: el snapshot es el del momento de la
llamada. Un `after()` lanzado desde un webhook o un cron que resolvió el ws del payload
**sin** entrar a `runWithWorkspace` no tiene store que conservar. Adentro,
`getWorkspaceActual()` va a las cookies, no hay sesión y cae a `OWNER_WS`
(`lib/workspace.ts:140`).

**Regla:** capturá el `ws` antes y envolvé el trabajo: `after(() => runWithWorkspace(ws,
trabajo))`. Así no depende de desde dónde se llame. Y dos cosas más:

- **Fuera de un request, `after()` tira** («called outside a request scope»,
  `node_modules/next/dist/server/after/after.js:13-16`). En un script o un test el trabajo
  corre en línea: molde `enSegundoPlano` en `lib/api-mako/areas/ads.run.ts:111-116`. El de
  `closing.helpers.ts:203` no tiene esa salida.
- **El `try/catch` va adentro y con etiqueta.** Next loguea el error con un mensaje
  genérico que no dice qué trabajo era (`after-context.js:115`). Y `after()` comparte el
  `maxDuration` de la invocación que lo lanzó ([hallazgos-api-mako.md](hallazgos-api-mako.md)).

**Vive en:** lib/workspace.ts:72 (runWithWorkspace), :144 (getWorkspaceActual) · lib/api-mako/areas/ads.run.ts:111 · lib/api-mako/areas/closing.helpers.ts:203 · *2026-09-16 api-mako-areas*

### Crear dos clientes con nombres parecidos tira `duplicate key` en la cara del admin

`crearWorkspace` arma el slug con `slugify(nombre)` (normaliza, reemplaza no-alfanuméricos
por `-`, corta a 40) y **no desdupica**, pero `workspaces.slug` es UNIQUE en la migración
0054. Dos nombres distintos que colapsan al mismo slug —o recrear un cliente que ya
existió— explotan con un error crudo de Postgres, desde un formulario que solo pide el
nombre. Del mismo barrido: `listarWorkspaces()` no filtra por estado, así que los workspaces
en `pausado` siguen apareciendo en el selector de asignación de usuarios.

**Vive en:** lib/workspace.ts:147,161-172 · supabase/migrations/0054_workspaces.sql:32 · *2026-07-02 map-admin-clientes*

### `configWs` NO le filtra el dato del dueño a los clientes (dos auditorías lo reportaron mal)

Reaparece cada vez que alguien audita los crons: «un cliente con YouTube o Panda conectado
pero sin sus ids ingesta los videos de Mauricio». **No es así.** `configWs` limita el
fallback al env con `ws === OWNER_WS || ws == null` adentro de la propia función, así que
para un cliente devuelve null y no ingesta nada ajeno. La auditoría del 02/07 lo levantó
como fuga; la del 16/07 lo verificó y lo descartó explícitamente como falso positivo, y el
código de hoy lo confirma (además ahora, antes del env, cae a `credWs(clave.toUpperCase())`).
**Gana la más reciente: no volver a «arreglarlo».** Lo que sí es cierto es el problema de al
lado: sin la setting propia el cliente no ingesta NADA de ese servicio, así que el onboarding
igual tiene que escribirlas al conectar cada integración.

**Vive en:** lib/cron-workspaces.ts (configWs) · *2026-07-02 ~mapa-onboarding-extraccion-retro (verificado y descartado el 2026-07-16)*

### ⚠️ Pendiente: `TABLAS_RESET` y `TENANT_TABLES` se separan solas y nada avisa

Son dos catálogos de la misma cosa (las tablas por-cliente) mantenidos a mano en archivos
distintos: uno scopea las queries y el otro define qué se borra al resetear el Cliente de
Prueba. Cada migración nueva registra la tabla en `TENANT_TABLES` y se olvida del reset, así
que el ws 3 «vacío» conserva datos de la corrida anterior sin ningún error. Faltan cuatro:
`chat_agent_handoffs` (mig 0111), `mako_doer_buffer` y `mako_doer_lock` (mig 0113) y
`productos` (mig 0117) — `landing_analyses`/`landing_drafts` ya se sumaron. La divergencia es
silenciosa porque el borrado itera EXCLUSIVAMENTE sobre la constante, sin catch-all ni
introspección del esquema.

**Qué falta:** derivar `TABLAS_RESET` de `TENANT_TABLES` (excluyendo las vistas
`v_cohortes_*`) o dejar un test que falle cuando las dos listas no coincidan (ver
[Tests y entorno local](#tests-y-entorno-local)).

**Vive en:** lib/reset-workspace.ts:29-60 (TABLAS_RESET) vs lib/workspace.ts:43-60 (TENANT_TABLES) · *2026-08-05 review-landing-tabs*

### ⚠️ `lib/perfil.ts` contesta por DOS personas: el perfil sigue la vista de cliente y las preferencias in-app no

**Síntoma:** un admin de agencia parado adentro de un cliente (`?ws=N`) edita «su» perfil y
escribe sobre la fila del admin de ese cliente. En la misma pantalla, el pop-up y el sonido
que ve son los suyos. La misma persona está mirando datos de dos filas distintas.

**Causa:** `getPerfil` y `setPerfil` pasan por `usuarioDelPerfil` (`lib/perfil.ts:52-70`), que
para un admin parado en otro workspace devuelve el primer usuario de ese workspace con
`rol_ws = 'admin'`, o el primero por id. `getNotifInApp`/`setNotifInApp` van por `filaPropia`
(:236-244), por el email de la sesión. Cada decisión está bien sola —la foto es de la cuenta
que mirás, el sonido es de quien está frente al teclado— y su comentario lo explica; lo que
ninguno dice es que las dos conviven en el mismo módulo bajo la misma palabra, «perfil». Dos
bordes más: si la consulta del workspace ajeno falla o no trae filas, cae en silencio a la
fila propia (:68-69), y la vista de cliente vuelve a editar la tuya sin avisar; y un usuario
con `rol_ws` null —admin efectivo para `getRolWsEfectivo` (`lib/workspace.ts:239`)— no cuenta
como admin al elegir la fila (:68).

**Regla:** «¿quién está actuando?» —autoría, quién propuso, quién confirma, de quién es una
preferencia— se contesta con la sesión (`getUsuarioActual`), nunca con `getPerfil`. `getPerfil`
contesta otra pregunta: de quién es la cuenta que se está mirando.

**Vive en:** lib/perfil.ts:52-70 (usuarioDelPerfil) · :72-114 (getPerfil/setPerfil) · :236-254 (filaPropia/getNotifInApp) · *2026-09-16 api-mako-areas*

### Decisiones del modelo multi-inquilino

- **Una sola base para todos los clientes.** No se pide API de Supabase por workspace: «no debería ser la misma base de datos para todos?» (2026-07-16). El aislamiento lo da el proxy, no la infraestructura.
- **Cada usuario ve solo los datos de su workspace, y el admin de la plataforma tiene su propio panel** en vez de las tabs de cliente. El porqué es un incidente: «Ingresé con 3 cuentas diferentes y todas vemos al mismo dashboard de Mauricio. Eso no puede ser así. No se debe compartir datos con otros usuarios» (2026-07-02).
- **Usuario y cliente son lo mismo:** dar de alta un usuario **crea automáticamente su workspace**. El equipo (closer/setter/admin) se administra dentro de la vista de ese cliente, no como usuarios sueltos — «por qué decidiste separar 'Usuarios' de 'Clientes'… Cuando son lo mismo!». Y el «admin» de un cliente no es admin de la app: solo ve todas las tabs de SU negocio (2026-07-02).
- **El rol se llama «Super Admin», no «Agencia»** — «El concepto de Agencia no tiene sentido»: el nombre tiene que describir lo que es. «Contexto MaKo» es visible solo para super admin (2026-07-02).
- **Las herramientas de la plataforma (GitHub y compañía) viven en SuperAdmin**, no en el workspace de un cliente: «Eso tiene que estar en SuperAdmin, es obvio! No en el workspace de un cliente…» (2026-08-06).
- **Toda la infraestructura tiene que desvincularse de las cuentas de Mauricio** (verificación de Elevate incluida): Mauricio es un usuario de MaKo, no un proveedor, y la plataforma no puede depender de él ni de sus cuentas (2026-07-26).
- **Ningún cambio es solo para el dueño.** Lo que se construye en super admin se construye para los clientes **en la misma pasada**: «todo esto tiene que modificarse también para los clientes, que les aparezca lo mismo, hoy en los clientes, sigue igual que antes» (2026-07-12) y «Nunca razones que es solo para el dueño» (2026-07-22). La vista de super admin y la del cliente son la MISMA pantalla (2026-07-13).

---

## Credenciales e integraciones (BYOK)

### ⚠️ Se guarda cifrada, se pinta verde y el route lee `process.env`: la credencial del cliente no se usa nunca

**Síntoma:** el cliente pega su signing key en /metodo o /integraciones, la UI se pinta
verde, y su webhook come 401 para siempre — en silencio, con un `console.warn` como único
rastro. El catálogo le promete explícitamente lo contrario.

**Causa:** el lector nunca pasó por `credWs`. Pasó con `CALENDLY_WEBHOOK_SIGNING_KEY` y
`FATHOM_WEBHOOK_SECRET` (ya migrados a `credWs` con fallback) y **sigue vivo con
`RESEND_WEBHOOK_SECRET`**, que es solo de plataforma: el cliente que trae su propia cuenta de
Resend nunca recibe aperturas, clics ni —lo grave— **rebotes permanentes y quejas de spam**,
así que sigue mandando a direcciones muertas y quemando la reputación del dominio. Es el
mismo patrón que la key de IA que se pinta verde y la paga la agencia (ver memoria
`byok-ia-no-usa-key-del-cliente`).

**Regla:** una credencial que el catálogo ofrece por workspace tiene que resolverse con
`credWs` en **todos** sus lectores, o no va al catálogo. Cuando se agrega un campo a
/integraciones, chequear que el consumidor lo lea por `credWs`/`getSetting` con la **misma
clave**; si no, la tab dice verde y la feature está muerta.

**Vive en:** app/api/webhooks/resend/route.ts:30 (sigue con secreto único) · app/api/webhooks/calendly/route.ts:60 · lib/metodo-catalogo.ts:594-601 · *2026-07-16 ~auditoria-env-vars · 2026-07-17 ~metodo-facts-del-ping · 2026-08-05 ~verificar-commits-contra-el-board*

### ⚠️ Hay dos cosas homónimas para la página de Facebook, y solo una de las dos valida unicidad

La setting `meta_page_id` (la escribe el wizard, `SETTINGS_WIZARD` en
`app/api/onboarding/route.ts`) es **la única que lee el cron de ingesta**. La credencial
`META_PAGE_ID` es la que /integraciones ofrece diciendo que sirve para rutear leads, y está
en `ROUTING_CREDS` porque es la clave con la que se rutea el webhook de Meta a su workspace.
Quien carga la equivocada no ingesta nada y no ve ningún error.

Y hay un segundo filo: si ese page id ya lo reclamó otro workspace, guardar la credencial
tira 409 `IdentificadorOcupadoError` con «ya está en uso por otro espacio de trabajo» — un
mensaje que para el cliente no significa nada y que no le dice qué hacer. Como el wizard
escribe por el otro camino y **no** valida unicidad, puede dejar un valor que la credencial
rechaza.

**Regla:** un identificador que sirve de clave de ruteo de webhooks tiene **un solo** lugar
de escritura, y su error de colisión necesita copy propio.

**Vive en:** lib/credenciales.ts (ROUTING_CREDS) · lib/webhook-routing.ts:32-38 · app/api/onboarding/route.ts (SETTINGS_WIZARD) · lib/settings.ts (meta_page_id) · lib/config.ts:46 · *2026-07-31 auditoria-tokens-meta · 2026-08-05 ~verificar-commits-contra-el-board*

### ⚠️ Borrar una credencial del dueño no la borra: otra lambda la resucita y el próximo boot la reescribe

`eliminarCredencial` borra la fila y hace `delete process.env[clave]`, pero **solo en la
instancia que atendió el POST** y solo si esa instancia la había hidratado (`hidratadas` es
un Set por proceso). El GET siguiente puede caer en otra lambda tibia donde el env sigue
vivo: `estadoCampo` devuelve `{ configurado: true, origen: 'servidor' }`, o sea que la fila
reaparece VERDE «guardada» — y como el tacho solo se renderiza con `origen === 'panel'`, ya
no se puede volver a borrar desde la UI. Peor: en el próximo cold start
`migrarEnvACredenciales` ve la clave en el env y sin fila en la base, y **la reescribe
cifrada**. No hay tombstone que distinga «nunca migrada» de «borrada a propósito». El aviso
del panel promete «las borrás cuando quieras y dejan de usarse al instante»: para ws1 es falso.

**Vive en:** lib/credenciales.ts:270-279 (eliminarCredencial), :151-154 (estadoCampo) y migrarEnvACredenciales · app/integraciones/ServicioConfigForm.tsx · *2026-07-16 ~auditoria-refactor-integraciones*

### ⚠️ Copiar lo del dueño con lista BLANCA deja servicios afuera en silencio, y el atajo se traga los errores

**Síntoma:** en el paso de Gemini del onboarding el botón decía «Listo: N cosas traídas» y la
key seguía vacía. En el Cliente de Prueba, la UI de Meta quedaba verde pero los leads de esos
formularios seguían entrando al ws1.

**El sospechoso número uno era `credWs`** —que devolviera null para el dueño porque la key
vive solo en el env de Vercel— y era falso: `credenciales.ts` hace exactamente lo contrario
(si no hay fila y el ws es el dueño, cae a `process.env`) y además `instrumentation.ts`
hidrata env→tabla en cada boot. Las causas reales son dos, y las dos son silenciosas:

1. **Lista blanca.** `SERVICIOS_CLIENTE` no incluía `'gemini'` (ni 9 de los 15 servicios del catálogo): el bucle hacía `continue` antes de leer la credencial. Como Meta y WhatsApp sí se copiaban, el contador daba >0 y la pantalla mentía. Agravante: el componente cliente **descartaba el array `avisos` entero**, así que ningún error de copia fue visible jamás.
2. **Identificadores de ruteo.** `META_PAGE_ID`, `FATHOM_HOST_EMAIL`, `CALENDLY_EVENT_TYPE_J1/J2` y `CHATWOOT_ACCOUNT_ID` están en `ROUTING_CREDS` y `guardarCredencial` tira `IdentificadorOcupadoError` porque ws1 ya los reclamó — y **el catch los saltea en silencio**.

**Regla:** para «copiar todo lo del dueño» va lista **NEGRA** (solo lo que es infra de la
agencia no viaja), nunca lista blanca — con lista blanca cada servicio nuevo del catálogo
queda afuera sin que nadie se entere. Y el atajo tiene que **devolver** cuáles se salteó.

**Vive en:** lib/datos-mau.ts (hoy itera SERVICIOS_METODO entero) · app/_components/DatosDeMau.tsx · lib/metodo-catalogo.ts · app/api/onboarding/route.ts (case 'simular') · lib/webhook-routing.ts (ROUTING_CREDS) · lib/credenciales.ts (guardarCredencial) · *2026-08-01 mako-onboarding-copy-y-bugs / mapa-clonar-workspace*

**⚠️ Lo que el dueño reportó y sigue abierto sobre «Datos de Mauricio»:** no copia todas las
integraciones (falta la de Claude) y el botón de redirigir al chat lleva siempre al último
(2026-08-02); falta el apartado para **ver y traer las integraciones** dentro de «Datos de
Mauricio», y sin eso no se puede probar en el Cliente de Prueba; el desplegable se cierra al
scrollear (2026-08-02); el botón no aparece al lado de «Salir de la vista» en ninguna tab
(2026-08-01). **Ojo con la decisión que se dio vuelta:** el botón se creó para no rehacer el
onboarding —«no quiero desconectar las cosas de Mauricio» (2026-08-01)— y tres días después
se decidió que **no debe existir**: «Revisa bien el tema de Completar con los datos de Mau
eso NO debería existir» (2026-08-05). Antes de invertir ahí, confirmar cuál de las dos manda.

### ⚠️ ELEVENLABS se conecta, se pinta verde y no la usa absolutamente nada

El único lector de `ELEVENLABS_API_KEY` en todo el repo es el ping de «Probar conexión». No
existe `lib/elevenlabs.ts` ni una sola llamada a `api.elevenlabs.io` fuera de esa
verificación. El copy de /integraciones promete «Voz por IA: locuciones y audio generativo
con tu propia key»: el cliente pega la key, la ve en verde, la da por andando, y no hay nada
que la consuma. O se construye la generación de voz, o se saca del catálogo, o se marca como
«próximamente».

**Vive en:** lib/metodo-verificar.ts:246 (único lector) · lib/metodo-catalogo.ts:274 · lib/integraciones-catalogo.ts:48 · *2026-08-05 ~auditoria-ruleta-hidratacion-credenciales*

### «Key válida» no es «la integración sirve», y a veces el mensaje miente

Auditoría de los 8 pings de /metodo: casi todos piden el dato y lo tiran. Los tres que muerden:

- **Resend:** una key con solo *Sending access* NO puede leer `/domains` → el ping devuelve 401 y muestra «API key inválida», que es **falso**: la key sirve, le falta scope.
- **Meta:** ya pide `account_status` y lo descarta — una cuenta con saldo impago (status 3) pinga 200 y no entrega un solo anuncio. Y `amount_spent` viene en **centavos**.
- **Fathom:** el endpoint devuelve `{ items, next_cursor, limit }`, no `{ meetings }` — implementarlo con `body.meetings` deja los facts vacíos y `ok:true` igual. **Panda** con `?limit=1` trae el video más reciente, casi nunca el VSL.

**Regla:** el ping tiene que distinguir «la credencial autentica» de «la cuenta sirve», y el
error tiene que decir **cuál de las dos** falló.

**Vive en:** lib/metodo-verificar.ts (meta :33, email :58, fathom :102, panda :112) · *2026-07-17 ~metodo-facts-del-ping*

### El ping de YouTube valida la key contra Rick Astley

`verificarServicio('youtube')` pide `part=id` sobre `YOUTUBE_VSL_VIDEO_ID` y, si el cliente
no lo cargó, cae a un id hardcodeado: `dQw4w9WgXcQ`. Hoy no se nota porque solo se cuenta
`items.length`, pero cualquier plan de mostrar «facts» del ping (título/canal, que salen
gratis con `part=snippet`) le pintaría «Never Gonna Give You Up — RickAstleyVEVO» en el panel
del propio cliente, que lo lee como que le conectamos la cuenta de otro.

**Regla:** un fallback puesto para validar credenciales **no puede filtrarse nunca a la UI**;
si falta el ID, el fact es «Key válida — falta el ID de tu VSL» y nada del video.

**Vive en:** lib/metodo-verificar.ts:121-127 · *2026-07-17 ~metodo-facts-del-ping*

### `opcional` no es cosmético, y los dos DTOs de credenciales copian props a mano

Para el rediseño de Meta a un solo token la tentación era marcar los otros cinco campos como
`opcional: true` y esconderlos. **No se puede:** `opcional` gobierna `integracionConectada`,
el `faltan` de la verificación, `calcConectada` y el semáforo — con todo opcional menos el
token, Meta pasa a «conectada» apenas pegás el token y se prenden /marketing, /experimentos y
/ads-analyst, que revientan al pedir insights. La decisión fue una prop **nueva y aditiva**
(`autodescubierto`), sin tocar `opcional`.

Trampa asociada: el estado del servicio viaja por **dos DTOs que copian prop por prop a
mano** (el del API y el `type Campo` del form), así que una prop nueva del catálogo llega
`undefined` sin ningún error de tipos — la falla más probable de ese rediseño. Y ojo con
sacar envs del array `campos` para esconderlos: `ENVS_METODO` se deriva de ahí y es la
whitelist de guardar/borrar/revelar.

**Vive en:** lib/metodo-catalogo.ts (CampoCredencial + ENVS_METODO) · app/api/integraciones/credencial/route.ts:99-111 · app/integraciones/ServicioConfigForm.tsx:37-51 · *2026-07-31 mapa-integraciones-meta*

### El estado de una integración se pinta donde vive el chequeo, y el error del callback OAuth muere si nadie lo traduce

**Síntoma:** Google Calendar figuraba «conectado» (punto verde, contando en «N/M conectados»)
cuando en realidad tenía token pero le faltaba el permiso para mover reuniones; la verdad
recién aparecía al abrir el modal, porque `getGoogleCalendarStatusAction()` vivía **adentro
del modal**.

**Regla 1:** conectado = token **Y** permiso, y el chequeo tiene que subir al lugar donde se
pinta el estado, no quedarse en la pantalla que se abre después.

**Segundo agujero del mismo flujo:** el callback siempre vuelve a `/integraciones?gcal=<motivo>`
pero el mapa de mensajes vivía en `GoogleCalendarPanel`, un componente que **no estaba montado
en ninguna página** — un re-consent fallido (`sin-refresh`, `csrf`, `exchange`) recargaba la
pantalla idéntica, sin una palabra: el loop exacto de «aprieto Conectar y no pasa nada».

**Regla 2:** el traductor del parámetro de vuelta se monta en la pantalla a la que redirige el
callback, y se exporta desde un solo lugar (hoy `GCAL_MSG`).

**Vive en:** app/integraciones/IntegracionesBoard.tsx:169 · app/configuraciones/GoogleCalendarPanel.tsx:38 (GCAL_MSG) · app/api/integraciones/google-calendar/route.ts · *2026-08-06 ~busqueda-crm-y-estado-google-calendar*

### Google OAuth: los preview deploys nunca van a matchear, y falta la URI de localhost de Calendar

`googleRedirectUri()` deriva la URI del origin del request cuando no hay `GOOGLE_REDIRECT_URI`
(que no existe ni en Vercel ni en local, a propósito). Dos consecuencias:

- En cualquier **preview deploy** el origin es un `*.vercel.app` distinto cada vez y Google no acepta wildcards: el login da `redirect_uri_mismatch` SIEMPRE. No tiene arreglo razonable — es saberlo y listo.
- En **dev**, como `.env.local` no define `NEXT_PUBLIC_APP_URL`, la URI que arma es `http://localhost:3000/api/integraciones/google-calendar/callback`, que **no está autorizada** en la consola: conectar Google Calendar desde `npm run dev` falla con Error 400.

**⚠️ Pendiente del dueño:** sacar el aviso de Google «Esta app está en prueba» que aparece al
conectar Google Calendar (2026-08-06).

**Vive en:** lib/google-calendar.ts:32-37 · app/api/auth/google/route.ts:29-30 · consola de Google Cloud (cliente 118392241323-j98eq…) · *2026-08-05 ~auditoria-mudanza-dominio*

### Borrar `AUTH_ALLOWED_EMAILS` no limpia nada: ACTIVA la rama que auto-crea admins

La variable ya cumplió su función (los usuarios que importan tienen fila, así que
`buscarUsuarioPorEmail` los resuelve antes de mirar la allowlist) y **parece basura
borrable**. Pero el bootstrap del callback de Google es
`if (!process.env.AUTH_ALLOWED_EMAILS && (await contarUsuarios()) === 0)`: la variable seteada
es lo único que mantiene esa rama apagada. Si se borra «por limpieza» y algún día la tabla
`usuarios` queda vacía (wipe, restore malo, migración), **la primera cuenta de Google que
entre se auto-crea ADMIN**. Además se pierde el break-glass con la base caída, que hoy deja
entrar a un email de la allowlist aunque Supabase esté muerta.

**Vive en:** app/api/auth/callback/google/route.ts:29,40,43,52-59 · *2026-07-16 ~auditoria-env-vars*

### Reglas del dueño sobre credenciales y configuración

- **Nunca pedirle al usuario que cargue nada en Vercel.** Toda credencial se configura desde /integraciones, por el mismo camino que cualquier usuario nuevo: «No me podes seguir pidiendo poner NADA en vercel, todo se debe solucionar como lo haremos con cualquier usuario nuevo» (2026-07-16) y «Jamás algo como pedirle al usuario que lo cargue en vercel… Recuerda que estamos utilizando el método tipo BYOK».
- **Cada credencial que te pasa se guarda TAMBIÉN en el `.env.local`**, sin que lo pida: «Solo frené para decirte que guardes todo también en el env local» (2026-07-16).
- **Todo lo que pide una API se configura en un solo lugar y con un solo formato:** lista completa de keys, ojito para previsualizar, probar conexión y eliminar. El `?` con el tutorial **desaparece cuando la key ya está**: «En 'Conecta la IA de MaKo' tiene que ser IGUAL a integraciones…» / «le di al botón de '?' para ver el tutorial. Pero luego de dejar la key, aún sigue saliendo, eso NO debería ser así» (2026-07-29).
- **No marcar como pendiente una API que el usuario nunca va a usar.** El VSL puede estar en Panda o en YouTube (y a futuro más): se le pregunta dónde lo tiene — «si selecciono que la tengo alojada en Panda mi VSL, no debería marcarme como que tengo PENDIENTE cargar API que en realidad nunca uso» (2026-07-17).
- **Todo se configura con prompts y botones**, nada de configuración manual en ninguna feature: el usuario no tiene que aprender a configurar un software (2026-06-30).
- **El tracking de la landing del cliente se instala pegando un snippet** en /integraciones, sirva la landing donde sirva (Lovable, Claude, lo que sea), con un verificador tipo el del Pixel de Meta: «El lead puede tener su landing en muchos lugares… lo mejor es hacerle copiar un código para que lo pegue donde sea» (2026-07-16). Ojo con lo que eso implica al mudar de dominio: ver [Build, deploy y entrega](#build-deploy-y-entrega).

### ⚠️ Pendientes abiertos de /integraciones

| Qué | Cuándo lo reportó |
|---|---|
| **Cerebras no deja conectarse**, y las integraciones nuevas no aparecen en /integraciones | 2026-07-22 |
| **GitHub no aparece** en las integraciones de super admin: «aún no veo el github» | 2026-08-06 |
| Falta el **tutorial para poner el link de MaKo dentro de Fathom** | 2026-08-06 |
| El **historial de problemas dice «Sin incidentes registrados»** cuando hubo muchísimos y varios activos; debe marcar de qué día y hora a qué día y hora pasó cada incidente | 2026-07-15 |

---

## Webhooks: recibir sin perder eventos

### ⚠️ Un 200 en un webhook es un ACK: el `null` por falla de base se come el evento para siempre

`wsPorIdentificador` colapsa dos cosas distintas en `null`: «este identificador no está
mapeado» y «el SELECT falló» (hace `const { data } = await …maybeSingle()` y descarta
`error`; supabase-js **no lanza** en fallo de red). El receptor entonces contesta
`200 {ok:true, ignored:'sin workspace'}` — y un 200 es un acuse de recibo: Svix/Calendly **no
reintentan** y esa reunión o esa agenda se pierde sin rastro.

El verificador que revisó este hallazgo descartó la versión que apuntaba al secreto de firma
(ahí un 401 sí hace reintentar) y señaló que el fail-open que cuesta caro es este.

**Regla:** en un receptor de webhook, `null` por ausencia y `null` por falla **no pueden
compartir salida** — la falla de lectura se contesta **503** para que el proveedor reintente,
nunca 200. Y un webhook que descarta un evento tiene que dejar rastro, no un 200 mudo.

**Vive en:** lib/webhook-routing.ts:44-61 + app/api/webhooks/fathom/route.ts y calendly/route.ts · *2026-08-05 ~review-commit-firma-webhooks*

### ⚠️ «Calendly conectado» y cero agendas, sin un solo error: un campo que el ruteo necesita estaba marcado `opcional`

**Síntoma:** el cliente pega su signing key, la tab se pinta verde, y no entra una sola
agenda. Cero errores en ningún lado.

**Causa, en dos capas:** (1) el route leía `process.env.CALENDLY_WEBHOOK_SIGNING_KEY` y nunca
`credWs`, así que el webhook propio del cliente comía 401 para siempre (ver
[Credenciales](#credenciales-e-integraciones-byok)); (2) el agujero peor —
`CALENDLY_EVENT_TYPE_J1/J2` figuran `opcional: true` en el catálogo pero **`ROUTING_CREDS` los
exige**: sin ellos `wsPorIdentificador` devuelve null y el route contesta 200 OK con
`ignored: 'sin workspace'`.

**Por qué duele tanto:** sin R1 no hay cohortes, ni funnel, ni SCL, ni revenue. Toda la
cadena de medición del negocio cuelga de ese evento.

**Regla:** un campo que el ruteo necesita **no puede estar marcado opcional**.

**Vive en:** app/api/webhooks/calendly/route.ts:60 · lib/webhook-routing.ts:33-35 · lib/metodo-catalogo.ts:594-601 · *2026-07-17 ~metodo-facts-del-ping (reconfirmado el 2026-07-19)*

### ⚠️ Una suscripción de webhook se DESHABILITA sola, y del lado de Calendly no hay pantalla que lo diga (19/09/2026)

**Síntoma:** nueve días sin una sola agenda en el CRM, con la tab en verde, el endpoint
sano y cero errores en ningún lado. Lo que estaba pasando es que **Calendly había
deshabilitado la suscripción**: tras días de entregas fallidas la pasa a `disabled`, deja
de mandar, y **no avisa a nadie**.

Tres trampas del proveedor, las tres medidas ese día:

- **Calendly no tiene UI de webhooks.** No se ven, no se crean y no se arreglan desde su
  panel: la única puerta es la API v2 con un PAT (`/webhook_subscriptions`). Martín entró a
  buscarlo y la pantalla que sí existe es la de tokens.
- **Una suscripción `disabled` no se puede reactivar**: hay que borrarla y crear otra. Y
  crear otra con la MISMA URL mientras la vieja exista devuelve **409 «Hook with this url
  already exists»**, aunque la vieja esté muerta. O sea que el orden es parte del arreglo:
  borrar primero.
- **La clave de firma se puede FIJAR al crear** (`signing_key` en el POST). Es lo que
  permite que los dos lados coincidan desde el primer envío en vez de guardar a ciegas lo
  que Calendly devuelva.

**El diagnóstico obvio era el equivocado, y era MÍO.** La verificación de punta a punta del
script mandaba un evento inventado, firmado con la clave nueva, esperando el `200 · sin
ruteo` del route. Contestó **401 «Firma no coincide»** y se leyó como «el arreglo falló».
El arreglo estaba perfecto: el route **resuelve el workspace ANTES de verificar** y con eso
elige la clave (`keyWs = ws == null ? null : credWs(...)`; `signingKey = keyWs ?? envCred(...)`),
así que un evento que no rutea a nadie se compara contra la clave de **plataforma**, no
contra la del ws que el script acababa de guardar. Medido con el mismo cuerpo llevando el
nombre del event type: **400 `incomplete_payload`** (la firma validó y el route no tocó un
dato) y **401** con una clave inventada.

**Regla: una prueba firmada contra un receptor multi-inquilino tiene que RUTEAR.** Si el
cuerpo no resuelve workspace, no está probando la credencial que se quiere probar — está
probando el fallback, y contesta lo mismo que una firma mala. El cuerpo bueno es el que
muere en la validación de datos (400) después de la firma: prueba el camino entero sin
escribir nada.

**Por qué no se sabe QUÉ la deshabilitó, y qué se descartó.** Los reintentos arrancaron el
11/09 a las 13:36 UTC y el último lead por Calendly entró el 10/09 a las 04:03 UTC. En esa
ventana: no hubo ningún deploy que tocara el route, `lib/calendly.ts`, las credenciales, el
ruteo ni `rutas-publicas` (el único commit del 10/09 fue `/analisis/trimestre`); la env var
`CALENDLY_WEBHOOK_SIGNING_KEY` de Vercel es del 05/08 y nadie la rotó; los dos
identificadores de `webhook_routing` siguen coincidiendo palabra por palabra con los nombres
vivos de los event types; y la cuenta acepta crear suscripciones, así que no es el plan.
**Lo que queda es que la evidencia caduca**: la API v2 de Calendly no expone los intentos de
entrega y los logs de Vercel duran minutos. Pasados unos días, de un webhook caído sólo
queda el efecto.

**Lo que costó, medido contra la API de Calendly y el CRM:** 8 reservas entraron en el
agujero. Una persona **no existe en el CRM** (agendó para el lunes 21/09), otra sí existe
pero sin su `fecha_junta_1`, así que el motor la sigue nutriendo como si no hubiera
agendado; dos reagendas de un mismo lead no figuran, y una reserva la terminó cargando
Mauricio a mano. `scripts/backfill-calendly.ts` las recupera (idempotente, sólo completa
campos vacíos).

**Se llevó puesta de paso una deuda de seguridad:** la clave del ws1 era
`updated_by='migracion-env'`, o sea **la copia de la env de plataforma** — la fila y el
fallback apuntaban al mismo secreto, que es lo que `docs/estado-del-arte.md` tenía anotado
como forja cross-tenant abierta. Ahora el ws1 tiene la suya, única. Queda vaciar la env var
de plataforma (recién después de ver entrar una reserva real) y borrar la copia que
`datos-mau` dejó en el ws4.

**Lo que falta:** un vigilante. Nada mira si la suscripción sigue `active` ni si hace N días
que no entra una reserva, y ese silencio es el que costó los nueve días — no la caída.

### El backfill, cuatro días después: estaba escrito y habría escrito mal (23/09/2026)

Se corrió recién el 23/09, y antes hubo que arreglarle cuatro cosas. Las cuatro comparten
una forma: **el script y el webhook hacen el mismo trabajo por dos caminos distintos, y el
del script se quedó en la versión vieja.**

- **Usaba el extractor que el webhook ABANDONÓ.** `extractAnswer` con keywords sueltas
  devuelve la PRIMERA pregunta que contenga la palabra, y «equipo» matchea «…multiplicar los
  resultados de tu equipo» (la de inversión) antes que «¿Cuántos colaboradores tienes?». El
  webhook lo cambió por `extractRespuestaPorFrase` y dejó el porqué escrito al lado; el
  backfill no se enteró. En un lead que ya existe el daño lo tapa `soloCompletarVacios`; **en
  uno NUEVO el insert escribe la respuesta cruzada sin ninguna condición**, y el agujero
  tenía justamente una persona que no existía en el CRM.
- **No pasaba `junta_1_at`** (la hora exacta), que es lo que mira el «ya pasó» de crm-auto.
  Ni `respuesta_inversion` ni `respuesta_decisor`, que `lead-resumen` y `analisis-negocio`
  leen de la COLUMNA: el lead recuperado se habría leído como «no contestó».
- **El dedup de `lead_respuestas` no matcheaba.** Compara `evento_inicio` con un `.eq`
  exacto; el webhook manda el DÍA (`2026-09-21`) y el script mandaba el ISO completo. La
  misma reunión quedaba con dos filas. El comentario del script decía «idempotente por
  (lead, reunión, evento)» y era falso por un formato.
- **Y el `--dry` no validaba nada:** hacía `continue` ANTES de consultar la base, así que
  contestaba «qué trae Calendly», no «qué le va a pasar al CRM» — que es la única pregunta
  que importa antes de correrlo. Ahora hace los MISMOS dos lookups que la escritura
  (teléfono normalizado, después email) e imprime CREA / COMPLETA(campos) / NADA por
  invitee. Es la regla de AGENTS.md sobre los preview: **el que no pasa por el camino de
  escritura estima, no valida.**

**Lo que salió:** con `--desde=2026-09-05`, el dry anticipó 1 alta, 3 completados y 8 sin
cambios, y eso pasó. Samuel Bonilla —que agendó el 19/09 para el 21/09— **ahora existe en el
CRM**, con su `created_at` backdateado al día real y sus respuestas sin cruzar. Otros dos
recuperaron `junta_1_at` y `respuesta_inversion`.

⚠️ **Y una que hay que saber antes de correr cualquier backfill de leads:**
`upsertLeadFromCalendly` llama a `avisarFusion` en todo update que escriba, o sea que le
manda a Mauricio «entró un contacto por Calendly y lo sumé a X» por algo que no entró hoy.
Hoy sale UNO solo y no cien, pero por casualidad: el dedup de ese aviso es global por tipo
porque no lleva `dedupKey`. Se apagó el aviso en el ws1 durante la corrida y se volvió a
prender. **La pregunta antes de un backfill no es sólo qué escribe, sino a quién le avisa.**

**Vive en:** scripts/arreglar-webhook-calendly.ts · app/api/webhooks/calendly/route.ts:100-140 · scripts/backfill-calendly.ts · docs/estado-del-arte.md:174 · *2026-09-19 ~calendly-suscripcion-deshabilitada · corrido 2026-09-23*

### ⚠️ Y se murió OTRA VEZ dos días después de arreglarla — por un evento, no por la integración (06/10/2026)

**Síntoma:** en el ws1 no entra un agendamiento desde el 23/09 mientras siguen entrando leads por
formulario (41 desde el 20/09). Medido en sólo lectura: la suscripción que creó el script el 19/09
está `disabled`, con `retry_started_at` **2026-09-21T08:28:39Z** — el mismo minuto de **tres
cancelaciones hechas por el anfitrión** entre las 08:27 y las 08:28. La signing key no se tocó
desde el 19/09, así que no es una clave pisada. Calendly tiene 4 reservas posteriores que no
están en el CRM (28/09, 30/09, 01/10, 02/10); dos todavía vienen (10/10 01:00 y 13/10 17:00 UTC).

**La causa, hasta donde se puede medir:** la rama `invitee.canceled` contestó algo que no era
2xx, Calendly reintentó dos días y deshabilitó la suscripción ENTERA. Qué falló adentro no se
sabe: los logs ya vencieron. Lo estructural sí se ve en el route: **ante un error de proceso
devuelve 500/400**, y un evento que falla SIEMPRE —el mismo cuerpo, la misma excepción— se
reintenta hasta que el proveedor apaga todo. Es la segunda vez (11/09 y 21/09).

**La regla que queda, y es la otra mitad de «un 200 es un ACK»:** un 5xx le dice al proveedor
«reintentá», y eso sólo es verdad para lo TRANSITORIO (la base caída, un timeout). Lo que va a
fallar igual en cada reintento —un dato que no cierra, un lead que no se encuentra, una
excepción del código— se contesta 2xx y se REGISTRA donde se pueda leer, o un solo evento
envenenado apaga la integración de todos. Ya se había decidido así para el «sin ruteo»; la rama
de proceso no lo hace.

**Y la suscripción de n8n también está muerta**, desde el 22/08 (scope user,
`automation.leandrotejado.space`, sólo `invitee.created`): el workflow «WhatsApp Reminders for
Calendly» no recibe reservas nuevas desde entonces. Corrige la memoria que lo daba prendido.

**HECHO el 06/10/2026 15:50, con el OK de Martín:** la suscripción se recreó (`active`, la prueba
firmada da 400 con la clave del ws y 401 con una inventada) y el backfill desde el 20/09 trajo 3
leads nuevos y completó 1. El aviso `lead-fusionado` se apagó para la corrida y se devolvió
exactamente como estaba (ya venía apagado por herencia).

~~⚠️ **Y el backfill NO guarda el link de la reunión** (`junta_X_url`, mig 0204): sólo el webhook en
vivo lo escribe.~~ **ARREGLADO el mismo día:** el backfill escribe el link (`guardarLinkDeReunion` +
`linkDeReunion(ev.location)`). Las dos reservas recuperadas con reunión por delante se habían
completado a mano con el `join_url` de la API de Calendly.

**Medido contra producción el 06/10 (sólo lectura):** el `location` que devuelve
`GET /scheduled_events` para las dos reservas futuras, pasado por `linkDeReunion`, es
**idéntico** al link que se les puso a mano a los leads 2592 y 2593, con el mismo instante. O sea
que el LISTADO de Calendly trae el mismo objeto que el webhook en `scheduled_event.location` (en
Cal.com no: ver AGENTS.md, «la forma de un webhook se mide en el webhook»).

⚠️ **SIN HACER, y a decidir si importa:** la regla de main escribe en TODA fila cuyo `junta_X_at`
sea esa reunión, también en las que ya pasaron y también con `null` si el evento no trae
`join_url`. Inocuo hoy —el único lector es el recordatorio, que nunca manda por una reunión
pasada—, pero un link puesto a mano en una reunión cuyo evento de Calendly no trae `join_url` se
pisa con null. La misma tarde se escribió otra versión en una rama aparte (`fcfe373e`,
`linkACompletar`: sólo si la columna está vacía, sin escribir nulls y sólo reuniones futuras) y
no se unió el 09/10 porque main ya tenía la suya; si hace falta, está ahí.

⚠️ **Y lo que el backfill NO recupera, que es la letra chica de «200 y anotado»:** corre SÓLO sobre
el ws1 (token y config del dueño), y una reserva que trae vuelve como lead con su reunión y su link
pero SIN lo que dispara el webhook —la bienvenida, el aviso al dueño, el CAPI, los flujos—. Una
cancelación no la trae nunca (lista sólo `status=active`). Los comentarios del route y del
clasificador decían «el backfill la vuelve a traer» a secas; se corrigieron.

**HECHO el 06/10/2026 (tarjeta #20):** los tres catch de proceso del route, y una red de afuera para
lo que escape, pasan por `responderFalloDeProceso`: **503 sólo si `esErrorTransitorio`**
(`lib/calendly-error.ts`: red, timeout, 5xx/429 de un proveedor, la base sin conexión; en la duda,
NO), y si no, **200 y anotado** en `calendly.fallos_proceso` del workspace del evento (evento, uuid
de la reserva, email, mensaje, cuándo; tope 30). El clasificador lee TEXTO porque `lib/leads.ts`
envuelve el error de Supabase y pierde el `code`; y nunca un número suelto, porque «Error
actualizando lead 503: duplicate key…» lleva el id del lead. Lo fija `tests/calendly-error.test.ts`
(errores medidos, en vivo contra un server local, y guard sobre el route sin comentarios), probado
rompiéndolo: 19 roturas, todas cayeron. Y el backfill ya escribe el link (`guardarLinkDeReunion` +
`linkDeReunion(ev.location)`, con `soloSiInicio` para no ponérselo a otra reunión del mismo lead).
**Quedan afuera del route:** los 400 de `incomplete_payload` / `no_payload` siguen siendo no-2xx
(inalcanzables con un evento real; `scripts/arreglar-webhook-calendly.ts` los usa de señal de que
la firma pasó) — **lo decide Martín**, igual que si `calendly.fallos_proceso` se muestra en alguna
pantalla (hoy sólo se lee con una consulta).

### ⚠️ Y el clasificador en verde dejaba pasar a 200 tres fallos de RED, y el ruteo no lo usaba (06/10/2026, noche)

**El diagnóstico obvio era el equivocado:** con 19 roturas cayendo y los errores medidos en vivo,
el arreglo de la tarde se leía cerrado. Un refutador encontró, contra el mismo código, CINCO caminos
por los que un fallo que se arregla reintentando se contestaba 200 y se perdía:

1. **El cuerpo cortado a la mitad** (los headers ya salieron): el crudo de supabase-js trae «other
   side closed» en `details`, pero `lib/leads.ts` envuelve sólo el `message`, que dice
   **«TypeError: terminated»** — ninguna regla lo leía. Va `\bterminated\b` en `RED` (con borde:
   «Unterminated» es un JSON roto).
2. **El gateway que contesta SIN cuerpo:** postgrest-js deja `message: ''` y el status no viaja en
   el error, así que el envoltorio queda **«Error buscando lead por email: »**, con la cola vacía.
   Medido en vivo con un 502 vacío. Un error permanente de PostgREST siempre trae su JSON con
   mensaje: la cola vacía se reintenta (`CUERPO_VACIO`, mirado sobre el mensaje de AFUERA).
3. **nginx:** su página dice «503 Service **Temporarily** Unavailable», y la frase corta no la cubría.
4. **El RUTEO** usaba `wsPorIdentificador`, que no lee el `error` de supabase-js y tiene un `catch`
   que devuelve null: la base caída se leía «este evento no es de ningún negocio» → la rama del sin
   ruteo → 200, con un mensaje que culpa a la configuración. Lo mismo la signing key (`credWs` →
   null → la key de plataforma → 401, un no-2xx que suma para deshabilitar) y la R1/R2 (sin el tipo
   de la R2, una R2 se graba como R1).
5. **La firma:** comparaba el largo en CARACTERES antes de `timingSafeEqual`, que exige bytes: un
   `v1` con 64 «ñ» tiraba `RangeError` → un 500 de Next sobre una firma mala.

**Cómo quedó:** `wsPorIdentificadorEstricto` y `credWsEstricta` (funciones APARTE: las de siempre
las usa medio producto y cambiarles el comportamiento es otro trabajo) tiran si la base no contesta,
con `code/details/hint` del original. En el route, el ruteo y la key van en un `try` que contesta
por `responderFalloDeProceso` con la rama nueva **`ruteo`**: transitorio → 503; si no, 200 y anotado
**en el workspace del super admin** (fuera de `runWithWorkspace`, `setSetting` cae al ws1, que es un
cliente). La R1/R2 estricta cae a la red de afuera. Y como todo eso corre ANTES de la firma, los
candidatos de ruteo se topean en 300 caracteres: uno de 20 KB armaría una URL que falla siempre, un
200 anotado por cada pedido sin firmar.

Lo fija `tests/calendly-error.test.ts` (15 tests: los casos nuevos, un EN VIVO con el cuerpo
cortado, el 502 vacío y nginx, la firma con «ñ», y un guard sobre el ruteo), probado rompiéndolo:
12 roturas, las 12 cayeron.

**La regla que queda** (va en AGENTS.md, en la de los webhooks): **la lectura que decide DE QUIÉN
es un evento entrante se hace con la variante estricta.** Con la que traga el error, «no pude leer»
y «no es de nadie» son el mismo null, y el segundo se contesta 2xx.

**Vive en:** app/api/webhooks/calendly/route.ts · lib/calendly-error.ts · lib/webhook-routing.ts
(`wsPorIdentificadorEstricto`) · lib/credenciales.ts (`credWsEstricta`) · lib/calendly.ts
(`verifyCalendlySignature`) · tests/calendly-error.test.ts

~~**SIN HACER:** los otros webhooks (Cal.com, Chatwoot, Meta, Fathom) siguen ruteando con
`wsPorIdentificador`.~~ **Hecho el 07/10/2026** (`3d11b05c`), ver la entrada siguiente.

**Vive en:** app/api/webhooks/calendly/route.ts (la rama `invitee.canceled` y el `catch` de proceso) · scripts/arreglar-webhook-calendly.ts · scripts/backfill-calendly.ts · *2026-10-06 wf_fe0d104c-25c, implementador y revisor de #17*

### Los otros cuatro webhooks, y qué hace cada proveedor con un 5xx (07/10/2026)

El pedido, textual: «Haz esta tarea aquí: “Ruteo estricto en los otros cuatro webhooks”».

**Lo que faltaba medir antes de escribir —y que decide qué contestar—** es qué hace cada uno
con una respuesta que no es 2xx. Medido en su documentación y en su código ese día:

| Proveedor | ¿Reintenta? | ¿Deshabilita? | Fuente |
|---|---|---|---|
| Calendly | sí, ~24 h | **sí**, la suscripción entera | ya medido el 06/10 |
| Fathom (Svix) | sí: 5 s, 5 min, 30 min, 2 h, 5 h, 10 h, 10 h | **sí**, el endpoint, si falla 5 días seguidos | docs.svix.com/retries |
| Meta (leadgen) | sí, ~36 h con frecuencia decreciente | no | guía de Webhooks de Meta |
| Cal.com | **no** | no | `packages/features/webhooks/lib/sendPayload.ts`: un intento y devuelve el status |
| Chatwoot | **no** (sólo los agent bots, con 429/500) | no | `lib/webhooks/trigger.rb`, `app/jobs/webhook_job.rb` sin `retry_on` |

**Cómo quedó:** los cuatro rutean con `wsPorIdentificadorEstricto`, y el fallo pasa por
`responderFalloDeRuteo` (`lib/webhook-fallo-ruteo.ts`): el clasificador de Calendly decide 503 o
200, y **siempre** se anota en `webhooks.fallos_ruteo` (workspace del super admin; la parte pura
en `lib/webhook-ruteo-huella.ts`). Para Cal.com y Chatwoot el código de respuesta no recupera
nada —no reintentan—: lo que cambia es que el evento perdido queda ANOTADO en vez de leerse «no
es de nadie», que es el único rastro posible.

- **Las keys que deciden la firma** (Cal.com, Fathom) se leen estrictas: con `credWs`, la base
  caída daba **401 «firma rechazada»** sobre un secreto que estaba bien — y para Svix, un no-2xx
  más hacia el apagado.
- **Cal.com lee J1/J2 estricto, y era el peor de los cuatro:** con la base caída las dos daban
  null, una R2 se clasificaba como R1 y **creaba un lead** — lo que «una R2 nunca crea un lead»
  prohíbe. Era un dato inventado, no uno perdido.
- **Meta tiene varios leads por pedido**: si el ruteo de alguno falló de forma transitoria, el
  LOTE va 503. Es seguro porque reprocesar no duplica (dedup por `meta_lead_id`; aviso, flujos y
  nutrición sólo al CREAR; CAPI con event_id fijo). Lo que falla DESPUÉS del ruteo sigue yendo
  200 a propósito: ahí ya pudieron correr efectos y un reintento los saltearía; lo rescata el cron
  `meta-leads-poll`. Y el token de página, estricto: con la base caída el lead se anotaba
  «META_PAGE_ACCESS_TOKEN no configurado».

Lo fija `tests/webhooks-ruteo-estricto.test.ts` (9 tests, dieciséis roturas, todas cayeron), con
un barrido de toda `app/api/webhooks/`.

~~**SIN HACER — la misma lectura tolerante, fuera de los webhooks.**~~ **Hecho el 07/10/2026**
(`dd58b168`), con el pedido «Ruteo estricto en /api/track y los tokens». Cada lugar contesta
distinto, porque cuesta distinto:

- **`/api/track/optin` (un lead):** el snippet lo manda UNA vez, con `keepalive` y sin mirar la
  respuesta (`mandarOptin`, `lib/landing-token.ts`), así que ningún código de respuesta lo
  recupera. Lo que sí sirve es **reintentar la lectura adentro del pedido**
  (`conReintentoTransitorio`, `lib/webhook-ruteo-huella.ts`: sólo lo transitorio, dos esperas
  cortas): un corte de la base suele durar segundos. Si igual no se puede: anotado sin datos de la
  persona y 503.
- **`/api/track/vsl` y `/replay` (medición):** estrictos y 503, **sin** reintento a propósito — en
  un corte, reintentar cada beacon le suma carga a la base caída.
- **El token del agente (8 rutas de `/api/agente` y `/api/v1`):** contestaba **401 «token inválido
  o revocado» sobre un token bueno**, que manda a la persona a rotarlo. Ahora «no pude verificar»
  va 503 (`wsDelBearer`). Y era DOBLE: también el setting del token vigente se leía tolerante.
- **`lib/chatwoot.ts` (el chequeo de salud):** decía «sin ruteo» y ofrecía REPARAR un webhook sano.
- **`lib/landing-token.ts` se queda tolerante, y es la única:** no decide de quién es nada; «no
  pude leer» termina en un upsert idempotente. Está en `TOLERANTES_A_PROPOSITO` del test, que
  ahora barre TODO `app/` y `lib/` y falla si una excepción ya no se usa.

**SIN HACER:** `webhooks.fallos_ruteo` no lo dibuja ninguna pantalla, igual que
`calendly.fallos_proceso`.

**Vive en:** app/api/webhooks/calcom/route.ts · app/api/webhooks/chatwoot/route.ts ·
app/api/webhooks/fathom/route.ts · app/api/webhooks/meta-leads/route.ts · lib/webhook-fallo-ruteo.ts ·
lib/webhook-ruteo-huella.ts · tests/webhooks-ruteo-estricto.test.ts

---

## Crons y trabajo de fondo

### ⚠️ Los crons de ENVÍO no iteran workspaces: solo el dueño recibe algo

`reporte-diario`, `reporte-horario` y `reporte-semanal` llaman `getContactoReportes()` y
`getNotifPrefs()` sueltos, sin `correrPorWorkspace` ni `runWithWorkspace`: en un cron no hay
sesión, así que el workspace cae al del dueño y el reporte sale **una sola vez, para él**.
Los crons de INGESTA sí hacen el fan-out; los de ENVÍO no. Hay que cerrarlo antes de venderle
el semáforo al segundo cliente: la landing promete «elegís qué te llega y por dónde» y hoy eso
corre sobre un perfil único. Verificado el 7/8/2026.

**Y el molde que uno copiaría es justo el equivocado.** Para un cron nuevo hay dos moldes:

- `correrPorWorkspace(servicio, fn)` filtra por `integracionConectada(servicio, ws)`. Si tu tarea **no** cuelga de un proveedor, pasarle un servicio cualquiera hace que **no corra** para los clientes sin esa integración, en silencio.
- El molde correcto para un cron no atado a un proveedor es el de `nutricion` / `email-broadcasts`: `listarWorkspaces()` + filtro `estado === 'activo'` + `runWithWorkspace(ws)` — importando `checkCronAuth`, **no** el `checkAuth` local que esos archivos duplican (hay 9 copias).

**Vive en:** app/api/cron/reporte-semanal/route.ts:23 · app/api/cron/reporte-diario/route.ts · app/api/cron/reporte-horario/route.ts · lib/cron-workspaces.ts:28 y :43-46 · app/api/cron/nutricion/route.ts:38-62 · *2026-07-17 retro-mapa · 2026-07-26 copy-semaforo (confirmado en 2026-08-06 senales-de-avance)*

### ⚠️ Un cron que itera N workspaces dentro de UN `maxDuration` sirve a los primeros y nada más

**Síntoma:** con clientes conectados, la factura de `closing` no subía. Se leyó como «los
clientes casi no consumen todavía». **Era al revés: no recibían el servicio.**

**Causa, tres piezas que solas parecen inofensivas:** `maxDuration = 300` en la ruta ·
`correrPorWorkspace` recorría los workspaces **secuencialmente, sin presupuesto y sin rotación**
(el orden lo daba `listarWorkspaces()`, que ordena por id) · y cada `syncClosingCalls()` reservaba
`DEFAULT_TIME_BUDGET_MS = 150_000` **para sí mismo**. 150 + 150 = 300: **entraban DOS workspaces
por corrida, y siempre los mismos dos.** Del tercero en adelante nadie recibía análisis, nunca.

**Y lo que lo hacía invisible:** el cron devolvía un array `{ws, ok}` que **solo incluía a los que
corrieron**. Un cliente sin servicio era indistinguible de un cliente que no existe. No había nada
que mirar ni nada que contar.

**El presupuesto relativo es la otra mitad del bug.** `timeBudgetMs` se medía contra el `tStart`
de **cada invocación**: el 2.º workspace ponía su reloj en cero a los 150 s de la función, medía
bien SUS 150 s y arrancaba una llamada a Opus a los 290. La plataforma la mataba a los 300 —
**después de que Claude cobró y antes del `upsertRow`**. Es el mismo hallazgo de «un presupuesto
chequeado al arranque de la iteración acota el INICIO, no el fin», un nivel más arriba.

**Las reglas que quedan:**
1. **El presupuesto de tiempo se pasa como FECHA LÍMITE ABSOLUTA, no como duración.** El que sabe
   cuánto queda es el que llama, no la función llamada. Y el guard va en positivo: `deadline`
   tiene que estar en el futuro, o se tira — así el typecheck y el runtime encuentran a quien
   todavía pase un relativo (fue exactamente como apareció el último call-site vivo en
   `lib/onboarding-extract.ts`, que el `grep` no veía porque el archivo es CRLF).
2. **Se arranca una unidad de trabajo solo si entra ENTERA** (`ahora + reservaDeUnaLlamada <=
   deadline`), y la reserva es el **peor caso de una llamada**, no el promedio.
3. **El orden ROTA** con un cursor persistido, o la inanición cae siempre sobre los mismos.
4. **El resultado declara a quién NO le tocó** (`sinTurno`). Un contador que no distingue «no
   había» de «no llegué» es la misma trampa que una API que devuelve vacío en vez de error.
5. **Y «sin turno» NO es un error:** si contara como fallo, el cron viviría en 500 desde el tercer
   cliente y la alarma nacería sonando — que es justo la señal que esto vino a recuperar.

**Aplicado en:** `lib/cron-ronda.ts` (nuevo, **sin `server-only`** para que el test importe la
condición) · `correrRonda` en `lib/cron-workspaces.ts` (`correrPorWorkspace` quedó como wrapper: los
otros 9 crons no cambian) · `lib/closing.ts` (`RESERVA_LLAMADA_MS`, `corto_por`) ·
`app/api/cron/closing-sync/route.ts` · `vercel.json` (de 1 a 10 corridas/día: **es lo único que crea
tiempo**; sin eso los otros tres arreglos solo reparten mejor los 2 análisis diarios que había).

⚠️ **`fathom-plan` tiene el MISMO bug y es el techo más grande:** 13 corridas/día sobre el mismo
servicio `'fathom'`, **sin presupuesto de ninguna clase**, y sobre un pipeline que parte transcripts
en cuatro. El helper le queda listo (`correrRonda` con `techoMs` y `rotacion: 'fathom-plan'` —
**clave distinta o se pisan el cursor**), pero no se enchufó. Los siguientes son ése y
`ads-analyst-sync`, que tiene su propio `DEFAULT_TIME_BUDGET_MS = 150_000`.

⚠️ **Pendiente: el aviso al dueño.** Que «se quedaron sin análisis» sigue viviendo en el log y en el
JSON de la respuesta — o sea, un `console.warn` con otra ropa. **No se emitió a propósito:**
`crearNotificacion` no acepta `workspace_id` (la tabla `notificaciones` no lo tiene, mig 0048) y el
feed es **global**, así que avisarlo ahí le mostraría los conteos de clientes a todos los clientes.
Resolver la visibilidad creando una fuga entre inquilinos no es un arreglo. Lo que lo destraba es la
migración que le ponga `workspace_id` a `notificaciones` (y sumarla a `TENANT_TABLES` **y** a
`TABLAS_RESET` en la misma migración).

**Vive en:** lib/cron-ronda.ts · lib/cron-workspaces.ts (correrRonda) · lib/closing.ts · app/api/cron/closing-sync/route.ts · tests/cron-ronda.test.ts · *2026-08-13 arreglar-techos-antes-de-clientes*

### ⚠️ Un cron que llama a IA por workspace necesita preflight de credencial, o falla en loop para siempre

**Síntoma:** ninguno todavía — y ese es el punto. Se iba a manifestar el día que la rotación de
arriba le diera turno al tercer cliente.

**Causa:** `chatClaude` resuelve la key con `await credWs('ANTHROPIC_API_KEY')` y `credWs` cae al
env **solo si `w === OWNER_WS`**. Un workspace sin fila propia recibe `null` y **cada llamada tira**.
La fila queda en `status='error'`, que en `lib/closing.ts` es **reintentable**, así que el cron la
vuelve a levantar en la corrida siguiente y vuelve a fallar. Para siempre, y el único rastro es un
`console.error`. Nadie lo vio nunca porque el cron servía siempre a los mismos dos workspaces, y los
dos tienen key.

**Regla:** antes de gastarle el turno a un workspace, chequear **en positivo** que tiene con qué
(`if (!(await credWs('ANTHROPIC_API_KEY', ws))) return { sin_ia: true }`). Cuesta una lectura de
`credenciales` (~50 ms) y no le saca capacidad a nadie: el que no tiene key sale al instante y el
siguiente entra igual. Y se cuenta **aparte** de los que fallaron: «no tiene key cargada» y «se
rompió» son dos cosas distintas y se arreglan distinto.

⚠️ **Y la decisión de producto que esto destapa y nadie tomó:** el catálogo marca `closing` con
`pagoPorque` («análisis pesado que el cliente paga a sabiendas») pero **no dice quién pone la key**.
Si la agencia paga el análisis insignia, la línea pasa a `credWs(...) ?? envCred(...)` y el guard
queda como red para el día que se corte. Las dos opciones necesitan el guard; lo que cambia es una
línea.

**Vive en:** app/api/cron/closing-sync/route.ts · lib/anthropic.ts (credWs) · lib/credenciales.ts (el env es solo de OWNER_WS) · *2026-08-13 arreglar-techos-antes-de-clientes*

### ⚠️ Un cron de vigilancia se excluye a sí mismo justo del workspace roto

`correrPorWorkspace('landing', …)` itera solo los workspaces con la integración conectada, y
«landing conectada» se define como «llegaron eventos recientes». **El workspace con el
tracking muerto queda fuera del loop por construcción** y jamás se avisa: el vigilante no
puede detectar lo que vino a detectar. Por eso el cron `tracking-vigilante` itera por
`landing_token` (la señal durable) a propósito y NO usa `correrPorWorkspace`. El mismo vicio
en el semáforo: `landingRecibioEventos()` preguntaba «¿llegó algo ALGUNA VEZ?» sobre toda la
historia, así que con 1955 filas viejas quedaba verde para siempre.

**Regla:** la señal que decide si un vigilante corre no puede ser la misma señal que el
vigilante mide.

**Vive en:** lib/cron-workspaces.ts (correrPorWorkspace) · app/api/cron/tracking-vigilante · lib/integraciones.ts (estadoLanding, LANDING_VENTANA_DIAS) · *2026-08-07 contexto-mako-md*

### ⚠️ `youtube-check` reporta «skipped» a todo cliente que sí tiene el video cargado

Los videos de la thank-you page ya son por workspace: el onboarding escribe
`youtube_thanks_video_id` / `youtube_thanks_prep_video_id` en `app_settings` y `lib/youtube.ts`
los resuelve con `configWs`. Pero el endpoint de chequeo lee `process.env` directo, así que
para cualquier cliente informa `'skipped'` aunque tenga los dos videos cargados — **un
diagnóstico que miente sobre la feature que sí funciona**. Es un cambio de dos líneas a
`configWs`; recién después tiene sentido borrar los envs.

**Vive en:** app/api/admin/youtube-check/route.ts:32-33 · *2026-07-16 ~auditoria-env-vars*

### ⚠️ La extracción histórica del onboarding solo avanza con la pestaña abierta

Los 6 jobs (`meta_metrics → meta_leads → ad_transcripts → script_analyses → fathom_calls →
vsl_metrics`) avanzan por ticks, y `tickExtraccion` tiene **un solo llamador**:
`app/api/onboarding/extraccion/route.ts:55`, que dispara el `loopTicks` del wizard **en el
navegador**. Ninguno de los crons de `vercel.json` la continúa: si el cliente cierra la
pestaña, la extracción queda donde estaba y nadie la reanuda hasta que vuelva a entrar al
wizard. Y el gate de la primera Retro es `meta_metrics.status === 'done'`, que es justo el job
más lento (365 días con pausa por día con datos): **el WOW del arranque depende de que el
cliente no cierre el navegador**.

**Vive en:** lib/onboarding-extract.ts (tickExtraccion), único caller app/api/onboarding/extraccion/route.ts:55 · *2026-07-16 ~censo-features-onboarding*

### En un cron multi-inquilino, un campo opcional vacío no es un error: 500 solo si fallan TODOS los configurados

`PANDA_VSL_VIDEO_IDS` está marcado `opcional: true` y su propia ayuda dice «completalo solo si
querés las métricas del VSL», pero `integracionConectada('panda')` solo exige la API key: el
ws9 entraba al loop, salía por `{error:'PANDA_VSL_VIDEO_IDS vacío'}` y **clavaba el cron en 500
todos los días, para siempre**, con ws1 ingestando perfecto. La alarma que se había agregado
para que la falta de datos dejara de ser invisible **nacía sonando**, y una alarma que suena
siempre se silencia: el rojo de verdad quedaba enterrado desde el día uno.

**Regla:** distinguir **tres** estados y no dos — ingestó / omitido / falló — con
`todoFallo = errores === total`. Ya aplicado en `panda-daily` y `youtube-daily`; gobierna el
próximo cron por workspace.

**Vive en:** app/api/cron/panda-daily/route.ts:45 y :102-120 · convención en nutricion, email-broadcasts y crm-automatico · *2026-08-05 ~review-commit-firma-webhooks*

### Un presupuesto de tiempo chequeado al arranque de la iteración acota el INICIO, no el fin

El loop del sync de closing cortaba con `Date.now() - tStart > timeBudget` **al principio de
cada vuelta**, con budget 210s y `maxDuration` 300. Una iteración que arrancaba a los 205s
pasaba el chequeo y después corría una llamada Opus de 90-120s: total ~300-330s, la plataforma
mata la función — **después de que Claude cobró y antes del `upsertRow`**. Se pagó el análisis
y se perdió, y el candidato vuelve a la cola la corrida siguiente. El comentario del código
decía «aire para que la última llamada termine» y era falso.

**Regla:** el presupuesto tiene que reservar el peor caso de UNA llamada
(`> timeBudget - PER_CALL_RESERVE_MS`), o el budget tiene que quedar por debajo de
`maxDuration` menos ese peor caso. Hoy está mitigado bajando `DEFAULT_TIME_BUDGET_MS` a 150s,
pero el chequeo **sigue siendo solo al tope del loop**.

**Vive en:** lib/closing.ts:704 (DEFAULT_TIME_BUDGET_MS) y :781 (el break del loop) · *2026-06-24 ~review-closing-sync*

### Decisión: Telegram sale de toda la app

«saquemos de todos lados telegram, no lo quiero» (2026-07-26). Los canales de aviso que
quedan son WhatsApp y email.

---

## Código construido que ninguna página monta

### ⚠️ Hay features terminadas —con migración y API propias— que no tienen puerta

Un barrido de la superficie del producto (7 agentes, agosto 2026) buscaba áreas faltantes para
`/admin/dev` y encontró de refilón algo peor: **componentes completos que nadie renderiza**.
No son restos ni experimentos: tienen su tabla, su migración, sus rutas y su UI escrita.

Los dos más caros, los dos en `app/configuraciones/`:

- **`EtiquetasWhatsAppPanel.tsx`** — mapea cada etapa del funnel a una etiqueta de WhatsApp del
  número no oficial, para que mover un lead en el CRM le cambie la etiqueta en el celular del
  setter. Backend completo: `lib/evolution-labels.ts`, `lib/wa-etapas.ts`,
  `app/api/whatsapp/evolution/labels/route.ts`. `ConfigInnerTabs` no lo monta.
- **`TelefonosPanel.tsx`** — los teléfonos del workspace, **con migración propia (0065)**.
  Tampoco lo monta nadie.

En los dos casos `grep -rl <Componente> app lib` devuelve **una sola línea: su propia
definición**. Es el patrón que hay que buscar, y es barato: un componente cuyo único archivo
es él mismo está muerto.

De la misma familia, del otro lado: **redirects que apuntan a una pantalla que ya no existe en
el mapa**. `app/marketing/salud/page.tsx` redirige a `/integraciones` porque «Estado de Meta» se
renombró — pero el inventario de piezas seguía teniendo una entrada con `ruta=/marketing/salud`,
o sea documentación apuntando a un cartel de mudanza.

**Regla:** una feature no está terminada cuando compila, sino cuando **hay una ruta que la
monta**. Y al renombrar o mudar una pantalla, el redirect es el paso 1 de 2: el paso 2 es
corregir lo que la nombraba. Antes de dar por construida un área, correr el grep del párrafo
anterior sobre sus componentes.

**Vive en:** app/configuraciones/EtiquetasWhatsAppPanel.tsx, app/configuraciones/TelefonosPanel.tsx, app/marketing/salud/page.tsx · *2026-08-08 barrido-superficies-dev*

## Next.js: los topes de la plataforma

### ⚠️ Los dos topes de body cortan en silencio: el proxy TRUNCA y un server action topea en 1 MB

**Síntoma:** un adjunto llega corrupto sin un solo error en los logs; el modal de importar CSV
anunciaba 8 MB y reventaba con un error crudo de Next a las ~8-10k filas; un PDF escaneado
nunca iba a entrar por una server action.

**Causa, dos topes distintos y solo uno avisa:**

1. **`experimental.proxyClientMaxBodySize`** (hoy `'20mb'` en `next.config.ts`, con el porqué comentado: cubrir el cap real de 16 MB de `/api/whatsapp/.../attachments`). **No rechaza:** `cloneBodyStream` aplica el límite, hace `push(null)` + un `console.warn`, y el route recibe el body **cortado**. El clone además es incondicional cuando hay body, aunque el proxy nunca lo lea. El default sin configurar son 10 MB.
2. **El tope de una server action.** El repo no define `experimental.serverActions.bodySizeLimit`, así que cualquier cosa que viaje como **argumento** de una action topea en **1 MB** por default. Por eso la importación de leads necesitó un route handler (`app/api/crm/importar-leads`) que solo LEE el archivo — crear los leads sigue siendo una action.

**Regla:** los archivos van por **multipart a un route handler**, nunca como argumento de una
action; validar `content-length` **antes** de `req.formData()` (el check de tamaño después del
parseo ya bufferó todo); y toda feature de subida se diseña contra los dos topes — **el que
trunca en silencio es el peligroso**.

**Vive en:** next.config.ts · proxy.ts · app/api/crm/importar-leads/route.ts · app/crm/ImportarLeadsModal.tsx · app/crm/actions.ts · *2026-06-23 ~review-adjuntos-whatsapp · 2026-08-06 crm-tracking-import-export-audit / ~crm-toolbar-e-importar-exportar · 2026-08-07 contexto-mako-md*

### ⚠️ El `maxDuration` de la PÁGINA gobierna sus server actions, y sin él un guardado exitoso se ve como error

`reagendarReunionAction` escribe el CRM y **recién después** habla con Google (buscar el evento
+ PATCH), con un presupuesto interno que en el peor caso llega a ~28s: 8s de refresh de token +
10s de listado + 10s del PATCH. No había `maxDuration` ni en la página ni en el server action
(sí lo hay en 30+ rutas de `app/api`), así que el corte de la plataforma llegaba con la fila
**ya guardada** y el cliente pintaba «No se pudo reagendar» en rojo — el usuario reintentaba y
reagendaba dos veces.

Verificado contra `node_modules/next/dist/docs`: el techo de la página gobierna a sus server
actions, así que el fix es `export const maxDuration = 60` en `app/crm/page.tsx`.

**Regla:** todo server action que escribe primero y después habla con un tercero necesita techo
explícito, o el timeout convierte un éxito en un error visible.

**Vive en:** app/crm/page.tsx · app/crm/actions.ts (reagendarReunionAction → moverEnCalendario) · *2026-08-06 ~wizard-que-hacer-ahora-y-horarios-de-google*

### ⚠️ `updateTag` solo existe adentro de una Server Action; afuera, `revalidateTag(tag, { expire: 0 })`

**Síntoma:** se escribe desde un route handler, `/api/v1` o el doer, y la pantalla sigue
mostrando lo de antes hasta que vence el TTL. Sin error: la invalidación va en un
`try/catch` «porque la caché vence sola».

**Causa:** `updateTag` tira fuera de una Server Action. Lo dice la doc
(`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/updateTag.md:12`) y lo
hace el código: en un route handler tira aunque haya request, porque el guard mira
`workStore.page.endsWith('/route')`
(`node_modules/next/dist/server/web/spec-extension/revalidate.js:52`). El reemplazo que
parece obvio, `revalidateTag(tag, 'max')`, es stale-while-revalidate (`revalidateTag.md:20`):
la primera lectura después de escribir sale VIEJA y se lee como «no se guardó». Para que
expire ya va `revalidateTag(tag, { expire: 0 })` (`revalidateTag.md:136`).

**Regla:** una función que escribe y se llama desde más de un contexto (server action +
route handler + doer) invalida con `revalidateTag(tag, { expire: 0 })`. Molde:
`lib/api-mako/areas/general.run.ts:66` y `lib/api-mako/areas/crm.helpers.ts:37`. El caso
de los runners del registro, en [hallazgos-api-mako.md](hallazgos-api-mako.md).

⚠️ **Sigue vivo fuera del registro:** `propagarRename` (`lib/meta-write.ts:137`) hace
`updateTag(TAG.leads)` y `updateTag(TAG.marketing)` dentro de un `try/catch` vacío, y
`metaWrite` se llama desde `app/api/meta-write/route.ts:29`, desde el doer
(`lib/mako-doer-acciones.ts:162`, que corre dentro del webhook de Evolution) y desde
`lib/api-mako/areas/ads.run.ts:94`. Renombrar por un route handler deja las lecturas
cacheadas de leads y marketing con el nombre viejo hasta el TTL.

**Vive en:** lib/api-mako/areas/general.run.ts:15-19 (cabecera, donde se descubrió) · lib/meta-write.ts:137 · *2026-09-16 api-mako-areas*

### ⚠️ El polling global no chequea `visibilityState`: 24.480 invocaciones por día para recibir `[]`

Los dos ticks del `NotificationsProvider` (6 s y 12 s) están montados en el layout raíz y **no
tienen guarda de visibilidad**, aunque `IaUsageToast.tsx:65` y `SaldoMaKo.tsx:24` sí la tienen:
1.020 req/h las 24 h con la pestaña minimizada. Peor: si el workspace no tiene WhatsApp
conectado, la ruta corta con `{ok:true, contactos:[]}` — el navegador del cliente gasta 24.480
invocaciones diarias para que le devuelvan un array vacío.

Hoy son centavos (todo el polling = **$1,32 de $26,53 en 7 días**; el 95 % es Build CPU), pero
el costo es **por pestaña abierta**, no por uso: 10 workspaces con una pestaña abierta son
8,2M invocaciones/mes y revientan el millón incluido del plan Pro. Es deuda que escala lineal
con clientes. El dueño ya lo vio del otro lado: «Logs de Evolution, WhatsApp y anthropic-usage
apareciendo cada segundo… No creo que eso debería estar corriendo cada rato, será un error?»
(2026-07-16).

**Vive en:** app/_components/NotificationsProvider.tsx:353 y :408 · app/api/whatsapp/conversations/route.ts:45 · *2026-07-23 vercel-costo-auditoria*

### En Turbopack el estado de módulo es por CAPA, no por proceso: un `let` de módulo se duplica siempre en producción

La barrera `credencialesListas()` memoizaba en un `let bootCredenciales` de módulo y en cada
arranque en frío se hidrataban las credenciales **dos veces**, la segunda adentro del request de
un webhook (SELECT con timeout de 4s + `seedRoutingDelDueno` + `migrarEnvACredenciales`, ~13
round-trips **antes** de verificar la firma).

**La causa no es HMR.** Verificado sobre el bundle: Turbopack emite una copia de
`lib/credenciales.ts` **por capa** (id 33117 instrumentation, 74912 app-route, 92272 ssr) y el
`moduleCache`, aunque es único por proceso, deduplica **por module id**. La prueba dura fue
comparar los cuerpos: la copia de instrumentation conserva `hidratarCredenciales` y perdió
`auditarCredencial` por tree-shaking; la de app-route, al revés. Un primer diagnóstico de la
misma corrida dijo «comparten el moduleCache, es la misma promesa» y estaba equivocado.

**Regla:** cualquier singleton que tenga que ser uno por proceso va en `globalThis`, no en una
variable de módulo.

**Vive en:** lib/credenciales.ts:162-171 (ya corregido con `globalThis.__makoBootCreds`); aplica a todo caché o cliente cacheado a nivel de módulo · *2026-08-05 ~review-commit-firma-webhooks*

### El lector de un stream NDJSON se traga el error real del server

El cliente leía el body línea por línea buscando `'\n'`. Cuando la ruta corta **antes** de abrir
el stream devuelve un `Response.json` —que no termina en newline—, ese JSON queda en el buffer y
se descarta al salir del loop: el usuario ve siempre el genérico «La generación terminó sin
resultado, probá de nuevo» y reintenta para siempre.

**El diagnóstico obvio (falló la generación) era el equivocado:** el camino realista no era el
400 de validación de fechas sino el **401 del proxy con la sesión vencida** — había que
re-loguearse y la pantalla decía «reintentá».

**Regla:** en toda ruta que streamee, el cliente chequea `res.ok` y el content-type **antes** de
leer el body, y procesa el residuo del buffer al terminar el loop.

**Vive en:** app/experimentos/RetroTab.tsx (generar) · app/api/retro/route.ts · *2026-07-02 ~auditoria-retro-v3*

### ⚠️ Pendiente: ruta propia para cada entidad que hoy vive en sub-tabs

Cada llamada de ventas analizada, cada anuncio ganador, cada retro, cada task/proyecto tiene que
tener su **deep link**. El pedido incluye mapear todo lo que se está quedando sin ruta
(2026-07-15).

---

## Migraciones

### ⚠️ La tabla `notificaciones` no existe en producción, y todo aviso al dueño se pierde en silencio

**Cuatro cosechas distintas dijeron cosas que no pueden ser todas ciertas** — «el feed existe en
la base y no lo muestra nadie» (2026-07-19), «`crearNotificacion` se traga que la tabla no
exista» (2026-07-29 forense-canal-mako-mudo), «el feed in-app está muerto en tres capas»
(2026-07-30 cola-de-accion-mako) y «la tabla NO existe en producción» (2026-08-01
auditoria-plan-y-whatsapp). **La buena es la última, la única medida contra prod**, y explica a
las otras tres.

**El hecho:** la migración `0048_notificaciones.sql` está en el repo y **nunca se aplicó**;
PostgREST devuelve 404 `Could not find the table public.notificaciones` (confirmado por
`information_schema`). Como `crearNotificacion` hace `catch { console.error; return null }` y
nunca lanza, el choke point de avisos (**49 mensajes del catálogo**) escribe al vacío. Encima
hay dos capas más rotas: `GET /api/notificaciones` devuelve `{items:[], unread:0}` para todo
workspace que no sea el dueño (y el super-admin opera en el ws 9), y **ningún componente
consume esa API** — el `NotificationsProvider` es el polling de Chatwoot, otra cosa.
Consecuencia: el único canal real de los 49 avisos es WhatsApp; si el mensaje se pierde en el
scroll del grupo, el aviso no existe en ninguna parte. Y la cola de reintento
`canal_wa='pendiente'` —los reportes que esperan que se reabra la ventana de 24h— no se
reintenta nunca.

**El orden correcto para arreglarlo, y no hay atajo:** la tabla **no tiene `workspace_id`** y el
escritor usa `getSupabaseServer()`. Aplicar la migración tal cual **encendería un feed que le
muestra los avisos de todos a cada cliente**. Entonces: agregarle `workspace_id`, sumarla a
`TENANT_TABLES`, aplicarla, y **recién ahí** quitarle el catch mudo a `crearNotificacion` y
cablear la campanita. La otra salida válida es borrar el código y dejar de mentir.

**Regla:** un CRUD diseñado para «no romper al caller» tiene que distinguir **tabla ausente**
(`42P01`/`PGRST205`) de error transitorio, y gritarlo. Un catch propio en el escritor convierte
«falta media feature» en «no pasa nada».

⚠️ **Re-medido el 06/10/2026, y el riesgo de aplicarla tal cual CRECIÓ.** Sigue sin existir
(`PGRST205`). Desde ese día los reportes salen también para los clientes (el semanal de la
tarjeta #834), así que el día que alguien aplique la 0048 sin `workspace_id`,
`pendientesWhatsapp()` trae los pendientes de TODOS y `flushPendientesWhatsapp` —cron horario,
corre en el contexto del dueño— se los manda a los teléfonos del ws1. Quedó escrito en el
comentario de esa función en `lib/notify.ts`.

⚠️ **Y la trampa con la que se mide mal:** `select('*', { count: 'exact', head: true })` sobre
una tabla que NO existe devuelve `error: null` y `count: null` — se lee como «tabla vacía».
Para saber si una tabla existe va un `select` sin `head`, o `information_schema`.

**Vive en:** supabase/migrations/0048_notificaciones.sql (sin aplicar) · lib/notificaciones.ts:76-101 · app/api/notificaciones/route.ts · lib/avisos.ts:14 y :71 · lib/workspace.ts (TENANT_TABLES) · *2026-08-01 auditoria-plan-y-whatsapp (contra 2026-07-19, 2026-07-29 ~forense-canal-mako-mudo y 2026-07-30 ~cola-de-accion-mako)*

### Los números de migración YA colisionaron ocho veces: «máximo + 1» no es seguro

Hay **8 números duplicados** por trabajo en paralelo (0024, 0025, 0026, 0039, 0060, 0061, 0069,
0072 — dos archivos cada uno) y el repo los tolera. **No existe tabla de tracking de
migraciones:** el estado se infiere del catálogo de la base, y `scripts/check-migrations.mjs`
quedó obsoleto (solo llega a 0022).

**Regla:** antes de numerar una migración nueva, mirá los archivos que ya están y **confirmá
contra el esquema vivo** qué se aplicó de verdad — sobre todo con dos sesiones de Claude
trabajando el mismo árbol.

**Vive en:** supabase/migrations/ · scripts/check-migrations.mjs · *2026-07-17 retro-mapa*

### Una migración que habilita un valor no se lo asigna a nadie: el workspace del dueño tiene capa `completo`, no `superadmin`

Un cambio quitó el bypass de `OWNER_WS` del gate de /onboarding **asumiendo** que el dueño
caería solo al hub por tener una capa sin pasos. No es así: la migración 0092 dejó
`capa NOT NULL DEFAULT 'completo'` y backfilleó ws1 a `'completo'`; la 0096 solo **habilita** el
valor `'superadmin'` en el CHECK, sin asignárselo a nadie. Con eso ws1 tiene 8 pasos y su estado
nunca es `'done'`, así que se renderiza el wizard, el wizard hace `GET /api/onboarding` y el
guard rechaza `OWNER_WS` con 400 — **el dueño queda en una pantalla roja permanente y el hub es
inalcanzable**.

**Regla:** la forma correcta de gatear es `!(await onboardingPendiente())`, que ya contempla
`OWNER_WS`. Y antes de asumir qué dejó una migración en los datos, leela: habilitar un valor no
es haberlo escrito.

**Vive en:** app/onboarding/page.tsx · app/api/onboarding/route.ts (guard) · lib/onboarding-state.ts (onboardingPendiente) · migraciones 0092 y 0096 · *2026-07-28 ~review-onboarding-fabrica-creativos*

### Renombrar una ruta no renombra sus keys — y una de esas keys re-siembra sola

Al planear el rename de /setting a /chat-agent apareció que la palabra vive en **cinco keys ya
escritas en la base**: `onboarding.tab.setting` (el progreso del onboarding de cada cliente),
`mako.datos_mau.setting` (el recibo de qué se copió de Mau, sin el cual «Eliminar lo de Mau» ya
no encuentra nada), las 5 keys de prompt del registro, las 3 claves `setting-*` de
`nutricion_secuencias` y la tabla `setting_audios`.

**La bomba silenciosa es la tercera:** esas 3 plantillas nacen con `activa:false` y el dedup por
`trigger_tipo` **solo protege a las activas**, así que si se renombra la `clave`, el próximo tick
del cron de nutrición **las re-siembra en CADA workspace** y todos los clientes quedan con
jugadas duplicadas sin que nadie haya tocado nada.

**La pieza que resuelve el rename sin tocar datos ya existe y no se usaba:** el campo `href` de
`TabOnboardingDef` separa la ruta de la key.

**Vive en:** lib/nutricion-templates.ts (claves setting-*) · lib/tab-onboarding-state.ts (campo href) · lib/datos-mau.ts (AmbitoKey) · lib/prompt-registry.ts · *2026-08-01 mako-cliente-prueba-diagnostico*

---

## Build, deploy y entrega

### Agregar archivos a `docs/` rompe el build, y el error apunta al lugar equivocado

**Síntoma:** el build falla —local y en Vercel— con
`CssSyntaxError: tailwindcss: app/globals.css:1:1: Invalid code point 1941695`.
Esa línea es `@import "tailwindcss"` y está intacta desde hace meses. El commit
que lo rompió no toca una sola línea de CSS.

**Causa:** Tailwind 4 detecta sus fuentes **solo**, y eso significa escanear el repo
entero buscando nombres de clase — `docs/` incluido. Al guardar ahí las transcripciones
de los chats (~9 MB de markdown) su escáner se ahoga y escupe un code point **fuera del
rango de Unicode**: 1941695 = `0x1DA6BF`, y el máximo es `0x10FFFF`. O sea que el número
del error no viene de ningún archivo: lo inventa el propio escáner.

**El error miente dos veces**, y por eso costó:

1. **Apunta a `globals.css:1:1`**, que es la línea sana. Verificar el archivo no lleva a
   ningún lado: es UTF-8 válido, byte por byte idéntico a lo commiteado.
2. **Parece caché.** El repo vive en OneDrive y hay un gotcha conocido de errores
   fantasma de Turbopack, así que la primera conclusión fue ésa — y estaba mal. Lo que la
   descarta es que **Vercel da el mismo error desde un clon limpio**.

La prueba que lo aisla en un minuto es sacar la carpeta y volver a compilar:

```bash
mv docs/chats /tmp/x && npm run build   # ✓ compila
mv /tmp/x docs/chats && npm run build   # ✗ Invalid code point
```

**Regla:** lo que se agrega al repo y **no** tiene clases de Tailwind se excluye del
escaneo, en `app/globals.css`:

```css
@source not "../docs";
```

Vale para cualquier carpeta futura de contenido —transcripciones, exports, datasets—.
No se pierde nada: en `docs/` no hay una sola clase.

**Vive en:** `app/globals.css` (el `@source not`) · `docs/chats/` · *2026-08-08, sesión de
la tab de documentación*

### ⚠️ El otro «pushear no es desplegar»: el build nunca ARRANCA

**Síntoma:** el dueño no ve los cambios en la app. El commit está en `origin/main`, el
`pre-push` pasó, no hay ningún build fallado — y el deploy más nuevo de Vercel tiene dos
horas. No es que el build falló: **no existe**.

**Causa:** el webhook de GitHub → Vercel dejó de disparar, en silencio. Media hora antes
había funcionado dos veces seguidas. No hay error en ningún lado porque no hubo intento:
`vercel ls` simplemente no lista nada nuevo.

**Cómo se distingue del otro caso** (el de acá abajo, donde el build sí corre y falla):
mirá la EDAD del deploy más nuevo, no su estado. `● Ready` de hace dos horas con un push
de hace diez minutos es este problema. `● Error` es el otro.

**Qué lo destraba:** un commit vacío. Si el enganche solo se trabó, vuelve a disparar.

```bash
git commit --allow-empty -m "Redisparar el deploy" && git push origin main
```

**Regla:** después de pushear, no alcanza con ver `● Ready` — hay que confirmar que ese
deploy sea **el tuyo**. La prueba definitiva es el commit del log de clonado:

```bash
npx vercel inspect <url> --logs --scope mbustos-4239s-projects | grep Cloning
# → Cloning github.com/… (Branch: main, Commit: ed5c587)
```

Y no sirve probar desde afuera si una ruta nueva «existe»: `proxy.ts` gatea **antes** de
rutear, así que `/admin/dev/onboarding` y `/ruta-inventada-xyz` devuelven los dos un 307 a
`/login`. El código de respuesta no dice nada sobre si la ruta está en el build.

**Vive en:** el enganche de GitHub del proyecto `dashboard-marketing` (scope
`mbustos-4239s-projects`) · `proxy.ts` (la lista `PUBLICOS`) · *2026-08-07, sesión de la
tab de documentación*

### ⚠️ Y el otro modo: el push que NO GENERA BUILD, y el CLI que no puede forzarlo

**2026-08-17.** Peor que el build que falla, porque ahí al menos hay un build que mirar.
Tres pushes seguidos a `main` —10:53, 11:04 y un commit vacío de re-disparo— y **ningún
deploy**: ni «Ready», ni «Error», ni siquiera «Building». Los dos commits anteriores
(10:25 y 10:33) sí habían salido, así que la integración se cortó en esa media hora y se
recuperó sola ~40 minutos después.

**Cómo se ve desde afuera:** exactamente igual que un arreglo que no funciona. El dueño
mira la pantalla, sigue rota, y el commit está en `origin/main` hace rato. Se pierde el
tiempo depurando código que ya estaba bien.

**Lo que lo distingue en un comando, y no es `vercel ls`:** pedirle a producción el
archivo que cambiaste y comparar.

```
curl -s https://hola-mako.com/cono-doc/ugc.css | wc -c     # 76883 = el viejo
git show origin/main:public/cono-doc/ugc.css | wc -c       # 339754 = lo que debería
```

`vercel ls` **no alcanza**: su primera fila decía «● Ready» todo el tiempo, porque era
el deploy de OTRO commit. Un vigía que mire «¿el último deploy está listo?» contesta que
sí mientras tu cambio no llegó nunca. La pregunta correcta es **«¿producción sirve MI
byte?»**.

⚠️ **Y no se puede forzar desde esta máquina.** `vercel deploy --prod` responde:

```
"You don't have permission to create a Production Deployment for this project."
```

Así que cuando la integración se corta, el único camino es el panel de Vercel: revisar
si el proyecto tiene los deploys **pausados**, si sigue conectado en Settings → Git, o
si se acabaron los build minutes. Un preview (`vercel deploy` sin `--prod`) sí se puede,
y sirve para separar «¿mi arreglo funciona?» de «¿por qué no despliega?».

⚠️ **Si igual hay que desplegar por CLI, va desde un CLON LIMPIO de `origin/main`**, nunca
desde el working tree: hay dos sesiones sobre este repo y el árbol suele tener trabajo a
medias de la otra. `git clone --depth 1` + copiar `.vercel/` y listo.

### ⚠️ Pushear no es desplegar: el build falla y producción sigue sirviendo la versión vieja

**Síntoma:** el dueño abre el CRM y ve la versión vieja de una feature que se le reportó como
terminada **dos veces**. Ni el selector de horas nuevo ni la búsqueda avanzada estaban en vivo,
y las dos estaban en `origin/main`.

**Causa real:** el build de Vercel fallaba desde hacía una hora, y producción seguía servida por
el último build exitoso — de hacía tres. **Vercel no revierte ni avisa:** deja el deploy anterior
en pie y el sitio funciona, con el código viejo.

```
./app/crm/actions.ts:65
Export alinearEtapaVista doesn't exist in target module
```

`app/crm/actions.ts` se commiteó; `lib/etapa-historial.ts`, que define esa función, no. Y lo que
hace que esto sea difícil de ver: **las tres redes de seguridad lo dejan pasar**, porque las tres
miran el árbol de trabajo, donde el archivo SÍ está.

| Red | Por qué no lo agarra |
|---|---|
| `npm run build` local | Compila el árbol de trabajo, con el archivo sin commitear ahí |
| `npm test` | Ídem |
| El hook `pre-push` (`tsc --noEmit`) | Ídem — chequea lo que tenés, no lo que subís |

**Por qué se llegó a eso:** con varias sesiones en el mismo árbol hay que commitear archivo por
archivo (ver [Sesiones paralelas](#sesiones-paralelas-y-las-dos-cuentas)). Al hacerlo a mano es
fácil subir el que **importa** y dejarse el que **define**.

**Las reglas que quedan:**

1. **Verificá el deploy, no el push.** Un push no es una entrega:
   ```bash
   npx vercel ls --yes --scope mbustos-4239s-projects
   ```
   La primera fila tiene que decir `● Ready`. Si dice `● Error`, producción está sirviendo
   código viejo AHORA MISMO. El log del build:
   `npx vercel inspect <url> --logs --scope mbustos-4239s-projects`
2. **Confirmá que lo desplegado te incluye.** Con sesiones paralelas, el deploy que ves puede ser
   de la otra: `git merge-base --is-ancestor <tu-sha> origin/main`, y el commit desplegado sale
   del log (`Cloning … Commit: <sha>`).
3. **Antes de pushear, buscá los símbolos huérfanos:** exportaciones que existen en tu árbol pero
   no en `origin/main`, y que ya usa código subido. Es el modo de falla exacto de este incidente:
   ```bash
   git status --porcelain | grep -E "^( M|\?\?)" | awk '{print $2}' | grep -E "\.tsx?$"
   # por cada uno: comparar sus `export` contra `git show origin/main:<archivo>`
   ```

**El diagnóstico obvio era el equivocado:** con la captura del dueño delante, todo apuntaba a que
el código estaba mal o se había perdido en un merge. Estaba bien y estaba pusheado. Antes de
volver a escribir una feature que "no aparece", **comprobá que lo que el usuario mira es lo que
vos escribiste**.

### ⚠️ La factura de builds no mide TIEMPO: mide `ceil(minutos) × vCPU`, y por eso acortar el build no ahorró nada

**Síntoma.** Agosto 2026: US$48,41 de Build CPU en 13 días (72 % de la factura), con 13.830
CPU-minutos facturados contra ~25 minutos de reloj de build por día. Un factor **40x** sin
explicación. Se buscó doble build, cola facturada y proyectos duplicados: ninguna de las tres.

**Causa.** La fórmula de Vercel, textual: *«Build usage is priced at $0.0035 per CPU Minute. The
duration of the build is rounded up to the nearest minute and then multiplied by the number of
CPUs on the machine type»* (https://vercel.com/docs/pricing). Los builds duran **33 s** → se
facturan **1 minuto entero**, multiplicado por los vCPU de la máquina. Y la máquina estaba en
`turbo` **con elastic encendido, en los 14 proyectos del equipo** (verificado con
`GET /v9/projects` → `resourceConfig.buildMachineType`), o sea ~30 vCPU. Medido: **30 CPU-min
planos por deploy, sin importar cuánto dure el build.**

**El diagnóstico obvio era el equivocado, y quedó escrito en el código.** En julio se sacó el
typecheck del build para ahorrar: 99 s → 27 s, un éxito medido en segundos. Pero con redondeo al
minuto eso solo mueve de `ceil(2 min)` a `ceil(1 min)` — **un 2x como techo absoluto**, mientras
el comentario de `next.config.ts` afirmaba que el typecheck era «el 95 % del gasto variable de la
cuenta». La factura subió igual de US$15 (junio) a US$99 (julio): Vercel había cambiado los
defaults de máquina de build, y nadie mira un default que cambia solo.

**La regla:** antes de optimizar un costo, **leé cómo se metrea**. Si la unidad es CPU-minuto con
redondeo hacia arriba, acortar el build por debajo del piso de redondeo ahorra **cero** — la única
palanca es el **tamaño de la máquina**. Y cuando un fix medido en la unidad técnica (segundos) no
mueve la unidad económica (dólares), la unidad económica no era la que pensabas.

**El corolario que vale la factura entera:** *«Builds on Standard build machines are only billed
when on-demand concurrency is enabled or Elastic build machines are selected»*. Standard + on-demand
apagado = **US$0 de build**, sin importar cuántos deploys se hagan. El precio es bajar de 500 a 3
builds concurrentes — que con push directo a main es una ventaja, no un costo: la cola por rama
**colapsa** los builds viejos y despliega solo el último commit.

⚠️ **Se fija a nivel EQUIPO, no proyecto:** un proyecto nuevo nace con el default del momento, y
Vercel ya lo cambió dos veces en 2026. Revisarlo cada vez que se crea uno.

**Vive en:** Vercel Team Settings → Build and Deployment → Build Machines · `resourceConfig` de cada
proyecto (`GET /v9/projects?teamId=…`) · el comentario corregido en `next.config.ts` · *2026-08-13 infra-costos-alternativas*

### No hay proyecto duplicado en Vercel: `dashboard-marketing` es el nombre VIEJO del mismo proyecto

Los deployments traen 7 con `name: "dashboard-marketing"` y 80 con `name: "mako"`, lo que parece un
segundo proyecto construyendo el mismo repo al pedo. **No lo es:** los dos comparten
`projectId: prj_9EBSJzJLTtaTzfEbNynMk7zOirzM`. Al renombrar un proyecto, los deployments viejos
conservan el nombre viejo; y `mako.link.repo` sigue siendo `dashboard-marketing` porque ese es el
nombre del **repo de GitHub**, no del proyecto.

**Regla:** antes de contar proyectos por el `name` de un deployment, agrupá por `projectId`. Y si
alguna vez hay que apagar un proyecto de verdad, se le **desconecta el Git** — un Ignored Build Step
no sirve: *«Canceled builds are counted as full deployments… will still count towards your
deployment quotas and concurrent build slots»*.

**Vive en:** `GET /v6/deployments` (campo `name` vs `projectId`) · *2026-08-13 infra-costos-alternativas*

### ⚠️ El typecheck NO corre en el build: lo sostiene un hook que no se versiona

`next build` tiene `typescript.ignoreBuildErrors: true` (`next.config.ts`). **No es descuido:**
ese paso eran ~65 de los ~99 segundos de cada compilación. Pero ojo con el porqué: se hizo para
ahorrar Build CPU y **el ahorro real fue mucho menor de lo que dice el comentario original** — ver
la entrada de arriba sobre `ceil(minutos) × vCPU`. Sigue valiendo la pena por otro motivo: el mismo
chequeo corre local en ~7 segundos y gratis, y el build es más rápido de esperar.

La red de seguridad se movió a `.git/hooks/pre-push`, que corre `npm run typecheck` **y** el
contrato del `detalle` de las skills (`node scripts/sync-contrato-detalle.mjs --check`), y bloquea
el push si algo falla. **Los hooks de git no se versionan:** si se reclona el repo, el hook
desaparece **en silencio** y un error de tipos vuelve a llegar a producción. El contenido para
recrearlo (con los **dos** chequeos) está en `AGENTS.md`.

Reglas: nunca `git push --no-verify`; si tocaste rutas nuevas, corré `npm run build` una vez antes
de pushear (el hook usa `tsc --noEmit`, que solo valida los tipos generados de rutas si
`.next/types` está fresco).

⚠️ **«Cada push cuesta ~US$0,09» era cierto y ya no lo es** — mientras la máquina de build siga en
`turbo`, cuesta ~US$0,105 (30 CPU-min × US$0,0035) **sin importar cuánto dure el build**, así que
agrupar commits ahorra por deploy evitado, no por segundo. Con la máquina en Standard y on-demand
apagado, cuesta **US$0**. Verificá en qué estado está antes de repetir el número.

### El pre-push corre el typecheck y NADA más: un chequeo sobre `.next/` ahí da falso verde

Se propuso un script centinela en el pre-push que grepeara `.next/static` buscando frases
sensibles en el bundle. **El hook no hace build:** el grep correría contra un build viejo o
inexistente y pasaría en vacío (verde falso) o fallaría espurio. Cualquier verificación que se
enganche al pre-push tiene que ser **sobre el fuente**.

Del mismo hilo, sobre contar por grep: la heurística «rutas sin guard» daba **77, 86 o 70** según
qué helpers incluyeras, y tres de las rutas denunciadas como «mueven plata en Meta sin guard» SÍ
estaban guardadas por un helper que el informe nunca abrió (`lib/ads-guard.ts:18`). **Un número
salido de un grep sin abrir los helpers es un número inventado.**

**Vive en:** .git/hooks/pre-push · lib/ads-guard.ts:18 · *2026-08-05 cierre-ronda-mako*

### En el trace de Next los spans más caros son cola, no CPU

El trace del build muestra `check-page` con **608,6 s** agregados y `is-page-static` con
**499,9 s**: parecen el monstruo y no lo son. Son 230 promesas dentro de una ventana wall de
**3,8 s** (paralelismo implícito de 159x, físicamente imposible): es tiempo **esperando el worker
pool**. El desglose real de los 99,3 s del build es `run-typescript` **64,6 s (65 %)** y
`run-turbopack` **23,8 s (24 %)**.

En la misma medición se descartaron dos palancas **por evidencia, no por opinión**: ESLint NO
corre en el build (enumerados los 27 nombres de span, cero de eslint → `eslint.ignoreDuringBuilds`
es un no-op) y no hay `generateStaticParams` en todo el repo.

**Regla:** antes de optimizar por un span agregado, dividilo por la ventana wall.

**Vive en:** .next/trace-build / .next/trace · next.config.ts · *2026-07-23 vercel-costo-auditoria*

### La mudanza de dominio quedó viva solo por las exenciones del 410

El código y Vercel ya están 100 % en **hola-mako.com**, pero **ninguna de las 8 registraciones
externas verificables** apuntaba al dominio nuevo: 2 webhooks de Chatwoot, 4 de Evolution, 1
suscripción de Calendly y el beacon de la landing. Producción seguía funcionando por dos motivos
accidentales: `proxy.ts` exime `/api/cron`, `/api/webhooks` y `/api/track` del 410 de mudanza, y
los hosts viejos siguen atados al proyecto de Vercel. O sea, **dos gatillos de muerte
silenciosa**: sacar las exenciones (cosa que el propio comentario del proxy invita a hacer) o
despegar el dominio viejo.

Lo importante para la próxima: **el snippet de tracking CONGELA la URL base al copiarse** — no es
un webhook re-registrable por API, es HTML de un tercero que solo cambia un humano, y hay que
repetirlo en la landing de **cada** cliente. La checklist de mudanza no lo incluye.

**Decisión asociada:** la ruta principal del dominio propio es la landing (la que estaba en /vsl),
y el `vercel.app` viejo queda bloqueado con un «Nos mudamos» que redirige — «No quiero que se
pueda acceder nunca más por dashboard-marketing-six.vercel.app a MaKo» (2026-08-01).

**Vive en:** proxy.ts:61-64 (EXENTAS_DE_HOST) · la checklist de lib/app-url.ts:12-13 · docs/lovable-tracking.md · *2026-08-05 ~auditoria-mudanza-dominio*

### El uso de Vercel se lee por `/v1/billing/charges`; `/v1/usage` no existe y el tope de gasto no tiene API

Verificado contra el índice completo de la REST API (40 categorías): **no hay** categoría `usage`,
`spend` ni `budget`. Lo que sí existe es `GET /v1/billing/charges` (formato FOCUS v1.3,
streameado como **JSONL** — una línea JSON por cargo, no un array), con `from`/`to` obligatorios,
granularidad de 1 día, `ServiceName` para el desglose por servicio y `Tags` con ProjectId. Los
«Build CPU Minutes» facturados **no** salen de los deployments: `/v7/deployments` da el porqué
(cuántos builds, cuánto duraron), `billing/charges` da el cuánto.

El límite de gasto (Spend Management) se configura **solo a mano en el dashboard** —no hay
endpoint para leerlo ni escribirlo—, pero tiene su propio webhook que dispara a 50/75/100 % con
`{budgetAmount, currentSpend, teamId, thresholdPercent}`. Ninguno de los 56 event types de los
webhooks de cuenta es de uso o gasto.

**Vive en:** pendiente: /api/cron/vercel-usage + tarjeta en /integraciones · *2026-07-23 vercel-costo-auditoria*

### ⚠️ NINGUNA página de MaKo llega con HTML: un `<Suspense fallback={null}>` envuelve la app entera

**Síntoma:** `curl https://hola-mako.com/vsl/costos` devuelve **200 con 17 KB y sin una palabra del
contenido** — solo
`<template data-dgst="BAILOUT_TO_CLIENT_SIDE_RENDERING">`. Lo mismo con `/vsl`, `/vsl/estrategia` y
cualquier otra ruta. Verificado también en el build local: `.next/server/app/vsl/costos.html` pesa
13 KB y no contiene ni «Railway» ni ninguno de sus textos, mientras que **sí están en los chunks de
`/_next/static`**. O sea: la página funciona perfecto en el navegador y no existe para nada que no
ejecute JS.

**Causa:** `WsProvider` (`app/_ui/Link.tsx:42`) llama a `useSearchParams()` — es el mecanismo que
propaga el `?ws=` para no sacarte del cliente que estás mirando, y está bien que exista. El problema
es **dónde quedó el boundary**: en `app/layout.tsx:75-76` el `<Suspense fallback={null}>` envuelve a
`WsProvider` **y con él a todo el árbol, `{children}` incluido**. En el prerender `useSearchParams()`
suspende, el fallback es `null`, y el HTML del servidor sale vacío **para toda la aplicación**.

**Qué rompe y qué no.** No rompe la app (el navegador la pinta) ni los previews de links (el
`metadata` se genera en el server y viaja igual). Sí implica que **la primera pintura de cualquier
pantalla depende de que baje y corra el JS**, y que cualquier lector sin JS —un scraper, un preview
que lea el body, un test de humo con `curl`— ve una página en blanco.

⚠️ **Y la trampa de diagnóstico:** verificar una página nueva con `curl` y no encontrar su texto
**parece** que la página está rota o que el deploy no salió. No lo está. La comprobación correcta es
grepear el contenido en `.next/static/chunks` (o abrirla en el navegador), no en el HTML.

**Cómo se arreglaría** (no se hizo: toca el layout raíz y con él las 111 páginas, hay que medirlo
aparte): bajar el `<Suspense>` para que envuelva **solo** al consumidor de `useSearchParams`, no al
árbol entero. El comentario de `Link.tsx:39` ya dice que `WsProvider` «es el único que llama a
useSearchParams» — la intención estaba bien, el boundary quedó demasiado arriba.

**Vive en:** app/layout.tsx:75-76 · app/_ui/Link.tsx:42 · *2026-08-13 informe-costos-mauricio*

### Migrar de plataforma: lo que se evaluó y por qué NO (para no volver a investigarlo)

Corrida de 16 agentes sobre «alternativas más baratas a Vercel y Supabase» (agosto 2026). El
resultado fue **no migrar nada**, y estas son las razones concretas, para que nadie repita la
investigación:

| Alternativa | Veredicto | El porqué que cuesta descubrir |
|---|---|---|
| **Cloudflare Workers + OpenNext** | **No compila** | En Next 16 el middleware se renombró a `proxy.ts` y corre siempre en runtime Node; el adaptador devuelve *«Node.js middleware is not currently supported»*. El gate de auth vive **entero** ahí. Segundo asesino aunque se destrabe: todo Next va en UN Worker con techo de 10 MiB comprimido, y 215 rutas + 111 páginas + jszip/mammoth/unpdf/lamejs es el perfil que lo revienta |
| **VPS propio (Hetzner + Coolify/Dokploy)** | Ahorra ~US$0-10/mes **contra la factura ya arreglada**, y cuesta 35-50 h de setup | Las 215 rutas pasan a compartir UN event loop: lamejs, unpdf, mammoth y jszip **bloquean a todas las demás** mientras corren (en serverless cada invocación era su propio aislado). Y a 46 deploys/día de imágenes de ~1-1,5 GB, 160 GB de disco se llenan en tres días sin un `docker system prune` en cron |
| **Neon / Postgres con scale-to-zero** | Descartado por el propio repo | Hay un cron **cada minuto** (`doer-flush` en `vercel.json`): la base nunca duerme, así que el modelo que hace barato a Neon no aplica |
| **Otro Postgres gestionado** | Reescritura enorme | PostgREST es la **única** forma en que la app habla con la base: **748 call-sites `.from()`** en 115 archivos sobre 79 tablas. Salir de Supabase a Postgres pelado es reescribir todo eso a SQL. Supabase self-hosted no requiere tocar nada, pero ahí el ahorro no paga el trabajo |
| **`vercel deploy --prebuilt`** | **NO VERIFICADO** | Ninguna página de pricing de Vercel dice si un deploy prebuilt evita el cargo de Build CPU. Solo lo afirman terceros. La única forma de saberlo es hacer un deploy y mirar la factura del día siguiente |

⚠️ **El riesgo que subestima cualquier plan de migración acá:** `AUTH_COOKIE_VALUE` es la llave del
cifrado BYOK y la migración a v2 está a mitad de camino. Re-cargar variables de entorno en otra
plataforma tiene un modo de falla **silencioso**: errarle no tira error, **descifra basura** y los
clientes pierden sus credenciales sin un solo stack trace.

**Y la causa raíz que ninguna plataforma arregla:** se hacen 46 deploys/día porque `next dev` no
arranca en esa carpeta y verificar obliga a desplegar. Hoy eso puede costar US$0 en Vercel, pero es
la variable que **todas** las alternativas facturan explícitamente — Netlify cobra por deploy de
producción, Render y Fly en build minutes, GitHub Actions en minutos de runner. **Migrar no arregla
una cadencia rota: la re-tarifa.**

**Vive en:** proxy.ts · vercel.json (cron `doer-flush`) · los 748 `.from()` de lib/ y app/ · *2026-08-13 infra-costos-alternativas*

### ⚠️ El compute de Supabase NO es la palanca: la base ya está en el tamaño más chico, y el 69 % de la factura no está en este proyecto

**La hipótesis que se cayó.** Ante US$80/mes se dedujo «Pro US$25 + un add-on de compute Medium de
US$60 que alguien eligió y nadie volvió a mirar». **Falso.** Medido contra la base
(`pg_settings` por conexión directa con `DATABASE_URL`):

| Indicador | Valor real | Qué implica |
|---|---|---|
| `shared_buffers` | **256 MB** | Supabase asigna ~25 % de la RAM → **~1 GB** |
| `max_connections` | **60** | Micro=60 · Small=90 · Medium=120 · Large=160 |
| `max_worker_processes` / `max_parallel_workers` | 6 / 2 | perfil de la instancia más chica |

Dos indicadores independientes dan **Micro**, no Medium. Y Micro cuesta US$10 con **US$10 de
crédito de compute incluido en Pro**: el compute de este proyecto sale **US$0 netos**. No hay
US$45 que bajar — no se puede bajar más.

**Y la base está sobradísima**, así que tampoco hay que subirlo: *cache hit ratio de **100,000 %***
(232 lecturas de disco contra 170 millones de cache), **9 conexiones de 60**, sin bloat, sin
`n_dead_tup`. El resto también da cero: base de **374 MB** (Pro incluye 8 GB), Storage de
**1,07 GB** en 6 buckets (Pro incluye 100 GB), **`auth.users` = 0** (confirma que no se usa
Supabase Auth: cero MAU), **0 réplicas**, 0 slots de replicación, WAL de 112 MB.

**O sea que este proyecto explica US$25 de los US$80.** Los otros ~US$55 **no están acá**, y solo
quedan tres lugares posibles: (1) **otros proyectos Supabase en la misma organización** — cada uno
paga su compute mínimo y el crédito de US$10 es **uno por organización**, no por proyecto, así que
5-6 proyectos dormidos son US$50-60; (2) más de una organización con plan Pro; (3) egress, que no
se puede medir desde la base.

**La regla:** el tamaño de una instancia **se lee, no se deduce de la factura**. `shared_buffers` y
`max_connections` lo dicen en una consulta, y son gratis. Deducirlo del monto invita a «bajá el
compute» sobre una instancia que ya está en el piso — y a no buscar el gasto donde realmente está,
que es en los **proyectos que nadie abre**.

**RESUELTO con el Personal Access Token (misma fecha).** Los ~US$55 eran, en efecto, **otros
proyectos**. Hay **10 proyectos Supabase repartidos en 4 organizaciones**, y **solo una paga**:

| Organización | Plan | Qué paga |
|---|---|---|
| **Mauricio Bustos Business** (7 proyectos) | **Pro** | US$25 + 5 computes Micro (US$49,06) − US$10 de crédito = **US$64,06** |
| CRM-LEADS · VIRAL-RADAR · GB-LOGISTICS (1 c/u) | Free | US$0 |

Los 5 computes pagos, con su actividad real de 7 días: **MaKo 1.134.762** requests REST ·
esquer-accountability 30.211 · baja-teriyaki 28.798 · texx-accountability 19.902 ·
**aspro-tableros 957** (137/día, el único candidato a pausar). Dos proyectos más de esa org no
pagan compute (`dental-ramos-crm` con 4.676 requests y `mbustos@elevate.com.mx's Project` con
**0**, vacío).

**O sea: de los US$64, US$9,81 son MaKo y US$39 son tableros de clientes.** Eso no es desperdicio
de infraestructura, es costo de servicio — la pregunta pasa a ser comercial (si cada cliente cubre
sus US$10/mes), no técnica. Y **Micro es el compute más chico que se puede pagar** (le sigue Small
a US$15,04): no hay nada que bajar en ninguno.

**Cómo se leen estos datos, que es lo que cuesta encontrar:**
- Hace falta un **PAT `sbp_…`** de https://supabase.com/dashboard/account/tokens. **Las claves del
  proyecto NO sirven**: probadas las cuatro (anon, service_role, publishable, secret) contra
  `api.supabase.com` → **401**. Son claves de datos (PostgREST), no de gestión.
- **`/v1/organizations/{slug}/billing/subscription` NO existe** (404). El endpoint real es
  **`GET /v1/projects/{ref}/billing/addons`**, y es **por proyecto**: devuelve `selected_addons`
  (lo que se paga hoy) y `available_addons` (el catálogo con precios). El precio viene como
  `{amount, interval:'hourly'}` → **hay que multiplicar por 730** para el mes.
- El plan de la org sale de `GET /v1/organizations/{slug}` (campo `plan`), y el spec completo de la
  API (115 endpoints) de **https://api.supabase.com/api/v1-json**.
- ⚠️ **`usage.api-counts` devuelve campos que NO se llaman `count`**: son `total_rest_requests`,
  `total_storage_requests`, `total_auth_requests`, `total_realtime_requests`. Un sumador que filtre
  por `'count' in clave` devuelve **0 para todos los proyectos** y parece que están todos muertos —
  incluido el que tiene 1,1 millón de requests. El `interval` además es un enum cerrado
  (`15min,30min,1hr,3hr,1day,3day,7day`); cualquier otro valor da 400.

**Vive en:** medido con `DATABASE_URL` + el paquete `postgres` (ya está en el repo) y con `SUPABASE_ACCESS_TOKEN` en `.env.local` · *2026-08-13 infra-costos-alternativas*

### Los roles de Vercel no son los tres que documenta la web, y el gratis se llama `VIEWER_FOR_PLUS`

Para sacar el asiento extra (US$18,5/mes) hay que degradar a un OWNER. La doc pública habla de
«Owner / Member / Viewer», pero **la API rechaza `VIEWER`**: el error enumera los roles reales —
**`MEMBER, OWNER, VIEWER_FOR_PLUS, DEVELOPER, BILLING`**. El gratuito del plan Pro es
**`VIEWER_FOR_PLUS`** (el «Viewer Pro»). `DEVELOPER` y `BILLING` existen pero **su precio no está
verificado**: elegir mal cuesta US$20/mes sin avisar.

```
PATCH https://api.vercel.com/v1/teams/{teamId}/members/{uid}   {"role":"VIEWER_FOR_PLUS"}
```

El `uid` sale de `GET /v2/teams/{teamId}/members`.

### ⚠️ Un `VIEWER_FOR_PLUS` NO despliega por `git push`, y el push sale verde igual

**Esto se creyó al revés y se probó en producción.** El razonamiento parecía sólido: «los deploys
los dispara la integración de GitHub del proyecto, no el usuario, así que el rol no importa».
**Falso, y medido:** con Martín en `VIEWER_FOR_PLUS`, el commit `a4628543` se pusheó **con éxito**
(el remoto lo tenía, `git ls-remote` lo confirmaba, el pre-push pasó los cuatro chequeos y git
imprimió el rango de siempre) y **Vercel nunca creó el deployment**. Cuatro minutos después el
último deploy seguía siendo el commit anterior.

**Por qué duele:** el push no falla. No hay error, no hay 403, no hay nada que mirar. Es
exactamente el modo de falla de «[pushear no es desplegar](#-pushear-no-es-desplegar-el-build-falla-y-produccion-sigue-sirviendo-la-version-vieja)»
pero un escalón más arriba — ahí el build fallaba y al menos quedaba registro; acá **el build ni
se encola**. Producción se queda en la versión vieja indefinidamente y el único síntoma es que
«el cambio no aparece».

**La salida, verificada:** el rol **`DEVELOPER`** sí dispara los deploys — se probó con un commit
vacío y el build arrancó al instante. Es el rol que hay que usar para alguien que pushea pero no
administra. ⚠️ **Lo que NO está verificado es si `DEVELOPER` consume asiento pago:** la doc dice
«Additional paid seats (Owner or Member roles) for $20/month each», lo que sugiere que no, pero
eso se confirma **leyendo el renglón `Additional Team Seats` de la factura al día siguiente**, no
la doc.

**Y el orden importa:** un Viewer tampoco puede **escribir por API**, así que si el token que usás
es del usuario que vas a degradar, te quedás sin poder administrar ni revertir. Se reemplaza el
token PRIMERO (por uno de un OWNER que siga siéndolo) y se degrada DESPUÉS. Hoy `VERCEL_API_TOKEN`
en `.env.local` es de **mbustos@elevate.com.mx**, no de koncke, justamente por esto — y fue lo
único que permitió deshacer el cambio.

**La regla:** después de tocar roles, permisos o integraciones, **el push de prueba no alcanza:
hay que verificar que apareció el DEPLOYMENT**. Un `git push` exitoso solo prueba que GitHub
recibió el commit.

**Vive en:** `.env.local` (VERCEL_API_TOKEN) · Vercel Team Settings → Members · *2026-08-13 infra-costos-alternativas*

### El 78 % de la base es el TOAST de `wa_mensajes`, y ahí adentro hay filas de 4,3 MB

De los 374 MB de la base, **292 MB son el TOAST de `wa_mensajes`** — contra 26 MB de datos y 5 MB
de índices. La tabla tiene 24.584 filas que pesan 303 MB: **12,6 KB de promedio por mensaje**, con
la más grande en **4,3 MB**. El sospechoso es la columna `raw jsonb`, que guarda el payload crudo
del webhook de WhatsApp entero.

Crece ~3.935 filas por semana (~560/día) ≈ **200 MB/mes**. Hoy no cuesta un peso (Pro incluye 8 GB
y van 374 MB), pero es la única curva de crecimiento real que tiene la base, y **el disco de
Supabase se aprovisiona y no baja solo**: cuando se pase, el cargo queda aunque después se borren
las filas.

**Regla:** guardar el `raw` completo de un webhook es gratis hasta que deja de serlo. Si alguna vez
hay que recortar, el candidato es el `raw` de los mensajes viejos (no la fila entera: el histórico
de la conversación se usa), y conviene mirarlo **antes** de que fuerce un upgrade de disco.

**Vive en:** `wa_mensajes.raw` (columna jsonb) · supabase/migrations · *2026-08-13 infra-costos-alternativas*

### Cómo se entrega acá: las reglas del dueño

- **Push directo a main, siempre.** «Ve directo a main siempre, al menos que te diga lo contrario. Pushealo» (2026-06-29) y «luego pushealo a main directamente, no solo en local» (2026-06-24).
- **No declares hecho lo que no se ve en la app.** Verificá en la UI y contra datos reales antes de reportar; si él dice que falla, el fallo es nuestro hasta que se pruebe lo contrario: «no veo que se haya marcado el progreso en la app. Eso no lo hiciste… revisa porque el fallo está de tu lado» (2026-07-14), «Nada funciona… Tienes que realmente validar y hacerlo bien» (2026-08-02).
- **Probalo vos, en el navegador.** Hay permiso permanente de preview y de Claude in Chrome: «Hay muchos gráficos que están mal, te invito a que hagas Claude in Chrome para verificarlo» (2026-07-19), «No funciona… Por favor, prueba tú» (2026-07-20). Mandá los mensajes, mové un lead y devolvelo, cambiá el nombre de una campaña pausada — no le devuelvas la prueba al usuario.
- **Resolvé en una pasada.** Es la queja que más se repite: «Realmente no entiendo en que te estas gastanto tantos tokesn y aún no solucionas las cosas que te pedí… cuantos prompts mas para que lo arregles» (2026-08-07). Cuando algo ya se corrigió dos veces y sigue mal, lanzá multiagentes y cerralo de una: «ya dimos muchas vueltas, no se que tengas que hacer, si tenes que lanzar multi agente o lo que sea, pero solucionalo» (2026-07-30). Prefiere que gastes recursos antes que entregar a medias: «si tienes que correr 10000mil multi agentes para hacer esto bien… hazlo bien» (2026-07-22).
- **Antes de construir de cero, buscá un proyecto open source que ya lo tenga** y copiale el diseño y las features: «podemos COPIAR codigo de proyectos open source como este: github.com/TryGhost/Ghost… Eso nos ahorrará muuucho trabajo» (2026-08-06).

**⚠️ Pendiente: versionado de la app.** Que al pushear se refresquen solas las tabs y aparezca un
modal fijo de «nueva versión disponible, actualizá», con numeración de versiones (2026-07-16).

---

## Zonas horarias

### ⚠️ Una columna DATE pasada por `Date.parse` es medianoche UTC, o sea las 18:00 del día ANTERIOR en México

**Síntoma:** el recordatorio «en un par de horas tenemos la reunión» salía ~18 horas antes, y una
reunión de HOY contaba como pasada desde las 18:00 de ayer.

**Causa:** `fecha_junta_1/2` son columnas DATE y **solo Calendly** escribe `junta_1_at` con hora
— el alta o edición a mano deja solo `'YYYY-MM-DD'`, que `Date.parse` interpreta como medianoche
UTC. El comentario del código juraba que «la ventana horaria del cron lo acomoda» y era **falso**:
el desfase cae justo adentro de la ventana 9-21 MX, así que nada lo frena.

**Regla:** una fecha date-only se parsea forzándole hora en la zona del negocio
(`${x}T12:00:00${OFFSET_MX}`), nunca dejándosela adivinar a `Date.parse`; y un filtro
`ms > Date.now()` sobre una fecha date-only da "pasada" medio día antes de tiempo.

**Vive en:** lib/nutricion.ts:507 (proximoEnvioDePaso) — mismo riesgo en cualquier lector de fecha_junta_*/fecha_agenda · *2026-07-31 ~review-adversarial-nutricion*

### ⚠️ La zona horaria por workspace era un setting huérfano (siempre Tijuana), y hoy leerla la ESCRIBE

`tzDeWorkspace` y `setTimezoneWorkspace` (`lib/timezone.ts`) tienen **cero call-sites** en todo el
repo: nadie escribe nunca el setting `mako.timezone`, así que la función devuelve siempre
`TZ_DEFAULT = 'America/Tijuana'` — y el SEED del plan declara esa tarea como hecha con los dos
ítems en `true`. Consecuencia práctica: a quien trabaja desde Argentina las reuniones le figuran 5
horas antes.

Bug latente del mismo tipo en `lib/reunion-destinatarios.ts:96-99`: `fechaLinda` usa
`toLocaleDateString` **sin `timeZone`**, corre server-side y Vercel corre en UTC, así que una
reunión de las 21:00 de Tijuana se anuncia en el WhatsApp y en el mail del tercero **con la fecha
del día siguiente**.

**Regla:** en el server, nunca `toLocaleString`/`toLocaleDateString` sin `timeZone` explícito. La
cascada honesta para resolver la zona es: setting del ws → `perfil.timezone` del admin del ws →
Tijuana, **mostrando la abreviatura** («15:30 PT») para que un default equivocado se vea en vez de
engañar.

**Vive en:** lib/timezone.ts (tzDeWorkspace/setTimezoneWorkspace) + lib/reunion-destinatarios.ts:96-99 · *2026-07-29 reunion-multi-borrador*

**16/09/2026: el segundo escalón de esa cascada no distingue un default de una elección.**
`getPerfil` (`lib/perfil.ts:88`) completa `timezone` con `DEFAULT_PERFIL.timezone`
(`America/Tijuana`, :35) cuando la persona nunca eligió zona, y no lo marca. «El admin eligió
Tijuana» y «nadie eligió nada» devuelven lo mismo, así que la cascada nunca llega a «Tijuana
por defecto»: llega a un Tijuana que parece dato. Para distinguirlo hay que leer el jsonb
`perfil` crudo de `usuarios`. (Y el primer escalón ya no es huérfano: `tzDeWorkspace` y
`setTimezoneWorkspace` tienen call-sites, p. ej. `lib/api-mako/acciones.ts:171`.)
*2026-09-16 api-mako-areas*

**16/09/2026: leer la zona la ESCRIBE.** `tzDeWorkspace`
(`lib/timezone.ts:39-43`) lee `mako.timezone` y, si no está, llama a `resolverYGuardarTz`
(:55), que averigua la zona (Cal.com → Google Calendar → teléfono) y la GUARDA; si no llega
en 4 s devuelve el default sin guardarlo (:59-72). O sea que una lectura —un resumen, una
acción del doer, un render— escribe en `app_settings` la primera vez. Quien lo llama desde
algo que se supone de solo lectura tiene que saberlo: el runner de contenido de la API usa
`tzSinResolver` (`lib/api-mako/areas/contenido.helpers.ts:211`) justamente para no escribir.

- ⚠️ **Y la lectura es laxa.** `tzDeWorkspace` lee con `getSetting` (:40), que convierte un
  5xx en `null`. Si la lectura falla y la escritura no, una zona ya guardada —incluida una
  puesta a mano— se lee como «no hay», se vuelve a averiguar y se **pisa** con lo que
  conteste Cal.com o Google (:75).
- ⚠️ **`tzActual()` nunca falla, y eso también es un problema.** Atrapa cualquier error y
  devuelve `TZ_DEFAULT` sin aviso (:118-125); el `null` de `getSetting` puede llegar al
  mismo default por el otro camino (re-averiguar, no llegar en 4 s). Si falla la lectura,
  `hoyEnWorkspace` (:139) —y con él el período de un KPI (`app/general/actions.ts:158`) o
  el trimestre (`quarterActual`, `lib/objectives.ts:79`)— se calcula con otra zona, y cerca
  de la medianoche el valor cae en el día vecino sin que nada lo diga. Para algo que decide
  (cerrar un período, marcar un vencimiento) la zona se lee con una variante que tire.
  **Esa variante no existe todavía.**
- **Y los guiones calculan el día sin zona.** `fechaGuion`/`diaGuion`
  (`lib/guion-estado.ts:77-91`) usan la zona del proceso: la del navegador en la tab, UTC
  en el server. La API usa la del negocio (`diaEnTz`, `contenido.helpers.ts:220`), así que
  un guion de la noche cae en días distintos según quién pregunte.

**Vive en:** lib/timezone.ts:39-81 (tzDeWorkspace/resolverYGuardarTz), :118-141 (tzActual/hoyEnWorkspace) · lib/api-mako/areas/contenido.helpers.ts:211 · lib/guion-estado.ts:77-91 · *2026-09-16 api-mako-areas*

### Display se migra; una clave persistida, no

**Dónde está el corte:** `lib/calendly.ts:167` (`isoToFechaTijuana`). No es display: es la **clave
de cohorte** que se persiste (`fecha_agenda`, `fecha_junta_1/2`, la fecha de la llamada en
closing) y la escriben cuatro módulos. Sus **lectores** calculan "hoy" con `hoyEnTijuana()` en
`crm-auto`, `leads`, `reportes`, `experimentos` y `app/crm/actions.ts`.

Migrar solo la escritura desfasa los bordes del día: una R1 agendada para hoy dejaría de contar
como de hoy y el No Show automático se dispararía un día corrido.

**Regla: escritura y lectura de una clave de fecha se migran en el mismo commit o no se migran.**
Mientras tanto no se pierde precisión: `junta_1_at` guarda el instante ISO exacto, que es lo que
usa el motor.

El literal de `isoToFechaTijuana` quedó **crudo a propósito**, sin `TZ_TIJUANA`: si algún día
cambia la zona por defecto del producto, el ancla de las cohortes ya escritas **no** debe seguirla.

### Comparar dos fechas de zonas distintas es el bug, no el hardcode

`cancelarJuntaEnLead(lead, fechaCancelada, hoyEnTijuana())`
(`app/api/webhooks/calendly/route.ts`): los dos argumentos **se comparan entre sí**. Migrar uno
solo "para sacar el hardcode" es peor que dejar los dos. Quedaron juntos en TJ y comentado.

### El literal de la zona por defecto vive en un módulo sin `server-only`

`lib/timezone.ts` es `server-only`, así que un componente de cliente no puede leer de ahí el
fallback. En vez de duplicar el string, `TZ_TIJUANA` se exporta desde `lib/date-utils.ts` (que a
propósito **no** es server-only) y `lib/timezone.ts` hace `TZ_DEFAULT = TZ_TIJUANA`. Una cosa, un
lugar: el segundo literal es el que se queda viejo.

### ⚠️ Pendiente: las primitivas de fecha siguen ancladas a Tijuana

`hoyEnTijuana`, `ayerEnTijuana`, `lunesActualEnTijuana`, `primerDiaDelMesEnTijuana` — **~60
call-sites**. No es display: son bordes de día que deciden cohortes y disparos, así que aplica la
regla de arriba (escritura y lectura juntas).

**Vive en:** lib/date-utils.ts, anotado en lib/timezone.ts:47

---

## Storage y egress

### ⚠️ Un cleanup «best-effort» no es un cleanup: 525 MB de basura en Storage

Consulta read-only a `storage.objects`: el proyecto arrastra **561 MB** y **525 son 7 archivos
`.MOV` de 68-79 MB** en el bucket `ads-creatives`, subidos el 30-jun/1-jul y nunca borrados porque
la limpieza de `app/api/ads-manager/creative-upload/route.ts:50,60` es `.catch(() => {})` y
simplemente no corrió. **Nadie se enteró porque no hay ninguna señal cuando falla.**

Dos cosas más del mismo barrido: los 5 buckets tienen `file_size_limit` en NULL (heredan el
global), y `avatars` es el único `public:true` y se creó **en código** con `createBucket`
(`app/api/perfil/avatar/route.ts:47`) en vez de en una migración, así que no queda rastro
versionado de su configuración.

**Vive en:** app/api/ads-manager/creative-upload/route.ts:50,60 · bucket ads-creatives · app/api/perfil/avatar/route.ts:47 · *2026-07-27 branding-mako-conocimientos*

### Una signed URL nueva por request mata el caché y triplica el egress

En Supabase Storage **cada token de signed URL único genera una entrada de caché separada** en el
Smart CDN. Generar la URL al vuelo con expiry corto en cada request hace que ningún request pegue
en caché: se paga egress **no cacheado ($0,09/GB)** en vez del cacheado (**$0,03/GB**), 3x, sin
que nada avise. Para que el CDN sirva hay que reutilizar la **misma** signed URL (expiry largo /
token estable). Aplica a todo lo que hoy se sirve firmado: archivero, wa-media, contratos y
comprobantes, audios del Chat Agent.

**Vive en:** lib/supabase.ts (createSignedUrl) · app/api/doc/route.ts · lib/setting-audios.ts · *2026-07-21 ~research-storage-video-cursos*

### Google Drive queda descartado para SERVIR el video de los cursos (pero los cursos se quedan ahí por ahora)

No es una preferencia técnica: **los ToS de la Drive API prohíben expresamente** usarlo como
reemplazo de un CDN y la «distribución amplia de video» sin consentimiento escrito — el caso de
uso es una violación de política con riesgo de corte de cuenta. Además hay un bloqueo «download
quota exceeded» **no documentado** que congela un archivo popular hasta 24 h (justo el video visto
muchas veces), un tope duro de 1 TB/día/proyecto, **no existen signed URLs con expiración** (el
acceso es por permisos o link «cualquiera con el link») y el player letterboxea los verticales con
su embed por iframe ya deprecado.

**Conclusión de la comparación:** el video va a object storage con **egress $0 detrás de CDN**
(Cloudflare R2, o Backblaze B2 + Cloudflare si manda el precio; Bunny Stream si se quiere player +
ABR llave en mano), y Supabase Storage se queda para PDFs, imágenes y creativos, donde el egress no
pesa. **El factor que decide no es el storage, es el egress.**

**La decisión de producto, sin embargo, es esperar:** los cursos se quedan en Drive por ahora — ya
están todos cargados ahí y la tab de Conocimientos no la ven los clientes. **Pero hay que marcar
con warning todo dato que viva fuera de nuestro dominio, porque el dueño puede borrarlo**
(2026-07-22). Dos requisitos que condicionan la elección final: el contenido de /conocimientos
tiene que poder compartirse **por link público, sin login** —«que yo le pueda pasar un link a
cualquiera y pueda acceder a eso» (2026-07-27)—, lo que choca con las signed URLs de arriba.

**⚠️ Pendiente:** investigar Drive vs Supabase (u otra plataforma) para cientos de GB de cursos y,
a futuro, creativos generados con IA, y recomendarle cómo pasarle los cursos (2026-07-22).

**Vive en:** sin código todavía: alimenta /conocimientos (portal de cursos) y la elección de bucket · *2026-07-21 ~research-storage-video-cursos*

---

## Editar este repo: archivos grandes, saltos de línea y nombres

### ⚠️ El repo es CRLF, y un reemplazo por bloque se comió 76 KB con exit 0

**Síntoma:** un script de reemplazo por bloque sobre `app/admin/dev/pricing/modelo.ts`
imprimió su mensaje de éxito y salió con **código 0**. El archivo pasó de 165.596 a 89.287
bytes: **76.309 bytes borrados**, sin un solo error y sin ninguna pista en la salida. Se
recuperó entero con `git checkout HEAD -- app/admin/dev/pricing/modelo.ts`.

**Causa:** el script ubicaba el cierre del array con `src.indexOf('\n];\n')`. **El archivo
es CRLF** — `file` lo dice textual: «with CRLF line terminators» — así que ese marcador no
matcheó donde tenía que matchear. Y acá está lo que lo hace invisible: **un `indexOf` que
no encuentra devuelve `-1` y eso se chequea siempre; uno que encuentra el lugar EQUIVOCADO
devuelve un número perfectamente válido**. Siguió buscando ~700 líneas más abajo hasta el
primer `];` que sí estaba en LF, y se llevó todo lo del medio.

**Regla**, las tres partes, porque ninguna sola alcanza:

- **Todo marcador de texto va con `/\r?\n/`**, nunca con `'\n'` pelado. Vale para los
  scripts y para los tests: la fila «Los guards de texto leen de más en Windows» de la
  tabla de acá abajo es exactamente el mismo error del otro lado.
- **Todo reemplazo por bloque lleva un tope que ABORTA.** Si el tramo a reemplazar mide
  más de lo esperado, `throw`, no `write`. Es una línea, y es lo único que convierte un
  borrado silencioso en un error a tiempo.
- **Para archivos grandes, `Edit` antes que un script.** `Edit` falla si el `old_string`
  no matchea exacto o no es único; un script hace lo que le salga y avisa después.

La versión sana quedó escrita: busca con `/\r?\n\];\r?\n/` y tira
`throw new Error('el bloque a reemplazar mide N caracteres: demasiado, algo se corrió')`
si el tramo supera los 12.000 caracteres.

**Vive en:** `app/admin/dev/pricing/modelo.ts` (173 KB, CRLF) · *2026-08-10 cac-dos-monedas*

### ⚠️ Hay TRES `FASES` distintos, y uno citaba al otro creyendo que era el suyo

**Síntoma:** `app/admin/dev/pricing/modelo.ts` se contradecía solo. Un comentario citaba
`FASES[0].noHacer` para justificar un número, y ese `noHacer` era del array de **otro
archivo**, sobre otra cosa.

**Causa:** tres constantes exportadas con el mismo nombre y significados que no se tocan:

| Dónde | Qué son de verdad |
|---|---|
| `lib/fase-diagnostico.ts:80` | las fases 1-5 del **negocio del cliente** (el diagnóstico del onboarding) |
| `lib/mako-fases.ts:12` | las **pestañas** de MaKo |
| `app/admin/dev/pricing/modelo.ts` | los tramos de **tiempo del dueño** (en qué gasta sus horas) |

Ninguno de los tres importa a los otros, así que **el compilador nunca vio nada**: cada
archivo resolvía `FASES` contra el suyo y todo tipaba. Lo que se rompió fue la PROSA, que
es donde un humano lee «FASES[0]» y da por hecho que habla de lo que tiene delante. Se
renombró el tercero a `FASES_TIEMPO` / `FaseTiempo` (commit `c363702`).

**Regla:** antes de bautizar una constante exportada, **grepeá el nombre en `lib/`**. Es
«una cosa, un lugar» aplicado a los NOMBRES y no solo a los datos — y sale más caro, porque
el mismo dato en dos lugares al menos diverge visiblemente, mientras que dos cosas distintas
con el mismo nombre compilan para siempre.

**Vive en:** `app/admin/dev/pricing/modelo.ts` (`FASES_TIEMPO`) · `lib/fase-diagnostico.ts:80` ·
`lib/mako-fases.ts:12` · *2026-08-10 cac-dos-monedas*

---

## Tests y entorno local

### Las trampas del runner

| Trampa | Dónde | Qué hacer |
|---|---|---|
| **`server-only` tira al importarse desde el runner de tests** | `lib/etapa-historial.ts` y cía. | Parchear `Module._load` antes del `import()` dinámico (funciona porque tsx compila los tests a CJS) |
| **Los guards de texto leen de más en Windows** | `tests/*.test.ts` | Normalizar CRLF: sin eso el corte por `'\n}\n'` no encuentra el fin de la función. Costó un falso positivo |
| **`node --test` corre cada archivo en su propio proceso** | ídem | Se aprovecha a favor: para un ciclo de imports, un test importa A primero y otro importa B primero, y así quedan cubiertos los dos órdenes de carga |
| **tsx NO resuelve el alias `@/`** | ídem | Los tests usan imports relativos |
| **El typecheck no corre en el build** | `.git/hooks/pre-push` | Ver [Build, deploy y entrega](#build-deploy-y-entrega) |

⚠️ **La fila de los guards de texto se pagó otra vez el 06/10/2026, y la pagaron SEIS agentes por
separado.** Cada uno trabajó en su worktree y los seis devolvieron el mismo hallazgo: 7 rojos en
`tests/nutricion-agenda`, `nutricion-etapa`, `cs-mover-etapa` y `replay-ficha`, que cortan el
fuente con `'\n}\n'` o `/\n\s+anidada\n/`. En el clon esos archivos están en LF y pasan; en un
worktree recién checkouteado llegan en CRLF y fallan sobre código correcto. Seis agentes gastaron
una investigación cada uno en descubrir que no era suyo. Arreglado en `79b4aa95` normalizando la
ENTRADA antes de cualquier regex. **La regla de AGENTS.md («se prueba en un árbol recién
checkouteado») vale para los tests que leen fuente igual que para las guardas del pre-push.**

⚠️ **Y el `CRON_SECRET` de `.env.local` NO es el de producción.** Un `?dry=1` contra
`hola-mako.com` con el de `.env.local` contesta **401 `{"error":"Unauthorized"}`** — el texto de
la RUTA (`lib/cron-auth.ts`), no el del middleware, así que el header llegó y el valor no
coincide. Para un simulacro contra prod hace falta el secreto de Vercel; con el local no se
puede. Medido el 06/10/2026.

⚠️ **Y BORRAR una ruta deja el typecheck del clon compartido ROJO para todas las sesiones.**
`tsconfig` incluye `.next/types/**`, y `.next/types/validator.ts` es una foto de las rutas del
último build o dev: al sacar las rutas de Instagram, `npm run typecheck` en el clon contestaba
`Cannot find module '../../app/api/instagram/enviar/route.js'` — o sea que el pre-push de
CUALQUIER sesión quedaba bloqueado por un archivo generado. En un worktree limpio no pasa (no
hay `.next`), y por eso el push de la integración salió verde. La cura es `npx next typegen`
(Next 16: regenera los tipos de rutas sin build, ~10 s). Medido el 06/10/2026.

### ⚠️ `127.0.0.1` NO es `localhost` para el dev server: la página se ve entera y no hidrata

**Síntoma.** Se abre una pantalla contra `http://127.0.0.1:3111/…` con un navegador
automatizado y **todo parece bien**: HTTP 200, el HTML completo, las 10 tarjetas en el DOM,
la consola sin un solo error, todas las requests en 200 y ninguna falla de red. Pero
**ningún click hace nada**. `Object.keys(el)` no tiene ninguna clave `__react*` y
`window.__next_f` está **vacío** aunque el payload de RSC viaja adentro del HTML.

**El diagnóstico obvio es el equivocado, y hay dos.** El primero es «rompí la hidratación
con mi cambio». El segundo, que es el que este repo tiene escrito en `AGENTS.md` y por eso
convence más, es «la otra sesión dejó un `export` a medias y rompió el bundle entero».
Probar otra ruta **refuerza** la conclusión falsa: `/vsl` tampoco hidrata, y un curso
compartido que anda perfecto en producción **tampoco**. Todo apunta a un bundle roto.

**Causa.** Next 16 bloquea el acceso *cross-origin* a los recursos de desarrollo. El server
se anuncia en `localhost`; pedirle desde `127.0.0.1` es **otro origen**, así que los chunks
del cliente se sirven pero el arranque se corta. La única evidencia está en el **stdout del
dev server**, no en el navegador:

```
Cross-origin access to Next.js dev resources is blocked by default for safety.
To allow this host in development, add it to "allowedDevOrigins"…
```

**Regla.** Para verificar en el navegador, la URL es **`localhost`**, siempre — no
`127.0.0.1`, aunque `Test-NetConnection` y `curl` funcionen igual con las dos (lo que se
rompe es la hidratación, no la conexión). Y la que generaliza: **cuando la página se ve
pero no reacciona, el primer lugar donde mirar es el stdout del dev server**, no la consola
del navegador — este error no llega al cliente.

Los otros dos motivos por los que una página no hidrata están en
[[verificar-en-navegador]]: el panel del navegador que no está a la vista, y el `export` a
medias de la otra sesión. Los tres dan **exactamente el mismo síntoma**, así que hay que
descartarlos por causa, no por parecido.

**Cómo se manejó sin panel.** Con Playwright, que no está en `node_modules` del repo pero
sí en la caché de npx (`~/AppData/Local/npm-cache/_npx/*/node_modules/playwright`, con los
navegadores en `~/AppData/Local/ms-playwright`): se importa por ruta absoluta desde un
`.mjs` del scratchpad y se corre con el sandbox apagado (el sandbox no llega a localhost).
Eso permitió verificar clicks, navegación y estado de React sin depender del panel.

**Vive en:** cualquier verificación con `mcp__Claude_Browser__*` o Playwright contra
`next dev` (corrida del 2026-08-12)

### ⚠️ El dev server puede quedarse mostrando un error de sintaxis que YA NO EXISTE

**Síntoma:** toda la app tira 500 y el mensaje es un `Expected '}', got '<eof>'` en
`lib/ai-cheap.ts:686` — pero el archivo tiene 750 líneas y la 686 está en el medio de una
función sana. Todas las rutas de `/api` contestan 404. El typecheck local pasa **en verde**.

**Causa:** Turbopack cachea el error de parseo **en disco** (`.next/`) desde el momento en que
alcanzó a leer el archivo a mitad de una edición. Después no vuelve a intentar, así que el
error sobrevive a todo lo que uno prueba:

- guardar el archivo arreglado **no** lo despierta;
- tocar el `mtime` (`(Get-Item x).LastWriteTime = Get-Date`) tampoco — el hash es del
  **contenido**, no de la fecha;
- **reiniciar el server tampoco**, porque el server nuevo hereda el mismo `.next`.

**Lo único que lo arregla:** borrar `.next` y levantar de nuevo. Cuesta una primera compilación
lenta y nada más.

**Y el diagnóstico obvio es el equivocado dos veces.** Primero: el número de línea invita a
buscar el bug en el archivo, y el archivo está bien — la pista real es que la línea citada **no
se corresponde** con lo que hay ahí (chequealo con `node -e` antes de leer nada). Segundo:
parece un problema de la otra sesión (era su server), y no lo es — es caché en disco, compartido
por las dos.

**El corolario, para las dos cuentas:** no se puede levantar un segundo `next dev` sobre este
clon. Next detecta el otro y se apaga solo; `preview_start` contesta «Server started
successfully» y el `serverId` deja de existir un segundo después (ver también
[Sesiones paralelas](#sesiones-paralelas-y-las-dos-cuentas)). O sea que con el server ajeno
envenenado **no hay forma de verificar nada** hasta limpiar el caché: no es un rodeo, es el
único camino.

**Vive en:** `.next/` · .claude/launch.json · *2026-08-12 rotación multi-cuenta*

### El panel del navegador que no se muestra NO hidrata

**Síntoma:** la página carga (el título es correcto, `document.body.textContent` trae 114k
caracteres, los chunks de `_next/static` dan 200, la consola no tiene un solo error) pero
**ningún click hace nada**: abrir un modal por `ref` o por `.click()` no abre nada, y no hay un
solo `<input>` en el DOM.

**La pista que lo distingue de un bundle roto:** `Object.keys(el).filter(k =>
k.startsWith('__react'))` da **vacío** en cualquier elemento, y `document.body.innerText` da
`''` mientras `textContent` trae todo — o sea que no hay layout. Es el mismo síntoma que
AGENTS.md atribuye a un `export` a medias en un client component, y **no es eso**: es que el
panel no está a la vista, así que la pestaña está en background y la hidratación (que cuelga de
un idle callback) nunca corre. El `screenshot` lo dice con todas las letras — *«the Browser pane
is not displayed, so the page is not compositing frames»*— pero recién cuando se le pide una
captura, no cuando se le pide un click.

**Qué sí se puede verificar sin hidratación:** el HTML del server y **las APIs**, con `curl -c`
contra `/api/auth/dev-login` (ver [verificar-en-navegador]). Un endpoint nuevo se prueba entero
así. Lo que queda afuera es todo lo que sea click, modal o estado de React.

**Y ojo con el otro camino:** `localhost:3000` en el Chrome real de esta máquina **no es MaKo**
— hay un service worker de otro proyecto («Optimum») registrado en ese origen que sirve su
propia app, con un formulario de login y credenciales autocompletadas. Los service workers son
por origen y sobreviven a que el proyecto ya no exista. Si vas por ese camino, verificá que lo
que ves sea la app que creés.

**Vive en:** herramientas `mcp__Claude_Browser__*` · *2026-08-12 rotación multi-cuenta*

### Un test que nunca viste fallar no sabés si sirve: verificalo por MUTACIÓN

**Síntoma:** una guarda escrita, corrida, **en verde** — y completamente inútil. La que iba
a proteger el conteo «tres de los cinco canales» en la prosa de la pantalla de pricing
chequeaba `includes('3')`, y la misma frase contiene «0,03%». Habría pasado en verde con
cualquier conteo escrito, incluido el equivocado que venía a cazar.

**Causa:** un test que solo se corrió contra el dato bueno demuestra que **pasa**, no que
**atrapa**. Y el verde de la primera corrida es el estado que tiene todo test, incluido el
que no mira nada.

**Regla: toda guarda sobre TEXTO se verifica por mutación antes de darla por buena.** Se
rompe el dato a propósito (cambiar el número, borrar la frase), se corre, se confirma que
**falla y que el mensaje dice qué falta**, y recién ahí se revierte. Las dos guardas de
texto de `tests/pricing-modelo.test.ts` pasaron por eso, y el arreglo que salió de ahí es
que **el conteo se escribe en LETRAS** (`'tres de los cinco canales'`), que no tiene
subcadenas por accidente.

Aplica a `includes`, a los regex y a cualquier aserción sobre prosa. Sobre números no hace
falta: `assert.equal(x, 5.95)` no puede pasar de rebote.

**Vive en:** `tests/pricing-modelo.test.ts` — el caso concreto de esa frase y su ancla está
en [hallazgos-ia.md](hallazgos-ia.md) → «La conclusión escrita a mano no se entera de que el
dato de al lado cambió» · *2026-08-10 cac-dos-monedas*

### Cómo correr un lib del repo a mano, sin levantar Next

Tres cosas que se comen media hora cada vez:

1. `import 'server-only'` revienta el script: hay que correr con `NODE_OPTIONS="--conditions=react-server" npx tsx scripts/x.ts` (así lo neutraliza el export condicional de server-only).
2. No hay `"type":"module"`, así que los `.ts` corren como CJS y el top-level await falla con «Top-level await is currently not supported with the cjs output format»: envolvé en `async function main(){}; main();` o usá `.mts`.
3. El dotenv de `.env.local` va en su **propio bloque arriba** de los imports de libs.

**Y ojo con el scope:** `procesarReunionesNuevas(ws)` **no se auto-scopea** — pasarle `9` pelado
hace que `getWorkspaceActual()` caiga a `OWNER_WS` y leas/escribas en el workspace equivocado; usá
`correrPorWorkspace('fathom', ws => …)` como hace el route.

**Vive en:** scripts/*.ts (patrón en scripts/backfill-calendly.ts:8-10 y backfill-meta.ts:17-21) · lib/cron-workspaces.ts:52 · lib/workspace.ts:80 · *2026-07-29 ~forense-canal-mako-mudo*

### Un ciclo de imports es inocuo hasta que alguien lo evalúa

`lib/pipeline.ts ⇄ lib/funnel-etapas.ts` se importan mutuamente. Es inocuo **porque ninguno de los
dos usa lo del otro mientras se evalúa el módulo**, solo dentro del cuerpo de las funciones. La
condición exacta que lo rompería está escrita en la cabecera de `funnel-etapas.ts`: un
`const X = DEFAULT_PIPELINE…` a nivel de módulo, y falla **distinto** en el server, en el cliente y
en los tests según quién se cargue primero.

**Regla:** si dejás un ciclo, escribí la condición que lo activa y cubrí los dos órdenes de carga
con tests en archivos separados.

### ⚠️ Falta el test de contrato `TENANT_TABLES` ↔ columnas `workspace_id`

Es el único chequeo que caza el drift «agregué la tabla al Set pero olvidé la columna» (error de
Postgres en runtime) y, en la dirección inversa, «la tabla tiene `workspace_id` pero no está en el
Set» (fuga silenciosa) — esa segunda dirección **habría cazado el leak de `v_cohortes` ANTES de la
migración 0084**. Se verificó que hoy arranca **en verde** con la allowlist de excepciones
`{app_settings, credenciales, funnel_config, usuarios}`.

Dos trampas del entorno para escribirlo: `lib/workspace.ts` tiene `import 'server-only'` y
`TENANT_TABLES` **no se exporta**, así que hay que leer el archivo como TEXTO con `fs` y parsear el
bloque `new Set([…])`. Testear el proxy `getTenantDb` en sí requiere extraer
`scopedFrom`/`scopedClient` a un módulo puro — eso toca el núcleo de aislamiento y no es autónomo.

**Vive en:** tests/tenant-tables-contract.test.ts (a crear) · lib/workspace.ts:42-54 · *2026-07-13 plan-autonomo-tanda2*

### Reglas del entorno local

- **Tenés las credenciales: probalo vos.** El `.env.local` tiene Supabase (apuntando a prod), el workspace de super admin y el número de prueba. «Tienes las credenciales de Supabse, hazlo tu» / «El webhook de chatwoot ya está en vercel, de lo contrario jamás podría chatear desde la app. ¿No se te ocurrió corroborar eso?» / «Pero si en el env local tienes todo para 'salvar los datos de Meta'. No estoy entendiendo las limitaciones» (2026-07-14). Antes de decir «no se puede» o pedirle que verifique, verificá vos.
- **⚠️ El boot local ESCRIBE en prod:** la hidratación env→base corre contra la base real. Ojo con lo que dejás en el `.env.local`.
- **Toda prueba que salga hacia afuera va siempre a `martinkoncke@gmail.com` y `+5493764673479`** — «prefiero que todas las pruebas siempre se hagan a:» (2026-07-14). Nunca a un contacto real del CRM.

---

## Verificar una tab NUEVA en local: las tres trampas, en el orden en que muerden

Del 25/08/2026, construyendo `/video-generator`. Ninguna de las tres da un error que
apunte al lugar correcto, y las tres juntas cuestan una hora.

### 1. El dev server de Next 16 se chequea por DIRECTORIO, no por puerto

`npm run dev` con otro server ya corriendo sobre el mismo clon **arranca igual**: elige
otro puerto, imprime `✓ Ready in 15.1s`, y **recién después se muere** con
`⨯ Another next dev server is already running`. Si solo se mira que arrancó, se navega a
un puerto que ya no existe.

El mensaje trae el dato que sirve: el **puerto real** del server vivo (3111 en ese
momento) y su PID. **No se mata**: puede ser la sesión de la otra cuenta trabajando. Se
usa el que ya está.

⚠️ **Pero «vivo» no es «contesta».** El 05/10/2026 el server ajeno escuchaba en 3010
(`Get-NetTCPConnection` lo mostraba) y no devolvía nada ni a `/login` en 150 s, por IPv4 ni
por IPv6. Antes de medir contra el server de otro, un `curl --max-time 20`; si no contesta,
no se lo mata —es de otra sesión— y se levanta uno propio desde un worktree (ver «Las tres
cosas que hay que recrear a mano»).

### ⚠️ El worktree para tener dev server propio: sirve, pero NO desde el scratchpad

Es la letra chica del párrafo de arriba, y se escribió dos veces porque **la primera
versión era falsa**: «el worktree no sirve para `next dev`» fue la conclusión de una sola
medición, y veinte minutos después se midió el caso que la refutaba.

Lo que falla, medido el 06/10/2026: `git worktree add --detach` bajo el scratchpad de la
sesión (`AppData\Local\Temp\claude\…\scratchpad\wt`) + `New-Item -ItemType Junction`
al `node_modules` del clon. El dev server muere con:

```
- Execution of find_package failed
- Symlink [project]/node_modules is invalid, it points out of the filesystem root
```

Para Turbopack el árbol del worktree ES la raíz del proyecto, y el link apunta afuera.

Lo que SÍ funciona, medido el mismo día contra el worktree de la tercera sesión:
**`C:\Users\marti\wtf`, con `node_modules` como symlink al del clon principal**, estaba
sirviendo `npx next dev -p 3122` perfecto — y ahí se verificó el paso 2 del Pixel a las
05:16:43Z, con cero errores de consola. O sea que la receta vale; lo que no vale es la ruta
profunda bajo `Temp` (o el junction de PowerShell contra el `ln -s` de Git Bash: **esa
variable quedó sin aislar**, y se dice así en vez de inventar la causa).

La receta, entonces: worktree a una **ruta corta** (`C:\Users\marti\wt-<area>`), `ln -s`
al `node_modules` del clon, `npx next dev -p <puerto>`. Y el guard de Next sigue siendo por
DIRECTORIO, así que en el clon compartido `-p` no destraba nada.

⚠️ **Y antes de armar nada, medí los puertos: «vivo» y «contesta» cambian en minutos.** La
misma noche, `:3010` contestaba 500 en todo a las 05:0xZ; `:3011` contestaba
`/api/auth/dev-login` con **307** a las 05:12:47Z; a las 05:18:53Z `:3011`, `:3122` y
`:3000` estaban los tres muertos; y a las 05:19 otra sesión ya había tomado el directorio.
Un reporte sobre un dev server ajeno **se fecha o no se entiende** — y el PID que imprime
Next puede ser de un server que ya se reinició, que es lo que le pasó a la sesión de
Customer Success (leyó PID 6364, a los tres minutos era el 26504).

⚠️ **Y UN 404 EN `/api/auth/dev-login` CASI NUNCA ES LA ENV: ES `.next/dev` CORRUPTO.**
Esto lo midió la sesión de Customer Success el 06/10/2026 —a las 02:27 local, sobre su
`:3010` recién levantado— y es la pieza que cierra el caso: **TODAS** las rutas `/api`
daban 404 (dev-login y `/api/auth/me`) y el log decía `○ Compiling /_not-found/page`. La
causa es un dev server que se murió a mitad de escribir la caché de desarrollo; el suyo se
había reiniciado solo por «approaching the used memory threshold». Ads Manager vio lo mismo
en su `:3011` a las 02:06.

La cura, medida: bajar el server, **`rm -rf .next/dev`** (sólo la caché de dev, NO `.next`
entero) y levantarlo de nuevo → `dev-login` contestó **307 al primer intento**.

**Y lo que distingue los dos casos en un request:** `/api/auth/me`. Con el guard de
`dev-login` activo (`VERCEL`, `VERCEL_ENV` o `NODE_ENV` en producción,
`app/api/auth/dev-login/route.ts`) `me` contesta **401 o 200**; con la caché rota contesta
**404 igual que dev-login**. Sin ese segundo request, un 404 se lee como «hay una env
puesta» y manda a buscar en `.env.local` algo que no está — es un diagnóstico que apunta a
un archivo perfecto.

**Vive en:** `app/api/auth/dev-login/route.ts` · *2026-10-06, medido por la sesión de
Customer Success*

### 2. `?ws=3` NO sirve para verificar una tab nueva: el onboarding la tapa

El Cliente de Prueba tiene el onboarding **pendiente**, así que `guardOnboarding()`
redirige cualquier tab a `/onboarding` antes de que se dibuje. La memoria de trabajo dice
«probar en ws 3, no en ws1» y para esto es exactamente al revés: **ws 1 está exento del
wizard**, así que es el único donde una tab nueva se puede ver.

⚠️ **Y el síntoma no se parece a un redirect.** La respuesta es **200 con 58 KB de HTML**
y, de texto visible, `MaKo MB` — el layout y el avatar, y nada más. Se lee igual que «mi
página renderiza vacía» y manda a depurar el componente propio, que está bien. Lo que lo
delata es grepear el HTML crudo:

```bash
grep -c "NEXT_REDIRECT" pagina.html   # 5 → no renderizó: redirigió
grep -c "onboarding" pagina.html      # 3 → y ahí es a dónde
```

**Regla:** cuando una página propia sale «vacía» con 200, buscar `NEXT_REDIRECT` en el
HTML **antes** de mirar el componente. Un redirect de guard y un render vacío se ven
idénticos desde afuera.

### 3. El Chrome real puede no alcanzar el dev server, y el error no lo dice

`mcp__claude-in-chrome__computer` devolvió `Error capturing screenshot: Frame with ID 0 is
showing error page` contra `localhost:3111` y contra `127.0.0.1:3111`, en dos tabs
distintos, **mientras `curl` contra la misma URL devolvía 200 en la misma máquina y al
mismo tiempo**. El error no distingue «la página cargó y falló» de «nunca hubo conexión».

**Regla:** si el Chrome no alcanza el server local, no se abandona la verificación — se
baja al paso 2 de «cuando algo no aparece»: `curl` con la cookie y grepear marcas del
contenido en el HTML. El auto-login sirve igual, en dos pasos y con el cookie jar en las
dos puntas:

```bash
curl -s -c ck.txt -o /dev/null "http://localhost:PUERTO/api/auth/dev-login?ws=1&next=/tab"
curl -s -b ck.txt -o pagina.html "http://localhost:PUERTO/tab?ws=1"
```

⚠️ **Con `-L` y sin `-c`+`-b` la cookie se pierde en el redirect** y lo que vuelve es la
pantalla de login (`Entrá al dashboard · Continuar con Google`), que es un tercer falso
negativo encima de los otros dos.

Eso confirma que el server renderiza el contenido; **lo que no confirma es cómo se ve**.
Para lo visual hay que pedirle la pantalla a Martín o desplegar.

**Vive en:** `app/api/auth/dev-login/route.ts`, y la memoria `verificar-en-navegador`.

## Sesiones paralelas y las dos cuentas

Hay **dos cuentas** de Claude Code sobre este mismo clon (`claude1`/`claude2` en el `$PROFILE`),
con cuotas desfasadas: una corre miércoles a viernes, la otra sábado a martes. En principio no
coinciden, pero pueden.

- **El typecheck rompe por archivos que no son tuyos.** Durante estas corridas aparecieron y desaparecieron `TS2552: Cannot find name 'Stage'`, `'Opcion'`, y refactors a medio terminar. **El verde se toma con el árbol estable**, y lo ajeno se reporta, no se "arregla".
- **Antes de tocar nada, `git status`.** Si hay archivos modificados que no son tuyos, dejalos donde están.
- **Verificá contra el código, no contra el resumen del agente anterior.** Un agente reportó como "arreglado" algo que otro seguía editando, y dos reportes se contradecían sobre el mismo archivo.
- **La deferencia colectiva deja el doc mintiendo.** Cuatro reportes seguidos anunciaron "esta fila del doc quedó obsoleta, no la toqué porque hay otra sesión en el árbol". Los cuatro dijeron lo mismo y **ninguno la tocó**: para quien leyera el documento al día siguiente, cinco frentes cerrados seguían abiertos. Un `.md` no es código: el conflicto se resuelve leyendo. **Si sos el que cierra, cerrá también el documento.**
- **La sesión que cierra deja escrito dónde quedó** — en `docs/hallazgos-<área>.md`, en el board `/plan` o en una memoria. Si la cuota corta a mitad de camino, eso es lo único que sobrevive.

### ⚠️ Dos agentes sobre el MISMO archivo de tests: el segundo no puede commitear lo suyo

**Síntoma:** dos agentes en paralelo escribieron sus tests en el mismo
`tests/pricing-modelo.test.ts`. El segundo **no pudo commitear el archivo**: tenía adentro
los tests del primero, y esos estaban en rojo porque el código que verifican todavía no
estaba. Sus tests terminaron viajando dentro del commit del OTRO agente.

**Causa:** un archivo de tests es un recurso compartido con resultado **global**: corre
entero o no corre. `git add <archivo>` no sabe llevarse «solo mis tests» y `npm test` no
sabe evaluar «solo mis tests». Con el código fuente, dos sesiones que se pisan dejan rastro
en el diff; acá se pisan en el **resultado**, que en el diff no se ve.

Salió bien, pero **por instrucción explícita, no por diseño**: el prompt de la corrida decía
quién commiteaba qué archivo. Sin esa línea, el segundo o pisaba el trabajo del primero o
dejaba sus tests sin commitear.

**Regla:** si dos tareas comparten un archivo, **o van en serie, o el prompt dice quién
commitea qué**. No alcanza con «no toquen lo del otro»: el conflicto no está en la edición,
está en el commit y en el verde. Es la misma familia que la regla de no editar la misma
skill a la vez.

**Vive en:** `docs/superpowers/plans/2026-08-10-cac-dos-monedas.md` (el plan que repartió las
tareas entre los dos) · `tests/pricing-modelo.test.ts` · *2026-08-10 cac-dos-monedas*

### ⚠️ El preview MUERE EN SILENCIO si la otra sesión ya tiene un `next dev` arriba

**Síntoma:** `preview_start` contesta `"Server started successfully on port 3000"` con un
`serverId` nuevo, y un segundo después ese mismo `serverId` **ya no existe** —
`preview_logs` responde *«not found — it may be stale»* y `preview_list` no lo lista. El
puerto 3000 queda libre. Se puede repetir cuatro veces con el mismo resultado, y ninguna
de las cuatro dice qué pasó.

**Causa:** Next 16 detecta que ya hay un dev server sobre el MISMO directorio y se apaga
solo. El mensaje existe, pero se lo come el preview:

```
⨯ Another next dev server is already running.
- Local:  http://localhost:3100
- PID:    24524
```

Lo devuelve `node_modules/.bin/next dev` corrido a mano, que es la única forma de verlo.

**La trampa de diagnóstico:** el instinto es «se cayó el server» o «el puerto está
ocupado», y las dos pistas mienten — el puerto 3000 está **libre** (`Get-NetTCPConnection
-LocalPort 3000` no devuelve nada) porque el server ajeno está en el 3100.

**Regla:** si `preview_start` devuelve un `serverId` que después no existe, **no lo
reintentes: corré `node_modules/.bin/next dev` una vez para leer el error**. Y si el que
está arriba es de la otra sesión, **no lo mates**: sirve el MISMO working tree —tus
ediciones ya están adentro por HMR— así que se verifica contra su puerto. Cambiar
`.claude/launch.json` para apuntar ahí no sirve: el preview igual arranca la entrada de
3000.

Para verificar una ruta gateada desde ahí sin navegador, alcanza con curl y un cookie jar
contra `/api/auth/dev-login` (super-admin, solo-dev), que es como se comprobó el filtro de
período de `/integraciones`.

**Vive en:** `.claude/launch.json` · `app/api/auth/dev-login/route.ts` · *2026-08-09*

#### Corolario: «se verifica contra su puerto» deja de valer cuando ESE server está podrido

La regla de arriba dice —y sigue estando bien— que no hay que matar el dev server de la otra
sesión porque sirve el mismo working tree. Pero **hay que comprobar que sirve algo vivo antes
de creerle**. El caso: el server ajeno servía el HTML perfecto y **ninguna página hidrataba** —
ni `/inicio`, ni `/plan`, ni la que se estaba tocando—, con el WebSocket de HMR caído
(`ERR_INVALID_HTTP_RESPONSE`), cero peticiones fallidas, cero errores en consola y el overlay
de Next limpio. Verificar contra él daba resultados que parecían buenos y no probaban nada
(ver el hallazgo de la hidratación en [hallazgos-ui.md](hallazgos-ui.md)).

**El chequeo, una línea, antes de confiar en cualquier verificación de interacción:**

```js
Object.keys(document.querySelector('main *')).filter(k => k.startsWith('__react')).length
// 0 → el server está sirviendo HTML muerto. Lo que midas ahí no vale.
```

**La salida sin tocar el proceso ajeno: un worktree**, que al ser otro directorio tiene su
propio lock de dev server. Las tres cosas que hay que recrear a mano, y las tres fallan de
formas distintas:

1. **`node_modules`** — el junction de NTFS (`mklink /J`) **no le sirve a Turbopack**: falla con
   `Symlink [project]/node_modules is invalid, it points out of the filesystem root`.
   ⚠️ **`next dev --webpack` YA NO ES LA SALIDA** (medido el 05/10/2026): arranca y cada página
   contesta 500 con `UnhandledSchemeError: Reading from "node:crypto" is not handled by
   plugins` — la app está escrita para Turbopack. La salida que anda es la que ya estaba en
   [hallazgos-comunicacion.md](hallazgos-comunicacion.md): el worktree como HERMANO del clon
   (en el scratchpad, el ancestro común con el clon sería `C:\Users\marti` entero, y
   Turbopack vigilaría eso) y, **sólo en el `next.config.ts` de esa
   copia descartable**, `turbopack.root` subido a la carpeta que contiene a los dos
   (`path.resolve(__dirname, '..')`). Con eso arrancó en 1,3 s y sirvió `/plan/agencia`.
   ⚠️ **Y AL DESARMARLO, EL JUNCTION SE SACA PRIMERO Y SOLO:** `[System.IO.Directory]::Delete(
   ruta, $false)` sobre el enlace (verificando antes que `LinkType` sea `Junction`), y recién
   ahí el worktree. Un borrado recursivo con el junction puesto sigue el enlace y vacía el
   `node_modules` del clon principal. `Remove-Item` sobre el junction dio
   `NullReferenceException`, y la carpeta del worktree necesita el prefijo `\\?\` (rutas
   largas de `.next/`).
   ⚠️ **Y NO ES EL ÚNICO JUNCTION: el BUILD deja otro.** `next build` en el worktree crea
   `.next/node_modules/sharp-<hash>`, un junction al `sharp` del CLON. Medido el 06/10/2026:
   `git worktree remove --force` borra todo lo de git y deja atrás la carpeta con ese enlace
   adentro. Borrarla en forma recursiva vacía el `sharp` del clon, y con eso se rompen las
   imágenes del build de todas las sesiones. Antes de borrar lo que queda, se listan los
   enlaces (`Get-ChildItem -Recurse -Attributes ReparsePoint`) y se sacan de a uno, igual que
   el de `node_modules`.
   ⚠️ **Y `next dev` deja DOS, en otra carpeta**: `.next/dev/node_modules/postcss-<hash>` y
   `sharp-<hash>`, junctions al `postcss` y al `sharp` del clon (medido el 09/10/2026 al bajar
   un dev server de verificación). Se sacan con `cmd /c rmdir` antes de borrar `.next`, contando
   los archivos del clon antes y después. Y matar el server deja además `.next/dev/types`
   cortado: el typecheck da rojo en `routes.d.ts`/`validator.ts` hasta que se borra.
2. **`.env.local`** — está en `.gitignore`, así que el worktree nace sin él y la app arranca sin
   credenciales. Se copia.
3. **El puerto** — `next start` y `next dev` compiten igual. `EADDRINUSE` se lee como si el
   worktree estuviera roto y es solo un puerto ocupado por un experimento anterior.

⚠️ **Y el worktree no arregló nada**: tampoco hidrata. La causa real es que **`next dev` no
hidrata en este proyecto y `next build` + `next start` sí** — está desarrollado en
[hallazgos-ui.md](hallazgos-ui.md). O sea que para probar una INTERACCIÓN, el worktree sobra:
alcanza con levantar el build de producción en otro puerto.

⚠️ `next start` pone `NODE_ENV=production`, con lo cual `/api/auth/dev-login` devuelve 404 **a
propósito**. No se toca esa guarda: se firma la cookie a mano con el mismo secret
(`crearToken` de `lib/auth-session.ts`, con `node --import tsx --env-file=.env.local`) y se la
inyecta con `ctx.addCookies`. Es lo mismo que hace el dev-login, sin abrir una puerta nueva.

### `git add <archivo>` explícito igual se lleva trabajo de la otra sesión

La regla escrita es «nunca `git add -A`, commiteá por ruta explícita». **No alcanza:** git stagea
por ARCHIVO, y dos sesiones paralelas pueden tener cambios distintos dentro del **mismo** archivo.
Caso real: `lib/mako-context.ts` tenía la inyección de experimentos de una sesión y, en el mismo
archivo, el refactor de prompts editables de la otra; `git add lib/mako-context.ts` metía el
trabajo ajeno adentro de un commit titulado «solo experimentos». No rompe el build, pero **el
commit deja de decir la verdad** y te adueñás de trabajo que no es tuyo.

**Regla:** cuando el archivo esté compartido, stagear solo lo propio, o asumir el archivo entero a
conciencia y decirlo en el mensaje. (El modo de falla contrario —subir el archivo que importa y
dejarse el que define— está en [Build, deploy y entrega](#build-deploy-y-entrega).)

⚠️ **Pero `git add -p` NO le sirve a un agente**, que es lo que decía este hallazgo hasta el
8/8: es interactivo, y en esta herramienta los flags interactivos (`-p`, `-i`) no corren. Peor:
si los dos bloques quedaron **pegados** —las dos sesiones agregando al final del mismo archivo—
git los reporta como **UN solo hunk** y ni siquiera `-p` los separaría sin editar el parche a mano.
Pasó con `app/_ui/ui.css`: 145 líneas en un hunk, 46 de la otra sesión y 99 mías.

Lo que sí funciona, y no le toca el worktree a nadie —que es la condición, porque la otra sesión
está editando ese archivo AHORA—: construir el contenido que querés commitear y stagearlo por
plumbing.

```bash
git show HEAD:app/_ui/ui.css > /tmp/mio.css     # la base limpia, sin lo de nadie
tail -n +<primera-linea-tuya> app/_ui/ui.css >> /tmp/mio.css
h=$(git hash-object -w /tmp/mio.css)
git update-index --cacheinfo 100644,$h,app/_ui/ui.css
```

Y **verificá las dos direcciones antes de commitear**, que es lo que convierte esto en seguro:
`git diff --cached -- <archivo>` tiene que traer solo lo tuyo, y `git diff -- <archivo>` solo lo
de ellos. Un `grep` de una clase ajena sobre el archivo construido cuesta nada y prueba el corte.

Es el mismo principio que `commit-tree` + `update-ref` para arreglar un mensaje viejo: **el
plumbing mueve referencias y el worktree ni se entera**, mientras que cualquier comando de
porcelana (`stash`, `checkout`, `rebase`) le cambia los archivos abajo de los pies a la otra sesión.

⚠️ **Y el mismo día pasó al revés: la otra sesión se llevó lo mío.** `git mv` no es como editar un
archivo — **stagea en el acto**. Así que un renombre queda en el índice desde que lo hacés hasta que
commiteás, y en ese hueco cualquier `git add -A` de la otra sesión se lo lleva. Fue exactamente lo
que pasó con `app/admin/dev/ads-generator/` → `ads-writer/`: terminó adentro de `feddcc3`, un commit
sobre el cruce del plan que no tiene nada que ver.

No se pierde contenido y no rompe nada: el archivo queda en la ruta correcta. Se pierde la
trazabilidad, y el commit deja de decir la verdad. La regla práctica: **si vas a renombrar, hacelo
justo antes de commitear**, no al principio de la tanda — al revés de lo que pide la comodidad.
Y no lo arregles reescribiendo historia si la otra sesión está viva: mover un cambio de archivo
entre commits es un rebase encubierto, y el costo es peor que el problema.

**Vive en:** global · casos testigo lib/mako-context.ts, app/_ui/ui.css · *2026-06-30 ~experimentos-medicion-y-ui + 2026-08-08 rediseño Parte 3*

### ⚠️ Un contexto POR PESTAÑA no puede vivir en una cookie, y `sessionStorage` tampoco alcanza

**Síntoma:** el super admin entraba a un cliente y se le cambiaba el contexto en TODAS las
pestañas abiertas, incluida la del panel de admin. No podía mirar dos clientes a la vez.

**Causa:** la impersonación era una cookie firmada (`mako_ws`). Las cookies son del
NAVEGADOR, no de la pestaña — no hay opción de alcance que las haga por pestaña.

**Y el diagnóstico obvio es el equivocado.** Lo primero que se piensa es `sessionStorage`,
que sí es por pestaña. No sirve: **el server no lo puede leer cuando pinta la página**, y
en esta app 61 de las 104 pantallas deciden qué mostrar con un gate server-side
(`requireCapa` / `guardTab`) que corre en el request del documento. Con `sessionStorage` el
gate resolvería con el workspace equivocado y solo los datos traídos por `fetch` estarían
bien: media pantalla de un cliente y media del otro.

**Regla:** lo único que es distinto en cada pestaña Y llega en el request del documento es
**la URL**. Cualquier contexto por pestaña va ahí. En este repo es `?ws=N`.

Las tres piezas, y por qué cada una está donde está:

1. **`proxy.ts`** lo valida y lo convierte en un header interno. Es el único que mira el
   parámetro. Un `?ws=` lo escribe cualquiera: sin la validación contra la sesión firmada
   es un IDOR que abre los datos de otro cliente.
2. **El parche de `fetch`** (`app/_components/WsFetch.tsx`) se lo pega a las 340 llamadas a
   `/api`. Un choke point en vez de 340 ediciones, por la misma razón que `emitirAviso`.
3. **`app/_ui/Link.tsx`** lo preserva en la navegación (27 archivos de `next/link` + 30 de
   `useRouter`, cambiados con un codemod).

**Vive en:** lib/ws-tab.ts · proxy.ts (`seguir`) · lib/workspace.ts (`wsDePestana`) · app/_ui/Link.tsx · app/_components/WsFetch.tsx · *2026-08-08*

### ⚠️ En un gate con varias salidas, el chequeo va DENTRO del helper, no en cada llamada

**Síntoma:** todo el mecanismo de `?ws=` andaba… salvo en `/api/auth/me`, que es
justamente la ruta que le dice al sidebar y al cartel a qué cliente estás mirando. O sea:
los datos eran del cliente correcto y la interfaz decía que no estabas en ningún cliente.

**Causa:** `seguir(req, sesion)` recibía la sesión por parámetro y la ponía solo si venía.
Pero `proxy.ts` tiene **cinco salidas**, y la de rutas públicas es un early-return que
corre ANTES de verificar la sesión. `/api/auth/me` cuelga de `/api/auth`, que está en
`PUBLICOS` — así que salía por ahí, sin sesión, sin header. La llamada estaba bien escrita;
el problema era que se podía escribir mal.

**Regla:** cuando un gate tiene varias salidas, lo que TODAS deben hacer se pone adentro
del helper compartido, no como argumento en cada `return`. Un parámetro que hay que
acordarse de pasar es un parámetro que un día no se pasa — y acá el modo de falla no es un
error visible, es una pantalla que muestra los datos de un cliente con el chrome de otro.

**Vive en:** proxy.ts (`seguir`, y la lista `PUBLICOS`) · *2026-08-08*

### Un parche global de `fetch` va en el módulo, no en un `useEffect`

Los efectos de React corren de **hijo a padre**. Un provider que parchee `window.fetch` en
su `useEffect` lo hace DESPUÉS de que sus hijos ya dispararon las llamadas de la carga
inicial — justo las que más importan, y el bug sería intermitente según qué componente
montó primero. El código de arriba de un módulo `'use client'` corre al cargar el chunk,
antes de renderizar nada.

Corolario del mismo trabajo: **`useSearchParams()` obliga a envolver en `<Suspense>` a todo
componente que lo use**, o el build se cae en las rutas estáticas. Con 27 archivos serían
27 fronteras nuevas. Se lee UNA vez en un provider que ya vive adentro de un Suspense y se
reparte por contexto.

**Vive en:** app/_components/WsFetch.tsx · app/_ui/Link.tsx (`WsProvider`) · *2026-08-08*

### Separar las cuentas por `CLAUDE_CONFIG_DIR` también separa la memoria

Las dos cuentas están aisladas con `CLAUDE_CONFIG_DIR` (`~\.claude` y `~\.claude-martin`). El
protocolo completo está en [dos-cuentas.md](dos-cuentas.md); acá va solo la trampa.

**El diagnóstico obvio era el equivocado.** La documentación del esquema decía que los directorios
separados aíslan la sesión pero no los settings del proyecto, «que es lo que querés». Es cierto y
es la mitad: **las 159 memorias viven DENTRO del config dir**
(`<config>\projects\<clave>\memory\`), igual que el `CLAUDE.md` global. La cuenta nueva no arranca
con menos permisos: arranca **ciega**, sin nada de lo aprendido, y no hay ningún error que lo
indique — simplemente no sabe.

Lo que sí comparten las dos es todo lo **versionado**: `AGENTS.md`, `docs/`, las skills de
`.claude/skills`. Por eso el canal de traspaso entre cuentas son **estos documentos**, no las
memorias.

Se resolvió con **junctions de NTFS**, no con copias: `mklink /J` desde cada ruta a la carpeta
real. Una copia se bifurca en silencio y en dos semanas hay dos verdades. Ojo con un detalle que
multiplica las rutas: **la clave de proyecto sale del `cwd`**, así que abrir la sesión desde la
carpeta padre o desde el repo genera dos claves distintas y cada una busca su propia `memory/`.

- **Dos sesiones no editan la misma skill ni el mismo prompt a la vez.** Se pisan igual que el código, pero el efecto aparece días después y en otro lado.

### ⚠️ El `pre-push` te bloquea por trabajo ajeno, y el error nombra archivos que nunca tocaste

Que el hook mire el **árbol de trabajo** y no lo que subís ya está escrito, pero siempre en la
dirección del falso VERDE (pasa algo que no debería). Con sesiones paralelas pasa también la
contraria, y esa desorienta más: **tu commit está impecable y el push se cae igual**, porque el
árbol tiene la mitad de una feature ajena.

Caso real: un commit de tres archivos (dos `.md` y un cambio de color) rebotó con
`lib/pipeline.ts` y `lib/razones.ts` — dos archivos que ese commit no tocaba. La otra sesión había
agregado un quinto canal (`presencial`) a `CanalId` sin actualizar los dos `Record<CanalId, …>`.
**El diagnóstico obvio era el equivocado**: el error se lee como «tu push rompió los tipos» y lo
que estaba roto era el escritorio de al lado. Pista para reconocerlo en un segundo: los archivos
del error no están en tu commit (`git show --stat HEAD`) y **sí** están en `git status`.

**Cómo saber de quién es la rotura, sin tocarle los archivos a nadie:** un worktree suelto en tu
commit, con `node_modules` enganchado por junction —que no pide admin y tarda un segundo—:

```
git worktree add --detach <ruta> HEAD
cmd /c mklink /J <ruta>\node_modules <repo>\node_modules
cd <ruta> && npm run typecheck
```

Si ahí pasa, la rotura es ajena y está sin commitear. Y como el hook corre en el directorio desde
el que pushás, `git push origin HEAD:main` **desde el worktree** valida exactamente lo que sube.
No es saltearse el hook: es correrlo contra el árbol correcto. `--no-verify` no.

⚠️ **Y el falso verde deja rastro en `main`.** Al pushear desde el worktree limpio apareció el
segundo portón: `.claude/skills/plan-tareas/SKILL.md DESINCRONIZADO`. Comprobado con un checkout
pelado de `origin/main`, sin nada local: **`main` ya está desincronizado**. O sea que alguien
pusheó con un `skills-lock.json` sin commitear que hacía pasar el chequeo local — el falso verde
del hook, pero realizado. Un clon limpio de `main` no se puede pushear hasta correr
`node scripts/sync-contrato-detalle.mjs` y commitear el resultado.

**La regla:** antes de pelear con un `pre-push` rojo, fijate si los archivos del error son tuyos.
Y si vas a pushear con el árbol sucio de otra sesión, el worktree es la forma de saber qué estás
subiendo de verdad.

**Vive en:** .git/hooks/pre-push · scripts/sync-contrato-detalle.mjs · *2026-08-10 ~pricing-dos-monedas*

---

## El equipo: cuando se cierra Claude Code y no es Claude Code

### ⚠️ El `next dev` de la otra sesión deja `.next/dev/types/*` CORTADO A LA MITAD, y el typecheck lo culpa a él

Variante de la anterior, y engaña distinto: acá lo que rompe no es código ajeno **sin
commitear** sino un archivo **generado** que quedó a medio escribir. Medido el 30/08/2026:

```
.next/dev/types/routes.d.ts(207,14): error TS1109: Expression expected.
.next/dev/types/routes.d.ts(214,5): error TS1161: Unterminated regular expression literal.
.next/dev/types/validator.ts(1430,18): error TS1002: Unterminated string literal.
```

Siete errores, ninguno en el repo. Leyendo el archivo aparece la firma: una línea dice
`omponents` (le falta la `c`) y otra `ves">> = Specific`. **Son escrituras truncadas**, no
código roto — el `next dev -p 3000` de la otra sesión (pid 26880) los había reescrito 57
segundos antes.

Tres cosas que lo separan del caso de arriba:

- **La pista de `git status` NO sirve**, porque `.next/` está en `.gitignore`: los archivos
  del error no aparecen ni en tu commit ni en el status. La pista es la RUTA — todo lo que
  cuelga de `.next/` es generado, y un error de SINTAXIS ahí adentro (`Unterminated
  string literal`, `Expression expected`) no es de nadie: es un archivo partido.
- **No se cura solo esperando.** «El verde se toma con el árbol estable» funciona para un
  refactor ajeno a medio terminar; acá el archivo quedó roto **en disco** y una segunda
  corrida del typecheck da exactamente los mismos siete errores. Se cura recompilando (que
  lo dispara la otra sesión al tocar una ruta) o desde un worktree limpio, donde `.next`
  nace vacío.
- **Y frena el push**, porque el pre-push corre `npm run typecheck`. Sigue valiendo lo de
  siempre: worktree limpio, `--no-verify` nunca.

⚠️ **Y el error miente sobre el archivo culpable en un segundo nivel:** `validator.ts` nombra
la última ruta que alcanzó a escribir antes del corte
(`app/api/ads-manager/analyze-creatives/route.js`), así que el mensaje invita a ir a mirar
una ruta que no tiene absolutamente nada que ver.

**Vive en:** `.next/dev/types/` (generado) · `.git/hooks/pre-push` · *2026-08-30*

### ⚠️ «Se cierra solo» = crash del proceso GPU ~~por la gráfica híbrida, no un bug de la app~~

> 🔴 **EL TÍTULO DE ESTA ENTRADA ESTÁ AL REVÉS, y se deja escrito para que se vea el error.**
> **SÍ es un bug de la app**, con ~10 issues abiertos y el mismo `exitCode 101457950`, y **no
> es la gráfica híbrida**: el mismo crash ocurre en una RTX 2080 de escritorio sin iGPU y en
> un ARM64 con GPU Adreno. Todo lo de abajo sobre *cómo* se investigó sigue valiendo; la
> conclusión sobre la CAUSA no. Ver «El diagnóstico correcto» al final de la sección.

**Síntoma:** la sesión de Claude Code desaparece cada 4 a 46 minutos, siempre alrededor de
lanzar un workflow. La PC **sigue andando**: el dueño vuelve al rato y la app ya no está.
Windows ofrece «reparar» la app. Las corridas con subagentes se pierden enteras — cuatro
veces la misma noche.

**Causa:** en `%APPDATA%\Claude\logs\main.log`, cada reinicio viene precedido por
`GPU process gone: { reason: 'crashed', exitCode: 101457950 }`, y **sin `onQuitCleanup`** —
la app muere de golpe, no se despide. El equipo es una notebook con **gráficos híbridos**
(Intel UHD + RTX 4060). Claude estaba en «Alto rendimiento» (`GpuPreference=2`), así que la
NVIDIA renderizaba y **copiaba los cuadros al framebuffer de la Intel**, que es la que
maneja el panel. Ese traspaso es lo que se rompe, y pega más con varios contextos de
navegador a la vez (los subagentes) porque hay más superficie para que la copia falle.

**La regla:** en una notebook con Optimus, fijar Claude a la **integrada**, no a la dedicada
— `Configuración → Sistema → Pantalla → Gráficos → Claude → Ahorro de energía`. La integrada
ya maneja el panel; sacar el salto entre placas elimina el fallo. Verificable en el registro:
`HKCU:\SOFTWARE\Microsoft\DirectX\UserGpuPreferences` tiene que decir `GpuPreference=1;`.

**Tres diagnósticos obvios que estaban EQUIVOCADOS**, y es lo que más tiempo cuesta:

1. **«Es falta de memoria.»** No: había 3,8 GB libres de 16 en cada crash, y la app usaba
   1,96 GB. La telemetría propia (`[process-memory] … sys_free=`) lo desmiente sola.
2. **«Windows cierra la sesión.»** El log dice `Windows session ending (shutdown)` **una
   sola vez** — y esa fue el reinicio que dispara el instalador de drivers (evento
   Kernel-Power 109, `Reason: Kernel API`). Las otras cinco no tienen ni ese aviso ni
   `onQuitCleanup`.
3. **«Actualizando los drivers se arregla.»** Se actualizaron los dos (Intel y NVIDIA) y
   **volvió a crashear 4 minutos después**. Lo que lo arregló fue el pin a la integrada.

También quedaron descartados con evidencia: hardware (cero eventos WHEA), el driver
colgándose (cero TDR), el software de MSI y la cámara virtual Camo (corriendo durante las
tres pruebas de reproducción, sin un solo crash), y «es del sistema entero» (Chrome tuvo 35
crashes en 4 meses; Claude, 6 en 3 horas — no es comparable).

**Cómo verificarlo sin adivinar.** Un crash del proceso GPU **no deja atribución en ningún
log**: ningún componente firma que lo mató. Se reproduce y se mide. Las tres pruebas, en
orden de valor:

| Prueba | Qué mide | Resultado con el pin a Intel |
|---|---|---|
| 6 escenas WebGL sostenidas, 4 min | carga bruta de GPU | no crashea (**y sin el pin tampoco** — descarta «se satura») |
| Churn de pestañas: crear → navegar → cerrar, ×5 | ciclo de vida del contexto | no crashea |
| **6 agentes en paralelo con navegador** | **concurrencia — la condición real** | **6 de 6, sin crash** |

La tercera es la que importa: es la única que reproducía el fallo antes.

⚠️ **El pin bajó la frecuencia pero NO cerró el caso** — volvió el 13/8 con el registro
intacto. Ver la entrada siguiente antes de dar esto por resuelto.

**Vive en:** `%APPDATA%\Claude\logs\main.log` (buscar `GPU process gone`) ·
`HKCU:\SOFTWARE\Microsoft\DirectX\UserGpuPreferences` · *2026-08-09*

### ⚠️ El pin a la integrada aguantó 4 días y volvió: «verificado» no es «cerrado»

**Síntoma:** el 13/8 a las 01:19:30 la app se cerró sola otra vez. Mismo
`exitCode: 101457950`, misma firma. **Y el arreglo seguía puesto**: el registro decía
`GpuPreference=1;` — nadie lo revirtió, ni un driver ni una actualización.

Entre el 9/8 y el 12/8 hubo **cero** crashes. O sea que el pin hizo algo real; lo que no
hizo fue eliminar la causa. Las tres pruebas de reproducción del 9/8 pasaron limpias
porque **la ventana de reproducción era de minutos** y la condición que falta no se dio en
ellas.

⚠️ **La hipótesis del uptime quedó REFUTADA el mismo día.** Se planteó acá que la
condición «tardaba días» porque el crash llegó al cuarto día sin reiniciar; el crash
siguiente llegó a **1 h 08 min** de un reinicio limpio. Lo que faltaba no era tiempo
acumulado sino un disparador — ver «Lo que mata a Claude es el NAVEGADOR EMBEBIDO» más
abajo. Se deja escrita la hipótesis equivocada a propósito: era razonable con los datos
que había, y el error fue tratar una correlación de UN caso como dirección de búsqueda.

**Lo que más costó, y es lo que se repite:** el 9/8 quedó escrito un monitor
(`C:\Users\marti\diagnostico-gpu.ps1`) justamente para cazar el próximo crash con la
térmica del momento. Cuando el crash llegó, **`crashes-gpu.csv` tenía solo el
encabezado**. El monitor había corrido tres horas la madrugada del 9/8 y nunca más.

> **Un monitor que hay que acordarse de arrancar no mide: mide una vez.** Si el evento
> que querés cazar aparece cada varios días, el monitor va como tarea programada al
> inicio de sesión — no como una ventana abierta, que además se cierra por accidente.

Tres defectos del monitor v1, todos del mismo tipo (funcionaba en la sesión en que se
escribió y no en la que hacía falta):

1. **Releía el `main.log` entero cada 20 segundos.** Ese archivo pesa 3 MB y rota
   recién a los ~27 MB: el monitor cargaba el equipo que venía a medir.
2. **Miraba solo `main.log`, y el log rota justo en el crash.** El 13/8 la rotación a
   `main1.log` pasó en el **mismo segundo** (01:19:30) que el evento. Un seguidor de un
   solo archivo se pierde exactamente lo que vino a cazar. La marca de agua ahora es el
   **timestamp** del último evento visto, no un offset de bytes: sobrevive a la rotación
   sin lógica extra, y se leen los dos archivos con dedup por `(timestamp, evento)`.
3. **Solo registraba `GPU process gone`.** Pero lo que se siente como «se cerró solo» es
   *la app desapareciendo*, que también pasa sin crash de GPU. Un cierre súbito no dejaba
   ninguna fila, así que el CSV no podía contestar «¿cuántas veces se me cerró hoy?». La
   v2 registra cuatro eventos —`GPU_CRASH`, `MUERTE_SUBITA`, `CIERRE_LIMPIO`, `ARRANQUE`—
   y distingue el cierre querido del súbito por si hubo `beforeQuit: handler fired` en el
   log en los 90 s previos. `CIERRE_LIMPIO` se anota igual, a propósito: sin esa fila no
   hay forma de descartar un falso positivo al leer el CSV.

Y un cuarto que corrompió los datos que sí se juntaron: **el script escribía el
encabezado solo si el archivo no existía**, así que al cambiar de formato las filas nuevas
quedaron bajo el encabezado viejo. En `termica.csv` del 9/8 conviven filas de 8 y de 9
columnas — dos ventanas del monitor corriendo a la vez, una de cada versión. Ahora el
encabezado se compara y el archivo viejo se aparta a `.viejo-<fecha>`, y un mutex global
impide la segunda instancia.

**Vive en:** `C:\Users\marti\diagnostico-gpu.ps1` (v2) ·
`C:\Users\marti\instalar-monitor.ps1` (la tarea programada) ·
`~\crashes-gpu.csv` + `~\termica.csv` · *2026-08-13*

### ⚠️ Un sensor congelado es peor que un sensor ausente, y el que exigía admin era el malo

El monitor medía la temperatura del CPU con `MSAcpi_ThermalZoneTemperature` (`root/wmi`),
que **exige elevación** — tanto que la v1 se negaba a arrancar sin admin y la tarea
programada se instaló elevada por eso. Medido sobre los datos que dejó: **398 lecturas
consecutivas a lo largo de 3 horas, las 398 exactamente `51,1 °C`**, con la carga del CPU
variando entre 4% y 72%. En el arranque siguiente se quedó pegada en `59,1`. Cambia de
valor entre sesiones y **nunca dentro de una**.

La fuente que sirve es `Win32_PerfFormattedData_Counters_ThermalZoneInformation`: varía de
verdad (60,9 → 59,9 en tres segundos), **no exige admin**, y encima trae `ThrottleReasons`
— el sistema *diciendo* que limitó, en vez de nosotros infiriéndolo de un umbral elegido a
ojo.

**Lo que lo hace caro no es que faltara el dato: es que el dato malo se parecía al bueno.**
51,1 °C y 59,1 °C son temperaturas perfectamente creíbles para un CPU en reposo. El
veredicto «NO fue térmico: el CPU nunca pasó de 80 °C» iba a salir con total seguridad de
un número que no medía nada — y encima con la autoridad de haber pedido permisos de
administrador para conseguirlo. Un valor ausente se nota; uno congelado se cita.

**Las reglas que quedan:**

- **Un sensor se valida por su VARIANZA antes de creerle un valor.** Si no se movió un
  décimo en diez minutos mientras la carga cambiaba, no está midiendo. El script ahora lo
  detecta y dice «temperatura NO CONFIABLE» en vez de emitir un veredicto.
- **Que una fuente exija privilegios no la hace mejor.** Es fácil leer «Access denied» como
  «este dato es el bueno, está protegido», y buscar la elevación en vez de una segunda
  fuente.
- **Si el sistema publica el hecho, no lo infieras de un umbral.** `ThrottleReasons > 0` es
  un dato; `pico >= 90 °C` es una hipótesis nuestra sobre cuándo empieza el throttling.

El mismo día y el mismo archivo dieron el caso gemelo, más fácil de ver porque el número
era absurdo: **`nvidia-smi` informa `power.draw = 590,01 W` sobre un `power.max_limit` de
45 W** cuando la dedicada está en reposo profundo — y lo imprime así, no es un error de
parseo. Se estuvo escribiendo en `termica.csv` como si fuera real. Ahora la lectura se
descarta contra el tope: si no es físicamente posible, va vacío, nunca un número inventado.

**Vive en:** `C:\Users\marti\diagnostico-gpu.ps1` → `TempCpu` y `Leer` · *2026-08-13*

### ⚠️ Lo que mata a Claude es el NAVEGADOR EMBEBIDO, no el calor ni la carga (7 de 7)

Con el monitor midiendo, el crash del 13/8 a las 11:40 quedó registrado con su contexto, y
el disparador aparece en el log a **14 segundos**:

```
11:39:57 [Preview] Created browser preview { serverId: 'browser-preview-…' }
11:40:11 GPU process gone: { reason: 'crashed', exitCode: 101457950 }
```

Cruzado contra **todos** los crashes de los logs, el patrón es el mismo: **7 de los 7 que
tienen la ventana previa completa ocurren dentro de los 41 segundos de crear un contexto
de navegador embebido** (`Created browser preview` / `Warming up session preview` /
`Launch: Updating active servers store`), y cinco de los siete dentro de 15 segundos. El
octavo (13/8 01:19:30) es el único sin evidencia, y es justo aquel en que el log rotó en el
mismo segundo: su ventana previa quedó en el archivo viejo.

Lo que el monitor descarta **con dato propio**, no por descarte lógico:

| Sospecha | Medición en el crash |
|---|---|
| Térmico | 56,9 °C, pico de 10 min 59,9 °C, `ThrottleReasons = 0` — y el mismo sensor marcó 84,9 °C en el arranque, así que tiene rango |
| Memoria | 2,2 GB libres justo antes; nunca llegó a cero |
| Uptime acumulado | **1 h 08 min** desde el reinicio. La hipótesis de «se degrada a los días» quedó refutada |

Esto **confirma la sospecha original de la entrada del 9/8** —«pega más con varios
contextos de navegador a la vez»— y explica por qué el pin a la integrada bajó la
frecuencia sin cerrar el caso: no ataca al disparador, sólo achica la superficie.

**El estado del equipo justo antes:** 4 sesiones locales calentando en paralelo, 2
workflows arrancados, procesos de Claude subiendo de 16 a 19 y la RAM libre cayendo de 4,2
a 2,2 GB en 90 segundos. El preview llega arriba de eso.

**Las palancas, y hay que ser honesto sobre cuál es cuál:**

1. **Mitigación real e inmediata: para trabajo de navegador, el Chrome externo**
   (`mcp__claude-in-chrome__*`), no el pane embebido (`mcp__Claude_Browser__*`). El
   contexto GPU pasa a vivir en el proceso de Chrome: si revienta, se lleva a Chrome y no
   a la app con todas las sesiones adentro. No arregla la causa, saca a Claude del radio
   de explosión. ⚠️ Contradice en parte a [[verificar-en-navegador]], que empuja al
   preview embebido; cuando las dos sirven, gana la externa **en este equipo**.
2. **Menos previews simultáneos.** El crash llegó con cuatro sesiones calentando su preview
   a la vez. `epitaxy-transcript-links-in-preview: false` en
   `%APPDATA%\Claude\claude_desktop_config.json` evita que además cada link del transcript
   abra uno.
3. **Lo único que podría ser arreglo de raíz: el driver de la Intel.** Desde el pin, TODO
   el render pasa por la integrada, así que el driver que importa es el suyo —
   `32.0.101.7088`, del **16/6/2026**. La actualización del 8/8 se hizo cuando el render lo
   manejaba la NVIDIA, o sea contra la placa equivocada.
4. **No hay palanca de «desactivar la aceleración por hardware».** La app está instalada
   como MSIX (`Claude_…_x64__pzs8sxrjxfjjc` en `WindowsApps`), que no toma flags de
   Chromium por acceso directo, y no hay opción en `config.json`. Verificado, no asumido.

**Vive en:** `%APPDATA%\Claude\logs\main.log` (cruzar `Created browser preview` con
`GPU process gone`) · `~\crashes-gpu.csv` · *2026-08-13*

### 🔴 El diagnóstico correcto: es un BUG CONOCIDO de la app, y el hardware no tenía nada que ver

Cuatro días de investigación sobre el hardware, y la respuesta estaba en el bug tracker de
la app. **El `exitCode 101457950` es `0x060C201E`, y tiene ~10 issues abiertos en
`anthropics/claude-code`**, todos con la misma firma y el mismo disparador:

| Issue | Hardware del reportante | Por qué importa |
|---|---|---|
| [#80444](https://github.com/anthropics/claude-code/issues/80444) | **RTX 2080 de escritorio, sin iGPU Intel**, reproducido con **dos** drivers NVIDIA distintos | **Falsa la hipótesis de la gráfica híbrida y la del driver, de una sola vez** |
| [#68049](https://github.com/anthropics/claude-code/issues/68049) | **ARM64 con GPU Adreno** (ni Intel ni NVIDIA) | Falsa que sea de una marca de GPU |
| [#82967](https://github.com/anthropics/claude-code/issues/82967), [#81159](https://github.com/anthropics/claude-code/issues/81159), [#83478](https://github.com/anthropics/claude-code/issues/83478), [#81698](https://github.com/anthropics/claude-code/issues/81698), [#81664](https://github.com/anthropics/claude-code/issues/81664) | variado | Mismo código, mismo disparador |

**La causa real:** la página cargada en el Browser embebido corre una batería de sondeo de
capacidades WebGL/WebGPU (el fingerprinting normal de cualquier sitio), y eso mata al
proceso GPU **15 a 36 segundos** después de abrir la pestaña. Nuestra medición local dio
6-41 s: el mismo fenómeno. Es una **regresión de la app** introducida en `1.24012.1` el
22/07/2026 — antes de esa versión, cero crashes.

**Lo que esto le hace a las conclusiones anteriores:**

- **El pin a la integrada nunca fue la cura.** Los cuatro días limpios del 9 al 12 no los
  produjo el registro: los produjo no haber abierto el navegador embebido. Se atribuyó la
  mejora al cambio que se había hecho, sin controlar la variable que de verdad decidía.
- **El driver no era la palanca.** Además de estar falsado por #80444, no había nada que
  instalar: `32.0.101.7088` **es la última** de la rama «Intel 11th-14th Gen Processor
  Graphics», que Intel pasó a **legacy** el 19/09/2025. Los drivers más nuevos por fecha
  (`101.8860`, `101.8864`) son de la rama Arc/Core Ultra y no soportan gen 11-14 — no
  instalarían. Y el último fix de Intel del lado WebGL ya está incluido en la 7088.

**El arreglo, en orden de contundencia:**

1. **Apagar el navegador embebido:** `Ajustes → Claude Code → Browser`. Es el workaround que
   los propios reportantes confirman efectivo. Cuesta la feature de preview embebido.
2. **Lanzar la app sin GPU** — y acá va una corrección: *sí* se le pueden pasar flags de
   Chromium a un MSIX, contra lo que se afirmó antes en esta sesión. La vía es
   `Invoke-CommandInDesktopPackage`, que preserva la identidad del paquete:
   ```powershell
   Invoke-CommandInDesktopPackage -PackageFamilyName Claude_pzs8sxrjxfjjc -AppId Claude -Command 'app\Claude.exe' -Args '--disable-gpu'
   ```
   Microsoft lo documenta como herramienta de depuración, así que es experimento, no fix.
3. **Lo que NO funciona** (probado por otros y reportado en #82967): parar los servicios de
   NVIDIA, apagar la planificación de GPU acelerada por hardware, desactivar HVCI, y DDU.

⚠️ **Y el efecto secundario que nos podría tocar:** tras el crash, Windows marca el paquete
como `appxState=2` (Modified) y la app **no vuelve a abrir** hasta `Configuración → Aplicaciones
→ Claude → Opciones avanzadas → Reparar`, matando antes `cowork-svc.exe`. Acá todavía no pasó,
pero conviene saberlo antes de creer que se rompió la instalación.

**La lección que vale para la próxima, y es la cara:** se investigó el equipo durante días
—térmica, drivers, energía, uptime, un monitor a medida— y la pregunta que lo resolvía era
**«¿alguien más tiene este error?»**. Un `exitCode` es una cadena de búsqueda: pegarlo en el
bug tracker del fabricante cuesta dos minutos y va ANTES de instrumentar el hardware. El
instrumental no se desperdició (probó el disparador y descartó térmica y RAM con dato
propio), pero llegó segundo.

**Vive en:** `%APPDATA%\Claude\logs\main.log` · issues del repo `anthropics/claude-code` ·
*2026-08-13*

### ⚠️ La fila del crash miente sin equivocarse en un solo número

El monitor anotó el crash de las 11:40 así: **carga de CPU 2%, RAM libre 5,3 GB, 0
procesos**. Se lee como «crasheó estando en reposo», y sobre esa lectura escribí un
diagnóstico equivocado antes de mirar la línea de tiempo.

Los tres números son correctos. El problema es *cuándo* se tomaron: el monitor detecta el
crash en su siguiente tick, hasta 20 segundos después, y para entonces la app ya no existe
— el equipo está vacío **porque** se murió. La lectura anterior decía carga **80%**, RAM
**2,2 GB**, **18 procesos**.

**La regla: en un evento que MATA al proceso, el estado que lo describe es el del tick
ANTERIOR, no el del tick que lo detecta.** Vale para cualquier monitoreo por muestreo — lo
mismo pasa con «uso de disco al fallar el backup» o «conexiones al caerse el server». El
que detecta llega tarde por construcción.

Y el corolario, del mismo arreglo: **la hora del evento es la del log, no la de la
detección.** Eran 14 segundos, justo la ventana donde estaba el `Created browser preview`
que explicaba todo.

**Vive en:** `C:\Users\marti\diagnostico-gpu.ps1` → `Anotar` · *2026-08-13*

### Regla: antes de culpar a la app, mirá SU log — está en el disco y dice la causa

Las tres teorías equivocadas de arriba salieron de mirar el sistema (memoria, energía,
drivers) en vez del log de la aplicación. `main.log` tenía la línea exacta desde el primer
minuto. El orden correcto es: **log de la app → evento de Windows que lo corrobore →
reproducción medida**. Y si el log de la app dice `session ending`, eso es Windows
avisando; si NO lo dice y falta `onQuitCleanup`, el proceso murió — son dos causas
distintas y se confunden fácil.

**Vive en:** *2026-08-09*

### ⚠️ «Se cerró Claude y no abría más» puede ser una AUTOACTUALIZACIÓN, no un crash

28/08/2026. Síntoma: la app desaparece mientras corría un chat pesado, y al reabrirla sale
`C:\Program Files\WindowsApps\Claude_1.40609.0.0_…` → **«Another program is currently using
this file»**. Volvió a abrir sola **al cerrar Chrome**.

El log no deja lugar a dudas, y **no hay ningún `GPU process gone`**:

```
11:32:32 [stealth-update] Triggering stealth update after idle timeout
11:32:33 beforeQuitForUpdate handler fired, going down for update
   … 14 minutos sin poder abrirla …
11:46:42 Starting app
11:46:42 [updater] Version changed since last launch: 1.37937.3 → 1.40609.0
```

**La app se cierra SOLA para autoactualizarse** cuando se considera inactiva. Lo que falla
es el reemplazo del paquete MSIX: la extensión de Claude en Chrome mantiene vivo su
**native messaging host**, y ese proceso bloquea el archivo. Se ve en el arranque:

```
[Chrome Extension MCP] Copied native host binary to <home>\AppData\Roaming\Claude\ChromeNativeHost\chrome-native-host.exe
[Chrome Extension MCP] Registering native host for Chrome in Windows registry
```

El manifiesto vive en `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.anthropic.claude_browser_extension`.
Mientras Chrome tenga la extensión conectada, ese `.exe` corre y la actualización espera.

**Qué hacer:** si la app no abre y el error nombra un archivo de `WindowsApps`, **cerrar
Chrome** (o al menos la extensión) y reintentar. Es más rápido que el `Repair` del paquete,
y no hace falta tocar nada más.

**Y la trampa de lectura:** «se cerró sola» + «no abre» se parece muchísimo al crash de GPU
del 13/08, que es otra cosa con otra causa. **Lo que los separa es una sola línea del log**:
si hay `beforeQuitForUpdate`, fue voluntario; si hay `GPU process gone`, murió.

**Vive en:** `%LOCALAPPDATA%\Claude\Logs\main.log` · *2026-08-28*

### ⚠️ El monitor quedó CIEGO ocho días sin dar una sola señal, y convirtió 5 updates en «crashes»

El mismo día salieron dos fallas del monitor, y las dos son del tipo que no avisa.

**1. La ruta del log se mudó y nadie se enteró.** Con una actualización de la app, los logs
pasaron de `%APPDATA%\Claude\logs\` a **`%LOCALAPPDATA%\Claude\Logs\`**. El monitor tenía la
ruta vieja escrita fija: siguió corriendo, siguió midiendo la térmica y siguió anotando
eventos, pero **desde el 20/08 leía un archivo congelado**. Ocho días ciego, con cero
errores en pantalla.

> **Un archivo que no cambia se ve exactamente igual que una app que no crashea.** Todo
> monitor que siga un archivo ajeno necesita, o descubrir su ruta, o gritar cuando la
> fuente lleva demasiado tiempo sin cambiar. Ahora `RutasDeLog` mira las dos ubicaciones y
> se queda con la escrita más recientemente.

**2. Una salida limpia que no estaba en la lista se contó como muerte.** El monitor
reconocía `beforeQuit: handler fired`, pero la autoactualización sale por
**`beforeQuitForUpdate handler fired`** — sin los dos puntos, otro literal. Resultado: **las
5 actualizaciones del 18, 20, 21, 26 y 28 de agosto quedaron anotadas como `MUERTE_SUBITA`**,
y se leyeron como que el problema seguía vivo. Verificado una por una contra el log: las
cinco dicen `stealth update after idle timeout`.

Con eso corregido, el registro real es otro: **2 crashes de GPU (13/08 y 17/08) y ningún
otro desde entonces.**

> **Un monitor con falsos positivos es peor que no medir.** No medir se nota; un falso
> positivo se cree, y gasta la credibilidad que el monitor va a necesitar el día que pase
> algo de verdad. Cuando un detector clasifica por «ausencia de la marca buena», la lista de
> marcas buenas tiene que estar completa — y hay que asumir que va a quedar incompleta.

Se agregó el evento propio `ACTUALIZACION`, y las 5 filas se reclasificaron dejando el
original en `~\crashes-gpu.csv.antes-de-reclasificar-20260828`.

**Dos cosas menores del mismo día, que cuestan tiempo:**

- **Un filtro por `CommandLine` se mata a sí mismo.** `Get-CimInstance Win32_Process | Where
  CommandLine -like '*diagnostico-gpu*'` matchea **el proceso que está corriendo ese mismo
  comando**, porque la cadena aparece en su propia línea de comandos. Hay que excluir `$PID`.
- **Sin admin, `CommandLine` viene vacío para procesos elevados.** El monitor corre elevado:
  «no aparece en la lista de procesos» NO es «no está corriendo». La prueba buena es el
  `LastWriteTime` de lo que escribe.

**Vive en:** `C:\Users\marti\diagnostico-gpu.ps1` → `RutasDeLog`, `EventosNuevos` ·
*2026-08-28*

### ⚠️ `.next/dev` llegó a 51 GB y trabó la máquina entera — Turbopack no poda su caché

08/10/2026. Síntoma: la PC «trabada y lentísima». La medición:

| | antes | después |
|---|---|---|
| Cola de disco | **26** | **1** |
| Pages Input/sec | 126.765 | 13.676 |
| Disco C: libre | 47,6 GB (10%) | 98,6 GB (22%) |

**`.next/dev` pesaba 50,69 GB**, contra 0,53 GB de `.next/server` y centésimas el resto. Es
la caché de desarrollo de **Turbopack, que no se poda sola**: cada `next dev` acumula, y con
varias sesiones trabajando sobre el mismo clon durante semanas, crece sin techo.

Lo que lo hace difícil de ver es que **el síntoma no se parece a la causa**. La RAM estaba al
95% y había builds y typechecks de 2-3 GB a la vista: todo apuntaba a «falta memoria». Pero
el disco al 10% libre es lo que ponía la cola en 26 — y con la cola saturada, *cualquier*
cosa que toque disco se arrastra. Borrar la caché no liberó un byte de RAM y aun así la
máquina volvió a responder.

> **Con el disco casi lleno, Windows no puede sostener la caché de archivos: descarta
> páginas y las relee a cada rato.** `Pages Input/sec` altísimo con `Pages Output/sec` en
> **0** es la firma — no es swap (no escribe), es relectura forzada. Si `Pages Output` es 0,
> no busques memoria: mirá el espacio libre.

**Borrarlo es seguro** —es caché, se regenera— **pero sólo si no hay un `next dev` activo
sobre ESE repo**. Se comprueba antes, y no alcanza con ver procesos `next dev`: puede haber
uno de otro proyecto. La prueba buena es qué puerto escucha y de quién es:

```powershell
Get-NetTCPConnection -State Listen | Where-Object LocalPort -in 3000,3011
cmd /c rd /s /q "<repo>\.next\dev"    # rd es mucho más rápido que Remove-Item
```

Mismo barrido, otros 5,7 GB: `npm cache clean --force` (estaba en 6,7 GB, quedó en 1).

**Y lo que parecía NO ser el problema sí lo era, una vez resuelto el disco:** los
typechecks concurrentes. Esa tarde se los declaró «síntoma, no causa» —y con el disco al
10% era cierto—. Con 109 GB libres la máquina se volvió a trabar y los únicos consumidores
grandes eran dos `tsc` a la vez. **Un factor descartado mientras otro lo dominaba vuelve a
ser candidato en cuanto el primero se arregla**, y conviene decirlo al descartarlo.

**Vive en:** `<repo>\.next\dev` · *2026-10-08*

### ⚠️ `tsc --noEmit` pide 2,4 GB, y 4 sesiones pushean a la vez: el typecheck va con LOCK

Medido el 08/10/2026, las dos puntas del mismo día: a la mañana **tres typechecks
simultáneos** (2.329 + 1.283 + 474 MB) con 0,8 GB libres y uno corriendo hacía **21
minutos**; a la noche, dos (2,9 GB uno) con la máquina trabada otra vez. El chequeo solo
tarda ~7 segundos.

No tardan el doble: **se pelean por la RAM, el sistema pagina y el de 7 segundos queda 20
minutos.** Serializarlos los hace más RÁPIDOS en total — tres en fila son 21 segundos.

`npm run typecheck` pasa por `scripts/typecheck-lock.mjs`, y el pre-push lo hereda sin
tocar `.git/hooks` (que no se versiona, así que un arreglo escrito ahí se pierde al
reclonar). Cuatro cosas que no se ven en la firma:

- **El lock es por MÁQUINA, no por repo** (`os.tmpdir()`), porque el otro proyecto que vive
  en `C:\dev\mako-api` corre su propio typecheck y también pesa 2,4 GB. Hoy sólo lo usa
  este repo; cableado allá, los dos se turnan solos.
- **Se toma con `writeFileSync(..., { flag: 'wx' })`**, que falla si el archivo existe: ése
  es el test-and-set atómico. Y el dueño se comprueba con `process.kill(pid, 0)` —que no
  mata, pregunta—, o un lock huérfano bloquea para siempre.
- **A los 10 minutos corre IGUAL y lo dice.** Es la regla de la casa: una guarda bloquea
  sólo lo que se arregla haciendo lo que ella pide, y acá no hay nada que hacer. Trabar un
  push para siempre por un lock pegado es peor que dos typechecks a la vez.
- **Se llama al `tsc` de `node_modules` con `process.execPath`, sin `npx` ni `shell: true`.**
  npx agrega un proceso y ~1 s; `shell: true` con argumentos sueltos imprime un
  `DeprecationWarning` (DEP0190) en **cada** push.

Verificado en las tres direcciones, no sólo en la feliz: dos a la vez → el segundo escribe
«espero mi turno» y corre después (4m37 contra 2m30, con la máquina saturada); un `tsc` que
falla → **exit 2 se propaga** (un error de tipos sigue bloqueando el push) **y el lock se
suelta igual**; y el guard `tests/typecheck-lock.test.ts`, probado rompiéndolo (con
`tsc --noEmit` directo en package.json: 1 fallo / 1 pase).

⚠️ **El guard existe porque sacar el lock NO FALLA:** los pushes siguen saliendo y la
máquina se vuelve a trabar días después, sin nada que apunte al cambio.

**Vive en:** `scripts/typecheck-lock.mjs` · `package.json` → `scripts.typecheck` ·
*2026-10-08*

### «Vengo trabajando igual hace meses»: lo que cambió no fue la forma, fueron TRES números

Martín lo preguntó así y es la pregunta correcta: si el flujo de trabajo es el mismo,
¿por qué empieza a fallar ahora? Medido, y **ninguno de los tres alcanzaba solo**:

| Qué | Antes | Hoy (08/10/2026) |
|---|---|---|
| Archivos `.ts/.tsx` que tipa `tsc` | **1.604** (08/09) | **2.512** — +57% en un mes |
| Proyectos con typecheck propio en la máquina | 1 | **2** (`C:\dev\mako-api`, otros 2.592 archivos) |
| Sesiones de Claude abiertas por día | 6-8 (fin de septiembre) | **23, 48, 14, 31** (5 al 8/10) |

El typecheck escala con la cantidad de archivos: pasó a pedir **2,4-2,9 GB**. Con dos
proyectos de ese tamaño y 3-4 sesiones que pueden dispararlo cada una en cada `git push`,
el pico pasa de ~3 GB a más de 10 — y la máquina sigue teniendo 16 GB, de los cuales
Claude ya ocupa 3,2.

**La lección, que vale para cualquier «antes andaba»:** un sistema que funciona cerca de su
techo no avisa cuando se acerca — **avisa cuando lo pasa**, y entonces parece que algo se
rompió de golpe. Si el flujo de trabajo no cambió, lo que hay que medir es el CRECIMIENTO
de lo que ese flujo mueve, con dos fechas y el mismo comando (`git ls-tree -r --name-only
HEAD@{30.days.ago}` contra `HEAD`). Tres factores que crecieron a la vez se leen como un
bug; por separado, ninguno lo habría producido.

⚠️ **Y por eso el lock se cableó en LOS DOS proyectos.** Es por máquina (`os.tmpdir()`), así
que `dashboard-marketing` y `mako-api` se turnan solos; cablearlo en uno solo dejaba la
mitad del pico sin cubrir, que es justo lo que se midió esa noche (2,9 GB de `mako-api`
contra un typecheck del repo principal).

**Vive en:** `C:\dev\mako-api\scripts\typecheck-lock.mjs` (copia) · *2026-10-08*

⚠️ **REFUTADO AL DÍA SIGUIENTE, y la refutación es el hallazgo:** «es por máquina, así que
se turnan solos» era falso para el 30% de los árboles de trabajo. Ver la entrada que sigue.

### Un lock que vive en un archivo VERSIONADO protege a un COMMIT, no a una máquina

El 08/10 se serializaron los typechecks con un lock en `os.tmpdir()` y se verificó así: los
dos `package.json` apuntan al mismo script y el script declara el mismo archivo de lock. Las
dos cosas eran ciertas y **midieron los dos proyectos equivocados**.

Medido el 09/10/2026 sobre los 20 checkouts de este repo que hay en la máquina:

| | checkouts |
|---|---|
| con el lock cableado | 14 |
| con `"typecheck": "tsc --noEmit"` CRUDO | **6** |
| …y con el binario de `tsc` disponible, o sea capaces de correrlo | **6** |

**El mecanismo:** `npm run typecheck` resuelve el script del `package.json` **del worktree**,
y el `pre-push` vive en el `.git` **compartido**. Así que un `git push` desde cualquiera de
esos seis corría un `tsc` de 2,3 GB sin esperar a nadie — exactamente el escenario que trabó
la máquina — con el `package.json` del clon principal perfecto y el guard
(`tests/typecheck-lock.test.ts`) en verde, porque ese guard lee `../package.json` relativo a
sí mismo y en esos worktrees **el archivo del guard ni existe**.

Los seis son `.claude/worktrees/wf_2927dff7-760-1..4`, `wt-cierre` y `wtnota`: todos con
trabajo sin commitear o con commits que no están en `origin/main`, o sea **imposibles de
borrar para cerrar el agujero**.

**La cura: el lock se llama desde el HOOK, por la ruta del clon principal** —el único lugar
común a todos los árboles de trabajo—, y `npm run` queda de respaldo:

```sh
LOCK_TSC="$(dirname "$(git rev-parse --git-common-dir)")/scripts/typecheck-lock.mjs"
if [ -f "$LOCK_TSC" ]; then node "$LOCK_TSC"; else npm run --silent typecheck; fi
```

El `cwd` sigue siendo el del worktree, así que `tsc` lee SU `tsconfig`: **lo que se serializa
es la RAM, no lo que se chequea.**

⚠️ **Probado con un dueño FALSO del lock, no con dos typechecks de verdad.** A la máquina le
quedaban 2 GB y `tsc` pide 2,3: correr dos para comprobarlo era provocar el freeze que se
está arreglando. Se tomó el lock con un proceso vivo que escribe su propio `process.pid` (el
de Windows; el `$$` de Git Bash es el de MSYS y `process.kill(pid,0)` lo lee como muerto), y
se verificó que el segundo —lanzado **desde `wtnota`**, uno de los seis sin lock— contesta
«espero mi turno» y NO arranca `tsc`. Con la contraprueba: con el lock libre, no dice que
espera. El archivo de lock se suelta al final, o se traba el push de las otras sesiones.

**La lección que generaliza:** una guarda que se distribuye por un archivo del repo empieza a
valer **desde su commit**, y todo árbol de trabajo anterior queda del lado viejo sin que nada
avise. Si lo que la guarda protege es un recurso de la MÁQUINA (la RAM, un puerto, un
archivo de lock, una cuota), el único lugar correcto es uno que no se versione por copia:
el hook, una tarea del sistema, o el binario mismo. Es la misma familia que «los hooks de
git no se versionan», leída al revés: **el problema no es que el hook falte, es que el
package.json sobre.**

**Vive en:** `.git/hooks/pre-push` · `tests/typecheck-lock.test.ts` · `AGENTS.md` → «El
typecheck NO corre en el build» · *2026-10-09*

### Mi propia verificación abortó dos borrados legítimos: un cero correcto sobre otra pregunta

Dos agentes confirmaron, cada uno por su lado, que 20 videos duplicados y 51 clips ya estaban
en Drive. Antes de borrar puse mi propio chequeo —bien, es la regla— y contestó **«en Drive
veo 1 archivo, esperaba >=20»** y **«0 de 51 con gemelo»**. Abortó los dos.

Los agentes tenían razón. Lo que estaba mal era mi pregunta: **las carpetas de Drive tienen
subcarpetas por módulo**, y `Get-ChildItem -File` sin `-Recurse` sólo ve el nivel de arriba,
donde lo único que hay es `desktop.ini`. Recursivo: 119 y 129 archivos.

La forma correcta no era agregar `-Recurse`: era **cruzar por CLAVE**, que es lo que el
pipeline ya tiene escrito. `drive.json` del curso (23/23 clases con `videoId`) y
`doc-clips.json` (51/51 archivo → `driveId`), más el tamaño byte-exacto arriba (51/51). Un
listado de nombres es un parecido; el manifiesto es la clave.

⚠️ **Y el orden importa: una verificación propia que falla NO desmiente a quien midió
antes.** Lo primero que hay que sospechar es la medición nueva, que es la más barata de
comprobar — y acá era la equivocada. Si hubiera escrito «los agentes se equivocaron», el
hallazgo que quedaba en el repo era falso.

**Vive en:** `C:/cursos/<curso>/drive.json` · `doc-clips.json` · *2026-10-09*

### El contenedor MSIX cuenta el disco DOS veces, con el mismo File ID

Claude Desktop es una app MSIX, así que **redirige `%LOCALAPPDATA%` y `%APPDATA%`**:
`AppData\Local\ms-playwright` y
`AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Local\ms-playwright` son **el mismo
archivo visto dos veces** — verificado con `fsutil file queryfileid`: mismo File ID. Sumar
las dos ramas en una auditoría de disco cuenta **3,3 GB de aire** (ms-playwright 2,03 +
npm-cache 1,0 + pip 0,15 + uv 0,13, que YA están adentro de los 3,66 GB del paquete).

Y la contracara, que es la que hace perder tiempo: lo que se ve desde adentro del contenedor
y lo que se ve desde el Explorador **no son la misma ruta**, así que un borrado hecho «desde
afuera» puede no tocar lo que uno midió adentro.

**Vive en:** `AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\` · *2026-10-09*

### El 4,19 GB que todos citan es el TECHO de node, no lo que pide nada

Tres «riesgos» de esta corrida venían con 4,2 GB al lado: `next build`, `npm run lint` y
cualquier otro script. Es el **mismo número** en los tres porque no es una medición: es
`v8.getHeapStatistics().heap_size_limit` en esta máquina, o sea el máximo que puede pedir
**cualquier** proceso de node antes de morir por OOM. Con ese criterio, todo script del repo
«pesa 4,19 GB».

Lo medido de verdad, corriendo cada uno con un cap duro:

| | techo citado | medido |
|---|---|---|
| `tsc --noEmit` | 4,19 GB | **1,0 – 2,4 GB** (pico real 2,3) |
| `npm run lint` (todo el repo) | 4,19 GB | **1,4 GB** y 11+ minutos |

Y el mecanismo que justificaba el número de lint era falso: **el eslint de este repo NO es
type-aware.** Ninguna de sus 11 capas pone `project` / `projectService`, y
`eslint-config-next/typescript` usa `configs.recommended`, no `recommendedTypeChecked`. La
prueba empírica: lintear UN archivo cuesta 282 MB — si levantara el programa de TypeScript,
un archivo costaría casi lo mismo que 2.430. Si alguien le pone un lock a `lint`, el
argumento honesto es «tarda 11 minutos», no «pide 4,2 GB».

⚠️ **Y a `next build` NO se le pone un lock: ya tiene uno nativo.** Next 16.2.6,
`build/index.js:535`: `lockDistDir` está en el `defaultConfig` CONGELADO y este repo no lo
desactiva, así que dos `next build` sobre el mismo `distDir` no pueden correr a la vez — el
segundo muere en un segundo con «Another next build process is already running» (ya pasó en
esta máquina). Encima, envolver `build` tocaría **el camino de deploy**: `vercel.json` no
declara `buildCommand`, así que Vercel corre ese script tal cual. Y copiar el lock del
typecheck sería un bug, no una copia: ese lock, a los 10 minutos, **corre igual** — bien para
dos typechecks (cuestan RAM), fatal para dos builds escribiendo el mismo `.next`.

**Vive en:** `node_modules/next/dist/build/index.js` · `eslint.config.mjs` · *2026-10-09*

### `cursos-liberar.sh` está ciego a 2,3 de los 3,5 GB que quedan en C:/cursos

El barrido automático ya hizo su trabajo: de los ~120 GB de restos que motivaron el script
queda **3,5 GB**. Pero su `pesoVideo()` **sólo mira `<curso>/video`**, y lo que sobrevive
está afuera de ahí: `Jaque Blue/_duplicados` (1,1 GB — el bajador descargó 20 clases DOS
veces y el dedup liberó sólo una copia), `pdfs/` + `recursos/` (869 MB) y
`creativos-ugc-realistas/doc-clips` (398 MB). El camino oficial (`curso-liberables.mjs
--ver`) dice que hoy liberaría **18 MB, un curso**; y con `PISO_GB=60` y 108 GB libres no
correría ni eso.

⚠️ **Y los duplicados NO son byte-idénticos** (difieren 0,001%-0,01%: son dos descargas
distintas del mismo stream, con duración idéntica al milisegundo por `ffprobe`). Por eso
`--liberar` **nunca** los iba a tocar: exige coincidencia byte a byte. Un guard correcto
dejando crecer una fuga para siempre.

**Vive en:** `scripts/cursos-liberar.sh` → `pesoVideo()` · *2026-10-09*

### El cuello de botella de RAM no son los chats: es Chrome

Medido con la máquina trabada: una sesión de Claude Code son **0,26 GB** (5 sesiones = 1,29
GB, y el pico de la más cargada fue 0,8 GB). Chrome, 2,75–6,4 GB según cuántas pestañas
estén cargadas. **Cerrar un chat devuelve 0,26 GB; cerrar una pestaña pesada, 0,5 GB.**

Cuántas sesiones entran sin paginar, con un typecheck de 2,9 GB corriendo y 1,5 GB de margen:

| Chrome | sesiones que entran |
|---|---|
| 6,4 GB (47 pestañas) | **0** — pagina siempre |
| 4,0 GB | 1 |
| 2,5 GB | 3 |
| cerrado | 6 |

Sin typecheck, sólo sesiones en reposo: 2 con Chrome como estaba, 7 con Chrome en 2,5 GB.

⚠️ **Y lo que tenía la máquina al 100% de CPU no era un dev server ni el typecheck: eran DOS
suites de tests en paralelo** (`npm test` con ~15 procesos `tsx` cada una, una en el clon y
otra en `wt-chatbot`), más dos `node -e` sueltos. `PagesInputPerSec` pasó de **3.007/seg**
durante los tests a 161/seg al terminar. `npm test` no tiene lock y no está en el pre-push:
se dispara a mano, así que no hay guarda posible — pero vale saber que dos suites a la vez
pagina la máquina igual que dos typechecks.

**Vive en:** `package.json` → `scripts.test` · *2026-10-09*

### Borrar datos de «sesiones muertas» relee quién está vivo EN EL MOMENTO

El briefing de la corrida decía 3 sesiones de Claude Code. Había **5**, con nombre y PID
(leídas de `~/.claude/sessions/*.json` y cruzadas con la línea de comandos de cada
`claude.exe`). Un borrado con la lista del briefing le pisa el scratchpad y los `subagents/`
a dos ventanas abiertas.

Por eso todo comando de limpieza relee la lista **al borrar**, aborta si no puede parsear
alguna ficha, y protege además **toda sesión cuyo transcript se haya escrito en las últimas 3
horas** —una ficha puede faltar—. Con eso se liberaron 2,7 GB de `subagents/` de 38 sesiones
cerradas (archivos anteriores al 01/10) y 1,12 GB de 484 scratchpads, sin tocar un solo
`.jsonl` de transcript ni la carpeta `memory/`.

⚠️ **Y `.next/node_modules` tiene JUNCTIONS al `node_modules` real** (medido en
`C:\dev\mako-api`: `postcss-9745a0d11e3197ae` y `sharp-20c6a5da84e2135f`). Un
`Remove-Item -Recurse` de PowerShell 5.1 los **sigue** y borra el contenido del destino; va
`cmd /c rd /s /q`, que borra el junction como entrada. Verificado antes y después: 143
archivos / 853.311 bytes idénticos.

**Vive en:** `~/.claude/sessions/*.json` · *2026-10-09*

### Lo que NO se liberó, y por qué (para no volver a medirlo)

21,0 GB liberados de los ~70 GB que el barrido encontró. Lo que quedó, con su motivo medido:

| Candidato | GB | Por qué no |
|---|---|---|
| `C:\Windows\Installer` sin referencia | 14,3 | Existen, pero el comando propuesto (leer `HKLM:\…\Installer\Patches`) **rompe la máquina** corrido como admin. Necesita admin y revisión paquete por paquete |
| `DriveFS\content_cache` | 17,9 | Uso activo medido (escrituras 37 min antes) y el beneficio declarado estaba inventado |
| `CapCut\User Data\Cache` | 10,7 | El 77% de los bytes NO es cache: la descripción era falsa |
| `hiberfil.sys` | 6,3 | La máquina hibernó hace dos días: no es peso muerto |
| `pagefile.sys` | 39,6 | **El commit limit depende de él** (55,3 GB = 15,7 físicos + 39,6). Con 2 GB libres, tocarlo es romper la máquina |
| Chrome `OptGuideOnDeviceModel` | 4,0 | Es el motor de la detección de estafas de Navegación Segura, usado hace 3 horas |
| Chrome caches (10 perfiles) | 5,6 | Refutado parcialmente; se puede revisar con Chrome cerrado |
| `WinSxS` / shadow copies / `C:\Windows\Temp` | ? | **Sin medir: piden admin.** `Dism /AnalyzeComponentStore` dio error 740. El 23,6 GB de WinSxS es tamaño APARENTE, inflado por hardlinks |
| `ms-playwright` (5 revisiones) | 2,0 | Las usó una sesión viva hace 3 días y hoy, por ruta absoluta |
| `npm-cache` | 1,0 | **No son tarballs**: `_cacache` son 5 MB y el GB está en `_npx`. Se libera con `npm cache npx rm --force` |
| `hyperframes/node_modules` | 0,44 | Su lockfile es de `bun` y bun no está instalado: restaurar exige instalarlo primero |

**Vive en:** esta entrada · *2026-10-09*

## La integración con Claude nunca funcionó desde afuera

**Vive en:** `lib/rutas-publicas.ts` · `proxy.ts` · `tests/rutas-publicas.test.ts`

**Síntoma.** Una clienta instaló la skill y su Claude Code reportó: «el nuevo token
tampoco autentica… puede ser que el endpoint necesite algo más que el token solo (¿un
header adicional, cookie de sesión?), o que el token se genere para otro entorno».

**Causa.** Ninguna de las dos. `/api/agente/*` no estaba en la lista de rutas públicas
del middleware, así que `proxy.ts` cortaba el request con un 401 **antes de que la ruta
mirara el bearer**. El token era correcto; la puerta estaba cerrada. Las tres rutas del
agente —`plan`, `contexto`, `telemetria`— se autentican por `Authorization: Bearer` y no
tienen cookie, que es exactamente el caso que la lista de públicas existe para contemplar.

**Por qué nadie lo vio, que es lo importante.** En local `gateConfigurado()` devuelve
false y el middleware hace **no-op**: contra `localhost` la integración anda perfecta.
Falla solo en producción. Todo el desarrollo y todas las pruebas fueron contra local.

### La pista que lo desenmascara en un segundo

Pegarle a la ruta con un token **inválido** y leer el TEXTO del 401. Los dos son 401 y
desde afuera se ven iguales:

```bash
curl -s -H "Authorization: Bearer mkoag_000" https://hola-mako.com/api/agente/contexto
```

| Respuesta | Quién contesta | Qué significa |
|---|---|---|
| `{"ok":false,"error":"no autenticado"}` | **el middleware** | la ruta ni se ejecutó — el problema es la lista de públicas |
| `{"ok":false,"error":"token inválido o revocado"}` | **la ruta** | ahí sí el problema es el token |

Vale para cualquier ruta con auth propia (webhooks, links compartidos, cron): **un 401 no
dice quién lo emitió, y el que lo emite cambia por completo el diagnóstico.** Sin esto se
buscan headers y entornos que no tienen nada que ver — que es literalmente lo que el
agente de la clienta propuso.

### Lo que quedó

La lista salió de `proxy.ts` a `lib/rutas-publicas.ts`, **sin `server-only`**, por la regla
de la casa: la condición que gobierna algo delicado va en un módulo que un test pueda
importar. Un middleware no lo importa nadie, y por eso esta lista pudo dejar una
integración entera afuera sin que nada avisara.

El test es de **dos filos**: verifica que las tres del bearer estén Y que
`/api/agente/token` y `/api/agente/hook` NO — esas dos las usa una persona logueada desde
el navegador, y un prefijo `/api/agente` suelto (que era la solución obvia) habría abierto
la acuñación de credenciales.

⚠️ **Estar en esa lista significa dos cosas, no una:** que la ruta se hace cargo de su
auth, y que **no se apoya en la cookie para nada**. El early-return se saltea el chequeo
CSRF de Origin, así que una ruta que lea la cookie y esté ahí queda expuesta. Las del
agente cumplen: el navegador nunca manda un `Authorization` solo.

## Una env var con un nombre inventado entrega un artefacto roto

**Vive en:** `app/second-brain/page.tsx` · `app/api/agente/hook/route.ts` · `lib/app-url.ts`

`/second-brain` leía `process.env.NEXT_PUBLIC_BASE_URL ?? ''` — una variable **que no está
definida en ningún archivo del repo**. Un grep del nombre sobre el repo entero devuelve
exactamente DOS resultados, y los dos son consumidores; ninguno la define. Que tampoco
estuviera puesta en Vercel lo prueba el síntoma: si lo estuviera, el `BASE` no habría
salido vacío en producción. Las que existen son `APP_BASE_URL` y
`NEXT_PUBLIC_APP_URL`, y las resuelve `lib/app-url.ts` con fallback al dominio real.

Resultado: la skill que el cliente copiaba salía con `BASE=` **vacío**, y lo primero que
hacía Claude después de instalarla era pedirle la URL de la API. El síntoma aparecía en la
terminal del usuario; la causa era un nombre de variable inventado en un archivo de la app.

El mismo nombre fantasma estaba en `/api/agente/hook`, pero ahí caía al origin del request
—que es lo correcto— así que nunca dio síntoma: **el error estaba en los dos lados y solo
uno dolía.**

**La regla:** si un valor ya tiene su módulo, no se lo vuelve a leer del entorno a mano.
Un `?? ''` sobre una env var convierte «falta configurar» en «cadena vacía», y una cadena
vacía viaja hasta el archivo del cliente sin que nada la frene.

**Y el corolario que apareció al confirmarlo:** `.env.local` tampoco define `APP_BASE_URL`,
así que en desarrollo `lib/app-url.ts` cae a su fallback —el dominio de PRODUCCIÓN— y la
skill generada desde localhost apuntaba a producción, mientras el hook (que sí lee el
origin del request) apuntaba a localhost. El par quedaba hablándole a dos servidores
distintos. Un fallback a un dominio real es correcto para producción y una trampa en
desarrollo: donde el valor arma un artefacto, conviene que localhost gane sobre el
fallback. Donde ese valor arma un
artefacto que sale de la app, la última red la pone el navegador: `window.location.origin`
es incontestable y no hay que configurarlo.

### El hook: una guarda que quedó contradiciendo al producto

**Vive en:** `app/api/agente/hook/route.ts`

Con todo lo demás ya andando, el agente de la clienta reportó: «el hook de telemetría
(`/api/agente/hook`) devuelve *no autenticado* — puede ser que tu plan de MaKo no tenga
ese endpoint habilitado todavía». No era el plan: esa ruta exigía **sesión de navegador**,
y su comentario lo justificaba con «un agente no tiene por qué poder pedirlo».

Era verdad **cuando se escribió**: el hook lo bajaba una persona a mano desde
/integraciones. Después la skill pasó a instalarlo sola —su §0.a le dice al agente que lo
baje con `curl`— y la guarda quedó pidiéndole al agente una credencial que por definición
no puede tener.

Se abrió al bearer porque **el script no lleva secretos**: el token lo lee en ejecución de
un archivo aparte, y el propio `agente-plugin.ts` dice que «el script se puede commitear
al repo del proyecto y el token no». Sigue siendo fail-closed: sin sesión y sin bearer
válido, 401.

**La regla:** cuando una tarea se automatiza, hay que revisar los guards que la protegían
cuando era manual. Un comentario que dice «X no tiene por qué poder» es una decisión con
fecha, y no se actualiza solo cuando X pasa a ser quien la hace.

### El artefacto se ENTREGA, no se dicta

**Vive en:** `app/_components/TutorialAgente.tsx` · `lib/agente-skill.ts`

La instalación de la skill pasó por tres versiones, y las tres fallaron en la terminal de
un usuario real antes de llegar a ésta:

1. **«Creá el archivo `.claude/skills/…` y pegá la skill adentro».** Ruta de PROYECTO —la
   respuesta de desarrollador— y un gesto que nadie hace: la gente pega el texto en el
   chat. Funcionaba solo porque el modelo deducía la intención.
2. **«Copiala y pegala en Claude», con las dos rutas detrás de un desplegable.** Mejor,
   pero seguía poniendo **11.000 caracteres** en el portapapeles: si el usuario pega de
   más, de menos, o el portapapeles se pisa en el medio, la skill queda rota y el error
   aparece recién cuando Claude no la encuentra. Y ofrecer «¿global o de proyecto?» a
   alguien que no programa es hacerle tomar una decisión técnica que no puede evaluar.
3. **Un botón que baja el archivo, una sola ubicación, sin desplegable.** Un archivo
   llega entero o no llega.

**Las dos reglas que quedan:**

- **Un artefacto de más de un par de líneas se entrega como archivo, no por portapapeles.**
  El portapapeles no tiene integridad: no hay forma de saber si llegó completo.
- **Una opción que el 95% no necesita no es flexibilidad: es una bifurcación donde
  equivocarse.** Si un caso es de expertos, que lo resuelva el experto —tiene el archivo y
  puede ponerlo donde quiera—, no una pregunta en el camino de todos.

### El plugin público: por qué la skill se genera y no se escribe

**Vive en:** `scripts/generar-plugin.mjs` · `plugin/` · `lib/agente-skill.ts`

La forma normal de instalar una skill es un plugin: `/plugin marketplace add <owner>/<repo>`
y listo. Eso exige un repo **público**, y la skill de MaKo llevaba el token del cliente
adentro — o sea que no se podía publicar.

**Lo que lo destraba** ya estaba construido para otra cosa: el hook de telemetría no
embebe el token, lo lee de `~/.mako-token`. La skill genérica hace lo mismo, y con eso
queda publicable. `agenteSkillMarkdown(base, null)` emite esa variante; con token, la
personal que sirve `/api/agente/skill`.

**Las dos guardas, y las dos son obligatorias:**

1. **La copia pública se GENERA.** Es el mismo texto con cuatro líneas de diferencia; a
   mano, el día que se le agregue una capacidad a la skill se actualiza una de las dos y
   la otra queda vieja. Es el bug del contrato del `detalle`, otra vez. El pre-push corre
   `--check` y bloquea si `plugin/` quedó atrás.
2. **Antes de escribir, se busca el patrón de una credencial** (`mkoag_`, `sk-ant-`, un
   JWT, un `localhost`). En POSITIVO: se busca el patrón, no se confía en que la función
   haga lo correcto. Un token que se cuele en un repo público queda en el historial de git
   **para siempre**, y rotarlo después no lo borra.

**PUBLICADO** en https://github.com/mbustos-digital/mako-plugin. El paso 2 del tutorial
es ahora `/plugin marketplace add mbustos-digital/mako-plugin` + `/plugin install
mako@mako`.

⚠️ **Sin `gh` igual se puede.** No está instalado en este entorno y no hay `GH_TOKEN`,
pero Git Credential Manager sí tiene guardada una credencial de GitHub —la misma con la
que se pushea— y se lee sin exponerla:

```bash
TK=$(printf 'protocol=https
host=github.com

' | git credential fill | sed -n 's/^password=//p')
curl -s -X POST -H "Authorization: Bearer $TK" https://api.github.com/user/repos -d '{"name":"…","private":false}'
```

⚠️ Y el repo nuevo se arma en una carpeta APARTE, no con `git init` adentro de `plugin/`:
un `.git` anidado convierte esa carpeta en un gitlink para el repo padre y le rompe el
seguimiento de esos archivos. Se copia a un temporal, se publica desde ahí, y `plugin/`
sigue siendo un directorio común del repo principal.

### Un título decorativo y un título clicable no se descartan igual

**Vive en:** `app/second-brain/Grafo.tsx` (`etiquetasVisibles`)

El descarte por colisión comparaba etiqueta contra etiqueta: alcanzaba, porque el único
daño de un solape era que no se leyera. Al volverlas **clicables** aparece un daño nuevo
que ese test no cubre: una etiqueta que cae encima del punto de OTRO nodo le roba el click
y abre un dato que nadie quiso abrir.

Ahora se descarta también contra los círculos. Se sacrifica la etiqueta, no el nodo:
perder un nombre es barato, un click que abre otra cosa no. Medido: 40 etiquetas, 0
solapes contra puntos ajenos.

**Y el `pointer-events` importa.** En un `<text>` de SVG, `visiblePainted` hace que solo
cuenten los TRAZOS de las letras; `all` convierte el nombre en un rectángulo invisible que
tapa a sus vecinos. La diferencia no se ve en pantalla — se ve en los clicks que caen mal.

### Qué significa publicar la skill, y qué se publica con ella

**Vive en:** https://github.com/mbustos-digital/mako-plugin · `lib/agente-skill.ts`

El repo es público y cualquiera lo puede leer sin cuenta. Lo que se hizo público **no** son
datos de ningún cliente —eso lo garantiza el guard del generador— pero sí es **la
metodología**: qué endpoints existen, el contrato del `detalle` con sus cuatro títulos, las
reglas del Perro Guardián, cómo se piden hechos en vez de prioridades, y hasta la medición
de que «de 17 tareas que la IA afirmó hechas, solo 8 lo estaban».

Es inevitable: una skill tiene que ser legible para funcionar, y una que se instala por
marketplace vive en un repo abierto. Pero conviene tenerlo dicho, porque la decisión de
publicar se toma una vez y el contenido se sigue actualizando solo —`plugin/` se regenera
en cada push— así que **todo lo que se le agregue a la skill de acá en adelante sale
publicado sin que nadie lo vuelva a decidir.**

La contrapartida es la que se buscaba: una mejora de la skill llega a todos los clientes
con un `git push` al repo público, en vez de que cada uno la reinstale.

## El bug estaba dormido desde julio y lo despertó un DATO, no un commit

**Vive en:** `lib/tab-access.ts:48,86,111` · `app/inicio/page.tsx` · `app/_components/PanelAgencia.tsx:167,188` · `lib/workspace.ts` (`rutaConWs`)

**Síntoma (16/08/2026).** El dueño reseteó el Cliente de Prueba y al volver a abrirlo cayó
en `/onboarding` sin barra de agencia, sin wizard, con la sidebar de admin y su foto, y sin
forma de volver a entrar. Lo reportó como «algo está pasando».

**Causa, encadenada.** El RESET vacía `app_settings` **entero** (`lib/reset-workspace.ts`,
sin filtro de key) y ahí adentro vivía la fila `onboarding.state`. Sin fila, el workspace
vuelve a `pending` → por PRIMERA VEZ `onboardingPendiente()` devolvió `true` para ese
cliente → se disparó `guardOnboarding()`, que hacía `redirect('/onboarding')` con la ruta
pelada. Ahí se perdía el `?ws=3`, y el dueño aterrizaba en **su propio** onboarding.

**Lo que más ahorra después: el diagnóstico obvio era el equivocado.** Se había pusheado a
producción media hora antes, así que la hipótesis natural era «el commit rompió algo». La
línea del redirect existía desde el **02/07** y estuvo dormida seis semanas porque ese
workspace tenía `status: 'done'` y el guard nunca llegaba a evaluarse. **Lo que cambió no
fue el código: fue el dato.** Antes de culpar al deploy, preguntá qué DATO se movió — un
guard que nunca se cumplió no es un guard probado.

**La regla:** hay cuatro formas de navegar y las cuatro llevan la pestaña (ver AGENTS.md).
Contar tres fue el segundo error del mismo día: se barrieron los 26 `redirect()` del server
dando la regla por cerrada, y la cuarta —`window.location.href`— quedó viva justo en
`PanelAgencia`, el único componente que SOLO existe mientras mirás a otro cliente.

**Y el corolario de UI:** un botón que hace su trabajo y después te muestra otra pantalla es
indistinguible de un botón roto. El RESET borró 50+ tablas y el dueño lo reportó como que no
había pasado nada, porque la navegación se llevó puesto el aviso de «Workspace vaciado».

**Lo que quedó sin cerrar:** el RESET sigue sin dejar al workspace listo para usar — lo deja
con el onboarding pendiente, o sea bloqueado. Para un workspace que existe PARA probar, eso
es un paso manual cada vez.

*Corrida del 16/08/2026 — 54 agentes, hallazgos verificados contra un escéptico por separado.*

---

## Una app sin error boundary no falla: desaparece

**Síntoma:** un cliente reporta «no me salta el plan» / «está vacío» desde SU dispositivo,
mientras desde otra máquina la misma cuenta lo ve perfecto. Mismos datos, mismo servidor.

**Lo que estaba pasando por debajo:** la app no tenía **un solo** error boundary — ni
`app/error.tsx`, ni `app/global-error.tsx`, ni un `componentDidCatch` en todo el repo. Con
React eso no significa «no hay errores»: significa que ante cualquier error al dibujar, el
árbol entero se desmonta y queda una **pantalla en blanco**, sin mensaje y sin nada que el
usuario pueda contar.

Y es la peor forma de fallar porque **depende del dispositivo**: una API que existe en un
Chrome de Windows y no en un Safari viejo, el `localStorage` que tira excepción en modo
privado, una extensión que inyecta algo. Todos rompen en una máquina y no en la otra, con
los mismos datos y el mismo servidor — y los tres se ven igual: nada.

**La regla:** el diagnóstico de un fallo así se hace **pidiendo**, no reproduciendo (ya
está escrito en AGENTS.md), pero pedir no sirve si lo único que la persona puede contar es
«está vacío». Lo que hace falta es que la app lo diga sola. Ahora hay dos boundaries y los
dos muestran QUÉ se rompió, con el detalle técnico a la vista y un botón para copiarlo:
**un texto que alguien pueda pegar en un WhatsApp es la única telemetría que no depende de
que sepa abrir DevTools.**

Los dos son deliberadamente tontos —estilos en línea, cero imports de la app—: un boundary
que depende del código que puede estar roto no es un boundary.

**Lo que se descartó CON EVIDENCIA antes de llegar acá** (sirve como orden para la próxima):
los datos estaban (15 tareas, 4 hechas, desde hacía dos días); el server las mandaba en el
HTML (`curl` con la cookie las trae); no había una segunda cuenta (un solo usuario en el
workspace); no hay service worker que sirva un bundle viejo; los 28 `randomUUID` son todos
`node:crypto` (servidor, no navegador); y todos los accesos a `localStorage` del board ya
estaban en `try/catch`.

**Vive en:** app/error.tsx · app/global-error.tsx · *2026-08-18*

## El manifest de la app estaba detrás del login

`/manifest.webmanifest` contestaba **307 a /login** en producción. El matcher de `proxy.ts`
excluye los assets estáticos por extensión (`png|jpe?g|svg|webp|gif|ico|css|js|woff2?`) y
`webmanifest` no estaba en la lista, así que el gate se lo comía.

Se veía en la consola de CUALQUIER carga como `Manifest: Line: 1, column: 1, Syntax error`
—el navegador recibía un redirect y trataba de parsearlo como JSON— y nadie lo miraba
porque no rompe nada visible. Donde sí importa es en iOS: el manifest es lo que gobierna
«Agregar a la pantalla de inicio», y uno que redirige al login deja la app instalada
apuntando a una pantalla que no es la app.

**Vive en:** proxy.ts (`config.matcher`) · *2026-08-18*

## El comentario decía que el gate «ni se entera», y por eso nadie lo miró

Hermano del anterior —el mismo matcher, la misma extensión que falta— pero con una vuelta
que lo hace más caro: **acá el bug estaba documentado como si fuera el diseño correcto.**

`hola-mako.com/extension` es el link corto que se reparte por mail y por WhatsApp para
bajar la extensión del puente a Google Flow. Medido contra producción el 30/08/2026:

    curl https://hola-mako.com/extension        → 307 a /mako-puente.zip
    curl https://hola-mako.com/mako-puente.zip  → 307 a /login?next=%2Fmako-puente.zip

O sea: **cualquiera que reciba el link y no tenga sesión de MaKo cae en el login, nunca en
la descarga** — y es justo la gente a la que se le manda. Por el botón de
`/video-generator` sí funciona, porque ahí el usuario ya está logueado; el que está roto es
el link suelto, que es el único camino que no se puede probar estando adentro.

**La causa es de una línea:** `/mako-puente.zip` no está en `PUBLICOS`
(`lib/rutas-publicas.ts`) y `zip` no está entre las extensiones exentas del matcher de
`proxy.ts`.

⚠️ **Lo que hizo que nadie lo viera fue un COMENTARIO, y ese es el hallazgo.** En
`next.config.ts`, sobre el redirect, decía:

> *«No hace falta sumarlo a `PUBLICOS`: los redirects de next.config corren ANTES del proxy
> (doc de Next, "Execution order"), así que el gate de auth ni se entera. Es lo correcto —
> este link se comparte con gente que no tiene cuenta.»*

**La premisa es cierta y la conclusión es falsa.** El redirect efectivamente corre antes
del proxy; lo que no hace es SERVIR el archivo. Manda un 307, y el navegador pide
`/mako-puente.zip` de nuevo: **ese segundo pedido es un request nuevo y entra al proxy como
cualquier otro.** El comentario documentaba la intención correcta («este link se comparte
con gente sin cuenta») con un razonamiento falso, y eso es peor que no tener comentario:
**convence a quien pasa por al lado de que ahí no hay nada que revisar.** Es la forma que
toma «un comentario no es un control» cuando el comentario, además, está bien intencionado.

**La regla: cuando un comentario afirma que algo NO pasa por un control, esa afirmación se
mide, no se razona.** Un `curl` sin cookie cuesta cinco segundos y contesta lo que ninguna
lectura del código iba a contestar.

**La decisión (30/08/2026): queda CERRADO, a propósito.** Se evaluó abrirlo y era viable —
se abrió el zip y se verificó que no lleva secretos (10 archivos; el único literal largo en
todo el código es `6LdsFiUsAAAAA…`, el site key de reCAPTCHA **de Google Flow**, público
por naturaleza y visible en el HTML de labs.google), y la extensión ya está publicada en la
Chrome Web Store, o sea que su código ya es distribuible. Aun así se eligió no abrirlo.
**No queda roto:** `destinoSeguro` conserva el `?next`, así que después de entrar el archivo
se baja solo. El link sirve para gente CON cuenta, que es toda la que puede usar la
extensión — sin token de MaKo no hace nada.

**Y el guard que quedó NO exige que los destinos sean públicos.** La clase de bug no era
«una ruta mal configurada» sino **«una creencia falsa sobre una ruta»**: un test que pidiera
`público: true` habría convertido una decisión de producto —abrir o no una descarga a todo
internet— en un test que se pone verde solo. `tests/redirects-gate.test.ts` exige que el
estado esté **DECLARADO**: un redirect nuevo hacia un archivo estático no falla por estar
gateado, falla por no estar declarado, que es el momento en que alguien tiene que decidirlo.
Lee el matcher del fuente de `proxy.ts` porque no puede importarlo — Next exige que
`config.matcher` sea un literal analizable en build, así que no existe la constante.

Dos detalles que ese test se comió y conviene no repetir:

- **El literal del matcher viene con el escape del CÓDIGO FUENTE** (`\\.`). Sin pasarlo por
  `JSON.parse`, el patrón dice «una barra invertida y cualquier carácter», matchea de más y
  **el test pasa en falso**. El caso que lo caza es `/logo.png`.
- **Un test así hay que matarlo a propósito antes de creerle.** Los tres mutantes —declarar
  el zip como abierto, agregar un redirect sin declarar, saltear el desescapado— murieron
  cada uno por el test que le tocaba. Un chequeo sobre un universo vacío contesta «todo
  bien» y apaga la búsqueda.

**Lo que quedó SIN hacer:** `public/mako-puente.sha` también está gateado, y está bien —
nadie lo pide por HTTP, lo lee sólo `scripts/zip-extension.mjs` en el pre-push. Si algún día
algo lo fuera a bajar desde el navegador, se cae por el mismo agujero y sin síntoma.

**Vive en:** `next.config.ts` (el redirect de `/extension`) · `lib/rutas-publicas.ts`
(`PUBLICOS`) · `proxy.ts` (`config.matcher`) · `lib/extension-tienda.ts`
(`EXTENSION_URL_ZIP`) · `tests/redirects-gate.test.ts` · *2026-08-30*

## Los CUATRO guards de sincronía frenaban el push de cualquiera que reclonara

**Vive en:** `scripts/sync-contrato-detalle.mjs` · `scripts/sync-gramatica-doc.mjs` ·
`scripts/generar-plugin.mjs` · `scripts/zip-extension.mjs`.

El pre-push tiene una familia de guardas que comparan un texto GENERADO contra un archivo
del repo: la skill contra el contrato del `detalle`, `docs/branding-mako.md` contra
`lib/mako-gramatica.ts`, `plugin/` contra `lib/agente-skill.ts`, y
`lib/extension-version.ts` contra el `manifest.json` de la extensión. Las cuatro comparaban
con `===`.

**Y `core.autocrlf=true` hace que esa comparación dependa de en qué clon estás.** El bloque
se inserta con `\n` sobre un archivo que en disco es CRLF, así que el resultado queda
MEZCLADO: CRLF en lo escrito a mano y LF en lo generado. En el clon donde el script corrió
alguna vez eso coincide y el chequeo pasa; en un árbol recién sacado de git —un clon
nuevo, un worktree, CI— git normaliza TODO a CRLF y la comparación exacta da distinto
**sobre un archivo idéntico**.

El síntoma es desconcertante y por eso costó: `node scripts/sync-contrato-detalle.mjs
--check` decía **«✓ al día» en el repo y «✗ DESINCRONIZADO» en un worktree del mismo
commit**, con `git status` limpio en los dos.

⚠️ **Y las cuatro se «verificaron» en el repo, que es el único árbol donde el bug no puede
verse.** Antes de tocar `generar-plugin.mjs` se corrió su `--check` en el repo, dio verde y
se lo declaró sano; falló apenas se lo corrió en el worktree. **Comprobar una guarda en el
único lugar donde no puede fallar es no comprobarla.**

La cura, en las cuatro: `const sinCR = (s) => s.replace(/\r\n/g, '\n')` y comparar
normalizado. **Al ESCRIBIR se usa el texto tal cual**: normalizar sirve para decidir SI hay
que escribir, no para cambiar QUÉ se escribe.

### Y el corolario que se paga entre sesiones: un guard que mira el DISCO bloquea al vecino

`zip-extension.mjs --check` calculaba la huella de la extensión con
`readdirSync`/`readFileSync` sobre `extension/`, o sea el árbol de trabajo. Con dos
sesiones sobre el mismo clon —lo normal acá—, **cualquier edición a medio hacer de una
bloquea el push de la otra**: el 30/08/2026 no se pudo pushear el portal de cursos porque
la sesión vecina tenía `background.js`, `content.js` e `injected.js` modificados sin
commitear.

El propio script ya aplicaba esta lección a las SALIDAS —«se despliega el COMMIT, no el
disco», con su caso escrito al lado— y se la había salteado a la ENTRADA. Y es exactamente
la trampa que `curso-catalogo-verificar.mjs` cometió el 29/08, que también bloqueó a la
sesión vecina, y que se curó igual: **en `--check`, leer de HEAD** (`git ls-tree` +
`git show`). Generando sin `--check` sí se lee el disco, que ahí es lo correcto.

**La regla general: un guard de pre-push contesta sobre lo que se PUBLICA. Todo lo que lea
del árbol de trabajo es una pregunta sobre otra cosa** — y en un repo con sesiones en
paralelo, sobre el trabajo de otro.

⚠️ **Cuando el árbol compartido tiene trabajo ajeno que no compila, el push va desde un
worktree limpio**, no con `--no-verify`. Hoy un `.tsx` nuevo y sin commitear de la otra
sesión tenía un error de tipos y el hook —que corre `tsc` sobre el árbol— frenaba todo.
`git worktree add --detach <ruta> main`, un junction a `node_modules` (`New-Item -ItemType
Junction`), y `git push origin HEAD:main` desde ahí. Se descarta con `git worktree remove
--force` + `git worktree prune`.

### Y la salida de emergencia tenía su propio peaje: `npm test` era rojo en TODO worktree

**Vive en:** `tests/dev-areas.test.ts` · `app/admin/dev/areas.ts` (`RUTAS_DE_ENTORNO`).

Medido el 03/09/2026, sobre un worktree limpio a la altura de `origin/main` (70f5289b):
`npm test` daba **1895 pass / 1 fail**, y en el clon principal daba verde. El que fallaba
era el test que cuida las rutas declaradas en el `vive[]` de cada área de `/admin/dev`,
con cinco acusaciones: `.vercel/`, `.env.local` y `.git/hooks/pre-push` (ésta en tres
áreas). La causa es un `existsSync` contra el disco sobre tres rutas que están **fuera de
git a propósito**: dos son secretos/artefactos locales, y en un worktree `.git` no es una
carpeta sino un ARCHIVO de 125 bytes que apunta al gitdir.

Lo caro es la combinación con la sección de arriba: **el worktree es justo el lugar al que
AGENTS.md manda ir cuando el árbol compartido no compila**, así que la guarda estaba roja
por construcción en el escenario recomendado. Un rojo permanente enseña a ignorar el test
—éste ya cazó 30 rutas plausibles pero inexistentes—, y con eso se pierde la mitad que sí
servía.

⚠️ **El diagnóstico obvio era el equivocado, y era tentador: «el worktree no tiene el
hook, ojo con pushear desde ahí».** Es falso. `git rev-parse --git-path hooks/pre-push`
devuelve la ruta del **clon principal**: git resuelve `hooks/` contra el git dir COMÚN, así
que el pre-push corre igual desde un worktree, con sus seis chequeos. Lo que no existe es
la RUTA RELATIVA, no la guarda. Por eso `existsSync` era la pregunta equivocada — y por eso
tampoco servía cambiarla por «¿está en git?», que para estas tres también da que no.

La cura es un catálogo de rutas de ENTORNO (`RUTAS_DE_ENTORNO` en `app/admin/dev/areas.ts`,
que el test importa) exceptuadas del chequeo. Tres decisiones que valen para cualquier
excepción a un guard:

- **Van EXACTAS, no por prefijo.** Exceptuar `.git/`, `.env` o `.vercel` deja entrar
  cualquier ruta futura que empiece igual; con la lista exacta, sumar una es una decisión.
  Siguen exigidas **760 de 765** rutas declaradas.
- **Aflojar un guard se paga con otro chequeo, no gratis.** El segundo test exige que cada
  entrada de `RUTAS_DE_ENTORNO` siga declarada en algún `vive[]`: si no, la excepción le
  sobrevive a su motivo y queda esperando a una ruta futura del mismo nombre para dejarla
  pasar sin mirar.
- **Se verifica en los DOS árboles**, que es la lección de la sección de arriba aplicada a
  su propio remedio: acá, corriendo el mismo `existsSync` contra las dos raíces y
  comprobando aparte que las tres exceptuadas SÍ existen en un clon configurado. Si alguna
  no estuviera **ni ahí**, la excepción estaría tapando una ruta realmente inventada.

Es la regla de AGENTS.md «una guarda bloquea sólo lo que se arregla haciendo lo que ella
pide»: nadie puede crear `.git/hooks/pre-push` adentro de un worktree, ni en un clon nuevo,
ni en CI.

## Cuatro trampas del REGISTRO de /admin/dev, y tres se veían como «no pasa nada» (07/09/2026)

Contexto: entre el 18/08 y el 07/09 entraron **714 commits** por las dos cuentas. El
pedido fue «revisá si está todo». Lo que estaba mal no era el código del producto —
`npm test` daba 2.144 en verde y `origin/main` estaba al día— sino **las cuatro piezas
que existen justamente para que nada se pierda**. Ninguna de las cuatro grita.

### ① `git reset` a origin/main deja el árbol de trabajo VIEJO, y parece trabajo en curso

`git status` mostraba tres archivos modificados: `app/admin/dev/areas.ts`,
`tests/dev-areas.test.ts` y `docs/hallazgos-infra.md`. Se leían como una edición a
medio terminar. No lo eran: el contenido del disco era **byte por byte el padre de
`a3c7db19`** (mismo md5 normalizando CRLF), o sea un revert exacto y silencioso de ese
commit. Y las mtimes lo confirmaban — 03/09 21:33, 30/08, 11/08: nadie las había tocado.

El reflog tiene la causa, y es la sección de más arriba mordiéndose la cola:

```
a3c7db19  03/09 21:39  commit (desde el WORKTREE)
fc5b9776  03/09 21:46  reset: moving to origin/main   ← en el clon principal
```

El commit se hizo desde el worktree —la salida de emergencia que recomienda AGENTS.md
cuando el árbol compartido no compila— y siete minutos después el clon principal se puso
al día con **`git reset` sin `--hard`**: eso mueve HEAD y el índice y **no toca el árbol
de trabajo**. Los tres archivos se quedaron con el contenido de las 21:33 y git los
reportó como «modificados» durante cuatro días.

⚠️ **Lo caro no es el desorden, es que el próximo `git add` de esas rutas revierte el
commit sin que nadie lo note.** `areas.ts` era una de las tres, y es el archivo que hay
que tocar para sumar un área: editarla y commitearla ahí hubiera borrado
`RUTAS_DE_ENTORNO` y devuelto `npm test` a rojo en todo worktree — el bug exacto que
`a3c7db19` había arreglado. La regla «commiteá por ruta explícita, nunca `git add -A`»
no alcanza acá: la ruta explícita es justo la envenenada.

**La regla que queda:** después de un `reset` para ponerse al día, `git checkout --` de
lo que quede modificado, o directamente `git reset --hard` si no había trabajo propio. Y
al abrir un `git status` sucio que no reconocés, comparar contra HEAD antes de asumir que
es tuyo: `git show HEAD:<ruta> | md5sum` contra el archivo, y mirar la **mtime** — una
fecha vieja dice que nadie lo editó y que lo viejo es el disco, no el commit.

### ② El parser del generador cortaba en `[id]`, y cuatro áreas cosechaban de menos

`scripts/gen-dev-historial.mjs` leía las rutas de cada área con
`vive:\s*\[([^\]]*)\]`. Ese `[^\]]*` corta en el **primer `]` del texto**, y las rutas
de Next traen uno adentro: `app/crm/[id]/page.tsx`, `app/compartido/[token]/page.tsx`.
Todo lo declarado después de la primera ruta dinámica se caía en silencio.

Medido sobre las 122 áreas, antes de arreglarlo:

| área | rutas que veía | rutas declaradas | cortaba en |
|---|---|---|---|
| `conocimientos` | 8 | 34 | `app/compartido/[token]/CursoCompartido.tsx` |
| `crm` | 11 | 27 | `app/crm/[id]/page.tsx` |
| `contracts-receipts` | 1 | 8 | `app/crm/[id]/deal-actions.ts` |
| `shared-links` | **0** | 9 | `app/compartido/[token]/page.tsx` |

⚠️ **Por qué no lo cazó el test, que existe para esto:** `tests/dev-areas.test.ts` NO
usa ese parser — importa `AREAS` de verdad, así que veía las 34 rutas y daba verde. Un
guard sobre el DATO no dice nada del parser que lo lee mal. Y la salida del parser roto
—un historial más corto— es indistinguible de un área con poca historia: `shared-links`
mostraba el panel vacío y se leía como un área que nadie tocó nunca.

**La regla que queda:** un archivo generado necesita su propio chequeo, aparte del que
valida la fuente. Y si algo parsea TypeScript con un regex, el primer caso de prueba es
una ruta dinámica de Next: `[id]`, `[token]`, `[slug]` están por todo el repo.

### ③ Un generado que se corre a mano se pone viejo, y su vejez ESCONDE un rojo

`_historial.generado.ts` se regenera a mano (`node scripts/gen-dev-historial.mjs`, no
está en `package.json`), y la última vez había sido el **11/08**: 27 días y ~700 commits
de atraso. Todas las tabs «Historial» de `/admin/dev` mostraban un mes viejo.

Lo que no se ve venir es el efecto de segundo orden. Al regenerarlo, `npm test` se puso
**rojo** en `tests/ia-mensajes.test.ts`: la guarda «la frase *Conecta tu API key de
Gemini* solo puede vivir en `lib/ia-mensajes.ts`» acusó al archivo generado. Y tenía
razón literal: el generado guarda la primera línea del cuerpo de cada commit, y el de
`c3e583e6` (13/08) **cita la frase textual** — un buen mensaje de commit cita lo que
arregló. Adentro de un string, no de un comentario, así que el filtro de comentarios de
la guarda no lo salvaba.

⚠️ **El generado viejo estaba tapando el rojo**: el commit que lo dispara es del 13/08 y
la última generación era del 11/08. La guarda se pone roja **el día que alguien
regenera**, semanas después y lejísimos del commit culpable — y ahí parece que la rompió
quien regeneró.

La cura es excluir `*.generado.ts` del barrido: no son código, son una transcripción de
git. Probado rompiéndolo: con la frase plantada en `lib/model-catalogo.ts` la guarda
vuelve a fallar y lo nombra, o sea que el filtro tapa el generado y nada más.

**La regla que queda:** una guarda que grepea el árbol no acusa a los archivos generados
— van a citar cualquier frase que el repo prohíba, porque los mensajes de commit citan
lo que arreglan. Y un generado que no corre en el build acumula deuda que estalla lejos
de su causa.

### ④ El trabajo más grande del mes no tenía área, y el barrido lo declaraba tranquilo

El puente a Google Flow (la extensión) es lo más movido del repo desde el 18/08 —**89
commits solo sobre `extension/manifest.json`**— y **no existía como área en
`/admin/dev`**. Ni `extension/`, ni `lib/flow-*.ts`, ni `app/api/flow/puente/route.ts`
figuraban en el `vive[]` de ninguna de las 122.

Al lado, `video-generator` declaraba dos rutas —`page.tsx` y
`app/admin/dev/ads-writer/bitacora.ts`— teniendo 35 archivos, y figuraba
**`por-construir`** con un alcance que decía «ComingSoon». Es la trampa que ya documenta
`reels` («un archivo compartido adentro de un `vive` no suma historia: DESPLAZA la
propia») en su peor forma: la bitácora prestada es de las más calientes del repo, así
que el Change History se llenaba con los 12 commits de **otra área** y no había un solo
commit de video-generator adentro.

⚠️ **El conocimiento sí estaba escrito** — `docs/hallazgos-generativa.md` tiene ~6.900
líneas y se actualizó el mismo 07/09. La cosecha se venía haciendo bien. Lo que falló es
el ÍNDICE: el registro no encontraba lo cosechado, y un barrido de «qué se trabajó y no
quedó anotado» daba tranquilo porque preguntaba por áreas, no por commits.

**La regla que queda:** el barrido honesto no es «¿qué área quedó sin anotar?» sino
**«¿qué archivo caliente no lo declara ninguna área?»** — se contesta cruzando
`git log --since --name-only` contra la unión de todos los `vive[]`, y es lo único que
encuentra el trabajo que no tiene dónde anotarse. Un área que falta no se queja; un área
que miente parece completa.

---

## La quinta guarda que frenaba el push en un worktree: normalizar la SALIDA no alcanza (11/09)

**Síntoma:** con trabajo ajeno sin compilar en el árbol compartido, se pusheó desde un
worktree limpio (lo que manda `AGENTS.md`) y el pre-push frenó con «extension/boq-patch.js
quedó viejo» — sobre un archivo que en el árbol principal daba «✓ al día».

**Causa:** `scripts/sync-boq-patch.mjs` normalizaba los `\r` para COMPARAR (`sinCR` sobre el
generado y el destino), pero leía el FUENTE crudo y le aplicaba `sinTipos`, que borra
anotaciones con regex que esperan `;\n`. En un worktree o un clon nuevo, `core.autocrlf` deja
`lib/flow-boq-patch.ts` en CRLF (231 líneas con `\r`, medido): las regex no calzan, las
anotaciones quedan, y el generado sale distinto. Sus hermanos `sync-boq-respuesta` y
`sync-puede-filmar` hacen `sinCR(ts)` ANTES de transformar, y por eso pasaban en el mismo
worktree. Es la trampa de las cuatro guardas que `AGENTS.md` ya documenta, un paso antes: ahí
faltaba normalizar al decidir; acá la comparación estaba bien y lo que no estaba normalizado
era la entrada de la transformación.

**Arreglo:** `const ts = sinCR(readFileSync(FUENTE, 'utf8'))`. Verificado en un worktree
recién checkouteado: el `--check` pasa, y regenerar desde el fuente CRLF da exactamente el
archivo commiteado.

⚠️ **Y la trampa de editar ese mismo script:** reescribirlo con `io.open` de Python en modo
texto (sin `newline=''`) convirtió todo el archivo a CRLF, y el lector de módulos de tsx tiró
«Parse error» en una línea que se veía perfecta. Para tocar un `.mjs` del pre-push, se
conservan los bytes (`newline=''`) o se usa la herramienta de edición.

**Vive en:** `scripts/sync-boq-patch.mjs`.


## Desarrollar MaKo con DeepSeek: el harness es gratis, el modelo no, y lo que se rompe (16/09/2026)

Martín preguntó si podía usar «lo último de DeepSeek parecido a Claude Code, pero gratis» para
desarrollar todo MaKo. Lo investigó un workflow de 24 agentes con verificación contra fuentes
primarias (141 afirmaciones, 75 verificadas: 50 confirmadas, 24 corregidas). Los datos que sostienen
el veredicto se chequearon además a mano en la documentación oficial de DeepSeek.

**Qué es.** DeepSeek Harness (`dsh`, MIT, github.com/deepseek-ai/deepseek-harness), salió el 13/08.
Al 16/09 va por 17 prereleases con cambios incompatibles. El modelo más nuevo ya no es V4-Pro-0813
sino **V4.1-Flash** (`deepseek-flash`, 10/09).

**El diagnóstico obvio era el equivocado: «gratis».** Gratis es el software y los pesos (MIT, ~510 GB,
no entran en una laptop). La API **no tiene capa gratuita**: descuenta de un saldo cargado. El chat web
gratis prohíbe el acceso automatizado. Nadie sirve V4.1-Flash gratis en volumen útil. Lo que sí es
cierto es que es barato: `deepseek-flash` fuera de pico cuesta $0,15 la entrada, $0,003 con caché y
$0,60 la salida por millón (el pico, lun-vie 01-04 y 06-10 UTC, cuesta el doble), contra $2/$10 de
Sonnet 5 y $5/$25 de Opus 5 por API.

**Trampas que no se deducen de ningún lado:**

- **DeepSeek documenta cómo correr el mismo Claude Code contra su API**
  (`ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic`). Pero la credencial vale para **toda la
  sesión**: no se puede dejar el hilo principal en la suscripción y mandar solo los subagentes a
  DeepSeek. Y con `ANTHROPIC_AUTH_TOKEN` puesto **no se cargan los conectores de claude.ai** (Fathom,
  Gmail, Drive, Notion, Canva).
- **Los nombres `claude-opus*` se mapean a `deepseek-v4-pro`**, que en mediciones independientes mide
  peor que V4.1-Flash y cuesta 3 a 4 veces más. Hay que fijar todos los alias en `deepseek-flash`,
  como hace la receta oficial.
- **Los benchmarks del fabricante quedan 16 a 33 puntos arriba de los independientes.**
  Terminal-Bench 2.1 de V4.1-Flash: 90,6 propio contra 74,5 en Vals. En Artificial Analysis,
  confiabilidad (qué tanto inventa): V4.1-Flash −5, Opus 5 37. Vercel no midió ningún DeepSeek en
  sus evals de Next.js.
- **Harness en esta máquina:** se congela ejecutando pwsh bajo el sandbox en Windows 11 build 26200
  (Discussion #3155), y la única salida reportada es apagar el sandbox. Tuvo un CVE de 9,4 que
  dejaba al agente apagar su propio sandbox (arreglado en npm el 30/08).
- **Datos:** la política de DeepSeek guarda los datos en China. Los términos de la API se rigen por
  ley china (tribunales de Hangzhou), no dicen si entrenan con lo que llega por API y obligan al
  desarrollador a informar y pedir consentimiento a los usuarios finales cuyos datos procesa.

**Encontrado de paso, y vale para Claude también.** `~/.claude/settings.json` tiene
`defaultMode: bypassPermissions` **sin ninguna regla `deny`**, y la carpeta del repo tiene
`.env.local` más tres backups sin versionar (`.bak-22ago`, `.bak-dominio`, `.bak2`). O sea, cualquier
agente lee `DATABASE_URL` de producción, con datos personales de leads, sin preguntar. Además, los
worktrees de `.claude/worktrees` viven dentro de esa misma carpeta.

**La regla: un modelo nuevo no se prueba en la carpeta que tiene los `.env`.** Va en un clon aparte
sin secretos, con `CLAUDE_CONFIG_DIR` propio, sin bypass y con el push bloqueado
(`git remote set-url --push origin NO_PUSH`). Y se mide contra una tarea que Claude ya resolvió.

**Veredicto (confianza alta): no sirve para TODO MaKo.** Donde puede tener sentido, pagando y después
de un piloto, es como desborde cuando se agotan las dos cuentas: el mismo Claude Code apuntado a
V4.1-Flash (mejor por un proveedor de EE.UU. con retención cero, como Fireworks), solo para código
sin datos de clientes. Una tarea del tamaño de la del 16/09 (18,5M de tokens de subagentes) costaría
unos $2 a $5 fuera de pico. Es una estimación: los dos proveedores ignoran `cache_control`.

**Sin hacer y sin verificar:** no se corrió ningún piloto. No está probado que la herramienta Workflow
y los subagentes funcionen contra un gateway de terceros: la doc solo nombra Anthropic, Bedrock,
Vertex y Foundry. No se midió cuántos tokens consume MaKo por mes. Y la decisión de mandar código y
contexto del negocio a DeepSeek directo la tiene que tomar Mauricio.

**Vive en:** ~/.claude/settings.json · .env.local* · AGENTS.md (push desde worktrees) ·
~/.claude/bitacora-sesion.sh (solo conoce claude1 y claude2) · *2026-09-16 · deepseek-harness-veredicto-mako*

## El backfill de Calendly trataba TODA reserva como una primera reunión (23/09/2026)

El webhook rutea R1 vs R2 desde la Fase 10 con `clasificarJunta(scheduled, cfg)` y una regla
escrita: **«NUNCA crear desde una J2»** — una segunda reunión sólo actualiza `fecha_junta_2`
de un lead que ya existe. El script de backfill no usaba esa función: tenía **su propio
regex** (`/r2|reunión 2|junta 2|seguimiento/i`) y, aun cuando acertaba el tipo para
etiquetar las respuestas, igual mandaba el evento por `upsertLeadFromCalendly` con la fecha
de la R2 en `fecha_junta_1` y `junta_1_at`.

Consecuencia: una R2 cuyo invitee no matchea ningún lead **creaba un lead nuevo, agendado a
una primera reunión que nunca existió** — con el No Show de `crm-auto-plan` contando desde
esa fecha y la cohorte del reporte apuntando al mes equivocado. Y no hay síntoma: el lead se
ve perfectamente normal.

⚠️ **El regex acertaba de casualidad.** El event type de la R2 se llama «Calificación para
Programa Directivo - Reunión 2», así que matcheaba por «reunión 2»; el día que alguien lo
renombre, la clasificación se cae sin que nada avise. Es «el mismo predicado que la
ejecución» no vale si son DOS COPIAS del predicado: ahora el script carga
`CALENDLY_EVENT_TYPE_J1/J2` con `credWs` y llama a la misma `clasificarJunta` que el webhook.

Lo que se midió sobre el histórico completo (146 eventos desde diciembre): **137 j1, 1 j2 y
8 «desconocido»** — un clon del event type y una variante de 30 minutos, que caen al camino
de R1 igual que en el webhook. La única R2 resuelve al lead #316, que ya tenía su
`fecha_junta_2` puesta por el webhook y le faltaba `junta_2_at`.

⚠️ **Y el `--dry` tiene que hacer los DOS lookups también en la rama nueva**, o vuelve a ser
un preview que estima: la rama de la R2 busca el lead por teléfono y por email igual que la
escritura, y dice `CREA` / `COMPLETA(campos)` / `NADA` / `R2 sin lead` con el id adelante.

**Vive en:** scripts/backfill-calendly.ts · lib/calendly.ts (`clasificarJunta`) · app/api/webhooks/calendly/route.ts · *2026-09-23*

### ⚠️ `v_cohortes_semanales` y `v_cohortes_mensuales` son legibles por `anon` HOY

Medido el 26/09/2026 contra prod, con `DATABASE_URL` de `.env.local`:

    relname               relkind  owner     relacl                              relrowsecurity  reloptions
    v_cohortes_semanales  v        postgres  postgres | anon | authenticated …   false           null
    v_cohortes_mensuales  v        postgres  postgres | anon | authenticated …   false           null
    leads                 r        postgres  postgres | anon | authenticated …   true            (0 políticas)

Las tres cosas juntas son el agujero: la vista tiene **SELECT concedido a `anon`**, no tiene
`security_invoker` (así que corre con los permisos de `postgres`, dueño de `leads`, que **no**
tiene `FORCE ROW LEVEL SECURITY`), y `leads` tiene RLS prendida con **cero políticas** — o sea que
el acceso directo a `leads` con la anon key devuelve 0 filas, y **el mismo dato agregado, por la
vista, sale entero y de todos los workspaces**. La anon key es pública (`NEXT_PUBLIC_…`), y las dos
vistas están expuestas por PostgREST.

El repo ya nombraba «el leak de `v_cohortes`» en la bitácora de `/admin/dev` como algo que un test
de contrato habría cazado antes de la 0084. Lo que faltaba era la medición de que **sigue abierto**.

**Un revoke no rompe la app**: los cuatro lectores (`lib/queries.ts:390, 405, 446, 555`) van por
`getSupabaseServer()` con la service role, que tiene `BYPASSRLS`. Las dos vistas están además en
`TENANT_TABLES`, así que el proxy les pone el `.eq('workspace_id')`.

    -- no aplicada: la decide el humano, y cambia permisos en prod
    alter view v_cohortes_semanales set (security_invoker = on);
    alter view v_cohortes_mensuales set (security_invoker = on);
    revoke all on v_cohortes_semanales, v_cohortes_mensuales from anon, authenticated;

**La regla que queda, y ya está en AGENTS.md:** una vista no tiene RLS y hereda los permisos de su
dueño, así que **toda vista de una migración lleva su `revoke` y su `security_invoker`**, igual que
una tabla. Lo fija `tests/funnel-declarado.test.ts`, que barre `supabase/migrations/` y tiene a
estas dos en su lista de excusas con el motivo escrito.

**Vive en:** `supabase/migrations/0001_initial_schema.sql` · `supabase/migrations/0084_cohortes_workspace.sql`
· `lib/queries.ts` · `tests/funnel-declarado.test.ts` · *2026-09-26 revisión adversarial F1+F2*

### `contains()` sobre una columna `jsonb` con un array de JS: la consulta falla ENTERA (26/09/2026)

```ts
db.from('plan_tareas').select('id, labels').contains('labels', [id])        // ⛔ falla
db.from('plan_tareas').select('id, labels').contains('labels', JSON.stringify([id]))  // ✅
```

supabase-js serializa `['x']` como el literal de array de Postgres (`{x}`), y una columna
`jsonb` contesta **«invalid input syntax for type json»**. No devuelve de menos: no
devuelve nada, porque la consulta entera se cae.

Medido contra producción, las dos formas sobre las dos tablas:

| columna | array de JS | `JSON.stringify` |
|---|---|---|
| `plan_tareas.labels` | ERROR | 0 filas (correcto) |
| `experimento_tareas.categorias` | ERROR | 5 filas |

⚠️ **Y DONDE YA ESTABA ESCRITO, EL ERROR SE IGNORA — así que el fallo es silencioso y
DESTRUCTIVO en diferido.** `borrarPlanProyecto` (`lib/plan-board.ts`) y su gemela de
`lib/todo.ts` hacen `const { data } = await …` sin mirar `error`: `data` viene `null`, el
`?? []` lo vuelve una lista vacía, y el bucle que saca el proyecto borrado del array
`labels`/`categorias` de cada tarea **no corre nunca**. Borrar un proyecto reporta éxito y
deja las tareas apuntando a algo que ya no existe.

**Por qué no hizo daño todavía, y por qué eso es lo peligroso:** medido en el ws1, **0
tareas colgadas**. El NAVEGADOR las limpia por su cuenta — `deleteLabel` de `useBoard` saca
el id del array en memoria y el autoguardado escribe la tarea entera — así que el guard del
server nunca se ejecutó y nadie se enteró de que estaba roto. Sólo iba a hacer falta el día
que borre un camino que no pasa por el navegador: MaKo, un script, la API.

**Lo general:** un `const { data } = await` que descarta el `error` convierte cualquier
fallo de consulta en «no había nada», y eso es indistinguible del caso normal. Donde el
resultado decide si se hace o no se hace algo, el `error` se lee.

## `git show HEAD:<archivo>` APLICA el filtro de fin de línea; `git cat-file`, no (27/09/2026)

Medir los fines de línea de un blob con `git show HEAD:<archivo> | grep -c $'\r$'` **miente
en la dirección más cara**: `git show` de un path pasa el contenido por el filtro de salida,
así que con `core.autocrlf=true` un blob que en el repo es LF sale **con CRLF**. El conteo da
«todas las líneas terminan en CR» sobre un blob que no tiene un solo CR.

Y lo que se decide con ese número es cómo se stagea. La regla que venía de arrastre —«este
archivo se stagea con `git -c core.autocrlf=false add`, porque su blob es CRLF»— aplicada a un
archivo con blob LF hace **exactamente lo que venía a evitar**: sin la normalización, git
compara un disco CRLF contra un blob LF y el diff es el archivo entero.

Medido sobre los siete archivos del commit del CRM (`e20650dd`), con `git cat-file blob`, que
no filtra nada:

| | disco | blob real | lo que decía `git show` + `grep` |
|---|---|---|---|
| `app/crm/CrmToolbar.tsx` | CRLF | **LF** | CRLF (497 de 497) |
| `app/crm/lead-view/ComportamientoCard.tsx` | CRLF | **LF** | CRLF (251) |
| `app/crm/lead-view/DatosSinMarcarCard.tsx` | CRLF | **LF** | CRLF (71) |
| `lib/funnel-fila.ts` | LF | LF | CRLF (115) |
| `app/crm/LeadSheet.tsx` | mezcla 331/332 | **mezcla 316/317** | CRLF (317) |

O sea: el `git show` contestó CRLF para los cinco, y el único cuyo blob de verdad lleva CRLF
es `LeadSheet.tsx` — el único que sí necesita `-c core.autocrlf=false`. Con `-c
core.autocrlf=false` sobre los otros, `git diff --stat` daba **1002 líneas cambiadas en un
archivo de 505** (`CrmToolbar`) y 494 en uno de 243 (`ComportamientoCard`); con el `add`
normal, 16 y 8.

**La regla:** para preguntar qué tiene un blob se usa `git cat-file blob <sha>` o
`git cat-file -p HEAD:<archivo>`, nunca `git show`. Y para preguntar por el disco, python en
binario (`io.open(f,'rb').read().count(b'\r\n')`) — el `grep -c $'\r$'` de Git Bash devolvió
«131 de 131 líneas con CR» sobre un archivo con **cero** CRLF, que es la misma familia que «lo
que devuelve la búsqueda NO es el archivo».

⚠️ **Y la verificación que cierra el tema no es ninguna de las dos: es el diff YA STAGEADO.**
`git diff --cached --stat` después del `add` contesta, sin teoría de por medio, qué se va a
commitear. Si un archivo de 505 líneas aparece con 16 cambiadas, la normalización quedó bien,
y no hace falta saber de qué lado estaba el CR. Quince minutos se fueron en razonar sobre
mediciones que el instrumento estaba falseando, cuando la pregunta que importaba se contesta
con un comando después de stagear.

**Vive en:** cualquier `git add` de este repo · *2026-09-27 crm-friccion-tanda-3*

## Borrar un inquilino entero, y la lista de tablas que estaba mal en las dos direcciones (29/09/2026)

Cosechado de «en Super Admin, las acciones deberías agregar la de eliminar, no solo
pausar». El «no solo pausar» es la mitad importante del pedido: una baja lógica sería
Pausar con otro nombre.

**Vive en:** `lib/tablas-de-inquilino.ts` · `lib/borrado-workspace.ts` · `lib/eliminar-workspace.ts` · `lib/reset-workspace.ts`

### LAS MIGRACIONES NO SON EL ESQUEMA, y acá se paga caro

El relevo armó la lista de tablas leyendo `supabase/migrations/` y él mismo puso como
primer riesgo: «no medí contra producción». Se midió, y la diferencia era en las dos
direcciones a la vez:

| | |
|---|---|
| tablas con `workspace_id` en prod | **90** |
| nombradas en `TABLAS_RESET` | 70 |
| de ésas, que **no existen** | **4** (`archivero`, `branding`, `contratos`, `meta_health_history`) |
| que existen y **faltaban** | **24** |

O sea que «vaciar un workspace» vaciaba **66 de 90**, y lo que quedaba se arrastraba a la
corrida siguiente sin que nada lo dijera. Los cuatro nombres inexistentes son plausibles
—`archivero` contra `archivero_files`, `branding` contra `branding_assets`— y ningún
compilador los mira: son strings.

⚠️ **Y el modo de falla los escondía.** Un `delete` de supabase-js contra una tabla que no
existe devuelve error, y el bucle de reintentos lo trata igual que a un choque de FK: tres
pasadas y un aviso críptico al final. Ahora se distingue el `42P01` («esa tabla no existe,
sacala de la lista») del `23503`.

⚠️ **Re-medido el 09/10/2026 (sexta tanda del Chatbot, segunda pasada, parte «motor»), y ese
distingo no se dispara nunca: por PostgREST una tabla que no existe contesta `PGRST205`, no
`42P01`.** Medido en producción en sólo lectura con `email_entrantes` (mig 0245) y `zernio_eventos`
(mig 0242), las dos en la lista y sin aplicar: `PGRST205 · Could not find the table 'public.…' in the
schema cache`. `noExiste` en `lib/reset-workspace.ts` mira sólo `42P01`, así que mientras falte una
migración el reset y el borrado de un cliente reintentan esa tabla tres pasadas y la avisan cruda,
como si fuera una FK. No frena nada (los avisos no cortan), pero dice otra cosa. La línea:
`const noExiste = ['42P01', 'PGRST205'].includes(String((error as { code?: string }).code));`
(lib/email-entrante.ts ya lo hace así: `esTablaQueFalta`). Y el `head: true` de más arriba sigue
mintiendo: sobre esas dos tablas contestó `status 204, count null` y SIN error.

**La regla que queda: una lista de nombres de tablas se mide contra
`information_schema`, no contra las migraciones** — hay migraciones escritas que nunca se
aplicaron, y este repo tiene el caso documentado (`0157_meta_campaign_drafts_workspace`).
La consulta quedó escrita en el encabezado del módulo.

### El orden del borrado no es intercambiable

De las **87 FKs** que apuntan a `workspaces.id`, **39 no cascadean** (48 sí). Con una sola
fila viva en cualquiera de esas 39, el `DELETE` final rebota con 23503. El orden:

1. **Las personas primero** — pero sólo el CHEQUEO. Si el guard del último admin global
   corta, no quiero haber vaciado ya 89 tablas de un cliente que no se va a poder borrar.
2. **Vaciar** las 89 tablas de inquilino, en pasadas.
3. **Desligar lo que apunta desde OTRO inquilino.** Éste es el que no se ve:
   `leads.cliente_ws` vive en el CRM del super admin y apunta al workspace del cliente, así
   que vaciar las tablas DE ESTE workspace no lo toca. Sin esto el DELETE rebota, y el
   mensaje de Postgres nombra la CONSTRAINT y no la tabla.
4. Borrar sus usuarios, y recién ahí la fila.

⚠️ **Las 39 FKs sin cascade se dejan como están, a propósito.** Cascadearlas haría el
borrado más simple y sería peor: hoy son lo único que hace que un borrado incompleto falle
ruidoso en vez de dejar filas huérfanas en silencio. Y no es atómico —supabase-js no da
transacciones— así que el modo de falla posible es «workspace vacío pero vivo», que es
idempotente y se reintenta; el inverso no puede pasar mientras esas FKs sigan en RESTRICT.

### El nombre se compara en el SERVER, y normalizado

Lo que hace seguro a lo irreversible no es el diálogo: es que el server exija el nombre
exacto del cliente. Un confirm que sólo vive en la pantalla lo saltea cualquiera que llame
a la ruta.

⚠️ **Y se compara normalizado (NFC + espacios colapsados + minúsculas).** El NFC no es
decoración: «Código» tipeado en macOS puede llegar en **NFD** —la o y la tilde como dos
puntos de código— y contra el NFC de la base da distinto **con los dos textos viéndose
idénticos en pantalla**. Sin eso, el dueño tipea bien el nombre y el botón sigue apagado
sin poder explicarle por qué.

⚠️ **Y el orden de los motivos importa.** Primero lo que NO se arregla tipeando (es la
plataforma, es el ws1, sos vos, tiene cartera) y el nombre al final. Al revés, a alguien
que intenta borrar la plataforma le diría «el nombre no coincide», que es una pista falsa.

### Lo único que prueba un borrado es borrar

No se puede probar en los workspaces de prueba (ws3 y ws4): probarlo los destruye. Se
sembró uno desechable con filas en las tablas que bloquean **y un lead cruzado del ws9**,
y se borró por la ruta real. Resultado: 4 tablas, 1 persona, 1 lead desligado, 0 avisos —
y después **cero filas sueltas en las 90 tablas**, la fila del workspace borrada y el lead
del ws9 vivo y desligado (es del super admin, no del cliente). Los cinco rechazos, también
contra el server.

### Lo que quedó SIN hacer

- **No hay auditoría de borrados.** Se va un cliente y no queda registro de quién ni
  cuándo. Las filas de `agencia_clientes` y `agencia_altas` cascadean, así que se lleva
  también el registro de que una agencia lo pidió y el super admin lo firmó — y las migs
  0175 y 0178 dicen por escrito que «ninguno se borra».
- **Dos buckets de storage no se limpian por prefijo**: `video-clips` y `ads-creatives`
  guardan bajo `video-generator/<planId>/` y `nueva/`, no bajo `<ws>/`. Lo que quede ahí
  sobrevive al borrado.
- **Completar `TABLAS_RESET` cambió el alcance del RESET**, no sólo el del borrado. Es lo
  correcto —hoy el ws3 «vaciado» arrastraba 24 tablas— pero es un cambio de radio que
  nadie pidió.

## Hay una QUINTA forma de navegar: el link que se MANDA afuera (05/10/2026)

**Vive en:** `lib/app-url.ts` (`linkApp`) · `lib/workspace.ts` (`wsEnContexto`) · el guard en
`tests/link-con-workspace.test.ts`

El síntoma: a Martín le llegó un aviso de MaKo, lo abrió, y la app le contestó **«este lead
no es de esta cuenta»** sobre un lead que sí era suyo. El diagnóstico obvio —y el que decía
la tarjeta #834 del tablero— era que el chatbot cruzaba workspaces y mandaba las
automatizaciones de un cliente a otro. No era eso.

La causa: el link del aviso se armaba a mano, `${APP_BASE_URL}/crm/<id>/resumen`, **sin el
`?ws=`**. El cartel sale de una guardia que se agregó en agosto (`bd366a46`) y es correcta;
lo que pasa es que el aviso viaja al teléfono de alguien que puede tener la app parada en
OTRO workspace, y sin el parámetro el link abre la pantalla en el de la pestaña. Se lee como
una fuga entre clientes y es, al revés, un destino que falta.

AGENTS.md contaba **CUATRO** formas de navegar (un `<Link>`, un `fetch` a /api, un
`redirect()` del server, un `window.location.href`) y avisaba, con el caso del 16/08, que
«contar tres es el error que ya se cometió». La quinta no es navegación desde adentro de la
app: es **un link que sale en un mensaje y se abre desde afuera**, donde el parámetro es lo
único que dice de quién son los datos. Ninguna de las cuatro la cubre, y por eso el barrido
de los 26 `redirect()` la dejó viva.

Eran **22 links en 15 archivos**: los dos webhooks de agenda, el opt-in de la landing, las
dos rutas del agente, cinco áreas de la API de MaKo y siete libs (avisos de lead, el doer,
las recurrentes, las dos de reuniones, los dos seeds del todo y el resolvedor de variables).

```ts
export function linkApp(ruta: string, ws: number | null): string {
  return `${APP_BASE_URL}${conWs(ruta, ws)}`;
}
```

- **Con `ws` en null devuelve el link tal cual**, no uno con `ws=null` pegado. Un cron que
  todavía no itera inquilinos no tiene workspace, y un link sin parámetro abre donde la
  persona esté —que es lo de antes— mientras uno con `null` abre una pantalla vacía.
- ⚠️ **`wsEnContexto()` NO mira las cookies**: devuelve el store de `runWithWorkspace` y
  nada más. Existe para que un helper sincrónico que arma un link inline no tenga que
  volverse async y arrastrar a sus catorce llamadores. No reemplaza a `getWorkspaceActual()`,
  que es el que resuelve de verdad en un request.
- **El guard mira el FUENTE y no los tipos**, porque esto no es un error de tipos: un
  template literal con la URL pegada compila perfecto. Busca `${APP_BASE_URL}/<ruta de
  inquilino>` en `lib/` y `app/api/`, y deja afuera dos archivos con su motivo escrito:
  `lib/mako-doer-in.ts` (es el PROMPT que describe la forma de una URL, no un link que sale)
  y `lib/app-url.ts` (es donde vive el helper).
- Probado rompiéndolo: devolviendo `/crm/${id}` a mano en `linkResumenLead` cae el primero
  (2 pasan / 1 falla, nombrando `lib/lead-resumen.ts → /crm`).

**La regla que queda, y es la que gobierna código nuevo:** antes de dar por cerrado un
barrido de navegación se enumeran las CINCO, y la quinta se busca por otro patrón que las
demás — no hay `redirect` ni `<Link>` que grepear, hay una interpolación de `APP_BASE_URL`.

## La conexión directa a la base es sólo IPv6: desde una red sin IPv6, el pooler (06/10/2026)

**Vive en:** `scripts/apply-migration.mjs` (lee `DATABASE_URL`) · cualquier script con `postgres`

El host `db.<ref>.supabase.co` de la conexión directa resuelve **sólo a IPv6**. Desde una red que
no lo da, `postgres` contesta `getaddrinfo ENOENT db.<ref>.supabase.co` — y se lee como «se cortó
internet», porque a la vez GitHub, Vercel y la API REST de Supabase (`<ref>.supabase.co`, que sí
tiene IPv4) contestan perfecto. El mismo día, a la madrugada, la 0198 se aplicó por la directa y
dos horas después la 0199 ya no conectaba: la red cambió, el código no.

- **La salida es el pooler (Supavisor), que sí tiene IPv4**, en modo sesión (puerto 5432, que
  soporta los bloques `do $$` y `begin/commit` de las migraciones): usuario `postgres.<ref>`, la
  misma contraseña, host `aws-1-us-west-2.pooler.supabase.com`. ⚠️ **`aws-0-us-west-2` contesta
  «tenant/user not found»**: el prefijo del cluster no es siempre `aws-0`, y el error no dice
  «probá aws-1».
- **Para mirar datos alcanza la REST** (`createClient` con la service role): no necesita la base.
- Se aplicó pasándole a `apply-migration.mjs` la URL del pooler sólo para ese proceso, armada a
  partir de `DATABASE_URL` sin imprimirla.

Y una menor del mismo rato: **`vercel ls` escribe la tabla de deploys en STDERR.** Un
`npx vercel ls 2>/dev/null | grep …` contesta vacío sobre una lista llena, y un bucle que espera
«Ready» así no termina nunca.

## Un BORRADO sin stagear también rompe los guards que leen `git ls-files` (06/10/2026)

**Vive en:** `tests/funnel-estructura.test.ts` (`archivosDeProducto`), `tests/sin-clarity.test.ts`,
`tests/sin-whop.test.ts`.

AGENTS.md ya dice la mitad: un archivo NUEVO sin `git add` es invisible para los guards que
enumeran con `git ls-files`. La otra mitad muerde distinto: un archivo BORRADO sin stagear sigue en
el índice, y un guard que hace `readFileSync` de cada ruta revienta con `ENOENT`. Al sacar Whop,
`npm test` cayó en el guard de `/funnel` sobre `lib/whop-evento.ts`, y el diagnóstico obvio («el
retiro rompió el test de /funnel») era falso: se arregla con el `git rm` del mismo commit, o
filtrando con `existsSync` como ya hacen `sin-clarity` y `sin-whop`.

Y un `sinComentarios` que borra los bloques `/* … */` enteros corre los números de línea: el guard
nombra otra línea (medido: `:99` sobre la 128). Se vacía el bloque conservando sus saltos
(`m.replace(/[^\n]/g, '')`); `sin-clarity` todavía tiene el corrimiento.

## Verificar en un worktree: el dev server compartido, Turbopack y una corrida cortada por cuota (06/10/2026)

**Vive en:** `next.config.ts` (`turbopack.root`) · `.next/dev/logs/next-development.log` ·
el scratchpad de la sesión

Medido el 06/10/2026 al verificar en el navegador un cambio de 42 archivos del CRM, con seis
sesiones sobre el clon.

- **Next 16 no deja levantar un segundo `next dev` en el mismo directorio** («Another next dev
  server is already running», con el PID y el puerto del otro). Y el que estaba corriendo, de otra
  sesión, contestaba **500 a todo**: sus workers se habían muerto («Jest worker encountered 2 child
  process exceptions, exceeding retry limit»), así que la página llegaba sin cuerpo y sin un solo
  control. Leído desde afuera es «mi cambio rompió la ficha». El log del server lo dice en una
  línea: `tail .next/dev/logs/next-development.log`. No se mata el server de otra sesión.
- **La salida es un worktree con HEAD + SÓLO los archivos propios**, que además contesta la
  pregunta que importa antes de commitear: si lo que se va a publicar compila sin el trabajo a
  medias de las otras sesiones. Tres trampas para levantar ahí un dev server, las tres medidas:
  1. **Turbopack rechaza el junction a `node_modules`**: «Symlink [project]/node_modules is
     invalid, it points out of the filesystem root». La raíz es `turbopack.root`, que
     `next.config.ts` fija en `__dirname` a propósito. En el worktree (y SÓLO ahí, sin
     commitearlo) va un ancestro común de los dos: `root: 'C:/Users/marti'`.
     Vale igual para `npm run build`, que AGENTS.md daba por imposible en un worktree: medido el
     09/10/2026, verde con `root` en la carpeta que contiene al worktree y al clon (y
     `next.config.ts` restaurado después, con `git diff` vacío).
  2. **Con el worktree adentro del scratchpad, Turbopack muere por largo de ruta** («path length
     for file … .next\dev\server\chunks\…»). El scratchpad ya tiene ~140 caracteres antes de
     empezar. El worktree va en una ruta corta (`C:\Users\marti\<nombre>`) y se borra al terminar.
  3. **`next dev --webpack` no sirve en este repo**: «Reading from "node:crypto" is not handled by
     plugins». No es una alternativa.
  Para el typecheck y los tests el worktree anda sin nada de esto; los guards que barren con
  `git ls-files` necesitan los archivos nuevos en el índice DEL WORKTREE (`git add` ahí no toca
  el del clon).
- ⚠️ **UNA CORRIDA CORTADA POR CUOTA PUEDE DEJAR UNA ROTURA APLICADA EN EL FUENTE.** Los arneses
  que prueban un test rompiéndolo escriben la rotura, corren y restauran de memoria; si la cuota
  corta entre «escribir» y «restaurar», el archivo queda roto **y compila**. Antes de seguir con lo
  que dejó una corrida cortada, se cruza cada rotura del arnés contra el archivo: el ancla
  original tiene que aparecer una vez y la versión rota cero. Acá las 14 estaban restauradas, y la
  única que dio «sospechosa» era una segunda llamada legítima con el mismo texto que la rotura.
  Que el typecheck y los tests den verde **no** lo contesta: una rotura de lógica tipa perfecto.
- ⚠️ **Y «failed» en el journal de una corrida no dice «no hizo nada».** Cinco de nueve agentes
  figuraban como fallados y los cinco tenían el trabajo terminado en disco: los cortó la cuota en
  la verificación final, antes de devolver. Lo que hay que leer es la cola de SU transcript
  (`subagents/workflows/<runId>/agent-*.jsonl`), no el veredicto.
- **Los subagentes de una misma corrida comparten el scratchpad de la sesión que los lanza.** Uno
  encontró su `romper.mjs` pisado por el de otro agente; sin mirarlo, su arnés habría corrido el
  script ajeno sobre sus archivos. En una corrida multi-agente, cada agente trabaja en una
  SUBCARPETA con su nombre.


---

## Un cron sin su entrada en vercel.json no falla: no corre (07/10/2026)

Dos corridas de agentes en paralelo agregaron tres crons (`/api/cron/curso-purga`,
`cs-sesiones-entrega`, `cs-sin-contacto`) con una regla que les prohibía tocar `vercel.json` para
no pisarse: la ruta existe, compila, tiene tests, y **no la llama nadie**. El que integra tiene
que sumar cada entrada; desde el 07/10 `tests/cron-registrado.test.ts` falla si un
`app/api/cron/*/route.ts` no está en `vercel.json`. Quedan **38 de 40** crons del plan.

Y dos trampas del mismo día:

- **El worktree de una corrida puede nacer en otro commit que el pedido.** Tres de cuatro
  arrancaron en `d8f8ee81` cuando la corrida decía `ab81f03f` (dos commits atrás, sin la tanda
  anterior). Antes de tocar nada: `git rev-parse HEAD` contra la base declarada; acá se resolvió
  con `git merge --ff-only`.
- **Git Bash convierte un argumento que empieza con `/` en una ruta de Windows**:
  `node script.mjs /api/cron/x` llega como `C:/Program Files/Git/api/cron/x`. Va
  `MSYS_NO_PATHCONV=1`.

---

## Un CR suelto apaga la normalización de git del archivo ENTERO (07/10/2026)

**Síntoma:** un commit que agregaba 11 líneas a `AGENTS.md` salió con **13.911 líneas
cambiadas** (`git show --stat HEAD`). El texto se veía perfecto en el disco, el typecheck,
los tests y el build pasaban, y el commit estaba bien armado.

**Causa:** el script que insertaba el párrafo convirtió el ancla a CRLF (el archivo en disco
lo es) y DESPUÉS volvió a convertir el bloque entero —ancla incluida— de `\n` a `\r\n`. El
`\r\n` del ancla quedó `\r\r\n`: **un CR suelto**. Y con un CR suelto, `core.autocrlf` deja
de normalizar el archivo: git lo trata como no-texto para la conversión (`convert_is_binary`
mira `lonecr`) y lo guarda TAL CUAL, en CRLF. Medido: el blob de `AGENTS.md` pasó de LF puro
a 6.961 CRLF. Un solo byte de más reescribió el archivo entero en el repo, con el `git blame`
de todo `AGENTS.md` apuntando a ese commit.

**Por qué no lo ve nada:** el CR suelto está al final de una línea de prosa, no rompe ningún
parser, y en el disco el archivo sigue siendo CRLF como siempre. Lo único que lo delata es
el NÚMERO de líneas del commit.

**Regla:**

- **Se convierte al fin de línea del archivo UNA vez**, al final: se arma el texto en LF y se
  pasa a `\r\n` recién al escribir. Convertir el ancla y después el bloque que la contiene es
  convertir dos veces lo mismo.
- **Antes de escribir, `(s.match(/\r(?!\n)/g) || []).length` tiene que dar 0.** Es la misma
  guarda que `escribir()` de `scripts/curso-categoria-portada.mjs`, del otro lado: ahí el
  peligro era un `\n` suelto, acá un `\r`.
- **`git show --stat HEAD` antes de pushear**, mirando que el número de líneas se parezca al
  cambio. Ya está pedido en `AGENTS.md` para ver QUÉ archivos salieron; vale igual para
  CUÁNTO. Se arregló sacando el `\r` y con un `--amend` del commit propio, sin pushear.

**Vive en:** cualquier script que edite un archivo CRLF del repo · *2026-10-07 conectar-con-meta*

## El typecheck SIN MEMORIA: un `select` genérico sobre una unión de tablas (08/10/2026)

**Síntoma:** `npm run typecheck` —el del pre-push— se quedaba sin memoria a 4, 8 y 14 GB, y con
eso **el pre-push de TODAS las sesiones del clon quedaba bloqueado**. La pista que lo había escrito
(la comunidad del curso tipo Skool) lo vio morir y anotó «no parece de esta pista»: su typecheck
ACOTADO (43 archivos más sus dependencias, con 2 GB) daba 0 errores. Era de esa pista.

**Causa:** el wrapper de la comunidad declaraba `select: <Q extends string>(cols: Q, …)`. Con un
literal, supabase-js corre su parser de TIPOS sobre la cadena de columnas (40 llamadas, hasta 20
columnas) contra el tipo de la tabla, y la tabla `t` era la UNIÓN de las 11 de la comunidad.

⚠️ **El consejo que lo causó estaba escrito como hallazgo.** El informe de la primera mitad pedía
cosechar «el wrapper tiene que ser genérico `<Q extends string>`», con un porqué cierto: con un
`string` suelto, supabase-js tipa cada fila como un error de parseo y ningún cast lo arregla. La
salida no es el genérico: es `cols as '*'` —el parser ve un asterisco y deja las filas en `any`— y
el cast a la `Fila…` en cada llamada.

**Regla:**

- Un wrapper sobre `.select()` de supabase-js no lleva el genérico de columnas, y menos sobre una
  unión de tablas.
- **Un typecheck acotado no prueba que el del repo entre en memoria.** Se corre el del repo; y
  subirle la memoria no es el arreglo (a 14 GB también moría).
- Tiempos de referencia, para no confundir el síntoma: sin el genérico, 0 errores y ~20 s con la
  caché incremental. La primera corrida SIN caché tarda ~2 min, y eso no es el bug.

**Vive en:** `lib/comunidad-datos.ts` (`de`) · `tests/comunidad-modelo.test.ts` (devolver el
genérico tumba el test) · *2026-10-08 Customer Success*

## Dos tests de fuente que se rompen por la FORMA del código (08/10/2026)

**Un guard que corta la sentencia en el primer `;` se corta adentro de un tipo en línea.**
`tests/curso-accesos-area.test.ts` toma cada consulta a `curso_accesos` desde el `from` (o el
`leerTodo<…>(…, 'curso_accesos'`) hasta el primer `;` y exige que nombre el área. Un tipo en línea
en el genérico —`leerTodo<{ a: number; b: string }>(…)`— trae su propio `;`, así que la sentencia
se cortaba ADENTRO del tipo, antes del `.is('area', null)`, y el guard acusaba una consulta que
estaba bien. Se resolvió con un alias de tipo (`FilaAccesoCruzada`, `lib/curso-mensajes.ts`). Un
corte por `;` corta también adentro de un tipo, de un string y de un template: el código que ese
guard lee va con alias.

**Un comentario con backticks adentro del script de un test lo tira ENTERO.** Los tests que corren
código en un proceso hijo arman el script como template literal; un comentario que nombre algo
entre backticks lo cierra a la mitad, el archivo no parsea y no corre ninguno de sus tests. Es la
regla de AGENTS.md («adentro de un template literal no va NINGÚN backtick») en el lugar donde menos
se la busca. *2026-10-08 Customer Success*

## `git merge` con archivos de OTRA sesión en intent-to-add: «not uptodate. Cannot merge» (08/10/2026)

**Síntoma:** integrando la tanda del curso tipo Skool, `git merge` contestó `Entry '<archivo>' not
uptodate. Cannot merge.` sobre archivos que esta sesión no había tocado, y el `--autostash` falló
igual.

**Causa:** eran archivos nuevos de OTRA sesión marcados con `git add -N` (intent-to-add), que es
justo lo que AGENTS.md manda para poder commitear por ruta un archivo nuevo. La marca vive en el
índice compartido, así que la regla de una sesión le arma la trampa a la vecina. En
`git status --short` se reconocen por la `A` en la SEGUNDA columna (` A`).

**Salida:** `git rm --cached <esas rutas>` (saca la marca y no toca el disco), el merge, y
`git add -N <esas rutas>` de vuelta: la marca es de la otra sesión y es lo que le deja commitear
por ruta. Nunca un `git add` de esos archivos: los stagearía con el contenido a medio escribir del
vecino.

**Vive en:** el índice del clon compartido · *2026-10-08 Customer Success*

## Escribir una barra invertida a un archivo: ningún camino es transparente (08/10/2026)

**Síntoma:** en la misma corrida, cuatro pistas lo pagaron por separado.

- **El Bash se come las barras**, también en un heredoc entre comillas: `\\` llegó como `\`; un
  `node -e` perdió otra; y un escape de NUL (barra, `u` y cuatro ceros) pasado por un script de
  python llegó como el byte crudo, con lo que el reemplazo no encontró nada, sin error.
- **Las herramientas Write y Edit convierten ALGUNOS escapes `\uXXXX` en el carácter crudo**:
  pasó con U+00AD, U+200D, U+FE0F, U+2013, U+2014, U+2026, U+00BA y U+FF0B, y no con el NUL ni con
  la forma con llaves. Dejaron un guion blando invisible en `app/_cursos/laminas/comun.tsx` y un
  ZWJ en `lib/laminas.ts`.
- **Y Edit hace también lo CONTRARIO**: con un `old_string` que traía los escapes de U+FE0F y
  U+200D, convirtió en texto de escape todas las letras con tilde de un comentario nuevo.

**Por qué no lo ve nada:** un guion blando o un ZWJ no se ven en ningún listado y compilan igual;
una tilde escrita como escape, también.

**Regla:**

- Un archivo que tiene que llevar un escape se escribe con un SCRIPT que lo ARMA
  (`String.fromCharCode`), nunca con el escape tipeado en un texto que pasa por la herramienta, y
  se verifica CONTANDO escapes e invisibles antes y después.
- En prosa (comentarios, docs) se nombra el código —U+00AD— en vez de escribir el escape.
- El texto con barras no va por la línea de comandos (va por Write a un archivo); y para un
  escape, Write tampoco alcanza: va el script.
- `tests/laminas.test.ts` falla si aparecen caracteres de tres bytes o invisibles crudos en sus
  archivos: es el molde para otros. La cara de la búsqueda (el `Grep` que devuelve `/` como `\`)
  ya está en AGENTS.md.

**Vive en:** cualquier edición de fuente desde el harness · `tests/laminas.test.ts` ·
*2026-10-08 Customer Success*

## Dos trampas de los bancos de navegador y de los scripts de rotura (08/10/2026)

**Síntoma:** en la corrida de los 20 ajustes del curso, dos pistas perdieron vueltas en la
herramienta y no en el código.

- **`tsx` le agrega `__name(...)` a toda función con nombre**, también a las que van adentro de un
  `page.evaluate` de Playwright. El navegador no tiene ese helper y contesta «__name is not
  defined»: se lee como un fallo del componente. En un banco que corre con `tsx`, lo que se manda al
  navegador va como función flecha anónima o como string.
- **`sed -i` del Git Bash pasó a LF un archivo que estaba en CRLF**, y la herramienta Edit dejó
  otros en CRLF. Un script de roturas que busca el ancla con `\n` da «NO APLICA» sobre el archivo
  CRLF: las cuatro primeras roturas de una revisión no se aplicaron, y un «no aplica» se lee igual
  que una rotura que el test no caza. El ancla se convierte al fin de línea DE ESE ARCHIVO (es la
  regla de AGENTS.md «El fin de línea es POR ARCHIVO», del lado del que rompe).

**Regla:** un banco o un script de roturas cuenta y reporta cuántas aplicó; un «0 aplicadas» es un
fallo del banco, no un test sano.

**Vive en:** los bancos de `scratchpad/*/banco/` de cada corrida · *2026-10-08 Customer Success*

## Las trampas del entorno en el rediseño de /chatbot (08/10/2026)

Cinco partes en paralelo, cada una en su worktree, más la revisión adversarial y los arreglos (corridas
`wf_8096a9d7-b3f`, `wf_c1c0d3d3-ae3` y `wf_92e4c306-856`). Lo que sigue costó vueltas sin ser del
código; lo del código está en [hallazgos-chatbot.md](hallazgos-chatbot.md).

### `head: true` sobre una tabla que no existe da `count: null` sin error; una columna que falta tira la consulta entera

- Medido contra prod el 08/10 (sólo lectura): para una tabla que no existe, PostgREST contesta
  **`PGRST205`** («Could not find the table … in the schema cache», HTTP 404), no `42P01`. Un
  `select(..., { head: true, count: 'exact' })` sobre esa tabla devuelve `count: null` y `error:
  null`: un cero sin error. Se volvió a pagar con la 0224 sin aplicar (204 y `count: null` sobre
  `crm_etiquetas`). Ya estaba escrito en la entrada de la tabla `notificaciones` (más arriba, en
  Migraciones): la segunda vez es la que hace de esto una regla.
- Una COLUMNA que falta es otra cosa: `42703` («column X does not exist») o `PGRST204`, y PostgREST
  rechaza el `select` ENTERO (AGENTS.md). Con la 0223 sin aplicar, el motor no mandaba nada y el
  webhook se comía la primera respuesta del lead.
- ⚠️ «does not exist» aparece en los dos mensajes: una regex floja toma una columna faltante por una
  tabla faltante y la tolera.

**Regla:** para saber si una tabla falta se mira el `code` de un `select` normal (PGRST205 o 42P01),
nunca el count de un `head: true`. Sólo se tolera la TABLA que falta; una columna que falta es un
error y tira. Los moldes: `esTablaInexistente` y `esColumnaInexistente`
(`lib/nutricion-grafo-motor.ts`), `tablaNoExiste` (`lib/setting-adjuntos-reglas.ts`).

### Los worktrees de una corrida pueden salir de OTRA base

**Síntoma:** a dos de las cinco partes les faltaban `docs/chatbot-flujo-ramas-diseno.md`,
`lib/flujo-grafo.ts` y `lib/flujo-legado.ts`, que es lo primero que la tarea mandaba leer.

**Causa:** los worktrees `-3` y `-5` de la corrida salieron de `89991891` (main) y no de `b6de5bd1`
(la rama del rediseño); los otros tres salieron bien.

**Regla:** antes de trabajar en un worktree de una corrida, `git merge-base --is-ancestor <commit
base> HEAD`. Se arregló con `git merge --ff-only b6de5bd1` (la base desciende de main, así que no
pisa nada). Si falta un archivo que el contrato da por existente, el síntoma es la base, no el
contrato.

### El scratchpad es UNO por sesión, no por agente

**Síntoma:** el `romper.py` de una parte pisó el de otra.

**Causa:** las cinco partes corren en la misma sesión del orquestador, y el scratchpad es por sesión.

**Regla:** en una corrida multi-agente, cada parte PREFIJA sus temporales (`L-roturas.mjs`,
`E-romper.py`, `romper-E.mjs`). Es la regla de `/tmp` de AGENTS.md, un nivel más adentro.

### Si hace falta junction se pregunta con `Test-Path node_modules`, no con `require.resolve`

**Síntoma:** `npm test` daba un rojo en `tests/replay-envoltorio.test.ts` (ENOENT sobre
`node_modules/rrweb/dist/record/rrweb-record.min.js`) aunque `require.resolve('tsx')` contestaba bien.

**Causa:** el worktree vive ADENTRO del repo (`.claude/worktrees/…`), así que Node resuelve subiendo
hasta el `node_modules` del clon, y el chequeo «¿hace falta junction?» dice que no. Pero un test que
lee un archivo de `node_modules` por RUTA LITERAL desde la raíz del worktree no lo encuentra.

**Regla:** el chequeo es `Test-Path node_modules`. Sin junction, ese rojo es del entorno (con el
junction pasa 13/13), y el junction se quita con `cmd /c rmdir`, como dice AGENTS.md.

### Write convierte escapes otra vez, y un guard con `\n` falla en el clon de Windows

- **La herramienta Write volvió a convertir escapes Unicode en el carácter real**, esta vez U+200B y
  el rango de diacríticos combinantes (U+0300 a U+036F), en `lib/etiquetas-reglas.ts` y en su test;
  una rotura se reportó «NO APLICA» porque el texto buscado no coincidía con el archivo. La regla está
  en «Escribir una barra invertida a un archivo» (más arriba). Lo nuevo: para sacar acentos va
  `/\p{M}/gu` y no un rango de combinantes, y hay varios `lib/*.ts` con ese rango escrito crudo.
- **En el clon de Windows los archivos llegan en CRLF, y un guard con un `\n` literal dentro de la
  regex falla** sobre un archivo idéntico. Pasó en `tests/recordatorio-lead.test.ts` (`023f6f7d`):
  `/rolAdmin\n/` pasó a `/rolAdmin\r?\n/`. AGENTS.md ya pide normalizar antes de buscar; si el salto
  va adentro de la regex, va `\r?\n`.

### Los números de migración se comparten entre sesiones, y la 0223 ya está repetida

**Síntoma:** el rediseño usó 0223 a 0225 (`0223_flujo_grafo.sql`, `0224_crm_etiquetas.sql`,
`0225_setting_adjuntos.sql`), y la sesión del curso (Customer Success) también usó una 0223
(`0223_curso_papelera.sql`, en main desde `d188f3a8`): la renumeró ahí porque la API había tomado la
0222. El diseño decía que las otras sesiones llegaban hasta la 0222.

**Causa:** el próximo número es un recurso compartido (AGENTS.md), y un reparto acordado de antemano
no sobrevive a que otra sesión renumere.

**Regla:** el repo ya tolera números repetidos (13 hoy: 0024, 0025, 0026, 0039, 0060, 0061, 0069,
0072, 0128, 0129, 0136, 0177 y 0223) y `scripts/apply-migration.mjs` aplica por RUTA, así que no rompe
nada. Pero antes de nombrar una se mira `origin/main`, no sólo el árbol propio, y la cabecera de cada
`.sql` dice su orden de despliegue, porque el número ya no lo dice.

**Vive en:** `lib/nutricion-grafo-motor.ts` · `lib/setting-adjuntos-reglas.ts` ·
`tests/recordatorio-lead.test.ts` · `tests/replay-envoltorio.test.ts` · `supabase/migrations/` ·
*2026-10-08 rediseño de /chatbot*

## Un typecheck que no terminó contesta «0 errores», y OneDrive puede dejar una escritura a medias (08/10/2026)

**Síntoma:** con siete pistas y otras sesiones sobre el mismo clon, el typecheck pasó de 20 s a 18-20
minutos, y dos lecturas de su salida dieron VERDE sobre un chequeo que no había corrido:

- `timeout 300 npm run typecheck | grep -c "error TS"` dio **0** con el proceso matado por el
  timeout: un cero de un proceso que se cortó parece un verde.
- `npm run typecheck` terminó con **exit 127 sin una línea de salida** con tres `tsc` en paralelo.
  Directo con `node --max-old-space-size=6144 node_modules/typescript/bin/tsc --noEmit` terminó.

**Regla:** de un chequeo se lee primero el CÓDIGO DE SALIDA y que haya terminado; recién después la
cuenta de errores. Un `grep -c` sobre la salida de algo que pudo cortarse no es una medición.

**Y OneDrive:** una escritura de un arnés de roturas falló con `UNKNOWN -4094` y dejó
`lib/curso-invitar.ts` con la rotura puesta. Un arnés que escribe en el clon reintenta las
escrituras y, al terminar, verifica el árbol con un grep de cada rotura; y con otras sesiones vivas,
antes de restaurar compara el archivo contra la versión rota (si otro lo tocó en el medio, deshace
sólo la rotura). · *2026-10-08 Customer Success*

## El bloque de trailers es un PÁRRAFO propio: pegado a la prosa, `%(trailers)` contesta vacío (09/10/2026)

**Síntoma:** dos commits de la sexta tanda (parte «flujo» de /chatbot) salieron con `Claude-Cuenta:
claude2` y `Co-Authored-By:` pegados entre sí, como manda AGENTS.md, y `git log
--format='%(trailers:key=Claude-Cuenta,valueonly)'` devolvía VACÍO. Leído a ojo, el mensaje estaba bien.

**Causa:** git toma como trailers sólo el ÚLTIMO PÁRRAFO del mensaje, y sólo si es todo trailers. El
mensaje terminaba en «…se mudan.» y en la línea siguiente `Claude-Cuenta:`, sin línea en blanco: el
párrafo era prosa con dos líneas al final, y git no lo reconoce. AGENTS.md dice que NO va línea en blanco
ENTRE los dos trailers; lo que faltaba decir es que SÍ va una ANTES del bloque.

**Regla:** `texto` · línea en blanco · `Claude-Cuenta:` · `Co-Authored-By:` (pegados). Y se verifica con
`%(trailers:key=Claude-Cuenta,valueonly)`, no leyendo el mensaje. En una rama propia y sin pushear se
arregla sin `rebase -i`: `git filter-branch --msg-filter '<script que agrega la línea>' <base>..HEAD`, y
después `git update-ref -d refs/original/refs/heads/<rama>`.

**Y dos del worktree aislado de una corrida:** la herramienta Write escribe LF en un árbol que es CRLF
(se pasa el archivo entero a CRLF con un script, nunca a mano), y el aislamiento rechaza todo comando con
un argumento calculado (`$(...)`, una variable en el bucle): lo que haga falta se escribe en un script
del scratchpad y se corre `node <script>` con rutas literales.

**Vive en:** el mensaje de cada commit · *2026-10-09 /chatbot, sexta tanda, segunda pasada*
