/**
 * cropper.js
 * 
 * グリッド分割および自由選択モードでの切り抜き領域（Rect）の管理と描画、
 * そして実際のキャンバスからの画像切り出し（imageProcessorへの橋渡し）を行う。
 */
import { getActiveImage } from './imageLoader.js';
import { processImageForLine } from './imageProcessor.js';

let appState;
let appEls;
let renderCb;
let onCroppedCb;

// Grid Settings
let cols = 4;
let rows = 3;

// Free Selection State
let isDragging = false;
let startPos = { x: 0, y: 0 };
let currentPos = { x: 0, y: 0 };

export function initCropper(state, els, renderFn, onCroppedFn) {
    appState = state;
    appEls = els;
    renderCb = renderFn;
    onCroppedCb = onCroppedFn;

    // Grid Slider bindings
    const gridCols = document.getElementById('grid-cols');
    const colsVal = document.getElementById('cols-val');
    const gridRows = document.getElementById('grid-rows');
    const rowsVal = document.getElementById('rows-val');

    gridCols.addEventListener('input', (e) => {
        cols = parseInt(e.target.value, 10);
        colsVal.textContent = cols;
        renderCb();
    });

    gridRows.addEventListener('input', (e) => {
        rows = parseInt(e.target.value, 10);
        rowsVal.textContent = rows;
        renderCb();
    });

    // 自由選択（ドラッグ）イベント
    appEls.canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // 一括切り抜きボタン
    appEls.btnCropAll.addEventListener('click', performCropAll);

    // グローバルに関数を登録（app.jsから呼ばれる描画フック）
    window.cropperRenderOverlay = renderOverlay;
}

/**
 * プレビュー画面上にグリッド線や選択範囲を描画する
 */
function renderOverlay(ctx, w, h) {
    if (appState.currentMode === 'grid') {
        const cellW = w / cols;
        const cellH = h / rows;

        ctx.strokeStyle = 'rgba(255, 80, 80, 0.7)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);

        ctx.beginPath();
        // 縦線
        for (let i = 1; i < cols; i++) {
            ctx.moveTo(i * cellW, 0);
            ctx.lineTo(i * cellW, h);
        }
        // 横線
        for (let j = 1; j < rows; j++) {
            ctx.moveTo(0, j * cellH);
            ctx.lineTo(w, j * cellH);
        }
        ctx.stroke();
        ctx.setLineDash([]); // reset
    } else if (appState.currentMode === 'free' && isDragging) {
        // SVG or HTML border is better for this, but doing it in Canvas is also fine.
        // We will use the HTML #drag-selection-box for CSS animation styling.
    }
}

// ---- Mouse Events for Free Selection ----

function getCanvasProps() {
    const rect = appEls.canvas.getBoundingClientRect();
    const scaleX = appEls.canvas.width / rect.width;
    const scaleY = appEls.canvas.height / rect.height;
    return { rect, scaleX, scaleY };
}

function onMouseDown(e) {
    if (appState.currentMode !== 'free' || appState.isPickingColor) return;

    // Prevent default to stop text selection while dragging
    e.preventDefault();

    const { rect, scaleX, scaleY } = getCanvasProps();

    const cw = appEls.canvas.width;
    const ch = appEls.canvas.height;

    let x = (e.clientX - rect.left) * scaleX;
    let y = (e.clientY - rect.top) * scaleY;

    // Clamp to canvas
    x = Math.max(0, Math.min(x, cw));
    y = Math.max(0, Math.min(y, ch));

    isDragging = true;
    startPos = { x, y };
    currentPos = { x, y };

    // Show HTML selection box
    const selBox = document.getElementById('drag-selection-box');
    selBox.style.display = 'block';
    updateSelectionBox();
}

function onMouseMove(e) {
    if (!isDragging) return;

    const { rect, scaleX, scaleY } = getCanvasProps();
    const cw = appEls.canvas.width;
    const ch = appEls.canvas.height;

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

    // Convert canvas coordinates back to screen pixels for the CSS overlay
    const x = Math.min(startPos.x, currentPos.x) / scaleX;
    const y = Math.min(startPos.y, currentPos.y) / scaleY;
    const w = Math.abs(currentPos.x - startPos.x) / scaleX;
    const h = Math.abs(currentPos.y - startPos.y) / scaleY;

    // canvas position relative to the wrapper
    // The wrapper acts as the offsetParent
    const canvasOffsetTop = appEls.canvas.offsetTop;
    const canvasOffsetLeft = appEls.canvas.offsetLeft;

    selBox.style.left = `${canvasOffsetLeft + x}px`;
    selBox.style.top = `${canvasOffsetTop + y}px`;
    selBox.style.width = `${w}px`;
    selBox.style.height = `${h}px`;
}

function onMouseUp(e) {
    if (!isDragging) return;
    isDragging = false;

    const selBox = document.getElementById('drag-selection-box');
    selBox.style.display = 'none';

    // Rect dimensions on canvas
    const x = Math.min(startPos.x, currentPos.x);
    const y = Math.min(startPos.y, currentPos.y);
    const w = Math.abs(currentPos.x - startPos.x);
    const h = Math.abs(currentPos.y - startPos.y);

    if (w < 10 || h < 10) {
        // Click without moving or too small, ignore
        return;
    }

    // Execute crop for this single rect
    cropRectAndAdd(x, y, w, h);
}


// ---- Cropping Execution ----

/**
 * 現在の状態に基づいて、一括で切り抜いてリストへ登録する。
 * （自由選択モードの場合は、単体切り抜きとして呼ぶか、エラー表示）
 */
export async function performCropAll() {
    const activeImgObj = getActiveImage();
    if (!activeImgObj) {
        alert('まずは画像を追加してください。');
        return;
    }

    if (appState.currentMode === 'free') {
        alert('自由選択モードでは、画像の上をマウスでドラッグして切り抜いてください。');
        return;
    }

    // グリッドモード：全セルを切り抜く
    const w = appEls.canvas.width;
    const h = appEls.canvas.height;
    const cellW = w / cols;
    const cellH = h / rows;

    const blobs = [];

    // ボタン無効化（ローディング的処理）
    appEls.btnCropAll.disabled = true;
    appEls.btnCropAll.textContent = '処理中...';

    try {
        for (let j = 0; j < rows; j++) {
            for (let i = 0; i < cols; i++) {
                const rx = i * cellW;
                const ry = j * cellH;
                const blob = await extractRegionAndProcess(activeImgObj, rx, ry, cellW, cellH);
                blobs.push(blob);
            }
        }

        // 追加
        if (onCroppedCb) onCroppedCb(blobs);

    } catch (err) {
        console.error("Crop error:", err);
        alert("切り抜き中にエラーが発生しました。");
    } finally {
        appEls.btnCropAll.disabled = false;
        appEls.btnCropAll.textContent = '一括切り抜き(一覧へ)';
    }
}

/**
 * 任意の座標領域を切り抜いてリストへ追加（主に自由選択用）
 */
async function cropRectAndAdd(x, y, w, h) {
    const activeImgObj = getActiveImage();
    if (!activeImgObj) return;

    try {
        const blob = await extractRegionAndProcess(activeImgObj, x, y, w, h);
        if (onCroppedCb) onCroppedCb([blob]);
    } catch (err) {
        console.error("Free crop error", err);
    }
}

/**
 * 実際の切り抜き処理と、LINE仕様への変換
 */
async function extractRegionAndProcess(imgObj, x, y, w, h) {
    // 1. 部分切り出し用の作業キャンバス作成
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = Math.round(w);
    tempCanvas.height = Math.round(h);
    const ctx = tempCanvas.getContext('2d');

    // もし透過処理済みのデータがあればそちらを使う
    if (imgObj.processedImageData) {
        // Copy processedData to a temporary canvas so we can drawImage from it
        const pt = document.createElement('canvas');
        pt.width = imgObj.img.width;
        pt.height = imgObj.img.height;
        pt.getContext('2d').putImageData(imgObj.processedImageData, 0, 0);

        ctx.drawImage(pt, x, y, w, h, 0, 0, w, h);
    } else {
        // Original image
        ctx.drawImage(imgObj.img, x, y, w, h, 0, 0, w, h);
    }

    // 2. imageProcessor に渡してLINE仕様のBlob化 (370x320 max, margin included)
    return await processImageForLine(tempCanvas, appState.useMargin);
}
