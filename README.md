# Lexi990 – Học từ vựng TOEIC

Ứng dụng web học trọn bộ nội dung của 3 tài liệu:

| Bộ | Nội dung | Số mục |
|---|---|---|
| **1500 từ vựng TOEIC thường gặp** | Chia theo Part 1–7, có phiên âm, ví dụ và bản dịch | 1 497 |
| **600 Essential Words for the TOEIC** | 50 bài theo chủ đề, định nghĩa tiếng Anh, họ từ | 598 |
| **New TOEIC – Từ & cụm từ 0–990** | 10 chủ đề + cụm từ A–Z, giải thích cách dùng, đồng nghĩa, trái nghĩa | 678 |
| **Đề thi thử New TOEIC** | 200 câu đủ 7 Part, có ảnh Part 1 và lời thoại phần nghe | 200 câu |

Tổng cộng 1 966 từ/cụm từ khác nhau (từ trùng giữa các bộ được gộp lại, chỉ học một lần).

## Tính năng

- **Phiếu học hằng ngày**: số từ mới mỗi ngày, các từ đến hạn ôn, mục tiêu luyện tập, chuỗi ngày học, lịch 12 tuần.
- **Thẻ ghi nhớ lặp lại ngắt quãng (SRS)**: sau mỗi thẻ tự chấm Quên / Khó / Nhớ / Dễ, app tính ngày ôn lại cho từng từ (thuật toán họ SM-2 có bước học như Anki).
- **Luyện tập 7 dạng câu hỏi tự tạo** từ dữ liệu: chọn nghĩa, chọn từ, điền vào câu kiểu Part 5 (có phương án họ từ), nghe chọn nghĩa, viết từ, nghe và viết, đồng/trái nghĩa. Từ hay sai được hỏi lại nhiều hơn và đẩy vào hàng ôn.
- **Thi thử 200 câu**: chế độ luyện tập (biết đúng sai ngay) hoặc thi thật (đếm ngược 120 phút), phần nghe đọc bằng giọng đọc của trình duyệt, phiếu trả lời, điểm quy đổi ước tính, xem lại câu sai kèm lời thoại.
- **Tra từ** tiếng Anh hoặc tiếng Việt, gõ không dấu vẫn tìm được; trang từ gộp thông tin của cả 3 bộ.
- **Nghe cả bài** (nghe thụ động), đánh dấu từ, giao diện sáng/tối, dùng được offline (PWA), sao lưu và khôi phục tiến độ.

## Tiến độ được lưu ở đâu

- **Trên máy**: mọi tiến độ lưu ngay trong trình duyệt (`localStorage`), và app xin trình duyệt cấp lưu trữ bền vững để dữ liệu không bị tự dọn. Đóng trang, tắt máy hay deploy bản mới đều không mất.
- **Đồng bộ giữa các thiết bị** (tùy chọn): vào **Cài đặt → Đồng bộ giữa các thiết bị**, tạo token GitHub có quyền `gist` theo hướng dẫn trong app, dán vào rồi bấm Kết nối. Làm lại trên mỗi máy hoặc trình duyệt. App sẽ:
  - tự tải tiến độ về mỗi khi mở hoặc quay lại tab,
  - tự lưu lên vài giây sau mỗi lần học,
  - gộp thông minh khi học trên nhiều máy (lần ôn mới nhất của mỗi từ được giữ lại).

  Dữ liệu nằm trong một **gist bí mật** tên `lexi990-progress.json` trong tài khoản GitHub của bạn. Token chỉ lưu trên trình duyệt đó và không nằm trong file sao lưu.
- **Sao lưu thủ công**: Cài đặt → Tải bản sao lưu / Khôi phục từ tệp.

## Chạy trên máy

Không cần build. Mở terminal trong thư mục này:

```bash
python -m http.server 8000
```

rồi vào <http://localhost:8000>. (Mở trực tiếp `index.html` cũng chạy được, nhưng chế độ offline chỉ bật khi chạy qua https.)

## Đưa lên GitHub Pages

1. Tạo repository mới trên GitHub, ví dụ `lexi990` (không tick "Add a README").
2. Đẩy code lên:
   ```bash
   git remote add origin https://github.com/<tên-tài-khoản>/lexi990.git
   git push -u origin main
   ```
3. Vào **Settings → Pages**, mục **Build and deployment → Source** chọn **GitHub Actions**.
4. Workflow `.github/workflows/pages.yml` sẽ tự chạy mỗi lần push lên `main`. Xem tiến trình ở tab **Actions**; khi xong, trang có địa chỉ `https://<tên-tài-khoản>.github.io/lexi990/`.

Cách khác không cần Actions: ở bước 3 chọn **Deploy from a branch**, nhánh `main`, thư mục `/ (root)`.

Khi sửa file của app, tăng `VERSION` trong `sw.js` (ví dụ `lexi990-v2`) để người dùng nhận bản mới thay vì bản đã lưu offline.

## Cấu trúc

```
index.html, manifest.webmanifest, sw.js   khung app, PWA, cache offline
assets/css/app.css                        giao diện
assets/js/                                util, store (lưu trữ + gộp tiến độ), sync (đồng bộ GitHub Gist), srs (lặp lại ngắt quãng), lexicon (chỉ mục từ),
                                          speech (giọng đọc), quiz (tạo câu hỏi), view-*.js (các màn hình), app.js (router)
data/*.js                                 dữ liệu sinh tự động — không sửa tay
tools/build_data.py                       sinh data/*.js từ tools/src
tools/extract_1500.py                     trích bảng từ PDF 1500 từ (cần PyMuPDF)
tools/src/                                dữ liệu nguồn: bảng 1500 từ, 600 từ đã chỉnh, bản chép sách Từ & cụm từ, đề thi
```

Sửa dữ liệu trong `tools/src/` rồi chạy `python tools/build_data.py` để cập nhật `data/`.

## Lưu ý bản quyền

Nội dung từ vựng và đề thi được biên soạn lại từ các tài liệu học TOEIC để tự học. Nếu không chắc chắn về quyền chia sẻ công khai, hãy để repository ở chế độ **Private** (GitHub Pages cho repo private cần gói GitHub Pro/Team) hoặc chỉ chạy trên máy.
