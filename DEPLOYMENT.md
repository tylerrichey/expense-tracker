# Deployment Setup Guide

This guide explains how to set up automated deployment using GitHub Actions.

## 🔧 Prerequisites

1. **Linux server** with Docker and Docker Compose installed
2. **SSH access** to your server
3. **Git repository** cloned on your server

## 🔑 GitHub Secrets Setup

Go to your GitHub repository → Settings → Secrets and variables → Actions, then add these repository secrets:

### Required Secrets

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `DEPLOY_HOST` | Your server's IP address or domain | `203.0.113.1` or `myserver.com` |
| `DEPLOY_USER` | SSH username for your server | `ubuntu` or `root` |
| `DEPLOY_SSH_KEY` | Private SSH key for authentication | Contents of your `~/.ssh/id_rsa` |
| `DEPLOY_PATH` | Full path to your project on server | `/home/ubuntu/expense-tracker` |

### Optional Secrets

| Secret Name | Description | Default |
|-------------|-------------|---------|
| `DEPLOY_PORT` | SSH port if not standard | `22` |

## 🔐 SSH Key Setup

### 1. Generate SSH Key (if you don't have one)

On your local machine:
```bash
ssh-keygen -t rsa -b 4096 -C "github-deploy"
# Save as ~/.ssh/github_deploy (don't use your main key)
```

### 2. Add Public Key to Server

Copy the public key to your server:
```bash
ssh-copy-id -i ~/.ssh/github_deploy.pub user@yourserver.com
```

Or manually add it:
```bash
# On your server
echo "your-public-key-content" >> ~/.ssh/authorized_keys
```

### 3. Add Private Key to GitHub

Copy the **private key** content and add it as `DEPLOY_SSH_KEY` secret:
```bash
cat ~/.ssh/github_deploy
```

## 🏗️ Server Setup

### 1. Clone Repository

```bash
# On your server
cd /home/ubuntu  # or your preferred location
git clone https://github.com/yourusername/expense-tracker.git
cd expense-tracker
```

### 2. Set Up Environment

```bash
# Copy environment file
cp .env.example .env
# Edit with your production values
nano .env
```

### 3. Initial Docker Setup

```bash
# Build and start containers
docker compose up -d --build

# Verify it's working
docker compose ps
curl http://localhost:3000  # Test the application
```

### 4. Set Up Reverse Proxy (Optional but recommended)

If using nginx or another reverse proxy:
```nginx
# /etc/nginx/sites-available/expense-tracker
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 🚀 Deployment Process

Once configured, deployment happens automatically:

1. **Push to main branch** → Triggers GitHub Action
2. **Tests run** → Must pass to continue
3. **Build verification** → Ensures code compiles
4. **SSH deployment** → Updates server automatically
5. **Health check** → Verifies deployment success

### Manual Deployment

You can also trigger deployment manually:
1. Go to GitHub → Actions tab
2. Select "Deploy to Production" workflow
3. Click "Run workflow" → Run workflow

## 🔍 Monitoring Deployment

### View Logs
```bash
# On your server
docker compose logs -f

# View specific service logs
docker compose logs app
docker compose logs -f --tail=100 app
```

### Check Status
```bash
# Check running containers
docker compose ps

# Check system resources
docker stats

# Check application health
curl http://localhost:3000/api/expenses  # Should require auth but return 401
```

## 🐛 Troubleshooting

### Common Issues

1. **SSH Connection Failed**
   - Verify server IP and SSH credentials
   - Check if SSH key has proper permissions (600)
   - Test SSH connection manually: `ssh -i ~/.ssh/github_deploy user@server`

2. **Docker Build Failed**
   - Check server has enough disk space: `df -h`
   - Verify Docker is running: `systemctl status docker`
   - Clean up old images: `docker system prune -a`

3. **Application Won't Start**
   - Check environment variables in `.env`
   - Verify database permissions
   - Check port conflicts: `netstat -tulpn | grep :3000`

4. **Tests Failing**
   - Run tests locally: `npm test`
   - Check Node.js version compatibility
   - Verify all dependencies are installed

### Rollback Procedure

If deployment fails:
```bash
# On your server
cd /path/to/expense-tracker

# Rollback to previous commit
git log --oneline  # Find previous working commit
git reset --hard <previous-commit-hash>

# Restart containers
docker compose down
docker compose up -d --build
```

## 📧 Notifications (Optional)

To get notified about deployments, you can add webhooks to the workflow:

### Slack Notification
Add these secrets and modify the workflow:
- `SLACK_WEBHOOK_URL`

### Discord Notification
Add these secrets:
- `DISCORD_WEBHOOK_URL`

### Email Notification
Use services like SendGrid or AWS SES

## 🔒 Security Best Practices

1. **Use dedicated SSH key** for deployment (not your personal key)
2. **Limit SSH key permissions** to only necessary commands
3. **Keep secrets secure** - never commit them to code
4. **Use non-root user** for deployment when possible
5. **Enable firewall** and only open necessary ports
6. **Regular security updates** on your server

## 🎯 Next Steps

- Set up SSL/TLS with Let's Encrypt
- Configure monitoring and alerting
- Set up automated backups
- Consider using Docker secrets for sensitive data
- Implement blue-green deployments for zero-downtime