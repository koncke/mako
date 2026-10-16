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
  las sesiones de terminal de otra cuenta, y no está medido si `SendMessage` puede cruzar de un
  directorio a otro. Por eso hay **un cartero por cuenta**, que entrega adentro de la suya.
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

- ~~El chat «Cartero» con su cron~~: corre desde el 15/10 en la cuenta 3 («pasó hace 41 s») y la PC acepta un Token
  (`cartero.mjs estado`, 15/10). Falta que Martín lo renombre a «Runner» (la línea, en docs/relevo/centro-operaciones.md).
- **La Ticketera no muestra si el aviso llegó**: el dato está (`aviso_estado`), la pantalla no lo dibuja.
- **Fase 2 del aviso**: firmar la respuesta al contestar, para que el aviso la lleve adentro.
- **El chat Runner en cada cuenta que esté corriendo** (15/10): sin él, lo que se escribe en la caja queda «escrito».
  Sus instrucciones se copian desde el Centro (Runners → Nuevo Runner; viven en `lib/runner.ts`). Y el Token de cada
  dispositivo, pegado en el Runner.
- ~~Los textos de Avance y Pushes~~: las dos vistas se fueron en la punta 2 (el avance está en cada chat).
- **Que un trabajo llegue a una cuenta que NO está abierta**: hoy espera a que la app pase a esa cuenta (o a que corra
  en terminal con su Cartero). Para las tres en paralelo: `/login` de la 1 y la 2 en terminal (lo hace Martín), su
  cartero como `cli` y un Cartero en cada una. ⚠️ El cartero acepta UNA fuente por cuenta (`app` o `cli`): una cuenta
  con chats en la app y en terminal a la vez necesita las dos (scripts/operaciones/cartero.mjs → `carteroDe`). Y no
  está medido si `SendMessage` cruza de un directorio de configuración a otro.
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
- **Las cuentas de terminal**: el `/login` de cada una (lo hace Martín), su marcador por directorio y
  sus hooks, y un chat Cartero en cada una. Hasta entonces, sólo entrega el cartero de la app.
- **La opción C** (un hook con `asyncRewake` en la carpeta del Cartero, que lo despierta sin gastar
  turnos): documentado que despierta a una sesión ociosa; no probado con `Stop`. Necesita el OK de
  Martín porque es configuración.
- **El teléfono, para MANDAR**: desde el 16/10 la caja también está en `/m/operaciones` (por `mandar.ts`), con la clave
  DEL teléfono, que la PC tiene que aceptar aparte. Falta verlo en su iPhone de verdad (el teclado sobre la hoja).
- **Etapa 2 (la cuota)** y **etapa 3 (el señalador)**.
- **Proponer un pedido desde un chat de MaKo** con `confirmacion: 'pantalla'` (se firma en la pantalla):
  no está en el registro.
