"""從教育部公開的性平調查專業人才名冊 PDF 解析出 JSON。

用法：
    python scripts/extract-talent.py <名冊 PDF 路徑> [輸出路徑]

需要 pdfplumber：pip install pdfplumber

注意：這支解析器是針對特定版本的 PDF 手工調校過的（見下方 ROW_CORRECTIONS），
教育部改版後可能需要重新調整。跑完務必核對筆數是否合理，再更新 Release 附件。
名冊本身刻意不進版控，原因見 README。
"""

import collections
import json
import re
import sys
from pathlib import Path

MOE_SOURCE_PAGE = "https://www.gender.edu.tw/web/index.php/m7/m7_05_01_files_01?sid=210"

# 參數檢查放在 import pdfplumber 之前，這樣沒安裝套件時也看得到用法說明
if len(sys.argv) < 2:
    sys.exit(
        "用法：python scripts/extract-talent.py <名冊 PDF 路徑> [輸出路徑]\n"
        f"名冊可從教育部下載：{MOE_SOURCE_PAGE}"
    )

SOURCE = Path(sys.argv[1])
OUTPUT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("public/data/talent.json")

if not SOURCE.exists():
    sys.exit(f"找不到 {SOURCE}\n請先從教育部下載名冊 PDF：{MOE_SOURCE_PAGE}")

try:
    import pdfplumber
except ModuleNotFoundError:
    sys.exit("需要 pdfplumber，請先執行：pip install pdfplumber")


def norm(value):
    return re.sub(r"\s+", "", value or "")


records = []
ROW_CORRECTIONS = {
    (67, "584"): {"name": "王玉梅", "unit": "花蓮高農", "title": "退休教師"},
    (67, "585"): {"name": "王玉璽", "unit": "國立嘉義女子高級中學", "title": "學務創新人員"},
}
headers_by_width = {}
with pdfplumber.open(SOURCE) as pdf:
    for page_number, page in enumerate(pdf.pages[1:], 2):
        for table in page.extract_tables():
            if not table:
                continue
            header = None
            start = 0
            for row_index, row in enumerate(table[:4]):
                normalized = [norm(value) for value in row]
                if any("姓名" in value for value in normalized):
                    header = normalized
                    start = row_index + 1
                    break
            if header:
                headers_by_width[len(header)] = header
            else:
                header = headers_by_width.get(len(table[0]))
            if not header:
                continue

            name_index = next((i for i, value in enumerate(header) if "姓名" in value), None)
            gender_index = next((i for i, value in enumerate(header) if value in ("性別", "性別(男/女)")), None)
            unit_index = next((i for i, value in enumerate(header) if any(key in value for key in ("服務學校", "服務單位", "任職單位", "服務機關"))), None)
            title_index = next((i for i, value in enumerate(header) if "職稱" in value), None)
            if name_index is None:
                continue

            for row in table[start:]:
                if len(row) <= name_index:
                    continue
                name = re.sub(r"^[0-9]+[.、]?", "", norm(row[name_index]))
                # Several official PDF pages place the row-number dot in the
                # name cell, and some wrap a three-character name over lines.
                name = re.sub(r"[.．、]", "", name)
                row_number = re.sub(r"\D", "", norm(row[0])) if row else ""
                gender = norm(row[gender_index]) if gender_index is not None and gender_index < len(row) else ""
                unit = norm(row[unit_index]) if unit_index is not None and unit_index < len(row) else ""
                title = norm(row[title_index]) if title_index is not None and title_index < len(row) else ""
                correction = ROW_CORRECTIONS.get((page_number, row_number))
                if correction:
                    name, unit, title = correction["name"], correction["unit"], correction["title"]
                if not re.fullmatch(r"[\u3400-\u9fff·]{2,6}", name):
                    continue
                if gender not in ("", "男", "女"):
                    continue
                records.append({"name": name, "gender": gender, "unit": unit, "title": title, "page": page_number})

payload = {
    "source": "教育部校園性別事件調查專業人才庫",
    "sourceUrl": "https://www.gender.edu.tw/web/index.php/m7/m7_05_01_files_01?sid=210",
    "sourceFile": "教育部校園性別事件調查專業人才庫1150701.pdf",
    "updatedAt": "2026-07-01",
    "notice": "僅轉錄官方公開之姓名、性別、服務單位、職稱與原始頁碼；不代表曾參與任何特定案件。",
    # Preserve repeated official rows. The same person may appear in different
    # training cohorts or roster sections, and removing them changes official
    # search-result counts.
    "records": records,
}
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(json.dumps({"records": len(records), "gender": collections.Counter(item["gender"] for item in records)}, ensure_ascii=False))
