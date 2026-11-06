# Relevo — Las promesas a la agencia de Thiago (nube, 6/11/2026)

Lo escribió una sesión en la nube (`cli_91316e17-68c8-5ad6-b41d-9daaf694e7b4`, firma `nube`) sobre su propio trabajo.
El pedido, textual, está como hito `prompt` en `app/admin/dev/crm/bitacora.ts`. La llamada y la lista de promesas:
[docs/promesas/2910-llamada-thiago.md](../promesas/2910-llamada-thiago.md).

Rama: **`punta/thiago-migrar`** (y la de la sesión, `claude/jolly-heisenberg-a4g00x`, con lo mismo).

## Lo que quedó hecho (tanda 1: migrar el CRM y el token de agencia)

| Promesa | Qué hay | Dónde | Test |
|---|---|---|---|
| 2. `createLead` con UTM, fecha original e id externo, sin repetir | `id_externo`, `migrado_de` y `fecha_original` (mig 0405). El mismo id dentro del mismo CRM viejo tira `LeadYaMigradoError`, aunque venga `permitirDuplicado`; un índice único es la red de dos altas a la vez | `lib/leads.ts`, `lib/migracion-leads.ts` | `tests/migrar-contactos.test.ts` |
| 3. Migrados quietos | `origen_lead: 'migracion'`. El barrido de las automatizaciones nunca toma un migrado (`sinMigrados` en `leadsDeCohorte`, una puerta para todas las cohortes) y el CRM automático no lo mueve (`quedaDondeLoPusieron`). Entra a una automatización sólo por un hecho nuevo, por el evento de siempre | `lib/nutricion.ts`, `app/crm/origen-lead.ts` | ídem, roto tres veces |
| La operación | `migrar_contactos` = `POST /api/v1/crm/migraciones`: hasta 200 por pedido, cada uno nace en su etapa abierta, el que ya estaba por email o teléfono se adopta (se le anota el id), repetir es seguro, y la respuesta dice cuántos se crearon, cuántos ya estaban, cuáles quedaron afuera y por qué. Sólo `http`, sólo admin, aplica el tope de leads del plan | `lib/api-mako/areas/crm.*`, `lib/migracion-leads-server.ts` | ídem, contra el código real |
| 4. Token de agencia | `mako_agt_…`, acuñado en la cuenta de la agencia eligiendo como propietario «Todos los clientes de la agencia». Cada pedido nombra al cliente con `X-MaKo-Cliente` (o `?cliente=`); se repregunta en cada pedido que siga siendo agencia y que el cliente esté aprobado. 404 a un cliente ajeno, revocado o pendiente; 400 sin cliente (con la lista); 503 si la base no contesta; nunca cae a la agencia | `lib/api-mako/tokens-cartera*.ts`, `lib/api-mako/http.ts`, `app/api-mako/Tokens.tsx` | `tests/api-mako-token-agencia.test.ts` (dos agencias) |
| 1. La guía | «Migrar tu CRM con Claude», la primera de «Guías» en /api-mako → Documentación | `app/api-mako/Articulos.tsx`, `articulos-meta.ts` | `tests/api-mako-migrar-crm-guia.test.ts` |
| De rebote | `proponer_leads` aplicada por un token ya no tira las UTM | `lib/api-mako/flujo.ts` | `tests/migrar-contactos.test.ts` |

Subido: `punta/thiago-migrar` en `cd28bbaf26` (veredicto verde: 9.021 tests y el tsc entero).

## Lo que quedó hecho (tanda 2: el Calendario)

| Promesa | Qué hay | Dónde | Test |
|---|---|---|---|
| 5b. Reuniones del equipo | Closers y setters entran al Calendario SÓLO a «Llamadas», arrancando en las suyas (las que llevan como closer o como setter); el admin filtra por persona (`?persona=`). No ven la grilla (la agenda de Google del dueño), ni los cobros, ni los objetivos, ni el Plan. Computadora y teléfono. API: `llamadas_del_equipo` (GET /api/v1/calendario/llamadas) | `lib/calendario-llamadas.ts`, `lib/calendario-equipo-server.ts`, `app/calendario/*`, `app/m/calendario/*` | `tests/calendario-equipo.test.ts` (4 roturas) |
| 5a. Email programado | Un evento Email se enlaza a un email de Email Marketing y queda programado a esa hora, con el `preparar`/`ejecutar` de `programar_broadcast` (resumen antes, y vuelve a revisar). Mover el evento mueve el email; soltarlo lo vuelve a borrador. Un plan sin Email Marketing no lo hace. API: `enlazar_email_calendario` (pantalla, sólo admin) | `lib/calendario-email*.ts`, `app/calendario/EnlazarEmail.tsx`, mig 0406 | `tests/calendario-email.test.ts` (4 roturas) |

## Lo que pide producción (lo hace el Cerebro desde la PC, con el sí de Martín)

1. **Aplicar la 0405 ANTES del deploy, o junto** (`node scripts/apply-migration.mjs supabase/migrations/0405_leads_migracion.sql`).
   Sin ella, `migrar_contactos` contesta «falta la migración 0405» y no crea nada; ningún otro alta nombra esas columnas.
   Medido: 0405 libre en main, en las ramas y en las etiquetas el 6/11 (la 0404 la tomó main ese día: los carruseles).
2. Probarlo en el ws 3 con un token detallado: un lote de 3 contactos dos veces (el segundo tiene que decir «ya entraron»).
3. Para la llamada con Thiago: su cuenta tiene que ser Agency (capa `agencia` y su fila en `agencias`) y sus clientes aprobados
   en la cartera, o el token de agencia contesta 403/404.
4. **Aplicar la 0406 ANTES del deploy, o junto** (`supabase/migrations/0406_calendario_email_enlazado.sql`): la columna del
   email enlazado. Sin ella, el modal dice que falta un cambio en la base y no toca nada. Libre en main, ramas y etiquetas el 6/11.
5. Probar en el ws 3: entrar como closer a /calendario (abre en sus llamadas, sin la grilla), y en un Email del futuro elegir un
   borrador y «Programar a esta hora» con el envío apagado (queda programado y no sale).

## Lo que espera una decisión de Martín

- **Los ganados y perdidos del CRM anterior.** Hoy vuelven en `descartados`: nacer en «Ganado» los vuelve venta con la fecha
  de HOY y cliente de Customer Success. Para traerlos hace falta decidir con qué fecha de cierre y si entran a Customer Success.
- **Los paneles cuentan a un migrado el día que se migró** (5.000 «leads nuevos» ese día). Se guarda `fecha_original`;
  contarlo en su fecha es usar `coalesce(fecha_original, created_at)` en los lectores de leads por período.
- **El tope de 120 pedidos por minuto es por cliente**, así que un token de agencia puede sumar más en total. Es lo mismo
  que con 27 tokens sueltos; si se quiere un tope por agencia, se suma en `autenticar`.

- **El anuncio programado (5a, la mitad que falta).** Hoy una campaña nace EN PAUSA (`proponer_crear_campana`) y no hay
  «fecha de inicio». Programar un anuncio es empezar a GASTAR a una hora: no se escribió desde la nube. El camino que
  recomiendo: el evento Anuncio se enlaza a una campaña en pausa del Media Buyer y, a la hora del evento, un cron la prende
  por `lanzar` (lib/media-buyer/ejecutar.ts: zona, fecha de fin, topes), con la misma revisión adversarial de todo lo que
  gasta. La alternativa (pasarle a Meta un `start_time` al crearla) depende de que Zernio lo acepte, y eso no está medido.
- **La reserva de Google Calendar como etapa (6).** Choca con tu decisión del 7/10 («la agenda no pasa por la IA»): el CRM
  automático NO escribe datos de Google en la ficha porque después los leen los análisis con IA (`conGoogle: false` en
  lib/crm-auto.ts), y Google no deja identificar sus páginas de reserva (`AVISO_GOOGLE_AGENDA`, app/crm/vincular-etapa.ts):
  cualquier evento con el lead invitado contaría como reserva. Lo que propongo: que la reserva NO se escriba sola, sino que
  quede como confirmación para una persona («Juan reservó el 10/11 a las 15: ¿lo paso a Agendó R1?»), como el botón
  «Automático» de la ficha, que ya lee Google porque decide una persona. ¿Así, o preferís que se escriba sola?

## Lo que se sabe y no se ve en el código

- Un lead migrado que se manda a la papelera y se vuelve a migrar choca con el índice único al restaurarlo.
- Todo /api/v1 toma el negocio de `auth.ctx.ws`. Un camino nuevo que lea `auth.token.ws` vuelve a abrir la AGENCIA.
- El hallazgo largo de cada parte: `docs/hallazgos-crm.md` («Migrar desde otro CRM»), `docs/hallazgos-api-mako.md`
  («El token de agencia») y `docs/hallazgos-calendario.md` («Las reuniones del equipo y el email enlazado»).
- Abrir el Calendario a closers y setters cambió seis tests de la barra (sidebar, More, el hueco del teléfono, la puerta del
  loader, la query): una tab más para un rol vuelve a moverlos.
