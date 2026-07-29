# Toán tử (Operators) trong Java — Bản chi tiết hiện đại

Tài liệu tham chiếu toán tử Java theo thực hành **Java 25 LTS**: số học, quan hệ, logic, bit, gán, `instanceof`
(pattern), cast, điều kiện `?:`, lambda `->`, method reference `::`, `new`, truy cập `.` / `[]`. Không có
con trỏ/`*` `&` kiểu C. Switch **expression** dạng mũi tên được trỏ ngắn — chi tiết statement/switch xem file statements
(khi có trong bộ tài liệu).

---

## Mục lục

- [Toán tử (Operators) trong Java — Bản chi tiết hiện đại](#toán-tử-operators-trong-java--bản-chi-tiết-hiện-đại)
  - [Mục lục](#mục-lục)
  - [1. Tổng quan \& nguyên tắc](#1-tổng-quan--nguyên-tắc)
  - [2. Bảng ưu tiên (precedence)](#2-bảng-ưu-tiên-precedence)
  - [3. Số học \& `%`](#3-số-học--)
  - [4. `++` / `--`](#4----)
  - [5. Quan hệ \& bằng](#5-quan-hệ--bằng)
  - [6. Logic \& short-circuit](#6-logic--short-circuit)
  - [7. Bitwise \& dịch bit](#7-bitwise--dịch-bit)
  - [8. Gán \& compound assignment](#8-gán--compound-assignment)
  - [9. `instanceof` \& cast](#9-instanceof--cast)
  - [10. Điều kiện `?:`](#10-điều-kiện-)
  - [11. `->` (lambda) \& `::` (method reference)](#11---lambda---method-reference)
  - [12. `new`, `.`, `[]`](#12-new--)
  - [13. Switch expression (arrow) — pointer](#13-switch-expression-arrow--pointer)
  - [14. Không có pointer operators](#14-không-có-pointer-operators)
  - [15. Operator overload? \& best practices](#15-operator-overload--best-practices)

---

## 1. Tổng quan & nguyên tắc

- Biểu thức đánh giá theo **precedence** + **associativity**; khi nghi ngờ → dùng ngoặc.
- `&&` / `||` là **short-circuit**; `&` / `|` trên `boolean` **không** short-circuit.
- Số nguyên: tràn **hai’s complement** im lặng (không checked như C# mặc định) — dùng `Math.addExact` khi cần bắt tràn.
- So sánh object: `==` so reference (hoặc primitive value); nội dung → `equals`.
- Pattern matching biến `instanceof` / `switch` là thực hành hiện đại thay cast thủ công.

---

## 2. Bảng ưu tiên (precedence)

Từ **cao → thấp** (tóm tắt JLS):

1. **Postfix**: `expr++` `expr--` ; gọi method `()` ; truy cập mảng `[]` ; thành viên `.` ; **tạo** liên quan
2. **Unary**: `++expr` `--expr` `+` `-` `~` `!` *(phải → trái)*
3. **Cast**: `(Type) expr`
4. **Multiplicative**: `*` `/` `%`
5. **Additive**: `+` `-` (cũng nối `String`)
6. **Shift**: `<<` `>>` `>>>`
7. **Relational**: `<` `>` `<=` `>=` `instanceof`
8. **Equality**: `==` `!=`
9. **Bitwise AND**: `&`
10. **Bitwise XOR**: `^`
11. **Bitwise OR**: `|`
12. **Logical AND**: `&&`
13. **Logical OR**: `||`
14. **Ternary**: `?:` *(phải → trái)*
15. **Assignment**: `=` `+=` `-=` `*=` `/=` `%=` `&=` `|=` `^=` `<<=` `>>=` `>>>=` *(phải → trái)*
16. **Lambda**: `->` (không phải toán tử ưu tiên thông thường trong cùng biểu thức số học — có ngữ cảnh riêng)

> `::` và `new` xuất hiện trong primary/creation expressions — ưu tiên cao như thành phần primary.

---

## 3. Số học & `%`

```java
int a = 7 / 2;        // 3 — chia nguyên
double b = 7 / 2.0;   // 3.5
int r = 7 % 2;        // 1
int n = -7 % 2;       // -1 — dấu theo dividend (khác một số ngôn ngữ)
```

- `+` với `String`: nếu một toán hạng là `String`, thực hiện nối chuỗi (sau khi chuyển toán hạng kia bằng `String.valueOf`).
- `/` cho số nguyên cắt về 0; chia cho 0 → `ArithmeticException` (nguyên); `double` → `Infinity`/`NaN`.
- Exact arithmetic:

```java
int s = Math.addExact(Integer.MAX_VALUE, 1); // throws ArithmeticException
```

---

## 4. `++` / `--`

```java
int x = 1;
int a = ++x; // x=2, a=2
int b = x++; // x=3, b=2
```

- Prefix: tăng/giảm rồi trả giá trị mới.
- Postfix: trả giá trị cũ rồi tăng/giảm.
- Operand phải là biến/slot gán được (không phải biểu thức tùy ý).
- Tránh xếp nhiều `++` trong cùng biểu thức — hành vi khó đọc (vẫn xác định theo JLS nhưng không đáng).

---

## 5. Quan hệ & bằng

```java
1 < 2;  2 <= 2;  3 > 1;  3 >= 4; // false
1 == 1; 1 != 2;

String s = "a";
String t = new String("a");
s == t;       // false — khác instance
s.equals(t);  // true
Objects.equals(s, t); // null-safe
```

- `==` / `!=` trên primitives: so giá trị; trên references: so identity (trừ khi value-based discussion — vẫn `equals`).
- Floating: cẩn `NaN` — `Double.isNaN`; `==` với `NaN` luôn false.
- `Comparator` / `Comparable` cho thứ tự; không overload `<` cho object.

---

## 6. Logic & short-circuit

```java
boolean a = true;
boolean b = false;

a && b;  // false — không đánh giá thêm nếu a false
a || b;  // true  — không đánh giá thêm nếu a true
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
```

- Side-effect ở vế phải có thể **không chạy** với `&&`/`||` — đó là tính năng, đừng phụ thuộc ngược.

---

## 7. Bitwise & dịch bit

```java
int x = 0b0011_1100;
int y = 0b0000_1101;

x & y;   // AND
x | y;   // OR
x ^ y;   // XOR
~x;      // NOT (đảo bit, theo bề rộng int/long)

x << 2;  // dịch trái
x >> 2;  // dịch phải số học (giữ dấu)
x >>> 2; // dịch phải logic (lấp 0)
```

- Shift mask: khoảng dịch lấy modulo bề rộng (`int` 5 bit thấp, `long` 6 bit) — `1 << 32` ≡ `1 << 0` với `int`.
- Dùng bit flag với enum/`EnumSet` thường rõ hơn int mask thủ công.
- Không có `<<<`.

---

## 8. Gán & compound assignment

```java
int i = 5;
i += 2;   // i = (int)(i + 2) — có cast ngầm về kiểu biến trái
i <<= 1;
```

- Compound assignment thực hiện ép kiểu ngầm về kiểu LHS — khác viết tách đôi đôi khi:

```java
byte b = 1;
b += 1;       // OK
// b = b + 1; // lỗi — b+1 thành int
```

- Gán là biểu thức (trả giá trị gán) — tránh chuỗi khó đọc `a = b = c`.

---

## 9. `instanceof` & cast

```java
Object o = "Java";

if (o instanceof String s) { // pattern matching
    System.out.println(s.toUpperCase());
}

String s2 = (String) o;      // cast tường minh — ClassCastException nếu sai
Number n = 42;
int v = (Integer) n;         // unbox sau cast
```

- `null instanceof T` luôn **false** (không NPE).
- Cast primitive: narrowing/widening theo bảng JLS.
- Cast reference: lên/xuống hierarchy / tới interface được implement lúc runtime.
- Pattern `instanceof` là baseline Java hiện đại (thay if+cast).

Guarded patterns (trong `switch` / ngữ cảnh pattern) kết hợp điều kiện — xem switch expression.

---

## 10. Điều kiện `?:`

```java
int abs = x >= 0 ? x : -x;
String label = user != null ? user.name() : "anonymous";
```

- Associativity phải → trái: `a ? b : c ? d : e` ≡ `a ? b : (c ? d : e)`.
- Hai nhánh phải compatible theo quy tắc typing (numeric promotion / reference lub).
- Ưu tiên đọc được: đừng lồng ternary sâu — dùng `if` / switch expression.

---

## 11. `->` (lambda) & `::` (method reference)

Không phải toán tử số học; là cú pháp tạo instance functional interface.

```java
Function<String, Integer> len = s -> s.length();
Function<String, Integer> len2 = String::length;
Supplier<List<String>> lists = ArrayList::new;
Consumer<String> print = System.out::println;
```

Dạng method reference:

| Dạng | Ví dụ |
|---|---|
| Static | `Integer::parseInt` |
| Bound instance | `already::equals` |
| Unbound instance | `String::isBlank` |
| Constructor | `HashMap::new` |
| Array ctor | `String[]::new` |

- Target type suy từ ngữ cảnh (biến typed, tham số method, `var` hạn chế hơn).
- Lambda body expression vs block; checked exceptions phải khớp SAM.

---

## 12. `new`, `.`, `[]`

```java
var list = new ArrayList<String>();
var point = new Point(1, 2);          // record/class
var arr = new int[] {1, 2, 3};
var matrix = new int[2][3];

list.add("x");
arr[0] = 10;
char ch = "java".charAt(0);
```

- `new` cấp phát object/array trên heap (trừ tối ưu JVM).
- Anonymous class: `new Runnable() { public void run() { ... } }` — hiện đại ưu tiên lambda nếu là SAM.
- `.` truy cập thành viên; `[]` index mảng (bounds check → `ArrayIndexOutOfBoundsException`).

---

## 13. Switch expression (arrow) — pointer

Switch hiện đại vừa là **statement** vừa là **expression**; dạng mũi tên không fall-through:

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

- `->` trong switch **không** phải lambda, dù nhìn giống — là switch labeled production.
- `yield` dùng trong khối `-> { ... }` khi cần trả giá trị phức tạp.
- Chi tiết đầy đủ (exhaustiveness với sealed, pattern nested): xem `statements.md` trong bộ tài liệu.

---

## 14. Không có pointer operators

Java **không** có:

- `*` dereference, `&` address-of, `->` member qua con trỏ (C/C++)
- Số học con trỏ, `free`

Gần native:

- **FFM API** (`java.lang.foreign.MemorySegment`, …) — thay dần JNI cho nhiều case.
- `VarHandle` / `MethodHandle` — truy cập cấp thấp an toàn hơn sun.misc.Unsafe (Unsafe bị thu hẹp dần).

Reference Java là managed — gán/`==` làm việc trên identity object, không phải địa chỉ số học.

---

## 15. Operator overload? & best practices

- Java **không** cho user overload toán tử (khác C++/C#).
- `+` nối chuỗi là quy tắc ngôn ngữ, không phải overload tự định nghĩa.
- `BigInteger`/`BigDecimal`: dùng method `add`/`multiply`.

Checklist:

- Dùng `Objects.equals` / `Comparator` thay `==` trên object.
- Short-circuit để tránh NPE; đừng nhét side-effect vào vế phải “tình cờ”.
- Prefer pattern `instanceof` và switch expression thay chuỗi cast.
- Bit ops: comment ý nghĩa mask; cân nhắc `EnumSet`.
- Đo khi tối ưu: autoboxing ẩn trong `==`/`+` với wrapper dễ tạo bug cache/`null`.

```java
Integer a = 128;
Integer b = 128;
a == b; // có thể false — ngoài cache mặc định
Objects.equals(a, b); // true
```
