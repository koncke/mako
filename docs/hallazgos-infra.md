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
- La tabla `notificaciones` **no existe en producción** desde siempre y el escritor se traga el error → [Migraciones](#migraciones).
- Hay features **terminadas, con migración y API propias, que ninguna página monta**: compilan y no existen → [Código construido que ninguna página monta](#código-construido-que-ninguna-página-monta).
- Si Claude Code «se cierra solo» y la PC sigue andando, es el **proceso GPU** muriendo por la gráfica híbrida — y los tres diagnósticos obvios (memoria, energía, drivers) estaban los tres equivocados → [El equipo](#el-equipo-cuando-se-cierra-claude-code-y-no-es-claude-code).

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

### ⚠️ El typecheck NO corre en el build: lo sostiene un hook que no se versiona

`next build` tiene `typescript.ignoreBuildErrors: true` (`next.config.ts`). **No es descuido:**
ese paso eran ~65 de los ~99 segundos de cada compilación, y en Vercel se factura como Build CPU
— 109 horas en una sola semana, el 95 % del gasto variable de la cuenta. El mismo chequeo corre
local en ~7 segundos y gratis.

La red de seguridad se movió a `.git/hooks/pre-push`, que corre `npm run typecheck` **y** el
contrato del `detalle` de las skills (`node scripts/sync-contrato-detalle.mjs --check`), y bloquea
el push si algo falla. **Los hooks de git no se versionan:** si se reclona el repo, el hook
desaparece **en silencio** y un error de tipos vuelve a llegar a producción. El contenido para
recrearlo (con los **dos** chequeos) está en `AGENTS.md`.

Reglas: nunca `git push --no-verify`; si tocaste rutas nuevas, corré `npm run build` una vez antes
de pushear (el hook usa `tsc --noEmit`, que solo valida los tipos generados de rutas si
`.next/types` está fresco); y **cada push cuesta ~US$0,09** en build — agrupá commits.

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

## Tests y entorno local

### Las trampas del runner

| Trampa | Dónde | Qué hacer |
|---|---|---|
| **`server-only` tira al importarse desde el runner de tests** | `lib/etapa-historial.ts` y cía. | Parchear `Module._load` antes del `import()` dinámico (funciona porque tsx compila los tests a CJS) |
| **Los guards de texto leen de más en Windows** | `tests/*.test.ts` | Normalizar CRLF: sin eso el corte por `'\n}\n'` no encuentra el fin de la función. Costó un falso positivo |
| **`node --test` corre cada archivo en su propio proceso** | ídem | Se aprovecha a favor: para un ciclo de imports, un test importa A primero y otro importa B primero, y así quedan cubiertos los dos órdenes de carga |
| **tsx NO resuelve el alias `@/`** | ídem | Los tests usan imports relativos |
| **El typecheck no corre en el build** | `.git/hooks/pre-push` | Ver [Build, deploy y entrega](#build-deploy-y-entrega) |

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

## Sesiones paralelas y las dos cuentas

Hay **dos cuentas** de Claude Code sobre este mismo clon (`claude1`/`claude2` en el `$PROFILE`),
con cuotas desfasadas: una corre miércoles a viernes, la otra sábado a martes. En principio no
coinciden, pero pueden.

- **El typecheck rompe por archivos que no son tuyos.** Durante estas corridas aparecieron y desaparecieron `TS2552: Cannot find name 'Stage'`, `'Opcion'`, y refactors a medio terminar. **El verde se toma con el árbol estable**, y lo ajeno se reporta, no se "arregla".
- **Antes de tocar nada, `git status`.** Si hay archivos modificados que no son tuyos, dejalos donde están.
- **Verificá contra el código, no contra el resumen del agente anterior.** Un agente reportó como "arreglado" algo que otro seguía editando, y dos reportes se contradecían sobre el mismo archivo.
- **La deferencia colectiva deja el doc mintiendo.** Cuatro reportes seguidos anunciaron "esta fila del doc quedó obsoleta, no la toqué porque hay otra sesión en el árbol". Los cuatro dijeron lo mismo y **ninguno la tocó**: para quien leyera el documento al día siguiente, cinco frentes cerrados seguían abiertos. Un `.md` no es código: el conflicto se resuelve leyendo. **Si sos el que cierra, cerrá también el documento.**
- **La sesión que cierra deja escrito dónde quedó** — en `docs/hallazgos-<área>.md`, en el board `/plan` o en una memoria. Si la cuota corta a mitad de camino, eso es lo único que sobrevive.

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

---

## El equipo: cuando se cierra Claude Code y no es Claude Code

### ⚠️ «Se cierra solo» = crash del proceso GPU por la gráfica híbrida, no un bug de la app

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

**Vive en:** `%APPDATA%\Claude\logs\main.log` (buscar `GPU process gone`) ·
`HKCU:\SOFTWARE\Microsoft\DirectX\UserGpuPreferences` · *2026-08-09*

### Regla: antes de culpar a la app, mirá SU log — está en el disco y dice la causa

Las tres teorías equivocadas de arriba salieron de mirar el sistema (memoria, energía,
drivers) en vez del log de la aplicación. `main.log` tenía la línea exacta desde el primer
minuto. El orden correcto es: **log de la app → evento de Windows que lo corrobore →
reproducción medida**. Y si el log de la app dice `session ending`, eso es Windows
avisando; si NO lo dice y falta `onQuitCleanup`, el proceso murió — son dos causas
distintas y se confunden fácil.

**Vive en:** *2026-08-09*
