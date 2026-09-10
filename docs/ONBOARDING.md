# Onboarding — RACS Intelligence

For a new developer joining the project on their own machine, with their own AI agent.

---

## Step 0 — Human, before anything

1. Accept the repo invitation:
   <https://github.com/Silentarcherjr/racs-intelligence/invitations>
2. Make sure you have an AI coding agent installed. If not, pick one:

   ```bash
   npm install -g @anthropic-ai/claude-code   # Claude Code  → command: claude
   npm install -g @openai/codex               # Codex        → command: codex
   npm install -g opencode-ai                 # opencode     → command: opencode
   ```

   (Needs Node.js. If you don't have it either, the prompt below installs it —
   run the agent from any terminal once it exists.)

---

## Step 1 — Paste this to your agent

Fill in the three `<<< >>>` placeholders first.

```text
Prepara mi máquina para trabajar en un proyecto de GitHub. Detecta mi sistema
operativo y usa el gestor de paquetes correcto.

1. Verifica qué tengo instalado y repórtamelo: git, gh, node, docker.

2. Instala solo lo que falte:
   - macOS:   brew install git gh node
   - Windows: winget install --id Git.Git ; winget install --id GitHub.cli ;
              winget install --id OpenJS.NodeJS.LTS
   Docker Desktop lo instalo yo aparte desde docker.com si falta.

3. Configura mi identidad de git:
   git config --global user.name "<<<MI NOMBRE>>>"
   git config --global user.email "<<<MI EMAIL DE GITHUB>>>"

4. DETENTE AQUÍ. Dime que ejecute yo mismo:  gh auth login
   NO intentes ejecutarlo tú: es interactivo, abre el navegador y tu proceso
   se va a quedar colgado.
   Respuestas: GitHub.com → HTTPS → Yes → Login with a web browser.

5. Cuando te confirme que ya autoricé, valida con: gh auth status

6. Clona el repo y entra:
   git clone https://github.com/Silentarcherjr/racs-intelligence.git
   cd racs-intelligence

7. Lee AGENTS.md COMPLETO. Es la fuente de verdad del proyecto: reglas,
   qué carpetas me tocan, estado actual y el log de lo que hicieron los
   otros agentes. Lee también las secciones del spec que te indique.

8. Crea mi rama de trabajo:
   git checkout -b <<<MI RAMA>>>

9. Resúmeme en 5 líneas: qué es el proyecto, cuál es mi lane, qué archivos
   me tocan según AGENTS.md §5, y cuál es mi primera tarea.

NO escribas código todavía. Para en el paso 9 y espera.
```

---

## Branches — one per person, never work on `main`

| Branch | Lane |
|---|---|
| `feature/stream-engine` | Kafka consumer, DNS features, threat detectors |
| `feature/qvac` | QVAC SDK, evidence engine, VisionPsy |
| `feature/qoe` | QoE, ClickHouse, Grafana, Wazuh |
| `feature/ui` | Analyst UI, demo scripts, README |

---

## The two places people get stuck

**`gh auth login` cannot be run by an agent.** It is interactive and opens a browser.
The agent must stop and hand it back to you. In Claude Code you can run it inline by
typing `! gh auth login` in the prompt.

**Cloning fails with "repository not found"** → you have not accepted the invitation
yet, or you authenticated as the wrong GitHub account. Check with `gh auth status`.

---

## Daily rhythm

```bash
git checkout main && git pull      # get everyone's work
git checkout feature/mi-rama
git merge main                     # bring it into your branch
# ... work ...
git push origin feature/mi-rama    # then open a PR
```

Merge to `main` every 2–3 hours. **Never edit `AGENTS.md` inside a feature branch** —
your summary goes in the PR description; `AGENTS.md` is updated on `main` after merge.
