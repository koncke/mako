# ManyChat contra /chatbot — auditoría (08/10/2026)

Medido contra 66 artículos del centro de ayuda de ManyChat (actualizados entre agosto y el 08/10/2026),
15 capturas oficiales, el código de /chatbot y la base de producción (sólo lectura).

## Lo primero: el editor no es el cuello de botella

| Medido en producción | Valor |
|---|---|
| Leads que entraron a una automatización, en TODA la historia | 71 (todos de Mauricio; 58 cancelados) |
| Mensajes que salieron por una automatización | 20 (8 en octubre); **0 respuestas en 90 días** |
| WhatsApp que le entró a Mauricio en 30 días | 1.084 mensajes en 87 chats; 702 de números que no son leads |
| Código Inmobiliario | 0 automatizaciones · su WhatsApp desconectado · email en modo prueba |

O sea: casi nadie entra y casi nada sale. Lo que más mueve para un negocio como el de Mauricio es
lo que hace **entrar** gente a un flujo y que lo que sale sea **confiable**. La analítica fina y el
A/B no tienen volumen para medir nada.

## En qué le ganamos a ManyChat

- **La nota de voz por WhatsApp.** ManyChat no la manda por WhatsApp (sólo Messenger e Instagram), y
  es lo que vende Mauricio.
- **Condiciones más expresivas**: varias ramas con varias filas Y/O; ManyChat, una regla + «si no».
- **Esperar «N antes de la reunión»**: su Smart Delay con fecha dinámica, ya resuelto.
- **Etiquetas con CRUD, atadas a una etapa del CRM**, que se copian a WhatsApp y a Chatwoot.
- **Más de 190 acciones** que corren solas (ManyChat tiene unas 15).
- **La API de MaKo expone los flujos**; la de ManyChat no.
- **Crear con IA incluye etiquetas, esperas y condiciones**: la de ManyChat no las arma (su blog lo dice).

## Lo que hacíamos MAL (y qué pasó con cada uno en esta tanda)

| Problema | Qué pasaba | Estado |
|---|---|---|
| El freno de 20 h y el tope diario cuentan todos los canales | un email frenaba al WhatsApp y al revés: «WhatsApp y email del mismo CRON» salía a un toque cada 20 h | **Arreglado**: el freno y los topes son por canal |
| La ventana de envío 9-21 está fija en hora de México | a Código Inmobiliario le salía corrida | **Arreglado**: va en la zona del negocio |
| El ＋ del lienzo no podía crear un email | el editor de email era un asunto y una caja de texto | **Arreglado**: ✉️ Email en el ＋ y editor tipo Gmail |
| Lo no publicado se perdía sin aviso al cambiar de automatización | trabajo perdido en silencio | **Arreglado**: se pregunta antes |
| Activar no validaba nada | se podía prender un flujo roto | **Arreglado**: valida lo mismo que Publicar |
| El selector de acciones era una lista plana de 192 | ~6 visibles a la vez | **Arreglado**: por secciones, con buscador |
| Todas las tarjetas iguales; CRON y Acción con el mismo ícono | no se leía qué era control y qué contenido | **Arreglado**: dos familias |
| El aviso «no confirmó» decía la hora en UTC | «sábado 10, 01:00» para una reunión del viernes 9 a las 18 | **Arreglado** |
| «Probar» no pasa por las guardas del motor (ventana, 20 h, topes) | la prueba manda cosas que el motor no mandaría | Pendiente |
| Se graba en qué tarjeta salió cada mensaje y nadie lo lee | no hay números por tarjeta | Pendiente |

## Lo que nos falta, en orden

**Pronto (barato y mueve):**
1. **Variables del negocio en los mensajes**: `{{link_agenda}}`, `{{fecha_reunion}}`, `{{hora_reunion}}`, `{{precio}}`. Hoy un mensaje sólo sabe el nombre y el negocio: el link de agenda no se puede poner.
2. **Desde el chat o la ficha del lead: «Meter en una automatización» y «Pausar / Reanudar a MaKo con este lead».** ManyChat lo tiene en la bandeja; acá no hay forma de sacar a un lead de un flujo.
3. **Números por tarjeta** (pasaron / esperan acá / respondieron) y guardar el id del mensaje para saber si se LEYÓ.
4. **Duplicar una automatización, y «duplicar como email»**: armar la de un cliente desde la de otro.
5. **Palabra clave de entrada** y su link `wa.me?text=PALABRA`: sólo las palabras que elige el negocio, una vez por contacto.
6. En «Probar», cuando una respuesta cae en «Otra cosa», ofrecer **«Convertir en caso»**.

**Para decidir vos (cambian la forma del producto):**
- **Varias acciones en una tarjeta** (como ManyChat) o una por tarjeta (como hoy). Con una por tarjeta el lienzo se alarga; con varias, se lee menos de un vistazo.
- **«Si responde» con tiempo límite**: «respondió / no respondió en N h» colgando de cualquier tarjeta (el molde de ManyChat). Hoy escucha desde que el lead entra y cualquier respuesta pausa todo.
- **Guardar lo que el lead contesta en un campo** (su «Data Collection»): el email, el presupuesto, la fecha que propone.

**No copiar:**
- La respuesta automática a cualquier número o la bienvenida en la línea de Mauricio: medido, le escriben promos y mensajes personales. Contestarles arriesga el número.
- Botones, plantillas aprobadas y la ventana de 24 h: son de la vía oficial; el chatbot va por la no oficial.
- Randomizer y A/B: no hay volumen.
- WhatsApp masivo por la línea no oficial.
- Asientos, auto-asignación y analítica del equipo: el equipo es chico.

## Lo que pediste que va más allá de ManyChat

- **Varias flechas en paralelo desde una tarjeta** (punto 2): ManyChat no lo tiene; cada salida va a un
  solo paso y para correr dos cosas a la vez dispara otra automatización. Acá quedó en el mismo flujo.
- **El editor y «Probar» anchos** (puntos 3 y 8): ManyChat los tiene altos y angostos, a un costado.
