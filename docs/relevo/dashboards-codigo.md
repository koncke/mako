# Relevo — dashboards editables y la hoja de Código Inmobiliario (9/11/2026)

Rama: `punta/dashboards-codigo` (worktree `C:/dev/wt-dash-codigo`). Lo aprendido está en
[hallazgos-templates-dashboard.md](../hallazgos-templates-dashboard.md) §37; esto es sólo dónde quedó cada cosa.

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

## Producción: qué se escribió y qué no

Los Dashboards YA GUARDADOS en los negocios de Código no reciben la hoja solos (es escribir datos de un cliente). Medido el 9/11:
ws 15 (sub 10) y ws 23 (sub 27). Script, que sin `--escribir` sólo mira:
`C:\Users\marti\AppData\Local\Temp\claude\fb1d94a1aca5ced3\59eaa8ef-0b34-4e77-b927-ff2bd794a546\scratchpad\instalar-velocidad.mts`
(se corre desde el worktree con `node --conditions=react-server --env-file=<clon>/.env.local --import tsx <script>`). Va sólo con el
sí de Martín escrito en el chat.

## El mensaje para Juanfran (borrador, NO enviado: lo manda Martín)

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
