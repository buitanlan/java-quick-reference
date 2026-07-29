# Exception trong Java

Xử lý lỗi với hệ phân cấp `Throwable`, checked vs unchecked, `try`/`catch`/`finally`, try-with-resources, `throw`/`throws`, wrapping, suppressed exceptions, và `StackWalker` — **Java 25 LTS**.

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
- [10. `StackWalker` (tóm tắt)](#10-stackwalker-tóm-tắt)
- [11. Custom exceptions](#11-custom-exceptions)
- [12. Best practices](#12-best-practices)
- [13. Cheat sheet](#13-cheat-sheet)

---

## 1. Tổng quan & triết lý

- Exception báo **điều kiện bất thường** — không dùng cho luồng điều khiển bình thường (tránh parse bằng cách ném/bắt).
- Ném/bắt có chi phí (stack walk, object allocation) — không đặt trên hot-path “happy path”.
- Java phân biệt **checked** (bắt buộc xử lý hoặc khai báo) và **unchecked** (`RuntimeException` / `Error`).
- Virtual threads: exception vẫn bubble theo stack task; `InterruptedException` / hủy vẫn cần tôn trọng khi API blocking hỗ trợ interruption.

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

Mọi thứ ném được đều là `Throwable`. Thực tế ứng dụng hầu như chỉ làm việc với `Exception` và các subtype.

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

**Tranh luận thực dụng:** nhiều codebase hiện đại prefer unchecked + tài liệu rõ; vẫn tôn trọng checked của JDK (`IOException`) hoặc bọc `UncheckedIOException` ở biên API functional/lambda.

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

- Override method: **không** được thêm checked exception mới không tương thích với contract cha (có thể hẹp hơn / bỏ).
- Constructor cũng khai báo `throws` checked nếu cần.
- `main` có thể `throws Exception` cho script nhỏ — app lớn nên bắt ở biên.

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

Ít nhất log; thường rethrow hoặc đổi thành lỗi domain rõ ràng.

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

Khi log, in cả suppressed (framework logging hiện đại thường đã hỗ trợ).

---

## 10. `StackWalker` (tóm tắt)

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

## 11. Custom exceptions

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

---

## 12. Best practices

1. Bắt **cụ thể** tại nơi xử lý được; bắt tổng quát chỉ ở biên (filter, `main`, thread factory).
2. Phân biệt lỗi lập trình (`IAE`/`ISE`/`NPE`) với lỗi môi trường/I/O.
3. Prefer try-with-resources; kiểm tra suppressed khi debug “đóng file lỗi”.
4. Giữ message hữu ích, không lộ secret; kèm context (id, path) vừa đủ.
5. Không dùng exception cho điều khiển bình thường (`contains` thay vì bắt `NSEE` nếu có API `Optional`/`boolean`).
6. `InterruptedException`: khôi phục interrupt flag khi không rethrow:

```java
catch (InterruptedException e) {
    Thread.currentThread().interrupt();
    throw new TaskCanceledException(e);
}
```

7. Thread / virtual thread: handler `Thread.setUncaughtExceptionHandler` / executor `afterExecute` để không mất lỗi “bỏ quên”.
8. Logging: log một lần ở biên; tránh log-then-rethrow trùng lặp ở mọi tầng.

---

## 13. Cheat sheet

```java
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;

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
| `CompletionException` | Bọc lỗi trong `CompletableFuture` |
