# Hàm Main

Mỗi chương trình Java độc lập cần một điểm vào (entry point) để JVM khởi chạy. Điểm vào cổ điển là
`public static void main(String[] args)` trên một class có tên. Từ **Java 25 LTS**, **JEP 512 Compact Source Files
and Instance Main Methods** đã trở thành tính năng chính thức: có thể viết chương trình đơn giản bằng *unnamed class*,
*instance main*, và cú pháp launch rút gọn — phù hợp script/demo — rồi chuyển dần sang class có tên khi dự án lớn lên.

Tài liệu này là tham khảo thực hành: signature hợp lệ, launcher, mã thoát, và lộ trình từ compact source sang named class.

> Cross-link: [java25.md](java25.md) (JEP 512) · [packages-modules.md](packages-modules.md) · [methods.md](methods.md) ·
> [oop.md](oop.md) · [threading.md](threading.md) / [async.md](async.md) (công việc trong main)

---

## Mục lục

- [Hàm Main](#hàm-main)
  - [Mục lục](#mục-lục)
  - [1. Tổng quan điểm vào](#1-tổng-quan-điểm-vào)
  - [2. Classic `public static void main`](#2-classic-public-static-void-main)
  - [3. Overload \& `String... args`](#3-overload--string-args)
  - [4. Tham số dòng lệnh](#4-tham-số-dòng-lệnh)
  - [5. JEP 512 — Compact Source Files \& Instance Main (Java 25)](#5-jep-512--compact-source-files--instance-main-java-25)
    - [5.1 Unnamed class](#51-unnamed-class)
    - [5.2 Instance main \& simplified launch](#52-instance-main--simplified-launch)
    - [5.3 Các dạng main được launcher chấp nhận](#53-các-dạng-main-được-launcher-chấp-nhận)
    - [5.4 `java.lang.IO`](#54-javalangio)
  - [6. `java` launcher](#6-java-launcher)
  - [7. Exit codes \& `System.exit`](#7-exit-codes--systemexit)
  - [8. Compact source → named class (migration)](#8-compact-source--named-class-migration)
  - [9. Pitfalls (Bẫy)](#9-pitfalls-bẫy)
  - [10. Best practices](#10-best-practices)

---

## 1. Tổng quan điểm vào

- JVM tìm **một** phương thức main trên class được chỉ định (hoặc trên unnamed class của compact source).
- Classic: `public static void main(String[] args)` — vẫn là chuẩn cho hầu hết ứng dụng production.
- Java 25: compact source + instance main cho phép bỏ boilerplate `class`/`public`/`static` ở chương trình nhỏ.
- Giá trị trả về của tiến trình: mặc định **0** nếu main kết thúc bình thường; dùng `System.exit(code)` hoặc
  `Runtime.getRuntime().halt(code)` khi cần mã thoát tường minh.
- Không có `async Main` kiểu C#; I/O bất đồng bộ dùng virtual threads / `CompletableFuture` / structured concurrency
  bên trong main.

---

## 2. Classic `public static void main`

```java
public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello World!");
    }
}
```

Yêu cầu (class có tên, mô hình truyền thống):

- Class chứa main phải là **public** nếu file tên trùng class public, hoặc ít nhất **accessible** từ launcher
  (package-private class vẫn chạy được nếu chỉ định đúng binary name).
- `main` phải là **`public static`**, tên chính xác `main`, trả về **`void`**.
- Tham số: `String[]` hoặc `String...` (varargs — cùng bytecode array).
- Có thể ném checked exception: `throws Exception` hợp lệ; exception không bắt → JVM in stacktrace và exit ≠ 0.

```java
package com.example;

public final class App {
    public static void main(String[] args) throws Exception {
        if (args.length == 0) {
            throw new IllegalArgumentException("missing args");
        }
        System.out.println(args[0]);
    }
}
```

Biên dịch & chạy:

```text
javac com/example/App.java
java com.example.App hello
```

Hoặc (source-file mode, Java 11+):

```text
java com/example/App.java hello
```

---

## 3. Overload & `String... args`

Chỉ **một** signature được coi là entry point hợp lệ theo quy tắc launcher. Các overload khác là method bình thường —
không tự động trở thành điểm vào.

```java
public class Overloads {
    // Entry point thật sự
    public static void main(String[] args) {
        main(args.length);           // gọi overload khác
    }

    public static void main(int n) { // KHÔNG phải entry point
        System.out.println(n);
    }

    // Tương đương String[] về bytecode; cũng hợp lệ làm entry point
    // (chọn MỘT trong hai — không khai báo cả hai cùng lúc)
    // public static void main(String... args) { }
}
```

- `String... args` ≡ `String[] args` tại runtime; bên trong method `args` vẫn là mảng.
- `static void main()` không tham số: **không** là entry point classic (trừ khi dùng quy tắc JEP 512 / instance main
  — xem mục 5). Với class có tên kiểu cũ, launcher đòi hỏi tham số `String[]`/`String...`.
- Không dùng `Object[]`, `List<String>`, hay generic làm tham số main entry.

---

## 4. Tham số dòng lệnh

```java
public class Cli {
    public static void main(String[] args) {
        // java Cli a "b c" d  →  args = ["a", "b c", "d"]
        for (int i = 0; i < args.length; i++) {
            System.out.printf("[%d] %s%n", i, args[i]);
        }
    }
}
```

- Shell tách token trước khi truyền vào JVM; quote theo OS (`"` trên Windows, `'`/`"` trên Unix).
- Không bao gồm tên class / options của `java` (`-Xmx`, `--enable-preview`, …) trong `args`.
- Parse thư viện: `java.util` thủ công, hoặc thư viện CLI bên ngoài; JDK không có argparse chuẩn như Go/Python.
- Environment: `System.getenv("PATH")`; properties: `System.getProperty("user.dir")`, `-Dkey=value`.

---

## 5. JEP 512 — Compact Source Files & Instance Main (Java 25)

**JEP 512** (final trong Java 25) chuẩn hóa trải nghiệm “chương trình đơn giản”:

1. **Compact source file** — file nguồn không khai báo class tường minh → trình biên dịch tạo **unnamed class**.
2. **Instance main methods** — cho phép `void main()` / `void main(String[] args)` dạng instance (không bắt buộc `static`).
3. **Simplified launch** — `java Hello.java` chạy trực tiếp; giảm yêu cầu `public`/`static` cho entry đơn giản.

Mục tiêu: học/demo/script gần gũi hơn, vẫn migrate được sang class có tên khi cần package/module/test.

### 5.1 Unnamed class

```java
// Hello.java — compact source (không có khai báo class)
void main() {
    System.out.println("Hello from compact source");
}
```

- File compact source được biên dịch thành class **không tên** (unnamed); không dùng làm API public, không reference
  từ class khác bằng tên thông thường.
- Có thể chứa fields, methods, nested types phụ trợ trong cùng file theo quy tắc của JEP — coi như “lớp ẩn” bao quanh.
- Không khai báo `package` trong compact source điển hình; khi cần package/module → chuyển sang named class.

### 5.2 Instance main & simplified launch

```java
// Instance main — không static
void main(String[] args) {
    IO.println("args=" + args.length); // API đơn giản hóa in (nếu dùng trong compact context hiện đại)
}
```

Hoặc classic static vẫn hợp lệ trong compact source:

```java
static void main() {
    System.out.println("static no-arg main");
}
```

Launcher (Java 25) chọn candidate main theo thứ tự ưu tiên đã chuẩn hóa trong JEP (tóm tắt thực dụng):

1. Ưu tiên `main` với `String[]`/`String...` nếu có.
2. Cho phép instance main: JVM tạo instance (constructor không-arg) rồi gọi.
3. Cho phép `main()` không tham số trong mô hình compact / flexible launch.

> Chi tiết thứ tự chính xác nên đối chiếu JEP 512 / release notes JDK 25 khi viết tool dựa vào reflection entry point.

### 5.3 Các dạng main được launcher chấp nhận

Trong hệ sinh thái Java 25 (classic + JEP 512), các dạng thường gặp:

```java
// Classic — production chuẩn
public static void main(String[] args) { }
public static void main(String... args) { }

// Compact / flexible — Java 25
void main() { }
void main(String[] args) { }
static void main() { }
static void main(String[] args) { }
```

- Instance main đòi hỏi class **instantiable** (constructor accessible không-arg phù hợp quy tắc launch).
- Không dựa vào instance main cho framework lớn (Spring Boot, Jakarta EE, …) — chúng kỳ vọng static classic main.

### 5.4 `java.lang.IO`

JEP 512 kèm class **`java.lang.IO`** (cùng module `java.base`) cho I/O console đơn giản trong compact source:

```java
void main() {
    IO.println("Hello, Java 25");
    String name = IO.readln("Name: ");
    IO.println("hi " + name);
}
```

- `IO.println` / `IO.print` / `IO.readln` — không cần `System.out` cho script.
- Production app vẫn dùng logging / `System.out` có chủ đích; `IO` không thay `java.nio` hay HTTP.
- Compact source import sẵn một số kiểu đơn giản theo JEP — khi migrate sang named class, thêm `import` tường minh.

---

## 6. `java` launcher

Các cách chạy phổ biến:

```text
# Classpath mode
java -cp out com.example.App arg1 arg2

# Module path
java -p mods -m com.example/com.example.App

# Chạy trực tiếp file nguồn (single-file / compact)
java App.java
java Hello.java

# Tuỳ chọn thường dùng
java -Xmx512m -Dconfig=prod -ea com.example.App
```

| Thành phần | Ý nghĩa |
|---|---|
| `-cp` / `-classpath` | Class path (JAR/directories) |
| `-p` / `--module-path` | Module path |
| `-m` / `--module` | `module[/mainClass]` |
| `-jar app.jar` | Chạy JAR có `Main-Class` trong manifest |
| `--enable-native-access` | Native access (liên quan FFM / restricted) |
| `-ea` / `-enableassertions` | Bật `assert` |

Manifest JAR:

```text
Main-Class: com.example.App
```

```text
jar --create --file app.jar --main-class com.example.App -C out .
java -jar app.jar
```

---

## 7. Exit codes & `System.exit`

```java
public class ExitDemo {
    public static void main(String[] args) {
        if (args.length == 0) {
            System.err.println("usage: ExitDemo <file>");
            System.exit(2); // convention: usage/cli error
        }
        try {
            run(args[0]);
            // return ngầm → exit code 0
        } catch (Exception e) {
            e.printStackTrace(System.err);
            System.exit(1);
        }
    }

    static void run(String file) { /* ... */ }
}
```

- **`System.exit(status)`**: khởi động shutdown sequence — chạy shutdown hooks, rồi kết thúc JVM.
- **`Runtime.getRuntime().halt(status)`**: thoát **ngay**, bỏ qua hooks — chỉ dùng khi hooks treo/deadlock.
- Uncaught exception trên non-daemon thread (thường là main): JVM in trace, exit code khác 0 (thường 1).
- Shutdown hooks:

```java
Runtime.getRuntime().addShutdownHook(Thread.ofVirtual().unstarted(() -> {
    // dọn tài nguyên; giữ ngắn, tránh block lâu
}));
```

Quy ước mã thoát (không bắt buộc nhưng phổ biến): `0` thành công, `1` lỗi chung, `2` lỗi cú pháp/CLI.

---

## 8. Compact source → named class (migration)

Lộ trình thực tế khi chương trình lớn dần:

**Bước 1 — Compact**

```java
// Greeter.java
void main(String[] args) {
    var name = args.length > 0 ? args[0] : "world";
    System.out.println("Hello, " + name);
}
```

**Bước 2 — Named class, vẫn static/instance main đơn giản**

```java
public class Greeter {
    public static void main(String[] args) {
        var name = args.length > 0 ? args[0] : "world";
        System.out.println("Hello, " + name);
    }
}
```

**Bước 3 — Package + tách logic**

```java
package com.example.cli;

public final class Greeter {
    public static void main(String[] args) {
        new GreeterApp().run(args);
    }
}

final class GreeterApp {
    void run(String[] args) { /* business logic, testable */ }
}
```

**Bước 4 — Module (khi cần strong encapsulation)**

```java
// module-info.java
module com.example.cli {
    // exports / requires theo nhu cầu
}
```

Checklist migrate:

- Đặt tên class trùng file (`Greeter.java` → `class Greeter`).
- Thêm `package`, chuyển sang cấu trúc thư mục `src/main/java/...`.
- Đổi instance main → `public static void main` nếu framework/tooling yêu cầu.
- Thêm build tool (Maven/Gradle), test, `module-info` nếu dùng JPMS.
- Không giữ unnamed class trong thư viện chia sẻ — chỉ dùng cho app entry/demo.

---

## 9. Pitfalls (Bẫy)

1. **Sai chữ ký classic** — `Main`, `main(String args)`, `public void main` (thiếu `static`) → launcher không tìm thấy entry / `NoSuchMethodError: main`.
2. **Instance main không instantiable** — class abstract, không có no-arg ctor phù hợp, hoặc ctor ném → launch thất bại dù có `void main(...)`.
3. **Unnamed class như API** — compact source không phải library type; không `import`/reference từ file khác như class có tên.
4. **Nhầm overload với entry** — nhiều `main` overload: launcher chọn theo quy tắc JEP 512 / classic; đừng giả định “method đầu tiên trong file”.
5. **Sai tên class khi launch** — `java App` cần `App.class` trên classpath; package phải khớp (`java com.example.App`).
6. **Daemon / non-daemon** — main return nhưng còn non-daemon thread → JVM **không** thoát; kiểm soát vòng đời rõ — [threading.md](threading.md).
7. **`IO` chỉ từ 25** — `java.lang.IO` không có trên 21; compact source dùng `IO.println` sẽ không compile `--release 21`.

---

## 10. Best practices

- **Production**: giữ `public static void main(String[] args)` + named class; framework (Spring Boot, Jakarta EE, …) kỳ vọng dạng này.
- **Java 25**: compact source / instance main cho học, script, prototype; migrate sớm khi cần package, test, module — mục 8.
- **Test**: JUnit không gọi main; tách `main` mỏng, logic vào class có thể test.
- Nhiều main trong project ổn — chỉ class được chỉ định trên CLI / manifest mới chạy.

```java
// Pattern khuyến nghị production
public final class Application {
    private Application() {}

    public static void main(String[] args) {
        int code = new Application().run(args);
        if (code != 0) {
            System.exit(code);
        }
    }

    int run(String[] args) {
        // parse, wire dependencies, start
        return 0;
    }
}
```

---

*Tham chiếu nhanh — Java 25 LTS. Classic `main` ổn định từ lâu; compact source & instance main: [JEP 512](https://openjdk.org/jeps/512).*
