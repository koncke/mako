# Retomar: MaKo en WhatsApp (el doer de los grupos y su vigía)

**Chat jefe:** «MaKo en WhatsApp», cuenta 4 (claude4), abierto por el Cerebro el 17/10/2026 a la madrugada.
**Rama:** `mako-wa` (worktree `C:/dev/wt-mako-wa`, desde `origin/main` `0bf0c181`). Las puntas las sube el Cerebro.

**Qué es esto**, para quien nunca lo vio: MaKo contesta en el grupo de WhatsApp de cada cliente («MaKo <> {Cliente}»).
El que contesta es el **doer** (`lib/mako-doer-in.ts`): clasifica el mensaje (`lib/mako-intencion.ts`), arma las
herramientas del turno (`lib/doer-herramientas.ts`), corre un modelo barato con ellas y manda la respuesta. Cada turno
queda en `mako_doer_conv` (mig 0086; sin autor: todo lo humano es `user`).

## 1. El pedido

Martín, 17/10 ~01:50 AR: «quiero activar un proceso donde SIEMPRE se esté leyendo todos los grupos de MaKo en WhatsApp
con clientes, porque MaKo muchas veces dice "no puedo" o tira errores… que se esté vigilando y que se debugeen los
errores en automático cuando surjan». El ejemplo: el Google Calendar de Pablo (ws18).

## 2. En qué quedó

- **El vigía** — `scripts/vigia-mako-grupos.mts` (sólo lectura) + `lib/vigia-mako-grupos.ts` (qué es un incidente).
  Lee `mako_doer_conv` de todos los workspaces y las marcas `cartel-ia` / `saneo-doer` de `anthropic_usage` desde la
  última vuelta (marca en `~/.claude/vigia-mako-grupos.json`) y devuelve: «no puede» (MaKo), promesa sin hacer (MaKo),
  queja o desmentida (la persona), grosería (MaKo), silencio (>10 min sin respuesta) y los carteles. Sin incidentes
  nuevos no imprime nada. **No escribe en la base ni manda nada** (lo fija `tests/vigia-mako-grupos.test.ts`).
  Corre con: `cd C:/dev/wt-mako-wa && npx tsx scripts/vigia-mako-grupos.mts` (toma el `.env.local` del clon).
- **El cron** — un `CronCreate` cada 15 minutos, SÓLO en la sesión de este chat (muere con ella). Si este chat se
  cierra, el que entra lo vuelve a crear con el mismo prompt (sección 5).
- **El primer incidente (ws18, Pablo) y los que encontró la primera pasada (ws13, ws9)** — arreglados, con
  `tests/mako-en-whatsapp-pablo.test.ts` (13 tests, 19 roturas) y `tests/vigia-mako-grupos.test.ts` (5 tests, 9
  roturas). La causa de cada uno, con números, en `docs/hallazgos-comunicacion.md` → «No puedo», «déjame ver» y «la
  cagada es real». En una línea: **no era Google, era el clasificador**; y una respuesta del doer es el FINAL del turno.
- **La regla nueva** está en AGENTS.md → «Y un canal de MaKo no promete».

## 3. Lo que quedó a medio hacer o sin verificar, y dónde vive

- **Nada se probó contra una agenda real.** El ws18 tiene Google conectado y es un cliente. La prueba es su próximo
  pedido: el vigía lo va a mostrar.
- **`lib/doer-herramientas.ts` no se tocó** (Onboarding está cortando ahí la red gratis del doer). Nada de este arreglo
  lo necesitó.
- **La persona de MaKo «putea suave»** (`lib/mako-persona.ts`) en todo lo que pasa por `buildSystemPrompt`. El doer lo
  corta; el chat de la app y del teléfono del cliente (`lib/mako-turno-app.ts`) no se revisó.
- **El vigía no lee los logs de Vercel**: lee lo que el doer deja en la base. Un fallo que no deja fila se ve como
  silencio (si la persona escribió) o no se ve.
- **Silencios del vigía en grupos en modo `ventana`**: ahí MaKo no contesta todo a propósito, y el vigía lo contaría
  como silencio. Medido el 17/10 a las 01:35: hay UNA sola fila `mako.doer.modo.*` en `app_settings` (ws1, `libre`), así
  que todos los grupos están en el default, `libre`. Si alguno pasa a `ventana`, hay que leer `mako.doer.modo.<jid>`
  (en el ws1, `OPS`) antes de contar.

## 4. Qué espera una decisión de Martín

- **«¿Me programás un mensaje por privado a un número?»** (ws13, 10/10). MaKo dijo que no puede y es verdad: no existe.
  Es capacidad nueva y choca con «los mensajes a terceros salen del número del usuario». No se mandó a la Ticketera:
  no bloquea nada.
- **El ws13 tiene UNA sola key de IA**: el 13/10 Gemini dio 503 y un timeout y salió el cartel (honesto). La cascada
  que falta es gasto de IA o la red de la plataforma, que Onboarding está recortando.

## 5. Cómo se retoma el vigía

1. `cd C:/dev/wt-mako-wa && npx tsx scripts/vigia-mako-grupos.mts` — la primera vuelta mira desde la marca guardada.
2. Volver a crear el cron (CronCreate, cada 15 minutos, `*/15 * * * *`) con este prompt: «Vuelta del vigía de MaKo en
   WhatsApp: corré `cd C:/dev/wt-mako-wa && npx tsx scripts/vigia-mako-grupos.mts`. Si no imprime nada, terminá sin
   escribir nada. Si trae incidentes: por cada uno buscá la causa real armando el turno con la frase literal
   (clasificarIntencion + herramientasDelTurno) y mirando el modelo de la fila; arreglá con su test probado rompiéndolo,
   cosechá en docs/hallazgos-comunicacion.md y pasale la punta al Cerebro con una línea para Martín. Nunca escribas en
   el grupo de un cliente ni le mandes nada a nadie: se lee producción y se prueba en el ws3.»
3. Un incidente ya contado no vuelve (la clave queda en el estado). Para releer un tramo: `--desde <ISO> --estado
   <otro archivo>`.

## 6. Las trampas que costaron tiempo acá

- **El Bash de esta máquina se come las barras invertidas** en un heredoc: un `\n` adentro de un template literal
  escrito por `python - <<'EOF'` llegó como un salto de línea real y el test no compilaba. Los parches con `\` van en
  un archivo `.py` escrito con Write, o con Edit.
- **`tests/turno-sin-duplicar.test.ts` lee textual la línea de `nuevoIntento`**: contar lo de un intento se hace con
  la diferencia antes y después de la llamada, no reseteando un contador adentro de `nuevoIntento`.
