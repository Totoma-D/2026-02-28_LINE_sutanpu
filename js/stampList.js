/**
 * stampList.js
 * 
 * 最大40枚のスタンプリストの管理（追加、削除、描画）を行う。
 * またZIPエクスポート用にスタンプの実態データを提供する。
 */

export const MAX_STAMPS = 40;
let stamps = []; // Array of Blob (PNG)
let listContainer;
let countBadge;

export function initStampList() {
    listContainer = document.getElementById('stamp-list');
    countBadge = document.getElementById('stamp-count');

    // Make global for cropper
    window.stampListAddItems = addItems;

    // Clear All button
    const btnClearAll = document.getElementById('btn-clear-all');
    btnClearAll.addEventListener('click', () => {
        if (stamps.length === 0) return;
        if (confirm('リストからすべてのスタンプを削除しますか？')) {
            stamps = [];
            renderList();
        }
    });
}

/**
 * 切り抜かれたBlobの配列をリストに追加する
 */
export function addItems(blobArray) {
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

    if (addedCount > 0) {
        renderList();
    }
}

/**
 * 特定のインデックスのスタンプを削除
 */
function removeItem(index) {
    stamps.splice(index, 1);
    renderList();
}

/**
 * リストUIを描画する
 */
function renderList() {
    listContainer.innerHTML = '';
    countBadge.textContent = stamps.length;

    // Trigger update on export panel to sync dropdowns
    if (window.exportSyncDropdowns) {
        window.exportSyncDropdowns(stamps.length);
    }

    // Enable/disable download button
    const btnDownload = document.getElementById('btn-download-zip');
    if (btnDownload) {
        btnDownload.disabled = stamps.length === 0;
    }

    stamps.forEach((blob, index) => {
        const url = URL.createObjectURL(blob);

        const itemDiv = document.createElement('div');
        itemDiv.className = 'stamp-item';

        const img = document.createElement('img');
        img.src = url;
        // Clean up memory when image is loaded
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

/**
 * 現在のスタンプリスト配列を返す（エクスポート等用）
 */
export function getStamps() {
    return stamps;
}
