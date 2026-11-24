# Lập trình bất đồng bộ

`CompletableFuture`, `Executor`/`Future`, timeout & cancellation, Structured Concurrency (preview), virtual threads như “blocking async”, và reactive/`Flow` ngắn — **nhắm Java 27**.

Java không có `async`/`await` như C#, nhưng có **`CompletableFuture`**, thread pools, và (từ Loom) **virtual threads** khiến mô hình “blocking per request” trở lại thực dụng. Structured Concurrency vẫn **preview** trong Java 27 ([JEP 533](https://openjdk.org/jeps/533)).

Xem thêm: [threading.md](threading.md) (VT, pinning, Scoped Values, JMM, `StructuredTaskScope`) · [exceptions.md](exceptions.md) (`InterruptedException`, unwrap) · [streams.md](streams.md) (parallel / Gatherers).

---

## Mục lục

- [1. Tổng quan: vì sao cần async?](#1-tổng-quan-vì-sao-cần-async)
- [2. `Future` \& `ExecutorService`](#2-future--executorservice)
- [3. `CompletableFuture` patterns](#3-completablefuture-patterns)
  - [3.1 Tạo \& hoàn thành](#31-tạo--hoàn-thành)
  - [3.2 Pipeline: `thenApply` / `thenCompose` / `thenCombine`](#32-pipeline-thenapply--thencompose--thencombine)
  - [3.3 Tất cả / bất kỳ](#33-tất-cả--bất-kỳ)
  - [3.4 Exception handling](#34-exception-handling)
  - [3.5 Pitfalls `CompletableFuture`](#35-pitfalls-completablefuture)
- [4. Cancellation \& timeout](#4-cancellation--timeout)
- [5. Virtual threads: “blocking async” thực dụng](#5-virtual-threads-blocking-async-thực-dụng)
- [6. JEP 533 — Structured Concurrency (Seventh Preview trong 27)](#6-jep-533--structured-concurrency-seventh-preview-trong-27)
- [7. Reactive / `Flow` — overview thực dụng](#7-reactive--flow--overview-thực-dụng)
- [8. So sánh lựa chọn](#8-so-sánh-lựa-chọn)
- [9. Pitfalls](#9-pitfalls)
- [10. Best practices](#10-best-practices)

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

> Java 27: ưu tiên VT + blocking rõ ràng; CF khi API/composition đòi hỏi; Structured Concurrency khi preview chấp nhận được — [threading.md](threading.md) §9.

---

## 2. `Future` & `ExecutorService`

```java
try (ExecutorService exec = Executors.newFixedThreadPool(8)) {
    Future<Integer> f = exec.submit(() -> compute());
    // Chọn timed get nếu cần giới hạn thời gian chờ.
    Integer v = f.get(1, TimeUnit.SECONDS);
    boolean done = f.isDone();
    // Khi cần hủy: f.cancel(true); // yêu cầu interrupt nếu đang chạy
}
```

Hạn chế của `Future` thuần:

- Không compose dễ (`then`, combine).
- `get()` block; không có callback chuẩn.
- Quản lý hủy nhiều future thủ công → dễ thread leak / orphan task.

`ExecutorService` + try-with-resources:

```java
try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
    Future<A> fa = exec.submit(this::loadA);
    Future<B> fb = exec.submit(this::loadB);
    return new Pair<>(fa.get(), fb.get()); // vẫn cần tự cancel sibling khi lỗi — xem §6
}
```

Chi tiết pool pitfalls (unbounded queue, shutdown, `get` + interrupt): [threading.md](threading.md) §4.4.

`ExecutorService.close()` chờ task kết thúc; timed `get()` không tự hủy task. Khi timeout, cần quyết định `cancel(true)` và đặt timeout tại I/O gốc, nếu không thoát block `try` vẫn có thể chờ lâu.

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

- `supplyAsync` / `runAsync` **không** chỉ định executor → **`ForkJoinPool.commonPool()`** (nếu parallelism < 2 thì tạo thread mới cho mỗi task) — xem pitfall §3.5.

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
- Bản không `Async`: thường chạy trên thread hoàn thành stage trước (có thể “stack” bất ngờ — giữ ngắn, không block).

```java
CompletableFuture<Void> all = a.thenAcceptBoth(b, (x, y) -> use(x, y));
CompletableFuture<Void> either = a.acceptEither(b, this::useOne);
```

### 3.3 Tất cả / bất kỳ

```java
CompletableFuture<Void> all = CompletableFuture.allOf(f1, f2, f3);
all.join();
List<String> values = List.of(f1, f2, f3).stream()
        .map(CompletableFuture::join)
        .toList();

CompletableFuture<Object> first = CompletableFuture.anyOf(f1, f2);
```

- `allOf` hoàn thành khi **mọi** stage xong (kể cả exceptionally) — kiểm tra từng CF hoặc `join` từng cái để lấy lỗi/giá trị.
- `anyOf` hoàn thành khi **một** xong; các CF còn lại **không** tự cancel — tự hủy nếu cần (mục 4).

### 3.4 Exception handling

```java
cf.exceptionally(ex -> "fallback");
cf.exceptionallyAsync(ex -> recover(ex), exec);

cf.handle((val, ex) -> ex == null ? val : recover(ex));
cf.whenComplete((val, ex) -> log(val, ex)); // quan sát; callback ném lỗi có thể làm stage trả về thất bại

cf.thenApply(text -> Optional.of(parse(text)))
  .exceptionally(ex -> {
      log(ex);
      return Optional.<Data>empty();
  });
```

- Exception bọc trong **`CompletionException`** (đường `join` / callback); `get()` bọc **`ExecutionException`**.
- Cause thật thường ở `getCause()` — đôi khi lồng nhiều lớp; unwrap trước khi map sang domain error — [exceptions.md](exceptions.md).
- Stage đã complete exceptionally → downstream `thenApply` bị skip trừ khi `handle`/`exceptionally`.

```java
Throwable unwrap(Throwable ex) {
    Throwable t = ex;
    while (t instanceof CompletionException || t instanceof ExecutionException) {
        if (t.getCause() == null) break;
        t = t.getCause();
    }
    return t;
}
```

### 3.5 Pitfalls `CompletableFuture`

| Pitfall | Chi tiết |
|---------|----------|
| `join()` vs `get()` | `join()` → unchecked `CompletionException` (tiện trong VT/lambda); `get()` → checked `ExecutionException` + **`InterruptedException`** (phải xử lý interrupt đúng) |
| Exception wrapping | Caller hay bắt sai type — luôn unwrap `CompletionException`/`ExecutionException` |
| **commonPool saturation** | `supplyAsync(fn)` không executor → FJP commonPool (song song với parallel streams). Blocking I/O trên commonPool → **đói thread toàn process** |
| `thenApply` blocking | Chạy trên thread hoàn thành stage trước — block → trì hoãn chuỗi khác cùng thread |
| Quên executor trên `*Async` | `thenApplyAsync(fn)` không exec → lại commonPool |
| `allOf` + `join` một lần | Không lấy được từng kết quả; vẫn cần `f1.join()`… hoặc `handle` |
| `anyOf` orphan | Winner xong, loser vẫn chạy — tốn resource / side effect |
| `complete` hai lần | Lần sau bỏ qua (trả `false`) — race publisher cần `completeOnTimeout` / chỉ một writer |
| Nuốt lỗi trong `exceptionally` | Fallback im lặng → mất tín hiệu ops |

```java
// BAD — blocking I/O trên commonPool
CompletableFuture.supplyAsync(() -> httpBlocking());

// GOOD — VT executor hoặc pool I/O riêng
try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
    CompletableFuture.supplyAsync(() -> httpBlocking(), exec);
}
```

---

## 4. Cancellation & timeout

### 4.1 Timeout trên CF

```java
CompletableFuture<String> withTimeout =
        fetchAsync().orTimeout(2, TimeUnit.SECONDS);
// TimeoutException → complete exceptionally

CompletableFuture<String> withDefault =
        fetchAsync().completeOnTimeout("fallback", 2, TimeUnit.SECONDS);
```

- `orTimeout` / `completeOnTimeout` trả về **chính CF nhận lời gọi**, không tạo bản timeout độc lập, và không tự interrupt task của `supplyAsync`. Dùng `cf.copy().orTimeout(...)` khi chỉ muốn timeout một nhánh quan sát; hủy công việc gốc qua task/resource handle riêng.
- HTTP client: luôn set **connect/request timeout** ở client — đừng chỉ dựa CF timeout.

### 4.2 Cancel `Future` / CF

```java
Future<?> f = exec.submit(() -> work());
f.cancel(true); // mayInterruptIfRunning = true → interrupt nếu đang chạy

CompletableFuture<String> cf = CompletableFuture.supplyAsync(this::fetch, exec);
boolean ok = cf.cancel(true); // complete exceptionally bằng CancellationException
```

| Hành vi | Ý nghĩa |
|---------|---------|
| `Future.cancel(false)` | Có thể đánh dấu canceled cả khi task đang chạy, nhưng không yêu cầu interrupt; computation có thể tiếp tục |
| `Future.cancel(true)` | Yêu cầu interrupt nếu implementation hỗ trợ — task phải hợp tác |
| `CompletableFuture.cancel(...)` | `mayInterruptIfRunning` **không có tác dụng** với CF thông thường; task `supplyAsync` có thể tiếp tục chạy |
| CF đã có kết quả/lỗi | Cancel không thay kết quả; gọi lại `cancel` trên CF đã canceled có thể vẫn trả `true` |
| Downstream CF | Stage phụ thuộc chưa hoàn tất có thể thất bại với `CompletionException` bọc `CancellationException`; không tự dừng mọi computation liên quan |

### 4.3 Pattern: timeout + hủy sibling

```java
CompletableFuture<A> fa = loadA(exec);
CompletableFuture<B> fb = loadB(exec);

CompletableFuture<Pair<A, B>> both =
        fa.thenCombine(fb, Pair::new)
          .orTimeout(3, TimeUnit.SECONDS)
          .whenComplete((v, ex) -> {
              if (ex != null) {
                  fa.cancel(true);
                  fb.cancel(true);
              }
          });
```

Trên Java 27 với preview: `StructuredTaskScope` làm cancel sibling **theo policy** — ít lỗi hơn tự quản CF — [threading.md](threading.md) §9.

Trong ví dụ trên, `fa.cancel(true)`/`fb.cancel(true)` chỉ hủy **kết quả CF**, không bảo đảm dừng I/O. `thenCombine` cũng không phải fail-fast: khi một nhánh lỗi, nó có thể vẫn đợi nhánh còn lại. Muốn dừng task thật, giữ `Future`/resource handle hoặc dùng scope có policy hủy.

### 4.4 `get` + interrupt

```java
try {
    return f.get(2, TimeUnit.SECONDS);
} catch (InterruptedException e) {
    Thread.currentThread().interrupt();
    f.cancel(true);
    throw e;
} catch (TimeoutException e) {
    f.cancel(true);
    throw e;
}
```

---

## 5. Virtual threads: “blocking async” thực dụng

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
- Thư viện blocking JDBC/HTTP cổ điển dùng được (lưu ý pinning / pool DB size — [threading.md](threading.md) §3).

Khi nào vẫn cần `CompletableFuture`?

- API đã trả CF / reactive bridge.
- Cần timeout/composition trên thread hiện có mà không muốn block caller (vd. servlet cũ — ngày càng ít).
- Fan-in phức tạp trước khi Structured Concurrency ổn định / không bật preview.

---

## 6. JEP 533 — Structured Concurrency (Seventh Preview trong 27)

> **PREVIEW** — cần `--enable-preview`. API có thể đổi ở bản sau (JEP 533 = Seventh Preview). Không khóa API nội bộ dài hạn nếu chưa sẵn sàng theo dõi thay đổi. Bản đầy đủ hơn (Joiner, Scoped Values, so sánh bảng): [threading.md](threading.md) §9.

**Ý tưởng**: nhóm subtasks đồng thời như **một đơn vị** — lifetime lexically scoped; lỗi / hủy lan đúng cây task; dễ quan sát hơn `ExecutorService` “rời”.

API: mở scope bằng **static factory** `StructuredTaskScope.open(...)` (từ 25). Java 27: `Joiner` có type parameter exception `R_X`; `timeout()` thay `onTimeout()`. Theo [API JDK 27](https://docs.oracle.com/en/java/javase/27/docs/api/java.base/java/util/concurrent/StructuredTaskScope.html), default `open()` cho `join()` ném checked `ExecutionException` khi subtask thất bại.

```java
// Biên dịch: javac --enable-preview --release 27 ...
// Chạy:      java --enable-preview ...

Response handle() throws InterruptedException, ExecutionException {
    try (var scope = StructuredTaskScope.open()) {
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

```java
// Joiner: import java.util.concurrent.StructuredTaskScope.Joiner;
// open() dùng Joiner.awaitAllSuccessfulOrThrow(); join() trả Void.
// Với các task cùng kiểu T: Joiner.<T>allSuccessfulOrThrow() cho join() trả List<T>.
```

So với `CompletableFuture.allOf`:

| | CF `allOf` | `StructuredTaskScope` |
|--|------------|------------------------|
| Lifetime | Không buộc hierarchical | Lexical scope bắt buộc |
| Cancel siblings | Thủ công | Theo Joiner |
| Preview? | Stable | **Preview trong 27** |
| Kết hợp VT | Có | Thiết kế cho VT |

```text
javac --enable-preview --release 27 Main.java
java  --enable-preview Main
```

---

## 7. Reactive / `Flow` — overview thực dụng

**Reactive Streams** (`java.util.concurrent.Flow` trong JDK; Project Reactor, RxJava, Akka Streams…): publisher/subscriber + **backpressure**.

| Thành phần `Flow` | Vai trò |
|-------------------|---------|
| `Publisher` | Phát hành item |
| `Subscriber` | Nhận item |
| `Subscription` | `request(n)` / `cancel` — backpressure |
| `Processor` | Vừa subscribe vừa publish |

Khi nào đáng dùng:

- Streaming lớn (event hub, infinite source), cần backpressure thật.
- Stack đã chọn WebFlux / RSocket / reactive DB driver end-to-end.
- Fan-out/fan-in phức tạp với tín hiệu demand — không chỉ “vài HTTP song song”.

Khi **không** cần:

- Fan-out vài I/O với VT / `StructuredTaskScope`.
- Code team chưa quen cold/hot publisher, schedulers, `subscribeOn` — chi phí debug cao.
- Chỉ wrap blocking call bằng `Mono.fromCallable` trên elastic pool → thường VT thẳng đơn giản hơn.

```java
// Khung SPI minh họa; chưa phải Publisher đáp ứng đầy đủ Flow contract.
Flow.Publisher<Item> publisher = subscriber -> {
    subscriber.onSubscribe(new Flow.Subscription() {
        public void request(long n) { /* phát tối đa n item */ }
        public void cancel() { /* dừng */ }
    });
};
```

Implementation thực tế phải cộng dồn demand, báo `onError` với `IllegalArgumentException` khi `request(n <= 0)`, tuần tự hóa signals và xử lý cancellation/terminal state đúng contract; ưu tiên thư viện đã thực hiện các quy tắc này. Xem [Flow](https://docs.oracle.com/en/java/javase/27/docs/api/java.base/java/util/concurrent/Flow.html) và [Subscription](https://docs.oracle.com/en/java/javase/27/docs/api/java.base/java/util/concurrent/Flow.Subscription.html).

> Stack Java 27 điển hình: **VT + structured concurrency (khi final / preview OK)**; reactive khi hệ sinh thái / backpressure thật sự cần.

---

## 8. So sánh lựa chọn

| Tình huống | Gợi ý |
|------------|-------|
| Server I/O-bound, code đơn giản | Virtual threads + blocking |
| Fan-out có hủy đồng bộ (preview OK) | `StructuredTaskScope` |
| API/library trả Future composition | `CompletableFuture` |
| Timeout một gọi mạng | Client timeout + CF `orTimeout` / `get(timeout)` |
| CPU song song data-parallel | Parallel streams / FJP — [streams.md](streams.md) |
| Streaming + backpressure | Reactive library (`Flow`) |
| Context request-scoped | Scoped Values — [threading.md](threading.md) |
| Blocking I/O + CF | Luôn truyền **executor VT / I/O**, không commonPool |

---

## 9. Pitfalls

1. **`supplyAsync` không executor** — blocking trên `ForkJoinPool.commonPool` → saturation toàn app (kể cả parallel streams).
2. **Nhầm `join` / `get`** — quên unwrap `CompletionException` / quên xử lý `InterruptedException` trên `get`.
3. **`orTimeout` tưởng giết task** — CF xong exceptionally nhưng work gốc có thể vẫn chạy nếu không `cancel`/đóng resource.
4. **`anyOf` / `applyToEither` orphan** — nhánh thua không hủy → side effect kép / tốn connection.
5. **`thenApply` nặng trên thread completion** — block chuỗi; dùng `thenApplyAsync(..., exec)`.
6. **Nuốt lỗi trong `exceptionally`** — fallback không log / không metrics.
7. **Cancel không hợp tác** — task bỏ qua interrupt → `cancel(true)` vô ích.
8. **Reactive “cho hiện đại”** khi chỉ cần vài VT fan-out — phức tạp thừa.
9. **Structured Concurrency trên prod** mà quên `--enable-preview` / API còn đổi (JEP 533).
10. **Số VT >> DB pool** — hết connection, timeout hàng loạt; giới hạn ở resource, không ở “pool VT”.

---

## 10. Best practices

- [ ] Blocking I/O trên CF → **luôn** truyền executor (VT per-task hoặc pool I/O); tránh commonPool.
- [ ] Timeout kép: **HTTP/DB client timeout** + `orTimeout` / `get(timeout)` ở biên.
- [ ] Chọn `get()` khi cần chờ có thể interrupt; `join()` không ném `InterruptedException` dù chạy trên VT.
- [ ] Unwrap `CompletionException`/`ExecutionException` trước khi map domain error.
- [ ] `exceptionally` / `handle`: log + metrics; đừng nuốt im.
- [ ] Hủy xuyên suốt: interrupt, `Future.cancel(true)`, Joiner của `StructuredTaskScope`.
- [ ] `anyOf`/race: hủy nhánh thua hoặc dùng structured “any successful”.
- [ ] Test load: connection pool / rate limit hẹp hơn số VT.
- [ ] Parallel CPU: [streams.md](streams.md) / semaphore — đừng nhồi blocking vào commonPool.
- [ ] Theo dõi JEP Structured Concurrency đến **final** trước khi khóa API nội bộ quanh nó.

### Cheat sheet

| API | Việc |
|-----|------|
| `supplyAsync(fn, exec)` | Chạy async có kiểm soát pool |
| `thenCompose` | flatMap CF |
| `thenCombine` / `allOf` | Fan-in |
| `orTimeout` / `completeOnTimeout` | Deadline phía CF |
| `Future.cancel(true)` / `CF.cancel(true)` | Future có thể yêu cầu interrupt; CF thông thường chỉ hủy kết quả |
| `exceptionally` / `handle` | Recover / map lỗi |
| VT executor | “Async” bằng blocking đơn giản |
| `StructuredTaskScope` | Fan-out có cấu trúc (preview) |

### Version map

| Phiên bản | Thay đổi liên quan async |
|-----------|--------------------------|
| 8 | `CompletableFuture` |
| 9 | `completeOnTimeout` / `orTimeout` (CF) |
| 21 | Virtual threads final — blocking async thực dụng |
| 21–24 | Structured Concurrency preview nhiều vòng |
| **25 LTS** | JEP 505 Fifth Preview; Scoped Values final — [threading.md](threading.md) |
| **26** | JEP 525 Sixth Preview |
| **27** | JEP 533 Seventh Preview |

---

*JEP 533: [Structured Concurrency (Seventh Preview)](https://openjdk.org/jeps/533). Virtual threads: [JEP 444](https://openjdk.org/jeps/444). CompletableFuture: `java.util.concurrent`.*
