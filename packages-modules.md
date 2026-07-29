# Package & Module

Java tổ chức mã nguồn theo **package** (namespace logic + cấu trúc thư mục) và, từ Java 9, theo **JPMS module**
(strong encapsulation ở mức JAR/module). Tài liệu nhắm **Java 25 LTS**: declaration/import, `module-info`,
automatic modules, classpath vs module path, ServiceLoader, và **JEP 511** `import module …`.

> Cross-link: [java25.md](java25.md) (JEP 511) · [keywords.md](keywords.md) · [oop.md](oop.md) ·
> [exceptions.md](exceptions.md) · [main-function.md](main-function.md) · [README.md](README.md)

---

## Mục lục

- [1. Package declaration](#1-package-declaration)
- [2. Default package](#2-default-package)
- [3. `import` & static import](#3-import--static-import)
- [4. JEP 511 — Module Import Declarations (Java 25)](#4-jep-511--module-import-declarations-java-25)
- [5. JPMS tổng quan](#5-jpms-tổng-quan)
- [6. `module-info.java`](#6-module-infojava)
- [7. Automatic modules & unnamed module](#7-automatic-modules--unnamed-module)
- [8. Classpath vs Module path (Maven / Gradle)](#8-classpath-vs-module-path-maven--gradle)
- [9. Ma trận lỗi JPMS thường gặp](#9-ma-trận-lỗi-jpms-thường-gặp)
- [10. ServiceLoader / `provides` / `uses` — pitfalls](#10-serviceloader--provides--uses--pitfalls)
- [11. Pitfalls (Bẫy)](#11-pitfalls-bẫy)
- [12. Best practices & checklist](#12-best-practices--checklist)
- [Xem thêm](#xem-thêm)

---

## 1. Package declaration

```java
package com.example.app;

public class UserService {
    // ...
}
```

- `package` phải là **câu lệnh đầu** trong file (trước mọi `import`; sau comments / annotations gắn package nếu có).
- Tên package theo convention reverse-DNS: `com.company.product.module`.
- Cấu trúc thư mục **phải khớp** package: `com/example/app/UserService.java`.
- Thành viên **package-private** (không modifier): visible trong cùng package; trong cùng named module không cần `exports`.

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

- Hợp lệ cho demo / compact source; **không** dùng trong thư viện hay codebase lớn.
- Class trong named package **không** được import type từ default package.
- JPMS: named module cũng không nên dựa vào default package.

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

- `java.lang.*` được import ngầm — không cần `import java.lang.String`.
- Import **không** phải dependency runtime; chỉ rút gọn tên tại compile-time.
- On-demand (`.*`) không đệ quy subpackage: `import java.util.*` không kéo `java.util.concurrent`.
- Xung đột tên → dùng **FQCN** (`java.util.Date` vs `java.sql.Date`).
- Static import tiện cho hằng / enum / factory; lạm dụng làm khó đọc nguồn gốc.

```java
import com.example.Outer.Inner; // nested type
```

---

## 4. JEP 511 — Module Import Declarations (Java 25)

**JEP 511** (final trong Java 25) cho phép import **mọi package exported** của một module. Tóm tắt LTS: [java25.md §2.3](java25.md#23-jep-511--module-import-declarations).

```java
import module java.base;
import module java.sql;
import module java.net.http;

public class ModImportDemo {
    void demo() throws Exception {
        // Các kiểu exported từ các module trên vào scope tên
        var client = HttpClient.newHttpClient();
        var req = HttpRequest.newBuilder(URI.create("https://example.com")).GET().build();
        System.out.println(client.send(req, HttpResponse.BodyHandlers.ofString()).statusCode());
    }
}
```

Đặc điểm thực dụng:

| Điểm | Chi tiết |
|------|----------|
| Phạm vi | Tương đương on-demand mọi package mà module **exports** (kể cả qua `requires transitive` theo quy tắc JEP) |
| Ambiguous | Hai module export cùng simple name → lỗi biên dịch → single-type import hoặc FQCN |
| `requires` | `import module` **không** thay `requires` trong `module-info` — module bạn vẫn phải đọc module đó |
| `java.base` | Luôn available; `import module java.base;` kéo toàn bộ package exported của base vào scope tên |

```java
import module java.base;
import java.util.List; // kết hợp import thường để làm rõ / giải ambiguity

record Point(int x, int y) {}
```

Khi nào dùng:

- File script / compact / notebook-style, hoặc class dùng dày đặc API nhiều package cùng module.
- API public library lớn: thường vẫn prefer import tường minh từng type (diff/review dễ hơn).

**Version gate:** cần JDK **25+** (hoặc toolchain `--release 25`). Trên 21/17 → lỗi cú pháp `import module`.

---

## 5. JPMS tổng quan

**Java Platform Module System** (Java 9+):

- Mỗi module có tên (`com.example.app`), mô tả trong `module-info.java`.
- **Strong encapsulation**: package không `exports` thì type `public` cũng không accessible ngoài module
  (trừ deep reflection khi `opens` / `--add-opens`).
- **Explicit dependencies**: `requires` liệt kê module cần; thiếu → lỗi lúc resolve.
- JDK cũng là modules: `java.base`, `java.sql`, `java.xml`, `jdk.compiler`, …

| | Unnamed module (classpath) | Named modules (module path) |
|---|---|---|
| Đọc | Đọc hầu hết classpath | Chỉ theo `requires` + exports |
| Export | Mọi package coi như exported tới unnamed | Chỉ package `exports` |
| Split packages | Nguy hiểm, khó đoán | **Cấm** giữa các modules |
| Dùng khi | App legacy, nhiều stack Spring Boot điển hình | Thư viện JDK-style, tool JDK, app chuẩn hóa module |

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

- Tên module thường mirror package gốc; **không** bắt buộc trùng, nhưng nên ổn định (đổi tên = breaking).
- `module-info.java` biên dịch thành `module-info.class`.
- Open module: `open module com.example.app { … }` — mở mọi package cho deep reflection (ít dùng cho lib).

### 6.1 `requires` / `requires transitive` / `requires static`

```java
module com.example.app {
    requires java.xml;                    // bắt buộc compile & runtime
    requires transitive com.example.api;  // re-export: client của app cũng đọc được api
    requires static java.compiler;        // optional lúc runtime (compile-time cần)
}
```

- `requires M`: phụ thuộc cứng.
- `requires transitive M`: dependency xuất hiện ở **API public** của bạn — client cần thấy kiểu từ `M`.
- `requires static M`: có mặt khi biên dịch; runtime có thể vắng (code phải chịu được thiếu module).

### 6.2 `exports` / `exports … to`

```java
exports com.example.app.api;
exports com.example.app.internal.support to com.example.x; // qualified export
```

- Chỉ package **trực tiếp** được liệt kê; subpackage **không** tự export.
- Type `public` trong package không export → không dùng được ngoài module.

### 6.3 `opens` / `opens … to`

```java
opens com.example.app.model;
opens com.example.app.model to org.hibernate.orm.core;
```

- `exports` = access compile-time + encapsulation thông thường.
- `opens` = cho phép **deep reflection** (set private fields, …) — cần cho nhiều framework (JPA, Jackson…).
- Runtime flag tạm: `--add-opens m/p=ALL-UNNAMED`.

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

- SPI interface nên ở module API **exported**; implementation ở module khác — thường **không** export package impl.
- Trên classpath: file `META-INF/services/<FQCN>` (cơ chế cũ vẫn phổ biến). Chi tiết pitfalls: [§10](#10-serviceloader--provides--uses--pitfalls).

---

## 7. Automatic modules & unnamed module

**Automatic module**: JAR đặt trên **module path** nhưng không có `module-info` → tên suy từ filename
(`foo-bar-1.2.jar` → thường `foo.bar`) hoặc `Automatic-Module-Name` trong manifest.

```text
Automatic-Module-Name: com.example.legacy
```

| Khái niệm | Hành vi |
|-----------|---------|
| Automatic module | Đọc hầu hết module khác; **exports mọi package** — “nới lỏng” để migrate |
| Unnamed module | Tất cả classpath JARs — đọc được named modules; named **không** `requires` unnamed (một chiều) |
| Ổn định tên | **Luôn** set `Automatic-Module-Name` trước khi publish JAR lên module path — tránh đổi tên theo filename |

Chiến lược migrate:

1. Giữ app trên classpath.
2. Đặt dependencies ổn định lên module path với `Automatic-Module-Name`.
3. Thêm `module-info` cho từng artifact khi sẵn sàng.

**Bẫy:** automatic module dựa filename dễ **đổi tên** khi đổi artifactId/version scheme → client `requires` gãy.

---

## 8. Classpath vs Module path (Maven / Gradle)

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
| Đơn vị | JAR / directory class | Module (JAR ± `module-info`) |
| Encapsulation | Public = accessible | Theo `exports` / `opens` |
| Split packages | Nguy hiểm, khó đoán | Cấm giữa modules |
| Công cụ | Mọi build tool | Maven/Gradle hỗ trợ; cần cấu hình rõ |

### Maven (phác thảo)

```text
src/main/java/module-info.java
src/main/java/com/example/app/...
```

```xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-compiler-plugin</artifactId>
  <configuration>
    <release>25</release>
  </configuration>
</plugin>
```

- Dependencies mặc định thường lên **classpath** (unnamed). Muốn module path: `maven-compiler-plugin` /
  `maven-jar-plugin` + plugin modulepath (tùy phiên bản; nhiều project chỉ cần `module-info` cho artifact mình,
  còn deps vẫn classpath).
- Test code: đôi khi cần `opens` tới test framework hoặc chạy test trên classpath.

### Gradle (phác thảo)

```kotlin
java {
    toolchain { languageVersion.set(JavaLanguageVersion.of(25)) }
}
// module-info.java ở src/main/java
// org.gradle.experimental / java-library + modularity DSL tùy phiên bản Gradle
```

- Gradle 7+ hỗ trợ JPMS tốt hơn; vẫn kiểm tra artifact lên `modularity.inferModulePath` / cấu hình thủ công.
- **Quy tắc thực dụng:** app Spring / Jakarta điển hình → classpath; CLI / JDK tool / lib muốn strong encapsulation → module path + `module-info`.

Gợi ý:

- Tránh **split package** (cùng package ở hai module/JAR trên module path).
- Hiểu JPMS ngay cả khi app chạy classpath — JDK modules & native access (`--enable-native-access`) vẫn đụng encapsulation.

---

## 9. Ma trận lỗi JPMS thường gặp

| Triệu chứng (rút gọn) | Nguyên nhân | Hướng xử lý |
|----------------------|-------------|-------------|
| `module … not found` / cannot find module | Thiếu JAR trên module path, sai tên module, typo `requires` | Kiểm tra `-p` / deps; `jar --describe-module`; tên automatic vs `Automatic-Module-Name` |
| `package X is declared in module M, but module N does not read it` | `N` thiếu `requires M` | Thêm `requires M;` (hoặc `requires transitive` nếu là API) |
| `package X is not visible` / cannot access | Package chưa `exports` (hoặc không qualified tới bạn) | `exports` / `exports … to N`; hoặc đừng dùng type nội bộ |
| `module reads package P from both M1 and M2` | **Split package** | Gộp/đổi package; đừng đặt cùng package trên hai module |
| `InaccessibleObjectException` / illegal reflective access | Deep reflection vào package không `opens` | `opens … to …`, `--add-opens`, hoặc bỏ reflection (records / accessor) |
| Service không load được | Thiếu `uses`/`provides` hoặc thiếu `META-INF/services` | Xem [§10](#10-serviceloader--provides--uses--pitfalls) |
| Ambiguous khi `import module` | Trùng simple name giữa modules | Single-type import / FQCN |
| `error: module reads another module … more than once` | `requires` trùng / conflict resolve | Làm sạch graph `requires` |

```text
# Chẩn đoán nhanh
java --list-modules
jar --describe-module -f lib/foo.jar
jdeps --module-path mods -m com.example.app
```

---

## 10. ServiceLoader / `provides` / `uses` — pitfalls

```java
// Consumer (module-info)
uses com.example.spi.Greeter;

// Provider (module-info)
provides com.example.spi.Greeter with com.example.impl.EnGreeter;
```

```java
ServiceLoader<Greeter> loader = ServiceLoader.load(Greeter.class);
Optional<Greeter> first = loader.findFirst(); // Java 9+
List<Greeter> all = loader.stream().map(ServiceLoader.Provider::get).toList();
```

| Bẫy | Chi tiết |
|-----|----------|
| Thiếu `uses` | Trên module path, consumer **phải** `uses` SPI — thiếu → không thấy provider |
| Thiếu `provides` | Provider module phải `provides … with …`; chỉ có class impl không đủ |
| Classpath vs module | Classpath dùng `META-INF/services/<SPI>`; module path ưu tiên `module-info` — đừng giả định một bên đủ cho mọi launch mode |
| Provider ctor | `ServiceLoader` cần public no-arg constructor (hoặc provider method / factory theo quy tắc); ctor private → fail lúc load |
| Lazy + cache | Iterator load lười; đừng giữ instance lỗi thời nếu hot-reload (hiếm); `reload()` khi cần |
| ClassLoader sai | `ServiceLoader.load(SPI.class, cl)` — sai CL → “mất” provider trong app server / plugin |
| SPI trong non-exported package | Interface SPI phải accessible (thường `exports` package API); impl có thể không export |
| Thứ tự provider | Không phụ thuộc thứ tự enumerate trừ khi bạn sort tường minh |

```java
// META-INF/services/com.example.spi.Greeter  (classpath / dual-mode)
com.example.impl.EnGreeter
```

Best practice SPI: API module (interface + `exports`) ← consumer `uses` / provider `provides`; impl module không export nội bộ.

---

## 11. Pitfalls (Bẫy)

1. **Default package trong production** — không import được từ named package; phá JPMS.
2. **Subpackage ≠ export** — `exports com.example.api` không export `com.example.api.internal`.
3. **`requires transitive` thừa** — phình graph; chỉ dùng khi kiểu của dependency lộ ở API public.
4. **`--add-opens` mãi mãi** — flag runtime che thiếu `opens` trong `module-info`; technical debt.
5. **Split package** — hai JAR cùng package trên module path → resolve fail; trên classpath “chạy” nhưng hành vi khó đoán.
6. **Automatic module đổi tên** — thiếu `Automatic-Module-Name` → `requires` gãy khi đổi tên file.
7. **`import module` ≠ dependency** — vẫn cần `requires` / deps build; chỉ rút gọn tên.
8. **Ambiguous simple name** sau `import module` — compile error; giải bằng import tường minh.
9. **ServiceLoader “im lặng” rỗng** — thiếu `uses`/`provides`/`META-INF/services` hoặc sai ClassLoader; luôn kiểm tra `findFirst().isEmpty()`.
10. **Qualified export quên cập nhật** — thêm module client mới cần sửa `exports … to`.

---

## 12. Best practices & checklist

1. Package theo feature (`…order`, `…payment`) hơn chỉ layer sâu (`…controller`/`…service` vô tận).
2. Export tối thiểu; `opens` **qualified** tới framework cụ thể.
3. `requires transitive` chỉ khi kiểu dependency xuất hiện ở API public.
4. Java 25: `import module` cho file dày API JDK — giải ambiguity sớm; xem [java25.md](java25.md).
5. Publish JAR lên module path → set `Automatic-Module-Name` trước khi có `module-info`.
6. SPI: tách API / impl; khai báo đủ `uses`/`provides` (+ `META-INF/services` nếu dual classpath).
7. Compact source / default package: OK học; production → named package ± module.
8. App enterprise classpath vẫn ổn — vẫn hiểu lỗi encapsulation khi đụng JDK modules.

### Checklist

```text
□ package khớp thư mục; không default package trong lib
□ module-info: requires tối thiểu; transitive có chủ đích
□ exports / opens tối thiểu (qualified khi được)
□ không split package trên module path
□ Automatic-Module-Name nếu JAR chưa có module-info
□ ServiceLoader: uses + provides (và/hoặc META-INF/services)
□ Java 25+: import module chỉ khi thật sự giảm boilerplate
□ --add-opens chỉ tạm thời, có plan bỏ
```

```java
// File hiện đại: module import + named package (Java 25+)
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

---

## Xem thêm

| File | Liên quan |
|------|-----------|
| [java25.md](java25.md) | JEP 511 `import module`, compact source |
| [keywords.md](keywords.md) | `package`, `import`, `module` |
| [oop.md](oop.md) | Visibility, sealed API boundaries |
| [exceptions.md](exceptions.md) | Không leak type qua biên module |
| [main-function.md](main-function.md) | Launcher / compact main |
| [methods.md](methods.md) | API surface của package exported |

---

*Tham chiếu nhanh — Java 25 LTS. JPMS từ 9; `import module` từ 25. Classpath vẫn phổ biến — hiểu module để làm việc với JDK và migrate có chủ đích.*
