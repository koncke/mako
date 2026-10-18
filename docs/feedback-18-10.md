# Feedback de Martín del 18/10/2026 (~10:45 ART): 15 puntos

> Llegó por el chat del Cerebro: por el Ops Center no se podía mandar («Acórtalo a 8000 caracteres»). Capturas en
> `docs/feedback-18-10/` (11 y 12: /clients con las tarjetas rotas; 13: /dashboard con «Analizar con MaKo»).
> **Prioridad que dio Martín:** «de todo este feedback le des prioridad al onboarding. Y del resto puedes ir avanzando en
> cosas que no consuman muchos tokens o que no sea una implementación completa, porque ya estamos al limite».
> La cuenta 4 está en 91% semanal, se reinicia el 20/10 a las 17:00 ART y al 97% se corta.

## Reglas que deja (valen para todo código nuevo)

- **Lo que se pide en SuperAdmin aplica a TODOS los workspaces**, salvo que sea exclusivo de SuperAdmin (pt 1).
- **Un solo chat en toda la app:** el del Ops Center. Offer, Chats, Dashboard («Analizar con MaKo»), onboarding y Second Brain usan el mismo diseño y las mismas funciones, y cada chat con MaKo que se abre en la app cae en el Ops Center (pts 1, 5, 7, 11, 12, 15).
- **MaKo se llama «Ops Center» y lleva la ESTRELLA** en SuperAdmin y en los ws. Nunca la gota de agua (pts 1, 15).
- **Editar = el patrón de Web Generator:** el chat con MaKo como barra fija a la derecha, en todo lo que se edita (pt 12).
- **Historial en TARJETAS** en toda la app, como el de «actividad» de Chats (pt 11).
- **Sidebar:** todas las secciones desplegadas por defecto. Ops Center va dentro de la sección «Plan · Chats · Dashboard», que también se pliega. MaKo Partners va al desplegable del perfil. Sigue el modo claro/oscuro. Las criaturas no cambian de color (pt 10).

## Los 15 puntos, con quién los lleva

| # | Qué | Quién | Estado |
|---|---|---|---|
| 15 | **ONBOARDING:**<br>- estrella, sin círculo azul, entrada épica;<br>- la misma animación para cargar, sin clic;<br>- al terminar, a Ops Center, con la criatura reubicándose en la sidebar de chats;<br>- sin la respuesta rápida «Soy»;<br>- nunca datos de otro ws (pasó «Consultesis»);<br>- fuera «¿qué quieres lograr en 90 días?»;<br>- «¿cómo llegaste?» y «¿qué resolver primero?» al final;<br>- explicativo al empezar («necesito que me cuentes… no más de 5 minutos»);<br>- el chat unificado;<br>- halagos GENUINOS;<br>- fuera las preguntas irrelevantes («¿qué recibe en las primeras 24 horas?»);<br>- respuestas rápidas siempre. | chat Onboarding | prioridad 1 |
| 14 | **Clients:**<br>- las tarjetas, rotas (foto gigante, texto sin estilo);<br>- sin el título «Clients» (ya está la tab);<br>- el desplegable dice «VSL Funnel» con el nombre viejo, y sobra porque el de la topbar ya cambia de CRM;<br>- el fondo, el de MaKo (no crema), con cuadrícula. | chat CRM | cliente roto: primero |
| 8 | **CRM:**<br>- la columna con su bloque de fondo;<br>- «Próximo» plegado por defecto, se abre con el ícono del calendario en vez del pop-up. | chat CRM | chico |
| 9 | **Plan:**<br>- la vista previa de la tarea sin «Prioridad», sin «Origen» y sin el aviso de falta deadline;<br>- el check gris a la derecha, al lado de la basura;<br>- columnas editables como en el CRM. | chat CRM (lo chico); columnas editables, después del 20/10 | parte chica |
| 10 | Sidebar (ver reglas): el logo plegado está desalineado. | chat Sidebar | chico |
| 4 | **Second Brain:**<br>- el super admin con UN solo grafo;<br>- al entrar al Second Brain, la sidebar principal se pliega. | chat Second Brain (grafo) + chat Sidebar (pliegue) | chico |
| 1 | **Second Brain de los ws:**<br>- se llama «Mapa» (no tiene sentido);<br>- el chat no es el del Ops Center;<br>- la criatura, estrella. | chat Second Brain (nombre); el chat unificado, después del 20/10 | parte chica |
| 6 | El scroll del chat no sigue al escribir con saltos de línea. | chat del Ops Center | chico |
| — | El Ops Center no deja mandar más de 8000 caracteres: tiene que dejar mensajes mucho más largos. | chat del Ops Center | chico |
| 13 | **¿Está solucionado todo lo que pidieron los clientes en las llamadas, para depurar?** (informe) | chat Plan / extracción | sólo lectura |
| 2 | «Uso» en los ws: conectar Claude/GPT desde ahí si no hay cuenta conectada. | después del 20/10 | — |
| 3 | La Ticketera: volver al diseño anterior acomodando la info nueva. | después del 20/10 | — |
| 5 | **Todos los chats con MaKo en el Ops Center:**<br>- Offer y el grupo de MaKo, con una copia;<br>- responde la cuenta de Claude/GPT conectada, salvo lo que sí necesita tokens (crons de 24 h). | después del 20/10 | — |
| 7 | Los demás chats (Offer…) con las funciones del chat del Ops Center. | después del 20/10 | — |
| 11 | **Chats:**<br>- réplica del chat del Ops Center;<br>- los comentarios, al desplegable de contacto y al detail del lead (sección comentarios, que se crea si no está);<br>- fuera «Actividad», pero su historial en tarjetas va a toda la app;<br>- «Abrir panel» reemplaza a «Contacto»;<br>- fuera «Cerrar» y «Posponer»;<br>- Equipo: el logo de MaKo, la X para quitar y «Nuevo miembro» con el form ahí mismo;<br>- MaKo, desplegable con la automatización actual;<br>- la etapa no tapa el nombre ni la foto;<br>- ver los otros CRM;<br>- fuera «La bandeja» (lo útil pasa a filtros). | después del 20/10 | — |
| 12 | **Dashboard:**<br>- «Analizar con MaKo» abre el chat unificado;<br>- el botón sale del lado del filtro (ya está en los 3 puntos);<br>- «Editar» con el patrón de Web Generator. | después del 20/10 | — |

## Pt 13: lo que pidieron los clientes para depurar (informe de «MaKo en WhatsApp», 18/10 ~14:00 UTC, sólo lectura)

**Por WhatsApp (medido en el código y en producción):**
- **Pablo (ws18):**
  - Calendario, agendar, los datos de Nancy, «déjame ver», groserías: EN PRODUCCIÓN (4569887d9 y 8d90f8357), con su aviso enviado.
- **Código Inmobiliario (ws13):**
  - «Reprogramame la reunión», «Si 18 de noviembre», «Pasamelo»: EN PRODUCCIÓN (618c79c45 y 4569887d9).
  - **SIN HACER:**
    - «Programá un mensaje por privado a un número»: capacidad nueva, choca con «a terceros sale el número del usuario».
    - Los carteles de IA (Gemini 503 y timeout, con una sola key): falta la cascada, o sea gasto de IA.

**Por llamadas (estado del TABLERO del Plan del ws9; no se cruzó con commits):**
- **Leila (847861420):** por hacer, vincular varias líneas de WhatsApp.
- **Mau <> Martin (863534245):** por hacer:
  - la API key restringida al conectar el dominio de email;
  - «Quitar» un pago, que no se aplicó al primer intento.
- **«Revisión de MaKo» (863534246):** por hacer:
  - cuelgues al generar automatizaciones con IA;
  - un error de render en el Video Editor;
  - el evaluador del Web Generator, que no da observaciones;
  - crear un flujo «en el acto» y pegar uno copiado en otro negocio.

  Hay 12 más en hecho.

**Ticketera:** ningún ticket de un cliente. Los únicos dos son los del sistema en el ws1 (#5 y #6, sin IA).

**Sin confirmar:**
- que lo «hecho» del tablero esté en producción;
- las reuniones de planes que no son el del ws9.

Dato extra: «Que el doer registre solo lo que falla» figura por hacer y ya está en main (118148d1e).

## Más del 18/10 (probando el onboarding en el ws3)

- «En lugar de "Revisando tu respuesta", sólo debería aparecer la animación de los ... como que está escribiendo»: lo hace el chat Onboarding, en chico.
- «La interfaz de cuando subo un archivo y en general todo el chat del onboarding se debe ver igual que en el Center». Hoy al subir un PDF se abre una vista propia: la hoja grande, «Leyendo…», las miniaturas abajo y un botón verde. **Es la primera pieza del chat unificado después del 20/10**: el onboarding toma el chat del Ops Center tal cual, con su manera de adjuntar.
