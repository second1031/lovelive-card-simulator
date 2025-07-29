// cardsData は cardsData.js でグローバルに定義されていると仮定

// ★ レアリティごとの排出率設定 ★
const rarityWeights = {
    'N': 40, 'R': 20, 'P': 15, 'L': 10, 'R＋': 8, 'PE': 5, 'P＋': 1.5, 'PE＋': 1.5,
    'SEC': 1, 'SECE': 0.5, 'LLE': 0.5,
};

// レアリティの階層を定義（ソート順も兼ねる）
const rarityOrder = ['N', 'R', 'P', 'L', 'R＋', 'PE', 'P＋', 'PE＋', 'SEC', 'SECE', 'LLE'];

// 各パックのカード枚数設定
const packCardCounts = {
    "ブースターパック NEXT STEP": 5,
    "プレミアムブースター ラブライブ！サンシャイン!!": 3,
    "プレミアムブースター ラブライブ！スーパースター!!": 3,
    "ブースターパック vol.1": 5,
    "all": 5 // 「全ての収録商品」選択時の1パックあたりの枚数
};

// 各パックの価格設定を定義
const packPrices = {
    "ブースターパック NEXT STEP": 500,
    "プレミアムブースター ラブライブ！サンシャイン!!": 300,
    "プレミアムブースター ラブライブ！スーパースター!!": 300,
    "ブースターパック vol.1": 500,
    "all": 500 // 「全ての収録商品」選択時の価格
};

// パックごとのレアリティ保証枚数と最低保証レアリティを定義
const packGuaranteedRarities = {
    "ブースターパック NEXT STEP": { count: 3, minRarity: 'R' },
    "プレミアムブースター ラブライブ！サンシャイン!!": { count: 2, minRarity: 'R' },
    "プレミアムブースター ラブライブ！スーパースター!!": { count: 2, minRarity: 'R' },
    "ブースターパック vol.1": { count: 3, minRarity: 'R' },
    "all": { count: 1, minRarity: 'R' } // 「全ての収録商品」選択時の保証
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
const selectedPackTitleElement = document.getElementById('selectedPackTitle');
const packCountInput = document.getElementById('packCount');
const openPackButton = document.getElementById('openPackButton');
const cardDisplayArea = document.getElementById('cardDisplayArea');
const tweetResultButton = document.getElementById('tweetResultButton');
const backToSelectPageButton = document.getElementById('backToSelectPageButton');

const historyDisplayArea = document.getElementById('historyDisplayArea');
const clearHistoryButton = document.getElementById('clearHistoryButton');
const totalPacksOpenedElement = document.getElementById('totalPacksOpened');
const totalAmountSpentElement = document.getElementById('totalAmountSpent');

const collectionTitleElement = document.getElementById('collectionTitle');
const overallCompletionElement = document.getElementById('overallCompletion');
const cardCollectionDisplayArea = document.getElementById('cardCollectionDisplayArea');

const OWNED_CARDS_STORAGE_KEY = 'ownedCards';
const STORAGE_KEY = 'packOpeningHistory';
const MAX_HISTORY_ITEMS = 1000;
// ★追加: 累積合計値用の新しいキー★
const TOTAL_PACKS_OPENED_KEY = 'cumulativeTotalPacksOpened';
const TOTAL_AMOUNT_SPENT_KEY = 'cumulativeTotalAmountSpent';

let ownedCards = {};
// ★追加: 累積合計値を保持する変数★
let cumulativeTotalPacksOpened = 0;
let cumulativeTotalAmountSpent = 0;
let currentSelectedProduct = ''; // 現在選択されているパック名

document.addEventListener('DOMContentLoaded', () => {
    if (typeof cardsData === 'undefined' || cardsData.length === 0) {
        alert("カードデータがまだ読み込まれていないか、読み込みに失敗しました。パック選択ページに戻ります。");
        window.location.href = 'index.html';
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const product = params.get('product');

    if (!product) {
        alert("選択されたパック情報がありません。パック選択ページに戻ります。");
        window.location.href = 'index.html';
        return;
    }

    currentSelectedProduct = product;
    selectedPackTitleElement.textContent = `${currentSelectedProduct === 'all' ? '全ての収録商品' : currentSelectedProduct} の開封`;
    collectionTitleElement.textContent = `${currentSelectedProduct === 'all' ? '全ての収録商品' : currentSelectedProduct} のカード図鑑とコンプリート率`;

    loadOwnedCards(); // 所持カードを読み込む
    loadCumulativeTotals(); // ★追加: 累積合計値を読み込む★
    loadAndDisplayHistory(); // 履歴を読み込み表示 (この中で合計値も表示)
    displayCardCollection(currentSelectedProduct);
    updateCompletionRates(currentSelectedProduct);

    // 初回表示時のメッセージ
    cardDisplayArea.innerHTML = '<p>開封パック数を入力し、「パック開封！」ボタンを押してください。</p>';
});

openPackButton.addEventListener('click', () => {
    const packCount = parseInt(packCountInput.value, 10);

    if (isNaN(packCount) || packCount < 1) {
        alert("有効なパック数を入力してください (1以上の整数)。");
        return;
    }

    openPackSimulation(currentSelectedProduct, packCount);
    tweetResultButton.style.display = 'block'; // 結果表示後にツイートボタンを表示
});

backToSelectPageButton.addEventListener('click', () => {
    window.location.href = 'index.html'; // パック選択ページに戻る
});

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

/**
 * パック開封シミュレーションを実行し、結果を表示する関数
 * @param {string} selectedProduct - 選択された収録商品
 * @param {number} packCount - 開封するパック数
 */
function openPackSimulation(selectedProduct, packCount) {
    cardDisplayArea.innerHTML = ''; // 既存の表示をクリア

    let cardsPerPack = packCardCounts[selectedProduct] || 5;

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
                // 定義されていないレアリティのカードは警告しつつスキップ
                // console.warn(`未定義のレアリティ '${card.rarity}' がカード番号 ${card.number} で見つかりました。抽選対象外です。`);
            }
        }
    });

    if (totalPlayableCardsInSelectedProduct === 0) {
        alert("選択された収録商品に、定義されたレアリティを持つカードが見つかりませんでした。別の商品を選択してください。またはrarityWeightsを確認してください。");
        window.location.href = 'index.html'; // パック選択に戻る
        return;
    }

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
            const maxDrawAttempts = 50; // 無限ループ防止

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
                // フォールバック: 全カードからランダムに選ぶ
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
            const maxDrawAttempts = 50; // 無限ループ防止

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
                // フォールバック: 全カードからランダムに選ぶ
                if (cardsData.length > 0) {
                    const fallbackCard = cardsData[Math.floor(Math.random() * cardsData.length)];
                    drawnCardsInThisPack.push(fallbackCard);
                } else {
                    console.error("カードデータが全くありません。");
                    break;
                }
            }
        }

        drawnCardsInThisPack.sort(() => Math.random() - 0.5); // シャッフル

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
            const cardImageWrapper = document.createElement('div');
            cardImageWrapper.classList.add('card-image-wrapper');
            cardImageWrapper.style.backgroundImage = `url('${imagePath}')`;
            cardImageWrapper.onerror = function() {
                this.style.backgroundImage = `url('./cards_images/no_image.png')`;
            };
            cardElement.appendChild(cardImageWrapper);

            const cardName = document.createElement('p');
            cardName.classList.add('card-name');
            cardName.textContent = card['name'];
            cardElement.appendChild(cardName);

            const cardNumber = document.createElement('p');
            cardNumber.classList.add('card-number');
            cardNumber.textContent = `No.: ${card['number']}`;
            cardElement.appendChild(cardNumber);

            packCardsArea.appendChild(cardElement);
        });

        packContainer.appendChild(packCardsArea);
        cardDisplayArea.appendChild(packContainer);
    }

    const currentOpeningResult = {
        timestamp: new Date().toISOString(),
        product: selectedProduct,
        packCount: packCount,
        drawnCards: allDrawnCardsForCurrentSession,
        amountSpent: currentSessionAmountSpent
    };
    saveOpeningResult(currentOpeningResult);
    updateOwnedCards(allDrawnCardsForCurrentSession);
    saveOwnedCards(); // 所持カードを保存

    // 開封後に履歴と図鑑を更新
    loadAndDisplayHistory();
    displayCardCollection(currentSelectedProduct);
    updateCompletionRates(currentSelectedProduct);
}

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
    // X投稿時のコンプリート率は、全カード図鑑のコンプリート率を反映させる
    const allCollectionCardsForTweet = cardsData.filter(card => {
        // カード図鑑に含めるパックのリスト (openScript.js内での定義が必要)
        const INCLUDED_PRODUCTS_FOR_COLLECTION_TWEET = new Set([
            "ブースターパック NEXT STEP",
            "プレミアムブースター ラブライブ！サンシャイン!!",
            "プレミアムブースター ラブライブ！スーパースター!!",
            "ブースターパック vol.1"
        ]);
        return INCLUDED_PRODUCTS_FOR_COLLECTION_TWEET.has(card.product);
    });

    loadOwnedCards(); // 最新の所持カードをロードしておく
    allCollectionCardsForTweet.forEach(card => {
        if (ownedCards[card.number] && ownedCards[card.number] > 0) {
            ownedUniqueCards++;
        }
    });
    const totalUniqueCards = allCollectionCardsForTweet.length;
    const overallRate = (totalUniqueCards > 0) ? ((ownedUniqueCards / totalUniqueCards) * 100).toFixed(2) : 0;

    let tweetText = `ラブカ開封シミュレートの結果！\n`;
    tweetText += `合計${totalPacks}パック開封して、${ownedUniqueCards}/${totalUniqueCards} (${overallRate}%)揃いました。\n`;
    tweetText += `使用金額合計は${totalAmount}円でした。\n`;

    const simulatorUrl = 'https://your-github-username.github.io/lovelive-card-simulator/'; // ★ここにデプロイ先のURLを設定★
    tweetText += `${simulatorUrl}\n`;
    tweetText += `#ラブライブ #カード開封シミュレーター`;

    const maxLength = 280;
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
        history = [];
    }

    history.unshift(result);

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
 * ローカルストレージから所持カードリストを読み込む関数
 */
function loadOwnedCards() {
    try {
        const storedOwnedCards = localStorage.getItem(OWNED_CARDS_STORAGE_KEY);
        if (storedOwnedCards) {
            ownedCards = JSON.parse(storedOwnedCards);
        } else {
            ownedCards = {};
        }
    } catch (e) {
        console.error("所持カードデータの読み込みに失敗しました:", e);
        ownedCards = {};
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
        // 所持カード更新対象となる商品かを判定するリスト
        // openScript.js内でのみ使用するが、全パック図鑑用とは別に定義
        const PRODUCTS_FOR_OWNED_CARDS_UPDATE = new Set([
            "ブースターパック NEXT STEP",
            "プレミアムブースター ラブライブ！サンシャイン!!",
            "プレミアムブースター ラブライブ！スーパースター!!",
            "ブースターパック vol.1"
        ]);
        if (PRODUCTS_FOR_OWNED_CARDS_UPDATE.has(card.product)) {
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
 * ローカルストレージから履歴を読み込み、表示する関数
 */
function loadAndDisplayHistory() {
    historyDisplayArea.innerHTML = '';
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

        // 最新の履歴が上に来るようにソート（保存時にunshiftしているので不要だが念のため）
        history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        history.forEach((item, index) => {
            const historyItemDiv = document.createElement('div');
            historyItemDiv.classList.add('history-item');

            const date = new Date(item.timestamp);
            const formattedDate = date.toLocaleString('ja-JP', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
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
                if (card.rarity) {
                    cardDiv.classList.add(`rarity-${card.rarity}`);
                    const rarityBadge = document.createElement('span');
                    rarityBadge.classList.add('card-rarity');
                    rarityBadge.textContent = card.rarity;
                    cardDiv.appendChild(rarityBadge);
                }
                cardDiv.textContent += `${card.name}, No.${card.number}`;
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
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(OWNED_CARDS_STORAGE_KEY);
            ownedCards = {};

            loadAndDisplayHistory();
            displayCardCollection(currentSelectedProduct); // 現在選択中のパックの図鑑を更新
            updateCompletionRates(currentSelectedProduct); // 現在選択中のパックのコンプリート率を更新

            alert('全ての履歴と所持カードリストが削除されました。');
        } catch (e) {
            console.error("ローカルストレージのクリアに失敗しました:", e);
            alert("履歴の削除に失敗しました。");
        }
    }
}
clearHistoryButton.addEventListener('click', clearAllHistory);


/**
 * 所持カードリスト（カード図鑑）を表示する関数
 * @param {string} productFilter - 表示するカードをフィルタリングする商品名。'all'の場合は全商品。
 */
function displayCardCollection(productFilter) {
    cardCollectionDisplayArea.innerHTML = '';

    const filteredCardsForCollection = cardsData.filter(card => {
        // 'all'が選択されている場合は全てのカードを対象とし、
        // そうでない場合は選択された商品名に一致するカードのみを対象とする
        return productFilter === 'all' || card.product === productFilter;
    });

    const sortedCollectionCards = [...filteredCardsForCollection].sort((a, b) => {
        return a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: 'base' });
    });

    if (sortedCollectionCards.length === 0) {
        cardCollectionDisplayArea.innerHTML = '<p>このパックには表示するカードがありません。または、カードデータが正しく読み込まれていません。</p>';
        return;
    }

    sortedCollectionCards.forEach(card => {
        const cardDiv = document.createElement('div');
        cardDiv.classList.add('collection-card');

        const ownedCount = ownedCards[card.number] || 0;

        if (ownedCount === 0) {
            cardDiv.classList.add('not-owned');
        }

        if (card.rarity) {
            cardDiv.classList.add(`rarity-${card.rarity}`);
        }

        const rarityBadge = document.createElement('span');
        rarityBadge.classList.add('card-rarity');
        rarityBadge.textContent = card.rarity;
        cardDiv.appendChild(rarityBadge);

        const ownedCountBadge = document.createElement('span');
        ownedCountBadge.classList.add('owned-count');
        ownedCountBadge.textContent = `x${ownedCount}`;
        cardDiv.appendChild(ownedCountBadge);

        const imagePath = `./cards_images/${card.number}.png`;
        const cardImageWrapper = document.createElement('div');
        cardImageWrapper.classList.add('card-image-wrapper');
        cardImageWrapper.style.backgroundImage = `url('${imagePath}')`;
        cardImageWrapper.onerror = function() {
            this.style.backgroundImage = `url('./cards_images/no_image.png')`;
        };
        cardDiv.appendChild(cardImageWrapper);

        const cardName = document.createElement('p');
        cardName.classList.add('card-name');
        cardName.textContent = card.name;
        cardDiv.appendChild(cardName);

        const cardNumber = document.createElement('p');
        cardNumber.classList.add('card-number');
        cardNumber.textContent = `No. ${card.number}`;
        cardDiv.appendChild(cardNumber);

        cardCollectionDisplayArea.appendChild(cardDiv);
    });
}

/**
 * コンプリート率を計算し表示する関数
 * @param {string} productFilter - コンプリート率を計算する対象の商品名。'all'の場合は全商品。
 */
function updateCompletionRates(productFilter) {
    const allCollectionCardsFiltered = cardsData.filter(card => {
        return productFilter === 'all' || card.product === productFilter;
    });

    if (!allCollectionCardsFiltered || allCollectionCardsFiltered.length === 0) {
        overallCompletionElement.textContent = '0%';
        // 商品ごとのコンプリート率表示はここでは不要
        return;
    }

    let ownedUniqueCards = 0;
    allCollectionCardsFiltered.forEach(card => {
        if (ownedCards[card.number] && ownedCards[card.number] > 0) {
            ownedUniqueCards++;
        }
    });

    const totalUniqueCards = allCollectionCardsFiltered.length;
    const overallRate = (totalUniqueCards > 0) ? ((ownedUniqueCards / totalUniqueCards) * 100).toFixed(2) : 0;
    overallCompletionElement.textContent = `${overallRate}%`;

    // 商品ごとのコンプリート率要素はopen.htmlでは表示しないため、操作は不要
    // productCompletionRatesElement.innerHTML = '';
}