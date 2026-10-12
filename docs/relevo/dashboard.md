# Relevo — chat «Graphics» (la tab Dashboard)

<sub>Escrito el 12/10/2026 ~02:30 (hora de Argentina) por la cuenta 3, desde el chat que hizo el trabajo. Se pisa en cada relevo.</sub>

## Dónde está

**La v5 está a medio implementar en el worktree `wt-v5`, sin pushear.** Es el feedback de 24 puntos del 11/10 a la
noche (textual en `app/admin/dev/dashboard/bitacora.ts`, último hito `prompt`): sin «Bloques de MaKo» (todo editable),
un solo botón «Filtro» y búsqueda tipo Ctrl+F, pop-ups configurables, «Conclusiones de MaKo» como elemento de IA,
sección/desplegable, conectores, gráficos gordos, mapa de cualquier país, hojas VSL/CS/Chat Analyst, la Landing
lenta y el mapa de calor en vivo.

- El contrato de la tanda (decisiones, modelo con nombres exactos, dueños por ola, interfaces):
  [dashboard-v5.md](dashboard-v5.md). Las cuatro decisiones que contestó Martín el 12/10 están ahí.
- Commits locales de `wt-v5` (detached sobre `d290cb4e`): `b93efc9c` (el pedido + el contrato), `bae3a460` (ola 1:
  modelo, datos y dibujo; todavía NO compila — Elemento.tsx, Galeria.tsx y tests/graficos-elementos los corrige la
  ola 2).
- Ola 2 (topbar/filtros, edición, IA y entidades, mapa de calor) commiteada: `5fe0c356` (typecheck 0).
- Ola 3 (plantillas sin bloques, VSL/CS/Chat Analyst, roles, API de MaKo y link) A MEDIAS: `e86a0006` (WIP, cortada por
  el límite de sesión; puede no compilar). La continúa la segunda corrida del script del scratchpad `ola3-v5.js`.
- Uso semanal de la cuenta 3 al 80% el 12/10 ~06:45: si pasa el 85%, se cierra (relevo, nada a medias se pushea).
- Lo de Topbar de Looker + Compartir ya está en producción (`12160c59`, deploy Ready el 11/10 18:49).

**Si el chat se corta:** `cd wt-v5`, `git log --oneline -3`, leer `docs/relevo/dashboard-v5.md`, y los reportes de
cada ola en el scratchpad de la sesión (`ola1-*.md`; los de la ola 2 en el journal del workflow). Nada de la v5 está en
`origin`. Migraciones ESCRITAS y no aplicadas: 0260 (`dashboard_ia_elementos`, ola 2), 0261 (`retencion_vsl_resumen`) y
0262 (ubicación de las visitas); se aplican ANTES del deploy. 0258 y 0259 son de Landing Generator (wt-gamma).

## Lo que falta (además de la v5)

1. **El aviso «El AI Analyst terminó»** para Automations: Chatbot lo define con hoja, resumen, hallazgos y link
   SEPARADOS en `datos`; quedó avisado de que la v5 cambia las operaciones del área Dashboard (sin bloques) y me pide
   el estado antes de cablear selectores en ⚡ Acción.
2. **Textos sueltos de Landing Analyst** (Landing Generator no los tocó): la nota de `lib/model-catalogo.ts`, el
   encabezado del prompt de `lib/landing-writer.ts` y `docs/diseno-editor-landing.md`.
3. **Sin usar y sin borrar** (lo decide Martín): `PulsoPaginas.tsx` + su ruta y su lib; `ScriptsBrowser` y
   `GuionesFull` (~900 líneas muertas en app/ads-analyst/ScriptsBrowser.tsx).
4. **Defaults de Mauricio en Ads Writer** (no son del Dashboard): `DEFAULT_ANGLES` visionario/capataz
   (lib/script-angles.ts), TAG_VOCAB y los umbrales de lib/ads-analyst-patrones.ts se aplican a todos los negocios.
