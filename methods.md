# Phương thức (Method) trong Java

Trong Java, **method** đóng gói hành vi của class/interface/enum/record. Tài liệu này phủ khai báo, overload, varargs, modifier, covariant return, pass-by-value, method reference (tóm tắt), và compact constructor của record — mục tiêu **Java 25 LTS**.

---

## Mục lục

1. [Khai báo phương thức](#1-khai-báo-phương-thức)
2. [Overloading](#2-overloading)
3. [Varargs](#3-varargs)
4. [Return & `void`](#4-return--void)
5. [Instance vs `static`](#5-instance-vs-static)
6. [Modifier: `abstract` / `final` / `native` / `synchronized`](#6-modifier-abstract--final--native--synchronized)
7. [Method trong `interface`](#7-method-trong-interface)
8. [Generic methods](#8-generic-methods)
9. [Covariant return types](#9-covariant-return-types)
10. [Truyền tham số — pass-by-value](#10-truyền-tham-số--pass-by-value)
11. [Method references (tóm tắt)](#11-method-references-tóm-tắt)
12. [Constructors & compact constructors (record)](#12-constructors--compact-constructors-record)
13. [Quy ước & best practices](#13-quy-ước--best-practices)

---

## 1. Khai báo phương thức

### 1.1 Cú pháp tổng quát

```java
[annotations]
[modifiers] returnType name([params]) [throws TypeList] {
    // body
}
```

- **Access:** `public`, `protected`, package-private (không ghi), `private`
- **Khác:** `static`, `final`, `abstract`, `synchronized`, `native`, `strictfp` (di sản), `default` (chỉ interface)
- Tên method: **camelCase** theo convention

```java
public class Calculator {
    public int add(int x, int y) {
        return x + y;
    }

    public static int multiply(int x, int y) {
        return x * y;
    }
}
```

### 1.2 Annotation thường gặp

```java
@Override
public String toString() {
    return "Calculator";
}

@Deprecated(since = "25", forRemoval = false)
public void legacy() { }

@SafeVarargs
public final void safe(List<String>... lists) { }
```

`@Override` nên luôn gắn khi override — bắt lỗi chữ ký sai lúc compile.

### 1.3 Tham số & tên

```java
public void send(String to, String subject, String body) { }
```

Không có named arguments / optional parameters kiểu C#. Dùng overload, builder, hoặc `Optional`/nullable có kiểm soát.

---

## 2. Overloading

Cùng tên, **khác chữ ký** (số lượng / kiểu tham số). **Không** phân biệt chỉ bằng kiểu trả về.

```java
public class Logger {
    public void log(String message) { }
    public void log(String message, Throwable t) { }
    public void log(Level level, String message) { }
}
```

Overload resolution chọn method **cụ thể nhất** phù hợp; boxing/varargs có thể gây bất ngờ:

```java
void f(int x) { }
void f(Integer x) { }
void f(int... xs) { }

f(1); // thường chọn f(int)
```

---

## 3. Varargs

Tham số cuối dạng `T...` → mảng `T[]` tại runtime.

```java
public static int sum(int... values) {
    int s = 0;
    for (int v : values) s += v;
    return s;
}

sum();
sum(1, 2, 3);
sum(new int[] {1, 2});
```

**Lưu ý:**

- Chỉ **một** varargs và phải **cuối** danh sách.
- Generic varargs → cảnh báo heap pollution; dùng `@SafeVarargs` trên `static`/`final`/`private` khi an toàn.
- Truyền `null` một đối số: `sum(null)` có thể NPE khi unbox/iterate — rõ ràng hơn với mảng rỗng.

---

## 4. Return & `void`

```java
public int size() {
    return items.size();
}

public void clear() {
    items.clear();
    // return; tùy chọn
}
```

- Mọi nhánh của method non-void phải return hoặc throw.
- Có thể trả về subtype (covariant) khi override — mục 9.
- Expression-bodied kiểu C# `=>` **không** có; dùng block hoặc single `return`.

---

## 5. Instance vs `static`

| | Instance | Static |
|---|----------|--------|
| Gọi | qua object | qua tên type (hoặc reference — không khuyến khích) |
| Truy cập | `this`, field instance | chỉ static (trừ khi có instance tường minh) |
| Override | có (virtual dispatch) | **ẩn (hide)**, không override đa hình |

```java
var calc = new Calculator();
calc.add(1, 2);
Calculator.multiply(2, 3);
```

Static method hữu ích cho factory, utility, `main`, và helper không giữ state instance.

```java
public static Calculator ofDefault() {
    return new Calculator();
}
```

---

## 6. Modifier: `abstract` / `final` / `native` / `synchronized`

### 6.1 `abstract`

```java
public abstract class Repository<T> {
    public abstract Optional<T> findById(long id);

    public T require(long id) {
        return findById(id).orElseThrow();
    }
}
```

Không có body; class chứa abstract method phải `abstract`.

### 6.2 `final`

```java
public final void criticalInvariant() {
    // subclass không override được
}
```

Class `final` / record → mọi instance method “không override từ ngoài”.

### 6.3 `native`

Body do native code cung cấp (JNI…). Chữ ký Java vẫn khai báo `throws` nếu cần.

```java
public native void flushBuffers();
```

### 6.4 `synchronized`

```java
public synchronized void deposit(long amount) {
    balance += amount;
}

public static synchronized void register(Service s) {
    REGISTRY.add(s);
}
```

Tương đương khối `synchronized (this)` / `synchronized (Class)`.

---

## 7. Method trong `interface`

Từ Java 8/9, interface không chỉ abstract:

```java
public interface IdGenerator {
    long next();                          // abstract (public)

    default String nextAsString() {       // default
        return Long.toString(next());
    }

    static IdGenerator sequential(long start) { // static
        return new Sequential(start);
    }

    private void trace(String msg) {      // private (Java 9+)
        System.out.println(msg);
    }

    private static long epoch() {         // private static
        return System.currentTimeMillis();
    }
}
```

| Loại | Override? | Ghi chú |
|------|-----------|---------|
| Abstract | bắt buộc (trừ default/static/private) | |
| `default` | tùy chọn | xung đột nhiều default → class phải resolve |
| `static` | không | gọi qua tên interface |
| `private` | không | chia sẻ code trong interface |

Interface cũng có thể `sealed` và có `permits`.

---

## 8. Generic methods

```java
public static <T extends Comparable<? super T>> T max(T a, T b) {
    return a.compareTo(b) >= 0 ? a : b;
}

var m = max("a", "z"); // T suy luận String
```

- Type params khai báo trước return type.
- Diamond/`var` ở call site giúp gọn; đôi khi cần `Type.<T>method(...)` tường minh.

---

## 9. Covariant return types

Khi override, kiểu trả về có thể là **subtype** của kiểu ở superclass/interface:

```java
public class Animal {
    public Animal self() { return this; }
}

public class Dog extends Animal {
    @Override
    public Dog self() { // covariant
        return this;
    }
}
```

Hữu ích với factory/`clone`-style APIs. Không áp dụng để “covariant” tham số (đó là overload, không phải override).

---

## 10. Truyền tham số — pass-by-value

Java **luôn pass-by-value**:

- Primitive: copy giá trị.
- Reference: copy **tham chiếu** (không phải object). Method có thể đổi trạng thái object; **không** đổi biến reference của caller trừ khi… không thể (không có `ref`/`out`).

```java
void reassign(List<String> list) {
    list = new ArrayList<>(); // chỉ đổi local
}

void mutate(List<String> list) {
    list.add("x"); // caller thấy thay đổi nội dung
}

void reset(int x) {
    x = 0; // caller không đổi
}
```

Muốn “trả nhiều giá trị”: record/`Optional`/holder object, hoặc return type riêng — không có `out` parameter.

---

## 11. Method references (tóm tắt)

Toán tử `::` tạo instance của functional interface từ method có sẵn — chi tiết ở `lambdas-functional.md`.

```java
list.forEach(System.out::println);
Predicate<String> blank = String::isBlank;
Supplier<List<String>> factory = ArrayList::new;
Function<String, Integer> parse = Integer::parseInt;
```

Bốn dạng: `static`, instance bound (`obj::method`), instance unbound (`Type::method`), constructor (`Type::new` / mảng `int[]::new`).

---

## 12. Constructors & compact constructors (record)

Constructor **không** phải method (không có return type), nhưng thường đi cùng chủ đề “thành viên hành vi”.

### 12.1 Constructor thường

```java
public class User {
    private final String name;

    public User(String name) {
        this.name = Objects.requireNonNull(name);
    }

    public User() {
        this("anonymous"); // ủy quyền
    }
}
```

### 12.2 Compact constructor của `record`

Không liệt kê lại tham số; gán component tự động sau body. Dùng để validate / chuẩn hóa:

```java
public record Point(int x, int y) {
    public Point {
        if (x < 0 || y < 0) {
            throw new IllegalArgumentException("negative");
        }
        // có thể: x = Math.abs(x); trước khi gán ngầm
    }

    public double distance() {
        return Math.hypot(x, y);
    }
}
```

- Record có canonical constructor (tường minh hoặc compact).
- Không khai báo field instance thêm (trừ static); behavior qua methods.
- Compact constructor chạy trước khi field component được gán cuối cùng.

### 12.3 Accessor của record

`x()`, `y()` — không phải `getX()` trừ khi bạn tự viết thêm.

---

## 13. Quy ước & best practices

1. Method ngắn, một trách nhiệm; tên động từ/`is`/`has` rõ nghĩa.
2. Luôn `@Override` khi override; tránh overload dễ nhầm với varargs/boxing.
3. Prefer `private` helper hơn protected “just in case”.
4. Checked exceptions: khai báo `throws` trung thực hoặc bọc unchecked có nguyên nhân — xem `exceptions.md`.
5. Tránh `synchronized` method quá rộng; khoá dữ liệu cụ thể, section ngắn.
6. Interface: default method để tiến hóa API; đừng nhồi business state vào interface.
7. Record: validation trong compact constructor; logic thuần có thể là instance method.
8. Virtual threads: method blocking I/O ổn trên VT; tránh pin/`ThreadLocal` nặng nếu scale cực lớn.

---

## Cheat sheet

```java
public final class MethodsCheatSheet {

    public static <T> T requireNonNull(T value, String msg) {
        if (value == null) throw new IllegalArgumentException(msg);
        return value;
    }

    public synchronized void touch() {
        lastAccess = System.nanoTime();
    }

    private long lastAccess;

    public interface Service {
        void start();
        default void restart() {
            stop();
            start();
        }
        void stop();
        static Service noop() {
            return new Service() {
                public void start() {}
                public void stop() {}
            };
        }
    }

    public record Range(int start, int end) {
        public Range {
            if (end < start) throw new IllegalArgumentException();
        }
        public int length() { return end - start; }
    }
}
```
