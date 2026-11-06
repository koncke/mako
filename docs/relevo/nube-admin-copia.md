# Relevo — Admin con el código de Studio Admin (nube, 6/11/2026)

> Lo escribe la sesión de la nube que hace la copia (cuenta `nube`, sesión `cli_f877b32d-9536-5c7b-942c-bafca9f3fa8d`). Se
> reescribe en cada tanda. El pedido de Martín, textual, está en la bitácora del área (app/admin/dev/admin/bitacora.ts); la
> fuente y por qué, en [docs/investigacion-admin.md](../investigacion-admin.md). El relevo de las cuentas (que se conservan):
> [nube-admin.md](nube-admin.md).

## La fuente

**Studio Admin** — [arhamkhnz/next-shadcn-admin-dashboard](https://github.com/arhamkhnz/next-shadcn-admin-dashboard), MIT,
commit `036631e` (5/11/2026). Aviso: `lib/avisos/LICENSE-STUDIO-ADMIN`. La demo (studio-admin.arhamkhnz.com) no abre desde la
nube (403 del proxy): se clonó el repo y se levantó en local con `npm ci && npx next dev`.

## Lo que ya está subido

| Tanda | Qué | Dónde está |
|---|---|---|
| 1 | El shell de Studio (sidebar, cabecera, búsqueda ⌘K, modo oscuro, su tema y sus componentes), **Users** (`dashboard/users`) y **Revenue** (`dashboard/default`). La barra de pestañas de antes se borró. | `punta/admin-copia` (subida el 6/11, veredicto verde) |
| 2 | **Billing** (`dashboard/finance`): Resumen, Cobros y Recibos, Ajustes y Exportar; **Cargar pago** (`dashboard/invoice`): formulario, vista previa, Imprimir y Bajar el PDF. Se borraron las siete pantallas de antes de `app/admin/cobros/`. | `punta/admin-copia` |
| 3 | **Customers** (`dashboard/crm`): las cuatro tarjetas, lo que entró por mes, los nuevos de 30 días, la configuración y la tabla (buscar, Grupo, Estado, páginas); **la ficha** (`dashboard/profile`, `?cliente=<ws>`): miga de pan, cabecera con Administrar y Entrar, y tres pestañas. Se borró `app/customers/CustomersApp.tsx`. | `punta/admin-copia` |

Activity y Errors siguen con su pantalla de antes **adentro del shell nuevo** hasta su tanda. Accounts (la grilla de
administración, `?tab=accounts`) se queda como está: no es una de las seis secciones, y se llega desde «Administrar» de la ficha. Los links viejos
(`/admin?tab=users`, `?tab=accounts`, `?tab=agents`, `/admin/cobros`…) siguen llevando a su sección.

### Billing, pieza por pieza (tanda 2)

| Studio (`dashboard/finance`) | En MaKo |
|---|---|
| Pestañas Dashboard · Accounts · Transactions | Resumen · Cobros · Recibos (`?vista=`). Accounts y Transactions de Studio dicen «coming soon»: van la tabla de su dashboard con los cobros y con el libro de recibos |
| Net worth · Available cash · Monthly spend · Savings rate | Cobrado este mes · MRR · Vence en 31 días · Atrasado |
| Income sources | Cómo entra (12 meses): todos los meses o una vez |
| La tarjeta del aviso | Lo que más espera: conectar la pasarela, una cuenta que no se creó, o lo atrasado. Sin nada, no se dibuja |
| Spending Overview (gasto lleno, ingreso punteado) | Lo cobrado (lleno) y lo que vence (punteado: todavía no pasó). Semana · Mes · Año |
| Account Allocation (selector de moneda) | Por dónde entra (Stripe, Mercado Pago, Binance…), con selector de período |
| Wallet | Pasarelas: las conectadas y los otros medios por los que entró plata |
| Upcoming Bills & Payments | Vence en 31 días, lo atrasado primero, cada uno a la ficha de su cliente |
| Quick Transfer · Shortcuts | Vender un plan (el monto y «Vender») · Atajos |
| Settings · Export | Ajustes (precios en Mercado Pago, cliente de agencia, datos del recibo, WhatsApp) · Exportar lo cobrado |
| `dashboard/invoice` | Cargar pago: ¿de quién?, qué se pagó (renglones que se arrastran), cómo se pagó, notas; la vista previa en el papel de Studio |

### Customers, pieza por pieza (tanda 3)

| Studio (`dashboard/crm` y `profile`) | En MaKo (app/admin/clientes) |
|---|---|
| Pipeline Overview: cuatro tarjetas con tendencia y «last month» | MRR · Clientes · Activos · En riesgo, con un dato de verdad abajo (cuántos pagan, nuevos en 30 días, entraron esta semana, piden atención). Sin la insignia de tendencia |
| Qualified Lead Flow (barras rayadas, 30 días · trimestre · 12 meses) | Lo que entró por mes (3 o 6 meses, lo que trae la vista); sin plata, «Todavía no entró plata por MaKo» y Vender un plan |
| Discovery Calls Booked (con su barra) | Pagan su mensualidad: cuántos de los activos pagan |
| Upcoming Meetings (la línea de tiempo con un bloque) | Nuevos en 30 días: el más nuevo sobre su fecha (abre su ficha); «View Calendar» → Abrir Accounts |
| Monthly Proposal Goal (42 barritas) | Configuración terminada, de los que se pudo leer |
| Recent Opportunities: buscar, Stage, Health, páginas | Cada cliente: buscar, Grupo, Estado, páginas. ID = el número del negocio, Priority → Última vez, Health → el estado (el porqué de «Para mirar» en su tooltip), Value → MRR. El lápiz abre la ficha |
| profile: miga de pan, anillo, insignias, Email · Edit profile · ⋯ | Admin › Customers › el negocio › Ficha; el anillo = su configuración; Administrar (Accounts) · Entrar a su cuenta |
| Overview (About, Work details, Reporting line) + Record status · Upcoming events | Resumen (Cómo está, Datos, Su agencia si es de una) + Estado · Lo que viene (un pago esperando, el fin de lo gratis, el primer mes) |
| Employment · Time off | Plan y cobro · Actividad (última vez, último lead, leads, el agente, la configuración) |

## Las capturas (Studio a la izquierda, MaKo a la derecha)

`docs/admin/copia/users-1440.png`, `users-390.png`, `revenue-1440.png`, `revenue-390.png`, `billing-1440.png`, `billing-390.png`,
`recibo-1440.png` y `recibo-390.png` (Billing › Resumen y Cargar pago), `customers-1440.png`, `customers-390.png`,
`customers-tabla-1440.png`, `ficha-1440.png` y `ficha-390.png` (Customers y la ficha de un negocio). **Las de MaKo son con datos
INVENTADOS**: la nube no tiene la base. Se sacaron con una página de vista previa local (no se commitea) que monta el mismo
`AdminShell`, `Users` y `Revenue` con filas de mentira. **Le toca al Cerebro:** sacarlas de nuevo en producción con los datos de
verdad, una vez desplegado, y compararlas con éstas.

A 390 de ancho, la barra de MaKo (el riel de íconos) sigue a la izquierda: es el caso de una ventana angosta en la computadora.
En un teléfono de verdad, `/admin` no se abre (el teléfono tiene su propia pantalla, `/m/customers`).

## Cómo está armado (para la próxima tanda)

- `app/admin/_studio/components/ui/*` — los componentes de Studio (`src/components/ui`), con los imports reescritos y los
  portales al contenedor de `.sa` (`portalSa()`). Se copian los que una pantalla pide, no todos.
- `app/admin/_studio/shell/*` — el layout de Studio (`AdminShell` = su `dashboard/layout.tsx`), el sidebar, la búsqueda, el modo
  y la cuenta.
- `app/admin/_studio/studio-theme.css` — su tema en `.sa`. **Cada valor es el de Studio**; el oscuro es el de MaKo.
- Cada sección, en su carpeta y con los nombres de archivo de Studio: `app/admin/usuarios/`, `app/admin/ingresos/`, `app/admin/cobros/` (Billing: `billing.tsx` lee, `_components/` dibuja, `recibo/` es Cargar pago),
  `app/admin/clientes/` (Customers: `customers.tsx` arma, `_components/` es el CRM, `perfil/` es la ficha). Lo que la
  pantalla decide sobre los números va en un módulo puro con test (`revenue-vista.ts`, `usuarios/data.ts`,
  `customers-vista.ts`).
- Una página que va de borde a borde (el perfil) pone `data-content-padding="false"`: el shell le saca el margen, como en Studio.
- El `tsc` acotado con el tope por defecto (2560 MB) se queda sin memoria con estas pantallas: `--heap=5000`.
- Para portar una pantalla: abrir su carpeta en `src/app/(main)/dashboard/<x>/_components`, copiar archivo por archivo,
  `sed` de los imports `@/components/` → `@/app/admin/_studio/components/`, textos en español, y los datos al final.
- `tests/admin-studio.test.ts` fija el tema, los portales, las secciones, la letra y que no se use `app/_ui`.

## Lo que se cambió fuera de Admin (con su porqué)

- `app/_ui/ui.css`: la regla que pinta la barra de MaKo en claro (`[data-sidebar]`) ahora es `:not(.sa [data-sidebar])`. El
  sidebar de Studio también marca sus piezas con `data-sidebar` y le salía un filete en cada grupo.
- `app/_chat/MakoEnLaTab.tsx`: la estrella de MaKo se pone al costado de una barra que la tab marca con `data-barra-de-la-tab`
  (el sidebar de Studio la lleva). Sin esto tapaba la cuenta del pie del sidebar.
- `app/globals.css`: importa `app/admin/_studio/studio-theme.css`. Las variantes de shadcn (`data-open:`…) valen sólo adentro
  de `.sa`; afuera, las de Tailwind como siempre (el Video Editor no cambia).
- Dependencias nuevas: `@tanstack/react-table` 9.3.1, `cmdk` 1.1.1, `date-fns` 4.4.0 y `cn` 0.5.2 (las de Studio).

## No está en la fuente (lo decide Martín)

Lo que MaKo necesita y Studio no tiene. No se inventó nada; se dice dónde quedó:

1. **Revenue: los movimientos de cada mes** (nuevo, volvió, subió, bajó, se cortó) y la tabla de saldos de la versión
   anterior. Studio no tiene esa pieza; el gráfico sólo dibuja el MRR nuevo como una línea.
2. **Revenue: lo que viene a cobrar y los últimos pagos.** Van a **Billing** (la pantalla `finance` de Studio tiene «Upcoming
   transactions» y «Transactions»), en su tanda.
3. **Revenue: lo que pagó cada cliente en total** va como segunda línea de la columna Plan (en Studio, Plan es un renglón).
4. **Users: el detalle del estado** («Entró hace 3 días», «Nunca se le mandó el acceso») queda en el tooltip de la insignia.
   Studio sólo muestra el estado.
5. **Users: la vista de grilla.** En Studio el selector se dibuja y no cambia nada; se armó con sus mismas piezas (la tarjeta y
   las celdas de la tabla).
6. **Users: «Customize».** En Studio no hace nada; en su lugar va el «Ordenar» de su tabla de clientes (`dashboard/default`).
7. **La búsqueda (⌘K)** busca las secciones, como en Studio. Buscar negocios o personas desde ahí no está en la fuente.
8. **Billing: Cobros y Recibos.** Las pestañas Accounts y Transactions de Studio son un «coming soon»: se llenaron con la tabla de
   su dashboard (`recent-customers-table`), que es lo más parecido que la fuente tiene.
9. **Billing: «Vender un plan»** era un asistente de MaKo. Studio no tiene esa pieza: va en su `Dialog`, con sus campos.
10. **Billing: el aviso.** En Studio la tarjeta del puntaje de crédito está siempre; en MaKo sale sólo si algo espera a Martín.
11. **Cargar pago: cómo se pagó** (medio, referencia, fecha y hora, comprobante). La factura de Studio no tiene pagos: se armó
    con sus campos y su selector de fecha, en la pestaña «Pago» (allá las pestañas del formulario no cambian nada).
12. **Cargar pago: «Bajar el PDF»** baja el PDF de verdad, que existe recién al emitir (en Studio el botón no hace nada). Antes de
    emitir se apaga y lo dice.
13. **Customers: «Para mirar»** (la lista de quién pide atención, con su etiqueta de color). Studio no tiene esa pieza: el motivo
    quedó en el tooltip de la tira de estado, los que piden atención van primero en la tabla y la tarjeta «En riesgo» los cuenta.
14. **Customers: el clic derecho de cada cliente** (ver la ficha, entrar, administrar; pedido de Leandro para toda la app,
    24/10). Studio no lo tiene en esta pantalla. Las tres cosas están en la ficha. Studio trae su `context-menu` entre los
    componentes, si Martín lo quiere de vuelta.
15. **Customers: los grupos con su número** (los chips de antes, «Clientes 12»). En Studio el filtro de Stage no cuenta.
16. **Customers: los leads de cada negocio** eran una columna; en la tabla de Studio no hay lugar (va en la ficha, Actividad).

## Lo que Studio trae y se sacó

- **El personalizador de la plantilla** (el engranaje: presets de color, letras, ancho, estilo del sidebar). Es de la demo,
  no de un admin. Se usan sus valores por defecto.
- **El menú de GitHub del autor**, la tarjeta «Have something in mind?» (su lugar ahora dice qué espera a Martín) y el «Add
  User» de Users (el alta de una persona es de su negocio o del alta de un cliente).
- **«All segments»** del gráfico de Revenue: MaKo no parte lo cobrado por segmento.
- **El modo «sistema»** del botón de la luna: en MaKo el oscuro es sólo de quien lo elige.
- **Billing:** «Updated 5 min ago» (la página se lee al abrirla), el pie de Wallet («Physical Vault», «Air-Gapped»), «Add New
  Client» del recibo (una cuenta nace de su alta) y su descuento e impuesto (un recibo de MaKo no los tiene).
- **Customers:** las insignias de tendencia y el «last month» de las tarjetas (MaKo no guarda cómo estaban el mes pasado), la
  casilla de selección de la tabla (no hay nada que hacer con varios a la vez), el «⋯» del perfil (entrar ya es el botón; pausar
  o borrar va en Accounts), «Org chart», y las pestañas Personal, Compensation y Documents (un negocio no tiene esos datos).

## Lo que falta

> ⚠️ **Antes de la tanda 4, una pregunta (6/11, ~02:20 UTC).** En `main` entró `ab89fd161` (cuenta claude3): capturas del panel
> de **Polar** en `docs/admin/referencia-polar/`, con un LEEME que las llama «la referencia de la tab Admin» (una sola barra,
> sin barra superior, Inter, Overview de Polar…). El encargo de esta sesión es Studio Admin, sin mezclar otra fuente. No hay
> otra decisión escrita. Si Martín cambió la fuente a Polar, las tandas 4 y 5 no se hacen con Studio y lo ya subido se rehace;
> si no, se sigue como está abajo.

- **Tanda 4: Activity** = `analytics`, con sus pestañas, sobre `vistaDeActividad`.
- **Tanda 5: Errors** = `infrastructure`: un grupo por negocio, salud, filtros por faceta, sobre `vistaDeErrores`.
- Cada una: capturas lado a lado en `docs/admin/copia/` y borrar su pantalla vieja.
