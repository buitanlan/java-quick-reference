# Package & Module

Java tổ chức mã nguồn theo **package** (namespace logic + cấu trúc thư mục) và, từ Java 9, theo **JPMS module**
(strong encapsulation ở mức JAR/module). Java **25 LTS** bổ sung **JEP 511 Module Import Declarations** —
`import module …` — để import toàn bộ package exported của một module trong một dòng.

Tài liệu này bao phủ declaration/import, module-info, automatic modules, và classpath vs module path ở mức thực hành.

---

## Mục lục

- [Package \& Module](#package--module)
  - [Mục lục](#mục-lục)
  - [1. Package declaration](#1-package-declaration)
  - [2. Default package](#2-default-package)
  - [3. `import` \& static import](#3-import--static-import)
  - [4. JEP 511 — Module Import Declarations (Java 25)](#4-jep-511--module-import-declarations-java-25)
  - [5. JPMS tổng quan](#5-jpms-tổng-quan)
  - [6. `module-info.java`](#6-module-infojava)
    - [6.1 `requires` / `requires transitive` / `requires static`](#61-requires--requires-transitive--requires-static)
    - [6.2 `exports` / `exports … to`](#62-exports--exports--to)
    - [6.3 `opens` / `opens … to`](#63-opens--opens--to)
    - [6.4 `provides` / `uses` (ServiceLoader)](#64-provides--uses-serviceloader)
  - [7. Automatic modules \& unnamed module](#7-automatic-modules--unnamed-module)
  - [8. Classpath vs Module path](#8-classpath-vs-module-path)
  - [9. Thực hành build \& lỗi thường gặp](#9-thực-hành-build--lỗi-thường-gặp)

---

## 1. Package declaration

```java
package com.example.app;

public class UserService {
    // ...
}
```

- `package` phải là **câu lệnh đầu** trong file (trước mọi `import`, sau comments/annotations gắn package nếu có).
- Tên package theo convention reverse-DNS: `com.company.product.module`.
- Cấu trúc thư mục **phải khớp** package: `com/example/app/UserService.java`.
- Thành viên **package-private** (không modifier): visible trong cùng package, không cần export module nếu cùng module.

Annotation gắn package nằm trong `package-info.java`:

```java
/** API nội bộ của app. */
@Deprecated
package com.example.app;
```

---

## 2. Default package

File không có `package` → thuộc **default package** (unnamed package).

```java
// Không có dòng package
public class Scratch {
    public static void main(String[] args) {
        System.out.println("default package");
    }
}
```

- Hợp lệ cho demo/compact source; **không** dùng trong thư viện hay codebase lớn.
- Class trong named package **không** được import type từ default package.
- JPMS: code trong named module cũng không nên dựa vào default package.

---

## 3. `import` & static import

```java
package com.example.app;

import java.util.List;                    // single-type
import java.util.concurrent.*;            // on-demand (package)
import static java.lang.Math.PI;          // static member
import static java.util.Collections.emptyList;

public class Demo {
    List<String> xs = emptyList();
    double circumference(double r) {
        return 2 * PI * r;
    }
}
```

Quy tắc:

- `java.lang.*` được import ngầm — không cần viết `import java.lang.String`.
- Import **không** phải dependency runtime; chỉ rút gọn tên tại compile-time.
- On-demand (`.*`) không đệ quy subpackage: `import java.util.*` không kéo `java.util.concurrent`.
- Xung đột tên → dùng **FQCN** (`java.util.Date` vs `java.sql.Date`).
- Static import tiện cho hằng/enum/method factory; lạm dụng làm khó đọc nguồn gốc.

Import nested type:

```java
import com.example.Outer.Inner;
```

---

## 4. JEP 511 — Module Import Declarations (Java 25)

**JEP 511** (final Java 25) cho phép import **mọi package exported** của một module:

```java
import module java.base;
import module java.sql;
import module java.net.http;

public class ModImportDemo {
    void demo() throws Exception {
        // Các kiểu exported từ java.base / java.sql / java.net.http
        // dùng được mà không cần import từng package
        var client = java.net.http.HttpClient.newHttpClient();
        // hoặc ngắn nếu không Ambiguous:
        // HttpClient client = HttpClient.newHttpClient();
    }
}
```

Đặc điểm thực dụng:

- `import module M;` tương đương import on-demand tất cả package mà `M` **exports** (kể cả exports chuyển tiếp
  qua `requires transitive` theo quy tắc JEP — đối chiếu spec khi có shadowing).
- Giảm boilerplate trong file dùng nhiều API JDK (IO, collections, concurrent, …).
- **Ambiguous name**: nếu hai module export cùng simple name → lỗi biên dịch; giải bằng single-type import hoặc FQCN.
- Không thay `requires` trong `module-info.java`: module của bạn vẫn phải **requires** module đó nếu đang ở module path.
- `java.base` luôn available; `import module java.base;` chủ yếu để kéo toàn bộ package exported của base vào scope tên.

```java
import module java.base;
import java.util.List; // vẫn có thể kết hợp import thường để làm rõ / giải ambiguity

record Point(int x, int y) {}
```

Khi nào dùng:

- File script/compact, notebook-style, hoặc class dùng dày đặc API nhiều package cùng module.
- API public library lớn: cân nhắc import tường minh từng type để đọc diff/review dễ hơn.

---

## 5. JPMS tổng quan

**Java Platform Module System** (Java 9+):

- Mỗi module có tên (`com.example.app`), mô tả trong `module-info.java`.
- **Strong encapsulation**: package không `exports` thì type `public` cũng không accessible ngoài module
  (trừ deep reflection khi `opens` / `--add-opens`).
- **Explicit dependencies**: `requires` liệt kê module cần thiết; thiếu → lỗi lúc resolve.
- JDK chính cũng là modules: `java.base`, `java.sql`, `java.xml`, `jdk.compiler`, …

Hai “thế giới” runtime:

| | Unnamed module (classpath) | Named modules (module path) |
|---|---|---|
| Đọc | Đọc hầu hết classpath | Chỉ theo `requires` + exports |
| Export | Mọi package coi như exported tới unnamed | Chỉ package `exports` |
| Dùng khi | App legacy, Spring Boot điển hình nhiều năm | Thư viện JDK-style, tool JDK, một số app chuẩn hóa |

---

## 6. `module-info.java`

Đặt ở root của module source (cùng cấp cây package):

```java
module com.example.app {
    requires java.sql;
    requires transitive com.example.api;

    exports com.example.app.api;
    exports com.example.app.spi to com.example.plugin;

    opens com.example.app.internal to com.fasterxml.jackson.databind;

    uses com.example.app.spi.Codec;
    provides com.example.app.spi.Codec with com.example.app.internal.JsonCodec;
}
```

- Tên module thường mirror package gốc; **không** bắt buộc trùng, nhưng nên ổn định (đổi tên module là breaking).
- `module-info.java` biên dịch thành `module-info.class`.
- Open module: `open module com.example.app { … }` — mở tất cả package cho deep reflection (ít dùng cho lib).

### 6.1 `requires` / `requires transitive` / `requires static`

```java
module com.example.app {
    requires java.xml;                    // bắt buộc lúc compile & runtime
    requires transitive com.example.api;  // re-export: ai requires app cũng đọc được api
    requires static java.compiler;        // optional lúc runtime (compile-time cần)
}
```

- `requires M`: phụ thuộc cứng.
- `requires transitive M`: phụ thuộc API — client của module bạn cần thấy kiểu từ `M`.
- `requires static M`: có mặt khi biên dịch; runtime có thể vắng (code phải chịu được thiếu module).

### 6.2 `exports` / `exports … to`

```java
exports com.example.app.api;                              // mọi module
exports com.example.app.internal.support to com.example.x; // qualified export
```

- Chỉ package **trực tiếp** được liệt kê; subpackage không tự export.
- Type `public` trong package không export → không dùng được ngoài module (kể cả public).

### 6.3 `opens` / `opens … to`

```java
opens com.example.app.model; // deep reflection từ mọi module
opens com.example.app.model to org.hibernate.orm.core;
```

- `exports` = access compile-time + strong encapsulation thông thường.
- `opens` = cho phép **deep reflection** (set private fields, …) — cần cho nhiều framework (JPA, Jackson trước khi dùng
  method handles / records thuần).
- Runtime flag tương đương tạm thời: `--add-opens m/p=ALL-UNNAMED`.

### 6.4 `provides` / `uses` (ServiceLoader)

```java
// module provider
provides com.example.spi.Greeter with com.example.impl.EnGreeter;

// module consumer
uses com.example.spi.Greeter;
```

```java
ServiceLoader<Greeter> loader = ServiceLoader.load(Greeter.class);
for (Greeter g : loader) {
    System.out.println(g.greet("Java"));
}
```

- Interface SPI nên ở module API exported; implementation ở module khác, không export package impl nếu không cần.
- Trên classpath, dùng file `META-INF/services/...` (cơ chế cũ vẫn hoạt động trong nhiều setup).

---

## 7. Automatic modules & unnamed module

**Automatic module**: JAR đặt trên **module path** nhưng không có `module-info` → tên module suy từ filename
(`foo-bar-1.2.jar` → thường `foo.bar`) hoặc `Automatic-Module-Name` trong manifest.

```text
Manifest-First: Automatic-Module-Name: com.example.legacy
```

- Automatic module đọc mọi module khác; exports mọi package — “nới lỏng” để migrate dần.
- **Unnamed module**: tất cả classpath JARs — đọc được named modules; named modules **không** `requires` unnamed
  (một chiều).

Chiến lược migrate:

1. Giữ app trên classpath.
2. Đặt dependencies ổn định lên module path với `Automatic-Module-Name`.
3. Thêm `module-info` cho từng artifact khi sẵn sàng.

---

## 8. Classpath vs Module path

```text
# Classpath (truyền thống)
java -cp "app.jar;lib/*" com.example.Main

# Module path
java -p mods -m com.example.app/com.example.app.Main

# Hỗn hợp (thực tế hay gặp)
java -p mods -cp extra/* -m com.example.app/com.example.app.Main
```

| | Classpath | Module path |
|---|---|---|
| Đơn vị | JAR / directory class | Module (JAR có hoặc không module-info) |
| Encapsulation | Public = accessible | Theo `exports`/`opens` |
| Split packages | Nguy hiểm, khó đoán | Cấm giữa các modules |
| Công cụ | Mọi build tool | Maven/Gradle hỗ trợ; cần cấu hình rõ |

Gợi ý:

- Ứng dụng enterprise điển hình: classpath vẫn phổ biến; hiểu JPMS để làm việc với JDK modules & native access.
- Thư viện JDK-oriented / CLI tool: nên có `module-info`.
- Tránh **split package** (cùng package ở hai module/JAR trên module path).

---

## 9. Thực hành build & lỗi thường gặp

Maven (phác thảo):

```text
src/main/java/module-info.java
src/main/java/com/example/app/...
```

```xml
<!-- maven-compiler-plugin release 25 -->
<release>25</release>
```

Lỗi thường gặp:

| Triệu chứng | Nguyên nhân / hướng xử lý |
|---|---|
| `package X is declared in module M, but module N does not read it` | Thiếu `requires M` |
| `package X is not visible` / cannot access | Package chưa `exports` |
| `module reads package … from both` | Split package |
| Illegal reflective access / InaccessibleObjectException | Cần `opens` hoặc `--add-opens` |
| Ambiguous khi `import module` | Trùng simple name — import tường minh |

Best practices:

- Package theo feature (`…order`, `…payment`), không chỉ theo layer nếu monoreth quá sâu.
- Export tối thiểu; `opens` qualified tới framework cụ thể.
- Dùng `requires transitive` chỉ khi kiểu của dependency xuất hiện ở API public của bạn.
- Java 25: kết hợp `import module java.base;` trong file dày API — nhớ giải ambiguity sớm.
- Compact source / default package: OK cho học; production → named package ± module.

```java
// File hiện đại: module import + named package
package com.example.demo;

import module java.base;
import module java.net.http;

public class Fetch {
    public static void main(String[] args) throws Exception {
        var client = HttpClient.newHttpClient();
        var req = HttpRequest.newBuilder(URI.create("https://example.com")).GET().build();
        System.out.println(client.send(req, HttpResponse.BodyHandlers.ofString()).statusCode());
    }
}
```
