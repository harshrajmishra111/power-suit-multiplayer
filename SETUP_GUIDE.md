# 🎮 POWER SUIT - Quick Setup Guide

## For Complete Beginners

### Step 1: Install Node.js
1. Go to https://nodejs.org/
2. Download the "LTS" version (recommended)
3. Run the installer and follow the instructions
4. To verify installation, open Terminal/Command Prompt and type:
   ```
   node --version
   ```
   You should see a version number like `v18.x.x`

### Step 2: Extract Game Files
1. Extract the power-suit-game folder to your desired location
2. Remember where you put it!

### Step 3: Install Game Dependencies
1. Open Terminal (Mac/Linux) or Command Prompt (Windows)
2. Navigate to the game folder:
   ```
   cd path/to/power-suit-game
   ```
   Example: `cd C:\Users\YourName\Downloads\power-suit-game`
   
3. Install dependencies:
   ```
   npm install
   ```
   This will download all required packages. Wait for it to complete.

### Step 4: Start the Game
1. In the same terminal/command prompt, type:
   ```
   npm start
   ```
2. The game will automatically open in your browser!
3. If it doesn't open automatically, go to: `http://localhost:3000`

### Step 5: Play!
- **Offline Mode**: Play against AI bots immediately
- **Online Mode**: 
  - Create a room with a 4-digit PIN (like 1234)
  - Share the 6-letter room code with friends
  - They can join from anywhere on the same network or internet

---

## 🌐 Playing Online with Friends

### If Friends are on the Same Network (WiFi)
1. Find your computer's IP address:
   - **Windows**: Open Command Prompt, type `ipconfig`, look for "IPv4 Address"
   - **Mac**: System Preferences → Network → your connection → look for IP
   - **Linux**: Terminal, type `ip addr` or `ifconfig`
   
2. Start the game with `npm start`

3. Share this URL with friends:
   ```
   http://YOUR-IP-ADDRESS:3000
   ```
   Example: `http://192.168.1.100:3000`

4. Create a room and share the 6-letter code!

### If Friends are on Different Networks (Internet)
You'll need to set up port forwarding or use a service like ngrok:

**Using ngrok (easiest):**
1. Download ngrok from https://ngrok.com/
2. Start your game: `npm start`
3. In another terminal: `ngrok http 3000`
4. Share the ngrok URL with friends (looks like: `https://abc123.ngrok.io`)

---

## ❓ Common Issues

### "npm command not found"
- Node.js is not installed correctly
- Restart your terminal/command prompt after installing Node.js
- Try reinstalling Node.js

### "Cannot find module 'express'"
- Run `npm install` in the game directory
- Make sure you're in the correct folder

### "Port 3000 is already in use"
- Another program is using port 3000
- Close other applications or change the port:
  - Edit `server.js`
  - Change `const PORT = process.env.PORT || 3000;` to another number like 3001

### Game opens but shows errors
- Clear browser cache (Ctrl+F5 or Cmd+Shift+R)
- Try a different browser (Chrome recommended)
- Check browser console for errors (F12 → Console tab)

### AI crashes the game
- This should be fixed in version 2.0!
- If it still happens, refresh the page and start a new game
- Report the issue with browser console errors

### Can't create room - "Invalid password"
- Password MUST be exactly 4 digits (e.g., 1234, 5678)
- Only numbers allowed (no letters or symbols)
- Don't use spaces

---

## 🎯 Quick Rules Reminder

### The Basics
1. **Bid**: Predict how many tricks you'll win
2. **Play**: Follow the card rules strictly
3. **Score**: Land in the "safe zone" (Bid X = Win X to 2X-1 tricks)

### Card Rules (In Order)
1. Must follow led suit if you have it
2. Must play higher if you can
3. Can play any lower card if you don't have higher
4. Only play Trump when you don't have led suit

### Trump Power
- ANY Trump beats ANY non-Trump
- Trump cards have a golden glow
- Even 2 of Trump beats Ace of another suit

---

## 💾 Stopping the Server

To stop the game server:
- Press `Ctrl+C` in the terminal where it's running
- Or just close the terminal window

To restart:
- Run `npm start` again

---

## 🔄 Updating the Game

If you receive updated files:
1. Stop the server (Ctrl+C)
2. Replace old files with new ones
3. Run `npm install` again (in case dependencies changed)
4. Start with `npm start`

---

## 📱 Playing on Mobile

The game is mobile-friendly! To play on your phone:
1. Make sure your phone is on the same WiFi as the computer running the server
2. Open your phone's browser
3. Go to: `http://COMPUTER-IP:3000`
4. Play online or offline mode!

---

## 🎮 Tips for Best Experience

- Use **Google Chrome** or **Firefox** for best compatibility
- Play in **fullscreen mode** (F11) for immersive experience
- Make sure you have a stable internet connection for online play
- Close unnecessary browser tabs for better performance

---

## 🆘 Still Need Help?

If you're stuck:
1. Check the main README.md for detailed information
2. Look at browser console (F12) for error messages
3. Make sure all files are in the correct location
4. Try restarting your computer
5. Reinstall Node.js and run `npm install` again

---

**Happy Gaming!** ⚡

Remember: The goal is to bid accurately, not to win the most tricks!
