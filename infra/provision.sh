#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

# Hardened base setup for Ubuntu 24.04 LTS.
# Usage: sudo bash infra/provision.sh

if [[ ${EUID} -ne 0 ]]; then
  echo "This script must run as root."
  exit 1
fi

USERNAME="${USERNAME:-appuser}"
SSH_PORT="${SSH_PORT:-22}"

# Required packages
apt-get update
apt-get install -y ca-certificates curl gnupg sudo ufw fail2ban unattended-upgrades git docker.io docker-compose-plugin

# Create regular user
if ! id "$USERNAME" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "$USERNAME"
  usermod -aG sudo "$USERNAME"
  mkdir -p "/home/$USERNAME/.ssh"
fi

# SSH hardening: no root password login, key-only auth recommended.
sshd_config="/etc/ssh/sshd_config.d/99-hardening.conf"
cat > "$sshd_config" <<EOF
Port $SSH_PORT
Protocol 2
LoginGraceTime 30
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
ChallengeResponseAuthentication no
UsePAM yes
X11Forwarding no
AllowTcpForwarding no
PermitTunnel no
TCPKeepAlive yes
ClientAliveInterval 300
ClientAliveCountMax 2
EOF
chmod 644 "$sshd_config"
service ssh reload

# UFW allow only Cloudflare-like ingress. This should be refined for the deployed environment.
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# fail2ban
cat > /etc/fail2ban/jail.local <<'EOF'
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 5
bantime = 3600
EOF
systemctl enable fail2ban
systemctl restart fail2ban

# unattended upgrades
cat > /etc/apt/apt.conf.d/50unattended-upgrades <<'EOF'
Unattended-Upgrade::Allowed-Origins {
  "${distro_id}:${distro_codename}-security";
};
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
EOF

systemctl enable unattended-upgrades
systemctl restart unattended-upgrades

# Docker permission for app user
usermod -aG docker "$USERNAME"

cat <<EOF
Setup complete. Review and harden Cloudflare ingress, BTCPay ports, and SSH keys before go-live.
EOF
