# Plantillas sugeridas: cómo se enchufa una galería

Martín, 16/10/2026: «en todos los lugares que usamos templates, que al principio se posicionen los sugeridos para el
negocio, que MaKo lo tome de lo analizado de su offer, de su funnel... Y que tenga un texto sutil de "Sugerido"».

Hay **un módulo** para todas las galerías: `lib/plantillas-sugeridas.ts` (la regla, pura) y
`lib/plantillas-sugeridas-server.ts` (de dónde salen las señales). Lo usan hoy el Dashboard y General
(`app/dashboard/NuevaHoja.tsx`). Faltan Automations, Web Generator, Video Editor, Image Editor y el CRM.

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

**2 · Las señales.** Hay dos caminos, según dónde viva la galería:

- **La página es del server** (como `app/dashboard/page.tsx`): llama a `senalesDelNegocio()` en paralelo con lo que ya
  lee y se lo pasa al componente como prop. Así la galería abre ordenada y las tarjetas no saltan.
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
(`.nh-sugerido` en app/dashboard/NuevaHoja.tsx).

**4 · Un test** que exija una fila por plantilla con valores del catálogo. Molde: `tests/plantillas-sugeridas.test.ts`
(«cada plantilla de las dos galerías tiene su fila…»).

**5 · La API de MaKo**: si la galería se lista por la API, la lista sale en el mismo orden y marca la sugerida
(`sugerida: "<porqué>"`). Moldes: `plantillasDelCatalogo` (lib/api-mako/areas/dashboard.helpers.ts) y
`listar_hojas_general` (lib/api-mako/areas/general.run.ts).

## Lo que no entra, a propósito

- **El rubro.** El onboarding lo guarda como texto libre, y compararlo pediría IA en el momento de abrir la galería.
- **Lo que el código pone por defecto.** Un producto nace con `tipo: 'unico'` al crear un funnel y al sembrar el del
  onboarding: eso no dice cómo cobra el negocio. El funnel que creó la migración no está declarado: sus entradas no
  cuentan.
- **Lo conectado** (Meta, Fathom…). Eso dice qué datos tiene el negocio, no cómo vende. De los datos se ocupa otra
  pieza: la plantilla se arma sin los gráficos que quedarían vacíos (app/api/graficos/plantilla).
