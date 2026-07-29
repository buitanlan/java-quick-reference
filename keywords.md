# Từ khóa (Keywords) trong Java

Tài liệu tham khảo các **từ khóa dành riêng (reserved keywords)** và **từ khóa ngữ cảnh (contextual keywords)** trong **Java 25 LTS**. Mỗi mục gồm mục đích, ví dụ ngắn và ghi chú thực dụng.

> **Lưu ý:** `true`, `false`, `null` là **literal**, không phải keyword theo nghĩa reserved identifier — chúng không dùng làm tên biến/method/class, nhưng về mặt ngữ pháp thuộc nhóm literal chứ không phải keyword.

---

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Reserved keywords](#2-reserved-keywords)
3. [Contextual keywords](#3-contextual-keywords)
4. [Unnamed variable / pattern `_`](#4-unnamed-variable--pattern-_)
5. [Bảng nhanh](#5-bảng-nhanh)

---

## 1. Tổng quan

| Nhóm | Đặc điểm |
|------|----------|
| **Reserved keywords** | Luôn dành riêng; không dùng làm identifier ở mọi ngữ cảnh. |
| **Contextual keywords** | Chỉ “đặc biệt” ở ngữ cảnh nhất định (`var`, `record`, `sealed`, `yield`, `when`…). Ở ngữ cảnh khác có thể là tên hợp lệ (tuỳ phiên bản / vị trí). |
| **Reserved nhưng không dùng** | `const`, `goto` — dành riêng để tránh xung đột với C/C++, không có nghĩa trong Java. |
| **Literals** | `true`, `false`, `null` — không phải keyword; xem mục đầu. |

Java 25 LTS kế thừa nhiều tính năng hiện đại: **records**, **sealed classes**, **pattern matching**, **switch expressions**, **virtual threads** (API/`Thread`), và preview như **primitive types in patterns** (JEP 507).

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

**Ghi chú:** Interface method không ghi `body` cũng là abstract (implicit). Class có method abstract ⇒ class phải `abstract`.

---

### 2.2 `assert`

- **Loại:** reserved · **Từ:** Java 1.4  
- **Mục đích:** Kiểm tra invariant lúc runtime khi `-ea` (enable assertions).

```java
assert n > 0 : "n must be positive";
```

**Ghi chú:** Tắt mặc định trên production JVM. Không dùng `assert` thay validation đầu vào công khai (dùng exception / Objects.requireNonNull).

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

**Ghi chú:** Trong **switch expression**, không dùng `break` để “trả giá trị” — dùng `yield` hoặc nhánh expression.

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

---

### 2.17 `extends`

- **Loại:** reserved  
- **Mục đích:** Class kế thừa một class; interface kế thừa nhiều interface. Cũng dùng trong bound generic `T extends Number`.

```java
public class Dog extends Animal { }
public interface Closeable extends AutoCloseable { }
```

---

### 2.18 `final`

- **Loại:** reserved  
- **Mục đích:** Không kế thừa (class), không override (method), không gán lại (biến/field). Local `final` / effectively final quan trọng với lambda.

```java
final int limit = 10;
public final class Utils { }
```

**Ghi chú:** Record class là `final` ngầm. Field `final` của class thường gán ở ctor hoặc initializer.

---

### 2.19 `finally`

- **Loại:** reserved  
- **Mục đích:** Khối luôn chạy sau `try`/`catch` (trừ khi JVM thoát cứng).

```java
try {
    work();
} finally {
    cleanup();
}
```

**Ghi chú:** Ưu tiên try-with-resources thay vì `finally` chỉ để đóng resource.

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

---

### 2.26 `instanceof`

- **Loại:** reserved  
- **Mục đích:** Kiểm tra kiểu runtime; từ Java 16+ hỗ trợ **pattern matching** (gán biến).

```java
if (obj instanceof String s) {
    System.out.println(s.toUpperCase());
}
```

**Ghi chú:** Java 25 có **preview** JEP 507 — pattern/`instanceof`/`switch` với kiểu nguyên thủy (bật `--enable-preview`).

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
- **Mục đích:** Method triển khai bằng mã native (JNI / FFM liên quan ở tầng API).

```java
public native int hashCode(); // ví dụ lịch sử trên Object — thực tế là intrinsic
```

**Ghi chú:** Hiếm trong app business; cân nhắc Foreign Function & Memory API thay JNI cổ điển khi có thể.

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

**Ghi chú:** `static` cũng dùng trong static import, static initializer `static { }`, interface static method.

---

### 2.39 `strictfp`

- **Loại:** reserved  
- **Mục đích:** Lịch sử: FP chặt theo IEEE. Từ Java 17 trở đi mọi FP đều strict — modifier còn lại chủ yếu vì tương thích.

```java
public strictfp class LegacyMath { }
```

---

### 2.40 `super`

- **Loại:** reserved  
- **Mục đích:** Gọi ctor/member của superclass; trong interface default method: `InterfaceName.super.method()`.

```java
public Dog(String name) {
    super(name);
}
```

---

### 2.41 `switch`

- **Loại:** reserved  
- **Mục đích:** Rẽ nhánh đa giá trị — **statement** hoặc **expression** (Java 14+). Pattern matching switch (Java 21+ chuẩn).

```java
int days = switch (month) {
    case 1, 3, 5, 7, 8, 10, 12 -> 31;
    case 4, 6, 9, 11 -> 30;
    case 2 -> 28;
    default -> throw new IllegalArgumentException();
};
```

---

### 2.42 `synchronized`

- **Loại:** reserved  
- **Mục đích:** (1) Method đồng bộ trên `this`/`Class`. (2) Khối `synchronized (lock) { }`.

```java
public synchronized void add(int x) { sum += x; }

synchronized (lock) {
    queue.add(item);
}
```

**Ghi chú:** Với virtual threads, tránh giữ monitor lâu / pin carrier (blocking trong synchronized vẫn có hạn chế lịch sử; cân nhắc `ReentrantLock` / cấu trúc đồng thời cao hơn khi cần).

---

### 2.43 `this`

- **Loại:** reserved  
- **Mục đích:** Tham chiếu instance hiện tại; gọi overload ctor `this(...)`.

```java
public User(String name) {
    this.name = name;
}
```

---

### 2.44 `throw`

- **Loại:** reserved  
- **Mục đích:** Ném throwable.

```java
throw new IllegalStateException("not ready");
```

---

### 2.45 `throws`

- **Loại:** reserved  
- **Mục đích:** Khai báo checked exceptions mà method có thể ném ra ngoài.

```java
public String read(Path p) throws IOException {
    return Files.readString(p);
}
```

---

### 2.46 `transient`

- **Loại:** reserved  
- **Mục đích:** Field bỏ qua khi Java serialization mặc định.

```java
private transient byte[] cache;
```

---

### 2.47 `try`

- **Loại:** reserved  
- **Mục đích:** Khối bắt đầu xử lý exception / try-with-resources.

```java
try (var in = Files.newInputStream(path)) {
    in.transferTo(out);
}
```

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
- **Mục đích:** Field có visibility/happens-before theo JMM — đọc/ghi thẳng hơn với cache thread; không thay thế atomic compound ops.

```java
private volatile boolean running = true;
```

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

Chỉ mang nghĩa đặc biệt ở ngữ cảnh nhất định. Danh sách chính (Java module system + hiện đại):

### 3.1 `var` (local variable type inference · Java 10+)

```java
var list = new ArrayList<String>(); // ArrayList<String>
var stream = Files.lines(path);     // Stream<String>
```

**Ghi chú:** Không dùng cho field, method return, hay tham số method thường. Được dùng trong lambda parameters (Java 11+) khi cần annotation/explicit: `(var x, var y) -> ...`.

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

**Ghi chú:** Khác C# `yield return` (iterator). Trong Java, `yield` chỉ trả giá trị từ nhánh `switch` dạng block.

---

### 3.3 `record` (Java 16+)

```java
public record Point(int x, int y) {
    public Point {
        if (x < 0 || y < 0) throw new IllegalArgumentException();
    }
}
```

**Ghi chú:** Implicit `final`, accessors `x()`/`y()`, `equals`/`hashCode`/`toString`. Có compact constructor.

---

### 3.4 `sealed` / `permits` / `non-sealed` (Java 17+)

```java
public sealed interface Shape permits Circle, Rectangle, Triangle { }

public record Circle(double r) implements Shape { }
public record Rectangle(double w, double h) implements Shape { }
public non-sealed class Triangle implements Shape { }
```

**Ghi chú:** Giới hạn hệ phân cấp → `switch` pattern exhaustiveness tốt hơn. `non-sealed` mở lại kế thừa tự do từ đó trở đi.

---

### 3.5 `when` (pattern guard · Java 21+)

```java
return switch (shape) {
    case Circle c when c.r() > 10 -> "big circle";
    case Circle c -> "small circle";
    case Rectangle r -> "rect";
};
```

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

**Ghi chú:** Chỉ đặc biệt trong `module-info.java`. Ngoài ra có thể dùng làm identifier ở nhiều ngữ cảnh (tuỳ vị trí).

---

## 4. Unnamed variable / pattern `_`

Từ **Java 22+**, `_` đánh dấu **biến / pattern không dùng** (unnamed):

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

**Ghi chú:** Không đọc/gán `_` như biến thường; nhiều `_` trong cùng scope được phép. Thay thế convention `ignored` / `unused`.

---

## 5. Bảng nhanh

| Keyword / contextual | Nhóm | Gợi nhớ |
|----------------------|------|---------|
| `class` `interface` `enum` `record` | Khai báo kiểu | record = data carrier |
| `sealed` `permits` `non-sealed` | Hệ phân cấp đóng | exhaustiveness |
| `var` | Suy luận local | không phải dynamic typing |
| `switch` `case` `default` `yield` `when` | Rẽ nhánh hiện đại | expression + patterns |
| `try` `catch` `finally` `throw` `throws` | Exception | checked vs unchecked |
| `synchronized` `volatile` | Đồng bộ / visibility | JMM |
| `static` `final` `abstract` `native` | Modifier thành viên | — |
| `extends` `implements` `super` `this` | OOP | single class inheritance |
| `_` | Unnamed (22+) | discard |
| `const` `goto` | Reserved unused | đừng dùng |
| `true` `false` `null` | Literals | không phải keyword |

---

## Phụ lục: Literal vs keyword

```java
boolean ok = true;   // literal
Object o = null;     // literal
// boolean true = false; // lỗi: không dùng true làm tên
```

Keyword dành chỗ trong ngữ pháp; literal là giá trị cố định. Cả hai đều không thể làm identifier, nhưng tài liệu JLS phân biệt rõ — hữu ích khi đọc spec hoặc viết parser/tooling.
