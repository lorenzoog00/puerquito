# Puerquito — server setup (one time)

Server: `root@5.78.198.194`. App port: **5002**. Server dir: `/root/apps/puerquito/Puerquito`.

## 1. DNS
Point your new domain's **A record** → `5.78.198.194` (and a `www` A record too).
looqs.online and all existing apps are unaffected — nginx routes by domain name.

## 2. Postgres
```bash
sudo -u postgres psql -c "CREATE USER puerquito WITH PASSWORD 'STRONGPASS';"
sudo -u postgres psql -c "CREATE DATABASE puerquito OWNER puerquito;"
```

## 3. Deploy key + clone
```bash
mkdir -p /root/apps/puerquito && cd /root/apps/puerquito
git clone git@github.com:USER/Puerquito.git Puerquito && cd Puerquito
npm ci
```

## 4. .env  (create manually — never committed)
Generate the password hash first:
```bash
node -e "console.log(require('bcryptjs').hashSync('YOUR_LOGIN_PASSWORD',10))"
```
Then write `/root/apps/puerquito/Puerquito/.env`:
```
DATABASE_URL=postgres://puerquito:STRONGPASS@localhost:5432/puerquito
SESSION_SECRET=<run: openssl rand -hex 32>
SEED_EMAIL=you@example.com
SEED_PASSWORD_HASH=<hash from above>
PORT=5002
NODE_ENV=production
```

## 5. Migrate, seed, build
```bash
npm run db:push
npm run db:seed
npm run build
```

## 6. systemd
```bash
cp deploy/puerquito.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now puerquito
systemctl status puerquito
```

## 7. nginx + SSL
```bash
cp deploy/nginx-puerquito.conf /etc/nginx/sites-available/puerquito
sed -i "s/YOUR_DOMAIN/yourdomain.com/g" /etc/nginx/sites-available/puerquito
ln -s /etc/nginx/sites-available/puerquito /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

## 8. GitHub Secrets (repo → Settings → Secrets → Actions)
- `SSH_HOST` = `5.78.198.194`
- `SSH_USER` = `root`
- `SSH_PRIVATE_KEY` = the deploy private key

After this, every push to `main` auto-deploys: pull → npm ci → db:push → build → restart.

## Notes
- Tests run on PGlite (in-process Postgres) — CI needs no database service.
- Production uses real Postgres via `DATABASE_URL`.
- First login uses `SEED_EMAIL` + the password whose hash is in `SEED_PASSWORD_HASH`.
