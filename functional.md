# Lập trình hàm & Data-Oriented Programming (DOP) trong Java

Tài liệu tham khảo phong cách **functional & Data-Oriented Programming (DOP)** trên **Java 27**: immutability, **Algebraic Data Types (ADT)** với `sealed` + `record`, exhaustive pattern matching, xử lý lỗi theo kiểu dữ liệu (`Optional` & `Result<T, E>`), hàm bậc cao / composition, và pipeline với `Stream` / `Gatherer`.

Java không phải ngôn ngữ thuần hàm như Haskell (không có tail-call optimization ở cấp JVM, không có higher-kinded types), nhưng từ Java 16–27 bộ ba **`record` + `sealed` + pattern matching** cùng **`Stream` / `Gatherer`** cho phép viết logic miền cực kỳ sạch, an toàn tại thời điểm biên dịch và dễ kiểm thử.

> Cross-link: [lambdas-functional.md](lambdas-functional.md) (cú pháp lambda, SAM, `::`) · [streams.md](streams.md) (Stream API, Collectors, Gatherers) · [oop.md](oop.md) (`sealed`, `record`) · [statements.md](statements.md) (pattern switch, exhaustiveness) · [exceptions.md](exceptions.md)

---

## Mục lục

- [1. Tư duy Functional & DOP trên Java 27](#1-tư-duy-functional--dop-trên-java-27)
  - [1.1 Expression Problem: OOP (Visitor/Polymorphism) vs DOP (`sealed` + `switch`)](#11-expression-problem-oop-visitorpolymorphism-vs-dop-sealed--switch)
- [2. Immutability & Transform thay vì Mutate](#2-immutability--transform-thay-vì-mutate)
- [3. Algebraic Data Types (ADT): `sealed` + `record`](#3-algebraic-data-types-adt-sealed--record)
  - [3.1 Product types (`record`) & Sum types (`sealed`)](#31-product-types-record--sum-types-sealed)
  - [3.2 Exhaustive pattern matching & deconstruction](#32-exhaustive-pattern-matching--deconstruction)
  - [3.3 Làm cho trạng thái bất hợp lệ không thể biểu diễn](#33-làm-cho-trạng-thái-bất-hợp-lệ-không-thể-biểu-diễn)
  - [3.4 Type-Safe State Machine & AST Recursive Transformation](#34-type-safe-state-machine--ast-recursive-transformation)
- [4. Xử lý vắng mặt & lỗi theo hướng Functional](#4-xử-lý-vắng-mặt--lỗi-theo-hướng-functional)
  - [4.1 `Optional` như monadic pipeline](#41-optional-như-monadic-pipeline)
  - [4.2 `Result<T, E>` (Sealed Union thay cho exception nghiệp vụ)](#42-resultt-e-sealed-union-thay-cho-exception-nghiệp-vụ)
  - [4.3 Fail-fast (`flatMap`) vs Accumulating Validation & `Result` với `Stream`](#43-fail-fast-flatmap-vs-accumulating-validation--result-với-stream)
  - [4.4 Khi nào chọn `Result` vs Exception?](#44-khi-nào-chọn-result-vs-exception)
- [5. Hàm thuần (Purity), Higher-Order Functions & Composition](#5-hàm-thuần-purity-higher-order-functions--composition)
- [6. Currying, Partial Application, Memoization & Lazy Evaluation](#6-currying-partial-application-memoization--lazy-evaluation)
- [7. Functional Pipelines với `Stream` & `Gatherer`](#7-functional-pipelines-với-stream--gatherer)
- [8. Giới hạn của Java với phong cách thuần hàm & Trampoline Pattern](#8-giới-hạn-của-java-với-phong-cách-thuần-hàm--trampoline-pattern)
- [9. Pitfalls (Bẫy)](#9-pitfalls-bẫy)
- [10. Best practices & Cheat sheet](#10-best-practices--cheat-sheet)
- [Xem thêm](#xem-thêm)

---

## 1. Tư duy Functional & DOP trên Java 27

4 nguyên tắc của **Data-Oriented Programming** (Brian Goetz) phù hợp tự nhiên với Java hiện đại:

1. **Mô hình hóa dữ liệu đúng như dữ liệu** (`record` bất biến, tách bạch dữ liệu khỏi hành vi hệ thống).
2. **Dữ liệu bất biến** (không mutate tại chỗ — tạo bản sao đã biến đổi).
3. **Kiểm tra invariant tại biên khởi tạo** (compact constructor của `record`).
4. **Làm cho trạng thái bất hợp lệ không thể biểu diễn** (`sealed` hierarchy thay cho các field nullable/flag rời rạc).

### 1.1 Expression Problem: OOP (Visitor/Polymorphism) vs DOP (`sealed` + `switch`)

Chọn OOP hay DOP là sự đánh đổi theo **trục thay đổi** của bài toán (*Expression Problem*):

| Chiều mở rộng | OOP (`interface` mở + virtual method) | DOP (`sealed` + `record` + pattern `switch`) |
|---|---|---|
| Thêm **kiểu dữ liệu mới** (vd. plugin, storage driver) | **Dễ** — viết class mới implement interface, không đụng code cũ | Phải thêm vào `permits` và cập nhật các `switch` (nhờ compiler báo đủ chỗ) |
| Thêm **phép toán mới** trên dữ liệu (vd. serialize, validate, render, audit) | **Khó** — phải sửa interface gốc hoặc viết boilerplate **Visitor pattern** | **Dễ** — viết thêm 1 hàm `switch (x)` độc lập, không đụng class dữ liệu |
| Phù hợp cho | Service boundaries, SPI/plugins, repositories, strategies mở | Domain events, commands, AST, state machines, wire DTO, kết quả nghiệp vụ |

**Thực hành hiện đại:** dùng **OOP** cho các thành phần hệ thống (services, clients, repositories) và **DOP** cho dữ liệu chảy qua hệ thống đó.

---

## 2. Immutability & Transform thay vì Mutate

```java
public record Order(String id, List<LineItem> items, Status status) {
    public Order {
        Objects.requireNonNull(id);
        items = List.copyOf(items); // defensive copy → bất biến thực sự (cấm null)
        Objects.requireNonNull(status);
    }

    // "Wither" pattern: trả về bản sao mới thay vì setter
    public Order withStatus(Status next) {
        return new Order(id, items, next);
    }

    public Order withAddedItem(LineItem item) {
        var next = new ArrayList<>(items);
        next.add(Objects.requireNonNull(item));
        return new Order(id, next, status);
    }
}
```

- **Tại sao ưu tiên bất biến:** tự nhiên thread-safe, an toàn làm key `Map`/`Set`, dễ suy luận và test (không có side-effect ẩn), kết hợp tự nhiên với Virtual Threads và `ScopedValue`.
- **Chi phí:** với object nhỏ ngắn hạn, Young GC / Escape Analysis xử lý rất nhanh; chỉ cân nhắc cấu trúc mutable cục bộ ở hot loop sau khi đo bằng JFR.

---

## 3. Algebraic Data Types (ADT): `sealed` + `record`

### 3.1 Product types (`record`) & Sum types (`sealed`)

- **Product type** (AND — có *cả* A *và* B): `record Point(int x, int y) {}`.
- **Sum type / Discriminated Union** (OR — *hoặc* A *hoặc* B *hoặc* C): `sealed interface` + `permits` các `record` / `enum`.

```java
public sealed interface PaymentMethod {
    record Card(String last4, YearMonth expiry) implements PaymentMethod {}
    record BankTransfer(String iban, String reference) implements PaymentMethod {}
    record Cash() implements PaymentMethod {}
}
```

*(Tất cả direct subtypes khai báo cùng file nên có thể lược bỏ mệnh đề `permits`.)*

### 3.2 Exhaustive pattern matching & deconstruction

```java
static String describe(PaymentMethod pm) {
    return switch (pm) {
        case PaymentMethod.Card(var last4, var exp) -> "Card ****" + last4 + " (" + exp + ")";
        case PaymentMethod.BankTransfer(var iban, _) -> "Transfer " + iban;
        case PaymentMethod.Cash() -> "Cash";
        // KHÔNG viết default → thêm subtype mới sẽ báo LỖI BIÊN DỊCH ngay!
    };
}
```

- Sử dụng unnamed pattern `_` (Java 22+) khi bỏ qua component không cần dùng.
- Deconstruction lồng nhau (`case Wrapper(Inner(var x, _))`) giúp đọc trực diện cấu trúc cây (AST, JSON, command/event).

### 3.3 Làm cho trạng thái bất hợp lệ không thể biểu diễn

```java
// TRÁNH — trạng thái lỏng lẻo (vừa có error, vừa có payload, hoặc cả hai null)
record BadResponse(String body, String errorMessage, boolean success) {}

// TỐT — trạng thái hợp lệ được compiler cưỡng chế
sealed interface FetchResult {
    record Ok(String body, int statusCode) implements FetchResult {}
    record HttpError(int statusCode, String reason) implements FetchResult {}
    record NetworkFailure(IOException cause) implements FetchResult {}
}
```

### 3.4 Type-Safe State Machine & AST Recursive Transformation

#### State Machine bất biến (chuyển trạng thái hợp lệ kiểm chứng lúc compile)

Mỗi trạng thái chỉ mang đúng dữ liệu tồn tại ở trạng thái đó — không thể tồn tại đơn hàng `Paid` mà thiếu `paymentId` hay đơn `Draft` lại có `trackingNumber`:

```java
public sealed interface OrderState {
    record Draft(List<LineItem> items) implements OrderState {
        public Draft { items = List.copyOf(items); }
        public Submitted submit(Instant at) {
            if (items.isEmpty()) throw new IllegalStateException("empty order");
            return new Submitted(items, at);
        }
    }

    record Submitted(List<LineItem> items, Instant submittedAt) implements OrderState {
        public Paid pay(String paymentId, Instant at) { return new Paid(items, paymentId, at); }
        public Cancelled cancel(String reason) { return new Cancelled(reason); }
    }

    record Paid(List<LineItem> items, String paymentId, Instant paidAt) implements OrderState {
        public Shipped ship(String trackingNo) { return new Shipped(paymentId, trackingNo); }
    }

    record Shipped(String paymentId, String trackingNo) implements OrderState {}
    record Cancelled(String reason) implements OrderState {}
}
```

#### AST & Nested Record Deconstruction (rút gọn biểu thức đại số)

Pattern lồng nhau kết hợp `when` giúp biểu đạt quy tắc biến đổi cây cực kỳ ngắn gọn (thay thế hoàn toàn Visitor pattern nhiều tầng):

```java
sealed interface Expr {
    record Const(double value) implements Expr {}
    record Var(String name) implements Expr {}
    record Add(Expr left, Expr right) implements Expr {}
    record Mul(Expr left, Expr right) implements Expr {}
}

static Expr simplify(Expr expr) {
    return switch (expr) {
        case Expr.Add(Expr.Const(var a), Expr.Const(var b)) -> new Expr.Const(a + b);
        case Expr.Add(var e, Expr.Const(var c)) when c == 0.0 -> simplify(e);
        case Expr.Add(Expr.Const(var c), var e) when c == 0.0 -> simplify(e);
        case Expr.Mul(_, Expr.Const(var c)) when c == 0.0 -> new Expr.Const(0.0);
        case Expr.Mul(Expr.Const(var c), _) when c == 0.0 -> new Expr.Const(0.0);
        case Expr.Mul(var e, Expr.Const(var c)) when c == 1.0 -> simplify(e);
        case Expr.Add(var l, var r) -> new Expr.Add(simplify(l), simplify(r));
        case Expr.Mul(var l, var r) -> new Expr.Mul(simplify(l), simplify(r));
        case Expr.Const c -> c;
        case Expr.Var v -> v;
    };
}
```

---

## 4. Xử lý vắng mặt & lỗi theo hướng Functional

### 4.1 `Optional` như monadic pipeline

```java
String city = findUser(id)
        .flatMap(User::address)          // Optional<Address>
        .map(Address::city)              // Optional<String>
        .filter(c -> !c.isBlank())
        .orElse("Unknown");
```

- Tránh `isPresent()` + `get()` (giống check `null` thủ công); dùng `map` / `flatMap` / `filter` / `or` / `orElseGet` / `ifPresentOrElse`.

### 4.2 `Result<T, E>` (Sealed Union thay cho exception nghiệp vụ)

JDK không có kiểu `Result<T, E>` dựng sẵn, nhưng với Java 21–27 chỉ cần ~25 dòng `sealed interface`:

```java
public sealed interface Result<T, E> {
    record Ok<T, E>(T value) implements Result<T, E> {}
    record Err<T, E>(E error) implements Result<T, E> {}

    static <T, E> Result<T, E> ok(T value) { return new Ok<>(value); }
    static <T, E> Result<T, E> err(E error) { return new Err<>(error); }

    default <U> Result<U, E> map(Function<? super T, ? extends U> fn) {
        return switch (this) {
            case Ok(var v) -> ok(fn.apply(v));
            case Err(var e) -> err(e);
        };
    }

    default <U> Result<U, E> flatMap(Function<? super T, Result<U, E>> fn) {
        return switch (this) {
            case Ok(var v) -> fn.apply(v);
            case Err(var e) -> err(e);
        };
    }

    default T orElseThrow(Function<? super E, ? extends RuntimeException> exFn) {
        return switch (this) {
            case Ok(var v) -> v;
            case Err(var e) -> throw exFn.apply(e);
        };
    }
}
```

Sử dụng theo phong cách *railway-oriented*:

```java
sealed interface OrderError {
    record InvalidQuantity(int qty) implements OrderError {}
    record OutOfStock(String sku) implements OrderError {}
}

Result<Receipt, OrderError> placeOrder(OrderRequest req) {
    return validate(req)
            .flatMap(this::reserveStock)
            .map(this::createReceipt);
}
```

### 4.3 Fail-fast (`flatMap`) vs Accumulating Validation & `Result` với `Stream`

- **`Result.flatMap` là fail-fast:** dừng ngay tại bước đầu tiên trả `Err`. Phù hợp cho chuỗi bước phụ thuộc nhau (validate → giữ tồn kho → thanh toán).
- **Accumulating Validation (Applicative style):** khi kiểm tra form/API payload có nhiều field độc lập, caller muốn nhận **toàn bộ danh sách lỗi** thay vì từng lỗi một:

```java
static Result<User, List<String>> validateUser(String email, int age) {
    var errors = new ArrayList<String>();
    if (email == null || !email.contains("@")) errors.add("invalid email");
    if (age < 18) errors.add("must be >= 18");
    return errors.isEmpty()
            ? Result.ok(new User(email.strip(), age))
            : Result.err(List.copyOf(errors));
}
```

#### Kết hợp `Result<T, E>` với `Stream` (gom hoặc dừng sớm)

```java
// 1. Chuyển List<Result<T, E>> → Result<List<T>, E> (sequence — fail-fast khi gặp Err đầu tiên)
static <T, E> Result<List<T>, E> sequence(List<Result<T, E>> results) {
    var values = new ArrayList<T>(results.size());
    for (var r : results) {
        switch (r) {
            case Result.Ok(var v) -> values.add(v);
            case Result.Err(var e) -> { return Result.err(e); }
        }
    }
    return Result.ok(List.copyOf(values));
}

// 2. Partition tách thành công / lỗi để xử lý batch (dead-letter queue)
record Partition<T, E>(List<T> successes, List<E> failures) {}

static <T, E> Partition<T, E> partition(Stream<Result<T, E>> stream) {
    var ok = new ArrayList<T>();
    var err = new ArrayList<E>();
    stream.forEach(r -> {
        switch (r) {
            case Result.Ok(var v) -> ok.add(v);
            case Result.Err(var e) -> err.add(e);
        }
    });
    return new Partition<>(List.copyOf(ok), List.copyOf(err));
}
```

### 4.4 Khi nào chọn `Result` vs Exception?

| Tình huống | Khuyến nghị |
|---|---|
| Lỗi nghiệp vụ dự kiến, caller phải rẽ nhánh rõ (hết hàng, sai voucher, vi phạm rule) | **`sealed` Result / Domain Union** (compiler ép caller xử lý đủ nhánh, không tốn chi phí stack trace) |
| Lỗi hạ tầng / bất khả kháng (mất kết nối DB, I/O hỏng, bug lập trình `IAE`/`NPE`) | **Exception** ([exceptions.md](exceptions.md)) |
| Cần tích hợp sâu với `@Transactional` / framework dựa trên exception rollback | Kiểm tra rõ quy tắc rollback trước khi trả `Result` thay vì ném exception |

---

## 5. Hàm thuần (Purity), Higher-Order Functions & Composition

- **Pure function:** cùng input luôn cho cùng output, không đọc/ghi state mutable bên ngoài, không I/O → dễ test đơn vị (không cần mock), an toàn chạy song song.
- **Kiến trúc "Functional Core, Imperative Shell":** giữ toàn bộ quy tắc nghiệp vụ trong các pure function / `record` / `sealed` (core); đẩy I/O, DB, HTTP, `Clock` ra lớp vỏ ngoài (shell).

```java
// Composition với Function & Predicate
Function<String, String> normalize = ((UnaryOperator<String>) String::strip)
        .andThen(s -> s.toLowerCase(Locale.ROOT));

Predicate<User> eligible = User::active
        .and(u -> u.age() >= 18)
        .and(Predicate.not(User::suspended)); // Java 11+ Predicate.not

// Higher-order function: decorator thêm retry/timing cho Supplier
static <T> Supplier<T> timed(String name, Supplier<T> action) {
    return () -> {
        long t0 = System.nanoTime();
        try {
            return action.get();
        } finally {
            long ms = (System.nanoTime() - t0) / 1_000_000;
            System.out.println(name + " took " + ms + "ms");
        }
    };
}
```

---

## 6. Currying, Partial Application, Memoization & Lazy Evaluation

```java
// Currying / Partial application
Function<BigDecimal, UnaryOperator<BigDecimal>> withTax =
        rate -> amount -> amount.multiply(BigDecimal.ONE.add(rate));

UnaryOperator<BigDecimal> vat10 = withTax.apply(new BigDecimal("0.10"));
BigDecimal total = vat10.apply(new BigDecimal("200")); // 220.00

// Memoization thread-safe cho pure function có miền input nhỏ
static <K, V> Function<K, V> memoize(Function<K, V> fn) {
    var cache = new ConcurrentHashMap<K, V>();
    return k -> cache.computeIfAbsent(k, fn); // cẩn thận: không dùng cho input unbounded (memory leak)!
}
```

### Lazy Evaluation thực dụng trong Java

Java đánh giá đối số theo kiểu **eager (strict)**, nhưng có 4 cơ chế chuẩn để trì hoãn tính toán:
1. **`Supplier<T>` / lambda:** truyền hàm tính thay vì giá trị (`Optional.orElseGet(Supplier)`, `Objects.requireNonNull(x, () -> expensiveMsg())`, `logger.fine(() -> ...)`).
2. **`Stream` pipeline:** các intermediate operation chỉ chạy khi gặp terminal operation và hỗ trợ short-circuit (`findFirst`, `anyMatch`, `limit` trên `Stream.iterate`).
3. **Initialization-on-Demand Holder** (static nested class) cho hằng số toàn cục khởi tạo lười một lần ([threading.md](threading.md#71-safe-publication-dcl-false-sharing--thread-states)).
4. **`LazyConstant<T>` (JEP 531, Third Preview trên JDK 27):** holder khởi tạo lười tối đa một lần, hỗ trợ constant-folding của JIT và `List.ofLazy` / `Map.ofLazy` / `Set.ofLazy` ([typesystem.md](typesystem.md#42-lazy-constants-preview-jep-531)).

---

## 7. Functional Pipelines với `Stream` & `Gatherer`

Kết hợp `Stream` + `Gatherer` (Java 24+) + `record` cục bộ giúp biến đổi dữ liệu khai báo, tránh vòng lặp có biến trạng thái rối:

```java
// Nhóm log thành từng cửa sổ trượt 3 phần tử và lọc các đợt spike
List<List<Metric>> spikes = metrics.stream()
        .gather(Gatherers.windowSliding(3))
        .filter(win -> win.stream().allMatch(m -> m.latencyMs() > 500))
        .toList();

// Tích lũy trung gian bằng local record
record RunningStats(int count, long sum) {
    RunningStats add(long v) { return new RunningStats(count + 1, sum + v); }
    double avg() { return count == 0 ? 0.0 : (double) sum / count; }
}
```

Chi tiết đầy đủ về `Stream`, `Collectors` và `Gatherers` (`windowFixed`, `windowSliding`, `fold`, `scan`, `mapConcurrent`): xem [streams.md](streams.md).

---

## 8. Giới hạn của Java với phong cách thuần hàm & Trampoline Pattern

1. **Không có Tail-Call Optimization (TCO):** đệ quy sâu (hàng chục nghìn bước) gây `StackOverflowError` → viết vòng lặp hoặc dùng **Trampoline pattern** khi muốn giữ cấu trúc đệ quy (ví dụ duyệt cây rất sâu hoặc mutually recursive parsers):

```java
public sealed interface Bounce<T> {
    record Done<T>(T value) implements Bounce<T> {}
    record More<T>(Supplier<Bounce<T>> next) implements Bounce<T> {}

    static <T> T run(Bounce<T> initial) {
        Bounce<T> cur = initial;
        while (cur instanceof More<T>(var next)) {
            cur = next.get(); // chạy trên heap bằng vòng lặp O(1) stack!
        }
        return ((Done<T>) cur).value();
    }
}

// Ví dụ tính giai thừa BigInteger với n = 100_000 không tràn stack:
static Bounce<BigInteger> factStep(int n, BigInteger acc) {
    return n <= 1
            ? new Bounce.Done<>(acc)
            : new Bounce.More<>(() -> factStep(n - 1, acc.multiply(BigInteger.valueOf(n))));
}
BigInteger bigFact = Bounce.run(factStep(50_000, BigInteger.ONE));
```

*(Đổi lại: Trampoline cấp phát object `More`/lambda mỗi bước — với bài toán tuyến tính đơn giản, một vòng `for`/`while` thuần vẫn nhanh và tiết kiệm RAM nhất.)*

2. **Không có Persistent Collections chuẩn trong JDK:** `List.copyOf` / `new ArrayList<>(old)` là copy O(n) (không structural sharing O(log n) như Clojure/Scala) — chấp nhận được cho tập nhỏ, nhưng với tập lớn cần mutate cục bộ rồi đóng băng (`copyOf`) ở biên.
3. **Checked exceptions xung đột với `java.util.function`:** cần bọc unchecked hoặc chuyển về `Result<T, E>` trước khi đưa vào pipeline.
4. **Không có Higher-Kinded Types (HKT):** không trừu tượng hóa `Monad<F<_>>` tổng quát; giữ các kiểu cụ thể (`Optional`, `Stream`, `CompletableFuture`, `Result`) đơn giản và thực dụng.

---

## 9. Pitfalls (Bẫy)

1. **Thêm `default` vào `switch` trên `sealed` ADT** — làm mất cảnh báo compile-time khi thêm subtype mới.
2. **Nhét side-effect (DB write, mutate list ngoài) vào `Stream.map` / `Optional.map`** — khó dự đoán, hỏng khi parallel hoặc lazy short-circuit.
3. **Đệ quy sâu không giới hạn trên JVM** — `StackOverflowError` vì không có TCO.
4. **Lạm dụng `Result<T, E>` thay cả lỗi lập trình / hạ tầng** — làm mọi tầng phải truyền `Result` rườm rà; giữ exception cho lỗi bất thường.
5. **Memoization không giới hạn kích thước** — `ConcurrentHashMap` phình vô hạn → OOM.
6. **Copy collection O(n) trong vòng lặp O(n)** — biến thuật toán thành O(n²); build bằng mutable cục bộ rồi xuất ra `List.copyOf(...)`.
7. **Lạm dụng functional abstraction kiểu Haskell** (`Either`/`Try`/`IO` lồng 4 lớp) trong team Java thông thường — làm giảm khả năng đọc và debug.

---

## 10. Best practices & Cheat sheet

- [ ] Dùng `sealed interface` + `record` cho domain models đóng (events, commands, states, errors) và bỏ `default` trong `switch` expression.
- [ ] Áp dụng **Functional Core, Imperative Shell**: tách logic tính toán thuần khỏi I/O và framework.
- [ ] Record chứa collection → `List.copyOf` / `Map.copyOf` trong compact constructor; dùng method `withX(...)` để tạo bản cập nhật.
- [ ] Dùng `Optional` cho giá trị trả về có thể vắng mặt; cân nhắc `sealed Result<T, E>` cho lỗi nghiệp vụ dự kiến cần compiler ép xử lý.
- [ ] Ưu tiên `Stream` + `Gatherers` cho biến đổi dữ liệu; quay về vòng lặp khi cần mutate cục bộ hiệu năng cao hoặc đệ quy sâu.

```java
// Cheat sheet DOP Java 27
sealed interface AuthOutcome {
    record Authenticated(UserId id, Set<Role> roles) implements AuthOutcome {}
    record Denied(String reason) implements AuthOutcome {}
}

String audit(AuthOutcome o) {
    return switch (o) {
        case AuthOutcome.Authenticated(var id, var roles) -> "OK:" + id + ":" + roles.size();
        case AuthOutcome.Denied(var reason) -> "DENY:" + reason;
    };
}
```

---

## Xem thêm

| File | Liên quan |
|------|-----------|
| [lambdas-functional.md](lambdas-functional.md) | Cú pháp lambda, SAM, method references, capture |
| [streams.md](streams.md) | `Stream`, `Collectors`, `Optional`, `Gatherers` |
| [oop.md](oop.md) | `record`, `sealed`, compact constructor, immutability |
| [statements.md](statements.md) | Pattern matching `switch`, `when`, exhaustiveness |
| [exceptions.md](exceptions.md) | Khi nào dùng exception vs domain `Result` |

---

*Tham chiếu nhanh — Java 27. Records (16), Sealed classes (17), Pattern switch & Record patterns (21), Unnamed `_` (22), Stream Gatherers (24) hợp thành nền tảng DOP hiện đại.*
