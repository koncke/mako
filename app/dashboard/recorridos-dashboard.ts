// =============================================================================
// recorridos-dashboard — los DOS recorridos de la tab Dashboard: mirar y editar
// =============================================================================
// Pedido de Martín (11/10/2026, punto 20): «Cuando termines todo... Haz el tutorial de como utilizar
// esta tab de "Dashboard" tal como lo tenemos en el tutorial de "CURSO", que sea como un recorrido.»
//
// Son DATOS PUROS (sin React), como app/customer-success/curso/recorridos-curso.ts: los monta
// ./EditorInforme.tsx con app/_ui/Recorrido.tsx, y tests/dashboard-recorridos.test.ts comprueba que
// cada `objetivo` sea un `data-recorrido` que alguien pone en el fuente.
//
// Son DOS porque un paso cuyo objetivo no está EN PANTALLA se saltea solo (lib/recorridos.ts): la barra
// de edición y el panel de un componente sólo existen editando. El de mirar se abre la primera vez que
// alguien entra; el de editar, la primera vez que aprieta «Editar». La guía se vuelve a abrir desde el ⋮.
//
// Desde la tanda de la TOPBAR (11/10/2026) la pantalla cambió: sin pestañas (las hojas son el desplegable
// del título), el AI Analyst, Exportar y la guía adentro del ⋮, y los filtros en la topbar. Un paso no
// puede señalar algo que vive adentro de un menu cerrado (el desplegable de las hojas, el ⋮): se saltearía
// siempre. Por eso el de las hojas señala el ▾ y el último señala el ⋮.
//
// Quién pone cada objetivo (si uno falta, su paso se saltea y nada se rompe — salvo el test):
//   · la topbar (./Cabecera.tsx): dash-titulo (emoji, título y subtítulo), dash-hojas (el ▾)
//   · la topbar (./EditorInforme.tsx): dash-controles (los filtros), dash-editar, dash-ver, dash-ayuda (el ⋮)
//   · los filtros (./BarraControles.tsx): dash-filtro («＋ Filtro», sólo editando)
//   · el lienzo (./EditorInforme.tsx): dash-grafico, dash-mako, dash-componente. Desde la tanda v5 el botón de
//     MaKo se apaga por gráfico (punto 15): `dash-mako` va en el primer gráfico QUE LO TIENE (y con datos), no en
//     el primero, o el paso señalaría la nada.
//   · la barra de edición (./EditorInforme.tsx): dash-deshacer, dash-datos, dash-anadir-grafico,
//     dash-insertar, dash-estilo
//
// ⚠️ TODOS CON EL PREFIJO `dash-`. El DOM es uno solo y `selectorDe` toma el PRIMER nodo que coincide;
//    y `ayuda` ya es de la tab Curso (tests/curso-recorridos.test.ts exige que sólo CursoApp lo ponga).
// ⚠️ TEXTOS CORTOS (una o dos frases) y de TÚ: es texto de pantalla (AGENTS.md).
// ⚠️ LOS IDS SON LA CLAVE DE «YA LO VIO», por persona (`/api/recorridos`): no se cambian nunca.

import type { PasoRecorrido } from '@/lib/recorridos';

export const RECORRIDO_DASHBOARD = 'dashboard';
export const RECORRIDO_DASHBOARD_EDICION = 'dashboard-edicion';

/** El último paso de los dos: el ⋮, donde están el AI Analyst, Exportar y cómo volver a ver esta guía. */
const PASO_AYUDA: PasoRecorrido = { objetivo: 'dash-ayuda', titulo: 'Más opciones', texto: 'AI Analyst, Exportar y esta guía, siempre aquí.' };

/** EL DE MIRAR: la topbar de izquierda a derecha, un gráfico y lo que se hace con él. */
export const PASOS_DASHBOARD: PasoRecorrido[] = [
  { objetivo: 'dash-titulo', titulo: 'El título', texto: 'Haz clic en el emoji, el título o el subtítulo para cambiarlos.' },
  { objetivo: 'dash-hojas', titulo: 'Tus hojas', texto: 'Cambia de hoja o crea una nueva desde aquí.' },
  { objetivo: 'dash-controles', titulo: 'Filtros', texto: 'Filtran toda la hoja. Lo que eliges mirando no se guarda.' },
  { objetivo: 'dash-grafico', titulo: 'Tus gráficos', texto: 'Haz clic en una barra o en un número para ver el detalle.' },
  { objetivo: 'dash-mako', titulo: 'Pregúntale a MaKo', texto: 'MaKo te explica lo que muestra el gráfico.' },
  { objetivo: 'dash-editar', titulo: 'Editar', texto: 'Agrega gráficos y filtros, muévelos y cambia el estilo.' },
  PASO_AYUDA,
];

/** EL DE EDITAR: la barra de edición, de izquierda a derecha, los filtros, un componente, y cómo salir. */
export const PASOS_DASHBOARD_EDICION: PasoRecorrido[] = [
  { objetivo: 'dash-deshacer', titulo: 'Deshacer', texto: 'Vuelve atrás cualquier cambio. También con Ctrl+Z.' },
  { objetivo: 'dash-datos', titulo: 'Añadir datos', texto: 'Una tabla nueva con cualquier conjunto de MaKo.' },
  { objetivo: 'dash-anadir-grafico', titulo: 'Añadir un gráfico', texto: 'Elige el tipo de gráfico.' },
  { objetivo: 'dash-insertar', titulo: 'Insertar', texto: 'Texto, imágenes, videos, secciones, líneas y conectores.' },
  { objetivo: 'dash-estilo', titulo: 'Estilo de la hoja', texto: 'Plantilla, color y letra para todos los gráficos.' },
  { objetivo: 'dash-filtro', titulo: 'Filtros de la hoja', texto: 'Agrega o quita filtros. Sólo mientras editas.' },
  { objetivo: 'dash-componente', titulo: 'Mover y agrandar', texto: 'Arrástralo o estira su esquina. Con un clic, sus datos.' },
  { objetivo: 'dash-ver', titulo: 'Ver', texto: 'Sal de la edición. Los cambios se guardan solos.' },
  PASO_AYUDA,
];
