# EC2 Deployment (Docker Compose + Caddy HTTPS)

## Target setup

- Frontend domain: `res-iuh.duckdns.org`
- API: `https://res-iuh.duckdns.org/api`
- EC2 public IP: `3.104.224.104`
- SSL provider: Let's Encrypt via Caddy

## 1) One-time server setup (Ubuntu)

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git curl
sudo usermod -aG docker $USER
# logout/login again
```

## 2) DNS and Security Group

1. Point DuckDNS record `res-iuh.duckdns.org` to `3.104.224.104`.
2. In AWS Security Group, open inbound:
- `80/tcp` from `0.0.0.0/0`
- `443/tcp` from `0.0.0.0/0`
- `22/tcp` only for your admin IP

## 3) Clone and configure

```bash
git clone <YOUR_REPO_URL> thidua
cd thidua
cp .env.prod.example .env.prod
nano .env.prod
```

Update at least:

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `MAIL_PASS`

## 4) Deploy

```bash
bash deploy/scripts/deploy.sh
```

## 5) Verify

```bash
docker compose --env-file .env.prod ps
curl -I https://res-iuh.duckdns.org
curl -I https://res-iuh.duckdns.org/health
```

## 6) Update after new push

```bash
cd thidua
git pull
bash deploy/scripts/deploy.sh
```

## Notes for t3.small (2GB RAM)

- First run may take longer because ClamAV updates signatures.
- Keep only required containers running on this host.
- If memory pressure appears, add swap (2GB) on Ubuntu.
