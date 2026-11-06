# La tab Admin copia UNA app: Studio Admin (reescrito el 5/11/2026)

**La fuente es una sola: [arhamkhnz/next-shadcn-admin-dashboard](https://github.com/arhamkhnz/next-shadcn-admin-dashboard)
(Studio Admin, licencia MIT, demo https://studio-admin.arhamkhnz.com).** Se porta su CÓDIGO archivo por archivo: el shell
(sidebar, cabecera, búsqueda, modo), el tema, los componentes de `src/components/ui`, las tablas, los gráficos y las
animaciones. Commit de referencia: `036631e` (5/11/2026). El aviso de la licencia: `lib/avisos/LICENSE-STUDIO-ADMIN`.

## Por qué una sola, y por qué ésta

- **La versión anterior se rechazó.** Esta página decía qué tomaba «la estructura» de doce apps, la mayoría sin abrir (la nube
  bloquea docs.stripe.com, posthog.com y compañía), y la pantalla se dibujó con los componentes de MaKo. Martín, el 5/11/2026:
  «está horrible… como ya te lo he pedido muchas veces, copies tanto el diseño como la funcionalidad de alguna otra
  aplicación o repositorio de GitHub. Tenés prohibido pensar por tu propia cuenta y hacerlo vos solo, porque lo haces mal».
  Mezclar fuentes ES pensar por cuenta propia: alguien elige qué pieza de qué app va al lado de cuál.
- **Studio Admin trae, como pantallas enteras, las seis secciones de Admin** (la tabla de abajo), con el mismo shell para
  todas. Ninguna otra app abierta las tiene juntas.
- **Su licencia deja copiar el código** (MIT, leída de su LICENSE) y **su stack es el de MaKo**: Next 16, React 19,
  Tailwind 4, `radix-ui`, `recharts` 3, `lucide-react`, `class-variance-authority`. Se sumaron `@tanstack/react-table` 9,
  `cmdk`, `date-fns` y `cn`, como en su `package.json`. `lucide-react` es la 0.562 de MaKo (Studio usa la 1.x): cada ícono que
  usan las pantallas portadas existe en la 0.562 (se comprobó uno por uno).
- **Se pudo levantar y comparar.** La demo no abre desde la nube (el proxy contesta 403), así que se clonó el repo y se levantó
  en local: las capturas de `docs/admin/copia/` son las dos apps lado a lado.

## Cada sección es una pantalla de Studio

| Sección de Admin | Pantalla de Studio (`src/app/(main)/dashboard/…`) | Estado |
|---|---|---|
| Revenue | `default`: las cuatro tarjetas, «Customer Activity» y la tabla de clientes | portada (tanda 1) |
| Users | `users`: filtros, ocultar columnas, exportar, lista o grilla, selección | portada (tanda 1) |
| Billing | `finance` (Dashboard, Accounts, Transactions) y los recibos con `invoice` | por portar |
| Customers | `crm`, y la ficha de un cliente con `profile` | por portar |
| Activity | `analytics`, con sus pestañas | por portar |
| Errors | `infrastructure`: un grupo por negocio, salud, filtros por faceta | por portar |

Lo que la pantalla de Studio trae y MaKo no puede llenar se saca; lo que MaKo necesita y Studio no tiene no se inventa: las
dos listas, con su porqué, están en [relevo/nube-admin-copia.md](relevo/nube-admin-copia.md).

## Cómo se porta (lo que gobierna una sección nueva)

- **El código de Studio vive en `app/admin/_studio`** (`components/ui`, el shell, el tema) y cada sección en su carpeta
  (`app/admin/usuarios`, `app/admin/ingresos`…), con los nombres de archivo de Studio. Cada archivo nombra su original y el
  aviso de la licencia.
- **El tema va limitado a `.sa`** (`app/admin/_studio/studio-theme.css`), con los valores de Studio sin tocar uno, y su
  oscuro es el de MaKo (`data-tema="oscuro"`). Las variantes de shadcn (`data-open:`…) valen sólo adentro de `.sa`.
- **Los portales de radix van al contenedor de adentro de `.sa`** (`portalSa()`): en `<body>` se dibujan sin colores.
- **Nada de `app/_ui` ni de `app/admin/estilos.ts`** en estas pantallas, salvo el Link de MaKo (lleva el `?ws=`) y «Reportar a
  Soporte» (todo aviso de error lo lleva). Lo fija `tests/admin-studio.test.ts`.
- **Lo que en Studio se dibuja y no hace nada, acá anda**, con piezas del MISMO repo (el «Hide» de Users es el «Toggle columns»
  de su tabla de tareas; «Customize» es el «Sort» de su tabla de clientes). Nunca con una pieza de otra app.
- **Los datos van después de la copia**: primero la pantalla igual, después las cuentas de MaKo en sus piezas.

## Las cuentas (se conservan de la versión anterior)

Las cuentas estaban bien y no cambian: `vistaDeIngresos` (lib/admin-ingresos.ts y lib/admin-ingresos-reglas.ts),
`vistaDeActividad` (lib/actividad.ts), las personas (lib/admin-usuarios-reglas.ts), los errores (lib/admin-errores.ts), los
recibos y las operaciones de la API de MaKo. Lo que sigue es su definición, medida el 5/11/2026.

**Por qué el Revenue de antes no mostraba nada** (medido el 5/11): el MRR salía de `cobros` (la pasarela), que tenía 2 filas
pendientes; todo lo que Martín cobró entró a mano y vive en `pagos` del CRM de la plataforma, con `suscripcion_monto_usd`
vacío en los tres clientes. Desde el 5/11 se separan **el MRR** (la suscripción) y **el cash** (lo que entró).

**Las cuentas** (las mismas en ChartMogul, Baremetrics, Lago y Tidemill). Se compara el MRR de cada cliente al cerrar el mes
con el del mes anterior:

| Movimiento | Regla |
|---|---|
| Nuevo | antes 0, y nunca pagó |
| Volvió | antes 0, y ya había pagado alguna vez (Baremetrics: «una suscripción nueva de un cliente que había cancelado») |
| Subió | ahora más que antes, con antes > 0 (subir de plan o un segundo lugar) |
| Bajó | 0 < ahora < antes. Sacar uno de varios lugares es bajar, no cortar (ChartMogul, Lago) |
| Se cortó | ahora 0 |

MRR al cerrar = MRR al empezar + nuevo + volvió + subió − bajó − se cortó. En qué se diferencian las apps:
- Lago no tiene «volvió»: un cliente que vuelve le cuenta como «subió».
- ChartMogul deja elegir cuándo se corta: al cancelar o al terminar el período pagado.
- Stripe cuenta como MRR las suscripciones `past_due` (atrasadas).

**Lo que se decidió para MaKo, y por qué:**
- **El monto de cada mes es lo que pagó, no el precio del plan** (decisión del 25/10, hallazgos-customers.md). Un pago a mano
  registrado como la mensualidad cubre un mes desde su fecha. Uno nuevo REEMPLAZA al anterior desde ese día: así sube o baja.
- **Dos pagos a menos de 7 días son UN cobro.** Código pagó noviembre en dos (94 el 4/11 y 144 el 5/11): es una mensualidad de
  US$238, no dos meses.
- **La gracia es de 15 días, como el `past_due` de Stripe.** Quien paga tarde sigue contando (atrasado). Si renueva adentro de
  la gracia no hubo corte. Pasada la gracia, el corte se anota el día que venció (el «al terminar el período pagado» de
  ChartMogul).
- **Lo suelto no es MRR.** Un pago suelto, el diferencial de un cliente nuevo o una venta de pago único suman al cash y al
  total del cliente, nunca al MRR (decisión de Martín: el MRR no infla lo cerrado).
- **El LTV proyectado no se muestra.** Clerk lo calcula como MRR promedio dividido por la tasa de corte, y con 3 a 20
  clientes ese número es ruido. Se muestra lo cobrado de verdad.

