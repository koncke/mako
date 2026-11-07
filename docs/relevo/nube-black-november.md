# Relevo — Black November de Leila: la rampa del número, el horario y los bloques de venta (nube, 5/11/2026)

> Escrito por la sesión de la nube que hizo el trabajo (`cli_36e19fd1-66a6-5448-b8ce-1087dd99d13b`). Es de primera mano sobre
> lo que se escribió y se probó acá. Lo de producción NO se midió: desde la nube no hay base. Esta sesión no le puede escribir
> al Cerebro: todo lo que hay que hacer está acá.

## Lo pedido (el brief del 5/11, por el Cerebro)

Leila (negocio 11) lanza en noviembre su campaña Black November por WhatsApp a su base. La auditoría del 5/11 marcó tres
riesgos, y se pidió, textual:

1. ~~«Rampa de WhatsApp en las secuencias: que `limites.wa` también arranque bajo y suba de a poco (`arranqueDia`,
   `arranqueSube`)…»~~ **CUMPLIDO el 5/11/2026** (`topeDeLineaDeHoy` con el canal por parámetro; ver
   lib/goteo-db.ts y lib/nutricion.ts).
2. «Horario de fábrica: las automatizaciones nuevas nacen con 9 a 21, las ya prendidas no tienen horario. Decidí con
   criterio cómo cubrirlas sin frenar a nadie de golpe y sin mandar lo acumulado todo junto. Si hace falta tocar datos, un
   script en seco por defecto que corre el Cerebro: dejá el comando en el relevo. Leila quiere de 10 a 20 h: que se pueda
   poner por negocio.»
3. «Bloques de venta en landings: cuenta regresiva (a una fecha real; al vencer no reinicia sola), pop de prueba social y
   barra de escasez. Sólo con datos reales que pone el negocio: nada de números inventados ni compras falsas; si no hay
   dato, el bloque no se muestra. Agregalos sin romper el diseño, también en celular, y a la API de MaKo.»

## Dónde está

Rama `punta/black-november` (también en `claude/optimistic-davinci-y50xeg`), un commit sobre main del 5/11. GitHub la lleva a
main con el verde de `punta.yml`. **Sin mirar desde la nube:** si la corrida dio verde y si el deploy de Vercel quedó «Ready».

## Lo hecho

**1. La rampa del número (Automations).**
- El WhatsApp de las secuencias arranca con 20 por día y sube 20 cada día que llega a su tope, hasta los 40 de siempre.
- Cuenta lo que SALIÓ, como la difusión: un número que ya venía llegando a su tope sigue en su nivel. Dos días sin mandar,
  vuelve a arrancar.
- Lo acumulado no sale todo junto: sigue el tope de 6 por hora.
- El aviso al prender, el «¿por qué no sale?» y la API (`ver_limites_envio`: `tope_de_hoy` y `rampa`) dicen el número de hoy.
- Se cambia por la API: `cambiar_limites_envio` con `waArranqueDia` y `waArranqueSube`.

**2. El horario.**
- El 9 a 21 que MaKo guarda al prender una automatización ahora lleva una marca (`horarioDeFabrica`) y cede ante el horario
  del negocio. Antes lo tapaba: los 10 a 20 de Leila no le llegaban a ninguna automatización nueva.
- Uno que elige la persona en la tuerca no lleva la marca, aunque sea el mismo 9 a 21.
- La API dice de dónde sale el horario de cada una (`configuracion_automatizacion` → `de`: propio, negocio o de fábrica).
- `configurar_horario_envio` avisa cuántas siguen con su propio horario.
- **Las prendidas sin horario** se arreglan con `scripts/horario-de-fabrica-prendidas.mts`. Está en seco por defecto, y abajo
  van los comandos. Qué hace con cada una:
  - pone el 9 a 21 de fábrica, marcado;
  - de noche (en la zona del negocio) no pone nada: lo deja para correrlo de día, para no frenar de golpe lo que vence ahora;
  - deja tal cual las difusiones y las que contestan al momento (un DM, un email);
  - marca el 9 a 21 de las nuevas para que sigan el horario del negocio;
  - con un horario del negocio puesto, no toca nada: ya lo siguen.

**3. Los bloques de venta (Web Generator).**
- Menú «/» → «Cuenta regresiva», «Compras recientes» y «Cupos que quedan». Se editan en su panel.
- **Cuenta regresiva:** va a la fecha y hora que pone el negocio, en su zona. Al terminar muestra su mensaje o se oculta, y
  nunca vuelve a empezar.
- **Compras recientes:** salen de a una, abajo a la izquierda, con lo que carga el negocio (nombre, qué compró, cuándo).
- **Cupos que quedan:** «Quedan N de M», con su barra.
- Sin el dato, el bloque no sale en la página publicada, y en el editor dice qué falta.
- En el celular, el reloj se achica y el aviso de compras va a lo ancho, arriba del sello de MaKo.
- Editar la landing con IA no los convierte en texto.
- API: `configurar_bloque_venta_landing` (`PUT /api/v1/landing/documentos/{id}/bloques-de-venta`). Rechaza una fecha pasada,
  más cupos que el total y una compra sin nombre o con fecha futura.

## Lo que tiene que hacer el Cerebro (desde la PC, con el `.env.local` del clon)

Primero en seco, **de día en México** (entre las 9 y las 21; de noche el script deja «esperar»):

```bash
npx tsx scripts/horario-de-fabrica-prendidas.mts --env=.env.local
```

Leer la lista: cada automatización dice qué haría y por qué. Si está bien:

```bash
npx tsx scripts/horario-de-fabrica-prendidas.mts --env=.env.local --aplicar --respaldo=$HOME/.claude/operaciones/respaldo-horario-de-fabrica.json
```

Para Leila (los 10 a 20 que pidió, todos los días). Primero en seco:

```bash
npx tsx scripts/horario-de-fabrica-prendidas.mts --env=.env.local --ws=11 --horario-del-negocio=10-20
```

```bash
npx tsx scripts/horario-de-fabrica-prendidas.mts --env=.env.local --ws=11 --horario-del-negocio=10-20 --aplicar --respaldo=$HOME/.claude/operaciones/respaldo-horario-leila.json
```

(Lo mismo se puede hacer por la API con `configurar_horario_envio`. El script además marca las suyas en una sola pasada.)

- Escribe con compare-and-set: lo que cambió mientras corría no se pisa, y se dice.
- Una segunda corrida no repite nada.
- El respaldo guarda el antes de cada clave. Sin `--respaldo` va a la carpeta donde se corre; como no se commitea, mejor
  pasarle la ruta.
- Probado acá contra un Postgres 16 local: en seco la base rechaza toda escritura, `--aplicar` escribe y deja el respaldo, y la
  segunda corrida no hace nada.

## Lo que falta verificar (no se pudo desde la nube)

- **Si el número de Leila ya llega a sus 40 por día.** Si no venía llegando a su tope, el día del lanzamiento arranca en 20 y
  llega a 40 al día siguiente. Para lanzar con 40 desde el primer día: `cambiar_limites_envio` con `waArranqueDia: 40` en su
  negocio.
- **La rampa cuenta por negocio, no por número.** Con dos líneas, suman juntas. Era así para el email y para el tope de 40.
- **Con los 10 a 20 puestos, sus respuestas automáticas a un DM o un email también esperan a las 10.** Era así antes, y el
  script lo dice en cada una. Si Leila quiere que contesten a toda hora, cada una lleva «Sin horario» en su tuerca.
- Una landing publicada en producción con los tres bloques, en un teléfono de verdad. Acá se miró en Chromium a 1280 y a 390.

## Tests

- tests/rampa-whatsapp.test.ts, tests/horario-de-fabrica.test.ts y tests/bloques-venta-landing.test.ts: los tres ejecutan el
  código, y la cabecera de cada uno dice qué se rompió para probarlo y qué dio.
- Se actualizaron las guardas que leían la línea vieja (automations-configuraciones, motor-freno-ventana,
  automations-config-revision, email-campana-topes) y la lista de ediciones de tests/api-mako-landing-contenido.test.ts.

Cosecha: docs/hallazgos-chatbot.md y docs/hallazgos-editor-landing.md («Black November», 5/11/2026).
