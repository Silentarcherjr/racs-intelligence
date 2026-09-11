# Handoff para Codex: grabar la voz y sincronizarla con el video

Anthony se quedó sin límite en esta sesión de Claude. Esto es lo que falta y
cómo terminarlo. No hace falta releer todo AGENTS.md para esto — con este
archivo alcanza.

## Dónde está todo

- **Guion de voz, 6 bloques:** `docs/VOZ_FINAL.md`. Configuración de Google AI
  Studio (modelo, idioma, instrucción de estilo) incluida ahí mismo.
- **Video sin voz, SIN estirar (117.7s), fuente de verdad para sincronizar:**
  `grabacion/racs-demo-final-raw.mp4`
- **Video sin voz, ya estirado 2× de forma uniforme (235.4s ≈ 3:55):**
  `grabacion/racs-demo-FINAL.mp4` — esto es solo una vista previa rápida de
  cómo se ve más lento. **No lo uses como base para sincronizar la voz**: un
  estiramiento uniforme no va a calzar con la duración real de cada bloque de
  audio. Trabaja siempre desde `racs-demo-final-raw.mp4`.
- Los tres clips que componen el raw, por si sirve tocarlos por separado:
  `racs-tour-es-v2.mp4` (74.2s) + `racs-grafana-es.mp4` (11.5s) +
  `racs-egress-es.mp4` (32.0s).

## Paso 1 — Generar el audio

Seguir `docs/VOZ_FINAL.md` tal cual: 6 archivos, `01.wav` … `06.wav`, en
Google AI Studio → Speech (Gemini 3.1 Flash TTS, español latinoamericano,
la instrucción de estilo ya está escrita ahí). Guardarlos en
`grabacion/voz/`.

## Paso 2 — Dónde entra cada bloque en `racs-demo-final-raw.mp4`

Estos son los tiempos REALES del video sin estirar (verificados por Claude
viendo el video, no exactos al frame, pero sí a menos de ~1-2s):

| Bloque | Rango en racs-demo-final-raw.mp4 | Qué se ve |
|---|---|---|
| 01 | 0.0 – 10.0s | Dashboard poblado + selector ES/EN |
| 02 | 10.0 – 30.0s | Incidente DGA, luego incidente de tunneling con su evidencia |
| 03 | 30.0 – 44.0s | Se abre el incidente de Banco Aurora, evidencia, la captura del sandbox |
| 04 | 44.0 – 54.0s | Clic en «Explicar con QVAC», espera real, resultado, se cierra el modal |
| 05 | 54.0 – 85.7s | Salud de la red (QoE) → Inteligencia local (panel de runtime) → Grafana |
| 06 | 85.7 – 117.7s | Terminal corriendo `verify-zero-egress.sh` hasta «RESULTADO: APROBADO» |

**Nota sobre el bloque 05:** el guion (`VOZ_FINAL.md`) se escribió antes de
agregar la pantalla «Inteligencia local» al recorrido, así que el texto habla
de QoE/Grafana pero no menciona el panel de runtime (modelos cargados,
latencia, contadores de zero-egress) que también aparece en ese rango. No
hace falta re-grabar la voz por esto: ese panel es believable como B-roll
bajo la misma narración — si sobra tiempo, se le puede agregar una frase
corta antes de "Y todo esto vive también en un panel de operaciones real...".

## Paso 3 — Estirar cada segmento para que calce con su audio

Por cada bloque `i` (1 a 6), con límites `INICIO` y `FIN` de la tabla:

```bash
cd "/Users/anthonymorell/Documents/HACKATON AI/grabacion"
RAW=racs-demo-final-raw.mp4

# Duración real del audio de este bloque (segundos, con decimales)
AUDIO_DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "voz/0${i}.wav")

# Duración del segmento de video sin estirar
VIDEO_DUR=$(echo "$FIN - $INICIO" | bc)

# Factor de estiramiento (si AUDIO_DUR < VIDEO_DUR, el factor es <1 y el
# video se acelera un poco en vez de alargarse — está bien, es normal que
# algún bloque de audio salga más corto que su tramo de video)
FACTOR=$(echo "$AUDIO_DUR / $VIDEO_DUR" | bc -l)

ffmpeg -v error -ss $INICIO -to $FIN -i "$RAW" \
  -vf "setpts=${FACTOR}*PTS,fps=30" \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p \
  -y "seg_0${i}_video.mp4"

# Mezclar con su audio (el video ya dura lo mismo que el audio gracias al
# estiramiento; -shortest es solo un seguro por redondeo)
ffmpeg -v error -i "seg_0${i}_video.mp4" -i "voz/0${i}.wav" \
  -c:v copy -c:a aac -b:a 192k -shortest \
  -y "seg_0${i}_final.mp4"
```

No hace falta un script — con 6 bloques es más rápido a mano, copiando y
ajustando `INICIO`, `FIN` e `i` cada vez con los valores de la tabla de
arriba.

## Paso 4 — Concatenar los 6 con audio

```bash
cd "/Users/anthonymorell/Documents/HACKATON AI/grabacion"
printf "file 'seg_01_final.mp4'\nfile 'seg_02_final.mp4'\nfile 'seg_03_final.mp4'\nfile 'seg_04_final.mp4'\nfile 'seg_05_final.mp4'\nfile 'seg_06_final.mp4'\n" > concat-con-voz.txt
ffmpeg -v error -f concat -safe 0 -i concat-con-voz.txt -c copy -movflags +faststart -y racs-demo-CON-VOZ.mp4
ffprobe -v error -show_entries format=duration -of csv=p=0 racs-demo-CON-VOZ.mp4
```

Esa duración final es la que cuenta para el límite de 5 minutos del
hackathon. Si algún bloque de audio salió muy largo y el total se pasa de
~4:30, lo más fácil es recortar la pausa de silencio al final del guion de
ese bloque en el WAV (no el video) antes de rehacer el paso 3 para ese
bloque.

## Verificación antes de dar por terminado

- Reproducir `racs-demo-CON-VOZ.mp4` completo una vez, de principio a fin,
  con volumen — confirmar que no hay saltos ni silencios largos entre
  bloques (si los hay, casi siempre es porque `INICIO`/`FIN` de la tabla
  quedó desalineado con el corte real; ajustar a ojo viendo el video).
- Confirmar que el video sigue en español en todas las pantallas — no debería
  haber cambiado nada de eso, pero si algo se ve raro después de un
  `setpts`, es señal de que el corte partió un modal a la mitad.
- Actualizar `AGENTS.md` §4 y §10 al terminar, como pide `CLAUDE.md` — quién
  hizo esto (Codex) y que el video final con voz quedó en
  `grabacion/racs-demo-CON-VOZ.mp4`.
- El repo sigue **privado** — hay que hacerlo público antes de enviar
  (`gh repo edit --visibility public --accept-visibility-change-consequences`),
  eso ya estaba pendiente antes de este handoff y sigue siéndolo.
