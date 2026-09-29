# Operations guide

## Local development
- Start the local stack with `docker compose -f docker-compose.local.yml up -d`
- Install dependencies with `npm install`
- Run the app with `npm run dev`

## Production deployment
- Provision the VPS using `/infra/provision.sh`.
- Configure Cloudflare in front of the origin.
- Deploy through GitHub Actions on main and tag-based production releases.

## Backup and restore
- Backup scripts are located in `/infra/backup.sh` and `/infra/restore.sh`.
- Live backups should be encrypted and rotated to align with the configured retention window.

## Security rotation
- Rotate secrets and encryption keys on a documented schedule.
- Never commit raw environment files, wallet seeds, or real customer data.
