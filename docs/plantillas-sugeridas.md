# Plantillas sugeridas: cómo se enchufa una galería

Martín, 16/10/2026: «en todos los lugares que usamos templates, que al principio se posicionen los sugeridos para el
negocio, que MaKo lo tome de lo analizado de su offer, de su funnel... Y que tenga un texto sutil de "Sugerido"».

Hay **un módulo** para todas las galerías: `lib/plantillas-sugeridas.ts` (la regla, pura) y
`lib/plantillas-sugeridas-server.ts` (de dónde salen las señales). Lo usan hoy:

| Galería | Tabla de etiquetas | Dónde ordena |
|---|---|---|
| Dashboard y General | `lib/graficos-plantillas-etiquetas.ts` | `app/dashboard/NuevaHoja.tsx` |
| Video Editor, pestaña Plantillas (y su API y el chat «Editar con IA») | `lib/editor-video/plantillas-etiquetas.ts` | `plantillasEnOrden`, lib/editor-video/plantillas.ts |
| Image Editor, panel de plantillas (y su API) | `app/image-editor/mako/plantillas-etiquetas.ts` | el servicio `templates`, app/image-editor/mako/plantillas.ts |

Faltan Automations, Web Generator y el CRM.

## Lo que hace

1. **Lee lo que el negocio DECLARÓ** (sin IA, en paralelo con lo demás de la página):
   - de sus funnels: el canal de cierre y, si el funnel está declarado, por dónde le entran los leads;
   - del diagnóstico de fase, el mismo que contesta el dueño en Offer: el canal y el cuello de botella;
   - de sus ofertas, el modelo de cobro (pago único o suscripción); de sus productos, sólo la suscripción.
2. **Pone primero hasta 3 plantillas** (`MAX_SUGERIDAS`) que coinciden con eso, de más a menos coincidencias y,
   empatadas, en el orden de la galería. Las demás siguen en el orden de siempre.
3. **Sin nada declarado, no cambia nada**: el orden de siempre y ningún «Sugerido».

Lo que pesa cada coincidencia: el canal de cierre 3, y las entradas, el cobro y el cuello 2 cada uno. El porqué
(«Vendes por llamada») sale del eje más pesado que coincide.

## Cómo se enchufa una galería

**1 · Una tabla de etiquetas, una fila por plantilla**, al lado del catálogo de la galería. Molde:
`lib/graficos-plantillas-etiquetas.ts`.

```ts
import type { EtiquetasPlantilla } from '@/lib/plantillas-sugeridas';

export const ETIQUETAS_MI_GALERIA: Readonly<Record<string, EtiquetasPlantilla>> = {
  'seguimiento-llamada': { canal: ['llamadas'], entrada: ['agenda_sola'] },
  'carrito-abandonado': { canal: ['carrito'], entrada: ['carrito'] },
  'renovacion': { cobro: ['suscripcion'] },
  'bienvenida': {},            // una decisión: no se sugiere nunca
};
```

Las etiquetas son mínimas y salen de catálogos que ya existen:

| Eje | Valores | De dónde |
|---|---|---|
| `canal` | `llamadas`, `conversaciones`, `carrito`, `webinar`, `presencial` | `CANALES`, lib/fase-diagnostico.ts |
| `entrada` | `formulario_anuncio`, `landing`, `agenda_sola`, `chat_entrante`, `chat_saliente`, `carrito` | `ENTRADAS`, lib/pipeline.ts |
| `cobro` | `unico`, `suscripcion` | las ofertas y los productos |
| `cuello` | `oferta`, `conversion`, `sistema`, `delegacion`, `foco` | `FASES`, lib/fase-diagnostico.ts |

Se etiqueta por la **pregunta que contesta** la plantilla, no por los datos que lee. Y pocas etiquetas por fila: cada
una de más la vuelve sugerida para más negocios.

> ⚠️ **Una plantilla de UN canal no lleva un eje genérico.** Los ejes suman por separado: con `cuello: ['conversion']`,
> «Ventas por WhatsApp» salía sugerida a quien vende por llamada (se vio en el arnés del Dashboard). Una plantilla de un
> canal se sugiere sólo por su canal y por sus entradas.

> ⚠️ **Una variante va con `{}`.** Si la galería tiene la misma plantilla con otra animación («Gancho escrito» del
> gancho, «Oferta con glitch» de la oferta, en el Video Editor), con la misma fila salen sugeridas de a dos: dos de las
> tres «Sugerido» para una sola idea. Se sugiere la original; la variante sigue en su lugar.

**2 · Las señales.** Hay dos caminos, según dónde viva la galería:

- **La página es del server** (como `app/dashboard/page.tsx`): llama a `senalesDelNegocio()` en paralelo con lo que ya
  lee y se lo pasa al componente como prop. Así la galería abre ordenada y las tarjetas no saltan.
  Si la galería vive muy adentro de un editor (las de los dos editores), la prop se pasa sólo hasta la cáscara: en el
  Video Editor baja por un contexto (`app/video-editor/sugeridas.tsx`) y en el Image Editor por el adaptador
  (`crearAdaptadorNube({ senales })`, que se la da al servicio de plantillas).
- **La galería vive sólo en el navegador** (un modal): pide `GET /api/plantillas/senales` → `{ ok, senales }` cuando
  se monta lo que la abre, no cuando se abre.

**3 · Ordenar y dibujar.**

```tsx
const ordenadas = useMemo(() => ordenarConSugeridas(PLANTILLAS, ETIQUETAS_MI_GALERIA, senales), [senales]);
// Se ordena la galería ENTERA y DESPUÉS se filtra lo que se busca (el filtro conserva el orden).
const visibles = filtrar(ordenadas.map((x) => x.plantilla), busca);
// En la tarjeta: «Sugerido» chico y gris, y el porqué en el title.
{porque && <span className="…" title={porque}>Sugerido</span>}
```

«Sugerido» es texto, no un badge: 11,5 px, peso 500, `var(--dim)`, a la derecha del nombre
(`.nh-sugerido` en app/dashboard/NuevaHoja.tsx). En una tarjeta ANGOSTA va abajo del nombre: las del Video Editor miden
92 px y a la derecha lo cortaba a cinco letras.

> ⚠️ **Si la galería se llena de un servicio que filtra y PAGINA** (el `templates.list()` de Doory en el Image Editor),
> se ordena ahí, en el servicio, la galería entera y una sola vez: el panel recibe una página y no podría ordenar él, y
> ordenar después de filtrar volvería «Sugerido» a una que no está entre las tres (con cuatro que coinciden, la
> categoría de la cuarta la mostraría marcada). Molde: `servicioPlantillas(senales)`, app/image-editor/mako/plantillas.ts.

**4 · Un test** que exija una fila por plantilla con valores del catálogo. Molde: `tests/plantillas-sugeridas.test.ts`
(«cada plantilla de las dos galerías tiene su fila…»).

**5 · La API de MaKo**: si la galería se lista por la API, la lista sale en el mismo orden y marca la sugerida
(`sugerida: "<porqué>"`). Moldes: `plantillasDelCatalogo` (lib/api-mako/areas/dashboard.helpers.ts) y
`listar_hojas_general` (lib/api-mako/areas/general.run.ts).

**6 · Si un chat de IA elige plantillas**, la lista que lee va en el mismo orden y marcada, y le dice que elija una
sugerida cuando la persona no dice cuál: elige como elegiría ella mirando la galería. Molde: `catalogoParaPrompt(senales)`
(lib/editor-video/chat-catalogo.ts; las señales las lee lib/editor-video/ia.ts en el server, en paralelo con el prompt).

## Lo que no entra, a propósito

- **El rubro.** El onboarding lo guarda como texto libre, y compararlo pediría IA en el momento de abrir la galería.
- **Lo que el código pone por defecto.** Un producto nace con `tipo: 'unico'` al crear un funnel y al sembrar el del
  onboarding: eso no dice cómo cobra el negocio. El funnel que creó la migración no está declarado: sus entradas no
  cuentan.
- **Lo conectado** (Meta, Fathom…). Eso dice qué datos tiene el negocio, no cómo vende. De los datos se ocupa otra
  pieza: la plantilla se arma sin los gráficos que quedarían vacíos (app/api/graficos/plantilla).
