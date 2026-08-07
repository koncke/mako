# Hallazgos de infraestructura

Lo que gobierna a **todas** las áreas: cómo se lee de Supabase sin perder filas, cómo se
manejan las zonas horarias, las trampas del runner de tests y cómo trabajar con varias
sesiones en el mismo árbol. **No es un changelog.**

Origen: corridas multi-agente de 08/2026. Regla de la cosecha en `AGENTS.md`.

---

## 1. Paginado: leer una tabla entera sin perder filas

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

**Dónde:** `lib/supabase-paginado.ts` — `leerTodo()` y `leerPorPaginas()`. El orden por
defecto es `'id'`; `orden` acepta una lista (`[{col:'fecha',asc:false},{col:'id'}]`) justo
para desempatar.

**Regla:** el orden de un bucle paginado tiene que ser **único**. Si la columna natural
se repite, se desempata por la PK en el mismo `orden`. Y `.limit()` **no** sube el techo
de 1000 filas del servidor: no es un límite del cliente.

### `leerTodo` vs `leerPorPaginas`: cuándo materializar

`leerTodo` junta todo en un array. Está bien para tablas chicas, y mal cuando de cada
fila sobrevive un contador: un año de 200 anuncios son ~73.000 filas de
`marketing_metrics_daily` para terminar con un `Map` de 200 claves. `leerPorPaginas`
entrega la página y la tira.

El callback devolviendo `false` corta el barrido. **Esa es la única forma legítima de
truncar**, y el punto es que queda **a la vista en el call-site** (`return nro < TOPE`)
en vez de escondida en el `desde < 20000` de un `for` que nadie lee.

### Un tope nuevo es un truncado nuevo

**Síntoma:** el análisis de una landing viva pasó a decir "sin datos de comportamiento" y
el importador de contactos dejó de importar. Nada en el log decía "se cortó".

**Causa:** unificar seis bucles `.range()` en el helper trajo un `MAX_PAGINAS = 100`
(100k filas) que **tres de los seis no tenían**: `indiceContactos` paginaba hasta 200k a
mano, y `landing_visits` / `marketing_metrics_daily` no tenían techo. El `throw` del tope
cae en el `catch` que esos callers ya tenían para degradar —`catch { return vacio; }`— y
ahí un error se lee como "no hay nada".

**Dónde:** `MAX_PAGINAS = 1000` + la opción `maxPaginas` por llamada
(`lib/supabase-paginado.ts:68`). Es un **cinturón** contra un bucle que no converge, no un
límite de producto: tiene que quedar por encima de la lectura legítima más grande de
cualquier caller.

**Regla:** cuando un helper absorbe N copias, **su límite más restrictivo se lo come todo
el mundo**. Antes de unificar, comparar los topes de las N copias, no solo su lógica.

### Romper fuerte río arriba con un `catch` río abajo es un falso all-clear

Corolario del anterior y la trampa más cara de las tres, porque **no parece un error**:
una lectura que pasa a lanzar, más un `.catch(() => [])` río abajo, convierte "se rompió"
en "no hay nada", que son cosas opuestas. Pasó en el worklist del CRM (el ✓ verde "todo
marcado" con la lista incompleta, ver
[hallazgos-crm.md](hallazgos-crm.md) §3) y en el análisis de landings
([hallazgos-landing.md](hallazgos-landing.md)).

**Regla:** si una lectura pasa a lanzar, seguí la excepción **hasta la pantalla**. La
decisión de degradar se toma por dato ("esto es accesorio") y se muestra ("lista
parcial"), nunca por omisión.

---

## 2. Zonas horarias

### Display se migra; una clave persistida, no

**Dónde está el corte:** `lib/calendly.ts:167` (`isoToFechaTijuana`). No es display: es la
**clave de cohorte** que se persiste (`fecha_agenda`, `fecha_junta_1/2`, la fecha de la
llamada en closing) y la escriben cuatro módulos. Sus **lectores** calculan "hoy" con
`hoyEnTijuana()` en `crm-auto`, `leads`, `reportes`, `experimentos` y `app/crm/actions.ts`.

Migrar solo la escritura desfasa los bordes del día: una R1 agendada para hoy dejaría de
contar como de hoy y el No Show automático se dispararía un día corrido.

**Regla:** **escritura y lectura de una clave de fecha se migran en el mismo commit o no
se migran.** Mientras tanto no se pierde precisión: `junta_1_at` guarda el instante ISO
exacto, que es lo que usa el motor.

El literal de `isoToFechaTijuana` quedó **crudo a propósito**, sin `TZ_TIJUANA`: si algún
día cambia la zona por defecto del producto, el ancla de las cohortes ya escritas **no**
debe seguirla.

### Comparar dos fechas de zonas distintas es el bug, no el hardcode

`cancelarJuntaEnLead(lead, fechaCancelada, hoyEnTijuana())`
(`app/api/webhooks/calendly/route.ts`): los dos argumentos **se comparan entre sí**.
Migrar uno solo "para sacar el hardcode" es peor que dejar los dos. Quedaron juntos en TJ
y comentado.

### El literal de la zona por defecto vive en un módulo sin `server-only`

`lib/timezone.ts` es `server-only`, así que un componente de cliente no puede leer de ahí
el fallback. En vez de duplicar el string, `TZ_TIJUANA` se exporta desde
`lib/date-utils.ts` (que a propósito **no** es server-only) y `lib/timezone.ts` hace
`TZ_DEFAULT = TZ_TIJUANA`. Una cosa, un lugar: el segundo literal es el que se queda viejo.

---

## 3. Tests y entorno

| Trampa | Dónde | Qué hacer |
|---|---|---|
| **`server-only` tira al importarse desde el runner de tests** | `lib/etapa-historial.ts` y cía. | Parchear `Module._load` antes del `import()` dinámico (funciona porque tsx compila los tests a CJS). |
| **Los guards de texto leen de más en Windows** | `tests/*.test.ts` | Normalizar CRLF: sin eso el corte por `'\n}\n'` no encuentra el fin de la función. Costó un falso positivo. |
| **`node --test` corre cada archivo en su propio proceso** | ídem | Se aprovecha a favor: para un ciclo de imports, un test importa A primero y otro importa B primero, y así quedan cubiertos los dos órdenes de carga. |
| **El typecheck NO corre en el build** | `.git/hooks/pre-push` | Ver `AGENTS.md`. El hook no se versiona: si se reclona, desaparece en silencio. |

### Un ciclo de imports es inocuo hasta que alguien lo evalúa

`lib/pipeline.ts ⇄ lib/funnel-etapas.ts` se importan mutuamente. Es inocuo **porque
ninguno de los dos usa lo del otro mientras se evalúa el módulo**, solo dentro del cuerpo
de las funciones. La condición exacta que lo rompería está escrita en la cabecera de
`funnel-etapas.ts`: un `const X = DEFAULT_PIPELINE...` a nivel de módulo, y falla distinto
en el server, en el cliente y en los tests según quién se cargue primero.

**Regla:** si dejás un ciclo, escribí la condición que lo activa y cubrí los dos órdenes
de carga con tests en archivos separados.

---

## 4. Proceso: varias sesiones en el mismo árbol

- **El typecheck rompe por archivos que no son tuyos.** Durante estas corridas aparecieron
  y desaparecieron `TS2552: Cannot find name 'Stage'`, `'Opcion'`, y refactors a medio
  terminar. **El verde se toma con el árbol estable**, y lo ajeno se reporta, no se
  "arregla".
- **`git add -A` se lleva los archivos a medias de la otra sesión.** Commitear seguido y
  explícito.
- **Verificá contra el código, no contra el resumen del agente anterior.** Un agente
  reportó como "arreglado" algo que otro seguía editando, y dos reportes se contradecían
  sobre el mismo archivo.
- **La deferencia colectiva deja el doc mintiendo.** Cuatro reportes seguidos anunciaron
  "esta fila del doc quedó obsoleta, no la toqué porque hay otra sesión en el árbol". Los
  cuatro dijeron lo mismo y **ninguno la tocó**: para quien leyera el documento al día
  siguiente, cinco frentes cerrados seguían abiertos. Un `.md` no es código: el conflicto
  se resuelve leyendo. **Si sos el que cierra, cerrá también el documento.**

### Separar las cuentas por `CLAUDE_CONFIG_DIR` también separa la memoria

Para tener cuota los 7 días hay **dos cuentas** de Claude Code sobre este clon, aisladas
con `CLAUDE_CONFIG_DIR` (`~\.claude` y `~\.claude-martin`). El protocolo completo está en
[dos-cuentas.md](dos-cuentas.md); acá va solo la trampa.

**El diagnóstico obvio era el equivocado.** La documentación del esquema decía que los
directorios separados aíslan la sesión pero no los settings del proyecto, «que es lo que
querés». Es cierto y es la mitad: **las 159 memorias viven DENTRO del config dir**
(`<config>\projects\<clave>\memory\`), igual que el `CLAUDE.md` global. La cuenta nueva no
arranca con menos permisos: arranca **ciega**, sin nada de lo aprendido, y no hay ningún
error que lo indique — simplemente no sabe.

Lo que sí comparten las dos es todo lo **versionado**: `AGENTS.md`, `docs/`, las skills de
`.claude/skills`. Por eso el canal de traspaso entre cuentas son estos documentos, no las
memorias.

Se resolvió con **junctions de NTFS**, no con copias: `mklink /J` desde cada ruta a la
carpeta real. Una copia se bifurca en silencio y en dos semanas hay dos verdades. Ojo con
un detalle que multiplica las rutas: la clave de proyecto sale del **cwd**, así que abrir
la sesión desde la carpeta padre o desde el repo genera dos claves distintas y cada una
busca su propia `memory/`.

---

## 5. Pushear no es desplegar

**Síntoma:** el dueño abre el CRM y ve la versión vieja de una feature que se le
reportó como terminada dos veces. Ni el selector de horas nuevo ni la búsqueda
avanzada estaban en vivo, y las dos estaban en `origin/main`.

**Causa real:** el build de Vercel fallaba desde hacía una hora, y producción seguía
servida por el último build exitoso — de hacía tres. Vercel **no revierte ni avisa**:
deja el deploy anterior en pie y el sitio funciona, con el código viejo.

```
./app/crm/actions.ts:65
Export alinearEtapaVista doesn't exist in target module
```

`app/crm/actions.ts` se commiteó; `lib/etapa-historial.ts`, que define esa función,
no. Y lo que hace que esto sea difícil de ver: **las tres redes de seguridad lo dejan
pasar**, porque las tres miran el árbol de trabajo, donde el archivo SÍ está.

| Red | Por qué no lo agarra |
|---|---|
| `npm run build` local | Compila el árbol de trabajo, con el archivo sin commitear ahí |
| `npm test` | Ídem |
| El hook `pre-push` (`tsc --noEmit`) | Ídem — chequea lo que tenés, no lo que subís |

**Por qué se llegó a eso:** con varias sesiones en el mismo árbol hay que commitear
archivo por archivo (`git add -A` se lleva el trabajo a medias de la otra sesión, ver
§4). Al hacerlo a mano es fácil subir el que **importa** y dejarse el que **define**.

**Las reglas que quedan:**

1. **Verificá el deploy, no el push.** Un push no es una entrega:
   ```bash
   npx vercel ls --yes --scope mbustos-4239s-projects
   ```
   La primera fila tiene que decir `● Ready`. Si dice `● Error`, producción está
   sirviendo código viejo AHORA MISMO. El log del build:
   `npx vercel inspect <url> --logs --scope mbustos-4239s-projects`
2. **Confirmá que lo desplegado te incluye.** Con sesiones paralelas, el deploy que
   ves puede ser de la otra: `git merge-base --is-ancestor <tu-sha> origin/main`, y el
   commit desplegado sale del log (`Cloning … Commit: <sha>`).
3. **Antes de pushear, buscá los símbolos huérfanos**: exportaciones que existen en tu
   árbol pero no en `origin/main`, y que ya usa código subido. Es el modo de falla
   exacto de este incidente:
   ```bash
   git status --porcelain | grep -E "^( M|\?\?)" | awk '{print $2}' | grep -E "\.tsx?$"
   # por cada uno: comparar sus `export` contra `git show origin/main:<archivo>`
   ```

**El diagnóstico obvio era el equivocado:** con la captura del dueño delante, todo
apuntaba a que el código estaba mal o se había perdido en un merge. Estaba bien y
estaba pusheado. Antes de volver a escribir una feature que "no aparece",
**comprobá que lo que el usuario mira es lo que vos escribiste**.

---

## 6. Lo que quedó sin hacer

| Qué | Dónde | Por qué |
|---|---|---|
| **Las primitivas de fecha siguen ancladas a Tijuana** (`hoyEnTijuana`, `ayerEnTijuana`, `lunesActualEnTijuana`, `primerDiaDelMesEnTijuana`), ~60 call-sites | `lib/date-utils.ts`, anotado en `lib/timezone.ts:47` | No es display: son bordes de día que deciden cohortes y disparos. Aplica la regla de arriba: escritura y lectura juntas. |
| **Bucles `.range()` a mano que quedaron fuera del barrido** | `scripts/limpiar-seed-clientes.ts:72`, `scripts/probe-historial-largos.ts:28` | Son scripts one-off, pero tienen el mismo techo mudo. |
| **Topes de una sola página** | `lib/cerrar-por-commits.ts:86` (600), `app/api/plan-buscar/route.ts:88` | No son bucles rotos: son techos deliberados sin cartel. Si la tabla crece, cortan en silencio. |

### Descartado a propósito (no volver a "arreglarlo")

- **Aprender el techo real de PostgREST desde la primera página corta.** Se implementó y
  se **revirtió**: una página corta es indistinguible del final de la tabla, así que la
  única detección honesta cuesta un request extra en **cada** lectura chica (3 por carga
  del CRM, +100-180 ms) para blindar una configuración que este proyecto no tiene.
  `PAGINA_POSTGREST = 1000` es el default de Supabase. **Si se baja `db-max-rows`, se baja
  la constante en el mismo commit** — está escrito en el módulo.

---

## Cosecha retroactiva (2026-08-07)

Rescatado de los journals de las 261 corridas multi-agente de junio a agosto de 2026:
**134 de 260 nunca habían escrito nada en el repo**. El registro completo de las corridas
está en [corridas-multiagente.md](corridas-multiagente.md).

⚠️ **Es material de segunda mano.** Sale de lo que devolvieron los subagentes en su
momento, no de una relectura del código de hoy. Cada entrada dice de qué corrida y de qué
fecha viene. **Antes de actuar sobre una, verificá contra el código**: varias ya están
arregladas, y donde el rescate lo sabía, lo dice.

### Trampas: el diagnóstico obvio era el equivocado

#### «Calendly conectado» y cero agendas, sin un solo error

El cliente pega su signing key en /metodo, se guarda cifrada y la tab se pinta verde — pero el route lee `process.env.CALENDLY_WEBHOOK_SIGNING_KEY` y nunca `credWs`, así que un webhook propio del cliente come 401 para siempre (el catálogo le promete explícitamente lo contrario). El segundo agujero es peor: `CALENDLY_EVENT_TYPE_J1/J2` figuran `opcional: true` en el catálogo pero `ROUTING_CREDS` los exige — sin ellos `wsPorIdentificador` devuelve null y el route contesta 200 OK con `ignored: 'sin workspace'`. Resultado: cero agendas, cero errores, y sin R1 no hay cohortes, ni funnel, ni SCL, ni revenue. Regla: un campo que el ruteo necesita no puede estar marcado opcional, y un webhook que descarta un evento tiene que dejar rastro, no un 200 mudo. Mismo patrón que byok-ia-no-usa-key-del-cliente, acá sobre Calendly.

**Vive en:** app/api/webhooks/calendly/route.ts:60, lib/webhook-routing.ts:33-35, lib/metodo-catalogo.ts:594-601 · *2026-07-17 ~metodo-facts-del-ping (reconfirmado el 2026-07-19)*

#### El ping de YouTube valida la key contra Rick Astley

`verificarServicio('youtube')` pide `part=id` sobre `YOUTUBE_VSL_VIDEO_ID` y, si el cliente no lo cargó, cae a un id hardcodeado: `dQw4w9WgXcQ`. Hoy no se nota porque solo se cuenta `items.length`, pero cualquier plan de mostrar «facts» del ping (título/canal, que salen gratis con `part=snippet`) le pintaría «Never Gonna Give You Up — RickAstleyVEVO» en el panel del propio cliente, que lo lee como que le conectamos la cuenta de otro. Regla: un fallback puesto para validar credenciales no puede filtrarse nunca a la UI; si falta el ID, el fact es «Key válida — falta el ID de tu VSL» y nada del video.

**Vive en:** lib/metodo-verificar.ts:121-127 · *2026-07-17 ~metodo-facts-del-ping*

#### «Key válida» no es «la integración sirve», y a veces el mensaje miente

Auditoría de los 8 pings de /metodo: casi todos piden el dato y lo tiran. Los tres que muerden: (a) una key de Resend con solo *Sending access* NO puede leer `/domains` → el ping devuelve 401 y muestra «API key inválida», que es falso: la key sirve, le falta scope; (b) Meta ya pide `account_status` y lo descarta — una cuenta con saldo impago (status 3) pinga 200 y no entrega un solo anuncio, y `amount_spent` viene en CENTAVOS; (c) el endpoint de Fathom devuelve `{ items, next_cursor, limit }`, no `{ meetings }` — implementarlo con `body.meetings` deja los facts vacíos y `ok:true` igual, y Panda con `?limit=1` trae el video más reciente, casi nunca el VSL. Regla: el ping tiene que distinguir «la credencial autentica» de «la cuenta sirve», y el error tiene que decir cuál de las dos falló.

**Vive en:** lib/metodo-verificar.ts (meta :33, email :58, fathom :102, panda :112) · *2026-07-17 ~metodo-facts-del-ping*

#### Crear dos clientes con nombres parecidos tira duplicate key

`crearWorkspace` arma el slug con `slugify(nombre)` (normaliza, reemplaza no-alfanuméricos por '-', corta a 40) y NO desdupica, pero `workspaces.slug` es UNIQUE en la migración 0054. Dos nombres distintos que colapsan al mismo slug — o recrear un cliente que ya existió — explotan con un error crudo de Postgres en la cara del admin, desde un formulario que solo pide el nombre. De paso, del mismo barrido: `listarWorkspaces()` no filtra por estado, así que los workspaces en `pausado` siguen apareciendo en el selector de asignación de usuarios.

**Vive en:** lib/workspace.ts:147,161-172; supabase/migrations/0054_workspaces.sql:32 · *2026-07-02 map-admin-clientes*

#### El tipo de cambio USD/MXN es una constante — salvo donde lo inventa el modelo

Todo lo que se muestra en USD (CAC, ROAS, spend del Script Analyst, cobranza, salud de Meta) convierte con la constante `TIPO_DE_CAMBIO_USD_MXN` de lib/config.ts, y el estructurador de campañas tiene ADEMÁS su propio TC=17.3 hardcodeado aparte. Peor: el extractor de contratos no usa ninguna de las dos — le pide a GPT-4o que «estime» la conversión, o sea que el modelo inventa un tipo de cambio y ese número queda como monto de las cuotas del plan de pago, avisado solo en una nota de «asumido». Regla: la conversión de moneda es una sola función con una sola fuente, y ninguna IA convierte moneda.

**Vive en:** lib/config.ts (TIPO_DE_CAMBIO_USD_MXN), lib/campaign-structurer.ts (TC=17.3), app/api/extract-contract · *2026-07-19 ~landing-24-features-auditoria*

#### Google OAuth: los preview deploys nunca van a matchear, y falta la URI de localhost de Calendar

`googleRedirectUri()` deriva la URI del origin del request cuando no hay `GOOGLE_REDIRECT_URI` (que no existe ni en Vercel ni en local, a propósito). Dos consecuencias: en cualquier preview deploy el origin es un `*.vercel.app` distinto cada vez y Google no acepta wildcards, así que el login da `redirect_uri_mismatch` SIEMPRE en preview — no tiene arreglo razonable, es saberlo y listo. Y en dev, como `.env.local` no define `NEXT_PUBLIC_APP_URL`, la URI que arma es `http://localhost:3000/api/integraciones/google-calendar/callback`, que NO está autorizada en la consola: conectar Google Calendar desde `npm run dev` falla con Error 400.

**Vive en:** lib/google-calendar.ts:32-37; app/api/auth/google/route.ts:29-30; consola de Google Cloud (cliente 118392241323-j98eq...) · *2026-08-05 · ~auditoria-mudanza-dominio*

#### La lista blanca de «Completar con los datos de Mau» dejaba servicios afuera sin decir nada

En el paso de Gemini del onboarding, el botón decía «Listo: N cosas traídas» y la key seguía vacía. El sospechoso número uno era credWs: que devolviera null para el dueño porque la key vive solo en el env de Vercel. Falso — credenciales.ts hace exactamente lo contrario (si no hay fila y el ws es el dueño, cae a process.env) y además instrumentation.ts hidrata env→tabla en cada boot. La causa real era una lista blanca, SERVICIOS_CLIENTE, que no incluía 'gemini' (ni 9 de los 15 servicios del catálogo): el bucle hacía `continue` antes de leer la credencial. Como Meta y WhatsApp sí se copiaban, el contador daba >0 y la pantalla mentía. La regla: para «copiar todo lo del dueño» va lista NEGRA (solo lo que es infra de la agencia no viaja), nunca lista blanca — con lista blanca cada servicio nuevo del catálogo queda afuera en silencio. Agravante del mismo barrido: el componente cliente descartaba el array `avisos` entero, así que ningún error de copia fue visible jamás.

**Vive en:** lib/datos-mau.ts (hoy itera SERVICIOS_METODO entero) · app/_components/DatosDeMau.tsx · lib/metodo-catalogo.ts · *2026-08-01 · mako-onboarding-copy-y-bugs*

#### Un 200 en un webhook es un ACK: el null por falla de base se come el evento para siempre

`wsPorIdentificador` colapsa dos cosas distintas en `null`: «este identificador no está mapeado» y «el SELECT falló» (hace `const { data } = await ...maybeSingle()` y descarta `error`; supabase-js no lanza en fallo de red). El receptor entonces contesta 200 `{ok:true, ignored:'sin workspace'}` — y un 200 es un acuse de recibo: Svix/Calendly NO reintentan y esa reunión o esa agenda se pierde sin rastro. El verificador que revisó este hallazgo descartó la versión que apuntaba al secreto de firma (ahí un 401 sí hace reintentar) y señaló que el fail-open que cuesta caro es este. Regla: en un receptor de webhook, null por ausencia y null por falla no pueden compartir salida — la falla de lectura se contesta 503 para que el proveedor reintente, nunca 200.

**Vive en:** lib/webhook-routing.ts:44-61 + app/api/webhooks/fathom/route.ts y calendly/route.ts · *2026-08-05 ~review-commit-firma-webhooks*

#### En Turbopack el estado de módulo es por CAPA, no por proceso: un `let` de módulo se duplica siempre en producción

La barrera `credencialesListas()` memoizaba en un `let bootCredenciales` de módulo y en cada arranque en frío se hidrataban las credenciales DOS veces, la segunda adentro del request de un webhook (SELECT con timeout de 4s + seedRoutingDelDueno + migrarEnvACredenciales, ~13 round-trips antes de verificar la firma). La causa no es HMR: verificado sobre el bundle, Turbopack emite una copia de `lib/credenciales.ts` por capa (id 33117 instrumentation, 74912 app-route, 92272 ssr) y el `moduleCache`, aunque es único por proceso, deduplica POR MODULE ID. La prueba dura fue comparar los cuerpos: la copia de instrumentation conserva `hidratarCredenciales` y perdió `auditarCredencial` por tree-shaking, la de app-route al revés. Un primer diagnóstico de la misma corrida dijo «comparten el moduleCache, es la misma promesa» y estaba equivocado. Regla: cualquier singleton que tenga que ser uno por proceso va en `globalThis`, no en una variable de módulo.

**Vive en:** lib/credenciales.ts:162-171 (ya corregido con `globalThis.__makoBootCreds`); aplica a todo caché o cliente cacheado a nivel de módulo · *2026-08-05 ~review-commit-firma-webhooks*

#### Una credencial copiada entre workspaces es inerte hasta que arreglás la config, y ahí se vuelve ingesta cruzada real

ws3 (Cliente de Prueba) y ws9 tienen `PANDA_API_KEY`, `PANDA_VSL_VIDEO_IDS` y las de YouTube byte a byte idénticas a las de ws1 (mismo sha256, `updated_by='datos-mau'`). Eso era inofensivo solo porque `configWs` miraba únicamente `app_settings`, donde no había ni una fila, así que la ingesta devolvía null y no escribía nada. Al arreglar `configWs` para que lea `credWs`, los crons de Panda y YouTube pasan a pegarle a la cuenta de Mauricio con SU key y a escribir sus métricas reales dentro del workspace 3: el tablero del cliente de prueba muestra el negocio del dueño y se repuebla solo todos los días aunque lo resetees. Regla: antes de arreglar una resolución de config, mirá qué credenciales duplicadas estaban dormidas detrás de esa rotura.

**Vive en:** lib/cron-workspaces.ts:80-91 (configWs) + filas de `credenciales` de ws3/ws9 · *2026-08-05 ~review-commit-firma-webhooks*

#### Borrar AUTH_ALLOWED_EMAILS no limpia nada: ACTIVA la rama que auto-crea admins

La variable ya cumplió su función (los usuarios que importan tienen fila, así que `buscarUsuarioPorEmail` los resuelve antes de mirar la allowlist) y parece basura borrable. Pero el bootstrap del callback de Google es `if (!process.env.AUTH_ALLOWED_EMAILS && (await contarUsuarios()) === 0)`: la variable seteada es lo único que mantiene esa rama apagada. Si se borra «por limpieza» y algún día la tabla `usuarios` queda vacía (wipe, restore malo, migración), la primera cuenta de Google que entre se auto-crea ADMIN. Además se pierde el break-glass con la base caída, que hoy deja entrar a un email de la allowlist aunque Supabase esté muerta.

**Vive en:** app/api/auth/callback/google/route.ts:29,40,43,52-59 · *2026-07-16 ~auditoria-env-vars*

#### Los signing secrets de webhook por cliente están en el catálogo pero los routes leen process.env: son decorativos

`FATHOM_WEBHOOK_SECRET` y `CALENDLY_WEBHOOK_SIGNING_KEY` figuran en el catálogo con tutorial y todo, así que el cliente los pega y la UI se pinta verde — pero los receptores leían `process.env`, o sea el valor del DUEÑO, y sus webhooks se rechazaban con 401 igual, en silencio (solo un console.warn). Es el mismo patrón de «se guarda, se pinta verde y no se usa» que la key de IA. Lo mismo pasa hoy con `RESEND_WEBHOOK_SECRET`, que es solo de plataforma: el cliente que trae su propia cuenta de Resend nunca recibe aperturas, clics ni —lo grave— rebotes permanentes y quejas de spam, así que sigue mandando a direcciones muertas y quemando la reputación del dominio. Regla: una credencial que el catálogo ofrece por workspace tiene que resolverse con `credWs` en TODOS sus lectores, o no va al catálogo.

**Vive en:** app/api/webhooks/resend/route.ts:30 (sigue con secreto único); fathom/calendly ya migrados a credWs con fallback · *2026-07-16 ~auditoria-env-vars*

#### El proxy multi-inquilino es una lista blanca: la tabla que no está en TENANT_TABLES pasa derecho sin filtro

`getTenantDb` no scopea `funnel_config`: esa tabla no está en las ~50 de `TENANT_TABLES`, y lo que no está en el set es passthrough. Hoy funciona porque `getFunnel`/`saveFunnel` ponen el `.eq('workspace_id', ws)` a mano, pero no hay red: la próxima query que alguien escriba contra esa tabla sale sin filtro y sin que nada avise. Regla: al crear una tabla por cliente, sumarla a TENANT_TABLES es parte de la migración, no un paso opcional — el proxy protege por inclusión, no por defecto.

**Vive en:** lib/workspace.ts:40-55 y :171-172, lib/leads.ts:1291-1316 · *2026-07-22 ~research-landing-funnel*

#### Un SELECT que no trae la columna hace que el «merge» la borre en silencio

`setPerfil` leía el jsonb `perfil`, lo mergeaba y lo reescribía — pero el SELECT compartido (`COLS`) no incluía esa columna, así que leía `undefined` y reescribía el jsonb desde vacío: teléfono, cargo y bio desaparecían sin error. El arreglo (sumar `perfil` a COLS, commit dc58336) es correcto y NO hay que revertirlo: dos verificadores refutaron el hallazgo de que eso filtre datos (el receptor es el admin del propio workspace, que ya administra esas cuentas). Regla: un patrón leer-mergear-escribir es tan bueno como el SELECT que lo alimenta; si el SELECT es compartido, o lo ampliás o hacés uno propio — nunca asumas que la columna vino.

**Vive en:** lib/usuarios.ts:40 (COLS) + lib/perfil.ts:93-113 · *2026-08-06 ~auditoria-notificaciones-y-titulo-de-pestana*

#### En el trace de Next los spans más caros son cola, no CPU

El trace del build muestra `check-page` con 608,6 s agregados y `is-page-static` con 499,9 s: parecen el monstruo y no lo son. Son 230 promesas dentro de una ventana wall de 3,8 s (paralelismo implícito de 159x, físicamente imposible): es tiempo esperando el worker pool. El desglose real de los 99,3 s del build es `run-typescript` 64,6 s (65 %), `run-turbopack` 23,8 s (24 %). En la misma medición se descartaron dos palancas por evidencia, no por opinión: ESLint NO corre en el build (enumerados los 27 nombres de span, cero de eslint → `eslint.ignoreDuringBuilds` es un no-op) y no hay `generateStaticParams` en todo el repo. Regla: antes de optimizar por un span agregado, dividilo por la ventana wall.

**Vive en:** .next/trace-build / .next/trace, next.config.ts · *2026-07-23 vercel-costo-auditoria*

#### El polling global no chequea `visibilityState`: 24.480 invocaciones por día para recibir `[]`

Los dos ticks del NotificationsProvider (6 s y 12 s) están montados en el layout raíz y NO tienen guarda de visibilidad, aunque `IaUsageToast.tsx:65` y `SaldoMaKo.tsx:24` sí la tienen: 1.020 req/h las 24 h con la pestaña minimizada. Peor: si el workspace no tiene WhatsApp conectado, la ruta corta con `{ok:true, contactos:[]}` — el navegador del cliente gasta 24.480 invocaciones diarias para que le devuelvan un array vacío. Hoy son centavos (todo el polling = $1,32 de $26,53 en 7 días; el 95 % es Build CPU), pero el costo es POR PESTAÑA ABIERTA, no por uso: 10 workspaces con una pestaña abierta son 8,2M invocaciones/mes y revientan el millón incluido del plan Pro. Es deuda que escala lineal con clientes.

**Vive en:** app/_components/NotificationsProvider.tsx:353 y :408; app/api/whatsapp/conversations/route.ts:45 · *2026-07-23 vercel-costo-auditoria*

#### Los números de migración YA colisionaron ocho veces: «máximo + 1» no es seguro

Hay 8 números duplicados por trabajo en paralelo (0024, 0025, 0026, 0039, 0060, 0061, 0069, 0072, dos archivos cada uno) y el repo los tolera. No existe tabla de tracking de migraciones: el estado se infiere del catálogo de la base, y `scripts/check-migrations.mjs` quedó obsoleto (solo llega a 0022). Antes de numerar una migración nueva, mirá los archivos que ya están y confirmá contra el esquema vivo qué se aplicó de verdad — sobre todo con dos sesiones de Claude trabajando el mismo árbol.

**Vive en:** supabase/migrations/, scripts/check-migrations.mjs · *2026-07-17 retro-mapa*

#### El cron que más se parece al tuyo puede ser el anti-patrón

Para un cron nuevo hay dos moldes y el instinto elige mal. `correrPorWorkspace(servicio, fn)` filtra por `integracionConectada(servicio, ws)`: si tu tarea no cuelga de un proveedor, pasarle un servicio cualquiera hace que NO corra para los clientes sin esa integración, en silencio. Y los tres crons `reporte-*` (diario/horario/semanal) —los más parecidos a un digest que avisa por WhatsApp, o sea los que uno copiaría— NO son tenant-scoped: llaman a `getContactoReportes()`/`getNotifPrefs()` sueltos y corren solo para el dueño. El molde correcto para un cron no atado a un proveedor es el de nutricion/email-broadcasts: `listarWorkspaces()` + filtro `estado==='activo'` + `runWithWorkspace(ws)` — pero importando `checkCronAuth`, no el `checkAuth` local que ese archivo duplica.

**Vive en:** lib/cron-workspaces.ts:43-46; app/api/cron/reporte-*/route.ts; app/api/cron/nutricion/route.ts:38-62 · *2026-07-17 retro-mapa*

#### El pre-push corre el typecheck y NADA más: un chequeo sobre `.next/` ahí da falso verde

Se propuso un script centinela en el pre-push que grepee `.next/static` buscando frases sensibles en el bundle. El hook no hace build: el grep correría contra un build viejo o inexistente y pasaría en vacío (verde falso) o fallaría espurio. Cualquier verificación que se enganche al pre-push tiene que ser sobre el FUENTE. Del mismo hilo, sobre contar por grep: la heurística «rutas sin guard» daba 77, 86 o 70 según qué helpers incluyeras, y tres de las rutas denunciadas como «mueven plata en Meta sin guard» SÍ estaban guardadas por un helper que el informe nunca abrió (lib/ads-guard.ts). Un número salido de un grep sin abrir los helpers es un número inventado.

**Vive en:** .git/hooks/pre-push; lib/ads-guard.ts:18 · *2026-08-05 cierre-ronda-mako*

#### «Usar las llaves de Mauricio» deja el workspace de prueba a medio conectar, y el error se traga

El atajo copia solo las credenciales de 6 servicios, pero los identificadores de RUTEO (META_PAGE_ID, FATHOM_HOST_EMAIL, CALENDLY_EVENT_TYPE_J1/J2, CHATWOOT_ACCOUNT_ID) están en ROUTING_CREDS y guardarCredencial tira IdentificadorOcupadoError porque ws1 ya los reclamó — y el catch los saltea EN SILENCIO. El resultado se lee como un bug de Meta: el ws de prueba queda con el token de Meta y la UI pintada de verde, pero sin page id, así que los leads de esos formularios siguen entrando al ws1. Además GEMINI_API_KEY no está en SERVICIOS_CLIENTE, y el paso 'gemini' es el único sin excepción de admin: el wizard se traba ahí. El atajo tiene que DEVOLVER cuáles se saltearon, no tragárselo.

**Vive en:** app/api/onboarding/route.ts (case 'simular') · lib/webhook-routing.ts (ROUTING_CREDS) · lib/credenciales.ts (guardarCredencial) · *2026-08-01 · mapa-clonar-workspace*

#### Renombrar una ruta no renombra sus keys — y una de esas keys re-siembra sola

Al planear el rename de /setting a /chat-agent apareció que la palabra vive en cinco keys ya escritas en la base: 'onboarding.tab.setting' (progreso del onboarding de cada cliente), 'mako.datos_mau.setting' (el recibo de qué se copió de Mau, sin el cual el botón «Eliminar lo de Mau» ya no encuentra nada), las 5 keys de prompt del registro, las 3 claves 'setting-*' de nutricion_secuencias y la tabla setting_audios. La bomba silenciosa es la tercera: esas 3 plantillas nacen con activa:false y el dedup por trigger_tipo solo protege a las activas, así que si se renombra la `clave`, el próximo tick del cron de nutrición las re-siembra en CADA workspace y todos los clientes quedan con jugadas duplicadas sin que nadie haya tocado nada. La pieza que resuelve el rename sin tocar datos ya existe y no se usaba: el campo `href` de TabOnboardingDef separa la ruta de la key.

**Vive en:** lib/nutricion-templates.ts (claves setting-*) · lib/tab-onboarding-state.ts (campo href) · lib/datos-mau.ts (AmbitoKey) · lib/prompt-registry.ts · *2026-08-01 · mako-cliente-prueba-diagnostico*

#### El workspace del dueño tiene capa 'completo', no 'superadmin'

Un cambio quitó el bypass de OWNER_WS del gate de /onboarding asumiendo que el dueño caería solo al hub por tener una capa sin pasos. No es así: la migración 0092 dejó `capa NOT NULL DEFAULT 'completo'` y backfilleó ws1 a 'completo'; la 0096 solo habilita el valor 'superadmin' en el CHECK sin asignárselo a nadie. Con eso ws1 tiene 8 pasos y su estado nunca es 'done', así que se renderiza el wizard, el wizard hace GET /api/onboarding y el guard rechaza OWNER_WS con 400 — el dueño queda en una pantalla roja permanente y el hub es inalcanzable. La forma correcta de gatear es `!(await onboardingPendiente())`, que ya contempla OWNER_WS.

**Vive en:** app/onboarding/page.tsx · app/api/onboarding/route.ts (guard) · lib/onboarding-state.ts (onboardingPendiente) · migraciones 0092 y 0096 · *2026-07-28 · ~review-onboarding-fabrica-creativos*

#### El fallback de workspace es fail-closed en los datos y fail-OPEN al dueño en las credenciales y los settings

Síntoma: un admin de agencia sin impersonar teclea /general y ve el CRM y el pipeline vacíos pero, en el mismo hero, el saldo y la salud EN VIVO de la cuenta de Meta del dueño. Causa: `getTenantDb()` resuelve `ws ?? -1` (0 filas), mientras `settings.wsActual()` (lib/settings.ts:17) y `credenciales.wsDefault()` (lib/credenciales.ts:110) resuelven `?? OWNER_WS`. O sea: sin workspace, las tres capas no contestan lo mismo. `integracionConectada()` SÍ es fail-closed a propósito y lo dice en un comentario, pero las vistas que llaman `getMetaAccountHealth()`/`getIntegraciones()` directo se lo saltean. El espejo es peor que la lectura: todo lo que ese admin edite en /perfil, /configuraciones o /contexto se guarda sobre el workspace del DUEÑO sin un solo cartel. Regla: cuando no hay workspace, el default sólo vale para el camino SIN sesión (cron/webhook, con `ws` explícito); en un request con sesión, resolver a null y que la pantalla diga "entrá como un cliente". Verificado vivo hoy: /general sigue llamando `getMetaAccountHealth()` sin gate (app/general/page.tsx:72) — /integraciones ya se gateó.

**Vive en:** lib/settings.ts:17 · lib/credenciales.ts:110 · app/general/page.tsx:72 · lib/integraciones.ts:122 · *2026-07-02 auditoria-multitenant-ux*

#### Una columna DATE pasada por Date.parse es medianoche UTC, o sea las 18:00 del día ANTERIOR en México

Síntoma: el recordatorio «en un par de horas tenemos la reunión» salía ~18 horas antes, y una reunión de HOY contaba como pasada desde las 18:00 de ayer. Causa: `fecha_junta_1/2` son columnas DATE y sólo Calendly escribe `junta_1_at` con hora — el alta o edición a mano deja sólo 'YYYY-MM-DD', que `Date.parse` interpreta como medianoche UTC. El comentario del código juraba que «la ventana horaria del cron lo acomoda» y era falso: el desfase cae justo adentro de la ventana 9-21 MX, así que nada lo frena. Regla: una fecha date-only se parsea forzándole hora en la zona del negocio (`${x}T12:00:00${OFFSET_MX}`), nunca dejándosela adivinar a Date.parse; y un filtro `ms > Date.now()` sobre una fecha date-only da "pasada" medio día antes de tiempo.

**Vive en:** lib/nutricion.ts:507 (proximoEnvioDePaso) — mismo riesgo en cualquier lector de fecha_junta_*/fecha_agenda · *2026-07-31 ~review-adversarial-nutricion*

#### El estado de una integración se pinta donde vive el chequeo, y el error del callback OAuth muere si nadie lo traduce en esa pantalla

Síntoma: Google Calendar figuraba «conectado» (punto verde, contando en «N/M conectados») cuando en realidad tenía token pero le faltaba el permiso para mover reuniones; la verdad recién aparecía al abrir el modal, porque el `getGoogleCalendarStatusAction()` vivía adentro del modal. Regla 1: conectado = token Y permiso, y el chequeo tiene que subir al lugar donde se pinta el estado, no quedarse en la pantalla que se abre después. Segundo agujero del mismo flujo: el callback siempre vuelve a `/integraciones?gcal=<motivo>` pero el mapa de mensajes vivía en `GoogleCalendarPanel`, un componente que no estaba montado en ninguna página — un re-consent fallido (`sin-refresh`, `csrf`, `exchange`) recargaba la pantalla idéntica, sin una palabra: el loop exacto de «aprieto Conectar y no pasa nada». Regla 2: el traductor del parámetro de vuelta se monta en la pantalla a la que redirige el callback, y se exporta desde un solo lugar (hoy `GCAL_MSG`).

**Vive en:** app/integraciones/IntegracionesBoard.tsx:169 · app/configuraciones/GoogleCalendarPanel.tsx:38 (GCAL_MSG) · app/api/integraciones/google-calendar/route.ts · *2026-08-06 ~busqueda-crm-y-estado-google-calendar*

#### Los dos topes de body de la app cortan en silencio: el proxy TRUNCA y el server action topea en 1 MB

`proxyClientMaxBodySize` (next.config.ts, 20mb) no rechaza: `cloneBodyStream` aplica el límite, hace `push(null)` + un console.warn y el route recibe el body CORTADO — y el clone es incondicional cuando hay body, aunque el proxy nunca lo lea. El otro tope es peor porque es invisible: el repo no define `experimental.serverActions.bodySizeLimit`, así que cualquier cosa que viaje como ARGUMENTO de un server action topea en 1 MB por default (el modal de importar CSV anunciaba 8 MB y reventaba con un error crudo de Next a las ~8-10k filas). Regla: los archivos van por multipart a un route handler, nunca como argumento de una action; y validar `content-length` ANTES de `req.formData()`, porque el check de tamaño después del parseo ya bufferó todo.

**Vive en:** next.config.ts + app/api/**/route.ts (multipart) · app/crm/ImportarLeadsModal.tsx · *2026-06-23 ~review-adjuntos-whatsapp / 2026-08-06 crm-tracking-import-export-audit*

#### Un hiccup de lectura de app_settings expulsa a un cliente ya onboardeado al wizard, y le pisa el 'done'

`getSetting` (lib/settings.ts:20-33) atrapa el error de Supabase, loguea y devuelve `null` — no distingue «falló la lectura» de «no hay fila». `getEstadoOnboarding` trata ese null igual que «workspace sin fila» y devuelve `estadoInicial()`, o sea status **pending**, así que todas las tabs del cliente redirigen a /onboarding. Peor: `patchEstadoOnboarding` (lib/onboarding-state.ts:132-137) es read-modify-write sobre ese mismo getter, de modo que si la lectura sigue fallando pero la escritura funciona (el usuario toca cualquier botón del wizard), se persiste un estado nuevo y se clobberea el 'done' real. La regla: cuando un getter degrada el error a null, el consumidor tiene que decidir explícitamente qué significa null — y nunca puede significar «reseteá al estado inicial».

**Vive en:** lib/settings.ts:20 (getSetting) → lib/onboarding-state.ts:104 (getEstadoOnboarding) y :132 (patchEstadoOnboarding) · *2026-07-02 · ~auditoria-onboarding*

#### La tabla `notificaciones` no existe en producción: todo aviso al dueño se pierde en silencio

PostgREST devuelve 404 'Could not find the table public.notificaciones': la migración 0048 está en el repo y nunca se aplicó. Como `crearNotificacion` hace `catch { console.error; return null }` y nunca lanza, el choke point de avisos (49 mensajes del catálogo) escribe al vacío, la campanita in-app está estructuralmente vacía y la cola de reintento `canal_wa='pendiente'` —los reportes que esperan que se reabra la ventana de 24h— no se reintenta nunca. Antes de aplicarla hay que agregarle `workspace_id` y sumarla a TENANT_TABLES: hoy no tiene columna de workspace y el escritor usa getSupabaseServer(), así que mezclaría los avisos de todos los inquilinos. Regla: un CRUD diseñado para "no romper al caller" tiene que distinguir 'tabla ausente' (42P01/PGRST205) de error transitorio y gritarlo.

**Vive en:** supabase/migrations/0048_notificaciones.sql (sin aplicar), lib/notificaciones.ts:76-101, lib/avisos.ts:14 y :71 · *2026-08-01 auditoria-plan-y-whatsapp*

#### Subir un archivo tiene dos topes distintos y solo uno avisa

Una server action tiene un tope de body de 1 MB y `serverActions.bodySizeLimit` no está seteado en next.config.ts: por ahí un PDF escaneado nunca iba a entrar, y por eso la importación de leads necesitó un route handler (`app/api/crm/importar-leads`) que solo LEE el archivo — crear los leads sigue siendo una action. El segundo tope es el del middleware/proxy, que bufferea el body con `experimental.proxyClientMaxBodySize`: si se pasa NO falla, bufferea los primeros N bytes y loguea un warning, o sea que el archivo llega truncado y corrupto sin un solo error (hoy está en 20mb con el porqué comentado en next.config.ts). Regla: cualquier feature de subida se diseña contra los dos topes, y el que trunca en silencio es el peligroso.

**Vive en:** next.config.ts (experimental.proxyClientMaxBodySize), app/api/crm/importar-leads/route.ts, app/crm/actions.ts · *2026-08-06 ~crm-toolbar-e-importar-exportar*

#### La credencial que el cliente carga no siempre es la que el código lee

Dos casos vivos del mismo patrón. (1) Hay dos cosas homónimas para la página de Facebook: la setting `meta_page_id` que escribe el wizard —la única que lee el cron de ingesta— y la credencial `META_PAGE_ID` que /integraciones ofrece diciendo que sirve para rutear leads; quien carga la equivocada no ingesta nada y no ve ningún error. (2) El webhook de Calendly verifica la firma leyendo solo `process.env`, así que el cliente pega su signing key, se guarda cifrada por workspace, y su webhook devuelve 401 para siempre sin nada visible del lado de la app. Regla: cuando se agrega un campo a /integraciones, chequear que el consumidor lo lea por credWs/getSetting con la MISMA clave; si no, la tab dice verde y la feature está muerta.

**Vive en:** app/api/webhooks/calendly/route.ts, lib/settings.ts (meta_page_id) vs lib/credenciales.ts (META_PAGE_ID) · *2026-08-05 ~verificar-commits-contra-el-board*

#### Borrar una credencial del dueño no la borra: otra lambda la resucita y el próximo boot la reescribe

`eliminarCredencial` borra la fila y hace `delete process.env[clave]`, pero solo en la instancia que atendió el POST y solo si esa instancia la había hidratado (`hidratadas` es un Set por proceso). El GET siguiente puede caer en otra lambda tibia donde el env sigue vivo: `estadoCampo` devuelve `{ configurado: true, origen: 'servidor' }`, o sea que la fila reaparece VERDE «guardada» — y como el tacho solo se renderiza con `origen === 'panel'`, ya no se puede volver a borrar desde la UI. Peor: en el próximo cold start `migrarEnvACredenciales` ve la clave en el env y sin fila en la base, y la reescribe cifrada. No hay tombstone que distinga «nunca migrada» de «borrada a propósito». El aviso del panel promete «las borrás cuando quieras y dejan de usarse al instante»: para ws1 es falso.

**Vive en:** lib/credenciales.ts:270-279 (eliminarCredencial), :151-154 (estadoCampo) y migrarEnvACredenciales · app/integraciones/ServicioConfigForm.tsx · *2026-07-16 · ~auditoria-refactor-integraciones*

#### El lector de un stream NDJSON se traga el error real del server

El cliente leía el body línea por línea buscando '\n'. Cuando la ruta corta ANTES de abrir el stream devuelve un `Response.json` —que no termina en newline—, ese JSON queda en el buffer y se descarta al salir del loop: el usuario ve siempre el genérico «La generación terminó sin resultado, probá de nuevo» y reintenta para siempre. El diagnóstico obvio (falló la generación) era el equivocado: el camino realista no era el 400 de validación de fechas sino el 401 del proxy con la sesión vencida — había que re-loguearse y la pantalla decía «reintentá». Regla para toda ruta que streamee: el cliente chequea `res.ok` y el content-type ANTES de leer el body, y procesa el residuo del buffer al terminar el loop.

**Vive en:** app/experimentos/RetroTab.tsx (generar) · app/api/retro/route.ts · *2026-07-02 ~auditoria-retro-v3*

#### configWs NO le filtra el dato del dueño a los clientes (dos auditorías lo reportaron mal)

Reaparece cada vez que alguien audita los crons: «un cliente con YouTube o Panda conectado pero sin sus ids ingesta los videos de Mauricio». No es así. `configWs` limita el fallback al env con `ws === OWNER_WS || ws == null` adentro de la propia función, así que para un cliente devuelve null y no ingesta nada ajeno. La auditoría del 02/07 lo levantó como fuga; la del 16/07 lo verificó y lo descartó explícitamente como falso positivo, y el código de hoy lo confirma (además ahora, antes del env, cae a `credWs(clave.toUpperCase())`). Gana la más reciente: no volver a «arreglarlo». Lo que sí es cierto es el problema de al lado: sin la setting propia el cliente no ingesta NADA de ese servicio, así que el onboarding igual tiene que escribirlas al conectar cada integración.

**Vive en:** lib/cron-workspaces.ts (configWs) · *2026-07-02 ~mapa-onboarding-extraccion-retro*

#### Un upsert con onConflict de UNA columna se roba la fila del otro inquilino, y getTenantDb no lo impide

`getTenantDb()` filtra select/update/delete y ESTAMPA `workspace_id` en el insert — por eso se asume que un upsert está aislado. No lo está: si el `onConflict` no incluye `workspace_id`, el conflicto se resuelve contra la fila de OTRO workspace, y como en un ON CONFLICT DO UPDATE de supabase-js el SET incluye todas las columnas del payload, el `workspace_id` estampado PISA al del dueño original: la fila cambia de inquilino y desaparece del tablero del otro. La mig 0054 dejó a propósito PK de una sola columna en las tablas «que solo escriben los crons» (`ad_transcripts.ad_id`, `closing_analyses.recording_id`, `script_analyses.ad_id`, `credenciales.clave`) y ahí vivía el agujero: un cliente que abría /closing y tocaba «Sincronizar» re-analizaba las llamadas de venta del dueño y se quedaba con la fila. Hoy todos los `onConflict` de lib/ son compuestos, pero la regla no está escrita en ningún lado: al agregar una tabla, el conflict target tiene que incluir `workspace_id` o el aislamiento del proxy es decorativo.

**Vive en:** lib/workspace.ts (scopedFrom) · supabase/migrations/0054_workspaces.sql §4 · los ~40 `onConflict` de lib/*.ts · la skill tenant-safe-query no lo menciona · *2026-07-01 ~auditoria-aislamiento-multi-tenant*

#### getTenantDb hace PASSTHROUGH silencioso para una tabla que no está en TENANT_TABLES

`scopedFrom` hace `if (!TENANT_TABLES.has(table)) return builder` — no lanza, no avisa: devuelve el builder sin el `.eq('workspace_id')`. El caso real: `hayFilas('funnel_config')` en el catálogo de señales del plan. `funnel_config` está fuera de TENANT_TABLES a propósito (se scopea a mano en su lib), así que el count era GLOBAL: la tabla tenía 4 filas y devolvía 4 para los 6 workspaces. Consecuencia: la señal `funnel-cargado` salía verde para todos, y «Cargar el funnel del negocio en MaKo» y «Definir las métricas norte» nacían TILDADAS para todo cliente nuevo, con la evidencia mintiendo en el historial («tu funnel ya está cargado»). El diagnóstico obvio —«el auto-cierre por señales no anda»— era el equivocado: andaba de más. Regla: cada `hayFilas(x)` (y cualquier count/lectura por getTenantDb) solo vale si `x ∈ TENANT_TABLES`; si no, el filtro va a mano y fail-closed (sin workspace, false). Corolario del mismo barrido: antes de declarar una señal nueva hay que sondear prod, porque declarar una que nunca se cumple deja tareas colgadas para siempre (`nutricion_envios` y `experimentos` estaban en 0 en los 6 workspaces).

**Vive en:** lib/workspace.ts (TENANT_TABLES + scopedFrom) · lib/plan-senales.ts (hayFilas vs hayFilasWs) · lib/todo-seeds-data.ts (las 3 tareas que dependían de la señal) · *2026-08-05 ronda-clientes-y-automatizacion*

#### El `maxDuration` de la PÁGINA gobierna sus server actions, y sin él un guardado exitoso se ve como error

`reagendarReunionAction` escribe el CRM y recién después habla con Google (buscar el evento + PATCH), con un presupuesto interno que en el peor caso llega a ~28s: 8s de refresh de token + 10s de listado + 10s del PATCH. No había `maxDuration` ni en la página ni en el server action (sí lo hay en 30+ rutas de app/api), así que el corte de la plataforma llegaba con la fila YA guardada y el cliente pintaba «No se pudo reagendar» en rojo — el usuario reintentaba y reagendaba dos veces. Verificado contra `node_modules/next/dist/docs`: el techo de la página gobierna a sus server actions, así que el fix es `export const maxDuration = 60` en `app/crm/page.tsx`. Regla: todo server action que escribe primero y después habla con un tercero necesita techo explícito, o el timeout convierte un éxito en un error visible.

**Vive en:** app/crm/page.tsx · app/crm/actions.ts (reagendarReunionAction → moverEnCalendario) · *2026-08-06 ~wizard-que-hacer-ahora-y-horarios-de-google*

#### Un cron de vigilancia se excluye a sí mismo justo del workspace roto

`correrPorWorkspace('landing', …)` itera solo los workspaces con la integración conectada, y «landing conectada» se define como «llegaron eventos recientes». El workspace con el tracking muerto queda fuera del loop POR CONSTRUCCIÓN y jamás se avisa: el vigilante no puede detectar lo que vino a detectar. Por eso el cron `tracking-vigilante` itera por `landing_token` (la señal durable) a propósito y NO usa `correrPorWorkspace`. El mismo vicio en el semáforo: `landingRecibioEventos()` preguntaba «¿llegó algo ALGUNA VEZ?» sobre toda la historia, así que con 1955 filas viejas quedaba verde para siempre. Regla: la señal que decide si un vigilante corre no puede ser la misma señal que el vigilante mide.

**Vive en:** lib/cron-workspaces.ts (correrPorWorkspace) · app/api/cron/tracking-vigilante · lib/integraciones.ts (estadoLanding, LANDING_VENTANA_DIAS) · *2026-08-07 contexto-mako-md*

#### El proxy trunca un body grande EN SILENCIO en vez de fallar

El middleware bufferea el body con un tope de 10MB por defecto y, si se pasa, TRUNCA sin error: el adjunto llega corrupto y no hay nada en los logs. `next.config.ts` lo sube a `experimental.proxyClientMaxBodySize:'20mb'` para cubrir el cap real de 16MB de `/api/whatsapp/.../attachments`. Cualquier ruta nueva que reciba archivos grandes tiene que medirse contra ese tope, no contra el límite del proveedor.

**Vive en:** next.config.ts · proxy.ts · *2026-08-07 contexto-mako-md*

#### Una signed URL nueva por request mata el caché y triplica el egress

En Supabase Storage cada token de signed URL único genera una entrada de caché SEPARADA en el Smart CDN. Generar la URL al vuelo con expiry corto en cada request hace que ningún request pegue en caché: se paga egress no cacheado ($0.09/GB) en vez del cacheado ($0.03/GB), 3x, sin que nada avise. Para que el CDN sirva hay que reutilizar la MISMA signed URL (expiry largo / token estable). Aplica a todo lo que hoy se sirve firmado: archivero, wa-media, contratos y comprobantes, audios del Chat Agent.

**Vive en:** lib/supabase.ts (createSignedUrl) · app/api/doc/route.ts · lib/setting-audios.ts · *2026-07-21 ~research-storage-video-cursos*

#### Un identificador de ruteo duplicado como setting: 409 ilegible por un lado, desincronización por el otro

`META_PAGE_ID` está en `ROUTING_CREDS` (lib/credenciales.ts) porque es la clave con la que se rutea el webhook de Meta a su workspace. Consecuencia no comunicada: si ese page id ya lo reclamó otro workspace, guardar la credencial tira 409 `IdentificadorOcupadoError` con «ya está en uso por otro espacio de trabajo» — un mensaje que para el cliente no significa nada y que no le dice qué hacer. Y el MISMO dato vive duplicado como setting `meta_page_id` (SETTINGS_WIZARD en app/api/onboarding/route.ts): dos lugares donde se escribe el page id, y solo uno de los dos valida unicidad, así que el wizard puede dejar un valor que la credencial rechaza. Regla: un identificador que sirve de clave de ruteo de webhooks tiene UN solo lugar de escritura, y su error de colisión necesita copy propio.

**Vive en:** dashboard-marketing/lib/credenciales.ts (ROUTING_CREDS), lib/webhook-routing.ts:32-38, app/api/onboarding/route.ts (SETTINGS_WIZARD), lib/config.ts:46 · *2026-07-31 auditoria-tokens-meta*


### Reglas que quedan

#### Cómo correr un lib del repo a mano, sin levantar Next

Tres cosas que se comen media hora cada vez. (1) `import 'server-only'` revienta el script: hay que correr con `NODE_OPTIONS="--conditions=react-server" npx tsx scripts/x.ts` (así lo neutraliza el export condicional de server-only). (2) No hay `"type":"module"`, así que los .ts corren como CJS y el top-level await falla con «Top-level await is currently not supported with the cjs output format»: envolvé en `async function main(){}; main();` o usá .mts. (3) El dotenv de `.env.local` va en su propio bloque ARRIBA de los imports de libs. Y ojo con el scope: `procesarReunionesNuevas(ws)` NO se auto-scopea — pasarle 9 pelado hace que `getWorkspaceActual()` caiga a OWNER_WS y leas/escribas en el workspace equivocado; usá `correrPorWorkspace('fathom', ws => ...)` como hace el route.

**Vive en:** scripts/*.ts (patrón en scripts/backfill-calendly.ts:8-10 y backfill-meta.ts:17-21); lib/cron-workspaces.ts:52; lib/workspace.ts:80 · *2026-07-29 · ~forense-canal-mako-mudo*

#### En un cron multi-inquilino, un campo opcional vacío no es un error: 500 solo si fallan TODOS los configurados

`PANDA_VSL_VIDEO_IDS` está marcado `opcional: true` y su propia ayuda dice «completalo solo si querés las métricas del VSL», pero `integracionConectada('panda')` solo exige la API key: el ws9 entraba al loop, salía por `{error:'PANDA_VSL_VIDEO_IDS vacío'}` y clavaba el cron en 500 todos los días, para siempre, con ws1 ingestando perfecto. La alarma que el cambio agregó para que la falta de datos dejara de ser invisible nacía sonando, y una alarma que suena siempre se silencia: el rojo de verdad quedaba enterrado desde el día uno. Hay que distinguir TRES estados y no dos — ingestó / omitido / falló — y alinear con los tres crons hermanos (`todoFallo = errores === total`). Ya aplicado en panda-daily y youtube-daily; la regla gobierna el próximo cron por workspace.

**Vive en:** app/api/cron/panda-daily/route.ts:45 y :102-120; convención en nutricion, email-broadcasts y crm-automatico · *2026-08-05 ~review-commit-firma-webhooks*

#### app_settings es last-write-wins sin CAS: nunca hagas read-modify-write alrededor de un await largo

setSetting es un upsert plano del value completo por (workspace_id,key), sin merge ni control de concurrencia. Dos casos medidos: (1) generarGuion lee el array ENTERO de mako.razones, espera varios segundos a la IA y reescribe desde el snapshot viejo — cualquier edición de copy/descripción hecha durante la generación se pierde en silencio, en DB y en pantalla; (2) el anti-eco del doer (KEY_SENT) es RMW sobre la misma key y con invocaciones concurrentes pierde ids propios, con lo que MaKo termina procesando el eco de su propia respuesta. El comentario del código dice que ese lost-update «ya se arregló», pero solo para los N mensajes de UNA respuesta, no entre invocaciones. Corolario: app_settings no sirve como cola ni como lock; para eso hace falta una tabla con claim atómico (UPDATE … WHERE estado='pendiente' … RETURNING).

**Vive en:** lib/settings.ts (setSetting) · lib/razones.ts (generarGuion) · lib/mako-doer-in.ts (registrarEnviados / KEY_SENT) · *2026-07-28 · ~review-onboarding-fabrica-creativos*

#### `getWorkspaceActual()` cae a OWNER_WS cuando no hay contexto, y eso reintroduce fugas ya arregladas

Varios `recordUsage` corren como fire-and-forget (`void recordUsage(...)`) y algunos adentro de `unstable_cache`, donde `cookies()` no está disponible. Ahí `getWorkspaceActual()` depende del AsyncLocalStorage de `runWithWorkspace`, y si el store no está seteado devuelve OWNER_WS (workspace.ts:79) en vez de fallar. Consecuencia: scopear una lib por el workspace actual es cosmético si el call-site corre fuera del contexto — la fila se estampa igual con ws=1. Regla: antes de scopear algo que se llama en background, garantizar que el path (MaKo/WhatsApp/crons) esté envuelto en runWithWorkspace, y verificarlo con una query de control agrupada por workspace_id, no leyendo el código del fix.

**Vive en:** lib/workspace.ts:79, lib/ai-cheap.ts:126,192,216,298 · *2026-07-23 trace-gemini-leak-ws*

#### Un presupuesto de tiempo chequeado al arranque de la iteración acota el INICIO, no el fin

El loop del sync de closing cortaba con `Date.now() - tStart > timeBudget` al principio de cada vuelta, con budget 210s y `maxDuration` 300. Una iteración que arrancaba a los 205s pasaba el chequeo y después corría una llamada Opus de 90-120s: total ~300-330s, la plataforma mata la función — DESPUÉS de que Claude cobró y ANTES del `upsertRow`. Se pagó el análisis y se perdió, y el candidato vuelve a la cola la corrida siguiente. El comentario del código decía «aire para que la última llamada termine» y era falso. La regla: el presupuesto tiene que reservar el peor caso de UNA llamada (`> timeBudget - PER_CALL_RESERVE_MS`), o el budget tiene que quedar por debajo de `maxDuration` menos ese peor caso. Hoy está mitigado bajando `DEFAULT_TIME_BUDGET_MS` a 150s, pero el chequeo sigue siendo solo al tope del loop.

**Vive en:** lib/closing.ts:704 (DEFAULT_TIME_BUDGET_MS) y :781 (el break del loop) · *2026-06-24 · ~review-closing-sync*

#### `git add <archivo>` explícito igual se lleva trabajo de la otra sesión

La regla escrita es «nunca `git add -A`, commiteá por ruta explícita». No alcanza: git stagea por ARCHIVO, y dos sesiones paralelas pueden tener cambios distintos dentro del MISMO archivo. Caso real: `lib/mako-context.ts` tenía la inyección de experimentos de una sesión y, en el mismo archivo, el refactor de prompts editables de la otra; `git add lib/mako-context.ts` metía el trabajo ajeno adentro de un commit titulado «solo experimentos». No rompe el build, pero el commit deja de decir la verdad y te adueñás de trabajo que no es tuyo. Cuando el archivo esté compartido: `git add -p` y stagear solo los hunks propios, o asumir el archivo entero a conciencia y decirlo en el mensaje.

**Vive en:** global · caso testigo lib/mako-context.ts · *2026-06-30 ~experimentos-medicion-y-ui*


### Decisiones tomadas, y por qué

#### La mudanza de dominio quedó viva solo por las exenciones del 410

El código y Vercel ya están 100% en hola-mako.com, pero NINGUNA de las 8 registraciones externas verificables apuntaba al dominio nuevo: 2 webhooks de Chatwoot, 4 de Evolution, 1 suscripción de Calendly y el beacon de la landing. Producción seguía funcionando por dos motivos accidentales: `proxy.ts` exime `/api/cron`, `/api/webhooks` y `/api/track` del 410 de mudanza, y los hosts viejos siguen atados al proyecto de Vercel. O sea, dos gatillos de muerte silenciosa: sacar las exenciones (cosa que el propio comentario del proxy invita a hacer) o despegar el dominio viejo. Lo importante para la próxima: el snippet de tracking CONGELA la URL base al copiarse — no es un webhook re-registrable por API, es HTML de un tercero que solo cambia un humano, y hay que repetirlo en la landing de CADA cliente. La checklist de mudanza no lo incluye.

**Vive en:** proxy.ts:61-64 (EXENTAS_DE_HOST) y la checklist de lib/app-url.ts:12-13; docs/lovable-tracking.md · *2026-08-05 · ~auditoria-mudanza-dominio*

#### `opcional` no es cosmético, y los dos DTOs de credenciales copian props a mano

Para el rediseño de Meta a un solo token la tentación era marcar los otros cinco campos como `opcional: true` y esconderlos. No se puede: `opcional` gobierna `integracionConectada`, el `faltan` de la verificación, `calcConectada` y el semáforo — con todo opcional menos el token, Meta pasa a «conectada» apenas pegás el token y se prenden /marketing, /experimentos y /ads-analyst, que revientan al pedir insights. La decisión fue una prop NUEVA y aditiva (`autodescubierto`), sin tocar `opcional`. Trampa asociada: el estado del servicio viaja por DOS DTOs que copian prop por prop a mano (el del API y el `type Campo` del form), así que una prop nueva del catálogo llega `undefined` sin ningún error de tipos — la falla más probable de ese rediseño. Y ojo con sacar envs del array `campos` para esconderlos: `ENVS_METODO` se deriva de ahí y es la whitelist de guardar/borrar/revelar.

**Vive en:** lib/metodo-catalogo.ts (CampoCredencial + ENVS_METODO), app/api/integraciones/credencial/route.ts:99-111, app/integraciones/ServicioConfigForm.tsx:37-51 · *2026-07-31 mapa-integraciones-meta*

#### El uso de Vercel se lee por `/v1/billing/charges`; `/v1/usage` no existe y el tope de gasto no tiene API

Verificado contra el índice completo de la REST API (40 categorías): no hay categoría `usage`, `spend` ni `budget`. Lo que sí existe es `GET /v1/billing/charges` (formato FOCUS v1.3, streameado como JSONL — una línea JSON por cargo, no un array), con `from`/`to` obligatorios, granularidad de 1 día, `ServiceName` para el desglose por servicio y `Tags` con ProjectId. Los «Build CPU Minutes» facturados NO salen de los deployments: `/v7/deployments` da el porqué (cuántos builds, cuánto duraron), `billing/charges` da el cuánto. El límite de gasto (Spend Management) se configura solo a mano en el dashboard — no hay endpoint para leerlo ni escribirlo —, pero tiene su propio webhook que dispara a 50/75/100 % con `{budgetAmount, currentSpend, teamId, thresholdPercent}`. Ninguno de los 56 event types de los webhooks de cuenta es de uso o gasto.

**Vive en:** pendiente: /api/cron/vercel-usage + tarjeta en /integraciones · *2026-07-23 vercel-costo-auditoria*

#### Google Drive queda descartado para servir el video de los cursos

No es una preferencia técnica: los ToS de la Drive API PROHÍBEN expresamente usarlo como reemplazo de un CDN y la «distribución amplia de video» sin consentimiento escrito — el caso de uso es una violación de política con riesgo de corte de cuenta. Además hay un bloqueo «download quota exceeded» no documentado que congela un archivo popular hasta 24h (justo el video visto muchas veces), un tope duro de 1 TB/día/proyecto, no existen signed URLs con expiración (el acceso es por permisos o link «cualquiera con el link») y el player letterboxea los verticales con su embed por iframe ya deprecado. Conclusión de la comparación: el video va a object storage con egress $0 detrás de CDN (Cloudflare R2, o Backblaze B2 + Cloudflare si manda el precio; Bunny Stream si se quiere player + ABR llave en mano), y Supabase Storage se queda para PDFs, imágenes y creativos, donde el egress no pesa. El factor que decide no es el storage, es el egress.

**Vive en:** sin código todavía: alimenta /conocimientos (portal de cursos) y la elección de bucket · *2026-07-21 ~research-storage-video-cursos*


### Lo que quedó sin hacer

#### crearNotificacion se traga que la tabla no exista

La migración `0048_notificaciones.sql` nunca se aplicó en prod: `public.notificaciones` NO existe (PGRST205 y confirmado por information_schema). Pero nada se rompe, porque `crearNotificacion` tiene su propio try/catch, loguea y devuelve null — el envío por WhatsApp sigue su curso. Resultado: el feed in-app y la cola de reintento (`canal_wa='pendiente'`) llevan meses muertos en silencio y ningún aviso deja rastro consultable. Un catch propio en el escritor convierte «falta media feature» en «no pasa nada».

**Vive en:** supabase/migrations/0048_notificaciones.sql (sin aplicar); lib/notificaciones.ts:97-100 · *2026-07-29 · ~forense-canal-mako-mudo*

#### youtube-check reporta «skipped» a todo cliente que sí tiene el video cargado

Los videos de la thank-you page ya son por workspace: el onboarding escribe `youtube_thanks_video_id` / `youtube_thanks_prep_video_id` en `app_settings` y `lib/youtube.ts` los resuelve con `configWs` (que cae al env solo para el dueño, fail-closed para el resto). Pero el endpoint de chequeo lee `process.env` directo, así que para cualquier cliente informa 'skipped' aunque tenga los dos videos cargados — un diagnóstico que miente sobre la feature que sí funciona. Es un cambio de dos líneas a `configWs`; recién después tiene sentido borrar los envs.

**Vive en:** app/api/admin/youtube-check/route.ts:32-33 · *2026-07-16 ~auditoria-env-vars*

#### `TABLAS_RESET` y `TENANT_TABLES` se separan solos y nada avisa

Son dos catálogos de la misma cosa (las tablas por-cliente) mantenidos a mano en archivos distintos: uno scopea las queries y el otro define qué se borra al resetear el Cliente de Prueba. Cada migración nueva registra la tabla en `TENANT_TABLES` y se olvida del reset, así que el ws 3 «vacío» conserva datos de la corrida anterior sin ningún error. Hoy faltan cuatro: `chat_agent_handoffs` (mig 0111), `mako_doer_buffer` y `mako_doer_lock` (mig 0113) y `productos` (mig 0117) — `landing_analyses`/`landing_drafts` ya se sumaron. La divergencia es silenciosa porque el borrado itera EXCLUSIVAMENTE sobre la constante, sin catch-all ni introspección del esquema. Lo que falta hacer: derivar `TABLAS_RESET` de `TENANT_TABLES` (excluyendo las vistas `v_cohortes_*`) o dejar un test que falle cuando las dos listas no coincidan.

**Vive en:** lib/reset-workspace.ts:29-60 (TABLAS_RESET) vs lib/workspace.ts:43-60 (TENANT_TABLES) · *2026-08-05 review-landing-tabs*

#### Falta el test de contrato TENANT_TABLES ↔ columnas workspace_id

Es el único chequeo que caza el drift «agregué la tabla al Set pero olvidé la columna» (error de Postgres en runtime) y, en la dirección inversa, «la tabla tiene workspace_id pero no está en el Set» (fuga silenciosa) — esa segunda dirección habría cazado el leak de v_cohortes ANTES de la migración 0084. Se verificó que hoy arranca EN VERDE con la allowlist de excepciones {app_settings, credenciales, funnel_config, usuarios}. Dos trampas del entorno para escribirlo: lib/workspace.ts tiene `import 'server-only'` y TENANT_TABLES no se exporta, así que hay que leer el archivo como TEXTO con fs y parsear el bloque `new Set([...])`; y los tests usan imports relativos porque tsx NO resuelve el alias @/. Testear el proxy getTenantDb en sí requiere extraer scopedFrom/scopedClient a un módulo puro — eso toca el núcleo de aislamiento y no es autónomo.

**Vive en:** tests/tenant-tables-contract.test.ts (a crear) · lib/workspace.ts:42-54 · *2026-07-13 · plan-autonomo-tanda2*

#### La zona horaria por workspace es un setting huérfano: siempre sale Tijuana

`tzDeWorkspace` y `setTimezoneWorkspace` (`lib/timezone.ts`) tienen CERO call-sites en todo el repo: nadie escribe nunca el setting `mako.timezone`, así que la función devuelve siempre `TZ_DEFAULT = 'America/Tijuana'` — y el SEED del plan declara esa tarea como hecha con los dos ítems en `true`. Consecuencia práctica: a quien trabaja desde Argentina las reuniones le figuran 5 horas antes. Y hay un bug latente del mismo tipo en `lib/reunion-destinatarios.ts:96-99` (`fechaLinda` usa `toLocaleDateString` SIN `timeZone`): corre server-side, Vercel corre en UTC, así que una reunión de las 21:00 de Tijuana se anuncia en el WhatsApp y en el mail del tercero con la fecha del día siguiente. Regla: en el server, nunca `toLocaleString`/`toLocaleDateString` sin `timeZone` explícito; y la cascada honesta para resolver la zona es setting del ws → `perfil.timezone` del admin del ws → Tijuana, mostrando la abreviatura ('15:30 PT') para que un default equivocado se vea en vez de engañar.

**Vive en:** lib/timezone.ts (tzDeWorkspace/setTimezoneWorkspace) + lib/reunion-destinatarios.ts:96-99 · *2026-07-29 reunion-multi-borrador*

#### Un cleanup «best-effort» no es un cleanup: 525 MB de basura en Storage

Consulta read-only a `storage.objects`: el proyecto arrastra 561 MB y 525 son 7 archivos .MOV de 68-79 MB en el bucket `ads-creatives`, subidos el 30-jun/1-jul y nunca borrados porque la limpieza de `app/api/ads-manager/creative-upload/route.ts:50,60` es `.catch(() => {})` y simplemente no corrió. Nadie se enteró porque no hay ninguna señal cuando falla. Dos cosas más del mismo barrido: los 5 buckets tienen `file_size_limit` en NULL (heredan el global) y `avatars` es el único `public:true` y se creó EN CÓDIGO con `createBucket` (`app/api/perfil/avatar/route.ts:47`) en vez de en una migración, así que no queda rastro versionado de su configuración.

**Vive en:** app/api/ads-manager/creative-upload/route.ts:50,60 · bucket ads-creatives · app/api/perfil/avatar/route.ts:47 · *2026-07-27 branding-mako-conocimientos*

#### El feed in-app de avisos está muerto en tres capas y falla en silencio en cada aviso

`emitirAviso` escribe el feed y manda el WhatsApp, pero el feed nunca funcionó: (1) la migración `0048_notificaciones.sql` existe en el repo y la tabla `notificaciones` NO está en producción — `crearNotificacion` (lib/notificaciones.ts:76-100) atrapa el error, logea «[notificaciones] crear falló» y devuelve null, así que rompe callado desde siempre; (2) `GET /api/notificaciones` devuelve `{items: [], unread: 0}` para todo workspace que no sea el dueño, y el super-admin opera en el ws 9; (3) ningún componente consume esa API — el `NotificationsProvider` es el polling de Chatwoot, otra cosa. Consecuencia: el único canal real de los 49 mensajes del catálogo de avisos es WhatsApp; si el mensaje se pierde en el scroll del grupo, el aviso no existe en ninguna parte. Decidir: aplicar la migración y cablear la campanita, o borrar el código y dejar de mentir.

**Vive en:** lib/notificaciones.ts:76, app/api/notificaciones/route.ts, supabase/migrations/0048_notificaciones.sql (sin aplicar) · *2026-07-30 · ~cola-de-accion-mako*

#### La extracción histórica del onboarding solo avanza con la pestaña abierta

Los 6 jobs de la extracción (`meta_metrics → meta_leads → ad_transcripts → script_analyses → fathom_calls → vsl_metrics`) avanzan por ticks, y `tickExtraccion` tiene UN solo llamador: `app/api/onboarding/extraccion/route.ts:55`, que dispara el `loopTicks` del wizard en el navegador. Ninguno de los crons de vercel.json la continúa. Si el cliente cierra la pestaña, la extracción queda donde estaba y nadie la reanuda hasta que él vuelva a entrar al wizard. Y el gate de la primera Retro es `meta_metrics.status === 'done'`, que es justo el job más lento (365 días con pausa por día con datos): el WOW del arranque depende de que el cliente no cierre el navegador.

**Vive en:** lib/onboarding-extract.ts (tickExtraccion), único caller app/api/onboarding/extraccion/route.ts:55 · *2026-07-16 · ~censo-features-onboarding*

#### ELEVENLABS se conecta, se pinta verde y no la usa absolutamente nada

El único lector de `ELEVENLABS_API_KEY` en todo el repo es el ping de «Probar conexión». No existe `lib/elevenlabs.ts` ni una sola llamada a api.elevenlabs.io fuera de esa verificación. El copy de /integraciones promete «Voz por IA: locuciones y audio generativo con tu propia key»: el cliente pega la key, la ve en verde, la da por andando, y no hay nada que la consuma. O se construye la generación de voz, o se saca del catálogo, o se marca como «próximamente».

**Vive en:** lib/metodo-verificar.ts:246 (único lector) · lib/metodo-catalogo.ts:274 · lib/integraciones-catalogo.ts:48 · *2026-08-05 · ~auditoria-ruleta-hidratacion-credenciales*

#### Los tres crons de reportes no iteran workspaces: solo el dueño recibe algo

`reporte-diario`, `reporte-horario` y `reporte-semanal` llaman `getContactoReportes()` y `getNotifPrefs()` sueltos, sin `correrPorWorkspace` ni `runWithWorkspace`: en un cron no hay sesión, así que el workspace cae al del dueño y el reporte sale una sola vez para él. Los crons de INGESTA sí hacen el fan-out (correrPorWorkspace); los de ENVÍO no. Esto es lo que hay que cerrar antes de venderle el semáforo al segundo cliente: la landing promete «elegís qué te llega y por dónde» y hoy eso corre sobre un perfil único. Verificado el 7/8/2026.

**Vive en:** app/api/cron/reporte-semanal/route.ts:23 · app/api/cron/reporte-diario/route.ts · app/api/cron/reporte-horario/route.ts · lib/cron-workspaces.ts:28 (el helper que sí hace el fan-out) · *2026-07-26 copy-semaforo (confirmado con el archivo en 2026-08-06 senales-de-avance)*

#### Las cuatro cosechas sobre `notificaciones` se contradicen; la buena es la que se midió contra prod

Hay cuatro entradas sobre lo mismo y no pueden ser todas ciertas: «el feed existe en la base y no lo muestra nadie» (2026-07-19), «crearNotificacion se traga que la tabla no exista» (2026-07-29 forense-canal-mako-mudo), «el feed in-app está muerto en tres capas» (2026-07-30 cola-de-accion-mako) y «la tabla `notificaciones` NO existe en producción» (2026-08-01 auditoria-plan-y-whatsapp). La versión buena es la última, que es la única medida contra prod, y explica a las otras tres: la migración existe en el repo (por eso «existe en la base» leyendo el código) pero nunca se aplicó, y `crearNotificacion` traga el error de tabla inexistente, así que las tres capas muertas son un solo síntoma. Ojo con la quinta entrada, que apunta a un paso más: `notificaciones` tampoco tiene `workspace_id` (2026-08-01 mako-cliente-prueba-diagnostico). Lo que queda pendiente es una sola cosa hecha en el orden correcto: aplicar la migración CON la columna workspace_id y recién ahí quitarle el catch mudo a `crearNotificacion` — si se aplica la tabla sin workspace_id, se enciende un feed que le muestra los avisos de todos a cada cliente.

**Vive en:** dashboard-marketing/lib/notificaciones.ts (crearNotificacion) + migraciones de supabase/ + lib/workspace.ts (TENANT_TABLES) · *2026-08-01 auditoria-plan-y-whatsapp (contra 2026-07-19, 2026-07-29 forense-canal-mako-mudo y 2026-07-30 cola-de-accion-mako)*

