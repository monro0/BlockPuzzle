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
    const BOARD_SIZE = 8;
    const PIECE_COLORS = ['color-1', 'color-2', 'color-3', 'color-4', 'color-5'];
    
    // <<-- ИЗМЕНЕНИЕ: Полностью новый набор фигур
    const SHAPES = {
        // Добавленные и измененные по вашему запросу
        'I5_hor':    [[1, 1, 1, 1, 1]],
        'I5_ver':    [[1], [1], [1], [1], [1]],
        'I3_hor':    [[1, 1, 1]],
        'I3_ver':    [[1], [1], [1]],
        'I2_hor':    [[1, 1]],
        'I2_ver':    [[1], [1]],

        // Оставшиеся из старого набора
        'square3x3': [[1, 1, 1], [1, 1, 1], [1, 1, 1]],
        'I4_hor':    [[1, 1, 1, 1]],
        'O':         [[1, 1], [1, 1]],
        'L':         [[1, 0], [1, 0], [1, 1]],
        'J':         [[0, 1], [0, 1], [1, 1]],
        'T':         [[0, 1, 0], [1, 1, 1]],
        'dot':       [[1]],
        'corner':    [[1, 1], [1, 0]],
        'U_shape':   [[1, 0, 1], [1, 1, 1]]
    };
    const TOUCH_OFFSET_Y = -80;

    let board = [];
    let currentPieces = [];
    let selectedPiece = null;
    let draggedPiece = null;
    let isAnimating = false;
    let touchClone = null;
    let score = 0;
    let highScore = localStorage.getItem('blockPuzzleHighScore') || 0;
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
    function initGame() { isAnimating = false; board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0)); score = 0; scoreElement.textContent = score; highScoreElement.textContent = highScore; gameOverScreen.classList.add('hidden'); currentPieces = []; generateNewPieces(); drawBoard(); drawCurrentPieces(); }
    function drawBoard() { boardElement.innerHTML = ''; for (let r = 0; r < BOARD_SIZE; r++) { for (let c = 0; c < BOARD_SIZE; c++) { const cell = document.createElement('div'); cell.classList.add('cell'); if (board[r][c]) { cell.classList.add(board[r][c]); } cell.dataset.row = r; cell.dataset.col = c; boardElement.appendChild(cell); } } }
    function drawCurrentPieces() { piecesContainer.innerHTML = ''; currentPieces.forEach(piece => { if (!piece) return; const pieceDiv = document.createElement('div'); pieceDiv.classList.add('piece-preview'); pieceDiv.dataset.pieceId = piece.id; pieceDiv.draggable = true; const grid = document.createElement('div'); grid.style.display = 'grid'; grid.style.gridTemplateColumns = `repeat(${piece.shape[0].length}, 15px)`; grid.style.pointerEvents = 'none'; for (let r = 0; r < piece.shape.length; r++) { for (let c = 0; c < piece.shape[r].length; c++) { const block = document.createElement('div'); block.style.width = '15px'; block.style.height = '15px'; if (piece.shape[r][c]) { block.classList.add('cell', piece.color); } grid.appendChild(block); } } pieceDiv.appendChild(grid); piecesContainer.appendChild(pieceDiv); }); updateSelectedVisuals(); }
    function updateSelectedVisuals() { document.querySelectorAll('.piece-preview').forEach(p => p.classList.remove('selected')); if (selectedPiece) { const selectedDiv = document.querySelector(`[data-piece-id='${selectedPiece.id}']`); if (selectedDiv) selectedDiv.classList.add('selected'); } }
    function generateNewPieces() { currentPieces = []; for (let i = 0; i < 3; i++) { currentPieces.push(generateRandomPiece()); } selectedPiece = null; if (checkGameOver()) handleGameOver(); }
    function generateRandomPiece() { const shapeKeys = Object.keys(SHAPES); const randomShapeKey = shapeKeys[Math.floor(Math.random() * shapeKeys.length)]; return { id: Date.now() + Math.random(), shape: SHAPES[randomShapeKey], color: PIECE_COLORS[Math.floor(Math.random() * PIECE_COLORS.length)], }; }
    function canPlace(piece, startRow, startCol) { if (!piece) return false; for (let r = 0; r < piece.shape.length; r++) { for (let c = 0; c < piece.shape[r].length; c++) { if (piece.shape[r][c]) { const boardRow = startRow + r; const boardCol = startCol + c; if (boardRow >= BOARD_SIZE || boardCol >= BOARD_SIZE || boardRow < 0 || boardCol < 0 || board[boardRow][boardCol]) { return false; } } } } return true; }

    function placePiece(piece, startRow, startCol) {
        if (!canPlace(piece, startRow, startCol)) return false;
        
        let blockCount = 0; // <<-- ИЗМЕНЕНИЕ: Считаем блоки
        for (let r = 0; r < piece.shape.length; r++) {
            for (let c = 0; c < piece.shape[r].length; c++) {
                if (piece.shape[r][c]) {
                    board[startRow + r][startCol + c] = piece.color;
                    blockCount++;
                }
            }
        }
        addScore(blockCount); // <<-- ИЗМЕНЕНИЕ: Добавляем очки за количество блоков
        return true;
    }
    
    function addScore(points) { // <<-- ИЗМЕНЕНИЕ: Централизованная функция для очков
        score += points;
        scoreElement.textContent = score;
        if (score > highScore) {
            highScore = score;
            highScoreElement.textContent = highScore;
            localStorage.setItem('blockPuzzleHighScore', highScore);
        }
    }

    function rotatePiece(piece) { if (!piece) return; const shape = piece.shape; const newShape = Array.from({ length: shape[0].length }, () => Array(shape.length).fill(0)); for (let r = 0; r < shape.length; r++) { for (let c = 0; c < shape[0].length; c++) { newShape[c][shape.length - 1 - r] = shape[r][c]; } } piece.shape = newShape; drawCurrentPieces(); }
    function checkGameOver() { for (const piece of currentPieces) { if (!piece) continue; for (let r = 0; r <= BOARD_SIZE - piece.shape.length; r++) { for (let c = 0; c <= BOARD_SIZE - piece.shape[0].length; c++) { if (canPlace(piece, r, c)) return false; } } } return true; }
    function handleGameOver() { isAnimating = false; finalScoreElement.textContent = score; gameOverScreen.classList.remove('hidden'); }
    function createSandEffect(cell) { const rect = cell.getBoundingClientRect(); const particleCount = 8; let colorClass = ''; for (const c of cell.classList) { if (c.startsWith('color-')) { colorClass = c; break; } } for (let i = 0; i < particleCount; i++) { const particle = document.createElement('div'); particle.classList.add('sand-particle', colorClass); particle.style.left = `${rect.left + rect.width / 2}px`; particle.style.top = `${rect.top + rect.height / 2}px`; document.body.appendChild(particle); const angle = Math.random() * Math.PI * 2, radius = Math.random() * 25, finalX = Math.cos(angle) * radius, finalY = Math.random() * 60 + 20, finalScale = 0.1, finalRotation = Math.random() * 360; requestAnimationFrame(() => { particle.style.transform = `translate(${finalX}px, ${finalY}px) scale(${finalScale}) rotate(${finalRotation}deg)`; particle.style.opacity = '0'; }); setTimeout(() => particle.remove(), 800); } }
    
    function checkAndClearLines() { 
        if (isAnimating) return; 
        const rowsToClear = new Set(), colsToClear = new Set(); 
        for (let r = 0; r < BOARD_SIZE; r++) { if (board[r].every(cell => cell !== 0)) rowsToClear.add(r); } 
        for (let c = 0; c < BOARD_SIZE; c++) { if (board.every(row => row[c] !== 0)) colsToClear.add(c); } 
        
        const linesCleared = rowsToClear.size + colsToClear.size; 
        if (linesCleared === 0) { if (checkGameOver()) handleGameOver(); return; } 

        // <<-- ИЗМЕНЕНИЕ: Новая логика расчета бонусных очков
        const bonusPoints = (linesCleared * (linesCleared + 1) / 2) * 10;
        addScore(bonusPoints);
        
        isAnimating = true; 
        const cellsToAnimate = new Set(); 
        rowsToClear.forEach(r => { for (let c = 0; c < BOARD_SIZE; c++) cellsToAnimate.add(document.querySelector(`[data-row='${r}'][data-col='${c}']`)); }); 
        colsToClear.forEach(c => { for (let r = 0; r < BOARD_SIZE; r++) cellsToAnimate.add(document.querySelector(`[data-row='${r}'][data-col='${c}']`)); }); 
        cellsToAnimate.forEach(cell => { if (cell) { createSandEffect(cell); cell.style.visibility = 'hidden'; } }); 
        
        setTimeout(() => { 
            rowsToClear.forEach(r => { for (let c = 0; c < BOARD_SIZE; c++) board[r][c] = 0; }); 
            colsToClear.forEach(c => { for (let r = 0; r < BOARD_SIZE; r++) board[r][c] = 0; }); 
            drawBoard(); 
            if (checkGameOver()) handleGameOver(); 
            isAnimating = false; 
        }, 800); 
    }

    function clearGhost() { if (isAnimating) return; document.querySelectorAll('.cell').forEach(cell => cell.classList.remove('ghost', 'ghost-invalid')); }
    function showGhost(piece, startRow, startCol) { if (isAnimating) return; clearGhost(); const isValid = canPlace(piece, startRow, startCol); const ghostClass = isValid ? 'ghost' : 'ghost-invalid'; for (let r = 0; r < piece.shape.length; r++) { for (let c = 0; c < piece.shape[r].length; c++) { if (piece.shape[r][c]) { const boardRow = startRow + r, boardCol = startCol + c; if (boardRow < BOARD_SIZE && boardCol < BOARD_SIZE && boardRow >= 0 && boardCol >= 0) { const cell = document.querySelector(`[data-row='${boardRow}'][data-col='${boardCol}']`); if (cell) cell.classList.add(ghostClass); } } } } }
    
    // --- Управление мышкой (Drag & Drop) ---
    piecesContainer.addEventListener('dragstart', (e) => { if (isAnimating) { e.preventDefault(); return; } const pieceDiv = e.target.closest('.piece-preview'); if (!pieceDiv) return; const pieceId = parseFloat(pieceDiv.dataset.pieceId); draggedPiece = currentPieces.find(p => p && p.id === pieceId); e.dataTransfer.setData('text/plain', pieceId); e.dataTransfer.effectAllowed = 'move'; setTimeout(() => pieceDiv.classList.add('dragging'), 0); });
    piecesContainer.addEventListener('dragend', (e) => { if (isAnimating) return; e.target.classList.remove('dragging'); clearGhost(); draggedPiece = null; });
    boardElement.addEventListener('dragover', (e) => { if (isAnimating) return; e.preventDefault(); const cell = e.target.closest('.cell'); if (cell && draggedPiece) { let row = parseInt(cell.dataset.row), col = parseInt(cell.dataset.col), pieceHeight = draggedPiece.shape.length, pieceWidth = draggedPiece.shape[0].length; if (col + pieceWidth > BOARD_SIZE) col = BOARD_SIZE - pieceWidth; if (row + pieceHeight > BOARD_SIZE) row = BOARD_SIZE - pieceHeight; showGhost(draggedPiece, row, col); } });
    boardElement.addEventListener('dragleave', (e) => { if (isAnimating) return; if (!e.relatedTarget || !boardElement.contains(e.relatedTarget)) clearGhost(); });
    boardElement.addEventListener('drop', (e) => { if (isAnimating) return; e.preventDefault(); clearGhost(); const cell = e.target.closest('.cell'); if (cell && draggedPiece) { let row = parseInt(cell.dataset.row), col = parseInt(cell.dataset.col), pieceHeight = draggedPiece.shape.length, pieceWidth = draggedPiece.shape[0].length; if (col + pieceWidth > BOARD_SIZE) col = BOARD_SIZE - pieceWidth; if (row + pieceHeight > BOARD_SIZE) row = BOARD_SIZE - pieceHeight; if (placePiece(draggedPiece, row, col)) { const pieceIndex = currentPieces.findIndex(p => p && p.id === draggedPiece.id); if (pieceIndex > -1) currentPieces[pieceIndex] = null; if (selectedPiece && selectedPiece.id === draggedPiece.id) selectedPiece = null; if (currentPieces.every(p => p === null)) generateNewPieces(); drawBoard(); drawCurrentPieces(); checkAndClearLines(); } } });

    // --- Управление касанием (Touch Events) ---
    piecesContainer.addEventListener('touchstart', (e) => { if (isAnimating) return; e.preventDefault(); const pieceDiv = e.target.closest('.piece-preview'); if (!pieceDiv) return; const pieceId = parseFloat(pieceDiv.dataset.pieceId); draggedPiece = currentPieces.find(p => p && p.id === pieceId); if (!draggedPiece) return; touchClone = pieceDiv.cloneNode(true); touchClone.style.position = 'absolute'; touchClone.style.zIndex = '1000'; touchClone.style.pointerEvents = 'none'; document.body.appendChild(touchClone); const touch = e.touches[0]; touchClone.style.left = `${touch.clientX - touchClone.offsetWidth / 2}px`; touchClone.style.top = `${touch.clientY - touchClone.offsetHeight / 2 + TOUCH_OFFSET_Y}px`; pieceDiv.classList.add('dragging'); }, { passive: false });
    document.body.addEventListener('touchmove', (e) => { if (isAnimating || !draggedPiece || !touchClone) return; e.preventDefault(); const touch = e.touches[0]; touchClone.style.left = `${touch.clientX - touchClone.offsetWidth / 2}px`; touchClone.style.top = `${touch.clientY - touchClone.offsetHeight / 2 + TOUCH_OFFSET_Y}px`; 
        const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY + TOUCH_OFFSET_Y); 
        const cell = elementUnderTouch ? elementUnderTouch.closest('.cell') : null; if (cell) { let row = parseInt(cell.dataset.row), col = parseInt(cell.dataset.col), pieceHeight = draggedPiece.shape.length, pieceWidth = draggedPiece.shape[0].length; if (col + pieceWidth > BOARD_SIZE) col = BOARD_SIZE - pieceWidth; if (row + pieceHeight > BOARD_SIZE) row = BOARD_SIZE - pieceHeight; showGhost(draggedPiece, row, col); } else { clearGhost(); } }, { passive: false });
    document.body.addEventListener('touchend', (e) => { if (isAnimating || !draggedPiece || !touchClone) return; const touch = e.changedTouches[0]; 
        const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY + TOUCH_OFFSET_Y);
        const cell = elementUnderTouch ? elementUnderTouch.closest('.cell') : null; clearGhost(); touchClone.remove(); touchClone = null; document.querySelector('.piece-preview.dragging')?.classList.remove('dragging'); if (cell) { let row = parseInt(cell.dataset.row), col = parseInt(cell.dataset.col), pieceHeight = draggedPiece.shape.length, pieceWidth = draggedPiece.shape[0].length; if (col + pieceWidth > BOARD_SIZE) col = BOARD_SIZE - pieceWidth; if (row + pieceHeight > BOARD_SIZE) row = BOARD_SIZE - pieceHeight; if (placePiece(draggedPiece, row, col)) { const pieceIndex = currentPieces.findIndex(p => p && p.id === draggedPiece.id); if (pieceIndex > -1) currentPieces[pieceIndex] = null; if (selectedPiece && selectedPiece.id === draggedPiece.id) selectedPiece = null; if (currentPieces.every(p => p === null)) generateNewPieces(); drawBoard(); drawCurrentPieces(); checkAndClearLines(); } } draggedPiece = null; });

    // --- Кнопки и выбор ---
    piecesContainer.addEventListener('click', (e) => { if (isAnimating) return; const pieceDiv = e.target.closest('.piece-preview'); if (!pieceDiv) return; const pieceId = parseFloat(pieceDiv.dataset.pieceId); selectedPiece = (selectedPiece && selectedPiece.id === pieceId) ? null : currentPieces.find(p => p && p.id === pieceId); updateSelectedVisuals(); });
    document.getElementById('rotate-btn').addEventListener('click', () => { if (isAnimating) return; if (selectedPiece) { rotatePiece(selectedPiece); } });
    document.getElementById('restart-btn').addEventListener('click', initGame);
    document.getElementById('share-btn').addEventListener('click', () => { if (tg) { tg.sendData(JSON.stringify({ score: score })); } else { alert(`Ваш счет: ${score}. Запустите в Telegram, чтобы поделиться!`); } });

    initGame();
});
