import csv
import json
from bs4 import BeautifulSoup

def scrape_card_data(html_file_path, output_csv_path, output_json_path=None):
    """
    HTMLファイルからカード情報を抽出し、CSVファイルとJSONファイルに出力します。

    Args:
        html_file_path (str): 入力となるHTMLファイルのパス。
        output_csv_path (str): 出力するCSVファイルのパス。
        output_json_path (str, optional): 出力するJSONファイルのパス。指定しない場合はJSONは出力しません。
    """
    try:
        with open(html_file_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
    except FileNotFoundError:
        print(f"エラー: ファイル '{html_file_path}' が見つかりません。")
        return

    soup = BeautifulSoup(html_content, 'html.parser')
    
    # ベースURL（画像URLが相対パスのため）
    base_url = "https://llofficial-cardgame.com"

    # 各カード情報が格納されている要素をすべて取得
    card_items = soup.find_all('div', class_='cardlist-Result_Item')
    
    # JSONデータ用のリスト
    cards_data = []
    
    with open(output_csv_path, 'w', newline='', encoding='utf-8') as csvfile:
        csv_writer = csv.writer(csvfile)
        # CSVのヘッダーを書き込む
        csv_writer.writerow(["カード画像", "カード名", "収録商品", "カードタイプ", "カード番号", "効果"])

        for card in card_items:
            # カード画像のURLを取得
            image_tag = card.select_one('.image-Inner img')
            image_url = base_url + image_tag['src'] if image_tag and image_tag.has_attr('src') else "N/A"

            # カード名を取得
            name_tag = card.select_one('.heading')
            name = name_tag.text.strip() if name_tag else "N/A"

            # 収録商品、カードタイプ、カード番号を取得
            product, card_type, card_number = "N/A", "N/A", "N/A"
            info_items = card.select('.info-Item')
            for item in info_items:
                dt_tag = item.find('dt')
                dd_tag = item.find('dd')
                if dt_tag and dd_tag:
                    dt = dt_tag.text.strip()
                    dd = dd_tag.text.strip()
                    if dt == '収録商品':
                        product = dd
                    elif dt == 'カードタイプ':
                        card_type = dd
                    elif dt == 'カード番号':
                        card_number = dd

            # カード効果テキストを取得
            effect_tag = card.find('p', class_='text')
            effect_text = ""
            if effect_tag:
                # <br>タグを改行文字に置換
                for br in effect_tag.find_all("br"):
                    br.replace_with("\n")
                
                # 効果アイコンのimgタグをaltテキスト（[登場]など）に置換
                for img in effect_tag.find_all("img"):
                    alt_text = img.get('alt', '')
                    img.replace_with(f"[{alt_text}]")
                
                effect_text = effect_tag.get_text(strip=True)
            else:
                # エネルギーカードなど効果テキストがない場合
                effect_text = "N/A"

            # CSVに一行書き込む
            csv_writer.writerow([image_url, name, product, card_type, card_number, effect_text])
            
            # JSONデータ用の辞書を作成
            card_data = {
                "id": card_number,
                "name": name,
                "rarity": "common",  # デフォルト値、実際のレアリティはカード番号から判断する必要があります
                "pack": product,
                "imageUrl": image_url,
                "cardType": card_type,
                "effect": effect_text
            }
            
            # カード番号からレアリティを判断
            if "R+" in card_number or "R＋" in card_number:
                card_data["rarity"] = "rare-plus"
            elif "R" in card_number:
                card_data["rarity"] = "rare"
            elif "P+" in card_number or "P＋" in card_number:
                card_data["rarity"] = "parallel-plus"
            elif "P" in card_number:
                card_data["rarity"] = "parallel"
            elif "SEC" in card_number:
                card_data["rarity"] = "secret"
            elif "LLE" in card_number:
                card_data["rarity"] = "energy"
            
            cards_data.append(card_data)
    
    print(f"スクレイピングが完了し、'{output_csv_path}' に保存されました。")
    
    # JSONファイルに出力
    if output_json_path:
        with open(output_json_path, 'w', encoding='utf-8') as jsonfile:
            json.dump(cards_data, jsonfile, ensure_ascii=False, indent=2)
        print(f"JSONデータが '{output_json_path}' に保存されました。")

# --- プログラムの実行 ---
if __name__ == '__main__':
    # 添付されたファイル名を指定
    input_html = 'card_page.txt' 
    # 出力したいCSVファイル名を指定
    output_csv = 'card_list.csv'
    # 出力したいJSONファイル名を指定
    output_json = 'card_list.json'
    
    scrape_card_data(input_html, output_csv, output_json)