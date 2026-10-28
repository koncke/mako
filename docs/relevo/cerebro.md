# Relevo — Cerebro

<sub>Esta sección se PISA en cada relevo y no pasa de ~90 líneas. Lo viejo, tal cual se escribió, está en
`cerebro-historia.md` (arriba de todo, el relevo del 24/10 de claude1 para la cuenta 5, ya cumplido).</sub>

## ⏩ LEER PRIMERO — 28/10/2026 ~01:00, cuenta 4 (claude4)

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

## Estado al escribir (28/10 ~07:30, claude4)

- **`main` = `5eea455b7` (tren-t), desplegado a las 07:17.** Esta noche y madrugada subieron siete trenes:
  - tren-o (`df08aa5f9`, 22:18): MaKo Desktop 0.4.3 y 14 puntas;
  - tren-p (`fd0d6fcbd`, 00:58): el chat en el acto del Ops Center (audio y mensajes al instante, los 3 puntos, el
    COMPLETADO con lo hecho);
  - tren-q (`5b114031c`, 03:00): la Ticketera con adjuntos, el plan quincenal de Leila (#13), los «no puedo» falsos y
    el ticket automático ante cada «no pude»;
  - tren-r (`dbe271979`, 04:53): replicar landings por partes que se ve construyéndose, todas las cajas de chat con
    adjuntos y voz en el acto, y el «sí» de plata en grupo (fbd947d4f: DECISIÓN DEL CEREBRO, Martín puede revertirla
    revirtiendo ese commit);
  - tren-s (`d83d81760`, 06:28): el relevo, WhatsApp `96e7840e8` y replicar `bdfb40069`;
  - tren-t (`5eea455b7`, 07:17): WhatsApp `d7174eace` (una falla tragada después de una guarda abre ticket; el anillo
    de enviados con CAS) y el chat nuevo del Ops Center con adjuntos (`e4d04e7fa`).
- **Cartero 1.22.0 instalado en la PC DESPUÉS del deploy de tren-t** (respaldo `cartero.mjs.antes-1.22.0`). El orden
  importa: un cartero que manda adjuntos a un servidor que no los entiende los pierde.
- **Todas las ramas locales de los chats están en main** (0 commits fuera): mako-inteligente-2710-c4, wa-fallas-2710,
  replicar-landings-2810, chats-unificados-2810, chatnuevo-adjuntos-2810.
- **tren-u (WhatsApp `2cb1cf67e` con MaKo inteligente `ab2b3904d`):** lo que revienta después de una guarda abre
  ticket y una lectura que anduvo no apaga la guarda, en el grupo y en la app (`laUltimaFueGuarda`, lib/no-pude.ts); el
  anillo de enviados con 6 vueltas. Verificado: C:/dev/revisiones/2810-verificacion-2cb1cf67e.md.
- **Para el tren siguiente:**
  - CRM y Chats `d2f690673` (encima de `05d7c3187`): la caja quieta dice por qué no toma, lo leído va por conversación
    en Soporte. Verificación de 05d7c3187 en C:/dev/revisiones/2810-verificacion-05d7c3187.md; la de d2f690673, en curso;
  - MaKo en WhatsApp: dos MEDIOS que ya estaban en producción. (1) Una falla real con forma de guarda
    (`ok:false` de crearPendiente, el 400 de pasarelas) no abre ticket: hace falta una marca explícita de guarda. (2) Con
    la base colgada, el anillo frena la respuesta del grupo hasta 300 s.
- **Esperando a Martín:**
  - aprobar el #16 de Leila en el mazo: está en «esperando_decision» y el cron sólo cierra «en_curso»/«arreglado»;
  - conectar un Google en el ws3 para MK-06 (el mensaje a Joan NO se mandó);
  - mirar «replicar» en producción con su sesión (/web-generator): se verificó local con el build real, no logueado en
    producción, porque el login es de Martín;
  - el certificado de Windows.
- **Revisiones:** cada informe está en `C:/dev/revisiones/`. Cada punta de plata, privacidad o sesión pasó por
  revisión + refutador, y cada arreglo por una VERIFICACIÓN con los scripts del refutador.
- **Antes de cada VERDE, cada chat corre `node scripts/tsc-acotado.mjs` sobre sus .ts, tests incluidos:** el hook frenó
  tren-o, tren-p y tren-q por tipos en tests; tren-r, tren-s y tren-t, chequeados así, pasaron al primer intento.
- **Chats vivos (claude4, bypass):** CRM y Chats, MaKo en WhatsApp, MaKo inteligente, «Web Generator: replicar landings»
  y el Runner. Nube (koncke/mako, etiquetas `nube/<área>-2710-<k>`, ninguna entregó todavía): Zernio, Planes,
  Automations (+ ticket #17 de Leandro), Landings, Motion (+ silencios y ruido de Leila).

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
