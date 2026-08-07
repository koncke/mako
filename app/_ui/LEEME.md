# app/\_ui — la biblioteca de primitives

Esto es la **Fase 1 del rediseño** (tareas #516, #518, #519 y #521 del board).
Se construyó primero y a propósito: el diagnóstico del documento es que
_«el rediseño no debe comenzar corrigiendo pantallas aisladas»_ — sin primitives,
cada tab vuelve a resolver localmente los mismos problemas.

Lo que se medía sobre `app/` antes de empezar: **7.510** `style={{…}}` contra
767 `className`, **1.158** `<button>` sueltos, 269 `<input>`, 93 `<textarea>` y
**2 media queries** en todo `globals.css`.

---

## Cómo se usa

```tsx
import { Button, TextField, Select, EmptyState, Status } from '@/app/_ui';
```

Desde un **Server Component**, si solo necesitás la escala:

```tsx
import { radius, type, TONO } from '@/app/_ui/tokens';
```

Las clases `mk-*` (`ui.css`) están disponibles en cualquier pantalla sin
importar nada: `globals.css` las carga una vez.

---

## La regla de color

Un color, un significado. Está escrita completa arriba de `app/globals.css`.
El resumen:

| Color | Token | Qué dice |
|---|---|---|
| 🟡 Dorado | `--mako` | **MaKo**: marca, y «acá intervino la inteligencia» |
| 🔵 Azul | `--primary` | **vos actuás**: botones, links, foco, selección |
| 🟢 Verde | `--good` | resultado favorable o completado |
| 🟠 Naranja | `--warn` | cuidado (**anaranjado a propósito**, para no confundirse con el dorado) |
| 🔴 Rojo | `--bad` | riesgo, error o destrucción |

Hay **un solo hex dorado**: `#F2B01E`. `--mako-lite` (gradientes de marca) y
`--mako-ink` (texto legible sobre claro) derivan de él. Antes había cuatro
dorados distintos para la misma marca.

**Corolarios que el código tiene que cumplir:**

- El **estado activo** de la navegación no depende del dorado: contraste de
  superficie + indicador lateral + peso tipográfico.
- Los colores de **categoría** (proyectos, canales, etapas) van en `<Tag>` y
  nunca compiten con los estados semánticos.
- **Nadie define su propio hex dorado.** Si lo necesitás, es `var(--mako)`.

---

## Qué hay

### Acción

| Pieza | Cuándo |
|---|---|
| `Button` | `primary` una sola por vista · `secondary` · `tertiary` · `danger` · `mako` (se lo pedís a la IA, nunca para navegar) |
| `ButtonLink` | se ve como botón pero **navega**: es un `<a>` de verdad |
| `IconButton` | solo ícono. `title` obligatorio |
| `useOkFlash()` | el «éxito temporal» del botón, para no tirar un toast por cada «Guardado» |

### Entrada

| Pieza | Cuándo |
|---|---|
| `TextField` | el caso completo: label + control + ayuda/error + contador |
| `Field` / `Input` / `Textarea` | por separado, cuando el control va pelado (fila de tabla) |
| `Select` | desplegable. **Nunca `<select>` nativo.** Con búsqueda automática pasadas las 8 opciones |
| `Checkbox` | varias opciones independientes, se guarda al confirmar |
| `Radio` / `RadioGroup` | una entre varias. Si son más de cinco, va un `Select` |
| `Switch` | prende o apaga **ya**. Si necesita un «Guardar» después, es un `Checkbox` |

### Señalización

| Pieza | Cuándo |
|---|---|
| `Badge` | un **contador** o una novedad. *Si todo tiene badge, nada tiene badge* |
| `Tag` | una **categoría**. Color libre, sin carga semántica |
| `Status` | un **estado** semántico, con punto de color |
| `Tooltip` | explica un ícono o un KPI. **Nunca** información que no esté en otro lado (en mobile no hay hover) |
| `Avatar` | foto o iniciales |

### Espera

Los tres dicen cosas distintas y no son intercambiables:

| Pieza | Cuándo |
|---|---|
| `Spinner` | «trabajando, no sé cuánto falta» |
| `Progress` | «voy por acá» — solo si conocés el total |
| `Skeleton` / `SkeletonLines` | «esto va a ser contenido» — primera carga |

### Estructura de página

| Pieza | Cuándo |
|---|---|
| `Pagina` | **el `<main>` de la pantalla.** Siempre. Es lo primero que se abre y lo último que se cierra |
| `Lectura` | adentro de `Pagina`, para el texto largo: le pone tope de 70 caracteres por línea |
| `PageHeader` | va en casi todas las pantallas: título, **una línea de propósito**, estado, filtros y **UNA** acción primaria |
| `Section` | agrupación por título y aire. La tarjeta es **opt-in** (`card`) — envolver todo produce padding sobre padding |
| `Eyebrow` | la etiqueta en versalitas y mono que rotula un bloque |

La línea de propósito dice **qué pregunta responde** la pantalla. No es la bajada
decorativa que la regla de la casa prohíbe: si se deduce del título, dejala vacía.

#### El ancho: una pantalla no elige el suyo

Síntoma repetido: se agrega una pantalla y **no llega al borde**, queda una franja
vacía a la derecha. Nadie la puso ahí a propósito.

No hay ninguna regla escondida, y ese es justamente el problema: **cada pantalla
escribía su propio `<main>`**, así que cada una elegía su padding y su `maxWidth`
por separado. Medido sobre `app/` antes de arreglarlo: 16 pantallas con
`padding: '34px 44px 60px'`, 7 variantes sueltas más, y `maxWidth` de 1000, 1100 y
1200 según quién la escribió. Copiar la pantalla de al lado propagaba el número.

Ahora el `<main>` lo pone `Pagina`, y su prop `style` está tipada
`Omit<CSSProperties, 'maxWidth' | 'width'>`: una pantalla **no puede** fijarse el
ancho aunque quiera — el compilador lo rechaza. La regla la sostiene `tsc`, no la
memoria de quien edita.

```tsx
<Pagina>                     {/* ocupa todo lo que le deja el shell */}
  <PageHeader … />
  <Section …>…</Section>
</Pagina>
```

- `densidad="compacta"` para las pantallas de trabajo denso (tableros, bandejas).
- Si lo que necesita tope es **texto**, el tope va en el párrafo (`Lectura`), no en
  la página: un `maxWidth` en el `<main>` también angosta las tablas y los grids,
  que es lo contrario de lo que se quería.
- Una pantalla que de verdad necesite otra caja (un canvas, un split), que use
  `flex`/`grid` adentro de `Pagina`, no un ancho fijo afuera.

### Los estados de pantalla (#519)

Ninguna vista puede quedar en blanco sin decir qué pasó y qué hacer.

| Pieza | Qué significa |
|---|---|
| `EmptyState` | no hay contenido **todavía**. Explica el propósito y el primer paso |
| `NoResults` | **sí** hay datos, el filtro no encontró nada. La salida es limpiar |
| `ErrorState` | falló. Qué pasó (en castellano) + reintentar |
| `StaleData` | cinta sobre el contenido: esto es del *tal día a tal hora* |
| `PermissionState` | existe pero no te toca (`rol` o `plan`) |
| `Banner` | cinta de alcance **global o de módulo**, arriba de todo |
| `Alert` | la misma cinta, pegada a **lo que afecta** |
| `Confirm` / `useConfirm()` | acciones irreversibles. **Una sola** implementación en toda la app |
| `Toast` / `useToast()` | aviso breve, con `Deshacer` si la acción es reversible |

`ComingSoon` (en `app/_components`) **no** es ninguno de estos: significa «esta
función todavía no existe».

⚠️ Un toast **no sustituye un registro de actividad** cuando la acción importa.
Si tiene que poder consultarse mañana, va al historial.

---

## Mobile (#521)

Está adentro del sistema, no es una capa posterior:

- Tipografía por variable: los siete niveles del §18.3 **suben solos** en
  pantallas de ≤820 px. Ninguna pantalla escribe una media query.

  | Token | Uso | Desktop | Mobile |
  |---|---|---|---|
  | `--fs-page` | Título de página | 30 | 26 |
  | `--fs-kpi` | KPI principal | 34 | 30 |
  | `--fs-sect` | Título de sección | 21 | 20 |
  | `--fs-card` | Título de tarjeta | 15.5 | 16.5 |
  | `--fs-md` | **Texto base** | 14 | 16 |
  | `--fs-sm` | Texto secundario | 13 | 14.5 |
  | `--fs-meta` | Metadata | 12 | 13 |

  No hay token por debajo de 12 px **a propósito**: el documento lo reserva para
  «información excepcionalmente secundaria». Si existiera, se usaría.
- Área táctil `--touch`: 40 px en desktop, **44 en mobile**. Todo lo clickeable
  la alcanza aunque el ícono sea de 16 (con padding, no agrandando el dibujo).
- `.mk-scroll-x` para lo ancho (tablas, barras de filtros): scrollea **dentro**
  de su caja. El `<body>` nunca scrollea de costado.
- `.mk-row--stack` apila los botones en pantalla chica en vez de comprimirlos.

---

## Reglas de crecimiento

1. **Si vas a escribir un número de diseño a mano, buscalo primero en `tokens.ts`.**
2. Si a un primitive le falta algo, **agregáselo al primitive** — no escribas el
   segundo. Eso es exactamente lo que produjo dos confirmaciones y tres campos.
3. Los estilos que necesitan `:hover`, `:focus-visible`, `:disabled` o animación
   van a `ui.css`. Un `style={{}}` no los tiene, y por eso la app terminó con
   1.158 botones que se ven distinto.
4. **El `<main>` de una pantalla es `Pagina`.** Ninguna pantalla escribe su propio
   ancho ni su propio padding de página.
5. Catálogo vivo en **`/admin/ui`**: si agregás una pieza, agregala ahí — y si la
   decisión tiene un porqué que no se deduce del código, va a la bitácora
   (`app/admin/ui/bitacora.ts`), que es la sub-tab «Rediseño».
