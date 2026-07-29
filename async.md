# Lập trình bất đồng bộ  

*(CompletableFuture, Executor, Structured Concurrency preview, virtual threads)*

Java không có `async`/`await` như C#, nhưng có **`CompletableFuture`**, thread pools, và (từ Loom) **virtual threads** khiến mô hình “blocking per request” trở lại thực dụng. Java 25 vẫn **preview** Structured Concurrency (JEP 505).

---

## Mục lục

- [Lập trình bất đồng bộ](#lập-trình-bất-đồng-bộ)
  - [Mục lục](#mục-lục)
  - [1. Tổng quan: vì sao cần async?](#1-tổng-quan-vì-sao-cần-async)
  - [2. `Future` \& `ExecutorService`](#2-future--executorservice)
  - [3. `CompletableFuture` patterns](#3-completablefuture-patterns)
    - [3.1 Tạo \& hoàn thành](#31-tạo--hoàn-thành)
    - [3.2 Pipeline: `thenApply` / `thenCompose` / `thenCombine`](#32-pipeline-thenapply--thencompose--thencombine)
    - [3.3 Tất cả / bất kỳ \& timeout](#33-tất-cả--bất-kỳ--timeout)
    - [3.4 Exception handling](#34-exception-handling)
  - [4. Virtual threads: “blocking async” thực dụng](#4-virtual-threads-blocking-async-thực-dụng)
  - [5. JEP 505 — Structured Concurrency (Fifth Preview trong 25)](#5-jep-505--structured-concurrency-fifth-preview-trong-25)
  - [6. Reactive — chỉ nhắc ngắn](#6-reactive--chỉ-nhắc-ngắn)
  - [7. So sánh lựa chọn](#7-so-sánh-lựa-chọn)
  - [8. Best practices](#8-best-practices)

---

## 1. Tổng quan: vì sao cần async?

Bài toán: HTTP, DB, file, service từ xa — nếu block **platform thread** trong pool nhỏ → hết thread, latency tăng, UI/server khó scale.

Hai hướng chính trên Java hiện đại:

1. **Non-blocking callbacks / CompletableFuture / reactive** — ít thread, phức tạp hơn.
2. **Virtual threads** — giữ code blocking tuần tự, scale bằng hàng triệu VT rẻ.

```java
// Blocking trên virtual thread — chấp nhận được
try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
    String body = exec.submit(() -> httpClient.send(req, BodyHandlers.ofString()).body()).get();
}
```

```java
// CompletableFuture — không chiếm caller nếu async đúng cách
CompletableFuture<String> body = CompletableFuture.supplyAsync(() -> fetch(), exec);
```

---

## 2. `Future` & `ExecutorService`

```java
ExecutorService exec = Executors.newFixedThreadPool(8);
Future<Integer> f = exec.submit(() -> compute());

// blocking get
Integer v = f.get();
Integer v2 = f.get(1, TimeUnit.SECONDS);

f.cancel(true);           // mayInterruptIfRunning
boolean done = f.isDone();
```

Hạn chế của `Future` thuần:

- Không compose dễ (`then`, combine).
- `get()` block; không có callback chuẩn.
- Quản lý hủy nhiều future thủ công → dễ thread leak.

`ExecutorService` + try-with-resources:

```java
try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
    Future<A> fa = exec.submit(this::loadA);
    Future<B> fb = exec.submit(this::loadB);
    return new Pair<>(fa.get(), fb.get()); // vẫn cần tự cancel sibling khi lỗi — xem §5
}
```

---

## 3. `CompletableFuture` patterns

### 3.1 Tạo & hoàn thành

```java
CompletableFuture<String> cf = CompletableFuture.supplyAsync(() -> fetch(), exec);
CompletableFuture<Void> run = CompletableFuture.runAsync(() -> sideEffect(), exec);

CompletableFuture<String> manual = new CompletableFuture<>();
manual.complete("ok");
manual.completeExceptionally(new IOException("boom"));

String v = cf.join();   // unchecked CompletionException
String v2 = cf.get();   // checked ExecutionException / InterruptedException
```

- `supplyAsync` / `runAsync` không chỉ định executor → **ForkJoinPool.commonPool()** — cân nhắc truyền executor riêng (đặc biệt với blocking I/O trên platform threads).

### 3.2 Pipeline: `thenApply` / `thenCompose` / `thenCombine`

```java
CompletableFuture<String> pipeline =
        CompletableFuture.supplyAsync(() -> readRaw(), exec)
                .thenApply(String::strip)                 // T -> U
                .thenApply(String::toUpperCase)
                .thenCompose(this::enrichAsync)           // T -> CompletableFuture<U> (flatMap)
                .thenCombine(loadMetaAsync(), this::merge); // kết hợp 2 future
```

| Method | Sync function | Async function |
|--------|---------------|----------------|
| map | `thenApply` | `thenApplyAsync` |
| flatMap | `thenCompose` | `thenComposeAsync` |
| consume | `thenAccept` | `thenAcceptAsync` |
| run | `thenRun` | `thenRunAsync` |

- Bản `*Async` schedule lên executor (commonPool nếu omit).
- Bản không `Async`: thường chạy trên thread hoàn thành stage trước (có thể “stack” bất ngờ).

```java
CompletableFuture<Void> all = a.thenAcceptBoth(b, (x, y) -> use(x, y));
CompletableFuture<Void> either = a.acceptEither(b, this::useOne);
```

### 3.3 Tất cả / bất kỳ & timeout

```java
CompletableFuture<Void> all = CompletableFuture.allOf(f1, f2, f3);
all.join();
List<String> values = List.of(f1, f2, f3).stream()
        .map(CompletableFuture::join)
        .toList();

CompletableFuture<Object> first = CompletableFuture.anyOf(f1, f2);

CompletableFuture<String> withTimeout =
        fetchAsync().orTimeout(2, TimeUnit.SECONDS);

CompletableFuture<String> withDefault =
        fetchAsync().completeOnTimeout("fallback", 2, TimeUnit.SECONDS);
```

### 3.4 Exception handling

```java
cf.exceptionally(ex -> "fallback");
cf.exceptionallyAsync(ex -> recover(ex), exec);

cf.handle((val, ex) -> ex == null ? val : recover(ex));
cf.whenComplete((val, ex) -> log(val, ex)); // quan sát, không thay kết quả

cf.thenApply(this::parse)
  .exceptionally(ex -> {
      log(ex);
      return Optional.<Data>empty();
  });
```

- Exception bọc trong `CompletionException`; `get()` bọc `ExecutionException`.
- Stage đã complete exceptionally → downstream `thenApply` bị skip trừ khi `handle`/`exceptionally`.

---

## 4. Virtual threads: “blocking async” thực dụng

Với VT, pattern phổ biến:

```java
try (var scope = Executors.newVirtualThreadPerTaskExecutor()) {
    var users = scope.submit(() -> userClient.list());
    var orders = scope.submit(() -> orderClient.list());
    return render(users.get(), orders.get());
}
```

Ưu điểm:

- Code đọc như tuần tự; stack trace / debug dễ hơn reactive.
- Không cần “mọi thứ non-blocking” chỉ để scale I/O.
- Thư viện blocking JDBC/HTTP cổ điển dùng được (lưu ý pinning / pool DB size).

Khi nào vẫn cần `CompletableFuture`?

- API đã trả CF / reactive bridge.
- Cần timeout/composition trên thread hiện có mà không muốn block caller (vd. servlet cũ — ngày càng ít).
- Fan-in phức tạp trước khi Structured Concurrency ổn định.

---

## 5. JEP 505 — Structured Concurrency (Fifth Preview trong 25)

> **PREVIEW** — cần `--enable-preview`. API có thể đổi ở bản sau (JEP 505 = Fifth Preview). Không dùng production bắt buộc tương thích dài hạn nếu chưa sẵn sàng theo dõi thay đổi.

**Ý tưởng**: nhóm subtasks đồng thời như **một đơn vị** — lifetime lexically scoped; lỗi / hủy lan đúng cây task; dễ quan sát hơn `ExecutorService` “rời”.

API Java 25: mở scope bằng **static factory** `StructuredTaskScope.open(...)` (không còn nhấn mạnh public constructors như preview cũ).

```java
// Cần: jdk.incubator không — đây là preview trong java.util.concurrent
// javac/java --enable-preview --release 25

Response handle() throws InterruptedException {
    try (var scope = StructuredTaskScope.open()) { // Joiner mặc định: fail-fast / wait success
        StructuredTaskScope.Subtask<String> user =
                scope.fork(() -> findUser());
        StructuredTaskScope.Subtask<Integer> order =
                scope.fork(() -> fetchOrder());

        scope.join(); // chờ; nếu một fail → hủy sibling, lan exception theo policy

        return new Response(user.get(), order.get());
    }
}
```

Đặc tính mong muốn:

- Subtask **không sống lâu hơn** block `try`-with-resources.
- Fail một nhánh → **cancel** nhánh còn lại (policy Joiner).
- Thread dump / observability phản ánh quan hệ cha–con.
- Kết hợp tốt với **virtual threads** + **Scoped Values** (child inherit bindings).

Joiner tùy biến (ý tưởng): chờ tất cả thành công, lấy kết quả đầu, thu thập successes… — truyền vào `open(joiner)`.

```java
// Pseudocode — tham khảo JEP 505 / javadoc bản JDK 25 chính xác
// try (var scope = StructuredTaskScope.open(Joiner.allSuccessfulOrThrow())) { ... }
```

So với `CompletableFuture.allOf`:

| | CF allOf | StructuredTaskScope |
|--|----------|---------------------|
| Lifetime | Không buộc hierarchical | Lexical scope bắt buộc |
| Cancel siblings | Thủ công | Theo Joiner |
| Preview? | Stable | **Preview trong 25** |
| Kết hợp VT | Có | Thiết kế cho VT |

Bật preview:

```text
javac --enable-preview --release 25 Main.java
java  --enable-preview Main
```

Hoặc trong Maven/Gradle: cấu hình `enablePreview`.

---

## 6. Reactive — chỉ nhắc ngắn

**Reactive Streams** (`Flow` trong JDK, Project Reactor, RxJava, Akka Streams…): backpressure, non-blocking pipelines.

- Phù hợp streaming lớn, fan-out phức tạp, tích hợp WebFlux / RSocket.
- Đường cong học tập cao; stack trace khó; overkill nếu chỉ fan-out vài I/O với VT.
- JDK có `java.util.concurrent.Flow` (SPI) — ít dùng trực tiếp hơn thư viện.

> Trong stack Java 25 điển hình: ưu tiên **VT + structured concurrency (khi final)**; reactive khi hệ sinh thái / backpressure thật sự cần.

---

## 7. So sánh lựa chọn

| Tình huống | Gợi ý |
|------------|-------|
| Server I/O-bound, code đơn giản | Virtual threads + blocking |
| Fan-out có hủy đồng bộ (preview OK) | `StructuredTaskScope` |
| API/library trả Future composition | `CompletableFuture` |
| CPU song song data-parallel | Parallel streams / FJP — [streams.md](streams.md) |
| Streaming + backpressure | Reactive library |
| Context request-scoped | Scoped Values — [threading.md](threading.md) |

---

## 8. Best practices

- Blocking I/O trên `supplyAsync` **không** executor → đừng dùng commonPool; dùng VT executor hoặc pool I/O riêng.
- Luôn chỉ định **timeout** cho gọi mạng (`orTimeout`, HTTP client timeout).
- `join()` trong thread VT OK; tránh `.get()` giữ platform thread của container cũ quá lâu.
- Không nuốt exception trong `exceptionally` mà quên log.
- Hủy: truyền tín hiệu (`interrupt`, `Future.cancel`, scope join policy) xuyên suốt.
- Test load: số connection DB / rate limit thường hẹp hơn số VT.
- Theo dõi JEP Structured Concurrency đến khi **final** trước khi khóa API nội bộ quanh nó.

---

*JEP 505: [Structured Concurrency (Fifth Preview)](https://openjdk.org/jeps/505). Virtual threads: JEP 444.*
