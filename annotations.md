# Annotation & Reflection

Tài liệu tham khảo **Annotation** (metadata, meta-annotations, APT) và **Reflection / Metaprogramming** (`java.lang.reflect`, `MethodHandles`, Dynamic `Proxy`, **Class-File API — JEP 484**, và bảo mật JPMS / JEP 500 / `ObjectInputFilter`) trên **Java 27**. Đây là analogue tương ứng với `Attributes & Reflection` bên C# (`[Obsolete]`, `System.Reflection`, Source Generators), nhưng Java annotation **không** điều khiển `#if` biên dịch có điều kiện; chúng mang dữ liệu có cấu trúc cho APT, reflection hoặc bytecode tooling.

> Cross-link: [methods.md](methods.md) (`@Override`, `@SafeVarargs`) · [oop.md](oop.md) (records / components) ·
> [lambdas-functional.md](lambdas-functional.md) (`@FunctionalInterface`) · [typesystem.md](typesystem.md) (JEP 500, TypeToken) · [packages-modules.md](packages-modules.md) (`opens`, `ServiceLoader`)

---

## Mục lục

- [Annotation & Reflection](#annotation--reflection)
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
  - [9. Reflection API (`java.lang.reflect`)](#9-reflection-api-javalangreflect)
    - [9.1 `Class`, `Field`, `Method`, `Constructor` & `RecordComponent`](#91-class-field-method-constructor--recordcomponent)
    - [9.2 Deep reflection, JPMS `opens` & JEP 500 (`final` mutation)](#92-deep-reflection-jpms-opens--jep-500-final-mutation)
    - [9.3 Generic metadata (`Type`, `ParameterizedType`)](#93-generic-metadata-type-parameterizedtype)
  - [10. `MethodHandles` & Dynamic `Proxy`](#10-methodhandles--dynamic-proxy)
    - [10.1 `MethodHandles.Lookup` & `MethodHandle`](#101-methodhandleslookup--methodhandle)
    - [10.2 Dynamic `Proxy` (`java.lang.reflect.Proxy`)](#102-dynamic-proxy-javalangreflectproxy)
  - [11. Class-File API (`java.lang.classfile`, JEP 484) & Deserialization Safety](#11-class-file-api-javalangclassfile-jep-484--deserialization-safety)
  - [12. Pitfalls (Bẫy)](#12-pitfalls-bẫy)
  - [13. Best practices](#13-best-practices)

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
- Kiểu element cho phép: primitive, `String`, `Class` (kể cả parameterized như `Class<?>` / `Class<? extends Foo>`), enum, annotation, và mảng 1 chiều của các kiểu đó.
- Không dùng `Integer` wrapper, type variable (`T`), các parameterized type khác (`List<String>`), hay arbitrary class làm kiểu element.
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

- Không khai báo `@Target` → theo JLS 27 §9.6.4.1, áp dụng cho **mọi declaration context** (kể cả `TYPE_PARAMETER`, `MODULE`, `RECORD_COMPONENT`), và **không** áp dụng cho type context (`TYPE_USE`). Vẫn nên **luôn** ghi rõ `@Target`.
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

Compiler gói nhiều `@Tag` vào container `@Tags`. Khi đọc runtime, **luôn dùng `getAnnotationsByType(Tag.class)`**: nếu chỉ gắn **1 lần**, `getAnnotation(Tag.class)` thấy trực tiếp (và `getAnnotation(Tags.class)` là `null`), còn nếu gắn **≥2 lần**, `getAnnotation(Tag.class)` trả `null` (chỉ thấy container `@Tags`).

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
String @NonNull [] nonNullArray;          // gắn lên mảng, khác `@NonNull String[]` (gắn lên phần tử)
Outer.@NonNull Inner nested;              // nested type: gắn trước tên inner, không viết `@NonNull Outer.Inner`
```

- Checker Framework / JSpecify dùng type annotations để phân tích nullness, purity, …
- Declaration annotation gắn trên phần tử; type annotation gắn trên vị trí kiểu — có thể cùng xuất hiện.
- **Record component propagation (JLS §8.10.1):** annotation gắn trên component của `record` (`record User(@NotBlank String id)`) sẽ tự lan truyền sang backing `private final` field, tham số canonical constructor, accessor method và/hoặc `RecordComponent` tùy theo `@Target` (`FIELD`, `PARAMETER`, `METHOD`, `RECORD_COMPONENT`, `TYPE_USE`). Đây là cơ chế nền tảng để Bean Validation, Jackson và JPA hoạt động với `record`.

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

APT thuộc JDK chuẩn trong package `javax.annotation.processing` (`AbstractProcessor`, `RoundEnvironment`, `Filer`, `Messager`) — không chuyển sang `jakarta.*` như các spec Jakarta EE.

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

## 9. Reflection API (`java.lang.reflect`)

### 9.1 `Class`, `Field`, `Method`, `Constructor` & `RecordComponent`

| Nhóm API | Phạm vi trả về |
|---|---|
| `getFields()` / `getMethods()` / `getConstructors()` | Chỉ thành viên **`public`**, bao gồm cả kế thừa từ superclass/interface (trừ constructor) |
| `getDeclaredFields()` / `getDeclaredMethods()` / `getDeclaredConstructors()` | **Mọi access modifier** (`private`→`public`) khai báo trực tiếp trên chính class đó, **không** gồm thành viên kế thừa |
| `getRecordComponents()` (Java 16+) | Danh sách thành viên của `record` theo đúng thứ tự header (`getName()`, `getType()`, `getAccessor()`) |

```java
Class<?> cls = OrderService.class;
Constructor<?> ctor = cls.getDeclaredConstructor();
Object instance = ctor.newInstance();

Method m = cls.getMethod("noop");
m.invoke(instance); // lỗi trong target method được bọc trong InvocationTargetException!
```

- **Lưu ý tên tham số:** `Parameter.getName()` trả về `arg0`, `arg1` trừ khi biên dịch với `javac -parameters` (rất quan trọng với Spring / Jackson / JPA).
- **Bridge & synthetic methods:** `getDeclaredMethods()` có thể trả về method do `javac` sinh tự động — lọc bỏ bằng `!m.isSynthetic() && !m.isBridge()`.

### 9.2 Deep reflection, JPMS `opens` & JEP 500 (`final` mutation)

- Gọi `setAccessible(true)` lên thành viên không `public` trong một named module khác sẽ ném **`InaccessibleObjectException`** trừ khi module đó `opens <pkg>` (hoặc chạy với `--add-opens`).
- **JEP 500 (JDK 26+ — Prepare to Make Final Mean Final):** dùng `Field.setAccessible(true)` + `Field.set(...)` để ghi đè instance field `final` phát **cảnh báo** mặc định (`--illegal-final-field-mutation=warn`), và bản tương lai sẽ cấm trừ khi bật `--enable-final-field-mutation`. `static final` và field của `record` vốn không thể ghi đè qua `Field.set` — xem [typesystem.md](typesystem.md#41-jep-500--prepare-to-make-final-mean-final-từ-26).

### 9.3 Generic metadata (`Type`, `ParameterizedType`)

Dù runtime bị type erasure, chữ ký generic của **field, method parameter/return và superclass** vẫn lưu trong class-file `Signature` attribute:

```java
Field f = OrderService.class.getDeclaredField("items"); // List<String> items;
if (f.getGenericType() instanceof ParameterizedType pt) {
    Type elemType = pt.getActualTypeArguments()[0];     // class java.lang.String
}
```

Với biến cục bộ / tham số truyền runtime → dùng pattern **Super Type Token (`TypeToken<T>`)** — xem [typesystem.md](typesystem.md#14-reflection-class-typetoken--methodhandles).

---

## 10. `MethodHandles` & Dynamic `Proxy`

### 10.1 `MethodHandles.Lookup` & `MethodHandle`

`java.lang.invoke.MethodHandle` (Java 7+, nền tảng của lambda & `StringConcatFactory`) kiểm tra access control **một lần lúc lookup** (khác `Method.invoke` kiểm tra lặp lại hoặc cần `setAccessible`), và dễ được JIT inline nếu lưu trong `static final`:

```java
MethodHandles.Lookup lookup = MethodHandles.lookup();
MethodHandle mh = lookup.findVirtual(
        String.class, "toUpperCase", MethodType.methodType(String.class, Locale.class));

// invokeExact: chữ ký compile-time (tham số & kiểu trả về) phải khớp tuyệt đối
String out = (String) mh.invokeExact("java", Locale.ROOT); // "JAVA"
```

- Truy cập private member của class khác trong cùng module/open package: `MethodHandles.privateLookupIn(targetClass, lookup)`.
- `VarHandle` (Java 9+) là đối ứng của `MethodHandle` cho đọc/ghi field/array/off-heap có memory ordering — xem [memory-ffm.md](memory-ffm.md#8-varhandle-cho-memory-access-có-thứ-tự).

### 10.2 Dynamic `Proxy` (`java.lang.reflect.Proxy`)

Tạo implementation runtime cho **một hoặc nhiều `interface`** (nền tảng của AOP, RPC client, mocking):

```java
interface Greeter {
    String greet(String name);
    default String hi() { return greet("world"); }
}

Greeter target = name -> "Hello, " + name;
Greeter proxy = (Greeter) Proxy.newProxyInstance(
        Greeter.class.getClassLoader(),
        new Class<?>[] { Greeter.class },
        (p, method, args) -> {
            if (method.isDefault()) {
                // Java 16+: gọi thẳng default method của interface trên proxy
                return InvocationHandler.invokeDefault(p, method, args);
            }
            System.out.println("Calling " + method.getName());
            return method.invoke(target, args);
        });
```

- **Giới hạn:** `java.lang.reflect.Proxy` chỉ tạo proxy cho **`interface`** (không proxy được concrete class — muốn proxy class phải dùng bytecode generation như Byte Buddy hoặc Class-File API).
- **Bẫy unwrap lỗi:** `method.invoke(...)` bọc ngoại lệ gốc trong `InvocationTargetException` — trong `InvocationHandler`, nhớ bắt và ném `e.getCause()` để caller nhận đúng exception khai báo thay vì `UndeclaredThrowableException`.

---

## 11. Class-File API (`java.lang.classfile`, JEP 484) & Deserialization Safety

### 11.1 Class-File API (Final từ Java 24)

[JEP 484](https://openjdk.org/jeps/484) cung cấp API chuẩn trong `java.lang.classfile` để **parse, build và transform `.class` bytecode** theo đúng chuẩn JVMS từng bản JDK (thay nhu cầu nhúng bản ASM cũ cho tooling/agent/framework):

```java
import java.lang.classfile.*;

byte[] bytes = Files.readAllBytes(Path.of("target/classes/com/example/App.class"));
ClassModel model = ClassFile.of().parse(bytes); // immutable + lazy

for (MethodModel m : model.methods()) {
    System.out.println(m.methodName().stringValue() + m.methodTypeSymbol().descriptorString());
}
```

### 11.2 Bảo mật Deserialization (`ObjectInputFilter`)

Java built-in serialization (`ObjectInputStream` / `Serializable`) đi qua cơ chế khởi tạo đối tượng gần giống reflection và là nguồn gốc của nhiều lỗ hổng RCE (gadget chains). Ưu tiên JSON/Protobuf + `record`; nếu buộc phải dùng `ObjectInputStream`, luôn áp dụng allow-list **`ObjectInputFilter`** (Java 9+, JEP 290; global factory từ Java 17, JEP 415):

```java
ObjectInputFilter filter = ObjectInputFilter.Config.createFilter(
        "maxdepth=5;maxrefs=100;maxbytes=1048576;com.example.dto.*;!*");

try (var ois = new ObjectInputStream(in)) {
    ois.setObjectInputFilter(filter);
    Object obj = ois.readObject();
}
```

---

## 12. Pitfalls (Bẫy)

1. **Sai `@Retention`** — mặc định là `CLASS`; reflection không đọc được nếu cần `RUNTIME` mà quên khai báo. Chọn `SOURCE` cho metadata chỉ cần lúc biên dịch; `CLASS` và `RUNTIME` đều lưu metadata trong class file.
2. **Quên `@Override`** — typo / overload nhầm thành method mới; compiler không báo. Luôn gắn khi cố ý override/implement — [methods.md](methods.md).
3. **`@Repeatable` thiếu container** — phải có annotation container (`@Tags` chứa `Tag[] value()`) cùng retention/target phù hợp; đọc runtime dùng `getAnnotationsByType`, không chỉ `getAnnotation` (chỉ thấy container khi đã gộp).
4. **`@Inherited` chỉ trên class** — không “kế thừa” xuống method/field; interface cũng không theo nghĩa meta này.
5. **Nhầm declaration vs type-use** — thiếu `ElementType.TYPE_USE` thì không gắn được trên `List<@NonNull String>`.
6. **Quên unwrap `InvocationTargetException`** khi gọi `Method.invoke` / `Constructor.newInstance` hoặc trong `InvocationHandler` của `Proxy`.
7. **Deep reflection vào JDK/module không `opens` hoặc ghi `final` field** — `InaccessibleObjectException` và cảnh báo JEP 500 trên JDK 26+.
8. **Quên lọc synthetic/bridge method** và quên cờ `-parameters` khi đọc tên tham số bằng reflection.

---

## 13. Best practices

- Luôn chỉ định `@Retention` và `@Target` tường minh.
- Đặt tên annotation theo vai trò (`@Inject`, `@Route`), không theo cơ chế (`@MyAnnotation1`).
- Element `value()` khi chỉ có một thuộc tính chính — DX tốt hơn.
- Prefer **compile-time processors (APT)** cho codegen và **sealed/pattern matching/functional interface** thay vì runtime reflection trên hot path.
- Khi cần invoke động hiệu năng cao: cache `MethodHandle` trong `static final` (hoặc `LazyConstant` preview) thay vì tra cứu reflection lặp lại.
- Tooling xử lý bytecode mới → ưu tiên **Class-File API (`java.lang.classfile`, JEP 484)** thay ASM shaded.
- Đừng dùng annotation thay config phức tạp (XML/YAML/code) khi cần biểu thức/logic.
- Java 16+: kết hợp records + annotation trên record component (`ElementType.RECORD_COMPONENT`) cho binding và validation.

```java
public record User(
        @NotBlank String id,
        @Email String email
) {}
```

- Nullness: hướng tới chuẩn cộng đồng (JSpecify) thay vì tự tạo `@NonNull` lệch semantics.
- Tránh “annotation hell”: nếu mọi dòng đều có 5 annotation, thiết kế API/framework đang leak vào domain.

---

*Tham chiếu nhanh — Java 27. Meta-annotations & APT ổn định từ lâu; `RECORD_COMPONENT` & `InvocationHandler.invokeDefault` từ 16; Class-File API final từ 24 (JEP 484); JEP 500 từ 26.*
