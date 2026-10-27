# Relevo — Cerebro

<sub>Esta sección se PISA en cada relevo y no pasa de ~90 líneas. Lo viejo, tal cual se escribió, está en
`cerebro-historia.md` (arriba de todo, el relevo del 24/10 de claude1 para la cuenta 5, ya cumplido).</sub>

## ⏩ LEER PRIMERO — 26/10/2026 ~12:20, cuenta 5 «Ananda» (claude5)

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

## Estado al escribir (26/10 ~12:20)

- **`main` = `781d069b3` (tren-m), subido a las 12:1x.** Trae: Zernio sin token (`CORTE_TOKEN_META = '2026-11-03'`), MaKo
  en WhatsApp siguiendo la conversación, el Completado del Centro (responder, tus mensajes con foto, el prompt tal cual, la
  fecha), los avances agrupados y la voz del Ops Center, Settings en el teléfono, Customers rediseñado y la barra del super
  admin, tl;dv/Fireflies/Zoom/Otter y el aviso de la IA caída, los arreglos del Media Buyer, Notificaciones sin los 9 avisos
  que no salían, MaKo recomienda (con el Claude de la plataforma de último recurso en lo interno del ws9), el Scraper nuevo
  con la extensión 0.72.3, y los arreglos de Web Generator de después de la prueba en producción.
- **Migraciones:** 0338 (grabador_reuniones) y 0339 (etiquetas hasta 100) APLICADAS el 26/10 con el sí de Martín en el chat.
- **Falta después del deploy:** `scripts/mudanza-avisos-plataforma.mts --aplicar --eventos=closing_ia_caida` (escribe la
  fila del aviso en el ws9: pide el sí de Martín EN EL CHAT); que Landings mire en producción la animación de MaKo y las
  franjas con nombre; que CRM pruebe «Extraer» de punta a punta con la pantalla nueva.
- **El push ya no entra con 4 GB de heap por tanda:** se sube con `MAKO_TIPOS_SOLO_TANDAS=1 MAKO_TIPOS_HEAP_MB=5120
  MAKO_TIPOS_RAM_MIN_GB=5.4` y ~5,5 GB libres (cerrando Chrome). Detalle en docs/hallazgos-infra.md.
- **Reclamo a Zernio:** mandado el 26/10 10:25 desde equipo@hola-mako.com (Resend 01a17862-…); la respuesta llega a equipo@.
- **Leila:** memoria `leila-apps-y-pro-97` (con su planilla: ahorro hoy ~US$94, en 2 semanas ~US$122, con GHL ~US$219;
  Partner: 1 Pro por mes = su MaKo gratis).
- **Motion y el Image Editor:** suspendidos, en la rama LOCAL `motion-imagen-2610` @ `7e7a49d96` (etiqueta
  `respaldo/motion-imagen-2610`), con su relevo adentro.
- **Prometido por Martín (26/10):** un VidIQ y un Submagic dentro de MaKo en máximo 2 semanas.
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

1. **Las landings:** no se publica ninguna hasta que diga los cambios (contestó «Ninguna todavía» el 26/10).
2. **El aviso closing_ia_caida:** su sí en el chat para crear la fila del ws9.
3. **Las lecturas de producción** que el clasificador frenó: las aprueba en los chats MaKo inteligente, MaKo en WhatsApp y
   Grabadores.
4. **Leila:** preguntarle qué es Diwep y cuánto paga de GoHighLevel antes de mandarle el mensaje.
5. **La RAM a 32 GB** (memoria `pc-de-martin-hardware`), o minutos de Actions: el chequeo de tipos ya no entra en 4 GB.
6. **La limpieza de P6** y **la pasarela** (Paddle y Creem).

## Fechas

**El lanzamiento es el domingo 25/10.** La campaña de Mauricio va del 24/10 al 13/11 (50 leads por día). Su Sprint es el
24, 25 y 26 de noviembre.
