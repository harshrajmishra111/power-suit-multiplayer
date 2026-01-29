# Power Suit - Multiplayer Card Game
## Deployment Guide

### 📋 What You Need
1. A server/hosting (e.g., Heroku, Railway, DigitalOcean, AWS)
2. Node.js installed (v14 or higher)
3. Git (optional, for deployment)

---

## 🚀 Quick Local Setup (Testing)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Start the Server
```bash
npm start
```

The server will run on `http://localhost:3000`

### Step 3: Open in Browser
Open `http://localhost:3000` in multiple browser windows/devices to test multiplayer

---

## 🌐 Deploy to Heroku (FREE)

### Step 1: Create Heroku Account
1. Go to https://heroku.com
2. Sign up for free account

### Step 2: Install Heroku CLI
```bash
# Mac
brew install heroku/brew/heroku

# Windows
# Download from: https://devcenter.heroku.com/articles/heroku-cli
```

### Step 3: Login to Heroku
```bash
heroku login
```

### Step 4: Create Heroku App
```bash
heroku create power-suit-game
```

### Step 5: Add Procfile
Create a file named `Procfile` (no extension) with this content:
```
web: node server.js
```

### Step 6: Deploy
```bash
git init
git add .
git commit -m "Initial commit"
git push heroku main
```

### Step 7: Open Your App
```bash
heroku open
```

Your game is now live! Share the URL with friends!

---

## 🚂 Deploy to Railway (EASIER)

### Step 1: Go to Railway
1. Visit https://railway.app
2. Sign up with GitHub

### Step 2: New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Connect your GitHub account
4. Select your repository

### Step 3: Configure
Railway will auto-detect Node.js and deploy!

### Step 4: Get URL
Click on your deployment → Settings → Generate Domain

Share this URL with friends!

---

## 💻 Deploy to Your Own Server (VPS)

### Step 1: SSH into Server
```bash
ssh user@your-server-ip
```

### Step 2: Install Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Step 3: Upload Files
```bash
# On your local machine
scp -r * user@your-server-ip:/var/www/power-suit/
```

### Step 4: Install Dependencies
```bash
cd /var/www/power-suit
npm install
```

### Step 5: Install PM2 (Process Manager)
```bash
sudo npm install -g pm2
pm2 start server.js
pm2 startup
pm2 save
```

### Step 6: Setup Nginx (Optional)
```bash
sudo apt install nginx

# Create nginx config
sudo nano /etc/nginx/sites-available/power-suit
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/power-suit /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 📁 File Structure

```
power-suit-multiplayer/
├── server.js           # Backend server
├── package.json        # Dependencies
├── public/            
│   └── index.html     # Frontend game
├── Procfile           # For Heroku
└── README.md          # This file
```

---

## 🎮 How to Play

### Creating a Room (Host)
1. Click "Create Room"
2. Enter a host password (keep it secret!)
3. Select number of players (3 or 4)
4. Share the Room ID with friends

### Joining a Room (Players)
1. Click "Join Room"
2. Enter Room ID (from host)
3. Enter your name
4. Wait for everyone to join

### Game Rules
- Each player gets 13 cards
- One suit is randomly selected as "Power Set" (Trump)
- Players bid how many tricks they'll win (60 seconds)
- Players must play higher cards if they have them
- Power Set cards always beat non-Power Set cards
- Each turn has 30 seconds timeout

---

## 🔧 Configuration

### Change Port
Edit `server.js`:
```javascript
const PORT = process.env.PORT || 3000; // Change 3000 to your port
```

### Change Turn Timeout
Edit `server.js`:
```javascript
const TURN_TIMEOUT = 30000; // Change to milliseconds (30000 = 30 seconds)
```

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 [PID]
```

### Cannot Connect
- Check firewall settings
- Ensure port 3000 is open
- Check server logs: `pm2 logs` or `heroku logs --tail`

### Players Disconnecting
- Check internet connection
- Ensure WebSocket connections are allowed
- Check browser console for errors

---

## 📱 Mobile Support
The game is fully responsive and works on:
- ✅ Desktop browsers (Chrome, Firefox, Safari, Edge)
- ✅ Mobile phones (iOS Safari, Android Chrome)
- ✅ Tablets

---

## 🎯 Features
- ✅ Real-time multiplayer (3-4 players)
- ✅ Room-based matchmaking
- ✅ Host password protection
- ✅ 30-second turn timer
- ✅ 60-second bidding timer
- ✅ Auto-play on timeout
- ✅ Complete game history
- ✅ Power Set (Trump) highlighting
- ✅ Responsive design
- ✅ Disconnection handling

---

## 📞 Support
For issues or questions, check the browser console and server logs for error messages.

---

## 🎉 Enjoy Playing!
Share the game URL with friends and have fun!
