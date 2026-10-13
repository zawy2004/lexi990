"""Build the app data files (data/*.js) from the sources in tools/src.

    python tools/build_data.py

Sources
  src/1500_raw.json   table rows extracted from "1500 từ vựng TOEIC thường gặp.pdf" (see extract_1500.py)
  src/600.txt         "600 Essential Words For The TOEIC Test", cleaned and completed by hand
  src/book/*.txt      "Full bộ từ vựng ôn thi TOEIC từ 0-990" (scanned book), transcribed page by page
  src/test/*.txt      the full sample test (200 questions) from the same book

Book transcription format (one record per line):
  #3-2                      section marker (chapter-section)
  W word|ipa|pos|meaning    headword
  E english|vietnamese      example sentence
  N text                    usage note ("Giải thích")
  S/A/R/C a - b|pos|nghĩa   synonyms / antonyms / related words / compare
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "src"
OUT = ROOT / "data"

VI_CHARS = set("ăâđêôơưàảãạáằẳẵặắầẩẫậấèẻẽẹéềểễệếìỉĩịíòỏõọóồổỗộốờởỡợớùủũụúừửữựứỳỷỹỵý"
               "ĂÂĐÊÔƠƯÀẢÃẠÁẰẲẴẶẮẦẨẪẬẤÈẺẼẸÉỀỂỄỆẾÌỈĨỊÍÒỎÕỌÓỒỔỖỘỐỜỞỠỢỚÙỦŨỤÚỪỬỮỰỨỲỶỸỴÝ")
VI_STRONG = set("ăâđêôơưảãạằẳẵặắầẩẫậấẻẽẹềểễệếỉĩịỏõọồổỗộốờởỡợớủũụừửữựứỳỷỹỵ"
                "ĂÂĐÊÔƠƯẢÃẠẰẲẴẶẮẦẨẪẬẤẺẼẸỀỂỄỆẾỈĨỊỎÕỌỒỔỖỘỐỜỞỠỢỚỦŨỤỪỬỮỰỨỲỶỸỴ")

POS_MAP = {
    "n": "n", "noun": "n", "v": "v", "verb": "v", "a": "adj", "adj": "adj", "adjective": "adj",
    "adv": "adv", "adverb": "adv", "pre": "prep", "prep": "prep", "preposition": "prep",
    "conj": "conj", "conjunction": "conj", "pron": "pron", "pronoun": "pron", "aux": "aux", "phr": "phr.v",
}


def squash(s):
    return re.sub(r"\s+", " ", (s or "").replace("\n", " ")).strip()


def is_vi(line):
    strong = sum(ch in VI_STRONG for ch in line)
    weak = sum(ch in VI_CHARS for ch in line)
    return strong >= 1 or weak >= 2


def word_key(w):
    w = w.lower().replace("’", "'")
    w = re.sub(r"\s+", " ", w).strip(" .,;:")
    return w


def norm_headword(w):
    w = squash(w).replace("’", "'")
    out = []
    for tok in w.split(" "):
        if len(tok) > 1 and (tok.isupper() or re.search(r"[A-Z].*[&A-Z]", tok[1:] or "")):
            out.append(tok)  # acronyms: CFO, R&D, ATM
        else:
            out.append(tok[:1].lower() + tok[1:])
    return " ".join(out)


def pos_list(text):
    toks = re.split(r"[\s/,&.]+", text.strip().lower())
    res = [POS_MAP[t] for t in toks if t in POS_MAP]
    return res if res and len(res) == len([t for t in toks if t]) else None


def parse_pos_ipa(raw, word=""):
    s = squash(raw)
    s = re.sub(r"\*([a-z]+)\)", r"()", s)
    pos = []
    if re.search(r"(?i)phrasal\s*verb", s):
        pos.append("phr.v")
        s = re.sub(r"(?i)phrasal\s*verb", "", s)
    if re.search(r"(?i)\bidi?oms?\b", s):
        pos.append("idiom")
        s = re.sub(r"(?i)\bidi?oms?\b", "", s)
    for m in list(re.finditer(r"\(\s*([A-Za-z]+(?:\s*[/,&]\s*[A-Za-z]+)*)\s*(?:\)|(?=/))", s)):
        p = pos_list(m.group(1))
        if p:
            pos += p
            s = s.replace(m.group(0), " ", 1)
    s = s.replace("&", " ").replace("()", " ")
    s = squash(s).strip(" ,;")
    if pos_list(s):  # e.g. "Conjunction" written without brackets
        pos += pos_list(s)
        s = ""
    ipa = ""
    if s and not re.search(r"[A-Z]\d", s):
        ipa = s.replace("´", "ˈ").replace("¸", "ˌ").replace("̬", "").replace("̥", "")
        ipa = re.sub(r"^/?[A-Z]\s+/", "/", ipa)          # "/E /ɔːˈθentɪk/"
        if not ipa.startswith("/"):
            ipa = "/" + ipa
        body = ipa[1:]
        m = re.match(r"^(.*?)/([\sˌ/]*)$", body)            # trailing junk after the closing slash
        secondary = False
        if m:
            body, junk = m.group(1), m.group(2)
            secondary = "ˌ" in junk
        if " ˌ " in body:
            body = body.replace(" ˌ ", "")
            secondary = True
        body = re.sub(r"\s+", " ", re.sub(r"\s*/+\s*", " ", body)).strip(" /")
        if secondary and not body.startswith(("ˈ", "ˌ")):
            if word and " " not in word.strip() and " " in body:
                body = body.replace(" ", "ˌ", 1)
            else:
                body = "ˌ" + body
        ipa = "/" + body + "/" if body else ""
        if word and word.lower().split()[0] in ipa.lower():
            ipa = ""                                         # not a transcription
    seen = []
    for p in pos:
        if p not in seen:
            seen.append(p)
    return seen, ipa


def split_examples(raw):
    """Group example lines into (english, vietnamese) pairs.

    A line counts as Vietnamese when it carries Vietnamese diacritics. A short line without
    them that follows a Vietnamese line ("khác nhau.", "sát Darlington") is the tail of that
    translation, not a new English sentence.
    """
    lines = [l.strip() for l in (raw or "").split("\n") if l.strip()]
    chunks = []
    for line in lines:
        numbered = bool(re.match(r"^\d+\.\s", line))
        lang = "vi" if is_vi(line) else "en"
        if (lang == "en" and chunks and chunks[-1][0] == "vi" and not numbered
                and (len(line.split()) < 3 or not re.match(r"^[A-Z\"']", line))):
            lang = "vi"
        if chunks and chunks[-1][0] == lang and not numbered:
            chunks[-1][1].append(line)
        else:
            chunks.append([lang, [line]])
    pairs, cur = [], None
    for lang, ls in chunks:
        text = re.sub(r"^\d+\.\s*", "", " ".join(ls)).strip()
        if lang == "en":
            if cur:
                pairs.append(cur)
            cur = [text, ""]
        elif cur is None:
            cur = ["", text]
        else:
            cur[1] = (cur[1] + " " + text).strip()
    if cur:
        pairs.append(cur)
    return [p for p in pairs if p[0] or p[1]]


def compact(d):
    return {k: v for k, v in d.items() if v not in ("", None, [], {})}


# ---------------------------------------------------------------- 1500 words
PART_NAMES = {
    1: ("Part 1", "Mô tả tranh"), 2: ("Part 2", "Hỏi – đáp"), 3: ("Part 3", "Đoạn hội thoại"),
    4: ("Part 4", "Bài nói ngắn"), 5: ("Part 5", "Hoàn thành câu"), 6: ("Part 6", "Hoàn thành đoạn văn"),
    7: ("Part 7", "Đọc hiểu"),
}


TYPO_1500 = {"handrall": "handrail", "aprrove": "approve", "lock out a window": "look out a window",
             "arrange jewerly": "arrange jewelry"}


def build_1500():
    rows = json.loads((SRC / "1500_raw.json").read_text(encoding="utf-8"))
    items, groups = [], []
    by_part = {}
    for r in rows:
        pos, ipa = parse_pos_ipa(r["pos"], r["word"])
        ex = split_examples(r["ex"])
        stem = norm_headword(r["word"]).split(" ")[0][:4].lower()
        # extra examples that do not use the headword spilled over from the next row
        ex = ex[:1] + [p for p in ex[1:] if stem in p[0].lower()]
        no = int(r["no"]) if r["no"].strip().isdigit() else 0
        if not squash(r["vi"]):
            continue
        it = compact({
            "id": f"a{r['part']}-{no}",
            "w": TYPO_1500.get(norm_headword(r["word"]), norm_headword(r["word"])),
            "p": " ".join(pos),
            "i": ipa,
            "m": squash(r["vi"]),
            "e": ex[0][0] if ex else "",
            "ev": ex[0][1] if ex else "",
            "x": ex[1:],
        })
        items.append(it)
        by_part.setdefault(r["part"], []).append(it["id"])
    lessons = []
    for part, ids in sorted(by_part.items()):
        code, name = PART_NAMES[part]
        g = {"id": f"a-p{part}", "title": f"{code}: {name}", "lessons": []}
        size = 20
        for i in range(0, len(ids), size):
            chunk = ids[i:i + size]
            lid = f"a-p{part}-{i // size + 1}"
            lessons.append({"id": lid, "title": f"{code}, bài {i // size + 1}",
                            "sub": f"Từ {i + 1}–{i + len(chunk)}", "ids": chunk})
            g["lessons"].append(lid)
        groups.append(g)
    return {"id": "s1500", "title": "1500 từ vựng TOEIC thường gặp", "short": "1500 từ",
            "desc": "Từ vựng chia theo 7 Part của đề thi, có phiên âm, ví dụ và bản dịch.",
            "items": items, "lessons": lessons, "groups": groups}


# ---------------------------------------------------------------- 600 words
def build_600():
    items, lessons, groups = [], [], []
    cur = None
    for line in (SRC / "600.txt").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith("#"):
            n, title, title_vi = line[1:].split("|")
            cur = {"id": f"b-{n}", "title": f"Bài {n}: {title_vi}", "sub": title, "ids": []}
            lessons.append(cur)
            continue
        w, p, d, m, forms = (line.split("|") + [""] * 5)[:5]
        it = compact({"id": f"b{len(items) + 1}", "w": w, "p": p, "d": d, "m": m, "f": forms})
        items.append(it)
        cur["ids"].append(it["id"])
    names = ["Hợp đồng & kinh doanh", "Văn phòng", "Nhân sự", "Mua bán", "Tài chính",
             "Quản lý", "Ăn uống", "Du lịch", "Giải trí", "Sức khỏe"]
    for gi in range(10):
        groups.append({"id": f"b-g{gi + 1}", "title": f"Bài {gi * 5 + 1}–{gi * 5 + 5}: {names[gi]}",
                       "lessons": [l["id"] for l in lessons[gi * 5:gi * 5 + 5]]})
    return {"id": "s600", "title": "600 Essential Words for the TOEIC", "short": "600 từ",
            "desc": "50 bài theo chủ đề công sở, mỗi bài 12 từ kèm định nghĩa tiếng Anh và họ từ.",
            "items": items, "lessons": lessons, "groups": groups}


# ---------------------------------------------------------------- scanned book
BOOK_CHAPTERS = {
    1: ("General Business", "Thương mại tổng quát"), 2: ("Office Issues", "Hành chính văn phòng"),
    3: ("Personnel", "Nhân sự"), 4: ("Purchasing", "Mua hàng"), 5: ("Finance and Budgeting", "Tài chính và ngân sách"),
    6: ("Management Issues", "Vấn đề quản lý"), 7: ("Restaurants and Events", "Nhà hàng và sự kiện"),
    8: ("Travel", "Du lịch"), 9: ("Entertainment", "Giải trí"), 10: ("Health", "Sức khỏe"),
    11: ("Phrases", "Cụm từ"),
}
BOOK_SECTIONS = {
    "1-1": ("Contracts", "Hợp đồng"), "1-2": ("Negotiations", "Đàm phán"), "1-3": ("Marketing", "Tiếp thị"),
    "1-4": ("Sales", "Bán hàng"), "1-5": ("Conferences", "Hội nghị"), "1-6": ("Business Planning", "Kế hoạch kinh doanh"),
    "2-1": ("Board Meetings", "Cuộc họp hội đồng"), "2-2": ("Committees", "Ủy ban"), "2-3": ("Communication", "Thông tin"),
    "2-4": ("Furniture & Equipment", "Thiết bị văn phòng"), "2-5": ("Office Procedures", "Quy trình văn phòng"),
    "3-1": ("Recruiting", "Tuyển dụng"), "3-2": ("Retiring", "Nghỉ hưu"), "3-3": ("Salaries", "Mức lương"),
    "3-4": ("Promotions", "Thăng chức"), "3-5": ("Job Applications", "Đơn xin việc"),
    "4-1": ("Shopping", "Mua sắm"), "4-2": ("Ordering Supplies", "Đặt hàng"), "4-3": ("Shipping", "Vận chuyển hàng"),
    "4-4": ("Invoices", "Hóa đơn"),
    "5-1": ("Banking", "Ngân hàng"), "5-2": ("Investments", "Đầu tư"), "5-3": ("Taxes", "Thuế"),
    "5-4": ("Accounting", "Kế toán"), "5-5": ("Billing", "Thanh toán"),
    "6-1": ("Assembly Lines", "Dây chuyền lắp ráp"), "6-2": ("Quality Control", "Điều khiển chất lượng"),
    "6-3": ("Management Meetings", "Cuộc họp quản lý"),
    "7-1": ("Banquets", "Tiệc"), "7-2": ("Informal Lunches", "Bữa trưa thân mật"), "7-3": ("Receptions", "Tiệc chiêu đãi"),
    "7-4": ("Reservations", "Đặt chỗ trước"), "7-5": ("Events", "Sự kiện"),
    "8-1": ("Transportation", "Giao thông vận tải"), "8-2": ("Tickets", "Vé"), "8-3": ("Schedules", "Lịch trình"),
    "8-4": ("Stations and Terminals", "Trạm dừng và ga cuối"),
    "9-1": ("Movies", "Phim ảnh"), "9-2": ("Theater", "Nhà hát"), "9-3": ("Music", "Âm nhạc"), "9-4": ("Art", "Nghệ thuật"),
    "9-5": ("Media", "Truyền thông"),
    "10-1": ("Medical Insurance", "Bảo hiểm y tế"), "10-2": ("At the Doctor's Office", "Tại phòng bác sĩ"),
    "10-3": ("At the Dentist's Office", "Tại phòng nha sĩ"), "10-4": ("At the Clinic", "Tại phòng khám"),
    "10-5": ("At the Hospital", "Tại bệnh viện"),
    "11-1": ("Phrases A–E", "Cụm từ A–E"), "11-2": ("Phrases F–J", "Cụm từ F–J"), "11-3": ("Phrases K–O", "Cụm từ K–O"),
    "11-4": ("Phrases P–T", "Cụm từ P–T"), "11-5": ("Phrases U–Z", "Cụm từ U–Z"),
}
REL_KEYS = {"S": "s", "A": "a", "R": "r", "C": "c"}


def norm_pos_book(p):
    p = p.strip().rstrip(".").replace(" ", "")
    if not p:
        return ""
    parts = [x for x in re.split(r"[.,]+", p) if x]
    return " ".join(POS_MAP.get(x.lower(), x.lower()) for x in parts)


def build_book():
    items, sections = [], {}
    cur_sec, cur = None, None
    for f in sorted((SRC / "book").glob("p*.txt")):
        for line in f.read_text(encoding="utf-8").splitlines():
            line = line.rstrip()
            if not line.strip():
                continue
            if line.startswith("#"):
                cur_sec = line[1:].strip()
                sections.setdefault(cur_sec, [])
                continue
            tag, rest = line[0], line[2:]
            if tag == "W":
                w, ipa, p, m = (rest.split("|") + [""] * 4)[:4]
                cur = {"id": f"c{cur_sec}-{len(sections[cur_sec]) + 1}", "w": w.strip(),
                       "i": f"/{ipa.strip()}/" if ipa.strip() else "", "p": norm_pos_book(p), "m": m.strip()}
                if cur_sec.startswith("11-"):
                    cur["k"] = "phrase"
                items.append(cur)
                sections[cur_sec].append(cur["id"])
            elif tag == "E":
                en, vi = (rest.split("|") + [""])[:2]
                if "e" in cur:
                    cur.setdefault("x", []).append([en.strip(), vi.strip()])
                else:
                    cur["e"], cur["ev"] = en.strip(), vi.strip()
            elif tag == "N":
                cur["n"] = (cur.get("n", "") + " " + rest.strip()).strip()
            elif tag in REL_KEYS:
                ws, p, m = (rest.split("|") + ["", ""])[:3]
                entry = [ws.strip(), norm_pos_book(p), m.strip()]
                cur.setdefault(REL_KEYS[tag], []).append(entry)
            else:
                raise ValueError(f"{f.name}: bad line {line!r}")
    lessons, groups = [], []
    for ch in range(1, 12):
        en, vi = BOOK_CHAPTERS[ch]
        g = {"id": f"c-ch{ch}", "title": (f"Chương {ch}: {vi}" if ch < 11 else "Cụm từ A–Z"), "sub": en, "lessons": []}
        for sec, ids in sections.items():
            if sec.split("-")[0] != str(ch):
                continue
            sen, svi = BOOK_SECTIONS[sec]
            lid = f"c-{sec}"
            lessons.append({"id": lid, "title": f"{sec} {svi}", "sub": sen, "ids": ids})
            g["lessons"].append(lid)
        groups.append(g)
    return {"id": "sbook", "title": "New TOEIC – Từ & cụm từ 0–990", "short": "Từ & cụm từ",
            "desc": "Sách theo 10 chủ đề công sở và cụm từ A–Z: ví dụ, giải thích cách dùng, đồng nghĩa, trái nghĩa.",
            "items": items, "lessons": lessons, "groups": groups}


# ---------------------------------------------------------------- sample test
ANSWER_KEY_READING = (
    "CABDACABDC DABDDCACBD BACAABDDAC BDABCDABCD"  # 101-140
    "ABCBACABAD BA"  # 141-152
    "CDBBCADACA CBACBBABCB CDBCABDBAD ADAADDCDDA CBDBCDAB"  # 153-200
)
LETTERS = "ABCD"


def read_blocks(path):
    return [l.rstrip() for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]


def parse_options(lines, i):
    opts = []
    while i < len(lines) and re.match(r"^[A-D] ", lines[i]):
        opts.append(lines[i][2:].strip())
        i += 1
    return opts, i


def build_test():
    t = SRC / "test"
    q = {}  # number -> question dict
    # Part 1 & 2
    lines = read_blocks(t / "test_listen1.txt")
    i = 0
    while i < len(lines):
        l = lines[i]
        if l.startswith("@"):
            i += 1
            continue
        m = re.match(r"^Q(\d+)\|([A-D])(?:\|(.*))?$", l)
        n, ans, text = int(m.group(1)), LETTERS.index(m.group(2)), (m.group(3) or "").strip()
        opts, i = parse_options(lines, i + 1)
        q[n] = {"n": n, "q": text, "o": opts, "a": ans}
    for fn in ("test_p3q.txt", "test_p4q.txt"):
        lines = read_blocks(t / fn)
        i = 0
        while i < len(lines):
            l = lines[i]
            if l.startswith("@"):
                i += 1
                continue
            m = re.match(r"^Q(\d+)\|([A-D])\|(.*)$", l)
            n = int(m.group(1))
            opts, i = parse_options(lines, i + 1)
            q[n] = {"n": n, "q": m.group(3).strip(), "o": opts, "a": LETTERS.index(m.group(2))}
    # scripts for parts 3-4
    scripts = []
    for l in read_blocks(t / "test_scripts.txt"):
        if l.startswith("@S"):
            head, _, intro = l[2:].partition("|")
            a, b = map(int, head.split("-"))
            scripts.append({"from": a, "to": b, "intro": intro.strip(), "lines": []})
        else:
            m = re.match(r"^([MF]): (.*)$", l)
            scripts[-1]["lines"].append([m.group(1), m.group(2)] if m else ["N", l])
    # parts 5-7
    lines = read_blocks(t / "test_p5.txt")
    passages, part, i = [], None, 0
    while i < len(lines):
        l = lines[i]
        if l.startswith("@P"):
            part = int(l[2:])
            i += 1
            continue
        if l.startswith("@T"):
            head, _, intro = l[2:].partition("|")
            a, b = map(int, head.split("-"))
            body = []
            i += 1
            while i < len(lines) and not re.match(r"^Q\d+", lines[i]):
                body.append(lines[i])
                i += 1
            passages.append({"part": part, "from": a, "to": b, "intro": intro.strip(), "text": body})
            continue
        m = re.match(r"^Q(\d+)(?:\|(.*))?$", l)
        n = int(m.group(1))
        opts, i = parse_options(lines, i + 1)
        q[n] = {"n": n, "q": (m.group(2) or "").strip(), "o": opts}
    key = ANSWER_KEY_READING.replace(" ", "")
    assert len(key) == 100, len(key)
    for k, letter in enumerate(key):
        q[101 + k]["a"] = LETTERS.index(letter)
    for n in range(1, 11):
        q[n]["img"] = f"assets/img/test/p1-{n:02d}.jpg"
    missing = [n for n in range(1, 201) if n not in q or "a" not in q[n] or not q[n]["o"]]
    assert not missing, missing
    parts = [
        {"id": 1, "name": "Part 1: Mô tả tranh", "kind": "photo", "listen": True,
         "help": "Nghe 4 câu mô tả và chọn câu đúng nhất với bức ảnh.", "qs": [q[n] for n in range(1, 11)]},
        {"id": 2, "name": "Part 2: Hỏi – đáp", "kind": "qr", "listen": True,
         "help": "Nghe câu hỏi và 3 câu trả lời, chọn câu trả lời phù hợp.", "qs": [q[n] for n in range(11, 41)]},
        {"id": 3, "name": "Part 3: Đoạn hội thoại", "kind": "group", "listen": True,
         "help": "Nghe đoạn hội thoại rồi trả lời 3 câu hỏi.",
         "groups": [dict(s, qs=[q[n] for n in range(s["from"], s["to"] + 1)]) for s in scripts if s["from"] < 71]},
        {"id": 4, "name": "Part 4: Bài nói ngắn", "kind": "group", "listen": True,
         "help": "Nghe bài nói ngắn rồi trả lời 3 câu hỏi.",
         "groups": [dict(s, qs=[q[n] for n in range(s["from"], s["to"] + 1)]) for s in scripts if s["from"] >= 71]},
        {"id": 5, "name": "Part 5: Hoàn thành câu", "kind": "sentence", "listen": False,
         "help": "Chọn từ hoặc cụm từ đúng để hoàn thành câu.", "qs": [q[n] for n in range(101, 141)]},
        {"id": 6, "name": "Part 6: Hoàn thành đoạn văn", "kind": "group", "listen": False,
         "help": "Đọc đoạn văn và chọn đáp án cho mỗi chỗ trống.",
         "groups": [dict(p, qs=[q[n] for n in range(p["from"], p["to"] + 1)]) for p in passages if p["part"] == 6]},
        {"id": 7, "name": "Part 7: Đọc hiểu", "kind": "group", "listen": False,
         "help": "Đọc văn bản rồi trả lời các câu hỏi.",
         "groups": [dict(p, qs=[q[n] for n in range(p["from"], p["to"] + 1)]) for p in passages if p["part"] == 7]},
    ]
    return {"id": "test1", "title": "Đề thi thử New TOEIC (200 câu)", "parts": parts}


def write_js(name, var, data):
    js = (f"/* Generated by tools/build_data.py — do not edit by hand. */\n"
          f"(window.LEXI_DATA = window.LEXI_DATA || {{}}).{var} = "
          + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
    (OUT / name).write_text(js, encoding="utf-8")
    print(f"{name}: {len(js) // 1024} KB")


def main():
    OUT.mkdir(exist_ok=True)
    srcs = [build_1500(), build_600(), build_book()]
    for s in srcs:
        n = len(s["items"])
        print(f"{s['id']}: {n} items, {len(s['lessons'])} lessons")
    write_js("words-1500.js", "s1500", srcs[0])
    write_js("words-600.js", "s600", srcs[1])
    write_js("words-book.js", "sbook", srcs[2])
    write_js("test.js", "test", build_test())
    keys = {word_key(it["w"]) for s in srcs for it in s["items"]}
    print(f"unique headwords across sources: {len(keys)}")


if __name__ == "__main__":
    main()
