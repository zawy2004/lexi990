"""Extract the raw vocabulary table from "1500 từ vựng TOEIC thường gặp.pdf".

Usage:  python tools/extract_1500.py "<path to the 1500 PDF>"
Output: tools/src/1500_raw.json  (cells keep their line breaks; cleaning happens in build_data.py)

Requires PyMuPDF (pip install pymupdf).
"""
import json
import re
import sys
from pathlib import Path

import pymupdf

OUT = Path(__file__).parent / "src" / "1500_raw.json"


def column_of(x0, x1):
    if x0 < 60 and x1 - x0 < 50:
        return "no"
    if x0 < 120:
        return "word"
    if x0 < 200:
        return "pos"
    if x0 < 300:
        return "vi"
    return "ex"


def main(pdf_path):
    doc = pymupdf.open(pdf_path)
    entries, part = [], 0
    for page_index, page in enumerate(doc):
        heads = []
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                text = "".join(s["text"] for s in line["spans"]).strip()
                m = re.fullmatch(r"PART\s*(\d)", text)
                if m:
                    heads.append((line["bbox"][1], int(m.group(1))))
        heads.sort()
        for table in page.find_tables().tables:
            for row, cells_text in zip(table.rows, table.extract()):
                for y, n in heads:
                    if y < row.bbox[1]:
                        part = n
                f = dict(no="", word="", pos="", vi="", ex="")
                for cell, text in zip(row.cells, cells_text):
                    if not cell or not (text or "").strip():
                        continue
                    m = re.fullmatch(r"\s*PART\s*(\d)\s*", text)
                    if m:
                        part = int(m.group(1))
                        continue
                    if cell[2] - cell[0] > 400:  # merged spill-over cell
                        continue
                    key = column_of(cell[0], cell[2])
                    f[key] += ("\n" if f[key] else "") + text
                if f["no"].replace("\n", "").strip() == "STT" or f["word"].strip() == "Từ vựng":
                    continue
                if not any(v.strip() for v in f.values()):
                    continue
                if not f["no"].strip() and not f["word"].strip():
                    if entries:  # continuation of the previous row on a new page
                        for k in ("pos", "vi", "ex"):
                            if f[k].strip():
                                entries[-1][k] += "\n" + f[k]
                    continue
                entries.append(dict(part=part, page=page_index + 1, **f))
    OUT.write_text(json.dumps(entries, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"{len(entries)} rows -> {OUT}")


if __name__ == "__main__":
    main(sys.argv[1])
