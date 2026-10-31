# Clients y MaKo Partners — el diseño (17/10/2026)

Chat jefe «Clients» (cuenta 4). Rama `clients`, worktree `C:/dev/wt-clients`. Este documento dice QUÉ había, QUÉ se
decidió y POR QUÉ; lo aprendido construyéndolo va a [hallazgos-customer-success.md](hallazgos-customer-success.md)
(el área es la misma: el código sigue en `app/customer-success/`).

## El pedido (Martín, 17/10/2026, textual)

> «Quiero unificar completamente la tab de "Cursos" con "Comunidad" y con "Clientes" y que la tab en la sidebar se llame
> "Clients" y que esté dentro de la sección "Operate"... Como lo tiene Skool, con una tab más de "Classroom", pero quiero
> conservar el diseño de la tab CURSO que tenemos, es más, quiero que el diseño de la comunidad tipo Skool que hicimos se
> parezca a lo que hicimos en CURSO, y que sea personalizable... Y también deberías crear una tab de "Agencia": para este
> caso, diseña la tab de "MaKo Partners" con todo lo que habíamos dicho y planeado... Y ahí deberían vivir los clientes de
> agencia, que no son los mismos que "client": podrían serlo como no... Eso se debe poder configurar en el CRM: si un
> usuario se unió al programa de "MaKo Partners", que le aparezca la opción en el CRM para llevarlos allí...»

## Lo que había (relevado el 17/10 sobre origin/main 70276424a)

| Qué | Dónde | Cómo se ve |
|---|---|---|
| **Clientes**: el kanban de la ENTREGA por producto (+ Tabla + Avance) y la ficha en un modal | `/customer-success` → `app/customer-success/page.tsx`, `ClientesApp.tsx` | piel de la app (réplica del CRM, decisión del 05/10) |
| **Curso**: el editor del curso de cada producto | `/customer-success/curso` → `curso/CursoApp.tsx` sobre `app/_cursos/CursoUgc.tsx` | el diseño de Conocimientos: barra oscura, papel crema, tinta, lima, bordes de 2 px y sombra dura |
| **Comunidad** tipo Skool, una por producto: Comunidad · Calendario · Miembros · Ranking · About | `/customer-success/comunidad` → `app/_comunidad/Comunidad.tsx` | dos pieles por tokens: el equipo con la de la app, el alumno con la del curso |
| El **estilo de cada curso**: color, fuente, portada, título (mig 0214, `curso_estilo`) | `lib/curso-estilo.ts` | lo eligen en el menú de la marca del Curso; lo ve el alumno |
| El **portal del alumno** (curso + comunidad como entrada de la barra) | `/compartido/curso/<token>`, `/mi-curso` | el del curso |
| El **teléfono**: tres pantallas | `app/m/cs`, `app/m/curso`, `app/m/comunidad`; el proxy sirve /m con la misma URL (`lib/movil-rutas.ts`) | |
| **Agencias**: ser agencia es el PLAN (`workspaces.capa = 'agencia'`, `esAgencia`); su cartera (`agencia_clientes`, mig 0175); las altas que pide (0178); el lead del que salió cada cuenta (`leads.cliente_ws`) | `lib/agencia*.ts` | adentro de Clientes: «Abrir cuenta / Inspeccionar» (`CuentaDeMaKo.tsx`), la pestaña Equipo de la ficha, el chip del plan |
| **El cobro del cliente de agencia** (#866, #867, Pagos): US$47 por mes, el link del primer mes al abrirle la cuenta, el mes corre desde que termina el onboarding y ahí nace la renovación | `lib/agencia-cobro*.ts`, `lib/agencia-habilitar.ts`, mig 0308 | en la tarjeta de Clientes: «Pagar su mes», «Activar renovación» |
| **Referidos / Partners**: el programa DECIDIDO el 10/10 | `docs/referidos.md` | **sin aplicar**: nada está construido ni prometido a nadie |

## Las decisiones

### D1. Una tab «Clients», dentro de Operate, con las sub-tabs de un grupo de Skool

**Clients · Community · Classroom · Calendar · Members · Leaderboards · About.** Las de Skool en su orden (sin Map, que
no tenemos), y adelante **Clients**: el kanban de la entrega. Va primero y es la que abre porque la tab SE LLAMA Clients
—entrar y ver a tus clientes es lo que el nombre promete— y porque es el trabajo de todos los días. **Members** sigue
siendo lo que es en Skool (las personas de la comunidad, con su nivel y si están en línea); no se fusiona con el kanban:
son dos preguntas («¿en qué etapa está?» y «¿quién participa?») y fusionarlas obligaba a elegir cuál pierde.

> ⚠️ **SUPERADA el 29/10/2026** (Martín: «unificar la tab de clientes con la tab de miembros… Son lo mismo, no deberían ser dos
> tabs»). Members es la vista «Miembros» del selector de Clients (Kanban · Lista · Miembros · Avance) y `/classroom/members`
> redirige a `/classroom/clients?vista=miembros`. Ninguna de las dos preguntas perdió: cada una es una vista. Detalle en
> [hallazgos-customer-success.md](hallazgos-customer-success.md) → «Clients y Members, UNA sub-tab».

### D2. Las rutas nuevas, y el código donde estaba

`/clients` · `/clients/community` · `/clients/classroom` (+ `/clients/classroom/preview`, la vista del alumno) ·
`/clients/calendar` · `/clients/members` · `/clients/leaderboards` · `/clients/about`.

Las viejas **redirigen** con su query (y su `?ws=`): `/customer-success` → `/clients`, `/customer-success/curso` →
`/clients/classroom` (`?vista=avance` → `/clients?vista=avance`, como antes), `/customer-success/curso/vista` →
`/clients/classroom/preview`, `/customer-success/comunidad` → `/clients/community`. Los mails, los avisos y los links de
la API ya mandados siguen andando.

**El código NO se muda de carpeta.** 157 archivos nombran `app/customer-success` (imports, tests, comentarios) y tres
áreas lo tocan en paralelo (Pagos, CRM, Automations): mover la carpeta era un diff enorme que choca con todas. La carpeta
es interna; la URL es `/clients`. Cada `page.tsx` viejo pasó su cuerpo a `pantalla.tsx` y quedó como redirect; la página
nueva monta esa pantalla. Una sola pantalla, dos URLs → nunca dos copias.

### D3. La cabecera de Clients: el programa, como el grupo de Skool

Arriba a la izquierda, el **programa** (el curso del producto: su nombre, su color, su fuente y su portada chica); con
varios, un desplegable que cambia `?producto=` para TODAS las sub-tabs. Abajo, la fila de sub-tabs (se desliza de costado
en el teléfono, como en Skool). La pinta es la del CURSO: papel, tinta, la pestaña activa con el acento del programa,
borde de tinta y sombra dura.

### D4. La comunidad con el diseño del curso, y personalizable

La comunidad del equipo deja la piel de la app y toma **la del curso** (la misma que ya veía el alumno), con **el color
y la fuente del programa**. «Personalizar» (en la cabecera, sólo un admin) cambia color y fuente, y es **el mismo ajuste**
que el menú de la marca del Classroom y el portal del alumno: uno solo por programa (`curso_estilo`). Sin migración.

### D5. Las pestañas de la comunidad no viajan al server

Community, Calendar, Members, Leaderboards y About son UNA página (`/clients/[seccion]`) y la comunidad ya tiene sus
datos: cambiar entre ellas es `history.pushState` (Next lo integra a `usePathname`), sin pedir el RSC de nuevo. Desde
Clients o Classroom, en cambio, es una navegación (otra pantalla, otros datos).

### D6. El teléfono

Una sola fila «Clients» en More (familia Operate, como la sidebar) que abre la de Clients; Curso y Comunidad se llegan
desde ella. Las rutas nuevas se sirven con las pantallas de /m que ya existen (`rutaMovil` / `rutaEscritorio`).

### D7. MaKo Partners: `/partners`, sólo para quien se unió al programa

Quién entra: un workspace **agencia** (`esAgencia`: unirse al programa es que el super admin le ponga el plan Agencia,
por invitación, como dice docs/referidos.md §3) y el super admin. Cualquier otro va a /clients. (La ruta `/agencia` ya es
«WhatsApp de MaKo».)

Lo que hay adentro, con lo que YA existe:
- **Clients**: las cuentas de MaKo de los clientes de la agencia — nombre, plan, estado (espera aprobación / aprobado /
  revocado), el cobro (pagar su primer mes, activar la renovación), su equipo, «Inspeccionar» y «Sumar a alguien». Y
  «+ Nuevo cliente»: abrirle la cuenta a un lead de tu CRM o a alguien nuevo.
- **Program**: cómo funciona, en tres líneas y con los números de verdad (el precio por cliente lo dice la plataforma,
  el mes corre desde que termina el onboarding, la renovación es mensual).

⚠️ **Lo que NO se dibuja: los premios por referir** (el primer mes de cada cliente, el saldo, la plata para revendedores).
Está decidido pero no construido; ponerlo en la pantalla es prometerle a un cliente algo que el sistema no paga. Entra el
día que exista el cálculo (docs/referidos.md, «Cuándo»).

### D8. Los clientes de agencia salen de Clients

«No son los mismos que client: podrían serlo como no». La cuenta de MaKo de un cliente vive en Partners; en la ficha de
Clients queda sólo «En MaKo Partners →» cuando ese cliente tiene cuenta. Abrir una cuenta deja de exigir que el lead
sea ganado.

### D9. El CRM: «Llevar a MaKo Partners»

Lo pone el chat CRM (sus archivos), sólo si el workspace es agencia: en el menú de un lead y en la ficha. El núcleo es
de acá (`llevarAPartnersAction` + el modal). Si el lead ya tiene cuenta: «Ver en MaKo Partners».

### D10. La API de MaKo

Los links de las áreas `cs` y `curso` pasan a /clients. Área nueva `partners`: ver la cartera y llevar a un lead (el canal
propone, la persona confirma).

## Coordinación

- **Sidebar** (chat «Sidebar»): ordena la barra. Clients = key `customer-success`, href `/clients`, en Operate; MaKo
  Partners = key `partners`, href `/partners`, sólo agencia. Las keys `cs-curso` y `cs-comunidad` salen de la barra.
- **CRM**: la opción del D9. **Pagos**: el cobro sigue siendo suyo; acá sólo se REUSA.
