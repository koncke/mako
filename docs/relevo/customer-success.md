# Retomar: Customer Success

**Dónde quedó:** 27/09, 10:17. Sesión `63c156e8`, abierta el 25/09. Sólo alcanzó a
cosechar antes de cerrar.

## El hilo

**`22528fd5`** marcó como **SIN OBJETO** los pendientes del 24/09 del programa de Mauricio,
porque el código al que apuntaban se borró el 26/09. El commit dice de dónde se recuperan:
**`07d07139^`**.

## La decisión grande que nadie tomó

⚠️ El **programa de Customer Success de Mauricio** — Whop + 44 clases + el formulario de
114 preguntas + la reescritura post-junta — **salió del producto entero el 26/09** con
`07d07139` y `5c4846f7` (el pedido fue «desde 0, no tomes en cuenta lo de Mauricio»). Su
**fase 1.1 tenía fecha 27/09**, o sea que ya venció.

Sólo se recupera de git. **Dónde vive ahora quedó como pregunta abierta, sin decidir.**

Empezá por ahí: presentale a Martín las opciones de dónde puede vivir. **No toques código
todavía.**

## Lo otro que está trabado

El **mensaje de 4 preguntas a Mauricio sigue sin mandarse**: ¿grabó algo y dónde está?,
¿la planilla es el documento de temarios?, ¿cuándo termina las plantillas P0-P11?, ¿sus
clientes entran gratis a Whop y quién los da de alta? **No hay llamada con él hasta el
15/10**, así que todo lo que dependa de Mauricio se destraba por mensaje o no se destraba.

## Dónde leyó y escribió esta sesión

memoria `customer-success-mauricio`.

---

## Lo que vale para cualquier chat de este relevo

- **Somos `claude2` (Leandro Tejado).** Antes de firmar un commit releé el marcador:
  `head -1 ~/.claude/cuenta-activa.txt`. Lo que te inyectó el hook al arrancar es una
  **foto** y no se entera si Martín cambia de cuenta con la sesión abierta.
- El trailer `Claude-Cuenta:` va **pegado** a `Co-Authored-By:`, sin línea en blanco: git
  sólo parsea el último bloque contiguo.
- **Suele haber otra sesión sobre el mismo clon.** `git status` antes de commitear,
  siempre por **ruta explícita**, nunca `git add -A`.
- ⚠️ **Bootear local ESCRIBE en la Supabase de PRODUCCIÓN.** Un blur del detalle guarda
  en el tablero real de Mauricio.
- ⚠️ **`ws3` está EN CERO.** El clon con datos es **`ws4` «Cliente de Diseño»**
  (300 leads). La memoria del proyecto todavía dice ws3: un script que lo use mide cero
  y no falla.
- El estado completo de los 16 días está en [`docs/relevo.md`](../relevo.md).
