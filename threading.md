# Thread & Virtual Thread  

*(Platform threads, virtual threads, synchronization, Scoped Values — JEP 506)*

Từ Java 21, **virtual threads** là thành phần lõi của mô hình concurrency hiện đại; Java 25 LTS củng cố thêm bằng **Scoped Values** (JEP 506, final).

---

## Mục lục

- [Thread \& Virtual Thread](#thread--virtual-thread)
  - [Mục lục](#mục-lục)
  - [1. Tổng quan](#1-tổng-quan)
  - [2. Platform thread vs Virtual thread](#2-platform-thread-vs-virtual-thread)
  - [3. Tạo \& chạy thread](#3-tạo--chạy-thread)
    - [3.1 `Thread.ofVirtual()` / `ofPlatform()`](#31-threadofvirtual--ofplatform)
    - [3.2 `Runnable` / `Callable`](#32-runnable--callable)
    - [3.3 `ExecutorService`](#33-executorservice)
  - [4. Đồng bộ hóa](#4-đồng-bộ-hóa)
    - [4.1 `synchronized`](#41-synchronized)
    - [4.2 `volatile`](#42-volatile)
    - [4.3 `Lock` \& concurrent utilities](#43-lock--concurrent-utilities)
  - [5. JEP 506 — Scoped Values (final Java 25)](#5-jep-506--scoped-values-final-java-25)
  - [6. Race conditions \& happens-before](#6-race-conditions--happens-before)
  - [7. Interruption \& joining](#7-interruption--joining)
  - [8. Best practices](#8-best-practices)

---

## 1. Tổng quan

- **Thread**: đơn vị thực thi đồng thời. Trong Java có:
  - **Platform thread** — wrapper mỏng quanh OS thread (model cổ điển).
  - **Virtual thread** — thread nhẹ do JVM schedule lên carrier platform threads (Project Loom).
- **Đồng bộ hóa**: bảo vệ shared mutable state (`synchronized`, locks, concurrent collections, atomics).
- **ExecutorService**: pool / lifecycle cho tasks — với virtual threads thường dùng **unbounded virtual executor**.

> Xu hướng Java 25: viết code **blocking đơn giản** trên virtual threads thay vì callback hell / reactive bắt buộc cho mọi I/O.

---

## 2. Platform thread vs Virtual thread

| | Platform | Virtual |
|--|----------|---------|
| Chi phí | Nặng (~OS thread) | Rất nhẹ (hàng triệu có thể) |
| Mapping | 1–1 OS thread | Nhiều-1 lên carriers |
| Phù hợp | CPU-bound ít thread, JNI đặc thù | I/O-bound throughput cao |
| Pooling | Có ý nghĩa | **Không** cần pool nhỏ — tạo theo nhu cầu |
| Pinning | N/A | Tránh giữ carrier lâu trong `synchronized`/native |

```java
Thread.currentThread().isVirtual(); // true/false
```

**Pinning** (tóm tắt): virtual thread đang chạy trong `synchronized` block hoặc native frame có thể **ghim** carrier — hạn chế scheduling. Ưu tiên `ReentrantLock` cho critical section dài; giữ `synchronized` ngắn. (HotSpot tiếp tục cải thiện pinning qua các bản phát hành.)

---

## 3. Tạo & chạy thread

### 3.1 `Thread.ofVirtual()` / `ofPlatform()`

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

### 3.2 `Runnable` / `Callable`

```java
Runnable r = () -> System.out.println("go");
Callable<Integer> c = () -> {
    Thread.sleep(100); // virtual-friendly từ API mới
    return 42;
};
```

- `Runnable`: không return, không checked exception.
- `Callable<V>`: return + throws `Exception` — dùng với `ExecutorService.submit`.

### 3.3 `ExecutorService`

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

> Structured Concurrency (`StructuredTaskScope`, preview — xem [async.md](async.md)) là lớp cao hơn cho fan-out/fan-in có lifecycle rõ.

---

## 4. Đồng bộ hóa

### 4.1 `synchronized`

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
- Kết hợp `wait`/`notify` trên cùng monitor (ưu tiên thư viện higher-level).

### 4.2 `volatile`

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

### 4.3 `Lock` & concurrent utilities

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
| `ReentrantLock` | Lock linh hoạt, try/timeout, fairness |
| `ReentrantReadWriteLock` | Nhiều reader / ít writer |
| `StampedLock` | Optimistic read nâng cao |
| `Semaphore` | Giới hạn số permit |
| `CountDownLatch` | Một lần chờ N sự kiện |
| `CyclicBarrier` | N thread gặp nhau lặp lại |
| `Phaser` | Barrier linh hoạt hơn |
| `CompletableFuture` | Async composition — [async.md](async.md) |
| `ConcurrentHashMap`, queues | Shared data structures |
| `AtomicInteger`, `LongAdder` | Compount-free atomics / counters |

```java
AtomicInteger n = new AtomicInteger();
n.incrementAndGet();
n.compareAndSet(expect, update);

LongAdder hits = new LongAdder(); // cao contention hơn AtomicLong
hits.increment();
long total = hits.sum();
```

---

## 5. JEP 506 — Scoped Values (final Java 25)

**ScopedValue** chia sẻ dữ liệu **bất biến** cho callee trong cùng thread và **child threads** (đặc biệt với structured concurrency / virtual threads) — thay thế hiện đại cho nhiều use-case của `ThreadLocal`.

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

So với `ThreadLocal`:

| | `ThreadLocal` | `ScopedValue` |
|--|---------------|---------------|
| Mutability | Thường mutable per-thread | Binding **immutable** trong scope |
| Lifetime | Dễ rò nếu không `remove` | Lexical / bounded bởi `where(...).run` |
| Inherit | `InheritableThreadLocal` copy | Thiết kế để share hiệu quả với child |
| Virtual threads | Chi phí / footprint cao nếu lạm dụng | Tối ưu hơn với số lượng VT lớn |

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

Khi nào vẫn dùng `ThreadLocal`? State mutable theo thread (vd. SimpleDateFormat cũ — tốt hơn là tránh), framework legacy, hoặc API chưa migrate.

---

## 6. Race conditions & happens-before

**Race**: từ hai thread trở lên truy cập shared mutable data, ít nhất một ghi, không có ordering/đồng bộ đúng → kết quả không xác định.

```java
// BUG
counter++; // đọc-sửa-ghi không atomic

// OK
synchronized (this) { counter++; }
// hoặc
atomic.incrementAndGet();
```

**Happens-before** (JMM — tóm tắt thực dụng):

- Trong cùng thread: thứ tự chương trình.
- Unlock monitor → lock sau cùng monitor.
- Ghi `volatile` → đọc sau cùng biến.
- `Thread.start` → hành động trong thread mới; cuối thread → `join` thành công.
- Concurrent utilities thiết lập quan hệ tương tự (document từng API).

Publication an toàn:

```java
// unsafe: writer gán field không sync; reader có thể thấy null / nửa khởi tạo
// safer: volatile reference tới object bất biến, hoặc synchronized, hoặc final fields sau ctor
```

`final` fields: sau khi constructor hoàn tất, thread khác đọc reference an toàn thấy giá trị final đã init (safe publication qua final).

---

## 7. Interruption & joining

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
- Nuốt `InterruptedException` mà không restore → khó hủy task đúng cách.
- Virtual threads: interrupt vẫn là cơ chế chính; Structured Concurrency hủy subtree qua interrupt.

---

## 8. Best practices

- I/O / request handling: **virtual threads** + blocking APIs đơn giản.
- CPU-bound nặng: giới hạn song song ≈ số core (`semaphore` / fixed platform pool).
- Đừng pool virtual threads kiểu fixed nhỏ “cho chắc” — chống lại thiết kế.
- Shared mutable state: minimize; prefer immutability, message/queue, concurrent collections.
- Context xuyên method: **ScopedValue** (25+) thay `ThreadLocal` khi phù hợp.
- Tránh `Thread.stop` (đã loại bỏ / không dùng); dùng interrupt + flag.
- Deadlock: thứ tự khóa nhất quán; prefer timeout `tryLock`; giảm nested locks.
- Đo pinning / throughput bằng JFR và thread dumps (virtual threads hiện rõ trong dump hiện đại).

---

*Scoped Values: [JEP 506](https://openjdk.org/jeps/506). Virtual threads: JEP 444 (final từ 21).*
