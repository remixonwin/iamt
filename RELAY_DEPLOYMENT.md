# Gun.js Relay Deployment Guide

## Architecture Overview

Your IAMT app now has a hybrid relay setup:
- **Primary**: Your deployed Gun.js relay (to be deployed)
- **Fallbacks**: Public Gun.js relays (https://gun-manhattan.herokuapp.com/gun, https://gun-us.herokuapp.com/gun)

## Files Created for Deployment

### relay/vercel.json
Vercel configuration for serverless deployment of the Gun.js relay.

### relay/.vercelignore
Excludes unnecessary files from deployment.

## Deployment Steps

###  1. Deploy Relay to Vercel

```bash
cd relay
npx vercel@latest --prod
```

**Follow the prompts:**
- Set up and deploy? **Y**
- Which scope? (Select your Vercel account)
- Link to existing project? **N**
- Project name? **iamt-relay** (or your preferred name)
- Directory? **./** (press Enter)
- Override settings? **N**

**Expected output:**
```
✔ Deployed to production. https://iamt-relay-xxxxx.vercel.app
```

### 2. Update Frontend Environment Variable

Once deployed, you'll get a URL like: `https://iamt-relay-xxxxx.vercel.app`

#### Option A: Update via Vercel Dashboard
1. Go to https://vercel.com/dashboard
2. Select your **iamt** (frontend) project
3. Go to Settings → Environment Variables
4. Add `NEXT_PUBLIC_GUN_RELAY` = `https://iamt-relay-xxxxx.vercel.app/gun`
5. Redeploy frontend

#### Option B: Update via CLI
```bash
cd /home/remixonwin/Documents/iamt
npx vercel env add NEXT_PUBLIC_GUN_RELAY production
# When prompted, enter: https://iamt-relay-xxxxx.vercel.app/gun

# Redeploy frontend
npx vercel --prod
```

### 3. Verify Deployment

Test your relay:
```bash
curl https://iamt-relay-xxxxx.vercel.app/
```

Expected response:
```json
{
  "status": "ok",
  "message": "IAMT Gun.js Relay Server",
  "gun": "/gun"
}
```

## Current Configuration

### Local Development
- Uses: `http://localhost:8765/gun`
- Run: `docker compose up`

### Production (Vercel)
**Before relay deployment:**
- Falls back to public relays:
  - `https://gun-manhattan.herokuapp.com/gun`
  - `https://gun-us.herokuapp.com/gun`

**After relay deployment:**
- Primary: Your deployed relay
- Fallbacks: Public relays (still available)

## Troubleshooting

### Relay deployment fails
**Issue**: Vercel may have issues with Gun.js file persistence

**Solution**: Gun.js on Vercel is stateless (no persistent storage). Data syncs through connected peers. This is fine for small-scale use. For production at scale, consider:
- Railway.app (supports persistent storage)
- A dedicated VPS with Docker

### Frontend can't connect to relay
1. Check environment variable is set: `NEXT_PUBLIC_GUN_RELAY`
2. Verify relay URL ends with `/gun`
3. Check CORS is enabled in relay server
4. Check browser console for WebSocket errors

### Performance issues
Public relays may be slow or unreliable. For best performance:
1. Deploy your own relay (Railway/VPS recommended)
2. Use multiple relay servers for redundancy

## Alternative: Railway Deployment (Recommended for Production)

Railway supports persistent storage and WebSockets better than Vercel:

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Deploy relay
cd relay
railway init
railway up
railway open

# Get the URL and update NEXT_PUBLIC_GUN_RELAY
```

## Next Steps

1. ✅ Public relays configured (already done)
2. ⏳ Deploy relay to Vercel (follow steps above)
3. ⏳ Update frontend environment variable
4. ⏳ Redeploy frontend
5. ✅ Test cross-device sync

---

**Note**: The current configuration already works with public relays, so your Vercel deployment should be functional now. Deploying your own relay improves performance and reliability.
