# Relevo — Código Inmobiliario: lo que Martín les prometió el 30/10 (sesión en la nube, 5/11/2026)

**Lo pidió el Cerebro, con la auditoría contra main del 5/11 que midió que nada de esto existía.** Martín les prometió a Juanfran y
Joan (agencia Código Inmobiliario, negocio 13) en la llamada del 30/10: (1) una métrica de cuánto tarda el inmobiliario en contactar a
un lead desde que llega al CRM, para contestar cuando un cliente dice que los leads no sirven; (2) el porcentaje de tiempo al aire en
la hoja Closing, si ya llega el dato; (3) prioridad a sus tickets; y (4) que el aviso de Meta («todavía no recibe leads») no salga en
falso. Esta sesión no le puede escribir al Cerebro: todo queda acá.

**Dónde está:** el commit `1d12673f8` (código y tests) y uno de relevo encima, en `punta/codigo-primer-contacto`. Medir antes de
creerlo: `git merge-base --is-ancestor 1d12673f8 origin/main`.

## 1. El primer contacto — HECHO (falta aplicar la migración 0396, DESPUÉS del deploy)

- **Qué mide:** desde que el lead entra al CRM (`leads.created_at`) hasta que una PERSONA del negocio le escribe o lo llama, por
  WhatsApp, email, Instagram, Messenger o una llamada (las grabadas con «Grabar» y las reuniones del grabador). La regla es pura y
  con test: `lib/primer-contacto.ts`. El lector: `lib/primer-contacto-server.ts`.
- **Lo automático va aparte.** `wa_mensajes` no sabía quién mandó un saliente (lo decía lib/cs-contacto.ts). Ahora:
  - la **migración `0396_wa_mensajes_automatico.sql`** suma `automatico` (null en las filas viejas, `false` por defecto en las
    nuevas). ⛔ **SIN APLICAR.** Se aplica **DESPUÉS** del deploy (la cabecera dice por qué: antes, la versión vieja dejaría
    automáticos como si los hubiera escrito una persona). El número lo elegí desde la nube sin el Cerebro: comprobar que nadie más
    tomó la 0396 antes de aplicarla. El código la tolera ausente.
  - el emisor marca: `enviarYEspejar` y sus hermanas (`lib/evolution-envio.ts`) hacen un UPDATE por el id después del espejo. Sin
    `quien`, automático (todos los que llaman sin decirlo son automatizaciones); **Chats y el borrador aprobado dicen
    `quien: 'persona'`**. Un emisor nuevo tiene que decidirse: `tests/primer-contacto-emisores.test.ts`.
  - email: con `autor` (lo escribió alguien en Chats) es una persona; sin `autor`, automático. Instagram/Messenger: `ig_mensajes`
    sólo guarda lo que manda una persona desde Chats (`salientesSocialesDeLeads`, lib/canal-zernio.ts).
- **Lo que no se puede saber, se dice:** si lo primero que le salió es un WhatsApp sin marca (de antes de la 0396), el lead queda
  **«No se sabe»**, nunca contactado ni sin contactar. Si ya le habían escrito antes de entrar, **«Ya hablaban antes»** (no es
  velocidad). Un lead de hace menos de una hora sin contactar está **a tiempo**: no cuenta como tarde.
- **Qué leads cuentan:** los que LLEGAN solos (formulario de Meta, landing, Calendly/Cal.com, Instagram, Messenger, chat de WhatsApp,
  y los viejos sin origen). No los cargados a mano, importados, de prueba ni traídos de un grupo (`cuentaParaPrimerContacto`).
- **Dónde se ve:**
  - **Hoja Closing** (`/dashboard?hoja=closing`, mirando, no editando): una tarjeta a lo ancho, abajo, con la mediana, cuántos en la
    primera hora, los sin contactar, «los más lentos» (p90) y los 3 que más esperaron (cada uno abre su ficha). Viaja como EXTRA
    (`primerContactoParaElClosing`, lib/closing-diseno-server.ts), no como pieza de la plantilla: así llega a las hojas Closing YA
    guardadas, la plantilla sigue en sus 14 paneles, y el closer y el setter no la reciben (nombra leads).
  - **Dashboard, como gráfico:** el conjunto «Primer contacto» (`primer_contacto`, por tramo, canal, setter, funnel, origen y lead).
  - **API de MaKo:** `tiempo_primer_contacto` (`GET /api/v1/crm/primer-contacto`, `?dias=` y `?leadId=`), sólo admin.
- **«Por cliente de la agencia»:** cada inmobiliario es su propio negocio. La agencia lo ve entrando a ese cliente (la vista de
  agencia) y abriendo su hoja Closing, o con el token de la API de ese cliente. **No hay una columna por cliente en `/agency`**
  (no existía nada de métricas ahí; si se quiere, es lo siguiente).

**El costo de abrir el Dashboard:** la página ESPERA la tarjeta (como la agenda) cuando el informe tiene una hoja Closing. Lee los
leads de 30 días y lo que le salió a cada uno por cada canal, todos los canales a la vez y de a 4 tandas de 150 leads. Sin medir en
producción: con un negocio de 50 leads por día son ~10 tandas por canal. Si se nota lenta, lo siguiente es pedirla desde el navegador
después de dibujar, o guardarla una vez por hora.

**Sin ver en pantalla:** la nube no tiene sesión de MaKo ni la base. La tarjeta se probó con tests y el tsc acotado, no dibujada.
**Sin medir en producción:** cuántos leads del ws13 caen en «No se sabe» hasta que la 0396 esté aplicada (todos los de WhatsApp de
antes). **Lo que NO marca:** lo que manda `enviarTexto` directo sin el espejo (lib/reunion-destinatarios.ts, el resumen a los
participantes; lib/mako-salida.ts, el bot; lib/lineas-de-mako-vigilante.ts): su eco entra con el default `false` («persona»). Ninguno
es el primer mensaje a un lead nuevo, pero si eso cambia, hay que marcarlos. Tampoco un automático cuyo envío no devolvió id (el eco
lo materializa el webhook, con `false`).

## 2. El porcentaje de tiempo al aire en Closing — NO LLEGA, no se inventó

Medido el 5/11 leyendo el código: `closing_analyses` (migs 0037/0038) no guarda cuánto habló cada uno, y ninguna lectura del grabador
trae un «talk time». Lo que sí existe: los turnos de la transcripción (`TurnoReunion`, lib/grabadores/reunion.ts: `hablante`, `email`
y `segundo` de inicio), que se leen del grabador al analizar y se tiran. **Cómo se haría:** al analizar (lib/closing.ts), sumar por
hablante los segundos de cada turno hasta el siguiente, separar al closer (el email del anfitrión) del invitado, guardarlo en una
columna nueva de `closing_analyses` y releer las llamadas viejas (otra pasada por el grabador). ⚠️ Es una ESTIMACIÓN (el silencio
entre turnos se le suma al que habló antes); si Martín mostró el número de Fathom en la llamada, conviene ver si su API lo da medido
antes de calcularlo. Lo decide Martín.

## 3. Prioridad a los tickets de una agencia — HECHO

- Lo que levanta **quien administra una agencia** (su negocio es agencia —`esAgencia`: el plan Pro y la fila en `agencias`— y él es
  su admin; no un admin de MaKo) **sube un escalón**: baja → media, media → alta. **Nunca a «urgente»**, que sigue saliendo sólo del
  texto («no puedo trabajar»). Lo de un tercero o lo que abrió MaKo solo no sube.
- **No le quita el lugar a un cliente con algo roto:** en el mazo, lo que subió por la agencia (`triage.agencia`) va DETRÁS de los de
  su prioridad que llegaron ahí solos (para el triage, «roto» es alta o urgente). El porqué lo dice en la bandeja.
- Vale para los tickets NUEVOS: los que ya estaban no se reclasifican. Martín igual puede cambiar la prioridad a mano.
- Archivos: `lib/tickets-reglas.ts` (`subirPorAgencia`, `clasificar`), `lib/tickets-db.ts` (`administraUnaAgencia`),
  `app/tickets/bandeja/mazo-reglas.ts` (`ordenDelMazo`). Test: `tests/tickets-agencia.test.ts`.

## 4. El aviso de Meta — PODÍA SALIR EN FALSO, ARREGLADO

El arreglo del 29/10 miraba si el webhook de Zernio estaba registrado. Medido el 5/11, quedaban tres falsos:
1. **Sin webhook los leads llegan igual** por el barrido de cada 30 minutos (`app/api/cron/meta-leads-poll`), así que «MaKo todavía no
   recibe los leads» era falso.
2. Un webhook **viejo** (registrado antes de escuchar `lead.received`) o **pausado** no es «falta el complemento», que es lo que decía.
3. **Sin el secreto maestro** (`ZERNIO_WEBHOOK_SECRET`) no hay URL que buscar: decía «no recibe».

Ahora (`lib/zernio-leads-estado.ts`, `avisoDeLeadsZernio` en lib/zernio.ts): si el webhook escucha, nada. Si no, se le pregunta a la
API de Zernio con el MISMO pedido del barrido (uno solo, desde ahora): si los entrega → **«Tus leads llegan cada media hora. Para que
lleguen al instante, toca «Volver a conectar»»** (en gris, no en ámbar); con un 403 → «falta el complemento» (lo de siempre); si no se
sabe, no se dice nada. Sin el secreto maestro no se manda a «Volver a conectar» (no arreglaría nada). El pedido extra a Zernio sólo
sale cuando el webhook no escucha. **Sin probar contra Zernio real:** que `/ads/leads?since=<ahora>&limit=1` conteste 200 con la lista
vacía (lo supuse por el barrido, que usa el mismo pedido).

## Cómo se probó

Tests nuevos, todos rompiendo el código (los números en la cabecera de cada uno): `tests/primer-contacto.test.ts`,
`tests/primer-contacto-emisores.test.ts`, `tests/evolution-envio-automatico.test.ts` (la marca, ejecutada), `tests/primer-contacto-lector.test.ts`
(el lector de cada canal, contra una base de mentira), `tests/tickets-agencia.test.ts`,
`tests/zernio-leads-estado.test.ts` y tres casos nuevos en `tests/zernio-webhook-suscripcion.test.ts` (`avisoDeLeadsZernio` contra el
webhook y la API de mentira). Verde también: graficos, dashboard-diseno-closing, api-mako-registro/rest, ops-center-bateria (el margen
del CRON ya era 318 sin esta operación), ops-center-clasificador-app, tickets, ticketera-mazo, funciones-mako, cs-sin-contacto y los
cinco que leen las llamadas a `enviarYEspejar`. El tsc acotado de lo tocado, en verde (necesita `--heap=7000`: con 2560 se queda sin
memoria por el grafo del Dashboard). El veredicto de la nube va en el último commit.

## Lo que espera a alguien

1. **Aplicar la 0396 después del deploy** (una sesión local, con el sí de Martín).
2. **Mirar en pantalla** la tarjeta «Primer contacto» de la hoja Closing en el ws13 o en un cliente suyo.
3. **El tiempo al aire:** decidir si se calcula de los turnos (una estimación) o se busca el dato medido del grabador.
4. **Si se quiere ver en `/agency`** una columna por cliente: es trabajo nuevo (leer a través de la cartera aprobada).
