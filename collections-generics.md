# Tập hợp & Generics

*(Collection hierarchy, List/Set/Map/Deque, generics, Sequenced Collections)*

Java Collections Framework (`java.util`) là nền tảng xử lý dữ liệu in-memory. Generics (từ Java 5) mang
type-safety compile-time; erasure giữ tương thích bytecode. Tài liệu nhắm **Java 25 LTS** (Sequenced Collections
ổn định từ 21).

> Cross-link: [typesystem.md](typesystem.md) (PECS / erasure tổng quát) · [streams.md](streams.md) ·
> [oop.md](oop.md) (`equals`/`hashCode`) · [threading.md](threading.md) · [lambdas-functional.md](lambdas-functional.md) ·
> [java25.md](java25.md)

---

## Mục lục

- [1. Hierarchy Collection / Map](#1-hierarchy-collection--map)
- [2. List](#2-list)
- [3. Set](#3-set)
- [4. Deque / Queue / Stack](#4-deque--queue--stack)
- [5. Map](#5-map)
- [6. Sequenced Collections (Java 21+)](#6-sequenced-collections-java-21)
- [7. Unmodifiable vs immutable](#7-unmodifiable-vs-immutable)
- [8. Concurrent collections & fail-fast CME](#8-concurrent-collections--fail-fast-cme)
- [9. Generics](#9-generics)
- [10. Duyệt & tiện ích](#10-duyệt--tiện-ích)
- [11. Cheat sheet chọn cấu trúc](#11-cheat-sheet-chọn-cấu-trúc)
- [12. Pitfalls (Bẫy)](#12-pitfalls-bẫy)
- [13. Best practices](#13-best-practices)
- [Xem thêm](#xem-thêm)

---

## 1. Hierarchy Collection / Map

```
Iterable<E>
└─ Collection<E>
   ├─ List<E>              // có thứ tự, cho phép trùng
   │  └─ SequencedCollection (Java 21) — cũng trên Set/Deque phù hợp
   ├─ Set<E>               // không trùng (theo equals/hashCode hoặc compare)
   │  └─ SortedSet / NavigableSet
   └─ Queue<E>
      └─ Deque<E>          // hai đầu

Map<K,V>                   // KHÔNG là Collection
├─ SortedMap / NavigableMap
└─ SequencedMap (Java 21)
```

**Nguyên tắc API**:

- Expose kiểu **tối thiểu** cần thiết (`List` thay vì `ArrayList` khi đủ).
- Duyệt: `for-each`, iterator, Stream.
- Prefer `isEmpty()` hơn `size() == 0`; dùng `Optional` / `getOrDefault` thay vì bắt NPE.

```java
Collection<String> names = List.of("a", "b");
for (String n : names) { /* ... */ }
```

---

## 2. List

Đặc trưng: **index**, thứ tự chèn, cho phép phần tử trùng / `null` (tùy impl).

### 2.1 `ArrayList`

- Mảng động, bộ nhớ tiếp giáp → random access **O(1)**, append amortized **O(1)**.
- Insert/remove giữa list: **O(n)** (dồn phần tử).
- Không đồng bộ; multi-thread → external sync hoặc `CopyOnWriteArrayList` / concurrent structures.

```java
var list = new ArrayList<String>(128); // capacity gợi ý
list.add("x");
list.addAll(List.of("a", "b"));
list.ensureCapacity(1_000);
list.sort(Comparator.naturalOrder());
int i = Collections.binarySearch(list, "a"); // list phải đã sort
```

**Mẹo**: biết trước kích thước → set capacity để giảm realloc.

### 2.2 `LinkedList`

- Doubly-linked: add/remove **O(1)** khi đã có node/`ListIterator` đúng vị trí.
- Random access **O(n)** — thường **chậm hơn** `ArrayList` trong thực tế (cache locality).
- Implement cả `Deque` — dùng khi cần queue/deque + list API; với list thuần thường chọn `ArrayList`.

```java
LinkedList<Integer> ll = new LinkedList<>();
ll.addLast(2);
ll.addFirst(1);
ll.removeFirst();
```

---

## 3. Set

Không chứa phần tử trùng theo hợp đồng equality của set.

| Impl | Thứ tự | null | Ghi chú |
|------|--------|------|---------|
| `HashSet` | Không đảm bảo | 1 null | Dựa `HashMap` |
| `LinkedHashSet` | Insertion order | 1 null | Duyệt ổn định |
| `TreeSet` | Sorted (`Comparable`/`Comparator`) | Không (thường) | `NavigableSet` |
| `EnumSet` | Enum ordinal | Không | Bit vector — cực nhanh |
| `CopyOnWriteArraySet` | Insertion | Có | Ít ghi, nhiều đọc |

```java
Set<String> tags = new HashSet<>();
tags.add("java");
tags.add("java"); // false — không thêm trùng

NavigableSet<Integer> sorted = new TreeSet<>(List.of(3, 1, 2));
sorted.floor(2);   // 2
sorted.higher(2);  // 3
```

---

## 4. Deque / Queue / Stack

```java
Deque<String> dq = new ArrayDeque<>(); // thường prefer hơn Stack/LinkedList
dq.addLast("a");   // queue offer
dq.addFirst("z");  // stack push
String first = dq.removeFirst();
String last  = dq.removeLast();
```

- **`ArrayDeque`**: vòng mảng — nhanh, không chấp nhận `null`.
- **`PriorityQueue`**: heap theo comparator — **không** FIFO; peek = phần tử nhỏ nhất (mặc định).
- Class `Stack` là legacy — dùng `Deque` (`push`/`pop` = `addFirst`/`removeFirst`).
- Concurrent: `ConcurrentLinkedQueue`, `LinkedBlockingQueue`, `ArrayBlockingQueue`, `DelayQueue`…

```java
Queue<Integer> pq = new PriorityQueue<>();
pq.offer(5);
pq.offer(1);
pq.poll(); // 1
```

---

## 5. Map

### 5.1 `HashMap`

- Hash table + treeify bucket (Java 8+) khi va chạm nhiều.
- **Không** thread-safe; cho phép 1 `null` key, nhiều `null` value.
- Average **O(1)** get/put; worst degenerate hiếm nếu hash tốt.

```java
Map<String, Integer> scores = new HashMap<>();
scores.put("alice", 10);
scores.putIfAbsent("bob", 0);
scores.merge("alice", 5, Integer::sum);          // 15
scores.computeIfAbsent("carol", k -> 1);
int v = scores.getOrDefault("dave", -1);

for (var e : scores.entrySet()) {
    System.out.println(e.getKey() + "=" + e.getValue());
}
```

### 5.2 `ConcurrentHashMap`

- Thread-safe, **không** khóa toàn map cho hầu hết operations.
- **Không** cho `null` key/value.
- Aggregate ops: `forEach`, `reduce`, `search` (parallelism threshold).

```java
ConcurrentHashMap<String, LongAdder> hits = new ConcurrentHashMap<>();
hits.computeIfAbsent("home", k -> new LongAdder()).increment();

hits.putIfAbsent("about", new LongAdder());
// atomic update patterns — tránh get-modify-put rời rạc
```

> Đừng iterate + remove bằng cách thông thường không an toàn; dùng `Iterator.remove`, `entrySet().removeIf`, hoặc concurrent methods.

### 5.3 Các Map khác

| Impl | Đặc điểm |
|------|----------|
| `LinkedHashMap` | Insertion / access order (có thể LRU với `removeEldestEntry`) |
| `TreeMap` | Sorted keys — `NavigableMap` |
| `EnumMap` | Key = enum — array-backed |
| `WeakHashMap` | Entry thu hồi khi key chỉ còn weak ref — cache cẩn thận |
| `IdentityHashMap` | So sánh `==` không phải `equals` |

---

## 6. Sequenced Collections (Java 21+)

Thêm khái niệm **thứ tự gặp phải (encounter order)** thống nhất:

```
SequencedCollection<E>  ⊂ Collection
SequencedSet<E>         ⊂ Set & SequencedCollection
SequencedMap<K,V>       ⊂ Map
```

API mới tiêu biểu:

```java
List<String> list = new ArrayList<>(List.of("a", "b", "c"));
list.getFirst();          // "a"
list.getLast();           // "c"
list.addFirst("z");
list.addLast("d");
list.removeFirst();
List<String> revView = list.reversed(); // view đảo — Java 21+

SequencedMap<String, Integer> map = new LinkedHashMap<>();
map.putFirst("x", 1);
map.putLast("y", 2);
map.pollFirstEntry();
```

- `ArrayList`, `LinkedList`, `LinkedHashSet`, `TreeSet`, `LinkedHashMap`, `TreeMap`… implement các sequenced interfaces phù hợp.
- `reversed()` thường là **view** — sửa view ảnh hưởng nguồn (tùy impl).

---

## 7. Unmodifiable vs immutable

```java
List<String> list = List.of("a", "b");           // không null, structural immutable
Set<Integer> set  = Set.of(1, 2, 3);             // không trùng, không null
Map<String, Integer> map = Map.of("a", 1, "b", 2);
Map<String, Integer> map2 = Map.ofEntries(
        Map.entry("a", 1),
        Map.entry("b", 2)
);

List<String> copy = List.copyOf(someCollection); // copy unmodifiable độc lập
var um = Collections.unmodifiableList(mutable);  // view — nguồn đổi thì view đổi
```

| Khái niệm | Ý nghĩa | API điển hình |
|-----------|---------|---------------|
| **Unmodifiable view** | Wrapper chặn `add`/`remove`; **không** copy — nguồn mutable vẫn đổi nội dung nhìn thấy qua view | `Collections.unmodifiableList` |
| **Unmodifiable copy** | Snapshot cấu trúc; sửa nguồn gốc không ảnh hưởng bản copy | `List.copyOf`, `Set.copyOf`, `Map.copyOf` |
| **Structural immutable** | Không thao tác cấu trúc; phần tử nếu mutable vẫn đổi được state | `List.of` / `Set.of` / `Map.of` |
| **Deep immutable** | Cả cấu trúc lẫn phần tử không đổi — **không** có sẵn trong JCF; tự thiết kế (record + immutable elems) | — |

```java
List<StringBuilder> of = List.of(new StringBuilder("a"));
of.get(0).append("!"); // OK — list không cho add, nhưng elem mutable
// of.add(...); → UnsupportedOperationException

List<String> src = new ArrayList<>(List.of("x"));
List<String> view = Collections.unmodifiableList(src);
src.add("y");
view.size(); // 2 — view thấy thay đổi nguồn
```

- `List.of` / `Set.of` / `Map.of`: không `null`; `Set.of` trùng phần tử → `IllegalArgumentException`.
- `Collections.emptyList()` / `singletonList` / `nCopies` — cố định kích thước theo hợp đồng từng API.
- Trả collection ra ngoài API: prefer `List.copyOf` / `Map.copyOf` hơn expose field mutable hoặc chỉ unmodifiable view nếu nguồn vẫn giữ quyền ghi.

```java
Collections.emptyList();
Collections.singletonList(x);
Collections.nCopies(3, "x");
```

---

## 8. Concurrent collections & fail-fast CME

### 8.1 Fail-fast & `ConcurrentModificationException`

Iterator của `ArrayList` / `HashMap` / … là **fail-fast**: nếu cấu trúc collection bị sửa ngoài iterator (add/remove từ cùng thread hoặc thread khác) trong lúc duyệt → có thể ném `ConcurrentModificationException` (best-effort, không phải lock).

```java
List<String> list = new ArrayList<>(List.of("a", "b", "c"));

// Sai — CME (thường)
for (String s : list) {
    if (s.equals("b")) list.remove(s);
}

// Đúng — Iterator.remove
for (var it = list.iterator(); it.hasNext(); ) {
    if (it.next().equals("b")) it.remove();
}

list.removeIf(s -> s.equals("b")); // API an toàn
```

| Cách | An toàn khi duyệt + xóa? |
|------|--------------------------|
| Enhanced-for + `list.remove` | Không (CME) |
| `Iterator.remove` | Có (cùng iterator) |
| `removeIf` / `entrySet().removeIf` | Có |
| Index loop `for (i…)` + `remove(i)` | Cẩn thận index lệch; được phép nhưng dễ bug |
| Concurrent collection iterator | weakly consistent — **không** CME vì structural mod thông thường |

### 8.2 Concurrent collections (tóm tắt)

| Loại | Class | Ghi chú |
|------|-------|---------|
| Map | `ConcurrentHashMap` | Không `null`; atomic `compute*` / `merge`; không khóa toàn map cho hầu hết ops |
| Queue | `ConcurrentLinkedQueue` | Non-blocking |
| Blocking queue | `LinkedBlockingQueue`, `ArrayBlockingQueue`, `DelayQueue` | Producer/consumer |
| List (COW) | `CopyOnWriteArrayList` | Nhiều đọc, ít ghi — ghi copy toàn mảng |
| Set (COW) | `CopyOnWriteArraySet` | Tương tự |
| Legacy sync wrapper | `Collections.synchronizedMap` | Vẫn cần sync khi **iterate** |

```java
ConcurrentHashMap<String, LongAdder> hits = new ConcurrentHashMap<>();
hits.computeIfAbsent("home", k -> new LongAdder()).increment();
// tránh get → modify → put rời rạc

CopyOnWriteArrayList<String> listeners = new CopyOnWriteArrayList<>();
listeners.add("a");
for (String s : listeners) { /* snapshot iterator — không CME khi add song song */ }
```

- `synchronizedMap`: `for (var e : map.entrySet())` vẫn cần `synchronized (map) { … }` khi iterate.
- Chi tiết threading: [threading.md](threading.md). `ConcurrentHashMap` đã nêu ở §5.2.

---

## 9. Generics

### 9.1 Type parameters & bounds

```java
public class Box<T> {
    private T value;
    public void set(T value) { this.value = value; }
    public T get() { return value; }
}

public class NumberBox<T extends Number> {
    public double doubleValue(T n) { return n.doubleValue(); }
}

public static <T extends Comparable<? super T>> T max(Collection<? extends T> coll) {
    return coll.stream().max(Comparator.naturalOrder()).orElseThrow();
}
```

- Bound: `T extends Type` (upper); nhiều bound: `T extends A & B` (class trước interface).
- Không primitive type args — dùng wrapper (`List<Integer>`).

### 9.2 Wildcards & PECS (collections-focused)

**PECS**: *Producer Extends, Consumer Super*. Lý thuyết kiểu: [typesystem.md §9.1](typesystem.md#91-pecs--wildcards). Dưới đây là ví dụ **API collection**.

```java
// Producer: đọc ra — ? extends
void printAll(List<? extends Number> nums) {
    for (Number n : nums) {
        System.out.println(n);
    }
    // nums.add(1); // illegal
}

// Consumer: ghi vào — ? super
void addInts(List<? super Integer> dest) {
    dest.add(1);
    dest.add(2);
    // Integer x = dest.get(0); // chỉ chắc Object
}

// Copy — JDK làm tương tự Collections.copy
public static <T> void copy(List<? super T> dest, List<? extends T> src) {
    for (T t : src) {
        dest.add(t);
    }
}

List<Integer> ints = List.of(1, 2);
printAll(ints);
addInts(new ArrayList<Number>());
addInts(new ArrayList<Object>());
copy(new ArrayList<Number>(), ints);
```

| API nhận | Wildcard | Lý do |
|----------|----------|-------|
| Chỉ đọc phần tử | `Collection<? extends E>` / `List<? extends E>` | Chấp nhận `List<Integer>` khi cần `Number` |
| Chỉ ghi phần tử | `Collection<? super E>` | Chấp nhận `List<Object>` khi add `Integer` |
| Đọc + ghi cùng kiểu | `Collection<E>` / `List<E>` | Không wildcard |
| Không quan tâm kiểu | `List<?>` | Gần như chỉ `size` / `clear` / đọc `Object` |

```java
// Capture helper — “bắt” wildcard khi cần generic method
static void swapFirstTwo(List<?> list) {
    swapHelper(list);
}
private static <T> void swapHelper(List<T> list) {
    T tmp = list.get(0);
    list.set(0, list.get(1));
    list.set(1, tmp);
}
```

- `?` unbounded: đọc như `Object`; ghi gần như không (trừ `null`).
- Đừng dùng wildcard ở return type public trừ khi cố ý — caller khó dùng.

### 9.3 Erasure

```java
List<String> a = new ArrayList<>();
List<Integer> b = new ArrayList<>();
// a.getClass() == b.getClass() → true

@SuppressWarnings("unchecked")
List raw = a; // raw type — tránh
```

- Không `new T()`, không `new T[]` trực tiếp.
- Không overload chỉ khác type param.
- Bridge methods: [methods.md](methods.md).
- `instanceof List<String>` illegal — chỉ `instanceof List<?>`.

### 9.4 Diamond & `var` caveats

```java
List<String> list = new ArrayList<>();     // diamond <>
var list2 = new ArrayList<String>();       // OK
var list3 = new ArrayList<>();             // ArrayList<Object> — thường sai ý!
```

---

## 10. Duyệt & tiện ích

```java
List<String> list = new ArrayList<>(List.of("a", "b", "c"));

for (var it = list.iterator(); it.hasNext(); ) {
    if (it.next().equals("b")) it.remove();
}

list.removeIf(s -> s.startsWith("a"));
list.replaceAll(String::toUpperCase);
list.sort(String.CASE_INSENSITIVE_ORDER);

Collections.shuffle(list);
Collections.binarySearch(list, "B", String.CASE_INSENSITIVE_ORDER);
```

- `Arrays.asList(...)`: **fixed-size** (backed by array) — `set` OK, `add` không.
- `subList`: **view** — structural change nguồn có thể invalidate.
- Stream: [streams.md](streams.md).

---

## 11. Cheat sheet chọn cấu trúc

| Nhu cầu | Chọn |
|---------|------|
| List random access, append | `ArrayList` |
| Queue / stack đơn giản | `ArrayDeque` |
| Unique, lookup nhanh | `HashSet` / `HashMap` |
| Unique + insertion order | `LinkedHashSet` / `LinkedHashMap` |
| Sorted | `TreeSet` / `TreeMap` |
| Concurrent map | `ConcurrentHashMap` |
| Concurrent queue | `ConcurrentLinkedQueue` / blocking queues |
| Enum keys/elements | `EnumMap` / `EnumSet` |
| Immutable snapshot | `List.of` / `Map.copyOf` |

---

## 12. Pitfalls (Bẫy)

1. **Mutable key / phần tử trong `HashMap`/`HashSet`** — đổi field tham gia `equals`/`hashCode` sau khi insert → mất entry / trùng ảo.
2. **Identity vs equals** — `IdentityHashMap` dùng `==`; `HashMap` dùng `equals`/`hashCode` — [oop.md](oop.md) · [typesystem.md](typesystem.md).
3. **`compareTo` lệch `equals`** — `TreeMap`/`TreeSet` ordering ≠ hash equality → hành vi “trùng” khác nhau.
4. **Unmodifiable view tưởng immutable** — nguồn vẫn đổi; elem mutable vẫn đổi.
5. **CME khi for-each + remove** — dùng `Iterator.remove` / `removeIf`.
6. **`synchronizedMap` iterate không sync** — race / CME.
7. **`var` + `new ArrayList<>()`** → `ArrayList<Object>`.
8. **`Arrays.asList` + `add`** → `UnsupportedOperationException`.
9. **`null` key trên `ConcurrentHashMap` / `Hashtable`** — NPE; `HashMap` cho 1 null key.
10. **Lộ collection mutable nội bộ** — caller `clear()` phá invariant — trả `copyOf`.

```java
record BadKey(StringBuilder id) { // mutable component — nguy hiểm làm key
    @Override public boolean equals(Object o) { /* id content */ }
    @Override public int hashCode() { return id.toString().hashCode(); }
}
```

---

## 13. Best practices

- Program to interfaces: `List`, `Map`, `SequencedCollection`.
- Đừng lộ collection mutable nội bộ — `List.copyOf` / unmodifiable khi phù hợp.
- Override đúng `equals`/`hashCode` cho phần tử / key hash structures.
- `Comparable` **consistent với equals** nếu dùng sorted + hash cùng domain.
- Tránh raw types; bật lint unchecked.
- Multi-thread: concurrent collections + atomic API; đừng “hy vọng” sync wrapper đủ.
- Đo trước khi thay `ArrayList` bằng `LinkedList` — locality thường thắng big-O lý thuyết.
- PECS ở tham số API; tránh wildcard return trừ khi cần.

```text
□ key bất biến (hoặc không mutate sau put)
□ copyOf / of khi publish API
□ removeIf / Iterator.remove — không for-each remove
□ ConcurrentHashMap: compute/merge, không null
□ PECS: extends đọc, super ghi
```

---

## Xem thêm

| File | Liên quan |
|------|-----------|
| [typesystem.md](typesystem.md) | PECS, erasure, `==`/`equals` |
| [oop.md](oop.md) | `equals` / `hashCode` / `Comparable` |
| [streams.md](streams.md) | Pipeline trên collection |
| [threading.md](threading.md) | Concurrent access |
| [lambdas-functional.md](lambdas-functional.md) | `removeIf`, `Comparator` |
| [methods.md](methods.md) | Generic methods, bridges |

---

*Java 25 LTS — Sequenced Collections ổn định từ 21; generics erasure không đổi.*
