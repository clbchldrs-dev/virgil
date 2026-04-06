# OpenClaw SSH Tunnel Hardening (Mac → LAN Ubuntu host)

Use this profile when OpenClaw runs on a **LAN Linux host** (Ubuntu box, NUC, older PC, etc.) and Virgil runs on your **Mac**. The goal is to keep OpenClaw bound to loopback on that host and reach it only through an SSH local port forward from the Mac.

## Owner reference topology (caleb-virgil1)

Concrete values for this deployment (adjust if your network changes):

| Role | Value |
|------|--------|
| OpenClaw / SSH host | Ubuntu 24.04, hostname `caleb-virgil1`, LAN IP **`192.168.1.81`** |
| SSH login | `ssh caleb@192.168.1.81` (interactive shell for ops) |
| Mac (Virgil dev) | e.g. **Calebs-Air**; client IP on the LAN may appear in the server motd as `Last login: … from 192.168.1.148` |
| Tunnel target on server | OpenClaw on **`127.0.0.1:3100`** (not exposed on the LAN) |
| Tunnel on Mac | **`127.0.0.1:13100`** → forwarded to server `127.0.0.1:3100` |

From the repo on the Mac, after OpenClaw is listening on the server:

```bash
OPENCLAW_SSH_HOST=caleb@192.168.1.81 pnpm openclaw:tunnel
# or: OPENCLAW_SSH_HOST=caleb@192.168.1.81 ./scripts/openclaw-tunnel.sh
```

Optional `~/.ssh/config` fragment (same thing, shorter alias):

```sshconfig
Host caleb-virgil1
  HostName 192.168.1.81
  User caleb
```

Then `OPENCLAW_SSH_HOST=caleb-virgil1 pnpm openclaw:tunnel`.

**Checking the server:** with a normal SSH session (`ssh caleb@192.168.1.81`), run `curl -fsS http://127.0.0.1:3100/health` to confirm OpenClaw locally. The tunnel session itself uses `ssh -N` and will sit idle with no prompt—that is expected.

## Topology (generic)

- **OpenClaw host** (remote):
  - SSH server listening on `22`
  - OpenClaw listening on `127.0.0.1:3100` only
- **Mac** (Virgil host):
  - Local tunnel on `127.0.0.1:13100` forwarding to remote `127.0.0.1:3100`
  - Virgil env points `OPENCLAW_HTTP_URL` at `http://127.0.0.1:13100`

## 1) Harden the OpenClaw host first

### 1.1 Keep OpenClaw private on the remote host

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

Copy public key to the OpenClaw host:

```bash
ssh-copy-id -i ~/.ssh/id_ed25519.pub caleb@192.168.1.81
# generic: ssh-copy-id -i ~/.ssh/id_ed25519.pub <user>@<host-or-ip>
```

Pin host key (recommended):

```bash
ssh-keyscan -H 192.168.1.81 >> ~/.ssh/known_hosts
# generic: ssh-keyscan -H <host-or-ip> >> ~/.ssh/known_hosts
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
  caleb@192.168.1.81
# generic: … -L 127.0.0.1:13100:127.0.0.1:3100 <user>@<host-or-ip>
```

Project helper script:

```bash
OPENCLAW_SSH_HOST=caleb@192.168.1.81 ./scripts/openclaw-tunnel.sh
# generic: OPENCLAW_SSH_HOST=<user>@<host-or-ip> ./scripts/openclaw-tunnel.sh
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
OPENCLAW_SSH_HOST=caleb@192.168.1.81 /path/to/virgil/scripts/openclaw-tunnel.sh
```

Use `KeepAlive` and direct logs to `~/Library/Logs/`.

## Quick security checklist

- [ ] OpenClaw binds `127.0.0.1:3100` on the remote host
- [ ] SSH password auth disabled on the remote host
- [ ] Root login disabled on the remote host
- [ ] `AllowTcpForwarding local` and `PermitOpen 127.0.0.1:3100` set
- [ ] Firewall limits `22/tcp` to Mac LAN IP
- [ ] Virgil uses `OPENCLAW_HTTP_URL=http://127.0.0.1:13100`
- [ ] Tunnel health and skills endpoints return successfully
