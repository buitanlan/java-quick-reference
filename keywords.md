# Từ khóa (Keywords) trong Java

Tài liệu tham khảo các **từ khóa dành riêng (reserved keywords)** và **từ khóa ngữ cảnh (contextual keywords)** trong **Java 25 LTS**. Mỗi mục gồm mục đích, ví dụ ngắn và ghi chú thực dụng.

> **Phạm vi:** nhắm **Java 25 LTS** (GA 9/2025). Tính năng nền tảng trước đó (records, sealed, pattern switch, `_`, …) được ghi rõ phiên bản ổn định. Preview cần `--enable-preview` — xem [java25.md](java25.md).

> **Lưu ý:** `true`, `false`, `null` là **literal**, không phải keyword theo nghĩa reserved identifier — chúng không dùng làm tên biến/method/class, nhưng về mặt ngữ pháp thuộc nhóm literal chứ không phải keyword.

**Đọc kèm:** [statements.md](statements.md) · [oop.md](oop.md) · [threading.md](threading.md) · [exceptions.md](exceptions.md) · [packages-modules.md](packages-modules.md) · [typesystem.md](typesystem.md) · [operators.md](operators.md) · [java25.md](java25.md)

---

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Reserved keywords](#2-reserved-keywords)
3. [Contextual keywords](#3-contextual-keywords)
4. [Unnamed variable / pattern `_`](#4-unnamed-variable--pattern-_)
5. [Bảng nhanh](#5-bảng-nhanh)
6. [Identifiers “trông đặc biệt”](#6-identifiers-trông-đặc-biệt)
7. [Ngữ nghĩa keyword / tính năng theo phiên bản](#7-ngữ-nghĩa-keyword--tính-năng-theo-phiên-bản)

---

## 1. Tổng quan

| Nhóm | Đặc điểm |
|------|----------|
| **Reserved keywords** | Luôn dành riêng; không dùng làm identifier ở mọi ngữ cảnh. |
| **Contextual keywords** | Chỉ “đặc biệt” ở ngữ cảnh nhất định (`var`, `record`, `sealed`, `yield`, `when`…). Ở ngữ cảnh khác có thể là tên hợp lệ (tuỳ phiên bản / vị trí). |
| **Reserved nhưng không dùng** | `const`, `goto` — dành riêng để tránh xung đột với C/C++, không có nghĩa trong Java. |
| **Literals** | `true`, `false`, `null` — không phải keyword; xem mục đầu. |

Java 25 LTS kế thừa nhiều tính năng hiện đại: **records**, **sealed classes**, **pattern matching**, **switch expressions**, **virtual threads** (API/`Thread`), **flexible constructor bodies** (JEP 513), và preview như **primitive types in patterns** (JEP 507 — cần `--enable-preview`).

**Nhóm → file chuyên sâu:**

| Nhóm keyword | File |
|--------------|------|
| `if` / `switch` / `for` / `while` / `break` / `yield` / `assert` / `synchronized` (statement) | [statements.md](statements.md) |
| `class` / `interface` / `enum` / `extends` / `implements` / `this` / `super` / `sealed` / `record` | [oop.md](oop.md) |
| `synchronized` / `volatile` (JMM, locks) | [threading.md](threading.md) |
| `try` / `catch` / `finally` / `throw` / `throws` | [exceptions.md](exceptions.md) |
| `package` / `import` / module keywords | [packages-modules.md](packages-modules.md) |
| `instanceof` / primitives / generics bounds | [typesystem.md](typesystem.md) · [operators.md](operators.md) |

---

## 2. Reserved keywords

### 2.1 `abstract`

- **Loại:** reserved · **Từ:** Java 1.0  
- **Mục đích:** Class/method trừu tượng — class không `new` được; method abstract phải được override ở lớp cụ thể.

```java
public abstract class Shape {
    public abstract double area();

    public void print() {
        System.out.println("area = " + area());
    }
}

public final class Circle extends Shape {
    private final double radius;
    public Circle(double radius) { this.radius = radius; }
    @Override public double area() { return Math.PI * radius * radius; }
}
```

**Ghi chú:** Interface method không ghi `body` cũng là abstract (implicit). Class có method abstract ⇒ class phải `abstract`. Chi tiết OOP: [oop.md](oop.md).

---

### 2.2 `assert`

- **Loại:** reserved · **Từ:** Java 1.4  
- **Mục đích:** Kiểm tra invariant lúc runtime khi `-ea` / `-enableassertions` (enable assertions).

```java
assert n > 0 : "n must be positive";
// tương đương khi bật: if (!(n > 0)) throw new AssertionError("n must be positive");
```

**Ghi chú:**

- **Tắt mặc định** trên hầu hết JVM production — đừng dựa vào `assert` để bảo vệ API công khai hay đường đi “phải luôn chạy”.
- Hai dạng: `assert expr;` và `assert expr : detail;` (`detail` thành message/`Object` của `AssertionError`).
- **Không** dùng thay validation đầu vào (`IllegalArgumentException`, `Objects.requireNonNull`, Bean Validation…). Assertion là cho **invariant nội bộ** / giả định lập trình viên.
- Có thể bật/tắt theo package/class (`-ea:com.example...`, `-da:...`). Class loader / agent đặc biệt có thể ảnh hưởng.
- Side-effect trong biểu thức `assert` là anti-pattern: khi tắt assertion, side-effect **không chạy**.
- Khác `Objects.requireNonNull` / check thường: những cái đó **luôn** thực thi. Xem thêm jump statements: [statements.md](statements.md).

---

### 2.3 `boolean`

- **Loại:** reserved · **Từ:** Java 1.0  
- **Mục đích:** Kiểu nguyên thủy đúng/sai. Không ép kiểu từ `int` như C.

```java
boolean ready = true;
if (ready) {
    System.out.println("go");
}
```

---

### 2.4 `break`

- **Loại:** reserved  
- **Mục đích:** Thoát vòng lặp hoặc `switch` (statement). Với nhãn: `break LABEL;`.

```java
for (int i = 0; i < 100; i++) {
    if (i == 10) break;
}
```

**Ghi chú:** Trong **switch expression**, không dùng `break` để “trả giá trị” — dùng `yield` hoặc nhánh expression. Chi tiết: [statements.md](statements.md).

---

### 2.5 `byte`

- **Loại:** reserved  
- **Mục đích:** Số nguyên có dấu 8-bit (−128…127).

```java
byte b = 127;
int wider = b; // widening
```

---

### 2.6 `case`

- **Loại:** reserved  
- **Mục đích:** Nhánh trong `switch`. Hỗ trợ constant, patterns, `when` guards, nhiều nhãn (`case 1, 2, 3`).

```java
String label = switch (code) {
    case 200 -> "OK";
    case 404, 410 -> "Missing";
    case Integer i when i >= 500 -> "Server";
    default -> "Other";
};
```

**Ghi chú:**

- **Switch statement** cổ điển: `case` + `:` + fall-through (cần `break` / `return` / `throw` nếu không muốn rơi). **Arrow** `case … ->` không fall-through.
- **Switch expression** (ổn định Java 14+): mọi nhánh phải cho giá trị (hoặc `throw`); dùng `yield` trong block. Exhaustiveness bắt buộc hơn khi dùng pattern/`enum`/sealed.
- Từ Java 21: `case` nhận **type pattern**, **record pattern**, **guard `when`**. Thứ tự nhánh quan trọng — nhánh cụ thể trước nhánh tổng quát.
- Nhiều hằng trên một `case` (`case 1, 2, 3`) ổn định từ switch hiện đại; đừng nhầm với fall-through cổ điển `case 1: case 2:`.
- Xem [statements.md](statements.md); pattern/`instanceof`: [typesystem.md](typesystem.md) · [operators.md](operators.md).

---

### 2.7 `catch`

- **Loại:** reserved  
- **Mục đích:** Bắt exception sau `try`. Hỗ trợ multi-catch `A | B`.

```java
try {
    Files.readString(path);
} catch (IOException | SecurityException e) {
    System.err.println(e.getMessage());
}
```

**Ghi chú:** Multi-catch: các kiểu phải **không** kế thừa lẫn nhau; biến `e` là `final` hiệu dụng. Chi tiết: [exceptions.md](exceptions.md).

---

### 2.8 `char`

- **Loại:** reserved  
- **Mục đích:** Ký tự UTF-16 (16-bit). Dùng `Character` / code points cho Unicode đầy đủ.

```java
char c = 'A';
char nl = '\n';
```

---

### 2.9 `class`

- **Loại:** reserved  
- **Mục đích:** Khai báo class (tham chiếu, có thể abstract/final/sealed…).

```java
public class User {
    private final String name;
    public User(String name) { this.name = name; }
}
```

**Ghi chú:** Nested / local / anonymous class có quy tắc riêng (`this`/`super`, capturing). Xem [oop.md](oop.md).

---

### 2.10 `const`

- **Loại:** reserved (không dùng)  
- **Mục đích:** Không có semantics trong Java. Hằng số dùng `static final`.

```java
public static final int MAX = 100;
```

---

### 2.11 `continue`

- **Loại:** reserved  
- **Mục đích:** Bỏ phần còn lại của vòng lặp hiện tại, sang lần kế (có thể kèm nhãn).

```java
for (String s : items) {
    if (s.isBlank()) continue;
    process(s);
}
```

---

### 2.12 `default`

- **Loại:** reserved  
- **Mục đích:** (1) Nhánh mặc định trong `switch`. (2) Default method trong `interface`. (3) Annotation element mặc định.

```java
public interface Logger {
    default void info(String msg) {
        log("INFO", msg);
    }
    void log(String level, String msg);
}
```

**Ghi chú:**

- Trong **switch expression** / pattern switch: `default` (hoặc tổng các nhánh) phải bao phủ mọi giá trị còn lại; với `sealed` + pattern thường có thể **bỏ** `default` nếu exhaustiveness đủ.
- **Default method** (`interface`): implementation trong interface — xung đột khi class implements nhiều interface cùng signature → phải override. Không nhầm với `default` của `switch`.
- Annotation: `String value() default "";` — giá trị compile-time.
- Switch/`default`: [statements.md](statements.md). Interface default: [oop.md](oop.md).

---

### 2.13 `do`

- **Loại:** reserved  
- **Mục đích:** Vòng `do { ... } while (cond);` — thân chạy ít nhất một lần.

```java
int n;
do {
    n = read();
} while (n < 0);
```

---

### 2.14 `double`

- **Loại:** reserved  
- **Mục đích:** Số thực 64-bit IEEE 754.

```java
double pi = 3.141592653589793;
```

---

### 2.15 `else`

- **Loại:** reserved  
- **Mục đích:** Nhánh còn lại của `if`.

```java
if (x > 0) {
    System.out.println("pos");
} else if (x < 0) {
    System.out.println("neg");
} else {
    System.out.println("zero");
}
```

---

### 2.16 `enum`

- **Loại:** reserved · **Từ:** Java 5  
- **Mục đích:** Kiểu liệt kê type-safe; có thể có field/method/constructor.

```java
public enum Status {
    NEW, RUNNING, DONE;
}
```

**Ghi chú:** Enum là class `final` đặc biệt; constant là singleton. Switch trên enum + exhaustiveness: [statements.md](statements.md) · [oop.md](oop.md).

---

### 2.17 `extends`

- **Loại:** reserved  
- **Mục đích:** Class kế thừa một class; interface kế thừa nhiều interface. Cũng dùng trong bound generic `T extends Number`.

```java
public class Dog extends Animal { }
public interface Closeable extends AutoCloseable { }
```

**Ghi chú:** Single class inheritance; multiple interface inheritance. Bounds/`super` trong generics: [typesystem.md](typesystem.md) · [oop.md](oop.md).

---

### 2.18 `final`

- **Loại:** reserved  
- **Mục đích:** Không kế thừa (class), không override (method), không gán lại (biến/field). Local `final` / effectively final quan trọng với lambda / inner class / try-with-resources.

```java
final int limit = 10;
public final class Utils { }
```

**Ghi chú:**

- **Class `final`:** không subclass (security/perf/intent). `enum` và **record** là `final` (record implicit).
- **Method `final`:** không override — hữu ích khi muốn “chốt” hành vi trong template method / tránh fragile base.
- **Field `final`:** blank final phải được **definitely assigned** đúng một lần (ctor / initializer / compact ctor của record). `static final` thường là hằng compile-time nếu kiểu primitive/`String` và khởi tạo bằng hằng.
- **Local / parameter `final`:** không gán lại; biến **effectively final** (không khai `final` nhưng không gán lại) mới được capture bởi lambda/anonymous class.
- `final` **không** làm object bất biến — chỉ reference không đổi; nội dung `List`/`array` vẫn mutate được trừ khi dùng unmodifiable / copy / record of immutables.
- Từ Java 25, **flexible constructor bodies** (JEP 513) cho phép statement trước `super(...)`/`this(...)` với hạn chế (không đọc instance state chưa init) — vẫn phải gán `final` fields đúng quy tắc. Xem [oop.md](oop.md) · [java25.md](java25.md).

---

### 2.19 `finally`

- **Loại:** reserved  
- **Mục đích:** Khối luôn chạy sau `try`/`catch` (trừ khi JVM thoát cứng — `halt`, một số crash native).

```java
try {
    work();
} finally {
    cleanup();
}
```

**Ghi chú:** Ưu tiên try-with-resources thay vì `finally` chỉ để đóng resource. `return`/`throw` trong `finally` che mất kết quả/`Throwable` từ `try` — tránh. Chi tiết: [exceptions.md](exceptions.md).

---

### 2.20 `float`

- **Loại:** reserved  
- **Mục đích:** Số thực 32-bit. Literal cần hậu tố `f`.

```java
float f = 1.5f;
```

---

### 2.21 `for`

- **Loại:** reserved  
- **Mục đích:** Vòng `for` cổ điển hoặc enhanced-for (`for (T x : iterable)`).

```java
for (int i = 0; i < n; i++) { }
for (String s : list) { }
```

**Ghi chú:** Enhanced-for trên array/`Iterable`. Unnamed `_` (22+) khi không cần phần tử. [statements.md](statements.md).

---

### 2.22 `goto`

- **Loại:** reserved (không dùng)  
- **Mục đích:** Không có trong Java. Dùng labeled `break`/`continue` khi cần nhảy có kiểm soát.

---

### 2.23 `if`

- **Loại:** reserved  
- **Mục đích:** Rẽ nhánh theo điều kiện `boolean`.

```java
if (user != null && user.isActive()) {
    greet(user);
}
```

---

### 2.24 `implements`

- **Loại:** reserved  
- **Mục đích:** Class triển khai một hoặc nhiều interface.

```java
public class ArrayList<E> implements List<E>, RandomAccess { }
```

---

### 2.25 `import`

- **Loại:** reserved  
- **Mục đích:** Import type / static member. Không import “package con” đệ quy.

```java
import java.util.List;
import static java.lang.Math.PI;
```

**Ghi chú:** Java 25 thêm **module import** (`import module …`, JEP 511) — xem [packages-modules.md](packages-modules.md) · [java25.md](java25.md).

---

### 2.26 `instanceof`

- **Loại:** reserved  
- **Mục đích:** Kiểm tra kiểu runtime; từ Java 16+ hỗ trợ **pattern matching** (gán biến + scope theo luồng điều khiển).

```java
if (obj instanceof String s) {
    System.out.println(s.toUpperCase());
}
if (!(obj instanceof String s)) {
    return;
}
// s trong scope ở đây (flow scoping)
```

**Ghi chú:**

- Dạng cổ điển `obj instanceof Type` trả `boolean`; `null instanceof T` luôn `false`.
- **Pattern** `obj instanceof Type binding` (ổn định Java 16, JEP 394): binding chỉ visible khi nhánh “match” (kể cả sau `!` nhờ flow analysis).
- Kết hợp `&&` / early-return để thu hẹp kiểu thay cast `(Type) obj`.
- Trong **switch** (21+): cùng họ pattern; có thể thêm `when`. Record patterns (21+) phá cấu trúc nested.
- **Không** thay `==` cho identity; không dùng để so sánh giá trị.
- Java 25 **preview** JEP 507 — pattern/`instanceof`/`switch` với **primitive types** (bật `--enable-preview`). Xem [typesystem.md](typesystem.md) · [operators.md](operators.md) · [statements.md](statements.md).

---

### 2.27 `int`

- **Loại:** reserved  
- **Mục đích:** Số nguyên 32-bit có dấu — kiểu số nguyên “mặc định” của Java.

```java
int count = 42;
```

---

### 2.28 `interface`

- **Loại:** reserved  
- **Mục đích:** Hợp đồng kiểu; có abstract/default/static/private methods; có thể sealed.

```java
public interface Repository<T> {
    T findById(long id);
    static <T> Repository<T> noop() { return id -> null; }
}
```

**Ghi chú:** Functional interface + lambda: xem file lambdas. Sealed interface: mục `sealed`. [oop.md](oop.md).

---

### 2.29 `long`

- **Loại:** reserved  
- **Mục đích:** Số nguyên 64-bit. Literal `L`.

```java
long id = 1_000_000_000_000L;
```

---

### 2.30 `native`

- **Loại:** reserved  
- **Mục đích:** Method triển khai bằng mã native (JNI). Khai báo không có body Java; liên kết thư viện `.so`/`.dll`/`.dylib`.

```java
public class NativeHasher {
    static {
        System.loadLibrary("hasher");
    }
    public native int hash(byte[] data);
}
```

**Ghi chú:**

- Method `native` **không** có body Java; implementation nằm ngoài JVM. Gọi sai chữ ký / chưa `loadLibrary` → `UnsatisfiedLinkError` / crash native khó debug.
- **JNI** cổ điển: boilerplate C/`jni.h`, rủi ro GC/pinning, không type-safe phía native. Ưu tiên **Foreign Function & Memory (FFM) API** (`java.lang.foreign`, ổn định Java 22+) khi gọi thư viện C hiện đại — overview [typesystem.md](typesystem.md) §2.3. Vẫn gặp `native` trong JDK/legacy.
- Một số method “native” trên JDK thực tế là **intrinsic** (JVM thay bằng code máy) — đừng copy mẫu `Object.hashCode` làm ví dụ JNI app.
- `native` **không** kết hợp với `abstract`; có thể `synchronized` nhưng monitor Java ≠ an toàn phía C — đồng bộ phải rõ ở cả hai phía.
- Hiếm trong business app; giữ boundary mỏng, test trên đúng OS/arch. Liên quan đồng thời/pinning: [threading.md](threading.md).

---

### 2.31 `new`

- **Loại:** reserved  
- **Mục đích:** Tạo instance, mảng, hoặc anonymous class.

```java
var list = new ArrayList<String>();
var anon = new Runnable() {
    @Override public void run() { }
};
```

---

### 2.32 `package`

- **Loại:** reserved  
- **Mục đích:** Khai báo package của compilation unit (dòng đầu, trước import).

```java
package com.example.app;
```

**Ghi chú:** Một file một `package` (hoặc default package — tránh). Module system: [packages-modules.md](packages-modules.md).

---

### 2.33 `private`

- **Loại:** reserved  
- **Mục đích:** Chỉ nhìn thấy trong top-level class khai báo (và nested cùng enclosing).

```java
private final String secret;
private void helper() { }
```

---

### 2.34 `protected`

- **Loại:** reserved  
- **Mục đích:** Package + subclass (subclass có thể khác package, với quy tắc truy cập instance).

```java
protected void onStart() { }
```

**Ghi chú:** Subclass khác package chỉ truy cập `protected` member qua kiểu subclass (không qua tham chiếu superclass tùy ý). [oop.md](oop.md).

---

### 2.35 `public`

- **Loại:** reserved  
- **Mục đích:** API công khai — mọi nơi đều truy cập được (nếu type cũng visible).

```java
public class Api { public void ping() { } }
```

---

### 2.36 `return`

- **Loại:** reserved  
- **Mục đích:** Trả giá trị / thoát method. `return;` cho `void`.

```java
public int abs(int x) {
    return x < 0 ? -x : x;
}
```

---

### 2.37 `short`

- **Loại:** reserved  
- **Mục đích:** Số nguyên 16-bit có dấu.

```java
short s = 32000;
```

---

### 2.38 `static`

- **Loại:** reserved  
- **Mục đích:** Thành viên thuộc type, không thuộc instance. Nested static class không giữ outer instance.

```java
public static int clamp(int v, int lo, int hi) {
    return Math.max(lo, Math.min(hi, v));
}
```

**Ghi chú:**

- **Field/method `static`:** một bản theo `Class`, không cần instance (trừ khi gọi qua instance — vẫn resolve static, dễ gây nhầm).
- **Static nested class** ≠ inner class: không có enclosing `this`. Inner class (non-static) giữ reference outer → rủi ro leak.
- **Static initializer** `static { … }` chạy khi class khởi tạo (thread-safe theo JLS); lỗi → `ExceptionInInitializerError`. Thứ tự: superclass static → subclass static; field static theo thứ tự textual.
- **Interface:** `static` method từ Java 8; `private static` helper từ Java 9.
- **Static import:** `import static …` — dùng vừa phải (xung đột tên, đọc code khó hơn).
- **Không** override static theo polymorphism — chỉ *hide*. Gọi qua kiểu compile-time.
- Context: [oop.md](oop.md) · [packages-modules.md](packages-modules.md).

---

### 2.39 `strictfp`

- **Loại:** reserved  
- **Mục đích:** Lịch sử — buộc biểu thức FP theo IEEE 754 chặt (tránh extended precision trên x87). Class hoặc method.

```java
public strictfp class LegacyMath {
    public strictfp double hypot(double a, double b) {
        return Math.sqrt(a * a + b * b);
    }
}
```

**Ghi chú:**

- Trước Java 17, FP trên một số platform có thể dùng thanh ghi dài hơn → kết quả `double`/`float` khác nhẹ giữa máy. `strictfp` bắt “strict” everywhere.
- **JEP 306 (Java 17):** luôn strict FP — modifier `strictfp` **không còn đổi semantics**; vẫn hợp lệ để tương thích nguồn cũ / tool gen code.
- Không liên quan `BigDecimal`, `Math.fma`, hay decimal money — chỉ FP binary `float`/`double`.
- Code mới: có thể bỏ `strictfp`; giữ nếu phải compile xuyên JDK cũ hoặc policy bắt modifier. Xem [operators.md](operators.md) nếu bàn làm tròn/so sánh FP.

---

### 2.40 `super`

- **Loại:** reserved  
- **Mục đích:** Gọi ctor/member của superclass; trong interface default method: `InterfaceName.super.method()`.

```java
public Dog(String name) {
    super(name);
}

@Override
public void start() {
    super.start();
    // ...
}
```

**Ghi chú:**

- `super(...)` / `this(...)` phải là lời gọi ctor **đúng quy tắc**: trước Java 25 thường là statement đầu tiên; từ **Java 25 (JEP 513)** cho phép prologue trước `super`/`this` (không dùng instance chưa init). Xem [java25.md](java25.md) · [oop.md](oop.md).
- `super.field` / `super.method()` truy cập thành viên superclass (kể khi bị hide/override).
- Default method conflict: `A.super.foo()` chọn implementation từ interface `A`.
- Trong anonymous/local class, `super` vẫn trỏ superclass của anonymous type.

---

### 2.41 `switch`

- **Loại:** reserved  
- **Mục đích:** Rẽ nhánh đa giá trị — **statement** hoặc **expression** (Java 14+ ổn định). Pattern matching switch (Java 21+ chuẩn).

```java
int days = switch (month) {
    case 1, 3, 5, 7, 8, 10, 12 -> 31;
    case 4, 6, 9, 11 -> 30;
    case 2 -> 28;
    default -> throw new IllegalArgumentException();
};
```

**Ghi chú:**

- **Statement** (`switch (x) { case …: … }`): fall-through mặc định với `:`; arrow `->` không fall-through.
- **Expression** (JEP 361, final Java 14): trả giá trị; nhánh block dùng `yield`; phải exhaustive (hoặc `default` / `throw`).
- Selector: primitives tích hợp, `String`, `enum`, boxed, và (21+) pattern trên tham chiếu; preview 25: primitive patterns rộng hơn (JEP 507).
- Pattern switch + `when` + sealed/record → compiler kiểm tra phủ sóng — giảm `default` “chết”.
- Đừng mix tư duy C `break` với expression; đừng dùng `continue` xuyên `switch` như vòng lặp.
- Tài liệu đầy đủ: [statements.md](statements.md).

---

### 2.42 `synchronized`

- **Loại:** reserved  
- **Mục đích:** (1) Method đồng bộ trên `this` (instance) hoặc `Class` (`static synchronized`). (2) Khối `synchronized (lock) { }`.

```java
public synchronized void add(int x) { sum += x; }

synchronized (lock) {
    queue.add(item);
}
```

**Ghi chú:**

- Vào monitor ⇒ **happens-before** với lần unlock cùng monitor tiếp theo (JMM): đọc sau unlock thấy ghi trước unlock.
- Method `synchronized` ≡ `synchronized (this)` (instance) hoặc `synchronized (Foo.class)` (static) — khóa thô, dễ deadlock nếu gọi chéo nhiều lock.
- **Chỉ** bảo vệ đoạn trong khối; compound check-then-act (`if (!map.containsKey) map.put`) vẫn cần cùng lock / dùng `ConcurrentHashMap` API atomic.
- **Virtual threads (21+):** `synchronized` vẫn đúng nghĩa, nhưng blocking lâu trong monitor có thể **pin** carrier thread (hạn chế scaling). Ưu tiên khóa ngắn; cân nhắc `ReentrantLock`, cấu trúc lock-free / concurrent collections khi critical section dài hoặc I/O.
- Không đồng bộ trên `this` nếu API công khai để client có thể khóa cùng object → deadlock. Không dùng `String` intern / boxed primitive làm lock.
- `wait`/`notify` đòi sở hữu monitor của đúng object. Chi tiết: [threading.md](threading.md) · [statements.md](statements.md).

---

### 2.43 `this`

- **Loại:** reserved  
- **Mục đích:** Tham chiếu instance hiện tại; gọi overload ctor `this(...)`; qualifier `Outer.this` trong inner class.

```java
public User(String name) {
    this.name = name;
}

public User() {
    this("anonymous");
}
```

**Ghi chú:**

- `this(...)` ủy quyền ctor — quy tắc vị trí giống `super` (flexible bodies từ Java 25). Không gọi vừa `this` vừa `super` trong cùng ctor.
- Trong inner class, `this` là inner; `Enclosing.this` là outer.
- Lambda **không** có `this` riêng — `this` là enclosing instance (khác anonymous class).
- Truyền `this` từ ctor ra ngoài (“leaking this”) trước khi init xong → thread khác thấy object nửa khởi tạo; cẩn với `final`/publication. [oop.md](oop.md) · [threading.md](threading.md).

---

### 2.44 `throw`

- **Loại:** reserved  
- **Mục đích:** Ném throwable.

```java
throw new IllegalStateException("not ready");
```

**Ghi chú:** [exceptions.md](exceptions.md).

---

### 2.45 `throws`

- **Loại:** reserved  
- **Mục đích:** Khai báo checked exceptions mà method có thể ném ra ngoài.

```java
public String read(Path p) throws IOException {
    return Files.readString(p);
}
```

**Ghi chú:** Unchecked (`RuntimeException` / `Error`) không bắt buộc khai báo. Override: không thêm checked mới rộng hơn. [exceptions.md](exceptions.md).

---

### 2.46 `transient`

- **Loại:** reserved  
- **Mục đích:** Field bỏ qua khi **Java built-in serialization** (`ObjectOutputStream` / `Serializable`) mặc định.

```java
private transient byte[] cache;
private transient Lock lock = new ReentrantLock();
```

**Ghi chú:**

- Chỉ ảnh hưởng **Java serialization** cổ điển. **Không** tự ẩn field với Jackson/Gson/Protobuf/JPA — các framework dùng annotation/`transient` keyword **không** luôn được tôn trọng (Jackson: thường cần `@JsonIgnore` hoặc config).
- Field `transient` nhận **default** khi deserialize (`0`/`null`/`false`) — phải `readObject` / lazy init lại cache, lock, logger, connection…
- Thường đánh dấu: cache, derived state, `Logger`, lock, `Thread`, resource native — thứ không nên hoặc không thể serialize.
- `static` vốn không serialize theo instance; `transient` trên static vô nghĩa về serialization instance.
- Security: deserialization gadget — hạn chế `Serializable`, dùng lọc / bản ghi hiện đại thay stack cũ khi được. Không nhầm với `volatile`.

---

### 2.47 `try`

- **Loại:** reserved  
- **Mục đích:** Khối bắt đầu xử lý exception / try-with-resources.

```java
try (var in = Files.newInputStream(path)) {
    in.transferTo(out);
}
```

**Ghi chú:** Resource phải `AutoCloseable`. Unnamed `var _ = …` (22+) khi chỉ cần lifecycle. [exceptions.md](exceptions.md) · [statements.md](statements.md).

---

### 2.48 `void`

- **Loại:** reserved  
- **Mục đích:** Method không trả giá trị. Không có biến kiểu `void`.

```java
public void clear() {
    items.clear();
}
```

---

### 2.49 `volatile`

- **Loại:** reserved  
- **Mục đích:** Field có **visibility / ordering** theo JMM — đọc/ghi volatile thiết lập happens-before; không thay atomic cho phép toán compound.

```java
private volatile boolean running = true;
private volatile Config config; // safe publication of immutable/carefully published object
```

**Ghi chú:**

- Đảm bảo: ghi volatile *happens-before* đọc volatile sau đó trên **cùng field**; cũng tạo ordering với các truy cập khác theo quy tắc JMM (không phải “luôn flush mọi field”).
- **Không** làm `i++` / check-then-act an toàn — dùng `AtomicInteger`, `synchronized`, hoặc lock. `volatile boolean` flag “stop” thường OK nếu chỉ ghi `true`/`false` độc lập.
- **Safe publication:** gán `volatile` reference tới object bất biến (hoặc đúng cách publish) để thread khác thấy state khởi tạo đủ — pattern phổ biến hơn `synchronized` getter đơn giản cho config hiếm đổi.
- Khác `synchronized`: không loại trừ lẫn nhau (mutex); chỉ visibility/ordering. Khác `Atomic*`: atomic có CAS/compound ops.
- Tránh `volatile` trên mọi field “cho chắc” — che giấu data race, tốn hơn field thường, vẫn sai nếu thiếu đồng bộ.
- Chi tiết JMM / concurrent: [threading.md](threading.md).

---

### 2.50 `while`

- **Loại:** reserved  
- **Mục đích:** Vòng lặp điều kiện trước.

```java
while (iterator.hasNext()) {
    consume(iterator.next());
}
```

---

## 3. Contextual keywords

Chỉ mang nghĩa đặc biệt ở ngữ cảnh nhất định. Danh sách chính (Java module system + hiện đại). Edge cases đặt tên: [§6](#6-identifiers-trông-đặc-biệt).

### 3.1 `var` (local variable type inference · Java 10+)

```java
var list = new ArrayList<String>(); // ArrayList<String>
var stream = Files.lines(path);     // Stream<String>
```

**Ghi chú:**

- Ổn định **Java 10** (JEP 286). Suy luận kiểu **compile-time** — không phải dynamic typing / `Object`.
- Được: local variable, index/`resource` trong try-with-resources, biến vòng enhanced-for / truyền thống (từ các bản hỗ trợ tương ứng).
- **Không** dùng cho field, method return type, hay tham số method thường.
- Lambda: tham số `var` (Java 11+, JEP 323) khi cần đồng nhất / annotation: `(var x, var y) -> …` — không trộn `var` với kiểu tường minh trong cùng danh sách.
- Phải có initializer (trừ vài trường hợp đặc biệt không áp dụng như “var không kiểu”); không `var x = null;` đơn độc (không suy ra được). Tránh `var` khi kiểu mất đi ở API boundary khó đọc.
- Xem thêm edge cases §6 và [typesystem.md](typesystem.md).

---

### 3.2 `yield` (switch expression · Java 14+)

```java
int r = switch (obj) {
    case String s -> s.length();
    case Integer i -> {
        System.out.println(i);
        yield i * 2;
    }
    default -> 0;
};
```

**Ghi chú:**

- Xuất hiện cùng **switch expressions** (preview 12/13, final **Java 14**, JEP 361). Chỉ **trả giá trị từ nhánh** `switch` dạng block — không phải iterator.
- **Khác C# / Python** `yield return` / generator. Trong Java không có coroutine `yield` kiểu đó.
- Contextual: ở vị trí không phải switch expression, `yield` có thể là identifier (code cũ đặt tên method `yield()` vẫn biên dịch trong nhiều ngữ cảnh) — đừng cố đặt tên mới.
- Trong nhánh `->` expression không cần `yield`; trong `{ }` phải `yield` (hoặc `throw`). [statements.md](statements.md).

---

### 3.3 `record` (Java 16+)

```java
public record Point(int x, int y) {
    public Point {
        if (x < 0 || y < 0) throw new IllegalArgumentException();
    }
}
```

**Ghi chú:** Implicit `final`, accessors `x()`/`y()`, `equals`/`hashCode`/`toString`. Compact constructor. Final **Java 16** (JEP 395). [oop.md](oop.md).

---

### 3.4 `sealed` / `permits` / `non-sealed` (Java 17+)

```java
public sealed interface Shape permits Circle, Rectangle, Triangle { }

public record Circle(double r) implements Shape { }
public record Rectangle(double w, double h) implements Shape { }
public non-sealed class Triangle implements Shape { }
```

**Ghi chú:**

- Final **Java 17** (JEP 409). Class/interface `sealed` chỉ cho phép subtype trong `permits` (hoặc cùng compilation unit nếu bỏ `permits` và khai báo cùng file — quy tắc JLS).
- Mọi subtype trực tiếp phải ghi: `final`, `sealed`, hoặc `non-sealed`.
- **`permits`:** danh sách tường minh — hỗ trợ exhaustiveness trong `switch` pattern (21+) mà không cần `default` nếu phủ hết.
- **`non-sealed`:** mở lại cây kế thừa từ điểm đó (subtype tự do) — dùng khi muốn “chốt một tầng” rồi cho plugin mở rộng.
- Subtype thường cùng module/package theo quy tắc accessibility. Kết hợp record + sealed rất hợp domain model. [oop.md](oop.md) · [statements.md](statements.md).

---

### 3.5 `when` (pattern guard · Java 21+)

```java
return switch (shape) {
    case Circle c when c.r() > 10 -> "big circle";
    case Circle c -> "small circle";
    case Rectangle r -> "rect";
};
```

**Ghi chú:**

- Phần của **pattern matching for switch** (final **Java 21**, JEP 441). Guard boolean sau pattern; chỉ vào nhánh khi pattern khớp **và** `when` true.
- Đặt nhánh `when` **trước** nhánh cùng pattern không guard — nếu ngược lại, nhánh hẹp có thể dead.
- Contextual: ngoài pattern switch/context pattern, `when` có thể là tên hợp lệ ở nhiều chỗ — tránh dùng làm API mới dễ nhầm.
- [statements.md](statements.md).

---

### 3.6 Module system: `module`, `requires`, `exports`, `opens`, `provides`, `uses`, `to`, `with`, `transitive`, `open`

```java
module com.example.app {
    requires java.sql;
    requires transitive com.example.api;
    exports com.example.app.api;
    opens com.example.app.internal to com.fasterxml.jackson.databind;
    provides com.example.Spi with com.example.SpiImpl;
    uses com.example.Spi;
}
```

**Ghi chú:** Chỉ đặc biệt trong `module-info.java` (và ngữ pháp module). Ngoài file đó thường dùng được làm identifier. Chi tiết: [packages-modules.md](packages-modules.md) · §6 bên dưới.

---

## 4. Unnamed variable / pattern `_`

Từ **Java 22+** (JEP 456), `_` đánh dấu **biến / pattern không dùng** (unnamed):

```java
try (var _ = openResource()) {
    // chỉ cần side-effect của việc mở/đóng
}

for (Order _ : orders) {
    count++;
}

switch (obj) {
    case Point(_, int y) -> y;           // bỏ qua x
    case String _ -> "text";
    default -> "other";
}

BiFunction<Integer, Integer, Integer> add = (_, y) -> y + 1; // bỏ tham số đầu
```

**Ghi chú:**

- Không đọc/gán `_` như biến thường; nhiều `_` trong cùng scope được phép.
- Trước 22, `_` từng là identifier hợp lệ rồi bị hạn chế dần (preview/unnamed qua 21–22) — code cũ tên `_` cần đổi khi lên 22+.
- Thay convention `ignored` / `unused`. Kết hợp record patterns / switch: [statements.md](statements.md).

---

## 5. Bảng nhanh

| Keyword / contextual | Nhóm | Gợi nhớ | Xem thêm |
|----------------------|------|---------|----------|
| `class` `interface` `enum` `record` | Khai báo kiểu | record = data carrier | [oop.md](oop.md) |
| `sealed` `permits` `non-sealed` | Hệ phân cấp đóng | exhaustiveness | [oop.md](oop.md) |
| `var` | Suy luận local | không phải dynamic typing | [typesystem.md](typesystem.md) |
| `switch` `case` `default` `yield` `when` | Rẽ nhánh hiện đại | expression + patterns | [statements.md](statements.md) |
| `try` `catch` `finally` `throw` `throws` | Exception | checked vs unchecked | [exceptions.md](exceptions.md) |
| `synchronized` `volatile` | Đồng bộ / visibility | JMM | [threading.md](threading.md) |
| `static` `final` `abstract` `native` `transient` `strictfp` | Modifier thành viên | — | [oop.md](oop.md) |
| `extends` `implements` `super` `this` | OOP | single class inheritance | [oop.md](oop.md) |
| `instanceof` | Type test / pattern | flow scoping | [typesystem.md](typesystem.md) |
| `package` `import` + module words | Đóng gói | module-info contextual | [packages-modules.md](packages-modules.md) |
| `_` | Unnamed (22+) | discard | [statements.md](statements.md) |
| `const` `goto` | Reserved unused | đừng dùng | — |
| `true` `false` `null` | Literals | không phải keyword | — |

---

## 6. Identifiers “trông đặc biệt”

Một số token **trông như keyword** nhưng chỉ dành riêng ở ngữ cảnh hẹp — dễ gây nhầm khi đọc spec, viết tool, hoặc nâng JDK.

### 6.1 `var` — edge cases

| Được | Không / cẩn thận |
|------|------------------|
| Local + initializer suy ra được | Field, return type, parameter method thường |
| `try (var in = …)` | `var x;` không init; `var x = null;` đơn độc |
| `(var a, var b) -> …` (11+) | Trộn `(var a, int b)` trong cùng lambda |
| Unnamed `var _ = …` (22+) | Dùng `var` khi diamond/`<?>` làm kiểu “mất nghĩa” khó đọc |

`var` **không** phải reserved keyword toàn cục: tên method/`var` như identifier vẫn tồn tại ở một số vị trí lịch sử, nhưng **đừng** đặt tên mới là `var`. Inference thất bại → ghi kiểu tường minh.

### 6.2 Module keywords — chỉ “đặc biệt” trong `module-info`

`module`, `requires`, `exports`, `opens`, `provides`, `uses`, `to`, `with`, `transitive`, `open` là **contextual** cho khai báo module (Java 9+).

```java
// file thường: hợp lệ ở nhiều ngữ cảnh
int module = 1;
void requires() { }

// module-info.java: các từ trên mang ngữ pháp module
```

Đừng giả định chúng “cấm tuyệt đối” như `class`/`int`. Ngược lại: trong `module-info.java` đừng dùng chúng làm tên tùy tiện. Xem [packages-modules.md](packages-modules.md).

### 6.3 Contextual hiện đại khác

| Token | Ngữ cảnh đặc biệt | Identifier ngoài ngữ cảnh? |
|-------|-------------------|----------------------------|
| `record` | Khai báo record type | Thường vẫn đặt tên biến/method `record` được (tránh) |
| `sealed` / `permits` / `non-sealed` | Khai báo sealed hierarchy | Contextual |
| `yield` | Giá trị nhánh switch expression | Method tên `yield` legacy vẫn gặp |
| `when` | Guard sau pattern | Contextual |
| `_` | Unnamed (22+) | Không còn dùng như tên biến thường |

### 6.4 Literal vs keyword

```java
boolean ok = true;   // literal
Object o = null;     // literal
// boolean true = false; // lỗi: không dùng true làm tên
```

Keyword dành chỗ trong ngữ pháp; literal là giá trị cố định. Cả hai đều không thể làm identifier theo cách thông thường, nhưng JLS phân biệt rõ — hữu ích khi đọc spec hoặc viết parser/tooling.

---

## 7. Ngữ nghĩa keyword / tính năng theo phiên bản

Danh sách reserved keywords cốt lõi ổn định từ lâu; **tính năng mới** chủ yếu thêm **contextual keyword** hoặc đổi **ngữ nghĩa** mà không phá tên reserved. Bảng dưới ghi mốc **ổn định (final)** — nhiều tính năng từng preview 1–2 bản trước đó.

| Phiên bản | Keyword / cú pháp | Ghi chú |
|-----------|-------------------|---------|
| 1.0–1.1 | Hầu hết reserved hiện nay | Nền tảng ngôn ngữ |
| 1.4 | `assert` | Bật bằng `-ea` |
| 5 | `enum` | Type-safe enums |
| 8 | (interface) `default` / `static` methods | Không thêm reserved mới |
| 9 | Module contextual: `module` `requires` `exports` … | Chỉ `module-info.java` |
| **10** | `var` | Local-variable type inference (JEP 286) |
| 11 | `var` trên lambda parameters | JEP 323 |
| 12–13 | switch expressions / `yield` | **Preview** |
| **14** | `switch` expression + `yield` | Final (JEP 361) |
| 15 | Text blocks | Không keyword mới (`"""`) |
| **16** | `record`; `instanceof` pattern | JEP 395, JEP 394 |
| **17** | `sealed` / `permits` / `non-sealed`; `strictfp` no-op semantics | JEP 409; JEP 306 |
| 18–20 | Pattern switch / record patterns | Preview lặp |
| **21** | Pattern `switch` + `when`; record patterns; virtual threads (API) | JEP 441, 440; VT không thêm keyword |
| **22** | Unnamed `_` | JEP 456 |
| 23–24 | … | Chủ yếu API / preview khác |
| **25** LTS | Flexible constructor bodies (`this`/`super` prologue) | JEP 513 — không keyword mới |
| **25** | `import module` | JEP 511 — mở rộng `import` |
| **25** preview | Primitive types in patterns (`instanceof` / `switch`) | JEP 507 — cần `--enable-preview` |

**`--enable-preview`:** compile và chạy phải cùng bật preview (ví dụ `javac --release 25 --enable-preview …`, `java --enable-preview …`). Không bật thì API/cú pháp preview không dùng được. Theo dõi [java25.md](java25.md) để biết JEP nào còn preview trên bản LTS bạn đang chạy.

**Gợi ý nâng tài liệu cũ:**

- Switch “chỉ statement + break” → cân nhắc expression + arrow + pattern (14 / 21).
- `(Type) obj` sau `instanceof` → pattern binding (16+).
- Hierarchy mở + `default` switch → `sealed` + exhaustiveness (17 / 21).
- Biến `ignored` → `_` (22+).
- Ctor chỉ `super` đầu dòng → flexible bodies (25) khi cần validate/arg trước.

---

## Tóm tắt nhanh

- Reserved keywords **không** làm identifier; contextual (`var`, `record`, `sealed`, `yield`, `when`, module words) chỉ đặc biệt đúng chỗ.
- `true` / `false` / `null` là **literal**; `_` từ 22 là unnamed, không phải biến thường.
- High-risk runtime/JMM: `synchronized`, `volatile`, `assert`, `native`, `transient` — đọc kỹ Ghi chú + [threading.md](threading.md) / [exceptions.md](exceptions.md).
- Học sâu hành vi: [statements.md](statements.md) · [oop.md](oop.md) · [typesystem.md](typesystem.md) · [packages-modules.md](packages-modules.md) · [java25.md](java25.md).
