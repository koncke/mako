# Retomar: Tareas de llamada con Mauricio

**Dónde quedó:** 27/09, 10:16. Sesión `153a499a`, abierta el 16/09. Cerró limpia.

## El hilo

La **ficha de cliente de `/customer-success`**. El último pedido de Martín, textual:

> «al intentar abrir el detail se bugea y no abre nada, cambia la ruta y luego ya no me
> deja abrir el cliente» · «Cambiar portada al centro y solo al pasar el cursor»

Se cerró en **`72aa1109`**: dos bugs encadenados de la pila de modales, más cuatro que
nadie había reportado.

## Lo primero que hay que mirar

⚠️ **El auto-scroll del arrastre dentro del modal nunca se ejercitó con un arrastre real.**
Es lo único que `72aa1109` tocó y no se probó. Resuelve el scroller una sola vez en el
`dragstart`, porque durante un arrastre nativo el navegador congela `requestAnimationFrame`
**y** los timers. **Ningún test lo caza: es un gesto.**

Vive en `app/plan/board/BoardShell.tsx`.

## Dónde leyó y escribió esta sesión

`docs/hallazgos-customer-success.md` · `docs/hallazgos-ui.md` · `docs/hallazgos-plan.md` ·
la regla «Montar una PANTALLA adentro de un modal» en `AGENTS.md` · memoria
`cs-ficha-cliente`.

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
