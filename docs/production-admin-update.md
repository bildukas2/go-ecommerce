# Admin-triggered updates

Dashboard "Check for updates" + "Update now" requires:

1. Migration applied:

```bash
cd /var/www/volm_krikstynoms
./go-ecommerce-migrate up
```

2. Update script exists and is executable:

```bash
chmod +x /var/www/volm_krikstynoms/deploy/update-prod.sh
```

3. API service user can restart services:

- If `volm-api` runs as `root`, no extra sudoers setup needed.
- If it runs as non-root user, allow passwordless restart for `volm-api` and `volm-web`.

Example sudoers entry:

```text
www-data ALL=(root) NOPASSWD:/usr/bin/systemctl restart volm-api,/usr/bin/systemctl restart volm-web
```

4. Recommended env vars in API service:

```env
PROJECT_ROOT=/var/www/volm_krikstynoms
UPDATE_SCRIPT_PATH=/var/www/volm_krikstynoms/deploy/update-prod.sh
```
