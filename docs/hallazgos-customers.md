# Hallazgos — Customers (/customers, el super admin)

Lo que no se ve leyendo el código de Customers: la vista de los clientes de MaKo para el super admin, con Accounts (la
grilla de administración), Billing (era /admin/cobros) y Agents (era /admin/agente) adentro. Los pedidos textuales, en
[feedback-25-10-tarde.md](feedback-25-10-tarde.md) puntos 10 y 12, y el rediseño del 26/10 abajo. Las 16 referencias de
diseño, con qué se copia de cada una, en [customers/referencias/otras-apps/LEEME.md](customers/referencias/otras-apps/LEEME.md).

## El MRR NO es el precio del plan (25/10/2026)

- Lo obvio era sumar el precio de cada plan (Esencial 47, Pro 97) y daba un número inflado. Mauricio (ws 1), Leila y
  otros tienen el plan **dado a mano**: no hay cobro, MaKo no les factura nada. El MRR que se ve sale de los **cobros
  reales de la plataforma**: suscripciones con `suscripcion_estado = 'activa'`, en dólares (`monto_usd`), sin las pruebas
  gratis (Stripe no cuenta un trial) y sin lo anulado o devuelto. Una en mora sigue contando, porque la pasarela reintenta.
- **Un cobro sin `monto_usd` no se convierte con una tasa inventada:** cuenta como «sin dólares» y la pantalla lo dice.
  Es la misma regla que en lo demás de cobros (docs/hallazgos-planes-y-cobro.md, «La moneda depende de la PASARELA»).
- **El lugar de un cliente de agencia SÍ es MRR**: lo paga su agencia (o él) a MaKo. Por eso suma en el MRR aunque no
  cuente en «Clientes activos».
- **Vive en:** `lib/clientes-plataforma-reglas.ts` (puro, testeado) y `lib/clientes-plataforma.ts`.

## El rediseño: sin plata, el dato que manda es la actividad (26/10/2026)

- **Síntoma:** Martín, al ver la primera versión: «no me gusta para nada como esta ahora». Arriba había cuatro tarjetas
  iguales, una en «US$ 0», los grupos repetidos dos veces y, abajo, la grilla vieja con su barra de filtros.
- **Lo que se midió antes de diseñar (producción, lectura):** la plataforma no tiene ni un cobro ni una cuota en `pagos`, y
  `agente_sesiones` está vacía. Todo lo de plata daba cero y lo iba a seguir dando. Lo que SÍ hay y dice quién se está
  yendo: `usuarios.ultimo_login`, la fecha del onboarding terminado y los leads de cada negocio con el último.
- **Lo que quedó (copiado de cuatro capturas, no de cuatro apps):**
  - arriba a la izquierda, lo que entra por mes (la 02 de ProfitWell). Sin plata, una línea que lo dice y «Vender un plan →»;
  - arriba a la derecha, «Para mirar»: un renglón por cliente con una etiqueta de color, el más grave primero (`paraMirar`);
  - los grupos en chips con el número adentro y la tabla con el estado en una palabra (la 04 de Baremetrics);
  - la ficha en un panel lateral, con tres datos en fila y una sola acción, «Entrar a su cuenta» (la 14 de Polar).
- **«Sin uso» exige el onboarding hecho:** uno recién dado de alta que todavía no entró está empezando, no yéndose. Eso lo
  dice «Sin empezar», y sólo después de `DIAS_SIN_EMPEZAR` días.
- **Un dato que no se pudo leer no se dibuja en cero:** cada lectura falla sola (`conAviso`). Sin la actividad, «sin uso» no
  se afirma de nadie (`actividadLeida`), y arriba se dice qué faltó.
- **La grilla de administración (AdminView) pasó a la pestaña Accounts,** sin filtros nuevos. «Administrar» en la ficha
  lleva a `?tab=accounts&cuenta=<ws>`, que abre su ficha (`abrirInicial`). ⚠️ Es `?cuenta=` y no `?ws=`, porque `?ws=` hace
  mirar a ese cliente.

## La barra del super admin (26/10/2026)

- `noEnPlataforma` (nav.ts, lib/nav-visibilidad.ts) saca «MaKo Partners» y «Agency Dashboard» de SU barra y de su More, y
  los negocios los siguen viendo. Lo de esos programas que él mira está en Customers (los chips Partners y Agencies).
- **La trampa del teléfono:** una fila de More `superAdmin` va siempre oculta, y `masCompleto` se salteaba toda tab que
  tuviera fila en `SECCIONES_MAS`. Customers, que es una tab de la familia Sales, desaparecía del More del super admin.
  Ahora esas filas no la frenan, y la tab se dibuja con `filaDeItem`, que la lleva a /m/customers por `rutaMovil`.

## Billing y Agents: las rutas viejas quedan como redirect, con su guard (25/10/2026)

- `/admin/cobros` y `/admin/agente` redirigen a `/customers?tab=billing` y `?tab=agents`. Antes del redirect preguntan
  `getSesionAdmin`: un redirect no se le ofrece a cualquiera. El contenido vive en `Contenido.tsx` de cada carpeta.
- **Sus entradas de `HERRAMIENTAS` (nav.ts) quedan**, aunque salieron del menú de la foto: el teléfono abre `/m/cobros` y
  `/m/agente` por su key (`lib/movil-rutas.ts`). Si se borran, el teléfono las pierde sin dar error.
- `/customers` está también en `SOLO_ADMIN` del proxy: dos cerrojos, y además el de cada action.

## Lo que quedó SIN hacer

- **El MRR mes a mes de verdad:** lo que se dibuja es lo COBRADO por mes (las cuotas pagadas de la plataforma). El MRR
  histórico necesita una foto por día que nadie guarda todavía.
- **Las fichas de agencia con sus clientes adentro** (la 11 de HighLevel): hoy la agencia y sus clientes son filas sueltas
  en sus chips.
- **Administrar desde el teléfono** (cambiar el plan, el equipo): queda en la computadora.
