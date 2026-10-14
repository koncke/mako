# Relevo — chat «Graphics» (la tab Dashboard)

<sub>Escrito el 13/10/2026 ~21:00 (hora de Argentina) por la cuenta 2, desde el chat que hizo el trabajo. Se pisa en cada relevo.</sub>

## Dónde está

En producción sigue la **v5** (desde el 12/10, `6e709bc3`). El contrato de esa tanda está en [dashboard-v5.md](dashboard-v5.md); lo
aprendido, en `docs/hallazgos-graficos.md`.

**El 13/10 (cuenta 2) se trabajó en worktrees propios, NADA PUSHEADO TODAVÍA** (el typecheck no termina: la RAM está en zona roja y el
vigía mata los `tsc`). Dos ramas:

- **`graphics-1310`** (`C:/dev/wt-graphics`), commits listos para pushear:
  - `a30282bf` — **«¿Qué vas a crear hoy?» en «Nueva hoja»** (la caja de Automations, la misma) y **«Copiar dashboard»** con un token
    `MAKO-DASH-…` (mig **0266** `dashboard_copias`, YA APLICADA en prod). Viaja la definición, sin personas; en otro negocio se vacían
    los filtros para mirar que eran de allá. También: Landing Analyst → «Diagnóstico» en tres textos sueltos.
  - `35dc37f6` — feedback de la reunión del 12/10: el **botón de MaKo no sale editando**, y **las plantillas se arman con los datos del
    negocio** (`/api/graficos/plantilla`: quita los vacíos y MaKo suma hasta 4 con datos). Lo mismo para lo que arma MaKo con un pedido y
    para la API (`crear_hoja_dashboard`).
  - `29a39259` — merge del **código muerto de los bloques, borrado** (lo hizo un agente en `graphics-bloques-1310` y se cortó por el
    límite de sesión; se verificó acá: tests del área en verde, ninguna ruta vieja nombrada). Lo vivo se mudó a `lib/datos-comercial*.ts`,
    `lib/llamadas-modelo.ts`, `app/dashboard/entidades/FichaLlamada.tsx` y `app/dashboard/piezas.tsx`.
  - `9966e7bc` — **«A quién cobrarle» en la tab General** (reunión con Mauricio del 12/10, 86:17: «en la tab general, la cobranza»), con
    «Marcar cobrada»: la misma lista que el teléfono. Sigue también en el Dashboard: Martín no dijo si se saca de allá (se le preguntó).

**Para pushear** (cuando el typecheck pueda terminar): en `C:/dev/wt-graphics`, `git pull --rebase origin main` (o merge), `npm test`, el
typecheck por el lock, y `git push origin HEAD:main`. Después, `vercel ls`.

## Lo que falta
- **El aviso «El AI Analyst terminó»**: el chat Chatbot ya lo puso en su catálogo (`dashboard-analisis-listo`, commit `2ea2cf81` en la rama
  `undecima`, sin push). Cuando entre a main, va UNA llamada en `analizarHoja` (lib/graficos-analisis-server.ts, después de
  `cerrarCorrida` con `ok`, sólo con `p.origen === 'cron'`): `emitirDelCatalogo('dashboard-analisis-listo', { ws: p.ws, datos:
  valoresDelAnalisis({ hoja: p.hoja.nombre, resumen: salida.resumen, hallazgos: salida.hallazgos, link: linkApp('/dashboard?hoja=<id>',
  p.ws) }), dedupKey: 'analisis:<id de la corrida>' })`.
- **Verlo en el navegador (ws3)**: «Nueva hoja» (la caja, el «+», una plantilla armándose con datos), «Copiar dashboard» y pegarlo, y que el
  botón de MaKo no salga editando. No se pudo: RAM en rojo.
- **Que Martín decida** si se borran `PulsoPaginas.tsx` + su ruta y su lib, y `ScriptsBrowser`/`GuionesFull` (~900 líneas sin usar).
- **Copiar un dashboard por la API de MaKo** (`copiar_dashboard`, `pegar_dashboard`).
- **El teléfono (`/m/dashboard`)** le sigue mostrando Marketing y Comercial fijos a quien no tiene informe.
- El resto, en `docs/hallazgos-graficos.md` → «Lo que quedó sin hacer».

Uso semanal: la cuenta 2 arrancó en 0% el 13/10; un agente de este chat chocó el límite de SESIÓN de la cuenta ~20:30 («resets 11pm»).
