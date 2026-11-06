# Hallazgos — Agency Dashboard (/agency)

Lo que no se ve leyendo el código de Agency Dashboard: la agencia que abre las cuentas de MaKo de SUS clientes, las
administra y elige quién paga cada una. El pedido textual, en [feedback-25-10-tarde.md](feedback-25-10-tarde.md) punto 9.
La historia anterior de la cartera (de cuando vivía en /partners), en [hallazgos-partners.md](hallazgos-partners.md) y
[hallazgos-customer-success.md](hallazgos-customer-success.md); la seguridad del «Entrar como», en
[hallazgos-seguridad.md](hallazgos-seguridad.md) → «Vista de agencia».

## ⚠️ La marca de «ya le avisé» era TAMBIÉN el permiso para pausarlo, y se escribía antes de tener el PDF (6/11/2026)

**Vive en:** `lib/agencia-mes.ts` (`corridaDeUnaAgencia`, paso 2, y `lecturaParaPausas`), `lib/agencia-mes-avisos.ts` (nuevo),
`tests/agencia-mes.test.ts`. Encontrado auditando el primer cobro real del 9/11 ANTES de que saliera; no llegó a pasar.

El aviso de la entrada de un cliente se manda una sola vez, y lo que lo cuida es un renglón en `app_settings` de la
plataforma: `agencia.mensualidad.<ag>.avisoentrada.<cliente>.<día>`. El paso 2 del cron lo reclamaba **antes** de armar el
PDF y lo soltaba sólo en la rama del `else` de `r.ok`:

```ts
for (…) if (await cambiarSettingSi(claves[i], null, valores[i])) ganadas.push(i);   // ① reclama
if (ganadas.length) {
  const pdf = await pdfDelCobro(tabla, m.hoy, m.agencia);                            // ② puede TIRAR
  const r = await mandarPdfAlGrupoDeLaAgencia(…);                                    // ③ puede TIRAR
  if (r.ok) entradas = ganadas.length;
  else { ok = false; for (const i of ganadas) await borrarSettingSi(…); }            // ④ sólo con ok:false
}
```

**El diagnóstico obvio era el equivocado.** Leído como un dedup, ① antes de ② es un detalle de orden: se manda un día
después y no pasa nada. No es un dedup: ese MISMO renglón es el que `lecturaParaPausas` convierte en
`avisoEntrada: true` (`lib/agencia-mes.ts`), y `quienVaEnPausa` **sólo pausa al cliente que recibió el aviso** —la regla
«lo que no se le dijo no se exige», que tiene su test—. O sea que el renglón cierra dos puertas a la vez:

1. el aviso queda filtrado **para siempre** (`porAvisar` descarta lo que ya tiene marca): no se reintenta ni mañana ni nunca;
2. el cliente queda en «Paga para entrar» el día de su vencimiento, por una entrada que **nadie le mandó**.

Y `④` no cubría ninguno de los dos caminos por los que se llega ahí, porque los dos **tiran** en vez de devolver
`ok: false`: `cambiarSettingSi` tira con cualquier error de la base (así que una base que falla al reclamar la segunda
marca deja la primera puesta sola, sin mandar nada), y `pdfDelCobro` / el envío tiran antes de contestar. El `catch` de
`avisarMensualidades` los agarraba a los dos y devolvía `ok: false` con el error — **con las marcas puestas**.

- **La regla que queda: lo que se manda se arma ANTES de reclamar la marca, y la marca se suelta también cuando algo TIRA.**
  Vive en `reclamarYMandar` (`lib/agencia-mes-avisos.ts`), con la base inyectada, y es lo que hay que usar para todo aviso
  de cobro que se mande una sola vez. El paso 1 (la mensualidad del mes) ya lo hacía bien —`pdfDelCobro` antes de
  `avisarUnaVez`—, y `avisarPausasNuevas` también —escribe la marca **después** del envío—: el paso 2 era el único al revés.
- **Una marca de idempotencia que además es un permiso se suelta con `try/finally`, no en una rama del resultado.** Mientras
  un renglón signifique dos cosas («no lo repitas» y «ya se le avisó»), escribirlo de más no demora un aviso: autoriza una
  pausa. Si alguna vez conviene separarlas, son dos renglones.
- **Probado rompiéndolo:** con el `try/catch` sacado y la suelta sólo en el `else` del `ok` (el código de antes), la base da
  **2 rojos de 42** — «el envío TIRA» y «la base TIRA al reclamar la segunda». Con el arreglo, 42 / 0.

⚠️ **Lo que esto NO cubre:** que `pdfDelCobro` tire sigue cortando la corrida entera de esa agencia (el `catch` de
`avisarMensualidades`), así que ese día tampoco se revisan sus pausas. Es el lado conservador a propósito —la regla 3 dice
que un error nunca suspende— pero significa que un PDF roto deja a la agencia sin aviso Y sin pausas hasta que se arregle.

## Nadie avisaba que una agencia no pagó: la pausa se veía, el impago no (#498, 6/11/2026)

**Vive en:** `lib/agencia-mes-reglas.ts` (`textoDeMesImpago`, puro), `lib/agencia-mes.ts` (paso 4 de `corridaDeUnaAgencia`,
`avisarAMartin`), `tests/agencia-mes.test.ts`.

El día 6 sin el total del mes, la agencia y sus clientes quedan en pausa, y al grupo de la agencia le llega
`textoDePausaDelMes`. A Martín, nada: `avisarAMartin` ya existía, pero sus únicos llamadores eran los del lector de
comprobantes (dudoso, otra moneda, falla de lectura). Una agencia podía quedar meses sin pagar sin que se enterara nadie,
porque el único lugar donde se veía era una pantalla a la que hay que entrar.

- **La pausa no es el aviso.** Pausar es automático y silencioso para el que no está mirando; el que decide qué hacer con
  una agencia que no paga (esperar, llamar, dar de baja) necesita que el dato lo busque a él. Son dos cosas distintas y
  cada una tiene su destinatario: el grupo de la agencia y el grupo del super admin.
- **`avisarAMartin` devuelve ahora si LLEGÓ** (`grupo || campanita`). Antes era `Promise<void>` y se comía los dos errores:
  marcar «ya avisado» un aviso que no salió por ningún canal es perder el único aviso de que una agencia no pagó. El aviso
  va por `avisarUnaVez`, así que un canal caído suelta la marca y mañana se reintenta.
- **Se avisa pasado el límite, no el día del límite** (`m.hoy <= p.limite` no avisa): el 5 todavía se puede pagar. Y en
  seco (`?dry=1`) no se avisa nada.

## La guarda que faltaba: la plataforma era un cliente de agencia alcanzable (#495, 6/11/2026)

**Vive en:** `lib/agencia-cobro-reglas.ts` (`clienteDeAgenciaTocable`, puro), `lib/agencia-baja.ts`, `lib/agencia-plan.ts`,
`tests/agencia-cobro.test.ts`.

El pendiente decía que estas guardas estaban en la rama `agency-thiago-2910` y había que portarlas. **La premisa era
falsa**: la rama ya está mezclada en `main` (`git merge-base --is-ancestor` da sí, y el diff va al revés: main tiene +89
líneas que la rama no). Tres de las seis cosas que el pendiente pedía ya estaban (`aplicarSubidasPendientes` con
`.limit(2000)`, H5 aceptando `cubierto`, la pausa programada pidiendo al-día). Las otras **no estaban en ningún lado**:
nunca se escribieron.

- **Lo único que había entre una agencia y la cuenta de la plataforma era una AUSENCIA.** `darDeBajaClienteDeAgencia`
  validaba enteros positivos y `agenciaWs !== clienteWs`, y después leía `agencia_clientes`; `cambiarPlanDeCliente` no
  validaba **nada**. Con una fila apuntando `cliente_ws` al workspace de la plataforma, la baja llegaba a
  `cancelarSuscripcionCobro` y `anularCobro` sobre los cobros de la plataforma y la dejaba pausada con el corte
  `sin-agencia`. No es alcanzable desde la app de hoy —`abrirCuentaDePartner` siempre crea un workspace NUEVO, y es el
  único `insert` a esa tabla—, pero lo que lo evitaba era que la fila no existiera, no una guarda.
- **La regla que queda: lo que vale es la guarda de ADENTRO, no la ausencia del dato de afuera.** `clienteDeAgenciaTocable`
  es pura, corre ANTES de leer la cartera (el test lo fija comparando las posiciones en el archivo) y la contesta el mismo
  error que «no es de tu agencia»: a una agencia no se le dice cuál es el ws de la plataforma.
- **`wsSuperAdmin()` cae a 9 si no encuentra la fila `capa = 'superadmin'`**, así que el número se resuelve afuera y se
  pasa: la guarda no adivina. Un 9 de más es un falso positivo que no cobra de menos.
- **Lo que sigue SIN hacer, y lo vi de paso:** `negocioPausado` (`lib/workspace.ts`) no exime al ws1 ni a la plataforma —si
  queda `pausado` con un corte `paga-para-entrar` vigente, el super admin se queda afuera de la herramienta con la que
  arreglaría el cobro—; y `darDeBajaClienteDeAgencia` consulta `tienePlanPropioVivo` **después** de haber cancelado y
  anulado (es deliberado, para que un reintento no pause a quien ya paga su plan, y está comentado: no lo toqué).

## La mensualidad de una agencia: 14 días sin costo y un pago por mes, por fuera de MaKo (5/11/2026)

**Vive en:** `lib/agencia-mes-reglas.ts` (lo puro, con `tests/agencia-mes.test.ts`), `lib/agencia-mes.ts` (leer, escribir, avisar),
`app/agency/Mensualidad.tsx`, `app/api/cron/agencia-mensualidad/route.ts`, `supabase/migrations/0402_agencia_cobra_desde.sql`.
El acuerdo con Código Inmobiliario (30/10/2026): su plan + el de cada cliente, 14 días sin costo desde la invitación, baja antes de
los 14 días no se cobra, un pago por mes del 1 al 5 por Binance. MaKo calcula y avisa; no cobra.

- **No es el cobro por pasarela de `lib/agencia-cobro-reglas.ts`** (el link de Mercado Pago del primer mes, la renovación desde el
  onboarding, Stripe en Europa). Ese sigue para las agencias que pagan con tarjeta. Mezclarlos le avisaría «paga por Binance» a quien
  ya paga por Stripe: por eso la mensualidad está **apagada por defecto y se prende por agencia** (`agencia.mensualidad.<ws>.config`
  en la plataforma). ⚠️ Hasta que alguien la prenda en el negocio 13, no pasa nada.
- ⚠️ **REEMPLAZADO EL 6/11/2026 (abajo, «La segunda vuelta»): el ciclo va del 5 al 5 y la entrada de cada cliente es un cobro
  aparte. Lo que sigue de este punto es historia.** El acuerdo no dice qué mes paga cada pago, y había que decidirlo. Quedó: lo del 1 al 5 es ESE mes por adelantado, por los que
  cuentan el día 1; un cliente que empieza a contar a mitad de mes suma sus días de ese mes a la mensualidad siguiente, por día
  (`COBRA_LOS_DIAS_DEL_PRIMER_MES`). Sin eso, un cliente dado de baja después de sus 14 días pero antes del día 1 siguiente no pagaba
  nunca, y «después ese cliente cuenta» era falso. Si Martín prefiere no cobrar esos días, es esa constante en `false`. Con la cartera
  del 5/11: noviembre da US$ 285; diciembre, US$ 527,83 si nadie se da de baja (siete meses enteros más los días de noviembre de
  Patricia, Giselle y Marcela).
- **El caso del pedido decía «Pablo y Patricia ya vencieron» separado de «Natalia cuenta», con la misma fecha para Natalia y Pablo
  (14/10).** No sale de ninguna regla: los dos cuentan desde el 28/10. Se leyó como «su plazo ya venció» y el test lo dice así. Si en
  la base Pablo tiene otra fecha o está dado de baja, la pantalla lo va a mostrar distinto, y eso es lo que vale.
- **El plan de cada cliente sale del catálogo (`planesMako()`), no de un número:** el que la agencia le eligió (por su capa) y, si
  nunca se lo eligió, Esencial. ⚠️ Las cuentas de antes del 29/10 tienen capa `agencia` (todo lo de Pro) sin elegir: cobrarles por
  capa era cobrarles Pro (US$97), y el acuerdo es US$47 por cliente (`planQueSeCobra`).
- **`cobra_desde` corrige desde qué día CORREN los 14 días, no el primer día que se cobra.** El nombre engaña y por eso está dicho en
  la migración y en el comentario de la columna. Giselle (negocio 17) va con 2026-10-28 y cuenta desde el 11/11.
- **«Pagado» guarda el total de ese momento:** una corrección o una baja posterior no reescribe un mes pagado. El de un mes sin pagar
  se calcula en vivo.
- **Los avisos se reclaman con compare-and-set antes de mandar** (`avisarUnaVez`): de dos corridas gana una. Si no salió por ningún
  lado (ni la app ni un correo), se suelta el reclamo para que mañana lo reintente; por eso el aviso del mes prueba del 1 al 5. El de
  un plazo lleva la fecha en la clave: si se corrige la fecha de un cliente, se avisa la nueva.
- **Sin push al teléfono, a propósito:** el Agency Dashboard no va en ningún teléfono (`TABS_QUE_VENDEN`), y un push que abre `/agency`
  terminaba en More.
- **La lectura tolera la 0402 sin aplicar** (PostgREST contesta 42703 por la columna): sin ella no hay corrección, y «Corregir fecha»
  dice que falta la migración. Cualquier otro error de lectura tira: «no pude leer» no es «no hay clientes».
- **El conteo literal de `tests/agency.test.ts` («seis acciones preguntan el admin») se volvió una guarda por acción:** contar dejaba
  pasar una acción nueva sin puerta si otra sumaba una llamada de más. Cada `export async function` de `app/agency/actions.ts` pasa
  por `adminDeWorkspaceActual` o por `superAdminEnLaAgencia`.

### La segunda vuelta: el PDF al grupo, el comprobante y «Paga para entrar» (6/11/2026, `punta/agencia-cobro-2`)

**Vive en:** `lib/agencia-mes-reglas.ts` (el ciclo, la entrada, `asignarPago`, `quienVaEnPausa`, `pasoDePausa`), `lib/agencia-mes-pausas.ts`
(aplica la pausa con la base inyectada), `lib/agencia-mes.ts`, `lib/agencia-mes-comprobante.ts` (el comprobante del grupo, enganchado en
`atenderEntranteDoer` de `lib/mako-doer-in.ts`), `lib/agencia-mes-pdf.ts`, `supabase/migrations/0403_comprobantes_del_grupo.sql`,
`scripts/agencia-paga-para-entrar.mts`.

- **«Paga para entrar» es un motivo de corte, no una columna nueva.** `workspaces.estado='pausado'` no cortaba nada salvo con el motivo
  `sin-agencia` (que diría «Tu agencia dejó de administrar tu cuenta»): el motivo `paga-para-entrar` corta aunque el corte general esté
  apagado (`negocioPausado`), la pasarela no lo toca (`pasoDeAcceso` → nada) y /cuenta-pausada dice «Contacta a tu agencia» sin montos.
  ⚠️ Lo propio (agencia, rol, causas) va ANIDADO en `mensualidad`: `guardarCorte` de lib/plan-acceso.ts reescribe el corte con un spread
  y un campo suelto que `leerCorte` no conociera se perdería en esa vuelta. El test lo pasa por la vuelta.
- **Quién se pausa se decide con TODO leído, o no se decide.** `revisarPausas` recibe la base inyectada: si `leer` tira, no pausa ni
  reabre nada (probado con una base que falla). Una pausa a mano (pausada sin corte) o de otro motivo no se toca, y una reactivación a mano
  se respeta (`perdonadas`): vuelve a pausar sólo una causa nueva.
- **No se exige lo que no se le dijo.** El día 6 se compara lo pagado contra lo que se avisó (o el total de hoy, si bajó por una baja), y
  sin el aviso del mes, o sin el PDF de la entrada de un cliente, no se pausa.
- **Dos entradas del mismo día cuestan lo mismo.** Pablo y Patricia en pausa el mismo día deben US$40,73 cada uno: un comprobante de ese
  monto no dice de quién es. `asignarPago` devuelve `ambiguo` y va a Martín; elegir el primero le habría abierto la cuenta al otro.
- **El comprobante del grupo se lee con la IA de la PLATAFORMA**, no la de la agencia: es el cobro de MaKo, y la agencia puede no tener
  IA. Se guarda en `comprobantes_leidos` (`origen='grupo'`, sin lead: la 0403), así el N.º de operación cuenta una vez por negocio, y la
  orden queda además en el libro (`orden.<N>`, compare-and-set) y se cruza con `reciboDePago`.
- **Lo que viaja a la pantalla de la agencia va sin el libro crudo** (`paraLaPantalla`): un prop de un `'use client'` llega al navegador.
- **Trampa del entorno (la nube):** `node scripts/tsc-acotado.mjs` contestó «NO SE PUDO CHEQUEAR (código undefined)» en este contenedor;
  el mismo tsconfig (`armarTsconfig`) corrido con `spawnSync` a mano dio 0. No es un rojo del código: el veredicto corre el tsc entero.

### Sin hacer

- Aplicar la 0402 (si falta) y la 0403, corregir la fecha de Giselle (17) al 2026-10-28, prender la mensualidad del 13 desde 2026-12 y
  pasar a 19, 22 y 15 a «Paga para entrar». En orden, en `docs/relevo/nube-agencia-cobro.md`.
- Un comprobante que llega por el grupo de la APP (no por WhatsApp) no se lee: hoy sólo el de WhatsApp.
- La pantalla se miró con datos de ejemplo (sin base en la nube), no con la cartera real.
- Un aviso al super admin cuando pasa el día 5 sin el «Pagado»: hoy sólo se ve en la pantalla y en `ver_mensualidades_agencias`.

## Joan no podía agregarse al grupo de un cliente: la puerta estaba abierta, faltaba el renglón (ticket #49, 3/11/2026)

- **Síntoma:** «no puedo ver las notificaciones dentro de la cuenta de un cliente para agregar un número de WhatsApp al
  grupo de MaKo».
- ⚠️ **El diagnóstico obvio era el equivocado:** todo apuntaba a un permiso (la tab solo-superadmin, la puerta del
  servidor, `agregarParticipanteGrupo`). Medido con la sesión de una agencia sobre el código real
  (`tests/_agencia-grupos-hijo.ts`): `getRolWsEfectivo` da `admin`, `getWorkspaceActual` da el cliente, el GET y el POST
  de `/api/perfil/destinatarios` andan, la cartera aísla y la invitación sale. **Por URL directa funcionaba.**
- **Causa real:** `seccionesCuenta` (`lib/ajustes-secciones.ts`) esconde «Notificaciones» mirando a otro, porque «los
  avisos son de quien mira». Era cierto hasta el 25/10, cuando «Notificaciones» del negocio salió del índice por estar
  dos veces y se mudó adentro de la de «Tu cuenta». El filtro siguió con su regla y dejó sin entrada a la agencia y al
  super admin. **Mudar una sección de grupo cambia para quién vale el filtro del grupo de destino.**
- **En el teléfono no hay entrada para NADIE** a `/m/configuraciones/notificaciones`: el índice sale de
  `seccionesNegocio`, que ya no la tiene. Se abrió mirando a un cliente; el resto, abajo en «sin hacer».
- **Trampa: la cookie de la agencia dura 8 horas (`AGENCIA_HORAS`) y al vencer el pedido cae, sin error, en la cuenta
  PROPIA de la agencia.** La pantalla seguía mostrando al cliente, y guardar pisaba `notif_telefonos` de la agencia y
  sumaba al cliente al grupo de la agencia. Ahora la pantalla manda de qué `ws` leyó y el server contesta 409. **Vale para
  todo guardado de agencia con la pestaña vieja:** esta ruta es la única cerrada (abajo).
- **Lo que hay que saber antes de agregarse:** el renglón agrega a `notif_telefonos`, no sólo al grupo, así que ese número
  también recibe lo que se reparte por esa lista. Y en un cliente **con la lista vacía**, el número pasa a ser el
  principal: `mako.numero_dueno`, `user_telefono` y el teléfono del comprador en el CRM de la plataforma.
- **Medido el 3/11 en producción (sólo lectura):** Joan ya está en la lista de 5 de sus 7 clientes (15, 18, 19, 20, 22). Le
  faltan Marcela (23, con grupo) y Giselle (17, sin grupo ni número). ⚠️ Florencia (21) aparece como cliente suyo en notas
  viejas y **no está en `agencia_clientes`**.

### El equipo de la agencia entra solo al grupo que nace

- ⚠️ **«Las personas del equipo que tengan teléfono» daba NADIE en producción.** El único usuario de la única agencia tiene
  `perfil.telefono` vacío; su número vive en `mako.numero_dueno` de la agencia. Con la lectura literal, el automático no
  invitaba a nadie, sin error. Por eso entran los dos: el número principal de la agencia y el perfil de cada admin. Es el
  caso de `telefonosDelEquipo` (`lib/agencia-equipo-grupo.ts`).
- **Closer y setter de la agencia NO entran, y es a propósito:** a ese grupo llegan los reportes de ventas, gasto y montos del
  cliente, y la auditoría del 14/10 cerró que un closer se sumara a él. Tampoco `notif_telefonos` de la agencia, que puede
  traer a un contador: sumarlo lo metería en todos los clientes.
- **El equipo no entra a `notif_telefonos` del cliente.** Va sólo al grupo: no le aparece en Notificaciones ni recibe sus
  reportes por DM. **Quien se agrega a mano desde la pantalla sí queda en esa lista**: son dos caminos con efectos distintos.
- **`lineaDeLaAgencia` dice lo que pasó:** «Sumé» si alguien entró, «Invité» si WhatsApp no dejó, nada si no hubo nadie. Va
  adentro de la bienvenida, un solo mensaje. Sin nombre de agencia no se afirma nada.
- **El `id` de un participante es un `@lid` que parece un teléfono:** leerlo como número daba a alguien como ausente y
  se lo volvía a agregar. El número sale de `phoneNumber`; quien no lo trae contesta 409 al agregarlo y no se anuncia.
- **El tope de la línea (5 contactos nuevos por cliente y por hora) lo comparte con el dueño.** Una agencia con 7 admins
  deja 2 afuera; el resto toma el comando, que sólo mira a quienes faltan.
- **Medido el 3/11 con el comando, sólo lectura, contra los grupos reales:** Joan ya está en 15, 18, 19, 20 y 22. Falta entrar a
  uno, **Marcela (23)**; Giselle (17) no tiene grupo y entra sola cuando nazca. Para la agencia 13:
  `node --conditions=react-server --env-file=C:/dev/mako-api/.env.local --import tsx scripts/agencia-equipo-a-grupos.mts --agencia=13 --aplicar`.
  ⚠️ Escribe en un grupo de un cliente: necesita el sí de Martín, y correrlo con el código ya desplegado.

### Sin hacer

- **Un cliente que paga él mismo puede tener el grupo antes de la aprobación:** la cartera queda `pendiente` hasta el pago
  y `agenciasAprobadasDe` no la cuenta, así que el equipo no entra y nada lo vuelve a intentar al aprobarse. La salida hoy es
  el comando; lo definitivo es llamar a `aplicarEquipoDeAgencia` desde `lib/agencia-habilitar.ts`. No medí cuántos caen ahí.
- **El admin de un negocio, en su propia cuenta y por teléfono, sigue sin entrada** a a quién le avisa MaKo:
  `app/m/cuenta/page.tsx` sólo la agrega mirando a otro, porque «Tu cuenta» ya tiene una fila «Notificaciones» y Martín ya
  marcó el duplicado una vez. Hay que elegirle un nombre.
- **La pestaña vieja en el resto de los guardados de agencia:** el corte es general (`resolverDesdeCookies`). Sólo
  `/api/perfil/destinatarios` compara el `ws`. Lo general sería renovar la cookie o avisar al vencer.

## Una función contestaba DOS preguntas, y su `null` abría la puerta (P15, 30/10/2026)

- **Síntoma:** las dos pantallas de Agency preguntaban `if (!esSuper && (await agenciaDeCliente(ws))) redirect(...)`
  (`app/agency/page.tsx:58`, `app/m/agency/page.tsx:50`). El cliente de DOS agencias entraba al Agency Dashboard.
- **Causa real, y no es «falta una guarda»:** la guarda estaba. Lo que estaba mal es **con qué preguntaba**.
  `agenciaDeCliente` contesta **QUIÉN** es el dueño, así que necesita que haya exactamente uno: con dos dueños devuelve
  `null` a propósito y bien («elegir el primero sería inventar un padre»). Arriba, ese `null` se leía como «no es
  cliente de ninguna agencia». Una función que contesta «quién» usada para preguntar «si» convierte toda ambigüedad en
  un permiso.
- **El `null` significaba TRES cosas y las tres se leían como «no»** — medido, no supuesto
  (`tests/_agency-dos-duenos-hijo.ts`, las funciones reales contra un PostgREST de mentira):

  | lo que pasaba | `agenciaDeCliente` | entraba |
  |---|---|---|
  | no tiene ningún dueño | `null` | sí (el único caso que se quería dejar pasar) |
  | tiene DOS dueños aprobados | `null` | **sí** |
  | tiene DOS dueños PENDIENTES | `null` | **sí** (`esCarteraVigente` cuenta pendiente como dueña) |
  | **no se pudo leer la cartera** | `null` | **sí** |

- ⚠️ **Y acá el diagnóstico obvio era el equivocado.** P15 estaba anotado como riesgo **latente** («hoy ningún cliente
  tiene dos agencias»), y por eso nadie lo agarró. Pero la rama que se abre con la base caída **no espera a nada**:
  `agenciasDeCliente` atrapa el error y devuelve `[]`, así que una lectura fallida ya daba `null` hoy, sin ningún
  cliente de dos agencias. Lo latente era un cuarto del hallazgo; el resto estaba vivo.
- ⚠️ **Lo que se abría NO era una fuga de datos entre clientes**, y conviene decirlo porque el 30/10 ya se dijo mal una
  vez (se infló «una guarda que falta» a «fuga») y después hubo que desdecirlo. La pantalla dibuja la cartera **del que
  mira**, que para un cliente está vacía: no hay datos de otro inquilino en juego. Lo que se rompía es la regla de
  producto («MaKo no les va a enviar promociones»): el cliente de una agencia veía el programa y podía sumarse como
  Agency. Es grave por lo que habilita, no por lo que muestra.
- **La regla que queda:** `agenciaDeCliente` **DICE**, `esClienteDeAgencia` **DECIDE**.
  - Para decidir una pantalla, un permiso o un candado se pregunta `esClienteDeAgencia` (`lib/agencia.ts`), que contesta
    sí/no/**no sé** (`boolean | null`) y no depende de que el dueño sea uno.
  - **El «no sé» no es «no»**, y por eso se compara contra `false` (`if (deAgencia !== false) redirect(...)`) y nunca por
    verdad. Un `if (deAgencia)` vuelve a leer el «no sé» como «no»: es el molde exacto del bug.
  - Un `[]` o un `null` que significan a la vez «no hay» y «no pude leer» obligan a quien decide a elegir uno, y siempre
    se elige el cómodo. Si de una lectura cuelga un permiso, el error se propaga (`leerCarteraDeCliente` devuelve `null`
    al fallar); el `[]` se queda para lo que sólo **dibuja**.
  - La lista de quién llama a `agenciaDeCliente` está **cerrada en un test** (`tests/agency-dos-duenos.test.ts`): hoy son
    tres y las tres arman un texto o una URL de salida (`lib/vista-de-otro.ts`, `lib/movil-guard.ts`, `lib/agency.ts`).
    Un llamador nuevo rompe el test, y ahí se elige si DICE o DECIDE.
- **El caso no existe en los datos, así que se arma en el test.** Esperar a que un cliente real tenga dos dueños es
  esperar a que el bug cobre. Con DOS agencias (la real, ws 13, y una de mentira): con una sola, un guard que ignore
  `agencia_ws` pasa todas las pruebas que se le hagan.
- **Trampa del entorno, nueva:** `git checkout -- <archivo>` para deshacer una rotura **borra el arreglo** mientras
  todavía no está commiteado — HEAD es la versión con el bug. En un «probá rompiéndolo» sobre trabajo sin commitear hay
  que restaurar desde una copia (o commitear primero). Perdí los dos arreglos de las pantallas así, en silencio: los
  tests volvieron a pasar porque también se había revertido lo que los hacía fallar.
- **Trampa del entorno:** un worktree nuevo no tiene `node_modules` y `ln -s` **copia** en Git Bash (con el disco al
  95% no es una opción). Va una junction de Windows: `cmd /c mklink /J <worktree>/node_modules <otro>/node_modules`,
  después de comprobar que los dos `package.json` son idénticos.

## La misma función nació DOS veces el mismo día, y el merge se vio limpio sin compilar (30/10/2026)

- **Síntoma:** mergear `nube/agency-dos-duenos` sobre el tren salió **sin un solo conflicto en el código** y el árbol no
  compilaba: `lib/agencia.ts:304 — Multiple exports with the same name "esClienteDeAgencia"`.
- **Causa real:** `esClienteDeAgencia` se escribió dos veces el 30/10, por dos chats que no se veían — acá para la
  puerta de /agency (saliendo de `origin/main`) y el 29/10 en `agency-thiago-2910` para lo que MaKo le deja de ofrecer
  al cliente de una agencia (Thiago: «yo no me meto con ese cliente»). **Los dos bloques caen en lugares distintos del
  archivo, así que git los une sin conflicto**: no hay nada que resolver y el resultado no compila.
- ⚠️ **Y el choque no era de nombre, era de CRITERIO**, que es lo que importa: la del tren devolvía `boolean` y resolvía
  «no se pudo leer» como **`false`** (su propio comentario lo decía: «No se pudo leer = no»). Para un upsell eso
  esconde de menos; **para una puerta, `false` DEJA ENTRAR**. O sea que tenía el mismo bug que este trabajo vino a
  cerrar, en la otra forma. Lo que sí tenía bien, y conviene decirlo: su `.some(esCarteraVigente)` ya contestaba bien
  con DOS dueños — lo único que colapsaba era la lectura fallida.
- **La regla que queda, y es la que decidió el Cerebro:** **UNA sola función con el tri-estado**, y **cada uso resuelve
  el `null` por el lado seguro de SU pregunta**. Medido al unificar: hay **NUEVE** usos (no cuatro) y **los nueve lo
  resuelven igual, como «sí, puede ser de una agencia»** — lo que cambia es la CONSECUENCIA, no la lectura:
  - cinco son PUERTAS y con `null` **no entra** (`app/agency/page.tsx`, `app/m/agency/page.tsx`,
    `app/partners/page.tsx`, `app/m/partners/page.tsx`, y hacerse partner por la API en `lib/partners-programa.ts`);
  - tres son UPSELLS y con `null` **no se ofrece** (`app/configuraciones/plan/page.tsx`, `app/m/mas/page.tsx`,
    `app/no-esta-en-tu-plan/page.tsx`);
  - una es la FRONTERA que alimenta a la barra (`cuentaActualEsDeAgencia`, `lib/vista-de-otro.ts`): resuelve el `null`
    ahí y sigue devolviendo `boolean`, porque lo que sale va como JSON al navegador y no puede tener tres estados.
- ⚠️ **Yo había escrito lo contrario y estaba mal.** La versión anterior de esta sección decía que para un upsell el
  `null` «no debe apagarlo», razonando que esconder una oferta también cuesta. El criterio es el opuesto: **ofrecer de
  menos por una falla de la base cuesta una venta; ofrecer de más le rompe el trato a la agencia, y eso no se
  deshace.** Queda anotado porque es la clase de cosa que se «simplifica» de vuelta.
- **Lo que lo habría cazado, y ahora existe** (`tests/agency-dos-duenos.test.ts`): que `esClienteDeAgencia` se declare
  **UNA** vez, que su tipo sea `Promise<boolean | null>`, y que los nueve usos resuelvan el `null` —con un escáner de
  paréntesis balanceados, probado contra las cuatro formas del bug, porque una regex `[^)]*` no puede leer
  `esClienteDeAgencia(await getWorkspaceActual())` y daba un falso rojo.
- ⚠️ **Trampa: el segundo rompimiento estaba tapado por el primero.** `cuentaActualEsDeAgencia` declara
  `Promise<boolean>` y devolvía la función directo: con el tri-estado eso también es un error de tipos, y **no se veía**
  porque el doble export aborta antes. Al resolver un choque así hay que buscar los consumidores que DECLARAN el tipo
  viejo, no sólo el que grita.
- **La regla general:** dos ramas pueden agregar **el mismo export** en lugares distintos de un archivo y git no lo
  llama conflicto. Si dos chats pueden estar escribiendo la misma pregunta, el guard no es el merge: es un test que
  cuente las declaraciones.

## ⚠️ P14 no vive en `main`: los archivos de plata de Agency están en otra rama (30/10/2026)

- **El síntoma:** `docs/pendientes.md` manda P14 a `lib/agencia-plan.ts`, `lib/agencia-baja.ts` y
  `lib/plan-acceso-reglas.ts`. En `origin/main` los **dos primeros no existen**, y quien los busque desde main no
  encuentra nada y puede concluir que ya se arregló.
- **Dónde está de verdad:** la rama **`agency-thiago-2910`** (punta `fb72e2e18`, worktree `C:/dev/wt-agency`). Medido:
  `git merge-base --is-ancestor 28cc3e2cb origin/main` → **NO**; el merge-base es `4b8f8145d`. El informe de plata
  (`C:/dev/revisiones/2910-reverificacion-plata-agency-28cc3e2cb.md`) y sus números de línea son de esa rama.
- **Qué hay y qué no hay en main**, para no volver a medirlo:
  - `lib/agencia-plan.ts`, `lib/agencia-baja.ts` → **no están** (ni en `origin/integracion`). La MEDIA de P14 (pausar o
    rebajar el negocio de Mauricio o un Pro directo cargado a mano en una cartera) **sólo se puede arreglar ahí**.
  - `lib/plan-acceso.ts` y `lib/plan-acceso-reglas.ts` **están, pero sin H5**: en main no hay `al-dia` ni `soltar`, así
    que las dos BAJAS de H5 (levanta el corte de más; la pausa programada no se enteró) **no existen en main**.
  - `app/agency/AgencyApp.tsx` está, con **cero** menciones de «Esencial», «Elegir Pro» y «Pasar a Pro»: la BAJA del
    diálogo de ida tampoco existe en main.
  - `lib/cobros.ts` **es el mismo**: `anularCobro` en `:1318` y `cancelarSuscripcionCobro` en `:1603`, los dos números
    exactos del informe. Lo de ahí sí se arregla desde main (abajo).
- **La regla que queda:** un pendiente que nombra archivos tiene que nombrar **en qué rama** viven si no están en main.
  Un `docs/pendientes.md` que viaja en una rama de feature describe el árbol de ESA rama, no el de quien lo lee.

## Ser agencia ERA tener el plan Pro, y nadie lo había pedido (25/10/2026)

- **Síntoma que no se veía:** `esAgencia` miraba sólo la capa `agencia`, y esa capa es la del plan **MaKo Pro de US$97**
  (`lib/planes-mako.ts`: `id: 'pro', capa: 'agencia'`). O sea que todo el que comprara Pro quedaba agencia, con su
  cartera y su botón de abrir cuentas, sin pedirlo. No había pasado porque el único con Pro es Código Inmobiliario (ws 13).
- **Lo obvio era una migración con una columna o un flag nuevo. No hacía falta:** la tabla `agencias` (mig 0176) seguía
  viva en producción con la fila del ws 13. El 27/09 se había dejado de leer porque Martín dijo que la agencia «es el
  plan». El 25/10 pidió lo contrario: «que te puedas sumar como "Agency", solo para los que tengan su plan de 97
  activo». Ahora **ser Agency es el plan Y la fila**. Sumarse escribe la fila; bajar de plan apaga la Agency sin borrarla.
- **Medido en producción antes de cambiarlo (lectura):** la única con la capa es el ws 13, y tiene su fila. Nadie perdió nada.
- **Vive en:** `lib/agencia.ts` (`esAgencia`, `agenciasHabilitadas`, `anotarAgency`), `lib/agency-reglas.ts`
  (`puedeSumarseComoAgency`), `lib/agency.ts`.

## Quién paga cada cliente vive en la cuenta DEL CLIENTE, sin migración (25/10/2026)

- La opción «la paga mi cliente» se guarda en `app_settings` del **workspace del cliente** (`agency.quien_paga`). Sin la
  clave, paga la agencia: es lo que pasaba con todas las cuentas abiertas antes.
- **Por qué ahí y no en `agencia_clientes`:** el cartel de pago lo lee el propio cliente con SU sesión, sin cruzar de
  inquilino. Y no existe una ruta genérica para escribir `app_settings`: cada clave la escribe su código. Por eso el
  cliente no puede pasarse a «paga la agencia» para saltear el cartel.
- **La agencia lo lee de todas sus cuentas en una sola consulta** (`quienPagaDeClientes`, service role, sólo esa clave).

## «Paga el cliente» invierte cuándo sale el acceso, y eso abría una cuenta gratis (25/10/2026)

- Antes el admin del cliente se creaba **sin avisarle**, y el acceso salía al habilitarse la cuenta: con el pago de la
  agencia o con la firma de Martín (`lib/agencia-habilitar.ts`). Si paga el cliente, eso no sirve: el cliente tiene que
  entrar para hacer su onboarding, que es cuando le aparece el pago. Ahora el acceso sale **al crear la cuenta**.
  `invitarPorEmail` marca `invitacion_enviada_at`, así que la habilitación no se lo vuelve a mandar.
- **La trampa:** si la agencia también pudiera entrar antes del pago, una agencia podría abrir cuentas sin pagar y
  usarlas desde su lado. Por eso la cartera queda `pendiente` hasta que el cliente paga, y el «Inspeccionar» no aparece.
- **El cartel del primer mes no se cierra** (lo único que ofrece es cerrar sesión). El de la renovación sí se cierra,
  porque su mes ya está pago. Reglas: `cartelDePago` (lib/agency-reglas.ts). Ruta: `/api/agencia/mi-pago`, que nunca
  contesta al super admin ni a una agencia mirando. Pantalla: `app/_components/CartelPagoCliente.tsx`, en el layout.
- **El link de un primer mes que paga el cliente va a SU email** (`linkPrimerMes` con `email: correo`). El cron de las
  renovaciones le pide la suscripción a ese mismo email, así que la renovación también la autoriza él.

## Los tests de «Partners» eran de la cartera de agencia (25/10/2026)

- `tests/partners.test.ts` cubría la cartera de la agencia (de cuando MaKo Partners ERA eso). Al mudarse la cartera, el
  archivo se mudó entero: ahora es `tests/agency.test.ts`. Los tests del programa de referidos están en
  `tests/partners-para-clientes.test.ts` y vecinos.

## Trampas del entorno (25/10/2026)

- **Los archivos del worktree son CRLF** (core.autocrlf). Un script que reemplaza un texto de VARIAS líneas escrito con
  `\n` no lo encuentra, y el «rompe y cuenta» decía «aparece 0 veces» en vez de romper. Primero hay que normalizar el fin
  de línea y después restaurarlo. Además, un heredoc de Bash se come las barras de `'\r\n'`.
- **Playwright:** `ms-playwright/chromium-1243/chrome.exe` no está firmado y Windows lo bloquea («spawn UNKNOWN»). Anda
  `chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe` como `executablePath`, con Bash
  sin sandbox. Para referencias de un SaaS de suscripciones, `demo.baremetrics.com` es la app real, pública y sin login.

## Lo que quedó SIN hacer

- **«MaKo no les intentará hacer upsells» a los clientes de una agencia:** /agency ya no se les muestra, pero siguen
  viendo los avisos de tope con «Pasar a Pro» (`lib/topes-plan.ts`, `app/crm/PasarAPro.tsx` y los demás que usan
  `textoTope`), la fila de MaKo Partners y el cartel de la prueba. Falta un `esClienteDeAgencia` que los apague.
  → 29/10: MaKo Partners, «Recomienda MaKo», «Tu plan» y los candados de la barra ya no; los carteles de tope siguen (abajo).
  → 30/10: `esClienteDeAgencia` quedó UNA, con el tri-estado, y **los nueve usos resuelven el «no sé» como SÍ**
  (`!== false`). Un cartel de tope nuevo que la use copia ese idioma; lo fija `tests/agency-dos-duenos.test.ts`.
- **P14, la MEDIA y las BAJAS de H5: no se pueden tocar desde `main`** (ver la sección de arriba). Viven en
  `agency-thiago-2910`:
  - MEDIA — `darDeBajaClienteDeAgencia` (`lib/agencia-baja.ts:81`) y `cambiarPlanDeCliente` (`lib/agencia-plan.ts:70`)
    no miran **qué** negocio es: una fila de cartera cargada a mano sobre el ws1 o sobre un Pro directo deja que la
    agencia lo pause o lo rebaje. Falta la guarda de «es la plataforma» y de «tiene plan propio» en esas dos, y
    `negocioPausado` (`lib/workspace.ts:340`) sin guarda del ws1.
  - BAJA — H5 levanta el corte con cualquier tramo `cubierto` (`lib/plan-acceso-reglas.ts:353`): lo justo es aceptar
    «pagado + `suscripcion_estado` null» y no un plan cancelado o devuelto que todavía cubre días.
  - BAJA — la pausa programada sigue pidiendo `al-dia` (`lib/plan-acceso.ts:166`), así que no se enteró de H5.
  - BAJA — «Elegir Esencial» sin cobros es de ida y el diálogo no lo avisa (`app/agency/AgencyApp.tsx`).
  - BAJA — `aplicarSubidasPendientes` lee la marca con `.limit(2000)` (`lib/agencia-plan.ts:197`) y ahora toda cuenta
    nueva tiene marca: pasadas las 2.000, una subida pendiente se queda afuera sin decirlo.
- **`anularCobro` todavía cierra el link viejo con mejor esfuerzo** (`lib/cobros.ts:1318` → `cerrarLinkEnLaPasarela`,
  que nunca tira): un link anulado que la pasarela no cerró puede seguir cobrable. Está en `main` y quedó sin tocar.
- **El TERCER lugar que decide con el `null` de `agenciaDeCliente`: el cartel de pago del cliente**
  (`cartelDelCliente`, `lib/agency.ts:128`). Anotado y sin arreglar, a propósito. Con dos dueños devuelve `null` y el
  cliente que paga él mismo **no ve su cartel de pago** — acá el `null` esconde en vez de abrir, así que es el daño
  opuesto al de las pantallas y es acotado (la agencia sí ve en su dashboard que falta el pago).
  ⚠️ **No se arregla cambiando a `esClienteDeAgencia`**: lo que sigue necesita UN dueño de verdad, el nombre para el
  texto y `cobrosDeClientesDeAgencia(agencia.ws)` para saber si ya pagó. Con dos hay que DECIDIR de cuál se leen los
  cobros (o de las dos) y cómo nombrarlo sin inventar un padre («tu agencia»). Es producto, no un cambio mecánico.
- **Cambiar quién paga una cuenta ya abierta:** hoy se elige sólo al abrirla.
- **Código muerto de Partners** (lo limpia Planes, que reescribió /partners y /m/partners): `PartnersApp` (la parte de
  la agencia), `LlevarAPartners.tsx` y `app/m/partners/PartnersM.tsx`. Ojo: `app/partners/EquipoDeCuenta.tsx` NO está
  muerto, porque lo usa `app/agency/AgencyApp.tsx`.

## La plantilla del modelo de negocio: la base de una cuenta en un clic (MAU-01, 27/10/2026)

- **El pedido:** Mauricio (14/10): «una base tipo copy paste que disminuya mi intervención de iniciar de cero», para sus
  tres modelos de cliente: tienda B2C (Texx, Baja Teriyaki), B2B con CRM (HMO) y manufactura (Aspro, Sibelco). Martín
  propuso hacerlo con plantillas DENTRO de MaKo y una guía para cargar los datos. Eso cambió el roadmap de CS, que
  decía que el tablero vive afuera (app/admin/dev/customer-success/roadmap-cs.ts, con la fecha).
- **Qué arma** (lib/plantillas-modelo-reglas.ts): el funnel con las etapas de ese modelo, el tablero (el objetivo del
  trimestre y 4 KPIs semanales en Objectives) y un proyecto «Arranque · <modelo>» en su Plan, con la guía como tareas.
  Se aplica desde la ficha de cada cuenta del Agency Dashboard (la computadora y el teléfono) o por la API
  (`aplicar_plantilla_de_modelo`, con `clienteWs` para una agencia).
- **Lo que no se ve y hay que respetar:**
  - **Sin IA, un proyecto que no existe manda la tarea a «Sin proyecto».** `agregarTareasPlanOwner` con `sinIA` resuelve
    el destino con `destinoSinIA` (lib/plan-bandeja.ts): sólo sirve un proyecto que ya existe, uno del catálogo o el del
    cliente de la reunión. Por eso la plantilla crea el proyecto ANTES que sus tareas.
  - **Las etapas usan las claves canónicas** (`lead`, `conversando`, `agenda`, `agendaj2`, `facturando`, `ganado`) con su
    rótulo. Con una clave inventada, el CRM dibuja al lead en la primera columna (el molde es `FUNNEL_TEMPLATES`).
  - **Se lee todo antes de escribir, y «no pude leer» no escribe nada.** Con una lista vacía por error, aplicarla
    duplicaría el funnel, el objetivo y la guía. Aplicarla dos veces no duplica: se compara por nombre, sin tildes ni
    mayúsculas.
  - **Sin números:** la meta y el compromiso quedan en 0, que el tablero dibuja «sin datos», hasta que el cliente pone
    los suyos (el primer paso de la guía). El funnel nace principal sólo si la cuenta no tiene uno.
- **Lo que quedó SIN hacer:**
  - **La prueba en el ws3:** es escritura en producción, y el permiso de este chat no la dejó correr. El script es
    `scripts/tmp-captura-customers/probar-plantilla-ws3.mts`, en el worktree de Agencias, sin commitear: aplica la de B2B
    dos veces y muestra lo que quedó. La segunda vez tiene que decir «ya estaba aplicada».
  - **Para que Mauricio la use**, ws1 tiene que ser Agency y cada cliente tener su cuenta de MaKo: la plantilla se le
    aplica a una cuenta, no a un cliente del CRM.

## La plantilla Inmobiliaria: sin reuniones, y su hoja del Dashboard (MK-15, 27/10/2026)

- **El pedido:** Joan (Código Inmobiliario, documento «DeadlinesMakoxJJ», 25/09 y 05/10). Sus clientes captan
  propiedades con campañas a formulario y cierran en persona: «me pone lo de R1 Y R2. En el caso de los inmobiliarios
  esa lógica no se utiliza». El Dashboard estaba pensado para un VSL (Impresión → Click → Landing → VSL) y no les sirve.
- **El funnel:** Formulario → Calificado → Tasación / pre listing → Captación, sin ninguna etapa de reunión. La
  tasación es una etapa propia (la clave `st0`, como las que acuña el editor del CRM) con `kind: 'paso'` y
  `marcadaComo: 'etapa'`. Se llega a ella moviendo el lead a mano, como a `conversando`: `pipeline_stage` manda sobre lo
  derivado cuando la etapa está en el funnel (`etapaVigenteDe`), y `kind: 'paso'` no pide requisitos.
  ⚠️ `agenda` con `kind: 'reunion'` (lo que hace la plantilla `presencial`) traía justo las R1 que Joan no quiere.
- **La hoja del Dashboard (`HOJA_INMOBILIARIA`):** Inversión, Impresiones, Clics y Formularios arriba; el embudo de
  marketing y el comercial (Leads → Calificados → Captaciones) al lado; y los leads por etapa, que es donde se ven las
  tasaciones.
- ⚠️ **Joan pidió Alcance, Visualizaciones y Clics salientes, y MaKo no los guarda.** El alcance existe sólo en vivo y
  sin total (la fuente `audiencia`), y las visualizaciones de video y los clics salientes no se sincronizan de Meta. La
  hoja trae Impresiones y Clics, con esos nombres: rotular «Alcance» a las impresiones sería un número falso con el
  nombre correcto. **Sin hacer:** sumar esas tres métricas a la sincronización de Meta; es del área de Ads.
- **El Dashboard es por persona** (lib/graficos-tablero.ts). La hoja va primera en el informe de cada persona del equipo
  de la cuenta, con el compare-and-set de la API, así que a quien está editando su informe no se le pisa. A quien la
  archivó no se le revive (`conHojaDeModelo`).
- **Lo que pidió Joan y queda afuera de la plantilla:** el WhatsApp único al inmobiliario cuando entra un formulario (es
  una automatización) y el filtro por creativo.

## «Puede mostrar datos de otro cliente» no era una fuga, y atrás había dos defectos de verdad (30/10/2026)

- **Síntoma:** Agency salió del tren con un rojo en `tests/inspeccionar-primer-cuadro.test.ts`: `/api/auth/me` sumaba `agenciaDeCliente(ws)`, «una segunda cuenta de "a quién se mira" puede nombrar a otro cliente». En el pase de manos se volvió «puede mostrar datos de otro cliente».
- **El diagnóstico obvio era el equivocado.** Medido con dos agencias, sus clientes y cuarenta pedidos intercalados sobre el código real, y en producción con los negocios de Código Inmobiliario: esa línea era un sí o un no sobre el MISMO negocio, y no nombraba a nadie. No hubo fuga. **Una guarda en rojo dice qué regla se rompió, no qué daño hizo: medir antes de llamarlo fuga.** Igual se sacó, porque la regla es buena.
- **Lo que sí estaba mal:**
  - **El cliente de DOS agencias seguía viendo MaKo Partners y «Pasar a Pro».** `agenciaDeCliente` contesta null con dos dueños: es lo correcto para la cadena (no inventar un padre), no para «¿la maneja una agencia?». Son dos preguntas: nació `esClienteDeAgencia`.
  - **La agencia veía el plan de las cuentas no aprobadas, también de las que dio de baja.** Ya no son suyas, y el cliente puede haber elegido su plan. La regla, en `planQueVeLaAgencia`: la capa sólo de las aprobadas; de una pendiente, lo que eligió la propia agencia (sin eso no puede corregirlo antes de pagar); de una dada de baja, nada.
- **«Faltan las zonas de México» tampoco era eso:** las zonas estaban. El barrido de `tests/zona-negocio.test.ts` no conocía esa lista como un dato.
- **Trampa del arnés:** `mock.module` con `namedExports` tiene que declarar TODO lo que importan los demás, o el módulo no carga. `tests/_agencia-dos-negocios-hijo.ts` lee los nombres de la fuente y deja de mentira los que no usa.

**Sin hacer:**
- `app/agency/page.tsx` y `app/m/agency/page.tsx` siguen preguntando con `agenciaDeCliente`: con dos dueños, ese cliente entra al Agency Dashboard. Hoy ningún cliente tiene dos (docs/pendientes.md, P15). `cartelDelCliente` (`lib/agency.ts`) la usa bien: necesita UNA agencia para leer sus cobros.
- De la re-verificación de plata de 28cc3e2cb (`C:/dev/revisiones/2910-reverificacion-plata-agency-28cc3e2cb.md`), sin tocar: la MEDIA de una fila de cartera cargada a mano sobre un Pro directo, las tres BAJAS y lo abierto desde antes (docs/pendientes.md, P14).

**Vive en:** `lib/agencia.ts` · `lib/vista-de-otro.ts` · `lib/agencia-cobro-reglas.ts` · `tests/agencia-dos-negocios.test.ts`.

## Lo prometido a Thiago: dar de baja, el plan de cada cuenta y el cobro por país (29/10/2026)

La llamada con Thiago (agencia de España, 27 clientes; reunión del 5/11): docs/promesas/2910-llamada-thiago.md, lo marcado
*(Agency)* y *(Planes y Partners)*. Chat «Suscripción y Partners», cuenta 3. Pasó una revisión adversarial de plata en tres
pasadas (un revisor sobre 33c131f6b, 13 hallazgos; el mismo sobre los arreglos, 5 nuevos; y una corta, 3 más). Lo
arreglado lo fija tests/revision-plata-agency-2910.test.ts. Después, una **verificación independiente** de otro chat sobre
4b42b6a7f (C:/dev/revisiones/2910-verificacion-plata-agency-4b42b6a7f.md): H1, H2 y H3, en
tests/verificacion-plata-agency-2910.test.ts.

- **«Dar de baja» no borra nada ni deja la cuenta gratis** (`darDeBajaClienteDeAgencia`, lib/agencia-baja.ts). Primero la
  plata: se cancela en la pasarela TODA suscripción viva de esa cuenta (`esSuscripcionViva`: la marcada `activa`, que es la
  pagada, la autorizada sin cobrar, la fallida y la del primer pago devuelto, y TAMBIÉN la pagada sin `suscripcion_estado`,
  porque ese estado lo marca sólo un aviso que trae el id de la suscripción). Se anula lo que todavía se podía pagar. Si algo
  falla, se frena ahí. Después la pausa y su corte, y recién al final se revoca la cartera (eso corta «Inspeccionar»:
  `puedeEntrar` sólo mira `aprobado`). Revocada primero, una falla al guardar el corte no se podía reintentar: la segunda
  vez contestaba «ya estaba». La regla, pura: `queHacerEnLaBaja` (lib/agencia-cobro-reglas.ts).
- **El diagnóstico obvio era el equivocado: «la baja pausa la cuenta».** La baja escribía `workspaces.estado = 'pausado'`,
  pero con el corte por pago APAGADO (`CORTE_DE_ACCESO_PRENDIDO = false`) `negocioPausado` no mira ese estado: toda cuenta
  dada de baja seguía usando MaKo gratis, completa y ahora sin topes. El corte `sin-agencia` vale aunque el general esté
  apagado (lib/workspace.ts), y con el general apagado el cron sólo mira esas cuentas, para reabrirlas (lib/plan-acceso.ts).
- **Trampa: la cuenta soltada se reabría con el mes que había pagado la agencia.** La vigencia se mide con TODOS los cobros
  del lugar, y los de la agencia (`cliente_ws`) la daban al día hasta fin de mes. El primer arreglo («`sin-agencia` sólo se
  levanta con la vigencia al día») no alcanzaba: estaba al día por la agencia. Ahora la vigencia de esa cuenta (y la de un ex
  cliente que ya paga su plan) sale sólo de SUS cobros (`alta_ws` y sin `cliente_ws`).
- **Si la cuenta la pagaba el CLIENTE, la baja no le corta su plan.** Su suscripción viva pasa a ser suya (`alta_ws`, sin
  `agencia_ws` ni `cliente_ws`) y la cuenta sigue abierta. Si sólo había pagado el primer mes, la pausa queda PROGRAMADA
  para el fin de ese mes (`finDeLoQuePago`, el corte con `cobroId: -1`) y la pone el cron ese día. Marcarla pausada en el
  acto apagaba los crons de la cuenta (sincronizaciones, grabadores) los días que ya había pagado. Antes se le cancelaba lo
  que había pagado y se le cobraba otro mes entero desde ese día.
- **Reactivar no tenía de dónde partir:** `reactivarPlan` arma el cobro sobre el último plan del negocio, y el cliente de
  una agencia nunca tuvo uno. `primerPlanPropio` (lib/compra-plan.ts) le arma la suscripción con el plan de su capa, con la
  pasarela de SU país (`pasarelasDelPais`), y SÓLO si ya no tiene agencia: con la agencia pagando, MaKo cobraba dos veces.
- **El plan de cada cuenta ES su capa** (`CAPA_DE_PLAN`: Esencial → `completo`, Pro → `agencia`). Cambiarlo
  (`cambiarPlanDeCliente`, lib/agencia-plan.ts) toca la pasarela primero y la capa al final.
- **Trampa: «se puede tener Pro pagando Esencial».** Con el precio nuevo desde el próximo cobro, pasar a Pro después de cada
  cobro y volver antes del siguiente pagaba siempre 47. **El primer arreglo era el equivocado: «un cambio cada 30 días»**;
  con Mercado Pago alcanzaba igual para Pro la mitad de los meses, y en el primer mes regalaba uno. La regla que quedó: Pro
  se tiene cuando se PAGA a precio de Pro. Subir con Stripe cobra la diferencia en el acto (`subirPlanStripe`,
  `error_if_incomplete`) y sube la capa. Sin nada pagado todavía, también sube en el acto: el link del primer mes se rehace
  a precio de Pro. Si no (Mercado Pago, que no prorratea, o un primer mes pagado sin renovación cobrada), queda PENDIENTE:
  lo que se cobra pasa a Pro, y la capa sube con el primer pago de AL MENOS ese precio en su moneda
  (`aplicarSubidasPendientes`, el cron; un pago de 47 no la sube aunque la suscripción diga Pro). Bajar es en el acto. Y el plan tiene que tener precio en la moneda de la cuenta ANTES de tocar nada (`precioDelPlanEn`): la
  renovación caía al monto del primer mes, que era el del plan viejo.
- **Trampa: un índice único hace que crear devuelva lo que ya existe.** `cobros_un_vivo_por_cliente_de_agencia` (mig 0308)
  deja UN cobro único vivo por cliente. Rehacer el link del primer mes creando el nuevo antes de anular el viejo recibía el
  VIEJO (`yaEstaba`), lo anulaba y la cuenta quedaba sin ningún link (o usando MaKo gratis, si la pagaba el cliente). Ahora
  se anula primero, y si el nuevo no sale se rehace el de antes (`rehacerPrimerMes`).
- **Trampa de la pasarela: la misma clave de idempotencia devuelve la respuesta GUARDADA.** `mako-plan-agencia-<cobro>-<plan>`
  se repetía al ir y volver en 24 h, y Stripe contestaba el «→Pro» anterior sin aplicarlo, con la base diciendo 97. **Ponerle
  el día era el arreglo equivocado:** ir y volver dos veces el MISMO día repetía la clave igual. Va una por pedido; reintentar
  no cobra dos veces porque `subirPlanStripe` lee la suscripción antes y contesta `yaEstaba`. Y si Mercado Pago no devuelve
  el monto pedido, no se sigue.
- **El diagnóstico obvio era el equivocado: «los topes ya corren, son los del plan».** Todos los topes, y los candados de
  Pro (`esEsencialDe`: las tabs de Pro, las automatizaciones, el piloto automático, el scraper), preguntaban por la suscripción
  PROPIA, y la cuenta de una agencia no tiene. El Esencial de US$47 tenía todo Pro. Ahora `aplicanTopes`
  (lib/topes-plan-server.ts) y `esEsencialDe` (lib/plan-esencial.ts) miran también la cartera no revocada. El candado del
  cliente de una agencia dice «De MaKo Pro», sin «Pasar a Pro».
- **Trampa: ese arreglo alcanzaba DE MÁS** (la verificación independiente, H1). Las cuentas de agencia que ya existían se
  abrieron con la capa por defecto, `completo`, que ahora es Esencial: al desplegar habrían perdido de golpe todo lo de Pro
  (en producción, 6 de la agencia ws13), sin aviso. Las tres pasadas del mismo revisor no lo vieron: miraban la plata de
  las cuentas NUEVAS. Ahora rige el plan sólo de la cuenta con el plan ELEGIDO (la marca `agency.plan_cambiado`, que
  escriben abrir la cuenta y cambiar el plan); las de antes siguen como Pro hasta que su agencia elija («Elegir Esencial» /
  «Elegir Pro» en su ficha). Lo decide Martín: si dice que pasen a Esencial, es una línea
  (`CUENTAS_DE_AGENCIA_SIN_ELEGIR_SON_PRO`, lib/plan-esencial-reglas.ts), sin migración.
- **Sin ningún cobro no se pasa a Pro** (H2): una cuenta que MaKo aprobó a mano no tiene qué cobrar, y «sin nada pagado»
  la subía en el acto, gratis. Se pide por MaKo.
- **La subida pendiente sigue a la suscripción** (H3): si la agencia soltaba la cuenta, la suscripción pasaba al cliente
  con el monto de Pro y el cron ya no la miraba: pagaba Pro y quedaba en Esencial. Ahora busca por `cliente_ws` o `alta_ws`,
  y compara el pago con el monto que se le puso a ESA suscripción, no con el precio de Pro del día (H4: si el precio subía
  antes del cobro, Pro no llegaba nunca).
- **La cuenta soltada que pagó su plan se reabre aunque su suscripción no quede `activa`** (H5): el aviso de Mercado Pago
  sin el id del preapproval la deja `cubierto` y no `al-dia`, y quedaba pausada con «Reactivar» contestando 409.
- **El ws1 nunca tiene topes** (H6): los del CRM y del equipo no tenían guarda propia y alcanzaba una fila suya en una
  cartera (medido el 29/10: no tiene ninguna). Y una suscripción propia SIN `alta_capa` (la que se le pasa
  al cliente al soltarlo, o su primer plan propio) cuenta con su capa: si no, el ex cliente con Esencial volvía a tener Pro.
  Lo mismo la cuenta en pausa programada (`soltadaPorSuAgencia`): sin cartera ni plan propio, quedaba con Pro y sin topes.
- **Cobro por país** (`cobroDeLaCuenta`, lib/agencia-cobro-reglas.ts): para España no salía ningún link (sólo cobraba Mercado
  Pago en pesos). Mercado Pago, sólo en el país de su cuenta; afuera, Stripe, en EUR en la zona euro si el plan tiene precio en
  EUR y si no en USD; sin país, Stripe primero.
- **Trampa: la zona por defecto inventa el país.** Sin encabezado (la API), el país salía de la zona del negocio, y
  `zonaDelNegocio` nunca falla: sin zona guardada devuelve America/Tijuana, que es México. Sólo cuenta la zona GUARDADA
  (`zonaDelNegocioDetalle().guardada`).
- **Trampa de Stripe: no deja diferir el primer cobro sin un trial**, y el trial da una factura de US$ 0 que se asentaría como
  un cobro. Mercado Pago sí difiere (`start_date`). La renovación de Stripe se ABRE 5 días antes del vencimiento
  (`DIAS_ANTES_RENOVACION_STRIPE`) con su `inicio_at`; si no se puede anotar, se anula (sin él nunca cortaba). El cron relee
  la cartera antes de crear cada renovación, y sin poder leer las dadas de baja no renueva a nadie.

### Lo que quedó SIN hacer (29/10)

- **Los carteles de tope dicen «Pasa a MaKo Pro» y llevan un link «Pasar a Pro» también al cliente de una agencia**, que
  ahora tiene topes. Viven en pantallas de otras áreas: app/crm/PasarAPro.tsx (CRM: tablero, barra y alta a mano),
  app/crm/TraerDeGrupoWA.tsx (el candado del scraper), app/whatsapp/EvolutionConnect.tsx, app/equipo/EquipoView.tsx,
  app/m/configuraciones/equipo/EquipoM.tsx, app/web-generator/editor/dialogos/DialogoPublicar.tsx y
  app/integraciones/CuentasDePago.tsx. Adonde llevan («Tu plan») ya dice «Lo maneja tu agencia». Propuesta: el dato ya está
  en /api/auth/me (`clienteDeAgencia`). Con él se esconde el link y el texto pasa a «pídele a tu agencia que te pase a Pro».
- **La renovación de Stripe abierta 5 días antes** (revisión, hallazgo 10): si la agencia la paga apenas se abre, paga esos
  5 días dos veces; si la paga tarde, el ancla de Stripe se corre y esos días quedan regalados. Es el costo del diseño sin trial.
- **La subida pendiente llega un mes tarde si la renovación cae el MISMO día en que se pidió:** el pago se compara por día
  (`fecha_pago` puede venir sin hora) y uno de ese día pudo ser el de antes, a precio de Esencial.
- **`finDeLoQuePago`, sin onboarding terminado,** cuenta el primer mes desde el pago. (Desde el último pago de la suscripción
  ya cuenta: H8 de la verificación independiente, las renovaciones no mueven `pagado_at`.)
- **De la verificación independiente, para después** (cada uno con su archivo, en el informe): el país que decide la
  pasarela es el de la agencia, no el del cliente que paga (H7: con «paga mi cliente», a un cliente de otro país le llega
  una pasarela que no puede pagar); un negocio que ya existía y alguien cargó a mano en una cartera lo puede pausar su
  agencia con «Dar de baja» (H6; sus topes no, por H1); `primerPlanPropio` abierto a cualquier negocio sin plan propio; el cliente de agencia con
  Pro se puede «Sumar como Agency»; la baja se traba si la pasarela ya canceló la suscripción; «Nuevo cliente» dice US$ aunque
  cobre en EUR o ARS.
- **PLAUSIBLE, vive en lib/cobros.ts (Cobros):** al rehacer el link del primer mes, el viejo se anula y su cierre en la
  pasarela es de mejor esfuerzo. Si no se cerró y alguien lo paga, pasarlo a `pagado` choca con el índice contra el link
  nuevo: la plata entra y el pago no queda anotado. Haría falta que `anularCobro` diga si la pasarela cerró el link.
- **La suscripción que se le pasa al cliente sigue colgada de la ficha de la agencia en el CRM de MaKo** (su lead): su
  baja y sus reactivaciones escriben ahí y mueven el MRR de la agencia. Afecta reportes, no plata.
- **PLAUSIBLE, no seguido:** si la agencia tiene gente suya dada de alta en el equipo de la cuenta del cliente, esa gente
  sigue entrando cuando la cuenta queda abierta (la que pagaba el cliente).
- El teléfono abre la cuenta sin elegir plan (queda en Esencial) y no lo cambia. La API tampoco tiene «cambiar el plan».
- El precio en EUR no tiene pantalla: /admin/cobros edita sólo la moneda de Mercado Pago, y sin él España paga en USD.

## El diferencial: por cada cliente nuevo se pagan sus días hasta el próximo 5 (5/11/2026)

**La regla, de Martín, «igual para todos»:** cuando un cliente de Código empieza (terminan sus 14 días, o entra si estaba suspendido), se pagan sus días desde ese día hasta el próximo 5, y la fecha límite es ese mismo día. «Tampoco le puedo cobrar el mes entero», y esperar al mes siguiente deja días sin cobrar. Va siempre en tabla, en PDF, por el grupo de WhatsApp de la agencia, «nunca a los clientes de ellos».

**Lo obvio era sumar esos días a la mensualidad siguiente, y está mal.** Es lo que hace `COBRA_LOS_DIAS_DEL_PRIMER_MES = true` en `punta/agencia-cobro`: diciembre daba US$527,83, con días de un mes corrido y días en que el cliente estuvo suspendido. El diferencial es un cobro aparte y por adelantado; diciembre son US$426.

**Trampas de la cuenta:**
- **El ciclo va del 5 al 5, no por mes calendario.** Martín: «ellos ya me pagaron hoy, pagaron el 5, entonces el diferencial hasta el próximo 5, no hasta el próximo primero». Del 5/11 al 5/12 hay 30 días; del 5/12 al 5/1, 31.
- **El 5 no se cuenta, aunque se diga «hasta el 5».** Ese día ya lo cubre la mensualidad: contarlo cobra un día dos veces (US$117,50 en vez de US$112,80 en noviembre). Por eso el PDF dice «Cubre hasta 4/12».
- **La tarifa redondeada no cierra.** 24 × US$1,57 da 37,68, y lo correcto es 37,60. Se multiplica y se redondea al final, y en pantalla la tarifa va con cuatro decimales para que Código pueda comprobar la cuenta.
- **Quien estaba suspendido paga desde el día que entra,** no desde que venció: Pablo venció el 28/10 y paga desde el 9/11.
- **Paga Código, no el cliente.** «Cada cliente paga» se lee como que MaKo les cobra a sus clientes: el texto dice «por cada cliente se pagan».

**`mako.numero_dueno` no identifica al cliente.** En el negocio 17 (Giselle) es el número de Joan, de Código, porque ese negocio nació como una prueba suya. Cruzar los participantes de un grupo contra ese dato da una coincidencia falsa con el grupo de la agencia. Tampoco sirve para mandarle algo a la clienta. Su fecha tampoco sale de `agencia_clientes` (dice 28/09): vale el 28/10, cuando se creó su usuario.

**Sin hacer:**
- ~~Todo lo automático sigue en `punta/agencia-cobro`~~: llegó con `punta/agencia-cobro-2` (6/11/2026, «La segunda vuelta», arriba). Las tres tareas programadas (`codigo-diferencial-*`, 9/11, 12/11 y 14/11) siguen: avisan, no escriben, y pueden apagarse cuando la mensualidad esté prendida.
- El pago del 5/11 no deja rastro en la base: se apoya en lo que dijo Martín. Marcarlo «Pagado» cuando exista la pantalla.
- Para armar el PDF con `jspdf`: `maxWidth` parte la línea, pero la altura no se ajusta y se pisa con la de abajo. Medir con `splitTextToSize`, y mirar el PDF dibujado antes de mandarlo.
