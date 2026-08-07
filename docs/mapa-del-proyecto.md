# Mapa del proyecto — MaKo

Lo que una sesión nueva necesita saber **antes** de tocar algo y no puede deducir leyendo
el código. No es un changelog ni una lista de features: es el vocabulario, las fronteras,
el estado real de cada pieza y las trampas que ya costaron días.

Este documento no repite [AGENTS.md](../AGENTS.md) —el typecheck en el pre-push, «una
cosa, un lugar», la cosecha y las dos cuentas viven allá—. Leé ese primero; son las
reglas que gobiernan código nuevo. Acá está el mapa del territorio.

Lo que se aprende en el camino va a `docs/hallazgos-<área>.md` (índice en
[hallazgos.md](hallazgos.md)). Acá solo lo que orienta.

---

## 1. Qué es

MaKo es un dashboard de marketing **multi-inquilino** para agencias y sus clientes:
CRM, funnel, pauta de Meta, WhatsApp, email, un tablero de tareas y una capa de IA que
atraviesa todo. Next.js 16 (App Router) sobre Supabase, desplegado en Vercel.

Dos cosas que confunden a toda sesión nueva:

- **MaKo (el producto) ≠ Claude Code (vos).** MaKo es la IA que corre *dentro* de la app
  en runtime, marcada con la chispa dorada ✦. Vos sos el agente de desarrollo. En el
  historial del board se firman distinto —`'ia'` = MaKo, `'code'` = vos— y confundirlos
  es de las cosas que el dueño calificó de «muy grave»: hace parecer que el producto
  trabaja solo cuando en realidad fue un deploy.
- **El repo no está donde dice el nombre.** El git vive en
  `dashboard-marketing-main/dashboard-marketing/`. La carpeta padre solo tiene un
  `package-lock.json` huérfano de 103 bytes y su propio `.claude/` con **otro**
  `launch.json` (config «dev», con `--prefix`) distinto del del repo (config
  «dashboard»). Corré todo desde la subcarpeta.

---

## 2. El vocabulario

Sin esto, media conversación no se entiende.

| Término | Qué es |
|---|---|
| **workspace / ws** | El inquilino. Cada cliente es uno. `ws1` = Mauricio, `ws3` = «Cliente de Prueba» (donde se testea), `ws9` = Martín/super-admin, `ws10` = Leandro, `ws11` = Leila |
| **OWNER_WS** | Constante = 1. Herencia del arranque single-tenant. **Ya NO es «la agencia»**: el ws1 es un cliente. Para el super-admin se pregunta por `capa === 'superadmin'`, nunca por el número |
| **capa** | Qué producto compró el cliente (`workspaces.capa`, mig 0092). `pm` = solo el board y el Perro · `completo` = todo (default) · `superadmin` = el espacio de la agencia. Fuente única: `lib/capas.ts` |
| **El Perro Guardián** | La IA que prioriza y puntúa las tareas del board. En la UI nunca va solo: «Prioridades — El Perro Guardián» |
| **El Archivero** | El paso donde el cliente tira sus documentos sueltos y MaKo rellena el brief del negocio. Es «un botón», no un formulario |
| **Fase 1-5** | El diagnóstico del norte del negocio: Nacimiento · Crecimiento · Monetización · Escalamiento · Priorización. **En display son 1-5, el índice persistido es 0-4** |
| **R1 / R2** | Reunión 1 y 2 en todo texto visible. Los identificadores internos siguen siendo `j1`/`j2` (`fecha_junta_1`, `asistio_j1`) y no se tocan |
| **Doer vs Thinker** | Doer = MaKo ejecuta y te da el siguiente paso con el enlace. Thinker = analiza y explica |
| **Analyst vs Writer** | Analyst lee una fuente y persiste una fila por entidad (molde: `lib/closing.ts`). Writer toma un pedido y devuelve copy, sin fila por entidad (molde: `lib/campaign-structurer.ts`). Hay una skill para cada uno |
| **La Matriz** | La salida de la fábrica de creativos: avatar × razón de compra, 3×3 = 9 ángulos a testear |
| **Razones** | Las motivaciones de compra de cada avatar. **No** son dolor/deseo ni hooks |
| **El espejo** | La copia en nuestra base de todo lo que pasa por el WhatsApp no oficial, para reenganchar desde el historial si banean el número |
| **Borrador** | Mensaje que MaKo redactó y un humano manda con un clic. Es la salida obligatoria para leads calientes en el canal no oficial |
| **La cebolla / capas** | MaKo no se vende entero, se vende por capas. Ver `capa` arriba |
| **Gauntlet** | El pop-up bloqueante del Perro cuando una tarea Alta no tiene deadline ni checklist |
| **ComingSoon** | Una tab con `comingSoon: true` en `nav.ts`: existe en la barra y no tiene funcionalidad. Hoy son ~20 de ~45 |

⚠️ **Tres pares que se confunden todo el tiempo:**

- **`/conocimientos`** (plural) = el portal de cursos de formación interna que lee el
  admin. **`/conocimiento`** (singular) = el RAG que consume MaKo (`mako_knowledge`).
  Un curso curado para MaKo va en **los dos**.
- **«Content Machine»** es el *label* de la tab; la *ruta* sigue siendo `/ads-writer`.
  `/content-machine` es un **404 duro**: el rename se hizo y se revirtió a propósito.
- **`rol` vs `rol_ws`.** `usuarios.rol` es el eje global (`admin` = equipo de la agencia).
  `usuarios.rol_ws` es el eje del negocio (`admin` = dueño de *su* workspace, o
  `closer`/`setter`). **Medido en producción: los 5 usuarios no-admin tienen `rol_ws`
  literalmente en `'admin'`.** Gatear propiedad de la agencia con `rol_ws` le entregó la
  biblioteca entera de prompts a cualquier cliente.

---

## 3. Dónde vive cada cosa

```
app/          Next 16 App Router. ~52 tabs + app/api (201 route.ts)
  _ui/        primitives del rediseño (Button, Select, Field, tokens.ts, ui.css) + LEEME.md
  _components/ 40 compartidos (Sidebar, WizardShell, nav.ts, pila-modales.ts)
  components/ legado, 4 archivos, no crece
lib/          231 módulos planos. Toda la lógica de servidor
docs/         los hallazgos por área + este mapa
scripts/      ~110 sueltos, NO en package.json, pegan contra PROD
supabase/     solo SQL. 130 archivos de migración, numerados hasta 0122
tests/        38 *.test.ts con node:test + tsx
.claude/skills/  27 skills propias del proyecto
```

Los módulos que toca todo el mundo:

| Módulo | Qué resuelve |
|---|---|
| `lib/workspace.ts` | **El más importado del repo (133).** `getWorkspaceActual()` + `getTenantDb()` |
| `lib/supabase.ts` | El único cliente server-side. Usa **service_role: bypassa RLS** |
| `lib/credenciales.ts` | `credWs(clave)` — el token del workspace del request, cifrado |
| `lib/model-registry.ts` | Qué modelo usa cada feature, con override en `/modelos-ia` |
| `lib/prompt-registry.ts` | Todos los prompts, editables desde `/configuraciones` |
| `lib/tab-access.ts` | `requireRolWs` / `requireCapa` — el enforcement server-side |
| `lib/pipeline.ts` + `funnel_config` | La definición formal del proceso comercial |
| `proxy.ts` (raíz) | El gate de sesión. **Next 16 renombró `middleware.ts` a `proxy.ts`** |

Comandos: solo existen `dev`, `build`, `start`, `lint`, `typecheck`, `test`. No inventes
otros. `npm test` se corre **desde bash**, no desde PowerShell: el glob
`tests/*.test.ts` lo expande el shell y PowerShell no lo hace para ejecutables nativos.

---

## 4. Las cinco fronteras

Casi todos los bugs graves del repo son alguna de estas cinco cruzada por descuido.

**1 · El aislamiento entre clientes lo hace la APLICACIÓN, no la base.** Todo el runtime
entra con `service_role`, que bypassa RLS por diseño. Un `.eq('workspace_id')` olvidado
**es** el leak. Por eso toda tabla por-cliente se lee con `getTenantDb()`. Tres huecos
que hay que saber: `usuarios` **no** está en `TENANT_TABLES` (se filtra a mano), las
**vistas** no se scopean solas (tienen que exponer la columna *y* estar en el Set), y el
proxy intercepta `.from()` pero **no `.storage`** — borrar un archivo por path ya destruyó
el binario de otro workspace.

**2 · Fail-closed, nunca al dueño.** Sin workspace resuelto se devuelve vacío o se
rechaza. Caer a `OWNER_WS` no es un default benigno: es escribir en los datos del cliente
más grande. Los webhooks resuelven el inquilino desde el payload vía `webhook_routing`.

**3 · Las credenciales salen de `credWs()`, nunca de `process.env`.** `process.env` solo
se hidrata desde OWNER_WS. Leer el env directo hacía que la key del cliente se pintara
verde y no se usara nunca: el consumo lo pagaba la agencia.

**4 · El modelo y el prompt son config, no código.** Nunca pases `model:` explícito a
`chatClaude` — cortocircuita el registro en silencio (`if (!opts.model && opts.feature)`),
y ésa fue la causa raíz literal de «usás Opus de más». El `feature:` tiene que ser
**exactamente** una key de `CATALOGO_MODELOS`: un mismatch no falla ni loguea, y lo que
queda fuera del registro cae al default duro = Opus 4.8 + effort `high`, lo más caro que
hay.

**5 · El acceso se hace cumplir en el servidor.** El filtrado del Sidebar es cosmético:
sin `requireRolWs` en el `page.tsx`, se entra tecleando la URL. Y las `key` de `nav.ts`
son **contrato con la base**: cambiar una apaga la tab en los clientes que la contrataron.

---

## 5. Cómo se escribe acá

Lo que una sesión nueva viola en el primer mensaje.

**El idioma.** La UI va en **español neutro profesional** (de «tú» o impersonal): el
producto se usa en México y el tono rioplatense se lee como descuido. La **única**
excepción es la voz de MaKo cuando le escribe a un lead — ahí sí vosea, porque es la
persona de marca. Estos documentos del repo también van en voseo.

**Los nombres.** Cada tab, botón o card se tiene que entender **solo**, sin contexto.
Explícito le gana a ingenioso. Los apodos con personalidad solo valen acompañados:
«Prioridades — El Perro Guardián», nunca «El Perro Guardián» a secas.

**Sin subtítulos.** Nada de párrafos descriptivos bajo los títulos. La única bajada
admitida es la «línea de propósito» de `PageHeader`, y si se deduce del título se deja
vacía. Cero emojis en la UI: los botones llevan `<Icon>`.

**La IA facilita.** Nunca preguntas abiertas. MaKo sugiere o decide; si tiene que
preguntar es **cerrado**, con 2-4 opciones ya escritas y material real del negocio, y
siempre hay un botón «✦ MaKo lo hace solo». El orden de la configuración es: default
sano → plantilla → sugerencia → IA → editor manual como último recurso.

**Preguntá hechos, no acciones.** En un formulario, la pantalla 1 pregunta un hecho del
mundo real («¿La tuvieron?»), nunca una acción de CRM. La consecuencia se deriva del
funnel del workspace. Y al Perro **jamás** se le pregunta la prioridad: se le preguntan
deadlines, qué bloquea y qué mueve en plata.

**Copiá lo que ya existe.** `WizardShell` es el patrón de formulario de toda la app
(11+ archivos); si le falta algo, se le agrega la prop. Lo mismo con los primitives de
`app/_ui` y el `Dropdown` — **nunca** un `<select>` nativo.

**Cerrar no descarta, y te devuelve a donde estabas.** El modal de abajo se esconde y
vuelve con el scroll donde estaba (`useCapaModal`). Ninguna pieza apilada elige su
z-index. Nada de auto-abrir modales al entrar a una pantalla.

**Todo tiene que funcionar para clientes.** No razones «esto es solo del dueño»:
`getWorkspaceActual() ?? OWNER_WS`, nunca gatear a OWNER_WS.

**Toda tab tiene onboarding** antes de entregarse, con las mismas 3 etapas: Conectar
(con prueba de vida real) → Contexto (pedir un artefacto que ya existe, nunca que el
usuario redacte) → Ensayo (MaKo hace de cliente). El caso testigo fue una tab con 19
jugadas que nadie podía prender.

---

## 6. Estado real

Lo que está construido de verdad, lo que está a medias y lo que es solo una tab en la
barra. Sirve para no reconstruir lo que existe ni prometer lo que no.

| Pieza | Estado | Lo que falta |
|---|---|---|
| Multi-inquilino, impersonación, roles | funciona | Los crons que **envían** siguen owner-only |
| CRM + funnel derivado de `funnel_config` | funciona | `deriveStageKey` solo emite keys canónicas: un funnel renombrado ubica mal los leads |
| Board `/plan` + Perro Guardián | funciona | Los dos boards divergen (dueño vs cliente); quitar `dismissableGauntlet` |
| Reunión → plan (Fathom) | funciona | Dedup por título+fecha: dos notetakers = dos análisis pagados |
| Doer de MaKo por WhatsApp | funciona | Solo escucha en **grupos**; la línea de voz es el número personal de Martín |
| Fábrica de creativos | funciona | Falta imagen y video por celda; el bucle con Ads Analyst no existe |
| Meta Ads — lecturas y escrituras de estado | funciona | Nada. Los comentarios del código que dicen lo contrario están viejos |
| Meta Ads — **crear** campañas | a medias | Código completo y revisado, **nunca se publicó de verdad** |
| Rediseño (9 partes) | 2 de 9 | Primitives y App Shell hechos. La adopción es casi nula: 5 archivos importan `@/app/_ui` y quedan 7.680 `style={{}}` |
| Nutrición WhatsApp/email | motor completo | **No envía nada**: flags apagados, falta destilar la voz del cliente |
| Email (Resend) | verificado | `EMAIL_SEND_ENABLED='false'` — decisión de go-live, no olvido |
| Cifrado de credenciales v2 | funciona | Las 31 filas en gcm2, downgrade cerrado |
| RLS / grants a `anon` | cerrado (mig 0118) | **Falta revisar las policies de los buckets de Storage** |
| Ruteo de webhooks por workspace | a medias | **Bug vivo:** `upsertRouting` reasigna un identificador a otro workspace con un warn y sigue |
| BYOK de IA | a medias | Quedan 9 usos de OpenAI directo y `meta-write`/`meta-ads-create` leyendo el env crudo |
| Second Brain, Modo Simple, Setter IA | no existe | Declarados, sin construir |
| ~20 tabs `ComingSoon` | no existe | Moldes en las skills `scaffold-mako-analyst` / `scaffold-mako-writer` |

**Dos bugs vivos que conviene tener en la cabeza**, porque envenenan datos y no avisan:

- **El Archivero acepta cualquier URL.** `procesarLink` corre la extracción sobre el HTML
  de cualquier link pegado y `computeEffective` itera con «el último pisa»: pegar la web
  de un competidor le reescribe los 11 campos del brief al cliente, y ese brief después
  alimenta avatares, razones y guiones.
- **El chat de un gráfico congela su contexto.** Una sesión abierta en enero responde con
  los números de enero indefinidamente (`app/api/chart-insights/route.ts`).

---

## 7. Las trampas

Ordenadas por lo que costaron. Todas tienen en común que **el diagnóstico obvio era el
equivocado**.

**Lo que se ve no es lo que se pushea.** Se reportó dos veces una feature como lista y el
dueño abrió la app y vio la versión vieja. El código estaba bien y estaba pusheado: el
build de Vercel fallaba por un símbolo huérfano (un archivo se commiteó y el que define
su función, no) y **Vercel no revierte ni avisa** — deja el deploy anterior en pie y el
sitio anda con código de tres builds atrás. Las tres redes de seguridad del repo miran el
**árbol de trabajo**, donde el archivo sí está: un archivo sin commitear las pasa todas.
Después de cada push verificá el deploy y decí «pusheado», no «está en producción».

**PostgREST corta en 1000 filas sin error.** `.limit(9000)` **no** sube el techo del
servidor. Y `.range()` es OFFSET/LIMIT: sin `ORDER BY` único, la página 2 repite filas de
la 1 y saltea otras. Usá `lib/supabase-paginado.ts`. Columnas que engañan porque se
repiten: `wa_timestamp`, `ad_id`, `fecha`, `created_at`.

**Un techo de tokens no falla: RESUME.** Un `maxTokens` fijo corta el JSON, el parse
tira, el caller ve cero resultados y es indistinguible de «no había nada». Pasó dos veces
con daño real: 20 tareas entraron al tablero con score inventado, y una reunión de 2 horas
devolvió 8 tareas contra ~95 reales. El patrón resuelto es `topeSalidaPerro(n)`: el techo
de salida **escala con N**. Si estás debuggeando una extracción vacía, buscá primero el
warn de `finish_reason`.

**Levantar el dev server local ESCRIBE en producción.** El `.env.local` apunta a prod y
el boot corre `migrarEnvACredenciales()`, que copia a la base toda clave del catálogo que
esté en el entorno. Ya pasó con `RESEND_FROM`: se borró de prod y volvía a escribirse en
cada arranque. Después del boot, verificá que los logs digan «hidratadas» y **no**
«migradas». Lo mismo con `scripts/`: los `probe-*`/`check-*` leen, los
`backfill-*`/`wipe-*`/`limpiar-*` escriben, y todos pegan contra prod.

**Las migraciones no se aplican en el deploy.** Y `supabase-js` **no lanza**: devuelve
`{error}` que nadie chequea. Las migraciones 0075/0076 nunca corrieron, faltaba una
columna, y **todo** insert al espejo de WhatsApp falló en silencio durante días. El
síntoma fue «no llegan mensajes de WhatsApp». Aplicalas con `scripts/apply-migration.mjs`,
que además hace el `NOTIFY pgrst,'reload schema'` sin el cual PostgREST no ve la tabla
nueva. Hay **130 archivos pero la numeración llega a 0122**: ocho números están duplicados
por sesiones paralelas. Mirá el último número, no el conteo.

**Nunca colapses un fallo de lectura en un valor de negocio.** Es el patrón que más se
repite en el repo. Un `catch → []` río abajo convierte «se rompió» en «no hay nada», que
son opuestos. Un `?? 0` en el porcentaje del VSL hizo que 18 días sin instrumentación
parecieran 18 días de gente abandonando en el segundo cero, con la pauta corriendo.
Degradar se decide por dato y se **muestra** («lista parcial»), nunca por omisión.

**Un dato en dos almacenes se desincroniza en silencio.** Un cliente cargaba sus
credenciales de Panda/YouTube, la UI las pintaba verde, la ruta respondía `ok:true` con
HTTP 200 — y la ingesta no corría nunca. `configWs` leía `app_settings` y `/metodo`
guardaba en `credenciales`. Mismo molde: el `env` del catálogo de integraciones tiene que
coincidir **exacto** con lo que lee la lib, o `credWs` devuelve `null` en silencio.

**Gemini piensa por default y se come el presupuesto.** En el endpoint OpenAI-compatible,
los tokens de razonamiento salen del mismo `max_tokens` y la respuesta se corta a mitad de
frase incluso en prompts triviales. Se apaga con `reasoning_effort:'minimal'` — `'none'`
da HTTP 400. Y la traducción de effort entre Claude y Gemini es **lossy**: baja un
escalón.

**El free tier de Groq topea en 8.000 tokens por minuto**, que no es el contexto del
modelo: es lo que la cuenta deja pasar. Un prompt de 48k rebotaba por toda la cascada y lo
atendía el modelo más chico que quedara: la búsqueda del plan tardaba 57s y contestaba
mal. No fallaba — contestaba mal, que es peor.

**Cuando algo «pierde contexto», mirá QUÉ le llega a cada eslabón, no cuánto texto hay.**
El ruteador mandaba tareas a cuatro proyectos sin relación. El detalle medía 2.689 chars y
estaba intacto: a la función le llegaban solo `{titulo, grupo}`. El prompt que veía el
modelo eran cinco líneas de títulos sueltos.

**16 mensajes en 4 segundos = 16 corridas.** El tablero apareció con 99 tarjetas
duplicadas y 19 proyectos inventados y parecía un problema de dedup. No lo era: cada
mensaje entrante disparaba su propia invocación, en paralelo y sin candado. Si volvés a
ver duplicados, mirá primero si hubo un lote. Anexo: `after()` de Next **no es durable**;
si Vercel recicla la instancia, lo diferido muere sin reintento.

**Una feature con el 90% construido se comporta igual que una que no existe** — y encima
parece que anda. El canal `cerrar` tenía el motor completo y cuatro cortes en serie río
abajo. Al cablear un canal nuevo, seguí el dato en las cuatro paradas: UI → route →
listado → badge, con una fila real.

**El entorno local miente en tres formas.** El repo vive en OneDrive: Turbopack pelea con
la sincronización, el dev server va lentísimo, los screenshots dan timeout y aparece un
error fantasma («X defined multiple times» apuntando a una línea que no existe) que no es
real. El dev-login local resuelve como `legacy → OWNER_WS`, así que los cambios en la
resolución de workspace no se ven en local. Y `CREDENCIALES_SECRET` no está en el
`.env.local`: eso se prueba en Vercel.

**Para verificar datos de un cliente hay que impersonar SIEMPRE**, aunque seas
super-admin: sin impersonar caés a OWNER_WS y estás mirando otro workspace. En dev,
`/api/auth/dev-login?ws=3&next=/<ruta>` y probá en el ws 3. Sin el `?ws=N`,
`getWorkspaceActual()` queda en `null` y las rutas responden 403, que se lee como problema
de permisos y no lo es.

**La capa `superadmin` (ws9, Martín) no ve casi ninguna tab.** Tiene un allowlist de
`navKeys` y `requireCapa` redirige. Si construiste una tab y «no aparece», impersoná ws1
o ws3 antes de buscar el bug.

---

## 8. Dónde seguir

- [AGENTS.md](../AGENTS.md) — las reglas que gobiernan código nuevo. Se lee antes de escribir.
- [docs/hallazgos.md](hallazgos.md) — el índice de lo aprendido por área.
- [docs/dos-cuentas.md](dos-cuentas.md) — el protocolo de las dos cuentas de Claude.
- `.claude/skills/` — 27 skills del proyecto. Hay una para casi todo lo que este documento
  menciona como patrón: `tenant-safe-query`, `add-provider-integration`,
  `author-numbered-migration`, `add-editable-prompt`, `tab-onboarding`, `add-cron-job`,
  `scaffold-mako-analyst` / `-writer`, `audit-route-cross-tenant`.
- `graphify query "<pregunta>"` — el grafo del repo, antes de grepear a lo bruto.
