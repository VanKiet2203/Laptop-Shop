#!/usr/bin/env python3
"""Sinh từ điển dữ liệu + ERD (Mermaid) từ database/01_schema.sql.
Chạy:  python tools/gen_dictionary.py   ->  docs/DATABASE_DICTIONARY.md
Dùng lại nội dung này cho phần "Bảng mô tả các bảng và thuộc tính" trong báo cáo."""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
sql = (root / "database/01_schema.sql").read_text(encoding="utf-8")

tables, order = {}, []
for m in re.finditer(r"--\s*\[Table\]\s*(\w+):\s*(.*?)\nCREATE TABLE dbo\.(\w+) \((.*?)\n\);", sql, re.S):
    name, desc, _, body = m.group(1), m.group(2).strip(), m.group(3), m.group(4)
    cols, pks, fks, uqs, cks = [], set(), [], [], []
    for line in body.split("\n"):
        line = line.rstrip()
        if not line.strip():
            continue
        cm = re.search(r"--\s*(.*)$", line)
        comment = cm.group(1).strip() if cm else ""
        code = re.sub(r"--.*$", "", line).strip().rstrip(",")
        if code.upper().startswith("CONSTRAINT"):
            if "PRIMARY KEY" in code:
                pks |= set(x.strip() for x in re.search(r"\((.*?)\)", code).group(1).split(","))
            elif "FOREIGN KEY" in code:
                r = re.search(r"FOREIGN KEY \((.*?)\) REFERENCES dbo\.(\w+)\((.*?)\)", code)
                fks.append((r.group(1), r.group(2), r.group(3)))
            elif "UNIQUE" in code:
                uqs.append(re.search(r"\((.*?)\)", code).group(1))
            elif "CHECK" in code:
                cks.append(re.sub(r"CONSTRAINT \w+ CHECK ", "", code))
            continue
        cmatch = re.match(r"(\w+)\s+(AS\s+\(.*?\)\s*PERSISTED|[A-Z]+\d*(?:\([\w,]+\))?)(.*)", code)
        if not cmatch:
            continue
        cname, ctype, rest = cmatch.groups()
        if ctype.upper().startswith("AS"):
            ctype = "Computed"
        cols.append(dict(name=cname, type=ctype, null=("NOT NULL" not in rest.upper() and ctype != "Computed"),
                         identity="IDENTITY" in rest.upper(), default=re.search(r"DEFAULT\s+(.*)", rest),
                         comment=comment))
    tables[name] = dict(desc=desc, cols=cols, pks=pks, fks=fks, uqs=uqs, cks=cks)
    order.append(name)

out = ["# Từ điển dữ liệu & ERD - LaptopShopDB", "",
       f"> Sinh tự động từ `database/01_schema.sql` ({len(order)} bảng). Không sửa tay - sửa comment trong file SQL rồi chạy lại `python tools/gen_dictionary.py`.", "",
       "## 1. Sơ đồ quan hệ (ERD)", "", "```mermaid", "erDiagram"]
for t in order:
    for (c, rt, rc) in tables[t]["fks"]:
        card = "|o--o{" if any(col["name"] == c and col["null"] for col in tables[t]["cols"]) else "||--o{"
        out.append(f"    {rt} {card} {t} : \"{c}\"")
out += ["```", "", "## 2. Danh sách bảng", "", "| # | Bảng | Mô tả |", "|---|------|-------|"]
for i, t in enumerate(order, 1):
    out.append(f"| {i} | `{t}` | {tables[t]['desc']} |")
out += ["", "## 3. Mô tả chi tiết từng bảng", ""]
for t in order:
    d = tables[t]
    out += [f"### {t}", "", d["desc"], "", "| Cột | Kiểu | Null | Khoá | Mặc định | Mô tả |", "|-----|------|------|------|----------|-------|"]
    fkcols = {c: f"FK → {rt}" for c, rt, _ in d["fks"]}
    for c in d["cols"]:
        key = []
        if c["name"] in d["pks"]: key.append("PK")
        if c["name"] in fkcols: key.append(fkcols[c["name"]])
        df = c["default"].group(1).strip().rstrip(",") if c["default"] else ""
        df = re.sub(r"\s*--.*", "", df)
        df = df.split(" -- ")[0]
        df = re.sub(r"^(\S+).*", r"\1", df) if False else df
        ident = " (IDENTITY)" if c["identity"] else ""
        out.append(f"| `{c['name']}` | {c['type']}{ident} | {'Có' if c['null'] else 'Không'} | {', '.join(key)} | {df} | {c['comment']} |")
    extra = []
    if d["uqs"]: extra.append("**Unique:** " + "; ".join(f"({u})" for u in d["uqs"]))
    if d["cks"]: extra.append("**Check:** " + "; ".join(f"`{c}`" for c in d["cks"]))
    if extra: out += ["", "  \n".join(extra)]
    out.append("")
(root / "docs/DATABASE_DICTIONARY.md").write_text("\n".join(out), encoding="utf-8")
print(f"OK: {len(order)} bảng -> docs/DATABASE_DICTIONARY.md")
