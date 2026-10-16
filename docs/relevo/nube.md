# Relevo para una sesión en la nube (o una cuenta nueva) — escrito el 16/10/2026 a la noche

Lo escribió el chat «Cerebro» (el orquestador, cuenta `claude3`) al llegar al 98-100% del uso semanal, a pedido de
Martín: «asegurate de dejar contexto para que retome el siguiente chat en la nube». Una sesión en la nube clona este
repo y lee `CLAUDE.md` → `AGENTS.md` (las reglas de código y de push están ahí). Lo que NO ve la nube es la memoria
local de la PC de Martín ni sus chats: lo esencial de eso está acá abajo.

## Quién te habla y cómo

- Te habla **Martín Koncke**, el dueño de MaKo. Las tres cuentas de Claude (`claude1`, `claude2`, `claude3`) son
  suyas: no menciones «uso personal» ni de quién es cada cuenta. Mauricio es un CLIENTE (ws 1), no un socio.
- **Siempre en español**, de tú (la app usa «tú»: hay una guarda de voseo, tests/puente-panel-copy.test.ts).
- **Respuestas cortas**, en palabras de producto: qué cambió y dónde verlo. Cada push se reporta en bullets.
- **Decide por criterio; no preguntes en el chat.** Sólo lo que es 100% de Martín (precio, clientes, seguridad
  irreversible, gasto en IA) va a la **Ticketera** (/admin/runway → la Ticketera; también por la API de MaKo). Una
  decisión tomada se escribe en el doc del área con su porqué.
- **El crédito de Claude de la plataforma se usa SÓLO en el onboarding** (lib/veto-claude.ts, `CREDITO_HABILITADO_PARA`).
  Lo demás corre con la IA que conectó el cliente. El Plan nunca paga IA.
- **Probar en el Cliente de Prueba (ws 3), nunca en el ws 1** (es de Mauricio, un cliente real).

## Qué leer primero

1. **[docs/feedback-16-10-crm-onboarding-second-brain.md](../feedback-16-10-crm-onboarding-second-brain.md)**: lo
   último que pidió Martín (16/10 a la tarde), textual, con lo hecho y el archivo de cada pendiente. **Es lo primero.**
2. **[docs/relevo/cerebro.md](cerebro.md)** → «CIERRE» y lo que sigue: qué está en producción, migraciones y qué
   tiene cada área.
3. El relevo del área que vayas a tocar (docs/relevo/<área>.md: crm, onboarding, centro-operaciones, video-editor,
   pagos, …) y su docs/hallazgos-<área>.md.
4. La checklist que mira Martín: **/admin/runway/checklist** (app/admin/runway/checklist/datos.ts). Al terminar algo
   de «Lo que queda», agrega su ítem a «Lo que se hizo» con un id NUEVO y saca el pendiente; un id nunca se reusa.

## Por dónde seguir (en este orden)

1. **CRM, feedback del 16/10** (el documento de arriba). Ya hecho y en producción el 16/10 a la noche: renombrar,
   «A revisar», la cabecera, borrar la vista de pendientes, «Templates», el «Ver» de la ficha, el botón de MaKo a la
   izquierda con el muñeco del CRM, «Editar» en azul + «⋯» con «AI Analyst», la ficha más rápida, «Estilo de la hoja»,
   la galería que ya no se abre sola, «Asignar evento» y «Obligatorio» por bloque. Lo que FALTA, en este orden:
   - **Las tabs de la ficha como las hojas del Dashboard** (punto 5): el desplegable del título con las secciones y
     «Nueva hoja», templates con miniaturas propias por tab, la plantilla de toda la ficha como templates. Con eso se
     borra la barra lateral (app/crm/lead-view/ficha/PanelFicha.tsx: quedan la plantilla de toda la ficha y los
     interruptores de avisos, que ya tienen reemplazo en «Obligatorio») y se alinea el desplegable con el nombre (9).
   - **El chat del CRM con la cara del Second Brain** (punto 8): app/crm/mako-crm/ChatMakoCrm.tsx dibuja con las
     piezas de WhatsApp (ChatHilo, BurbujaHilo, ComposerWhatsApp); el Second Brain con app/_chat/HiloMako.tsx. El
     modelo de mensajes es el mismo (lib/mako-turno-app-reglas.ts).
   - **El «⋯» de la ficha**: Exportar (PDF/CSV, como el ⋮ del Dashboard en app/dashboard/EditorInforme.tsx) y la guía de
     edición; y que al EDITAR se abra solo el chat para editar la vista (punto 10).
   - El engranaje de «A revisar» ya abre una ficha con «¿Ignorar siempre?» (con un lead de verdad, el primero de la
     lista); sin leads cae al modal de interruptores (AvisosDatosModal.tsx), que se borra con un lead de ejemplo.
   - «Asignar evento» con Google Calendar (el motor sólo conoce Calendly y Cal.com).
   - MIRAR en pantalla todo lo de la noche del 16/10: nadie lo vio (la PC no tenía RAM para `next dev`).
2. **Onboarding**: sacar el análisis de Offer; sólo ordenar en un PDF lo que vende (app/onboarding/ChatArranque.tsx,
   lib/onboarding-arranque.ts). El corte de la IA gratis del doer de WhatsApp con datos de leads (docs/relevo/onboarding.md).
3. **Second Brain**: las pantallas que faltan (docs/relevo/centro-operaciones.md) y después «Skills» como skills.sh.
4. **Image Editor** tandas 2-3 (docs/relevo/video-editor.md; migración 0304 reservada). Video Editor tanda 5: POSPUESTA
   por Martín, no la empieces.

## Cómo se sube (resumen de AGENTS.md)

- Se pushea a la rama **`integracion`**; `.github/workflows/integracion.yml` corre tipos, guardas y tests y, si da
  verde, avanza `main` por fast-forward; Vercel despliega `main`. Nunca directo a `main`. Si el fast-forward choca,
  mergea `origin/main` en tu rama (sin rebase) y vuelve a pushear.
- Antes de pushear: `node scripts/tsc-bitacoras.mjs`, `node scripts/rutas-windows-en-tests.mjs`, los tests del área
  (`node --import tsx --test tests/<x>.test.ts`) y SIEMPRE tests/puente-panel-copy.test.ts y tests/progreso.test.ts.
- Un test nuevo se prueba ROMPIENDO el código, con los números en su comentario («base 3/0 → 2/1»).
- ⚠️ Las guardas que recorren el repo (la de voseo, la de `/onboarding`, …) leen `git ls-files`: un archivo NUEVO sin
  `git add` no lo ven y pasan en verde. Haz `git add` del archivo nuevo ANTES de correrlas (16/10: «acá» en un archivo
  nuevo pasó en local y lo habría frenado GitHub).
- Commit por ruta explícita (nunca `git add -A`). Al final del mensaje, pegadas y sin línea en blanco en el medio:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` y `Claude-Cuenta: <cuenta>` (claude1, claude2 o claude3,
  la que Martín usó para abrir la sesión; si no se sabe, `nube`).
- **Migraciones**: la próxima libre es la **0306** (0304 reservada para el Image Editor). La nube NO tiene
  `.env.local`: no puede aplicarlas ni leer la base. Escríbela, que el código la tolere ausente, y anótala en
  docs/relevo/cerebro.md como «sin aplicar»; la aplica una sesión local con `node scripts/apply-migration.mjs`.

## Lo que la nube no puede hacer (y quién lo hace)

- Aplicar migraciones, leer datos reales o mirar la app con la sesión de Martín: lo hace una sesión local.
- Mensajear a los otros chats: los chats locales («CRM», «Onboarding», …) son de la PC. El contexto de cada uno está
  en su relevo; la nube trabaja desde ahí.
