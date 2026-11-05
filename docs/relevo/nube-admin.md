# Relevo — la tab Admin (nube, 5/11/2026)

> Lo escribe la sesión de la nube que hace el encargo [admin-encargo.md](admin-encargo.md) (cuenta `nube`, sesión
> `cli_efae8d7b-8598-5f74-a2e3-3aef4e3f73e1`). Se reescribe en cada tanda. Lo de Martín, textual, está en el encargo y en la
> bitácora del área (app/admin/dev/admin/bitacora.ts).

## Lo que ya está subido

| Tanda | Qué | Punta |
|---|---|---|
| 1 | La investigación (docs/investigacion-admin.md). La tab se llama **Admin** y vive en `/admin`; abre en **Revenue** con lo cobrado de verdad. | `punta/admin` |

## Lo que le toca al Cerebro (en producción, que la nube no ve)

1. **Cargar lo de noviembre de Código Inmobiliario** en su ficha del CRM de la plataforma (lead 2474), como dos pagos
   «Mensualidad» con medio Binance: US$94 el 4/11 y US$144 el 5/11. Con eso Revenue muestra MRR US$432 y «Subió +US$92». Si el
   chat de la suscripción en la ficha (`punta/suscripciones-ficha`) ya cambió cómo se registra, se carga como diga su relevo.
2. **Mirar Revenue en producción** cuando la punta llegue a main: `/admin`. Lo esperado con lo medido el 5/11 (sin noviembre
   cargado): MRR US$340, cobrado en octubre US$340, tres clientes al día y lo que viene: Florencia el 18/11, Leila el 26/11 y
   Código el 21/11. Si un número no da, lo primero es ver si esos pagos están con `pagado = true` y `fecha_pago`.
3. **Si alguno de los tres no tiene `leads.cliente_ws`** (su cuenta de MaKo), Revenue lo muestra con «sin cuenta en MaKo» y
   lleva a su ficha del CRM en vez de la del negocio. Se arregla vinculando la cuenta desde la ficha del cliente.

## Lo que supuse (sin `docs/relevo/admin-medicion.md`, que todavía no llegó a main)

- Que los pagos de los tres están en `pagos` del negocio de la plataforma con `es_mensualidad = true` (lo dice el encargo de la
  suscripción). Si alguno es una cuota del plan, igual cuenta: la cuota del plan de un lead de suscripción es recurrente.
- Que `fecha_pago` es el día que entró la plata (no el de la cuota esperada).

## Con quién se cruza

- **`punta/suscripciones-ficha`**: si cambia cómo se guarda una suscripción, en Revenue cambia una sola función,
  `esRecurrente` (lib/admin-ingresos.ts). Las cuentas no saben de dónde sale cada pago.
- **`punta/recibos`**: todavía no existe en origin. Cuando esté `app/admin/cobros/RecibosMako.tsx`, se monta en Billing.
  Esta sesión no movió `app/admin/cobros/` (sólo cambió dos links a `/admin?tab=billing`).

## Lo que falta (las tandas siguientes)

- **Users:** las personas de todos los negocios con su estado de alta, último ingreso, inspeccionar y suspender.
- **Errors:** `errores_app` agrupado como Sentry, con los tickets al lado.
- **Activity y Usage:** necesitan medir qué pantallas se abren y qué acciones se hacen (hoy sólo hay `ultimo_login`). Va con una
  migración nueva: el número se confirma al aplicar.
