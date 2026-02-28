/**
 * export.js
 * 
 * 現在のスタンプリストからZIPファイルを生成してダウンロードさせる。
 * 指定されたメイン画像（240x240）とタブ画像（96x74）の自動リサイズも行う。
 */

import { getStamps } from './stampList.js';
import { blobToImage } from './imageProcessor.js';

let selMainImg, selTabImg, btnDownload;

export function initExport() {
    selMainImg = document.getElementById('select-main-img');
    selTabImg = document.getElementById('select-tab-img');
    btnDownload = document.getElementById('btn-download-zip');

    // Make global for stampList.js
    window.exportSyncDropdowns = syncDropdowns;

    btnDownload.addEventListener('click', handleDownload);
}

/**
 * スタンプリストが更新されたら、ドロップダウンの選択肢を同期する
 */
export function syncDropdowns(count) {
    // 現在の選択を記憶
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

    // 以前の選択がまだ有効なら復元
    if (currentMain && parseInt(currentMain, 10) < count) selMainImg.value = currentMain;
    if (currentTab && parseInt(currentTab, 10) < count) selTabImg.value = currentTab;
}

/**
 * ZIP生成とダウンロードフロー
 */
async function handleDownload() {
    const stamps = getStamps();
    if (stamps.length === 0) return;

    if (typeof JSZip === 'undefined') {
        alert("JSZipライブラリが読み込まれていません。ネットワーク接続を確認してください。");
        return;
    }

    btnDownload.disabled = true;
    const originalText = btnDownload.innerHTML;
    btnDownload.textContent = 'ZIP生成中...';

    try {
        const zip = new JSZip();

        // 1. メイン画像 (main.png: 240x240) の生成
        const mainIdx = selMainImg.value !== "" ? parseInt(selMainImg.value, 10) : 0;
        const mainBlob = await resizeForLine(stamps[mainIdx], 240, 240, false); // 余白なし、単なるフィット
        zip.file("main.png", mainBlob);

        // 2. タブ画像 (tab.png: 96x74) の生成
        // （別々の画像を選んでいない場合は、メインと同じものをベースにする）
        const tabIdx = selTabImg.value !== "" ? parseInt(selTabImg.value, 10) : 0;
        const tabBlob = await resizeForLine(stamps[tabIdx], 96, 74, false); // 余白なし、単なるフィット
        zip.file("tab.png", tabBlob);

        // 3. 各スタンプ画像を 01.png, 02.png... として追加
        stamps.forEach((blob, index) => {
            const numStr = String(index + 1).padStart(2, '0');
            zip.file(`${numStr}.png`, blob);
        });

        // 4. ZIP生成とダウンロード
        const content = await zip.generateAsync({ type: "blob" });

        // ファイル名は日付で
        const dateStr = new Date().toISOString().replace(/[:\-T]/g, '').slice(0, 14);
        const filename = `line_stamps_${dateStr}.zip`;

        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Timeout to ensure download dialog has time to appear before revoking
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);

    } catch (err) {
        console.error("ZIP Export Error:", err);
        alert("ZIPファイルの生成に失敗しました。");
    } finally {
        btnDownload.disabled = false;
        btnDownload.innerHTML = originalText;
    }
}

/**
 * メイン画像、タブ画像用に、指定サイズ内にアスペクト比を維持して中央配置でリサイズする。
 */
async function resizeForLine(sourceBlob, targetW, targetH, ensureEven = false) {
    const { img, url } = await blobToImage(sourceBlob);

    return new Promise((resolve, reject) => {
        const srcW = img.width;
        const srcH = img.height;

        const scale = Math.min(targetW / srcW, targetH / srcH);

        let fw = Math.round(srcW * scale);
        let fh = Math.round(srcH * scale);

        // if ensuring even size (not strictly required for main/tab if exact bounds are used, but we'll use exactly target size for main and tab as LINE expects it to be tight or exact.)
        // LINE spec says main is exactly 240x240, tab is exactly 96x74. So we create a canvas of exactly that size and draw the image scaled in the center.
        let canvasW = targetW;
        let canvasH = targetH;

        const canvas = document.createElement('canvas');
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext('2d');

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        const ox = Math.round((canvasW - fw) / 2);
        const oy = Math.round((canvasH - fh) / 2);

        // LINE main/tab are also PNG with transparency
        ctx.clearRect(0, 0, canvasW, canvasH);
        ctx.drawImage(img, 0, 0, srcW, srcH, ox, oy, fw, fh);

        URL.revokeObjectURL(url); // clean up memory

        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Failed to create blob"));
        }, "image/png");
    });
}
