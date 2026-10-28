# Relevo — Cerebro

<sub>Esta sección se PISA en cada relevo y no pasa de ~90 líneas. Lo viejo, tal cual se escribió, está en
`cerebro-historia.md` (arriba de todo, el relevo del 24/10 de claude1 para la cuenta 5, ya cumplido).</sub>

## ⏩ LEER PRIMERO — 27/10/2026 ~18:00, cuenta 5 «Ananda» (claude5)

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

## Estado al escribir (27/10 ~18:00)

- **`main` = `bbb459f33` (tren-n), desplegado el 26/10 15:27.** Trae el login de Google con la agenda (Google aprobó la
  app; `GOOGLE_LOGIN_CON_AGENDA=1` en Production, verificado), los tickets de Leandro sin aprobación, Customers, el
  Scraper que vuelve a la pestaña de origen. `tren-o` (este commit) = sólo cosecha.
- **27/10, después del reset semanal:** Martín pidió revisar sus 3 últimas llamadas (Leandro 874749710, Leila 876470842,
  Aaron 876825880), el grupo Makito, la Ticketera, los grupos de MaKo en WhatsApp y sus chats con Leila y Mauricio. La
  lectura (workflow `wf_1f30be35-c5e`, reparto en el scratchpad de la sesión `0ee425c6`) se repartió por mensaje a
  mako-wa-conexiones, crm, automations, media-buyer, zernio-capi, agencias-clientes, mako-inteligente, ops-center,
  landings y settings. **No salieron por el tope de 10 mensajes:** grabadores (Closing de Leila con 193 sin analizar;
  dueños mal puestos por Fathom) y motion-imagen (Submagic + VidIQ, compromiso al 09/11). Lo de Leila y Mauricio
  (workflow `wf_b6c3975a-bec`) estaba corriendo.
- **Chats propuestos como tarjeta** (el turno era de un evento): «Planes, pagos y Partners», «Classroom y Calendario:
  iniciales y soporte», «Infra: Evolution con todos los números y buckets».
- **Video e Image Editor con el chat de MaKo al costado** (proyectos en la barra, sin cambiar de ruta, colores de MaKo, y
  TODO editable por prompt): en motion-imagen, rama `motion-imagen-2610` con main mergeado. Landings hace el mismo
  inventario «todo editable por prompt» en Web Generator, y le prometió a Leila «Replicar y adaptar» para el 27/10.
- **21 audios de Makito** (12 al 23/10) a salvo fuera del repo en `feedback/makito-audios-2026-10/` de la carpeta de la
  sesión; los demás (28/09 al 10/10) ya no están en el CDN.
- **El aviso Meta → Zernio** de las 10:00 corrió a las 16:38 (la app estaba cerrada); su resultado va al Centro.
- **Ojo con el tope de mensajes:** la app frena a 10 mensajes del Cerebro a otros chats sin un mensaje de Martín EN ESTE chat.

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
