const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Game state storage
const rooms = new Map();
const TURN_TIMEOUT = 30000; // 30 seconds

// Room structure
class Room {
    constructor(roomId, hostPassword, numPlayers) {
        this.roomId = roomId;
        this.hostPassword = hostPassword;
        this.maxPlayers = parseInt(numPlayers);
        this.players = [];
        this.gameState = {
            phase: 'waiting', // waiting, bidding, playing, scoring
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
        if (this.players.length >= this.maxPlayers) {
            return false;
        }
        
        this.players.push({
            socketId,
            name: playerName,
            hand: [],
            bid: 0,
            tricksWon: 0,
            score: 0,
            totalScore: 0,
            isReady: false
        });
        
        return true;
    }

    removePlayer(socketId) {
        this.players = this.players.filter(p => p.socketId !== socketId);
    }

    getPlayer(socketId) {
        return this.players.find(p => p.socketId === socketId);
    }

    isHost(socketId) {
        return this.players.length > 0 && this.players[0].socketId === socketId;
    }

    isFull() {
        return this.players.length === this.maxPlayers;
    }

    allReady() {
        return this.players.length === this.maxPlayers && 
               this.players.every(p => p.isReady);
    }
}

// Create room
app.post('/api/create-room', (req, res) => {
    const { hostPassword, numPlayers } = req.body;
    
    if (!hostPassword || !numPlayers) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    // Generate unique room ID
    const roomId = Math.random().toString(36).substr(2, 6).toUpperCase();
    
    // Create room
    const room = new Room(roomId, hostPassword, numPlayers);
    rooms.set(roomId, room);
    
    res.json({ roomId });
});

// Socket.IO connection
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join room
    socket.on('join-room', ({ roomId, playerName, hostPassword }) => {
        const room = rooms.get(roomId);
        
        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        // Check if host joining
        if (room.players.length === 0) {
            // First player must provide correct host password
            if (hostPassword !== room.hostPassword) {
                socket.emit('error', { message: 'Invalid host password' });
                return;
            }
        }

        if (room.isFull()) {
            socket.emit('error', { message: 'Room is full' });
            return;
        }

        // Add player to room
        if (room.addPlayer(socket.id, playerName)) {
            socket.join(roomId);
            socket.roomId = roomId;
            
            socket.emit('joined-room', {
                roomId,
                playerName,
                isHost: room.isHost(socket.id),
                players: room.players.map(p => ({
                    name: p.name,
                    isReady: p.isReady,
                    totalScore: p.totalScore
                })),
                maxPlayers: room.maxPlayers
            });

            // Notify others
            socket.to(roomId).emit('player-joined', {
                playerName,
                players: room.players.map(p => ({
                    name: p.name,
                    isReady: p.isReady,
                    totalScore: p.totalScore
                }))
            });
        }
    });

    // Player ready
    socket.on('player-ready', () => {
        const roomId = socket.roomId;
        const room = rooms.get(roomId);
        
        if (!room) return;

        const player = room.getPlayer(socket.id);
        if (player) {
            player.isReady = true;
            
            io.to(roomId).emit('player-ready-update', {
                players: room.players.map(p => ({
                    name: p.name,
                    isReady: p.isReady,
                    totalScore: p.totalScore
                }))
            });

            // Start game if all ready
            if (room.allReady()) {
                startNewRound(room, roomId);
            }
        }
    });

    // Submit bid
    socket.on('submit-bid', ({ bid }) => {
        const roomId = socket.roomId;
        const room = rooms.get(roomId);
        
        if (!room || room.gameState.phase !== 'bidding') return;

        const player = room.getPlayer(socket.id);
        if (player) {
            player.bid = bid;
            
            // Check if all bids submitted
            if (room.players.every(p => p.bid > 0)) {
                clearTimeout(room.gameState.biddingTimer);
                startPlayingPhase(room, roomId);
            }
        }
    });

    // Play card
    socket.on('play-card', ({ card }) => {
        const roomId = socket.roomId;
        const room = rooms.get(roomId);
        
        if (!room || room.gameState.phase !== 'playing') return;

        const player = room.getPlayer(socket.id);
        const currentPlayer = room.players[room.gameState.currentPlayerIndex];
        
        if (!player || player.socketId !== currentPlayer.socketId) {
            socket.emit('error', { message: 'Not your turn' });
            return;
        }

        // Validate card
        if (!isCardPlayable(card, player, room.gameState)) {
            socket.emit('error', { message: 'Invalid card play' });
            return;
        }

        // Clear turn timer
        if (room.gameState.turnTimer) {
            clearTimeout(room.gameState.turnTimer);
        }

        // Remove card from hand
        player.hand = player.hand.filter(c => 
            !(c.suit === card.suit && c.rank === card.rank)
        );

        // Set lead suit if first card
        if (room.gameState.currentTrick.length === 0) {
            room.gameState.leadSuit = card.suit;
        }

        // Add to current trick
        room.gameState.currentTrick.push({
            playerIndex: room.gameState.currentPlayerIndex,
            card: card
        });

        // Broadcast card played
        io.to(roomId).emit('card-played', {
            playerName: player.name,
            playerIndex: room.gameState.currentPlayerIndex,
            card: card,
            currentTrick: room.gameState.currentTrick
        });

        // Check if trick complete
        if (room.gameState.currentTrick.length === room.players.length) {
            setTimeout(() => evaluateTrick(room, roomId), 2000);
        } else {
            // Next player's turn
            room.gameState.currentPlayerIndex = 
                (room.gameState.currentPlayerIndex + 1) % room.players.length;
            
            startTurnTimer(room, roomId);
            
            io.to(roomId).emit('next-turn', {
                currentPlayerIndex: room.gameState.currentPlayerIndex,
                currentPlayerName: room.players[room.gameState.currentPlayerIndex].name
            });
        }
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        const roomId = socket.roomId;
        if (roomId) {
            const room = rooms.get(roomId);
            if (room) {
                const player = room.getPlayer(socket.id);
                const playerName = player?.name;
                
                room.removePlayer(socket.id);
                
                if (room.players.length === 0) {
                    // Delete empty room
                    rooms.delete(roomId);
                } else {
                    // Notify others
                    io.to(roomId).emit('player-left', {
                        playerName,
                        players: room.players.map(p => ({
                            name: p.name,
                            isReady: p.isReady,
                            totalScore: p.totalScore
                        }))
                    });
                }
            }
        }
    });
});

// Game logic functions
function startNewRound(room, roomId) {
    // Create and deal cards
    let validDeal = false;
    
    while (!validDeal) {
        const deck = createDeck(room.maxPlayers);
        dealCards(room, deck);
        
        // Select trump suit
        const suits = room.maxPlayers === 3 ? ['spade', 'heart', 'club'] : ['spade', 'heart', 'club', 'diamond'];
        room.gameState.trumpSuit = suits[Math.floor(Math.random() * suits.length)];
        
        validDeal = checkValidDeal(room);
    }

    room.gameState.phase = 'bidding';
    room.gameState.trickNumber = 1;
    room.gameState.currentTrick = [];
    room.gameState.trickHistory = [];
    room.gameState.leadSuit = null;

    // Send game start
    room.players.forEach((player, index) => {
        io.to(player.socketId).emit('round-started', {
            hand: player.hand,
            trumpSuit: room.gameState.trumpSuit,
            roundNumber: room.gameState.roundNumber,
            playerIndex: index
        });
    });

    // Start bidding timer (60 seconds)
    room.gameState.biddingTimer = setTimeout(() => {
        // Auto-bid for players who haven't bid
        room.players.forEach(player => {
            if (!player.bid) {
                player.bid = Math.floor(Math.random() * 7) + 1;
            }
        });
        startPlayingPhase(room, roomId);
    }, 60000);
}

function startPlayingPhase(room, roomId) {
    room.gameState.phase = 'playing';
    room.gameState.currentPlayerIndex = Math.floor(Math.random() * room.players.length);

    io.to(roomId).emit('bidding-complete', {
        bids: room.players.map(p => ({ name: p.name, bid: p.bid })),
        startingPlayer: room.players[room.gameState.currentPlayerIndex].name
    });

    startTurnTimer(room, roomId);
}

function startTurnTimer(room, roomId) {
    room.gameState.turnTimer = setTimeout(() => {
        // Auto-play random valid card
        const currentPlayer = room.players[room.gameState.currentPlayerIndex];
        
        if (currentPlayer && currentPlayer.hand.length > 0) {
            const playableCards = currentPlayer.hand.filter(card => 
                isCardPlayable(card, currentPlayer, room.gameState)
            );
            
            if (playableCards.length > 0) {
                const randomCard = playableCards[Math.floor(Math.random() * playableCards.length)];
                
                // Simulate play card event
                io.to(currentPlayer.socketId).emit('auto-played', { card: randomCard });
                
                // Process the card play
                currentPlayer.hand = currentPlayer.hand.filter(c => 
                    !(c.suit === randomCard.suit && c.rank === randomCard.rank)
                );

                if (room.gameState.currentTrick.length === 0) {
                    room.gameState.leadSuit = randomCard.suit;
                }

                room.gameState.currentTrick.push({
                    playerIndex: room.gameState.currentPlayerIndex,
                    card: randomCard
                });

                io.to(roomId).emit('card-played', {
                    playerName: currentPlayer.name,
                    playerIndex: room.gameState.currentPlayerIndex,
                    card: randomCard,
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
                        currentPlayerName: room.players[room.gameState.currentPlayerIndex].name
                    });
                }
            }
        }
    }, TURN_TIMEOUT);
}

function evaluateTrick(room, roomId) {
    const { currentTrick, trumpSuit, leadSuit } = room.gameState;
    
    let winnerIndex = 0;
    let highestValue = -1;
    let winningCard = null;

    // Check for trump cards
    const trumpPlayed = currentTrick.filter(tc => tc.card.suit === trumpSuit);

    if (trumpPlayed.length > 0) {
        trumpPlayed.forEach(tc => {
            if (tc.card.value > highestValue) {
                highestValue = tc.card.value;
                winnerIndex = tc.playerIndex;
                winningCard = tc.card;
            }
        });
    } else {
        currentTrick.forEach(tc => {
            if (tc.card.suit === leadSuit && tc.card.value > highestValue) {
                highestValue = tc.card.value;
                winnerIndex = tc.playerIndex;
                winningCard = tc.card;
            }
        });
    }

    // Award trick
    room.players[winnerIndex].tricksWon++;

    // Save to history
    room.gameState.trickHistory.push({
        trickNumber: room.gameState.trickNumber,
        cards: currentTrick,
        winnerIndex: winnerIndex
    });

    io.to(roomId).emit('trick-complete', {
        winnerName: room.players[winnerIndex].name,
        winnerIndex: winnerIndex,
        winningCard: winningCard,
        trickHistory: room.gameState.trickHistory,
        playerStats: room.players.map(p => ({
            name: p.name,
            tricksWon: p.tricksWon
        }))
    });

    // Check if round complete
    if (room.gameState.trickNumber >= 13) {
        setTimeout(() => endRound(room, roomId), 3000);
    } else {
        room.gameState.trickNumber++;
        room.gameState.currentTrick = [];
        room.gameState.leadSuit = null;
        room.gameState.currentPlayerIndex = winnerIndex;

        setTimeout(() => {
            io.to(roomId).emit('next-trick', {
                trickNumber: room.gameState.trickNumber,
                currentPlayerIndex: winnerIndex,
                currentPlayerName: room.players[winnerIndex].name
            });
            
            startTurnTimer(room, roomId);
        }, 2000);
    }
}

function endRound(room, roomId) {
    // Calculate scores
    room.players.forEach(player => {
        const bid = player.bid;
        const won = player.tricksWon;
        let score = 0;

        if (won < bid) {
            score = -10 * bid;
        } else if (won >= bid && won < 2 * bid) {
            if (bid >= 7) {
                score = 20 * bid;
            } else {
                score = 10 * bid;
            }
        } else {
            score = -10 * bid;
        }

        player.score = score;
        player.totalScore += score;
    });

    room.gameState.phase = 'scoring';

    io.to(roomId).emit('round-complete', {
        scores: room.players.map(p => ({
            name: p.name,
            bid: p.bid,
            won: p.tricksWon,
            score: p.score,
            totalScore: p.totalScore
        }))
    });
}

// Helper functions
function createDeck(numPlayers) {
    const suits = numPlayers === 3 
        ? ['spade', 'heart', 'club'] 
        : ['spade', 'heart', 'club', 'diamond'];
    
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const rankValues = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, 
                        '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

    const deck = [];
    for (const suit of suits) {
        for (const rank of ranks) {
            deck.push({
                suit: suit,
                rank: rank,
                value: rankValues[rank]
            });
        }
    }

    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    return deck;
}

function dealCards(room, deck) {
    const cardsPerPlayer = 13;
    let cardIndex = 0;

    room.players.forEach(player => {
        player.hand = deck.slice(cardIndex, cardIndex + cardsPerPlayer);
        player.bid = 0;
        player.tricksWon = 0;
        player.score = 0;
        cardIndex += cardsPerPlayer;
    });
}

function checkValidDeal(room) {
    const numAces = room.maxPlayers === 3 ? 3 : 4;
    
    for (const player of room.players) {
        const aces = player.hand.filter(card => card.rank === 'A').length;
        if (aces === numAces) return false;
    }

    for (const player of room.players) {
        const trumpCards = player.hand.filter(card => card.suit === room.gameState.trumpSuit).length;
        if (trumpCards === 0) return false;
    }

    return true;
}

function isCardPlayable(card, player, gameState) {
    if (gameState.currentTrick.length === 0) {
        return true;
    }

    const leadSuit = gameState.leadSuit;
    const trumpSuit = gameState.trumpSuit;
    
    const hasLeadSuit = player.hand.some(c => c.suit === leadSuit);
    const hasTrumpSuit = player.hand.some(c => c.suit === trumpSuit);

    if (hasLeadSuit) {
        if (card.suit !== leadSuit) return false;
        
        const leadSuitCards = player.hand.filter(c => c.suit === leadSuit);
        const highestPlayed = Math.max(...gameState.currentTrick
            .filter(tc => tc.card.suit === leadSuit)
            .map(tc => tc.card.value));

        const hasHigher = leadSuitCards.some(c => c.value > highestPlayed);

        if (hasHigher) {
            if (card.value <= highestPlayed) return false;
        }
        
        return true;
    }

    if (hasTrumpSuit) {
        if (card.suit !== trumpSuit) return false;
        return true;
    }

    return true;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
