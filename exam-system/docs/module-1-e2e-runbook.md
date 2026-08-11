# Module 1 Runbook — E2E Networks VM + DBaaS + Email Setup

Follow this top to bottom. Every command is explained. Things **you type** are in code blocks; anything in `CAPITALS_LIKE_THIS` is a placeholder you replace with your real value.

**What you're building in this module:**

```
Your office browser
        │  https://exams.morepenpdr.com
        ▼
┌─────────────────────────── E2E Networks (Delhi/Mumbai region) ──┐
│  Virtual Compute Node (Ubuntu VM)                               │
│   ├─ Nginx        — front door: serves the React app,           │
│   │                 forwards /api/... to Node                   │
│   └─ Node.js API  — the exam server (port 4000, IST timezone)   │
│                                                                 │
│  E2E DBaaS PostgreSQL  — managed database (separate service)    │
└─────────────────────────────────────────────────────────────────┘
        │ SMTP (port 587)
        ▼
SendGrid (or Amazon SES) → sends as info@morepenpdr.com
```

This is a brand-new, standalone project. It does not touch the existing DigitalOcean ELN system in any way — different provider, different servers, different database, different DNS records.

---

## Step 0 — One-time prep on your own computer

You need an SSH key — it's how you'll log in to the VM securely (instead of a password).

Open a terminal (Windows: PowerShell; Mac: Terminal) and run:

```
ssh-keygen -t ed25519 -C "sop-exam-admin"
```

- `ssh-keygen` creates a key pair: a **private key** (stays on your computer, never share it) and a **public key** (you give this to servers).
- `-t ed25519` picks a modern, secure key type.
- Press Enter to accept the default file location; set a passphrase if you want extra safety.

Show the public key so you can copy it:

```
cat ~/.ssh/id_ed25519.pub
```

- `cat` just prints a file's contents. Copy the whole line starting with `ssh-ed25519` — you'll paste it into the E2E console next.

## Step 1 — Create the VM in the E2E console

In **MyAccount** (myaccount.e2enetworks.com):

1. **Compute → Nodes → Create Node** (their "Virtual Compute Node").
2. Image: **Ubuntu 22.04 LTS** (or 24.04 if 22.04 isn't offered).
3. Size: a 2 vCPU / 4 GB RAM plan is plenty for 200 users. You can resize later.
4. Region: Delhi (NCR) or Mumbai — pick one and remember it; the DBaaS cluster must go in the same region.
5. **SSH key**: paste the public key you copied in Step 0.
6. Create the node and note its **public IP address** (call it `VM_IP` below).

## Step 2 — First login and basic server hardening

From your computer:

```
ssh root@VM_IP
```

- `ssh` opens a secure remote terminal on the VM. `root` is the administrator account E2E gives you. Type `yes` when asked to trust the new host.

Update the operating system:

```
apt update && apt upgrade -y
```

- `apt` is Ubuntu's package manager. `update` refreshes the list of available software; `upgrade -y` installs all pending security updates (`-y` = don't ask for confirmation). `&&` means "run the second command only if the first succeeded."

Create a non-root user to run the app (safer than doing everything as root):

```
adduser examapp
usermod -aG sudo examapp
```

- `adduser examapp` makes a user named `examapp` (pick a password when prompted).
- `usermod -aG sudo examapp` adds it to the `sudo` group, so it can run admin commands by prefixing them with `sudo`.

Turn on the firewall, allowing only SSH and web traffic:

```
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

- `ufw` is Ubuntu's simple firewall. We open port 22 (SSH), 80 (HTTP) and 443 (HTTPS) and block everything else. Answer `y` when it warns about existing connections.

## Step 3 — Install the software the app needs

Still on the VM (as root, or prefix each with `sudo` as examapp):

```
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs git nginx
```

- The first line downloads NodeSource's setup script and runs it — this teaches `apt` where to find **Node.js 22** (Ubuntu's built-in Node is too old).
- The second line installs Node.js, `git` (to download the code), and `nginx` (the web server that sits in front of the app).

Check it worked:

```
node --version
```

- Should print `v22.x.x`.

Install PM2, which keeps the Node server running forever and restarts it if it crashes or the VM reboots:

```
npm install -g pm2
```

- `npm` is Node's package installer; `-g` installs the tool globally so you can run `pm2` from anywhere.

## Step 4 — Create the PostgreSQL database (E2E DBaaS)

Back in the E2E **MyAccount** console:

1. **Database → PostgreSQL → Create Cluster** (their DBaaS product).
2. Version: PostgreSQL 16 (or the newest offered). Same region as the VM.
3. Smallest plan is fine to start.
4. When it's ready, open the cluster page and note: **host**, **port** (usually 5432), **admin user**, **password**.
5. Create a database named `sop_exams` and (if the console allows) a user `examuser` — otherwise the admin user is fine for now.
6. **Trusted sources / allowed IPs**: add the VM's IP (`VM_IP`) so only your app server can reach the database. This is important — do not leave it open to the world.

Your connection string (goes into `.env` in Step 5) is:

```
postgresql://USER:PASSWORD@DBAAS_HOST:5432/sop_exams?sslmode=require
```

- `sslmode=require` forces an encrypted connection — keep it.

## Step 5 — Put the app on the VM and run it

Log in as the app user and download the code:

```
ssh examapp@VM_IP
git clone https://github.com/deepag-del/LMS.git
cd LMS/exam-system/server
```

- `git clone` copies the repository onto the VM; `cd` moves into the server folder. (If the repo is private, GitHub will ask you to authenticate — a fine approach is a "deploy key": run `ssh-keygen` on the VM and add the public key in GitHub → repo → Settings → Deploy keys.)

Install the server's dependencies and create its config file:

```
npm install
cp .env.example .env
nano .env
```

- `npm install` downloads the libraries the server needs (Express, pg, nodemailer…).
- `cp` copies the example config to the real one; `nano` is a simple text editor — fill in `DATABASE_URL` (Step 4) and the SMTP values (Step 7). Save with `Ctrl+O`, Enter, exit with `Ctrl+X`.

Build and start the server under PM2:

```
npm run build
pm2 start dist/index.js --name sop-exam-server
pm2 save
pm2 startup
```

- `npm run build` compiles the TypeScript source into plain JavaScript in `dist/`.
- `pm2 start … --name …` runs it in the background with a memorable name.
- `pm2 save` remembers the process list; `pm2 startup` prints ONE command — copy-paste and run it — that makes PM2 relaunch the app after a reboot.

Verify the API is alive:

```
curl http://localhost:4000/api/health
curl http://localhost:4000/api/health/db
```

- `curl` fetches a URL from the command line. The first should return JSON with `"ok": true` and the IST server time; the second confirms the DBaaS connection ("connected — DB time (IST): …").

Build the frontend and put it where Nginx serves files from:

```
cd ../client
npm install
npm run build
sudo mkdir -p /var/www/sop-exams
sudo cp -r dist/* /var/www/sop-exams/
```

- `npm run build` produces an optimized static site in `dist/`; we copy it to `/var/www/sop-exams`, the folder the Nginx config points at (`mkdir -p` creates it, `cp -r` copies recursively, `sudo` runs as admin).

## Step 6 — Nginx front door + HTTPS

First, in your DNS provider (wherever morepenpdr.com's DNS is managed), add an **A record**: `exams.morepenpdr.com → VM_IP`.

Then on the VM:

```
sudo cp ~/LMS/exam-system/deploy/nginx.conf.example /etc/nginx/sites-available/sop-exams
sudo nano /etc/nginx/sites-available/sop-exams
sudo ln -s /etc/nginx/sites-available/sop-exams /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

- Copy the provided config into Nginx's config folder, open it in nano only to confirm the `server_name` matches your subdomain.
- `ln -s` (symbolic link) is how Nginx enables a site; removing `default` disables the placeholder page.
- `nginx -t` checks the config for typos **before** applying; `systemctl reload nginx` applies it without downtime.

Add free HTTPS via Let's Encrypt:

```
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d exams.morepenpdr.com
```

- Certbot proves to Let's Encrypt that you control the domain, installs a certificate, rewrites the Nginx config for HTTPS, and auto-renews every ~60 days.

Now `https://exams.morepenpdr.com` should show the Module 1 status page.

## Step 7 — Email: send as info@morepenpdr.com

Recommended: **SendGrid** (simpler for a first setup; SES is the drop-in alternative and slightly cheaper at volume — switching later is only an `.env` change).

1. Create a SendGrid account → **Settings → Sender Authentication → Authenticate Your Domain** → enter `morepenpdr.com`.
2. SendGrid shows **3 CNAME records** (these are the DKIM/SPF proof). Add them at your DNS provider exactly as shown, then click **Verify**. This is what stops your mail landing in spam, and it does not affect any existing mail on the domain — the records are additions, not changes.
3. **Settings → API Keys → Create API Key** (Full Access → Mail Send only is enough). Copy the key — it's shown once.
4. On the VM, edit the config: `nano ~/LMS/exam-system/server/.env` — SMTP_HOST is already `smtp.sendgrid.net`, SMTP_USER is literally the word `apikey`, and SMTP_PASS is the key you copied.
5. Restart and test:

```
pm2 restart sop-exam-server
curl http://localhost:4000/api/health/email
curl -X POST http://localhost:4000/api/health/email/test -H "Content-Type: application/json" -d '{"to":"YOUR_ADDRESS@morepenpdr.com"}'
```

- The first curl confirms SMTP login works; the second sends a real test email to you (`-X POST` makes it a POST request, `-d` is the JSON body).

**Swapping the sender later** (LOCKED rule): change the single line `EMAIL_FROM=info@morepenpdr.com` in `.env` to `EMAIL_FROM=compliance@morepenpdr.com`, then `pm2 restart sop-exam-server`. No code changes.

## Step 8 — Module 1 completion checklist

- [ ] VM reachable via `ssh examapp@VM_IP`, firewall on (`sudo ufw status` shows 22/80/443 only)
- [ ] `curl localhost:4000/api/health` → `ok: true`, timezone `Asia/Kolkata`
- [ ] `curl localhost:4000/api/health/db` → connected to E2E DBaaS (and DBaaS trusted-sources list contains only the VM IP)
- [ ] `https://exams.morepenpdr.com` loads the status page with a padlock (valid certificate)
- [ ] Domain authenticated in SendGrid (green ticks on the 3 CNAMEs)
- [ ] Test email received from `info@morepenpdr.com`, not in spam
- [ ] `pm2 status` shows `sop-exam-server` online; reboot the VM once (`sudo reboot`) and confirm it comes back by itself

When every box is ticked, Module 1 is done — reply in the session and we start **Module 2: data foundation** (employee Excel import, departments, holiday calendar, new-hire sync).
