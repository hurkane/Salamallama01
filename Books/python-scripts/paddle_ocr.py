#!/usr/bin/env python3
import sys, json, numpy as np
from paddleocr import PaddleOCR

def centroid(box):
    # box could be a list of 4 points or a bounding-array:
    pts = np.array(box)
    return pts[:,0].mean(), pts[:,1].mean()

def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error":"Usage: paddle_ocr.py <image> <lang1,lang2>"}))
        sys.exit(1)

    img_path  = sys.argv[1]
    langs     = sys.argv[2].split(",")
    lang_map  = {
        "en":"en","ch":"ch","chi_sim":"ch","chi_tra":"ch",
        "jpn":"japan","kor":"korean","fr":"french",
        "de":"german","es":"spanish"
    }

    all_results = []
    debug       = []

    for user_lang in langs:
        plang = lang_map.get(user_lang.strip(), user_lang.strip())
        debug.append(f"⏩ OCR pass for lang='{plang}'")

        try:
            ocr = PaddleOCR(
                use_angle_cls=(plang in ("ch","japan","korean")),
                lang=plang
            )
            res = ocr.ocr(img_path)
            debug.append(f"    → raw result count: {len(res)}")

            # normalize into a list of (centroid, text) tuples
            for item in res:
                # new-style dict output
                if isinstance(item, dict):
                    # Poly coords for sorting
                    box = item.get("rec_polys", item.get("dt_polys", []))
                    texts = item.get("rec_texts", [])
                    for t in texts:
                        c = centroid(box[0]) if box else (0,0)
                        all_results.append((c, t))

                # old-style list output
                elif isinstance(item, (list,tuple)) and len(item) >= 2:
                    box, (txt,score) = item[0], item[1]
                    c = centroid(box)
                    all_results.append((c, txt))

                else:
                    debug.append(f"    ⚠️  Unknown item format: {item}")

        except Exception as e:
            debug.append(f"    ❌ error for lang '{plang}': {e}")

    # sort by y (row), then x (col)
    all_results.sort(key=lambda x: (x[0][1], x[0][0]))

    # extract just the texts
    texts = [t for (_,t) in all_results]

    if not texts:
        debug.append("⚠️  No text detected after parsing")

    print(json.dumps({"debug": debug, "text": texts}, ensure_ascii=False))
    sys.exit(0)


if __name__ == "__main__":
    main()
