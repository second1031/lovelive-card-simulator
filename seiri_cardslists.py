import re

def process_card_data(file_content):
    """
    カードデータを整理し、指定されたCSV形式で出力します。

    Args:
        file_content (str): 読み込んだファイルの内容文字列。

    Returns:
        str: 整理されたCSV形式の文字列。
    """
    lines = file_content.splitlines()
    
    # 結果を格納するリスト
    processed_lines = ["カード名,収録商品,カードタイプ,カード番号,カード効果"]
    
    current_card_data = {}
    effect_lines = []
    
    for line in lines:
        line = line.strip()

        if not line: # 空行はスキップ
            continue

        if line == "詳しく見る":
            # 「詳しく見る」に到達したら、現在のカードデータを確定
            card_name = current_card_data.get('カード名', '').replace('"', '""')
            product = current_card_data.get('収録商品', '').replace('"', '""')
            card_type = current_card_data.get('カードタイプ', '').replace('"', '""')
            card_number = current_card_data.get('カード番号', '').replace('"', '""')
            
            # カード効果を連結し、空の場合は「効果なし」とする
            if effect_lines:
                # ユーザーの要求により、効果テキスト内の改行は保持しつつ、全体を連結
                # CSVとして出力するために、改行を含む場合は全体をダブルクォーテーションで囲む
                card_effect = "\\n".join(effect_lines).replace('"', '""')
                if "\n" in card_effect: # 改行文字が含まれる場合
                    card_effect = f'"{card_effect}"'
            else:
                card_effect = "効果なし"
            
            processed_lines.append(f"{card_name},{product},{card_type},{card_number},{card_effect}")
            
            # 次のカードのためにリセット
            current_card_data = {}
            effect_lines = []
            continue

        # 各フィールドを正規表現で抽出
        if line.startswith("収録商品"):
            current_card_data['収録商品'] = line.replace("収録商品", "").strip()
        elif line.startswith("カードタイプ"):
            current_card_data['カードタイプ'] = line.replace("カードタイプ", "").strip()
        elif line.startswith("カード番号"):
            current_card_data['カード番号'] = line.replace("カード番号", "").strip()
            # カード番号が見つかったら、そこまでの行がカード名
            if 'カード名' not in current_card_data:
                # 収録商品より前の行をカード名と仮定 (複雑なケースに対応するため、ここを調整する可能性あり)
                # 今回のデータ形式では、「収録商品」の直前の行がカード名であると仮定
                # あるいは、新しいカードの始まりが「収録商品」から始まっていない行で、
                # かつこれまでのフィールド（収録商品、カードタイプ、カード番号）がすべて揃っていない場合
                pass # 後続の処理でカード名を特定する
        else:
            # それ以外の行はカード名、またはカード効果の候補
            if '収録商品' not in current_card_data:
                # まだ収録商品が見つかっていない場合、それはカード名と仮定
                current_card_data['カード名'] = line
            else:
                # 収録商品が見つかっており、かつ「詳しく見る」に到達していない場合、効果テキスト
                effect_lines.append(line)
                
    # ファイルの終わりに「詳しく見る」がない場合の残りを処理
    if current_card_data:
        card_name = current_card_data.get('カード名', '').replace('"', '""')
        product = current_card_data.get('収録商品', '').replace('"', '""')
        card_type = current_card_data.get('カードタイプ', '').replace('"', '""')
        card_number = current_card_data.get('カード番号', '').replace('"', '""')
        
        if effect_lines:
            card_effect = "\\n".join(effect_lines).replace('"', '""')
            if "\n" in card_effect:
                card_effect = f'"{card_effect}"'
        else:
            card_effect = "効果なし"
        
        processed_lines.append(f"{card_name},{product},{card_type},{card_number},{card_effect}")

    return "\n".join(processed_lines)

# ファイルから内容を読み込む例
# 実際のファイル名に合わせて 'cardslist_all - cardslist_bp1.csv' を指定してください
try:
    with open('cardslist_all.csv', 'r', encoding='utf-8') as f:
        file_content = f.read()
    
    # 処理を実行
    output_csv = process_card_data(file_content)
    
    # 結果を出力（または新しいファイルに書き込む）
    #print(output_csv)
    
    # もし新しいCSVファイルに保存したい場合
    with open('processed_cards.csv', 'w', encoding='utf-8', newline='') as outfile:
        outfile.write(output_csv)

except FileNotFoundError:
    print("指定されたファイルが見つかりません。ファイル名を確認してください。")
except Exception as e:
    print(f"エラーが発生しました: {e}")