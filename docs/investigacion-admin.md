# La tab Admin copia UNA app: el dashboard de Polar (reescrito el 6/11/2026)

**La fuente es una sola: [polarsource/polar](https://github.com/polarsource/polar)**, el dashboard con el que Polar
administra un SaaS que vende por suscripción (licencia **Apache-2.0**, commit `72aa1109` del 5/11/2026). Se porta su CÓDIGO
archivo por archivo: cómo reparte las secciones, qué hay en cada página, en qué orden y cómo funciona cada cosa. Sólo se
reemplazan sus llamadas a la API por las lecturas de MaKo. Avisos: `lib/avisos/LICENSE-POLAR` y `lib/avisos/NOTICE-POLAR`
(qué se tomó y que se modificó, como pide la Apache-2.0).

## Por qué una sola, y por qué ésta

- **Las dos versiones anteriores se rechazaron, y por la misma razón: mezclaban.** La primera tomaba ideas de doce apps y las
  dibujaba con los componentes de MaKo. La segunda (Studio Admin, MIT) portó un template de demos sobre la navegación que ya
  existía y dejó adentro las pantallas viejas: tres lugares para el perfil, los usuarios en tres lugares y el ingreso mensual
  en Customers. Martín, el 6/11/2026: «borres todo… copia por completo… no es solamente el diseño, es también las
  funcionalidades… cómo distribuyen cada página… seas criterioso».
- **Studio Admin es un template: no reparte nada.** Trae pantallas de muestra sueltas (un CRM, unas finanzas, unos usuarios)
  y la distribución la tenía que inventar alguien. Polar es una aplicación de verdad para administrar un SaaS con
  suscripciones, en producción con miles de negocios: el reparto (qué va en Customers, qué en Sales, qué en Analytics, dónde
  viven las personas) ya está resuelto y probado.
- **Su licencia deja copiar el código** (Apache-2.0, leída de su LICENSE, con su copyright «Polar Software Inc») y **su stack
  es el de MaKo**: Next 16, React 19, Tailwind 4, Radix, Recharts 3, TanStack Table 9, motion 12, cva y tailwind-merge, en las
  mismas versiones mayores (MaKo tiene Next 16.2 y React 19.2; Polar, 16.4 y 19.3: nada de lo portado usa lo nuevo).
- **Lo que no se pudo copiar, y por qué, está dicho:** su letra «PP Neue Montreal» es una fuente comercial (no está bajo la
  licencia del repo): se usa Inter, la que Polar declara de respaldo. Su sistema de diseño (Orbit) arma `Box` y `Text` con
  StyleX, un plugin de Babel que MaKo no tiene: se reescribieron como CSS con los mismos valores. Los íconos de Material
  salen de los trazos de @mui/icons-material (MIT), sin cargar MUI.

## Cada sección es la de Polar

La barra de Polar, en el orden que pidió Martín, y sin su barra de arriba, su logo, el selector de organización ni la cuenta
del pie: el perfil y el modo oscuro viven en la barra de MaKo, que es UNA.

| Sección de Admin | En Polar (`…/dashboard/[organization]/(header)/`) | Qué es en MaKo |
|---|---|---|
| Overview | `(home)` | La portada: ingresos, actividad, los que más pagan, los en riesgo y lo que espera a Martín |
| Customers | `customers` (Overview, Top Customers, At Risk, Cost Drivers) y la ficha `customers/[customerId]` (Overview, Usage, Events, Members) | Un customer es un NEGOCIO. Members es el ÚNICO lugar de las personas |
| Analytics | `analytics` (Metrics, Events, Costs) | MRR e ingresos mes a mes; todo lo que pasa (pagos, lo que hizo MaKo, errores y reportes, las sesiones de los agentes); el gasto de IA |
| Sales | `sales` (Orders, Subscriptions, Checkouts, Disputes) | Cada pago con su recibo; las suscripciones con su historia; los cobros pendientes; los contracargos |
| Products | `products` (Catalogue, Checkout Links) | Los planes; «Vender un plan» |
| Finance | `finance` (Income) | El libro de lo que entró, con su exportación |
| Settings | `settings` | Los datos del recibo y los interruptores de cobros |

Lo de Polar que MaKo no puede llenar (Discounts, Benefits, Meters, Payouts, Taxes, Account, las métricas de checkouts y de
cancelaciones por motivo…) se sacó sin dejar hueco; lo que MaKo necesita y Polar no tiene no se inventó. Las dos listas, con
su porqué, están en [relevo/nube-admin-polar.md](relevo/nube-admin-polar.md).

## Cómo se porta (lo que gobierna una página nueva)

- **El código de Polar vive en `app/admin/_polar`** (Orbit en `orbit/`, packages/ui en `ui/`, `atoms/`, y lo del web en
  `web/<carpeta de Polar>/`) y **las páginas en `app/admin/(polar)/<ruta de Polar>/`**, un grupo de rutas: las otras subrutas
  de /admin (/admin/dev, /admin/ui, /admin/approvals, /admin/operaciones…) son otras tabs y no llevan este layout. Cada
  archivo nombra su original. Para portar uno se usa el mismo reescritor de imports (lo explica el relevo).
- **Cada página = un `page.tsx` de server que pregunta `exigirSuperAdmin()` antes de leer** y una vista pura que recibe todo
  por props (lo que Polar pide con un hook en el navegador, MaKo lo lee en el server). Los tipos de MaKo viven en
  `app/admin/_polar/datos/<sección>.ts`, con datos de ejemplo ficticios para las capturas en `datos/ejemplo/`.
- **El tema va limitado a `.pl`** (`app/admin/_polar/polar.css`): las rampas `gray`, `blue`, `red`, `green` y `polar` de Polar
  resuelven con sus mismas clases de Tailwind adentro de Admin, y el oscuro es el de MaKo (`data-tema="oscuro"`).
- **Los portales van al contenedor de adentro de `.pl`** (`portalPl()`): en `<body>` se dibujarían sin colores.
- **Cada dato vive en un lugar.** El gráfico de ingresos, sólo en Overview y en Analytics › Metrics. Las personas, sólo en
  Customers › <negocio> › Members (la búsqueda ⌘K las encuentra y lleva ahí).

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

