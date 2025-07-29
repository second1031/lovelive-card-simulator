// cardsData は cardsData.js でグローバルに定義されていると仮定

const packSelectionArea = document.getElementById('packSelectionArea');

// パック名と画像パスの対応
const packInfo = {
    "ブースターパック NEXT STEP": { image: "L_BP_02_BOX.png" },
    "プレミアムブースター ラブライブ！サンシャイン!!": { image: "L_PB_02_BOX.png" },
    "プレミアムブースター ラブライブ！スーパースター!!": { image: "L_PB_01_BOX.png" },
    "ブースターパック vol.1": { image: "L_BP_vol1_BOX.png" },
    // "all": { image: "pack_all.png", displayName: "全ての収録商品" } // ★削除★
};

document.addEventListener('DOMContentLoaded', () => {
    displayPackSelection();
});

function displayPackSelection() {
    packSelectionArea.innerHTML = '';

    // cardsDataからユニークなパック名を抽出
    const uniqueProducts = new Set();
    cardsData.forEach(card => {
        if (card.product) {
            uniqueProducts.add(card.product);
        }
    });

    const sortedProducts = Array.from(uniqueProducts).sort();

    // 「全ての収録商品」のオプションを追加（この行を削除またはコメントアウト）
    // createPackThumbnail('all', packInfo['all'].displayName || '全ての収録商品', packInfo['all'].image); // ★削除★

    // 各パックのサムネイルを作成
    sortedProducts.forEach(productName => {
        if (packInfo[productName]) { // packInfoに定義されているパックのみ表示
            createPackThumbnail(productName, productName, packInfo[productName].image);
        } else {
            console.warn(`packInfoに画像が定義されていないパックがあります: ${productName}`);
            // 定義されていない場合は汎用画像を使用するか、スキップするか選択
            // createPackThumbnail(productName, productName, "pack_default.png"); // 例: 汎用画像
        }
    });
}

function createPackThumbnail(productValue, displayName, imageFileName) {
    const packDiv = document.createElement('div');
    packDiv.classList.add('pack-thumbnail');
    packDiv.dataset.product = productValue;

    const img = document.createElement('img');
   // ★修正前: img.src = `./pack_images/${imageFileName}`;
    // ★修正後:
    img.src = `pack_images/${imageFileName}`; // プロジェクトのルートからの相対パス
    img.alt = displayName;
    img.onerror = function() {
        // ★修正前: this.src = './pack_images/pack_default.png';
        // ★修正後:
        this.src = 'pack_images/pack_default.png'; // プロジェクトのルートからの相対パス
    };
    packDiv.appendChild(img);

    const title = document.createElement('p');
    title.textContent = displayName;
    packDiv.appendChild(title);

    packDiv.addEventListener('click', () => {
        window.location.href = `open.html?product=${encodeURIComponent(productValue)}`;
    });

    packSelectionArea.appendChild(packDiv);
}
