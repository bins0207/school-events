"""app.js와 style.css를 합쳐 apps-script/Index.html을 다시 만듭니다.
사용법: python build_gas.py   (app 폴더에서 실행)
"""
from pathlib import Path

here = Path(__file__).parent
idx = here / "apps-script" / "Index.html"
css = (here / "style.css").read_text(encoding="utf-8")
js = (here / "app.js").read_text(encoding="utf-8")

# 기존 Index.html의 학교 이름 설정은 그대로 유지
school = "우리 고등학교"
if idx.exists():
    old = idx.read_text(encoding="utf-8")
    key = 'SCHOOL_NAME: "'
    if key in old:
        school = old.split(key, 1)[1].split('"', 1)[0]

html = f"""<!DOCTYPE html>
<html lang="ko">
<head>
<base target="_top">
<meta charset="utf-8">
<style>
{css}
</style>
</head>
<body>
<div id="app"><div class="boot">불러오는 중…</div></div>
<div id="print"></div>
<dialog id="dlg"></dialog>
<div id="toast" role="status" aria-live="polite"></div>
<script>
// ── 설정: 학교 이름만 고치세요 ──
window.APP_CONFIG = {{ SCHOOL_NAME: "{school}" }};
</script>
<script>
{js}
</script>
</body>
</html>
"""
if "<?" in html:
    raise SystemExit("오류: Apps Script 템플릿 기호 '<?'가 들어 있습니다.")
idx.write_text(html, encoding="utf-8")
print(f"만들었습니다: {idx}")
