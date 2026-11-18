# Brief: Offer Coach del V2 = el MOTOR de Offer (decisión 1b del Cerebro, 18/11/2026)

Lo escribió la sesión del onboarding V2 (local_a9a5a9e9), cuenta claude2, al 92% de su uso semanal. Es un trabajo de una sesión
entera: conviene arrancarlo en otra cuenta.

## Qué pidió Martín (por el Cerebro)
«Offer Coach en la app = el MOTOR de Offer (el de la pestaña Offer): subir el documento, las piezas, la nota y el PDF en UN
mensaje» (16/11: «el diagnóstico en UN mensaje: la nota general y Descargar PDF»). Hoy, en el V2, Offer Coach es un chat del
modelo con contexto (lib/asesores/contexto.ts → el contexto del Offer Coach; herramientas `HERRAMIENTAS_DEL_OFFER_COACH`), que
escribe el diagnóstico a mano y no tiene PDF.

## Lo que ya existe y hay que reusar (no rehacer)
- `app/offer/OfferApp.tsx` tiene un modo EMBEBIDO: la prop `arranque` (tipo `ArranqueOffer`, línea ~174). El onboarding ya lo
  usa: `app/onboarding/ChatArranque.tsx` (~líneas 280-310) le pasa `antes/despues/manda/onTexto/onOpcion/extra/abrirEnFunnel/
  onSesion/conRiel:false/vacia`. Así el chat del onboarding corre la conversación de «lo que vendes» con el motor de Offer y
  muestra el PDF (`TarjetaPdf`/`VisorPdf` con `VistaPdf tipo="lo-que-vendes"`, `linkPdfLoQueVende`).
- La API del motor: `app/api/offer/route.ts` (y `app/offer/offer-api.ts` del lado del cliente). La conclusión con la nota y
  «Descargar PDF»: `app/offer/Conclusion.tsx`.
- Leer la oferta armada desde el chat: `ver_analisis_oferta` / `guardar_oferta_analisis` (lib/api-mako/areas/negocio.def.ts).

## Qué hay que hacer
1. En `app/second-brain/ChatDelCoach.tsx`, con `dosCoaches && cual === 'offer'`: en vez del hilo del modelo, montar el motor de
   Offer embebido (OfferApp con un `arranque` propio, o un modo nuevo más chico si `arranque` arrastra demasiado del onboarding).
   La conversación de Offer abre en el funnel principal (como `abrirEnFunnel` del onboarding) y queda ligada a la fila de
   Offer Coach (una clave en app_settings o la que use la fila hoy: `TAB_OFFER_COACH`).
2. Al terminar: UN mensaje con el diagnóstico, la nota general y «Descargar PDF» (la `Conclusion` del motor, sin el riel).
3. La voz (`BotonVozCoach`), el ícono «Videos» de la cabecera (`VIDEOS_DEL_OFFER`) y la clase de la oferta (`claseDelCoach`
   cuando `oferta?.estado === 'hay'`) ya están montados en ChatDelCoach: que sigan.
4. El teléfono: `app/m/second-brain/HojaDelCoach.tsx` (y `app/m/offer/HojasOfferM.tsx` como referencia del motor en el teléfono).
5. Todo detrás de `lib/onboarding-v2/revision.ts` (`dosCoaches`). Sin el V2, nada cambia.

## Trampas que ya se conocen
- tests/d6b-rutas.test.ts: montar en el Ops Center algo que llama a una `/api/…` la mete en el recorrido del navegador del Ops
  Center. `/api/offer` ya prende el contexto (es de la tab Offer), pero confirmarlo con `D6B_VOLCAR=1`. Ver
  docs/hallazgos-ops-center.md, «Montar en el Ops Center algo que llama a una /api AJENA…».
- tests/coaches-ops-center.test.ts y tests/aperturas.test.ts fijan líneas exactas de ChatDelCoach.tsx y PiezasCliente.tsx.
- El onboarding NUNCA muestra «Conectar mi propia IA» (usa el crédito de la plataforma). En el Ops Center sí corre con SU IA:
  revisar qué hace el motor embebido sin la app de escritorio (docs/hallazgos-ops-center.md, «Sin la app de escritorio no se
  escribe en NINGÚN chat del Ops Center»).
- La maqueta (C:/dev/artefactos-onboarding/cuerpo.html, `oferta-lista`) ya muestra cómo queda: el diagnóstico y el PDF en un
  mensaje, y la marca a Funnel Coach recién cuando la persona VIO la oferta.
