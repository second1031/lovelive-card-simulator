import cv2
import pytesseract
from PIL import Image
import pandas as pd
import os
import tkinter as tk
from tkinter import filedialog, messagebox
import re 

# --- 設定 ---
# Tesseractの実行ファイルのパスを指定します。
# Windowsの場合、Tesseractをインストールしたディレクトリ内のtesseract.exeのパスを指定してください。
# 例: r'C:\Program Files\Tesseract-OCR\tesseract.exe'
# macOS/Linuxの場合、Homebrewなどでインストールしていれば通常はパスの設定は不要です。
# 必要に応じて、以下の行をコメント解除し、正しいパスに修正してください。
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# Tesseractが一度に処理できる最大の画像の高さの目安（ピクセル）
MAX_TESSERACT_HEIGHT = 30000 

# --- 関数定義 ---

def preprocess_image(image_path):
    """
    OCRに適したように画像を前処理します。
    ここではグレースケール変換を行います。
    """
    img = cv2.imread(image_path)
    if img is None:
        raise FileNotFoundError(f"画像ファイルが見つかりません: {image_path}")

    gray_cv = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return gray_cv 

def extract_text_with_ocr_in_chunks(image_np_array):
    """
    画像をチャンク（断片）に分割し、各チャンクに対してOCRを実行してテキストを結合します。
    """
    height, width = image_np_array.shape[:2]

    if height <= MAX_TESSERACT_HEIGHT:
        pil_image = Image.fromarray(image_np_array)
        text = pytesseract.image_to_string(pil_image, lang='jpn+eng')
        return text
    else:
        all_extracted_text = []
        num_chunks = (height + MAX_TESSERACT_HEIGHT - 1) // MAX_TESSERACT_HEIGHT
        
        print(f"画像が大きすぎるため、{num_chunks}つのチャンクに分割してOCRを実行します。")

        for i in range(num_chunks):
            start_y = i * MAX_TESSERACT_HEIGHT
            end_y = min((i + 1) * MAX_TESSERACT_HEIGHT, height)
            
            chunk_image_np = image_np_array[start_y:end_y, :]
            
            print(f"  チャンク {i+1}/{num_chunks} ({start_y}:{end_y}) を処理中...")
            
            pil_chunk = Image.fromarray(chunk_image_np)
            chunk_text = pytesseract.image_to_string(pil_chunk, lang='jpn+eng')
            all_extracted_text.append(chunk_text)
        
        return "\n".join(all_extracted_text)

def parse_card_info_from_block(card_block_text):
    """
    1つのカードブロックのテキストから、各項目を解析します。
    行をまたがるキーワード-値ペアに対応し、柔軟なマッチングを行います。
    """
    card_info = {
        'カード名': '',
        '収録商品': '',
        'カードタイプ': '',
        'カード番号': '',
        'カード効果': ''
    }

    # クリーンな行リストを作成 (フィルタリングを簡素化)
    cleaned_lines = []
    for line in card_block_text.split('\n'):
        line = line.strip()
        if line: # 空行でなければ追加する (よりシンプルなチェック)
            cleaned_lines.append(line)
    
    # 状態管理変数
    current_key = None 
    current_effect_lines = [] 
    
    print(f"\n----- ブロック解析開始 -----\n{card_block_text}\n--------------------------")
    print("--- クリーンな行リスト ---")
    for i, cl in enumerate(cleaned_lines):
        print(f"[{i}]: '{cl}'")
    print("--------------------------")

    i = 0
    while i < len(cleaned_lines):
        line = cleaned_lines[i]
        print(f"L_clean[{i}]: '{line}' (current_key: {current_key})")

        # カード名
        # 最初に見つかった、特定のキーワードを含まない短い行をカード名とする
        # ただし、すでにカード名が設定されている場合はスキップ
        if not card_info['カード名'] and \
           not re.search(r'(収録|カード|起動|常時|詳しく)', line) and \
           len(line) > 1 and len(line) < 20: 
            card_info['カード名'] = line
            print(f"  -> カード名: '{card_info['カード名']}'")
            i += 1
            continue

        # 収録商品
        # OCR出力に見られた「プースターパバック」も考慮
        if re.search(r'収録(商品)?[:：]?|プースターパバック', line): # 「プースターパバック」もキーワードとして追加
            match = re.search(r'収録(商品)?[:：]?\s*(.+)|(プースターパバック)\s*(.+)?', line) # 「プースターパバック」自体も値に含める
            if match:
                if match.group(2): # 収録商品:XXX の形式
                    card_info['収録商品'] = match.group(2).strip()
                elif match.group(4): # プースターパバック XXX の形式
                    card_info['収録商品'] = match.group(3).strip() + " " + match.group(4).strip() if match.group(4) else match.group(3).strip()
                print(f"  -> 収録商品 (一行): '{card_info['収録商品']}'")
                current_key = None
            else: 
                current_key = '収録商品'
                print(f"  -> 収録商品キーワード検出。次の行で値を探します。")
            i += 1
            continue
        elif current_key == '収録商品': 
            card_info['収録商品'] = line 
            print(f"  -> 収録商品 (次行): '{card_info['収録商品']}'")
            current_key = None
            i += 1
            continue

        # カードタイプ
        if re.search(r'カードタイプ[:：]?|タイプ[:：]?|メンバー[:：]?|エネルギー[:：]?', line): # 「メンバー」もカードタイプとして追加
            match = re.search(r'(カード)?タイプ[:：]?\s*(\S+)|(メンバー|エネルギー)[:：]?\s*(\S+)?', line)
            if match:
                if match.group(2): 
                    card_info['カードタイプ'] = match.group(2).strip()
                elif match.group(4): 
                    card_info['カードタイプ'] = match.group(4).strip() if match.group(4) else match.group(3).strip()
                else: # 例: 「メンバー」だけ認識された場合
                    card_info['カードタイプ'] = match.group(3).strip() # (メンバー|エネルギー)のグループ
                print(f"  -> カードタイプ (一行): '{card_info['カードタイプ']}'")
                current_key = None
            else:
                current_key = 'カードタイプ'
                print(f"  -> カードタイプキーワード検出。次の行で値を探します。")
            i += 1
            continue
        elif current_key == 'カードタイプ':
            card_info['カードタイプ'] = line
            print(f"  -> カードタイプ (次行): '{card_info['カードタイプ']}'")
            current_key = None
            i += 1
            continue

        # カード番号
        if re.search(r'カード番号[:：]?|番号[:：]?', line):
            match = re.search(r'(カード)?番号[:：]?\s*([A-Za-z0-9!-]+)', line) 
            if match:
                card_info['カード番号'] = match.group(2).strip()
                print(f"  -> カード番号 (一行): '{card_info['カード番号']}'")
                current_key = None
            else:
                current_key = 'カード番号'
                print(f"  -> カード番号キーワード検出。次の行で値を探します。")
            i += 1
            continue
        elif current_key == 'カード番号':
            num_match = re.search(r'([A-Za-z0-9!-]+)', line)
            if num_match:
                card_info['カード番号'] = num_match.group(1).strip()
                print(f"  -> カード番号 (次行): '{card_info['カード番号']}'")
            else:
                print(f"  -> カード番号の値を検出できませんでした。'{line}'")
            current_key = None
            i += 1
            continue
        
        # カード効果
        if re.search(r'(カード)?効果[:：]?|起動効果[:：]?|常時効果[:：]?|登場[:：]?', line): # 「登場」も効果のキーワードとして追加
            effect_text_start = re.sub(r'(カード)?効果[:：]?|起動効果[:：]?|常時効果[:：]?|登場[:：]?', '', line).strip()
            current_effect_lines = [effect_text_start] if effect_text_start else []
            current_key = 'カード効果'
            print(f"  -> カード効果開始。開始行: '{effect_text_start}'")
            i += 1
            continue
        elif current_key == 'カード効果':
            if re.search(r'収録商品|カードタイプ|カード番号|詳しく見る', line):
                current_key = None
                print(f"  -> カード効果セクション終了 (次の項目キーワード検出)")
                continue
            else:
                current_effect_lines.append(line)
                print(f"  -> カード効果継続。追加: '{line}'")
                i += 1
                continue
        
        print(f"  -> どの項目にもマッチしませんでした。スキップ。")
        i += 1

    card_info['カード効果'] = ' '.join(current_effect_lines).strip()
    
    for key in card_info:
        card_info[key] = card_info[key].replace('\n', ' ').strip()
        card_info[key] = re.sub(r'\s+', ' ', card_info[key])

    print(f"----- ブロック解析終了 -----\n最終解析結果: {card_info}\n--------------------------")
    return card_info

# --- (メイン処理は変更なし) ---
if __name__ == "__main__":
    root = tk.Tk()
    root.withdraw()

    try:
        messagebox.showinfo("ファイル選択", "OCRを行う画像ファイルを選択してください。")
        image_path = filedialog.askopenfilename(
            title="画像ファイルを選択",
            filetypes=[("画像ファイル", "*.png;*.jpg;*.jpeg;*.gif;*.bmp"), ("全てのファイル", "*.*")]
        )

        if not image_path:
            messagebox.showinfo("キャンセル", "画像ファイルの選択がキャンセルされました。")
            exit()

        base_name = os.path.splitext(os.path.basename(image_path))[0]
        output_csv_path = f"{base_name}.csv"

        print(f"選択された画像ファイル: '{image_path}'")
        print(f"出力CSVファイル名: '{output_csv_path}'")

        print(f"画像 '{image_path}' を前処理中...")
        processed_image_np = preprocess_image(image_path)

        print("OCRでテキストを抽出中...")
        full_extracted_text = extract_text_with_ocr_in_chunks(processed_image_np)
        
        print("\n--- OCRで抽出された生のテキスト（全画像） ---")
        print(full_extracted_text)
        print("\n-------------------------------\n")

        card_blocks = re.split(r'詳しく見る\s*>\s*', full_extracted_text)
        
        parsed_cards_data = []
        for i, block_text in enumerate(card_blocks):
            block_text = block_text.strip()
            # 空行のみのブロックや、有効なテキストを含まないブロックはスキップ
            if not block_text:
                print(f"  -> 空のブロックまたはノイズのみのブロックのためスキップします。")
                continue
            
            card_data = parse_card_info_from_block(block_text)
            
            if any(card_data.values()): 
                 parsed_cards_data.append(card_data)
            else:
                print(f"  -> このブロックは有効なカード情報を含まないためスキップします。")


        if not parsed_cards_data:
            messagebox.showwarning("警告", "カード情報が一つも抽出されませんでした。\nOCRの精度が低いか、分割・解析ロジックの調整が必要です。")
            print("カード情報が一つも抽出されませんでした。OCRの精度が低いか、分割・解析ロジックの調整が必要です。")
            df = pd.DataFrame(columns=['カード名', '収録商品', 'カードタイプ', 'カード番号', 'カード効果'])
        else:
            df = pd.DataFrame(parsed_cards_data)
            expected_columns = ['カード名', '収録商品', 'カードタイプ', 'カード番号', 'カード効果']
            for col in expected_columns:
                if col not in df.columns:
                    df[col] = ''
            df = df[expected_columns]

        df.to_csv(output_csv_path, index=False, encoding='utf-8-sig') 

        messagebox.showinfo("完了", f"OCRで読み取り、解析したカードデータを '{output_csv_path}' に出力しました。")
        print(f"OCRで読み取り、解析したカードデータを '{output_csv_path}' に出力しました。")
        print("CSVファイルを開いて内容を確認してください。")
        print("\n--- 最終的なDataFrame ---")
        print(df)

    except FileNotFoundError as e:
        messagebox.showerror("エラー", f"エラー: {e}\n画像ファイルが指定されたパスに存在しないか、読み取れませんでした。")
        print(f"エラー: {e}")
        print("画像ファイルが指定されたパスに存在するか確認してください。")
    except pytesseract.TesseractNotFoundError:
        messagebox.showerror("エラー", "Tesseract OCRエンジンが見つかりません。\nTesseractが正しくインストールされ、Pythonからパスが通っているか確認してください。\nWindowsの場合、`pytesseract.pytesseract.tesseract_cmd` のパス設定が必要かもしれません。")
        print("エラー: Tesseract OCRエンジンが見つかりません。")
        print("Tesseract OCRが正しくインストールされ、Pythonからパスが通っているか確認してください。")
        print("Windowsの場合、`pytesseract.pytesseract.tesseract_cmd` のパス設定が必要かもしれません。")
    except Exception as e:
        messagebox.showerror("予期せぬエラー", f"予期せぬエラーが発生しました: {e}\n必要なPythonライブラリがインストールされているか確認してください。")
        print(f"予期せぬエラーが発生しました: {e}")
        print("必要なPythonライブラリ（Pillow, pytesseract, opencv-python, pandas）がインストールされているか確認してください。")
    finally:
        root.destroy()