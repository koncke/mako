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

**Qué promete, en una frase (corregida el 15/10, ver §1):** desde MaKo —también desde el
teléfono— se dejan pedidos para los chats de las tres cuentas, **pero sólo los recibe la cuenta
que está abierta en la app de Claude: los de las otras dos esperan a que Martín se pase a esa
cuenta**. Se ve la cuota de las tres, cada una con la fecha en que se midió. Y se señala un
elemento de la pantalla en vez de mandar una captura.

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

1. En `/admin/operaciones` Martín escribe el pedido, elige el chat y lo **firma** (§3.1). La fila
   queda `en cola`; si el chat es de otra cuenta, la pantalla dice **«espera a que pases a la
   cuenta N»**, no «en cola».
2. La tarea programada la baja, verifica la firma y la deja en el buzón de ese chat.
3. El Cartero la manda con `SendMessage` → `enviado`.
4. **El chat destino confirma que la tomó** (el texto del pedido le pide marcarlo en MaKo) →
   `tomado`. Sin esa marca, el Centro nunca dice que alguien lo leyó.
5. El chat contesta donde contesta siempre: la Ticketera, el repo, un push.

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
- un `next dev` local sin `AUTH_SECRET`, que contesta como admin a cualquiera de la red y escribe
  en la base de producción. Hoy no pasa en ningún checkout, pero puede pasar: ver
  [hallazgos-seguridad.md](hallazgos-seguridad.md) → «Un `next dev` sin `AUTH_SECRET` es un admin
  abierto a la red».

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

Toda feature se declara en `lib/api-mako/areas/<área>.def.ts`, y ésta también: **las lecturas**
(estado de la cola, cuota de las tres cuentas). Pero el registro hoy **no tiene una guarda de
plataforma**: `Gating` (`lib/api-mako/tipos.ts:166`) ofrece `soloWs1`, `integracion`, `tab` y
`rolMinimo: 'admin'`, y ese `admin` es el admin de CUALQUIER workspace. Declarar «encolar» ahí, tal
cual, deja que el doer de WhatsApp o el token de un cliente le manden prompts a la PC de Martín.

- Hace falta una guarda nueva de plataforma (sólo el workspace de `wsSuperAdmin()` y sólo
  Martín), con su test.
- **Encolar no sale por `http` ni por WhatsApp.** Si se declara, es con `confirmacion: 'pantalla'`:
  MaKo propone el pedido y Martín lo firma en `/admin/operaciones`. La firma vive en la pantalla,
  así que ningún canal puede saltearla.

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

**El reparto «un área, una cuenta» de la versión anterior choca con eso:** si los editores viven
sólo en la cuenta 1, cuando la 1 se agota no hay editores hasta el reset. Sirve sólo si las cuentas
corren en paralelo, y en paralelo hacen falta sesiones de la CLI con su propio directorio de
configuración, que no aparecen en la app (ni con sus conectores), y con los chats de una sola
cuenta la PC ya anda al límite de RAM (ver [hallazgos-infra.md](hallazgos-infra.md)). Es la
decisión 2 de §10.

Lo que el Centro sí aporta: **mostrar qué chat de cada cuenta tocó cada área**, con el índice que
ya existe (`docs/relevo/chats.md`), y elegir a quién mandarle un pedido por ÁREA, resuelto al chat
vivo de la cuenta activa.

**De qué cuenta es cada chat lo dice la carpeta de la app**, sin preguntar: ver
[dos-cuentas.md](dos-cuentas.md) → «La carpeta de la app sí dice la cuenta».

---

## 8. Qué tiene que hacer Martín

1. **Nada para la cuenta 3**: ya entró el 10/10 (está en `cuentas.tsv` y tiene sus chats).
2. **Dejar abierto el chat «Cartero»** de la cuenta activa, y abiertos los chats que tienen que
   recibir. Un chat cerrado no recibe.
3. **Generar la clave de firma una vez** desde `/admin/operaciones` y pegar la pública donde lo
   indique la instalación del cartero.
4. **Instalar el cartero una vez**, como el vigía: un script, sin admin y sin abrir puertos.

---

## 9. Por dónde empezar (y qué NO hacer primero)

| Etapa | Qué queda andando | Cuánto pesa |
|---|---|---|
| 1 | La cola **con la firma**: escribir un pedido, firmarlo, y que llegue a un chat de la cuenta activa | el corazón; sin la firma no se construye |
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

1. **¿Por dónde arranca?** (`centro-operaciones-arranca`): la cola + la cuota, o el señalador
   primero. Con §0 a la vista: si lo nuevo que le sirve es sólo el señalador, va solo.
2. **¿Las cuentas corren de a una (como hoy) o en paralelo?** Decide §7. Recomendado: de a una.
3. **La firma de cada pedido** (§3.1): no es opcional; lo que se decide es con qué firma la v1.
4. **El relevo al 85%**: ¿el Centro lo manda solo, o sólo muestra la cuota y deja la orden al hook
   que ya la da? Recomendado: que la muestre; mandarla duplica la orden.
5. **El reparto de chats por cuenta**: depende de la 2; con «de a una», no hay reparto que hacer.

**Retirada el 15/10:** «si el Centro puede cambiar el modelo de una sesión». Su premisa era falsa
(§5).
