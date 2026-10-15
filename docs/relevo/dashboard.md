# Relevo — chat «Dashboard» (la tab Dashboard)

<sub>Escrito el 14/10/2026 ~22:40 (hora de Argentina) por la cuenta 1 (claude1), desde el chat que hizo el trabajo. Se pisa en cada
relevo. El anterior (chat «Graphics», cuenta 2) está en el historial: `git log -p -- docs/relevo/dashboard.md`.</sub>

## Dónde está

**El rediseño por tipo con capturas** (pedido de Martín del 14/10, 14:34: «Que rediseñe bloque por bloque y que tenga en cuenta
mobile… con datos ficticios… Tanto bloques como las plantillas»). Se hizo de a dos chats, repartido por ARCHIVO:

- **Este chat:** lo que dibuja `app/dashboard/Grafico.tsx` (números, ejes, torta, anillo, sankey, embudos, la tabla dinámica), los
  datos de ejemplo (`lib/graficos-muestra.ts`), `intervaloPorAncho` (`lib/graficos-gordo.ts`) y la pila del celular
  (`EditorInforme.tsx`). Commits `fb44d58d`, `1de9d05b`, `cdaebefa` y el de la cosecha.
- **El chat «General»:** los tipos con archivo propio en `app/dashboard/graficos/` (tablas, tarjetas, dispersión, paneles, tramos,
  barras gordas), el mapa (`MapaGeo.tsx`) y la revisión de las 13 plantillas enteras. Commits `aa08f395`, `6fcdc128`, `5e47a427`,
  `105fc5f4`, `93012bf0`.

Se integró en la rama `dashboard-bloques` (worktree `C:/dev/wt-dashboard`) y se pushea a main desde ahí.

Lo aprendido, en `docs/hallazgos-graficos.md`: «Rediseño por tipo con capturas, mitad General» y «El rediseño por tipo, mitad
Dashboard». El arnés de capturas vive FUERA del repo, en `C:/Users/marti/arnes-dashboard/` (`node build.mjs <raíz>` y
`node capturar.cjs <regex> [tema] [plantillas]`).

## Después: el épico (14/10 noche) y las portadas (15/10, esperando a Martín)

- **En main:** el titular por hoja + ESCALA_EPICA (`68566ade`), el test arreglado (`4297cfa1`/`d636ffdc`) y el texto que
  crece con su tarjeta (`d5384e97`). Cosecha en `docs/hallazgos-graficos.md` → «El Dashboard épico».
- **Martín rechazó las plantillas** («todos parecen muy iguales», «muchos gráficos juntos parece dashboard»): la portada de
  cada hoja tiene que ser UNA cosa con la FORMA de su objetivo. La propuesta de las 13 está en `docs/portadas-propuesta.md`
  (la escribió el orquestador; no duplicarla). **NO implementar hasta que conteste** la decisión de la Ticketera.
- Antes de implementar, mirar: (1) si los anuncios de `guiones` traen miniatura (`FilaResultado.imagen`) en todos los
  workspaces, y (2) qué dibuja el mapa de calor sin puente ni grabaciones: ninguna portada puede quedar vacía (placeholder
  con datos ficticios). Los ejemplos de personas (CS, Cobranza) son ficticios.
- Los colores por hoja van en UNA tabla compartida con General (propuesta: `lib/graficos-identidad.ts`).

## Lo que falta
- **Verlo en producción (ws3)**: el editor con «Celular» sobre una plantilla (Comercial, Marketing) y la galería de «¿Qué vas a
  crear hoy?». Nada se miró todavía con datos reales.
- **Los otros seis temas** (Minimal, Suave, Contraste, Elevada, General, Editorial): el arnés se corrió sólo con MaKo
  (`node capturar.cjs <regex> general` los dibuja).
- **Sin mirar en el arnés**: «Conclusiones de MaKo», la Ficha y el mapa de calor de página (piden datos del server).
- **Que Martín decida** si se borran `PulsoPaginas.tsx` + su ruta y su lib, y `ScriptsBrowser`/`GuionesFull` (~900 líneas sin usar).
- El resto, en `docs/hallazgos-graficos.md` → «Lo que quedó sin hacer».
