const boardElement = document.getElementById('game-board');
const piecesContainer = document.getElementById('pieces-container');
const scoreElement = document.getElementById('score-value');
const highScoreElement = document.getElementById('highscore-value');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreElement = document.getElementById('final-score');
const restartButton = document.getElementById('restart-button');

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 10;
const HIGH_SCORE_KEY = 'blockPuzzleHighScore';
const ACTIVE_GAME_KEY = 'blockPuzzleActiveGame';

let board = [];
let currentPieces = [];
let score = 0;
let highScore = 0;

// --- Optimized Drag & Performance State ---
let activeDrag = { pieceIndex: null, pieceData: null };
let lastHoveredCell = null;
let currentGhostCells = [];

const pieces = [
    { shape: [[1, 1], [1, 1]], color: '#ffd83b', id: 'O' }, // O
    { shape: [[1, 1, 1, 1]], color: '#42e3ff', id: 'I' },      // I
    { shape: [[0, 1, 0], [1, 1, 1]], color: '#b554ff', id: 'T' }, // T
    { shape: [[1, 0, 0], [1, 1, 1]], color: '#ff8d2b', id: 'L' }, // L
    { shape: [[0, 0, 1], [1, 1, 1]], color: '#2b80ff', id: 'J' }, // J
    { shape: [[0, 1, 1], [1, 1, 0]], color: '#ff5454', id: 'S' }, // S
    { shape: [[1, 1, 0], [0, 1, 1]], color: '#79ff2b', id: 'Z' }, // Z
    { shape: [[1]], color: '#ff2bca' }, // 1x1
    { shape: [[1, 1, 1]], color: '#42e3ff' }, // 1x3
    { shape: [[1], [1], [1]], color: '#ff8d2b' }, // 3x1
];

function initGame(isRestart = false) {
    boardElement.innerHTML = '';
    piecesContainer.innerHTML = '';
    gameOverScreen.style.display = 'none';

    highScore = localStorage.getItem(HIGH_SCORE_KEY) || 0;
    highScoreElement.textContent = highScore;

    if (!isRestart && loadGameState()) {
        console.log("Loaded saved game state.");
    } else {
        board = Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));
        score = 0;
        scoreElement.textContent = score;
        generateNewPieces();
    }

    clearGhost();
    drawBoard();
    updatePiecesUI();
}

function drawBoard() {
    boardElement.innerHTML = '';
    board.forEach((row, r) => {
        row.forEach((cell, c) => {
            const cellElement = document.createElement('div');
            cellElement.classList.add('cell');
            if (cell) {
                cellElement.classList.add('filled');
                cellElement.style.backgroundColor = cell.color;
                cellElement.dataset.gemType = cell.id || 'gem';
            }
            cellElement.dataset.row = r;
            cellElement.dataset.col = c;
            boardElement.appendChild(cellElement);
        });
    });
}

function generateNewPieces() {
    currentPieces = [];
    for (let i = 0; i < 3; i++) {
        const piece = pieces[Math.floor(Math.random() * pieces.length)];
        currentPieces.push({ ...piece, used: false });
    }
}

function updatePiecesUI() {
    piecesContainer.innerHTML = '';
    currentPieces.forEach((piece, index) => {
        if (!piece.used) {
            const pieceElement = createPieceElement(piece, index);
            piecesContainer.appendChild(pieceElement);
        }
    });
}

function createPieceElement(piece, pieceIndex) {
    const pieceElement = document.createElement('div');
    pieceElement.classList.add('piece');
    pieceElement.draggable = true;

    piece.shape.forEach(row => {
        const rowElement = document.createElement('div');
        rowElement.classList.add('piece-row');
        row.forEach(cell => {
            const cellElement = document.createElement('div');
            cellElement.classList.add('piece-cell');
            if (cell) {
                cellElement.style.backgroundColor = piece.color;
                cellElement.dataset.gemType = piece.id || 'gem';
            }
            rowElement.appendChild(cellElement);
        });
        pieceElement.appendChild(rowElement);
    });

    // --- Drag and Drop for Desktop ---
    pieceElement.addEventListener('dragstart', (e) => {
        if (pieceElement.classList.contains('used')) {
            e.preventDefault();
            return;
        }
        activeDrag.pieceIndex = pieceIndex;
        activeDrag.pieceData = currentPieces[pieceIndex];
        setTimeout(() => {
            pieceElement.classList.add('dragging');
        }, 0);
    });

    pieceElement.addEventListener('dragend', () => {
        pieceElement.classList.remove('dragging');
        clearGhost();
        activeDrag = { pieceIndex: null, pieceData: null };
        lastHoveredCell = null;
    });

    // --- Touch events for Mobile ---
    pieceElement.addEventListener('touchstart', (e) => {
        if (pieceElement.classList.contains('used')) return;
        e.preventDefault();

        activeDrag.pieceIndex = pieceIndex;
        activeDrag.pieceData = currentPieces[pieceIndex];

        const originalPieceRect = pieceElement.getBoundingClientRect();
        const touchClone = pieceElement.cloneNode(true);
        touchClone.id = 'touch-clone';
        touchClone.style.position = 'absolute';
        touchClone.style.width = `${originalPieceRect.width}px`;
        touchClone.style.height = `${originalPieceRect.height}px`;
        touchClone.style.pointerEvents = 'none';
        touchClone.classList.add('dragging');
        document.body.appendChild(touchClone);

        const touch = e.touches[0];
        const touchOffsetY = touchClone.offsetHeight * 1.5;

        const updateClonePosition = (currentTouch) => {
            touchClone.style.top = `${currentTouch.clientY - touchOffsetY}px`;
            touchClone.style.left = `${currentTouch.clientX - (touchClone.offsetWidth / 2)}px`;
        }

        updateClonePosition(touch);

        const onTouchMove = (moveEvent) => {
            moveEvent.preventDefault();
            const moveTouch = moveEvent.touches[0];
            updateClonePosition(moveTouch);

            const elementFromPoint = document.elementFromPoint(moveTouch.clientX, moveTouch.clientY);
            if (elementFromPoint && elementFromPoint !== lastHoveredCell && elementFromPoint.classList.contains('cell')) {
                handleMove(elementFromPoint);
                lastHoveredCell = elementFromPoint;
            }
        };

        const onTouchEnd = (endEvent) => {
            if (touchClone) {
                document.body.removeChild(touchClone);
            }

            const endTouch = endEvent.changedTouches[0];
            const elementFromPoint = document.elementFromPoint(endTouch.clientX, endTouch.clientY);

            if (elementFromPoint && elementFromPoint.classList.contains('cell')) {
                handleDrop(elementFromPoint);
            } else {
                clearGhost();
            }

            // Cleanup
            activeDrag = { pieceIndex: null, pieceData: null };
            lastHoveredCell = null;
            document.body.removeEventListener('touchmove', onTouchMove);
            document.body.removeEventListener('touchend', onTouchEnd);
        };

        document.body.addEventListener('touchmove', onTouchMove, { passive: false });
        document.body.addEventListener('touchend', onTouchEnd);

    }, { passive: false });

    return pieceElement;
}

function getPlacementPosition(piece, row, col) {
    if (!piece) return null;
    const pieceHeight = piece.shape.length;
    const pieceWidth = piece.shape[0].length;

    let finalRow = row - Math.floor(pieceHeight / 2);
    let finalCol = col - Math.floor(pieceWidth / 2);

    finalRow = Math.max(0, Math.min(finalRow, BOARD_HEIGHT - pieceHeight));
    finalCol = Math.max(0, Math.min(finalCol, BOARD_WIDTH - pieceWidth));

    return { row: finalRow, col: finalCol };
}

function canPlace(piece, startRow, startCol) {
    if (!piece) return false;
    for (let r = 0; r < piece.shape.length; r++) {
        for (let c = 0; c < piece.shape[r].length; c++) {
            if (piece.shape[r][c]) {
                const boardRow = startRow + r;
                const boardCol = startCol + c;
                if (boardRow >= BOARD_HEIGHT || boardCol >= BOARD_WIDTH || board[boardRow][boardCol]) {
                    return false;
                }
            }
        }
    }
    return true;
}

function clearGhost() {
    currentGhostCells.forEach(cell => {
        if (cell) cell.classList.remove('ghost');
    });
    currentGhostCells = [];
}

function showGhost(piece, row, col) {
    clearGhost();
    const placementPosition = getPlacementPosition(piece, row, col);
    if (!placementPosition) return;

    if (canPlace(piece, placementPosition.row, placementPosition.col)) {
        piece.shape.forEach((shapeRow, r_offset) => {
            shapeRow.forEach((cell, c_offset) => {
                if (cell) {
                    const boardRow = placementPosition.row + r_offset;
                    const boardCol = placementPosition.col + c_offset;
                    const targetCell = document.querySelector(`.cell[data-row='${boardRow}'][data-col='${boardCol}']`);
                    if (targetCell) {
                        targetCell.classList.add('ghost');
                        currentGhostCells.push(targetCell);
                    }
                }
            });
        });
    }
}

function handleMove(targetCell) {
    if (!activeDrag.pieceData) return;
    if (!targetCell || !targetCell.classList.contains('cell')) {
        clearGhost();
        return;
    }

    const row = parseInt(targetCell.dataset.row);
    const col = parseInt(targetCell.dataset.col);
    showGhost(activeDrag.pieceData, row, col);
}

function handleDrop(targetCell) {
    const pieceIndex = activeDrag.pieceIndex;
    if (pieceIndex === null) return;

    const draggedPiece = currentPieces[pieceIndex];
    const row = parseInt(targetCell.dataset.row);
    const col = parseInt(targetCell.dataset.col);

    const placementPosition = getPlacementPosition(draggedPiece, row, col);
    if (placementPosition && canPlace(draggedPiece, placementPosition.row, placementPosition.col)) {
        placePiece(draggedPiece, placementPosition.row, placementPosition.col);
        currentPieces[pieceIndex].used = true;
        updatePiecesUI();
        clearLines();
        if (currentPieces.every(p => p.used)) {
            generateNewPieces();
            updatePiecesUI();
        }
        saveGameState();
        if (checkGameOver()) {
            handleGameOver();
        }
    }
    clearGhost();
}

function placePiece(piece, startRow, startCol) {
    let placedBlockCount = 0;
    piece.shape.forEach((row, r) => {
        row.forEach((cell, c) => {
            if (cell) {
                const boardRow = startRow + r;
                const boardCol = startCol + c;
                if (boardRow < BOARD_HEIGHT && boardCol < BOARD_WIDTH) {
                    board[boardRow][boardCol] = { color: piece.color, id: piece.id };
                    placedBlockCount++;
                }
            }
        });
    });
    score += placedBlockCount;
    scoreElement.textContent = score;
    drawBoard();
}

function clearLines() {
    let linesToClear = [];
    // Check rows
    for (let r = 0; r < BOARD_HEIGHT; r++) {
        if (board[r].every(cell => cell !== null)) {
            linesToClear.push({type: 'row', index: r});
        }
    }
    // Check columns
    for (let c = 0; c < BOARD_WIDTH; c++) {
        if (board.every(row => row[c] !== null)) {
             linesToClear.push({type: 'col', index: c});
        }
    }

    if (linesToClear.length > 0) {
        score += linesToClear.length * 10 * linesToClear.length; // Combo bonus
        scoreElement.textContent = score;
        animateLineClear(linesToClear);
    }
}

function animateLineClear(lines) {
    lines.forEach(line => {
        if(line.type === 'row') {
            for(let c = 0; c < BOARD_WIDTH; c++) {
                const cell = document.querySelector(`.cell[data-row='${line.index}'][data-col='${c}']`);
                cell.classList.add('clearing');
            }
        } else { // col
            for(let r = 0; r < BOARD_HEIGHT; r++) {
                const cell = document.querySelector(`.cell[data-row='${r}'][data-col='${line.index}']`);
                cell.classList.add('clearing');
            }
        }
    });

    setTimeout(() => {
        lines.forEach(line => {
            if (line.type === 'row') {
                for (let c = 0; c < BOARD_WIDTH; c++) board[line.index][c] = null;
            } else { // col
                for (let r = 0; r < BOARD_HEIGHT; r++) board[r][line.index] = null;
            }
        });
        drawBoard();
        saveGameState();
    }, 200);
}

function checkGameOver() {
    for (const piece of currentPieces) {
        if (!piece.used) {
            for (let r = 0; r <= BOARD_HEIGHT - piece.shape.length; r++) {
                for (let c = 0; c <= BOARD_WIDTH - piece.shape[0].length; c++) {
                    if (canPlace(piece, r, c)) {
                        return false; // At least one move is possible
                    }
                }
            }
        }
    }
    return true; // No moves left for any available piece
}

function handleGameOver() {
    finalScoreElement.textContent = score;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem(HIGH_SCORE_KEY, highScore);
        highScoreElement.textContent = highScore;
    }
    gameOverScreen.style.display = 'flex';
    deleteGameState();
}

function saveGameState() {
    const gameState = {
        board: board,
        currentPieces: currentPieces,
        score: score
    };
    localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(gameState));
}

function loadGameState() {
    const savedGame = localStorage.getItem(ACTIVE_GAME_KEY);
    if (savedGame) {
        try {
            const gameState = JSON.parse(savedGame);
            board = gameState.board;
            currentPieces = gameState.currentPieces;
            score = gameState.score;
            scoreElement.textContent = score;
            return true;
        } catch (e) {
            console.error("Could not parse saved game state:", e);
            deleteGameState();
            return false;
        }
    }
    return false;
}

function deleteGameState() {
    localStorage.removeItem(ACTIVE_GAME_KEY);
}

// Event Listeners
restartButton.addEventListener('click', () => initGame(true));

boardElement.addEventListener('dragover', (e) => {
    e.preventDefault();
    const targetCell = e.target;
    if (targetCell && targetCell !== lastHoveredCell && targetCell.classList.contains('cell')) {
        handleMove(targetCell);
        lastHoveredCell = targetCell;
    }
});

boardElement.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.target.classList.contains('cell')) {
        handleDrop(e.target);
    }
    clearGhost();
    lastHoveredCell = null;
});

boardElement.addEventListener('dragleave', (e) => {
    if (!boardElement.contains(e.relatedTarget)) {
        clearGhost();
        lastHoveredCell = null;
    }
});

// Initialize
initGame();
