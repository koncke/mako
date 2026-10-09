# Feedback del curso de Customer Success: el audio del 08/10/2026 a la noche (27 min)

Martín lo mandó el 09/10 («te adjunto el último audio de feedback»). Es la SEGUNDA prueba del
curso con Leandro, que lo usa con sus productos «Service Delivery Ops» y «Fiesta Music», después
de las correcciones del audio de la tarde (`docs/feedback-curso-08oct.md`, commit `dbae4da9`).
Él lo prueba en pantalla compartida y Martín le explica.

Transcripto con la cascada del repo en tramos de 3 minutos (`scripts/transcribir-audio.ts`):
Gemini daba timeout y lo hizo Whisper. Las voces no vienen separadas: quién dice qué se deduce del
contenido. Los minutos son aproximados.

## Lo que ya anda (lo dijo él)

- Crear un producto, renombrarlo, publicar y que la vista del alumno se actualice (min 1-2).
- La portada y los colores («me encanta»), el video de Panda por link y por embed (min 3).
- «Guardar» que marca en rojo lo que falta («falta la pregunta, me encanta»), las imágenes en la
  descripción, las tareas en su contenedor («ahora sí se entiende cada campo»), los tipos de
  escala, estrellas y quiz, y que al guardar se desliza solo hasta lo que falta (min 4-9).
- «Empezar» lleva a la última clase vista; la interfaz en general («a nivel diseño no tengo
  ninguna queja», min 25).

## Customer Success (el curso)

1. **Al crear un producto, el campo del nombre pierde el foco con cada letra** (min 0-1): «cada vez
   que se introduce un carácter se deselecciona el cuadro de texto».
2. **La escala y las estrellas, CENTRADAS** en la vista del alumno, no alineadas a la izquierda
   (min 9).
3. **El quiz no le dice al alumno si acertó** (min 9-10): «hay un error en el quiz que no te dice
   el resultado».
4. **El scroll de la vista del alumno**: con el cursor sobre el contenido no desliza, sólo afuera;
   «hay dos scroll». Tiene que deslizar con el cursor en cualquier lugar menos en la barra lateral
   (min 10-11).
5. **La previsualización y la vista real no coinciden en el quiz**: como alumno de verdad le
   aparece «aprobado al 100%» y en la previsualización no se ve la respuesta correcta (min 22).
6. **El mail de invitación nombra DOS productos** («Tu acceso al programa de Service Delivery Ops y
   Fiesta Music»): tiene que invitar al producto donde está parado, y el alumno no tiene que ver
   los nombres de los otros (min 19-20).
7. **El invitado a UN curso entra a los DOS** (min 21): «tengo acceso a los dos cursos, cuando sólo
   le había invitado al curso de Fiesta Music». ⚠️ El acceso se resuelve por cliente y no por
   producto (`productosDelAlumno`).
8. **«Este enlace es personal, no lo compartas» no debería aparecer**: en su lugar «Este curso es
   personal, no lo compartas» o «© Derechos reservados {marca}», como Mastery House o Blue Hackers
   (min 26).
9. **El formulario de invitar pierde lo escrito al salir de la pestaña**: «que se vuelva borrador
   siempre» (min 15-16).
10. **Si falta la key del mail, configurarla AHÍ MISMO** (min 12, 17): el invitar decía «Resend API
    key no configurada» y mandaba a Integraciones en otra pestaña. Regla general que pidió: «si no
    hay configurada una API, siempre, en toda pestaña, tiene que salir ahí mismo la opción de
    configurarla».
11. **El teléfono es obligatorio al invitar** y quizá no debería (min 11-12, «esto lo puedo pasar
    porque por ahí no lo tengo»). Invitar también lo crea en el CRM y en el kanban de clientes.
12. **La lista de invitar no mostraba al que acababa de agendar** (min 15): no era cliente ganado.
    Es lo esperado, pero no se entendió.

### Ideas, para decidir (no son bugs)

- **Personalizar el diseño del mail de invitación** (min 20, «nice to have»).
- **El Curso como una pestaña más de la comunidad, como el Classroom de Skool** (min 23-24).
  Martín explicó por qué está separado (la comunidad es opcional, Mauricio no la quiere) y a
  Leandro le gusta así: no hay pedido.
- **Los niveles del ranking de la comunidad** salen sin configurar y no se sabe cómo se configuran
  (min 22).
- **Gestionar el grupo de WhatsApp del curso desde MaKo** (min 27): «es muy normal que los
  infoproductores tengan un grupo de WhatsApp con sus alumnos».

## Integraciones (otro chat)

13. **El tutorial de una integración**: el link para sacar la key, ARRIBA del todo (hoy está abajo);
    el «?» dentro del campo pasa desapercibido; sacar el texto gris de debajo del campo («Empieza
    con re_, se saca en resend.com»: «no lo va a leer nadie»); un «Cómo configurarlo» visible
    debajo del campo, y al abrirlo el link directo a la página de keys (min 12-14).
14. **Una forma fácil de conectar el mail, con Google/Gmail**, como el WhatsApp no oficial con QR
    (min 14-15).
15. **El estado de Resend mentía**: decía «no conectado» con la key puesta, y lo que faltaba era el
    REMITENTE, que figura como opcional (min 18-19).
