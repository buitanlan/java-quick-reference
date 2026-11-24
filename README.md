# Tài liệu tham khảo ngôn ngữ lập trình Java

Bộ tài liệu tham chiếu **in-depth / advanced** cho ngôn ngữ Java, nhắm **JDK 27** (GA 15/9/2026). Không phải giáo trình nhập môn: các khái niệm được trình bày dạng tham khảo nhanh kèm chi tiết nâng cao (semantics, JEP/version gates, pitfalls). Nếu chưa biết Java, bắt đầu bằng The Java Tutorials bên dưới, rồi dùng bộ này khi cần tra cứu sâu hơn.

LTS gần nhất vẫn là **JDK 25**; 27 là feature release. `--release` chọn mức ngôn ngữ, bytecode và API nền tảng; `--enable-preview` bật thêm tính năng preview của **chính phiên bản JDK đang dùng**, không thay thế `--release`/`--source`. Code dùng preview phải được chạy bằng cùng major JDK và bật preview lúc chạy. Nội dung các file phân biệt final, preview, incubator và tùy chọn runtime của JVM.

**Quy ước ví dụ:** các đoạn ngắn minh họa độc lập, có thể lược bỏ imports, lớp bao hoặc kiểu nghiệp vụ (`User`, `Response`, …). Đoạn giả mã/cố ý sai được ghi chú riêng; không ghép mọi code block thành một chương trình. Lệnh biên dịch/chạy trong tài liệu chỉ là hướng dẫn sử dụng.

**Rà soát nội dung:** 24/11/2026; đối chiếu JLS và API JDK 27. Chạy `node scripts/check-docs.mjs` từ thư mục gốc để kiểm tra file/anchor nội bộ, code fence và lỗi encoding UTF-8 (script không biên dịch snippet hay kiểm tra URL ngoài).

---

Tham khảo chính thức: [Dev.java Learn](https://dev.java/learn/) · [The Java Tutorials (JDK 8)](https://docs.oracle.com/javase/tutorial/) · [JLS 27](https://docs.oracle.com/javase/specs/jls/se27/html/index.html) · [JDK 27 JEPs](https://openjdk.org/projects/jdk/27/) · [API docs](https://docs.oracle.com/en/java/javase/27/docs/api/) · [Thay đổi ngôn ngữ theo phiên bản](https://docs.oracle.com/en/java/javase/27/language/java-language-changes-summary.html)

---

## Nội dung

### Ngôn ngữ cốt lõi

- [Hàm main](main-function.md)
- [Package, Module & AOT](packages-modules.md)
- [Hệ thống kiểu dữ liệu](typesystem.md)
- [Annotation & Reflection](annotations.md)
- [Memory, GC, FFM & Diagnostics](memory-ffm.md)
- [Literal](literals.md)
- [Toán tử](operators.md)
- [Từ khóa](keywords.md)
- [Phát biểu](statements.md)
- [Phương thức](methods.md)

### OOP & Functional

- [Lập trình hướng đối tượng](oop.md)
- [Lambda & Functional interface](lambdas-functional.md)
- [Lập trình hàm & Data-Oriented Programming](functional.md)
- [Exception](exceptions.md)
- [Tập hợp & Generics](collections-generics.md)
- [Stream API](streams.md)

### Đồng bộ & bất đồng bộ

- [Thread & Virtual thread](threading.md)
- [Lập trình bất đồng bộ](async.md)
