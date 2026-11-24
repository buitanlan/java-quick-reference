# Annotation

Annotation là cơ chế **metadata** của Java — gắn thông tin vào khai báo (hoặc từ Java 8, cả type use) để compiler,
tooling, framework và runtime phản ứng. Đây là analogue gần nhất với “preprocessor/metadata attributes” của C#
(`[Obsolete]`, `[Serializable]`, …), nhưng Java annotation **không** điều khiển `#if` biên dịch có điều kiện;
chúng mang dữ liệu có cấu trúc, xử lý bởi compiler plugins (APT) hoặc reflection. Tài liệu nhắm **Java 27**.

> Cross-link: [methods.md](methods.md) (`@Override`, `@SafeVarargs`) · [oop.md](oop.md) (records / components) ·
> [lambdas-functional.md](lambdas-functional.md) (`@FunctionalInterface`) · [keywords.md](keywords.md)

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
  - [9. Pitfalls (Bẫy)](#9-pitfalls-bẫy)
  - [10. Best practices](#10-best-practices)

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
- Giá trị primitive/`String` phải là constant expression; `Class` dùng class literal, enum dùng enum constant, annotation dùng annotation lồng, mảng dùng initializer một chiều. Không dùng `null`, `new` hay lời gọi method; không phải mọi giá trị annotation đều là constant expression theo JLS.

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
public boolean equals(Object o) { return this == o; } // ví dụ equality theo identity
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

- Kiểm tra functional interface: các abstract methods phải biểu diễn được một function contract (SAM); bỏ qua method khớp public instance method của `Object`. Interface `sealed` không là functional interface. Nhiều declaration override-equivalent có thể vẫn hợp lệ.
- Không bắt buộc để lambda hoạt động, nhưng nên có trên API public.

### 4.5 `@SafeVarargs`

```java
@SafeVarargs
static <T> List<T> listOf(T... elements) {
    return List.of(elements);
}
```

- Áp dụng cho varargs constructor và varargs method `static`/`final`/`private`; constructor không có modifier `static`/`final`. Thường hữu ích với non-reifiable element type (generic varargs).
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

Yêu cầu `@Retention(RUNTIME)`; đọc metadata không đồng nghĩa với gọi method hay truy cập field của phần tử đó.

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

Annotation của type được đọc bằng `Class` reflection không tự đòi package `opens`. Deep reflection vào private members hoặc việc gọi member của annotation type không accessible có quy tắc access riêng; chỉ mở package khi thao tác đó cần.

---

## 7. Annotation processor (APT) — overview

`javax.annotation.processing` / `jakarta` không — package chuẩn: `javax.annotation.processing.AbstractProcessor`
(JDK: `javax.annotation.processing`).

Luồng:

1. Khai báo processor: `@SupportedAnnotationTypes`, `@SupportedSourceVersion(RELEASE_27)` (hoặc mức source processor thực sự hỗ trợ).
2. Đăng ký qua `META-INF/services/javax.annotation.processing.Processor`, hoặc `provides … with …` trong module. Từ JDK 23 phải cấu hình processing tường minh, ví dụ `-processor`, `--processor-path`/`--processor-module-path`, hoặc `-proc:full`; chỉ để processor trên classpath không còn đủ.
3. `process()` nhận `RoundEnvironment`, sinh mã bằng `Filer` / kiểm tra bằng `Messager`.

Các tùy chọn discovery/processing được mô tả trong [hướng dẫn `javac` JDK 27](https://docs.oracle.com/en/java/javase/27/docs/specs/man/javac.html#annotation-processing).

```java
@SupportedAnnotationTypes("com.example.AutoFactory")
@SupportedSourceVersion(SourceVersion.RELEASE_27)
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
- Annotation processing chuẩn tạo file mới qua `Filer`, không cung cấp API chuẩn để sửa AST của source hiện có. Lombok dùng tích hợp riêng với compiler để biến đổi AST; không đại diện cho khả năng của processor chuẩn.

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

## 9. Pitfalls (Bẫy)

1. **Sai `@Retention`** — mặc định là `CLASS`; reflection không đọc được nếu cần `RUNTIME` mà quên khai báo. Chọn `SOURCE` cho metadata chỉ cần lúc biên dịch; `CLASS` và `RUNTIME` đều lưu metadata trong class file.
2. **Quên `@Override`** — typo / overload nhầm thành method mới; compiler không báo. Luôn gắn khi cố ý override/implement — [methods.md](methods.md).
3. **`@Repeatable` thiếu container** — phải có annotation container (`@Tags` chứa `Tag[] value()`) cùng retention/target phù hợp; đọc runtime dùng `getAnnotationsByType`, không chỉ `getAnnotation` (chỉ thấy container khi đã gộp).
4. **`@Inherited` chỉ trên class** — không “kế thừa” xuống method/field; interface cũng không theo nghĩa meta này.
5. **Nhầm declaration vs type-use** — thiếu `ElementType.TYPE_USE` thì không gắn được trên `List<@NonNull String>`.

---

## 10. Best practices

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

---

*Tham chiếu nhanh — Java 27. Meta-annotations & APT ổn định từ lâu; `RECORD_COMPONENT` từ 16.*
