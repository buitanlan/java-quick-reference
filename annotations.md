# Annotation

Annotation là cơ chế **metadata** của Java — gắn thông tin vào khai báo (hoặc từ Java 8, cả type use) để compiler,
tooling, framework và runtime phản ứng. Đây là analogue gần nhất với “preprocessor/metadata attributes” của C#
(`[Obsolete]`, `[Serializable]`, …), nhưng Java annotation **không** điều khiển `#if` biên dịch có điều kiện;
chúng mang dữ liệu có cấu trúc, xử lý bởi compiler plugins (APT) hoặc reflection.

---

## Mục lục

- [Annotation](#annotation)
  - [Mục lục](#mục-lục)
  - [1. Tổng quan \& cú pháp](#1-tổng-quan--cú-pháp)
  - [2. Khai báo annotation type](#2-khai-báo-annotation-type)
  - [3. Meta-annotations](#3-meta-annotations)
    - [3.1 `@Retention`](#31-retention)
    - [3.2 `@Target`](#32-target)
    - [3.3 `@Documented`](#33-documented)
    - [3.4 `@Inherited`](#34-inherited)
    - [3.5 `@Repeatable`](#35-repeatable)
  - [4. Annotation chuẩn JDK thường dùng](#4-annotation-chuẩn-jdk-thường-dùng)
    - [4.1 `@Override`](#41-override)
    - [4.2 `@Deprecated`](#42-deprecated)
    - [4.3 `@SuppressWarnings`](#43-suppresswarnings)
    - [4.4 `@FunctionalInterface`](#44-functionalinterface)
    - [4.5 `@SafeVarargs`](#45-safevarargs)
  - [5. Type annotations \& declaration annotations](#5-type-annotations--declaration-annotations)
  - [6. Đọc annotation lúc runtime](#6-đọc-annotation-lúc-runtime)
  - [7. Annotation processor (APT) — overview](#7-annotation-processor-apt--overview)
  - [8. Custom annotation — mẫu thực tế](#8-custom-annotation--mẫu-thực-tế)
  - [9. Best practices](#9-best-practices)

---

## 1. Tổng quan & cú pháp

```java
@Deprecated(since = "17", forRemoval = true)
@Override
public String toString() {
    return "x";
}
```

- Dạng đánh dấu: `@Override`
- Một phần tử tên `value`: `@SuppressWarnings("unchecked")`
- Nhiều phần tử: `@Deprecated(since = "21", forRemoval = false)`
- Mảng: `@Target({ElementType.METHOD, ElementType.FIELD})`
- Lồng annotation: giá trị phần tử có thể là annotation khác

Gắn được trên: class/interface/record/enum, method, field, parameter, constructor, package (`package-info`),
module (`module-info`), local variable, type parameter, type use (tùy `@Target`).

---

## 2. Khai báo annotation type

```java
public @interface Author {
    String name();
    String date() default "N/A";
    int revision() default 1;
}
```

- Dùng `@interface` (không phải `interface` thường).
- “Method” không tham số, không body — là **elements**.
- Kiểu element cho phép: primitive, `String`, `Class`, enum, annotation, và mảng của các kiểu đó.
- Không dùng `Integer` wrapper, generic, hay arbitrary class làm kiểu element.
- Default value phải là compile-time constant theo quy tắc annotation.

```java
@Author(name = "Lan", revision = 2)
public class Service {}
```

Marker annotation (không element):

```java
public @interface Experimental {}
```

Single-element & shorthand `value`:

```java
public @interface Tag {
    String value();
}

@Tag("fast")
class Bench {}
```

---

## 3. Meta-annotations

Meta-annotations sống trong `java.lang.annotation` — mô tả cách annotation được giữ và áp dụng.

### 3.1 `@Retention`

```java
@Retention(RetentionPolicy.RUNTIME)
public @interface Audited {}
```

| Policy | Ý nghĩa |
|---|---|
| `SOURCE` | Chỉ source — bỏ khi biên dịch (ví dụ nhiều lombok-style / checker) |
| `CLASS` | Ghi vào class file, **không** đọc mặc định lúc runtime (default nếu bỏ `@Retention`) |
| `RUNTIME` | Class file + đọc được bằng reflection |

Framework DI/JPA/Jackson thường cần `RUNTIME`. Tool codegen thường `SOURCE` hoặc `CLASS`.

### 3.2 `@Target`

```java
@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
public @interface Secured {
    String[] roles();
}
```

`ElementType` phổ biến: `TYPE`, `FIELD`, `METHOD`, `PARAMETER`, `CONSTRUCTOR`, `LOCAL_VARIABLE`,
`ANNOTATION_TYPE`, `PACKAGE`, `TYPE_PARAMETER`, `TYPE_USE`, `MODULE`, `RECORD_COMPONENT`.

- Không khai báo `@Target` → áp dụng gần như mọi vị trí declaration cổ điển (theo JLS — nên **luôn** ghi rõ).
- `TYPE_USE` cho phép gắn trên kiểu trong vị trí dùng kiểu (`List<@NonNull String>`).

### 3.3 `@Documented`

```java
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
public @interface ApiContract {}
```

Annotation có `@Documented` xuất hiện trong Javadoc của phần tử bị gắn.

### 3.4 `@Inherited`

```java
@Inherited
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
public @interface Realm {
    String value();
}

@Realm("admin")
class Base {}
class Child extends Base {} // nhìn thấy @Realm qua reflection trên class nếu truy vấn đúng API
```

- Chỉ áp dụng meta cho **class** (không interface theo nghĩa kế thừa annotation chuẩn).
- `getAnnotations()` tôn trọng inherited; `getDeclaredAnnotations()` thì không.

### 3.5 `@Repeatable`

```java
@Repeatable(Tags.class)
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
public @interface Tag {
    String value();
}

@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
public @interface Tags {
    Tag[] value();
}

@Tag("a")
@Tag("b")
class Demo {}
```

Compiler gói các `@Tag` vào container `@Tags`. Đọc runtime: `getAnnotationsByType(Tag.class)`.

---

## 4. Annotation chuẩn JDK thường dùng

### 4.1 `@Override`

```java
@Override
public boolean equals(Object o) { /* ... */ }
```

- `SOURCE` retention — giúp compiler báo lỗi nếu không override/implement đúng.
- Nên gắn mọi method cố ý override (kể cả interface default từ Java 8+).

### 4.2 `@Deprecated`

```java
@Deprecated(since = "21", forRemoval = true)
public void oldApi() {}
```

- Compiler/Javadoc cảnh báo người gọi.
- `forRemoval = true` báo hiệu sẽ xóa ở bản tương lai — kết hợp với `--release` / tool lint.
- Có thể gắn trên hầu hết phần tử khai báo.

### 4.3 `@SuppressWarnings`

```java
@SuppressWarnings({"unchecked", "rawtypes"})
static List<String> cast(List raw) {
    return (List<String>) raw;
}
```

Giá trị phổ biến (implementation-defined một phần; javac hay gặp):

- `unchecked`, `rawtypes`, `deprecation`, `removal`, `serial`, `cast`, `divzero`, `fallthrough`,
  `finally`, `preview`, `text-blocks`, …

- Phạm vi hẹp nhất có thể (local / method), tránh suppress cả class.
- Mỗi suppress nên có lý do ngắn trong comment nếu không hiển nhiên.

### 4.4 `@FunctionalInterface`

```java
@FunctionalInterface
public interface Parser {
    Node parse(String input);
    // default/static methods OK
    // thêm abstract method thứ hai → lỗi biên dịch
}
```

- Đảm bảo đúng **một** abstract method (SAM) — dùng cho lambda/method reference.
- Không bắt buộc để lambda hoạt động, nhưng nên có trên API public.

### 4.5 `@SafeVarargs`

```java
@SafeVarargs
static <T> List<T> listOf(T... elements) {
    return List.of(elements);
}
```

- Áp dụng method/constructor `static` hoặc `final` (hoặc private) với varargs generic.
- Khẳng định không thực hiện thao tác heap pollution không an toàn — vẫn phải viết đúng; annotation chỉ tắt cảnh báo.

Khác: `@Native` (gợi ý constant dùng JNI), `@Serial` (Java 14 — đánh dấu member liên quan serialization).

---

## 5. Type annotations & declaration annotations

```java
@Target(ElementType.TYPE_USE)
@Retention(RetentionPolicy.RUNTIME)
public @interface NonNull {}

List<@NonNull String> names;
@NonNull String title;
Consumer<@NonNull String> c;
```

- Checker Framework / JSpecify dùng type annotations để phân tích nullness, purity, …
- Declaration annotation gắn trên phần tử; type annotation gắn trên vị trí kiểu — có thể cùng xuất hiện.

---

## 6. Đọc annotation lúc runtime

Yêu cầu `@Retention(RUNTIME)` và (thường) phần tử accessible.

```java
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
public @interface Component {
    String value() default "";
}

@Component("userService")
class UserService {}

Component c = UserService.class.getAnnotation(Component.class);
if (c != null) {
    System.out.println(c.value());
}
```

API chính:

- `isAnnotationPresent`, `getAnnotation`, `getAnnotations`, `getDeclaredAnnotations`
- `getAnnotationsByType` / `getDeclaredAnnotationsByType` (repeatable)
- Trên method/field/parameter: `Executable.getParameters()`, `Method.getAnnotation`, …

Module hệ thống: reflection vào annotation trên type không mở có thể bị hạn chế — mở package hoặc dùng API framework.

---

## 7. Annotation processor (APT) — overview

`javax.annotation.processing` / `jakarta` không — package chuẩn: `javax.annotation.processing.AbstractProcessor`
(JDK: `javax.annotation.processing`).

Luồng:

1. Khai báo processor: `@SupportedAnnotationTypes`, `@SupportedSourceVersion(RELEASE_25)`.
2. Đăng ký qua `META-INF/services/javax.annotation.processing.Processor` hoặc `-processor`.
3. `process()` nhận `RoundEnvironment`, sinh mã bằng `Filer` / kiểm tra bằng `Messager`.

```java
@SupportedAnnotationTypes("com.example.AutoFactory")
@SupportedSourceVersion(SourceVersion.RELEASE_25)
public class AutoFactoryProcessor extends AbstractProcessor {
    @Override
    public boolean process(Set<? extends TypeElement> annotations, RoundEnvironment round) {
        for (Element e : round.getElementsAnnotatedWith(AutoFactory.class)) {
            // validate + generate source
        }
        return true;
    }
}
```

Use cases: Dagger/Hilt, MapStruct, Immutables, sinh builder, kiểm tra quy ước kiến trúc lúc compile.

- Processor chạy trong javac — fail fast tốt hơn reflection runtime.
- Không nhầm với Lombok (bytecode/AST manipulation — mô hình khác dù cũng “annotation-driven”).

---

## 8. Custom annotation — mẫu thực tế

```java
@Documented
@Inherited
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
public @interface Service {
    String value() default "";
    Scope scope() default Scope.SINGLETON;

    enum Scope { SINGLETON, PROTOTYPE }
}

@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
@Repeatable(Routes.class)
public @interface Route {
    String path();
    String method() default "GET";
}

@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
public @interface Routes {
    Route[] value();
}

@Service("order")
public class OrderService {

    @Route(path = "/orders")
    @Route(path = "/orders", method = "POST")
    public void noop() {}
}
```

Quét classpath/module path + đọc annotation = nền tảng của micro-framework tự viết.

---

## 9. Best practices

- Luôn chỉ định `@Retention` và `@Target` tường minh.
- Đặt tên annotation theo vai trò (`@Inject`, `@Route`), không theo cơ chế (`@MyAnnotation1`).
- Element `value()` khi chỉ có một thuộc tính chính — DX tốt hơn.
- Prefer compile-time processors cho codegen; runtime reflection cho plugin động.
- Đừng dùng annotation thay config phức tạp (XML/YAML/code) khi cần biểu thức/logic.
- Java 25: kết hợp records + annotation trên record component (`ElementType.RECORD_COMPONENT`) cho binding.

```java
public record User(
        @NotBlank String id,
        @Email String email
) {}
```

- Nullness: hướng tới chuẩn cộng đồng (JSpecify) thay vì tự tạo `@NonNull` lệch semantics.
- Tránh “annotation hell”: nếu mọi dòng đều có 5 annotation, thiết kế API/framework đang leak vào domain.
