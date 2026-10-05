# Retomar: Customer Success

**Dónde quedó:** 05/10, 11:30. Sesión `7a6bc4be`. Cierre por cambio de cuenta
(`claude2` → `claude1`), con el árbol en verde y todo pusheado y desplegado.

## Lo que SÍ está hecho y desplegado

La tab tiene el **kanban de la entrega de un servicio** andando de punta a punta, y es la
vista por defecto. Diez commits del 05/10, el último `50a2a672`, **Ready en producción**
(verificado con `vercel ls`).

| Qué | Dónde vive |
|---|---|
| Las dos tablas (`producto_entrega`, `cliente_entrega`) | `supabase/migrations/0188_entrega_servicio.sql` — **aplicada a prod** |
| El catálogo PURO (etapas, FASES, el reparto, el conteo) | `lib/servicio-etapas.ts` |
| El ÚNICO camino de escritura de `cliente_entrega` | `lib/cs-mover-etapa.ts` |
| Las lecturas del server | `lib/entrega-servicio.ts` · `app/customer-success/entrega.ts` |
| El tablero, los chips de fase y el arrastre | `app/customer-success/KanbanEntrega.tsx` |
| El editor de etapas (molde del CRM, guarda solo) | `app/customer-success/EtapasEntregaModal.tsx` |
| La pantalla y la barra (compartida con `/admin`) | `app/customer-success/ClientesApp.tsx` · `BarraClientes.tsx` |
| El arrastre importado del Plan | `app/plan/board/arrastre-copia.ts` |
| Los guards de cableado (11, probados rompiéndolos) | `tests/cs-kanban-fases.test.ts` |
| El modelo (33 tests) | `tests/servicio-etapas.test.ts` |

**Las siete decisiones que gobiernan la tab** están en la memoria `cs-ficha-cliente`, y la
cosecha completa de las dos tandas del 05/10 al final de
[`docs/hallazgos-customer-success.md`](../hallazgos-customer-success.md). La bitácora de
`/admin/dev/customer-success` tiene los cinco hitos del día con **el pedido literal de
Martín**, sin resumir.

## Lo que falta, en orden

1. **Las secuencias de nutrición no se disparan por la etapa de entrega.** Es lo único
   grande que quedó a medias del modelo: `moverClienteDeEtapa` ya llama a
   `enrolarPorEvento(leadId, 'entrega', { etapa, productoId })`, pero el motor espera un
   **EMBUDO** donde esto tiene un **PRODUCTO** (`CtxEvento.funnelId`), y `secuenciasDeEtapa`
   compara la etapa con `===` contra las claves del embudo. El choque entre los dos
   defaults es CERO hoy, así que no rompe nada: simplemente no dispara. El detalle está en
   la cosecha.
2. **La ficha no es linkeable.** Qué cliente está abierto vive en estado de React, así que
   un F5 la cierra y un link copiado no lleva a nada. Un `?cliente=<leadId>` leído en el
   server lo resuelve.
3. **Los chips de fase son UNA fase a la vez, con un «Todas».** Lo elegí así porque con
   interruptores independientes (como el CRM) se puede apagar el último y quedarte con el
   tablero vacío sin nada que lo explique. **Martín no lo confirmó**: si lo prefiere igual
   al CRM, es un cambio chico y hay que agregarle la guarda de «no se puede apagar la
   última».
4. `catalogoAsignable` sigue sin call site en `app/customer-success/trabajo.ts`.
5. El botón ✨ del tablero todavía puede abrir la bienvenida a mano encima de la ficha.

## La decisión grande que sigue sin tomar

⚠️ El **programa de Customer Success de Mauricio** — Whop + 44 clases + el formulario de
114 preguntas + la reescritura post-junta — **salió del producto entero el 26/09** con
`07d07139` y `5c4846f7` (el pedido fue «desde 0, no tomes en cuenta lo de Mauricio»). Su
fase 1.1 tenía fecha 27/09, o sea que venció hace una semana.

Sólo se recupera de git: **`07d07139^`**. **Dónde vive ahora SIGUE SIN DECIDIR** — no se
tocó en la sesión del 05/10, que fue entera sobre el kanban de la entrega.

Empezá por ahí: presentale a Martín las opciones de dónde puede vivir. **No toques código
todavía.**

## Lo otro que está trabado, y tampoco se movió

El **mensaje de 4 preguntas a Mauricio SIGUE SIN MANDARSE**: ¿grabó algo y dónde está?,
¿la planilla es el documento de temarios?, ¿cuándo termina las plantillas P0-P11?, ¿sus
clientes entran gratis a Whop y quién los da de alta? **No hay llamada con él hasta el
15/10**, así que todo lo que dependa de Mauricio se destraba por mensaje o no se destraba.

## Las tres trampas que más tiempo ahorran en esta tab

1. ⚠️ **El reparto de clientes en columnas es DERIVADO, no sembrado**: un cliente sin fila
   en `cliente_entrega` está en la PRIMERA etapa, y la regla vive en UNA función
   (`repartirEnEtapas`) que usan el tablero Y el conteo del editor. **Toda función que
   aplique esa regla necesita el UNIVERSO de clientes, no las filas de la tabla** — se pagó
   el 05/10 con un editor que decía «0 clientes» sobre una columna con 5 tarjetas, y ese 0
   apagaba el «¿seguro?» al borrarla. La regla general quedó en `AGENTS.md`.
2. ⚠️ **Los dos templates de estilos (`KanbanEntrega` y `EtapasEntregaModal`) no admiten
   NI UN backtick adentro**, ni en un comentario. La convención de la casa es nombrar una
   clase entre backticks y eso **cierra la cadena a la mitad**: la pantalla contesta 200 con
   el layout entero y sin una sola fila, y el typecheck señala líneas que no tienen nada que
   ver. Pasó dos veces el 05/10. El chequeo, antes del typecheck:
   `node -e "const s=require('fs').readFileSync(RUTA,'utf8');const i=s.indexOf('const CSS = ');console.log((s.slice(i).match(/\`/g)||[]).length)"` — **dos** es lo correcto.
3. ⚠️ **Verificar esta tab en el navegador ESCRIBE en producción.** Para el kanban hace
   falta un producto activo y leads `ganado`, y el ws3 (Cliente de Prueba) **está en cero**:
   hay que sembrarlo y devolverlo a cero. Y ojo con `onboarding.state`: el ws3 no la tiene,
   así que `/customer-success` redirige a `/onboarding` hasta que se la cree — y **restaurar
   es BORRARLA**, no dejarla en un valor. Los scripts de sembrar y limpiar quedaron en el
   scratchpad de la sesión `7a6bc4be`; se reescriben en diez minutos leyendo esta nota.

## Dónde leyó y escribió esta sesión

`docs/hallazgos-customer-success.md` + su fila en `docs/hallazgos.md` · `AGENTS.md` (dos
reglas nuevas: el `doesNotMatch` sin comentarios, y «una regla DERIVADA necesita el
UNIVERSO») · `app/admin/dev/customer-success/bitacora.ts` · memoria `cs-ficha-cliente`.

---

## Lo que vale para cualquier chat de este relevo

- ⚠️ **A partir de este relevo somos `claude1` (Mauricio)**, no `claude2`. Antes de firmar
  un commit releé el marcador: `head -1 ~/.claude/cuenta-activa.txt`. Lo que te inyectó el
  hook al arrancar es una **foto** y no se entera si Martín cambia de cuenta con la sesión
  abierta.
- El trailer `Claude-Cuenta:` va **pegado** a `Co-Authored-By:`, sin línea en blanco: git
  sólo parsea el último bloque contiguo.
- **Suele haber TRES sesiones sobre el mismo clon, no dos.** `git status` antes de
  commitear, siempre por **ruta explícita** y también en el `git commit -- <rutas>`, nunca
  `git add -A`. Al 05/10 quedaba sucio `lib/workspace.ts`, que es la feature de `replay`
  (mig 0191) de otra sesión: **no es de Customer Success, no la toques**.
- ⚠️ **Un reporte sobre el árbol se FECHA o no se entiende.** El 05/10 llegó un aviso de
  que mi edición bloqueaba el push de todo el repo; era una foto de la ventana en la que
  estaba tipeando un refactor, y cinco minutos después el typecheck daba 0. Si el pre-push
  da rojo, lo PRIMERO es `git status --short` de los archivos que el error nombra.
- ⚠️ **Bootear local ESCRIBE en la Supabase de PRODUCCIÓN.** Un blur del detalle guarda en
  el tablero real de Mauricio.
- ⚠️ **`ws3` está EN CERO** (y volvió a cero el 05/10 después de la verificación). El clon
  con datos es **`ws4` «Cliente de Diseño»** (300 leads).
- El estado completo de los 16 días anteriores está en [`docs/relevo.md`](../relevo.md).
