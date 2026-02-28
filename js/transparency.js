/**
 * transparency.js
 * 
 * 指定された色に近い背景色を「端から」すべて透過する処理（Flood Fill）を行う。
 * また、輪郭部分のピクセルに対して簡易的なアンチエイリアス処理を適用する。
 */
import { getActiveImage } from './imageLoader.js';

let appState;
let appEls;
let renderCanvasCb;

export function initTransparency(state, els, renderCb) {
    appState = state;
    appEls = els;
    renderCanvasCb = renderCb;

    // スポイトボタン
    appEls.btnPicker.addEventListener('click', () => {
        appState.isPickingColor = true;
        appEls.canvas.style.cursor = 'crosshair';
        appEls.btnPicker.classList.add('active'); // assuming some visual feedback
    });

    // 許容値スライダー
    appEls.sliderTolerance.addEventListener('input', (e) => {
        appState.tolerance = parseInt(e.target.value, 10);
        appEls.valTolerance.textContent = appState.tolerance;
    });

    // キャンバス上のクリックによる色取得
    appEls.canvas.addEventListener('click', (e) => {
        if (!appState.isPickingColor) return;

        const rect = appEls.canvas.getBoundingClientRect();

        // CSS上の表示サイズと実際のピクセルサイズの比率を計算
        const scaleX = appEls.canvas.width / rect.width;
        const scaleY = appEls.canvas.height / rect.height;

        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);

        pickColor(x, y);

        // Reset picking state
        appState.isPickingColor = false;
        appEls.canvas.style.cursor = appState.currentMode === 'free' ? 'crosshair' : 'default';
        appEls.btnPicker.classList.remove('active');
    });

    // 透過実行ボタン
    appEls.btnApplyTrans.addEventListener('click', () => {
        applyTransparency();
    });
}

function pickColor(x, y) {
    const activeImgObj = getActiveImage();
    if (!activeImgObj) return;

    // もしすでに透過処理済みのデータがあればそこから、なければ元の画像から
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

    // 透明部分をクリックした場合は無視
    if (a < 10) return;

    appState.transparencyColor = { r, g, b };
    appEls.colorPreview.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
}

/**
 * 透過処理本体
 */
export function applyTransparency() {
    const activeImgObj = getActiveImage();
    if (!activeImgObj || !appState.transparencyColor) return;

    const w = activeImgObj.img.width;
    const h = activeImgObj.img.height;

    // Always start fresh from the original image for applying new transparency
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const ctx = tempCanvas.getContext('2d');
    ctx.drawImage(activeImgObj.img, 0, 0);
    const imageData = ctx.getImageData(0, 0, w, h);

    // Flood Fill
    const processedData = floodFillTransparent(
        imageData,
        appState.transparencyColor,
        appState.tolerance
    );

    // Save to state
    activeImgObj.processedImageData = processedData;

    // Redraw
    renderCanvasCb();
}

/**
 * 色の差を判定（RGB空間のユークリッド距離的な簡易版）
 */
function isWithinTolerance(r1, g1, b1, targetR, targetG, targetB, tolerance) {
    // 0〜255の差を計算
    const dr = Math.abs(r1 - targetR);
    const dg = Math.abs(g1 - targetG);
    const db = Math.abs(b1 - targetB);

    // 最大差が tolerance 以内か
    // (RGBの最大差をチェックするのが最も直感的)
    return Math.max(dr, dg, db) <= tolerance;
}

/**
 * 塗りつぶしアルゴリズム (Scanline Flood Fill 方式)
 * 画像の四隅から探索を開始し、指定色に近い領域のアルファ値を0にする。
 */
function floodFillTransparent(imageData, targetColor, tolerance) {
    const w = imageData.width;
    const h = imageData.height;
    const data = imageData.data;

    // 訪問済みフラグ（w*h の Uint8Array配列。0:未訪問, 1:訪問済みまたは透明化済み）
    const visited = new Uint8Array(w * h);
    const stack = [];

    // 開始点を四隅および四辺上のいくらかのポイントに設定
    // ※閉じた図形以外（外側）を全て塗りつぶすため
    for (let x = 0; x < w; x++) {
        stack.push(x); stack.push(0);           // Top edge
        stack.push(x); stack.push(h - 1);       // Bottom edge
    }
    for (let y = 0; y < h; y++) {
        stack.push(0); stack.push(y);           // Left edge
        stack.push(w - 1); stack.push(y);       // Right edge
    }

    const { r: tr, g: tg, b: tb } = targetColor;

    // 境界ピクセルのインデックスを保存（アンチエイリアスのため）
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

        if (a === 0) continue; // 既に透明

        if (isWithinTolerance(r, g, b, tr, tg, tb, tolerance)) {
            // 背景なので透明化
            data[dataIdx + 3] = 0; // Alpha = 0

            // 上下左右をスタックに追加
            stack.push(x + 1, y);
            stack.push(x - 1, y);
            stack.push(x, y + 1);
            stack.push(x, y - 1);
        } else {
            // 許容値外（前景）とぶつかった場合は、そのピクセルは境界線
            boundaryPixels.add(pixelIdx);
        }
    }

    // アンチエイリアス処理（境界ピクセルの透過度を半減など）
    applyAntiAlias(data, boundaryPixels);

    return imageData;
}

function applyAntiAlias(data, boundaryPixelsSet) {
    // 簡易的なアンチエイリアス：境界のピクセル（輪郭線）のアルファ値を下げる
    // さらに滑らかにするには畳み込みフィルターなどが必要だが、処理速度との兼ね合いで簡易版
    boundaryPixelsSet.forEach(pixelIdx => {
        const idx = pixelIdx * 4;
        // 完全不透明の場合のみ、少し透明にして背景となじませる
        if (data[idx + 3] === 255) {
            data[idx + 3] = 180; // 約70%の不透明度
        }
    });
}
