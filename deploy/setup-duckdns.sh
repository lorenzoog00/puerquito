#!/usr/bin/env bash
# Puerquito — one-shot VPS setup with a free DuckDNS subdomain.
# Run this ON THE SERVER (root@5.78.198.194) from inside the cloned repo:
#   cd /root/apps/puerquito/Puerquito && bash deploy/setup-duckdns.sh
#
# EDIT THESE 4 VALUES FIRST:
SUBDOMAIN="puerquito"                 # -> puerquito.duckdns.org  (must already be created + pointed at this IP on duckdns.org)
LOGIN_EMAIL="you@example.com"         # the email you'll log in with
LOGIN_PASSWORD="change-this-please"   # the password you'll log in with
CERTBOT_EMAIL="you@example.com"       # for Let's Encrypt renewal notices
# ---------------------------------------------------------------------------
set -euo pipefail
DOMAIN="${SUBDOMAIN}.duckdns.org"
APP_DIR="/root/apps/puerquito/Puerquito"
DB_PASS="$(openssl rand -hex 16)"
SESSION_SECRET="$(openssl rand -hex 32)"

echo ">> Creating Postgres user + database…"
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='puerquito'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER puerquito WITH PASSWORD '${DB_PASS}';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='puerquito'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE puerquito OWNER puerquito;"
# Ensure password matches (in case user already existed)
sudo -u postgres psql -c "ALTER USER puerquito WITH PASSWORD '${DB_PASS}';"

echo ">> Installing deps + hashing password…"
cd "${APP_DIR}"
npm ci
PW_HASH="$(node -e "console.log(require('bcryptjs').hashSync(process.argv[1],10))" "${LOGIN_PASSWORD}")"

echo ">> Writing .env…"
cat > "${APP_DIR}/.env" <<ENV
DATABASE_URL=postgres://puerquito:${DB_PASS}@localhost:5432/puerquito
SESSION_SECRET=${SESSION_SECRET}
SEED_EMAIL=${LOGIN_EMAIL}
SEED_PASSWORD_HASH=${PW_HASH}
PORT=5002
NODE_ENV=production
ENV
chmod 600 "${APP_DIR}/.env"

echo ">> Migrating, seeding, building…"
npm run db:push
npm run db:seed
npm run build

echo ">> Installing systemd service…"
cp deploy/puerquito.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now puerquito
systemctl restart puerquito

echo ">> Configuring nginx for ${DOMAIN}…"
sed "s/YOUR_DOMAIN www.YOUR_DOMAIN/${DOMAIN}/; s/YOUR_DOMAIN/${DOMAIN}/g" \
  deploy/nginx-puerquito.conf > /etc/nginx/sites-available/puerquito
ln -sf /etc/nginx/sites-available/puerquito /etc/nginx/sites-enabled/puerquito
nginx -t && systemctl reload nginx

echo ">> Requesting HTTPS certificate…"
certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${CERTBOT_EMAIL}" --redirect

echo ""
echo "✅ Done!  https://${DOMAIN}"
echo "   Login: ${LOGIN_EMAIL} / (the password you set)"
