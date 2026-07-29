# Lập trình hướng đối tượng trong Java

*(Class, inheritance, sealed, records, enums, Object)*

Tài liệu tham chiếu OOP Java theo thực hành **Java 25 LTS**: class/object, thứ tự khởi tạo, kế thừa & đa hình,
sealed types, interface (default/diamond), composition, records, enums, nested classes, `equals`/`hashCode`,
và các bẫy thường gặp. Mọi thứ (trừ primitive) gắn với object trên heap; mọi class kế thừa (trực tiếp/gián tiếp)
từ `java.lang.Object`.

Cross-link: [typesystem.md](typesystem.md) · [methods.md](methods.md) · [keywords.md](keywords.md) ·
[lambdas-functional.md](lambdas-functional.md) · [collections-generics.md](collections-generics.md) ·
[threading.md](threading.md) · [java25.md](java25.md)

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
  - [2. Thứ tự khởi tạo (Initialization order)](#2-thứ-tự-khởi-tạo-initialization-order)
    - [2.1 Instance: field init → initializer block → ctor](#21-instance-field-init--initializer-block--ctor)
    - [2.2 Static initialization](#22-static-initialization)
    - [2.3 Superclass gọi overridable method trong ctor](#23-superclass-gọi-overridable-method-trong-ctor)
  - [3. Kế thừa \& Đa hình](#3-kế-thừa--đa-hình)
    - [3.1 `extends`, `super`, override](#31-extends-super-override)
    - [3.2 Abstract class \& `abstract` methods](#32-abstract-class--abstract-methods)
    - [3.3 `final` (class / method / field)](#33-final-class--method--field)
    - [3.4 Sealed classes (`sealed` / `permits` / `non-sealed`)](#34-sealed-classes-sealed--permits--non-sealed)
  - [4. Composition vs inheritance](#4-composition-vs-inheritance)
  - [5. Interface](#5-interface)
    - [5.1 Khai báo \& triển khai](#51-khai-báo--triển-khai)
    - [5.2 Default / static / private methods](#52-default--static--private-methods)
    - [5.3 Đa kế thừa kiểu \& diamond default conflict](#53-đa-kế-thừa-kiểu--diamond-default-conflict)
  - [6. Records](#6-records)
    - [6.1 Khai báo \& semantics](#61-khai-báo--semantics)
    - [6.2 Compact constructors](#62-compact-constructors)
    - [6.3 Local records, nested \& constraints](#63-local-records-nested--constraints)
    - [6.4 Reflection (`RecordComponent`) \& serialization](#64-reflection-recordcomponent--serialization)
  - [7. Enums](#7-enums)
    - [7.1 Khai báo \& semantics](#71-khai-báo--semantics)
    - [7.2 Constant-specific class bodies \& abstract methods](#72-constant-specific-class-bodies--abstract-methods)
    - [7.3 `EnumSet` / `EnumMap` \& switch exhaustiveness](#73-enumset--enummap--switch-exhaustiveness)
  - [8. Nested / Inner / Local / Anonymous classes](#8-nested--inner--local--anonymous-classes)
    - [8.1 Các loại nested](#81-các-loại-nested)
    - [8.2 Bẫy: inner giữ outer — memory leak](#82-bẫy-inner-giữ-outer--memory-leak)
  - [9. Equality \& `toString`](#9-equality--tostring)
    - [9.1 `equals` / `hashCode` conventions](#91-equals--hashcode-conventions)
    - [9.2 `getClass()` vs `instanceof`, subclass asymmetry](#92-getclass-vs-instanceof-subclass-asymmetry)
    - [9.3 Mutable keys, BigDecimal](#93-mutable-keys-bigdecimal)
    - [9.4 `Objects` helpers](#94-objects-helpers)
  - [10. Object methods overview \& layout](#10-object-methods-overview--layout)
  - [11. Pitfalls](#11-pitfalls)
  - [12. Best practices](#12-best-practices)

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
- Chi tiết method: [methods.md](methods.md); keyword liên quan: [keywords.md](keywords.md).

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
- Static initializer `{ ... }` chạy một lần khi class được load — chi tiết thứ tự: mục [2](#2-thứ-tự-khởi-tạo-initialization-order).

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

> **Lưu ý**: Trước JEP 513, validate trước `super` thường phải “nhét” vào biểu thức đối số (`super(requirePositive(x), ...)`) — khó đọc. Flexible bodies giải quyết đúng vấn đề đó. Chi tiết Java 25: [java25.md](java25.md).

---

## 2. Thứ tự khởi tạo (Initialization order)

### 2.1 Instance: field init → initializer block → ctor

Khi `new Sub(...)`:

1. Cấp phát object + zero/null defaults cho fields.
2. Chạy chuỗi ctor từ **superclass → subclass** (sau mỗi `super(...)` return).
3. Trong mỗi class (theo thứ tự xuất hiện trong source): **field initializers** + **instance initializer blocks** `{ ... }`, rồi phần còn lại của constructor body (epilogue).

```java
class Super {
    int a = print("Super.field");
    { System.out.println("Super.block"); }
    Super() { System.out.println("Super.ctor"); }
}

class Sub extends Super {
    int b = print("Sub.field");
    { System.out.println("Sub.block"); }
    Sub() { System.out.println("Sub.ctor"); }

    static int print(String s) {
        System.out.println(s);
        return 0;
    }
}

// new Sub() in ra:
// Super.field → Super.block → Super.ctor → Sub.field → Sub.block → Sub.ctor
```

- `super(...)` (hoặc implicit) chạy **trước** field init / instance block của subclass.
- Nhiều instance blocks: theo thứ tự textual, xen kẽ với field initializers.
- Constructor chaining `this(...)`: chỉ ctor “cuối” (không gọi `this`) chạy field init + instance blocks một lần.

### 2.2 Static initialization

Khi class lần đầu được **initialize** (JLS):

1. Superclass static init (đệ quy lên).
2. Static field initializers + `static { }` blocks theo thứ tự textual trong class.

```java
class A {
    static int x = print("A.x");
    static { System.out.println("A.static"); }
    static int print(String s) { System.out.println(s); return 1; }
}
```

**Bẫy circular static init**: hai class tham chiếu static lẫn nhau → một phía có thể thấy giá trị mặc định (0/`null`) chưa chạy xong initializer.

> **Lưu ý**: Exception trong static initializer → `ExceptionInInitializerError`; class coi như lỗi khởi tạo — lần dùng sau thường `NoClassDefFoundError`.

### 2.3 Superclass gọi overridable method trong ctor

```java
class Base {
    Base() { hook(); }          // gọi virtual khi subclass chưa init xong
    void hook() { System.out.println("Base"); }
}

class Derived extends Base {
    private final String name = "derived";
    @Override void hook() {
        System.out.println(name); // trước JEP 513: thường null (field chưa gán)
    }
}
```

- Dynamic dispatch chạy ngay trong ctor cha → subclass override thấy state **chưa** qua field init / epilogue.
- Tránh gọi overridable / abstract method từ constructor; nếu bắt buộc (legacy base) → gán field trong **prologue** (**JEP 513**, Java 25) như mục 1.6, hoặc dùng composition / factory sau khi object fully constructed.

---

## 3. Kế thừa & Đa hình

### 3.1 `extends`, `super`, override

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
- Covariant return type được phép khi override — [methods.md](methods.md).

### 3.2 Abstract class & `abstract` methods

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

### 3.3 `final` (class / method / field)

```java
public final class Money { /* không subclass được */ }

public class Account {
    public final void freeze() { /* subclass không override được */ }
    private final String id;
}
```

- `final class`: bảo mật / bất biến thiết kế (vd. `String`, nhiều value type kiểu record).
- `final method`: khóa hành vi (template method hooks chọn lọc).
- `final` local / parameter: không gán lại (thường dùng cho effectively final + lambda — [lambdas-functional.md](lambdas-functional.md)).

### 3.4 Sealed classes (`sealed` / `permits` / `non-sealed`)

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
- Bức tranh kiểu / pattern matching: [typesystem.md](typesystem.md).

---

## 4. Composition vs inheritance

**Prefer composition** khi không có quan hệ **is-a** rõ ràng hoặc khi chỉ muốn tái sử dụng implementation.

```java
// Inheritance — "EngineeredVehicle is-a Vehicle" rõ
public class Vehicle {
    public void start() { /* ... */ }
}
public class Car extends Vehicle {
    public void drive() { start(); /* ... */ }
}

// Composition — "has-a" Engine; linh hoạt thay implementation
public final class Car2 {
    private final Engine engine;

    public Car2(Engine engine) {
        this.engine = Objects.requireNonNull(engine);
    }

    public void drive() {
        engine.start();
        // ...
    }
}

public interface Engine { void start(); }
public final class ElectricEngine implements Engine {
    @Override public void start() { /* ... */ }
}
```

| Tiêu chí | Inheritance (`extends`) | Composition (has-a) |
|----------|-------------------------|---------------------|
| Quan hệ | is-a | has-a / uses-a |
| Coupling | chặt (lộ protected API cha) | lỏng (qua interface nhỏ) |
| Thay hành vi lúc runtime | khó (cố định hierarchy) | dễ (đổi dependency) |
| Fragile base class | có | ít hơn |
| Đa hình | class hierarchy | thường qua interface |

- Inheritance phù hợp khi subtype **là** specialization thật sự và bạn kiểm soát được base (sealed/final hooks).
- `extends` chỉ để lấy vài method tiện → thường sai; extract collaborator / delegate.
- Decorator / wrapper (`FilterInputStream`, …) là composition cổ điển.

> **Lưu ý**: “Reuse qua `extends`” dễ phá encapsulation (`protected`) và làm `equals`/`hashCode` khó đúng (mục 9).

---

## 5. Interface

### 5.1 Khai báo & triển khai

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

### 5.2 Default / static / private methods

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
- SAM + lambda: [lambdas-functional.md](lambdas-functional.md).

### 5.3 Đa kế thừa kiểu & diamond default conflict

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
- Diamond với **default methods** cùng signature → class/interface phải **override và chọn tường minh**.

```java
interface A {
    default String m() { return "A"; }
}
interface B {
    default String m() { return "B"; }
}

// Compile error nếu chỉ: class C implements A, B {}
class C implements A, B {
    @Override
    public String m() {
        // Resolve tường minh — cú pháp InterfaceName.super.method()
        return A.super.m() + "+" + B.super.m(); // "A+B"
    }
}
```

Quy tắc tóm tắt:

| Tình huống | Kết quả |
|------------|---------|
| Một default, không abstract xung đột | Dùng default đó |
| Class concrete method vs interface default | **Class thắng** |
| Hai interface default cùng signature | Phải override + `X.super.m()` |
| Sub-interface override default của super-interface | Sub-interface thắng cho implementor |

**Bẫy**: quên override khi thêm default mới vào interface thứ hai → break compile của implementor (cố ý — an toàn hơn silent pick).

---

## 6. Records

### 6.1 Khai báo & semantics

```java
public record UserId(long value) {
    public UserId {
        if (value <= 0) throw new IllegalArgumentException("id");
    }
}

public record Point(int x, int y) {}
```

- Record = **shallowly immutable data carrier**: header components → private final fields + canonical ctor + accessors `x()`/`y()` + `equals`/`hashCode`/`toString`.
- Ngầm `final`, kế thừa `java.lang.Record` — **không** `extends` class khác (kể cả abstract).
- Có thể `implements` interface; thêm static members, compact/custom ctor, methods.
- Components shallow immutable: reference field vẫn có thể trỏ object mutable — đừng lộ mutable state nếu cần value semantics thật.

### 6.2 Compact constructors

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

### 6.3 Local records, nested & constraints

```java
void handle(List<String> lines) {
    // Local record (Java 16+) — chỉ trong method/block
    record Line(int n, String text) {}
    List<Line> parsed = IntStream.range(0, lines.size())
            .mapToObj(i -> new Line(i + 1, lines.get(i)))
            .toList();
}

public class OrderService {
    // Nested record: static nested ngầm (không giữ outer.this)
    public record OrderId(long value) {}
}
```

- Local / nested records: tiện DTO tạm, intermediate trong stream pipeline.
- Nested record **không** phải inner class — không capture enclosing instance.
- Không khai báo instance field ngoài components; không thêm native methods tùy tiện theo JLS record rules.
- Có thể khai báo nested enum/interface/class tĩnh bên trong record.

### 6.4 Reflection (`RecordComponent`) & serialization

```java
RecordComponent[] comps = Point.class.getRecordComponents();
for (RecordComponent c : comps) {
    System.out.println(c.getName() + " : " + c.getType());
    // c.getAccessor() → Method accessor
}
Point.class.isRecord(); // true
```

- `Class.isRecord()`, `getRecordComponents()` — introspection ổn định hơn đoán field synthetic.
- Serialization: record serialize theo **canonical constructor** + components (không theo custom `writeObject` kiểu class cũ theo cùng mô hình). Version skew / missing component → lỗi rõ hơn “field lạ bỏ qua”.
- Framework JSON (Jackson, …) thường map theo accessor tên component — kiểm tra config nếu dùng `getX()` style cũ.

> **Lưu ý**: Record **không thể** mở rộng class khác; muốn hierarchy đóng → `sealed interface` + các record permits (mục 3.4).

---

## 7. Enums

### 7.1 Khai báo & semantics

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

- Enum = class đặc biệt: cố định instances (`Level.INFO`), superclass `Enum<E>`.
- Có thể có fields, methods, implement interfaces.
- So sánh identity thường dùng `==` (an toàn với enum constants).
- `name()` / `ordinal()` / `valueOf` / `values()` — tránh dựa `ordinal()` cho persistence (đổi thứ tự = vỡ data).

### 7.2 Constant-specific class bodies & abstract methods

```java
public enum Op {
    PLUS {
        @Override public int apply(int a, int b) { return a + b; }
    },
    MINUS {
        @Override public int apply(int a, int b) { return a - b; }
    };

    public abstract int apply(int a, int b);
}
```

- Mỗi constant có thể có **class body** riêng (anonymous subclass của enum).
- Pattern thay `switch` phân tán khi mỗi constant có hành vi khác biệt rõ.
- Enum vẫn `final` về mặt mở rộng ngoài các constant đã khai báo.

### 7.3 `EnumSet` / `EnumMap` & switch exhaustiveness

```java
EnumSet<Level> alerts = EnumSet.of(Level.WARN, Level.ERROR);
EnumMap<Level, String> labels = new EnumMap<>(Level.class);
labels.put(Level.INFO, "informational");

String emoji = switch (Level.INFO) {
    case DEBUG -> "…";
    case INFO  -> "i";
    case WARN  -> "!";
    case ERROR -> "x";
    // sealed-like exhaustiveness trên enum: đủ case → không cần default
};
```

| API | Khi dùng |
|-----|----------|
| `EnumSet` | tập bit-vector tối ưu theo enum universe — [collections-generics.md](collections-generics.md) |
| `EnumMap` | map key = enum; array-backed, nhanh, không `HashMap` overhead |
| `switch` / pattern | exhaustiveness khi cover mọi constant (thêm constant → compile error nếu thiếu case) |

**Bẫy**: `EnumSet.allOf` + mutate shared static set mà không copy → race / side-effect toàn cục — prefer local hoặc immutable copy khi share.

---

## 8. Nested / Inner / Local / Anonymous classes

### 8.1 Các loại nested

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

### 8.2 Bẫy: inner giữ outer — memory leak

Non-static inner / anonymous / lambda capture giữ reference tới enclosing instance (`Outer.this`).

```java
public class ListenerHub {
    private final List<Runnable> listeners = new ArrayList<>();

    public void registerLeak() {
        // anonymous inner → giữ ListenerHub.this
        listeners.add(new Runnable() {
            @Override public void run() { /* ... */ }
        });
    }

    public void registerBetter(Runnable r) {
        listeners.add(Objects.requireNonNull(r)); // caller kiểm soát lifetime
    }

    // Prefer static nested khi không cần outer state
    public static final class Stats {
        int count;
    }
}
```

- Đăng ký listener/callback là inner của Activity/Service/`this` lớn → object ngoài **không GC** được dù UI đã destroy (cùng pattern Android / Swing).
- **Prefer static nested** (+ truyền outer tường minh nếu cần) hoặc lambda/method ref tới helper không capture nặng.
- Serialization inner class cũng kéo outer — thường không serialize inner.

> **Lưu ý**: Nested **record** / **enum** luôn static về mặt enclosing reference — an toàn hơn inner class cổ điển.

---

## 9. Equality & `toString`

### 9.1 `equals` / `hashCode` conventions

Hợp đồng `Object.equals`:

- Reflexive, symmetric, transitive, consistent; `x.equals(null) == false`.
- **Luôn** override `hashCode` khi override `equals` — bằng nhau ⇒ cùng hash.
- Dùng trong `HashMap`/`HashSet`: vi phạm hợp đồng → bug khó tìm — [collections-generics.md](collections-generics.md).

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

- Record / enum: `equals`/`hashCode`/`toString` đã đúng mặc định (shallow components / identity).

### 9.2 `getClass()` vs `instanceof`, subclass asymmetry

```java
// instanceof (Java 16+ pattern) — cho phép subclass equals cha nếu không cẩn thận
@Override
public boolean equals(Object o) {
    return o instanceof Point p && x == p.x && y == p.y;
}

// getClass() — chỉ cùng runtime class
@Override
public boolean equals(Object o) {
    if (o == null || getClass() != o.getClass()) return false;
    Point p = (Point) o;
    return x == p.x && y == p.y;
}
```

| Cách | Ưu | Nhược |
|------|----|-------|
| `instanceof` / pattern | Đơn giản; hợp LSP nếu class `final` hoặc equals không phụ thuộc subclass state | Subclass thêm field dễ **phá symmetry/transitivity** |
| `getClass()` | Chặt: `ColorPoint` ≠ `Point` cùng tọa độ | Không equals được khi so qua base type cố ý |

**Bẫy asymmetry**:

```java
// Point.equals dùng instanceof; ColorPoint.equals so thêm color
Point p = new Point(1, 2);
ColorPoint cp = new ColorPoint(1, 2, RED);
p.equals(cp);  // true
cp.equals(p);  // false — phá symmetric
```

- Prefer **`final` class** hoặc **record** cho value types; hoặc composition thay subclass thêm state equality.
- Sealed hierarchy: document chiến lược equals rõ (thường so khớp đúng subtype).

### 9.3 Mutable keys, BigDecimal

**Bẫy mutable key trong `HashMap`/`HashSet`:**

```java
var key = new ArrayList<>(List.of("a"));
Map<List<String>, Integer> map = new HashMap<>();
map.put(key, 1);
key.add("b");           // hashCode đổi sau khi insert
map.get(key);           // thường null — mất entry logic
map.get(List.of("a"));  // cũng không tìm thấy
```

- Key phải **immutable** về các field tham gia `equals`/`hashCode` (hoặc không mutate khi đang là key).
- Prefer record / `List.copyOf` / defensive copy.

**BigDecimal — `compareTo` vs `equals`:**

```java
var a = new BigDecimal("1.0");
var b = new BigDecimal("1.00");
a.compareTo(b) == 0; // true — cùng giá trị số
a.equals(b);         // false — khác scale
```

- Money/domain: thường so bằng `compareTo` (và `hashCode` qua `stripTrailingZeros()` như ví dụ Money).
- Đừng trộn `equals` BigDecimal với giả định “cùng số là bằng”.

### 9.4 `Objects` helpers

```java
Objects.equals(a, b);           // null-safe
Objects.hash(a, b, c);
Objects.requireNonNull(x, "x");
Objects.toString(x, "default");
```

---

## 10. Object methods overview & layout

| Method | Ý nghĩa |
|--------|---------|
| `equals(Object)` | Equality logic |
| `hashCode()` | Hash cho collections |
| `toString()` | Representation debug/log |
| `getClass()` | Runtime class (final) |
| `clone()` | Shallow copy — **hiếm dùng**; prefer copy ctor / factory |
| `finalize()` | **Deprecated for removal** — đừng dùng; dùng `Cleaner` / try-with-resources |
| `wait` / `notify` / `notifyAll` | Monitor low-level — ưu tiên `java.util.concurrent` — [threading.md](threading.md) |

```java
synchronized (lock) {
    while (!condition) {
        lock.wait();
    }
    // ...
    lock.notifyAll();
}
```

**Object layout (tóm tắt):** mỗi instance trên HotSpot có **object header** + fields (và padding alignment). Nhiều object nhỏ → header chiếm tỷ lệ đáng kể. **JEP 519 — Compact Object Headers** (Java 25) thu gọn header → giảm footprint / tăng mật độ cache. Chi tiết GC & headers: [typesystem.md](typesystem.md) §2.1 · [java25.md](java25.md).

---

## 11. Pitfalls

1. **Gọi overridable method từ constructor** — subclass thấy field chưa init; mitigations: `final` method, factory, prologue gán field (**JEP 513**).
2. **Static init circular / side-effect nặng** — giá trị mặc định tạm thời hoặc `ExceptionInInitializerError`.
3. **Inheritance thay cho has-a** — fragile base class, lộ `protected`, `equals` khó đúng → prefer composition (mục 4).
4. **Diamond default methods** — quên `A.super.m()` / `B.super.m()` → không compile (đúng hướng); class method thắng default.
5. **`equals`/`hashCode` lệch hợp đồng** — đặc biệt subclass + `instanceof`, hoặc mutate key sau khi `put` vào `HashMap`.
6. **`BigDecimal.equals` vs `compareTo`** — `1.0` ≠ `1.00` theo `equals`.
7. **Inner class giữ outer** — listener/callback leak; prefer static nested / không capture `this` lớn.
8. **Record tưởng deep-immutable** — component là mutable reference vẫn đổi state bên trong.
9. **`Enum.ordinal()` persistence** — đổi thứ tự constant phá data; dùng `name()` hoặc field ổn định.
10. **`clone()` / `finalize()`** — API di sản; copy ctor + `Cleaner` / try-with-resources.
11. **`wait` không trong loop / sai lock** — spurious wakeup; ưu tiên `j.u.c` — [threading.md](threading.md).

---

## 12. Best practices

Checklist nhanh:

- [ ] **Composition over inheritance** khi không có is-a rõ; dependency qua interface nhỏ.
- [ ] API công khai: interface / sealed tối thiểu; implementation `final` nếu không thiết kế mở rộng.
- [ ] Domain đóng → **sealed**; DTO / value object → **record** (local record cho intermediate).
- [ ] Không gọi overridable từ ctor; nếu base legacy gọi hook → init field trong prologue (**JEP 513** / Java 25).
- [ ] Encapsulation: fields `private`; nested helper → **static nested** trừ khi thật sự cần outer instance.
- [ ] Override `equals` ⇒ override `hashCode`; class value nên `final`/record; document `compareTo` nếu khác `equals` (Money, BigDecimal).
- [ ] Key của `HashMap`/`HashSet` bất biến; dùng `EnumSet`/`EnumMap` khi key/universe là enum.
- [ ] Prefer immutability (`final` fields, records) để đơn giản hóa concurrency — [threading.md](threading.md).
- [ ] `@Override` luôn khi ghi đè; switch trên sealed/enum tận dụng exhaustiveness.
- [ ] Tránh `clone`/`finalize`; monitor `wait`/`notify` chỉ khi biết rõ — còn lại `java.util.concurrent`.

---

*Tham chiếu Java 25 LTS — Flexible Constructor Bodies: [JEP 513](https://openjdk.org/jeps/513); Compact Object Headers: [JEP 519](https://openjdk.org/jeps/519).*
