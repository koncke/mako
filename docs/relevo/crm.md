# Retomar: CRM

**Dónde quedó:** 27/09, 10:16. Sesión `c82dcecc`. Cerró limpia.

## El hilo

La **fricción del CRM, por tandas**. Dos pedidos textuales de Martín, en orden:

> «no entiendo las 3 cards grandes… ¿o las de abajo ya las aplicaste?»

> «bajá la complejidad, tené criterio de cuándo lanzar multiagentes» · «aplicá los
> cambios por tandas y decime cómo probar cada uno»

La **tanda 1** se cerró en **`50df1cb2`** — los 3 bugs que no necesitaban decisión — con
sus 4 pasos de prueba escritos.

## Lo que sigue

- La **tanda 2 espera luz verde de Martín**. No la arranques sin pedirla.
- Hay **TRES decisiones esperando a Mauricio**. Antes de proponer nada, decile a Martín
  en qué quedó cada una.
- El segundo pedido es una regla de proceso, no del CRM: **orquestar al tamaño del
  cambio**. Un panel de agentes sobre algo que Martín ya decidió es ceremonia.

## Dónde leyó y escribió esta sesión

`docs/hallazgos-crm.md` · memorias `friccion-crm-por-tandas` y `orquestacion-al-tamano`.

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
