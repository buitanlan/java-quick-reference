# Toán tử (Operators) trong Java

Tài liệu tham chiếu toán tử Java theo thực hành **Java 25 LTS**: số học, quan hệ, logic, bit, gán,
`instanceof` (pattern), cast, `?:`, lambda `->`, method reference `::`, `new`, truy cập `.` / `[]`.
Không có con trỏ / `*` `&` kiểu C.

> Cross-link: [typesystem.md](typesystem.md) (`==` vs `equals`) · [statements.md](statements.md) (switch / patterns) ·
> [literals.md](literals.md) · [lambdas-functional.md](lambdas-functional.md) · [keywords.md](keywords.md) ·
> [java25.md](java25.md)

---

## Mục lục

- [1. Tổng quan & nguyên tắc](#1-tổng-quan--nguyên-tắc)
- [2. Bảng ưu tiên (precedence)](#2-bảng-ưu-tiên-precedence)
- [3. Số học & `%` & overflow](#3-số-học----overflow)
- [4. `++` / `--`](#4----)
- [5. Quan hệ & bằng (`==` vs `equals`)](#5-quan-hệ--bằng--vs-equals)
- [6. Logic & short-circuit](#6-logic--short-circuit)
- [7. Bitwise & dịch bit](#7-bitwise--dịch-bit)
- [8. Gán & compound assignment](#8-gán--compound-assignment)
- [9. `instanceof`, pattern & cast](#9-instanceof-pattern--cast)
- [10. Điều kiện `?:`](#10-điều-kiện-)
- [11. `->` (lambda) & `::` (method reference)](#11---lambda---method-reference)
- [12. `new`, `.`, `[]`](#12-new--)
- [13. Switch expression (arrow) — pointer](#13-switch-expression-arrow--pointer)
- [14. Không có pointer operators](#14-không-có-pointer-operators)
- [15. Pitfalls (Bẫy)](#15-pitfalls-bẫy)
- [16. Best practices](#16-best-practices)
- [Xem thêm](#xem-thêm)

---

## 1. Tổng quan & nguyên tắc

- Biểu thức đánh giá theo **precedence** + **associativity**; khi nghi ngờ → dùng ngoặc.
- `&&` / `||` là **short-circuit**; `&` / `|` trên `boolean` **không** short-circuit.
- Số nguyên: tràn **two’s complement** im lặng (không checked mặc định) — dùng `Math.*Exact` khi cần bắt tràn.
- So sánh object: `==` so reference (hoặc primitive value); nội dung → `equals` — chi tiết [typesystem.md §10](typesystem.md#10-identity--vs-equals-vs-compareto).
- Pattern matching `instanceof` / `switch` là thực hành hiện đại thay cast thủ công.

---

## 2. Bảng ưu tiên (precedence)

Từ **cao → thấp** (tóm tắt JLS). Cùng bậc: hầu hết trái → phải; unary / ternary / assignment phải → trái.

| Bậc | Nhóm | Toán tử |
|-----|------|---------|
| 1 | Postfix / primary | `expr++` `expr--` · `()` gọi · `[]` · `.` · tạo liên quan |
| 2 | Unary | `++expr` `--expr` `+` `-` `~` `!` *(phải → trái)* |
| 3 | Cast | `(Type) expr` |
| 4 | Multiplicative | `*` `/` `%` |
| 5 | Additive | `+` `-` (cũng nối `String`) |
| 6 | Shift | `<<` `>>` `>>>` |
| 7 | Relational | `<` `>` `<=` `>=` `instanceof` |
| 8 | Equality | `==` `!=` |
| 9 | Bitwise AND | `&` |
| 10 | Bitwise XOR | `^` |
| 11 | Bitwise OR | `|` |
| 12 | Logical AND | `&&` |
| 13 | Logical OR | `||` |
| 14 | Ternary | `?:` *(phải → trái)* |
| 15 | Assignment | `=` `+=` `-=` `*=` `/=` `%=` `&=` `|=` `^=` `<<=` `>>=` `>>>=` *(phải → trái)* |
| 16 | Lambda | `->` (ngữ cảnh riêng, không trộn như toán tử số học thường) |

> `::` và `new` thuộc primary / creation — ưu tiên cao như thành phần primary.

```java
// Precedence: + trước == ; && trước ||
boolean ok = a + b == c && flag || other;
// ≡ ((a + b) == c && flag) || other
```

---

## 3. Số học & `%` & overflow

```java
int a = 7 / 2;        // 3 — chia nguyên về 0
double b = 7 / 2.0;   // 3.5
int r = 7 % 2;        // 1
int n = -7 % 2;       // -1 — dấu theo dividend (khác một số ngôn ngữ)
```

- `+` với `String`: nếu một toán hạng là `String` → nối chuỗi (`String.valueOf` toán hạng kia).
- `/` nguyên chia 0 → `ArithmeticException`; `double` → `Infinity` / `NaN`.
- **Overflow im lặng:**

```java
int wrap = Integer.MAX_VALUE + 1; // Integer.MIN_VALUE — không throw
int s = Math.addExact(Integer.MAX_VALUE, 1); // throws ArithmeticException
long p = Math.multiplyExact(1_000_000, 1_000_000); // OK nếu fit long
```

| API | Khi nào |
|-----|---------|
| `Math.addExact` / `subtractExact` / `multiplyExact` | Cần fail-fast khi tràn |
| `Math.toIntExact(long)` | Thu hẹp `long` → `int` an toàn |
| `Math.floorDiv` / `floorMod` | Chia/modulo hướng sàn (khác `/` `%` với số âm) |

```java
Math.floorDiv(-7, 2); // -4
Math.floorMod(-7, 2); // 1   — khác (-7 % 2 == -1)
```

---

## 4. `++` / `--`

```java
int x = 1;
int a = ++x; // x=2, a=2
int b = x++; // x=3, b=2
```

- Prefix: tăng/giảm rồi trả giá trị mới; postfix: trả cũ rồi tăng/giảm.
- Operand phải là biến / slot gán được.
- Tránh nhiều `++` trong cùng biểu thức — JLS xác định nhưng khó đọc.

---

## 5. Quan hệ & bằng (`==` vs `equals`)

```java
1 < 2;  2 <= 2;  3 > 1;  3 >= 4; // false
1 == 1; 1 != 2;

String s = "a";
String t = new String("a");
s == t;              // false — khác instance
s.equals(t);         // true
Objects.equals(s, t); // null-safe
Objects.equals(null, null); // true
```

| Toán hạng | `==` / `!=` | Nội dung |
|-----------|-------------|----------|
| Primitive | So giá trị | — |
| Reference | **Identity** (cùng object) | `equals` |
| Wrapper (`Integer`…) | Identity — **bẫy cache** −128..127 | `equals` / unbox |
| `enum` | Identity OK (singleton) | `equals` cũng đúng |
| `float`/`double` | `NaN == NaN` → **false** | `Float.compare` / `Double.isNaN` |

```java
Integer a = 128;
Integer b = 128;
a == b;                 // thường false — ngoài cache
Objects.equals(a, b);   // true
```

Chi tiết cache / hợp đồng: [typesystem.md §5.1](typesystem.md#51-bẫy--integer-cache---trên-wrappers) · [typesystem.md §10](typesystem.md#10-identity--vs-equals-vs-compareto).
Override `equals`/`hashCode`: [oop.md](oop.md).

- `Comparator` / `Comparable` cho thứ tự; Java **không** overload `<` cho object.

---

## 6. Logic & short-circuit

```java
boolean a = true;
boolean b = false;

a && b;  // false — không đánh giá vế phải nếu a false
a || b;  // true  — không đánh giá vế phải nếu a true
!a;

// Không short-circuit:
a & b;
a | b;
a ^ b;   // XOR boolean
```

```java
String s = null;
if (s != null && s.length() > 0) { // an toàn nhờ short-circuit
    // ...
}

// Nguy hiểm nếu dùng & :
// if (s != null & s.length() > 0) → NPE khi s == null
```

- Side-effect ở vế phải **có thể không chạy** với `&&`/`||` — tính năng; đừng phụ thuộc ngược (“phải chạy”).
- Prefer `&&`/`||` cho điều kiện; `&`/`|` boolean chỉ khi cố ý đánh giá cả hai (hiếm, và dễ NPE).

---

## 7. Bitwise & dịch bit

```java
int x = 0b0011_1100;
int y = 0b0000_1101;

x & y;   // AND
x | y;   // OR
x ^ y;   // XOR
~x;      // NOT (đảo bit theo bề rộng int/long)

x << 2;  // dịch trái
x >> 2;  // dịch phải số học (giữ dấu)
x >>> 2; // dịch phải logic (lấp 0)
```

- Shift mask: khoảng dịch lấy modulo bề rộng (`int` 5 bit thấp, `long` 6 bit) — `1 << 32` ≡ `1 << 0` với `int`.
- Prefer `EnumSet` / enum flags hơn int mask thủ công khi domain rõ.
- Không có `<<<`.

---

## 8. Gán & compound assignment

```java
int i = 5;
i += 2;   // i = (int)(i + 2) — cast ngầm về kiểu LHS
i <<= 1;
```

```java
byte b = 1;
b += 1;       // OK — compound có cast ngầm
// b = b + 1; // lỗi — b+1 thành int
```

- Gán là biểu thức (trả giá trị gán) — tránh chuỗi khó đọc `a = b = c`.
- Compound với wrapper có thể unbox/box ẩn → NPE nếu LHS wrapper `null` (`Integer x = null; x += 1;`).

---

## 9. `instanceof`, pattern & cast

```java
Object o = "Java";

if (o instanceof String s) { // pattern matching (Java 16+)
    System.out.println(s.toUpperCase());
}

String s2 = (String) o;      // cast tường minh — ClassCastException nếu sai
Number n = 42;
int v = (Integer) n;         // unbox sau cast
```

- `null instanceof T` luôn **false** (không NPE).
- Cast primitive: narrowing / widening theo JLS.
- Cast reference: lên/xuống hierarchy / interface được implement lúc runtime.
- Pattern `instanceof` = baseline hiện đại (thay if + cast).

**Guarded patterns** (switch / pattern):

```java
if (o instanceof String s && s.length() > 3) {
    System.out.println(s);
}
```

Switch patterns, sealed exhaustiveness, record patterns: [statements.md](statements.md).
Primitive patterns (preview JEP 507): [statements.md §6](statements.md#6-pattern-matching--jep-507-preview) · [java25.md](java25.md).

---

## 10. Điều kiện `?:`

```java
int abs = x >= 0 ? x : -x;
String label = user != null ? user.name() : "anonymous";
```

- Associativity phải → trái: `a ? b : c ? d : e` ≡ `a ? b : (c ? d : e)`.
- Hai nhánh phải compatible (numeric promotion / reference lub).
- Đừng lồng ternary sâu — dùng `if` / switch expression.

---

## 11. `->` (lambda) & `::` (method reference)

Không phải toán tử số học; cú pháp tạo instance functional interface — chi tiết [lambdas-functional.md](lambdas-functional.md).

```java
Function<String, Integer> len = s -> s.length();
Function<String, Integer> len2 = String::length;
Supplier<List<String>> lists = ArrayList::new;
Consumer<String> print = System.out::println;
```

| Dạng | Ví dụ |
|---|---|
| Static | `Integer::parseInt` |
| Bound instance | `already::equals` |
| Unbound instance | `String::isBlank` |
| Constructor | `HashMap::new` |
| Array ctor | `String[]::new` |

- Target type suy từ ngữ cảnh; checked exceptions phải khớp SAM.

---

## 12. `new`, `.`, `[]`

```java
var list = new ArrayList<String>();
var arr = new int[] {1, 2, 3};
var matrix = new int[2][3];

list.add("x");
arr[0] = 10;
char ch = "java".charAt(0);
```

- `new` cấp phát object/array trên heap (trừ tối ưu JVM).
- Anonymous class: `new Runnable() { … }` — ưu tiên lambda nếu SAM.
- `.` thành viên; `[]` index mảng (bounds → `ArrayIndexOutOfBoundsException`).

---

## 13. Switch expression (arrow) — pointer

Switch hiện đại vừa **statement** vừa **expression**; dạng mũi tên không fall-through:

```java
int days = switch (month) {
    case 1, 3, 5, 7, 8, 10, 12 -> 31;
    case 4, 6, 9, 11 -> 30;
    case 2 -> (leap ? 29 : 28);
    default -> throw new IllegalArgumentException();
};

String describe = switch (shape) {
    case Circle c -> "r=" + c.r();
    case Rect r when r.w() == r.h() -> "square";
    case Rect r -> "rect";
};
```

- `->` trong switch **không** phải lambda — là switch labeled production.
- `yield` trong khối khi cần trả giá trị phức tạp — [statements.md](statements.md) (`yield` vs `return`).
- Exhaustiveness sealed / enum: [statements.md](statements.md).

---

## 14. Không có pointer operators

Java **không** có:

- `*` dereference, `&` address-of, `->` member qua con trỏ (C/C++)
- Số học con trỏ, `free`

Gần native:

- **FFM API** (`java.lang.foreign.MemorySegment`, `Arena`, `Linker`) — ổn định Java 22+; overview: [typesystem.md](typesystem.md) §2.3
- `VarHandle` / `MethodHandle`
- `--enable-native-access` khi gọi restricted native

Reference Java là managed — gán / `==` trên identity object, không phải địa chỉ số học.

---

## 15. Pitfalls (Bẫy)

1. **`==` trên object / wrapper** — so identity; ngoài Integer cache dễ `false` dù cùng giá trị → `Objects.equals`.
2. **Overflow im lặng** — `MAX_VALUE + 1` wrap; tiền / kích thước → `*Exact` hoặc `long`/`BigInteger`.
3. **`&` / `|` thay `&&` / `||`** — đánh giá cả hai vế → NPE / side-effect thừa.
4. **Side-effect ở vế phải short-circuit** — có thể không chạy; đừng đặt logic bắt buộc ở đó.
5. **`+` String vô tình** — `1 + 2 + "x"` → `"3x"` nhưng `"x" + 1 + 2` → `"x12"`.
6. **Shift mask** — `1 << 32` với `int` ≡ `1 << 0`.
7. **Compound + wrapper null** — `Integer x = null; x += 1;` → NPE.
8. **`NaN`** — mọi so sánh `==` với `NaN` false; dùng `Double.isNaN`.
9. **Cast không pattern** — `ClassCastException`; prefer `instanceof` pattern.
10. **Nhầm `->` switch với lambda** — ngữ cảnh khác; `yield` chỉ trong switch expression.

```java
System.out.println(1 + 2 + "x"); // 3x
System.out.println("x" + 1 + 2); // x12
```

---

## 16. Best practices

- Java **không** cho user overload toán tử; `BigInteger`/`BigDecimal` dùng method `add`/`multiply`.
- `Objects.equals` / `Comparator` thay `==` trên object.
- Short-circuit để tránh NPE; đừng nhét side-effect vào vế phải “tình cờ”.
- Prefer pattern `instanceof` và switch expression thay chuỗi cast.
- Bit ops: comment ý nghĩa mask; cân nhắc `EnumSet`.
- Đo khi tối ưu: autoboxing ẩn trong `==`/`+` với wrapper dễ tạo bug cache/`null`.

Checklist:

```text
□ object → equals / Objects.equals; primitive → ==
□ nghi overflow → Math.*Exact hoặc kiểu rộng hơn
□ điều kiện → && / || (không & / | trừ khi cố ý)
□ instanceof pattern thay cast tay
□ ngoặc khi precedence không rõ
```

---

## Xem thêm

| File | Liên quan |
|------|-----------|
| [typesystem.md](typesystem.md) | Identity vs equals, wrapper cache |
| [statements.md](statements.md) | Switch, patterns, `yield` |
| [literals.md](literals.md) | Literal số, text block |
| [lambdas-functional.md](lambdas-functional.md) | `->` `::` |
| [oop.md](oop.md) | `equals` / `hashCode` |
| [java25.md](java25.md) | Pattern preview / LTS notes |

---

*Tham chiếu nhanh — Java 25 LTS. Precedence JLS ổn định; pattern `instanceof` từ 16; switch expression từ 14.*
