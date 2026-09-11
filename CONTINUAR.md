# Continuar sin Claude

Escrito el 2026-09-11 00:20 Panamá, a 7h40m del cierre. El presupuesto de
Claude se agotó; esto es para que Codex o Astra terminen.

## Estado

**Falta una sola cosa: el video.** Todo lo demás está hecho y verificado.

```
build          limpio
tests          21/21
auditoría i18n sin pendientes
zero-egress    PASS
demo           20 incidentes · 20 capturas · 13 explicaciones
docker         verificado en macOS y Windows
```

Último commit: ver `git log --oneline -1`. Sin PRs abiertos.

## Lo único que queda, en orden

1. **Grabar el video** — guion completo en `docs/GRABACION.md`, bloque 1 para
   el agente, bloque 2 para la voz.
2. **Hacer el repo público** — el DoD §38 exige que el jurado entre sin
   credenciales:
   ```
   gh repo edit --visibility public --accept-visibility-change-consequences
   ```
3. **Subir la entrega** con el enlace del repo y el video.

## Regla que importa más que ninguna ahora

**No pulir más.** Quedan horas, no días. Si aparece una etiqueta en inglés o
un detalle visual, **anótalo y sigue**. El costo de no tener video es
infinitamente mayor que el de una imperfección.

Solo detenerse si el producto no muestra lo que debe: sin incidentes, sin
capturas, modelos no disponibles, el botón de explicar gris, o el riesgo que
no sube tras la investigación visual.

## Si algo falla durante la grabación

| Síntoma | Causa casi siempre | Arreglo |
|---|---|---|
| Un endpoint "no existe" | Proceso viejo en el puerto sirviendo el build anterior | Matar el 3001 y relanzar la UI |
| Texto sin traducir tras un pull | Lo mismo, o caché del navegador | Ctrl+Shift+R |
| Sin incidentes tras el demo | Kafka no estaba listo | `docker compose ps`, esperar "healthy", repetir |
| Sin capturas 📷 | Faltan las pesas de VisionPsy | Revisar `QVAC_VISION_MODELS_DIR` en `.env` |
| Explicaciones en inglés | Datos viejos en ClickHouse | TRUNCATE `dns_incidents` y repetir el demo |

## Contexto completo

`AGENTS.md` tiene la arquitectura, los contratos congelados y el registro de
qué hizo cada agente. Cualquier IA que retome esto debe leerlo primero.

## Dos cosas que declaramos y conviene no contradecir

- **El modelo analista es MedPsy, afinado para uso clínico.** Es el único
  modelo instruct de texto usable de los 25 de QVAC. Está en el README §6.
- **VisionPsy acierta 0.75 en formularios de credenciales y 0.50 en
  suplantación de marca.** Reportamos su respuesta textual en vez de
  corregirla. Está en el README §18 y en el benchmark.

Si el jurado pregunta, esas son las respuestas. Están publicadas a propósito.
