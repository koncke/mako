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

1. **Pushes, como Martín lo pidió** (15/10, textual): «El tema de los pushes no lo pongas con lenguaje tecnico... Esa
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
