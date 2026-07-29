# Lambda & Functional interface trong Java

Tài liệu tham khảo **lambda**, **functional interfaces**, **method references**, capture / effectively final,
checked exceptions trong lambda, và mối liên hệ với `Comparator` / `Optional` trên **Java 25 LTS**.

> Cross-link: [methods.md](methods.md) · [statements.md](statements.md) (effectively final) · [streams.md](streams.md) ·
> [collections-generics.md](collections-generics.md) · [exceptions.md](exceptions.md) · [keywords.md](keywords.md) ·
> [java25.md](java25.md)

---

## Mục lục

1. [Lambda là gì?](#1-lambda-là-gì)
2. [Cú pháp lambda](#2-cú-pháp-lambda)
3. [Target typing](#3-target-typing)
4. [Effectively final & capture](#4-effectively-final--capture)
5. [Functional interfaces dựng sẵn](#5-functional-interfaces-dựng-sẵn)
6. [Tự viết `@FunctionalInterface`](#6-tự-viết-functionalinterface)
7. [Method references `::`](#7-method-references-)
8. [Checked exceptions trong lambda](#8-checked-exceptions-trong-lambda)
9. [`Comparator` & sắp xếp](#9-comparator--sắp-xếp)
10. [Liên hệ với `Optional`](#10-liên-hệ-với-optional)
11. [Khác biệt ngắn với C# delegates](#11-khác-biệt-ngắn-với-c-delegates)
12. [Pitfalls (Bẫy)](#12-pitfalls-bẫy)
13. [Best practices](#13-best-practices)
14. [Cheat sheet](#14-cheat-sheet)
15. [Xem thêm](#xem-thêm)

---

## 1. Lambda là gì?

- Biểu thức tạo **instance của functional interface** (đúng một method abstract — SAM).
- Thay anonymous class dài dòng cho callback, `Stream`, `CompletableFuture`, listener…
- Không phải kiểu first-class “function” độc lập — luôn có **target type**.

```java
Runnable r = () -> System.out.println("hi");
r.run();
```

---

## 2. Cú pháp lambda

```java
() -> System.out.println("go")

x -> x * x
(x) -> x * x

(a, b) -> a + b

(String s) -> s.length()
(var s) -> s.length() // Java 11+

(s) -> {
    System.out.println(s);
    return s.length();
}
```

| Dạng thân | Quy tắc return |
|-----------|----------------|
| Expression body | Giá trị expression được return (trừ target `void`) |
| Block body | `return` tường minh nếu non-void; có thể `throw` |

Unnamed param (22+): `(_, y) -> y + 1` — [keywords.md](keywords.md).

Không có `async` lambda built-in. Bất đồng bộ: `CompletableFuture`, virtual threads + blocking, structured concurrency — [async.md](async.md) · [threading.md](threading.md).

---

## 3. Target typing

Compiler suy functional interface từ **ngữ cảnh**:

```java
List<String> names = List.of("a", "bb", "c");

names.forEach(s -> System.out.println(s)); // Consumer<String>
names.sort((a, b) -> a.length() - b.length()); // Comparator<String>

Function<String, Integer> f = String::length;
Predicate<String> p = s -> !s.isBlank();
```

- Overload nhận nhiều functional types → đôi khi cần **cast** target:

```java
method((Function<String, String>) s -> s.trim());
```

- Lambda **không** suy được với `var` thiếu target:

```java
// var x = s -> s.length(); // lỗi
Function<String, Integer> x = s -> s.length();
```

---

## 4. Effectively final & capture

Lambda chỉ capture biến local nếu **final** hoặc **effectively final** (không gán lại sau khởi tạo).

```java
int factor = 2;
Function<Integer, Integer> mul = n -> n * factor; // OK

// factor = 3; // lỗi compile — không còn effectively final
```

### 4.1 Quy tắc capture

| Capture | Hợp lệ? | Ghi chú |
|---------|---------|---------|
| Local / param effectively final | Có | Copy giá trị vào closure |
| Local bị gán lại | Không | Compile error |
| Instance field (`this.f`) | Có | Đọc qua `this` — field có thể đổi; lambda giữ reference `this` |
| `this` / `Outer.this` | Có | Anonymous/lambda trong instance method |
| Static field | Có | Qua tên class / implicit |

### 4.2 Pitfalls capture

1. **Muốn “đếm” bằng `int c++` trong lambda** — không được; dùng `AtomicInteger` / mảng 1 phần tử (smell) / redesign.
2. **Listener giữ `this`** — lambda/instance method ref → object không GC được nếu listener registry sống dài.
3. **Capture object lớn** — closure giữ reference → heap / lifecycle bất ngờ.
4. **Nhầm field với local** — gán lại **field** OK về effectively final local; race nếu multi-thread không sync.
5. **Loop biến** (pre-Java “classic bug” với anonymous class) — với lambda, biến vòng phải effectively final mỗi lần; `for (int i…)` không capture `i` nếu `i++` — dùng biến local copy trong thân vòng:

```java
for (int i = 0; i < n; i++) {
    int index = i; // effectively final
    exec.submit(() -> process(index));
}
```

```java
var sum = new AtomicInteger();
list.forEach(n -> sum.addAndGet(n));
```

---

## 5. Functional interfaces dựng sẵn

Package `java.util.function`:

| Interface | Method abstract | Ý nghĩa |
|-----------|-----------------|--------|
| `Supplier<T>` | `T get()` | Cung cấp giá trị |
| `Consumer<T>` | `void accept(T)` | Tiêu thụ |
| `BiConsumer<T,U>` | `void accept(T,U)` | |
| `Predicate<T>` | `boolean test(T)` | Điều kiện |
| `BiPredicate<T,U>` | `boolean test(T,U)` | |
| `Function<T,R>` | `R apply(T)` | Ánh xạ |
| `BiFunction<T,U,R>` | `R apply(T,U)` | |
| `UnaryOperator<T>` | `T apply(T)` | `Function<T,T>` |
| `BinaryOperator<T>` | `T apply(T,T)` | |

Primitive specialized (tránh boxing): `IntSupplier`, `LongPredicate`, `ObjIntConsumer`, `ToIntFunction`, …

```java
Predicate<String> nonEmpty = s -> s != null && !s.isEmpty();
Function<String, Integer> len = String::length;
UnaryOperator<String> trim = String::trim;
Supplier<Instant> now = Instant::now;
Consumer<String> log = System.out::println;
BinaryOperator<Integer> max = Integer::max;

Predicate<String> p = nonEmpty.and(s -> s.length() > 3).negate();
Function<String, String> pipe = trim.andThen(String::toUpperCase);
```

`Runnable` / `Callable<V>` cũng là functional interfaces (`Callable` khai báo `throws Exception` — hữu ích với checked).

---

## 6. Tự viết `@FunctionalInterface`

```java
@FunctionalInterface
public interface Transformer {
    int transform(int x);

    default Transformer andThen(Transformer after) {
        return x -> after.transform(transform(x));
    }

    static Transformer identity() {
        return x -> x;
    }
}

Transformer square = x -> x * x;
int y = square.andThen(x -> x + 1).transform(3); // 10
```

- Annotation không bắt buộc nhưng giúp compiler bắt abstract method thứ hai.
- Được phép nhiều `default` / `static` / `private` methods.

---

## 7. Method references `::`

### 7.1 Bốn dạng

```java
Function<String, Integer> parse = Integer::parseInt;          // static
Consumer<String> c = System.out::println;                     // bound instance
Function<String, Integer> len = String::length;               // unbound instance
BiPredicate<String, String> eq = String::equals;              // unbound — receiver là arg đầu
Supplier<List<String>> lists = ArrayList::new;                // ctor
Function<Integer, int[]> arr = int[]::new;                    // array ctor
Function<String, User> ctor = User::new;                      // User(String)
```

### 7.2 Khi nào `::` thay lambda?

- Body chỉ ủy quyền một method → `::` ngắn và rõ.
- Cần adapt (null-check, đổi thứ tự, bắt exception) → giữ lambda.

```java
list.stream().map(String::trim);
list.stream().map(s -> s == null ? "" : s.trim());
```

### 7.3 Edge cases method reference

| Bẫy | Chi tiết |
|-----|----------|
| Ambiguous overload | `Type::method` khớp nhiều overload → lỗi; cast target hoặc lambda tường minh |
| Bound vs unbound | `str::equals` vs `String::equals` — arity / receiver khác |
| Generic ctor / diamond | Đôi khi cần `<T>Type::new` hoặc target type rõ |
| `this::method` / `super::method` | Giữ `this`; `super::` gọi phiên bản superclass |
| Checked exception | Method ref tới method `throws` checked **không** khớp SAM không khai báo checked (giống lambda) |
| Varargs method | Adapt arity có thể bất ngờ — kiểm tra overload resolution |
| `Objects::nonNull` vs `x -> x != null` | OK; cẩn `filter(Objects::nonNull)` trên stream nullable |

```java
// Ambiguous — Integer có nhiều valueOf
// Function<String, Integer> f = Integer::valueOf; // có thể lỗi tùy ngữ cảnh
Function<String, Integer> f = Integer::parseInt; // rõ hơn nếu chỉ cần String→int
```

```java
list.stream().filter(Objects::nonNull).map(String::toUpperCase);
```

---

## 8. Checked exceptions trong lambda

Hầu hết SAM trong `java.util.function` (**không** khai báo checked). Lambda/`::` gọi method `throws IOException` → **lỗi compile** trừ khi bắt trong body.

```java
// Không compile nếu Files.readAllBytes throws IOException chưa bắt
// Function<String, byte[]> bad = path -> Files.readAllBytes(Path.of(path));

Function<String, byte[]> readAll = path -> {
    try {
        return Files.readAllBytes(Path.of(path));
    } catch (IOException e) {
        throw new UncheckedIOException(e);
    }
};
```

| Chiến lược | Khi nào |
|------------|---------|
| Bọc `UncheckedIOException` / domain unchecked | Stream / `Function` / API functional chuẩn |
| SAM tự viết `throws E` | API riêng — caller phải handle |
| `Callable` / `Throwing*` helper | Có `throws Exception` sẵn hoặc thư viện nội bộ |
| Không nuốt empty catch | Luôn giữ cause — [exceptions.md](exceptions.md) |

```java
@FunctionalInterface
interface ThrowingFunction<T, R> {
    R apply(T t) throws Exception;
}

static <T, R> Function<T, R> unchecked(ThrowingFunction<T, R> f) {
    return t -> {
        try {
            return f.apply(t);
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    };
}
```

---

## 9. `Comparator` & sắp xếp

```java
users.sort(Comparator.comparing(User::name));
users.sort(Comparator.comparingInt(User::age).reversed());
users.sort(
    Comparator.comparing(User::department)
              .thenComparing(User::name)
);

Comparator<String> nullsLast = Comparator.nullsLast(String::compareToIgnoreCase);
```

`Comparable` = thứ tự tự nhiên; `Comparator` = chiến lược ngoài — hay kết hợp method reference.
Tránh `(a,b) -> a.size() - b.size()` (overflow) — dùng `Integer.compare` / `comparingInt`.

---

## 10. Liên hệ với `Optional`

```java
Optional<User> user = find(id);

user.ifPresent(u -> System.out.println(u.name()));
String label = user.map(User::name).orElse("unknown");
User u = user.filter(User::active).orElseThrow();
optional.or(() -> Optional.of(defaultUser()));
```

- Prefer `map` / `flatMap` / `filter` / `orElse` / `orElseGet` / `orElseThrow`.
- `orElse(expensive())` **luôn** đánh giá đối số — dùng `orElseGet(Supplier)`.
- Không dùng `Optional` làm field / parameter trừ khi team thống nhất.

---

## 11. Khác biệt ngắn với C# delegates

| | Java | C# |
|--|------|-----|
| Đơn vị | Functional **interface** (SAM) | **Delegate** type |
| Đa cast | Một abstract method | Multicast `+=` |
| Dựng sẵn | `Function`/`Predicate`/`Consumer`… | `Func`/`Action` |
| Method group | `Type::method` | Method group → delegate |
| Event | Listener / reactive libs | `event` + delegate |

Java không có multicast delegate tích hợp — danh sách listener hoặc composition `Consumer` thủ công.

---

## 12. Pitfalls (Bẫy)

1. **Gán lại local sau khi capture** — mất effectively final.
2. **Capture `this` trong listener dài hạn** — memory leak.
3. **Checked trong `map`/`forEach`** — phải bọc unchecked hoặc helper.
4. **Method ref ambiguous overload** — compile error khó đọc.
5. **`orElse(expensive())`** — luôn tạo object; dùng `orElseGet`.
6. **Side-effect trong `Stream.map`** — khó đoán; side-effect → `forEach` / phương thức rõ tên.
7. **`var` + lambda** không target — lỗi suy kiểu.
8. **Trừ độ dài trong `Comparator`** — overflow `int`; dùng `comparingInt`.
9. **Nhầm bound/unbound `::`** — sai arity.
10. **Empty catch trong lambda** — nuốt I/O lỗi — [exceptions.md](exceptions.md).

---

## 13. Best practices

1. Lambda ngắn; logic dài → method riêng + `this::helper`.
2. Tránh capture nặng / circular reference với listener dài hạn.
3. Hot path: primitive specialized (`IntPredicate`…) giảm boxing.
4. Đừng sợ lambda trên virtual threads — chi phí chính thường là I/O.
5. Checked: bọc có cause hoặc SAM `throws` có chủ đích — không empty catch.
6. `Stream` + lambda: nhớ terminal operation; tránh side-effect trong `map`.
7. Prefer `::` khi ủy quyền thuần; giữ lambda khi cần adapt.
8. Unnamed `_` (22+) cho param bỏ qua.

```text
□ effectively final rõ; không “ref cell” trừ Atomic*
□ checked → UncheckedIOException / helper
□ Comparator: comparingInt / Integer.compare
□ orElseGet khi tạo đắt
□ method ref không ambiguous
```

---

## 14. Cheat sheet

```java
import java.util.*;
import java.util.function.*;

public class LambdaCheatSheet {
    record User(String name, int age) {}

    public static void main(String[] args) {
        List<User> users = new ArrayList<>(List.of(
            new User("Ada", 36),
            new User("Linus", 54)
        ));

        Predicate<User> adult = u -> u.age() >= 18;
        Function<User, String> name = User::name;
        Consumer<String> print = System.out::println;
        Supplier<User> anon = () -> new User("anon", 0);
        UnaryOperator<String> shout = s -> s.toUpperCase(Locale.ROOT);
        BinaryOperator<Integer> sum = Integer::sum;

        users.stream()
             .filter(adult)
             .sorted(Comparator.comparing(User::name))
             .map(name.andThen(shout))
             .forEach(print);

        Optional.of(anon.get())
                .map(User::name)
                .ifPresent(print);

        System.out.println(sum.apply(2, 3));
    }
}
```

---

## Xem thêm

| File | Liên quan |
|------|-----------|
| [methods.md](methods.md) | Method refs, overload |
| [statements.md](statements.md) | Effectively final, blocks |
| [streams.md](streams.md) | Pipeline functional |
| [exceptions.md](exceptions.md) | Wrap checked / cause |
| [collections-generics.md](collections-generics.md) | `removeIf`, sort |
| [async.md](async.md) | `CompletableFuture` + lambda |
| [java25.md](java25.md) | LTS notes |

---

*Tham chiếu nhanh — Java 25 LTS. Lambda/method ref từ 8; `var` trong lambda params từ 11; unnamed `_` từ 22.*
