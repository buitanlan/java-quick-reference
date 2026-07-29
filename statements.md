# Phát biểu (Statements) trong Java

Tài liệu tham khảo các **statement** trong **Java 25 LTS**: khối, khai báo, rẽ nhánh (pattern matching & switch expression),
vòng lặp, nhảy (`yield` vs `return`), try-with-resources, nhãn, và `synchronized`.

> Cross-link: [operators.md](operators.md) · [keywords.md](keywords.md) · [exceptions.md](exceptions.md) ·
> [oop.md](oop.md) (sealed) · [lambdas-functional.md](lambdas-functional.md) · [java25.md](java25.md)

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
- [13. Pitfalls (Bẫy)](#13-pitfalls-bẫy)
- [14. Best practices & checklist](#14-best-practices--checklist)
- [Phụ lục: Ví dụ tổng hợp](#phụ-lục-ví-dụ-tổng-hợp)
- [Xem thêm](#xem-thêm)

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

- `case null` tách biệt (hành vi null cần khai báo rõ với pattern switch).
- `when` = guard — **không** tham gia exhaustiveness như một type riêng.
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

### 5.5 Exhaustiveness traps (sealed / enum / patterns)

Switch **expression** (và statement dạng pattern hiện đại) yêu cầu phủ hết miền giá trị — hoặc `default` / `case null` khi cần.

| Tình huống | Bẫy | Cách tránh |
|------------|-----|------------|
| `sealed` + `default` | `default` **nuốt** subtype mới → mất cảnh báo khi thêm `permits` | Bỏ `default` khi sealed đủ nhánh; để compiler báo thiếu case |
| `enum` + `default` | Tương tự — thêm hằng enum không còn lỗi compile | Switch expression không `default` nếu muốn fail-at-compile |
| Chỉ `when` guards | `case String s when …` **không** làm exhaust `String` | Cần thêm `case String s` không guard (hoặc `default`) |
| `case null` thiếu | Switch trên reference + pattern có thể NPE / lỗi null-hostility tùy dạng | Khai báo `case null` tường minh khi null hợp lệ |
| Dominance / thứ tự | Case cụ thể sau case tổng quát → lỗi “dominated” | Đặt pattern hẹp / guarded **trước** pattern rộng |
| Nested record pattern | Thiếu nhánh lồng → không exhaust | Phủ mọi combination hoặc `default` có chủ đích |
| Preview primitives (JEP 507) | Exhaust với primitive boxes dễ nhầm | Cô lập `--enable-preview`; xem [§6](#6-pattern-matching--jep-507-preview) |

```java
enum Color { RED, GREEN, BLUE }

// Tốt khi muốn compiler bắt Color mới:
String hex(Color c) {
    return switch (c) {
        case RED -> "#f00";
        case GREEN -> "#0f0";
        case BLUE -> "#00f";
        // không default
    };
}

// Nguy hiểm: default che hằng mới
String hexLoose(Color c) {
    return switch (c) {
        case RED -> "#f00";
        default -> "#000"; // thêm GREEN vẫn compile — có thể sai nghiệp vụ
    };
}
```

```java
// Dominance: String tổng quát phải sau guarded
String label(Object o) {
    return switch (o) {
        case String s when s.isBlank() -> "blank";
        case String s -> "text";
        default -> "other";
    };
}
```

Sealed types: [oop.md](oop.md). Pattern `instanceof`: [operators.md](operators.md).

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

Thoát **method** (hoặc lambda / anonymous) — không “trả giá trị nhánh switch”.

### 8.3 `yield` vs `return`

`yield` chỉ trong **switch expression** (block branch) — đưa giá trị ra biểu thức `switch`, **không** thoát method.
Không phải iterator `yield` như C# / Python.

```java
int x = switch (n) {
    case 0, 1 -> 1;
    default -> {
        int a = fib(n - 1);
        int b = fib(n - 2);
        yield a + b; // giá trị của switch expression
    }
};
```

| | `yield` | `return` |
|--|---------|----------|
| Phạm vi | Switch **expression** (block `-> { }` hoặc `: … yield`) | Method / constructor / lambda body |
| Ý nghĩa | Kết quả nhánh → giá trị biểu thức `switch` | Kết thúc method (+ giá trị nếu non-void) |
| Trong switch statement cổ điển | Không dùng để “return method” | `return` vẫn thoát method ngay cả trong `case` |
| Arrow expression `case … -> expr` | Không cần `yield` — `expr` đã là giá trị | — |

```java
// Sai tư duy: return trong block switch expression thoát METHOD, không phải chỉ nhánh
int bad(int n) {
    return switch (n) {
        case 1 -> {
            // return 1;  // hợp lệ nhưng thoát bad(), không “yield cho switch”
            yield 1;
        }
        default -> 0;
    };
}
```

- Switch expression dạng `case … -> { … }` **bắt buộc** `yield` (hoặc `throw`) cho mọi đường ra giá trị.
- Nhầm `return` / `yield` → bug kiểm soát luồng khó thấy trong nested switch.

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
        if (skip(j)) continue outer; // nhảy tới lần lặp i kế tiếp
        use(i, j);
    }
}
```

### 10.1 Pitfalls label `break` / `continue`

| Bẫy | Chi tiết |
|-----|----------|
| Nhầm `break` vs `break label` | `break` chỉ thoát vòng **trong cùng**; thiếu label → vòng ngoài chạy tiếp |
| `continue outer` | Bỏ phần còn lại vòng ngoài **và** tăng/iterator vòng ngoài — dễ skip logic cleanup giữa hai vòng |
| Label không gắn loop | Label gắn block/`switch` — `continue label` chỉ hợp lệ khi label là vòng lặp |
| Đọc khó / refactor gãy | Đổi cấu trúc nested → label trỏ sai ý; IDE rename không luôn làm rõ luồng |
| Thay bằng method | Thường rõ hơn: `return` / `boolean found` / early exit helper |

```java
// break không label — chỉ thoát vòng j
for (int i = 0; i < rows; i++) {
    for (int j = 0; j < cols; j++) {
        if (bad(i, j)) break; // i vẫn tiếp tục
    }
}
```

Dùng sparingly — ưu tiên method riêng + `return` khi nested sâu.

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

## 13. Pitfalls (Bẫy)

1. **Quên `break` trong switch statement cổ điển** — fall-through âm thầm.
2. **`default` nuốt sealed/enum** — mất exhaustiveness; subtype/hằng mới không còn lỗi compile.
3. **Guard `when` tưởng đã phủ type** — vẫn cần case type không guard hoặc `default`.
4. **`yield` vs `return`** — `return` thoát method; `yield` chỉ kết thúc nhánh switch expression.
5. **`break` thiếu label** trong nested loop — chỉ thoát vòng trong.
6. **`continue outer`** skip cleanup / logic giữa hai vòng — khó review.
7. **`for (...);` empty statement** — thân vòng “dính” câu sau; xem §12.
8. **Sửa collection trong enhanced-for** — `ConcurrentModificationException` (fail-fast).
9. **Gán biến vòng enhanced-for** — không đổi phần tử collection; cần `ListIterator` / index.
10. **`assert` làm validation API** — tắt mặc định (`-ea`); không thay `IllegalArgumentException`.
11. **JEP 507 preview** trộn production không flag — build lệch môi trường.
12. **`synchronized` + I/O dài** trên virtual threads — nguy cơ pinning / giữ monitor lâu.

---

## 14. Best practices & checklist

1. Ưu tiên **switch expression** + patterns thay switch cổ điển fall-through.
2. **Sealed + records** → để compiler bắt thiếu case; tránh `default` trừ khi cố ý.
3. `var` khi kiểu bên phải đã rõ; tránh `var` làm mờ API quan trọng.
4. Prefer try-with-resources hơn `finally` đóng tay — [exceptions.md](exceptions.md).
5. Label `break`/`continue` chỉ khi nested thật sự cần — cân nhắc method + `return`.
6. Đánh dấu **JEP 507 preview**; cô lập `--enable-preview` — [java25.md](java25.md).
7. Blocking loops + virtual threads: tốt I/O-bound fan-out; CPU-bound cần pool hợp lý.
8. Unnamed `_` (22+) khi discard — [keywords.md](keywords.md) · [literals.md](literals.md).

```text
□ switch expression: đủ nhánh / không default nuốt sealed|enum
□ yield chỉ trong switch expression; return = thoát method
□ nested loop: label có chủ đích hoặc extrmethod
□ try-with-resources cho AutoCloseable
□ không for (...);
□ preview JEP 507 có flag rõ
```

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

---

## Xem thêm

| File | Liên quan |
|------|-----------|
| [operators.md](operators.md) | `instanceof`, `?:`, precedence |
| [keywords.md](keywords.md) | `if` `switch` `for` `yield` `_` |
| [exceptions.md](exceptions.md) | `try` / try-with-resources |
| [oop.md](oop.md) | Sealed, records — exhaustiveness |
| [lambdas-functional.md](lambdas-functional.md) | Effectively final trong block |
| [java25.md](java25.md) | Preview patterns, LTS |

---

*Tham chiếu nhanh — Java 25 LTS. Switch expression 14+; pattern switch 21; unnamed `_` 22+; JEP 507 preview trên 25.*
