# Hệ thống kiểu dữ liệu

Java là ngôn ngữ **statically typed** / **strongly typed**: mọi biến, tham số, và biểu thức có kiểu xác định tại
biên dịch (trừ các lỗ hổng cố ý như raw types / unchecked cast). Hệ thống kiểu gồm **primitive types**,
**reference types**, và lớp đặc biệt quanh `Object`, mảng, generics (erasure), cùng suy luận cục bộ `var`.

> Tài liệu nhắm **Java 25 LTS**; tính năng theo phiên bản được ghi rõ (Java 8 → 25) — xem [ma trận ở cuối](#18-ma-trận-tính-năng-theo-phiên-bản-java-8--25).
>
> Liên quan: [oop.md](oop.md) · [collections-generics.md](collections-generics.md) · [literals.md](literals.md) ·
> [operators.md](operators.md) · [keywords.md](keywords.md) · [java25.md](java25.md)

Baseline thực hành hiện đại (Java 25 LTS): records, sealed types, pattern matching cho `instanceof`/`switch`,
virtual threads — dùng như mặc định khi nói “code hiện tại”. Value types (Project Valhalla) chỉ nhắc như hướng tương lai.

---

## Mục lục

- [Hệ thống kiểu dữ liệu](#hệ-thống-kiểu-dữ-liệu)
  - [Mục lục](#mục-lục)
  - [1. Tổng quan hệ thống kiểu \& JVM](#1-tổng-quan-hệ-thống-kiểu--jvm)
  - [2. Bộ nhớ: Stack / Heap, GC \& escape analysis](#2-bộ-nhớ-stack--heap-gc--escape-analysis)
    - [2.1 Generational Shenandoah (JEP 521) \& Compact Object Headers (JEP 519)](#21-generational-shenandoah-jep-521--compact-object-headers-jep-519)
    - [2.2 Escape analysis \& scalar replacement](#22-escape-analysis--scalar-replacement)
  - [3. Primitive vs reference](#3-primitive-vs-reference)
  - [4. Definite assignment \& blank `final`](#4-definite-assignment--blank-final)
  - [5. Boxing / unboxing \& wrapper types](#5-boxing--unboxing--wrapper-types)
    - [5.1 Bẫy — Integer cache \& `==` trên wrappers](#51-bẫy--integer-cache---trên-wrappers)
  - [6. Mảng (`T[]`)](#6-mảng-t)
    - [6.1 Bẫy — Array covariance \& `ArrayStoreException`](#61-bẫy--array-covariance--arraystoreexception)
  - [7. `String`, `Object` hierarchy](#7-string-object-hierarchy)
  - [8. `null`, `void` / `Void`, `var`](#8-null-void--void-var)
    - [8.1 `var` — edge cases](#81-var--edge-cases)
  - [9. Generics \& type erasure (depth)](#9-generics--type-erasure-depth)
    - [9.1 PECS \& wildcards](#91-pecs--wildcards)
    - [9.2 Capture conversion (overview)](#92-capture-conversion-overview)
    - [9.3 Heap pollution \& `@SafeVarargs`](#93-heap-pollution--safevarargs)
  - [10. Identity (`==`) vs `equals` vs `compareTo`](#10-identity--vs-equals-vs-compareto)
  - [11. Records, sealed, enums (trong bức tranh kiểu)](#11-records-sealed-enums-trong-bức-tranh-kiểu)
  - [12. Kiểm tra kiểu: `instanceof` pattern matching](#12-kiểm-tra-kiểu-instanceof-pattern-matching)
    - [12.1 Preview — Primitive patterns (JEP 507)](#121-preview--primitive-patterns-jep-507)
  - [13. Ép kiểu \& chuyển đổi số](#13-ép-kiểu--chuyển-đổi-số)
    - [13.1 Bảng widening / narrowing (primitive)](#131-bảng-widening--narrowing-primitive)
  - [14. Reflection, `Class`, TypeToken \& `MethodHandles`](#14-reflection-class-typetoken--methodhandles)
  - [15. Value types — ngữ cảnh tương lai](#15-value-types--ngữ-cảnh-tương-lai)
  - [16. Sơ đồ type tree (ASCII)](#16-sơ-đồ-type-tree-ascii)
  - [17. Pitfalls \& checklist](#17-pitfalls--checklist)
  - [18. Ma trận tính năng theo phiên bản (Java 8 → 25)](#18-ma-trận-tính-năng-theo-phiên-bản-java-8--25)

---

## 1. Tổng quan hệ thống kiểu & JVM

Khi nói về một kiểu, runtime/compiler biết:

- Kích thước / representation (primitive cố định; object có header + fields).
- Tập giá trị hợp lệ và operations.
- Quan hệ kế thừa / implements (reference types).
- Constraints generics (compile-time).

Luồng thực thi:

> **Source `.java`** → **javac** → **bytecode `.class`** → **JVM** (class loading, verification, JIT/GC).

- Verification đảm bảo bytecode type-safe trước khi chạy.
- Reflection (`Class`, `MethodHandles`) đọc metadata kiểu lúc runtime — xem [§14](#14-reflection-class-typetoken--methodhandles).
- Không có `dynamic` kiểu C#; “dynamic” gần nhất là reflection / `MethodHandle` / interpreter riêng.
- Ngôn ngữ + API liên quan kiểu: xem [keywords.md](keywords.md), [operators.md](operators.md), [oop.md](oop.md).

---

## 2. Bộ nhớ: Stack / Heap, GC & escape analysis

- **Stack** (per thread): frame method — local primitives, references tới object trên heap. Không lưu object “thật”
  (trừ tối ưu escape analysis / scalar replacement — [§2.2](#22-escape-analysis--scalar-replacement)).
- **Heap**: instance objects, arrays, class metadata liên quan (tùy JVM). GC thu hồi object không còn reachability.
- **Metaspace** (HotSpot): class metadata — tách khỏi Java heap cổ điển.
- Local variable chứa **reference** (con trỏ managed), không phải địa chỉ tùy ý như C.

```java
void demo() {
    int x = 42;            // primitive trên stack frame
    String s = "hi";       // reference trên stack → String trên heap (pool/heap)
    int[] a = {1, 2, 3};   // reference → mảng trên heap
}
```

GC HotSpot phổ biến: **G1** (mặc định nhiều bản), ZGC, Shenandoah, Parallel — chọn bằng `-XX:+UseG1GC`, v.v.

### 2.1 Generational Shenandoah (JEP 521) & Compact Object Headers (JEP 519)

Java 25 gắn với các cải tiến runtime đáng chú ý (không đổi cú pháp ngôn ngữ):

- **JEP 521 — Generational Shenandoah**: Shenandoah theo thế hệ (young/old) nhằm giảm pause và chi phí trên workload
  cấp phát ngắn sống — bật/cấu hình theo flag JVM của bản phát hành.
- **JEP 519 — Compact Object Headers**: thu gọn object header trên HotSpot → giảm footprint heap, tăng mật độ cache;
  ảnh hưởng hiệu năng thực tế hơn là API ngôn ngữ.

Thực hành: chọn GC theo latency/throughput; đo bằng `-Xlog:gc*` / JFR — không đoán mù. Chi tiết LTS: [java25.md](java25.md).

### 2.2 Escape analysis & scalar replacement

HotSpot **không** cho lập trình viên chọn stack/heap bằng từ khóa. JIT quyết định qua **escape analysis (EA)**:

| Kết quả EA | Ý nghĩa |
|---|---|
| **NoEscape** | Object không thoát khỏi method/thread → có thể **scalar replacement** (phá fields thành locals trên stack/register) hoặc cấp phát stack |
| **ArgEscape** | Chỉ truyền xuống callee, không lưu trữ lâu → tối ưu hạn chế hơn |
| **GlobalEscape** | Escape ra heap (field, static, return, đóng vào thread khác…) → cấp phát heap bình thường |

```java
Point local() {
    Point p = new Point(1, 2); // thường NoEscape nếu chỉ dùng nội bộ
    return new Point(p.x(), p.y()); // object trả về → GlobalEscape
}

int sum() {
    // Candidate scalar replacement: JIT có thể không cấp phát Point thật
    Point p = new Point(3, 4);
    return p.x() + p.y();
}
```

Nguyên nhân escape hay gặp (tương tự tinh thần Go `-gcflags="-m"`):

| Tình huống | Vì sao thường lên heap |
|---|---|
| `return obj` / gán vào field | sống lâu hơn frame |
| Boxing (`Integer.valueOf`, autobox) | wrapper là object |
| Capture vào lambda/inner class sống ngoài method | closure giữ reference |
| Đưa vào collection / array đã escape | reachability |
| Đồng bộ `synchronized (obj)` / publish sang thread khác | visible cross-thread |

- EA là **tối ưu JIT**, không phải đảm bảo ngôn ngữ — đừng phụ thuộc “object này chắc chắn không allocate”.
- Hot path: ưu tiên primitive, tránh boxing/`Optional` không cần thiết, giữ object cục bộ khi profile nóng.
- Đo: JFR / async-profiler / `-XX:+PrintEscapeAnalysis` (debug JVM builds) — production dùng JFR Allocation.

---

## 3. Primitive vs reference

### Primitive (8 kiểu)

| Kiểu | Bits | Khoảng / ghi chú |
|---|---|---|
| `byte` | 8 | −128..127 |
| `short` | 16 | −32768..32767 |
| `int` | 32 | mặc định số nguyên |
| `long` | 64 | suffix `L` |
| `float` | 32 | IEEE 754, suffix `f` |
| `double` | 64 | mặc định số thực |
| `char` | 16 | UTF-16 code unit |
| `boolean` | JVM-specific | `true`/`false` |

```java
int i = 10;
long n = 10L;
double d = 2.5;
boolean ok = true;
char c = 'A';
```

- Literal số: xem [literals.md](literals.md). Toán tử trên số: [operators.md](operators.md).

### Reference types

- Class, interface, record, enum, array, type variable.
- Giá trị: reference tới object hoặc `null`.
- Gán chép reference, không chép sâu object.

```java
StringBuilder a = new StringBuilder("x");
StringBuilder b = a; // cùng object
b.append('y');
// a cũng thấy "xy"
```

---

## 4. Definite assignment & blank `final`

JLS yêu cầu **definite assignment**: biến local phải được gán trên mọi đường đi trước khi đọc.

```java
int x;
if (cond) {
    x = 1;
} else {
    x = 2;
}
System.out.println(x); // OK — cả hai nhánh gán

int y;
if (cond) {
    y = 1;
}
// System.out.println(y); // lỗi biên dịch — có đường đi chưa gán
```

**Blank `final`** — `final` chưa gán tại khai báo; phải gán đúng **một lần** trên mọi đường đi hợp lệ:

| Ngữ cảnh | Quy tắc |
|---|---|
| Local `final` | Gán trước khi dùng; mỗi đường đi ≤ 1 lần gán |
| Instance blank `final` | Gán trong mọi constructor (hoặc instance initializer); không gán lại |
| `static` blank `final` | Gán trong static initializer / tại khai báo |
| Parameter / catch parameter | Đã “assigned”; không gán lại nếu `final` |

```java
class Config {
    private final String id; // blank final

    Config(String id) {
        this.id = Objects.requireNonNull(id); // bắt buộc gán trong ctor
    }

    void rebind() {
        // this.id = "x"; // lỗi — final đã gán
    }
}

void localBlank(boolean flag) {
    final int n;
    if (flag) {
        n = 1;
    } else {
        n = 2;
    }
    System.out.println(n);
}
```

- Field không `final` có default (`0`/`null`/`false`) — local **không** có default; đây là khác biệt cố ý.
- Pattern variables (`instanceof String s`) cũng tuân definite assignment / scope theo luồng điều kiện — xem [§12](#12-kiểm-tra-kiểu-instanceof-pattern-matching).
- Chi tiết `final` trên class/method/field: [oop.md](oop.md), [keywords.md](keywords.md).

---

## 5. Boxing / unboxing & wrapper types

Mỗi primitive có wrapper class trong `java.lang`:

`Byte Short Integer Long Float Double Character Boolean`

```java
Integer boxed = 42;      // autoboxing
int raw = boxed;         // unboxing
int n = Integer.parseInt("42");
Integer m = Integer.valueOf(42); // ưu tiên hơn constructor (deprecated)
```

- Autoboxing tiện nhưng **cấp phát / cache** — tránh trong hot loop nếu profile nóng.
- Unboxing `null` → `NullPointerException`.
- Generic chỉ làm việc với reference: `List<Integer>` không phải `List<int>` (cho tới khi Valhalla value types — tương lai).

```java
List<Integer> list = new ArrayList<>();
list.add(1);          // box
int x = list.get(0);  // unbox
```

### 5.1 Bẫy — Integer cache & `==` trên wrappers

JLS yêu cầu `Integer.valueOf(i)` (và autobox tương đương) **cache** ít nhất **−128..127**. Ngoài vùng đó có thể là object mới mỗi lần → `==` thất bại dù cùng giá trị số.

```java
Integer a = 100;
Integer b = 100;
System.out.println(a == b);      // thường true (trong cache)

Integer c = 200;
Integer d = 200;
System.out.println(c == d);      // thường false — hai instance khác nhau
System.out.println(c.equals(d)); // true — so sánh giá trị

Integer e = Integer.valueOf(127);
Integer f = Integer.valueOf(127);
Integer g = new Integer(127);    // luôn object mới (API deprecated)
System.out.println(e == f);      // true (cache)
System.out.println(e == g);      // false
```

| Wrapper | Cache / ghi chú |
|---|---|
| `Integer` / `Byte` / `Short` / `Long` | Ít nhất −128..127; `Integer` có thể mở rộng bằng `-XX:AutoBoxCacheMax` |
| `Character` | Ít nhất `\u0000`..`\u007F` |
| `Boolean` | `TRUE` / `FALSE` singleton |
| `Float` / `Double` | **Không** cache theo valueOf chuẩn như Integer |

**Quy tắc:** so sánh nội dung wrapper → `equals` (hoặc unbox rồi so primitive). `==` chỉ khi cố ý so **identity**. Xem thêm [§10](#10-identity--vs-equals-vs-compareto).

---

## 6. Mảng (`T[]`)

- Mảng là **reference type**; subtype **covariant**: `String[]` là `Object[]` (nhưng store check runtime).

```java
String[] s = {"a", "b"};
Object[] o = s;
// o[0] = 1; // ArrayStoreException lúc chạy
```

```java
int[] a = new int[3];
int[] b = {1, 2, 3};
int[][] matrix = new int[2][3];
int[][] jagged = { {1}, {2, 3} };
```

- `length` là field final; `Cloneable`, `Serializable`.
- Tiện ích: `Arrays`, `System.arraycopy`, `Objects`, `java.util.stream.Arrays.stream`.
- Không có `Span<T>` ngôn ngữ như C#; dùng `ByteBuffer`, array + offset/length, hoặc FFM `MemorySegment` khi gần native.

### 6.1 Bẫy — Array covariance & `ArrayStoreException`

Generics **invariant** (`List<String>` không phải `List<Object>`), nhưng mảng **covariant** — lỗ hổng type-safety được vá bằng check lúc **ghi**:

```java
String[] strings = new String[1];
Object[] objects = strings;          // hợp lệ (covariance)
objects[0] = "ok";                   // OK — runtime store check pass
try {
    objects[0] = Integer.valueOf(1); // ArrayStoreException
} catch (ArrayStoreException ex) {
    // component type thật là String[]
}
```

Hệ quả thực tế:

- Tránh “nâng” `T[]` lên `Object[]` rồi ghi — lỗi chỉ lộ lúc chạy.
- API nhận `Object...` / `T...` dễ dính heap pollution khi kết hợp generics — xem [§9.3](#93-heap-pollution--safevarargs).
- Prefer `List<T>` (invariant + generics) thay mảng generic; `Arrays.asList` / `List.of` khi cần.

---

## 7. `String`, `Object` hierarchy

```text
java.lang.Object
 ├── java.lang.String          (final)
 ├── java.lang.Number          → wrappers số
 ├── java.lang.Throwable
 ├── arrays (synthetic)
 ├── enums (extends Enum<E>)
 ├── records (extends Record)
 └── user classes...
```

**`Object`** — gốc reference: `equals`, `hashCode`, `toString`, `getClass`, `wait`/`notify` (hiếm khi dùng trực tiếp
khi có `java.util.concurrent`), `clone` (protected, dễ sai — ưu tiên copy constructor / record). Chi tiết OOP: [oop.md](oop.md).

**`String`**:

- Immutable; literal vào pool; `+` biên dịch thành `StringBuilder`/`StringConcatFactory`.
- So sánh nội dung: `equals` / `contentEquals`; không dùng `==` trừ khi cố ý intern.
- Text blocks (Java 15+): `""" ... """` — xem [literals.md](literals.md).
- Java hiện đại: `STR` template processor đã có lịch sử preview; kiểm tra trạng thái cuối trên JDK 25 docs khi dùng
  string templates — ưu tiên `formatted`, `MessageFormat`, hoặc text block + `replace` nếu cần portable.

```java
String s = "Java " + 25;
String t = """
        line1
        line2
        """;
```

---

## 8. `null`, `void` / `Void`, `var`

**`null`**: literal duy nhất gán được cho mọi reference type; không gán primitive.

```java
String s = null;
if (s == null) { /* ... */ }
Optional<String> opt = Optional.ofNullable(s);
```

- Không có NRT compiler built-in như C# nullable reference types; dùng **Optional**, checker frameworks
  (`@Nullable`/`@NonNull` — JSpecify, Checker Framework), hoặc discipline + `Objects.requireNonNull`.

**`void`**: kiểu trả về method “không giá trị”. **`Void`**: reference type placeholder (thường `null`), dùng generic
`Callable<Void>`.

**`var`** (Java 10+): suy luận kiểu **local** từ initializer — vẫn static typing.

```java
var list = new ArrayList<String>(); // ArrayList<String>
var stream = list.stream();
// var x;           // lỗi — thiếu initializer
// var n = null;    // lỗi — không suy được
```

- Được dùng cho local variables, index loop, try-with-resources; **không** cho field, method param/return
  (trừ lambda param trong một số ngữ cảnh suy luận riêng).
- Nên `var` khi kiểu bên phải rõ (`var user = userRepo.find(id)`); tránh khi che mất nghĩa (`var x = f()`).

### 8.1 `var` — edge cases

| Trường hợp | Kết quả |
|---|---|
| `var x;` / `var x = null;` | Lỗi — thiếu target type |
| `var` field / method param / return | **Không** được (chỉ local) |
| `var` + diamond `new ArrayList<>()` | Suy về `ArrayList<Object>` nếu không có target khác — dễ “mất” `String` |
| `var` trong vòng `for` | OK: `for (var item : list)`, `for (var i = 0; ...)` |
| try-with-resources | OK: `try (var in = Files.newInputStream(...))` |
| Anonymous class | `var r = new Runnable() { ... }` → kiểu suy là anonymous subtype |
| Array | `var a = new int[]{1, 2}` OK; `var a = {1, 2}` **không** (array initializer cần target type) |
| Definite assignment | `var` vẫn phải có initializer tại khai báo — không có blank `var` |

```java
// Diamond + var: cẩn thận
var loose = new ArrayList<>();        // ArrayList<Object>
loose.add("x");

var tight = new ArrayList<String>();  // ArrayList<String>
var fromDecl = new ArrayList<String>();
List<String> target = new ArrayList<>(); // diamond lấy từ target type bên trái
```

- `var` không làm “dynamic”; chỉ rút gọn viết. Keyword ngữ cảnh: [keywords.md](keywords.md).

---

## 9. Generics & type erasure (depth)

```java
List<String> names = new ArrayList<>();
Map<String, List<Integer>> index = new HashMap<>();
```

- Type parameters tồn tại chủ yếu ở **compile-time**; JVM xóa (erasure) về raw/`Object`/bound.
- Không tạo `new T()`, không `instanceof List<String>` (chỉ `List`), không mảng `new T[]` an toàn hoàn toàn.
- Bounded: `T extends Number & Comparable<T>`; variance qua wildcard: `? extends` / `? super` (PECS).
- API collections & cheat sheet chọn cấu trúc → [collections-generics.md](collections-generics.md).

```java
static double sum(List<? extends Number> nums) {
    return nums.stream().mapToDouble(Number::doubleValue).sum();
}
```

### 9.1 PECS & wildcards

**PECS** — *Producer Extends, Consumer Super*:

| Wildcard | Vai trò | Đọc | Ghi |
|---|---|---|---|
| `List<? extends T>` | Producer | Ra được như `T` (thường) | Không (trừ `null`) |
| `List<? super T>` | Consumer | Ra được như `Object` | Vào được `T` |
| `List<T>` | Exact | Đọc/ghi `T` | Đọc/ghi `T` |

```java
void copy(List<? extends Number> src, List<? super Number> dst) {
    for (Number n : src) {
        dst.add(n);
    }
}

List<Integer> ints = List.of(1, 2);
List<Object> sink = new ArrayList<>();
copy(ints, sink);
```

- `?` không có bound = `? extends Object` về mặt đọc; vẫn không ghi được phần tử cụ thể (trừ `null`).
- Đừng dùng wildcard ở kiểu trả về public nếu caller cần ghi tiếp — trả `List<T>` cụ thể hơn.

### 9.2 Capture conversion (overview)

Compiler gán mỗi lần xuất hiện wildcard một **capture** ẩn (`CAP#1`) để kiểm tra an toàn — đây là lý do lỗi kiểu kiểu “capture of ?”:

```java
List<?> list = new ArrayList<String>();
// list.add(list.get(0)); // lỗi: capture không chứng minh được phần tử khớp

@SuppressWarnings("unchecked")
static <T> void swapHelper(List<T> list, int i, int j) {
    T tmp = list.get(i);
    list.set(i, list.get(j));
    list.set(j, tmp);
}

static void swap(List<?> list, int i, int j) {
    swapHelper(list, i, j); // capture → type parameter T
}
```

- Pattern *wildcard capture helper*: method generic “bắt” capture thành `T` để thao tác an toàn.
- Chi tiết sâu / collections API: [collections-generics.md](collections-generics.md).

### 9.3 Heap pollution & `@SafeVarargs`

**Heap pollution**: biến typed `List<String>` có thể thực tế chứa phần tử không phải `String` — thường từ raw types, unchecked cast, hoặc varargs generic.

```java
List raw = new ArrayList();          // raw
List<String> strings = raw;          // unchecked
raw.add(1);
// String s = strings.get(0);        // ClassCastException lúc chạy
```

Varags generic tạo mảng `T[]` bị erasure → cảnh báo unchecked:

```java
@SafeVarargs
@SuppressWarnings("varargs")
static <T> List<T> flatten(List<T>... lists) {
    // Chỉ an toàn nếu method không để mảng `lists` escape / bị ghi bởi caller không tin cậy
    List<T> out = new ArrayList<>();
    for (List<T> list : lists) {
        out.addAll(list);
    }
    return out;
}
```

| Annotation / thực hành | Khi nào |
|---|---|
| `@SafeVarargs` | Method `static`/`final`/`private` (hoặc ctor) không thể override; chứng minh không pollute |
| Tránh `T...` public dễ escape | Prefer `List<T>` / `Collection<T>` |
| Không mix raw + parameterized | Bật `-Xlint:unchecked` |

---

## 10. Identity (`==`) vs `equals` vs `compareTo`

Ba lớp so sánh dễ lẫn:

| Cơ chế | Ý nghĩa | Dùng khi |
|---|---|---|
| `==` / `!=` | Primitive: bằng giá trị. Reference: **cùng object** (identity), trừ khi cả hai unbox | Identity, enum constants, `null` check |
| `equals` | Equality ngữ nghĩa (override trên class) | Set/Map key, logic nghiệp vụ |
| `compareTo` / `Comparator` | Thứ tự toàn phần (`Comparable`) | Sort, `TreeMap`/`TreeSet` |

```java
String a = new String("hi");
String b = new String("hi");
System.out.println(a == b);        // false — khác instance
System.out.println(a.equals(b));   // true

Integer x = 200;
Integer y = 200;
System.out.println(x == y);        // thường false (ngoài cache)
System.out.println(x.equals(y));   // true

enum Color { RED, BLUE }
Color c1 = Color.RED;
Color c2 = Color.RED;
System.out.println(c1 == c2);      // true — enum singleton; equals cũng OK

record Point(int x, int y) {}
System.out.println(new Point(1, 2).equals(new Point(1, 2))); // true — record sinh equals

List<String> sorted = new ArrayList<>(List.of("b", "a"));
sorted.sort(String::compareTo);    // Comparable
sorted.sort(Comparator.comparingInt(String::length));
```

**Hợp đồng quan trọng:**

- `equals` ↔ `hashCode` phải nhất quán (bắt buộc cho `HashMap`/`HashSet`).
- `compareTo` == 0 nên khớp `equals` (khuyến nghị; `TreeMap` dùng ordering, không `equals`).
- `float`/`double`: `==` với `NaN` luôn false; prefer `Float.compare` / `Double.compare`.
- Chi tiết override `equals`/`hashCode`: [oop.md](oop.md). Toán tử `==`: [operators.md](operators.md).

---

## 11. Records, sealed, enums (trong bức tranh kiểu)

**Record** — carrier dữ liệu bất biến, `equals`/`hashCode`/`toString` sinh sẵn:

```java
public record Point(int x, int y) {}
var p = new Point(1, 2);
```

**Sealed** — hạn chế hệ phân cấp (kết hợp pattern switch):

```java
public sealed interface Shape permits Circle, Rect {}
public record Circle(double r) implements Shape {}
public record Rect(double w, double h) implements Shape {}
```

**Enum** — tập hằng singleton:

```java
public enum Level { DEBUG, INFO, WARN, ERROR }
```

Đây là baseline “kiểu dữ liệu miền” hiện đại thay cho JavaBean dài dòng khi không cần mutable state.
Chi tiết cú pháp / compact ctor / nested types: [oop.md](oop.md).

---

## 12. Kiểm tra kiểu: `instanceof` pattern matching

```java
Object o = "Java 25";

// Cũ
if (o instanceof String) {
    String s = (String) o;
    System.out.println(s.length());
}

// Pattern matching (chuẩn hiện đại)
if (o instanceof String s) {
    System.out.println(s.length()); // s đã bind, scope theo luồng điều kiện
}

if (!(o instanceof String s)) {
    return;
}
System.out.println(s.toUpperCase());
```

Kết hợp guarded / switch pattern (xem thêm [operators.md](operators.md)):

```java
double area(Shape shape) {
    return switch (shape) {
        case Circle c -> Math.PI * c.r() * c.r();
        case Rect r -> r.w() * r.h();
    };
}
```

- Pattern matching thay cast thủ công → ít `ClassCastException` do sai nhánh.
- Reference type patterns + sealed exhaustiveness là thực hành chính trên Java 25 LTS (final).

### 12.1 Preview — Primitive patterns (JEP 507)

> **Java 25 — Preview** ([JEP 507](https://openjdk.org/jeps/507)): primitive types trong pattern contexts;
> `instanceof` / `switch` làm việc với mọi primitive. **Không** bật mặc định — cần `--enable-preview`.
> Chi tiết LTS: [java25.md](java25.md).

```java
// Cần: javac --enable-preview --release 25 ...
//       java  --enable-preview ...

static String describe(Object value) {
    return switch (value) {
        case Integer i when i > 0 -> "pos int";
        case int i when i < 0 -> "neg int (unbox + pattern)"; // minh họa ý tưởng JEP 507
        case double d -> "double " + d;
        case null -> "null";
        default -> "other";
    };
}

// Exact conversion: chỉ match khi không mất thông tin
static boolean fitsByte(int n) {
    return n instanceof byte; // preview: true chỉ khi n ∈ [-128, 127]
}
```

- Mục tiêu: thay cast hẹp “câm” (`(byte) n`) bằng kiểm tra **exact** trong pattern.
- Production LTS: coi là opt-in; API public tránh phụ thuộc preview trừ khi team chấp nhận đổi qua các JDK tiếp theo (JEP 530+ trên bản sau).

---

## 13. Ép kiểu & chuyển đổi số

```java
int i = 100;
long L = i;           // widening primitive — implicit
int j = (int) L;      // narrowing — explicit, có thể cắt

Object o = "x";
String s = (String) o; // reference cast — ClassCastException nếu sai

Number n = 3.14;
double d = n.doubleValue();
```

- Widening an toàn (theo bảng chuyển đổi JLS); narrowing có thể mất dữ liệu/`char` unsigned-ish semantics.
- Reference cast lên/xuống hệ phân cấp; interface cast hợp lệ nếu runtime type implements.
- `String` ↔ số: `Integer.parseInt`, `Double.parseDouble`, `String.valueOf` — không cast trực tiếp.
- Compound assignment (`+=`…) có implicit narrowing cast — bẫy cổ điển; xem [operators.md](operators.md).

### 13.1 Bảng widening / narrowing (primitive)

**Widening** (implicit, không mất range theo JLS — `int`→`float`/`long`→`double` có thể mất *precision*):

```text
byte  → short → int → long → float → double
         ↑
        char  → int → ...
```

| Từ ↓ / Sang → | byte | short | char | int | long | float | double |
|---|---|---|---|---|---|---|---|
| **byte** | — | W | N | W | W | W | W |
| **short** | N | — | N | W | W | W | W |
| **char** | N | N | — | W | W | W | W |
| **int** | N | N | N | — | W | W* | W |
| **long** | N | N | N | N | — | W* | W* |
| **float** | N | N | N | N | N | — | W |
| **double** | N | N | N | N | N | N | — |

`W` = widening (implicit OK) · `N` = narrowing (cần cast) · `W*` = widening nhưng có thể mất precision

```java
int big = 16_777_217;   // > 2^24
float f = big;          // widening hợp lệ — nhưng f có thể không còn đúng big
long x = (long) 1e20;   // narrowing từ double literal qua context — kiểm tra tràn

byte b = 1;
// b = b + 1;            // lỗi: b+1 là int
b += 1;                  // OK — compound assignment ngầm cast về byte
```

- `boolean` **không** chuyển sang/từ số bằng cast.
- Boxing + narrowing: `(byte) (Integer) obj` cần unbox trước / sau theo thứ tự rõ ràng.
- Prefer `Math.toIntExact` / `*Exact` khi cần bắt tràn thay vì cắt im lặng.

---

## 14. Reflection, `Class`, TypeToken & `MethodHandles`

Khi cần kiểu lúc **runtime** (framework, serializer, DI):

```java
Class<String> c = String.class;
Class<?> anon = list.getClass();          // có thể là ArrayList
Type gen = List.class.getTypeParameters()[0]; // E — type variable
```

**Erasure** → `List<String>` và `List<Integer>` cùng raw `List` lúc runtime. Lấy tham số generic còn lại qua
**super type token** (pattern Guava `TypeToken` / TypeTools):

```java
abstract class TypeToken<T> {
    final Type type;
    TypeToken() {
        Type superClass = getClass().getGenericSuperclass();
        this.type = ((ParameterizedType) superClass).getActualTypeArguments()[0];
    }
}

TypeToken<List<String>> token = new TypeToken<List<String>>() {};
// token.type ≈ ParameterizedType List<String>
```

```java
ParameterizedType pt = (ParameterizedType) token.type;
System.out.println(pt.getRawType());             // interface java.util.List
System.out.println(pt.getActualTypeArguments()[0]); // class java.lang.String
```

**`MethodHandles`** (ngắn): API hiện đại hơn `Method` reflection cho call site ổn định / invokedynamic;

```java
MethodHandles.Lookup lookup = MethodHandles.lookup();
MethodHandle mh = lookup.findVirtual(
        String.class, "concat", MethodType.methodType(String.class, String.class));
String out = (String) mh.invokeExact("a", "b"); // "ab"
```

- `Lookup` tôn trọng access control của caller class.
- Dùng trong lambdas metafactory, JSON libs, bridges — không phải công cụ hàng ngày cho app code.
- Reflect chậm và mất an toàn biên dịch — ưu tiên pattern matching / sealed / generics ở biên domain.

---

## 15. Value types — ngữ cảnh tương lai

Project **Valhalla** hướng tới value/identity-free types để mang lại “primitive-like” cho user types và specialized
generics (`List<int>`). **Java 25 LTS** vẫn lấy mô hình hiện tại: 8 primitives + references + boxing.

Khi đọc tài liệu cũ/mới: đừng viết production API phụ thuộc preview Valhalla trừ khi team chủ động opt-in preview
và chấp nhận breaking changes. Theo dõi [java25.md](java25.md) / OpenJDK Valhalla khi cần cập nhật.

---

## 16. Sơ đồ type tree (ASCII)

```text
                    ┌──────────── primitives ────────────┐
                    │ byte short int long float double   │
                    │ char boolean                       │
                    └────────────────────────────────────┘
                                      │ (boxing)
                                      ▼
                         java.lang.Object (references)
                         /      |       |        \
                   String   Number    arrays    Throwable
                               |                  / \
                          Integer...           Error Exception
                         Class mirrors
                         Record / Enum<T>
                         user classes / interfaces / sealed hierarchies
```

```text
Types
├── Primitive (8) + void
├── Reference: class / interface / record / enum / array / type var
├── Generics: erasure + wildcards (PECS) + capture
└── Patterns: instanceof / switch (+ preview primitive patterns)

Values
├── Definite assignment (locals / blank final)
├── Widening vs narrowing (+ boxing cache)
├── == identity · equals · compareTo
└── Escape analysis (JIT) — không phải guarantee ngôn ngữ
```

---

## 17. Pitfalls & checklist

**Bẫy thường gặp**

| Bẫy | Triệu chứng | Cách tránh |
|---|---|---|
| Wrapper `==` | Đúng trong cache, sai ngoài | `equals` / unbox |
| Array covariance | `ArrayStoreException` lúc ghi | Prefer `List<T>`; đừng ghi qua `Object[]` |
| Unbox `null` | `NullPointerException` | Kiểm null / `Optional` / primitive |
| Raw types | Heap pollution + CCE muộn | Không dùng raw; `-Xlint` |
| `var` + diamond | `ArrayList<Object>` bất ngờ | Chỉ rõ `<T>` hoặc target type |
| Narrowing im lặng | Sai số / compound `+=` | Cast tường minh; `*Exact` |
| `equals` vs `compareTo` | `TreeMap` lệch `HashMap` | Giữ hợp đồng nhất quán |
| Preview JEP 507 | Code không chạy بدون flag | Tách module preview |

**Checklist thực hành Java 25**

- Ưu tiên primitive trong hot path; wrapper khi cần collections/generics/null.
- Dùng `record` + `sealed` + pattern `instanceof`/`switch` cho mô hình dữ liệu.
- `var` cho local rõ nghĩa; **không** field; tránh raw types.
- PECS đúng chỗ; API collections chi tiết → [collections-generics.md](collections-generics.md).
- So sánh: primitive/`enum` có thể `==`; object → `equals`; sắp xếp → `compareTo`/`Comparator`.
- Đo GC/footprint (Shenandoah generational, compact headers) và allocation (EA) khi tối ưu dịch vụ lớn —
  tách khỏi thiết kế API kiểu.
- Preview (primitive patterns) chỉ opt-in — xem [java25.md](java25.md).

---

## 18. Ma trận tính năng theo phiên bản (Java 8 → 25)

| Version | Liên quan hệ thống kiểu |
|---|---|
| **8** | Lambdas, method refs — kiểu hàm ẩn qua SAM; `java.time` |
| **9** | Modules (`module-info`); private interface methods; diamond với anonymous |
| **10** | Local-variable type inference `var` |
| **11** | `var` trong lambda params; Nestmates (access) |
| **12–13** | Switch expression preview → nền cho pattern sau này |
| **14** | `instanceof` pattern matching *(preview)*; records *(preview)*; useful NPE |
| **15** | Text blocks final; records / sealed / pattern `instanceof` *(preview tiếp)* |
| **16** | Records **final**; pattern `instanceof` **final**; sealed *(preview)*; `invokeExact` records |
| **17 LTS** | Sealed classes **final**; pattern switch *(preview)* |
| **18–19** | Pattern switch / record patterns tiếp tục preview |
| **20** | Record patterns / pattern switch tiến hóa |
| **21 LTS** | Pattern matching for `switch` **final**; record patterns **final**; unnamed patterns/vars *(preview)*; sequenced collections |
| **22** | Unnamed variables & patterns **final**; string templates *(preview — rút lại sau)* |
| **23–24** | Primitive types in patterns *(preview, JEP 455/488)*; markdown docs… |
| **25 LTS** | Flexible constructors **final** (JEP 513); Scoped Values **final**; compact source/main; module import; **JEP 507** primitive patterns *(preview)*; Compact Object Headers (JEP 519); Generational Shenandoah (JEP 521) |

Baseline tài liệu này = **Java 25 LTS** (final language features + ghi chú preview rõ ràng).
