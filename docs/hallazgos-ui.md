# Hallazgos de la UI compartida

Las piezas de `app/_components` y `app/components` las usan **todas** las tabs: un cambio
acá tiene 20+ llamadores. Esto es lo que hay que saber antes de tocar `WizardShell`, la
pila de modales o el progreso de un formulario. **No es un changelog.**

Origen: corridas multi-agente de 08/2026 (wizard del CRM + onboarding). Regla de la
cosecha en `AGENTS.md`.

---

## 1. WizardShell y el progreso

### Dos modos de la misma pieza tienen que contestar igual

**Síntoma:** el wizard pinta **"Último paso (7)"** y justo abajo el botón dice
**"Siguiente →"**.

**Causa:** `WizardShell` acepta el progreso de dos formas —`pasos` + `pasoActual` (el mapa)
o `total` + `idx` (dos números)— y respondían **distinto al mismo estado**. Con la cuenta
en cero y `enUltimo` en `false`, el modo `total` decía "faltan pasos" (bien) y el modo
`pasos` se creía en el final.

**El diagnóstico obvio era el equivocado.** Parecía inalcanzable: en el único llamador del
modo nuevo, el resumen siempre era el último del mapa. Se volvió alcanzable **al migrar el
onboarding**, cuyo mapa son **secciones** y tiene varias pantallas por sección. O sea: el
bug latente lo activa la migración siguiente, no el código que lo contiene. El orden de
las dos tareas importaba y nadie lo había mirado.

**Dónde:** la aritmética se mudó a `app/_components/wizard-progreso.ts` (pura, con tests).

**Regla escrita ahí: `enUltimo` gana en las dos direcciones.** Si dice que es el último, no
hay cola; si dice que no lo es y la cuenta da cero, la que miente es **la cuenta**. Y
cuando una pieza acepta dos formas de recibir lo mismo, la aritmética vive en **una**
función pura que las dos llaman — si no, el segundo modo es el que se queda viejo.

### Los dots mienten si `total` no es confiable

La posición actual siempre es verdad; la **cola solo existe si se puede contar**.
`futuros = -1` (faltan, cantidad desconocida) pinta tres puntitos de 4px, no puntos-paso.
Colapsa cuatro casos: `total` desconocido, `idx >= total`, `enUltimo` con `total` mayor, y
**salto hacia adelante** — si el wizard se saltea pantallas, `total` deja de servir.

Ese estado se marca **en render, no con `useEffect`**: con efecto, el primer frame del
salto sigue mostrando la fila vieja, que es justo la mentira que se quería sacar.

En el modo `pasos` la cuenta es **exacta** mientras el mapa no se mueva; si el mapa cambia
estando a la vista, pasa a "faltan pasos" y se queda ahí (pegajoso). **Los cambios de mapa
mientras la pieza está trabada por `cargando` no cuentan**: ahí el mapa se está armando y
el usuario no pudo leer ninguna promesa. La comparación mira también el `trabado` del
render **anterior**, porque la respuesta que apaga el loader trae el mapa nuevo en el mismo
commit.

### El chrome forkeado es donde vuelven los bugs ya arreglados

El wizard con ramas de verdad (`app/crm/StageMoveDialog.tsx`) tenía su **propia copia** del
header, los puntitos, el footer y el loader — ~60 líneas. Ahí vivía un bug de z-index que
la pieza compartida no tiene, y ahí no llegaba ninguna mejora del progreso.

**Regla:** el marco se importa; lo que se queda en el llamador es el **contenido** y la
**navegación** (qué pasos hay, cuándo se puede avanzar). Si el llamador necesita algo que
el marco no da, se le agrega al marco como modo — con la aritmética compartida, ver arriba.

Detalle de contrato que se descubrió al migrar: el prop `error` es **una línea de texto**.
Una lista de faltantes con un botón "Completar lo que falta →" va como último hijo del
cuerpo, no ahí.

---

## 2. La pila de modales

### Un `zIndex` literal en una pieza que se apila queda debajo del backdrop

**Síntoma:** confirmás, la pantalla **no se mueve** y nada explica por qué. Ni error, ni
spinner, ni cartel.

**Causa:** el loader y el cartel final "Datos actualizados" tenían `zIndex: 100`
hardcodeado, y la pila de modales (`useCapaModal`) arranca en **130**. Estaban pintados,
debajo del backdrop. Dos síntomas idénticos, dos literales distintos, el mismo error.

**Regla:** una pieza que se monta apilada **no elige su z**: lo hereda de la capa
(`capa.z`), o se pinta **dentro** de la tarjeta con `position: absolute` sobre un
contenedor `relative` — así hereda el z que la capa ya le dio. Un número literal en un
overlay es una apuesta contra el orden de montaje.

Del mismo arreglo: la cortina del loader usa `var(--surface)` en una capa propia y no un
`rgba(255,255,255,.78)` fijo, que en tema oscuro era un flash blanco. **Ningún color fijo
en un overlay.**

### El loader tiene que tapar también el header y el footer

Es donde están los botones que no hay que tocar: ✕, Atrás, Siguiente/Confirmar y el click
en el backdrop. Tapar solo el cuerpo deja la salida abierta a mitad de una escritura.

| Trampa | Dónde | Qué hacer |
|---|---|---|
| **`getComputedStyle` con la pane oculta devuelve valores viejos** | UI general | Verificar por el style inline o un `data-*`. |
| **Un componente declarado dentro del render remonta todo** | visto en `app/crm/SelectorHora.tsx` | Generar las filas con una **función que devuelve el elemento**. Como componente anidado, React remontaba las 61 opciones con cada tecla y tiraba el scroll al principio. |

---

## 3. Lo que quedó sin hacer

| Qué | Dónde | Por qué |
|---|---|---|
| **`WizardShell` llama a `useCapaModal` pero nunca engancha `capa.refScroll`** al contenedor que scrollea | `app/_components/WizardShell.tsx` | La restauración de scroll al volver de un modal apilado **no funciona en ningún wizard**. Engancharlo es un cambio de comportamiento para los 24 llamadores: merece su propia pasada. |
| **21 llamadores siguen en el modo `total`/`idx`** | `app/**` | No es deuda por sí sola (ver descartado), pero cada uno que tenga el mapa en la mano y lo aplane a dos números es un `indexOf` duplicado. |

### Descartado a propósito (no volver a "arreglarlo")

- **Migrar `app/chat-bot/SecuenciaWizard.tsx` al modo `pasos`.** Se revisó y **no duplica
  nada**: su `idx` es un índice de estado real, no un `pasos.indexOf(...)` recalculado. Es
  exactamente el caso para el que existe `total`/`idx`. El criterio para migrar es *"¿el
  llamador tiene el mapa y está recalculando la posición?"*, no *"¿existe un mapa?"*.
