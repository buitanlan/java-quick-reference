# Hệ thống kiểu dữ liệu

Java là ngôn ngữ **statically typed** / **strongly typed**: mọi biến, tham số, và biểu thức có kiểu xác định tại
biên dịch (trừ các lỗ hổng cố ý như raw types / unchecked cast). Hệ thống kiểu gồm **primitive types**,
**reference types**, và lớp đặc biệt quanh `Object`, mảng, generics (erasure), cùng suy luận cục bộ `var`.

Baseline thực hành hiện đại (Java 25 LTS): records, sealed types, pattern matching cho `instanceof`/`switch`,
virtual threads — dùng như mặc định khi nói “code hiện tại”. Value types (Project Valhalla) chỉ nhắc như hướng tương lai.

---

## Mục lục

- [Hệ thống kiểu dữ liệu](#hệ-thống-kiểu-dữ-liệu)
  - [Mục lục](#mục-lục)
  - [1. Tổng quan hệ thống kiểu \& JVM](#1-tổng-quan-hệ-thống-kiểu--jvm)
  - [2. Bộ nhớ: Stack / Heap \& GC](#2-bộ-nhớ-stack--heap--gc)
    - [2.1 Generational Shenandoah (JEP 521) \& Compact Object Headers (JEP 519)](#21-generational-shenandoah-jep-521--compact-object-headers-jep-519)
  - [3. Primitive vs reference](#3-primitive-vs-reference)
  - [4. Boxing / unboxing \& wrapper types](#4-boxing--unboxing--wrapper-types)
  - [5. Mảng (`T[]`)](#5-mảng-t)
  - [6. `String`, `Object` hierarchy](#6-string-object-hierarchy)
  - [7. `null`, `void` / `Void`, `var`](#7-null-void--void-var)
  - [8. Generics \& type erasure (overview)](#8-generics--type-erasure-overview)
  - [9. Records, sealed, enums (trong bức tranh kiểu)](#9-records-sealed-enums-trong-bức-tranh-kiểu)
  - [10. Kiểm tra kiểu: `instanceof` pattern matching](#10-kiểm-tra-kiểu-instanceof-pattern-matching)
  - [11. Ép kiểu \& chuyển đổi số](#11-ép-kiểu--chuyển-đổi-số)
  - [12. Value types — ngữ cảnh tương lai](#12-value-types--ngữ-cảnh-tương-lai)
  - [13. Sơ đồ type tree (ASCII)](#13-sơ-đồ-type-tree-ascii)

---

## 1. Tổng quan hệ thống kiểu & JVM

Khi nói về một kiểu, runtime/compiler biết:

- Kích thước / representation (primitive cố định; object có header + fields).
- Tập giá trị hợp lệ và operations.
- Quan hệ kế thừa / implements (reference types).
- Constraints generics (compile-time).

Luồng thực thi:

> **Source `.java`** → **javac** → **bytecode `.class`** → **JVM** (class loading, verification, JIT/GC).

- Verification đảm bảo bytecode type-safe trước khi chạy.
- Reflection (`Class`, `MethodHandles`) đọc metadata kiểu lúc runtime.
- Không có `dynamic` kiểu C#; “dynamic” gần nhất là reflection / `MethodHandle` / interpreter riêng.

---

## 2. Bộ nhớ: Stack / Heap & GC

- **Stack** (per thread): frame method — local primitives, references tới object trên heap. Không lưu object “thật”
  (trừ tối ưu escape analysis / scalar replacement bên dưới).
- **Heap**: instance objects, arrays, class metadata liên quan (tùy JVM). GC thu hồi object không còn reachability.
- **Metaspace** (HotSpot): class metadata — tách khỏi Java heap cổ điển.
- Local variable chứa **reference** (con trỏ managed), không phải địa chỉ tùy ý như C.

```java
void demo() {
    int x = 42;            // primitive trên stack frame
    String s = "hi";       // reference trên stack → String trên heap (pool/heap)
    int[] a = {1, 2, 3};   // reference → mảng trên heap
}
```

GC HotSpot phổ biến: **G1** (mặc định nhiều bản), ZGC, Shenandoah, Parallel — chọn bằng `-XX:+UseG1GC`, v.v.

### 2.1 Generational Shenandoah (JEP 521) & Compact Object Headers (JEP 519)

Java 25 gắn với các cải tiến runtime đáng chú ý (không đổi cú pháp ngôn ngữ):

- **JEP 521 — Generational Shenandoah**: Shenandoah theo thế hệ (young/old) nhằm giảm pause và chi phí trên workload
  cấp phát ngắn sống — bật/cấu hình theo flag JVM của bản phát hành.
- **JEP 519 — Compact Object Headers**: thu gọn object header trên HotSpot → giảm footprint heap, tăng mật độ cache;
  ảnh hưởng hiệu năng thực tế hơn là API ngôn ngữ.

Thực hành: chọn GC theo latency/throughput; đo bằng `-Xlog:gc*` / JFR — không đoán mù.

---

## 3. Primitive vs reference

### Primitive (8 kiểu)

| Kiểu | Bits | Khoảng / ghi chú |
|---|---|---|
| `byte` | 8 | −128..127 |
| `short` | 16 | −32768..32767 |
| `int` | 32 | ± mặc định số nguyên |
| `long` | 64 | suffix `L` |
| `float` | 32 | IEEE 754, suffix `f` |
| `double` | 64 | mặc định số thực |
| `char` | 16 | UTF-16 code unit |
| `boolean` | JVM-specific | `true`/`false` |

```java
int i = 10;
long n = 10L;
double d = 2.5;
boolean ok = true;
char c = 'A';
```

### Reference types

- Class, interface, record, enum, array, type variable.
- Giá trị: reference tới object hoặc `null`.
- Gán chép reference, không chép sâu object.

```java
StringBuilder a = new StringBuilder("x");
StringBuilder b = a; // cùng object
b.append('y');
// a cũng thấy "xy"
```

---

## 4. Boxing / unboxing & wrapper types

Mỗi primitive có wrapper class trong `java.lang`:

`Byte Short Integer Long Float Double Character Boolean`

```java
Integer boxed = 42;      // autoboxing
int raw = boxed;         // unboxing
int n = Integer.parseInt("42");
Integer m = Integer.valueOf(42); // ưu tiên hơn constructor (deprecated)
```

- Autoboxing tiện nhưng **cấp phát / cache** (`Integer` cache −128..127 mặc định) — tránh trong hot loop nếu profile nóng.
- Unboxing `null` → `NullPointerException`.
- So sánh: dùng `equals` cho wrapper; `==` có thể trùng nhờ cache nhưng **không** đáng tin ngoài vùng cache.
- Generic chỉ làm việc với reference: `List<Integer>` không phải `List<int>` (cho tới khi Valhalla value types — tương lai).

```java
List<Integer> list = new ArrayList<>();
list.add(1);          // box
int x = list.get(0);  // unbox
```

---

## 5. Mảng (`T[]`)

- Mảng là **reference type**; subtype covariant: `String[]` là `Object[]` (nhưng store check runtime).

```java
String[] s = {"a", "b"};
Object[] o = s;
// o[0] = 1; // ArrayStoreException lúc chạy
```

```java
int[] a = new int[3];
int[] b = {1, 2, 3};
int[][] matrix = new int[2][3];
int[][] jagged = { {1}, {2, 3} };
```

- `length` là field final; `Cloneable`, `Serializable`.
- Tiện ích: `Arrays`, `System.arraycopy`, `Objects`, `java.util.stream.Arrays.stream`.
- Không có `Span<T>` ngôn ngữ như C#; dùng `ByteBuffer`, array + offset/length, hoặc FFM `MemorySegment` khi gần native.

---

## 6. `String`, `Object` hierarchy

```text
java.lang.Object
 ├── java.lang.String          (final)
 ├── java.lang.Number          → wrappers số
 ├── java.lang.Throwable
 ├── arrays (synthetic)
 ├── enums (extends Enum<E>)
 ├── records (extends Record)
 └── user classes...
```

**`Object`** — gốc reference: `equals`, `hashCode`, `toString`, `getClass`, `wait`/`notify` (hiếm khi dùng trực tiếp
khi có `java.util.concurrent`), `clone` (protected, dễ sai — ưu tiên copy constructor / record).

**`String`**:

- Immutable; literal vào pool; `+` biên dịch thành `StringBuilder`/`StringConcatFactory`.
- So sánh nội dung: `equals` / `contentEquals`; không dùng `==` trừ khi cố ý intern.
- Text blocks (Java 15+): `""" ... """` — xem `literals.md`.
- Java hiện đại: `STR` template processor đã có lịch sử preview; kiểm tra trạng thái cuối trên JDK 25 docs khi dùng
  string templates — ưu tiên `formatted`, `MessageFormat`, hoặc text block + `replace` nếu cần portable.

```java
String s = "Java " + 25;
String t = """
        line1
        line2
        """;
```

---

## 7. `null`, `void` / `Void`, `var`

**`null`**: literal duy nhất gán được cho mọi reference type; không gán primitive.

```java
String s = null;
if (s == null) { /* ... */ }
Optional<String> opt = Optional.ofNullable(s);
```

- Không có NRT compiler built-in như C# nullable reference types; dùng **Optional**, checker frameworks
  (`@Nullable`/`@NonNull` — JSpecify, Checker Framework), hoặc discipline + Objects.requireNonNull.

**`void`**: kiểu trả về method “không giá trị”. **`Void`**: reference type placeholder (thường `null`), dùng generic
`Callable<Void>`.

**`var`** (Java 10+): suy luận kiểu **local** từ initializer — vẫn static typing.

```java
var list = new ArrayList<String>(); // ArrayList<String>
var stream = list.stream();
// var x;           // lỗi — thiếu initializer
// var n = null;    // lỗi — không suy được
```

- Được dùng cho local variables, index loop, try-with-resources; **không** cho field, method param/return
  (trừ lambda param trong một số ngữ cảnh suy luận riêng).
- Nên `var` khi kiểu bên phải rõ (`var user = userRepo.find(id)`); tránh khi che mất nghĩa (`var x = f()`).

---

## 8. Generics & type erasure (overview)

```java
List<String> names = new ArrayList<>();
Map<String, List<Integer>> index = new HashMap<>();
```

- Type parameters tồn tại chủ yếu ở **compile-time**; JVM xóa (erasure) về raw/`Object`/bound.
- Không tạo `new T()`, không `instanceof List<String>` (chỉ `List`), không mảng `new T[]` an toàn hoàn toàn.
- Bounded: `T extends Number & Comparable<T>`; variance qua wildcard: `? extends` / `? super` (PECS).
- Chi tiết collections, wildcards, specialization → xem `collections-generics.md` (khi có trong bộ tài liệu).

```java
static double sum(List<? extends Number> nums) {
    return nums.stream().mapToDouble(Number::doubleValue).sum();
}
```

---

## 9. Records, sealed, enums (trong bức tranh kiểu)

**Record** — carrier dữ liệu bất biến, `equals`/`hashCode`/`toString` sinh sẵn:

```java
public record Point(int x, int y) {}
var p = new Point(1, 2);
```

**Sealed** — hạn chế hệ phân cấp (kết hợp pattern switch):

```java
public sealed interface Shape permits Circle, Rect {}
public record Circle(double r) implements Shape {}
public record Rect(double w, double h) implements Shape {}
```

**Enum** — tập hằng singleton:

```java
public enum Level { DEBUG, INFO, WARN, ERROR }
```

Đây là baseline “kiểu dữ liệu miền” hiện đại thay cho JavaBean dài dòng khi không cần mutable state.

---

## 10. Kiểm tra kiểu: `instanceof` pattern matching

```java
Object o = "Java 25";

// Cũ
if (o instanceof String) {
    String s = (String) o;
    System.out.println(s.length());
}

// Pattern matching (chuẩn hiện đại)
if (o instanceof String s) {
    System.out.println(s.length()); // s đã bind, scope theo luồng điều kiện
}

if (!(o instanceof String s)) {
    return;
}
System.out.println(s.toUpperCase());
```

Kết hợp guarded / switch pattern (xem thêm `operators.md` / statements):

```java
double area(Shape shape) {
    return switch (shape) {
        case Circle c -> Math.PI * c.r() * c.r();
        case Rect r -> r.w() * r.h();
    };
}
```

- Pattern matching thay cast thủ công → ít `ClassCastException` do sai nhánh.
- `instanceof` với primitive patterns / các mở rộng khác: theo dõi JEPs phiên bản; Java 25 lấy pattern matching
  cho typed patterns trên reference như thực hành chính.

---

## 11. Ép kiểu & chuyển đổi số

```java
int i = 100;
long L = i;           // widening primitive — implicit
int j = (int) L;      // narrowing — explicit, có thể cắt

Object o = "x";
String s = (String) o; // reference cast — ClassCastException nếu sai

Number n = 3.14;
double d = n.doubleValue();
```

- Widening an toàn (theo bảng chuyển đổi JLS); narrowing có thể mất dữ liệu/`char` unsigned-ish semantics.
- Reference cast lên/xuống hệ phân cấp; interface cast hợp lệ nếu runtime type implements.
- `String` ↔ số: `Integer.parseInt`, `Double.parseDouble`, `String.valueOf` — không cast trực tiếp.

---

## 12. Value types — ngữ cảnh tương lai

Project **Valhalla** hướng tới value/identity-free types để mang lại “primitive-like” cho user types và specialized
generics (`List<int>`). **Java 25 LTS** vẫn lấy mô hình hiện tại: 8 primitives + references + boxing.

Khi đọc tài liệu cũ/mới: đừng viết production API phụ thuộc preview Valhalla trừ khi team chủ động opt-in preview
và chấp nhận breaking changes.

---

## 13. Sơ đồ type tree (ASCII)

```text
                    ┌──────────── primitives ────────────┐
                    │ byte short int long float double   │
                    │ char boolean                       │
                    └────────────────────────────────────┘
                                      │ (boxing)
                                      ▼
                         java.lang.Object (references)
                         /      |       |        \
                   String   Number    arrays    Throwable
                               |                  / \
                          Integer...           Error Exception
                         Class mirrors
                         Record / Enum<T>
                         user classes / interfaces / sealed hierarchies
```

Checklist thực hành Java 25:

- Ưu tiên primitive trong hot path; wrapper khi cần collections/generics/null.
- Dùng `record` + `sealed` + pattern `instanceof`/`switch` cho mô hình dữ liệu.
- `var` cho local rõ nghĩa; tránh raw types.
- Đo GC/footprint (Shenandoah generational, compact headers) khi tối ưu dịch vụ lớn — tách khỏi thiết kế API kiểu.
