"""Step 4: replace the FREQ-TABLE block in hebrew-reader.html with freq-table.js."""
import os
S = os.path.dirname(os.path.abspath(__file__))
path = os.path.join(S, "..", "..", "hebrew-reader.html")
with open(path, encoding="utf-8", newline="") as f:
    html = f.read()
block = open(os.path.join(S, "freq-table.js"), encoding="utf-8", newline="").read()
a = html.index("/* FREQ-TABLE-BEGIN")
b = html.index("/* FREQ-TABLE-END */\n") + len("/* FREQ-TABLE-END */\n")
assert b > a, "end marker before start marker"
with open(path, "w", encoding="utf-8", newline="") as f:
    f.write(html[:a] + block + html[b:])
print("spliced", len(block), "chars")
