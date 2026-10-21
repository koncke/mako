# La IA del cliente: su Claude y su GPT, en su computadora

**Mapa de la pieza 3.15, «Tus cuentas de IA»** (Ticketera, 21/10/2026). Primero el mapa, después las olas.

> **El pedido** (Martín, 21/10 01:28, pedido 469d465d): «Ya le respondí a Debate todo sobre la implementación de las
> cuentas de Claude y GPT para los clientes. Quiero que este al 100% eso, que puedan conectarlo, que haya un tutorial,
> que este 100% funcional». Y a las 01:30 (pedido 75a834b6): «No hagas más preguntas e implementalo al 100%».

**Lo decidido, que no se re-discute:**
- **D6a** (Martín, 21/10 01:26): el Claude o el GPT del cliente corre **en su computadora**, como hace Martín. Instala
  el programa OFICIAL y se loguea con sus cuentas, varias si quiere. MaKo le manda los pedidos y **nunca toma el token**.
  Si apaga la PC, ese chat no contesta.
- **20/10:** nadie paga el Ops Center de los usuarios; MaKo es el ejecutor de SUS suscripciones. Lo de fondo 24/7
  (atender leads) no va por la suscripción: es zona gris.
- **D6b**, el alcance lo decidió el Cerebro (21/10): Gemini no recibe datos de clientes nunca más; un negocio con su
  Claude o su GPT corre su Ops Center con SU cuenta, y Gemini no participa en sus turnos; lo interno de la plataforma
  (el Plan, el Perro, las reuniones) sigue igual por ahora.

Lo que el chat decidió solo está en §12, cada cosa con su porqué.

---

## 0. Qué ve el cliente

En **Integraciones → «Tus cuentas de IA»** toca «Conectar mi computadora». Baja «MaKo en tu computadora», lo abre, inicia
sesión con su Claude (o su ChatGPT) en el navegador y confirma un código de 6 letras en MaKo. La tarjeta pasa a «En
línea». Desde ahí su Ops Center contesta con SU Claude: el mismo chat de siempre, con las mismas tarjetas para
confirmar. Si apaga la computadora, la tarjeta dice «Sin conexión» y el chat le avisa.

---

## 1. Las piezas

| Pieza | Qué es | Dónde vive | Ola |
|---|---|---|---|
| La puerta | Emparejar una PC, su token por negocio, la cola de turnos y las respuestas | `lib/ia-pc*.ts`, `app/api/ia-pc/*`, mig nueva | 1 |
| Las herramientas | Las de MaKo para el Claude de la PC, por MCP sobre HTTP, con un token POR TURNO | `app/api/ia-pc/mcp/route.ts` | 1 |
| El turno | turnoApp manda el turno a la PC si está en línea y espera la respuesta | `lib/mako-turno-app.ts` | 1 |
| El programa | «MaKo en tu computadora»: espera turnos, corre `claude -p` restringido y contesta | `scripts/ia-pc/mako-pc.mjs` | 1 (Node) · 2 (ejecutable) |
| Tus cuentas de IA | El bloque: cada PC y cada cuenta, en línea o no, su plan y su % usado | `app/integraciones/TusCuentasIA.tsx` | 2 |
| El tutorial | Paso a paso Windows y Mac, copiado de Tailscale | `app/integraciones/tutorial-ia-pc/` | 2 |
| Varias cuentas | Una carpeta de Claude por cuenta (`CLAUDE_CONFIG_DIR`), y rota la que tiene cupo | el programa + el bloque | 2 |
| GPT con Codex | `codex exec` con «Sign in with ChatGPT», mismas herramientas por MCP | el programa | 3 |
| Sin IA de Gemini | Un negocio con su Claude o su GPT no pasa por la cascada barata | `lib/anthropic.ts`, `lib/mako-turno-app.ts` | 1 |
| Su Claude por API key | 25f9bbca6, ya hecho: el otro camino, y el respaldo con la PC apagada | `lib/anthropic.ts` | 1 (se integra) |

---

## 2. El programa en la PC: «MaKo en tu computadora»

Es una versión del cartero de Martín (`scripts/operaciones/cartero.mjs`) para un cliente. La diferencia de fondo: la
PC de Martín confía en sus pedidos firmados y ejecuta cualquier cosa; **la del cliente es sólo el cerebro, nunca las
manos.**

**Lo que hace:**
1. Se empareja una vez con un código de 6 letras (§3) y guarda su token en la carpeta del usuario, con permisos sólo de
   él.
2. Late cada 30 s (`POST /api/ia-pc/latido`) con su versión, sus cuentas, el plan y el % usado de cada una.
3. Espera turnos (`GET /api/ia-pc/turno?espera=25`, long-poll) y los corre DE A UNO.
4. Por cada turno corre Claude Code oficial así, con el texto por stdin y nunca en la línea de comandos:

   ```
   claude -p --output-format json --no-session-persistence
          --tools "" --strict-mcp-config --allowedTools "mcp__mako" --max-turns 12 --model sonnet
          --system-prompt-file <turno>/system.txt --mcp-config <turno>/mcp.json
   ```
   - `--tools ""` apaga TODAS las herramientas propias de Claude Code (terminal, archivos, web).
   - `--strict-mcp-config` + `--mcp-config` deja como únicas herramientas las de MaKo, por la puerta del turno (§4).
   - Corre en una carpeta vacía, y sin `ANTHROPIC_API_KEY` en el entorno: con ella, `-p` usa la key y no la suscripción
     (docs/hallazgos-ia.md).
   - ⚠️ **Nunca `--bare`**: apaga el login de la suscripción («OAuth and keychain are never read», `claude --help`).
5. Devuelve la respuesta (`POST /api/ia-pc/turno/<id>`): el texto, la cuenta que contestó y lo que gastó.

**Lo que nunca hace:**
- leer o mandar el token de la suscripción (no toca `~/.claude/.credentials.json` ni el Keychain);
- correr un comando que diga el servidor: el comando es fijo y lo arma el programa;
- poner texto de una persona en la línea de comandos (va por archivo o stdin).

**Empaquetado (ola 2, hecho):** un ejecutable de un archivo por sistema (Bun compila Windows, Mac con chip de Apple y
Mac Intel desde esta PC: `scripts/ia-pc/publicar-binarios.mts`), comprimido en el bucket privado `ia-pc`, y un
instalador de UNA línea (`/api/ia-pc/instalar`) que lo baja con una URL firmada, lo conecta con el código y lo deja
arrancando solo al prender la PC (Windows: Inicio; Mac: un LaunchAgent). Sin administrador. El ícono en la bandeja no
está: el estado se ve en «Tus cuentas de IA».

---

## 3. La puerta del servidor (multi-inquilino)

Es la puerta del Centro de Operaciones (AGENTS.md, «El Centro de Operaciones es una puerta a la PC de Martín»), pero a
la PC de CADA cliente, con la confianza al revés: en la PC de Martín la confianza vive en la PC; acá vive en el
**servidor**, porque la PC sólo piensa y nunca ejecuta.

**Emparejar:**
- El admin del negocio, en «Tus cuentas de IA», pide un código: 6 letras, 10 minutos, un solo uso, guardado por hash.
- El programa lo canjea (`POST /api/ia-pc/emparejar`) y recibe un token `mkopc_…` (32 bytes al azar). El servidor guarda
  sólo su hash, como los `mkoag_` del agente (`lib/agente-token.ts`).
- El token ata **un negocio, una PC y una persona** (quien la conectó: §10).
- Se revoca desde la tarjeta («Desconectar esta computadora»), y solo si esa persona pierde el acceso al negocio.

**Las tablas** (mig nueva, RLS sin políticas y `revoke`, como 0311 y 0313):
- `ia_pc_dispositivos`: ws, persona, nombre de la PC, hash del token, versión, `ultimo_latido`, cuentas (sin secretos),
  revocado.
- `ia_pc_turnos`: ws, dispositivo, sesión del chat, estado (`esperando → tomado → listo | vencido | error`), el pedido
  (system + historial + mensaje), la respuesta, la cuenta y el uso, el hash del token del turno y su vencimiento.

**Las reglas** (la lista para la revisión adversarial del Cerebro):
1. Cada ruta resuelve el **negocio por el token**, nunca por un parámetro. Un turno de otro negocio da 404.
2. El token de la PC sólo sirve para latir, tomar turnos de SU negocio y contestarlos. No abre `/api/v1` ni nada más.
3. Las herramientas van con un **token por turno** (10 minutos, el de ese turno). Corren con la vista de la persona que
   escribió y con las mismas reglas que el chat: las acciones dejan su tarjeta y se confirman en la app, nunca desde la
   PC.
4. Un turno se toma una sola vez (`esperando → tomado` atómico), y vence a los 5 minutos si no vuelve.
5. Lo que contesta la PC se trata como lo que contesta el modelo: pasa por `validarRespuestaDoer` y `sanearSalida`.
6. Tope por negocio: turnos por minuto y largo de la respuesta.
7. Datos de clientes: viajan a la cuenta de Claude DEL negocio, que es suya. Nunca a una IA gratis (D6b).

---

## 4. El viaje de un turno

1. La persona escribe en su Ops Center (o en el teléfono, o en la ficha de un lead). Todo pasa por `turnoApp`.
2. `turnoApp` arma lo de siempre (el system, el historial, las herramientas permitidas). Si el negocio tiene una PC de
   ESA persona en línea (latido de menos de 90 s), encola el turno en `ia_pc_turnos` con un token de turno.
3. La PC lo toma, arma `<turno>.json` con el servidor MCP de MaKo
   (`{"mcpServers":{"mako":{"type":"http","url":".../api/ia-pc/mcp","headers":{"Authorization":"Bearer <token del turno>"}}}}`)
   y corre `claude -p`.
4. El Claude del cliente llama herramientas: `tools/list` y `tools/call` llegan a `/api/ia-pc/mcp`, que corre la MISMA
   función que usa el turno de hoy (`runTool`: el gating, el memo anti-duplicado y las tarjetas).
5. La PC devuelve el texto. `turnoApp`, que estaba esperando (la ruta tiene 420 s), lo valida, lo guarda y lo muestra.
   La pantalla no cambia.
6. Si a los 240 s no volvió, el turno VENCE y el chat dice «Tu Claude tardó demasiado: mándamelo de nuevo». Lo que la PC
   conteste después no se muestra (§12.11).

---

## 5. La PC apagada

- Sin latido en 90 s, la PC está «Sin conexión», y la tarjeta lo dice con la hora del último latido.
- Un turno de esa persona con la PC apagada: si el negocio tiene su Claude o su GPT **por API key**, contesta con eso
  (es SU cuenta: 25f9bbca6). Si no, el chat dice «Tu computadora está apagada: préndela y mándamelo de nuevo». El mensaje
  queda guardado y no se encola, para no contestar horas después algo que ya no vale (§12).
- Nunca cae a Gemini ni a la cascada barata (D6b).

---

## 6. «Tus cuentas de IA»

Un bloque en Integraciones, copia de `ListaUso` (la lista de cuentas de Martín):
- **Cada computadora:** nombre, de quién es, «En línea» o «Sin conexión (hace 3 h)», la versión del programa, y
  «Desconectar».
- **Cada cuenta de esa PC:** Claude o ChatGPT, el email de la cuenta, el plan, el % usado de las 5 horas y de la semana,
  y cuándo se repone. Lo lee la PC:
  - Claude: `claude auth status` (método y carpeta), y el `/usage` del Agent SDK (`usage_report.rate_limits`, con
    `percent` y `resets_at`) o el `rate_limit_event` del stream. Lo que no venga se muestra «sin dato», nunca inventado.
  - Codex: `account/rateLimits/read` de `codex app-server` (`usedPercent`, `resetsAt`).
- **Su Claude o su GPT por API key** (el otro camino, ya hecho): el modal de siempre.
- **«Conectar mi computadora»** con el tutorial (§7).
- Con varias cuentas, la PC usa la de menos uso y saltea la que pasó el 95%.

---

## 7. El tutorial (copiado de Tailscale)

Se copia **Tailscale**: un programa que corre en segundo plano, un ícono en la bandeja o la barra de menú, «Iniciar
sesión» que abre el navegador, y el equipo que aparece en la consola web de la cuenta. De **Ollama** se toma «un
instalador, sin administrador, en segundo plano». Fuentes: tailscale.com/docs/install/windows (validada el 21/11/2025),
tailscale.com/kb/1016/install-mac, docs.ollama.com/windows (leídas el 21/10/2026).

Para un cliente no técnico, en Integraciones, un paso por pantalla:

1. **Elige tu computadora:** Windows o Mac (se preselecciona la que se detecta).
2. **Instala Claude** (o ChatGPT). El instalador oficial, con un botón «Copiar» y una imagen de dónde pegarlo:
   - Windows: abrir «PowerShell» desde el menú Inicio y pegar `irm https://claude.ai/install.ps1 | iex`;
   - Mac: abrir «Terminal» y pegar `curl -fsSL https://claude.ai/install.sh | bash`;
   - ChatGPT (Codex), en la ola 3: `irm https://chatgpt.com/codex/install.ps1 | iex` y `curl -fsSL https://chatgpt.com/codex/install.sh | sh`.
3. **Inicia sesión:** escribir `claude` y elegir «Claude account with subscription»; se abre el navegador.
4. **Conecta MaKo:** UNA línea para pegar en la misma ventana, con el código ya adentro
   (`irm "https://hola-mako.com/api/ia-pc/instalar?os=windows&codigo=ABC234" | iex`; en la Mac, con `curl … | sh`). Baja el
   programa, lo conecta y lo deja arrancando solo. La pantalla espera y pasa sola a «Tu computadora está en línea».
5. **Déjala prendida:** si la apagas, tu chat no contesta hasta que la prendas.

**Hecho como lo hizo el chat (ola 2):** el paso 4 era «descarga y ábrelo, escribe el código»; quedó en una línea, como la
de Claude, por dos razones: el cliente ya está con la ventana abierta del paso 2, y bajado por PowerShell o `curl` el
programa no lleva la marca de «descargado de internet», así que **SmartScreen y Gatekeeper no lo frenan sin firmarlo**
(§10). Probado de punta a punta en Windows; la Mac, sin probar (no hay una a mano): el instalador le pone la firma local
(`codesign --sign -`), que es lo que pide un chip de Apple para correr un ejecutable sin firmar.

---

## 8. Quien no conecta nada

- **Sin PC y sin API key:** todo sigue como hoy (la cascada con sus keys baratas, si las tiene). Ahora, sin datos de
  clientes para Gemini (D6b, §12).
- **Con su Claude o su GPT por API key:** su Ops Center corre con esa cuenta, sin la cascada barata.
- **Con su PC:** su Ops Center corre en su PC; con la PC apagada, por su API key si tiene una.
- Lo de fondo (AI Step, nutrición, reuniones, el Plan) **no** cambia: no va por la suscripción (D6a).

---

## 9. GPT con Codex: lo verificado (21/10/2026)

- **Planes:** Free, Go, Plus, Pro, Business, Edu y Enterprise incluyen Codex (learn.chatgpt.com/docs/pricing, doc viva).
- **Headless con la cuenta de ChatGPT:** sí. «`codex exec` reuses saved CLI authentication by default», con `--json`
  (JSONL: `thread.started`, `turn.completed`, `item.*`, `error`) y `--ephemeral`. OpenAI **recomienda una API key para
  automatizar** (learn.chatgpt.com/docs/non-interactive-mode).
- **El token:** `~/.codex/auth.json` o el almacén del sistema (`cli_auth_credentials_store`). «Treat auth.json like a
  password», y no compartirlo entre trabajos concurrentes: los turnos van de a uno (learn.chatgpt.com/docs/auth).
- **Herramientas:** MCP por stdio y HTTP streamable, en `config.toml` (`[mcp_servers.<nombre>]`, `url`,
  `bearer_token_env_var`) (learn.chatgpt.com/docs/extend/mcp). Que `codex exec` los cargue no está documentado: se mide
  en la ola 3.
- **El % usado:** `codex app-server` (`account/rateLimits/read`), que la doc marca como experimental en WebSocket.
- **Windows nativo** (Windows 11; 10 «best effort») y Mac.
- **La vía oficial nueva** «Sign in with ChatGPT» para apps de terceros (anunciada el 29/09/2026) está en prueba limitada
  con socios, sólo Plus y Pro (developers.openai.com/siwc/quickstart).
- **Fragilidad:** los modelos cambian rápido («GPT-5.5 retires from Codex with ChatGPT sign-in on October 14, 2026»).

---

## 10. Lo legal: el riesgo, y cómo se achica

⚠️ **Esto va al Cerebro, porque puede costarle la cuenta a un cliente.** Texto vigente de Anthropic
(code.claude.com/docs/en/legal-and-compliance, leído el 21/10/2026):
- **En contra:** «Anthropic does not permit third-party developers to offer Claude.ai login into their own applications,
  or to route requests through Free, Pro, or Max plan credentials on behalf of their users», y no pueden «collect, store,
  or intermediate Claude.ai credentials or session tokens».
- **A favor:** no impide que «an end user» entre «to the unmodified Claude Code binary with their own Claude
  subscription», y los límites de Pro y Max asumen «ordinary, individual usage».
- **Consumer Terms:** prohíben el acceso «through automated or non-human means… a bot, script» salvo donde lo permitan
  explícitamente, y «make your Account available to anyone else».

**Cómo se achica (decidido, §12):**
1. MaKo **nunca** ve, guarda ni intermedia el token: el binario oficial, sin tocar, en la PC del cliente.
2. **La cuenta es de UNA persona.** Sólo los turnos de quien conectó esa PC van a su Claude; los de su equipo, no
   (compartirla sería «make your Account available to anyone else»).
3. **Sólo turnos que pidió una persona**, en el momento. Nada de fondo ni 24/7 (D6a).
4. El tutorial le dice al cliente, en sus palabras, que es su cuenta y su uso, y que la puede desconectar.
5. Para GPT, lo mismo, y queda la API key como el camino recomendado por OpenAI para automatizar.
6. **La persona instala y corre el programa ELLA MISMA, y acepta con un toque** (el Cerebro, 21/10): «Tu Claude corre
   en tu computadora, con tu cuenta, y contesta sólo lo que tú le pides en MaKo. MaKo nunca ve tu clave ni tu sesión.»
   Sin ese toque no hay código, y la versión del texto que aceptó queda en el código y en la PC (mig 0321).

El Cerebro (21/10): la D6a la decidió Martín sabiendo que es zona gris, y no frena nada; la autorización de Anthropic y
la firma del programa (una compra) quedan para Martín en el cierre.

Lo que el código no arregla: una autorización escrita de Anthropic (ventas) para este uso. Ya estaba anotado como
pendiente en docs/hallazgos-ia.md («Que el cliente use SU Claude o su ChatGPT»). **Es del Cerebro, con Martín.**

**La firma del programa** (ola 2): sin firma, Windows muestra SmartScreen y la Mac lo frena. Firmarlo cuesta plata (el
certificado de Windows y la cuenta de desarrollador de Apple): **va al Cerebro**. Mientras tanto, el tutorial explica el
aviso.

---

## 11. Las olas

| Ola | Qué entra | Prueba de punta a punta | Tamaño |
|---|---|---|---|
| **1** | La puerta (emparejar, latido, turnos, la mig), el MCP con el token por turno, turnoApp que manda a la PC y espera, el programa en Node, D6b en el turno (con su Claude/GPT, sin la cascada barata), 25f9bbca6 integrado como respaldo | En esta PC: el ws3 emparejado con una carpeta de Claude, un mensaje en su Ops Center, la respuesta con una herramienta y una tarjeta | L |
| **2** | «Tus cuentas de IA», el tutorial, el ejecutable de un archivo (Windows y Mac), arranque solo y el ícono, varias cuentas con rotación, el % usado | El tutorial seguido de cero en el ws3, con dos cuentas | L |
| **3** | GPT con Codex (`codex exec`, MCP, su % usado) | El ws3 con una cuenta de ChatGPT | M |

Cada ola: test probado rompiéndolo, VERDE con el candado, commit sin pushear, revisión adversarial del Cerebro y la
prueba en el ws3.

---

## 12. Decidido por el chat, con su porqué

1. **La PC es sólo el cerebro** (`--tools ""` + MCP estricto): un mensaje de un lead con una inyección no puede abrir una
   terminal en la PC del cliente, y un servidor comprometido no puede correr nada ahí.
2. **Las herramientas por MCP sobre HTTP en el servidor, con un token por turno**, y no un MCP local: el gating y las
   tarjetas son los de hoy (un solo lugar), y la PC no necesita nada más que Claude Code y el programa.
3. **El servidor espera la respuesta** (la ruta tiene 420 s) en vez de cambiar la pantalla a «consultá después»: los
   cuatro chats que usan `turnoApp` no cambian.
4. **La cuenta es de una persona:** sólo sus turnos van a su PC (§10). Su equipo usa la API key del negocio o la suya.
5. **PC apagada: no se encola**, se avisa. Una respuesta horas después a «¿quién llamó hoy?» miente.
6. **Con la PC apagada, la API key de su Claude/GPT es el respaldo**: es SU cuenta (D6b la permite), y Gemini no.
7. **D6b en el turno:** si el negocio tiene su Claude o su GPT (PC o API key), el turno no pasa por la cascada barata
   (Gemini, Groq, Mistral, OpenRouter). Su OpenAI por API key sí, porque es su GPT.
8. **El ejecutable de un archivo**, y no una app de escritorio: lo que hace es esperar y correr un comando, y una app
   completa es más para firmar, actualizar y mantener. El ícono de la bandeja se suma en la ola 2.
9. **Se copia Tailscale** para el tutorial (§7): es la misma forma, un ayudante en segundo plano que se loguea por el
   navegador y aparece en la consola web.
10. **Codex en la ola 3:** `codex exec` con la cuenta de ChatGPT está documentado, pero que cargue los MCP no; se mide
    antes de prometerlo.
11. **Lo que no volvió a tiempo vence** (ola 1): un turno que contesta después de que el chat dejó de esperar lo
    contestaría una pantalla que ya no lo espera, fuera de orden. Se le pide a la persona que lo mande de nuevo.
12. **El modelo de la PC es Sonnet** (`--model sonnet`, ola 1): medido el 21/10, sin elegir, Claude Code usa Opus, que
    le gasta el cupo de 5 horas al cliente en pocos turnos. Que lo elija el cliente es de la ola 2 («Tus cuentas de IA»).
13. **El MCP del servidor es un relevo** (ola 1): la PC pide la herramienta, queda en `ia_pc_llamadas`, y la corre el
    MISMO `turnoApp` que espera, con su `runTool` (el memo, las tarjetas, los links de «Abrir para revisar»). Un segundo
    motor de herramientas sería un segundo lugar con las reglas.
14. **El modelo lo elige el admin** (ola 2) en «Tus cuentas de IA» (Sonnet, Opus o Haiku), y viaja con el turno. Es el
    ÚNICO valor del comando que viene del servidor, y la PC lo vuelve a pasar por su lista (`MODELOS_PC`).
15. **El % usado sale del stream** (ola 2): `claude -p --output-format stream-json` trae el `rate_limit_event` con el uso
    de las 5 horas y de la semana. `/usage` en `-p` no lo da («You are currently using your subscription», medido). Se
    mide en cada turno: sin turnos, «Sin medir», nunca inventado.
16. **Varias cuentas: una carpeta de Claude por cuenta** (`mako-pc agregar-cuenta`, ola 2) y se usa la de menos uso de
    las 5 horas, salteando la que pasó el 95%. Si todas están al tope, el chat lo dice.
17. **Los ejecutables en un bucket PRIVADO**, con URL firmadas de 10 minutos que arma el instalador, y comprimidos: el de
    Windows mide 119 MB y Supabase corta en 50 (comprimido, 43).
18. **Tope de pedidos en cada ruta de la PC** (ola 2; lo pidió la guarda de tests/rutas-publicas-limite.test.ts): por IP
    al emparejar (10 cada 10 minutos, contra adivinar códigos) y al instalar; por PC o por turno en las demás.

---

## 13. Lo que no es de la Ticketera (para repartir)

- **La firma del programa** (Windows y Apple): plata, Cerebro.
- **La autorización de Anthropic** para este uso: Cerebro con Martín.
- **El doer de WhatsApp** (`lib/mako-doer-in.ts`): si un negocio con su Claude tiene que contestar por WhatsApp con su
  PC, eso es de «MaKo en WhatsApp». Por ahora WhatsApp no va por la suscripción (es lo de fondo, D6a).
- **Lo de fondo sin Gemini** (D6b, más allá de los turnos): AI Step, nutrición, reuniones. Cada uno es de su chat.
