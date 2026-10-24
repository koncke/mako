# Relevo: IA del cliente («Tu ChatGPT» y la ola 3), 23/10/2026 noche

Chat «IA del cliente», cuenta 2. El diseño entero vive en [`../ia-del-cliente.md`](../ia-del-cliente.md); lo que costó,
en [`../hallazgos-ia.md`](../hallazgos-ia.md) → «"Tu ChatGPT" en el Ops Center» y su sección «Darle un modelo capaz NO
era cambiar el nombre».

## En producción

- **«Tu ChatGPT» con modelo a elegir** (main `72330d04f`, Ready 22:55 UTC del 23/10; commits `903f79543`, `325719ffa`,
  `39b51c688`, `f4e95f2a6`). El admin elige GPT-5.6 Luna, GPT-6 Luna o GPT-6.1 Sol en el «+» de la caja; un miembro
  corre el de por defecto, GPT-5.6 Luna. Salió **SIN MEDIR**, por decisión del Cerebro: la cuenta de OpenAI de MaKo no
  tiene crédito, y el 22/10 Martín decidió no cargarlo.
- A un modelo que razona se le mandan los campos de salida que acepta, y si OpenAI rechaza uno, el paso se repite una vez
  con el otro formato. Si falla SU OpenAI, la persona lee qué pasó y qué hacer, sin ticket de bug, salvo el 404, que
  puede ser un id nuestro.

## No verificado

- **No se miró en pantalla.** Se ve en un negocio con su clave de OpenAI (ws11 Leila o ws14 P2P Consulting), en el «+»
  → Modelo. El ws10 (Leandro Tejado) NO sirve: no tiene clave de OpenAI, así que «Tu ChatGPT» no aparece, y es lo
  correcto. El navegador integrado no tiene sesión en hola-mako.com, y el Cerebro decidió no pedirle a Martín que
  inicie sesión para esto. Sin mandar mensajes: un mensaje gasta la OpenAI del cliente.
- **Ningún pedido real a OpenAI con los tres modelos.** Cuando aparezca crédito (el de un negocio que conecte su GPT, o
  el de MaKo si Martín lo carga): `npx tsx --conditions=react-server scripts/medir-openai-herramientas.mts gpt-5.6-luna
  gpt-6-luna gpt-6.1-sol` desde el clon, y después la prueba de punta a punta del turno. Lo que salga va en un tren
  aparte. Si GPT-6 Luna acierta igual, pasa a ser el default (`MODELO_SU_OPENAI_DEFAULT`, lib/chat-ia-reglas.ts).

## Pendiente, con su archivo

- **Automático y WhatsApp siguen en `gpt-4o-mini`, a propósito hasta medir** (lib/anthropic.ts, la rama del registro;
  lib/mako-doer-in.ts).
- El plazo de `chatCheapTools` contra los 420 s de la ruta del chat; lib/costos-ia.ts contando la OpenAI de un negocio
  como costo de MaKo; el modelo de OpenAI guardado por negocio (hoy se pierde al recargar). El detalle, en
  `../hallazgos-ia.md`, «Lo que quedó SIN hacer».
- **Ola 3 (ChatGPT en la computadora del cliente), 23/10 noche:** Codex 0.164.0 está instalado en la PC de Martín (lo
  instaló el Cerebro con su OK). Falta su `codex login` con «Sign in with ChatGPT» (es su sesión: no la inicia un chat) y
  correr `node scripts/ia-pc/medir-codex-mcp.mjs`, ya corregido: antes iba a dar ✗ por la aprobación de las herramientas
  MCP, y ahora mide también las instrucciones y las «manos» de Codex (tres turnos de su cuenta). Lo que encontró la
  investigación, lo que falta y de quién es cada pieza: `../hallazgos-ia.md` → «La ola 3 por dentro». Lo legal de
  OpenAI espera una decisión de Martín.
- **Lo legal, decidido (Martín, 23/10 noche):** «Sí: ChatGPT en la computadora del cliente igual que Claude, sólo para que
  el dueño use su propio ChatGPT en su PC, nunca para atender leads solo». Es la regla D6a de Claude. El porqué y las
  fuentes de OpenAI: `../hallazgos-ia.md` → «ChatGPT en la PC: la misma regla que D6a». La guarda en código: la sesión se
  mira adentro de `turnoApp` (`laPersonaEstaAdentro`), una PC contesta sólo con la IA del texto que aceptó, y el turno vence
  con la espera del chat (tests/ia-pc-nunca-a-leads.test.ts). Lo que quedó sin hacer para la 0.5.0 (aislar Codex) está en
  esa misma sección: es bloqueante antes de prender la opción.
- **Ola 3, partes a y c (este chat, 23/10 noche):** el servidor elige la PC por IA (a), y el tutorial y lo que se acepta
  van por IA (c). La IA elegida viaja en la versión del consentimiento, sin columna. Las dos son invisibles con
  `CHATGPT_EN_LA_PC` apagada y van por el tren normal. El Cerebro le dio a este chat también el programa 0.5.0 (b), pero
  DESPUÉS de la medición: si «sin manos» no se puede, no sale. Prender la opción espera IA16, el programa y la decisión
  legal de Martín. Lo que quedó sin hacer, con su archivo: `../hallazgos-ia.md` → «La PC se elige POR IA» y «Qué IA
  eligió la persona viaja en la VERSIÓN del consentimiento».
- **IA16** (rama `ia16-2210`, worktree `C:/dev/wt-ia16`, punta `7ff4633e6`): retenida hasta el lunes 26/10, con «Costo de
  MaKo» arreglado, main mezclado y tests/ia15-frontera al día (fallaba 3 desde antes). Con la parte c en main, al mezclarla
  choca en dos lugares y se resuelve **quedándose con las dos**: el import de app/integraciones/TusCuentasIA.tsx (el de
  ia-pc-reglas, de la parte c; el de conectar-ia-reglas, con `dondeSacarLaClave` de IA16) y tests/conectar-ia.test.ts (los
  dos pines de `onComputadora` de la parte c, y los tres de Gemini de IA16).

## Para retomar

`C:/dev/wt-ia-gpt` (rama `ia-gpt-2310`) está al día con main y tiene `node_modules` como junction: antes de borrar el
worktree, sacalo con `cmd /c rmdir`.
