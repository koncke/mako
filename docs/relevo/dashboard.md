# Relevo — chat «Dashboard» (la tab Dashboard)

<sub>Escrito el 15/10/2026 ~06:40 (hora de Argentina) por la cuenta 1 (claude1), desde el chat que hizo el trabajo. Se pisa en cada
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

## Después: el épico (14/10 noche) y las PORTADAS (15/10, hechas)

- **En main:** el titular por hoja + ESCALA_EPICA (`68566ade`) y el texto que crece con su tarjeta (`d5384e97`).
- **Las portadas, hechas el 15/10** (el orquestador retiró la decisión de la Ticketera: Martín quería verlo hecho, no una
  tabla). Las 26 plantillas abren con UNA pieza a lo ancho, con su color y la forma de lo que contestan. **Copiado de las
  portadas de informe de Canva** (capturas en `C:/Users/marti/arnes-dashboard/referencias/`). El titular 6 × 6 se fue.
  Dónde vive y lo que costó: `docs/hallazgos-graficos.md` → «Las portadas». La regla para una plantilla nueva, en AGENTS.md
  (sección de General como editor del Dashboard).
- **La tabla de colores** (`lib/graficos-identidad.ts`) es la acordada con General, con Ads en coral (el magenta es de
  Instagram) y General en Noche. Las dos galerías las hace ESTE chat (General no las toca: lo avisó el orquestador).
- **Lo que se midió y cambió la propuesta:** no hay leads «de Instagram» (el 1.062 era `instant_form`); la plantilla
  Instagram abre con la audiencia de Meta por plataforma. Sin DM de Instagram conectados.
- **Capturas:** arnés del Dashboard `node build.mjs` + `node capturar.cjs "" mako galeria` (la galería real, escritorio y
  celular) y `... plantillas` (cada hoja en escritorio y en la pila); arnés de General `C:/Users/marti/arnes-dashboard-general/`
  (`node build-general.mjs C:/dev/wt-dashboard`, con `CHICO=1` o `PILA=1`).

## Pedido en cola (15/10): borrar las hojas viejas y rehacer las de Mauricio, DESPUÉS de las portadas

Martín: «eliminen las tabs viejas de los workspaces. Sólo en el caso de Mauricio, que vuelva a poner las tabs que estaban
pero con su nuevo rediseño». Orden: aprobar portadas → implementarlas → recién ahí borrar y rehacer. Censo (sólo leyendo,
15/10): 5 informes, 11 hojas; ws1 6 (Marketing, Comercial, Ads, Landing, Closing, Productividad), ws10 Ads, ws11 Cobranza +
Marketing, ws13 Marketing, ws15 Marketing; todas de plantilla. Script de censo:
`scratchpad/censo-hojas.mjs` (rehacerlo en el repo si hace falta). UN script con General para el borrado, con respaldo y
comando para devolverlo, verificado con lo que lee el producto. Al armar el respaldo se compara cada hoja PIEZA POR PIEZA
con su plantilla: si aparece UNA editada, se frena y se avisa al orquestador (es trabajo de alguien). Las portadas ya están
hechas (15/10): lo que sigue es este borrado y rehacer las de Mauricio con `instanciarPlantilla` sobre las plantillas nuevas.

## Lo que falta
- **Verlo en producción (ws3)**: el editor con «Celular» sobre una plantilla (Comercial, Marketing) y la galería de «¿Qué vas a
  crear hoy?». Nada se miró todavía con datos reales.
- **Los otros seis temas** (Minimal, Suave, Contraste, Elevada, General, Editorial): el arnés se corrió sólo con MaKo
  (`node capturar.cjs <regex> general` los dibuja).
- **Sin mirar en el arnés**: «Conclusiones de MaKo», la Ficha y el mapa de calor de página (piden datos del server).
- **Que Martín decida** si se borran `PulsoPaginas.tsx` + su ruta y su lib, y `ScriptsBrowser`/`GuionesFull` (~900 líneas sin usar).
- El resto, en `docs/hallazgos-graficos.md` → «Lo que quedó sin hacer».
