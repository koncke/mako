# El Centro de Operaciones: pedidos, cuota y señalador para las tres cuentas

Pedido de Martín (15/10/2026), después de preguntar si se podía armar adentro de MaKo:

> «Crea ese centro de operaciones, es lo más prioritario de todo… Que no solamente se conecte a
> las 3 cuentas, sino que pueda gestionar el USO y advertir cuando se está acercando al límite…
> Que gestione solo el guardado de contexto para las demás cuentas y que también se preocupe por
> ahorrar tokens, por ejemplo si mando una tarea fácil, que le diga a los chats qué modelo de IA
> deben usar… que pueda tener una funcionalidad de ventana emergente o algo así del chat, y que yo
> le pueda indicar QUÉ quiero cambiar como si estuviera eligiendo elementos dentro de cada tab,
> como si estuviera con F12… Fíjate que todo el tiempo te estoy pasando capturas, esto lo evitaría…
> Tal vez incluso que organice los chats para cada cuenta… Así les cuesta menos contexto.»

**Qué promete, en una frase (corregida el 15/10, ver §1 y §7):** desde MaKo se dejan pedidos
firmados para los chats de las tres cuentas, **que corren a la vez: una en la app de Claude y las
otras dos en terminal**. Cada cuenta tiene su cartero, y un pedido sale apenas el cartero de su
cuenta pasa y el chat está abierto; si no, espera y la pantalla dice qué espera. Se ve la cuota de
las tres, cada una con la fecha en que se midió. Y se señala un elemento de la pantalla en vez de
mandar una captura.

**Estado (15/10/2026): la etapa 1 está construida y verificada de punta a punta** contra un servidor
local (§9). Falta instalarla contra producción, las cuentas de terminal y la versión del teléfono:
`/admin/operaciones` en un celular hoy cae en la cubierta «se usa en la computadora». Lo que costó, en
[hallazgos-operaciones.md](hallazgos-operaciones.md).

---

## 0. La primera pregunta: ¿qué agrega el Centro sobre Remote Control?

**Remote Control ya existe.** Cada chat de la app de escritorio se puede abrir desde
claude.ai/code en el teléfono y escribirle ahí (`remoteControlAutoEligible: true` en el registro
de la app, medido el 15/10). O sea que «mandar trabajo a un chat de la cuenta activa desde el
teléfono» **ya está resuelto**, sin construir nada.

Lo que el Centro agrega, y es lo único que justifica construirlo:

| | Remote Control | Centro |
|---|---|---|
| Escribirle a un chat de la cuenta ACTIVA | sí | sí |
| Dejar un pedido para un chat de una cuenta NO activa | no | sí: queda en el buzón hasta el cambio |
| La cuota de las tres cuentas, cada una con su fecha | no | sí |
| Señalar un elemento en vez de mandar una captura | no | sí |

**Si para Martín lo único que vale es el señalador, se construye sólo el señalador** (es la
etapa 3 de §9 y no necesita cartero). Es la decisión que más trabajo ahorra, y va primera en §10.

---

## 1. Lo que NO puede hacer, medido el 15/10/2026

Esto decide si sirve, y va antes de cualquier función:

- **La app corre UNA cuenta por vez.** Cada cuenta tiene su propio juego de chats en
  `%APPDATA%\Claude\claude-code-sessions\<carpeta>\` —hay tres «Estrategia 3 cuentas», tres
  «CRM»…— y sus ventanas de actividad no se superponen nunca: al pasar de cuenta, los chats de la
  anterior quedan parados. `ListAgents` sólo ve los chats de la cuenta activa. **Un pedido para
  otra cuenta no se puede entregar: espera.**
- **MaKo no puede iniciar una cuenta de Claude.** Las credenciales viven en la máquina de Martín.
  El Centro encola; quien entrega corre en la PC.
- **Si la PC está apagada, la cola espera.** No es un servicio: es un buzón.
- **Un script solo no puede entregar un pedido.** No hay una vía documentada para que un proceso
  le escriba a una sesión. Cada chat se anota en `~/.claude/sessions/<pid>.json` con un named pipe
  (`messagingSocketPath`, `peerProtocol: 1`) y un `.key` que lo autentica: es el protocolo
  INTERNO de Claude Code 2.1.295, y **no se usa**, porque la app se actualiza sola y un cartero
  armado sobre eso se rompe sin forma de arreglarlo. Lo que entrega es un chat que llama a
  `SendMessage` (§2), como ya hace el relevo tras una caída (`~/.claude/guardia/relevo.mjs`).
- **Entre chats no hay acuse de lectura.** A un chat de la app de escritorio no le vuelve ningún
  aviso de entrega: «enviado» quiere decir que salió, nunca que lo leyó. Y si el chat destino está
  en otro modo de permisos que el que manda, el mensaje **queda esperando que Martín lo apruebe en
  la PC**: desde el teléfono no sale.
- **La cuota sólo la lee un chat.** La herramienta es `get_usage` y existe únicamente adentro de
  una sesión. Un script lee lo que algún chat dejó escrito, o sea una foto con fecha (§4).

---

## 2. Las tres piezas

| Pieza | Dónde corre | Qué hace |
|---|---|---|
| **La pantalla** | MaKo, `/admin/operaciones`, sólo Martín | escribir y firmar el pedido, elegir el chat, ver el estado y la cuota |
| **El cartero** | la PC de Martín, en dos mitades (abajo) | trae la cola, verifica la firma, entrega, devuelve el estado, sube la cuota |
| **El señalador** | adentro de MaKo, en cualquier tab | elegir un elemento y que el pedido viaje con su ubicación (§6) |

El señalador no depende del cartero: sirve solo, aunque sea para armar el texto de un pedido que
después se pega por Remote Control.

### El cartero son dos mitades, porque un script no puede entregar

1. **El correo — una tarea programada, sin modelo y sin tokens** (el molde es el vigía de RAM,
   abajo). Consulta a MaKo hacia afuera cada pocos segundos —**no abre ningún puerto**—, baja los
   pedidos, **verifica la firma en código** (§3.1) y deja cada pedido válido en un buzón local por
   chat. Sube a MaKo los estados, la cuota y el mapa de chats vivos.
2. **La entrega — un chat «Cartero»** de la cuenta activa, con un modelo barato y el contexto
   chico, que despierta cada N minutos (un cron de la sesión), lee el buzón y le manda cada pedido
   a su chat con `SendMessage`. Comprobado el 15/10: un mensaje así despierta a un chat que estaba
   ocioso. Cuesta un turno del Cartero por vuelta, de la cuota de la cuenta activa: con el buzón
   vacío tiene que cortar en una herramienta.

La firma la verifica la tarea programada y no el Cartero: **una regla en un prompt no es una
regla**, y el modelo no tiene por qué ver credenciales.

**A probar (necesita el OK de Martín, porque toca `~/.claude/settings.json` de todos los chats):**
un hook asíncrono con rewake en cada chat que espere en su propio buzón y lo despierte solo. Sería
gratis y sin Cartero; lo que no se sabe es si un hook así puede quedar esperando y cuánta RAM pide
uno por chat (hoy hay 16 vivos).

### Cómo vive la tarea programada (el molde del vigía, medido el 15/10)

- **Se instala** con `Register-ScheduledTask` al iniciar sesión, sin pedir admin
  (`~/.claude/guardia/instalar-vigia.ps1`): prioridad 3 (con la 7 que pone Windows por defecto no
  llegaba a correr con la máquina cargada), sin límite de tiempo, 3 reinicios si cae, una sola
  instancia. Adentro, un mutex propio y su log.
- **Sobrevive a que se cierre un chat** porque la lanza el Programador de tareas (su padre es
  `svchost`), fuera del árbol de procesos de la sesión. Lanzada desde un chat, muere con el chat.
- **Se para** con `Stop-ScheduledTask`, más `Disable-ScheduledTask` si no tiene que volver al
  iniciar sesión. El push integrado ya pausa y vuelve a prender al vigía así (62 arranques en su
  log).

---

## 3. Mandar un pedido

1. En `/admin/operaciones` Martín **escribe o dicta** el pedido, elige el chat (o el área) y lo
   **firma** (§3.1). La fila queda `escrito`; si el chat es de otra cuenta, la pantalla dice
   **«espera a que pases a la cuenta N»**, no «en cola».
2. **El Centro le agrega el contexto que ese pedido necesita, como RUTAS y no como texto**: el
   relevo del área, su `docs/hallazgos-<área>.md` y la decisión de la Ticketera de donde sale. El
   chat lee eso y nada más (§11).
3. La tarea programada la baja, verifica la firma y la deja en el buzón de ese chat.
4. El Cartero la manda con `SendMessage` → `entregado`. Eso dice que salió, no que alguien lo leyó.
5. **El chat deja un CIERRE de cuatro renglones** en MaKo: qué se decidió, qué quedó hecho, cómo se
   comprobó y qué sigue (y dónde) → `hecho`. Si el cierre trae una prueba (un commit, un deploy, una
   medición), pasa a `comprobado`.
6. Lo largo sigue donde estaba: la Ticketera, el repo, un push.

**Los cuatro estados son cuatro cosas distintas**: escrito ≠ entregado ≠ hecho ≠ comprobado.
Juntar dos es la forma en que un tablero miente en verde.

**Y cada pedido lleva un interruptor: «Sólo esto» o «Y de ahora en más».** Por defecto, «Sólo
esto». Con «Y de ahora en más», el cierre tiene que decir dónde quedó la regla (AGENTS.md, una
memoria o un hallazgo). Hoy esa diferencia se pierde, y por eso tantas reglas de AGENTS.md dicen
«lo repitió tres veces».

**Reglas que no se negocian:**

- **Un pedido se entrega UNA vez.** Se reclama con `update … where estado='en cola'` antes de
  entregarlo. Si el cartero reclama y se cae antes de mandar, el pedido queda **«no sé si llegó»**
  y **no se reintenta solo**: entregar dos veces es hacer el trabajo dos veces (es la regla de no
  reintentar lo que gasta). Martín decide con un botón.
- **Lo que no se pudo entregar lo DICE**, con el motivo: el chat está cerrado, la cuenta no está
  activa, el chat está en otro modo de permisos, la firma no vale. «No pasó nada» y «no se pudo»
  son dos respuestas.
- **Un chat se identifica por su id `local_…` y su carpeta de cuenta, nunca por el nombre.** Los
  nombres se repiten entre cuentas y dentro de una («Perro Guardián» y «Plan - Perro Guardian»).
- **Que un chat esté vivo se mira por el pid**, no por el archivo: `~/.claude/sessions/*.json` trae
  `status` (busy/idle), pero los archivos quedan después de cerrar el chat (el 15/10 había 34
  archivos para 16 chats vivos), y Windows reusa los pids: se compara también `procStart`.
- **Se listan sólo los chats de este clon** (`cwd`). La cuenta 1 tiene además sesiones de su
  titular que no son de este repo (aparecen por Remote Control), y no se tocan.

### 3.1 La firma: el precio de entrada, no una etapa

**Una fila de la cola es un prompt en un chat con permisos amplios**, o sea una consola en la PC
donde viven las tres cuentas. `getSesionAdmin()` protege la PANTALLA, no la FILA. Hoy podrían
escribir esa fila:

- quien tenga la `service_role` de Supabase, que vive en las variables de entorno de Vercel;
- cualquier usuario con `rol: 'admin'`, que no es necesariamente Martín (`lib/auth.ts:87`);
- un `next dev` local que le daba admin con escritura en producción a cualquiera de la red: abierto
  por `/api/auth/dev-login` en todos los checkouts, y cerrado el 15/10 en `4e2fb425b` (ver
  [hallazgos-seguridad.md](hallazgos-seguridad.md) → «`next dev` le daba un admin de producción a la
  red, y la puerta ACTIVA era `dev-login`»). Muestra que esta lista no está cerrada: por eso se firma
  el pedido y no se confía en quién escribe la fila.

**Si el Centro no puede distinguir un pedido escrito por Martín de uno fabricado por otro, no se
construye.** Lo que lo distingue:

- **Cada pedido viaja firmado con una clave privada que el servidor NO tiene.** La clave nace en
  el navegador de Martín y no se puede exportar (WebCrypto, guardada en IndexedDB); la clave
  pública se le da una sola vez a la tarea programada, a mano. La firma cubre el texto, el chat
  destino, la fecha y un número que no se repite. El cartero rechaza lo que no esté firmado, lo
  vencido y lo repetido. Así MaKo puede estar comprometida entera y no puede fabricar un pedido.
- **La v1 puede firmar con esa clave del navegador; la passkey del celular** (que pide la huella,
  como el 2FA que ya decidió Martín) **es la versión buena** y entra cuando el resto ande.
- **La acción de encolar exige además que la sesión sea la de Martín, con segundo factor**, y
  rechaza una sesión de desarrollo (`sub: 'dev'`).
- **El chat que recibe el pedido lo lee como mensaje de otro chat, no como orden de Martín** (así
  llegan siempre los `SendMessage`). Eso no reemplaza a la firma: en un chat con permisos amplios,
  el pedido de un compañero se ejecuta igual.

### 3.2 En la API de MaKo

Toda feature se declara en `lib/api-mako/areas/<área>.def.ts`, y ésta también. `rolMinimo: 'admin'`
solo es el admin de CUALQUIER workspace, así que no alcanza; **la guarda de plataforma ya existe**
(`soloPlataforma`, la sumó el 2FA obligatorio el 14/10 y se resuelve por CAPA en `vistaDe`). El
relevamiento de este documento leyó un árbol anterior y decía que faltaba.

- **Hecho (15/10):** el área `operaciones` con dos lecturas, `ver_pedidos_operaciones` y
  `ver_carteros_operaciones`, con `soloPlataforma` + `rolMinimo: 'admin'` y sin HTTP (los textos
  son prompts y el estado es de la PC).
- **Encolar NO está en el registro, a propósito**: exige la firma del dispositivo y ningún canal
  puede firmar. Si se declara, es con `confirmacion: 'pantalla'`: MaKo propone el pedido y Martín lo
  firma en `/admin/operaciones`. Pendiente.

---

## 4. La cuota de las tres cuentas

**La cuota la mide un chat con `get_usage`, y trae tres ventanas**, no una (medido el 15/10 en la
cuenta 1):

| Ventana | Valor medido | Se reinicia |
|---|---|---|
| **5 horas** | 70% | en 29 min |
| Semanal, todos los modelos | 52% | miércoles 21/10, 10:00 UTC |
| Semanal, por modelo (Fable) | 4% | mismo día |

**La de 5 horas es la que corta más seguido**, y hasta hoy no la guardaba nadie.

**Hoy el archivo guarda UNA cuenta.** `~/.claude/uso-semanal.txt` es una sola línea que pisa el
último que mide (`<pct> <resetsAt> <medidoAt> <cuenta>`), y lo lee el hook de los umbrales: no se
toca. Lo que se agrega:

- **El Cartero, que es un chat, mide en cada vuelta** las tres ventanas de la cuenta activa y las
  deja en una **fila por cuenta**. La tarea programada las sube; MaKo guarda la última de cada
  cuenta.
- **El número siempre se muestra con su fecha** («hace 2 h»), nunca pelado. Ya mordió: una sesión
  obedeció un 98% que era de otra cuenta y cortó trabajo que no había que cortar.
- **Si una cuenta inactiva ya pasó su `resetsAt`**, la pantalla dice «se reinició el …», no el
  número viejo.
- **El % de la cuenta 1 incluye lo que usa su titular** en sus propias sesiones.

**Los avisos del 85, 90 y 95% ya los da un hook** (`bitacora-sesion.sh turno`), con la orden de
escribir el relevo. El Centro los MUESTRA; volver a mandarlos es la decisión 4 de §10, y si se
manda sola, son dos órdenes iguales a cada chat.

---

## 5. Ahorrar tokens: el tamaño del pedido

Pedido textual: «si mando una tarea fácil, que le diga a los chats qué modelo de IA deben usar».

**Cambiarle el modelo a un chat largo casi seguro cuesta MÁS, no menos.** La caché es por modelo:
al cambiarlo se relee todo el contexto sin caché, y otra vez al volver al modelo de antes. Un chat
de esta casa anda por cientos de miles de tokens de contexto, y una tarea chica pesa una fracción
de eso. Además `set_session_model` sólo se puede llamar desde un chat.

Lo que sí ahorra:

- Cada pedido lleva un **tamaño**: `chica`, `normal`, `grande`, con tres botones (el que manda no
  tiene por qué saber nombres de modelos).
- **`chica`**: el texto del pedido le dice al chat que la haga **con un subagente de modelo
  barato**, que arranca con un contexto chico. Si el pedido no necesita nada de lo que ese chat
  sabe, el Cartero puede abrir **un chat nuevo** con modelo barato en vez de mandárselo.
- **`normal` y `grande`**: se entregan tal cual.
- **El default es no tocar nada.** Una herramienta de ahorro que degrada por descuido es peor que
  no tenerla.

### Lo que más tokens gasta no es el modelo: es lo que cada chat carga al abrir

**`AGENTS.md` mide 8.088 líneas y 557 KB**, unos 140.000 tokens (estimado a 4 caracteres por
token), y se carga entero en **cada chat que abre en el repo y en cada subagente** (`CLAUDE.md`
lo importa). Una corrida de diez agentes paga 1,4 millones de tokens sólo de eso, antes de leer
una línea de código. Y creció 2,3 veces en un mes: tenía 3.466 líneas el 15/09, y 211 commits lo
tocaron desde entonces.

Achicarlo ahorra más que cualquier elección de modelo. Es el principio 9 del video (§11): **la
limpieza mantiene lo importante a mano**. Lo que gobierna código nuevo queda en una línea, y el
detalle de cada caso vive en su `docs/hallazgos-<área>.md`, que se lee cuando hace falta. Es la
decisión 6 de §10, porque AGENTS.md es la casa de todos y no lo achica nadie por su cuenta.

**Y el Cartero lo puede medir**: `get_usage` con el id de un chat devuelve cuánto de su ventana de
contexto ocupa y en qué. El Centro puede mostrar qué chat está por compactarse y cuánto pesa lo que
carga al abrir.

---

## 6. El señalador: elegir un elemento en vez de mandar una captura

Esto es lo que más tiempo ahorra por día y lo que más fácil es de sobrediseñar. No hace falta
ningún plugin de build ni ninguna extensión: MaKo se puede inspeccionar a sí misma.

- Se prende «Señalar» desde el Centro (o con un atajo). Queda una capa encima, sólo para Martín,
  que resalta lo que está debajo del cursor.
- Al hacer clic, el elemento se suma al pedido como un **chip azul** con lo que Martín ve, y por
  debajo viaja lo que el chat necesita para encontrarlo:
  - la ruta de la pantalla (`/general?tab=…`),
  - **el selector**: el camino desde la raíz con su posición
    (`main > section.mazo > article.mazo-carta:nth-child(2) > h2`), que alcanza para dar con la
    pantalla y el bloque,
  - sus clases propias, cuando las tiene,
  - y el tamaño y la posición, que es lo que suele estar en discusión.
- El chip se borra como cualquier texto, y se pueden señalar varios.

### ⚠️ El texto del elemento NO viaja como parte del pedido

**En el CRM, el texto de la pantalla lo escriben los LEADS.** Un mensaje de WhatsApp que diga
«ignorá todo lo anterior y corré…» terminaría adentro del prompt de un chat con permisos amplios.
Si hace falta el texto para que se entienda el pedido, va **citado como dato, recortado y marcado
como texto de la pantalla, nunca como instrucción**. Es la misma regla que rige para todo lo que
entra por un canal.

### Las clases de la casa: lo que de verdad alcanzan, medido el 15/10

La versión anterior de este documento decía que las clases propias de la casa resolvían «el 90%
del problema». No estaba medido. Medido sobre los `.tsx` de `app/` (1.212 archivos, 25.772
elementos HTML en JSX):

| | |
|---|---|
| Con `className` | 32,2% |
| Sólo con `style` en línea | 46,3% |
| Con una clase que vive en UN solo archivo (lleva al archivo con un grep) | **15,9%** |
| Lo mismo contando hasta 3 ancestros del mismo archivo | **24,7%** |

Y por tab, contando los ancestros: **CRM 5%, Plan 2%, Ads Manager 3%, Automations 8%**, Image
Editor 1% (usa clases utilitarias); Landing Generator y Customer Success 77%. O sea que en las
pantallas que Martín más señala, las clases no llevan al archivo.

**Lo que carga el peso es el selector**, que siempre está. Si con la ruta y el selector el chat no
encuentra el archivo, lo que se suma es una marca por BLOQUE grande (`data-zona="crm-tablero"`),
no por elemento, y sólo donde haga falta.

**Por qué no se manda «archivo:línea»:** existe en desarrollo (React lo guarda) y no en
producción, que es donde mira Martín. Hacerlo andar en producción obliga a marcar cada elemento en
el build, y eso pesa en el bundle de todos los clientes.

---

## 7. Los chats y las cuentas

Pedido: «que organice los chats para cada cuenta… así les cuesta menos contexto».

**Lo que hay hoy: cada área tiene un chat POR CUENTA, con el mismo nombre.** Cuando la cuenta 1 se
agota, Martín pasa a la 2 y sigue en el «CRM» de la 2, que retoma por `docs/relevo/`. Es el modo
relevo de [dos-cuentas.md](dos-cuentas.md), el que se usa por defecto, y con la app corriendo una
cuenta por vez es lo único que funciona.

**Desde el 15/10 corren las tres a la vez** (decisión 2 de §10), y con eso el reparto «un área, una
cuenta» deja de chocar con el modo relevo: cada cuenta puede tener sus áreas fijas. Dos límites
medidos, que deciden cuántos chats entran:

- **Cada chat pesa ~520 MB comprometidos, venga de la app o de la terminal** (es el mismo proceso de
  Claude Code). Repartir los chats entre cuentas reparte la CUOTA, no agrega RAM: el total de chats
  de las tres tiene que seguir rondando los de hoy (17 con 4,3 GB libres de 15,7).
- **Las sesiones de terminal no aparecen en la app** ni tienen sus conectores, y cada directorio de
  configuración tiene su propio registro: por eso hay un cartero por cuenta.

El reparto en sí sigue siendo la decisión 5.

Lo que el Centro sí aporta: **mostrar qué chat de cada cuenta tocó cada área**, con el índice que
ya existe (`docs/relevo/chats.md`), y elegir a quién mandarle un pedido por ÁREA, resuelto al chat
vivo de la cuenta activa.

**De qué cuenta es cada chat lo dice la carpeta de la app**, sin preguntar: ver
[dos-cuentas.md](dos-cuentas.md) → «La carpeta de la app sí dice la cuenta».

---

## 8. Qué tiene que hacer Martín

1. **Loguearse una vez en cada cuenta de terminal** (`claude2` y `claude3` en PowerShell, y `/login`
   en cada una): es OAuth en el navegador y no lo puede hacer nadie más.
2. **Dejar abierto un chat «Cartero» por cuenta** (el nombre importa: el cartero no se ofrece a sí
   mismo como destino), y abiertos los chats que tienen que recibir.
3. **Crear la clave de este dispositivo** en `/admin/operaciones` (una por dispositivo).

Lo demás lo hace un chat, con el script (`scripts/operaciones/cartero.mjs`):

```bash
node scripts/operaciones/cartero.mjs instalar
node ~/.claude/operaciones/cartero.mjs token <el token que se acuña en /admin/operaciones>
node ~/.claude/operaciones/cartero.mjs clave <la clave pública que se copia en /admin/operaciones>
node ~/.claude/operaciones/cartero.mjs cartero claude1 app ~/.claude
node ~/.claude/operaciones/cartero.mjs carpeta 68eda2ab-d55d-41a3-be37-7780d56c55ce claude1
node ~/.claude/operaciones/cartero.mjs cartero claude2 cli ~/.claude-martin
```

Y el chat «Cartero» de cada cuenta corre `ciclo --cuenta claudeN` cada uno o dos minutos (un cron de
la sesión), manda cada entrega con `SendMessage` a la dirección `to` que imprime, y anota el resultado
con `acuse --cuenta claudeN <id> ok` (o `error <motivo>`).

⚠️ **Lo que cambió al construir:** la «tarea programada» de §2 no hizo falta para la etapa 1. El
cartero es UN script sin dependencias, y el chat Cartero lo corre en cada vuelta: consulta MaKo,
verifica la firma en código, reclama, deja el buzón y sube los acuses. La tarea programada sólo
agregaría un latido con el chat Cartero cerrado, cuando igual no se puede entregar nada.

---

## 9. Por dónde empezar (y qué NO hacer primero)

| Etapa | Qué queda andando | Cuánto pesa |
|---|---|---|
| 1 | La cola **con la firma**: escribir un pedido, firmarlo, que llegue a un chat de la cuenta activa y que vuelva su cierre | el corazón; sin la firma no se construye |
| 2 | La cuota de las tres cuentas: las tres ventanas, con su fecha | barato: la mide el Cartero |
| 3 | El señalador (selector + ruta, sin texto ajeno) | medio; es lo que más tiempo ahorra por día |
| 4 | El tamaño del pedido → subagente o chat nuevo | barato, pero inútil sin la 1 |
| 5 | Lo automático (el relevo al 85%, el reparto) | lo último, y sólo si se decide en §10 |

Si la decisión 1 de §10 dice que lo que vale es el señalador, la etapa 3 va sola y primera.

**Lo que no hay que hacer primero:** mostrar las respuestas de los chats dentro del Centro. Es lo
más vistoso y lo menos necesario: las respuestas ya llegan por la Ticketera y por el repo, y
mientras el Centro no sea confiable para MANDAR, mostrar respuestas es decorar una puerta que no
abre.

---

## 10. Lo que hay que decidir (va a la Ticketera)

1. ✅ **¿Por dónde arranca?** (`centro-operaciones-arranca`) → **la cola y la cuota primero**, el
   señalador después (15/10, la recomendada).
2. ✅ **¿Las cuentas corren de a una o en paralelo?** → **las tres activas** (Martín, 15/10: «Quiero
   que estén las 3 activas… Tal vez no en la app de Claude Desktop, pero con PowerShell o algo así»).
   Una en la app y dos en terminal; un cartero por cuenta (§7 y hallazgos-operaciones.md).
3. ✅ **La firma de cada pedido** (§3.1) → **firmado desde el día uno**, la v1 con una clave del
   navegador que no se puede exportar; la passkey, después.
4. **El relevo al 85%**: ¿el Centro lo manda solo, o sólo muestra la cuota y deja la orden al hook
   que ya la da? Recomendado: que la muestre; mandarla duplica la orden.
5. **El reparto de chats por cuenta**: con las tres activas, ahora sí se decide. Recomendado: el de
   §6 de la versión anterior (editores en una, tablero y dinero en otra, motor y plataforma en la
   tercera), con el total de chats acotado por la RAM (§7).
6. **Achicar AGENTS.md** (§5 y principio 9 de §11): una limpieza cada dos semanas que deje en
   AGENTS.md sólo la regla y mude el detalle de cada caso a su `docs/hallazgos-<área>.md`. Mudar no
   borra ninguna regla; lo que sí se decide es cuál ya no vale. Recomendado: arrancar por ahí, porque
   es lo que se paga en cada chat y en cada subagente.

**Retirada el 15/10:** «si el Centro puede cambiar el modelo de una sesión». Su premisa era falsa
(§5).

---

## 11. Lo que suma el video del segundo cerebro

Pedido de Martín (15/10/2026): «Investiga también este vídeo https://youtu.be/rracqzwV4ZY — o
incluso otros vídeos o info por la web de cómo aprovechar este centro de operaciones con "El
segundo cerebro".»

**El video:** «10 principios para usar tu segundo cerebro de IA como el 1%», de Claudio Conde,
publicado el 14/10/2026 (16:51). El audio se transcribió con el pipeline de los cursos (Whisper
por Groq; pasó el detector de salidas degeneradas: 3.151 palabras, unas 187 por minuto) y se
leyeron las 15 diapositivas del video. **En voz alta no numera los principios**: los diez de abajo
son las diapositivas 05 a 14, con sus títulos textuales (de la 01 a la 04 presenta su sistema, y
la 15 cierra). No es el marco de Tiago Forte.

**Su sistema, en una línea:** un repo privado de archivos `.md` (el «cerebro»: decisiones, fuentes
y aprendizajes) desde donde pide TODO, en tres capas: el cerebro (el contexto), las skills (el
método) y las rutinas (cuándo arranca algo solo). **Esta casa ya lo tiene**: AGENTS.md y
`docs/hallazgos-*`, las memorias, `.claude/skills` y los hooks. Lo que aporta el video son los
hábitos alrededor. La tab Second Brain de MaKo es otra cosa: es lo que MaKo entendió del negocio de
un CLIENTE, no el cerebro con que trabajamos nosotros.

| # | Principio (título de la diapositiva) | Qué cambia en el Centro |
|---|---|---|
| 1 | **«Mañana empieza la noche anterior»**: anotá todo, abrí el micrófono; la IA adelanta lo que puede y te deja lo que hay que revisar | **Aplica.** El buzón es eso: Martín dicta a la noche desde el teléfono y revisa a la mañana. El pedido acepta dictado (§3). El límite: lo de otra cuenta espera, y con la PC apagada no avanza nada (ver el 10) |
| 2 | **«El hábito es el circuito»**: entrar → trabajar → actualizar → cerrar → retomar. «Buscá la última decisión y el último cierre» | **Ya lo tenemos** («lo primero al abrir: docs/relevo.md»). El Centro lo refuerza agregando esas rutas a cada pedido (§3, paso 2) |
| 3 | **«Terminar la tarea incluye guardar el cierre»**: qué decidimos, qué quedó hecho, qué comprobamos, qué sigue y dónde | **Aplica, y faltaba.** Es el cierre de cuatro renglones de §3: lo que vuelve de cada chat, y que hoy junta a mano la cosecha |
| 4 | **«Pedís desde el cerebro. Ejecuta en el proyecto»**: va contexto + encargo, vuelve resultado + pruebas. «Si el resultado no vuelve, el próximo chat pierde continuidad» | **Es la arquitectura del Centro.** El pedido viaja con su contexto, como RUTAS y no como texto. Y de rebote: si los pedidos salen del Centro, el registro de `/admin/dev` puede guardar solo el pedido literal de Martín, el hito `tipo: 'prompt'` que AGENTS.md pide y que hoy queda vacío |
| 5 | **«Cada corrección mejora el próximo trabajo»**: propuesta → decisión → verificado. «Aclarar si aplica a esta pieza o también a los próximos trabajos» | **Aplica**: el interruptor «Sólo esto / Y de ahora en más» (§3) |
| 6 | **«Una skill guarda cómo hacerlo bien»**: cuando el proceso se repite y sabés reconocer una buena salida | **No cambia el diseño**: las skills ya están. Más adelante, el Centro puede contar los pedidos que se repiten y sugerir una |
| 7 | **«Una rutina hace que el proceso arranque»**: proceso estable + disparador claro + salida comprobable | **Aplica al Cartero**, que es una rutina por horario (§2). Y da el criterio de la decisión 4: el relevo al 85% cumple las tres condiciones, pero ya lo dispara un hook |
| 8 | **«Automatizar más también exige más control»**: la IA detecta y prepara; vos elegís y autorizás (estrategia, casos ambiguos, publicar, enviar, cobrar). «Escrita ≠ programada ≠ ejecutada ≠ verificada» | **Aplica fuerte**: son los cuatro estados de §3. Y un pedido nunca autoriza solo lo que publica, envía o cobra: un push sigue pasando por el coordinador |
| 9 | **«La limpieza mantiene lo importante a mano»**: actualizar (decisión + fecha + fuente), consolidar (una ubicación), archivar (conservar el aprendizaje), comprobar (pendientes y enlaces). «Primero detectá → decidí qué cambiar → actualizá y comprobá» | **Lo que más tokens ahorra** (§5): AGENTS.md pesa unos 140.000 tokens y se carga en cada chat y en cada subagente. Decisión 6 |
| 10 | **«Remoto y cloud: ¿dónde se ejecuta?»**: tu PC (tiene que estar prendida) o la nube (no la necesita y no ve tu disco). «Un solo cerebro: recuperar la versión vigente → trabajar → guardar y sincronizar» | **Aplica a §0 y §1.** Remote Control es justo lo que él usa desde el celular (`/rc`). La nube sería la salida para la PC apagada, con un límite: nuestro cerebro está partido entre el repo y `~/.claude`, y la nube ve sólo el repo. Para después |

**Lo que el video no trae:** nada sobre varias cuentas ni sobre cuotas. Su techo es el cómputo de
la máquina; el nuestro es la cuota.
