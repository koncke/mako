# Relevo — chat «Graphics» (la tab Dashboard)

<sub>Escrito el 11/10/2026 ~05:20 por la cuenta 3, desde el chat que hizo el trabajo. Se pisa en cada relevo.</sub>

## Dónde está

La tab Dashboard es un editor de informes estilo Looker Studio (el EDITOR es de Looker, los GRÁFICOS
con el diseño de MaKo). En producción: `6967b29c` (Marketing y Comercial como hojas, réplica de las
tabs viejas). Lo que sigue es la versión 3, **a medio hacer y SIN commitear** (vive en el árbol de
este clon).

## El pedido en curso

El feedback de Martín del 11/10 de madrugada, 24 puntos, textual en
`app/admin/dev/dashboard/bitacora.ts` (los últimos cuatro hitos `prompt`): logo de la sidebar arriba,
las hojas al lado con «Nueva hoja», sin «Guardado», volver a poner lo de Mauricio (filtro de fecha,
gráficos interactivos, mapa de México, «A quién cobrarle» desplegable con «Marcar cobrada», el
cobrado total) y botones de acción, menú de hoja con clic derecho, estilo por PÁGINA con plantillas
(como Cursos), sin paneles fijos, controles (filtros) en una barra pegada arriba y también por
gráfico sin que se pisen, cabecera con emoji y subtítulo, una sola superficie, modo oscuro, insertar
texto/imagen/formas/flechas, «Nueva hoja» con «Pídeselo a MaKo» y plantillas, tutorial tipo
recorrido, **Exportar** (CSV y PDF), las tabs de **Analysts** como plantillas (y como hojas para
Mauricio), un botón **AI Analyst** con análisis programado, y sacar de la sidebar lo que quede cubierto.

## Lo que ya está escrito (base del v3, en el árbol, tests en verde)

- El modelo: `lib/graficos-catalogo.ts` (hojas con emoji/subtítulo/tema/controles, `efectivoDe` =
  la precedencia de filtros, CAMPOS compartidos, bloques, elementos, migración del v2),
  `lib/graficos-temas.ts` (6 plantillas de estilo), `lib/graficos-plantillas.ts` (informe inicial con
  ids FIJOS y el filtro de fecha arriba), filtrado en `lib/graficos-agregar.ts`/`lib/graficos-datos.ts`,
  acciones `bloques` y `valores` en `app/api/graficos/route.ts`.
- Tests: `tests/graficos-modelo.test.ts` y `tests/graficos.test.ts` (uno rojo A PROPÓSITO: el lector de
  la audiencia, que lo pone en verde el agente que la implementa).
- Los contratos de lo que falta: `CONTRATOS-v3.md` en el scratchpad de la sesión (copiado abajo en
  sustancia) y un archivo stub por pieza.

## Lo que está corriendo

Una corrida de 9 agentes (Workflow `wf_57bc1bc0-b52`, script en la carpeta de la sesión) con archivos
disjuntos: la pantalla (`app/dashboard/EditorInforme.tsx`), los controles (`BarraControles.tsx`), la
audiencia y el mapa (`lib/graficos-audiencia.ts`, `MapaMexico.tsx`), los bloques de Comercial
(`lib/graficos-bloques.ts`, `app/dashboard/bloques/`), la interactividad (`Grafico.tsx`, `Detalle.tsx`),
Nueva hoja con IA (`NuevaHoja.tsx`, `app/api/graficos/ia/`), los elementos (`Elemento.tsx`), el AI
Analyst (`PanelAnalista.tsx`, migración 0246, cron) y las plantillas de Analysts. Se cortó una vez
(la sesión se cerró) y se relanzó a las 05:15.

## Lo que falta después de la corrida

Integrar (enchufar lo que cada agente deja en `pendientes`), aplicar la migración 0246, verificar en
Chrome (ws1 con dev-login, limpiar SÓLO `graficos.tablero.dev`), revisión adversarial de filtros/datos,
`npm test` + `npm run build`, rearmar el informe guardado de Mauricio (`graficos.tablero.2`, ws1) con
Marketing + Comercial + las hojas de Analysts, commit por ruta, push, `vercel ls`, cosecha en
`docs/hallazgos-graficos.md`.

## Decisiones tomadas sin preguntar (decirlas en el cierre)

- Sólo **Productivity Analyst** sale de la sidebar: Ads, Landing y Closing tienen TAREAS (analizar un
  guion nuevo, analizar una URL, revisar una llamada) que Martín dijo que se va a llevar a otras tabs.
- Lo que alguien elige en un filtro MIRANDO no se guarda (como Looker); lo que se guarda es lo que el
  filtro muestra de entrada.
- «Marcar cobrada» pone la fecha de HOY, no el vencimiento.
- El AI Analyst no manda WhatsApp (un aviso nuevo de MaKo lo decide Martín): marca en pantalla.
