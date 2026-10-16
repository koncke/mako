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
2. **Un Runner en cada CARPETA donde haya chats abiertos** (16/10: `SendMessage` no cruza carpetas de config, medido).
   Sus instrucciones viven en `lib/runner.ts` (`INSTRUCCIONES_RUNNER`) y se copian desde el Centro: Runners → **Nuevo
   Runner** → «Copiar». El de la app (`~/.claude`) le llega a la app y a la terminal de la cuenta 1; las cuentas 2 y 3
   en terminal necesitan el suyo (los pasos, abajo).
3. **Renombrar el chat que hoy se llama «Cartero».** La línea para pegarle (la PC ya lo reconoce por los dos nombres,
   `esElCartero` en cartero.mjs 1.3.0, instalado el 15/10):

```text
Renombra este chat a "Runner" con set_session_title. Desde ahora eres el Runner del Centro de Operaciones: el trabajo es el mismo (cada 2 minutos, ciclo y entregar), y si te pego un token que empieza con mkop_, corre `node ~/.claude/operaciones/cartero.mjs token <el token>` y confírmalo en una línea.
```

**Para que las tres cuenten a la vez (16/10, cartero 1.4.0 instalado y con las tres terminales declaradas)**: las tres
están logueadas; falta abrir un Runner por cuenta de terminal. Lo que hace Martín, una ventana de PowerShell por cuenta:

1. Abre PowerShell y pega el comando de la cuenta (Centro → Uso → Nuevo Runner, uno por cuenta con su botón de copiar):
   `claude2 -n Runner --settings $HOME\.claude\operaciones\runner-settings.json` (y lo mismo con `claude3`; `claude1`
   cuando deje de usar la app). El `--settings` le pone la barra de estado que mide el Uso de esa cuenta (16/10/2026).
2. Pégale las instrucciones (Centro → Runners → Nuevo Runner → Copiar).
3. La primera vez que pida permiso para `node ~/.claude/operaciones/cartero.mjs …`, elige la opción que no vuelve a
   preguntar: si no, la vuelta de cada 2 minutos se frena esperándolo.
4. Deja la ventana abierta (puede ir minimizada): cerrarla apaga el Runner de esa cuenta, y el Centro lo dice («Abre el
   Runner en la terminal de la cuenta 2 para que salga»).

Para que un chat de terminal se llame como su tab y se una con los de las otras cuentas: `claude2 -n "CRM"`. Por qué
una carpeta y no una cuenta: hallazgos-operaciones.md → «SendMessage no cruza carpetas».

## El contrato con «Centro de Operaciones › Review» (16/10/2026)

Martín pidió (punto 6) que el avance se llame «Plan» y tenga dos sub-tabs: «Plan» (lo de hoy) y «Review» (lo que el chat
implementó y hay que revisar, con «Revisar»), y que «Revisar» abra la página para clickear sus elementos y dejar
devolución en un chat de MaKo al costado, con cada elemento mencionado en azul. Se parte en dos sesiones que no tocan los
mismos archivos:

| | Este chat (Centro de Operaciones) | El sub-chat «Centro de Operaciones › Review» |
|---|---|---|
| Archivos | `Avance.tsx` (las sub-tabs), `lib/centro-chats.ts` (`enlaceRevisar`), `cartero.mjs` y `lib/operaciones-reglas.ts` (el campo `revisar`) | `app/admin/operaciones/revisar/**` (página, visor, su CSS) |
| Hace | la lista de «Review» y el link «Revisar» | el visor: la página clickeable y el chat con las menciones |

**De dónde sale lo que se revisa.** Un nodo del avance va a «Review» cuando está terminado y trae una página: el chat que lo
hizo la deja en su cierre (`cartero.mjs cierre <id> … --revisar "/crm?lead=12"`) o en el hito de su bitácora
(`revisar: '/crm?lead=12'`). Siempre una ruta INTERNA de MaKo (`esHrefInterno`, app/admin/runway/decisiones.ts).

**Lo que recibe el visor** (el link «Revisar»): `/admin/operaciones/revisar?pagina=<ruta interna, con su ?ws=, codificada>
&chat=<clave del chat: nombre:…>&sesion=<local_… o cli_… de la sesión que lo hizo>&nodo=<id del nodo: p:<pedido> o
t:<trabajo>>`. El visor vive debajo de /admin/operaciones, así que hereda la guarda del Centro (`getSesionAdmin` +
`puedeOperar`, primeras líneas de la página). ⚠️ `pagina` se valida con `esHrefInterno` antes de dibujarla: nunca
una URL de afuera adentro del visor.

**Dónde vuelve la devolución.** Al chat que lo hizo (`sesion`), como un TRABAJO FIRMADO, por el único camino que hay para
escribirle a un chat: `useFirma(sub).mandar({ sesion, cuenta, titulo }, texto, 'solo_esto')` de
app/admin/operaciones/mandar.ts (AGENTS.md: «Escribirle a un chat se hace desde SU conversación, y por UN camino»). El texto
arranca con «Revisión de <pagina> (<nodo>):» y cada mención va como «[en «<texto visible del elemento>» · <selector>]».
Después de mandar, el visor vuelve a `/admin/operaciones?chat=<chat>`. El visor no inventa otra puerta a la PC ni otra
tabla: si necesita algo de este lado, lo pide acá.

## No verificado

- La pantalla real en producción: las capturas son del arnés con datos ficticios (el guard no deja entrar a otra
  sesión). Martín lo abre él.
- El teclado del iPhone sobre la hoja de la conversación.
- El typecheck COMPLETO: corrió el acotado a los archivos tocados (0 errores). El completo lo corre Actions.
