# Relevo — chat «Graphics» (la tab Dashboard)

<sub>Escrito el 11/10/2026 ~15:00 (hora de Argentina) por la cuenta 3, desde el chat que hizo el trabajo, al cruzar el 85% semanal. Se pisa en cada relevo.</sub>

## Dónde está

En producción: `623ff3cd` (el Dashboard v3: editor estilo Looker, AI Analyst, Exportar, plantillas de Analysts) y
la cosecha `de7124a3`. Lo de abajo es la **tanda v4, A MEDIAS y SIN COMMITEAR** (vive en el árbol de este clon).

## El pedido en curso (Martín, 11/10 a la tarde, textual en la conversación; falta pasarlo a la bitácora)

«Revisa que todo esto se pueda consumir en la API de MaKo, absolutamente todo. Y también mandale tarea al chat de
chatbot para que se pueda configurar en automations y consumir esto tambien», y después:
«1. Si, siempre tiene que probar con otros provedoores. 2. Cualquiera con acceso a esa tab. 3. Que muestre todas y
para eso tenemos filtros dentro de un elemento. 4. Lo de ads analyst migralo a la tab de "Ads Writer" y eliminalo.
5. Lo que Landing Analyst mandalo a Landing Generator y eliminalo. 6. Lo de Closing puede ir completo al dashboard.
Solo debes agregar el elemnto link, video o insertar embed.»
Dos respuestas suyas a preguntas: los closers ven **sólo la hoja Closing** del Dashboard; la API trabaja sobre el
informe **de la persona que se nombre** (sin nombrar y con un solo informe guardado, ése; con varios, pide elegir).

## Lo que ya está escrito y con tests (sin commitear)

- **IA con red de plataforma** (punto 1): `lib/graficos-ia-red.ts` (nuevo) + el AI Analyst
  (`lib/graficos-analisis-server.ts`, el cron ya no saltea al negocio sin IA) + «Pídeselo a MaKo»
  (`app/api/graficos/ia/route.ts`). La key de Gemini del ws1 está bloqueada por Google (docs/hallazgos-ia.md).
- **«Marcar cobrada»** (punto 2): `exigirAccesoAMarcarPago` en `app/crm/actions.ts` (sesión + tab CRM o Dashboard +
  la cuota tiene que ser de ese lead). Test en `tests/graficos-bloques.test.ts`.
- **Cohortes en «Todo»** (punto 3): `lib/graficos-plantillas.ts` (co-funnel, co-cohortes-mes, co-cohortes-semana).
- **`queTableroLeer()`** en `lib/graficos-lectura.ts`: sin sesión (API, flujos, crons) Tareas y Productividad eligen
  el tablero por la CAPA; antes leían el tablero vacío en el workspace del super admin.

## Lo que está corriendo (agentes en paralelo, archivos disjuntos)

El contrato completo (decisiones, dueño de cada archivo, interfaces) está en
[docs/relevo/dashboard-v4.md](dashboard-v4.md). Paquetes: **P1** elementos Enlace/Video/Insertar; **P2a** Closing en
el Dashboard (lista de llamadas, FichaLlamada, tareas, API de closing); **P2b** modo closer, `hojaDestino` (hoy
`?hoja=closing|ads-analyst|landing|productividad` cae en Marketing: bug vivo), retiro de las tres tabs y sus links;
**P3** Ads Analyst → Ads Writer (`?tab=analizar`); **P4** Landing Analyst → `/landing-generator/analizar`
(TERMINADO, 12/0); **P5** ~21 operaciones del Dashboard en la API de MaKo (`lib/api-mako/areas/dashboard.*`).
Si la sesión se corta: los agentes dejan su trabajo en el árbol; leer cada archivo de la tabla del contrato con
`git diff`, correr `npx tsx --test tests/graficos*.test.ts tests/dashboard-*.test.ts tests/api-mako*.test.ts` y el
typecheck, y seguir con la integración.

## Lo que falta después de los agentes

1. Integrar: typecheck + suite + build en un worktree limpio; resolver lo que cada paquete dejó «pendiente para otro».
2. Verificar en Chrome (`next start` + cookie firmada: docs/hallazgos-infra.md): modo closer, Closing completo, los
   tres elementos, Ads Writer «Analizar guion», /landing-generator/analizar, los redirects.
3. Commit por ruta (hay archivos con cambios AJENOS: lib/mako-doer-in.ts, app/admin/dev/areas.ts,
   lib/api-mako/areas/plan.*, next.config.ts, lib/avisos.ts, lib/notif-catalogo.ts: separar hunks) y push desde
   worktree limpio; regenerar `docs/api-mako.md` y el snapshot ahí.
4. **Después del deploy**, el informe de Mauricio (ws1, `graficos.tablero.2`): Mauricio lo EDITÓ el 11/10 a las
   17:00 UTC (cambió el estilo de la hoja Marketing a «contraste»). NO pisarlo entero: sumar sólo las cohortes en
   «Todo» y los componentes nuevos de la hoja Closing (diff con el script del scratchpad `diff-tablero2.mts`).
5. Mandar los dos briefs: al chat **Chatbot** (texto en docs/relevo/dashboard-v4.md: evento «El AI Analyst terminó»
   `dashboard_analisis_listo`, el área Dashboard en el selector del paso ⚡ Acción, selectores por persona/hoja) y al
   chat **Landing Generator** (los links de sus archivos en wt-gamma; lo devolvió P4).
6. Cosecha: docs/hallazgos-graficos.md (+ api-mako, chatbot, landing, ads), bitácora con el pedido literal, memoria.

## Decisiones tomadas sin preguntar (decirlas en el cierre)

- El elemento Insertar acepta cualquier https (como Looker); los conocidos pasan por `embedDe`.
- `?tab=analizar` de Ads Writer no pasa por la puerta del onboarding de Copy Generator.
- Las tareas de Closing (sincronizar, re-analizar, revisar) quedan para admin y closer; un setter no.
- Crear, borrar y restablecer hojas por la API no corren dentro de una automatización.
