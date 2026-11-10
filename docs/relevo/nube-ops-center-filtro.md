# Relevo — Ops Center: sólo las decisiones de Martín, un chat por tab y el «Completado» que dice qué (nube, 10/11/2026)

Chat: «Ops Center» en la nube (`cli_b4bb6cd6-f68b-5162-ae59-96d6e5078bd4`). Rama `claude/wizardly-faraday-dpqw18`, subida también a
`punta/ops-center-filtro`. El aprendizaje, en `docs/hallazgos-operaciones.md` (las dos entradas del 10/11).

## Lo pedido (Martín, 10/11/2026, por el Cerebro)

1. *«Me están llegando un montón de preguntas al Ops Center… Son preguntas técnicas… Que solamente me llegan las preguntas de
   decisiones importantes. Y nunca tiene que ser con lenguaje técnico que yo no entiendo.»* Hacer cumplir en el código la regla de
   AGENTS.md «A MARTÍN SÓLO LE LLEGAN SUS DECISIONES» (ya está en main: `e132df2c`).
2. *«se están creando una cantidad de chats impresionante… La idea era tener un chat por cada tab de MaKo.»* La lista agrupada por
   tab, los de tarea plegados, los dormidos fuera.
3. *«las tarjetas de completado… que yo rápidamente pueda identificar qué se completó… qué funcionalidad, qué feature, qué tab.»*

## Lo hecho

- **El juez** (`lib/pregunta-para-martin.ts`, puro, y su copia en `scripts/operaciones/cartero.mjs` con test diferencial): una
  pregunta no le llega a Martín si trae jerga (ramas, tests, tipos, RAM, CI, commit, deploy, archivos, `{{…}}`, camelCase…), si le
  pide un hecho que el chat puede medir («¿te llegó?», «¿conectaste Chrome?», «¿liberaste RAM?») o si es sobre qué hace primero el
  chat. El tema de Martín (plata, clientes, accesos, seguridad, fechas, campañas, «aprobar») la rescata cuando ya llegó.
- **Dónde corre, y por qué ahí:**
  - `cartero preguntar` la RECHAZA al escribirla: sale con código 3 y el motivo («decídela tú con la opción recomendada…»).
  - El hook `sin-ask` niega el AskUserQuestion técnico con el mismo motivo.
  - El servidor esconde las que ya habían llegado: el bloque, el globito, la fila y la Ticketera (`esperaAMartin`), y la API las
    marca `para_el_chat: true` para que el Cerebro las vea.
  - Elegí «vuelve al chat» y no «a una cola del Cerebro» porque las respuestas las firma sólo el dispositivo de Martín: una cola
    que mira el Cerebro no tendría cómo contestarse. La de la fuente se prueba de punta a punta (el cartero y el hook, ejecutados
    en el test).
- **El globito guardado se recuenta una vez** (`recontarAbiertasSiCambioLaRegla`, en la vuelta del Runner): el mapa se contaba al
  escribir y seguía con las técnicas de antes.
- **Un chat por tab:** la fila es la tab; los chats de tarea van adentro, plegados detrás de «Mostrar N chats» (teléfono: «Ver N
  chats más»). Lo que espera, trabaja o se mira queda a la vista. Un chat sin actividad hace 3 días sale de la lista y no sube el
  globito (el Cerebro nunca).
- **«Completado» con qué:** «Image · Portadas de carruseles», en el hilo y arriba de la caja, computadora y teléfono. Sale del
  sub-chat, del título de un chat de tarea o del «Voy a trabajar en…» de ese tramo; sin nada, «Completado».

## Lo que tiene que correr el Cerebro (en la PC, después del deploy)

```bash
node scripts/operaciones/cartero.mjs instalar
```

Con el Runner quieto, como siempre. Hasta que el cartero 1.27.0 esté instalado, `preguntar` sigue aceptando las técnicas; el
servidor igual las esconde.

```bash
cp scripts/claude-hooks/guardia/sin-ask.mjs ~/.claude/guardia/sin-ask.mjs
```

- El deploy lo saca el cron de la mañana; no hace falta `desplegar-ya`.
- El recuento del globito se hace solo en la primera vuelta del Runner después del deploy.

## Lo que no se midió

- **No se miró en pantalla:** la nube no ve producción ni la base. Se armó con piezas que ya estaban (el «Mostrar más» de la lista,
  `co-jefe__nombre`, la fila del teléfono) y se verificó dibujándolas en los tests.
- **«Observer»:** no aparece en el repo. Si Martín llama así a otra pantalla, falta saber cuál.
- **Escapes conocidos del juez:** «¿Abro la ventana?» y «¿Terminamos esto y después creamos otra landing?». Están en el banco como
  `escapa`.

## Autocrítica

- **Cambié:** la tarjeta dice la tab y la función en el mismo lugar donde decía «Completado», con el ✓ verde al lado. No agregué
  otra línea. El lector de pantalla sigue oyendo «Completado».
- **Cambié:** «perfil» y «documentación» no agrupan solas cuando aparecen adentro de un título («Arreglar filaPropia del perfil» caía
  en la tab Perfil).
- **Cambié:** un chat de tarea solo en su tab es su propia fila, sin el nombre de la tab arriba.
- **Descarté** la cola del Cerebro para las preguntas técnicas: sin la firma de Martín, nadie podría contestarlas.
- **Descarté** marcar las dormidas «para el Cerebro» con un estado nuevo: salen de la lista y quedan en la API como siempre.
