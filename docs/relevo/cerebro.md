# Relevo — Cerebro

<sub>Esta sección se PISA en cada relevo y no pasa de ~90 líneas. Lo viejo, tal cual se escribió, está en
`cerebro-historia.md` (arriba de todo, el relevo del 24/10 de claude1 para la cuenta 5, ya cumplido).</sub>

## ⏩ LEER PRIMERO — 25/10/2026 ~09:50, cuenta 5 «Ananda» (claude5)

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

## Estado al escribir (25/10 ~09:50)

- **`main` = `75b367235`, subido con tipos en verde.** Producción servía `44def1637` (desplegado a las 09:19); el despliegue de
  `75b367235` (la tanda 2 del Media Buyer) quedó en marcha. La noche del 24 al 25 subieron cuatro trenes: lo de la llamada con
  Leandro (CRM, Clients, Automations, Calendario), los botones de Instagram, el Media Buyer (`/ads-manager`, copiado de Madgicx,
  apagado), la landing nueva SIN publicar, el recolector del Second Brain, Ops Center (los que esperan arriba, sin «1 de 3»,
  `unirPreguntas`) y Planes (Acelerador con promesa y garantía, Partners meses + US$300, anual, garantía 14/30, pesos).
- **Chats de la cuenta 5, todos sin nada en cola salvo Ops Center:** Ops Center hace el «Completado» como bloque arriba de la
  caja (pedido de Martín del 25/10 09:32). Media Buyer espera a Martín (abajo). Landings tiene la tanda 2 de landings por
  funcionalidad y avatar (§6b de docs/como-venden-otros.md) sin empezar.
- **Instalado por el Cerebro:** el hook `sin-ask.mjs` (un AskUserQuestion se vuelve `cartero preguntar`; lo toman los chats que
  se abren desde ahora), el cartero 1.18.1, y la guardia de RAM más estricta (`memoria.mjs`, respaldo `.antes-25-10`).
- **Decisiones de venta del 25/10:** memoria `decisiones-venta-25-10`. Media Buyer reemplaza al Ads Manager: memoria
  `media-buyer-ia-reemplaza-ads-manager`.
- **Los informes:** docs/ram-de-la-pc.md (lo que más rinde: 32 GB) y docs/como-venden-otros.md (80 productos con landing).
- **Sin repartir:** P3 (la app de escritorio con todas las tabs, Mac y Linux), P7 (el cartero como servicio), el cobro
  (Paddle/Creem + Mercado Pago, cuando Martín aplique), la extensión que no inyecta mako-puente.js en una pestaña ya abierta
  (lo vio CRM), y si el portal del ALUMNO también saca el desplegable de «Tus programas» (pregunta para Martín).
- **Ojo con el tope de mensajes:** la app frena a 10 mensajes del Cerebro a otros chats sin un mensaje de Martín EN ESTE chat
  (los del Ops Center no cuentan como suyos). De noche se gasta rápido: guardar los últimos para lo que traba un tren.

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

1. ~~Las migraciones 0332 y 0333~~ **APLICADAS el 25/10 ~13:10** por el Cerebro, con el sí de Martín en este chat
   («Sí, aplicá en producción las migraciones 0332 (Media Buyer) y 0333»). Verificado por PostgREST: las 3 tablas existen.
   **0335 (pruebas A/B) y 0336 (alojadores de video): APLICADAS el 25/10 19:27**, con el sí de Martín. Verificado: las 5
   tablas `prueba*` con RLS sin políticas y anon bloqueado (42501), y el CHECK de `marketing_metrics_daily.plataforma` con
   wistia, bunny, vimeo y cloudflare. El SQL vino de aut-2510 @ cdfb8e14b (todavía como XXXX) y de landings-2510-b @ 2f393680d.
2. ~~Conectar la cuenta publicitaria de MaKo a Zernio~~ **HECHO el 25/10 12:46.** El primer link no creó nada: con varias
   páginas marcadas y sin `pageId`, Zernio no conecta. El segundo, con la página «Hola MaKo», sí (accountId de Zernio
   6ade25185b6c93612b7cc6a1). La vuelta cayó en /login y `next` perdió `abrir=meta`: se lo pasé a Zernio y a los links de
   cada modal.
3. **Publicar la landing nueva** (Landings se lo pregunta en su chat; `--subir` escribe en el ws9).
4. **La limpieza de P6:** la corre Martín (lo decidió el 25/10 09:01). El comando está en el cierre af96b761. Después, avisarle
   a la agencia de Código Inmobiliario lo de su página de gracias.
5. **La pasarela:** aplicar a Paddle y a Creem el mismo día. Stripe no: Argentina no es país habilitado.
6. **La RAM a 32 GB** (2 SODIMM DDR4-3200 de 16 GB, ~USD 290), sacar del inicio Copilot/NVIDIA/MEGA y reiniciar.

## Fechas

**El lanzamiento es el domingo 25/10.** La campaña de Mauricio va del 24/10 al 13/11 (50 leads por día). Su Sprint es el
24, 25 y 26 de noviembre.
