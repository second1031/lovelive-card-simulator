import csv
import json

def convert_csv_to_js_array(csv_file_path, js_output_file_path):
    cards_data = []

    # CSVファイルを読み込む
    with open(csv_file_path, 'r', encoding='utf-8-sig', newline='') as csvfile:
        reader = csv.DictReader(csvfile)
        
        # ヘッダーをJSのキー名にマッピング (CSVの日本語ヘッダーをJSフレンドリーな名前に変換)
        # 「レアリティ」カラムはCSVになくても、ここで 'rarity' プロパティを生成する
        header_mapping = {
            "カード名": "name",
            "収録商品": "product",
            "カードタイプ": "type",
            "カード番号": "number",
            "カード効果": "effect"
            # CSVに「レアリティ」カラムが存在しても、ここでマッピングする必要はない
            # なぜなら、rarityはカード番号から動的に生成するから
        }
        
        # 読み込んだ各行をJavaScriptオブジェクト形式に変換
        for row in reader:
            card_obj = {}
            card_number = "" # カード番号を一時的に保持
            
            for csv_header, js_key in header_mapping.items():
                value = row.get(csv_header, '').strip() # 余分な空白を削除

                if js_key == "number":
                    card_number = value # カード番号を保存
                    
                card_obj[js_key] = value
            
            # カード番号からレアリティを抽出
            # 例: PL!-sd1-026-P ならば 'P'
            # 例: PL!S-pb1-068-LLE ならば 'LLE'
            if card_number:
                parts = card_number.split('-')
                if len(parts) > 1: # ハイフンが少なくとも1つある場合
                    card_obj['rarity'] = parts[-1] # 末尾の要素をレアリティとする
                else:
                    card_obj['rarity'] = '不明' # ハイフンがない場合は「不明」など
            else:
                card_obj['rarity'] = '不明' # カード番号がない場合

            cards_data.append(card_obj)

    # JavaScriptの出力形式を準備
    js_array_string = json.dumps(cards_data, indent=4, ensure_ascii=False)

    js_content = f"const cardsData = {js_array_string};"

    with open(js_output_file_path, 'w', encoding='utf-8') as jsfile:
        jsfile.write(js_content)

    print(f"'{csv_file_path}' を '{js_output_file_path}' に変換しました。")

# スクリプトを実行する際の例
if __name__ == "__main__":
    csv_input_path = 'data/cards_list_all.csv'
    js_output_path = 'cardsData.js' # 例: 別ファイルに出力

    convert_csv_to_js_array(csv_input_path, js_output_path)