# Relevo — Centro de Operaciones (15/10/2026, tarde)

Escrito por el chat «Centro de Operaciones» (cuenta 1), al pasar el 85% semanal. Lo que costó cada cosa está en
`docs/hallazgos-operaciones.md`; lo que pidió Martín, textual, en `app/admin/dev/centro-operaciones/bitacora.ts`.

## Dónde quedó

- **El Centro abre en Chats** (`/admin/operaciones` y su versión del teléfono): cada chat de Claude con su estado
  —trabajando, abierto, cerrado o sin dato, con «visto hace…» si el cartero no da vueltas— y adentro lo que se le pidió
  y lo que hizo. Sale de `lib/centro-chats.ts`, unido por SESIÓN y nunca por título.
- **Avance** (ex Pedidos): los pedidos de Martín en Trabajando ahora · Sin empezar · Empezado · Terminado.
- **Pushes** y **Áreas** siguen como estaban.
- **Trabajos ya no es una pestaña** («No entiendo para nada la tab de "trabajos", eliminala»): mandar un trabajo
  firmado, los carteros y la clave están en el botón «Cartero y trabajos» del encabezado (en el teléfono, una fila al pie
  de Chats que abre una hoja).
- **El cartero de claude1 está instalado** en `~/.claude/operaciones` con el token de Martín. Nadie corre sus vueltas:
  falta el chat «Cartero» con su cron, y ése lo abre Martín.
- **Desde el 16/10, cada hito de trabajo de una bitácora lleva `sesion`** (lo exige `tests/progreso.test.ts`; la regla
  está en AGENTS.md). El coordinador ya avisó a los chats.

## Lo que sigue, en orden

1. ~~Pushes, como Martín lo pidió~~ **hecho** (15/10, tarde): ahora son las novedades de las bitácoras, por día, con «Verlo en la app». Falta mirarlo en un navegador.
   Lo que decía el pedido: (15/10, textual): «El tema de los pushes no lo pongas con lenguaje tecnico... Esa
   tab es para mi, quiero saber exactamente que se pusheo así puedo ir a ver y dar feedback de ese trabajo», y «No
   necesariamente como bullets, pero si texto formateado y bonito, y claro de leer». O sea: qué cambió para él (nada de
   hash, archivo, rama ni `feat:`), dónde mirarlo (link a la pantalla con su `?ws=`), agrupado por TRABAJO y no por
   commit, y sin inventar de qué chat vino (por la hora se acierta 110 de 202). La forma se copia de unas notas de
   versión que se lean bien, y la fuente se nombra en el commit. La materia prima buena son los hitos de las bitácoras
   (título y puntos en palabras de producto), no los mensajes de commit.
2. **La cáscara de Grok** para Chats: la cuenta de Martín está trabada en «confirma tu edad» y sin conversaciones. El
   coordinador avisa cuando haya algo que copiar. Lo que hay hoy es una tabla: la estructura no se tira.
3. **Mandar un trabajo desde adentro de un chat** (la caja de abajo de la conversación), y sacar el modal.
4. Lo de siempre, en `docs/hallazgos-operaciones.md` → «Lo que quedó sin hacer»: el chat Cartero, la clave de firma por
   dispositivo, el token de GitHub sin acceso a `hola-mako/dashboard-marketing`.

## No verificado

- La pantalla de Chats y el modal «Cartero y trabajos» **no se miraron en un navegador**: tipos y tests en verde, pero
  el último recorrido de escritorio y teléfono fue antes de este cambio.

## LO PRIMERO AL VOLVER: la vista de chats, con referencias que buscas VOS (15/10/2026)

Esta sesion se cerro cuando la app se reinicio, con el encargo sin entregar. Lo dejo escrito aca
porque es lo unico que sobrevive: Martin lo pidio tres veces y la ultima dijo «Lo sigo viendo igual».

**El pedido, textual:** «Al principio deberia haber una tab que simule los chats... Ahi te pido que
copies el diseño del grok. Copiala entera, porque nos puede servir... Que este todo muy bien diseñado.»

**Y como se destrabo**, textual del 15/10 por la tarde: «Pero que se guie de imagenes de pinterest o
cosas asi... Que busque referencias».

O sea: **Grok dejo de ser el bloqueo.** Su cuenta quedo trabada en un cuadro de «confirma tu edad» que
no se puede saltear (lo verifique dos veces en su Chrome: con ese cuadro abierto no se entra a ninguna
seccion, y la cuenta ademas esta vacia, sin una sola conversacion). No se espera mas.

**Que hacer:**

1. **Buscar referencias visuales y guardarlas.** Pinterest y Dribbble para la estetica; Mobbin y
   Collect UI para pantallas reales de apps de chat; capturas de prensa de Grok, ChatGPT, Claude,
   Linear o Slack. Mirar varias antes de elegir, y nombrar en el commit de donde salio cada idea.
2. **Sacar la ESTRUCTURA, no el arte de nadie:** que entra en una fila de la lista, cuanto respira,
   donde va el estado, como se marca la conversacion abierta, como se agrupa por tiempo (Hoy, Ayer,
   esta semana), donde viven el buscador y el plegado, y como se ve en un telefono.
3. **Los colores, la tipografia y los iconos son los de la casa** (`var(--token)`), nunca el hex de la
   imagen que se mire.

**El aviso de criterio, que es lo que una imagen linda no te dice:** una referencia de Pinterest es un
dibujo, no un producto. No contesta que pasa con 53 chats, con un nombre larguisimo, ni cuando no hay
ninguno. Esos tres casos los resuelve quien construye, y son los que deciden si la pantalla sirve. Si
una referencia pide un dato que no tenemos, gana el dato.

Y lo de siempre: que se VEA la lista de chats con su estado. El modelo ya esta medido y en main
(lib/centro-chats.ts); lo que falta es la cascara.

