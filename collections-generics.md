# Tập hợp & Generics  

*(Collection hierarchy, List/Set/Map/Deque, generics, Sequenced Collections)*

Java Collections Framework (`java.util`) là nền tảng xử lý dữ liệu in-memory. Generics (từ Java 5) mang type-safety compile-time; erasure giữ tương thích bytecode.

---

## Mục lục

- [Tập hợp \& Generics](#tập-hợp--generics)
  - [Mục lục](#mục-lục)
  - [1. Hierarchy Collection / Map](#1-hierarchy-collection--map)
  - [2. List](#2-list)
    - [2.1 `ArrayList`](#21-arraylist)
    - [2.2 `LinkedList`](#22-linkedlist)
  - [3. Set](#3-set)
  - [4. Deque / Queue / Stack](#4-deque--queue--stack)
  - [5. Map](#5-map)
    - [5.1 `HashMap`](#51-hashmap)
    - [5.2 `ConcurrentHashMap`](#52-concurrenthashmap)
    - [5.3 Các Map khác](#53-các-map-khác)
  - [6. Sequenced Collections (Java 21+)](#6-sequenced-collections-java-21)
  - [7. Unmodifiable factories](#7-unmodifiable-factories)
  - [8. Generics](#8-generics)
    - [8.1 Type parameters \& bounds](#81-type-parameters--bounds)
    - [8.2 Wildcards \& PECS](#82-wildcards--pecs)
    - [8.3 Erasure](#83-erasure)
    - [8.4 Diamond \& `var` caveats](#84-diamond--var-caveats)
  - [9. Duyệt \& tiện ích](#9-duyệt--tiện-ích)
  - [10. Cheat sheet chọn cấu trúc](#10-cheat-sheet-chọn-cấu-trúc)
  - [11. Best practices](#11-best-practices)

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

## 7. Unmodifiable factories

```java
List<String> list = List.of("a", "b");           // không null, immutable
Set<Integer> set  = Set.of(1, 2, 3);             // không trùng, không null
Map<String, Integer> map = Map.of("a", 1, "b", 2);
Map<String, Integer> map2 = Map.ofEntries(
        Map.entry("a", 1),
        Map.entry("b", 2)
);

List<String> copy = List.copyOf(someCollection); // copy unmodifiable
var um = Collections.unmodifiableList(mutable);  // view — nguồn đổi thì view đổi
```

- `List.of` / `Set.of` / `Map.of`: **structural immutable** — `add`/`put` → `UnsupportedOperationException`.
- Không chấp nhận `null` (NPE).
- `Set.of` với phần tử trùng → `IllegalArgumentException`.
- Khác `Collections.unmodifiableX`: factory tạo bản độc lập (copyOf) hoặc compact immutable; unmodifiable\* thường là wrapper.

```java
Collections.emptyList();
Collections.singletonList(x);
Collections.nCopies(3, "x"); // list cố định kích thước, phần tử giống nhau
```

---

## 8. Generics

### 8.1 Type parameters & bounds

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

- Bound: `T extends Type` (upper), nhiều bound: `T extends A & B` (class đứng trước interface).
- Generic methods: `<T>` trước return type.
- Không có primitive type args — dùng wrapper (`List<Integer>`). (Preview primitive patterns / valhalla là hướng khác, không thay generics erasure hiện tại.)

### 8.2 Wildcards & PECS

**PECS**: *Producer Extends, Consumer Super*.

```java
// Producer: đọc ra — ? extends
void printAll(List<? extends Number> nums) {
    for (Number n : nums) {
        System.out.println(n);
    }
    // nums.add(1); // illegal — không biết subtype cụ thể
}

// Consumer: ghi vào — ? super
void addInts(List<? super Integer> dest) {
    dest.add(1);
    dest.add(2);
    // Integer x = dest.get(0); // chỉ chắc Object
}

List<Integer> ints = List.of(1, 2);
printAll(ints);           // List<Integer> ⊂ List<? extends Number>
addInts(new ArrayList<Number>());
addInts(new ArrayList<Object>());
```

- `?` unbounded: chỉ an toàn như `Object` khi đọc; ghi gần như không.
- Capture helper: đôi khi cần method generic riêng để “bắt” wildcard.

### 8.3 Erasure

```java
List<String> a = new ArrayList<>();
List<Integer> b = new ArrayList<>();
// a.getClass() == b.getClass()  → true (cùng ArrayList)

@SuppressWarnings("unchecked")
List raw = a; // raw type — tránh
```

Hệ quả:

- Không `new T()`, không `new T[]` trực tiếp (workaround: `Array.newInstance`, reflection, hoặc truyền `Class<T>` / factory).
- Không overloading chỉ khác type param (`void m(List<String>)` vs `void m(List<Integer>)`).
- Runtime checks dùng bridge methods / casts do compiler chèn.
- `instanceof List<String>` **không** hợp lệ — chỉ `instanceof List<?>`.

### 8.4 Diamond & `var` caveats

```java
List<String> list = new ArrayList<>();     // diamond <>
var list2 = new ArrayList<String>();       // OK — rõ ràng
var list3 = new ArrayList<>();             // suy ra ArrayList<Object> — thường KHÔNG mong muốn!
var map = new HashMap<String, List<Integer>>(); // OK
```

- Diamond (`<>`): suy type từ **target type** bên trái.
- `var` + diamond không có target → dễ ra `Object`; hãy chỉ định type args hoặc tránh `var` lúc đó.
- Anonymous class: historically hạn chế diamond; các bản Java hiện đại đã cải thiện nhưng vẫn cẩn thận với phức tạp.

---

## 9. Duyệt & tiện ích

```java
List<String> list = new ArrayList<>(List.of("a", "b", "c"));

// fail-fast iterator — ConcurrentModificationException nếu cấu trúc đổi ngoài iterator
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
- Stream: xem [streams.md](streams.md).

---

## 10. Cheat sheet chọn cấu trúc

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

## 11. Best practices

- Program to interfaces: `List`, `Map`, `SequencedCollection`.
- Đừng lộ collection mutable nội bộ — trả `List.copyOf` hoặc unmodifiable view.
- Override đúng `equals`/`hashCode` cho phần tử/`key` dùng trong hash structures.
- `Comparable` phải **consistent với equals** nếu dùng trong sorted sets/maps (khuyến nghị).
- Tránh raw types; bật lint unchecked.
- Multi-thread: không “hy vọng” `Collections.synchronizedMap` đủ — cân nhắc concurrent collections + đúng atomic API.
- Đo trước khi thay `ArrayList` bằng `LinkedList` — locality thường thắng lý thuyết big-O.

---

*Java 25 LTS — Sequenced Collections ổn định từ 21; generics erasure không đổi.*
