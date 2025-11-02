const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Spielzustand
let games = new Map();
let players = new Map();
let chatMessages = new Map();

// Spiel-Klasse
class Game {
    constructor() {
        this.id = uuidv4();
        this.board = Array(6).fill().map(() => Array(6).fill(null));
        this.players = {
            white: null,
            black: null
        };
        this.currentPlayer = 'white';
        this.status = 'waiting'; // waiting, playing, finished
        this.winner = null;
        this.winCondition = null;
        this.createdAt = new Date();
    }

    addPlayer(playerId) {
        if (!this.players.white) {
            this.players.white = playerId;
            return 'white';
        } else if (!this.players.black) {
            this.players.black = playerId;
            this.status = 'playing';
            return 'black';
        }
        return null;
    }

    makeMove(playerId, row, col) {
        // Prüfen ob Spiel aktiv ist
        if (this.status !== 'playing') {
            return { success: false, error: 'Spiel ist nicht aktiv' };
        }

        // Prüfen ob Spieler am Zug ist
        const playerColor = this.getPlayerColor(playerId);
        if (playerColor !== this.currentPlayer) {
            return { success: false, error: 'Nicht dein Zug' };
        }

        // Prüfen ob Feld frei ist
        if (this.board[row][col] !== null) {
            return { success: false, error: 'Feld bereits belegt' };
        }

        // Zug durchführen
        this.board[row][col] = this.currentPlayer;

        // Siegbedingungen prüfen
        const winCondition = this.checkWinConditions(this.currentPlayer);
        
        if (winCondition) {
            this.status = 'finished';
            // Erweiterung "Größtes Gebiet"
            // Spezielle Behandlung für größtes Gebiet
            if (winCondition.startsWith('groesstes_gebiet_')) {
                // winner wurde bereits in checkWinConditions gesetzt
                const size = parseInt(winCondition.split('_')[2]);

                return { 
                    success: true, 
                    game: this.getGameState(),
                    gameFinished: true,
                    winner: this.winner,
                    winCondition: winCondition,
                    largestAreaSize: size
                };
            } else {
                // Normale Siegbedingung
                this.winner = this.currentPlayer;
                this.winCondition = winCondition;

                return { 
                    success: true, 
                    game: this.getGameState(),
                    gameFinished: true,
                    winner: this.currentPlayer,
                    winCondition: winCondition
                };
            }
        }

        // Spieler wechseln
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';

        return { 
            success: true, 
            game: this.getGameState(),
            gameFinished: false
        };
    }

    checkWinConditions(playerColor) {
        const board = this.board;
        
        // 1. Prüfe auf 4x4 Rechteck
        //if (this.check4x4Rectangle(playerColor)) {
        //    return '4x4_rechteck';
        //}
        // 1. Prüfe auf 3x3 Rechteck
        //if (this.check3x3Rectangle(playerColor)) {
        //    return '3x3_rechteck';
        //}

        // 1. Prüfe auf 3x2 oder 2x3 Rechteck (GEÄNDERT)
        if (this.check3x2Or2x3Rectangle(playerColor)) {
            return '3x2_rechteck';
        }
        
        // 2. Prüfe auf 5 in einer Reihe
        const fiveInRow = this.checkFiveInRow(playerColor);
        if (fiveInRow.found) {
            return `5_in_reihe_${fiveInRow.direction}`;
        }
        
        // 3. Prüfe auf Regionen-Abdeckung (2x2 Blöcke)
        if (this.checkRegionCoverage(playerColor)) {
            return 'region_abgedeckt';
        }
    
        // Erweiterung "Größtes Gebiet"
        // 4. NEU: Prüfe ob Brett voll ist - dann gewinnt größtes Gebiet
        if (this.isBoardFull()) {
            const largestAreaResult = this.findLargestConnectedArea();
            if (largestAreaResult.winner) {
                this.winner = largestAreaResult.winner;
                this.winCondition = `groesstes_gebiet_${largestAreaResult.size}`;
                return this.winCondition;
            }
        }
        
        return null;
    }

/**
    check4x4Rectangle(playerColor) {
        const board = this.board;
        // Prüfe alle möglichen 4x4 Bereiche (es gibt 3x3 = 9 mögliche 4x4 Bereiche in einem 6x6 Feld)
        for (let startRow = 0; startRow <= 2; startRow++) {
            for (let startCol = 0; startCol <= 2; startCol++) {
                let allSameColor = true;
                
                // Prüfe den 4x4 Bereich
                for (let row = startRow; row < startRow + 4; row++) {
                    for (let col = startCol; col < startCol + 4; col++) {
                        if (board[row][col] !== playerColor) {
                            allSameColor = false;
                            break;
                        }
                    }
                    if (!allSameColor) break;
                }
                
                if (allSameColor) {
                    console.log(`4x4 Rechteck gefunden bei (${startRow},${startCol}) für ${playerColor}`);
                    return true;
                }
            }
        }
        return false;
    }
*/

/**
    check3x3Rectangle(playerColor) {
        const board = this.board;
        // Prüfe alle möglichen 3x3 Bereiche (es gibt 4x4 = 16 mögliche 3x3 Bereiche in einem 6x6 Feld)
        for (let startRow = 0; startRow <= 3; startRow++) {
            for (let startCol = 0; startCol <= 3; startCol++) {
                let allSameColor = true;
                
                // Prüfe den 3x3 Bereich
                for (let row = startRow; row < startRow + 3; row++) {
                    for (let col = startCol; col < startCol + 3; col++) {
                        if (board[row][col] !== playerColor) {
                            allSameColor = false;
                            break;
                        }
                    }
                    if (!allSameColor) break;
                }
                
                if (allSameColor) {
                    console.log(`3x3 Rechteck gefunden bei (${startRow},${startCol}) für ${playerColor}`);
                    return true;
                }
            }
        }
        return false;
    }
*/

    // 1. Prüfe auf 3x2 oder 2x3 Rechteck
    check3x2Or2x3Rectangle(playerColor) {
        const board = this.board;
    
        // Prüfe 3x2 Rechtecke (horizontal)
        for (let startRow = 0; startRow <= 3; startRow++) {      // 4 mögliche Startreihen für 3 Zeilen
            for (let startCol = 0; startCol <= 4; startCol++) {  // 5 mögliche Startspalten für 2 Spalten
                let allSameColor = true;
            
                // Prüfe den 3x2 Bereich
                for (let row = startRow; row < startRow + 3; row++) {
                    for (let col = startCol; col < startCol + 2; col++) {
                        if (board[row][col] !== playerColor) {
                            allSameColor = false;
                            break;
                        }
                    }
                    if (!allSameColor) break;
                }
            
                if (allSameColor) {
                    console.log(`3x2 Rechteck gefunden bei (${startRow},${startCol}) für ${playerColor}`);
                    return true;
                }
            }
        }
    
        // Prüfe 2x3 Rechtecke (vertikal)
        for (let startRow = 0; startRow <= 4; startRow++) {      // 5 mögliche Startreihen für 2 Zeilen
            for (let startCol = 0; startCol <= 3; startCol++) {  // 4 mögliche Startspalten für 3 Spalten
                let allSameColor = true;
            
                // Prüfe den 2x3 Bereich
                for (let row = startRow; row < startRow + 2; row++) {
                    for (let col = startCol; col < startCol + 3; col++) {
                        if (board[row][col] !== playerColor) {
                            allSameColor = false;
                            break;
                        }
                    }
                    if (!allSameColor) break;
                }
            
                if (allSameColor) {
                    console.log(`2x3 Rechteck gefunden bei (${startRow},${startCol}) für ${playerColor}`);
                    return true;
                }
            }
        }
    
        return false;
    }

    // 2. Prüfe auf 5 in einer Reihe
    checkFiveInRow(playerColor) {
        const board = this.board;
        // Richtungen: horizontal, vertikal, diagonal rechts, diagonal links
        const directions = [
            { dr: 0, dc: 1, name: 'horizontal' },    // horizontal
            { dr: 1, dc: 0, name: 'vertikal' },      // vertikal
            { dr: 1, dc: 1, name: 'diagonal_rechts' }, // diagonal ↘
            { dr: 1, dc: -1, name: 'diagonal_links' }  // diagonal ↙
        ];
        
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 6; col++) {
                if (board[row][col] === playerColor) {
                    for (const dir of directions) {
                        let count = 1;
                        let r = row + dir.dr;
                        let c = col + dir.dc;
                        
                        // Zähle in dieser Richtung
                        while (r >= 0 && r < 6 && c >= 0 && c < 6 && board[r][c] === playerColor) {
                            count++;
                            r += dir.dr;
                            c += dir.dc;
                        }
                        
                        if (count >= 5) {
                            console.log(`5 in Reihe gefunden: ${dir.name} bei (${row},${col}) für ${playerColor}`);
                            return { found: true, direction: dir.name };
                        }
                    }
                }
            }
        }
        return { found: false };
    }

    // 3. Prüfe auf Regionen-Abdeckung (2x2 Blöcke)
    checkRegionCoverage(playerColor) {
        const board = this.board;
        // Definiere Regionen als 2x2 Blöcke
        const regions = [
            // Obere linke Regionen
            { rows: [0, 1], cols: [0, 1] },
            { rows: [0, 1], cols: [2, 3] },
            { rows: [0, 1], cols: [4, 5] },
            
            // Mittlere Regionen
            { rows: [2, 3], cols: [0, 1] },
            { rows: [2, 3], cols: [2, 3] },
            { rows: [2, 3], cols: [4, 5] },
            
            // Untere Regionen
            { rows: [4, 5], cols: [0, 1] },
            { rows: [4, 5], cols: [2, 3] },
            { rows: [4, 5], cols: [4, 5] }
        ];
        
        // Zähle wie viele Regionen komplett mit der Farbe gefüllt sind
        let coveredRegions = 0;
        
        for (const region of regions) {
            let regionComplete = true;
            
            for (const row of region.rows) {
                for (const col of region.cols) {
                    if (board[row][col] !== playerColor) {
                        regionComplete = false;
                        break;
                    }
                }
                if (!regionComplete) break;
            }
            
            if (regionComplete) {
                coveredRegions++;
                console.log(`Region abgedeckt: Zeilen ${region.rows}, Spalten ${region.cols} für ${playerColor}`);
            }
        }
        
        // Gewinn, wenn mindestens 3 Regionen komplett abgedeckt sind
        // GEÄNDERT: Gewinn, wenn mindestens 2 Regionen komplett abgedeckt sind (vorher 3)
        const win = coveredRegions >= 2;
        if (win) {
            console.log(`${coveredRegions} Regionen abgedeckt für ${playerColor} - SIEG!`);
        }
        return win;
    }

    // Erweiterung "Größtes Gebiet"
    // 4. Findet das größte zusammenhängende Gebiet
    findLargestConnectedArea() {
        const board = this.board;
        const visited = Array(6).fill().map(() => Array(6).fill(false));
        let whiteAreas = [];
        let blackAreas = [];

        // Durchlaufe alle Felder
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 6; col++) {
                if (!visited[row][col]) {
                    const color = board[row][col];
                    if (color) {
                        const area = this.floodFill(row, col, color, visited, []);

                        if (color === 'white') {
                            whiteAreas.push(area);
                        } else {
                            blackAreas.push(area);
                        }
                    }
                }
            }
        }

        // Finde größtes Gebiet für jede Farbe
        const largestWhite = whiteAreas.length > 0 ? 
            Math.max(...whiteAreas.map(area => area.size)) : 0;
        const largestBlack = blackAreas.length > 0 ? 
            Math.max(...blackAreas.map(area => area.size)) : 0;

        console.log(`Größte Gebiete - Weiß: ${largestWhite}, Schwarz: ${largestBlack}`);
    
        // Bestimme Gewinner
        if (largestWhite > largestBlack) {
            return { winner: 'white', size: largestWhite };
        } else if (largestBlack > largestWhite) {
            return { winner: 'black', size: largestBlack };
        } else {
            // Unentschieden bei gleicher Größe
            return { winner: 'draw', size: largestWhite };
        }
    }

    // NEUE METHODE: Flood-Fill Algorithmus für zusammenhängende Gebiete
    floodFill(startRow, startCol, targetColor, visited, currentArea) {
        const directions = [
            { dr: -1, dc: 0 },  // oben
            { dr: 1, dc: 0 },   // unten
            { dr: 0, dc: -1 },  // links
            { dr: 0, dc: 1 }    // rechts
        ];

        const stack = [{ row: startRow, col: startCol }];
        let size = 0;
        const cells = [];
    
        while (stack.length > 0) {
            const { row, col } = stack.pop();
 
            // Prüfe Grenzen und ob bereits besucht
            if (row < 0 || row >= 6 || col < 0 || col >= 6) continue;
            if (visited[row][col]) continue;
            if (this.board[row][col] !== targetColor) continue;

            // Markiere als besucht und zähle
            visited[row][col] = true;
            size++;
            cells.push({ row, col });

            // Füge Nachbarfelder zum Stack hinzu
            for (const dir of directions) {
                stack.push({
                    row: row + dir.dr,
                    col: col + dir.dc
                });
            }
        }

        return { size, cells };
    }

    isBoardFull() {
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 6; col++) {
                if (this.board[row][col] === null) {
                    return false;
                }
            }
        }
        console.log('Brett komplett gefüllt - prüfe größtes Gebiet...');
        return true;
    }

    getPlayerColor(playerId) {
        if (this.players.white === playerId) return 'white';
        if (this.players.black === playerId) return 'black';
        return null;
    }

    getGameState() {
        return {
            id: this.id,
            board: this.board,
            currentPlayer: this.currentPlayer,
            status: this.status,
            players: this.players,
            winner: this.winner,
            winCondition: this.winCondition || null,
            createdAt: this.createdAt
        };
    }

    isPlayerInGame(playerId) {
        return this.players.white === playerId || this.players.black === playerId;
    }

    removePlayer(playerId) {
        if (this.players.white === playerId) {
            this.players.white = null;
        } else if (this.players.black === playerId) {
            this.players.black = null;
        }
        
        // Wenn ein Spieler das Spiel verlässt und das Spiel läuft, beende es
        if (this.status === 'playing') {
            this.status = 'finished';
            this.winner = this.players.white ? 'black' : 'white';
            this.winCondition = 'spieler_verlassen';
        }
    }

    // Chat Methoden:
    addChatMessage(playerId, message) {
        if (!this.isPlayerInGame(playerId)) {
            return { success: false, error: 'Spieler nicht im Spiel' };
        }
    
        const player = Array.from(players.values()).find(p => p.id === playerId);
        const chatMessage = {
            id: uuidv4(),
            playerId: playerId,
            playerName: player.name,
            playerColor: player.color,
            message: message,
            timestamp: new Date()
        };
    
        if (!chatMessages.has(this.id)) {
            chatMessages.set(this.id, []);
        }
    
        const messages = chatMessages.get(this.id);
        messages.push(chatMessage);
    
        // Behalte nur die letzten 50 Nachrichten
        if (messages.length > 50) {
            messages.shift();
        }
    
        console.log(`Chat in Spiel ${this.id}: ${player.name} (${player.color}): ${message}`);
    
        return { success: true, message: chatMessage };
    }

    getChatMessages() {
        return chatMessages.get(this.id) || [];
    }
}

// REST-API Endpoints

// Neue Spielsession erstellen
app.post('/api/games', (req, res) => {
    console.log(`   POST /api/games               - Neues Spiel erstellen`);
    const game = new Game();
    games.set(game.id, game);
    
    console.log(`Neues Spiel erstellt: ${game.id}`);
    
    res.json({ 
        success: true, 
        gameId: game.id,
        message: 'Neues Spiel erstellt'
    });
});

// Spiel beitreten
app.post('/api/games/:gameId/join', (req, res) => {
    console.log(`   POST /api/games/:gameId/join  - Spiel beitreten`);
    const { gameId } = req.params;
    const { playerName } = req.body;

    if (!games.has(gameId)) {
        return res.status(404).json({ success: false, error: 'Spiel nicht gefunden' });
    }

    const game = games.get(gameId);
    
    if (game.status === 'finished') {
        return res.status(400).json({ success: false, error: 'Spiel ist bereits beendet' });
    }

    const playerId = uuidv4();
    const color = game.addPlayer(playerId);

    if (!color) {
        return res.status(400).json({ success: false, error: 'Spiel ist bereits voll' });
    }

    players.set(playerId, {
        id: playerId,
        name: playerName || `Spieler_${color}`,
        color: color,
        gameId: gameId
    });

    console.log(`Spieler ${playerName} (${playerId}) ist Spiel ${gameId} als ${color} beigetreten`);

    res.json({
        success: true,
        playerId: playerId,
        color: color,
        gameState: game.getGameState()
    });
});

// Zug machen
app.post('/api/games/:gameId/move', (req, res) => {
    console.log(`   POST /api/games/:gameId/move  - Zug machen`);
    const { gameId } = req.params;
    const { playerId, row, col } = req.body;

    if (!games.has(gameId)) {
        return res.status(404).json({ success: false, error: 'Spiel nicht gefunden' });
    }

    if (!players.has(playerId)) {
        return res.status(404).json({ success: false, error: 'Spieler nicht gefunden' });
    }

    const game = games.get(gameId);
    const player = players.get(playerId);

    if (!game.isPlayerInGame(playerId)) {
        return res.status(403).json({ success: false, error: 'Spieler ist nicht in diesem Spiel' });
    }

    // Validierung der Koordinaten
    if (row < 0 || row > 5 || col < 0 || col > 5) {
        return res.status(400).json({ success: false, error: 'Ungültige Koordinaten' });
    }

    const result = game.makeMove(playerId, parseInt(row), parseInt(col));

    if (result.success) {
        console.log(`Zug in Spiel ${gameId}: ${player.color} setzt auf (${row},${col})`);
        if (result.gameFinished) {
            console.log(`Spiel ${gameId} beendet! Gewinner: ${result.winner}, Grund: ${result.winCondition}`);
        }
        res.json(result);
    } else {
        console.log(`Ungültiger Zug in Spiel ${gameId}: ${result.error}`);
        res.status(400).json(result);
    }
});

// Spielstatus abfragen
app.get('/api/games/:gameId', (req, res) => {
    // wird permant gepollt
    //console.log(`   GET  /api/games/:gameId       - Spielstatus abfragen`);
    const { gameId } = req.params;

    if (!games.has(gameId)) {
        return res.status(404).json({ success: false, error: 'Spiel nicht gefunden' });
    }

    const game = games.get(gameId);
    res.json({
        success: true,
        game: game.getGameState()
    });
});

// Aktive Spiele auflisten
app.get('/api/games', (req, res) => {
    console.log(`   GET  /api/games               - Aktive Spiele auflisten`);
    const activeGames = Array.from(games.values())
        .filter(game => game.status === 'waiting' || game.status === 'playing')
        .map(game => ({
            id: game.id,
            status: game.status,
            players: game.players,
            currentPlayer: game.currentPlayer,
            createdAt: game.createdAt
        }));

    res.json({
        success: true,
        games: activeGames
    });
});

// Spielerinformationen abrufen
app.get('/api/players/:playerId', (req, res) => {
    console.log(`   GET  /api/players/:playerId   - Spielerinformationen abrufen`);
    const { playerId } = req.params;

    if (!players.has(playerId)) {
        return res.status(404).json({ success: false, error: 'Spieler nicht gefunden' });
    }

    const player = players.get(playerId);
    res.json({
        success: true,
        player: player
    });
});

// Spiel verlassen
app.post('/api/games/:gameId/leave', (req, res) => {
    console.log(`   POST /api/games/:gameId/leave - Spiel verlassen`);
    const { gameId } = req.params;
    const { playerId } = req.body;

    if (!games.has(gameId)) {
        return res.status(404).json({ success: false, error: 'Spiel nicht gefunden' });
    }

    if (!players.has(playerId)) {
        return res.status(404).json({ success: false, error: 'Spieler nicht gefunden' });
    }

    const game = games.get(gameId);
    const player = players.get(playerId);

    if (!game.isPlayerInGame(playerId)) {
        return res.status(403).json({ success: false, error: 'Spieler ist nicht in diesem Spiel' });
    }

    game.removePlayer(playerId);
    players.delete(playerId);

    console.log(`Spieler ${playerId} hat Spiel ${gameId} verlassen`);

    res.json({
        success: true,
        message: 'Spiel erfolgreich verlassen'
    });
});

// Chat-Nachricht senden
app.post('/api/games/:gameId/chat', (req, res) => {
    console.log(`   POST /api/games/:gameId/chat  - Chat-Nachricht senden`);
    const { gameId } = req.params;
    const { playerId, message } = req.body;

    if (!games.has(gameId)) {
        return res.status(404).json({ success: false, error: 'Spiel nicht gefunden' });
    }

    if (!players.has(playerId)) {
        return res.status(404).json({ success: false, error: 'Spieler nicht gefunden' });
    }

    const game = games.get(gameId);
    
    if (!game.isPlayerInGame(playerId)) {
        return res.status(403).json({ success: false, error: 'Spieler ist nicht in diesem Spiel' });
    }

    // Validierung der Nachricht
    if (!message || message.trim() === '') {
        return res.status(400).json({ success: false, error: 'Nachricht darf nicht leer sein' });
    }

    if (message.length > 500) {
        return res.status(400).json({ success: false, error: 'Nachricht zu lang (max. 500 Zeichen)' });
    }

    const result = game.addChatMessage(playerId, message.trim());

    if (result.success) {
        res.json(result);
    } else {
        res.status(400).json(result);
    }
});

// Chat-Verlauf abrufen
app.get('/api/games/:gameId/chat', (req, res) => {
    // wird permant gepollt
    //console.log(`   GET  /api/games/:gameId/chat  - Chat-Verlauf abrufen`);
    const { gameId } = req.params;

    if (!games.has(gameId)) {
        return res.status(404).json({ success: false, error: 'Spiel nicht gefunden' });
    }

    const game = games.get(gameId);
    const messages = game.getChatMessages();

    res.json({
        success: true,
        messages: messages
    });
});


// Alte Spiele aufräumen (älter als 24 Stunden)
// Beim Aufräumen alter Spiele auch Chat-Nachrichten löschen
function cleanupOldGames() {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    
    let cleanedCount = 0;
    
    for (const [gameId, game] of games.entries()) {
        if (game.createdAt < twentyFourHoursAgo || game.status === 'finished') {
            // Spieler dieses Spiels ebenfalls entfernen
            for (const [playerId, player] of players.entries()) {
                if (player.gameId === gameId) {
                    players.delete(playerId);
                }
            }
            // Chat-Nachrichten löschen
            chatMessages.delete(gameId);
            games.delete(gameId);
            cleanedCount++;
        }
    }
    
    if (cleanedCount > 0) {
        console.log(`${cleanedCount} alte Spiele aufgeräumt`);
    }
}

// Aufräumen alle Stunde
setInterval(cleanupOldGames, 60 * 60 * 1000);

// Server-Status abfragen
app.get('/api/status', (req, res) => {
    console.log(`   GET  /api/status              - Server-Status`);
    const activeGamesCount = Array.from(games.values())
        .filter(game => game.status === 'waiting' || game.status === 'playing').length;
    
    const totalPlayers = players.size;
    
    res.json({
        success: true,
        status: {
            activeGames: activeGamesCount,
            totalPlayers: totalPlayers,
            totalGames: games.size,
            serverUptime: process.uptime()
        }
    });
});

// Client ausliefern
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Fallback für unbekannte Routes
app.get('*', (req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint nicht gefunden' });
});

// Error Handling Middleware
app.use((error, req, res, next) => {
    console.error('Server Error:', error);
    res.status(500).json({ 
        success: false, 
        error: 'Interner Serverfehler' 
    });
});

// Server starten
app.listen(PORT, () => {
    console.log(`🎮 Brettspiel Server mit Siegbedingungen läuft auf http://localhost:${PORT}`);
    console.log(`📊 Verfügbare Endpoints:`);
    console.log(`   POST /api/games               - Neues Spiel erstellen`);
    console.log(`   POST /api/games/:gameId/join  - Spiel beitreten`);
    console.log(`   POST /api/games/:gameId/move  - Zug machen`);
    console.log(`   GET  /api/games/:gameId       - Spielstatus abfragen`);
    console.log(`   GET  /api/games               - Aktive Spiele auflisten`);
    console.log(`   GET  /api/players/:playerId   - Spielerinformationen abrufen`);
    console.log(`   POST /api/games/:gameId/leave - Spiel verlassen`);
    console.log(`   POST /api/games/:gameId/chat  - Chat-Nachricht senden`);
    console.log(`   GET  /api/games/:gameId/chat  - Chat-Verlauf abrufen`);
    console.log(`   GET  /api/status              - Server-Status`);
});

// Graceful Shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Server wird heruntergefahren...');
    console.log(`📊 Statistik: ${games.size} Spiele, ${players.size} Spieler`);
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Server wird heruntergefahren...');
    process.exit(0);
});