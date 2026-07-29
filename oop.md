# Lập trình hướng đối tượng trong Java  

*(Class, inheritance, sealed, records, enums, Object)*

Java là ngôn ngữ **object-oriented** (với hỗ trợ functional ngày càng mạnh). Mọi thứ (trừ primitive) đều gắn với object trên heap; mọi class kế thừa (trực tiếp/gián tiếp) từ `java.lang.Object`.

---

## Mục lục

- [Lập trình hướng đối tượng trong Java](#lập-trình-hướng-đối-tượng-trong-java)
  - [Mục lục](#mục-lục)
  - [1. Class \& Object cơ bản](#1-class--object-cơ-bản)
    - [1.1 Khai báo class](#11-khai-báo-class)
    - [1.2 Fields](#12-fields)
    - [1.3 Access modifiers](#13-access-modifiers)
    - [1.4 Static vs instance](#14-static-vs-instance)
    - [1.5 Constructors](#15-constructors)
    - [1.6 JEP 513 — Flexible Constructor Bodies (final Java 25)](#16-jep-513--flexible-constructor-bodies-final-java-25)
  - [2. Kế thừa \& Đa hình](#2-kế-thừa--đa-hình)
    - [2.1 `extends`, `super`, override](#21-extends-super-override)
    - [2.2 Abstract class \& `abstract` methods](#22-abstract-class--abstract-methods)
    - [2.3 `final` (class / method / field)](#23-final-class--method--field)
    - [2.4 Sealed classes (`sealed` / `permits` / `non-sealed`)](#24-sealed-classes-sealed--permits--non-sealed)
  - [3. Interface](#3-interface)
    - [3.1 Khai báo \& triển khai](#31-khai-báo--triển-khai)
    - [3.2 Default / static / private methods](#32-default--static--private-methods)
    - [3.3 Đa kế thừa kiểu (multiple inheritance of type)](#33-đa-kế-thừa-kiểu-multiple-inheritance-of-type)
  - [4. Records](#4-records)
    - [4.1 Khai báo \& semantics](#41-khai-báo--semantics)
    - [4.2 Compact constructors](#42-compact-constructors)
  - [5. Enums](#5-enums)
  - [6. Nested / Inner / Local / Anonymous classes](#6-nested--inner--local--anonymous-classes)
  - [7. Equality \& `toString`](#7-equality--tostring)
    - [7.1 `equals` / `hashCode` conventions](#71-equals--hashcode-conventions)
    - [7.2 `Objects` helpers](#72-objects-helpers)
  - [8. Object methods overview](#8-object-methods-overview)
  - [9. Best practices tổng hợp](#9-best-practices-tổng-hợp)

---

## 1. Class & Object cơ bản

### 1.1 Khai báo class

```java
public class Person {
    private String name;
    private int age;

    public Person(String name, int age) {
        this.name = name;
        this.age = age;
    }

    public String name() { return name; }
    public int age() { return age; }
}
```

- `class` tạo **kiểu tham chiếu (reference type)**. Instance nằm trên **heap**; biến giữ **reference**.
- Một `.java` file **public top-level** phải trùng tên file với class `public`.
- Thành viên: field, method, constructor, nested type, initializer block.

### 1.2 Fields

```java
public class Counter {
    private int value;                          // instance field
    public static final int MAX = 1_000;        // hằng (compile-time nếu primitive/String)
    private final UUID id = UUID.randomUUID();  // gán 1 lần (field init hoặc ctor)
}
```

- Field instance: mỗi object một bản copy.
- `static` field: gắn với **class**, dùng chung mọi instance.
- `final` field: phải được gán đúng một lần (blank final → ctor / initializer).
- Khác C#: Java **không có** property syntax; thường dùng getter/setter hoặc record accessors.

### 1.3 Access modifiers

| Modifier | Class | Package | Subclass | Thế giới |
|----------|:-----:|:-------:|:--------:|:--------:|
| `public` | ✓ | ✓ | ✓ | ✓ |
| `protected` | ✓ | ✓ | ✓ | ✗ |
| *(package-private / default)* | ✓ | ✓ | ✗* | ✗ |
| `private` | ✓ | ✗ | ✗ | ✗ |

\*Subclass **ngoài package** không thấy package-private.

- Modules (`module-info.java`) thêm lớp encapsulation: `exports` / `opens`.
- Quy tắc: **thu hẹp phạm vi** nhất có thể (*least privilege*).

### 1.4 Static vs instance

```java
public final class MathUtil {
    private MathUtil() {} // ngăn instantiate

    public static double clamp(double v, double lo, double hi) {
        return Math.max(lo, Math.min(hi, v));
    }
}
```

- `static` method/field: gọi qua tên class (`MathUtil.clamp(...)`).
- Static context **không** truy cập `this` / instance members trực tiếp.
- Static initializer `{ ... }` chạy một lần khi class được load.

```java
static {
    // init static state — cẩn thận side-effect / thứ tự
}
```

### 1.5 Constructors

```java
public class HttpClientWrapper {
    private final HttpClient client;

    public HttpClientWrapper() {
        this(HttpClient.newHttpClient()); // constructor chaining
    }

    public HttpClientWrapper(HttpClient client) {
        this.client = Objects.requireNonNull(client);
    }
}
```

- Nếu không khai báo ctor → compiler tạo **default no-arg** (chỉ khi không có ctor nào khác).
- `this(...)` / `super(...)`: trước Java 25 phải là **câu lệnh đầu tiên** trong body.
- Không kế thừa constructor; subclass phải gọi `super(...)` (explicit hoặc implicit no-arg).

### 1.6 JEP 513 — Flexible Constructor Bodies (final Java 25)

Từ **Java 25**, constructor được chia thành:

1. **Prologue** — statements **trước** `super(...)` / `this(...)`
2. **Explicit constructor invocation** — `super(...)` hoặc `this(...)`
3. **Epilogue** — phần còn lại sau lời gọi đó

```java
public class PositivePoint extends Point {
    public PositivePoint(int x, int y) {
        // Prologue: được phép — validate / tính toán ARGUMENTS
        if (x < 0 || y < 0) {
            throw new IllegalArgumentException("x, y must be >= 0");
        }
        super(x, y); // explicit ctor invocation
        // Epilogue: dùng this bình thường
    }
}
```

**Early construction context** (prologue + argument list của `super`/`this`):

- **Không** dùng `this` để đọc field/method của instance đang xây (trừ gán field cùng class **không** có initializer).
- **Được** gọi static methods, tạo locals, validate, tính toán tham số truyền lên `super`.
- **Được** gán field của class hiện tại (nếu field đó không có initializer) trước `super` — hữu ích khi superclass gọi overridable method trong ctor của nó.

```java
public class SafeBase {
    public SafeBase() {
        // Anti-pattern cũ: gọi overridable method trong ctor
        onInit();
    }
    protected void onInit() {}
}

public class Child extends SafeBase {
    private final int size;

    public Child(int size) {
        this.size = size; // gán field TRƯỚC super — JEP 513
        super();          // SafeBase.onInit() → Child.onInit() thấy size đã init
    }

    @Override
    protected void onInit() {
        System.out.println("size=" + size); // không còn 0 mặc định
    }
}
```

> Trước JEP 513, validate trước `super` thường phải “nhét” vào biểu thức đối số (`super(requirePositive(x), ...)`) — khó đọc. Flexible bodies giải quyết đúng vấn đề đó.

---

## 2. Kế thừa & Đa hình

### 2.1 `extends`, `super`, override

```java
public class Animal {
    public String speak() { return "..."; }
}

public class Dog extends Animal {
    @Override
    public String speak() { return "woof"; }

    public void fetch() { /* ... */ }
}

Animal a = new Dog();
a.speak();          // "woof" — dynamic dispatch
((Dog) a).fetch();  // cần cast để gọi API riêng
```

- Java: **single inheritance** của class (`extends` đúng một class).
- `@Override` nên luôn gắn khi ghi đè — bắt lỗi signature sai lúc compile.
- Gọi implementation cha: `super.speak()`.
- Covariant return type được phép khi override.

### 2.2 Abstract class & `abstract` methods

```java
public abstract class Shape {
    public abstract double area();

    public final String describe() {
        return getClass().getSimpleName() + " area=" + area();
    }
}

public class Circle extends Shape {
    private final double r;
    public Circle(double r) { this.r = r; }

    @Override
    public double area() { return Math.PI * r * r; }
}
```

- Abstract class **không** instantiate trực tiếp.
- Có thể chứa state, ctor, concrete + abstract methods.
- Dùng khi có **shared implementation / state**; interface khi chỉ cần **contract**.

### 2.3 `final` (class / method / field)

```java
public final class Money { /* không subclass được */ }

public class Account {
    public final void freeze() { /* subclass không override được */ }
    private final String id;
}
```

- `final class`: bảo mật / bất biến thiết kế (vd. `String`, nhiều value type kiểu record).
- `final method`: khóa hành vi (template method hooks chọn lọc).
- `final` local / parameter: không gán lại (thường dùng cho effectively final + lambda).

### 2.4 Sealed classes (`sealed` / `permits` / `non-sealed`)

Kiểm soát **ai được kế thừa** — kết hợp mạnh với pattern matching / `switch`.

```java
public sealed interface Expr
        permits Literal, Add, Neg { }

public record Literal(double value) implements Expr {}
public record Add(Expr left, Expr right) implements Expr {}
public record Neg(Expr expr) implements Expr {}

double eval(Expr e) {
    return switch (e) {
        case Literal(double v) -> v;
        case Add(var l, var r)  -> eval(l) + eval(r);
        case Neg(var x)         -> -eval(x);
        // exhaustiveness: không cần default
    };
}
```

- `sealed` + `permits`: whitelist subtype.
- Subtype phải: `final`, `sealed`, hoặc `non-sealed` (mở lại cây kế thừa).
- Subtype thường cùng module / cùng package (quy tắc accessibility).

---

## 3. Interface

### 3.1 Khai báo & triển khai

```java
public interface Repository<T> {
    Optional<T> findById(long id);
    void save(T entity);
}

public class InMemoryRepo implements Repository<User> {
    @Override
    public Optional<User> findById(long id) { /* ... */ return Optional.empty(); }

    @Override
    public void save(User entity) { /* ... */ }
}
```

- Interface: **đa kế thừa kiểu** — class `implements` nhiều interface.
- Field trong interface: ngầm `public static final`.
- Method abstract: ngầm `public abstract` (trừ default/static/private).

### 3.2 Default / static / private methods

```java
public interface Logger {
    void log(String msg);

    default void info(String msg) {
        log("[INFO] " + msg);
    }

    static Logger noop() {
        return msg -> { /* discard */ };
    }

    private void unusedHelper() {
        // tái sử dụng nội bộ giữa các default methods
    }
}
```

- **Default methods**: evolution API mà không phá binary compatibility của implementors cũ.
- **Static methods**: factory / utilities gắn interface.
- **Private (instance/static) methods**: helper cho default/static — không phải API công khai.
- Conflict hai default cùng signature → class phải override và chọn (`InterfaceName.super.method()`).

### 3.3 Đa kế thừa kiểu (multiple inheritance of type)

```java
interface Readable { void read(); }
interface Writable { void write(); }
interface ReadWritable extends Readable, Writable {}

class File implements ReadWritable {
    public void read() {}
    public void write() {}
}
```

- Java **không** đa kế thừa class (tránh diamond state).
- Diamond với default methods: compiler bắt buộc resolve tường minh.

---

## 4. Records

### 4.1 Khai báo & semantics

```java
public record UserId(long value) {
    public UserId {
        if (value <= 0) throw new IllegalArgumentException("id");
    }
}

public record Point(int x, int y) {}
```

- Record = **shallowly immutable data carrier**: header components → private final fields + canonical ctor + accessors `x()`/`y()` + `equals`/`hashCode`/`toString`.
- Ngầm `final`, kế thừa `java.lang.Record` (không `extends` class khác).
- Có thể `implements` interface; thêm static members, compact/custom ctor, methods.

### 4.2 Compact constructors

```java
public record Range(int start, int end) {
    public Range {
        // compact: không liệt kê tham số — gán components tự động sau body
        if (end < start) {
            throw new IllegalArgumentException("end < start");
        }
        // được phép: start = Math.min(start, end); // normalize
    }
}
```

- Compact constructor: validate / normalize **trước** khi field được gán.
- Không cần (và không được) gán `this.start = start` thủ công theo kiểu thường — assignment tới components được xử lý bởi cơ chế compact.

---

## 5. Enums

```java
public enum Level {
    DEBUG(10), INFO(20), WARN(30), ERROR(40);

    private final int severity;

    Level(int severity) { this.severity = severity; }

    public int severity() { return severity; }

    public boolean isAtLeast(Level other) {
        return this.severity >= other.severity;
    }
}
```

- Enum = class đặc biệt: cố định instances (`Level.INFO`), `Enum<E>` superclass.
- Có thể có fields, methods, abstract methods per-constant, implement interfaces.
- Switch trên enum: exhaustiveness hữu ích; `EnumSet` / `EnumMap` tối ưu.
- So sánh identity thường dùng `==` (an toàn với enum constants).

---

## 6. Nested / Inner / Local / Anonymous classes

```java
public class Outer {
    private int x = 1;

    // static nested — không giữ Outer.this
    public static class Nested {
        void m() { /* không truy cập x instance */ }
    }

    // inner — gắn instance Outer
    public class Inner {
        void m() { System.out.println(x); }
    }

    void demo() {
        // local class
        class Local {
            void run() { System.out.println(x); }
        }
        new Local().run();

        // anonymous
        Runnable r = new Runnable() {
            @Override public void run() { System.out.println(x); }
        };
        r.run();

        // hiện đại hơn: lambda
        Runnable r2 = () -> System.out.println(x);
    }
}
```

| Loại | Giữ outer instance? | Dùng khi |
|------|---------------------|----------|
| static nested | Không | Helper gắn namespace class |
| inner | Có | Cần state outer |
| local | Có (nếu non-static) | Scope hẹp trong method |
| anonymous | Có | One-shot (ưu tiên lambda nếu SAM) |

---

## 7. Equality & `toString`

### 7.1 `equals` / `hashCode` conventions

Hợp đồng `Object.equals`:

- Reflexive, symmetric, transitive, consistent; `x.equals(null) == false`.
- **Luôn** override `hashCode` khi override `equals` — bằng nhau ⇒ cùng hash.
- Dùng trong `HashMap`/`HashSet`: vi phạm hợp đồng → bug khó tìm.

```java
public final class Money {
    private final BigDecimal amount;
    private final Currency currency;

    public Money(BigDecimal amount, Currency currency) {
        this.amount = amount;
        this.currency = currency;
    }

    @Override
    public boolean equals(Object o) {
        return o instanceof Money m
                && amount.compareTo(m.amount) == 0
                && currency.equals(m.currency);
    }

    @Override
    public int hashCode() {
        return Objects.hash(amount.stripTrailingZeros(), currency);
    }

    @Override
    public String toString() {
        return amount + " " + currency.getCurrencyCode();
    }
}
```

- Prefer `instanceof` pattern (Java 16+) thay vì `getClass()` trừ khi hierarchy đòi hỏi so khớp class chính xác.
- Record / enum: `equals`/`hashCode`/`toString` đã đúng mặc định.

### 7.2 `Objects` helpers

```java
Objects.equals(a, b);           // null-safe
Objects.hash(a, b, c);
Objects.requireNonNull(x, "x");
Objects.toString(x, "default");
```

---

## 8. Object methods overview

| Method | Ý nghĩa |
|--------|---------|
| `equals(Object)` | Equality logic |
| `hashCode()` | Hash cho collections |
| `toString()` | Representation debug/log |
| `getClass()` | Runtime class (final) |
| `clone()` | Shallow copy — **hiếm dùng**; prefer copy ctor / factory |
| `finalize()` | **Deprecated for removal** — đừng dùng; dùng `Cleaner` / try-with-resources |
| `wait` / `notify` / `notifyAll` | Monitor low-level — ưu tiên `java.util.concurrent` |

```java
synchronized (lock) {
    while (!condition) {
        lock.wait();
    }
    // ...
    lock.notifyAll();
}
```

---

## 9. Best practices tổng hợp

- **Composition over inheritance** khi không có quan hệ “is-a” rõ.
- API công khai: interface nhỏ; implementation `final` nếu không thiết kế để mở rộng.
- Dùng **sealed** cho domain closed; **record** cho DTO / value object.
- Tránh gọi overridable methods từ constructor; nếu superclass làm vậy — init field trong prologue (JEP 513).
- Encapsulation: fields `private`; expose qua methods / record accessors.
- Equality: consistent với nghiệp vụ; document nếu so sánh dùng `compareTo` (Money, BigDecimal).
- Prefer immutability (`final` fields, records) để đơn giản hóa concurrency.

---

*Tham chiếu Java 25 LTS — Flexible Constructor Bodies: [JEP 513](https://openjdk.org/jeps/513).*
