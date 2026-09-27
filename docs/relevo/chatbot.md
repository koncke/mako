# Retomar: Chatbot

**Dónde quedó:** 27/09, 10:16. Sesión `899c848a`. Cerró limpia.

## El hilo

El **setting / nutrición movido a `/whatsapp`**. El último pedido de Martín, textual:

> «la ruta de no oficial y oficial deben ser diferentes, para poder enviar el link
> correcto»

Cerrado en **`6f0019cf`**.

## Lo primero que hay que hacer

⚠️ **Medir el estado vivo antes de escribir una línea.** Según la memoria
`seguimiento-agendados-prendido`, al 27/09 el chatbot **nunca mandó un mensaje**, y lo que
falta **no es código**: que Mauricio escanee el QR (sigue en `conectando`). La cola quedó
vacía, los escenarios en 0, y el Perro le pisó el score a esa tarjeta.

Confirmá eso primero contra producción y decile a Martín si cambió. Si sigue igual, el
trabajo no se destraba del lado del código.

## Dónde leyó y escribió esta sesión

`docs/hallazgos-comunicacion.md` · memoria `seguimiento-agendados-prendido`, con el estado
vivo medido **antes** de escribirla.

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
