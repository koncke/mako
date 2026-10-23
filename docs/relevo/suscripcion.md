# Relevo — la suscripción de MaKo y MaKo Partners (23/10/2026)

**Chat «Suscripción y Partners»** (cuenta `claude3`), abierto por el Cerebro con el pedido de Martín de los audios del 22/10
(para el domingo 25/10). Rama `suscripcion-mako-2310`, worktree `C:/dev/wt-suscripcion`. Lo aprendido vive en
[hallazgos-planes-y-cobro.md](../hallazgos-planes-y-cobro.md) → «La suscripción de MaKo de punta a punta» y en
[hallazgos-partners.md](../hallazgos-partners.md) → «El programa de referidos se automatiza».

## Qué hay

| Qué | Dónde |
|---|---|
| Los planes (Esencial 47 = capa completo, Pro 97 = capa agencia), parametrizables con el setting `planes.mako` del ws de la plataforma | `lib/planes-mako.ts` |
| El checkout público: /planes → /planes/<plan> → `POST /api/planes/comprar` → /pagar/<token>. Al pagarse, el alta de siempre crea la cuenta y manda la bienvenida | `lib/compra-plan.ts` · `app/planes/` |
| La landing manda `?landing=&avatar=&funcionalidad=&utm_*&ref=` a /planes; queda en `cobros.origen` / `cobros.ref_codigo` (mig 0330) | `lib/compra-plan-reglas.ts` |
| La deuda: cobertura por meses cobrados, mora (aviso en la esquina), impago a los 7 días, confirmación con la pasarela antes de pausar | `lib/plan-acceso-reglas.ts` · `lib/plan-acceso.ts` · `lib/plan-deuda.ts` |
| Pagar y volver: /cuenta-pausada y la esquina → `/api/plan/pagar` (factura abierta de Stripe, tarjeta en MP, cobro único por los meses, o reactivar) | `app/api/plan/pagar` · `app/cuenta-pausada/PagarPlan.tsx` · `lib/compra-plan.ts` (`reactivarPlan`) |
| La baja con retención (50% x 2 meses, una vez) | `lib/retencion-plan.ts` · `app/configuraciones/plan` |
| MaKo Partners: /r/<código>, el tablero /partners/referidos, la página pública /mako-partners, la acreditación en el cron | `lib/partners-programa.ts` · `lib/partners-reglas.ts` |
| El onboarding según la landing | `lib/origen-negocio.ts` · `app/onboarding/page.tsx` |

## Lo que falta, en orden

1. **Migración 0330** (aditiva): la aplica el Cerebro en producción ANTES del deploy, con su OK.
2. **Prender el corte** (`CORTE_DE_ACCESO_PRENDIDO` en `lib/plan-acceso-reglas.ts`): después de la revisión adversarial y con la
   0330 aplicada. Con el corte apagado la deuda se VE (aviso y /cuenta-pausada) pero nadie se pausa.
3. **Martín**: conectar la pasarela de MaKo en `/integraciones?ws=9`. Hasta entonces (23/10) /planes, /planes/<plan> y «Pasar a
   Pro» en «Tu plan» llevan a la agenda con las UTM, y se vende por llamada (hallazgos: «Sin pasarela, el checkout era un
   callejón»); al conectarla vuelven solos al pago en línea. Además, en Stripe, Billing › Revenue recovery › Retries (Smart
   Retries) y qué pasa al agotarlos (recomendado: dejar la suscripción `past_due` o cancelarla; MaKo pausa igual a los 7 días);
   y si cobra en pesos, cargar `preciosLocales` del plan en el setting `planes.mako`.
4. **El origen, ACORDADO con «Landings de MaKo en Web Generator»** (23/10): vive en `cuenta.origen` (app_settings del negocio
   nuevo), lo escribe su alta (efb194eb1: `cobros.origen` del checkout gana, si no el primer toque del lead) y lo lee
   `lib/origen-negocio.ts`. **Cuando /planes esté en producción, avisarle a ese chat**: hoy el CTA de sus landings es la agenda
   (Calendly), y pasa a `/planes/<plan>?landing=<slug>&avatar=<x>&funcionalidad=<y>`.
5. MaKo Partners: APLICAR el crédito en la suscripción del partner y el beneficio del que llega (hallazgos-partners). La
   entrada de la barra para clientes comunes es del chat Sidebar (`app/_components/nav.ts`, `soloCapas: ['agencia']`).

## Decisiones tomadas sin preguntar (vara de AGENTS.md: copiar a Stripe/Paddle/los SaaS), cambiables en una línea

- Mora: 2 días sin aviso, suspensión a los 7 (`DIAS_SIN_AVISO`, `DIAS_PARA_SUSPENDER`). Los reintentos los hace la pasarela.
- La deuda queda: quien vuelve paga primero lo pendiente y después reactiva.
- Retención: 50% por 2 meses, una vez por negocio (`RETENCION`).
- Pro = capa completo, Growth = capa agencia (el 97 incluye agencia: docs/referidos.md). Las ofertas finales las pasa el Cerebro.
