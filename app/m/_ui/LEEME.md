# app/m/_ui — cómo se arma una pantalla de MaKo Mobile (v2)

Referencia visual: `docs/prototipos/mako-mobile-v2.html`. Reglas: `docs/diseno-mako-mobile-v2.md`.
El shell (layout) ya pone: el encabezado, el **título grande**, la barra de abajo, el toast, los
portales de sheets (`#m-capas`) y del pie fijo (`#m-pie`). Una pantalla **no** pone `<main>`, ni su
título grande, ni un «Actualizado hh:mm».

## 1. El page.tsx

```tsx
import './ads.css';                                   // SU css, en SU carpeta (ver §5)
import { requireMovil } from '@/lib/movil-guard';
import { SeccionM, ListaM, FilaM, ComputadoraM } from '@/app/m/_ui';

export const dynamic = 'force-dynamic';

export default async function AdsPagina() {
  const ctx = await requireMovil({ navKey: 'ads-manager' });  // la key de nav.ts (SECCIONES_MAS.navKey)
  // datos del workspace de ctx.ws / getWorkspaceActual() — NUNCA de ?ws=
  return (
    <>
      <SeccionM titulo="Campañas"><ListaM>…filas…</ListaM></SeccionM>
      <ComputadoraM que="Crear campañas y subir anuncios" />
    </>
  );
}
```

- `requireMovil({ navKey })` en CADA page (el layout no protege). navKey: `graphics` Dashboard ·
  `ads-manager` · `customer-success` · `setting` Automations · `video-generator` · `landing-writer` ·
  `mako` · `crm` · `todo` Plan. More, Today e Inbox: `requireMovil()` sin navKey.
- Links: `Link`/`useRouter` de `@/app/_ui/Link` (ponen el `?ws=`). Nunca `next/link`.
- Interactivo → un componente `'use client'` aparte al que el page le pasa los datos ya filtrados.

## 2. Título, «volver» y pantallas de trabajo

Lo de siempre sale solo de la ruta (`cabecera.ts`): la raíz de una sección de More se titula con su
nombre y vuelve a More; una subpantalla vuelve a su sección. Para pisarlo, `<CabeceraM>` (no dibuja):

| Quiero | Cómo |
|---|---|
| El nombre de la cosa (un lead, una campaña) como título grande | `<CabeceraM titulo={x.nombre} />` |
| Mi propio encabezado (avatar + nombre, la ficha) | `<CabeceraM titulo={x.nombre} grande={false} />` y en MI encabezado un `<h1>` dentro de un elemento con `data-m-titulo-grande` (el nombre chico aparece en la barra cuando se va) |
| Pantalla de TRABAJO (editor, chat): sin título grande, nombre en la barra siempre, sin barra de abajo | ya lo son `/m/mako*`, `/m/video/<id>`, `/m/landing/<id>`; otra: `<CabeceraM trabajo />` (y pedir que se sume a `esTrabajo` para que el HTML del server ya salga así) |
| UNA acción a la derecha | `<CabeceraM accion={<button className="m-cabecera__accion" aria-label="Filtrar por etapa">…</button>} />` |
| Otro «volver» | `<CabeceraM padre={{ href: '/m/crm/12', label: 'Ficha' }} />` (fijo, nunca `router.back()`) |

## 3. Qué primitiva para cada cosa del prototipo

| Prototipo | Primitiva |
|---|---|
| `.st` título de sección (+ «Ver el plan») | `<SeccionM titulo accion={<Link className="m-lnk" …>}>` |
| `.lista` caja agrupada | `<ListaM>` |
| `.fila` (avatar/ícono · nombre + una línea · riel · ›) | `<FilaM avatar="Nombre" \| icono="graphics" titulo segunda riel href \| onClick navegacion />` — chevron sólo si abre algo; `leading={<span className="m-fila__hora">10:30</span>}` para la hora grande |
| `.fila.dato` clave → valor | `<FilaDatoM k="Etapa" v="Agendado" azul onClick />` |
| `.fila.compu` «… · En la computadora» | `<ComputadoraM que="Pagos, historial y campos" />` (una, al final) |
| `.seg` segmentado | `<SegmentadoM etiqueta="Vista" valor onCambio opciones={[{ id, label, n?, href? }]} />` |
| `.pill` estado | `<PildoraM tono="good\|warn\|bad\|info\|neutro">Publicada</PildoraM>` (en FilaM: `pill={…}`) |
| `.sw` interruptor | `<FilaM … control={<InterruptorM etiqueta="Activa" activo onCambio />} />` |
| `.av` iniciales / `.ic-tile` | `<AvatarM nombre tam="sm\|md\|lg\|xl" />` / `<IconoM nombre />` |
| `.card` lo que bloquea (una sola) | `<TarjetaDecision titulo consecuencia accion estrella?>` (sin píldora; `estrella` SÓLO si lo propuso MaKo) |
| `.chk` casilla redonda de una tarea | `<CasillaM marcada onMarcar titulo deshabilitado motivo />` (la misma en Today y en Plan) |
| sheet (radio 18, agarradera, título + ✕, pie) | `<SheetM abierto onCerrar titulo pie={<PieM consecuencia="…"><Button …/></PieM>}>` |
| `.pie-fijo` consecuencia + botón grande | `<PieFijoM consecuencia="…"><Button variant="primary" size="lg" full>…</Button></PieFijoM>` |
| toast 3-4 palabras + Deshacer | `const toast = useToastM(); toast('Activa', { deshacer })` |
| vacío / error / cargando | `<VacioM frase>` / `<ErrorM frase onReintentar>` / `<SkeletonFilas>` |
| pull-to-refresh | envolver en `<PantallaM refrescable>` (sin `titulo` ni `actualizado`: se borraron y no compilan) |

Botones: `Button`/`ButtonLink` de `@/app/_ui/Button` en `size="lg" full` (nunca `sm`). Azul = la acción,
dorado (`mako`) = se lo pides a MaKo. Nunca «Sí/No/Aceptar/Cancelar»: acción + objeto.

## 4. Lo que no se hace

Subtítulos, «Actualizado», pills al lado del título, cejillas, texto verde/rojo (el color va en el
punto), emojis como íconos, íconos que no existan en `app/_components/icons.tsx` (dibujan un punto),
tokens que no existan en `app/globals.css` (resuelven a nada), voseo, datos reales de clientes en
ejemplos, controles de menos de 44 px, inputs de menos de 16 px, `transform` en un ancestro de algo
`position: fixed`. Para pegar algo abajo (un composer): `bottom: var(--m-abajo)` (es 0 + área segura
cuando no hay barra).

## 5. El CSS de la pantalla

Un `.css` en SU carpeta (`app/m/ads/ads.css`), importado por SU `page.tsx`, con TODAS las clases
prefijadas con el nombre ENTERO de la carpeta (`.m-ads-*`, nunca dos letras: `.mc-` era crm y cuenta a la vez). Next deja la hoja cargada al salir de la ruta: una clase
sin prefijo le cambia otra pantalla. `app/m/m.css` es del shell: no se toca desde una pantalla. Un
`h1/h2/p` con margen va con `[data-m]` delante (`[data-m] :is(h1,h2,h3,p){margin:0}` le gana a una
clase sola).
