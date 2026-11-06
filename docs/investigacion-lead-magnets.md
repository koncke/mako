# Lead Magnet Generator: de dónde se copia (nube, 6/11/2026)

> AGENTS.md, «NINGUNA pantalla se diseña de cero»: una sola fuente por área, su flujo y sus valores, y la fuente nombrada en
> el commit y en el relevo. Escrito por la sesión de la nube que hizo el trabajo (`cli_a7d6638b-0aff-5cb9-a16a-98377f9db136`).

## La fuente: SurveyJS Form Library (MIT)

**Qué se copia:** el flujo de un quiz con diagnóstico, con su diseño (`survey-core` 1.12.20, tema `defaultV2`, licencia MIT).

**Por qué SurveyJS y no otra:**

- **Se puede leer entero.** Las apps cerradas del rubro (Typeform, ScoreApp, Interact, involve.me) no se pudieron abrir: desde la
  nube, `curl` a sus dominios no conecta (medido el 6/11: código 000 en los cuatro, y también en surveyjs.io). Lo único que
  la nube alcanza es el registro de npm, y SurveyJS publica ahí su librería entera, con la hoja de estilos. No se diseña de
  memoria: los valores de abajo salen de `defaultV2.css`.
- **Hace exactamente esto.** Un quiz es una encuesta con puntaje: una pregunta por página, una barra de avance, un formulario
  de contacto y una página final que cambia según las respuestas (`completedHtmlOnCondition`). Es el flujo que piden Typeform
  y ScoreApp, y SurveyJS lo tiene como función documentada, no como truco.
- **La licencia deja copiar el código** (MIT): su texto literal va en `lib/avisos/LICENSE-SURVEYJS` cuando se use algo suyo.
  No se trae la librería: el quiz de una landing es un bloque nuestro, con el motor puro en `lib/` y su script en la página.

**Lo que NO se copia:** el editor de encuestas de SurveyJS (Survey Creator), que es otra licencia (comercial). El quiz se
arma desde el editor del Web Generator, que ya existe.

## Los valores, medidos en `defaultV2.css`

| Pieza | Valor |
|---|---|
| Ancho del cuerpo | 720 px (`90 × 8px`), centrado; 48 px arriba y 80 px abajo |
| Unidad de medida | 8 px (`--base-unit`) |
| Color principal | `#19b394` (en MaKo va el del tema de la landing) |
| Barra de avance | 2 px de alto, gris `#eaeaea` y la parte hecha en el color principal |
| Texto del avance | 12 px, peso 600, gris `rgba(0,0,0,.45)`, a la derecha, debajo de la barra |
| Tarjeta de la pregunta | radio 4 px, sombra `0 1px 2px rgba(0,0,0,.15)`, 40 px de aire a los costados (32 en el teléfono) |
| Opción | un círculo de 24 px con sombra interna; elegida, un punto blanco de 8 px sobre el color principal |
| Botones de navegación | 16 px arriba y abajo, 64 px a los costados (32 en el teléfono, y ocupan el ancho); texto de 16 px, peso 600 |
| Página final | centrada; título de 64 px en 700 |
| Transiciones | 150 ms |

## El flujo que se copia

1. **Portada**: el título del quiz, una línea de qué vas a saber y «Empezar».
2. **Una pregunta por página**, con la barra de avance arriba y «Anterior / Siguiente» abajo. Elegir una opción no avanza
   solo en la primera versión (SurveyJS lo tiene apagado por defecto: `goNextPageAutomatic: false`).
3. **El formulario de contacto** antes del resultado: nombre y correo. Lo que entra va al CRM por el mismo camino que cualquier
   formulario de una landing (el Pixel → `/api/track/optin`).
4. **El resultado**: uno por rango de puntaje, con su título, su texto y su botón. Gana el primero cuyo rango contiene el
   puntaje; si ninguno, el último.

## Lo que se descartó como fuente

- **Typeform, ScoreApp, Interact, involve.me**: no se pueden abrir desde la nube (arriba). Si Martín quiere que el quiz se
  parezca a una de ellas, se abre en su Chrome y se miden los valores; esto queda como una decisión para él en
  `docs/relevo/nube-lead-magnets.md`.
- **Copiar un Notion público** para la guía y el checklist: el Copywriter ya copia las medidas de Notion
  (`app/copywriter/notion.css`); la página pública del lead magnet usa las mismas.
