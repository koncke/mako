# Relevo — chat «Graphics» (la tab Dashboard)

<sub>Escrito el 11/10/2026 ~18:45 (hora de Argentina) por la cuenta 3, desde el chat que hizo el trabajo. Se pisa en cada relevo.</sub>

## Dónde está

La **topbar como la de Looker y «Compartir»** (los nueve puntos de la tarde) sale en `12160c59` (+ la bitácora
y este relevo). Antes: la **v4** en `6e85d8d7` (Closing, Ads y Landing Analyst como tabs retiradas, el Dashboard
entero en la API de MaKo, Enlace/Video/Insertar), el **v3** en `623ff3cd`. Pedidos textuales en
`app/admin/dev/dashboard/bitacora.ts`; lo que costó, en `docs/hallazgos-graficos.md` (y la puerta del link en
`docs/hallazgos-seguridad.md`).

⚠️ Si `12160c59` no aparece en `origin/main`, el push quedó esperando: la sesión de Chatbot pidió (pedido de
Martín, ~18:30) no correr typecheck, tests ni builds mientras implementa su undécima tanda, y el pre-push corre
el typecheck. El commit está en el worktree `wt-topbar` (detached); se pushea con `git push origin HEAD:main`
desde ahí, después de `git fetch` + `git rebase origin/main`.

## Lo que quedó de la topbar (interpretaciones dichas en el cierre)

- **Punto 7, «la barra de búsqueda»:** la fila de filtros de la hoja vive siempre en la topbar; buscar es lo que
  trae cada filtro de lista adentro. «＋ Filtro» y «Quitar» sólo editando. Si Martín quería un buscador suelto,
  falta.
- **«Restablecer el informe»** salió de la pantalla y sigue en la API de MaKo (`restablecer_informe_dashboard`).
- **Compartir** reusa el modal de Conocimientos con una prop opcional `claseBoton` (azul de Looker en la topbar;
  en Conocimientos no cambia nada).

## Lo que falta

1. **El aviso «El AI Analyst terminó»** para Automations: Chatbot lo define con hoja, resumen, hallazgos y link
   SEPARADOS en `datos`; cuando mande el id, emitirlo desde `lib/graficos-analisis-server.ts` al guardar un
   análisis programado.
2. **Textos sueltos de Landing Analyst** (Landing Generator no los tocó): la nota de `lib/model-catalogo.ts`, el
   encabezado del prompt de `lib/landing-writer.ts` y `docs/diseno-editor-landing.md`.
3. **Pendientes del link** (detalle en hallazgos-graficos, «Lo que quedó sin hacer»): el tablero de Tareas que se
   elige por la sesión de quien abre el link; los bloques sin `soloLectura`; `useValoresCompartidos` a
   `valores.ts`; `controlParaHttp` y `controlParaLink` duplicados.
4. **Dos escritores del tablero**: el autoguardado del editor no manda versión (la API sí).
5. **Sin usar y sin borrar** (lo decide Martín): `PulsoPaginas.tsx` + su ruta y su lib; `ScriptsBrowser` y
   `GuionesFull`.

Hecho desde el relevo anterior: el informe de Mauricio (ws1) recibió las cohortes en «Todo» y la hoja Closing
sin pisar lo que él editó; los briefs a Chatbot y a Landing Generator se mandaron y contestaron (Landing
Generator arregló el link viejo de `DialogoAnalitica`).

## Cómo quedó verificado

Chrome contra `next start` de un worktree limpio, en el ws9 (el ws3 redirige a /onboarding), usuario `dev`:
topbar y desplegable de hojas, el ⋮, la barra de edición, Compartir azul (`rgb(47, 111, 237)`), crear un link,
abrirlo sin sesión (15 componentes, sin Editar ni Compartir), detalle 403, revocar 200 y el link revocado 404.
La prueba no guardó ningún informe (releído: sólo existe `graficos.tablero.2`, el de Mauricio); dejó la fila
de `shares` id 45 del ws9, revocada.

Typecheck 0; `npm test` 8068/4. Los 4 rojos: tres ajenos que ya estaban en main (confirm-encima-de-modales por
el z-index de `DesvioMovil`, mover-etapa-validacion, plan-filtro-cliente) y el de conocimientos-compartir, que
se actualizó en el mismo commit (12/0).
