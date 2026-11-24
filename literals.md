# Literal trong Java

**Literal** là giá trị viết trực tiếp trong mã nguồn. Tài liệu nhắm **Java 27**: số nguyên/thực,
`char`, `String` / **text blocks**, `boolean`, `null`, class literal, enum constants, underscore trong số,
và liên hệ `_` unnamed trong patterns. Theo JLS §3.10, literals gồm số nguyên/thực, boolean, char, string/text block và null; **class literal** là một dạng expression riêng (§15.8.2), **enum constant** là field/instance, không phải literal theo phân loại từ vựng.

> Cross-link: [typesystem.md](typesystem.md) · [operators.md](operators.md) · [keywords.md](keywords.md) (unnamed `_`) ·
> [statements.md](statements.md)

Java không có `decimal` suffix như C#; số thực mặc định là `double`.

---

## Mục lục

- [1. Literal số nguyên](#1-literal-số-nguyên)
- [2. Literal số thực](#2-literal-số-thực)
- [3. Dấu gạch dưới `_` trong số](#3-dấu-gạch-dưới-_-trong-số)
- [4. Binary / hex / octal](#4-binary--hex--octal)
- [5. `char` & escape sequences](#5-char--escape-sequences)
- [6. `String` literal](#6-string-literal)
- [7. Text blocks `"""`](#7-text-blocks-)
- [8. `boolean` & `null`](#8-boolean--null)
- [9. Class literals & enum constants](#9-class-literals--enum-constants)
- [10. `_` unnamed vs underscore số](#10-_-unnamed-vs-underscore-số)
- [11. Bảng tóm tắt suffix & mặc định](#11-bảng-tóm-tắt-suffix--mặc-định)
- [12. Pitfalls (Bẫy)](#12-pitfalls-bẫy)
- [13. Best practices](#13-best-practices)
- [Xem thêm](#xem-thêm)

---

## 1. Literal số nguyên

- Kiểu mặc định: **`int`**.
- Suffix **`L`/`l`** → `long` (dùng `L` hoa — tránh nhầm `1`/`l`).
- Không có suffix `U` unsigned — thao tác không dấu qua `Integer.toUnsigned*` / `>>>`.

```java
int a = 42;
int b = 1_000_000;
long big = 9_000_000_000L;
long hexLong = 0xFF_FF_FF_FFL;
```

Phạm vi:

- Decimal `int` literal thường trong `0..2147483647`; dấu `-` là unary operator. Giá trị `2147483648` chỉ được dùng trực tiếp làm operand của unary `-`.
- Hex/binary/octal có thể biểu diễn **bit pattern** 32-bit (64-bit khi có `L`): `0xFFFF_FFFF` là `int -1`, không phải số dương 4_294_967_295. Muốn giá trị dương đó, viết `0xFFFF_FFFFL`.
- `2147483648` không hợp lệ kiểu `int`; dùng `2147483648L` hoặc `-2147483648` (biên đặc biệt của `int`).

```java
int min = -2147483648;     // OK — đúng MIN_VALUE
// int bad = 2147483648;   // lỗi
long ok = 2147483648L;
long minLong = -9223372036854775808L; // biên đặc biệt tương tự của long
```

---

## 2. Literal số thực

- Mặc định: **`double`**.
- Suffix **`F`/`f`** → `float`; **`D`/`d`** → `double` (tùy chọn).
- Kí pháp khoa học: `1.2e-3`, `1E4`.
- Hexadecimal floating (ít dùng): `0x1.0p0` (`p` = binary exponent).

```java
double pi = 3.14159;
double e = 1.2e3;       // 1200.0
float f = 3.14f;
double d = 3.14d;
double hexFloat = 0x1.8p1; // 3.0
```

- IEEE 754 — sai số nhị phân; tiền tệ dùng `BigDecimal` (tạo từ `String`, tránh `new BigDecimal(0.1)`).
- Literal floating-point khác 0 mà quá lớn thành infinity hoặc quá nhỏ bị làm tròn về 0 gây lỗi biên dịch. `NaN`/infinity không có literal riêng; dùng `Double.NaN`, `Double.POSITIVE_INFINITY` khi cần.

```java
BigDecimal price = new BigDecimal("19.99");
// new BigDecimal(0.1); // 0.10000000000000000555… — bẫy
```

---

## 3. Dấu gạch dưới `_` trong số

Từ **Java 7**: nhóm chữ số cho dễ đọc (không đổi giá trị).

```java
int million = 1_000_000;
long bytes = 0b1100_1001_1111;
double x = 3.141_592_653;
int hex = 0xFF_EC_DE_5E;
```

**Không** đặt `_` ở:

| Vị trí cấm | Ví dụ sai |
|------------|-----------|
| Đầu / cuối literal | `_1` là identifier (không phải numeric literal); `1_` là literal sai |
| Cạnh `.` thập phân | `3_.14`, `3._14` |
| Ngay sau `0x` / `0b` | `0x_FF`, `0b_01` |
| Trước suffix | `1000_L`, `1.0_f` |

Nhiều `_` liên tiếp giữa chữ số vẫn hợp lệ: `1__000`; tránh nếu làm khó đọc.

---

## 4. Binary / hex / octal

```java
int dec = 42;
int hex = 0x2A;        // 42
int bin = 0b0010_1010; // 42 — Java 7+
int oct = 052;         // 42 — prefix 0 (dễ nhầm!)
```

| Cơ số | Prefix | Version | Ghi chú |
|-------|--------|---------|---------|
| Decimal | (không) | — | Mặc định |
| Hex | `0x` / `0X` | — | Thường cho mask / màu |
| Binary | `0b` / `0B` | **7+** | Flag bit rõ ràng |
| Octal | `0` + chữ số 0–7 | — | **Tránh** trong code mới |

```java
int oops = 010; // 8, không phải 10
```

---

## 5. `char` & escape sequences

`char` là một **UTF-16 code unit** (16-bit). Ngoài BMP cần surrogate pair trong `String` / `int` code point.

```java
char c1 = 'A';
char c2 = '\n';
char c3 = '\u03A9'; // Ω
char c4 = 65;       // 'A'
```

| Escape | Nghĩa |
|---|---|
| `\b` | backspace |
| `\t` | tab |
| `\n` | newline |
| `\f` | form feed |
| `\r` | carriage return |
| `\"` | double quote |
| `\'` | single quote |
| `\\` | backslash |
| `\uXXXX` | Unicode hex (đúng 4 chữ) |
| `\s` | space (char, string và text block — Java 15+) |

- `\u` xử lý **sớm** trên toàn source (kể cả comment) — cẩn thận ghi `\u` trong comment.
- Octal escape kiểu C tồn tại hạn chế trong string cổ — ưu tiên `\u` / text block.

```java
char omega = '\u03A9';
int grinning = 0x1F600; // code point
char[] chars = Character.toChars(grinning);
```

---

## 6. `String` literal

```java
String s = "Hello";
String t = "Line1\nLine2";
String q = "He said \"hi\"";
String path = "C:\\temp"; // nội dung C:\temp, một backslash
```

- String literals và String constant expressions cùng nội dung được **intern** theo JLS; cùng reference là bảo đảm trong trường hợp này. Với chuỗi runtime nói chung, so nội dung bằng `equals` — [typesystem.md](typesystem.md) · [operators.md](operators.md).
- Nối compile-time constant được gộp bởi compiler.
- `String` là reference; literal không phải primitive.
- Không có verbatim `@""` như C# — dùng text blocks hoặc escape.

```java
String a = "java";
String b = "java";
String c = new String("java");
// a == b luôn true (intern); a == c false; a.equals(c) true
```

---

## 7. Text blocks `"""`

**Java 15+** (chuẩn): chuỗi nhiều dòng, kiểm soát indent. (Preview 13–14.)

```java
String json = """
        {
          "name": "Java",
          "version": 25
        }
        """;

String query = """
        SELECT id, name
        FROM users
        WHERE active = %s
        """.formatted(true);
```

### 7.1 Incidental whitespace

- Nội dung bắt đầu **sau** dòng mở `"""`.
- Mức incidental indent lấy theo dòng nội dung không trống ít thụt vào nhất, cùng vị trí delimiter đóng nếu nó nằm trên dòng riêng. Delimiter đóng ở cột 0 có thể giữ lại toàn bộ leading indent.
- Dòng chỉ whitespace có thể bị rút theo quy tắc JLS — đừng giả định “mọi khoảng trắng được giữ”.

```java
// Đóng cùng cột nội dung → strip 4 spaces đầu mỗi dòng
String a = """
    line1
    line2
    """;

// Đóng ở cột 0 → giữ 4 spaces đầu mỗi dòng nội dung
String b = """
    line1
    line2
""";
```

In `String` / dùng IDE “Show whitespaces” khi debug JSON/YAML lệch.

### 7.2 Escapes trong text block

| Escape / cú pháp | Tác dụng |
|------------------|----------|
| `"` thường | Không cần `\"` cho dấu ngoặc kép bên trong |
| `\"` / `\\` | Vẫn hợp lệ khi cần |
| `\s` | Giữ **một** khoảng trắng (kể cả cuối dòng — chống strip trailing) |
| `\` cuối dòng | **Line continuation** — nối với dòng sau, bỏ newline |
| `\n` `\t` … | Như string thường |
| `\uXXXX` | Vẫn qua Unicode escape sớm |

```java
String kept = """
        name:\s
        """; // trailing space sau "name:" được giữ nhờ \s

String continued = """
        abc\
        def
        """; // "abcdef\n" — bỏ newline giữa abc và def, vẫn có newline cuối
```

### 7.3 So sánh nhanh

| | `"..."` | Text block |
|--|---------|------------|
| Nhiều dòng | `\n` thủ công | Tự nhiên |
| `"` bên trong | Cần `\"` | Thường không |
| Indent | Thủ công | Incidental strip theo delimiter |
| Trailing space | Giữ trong literal | Có thể bị strip → dùng `\s` |

---

## 8. `boolean` & `null`

```java
boolean ok = true;
boolean fail = false;
String s = null;
```

- Chỉ `true` / `false` — không ép từ số (`if (1)` illegal).
- `null` gán mọi reference / array / type variable nullable; không gán primitive.
- Không có literal `default` kiểu C#.

---

## 9. Class literals & enum constants

```java
Class<String> cs = String.class;
Class<int[]> arr = int[].class;
Class<Integer> ci = int.class;     // Class đại diện primitive
Class<?> voidC = void.class;
```

- Reflection, generic APIs, `ServiceLoader` — [packages-modules.md](packages-modules.md).
- `List.class` là raw — cẩn thận unchecked.

**Enum constants** — static final instances:

```java
enum Color { RED, GREEN, BLUE }

Color c = Color.RED;
String hex = switch (c) {
    case RED -> "#f00";
    case GREEN -> "#0f0";
    case BLUE -> "#00f";
};
```

---

## 10. `_` unnamed vs underscore số

Hai ý nghĩa **khác nhau** — đừng lẫn:

| Ngữ cảnh | Ý nghĩa | Version |
|----------|---------|---------|
| Trong **numeric literal** | Tách nhóm chữ số `1_000` | **7+** |
| Unnamed variable / pattern / lambda param | Discard — không đọc/gán như biến | **22+** (JEP 456) |

```java
int n = 1_000_000; // underscore trong literal số

for (var _ : items) {        // unnamed — Java 22+
    counter++;
}

int result = switch (p) { // p có static type Object, Point là record(int x, int y)
    case Point(_, int y) -> y; // bỏ component — xem keywords.md
    case String _ -> 0;
    case null -> 0;
    default -> -1;
};
```

Chi tiết unnamed: [keywords.md §4](keywords.md#4-unnamed-variable--pattern-_) · [statements.md](statements.md).

**Version gate:** `_` là identifier thường đến Java 8 (có cảnh báo), thành reserved keyword từ **Java 9**. Java 21 preview/22 final cho phép `_` ở vị trí unnamed; không khôi phục khả năng đọc nó như tên biến.

---

## 11. Bảng tóm tắt suffix & mặc định

| Literal | Kiểu mặc định / kết quả | Suffix / ghi chú |
|---|---|---|
| `42` | `int` | `L` → `long` |
| `0x2A`, `0b1010` | `int` | + `L` nếu cần long; binary **7+** |
| `052` | `int` octal | tránh |
| `3.14` | `double` | `f` → float |
| `1e-3` | `double` | |
| `0x1.0p0` | `double` | hex float |
| `'A'` | `char` | |
| `"..."` | `String` | pool |
| `"""..."""` | `String` | text block **15+** |
| `true`/`false` | `boolean` | |
| `null` | null type / bottom ref | |
| `Foo.class` | `Class<Foo>` | |
| `E.CONST` | enum type | |

Hằng compile-time (`static final` + constant expression) dùng được làm annotation element / case label cổ điển:

```java
public static final int MAX = 100;
public static final String NAME = "app" + "-" + MAX;
```

---

## 12. Pitfalls (Bẫy)

1. **Octal `010`** — bằng 8; leading zero trong “số thập phân” là bẫy kinh điển.
2. **`new BigDecimal(0.1)`** — không Exact; dùng `BigDecimal("0.1")` / `valueOf` có hiểu biết.
3. **Text block indent lệch** — JSON/YAML fail vì incidental whitespace / thiếu `\s`.
4. **Trailing space trong text block** bị strip — cần `\s` cuối dòng.
5. **`\u` trong comment** — vẫn được dịch sớm; có thể “phá” source nếu viết dở.
6. **Suy từ literal sang chuỗi runtime** — literal cùng nội dung được intern, nhưng chuỗi tính lúc runtime không bảo đảm cùng identity; dùng `equals` cho nội dung.
7. **`l` thường cho long** — `1l` dễ đọc thành `11`; dùng `1L`.
8. **`float` literal thiếu `f`** — `float x = 1.0;` lỗi (mặc định double).
9. **Nhầm `_` số với unnamed `_`** — ngữ cảnh hoàn toàn khác (7 vs 22).
10. **Surrogate / BMP** — `char` một code unit ≠ một “ký tự” Unicode đầy đủ.

```java
String yaml = """
        key: value\s
        """; // giữ space sau value nếu schema cần
```

---

## 13. Best practices

1. Nhóm số bằng `_` (`1_000_000`) — dễ review.
2. Prefer `0b` / `0x` thay octal; cấm leading-zero “thập phân”.
3. Text block cho JSON/SQL/HTML; kiểm tra delimiter đóng và `\s` khi cần.
4. Tiền tệ / số thập phân chính xác → `BigDecimal` từ `String`.
5. So String bằng `equals` / `Objects.equals`.
6. Unnamed `_` (22+) khi discard trong pattern / catch / try-with-resources.
7. Enum + switch expression không `default` nếu muốn exhaustiveness — [statements.md](statements.md).

```text
□ không octal bất ngờ
□ text block: kiểm tra indent + trailing \s
□ BigDecimal từ String
□ L hoa cho long
□ _ số ≠ _ unnamed
```

---

## Xem thêm

| File | Liên quan |
|------|-----------|
| [typesystem.md](typesystem.md) | Primitive / wrapper / String |
| [operators.md](operators.md) | `==` trên literal / pool |
| [keywords.md](keywords.md) | Unnamed `_` |
| [statements.md](statements.md) | Pattern / switch với literal & `_` |
| [typesystem.md](typesystem.md) | Kiểu & literal |

---

*Tham chiếu nhanh — Java 27. Underscore số từ 7; text blocks từ 15; unnamed `_` từ 22.*
