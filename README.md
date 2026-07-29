# Tài liệu tham khảo ngôn ngữ lập trình Java

Bộ tài liệu tham chiếu **in-depth / advanced** cho ngôn ngữ Java, nhắm **JDK 25 LTS**. Không phải giáo trình nhập môn: các khái niệm được trình bày dạng tham khảo nhanh kèm chi tiết nâng cao (semantics, JEP/version gates, pitfalls). Nếu chưa biết Java, bắt đầu bằng The Java Tutorials bên dưới, rồi dùng bộ này khi cần tra cứu sâu hơn.

Language level / preview features phụ thuộc toolchain và `--enable-preview` (hoặc `--source`/`--release` của `javac`). Nội dung các file ghi rõ khi tính năng là final, preview, hoặc runtime-only (JVM flags).

---

Tham khảo chính thức: [The Java Tutorials](https://docs.oracle.com/javase/tutorial/) · [Java Language Specification](https://docs.oracle.com/javase/specs/) · [JDK 25 JEPs](https://openjdk.org/projects/jdk/25/) · [API docs](https://docs.oracle.com/en/java/javase/25/docs/api/) · [OpenJDK 25](https://openjdk.org/projects/jdk/25/)

---

## Nội dung

### Ngôn ngữ cốt lõi

- [Hàm main](main-function.md)
- [Package & Module](packages-modules.md)
- [Hệ thống kiểu dữ liệu](typesystem.md)
- [Literal](literals.md)
- [Toán tử](operators.md)
- [Từ khóa](keywords.md)
- [Phát biểu](statements.md)
- [Phương thức](methods.md)
- [Annotation](annotations.md)

### OOP & Functional

- [Lập trình hướng đối tượng](oop.md)
- [Lambda & Functional interface](lambdas-functional.md)
- [Exception](exceptions.md)
- [Tập hợp & Generics](collections-generics.md)
- [Stream API](streams.md)

### Đồng bộ & bất đồng bộ

- [Thread & Virtual thread](threading.md)
- [Lập trình bất đồng bộ](async.md)

### Phiên bản

- [Java 25 — điểm nổi bật](java25.md)
