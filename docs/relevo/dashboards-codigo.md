# Relevo — dashboards editables y la hoja de Código Inmobiliario (9/11/2026)

Rama: `punta/dashboards-codigo` (worktree `C:/dev/wt-dash-codigo`). Lo aprendido está en
[hallazgos-templates-dashboard.md](../hallazgos-templates-dashboard.md) §37; esto es sólo dónde quedó cada cosa.

> **⛔ 10/11: Martín rechazó «Velocidad de llamada»** (armada con pedazos de tres diseños y textos inventados, «la más fea de
> todas»). La rehace un chat en la nube copiando el demo Tend, rama `punta/velocidad-tend`. **Desde acá no se tocan**
> `VELOCIDAD_LLAMADA`, `HOJA_DE_AGENCIA` ni tests/dashboard-velocidad-codigo.test.ts. Regla nueva: AGENTS.md, «PROHIBIDO
> INVENTAR». Lo del costado y los textos editables sigue en pie.

## Lo pedido

Martín, 9/11: «finalizar el tema de dashboard… que hoy no son editables», y «el dashboard personalizado para los clientes de
Código Inmobiliario»: cuánto tarda cada inmobiliario en contactar a un lead desde que entra al CRM, con el botón de grabar.

## Lo que quedó en el código

- **El costado agranda** (antes creaba una flecha): los tiradores de unir van afuera de la tarjeta (`puntoDelTirador`).
- **Los textos de cada tarjeta de diseño se cambian**: dos toques sobre el texto, editando. El panel del bloque lista los cambiados
  con «Volver al original».
- **«Velocidad de llamada»**: tabla «Cada lead nuevo» a la vista (por lead, tramo, canal, minutos; la fila abre la ficha) debajo del
  primer contacto.
- **La tarjeta «Primer contacto»**: cuando la mayoría sale sin contactar, explica que MaKo sólo ve lo grabado y trae «Grabar llamada».
- **Cada cliente aprobado de Código (agencia 13) ve «Velocidad de llamada»** si nunca guardó su Dashboard (`HOJA_DE_AGENCIA`, y
  app/dashboard/page.tsx la muestra con `esHojaDeAgencia`): no se escribe nada en su negocio hasta que la persona toca algo.

## Verificado en producción (9/11, noche)

- ws 3 (prueba): el costado agranda la tarjeta (borde de 92 a 330 px) sin crear una flecha; dos toques cambian el título, sobrevive
  a recargar y «Volver al original» lo devuelve (quedó como estaba).
- ws 15, 17, 18, 19, 20, 22 y 23, mirando como superadmin (sin escribir nada: la base sigue con las mismas dos filas): la pestaña
  «Velocidad de llamada» al lado de Focus, con «Grabar llamada», «Primer contacto» y el aviso de grabar donde hay leads sin contactar.
  ws 18 y 23: sin leads nuevos en 30 días.
- «Cada lead nuevo»: medida en el server con la misma agregación y el mismo formato (Natalia 50 filas, «26 días 6 h»). La captura
  de la tabla con días y horas quedó pendiente: esa noche el Chrome de Martín grababa clases (THE NET LAB) y no se podía usar, ni el
  navegador integrado con la RAM que había.
- La captura de «Cada lead nuevo» ya no hace falta: la hoja se rehace (ver arriba). **Sí queda:** cerrar la pestaña del grupo de
  Claude que quedó abierta en el Chrome de Martín (en ws 23), cuando el grabador termine (docs/relevo/grabar-clases-thenet.md).

## Producción: qué se escribió y qué no

Los Dashboards YA GUARDADOS en los negocios de Código no reciben la hoja solos (es escribir datos de un cliente). Medido el 9/11:
ws 15 (sub 10) y ws 23 (sub 27). Script, que sin `--escribir` sólo mira:
`C:\Users\marti\AppData\Local\Temp\claude\fb1d94a1aca5ced3\59eaa8ef-0b34-4e77-b927-ff2bd794a546\scratchpad\instalar-velocidad.mts`
(se corre desde el worktree con `node --conditions=react-server --env-file=<clon>/.env.local --import tsx <script>`). Va sólo con el
sí de Martín escrito en el chat. **Y no antes de que la versión Tend esté en main:** el script instala el `VELOCIDAD_LLAMADA` del
código desde donde se corre, así que desde este worktree instalaría la rechazada. Se corre desde un checkout con la nueva, y
reconoce «ya la tiene» por `plantilla === 'velocidad-llamada'`: si la nueva cambia ese id, hay que ajustarlo.

## El mensaje para Juanfran (borrador, NO enviado: lo manda Martín)

**⛔ No mandarlo así:** describe la hoja rechazada. Se reescribe con lo que traiga la versión Tend.

> Juanfran, ya está en MaKo. Cada cliente tuyo tiene en su Dashboard la hoja «Velocidad de llamada»:
> • Arriba, el botón «Grabar llamada»: eligen el lead y graban.
> • «Primer contacto»: cuánto tardan en contactar a un lead desde que entra al CRM (la mediana, el % en la primera hora y
>   cuántos siguen sin contactar).
> • «Cada lead nuevo»: cada lead con lo que tardaron.
> Ojo: MaKo sólo ve el contacto si la llamada se graba con ese botón (o si le escriben por WhatsApp desde la línea conectada).
> Hoy casi todos salen «sin contactar» porque llaman del celular sin grabar. Si graban cada llamada, el número es real.

## Lo que falta

- La API de MaKo sin persona (lib/api-mako/areas/dashboard.run.ts:167) lee el inicial sin la hoja de la agencia.
- Una vista de la AGENCIA con una fila por cliente («cuánto tarda cada inmobiliario»): no existe.
- La hoja de prueba «Velocidad de llamada» del ws 3 (gmw9rp65n2kd1) sigue ahí: es el negocio de prueba.
