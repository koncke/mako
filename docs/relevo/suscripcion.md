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
| (24/10) MaKo Partners en el menú de la foto para el admin de CUALQUIER negocio: arriba lo que vende la idea, después el panel; el super admin, el programa entero y las agencias; el teléfono, los referidos | `app/_components/nav.ts` · `app/partners/PresentacionPartners.tsx` · `resumenDelPrograma` · `app/m/partners/ReferidosM.tsx` |
| (24/10 noche, chat «Planes», claude5) La tab de MaKo Partners es la LANDING hasta que el admin toca «Unirme» (le crea el código); después, el panel. La landing con la ficha de lo que se gana, la calculadora y las preguntas; la misma en /mako-partners y adentro, con los colores de la app | `app/mako-partners/LandingPartners.tsx` · `Calculadora.tsx` · `codigoSiExiste` · `unirmeAPartnersAction` |
| (25/10, «Planes») Partners paga meses Y dinero: el que se suscribe deja su primer mes como crédito, el Acelerador US$300 en efectivo (20% de cada cuota), en la landing, la calculadora, el panel y el teléfono. La comisión NO la registra el libro: el pedido del Acelerador llega con el código del partner y el equipo la anota y la transfiere (`COMISION_HOY`) | `comisionDelAcelerador` · `COMISION_HOY` · lib/partners-reglas.ts |
| (24/10) /planes con los tres bloques (Esencial, Pro destacado, el Acelerador por llamada) y «Compara los planes» desde los topes del código; sin el anual | `app/planes/Vitrina.tsx` · `lib/planes-comparacion.ts` · `PROGRAMA_ACELERADOR` |
| (24/10 noche, «Planes») /planes y la landing con LOS MISMOS tres bloques, sin lenguaje interno; el Acelerador como el acompañamiento (bloque oscuro, todo lo que trae); la promesa del programa, decidida el 25/10 (fila de abajo) | `app/planes/Tarjetas.tsx` · `PROGRAMA_ACELERADOR.promesa` |
| (25/10, «Planes», decidido por el Cerebro: memoria `decisiones-venta-25-10`) El Acelerador con PROMESA (90 días, el embudo andando) y GARANTÍA DE ENTREGA (si en la semana 1 el embudo no está armado, se devuelve la cuota); los entregables con tope (10 horas la semana 1, 12 asesorías). /reembolsos §2 lee la misma frase. Su página pide un diagnóstico de 2 minutos (3 preguntas del diagnóstico de fase, una por pantalla) que queda en el historial del lead y en el mail a equipo@ | `PROGRAMA_ACELERADOR` · `HORAS_SEMANA_1` · `app/reembolsos/page.tsx` · `PREGUNTAS_DE_LA_PUERTA` · `app/planes/[plan]/QuieroPlan.tsx` |
| (25/10, «Planes») /planes y la landing con el selector Mensual/Anual (2 meses gratis: 470 y 970; el anual SIEMPRE se pide y se da de alta a mano), la garantía de 14 días en el mensual y 30 en el anual (también /reembolsos §1), «Desde Argentina pagas en pesos, con Mercado Pago» y el precio en pesos sólo si el plan lo tiene; Esencial con el media buyer que propone 2 recomendaciones por día (tope `ads.recomendaciones_dia`, que hace cumplir el chat «Media Buyer») | `app/planes/Tarjetas.tsx` · `GARANTIA_DIAS` · `botonAnualDelPlan` · lib/topes-plan.ts |
| El onboarding según la landing | `lib/origen-negocio.ts` · `app/onboarding/page.tsx` |

## Lo que falta, en orden

> ⚠️ **ALTAS A MANO (las primeras ventas del 25/10 son por llamada):** los topes de cada plan y el candado de las tabs de Pro
> se hacen cumplir SÓLO a quien paga por la pasarela (`esEsencialPorPasarela`, lib/plan-esencial-reglas.ts). Un Esencial
> dado de alta a mano recibe MÁS de lo que dice la tabla de /planes: sin topes y con Ads Manager, Image, Video y AI Avatar.
> El alta del super admin («Nuevo cliente») lo avisa. Si hay que cerrarlo para las altas a mano, es esa regla.

1. **Migración 0330** (aditiva): la aplica el Cerebro en producción ANTES del deploy, con su OK.
2. **Prender el corte** (`CORTE_DE_ACCESO_PRENDIDO` en `lib/plan-acceso-reglas.ts`): después de la revisión adversarial y con la
   0330 aplicada. Con el corte apagado la deuda se VE (aviso y /cuenta-pausada) pero nadie se pausa.
> **24/10, Martín: «No voy a usar Calendly».** El punto 3 de abajo (conectar Calendly) QUEDÓ SIN EFECTO para la venta: la
> landing y /planes ya no llevan a ninguna agenda. Sin pasarela, el botón de cada plan lleva a /planes/<plan>, donde la
> persona deja nombre, email y WhatsApp y queda como lead en el CRM de MaKo con el plan, el origen y el código de partner
> (`pedirPlanSinPasarela`, lib/compra-plan.ts), con aviso a equipo@. Se le da de alta a mano. Lo que sigue para cobrar en
> línea es lo de docs/estrategia-financiera-mako.md: Paddle o Creem para el mundo, Mercado Pago en pesos para Argentina, y
> el Acelerador nunca por un merchant of record.

3. (Sin efecto desde el 24/10, ver arriba.) **Martín**: en `hola-mako.com/integraciones?ws=9` → Calendly, pegar un «Personal access token» de la cuenta koncke
   (calendly.com → Integrations & apps → API and webhooks → Generate new token) y en «Tipo de evento de R1» el NOMBRE del
   evento de koncke/asesoria tal cual figura en Calendly (no el slug `asesoria`: el ruteo compara el nombre o la URI).
   Medido el 23/10: el ws 9 no tiene credenciales ni ruteo de Calendly, así que ninguna reserva de la agenda de MaKo crea
   un lead. **Eso solo no alcanza:** el aviso (la suscripción de webhook) no tiene pantalla en Calendly ni en MaKo; se crea
   con el token por la API, y pide un plan pago de Calendly (si la cuenta es gratuita, NO hay aviso posible: el plan es el
   backfill). **Y lo agendado antes no entra solo** (Calendly no reenvía avisos viejos y ningún cron lee la agenda).
   Con el token pegado, en este orden (desde un worktree con `.env.local`; sólo el 3 y el 5 escriben; los scripts rechazan cualquier
   argumento que no reconocen, así que `--ws=9` va junto):
   1. `node --conditions=react-server --import tsx scripts/arreglar-webhook-calendly.ts --ws=9 --simulacro` — MIDE: qué
      avisos a MaKo tiene la cuenta y si Calendly los apagó.
   2. `node --conditions=react-server --import tsx scripts/backfill-calendly.ts --ws=9 --desde=2026-10-01 --simulacro` —
      cuántas reservas de la asesoría quedaron afuera y qué haría con cada una (CREA / COMPLETA / NADA).
   3. Con el OK de Martín (escribe en SU Calendly): el mismo arreglo sin `--simulacro`. Si el aviso lo creó otro usuario de
      Calendly, o la organización tiene tipos de evento que rutean a OTRO negocio, frena y dice por qué: con `--reemplazar`
      lo borra, sabiendo que le quita las reservas a ese otro.
   4. Ver /integraciones?ws=9: Calendly sin ámbar. **Eso NO prueba que las reservas lleguen** (sólo token + R1 + aviso sano):
      la prueba es UNA reserva de prueba en la asesoría que aparezca como lead en el ws 9, y cancelarla.
   5. El backfill sin `--simulacro`. Las reservas de tipos de evento vinculados a una etapa las salta y las lista (cargarlas a mano).
   **Dos manos sobre los dos scripts (23/10):** el `--ws`, `--simulacro` y `--reemplazar` son de este chat (35eb66fc7); sin `--ws` hacen exactamente lo de antes (ws 1 y el token de `.env.local`). El chat de Agenda («varias cuentas
   de Calendly», fase B parte 1: ee1abc6a9) no los tocó; si su parte 2 los toca, su versión manda y esto se funde sin
   pelear. Después, la pasarela de MaKo. Hasta entonces (23/10) /planes, /planes/<plan> y «Pasar a
   Pro» en «Tu plan» llevan a la agenda con las UTM, y se vende por llamada (hallazgos: «Sin pasarela, el checkout era un
   callejón»); al conectarla vuelven solos al pago en línea. Además, en Stripe, Billing › Revenue recovery › Retries (Smart
   Retries) y qué pasa al agotarlos (recomendado: dejar la suscripción `past_due` o cancelarla; MaKo pausa igual a los 7 días);
   y si cobra en pesos, cargar `preciosLocales` del plan en el setting `planes.mako`.
4. **El origen, ACORDADO con «Landings de MaKo en Web Generator»** (23/10): vive en `cuenta.origen` (app_settings del negocio
   nuevo), lo escribe su alta (efb194eb1: `cobros.origen` del checkout gana, si no el primer toque del lead) y lo lee
   `lib/origen-negocio.ts`. **Cuando /planes esté en producción, avisarle a ese chat**: hoy el CTA de sus landings es la agenda
   (Calendly), y pasa a `/planes/<plan>?landing=<slug>&avatar=<x>&funcionalidad=<y>`.
5. MaKo Partners: APLICAR el crédito en la suscripción del partner y el beneficio del que llega (hallazgos-partners).
   **Desde el 24/10 ninguna pantalla promete que el crédito se usa** (decisión del Cerebro: «no promete nada que no vayamos
   a cumplir»): dicen que queda registrado y que todavía no se descuenta solo (`CREDITO_HOY`, lib/partners-reglas.ts), y no
   ofrecen la comisión del Acelerador. Al aplicar el crédito o registrar la comisión, cambiar `CREDITO_HOY` y el texto de
   /mako-partners junto con la regla.
6. **El código de partner en una venta POR LLAMADA (medido el 23/10, con todas las letras):** fuera del checkout en línea,
   el código SE PIERDE DEL TODO en la base. Desde el 23/10, quien llega por /r/<código> y agenda lleva el código a Calendly
   como `utm_source=mako-partners&utm_campaign=<código>` (queda en la reserva; en el lead, cuando la agenda entre al ws 9,
   que hoy NO entra). Quien llega de palabra, o cierra con «Vender un plan», /pagar/<token> o «Nuevo cliente» en /admin,
   NO deja código en ninguna tabla. Si alguien reclama una comisión: (1) buscar su reserva en Calendly y el
   `utm_campaign`; (2) si no está, preguntarle al comprador o ver su «¿Cómo llegaste a MaKo?» del onboarding; (3)
   reconocerla con SQL, opción A o B de docs/hallazgos-partners.md («Una venta POR LLAMADA»). No hay pantalla para esto. La
   entrada de la barra para clientes comunes es del chat Sidebar (`app/_components/nav.ts`, `soloCapas: ['agencia']`).

## Decisiones tomadas sin preguntar (vara de AGENTS.md: copiar a Stripe/Paddle/los SaaS), cambiables en una línea

- Mora: 2 días sin aviso, suspensión a los 7 (`DIAS_SIN_AVISO`, `DIAS_PARA_SUSPENDER`). Los reintentos los hace la pasarela.
- La deuda queda: quien vuelve paga primero lo pendiente y después reactiva.
- Retención: 50% por 2 meses, una vez por negocio (`RETENCION`).
- Pro = capa completo, Growth = capa agencia (el 97 incluye agencia: docs/referidos.md). Las ofertas finales las pasa el Cerebro.
