# Relevo — General personalizable, los pagos de Mauricio y el Calendario

**Al 14/10/2026 (~04:30), claude2.** Lo escribe el chat que hizo el trabajo (primera mano). Lo que costó está en los
hallazgos de cada área; acá va qué quedó, dónde y qué espera.

## Actualización 14/10/2026 noche (claude1): ayudó a «Dashboard» con el rediseño por tipo

Pedido del orquestador: repartir con el chat «Dashboard» el rediseño bloque por bloque que pidió Martín a las 14:34.
Repartido por ARCHIVO: este chat hizo los tipos con archivo propio de `app/dashboard/graficos/` (tabla, tarjetas,
dispersión, barra de proporción, tramos, paneles, barras gordas), el mapa (`MapaGeo.tsx`) y miró las 13 plantillas
enteras (sin cambiarles el layout). Todo en la rama `dashboard-bloques-general` (`C:/dev/wt-dashboard-general`), que
«Dashboard» mergea en la suya y pushea UNA vez. Lo aprendido, en `docs/hallazgos-graficos.md` → «Rediseño por tipo
con capturas (14/10/2026), mitad General». El arnés de capturas de este chat vive en `C:/Users/marti/arnes-dashboard-general/`
(fuera del repo; `entrada-plantillas.tsx` dibuja cada plantilla entera).

## Verificación 14/10/2026 ~15:55 (claude1, chat «General» nuevo)

Medido, no leído: `c23cb620` (sexta vuelta) y `78fe8132` (Dashboard sin hojas) son ancestros de `origin/main`
(`ab2641963`), y el árbol del clon está limpio. **No hay nada de General ni del Calendario a medias.**

Lo abierto, con quién lo destraba:

- **Las tareas de Google**: esperan a Google, no a código. No se pudo ver si aprobó la verificación (Claude in Chrome
  desconectado; el Gmail de las sesiones es el de Mauricio). Y `tasks.readonly` es un permiso nuevo: puede pedir otra
  ronda (el detalle, en `docs/hallazgos-calendario.md` → «Lo que quedó SIN hacer»).
- **Sin mirar en un navegador**: /calendario con una agenda real y «Prioridades del Plan» (llega con `next/dynamic`, el
  arnés no lo dibuja). Hace falta Chrome conectado.
- **Decisiones de Martín** (siguen igual): la hoja de Mauricio (un clic en «＋ Nueva hoja»), quién ve el Calendario, y si
  «A quién cobrarle» se saca del Dashboard.

## Actualización 14/10/2026 14:55 (claude2, el mismo chat; la cuenta al 95% semanal)

**General, sexta vuelta** (`c23cb620`): cada bloque y cada plantilla mirados en captura (escritorio y 364 px) y corregidos:
listas sin filas cortadas (`gb-cabe`), tarjetas que llenan el ancho, KPIs en grande, y las plantillas con el tema nuevo
«General». Lo que costó y el método del arnés, en `docs/hallazgos-objectives.md` → «General, sexta vuelta».
**Arreglo que tiene que salir YA** (`78fe8132`): `c73755ec` (en producción) normalizaba «se eliminaron todas» en la lectura
de la pantalla, y el Dashboard de quien eliminó todas sus hojas leía `hojas[0]` de una lista vacía. Ahora sólo la API y
los links leen la versión normalizada (`leerTableroVisible`).
**Sin pushear** al escribir esto: se le pidió al orquestador (Estrategia 3 CUENTAS).
**Pedido de Martín sin arrancar** (14:34): «Dale este mismo feedback al dashboard... Que rediseñe bloque por bloque y que
tenga en cuenta mobile... Tanto bloques como las plantillas.» Es trabajo grande y la cuenta estaba al 95%: lo toma el
próximo chat, con el método de la sexta vuelta (gráficos con `CuerpoGrafico` + `resultadoDeMuestra`, plantillas de
`PLANTILLAS_HOJA`). No hay un chat del Dashboard abierto.

## Actualización 14/10/2026 14:00 (claude2, el mismo chat)

**General, quinta vuelta** (`c73755ec`): los seis puntos de las 13:26 (textuales en la bitácora de General). Cada bloque con
una cosa en grande y la letra en `cqi` (se adapta a media hoja y al celular), plantillas de bloques sin tablas ni series,
las hojas se archivan (también la última) con «Archivados» al pie del desplegable, las plantillas de «¿Qué vas a crear
hoy?» como tarjetas con sombra, y la marca de MaKo sin link. **El punto 3 llegó cortado («Elimina») y se le preguntó qué
eliminar.** **En producción** (push del orquestador `fac319092..2e4b7a5d4`, deploy Ready a las 14:00). Rojo ajeno a las 13:55:
`tests/integracion-sin-salir.test.ts` por dos links del Landing Generator (`faa061ef`).

## Actualización 14/10/2026 12:50 (claude2, el mismo chat)

**General, cuarta vuelta** (`e6818ee0` + su cosecha): los 8 puntos de Martín de las 11:54 y el de las 12:05 sobre
«¿Qué vas a crear hoy?» (los dos, textuales, en app/admin/dev/general/bitacora.ts).

- Cada bloque es una tarjeta de la hoja (el marco y el título de un gráfico); adentro, losas y filas, no tarjetas.
- «Meta objetivo» (id `cabecera`) y «Acción del día» (`accion`) son dos bloques, claros; todos los bloques ofrecen
  «Fondo: Oscuro». Se borraron app/general/Cabecera.tsx y Ahora.tsx.
- Nuevos: «Tareas prioritarias» (1/3/5/10) y «Próximos deadlines». Plantillas rehechas (una pregunta cada una, de a dos
  con el mismo alto, títulos de parte, la plata y Meta en números; nueva «Anuncios»).
- Editando: Escritorio / Tablet / Celular (también el Dashboard). Crear una hoja no deja Deshacer. Las miniaturas de
  «¿Qué vas a crear hoy?» son la hoja dibujada con los componentes del editor, y cada tarjeta lleva sólo el título.

**Estado de git (13:10):** **pusheado** por el orquestador (`282173d6e..45fe2cb7f`, con `e6818ee0` y la cosecha `adf6e9c8`); el deploy estaba en Building. `npm test`: 9471 / 1;
el rojo es `tests/cobranza.test.ts` («marcar el pago CORTA lo que está en vuelo»), sobre archivos que este chat no tocó
y que estaban limpios en el árbol a las 12:41: es de HEAD, de otra sesión.

**Falta verlo en pantalla** (ws3, después del deploy): no se levantó un `next dev`, así que los altos de cada bloque y las
miniaturas salen de medir el código, no de mirarlos. Lo primero a mirar: que ningún bloque quede cortado ni con aire
abajo en las plantillas, y la vista de celular editando.

## Actualización 14/10/2026 10:40 (claude2, el mismo chat)

**Lo que se hizo después de lo de abajo** (los pedidos literales, en las bitácoras de General y del Calendario):

- **General, tercera vuelta** (`c2cda971` + cosecha `774c2882`): los 11 puntos de Martín. Bloques rediseñados con
  opciones y placeholder, las tarjetas del Plan, «OKRs», menú «Bloques de General» de a 3 con vista previa, menos
  gráficos y datos en General, sin código/MaKo/Acción; en blanco sin Editar/⋮/filtros y 8 bordes (también en el
  Dashboard). Se borró la única General guardada (la «Página 1» de la captura, ws 9), con respaldo en el scratchpad.
- **Calendario** (`184c0b37`, lo hizo un agente de este chat): sin «¿Qué vas a crear hoy?», conectar Google sin salir de
  la tab (la pieza reusable `app/_components/ConectarIntegracion.tsx`), «Agendar llamada», lo que se repite y los cobros.
  Su cosecha va en un commit propio.
- **La API de MaKo** (`0b4f318d`): referencia y snapshot regenerados con las tres operaciones nuevas.
- **Integraciones sin salir de la tab en General y el AI Analyst** (`abd91fdb`).

**Estado de git (10:40):** todo en `main` local, **NADA pusheado**: lo pushea el orquestador («Estrategia 3 CUENTAS»),
y la app se cayó dos veces en el medio (06:10 y 07:17). Si al entrar no está en `origin/main`
(`git merge-base --is-ancestor abd91fdb origin/main`), hay que pedírselo de nuevo.

**Falta verlo en pantalla** (en ws3, después del deploy): los bloques nuevos, el menú con vistas previas, los 8 bordes
y el Calendario.

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

**Estado de git (14/10/2026, 04:40).** El Calendario (`acea2449`), General (`56efcbaa`) y su cosecha (`1c262df9`,
`0caf070b`) ENTRARON a origin/main en el push del orquestador (`92a2be21..46958506`). El typecheck completo encontró
un error mío que el chequeo angosto no vio: el hito de las 03:19 de `app/admin/dev/general/bitacora.ts` sin `puntos`
(la bitácora se escribió DESPUÉS del chequeo y no estaba en su lista); lo arregló el orquestador en `46958506`. **Después del deploy, falta verlo en ws3**: /general (Nueva hoja con
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
