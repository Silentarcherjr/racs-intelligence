# Grabación en macOS — plan B

Todo está levantado en esta máquina desde hace 33 horas: colima, Kafka,
ClickHouse, Grafana, la UI y el sitio señuelo. Los modelos están en `.env`.

**Ventaja sobre Windows:** aquí `scripts/verify-zero-egress.sh` sí funciona
(usa `lsof`), así que la prueba de cero egress se puede mostrar en cámara como
salida de terminal, que es más contundente que un panel.

---

## Para el agente — copiar todo lo de abajo

```
Vas a grabar el video de demostración de un proyecto de hackathon. Máximo 5
minutos. Trabajas en macOS.

Tu interfaz NO debe aparecer en la grabación. Se capturan solo dos ventanas:
la terminal y el navegador en 127.0.0.1:3001. Razón: el producto demuestra
que ninguna IA en la nube toca los datos; tu interfaz en pantalla contradice
eso visualmente.

No generes la voz: el equipo la entrega aparte.

═══ CUÁNDO ARREGLAR Y CUÁNDO PARAR ═════════════════════════════════════════

ARREGLA TÚ Y SIGUE — problemas de entorno:
  - proceso viejo ocupando un puerto nuestro (3001, 3002, 8099, 8081)
  - contenedor caído, build desactualizado, esquema sin aplicar
  - datos viejos en pantalla, carpeta que falta
  - algo que aún no arranca: espera y reintenta hasta 3 veces
  Arréglalo, di en una línea qué hiciste, y continúa.

ANOTA Y SIGUE — imperfecciones cosméticas:
  - una etiqueta suelta en inglés, un espaciado raro, un ícono torcido
  Quedan pocas horas. Anótalo al final del reporte y NO te detengas.

PARA Y AVISA — el producto no muestra lo que debe:
  - la tabla de incidentes sale vacía, o ninguno tiene cámara
  - los modelos aparecen como no disponibles
  - el botón "Explicar con QVAC" queda gris o no responde
  - la captura no carga en el detalle del incidente
  - el riesgo no sube tras la investigación visual

NUNCA: git reset --hard, docker compose down -v, docker system prune, borrar
.env o los modelos, instalar herramientas sin preguntar, editar código para
esquivar un problema, o relajar una verificación para que pase.

═══ PASO 1 · ACTUALIZAR ════════════════════════════════════════════════════

  cd "/Users/anthonymorell/Documents/HACKATON AI"
  git checkout main && git pull
  npm install && npm run build

═══ PASO 2 · ENTORNO ═══════════════════════════════════════════════════════

Los contenedores ya llevan días corriendo. Solo confirma:

  docker compose ps        → clickhouse y kafka deben decir "healthy"
  npm run bootstrap        → debe terminar en "Ready."

Si algún contenedor no está, levántalo:  docker compose up -d

Mata la UI vieja y relánzala. ESTO IMPORTA: si un proceso anterior sigue en el
3001, el nuevo falla en silencio y el viejo sirve el build ANTERIOR al pull.
Los síntomas son endpoints que "no existen" y texto sin traducir.

  lsof -ti:3001 | xargs kill -9 2>/dev/null
  npm start -w @sentinel/analyst-ui &

Espera 5 segundos y comprueba que sea el build nuevo:

  curl -s http://127.0.0.1:3001/api/capabilities

Debe devolver {"textModel":true,...}. Si dice "Not found", el proceso viejo
sigue vivo: repite el kill.

Limpia la base para que la pantalla arranque vacía:

  curl -s --data-binary "TRUNCATE TABLE sentinel.dns_incidents" \
    -H "X-ClickHouse-User: sentinel" -H "X-ClickHouse-Key: sentinel" \
    http://127.0.0.1:8123/

═══ PASO 3 · CALENTAMIENTO — NO GRABAR ═════════════════════════════════════

  npm run demo -- typosquat

Déjala terminar (~2 min). Carga los modelos en memoria. Sin esto, el video
tiene 15 segundos muertos esperando a MedPsy.

Vuelve a limpiar dns_incidents con el mismo comando.

═══ PASO 4 · VERIFICACIONES ════════════════════════════════════════════════

1. docker compose ps → clickhouse y kafka "healthy"
2. curl -s http://127.0.0.1:3001/api/capabilities → textModel true
3. Abre http://127.0.0.1:3001 y recarga con Cmd+Shift+R
4. Tras el calentamiento: al menos 3 incidentes, al menos uno con cámara
5. Clic en uno con cámara: se abre la captura, el botón "Explicar con QVAC"
   está activo, y al pulsarlo aparece un análisis en español en ~5 segundos

Si 1, 2, 4 o 5 fallan, para. Si solo hay detalles visuales, anota y sigue.

═══ PASO 5 · GRABAR ════════════════════════════════════════════════════════

Dos ventanas lado a lado: terminal izquierda, navegador derecha.
NO abras Grafana.

Graba con Cmd+Shift+5 → "Grabar porción seleccionada", encuadrando solo esas
dos ventanas. 1920x1080 si puedes elegir.

  npm run demo -- typosquat --wait --keep-alive

Se detiene esperando Enter. Empieza a grabar PRIMERO, y presiona Enter con la
cámara corriendo: así el video abre con un incidente en vivo y no con los logs
de arranque de Kafka.

Tomas, en orden:

  0:00-0:30  La UI poblada. Plano general.
  0:30-1:05  Terminal: detecciones con evidencia y peso.
  1:05-2:00  ZOOM a la línea "investigating:" — el momento clave. Luego el
             render y el análisis visual. El riesgo sube de 64 a 89.
  2:00-2:45  Clic en un incidente con cámara. La captura del sitio falso
             junto a la evidencia DNS. Plano cerrado.
  2:45-3:20  Pulsa "Explicar con QVAC". GRABA LA ESPERA COMPLETA de ~5 s.
  3:20-4:00  QoE y correlación: dos sedes, veredictos opuestos.
  4:00-4:35  Terminal:  ./scripts/verify-zero-egress.sh
             Aquí SÍ funciona. Muestra el PASS completo.
  4:35-5:00  Apaga el WiFi desde la barra de menú y vuelve a correr el demo.
             Funciona igual. Toma de cierre.

═══ PASO 6 · EDITAR ════════════════════════════════════════════════════════

Objetivo: 5 minutos exactos o menos.

- NO aceleres ningún texto que el espectador deba leer.
- NO cortes la espera de la inferencia. Esos 5 segundos son el argumento:
  una API en la nube respondería en 300 ms y se habría llevado los datos.
- Cortes duros. Sin transiciones. Sin música.
- Zoom lento y sostenido, no un salto.
- Exporta 1920x1080, 30fps, H.264.

Rótulos sobrios, esquina inferior izquierda:

  0:30  Detección determinista · cuatro motores
  1:05  El sistema decide que le falta evidencia
  2:00  Evidencia visual, capturada y analizada en esta máquina
  2:45  Modelo local · MedPsy-4B · sin conexión a la nube
  3:20  Seguridad y operaciones en un solo contexto
  4:00  Cero egress, verificado
  4:35  Sin red

═══ PASO 7 · VOZ ══════════════════════════════════════════════════════════

El equipo entrega ocho audios: 01 apertura, 02 detección, 03 investigación,
04 evidencia en la UI, 05 la espera, 06 correlación, 07 zero-egress, 08 cierre.

- Si un audio es más largo que su toma, ALARGA la toma. Nunca aceleres la voz.
- Si es más corto, deja el silencio.
- La voz no debe tapar un momento donde haya que leer texto.
- Si el total pasa de 5:00, avisa ANTES de exportar.

═══ AVISOS ════════════════════════════════════════════════════════════════

- El modelo de texto es de 4B y a veces mezcla idiomas. Si sale un carácter
  raro en cámara, repite la toma. No es un bug.
- Si queda alguna etiqueta en inglés en paneles laterales: anótala, no pares.
```

---

## Los textos para la voz

Están en `docs/GRABACION.md`, sección 2. Son los mismos en Mac y Windows.

## Estado de esta máquina

Comprobado el 2026-09-11 00:20:

```
colima       corriendo
clickhouse   healthy (33 h)
kafka        healthy (33 h)
grafana      arriba
UI 3001      abierta
señuelo 8099 abierto
modelos      en .env, ambos
grabación    Cmd+Shift+5 (OBS no instalado)
```
