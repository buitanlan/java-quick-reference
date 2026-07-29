# Phương thức (Method) trong Java

Trong Java, **method** đóng gói hành vi của class/interface/enum/record. Tài liệu phủ khai báo, overload resolution,
varargs / `@SafeVarargs`, bridge methods, modifier, covariant return, pass-by-value, dispatch, method reference
(tóm tắt), và compact constructor của record — mục tiêu **Java 25 LTS**.

> Cross-link: [oop.md](oop.md) · [typesystem.md](typesystem.md) · [lambdas-functional.md](lambdas-functional.md) ·
> [exceptions.md](exceptions.md) · [keywords.md](keywords.md) · [java25.md](java25.md)

---

## Mục lục

1. [Khai báo phương thức](#1-khai-báo-phương-thức)
2. [Overloading & overload resolution](#2-overloading--overload-resolution)
3. [Varargs & `@SafeVarargs`](#3-varargs--safevarargs)
4. [Return & `void`](#4-return--void)
5. [Instance vs `static` & dispatch](#5-instance-vs-static--dispatch)
6. [Modifier: `abstract` / `final` / `native` / `synchronized`](#6-modifier-abstract--final--native--synchronized)
7. [Method trong `interface`](#7-method-trong-interface)
8. [Generic methods & bridge methods](#8-generic-methods--bridge-methods)
9. [Covariant return types](#9-covariant-return-types)
10. [Truyền tham số — pass-by-value](#10-truyền-tham-số--pass-by-value)
11. [Khởi tạo & gọi method trong lifecycle](#11-khởi-tạo--gọi-method-trong-lifecycle)
12. [Method references (tóm tắt)](#12-method-references-tóm-tắt)
13. [Constructors & compact constructors (record)](#13-constructors--compact-constructors-record)
14. [Pitfalls (Bẫy)](#14-pitfalls-bẫy)
15. [Best practices](#15-best-practices)
16. [Cheat sheet](#16-cheat-sheet)
17. [Xem thêm](#xem-thêm)

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

## 2. Overloading & overload resolution

Cùng tên, **khác chữ ký** (số lượng / kiểu tham số). **Không** phân biệt chỉ bằng kiểu trả về hay `throws`.

```java
public class Logger {
    public void log(String message) { }
    public void log(String message, Throwable t) { }
    public void log(Level level, String message) { }
}
```

### 2.1 Thứ tự chọn (tóm tắt JLS)

Khi có nhiều method applicable, compiler chọn **most specific** theo phase roughly:

1. **Strict invocation** — không boxing, không varargs.
2. **Loose invocation** — cho phép boxing / unboxing / widening.
3. **Varargs invocation** — phase cuối.

```java
void f(int x) { }
void f(Integer x) { }
void f(int... xs) { }

f(1); // chọn f(int) — strict, cụ thể hơn Integer / varargs
```

| Tình huống | Kết quả điển hình |
|------------|-------------------|
| `f(int)` vs `f(Integer)` với `int` | `f(int)` |
| `f(int)` vs `f(Integer)` với `Integer` | `f(Integer)` (hoặc unbox → phụ thuộc applicable) |
| Chỉ còn varargs vs fixed | Fixed thắng nếu khớp |
| Hai method cùng “cụ thể” | Ambiguous → lỗi compile |
| Overload `Object` vs `String` với `null` | Thường chọn `String` (cụ thể hơn) — vẫn dễ confuse |

```java
void g(Object o) { }
void g(String s) { }
g(null); // chọn g(String) — most specific
```

**Khuyến nghị:** tránh overload chỉ khác boxing / varargs / `Object` vs kiểu hẹp — API khó đoán. Prefer tên khác hoặc factory rõ.

---

## 3. Varargs & `@SafeVarargs`

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
- Truyền `null` một đối số: `sum(null)` → tham số là `null` array → NPE khi iterate — rõ ràng hơn với `sum()` hoặc `new int[0]`.
- Overload + varargs dễ ambiguous (`f(String...)` vs `f(String, String...)`).

### 3.1 Heap pollution & `@SafeVarargs`

Generic varargs (`List<String>...`) → cảnh báo unchecked / heap pollution vì erasure + mảng covariant.

```java
@SafeVarargs
public final void safe(List<String>... lists) {
    for (List<String> list : lists) {
        System.out.println(list.size());
    }
}
```

| Quy tắc | Chi tiết |
|---------|----------|
| `@SafeVarargs` gắn được | `static`, `final`, `private` methods (và constructors); từ Java 9 thêm `private` |
| Khi an toàn | Method **không** lưu / alias / ghi mảng varargs theo cách caller thấy kiểu sai |
| Khi **không** gắn | Đừng suppress nếu method `return` / expose mảng `T...` ra ngoài |

```java
// Nguy hiểm — đừng @SafeVarargs
static <T> T[] asArray(T... items) {
    return items; // caller có thể pollute
}
```

Chi tiết erasure: [typesystem.md](typesystem.md) · [collections-generics.md](collections-generics.md).

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

## 5. Instance vs `static` & dispatch

| | Instance | Static |
|---|----------|--------|
| Gọi | qua object | qua tên type (hoặc reference — không khuyến khích) |
| Truy cập | `this`, field instance | chỉ static (trừ khi có instance tường minh) |
| Override | có (**virtual dispatch** theo runtime type) | **ẩn (hide)**, không đa hình |

```java
var calc = new Calculator();
calc.add(1, 2);
Calculator.multiply(2, 3);
```

### 5.1 Instance dispatch

```java
class Animal {
    void speak() { System.out.println("..."); }
}
class Dog extends Animal {
    @Override void speak() { System.out.println("woof"); }
}

Animal a = new Dog();
a.speak(); // woof — chọn Dog.speak lúc runtime
```

- Override = cùng chữ ký (tên + params; return covariant OK) — luôn `@Override`.
- `private` / `static` / `final` không tham gia override đa hình như instance virtual.
- Gọi `super.method()` để ủy quyền lên superclass.

### 5.2 Static hide (không override)

```java
class Parent {
    static void id() { System.out.println("P"); }
}
class Child extends Parent {
    static void id() { System.out.println("C"); }
}

Parent p = new Child();
p.id(); // in "P" — resolve theo kiểu tham chiếu lúc compile
Child.id(); // "C"
```

Static method hữu ích cho factory, utility, `main`, helper không giữ state instance.

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

## 8. Generic methods & bridge methods

```java
public static <T extends Comparable<? super T>> T max(T a, T b) {
    return a.compareTo(b) >= 0 ? a : b;
}

var m = max("a", "z"); // T suy luận String
```

- Type params khai báo trước return type.
- Diamond/`var` ở call site giúp gọn; đôi khi cần `Type.<T>method(...)` tường minh.

### 8.1 Bridge methods (tóm tắt)

Do **type erasure**, compiler chèn **bridge methods** synthetic để giữ polymorphism / covariant return tương thích bytecode:

```java
interface Box<T> {
    T get();
}
class StringBox implements Box<String> {
    @Override
    public String get() { return "x"; }
    // Compiler thêm bridge: public Object get() { return get(); /* String */ }
}
```

| Điểm | Chi tiết |
|------|----------|
| Ai tạo | `javac` — không viết tay |
| Thấy ở đâu | `javap -c -v`; reflection `Method.isBridge()` |
| Liên quan | Erasure generics, covariant return, override `Comparable.compareTo(Object)` |
| App code | Hiếm khi cần quan tâm — trừ debug reflection / bytecode |

Chi tiết erasure / PECS: [typesystem.md](typesystem.md) · [collections-generics.md](collections-generics.md). Override & hierarchy: [oop.md](oop.md).

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

## 11. Khởi tạo & gọi method trong lifecycle

Thứ tự khởi tạo instance (tóm tắt) — chi tiết field/ctor: [oop.md](oop.md) · flexible ctor bodies Java 25: [java25.md](java25.md).

1. Thanh phân static (class init) — một lần / class loader.
2. Superclass ctor chain.
3. Instance initializers / field instance của class hiện tại.
4. Body constructor.

**Bẫy:** gọi method **overridable** từ constructor → subclass override chạy khi field subclass **chưa** init:

```java
class Base {
    Base() { hook(); } // nguy hiểm nếu hook override được
    void hook() { }
}
class Child extends Base {
    private final int x = 42;
    @Override void hook() {
        System.out.println(x); // có thể in 0 — x chưa gán
    }
}
```

| Quy tắc | |
|---------|--|
| Trong ctor | Chỉ gọi `private` / `final` / `static` method (không override được) |
| Factory | Prefer `static of(...)` sau khi object fully constructed |
| Record compact ctor | Validate / chuẩn hóa — chưa phải “method dispatch” tự do như instance mở |

Instance method trên object đã publish: virtual dispatch bình thường (§5.1). Đừng “thoát this” (`this` leak) từ ctor tới thread khác trước khi init xong.

---

## 12. Method references (tóm tắt)

Toán tử `::` tạo instance của functional interface từ method có sẵn — chi tiết [lambdas-functional.md](lambdas-functional.md).

```java
list.forEach(System.out::println);
Predicate<String> blank = String::isBlank;
Supplier<List<String>> factory = ArrayList::new;
Function<String, Integer> parse = Integer::parseInt;
```

Bốn dạng: `static`, instance bound (`obj::method`), instance unbound (`Type::method`), constructor (`Type::new` / mảng `int[]::new`).

---

## 13. Constructors & compact constructors (record)

Constructor **không** phải method (không có return type), nhưng thường đi cùng chủ đề “thành viên hành vi”.

### 13.1 Constructor thường

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

### 13.2 Compact constructor của `record`

Không liệt kê lại tham số; gán component tự động sau body. Dùng để validate / chuẩn hóa:

```java
public record Point(int x, int y) {
    public Point {
        if (x < 0 || y < 0) {
            throw new IllegalArgumentException("negative");
        }
    }

    public double distance() {
        return Math.hypot(x, y);
    }
}
```

- Record có canonical constructor (tường minh hoặc compact).
- Không khai báo field instance thêm (trừ static); behavior qua methods.
- Compact constructor chạy trước khi field component được gán cuối cùng.
- Java 25 — flexible constructor bodies (JEP 513): [java25.md](java25.md).

### 13.3 Accessor của record

`x()`, `y()` — không phải `getX()` trừ khi bạn tự viết thêm.

---

## 14. Pitfalls (Bẫy)

1. **Overload boxing / varargs / `null`** — chọn nhánh bất ngờ hoặc ambiguous.
2. **`@SafeVarargs` bừa** — che heap pollution khi expose mảng generic.
3. **`sum(null)` varargs** — một đối số `null` ≠ mảng rỗng.
4. **Static gọi qua instance** — `p.id()` resolve theo kiểu tham chiếu; dễ tưởng override.
5. **Gọi overridable từ constructor** — subclass thấy state chưa init.
6. **Quên `@Override`** — overload / typo thành method mới im lặng.
7. **Đồng bộ method quá rộng** — giữ lock lâu; deadlock — [threading.md](threading.md).
8. **Checked exception trong SAM** — lambda không khớp `Function` — [lambdas-functional.md](lambdas-functional.md).
9. **Nhầm overload với override** — đổi kiểu param = overload, không đa hình.
10. **Bridge / erasure** — reflection thấy method `Object` thừa; đừng confuse API design.

---

## 15. Best practices

1. Method ngắn, một trách nhiệm; tên động từ / `is` / `has` rõ nghĩa.
2. Luôn `@Override` khi override; tránh overload dễ nhầm với varargs/boxing.
3. Prefer `private` helper hơn protected “just in case”.
4. Checked exceptions: `throws` trung thực hoặc bọc unchecked có cause — [exceptions.md](exceptions.md).
5. Tránh `synchronized` method quá rộng; khoá dữ liệu cụ thể, section ngắn.
6. Interface: default để tiến hóa API; đừng nhồi business state.
7. Record: validation trong compact constructor; logic thuần là instance method.
8. Ctor: không gọi overridable; prefer factory nếu cần đa hình sau init.
9. Virtual threads: method blocking I/O ổn trên VT; tránh pin / `ThreadLocal` nặng khi scale cực lớn.

```text
□ @Override mọi override
□ overload không chỉ khác Integer/int/varargs
□ @SafeVarargs chỉ khi không expose mảng
□ ctor không gọi hook overridable
□ API interface tối thiểu
```

---

## 16. Cheat sheet

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

---

## Xem thêm

| File | Liên quan |
|------|-----------|
| [oop.md](oop.md) | Override, init order, records |
| [typesystem.md](typesystem.md) | Erasure, bridge context |
| [lambdas-functional.md](lambdas-functional.md) | `::`, SAM, checked in lambda |
| [collections-generics.md](collections-generics.md) | Generic methods, PECS |
| [exceptions.md](exceptions.md) | `throws` |
| [java25.md](java25.md) | JEP 513 flexible constructors |

---

*Tham chiếu nhanh — Java 25 LTS. Overload resolution & bridges ổn định từ lâu; record compact ctor từ 16; flexible ctor bodies từ 25.*
