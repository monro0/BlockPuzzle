document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Элементы ---
    const boardElement = document.getElementById('game-board');
    const piecesContainer = document.getElementById('pieces-container');
    const scoreElement = document.getElementById('score');
    const highScoreElement = document.getElementById('high-score');
    const gameOverScreen = document.getElementById('game-over-screen');
    const finalScoreElement = document.getElementById('final-score');
    const welcomeMessage = document.getElementById('welcome-message');

    // --- Константы и состояние игры ---
    const BOARD_SIZE = 10;
    const PIECE_COLORS = ['color-1', 'color-2', 'color-3', 'color-4', 'color-5'];
    const SHAPES = {
        'I': [[1, 1, 1, 1]], 'O': [[1, 1], [1, 1]], 'T': [[0, 1, 0], [1, 1, 1]],
        'L': [[1, 0], [1, 0], [1, 1]], 'J': [[0, 1], [0, 1], [1, 1]], 'S': [[0, 1, 1], [1, 1, 0]],
        'Z': [[1, 1, 0], [0, 1, 1]], 'dot': [[1]], 'corner': [[1, 1], [1, 0]], 'small_L': [[1, 0], [1, 1]]
    };

    let board = [];
    let currentPieces = [];
    let selectedPiece = null;
    let draggedPiece = null;
    let score = 0;
    let highScore = localStorage.getItem('blockPuzzleHighScore') || 0;
    let isAnimating = false; // <<-- ИСПРАВЛЕНИЕ: Флаг для блокировки
    let tg = null;

    // --- Инициализация Telegram Web App ---
    try {
        tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();
        if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
            welcomeMessage.textContent = `Привет, ${tg.initDataUnsafe.user.first_name}!`;
        }
    } catch (e) {
        console.log("Не в среде Telegram.");
    }

    // --- Основные функции ---
    function initGame() {
        isAnimating = false;
        board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
        score = 0;
        scoreElement.textContent = score;
        highScoreElement.textContent = highScore;
        gameOverScreen.classList.add('hidden');
        currentPieces = [];
        generateNewPieces();
        drawBoard();
        drawCurrentPieces();
    }

    function drawBoard() {
        boardElement.innerHTML = '';
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                if (board[r][c]) {
                    cell.classList.add(board[r][c]);
                }
                cell.dataset.row = r;
                cell.dataset.col = c;
                boardElement.appendChild(cell);
            }
        }
    }

    function drawCurrentPieces() {
        piecesContainer.innerHTML = '';
        currentPieces.forEach(piece => {
            if (!piece) return;
            const pieceDiv = document.createElement('div');
            pieceDiv.classList.add('piece-preview');
            pieceDiv.dataset.pieceId = piece.id;
            pieceDiv.draggable = true;
            const grid = document.createElement('div');
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = `repeat(${piece.shape[0].length}, 15px)`;
            grid.style.pointerEvents = 'none';
            for (let r = 0; r < piece.shape.length; r++) {
                for (let c = 0; c < piece.shape[r].length; c++) {
                    const block = document.createElement('div');
                    block.style.width = '15px';
                    block.style.height = '15px';
                    if (piece.shape[r][c]) {
                        block.classList.add('cell', piece.color);
                    }
                    grid.appendChild(block);
                }
            }
            pieceDiv.appendChild(grid);
            piecesContainer.appendChild(pieceDiv);
        });
        updateSelectedVisuals();
    }
    
    function updateSelectedVisuals() {
        document.querySelectorAll('.piece-preview').forEach(p => p.classList.remove('selected'));
        if (selectedPiece) {
            const selectedDiv = document.querySelector(`[data-piece-id='${selectedPiece.id}']`);
            if (selectedDiv) selectedDiv.classList.add('selected');
        }
    }

    function generateNewPieces() {
        currentPieces = [];
        for (let i = 0; i < 3; i++) {
            currentPieces.push(generateRandomPiece());
        }
        selectedPiece = null;
        if (checkGameOver()) handleGameOver();
    }

    function generateRandomPiece() {
        const shapeKeys = Object.keys(SHAPES);
        const randomShapeKey = shapeKeys[Math.floor(Math.random() * shapeKeys.length)];
        return {
            id: Date.now() + Math.random(),
            shape: SHAPES[randomShapeKey],
            color: PIECE_COLORS[Math.floor(Math.random() * PIECE_COLORS.length)],
        };
    }
    
    function canPlace(piece, startRow, startCol) {
        if (!piece) return false;
        for (let r = 0; r < piece.shape.length; r++) {
            for (let c = 0; c < piece.shape[r].length; c++) {
                if (piece.shape[r][c]) {
                    const boardRow = startRow + r;
                    const boardCol = startCol + c;
                    if (boardRow >= BOARD_SIZE || boardCol >= BOARD_SIZE || boardRow < 0 || boardCol < 0 || board[boardRow][boardCol]) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    function placePiece(piece, startRow, startCol) {
        if (!canPlace(piece, startRow, startCol)) return false;
        for (let r = 0; r < piece.shape.length; r++) {
            for (let c = 0; c < piece.shape[r].length; c++) {
                if (piece.shape[r][c]) {
                    board[startRow + r][startCol + c] = piece.color;
                }
            }
        }
        return true;
    }
    
    function updateScore(linesCleared) {
        const points = (linesCleared * 100) * linesCleared;
        score += points;
        scoreElement.textContent = score;
        if (score > highScore) {
            highScore = score;
            highScoreElement.textContent = highScore;
            localStorage.setItem('blockPuzzleHighScore', highScore);
        }
    }

    function rotatePiece(piece) {
        if (!piece) return;
        const shape = piece.shape;
        const newShape = Array.from({ length: shape[0].length }, () => Array(shape.length).fill(0));
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[0].length; c++) {
                newShape[c][shape.length - 1 - r] = shape[r][c];
            }
        }
        piece.shape = newShape;
        drawCurrentPieces();
    }
    
    function checkGameOver() {
        for (const piece of currentPieces) {
            if (!piece) continue;
            for (let r = 0; r <= BOARD_SIZE - piece.shape.length; r++) {
                for (let c = 0; c <= BOARD_SIZE - piece.shape[0].length; c++) {
                    if (canPlace(piece, r, c)) return false;
                }
            }
        }
        return true;
    }

    function handleGameOver() {
        isAnimating = false;
        finalScoreElement.textContent = score;
        gameOverScreen.classList.remove('hidden');
    }

    function createSandEffect(cell) {
        const rect = cell.getBoundingClientRect();
        const particleCount = 8;
        let colorClass = '';
        for (const c of cell.classList) {
            if (c.startsWith('color-')) {
                colorClass = c;
                break;
            }
        }
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.classList.add('sand-particle', colorClass);
            particle.style.left = `${rect.left + rect.width / 2}px`;
            particle.style.top = `${rect.top + rect.height / 2}px`;
            document.body.appendChild(particle);
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 25;
            const finalX = Math.cos(angle) * radius;
            const finalY = Math.random() * 60 + 20;
            const finalScale = 0.1;
            const finalRotation = Math.random() * 360;
            requestAnimationFrame(() => {
                particle.style.transform = `translate(${finalX}px, ${finalY}px) scale(${finalScale}) rotate(${finalRotation}deg)`;
                particle.style.opacity = '0';
            });
            setTimeout(() => particle.remove(), 800);
        }
    }

    function checkAndClearLines() {
        if (isAnimating) return;
        const rowsToClear = new Set();
        const colsToClear = new Set();
        for (let r = 0; r < BOARD_SIZE; r++) { if (board[r].every(cell => cell !== 0)) rowsToClear.add(r); }
        for (let c = 0; c < BOARD_SIZE; c++) { if (board.every(row => row[c] !== 0)) colsToClear.add(c); }

        const linesCleared = rowsToClear.size + colsToClear.size;
        if (linesCleared === 0) {
             // <<-- ИСПРАВЛЕНИЕ: Если линии не очищаются, все равно проверяем конец игры
            if (checkGameOver()) {
                handleGameOver();
            }
            return;
        }

        isAnimating = true; // <<-- ИСПРАВЛЕНИЕ: Блокируем игру
        const cellsToAnimate = new Set();
        rowsToClear.forEach(r => {
            for (let c = 0; c < BOARD_SIZE; c++) cellsToAnimate.add(document.querySelector(`[data-row='${r}'][data-col='${c}']`));
        });
        colsToClear.forEach(c => {
            for (let r = 0; r < BOARD_SIZE; r++) cellsToAnimate.add(document.querySelector(`[data-row='${r}'][data-col='${c}']`));
        });

        cellsToAnimate.forEach(cell => {
            if (cell) {
                createSandEffect(cell);
                cell.style.visibility = 'hidden';
            }
        });

        setTimeout(() => {
            rowsToClear.forEach(r => { for (let c = 0; c < BOARD_SIZE; c++) board[r][c] = 0; });
            colsToClear.forEach(c => { for (let r = 0; r < BOARD_SIZE; r++) board[r][c] = 0; });
            updateScore(linesCleared);
            drawBoard();
            
            // <<-- ИСПРАВЛЕНИЕ: Проверяем конец игры ПОСЛЕ анимации
            if (checkGameOver()) {
                handleGameOver();
            }
            isAnimating = false; // <<-- ИСПРАВЛЕНИЕ: Разблокируем игру
        }, 800); // Увеличиваем время до конца анимации частиц
    }

    function clearGhost() {
        if (isAnimating) return;
        document.querySelectorAll('.cell').forEach(cell => cell.classList.remove('ghost', 'ghost-invalid'));
    }

    function showGhost(piece, startRow, startCol) {
        if (isAnimating) return;
        clearGhost();
        const isValid = canPlace(piece, startRow, startCol);
        const ghostClass = isValid ? 'ghost' : 'ghost-invalid';
        for (let r = 0; r < piece.shape.length; r++) {
            for (let c = 0; c < piece.shape[r].length; c++) {
                if (piece.shape[r][c]) {
                    const boardRow = startRow + r;
                    const boardCol = startCol + c;
                    if (boardRow < BOARD_SIZE && boardCol < BOARD_SIZE && boardRow >= 0 && boardCol >= 0) {
                        const cell = document.querySelector(`[data-row='${boardRow}'][data-col='${boardCol}']`);
                        if (cell) cell.classList.add(ghostClass);
                    }
                }
            }
        }
    }
    
    // --- Обработчики событий с проверкой на 'isAnimating' ---
    piecesContainer.addEventListener('dragstart', (e) => {
        if (isAnimating) { e.preventDefault(); return; }
        const pieceDiv = e.target.closest('.piece-preview');
        if (!pieceDiv) return;
        const pieceId = parseFloat(pieceDiv.dataset.pieceId);
        draggedPiece = currentPieces.find(p => p && p.id === pieceId);
        e.dataTransfer.setData('text/plain', pieceId);
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => pieceDiv.classList.add('dragging'), 0);
    });
    
    piecesContainer.addEventListener('dragend', (e) => {
        if (isAnimating) return;
        e.target.classList.remove('dragging');
        clearGhost();
        draggedPiece = null;
    });

    boardElement.addEventListener('dragover', (e) => {
        if (isAnimating) return;
        e.preventDefault();
        const cell = e.target.closest('.cell');
        if (cell && draggedPiece) {
            let row = parseInt(cell.dataset.row);
            let col = parseInt(cell.dataset.col);
            const pieceHeight = draggedPiece.shape.length;
            const pieceWidth = draggedPiece.shape[0].length;
            if (col + pieceWidth > BOARD_SIZE) col = BOARD_SIZE - pieceWidth;
            if (row + pieceHeight > BOARD_SIZE) row = BOARD_SIZE - pieceHeight;
            showGhost(draggedPiece, row, col);
        }
    });

    boardElement.addEventListener('dragleave', (e) => {
        if (isAnimating) return;
        if (!e.relatedTarget || !boardElement.contains(e.relatedTarget)) {
             clearGhost();
        }
    });

    boardElement.addEventListener('drop', (e) => {
        if (isAnimating) return;
        e.preventDefault();
        clearGhost();
        const cell = e.target.closest('.cell');
        if (cell && draggedPiece) {
            let row = parseInt(cell.dataset.row);
            let col = parseInt(cell.dataset.col);
            const pieceHeight = draggedPiece.shape.length;
            const pieceWidth = draggedPiece.shape[0].length;
            if (col + pieceWidth > BOARD_SIZE) col = BOARD_SIZE - pieceWidth;
            if (row + pieceHeight > BOARD_SIZE) row = BOARD_SIZE - pieceHeight;
            if (placePiece(draggedPiece, row, col)) {
                const pieceIndex = currentPieces.findIndex(p => p && p.id === draggedPiece.id);
                if (pieceIndex > -1) currentPieces[pieceIndex] = null;
                if (selectedPiece && selectedPiece.id === draggedPiece.id) selectedPiece = null;
                if (currentPieces.every(p => p === null)) generateNewPieces();
                drawBoard();
                drawCurrentPieces();
                checkAndClearLines(); // Эта функция теперь главная и управляет всем остальным
            }
        }
    });

    piecesContainer.addEventListener('click', (e) => {
        if (isAnimating) return;
        const pieceDiv = e.target.closest('.piece-preview');
        if (!pieceDiv) return;
        const pieceId = parseFloat(pieceDiv.dataset.pieceId);
        selectedPiece = (selectedPiece && selectedPiece.id === pieceId) ? null : currentPieces.find(p => p && p.id === pieceId);
        updateSelectedVisuals();
    });

    document.getElementById('rotate-btn').addEventListener('click', () => {
        if (isAnimating) return;
        if (selectedPiece) {
            rotatePiece(selectedPiece);
        }
    });

    document.getElementById('restart-btn').addEventListener('click', initGame);
    document.getElementById('share-btn').addEventListener('click', () => {
        if (tg) {
            tg.sendData(JSON.stringify({ score: score }));
        } else {
            alert(`Ваш счет: ${score}. Запустите в Telegram, чтобы поделиться!`);
        }
    });

    initGame();
});
