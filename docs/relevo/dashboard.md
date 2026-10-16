# Relevo — chat «Dashboard» (la tab Dashboard y el editor de General)

<sub>Escrito el 16/10/2026 ~10:30 (hora de Argentina) por la cuenta 3 (claude3), desde el chat que hizo el trabajo, al pasar
el 85% del uso semanal. Se pisa en cada relevo. Los anteriores están en el historial: `git log -p -- docs/relevo/dashboard.md`.</sub>

## Cómo se trabaja acá

- Rama `dashboard-bloques`, worktree `C:/dev/wt-dashboard`. Se MEZCLA (nunca rebase) y se commitea por ruta explícita.
- **La punta va a «Cerebro»** (`local_0f38f4d5…`), que la sube a main en runs numerados. Este chat no pushea.
- Sin `next dev` ni tsc completo (la RAM): `node scripts/tsc-acotado.mjs <archivos>`; salida 99 = lo mató el vigía, no es verde.
- Arnés de capturas FUERA del repo, `C:/Users/marti/arnes-dashboard/`: `node build.mjs C:/dev/wt-dashboard` y
  `node capturar.cjs "<regex>" mako <modo>`. Modos: `plantillas`, `galeria`, `crear` (la «¿Qué vas a crear hoy?» de verdad) y
  `editar` (el panel «Editar con MaKo» de verdad, con `editar-pedidos` para las burbujas). ⚠️ El 2º argumento es el tema de
  la HOJA, no el oscuro de la app.

## Dónde está (16/10)

**En producción** (runs 32 y 36), mirado en el ws9 sólo leyendo:
- La IA del Dashboard con su propia red y el corte por datos de clientes caja por caja (`pii` en cada caja; sin crédito ni
  key del negocio, una caja con datos de clientes no corre y avisa «Conecta tu Claude…»).
- Las plantillas sugeridas por el negocio (módulo compartido, guía en `docs/plantillas-sugeridas.md`).
- «Editar con MaKo» en Dashboard y General (operaciones sobre la hoja abierta, el editor aplica con `mutar`).
- La seguridad de `/api/chart-insights` (sin números para no-admins; cada chat es de quien lo habló).

**Punta entregada, sin subir: `53f969095`** — los pedidos sueltos en «Editar con MaKo» (crear otra hoja, abrir o archivar
otra, «¿Cuál?», el link a otra tab). Trae adentro la rama del Web Generator (`web-pedidos` @019ffdb00), que sale en el
run 43: tiene que subir DESPUÉS o junto con ese run. Toca dos archivos de esa rama: `objetosDeTab` de `general` en
app/api/mako/pedidos/route.ts y `PARTES_DE_LO_ABIERTO.general` en lib/mako-pedidos.ts.

Lo aprendido de todo esto: `docs/hallazgos-graficos.md` (secciones del 16/10), `docs/hallazgos-ia.md` («Los pedidos
sueltos…»), `docs/hallazgos-seguridad.md` (chart-insights) y el contrato en `docs/diseno-mako-pedidos.md`.

## Lo que falta

- **Después del run 43:** probar los pedidos sueltos contra la ruta de verdad en el ws9 (sólo leyendo: «créame otra hoja»
  muestra la burbuja; no apretar Sí ni Archivar en un informe ajeno).
- **Mirar el panel «Editar con MaKo» en la pantalla de producción** (se probó la ruta y el modelo; el panel, sólo en el arnés).
- **El hilo del panel no se guarda** (es de la sesión, por hoja): es la etapa 2 de `docs/diseno-mako-ai-native.md`.
- **`claudePausado` debería decir «Conecta tu Claude»**: anotado como abierto por Cerebro, no pedido todavía.
- **Lo de antes que sigue abierto:** la pila del celular con una sesión real; cinco temas sin mirar por tipo (Minimal, Suave,
  Elevada, General, Editorial); «Conclusiones de MaKo», la Ficha y el mapa de calor de página sin mirar en el arnés; que
  Martín decida si se borran `PulsoPaginas.tsx` y `ScriptsBrowser`/`GuionesFull`.
- El resto, en `docs/hallazgos-graficos.md` → «Lo que quedó sin hacer».
