#!/bin/sh
echo "verifying container user has access to potentially mounted volume..."
chown -R nextjs:nodejs /data
chmod -R 770 /data
exec "$@"