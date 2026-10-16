# Relevo — Centro de Operaciones (15/10/2026; cuenta 3)

Escrito por el chat «Centro de Operaciones» de la cuenta 3 (`local_428051c1…`). Lo que costó cada cosa está en
`docs/hallazgos-operaciones.md` (la última entrada es la de esta ventana); lo que pidió Martín, textual, en
`app/admin/dev/centro-operaciones/bitacora.ts`.

## Dónde quedó

- **El Centro es una app de chat, con cada chat como un empleado** (Grok Bot), en producción desde el 15/10. A la
  izquierda los chats, a la derecha la conversación con su **caja de escribir abajo**. En el teléfono, lo mismo.
- **El feedback de Martín del 15/10 son siete puntos** (textual en la bitácora). Van en este orden, uno por punta:
  1. **Hecho (punta 1): los textos (6) y el nombre (5).** Cada texto dice qué hacer y para qué («Crea tu Token para
     comenzar a chatear», frase suya); el cartero se llama **Runner** en pantalla (copiado de GitHub Actions) y su
     modal es la página de Runners de GitHub (lista + «Nuevo Runner» con tres pasos). Lo fija
     `tests/centro-textos.test.ts`; la regla quedó en AGENTS.md.
  2. **Hecho (punta 2): el avance por chat (1) y la cuenta como chip (3).** El botón «Avance 3/5» de la cabecera abre la
     barra derecha (copiada de Offer) con un rombo por cosa pedida, como los milestones de Linear (`Avance.tsx`); se
     fueron las vistas Avance y Pushes y los grupos por cuenta.
  3. **Hecho (punta 3): el chat jefe (2), un nombre para las tres cuentas con «⋯ Renombrar» (4) y los muñequitos
     elegibles (7).** La convención quedó en AGENTS.md: el jefe se llama como la tab y un sub-chat «CRM › Lead Detail».
     Renombrar le manda a cada sesión un trabajo firmado; el muñeco elegido se guarda por nombre.
- **Lo que se escribe en la caja se firma en el dispositivo y queda en la cola** (`mandar.ts` → `encolarPedidoAction`).
  Para que LLEGUE al chat falta lo de abajo, que no es código.

## Lo que falta para que un trabajo llegue

1. **El Token de cada dispositivo, pegado en el Runner.** Medido el 15/10 (`cartero.mjs estado`): la PC acepta UN
   Token (`9813c2b3…`); el de cada dispositivo que falte se pega igual. En el Centro: Runners → la fila «Este dispositivo» (o la caja de cualquier chat) dice «Pégale tu Token al
   Runner para comenzar a chatear» y ofrece «Copiar Token»; Martín lo pega en el chat Runner, que corre
   `cartero.mjs clave`. Uno por dispositivo (la compu y el teléfono).
2. **El chat Runner corriendo en la cuenta abierta** (hoy, la 3; el 15/10 «pasó hace 41 s»). Sus instrucciones viven en
   `lib/runner.ts` (`INSTRUCCIONES_RUNNER`) y se copian desde el Centro: Runners → **Nuevo Runner** → «Copiar». Cada
   cuenta que esté abierta en la app necesita su propio chat Runner con ese texto.
3. **Renombrar el chat que hoy se llama «Cartero».** La línea para pegarle (la PC ya lo reconoce por los dos nombres,
   `esElCartero` en cartero.mjs 1.3.0, instalado el 15/10):

```text
Renombra este chat a "Runner" con set_session_title. Desde ahora eres el Runner del Centro de Operaciones: el trabajo es el mismo (cada 2 minutos, ciclo y entregar), y si te pego un token que empieza con mkop_, corre `node ~/.claude/operaciones/cartero.mjs token <el token>` y confírmalo en una línea.
```

**Para que las tres cuenten a la vez**: `/login` de la 1 y la 2 en una terminal, su cartero como `cli`, y un Runner en
cada terminal. No está medido si `SendMessage` cruza de un directorio de configuración a otro
(hallazgos-operaciones.md → «Lo que quedó sin hacer»).

## No verificado

- La pantalla real en producción: las capturas son del arnés con datos ficticios (el guard no deja entrar a otra
  sesión). Martín lo abre él.
- El teclado del iPhone sobre la hoja de la conversación.
- El typecheck COMPLETO: corrió el acotado a los archivos tocados (0 errores). El completo lo corre Actions.
