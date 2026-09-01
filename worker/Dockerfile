# =============================================================================
# El worker de montaje — ffmpeg + node, nada mas
# =============================================================================
# ── Por que existe un contenedor y no una funcion serverless ────────────────
# Vercel no trae ffmpeg, y aunque lo trajera no seria el lugar: el pipeline
# encadena ~15 invocaciones de ffmpeg mas 8 de API, y un render de 70 s son ~25 s
# de CPU. Eso no entra en el modelo de una funcion, y la palanca del costo en
# Vercel es el TAMAÑO de la maquina, no la duracion — asi que pagarlo ahi es la
# forma cara de hacerlo mal.
#
# Decidido por Martin el 01/09/2026: contenedor propio.
#
# ── Que NO lleva, a proposito ───────────────────────────────────────────────
# · python. El montaje lo usaba en tres lugares para leer un JSON; se reemplazo
#   por `scripts/loudnorm-json.mjs`. Una imagen sin python es la garantia de que
#   no vuelva a colarse una dependencia de la maquina de alguien.
# · Fuentes del sistema. La unica que se usa viaja en `worker/fuentes/` y se pasa
#   con `fontsdir`. Ver abajo.

FROM node:22-bookworm-slim

# ffmpeg y las fuentes base. `fonts-liberation` NO es la que se usa: esta para
# que libass tenga algo razonable si alguna vez cae — la caida sigue siendo un
# error, pero al menos no es tofu.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg fonts-liberation ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ⚠️ LA FUENTE VA EN LA IMAGEN, Y ES LO QUE MAS SILENCIOSAMENTE SE ROMPE.
#
# El .ass pedia `Segoe UI Black`, que existe en Windows y no en Linux — y libass
# NO FALLA cuando no encuentra una fuente: cae a otra y sigue. Comprobado
# renderizando el mismo cuadro con y sin `fontsdir`: sin el, el texto sale en una
# Arial fina y ancha, con ffmpeg saliendo en 0 y ni una linea en el log.
#
# Anton es OFL (se puede redistribuir), su nombre de familia es exactamente
# «Anton» —verificado leyendo la tabla `name` del .ttf, que es lo que libass
# busca— y es condensada y pesada como la que se venia usando, asi que los topes
# de caracteres del generador de subtitulos siguen valiendo.
COPY worker/fuentes/ /app/worker/fuentes/
COPY scripts/montar-anuncio-sin-silencios.sh \
     scripts/plan-cortes-anuncio.mjs \
     scripts/gen-filtros-anuncio.mjs \
     scripts/subs-anuncio.mjs \
     scripts/verificar-corte-anuncio.mjs \
     scripts/loudnorm-json.mjs \
     /app/scripts/
RUN chmod +x /app/scripts/montar-anuncio-sin-silencios.sh

ENV SUBS_FUENTE=Anton \
    SUBS_FONTSDIR=/app/worker/fuentes \
    CLIPS=/trabajo/clips

# ⚠️ SE COMPRUEBA EN EL BUILD, no en la primera corrida de un cliente.
#
# Las dos cosas que hacen que el pipeline entregue un archivo MAL en vez de
# fallar: que no haya ffmpeg (falla ruidoso, no hace falta chequear) y que la
# fuente no este donde el filtro la busca (falla mudo). La segunda se verifica
# renderizando un cuadro y exigiendo que salga distinto del que sale sin
# `fontsdir` — si son iguales, la fuente no se esta usando.
RUN set -eu; \
    cd /tmp; mkdir -p fuentes; cp /app/worker/fuentes/*.ttf fuentes/; \
    printf '%s\n' \
      '[Script Info]' 'ScriptType: v4.00+' 'PlayResX: 720' 'PlayResY: 1280' '' \
      '[V4+ Styles]' \
      'Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding' \
      'Style: P,Anton,72,&H00FFFFFF,&H00000000,&H00000000,0,1,4,0,5,20,20,400,1' '' \
      '[Events]' \
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text' \
      'Dialogue: 0,0:00:00.00,0:00:01.00,P,,0,0,0,,PRUEBA ANTON' > p.ass; \
    ffmpeg -v error -f lavfi -i "color=c=black:s=720x1280:d=1" -vf "ass=p.ass:fontsdir=fuentes" -frames:v 1 con.png; \
    ffmpeg -v error -f lavfi -i "color=c=black:s=720x1280:d=1" -vf "ass=p.ass" -frames:v 1 sin.png; \
    if cmp -s con.png sin.png; then \
      echo "ERROR: el render con fontsdir es IDENTICO al de sin fontsdir." >&2; \
      echo "       Anton no se esta cargando y los subtitulos saldrian con otra fuente, sin avisar." >&2; \
      exit 1; \
    fi; \
    echo "fuente Anton: verificada en el build"; \
    rm -f p.ass con.png sin.png; rm -rf fuentes

# El trabajo entra por aca: clips, guion y salida.
VOLUME ["/trabajo"]

# Sin CMD todavia: el bucle que consume la cola es el paso siguiente. Hoy la
# imagen se corre a mano contra un directorio de trabajo, que es como se
# verifica que el pipeline anda antes de darle una cola.
ENTRYPOINT ["/bin/bash"]
