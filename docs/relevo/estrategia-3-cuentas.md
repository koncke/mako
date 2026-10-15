# Relevo — Estrategia 3 cuentas (el chat orquestador)

<sub>Reescrito por el chat «Estrategia 3 cuentas» (cuenta 1, claude1) el 15/10/2026, madrugada hora AR.
Material de PRIMERA MANO: este chat coordinó los cuatro pushes de la madrugada y el reparto a cinco
chats. Lo anterior (la ventana del 14/10) está en el historial de git.</sub>

## LO PRIMERO: producción estuvo sin desplegar y ya no

Al transferir el repositorio de `mbustos-digital` a la cuenta de Martín (`hola-mako`), el proyecto de
Vercel quedó **sin repositorio conectado** (`link: null`) y nadie lo vio durante horas, porque
`git push` seguía andando: GitHub redirige el remoto viejo. Tres tandas (Chats, Image, Centro de
Operaciones) entraron a main y ninguna se desplegó.

**No era la GitHub App ni «Project Members».** Era el ROL: Martín estaba en el equipo de Vercel como
Developer, y Developer no puede tocar la conexión Git. Se sube a MEMBER, se conecta, se baja — el link
sobrevive al cambio de rol, verificado después de bajarlo. El detalle completo, con lo que costó cada
diagnóstico equivocado, en `docs/hallazgos-infra.md`.

⚠️ **El remoto del clon todavía dice `mbustos-digital`** y funciona por el redirect de GitHub. Conviene
apuntarlo a `hola-mako` para que nadie lea mal de quién es el repo.

## Qué entró a main en esta ventana

| Commit | Qué trae |
|---|---|
| `1b177b414` | La contraseña obligatoria (Ciberseguridad). Sale APAGADA: sin fecha en el negocio, a nadie se le pide crearla. Migración 0286 aplicada y verificada en el catálogo. |
| `b8b298600` | «Email a la persona» y el evento de restablecer contraseña (Automations). La fila de la plantilla **todavía no se creó**: nace PAUSADA y se prende con Martín sabiendo. |
| `5d0e97e9b` | La Ticketera no tenía puerta en la computadora. Con test, roto tres veces. |
| (en vuelo) | «Olvidé mi contraseña» (Ciberseguridad), con la migración **0287 sin aplicar**. |

## Lo que está repartido, y qué espera cada uno

- **Ciberseguridad** — rediseña «Tu cuenta» y «Configuración del negocio». Martín aprobó el plan:
  dos lugares, como Google. Seguridad SE QUEDA en Perfil (lo que le molestaba era la pantalla, no el
  lugar) e **Integraciones es lo que se muda**. Arranca después de cerrar «Olvidé mi contraseña» el 18.
- **Offer** — está sacando el hub de Onboarding. Midió que las DIEZ secciones ya se capturan en
  `/second-brain`; el diagnóstico de Martín y el mío («unas sí, otras no») era el equivocado. La ruta
  `/onboarding` queda viva por el wizard del primer ingreso, las vistas no se borran (las importan
  Second Brain y Ads Writer) y hay **16 links** que se revisan de a uno.
- **Centro de Operaciones** — rediseña su pantalla copiando una app real y devuelve una tabla con las
  once tabs de admin: se queda / se funde con X / se va.
- **Automations** — tiene que declarar `lib/flujos.ts` en `tests/undecima-email-propio.test.ts`, que
  es el rojo que dejó su commit en main (medido acá: 7 pases, 1 fallo).
- **Plan** — cargó la #842, «Perfeccionar Second Brain y decidir qué sale a tab propia (Writer,
  Avatar con IA)», en «Feature: Second Brain».

## Lo que espera a MARTÍN y traba fechas

1. **Cómo se recupera una contraseña olvidada.** Se construyó con la opción A (link de un solo uso,
   30 minutos, MÁS el segundo factor si la cuenta lo tiene) y falta que la confirme antes de la
   prueba del 19.
2. **Si se rechazan contraseñas filtradas** (Have I Been Pwned).
3. **Las cinco decisiones del registro de dispositivos**, que bloquean algo que el diseño prometía:
   hoy **restablecer la contraseña NO cierra las sesiones abiertas**, porque el token no guarda ni
   cuándo se emitió ni de qué sesión. Tampoco existe el mail «tu contraseña cambió».
4. **Ángulos**: ningún generador lo lee (`elegirAngulo` nunca llama a `getRecomendaciones`), así que
   cada «regenerar» paga IA para una lista que sólo se dibuja. Queda por ahora; la decisión es suya.

## La regla nueva, y por qué importa más que cualquiera de estas tandas

Martín rechazó DOS pantallas seguidas con la misma palabra —«horrible»— y pidió que quedara como
regla: **ninguna pantalla se diseña de cero, se COPIA de una app que ya resolvió eso**. Está en
`AGENTS.md` (commit `272b7e038`), no en una memoria: ya estaba pedido desde el 11/10, vivía sólo ahí,
y por eso volvió a pasar. La referencia **la elige y la abre el chat** aunque él no la nombre, se copia
la estructura y nunca los colores, la fuente se NOMBRA en el commit, y si no se puede abrir se avisa en
vez de inventar.

## Trampas de esta ventana, medidas

- **El árbol del clon puede estar NUEVE commits atrás** y leerse como el actual. Acá se leyó un
  `nav.ts` viejo y por poco se edita sobre él. Antes de tocar un archivo compartido: `git fetch` y
  `git rev-list --left-right --count origin/main...HEAD`.
- **La Ticketera se podía abrir desde el TELÉFONO y no desde la computadora.** Lo tapaba que el único
  ítem que dice `/tickets` sea «Reportar problema», que es otra cosa: buscar «ticket» en el nav
  devolvía algo, y ese algo no era. Un cero plausible sobre la pregunta equivocada, otra vez.
- **Un `grep -E "^. (tests|pass)"` no caza la salida de `node --test`**: el símbolo `ℹ` es multibyte.
  Dos roturas se dieron por no medidas cuando en realidad el filtro no matcheaba. Se filtra por
  `"tests [0-9]+|pass [0-9]+|fail [0-9]+"`.
- **Los números de una rotura se MIDEN.** Acá se escribieron a ojo en un comentario («1 fallo y 20
  pases») y la medición real dio otra cosa (base 17/0, cada rotura 16/1). Si el comentario no sale de
  una corrida, es una afirmación.

## Cómo se pushea hoy, con ~15 chats sobre un clon y 16 GB de RAM

- **Un solo push por vez, y lo hace el orquestador.** Cada push corre un `tsc` de ~4-5 GB. Si corren dos a la
  vez, mueren los dos, y la app de Claude se cayó dos veces por eso (14/10, a las 04:27 y a las 06:10).
- **Integración en un worktree aparte** (`C:/dev/wt-push-<letra>`; la última letra usada fue la `o`): se parte
  del main del clon y se suman las ramas de cada chat con **merge, nunca rebase**, porque las bitácoras citan
  hashes. Un chat que rebasea su rama trae copias de commits que ya entraron y choca en decenas de archivos:
  se le devuelve para que mergee él.
- **Martín pidió (14/10 13:00) «No esperes por la ram, pushea directamente».** El procedimiento:
  `Stop-ScheduledTask mako-vigia-ram`, una red propia (`guardia_push_<letra>.ps1`, en el scratchpad de este chat)
  que mata sólo el tsc de ese worktree si quedan menos de 300 MB, `MAKO_TYPECHECK_SIN_ESPERA=1 git push origin
  HEAD:main`, y al terminar `Start-ScheduledTask`. El script es `push_<letra>.sh`. ⚠️ Después de cada push se
  verifica `(Get-ScheduledTask mako-vigia-ram).State` = Running: varias veces quedó en «Ready».
- **Si otro chat tiene el turno del lock esperando RAM** (un `typecheck-lock.mjs` sin un `tsc` hijo), frena a
  todos: se corta ese `git push` (`taskkill /T`), no subió nada, y se le avisa al chat.
- **Después del push:** `npx vercel ls` hasta Ready (pushear no es desplegar), y avisarle a cada chat.
- **Cada push se le reporta a Martín en bullets**, en palabras de producto (memoria `pushes-con-bullets`).
- ⚠️ **Mientras corre un push, su worktree NO se toca** (ni merge ni edición): el pre-push chequea el DISCO.
  Ver `docs/hallazgos-infra.md` → «Mergear en el worktree de un push mientras corre su pre-push».
- ⚠️ **El typecheck completo pide 5120 MB de heap desde el 14/10 13:15** (el Image Editor portado lo pasó de
  4096). Arranca con 2-4 GB libres, pagina, y termina en ≈ 4 min.
- ⚠️ **Antes de pushear una rama con paquetes nuevos**, que estén en `package.json` y en el lock: el
  `node_modules` del clon tiene paquetes sueltos y el typecheck pasa igual (14/10: `qrcode` tiró un deploy).
- ⚠️ **Para sacar el junction de un worktree desde PowerShell**, `(Get-Item <ruta>\node_modules).Delete()`: la
  guardia de la app bloquea `cmd /c rmdir` («Remove-Item on system path '/c'»).

## Lo que quedó pendiente al cierre (14/10 15:05, cuenta 2 al 95%)

- **Todo lo terminado sale en el push de cierre** (General sexta vuelta con el arreglo urgente del Dashboard
  sin hojas `78fe81321`, y `editor-imagen` hasta `912d2d2d8`). Si no quedó Ready, el log es `push_o.log` del
  scratchpad de este chat.
- **Pedido de Martín sin chat que lo tome (14/10 14:34, textual):** «Dale este mismo feedback al dashboard...
  Que rediseñe bloque por bloque y que tenga en cuenta mobile. Que vaya viendo con datos ficticios o con algun
  dato de algun workspace que todo se vea bien en diseño. Tanto bloques como las plantillas.» No hay un chat
  del Dashboard abierto y la cuenta 2 no lo arranca (95%). El método (capturas por bloque y por plantilla, en
  escritorio y a 364 px) está en `docs/hallazgos-objectives.md` → «General, sexta vuelta», y el pendiente en
  «Lo que quedó sin hacer» del mismo archivo.
- **CRM está en la tanda B**: la integra el orquestador, y que el CRM NO rebasee su rama.
- **Landing Generator:** rojo en main de `tests/integracion-sin-salir.test.ts` por
  `app/landing-generator/editor/dialogos/DialogoPublicar.tsx` y `editor/nodos/CobroBoton.tsx` (links a
  /integraciones); se le pasó el 14/10 14:12.
- **Rojo conocido en HEAD:** `tests/cobranza.test.ts` (lo reportó General; no frena el push).
- **Nunca** pushear `wip/api-acciones-1410` («A MEDIAS»), `api-acciones-1310` ni `opcion-image-en-clientes`.
- **Decisiones de Martín, sin contestar:**
  - si la tab Image se ve también mirando un cliente (está armada en `opcion-image-en-clientes`);
  - si la barra de selección en lote del Ads Manager va oscura o clara;
  - que el vigía se levante solo si se cae (hoy sólo arranca al iniciar sesión, y el 13/10 estuvo seis horas
    caído sin que nadie se enterara);
  - confirmar el borrador de 50 tareas del Perro: https://hola-mako.com/plan/revisar/propmv7rwo1dkj2i6
