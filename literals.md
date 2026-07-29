# Literal

**Literal** là giá trị viết trực tiếp trong mã nguồn. Java hỗ trợ literal số nguyên/thực, `char`, `String`
(và **text blocks**), `boolean`, `null`, cùng class literal (`Type.class`) và hằng enum. Java không có
`decimal` suffix như C#; số thực mặc định là `double`.

---

## Mục lục

- [Literal](#literal)
  - [Mục lục](#mục-lục)
  - [1. Literal số nguyên](#1-literal-số-nguyên)
  - [2. Literal số thực](#2-literal-số-thực)
  - [3. Dấu gạch dưới `_`](#3-dấu-gạch-dưới-_)
  - [4. Binary / hex / octal](#4-binary--hex--octal)
  - [5. `char` \& escape sequences](#5-char--escape-sequences)
  - [6. `String` literal](#6-string-literal)
  - [7. Text blocks `"""`](#7-text-blocks-)
  - [8. `boolean` \& `null`](#8-boolean--null)
  - [9. Class literals \& enum constants](#9-class-literals--enum-constants)
  - [10. Bảng tóm tắt suffix \& mặc định](#10-bảng-tóm-tắt-suffix--mặc-định)

---

## 1. Literal số nguyên

- Kiểu mặc định của literal nguyên: **`int`**.
- Suffix **`L`/`l`** → `long` (nên dùng `L` hoa để khỏi nhầm `1`/`l`).
- Không có suffix `U` unsigned — Java nguyên có dấu (trừ thao tác `Integer.toUnsigned*` / `>>>`).

```java
int a = 42;
int b = 1_000_000;
long big = 9_000_000_000L;
long hexLong = 0xFF_FF_FF_FFL;
```

Phạm vi:

- Literal `int` phải nằm trong `Integer.MIN_VALUE..MAX_VALUE` (trừ khi gắn `L`).
- `2147483648` không hợp lệ kiểu `int`; dùng `2147483648L` hoặc `-2147483648` ( biên đặc biệt).

---

## 2. Literal số thực

- Mặc định: **`double`**.
- Suffix **`F`/`f`** → `float`; **`D`/`d`** → `double` (tùy chọn).
- Kí pháp khoa học: `1.2e-3`, `1E4`.

```java
double pi = 3.14159;
double e = 1.2e3;       // 1200.0
float f = 3.14f;
double d = 3.14d;
```

- IEEE 754 — sai số nhị phân; tiền tệ dùng `BigDecimal` (tạo từ `String`, tránh `new BigDecimal(0.1)`).

```java
BigDecimal price = new BigDecimal("19.99");
```

---

## 3. Dấu gạch dưới `_`

Từ Java 7: nhóm chữ số cho dễ đọc.

```java
int million = 1_000_000;
long bytes = 0b1100_1001_1111;
double x = 3.141_592_653;
int hex = 0xFF_EC_DE_5E;
```

**Không** đặt `_` ở:

- Đầu/cuối literal
- Ngay cạnh `.` thập phân (`3_.14`, `3._14`)
- Ngay sau prefix `0x`/`0b` hoặc trước suffix (`0x_FF`, `1000_L`)

---

## 4. Binary / hex / octal

```java
int dec = 42;
int hex = 0x2A;        // 42
int bin = 0b0010_1010; // 42
int oct = 052;         // 42 — prefix 0 (dễ nhầm!)
```

- **Hex**: `0x` / `0X`
- **Binary**: `0b` / `0B` (Java 7+)
- **Octal**: tiền tố `0` + chữ số 0–7 — **tránh** trong code mới; dễ bug `010 == 8`

```java
int oops = 010; // 8, không phải 10
```

---

## 5. `char` & escape sequences

`char` là một **UTF-16 code unit** (16-bit). Ký tự ngoài BMP cần surrogate pair trong `String` / `int` code point.

```java
char c1 = 'A';
char c2 = '\n';
char c3 = '\u03A9'; // Ω
char c4 = 65;       // 'A' — int trong range char
```

Escape trong `char`/`String`:

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
| `\s` | space (trong text block incidental — Java 15+) |

- `\u` được xử lý **sớm** trên toàn bộ source (kể cả ngoài string) — cẩn thận khi ghi `\u` trong comment.
- Octal escape kiểu C (`\012`) tồn tại hạn chế trong string cổ — ưu tiên `\u` / text block.

```java
char omega = '\u03A9';
int grinning = 0x1F600; // code point — Character.toChars(grinning)
```

---

## 6. `String` literal

```java
String s = "Hello";
String t = "Line1\nLine2";
String q = "He said \"hi\"";
String path = "C:\\\\temp"; // Windows path trong chuỗi thường
```

- Literal cùng nội dung có thể được **intern** vào pool → `==` có thể true nhưng **luôn** so `equals` cho nội dung.
- Nối compile-time constant được gộp bởi compiler.
- `String` là reference; literal không phải primitive.

```java
String a = "java";
String b = "java";
String c = new String("java");
// a == b  thường true (pool); a == c false; a.equals(c) true
```

Không có verbatim `@""` như C# — dùng text blocks hoặc escape.

---

## 7. Text blocks `"""`

Java 15+ (chuẩn): chuỗi nhiều dòng, kiểm soát indent.

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

Quy tắc quan trọng:

- Nội dung bắt đầu **sau** dòng mở `"""`; đóng `"""` quyết định mức **incidental indent** bị strip.
- Escape vẫn dùng được; `\"` không bắt buộc cho `"` bên trong text block.
- `\s` giữ khoảng trắng cuối dòng; `\` ở cuối dòng → nối dòng (line continuation) bỏ newline.
- So với C# raw string: tương đương tinh thần, khác quy tắc indent delimiter.

```java
String html = """
        <html>
          <body>
            <p>Hi</p>
          </body>
        </html>
        """;
```

---

## 8. `boolean` & `null`

```java
boolean ok = true;
boolean fail = false;
String s = null;
```

- Chỉ `true` / `false` — không ép từ số như C (`if (1)`非法).
- `null` gán cho mọi reference type / array / type variable nullable; không gán primitive.
- Không có literal `default` kiểu C#.

---

## 9. Class literals & enum constants

**Class literal**: biểu thức kiểu `Class<?>` 

```java
Class<String> cs = String.class;
Class<int[]> arr = int[].class;
Class<Integer> ci = int.class;     // Class đại diện primitive
Class<?> voidC = void.class;

var name = String.class.getName();
```

- Dùng cho reflection, API generic (`List.class` raw — cẩn thận), pattern service loader.
- `void.class` / `Integer.TYPE` liên quan primitive/`Void`.

**Enum constants** — cũng là “literal” ngữ nghĩa (static final instances):

```java
enum Color { RED, GREEN, BLUE }

Color c = Color.RED;
Color d = Enum.valueOf(Color.class, "GREEN");
```

Switch với enum / pattern:

```java
String hex = switch (c) {
    case RED -> "#f00";
    case GREEN -> "#0f0";
    case BLUE -> "#00f";
};
```

---

## 10. Bảng tóm tắt suffix & mặc định

| Literal | Kiểu mặc định / kết quả | Suffix / ghi chú |
|---|---|---|
| `42` | `int` | `L` → `long` |
| `0x2A`, `0b1010` | `int` | + `L` nếu cần long |
| `052` | `int` octal | tránh |
| `3.14` | `double` | `f` → float |
| `1e-3` | `double` | |
| `'A'` | `char` | |
| `"..."` | `String` | pool |
| `"""..."""` | `String` | text block |
| `true`/`false` | `boolean` | |
| `null` | null type / bottom ref | |
| `Foo.class` | `Class<Foo>` | |
| `E.CONST` | enum type | |

Hằng compile-time (`static final` + khởi tạo constant expression) mới dùng được làm annotation element /
case label cổ điển (trước khi pattern switch nới lỏng).

```java
public static final int MAX = 100;
public static final String NAME = "app" + "-" + MAX; // constant folding nếu biểu thức hợp lệ
```
