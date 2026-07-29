# Lambda & Functional interface trong Java

Tài liệu tham khảo **lambda**, **functional interfaces**, **method references**, và mối liên hệ với `Comparator` / `Optional` trên **Java 25 LTS**.

> Đọc thêm: `methods.md` (method references tổng quan), `statements.md` (effectively final), API Stream (ngoài phạm vi file này nhưng dùng chung functional style).

---

## Mục lục

1. [Lambda là gì?](#1-lambda-là-gì)
2. [Cú pháp lambda](#2-cú-pháp-lambda)
3. [Target typing](#3-target-typing)
4. [Effectively final & capture](#4-effectively-final--capture)
5. [Functional interfaces dựng sẵn](#5-functional-interfaces-dựng-sẵn)
6. [Tự viết `@FunctionalInterface`](#6-tự-viết-functionalinterface)
7. [Method references `::`](#7-method-references-)
8. [`Comparator` & sắp xếp](#8-comparator--sắp-xếp)
9. [Liên hệ với `Optional`](#9-liên-hệ-với-optional)
10. [Khác biệt ngắn với C# delegates](#10-khác-biệt-ngắn-với-c-delegates)
11. [Hiệu năng & best practices](#11-hiệu-năng--best-practices)
12. [Cheat sheet](#12-cheat-sheet)

---

## 1. Lambda là gì?

- Biểu thức tạo **instance của functional interface** (đúng một method abstract).
- Thay anonymous class dài dòng cho callback, `Stream`, `CompletableFuture`, listener…
- Không phải kiểu first-class “function” độc lập như một số ngôn ngữ — luôn có **target type**.

```java
Runnable r = () -> System.out.println("hi");
r.run();
```

---

## 2. Cú pháp lambda

```java
// Không tham số
() -> System.out.println("go")

// Một tham số — có thể bỏ ()
x -> x * x
(x) -> x * x

// Nhiều tham số
(a, b) -> a + b

// Có kiểu tường minh / var (Java 11+)
(String s) -> s.length()
(var s) -> s.length()

// Block body
(s) -> {
    System.out.println(s);
    return s.length();
}
```

| Dạng thân | Quy tắc return |
|-----------|----------------|
| Expression body | Giá trị expression được return (trừ target `void`) |
| Block body | Dùng `return` tường minh nếu non-void; có thể `throw` |

Không có `async` lambda built-in như C#. Bất đồng bộ dùng `CompletableFuture`, virtual threads + blocking, hoặc structured concurrency APIs tùy phiên bản/JDK.

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

- Overload method nhận nhiều functional types khác nhau → đôi khi cần **cast** target:

```java
method((Function<String, String>) s -> s.trim());
```

- Lambda **không** có kiểu tự nhiên độc lập để gán `var` trong mọi trường hợp như C# 10 natural type — thường cần target rõ:

```java
// var x = s -> s.length(); // lỗi — không suy được
Function<String, Integer> x = s -> s.length();
```

---

## 4. Effectively final & capture

Lambda chỉ capture biến local nếu **final** hoặc **effectively final** (không gán lại sau khi khởi tạo).

```java
int factor = 2;
Function<Integer, Integer> mul = n -> n * factor; // OK

// factor = 3; // nếu bỏ comment → lỗi compile với lambda ở trên
```

- Capture instance field qua `this` — cẩn thận leak vòng đời (listener giữ object).
- Không expect “ref cell” như biến mutable từ ngoài; dùng array một phần tử / `AtomicInteger` khi thật sự cần (thường là smell).

```java
var sum = new AtomicInteger();
list.forEach(n -> sum.addAndGet(n));
```

---

## 5. Functional interfaces dựng sẵn

Package `java.util.function` — hay dùng nhất:

| Interface | Method abstract | Ý nghĩa |
|-----------|-----------------|--------|
| `Supplier<T>` | `T get()` | Cung cấp giá trị |
| `Consumer<T>` | `void accept(T)` | Tiêu thụ |
| `BiConsumer<T,U>` | `void accept(T,U)` | Tiêu thụ 2 args |
| `Predicate<T>` | `boolean test(T)` | Điều kiện |
| `BiPredicate<T,U>` | `boolean test(T,U)` | |
| `Function<T,R>` | `R apply(T)` | Ánh xạ |
| `BiFunction<T,U,R>` | `R apply(T,U)` | |
| `UnaryOperator<T>` | `T apply(T)` | `Function<T,T>` |
| `BinaryOperator<T>` | `T apply(T,T)` | `BiFunction<T,T,T>` |

Biến thể primitive (tránh boxing): `IntSupplier`, `LongPredicate`, `ObjIntConsumer`, `ToIntFunction`, …

```java
Predicate<String> nonEmpty = s -> s != null && !s.isEmpty();
Function<String, Integer> len = String::length;
UnaryOperator<String> trim = String::trim;
Supplier<Instant> now = Instant::now;
Consumer<String> log = System.out::println;

BinaryOperator<Integer> max = Integer::max;
```

**Composition** có sẵn:

```java
Predicate<String> p = nonEmpty.and(s -> s.length() > 3).negate();
Function<String, String> pipe = trim.andThen(String::toUpperCase);
```

`Runnable` / `Callable<V>` cũng là functional interfaces (package khác).

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

- Annotation **không bắt buộc** nhưng giúp compiler báo nếu vô tình thêm abstract method thứ hai.
- Được phép có nhiều `default`/`static`/`private` methods.

---

## 7. Method references `::`

### 7.1 Bốn dạng

```java
// 1) Static
Function<String, Integer> parse = Integer::parseInt;

// 2) Bound instance
var printer = System.out;
Consumer<String> c = printer::println;

// 3) Unbound instance — tham số đầu là receiver
Function<String, Integer> len = String::length;
BiPredicate<String, String> eq = String::equals;

// 4) Constructor / array
Supplier<List<String>> lists = ArrayList::new;
Function<Integer, int[]> arr = int[]::new;
Function<String, User> ctor = User::new; // User(String)
```

### 7.2 Khi nào chọn `::` thay lambda?

- Body chỉ ủy quyền một method → `::` ngắn và rõ.
- Cần adapt nhẹ (đổi thứ tự, null-check) → giữ lambda.

```java
// rõ
list.stream().map(String::trim);

// cần logic → lambda
list.stream().map(s -> s == null ? "" : s.trim());
```

---

## 8. `Comparator` & sắp xếp

`Comparator<T>` là functional interface (`compare(T,T)`).

```java
List<User> users = ...;

users.sort(Comparator.comparing(User::name));
users.sort(Comparator.comparingInt(User::age).reversed());
users.sort(
    Comparator.comparing(User::department)
              .thenComparing(User::name)
);

Comparator<String> byLen = Comparator.comparingInt(String::length);
Comparator<String> nullsLast = Comparator.nullsLast(String::compareToIgnoreCase);
```

`Comparable` = thứ tự tự nhiên trên chính type; `Comparator` = chiến lược bên ngoài — hay kết hợp method reference.

---

## 9. Liên hệ với `Optional`

`Optional` dùng functional style để tránh `null` phân tán (không thay mọi null).

```java
Optional<User> user = find(id);

user.ifPresent(u -> System.out.println(u.name()));
String label = user.map(User::name).orElse("unknown");
User u = user.filter(User::active).orElseThrow();

optional.or(() -> Optional.of(defaultUser()));
```

- Prefer `map` / `flatMap` / `filter` / `orElse` / `orElseGet` / `orElseThrow`.
- `orElse(expensive())` **luôn** đánh giá đối số — dùng `orElseGet(Supplier)` khi tạo đắt.
- Không dùng `Optional` làm field / parameter trừ khi API thật sự “có thể vắng” và team thống nhất.

---

## 10. Khác biệt ngắn với C# delegates

| | Java | C# |
|--|------|-----|
| Đơn vị | Functional **interface** (SAM) | **Delegate** type |
| Đa cast | Một abstract method | Multicast `+=` / invocation list |
| Dựng sẵn | `Function`/`Predicate`/`Consumer`… | `Func`/`Action`/`Predicate` |
| Method group | `Type::method` | Method group → delegate |
| Event | Listener / reactive libs | `event` + delegate |

Java không có multicast delegate tích hợp — dùng danh sách listener hoặc `Consumer` composition thủ công nếu cần nhiều handler.

---

## 11. Hiệu năng & best practices

1. Lambda ngắn; logic dài → method riêng + `this::helper`.
2. Tránh capture nặng / circular reference với listener dài hạn.
3. Hot path: cân nhắc primitive specialized (`IntPredicate`…) để giảm boxing.
4. Đừng sợ lambda trên virtual threads — chi phí chính thường là I/O, không phải syntax.
5. Exception checked trong lambda: functional interfaces chuẩn **không** khai báo checked — bọc unchecked hoặc dùng helper / thư viện (`ThrowingFunction` tự viết).
6. `Stream` + lambda: nhớ terminal operation; tránh side-effect khó đoán trong `map`.

```java
// Checked exception trong lambda — pattern bọc
Function<String, byte[]> readAll = path -> {
    try {
        return Files.readAllBytes(Path.of(path));
    } catch (IOException e) {
        throw new UncheckedIOException(e);
    }
};
```

---

## 12. Cheat sheet

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
