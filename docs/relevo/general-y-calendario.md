# Relevo — General personalizable, los pagos de Mauricio y el Calendario

**Al 14/10/2026, claude2.** Lo escribe el chat que hizo el trabajo (primera mano). Lo que costó está en los
hallazgos de cada área; acá va qué quedó, dónde y qué espera.

## El pedido (13/10/2026, textual)

«Dale, arrancá con el Calendario, pero que sea en otra tab, no en GENERAL. Soluciona las cosas que pidió Mauricio con
la tab GENERAl y los cobros... Y te pido que la tab GENERAL sea personalizable... Que los usuarios puedan elegir que
ver, si quieren ver "Prioridades" del PLAN, como el caso de Mauricio, las cuotas a cobrar... Otros querrán ver su
objetivo, etc etc... Hazla personalizable.» Y en el mismo turno: «Copia lo que ya tenemos en muchos lugares con
"TEMPLATES" y la opción de IA de "¿Qué vas a crear hoy?"... Que hayan templates de tab general. Y que se puedan crear
más de una, e incluso asignarles ofertas y/o funnels.»

## Qué quedó

| Qué | Dónde | Lo que hay que saber |
|---|---|---|
| /general por VISTAS | `lib/general-vistas-modelo.ts`, `app/general/` | Por persona (`general.vistas.<sub>` en app_settings). La vista por defecto suma «A quién cobrarle» (lo prometido a Mauricio). Plantillas y «¿Qué vas a crear hoy?». Sólo dos bloques filtran por funnel; los demás dicen «Todo el negocio». |
| Pagos atípicos | `app/crm/[id]/deal-actions.ts`, `DealDetailsCard.tsx` | Un pago de menos ya no borra la diferencia: queda pendiente o es descuento. «Registrar otro pago» para lo que no es una cuota. |
| Calendario | `/calendario`, mig 0271 (aplicada), `lib/calendario*.ts` | Cinco capas; sólo lo propio se guarda. La IA no ve la agenda. Área `calendario` en la API de MaKo. Onboarding que se hace usándola. |

**Estado de git (14/10/2026, ~02:45).** Nada de esto está en producción todavía. Los tres commits (8396e4a6,
ba199cb4, b202da4e) quedaron integrados con origin/main en el merge `20334eb0`, y el push lo hace el orquestador
(«Estrategia 3 CUENTAS»), uno solo y con todo junto, por pedido de Martín: «que se pushee todo y que los chats cierren».
En ese merge se resolvió el cruce con Graphics: los dos chats habían movido «A quién cobrarle» a General. Quedó la
`Cobranza` de Graphics (`app/general/Cobranza.tsx`) como el bloque de las vistas, recortada a los funnels de la vista,
y `CobranzaGeneral.tsx` se borró. Vacía, la vista de fábrica no la dibuja; una vista que armó la persona, sí. Los tests
de lo tocado dieron 325/325. El typecheck completo no corrió: no hubo RAM (el piso es 5,3 GB y había 3,8), así que lo
corre el pre-push del orquestador. **Después del deploy, falta verlo en ws3**: /general (vistas, plantillas, IA,
alcance), /calendario y la pestaña Pagos del CRM (pago de menos, «Registrar otro pago»).

Hallazgos: `docs/hallazgos-objectives.md` (General), `docs/hallazgos-crm.md` (pagos), `docs/hallazgos-calendario.md`.
Bitácoras: `/admin/dev/general`, `/admin/dev/crm`, `/admin/dev/calendario`.

## Lo que espera a Martín

- **Mauricio no tiene su vista armada**: no se escribió nada en su workspace. Su caso es la plantilla «Operación
  diaria» (Prioridades del Plan, A quién cobrarle, Tu funnel hoy, Leads sin marcar): un clic en «＋ Nueva vista».
- **Quién ve el Calendario**: hoy sólo el admin (dibuja la agenda de Google del negocio). Si un closer tiene que ver
  sus llamadas, es una decisión: una capa sin Google.

## Lo que quedó sin hacer (con su archivo)

Ver la sección «Lo que quedó sin hacer» de cada hallazgo. Lo más grande: los cinco bloques de siempre de /general no
filtran por funnel (`lib/vista-general.ts`), el Today del teléfono no mira las vistas (`app/m/hoy`), y el Calendario
no tiene la entrega de servicio de CS ni las sesiones de la comunidad (`lib/calendario.ts`).
