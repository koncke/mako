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

## Estado al escribir (28/10 ~01:00)

- **`main` = `fd0d6fcbd` (tren-p), Ready 00:58.** Trae el chat en el acto del Ops Center (audio, mensajes y capturas al
  instante, los 3 puntos, el encargo del Cerebro plegado, el COMPLETADO que dice lo hecho y no sale con trabajo de fondo
  vivo), la extensión con la tienda al día y las cosechas. **Cartero 1.21.0 instalado en la PC** (después del servidor).
  tren-o (`df08aa5f9`, Ready 27/10 22:18) trajo MaKo Desktop 0.4.3 y 14 puntas más.
- **`tren-q` en chequeo en `C:/dev/wt-push-q`:** MaKo en WhatsApp `4d1d0a010` (que trae adentro la rama c4 de MaKo
  inteligente `aec4ed0d9`: los «no puedo» falsos de Leila, el ticket automático ante cada «no pude», MaKo no
  descalifica) y los pagos del CRM `12fe516b8` (el plan quincenal de Leila, ticket #13). Revisadas y verificadas.
  Quedan medios no-regresión para tren-r (C:/dev/revisiones/2810-verificacion-mi-wa.md).
- **Revisiones:** cada informe está en `C:/dev/revisiones/` (fuera del repo). Las puntas pasan por revisión adversarial
  + refutador antes del tren si tocan plata, privacidad, sesión o infra compartida; los arreglos se VERIFICAN.
- **Chats vivos (claude4, bypass):** CRM y Chats (la Ticketera con adjuntos `046d9e028` espera dos medios; después las
  22 cajas de chat unificadas), MaKo en WhatsApp y MaKo inteligente (lo de tren-r), «Web Generator: replicar landings»
  (toda la noche: replicar por partes con las 5 landings de Martín, en el ws9 sólo borradores «[PRUEBA réplica]»), Runner
  `local_84a12d47`. **Nube** (koncke/mako, entregan por etiqueta `nube/<área>-2710-<k>`, ninguna entregó todavía):
  Zernio, Planes, Automations (+ ticket #17 de Leandro), Landings, Motion (+ silencios y ruido de Leila).
- **Reglas nuevas del 27-28/10** (AGENTS.md): todo «no pude» abre ticket solo; en todo chat lo que se manda se ve en el
  acto; el COMPLETADO dice lo terminado, nunca «en marcha»; **lo que MaKo construye se ve construyéndose, con un pequeño
  delay** (Martín, 28/10).
- **Hecho con el sí de Martín:** MK-02 (942/942 mensajes y 21 audios de Makito en el ws 9). MK-06 no probó nada: el ws3
  no tiene Google (OAuth de Martín); el mensaje a Joan NO se mandó.

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
