/**
 * imageProcessor.js
 * 
 * LINEスタンプ用画像の仕様に合わせて、
 * 指定された領域（Canvas全体または切り抜き部分）を
 * 370x320（アスペクト比維持、10px余白、偶数化）のBlob(PNG)にして返す。
 */

export const MAX_WIDTH = 370;
export const MAX_HEIGHT = 320;
export const MARGIN = 10;

/**
 * 元の画像を LINE スタンプ仕様の Canvas に変換してBlobを返す
 * @param {HTMLCanvasElement|HTMLImageElement} source 
 * @param {boolean} addMargin 10pxの余白を追加するかどうか
 * @returns {Promise<Blob>}
 */
export async function processImageForLine(source, addMargin = true) {
    return new Promise((resolve, reject) => {
        const targetW = MAX_WIDTH;
        const targetH = MAX_HEIGHT;

        // 余白を考慮した最大描画可能領域
        const drawW = addMargin ? targetW - (MARGIN * 2) : targetW;
        const drawH = addMargin ? targetH - (MARGIN * 2) : targetH;

        // 元画像のサイズ
        const srcW = source.width;
        const srcH = source.height;

        if (srcW === 0 || srcH === 0) {
            reject(new Error("Invalid image source dimensions (0x0)"));
            return;
        }

        // アスペクト比を維持しつつ、drawW x drawH に収まるスケールを計算
        const scale = Math.min(drawW / srcW, drawH / srcH, 1.0); // 拡大はしない（元より小さければそのまま）

        let finalW = Math.round(srcW * scale);
        let finalH = Math.round(srcH * scale);

        // 余白オプションがONなら最終サイズはキャンバス全体(370x320)
        // OFFなら、画像そのもののサイズ（ただし偶数化）
        let canvasW = addMargin ? targetW : finalW;
        let canvasH = addMargin ? targetH : finalH;

        // LINE仕様：幅・高さは偶数でなければならない
        canvasW = canvasW % 2 !== 0 ? canvasW - 1 : canvasW;
        canvasH = canvasH % 2 !== 0 ? canvasH - 1 : canvasH;

        // 描画先キャンバスの作成
        const canvas = document.createElement("canvas");
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext("2d");

        // 中心に描画するためのオフセット計算
        const offsetX = Math.round((canvasW - finalW) / 2);
        const offsetY = Math.round((canvasH - finalH) / 2);

        // アンチエイリアスを有効にして描画
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // 透明な背景（デフォルト）の上に描画
        ctx.clearRect(0, 0, canvasW, canvasH);
        ctx.drawImage(source, 0, 0, srcW, srcH, offsetX, offsetY, finalW, finalH);

        // PNGとしてBlobを出力
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
            } else {
                reject(new Error("Canvas to Blob conversion failed"));
            }
        }, "image/png");
    });
}

/**
 * BlobからImageオブジェクトを生成するユーティリティ
 */
export function blobToImage(blob) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(blob);
        img.onload = () => {
            // URLは後でrevokeする必要があるため、利用側で管理するか直後にrevokeする
            resolve({ img, url });
        };
        img.onerror = () => reject(new Error("Failed to load image from blob"));
        img.src = url;
    });
}
