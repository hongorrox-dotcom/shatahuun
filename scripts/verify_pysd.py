"""Вэб симуляторын тооцоог (public/js/model.js) Vensim загвартай PySD-ээр тулгана.

Хэрэглээ:
    pip install pysd
    python3 scripts/verify_pysd.py ["../Шатахууны үнэ 92 - макро нөлөөлөл.mdl"]
"""
import json, subprocess, sys, warnings
from pathlib import Path

import pysd

warnings.filterwarnings("ignore")
ROOT = Path(__file__).resolve().parent.parent
MDL = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / "Шатахууны үнэ 92 - макро нөлөөлөл.mdl"

# JS түлхүүр → Vensim хувьсагчийн нэр
PARAM = {
    "gdpShare": "ДНБ хувь", "popCap": "хүн амын даац", "tankSize": "савны хэмжээ", "invest": "Хөрөнгө оруулалт",
    "ptIncrease": "Нийтийн тээвэр нэмэгдүүлэх хувь", "tankYear": "Шатахууны нөөцийн сав нэмэгдүүлэх он",
    "excise": "Онцгой албан татварын зардал", "fuelTax": '"Автобензин, дизель түлшний албан татварын зардал"',
    "customs": '"Гаалийн албан татвар 5%"', "margin": "Борлуулагчийн ашгийн марж",
    "opYear": "Үйл ажиллагааны зардал нэмэгдэх он", "vat": '"НӨАТ 10%"', "taxYear": "Татвар бууруулах он",
}
OUT = {
    "infl": "Инфляци хэмжээ", "price": "Шатахууны үнэ", "reserve": "Шатахууны нийт нөөц", "car": "Автомашин",
    "ptCount": "нийтийн тээвэрийн тоо", "autos": "Авто машин", "tank": "Шатахууны нөөцийн сав",
    "cost": "Шатахууны нийлүүлэлтийн өртөг", "opCost": "Үйл ажиллагааны дотоод зардал", "tax": "Албан татварын зардал",
}
SCENARIOS = {
    "анхны утга": {},
    "бүх параметр": {"gdpShare": 0.2, "popCap": 4e6, "tankSize": 300000, "ptIncrease": 0.15, "tankYear": 2028,
                     "excise": 200000, "fuelTax": 40000, "customs": 0.05, "margin": 50000, "opYear": 2030,
                     "vat": 0.12, "taxYear": 2029},
}

model = pysd.read_vensim(str(MDL))
ok = True
for name, params in SCENARIOS.items():
    model.reload()  # PySD өмнөх ажиллуулалтын параметрийг хадгалдаг тул дахин ачаална
    ref = model.run(params={PARAM[k]: v for k, v in params.items()}, return_columns=list(OUT.values()))
    js = json.loads(subprocess.check_output(
        ["node", "--input-type=module", "-e",
         f"import {{simulate}} from './public/js/model.js'; console.log(JSON.stringify(simulate({json.dumps(params)})))"],
        cwd=ROOT))
    worst = max(abs(float(ref.loc[r["t"], v]) - r[k]) / max(1.0, abs(float(ref.loc[r["t"], v])))
                for r in js for k, v in OUT.items())
    ok &= worst < 1e-5
    print(f"{name:14} хамгийн их харьцангуй зөрүү: {worst:.1e}  {'OK' if worst < 1e-5 else 'ЗӨРҮҮТЭЙ'}")
sys.exit(0 if ok else 1)
