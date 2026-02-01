const express    = require('express');
const http       = require('http');
const socketIo   = require('socket.io');
const cors       = require('cors');
const { exec }   = require('child_process');

const app    = express();
const server = http.createServer(app);
const io     = socketIo(server, { cors: { origin:"*", methods:["GET","POST"] } });

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));          // serve files from same folder

const rooms        = new Map();
const TURN_TIMEOUT = 30000;   // 30 s
const BID_TIMEOUT  = 60000;   // 60 s

// ============================================================
// ROOM CLASS
// ============================================================
class Room {
    constructor(roomId, hostPassword, numPlayers) {
        this.roomId      = roomId;
        this.hostPassword = hostPassword;
        this.maxPlayers  = parseInt(numPlayers);
        this.players     = [];
        this.gameState   = {
            phase: 'waiting',           // waiting | bidding | playing | scoring
            trumpSuit: null,
            currentPlayerIndex: 0,
            currentTrick: [],
            trickNumber: 1,
            roundNumber: 1,
            leadSuit: null,
            trickHistory: [],
            turnTimer: null,
            biddingTimer: null
        };
    }
    addPlayer(socketId, playerName) {
        if (this.players.length >= this.maxPlayers) return false;
        if (this.players.some(p => p.name === playerName)) return false;
        this.players.push({
            socketId, name: playerName,
            hand: [], bid: null,   // ← null means "has not bid yet"
            tricksWon: 0, score: 0, totalScore: 0, isReady: false
        });
        return true;
    }
    removePlayer(socketId) { this.players = this.players.filter(p => p.socketId !== socketId); }
    getPlayer(socketId)    { return this.players.find(p => p.socketId === socketId); }
    isHost(socketId)       { return this.players.length > 0 && this.players[0].socketId === socketId; }
    isFull()               { return this.players.length === this.maxPlayers; }
    allReady()             { return this.players.length === this.maxPlayers && this.players.every(p => p.isReady); }
}

// ============================================================
// API – create room
// ============================================================
app.post('/api/create-room', (req, res) => {
    const { hostPassword, numPlayers } = req.body;
    if (!hostPassword || !/^\d{4}$/.test(hostPassword))
        return res.status(400).json({ error: 'Password must be a 4-digit PIN' });
    if (!numPlayers || (numPlayers !== '3' && numPlayers !== '4'))
        return res.status(400).json({ error: 'Players must be 3 or 4' });

    let roomId;
    do { roomId = Math.random().toString(36).substr(2,6).toUpperCase(); } while (rooms.has(roomId));

    rooms.set(roomId, new Room(roomId, hostPassword, numPlayers));
    console.log(`🏠 Room created: ${roomId} (${numPlayers} players)`);
    res.json({ roomId });
});

// ============================================================
// SOCKET EVENTS
// ============================================================
io.on('connection', socket => {
    console.log('✅ Connected:', socket.id);

    // ── join-room ──
    socket.on('join-room', ({ roomId, playerName, hostPassword }) => {
        const room = rooms.get(roomId);
        if (!room)           { socket.emit('error',{ message:'Room not found' }); return; }
        if (room.players.length === 0 && hostPassword !== room.hostPassword)
                             { socket.emit('error',{ message:'Invalid host password' }); return; }
        if (room.isFull())   { socket.emit('error',{ message:'Room is full' }); return; }
        if (!room.addPlayer(socket.id, playerName))
                             { socket.emit('error',{ message:'Could not join – name may be taken' }); return; }

        socket.join(roomId);
        socket.roomId = roomId;

        const playerList = room.players.map(p => ({ name:p.name, isReady:p.isReady, totalScore:p.totalScore }));
        socket.emit('joined-room', { roomId, playerName, isHost: room.isHost(socket.id), players: playerList, maxPlayers: room.maxPlayers });
        socket.to(roomId).emit('player-joined', { playerName, players: playerList });
        console.log(`👤 ${playerName} joined ${roomId}`);
    });

    // ── player-ready ──
    socket.on('player-ready', () => {
        const room = rooms.get(socket.roomId);
        if (!room) return;
        const player = room.getPlayer(socket.id);
        if (!player) return;
        player.isReady = true;

        io.to(socket.roomId).emit('player-ready-update', {
            players: room.players.map(p => ({ name:p.name, isReady:p.isReady, totalScore:p.totalScore }))
        });
        if (room.allReady()) {
            console.log(`🎮 All ready – starting game in ${socket.roomId}`);
            setTimeout(() => startNewRound(room, socket.roomId), 1000);
        }
    });

    // ── submit-bid  ── THE FIX: use null check, not truthy check
    socket.on('submit-bid', ({ bid }) => {
        const room = rooms.get(socket.roomId);
        if (!room || room.gameState.phase !== 'bidding') return;
        const player = room.getPlayer(socket.id);
        if (!player) return;
        if (typeof bid !== 'number' || bid < 0 || bid > 13) return;

        player.bid = bid;   // bid can be 0 – that is valid!
        console.log(`📊 ${player.name} bid: ${bid}`);

        // Check: every player has bid (not null)
        const allBidsIn = room.players.every(p => p.bid !== null);
        if (allBidsIn) {
            clearTimeout(room.gameState.biddingTimer);
            console.log(`✅ All bids in – starting play in ${socket.roomId}`);
            startPlayingPhase(room, socket.roomId);
        }
    });

    // ── play-card ──
    socket.on('play-card', ({ card }) => {
        const room = rooms.get(socket.roomId);
        if (!room || room.gameState.phase !== 'playing') return;

        const player      = room.getPlayer(socket.id);
        const currentPlayer = room.players[room.gameState.currentPlayerIndex];
        if (!player || player.socketId !== currentPlayer.socketId) {
            socket.emit('error',{ message:'Not your turn' }); return;
        }
        if (!isCardPlayable(card, player, room.gameState)) {
            socket.emit('error',{ message:'That card cannot be played – check the rules' }); return;
        }

        // Stop turn timer
        if (room.gameState.turnTimer) clearTimeout(room.gameState.turnTimer);

        // Remove from hand
        player.hand = player.hand.filter(c => !(c.suit===card.suit && c.rank===card.rank));

        // Set lead suit on first card of trick
        if (room.gameState.currentTrick.length === 0)
            room.gameState.leadSuit = card.suit;

        room.gameState.currentTrick.push({ playerIndex: room.gameState.currentPlayerIndex, card });

        io.to(socket.roomId).emit('card-played', {
            playerName: player.name,
            playerIndex: room.gameState.currentPlayerIndex,
            card,
            currentTrick: room.gameState.currentTrick
        });

        // Trick complete?
        if (room.gameState.currentTrick.length === room.players.length) {
            setTimeout(() => evaluateTrick(room, socket.roomId), 2000);
        } else {
            room.gameState.currentPlayerIndex =
                (room.gameState.currentPlayerIndex + 1) % room.players.length;
            startTurnTimer(room, socket.roomId);
            io.to(socket.roomId).emit('next-turn', {
                currentPlayerIndex: room.gameState.currentPlayerIndex,
                currentPlayerName:  room.players[room.gameState.currentPlayerIndex].name,
                leadSuit: room.gameState.leadSuit   // ← send leadSuit so client can validate
            });
        }
    });

    // ── disconnect ──
    socket.on('disconnect', () => {
        console.log('❌ Disconnected:', socket.id);
        const roomId = socket.roomId;
        if (!roomId) return;
        const room = rooms.get(roomId);
        if (!room) return;
        const player = room.getPlayer(socket.id);
        const name   = player?.name;
        room.removePlayer(socket.id);

        if (room.players.length === 0) {
            if (room.gameState.turnTimer)    clearTimeout(room.gameState.turnTimer);
            if (room.gameState.biddingTimer) clearTimeout(room.gameState.biddingTimer);
            rooms.delete(roomId);
            console.log(`🗑️  Room ${roomId} deleted`);
        } else {
            io.to(roomId).emit('player-left', {
                playerName: name,
                players: room.players.map(p => ({ name:p.name, isReady:p.isReady, totalScore:p.totalScore }))
            });
        }
    });
});

// ============================================================
// GAME LOGIC
// ============================================================

// ── New Round ──
function startNewRound(room, roomId) {
    // Reset bids to null (not 0!) so the "all bid?" check works
    room.players.forEach(p => { p.bid = null; p.tricksWon = 0; p.score = 0; });

    let valid = false, attempts = 0;
    while (!valid && attempts < 100) {
        const deck = createDeck(room.maxPlayers);
        dealCards(room, deck);
        const suitList = room.maxPlayers === 3 ? ['spade','heart','club'] : ['spade','heart','club','diamond'];
        room.gameState.trumpSuit = suitList[Math.floor(Math.random()*suitList.length)];
        valid = checkValidDeal(room);
        attempts++;
    }

    room.gameState.phase         = 'bidding';
    room.gameState.trickNumber   = 1;
    room.gameState.currentTrick  = [];
    room.gameState.trickHistory  = [];
    room.gameState.leadSuit      = null;

    // Send each player their own hand
    room.players.forEach((player, index) => {
        const sock = io.sockets.sockets.get(player.socketId);
        if (sock) sock.emit('round-started', {
            hand: player.hand,
            trumpSuit: room.gameState.trumpSuit,
            roundNumber: room.gameState.roundNumber,
            playerIndex: index
        });
    });

    // Auto-bid timer – if 60s passes and someone hasn't bid, assign random bid
    room.gameState.biddingTimer = setTimeout(() => {
        room.players.forEach(p => { if (p.bid === null) p.bid = Math.floor(Math.random()*7)+1; });
        console.log(`⏱️  Bid timeout – auto-bidding in ${roomId}`);
        startPlayingPhase(room, roomId);
    }, BID_TIMEOUT);
}

// ── Playing Phase ──
function startPlayingPhase(room, roomId) {
    room.gameState.phase = 'playing';
    room.gameState.currentPlayerIndex = Math.floor(Math.random()*room.players.length);

    io.to(roomId).emit('bidding-complete', {
        bids: room.players.map(p => ({ name: p.name, bid: p.bid })),
        startingPlayer: room.players[room.gameState.currentPlayerIndex].name
    });

    // Small delay then send first next-turn
    setTimeout(() => {
        io.to(roomId).emit('next-turn', {
            currentPlayerIndex: room.gameState.currentPlayerIndex,
            currentPlayerName:  room.players[room.gameState.currentPlayerIndex].name,
            leadSuit: null      // new trick, no lead yet
        });
        startTurnTimer(room, roomId);
    }, 2000);
}

// ── Turn Timer (auto-play on timeout) ──
function startTurnTimer(room, roomId) {
    if (room.gameState.turnTimer) clearTimeout(room.gameState.turnTimer);

    room.gameState.turnTimer = setTimeout(() => {
        const cur = room.players[room.gameState.currentPlayerIndex];
        if (!cur || cur.hand.length === 0) return;

        const playable = cur.hand.filter(c => isCardPlayable(c, cur, room.gameState));
        if (playable.length === 0) return;

        const autoCard = playable[Math.floor(Math.random()*playable.length)];
        cur.hand = cur.hand.filter(c => !(c.suit===autoCard.suit && c.rank===autoCard.rank));

        if (room.gameState.currentTrick.length === 0)
            room.gameState.leadSuit = autoCard.suit;

        room.gameState.currentTrick.push({ playerIndex: room.gameState.currentPlayerIndex, card: autoCard });

        io.to(roomId).emit('card-played', {
            playerName: cur.name,
            playerIndex: room.gameState.currentPlayerIndex,
            card: autoCard,
            currentTrick: room.gameState.currentTrick,
            autoPlayed: true
        });

        if (room.gameState.currentTrick.length === room.players.length) {
            setTimeout(() => evaluateTrick(room, roomId), 2000);
        } else {
            room.gameState.currentPlayerIndex =
                (room.gameState.currentPlayerIndex + 1) % room.players.length;
            startTurnTimer(room, roomId);
            io.to(roomId).emit('next-turn', {
                currentPlayerIndex: room.gameState.currentPlayerIndex,
                currentPlayerName:  room.players[room.gameState.currentPlayerIndex].name,
                leadSuit: room.gameState.leadSuit
            });
        }
    }, TURN_TIMEOUT);
}

// ── Evaluate Trick ──
function evaluateTrick(room, roomId) {
    const { currentTrick, trumpSuit, leadSuit } = room.gameState;

    let winnerIndex = currentTrick[0].playerIndex;
    let highestValue = -1;
    let winningCard  = currentTrick[0].card;

    const trumpPlayed = currentTrick.filter(tc => tc.card.suit === trumpSuit);

    if (trumpPlayed.length > 0) {
        // Highest trump wins
        trumpPlayed.forEach(tc => {
            if (tc.card.value > highestValue) {
                highestValue = tc.card.value;
                winnerIndex  = tc.playerIndex;
                winningCard  = tc.card;
            }
        });
    } else {
        // Highest lead-suit card wins
        currentTrick.forEach(tc => {
            if (tc.card.suit === leadSuit && tc.card.value > highestValue) {
                highestValue = tc.card.value;
                winnerIndex  = tc.playerIndex;
                winningCard  = tc.card;
            }
        });
    }

    room.players[winnerIndex].tricksWon++;

    room.gameState.trickHistory.push({
        trickNumber: room.gameState.trickNumber,
        cards: currentTrick,
        winnerIndex
    });

    io.to(roomId).emit('trick-complete', {
        winnerName: room.players[winnerIndex].name,
        winnerIndex,
        winningCard,
        trickHistory: room.gameState.trickHistory
    });

    if (room.gameState.trickNumber >= 13) {
        setTimeout(() => endRound(room, roomId), 3000);
    } else {
        room.gameState.trickNumber++;
        room.gameState.currentTrick = [];
        room.gameState.leadSuit     = null;
        room.gameState.currentPlayerIndex = winnerIndex;

        setTimeout(() => {
            io.to(roomId).emit('next-trick', {
                trickNumber: room.gameState.trickNumber,
                currentPlayerIndex: winnerIndex,
                currentPlayerName:  room.players[winnerIndex].name
            });
            startTurnTimer(room, roomId);
        }, 2000);
    }
}

// ── End Round (scoring) ──
function endRound(room, roomId) {
    room.players.forEach(p => {
        const bid = p.bid, won = p.tricksWon;
        if      (won < bid)              p.score = -10 * bid;
        else if (won >= bid && won < 2*bid) p.score = bid >= 7 ? 20*bid : 10*bid;   // safe zone / high-bid bonus
        else                             p.score = -10 * bid;   // over-bid
        p.totalScore += p.score;
    });
    room.gameState.phase = 'scoring';

    io.to(roomId).emit('round-complete', {
        scores: room.players.map(p => ({
            name: p.name, bid: p.bid, won: p.tricksWon, score: p.score, totalScore: p.totalScore
        }))
    });
}

// ============================================================
// HELPERS
// ============================================================
function createDeck(numPlayers) {
    const suitList = numPlayers === 3 ? ['spade','heart','club'] : ['spade','heart','club','diamond'];
    const ranks    = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    const values   = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };
    const deck = [];
    for (const s of suitList) for (const r of ranks) deck.push({ suit:s, rank:r, value:values[r] });
    // Fisher-Yates shuffle
    for (let i = deck.length-1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [deck[i],deck[j]]=[deck[j],deck[i]]; }
    return deck;
}

function dealCards(room, deck) {
    let idx = 0;
    room.players.forEach(p => { p.hand = deck.slice(idx, idx+13); idx += 13; });
}

function checkValidDeal(room) {
    const numAces = room.maxPlayers === 3 ? 3 : 4;
    for (const p of room.players) {
        if (p.hand.filter(c => c.rank==='A').length === numAces) return false;
        if (p.hand.filter(c => c.suit === room.gameState.trumpSuit).length === 0) return false;
    }
    return true;
}

// ── Card Playability – same 5-priority chain as the client ──
function isCardPlayable(card, player, gameState) {
    // Rule 1 – leading
    if (gameState.currentTrick.length === 0) return true;

    const leadSuit  = gameState.leadSuit;
    const trumpSuit = gameState.trumpSuit;
    const myLeadCards  = player.hand.filter(c => c.suit === leadSuit);
    const myTrumpCards = player.hand.filter(c => c.suit === trumpSuit);

    // Have the led suit?
    if (myLeadCards.length > 0) {
        if (card.suit !== leadSuit) return false;   // must follow suit

        // What is the highest lead-suit card already played?
        const playedLeadCards = gameState.currentTrick.filter(tc => tc.card.suit === leadSuit);
        const highestPlayed  = playedLeadCards.length > 0
            ? Math.max(...playedLeadCards.map(tc => tc.card.value))
            : -1;
        const hasHigher = myLeadCards.some(c => c.value > highestPlayed);

        if (hasHigher) return card.value > highestPlayed;   // Rule 2 – must play higher
        return true;                                         // Rule 3 – no higher → any of that suit
    }

    // Don't have led suit, but have trump?
    if (myTrumpCards.length > 0) return card.suit === trumpSuit;   // Rule 4

    // Have neither → anything
    return true;                                                    // Rule 5
}

// ============================================================
// START SERVER
// ============================================================
function openBrowser(url) {
    const cmd = process.platform === 'darwin' ? `open ${url}` : process.platform === 'win32' ? `start ${url}` : `xdg-open ${url}`;
    exec(cmd, err => { if (err) console.log('⚠️  Could not auto-open browser.'); });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('\n🎮 ====================================');
    console.log('   POWER SUIT – MULTIPLAYER SERVER');
    console.log('====================================\n');
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🌐 Local:   http://localhost:${PORT}`);
    console.log(`🌐 Network: http://[your-ip]:${PORT}\n`);
    console.log('💡 Share the room code with friends!');
    console.log('💡 Press Ctrl+C to stop.\n');
    setTimeout(() => openBrowser(`http://localhost:${PORT}`), 1000);
});