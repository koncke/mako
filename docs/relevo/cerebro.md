# Relevo — Cerebro

<sub>Esta sección se PISA en cada relevo y no pasa de ~90 líneas. Lo viejo, tal cual se escribió, está en
`cerebro-historia.md` (arriba de todo, el relevo del 24/10 de claude1 para la cuenta 5, ya cumplido).</sub>

## ⏩ LEER PRIMERO — 28/10/2026 ~21:00, cuenta 4 (claude4)

**Si sos una cuenta NUEVA**, Martín te escribe «Hola, eres la Nª cuenta… Continúa con todo» y con eso alcanza. No
preguntes: hacé esto en orden.

1. **La cuenta:** `claude<N>` en `~/.claude/cuenta-activa.txt`; su línea en `~/.claude/cuentas.tsv`; `get_usage` →
   `uso-semanal.txt` y `uso-cinco.txt` con la cuenta en el 4º campo. El reset semanal prueba que es otra cuenta.
2. **El Runner, y probado de punta a punta** (Martín, 27/10: «siempre, al abrir una cuenta nueva, asegurate de que esté
   bien la conexión con el Ops Center»):
   - `node ~/.claude/operaciones/cartero.mjs cartero claude<N> app ~/.claude` y `… carpeta <uuid> claude<N>`;
   - `start_session` «Runner», `claude-haiku-5-5`, esfuerzo bajo, con `INSTRUCCIONES_RUNNER` (lib/runner.ts) como
     encargo + «hacé una vuelta ya»; después `detach_session`;
   - ⚠️ **EN BYPASS, como los chats.** En «auto», la app RETIENE los mensajes entre sesiones de modos distintos y el
     cartero los acusa «ok» igual: el 27/10 Martín escribió tres veces y nadie contestó (docs/hallazgos-operaciones.md).
     Si lo abrís en auto para no mostrar una tarjeta, subilo con `set_session_permission_mode` (desde bypass no pide nada);
   - **El ciclo se prueba con el reloj:** `medido` de `~/.claude/operaciones/uso/<cuenta>.json` cambia DOS veces seguidas
     (cada 2 min). Después, un mensaje de prueba de Martín desde el Ops Center tiene que llegar al Cerebro.
   - ⚠️ Un reinicio de la app se lleva el CronCreate del Runner, y el Runner NO lo re-arma si se lo pide el Cerebro
     (es config persistente): se abre uno nuevo en un turno de Martín.
3. **Este chat se llama «Cerebro».** Los de área se abren EN EL TURNO de Martín (un turno que arrancó con el mensaje de
   otra sesión no puede abrir chats), cada uno con su worktree `C:/dev/wt-<área>-<fecha>`.
4. **El estado de la cuenta anterior se VERIFICA con git, no se copia** (lectores Sonnet sobre la cronología + git).
5. **La ronda anti-trabas, cada hora** (Martín, 28/10: «Revisa que otras cosas quedaron trabadas, eso no puede pasar»).
   Un CronCreate en este chat (`17 * * * *`) y a mano al arrancar:
   - ListAgents: un chat «waiting on a human» o «pending» por más de 30 min, o uno local idle con trabajo, se destraba;
   - `git ls-remote origin 'refs/heads/nube/*' 'refs/tags/nube/*'` contra main: lo que no entró va al tren;
   - los tickets abiertos, cada uno con un chat dueño vivo.
   El 28/10 había cinco chats de la nube 13 horas sin entregar (esperaban aprobaciones que nadie vio), tres ramas
   `nube/*` sin integrar y el ticket #15 de Leila sin dueño. Un chat de la nube NO le avisa al Cerebro: se lo mira.

## Estado al escribir (28/10 ~21:00 ART, claude4 — la cuenta arrancó el 27/10 20:33)

**Si Martín te escribe «Continua»:** la regla del 97% (28/10) dejó a cada chat con su relevo commiteado y anotó dónde en
`~/.claude/relevos-cuenta/claude4.tsv` (carpeta, rama, transcript). Leé eso, este estado y el relevo de cada chat.

- **`main` = `23b329b5e` (tren-v), subido el 28/10 15:24.** El Video Editor de Leila (ruido y silencios), MaKo
  inteligente (el Second Brain con las funciones de MaKo) y la copia idéntica de landings.
- **tren-w en `C:/dev/wt-push-q` (rama `tren-w`), sin subir.** Lleva:
  - la pausa del Cerebro por archivo (`node scripts/pausa-cerebro.mjs prender|apagar`);
  - `cambiarSettingSi` con valores largos (CAS por `updated_at`);
  - tsc-acotado con el lock de un tsc por PC;
  - las cajas de chat `31fd30df2` (verificado);
  - el corte del 97% prendido otra vez, con su test.
  - **Se sube** cuando estén verificados el WhatsApp (urgente) y el blanco del Web Generator, con
    `MAKO_TIPOS_SOLO_TANDAS=1 MAKO_TIPOS_HEAP_MB=4608 MAKO_TIPOS_RAM_MIN_GB=4.8 git push origin HEAD:main`.
  - **El deploy se confirma** con `npx vercel ls --scope mbustos-4239s-projects -m githubCommitSha=<sha ENTERO>` y
    `vercel inspect hola-mako.com`.
- **Dos workflows corrían al escribir esto.** Otra cuenta no los reanuda, pero puede leer lo que devolvieron en
  `~/.claude/projects/C--Users-marti-OneDrive-Escritorio-dashboard-marketing-main/6ea62e88-206b-49e4-b5fe-e446feb70ded/subagents/workflows/<runId>/journal.jsonl`:
  - `wf_fbaed0b3-099`, **los pedidos perdidos.** Martín: «Revisa todos los pedidos de absolutamente todos lados, a ver si
    no se perdieron otras cosas», y «No frenes la investigación... me sirve para la próxima cuenta». Lo que devuelva se
    reparte a los chats y se le reporta a él.
  - `wf_750ef430-595`, **la verificación de Zernio y de las horas del CRM: TERMINÓ, las dos con defectos.** No entran al
    tren. Informes: `C:/dev/revisiones/2810-verificacion-zernio-bef5bfcd3.md` y `…-crm-horas-b799f7ed4.md`.
    - Zernio: programaba en el Instagram de OTRO negocio, entre otros. Ya se los mandé.
    - CRM (`crm-horas-2810`, chat CRM y Chats): ALTA. En el chat de la app, `listar_horarios_reunion` convierte el `startIso` y
      `proponer_agendar_reunion` no lo encuentra: la reserva falla siempre. Más dos bajas: claves `_utc` con hora local, y
      el «inicio» de un evento de comunidad al lado de otra zona. **SIN MANDAR al chat** (tope de 10 mensajes): va en cuanto
      Martín escriba.
- **VERDEs que faltan verificar** (cada uno con verificador + refutador; informes en `C:/dev/revisiones/`):
  - **MaKo en WhatsApp, urgente.** Cuatro altas:
    - un «?» dentro de un link cuenta como pregunta;
    - la ventana de 6 h silencia todo;
    - no lee el mensaje citado que viene en `contextInfo`;
    - ante un audio citado que falta, pide «conectá tu OpenAI».
  - **Replicar landings: P0, el Web Generator en blanco** (cuenta de super admin, desde cualquier dispositivo). Después,
    que la réplica sea editable entera. Las cinco copias de prueba (#68–#72, ws9) van a la papelera cuando cierre el P0.
  - **MaKo sin conexión.** T1 arreglada: `desktop-offline-2810` = `6ef621b24` + `813101f75`. T2:
    `desktop-offline-t2-2810` = `3e6a0dddf` + `746633c96`. La migración 0346 necesita el sí de Martín.
  - **Planes, medias:**
    - el reintento de OXXO;
    - el trial del día 8 que falla y queda detrás del tope de 50.
  - **Automations:**
    - ALTA `ef1c248b4`;
    - ticket 19 `e90bae7d1`;
    - topes `c6f78deb4` y `0c121ab4b`;
    - la difusión desde el CRM que pidió Leila;
    - las medias.
  - **Copywriter**, y **MaKo inteligente** `809887ac9`.
  - **Tres ramas de la nube:** clic derecho `419d11e90`, media buyer `54e13e9cc`, video generator `9012f6070`.
  - **Editor, ticket 23 (subtítulos de Leandro).** El OK al arreglo está dado: `generarSubtitulos` devuelve
    `{ok|motivo}` y el chat dice la causa real. Desplegado eso, se cierra el ticket con el aviso a Leandro.
  - **CRM: acciones en lote y papelera** (tickets 21 y 22 de Leila). Necesita una migración; el SQL va a Martín.
- **Después de subir tren-w:**
  - el aviso a Leila (la confirmación del plan de Nadia, que está retenida);
  - el aviso a Leandro (las keywords);
  - la config del 680, aplicada con el «dale» de Automations;
  - la prueba de Instagram en Fiesta Music, coordinada con Leandro después del deploy de Zernio;
  - la migración 0342, con el sí de Martín.
- **Hecho hoy en producción, fuera del tren:**
  - contestado el audio citado de Leandro;
  - corregido el lead «ganado» que tenía la tarjeta en Perdido (la verdad era Perdido);
  - 13 réplicas malas, a la papelera;
  - Leila avisada de que puede usar el editor en vez de CapCut.
- **La app se cayó a las 18:34 con todos los chats adentro:** tres tsc a la vez. Desde entonces lo pesado de los chats
  pasa por `node C:/dev/con-turno.mjs …`, con dos filas: tipos y tests, una a la vez cada una. Sin turno en 30 min, no
  corre (sale con 99).
- **Chats vivos (claude4, bypass)**, cada uno con su relevo en su carpeta:

  | Chat | Sesión |
  |---|---|
  | Web Generator: replicar landings | `local_1dd40ee7` |
  | MaKo en WhatsApp | `local_216acd59` |
  | MaKo inteligente | `local_4f7b9970` |
  | Planes, pagos y Partners | `local_46497093` |
  | CRM y Chats | `local_61bd6f00` |
  | Zernio | `local_b48d54c4` |
  | Video Editor de Leila | `local_c698e704` |
  | Copywriter | `local_ce7663bd` |
  | Automations | `local_ea2a6e6a` |

- **Cuota a las 20:42 ART:** 5 h al 87% (se renueva 21:30 ART), semanal al 80% (se renueva el 3/11 17:00 ART).
- **21:15 ART: el corte del 97% saltó en el Cerebro (ventana de 5 h), el primero real después de prenderlo.** Negó un
  Bash y anotó la sesión en `~/.claude/relevos-cuenta/claude4.tsv`: anda. Lo que quedó a medias en ese momento:
  - **21:33, HECHO: la fila de tests de `C:/dev/con-turno.mjs` tiene DOS lugares** (`mako-tests.lock` y
    `mako-tests-2.lock`) y espera hasta 90 min; la de tipos sigue de a uno con 30 min. Era cola, no un cuelgue: siete
    chats para un lugar, y el que esperaba 30 min salía con 99. Probado con tres trabajos (dos a la vez, el tercero espera)
    y dos de tipos (de a uno). Respaldo: `C:/dev/con-turno.mjs.antes-2-lugares`.
  - **21:35, después de la renovación:** los nueve chats recibieron «seguí desde tu relevo» con lo suyo. El CRM recibió
    los defectos de las horas y Automations la explicación de la cola.
  - **21:45: VERDEs de WhatsApp `c358fd0c4`** (wa-fallas-2710; van también `c1b3d3a2a` y el merge `c465a407b`; relevo
    `a949fef12`) **y de MaKo inteligente `b2c19c445`** (mako-inteligente-2710-c4, sobre `c659dc0f4`, ya en main).
    Verificación en curso: `wf_930af84b-003` (task `wfduhtfbm`). Los árboles de sólo lectura son
    `C:/dev/verif-c358fd0c4` y `C:/dev/verif-b2c19c445`; antes de borrarlos, sacar el junction con `cmd /c rmdir`. Si sale
    limpio, va a tren-w; WhatsApp es lo urgente.
  - **Ronda de las 21:46:**
    - Los chats locales quietos esperan sus tests (dos lugares). WhatsApp sigue con la tanda A (el crédito Max para
      los grupos).
    - Los nueve tickets abiertos tienen dueño vivo y ninguno está resuelto en producción.
    - Cuatro chats de la nube (Planes, Automations, Landings y Motion) esperan desde AYER una aprobación que sólo
      Martín puede dar en la nube.
    - Sus tres ramas siguen fuera de main: `nube/clic-derecho-2710` (`419d11e90`, el clic derecho en siete listas),
      `nube/media-buyer-2710` (`54e13e9cc`) y `nube/video-generator-2710` (`9012f6070`, el estudio copiado de Arcads).
      Están sobre un main viejo: se verifican DESPUÉS de WhatsApp y MaKo inteligente, para el tren siguiente.
  - **El workflow de pedidos perdidos llegó al 100% con 12 de sus 21 agentes cortados** («session limit»). Se reanudó a
    las 21:32 en esta sesión (task `wz8f0619h`, mismo runId `wf_fbaed0b3-099`): los 9 que terminaron vienen de la caché.
    Su resultado parcial (lo juntado por fuente y lo que no se pudo leer) está en
    `C:\Users\marti\AppData\Local\Temp\claude\C--Users-marti-OneDrive-Escritorio-dashboard-marketing-main\6ea62e88-206b-49e4-b5fe-e446feb70ded\tasks\wu4kb7spy.output`
    y en su journal.
  - **Los VERDEs en camino**, todos esperando turno de tests:
    - MaKo inteligente `b2c19c445`: 65 tests, roturas y tipos ok;
    - Planes `1e6bd27e8`: tipos ok;
    - Automations, la difusión: tipos ok;
    - WhatsApp;
    - Copywriter, con su relevo en `fe73b1ac7`;
    - el editor, con el ticket 23.
  - Zernio puso su relevo en `8b3af7652` (`zernio-2510`). Replicar espera su turno para medir el blanco.

## Lo que NO se vuelve a discutir

- **Nunca `--no-verify`.** El 24/10 el hook de pre-push frenó un tren con 5 errores de tipos.
- **Un chequeo que decide si se sube NO se pipea:** `cmd > salida 2>&1; rc=$?; tail -6 salida; [ "$rc" -eq 0 ] && git push`.
- **Vercel SÍ guarda el commit, pero lo encuentra sólo con el sha ENTERO** (`git rev-parse <corto>`); con el corto contesta
  «No deployments found» sobre un despliegue vivo. El relevo anterior decía lo contrario y estaba mal (medido el 24/10 a
  las 21:00; `docs/hallazgos-infra.md`). La prueba de producción es el despliegue que SIRVE el dominio
  (`vercel inspect hola-mako.com`).
- **El tren se arma ANTES de pushear,** y dos pushes a `main` en paralelo se traban en el candado del typecheck: de a uno.
- **Una rama entregada al tren NO se rebasa.** Para poner commits a salvo, una etiqueta `refs/tags/respaldo/<nombre>`,
  no una rama (las ramas en origin disparan builds de preview).
- **Nunca `AskUserQuestion`:** traba el turno y Martín no puede contestar desde el teléfono. Se pregunta con
  `cartero preguntar <archivo.json>` y se termina el turno.
- **El `tsc` entero no entra en la PC:** cae al respaldo de 3 tandas (`scripts/tipos-respaldo-push.mjs`, ~6 min).
- **Un pedido viejo de diseño no se hace por antigüedad:** se busca en `docs/hallazgos-<área>.md` y se compara con lo
  que Martín pidió después.
- **Un lector que mira un worktree a mitad del checkout ve el índice VACÍO** (18.900 «borrados»): se vuelve a medir antes
  de alarmar a nadie.

## Trabado esperando a Martín

0. **Del 28/10:** quién paga la cuenta de Zernio de la plataforma; las migraciones 0342 (Calendar), 0346 (sin conexión) y la de la papelera del CRM; las decisiones de la revisión de Teo.
1. **Su sí EN ESTE CHAT para:** leer la Ticketera de producción (el clasificador la niega); activar los avisos al grupo
   (lead de formulario y agenda) en ws15, ws18, ws20 y ws22 de Joan; subir los 21 audios de Makito a un bucket.
2. **Decisiones de plata:** cuánto se le cobra a Joan (2 de 5 clientes pagan), el precio del Acelerador (en la llamada
   con Aaron habló de 2.000 en 4 cuotas con un año de Pro; lo vigente es 1.500 en 3) y un segundo nivel de Partners.
3. **Compras suyas:** el certificado de Windows (SSL.com IV con eSigner) y el Apple Developer ID; sin eso Chrome sigue
   marcando el instalador como malware.
4. **Las landings:** no se publica ninguna hasta que diga los cambios.
5. **Las lecturas de producción** de la versión de la extensión de Leandro (chat CRM) y las de MaKo inteligente, MaKo en
   WhatsApp y Grabadores.
6. **La RAM a 32 GB** (memoria `pc-de-martin-hardware`), o minutos de Actions.

## Fechas

**El lanzamiento es el domingo 25/10.** La campaña de Mauricio va del 24/10 al 13/11 (50 leads por día). Su Sprint es el
24, 25 y 26 de noviembre.
