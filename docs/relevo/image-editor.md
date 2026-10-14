# Relevo — Image Editor (el Canva de MaKo), 14/10/2026

Chat: «Canva en Content Machine» (cuenta claude2). Lo escribe el chat que hizo el trabajo.

## El pedido

> «Quiero que implementes end to end un "Canva" dentro de MaKo, tal cual, copialo todo, tanto en
> diseño como funcionalidades. Revisa si hay algún repo que nos ahorre trabajo. Dejalo en "Content
> Machine" en una tab que sea "Image"»

Y sobre la base, eligiendo entre tres: **«Copia a Doory, y luego lo modificamos completamente para que
sea original de MaKo, pero quiero la plantilla para ir trabajando».**

## Dónde quedó

- **Rama `editor-imagen`, worktree `C:/dev/wt-canva`.** Tanda 1 commiteada (`7c82507d`) + registro de
  `/admin/dev`, hallazgos y este relevo en el commit siguiente. Si no dice «en main» abajo, no se pusheó.
- **Lo que hay:** Doory (el único Canva open source completo, fabric.js 7) portado a
  `app/image-editor/_doory/`, con la cáscara de MaKo: `/image-editor` (inicio con los tamaños de Canva y
  recientes) y `/image-editor/<id>` (el editor). Sólo el super admin, por persona. Guarda en el navegador,
  una base por workspace. Textos en español neutro. La paleta de Canva ya está en los tokens.
- **El crédito de Doory se muestra en cada apertura**: su licencia lo exige aunque se modifique el código.
  Se va sólo con permiso escrito del autor (Siam, github.com/shaongitbd/doory) o reescribiendo sin su
  código. No abrir a clientes antes de resolver esto.
- **Verificado:** typecheck acotado limpio; 74 tests de los que barren el árbol + el test nuevo, probado
  rompiéndolo; el inicio dibujado en un dev server local (captura). **NO verificado:** el editor abierto —
  el dev server local pasa los 5 GB al compilarlo y el vigía de RAM lo mata. Se mira en producción.

## EN MAIN desde el 14/10 13:26 (`353c81a8`, tandas 1 y 2) — cuenta claude2 al 89% semanal

Lo pusheó el orquestador en su push integrado. Lo de abajo es la historia de cómo se llegó.

## Actualización 14/10 tarde

- **La tanda 1 NO está en main todavía**: cada push lo frenó la RAM (el vigía mata el typecheck del pre-push). Hay un reintento corriendo desde un worktree LIMPIO, `C:/dev/wt-canva-push` (detached en `aa8ea32b`), con `scratchpad/scripts/push-con-ram.sh`: espera 6 GB libres, integra origin/main y pushea; hasta 8 intentos. Si se cortó, se relanza con `sh <script> <log>` desde cualquier chat.
- **La tanda 2 (re-vestido de Canva + catálogo) está COMMITEADA** (`bef0ad47`, rama `editor-imagen`): typecheck acotado 0 errores, 59/59 tests. Sin ver en el navegador. Se le pidió al orquestador (Estrategia 3 cuentas) que la sume a su próximo push integrado; si no lo hizo, desde `C:/dev/wt-canva`: `git fetch && git merge origin/main` y push.

## Lo que sigue (por tandas, en `docs/diseno-editor-imagen.md` §4)

1. **Verificar el editor en producción** (crear, texto, imagen, descargar PNG/PDF).
2. **Re-vestido de Canva** (6 paquetes de archivos separados: barra superior, riel izquierdo y paneles,
   barra del objeto, lienzo y barra inferior, diálogos, inicio). La especificación medida está en
   `docs/editor-imagen/relevamiento-canva-armazon.md`; falta `relevamiento-canva-funciones.md` (el agente
   se cortó con la caída).
3. Supabase, catálogo propio, lo que a Doory le falta de Canva, API de MaKo.

## Decisiones que esperan a Martín

- ¿Le escribimos a Siam pidiendo licencia MIT para sacar el cartel?
- ¿Unsplash (key de MaKo) para las fotos? ¿Modelo para quitar fondo de objetos?
- Una pestaña de Canva quedó abierta en el grupo de los agentes (`canva.com/design/DAHX-ICTUd4`): si se
  creó en su cuenta, va a la papelera.

## Para retomar

`Leé docs/relevo/image-editor.md y docs/hallazgos-editor-imagen.md y seguimos con el re-vestido.`
