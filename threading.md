# Thread & Virtual Thread

Platform threads, virtual threads, synchronization, JMM, Scoped Values (JEP 506), Structured Concurrency (preview), và lifecycle executor — **nhắm Java 27**.

Virtual threads final từ **Java 21**; Scoped Values **final** từ Java 25 ([JEP 506](https://openjdk.org/jeps/506)). Structured Concurrency vẫn **preview** ([JEP 533](https://openjdk.org/jeps/533) — Seventh Preview trên 27) — cần `--enable-preview`.

Xem thêm: [async.md](async.md) (`CompletableFuture`, timeout, reactive) · [keywords.md](keywords.md) (`synchronized`, `volatile`, `transient`…) · [exceptions.md](exceptions.md) (`InterruptedException`, unwrap async).

---

## Mục lục

- [1. Tổng quan](#1-tổng-quan)
- [2. Platform thread vs Virtual thread](#2-platform-thread-vs-virtual-thread)
- [3. Pinning trên virtual threads](#3-pinning-trên-virtual-threads)
- [4. Tạo \& chạy thread](#4-tạo--chạy-thread)
  - [4.1 `Thread.ofVirtual()` / `ofPlatform()`](#41-threadofvirtual--ofplatform)
  - [4.2 `Runnable` / `Callable`](#42-runnable--callable)
  - [4.3 `ExecutorService`](#43-executorservice)
  - [4.4 Executor pitfalls](#44-executor-pitfalls)
- [5. Đồng bộ hóa](#5-đồng-bộ-hóa)
  - [5.1 `synchronized`](#51-synchronized)
  - [5.2 `volatile`](#52-volatile)
  - [5.3 `Lock` \& concurrent utilities](#53-lock--concurrent-utilities)
- [6. JEP 506 — Scoped Values (final Java 25)](#6-jep-506--scoped-values-final-java-25)
  - [6.1 ThreadLocal vs ScopedValue](#61-threadlocal-vs-scopedvalue)
- [7. Race conditions \& JMM happens-before](#7-race-conditions--jmm-happens-before)
- [8. Interruption \& joining](#8-interruption--joining)
- [9. Structured Concurrency (`StructuredTaskScope`) — Java 27 preview](#9-structured-concurrency-structuredtaskscope--java-27-preview)
- [10. Pitfalls](#10-pitfalls)
- [11. Best practices](#11-best-practices)

---

## 1. Tổng quan

- **Thread**: đơn vị thực thi đồng thời. Trong Java có:
  - **Platform thread** — wrapper mỏng quanh OS thread (model cổ điển).
  - **Virtual thread** — thread nhẹ do JVM schedule lên carrier platform threads (Project Loom, final từ 21).
- **Đồng bộ hóa**: bảo vệ shared mutable state (`synchronized`, locks, concurrent collections, atomics).
- **ExecutorService**: pool / lifecycle cho tasks — với virtual threads thường dùng **unbounded virtual executor** (`newVirtualThreadPerTaskExecutor`).
- **Scoped Values** (25 final): context bất biến theo lexical scope — thay nhiều use-case `ThreadLocal`.
- **Structured Concurrency** (25 preview): fan-out/fan-in có lifetime rõ — chi tiết mục 9 và [async.md](async.md).

> Xu hướng Java 27: viết code **blocking đơn giản** trên virtual threads thay vì callback hell / reactive bắt buộc cho mọi I/O.

---

## 2. Platform thread vs Virtual thread

| | Platform | Virtual |
|--|----------|---------|
| Chi phí | Nặng (~OS thread) | Rất nhẹ (hàng triệu có thể) |
| Mapping | 1–1 OS thread | Nhiều VT trên nhiều carrier (M:N); mỗi VT đang chạy dùng một carrier |
| Phù hợp | CPU-bound ít thread, JNI đặc thù | I/O-bound throughput cao |
| Pooling | Có ý nghĩa | **Không** cần pool nhỏ — tạo theo nhu cầu |
| Pinning | N/A | Native/FFM có thể giữ carrier; monitor không còn gây pinning thông thường từ JDK 24 |
| Stack | Stack OS lớn | Stack ảo, grow/shrink theo nhu cầu |

```java
Thread.currentThread().isVirtual(); // true/false
```

**Quy tắc chọn nhanh:**

- Request/handler I/O, fan-out DB/HTTP → virtual thread.
- Kernel CPU-bound nặng (crypto, compress, số học) → giới hạn song song ≈ số core (fixed platform pool hoặc `Semaphore`).
- JNI / thư viện giữ native lock lâu → đo pinning; cân nhắc platform thread hoặc tách đoạn native.

---

## 3. Pinning trên virtual threads

Khi virtual thread **ghim (pin)** carrier, scheduler không thể unmount VT khỏi platform thread đó — giảm throughput dưới contention cao.

### 3.1 Cái gì pin?

| Tình huống | Pin? | Ghi chú |
|------------|------|---------|
| `synchronized` block/method, chờ monitor hoặc `Object.wait()` | **Không do monitor**, từ JDK 24 (JEP 491) | JDK 21–23 còn hạn chế pinning; contention vẫn làm các task chờ nhau |
| `ReentrantLock` / java.util.concurrent locks | **Không** do bản thân lock | Chọn khi cần timed/interruptible acquisition, fairness hoặc nhiều `Condition` |
| Native / JNI frame trên stack | **Có** | Giữ native càng ngắn càng tốt |
| Blocking network I/O JDK hỗ trợ VT (ví dụ socket) | Thường unmount | File I/O / lời gọi OS chưa hỗ trợ unmount có thể giữ OS thread; không coi mọi I/O là non-blocking |
| Busy-spin / CPU thuần | Chiếm carrier | Không pin theo nghĩa monitor, nhưng vẫn “ăn” carrier |

> [JEP 491](https://openjdk.org/jeps/491) đã loại bỏ pinning do monitor từ **JDK 24**. Trên Java 27, không cần đổi `synchronized` sang `ReentrantLock` chỉ để tránh pinning. Giữ critical section ngắn để giảm contention; native frames vẫn cần đo riêng.

### 3.2 Chẩn đoán

```text
# Ghi JFR khi cần chẩn đoán trên JDK 27
java -XX:StartFlightRecording=filename=vt.jfr,settings=profile ...
```

- Xem sự kiện JFR `jdk.VirtualThreadPinned` và thread dump có hỗ trợ VT; phân biệt native pinning với lock contention.
- `jdk.tracePinnedThreads` đã bị loại bỏ từ JDK 24; hướng dẫn dùng property này chỉ áp dụng JDK 21–23.

### 3.3 `ReentrantLock` khi cần API khóa linh hoạt

```java
private final Lock lock = new ReentrantLock();

void update() {
    lock.lock();
    try {
        // critical section — vẫn nên ngắn để giảm contention
        mutate();
    } finally {
        lock.unlock();
    }
}
```

| Chọn | Khi |
|------|-----|
| `synchronized` ngắn | Critical section cực ngắn, contention thấp, API monitor/`wait` |
| `ReentrantLock` | Cần timeout/`tryLock`, interruptible acquisition, fairness hoặc nhiều `Condition` |
| Concurrent collections / atomics | Tránh lock tường minh nếu đủ |

---

## 4. Tạo & chạy thread

### 4.1 `Thread.ofVirtual()` / `ofPlatform()`

```java
// Virtual — khuyến nghị cho task I/O / request-per-thread
Thread v = Thread.ofVirtual()
        .name("worker-", 0)
        .unstarted(() -> System.out.println(Thread.currentThread()));
v.start();
v.join();

Thread started = Thread.ofVirtual().start(() -> doWork());

// Platform
Thread p = Thread.ofPlatform()
        .name("cpu-1")
        .daemon(true)
        .start(() -> heavyCpu());
```

API cũ vẫn hoạt động:

```java
Thread t = new Thread(() -> doWork(), "legacy");
t.setDaemon(true);
t.start();
```

Factory:

```java
ThreadFactory vf = Thread.ofVirtual().factory();
ExecutorService ex = Executors.newThreadPerTaskExecutor(vf);
```

### 4.2 `Runnable` / `Callable`

```java
Runnable r = () -> System.out.println("go");
Callable<Integer> c = () -> {
    Thread.sleep(100); // virtual-friendly từ API mới
    return 42;
};
```

- `Runnable`: không return, không checked exception.
- `Callable<V>`: return + throws `Exception` — dùng với `ExecutorService.submit`.

### 4.3 `ExecutorService`

```java
// Một virtual thread mỗi task — pattern hiện đại
try (ExecutorService exec = Executors.newVirtualThreadPerTaskExecutor()) {
    Future<String> f = exec.submit(() -> fetch());
    String body = f.get();
}

// Platform pool cổ điển — CPU-bound
try (ExecutorService cpu = Executors.newFixedThreadPool(
        Runtime.getRuntime().availableProcessors())) {
    cpu.submit(() -> encrypt(data));
}

// Structured shutdown: try-with-resources (Java 19+) gọi close → shutdown + await
```

Các biến thể: `newCachedThreadPool`, `newScheduledThreadPool`, `Executors.newSingleThreadExecutor`.

```java
List<Future<Integer>> futures = exec.invokeAll(List.of(c1, c2, c3));
Integer any = exec.invokeAny(List.of(c1, c2)); // lấy kết quả đầu tiên thành công
```

### 4.4 Executor pitfalls

| Pitfall | Hệ quả | Cách tránh |
|---------|--------|------------|
| `newFixedThreadPool` + **unbounded** `LinkedBlockingQueue` (default) | Task xếp hàng vô hạn → OOM / latency ẩn khi producer nhanh | Bounded queue + `RejectedExecutionHandler`, hoặc backpressure |
| `newCachedThreadPool` dưới burst | Tạo rất nhiều platform thread | Giới hạn; hoặc VT executor cho I/O |
| Pool virtual threads “fixed nhỏ cho chắc” | Chống lại thiết kế Loom | `newVirtualThreadPerTaskExecutor` — giới hạn ở resource (DB pool), không ở số VT |
| Quên `shutdown` / `close` | Thread leak, JVM không thoát | `try (var exec = …)` hoặc `shutdown` + `awaitTermination` |
| `shutdownNow` rồi bỏ qua interrupt | Task nuốt interrupt → không dừng | Restore interrupt flag; xem [exceptions.md](exceptions.md) |
| `Future.get()` trên platform thread của container | Giữ thread request cũ lâu | Timeout `get(timeout)`; hoặc VT; hoặc CF/`orTimeout` — [async.md](async.md) |
| `Future.get()` bị interrupt | Ném `InterruptedException` — **không** cancel task trừ khi bạn `cancel` | Bắt, restore flag, quyết định `f.cancel(true)` |
| Fire-and-forget `submit` không giữ `Future` | Exception task mất / khó quan sát | Log trong task, hoặc `whenComplete`, hoặc structured scope |

```java
ExecutorService exec = Executors.newFixedThreadPool(8);
try {
    Future<String> f = exec.submit(() -> fetch());
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
} finally {
    exec.shutdown();
    exec.awaitTermination(5, TimeUnit.SECONDS);
}
```

> Fan-out có hủy sibling tự động: ưu tiên `StructuredTaskScope` (mục 9) hơn tự `cancel` từng `Future`.

---

## 5. Đồng bộ hóa

### 5.1 `synchronized`

```java
public class Counter {
    private int value;

    public synchronized void inc() {
        value++;
    }

    public synchronized int get() {
        return value;
    }
}

synchronized (lockObj) {
    // critical section
}
```

- Intrinsic lock trên `this` hoặc object chỉ định.
- Đảm bảo **mutual exclusion** + **happens-before** khi unlock → lock tiếp theo.
- Reentrant: cùng thread vào lại được.
- Kết hợp `wait`/`notify` trên cùng monitor (ưu tiên thư viện higher-level: `Condition`, latch, CF).
- Trên **virtual threads**: từ JDK 24, monitor cho phép unmount; chọn `ReentrantLock` khi cần thêm tính năng khóa (mục 3).

### 5.2 `volatile`

```java
private volatile boolean running = true;

public void stop() { running = false; }

public void loop() {
    while (running) {
        // ...
    }
}
```

- Đảm bảo **visibility** và thứ tự nhất định với volatile read/write — **không** atomic compound actions (`count++` vẫn race).
- Dùng cho flag, publication an toàn của reference bất biến.

### 5.3 `Lock` & concurrent utilities

```java
Lock lock = new ReentrantLock();
lock.lock();
try {
    // ...
} finally {
    lock.unlock();
}

if (lock.tryLock(1, TimeUnit.SECONDS)) {
    try { /* ... */ } finally { lock.unlock(); }
}
```

| Công cụ | Dùng khi |
|---------|----------|
| `ReentrantLock` | Lock linh hoạt, try/timeout, interruptible acquisition, fairness |
| `ReentrantReadWriteLock` | Nhiều reader / ít writer |
| `StampedLock` | Optimistic read nâng cao |
| `Semaphore` | Giới hạn số permit (vd. giới hạn song song CPU / downstream) |
| `CountDownLatch` | Một lần chờ N sự kiện |
| `CyclicBarrier` | N thread gặp nhau lặp lại |
| `Phaser` | Barrier linh hoạt hơn |
| `CompletableFuture` | Async composition — [async.md](async.md) |
| `ConcurrentHashMap`, queues | Shared data structures |
| `AtomicInteger`, `LongAdder` | Compound-free atomics / counters |

```java
AtomicInteger n = new AtomicInteger();
n.incrementAndGet();
n.compareAndSet(expect, update);

LongAdder hits = new LongAdder(); // cao contention hơn AtomicLong
hits.increment();
long total = hits.sum();
```

---

## 6. JEP 506 — Scoped Values (final Java 25)

**ScopedValue** chia sẻ **binding không đổi trong scope** cho callee trong cùng thread; `StructuredTaskScope` truyền binding sang subtasks. Object được bind không tự trở thành immutable. `Thread.startVirtualThread` và executor thông thường **không** tự kế thừa scoped-value bindings.

```java
private static final ScopedValue<Principal> PRINCIPAL = ScopedValue.newInstance();

void handleRequest(Principal p, Runnable action) {
    ScopedValue.where(PRINCIPAL, p).run(action);
}

void businessLogic() {
    Principal p = PRINCIPAL.get(); // hoặc orElse / orElseThrow
    // ...
}
```

```java
// Nhiều binding
ScopedValue.where(USER, user)
        .where(REQUEST_ID, id)
        .run(() -> service.process());

// Có return
String result = ScopedValue.where(PRINCIPAL, p).call(() -> service.compute());

if (PRINCIPAL.isBound()) {
    Principal cur = PRINCIPAL.get();
}
Principal cur = PRINCIPAL.orElse(Principal.ANONYMOUS);
```

**Lưu ý Java 25**: `ScopedValue.orElse` **không** nhận `null` làm đối số mặc định (thay đổi nhỏ khi finalize JEP 506).

### 6.1 ThreadLocal vs ScopedValue

| | `ThreadLocal` | `ScopedValue` |
|--|---------------|---------------|
| Mutability | Thường mutable per-thread | Binding **immutable** trong scope |
| Lifetime | Dễ rò nếu không `remove` | Lexical / bounded bởi `where(...).run` |
| Inherit | `InheritableThreadLocal` truyền giá trị theo `childValue` (mặc định cùng reference) | Qua subtasks của `StructuredTaskScope`, không qua mọi VT/executor |
| Virtual threads | Chi phí / footprint cao nếu lạm dụng (mỗi VT một copy) | Tối ưu hơn với số lượng VT lớn |
| Rebind | `set` mọi lúc | Nested `where` — scope chồng, không “set lung tung” |
| API ổn định | Lâu đời | **Final từ Java 25** (JEP 506) |

**Khi nào dùng cái nào?**

| Tình huống | Chọn |
|------------|------|
| Request id, principal, locale — bất biến trong call chain | **ScopedValue** |
| Context truyền xuống `StructuredTaskScope.fork` | **ScopedValue**; VT tạo trực tiếp cần bind tường minh |
| Framework legacy / API bắt buộc `ThreadLocal` | `ThreadLocal` (+ `remove` trong `finally`) |
| State mutable theo thread (buffer, counter tạm) | Tránh cả hai nếu được; nếu buộc → `ThreadLocal` + cleanup |
| `SimpleDateFormat` per-thread | Tránh — dùng `DateTimeFormatter` thread-safe |

```java
// ThreadLocal — luôn cleanup khi dùng với pool / VT sống lâu
ThreadLocal<Context> CTX = new ThreadLocal<>();
try {
    CTX.set(ctx);
    work();
} finally {
    CTX.remove();
}
```

---

## 7. Race conditions & JMM happens-before

**Race**: từ hai thread trở lên truy cập shared mutable data, ít nhất một ghi, không có ordering/đồng bộ đúng → kết quả không xác định.

```java
// BUG
counter++; // đọc-sửa-ghi không atomic

// OK
synchronized (this) { counter++; }
// hoặc
atomic.incrementAndGet();
```

### Happens-before (JMM — bảng thực dụng)

| Cạnh đồng bộ | Nội dung |
|--------------|----------|
| Program order | Trong cùng thread: hành động trước happens-before hành động sau (theo thứ tự chương trình) |
| Monitor unlock → lock | `unlock` monitor *M* happens-before mọi `lock` sau trên *M* |
| `volatile` write → read | Ghi `volatile` v happens-before mọi đọc sau cùng v |
| `Thread.start` | Gọi `start()` happens-before hành động đầu trong thread mới |
| Thread end → `join` | Mọi hành động trong thread T happens-before `T.join()` thành công return |
| `interrupt` | Gọi `interrupt` happens-before thread bị interrupt phát hiện (exception / flag) |
| Concurrent collections | Put/offer… happens-before take/get tương ứng (document từng lớp — `ConcurrentHashMap`, blocking queues…) |
| `Executor` task | Nộp task happens-before bắt đầu chạy; kết thúc task happens-before `Future.get` return thành công |
| `final` field | Có bảo đảm initialization safety nếu `this` không escape trước khi ctor hoàn tất; đây là quy tắc riêng của final fields, không phải cạnh đồng bộ thông thường |
| Transitivity | Nếu A hb B và B hb C thì A hb C |

Publication an toàn:

```java
// unsafe: writer gán field không sync; reader có thể thấy null / nửa khởi tạo
// safer: volatile reference tới object bất biến, hoặc synchronized, hoặc final fields sau ctor
```

`final` có bảo đảm initialization safety riêng nếu constructor không làm thoát `this` trước khi hoàn tất. Điều này không thay thế safe publication cho toàn bộ object và không làm các field mutable đọc/ghi đồng thời trở nên an toàn.

Busy-wait trên `boolean` không `volatile` / không sync → **không** có happens-before — có thể không bao giờ thấy update (tương tự pitfall Go memory model).

---

## 8. Interruption & joining

```java
Thread t = Thread.ofVirtual().start(() -> {
    try {
        while (!Thread.currentThread().isInterrupted()) {
            Thread.sleep(Duration.ofSeconds(1));
        }
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt(); // khôi phục cờ
    }
});

t.interrupt(); // tín hiệu hợp tác — không buộc dừng ngay
t.join();
t.join(Duration.ofSeconds(5));
```

- Interruption là **hợp tác**: API blocking ném `InterruptedException` hoặc set flag.
- Nuốt `InterruptedException` mà không restore → khó hủy task đúng cách — [exceptions.md](exceptions.md) §14.
- Virtual threads: interrupt vẫn là cơ chế chính; Structured Concurrency hủy subtree qua interrupt.
- `Thread.stop` đã loại bỏ / không dùng.

---

## 9. Structured Concurrency (`StructuredTaskScope`) — Java 27 preview

> **PREVIEW** trong Java 27 ([JEP 533](https://openjdk.org/jeps/533) — Seventh Preview). Cần `--enable-preview`. API có thể đổi — xem thêm [async.md](async.md) §6.

**Ý tưởng**: nhóm subtasks đồng thời thành **một đơn vị có lifetime lexical** — lỗi / hủy lan theo cây; quan sát cha–con rõ hơn `ExecutorService` rời.

### 9.1 Pattern cơ bản (fail-fast / join)

API từ Java 25+: mở scope bằng **static factory** `StructuredTaskScope.open(...)`. Java 27 thêm type parameter `R_X` cho exception của `join()`, và `Joiner.timeout()` thay `onTimeout()`.

```java
// Compile: javac --enable-preview --release 27 ...
// Run:     java --enable-preview ...

Response handle() throws InterruptedException, ExecutionException {
    try (var scope = StructuredTaskScope.open()) {
        StructuredTaskScope.Subtask<String> user =
                scope.fork(() -> findUser());
        StructuredTaskScope.Subtask<Integer> order =
                scope.fork(() -> fetchOrder());

        scope.join(); // chờ theo Joiner; fail → hủy sibling

        return new Response(user.get(), order.get());
    } // close: đảm bảo subtask không sống sót ngoài scope
}
```

### 9.2 Đặc tính & Joiner

| Đặc tính | Ý nghĩa |
|----------|---------|
| Lexical lifetime | Subtask **không** sống lâu hơn `try`-with-resources |
| Cancel siblings | Theo policy **Joiner** khi một nhánh fail / đủ kết quả |
| VT-first | Mỗi `fork` thường chạy trên virtual thread |
| Scoped Values | Child **inherit** binding từ parent |
| Observability | Thread dump phản ánh quan hệ cha–con |

`close()` vẫn phải chờ các subtask kết thúc sau khi yêu cầu hủy. Task bỏ qua interruption có thể khiến scope chờ vô hạn; đặt timeout cho I/O và tuân thủ cơ chế hủy hợp tác.

Các factory có sẵn trong [API JDK 27](https://docs.oracle.com/en/java/javase/27/docs/api/java.base/java/util/concurrent/StructuredTaskScope.Joiner.html):

```java
// Joiner là nested interface: import java.util.concurrent.StructuredTaskScope.Joiner;
// open() dùng awaitAllSuccessfulOrThrow(): join trả Void, đọc từng Subtask.get().
// open(Joiner.<String>allSuccessfulOrThrow()): join trả List<String>.
// open(Joiner.<String>anySuccessfulOrThrow()): join trả String từ task thắng.
```

| Policy (tinh thần) | Hành vi |
|--------------------|---------|
| Fail-fast / wait success (default `open()`) | Một fail → cancel còn lại, lan lỗi |
| `allSuccessfulOrThrow()` | Trả list kết quả khi tất cả thành công; fail thì cancel các task còn lại |
| Any successful | Lấy kết quả đầu thành công, cancel phần còn |

### 9.3 So với Executor / CompletableFuture

| | `ExecutorService` + `Future` | `CompletableFuture.allOf` | `StructuredTaskScope` |
|--|----------------------------|---------------------------|------------------------|
| Lifetime | Thủ công | Không hierarchical | Lexical bắt buộc |
| Cancel siblings | Tự `cancel` | Thủ công | Theo Joiner |
| Preview? | Stable | Stable | **Preview trong 27** |
| Exception model | `ExecutionException` | `CompletionException` | Theo Joiner / scope |
| Kế thừa ScopedValue | Không tự động | Không tự động | Tự động qua `fork` |

```text
javac --enable-preview --release 27 Main.java
java  --enable-preview Main
```

Khi chưa bật preview / cần stable API: fan-out bằng VT executor + hủy thủ công, hoặc `CompletableFuture` — [async.md](async.md).

---

## 10. Pitfalls

1. **Race trên compound action** — `count++`, check-then-act trên map không atomic dù field `volatile`.
2. **Nhầm pinning với contention** — trên JDK 24+, monitor không còn là nguyên nhân pinning thông thường; dùng JFR để tìm native pinning và đo thời gian chờ lock.
3. **Pool VT cố định nhỏ** — lãng phí mô hình Loom; bottleneck thật là DB connection / rate limit.
4. **Unbounded queue** trên platform pool — OOM ẩn khi submit nhanh hơn xử lý.
5. **Quên shutdown executor** — thread/platform leak; JVM treo lúc thoát.
6. **Nuốt `InterruptedException`** — mất tín hiệu hủy; structured cancel / `Future.cancel` không ăn.
7. **`ThreadLocal` trên VT** — footprint + dễ quên `remove` → rò ngữ cảnh / classloader.
8. **Double-checked locking sai** — thiếu `volatile` trên instance → publication không an toàn.
9. **Nested locks không thứ tự** — deadlock; thiếu `tryLock` timeout.
10. **`wait` ngoài vòng `while`** — missed signal / spurious wakeup.
11. **Giả định goroutine-exit-style sync** — thread kết thúc **không** tự happens-before gì nếu không `join` / handoff.
12. **Dùng Structured Concurrency trên prod mà quên preview flag / lock API** — JEP 533 vẫn đổi được giữa các bản.

---

## 11. Best practices

- [ ] I/O / request handling: **virtual threads** + blocking APIs đơn giản.
- [ ] CPU-bound nặng: giới hạn song song ≈ số core (`Semaphore` / fixed platform pool).
- [ ] Đừng pool virtual threads kiểu fixed nhỏ “cho chắc”.
- [ ] Shared mutable state: minimize; prefer immutability, queue, concurrent collections, atomics.
- [ ] Context xuyên method: **ScopedValue** (25+) thay `ThreadLocal` khi bất biến theo request.
- [ ] Chọn `synchronized` hoặc `ReentrantLock` theo tính năng cần; giảm thời gian giữ lock và đo contention.
- [ ] Staging: JFR `jdk.VirtualThreadPinned` khi nghi native pinning; không dùng property `jdk.tracePinnedThreads` trên JDK 27.
- [ ] Executor: bounded work queue hoặc backpressure; luôn `close` / `shutdown`.
- [ ] `Future.get`: timeout; trên interrupt → restore flag + cân nhắc `cancel(true)`.
- [ ] Fan-out có hủy đồng bộ: `StructuredTaskScope` (preview) hoặc hủy sibling tường minh.
- [ ] Deadlock: thứ tự khóa nhất quán; `tryLock` timeout; giảm nested locks.
- [ ] Không `Thread.stop`; interrupt + flag / scope policy.
- [ ] Đo pinning / throughput bằng JFR và thread dumps (VT hiện rõ trong dump hiện đại).

### Cheat sheet

| Công cụ | Việc |
|---------|------|
| `Thread.ofVirtual().start` | Spawn VT |
| `Executors.newVirtualThreadPerTaskExecutor` | Một VT / task + lifecycle |
| `synchronized` / `ReentrantLock` | Mutual exclusion (+ HB) |
| `volatile` / atomics | Flag / counter không compound phức tạp |
| `ScopedValue` | Context bất biến (25+ final) |
| `StructuredTaskScope` | Fan-out có cấu trúc (27 preview) |
| JFR `jdk.VirtualThreadPinned` | Chẩn đoán pinning trên JDK hiện tại |
| `CompletableFuture` | Composition async — [async.md](async.md) |

### Version map

| Phiên bản | Thay đổi liên quan concurrency |
|-----------|--------------------------------|
| 8+ | `CompletableFuture`, commonPool |
| 19+ | `ExecutorService` `AutoCloseable` (`close` → shutdown) |
| 21 | Virtual threads **final**; `Thread.ofVirtual` / `ofPlatform` |
| **24** | JEP 491: bỏ pinning do monitor; loại bỏ `jdk.tracePinnedThreads` |
| 21–24 | Scoped Values / Structured Concurrency preview nhiều vòng |
| **25 LTS** | Scoped Values **final** (JEP 506); Structured Concurrency Fifth Preview (JEP 505) |
| **26** | Structured Concurrency Sixth Preview (JEP 525); Lazy Constants preview |
| **27** | Structured Concurrency **Seventh Preview** (JEP 533) |

---

*Scoped Values: [JEP 506](https://openjdk.org/jeps/506). Virtual threads: [JEP 444](https://openjdk.org/jeps/444). Structured Concurrency: [JEP 533](https://openjdk.org/jeps/533).*
