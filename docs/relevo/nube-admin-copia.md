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
| 1 | El shell de Studio (sidebar, cabecera, búsqueda ⌘K, modo oscuro, su tema y sus componentes), **Users** (`dashboard/users`) y **Revenue** (`dashboard/default`). La barra de pestañas de antes se borró. | `punta/admin-copia` |

Billing, Customers, Activity y Errors siguen con su pantalla de antes **adentro del shell nuevo** hasta su tanda. Los links
viejos (`/admin?tab=users`, `?tab=accounts`, `?tab=agents`…) siguen llevando a su sección.

## Las capturas (Studio a la izquierda, MaKo a la derecha)

`docs/admin/copia/users-1440.png`, `users-390.png`, `revenue-1440.png`, `revenue-390.png`. **Las de MaKo son con datos
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
- Cada sección, en su carpeta y con los nombres de archivo de Studio: `app/admin/usuarios/`, `app/admin/ingresos/`. Lo que la
  pantalla decide sobre los números va en un módulo puro con test (`revenue-vista.ts`, `usuarios/data.ts`).
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

## Lo que Studio trae y se sacó

- **El personalizador de la plantilla** (el engranaje: presets de color, letras, ancho, estilo del sidebar). Es de la demo,
  no de un admin. Se usan sus valores por defecto.
- **El menú de GitHub del autor**, la tarjeta «Have something in mind?» (su lugar ahora dice qué espera a Martín) y el «Add
  User» de Users (el alta de una persona es de su negocio o del alta de un cliente).
- **«All segments»** del gráfico de Revenue: MaKo no parte lo cobrado por segmento.
- **El modo «sistema»** del botón de la luna: en MaKo el oscuro es sólo de quien lo elige.

## Lo que falta

- **Tanda 2: Billing** = `finance` (Dashboard, Accounts, Transactions) + los recibos = `invoice` (formulario a la izquierda,
  vista previa a la derecha, Print y Download PDF). Monta `RecibosMako` y las acciones de `app/admin/cobros`.
- **Tanda 3: Customers** = `crm`, y la ficha de un cliente = `profile`. Accounts (la grilla de administración) se decide ahí.
- **Tanda 4: Activity** = `analytics`, con sus pestañas, sobre `vistaDeActividad`.
- **Tanda 5: Errors** = `infrastructure`: un grupo por negocio, salud, filtros por faceta, sobre `vistaDeErrores`.
- Cada una: capturas lado a lado en `docs/admin/copia/` y borrar su pantalla vieja.
