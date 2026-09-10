# Desarrollo local en Windows

Preparado para Ralu13. La interfaz escucha en http://127.0.0.1:3001 y Grafana en
http://127.0.0.1:3000. Los modelos MedPsy-4B, VisionPsy-Nano-460M-Flash y su
proyector estan en `models/`, con SHA256 verificado contra Hugging Face. `.env`
contiene las rutas absolutas locales; ni los modelos ni `.env` se versionan.

## Volver a iniciar tras cerrar los procesos o reiniciar Windows

Abre Docker Desktop y espera a que el motor este listo. Desde la raiz del repo:

```powershell
docker compose up -d
npm run build
```

En una terminal deja la interfaz:

```powershell
npm start -w @sentinel/analyst-ui
```

En otra terminal deja el agente, el receptor compatible con Wazuh y el sitio
ficticio para capturas:

```powershell
npm run demo -- typosquat --keep-alive
```

La generacion de eventos termina tras unos 25 segundos. La inferencia local puede
continuar varios minutos; `--keep-alive` conserva el agente y los modelos cargados
para consultar el panel. Ctrl-C detiene la ejecucion en esa terminal. No inicies
una segunda demo mientras la anterior siga ocupando los puertos 3002, 8081 y 8099.

No se necesita volver a descargar dependencias, Chromium ni modelos. Tras cambiar
TypeScript, ejecuta `npm run build` y reinicia el proceso correspondiente.

## Ajustes locales verificados

- Las capturas se sirven desde la raiz del repo, incluso con `npm start -w`.
- Repetir una demo conserva las capturas de incidentes anteriores en ClickHouse.
- `--keep-alive` mantiene el panel del agente disponible tras generar eventos.
- Grafana usa las ultimas 24 horas en lugar de una fecha fija.
- Compilacion y 21 pruebas existentes correctas. Ambos modelos ejecutaron
  inferencia local; capturas verificadas en un navegador real.

El receptor de alertas
es el compatible que trae el proyecto; no es una instalacion completa de Wazuh.
Los registros de esta preparacion estan en `node_modules/.cache/sentinel/`.