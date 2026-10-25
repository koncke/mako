# Relevo — Cerebro

<sub>Esta sección se PISA en cada relevo y no pasa de ~90 líneas. Lo viejo, tal cual se escribió, está en
`cerebro-historia.md` (arriba de todo, el relevo del 24/10 de claude1 para la cuenta 5, ya cumplido).</sub>

## ⏩ LEER PRIMERO — 24/10/2026 ~21:30, cuenta 5 «Ananda» (claude5)

**Si sos una cuenta NUEVA**, Martín te escribe «Hola, eres la Nª cuenta, la voy a llamar X. Continúa con todo» y con eso
alcanza. No preguntes: hacé esto en orden (en la cuenta 5 tardó 10 minutos).

1. **La cuenta:** `claude<N>` en `~/.claude/cuenta-activa.txt`; su línea en `~/.claude/cuentas.tsv` (sin gmail declarado,
   el alias); `get_usage` → `uso-semanal.txt` y `uso-cinco.txt` con la cuenta en el 4º campo. El reset semanal es la
   prueba barata de que es otra cuenta.
2. **El Runner:** `node ~/.claude/operaciones/cartero.mjs cartero claude<N> app ~/.claude` y `… carpeta <uuid> claude<N>`
   (la carpeta NUEVA de `%APPDATA%/Claude/claude-code-sessions`); sumala también a `C:/dev/cerebro-herramientas/listar.cjs`.
   Después `start_session` «Runner», `claude-haiku-5-5`, esfuerzo bajo, `INSTRUCCIONES_RUNNER` (lib/runner.ts) + «hacé una
   vuelta ya». A los 3 minutos existe `~/.claude/operaciones/uso/claude<N>.json`: `detach_session` y al grupo «Cerebro».
   ⚠️ **Una cuenta recién comprada no tiene el modo bypass** (se prende en sus Settings y es de Martín). La sesión está en
   **auto** aunque `get_session` diga «default»: los chats se abren con `permission_mode: 'auto'` y andan.
3. **Este chat se llama «Cerebro» y se fija.** Los de área se abren EN EL TURNO de Martín, cada uno con su brief y su
   worktree propio (`C:/dev/wt-<área>-<fecha>`). Anidados bajo el Cerebro; sólo el Runner va suelto.
4. **El estado de la cuenta anterior se VERIFICA con git, no se copia.** Un Workflow con un lector Sonnet por chat sobre su
   cronología (`cola.cjs`) + git. El de la cuenta 5 (8 lectores, 18 minutos) encontró 4 puntas listas sin subir, 6 pedidos
   de Martín sin ejecutar, una cosecha equivocada (la de Vercel) y las capturas que sólo vivían en el transcript. Lo que
   corrige se les manda a los chats nuevos por mensaje.
5. **`/admin/dev`:** sumá la cuenta a `CUENTAS` (`app/admin/dev/_registro/tipos.ts`): sin la fila, un hito firmado por
   ella rompe la pantalla.

## Estado al escribir (24/10 ~21:30)

- **`main` = `59d228ea1`, en producción. El tren (`C:/dev/wt-push-q`, rama `tren-j`) tiene ~18 commits encima, SIN
  subir:** el feedback textual y el relevo de claude1, la guarda del aviso «ya quedó arreglado» del Ops Center
  (`b2aa04e1c`), el script que mide el goteo (`0af3213d9`), docs de CRM y Landings, la cuenta 5 en `/admin/dev`, las
  negritas del índice, el rojo de las sesiones de los hitos y P1. Sale con las primeras puntas de los chats: UN typecheck.
- **Chats de la cuenta 5:** Cerebro, Runner, CRM (puntos 12-21), Landings (3-10, después P6 y P5), Ops Center (22 y 23,
  el Uso con la cuenta 5, Settings, el 24, el ticket #8, la caja que le escribe al Cerebro cerrado, las opciones que no se
  tocan en el teléfono), Planes (1 y 2), Automations (medir el goteo, los 3 rojos de main, P11, «Analizar con MaKo» fuera y
  la criatura con la hoja abierta).
- **Las capturas de los 24 puntos:** `C:/dev/cerebro-herramientas/capturas-24-10/` (c01-c11 y el texto).
- **Hecho por el Cerebro:** P1 (el negocio de prueba de diseño, sin las 26 credenciales copiadas de Mauricio; las 38 de
  él, intactas), P2 (los 6 pedidos: los 2 del dictado cerrados, 2 repartidos, los tickets #5 y #6 en verificación), P9
  (la guarda del Ops Center, mergeada y medida contra producción) y P10.
- **Sin repartir todavía:** P3 (la app de escritorio con todas las tabs, Mac y Linux), P7 y P8 (registrados), el cobro
  (Paddle/Creem + Mercado Pago, cuando Martín aplique), avisarle a Código Inmobiliario lo de su `/gracias` (cuando Landings
  cierre P6) y M5 de Mauricio (el redirect del Payment Link y el píxel de su página de venta).

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

1. **La sesión de MaKo en el navegador de la app** (ya está abierto en la pantalla de entrada: «Continuar con Google»).
   Sin eso no se verifica nada en pantalla.
2. ~~El QR del WhatsApp de MaKo~~ **Era un dato viejo:** medido el 24/10 a las 21:50, la línea del negocio de Martín está conectada (termina en 3479).
3. **La pasarela:** aplicar a Paddle y a Creem el mismo día. Stripe no: Argentina no es país habilitado.
4. ~~Apagar el registro abierto de Supabase~~ **HECHO el 24/10 ~22:10** por el Cerebro en el Chrome de Martín (él confirmó el segundo factor de GitHub); `/auth/v1/settings` da `disable_signup: true`.

## Fechas

**El lanzamiento es el domingo 25/10.** La campaña de Mauricio va del 24/10 al 13/11 (50 leads por día). Su Sprint es el
24, 25 y 26 de noviembre.
