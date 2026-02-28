/**
 * imageLoader.js
 * 
 * 複数画像のアップロード、タブによる状態管理を担当する。
 */

let images = [];       // { id: number, file: File, img: HTMLImageElement, processedImageData: ImageData|null }
let activeId = null;   // currently selected image ID
let imageIdCounter = 0;

let onLoadedCallback = null;
let onChangedCallback = null;

export function initImageLoader(onLoaded, onChanged) {
    onLoadedCallback = onLoaded;
    onChangedCallback = onChanged;

    const btnAdd = document.getElementById('btn-add-image');
    const uploadInput = document.getElementById('upload-input');
    const dropArea = document.getElementById('preview-wrapper'); // We'll make the whole preview area droppable

    // Click to upload
    btnAdd.addEventListener('click', () => {
        uploadInput.click();
    });

    uploadInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
        uploadInput.value = ''; // reset so same file can be selected again if deleted
    });

    // Drag and Drop
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
        if (e.dataTransfer && e.dataTransfer.files) {
            handleFiles(e.dataTransfer.files);
        }
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
                    processedImageData: null // For transparency results
                };

                images.push(newImgObj);
                addTab(newImgObj);

                // If it's the first image, make it active
                if (images.length === 1) {
                    setActiveImage(newImgObj.id);
                    if (onLoadedCallback) onLoadedCallback(newImgObj);
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
    // Truncate name if too long
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
            if (onChangedCallback) onChangedCallback(imgObj);
        }
    });

    tab.appendChild(label);
    tab.appendChild(closeBtn);
    tabsScroll.appendChild(tab);
}

function setActiveImage(id) {
    activeId = id;

    // Update active class on tabs
    document.querySelectorAll('.tab').forEach(t => {
        if (parseInt(t.dataset.id, 10) === id) {
            t.classList.add('active');
        } else {
            t.classList.remove('active');
        }
    });
}

function removeImage(id) {
    // Remove from array
    const index = images.findIndex(img => img.id === id);
    if (index === -1) return;

    images.splice(index, 1);

    // Remove tab DOM
    const tabNode = document.querySelector(`.tab[data-id="${id}"]`);
    if (tabNode) {
        tabNode.remove();
    }

    // Handle switching logic
    if (images.length === 0) {
        activeId = null;
        document.getElementById('empty-state').style.display = 'flex';
        const ctx = document.getElementById('main-canvas').getContext('2d');
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        if (onChangedCallback) onChangedCallback(null);
    } else if (activeId === id) {
        // If we closed the active tab, switch to the first available one
        setActiveImage(images[0].id);
        if (onChangedCallback) onChangedCallback(images[0]);
    }
}

export function getActiveImage() {
    if (!activeId) return null;
    return images.find(img => img.id === activeId) || null;
}
