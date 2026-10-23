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
- **Ola 3 (ChatGPT en la computadora del cliente):** espera a IA16 (lunes 26/10), más de 2 GB de RAM libres y el OK
  de Martín para instalar Codex (`npm i -g @openai/codex`). Después Martín corre `codex login` con «Sign in with
  ChatGPT» (es su sesión: no la inicia un chat), se mide con `node scripts/ia-pc/medir-codex-mcp.mjs`, y con ✓ el
  corredor va en el programa de la PC, que es del chat del Instalador (cuenta 3). `CHATGPT_EN_LA_PC` se prende
  después de IA16.

## Para retomar

`C:/dev/wt-ia-gpt` (rama `ia-gpt-2310`) está al día con main y tiene `node_modules` como junction: antes de borrar el
worktree, sacalo con `cmd /c rmdir`.
