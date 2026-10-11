# Relevo — chat «Graphics» (la tab Dashboard)

<sub>Escrito el 11/10/2026 ~16:45 (hora de Argentina) por la cuenta 3, desde el chat que hizo el trabajo. Se pisa en cada relevo.</sub>

## Dónde está

La **tanda v4** sale en `6e85d8d7` (+ la bitácora y esta cosecha): las seis decisiones de Martín de la tarde y
el Dashboard entero en la API de MaKo. Lo de antes: `623ff3cd` (v3), `e51f01a8` (red de plataforma del AI
Analyst y la guarda de «Marcar cobrada»). Pedidos textuales en `app/admin/dev/dashboard/bitacora.ts`; lo que
costó, en `docs/hallazgos-graficos.md` (más api-mako, ads, landing e infra). El contrato de la corrida de
agentes sigue en [dashboard-v4.md](dashboard-v4.md).

## ⚠️ LO QUE SIGUE: la topbar como la de Looker (nueve puntos, sin empezar)

Textual en la bitácora (último hito `prompt`), con dos capturas: las hojas pasan de pestañas a un DESPLEGABLE en
el título (con «Nueva hoja» siempre primera); se va el «⋯» con «Restablecer informe»; los botones de MaKo, sólo
el logo en fondo negro; AI Analyst, Exportar y el tutorial adentro de un «⋮»; emoji, título y subtítulo
editables con un clic sin entrar a Editar; sin el ícono del Dashboard (el título ES la topbar, con Editar y el
⋮); los filtros (fecha + búsqueda) siempre en la topbar, con un diseño mejor (el de fecha «está muy confuso»),
y agregar/quitar filtros SÓLO editando; la topbar igual a la de Looker (en lugar de Archivo · Vista · Página ·
Ayuda va el subtítulo; formas, flechas y texto ubicados como Looker); y un botón **Compartir** que funcione
exactamente como el de CONOCIMIENTOS del super admin (link de acceso a los gráficos e invitar por email).
Casi todo vive en `app/dashboard/EditorInforme.tsx` (cabecera y barra) y `app/dashboard/Cabecera.tsx`.

## Lo que falta de la v4

1. **El informe de Mauricio** (ws1, `graficos.tablero.2`): lo EDITÓ el 11/10 a las 17:00 UTC (estilo de la hoja
   Marketing en «contraste»). NO pisarlo entero: sumar sólo las cohortes en «Todo» y la lista de llamadas de la
   hoja Closing (diff con el script del scratchpad `diff-tablero2.mts`; si ese chat ya no está, se reescribe:
   leer la fila, comparar contra `PLANTILLAS_ANALYSTS` y agregar sólo componentes con id nuevo).
2. **Briefs a dos chats**: Chatbot (el evento «El AI Analyst terminó» `dashboard_analisis_listo`, el área
   Dashboard en el selector del paso ⚡ Acción, selectores por persona y hoja; texto en dashboard-v4.md) y Landing
   Generator (`DialogoAnalitica.tsx:146` sigue enlazando la ruta vieja, y su nav no tiene «Diagnóstico»; el
   detalle en `docs/hallazgos-landing.md`). Cuando Chatbot defina el aviso, emitirlo desde
   `lib/graficos-analisis-server.ts` al guardar un análisis programado.
3. **Dos escritores del tablero**: el autoguardado del editor no manda versión (la API sí). Ver hallazgos.
4. **Sin usar y sin borrar** (lo decide Martín): `PulsoPaginas.tsx` + su ruta y su lib; el componente
   `ScriptsBrowser` y `GuionesFull`.

## Cómo quedó verificado

Chrome contra `next start` de un worktree limpio (ws1, usuario `dev`): los cuatro redirects (`/closing`,
`?call=` → `&llamada=`, `/ads-analyst`, `/landing-analyst`), la hoja Closing con 71 llamadas y su ficha con la
grabación de Fathom, el menú Insertar con Enlace, Video e Insertar y un YouTube embebido, Ads Writer «Analizar
guion», Landing Generator «Diagnóstico», y un closer viendo sólo «Closing» (sin Editar; la API le contesta 403 a
otra hoja). La prueba escribió `graficos.tablero.dev` en el ws1 (se limpia con el script del scratchpad
`limpiar-prueba.mjs`, que borra sólo eso y los `dashboard_analisis` del usuario `dev`).

## Decisiones tomadas sin preguntar (dichas en el cierre)

- El elemento Insertar acepta cualquier https (como Looker), salvo nuestros dominios («usa Enlace»), puertos e IPs.
- `?tab=analizar` de Ads Writer no pasa por la puerta del onboarding de Copy Generator.
- Las tareas de Closing (sincronizar, re-analizar, revisar) quedan para admin y closer; un setter no.
- Crear, borrar y restablecer hojas por la API no corren dentro de una automatización.
- Por HTTP, el link de una grabación de Fathom no sale.
