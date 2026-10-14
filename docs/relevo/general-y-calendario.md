# Relevo — General personalizable, los pagos de Mauricio y el Calendario

**Al 14/10/2026 (~04:30), claude2.** Lo escribe el chat que hizo el trabajo (primera mano). Lo que costó está en los
hallazgos de cada área; acá va qué quedó, dónde y qué espera.

## Los pedidos (textuales)

**13/10:** «Dale, arrancá con el Calendario, pero que sea en otra tab, no en GENERAL. Soluciona las cosas que pidió
Mauricio con la tab GENERAl y los cobros... Y te pido que la tab GENERAL sea personalizable... Hazla personalizable.» Y:
«Que hayan templates de tab general. Y que se puedan crear más de una, e incluso asignarles ofertas y/o funnels.»

**14/10, de madrugada** (las «vistas» del 13/10 no eran lo que pedía):
«La personalización que hiciste en GENERAL es nula... Mirá que tienes de donde inspirarte, pero no lo hiciste...
Tenemos un constructor de landing y gráficos para poder personalizar la tab general... Que todo sea personalizable,
intenta replicar lo que tenemos en dashboard, solo que claro, aquí no hace falta tantos gráficos y tiene otro objetivo
la tab... también crea templates... Me imagino una que diga "Bienvenido NOMBRE..." Los bloques también deberían ser
editables.» — «Por otro lado, el calendario quiero que sea una copia fiel a Google Calendar, y que refleje todas las
tareas y eventos que se tienen en google calendar.» — «Piensa en todos los bloques que un usuario, con los diferentes
funnels que tenemos y en general, todo lo que un usuario podría llegar a querer ver en una tab general, para hacer el
editable». Decisiones suyas en el chat: tareas de Google «Sólo eventos por ahora» (las Tasks, después de la
verificación de Google); escribir en Google «Sí, como Google».

## Qué quedó

| Qué | Dónde | Lo que hay que saber |
|---|---|---|
| /general = el editor del Dashboard | `app/general/`, `lib/general-piezas.ts`, `lib/general-plantillas.ts` | Su informe por persona (`general.informe.<sub>`). Doce bloques de General como elementos (se mueven, se duplican, se les cambia el título); «Tu funnel hoy» y «A quién cobrarle» se atan a un funnel. Plantillas: la General de siempre, Bienvenida («{{saludo}}, {{nombre}}»), Operación diaria (el caso de Mauricio), Foco, una por tipo de funnel y Ventas. Las vistas del 13/10 se retiraron. |
| Calendario = copia de Google Calendar | `app/calendario/`, `lib/calendario-google*.ts` | Día, semana, mes, año, agenda y 4 días; todos los calendarios de Google con sus colores; crear, mover, cambiar y borrar eventos en Google (con «avisar a los invitados» y Deshacer). La agenda no pasa por ninguna IA. |
| Pagos atípicos | `app/crm/[id]/deal-actions.ts`, `DealDetailsCard.tsx` | Un pago de menos ya no borra la diferencia: queda pendiente o es descuento. «Registrar otro pago». |

**Estado de git (14/10/2026, ~04:30).** El Calendario (`acea2449`) y General (`56efcbaa`, más su cosecha) están
commiteados en el main del clon y **NO pusheados**: el push lo coordina el orquestador y el pre-push pide 5,3 GB libres
(había 2,9). Los tests de lo tocado, en verde (editor, General, Calendario, API de MaKo y los guards transversales); el
typecheck angosto de los archivos tocados, limpio. **Después del deploy, falta verlo en ws3**: /general (Nueva hoja con
las plantillas, Bienvenida con el nombre, los bloques y su panel con el funnel) y /calendario con un Google conectado.

Hallazgos: `docs/hallazgos-objectives.md` (General), `docs/hallazgos-crm.md` (pagos), `docs/hallazgos-calendario.md`.
Bitácoras: `/admin/dev/general`, `/admin/dev/crm`, `/admin/dev/calendario`.

## Lo que espera a Martín

- **Mauricio no tiene su hoja armada**: no se escribió nada en su workspace. Su caso es la plantilla «Operación
  diaria» (Prioridades del Plan, A quién cobrarle, leads nuevos): un clic en «＋ Nueva hoja» de su General.
- **Las tareas de Google** (Google Tasks): pendientes de la verificación de Google, con el scope `tasks.readonly`
  (los pasos, en `docs/hallazgos-calendario.md`).
- **Quién ve el Calendario**: hoy sólo el admin (dibuja la agenda de Google del negocio).

## Lo que quedó sin hacer (con su archivo)

Ver la sección «Lo que quedó sin hacer» de cada hallazgo. Lo más grande: los bloques de General no obedecen los filtros
de la hoja, sólo los gráficos (`app/general/piezas.tsx`); el Today del teléfono no mira el informe de General
(`app/m/hoy`); y el Calendario no tiene la entrega de servicio de CS ni las sesiones de la comunidad (`lib/calendario.ts`).
