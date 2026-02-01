# ⚡ POWER SUIT ⚡

A strategic multiplayer card game with AI opponents and online play capabilities.

## 🎮 Game Overview

Power Suit is a trick-taking card game where players bid on how many tricks they'll win, then try to meet their bid exactly (or stay within a safe zone) to score points. Features include:

- **Offline Mode**: Play against intelligent AI bots
- **Online Mode**: Create or join rooms to play with friends
- **Strategic Depth**: Trump suits, bidding, and calculated risk-taking
- **Beautiful UI**: Polished cyberpunk aesthetic with smooth animations

---

## 🚀 Quick Start

### Installation

1. **Install Node.js** (if not already installed)
   - Download from: https://nodejs.org/
   - Recommended: v16 or higher

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Start the Server**
   ```bash
   npm start
   ```

4. **Play!**
   - The browser will open automatically at `http://localhost:3000`
   - Choose Offline Mode (vs AI) or Online Mode (multiplayer)

---

## 🎯 How to Play

### Game Setup

- **3-4 Players** (remove Diamonds for 3 players)
- **13 cards** dealt to each player
- **Trump Suit** (Power Set) randomly selected
- Cards with golden glow are Trump cards

### Game Phases

#### 1. Bidding Phase (60 seconds)
- Predict how many tricks you'll win (0-13)
- Strategy: Bid conservatively to land in the "safe zone"

#### 2. Playing Phase
- 13 tricks (rounds) of card play
- Follow the card playing rules strictly

### 🃏 Card Playing Rules (CRITICAL!)

**These rules MUST be followed in order:**

1. **Must Follow Suit**: If you have the led suit, you MUST play it
2. **Must Play Higher**: If you have a higher card than what's been played, you MUST play it
3. **Can Play Any Lower**: If all your cards of the led suit are lower, play any of them
4. **Trump Only When Out**: Only play Trump when you have NO cards of the led suit

**Example:**
- Lead: 9♣
- Your hand: K♣, 10♣, 5♣
- You MUST play King or 10 (both higher than 9)
- You CANNOT play the 5♣

### ⚡ Trump Power (Power Set)

- **ANY Trump card beats ANY non-Trump card**
- Even a 2 of Trump beats an Ace of another suit!
- If multiple Trump cards are played, highest Trump wins
- Trump cards have a golden glow in the UI

### 🏆 Scoring System

Let **X** = your bid (number of tricks you predicted)

| Tricks Won | Points | Zone |
|------------|--------|------|
| Less than X | **-10X** | ❌ PENALTY |
| X to (2X-1) | **+10X** | ✅ SAFE ZONE |
| 2X or more | **-10X** | ❌ PENALTY |

**Examples:**
- Bid 4, Win 4-7 tricks: **+40 points** ✅
- Bid 4, Win 3 tricks: **-40 points** ❌
- Bid 4, Win 8+ tricks: **-40 points** ❌

### 🌟 High Bid Bonus

Bidding **7 or more** tricks gives **DOUBLE points** if you succeed:

- Bid 7+ and succeed: **+20X points** instead of +10X
- Bid 7+ and fail: Standard penalty (-10X)

**Example:**
- Bid 8, Win 8-15 tricks: **+160 points** 🌟
- Bid 8, Win 7 tricks: **-80 points**

---

## 🤖 Offline Mode (AI)

### Features
- Play against 2-3 AI opponents
- Three difficulty levels:
  - **Easy**: Random play
  - **Medium**: Smart bidding and card selection
  - **Hard**: Strategic play with advanced tactics

### AI Behavior
- Analyzes hand strength for bidding
- Counts high cards, Aces, and Trump
- Plays strategically based on bid vs tricks won
- Follows all game rules correctly

---

## 🌐 Online Mode

### Creating a Room

1. Click "Create Room"
2. Enter your name
3. **Set a 4-digit PIN** (e.g., 1234)
   - This PIN is required to rejoin if you disconnect
   - Keep it secret or share only with trusted players
4. Choose number of players (3 or 4)
5. Share the 6-character room code with friends

### Joining a Room

1. Click "Join Room"
2. Enter your name
3. Enter the 6-character room code
4. Click "Ready Up" when everyone is in
5. Game starts when all players are ready!

### Important Notes

- **Host Password**: The 4-digit PIN is only for the room creator
- **Room Code**: Share the 6-letter code (e.g., ABC123) with friends
- **Auto-Play**: If you don't play within 30 seconds, a random valid card is played
- **Disconnection**: Players who disconnect cannot rejoin (room closes if host leaves)

---

## 💡 Strategy Tips

1. **Count Trump Cards**: More Trump = more winning potential
2. **Track High Cards**: Remember which Aces and Kings have been played
3. **Bid Conservatively**: Better to underbid slightly than overbid
4. **Know Your Safe Zone**: Bid X allows you to win up to (2X-1) tricks safely
5. **Watch Others**: Track opponents' bids and tricks won
6. **Trump Wisely**: Save high Trump for critical moments
7. **High Bids = High Risk**: Only bid 7+ if you're confident

---

## 📁 Project Structure

```
power-suit-game/
├── index.html          # Main menu
├── offline.html        # Offline mode (vs AI)
├── online.html         # Online multiplayer
├── server.js           # Node.js server with Socket.IO
├── styles.css          # Game styling
├── package.json        # Dependencies
└── README.md           # This file
```

---

## 🔧 Technical Details

### Technologies Used
- **Frontend**: HTML5, CSS3, JavaScript
- **Backend**: Node.js, Express
- **Real-time**: Socket.IO
- **Fonts**: Righteous (headers), Space Mono (body)

### Key Features
- Responsive design (mobile-friendly)
- Real-time multiplayer synchronization
- Intelligent AI with difficulty levels
- Turn timers and auto-play
- Complete game history tracking
- Beautiful animations and effects

---

## 🐛 Troubleshooting

### Game crashes in offline mode
- **Fixed!** AI logic has been completely rewritten with proper error handling

### "Password is invalid" error
- Make sure you're entering a 4-digit PIN (numbers only, like 1234)
- The password is only for the room creator (host)

### Can't join room
- Verify the 6-character room code is correct
- Room may be full (check player count)
- Room may have already started

### Cards won't play
- Make sure it's your turn (your card will have a golden border if you're active)
- Check if the card is playable (follows the rules)
- Disabled cards appear grayed out

---

## 🎨 Game Aesthetics

The game features a cyberpunk-inspired design with:
- Gradient backgrounds with animated glows
- Power Set cards with golden animation
- Smooth card animations and transitions
- Real-time status updates
- Color-coded scoring (green = positive, red = negative)

---

## 📝 Version History

### Version 2.0.0 (Current)
- ✅ Fixed AI crash issues - completely stable now
- ✅ Improved password validation (4-digit PIN required)
- ✅ Enhanced AI intelligence with 3 difficulty levels
- ✅ Better error handling throughout
- ✅ Clearer UI feedback for playable cards
- ✅ Comprehensive how-to-play guide
- ✅ Room code validation and better error messages
- ✅ Improved card playability logic

### Version 1.0.0
- Initial release

---

## 🎯 Future Enhancements

Potential features for future versions:
- [ ] Persistent player stats and rankings
- [ ] Multiple round tournaments
- [ ] Chat functionality in online mode
- [ ] Reconnection support for disconnected players
- [ ] Custom game rule variations
- [ ] Mobile app version
- [ ] Spectator mode

---

## 📜 Game Rules Reference

### Re-deal Conditions
The deck is reshuffled if:
- Any player receives ALL the Aces
- Any player has ZERO Trump cards

### Winning
- Play single rounds or multiple rounds
- Highest cumulative score wins
- Suggested: 5 rounds with rotating dealers

---

## 🤝 Contributing

Feel free to fork and improve! Some areas that could use enhancement:
- Additional AI difficulty levels
- More visual effects and animations
- Sound effects
- Tournament mode
- Player statistics

---

## 📄 License

This project is open source. Feel free to use and modify!

---

## 🎮 Have Fun!

Power Suit combines strategy, psychology, and calculated risk-taking. Master the art of bidding, learn when to use your Trump cards, and climb to the top of the leaderboard!

**May the Power Set be with you!** ⚡
