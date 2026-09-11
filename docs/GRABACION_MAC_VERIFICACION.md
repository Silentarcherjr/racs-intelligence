# Verificación de grabación macOS — 2026-09-11

Ejecutada por Codex (GPT-6), siguiendo `GRABACION_MAC.md`. No se grabó video.

## Verificado

- `git checkout main && git pull`: ya actualizado.
- `npm install && npm run build`: salida 0.
- Kafka y ClickHouse: healthy en Docker Compose.
- `npm run bootstrap`: esquema aplicado, pesos MedPsy encontrados, `Ready.`
- UI anterior reiniciada; `/api/capabilities`: `{"textModel":true,"reason":null}`.
- Se vació únicamente `sentinel.dns_incidents` antes del calentamiento.
- `npm run demo -- typosquat`: 48 eventos; consulta al terminar: 20 incidentes y 19 con `screenshot_path`.
- Chrome: incidente `micr0soft-secure-login.example`, riesgo 85, captura del banco ficticio visible en el detalle. Botón QVAC activo y operativo.
- Dos solicitudes del botón produjeron texto mayormente español. La primera incluyó `利用`; la segunda incluyó `typical`. No se certifica una latencia exacta: no se cronometró.
- Subidas reales observadas en logs: 60→85, 55→80, 80→100, entre otras. No se observó el 64→89 que narra el guion; no debe afirmarse que esa cifra corresponde a esta corrida.
- `./scripts/verify-zero-egress.sh`, repetido **con el demo detenido**: PASS, socket `[::1]:9092`, 2 conexiones locales, 0 bloqueadas. El propio panel declara `Current model: none loaded`; no constituye prueba de egress durante inferencia.

## Incidencias

- El control de escritorio denegó `com.apple.Terminal` por seguridad. No se intentó sortear esa restricción. Impide manejar la ventana requerida para la grabación automatizada.
- Al cerrar el calentamiento se abortó una investigación visual con `WORKER_SHUTDOWN` y apareció `alert sink failed (others succeeded) — http: TypeError: fetch failed`. El archivo registró 19 alertas. Aunque el comando salió con 0, no se considera una corrida sin errores.
- El verificador ejecutado mientras el demo estaba activo imprimió PASS con la lista de sockets vacía y sin panel SOVEREIGN MODE. Se descartó ese resultado y se repitió secuencialmente. La causa no fue confirmada; revisar manejo de fallo de arranque/puerto 3002.
- Cosmética: aparecen `Incident investigation`, `Inspect`, `Explain with QVAC`, encabezados del detalle y varios textos de estado en inglés pese a ES seleccionado.
- Modelo: mezcla idiomas y algunas explicaciones sobreinterpretan la evidencia; conservar la salida real y revisar la toma.

## Entrega

La UI sigue disponible en `http://127.0.0.1:3001`, con datos y capturas del calentamiento conservados para inspección. El demo y el verificador terminaron; el agente del demo ya no está activo. La UI ejecuta la explicación en su propio proceso.

No se apagó Wi-Fi, no se generó voz ni se creó/exportó video. No se encontraron audios WAV/MP3/M4A en el repositorio. No se cambiaron fuentes, modelos, `.env` ni contratos.

Antes de grabar, resolver o evaluar las incidencias del cierre. La toma de Terminal requiere intervención manual: colocar Terminal y Chrome juntos y seguir el paso 5 del guion. Vaciar la tabla solo después de inspeccionar estos resultados. Ejecutar `npm run demo -- typosquat --wait --keep-alive`, iniciar la grabación de la región y pulsar Enter. No incorporar la interfaz del agente al encuadre.

El calentamiento sin `--keep-alive` termina sus procesos y descarga los modelos del agente; no garantiza que la siguiente ejecución evite la carga en frío. La explicación de la UI usa otro proceso, verificado por separado.

## Prueba de captura entregada por Anthony — 00:41

Archivo del Escritorio indicado por el usuario: grabación de 12.41.06 a. m. Revisado con ffprobe y tres fotogramas extraídos. Duración 7.583333 s, H.264, 3430×1874, tasa nominal 60 fps, sin pista de audio. Terminal y Chrome encuadrados; demo esperando Enter. Texto de Terminal pequeño para entrega 1080p: aumentar antes de toma. Tooltip del grabador arriba al inicio; desaparece en el último fotograma. Franja estrecha entre ventanas: ajustar unión o recortar en edición. No es la toma final.
