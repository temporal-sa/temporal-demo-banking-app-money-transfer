#!/bin/bash
set -e

# Banking Transfer Demo — Launcher
# Usage: ./scripts/start.sh [--encrypt] [--cloud-env <path>] [--worker <language>]
#
# Prefers Docker for backend/worker/frontend.
# Falls back to running everything locally if Docker isn't available.
#
# With --cloud-env: worker and backend connect to Temporal Cloud (no local server).
# Without: starts a local Temporal dev server.
#
# Options:
#   --encrypt              Enable AES-GCM payload encryption + codec server
#   --cloud-env <path>     Load Temporal Cloud connection settings from env file
#   --worker <language>    python (default), go, typescript, java, dotnet, ruby, php, rust

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MISSING=()
ENCRYPT=""
CLOUD_ENV=""
WORKER="python"

# -- Parse flags --
while [[ $# -gt 0 ]]; do
  case "$1" in
    --encrypt) ENCRYPT=1; shift ;;
    --cloud-env)
      CLOUD_ENV="$2"
      if [ -z "$CLOUD_ENV" ] || [ ! -f "$CLOUD_ENV" ]; then
        echo "Error: --cloud-env requires a path to an existing env file"
        exit 1
      fi
      shift 2
      ;;
    --worker) WORKER="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# -- Worker command by language (without Docker only) --
case "$WORKER" in
  python)     WORKER_CMD="uv run --package banking-demo-workflows worker" ;;
  go)         WORKER_CMD="cd workflows/go && go run ." ;;
  typescript) WORKER_CMD="cd workflows/typescript && npm install --silent && npm run build && node lib/worker.js" ;;
  java)       WORKER_CMD="cd workflows/java && gradle run --quiet --console=plain" ;;
  dotnet)     WORKER_CMD="cd workflows/dotnet && dotnet run -c Release" ;;
  ruby)       WORKER_CMD="cd workflows/ruby && bundle install --quiet && bundle exec ruby worker.rb" ;;
  php)        WORKER_CMD="cd workflows/php && composer install --quiet && rr serve -c .rr.yaml" ;;
  rust)       WORKER_CMD="cd workflows/rust && cargo run --release" ;;
  *)
    echo "Unknown worker: $WORKER (supported: python, go, typescript, java, dotnet, ruby, php, rust)"
    exit 1
    ;;
esac

# -- Check prerequisites --
if [ -z "$CLOUD_ENV" ]; then
  command -v temporal >/dev/null 2>&1 || MISSING+=("temporal CLI  — brew install temporal")
fi

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  MODE="docker"
else
  command -v uv >/dev/null 2>&1 || MISSING+=("uv           — https://docs.astral.sh/uv/")
  command -v npm >/dev/null 2>&1 || MISSING+=("node/npm     — https://nodejs.org/")
  MODE="local"
fi

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "Missing required tools:"
  echo ""
  for m in "${MISSING[@]}"; do
    echo "  x $m"
  done
  echo ""
  echo "Install the above and try again."
  exit 1
fi

# -- Load cloud env if specified --
CLOUD_VARS=""
if [ -n "$CLOUD_ENV" ]; then
  # Source the env file to get variables, filtering comments and blanks
  set -a
  source "$CLOUD_ENV"
  set +a
  # Build env string for passing to subprocesses
  CLOUD_VARS="$(grep -v '^#' "$CLOUD_ENV" | grep -v '^$' | grep '=' | xargs)"
fi

cd "$ROOT_DIR"
PIDS=()

cleanup() {
  echo ""
  echo "Shutting down..."
  if [ "$MODE" = "docker" ]; then
    docker compose --profile "*" down --remove-orphans 2>/dev/null || true
  fi
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null
  echo "Done."
  exit 0
}
trap cleanup SIGINT SIGTERM

echo "======================================"
echo "  Banking Transfer Demo Launcher"
if [ -n "$CLOUD_ENV" ]; then
  echo "  (Temporal Cloud: $TEMPORAL_NAMESPACE)"
fi
if [ "$ENCRYPT" = "1" ]; then
  echo "  (encryption enabled)"
fi
echo "======================================"
echo ""

# -- Clean up stale containers --
if [ "$MODE" = "docker" ]; then
  docker compose --profile "*" down --remove-orphans 2>/dev/null || true
fi

# -- Start Temporal dev server (only when NOT using Cloud) --
if [ -z "$CLOUD_ENV" ]; then
  echo "Starting Temporal dev server..."
  temporal server start-dev --log-level warn --db-filename "/tmp/banking-demo-temporal-$$.db" &
  PIDS+=($!)

  echo "Waiting for Temporal..."
  for i in $(seq 1 15); do
    if temporal operator namespace describe default >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  # Register search attribute for Advanced Visibility scenario
  echo "Registering search attributes..."
  temporal operator search-attribute create --name Step --type Keyword 2>/dev/null || true
else
  echo "Connecting to Temporal Cloud at $TEMPORAL_ADDRESS..."
fi

# -- Build the banner --
build_banner() {
  echo ""
  echo "======================================"
  echo "  Banking Transfer Demo is running!"
  echo ""
  echo "  Worker:     $WORKER"
  echo "  App:        http://localhost:5173"
  echo "  API:        http://localhost:8000"
  if [ -n "$CLOUD_ENV" ]; then
    echo "  Temporal:   $TEMPORAL_ADDRESS"
    echo "  Namespace:  $TEMPORAL_NAMESPACE"
  else
    echo "  Temporal:   http://localhost:8233"
  fi
  if [ "$ENCRYPT" = "1" ]; then
    echo ""
    echo "  Encryption: ON (AES-GCM)"
    echo "  Codec:      http://localhost:8081"
    echo "              (set as codec endpoint in Temporal UI)"
  fi
  echo ""
  echo "  Ctrl+C to stop $1"
  echo "======================================"
}

# =============================================
if [ "$MODE" = "docker" ]; then
# =============================================

  DOCKER_PROFILES="--profile $WORKER"
  if [ "$ENCRYPT" = "1" ]; then
    DOCKER_PROFILES="$DOCKER_PROFILES --profile encrypt"
  fi

  echo "Starting Docker containers..."
  BANKING_ENCRYPT="${ENCRYPT}" docker compose $DOCKER_PROFILES up --build -d

  build_banner "everything"

  while true; do sleep 1; done

# =============================================
else
# =============================================

  echo "Installing dependencies..."
  uv sync --all-packages --quiet 2>/dev/null || uv sync --all-packages
  (cd frontend && npm install --silent 2>/dev/null) || (cd frontend && npm install)

  echo "Starting backend..."
  uv run --package banking-demo-backend server &
  PIDS+=($!)

  echo "Waiting for backend..."
  for i in $(seq 1 15); do
    if curl -s http://localhost:8000/api/health >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  echo "Starting worker ($WORKER)..."
  BANKING_ENCRYPT="${ENCRYPT}" BANKING_BACKEND_URL=http://localhost:8000 bash -c "$WORKER_CMD" &
  PIDS+=($!)

  if [ "$ENCRYPT" = "1" ]; then
    echo "Starting codec server on :8081..."
    uv run python -m banking_workflows.codec_server &
    PIDS+=($!)
  fi

  echo "Starting frontend..."
  (cd "$ROOT_DIR/frontend" && npm run dev -- --open) &
  PIDS+=($!)

  build_banner "all services"

  wait
fi
