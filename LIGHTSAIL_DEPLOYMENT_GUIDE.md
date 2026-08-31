# 🚀 Complete AWS Lightsail Deployment Guide (A to Z)
### 360 Virtual Tour Studio & CRM Application

This comprehensive guide covers the step-by-step process of deploying the **360 Virtual Tour Studio & CRM** application on a fresh **AWS Lightsail Ubuntu Linux** instance.

---

## 📋 Table of Contents
1. [Step 1: Create & Configure AWS Lightsail Instance](#step-1-create--configure-aws-lightsail-instance)
2. [Step 2: Server Preparation & 2GB Swap Memory](#step-2-server-preparation--2gb-swap-memory)
3. [Step 3: Install Node.js 20 LTS, Build Tools & PM2](#step-3-install-nodejs-20-lts-build-tools--pm2)
4. [Step 4: Install & Configure Nginx Web Server](#step-4-install--configure-nginx-web-server)
5. [Step 5: Clone Codebase & Set Permissions](#step-5-clone-codebase--set-permissions)
6. [Step 6: Configure Environment Variables (.env)](#step-6-configure-environment-variables-env)
7. [Step 7: Install Node Modules & Rebuild SQLite3](#step-7-install-node-modules--rebuild-sqlite3)
8. [Step 8: Start Backend API with PM2](#step-8-start-backend-api-with-pm2)
9. [Step 9: Build Frontend Production Assets](#step-9-build-frontend-production-assets)
10. [Step 10: Future Update & Redeployment Cheat Sheet](#step-10-future-update--redeployment-cheat-sheet)
11. [Troubleshooting & Useful Commands](#troubleshooting--useful-commands)

---

## Step 1: Create & Configure AWS Lightsail Instance

1. **Log in to AWS Console** and navigate to **Amazon Lightsail**.
2. Click **Create instance**:
   - **Location**: Choose your preferred AWS Region (e.g., `ap-south-1` Mumbai).
   - **Platform**: `Linux/Unix`.
   - **Blueprint**: `OS Only` ➔ **`Ubuntu 22.04 LTS`** (or `Ubuntu 24.04 LTS`).
   - **Instance Plan**: $3.50/mo (512MB) or $5.00/mo (1GB) or higher.
   - **Name**: `360-virtual-tour`.
3. Click **Create Instance**.

### Attach Static IP:
1. Go to the **Networking** tab in Lightsail.
2. Click **Create static IP**, attach it to your instance, and note down your Public IP (e.g., `35.154.65.44`).

### Configure Firewall:
1. Click on your instance ➔ **Networking** ➔ **IPv4 Firewall**.
2. Add the following rules:
   - **HTTP** (Port `80`) ➔ Custom / Anywhere (`0.0.0.0/0`)
   - **HTTPS** (Port `443`) ➔ Custom / Anywhere (`0.0.0.0/0`)
   - **SSH** (Port `22`) ➔ Custom / Anywhere (`0.0.0.0/0`)
   - **Custom TCP** (Port `5000`) ➔ *(Optional for direct backend debugging)*

---

## Step 2: Server Preparation & 2GB Swap Memory

> 💡 **Why Swap?** Vite frontend build requires ~1GB RAM during compilation. 2GB swap prevents out-of-memory crashes on 512MB/1GB Lightsail plans.

Open the **Lightsail Browser SSH Terminal** and run:

```bash
# 1. Update system packages
sudo apt update && sudo apt upgrade -y

# 2. Create 2GB swap file
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 3. Make swap permanent across reboots
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 4. Verify swap memory
free -h
```

---

## Step 3: Install Node.js 20 LTS, Build Tools & PM2

```bash
# 1. Install prerequisites & native compilation tools
sudo apt install -y curl git build-essential python3

# 2. Add NodeSource Node.js 20 LTS repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# 3. Install Node.js & npm
sudo apt install -y nodejs

# 4. Verify Node and NPM versions
node -v   # Should show v20.x.x
npm -v    # Should show v10.x.x

# 5. Install PM2 process manager globally
sudo npm install -g pm2
```

---

## Step 4: Install & Configure Nginx Web Server

```bash
# 1. Install Nginx
sudo apt install -y nginx

# 2. Configure Nginx Reverse Proxy & Static Site
sudo nano /etc/nginx/sites-available/default
```

Delete everything inside the file and paste the following configuration:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name _;

    # Increase maximum upload file size to 200MB (for high-res 360 images)
    client_max_body_size 200M;

    # 1. Frontend Static Files (Vite Production Build)
    root /var/www/360-tour-app/dist-renderer;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 2. Backend API Proxy (Forward /api requests to Node.js on port 5000)
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 3. Local Uploads Storage Proxy
    location /uploads/ {
        proxy_pass http://127.0.0.1:5000/uploads/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Save and exit (`Ctrl + O`, `Enter`, `Ctrl + X`).

```bash
# Test Nginx syntax
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

---

## Step 5: Clone Codebase & Set Permissions

```bash
# 1. Create web directory
sudo mkdir -p /var/www/360-tour-app
sudo chown -R ubuntu:ubuntu /var/www/360-tour-app

# 2. Clone the repository into /var/www/360-tour-app
cd /var/www/360-tour-app
git clone https://github.com/yuvrajkushwaha49/360-tour-app.git .
```

---

## Step 6: Configure Environment Variables (.env)

Create and edit the `.env` file in the project root:

```bash
nano /var/www/360-tour-app/.env
```

Paste your AWS S3, CloudFront, and Server credentials:

```env
# Server Port
PORT=5000

# JWT Authentication Secret
JWT_SECRET=crm-360-super-secret-key-12345

# AWS S3 Cloud Storage Credentials
AWS_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET_ACCESS_KEY
AWS_REGION=ap-south-1
AWS_S3_BUCKET_NAME=your-s3-bucket-name

# AWS CloudFront CDN Domain (Optional, but recommended)
AWS_CLOUDFRONT_DOMAIN=d123456abcdef8.cloudfront.net
```

Save and exit (`Ctrl + O`, `Enter`, `Ctrl + X`).

Also ensure `server/.env` exists:
```bash
cp /var/www/360-tour-app/.env /var/www/360-tour-app/server/.env
```

---

## Step 7: Install Node Modules & Rebuild SQLite3 From Source

```bash
cd /var/www/360-tour-app

# Install all npm dependencies
npm install

# Install stable SQLite3 compiled for your exact Ubuntu architecture (prevents GLIBC version mismatch)
rm -rf node_modules/sqlite3
npm install sqlite3@5.1.7 --build-from-source
```

---

## Step 8: Start Backend API with PM2

```bash
cd /var/www/360-tour-app

# Start backend service under PM2
pm2 start server/index.js --name "360-backend"

# Save PM2 process list
pm2 save

# Enable automatic start on server reboot
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

Verify backend status:
```bash
pm2 status
pm2 logs 360-backend --lines 20
```

---

## Step 9: Build Frontend Production Assets

Compile the React + TypeScript frontend into `/dist-renderer`:

```bash
cd /var/www/360-tour-app

# Build with memory allocation
NODE_OPTIONS="--max-old-space-size=1536" npm run build:renderer

# Restart Nginx
sudo systemctl restart nginx
```

---

## ✅ Verification

Open your browser and visit your Lightsail Public IP:
```text
http://YOUR_LIGHTSAIL_STATIC_IP
```

- **Default Admin Account:**
  - **Email:** `admin@360soft.com`
  - **Password:** `admin123`
- **Default Client Account:**
  - **Email:** `yuvraj@gmail.com`
  - **Password:** `client123`

---

## Step 10: Future Update & Redeployment Cheat Sheet

Whenever you make changes on your local PC and push to GitHub, run this single block on Lightsail to deploy updates:

```bash
cd /var/www/360-tour-app
git reset --hard HEAD
git clean -fd
git pull
pm2 restart all
NODE_OPTIONS="--max-old-space-size=1536" npm run build:renderer
sudo systemctl restart nginx
```

---

## 🛠️ Troubleshooting & Useful Commands

| Issue / Action | Command |
| :--- | :--- |
| **Check Backend Logs** | `pm2 logs 360-backend` |
| **Restart Backend Service** | `pm2 restart 360-backend` |
| **Check Nginx Status** | `sudo systemctl status nginx` |
| **Check Nginx Error Log** | `sudo tail -n 50 /var/log/nginx/error.log` |
| **Test Nginx Config** | `sudo nginx -t` |
| **Check Memory & Swap** | `free -h` |
| **Check Disk Space** | `df -h` |
| **Rebuild SQLite3** | `npm install sqlite3 --build-from-source` |
