// cardsData は cardsData.js でグローバルに定義されていると仮定

// ★ レアリティごとの排出率設定 ★
const rarityWeights = {
    'N': 40,
    'R': 20,
    'P': 15,
    'L': 10,
    'R＋': 8,
    'PE': 5,
    'P＋': 1.5,
    'PE＋': 1.5,    
    'SEC': 1,
    'SECE': 0.5,
    'LLE': 0.5,
};

// レアリティの階層を定義（ソート順も兼ねる）
const rarityOrder = ['N', 'R', 'P', 'L', 'R＋', 'PE', 'P＋', 'PE＋', 'SEC', 'SECE', 'LLE'];

// 各パックのカード枚数設定
const packCardCounts = {
    "ブースターパック NEXT STEP": 5,
    "プレミアムブースター ラブライブ！サンシャイン!!": 3,
    "プレミアムブースター ラブライブ！スーパースター!!": 3,
    "ブースターパック vol.1": 5,
    "all": 5
};

// 各パックの価格設定を定義
const packPrices = {
    "ブースターパック NEXT STEP": 500,
    "プレミアムブースター ラブライブ！サンシャイン!!": 300,
    "プレミアムブースター ラブライブ！スーパースター!!": 300,
    "ブースターパック vol.1": 500,
    "all": 500
};

// パックごとのレアリティ保証枚数と最低保証レアリティを定義
const packGuaranteedRarities = {
    "ブースターパック NEXT STEP": {
        count: 3,
        minRarity: 'R'
    },
    "プレミアムブースター ラブライブ！サンシャイン!!": {
        count: 2,
        minRarity: 'R'
    },
    "プレミアムブースター ラブライブ！スーパースター!!": {
        count: 2,
        minRarity: 'R'
    },
    "ブースターパック vol.1": {
        count: 3,
        minRarity: 'R'
    },
    "all": {
        count: 1,
        minRarity: 'R'
    }
};

// 特定のレアリティが指定された最低レアリティ以上かを判定するヘルパー関数
function isRarityAtLeast(rarity, minRarity) {
    const rarityIndex = rarityOrder.indexOf(rarity);
    const minRarityIndex = rarityOrder.indexOf(minRarity);
    if (rarityIndex === -1 || minRarityIndex === -1) {
        return false;
    }
    return rarityIndex >= minRarityIndex;
}


// HTML要素の取得
const openPackButton = document.getElementById('openPackButton');
const cardDisplayArea = document.getElementById('cardDisplayArea');
const packCountInput = document.getElementById('packCount');
const productSelect = document.getElementById('productSelect');
const tweetResultButton = document.getElementById('tweetResultButton');
const historyDisplayArea = document.getElementById('historyDisplayArea');
const clearHistoryButton = document.getElementById('clearHistoryButton');
const totalPacksOpenedElement = document.getElementById('totalPacksOpened');
const totalAmountSpentElement = document.getElementById('totalAmountSpent');
const overallCompletionElement = document.getElementById('overallCompletion');
const productCompletionRatesElement = document.getElementById('productCompletionRates');
const cardCollectionDisplayArea = document.getElementById('cardCollectionDisplayArea');

const OWNED_CARDS_STORAGE_KEY = 'ownedCards'; // 所持カードリストのキー

const STORAGE_KEY = 'packOpeningHistory';
const MAX_HISTORY_ITEMS = 10;

let cardsPerPack = 5;

let lastDrawnCardsForTweet = [];
let lastSelectedProductForTweet = '';
let lastPackCountForTweet = 0;


let ownedCards = {}; // 所持カードのデータ構造: { card_number: count, ... }

// カード図鑑/コンプリート率に含めるパックのリストを定数として定義
const INCLUDED_PRODUCTS_FOR_COLLECTION = new Set([
    "ブースターパック NEXT STEP",
    "プレミアムブースター ラブライブ！サンシャイン!!",
    "プレミアムブースター ラブライブ！スーパースター!!",
    "ブースターパック vol.1"
]);


window.onload = () => {
    if (typeof cardsData !== 'undefined' && cardsData.length > 0) {
        populateProductSelect();
        loadAndDisplayHistory();
        loadOwnedCards(); // 所持カードを読み込む
        displayCardCollection(); // 所持カードリストを表示
        updateCompletionRates(); // コンプリート率を更新・表示
    } else {
        console.warn("cardsDataがまだ利用できません。");
    }
};

function populateProductSelect() {
    const allowedProducts = INCLUDED_PRODUCTS_FOR_COLLECTION; 

    const productsToAdd = new Set();
    cardsData.forEach(card => {
        if (card.product && allowedProducts.has(card.product)) {
            productsToAdd.add(card.product);
        }
    });

    productSelect.innerHTML = ''; 

    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = '全ての収録商品 (許可された商品から)';
    productSelect.appendChild(allOption);

    Array.from(productsToAdd).sort().forEach(product => {
        const option = document.createElement('option');
        option.value = product;
        option.textContent = product;
        productSelect.appendChild(option);
    });

    console.log("収録商品ドロップダウンが初期化されました。");
}

/**
 * 重み付けに基づいてレアリティを抽選する関数
 */
function drawRarity(availableRaritiesWithCount, minRarityForDraw = null) {
    let totalWeight = 0;
    const weightedRaritiesList = [];

    for (const rarity in availableRaritiesWithCount) {
        const item = availableRaritiesWithCount[rarity];

        const meetsMinRarity = minRarityForDraw ? isRarityAtLeast(rarity, minRarityForDraw) : true;

        if (item.count > 0 && item.weight !== undefined && meetsMinRarity) {
            totalWeight += item.weight;
            weightedRaritiesList.push({ rarity: rarity, weight: item.weight });
        }
    }

    if (totalWeight === 0) {
        console.warn(`抽選可能なレアリティがありません（カードが存在しないか、重みが未定義、または最低レアリティ '${minRarityForDraw}' を満たすカードがない）。`);
        return null;
    }

    let randomNumber = Math.random() * totalWeight;

    for (const item of weightedRaritiesList) {
        randomNumber -= item.weight;
        if (randomNumber <= 0) {
            return item.rarity;
        }
    }
    return null;
}


openPackButton.addEventListener('click', () => {
    if (!cardsData || cardsData.length === 0) {
        alert("カードデータがまだ読み込まれていないか、読み込みに失敗しました。");
        return;
    }

    const selectedProduct = productSelect.value;
    lastSelectedProductForTweet = selectedProduct;

    if (packCardCounts[selectedProduct] !== undefined) {
        cardsPerPack = packCardCounts[selectedProduct];
    } else {
        cardsPerPack = 5; 
        console.warn(`'${selectedProduct}' のパックあたりのカード枚数が定義されていません。デフォルトの ${cardsPerPack} 枚を使用します。`);
    }

    const playableCardsByRarity = {};
    let totalPlayableCardsInSelectedProduct = 0;

    for (const rarityName in rarityWeights) {
        playableCardsByRarity[rarityName] = {
            cards: [],
            weight: rarityWeights[rarityName],
            count: 0
        };
    }

    cardsData.forEach(card => {
        if (selectedProduct === 'all' || card.product === selectedProduct) {
            if (card.rarity && playableCardsByRarity[card.rarity]) {
                playableCardsByRarity[card.rarity].cards.push(card);
                playableCardsByRarity[card.rarity].count++;
                totalPlayableCardsInSelectedProduct++;
            } else {
                console.warn(`未定義のレアリティ '${card.rarity}' がカード番号 ${card.number} で見つかりました。抽選対象外です。`);
            }
        }
    });

    if (totalPlayableCardsInSelectedProduct === 0) {
        alert("選択された収録商品に、定義されたレアリティを持つカードが見つかりませんでした。別の商品を選択してください。またはrarityWeightsを確認してください。");
        return;
    }

    cardDisplayArea.innerHTML = '';
    tweetResultButton.style.display = 'none';

    let packCount = parseInt(packCountInput.value, 10);
    lastPackCountForTweet = packCount;

    if (isNaN(packCount) || packCount < 1) {
        alert("有効なパック数を入力してください (1以上の整数)。");
        packCountInput.value = 1;
        return;
    }

    lastDrawnCardsForTweet = [];

    const allDrawnCardsForCurrentSession = []; 
    const currentPackPrice = packPrices[selectedProduct] || packPrices['all'];
    const currentSessionAmountSpent = currentPackPrice * packCount;

    for (let p = 1; p <= packCount; p++) {
        const packContainer = document.createElement('div');
        packContainer.classList.add('pack-container');

        const packTitle = document.createElement('h2');
        packTitle.classList.add('pack-title');
        packTitle.textContent = `パック ${p} 開封結果 (${selectedProduct === 'all' ? '全商品' : selectedProduct})`;
        packContainer.appendChild(packTitle);

        const packCardsArea = document.createElement('div');
        packCardsArea.classList.add('pack-cards');

        const drawnCardsInThisPack = [];
        
        const guaranteedInfo = packGuaranteedRarities[selectedProduct] || { count: 0, minRarity: null };
        const guaranteedCount = guaranteedInfo.count;
        const minGuaranteedRarity = guaranteedInfo.minRarity;

        // 1. 保証されたレアリティのカードを抽選
        for (let i = 0; i < guaranteedCount; i++) {
            let drawnCard = null;
            let attempts = 0;
            const maxDrawAttempts = 50;

            while (drawnCard === null && attempts < maxDrawAttempts) {
                const chosenRarity = drawRarity(playableCardsByRarity, minGuaranteedRarity);

                if (chosenRarity && playableCardsByRarity[chosenRarity] && playableCardsByRarity[chosenRarity].cards.length > 0) {
                    const rarityCards = playableCardsByRarity[chosenRarity].cards;
                    const randomIndex = Math.floor(Math.random() * rarityCards.length);
                    drawnCard = rarityCards[randomIndex];
                }
                attempts++;
            }

            if (drawnCard) {
                drawnCardsInThisPack.push(drawnCard);
            } else {
                console.warn(`パック ${p} の保証カード抽選に失敗しました (最低レアリティ: ${minGuaranteedRarity})。フォールバックします。`);
                if (cardsData.length > 0) {
                    const fallbackCard = cardsData[Math.floor(Math.random() * cardsData.length)];
                    drawnCardsInThisPack.push(fallbackCard);
                } else {
                    console.error("カードデータが全くありません。");
                    break;
                }
            }
        }

        // 2. 残りのカードを通常通り抽選
        const remainingCardsCount = cardsPerPack - guaranteedCount;
        for (let i = 0; i < remainingCardsCount; i++) {
            let drawnCard = null;
            let attempts = 0;
            const maxDrawAttempts = 50;

            while (drawnCard === null && attempts < maxDrawAttempts) {
                const chosenRarity = drawRarity(playableCardsByRarity); 

                if (chosenRarity && playableCardsByRarity[chosenRarity] && playableCardsByRarity[chosenRarity].cards.length > 0) {
                    const rarityCards = playableCardsByRarity[chosenRarity].cards;
                    const randomIndex = Math.floor(Math.random() * rarityCards.length);
                    drawnCard = rarityCards[randomIndex];
                }
                attempts++;
            }

            if (drawnCard) {
                drawnCardsInThisPack.push(drawnCard);
            } else {
                console.warn(`パック ${p} の通常カード抽選に失敗しました。フォールバックします。`);
                if (cardsData.length > 0) {
                    const fallbackCard = cardsData[Math.floor(Math.random() * cardsData.length)];
                    drawnCardsInThisPack.push(fallbackCard);
                } else {
                    console.error("カードデータが全くありません。");
                    break;
                }
            }
        }
        
        drawnCardsInThisPack.sort(() => Math.random() - 0.5);

        lastDrawnCardsForTweet.push(drawnCardsInThisPack); 
        allDrawnCardsForCurrentSession.push(...drawnCardsInThisPack);

        drawnCardsInThisPack.forEach(card => {
            const cardElement = document.createElement('div');
            cardElement.classList.add('card');

            if (card.rarity) {
                cardElement.classList.add(`rarity-${card.rarity}`); 
                const rarityBadge = document.createElement('span');
                rarityBadge.classList.add('card-rarity');
                rarityBadge.textContent = card.rarity;
                cardElement.appendChild(rarityBadge);
            }

            const imagePath = `./cards_images/${card['number']}.png`;
            const cardImage = document.createElement('img');
            cardImage.src = imagePath;
            cardImage.alt = card['name'];

            const cardName = document.createElement('p');
            cardName.classList.add('card-name');
            cardName.textContent = card['name'];

            const cardProduct = document.createElement('p');
            cardProduct.classList.add('card-product');
            cardProduct.textContent = `収録商品: ${card['product']}`;

            const cardType = document.createElement('p');
            cardType.classList.add('card-type');
            cardType.textContent = `タイプ: ${card['type']}`;
            
            const cardNumber = document.createElement('p');
            cardNumber.classList.add('card-number');
            cardNumber.textContent = `No.: ${card['number']}`;

            const cardEffect = document.createElement('p');
            cardEffect.classList.add('card-effect');
            cardEffect.innerHTML = `効果: ${card['effect'].replace(/\\n/g, '<br>')}`;

            cardElement.appendChild(cardImage);
            cardElement.appendChild(cardName);
            cardElement.appendChild(cardProduct);
            cardElement.appendChild(cardType);
            cardElement.appendChild(cardNumber);
            cardElement.appendChild(cardEffect);
            packCardsArea.appendChild(cardElement);
        });

        packContainer.appendChild(packCardsArea);
        cardDisplayArea.appendChild(packContainer);
    }
    
    tweetResultButton.style.display = 'block';

    const currentOpeningResult = { 
        timestamp: new Date().toISOString(),
        product: selectedProduct,
        packCount: packCount,
        drawnCards: allDrawnCardsForCurrentSession,
        amountSpent: currentSessionAmountSpent
    };
    saveOpeningResult(currentOpeningResult);

    updateOwnedCards(allDrawnCardsForCurrentSession); 
    saveOwnedCards();
    displayCardCollection();
    updateCompletionRates();
    loadAndDisplayHistory();
});

tweetResultButton.addEventListener('click', () => {
    // 現在の合計情報とコンプリート率を取得
    let totalPacks = 0;
    let totalAmount = 0;
    let history = [];
    try {
        const storedHistory = localStorage.getItem(STORAGE_KEY);
        if (storedHistory) {
            history = JSON.parse(storedHistory);
        }
    } catch (e) {
        console.error("ローカルストレージからの履歴読み込みに失敗しました:", e);
    }
    history.forEach(item => {
        totalPacks += item.packCount;
        totalAmount += item.amountSpent || 0;
    });

    let ownedUniqueCards = 0;
    // 全体カード総数もコレクション対象のカードのみで計算
    const allCollectionCards = cardsData.filter(card => INCLUDED_PRODUCTS_FOR_COLLECTION.has(card.product));
    allCollectionCards.forEach(card => {
        if (ownedCards[card.number] && ownedCards[card.number] > 0) {
            ownedUniqueCards++;
        }
    });
    const totalUniqueCards = allCollectionCards.length; // ここを修正
    const overallRate = (totalUniqueCards > 0) ? ((ownedUniqueCards / totalUniqueCards) * 100).toFixed(2) : 0;

    let tweetText = `ラブカ開封シミュレートの結果！\n`;
    tweetText += `合計${totalPacks}パック開封して、${ownedUniqueCards}/${totalUniqueCards} (${overallRate}%)揃いました。\n`;
    tweetText += `使用金額合計は${totalAmount}円でした。\n`;

    const simulatorUrl = 'https://your-simulator-url.com'; // ★ここにデプロイ先のURLを設定★
    tweetText += `${simulatorUrl}\n`;
    tweetText += `#ラブライブ #カード開封シミュレーター`; // ハッシュタグも追加

    // Xの投稿文字数制限を考慮し、長い場合は短縮
    const maxLength = 280; // Xの文字数制限は変更される可能性があるため、余裕を持たせる
    if (tweetText.length > maxLength) {
        const ellipsis = '...';
        tweetText = tweetText.substring(0, maxLength - ellipsis.length) + ellipsis;
    }
    
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;

    window.open(tweetUrl, '_blank');
});

/**
 * 開封結果をローカルストレージに保存する関数
 * @param {Object} result - 保存する開封結果オブジェクト
 */
function saveOpeningResult(result) {
    let history = [];
    try {
        const storedHistory = localStorage.getItem(STORAGE_KEY);
        if (storedHistory) {
            history = JSON.parse(storedHistory);
        }
    } catch (e) {
        console.error("ローカルストレージからの読み込みに失敗しました:", e);
        history = []; // 破損したデータの場合はリセット
    }

    history.unshift(result); // 配列の先頭に新しい結果を追加

    if (history.length > MAX_HISTORY_ITEMS) {
        history = history.slice(0, MAX_HISTORY_ITEMS);
    }

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
        console.error("ローカルストレージへの保存に失敗しました:", e);
        alert("開封履歴の保存に失敗しました。ブラウザのストレージ容量を確認してください。");
    }
}

/**
 * ローカルストレージから履歴を読み込み、表示する関数
 */
function loadAndDisplayHistory() {
    historyDisplayArea.innerHTML = ''; // まず既存の表示をクリア
    let history = [];
    try {
        const storedHistory = localStorage.getItem(STORAGE_KEY);
        if (storedHistory) {
            history = JSON.parse(storedHistory);
        }
    } catch (e) {
        console.error("ローカルストレージからの読み込みに失敗しました:", e);
    }

    let totalPacks = 0;
    let totalAmount = 0;

    if (history.length === 0) {
        historyDisplayArea.innerHTML = '<p>まだ開封履歴がありません。</p>';
    } else {
        history.forEach(item => {
            totalPacks += item.packCount;
            totalAmount += item.amountSpent || 0; 
        });

        // 履歴を新しいものから順に表示するためソート
        history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        history.forEach((item, index) => {
            const historyItemDiv = document.createElement('div');
            historyItemDiv.classList.add('history-item');

            const date = new Date(item.timestamp);
            const formattedDate = date.toLocaleString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });

            const title = document.createElement('h3');
            const amountText = item.amountSpent !== undefined ? ` (${item.amountSpent}円)` : '';
            title.textContent = `${formattedDate} - ${item.product === 'all' ? '全商品' : item.product}を${item.packCount}パック開封${amountText}`;
            historyItemDiv.appendChild(title);

            const historyCardsContainer = document.createElement('div');
            historyCardsContainer.classList.add('history-cards');

            const sortedCards = [...item.drawnCards].sort((a, b) => {
                const rarityAIndex = rarityOrder.indexOf(a.rarity);
                const rarityBIndex = rarityOrder.indexOf(b.rarity);
                if (rarityAIndex === rarityBIndex) {
                    return a.number.localeCompare(b.number);
                }
                return rarityBIndex - rarityAIndex;
            });

            sortedCards.forEach(card => {
                const cardDiv = document.createElement('div');
                cardDiv.classList.add('history-card');
                // ▼▼▼ 変更開始 ▼▼▼
                cardDiv.textContent = `${card.name}, ${card.rarity}`; // 「カード名, レアリティ」のみ表示
                // ▲▲▲ 変更終了 ▲▲▼
                
                // 以前のレアリティバッジや詳細情報は削除またはコメントアウト
                /*
                if (card.rarity) {
                    cardDiv.classList.add(`rarity-${card.rarity}`);
                    const rarityBadge = document.createElement('span');
                    rarityBadge.classList.add('card-rarity');
                    rarityBadge.textContent = card.rarity;
                    cardDiv.appendChild(rarityBadge);
                }
                
                const cardName = document.createElement('p');
                cardName.textContent = card.name;
                cardDiv.appendChild(cardName);
                */
                historyCardsContainer.appendChild(cardDiv);
            });
            historyItemDiv.appendChild(historyCardsContainer);
            historyDisplayArea.appendChild(historyItemDiv);
        });
    }

    totalPacksOpenedElement.textContent = `合計開封パック数: ${totalPacks}パック`;
    totalAmountSpentElement.textContent = `合計使用金額: ${totalAmount}円`;
}

/**
 * 履歴をクリアする関数
 */
function clearAllHistory() {
    if (confirm('全ての開封履歴と所持カードリストを削除してもよろしいですか？')) {
        try {
            localStorage.removeItem(STORAGE_KEY); // 開封履歴を削除
            localStorage.removeItem(OWNED_CARDS_STORAGE_KEY); // 所持カードリストを削除
            ownedCards = {}; // メモリ上の所持カードもリセット

            loadAndDisplayHistory(); // 履歴表示を更新
            displayCardCollection(); // 所持カードリストを更新
            updateCompletionRates(); // コンプリート率を更新
            
            alert('全ての履歴と所持カードリストが削除されました。');
        } catch (e) {
            console.error("ローカルストレージのクリアに失敗しました:", e);
            alert("履歴の削除に失敗しました。");
        }
    }
}

// 履歴クリアボタンにイベントリスナーを追加
clearHistoryButton.addEventListener('click', clearAllHistory);


// ▼▼▼ ここから所持カードとコンプリート率に関する追加機能 ▼▼▼

/**
 * ローカルストレージから所持カードリストを読み込む関数
 */
function loadOwnedCards() {
    try {
        const storedOwnedCards = localStorage.getItem(OWNED_CARDS_STORAGE_KEY);
        if (storedOwnedCards) {
            ownedCards = JSON.parse(storedOwnedCards);
        } else {
            ownedCards = {}; // データがない場合は空のオブジェクトを初期化
        }
    } catch (e) {
        console.error("所持カードデータの読み込みに失敗しました:", e);
        ownedCards = {}; // 破損したデータの場合はリセット
    }
}

/**
 * 所持カードリストをローカルストレージに保存する関数
 */
function saveOwnedCards() {
    try {
        localStorage.setItem(OWNED_CARDS_STORAGE_KEY, JSON.stringify(ownedCards));
    } catch (e) {
        console.error("所持カードデータの保存に失敗しました:", e);
        alert("所持カードリストの保存に失敗しました。ブラウザのストレージ容量を確認してください。");
    }
}

/**
 * 新しく引いたカードで所持カードリストを更新する関数
 * @param {Array} newCards - 今回引かれたカードのリスト
 */
function updateOwnedCards(newCards) {
    newCards.forEach(card => {
        // コレクション対象のカードのみ所持枚数をカウント
        if (INCLUDED_PRODUCTS_FOR_COLLECTION.has(card.product)) { 
            const cardNumber = card.number;
            if (ownedCards[cardNumber]) {
                ownedCards[cardNumber]++;
            } else {
                ownedCards[cardNumber] = 1;
            }
        }
    });
}

/**
 * 所持カードリスト（カード図鑑）を表示する関数
 */
function displayCardCollection() {
    cardCollectionDisplayArea.innerHTML = ''; // まず既存の表示をクリア

    // コレクション対象のカードのみをフィルタリングしてソート
    const filteredAllCards = cardsData.filter(card => INCLUDED_PRODUCTS_FOR_COLLECTION.has(card.product));
    const sortedCollectionCards = [...filteredAllCards].sort((a, b) => {
        return a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: 'base' });
    });

    if (sortedCollectionCards.length === 0) { 
        cardCollectionDisplayArea.innerHTML = '<p>表示するカードがありません。設定されたパックの商品情報が正しいか確認してください。</p>'; // メッセージを変更
        return;
    }

    sortedCollectionCards.forEach(card => { 
        const cardDiv = document.createElement('div');
        cardDiv.classList.add('collection-card');
        
        const ownedCount = ownedCards[card.number] || 0;

        if (ownedCount === 0) {
            cardDiv.classList.add('not-owned'); // 未所持カードにスタイルを適用
        }

        // レアリティごとのクラスを追加
        if (card.rarity) {
            cardDiv.classList.add(`rarity-${card.rarity}`);
        }

        // レアリティバッジ
        if (card.rarity) {
            const rarityBadge = document.createElement('span');
            rarityBadge.classList.add('card-rarity');
            rarityBadge.textContent = card.rarity;
            cardDiv.appendChild(rarityBadge);
        }

        // 所持枚数バッジ
        const ownedCountBadge = document.createElement('span');
        ownedCountBadge.classList.add('owned-count');
        ownedCountBadge.textContent = `x${ownedCount}`;
        cardDiv.appendChild(ownedCountBadge);

        // カード画像
        const imagePath = `./cards_images/${card.number}.png`;
        const cardImage = document.createElement('img');
        cardImage.src = imagePath;
        cardImage.alt = card.name;
        cardImage.onerror = function() {
            // 画像が見つからない場合のフォールバック（例: デフォルト画像）
            this.onerror = null; // エラーの無限ループを防ぐ
            this.src = './cards_images/no_image.png'; // または適切なデフォルト画像
            this.alt = '画像なし';
        };
        cardDiv.appendChild(cardImage);

        // カード名
        const cardName = document.createElement('p');
        cardName.classList.add('card-name');
        cardName.textContent = card.name;
        cardDiv.appendChild(cardName);

        // カード番号
        const cardNumber = document.createElement('p');
        cardNumber.classList.add('card-number');
        cardNumber.textContent = `No. ${card.number}`;
        cardDiv.appendChild(cardNumber);

        cardCollectionDisplayArea.appendChild(cardDiv);
    });
}

/**
 * コンプリート率を計算し表示する関数
 */
function updateCompletionRates() {
    // コレクション対象のカードのみをフィルタリング
    const allCollectionCards = cardsData.filter(card => INCLUDED_PRODUCTS_FOR_COLLECTION.has(card.product));

    if (!allCollectionCards || allCollectionCards.length === 0) { 
        overallCompletionElement.textContent = '0%';
        productCompletionRatesElement.innerHTML = '<p>対象のカードデータがありません。</p>'; 
        return;
    }

    let ownedUniqueCards = 0; // 所持しているユニークなカードの数
    allCollectionCards.forEach(card => { 
        if (ownedCards[card.number] && ownedCards[card.number] > 0) {
            ownedUniqueCards++;
        }
    });

    // 全体コンプリート率
    const totalUniqueCards = allCollectionCards.length; 
    const overallRate = (totalUniqueCards > 0) ? ((ownedUniqueCards / totalUniqueCards) * 100).toFixed(2) : 0;
    overallCompletionElement.textContent = `${overallRate}%`;

    // 商品ごとのコンプリート率
    productCompletionRatesElement.innerHTML = ''; // クリア

    // cardsData からユニークな商品名を取得（ただしコレクション対象のみ）
    const productNamesInCollection = new Set(allCollectionCards.map(card => card.product).filter(p => p));
    const sortedProductNames = Array.from(productNamesInCollection).sort(); 

    sortedProductNames.forEach(productName => {
        const productCards = allCollectionCards.filter(card => card.product === productName); 
        let productOwnedUniqueCards = 0;
        productCards.forEach(card => {
            if (ownedCards[card.number] && ownedCards[card.number] > 0) {
                productOwnedUniqueCards++;
            }
        });

        const totalProductCards = productCards.length;
        const productRate = (totalProductCards > 0) ? ((productOwnedUniqueCards / totalProductCards) * 100).toFixed(2) : 0;

        const pElement = document.createElement('p');
        pElement.textContent = `${productName}: ${productRate}%`;
        productCompletionRatesElement.appendChild(pElement);
    });
}