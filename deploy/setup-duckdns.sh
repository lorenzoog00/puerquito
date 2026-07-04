#!/usr/bin/env bash
# Puerquito - one-shot VPS setup with a free DuckDNS subdomain.
# Run ON THE SERVER from inside the cloned repo. Pass your values as env vars:
#
#   SUBDOMAIN=puerquito \
#   LOGIN_EMAIL='you@mail.com' \
#   LOGIN_PASSWORD='your-password' \
#   CERTBOT_EMAIL='you@mail.com' \
#   bash deploy/setup-duckdns.sh
#
set -euo pipefail

SUBDOMAIN="${SUBDOMAIN:-puerquito}"
LOGIN_EMAIL="${LOGIN_EMAIL:?Falta LOGIN_EMAIL (tu correo de login)}"
LOGIN_PASSWORD="${LOGIN_PASSWORD:?Falta LOGIN_PASSWORD (tu contrasena)}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-$LOGIN_EMAIL}"

DOMAIN="${SUBDOMAIN}.duckdns.org"
APP_DIR="/root/apps/puerquito/Puerquito"
DB_PASS="$(openssl rand -hex 16)"
SESSION_SECRET="$(openssl rand -hex 32)"

echo ">> Postgres user + database"
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='puerquito'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER puerquito WITH PASSWORD '${DB_PASS}';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='puerquito'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE puerquito OWNER puerquito;"
sudo -u postgres psql -c "ALTER USER puerquito WITH PASSWORD '${DB_PASS}';"

echo ">> Install deps + hash password"
cd "${APP_DIR}"
npm ci
PW_HASH=$(node -e 'console.log(require("bcryptjs").hashSync(process.argv[1],10))' "$LOGIN_PASSWORD")

echo ">> Write .env"
cat > "${APP_DIR}/.env" <<ENV
DATABASE_URL=postgres://puerquito:${DB_PASS}@localhost:5432/puerquito
SESSION_SECRET=${SESSION_SECRET}
SEED_EMAIL=${LOGIN_EMAIL}
SEED_PASSWORD_HASH=${PW_HASH}
PORT=5003
NODE_ENV=production
ENV
chmod 600 "${APP_DIR}/.env"

echo ">> Migrate, seed, build"
npm run db:push
npm run db:seed
npm run build

echo ">> systemd service"
cp deploy/puerquito.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now puerquito
systemctl restart puerquito

echo ">> nginx for ${DOMAIN}"
sed "s/YOUR_DOMAIN www.YOUR_DOMAIN/${DOMAIN}/; s/YOUR_DOMAIN/${DOMAIN}/g" \
  deploy/nginx-puerquito.conf > /etc/nginx/sites-available/puerquito
ln -sf /etc/nginx/sites-available/puerquito /etc/nginx/sites-enabled/puerquito
nginx -t && systemctl reload nginx

echo ">> HTTPS certificate"
certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${CERTBOT_EMAIL}" --redirect

echo ""
echo "Done -> https://${DOMAIN}"
echo "Login: ${LOGIN_EMAIL}"
