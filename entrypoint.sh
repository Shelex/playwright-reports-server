#!/bin/sh
echo "verifying container user has access to potentially mounted volume..."
chown -R nextjs:nodejs /app/data
chmod -R 770 /app/data
exec "$@"