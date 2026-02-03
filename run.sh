#!/bin/bash
set -e

# Logging
echo "=== Dust.zip Startup Script ==="
echo "Date: $(date)"
echo "Python: $(python --version)"
echo "Working directory: $(pwd)"
echo "Files: $(ls -la)"
echo "Environment variables:"
env | grep -E '^(PORT|RAILWAY|PYTHON)' | sort || echo 'No railway/env vars found'
echo "PORT=${PORT:-8080}"
echo "============================="

# Start gunicorn with fallback for PORT
exec gunicorn \
  --bind 0.0.0.0:${PORT:-8080} \
  --timeout 120 \
  --workers 2 \
  --threads 4 \
  --log-level info \
  --access-logfile - \
  --error-logfile - \
  app:app
