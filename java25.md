# Java 25 — điểm nổi bật  

*(LTS — GA tháng 9/2025)*

Java **25** là bản **Long-Term Support (LTS)** tiếp theo sau 21 và 17. Tài liệu này tóm tắt các **JEP** liên quan trực tiếp tới developer ngôn ngữ / API — không phải changelog toàn bộ JVM/ops.

Trang dự án: [https://openjdk.org/projects/jdk/25/](https://openjdk.org/projects/jdk/25/)

---

## Mục lục

- [Java 25 — điểm nổi bật](#java-25--điểm-nổi-bật)
  - [Mục lục](#mục-lục)
  - [1. Bối cảnh LTS](#1-bối-cảnh-lts)
  - [2. Final — ngôn ngữ \& API lập trình](#2-final--ngôn-ngữ--api-lập-trình)
    - [2.1 JEP 513 — Flexible Constructor Bodies](#21-jep-513--flexible-constructor-bodies)
    - [2.2 JEP 506 — Scoped Values](#22-jep-506--scoped-values)
    - [2.3 JEP 511 — Module Import Declarations](#23-jep-511--module-import-declarations)
    - [2.4 JEP 512 — Compact Source Files \& Instance Main Methods](#24-jep-512--compact-source-files--instance-main-methods)
    - [2.5 JEP 510 — Key Derivation Function API](#25-jep-510--key-derivation-function-api)
  - [3. Final — runtime / GC / AOT (tóm tắt)](#3-final--runtime--gc--aot-tóm-tắt)
    - [3.1 JEP 519 — Compact Object Headers](#31-jep-519--compact-object-headers)
    - [3.2 JEP 521 — Generational Shenandoah](#32-jep-521--generational-shenandoah)
    - [3.3 JEP 514 / 515 — AOT ergonomics](#33-jep-514--515--aot-ergonomics)
  - [4. Preview / Incubator — đánh dấu rõ](#4-preview--incubator--đánh-dấu-rõ)
    - [4.1 JEP 505 — Structured Concurrency *(Fifth Preview)*](#41-jep-505--structured-concurrency-fifth-preview)
    - [4.2 JEP 507 — Primitive Types in Patterns *(Preview)*](#42-jep-507--primitive-types-in-patterns-preview)
    - [4.3 JEP 502 — Stable Values *(Preview)*](#43-jep-502--stable-values-preview)
    - [4.4 JEP 508 — Vector API *(Incubator)*](#44-jep-508--vector-api-incubator)
    - [4.5 JEP 470 — PEM Encodings *(Preview)*](#45-jep-470--pem-encodings-preview)
  - [5. Removed](#5-removed)
  - [6. Nhắc lại nền tảng đã final trước 25](#6-nhắc-lại-nền-tảng-đã-final-trước-25)
  - [7. Bật preview \& tài nguyên](#7-bật-preview--tài-nguyên)
  - [8. Checklist nâng cấp thực dụng](#8-checklist-nâng-cấp-thực-dụng)

---

## 1. Bối cảnh LTS

| Mốc | Ý nghĩa |
|-----|---------|
| Java 21 LTS | Virtual threads final, pattern matching / sequenced collections… |
| Java 22–24 | Preview Flexible Constructors, Scoped Values, Gatherers (24 final)… |
| **Java 25 LTS** | Chốt Scoped Values, Flexible Constructors, compact source/main, module import… |

Chu kỳ LTS ~ 2 năm; 25 là điểm nâng cấp “an toàn dài hạn” sau 21 cho nhiều tổ chức.

---

## 2. Final — ngôn ngữ & API lập trình

### 2.1 JEP 513 — Flexible Constructor Bodies

Cho phép **statements trước** `super(...)` / `this(...)` trong constructor (prologue), với ràng buộc *early construction context*: không dùng instance chưa khởi tạo (trừ gán field cùng class không có initializer).

```java
public class PositivePoint extends Point {
    public PositivePoint(int x, int y) {
        if (x < 0 || y < 0) throw new IllegalArgumentException();
        super(x, y);
    }
}
```

Chi tiết thực dụng: [oop.md](oop.md) §1.6.  
JEP: [https://openjdk.org/jeps/513](https://openjdk.org/jeps/513)

### 2.2 JEP 506 — Scoped Values

API **final** để chia sẻ dữ liệu bất biến theo scope cho callee và child threads — thay thế hiện đại cho nhiều trường hợp `ThreadLocal`, tối ưu với virtual threads.

```java
private static final ScopedValue<User> USER = ScopedValue.newInstance();

ScopedValue.where(USER, currentUser).run(() -> service.handle());
```

Chi tiết: [threading.md](threading.md) §5.  
JEP: [https://openjdk.org/jeps/506](https://openjdk.org/jeps/506)

### 2.3 JEP 511 — Module Import Declarations

Import **toàn bộ package exported** của một module bằng một câu lệnh — giảm boilerplate khi dùng nhiều API từ cùng module (đặc biệt hữu ích với compact programs / explorers).

```java
import module java.base;
import module java.sql;

// Có thể dùng các public type được export từ module đó theo quy tắc JEP
```

- Không thay `import` kiểu thông thường; bổ sung khi làm việc ở mức module.
- Cần hiểu dualism classpath vs module path.

JEP: [https://openjdk.org/jeps/511](https://openjdk.org/jeps/511)

### 2.4 JEP 512 — Compact Source Files & Instance Main Methods

Đơn giản hóa chương trình nhỏ / học liệu:

- **Compact source file**:省略 bắt buộc class bọc tường minh trong một số dạng chương trình ngắn.
- **Instance main**: `void main()` instance (không nhất thiết `public static void main(String[])`) trong ngữ cảnh được hỗ trợ.

```java
// Minh họa tinh thần JEP 512 — chương trình khởi động gọn
void main() {
    IO.println("Hello, Java 25");
}
```

Mục tiêu: onboarding, script-like, không thay mô hình production lớn (`module-info`, packages đầy đủ vẫn là chuẩn doanh nghiệp).

JEP: [https://openjdk.org/jeps/512](https://openjdk.org/jeps/512)

### 2.5 JEP 510 — Key Derivation Function API

API chuẩn trong bảo mật Java cho **KDF** (derive key từ password / key material) — thay thế / thống nhất các ad-hoc trước đây.

- Liên quan `javax.crypto` / cryptographic providers.
- Dùng khi implement password-based encryption, protocol keys — **không** tự invent KDF.

Tóm tắt: biết là có API chính thức; chi tiết thuật toán xem javadoc `javax.crypto.KDF` (tên/type theo JDK 25).

JEP: [https://openjdk.org/jeps/510](https://openjdk.org/jeps/510)

---

## 3. Final — runtime / GC / AOT (tóm tắt)

### 3.1 JEP 519 — Compact Object Headers

Giảm kích thước object header trên HotSpot (project Lilliput) → tiết kiệm heap, cải thiện locality với workload nhiều object nhỏ.

- Thường bật / cấu hình theo cờ JVM của bản phát hành (xem release notes JDK 25).
- Quan trọng với app memory-sensitive; đo trước/sau bằng heap histogram / GC logs.

JEP: [https://openjdk.org/jeps/519](https://openjdk.org/jeps/519)

### 3.2 JEP 521 — Generational Shenandoah

Shenandoah GC nhận **generational mode** ổn định hơn / productized theo JEP — giảm pause với heap lớn, throughput cải thiện nhờ thu thập young gen tách biệt.

- Lựa chọn GC vẫn theo workload: G1 (mặc định nhiều trường hợp), ZGC, Shenandoah…
- Bật qua `-XX:+UseShenandoahGC` và cờ generational tương ứng (đọc release note chính xác).

JEP: [https://openjdk.org/jeps/521](https://openjdk.org/jeps/521)

### 3.3 JEP 514 / 515 — AOT ergonomics

Cải thiện trải nghiệm **Ahead-of-Time** caching / training (Project Leyden hướng):

| JEP | Hướng |
|-----|--------|
| **514** | AOT command-line ergonomics — đơn giản hóa quy trình tạo/dùng AOT cache |
| **515** | AOT liên quan cache / startup refinements (xem tiêu đề đầy đủ trên openjdk) |

Mục tiêu thực dụng: **startup nhanh hơn**, warm-up ngắn hơn cho service cloud — đo bằng time-to-first-response.

- 514: [https://openjdk.org/jeps/514](https://openjdk.org/jeps/514)
- 515: [https://openjdk.org/jeps/515](https://openjdk.org/jeps/515)

---

## 4. Preview / Incubator — đánh dấu rõ

Các tính năng dưới đây **không phải** Java SE final trong 25. Cần `--enable-preview` (preview) hoặc module incubator; có thể đổi / đổi tên ở bản sau.

### 4.1 JEP 505 — Structured Concurrency *(Fifth Preview)*

`StructuredTaskScope` — fan-out/fan-in có cấu trúc, hủy đồng bộ, hợp virtual threads.

```java
try (var scope = StructuredTaskScope.open()) {
    var a = scope.fork(this::loadA);
    var b = scope.fork(this::loadB);
    scope.join();
    use(a.get(), b.get());
}
```

Chi tiết: [async.md](async.md) §5.  
JEP: [https://openjdk.org/jeps/505](https://openjdk.org/jeps/505)

### 4.2 JEP 507 — Primitive Types in Patterns *(Preview)*

Mở rộng pattern matching / `instanceof` / `switch` cho **primitive types** (ví dụ khớp `int`, `double` với độ chính xác / safe conversion theo quy tắc JEP).

```java
// Minh họa tinh thần — cú pháp chính xác theo preview JDK 25
Object o = 42;
if (o instanceof int i) {
    System.out.println(i * 2);
}

double value = switch (o) {
    case int i when i > 0 -> i;
    case double d -> d;
    default -> 0d;
};
```

JEP: [https://openjdk.org/jeps/507](https://openjdk.org/jeps/507)

### 4.3 JEP 502 — Stable Values *(Preview)*

Holder cho dữ liệu bất biến khởi tạo **linh hoạt hơn `final`** nhưng JVM vẫn có thể tối ưu như hằng (constant-folding / folding barriers theo thiết kế JEP).

- Khác Scoped Values (context per-call-chain): Stable Values nghiêng về **lazy immutable fields** / computed constants.
- Preview — API có thể chỉnh.

JEP: [https://openjdk.org/jeps/502](https://openjdk.org/jeps/502)

### 4.4 JEP 508 — Vector API *(Incubator)*

API vector hóa số học (SIMD) trên HotSpot — incubator lâu đời (nhiều vòng).

- Dùng cho kernel số học / ML nhẹ / compression khi cần hiệu năng tối đa.
- Không portable guarantee như Java thuần; phụ thuộc CPU backend.

JEP: [https://openjdk.org/jeps/508](https://openjdk.org/jeps/508)

### 4.5 JEP 470 — PEM Encodings *(Preview)*

Hỗ trợ đọc/ghi đối tượng mật mã dạng **PEM** (Privacy-Enhanced Mail text encoding) trên API Java chuẩn.

- Hữu ích khi làm việc certificate / keys tương thích toolchain OpenSSL.
- Preview — xác nhận package/class trên javadoc 25 trước khi khóa code.

JEP: [https://openjdk.org/jeps/470](https://openjdk.org/jeps/470)

---

## 5. Removed

### JEP 503 — Remove 32-bit x86 Port

Cổng **32-bit x86** bị loại — JDK 25 tập trung kiến trúc hiện đại (64-bit x64, AArch64…).

- CI / máy cũ 32-bit: kế hoạch migrate.
- Container images: xác nhận `amd64` / `arm64`.

JEP: [https://openjdk.org/jeps/503](https://openjdk.org/jeps/503)

---

## 6. Nhắc lại nền tảng đã final trước 25

Không phải “mới 25”, nhưng là baseline khi nói Java hiện đại trên LTS này:

| Chủ đề | Từ | Ghi chú |
|--------|-----|---------|
| Virtual threads | 21 | Lõi concurrency — [threading.md](threading.md) |
| Pattern matching for switch / record patterns | 21 | Sealed + switch |
| Sequenced collections | 21 | [collections-generics.md](collections-generics.md) |
| Stream Gatherers | **24** | [streams.md](streams.md) §9 |
| `List.getFirst` / `getLast`… | 21 | Sequenced |

---

## 7. Bật preview & tài nguyên

```text
javac --enable-preview --release 25 Main.java
java  --enable-preview Main
```

`jshell --enable-preview`

Maven (phác thảo):

```xml
<plugin>
  <artifactId>maven-compiler-plugin</artifactId>
  <configuration>
    <release>25</release>
    <enablePreview>true</enablePreview>
  </configuration>
</plugin>
```

Tài nguyên:

- Dự án JDK 25: [https://openjdk.org/projects/jdk/25/](https://openjdk.org/projects/jdk/25/)
- JEPs từng mục: liên kết ở trên
- Oracle migration: *Significant Changes in JDK 25*

---

## 8. Checklist nâng cấp thực dụng

1. Build/tooling: Maven/Gradle/JDK toolchain **25**; bỏ giả định x86 32-bit.
2. Thử **Flexible Constructors** nơi đang validate trước `super` bằng hack.
3. Migrate `ThreadLocal` context (request id, principal) → **ScopedValue** khi bất biến theo request.
4. Đánh giá startup: AOT flags (514/515) trên service cold-start.
5. GC: chỉ đổi Shenandoah generational sau benchmark — đừng đổi production mù.
6. Structured Concurrency / primitive patterns / Stable Values: **feature-flag** hoặc module riêng vì vẫn preview.
7. Đo heap với Compact Object Headers khi bật trên môi trường hỗ trợ.
8. Cập nhật tài liệu nội bộ: virtual threads là mặc định tư duy I/O; CF/reactive khi thật sự cần.

---

| Nhóm | JEP |
|------|-----|
| **Final ngôn ngữ/API** | 506, 510, 511, 512, 513 |
| **Final runtime** | 514, 515, 519, 521 |
| **Preview/Incubator** | 470, 502, 505, 507, 508 |
| **Removed** | 503 |

*Tài liệu nhanh Java 25 LTS — bổ sung [oop.md](oop.md), [threading.md](threading.md), [async.md](async.md).*
