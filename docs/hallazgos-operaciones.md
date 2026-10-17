# Hallazgos — Centro de Operaciones

El Centro (`/admin/operaciones`, `scripts/operaciones/cartero.mjs`) deja pedidos firmados para los chats
de Claude Code de la PC de Martín. El diseño, con lo que no puede hacer, en
[diseno-centro-de-operaciones.md](diseno-centro-de-operaciones.md). Acá va lo que costó y no se deduce
del código.

---

## Un script no le puede escribir a una sesión; un chat sí, menos a sí mismo (15/10/2026)

No hay una vía documentada para que un proceso le mande un mensaje a una sesión de Claude Code. Cada
sesión se anota en `<config dir>/sessions/<pid>.json` con un named pipe (`messagingSocketPath`,
`peerProtocol: 1`) y un `.key` que lo autentica: es el protocolo INTERNO de la versión 2.1.295, y
apoyarse en él rompe con cualquier actualización de la app (que se actualiza sola). Lo que entrega es
un CHAT que llama a `SendMessage` con la dirección `uds:<messagingSocketPath>`: es inequívoca, porque los
nombres se repiten entre cuentas y dentro de una.

⚠️ **Y `SendMessage` no deja que un chat se escriba a sí mismo** («is this session itself»). Medido en la
primera prueba de punta a punta: el pedido iba al mismo chat que hacía de Cartero. Por eso el cartero no
ofrece como destino un chat que se llame «Cartero…» (`esElCartero`), y el pedido de esa prueba quedó «No
se pudo» con su motivo, que es el camino del error funcionando.

**Vive en:** `scripts/operaciones/cartero.mjs` · *chat «Centro de Operaciones», 15/10/2026*

## «Un pedido se entrega una vez» necesita DOS candados

El compare-and-set en la base (`update … where estado = 'escrito'`) evita que dos carteros o un
reintento se lleven el mismo pedido. Pero el que decide el estado es el servidor, y un servidor
comprometido puede volver a poner un pedido viejo en `escrito`: con la firma intacta, se entregaría de
nuevo. El segundo candado vive en la PC: `entregados.json` guarda los ids que salieron, y el cartero
rechaza un id que vuelve («Ya se había entregado: no sale dos veces»). El test corre el cartero real
contra un servidor HTTP falso que miente.

Lo mismo con el texto: **el servidor no arma ni reconstruye el texto firmado**. Lo guarda como llegó y
lo devuelve como está; el cartero verifica la firma sobre ese string y entrega lo que dice. Así no hay
dos implementaciones de una «canonicalización» que tengan que coincidir. Lo que sí está duplicado es
el VALIDADOR del pedido (TS en `lib/operaciones-reglas.ts`, JS en el cartero, que corre sin
dependencias), y lo ata un test diferencial sobre una batería de 17 textos.

**Vive en:** `lib/operaciones.ts` (`cicloCartero`) · `scripts/operaciones/cartero.mjs` (`ciclo`,
`leerFirmable`) · `tests/operaciones.test.ts`

## WebCrypto firma en r||s; Node verifica en DER si no se le dice

`crypto.subtle.sign` con ECDSA P-256 devuelve la firma en el formato IEEE P1363 (`r||s`, 64 bytes).
`crypto.verify` de Node espera DER por defecto, y con una firma P1363 **contesta `false` sin error**: se
lee como «la firma no es válida» sobre una firma perfecta. Va `dsaEncoding: 'ieee-p1363'` en los dos
lados de Node (el servidor, que sólo chequea coherencia, y el cartero, que decide). El test firma con
Node en ese mismo formato para imitar al navegador.

**Vive en:** `lib/operaciones.ts` (`firmaCoincide`) · `scripts/operaciones/cartero.mjs` (`quienFirmo`)

## Cada chat pesa lo mismo en la app que en la terminal

Medido el 15/10 sobre los 17 chats vivos: cada uno es un proceso de Claude Code (`claude.exe`), con
**~520 MB de memoria comprometida** (mediana; de 466 a 778) y entre 86 y 338 MB residentes. Con esos 17
quedaban 4,3 GB libres de 15,7. Una sesión de terminal es el mismo proceso, así que **lo que pesa es la
cantidad de chats, no la cuenta en la que corren**: repartirlos entre tres cuentas reparte la cuota, no
agrega RAM.

## Tres cuentas a la vez: lo que no estaba armado (15/10/2026)

Martín decidió que las tres cuentas corran juntas, la de la app y dos en terminal. Medido ese día:

- **Cada directorio de configuración tiene su propio registro de sesiones.** Un chat de la app no ve
  las sesiones de terminal de otra cuenta, y `SendMessage` NO cruza de un directorio a otro (medido el 16/10: ver
  «SendMessage no cruza carpetas»). La frontera es la carpeta, no la cuenta: hay **un Runner por carpeta**.
- **`~/.claude-martin` (cuenta 2) nunca se logueó por terminal** y sus `settings.json` tienen `hooks: {}`:
  una sesión ahí corre sin bitácora, sin guardia de RAM, sin relevo tras caída y sin avisos de cuota.
- **El marcador de cuenta es UNO** (`~/.claude/cuenta-activa.txt`, ruta fija en `bitacora-sesion.sh`):
  con tres en paralelo, dos firmarían con la cuenta equivocada. Una sesión de terminal sabe su cuenta
  por `CLAUDE_CONFIG_DIR`; la app, por su carpeta ([dos-cuentas.md](dos-cuentas.md)).
- **`get_usage` es una herramienta de la APP**: en la terminal no existe, así que la cuota de las
  cuentas de terminal no se mide como hoy (etapa 2).

## La prueba de punta a punta: lo que pasa al levantarla

- **`next dev` desde un worktree con el `node_modules` enlazado** se levanta desde un worktree DENTRO
  del clon (`.claude/worktrees/<id>`) con `turbopack.root` apuntando al clon, sólo para esa prueba
  (AGENTS.md). Al desarmarlo, `.next/dev/node_modules/` tenía dos enlaces más (`postcss-…`, `sharp-…`)
  que se sacaron con `rmdir` antes del `worktree remove`.
- **El vigía de RAM lo mató a mitad** (3,7 GB privados con 683 MB libres): es la guardia haciendo su
  trabajo. Lo que ya había pasado quedó en la base, y ahí se verificó: el pedido al chat «Estrategia 3
  cuentas» en `entregado`. La pantalla con «Entregado» no llegó a capturarse; se mira en producción.
- **`getByRole('button', { name: 'Copiar' })` de Playwright también encuentra «Copiar clave»**: el
  nombre matchea por substring. Con `exact: true`. Y como el token se muestra una sola vez, el primero
  se perdió y hubo que acuñar otro.
- **La sesión de prueba se firmó a mano** con el `AUTH_SECRET` del `.env.local`, por 30 minutos y sin
  salir de la PC: la de `/api/auth/dev-login` es `sub: 'dev'`, y el Centro la rechaza a propósito.

## La primera pantalla se rechazó por diseñada de memoria; la segunda copia GitHub Actions (15/10/2026)

**Síntoma.** Martín vio `/admin/operaciones` y la rechazó («horrible»). Lo que se veía: un cartel ámbar a
lo ancho de la página, un desplegable muerto («Ningún cartero subió chats todavía»), «Sólo esto» en azul
lleno al lado de «Y de ahora en más» en texto, un «Firmar y mandar» dorado, gigante y apagado, y tres
secciones apiladas del mismo peso con un hueco en el medio.

**Causa.** No era un detalle de estilo: la pantalla se dibujó sin abrir ninguna referencia. De ahí salió
la regla de AGENTS.md «NINGUNA pantalla se diseña de cero: se COPIA de una app que ya resolvió eso».

**Lo que se copió, y de dónde.** La pestaña Actions de github.com/vercel/next.js (la lista, un workflow
y una corrida, abiertas el 15/10 con Chrome sin sesión) y, para el panel de «Run workflow» —que sólo se
ve con sesión—, la guía oficial «Manually running a workflow». El mapa:

| GitHub Actions | Centro |
|---|---|
| «All workflows» + la lista de workflows a la izquierda | «Todos los pedidos» + los chats, agrupados por cuenta |
| Caches / Deployments, abajo de la columna | Carteros (con la clave del dispositivo y el token) |
| Caja «N workflow runs» con filtros Event · Status · Branch · Actor | Caja «N pedidos» con filtros Cuenta · Estado |
| Fila: ícono de estado, título, «workflow #N: …», rama, fecha y duración, «…» | Fila: ícono de estado, texto del pedido, «chat #N: firmado por Martín», alcance, fecha y «llegó en», «…» |
| Franja «This workflow has a workflow_dispatch trigger» + «Run workflow ▾» | Franja del chat («Lo entrega el cartero de la cuenta 3») + «Nuevo pedido ▾» |
| El panel: «Use workflow from Branch», los inputs, «Run workflow» | El panel: «Alcance: Sólo esto», el pedido, «Firmar y mandar» |
| La corrida: volver, título #N, Triggered · Status · Duration, el grafo de jobs | El pedido: volver, título #N, Firmado · Estado · Tardó · Destino, el recorrido Firmado → Tomado → Entregado → Hecho |

Dos decisiones que salen de copiar y no de gusto: «Nuevo pedido» sólo aparece con un chat elegido (en
GitHub, «Run workflow» sólo está en un workflow), y por eso no hay desplegable de chats que pueda quedar
muerto; y lo que falta (un cartero sin señal, un chat cerrado) se dice en la franja de ese chat, no en
un cartel de página.

**La propuesta, viva:** `docs/prototipos/centro-operaciones.html` (también publicada como página para que
Martín la valide). Computadora y celular, con tokens de la casa.

**Vive en:** `app/admin/operaciones/CentroOperaciones.tsx` (lo que se reemplaza) ·
`docs/prototipos/centro-operaciones.html` (lo propuesto)

## La Ticketera no avisaba: `chat` es un NOMBRE, no una sesión (15/10/2026)

**Síntoma.** Martín: «Y ya respondí todas esas tarjetas y al parecer no te llegó... No sirve de nada la
ticketera si no te llega». Medido a las 05:50 contra producción: **30 tarjetas abiertas, 30 contestadas,
29 sin `recogida_at`**, y `operaciones_carteros` **vacía**. El coordinador las repartió a mano a nueve chats.

**Causa.** La respuesta quedaba en la base y nadie la empujaba: el chat que preguntó tenía que correr
`decisiones.ts contestadas` por las dudas. Y aunque algo la empujara, **no había a quién**: la tarjeta
guarda `chat`, un nombre para la pantalla («2FA», «Pricing · Strategy», «Plan») que en varios casos no es
el título de ningún chat, y dos chats pueden llamarse igual («Customer Success» y «Ads Manager» aparecían
dos veces en la lista de sesiones). El diagnóstico obvio («falta un cron que mire») era la mitad: el bug
de fondo era que la tarjeta no sabía quién preguntó.

**Lo que quedó.** Lo empuja el cartero que ya existía, en su misma vuelta (sin máquina nueva):

- `admin_decisiones.destino` (mig 0288) guarda la sesión que pregunta, y la pone quien publica. Sin
  destino, el servidor busca UN chat con ese título entre los de todos los carteros; con cero o con dos,
  no adivina (`destinoDeDecision`, lib/decisiones-aviso.ts).
- Se avisa una vez por RESPUESTA: `aviso_de` es el `respondida_at` avisado. Si Martín la cambia, se avisa
  de nuevo. Lo que no llegó (o no se sabe) se reintenta hasta 5 veces, y un reclamo sin acuse vence a las 2 h.
- El reclamo es compare-and-set sobre la respuesta y el intento anterior, y el acuse viaja con el mismo
  formato de id que el de un pedido. Si el chat está cerrado, la tarjeta espera a la vuelta en que se abra.
- El mensaje lo arma el cartero con un texto fijo y el `ref` validado (`mensajeAviso`): no viaja texto de
  la base, así que no necesita firma. Que el aviso lleve la respuesta adentro necesita firmarla al
  contestar (fase 2).
- `decisiones.ts contestadas <ref>` dice en qué anda el aviso de cada una («avisada», «espera a que se
  abra el chat», «sin cartero corriendo», «Hay 2 chats que se llaman…»).

**Probado contra producción** (05:58-06:07, con el cartero real y las sesiones reales de esta PC; el
servidor fue `cicloCartero` corriendo local, con un token temporal): una tarjeta de prueba dirigida al
coordinador se reclamó, se le entregó por SendMessage, el acuse la dejó `entregado` y la vuelta siguiente
no la repitió; con la respuesta cambiada se volvió a reclamar. La tarjeta, la fila del cartero y el token se
borraron después: antes no existían.

**Dos trampas del arnés que no son del código:** `execFileSync` del cartero desde el mismo proceso que hace
de servidor se traba hasta el timeout (el servidor no puede contestar), y los paquetes de un script del
scratchpad no se resuelven (no hay `node_modules`): va `createRequire` apuntando al repo.

**Vive en:** `lib/decisiones-aviso.ts` · `lib/operaciones.ts` (`avisosParaElCartero`) ·
`scripts/operaciones/cartero.mjs` (`mensajeAviso`) · `scripts/decisiones.ts` ·
`supabase/migrations/0288_decisiones_aviso.sql` · `tests/decisiones-aviso.test.ts`

## «No veo el botón del Centro en mobile»: faltaba la pantalla, no la puerta (15/10/2026)

**Síntoma.** Martín no encontraba el Centro en el teléfono. El primer diagnóstico (del coordinador) fue que
More no podía ofrecer una tab de super admin: `SECCIONES_MAS` → `puedeVerKey` no conoce `ADMIN_FAMILIAS`.

**Causa real.** More YA tenía una sección «Super admin», con la Ticketera, desde el 14/10
(`app/m/mas/page.tsx`); ese diagnóstico miró `SECCIONES_MAS` y no la página. Lo que faltaba era la
PANTALLA del Centro en `/m`: sin ella, un botón llevaba a la cubierta de «se usa en la computadora».
Y lo de super admin **no va en `SECCIONES_MAS` a propósito**: de ahí sale también la barra del rol, y
una tab de plataforma podría subir a la barra de alguien que no es super admin.

**Lo que quedó.** `/m/operaciones` sólo para mirar, copiado de la lista de GitHub Actions en el teléfono
(una fila por pedido con su estado, el detalle en una hoja), con el mismo guard que escritorio
(`puedeOperar`). Su puerta, en «Super admin» al lado de la Ticketera, y la sección entera se apaga
mientras el super admin mira a un cliente (`!ctx.impersonando`), como el Sidebar.

**Vive en:** `app/m/operaciones/` · `app/m/mas/page.tsx` · `lib/movil-rutas.ts` (`rutaMovil`,
`rutaEscritorio`) · `tests/operaciones.test.ts`

## «Pedido» es la palabra de Martín: lo del Centro se llama «trabajo» (15/10/2026)

**Síntoma.** Martín abrió el Centro en el teléfono y escribió «Me dice que todavía no hay pedidos, cuando
tenemos muchos». La cola estaba vacía de verdad (el cartero no está instalado). Él leyó «pedidos» como SUS
pedidos: lo que les pide al coordinador y a los chats.

**Causa.** Un choque de nombres nuestro, no un malentendido suyo, y se iba a poner peor: la sección
Progreso trae una pestaña «Pedidos» que sí son los suyos. Dos cosas distintas con el mismo nombre en la
misma pantalla. El vacío, además, no decía la causa real.

**Lo que quedó.** En escritorio, en el teléfono y en el prototipo, lo que el Centro despacha es un
«trabajo» (como GitHub nombra la corrida, *run*, y no la petición). El vacío dice la causa: sin token,
«falta crear el token del cartero»; con token, «Todavía no mandaste ningún trabajo a los chats». Las claves
de la base y de la API no cambiaron, y un test frena «pedido» en los textos de esas pantallas.

**Vive en:** `app/admin/operaciones/CentroOperaciones.tsx` · `app/m/operaciones/` ·
`lib/api-mako/areas/operaciones.def.ts` (la descripción que lee MaKo) · `tests/operaciones.test.ts`

## Progreso: «78 pendientes» que eran 7, y lo que la pantalla no puede ver (15/10/2026)

Martín, desde el teléfono: «Sigo sin ver los pendientes y poder refrescar en el centro». El Centro pasó a
tener cuatro pestañas (En curso · Pedidos · Pushes · Trabajos) en la computadora y en el teléfono, y las
tres de Progreso **no dependen del cartero ni de su token**: salen de lo que ya existe.

**De dónde sale cada una, y qué NO puede ver.**
- **En curso y Pedidos** salen de las bitácoras de `/admin/dev` (`app/admin/dev/<área>/bitacora.ts`), que
  viajan dentro del build. Dicen lo DESPLEGADO: lo que un chat tiene escrito en la PC sin subir, y los
  chats abiertos ahora, no están. Eso lo va a traer el cartero cuando esté instalado; la pantalla lo dice.
- **Un pedido aparece recién cuando un chat lo anota** en su bitácora. Lo que Martín pidió y nadie anotó
  no existe para la pantalla.
- **Pushes** sale de la API de Vercel (`/v6/deployments`, `VERCEL_API_TOKEN`, que ya estaba en
  producción): el commit, el estado, cuánto tardó y la cuenta del trailer `Claude-Cuenta`.
- **No hay lista de commits por push**: el token de GitHub de la plataforma (la credencial `GITHUB_TOKEN`
  del ws 9, usuario `mbustos-digital`) contesta **404** en `hola-mako/dashboard-marketing` y también en
  `mbustos-digital/dashboard-marketing` desde la transferencia del repo. Medido el 15/10. Y debajo del 404
  había un segundo problema, que lo tapaba: el repo seguía cableado al owner viejo en tres lugares (lo
  arregló otro chat en dcad6ddd2). El cierre de tareas del Plan por commits (`lib/cerrar-por-commits.ts`)
  está mudo hasta que el token tenga acceso a `hola-mako/dashboard-marketing`.

**La trampa: el diagnóstico obvio de «pendiente» estaba mal.** La primera regla era la natural, «la
respuesta de un pedido es lo que le sigue en la bitácora hasta el pedido siguiente», y la pestaña decía
**78 pendientes**. Medido sobre las bitácoras reales: de 80 pedidos «pendientes» en 14 días, **72 tenían
trabajo hecho más abajo en su misma área** y **77 venían seguidos de otro pedido**. Los chats anotan en
TANDA: los cuatro pedidos de un mensaje de Martín, uno detrás del otro, y después lo que hicieron. Con la
regla natural, sólo el último de la tanda recibía la respuesta. Y la segunda mitad del mismo error: una
implementación anotada sin `commits` no cerraba nada, y la mayoría no los anota.

La regla que quedó (`cadenas` en `lib/progreso-reglas.ts`): los pedidos seguidos son una tanda y comparten
la respuesta que viene después; una implementación o una corrección cierran aunque no traigan commit. Con
eso, **7 pendientes, 11 en curso, 268 hechos**. El detalle de cada pedido dice «Anotado junto con N
pedidos más: lo que sigue responde a todos», porque a cuál de la tanda responde cada paso la bitácora no
lo dice. Lo fija `tests/progreso.test.ts`, probado rompiéndolo (sin juntar la tanda: 6 pasan, 1 falla;
sin la implementación como cierre: 6 y 1).

**Lo que todavía puede mentir:** un pedido cuyo trabajo se anotó en OTRA área queda pendiente (el de las
«estrellas de GitHub», anotado en API de MaKo, figura pendiente con las Estrellas en producción desde el
14/10). Se juntan áreas sólo cuando el MISMO texto se anotó en las dos a la misma hora.

**Refrescar:** en el teléfono, tirar hacia abajo (la pantalla está dentro de `PantallaM`); en la
computadora, «Actualizar» en el encabezado, con la hora del dato, sin perder la pestaña (`router.refresh`).

**La unidad es el PEDIDO (15/10, segunda vuelta).** Martín: «Lo que quiero ver allí es lo que te pedí, los
pushes de lo terminado, los pendientes que estamos trabajando ahora mismo, las cosas que ya están
terminadas, empezadas, etc...». Tres listas sueltas (En curso · Pedidos · Pushes) lo obligaban a cruzarlas a
mano. Ahora Pedidos es la pestaña de entrada, en cuatro grupos (Trabajando ahora = empezado y movido en 48 h ·
Sin empezar · Empezado, sin movimiento · Terminado), y cada fila muestra su CAMINO (anotado → lo tomó un chat
→ en producción) sin abrir nada. «En curso» por área quedó como pestaña «Áreas».

**«Terminado» es «en producción», y eso sí es exacto:** la pantalla lee la bitácora de la versión
PUBLICADA, así que todo lo que ve ya está subido. Lo que NO es exacto es **en qué push** llegó cada uno, y
los dos diagnósticos obvios están mal, medidos contra git:
- **Por la hora** («el primer push después de que se anotó»): sobre 202 pedidos con commit, **acertó 110 y
  erró 92**. El commit sale en el push de otro chat, o espera al del coordinador.
- **Por la punta exacta del ÚLTIMO commit** (el que lo termina): **0 de 88** en tres días. Una primera versión
  aceptaba CUALQUIER commit del pedido y unía 7, pero nombraba el push de un commit de 21 horas antes para un
  pedido terminado hace 3: lo daba por subido un día antes. El último commit anotado casi nunca encabeza un
  push (va con la cosecha, o adentro de un merge).

Lo único exacto sin git es el commit que ENCABEZA un push: en el detalle de un pedido, ese commit dice «subió
hace X», y en la pestaña Pushes ese push dice qué pedido trae (`pushDelCommit` y `pedidosDeLosPushes` en
lib/progreso-reglas.ts). La fila dice «En producción» y no nombra un push. Unir cada pedido con su push
necesita preguntarle a GitHub si el commit es ancestro del deploy (`compare`), y eso espera al token.

**«Trabajando ahora» es lo ANOTADO.** Sin el cartero corriendo, lo que un chat hace en este minuto y todavía
no escribió (commits sin subir, una rama viva) no se ve; la pantalla lo dice, igual que dice que un pedido
que nadie anotó no está en «Sin empezar».

**Vive en:** `lib/progreso-reglas.ts` (las reglas, puras) · `lib/progreso.ts` (las lecturas) ·
`app/admin/operaciones/{CentroPestanas,Progreso}.tsx` · `app/m/operaciones/ProgresoMovil.tsx` ·
`tests/progreso.test.ts`

## El cartero instalado: lo que falta para que entregue solo, y una tarjeta que no le llega a nadie (15/10/2026)

Martín acuñó el token y el cartero de claude1 quedó instalado en la PC (`instalar`, `token`, `cartero
claude1 app ~/.claude`, `carpeta 68eda2ab… claude1`). La primera vuelta, a mano, contra producción: vio 53
chats de la cuenta, 2 abiertos, y no tenía nada que entregar.

- **Instalado no es entregando.** Las vueltas las corre un chat «Cartero» con su cron, y ese chat no existe:
  lo abre Martín (un chat no puede crear otra sesión). Sin él, la hora del cartero envejece y el Centro lo
  muestra inactivo. Y sin ninguna clave de firma cargada en la PC (`clave <SPKI>`), un trabajo firmado se
  rechaza; los avisos de la Ticketera no la necesitan.
- **Con el chat cerrado, el aviso espera; no se pierde ni hace loop.** El servidor reclama un aviso sólo si
  el cartero reportó ESE chat abierto en la misma vuelta (`if (!mio?.vivo) continue` en lib/operaciones.ts),
  así que no gasta intentos. Si se cierra entre la consulta y la entrega, vuelve como «no entregado» y se
  reintenta, hasta `AVISO_MAX_INTENTOS`. Leído en el código y confirmado con una vuelta real; una entrega
  real todavía no se probó (no había ninguna respuesta con su chat abierto).
- **El diagnóstico obvio era el equivocado, y casi se persigue un error que no existía.** «Martín contestó
  plan-50-tareas-cargar y no llegó» parecía la Ticketera sin guardar: `respuesta` era null y la última
  respuesta guardada de cualquier tarjeta era de las 05:37. La tarjeta simplemente no estaba contestada (lo
  confirmó el coordinador). Antes de culpar al guardado, se mira si hay respuesta y desde cuándo.
- **Pero esa tarjeta, contestada, no le llegaría a nadie:** se publicó con el chat «Plan» y sin `destino`, y
  ningún chat se llama «Plan» (son «Plan - Perro Guardián»). `destinoDeDecision` no adivina por parecido.
  Toda tarjeta se publica con el `destino` de la sesión que pregunta; sin él, el nombre tiene que ser el
  título EXACTO del chat.

## El Centro como app de chats: lo que dicen los datos antes de rediseñar (15/10/2026)

Martín pidió copiar Grok entero: una lista de chats, con el punto verde por «en curso», el historial adentro
de cada chat, sin la pestaña Trabajos y quizás sin Pedidos. Medido sobre los pedidos de 14 días y los chats
del cartero, antes de dibujar nada:

- **Un pedido casi siempre vive en un chat:** de 289, a 274 los trabajó un solo chat, a 7 dos y a 1 tres.
  Pero **26 se pidieron en un chat (el coordinador) y los trabajó otro**, y **7 no los tomó nadie**: ésos
  no tienen chat donde vivir. Una vista por estado que cruce los chats sigue haciendo falta, o los
  pendientes desaparecen.
- **Juntar chats por NOMBRE pierde y mezcla:** de los 37 chats que anotaron en sus bitácoras en 14 días,
  sólo 17 coinciden por título con los 53 que subió el cartero de claude1 (los demás son de otras cuentas o
  se renombraron), y el cartero tiene 5 títulos repetidos («CRM», «General», «Ads Manager»…). La llave es
  la sesión, no el título — la misma lección que el `destino` de la Ticketera.
- **El punto verde sólo es verdad con el cartero corriendo:** el estado ocupado o libre de cada chat lo sube
  el cartero en cada vuelta; sin el chat Cartero es una foto vieja, y se dibuja como tal.
- **Grok sin sesión no muestra nada que copiar** (sólo la caja de escribir): la lista, el historial y el
  estado se ven con la cuenta de Martín, que inicia sesión él.
- **Un chat SÍ sabe su sesión, y el supuesto contrario casi dejaba a la lista sin llave.** La Ticketera
  sacaba el `destino` del `from-session` de un mensaje, como si un chat no pudiera saber su propio id. Lo
  sabe: `CLAUDE_CODE_HOST_SESSION_ID` (el `local_…` de la app, el mismo que sube el cartero) y
  `CLAUDE_CODE_SESSION_ID` en una terminal (`cli_…`). Desde el 16/10 cada hito de trabajo de una bitácora
  lleva su `sesion` (lo exige tests/progreso.test.ts y lo dice AGENTS.md); lo anterior queda «por nombre»,
  aparte y marcado, sin pegarse a ningún chat del cartero.
- **El modelo está en `lib/centro-chats.ts`** (la lista con su punto y su edad, los pedidos de cada chat,
  los que se pidieron en uno y trabajó otro, los trabajos firmados por sesión de destino, y la
  conversación de cada chat). «Avance» es la vista por estado de lib/progreso-reglas.ts, sin cambios.

## El rediseño de punta a punta: la caja para escribirle a un chat, y lo que faltaba para que llegue (16/10/2026)

**Síntoma.** Martín abrió la pestaña Chats en producción (15/10, 19:01) y la rechazó entera: «Toda la vista de chat
está horrible la verdad... Eliminando las tabs innecesarias, los textos innecesarios, títulos, subtitulos, avisos,
etc... No solamente eso, NO es funcional, no puedo mandar un prompt por allí a mis otras cuentas.»

**Causa.** Dos, y la segunda no era de estética. La pantalla mostraba conversaciones y no dejaba escribir: mandar
vivía en un formulario aparte («Cartero y trabajos»), con un desplegable de chats. Y aunque se escribiera, **nada
llegaba**: medido en la PC ese mismo día,

| Lo que hace falta para que un trabajo llegue | Cómo estaba (15/10, 23:00) |
|---|---|
| Una clave de firma aceptada en la PC (`claves.txt`) | **no existía**: todo trabajo firmado salía «No se pudo» en la primera vuelta |
| El cartero de cada cuenta | sólo el de la cuenta 1; se declararon la 2 y la 3 (`cartero claudeN app ~/.claude` + `carpeta`) |
| Alguien que corra las vueltas | **nadie**: ningún chat «Cartero»; la última vuelta, a las 17:29 UTC |
| La cuenta del chat, corriendo | la app estaba en la 3 (12 de 13 chats abiertos); la 1 (53 chats) y la 2 (27) no corrían en ningún lado |
| Una cuenta de terminal logueada | sólo `~/.claude-cuenta3` (15/10 03:20); `~/.claude-martin` nunca, y `~/.claude` tiene credenciales de julio |

La cola de producción tenía **0 trabajos**: nadie había podido mandar uno.

**Lo que quedó.** La pantalla es una app de chat, copiada de las que resuelven lo mismo (varias sesiones de un
agente, cada una con su estado). Las capturas se bajaron y se miraron el 15/10 (en el scratchpad de esa sesión):

| De dónde | Qué se copió |
|---|---|
| Claude Code web (sesiones con punto de estado) y Claude web | la barra: accesos con ícono arriba, filas de una línea con el punto a la izquierda, lo de la cuenta abajo de todo |
| Codex (escritorio y teléfono) | las sesiones agrupadas con «Mostrar más» y la edad a la derecha; acá el grupo es la CUENTA |
| WhatsApp (iOS, iPad, web), Linear Inbox, Slack | la fila de dos renglones con lo último que pasó, la hora y el tick ADENTRO de la burbuja, las píldoras de día, la conversación a pantalla completa en el teléfono con la caja fija abajo |
| Claude / ChatGPT / Perplexity | la caja redondeada con el texto arriba y una barrita abajo (la opción a la izquierda, enviar a la derecha) |
| Grok | Avance y Pushes como accesos de la barra que abren su vista con el nombre como único título |

- **La caja va abajo de cada conversación** (`Conversacion.tsx`): Enter manda, Shift+Enter baja de renglón. Firma por
  `mandar.ts`, el mismo camino en la computadora y en el teléfono, y lo que espera lo dice en una línea («Sale cuando
  abras este chat en la cuenta 1»). Una caja que mandaría algo que la PC va a rechazar NO manda: ofrece crear o copiar
  la clave (`comoSale`, lib/centro-chats.ts).
- **La barra agrupa por cuenta** (`seccionesDeChats`): con tres cuentas hay tres «CRM», y el título no los separa. Lo
  anotado sin sesión (antes del 16/10) va en su propia sección, plegada, al final: no recibe trabajos y repetía el
  título de su sesión al lado de ella.
- **Los ticks son los de WhatsApp**: ✓ escrito, ✓✓ entregado, ✓✓ azul hecho, ✕ no salió (con el motivo debajo). El
  cierre que deja el chat aparece como su respuesta.
- **La poda**: se fueron el título, el subtítulo, la frase de dónde sale el estado, las pestañas, la hora de «Al día»
  y el botón Actualizar (se refresca solo cada 8 s con la pestaña a la vista). «Áreas» se fue entera: lo que decía es
  la lista de chats. La vista `pedidos` pasó a llamarse `avance` (un `?tab=pedidos` viejo abre los chats).
- **Cargar**: la página ya no espera a Vercel (hasta 8 s de timeout; los pushes llegan después por `pushesCentroAction`)
  y tiene su esqueleto (`loading.tsx`, en la lista blanca de tests/layout-sin-suspense.test.ts).

**Lo que costó y no se deduce del código:**

- ⚠️ **Un test de refresco que no saca al chat no prueba el refresco.** El de `completarChats` refrescaba con el cartero
  VIENDO todavía al chat, así que borrar el reseteo del estado daba 9 en verde: el estado se pisaba igual. La rotura
  que lo prueba es la de un chat que el cartero dejó de ver.
- ⚠️ **El guard de «trabajo» lee cada cadena entre comillas**, también los ids: `vista === 'pedidos'` lo ponía rojo.
  Por eso la vista se llama `avance`, que además es su nombre en pantalla.
- **«Sin nada anotado» en 40 filas no distingue a ninguna** (AGENTS.md → una fila de una lista dice lo que la
  distingue): una fila sin nada que contar es de un renglón.
- **Dribbble y Behance bloquean `curl` y WebFetch** (202 con `x-amzn-waf-action: challenge` y cuerpo vacío; 403). Lo que
  anduvo: las páginas archivadas en el Wayback Machine (CDX con `filter=statuscode:200`, sufijo `id_`), sacar de ahí los
  `/shots/` y bajar la imagen de `cdn.dribbble.com/userupload/…` con `?resize=2000x1500`, que no está bloqueado.
- **Mirar la pantalla sin servidor cuando no hay RAM**: con 1,5 GB libres no entra un `next dev`. Las capturas salieron
  de los componentes REALES empaquetados con el esbuild que trae tsx, con las acciones del server, `next/navigation` y
  la clave reemplazadas por datos ficticios, las hojas de la casa concatenadas (sin las directivas de Tailwind) y
  Chrome `--headless=new --mute-audio --screenshot`. No reemplaza mirarla en producción: no pasa por el guard ni por la
  base.

**Vive en:** `app/admin/operaciones/{CentroApp,Conversacion,Hilo,PanelCartero}.tsx` · `mandar.ts` · `centro.css` ·
`lib/centro-chats.ts` (`completarChats`, `comoSale`, `vistaPrevia`, `seccionesDeChats`) · `app/m/operaciones/` ·
`tests/centro-chats.test.ts` · `tests/operaciones.test.ts`

## Grok Bot: cada chat es un empleado con su muñeco, y el que espera algo lo muestra (16/10/2026)

**El pedido.** Martín, la misma noche, al coordinador: «Quiero que copie a Grok, que tiene un mejor diseño, y sobre
todo me gusta el concepto de los muñequitos de IA o "empleados"». La referencia resultó ser **Grok Bot** (xAI,
lanzado el 11/08/2026): «AI teammates with names, jobs, and context that compounds over time», con habilidades,
rutinas y aprobaciones (docs.x.ai/grok-bot/overview).

**Cómo se miró, porque la doc oficial no trae una sola captura.** La nota de lanzamiento (x.ai/news/introducing-grok-bot)
tiene su video en `media.x.ai`; bajado con un user-agent de navegador y `Referer: https://x.ai/` (sin eso contesta un
HTML de 5 KB), 106 s, y mirado en hojas de contacto de 3×3 (`ffmpeg fps=1/4,tile=3x3`) y cuadros a resolución completa
recortados. Ahí está la pantalla real: la lista de Bots, cada uno con un muñeco de forma simple y color propio (gota,
hexágono, triángulo, cuadrado redondeado, con dos trazos blancos de ojos), su nombre, lo último que dijo y la hora; el
«Para:» con la lista de Bots, y la conversación con el muñeco y el nombre del Bot sobre cada mensaje.

⚠️ **El repo que circuló como referencia (`github.com/grok-bot-app/grok-bot`) NO es de xAI**: dice «Official product by
xAI» en el encabezado y «unofficial community guide» en la licencia, tiene 0 estrellas, etiquetas de relleno para
búsquedas e instaladores sin firmar en Releases. No se bajó ni se corrió nada de ahí (lo midió el coordinador).

**Lo que quedó (`Muneco.tsx`):**
- **Muñecos PROPIOS**: formas de la casa en la paleta categórica (`--grafo-*`, pasteles), ojos oscuros redondos con
  brillo y una sonrisa (los de xAI son colores fuertes con dos trazos blancos y sin boca). SVG sin dependencias ni ids.
- **El aspecto sale del título normalizado**, no de la sesión: el CRM es el mismo empleado en las tres cuentas. Las
  áreas principales tienen su aspecto FIJO (`EQUIPO`): con el hash, dos de ellas salían iguales; lo demás va por hash.
  `--grafo-funnel` quedó afuera: al lado de `--grafo-panorama` son dos verdes que no se distinguen a 38 px.
- **Los ojos dicen el estado**: despierto (abierto), parpadeando (trabaja), cansado (foto vieja), dormido (cerrado).
  Con movimiento reducido, quieto.
- **El que espera algo lo muestra** (el «vuelve a pedir aprobación» de Grok Bot): las tarjetas de la Ticketera sin
  contestar van a su empleado con `esperasPorChat`, por la sesión (`destino`) o por un título exacto y único —la MISMA
  regla con la que el cartero avisa la respuesta, `destinoDeDecision`—; con dos chats del mismo nombre no adivina. El
  muñeco lleva el globito y la conversación, arriba de la caja, «Una tarjeta espera tu respuesta · Contestar».

**Lo que confirmaron las otras referencias** (una corrida de 3 agentes, 28 capturas bajadas y miradas: los Companions de
Grok en iOS, Sintra, Marblism, Heynet, Wamino, Emotes, Notion AI, Duolingo y Copilot): el estado va en la CARA del
muñeco y no en un cartel; «te espera» es una insignia naranja con número; lo quieto, el muñeco apagado; la conversación
vacía muestra al personaje grande y, después, uno chico al lado de cada respuesta. Grok marca la presencia con un punto
verde sobre el avatar y el humor con un globito de pensamiento.

**Si algún día se cambian los muñecos por una biblioteca**: los estilos de DiceBear `critters`, `moods`, `gaze`,
`notionists`, `lorelei`, `open-peeps` y `thumbs` son CC0 (uso comercial, se pueden modificar, no piden crédito); `micah`,
`adventurer`, `personas`, `fun-emoji` y `big-smile` son CC BY 4.0 (piden crédito). Se fija el cuerpo por área y sólo
varían ojos y boca: con semilla al azar salen caras tristes o con barbijo. Hoy no hace falta: los nuestros no tienen
dependencia ni licencia que cuidar.

**Vive en:** `app/admin/operaciones/Muneco.tsx` · `lib/centro-chats.ts` (`esperasPorChat`) · `acciones.ts`
(`fotoCentroAction` trae las tarjetas) · `tests/centro-empleados.test.ts`

## El cartero pasa a llamarse Runner, y cada texto dice qué hacer (15/10/2026)

**El pedido.** Martín, mirando el Centro en producción: «Jamás pongas mensajes no claros como "Este dispositivo todavía
no firma.", es mucho mejor "Crea tu Token para comenzar a chatear"», y «No quiero que se llame más "cartero", sino un
nombre más formal, tecnico... profesional... mejora el diseño de ese modal».

**Runner, copiado de GitHub Actions.** Un self-hosted runner es un proceso en TU máquina que consulta una cola en la
nube, hace el trabajo ahí y reporta cómo salió: es lo que hace el cartero. No choca con «Puente» (Google Flow) ni con
«Pasarela» (pagos). El modal copia GitHub → Settings → Actions → Runners, mirado en el Chrome de Martín ese día
(hola-mako/dashboard-marketing no tiene runners, así que se miró la lista vacía y el alta «Add new self-hosted runner»):
la caja con un renglón por runner (punto, nombre, etiquetas, estado) y el botón primario arriba a la derecha; el alta
como pasos con un bloque de código para copiar. Acá los pasos son tres: crear el chat (sus instrucciones, que antes
vivían sólo en este documento, ahora están en `lib/runner.ts` y se copian con un botón), su token, y tu Token.

**Dos tokens, dos nombres.** «Tu Token» (palabra de Martín) es la clave de firma de ESTE dispositivo; el «token del
Runner» (`mkop_…`) es el que conecta al Runner con MaKo. Antes eran «clave» y «token de los carteros» y en pantalla
se leían como la misma cosa. El chat Runner acepta los dos pegados (`clave` y `token`).

**Las claves no se renombraron**: `cartero.mjs`, `operaciones_carteros`, `/api/operaciones/cartero`,
`ver_carteros_operaciones` siguen igual (la regla de «trabajo»/«pedido»). La PC reconoce al chat por su título:
`esElCartero` acepta «Runner» y «Cartero», también como sub-chat («Centro de Operaciones › Runner», mirando el último
tramo), así el renombre de Martín y la convención del chat jefe no lo vuelven un destino. Instalado como 1.3.0.

**Lo que costó medir:**
- **El guard de los textos no veía el texto JSX que sigue en el renglón de abajo.** La primera versión tomaba
  `>texto<` en un mismo renglón; `<Icon … />Runners` sigue con su `<span>` abajo, y devolverle «Cartero» a ese botón a
  propósito dio 0 fallos. Ahora toma el texto después del `>` de una ETIQUETA (no de un `=>`) hasta el próximo `<` o
  `{`, y descarta lo que parece código.
- **Una interpolación no es texto**: `${carteros.length}` adentro de un template daba un falso «cartero». Se borran las
  `${…}` antes de mirar.
- **El motivo de un trabajo que no salió lo escribe la PC, no MaKo** (`rechazar`, `acuse` en cartero.mjs, y «Venció…»
  en lib/operaciones.ts). Reescribirlo como acción («El chat se cerró: ábrelo y vuelve a mandarlo») exige reinstalar el
  script; las filas viejas conservan el texto de antes.

**Vive en:** `lib/runner.ts` · `app/admin/operaciones/PanelRunner.tsx` · `lib/centro-chats.ts` (`textoDeEnvio`) ·
`scripts/operaciones/cartero.mjs` (`esElCartero`, los motivos) · `app/m/operaciones/CentroMovil.tsx` (`RunnerMovil`) ·
`tests/centro-textos.test.ts`

## El avance pasa a cada chat, como los milestones de Linear, y la cuenta es un chip (15/10/2026)

**El pedido.** «Elimina lo de "Avances y pushes", quiero que cada chat tenga arriba, en su topbar un botón para ver los
avances, que despliegue la sidebar derecha, que sea algo similar a lo que tenemos en "offer"», con un roadmap «simple,
épico y entendible», el estado como el color del punto («gris = no empezado») y «Pedido hace» y los pushes en el detalle.
Y «No quiero que exista "cuenta 1, cuenta 2, 3" en la sidebar de chats... eso debe estar dentro de cada chat, con un chip».

**Copiado de** la barra derecha de Offer (`app/offer/PiezasRail.tsx`: la tarjeta que estira con flex, el título con su
conteo fijo y la lista que scrollea; en el teléfono, la barra «8/13» que se abre) y del panel «Project Milestones» de
Linear, mirado en su documentación (linear.app/docs/project-milestones, un video del panel de detalles del proyecto): el
rombo que cambia según el estado, el que está en curso en amarillo, el nombre y la fecha. Linear no se pudo abrir sin
cuenta: la referencia es su doc, y se dice.

**Qué es un nodo** (`avanceDelChat`, lib/centro-chats.ts): una línea del historial del chat. Un pedido de la bitácora que
trabajó ese chat (con SUS pasos y SUS commits), uno que se le pidió ahí y trabajó otro (con los de todos y quién lo
trabajó), o un trabajo firmado que se le mandó desde el Centro (su título es su primer renglón; el color sale de los
ticks: entregado = en curso, sin salir = rojo). La cuenta de cada paso viaja ahora en `PasoP.cuenta`.

**Lo que costó ver:**
- **En el teléfono la conversación abre en lo último**, así que una barra arriba del hilo quedaba fuera de la vista. Va
  `position: sticky` contra `.m-sheet__cuerpo`, que es lo que scrollea.
- **«Subió hace X» sólo se sabe cuando el commit ENCABEZA un push** (`pushDelCommit`: por la hora acertaba 110 de 202).
  Lo que la bitácora de la versión publicada nombra ya está en producción por construcción, así que el resto dice «En
  producción», que es exacto. Y mientras Vercel no contestó, `pushes` es null, no `[]`: con la lista vacía el avance
  diría «En producción» igual, pero nunca afirma un «subió» sin leerla.
- **Sin los grupos por cuenta, dos «CRM» quedan iguales en la lista.** Hasta que la punta siguiente los una por nombre,
  la fila lleva el chip de la cuenta SÓLO en los títulos repetidos (`titulosRepetidos`).
- **«Pedido hace» se escribe «Lo pediste hace»**: el guard de las pantallas del Centro no deja la palabra «pedido» en lo
  que se dibuja (tests/operaciones.test.ts), y «lo pediste» dice lo mismo.

**Lo que quedó:** el avance mira 14 días (el «Ver todos» de la vista vieja se fue con ella); `novedades`
(lib/progreso-reglas.ts) quedó sin quien lo llame, sólo con su test: era la lista de Pushes. La barra no tiene el
porcentaje de Linear («23% of 63»): un nodo es una cosa pedida, no un milestone con issues adentro.

**Vive en:** `app/admin/operaciones/Avance.tsx` · `lib/centro-chats.ts` (`avanceDelChat`, `seccionesDeChats`,
`titulosRepetidos`) · `app/admin/operaciones/Conversacion.tsx` (el botón y la cabecera) · `app/m/operaciones/ChatsMovil.tsx` ·
`tests/centro-avance.test.ts`

## Un chat es su nombre, el jefe agrupa a sus sub-chats, y cada empleado tiene su muñeco elegido (15/10/2026)

**El pedido.** «todos los chats de todas las cuentas se llamen igual. Y que yo tenga los 3 puntos en cada chat para poder
configurar cosas, como cambiarle el nombre»; «quiero que cada chat esté englobado en su chat "jefe" que siempre se debe
llamar como la tab en la que estamos trabajando, como CRM... ESO no lo quiero decidir yo, lo decide el chat jefe»; y
«Crea más diseños variados de las figuras tipo trabajadores... Y que si le doy click pueda elegir cambiar a otro».

**La regla de antes se dio vuelta, a propósito.** Hasta esa noche «un chat es una sesión, nunca un título» (con 5 títulos
repetidos en el cartero, juntar por nombre pegaba el trabajo de uno a otro). Martín decidió lo contrario: el mismo
trabajo se llama igual en las tres cuentas y el Centro lo une (`unirPorNombre`). Lo que se conservó es el camino al
nombre: un hito con su sesión toma el título que esa sesión tiene HOY, así un chat renombrado no se parte. El riesgo
viejo (dos chats distintos con el mismo nombre en una cuenta) ahora se resuelve renombrando uno, no adivinando.

**Copiado de:** los hilos de Discord en la barra de canales para el jefe y sus sub-chats (el hilo debajo de su canal,
corrido, con la línea que dobla); el «⋯» al pasar por la fila, de las barras de ChatGPT y Claude; y el selector de
muñeco, del armador de Notion Faces (faces.notion.com, mirado ese día: las piezas a la izquierda, la grilla de tres con el
elegido en azul y el dado, el retrato grande a la derecha).

**Lo que costó ver:**
- **En el teléfono no hay dos hojas** (SheetM: «Una hoja sobre otra REEMPLAZA»). Abrir «Opciones» en una hoja nueva
  cerraba la de la conversación, y como la nueva dependía del chat abierto, se cerraba también: el «⋯» no hacía nada.
  Opciones, Renombrar y el muñeco van ADENTRO de la hoja de la conversación, con su «‹» para volver.
- **Renombrar no tiene una puerta nueva**: a cada sesión del chat le llega un trabajo firmado que le pide
  `set_session_title` sobre sí misma (`textoDeRenombre`). La cerrada lo recibe al abrirse. El Runner podría renombrar
  sesiones cerradas (tiene la herramienta), pero eso pide un tipo de trabajo nuevo en la cola firmada: no se hizo.
- **El muñeco se guarda por nombre**, así que renombrar lo perdía: al renombrar, lo elegido se copia al nombre nuevo.
  Y guardar uno es leer-cambiar-escribir el mapa entero: se lee ESTRICTO (con la lectura tolerante, una caída de la base
  lo escribiría vacío).
- **Los ojos no se eligen**: dicen el estado del chat. La «cara» que se elige es la boca y las mejillas.
- **El test del equipo cazó la variedad nueva**: con la cara y el accesorio por hash del título entero, «Chatbot» y
  «Automations» (la misma área renombrada) dejaban de ser el mismo empleado. El jefe lleva cara y accesorio fijos; un
  sub-chat los saca de su nombre, para distinguirse.

**Lo que quedó:** el jefe no puede CREAR un sub-chat visible (start_session no está habilitado en esas sesiones): lo crea
Martín con un clic y lo nombra «Jefe › Sub», o el jefe renombra uno existente. Los grupos del jefe no se pliegan.

**Vive en:** `lib/centro-chats.ts` (`unirPorNombre`, `porJefe`, `partesDelNombre`, `nombreValido`, `textoDeRenombre`) ·
`lib/centro-munecos.ts` · `lib/centro-munecos-db.ts` · `app/admin/operaciones/ElegirMuneco.tsx` · `Muneco.tsx` ·
`CentroApp.tsx` (el «⋯» y los modales) · `app/m/operaciones/ChatsMovil.tsx` · `tests/centro-munecos.test.ts`

## SendMessage no cruza carpetas: un Runner por CARPETA, y el buzón es de la PC (16/10/2026)

**El pedido.** Martín: «habiamos dicho de no usar más a Claude desde la app de desktop, sino desde powershell o algo así
que ahí si permite tener 3 cuentas abiertas al mismo tiempo». Cada cuenta corre en su terminal con su
`CLAUDE_CONFIG_DIR` (el perfil de PowerShell: `claude1` → `~/.claude`, `claude2` → `~/.claude-martin`, `claude3` →
`~/.claude-cuenta3`), y el Runner tiene que entregarles a las tres.

**Medido.** Desde la app (`~/.claude`), `SendMessage` al canal de la sesión de terminal de la cuenta 2 contesta
«ENOINBOX: no-key — refusing to send to an unvouched pipe». La sesión deja su `.key` en `<carpeta>/sessions/` y el que
manda la busca en SU carpeta; `ListAgents` también lista sólo las de la propia. Copiar la `.key` a otra carpeta lo
haría andar, y es justo lo que NO se hace: es la protección contra un canal que nadie avaló.

**El diagnóstico obvio era el equivocado: la frontera no es la cuenta, es la CARPETA.** El 15/10 se armó «un cartero por
cuenta». Pero la app guarda las sesiones de CUALQUIER cuenta en `~/.claude`, que es también la carpeta de `claude1`: un
Runner en la app (o en la terminal de la cuenta 1) le llega a la app entera y a la terminal de la 1, y a la terminal
de la 2 o la 3, nunca. Y al revés: LEER sí cruza (son archivos), así que cualquier Runner ve las tres cuentas enteras
y sólo cambia a quién le puede entregar. De ahí el diseño (cartero 1.4.0):

- **Cada chat vivo sube `runner`**: si hay una sesión viva llamada Runner (o Cartero) en su carpeta. El registro trae el
  `name` de las dos clases de sesión (la de la app y la de `claude2 -n Runner`, medido en `claude --help` ese día).
- **MaKo reclama sólo `entregables`** (vivos con un Runner en su carpeta, siempre un subconjunto de lo que ese
  cartero subió vivo: `sanearEntregables`). Lo demás queda «escrito» hasta que se abra ese Runner, en vez de vencerse
  en el buzón. Un cartero de antes, sin la lista, reclama todos sus vivos, como siempre.
- **El buzón es de la PC, no del Runner**: lo reclamado va con la carpeta del chat, y cada Runner entrega sólo lo de la
  suya. Dos Runners en la MISMA carpeta (la app y `claude1` comparten `~/.claude`) no mandan lo mismo: el primero que
  lo lista crea `<id>.mano` con `wx` (atómico) y se lo queda; si el dueño se cerró sin acusarlo, lo toma otro.
- **El vencimiento (30 min) vale para lo de cualquier carpeta**: si sólo cada Runner venciera lo suyo, lo de un Runner
  cerrado no lo vencería nadie y quedaría «tomado» para siempre.
- **La carpeta propia sale de `CLAUDE_PID`**: Claude Code se lo pasa a los comandos que corre, y la sesión está en
  `<carpeta>/sessions/<pid>.json`. Si no, `CLAUDE_CONFIG_DIR` (lo pone `claude2`). `ciclo` sin `--cuenta` da la vuelta
  por las cuentas que tienen una fuente en su carpeta: el de `~/.claude` por las tres (la app), el de
  `~/.claude-martin` sólo por la 2.
- **La pantalla lo dice**: una sesión de terminal abierta sin Runner en su carpeta no dice «sale ya» aunque la cuenta
  tenga otro Runner dando vueltas: «Abre el Runner en la terminal de la cuenta 2 para que salga» (`comoSale`).

**Lo que costó ver:**
- **Los tests heredan el `CLAUDE_PID` de la sesión que los corre**: el cartero del test creía estar en `~/.claude` (ahí
  está la sesión real) y no entregaba nada. Los tests le dicen su carpeta con `CARTERO_CONFIG_DIR`.
- **En la terminal no hay `set_session_title`** (es de la app) y `/rename` existe pero lo escribe la persona, no el
  modelo. El renombre desde el Centro le pide al chat de terminal que deje en el cierre «Escribe /rename … en la terminal
  de este chat» (`textoDeRenombre`). Un chat de terminal nace con nombre si se abre con `claude2 -n "CRM"`.
- **Entre el cartero nuevo y el servidor viejo** (antes del deploy): el servidor ignora `entregables` y reclama todos los
  vivos; un trabajo para una terminal sin Runner espera 30 min en el buzón y sale «Se cerró el Runner de esa terminal:
  ábrelo y vuelve a mandarlo». Con el deploy, no se reclama.

**Lo que encontró la revisión adversarial** (dos revisores y un refutador por hallazgo; los 13 se confirmaron, todos
arreglados con su test en `tests/cartero-carpetas.test.ts`):
- **Un cierre se podía PERDER, y era el diagnóstico obvio el equivocado**: «se sube y se borra» valía con un cartero
  por cuenta. Con el buzón compartido, el Runner de la cuenta 1 subía los cierres de la PC sin el acuse que estaba en
  el buzón de la 2; MaKo aplica un cierre sólo sobre un pedido ENTREGADO, no lo tomaba, y la PC lo borraba igual. Ahora
  cada vuelta sube los acuses de TODAS las cuentas, MaKo devuelve `cierresIds`, y un cierre se borra sólo si entró (o
  después de un día).
- **El vencimiento por cuenta dejaba cosas «entregando» para siempre**: cada Runner da la vuelta por las cuentas de su
  carpeta, así que lo de la cuenta 1 sólo lo vencía el Runner de `~/.claude`. Recorre todos los buzones.
- **Un Runner que se cerró con algo en la mano no se reemplaza mandándolo otra vez**: no se sabe si alcanzó a mandarlo.
  Sale «El Runner se cerró a mitad de la entrega: míralo en el chat» (`tomar`).
- **Cualquier chat que corriera `ciclo` o `pendientes` se quedaba con el buzón**: probar el script desde un chat lo
  marcaba como suyo y nunca lo mandaba. Si la sesión que lo corre está registrada y no se llama Runner, no corre
  (`exigirRunner`; medido desde este chat: «no es el Runner»).
- **Con el nombre no alcanza**: un chat «Runner» al que nadie le pegó las instrucciones no da vueltas. Cuenta si además
  dejó su latido en los últimos 6 minutos (`latidos/`, lo escribe cada vuelta).
- **`entregados.json` perdía ids** con dos Runners acusando a la vez (leer-cambiar-escribir): ahora es un archivo por
  id (`entregados/`), y el json viejo se sigue leyendo. Y entre listar y marcar, el gemelo vuelve a mirar si el acuse
  ya lo sacó del buzón.
- **La pantalla elegía la sesión sin Runner** cuando el mismo chat estaba abierto en dos cuentas (`pesoSesion`), el
  panel ofrecía `claude2 -n Runner` para un chat de la app, y `scripts/decisiones.ts` decía «se avisa en la próxima
  vuelta» de un chat al que nadie llega (`explicarAviso`).

**Lo que quedó:** las carpetas de terminal no tienen los hooks de `~/.claude` (bitácora, guardia de RAM, avisos de
cuota): ver «Tres cuentas a la vez».

**Vive en:** `scripts/operaciones/cartero.mjs` (`dirPropio`, `carpetasConRunner`, `verChats`, `pendientes`, `tomar`,
`exigirRunner`, `latir`, `vuelta`) · `lib/operaciones-reglas.ts` (`runner`, `sanearEntregables`) · `lib/operaciones.ts` (`cicloCartero`) ·
`lib/centro-chats.ts` (`comoSale`, `textoDeRenombre`) · `lib/runner.ts` (`COMANDO_TERMINAL`, las instrucciones) ·
`tests/cartero-carpetas.test.ts` (la PC entera, contra un servidor falso)

## La pregunta de cada chat como la de Claude Code, y la Ticketera adentro del Centro (16/10/2026)

**El pedido.** Martín: «prefiero ahí donde está "Una tarjeta espera tu respuesta en la Ticketera" que salga lo mismo que
hoy sale en claude, las opciones», «La ticketera con los desplegables queda para el botón de "ticketera" de arriba», y
mirándolo en producción: «Me dice "Espera tu respuesta" y aún no me salta lo que te pedí tipo claude» y «No veo el botón
de la ticketera dentro del Centro».

**De dónde se copió la pregunta.** La app de escritorio no trae el dibujo de AskUserQuestion en su paquete (el
`app.asar` sólo tiene la notificación: la pantalla se carga de claude.ai), así que se leyó del CLI 2.1.299 de esta PC,
que sí lo trae: las opciones numeradas con su título y su descripción, «(Recommended)», «Type something.» como último
renglón, «Enter to select · Tab/Arrow keys to navigate · Esc to cancel», y «Review your answers / Submit answers» al
final. Se copió todo menos el repaso del final: acá cada respuesta se guarda al elegirla (como la Ticketera), así no
hay un envío que se pueda perder. La descripción de una opción es nueva (`detalle`, hasta 140 letras); las opciones de
antes que la traen en el texto («Sí — porque…») se parten en la raya.

**De qué chat es una tarjeta se decide UNA vez** (`lib/centro-preguntas.ts`): su `destino` manda; sin él, el nombre, y
sólo si un único chat se llama así. El globito del muñeco, la pregunta de arriba de la caja y la respuesta en la
conversación salen de esa misma función: un test fija que el globito y la pregunta cuentan lo mismo.

**El diagnóstico obvio era el equivocado: «elimina la ruta» no era «saca el ítem de la barra».** El 15/10 Martín reclamó
que la Ticketera NO estaba en la barra de admin («Eso esta mal»). Se dejó el ítem (y la fila de More) como atajo a la
Ticketera adentro del Centro (`?ticketera=`): una sola Ticketera, con dos puertas.

**Lo que costó ver** (de la revisión adversarial: dos revisores y un refutador por hallazgo, 7 de 7 confirmados; el
commit 81d842745 dice 5 porque se escribió antes de la segunda tanda):
- **La pregunta abierta se seguía por su POSICIÓN**: el refresco de cada 8 s mete adelante una tarjeta que frena, y lo que
  Martín escribía para una se guardaba en la otra (medido por el refutador). Ahora por su id (`preguntaAbierta`), y si
  la abierta se contesta en otro lado mientras escribe, se dice. Y un rechazo de la acción (sin red, un deploy nuevo) ya
  no la deja en «…».
- **Next no vuelve a montar una página cuando sólo cambia la query, y la prop tampoco sigue a la URL.** El ítem
  «Ticketera» de la barra, estando en el Centro, cambiaba la URL y no la pantalla. Seguir a la prop no alcanzaba: un
  `replaceState` con el estado de Next (lo que hacía `anotarEnUrl`) no le avisa al router, que se queda con la URL
  vieja. Ahora `anotarEnUrl` pasa `null` (el router copia su estado y se entera) y la vista sigue a `useSearchParams`.
  Lo mismo hacía «Ver la lista» del mazo vacío (un link a la misma página): adentro del Centro cambia la vista ahí.
- **Una página de /m a la que nadie llega es un test rojo** (`tests/movil-mismas-rutas.test.ts`: cada página de /m
  tiene que volver a sí misma). El proxy manda todo /m/* a su URL de escritorio, y ésa ahora cae en el Centro: las
  páginas viejas del teléfono no se dejan como redirect, se borran (la URL vieja igual llega, por el mapa de rutas).
- **`/admin/runway` perdía la query** (era la única puerta que no la pasaba por `aLaTicketera`), el botón que cierra la
  Ticketera dejaba `?ticketera=` en la URL, y las acciones revalidaban dos rutas que ya no dibujan nada.

**Vive en:** `lib/centro-preguntas.ts` · `app/admin/operaciones/Pregunta.tsx` · `TicketeraCentro.tsx` · `CentroApp.tsx` ·
`app/m/operaciones/TicketeraMovil.tsx` · `app/tickets/decisiones/reglas.ts` (`aLaTicketera`) · `lib/movil-rutas.ts` ·
`tests/centro-preguntas.test.ts`

## El Uso de las tres cuentas sale de la barra de estado de cada Runner (16/10/2026)

**El pedido.** Martín: «El "Uso" debe ser visible siempre, me imagino como un desplegable donde hoy está "Cartero". Y que
"Cartero" (que ya no debería llamarse así), sea también el mismo desplegable... Que ahí se vean ambas cosas», y en
producción: «Falta el poder visualizar el USO».

**De dónde sale (medido en el CLI 2.1.299 de esta PC).** En la terminal no hay `get_usage` (es de la app) ni nada guardado
en la carpeta de config (`~/.claude-martin` no tiene ningún caché de cuota). Lo que sí hay: la barra de estado de Claude
Code recibe por stdin `rate_limits.five_hour` y `rate_limits.seven_day`, cada una con `used_percentage` y `resets_at`
**en segundos unix**, y admite `refreshInterval`. El Runner se abre con esa barra (`--settings` apuntando a
`runner-settings.json`, que escribe `cartero.mjs instalar`): así se mide sin tocar la configuración de Martín, sólo en
esa sesión. `cartero.mjs uso` anota la cuota de la cuenta de su carpeta; cada vuelta la sube; MaKo la guarda en
`operaciones_carteros.cuota` (de la mig 0285, sin usar hasta hoy). De la cuenta que está en la app, la semanal sale de
`~/.claude/uso-semanal.txt` (lo que mide `get_usage`, con la cuenta en el 4º campo), si es más nueva.

**Lo que no se ve y se cuida:** pasado el reinicio de una ventana, su porcentaje ya no vale (se dice «Se reinició»); una
medición de más de 30 minutos lleva su edad; el botón muestra la semana MÁS usada (la que se termina primero); y una vuelta
sin medición no borra la que había.

**Lo que encontró la revisión adversarial** (un revisor y un refutador por hallazgo, 5 de 5 confirmados, con su test):
- **El diagnóstico obvio era el equivocado: «medido» no es cuándo corrió la barra.** La barra corre cada minuto aunque no
  llegue ninguna respuesta de la API (el CLI guarda la observación real, pero no la pasa por stdin): re-sellar el mismo
  número escondía un Runner que dejó de dar vueltas. Ahora la edad es la de la última OBSERVACIÓN: otros números, o que
  la sesión haya hablado con la API (`cost.total_api_duration_ms`).
- **«Runner activo» no puede salir de `visto_at`**: el Runner de ~/.claude recorre las tres cuentas y les refresca la
  fecha. Activo es que su terminal MIDA (una 5 horas medida hace poco); si no, «Sin el Runner de su terminal».
- **La semanal de la app puede ser de otra cuenta** (el 4º campo lo pone un marcador que se atrasa): si su reinicio no es
  el que vio la terminal de esa cuenta, no se usa. Y al ganar ella, la 5 horas vieja de la terminal no viaja con su fecha.
- **El botón prefiere lo medido hace poco**, y si sólo hay números viejos, los muestra con su edad.

**No verificado:** que la barra de estado reciba la cuota en una sesión de terminal real de cada cuenta (se probó el
comando con la entrada medida en el CLI, no con un Runner abierto). Lo dice el Centro: hasta que el Runner de una cuenta
se abra con su comando, esa cuenta sale «Se mide cuando su Runner está abierto con su comando».

**Vive en:** `lib/centro-uso.ts` · `app/admin/operaciones/Uso.tsx` · `scripts/operaciones/cartero.mjs` (`uso`,
`cuotaDeBarraDeEstado`, `cuotaDe`) · `lib/runner.ts` (`COMANDO_TERMINAL`) · `tests/centro-uso.test.ts`

## Sin accesorios, en qué trabaja cada chat, y un «Nuevo chat» que el Centro no puede abrir solo (16/10/2026)

**El pedido.** «Elimina los accesorios de los personajes», «Cuando un chat dice "Trabajando..." debo saber en qué está
trabajando» y «Falta la opción de "Nuevo chat" tipo placeholder arriba de todos los chats».

- **Sacar una pieza del muñeco no puede romper lo guardado**: los elegidos viven en app_settings con su `accesorio`, y
  `sanearAspecto` exigía las cuatro piezas. Ahora lee tres e ignora la cuarta: lo elegido se sigue viendo, sin ella.
- **«En qué trabaja» es lo último EN CURSO** (un pedido empezado, o un trabajo que le llegó y no cerró), no lo último que
  pasó: un trabajo escrito que todavía no le llegó no es en lo que está. En un flex, el texto largo no lleva «…»: la fila
  lo dibuja como bloque.
- **Medido: el Centro no puede abrir un chat de Claude Code.** Una página web no abre una terminal, start_session no está
  habilitada en esas sesiones, y la pestaña de terminal de la app (que sí carga el perfil de PowerShell: `Get-Command
  claude2` da la función) sólo la abre una sesión de la app, con Martín aprobando cada comando y sin dejar escribir nada
  fuera de ASCII. Así que «Nuevo chat» arma el comando exacto (`claude2 -n 'CRM › Funnels'`, la comilla doblada para
  PowerShell) y Martín lo pega. Lo que queda: que el Runner de esa terminal lo abra solo pide un tipo de trabajo firmado
  nuevo («abrir un chat»), y eso toca el formato de lo firmado: no se hizo sin el OK de Martín.

**Vive en:** `app/admin/operaciones/NuevoChat.tsx` · `lib/runner.ts` (`comandoNuevoChat`) · `lib/centro-chats.ts`
(`enQueTrabaja`) · `lib/centro-munecos.ts` · `tests/centro-fila.test.ts`

## «Review» y el dictado: lo que entra por el cierre y lo que se firma (16/10/2026)

**Los pedidos.** El 6: «"Review"... que graficamente me diga que tengo que ir a revisar de las cosas que ha implementado,
si puede dejarme el link». El 7: «Agrega la funcionalidad de dictar con audio, como ya lo hacemos en otros lados... Y la
de adjuntar archivos o imagenes al chat».

- **Lo que se revisa lo deja el chat, no se adivina.** El cierre suma `--revisar "/crm?lead=12"` (cartero 1.6.0) y el hito
  de la bitácora, `revisar`. Sólo una ruta interna: el Runner la rechaza al escribirla y el servidor la vuelve a sanear
  (`rutaParaRevisar`). Es la MISMA regla que `esHrefInterno` de la Ticketera, pero escrita aparte: ese módulo importa
  `operaciones-reglas`, e importarla al revés era circular. Un test fija que las dos digan lo mismo.
- **«Avance» se llama «Plan», con dos sub-tabs** (copiadas del control segmentado de Linear): «Plan» (el Plan del jefe y
  lo pedido) y «Review» (lo terminado con página, con «Revisar»). Mientras el visor no exista, «Revisar» abre la página
  misma: un link al visor daba 404. El interruptor es `VISOR_REVISAR` (lib/centro-chats.ts) y un test falla si no dice lo
  mismo que el archivo del visor: lo enciende el chat del visor en su commit.
- **El dictado es el de la casa** (`app/_components/useDictar.ts`, el del alta del Plan y del chat de MaKo del
  teléfono): el texto se PEGA en la caja y se firma al mandar, como lo escrito. El audio no viaja a la PC.
- **Los adjuntos NO están, a propósito.** El trabajo firmado lleva sólo texto; un archivo tiene que subirse a MaKo y que
  el Runner lo BAJE a la PC, que es una puerta nueva hacia la PC de Martín. El diseño mínimo: subirlo a un bucket privado,
  poner en el texto FIRMADO su ruta y su sha256, y que el Runner lo baje con su token y lo descarte si la huella no
  coincide. Se construye con el OK de Martín.

**Vive en:** `lib/operaciones-reglas.ts` (`rutaParaRevisar`, `sanearCierres`) · `scripts/operaciones/cartero.mjs` (`cierre`)
· `lib/centro-chats.ts` (`porRevisar`, `enlaceRevisar`) · `app/admin/operaciones/Microfono.tsx` ·
`tests/centro-revisar.test.ts`

## «Copiar comando» con el nombre vacío: un objeto nunca es falso (16/10/2026)

`nombreValido` devuelve `{ ok, … }`, y en tres lugares se lo usaba como booleano: `!nombreValido(…)` en
`CentroApp.tsx` y `ChatsMovil.tsx` daba siempre `false`, y `valido ?` en `NuevoChat.tsx` siempre verdadero. Con el
nombre vacío se armaba `claude1 -n ''`. **El typecheck no lo ve**: un objeto en una condición es TypeScript válido.
Lo encontró el relevamiento de la etapa 2, no un test. Se mira `.ok`, y `tests/centro-fila.test.ts` lo fija.

## El Plan adentro de cada jefe: las operaciones de la API, aplicadas en el acto, por una RUTA (16/10/2026)

**El pedido.** «Los chats y el Centro deberían poder conectarse con el PLAN... Crear tareas nuevas, marcar como
completadas, etc». La convención ya estaba: los proyectos del tablero del super admin se llaman como una tab, y los
jefes también. Cada jefe ES un proyecto.

- **El proyecto se llama «Feature: CRM», no «CRM».** El tablero guarda el nombre canónico con su prefijo. La primera
  versión comparaba el nombre entero y la lista salía SIEMPRE vacía con datos reales; el test pasaba porque su fixture
  decía «CRM». Lo encontró la revisión. Se compara con `nucleo()` (lib/plan-proyectos-catalogo.ts), y el fixture usa
  los nombres como los guarda el tablero. Un jefe que no es un proyecto del catálogo («Automations») lo dice en pantalla.
- **Sin puerta nueva de escritura.** Se lee con `listar_tareas_plan` + `ver_proyecto_plan` (hasta 100 abiertas del
  proyecto, sin el tope de las 300 de más puntaje de toda la lista) y se escribe con `proponer_tareas_plan` y
  `proponer_cierre_tareas` aplicadas EN EL ACTO (`aplicarEnElActo`, lib/api-mako/flujo.ts), el camino de las
  automatizaciones. Quien confirma es Martín con su clic.
- **Es una RUTA (`/api/centro/plan`), no una server action.** Al aplicar corre el Perro (30 a 60 s), y el navegador
  manda las server actions DE A UNA: como acción, mandarle algo a otro chat quedaba esperando a que el Perro terminara.
- **Nada queda a medias.** Antes de proponer se mira si ya hay una abierta con ese título («Ya está en el Plan»): sumarla
  otra vez la fusionaba con ésa o dejaba el borrador colgado en /plan/revisar. Si el borrador no se aplica, se descarta.
  `aplicarEnElActo` ahora devuelve `datos` con el borrador y cuántas nacieron: con 0, el aviso dice «Ya estaba: le
  sumé esto» en vez de «Sumada».
- **Un mensaje NO se vuelve tarea solo.** La propuesta era «los pedidos de Martín a un jefe son tareas de ese proyecto».
  No se hizo así: un mensaje del Centro puede ser una pregunta o un «dale», y el Plan ya se limpió una vez de 64
  proyectos inventados. «Sumar al Plan» es un clic, sin preguntas, en cada pedido sin terminar.

**SIN HACER:**
- Cuando un chat cierra un trabajo «hecho», proponer el cierre de su tarea: falta el vínculo trabajo ↔ tarea (una
  columna en `operaciones_pedidos` o una marca en el detalle). Vive en `lib/operaciones.ts` → `cicloCartero`.
- Lo «SIN HACER» de los relevos (`docs/relevo/*.md`, 13 renglones en 4 archivos) cargado como tareas de su jefe.
- El alta queda firmada con el origen de la tool heredada (WhatsApp) y `ctx.actor` no se usa: lo compensa el texto del
  detalle y de la evidencia, que dicen «Centro de Operaciones».

**Vive en:** `lib/centro-plan.ts` · `lib/centro-plan-reglas.ts` · `app/api/centro/plan/route.ts` ·
`app/admin/operaciones/PlanJefe.tsx` · `tests/centro-plan.test.ts`

## El avance «casi nulo» no era la ventana de 14 días: el historial colgaba de nombres que ningún chat tiene (16/10/2026)

**El pedido.** «Elimina lo de "Antes del 16/10"... Eso debería estar dentro de los mismos chats, como el historial y el
progreso... Deberías traer mayor historial porque el "progreso" de la mayoría es casi nulo... Sobre todo me interesa ver
las cosas que pedí y están pendientes».

- **El diagnóstico obvio era el equivocado.** «Traer más historial» sonaba a abrir la ventana de 14 días. Medido: con
  TODAS las fechas sólo suman 92 pedidos (295 → 387). Lo que vaciaba el avance era otra cosa: **75 de los 81 chats de las
  bitácoras se conocen sólo por un nombre que ningún chat vivo tiene** («Chatbot» 62 hitos, «Graphics» 33, «Funnel y oferta
  del CRM» 20...), y todo eso caía en «Antes del 16/10». Ahora va al jefe que se llama como el ÁREA de su bitácora: con
  los carteros reales, CRM pasó a tener 61 pedidos terminados, Automations 47, Customer Success 26 (y 3 pendientes).
- **Lo pendiente no estaba en ningún chat.** Un pedido sin pasos (nadie lo empezó) sólo iba a `pidioAca`, que desde la
  punta 3 no se dibuja: los pendientes, justo lo que Martín quería ver, no salían en ningún lado. Ahora van al chat donde
  se pidieron (es el que los tiene que hacer).
- **Un jefe sin chat abierto se lista sólo con algo sin terminar** («Local Dev Environment», 6 pendientes): dice que ese
  jefe hace falta. Lo terminado queda en su historial y aparece cuando alguien abre un chat con ese nombre.
- **El peso:** los pedidos de todas las fechas son 575 KB (eran 448 KB con 14 días); lo terminado hace más de 14 días
  viaja corto (`pedidosDelCentro`). Si crece, el paso siguiente es pedir el historial al abrir el chat.
- **Los relevos no se parsean:** son prosa, y sólo 4 tienen «SIN HACER» (13 renglones). Lo pendiente de un relevo va al
  PLAN como tarea del proyecto de su tab (punta 4b), que es de donde el Centro lee lo pendiente.
- **Trampa de herramienta:** un reemplazo cuya ancla es el PRINCIPIO de un renglón deja el resto del renglón pegado
  después del texto nuevo. Pasó en la cosecha de la punta 3 y partió una regla de `AGENTS.md` en dos; las anclas van
  con el renglón entero.

**Vive en:** `lib/centro-chats.ts` (`chatsDeBitacoras`, `completarChats` paso 3, `gruposDelAvance`) ·
`lib/progreso-reglas.ts` (`pedidosDelCentro`) · `tests/centro-chats.test.ts` · `tests/centro-avance.test.ts`

## El Cerebro aparte, los jefes por tab, y un pedido sólo en el chat que lo trabajó (16/10/2026)

**El pedido.** «No estás aplicando la modularización y organización de chats... dentro de ese chat dice "Lo trabajó Centro
de Operaciones"... Si lo trabajó otro, no debería salir allí... hay otro que se llama "dashboard-marketing-7d"... Quiero
chats con los nombres de las tabs que sean "jefes"», y que el orquestador no es un jefe más.

- **Un chat jefe se reconoce por el nombre de una tab, y la lista ya existía en dos registros**: las etiquetas de la barra
  (`app/_components/nav.ts`) y los títulos de las áreas (`app/admin/dev/areas.ts`, que nombran también lo que no tiene
  tab: «Closing Analyst»). Se arma en el servidor (`app/admin/operaciones/tabs.ts`) y viaja como una lista chica: el
  registro de áreas es grande. Lo que no coincide va a «Sin asignar», plegado: renombrarlo lo pasa a su jefe.
- **El Cerebro es UN chat con sus nombres de antes** («Estrategia 3 cuentas» en las otras cuentas, hasta que se renombren:
  sólo Martín puede firmar ese renombre, desde su dispositivo). Mismo muñeco que tenía.
- **«Lo trabajó…» en el chat que pasó el pedido era el diagnóstico obvio y era el equivocado**: no faltaba el chip de la
  cuenta (lo que se había pedido antes), sobraba la línea. Un pedido sale sólo en el chat que lo trabajó; `pidioAca` se
  sigue calculando (dice de dónde vino) pero no se dibuja.

**Vive en:** `lib/centro-chats.ts` (`CEREBRO`, `esCerebro`, `seccionesDeChats`) · `app/admin/operaciones/tabs.ts` ·
`tests/centro-jefes.test.ts`

## El Centro adentro del Second Brain: se monta su MOTOR, no su pantalla (17/10/2026)

**El pedido.** Martín, 17/10 de madrugada: «quiero dejar de mandar prompts por aquí, quiero mandar prompts por MaKo en el
Second Brain, terminemos de configurar eso así ya comenzamos». Es la tanda 5 de docs/diseno-mako-ai-native.md («el Centro
como adaptador de la pieza»), adelantada.

**El diagnóstico obvio era el equivocado, dos veces.**
- *Montar `CentroApp` adentro del Second Brain*: las dos páginas son la misma grilla `.co` (barra + panel), así que salen
  dos barras de chats una al lado de la otra.
- *Copiar el estado del Centro en `ChatSecondBrain`*: es justo la falla que el diseño ya marcaba («hoy está escrita dos
  veces», CentroApp y ChatsMovil). Con tres copias del refresco, de la firma y del renombre, se separan en una semana.

Lo que se monta es el MOTOR. `useCentro` tiene la cola y los Runners (cada 8 s), los pushes después de dibujar, la
Ticketera de cada chat, el borrador y el alcance, `mandar` por `firma.mandar`, Renombrar y el muñeco. `PiezasCentro.tsx`
tiene la fila, la lista, la conversación y los menús, y `datosDelCentroSiOpera` hace la lectura del servidor.
CentroApp, CentroAppMovil, ChatSecondBrain y SecondBrainCentroM montan esas piezas. Cada pantalla pone sólo lo suyo:

- el Centro, la Ticketera entera, los Runners y el comando de «Nuevo chat»;
- el Second Brain, la sección «Claude Code».

**Lo que costó ver:**
- **Un hook no puede ser condicional, y el Second Brain lo abre todo el mundo.** El motor se monta en un componente
  aparte (`ConCentro`) sólo cuando el servidor mandó los datos, y le pasa el motor al cuerpo por una función
  (`children(k)`). Sin datos no corre ningún intervalo ni ninguna lectura de IndexedDB.
- **La guarda va ADENTRO de la lectura, no en la página.** Las páginas del Centro tienen la guarda y la lectura en su
  cuerpo, y el test las mira ahí. Una tercera página que leyera la cola por su cuenta tendría que acordarse de la guarda.
  Por eso `datosDelCentroSiOpera` devuelve null si no `puedeOperar`, y lo hace en sus dos primeras líneas, antes de leer
  nada (con test).
- **`?chat=` ya era el número de una conversación con MaKo.** Un chat de Claude Code va en `?centro=<clave>`. Volver del
  Mapa conserva cuál estaba abierto (`hrefVolver`); si no, la página rearmada abría el jefe de MaKo.
- **En el teléfono, la conversación no puede vivir adentro de la hoja «Tus chats».** Una hoja sobre otra REEMPLAZA
  (SheetM.tsx): al elegir un chat se cierra «Tus chats», y si la hoja de la conversación vivía adentro, se desmontaba
  con ella. Así no se abría nunca, y sin error. Por eso ChatsM va en dos partes: `parte="lista"` adentro y
  `parte="hoja"` afuera, con el chat abierto en el padre.
- **El script que rompía el código para probar el test se cayó a mitad y dejó un archivo roto.** Python en esta PC
  imprime en cp1252, y el «ℹ» de la salida de `node --test` lo tiró (UnicodeEncodeError) ANTES de restaurar. Se restauró
  a mano. La regla para un script que rompe y restaura: `PYTHONIOENCODING=utf-8`, y la restauración en un `finally`.
- **El chequeo de tipos acotado no entró en la RAM** con cuatro chats trabajando. La primera vez el vigía lo mató
  (salida 99), y con el heap bajado se quedó sin memoria (134). Entró a la tercera, con 2,5 GB libres: 13 archivos sin
  errores. Hay que esperar a que se libere la RAM: bajar el heap no lo hace entrar.

**Vive en:**
- `app/admin/operaciones/useCentro.ts`, `PiezasCentro.tsx` y `datos.ts`;
- `app/second-brain/ChatSecondBrain.tsx` (`ConCentro`, la sección «Claude Code»);
- `app/m/second-brain/SecondBrainCentroM.tsx`;
- `app/m/operaciones/ChatsMovil.tsx` (`parte`);
- `tests/second-brain-centro.test.ts`.

## Ops Center: una sola pantalla, Review con todo y el Uso de las cuatro cuentas (17/10/2026)

**El pedido.** Martín, mirando /admin/operaciones en producción (17/10, ~01:30), por el Cerebro, en siete puntos. Esta
punta trae tres:
- el 2: «El Second Brain y el Centro deberían ser exactamente lo mismo en SuperAdmin», con «Ops Center» de nombre y
  «Second brain» como sub-tab debajo de la Ticketera;
- el 4: «no sale el uso de las otras 2 cuentas, y no sale qué plan tiene, o el uso de 5 horas»;
- el 6: «Se terminaron y pushearon cosas y no las puedo ver en Review».

Los puntos 4 y 6 los hicieron dos subagentes Sonnet en el mismo worktree, con archivos que no se pisaban.

**Una sola pantalla, dos puertas.** El atajo era redirigir /admin/operaciones a /second-brain, o montar `CentroApp`
adentro del Second Brain (salían dos barras). Ninguno sirve:
- con la redirección, la barra marca la entrada equivocada y se pierde la guarda propia de la página del Centro;
- montar `CentroApp` es la copia que ya se había descartado.

Quedaron dos PUERTAS, cada una con su guarda: la de MaKo en /second-brain y `puedeOperar` en /admin/operaciones. Las dos
llaman a `PantallaSecondBrain` (app/second-brain/pagina.tsx), que también arma el Mapa. `CentroApp.tsx` se borró.
- **`?chat=` decía dos cosas.** En /second-brain es el número de una conversación con MaKo; en /admin/operaciones, la
  clave de un chat de Claude Code (los links de siempre). Ahora un número es MaKo y cualquier otra cosa, Claude Code, con
  `chatDeClave` (también acepta la sesión).
- **«Second Brain» como sub-tab cambia la LISTA, no el panel.** Tocarlo muestra los chats con MaKo y el Mapa; si no, la
  lista son los chats de Claude Code. Volver te deja en el último chat de Claude Code que tenías abierto.
- **Tres tests leían la FORMA de las páginas, no lo que protegen**: second-brain-chat, operaciones y
  tickets-decisiones-mazo («leerDecisiones() después de puedeOperar», «responder={responderDecision}» en la página).
  Ahora la lectura vive en datos.ts. Se reescribieron para seguir protegiendo lo mismo donde vive ahora: la guarda antes
  de leer, una sola acción que contesta, el Mapa sólo adentro de su `if`.

**Review: el diagnóstico obvio era el equivocado.** Parecía que los chats no terminaban o que el estado fallaba, y lo
terminado estaba bien. Lo que lo dejaba afuera era `&& n.revisar` en `porRevisar`: sólo entraba lo que tenía página
propia, y casi ningún chat la deja. Ahora entra todo lo terminado. Sin página, el link lleva a la tab del jefe
(`rutaDeLaTab`, `destinoDeReview`).
- **El orden de los ítems manda.** 27 nombres se repiten entre la barra del cliente y la del super admin («CRM» es `/crm`
  y `/admin/dev/crm`). La tab del producto va primero, como en `nombresDeTabs`, y un test lee los dos órdenes.
- **Un jefe válido no siempre es una tab.** 63 de las 130 áreas no tienen ítem en la barra («Closing Analyst», «Puente a
  Google Flow»): su Review va sin botón.
- **Renombrar la tab cambió adónde lleva un chat.** Con «Ops Center», un chat «Centro de Operaciones» lleva a la ficha de
  desarrollo (`/admin/dev/centro-operaciones`), no a la pantalla. Para que lleve a /admin/operaciones hay que renombrar
  el chat a «Ops Center».

**El Uso: la ventana de 5 horas faltaba por la PANTALLA.** `Barra` devolvía null sin la ventana, y la cuenta de la app
sólo trae la semanal. Mirar el dato era el diagnóstico equivocado. Del lado de la PC hay otra causa: cartero.mjs
descarta la de 5 horas si tiene más de 30 minutos. Además:
- **La lista del Uso salía de los carteros**: una cuenta sin Runner no aparecía y parecía que no existía. Ahora
  `cuentasDeUso` da siempre las cuatro (`CUENTAS`), con «Sin Runner todavía».
- **El plan** («Max») entra por `Cuota.plan`. La PC todavía no lo manda. Sin plan, la clave NO existe (no `plan: null`),
  porque el test diferencial de la barra de estado compara con `deepEqual`.
- **centro-textos se corta en el primer archivo que falta (ENOENT)** y no revisa los que siguen. Mientras CentroApp.tsx
  no estaba, nadie miraba Uso.tsx.
- **`renderToStaticMarkup` sirve para probar una pantalla sin navegador**, si el componente no tiene hooks
  (`ListaUso`) o se dibuja cerrado (`BotonUso`).
- **Un archivo borrado del disco y no de git rompe 23 guardas de OTRAS áreas.** Las guardas que recorren el árbol leen
  `git ls-files`, y CentroApp.tsx seguía en el índice: ENOENT en la del CRM, la de cobros, la de cursos… Parecía que el
  cambio había roto medio repo. Un archivo que se borra va con `git rm`, en el mismo momento.

**Vive en:**
- app/second-brain/pagina.tsx y ChatSecondBrain.tsx (`enSB`, `irAlSecondBrain`, `irAClaudeCode`, la Ticketera);
- app/admin/operaciones/page.tsx y PiezasCentro.tsx (`PieCentro`, `NuevoChatCentro`);
- lib/centro-chats.ts (`porRevisar`, `rutaDeLaTab`, `destinoDeReview`) y lib/centro-uso.ts (`cuentasDeUso`, `sanearPlan`);
- tests/centro-revisar.test.ts, centro-uso.test.ts y tickets-decisiones-mazo.test.ts.

## La conversación como un chat de verdad: lo que contestó sale del transcript (17/10/2026)

**El pedido.** Martín, mirando el Centro en producción: «Y sobre todo, los chats no se entienden... No se entiende la
conversación que se tiene». La conversación mostraba títulos de hitos («Corrección · 19:32 — …», «Hecho · 04:34 — …») y
líneas como «Lo pediste en Estrategia 3 cuentas». Lo que el chat CONTESTÓ no estaba en ningún lado: el Centro sólo veía
la bitácora, los trabajos y sus cierres.

**Lo que contestó cada chat ya estaba en la PC.** Primero se pensó en «subir el transcript», y es el diagnóstico obvio
equivocado: pesa decenas de MB y está lleno de herramientas y razonamiento. Lo que se encontró:
- **El registro de cada sesión de la app** (`claude-code-sessions/<org>/<x>/local_*.json`) ya trae `lastTurnReport`
  (el texto final del último turno), `postTurnSummary`, `model`, `effort`, `cliSessionId` y `cwd`.
- **El transcript** está en `<carpeta de config>/projects/<cwd con todo lo que no es letra o número cambiado por «-»>/<sesión>.jsonl`.
  Para un chat de la app, en `~/.claude` y con el `cliSessionId`; para uno de terminal, en su carpeta y con su
  `sessionId`. Medido con el chat Onboarding de la cuenta 4.

Así quedó:
- La PC lee del transcript **sólo lo nuevo, por posición en BYTES** (`turnos/<local>.json`). Con posiciones en
  caracteres, una tilde corría todo.
- `turnosDeLineas` (pura, con test) saca lo que se le dijo y la respuesta FINAL de cada turno: el último texto antes del
  próximo mensaje o del fin del turno (`stop_hook_summary`). Si un chat no está trabajando, su última respuesta ya vale.
- MaKo guarda los últimos 60 turnos de cada chat en `app_settings`, **sin migración** (lib/centro-turnos-db.ts). La marca
  de la PC avanza sólo si MaKo dice `turnosOk`.

**Lo que hay que limpiar de un transcript, medido sobre uno real:**
- los `<system-reminder>` vienen PEGADOS al prompt;
- los mensajes de otras sesiones vienen envueltos en `<cross-session-message from=… name=…>`, con un renglón antes y
  otro después;
- los avisos automáticos (`<task-notification>` y compañía) no los dijo nadie;
- la app escribe en nombre del modelo «You've hit your session limit…» (`isApiErrorMessage`, `model: '<synthetic>'`).

**Un trabajo del Centro también llega como mensaje** («Pedido de Martín desde el Centro…», con su id en la línea del
`cierre`). Se marca con ese id y no se dibuja dos veces, porque ya está con sus ticks.

**Un mensaje nuevo cierra el turno anterior, aunque no se muestre.** El aviso de la Ticketera no se dibuja, pero termina
el turno de antes. El test esperaba lo contrario y el que estaba mal era el test.

**Los hitos siguen en el Plan.** `lineasDeConversacion` deja en la conversación los turnos, los trabajos y las respuestas
a la Ticketera. `avanceDelChat` sigue leyendo los pedidos de la bitácora.

**De cada turno salen DOS textos**, por la regla de Martín de que cada chat abre con «Voy a trabajar en…» y cierra con
su «Ya está»:
- el PRIMERO sale en el acto, y se ve mientras trabaja;
- el ÚLTIMO sale al terminar, si es otro (`cierreDe`).

La primera versión sólo guardaba el último, y un chat que trabajaba una hora no mostraba nada.

**«Trabajando» y «dormido» con el Runner caído.** El estado de cada chat sale del registro vivo de la PC
(`sessions/<pid>.json`, `busy` o `idle`), y lo sube el Runner en cada vuelta. Cuando la app se cayó, el Runner dejó de
dar vueltas, y la pantalla mostró una foto de hacía 40 minutos como si fuera de ahora: caras dormidas y «13 %». Ahora:
- la lista dice «Sin noticias del Runner desde las HH:MM» (`sinNoticiasDesde`);
- con la foto vieja, la cara es «cansado» y no «dormido» (`animoDe`, Muneco.tsx);
- un chat que trabaja sin haber escrito nada lo dice (`trabajaSinEscribir`).

**Sin medir:** cómo se ve con chats reales. Hace falta el cartero 1.8.0 instalado y unas vueltas. La primera vuelta de
cada chat sube la cola de su historia (los últimos 2 MB del transcript).

**Del punto «a» (todo chat abierto se ve)**, se midió en la PC (17/10):
- «Pagos» y «MaKo en WhatsApp» están en la carpeta de la cuenta 4 y el cartero los ve. Caían en «Sin asignar», que iba
  PLEGADA; ahora va abierta.
- «Runner» lo excluye el cartero a propósito: no se le puede escribir.
- Los chats de la nube no quedan en ningún archivo de la PC.
Las dos cosas que faltan, con su archivo, están en el relevo.

**Vive en:** scripts/operaciones/cartero.mjs (`turnosDeLineas`, `turnosNuevos`, `turnosDeLaVuelta`, `carpetaDelCwd`) ·
lib/operaciones-reglas.ts (`TurnoChat`, `sanearTurnos`, `unirTurnos`) · lib/centro-turnos-db.ts · lib/operaciones.ts
(`cicloCartero` → `turnosOk`) · app/admin/operaciones/acciones.ts (`turnosCentroAction`) · lib/centro-chats.ts
(`lineasDeConversacion`) · Hilo.tsx (`Turno`) · useCentro.ts (`mirar`, `turnosDe`) · tests/centro-turnos.test.ts

## La cuenta «Automático», el modelo y el esfuerzo: lo que se elige y lo que no se puede (17/10/2026)

**El pedido.** Martín, en el mismo feedback:
- el punto 3: «Al enviar un prompt por el Second Brain no me deja seleccionar qué cuenta... Si no selecciono nada que lo
  decida solo, pero debería poder seleccionar»;
- el punto 7: «que los jefes y el cerebro tengan la capacidad de ahorrar tokens, dando instrucciones precisas y
  eligiendo qué modelo de IA debe correr».

**Elegir la cuenta es elegir a cuál de SUS sesiones va el trabajo.** Un chat es un nombre con una sesión por cuenta
(`unirPorNombre`). La lectura obvia era «mandarlo a cualquier cuenta», y es la equivocada: una cuenta en la que el chat
no está abierto no tiene a quién entregarle. Por eso el selector ofrece sólo las cuentas donde el chat vive, y abrirlo en
otra es el «un clic» (docs/diseno-nuevo-chat-un-clic.md).

«Automático» (`sesionAutomatica`, lib/centro-cuentas.ts) elige así:
1. Primero la sesión que recibe ya: abierta, al día, con Runner en su carpeta y el de su cuenta vivo.
2. Entre ésas, la de más cuota libre, y lo libre lo decide la ventana MÁS gastada (5 horas o semanal).
3. Lo que no se sabe va después de lo que se sabe: tratar «sin dato» como «todo libre» mandaba todo a la cuenta sin
   medir.

**El modelo y el esfuerzo no se pueden cambiar en un chat de terminal.** `set_session_model` y `set_session_effort` son
herramientas de la APP: un chat de terminal no tiene cómo recibir el cambio desde afuera, y la sesión no puede cambiarse
el suyo (el sistema lo prohíbe: «a session must not silently re-price its own turns»). Así funciona:
- en un chat de terminal, el selector aparece apagado y dice por qué;
- en uno de la app, el modelo y el esfuerzo viajan FIRMADOS, opcionales: sin elegir nada, el texto firmado es idéntico al
  de antes (la regla quedó en AGENTS.md);
- la PC se los pasa al Runner con la sesión (`comoCorre`, cartero.mjs 1.7.0), y el Runner los aplica antes de entregar;
- «Automático» no toca nada: lo decide el Cerebro;
- vuelven a «Automático» después de mandar, como el alcance. Así el Runner no cambia el modelo en cada trabajo, y cada
  cambio puede pedirle permiso a Martín en la app.

**Sin medir:** si la app le pide permiso a Martín cada vez que el Runner cambia el modelo de OTRA sesión. La herramienta
dice que sí («any other session, and the app asks the user first»), salvo en modo auto. Si pregunta siempre, el Runner se
frena esperando: hay que mirarlo en la primera prueba.

**Vive en:** lib/centro-cuentas.ts · lib/operaciones-reglas.ts (`MODELOS`, `ESFUERZOS`, `armarFirmable`) ·
app/admin/operaciones/useCentro.ts y PiezasCentro.tsx (`SelectoresDeEnvio`) · app/m/operaciones/ChatsMovil.tsx ·
scripts/operaciones/cartero.mjs (`comoCorre`) · lib/runner.ts (el paso b) · tests/centro-cuentas.test.ts,
tests/operaciones.test.ts y tests/cartero-carpetas.test.ts

## La cuenta 4, y una sesión de la app SÍ abre chats visibles (17/10/2026)

**Una sesión de la app ya puede crear chats.** Lo de arriba («el Centro no puede abrir un chat de Claude Code (medido)», 16/10) quedó viejo para la app de escritorio. La noche del 16 al 17/10, el Cerebro de la cuenta 4 abrió siete chats con `mcp__ccd_session__start_session`: CRM, Onboarding, Centro de Operaciones, Automations, Runner, Video Generator y Dashboard. Cada uno llevaba título y brief, y quedó en la barra lateral. La herramienta aparece como diferida y se carga con ToolSearch. El chat creado arranca solo con su brief y le avisa a quien lo abrió cuando termina un turno. Lo que sigue sin poder hacer una sesión de la app es abrir una de TERMINAL (otra carpeta de config). Para eso, Martín pidió (17/10) «un clic + el permiso de la PC», nunca pegar un comando: está repartido al chat del Centro.

**Sumar una cuenta son cinco lugares, y uno NO.** Los cinco:
- una línea en `~/.claude/cuentas.tsv`;
- el marcador `~/.claude/cuenta-activa.txt`;
- el cartero: `cartero.mjs cartero claudeN app ~/.claude` y `cartero.mjs carpeta <uuid> claudeN`. El uuid es la carpeta NUEVA que aparece en `%APPDATA%\Claude\claude-code-sessions` el día que se loguea;
- `CUENTAS` en `app/admin/dev/_registro/tipos.ts`, porque un hito firmado con una cuenta que no está ahí rompe /admin/dev;
- la regex de `scripts/gen-dev-historial.mjs`, que hasta el 17/10 era `claude1|claude2` y dejaba sin cuenta, sin avisar, todo lo de la 3.

Lo que NO se toca es `CUENTAS_TERMINAL` (lib/runner.ts), salvo que la cuenta tenga su función en el `$PROFILE`: si no, el Centro ofrece un comando que falla. Pasó: el panel de Uso le ofreció a Martín `claude4 -n Runner` y PowerShell contestó «not recognized». Arreglado el 17/10: sólo se ofrece comando a una cuenta con su función en el `$PROFILE` (`tieneTerminal`, lib/runner.ts). A la de la app se le dice «Abre su Runner en la app de Claude para conectarlo», y «Nuevo chat» no arranca en ella. Lo fija tests/runner-cuenta-app.test.ts.

**Cómo se supo que era otra cuenta sin preguntar.** `get_usage` dio 0% con reset el 20/10 19:59 UTC; la 3 renueva el 21/10 08:59 UTC. El `userEmail` del contexto traía un gmail que no era de ninguna de las tres, así que esta vez sí describía la cuenta abierta. `list_sessions` vino vacío porque la barra está partida por cuenta. El aviso de «99% semanal» del hook era de la cuenta 3 y no aplicaba.

**Vive en:** `~/.claude/cuentas.tsv` · `~/.claude/operaciones/config.json` · `app/admin/dev/_registro/tipos.ts` · `scripts/gen-dev-historial.mjs` · docs/relevo/cerebro.md («CUENTA 4»)

## Adjuntos hasta la PC, los «Ya está» en Review, el Runner y la nube en la lista (17/10/2026)

**El pedido.** Martín: «Realmente quiero comenzar a dar feedback de las cosas pero me estás trabando». El relevo del
Ops Center (cuenta 4) hizo cinco puntas chicas: el grafo al tocar «Second Brain», adjuntar en la caja, los «Ya está»
en Review, el Runner y la nube en la lista, y el clic sin PowerShell (este último, a medir con Martín).

**Adjuntos: lo que protege es la FIRMA, no el servidor.** Lo obvio era «MaKo valida el archivo y la PC lo baja». Pero
con MaKo comprometida, MaKo es justamente quien miente. Así quedó:
- el NAVEGADOR calcula el sha256 de los bytes que sube y lo firma con el trabajo (`subirAdjuntos`, mandar.ts);
- si MaKo devuelve otro hash, la caja no firma;
- la PC compara lo que baja con ESE hash, con el tamaño y con el tipo por los primeros bytes (`bajarAdjuntos`, cartero.mjs);
- el nombre en disco lo arma la PC, con la extensión del TIPO y nunca la que trajo («virus.exe» de tipo PNG se guarda
  como `2-virus.png`).

**La revisión de seguridad del Cerebro encontró dos defectos que los tests no veían** (cartero 1.9.1). Los dos son
trampas del entorno, no de la lógica:
- **`Number(r.headers.get('content-length'))` da 0 cuando no hay header.** Una respuesta «chunked» no trae
  content-length, el tope «pasaba», y `arrayBuffer()` leía todo a la RAM: 50 MB reproducidos en Node 24. Con gzip, el
  content-length es el COMPRIMIDO. El arreglo: pedir `accept-encoding: identity`, rechazar lo comprimido y leer
  `r.body` en partes, cortando apenas pasa lo firmado. El test manda 400 partes de 64 KB y mira que se corte en las
  primeras.
- **Un trabajo `tomado` no tenía salida.** El acuse era su único camino, y cancelar y vencer miran sólo lo `escrito`.
  Con los adjuntos la ventana crece: el Runner baja el archivo entre reclamar y escribir el buzón, y su Bash corta a los
  120 s. Ahora lo tomado sin acuse vence a las 2 horas (`TOMADO_VENCE_MS`) como «no sé si llegó» y borra sus adjuntos.
  Además, MaKo da un adjunto sólo en los 15 minutos después de tomado.

**Un campo que cambia lo que la PC HACE se habilita por versión.** La regla del campo opcional dice «un cartero de antes
lo ignora». Con el modelo eso alcanzaba. Con un adjunto es una pérdida silenciosa: el trabajo saldría sin sus archivos y
nadie lo diría. Por eso la caja no muestra el «+» hasta que el Runner de esa cuenta suba la versión que baja adjuntos
(`aceptaAdjuntos`). La versión se compara por número: «1.10.0» es mayor que «1.9.1». La regla quedó en AGENTS.md.

**La subida es una ruta y no una server action**: la action corta el cuerpo en 1 MB y una captura pesa más. El tope es
el de Vercel (~4,5 MB, un 413 en texto plano), el mismo del chat con MaKo: 4 archivos y 4 MB en total. Una captura de
hasta 1,5 MB va tal cual, porque el texto de una captura se lee mejor en PNG. Una foto más grande se achica.

**Los «Ya está» en Review.** Cada «Ya está» es el último texto de un turno (rol `el`, del transcript). Va a Review y no
al Plan: el Plan son los pedidos y los trabajos, y un «Ya está» cierra uno de ellos. Contarlo dos veces inflaría el
«8/13». Sobre la ruta que deja:
- lo que parece una ruta muchas veces es un ARCHIVO: `/c/dev/wt-centro-chat`, `app/x.tsx`, `cartero.mjs`;
- `rutaDeYaEsta` los descarta y pasa cada candidato por `rutaParaRevisar`, la misma regla que Review.

**El Runner y la nube en la lista** (cartero 1.10.0):
- **El Runner ya no se esconde.** Esconderlo era una decisión vieja («al Runner no se le escribe»), y un test la fijaba
  (cartero-carpetas: «el Runner no es un chat»). Martín la dio vuelta («todo chat abierto se ve»), así que el test ahora
  fija la regla nueva. El Runner sube con `esRunner`: se ve, su caja dice por qué no, y nunca está en `entregables`
  (ni en la PC ni en MaKo). Sus vueltas no se suben como conversación.
- **Un chat de la nube no se une con el de la PC que se llama igual.** Por nombre se unían, y la sesión de la nube
  quedaba elegible como destino sin tener canal. Su grupo es `nube:<nombre>`.
- **Sin medir:** la forma real de una fila de `list_sessions` para un chat de la nube. El 17/10 no había ninguno en la
  cuenta 4 (ni archivado). Por eso el id se acepta amplio (`NUBE_RE`: lo que no es `local_`/`cli_`).

**Lo que costó del entorno:**
- **El chat anterior seguía corriendo** cuando arrancó el relevo y commiteó en el mismo worktree entre dos comandos.
  Antes de tocar nada hay que mirar `list_sessions {linked:true}` y `git log`, y pedirle que suelte el worktree.
- **`git apply --3way` deja los archivos con CRLF** en este clon (`core.autocrlf=true`). Un script que reemplaza
  texto con `\n` no lo encuentra («el texto aparece 0 veces»), sin romper nada. Pasó al rearmar la punta 4 sobre la 2b.
- **Un heredoc con backticks en el Bash falla** («unexpected EOF»): los scripts de edición van a un archivo.
- **El typecheck acotado con 13 archivos lo mató el vigía de RAM** (1,5 GB libres). En tandas de hasta 5 archivos pasó.
- **Un hook sin `'use client'` no puede traerse un VALOR de un módulo `'use client'`** (`achicarImagen`, de
  app/m/mako/subir.ts, en useCentro.ts). Los tests del Centro pasaban y el run cayó en tests/frontera-use-client.test.ts:
  para ese barrido es un server usando una referencia de cliente. El Cerebro mudó la función a
  app/m/mako/achicar-imagen.ts, sin la directiva. Antes de pasar una punta se corren también ese test y los barridos que
  recorren el repo (`grep -lE "ls-files|archivosDelRepo|readdirSync" tests/*.test.ts`), no sólo los del área.
- **Tres tests fijaban la FORMA de una línea** (el import de mandar.ts, la llamada a `firma.mandar`, `mensaje(l.p)`).
  Un cambio que sólo agrega un argumento los rompía. Se abrieron para seguir exigiendo lo mismo.

**Vive en:**
- scripts/operaciones/cartero.mjs (`bajarAdjuntos`, `mimePorFirma`, `nombreEnDisco`, `anotarNube`, `leerNube`);
- lib/operaciones-adjuntos.ts y app/api/operaciones/adjuntos/route.ts;
- lib/operaciones-reglas.ts (`problemaDeAdjuntos`, `aceptaAdjuntos`, `NUBE_RE`, `TOMADO_VENCE_MS`);
- lib/centro-chats.ts (`yaEstaDelChat`, `rutaDeYaEsta`, `comoSale`) y app/admin/operaciones/AdjuntosCaja.tsx;
- tests/centro-adjuntos.test.ts, centro-ya-esta.test.ts y centro-runner-nube.test.ts.

## Lo que creí medido y no estaba al día

- **`soloPlataforma` ya existía en el registro de la API** (lo sumó el 2FA obligatorio el 14/10, por
  CAPA en `vistaDe`). El relevamiento leyó un árbol anterior y el diseño decía que faltaba: se
  corrigió. Las lecturas del Centro lo usan.
- **`docs/api-mako.md` documenta lo que sale por HTTP**: un área sin `'http'`, como ésta, no aparece
  ahí, y el generador dice «al día» con razón.
- **La hora de una bitácora es la de ARGENTINA, no la UTC** (`instanteHito`, lib/progreso-reglas.ts). Los hitos de la
  cuenta 3 del 15/10 se anotaron con la hora UTC de los mensajes (23:18 sobre un commit de las 20:18 -0300): el avance
  los ponía tres horas en el futuro. Se corrigieron; la hora sale de `git log --format=%ci`. Y la FECHA también: los
  mensajes de los chats y varios documentos del Centro dicen «16/10» para lo que en Argentina fue la noche del 15/10
  (la fecha UTC). `date` en la PC lo contesta en un comando.

## Lo que quedó sin hacer

- **El clic sin PowerShell (punta 5, 17/10)**: el diseño está en docs/diseno-nuevo-chat-un-clic.md. Antes de construirlo
  hay que medir con Martín presente que la ventana se vea, porque abre una ventana en su pantalla.
- **Los adjuntos subidos y nunca firmados** (se cerró la pestaña entre subir y firmar) quedan en el bucket `archivero`,
  con el prefijo `operaciones/`. No hay barrido (lib/operaciones-adjuntos.ts).
- **Adjuntar texto** (txt, md, csv, un log): hoy la caja acepta sólo fotos y PDF, lo mismo que el chat con MaKo. Un
  archivo de texto no tiene firma por bytes: hay que decidir cómo se valida antes de que baje a la PC.
- **Escribirle a un chat de la nube**: hoy se ve y no tiene caja. `SendMessage` llega a las sesiones de la nube (lo
  dice `ListAgents`), así que el Runner de la app podría entregarles. Sin medir.
- **La forma de una fila de `list_sessions` para un chat de la nube**: medirla con el primero que haya.
- **En el Second Brain (17/10) no están la Ticketera entera, los Runners con el Uso ni el «Nuevo chat» de Claude Code**:
  siguen en /admin/operaciones. Cada chat sí muestra su pregunta arriba de la caja, y la caja ofrece crear y copiar el
  Token. Si Martín los pide ahí, entran por la barra de `ChatSecondBrain.tsx` con `TicketeraCentro`, `BotonUso` y
  `NuevoChat`, montados sobre el mismo `useCentro`.
- ~~El chat «Cartero» con su cron~~: corre desde el 15/10 en la cuenta 3 («pasó hace 41 s») y la PC acepta un Token
  (`cartero.mjs estado`, 15/10). Falta que Martín lo renombre a «Runner» (la línea, en docs/relevo/centro-operaciones.md).
- **La Ticketera no muestra si el aviso llegó**: el dato está (`aviso_estado`), la pantalla no lo dibuja.
- **Fase 2 del aviso**: firmar la respuesta al contestar, para que el aviso la lleve adentro.
- **El chat Runner en cada cuenta que esté corriendo** (15/10): sin él, lo que se escribe en la caja queda «escrito».
  Sus instrucciones se copian desde el Centro (Runners → Nuevo Runner; viven en `lib/runner.ts`). Y el Token de cada
  dispositivo, pegado en el Runner.
- ~~Los textos de Avance y Pushes~~: las dos vistas se fueron en la punta 2 (el avance está en cada chat).
- **Abrir el Runner de cada cuenta en su terminal** (lo hace Martín: `claude2 -n Runner` en PowerShell y pegarle las
  instrucciones; los pasos en docs/relevo/centro-operaciones.md). Desde la 1.4.0 (16/10) una cuenta tiene varias fuentes
  (la app y su terminal), la PC ya las tiene declaradas, y `SendMessage` está medido: no cruza carpetas.
- ~~Implementar el rediseño de `docs/prototipos/centro-operaciones.html`~~: lo reemplazó el de punta a punta del 16/10.
- **Dos ideas de Sintra y Grok Bot que no se hicieron** (16/10): una caja de pedido GENERAL arriba del equipo («¿Qué
  necesitás hoy?», con un «Para:» que elige al empleado, como el de Grok Bot) y chips con contadores («3 te esperan»).
  Hoy se le escribe a un empleado desde su conversación, y el globito ya cuenta lo que espera.
- **Progreso con lo que está en la PC**: los chats abiertos y lo escrito sin subir llegan con el cartero
  (sube sus chats en cada vuelta); hoy Pedidos y Áreas sólo ven lo desplegado.
  ⚠️ **Lo «sin subir» se cuenta con `git cherry`, no con «ahead N»:** el 15/10 el coordinador midió un clon
  con 17 commits «por delante» de main y 16 ya estaban en main (copias de un rebase); uno solo era real.
  Contado con `ahead`, la pantalla mostraría como pendiente trabajo que ya está subido.
- **El push de cada pedido terminado**: con el token de GitHub, `compare/<commit>...<deploy>` los une a todos;
  hoy la fila dice «En producción» sin nombrarlo (por la hora acertaba 110 de 202; por la punta, 0 de 88).
- **El token de GitHub de la plataforma (404 desde la transferencia)**: sin él no hay commits por push ni
  cierre de tareas del Plan por commits. El repo cableado al owner viejo ya se arregló (dcad6ddd2); falta
  que Martín le dé al token acceso a `hola-mako/dashboard-marketing`.
- **Las cuentas de terminal**: logueadas las tres (Martín, 16/10: «Listo las 3 cuentas»); falta su marcador por
  directorio y sus hooks, y abrir el Runner en cada una.
- **La opción C** (un hook con `asyncRewake` en la carpeta del Cartero, que lo despierta sin gastar
  turnos): documentado que despierta a una sesión ociosa; no probado con `Stop`. Necesita el OK de
  Martín porque es configuración.
- **El teléfono, para MANDAR**: desde el 16/10 la caja también está en `/m/operaciones` (por `mandar.ts`), con la clave
  DEL teléfono, que la PC tiene que aceptar aparte. Falta verlo en su iPhone de verdad (el teclado sobre la hoja).
- **Etapa 2 (la cuota)** y **etapa 3 (el señalador)**.
- **Proponer un pedido desde un chat de MaKo** con `confirmacion: 'pantalla'` (se firma en la pantalla):
  no está en el registro.
