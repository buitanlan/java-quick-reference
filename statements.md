# Phát biểu (Statements) trong Java

Tài liệu tham khảo các **statement** trong **Java 25 LTS**: khối, khai báo, rẽ nhánh (gồm pattern matching & switch expression), vòng lặp, nhảy, try-with-resources, nhãn, và `synchronized`.

---

## Mục lục

- [1. Tổng quan & phân loại](#1-tổng-quan--phân-loại)
- [2. Khối lệnh `{ ... }`, phạm vi & lifetime](#2-khối-lệnh----phạm-vi--lifetime)
- [3. Declaration statements](#3-declaration-statements)
- [4. Expression statements](#4-expression-statements)
- [5. Selection: `if` / `else`, `switch`](#5-selection-if--else-switch)
- [6. Pattern matching & JEP 507 (preview)](#6-pattern-matching--jep-507-preview)
- [7. Iteration: `for` / enhanced-for / `while` / `do`](#7-iteration-for--enhanced-for--while--do)
- [8. Jump: `break` / `continue` / `return` / `yield` / `throw` / `assert`](#8-jump-break--continue--return--yield--throw--assert)
- [9. Exception & resource: `try` / try-with-resources](#9-exception--resource-try--try-with-resources)
- [10. Labeled statements](#10-labeled-statements)
- [11. `synchronized` statement](#11-synchronized-statement)
- [12. Empty statement](#12-empty-statement)
- [13. Mẹo & best practices](#13-mẹo--best-practices)

---

## 1. Tổng quan & phân loại

- **Statement**: đơn vị thực thi (khác *expression* — biểu thức cho giá trị).
- Nhóm chính trong Java:
  - **Declaration**: biến local, class/interface local (hiếm), …
  - **Expression**: gọi method, gán, `++`/`--`, tạo object…
  - **Selection**: `if`/`else`, `switch` (statement & expression, pattern matching)
  - **Iteration**: `while`, `do`, `for`, enhanced-for
  - **Jump**: `break`, `continue`, `return`, `yield`, `throw`, `assert`
  - **Exception & resource**: `try`/`catch`/`finally`, try-with-resources
  - **Synchronization**: `synchronized (obj) { }`
  - **Labeled / empty**

Không có top-level statements kiểu C# 9; entry điểm vẫn là `main` (hoặc launcher hiện đại / compact source files ở phiên bản gần đây — xem docs JDK khi dùng tính năng preview/incubating riêng).

---

## 2. Khối lệnh `{ ... }`, phạm vi & lifetime

- `{ ... }` tạo **block scope** cho biến local.
- Biến local phải được **definitely assigned** trước khi đọc.
- Java **không cho shadow** biến local cùng tên trong nested block của cùng method theo kiểu tự do như một số ngôn ngữ — nested block không được tái khai báo cùng tên với biến đã có trong scope bao ngoài (trong cùng method).

```java
int x = 1;
{
    int y = x + 1;
    // y chỉ sống trong khối
}
// y không còn ở đây
```

---

## 3. Declaration statements

### 3.1 Biến local & `var`

```java
int n = 42;
final String name = "Ada";
var list = new ArrayList<String>(); // suy luận ArrayList<String>
```

- `var` (Java 10+): chỉ local (và index enhanced-for / try-with-resources); initializer bắt buộc (trừ vài trường hợp đặc biệt như `var` với anonymous? — thực tế `var` cần initializer có kiểu đứng được).
- **Effectively final**: biến không gán lại → lambda/inner class có thể capture.

### 3.2 Unnamed variables `_` (Java 22+)

```java
for (var _ : items) {
    counter++;
}
try (var _ = lock.open()) {
    work();
}
```

### 3.3 Local classes / local records (tóm tắt)

Có thể khai báo class/enum/record bên trong method — ít dùng; hữu ích cho adapter cục bộ.

```java
void handle() {
    record Pair(String a, String b) {}
    var p = new Pair("x", "y");
}
```

---

## 4. Expression statements

Các biểu thức được phép đứng thành statement: gán, invoke, `new`, `++`/`--`.

```java
list.add("x");
x = y + 1;
i++;
new Object(); // hợp lệ nhưng vô nghĩa nếu bỏ reference
```

Biểu thức thuần (như `a + b;`) **không** phải statement hợp lệ.

---

## 5. Selection: `if` / `else`, `switch`

### 5.1 `if` / `else`

Điều kiện phải là `boolean` (không có “truthy” kiểu JS).

```java
if (user != null && user.active()) {
    greet(user);
} else if (user == null) {
    greetGuest();
} else {
    reject();
}
```

**Pattern matching với `instanceof` (Java 16+):**

```java
if (obj instanceof String s && s.length() > 3) {
    System.out.println(s.toUpperCase());
}
```

Biến pattern `s` chỉ trong scope khi pattern khớp (flow scoping).

### 5.2 `switch` statement (cổ điển)

```java
switch (code) {
    case 200:
        System.out.println("OK");
        break;
    case 404:
    case 410:
        System.out.println("Missing");
        break;
    default:
        System.out.println("Other");
}
```

Quên `break` → fall-through (cố ý hoặc lỗi).

### 5.3 `switch` expression (Java 14+)

- Mọi nhánh phải cho giá trị (hoặc `throw`).
- Arrow `->` không fall-through; block dùng `yield`.

```java
String label = switch (code) {
    case 200 -> "OK";
    case 404, 410 -> "Missing";
    case 500 -> {
        logServerError();
        yield "Server";
    }
    default -> "Other";
};
```

### 5.4 Pattern matching trong `switch` (Java 21 chuẩn)

```java
static String describe(Object o) {
    return switch (o) {
        case null -> "null";
        case String s when s.isBlank() -> "blank";
        case String s -> "string:" + s;
        case Integer i -> "int:" + i;
        case int[] arr -> "int[" + arr.length + "]";
        case Point(int x, int y) -> "point(%d,%d)".formatted(x, y);
        case Shape s -> "shape:" + s;
        default -> o.getClass().getName();
    };
}

record Point(int x, int y) {}
```

- `case null` tách biệt (không còn NPE mặc định khi switch trên reference — hành vi null cần khai báo rõ từ các phiên bản pattern switch).
- `when` = guard.
- Record / sealed hierarchies giúp compiler kiểm tra **exhaustiveness**.

```java
sealed interface Shape permits Circle, Rect {}
record Circle(double r) implements Shape {}
record Rect(double w, double h) implements Shape {}

double area(Shape s) {
    return switch (s) {
        case Circle c -> Math.PI * c.r() * c.r();
        case Rect r -> r.w() * r.h();
    }; // đủ nhánh — không cần default
}
```

---

## 6. Pattern matching & JEP 507 (preview)

### 6.1 Pattern phổ biến (ổn định)

| Pattern | Ví dụ |
|---------|--------|
| Type pattern | `case String s` |
| Guarded | `case String s when s.length() > 3` |
| Record pattern | `case Point(int x, int y)` |
| Unnamed | `case Point(_, int y)` |
| Nested | `case Box(Point(int x, _))` |

```java
if (obj instanceof Point(int x, int y) && x == y) {
    System.out.println("diagonal " + x);
}
```

### 6.2 JEP 507 — Primitive Types in Patterns, `instanceof`, and `switch` (**Third Preview · Java 25**)

> **PREVIEW** — cần biên dịch/chạy với `--enable-preview` (và thường `--source 25` / `--release 25` tùy tool). API/semantics có thể đổi trước khi thành chuẩn.

Cho phép pattern / `instanceof` / `switch` với **kiểu nguyên thủy**, kèm kiểm tra **độ chính xác khi chuyển đổi** (ví dụ `int` có khớp `byte` không mất mát?).

```java
// PREVIEW — JEP 507 (Java 25, Third Preview)
Object value = 42;

if (value instanceof byte b) {
    // chỉ true nếu giá trị khớp byte chính xác
    System.out.println(b);
}

String kind = switch (value) {
    case byte b -> "byte:" + b;
    case int i -> "int:" + i;
    case long l -> "long:" + l;
    case double d -> "double:" + d;
    case boolean bo -> "boolean:" + bo;
    default -> "other";
};
```

**Ý nghĩa thực dụng:** xử lý boxed/`Object`/`Number` thống nhất hơn; tránh ép kiểu tay rồi kiểm tra range. Khi viết thư viện production LTS, cân nhắc chờ standardized hoặc cô lập code preview sau flag.

---

## 7. Iteration: `for` / enhanced-for / `while` / `do`

### 7.1 `while` / `do`

```java
while (scanner.hasNext()) {
    process(scanner.next());
}

do {
    attempt++;
} while (!ready() && attempt < 3);
```

### 7.2 `for` cổ điển

```java
for (int i = 0; i < n; i++) {
    System.out.println(i);
}

for (int i = 0, j = n - 1; i < j; i++, j--) {
    swap(a, i, j);
}
```

### 7.3 Enhanced-for

```java
for (String s : list) {
    System.out.println(s);
}

for (char c : "hi".toCharArray()) {
    // ...
}
```

- Iterable hoặc mảng. Biến vòng lặp là bản sao tham chiếu/giá trị — **không** gán lại phần tử collection qua biến đó.
- Sửa cấu trúc collection khi đang duyệt → `ConcurrentModificationException` (fail-fast iterator).

### 7.4 Gợi ý virtual threads (liên quan vòng lặp I/O)

Vòng lặp blocking I/O có thể chạy trên **virtual threads** (`Thread.startVirtualThread`, `Executors.newVirtualThreadPerTaskExecutor`) để scale số lượng task — đây là mô hình concurrency, không phải cú pháp vòng lặp mới.

```java
try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
    for (var url : urls) {
        exec.submit(() -> fetch(url));
    }
}
```

---

## 8. Jump: `break` / `continue` / `return` / `yield` / `throw` / `assert`

### 8.1 `break` / `continue`

```java
for (int i = 0; i < 100; i++) {
    if (i % 2 == 0) continue;
    if (i > 50) break;
    consume(i);
}
```

Có dạng có nhãn — xem mục 10.

### 8.2 `return`

```java
public int find(int[] a, int key) {
    for (int v : a) {
        if (v == key) return v;
    }
    return -1;
}
```

### 8.3 `yield`

Chỉ trong **switch expression** (block branch), không phải iterator như C#.

```java
int x = switch (n) {
    case 0, 1 -> 1;
    default -> {
        int a = fib(n - 1);
        int b = fib(n - 2);
        yield a + b;
    }
};
```

### 8.4 `throw`

```java
if (arg == null) {
    throw new IllegalArgumentException("arg");
}
```

### 8.5 `assert`

```java
assert invariant() : "invariant broken";
```

Bật bằng `-ea`. Không thay validation API công khai.

---

## 9. Exception & resource: `try` / try-with-resources

### 9.1 `try` / `catch` / `finally`

```java
try {
    work();
} catch (IOException e) {
    log(e);
} catch (Exception e) {
    log(e);
    throw e;
} finally {
    cleanup();
}
```

### 9.2 Multi-catch

```java
catch (IOException | SQLException e) {
    // e effectively final, kiểu giao gần nhất (Alternatives)
}
```

### 9.3 Try-with-resources

Resource phải là `AutoCloseable` / `Closeable`. Đóng theo thứ tự ngược khai báo; exception khi đóng có thể thành **suppressed**.

```java
try (var in = Files.newBufferedReader(path);
     var out = Files.newBufferedWriter(outPath)) {
    in.transferTo(out);
} // tự close
```

`var` trong try-with-resources được hỗ trợ. Unnamed: `try (var _ = open()) { ... }`.

Chi tiết hierarchy / best practices: xem `exceptions.md`.

---

## 10. Labeled statements

Java không có `goto`, nhưng có **label** cho `break`/`continue`:

```java
outer:
for (int i = 0; i < rows; i++) {
    for (int j = 0; j < cols; j++) {
        if (bad(i, j)) break outer;
        if (skip(j)) continue outer; // lần i kế
        use(i, j);
    }
}
```

Dùng sparingly — thường refactor thành method/`return` rõ hơn.

---

## 11. `synchronized` statement

```java
synchronized (lock) {
    // critical section trên monitor của lock
    balance += delta;
}
```

- `synchronized` method ≡ `synchronized (this)` (instance) hoặc `synchronized (Foo.class)` (static).
- Đảm bảo mutual exclusion + happens-before khi vào/ra monitor.
- Tránh deadlock: luôn chiếm lock theo thứ tự cố định; giữ section ngắn.
- Virtual threads: vẫn dùng được; tránh I/O lâu trong monitor nếu có thể (carrier pinning với một số native frame / synchronized trong quá khứ — theo dõi hướng dẫn JDK hiện tại).

---

## 12. Empty statement

`;` đơn là empty statement — hợp lệ nhưng dễ lỗi (`for (...);`).

```java
for (int i = 0; i < n; i++); // BUG thường gặp: vòng lặp rỗng
    sum += i;
```

---

## 13. Mẹo & best practices

1. Ưu tiên **switch expression** + patterns thay switch cổ điển fall-through.
2. Dùng **sealed + records** để `switch` exhaustiveness — bớt `default` “nuốt” case mới.
3. `var` khi kiểu bên phải đã rõ; tránh `var` làm mờ API quan trọng.
4. Prefer try-with-resources hơn `finally` đóng tay.
5. Label `break`/`continue` chỉ khi nested loop thật sự cần — cân nhắc method riêng.
6. Đánh dấu rõ code **JEP 507 preview**; đừng trộn vào module ổn định nếu chưa chấp nhận flag preview.
7. Blocking loops + virtual threads: tốt cho I/O-bound fan-out; CPU-bound vẫn cần pool kích thước hợp lý.

---

## Phụ lục: Ví dụ tổng hợp

```java
public final class StatementDemo {

    public static int parseCode(Object payload) {
        return switch (payload) {
            case null -> 0;
            case String s when s.matches("\\d+") -> Integer.parseInt(s);
            case String _ -> -1;
            case Integer i -> i;
            case Point(int x, int y) -> x + y;
            default -> throw new IllegalArgumentException("unsupported");
        };
    }

    public static void copy(Path from, Path to) throws IOException {
        try (var in = Files.newInputStream(from);
             var out = Files.newOutputStream(to)) {
            in.transferTo(out);
        }
    }

    record Point(int x, int y) {}
}
```
