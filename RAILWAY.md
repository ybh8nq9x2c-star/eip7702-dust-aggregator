# Railway Deployment Guide

## Prerequisites
- Railway account
- GitHub account
- Railway CLI (optional)

## Deployment Steps

### 1. Push to GitHub

```bash
cd /root/eip7702-dust-aggregator
git init
git add .
git commit -m "Initial commit - EIP-7702 Dust Aggregator"
```

Then create a new repository on GitHub and push:

```bash
git remote add origin https://github.com/YOUR_USERNAME/eip7702-dust-aggregator.git
git branch -M main
git push -u origin main
```

### 2. Deploy on Railway

1. Go to [railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. Railway will automatically detect the Python project
6. Click "Deploy"

### 3. Environment Variables

Add these environment variables in Railway:

- `PORT`: 5000 (default)
- `FLASK_ENV`: production

### 4. Access Your App

After deployment, Railway will provide a URL where your app is live.

## Important Notes

- The app runs in production mode
- All transactions are in SIMULATION mode by default
- Uncomment `send_raw_transaction` in `app.py` to enable real transactions
- Never commit private keys or sensitive data to GitHub
