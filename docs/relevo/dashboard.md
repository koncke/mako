# Relevo — chat «Dashboard» (la tab Dashboard y el editor de General)

<sub>Escrito el 17/10/2026 ~05:30 (hora de Argentina) por la cuenta 4 (claude4), desde el chat que hizo el trabajo. Se pisa
en cada relevo. Los anteriores están en el historial: `git log -p -- docs/relevo/dashboard.md`.</sub>

## Cómo se trabaja acá

- Rama `dashboard-bloques`, worktree `C:/dev/wt-dashboard`. Se MEZCLA origin/main (nunca rebase) y se commitea por ruta
  explícita, con `Claude-Cuenta` pegado a `Co-Authored-By` (también en los merges).
- **La punta va al «Cerebro»**, que la sube a main en runs numerados. Este chat no pushea. Las migraciones las numera él.
- Sin `next dev` ni tsc completo (la RAM): `node scripts/tsc-acotado.mjs --rama`. ⚠️ Si tocaste app/dashboard/EditorInforme.tsx,
  entra por arrastre app/conocimientos/Compartir.tsx con dos rojos de `<style jsx>`: no son tuyos (el tsc acotado no carga
  el tipo de styled-jsx); contá los rojos sin ese archivo.
- Para probar contra la base sin navegador (sólo leyendo): un script en el scratchpad con
  `node --conditions=react-server --import tsx`, los imports como `file:///C:/dev/wt-dashboard/…` y `runWithWorkspace(ws)`.
  Así se midieron el OKR por funnels (ws1) y los pedidos sueltos (ws9). Las rutas que piden sesión no corren así: se
  llama a lo que ellas llaman.
- Arnés de capturas FUERA del repo, `C:/Users/marti/arnes-dashboard/` (modos `plantillas`, `galeria`, `crear`, `editar`).

## Dónde está (17/10)

**En main** (`e5ded0af8`, mig 0306 que aplica el Cerebro): los OKR, los KPIs automáticos del CRM y «A quién cobrarle»
eligen uno o varios funnels (la pieza `app/components/ElegirFunnels.tsx`), con la regla de que cada pago cuenta en el
funnel donde estaba el lead ese día (lib/funnels-elegidos.ts). Los pagos del Dashboard tienen funnel. API de MaKo al día.

**Punta entregada al Cerebro, sin subir** (`98a4a19d2`, y encima el merge de origin/main y esta cosecha):
- «Estilo de la hoja» con AJUSTES encima de la plantilla (fondo, esquinas, borde, sombra, títulos; valores, leyenda,
  cuadrícula). `PanelEstilo` es la pieza compartida; los ajustes van prendidos en Dashboard y General.
- «Editar con MaKo» con el muñeco de la tab y el micrófono del Second Brain.

Lo aprendido: `docs/hallazgos-objectives.md` («Un OKR que suma varios funnels»), `docs/hallazgos-graficos.md` (los pagos
con funnel; «Estilo de la hoja») y `docs/hallazgos-ia.md` (los pedidos sueltos probados en el ws9). La regla para código
nuevo, en AGENTS.md («Elegir funnels: UNO O VARIOS»).

## Lo que falta

- **La ficha del CRM puede prender los ajustes del estilo** cuando su op `tema` (lib/ficha/config.ts) los copie y
  `estiloDeFicha` (app/crm/lead-view/ficha/armar.ts) use `temaPropio`. Se le avisó al jefe del CRM el 17/10.
- **Los pedidos sueltos fallan en tres casos** (hallazgos-ia, 17/10): una hoja que se llama como una tab, los verbos de
  ir («Ve al CRM») y una hoja que no existe. Viven en lib/mako-pedidos.ts, compartido con las otras tabs: se le pasó al
  Cerebro.
- **Elegir funnels en otras tabs**: el inventario, repartido por el Cerebro (notas del Cerebro,
  `dashboard-inventario-un-solo-funnel.md`). Y el filtro «Producto» de los LEADS del Dashboard sigue mirando sólo la casa.
- **Nada de esta tanda se miró en pantalla**: el selector de funnels en el OKR, el panel de estilo con los ajustes y el
  muñeco (Claude in Chrome desconectado, sin RAM para `next dev`).
- **Lo de antes que sigue abierto**: el hilo de «Editar con MaKo» no se guarda (etapa 2 de docs/diseno-mako-ai-native.md);
  `claudePausado` debería decir «Conecta tu Claude»; la pila del celular con una sesión real; cinco temas sin mirar por
  tipo; que Martín decida si se borran `PulsoPaginas.tsx` y `ScriptsBrowser`/`GuionesFull`. El resto, en
  `docs/hallazgos-graficos.md` → «Lo que quedó sin hacer».
