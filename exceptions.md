# Exception trong Java

Xử lý lỗi với hệ phân cấp `Throwable`, checked vs unchecked, `try`/`catch`/`finally`, try-with-resources, `throw`/`throws`, wrapping, suppressed, multi-failure, biên API, logging, test, và `StackWalker` — **nhắm Java 25 LTS**.

`try`/`catch`/`throw`/`throws`/`finally` là từ khóa — xem [keywords.md](keywords.md). Cấu trúc khối statement: [statements.md](statements.md). Concurrency / virtual threads: [threading.md](threading.md). `CompletableFuture` / structured concurrency: [async.md](async.md). Hierarchy class/interface: [oop.md](oop.md). Tóm tắt phiên bản: [java25.md](java25.md).

---

## Mục lục

- [1. Tổng quan & triết lý](#1-tổng-quan--triết-lý)
- [2. Hệ phân cấp `Throwable`](#2-hệ-phân-cấp-throwable)
- [3. Checked vs unchecked vs `Error`](#3-checked-vs-unchecked-vs-error)
- [4. `try` / `catch` / `finally`](#4-try--catch--finally)
- [5. Multi-catch](#5-multi-catch)
- [6. Try-with-resources](#6-try-with-resources)
- [7. `throw` / `throws`](#7-throw--throws)
- [8. Wrapping, rethrow & cause](#8-wrapping-rethrow--cause)
- [9. Suppressed exceptions](#9-suppressed-exceptions)
- [10. Multi-failure patterns](#10-multi-failure-patterns)
- [11. `StackWalker` (tóm tắt)](#11-stackwalker-tóm-tắt)
- [12. Custom exceptions](#12-custom-exceptions)
- [13. Biên API: wrap hay che lỗi](#13-biên-api-wrap-hay-che-lỗi)
- [14. `InterruptedException`, virtual threads & async unwrap](#14-interruptedexception-virtual-threads--async-unwrap)
- [15. Logging `Throwable`](#15-logging-throwable)
- [16. Test exceptions](#16-test-exceptions)
- [17. Pitfalls](#17-pitfalls)
- [18. Best practices & checklist](#18-best-practices--checklist)
- [19. Cheat sheet](#19-cheat-sheet)
- [Phụ lục: Ngoại lệ JDK thường gặp](#phụ-lục-ngoại-lệ-jdk-thường-gặp)
- [Xem thêm](#xem-thêm)

---

## 1. Tổng quan & triết lý

- Exception báo **điều kiện bất thường** — không dùng cho luồng điều khiển bình thường (tránh parse bằng cách ném/bắt).
- Ném/bắt có chi phí (stack walk, object allocation) — không đặt trên hot-path “happy path”.
- Java phân biệt **checked** (bắt buộc xử lý hoặc khai báo) và **unchecked** (`RuntimeException` / `Error`).
- Cause chain (`getCause`) + suppressed (`getSuppressed`) là hai cách gắn lỗi phụ — không trộn lẫn vai trò.
- Virtual threads (Java 21+, LTS 25): exception vẫn bubble theo stack task; `InterruptedException` / hủy vẫn cần tôn trọng khi API blocking hỗ trợ interruption — xem mục 14 và [threading.md](threading.md).

---

## 2. Hệ phân cấp `Throwable`

```
java.lang.Object
└─ java.lang.Throwable
   ├─ java.lang.Error
   │  ├─ OutOfMemoryError
   │  ├─ StackOverflowError
   │  ├─ NoClassDefFoundError
   │  └─ ...
   └─ java.lang.Exception
      ├─ java.io.IOException
      ├─ java.sql.SQLException
      ├─ java.lang.InterruptedException
      ├─ java.lang.ReflectiveOperationException
      └─ java.lang.RuntimeException          ← unchecked
         ├─ NullPointerException
         ├─ IllegalArgumentException
         ├─ IllegalStateException
         ├─ IndexOutOfBoundsException
         ├─ ClassCastException
         ├─ UnsupportedOperationException
         ├─ ArithmeticException
         ├─ NumberFormatException
         ├─ UncheckedIOException
         └─ ...
```

Mọi thứ ném được đều là `Throwable`. Thực tế ứng dụng hầu như chỉ làm việc với `Exception` và các subtype. Override / sealed hierarchy: [oop.md](oop.md).

---

## 3. Checked vs unchecked vs `Error`

| Nhóm | Ví dụ | Compiler bắt buộc xử lý? | Khi nào dùng |
|------|--------|---------------------------|--------------|
| **Checked** (`Exception` trừ `RuntimeException`) | `IOException`, `SQLException` | Có — `catch` hoặc `throws` | Lỗi Recoverable mà caller nên biết (I/O, …) |
| **Unchecked** (`RuntimeException`) | `NPE`, `IAE`, `ISE` | Không | Lỗi lập trình / precondition / state |
| **`Error`** | `OutOfMemoryError` | Không (và không nên catch thường) | Thất bại JVM / môi trường — hiếm khi recover |

```java
// Checked — phải khai báo hoặc bắt
public String read(Path p) throws IOException {
    return Files.readString(p);
}

// Unchecked — không bắt buộc throws
public void setAge(int age) {
    if (age < 0) throw new IllegalArgumentException("age");
}
```

**Tranh luận thực dụng:** nhiều codebase hiện đại prefer unchecked + tài liệu rõ; vẫn tôn trọng checked của JDK (`IOException`) hoặc bọc `UncheckedIOException` ở biên API functional/lambda — xem [lambdas-functional.md](lambdas-functional.md) nếu có trong bộ tài liệu.

**Version note:** mô hình checked/unchecked không đổi ở Java 25; thay đổi thực tế nằm ở concurrency (virtual threads, structured concurrency) và API mới quanh stack/diagnostics.

---

## 4. `try` / `catch` / `finally`

```java
try {
    doWork();
} catch (IOException e) {
    log.warn("I/O", e);
    // khôi phục / thông báo
} finally {
    cleanup(); // chạy gần như luôn (trừ khi JVM halt / daemon kill cứng)
}
```

- Thứ tự `catch`: **cụ thể trước, tổng quát sau** (subtype trước supertype).
- `finally` chạy cả khi có `return` trong `try`/`catch` — tránh `return` trong `finally` (che mất exception/return gốc; style hiện đại cấm).
- Có thể chỉ `try`/`finally` không `catch`.

```java
try {
    return compute();
} finally {
    metrics.increment();
}
```

Chi tiết cú pháp khối: [statements.md](statements.md).

---

## 5. Multi-catch

```java
try {
    save(entity);
} catch (IOException | SQLException e) {
    throw new StorageException("save failed", e);
}
```

- Biến `e` là **effectively final**; kiểu là lub (least upper bound) của các alternative.
- Không bắt hai kiểu có quan hệ kế thừa trong cùng multi-catch (thừa / lỗi).

---

## 6. Try-with-resources

Resource triển khai `AutoCloseable` (hoặc `Closeable`). Được đóng tự động theo thứ tự **ngược** khai báo.

```java
try (InputStream in = Files.newInputStream(src);
     OutputStream out = Files.newOutputStream(dst)) {
    in.transferTo(out);
} catch (IOException e) {
    throw new UncheckedIOException(e);
}
```

Với `var` / unnamed:

```java
try (var reader = Files.newBufferedReader(path)) {
    return reader.lines().toList();
}

try (var _ = lock.acquire()) {
    critical();
}
```

Exception khi `close()` không làm mất exception gốc từ body — chúng thành **suppressed** (mục 9).

---

## 7. `throw` / `throws`

### 7.1 `throw`

```java
throw new IllegalStateException("not started");
throw e; // rethrow biến đã catch
```

### 7.2 `throws`

```java
public byte[] load(String name) throws IOException, InterruptedException {
    // ...
}
```

- Override method: **không** được thêm checked exception mới không tương thích với contract cha (có thể hẹp hơn / bỏ) — [oop.md](oop.md).
- Constructor cũng khai báo `throws` checked nếu cần.
- `main` có thể `throws Exception` cho script nhỏ — app lớn nên bắt ở biên ([main-function.md](main-function.md)).

---

## 8. Wrapping, rethrow & cause

### 8.1 Cause chain

```java
try {
    files.read(path);
} catch (IOException e) {
    throw new StorageException("Unable to read " + path, e);
}
```

Luôn truyền **cause** khi bọc — bảo toàn gốc rễ khi log `getCause()` / stack.

### 8.2 Rethrow

```java
catch (IOException e) {
    metrics.fail();
    throw e; // giữ stack gốc
}
```

Không làm:

```java
catch (IOException e) {
    throw new IOException(e.getMessage()); // mất stack / cause nếu quên
}
```

### 8.3 Sneaky / unchecked wrap

```java
catch (IOException e) {
    throw new UncheckedIOException(e);
}
```

Hữu ích khi implement `Runnable`/`Function` không cho checked.

### 8.4 Không nuốt exception

```java
catch (Exception e) {
    // trống — code smell
}
```

Ít nhất log; thường rethrow hoặc đổi thành lỗi domain rõ ràng (mục 13, 17).

---

## 9. Suppressed exceptions

Khi try-with-resources body ném `primary`, rồi `close()` cũng ném — exception từ `close` gắn vào primary qua `addSuppressed`.

```java
try {
    copy();
} catch (IOException e) {
    log.error("primary: {}", e.toString());
    for (Throwable s : e.getSuppressed()) {
        log.error("suppressed: {}", s.toString());
    }
    throw e;
}
```

Tự gắn suppressed:

```java
Exception primary = ...;
try {
    // ...
} catch (Exception e) {
    primary.addSuppressed(e);
}
throw primary;
```

Khi log, in cả suppressed (framework logging hiện đại thường đã hỗ trợ) — mục 15.

**Suppressed ≠ multi-error validation:** suppressed gắn lỗi phụ vào **một** primary (thường cleanup). Validation gom nhiều field fail → pattern collector / aggregator (mục 10).

---

## 10. Multi-failure patterns

Ngoài suppressed (cleanup), nhiều API cần **gom nhiều lỗi độc lập** rồi báo một lần.

### 10.1 Validation collector

```java
public final class ValidationErrors {
    private final List<String> messages = new ArrayList<>();

    public void add(String msg) { messages.add(msg); }
    public boolean hasErrors() { return !messages.isEmpty(); }

    public void throwIfAny() {
        if (hasErrors()) {
            throw new ValidationException(List.copyOf(messages));
        }
    }
}

// dùng
var errs = new ValidationErrors();
if (name.isBlank()) errs.add("name blank");
if (age < 0) errs.add("age negative");
errs.throwIfAny();
```

```java
public class ValidationException extends RuntimeException {
    private final List<String> messages;
    public ValidationException(List<String> messages) {
        super(String.join("; ", messages));
        this.messages = messages;
    }
    public List<String> messages() { return messages; }
}
```

### 10.2 Aggregator / `addSuppressed` khi “một primary + phụ”

Khi đã có exception chính và muốn gắn thêm lỗi đóng resource / flush:

```java
Exception primary = null;
for (AutoCloseable c : resources) {
    try {
        c.close();
    } catch (Exception e) {
        if (primary == null) primary = e;
        else primary.addSuppressed(e);
    }
}
if (primary != null) throw primary;
```

### 10.3 Thư viện aggregators (tóm tắt)

- Tự viết list + domain exception (nhẹ, kiểm soát API).
- Một số framework có `ConstraintViolationException`, problem-details multi-error — dùng kiểu đó ở biên HTTP thay vì lộ `SQLException`.
- Java SE **không** có `errors.Join` kiểu Go; suppressed + custom collector là hai công cụ chính.

Chọn:

| Tình huống | Pattern |
|------------|---------|
| Body fail + `close` fail | try-with-resources / `addSuppressed` |
| Nhiều field validate | collector → một `ValidationException` |
| Shutdown nhiều bước | primary + suppressed, hoặc list rồi join message |

---

## 11. `StackWalker` (tóm tắt)

`StackWalker` (Java 9+) duyệt stack **hiệu quả hơn** `Thread.currentThread().getStackTrace()` / `new Throwable().fillInStackTrace()` khi chỉ cần vài frame.

```java
StackWalker walker = StackWalker.getInstance(
        Set.of(StackWalker.Option.RETAIN_CLASS_REFERENCE));

String caller = walker.walk(frames ->
        frames.skip(1)
              .findFirst()
              .map(f -> f.getClassName() + "#" + f.getMethodName())
              .orElse("unknown"));
```

| Option | Ý nghĩa |
|--------|---------|
| `RETAIN_CLASS_REFERENCE` | Cho phép `getDeclaringClass()` |
| `SHOW_REFLECT_FRAMES` | Hiện reflection frames |
| `SHOW_HIDDEN_FRAMES` | Frame ẩn implementation |

Dùng cho diagnostics, security checks nhẹ, caller-sensitive logic — **không** thay exception thông thường cho lỗi nghiệp vụ.

---

## 12. Custom exceptions

```java
public class StorageException extends Exception {
    public StorageException(String message) {
        super(message);
    }
    public StorageException(String message, Throwable cause) {
        super(message, cause);
    }
}

public class NotFoundException extends RuntimeException {
    private final String id;
    public NotFoundException(String id) {
        super("Not found: " + id);
        this.id = id;
    }
    public String id() { return id; }
}
```

Hướng dẫn:

- Tên kết thúc `Exception`.
- Có ctor `(message)` và `(message, cause)`.
- Chọn checked vs unchecked **nhất quán** với khả năng recover của caller.
- Tránh hierarchy quá sâu; đừng bắt `Exception` rồi bọc không thêm thông tin.
- Field mang dữ liệu domain (`id`, `field`, HTTP status) khi caller cần rẽ nhánh — không nhồi mọi thứ vào message string.

---

## 13. Biên API: wrap hay che lỗi

Cause chain biến lỗi bên trong thành **một phần hợp đồng** nếu caller `instanceof` / unwrap xuống tận đáy. Đó là điều bạn muốn đôi khi, và là rò rỉ abstraction những lúc khác.

### 13.1 Wrap với cause — giữ contract gốc

Khi caller **nên** biết (và có thể xử lý) loại lỗi gốc:

```java
public Config loadConfig(Path path) throws IOException {
    try {
        return parse(Files.readString(path));
    } catch (IOException e) {
        throw new IOException("load config " + path, e); // vẫn là IOException
    }
}
```

Hoặc domain exception **có cause** khi message/context thuộc module bạn, nhưng gốc vẫn truy vết được:

```java
catch (IOException e) {
    throw new StorageException("read " + path, e);
}
```

### 13.2 Dịch sang domain — không lộ JDBC/JDK nội bộ

Repo hôm nay Postgres, mai có thể đổi — **không** để `SQLException` / driver type xuyên module public:

```java
public User get(long id) {
    try {
        return jdbc.query(...);
    } catch (SQLException e) {
        if (isNoData(e)) {
            throw new NotFoundException(String.valueOf(id));
        }
        throw new StorageException("get id=" + id, e); // cause nội bộ OK; type public = domain
    }
}
```

Public API của library/module nên khai báo **exception domain của bạn** (hoặc unchecked ổn định), không `throws SQLException` trừ khi bạn *là* JDBC facade.

### 13.3 Khi nào không wrap / không leak

| Làm | Tránh |
|-----|--------|
| Wrap + cause khi thêm ngữ cảnh (path, id, op) | `new X(e.getMessage())` mất cause |
| Dịch sentinel/domain ở biên module | Export `SQLException`, Hibernate, gRPC status thô ra API công khai |
| Opaque + log ở biên HTTP (`500` + correlation id) | Đẩy full stack / SQL text ra client |
| `UncheckedIOException` ở biên lambda | Bắt `Exception` sớm rồi nuốt |

Checklist biên:

- Mỗi tầng thêm **ngữ cảnh mới**, không lặp `"save: save: save:"`.
- Không wrap rồi **vừa** log **vừa** rethrow ở mọi tầng (mục 15).
- Module boundary (JPMS / package API): xem [packages-modules.md](packages-modules.md) — đừng leak type implementation qua `exports`.

---

## 14. `InterruptedException`, virtual threads & async unwrap

### 14.1 `InterruptedException`

Interruption là **hợp tác**. Khi catch mà không rethrow checked cùng loại, **khôi phục flag**:

```java
catch (InterruptedException e) {
    Thread.currentThread().interrupt();
    throw new TaskCanceledException("cancelled", e);
}
```

Nuốt mà không `interrupt()` → vòng chờ sau khó hủy đúng — chi tiết [threading.md](threading.md).

### 14.2 Virtual threads

- Exception trên virtual thread bubble như platform thread; không có model “error channel” riêng.
- Blocking I/O trên virtual thread vẫn có thể ném `InterruptedException` / `IOException` như cũ.
- Hủy task (structured concurrency / `Future.cancel` / interrupt) vẫn dựa interruption — đừng giả định virtual thread “tự sạch” khi bỏ qua interrupt.
- Uncaught trên virtual thread → `UncaughtExceptionHandler` của thread (hoặc default) — đăng ký ở biên worker.

```java
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    executor.submit(() -> {
        // ...
    });
}
```

Xem [threading.md](threading.md), [async.md](async.md), [java25.md](java25.md).

### 14.3 `CompletionException` / `ExecutionException` — unwrap

`CompletableFuture` bọc lỗi:

| API | Bọc |
|-----|-----|
| `join()` / `getNow` fail path / `whenComplete` | thường `CompletionException` (unchecked) |
| `get()` | `ExecutionException` (checked) + có thể `InterruptedException` |

```java
try {
    return future.join();
} catch (CompletionException e) {
    Throwable c = e.getCause() != null ? e.getCause() : e;
    if (c instanceof NotFoundException nfe) throw nfe;
    if (c instanceof RuntimeException re) throw re;
    if (c instanceof Error err) throw err;
    throw new IllegalStateException(c);
}
```

```java
try {
    return future.get();
} catch (InterruptedException e) {
    Thread.currentThread().interrupt();
    throw new TaskCanceledException(e);
} catch (ExecutionException e) {
    Throwable c = e.getCause() != null ? e.getCause() : e;
    // map tương tự
    throw new IllegalStateException(c);
}
```

- Đừng xử lý chỉ `CompletionException` mà quên `getCause()` — caller thường cần **domain** bên trong.
- `exceptionally` / `handle` nhận `Throwable` đã là cause hoặc wrapper tùy stage — kiểm tra rõ trong test (mục 16).
- Structured concurrency / task scopes: xem [async.md](async.md) cho pattern fail-fast vs shutdown.

---

## 15. Logging `Throwable`

### 15.1 Log một lần ở biên

Tầng dưới: wrap + throw. Biên (HTTP filter, `main`, worker loop): log **một lần**, rồi map sang response / exit code.

```java
// BAD — mọi tầng
catch (StorageException e) {
    log.error("failed", e);
    throw e;
}

// GOOD — tầng dưới
catch (IOException e) {
    throw new StorageException("save", e);
}
// biên
catch (StorageException e) {
    log.error("request failed id={}", id, e);
    respond500();
}
```

### 15.2 Include suppressed

```java
log.error("failed: {}", e.toString(), e); // hầu hết SLF4J/Log4j in stack + suppressed
for (Throwable s : e.getSuppressed()) {
    log.error("suppressed", s); // nếu formatter cũ bỏ sót
}
```

### 15.3 Structured logging

- Key thống nhất (`err` / `exception`), kèm correlation id, op, entity id — **không** nhồi secret (token, password) vào message.
- Prefer `log.error("msg", throwable)` (parameter cuối là `Throwable`) thay vì `log.error("msg " + e)` — mất stack.
- Multi-error validation: log `messages` list / JSON field, không chỉ `e.getMessage()` một dòng nếu cần triage.

### 15.4 Đừng log-then-rethrow khắp nơi

Log-then-rethrow ở mọi tầng → spam trùng, che tín hiệu thật. Metrics (`fail` counter) ở giữa OK; **full stack log** để ở biên.

---

## 16. Test exceptions

### 16.1 JUnit `assertThrows`

```java
@Test
void rejectsNegativeAge() {
    var ex = assertThrows(IllegalArgumentException.class, () -> user.setAge(-1));
    assertTrue(ex.getMessage().contains("age"));
}
```

### 16.2 Assert type, message, cause

```java
@Test
void wrapsIo() {
    var ex = assertThrows(StorageException.class, () -> service.load(missing));
    assertInstanceOf(IOException.class, ex.getCause());
    assertTrue(ex.getMessage().contains("load"));
}
```

### 16.3 Tránh “có gì đó ném là được”

```java
// Giòn / yếu
assertThrows(Exception.class, () -> service.save(bad));

// Rõ contract
assertThrows(ValidationException.class, () -> service.save(bad));
```

- Prefer kiểu **cụ thể** (hoặc domain) thay vì `Exception` / `Throwable`.
- Khi API bọc async: assert sau unwrap (`getCause()` của `CompletionException`).
- Table-driven: mỗi case `expectedType` + optional message fragment / cause type.
- Đừng assert toàn bộ stack trace string; message ổn định vừa đủ (field name, sentinel text).

---

## 17. Pitfalls

1. **Swallow empty catch** — `catch (Exception e) { }` nuốt lỗi; ít nhất log hoặc rethrow có chủ đích.
2. **`return` / `throw` trong `finally`** — che exception/return từ `try`; cấm trong style hiện đại.
3. **Mất cause** — `new X(e.getMessage())` hoặc `new X()` sau khi catch → mất gốc khi debug.
4. **`catch (Exception)` quá sớm** — bắt tổng quát giữa tầng rồi “xử lý chung” khiến caller không phân biệt NotFound / validation / I/O.
5. **Assert vs validation** — `assert` tắt được (`-da`); precondition API công khai dùng `Objects.requireNonNull` / `IllegalArgumentException`, không dựa `assert`.
6. **Log rồi rethrow mọi tầng** — trùng log (mục 15).
7. **Nuốt `InterruptedException`** — quên `Thread.currentThread().interrupt()`.
8. **Chỉ test “threw something”** — `assertThrows(Exception.class, …)` yếu (mục 16).
9. **Leak JDK/driver types** qua API module (mục 13).
10. **Dùng exception cho control flow** — `contains` / `Optional` thay vì bắt `NoSuchElementException` trên hot path.

---

## 18. Best practices & checklist

1. Bắt **cụ thể** tại nơi xử lý được; bắt tổng quát chỉ ở biên (filter, `main`, thread factory).
2. Phân biệt lỗi lập trình (`IAE`/`ISE`/`NPE`) với lỗi môi trường/I/O.
3. Prefer try-with-resources; khi debug đóng resource, kiểm tra **suppressed**.
4. Giữ message hữu ích, không lộ secret; kèm context (id, path) vừa đủ.
5. Không dùng exception cho điều khiển bình thường.
6. Wrap luôn kèm **cause**; mỗi tầng một ngữ cảnh mới.
7. Ở biên module: dịch sang domain exception — không leak `SQLException` / driver types.
8. `InterruptedException`: restore interrupt flag khi không rethrow cùng loại.
9. Async: unwrap `CompletionException` / `ExecutionException` trước khi map domain.
10. Log **một lần** ở biên; in cả suppressed; structured fields thống nhất.
11. Test bằng `assertThrows` + type/cause/message — không chỉ “có exception”.
12. Thread / virtual thread: `UncaughtExceptionHandler` / biên executor để không mất lỗi bỏ quên.
13. Multi-validate: collector / aggregator — đừng nhầm với suppressed cleanup.
14. `Error` hầu như không catch; không “recover” `OutOfMemoryError` kiểu thường.

### Checklist call site

```text
□ catch đủ cụ thể / đúng thứ tự subtype → supertype
□ try-with-resources cho AutoCloseable
□ wrap có cause + ngữ cảnh mới
□ biên module: domain type, không leak JDK nội bộ
□ InterruptedException → interrupt() hoặc rethrow
□ async → unwrap CompletionException / ExecutionException
□ log 1 lần ở biên (kèm suppressed)
□ test assertThrows(Type) + cause/message khi cần
□ không return trong finally; không empty catch
□ không dùng assert cho validation API công khai
```

---

## 19. Cheat sheet

```java
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.CompletionException;

public final class ExceptionDemo {

    public static String readUtf8(Path path) {
        try {
            return Files.readString(path);
        } catch (IOException e) {
            throw new UncheckedIOException("read " + path, e);
        }
    }

    public static void copy(Path from, Path to) throws StorageException {
        try (var in = Files.newInputStream(from);
             var out = Files.newOutputStream(to)) {
            in.transferTo(out);
        } catch (IOException e) {
            throw new StorageException("copy failed", e);
        }
    }

    public static <T> T joinUnwrap(java.util.concurrent.CompletableFuture<T> f) {
        try {
            return f.join();
        } catch (CompletionException e) {
            Throwable c = e.getCause() != null ? e.getCause() : e;
            if (c instanceof RuntimeException re) throw re;
            if (c instanceof Error err) throw err;
            throw new IllegalStateException(c);
        }
    }

    public static class StorageException extends Exception {
        public StorageException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    public static void main(String[] args) {
        Thread.setDefaultUncaughtExceptionHandler((t, e) -> {
            System.err.println("Uncaught in " + t.getName());
            e.printStackTrace();
        });

        try {
            System.out.println(readUtf8(Path.of("README.md")));
        } catch (UncheckedIOException e) {
            Throwable root = e.getCause() != null ? e.getCause() : e;
            System.err.println(root);
            for (Throwable s : e.getSuppressed()) {
                System.err.println("suppressed: " + s);
            }
        }
    }
}
```

---

## Phụ lục: Ngoại lệ JDK thường gặp

| Exception | Ý nghĩa nhanh |
|-----------|----------------|
| `NullPointerException` | Dereference null — phòng thủ / `Objects.requireNonNull` |
| `IllegalArgumentException` | Tham số không hợp lệ |
| `IllegalStateException` | Sai trạng thái đối tượng / vòng đời |
| `IndexOutOfBoundsException` | Chỉ số ngoài khoảng |
| `ClassCastException` | Cast sai — ưu tiên pattern/`instanceof` |
| `UnsupportedOperationException` | Thao tác không hỗ trợ (immutable list…) |
| `ConcurrentModificationException` | Sửa collection khi duyệt fail-fast |
| `IOException` / `UncheckedIOException` | I/O |
| `InterruptedException` | Thread bị interrupt khi chờ |
| `CompletionException` | Bọc lỗi trong `CompletableFuture` (`join`) |
| `ExecutionException` | Bọc lỗi trong `Future.get()` / tương tự |

---

## Xem thêm

| File | Liên quan |
|------|-----------|
| [keywords.md](keywords.md) | `try` `catch` `throw` `throws` `finally` |
| [statements.md](statements.md) | Khối `try`, thứ tự thực thi |
| [threading.md](threading.md) | Interrupt, virtual threads, uncaught handler |
| [async.md](async.md) | `CompletableFuture`, structured concurrency |
| [oop.md](oop.md) | Override `throws`, hierarchy kiểu |
| [java25.md](java25.md) | Java 25 LTS — concurrency & language notes |
| [packages-modules.md](packages-modules.md) | Biên module / không leak type |
| [main-function.md](main-function.md) | Bắt ở `main` / launcher |

---

*Tham chiếu nhanh — Java 25 LTS. Checked/unchecked không đổi; thực hành hiện đại nhấn mạnh virtual threads, unwrap async wrappers, và biên API sạch.*
