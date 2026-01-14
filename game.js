document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Элементы ---
    const boardElement = document.getElementById('game-board');
    const piecesContainer = document.getElementById('pieces-container');
    const scoreElement = document.getElementById('score');
    const highScoreElement = document.getElementById('high-score');
    const gameOverScreen = document.getElementById('game-over-screen');
    const finalScoreElement = document.getElementById('final-score');
    const restartFromGameOverBtn = document.getElementById('restart-from-gameover-btn');
    const newGameBtn = document.getElementById('new-game-btn');

    // --- Константы ---
    const BOARD_SIZE = 8;
    const PIECE_COLORS = ['color-1', 'color-2', 'color-3', 'color-4', 'color-5'];
    const PREVIEW_BLOCK_SIZE = 28;
    const SHAPES = { 'I5_hor': [[1, 1, 1, 1, 1]], 'I5_ver': [[1], [1], [1], [1], [1]], 'I3_hor': [[1, 1, 1]], 'I3_ver': [[1], [1], [1]], 'I2_hor': [[1, 1]], 'I2_ver': [[1], [1]], 'square3x3': [[1, 1, 1], [1, 1, 1], [1, 1, 1]], 'I4_hor': [[1, 1, 1, 1]], 'O': [[1, 1], [1, 1]], 'L': [[1, 0], [1, 0], [1, 1]], 'J': [[0, 1], [0, 1], [1, 1]], 'T': [[0, 1, 0], [1, 1, 1]], 'dot': [[1]], 'corner': [[1, 1], [1, 0]], 'U_shape': [[1, 0, 1], [1, 1, 1]] };
    const TOUCH_OFFSET_Y = -80;
    const HIGH_SCORE_KEY = 'blockPuzzleHighScore_v2';
    const ACTIVE_GAME_KEY = 'blockPuzzleActiveGame_v2';

    // --- Переменные состояния ---
    let board = [], currentPieces = [], draggedPiece = null, isAnimating = false, touchClone = null, score = 0, highScore = 0;
    let tg = null;
    
    // --- ИЗМЕНЕНИЕ: Переменные для оптимизации и отслеживания ---
    let touchUpdateScheduled = false;
    let lastTouchX = 0;
    let lastTouchY = 0;
    let draggedPieceOriginalDiv = null; // Запоминаем оригинальный div

    // --- Инициализация ---
    try { tg = window.Telegram.WebApp; tg.ready(); tg.expand(); } catch (e) { console.log("Не в среде Telegram."); }

    function saveGameState() { const gameState = { board, currentPieces, score }; localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(gameState)); }
    function loadGameState() { const savedGame = localStorage.getItem(ACTIVE_GAME_KEY); if (savedGame) { const gameState = JSON.parse(savedGame); board = gameState.board; currentPieces = gameState.currentPieces; score = gameState.score; scoreElement.textContent = score; return true; } return false; }
    function deleteGameState() { localStorage.removeItem(ACTIVE_GAME_KEY); }

    function initGame(forceNew = false) { highScore = localStorage.getItem(HIGH_SCORE_KEY) || 0; highScoreElement.textContent = highScore; createBoard(); if (!forceNew && loadGameState()) { updateBoard(); drawCurrentPieces(); } else { isAnimating = false; board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0)); score = 0; scoreElement.textContent = score; gameOverScreen.classList.add('hidden'); currentPieces = []; generateNewPieces(); updateBoard(); drawCurrentPieces(); saveGameState(); } }
    function createBoard() { boardElement.innerHTML = ''; for (let r = 0; r < BOARD_SIZE; r++) { for (let c = 0; c < BOARD_SIZE; c++) { const cell = document.createElement('div'); cell.dataset.row = r; cell.dataset.col = c; boardElement.appendChild(cell); } } }
    function updateBoard() { for (let r = 0; r < BOARD_SIZE; r++) { for (let c = 0; c < BOARD_SIZE; c++) { const cell = boardElement.children[r * BOARD_SIZE + c]; const colorClass = board[r][c]; cell.className = 'cell'; if (colorClass) { cell.classList.add(colorClass); } } } }
    function drawCurrentPieces() { piecesContainer.innerHTML = ''; currentPieces.forEach(piece => { if (!piece) return; const pieceDiv = document.createElement('div'); pieceDiv.classList.add('piece-preview'); pieceDiv.dataset.pieceId = piece.id; pieceDiv.draggable = true; const grid = document.createElement('div'); grid.style.display = 'grid'; grid.style.gridTemplateColumns = `repeat(${piece.shape[0].length}, ${PREVIEW_BLOCK_SIZE}px)`; grid.style.pointerEvents = 'none'; for (let r = 0; r < piece.shape.length; r++) { for (let c = 0; c < piece.shape[r].length; c++) { const block = document.createElement('div'); block.classList.add('preview-block', 'cell'); if (piece.shape[r][c]) { block.classList.add(piece.color); } grid.appendChild(block); } } pieceDiv.appendChild(grid); piecesContainer.appendChild(pieceDiv); }); updatePlaceableStatus(); }
    function generateNewPieces() { currentPieces = []; for (let i = 0; i < 3; i++) { currentPieces.push(generateRandomPiece()); } updatePlaceableStatus(); if (checkGameOver()) { handleGameOver(); } }
    function generateRandomPiece() { const shapeKeys = Object.keys(SHAPES); const randomShapeKey = shapeKeys[Math.floor(Math.random() * shapeKeys.length)]; return { id: Date.now() + Math.random(), shape: SHAPES[randomShapeKey], color: PIECE_COLORS[Math.floor(Math.random() * PIECE_COLORS.length)], }; }
    function canPlace(piece, startRow, startCol) { if (!piece) return false; for (let r = 0; r < piece.shape.length; r++) { for (let c = 0; c < piece.shape[r].length; c++) { if (piece.shape[r][c]) { const boardRow = startRow + r; const boardCol = startCol + c; if (boardRow >= BOARD_SIZE || boardCol >= BOARD_SIZE || boardRow < 0 || boardCol < 0 || board[boardRow][boardCol]) { return false; } } } } return true; }
    function placePiece(piece, startRow, startCol) { if (!canPlace(piece, startRow, startCol)) return false; let blockCount = 0; for (let r = 0; r < piece.shape.length; r++) { for (let c = 0; c < piece.shape[r].length; c++) { if (piece.shape[r][c]) { board[startRow + r][startCol + c] = piece.color; blockCount++; } } } addScore(blockCount); return true; }
    function addScore(points) { score += points; scoreElement.textContent = score; }
    function isPiecePlaceable(piece) { if (!piece) return false; for (let r = 0; r <= BOARD_SIZE - piece.shape.length; r++) { for (let c = 0; c <= BOARD_SIZE - piece.shape[0].length; c++) { if (canPlace(piece, r, c)) return true; } } return false; }
    function updatePlaceableStatus() { document.querySelectorAll('.piece-preview').forEach(div => { if(!div.dataset.pieceId) return; const pieceId = parseFloat(div.dataset.pieceId); const pieceData = currentPieces.find(p => p && p.id === pieceId); const placeable = isPiecePlaceable(pieceData); div.classList.toggle('unplaceable', !placeable); div.draggable = placeable; }); }
    function checkGameOver() { return currentPieces.every(p => p === null || !isPiecePlaceable(p)); }
    function handleGameOver() { isAnimating = false; finalScoreElement.textContent = score; gameOverScreen.classList.remove('hidden'); if (score > highScore) { highScore = score; localStorage.setItem(HIGH_SCORE_KEY, highScore); } deleteGameState(); }
    function createSandEffect(cell) { const rect = cell.getBoundingClientRect(); const particleCount = 8; let colorClass = ''; for (const c of cell.classList) { if (c.startsWith('color-')) { colorClass = c; break; } } for (let i = 0; i < particleCount; i++) { const particle = document.createElement('div'); particle.classList.add('sand-particle', colorClass); particle.style.left = `${rect.left + rect.width / 2}px`; particle.style.top = `${rect.top + rect.height / 2}px`; document.body.appendChild(particle); const angle = Math.random() * Math.PI * 2, radius = Math.random() * 25, finalX = Math.cos(angle) * radius, finalY = Math.random() * 60 + 20, finalScale = 0.1, finalRotation = Math.random() * 360; requestAnimationFrame(() => { particle.style.transform = `translate(${finalX}px, ${finalY}px) scale(${finalScale}) rotate(${finalRotation}deg)`; particle.style.opacity = '0'; }); setTimeout(() => particle.remove(), 800); } }
    function processTurn() { if (isAnimating) return; const rowsToClear = new Set(), colsToClear = new Set(); for (let r = 0; r < BOARD_SIZE; r++) { if (board[r].every(cell => cell !== 0)) rowsToClear.add(r); } for (let c = 0; c < BOARD_SIZE; c++) { if (board.every(row => row[c] !== 0)) colsToClear.add(c); } const linesCleared = rowsToClear.size + colsToClear.size; if (linesCleared > 0) { const bonusPoints = (linesCleared * (linesCleared + 1) / 2) * 10; addScore(bonusPoints); isAnimating = true; const cellsToAnimate = new Set(); rowsToClear.forEach(r => { for (let c = 0; c < BOARD_SIZE; c++) cellsToAnimate.add(document.querySelector(`[data-row='${r}'][data-col='${c}']`)); }); colsToClear.forEach(c => { for (let r = 0; r < BOARD_SIZE; r++) cellsToAnimate.add(document.querySelector(`[data-row='${r}'][data-col='${c}']`)); }); cellsToAnimate.forEach(cell => { if (cell) { createSandEffect(cell); board[cell.dataset.row][cell.dataset.col] = 0; } }); updateBoard(); setTimeout(() => { updatePlaceableStatus(); if (checkGameOver()) handleGameOver(); isAnimating = false; }, 100); } else { updatePlaceableStatus(); if (checkGameOver()) handleGameOver(); } saveGameState(); }
    function clearGhost() { if (isAnimating) return; document.querySelectorAll('.cell').forEach(cell => cell.classList.remove('ghost', 'ghost-invalid')); }
    function showGhost(piece, startRow, startCol) { if (!piece) return; if (isAnimating) return; clearGhost(); const isValid = canPlace(piece, startRow, startCol); const ghostClass = isValid ? 'ghost' : 'ghost-invalid'; for (let r = 0; r < piece.shape.length; r++) { for (let c = 0; c < piece.shape[r].length; c++) { if (piece.shape[r][c]) { const boardRow = startRow + r, boardCol = startCol + c; if (boardRow < BOARD_SIZE && boardCol < BOARD_SIZE && boardRow >= 0 && boardCol >= 0) { const cell = document.querySelector(`[data-row='${boardRow}'][data-col='${boardCol}']`); if (cell) cell.classList.add(ghostClass); } } } } }
    function getPlacementPosition(targetElement, piece) { if (!targetElement || !piece) return null; const cell = targetElement.closest('.cell'); if (!cell) return null; let baseRow = parseInt(cell.dataset.row); let baseCol = parseInt(cell.dataset.col); const rowOffset = Math.floor(piece.shape.length / 2); const colOffset = Math.floor(piece.shape[0].length / 2); let finalRow = baseRow - rowOffset; let finalCol = baseCol - colOffset; if (finalCol < 0) finalCol = 0; if (finalRow < 0) finalRow = 0; if (finalCol + piece.shape[0].length > BOARD_SIZE) finalCol = BOARD_SIZE - piece.shape[0].length; if (finalRow + piece.shape.length > BOARD_SIZE) finalRow = BOARD_SIZE - piece.shape.length; return { row: finalRow, col: finalCol }; }
    function handleDrop(targetElement) { if (isAnimating || !draggedPiece) return; clearGhost(); const pos = getPlacementPosition(targetElement, draggedPiece); if (pos && placePiece(draggedPiece, pos.row, pos.col)) { const pieceIndex = currentPieces.findIndex(p => p && p.id === draggedPiece.id); if (pieceIndex > -1) currentPieces[pieceIndex] = null; if (currentPieces.every(p => p === null)) { generateNewPieces(); } updateBoard(); drawCurrentPieces(); processTurn(); } }
    function handleMove(targetElement) { if (isAnimating || !draggedPiece) return; const pos = getPlacementPosition(targetElement, draggedPiece); if (pos) { showGhost(draggedPiece, pos.row, pos.col); } else { clearGhost(); } }
    
    // --- Обработчики Drag & Drop (для мыши) ---
    piecesContainer.addEventListener('dragstart', (e) => { if (isAnimating || e.target.classList.contains('unplaceable')) { e.preventDefault(); return; } const pieceDiv = e.target.closest('.piece-preview'); if (!pieceDiv) return; const pieceId = parseFloat(pieceDiv.dataset.pieceId); draggedPiece = currentPieces.find(p => p && p.id === pieceId); e.dataTransfer.setData('text/plain', pieceId); e.dataTransfer.effectAllowed = 'move'; setTimeout(() => pieceDiv.classList.add('dragging'), 0); });
    piecesContainer.addEventListener('dragend', (e) => { if (isAnimating) return; e.target.classList.remove('dragging'); clearGhost(); draggedPiece = null; });
    boardElement.addEventListener('dragover', (e) => { e.preventDefault(); handleMove(e.target); });
    boardElement.addEventListener('dragleave', (e) => { if (!e.relatedTarget || !boardElement.contains(e.relatedTarget)) clearGhost(); });
    boardElement.addEventListener('drop', (e) => { e.preventDefault(); handleDrop(e.target); });

    // --- Функция для обновления в requestAnimationFrame ---
    function performTouchUpdate() {
        if (!touchUpdateScheduled) return;
        if (touchClone) {
            touchClone.style.transform = `translate(${lastTouchX - touchClone.offsetWidth / 2}px, ${lastTouchY - touchClone.offsetHeight / 2 + TOUCH_OFFSET_Y}px)`;
        }
        const elementUnderTouch = document.elementFromPoint(lastTouchX, lastTouchY + TOUCH_OFFSET_Y);
        handleMove(elementUnderTouch);
        touchUpdateScheduled = false;
    }

    // --- Обработчики Touch-событий ---
    piecesContainer.addEventListener('touchstart', (e) => {
        const pieceDiv = e.target.closest('.piece-preview');
        if (isAnimating || !pieceDiv || pieceDiv.classList.contains('unplaceable')) { return; }
        
        const pieceId = parseFloat(pieceDiv.dataset.pieceId);
        draggedPiece = currentPieces.find(p => p && p.id === pieceId);
        if (!draggedPiece) return;

        e.preventDefault();

        // --- ИЗМЕНЕНИЕ: Запоминаем и скрываем оригинал ---
        draggedPieceOriginalDiv = pieceDiv;
        draggedPieceOriginalDiv.style.display = 'none';

        touchClone = pieceDiv.cloneNode(true);
        touchClone.style.position = 'absolute';
        touchClone.style.zIndex = '1000';
        touchClone.style.pointerEvents = 'none';
        touchClone.style.left = '0';
        touchClone.style.top = '0';
        touchClone.style.display = 'block'; // Убедимся, что клон видим
        document.body.appendChild(touchClone);

        const touch = e.touches[0];
        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;
        
        touchClone.style.transform = `translate(${lastTouchX - touchClone.offsetWidth / 2}px, ${lastTouchY - touchClone.offsetHeight / 2 + TOUCH_OFFSET_Y}px)`;
    }, { passive: false });

    document.body.addEventListener('touchmove', (e) => {
        if (!draggedPiece || !touchClone) return;
        e.preventDefault();
        const touch = e.touches[0];
        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;
        if (!touchUpdateScheduled) {
            touchUpdateScheduled = true;
            window.requestAnimationFrame(performTouchUpdate);
        }
    }, { passive: false });

    document.body.addEventListener('touchend', (e) => {
        if (!draggedPiece || !touchClone) return;

        touchUpdateScheduled = false;
        const touch = e.changedTouches[0];
        const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY + TOUCH_OFFSET_Y);
        
        // --- ИЗМЕНЕНИЕ: Возвращаем видимость оригиналу ---
        if (draggedPieceOriginalDiv) {
            draggedPieceOriginalDiv.style.display = ''; // Сбрасываем инлайн-стиль
        }

        handleDrop(elementUnderTouch);
        
        touchClone.remove();

        // Сбрасываем состояние
        touchClone = null;
        draggedPieceOriginalDiv = null;
        draggedPiece = null;
    });
    
    // --- Кнопки ---
    if (newGameBtn) { newGameBtn.addEventListener('click', () => { if (confirm("Вы уверены, что хотите начать новую игру? Текущий прогресс будет потерян.")) { deleteGameState(); initGame(true); } }); }
    if (restartFromGameOverBtn) { restartFromGameOverBtn.addEventListener('click', () => { gameOverScreen.classList.add('hidden'); initGame(true); }); }

    // --- Запуск игры ---
    initGame();
});
