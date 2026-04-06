# OpenClaw SSH Tunnel Hardening (Mac -> old PC)

Use this profile when OpenClaw runs on an older LAN PC and Virgil runs on this Mac. The goal is to keep OpenClaw private on the old PC and reach it only through an SSH local port forward.

## Topology

- Old PC:
  - SSH server listening on `22`
  - OpenClaw listening on `127.0.0.1:3100` only
- Mac (Virgil host):
  - Local tunnel on `127.0.0.1:13100` forwarding to old PC `127.0.0.1:3100`
  - Virgil env points `OPENCLAW_HTTP_URL` at `http://127.0.0.1:13100`

## 1) Harden the old PC first

### 1.1 Keep OpenClaw private on old PC

Configure OpenClaw to bind loopback only:

```bash
127.0.0.1:3100
```

Do not bind `0.0.0.0` unless you explicitly need LAN-wide exposure.

### 1.2 SSH daemon hardening (`/etc/ssh/sshd_config`)

Use these baseline settings (adapt user names as needed):

```conf
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AllowUsers caleb
X11Forwarding no
AllowAgentForwarding no
AllowTcpForwarding local
GatewayPorts no
PermitOpen 127.0.0.1:3100
ClientAliveInterval 60
ClientAliveCountMax 2
```

Then validate and reload:

```bash
sudo sshd -t
sudo systemctl reload ssh
```

### 1.3 Firewall hardening

Allow SSH only from your Mac LAN IP when possible.

For UFW:

```bash
sudo ufw allow from <MAC_LAN_IP> to any port 22 proto tcp
```

## 2) Set up key-based auth from Mac

Create an Ed25519 key if you do not already have one:

```bash
ssh-keygen -t ed25519 -a 64 -f ~/.ssh/id_ed25519
```

Copy public key to old PC:

```bash
ssh-copy-id -i ~/.ssh/id_ed25519.pub <user>@<old-pc-host-or-ip>
```

Pin host key (recommended):

```bash
ssh-keyscan -H <old-pc-host-or-ip> >> ~/.ssh/known_hosts
```

## 3) Start the tunnel from Mac

One-off tunnel command:

```bash
ssh -N -T \
  -o ExitOnForwardFailure=yes \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  -o StrictHostKeyChecking=yes \
  -L 127.0.0.1:13100:127.0.0.1:3100 \
  <user>@<old-pc-host-or-ip>
```

Project helper script:

```bash
OPENCLAW_SSH_HOST=<user>@<old-pc-host-or-ip> ./scripts/openclaw-tunnel.sh
```

The helper script now rejects non-loopback `OPENCLAW_REMOTE_HOST` by default. If you intentionally need a non-loopback remote target, set `OPENCLAW_ALLOW_NON_LOOPBACK_REMOTE=1` (unsafe override).

## 4) Point Virgil to the tunneled endpoint

In `.env.local` (or `.env.docker` on the host running Virgil):

```bash
OPENCLAW_HTTP_URL=http://127.0.0.1:13100
OPENCLAW_URL=ws://127.0.0.1:13100
```

`OPENCLAW_URL` is optional when `OPENCLAW_HTTP_URL` is set, but keeping both aligned reduces confusion.

## 5) Verify end-to-end

From Mac:

```bash
curl -fsS http://127.0.0.1:13100/health
curl -fsS http://127.0.0.1:13100/api/skills
```

Then in Virgil chat, ask for a delegation that uses `delegateTask`. If OpenClaw is unreachable, the app should fail safely without exposing credentials.

## 6) Optional persistence (Mac launchd)

If you want the tunnel kept alive after reboot/login, create a `LaunchAgent` that runs:

```bash
OPENCLAW_SSH_HOST=<user>@<old-pc-host-or-ip> /path/to/virgil/scripts/openclaw-tunnel.sh
```

Use `KeepAlive` and direct logs to `~/Library/Logs/`.

## Quick security checklist

- [ ] OpenClaw binds `127.0.0.1:3100` on old PC
- [ ] SSH password auth disabled on old PC
- [ ] Root login disabled on old PC
- [ ] `AllowTcpForwarding local` and `PermitOpen 127.0.0.1:3100` set
- [ ] Firewall limits `22/tcp` to Mac LAN IP
- [ ] Virgil uses `OPENCLAW_HTTP_URL=http://127.0.0.1:13100`
- [ ] Tunnel health and skills endpoints return successfully
