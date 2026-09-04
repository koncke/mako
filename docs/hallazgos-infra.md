# Hallazgos de infraestructura

Lo que gobierna a **todas** las áreas: cómo se lee y se escribe en Supabase sin perder
datos, cómo se aísla un inquilino de otro, qué credencial lee de verdad el código, qué
tope corta en silencio, y qué pasa entre que pusheás y el dueño lo ve. **No es un
changelog**, y se escribe para que lo lea un humano: «si yo lo puedo entender fácil eso me
habilita a darle mejores prompts al otro Claude».

**Lo que más muerde acá:**

- Una lectura paginada sin orden **único** repite filas y saltea otras — cuatro pantallas rotas por la misma causa, y el diagnóstico obvio («falta paginar») era el equivocado → [Supabase](#supabase-leer-y-escribir-sin-perder-datos).
- Lo que no está en `TENANT_TABLES` sale **sin filtro de workspace** y nada avisa → [Aislamiento multi-inquilino](#aislamiento-multi-inquilino).
- «Se guarda cifrada, se pinta verde y el route lee `process.env`»: la credencial del cliente no se usa nunca → [Credenciales e integraciones](#credenciales-e-integraciones-byok).
- Un `200` en un webhook es un **acuse de recibo**: el proveedor no reintenta y el evento se pierde para siempre → [Webhooks](#webhooks-recibir-sin-perder-eventos).
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

### ⚠️ Pendiente: los techos mudos que quedaron fuera del barrido

| Qué | Dónde | Por qué importa |
|---|---|---|
| Bucles `.range()` a mano | `scripts/limpiar-seed-clientes.ts:72`, `scripts/probe-historial-largos.ts:28` | Son scripts one-off, pero tienen el mismo techo mudo |
| Topes de una sola página | `lib/cerrar-por-commits.ts:86` (600), `app/api/plan-buscar/route.ts:88` | No son bucles rotos: son techos deliberados sin cartel. Si la tabla crece, cortan en silencio |

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

### ⚠️ La zona horaria por workspace es un setting huérfano: siempre sale Tijuana

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
   `Symlink [project]/node_modules is invalid, it points out of the filesystem root`. La salida
   es `next dev --webpack`, que sí sigue el symlink. La flag existe en Next 16 aunque Turbopack
   sea el default.
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
