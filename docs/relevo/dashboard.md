# Relevo — chat «Graphics» (la tab Dashboard)

<sub>Escrito el 11/10/2026 ~11:30 por la cuenta 3, desde el chat que hizo el trabajo. Se pisa en cada relevo.</sub>

## Dónde está

La tab Dashboard es un editor de informes estilo Looker Studio (el EDITOR es de Looker, los GRÁFICOS
con el diseño de MaKo). **En producción: `623ff3cd` (el v3), Ready el 11/10 ~10:58.** Cubre los 24
puntos del feedback de Martín del 11/10 (textuales en `app/admin/dev/dashboard/bitacora.ts`): hojas al
lado del logo, estilo por página, filtros pegados y por gráfico, lo de Mauricio de vuelta (mapa,
cobranza, interactividad), insertar elementos, Nueva hoja con IA y plantillas, recorrido, Exportar
(CSV/PDF), las tabs de Analysts como plantillas y el AI Analyst con horario (mig 0247, aplicada).

El informe guardado de Mauricio (`graficos.tablero.2`, ws1) se reescribió DESPUÉS del deploy con
Marketing, Comercial, Ads Analyst, Landing, Closing y Productividad (ids fijos), releído con el lector
del producto. Respaldo del anterior: `tablero2-respaldo-v3.json` en el scratchpad de la sesión.

## Lo que hay que saber antes de tocarlo

`docs/hallazgos-graficos.md` (reescrito con el v3). Lo más caro: la barra de filtros sólo queda pegada
si el `<main>` tiene alto (`app/dashboard/page.tsx`); el control de un gráfico REEMPLAZA al de la hoja
en su campo; los campos compartidos son una lista positiva; lo que viaja a un modelo pasa por
`dimensionPublica`; todo pop-up desde una tarjeta va por portal y el portal no aísla.

## Lo que espera una decisión de Martín

- **La key de Gemini del ws1 (Mauricio) está bloqueada por Google** («Your project has been denied
  access», desde ~06:52 UTC del 11/10): toda la IA del ws1 que pase por Gemini cae a otros proveedores o
  falla. Hay que avisarle o cargar otra key. Detalle en `docs/hallazgos-ia.md`.
- `marcarPagoAction` no tiene guarda de rol (cualquiera con CRM marca cobrado): ¿sólo admin?
- Las cohortes de Comercial con «Últimos 30 días» miran sólo el último mes; la tab vieja mostraba todas.

## Lo que quedó sin hacer (y dónde)

- Verificar en el navegador, después del último build, el panel del AI Analyst como columna (antes
  tapaba la cuarta columna de tarjetas): el arreglo está con test, pero la máquina no dejó rearmar el
  build para mirarlo. Lo puede mirar Martín.
- El modelo de OpenRouter por defecto ya no es gratis (`lib/ai-cheap.ts`), y un 403 de Gemini merece su
  causa propia en `lib/fallo-ia-texto.ts`.
- Lecturas de Comercial sin paginar (`lib/pagos.ts`, `lib/queries.ts`); el GeoJSON del mapa desde
  GitHub; `sniffImagen` en tres copias; `respondioOut` en `chatCheapCascade`. Todo en
  `docs/hallazgos-graficos.md` → «Lo que quedó sin hacer».

## Decisiones tomadas sin preguntar

- Sólo **Productivity Analyst** salió de la sidebar: Ads, Landing y Closing tienen TAREAS.
- Lo que alguien elige en un filtro MIRANDO no se guarda (como Looker).
- «Marcar cobrada» pone la fecha de HOY en la zona del negocio.
- El AI Analyst no manda WhatsApp: marca en pantalla. Corre gratis (Gemini y la cascada), nunca Claude.
