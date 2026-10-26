# Feedback de Martín, 25/10/2026 tarde (~15:40): integraciones, Partners, Agency, Super Admin y tabs

Textual, como lo escribió (lo leen los chats antes de tocar nada; cada uno, la parte de su área):

> Dame el link para conectar mi tarjeta en la cuenta de mako, asi haces todas las pruebas con Zernio... Supongo que si publicas pausado no me van a cobrar nada
>
> Por otro lado, depreca todas las INTEGRACIONES que ya no nos sirvan...
> Por ejemplo la de API Meta (esta en especial, manda un aviso a todos los clientes que conecten Zernio y si no conectan dentro de 1 semana ya no podrán administrar anuncios en MaKo...). Revisa bien el logo de todas, la de Zernio no es el correcto...
> Depreca Hotmart, Skool, eso no sirve.
> Fijate los nombres, no inventes nombres como "MaKo AI", pon los nombres correctamente... En ese caso "Anthropic API" o "OpenAI API", dentro de los modales de esas, también pon la opción para que lo conecten desde sus PC, y aclara que no es lo mismo, es algún lugar sutil, tal vez en "?"
> Elimina la de Google Calendar, entiendo que cuando se registran con Google ya le podríamos preguntar esos permisos...
> Elimina la de elevenlabs, te pedí en su momento que lo reemplaces completamente por https://github.com/debpalash/VoiceStudio
> Depreca Fathom... Replica esa app en MaKo. Si ya tenemos la extensión, la app desktop y todo, estoy seguro que existe un repo o algo que reemplace. Entonces tenemos más contros sobre las llamadas, las transcripciones, etc... Esto nos va a permitir implementar lo que teniamos pensado de "Closing Script" que MaKo te acompañe en tus llamadas de venta, transcriba en tiempo real y te de recomendaciones de closing... (Todo esto de farhom y closing, dejalo anotado para mas tarde, seguro lo haga con otra cuenta)
> Implementa otros alojadores de video, no solo panda, como Vimeo u otros... Y asegurate de que funcionen bien y que los lugares donde consume eso, el Pixel de MaKo, web generator, cursos, etc, puedan traer datos de tus videos de esas herramientas conectadas.
> Zernio no debe decir (Facebook, Instagram...), el nombre real de las apps en integraciones.
> Elimina Apify, entiendo que era para la busqueda de Instagram, pero ahora con el pixel de mako y/o zernio ya lo hacemos, no?...
> De por si, elimina las IA dentro de las integraciones, para eso tenemos el bloque que dice "Tus cuentas de IA" arriba del todo. Ahi solo agrega a Groq y listo. En Goq y Gemini no pongas "pronto" en la opción de la computadora...
> Las que están "sin conectar" pon las tarjetas un poco más opacas o grises, para que se diferencien.
>
> Luego:
>
> 1. Revisa que la url es "https://hola-mako.com/partners/referidos" cuando solo basta "partners" sin el referido.
> 2. Elimina lo de "gana meses de tu plan", que solo ganen direro y listo.
> 3. En los clientes no se ve la pagina tipo de ventas de MaKo partners... Solo en SuperAdmin. Y creo que no estás entendiendo, si alguien no se hizo "Partner", no le debe saltar abajo nada de "Todavía no tienes referidos" o del dashboard... Solo los CTA para que se haga Partner, posterior a apretar eso, un pequeño onboarding, que le pregunte algunas cosas como, cuantos quisiera referir, etc... Y que ahí le de su link de referido. Y es importante que en la compra, en el carrito, esté la opción de poner código de referido. Luego de eso, en la misma url, ahora si ven el dashboard, con un botón arriba para ver la landing nuevamente por si quieren... En SuperAdmin, directo ver el dashboard, y copia el dashboard de otras apps que usen referidos, tanto para superadmin como para los clientes, que se vea epico.
> 4. No pongas al programa de 1500 en el programa de referidos...
> 5. Hazlo más marketinero la landing, literalmente se llevan el 100% de lo que venden.
> 6. La calculadora ponlo en dode hoy está "Si se suscribe". Y solo la parte azul,
> 7. Elimina la sección de "Cómo funciona" y "Por ahora MaKo da de alta a mano"
> 8. Revisa las preguntas frecuentes, porque varias cosas cambiaron... Ya no hay "meses" ni "devolución"... Si pueden hacer ads que digan "mako", no aclares eso... Elimina lo de "Si llegó con varios links, vale el primero.".. Se mas claro y marketinero con las preguntas y respuestas... No se entiende "No. Cada negocio nuevo que traes suma el suyo.".
> 9. Con respecto a la pregunta de "¿Y si soy agencia?", quiero que crees otra tab abajo de "Partners" que sea "Agency Dashboard". Que sea la misma metodología que este, que tengas la "landing" y que te puedas sumar como "Agency", solo para los que tengan su plan de 97 activo... Ser Agencia es muy diferente a Partner. Las agencias no ganan dinero con MaKo, porque sus clientes son suyos, no de MaKo... MaKo no les va a enviar promociones, no les intentará hacer upsells, ellos gestionan a sus clientes, pueden inspeccionar sus cuentas, controles admin, etc... Y ahí funciona simple, tu agregas a 1 cliente nuevo y puedes elegir si el cobro se realiza ahí mismo con tu tarjeta, o si quieres que lo pague tu cliente, y en dicho caso, al finalizar el onboarding de ese cliente debe saltar el cartel de pago. Pon el dashboard de "Agencia" allí, con todos los clientes de Codigo allí también. Y claro, como siempre revisa como lo hacen otras apps y copialo, quiero que se vea bien, epico...  Y que salga de la vista de "clientes" actuales...
> 10. Para SuperAdmin, creame una vista especial para ver a mis clientes... Donde pueda ver a los partners, a agency y al resto de clientes... Siempre revisa como lo hacen otras apps, que se vea epico.
> 11. La tab de "clients" pasa a llamarse "Classroom". También su ruta.
> 12. Elimina la tab de "https://hola-mako.com/admin/cobros" y "https://hola-mako.com/admin/agente"  para eso ya vamos a tener la nueva vista...
> 13. Elimina "https://hola-mako.com/contexto", lo de "Conocimientos" lo puedes llevar a esa tab, donde está el curso, y que solo yo como super admin vea esas anotaciones... Lo de "fases" esta deprecado.  Lo de "Configuración" entiendo que la mayoría de cosas allí las personaliza el propio usuario...  Como tambien "prompts".
> 14. Elimina "https://hola-mako.com/modelos-ia", eso ya lo configura el usuario y el propio Ops Center de manera automática.
> 15. Elimina "dev", ya no lo necesitamos.
> 16. No veo bien las capturas, ponmelas en tabs o algo así, porque no se ven asi chiquitas...

## Lo que decide el Cerebro (Martín pidió no preguntar)

- **Deprecar no es romper.** Antes de sacar una integración se mide quién la tiene conectada en producción y qué deja de andar. Lo que
  la reemplaza sale primero, y recién después se saca. Por eso:
  - **API de Meta:** el aviso a los clientes sale cuando Meta por Zernio esté PRENDIDO para clientes (hoy apagado: falta el CAPI y el
    nivel anuncio). Desde ese aviso, una semana. Después, sin token de Meta no se administran anuncios. El aviso lo manda el Cerebro
    con el texto que arma Zernio y CAPI.
  - **ElevenLabs:** se va recién cuando VoiceStudio haga lo mismo (voz de los audios, AI Avatar). Hasta entonces, deprecada sin borrar.
  - **Google Calendar:** los permisos del calendario se piden al entrar con Google (scopes en el login). Las agendas ya conectadas
    (por ejemplo la de Florencia) siguen andando sin pedir nada de nuevo.
  - **Hotmart, Skool y Apify:** se miden sus usos (Apify: ¿alguien lo usa además de la búsqueda de Instagram?) y se sacan de la pantalla
    y de la API; los datos que ya trajeron no se borran.
- **Fathom y Closing Script: anotado para más tarde** (Martín: «dejalo anotado para mas tarde, seguro lo haga con otra cuenta»). Ver
  docs/pendientes.md.
- **«dev» se saca de la barra y sus pantallas, pero las bitácoras (`app/admin/dev/*/bitacora.ts`) se quedan:** de ellas cuelgan el cierre
  automático de los tickets (`tickets: [n]` en el hito) y varios tests.
- **/admin/cobros y /admin/agente se sacan cuando exista la vista nueva de clientes del super admin (punto 10)**, que trae lo que
  hacen hoy. Antes, no.
- **Partners gana sólo plata** (punto 2): se corrige `docs/referidos.md` y la memoria `decisiones-venta-25-10` («meses Y plata» queda
  reemplazado). El Acelerador de US$1.500 no entra en Partners (punto 4).

## Reparto

| Qué | Chat |
|---|---|
| Integraciones: la página (sacar las IA de la lista, «Tus cuentas de IA» con Anthropic API, OpenAI API, Gemini y Groq, la opción de la PC con su «?», sin «pronto» en Groq y Gemini; nombres reales; logos; tarjetas sin conectar en gris; Hotmart, Skool, Apify y Google Calendar) | Settings |
| API de Meta deprecada con su aviso; Zernio con su nombre y logo reales | Zernio y CAPI |
| Otros alojadores de video (Vimeo y otros) en el Pixel, el Web Generator y los cursos | Landings |
| ElevenLabs → VoiceStudio | chat nuevo «Voz» |
| Partners (puntos 1 a 8) y el código de referido en el carrito | Planes |
| Agency Dashboard (9) y la vista de clientes del super admin (10), y sacar /admin/cobros y /admin/agente (12) | chat nuevo «Agencias y clientes» |
| Classroom (11), sacar /contexto (13, con «Conocimientos» al Classroom sólo para el super admin), /modelos-ia (14) y dev (15) | Ops Center |
| Capturas en pestañas (16) | Cerebro, hecho |
