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


// KI-Klasse für den Computer-Gegner
class ComputerPlayer {
    constructor(difficulty = 'medium') {
        this.difficulty = difficulty;
        this.name = `KI-${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`;
        // für Trace
        this.minMaxCount = 0;  // globaler Zähler

    }

    // Hauptmethode für KI-Zug
    makeMove(board, playerColor) {
        console.log(`KaI (${this.difficulty}) denkt nach...`);
        
        switch (this.difficulty) {
            case 'easy':
                return this.makeEasyMove(board);
            case 'medium':
                return this.makeMediumMove(board, playerColor);
            case 'hard':
                return this.makeHardMove(board, playerColor);
            default:
                return this.makeMediumMove(board, playerColor);
        }
    }

    // Einfacher KI-Zug: Zufällige valide Position
    makeEasyMove(board) {
        const validMoves = this.getValidMoves(board);
        return validMoves[Math.floor(Math.random() * validMoves.length)];
    }

    // Mittlerer KI-Zug: Strategische Entscheidungen
    makeMediumMove(board, playerColor) {
        const validMoves = this.getValidMoves(board);
        
        // 1. Prüfe auf sofortigen Sieg
        const winningMove = this.findWinningMove(board, playerColor, validMoves);
        if (winningMove) return winningMove;
        
        // 2. Blockiere gegnerischen Sieg
        const opponentColor = playerColor === 'white' ? 'black' : 'white';
        const blockingMove = this.findWinningMove(board, opponentColor, validMoves);
        if (blockingMove) return blockingMove;
        
        // 3. Strategische Position wählen
        const strategicMove = this.findStrategicMove(board, playerColor, validMoves);
        if (strategicMove) return strategicMove;
        
        // 4. Fallback: Zufälliger Zug
        return validMoves[Math.floor(Math.random() * validMoves.length)];
    }

    // Schwerer KI-Zug: Minimax-Algorithmus
    makeHardMove(board, playerColor) {
        const validMoves = this.getValidMoves(board);
        
        // Für die ersten paar Züge verwende mittlere Strategie (Performance)
        //if (this.countPieces(board) < 4) {
        //    return this.makeMediumMove(board, playerColor);
        //}

        // 1. Prüfe auf sofortigen Sieg
        const winningMove = this.findWinningMove(board, playerColor, validMoves);
        if (winningMove) return winningMove;
        
        // 2. Blockiere gegnerischen Sieg
        const opponentColor = playerColor === 'white' ? 'black' : 'white';
        const blockingMove = this.findWinningMove(board, opponentColor, validMoves);
        if (blockingMove) return blockingMove;
        
        // 3. Verwende Minimax mit begrenzter Tiefe
        let bestScore = -Infinity;
        let bestMove = validMoves[0];
        
        this.minMaxCount = 0;  // normiere Zähler
        for (const move of validMoves) {
            // Simuliere Zug
            const newBoard = this.cloneBoard(board);
            newBoard[move.row][move.col] = playerColor;
            
            // Bewertung mit Minimax
            const score = this.minimax(newBoard, 2, false, playerColor);
            
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        console.log('makeHardMove:', {
                minMaxCount: this.minMaxCount,
                bestScore: bestScore,
                bestMove: bestMove
        });
        
        return bestMove;
    }

    // Minimax-Algorithmus mit Alpha-Beta-Pruning
    minimax(board, depth, isMaximizing, playerColor, alpha = -Infinity, beta = Infinity) {
        const opponentColor = playerColor === 'white' ? 'black' : 'white';
        const currentColor = isMaximizing ? playerColor : opponentColor;

        this.minMaxCount = this.minMaxCount + 1;  // globalen Zähler inkrementieren
        
        // Blattevaluation oder maximale Tiefe erreicht
        if (depth === 0 || this.isBoardFull(board)) {
            // too much logging
            //console.log('minimax:', { depth: depth, isBoardFull: this.isBoardFull(board) });
            return this.evaluateBoard(board, playerColor);
        }
        
        const validMoves = this.getValidMoves(board);
        
        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const move of validMoves) {
                const newBoard = this.cloneBoard(board);
                newBoard[move.row][move.col] = playerColor;
                
                const evaluation = this.minimax(newBoard, depth - 1, false, playerColor, alpha, beta);
                maxEval = Math.max(maxEval, evaluation);
                alpha = Math.max(alpha, evaluation);
                
                if (beta <= alpha) break; // Alpha-Beta Pruning
            }
            // too much logging
            //console.log('minimax:', { maxEval: maxEval, alpha: alpha, beta: beta });
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const move of validMoves) {
                const newBoard = this.cloneBoard(board);
                newBoard[move.row][move.col] = opponentColor;
                
                const evaluation = this.minimax(newBoard, depth - 1, true, playerColor, alpha, beta);
                minEval = Math.min(minEval, evaluation);
                beta = Math.min(beta, evaluation);
                
                if (beta <= alpha) break; // Alpha-Beta Pruning
            }
            // too much logging
            //console.log('minimax:', { minEval: minEval, alpha: alpha, beta: beta });
            return minEval;
        }
    }

    // Bewertungsfunktion für das Brett
    evaluateBoard(board, playerColor) {
        const opponentColor = playerColor === 'white' ? 'black' : 'white';
        let score = 0;
        
        // Bewerte nach verschiedenen Kriterien
        score += this.evaluateConnectedAreas(board, playerColor) * 10;
        score -= this.evaluateConnectedAreas(board, opponentColor) * 10;
        score += this.evaluatePotentialWins(board, playerColor) * 5;
        score -= this.evaluatePotentialWins(board, opponentColor) * 5;
        score += this.evaluateCenterControl(board, playerColor) * 2;
        
        return score;
    }

    // Bewertung von zusammenhängenden Gebieten
    evaluateConnectedAreas(board, color) {
        const visited = Array(6).fill().map(() => Array(6).fill(false));
        let totalAreaSize = 0;
        let largestArea = 0;
        
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 6; col++) {
                if (!visited[row][col] && board[row][col] === color) {
                    const area = this.floodFillArea(board, row, col, color, visited);
                    totalAreaSize += area.size;
                    largestArea = Math.max(largestArea, area.size);
                }
            }
        }
        
        return largestArea + (totalAreaSize * 0.1);
    }

    // Bewertung von potenziellen Siegmöglichkeiten
    evaluatePotentialWins(board, color) {
        let potential = 0;
        
        // Prüfe fast-vollständige 3x2/2x3 Rechtecke
        potential += this.countAlmostCompleteRectangles(board, color) * 3;
        
        // Prüfe fast-vollständige Regionen
        potential += this.countAlmostCompleteRegions(board, color) * 2;
        
        // Prüfe fast-5er Reihen
        potential += this.countAlmostFiveInRow(board, color) * 4;
        
        return potential;
    }

    // Zähle fast-vollständige Rechtecke
    countAlmostCompleteRectangles(board, color) {
        let count = 0;
        
        // Prüfe 3x2 Rechtecke
        for (let startRow = 0; startRow <= 3; startRow++) {
            for (let startCol = 0; startCol <= 4; startCol++) {
                let sameColor = 0;
                let empty = 0;
                
                for (let row = startRow; row < startRow + 3; row++) {
                    for (let col = startCol; col < startCol + 2; col++) {
                        if (board[row][col] === color) sameColor++;
                        else if (board[row][col] === null) empty++;
                    }
                }
                
                if (sameColor === 5 && empty === 1) count++;
            }
        }
        
        // Prüfe 2x3 Rechtecke
        for (let startRow = 0; startRow <= 4; startRow++) {
            for (let startCol = 0; startCol <= 3; startCol++) {
                let sameColor = 0;
                let empty = 0;
                
                for (let row = startRow; row < startRow + 2; row++) {
                    for (let col = startCol; col < startCol + 3; col++) {
                        if (board[row][col] === color) sameColor++;
                        else if (board[row][col] === null) empty++;
                    }
                }
                
                if (sameColor === 5 && empty === 1) count++;
            }
        }
        
        return count;
    }

    // Zähle fast-vollständige Regionen
    countAlmostCompleteRegions(board, color) {
        const regions = [
            { rows: [0, 1], cols: [0, 1] }, { rows: [0, 1], cols: [2, 3] }, { rows: [0, 1], cols: [4, 5] },
            { rows: [2, 3], cols: [0, 1] }, { rows: [2, 3], cols: [2, 3] }, { rows: [2, 3], cols: [4, 5] },
            { rows: [4, 5], cols: [0, 1] }, { rows: [4, 5], cols: [2, 3] }, { rows: [4, 5], cols: [4, 5] }
        ];
        
        let count = 0;
        
        for (const region of regions) {
            let sameColor = 0;
            let empty = 0;
            
            for (const row of region.rows) {
                for (const col of region.cols) {
                    if (board[row][col] === color) sameColor++;
                    else if (board[row][col] === null) empty++;
                }
            }
            
            if (sameColor === 3 && empty === 1) count++;
        }
        
        return count;
    }

    // Zähle fast-5er Reihen
    countAlmostFiveInRow(board, color) {
        const directions = [
            { dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: -1 }
        ];
        
        let count = 0;
        
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 6; col++) {
                for (const dir of directions) {
                    let sequence = [];
                    let r = row, c = col;
                    
                    // Sammle Sequenz
                    while (r >= 0 && r < 6 && c >= 0 && c < 6 && sequence.length < 5) {
                        sequence.push({ row: r, col: c, value: board[r][c] });
                        r += dir.dr;
                        c += dir.dc;
                    }
                    
                    if (sequence.length === 5) {
                        const colorCount = sequence.filter(cell => cell.value === color).length;
                        const emptyCount = sequence.filter(cell => cell.value === null).length;
                        
                        if (colorCount === 4 && emptyCount === 1) {
                            count++;
                        }
                    }
                }
            }
        }
        
        return count;
    }

    // Bewertung der Zentrumskontrolle
    evaluateCenterControl(board, color) {
        const centerPositions = [
            { row: 2, col: 2 }, { row: 2, col: 3 },
            { row: 3, col: 2 }, { row: 3, col: 3 }
        ];
        
        let centerControl = 0;
        
        for (const pos of centerPositions) {
            if (board[pos.row][pos.col] === color) {
                centerControl += 2;
            } else if (board[pos.row][pos.col] === null) {
                centerControl += 0.5; // Potenzielle Kontrolle
            }
        }
        
        return centerControl;
    }

    // Hilfsmethoden
    getValidMoves(board) {
        const moves = [];
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 6; col++) {
                if (board[row][col] === null) {
                    moves.push({ row, col });
                }
            }
        }
        return moves;
    }

    findWinningMove(board, color, validMoves) {
        for (const move of validMoves) {
            const testBoard = this.cloneBoard(board);
            testBoard[move.row][move.col] = color;
            
            if (this.checkWinForColor(testBoard, color)) {
                return move;
            }
        }
        return null;
    }

    findStrategicMove(board, color, validMoves) {
        // Bevorzuge Zentrum und Eckpositionen
        const centerPositions = [
            { row: 2, col: 2 }, { row: 2, col: 3 }, { row: 3, col: 2 }, { row: 3, col: 3 }
        ];
        
        const cornerPositions = [
            { row: 0, col: 0 }, { row: 0, col: 5 }, { row: 5, col: 0 }, { row: 5, col: 5 }
        ];
        
        // Prüfe zuerst Zentrum
        for (const pos of centerPositions) {
            if (board[pos.row][pos.col] === null) {
                return pos;
            }
        }
        
        // Dann Ecken
        for (const pos of cornerPositions) {
            if (board[pos.row][pos.col] === null) {
                return pos;
            }
        }
        
        // Dann andere Positionen
        return null;
    }

    checkWinForColor(board, color) {
        // Vereinfachte Win-Condition Prüfung
        return this.check3x2Or2x3ForColor(board, color) || 
               this.checkFiveInRowForColor(board, color) ||
               this.checkRegionCoverageForColor(board, color);
    }

    check3x2Or2x3ForColor(board, color) {
        // Implementierung ähnlich wie in Game-Klasse
        for (let startRow = 0; startRow <= 3; startRow++) {
            for (let startCol = 0; startCol <= 4; startCol++) {
                let allSameColor = true;
                for (let row = startRow; row < startRow + 3; row++) {
                    for (let col = startCol; col < startCol + 2; col++) {
                        if (board[row][col] !== color) {
                            allSameColor = false;
                            break;
                        }
                    }
                    if (!allSameColor) break;
                }
                if (allSameColor) return true;
            }
        }
        
        for (let startRow = 0; startRow <= 4; startRow++) {
            for (let startCol = 0; startCol <= 3; startCol++) {
                let allSameColor = true;
                for (let row = startRow; row < startRow + 2; row++) {
                    for (let col = startCol; col < startCol + 3; col++) {
                        if (board[row][col] !== color) {
                            allSameColor = false;
                            break;
                        }
                    }
                    if (!allSameColor) break;
                }
                if (allSameColor) return true;
            }
        }
        
        return false;
    }

    checkFiveInRowForColor(board, color) {
        const directions = [
            { dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: -1 }
        ];
        
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 6; col++) {
                if (board[row][col] === color) {
                    for (const dir of directions) {
                        let count = 1;
                        let r = row + dir.dr, c = col + dir.dc;
                        
                        while (r >= 0 && r < 6 && c >= 0 && c < 6 && board[r][c] === color) {
                            count++;
                            r += dir.dr;
                            c += dir.dc;
                        }
                        
                        if (count >= 5) return true;
                    }
                }
            }
        }
        return false;
    }

    checkRegionCoverageForColor(board, color) {
        const regions = [
            { rows: [0, 1], cols: [0, 1] }, { rows: [0, 1], cols: [2, 3] }, { rows: [0, 1], cols: [4, 5] },
            { rows: [2, 3], cols: [0, 1] }, { rows: [2, 3], cols: [2, 3] }, { rows: [2, 3], cols: [4, 5] },
            { rows: [4, 5], cols: [0, 1] }, { rows: [4, 5], cols: [2, 3] }, { rows: [4, 5], cols: [4, 5] }
        ];
        
        let coveredRegions = 0;
        
        for (const region of regions) {
            let regionComplete = true;
            for (const row of region.rows) {
                for (const col of region.cols) {
                    if (board[row][col] !== color) {
                        regionComplete = false;
                        break;
                    }
                }
                if (!regionComplete) break;
            }
            if (regionComplete) coveredRegions++;
        }
        
        return coveredRegions >= 2;
    }

    floodFillArea(board, startRow, startCol, targetColor, visited) {
        const directions = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];
        const stack = [{ row: startRow, col: startCol }];
        let size = 0;
        const cells = [];
        
        while (stack.length > 0) {
            const { row, col } = stack.pop();
            
            if (row < 0 || row >= 6 || col < 0 || col >= 6) continue;
            if (visited[row][col]) continue;
            if (board[row][col] !== targetColor) continue;
            
            visited[row][col] = true;
            size++;
            cells.push({ row, col });
            
            for (const dir of directions) {
                stack.push({ row: row + dir.dr, col: col + dir.dc });
            }
        }
        
        return { size, cells };
    }

    cloneBoard(board) {
        return board.map(row => [...row]);
    }

    countPieces(board) {
        let count = 0;
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 6; col++) {
                if (board[row][col] !== null) count++;
            }
        }
        return count;
    }

    isBoardFull(board) {
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 6; col++) {
                if (board[row][col] === null) return false;
            }
        }
        return true;
    }
}   // Ende KI-Klasse für den Computer-Gegner (ComputerPlayer)




// Spiel-Klasse
class Game {
    constructor() {
        this.id = uuidv4();
        this.board = Array(6).fill().map(() => Array(6).fill(null));
        this.players = {
            white: null,
            black: null
        };
        this.currentPlayer = 'white'; // Weiß beginnt immer
        this.status = 'waiting'; // waiting, playing, finished
        this.winner = null;
        this.winCondition = null;
        this.createdAt = new Date();
        this.computerPlayer = null;    // singleplayer: KI-Spieler
        this.gameMode = 'multiplayer'; // singleplayer: 'multiplayer' oder 'singleplayer'
    }

    // singleplayer: Spielmodus setzen
    //setGameMode(mode, difficulty = 'medium') {
    setGameMode(mode, difficulty) {
        this.gameMode = mode;
        if (mode === 'singleplayer') {
            this.computerPlayer = new ComputerPlayer(difficulty);
        } else {  // Korrektur
            this.computerPlayer = null;
            this.gameMode = 'multiplayer';
        }
    }

    // singleplayer: KI-Zug ausführen
    makeComputerMove() {
        if (!this.computerPlayer || this.status !== 'playing') {
            return null;
        }

        const move = this.computerPlayer.makeMove(this.board, this.currentPlayer);
        
        if (move) {
            console.log(`KaI setzt auf Position (${move.row}, ${move.col})`);
            return this.makeMove('computer', move.row, move.col);
        }
        
        return null;
    }

    // Geänderte addPlayer Methode für Einzelspieler
    addPlayer(playerId, isSinglePlayer = false) {
        if (!this.players.white) {
            this.players.white = playerId;
            
            // Bei Einzelspieler: KI als schwarzen Spieler hinzufügen
            if (isSinglePlayer) {
                this.players.black = 'computer';
                this.status = 'playing';
                //this.setGameMode('singleplayer', 'medium');
                this.setGameMode('singleplayer', null);
                console.log(`Einzelspieler-Spiel gestartet: Mensch (${playerId}) vs KaI`);
            }
            
            return 'white';
        } else if (!this.players.black && !isSinglePlayer) {
            this.players.black = playerId;
            this.status = 'playing';
            this.setGameMode('multiplayer', null);
            this.gameMode = 'multiplayer';
            console.log(`Multiplayer-Spiel gestartet: (${this.players.white}) vs (${playerId})`);
            return 'black';
        }
        return null;
    }


    // Korrektur: Spezielle Methode für Einzelspieler-Beitritt
    // Vereinfachte Methode nur für Einzelspieler
    addSinglePlayer(playerId, difficulty) {
/*
        if (!this.players.white) {
            this.players.white = playerId;
            this.players.black = 'computer';
            this.status = 'playing';  // Direkt starten!
            this.setGameMode('singleplayer', difficulty);
            console.log(`Einzelspieler-Spiel gestartet: Mensch (${playerId}) vs KI (${difficulty})`);
            return 'white';
        }
        return null;
*/
        // Setze beide Spieler gleichzeitig
        this.players.white = playerId;
        this.players.black = 'computer';
        this.status = 'playing'; // SOFORT starten!
        this.setGameMode('singleplayer', difficulty);
        
        console.log(`Einzelspieler-Spiel ${this.id} gestartet:`);
        console.log(`- Mensch: ${playerId} (weiß)`);
        console.log(`- KaI: computer (schwarz, ${difficulty})`);
        console.log(`- Status: ${this.status}`);
        console.log(`- Startspieler: weiß`); // ${this.currentPlayer}
        
        return 'white'; // Mensch spielt immer weiß
    }


    // Geänderte makeMove Methode für KI
    makeMove(playerId, row, col) {
        console.log(`   makeMove - (${row},${col}): `, this.status);
        // Prüfen ob Spiel aktiv ist
        if (this.status !== 'playing') {
            return { success: false, error: 'Spiel ist nicht aktiv' };
        }

        // Prüfen ob Spieler am Zug ist
        // Bei KI-Zug playerId ignorieren
        const isComputerMove = playerId === 'computer';
        const playerColor = isComputerMove ? this.currentPlayer : this.getPlayerColor(playerId);
        
        if (!isComputerMove && playerColor !== this.currentPlayer) {
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
                const largestAreaResult = this.findLargestConnectedArea();
                
                return { 
                    success: true, 
                    game: this.getGameState(),
                    gameFinished: true,
                    winner: largestAreaResult.winner,
                    winCondition: winCondition,
                    largestAreaSize: largestAreaResult.size,
                    winningCells: largestAreaResult.winningCells,
                    opponentCells: largestAreaResult.opponentCells,
                    isComputerMove: isComputerMove,
                    row,
                    col
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
                    winCondition: winCondition,
                    isComputerMove: isComputerMove,
                    row,
                    col
                };
            }
        }

        if (this.isBoardFull()) {
            this.status = 'finished';
            this.winner = 'draw';
            this.winCondition = 'unentschieden';
            
            return { 
                success: true, 
                game: this.getGameState(),
                gameFinished: true,
                winner: 'draw',
                winCondition: 'unentschieden',
                isComputerMove: isComputerMove,
                row,
                col
            };
        }

        // Spieler wechseln
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';

        return { 
            success: true, 
            game: this.getGameState(),
            gameFinished: false,
            isComputerMove: isComputerMove,
            row,
            col
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
}  // Ende Spiel-Klasse (Game)



// REST-API Endpoints

// Neue Spielsession erstellen
app.post('/api/games', (req, res) => {
    console.log(`   POST /api/games                        - Neues Spiel erstellen`);
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
    const { gameId } = req.params;
    const { playerName } = req.body;
    console.log(`   POST /api/games/${gameId}/join  - Spiel beitreten`);

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
    const { gameId } = req.params;
    const { playerId, row, col } = req.body;
    console.log(`   POST /api/games/${gameId}/move  - Zug machen`);

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
    console.log(`   GET  /api/games                        - Aktive Spiele auflisten`);
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
    console.log(`   GET  /api/players/:playerId            - Spielerinformationen abrufen`);
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
    const { gameId } = req.params;
    const { playerId } = req.body;
    console.log(`   POST /api/games/${gameId}/leave - Spiel verlassen`);

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
    const { gameId } = req.params;
    const { playerId, message } = req.body;
    console.log(`   POST /api/games/${gameId}/chat  - Chat-Nachricht senden`);

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
    console.log(`   GET  /api/status                       - Server-Status`);
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


/* ALTERNATIV
// Spezieller Endpoint für Einzelspieler-Beitritt
app.post('/api/games/singleplayer/join', (req, res) => {
    console.log(`   POST /api/games/singleplayer/join      - Spezieller Endpoint für singleplayer-Beitritt`);
 // const { playerName, difficulty = 'medium' } = req.body;
    const { playerName, difficulty } = req.body;
    
    const game = new Game();
    game.setGameMode('singleplayer', difficulty);
    
    const playerId = uuidv4();
    const color = game.addSinglePlayer(playerId, difficulty);  // Verwende spezielle Methode
    
    if (!color) {
        return res.status(400).json({ success: false, error: 'Spieler konnte nicht hinzugefügt werden' });
    }

    games.set(game.id, game);
    
    players.set(playerId, {
        id: playerId,
        name: playerName || `Spieler`,
        color: color,
        gameId: game.id
    });

    console.log(`Einzelspieler-Spiel ${game.id} gestartet: ${playerName} (${color}) vs KaI (${difficulty})`);

    res.json({
        success: true,
        playerId: playerId,
        color: color,
        gameState: game.getGameState(),
        difficulty: difficulty
    });
});
*/


// GEÄNDERT: singleplayer: API-Endpoints für Einzelspieler
app.post('/api/games/singleplayer', (req, res) => {
    console.log(`   POST /api/games/singleplayer           - singleplayer`);
 // const { difficulty = 'medium' } = req.body;
 // const { difficulty } = req.body;
 // const { playerName } = req.body;
    const { playerName, difficulty } = req.body;
    
    const game = new Game();
    game.setGameMode('singleplayer', difficulty);
/*
    games.set(game.id, game);
    console.log(`Neues Einzelspieler-Spiel erstellt: ${game.id} (Schwierigkeit: ${difficulty})`);
    res.json({ 
        success: true, 
        gameId: game.id,
        message: 'Einzelspieler-Spiel erstellt',
        difficulty: difficulty
    });
*/
    const playerId = uuidv4();
    // Korrektur: Spezielle Methode für Einzelspieler-Beitritt
    const color = game.addSinglePlayer(playerId, difficulty);
    
    if (!color) {
        return res.status(400).json({ success: false, error: 'Spieler konnte nicht hinzugefügt werden' });
    }
    games.set(game.id, game);
    
    players.set(playerId, {
        id: playerId,
        name: playerName || `Spieler`,
        color: color,
        gameId: game.id
    });
    console.log(`Einzelspieler-Spiel ${game.id} gestartet: ${playerName} (${color}) vs KaI (${difficulty})`);

    res.json({
        success: true,
        gameId: game.id,
        playerId: playerId,
        color: color,
        gameState: game.getGameState(),
        message: 'Einzelspieler-Spiel erstellt und gestartet',
        difficulty: difficulty
    });
});


app.post('/api/games/:gameId/computer/move', (req, res) => {
    const { gameId } = req.params;
    console.log(`   POST /api/games/${gameId}/computer/move  - singleplayer computer/move`);

    if (!games.has(gameId)) {
        return res.status(404).json({ success: false, error: 'Spiel nicht gefunden' });
    }

    const game = games.get(gameId);
    
    if (game.gameMode !== 'singleplayer') {
        return res.status(400).json({ success: false, error: 'Nur im Einzelspieler-Modus verfügbar' });
    }

    if (game.status !== 'playing') {
        return res.status(400).json({ success: false, error: 'Spiel ist nicht aktiv' });
    }

    // KI-Zug ausführen
    const result = game.makeComputerMove();
    
    if (result) {
        res.json(result);
    } else {
        res.status(400).json({ success: false, error: 'KI konnte keinen Zug machen' });
    }
});

// DEBUG: Endpoint zum Prüfen des Spielstatus
app.get('/api/debug/games/:gameId', (req, res) => {
    const { gameId } = req.params;

    if (!games.has(gameId)) {
        return res.status(404).json({ success: false, error: 'Spiel nicht gefunden' });
    }

    const game = games.get(gameId);
    
    res.json({
        success: true,
        game: {
            id: game.id,
            status: game.status,
            currentPlayer: game.currentPlayer,
            players: game.players,
            gameMode: game.gameMode,
            board: game.board,
            computerPlayer: game.computerPlayer ? {
                difficulty: game.computerPlayer.difficulty,
                name: game.computerPlayer.name
            } : null
        }
    });
});

// Server starten
app.listen(PORT, () => {
    console.log(`🎮 Brettspiel Server mit Siegbedingungen läuft auf http://localhost:${PORT}`);
    console.log(`📊 Verfügbare Endpoints:`);
    console.log(`   POST /api/games                        - Neues Spiel erstellen`);
    console.log(`   POST /api/games/:gameId/join           - Spiel beitreten`);
    console.log(`   POST /api/games/:gameId/move           - Zug machen`);
    console.log(`   GET  /api/games/:gameId                - Spielstatus abfragen`);
    console.log(`   GET  /api/games                        - Aktive Spiele auflisten`);
    console.log(`   GET  /api/players/:playerId            - Spielerinformationen abrufen`);
    console.log(`   POST /api/games/:gameId/leave          - Spiel verlassen`);
    console.log(`   POST /api/games/:gameId/chat           - Chat-Nachricht senden`);
    console.log(`   GET  /api/games/:gameId/chat           - Chat-Verlauf abrufen`);
    console.log(`   GET  /api/status                       - Server-Status`);
    console.log(`   POST /api/games/singleplayer           - singleplayer`);
    console.log(`   POST /api/games/:gameId/computer/move  - singleplayer computer/move`);
    console.log(`   POST /api/games/singleplayer/join      - Spezieller Endpoint für singleplayer-Beitritt`);
    console.log(`   GET  /api/debug/games/:gameId          - DEBUG: Endpoint zum Prüfen des Spielstatus`);
    console.log(`---`);
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