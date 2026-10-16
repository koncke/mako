# El onboarding anterior: cada paso, qué pregunta y qué escribe

Foto del wizard de `/onboarding` el **16/10/2026**, antes de reemplazarlo por el chat de Offer.
Pedido de Martín (16/10/2026): «Guarda los pasos que hoy tenemos en el onboarding para que luego si
faltó algo, yo te lo indique». Para eso es este documento: mirarlo y decir «faltó X».

El código de esta versión queda en git: `app/onboarding/OnboardingWizard.tsx` y sus vistas, al commit
`603816b11` (origin/main del 16/10/2026).

## Quién ve qué

Las pantallas no son fijas: salen de la **capa** que compró el cliente (`lib/capas.ts`, campo
`onboarding`).

| Capa | Pasos, en orden |
|---|---|
| **Completo** y **Agencia** (la mayoría) | bienvenida → diagnóstico de fase → tu propia IA → El Archivero → oferta y productos → teléfono de reportes → conectar Meta → cierre |
| **Project Manager** | bienvenida → 3 preguntas del negocio → diagnóstico de fase → el Perro Guardián → cierre |
| **SuperAdmin** | ninguno (no hace onboarding) |

El estado vive en `app_settings`, clave `onboarding.state` (`lib/onboarding-state.ts`): un registro por
paso (`done`, `postergado`). Cuando todos los pasos de la capa están hechos o postergados, el estado
pasa a `done` y la app se abre. Sólo dos pasos se pueden dejar para después: **el teléfono de
reportes** y **las integraciones** (`PASOS_POSTERGABLES`); lo que queda pendiente se le recuerda en
`/general`.

## Las pantallas, una por una (capa Completo / Agencia)

### 0. Bienvenida — `app/onboarding/Bienvenida.tsx`

- **Qué muestra:** un «cerebro» que se arma en cuatro tiempos con los clics de la persona: un nodo
  («Tus anuncios»), las cinco piezas de un anuncio, las áreas, el mapa lleno. Después sube el mapa y
  entra un texto que se escribe solo («…crecer tu negocio», «…escalar tus anuncios», «…llenar tu
  agenda»). El grafo es **ficción a propósito**: un cliente nuevo no tiene datos. Lo real es la paleta
  y los nombres de las once áreas (`lib/cerebro-modelo.ts`).
- **Qué pregunta:** nada. Un botón «Comenzar».
- **Qué escribe:** pasa el estado de `pending` a `in_progress`, para que la bienvenida no vuelva a
  salir.

### 1. Diagnóstico de fase — 8 pantallas, `FaseUI.tsx` + `lib/fase-diagnostico.ts`

- **Qué pregunta**, de a una pregunta por pantalla, con cinco opciones cada una:
  1. ¿Cuánto factura tu negocio por mes?
  2. ¿Cuánto inviertes por día en Meta Ads?
  3. ¿Cuántos creativos (anuncios) lanzas por mes?
  4. **¿Con cuál de estos identificas tu funnel?** Llamada de venta · Conversaciones por chat ·
     Carrito / checkout · Webinar · Sesión presencial.
  5. El volumen. La pregunta cambia según el canal elegido (llamadas, conversaciones, compras,
     registros).
  6. ¿Cómo está tu funnel hoy?
  7. ¿Cuál es tu MAYOR cuello de botella hoy?
  8. La pantalla del resultado: «Tu diagnóstico», la fase (1 a 5) con su nombre.
- **Qué escribe:**
  - el diagnóstico en `negocio.fase.diagnostico` (`setDiagnosticoFase`, `lib/fase-store.ts`);
  - el canal en `onboarding.funnel_tipos`;
  - y, si el embudo del CRM está intacto, **siembra las etapas del CRM según el canal**
    (`templateDeCanal` → `saveFunnelDefault`). Así nace el primer CRM hoy: no se pregunta, sale del
    canal.
- **Quién lo lee después:** el Norte de `/general`, el Perro Guardián, el plan de arranque y la
  conversación de Offer (que no lo vuelve a preguntar si ya está).
- **Obligatorio:** sí, cada pregunta.
- **IA:** ninguna. El diagnóstico se calcula con código.

### 2. Tu propia IA (opcional) — `ServicioConfigForm` con `gemini`

- **Qué pregunta:** su API key de Gemini. Abajo, «¿Tienes Claude Max? Conectar Claude».
- **Qué escribe:** la credencial `GEMINI_API_KEY` (o la de Anthropic) del negocio.
- **Obligatorio:** no, desde el 15/10/2026: MaKo arranca con la IA de la plataforma.

### 3. El Archivero — `app/onboarding/Archivero.tsx`

- **Qué pide:** que suba documentos de su negocio (PDF, Word, planillas, presentaciones). MaKo los
  lee, muestra «qué entendí» y pide el documento que falta. Si quedan huecos, abre preguntas de a una.
- **Qué escribe:** los archivos y su extracción (El Archivero, `lib/archivero.ts`), y con eso el
  **perfil del negocio**: las respuestas en `mako.onboarding.answers` (`saveAnswers`, `lib/onboarding.ts`)
  y el panorama.
- **Quién lo lee después:** MaKo en cada respuesta (el contexto del negocio), Productos, Ads Writer, el
  plan de arranque.
- **Obligatorio:** sí, al menos un documento analizado. Sin documentos ni aparece «Siguiente».
- **IA:** sí. Una extracción por documento.

### 4. Tu oferta y tus productos — `OfertasView.tsx` + `ProductosView.tsx`

- **Qué pide:** dos mitades en la misma pantalla.
  - **La oferta** (cómo se presenta): arranca con «Ármala tú, MaKo», que la escribe con lo que ya
    cargó, y la persona corrige. Desde acá también se puede crear un funnel y ligarle la oferta.
  - **Los productos** (lo que se factura): «Ármalos vos, MaKo», o el alta manual de a una pregunta.
- **Qué escribe:** las ofertas (`upsertOferta`, `lib/ofertas.ts`), los funnels que cree
  (`crearFunnel`, `lib/funnels.ts`, con la plantilla de su canal) y el catálogo de productos
  (`upsertProducto`, `lib/productos.ts`).
- **Quién lo lee después:** el CRM (al ganar un lead se elige el producto y hereda precio y forma de
  cobro), los writers (la oferta), Offer.
- **Obligatorio:** al menos **un producto**. La oferta no, porque MaKo la arma sola.
- **IA:** sí, para armar la oferta y los productos.

### 5. ¿A dónde te mando los reportes? — teléfono verificado

- **Qué pregunta:** nombre, email y WhatsApp (con lada). MaKo manda un código de 6 dígitos por
  WhatsApp y la persona lo carga.
- **Qué escribe:** `user_nombre`, `user_email`, `user_telefono` (`setContactoReportes`,
  `lib/perfil.ts`), y crea o sincroniza el grupo de WhatsApp «MaKo <> {cliente}», donde le van a llegar
  los reportes y los avisos.
- **Obligatorio:** se puede **postergar** («Seguir sin verificar el teléfono por ahora»). Si se
  posterga, no le llegan reportes ni avisos hasta que lo haga.

### 6. Conecta Meta — `ServicioConfigForm` con `meta`

- **Qué pide:** el token de Meta (cuenta publicitaria, página), con su tutorial y su «probar».
- **Qué escribe:** las credenciales del negocio, y al verificar Meta **arranca la extracción
  histórica** (`lib/onboarding-extract.ts`): métricas de Meta de 365 días, leads de formularios de 90
  días, transcripción de anuncios, análisis de guiones, llamadas de Fathom, métricas del VSL.
- **Obligatorio:** se puede **postergar** («Seguir sin Meta por ahora»).

### 7. Cierre — `Listo.tsx` + `/api/onboarding/plan-arranque`

- **Qué pasa:** al cerrarse el último paso, MaKo escribe el **plan de arranque** del cliente con su
  diagnóstico, sus documentos y su catálogo. Es un borrador para aprobar en `/plan/revisar/<id>`, no
  tareas directas. Después, la pantalla «Listo» ofrece caminos con números reales (tu plan con N
  tareas, terminar de configurar MaKo —el recomendado—, crear creativos, el CRM, la Retro si hay Meta).
- **IA:** sí, el plan de arranque.

## La capa Project Manager

1. Bienvenida (igual que arriba).
2. **Tres preguntas del negocio**, de a una por pantalla, que se guardan en `mako.onboarding.answers`:
   - ¿A qué se dedica tu negocio?
   - ¿Cuál es tu objetivo para los próximos 90 días?
   - ¿Qué es lo que más te está frenando hoy?
3. El diagnóstico de fase (igual que arriba).
4. «Tu plan lo cuida el Perro Guardián»: tres puntos que explican cómo prioriza. No pregunta nada.
5. Cierre.

## Pasos que existen en el código y hoy no usa ninguna capa

Están en el catálogo (`PASOS_ONBOARDING`) y tienen su pantalla, pero ninguna capa los pide desde
octubre. Se editan en Second Brain o en la tab que les corresponde:

| Paso | Qué pedía |
|---|---|
| `entregable` | Tu lead magnet |
| `avatares` | Tus avatares (MaKo proponía 3 subnichos) |
| `persona` | La cara de tu marca (fotos + descripción) |
| `personalidad` | El quiz de la voz del creador |
| `angulos` | Tu matriz de anuncios (avatar × razón) |
| `retro` | Tu primera Retro (necesita Meta y la extracción) |

El resto del esquema del perfil del negocio (oferta, avatar, personaje de marca: nombre de la oferta,
precio, promesa, qué incluye, garantía, cliente ideal, dolor, deseo, objeción, nicho, tono, valores,
qué nunca hace, muletilla) no se pregunta en pantallas propias: sale del Archivero y se edita en
Second Brain.

## Lo que la app necesita el primer día

Medido por el chat de Onboarding (16/10/2026, `docs/hallazgos-onboarding.md` → «Si el onboarding deja de
ser el wizard»). El onboarding nuevo tiene que dejar esto, o decir por qué no:

| Dato | Quién lo usa | Si falta |
|---|---|---|
| Diagnóstico de fase | El Norte, el Perro, el plan de arranque | sin fase |
| Canal → etapas del CRM | El CRM | arranca con el embudo genérico |
| Perfil del negocio (Archivero) | MaKo en cada respuesta, Productos, Ads Writer, el plan | consejos genéricos |
| Al menos un producto | El CRM al ganar un lead | no hay qué elegir al cerrar |
| Teléfono verificado | Reportes y avisos | no le llegan a nadie (por eso se posterga, nunca se da por hecho) |
| Meta conectado + extracción | El CRM, el Dashboard, la Retro | todo sin histórico |
| Estado `done` | Abre la app (`onboardingPendiente()`) | el cliente queda encerrado en el onboarding |
| Plan de arranque | `/plan` | el piso genérico |

## Atajos que sólo ve la agencia

Con el super admin mirando a un cliente, una barra arriba («Modo agencia») permite simular con las
credenciales de Mauricio (`simular`) o completar el onboarding copiando su configuración
(`clonar-dueno`), además de «Salir de la vista».
