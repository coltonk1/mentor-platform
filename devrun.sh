#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
WEB_DIR="$ROOT_DIR/web"

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

echo "Checking dependencies..."

if ! command_exists java; then
  echo "Java is not installed. Install Java 21/25 first."
  exit 1
fi

if ! command_exists mvn; then
  echo "Maven is not installed. Install Maven first."
  exit 1
fi

if ! command_exists npm; then
  echo "npm is not installed. Install Node.js/npm first."
  exit 1
fi

echo "Installing frontend dependencies if needed..."

cd "$WEB_DIR"

if [ ! -d "node_modules" ]; then
  npm install
fi

echo "Starting backend..."

cd "$BACKEND_DIR"
mvn spring-boot:run &
BACKEND_PID=$!

echo "Starting Next.js..."

cd "$WEB_DIR"
npm run dev &
WEB_PID=$!

cleanup() {
  echo "Stopping servers..."
  kill "$BACKEND_PID" "$WEB_PID" 2>/dev/null || true
}

trap cleanup EXIT

wait