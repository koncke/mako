# La investigación de la cuenta 1: «MaKo como el chat del Ops Center» (19/10/2026)

> La pegó Martín en el chat del Cerebro el 20/10 («Esa fue la conclusión...»). Se complementa con el plan de la llamada con
> Leila en `docs/plan-todo-ops-center-19-10.md`. Pedido: «quiero aplicar la investigación que hizo la cuenta de Mauricio a MaKo».

## Conclusión
- El chat sirve como puerta principal, pero no como una app sin tabs. CRM, Chats, Customer Success y Plan siguen siendo tabs.
- Ningún producto se quedó sólo con el chat: Salesforce, HubSpot, Day.ai, Lightfield, Shopify Sidekick y Meta Ads ponen el chat adelante y conservan las pantallas.
- Las guías (ChatGPT Apps, MCP Apps, Claude, Microsoft) dicen lo mismo: tarjetas con capacidades adentro del chat, y el botón «Abrir en la app» para lo demás.
- Lo que ya hay:
  - La API tiene 795 operaciones; el chat de un admin usa 736.
  - Se pueden mostrar en el chat el PDF de Offer, las tres miniaturas de una landing, un gráfico del Dashboard, una toma de Flow y la miniatura del Image Editor.
  - El kanban del Plan ya se puede embeber, y `TarjetaKanban` sirve para un bloque de «tus 5 leads calientes».

## Lo que frena, medido
| Freno | Dato |
|---|---|
| **Quién paga el chat (lo más grave)** | El Ops Center de un negocio corre sólo con las keys del negocio. El crédito de la plataforma es sólo Haiku y sólo durante el onboarding. Después, el cliente ve «Necesito una IA conectada» (tickets #5 y #6). Un negocio que conectó sólo su Claude igual recibe el modal de Gemini. |
| Suscripciones de Claude o GPT | No se pueden conectar: usar el token de Pro o Max fuera de Claude Code está prohibido (`docs/hallazgos-ia.md`, 15/10). Lo legal: el cliente pega su API key, o MaKo entra como app o MCP dentro del ChatGPT o el Claude del cliente (lo hizo Tiendanube en julio). |
| El chat no muestra componentes | Sólo texto, tarjetas para confirmar y links. Le faltan bloques con vista previa, streaming y releer el hilo al terminar un trabajo largo. |
| No recibe las herramientas | De 19 pedidos de acción probados, 7 no recibieron ninguna herramienta («quiero un carrusel», «mandale un WhatsApp a Juan»). |
| Confirma afuera del chat | El 42% de las acciones manda a confirmar a otra pantalla. |
| CRM y Clients no se pueden embeber | CrmBoard tiene 4.052 líneas y 27 recargas de página. |

## Orden recomendado
1. **Primero, los deadlines de esta semana:** landing, VSL, pasarela y Meta Ads. El chat único no hace falta para lanzar.
2. **Que el chat tenga quién lo pague.** Sin eso, no anda para ningún cliente nuevo.
3. **Bloques en el chat:** la tarjeta con lo creado, tres opciones para elegir, y una vista grande con «Abrir en la app».
4. **Herramientas:** que el chat reciba las que le faltan y que las acciones se confirmen sin salir de él.
5. **Que proponga al entrar,** como Sidekick Pulse o el resumen diario de Meta.
6. **Estrategia aparte:** MaKo como app dentro de ChatGPT o Claude, la forma legal de usar la suscripción del cliente.

## Fallas vistas en la llamada
- **«Cuota por cobrar» sin nombre:** el título de la alerta no nombra al cliente. Lo lleva el chat Pagos.
- **«Clientes por cobrar» sin suscripciones:** el bloque lee sólo las cuotas impagas, y una suscripción no genera cuotas. Lo lleva el chat Pagos.
- **Chats lento:** lee hasta 20 páginas de 1.000 mensajes una tras otra (de 5,5 a 7,8 s en el ws1) y repite cada 15 s. El teléfono lo acota; la computadora no. Lo lleva el chat CRM.
- **«68.646 minutos esperando turno»:** es un trabajo real de la cola de montaje, del 01/09, pero el proceso que la ejecuta nunca se desplegó. Por eso las tomas tampoco llegan al editor. Lo lleva el chat AI Avatar / Video.
