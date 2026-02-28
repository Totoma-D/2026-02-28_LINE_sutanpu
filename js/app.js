// ==========================================
// imageProcessor.js
// ==========================================
const MAX_WIDTH = 370;
const MAX_HEIGHT = 320;
const MARGIN = 10;

async function processImageForLine(source, addMargin = true) {
    return new Promise((resolve, reject) => {
        const targetW = MAX_WIDTH;
        const targetH = MAX_HEIGHT;
        const Math_min = Math.min;
        const drawW = addMargin ? targetW - (MARGIN * 2) : targetW;
        const drawH = addMargin ? targetH - (MARGIN * 2) : targetH;
        const srcW = source.width;
        const srcH = source.height;

        if (srcW === 0 || srcH === 0) {
            reject(new Error("Invalid image source dimensions (0x0)"));
            return;
        }

        const scale = Math_min(drawW / srcW, drawH / srcH, 1.0);
        let finalW = Math.round(srcW * scale);
        let finalH = Math.round(srcH * scale);

        let canvasW = addMargin ? targetW : finalW;
        let canvasH = addMargin ? targetH : finalH;

        canvasW = canvasW % 2 !== 0 ? canvasW - 1 : canvasW;
        canvasH = canvasH % 2 !== 0 ? canvasH - 1 : canvasH;

        const canvas = document.createElement("canvas");
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext("2d");

        const offsetX = Math.round((canvasW - finalW) / 2);
        const offsetY = Math.round((canvasH - finalH) / 2);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.clearRect(0, 0, canvasW, canvasH);
        ctx.drawImage(source, 0, 0, srcW, srcH, offsetX, offsetY, finalW, finalH);

        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Canvas to Blob conversion failed"));
        }, "image/png");
    });
}

function blobToImage(blob) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(blob);
        img.onload = () => resolve({ img, url });
        img.onerror = () => reject(new Error("Failed to load image from blob"));
        img.src = url;
    });
}

// ==========================================
// imageLoader.js
// ==========================================
let images = [];
let activeId = null;
let imageIdCounter = 0;

function initImageLoader() {
    const btnAdd = document.getElementById('btn-add-image');
    const uploadInput = document.getElementById('upload-input');
    const dropArea = document.getElementById('preview-wrapper');

    btnAdd.addEventListener('click', () => uploadInput.click());

    uploadInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
        uploadInput.value = '';
    });

    dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropArea.style.opacity = '0.7';
    });
    dropArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropArea.style.opacity = '1';
    });
    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.style.opacity = '1';
        if (e.dataTransfer && e.dataTransfer.files) handleFiles(e.dataTransfer.files);
    });
}

function handleFiles(files) {
    if (!files || files.length === 0) return;
    Array.from(files).forEach(file => {
        if (!file.type.match(/^image\/(png|jpeg|webp)$/)) {
            alert(`非対応のファイル形式です: ${file.name}`);
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const newImgObj = {
                    id: ++imageIdCounter,
                    name: file.name,
                    file: file,
                    img: img,
                    processedImageData: null,
                    history: [] // For Undo
                };
                images.push(newImgObj);
                addTab(newImgObj);
                if (images.length === 1) {
                    setActiveImage(newImgObj.id);
                    onImageLoaded(newImgObj);
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function addTab(imgObj) {
    const tabsScroll = document.getElementById('image-tabs');
    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.dataset.id = imgObj.id;
    const label = document.createElement('span');
    label.textContent = imgObj.name.length > 15 ? imgObj.name.substring(0, 12) + "..." : imgObj.name;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close';
    closeBtn.innerHTML = '✕';
    closeBtn.title = 'この画像を削除';
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeImage(imgObj.id);
    });

    tab.addEventListener('click', () => {
        if (activeId !== imgObj.id) {
            setActiveImage(imgObj.id);
            onImageChanged();
        }
    });
    tab.appendChild(label);
    tab.appendChild(closeBtn);
    tabsScroll.appendChild(tab);
}

function setActiveImage(id) {
    activeId = id;
    document.querySelectorAll('.tab').forEach(t => {
        if (parseInt(t.dataset.id, 10) === id) t.classList.add('active');
        else t.classList.remove('active');
    });
}

function removeImage(id) {
    const index = images.findIndex(img => img.id === id);
    if (index === -1) return;
    images.splice(index, 1);
    const tabNode = document.querySelector(`.tab[data-id="${id}"]`);
    if (tabNode) tabNode.remove();

    if (images.length === 0) {
        activeId = null;
        els.emptyState.style.display = 'flex';
        appState.canvasCtx.clearRect(0, 0, els.canvas.width, els.canvas.height);
        onImageChanged();
    } else if (activeId === id) {
        setActiveImage(images[0].id);
        onImageChanged();
    }
}

function getActiveImage() {
    if (!activeId) return null;
    return images.find(img => img.id === activeId) || null;
}

// ==========================================
// transparency.js
// ==========================================
function initTransparency() {
    els.btnPicker.addEventListener('click', () => {
        appState.isPickingColor = true;
        els.canvas.style.cursor = 'crosshair';
        els.btnPicker.classList.add('active');
    });

    els.sliderTolerance.addEventListener('input', (e) => {
        appState.tolerance = parseInt(e.target.value, 10);
        els.valTolerance.textContent = appState.tolerance;
    });

    els.canvas.addEventListener('click', (e) => {
        if (!appState.isPickingColor) return;
        const rect = els.canvas.getBoundingClientRect();
        const scaleX = els.canvas.width / rect.width;
        const scaleY = els.canvas.height / rect.height;
        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);

        pickColor(x, y);

        appState.isPickingColor = false;
        els.canvas.style.cursor = appState.currentMode === 'free' ? 'crosshair' : 'default';
        els.btnPicker.classList.remove('active');
    });

    els.btnApplyTrans.addEventListener('click', () => applyTransparency());
}

function pickColor(x, y) {
    const activeImgObj = getActiveImage();
    if (!activeImgObj) return;

    let sourceData;
    if (activeImgObj.processedImageData) {
        sourceData = activeImgObj.processedImageData;
    } else {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = activeImgObj.img.width;
        tempCanvas.height = activeImgObj.img.height;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(activeImgObj.img, 0, 0);
        sourceData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    }

    const index = (y * sourceData.width + x) * 4;
    const r = sourceData.data[index];
    const g = sourceData.data[index + 1];
    const b = sourceData.data[index + 2];
    const a = sourceData.data[index + 3];

    if (a < 10) return;

    appState.transparencyColor = { r, g, b };
    appState.transparencyPickPoint = { x, y };
    updateColorPreview({ r, g, b });
}

function applyTransparency() {
    const activeImgObj = getActiveImage();
    if (!activeImgObj || !appState.transparencyColor) return;

    const w = activeImgObj.img.width;
    const h = activeImgObj.img.height;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const ctx = tempCanvas.getContext('2d');
    ctx.drawImage(activeImgObj.img, 0, 0);

    const imageData = ctx.getImageData(0, 0, w, h);

    let processedData;
    if (els.contiguousToggle && els.contiguousToggle.checked) {
        const startPoints = appState.transparencyPickPoint ? [appState.transparencyPickPoint] : null;
        processedData = floodFillTransparent(imageData, appState.transparencyColor, appState.tolerance, startPoints);
    } else {
        processedData = globalColorReplace(imageData, appState.transparencyColor, appState.tolerance);
    }

    // Undoのために履歴に保存
    activeImgObj.history.push(activeImgObj.processedImageData);
    if (els.btnUndo) els.btnUndo.disabled = false;

    activeImgObj.processedImageData = processedData;
    renderCanvas();
}

function handleUndo() {
    const activeImgObj = getActiveImage();
    if (!activeImgObj || !activeImgObj.history || activeImgObj.history.length === 0) return;

    // 履歴から一つ前の状態を取り出す
    const previousState = activeImgObj.history.pop();
    activeImgObj.processedImageData = previousState;

    if (activeImgObj.history.length === 0 && els.btnUndo) {
        els.btnUndo.disabled = true;
    }

    renderCanvas();
}

function isWithinTolerance(r1, g1, b1, targetR, targetG, targetB, tolerance) {
    const dr = Math.abs(r1 - targetR);
    const dg = Math.abs(g1 - targetG);
    const db = Math.abs(b1 - targetB);
    return Math.max(dr, dg, db) <= tolerance;
}

function floodFillTransparent(imageData, targetColor, tolerance, startPoints = null) {
    const w = imageData.width;
    const h = imageData.height;
    const data = imageData.data;
    const visited = new Uint8Array(w * h);
    const stack = [];

    if (startPoints && startPoints.length > 0) {
        startPoints.forEach(p => {
            stack.push(Math.round(p.x), Math.round(p.y));
        });
    } else {
        for (let x = 0; x < w; x++) {
            stack.push(x, 0);
            stack.push(x, h - 1);
        }
        for (let y = 0; y < h; y++) {
            stack.push(0, y);
            stack.push(w - 1, y);
        }
    }

    const { r: tr, g: tg, b: tb } = targetColor;
    const boundaryPixels = new Set();

    while (stack.length > 0) {
        const y = stack.pop();
        const x = stack.pop();
        if (x < 0 || x >= w || y < 0 || y >= h) continue;

        const pixelIdx = y * w + x;
        if (visited[pixelIdx]) continue;
        visited[pixelIdx] = 1;

        const dataIdx = pixelIdx * 4;
        const r = data[dataIdx];
        const g = data[dataIdx + 1];
        const b = data[dataIdx + 2];
        const a = data[dataIdx + 3];

        if (a === 0) continue;

        if (isWithinTolerance(r, g, b, tr, tg, tb, tolerance)) {
            data[dataIdx + 3] = 0;
            stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
        } else {
            boundaryPixels.add(pixelIdx);
        }
    }

    applyAntiAlias(data, boundaryPixels);
    return imageData;
}

function applyAntiAlias(data, boundaryPixelsSet) {
    boundaryPixelsSet.forEach(pixelIdx => {
        const idx = pixelIdx * 4;
        if (data[idx + 3] === 255) data[idx + 3] = 180;
    });
}

// ==========================================
// cropper.js
// ==========================================
let cropCols = 4;
let cropRows = 3;
let isDragging = false;
let startPos = { x: 0, y: 0 };
let currentPos = { x: 0, y: 0 };

function initCropper() {
    const gridCols = document.getElementById('grid-cols');
    const colsVal = document.getElementById('cols-val');
    const gridRows = document.getElementById('grid-rows');
    const rowsVal = document.getElementById('rows-val');

    gridCols.addEventListener('input', (e) => {
        cropCols = parseInt(e.target.value, 10);
        colsVal.textContent = cropCols;
        renderCanvas();
    });

    gridRows.addEventListener('input', (e) => {
        cropRows = parseInt(e.target.value, 10);
        rowsVal.textContent = cropRows;
        renderCanvas();
    });

    els.canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    els.btnCropAll.addEventListener('click', performCropAll);
}

function renderOverlay(ctx, w, h) {
    if (appState.currentMode === 'grid') {
        const cellW = w / cropCols;
        const cellH = h / cropRows;
        ctx.strokeStyle = 'rgba(255, 80, 80, 0.7)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        for (let i = 1; i < cropCols; i++) {
            ctx.moveTo(i * cellW, 0);
            ctx.lineTo(i * cellW, h);
        }
        for (let j = 1; j < cropRows; j++) {
            ctx.moveTo(0, j * cellH);
            ctx.lineTo(w, j * cellH);
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

function getCanvasProps() {
    const rect = els.canvas.getBoundingClientRect();
    const scaleX = els.canvas.width / rect.width;
    const scaleY = els.canvas.height / rect.height;
    return { rect, scaleX, scaleY };
}

function onMouseDown(e) {
    if (appState.currentMode !== 'free' || appState.isPickingColor) return;
    e.preventDefault();
    const { rect, scaleX, scaleY } = getCanvasProps();
    const cw = els.canvas.width;
    const ch = els.canvas.height;

    let x = (e.clientX - rect.left) * scaleX;
    let y = (e.clientY - rect.top) * scaleY;
    x = Math.max(0, Math.min(x, cw));
    y = Math.max(0, Math.min(y, ch));

    isDragging = true;
    startPos = { x, y };
    currentPos = { x, y };

    document.getElementById('drag-selection-box').style.display = 'block';
    updateSelectionBox();
}

function onMouseMove(e) {
    if (!isDragging) return;
    const { rect, scaleX, scaleY } = getCanvasProps();
    const cw = els.canvas.width;
    const ch = els.canvas.height;
    let x = (e.clientX - rect.left) * scaleX;
    let y = (e.clientY - rect.top) * scaleY;
    x = Math.max(0, Math.min(x, cw));
    y = Math.max(0, Math.min(y, ch));

    currentPos = { x, y };
    updateSelectionBox();
}

function updateSelectionBox() {
    const selBox = document.getElementById('drag-selection-box');
    const { rect, scaleX, scaleY } = getCanvasProps();
    const x = Math.min(startPos.x, currentPos.x) / scaleX;
    const y = Math.min(startPos.y, currentPos.y) / scaleY;
    const w = Math.abs(currentPos.x - startPos.x) / scaleX;
    const h = Math.abs(currentPos.y - startPos.y) / scaleY;

    const canvasOffsetTop = els.canvas.offsetTop;
    const canvasOffsetLeft = els.canvas.offsetLeft;

    selBox.style.left = `${canvasOffsetLeft + x}px`;
    selBox.style.top = `${canvasOffsetTop + y}px`;
    selBox.style.width = `${w}px`;
    selBox.style.height = `${h}px`;
}

function onMouseUp(e) {
    if (!isDragging) return;
    isDragging = false;
    document.getElementById('drag-selection-box').style.display = 'none';

    const x = Math.min(startPos.x, currentPos.x);
    const y = Math.min(startPos.y, currentPos.y);
    const w = Math.abs(currentPos.x - startPos.x);
    const h = Math.abs(currentPos.y - startPos.y);

    if (w < 10 || h < 10) return;
    cropRectAndAdd(x, y, w, h);
}

async function performCropAll() {
    const activeImgObj = getActiveImage();
    if (!activeImgObj) {
        alert('まずは画像を追加してください。');
        return;
    }
    if (appState.currentMode === 'free') {
        alert('自由選択モードでは、画像の上をマウスでドラッグして切り抜いてください。');
        return;
    }
    const w = els.canvas.width;
    const h = els.canvas.height;
    const cellW = w / cropCols;
    const cellH = h / cropRows;

    const blobs = [];
    els.btnCropAll.disabled = true;
    els.btnCropAll.textContent = '処理中...';

    try {
        for (let j = 0; j < cropRows; j++) {
            for (let i = 0; i < cropCols; i++) {
                const rx = i * cellW;
                const ry = j * cellH;
                const blob = await extractRegionAndProcess(activeImgObj, rx, ry, cellW, cellH, appState.useMargin);
                blobs.push(blob);
            }
        }
        addItems(blobs);
    } catch (err) {
        console.error("Crop error:", err);
        alert("切り抜き中にエラーが発生しました。");
    } finally {
        els.btnCropAll.disabled = false;
        els.btnCropAll.textContent = '一括切り抜き(一覧へ)';
    }
}

async function cropRectAndAdd(x, y, w, h) {
    const activeImgObj = getActiveImage();
    if (!activeImgObj) return;
    try {
        const blob = await extractRegionAndProcess(activeImgObj, x, y, w, h, appState.useMargin);
        addItems([blob]);
    } catch (err) {
        console.error("Free crop error", err);
    }
}

async function extractRegionAndProcess(imgObj, x, y, w, h, useMargin) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = Math.round(w);
    tempCanvas.height = Math.round(h);
    const ctx = tempCanvas.getContext('2d');

    if (imgObj.processedImageData) {
        const pt = document.createElement('canvas');
        pt.width = imgObj.img.width;
        pt.height = imgObj.img.height;
        pt.getContext('2d').putImageData(imgObj.processedImageData, 0, 0);
        ctx.drawImage(pt, x, y, w, h, 0, 0, w, h);
    } else {
        ctx.drawImage(imgObj.img, x, y, w, h, 0, 0, w, h);
    }
    return await processImageForLine(tempCanvas, useMargin);
}

// ==========================================
// stampList.js
// ==========================================
const MAX_STAMPS = 40;
let stamps = [];
let listContainer;
let countBadge;

function initStampList() {
    listContainer = document.getElementById('stamp-list');
    countBadge = document.getElementById('stamp-count');

    const btnClearAll = document.getElementById('btn-clear-all');
    btnClearAll.addEventListener('click', () => {
        if (stamps.length === 0) return;
        if (confirm('リストからすべてのスタンプを削除しますか？')) {
            stamps = [];
            renderList();
        }
    });
}

function addItems(blobArray) {
    if (!blobArray || blobArray.length === 0) return;
    let addedCount = 0;
    for (const blob of blobArray) {
        if (stamps.length >= MAX_STAMPS) {
            alert(`最大保存枚数（${MAX_STAMPS}枚）に達しました。これ以上追加できません。`);
            break;
        }
        stamps.push(blob);
        addedCount++;
    }
    if (addedCount > 0) renderList();
}

function removeItem(index) {
    stamps.splice(index, 1);
    renderList();
}

function renderList() {
    listContainer.innerHTML = '';
    countBadge.textContent = stamps.length;

    syncDropdowns(stamps.length);

    const btnDownload = document.getElementById('btn-download-zip');
    if (btnDownload) btnDownload.disabled = stamps.length === 0;

    stamps.forEach((blob, index) => {
        const url = URL.createObjectURL(blob);
        const itemDiv = document.createElement('div');
        itemDiv.className = 'stamp-item';

        const img = document.createElement('img');
        img.src = url;
        img.onload = () => URL.revokeObjectURL(url);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'actions';
        const idxSpan = document.createElement('span');
        idxSpan.className = 'stamp-index';
        idxSpan.textContent = `#${String(index + 1).padStart(2, '0')}`;

        const btnDel = document.createElement('button');
        btnDel.className = 'btn-icon btn-danger';
        btnDel.innerHTML = '✕';
        btnDel.title = '削除';
        btnDel.addEventListener('click', () => removeItem(index));

        actionsDiv.appendChild(idxSpan);
        actionsDiv.appendChild(btnDel);
        itemDiv.appendChild(img);
        itemDiv.appendChild(actionsDiv);
        listContainer.appendChild(itemDiv);
    });
}

function getStamps() {
    return stamps;
}

// ==========================================
// export.js
// ==========================================
let selMainImg, selTabImg, btnDownloadZip;

function initExport() {
    selMainImg = document.getElementById('select-main-img');
    selTabImg = document.getElementById('select-tab-img');
    btnDownloadZip = document.getElementById('btn-download-zip');

    btnDownloadZip.addEventListener('click', handleDownload);
}

function syncDropdowns(count) {
    const currentMain = selMainImg.value;
    const currentTab = selTabImg.value;

    selMainImg.innerHTML = '<option value="">未設定 (リストから自動選択)</option>';
    selTabImg.innerHTML = '<option value="">未設定 (リストから自動選択)</option>';

    for (let i = 0; i < count; i++) {
        const idxStr = String(i + 1).padStart(2, '0');
        const optMain = document.createElement('option');
        optMain.value = i;
        optMain.textContent = `スタンプ #${idxStr}`;
        selMainImg.appendChild(optMain);

        const optTab = document.createElement('option');
        optTab.value = i;
        optTab.textContent = `スタンプ #${idxStr}`;
        selTabImg.appendChild(optTab);
    }

    if (currentMain && parseInt(currentMain, 10) < count) selMainImg.value = currentMain;
    if (currentTab && parseInt(currentTab, 10) < count) selTabImg.value = currentTab;
}

async function handleDownload() {
    const listStamps = getStamps();
    if (listStamps.length === 0) return;

    if (typeof JSZip === 'undefined') {
        alert("JSZipライブラリが読み込まれていません。ネットワーク接続を確認してください。");
        return;
    }

    btnDownloadZip.disabled = true;
    const originalText = btnDownloadZip.innerHTML;
    btnDownloadZip.textContent = 'ZIP生成中...';

    try {
        const zip = new JSZip();

        const mainIdx = selMainImg.value !== "" ? parseInt(selMainImg.value, 10) : 0;
        const mainBlob = await resizeForLine(listStamps[mainIdx], 240, 240);
        zip.file("main.png", mainBlob);

        const tabIdx = selTabImg.value !== "" ? parseInt(selTabImg.value, 10) : 0;
        const tabBlob = await resizeForLine(listStamps[tabIdx], 96, 74);
        zip.file("tab.png", tabBlob);

        listStamps.forEach((blob, index) => {
            const numStr = String(index + 1).padStart(2, '0');
            zip.file(`${numStr}.png`, blob);
        });

        const content = await zip.generateAsync({ type: "blob" });
        const dateStr = new Date().toISOString().replace(/[:\-T]/g, '').slice(0, 14);
        const filename = `line_stamps_${dateStr}.zip`;

        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => URL.revokeObjectURL(link.href), 1000);

    } catch (err) {
        console.error("ZIP Export Error:", err);
        alert("ZIPファイルの生成に失敗しました。");
    } finally {
        btnDownloadZip.disabled = false;
        btnDownloadZip.innerHTML = originalText;
    }
}

async function resizeForLine(sourceBlob, targetW, targetH) {
    const { img, url } = await blobToImage(sourceBlob);
    return new Promise((resolve, reject) => {
        const srcW = img.width;
        const srcH = img.height;
        const scale = Math.min(targetW / srcW, targetH / srcH);
        let fw = Math.round(srcW * scale);
        let fh = Math.round(srcH * scale);

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        const ox = Math.round((targetW - fw) / 2);
        const oy = Math.round((targetH - fh) / 2);

        ctx.clearRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, srcW, srcH, ox, oy, fw, fh);
        URL.revokeObjectURL(url);

        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Failed to create blob"));
        }, "image/png");
    });
}

// ==========================================
// app.js (Orchestrator)
// ==========================================
const els = {
    canvas: null,
    previewWrapper: null,
    emptyState: null,
    bgBtns: null,
    cropRadios: null,
    gridSettings: null,
    freeSettings: null,
    btnCropAll: null,
    marginToggle: null,
    sliderTolerance: null,
    valTolerance: null,
    btnApplyTrans: null,
    btnPicker: null,
    colorPreview: null,
    canvasContainer: null,
    contiguousToggle: null,
    btnUndo: null,
    btnGuide: null,
    guideModal: null,
    btnCloseGuide: null,
    guideMarkdownContent: null
};

const appState = {
    canvasCtx: null,
    currentMode: 'grid',
    transparencyColor: null,
    transparencyPickPoint: null,
    tolerance: 30,
    useMargin: true,
    isPickingColor: false,
    zoom: 1,
    panX: 0,
    panY: 0
};

function onImageLoaded(imgData) {
    els.emptyState.style.display = 'none';
    renderCanvas();
    if (!appState.transparencyColor) {
        guessBackgroundColor(imgData.img);
    }
}

function onImageChanged() {
    renderCanvas();
    appState.transparencyColor = null;
    updateColorPreview(null);

    const activeImgObj = getActiveImage();
    if (activeImgObj && activeImgObj.history && activeImgObj.history.length > 0) {
        if (els.btnUndo) els.btnUndo.disabled = false;
    } else {
        if (els.btnUndo) els.btnUndo.disabled = true;
    }
}

function setupBackgroundToggles() {
    els.bgBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            els.bgBtns.forEach(b => b.classList.remove('active'));
            const target = e.currentTarget;
            target.classList.add('active');
            const bgClass = target.dataset.bg;
            els.previewWrapper.className = `preview-wrapper bg-${bgClass}`;
        });
    });
}

function setupCropModeSwitch() {
    els.cropRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            appState.currentMode = e.target.value;
            if (appState.currentMode === 'grid') {
                els.gridSettings.style.display = 'block';
                els.freeSettings.style.display = 'none';
            } else {
                els.gridSettings.style.display = 'none';
                els.freeSettings.style.display = 'block';
            }
            renderCanvas();
        });
    });
    els.marginToggle.addEventListener('change', (e) => {
        appState.useMargin = e.target.checked;
    });
}

function renderCanvas() {
    const activeImgObj = getActiveImage();
    if (!activeImgObj) return;
    const img = activeImgObj.img;
    els.canvas.width = img.width;
    els.canvas.height = img.height;
    appState.canvasCtx.clearRect(0, 0, els.canvas.width, els.canvas.height);
    appState.canvasCtx.drawImage(img, 0, 0);

    if (activeImgObj.processedImageData) {
        appState.canvasCtx.putImageData(activeImgObj.processedImageData, 0, 0);
    }
    renderOverlay(appState.canvasCtx, els.canvas.width, els.canvas.height);

    if (!activeImgObj.initialZoomSet) {
        const wrapperRect = els.previewWrapper.getBoundingClientRect();
        const padding = 40;
        const availableW = wrapperRect.width - padding;
        const availableH = wrapperRect.height - padding;

        const scaleX = availableW / img.width;
        const scaleY = availableH / img.height;
        appState.zoom = Math.min(scaleX, scaleY, 1.0);

        const scaledW = img.width * appState.zoom;
        const scaledH = img.height * appState.zoom;
        appState.panX = (wrapperRect.width - scaledW) / 2;
        appState.panY = (wrapperRect.height - scaledH) / 2;

        activeImgObj.initialZoomSet = true;
    }
    if (typeof applyCanvasTransform === 'function') {
        applyCanvasTransform();
    }
}

function guessBackgroundColor(img) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 1; tempCanvas.height = 1;
    const ctx = tempCanvas.getContext('2d');
    ctx.drawImage(img, 0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    const color = { r: data[0], g: data[1], b: data[2] };
    appState.transparencyColor = color;
    updateColorPreview(color);
}

function updateColorPreview(color) {
    if (color) els.colorPreview.style.backgroundColor = `rgb(${color.r}, ${color.g}, ${color.b})`;
    else els.colorPreview.style.backgroundColor = 'transparent';
}

function globalColorReplace(imageData, targetColor, tolerance) {
    const w = imageData.width;
    const h = imageData.height;
    const data = imageData.data;
    const { r: tr, g: tg, b: tb } = targetColor;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a === 0) continue;
        if (isWithinTolerance(r, g, b, tr, tg, tb, tolerance)) {
            data[i + 3] = 0;
        }
    }

    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const idx = (y * w + x) * 4;
            if (data[idx + 3] > 0) {
                if (data[((y) * w + (x - 1)) * 4 + 3] === 0 ||
                    data[((y) * w + (x + 1)) * 4 + 3] === 0 ||
                    data[((y - 1) * w + x) * 4 + 3] === 0 ||
                    data[((y + 1) * w + x) * 4 + 3] === 0) {
                    data[idx + 3] = 180;
                }
            }
        }
    }
    return imageData;
}

let isPanning = false;
let panStart = { x: 0, y: 0 };

function setupPanZoom() {
    els.previewWrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        const activeImgObj = getActiveImage();
        if (!activeImgObj) return;

        const wrapperRect = els.previewWrapper.getBoundingClientRect();
        const mouseX = e.clientX - wrapperRect.left;
        const mouseY = e.clientY - wrapperRect.top;

        const zoomSensitivity = 0.05;
        const oldZoom = appState.zoom;
        if (e.deltaY < 0) {
            appState.zoom += zoomSensitivity * appState.zoom;
        } else {
            appState.zoom -= zoomSensitivity * appState.zoom;
        }
        appState.zoom = Math.max(0.1, Math.min(appState.zoom, 10));

        const scaleChange = appState.zoom - oldZoom;
        appState.panX -= (mouseX - appState.panX) * (scaleChange / oldZoom);
        appState.panY -= (mouseY - appState.panY) * (scaleChange / oldZoom);

        applyCanvasTransform();
    }, { passive: false });

    els.previewWrapper.addEventListener('mousedown', (e) => {
        if (e.button === 1 || e.button === 2) {
            e.preventDefault();
            isPanning = true;
            panStart = { x: e.clientX - appState.panX, y: e.clientY - appState.panY };
            els.previewWrapper.style.cursor = 'grab';
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (isPanning) {
            appState.panX = e.clientX - panStart.x;
            appState.panY = e.clientY - panStart.y;
            applyCanvasTransform();
        }
    });

    window.addEventListener('mouseup', (e) => {
        if (isPanning) {
            isPanning = false;
            els.previewWrapper.style.cursor = 'default';
        }
    });

    els.previewWrapper.addEventListener('contextmenu', e => e.preventDefault());
}

function applyCanvasTransform() {
    if (els.canvasContainer) {
        els.canvasContainer.style.transform = `translate(${appState.panX}px, ${appState.panY}px) scale(${appState.zoom})`;
    }
}

function init() {
    els.canvas = document.getElementById('main-canvas');
    els.previewWrapper = document.getElementById('preview-wrapper');
    els.emptyState = document.getElementById('empty-state');
    els.bgBtns = document.querySelectorAll('.bg-btn');
    els.cropRadios = document.querySelectorAll('input[name="crop-mode"]');
    els.gridSettings = document.getElementById('grid-settings');
    els.freeSettings = document.getElementById('free-settings');
    els.btnCropAll = document.getElementById('btn-crop-all');
    els.marginToggle = document.getElementById('margin-toggle');
    els.sliderTolerance = document.getElementById('tolerance-slider');
    els.valTolerance = document.getElementById('tolerance-val');
    els.btnApplyTrans = document.getElementById('btn-apply-transparency');
    els.btnPicker = document.getElementById('btn-picker');
    els.colorPreview = document.getElementById('picked-color');
    els.canvasContainer = document.getElementById('canvas-container');
    els.contiguousToggle = document.getElementById('contiguous-toggle');
    els.btnUndo = document.getElementById('btn-undo');
    els.btnGuide = document.getElementById('btn-guide');
    els.guideModal = document.getElementById('guide-modal');
    els.btnCloseGuide = document.getElementById('btn-close-guide');
    els.guideMarkdownContent = document.getElementById('guide-markdown-content');

    appState.canvasCtx = els.canvas.getContext('2d');

    initImageLoader();
    initTransparency();
    initCropper();
    initStampList();
    initExport();

    setupBackgroundToggles();
    setupCropModeSwitch();
    setupPanZoom();

    if (els.btnUndo) {
        els.btnUndo.addEventListener('click', handleUndo);
    }

    if (els.btnGuide && els.guideModal && els.btnCloseGuide && els.guideMarkdownContent) {
        els.btnGuide.addEventListener('click', () => {
            const mdElement = document.getElementById('guide-markdown');
            if (mdElement && typeof marked !== 'undefined') {
                els.guideMarkdownContent.innerHTML = marked.parse(mdElement.textContent);
            } else if (mdElement) {
                // Failsafe if marked.js is not loaded
                els.guideMarkdownContent.innerText = mdElement.textContent;
            }
            els.guideModal.style.display = 'flex';
        });

        els.btnCloseGuide.addEventListener('click', () => {
            els.guideModal.style.display = 'none';
        });

        // Click outside to close
        els.guideModal.addEventListener('click', (e) => {
            if (e.target === els.guideModal) {
                els.guideModal.style.display = 'none';
            }
        });
    }

    window.addEventListener('resize', () => {
        if (getActiveImage()) renderCanvas();
    });
}

document.addEventListener('DOMContentLoaded', init);
