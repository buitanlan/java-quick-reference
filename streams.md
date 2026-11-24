# Stream API  

*(Pipeline, intermediate/terminal, Collectors, Optional, Gatherers — tương tự LINQ)*

`java.util.stream` (Java 8+) mang phong cách **declarative / functional** để xử lý chuỗi dữ liệu: filter, map, reduce, group — gần với LINQ to Objects trong C#. Tài liệu nhắm **Java 27** (Gatherers ổn định từ 24).

> Cross-link: [lambdas-functional.md](lambdas-functional.md) · [functional.md](functional.md) (DOP, pipelines) · [collections-generics.md](collections-generics.md) ·
> [threading.md](threading.md) (parallel / ForkJoin) · [async.md](async.md)

---

## Mục lục

- [Stream API](#stream-api)
  - [Mục lục](#mục-lục)
  - [1. Tư duy Stream](#1-tư-duy-stream)
  - [2. Tạo Stream](#2-tạo-stream)
  - [3. Intermediate operations](#3-intermediate-operations)
    - [3.1 `filter` / `map` / `flatMap`](#31-filter--map--flatmap)
    - [3.2 Sorting / distinct / limit / skip / peek](#32-sorting--distinct--limit--skip--peek)
  - [4. Terminal operations](#4-terminal-operations)
    - [4.1 `forEach` / `reduce` / `collect`](#41-foreach--reduce--collect)
    - [4.2 Matching \& finding](#42-matching--finding)
  - [5. Collectors](#5-collectors)
    - [5.1 Patterns nâng cao & tự viết `Collector`](#51-patterns-nâng-cao--tự-viết-collector)
  - [6. Primitive streams](#6-primitive-streams)
  - [7. Optional](#7-optional)
  - [8. Parallel streams — caveats](#8-parallel-streams--caveats)
    - [8.1 `Spliterator`, Characteristics \& hiệu năng Pipeline](#81-spliterator-characteristics--hiệu-năng-pipeline)
  - [9. Stream Gatherers (ổn định từ Java 24)](#9-stream-gatherers-ổn-định-từ-java-24)
  - [10. Pitfalls (Bẫy)](#10-pitfalls-bẫy)
  - [11. Best practices](#11-best-practices)
  - [12. Cheat sheet ↔ LINQ](#12-cheat-sheet--linq)

---

## 1. Tư duy Stream

**Pipeline** = nguồn + (0..n) **intermediate** (lazy) + **terminal** (kích hoạt).

```java
List<String> result = people.stream()          // nguồn
        .filter(p -> p.age() >= 18)            // intermediate
        .sorted(Comparator.comparing(Person::name))
        .map(Person::name)
        .distinct()
        .toList();                             // terminal (Java 16+ unmodifiable)
```

Đặc điểm:

- **Lazy**: intermediate không chạy cho đến terminal.
- **Một lần dùng**: sau terminal, stream **consumed** — không tái sử dụng.
- Không lưu trữ dữ liệu như `Collection`; là **view tính toán** trên nguồn.
- Có thể **short-circuit** (`findFirst`, `anyMatch`, `limit`…).

> Stream **không** thay collection để lưu state lâu dài; kết quả thường `collect`/`toList` về cấu trúc cụ thể.

---

## 2. Tạo Stream

```java
Stream<String> s1 = list.stream();
Stream<String> s2 = list.parallelStream();

Stream<Integer> s3 = Stream.of(1, 2, 3);
Stream<String> s4 = Stream.empty();
Stream<Integer> s5 = Stream.iterate(0, n -> n + 1).limit(10);
Stream<Double> s6 = Stream.generate(Math::random).limit(5);

IntStream range = IntStream.range(0, 10);          // 0..9
IntStream rangeClosed = IntStream.rangeClosed(1, 10);

try (Stream<String> st = Files.lines(Path.of("f.txt"))) {
    long n = st.count();
}

Stream<String> fromArr = Arrays.stream(array);
Stream.Builder<String> b = Stream.builder();
b.add("a").add("b");
Stream<String> built = b.build();
```

- `Stream.concat(a, b)` nối hai stream.
- Infinite stream (`iterate`/`generate`) **phải** có short-circuit / `limit`.

Các operations trong các bảng dưới là **những lựa chọn độc lập**. Mỗi pipeline chỉ có một terminal operation; tạo stream mới nếu muốn chạy thêm pipeline trên cùng nguồn.

---

## 3. Intermediate operations

### 3.1 `filter` / `map` / `flatMap`

```java
stream.filter(x -> x != null);

stream.map(String::toUpperCase);
stream.map(Person::age); // Stream<Integer>

// flatMap: 1→n, "dát phẳng"
Stream<String> words = lines.flatMap(line -> Arrays.stream(line.split("\\s+")));

Optional<String> opt = Optional.of("hi");
Stream<String> flattened = Stream.of(opt).flatMap(Optional::stream); // Java 9+
```

- `mapMulti` (Java 16): thay một số `flatMap` bằng consumer đẩy 0..n phần tử — giảm allocation stream trung gian (thường cần type witness khi suy kiểu không đủ):

```java
List<String> expanded = items.stream()
        .<String>mapMulti((item, consumer) -> {
            if (item != null) {
                consumer.accept(item);
                consumer.accept(item.toUpperCase(Locale.ROOT));
            }
        })
        .toList();
```
- `mapToInt` / `flatMapToInt`… → primitive streams (tránh boxing).

### 3.2 Sorting / distinct / limit / skip / peek

```java
stream.distinct(); // theo equals/hashCode
stream.sorted();
stream.sorted(Comparator.comparing(Person::age).reversed());

stream.limit(10);
stream.skip(5);
stream.takeWhile(n -> n < 100); // Java 9 — ordered, short-circuit
stream.dropWhile(n -> n < 0);

stream.peek(System.out::println); // debug — side-effect; đừng logic nghiệp vụ quan trọng
```

- `sorted` / `distinct` trên parallel + unordered có chi phí / semantics khác; `takeWhile` / `dropWhile` trên stream **unordered** (như `HashSet`) cho kết quả không xác định.
- Stateful intermediate (`sorted`, `distinct`, `limit`) có thể cần buffer.

---

## 4. Terminal operations

### 4.1 `forEach` / `reduce` / `collect`

```java
stream.forEach(System.out::println);
stream.forEachOrdered(System.out::println); // parallel: giữ encounter order

int sum = ints.reduce(0, Integer::sum);
Optional<Integer> max = ints.reduce(Integer::max);

List<String> list = stream.toList();                 // unmodifiable — Java 16+
String[] arr = stream.toArray(String[]::new);

Map<String, Person> byId = people.stream()
        .collect(Collectors.toMap(Person::id, Function.identity()));
```

**`reduce` vs `collect`**:

- `reduce`: kết hợp bất biến / associative → giá trị duy nhất.
- `collect`: mutable reduction qua `Collector` (hiệu quả hơn khi build `List`/`Map`).

```java
// 3-arg reduce (parallel-friendly nếu accumulator/combiner đúng)
int sumLen = stream.reduce(
        0,
        (acc, s) -> acc + s.length(),
        Integer::sum
);
```

### 4.2 Matching & finding

```java
boolean any = stream.anyMatch(Predicate.isEqual("x"));
boolean all = stream.allMatch(s -> !s.isBlank());
boolean none = stream.noneMatch(String::isEmpty);

Optional<String> first = stream.findFirst(); // deterministic trên ordered
Optional<String> anyEl = stream.findAny();   // parallel-friendly

long count = stream.count();
Optional<String> min = stream.min(Comparator.naturalOrder());
Optional<String> max = stream.max(Comparator.naturalOrder());
```

---

## 5. Collectors

```java
import static java.util.stream.Collectors.*;

List<String> list = stream.collect(toList());        // không bảo đảm implementation hay mutability
List<String> imm = stream.collect(toUnmodifiableList());
Set<String> set = stream.collect(toSet());
Collection<String> coll = stream.collect(toCollection(TreeSet::new));

String joined = stream.collect(joining(", ", "[", "]"));

IntSummaryStatistics stats = people.stream()
        .collect(summarizingInt(Person::age));

Map<Department, List<Person>> byDept = people.stream()
        .collect(groupingBy(Person::department));

Map<Department, Long> countByDept = people.stream()
        .collect(groupingBy(Person::department, counting()));

Map<Boolean, List<Person>> parts = people.stream()
        .collect(partitioningBy(p -> p.age() >= 18));

Map<String, Integer> nameToAge = people.stream()
        .collect(toMap(Person::name, Person::age, (a, b) -> a)); // merge fn khi trùng key

String names = people.stream()
        .collect(teeing(
                mapping(Person::name, joining(",")),
                counting(),
                (n, c) -> n + " (" + c + ")"
        )); // Java 12+
```

Downstream collectors thường gặp: `mapping`, `filtering`, `flatMapping`, `reducing`, `maxBy`, `collectingAndThen`.

`Stream.toList()` bảo đảm unmodifiable và cho phép phần tử null; `Collectors.toUnmodifiableList()` cấm null. `Collectors.toList()` không bảo đảm kiểu list/mutability — cần mutable `ArrayList` thì dùng `toCollection(ArrayList::new)`. `toMap` không có merge function ném `IllegalStateException` khi trùng key và **ném `NullPointerException` nếu value là `null`** (vì dùng `Map.merge` bên trong, dù `HashMap` cho phép null value); `toUnmodifiableMap` còn cấm cả null key/value. Tham khảo [Stream API](https://docs.oracle.com/en/java/javase/27/docs/api/java.base/java/util/stream/Stream.html) và [Collectors API](https://docs.oracle.com/en/java/javase/27/docs/api/java.base/java/util/stream/Collectors.html).

```java
Map<Dept, Optional<Person>> eldest = people.stream()
        .collect(groupingBy(Person::department, maxBy(Comparator.comparing(Person::age))));
```

### 5.1 Patterns nâng cao & tự viết `Collector`

#### `filter(...)` trước `groupingBy` vs `Collectors.filtering(...)` bên trong `groupingBy`

```java
// 1. filter trước → phòng ban không có ai >= 30 sẽ BIẾN MẤT khỏi Map
Map<Dept, List<Person>> dropEmptyDepts = people.stream()
        .filter(p -> p.age() >= 30)
        .collect(groupingBy(Person::department));

// 2. filtering bên trong (Java 9+) → GIỮ nguyên key phòng ban với value = []
Map<Dept, List<Person>> keepEmptyDepts = people.stream()
        .collect(groupingBy(Person::department,
                filtering(p -> p.age() >= 30, toList())));
```

#### `teeing` (Java 12+) — hai phép gộp trong đúng **một lượt duyệt**

```java
record MinMax(int min, int max) {}
MinMax range = numbers.stream().collect(teeing(
        minBy(Integer::compareTo),
        maxBy(Integer::compareTo),
        (lo, hi) -> new MinMax(lo.orElseThrow(), hi.orElseThrow())
));
```

#### Tự viết `Collector` (`Collector.of`)

Một `Collector<T, A, R>` gồm 4 hàm + `Characteristics`:
- **`supplier`** (`() -> A`): tạo container tích lũy rỗng (mỗi partition song song có container riêng nếu không đánh dấu `CONCURRENT`).
- **`accumulator`** (`(A, T) -> void`): nạp 1 phần tử vào container.
- **`combiner`** (`(A, A) -> A`): gộp 2 container khi chạy parallel.
- **`finisher`** (`A -> R`): chuyển container sang kết quả cuối (bỏ qua được nếu gắn `Characteristics.IDENTITY_FINISH`).

```java
// Collector tạo Map unmodifiable bảo toàn thứ tự chèn (LinkedHashMap)
static <T, K, V> Collector<T, ?, Map<K, V>> toOrderedMap(
        Function<T, K> keyFn, Function<T, V> valFn) {
    return Collector.of(
            LinkedHashMap<K, V>::new,
            (map, item) -> map.put(keyFn.apply(item), valFn.apply(item)),
            (left, right) -> { left.putAll(right); return left; },
            Collections::unmodifiableMap
    );
}
```

---

## 6. Primitive streams

`IntStream`, `LongStream`, `DoubleStream` — tránh boxing:

```java
int sum = IntStream.rangeClosed(1, 100).sum();
OptionalDouble avg = people.stream().mapToInt(Person::age).average();
IntStream codes = str.chars(); // code points: str.codePoints()

Stream<Integer> boxed = IntStream.range(0, 3).boxed();
int[] arr = IntStream.of(1, 2, 3).toArray();
```

Special terminals: `sum`, `average`, `summaryStatistics`, `max`, `min`.

---

## 7. Optional

Container **có-hoặc-không** giá trị — tránh trả `null` từ API tìm kiếm.

```java
Optional<User> user = repo.findById(id);

String name = user.map(User::name)
        .filter(n -> !n.isBlank())
        .orElse("anonymous");

user.ifPresent(System.out::println);
user.ifPresentOrElse(System.out::println, () -> System.out.println("missing"));

User u = user.orElseThrow(() -> new NotFoundException(id));
Optional<User> alt = user.or(() -> repo.findDefault());

Stream<User> st = user.stream(); // 0 hoặc 1 phần tử
```

**Không** dùng Optional cho:

- Field bắt buộc trong entity hiệu năng cao (tranh luận — thường `Optional` cho **return type**).
- Tham số method thông thường (overload / nullable rõ ràng hơn).
- Collections — dùng empty collection thay `Optional<List>`.

```java
// Tránh
optional.get(); // chỉ khi isPresent đã kiểm — prefer orElseThrow

// Pattern tốt với stream
people.stream()
      .map(Person::email)
      .flatMap(Optional::stream)
      .forEach(this::send);
```

---

## 8. Parallel streams — caveats

```java
long count = list.parallelStream()
        .filter(this::expensive)
        .count();
```

Trên HotSpot/OpenJDK, parallel stream thường dùng **ForkJoinPool.commonPool()** và thread gọi terminal; Stream API không cung cấp tham số executor và không bảo đảm pool cụ thể. Chạy terminal trong custom `ForkJoinPool` là hành vi implementation cần kiểm chứng nếu dựa vào nó.

**Khi hợp lý**:

- CPU-bound, đủ dữ liệu lớn, operations độc lập, associative reduction.
- Nguồn dễ split (`ArrayList`, arrays, ranges) hơn `LinkedList` / `I/O` stream.

**Cảnh báo**:

- Side-effects / shared mutable state → race (xem [threading.md](threading.md)).
- `forEach` + non-concurrent collection không an toàn; dùng concurrent collector hoặc serial.
- Encounter order: một số ops bỏ order để nhanh (`forEach` vs `forEachOrdered`).
- I/O blocking trên parallel stream **không** scale tốt như virtual threads.
- Overhead: dataset nhỏ thường **chậm hơn** sequential.
- `findAny` vs `findFirst`; unordered source có thể tối ưu hơn.

```java
// Concurrent collector: cho phép tích lũy đồng thời khi characteristics phù hợp
Map<String, Long> freq = words.parallelStream()
        .collect(groupingByConcurrent(Function.identity(), counting()));
```

Collector **không cần** `CONCURRENT` để dùng an toàn trên parallel stream: collector thường như `toList()` dùng container riêng cho từng partition rồi combine. Nguy hiểm là tự thêm vào **một shared ArrayList** trong `forEach`, không phải mọi mutable reduction.

### 8.1 `Spliterator`, Characteristics & hiệu năng Pipeline

Pipeline Stream chạy theo cơ chế **pull/push hợp nhất (loop fusion)**: các toán tử stateless (`filter`, `map`, `flatMap`) được chạy nối tiếp trên từng phần tử mà **không** tạo danh sách trung gian; chỉ các toán tử stateful (`sorted`, `distinct`, `limit`) mới phải lập rào chắn/buffer.

| Characteristic của `Spliterator` | Ý nghĩa & tối ưu JVM |
|---|---|
| `SIZED` / `SUBSIZED` | Biết chính xác kích thước (kể cả sau khi tách) → `toArray`/`toList` cấp phát đúng cỡ, `count()` có thể trả O(1) bỏ qua bước trung gian không đổi kích thước! |
| `ORDERED` | Giữ encounter order (`List`, mảng) — `limit`/`skip`/`findFirst` trên parallel phải đồng bộ order (tốn kém); gọi `.unordered()` nếu không cần thứ tự |
| `SORTED` / `DISTINCT` | Nguồn đã sort (`TreeSet`) / đã unique (`Set`) → `.sorted()` / `.distinct()` có thể thành no-op |

- **Chất lượng tách (`trySplit`) cho parallel stream:**
  - **Xuất sắc (O(1) chia đôi cân bằng):** `ArrayList`, mảng, `IntStream.range`.
  - **Khá:** `HashSet`, `TreeSet`, `ConcurrentHashMap`.
  - **Kém (tách tuần tự O(n)):** `LinkedList`, `Stream.iterate`, `BufferedReader.lines()`, `Files.lines()` → chạy `parallel()` thường **chậm hơn** sequential.
- **Khi vòng `for` thường thắng `Stream`:** hot loop siêu nhỏ trên mảng nguyên thủy (giảm overhead tạo pipeline/lambda), cần `break` kèm nhiều biến trạng thái cục bộ phức tạp, hoặc cần xử lý checked exception trực tiếp.

---

## 9. Stream Gatherers (ổn định từ Java 24)

**Gatherers** (`java.util.stream.Gatherer`, Java 24 final — có trong 25 LTS) = intermediate operations **tùy biến**, đối xứng với `Collector` ở phía terminal.

```java
import java.util.stream.Gatherers;

// Window cố định — ví dụ API chuẩn
List<List<Integer>> windows = IntStream.rangeClosed(1, 6)
        .boxed()
        .gather(Gatherers.windowFixed(3))
        .toList();
// [[1,2,3], [4,5,6]]

List<List<Integer>> sliding = IntStream.rangeClosed(1, 5)
        .boxed()
        .gather(Gatherers.windowSliding(3))
        .toList();
// [[1,2,3], [2,3,4], [3,4,5]]

// fold (chỉ phát kết quả cuối) vs scan (phát từng bước tích lũy)
var folded = Stream.of(1, 2, 3, 4)
        .gather(Gatherers.fold(() -> 0, Integer::sum))
        .findFirst(); // Optional[10]

List<Integer> runningSum = Stream.of(1, 2, 3, 4)
        .gather(Gatherers.scan(() -> 0, Integer::sum))
        .toList(); // [1, 3, 6, 10]

// mapConcurrent: chạy mapper song song trên virtual threads (tối đa maxConcurrency), giữ đúng encounter order
List<String> bodies = urls.stream()
        .gather(Gatherers.mapConcurrent(8, this::fetchBlocking))
        .toList();
```

Tự viết gatherer khi cần stateful intermediate phức tạp (distinct theo key, debouncing, custom batching) mà không muốn thu thập hết rồi xử lý:

```java
static <T, K> Gatherer<T, Set<K>, T> distinctBy(Function<T, K> keyExtractor) {
    return Gatherer.ofSequential(
            HashSet::new,
            Gatherer.Integrator.ofGreedy((seen, elem, downstream) ->
                    !seen.add(keyExtractor.apply(elem)) || downstream.push(elem))
    );
}

// Gatherer có finisher (xả phần dư cuối stream) & hỗ trợ short-circuit (không ofGreedy):
static <T> Gatherer<T, List<T>, List<T>> batchWhile(int maxSize, Predicate<T> stopBefore) {
    return Gatherer.ofSequential(
            ArrayList::new,
            (buf, elem, downstream) -> {
                if (stopBefore.test(elem) && !buf.isEmpty()) {
                    var flushed = List.copyOf(buf);
                    buf.clear();
                    if (!downstream.push(flushed)) return false; // tôn trọng short-circuit của downstream
                }
                buf.add(elem);
                if (buf.size() == maxSize) {
                    var flushed = List.copyOf(buf);
                    buf.clear();
                    return downstream.push(flushed);
                }
                return true;
            },
            (buf, downstream) -> {
                if (!buf.isEmpty() && !downstream.isRejecting()) {
                    downstream.push(List.copyOf(buf));
                }
            }
    );
}

// Ghép nhiều Gatherer bằng andThen:
Gatherer<Integer, ?, List<Integer>> pipe =
        Gatherers.<Integer>scan(() -> 0, Integer::sum).andThen(Gatherers.windowFixed(2));
```

- **4 thành phần của `Gatherer<T, A, R>`:** `initializer` (tạo state `A`), `integrator` (nhận từng phần tử, đẩy `0..n` kết quả vào `downstream.push(...)`, trả `false` để dừng sớm — đánh dấu `ofGreedy` nếu bản thân nó không bao giờ chủ động dừng sớm), `combiner` (tùy chọn, cần cho parallel stream), và `finisher` (gọi một lần khi nguồn cạn để xả state tồn đọng).

> Trong Java 24+, Gatherers đã **ổn định** (không phải preview). Prefers built-in `Gatherers.*` trước khi custom.

---

## 10. Pitfalls (Bẫy)

1. **Reuse stream đã consumed** — sau terminal, gọi lại → `IllegalStateException`. Tạo stream mới từ nguồn mỗi lần.
2. **Side-effect trong `map` / `filter` / `peek`** — mutate shared state, I/O, logging “làm việc thật” → khó debug; parallel thì race. Side-effect chỉ thuộc terminal có chủ đích (`forEach`) hoặc collector.
3. **Parallel mặc định** — trên OpenJDK, `parallelStream()` thường dùng common pool (xem §8); dataset nhỏ / I/O blocking / shared mutable thường **chậm hơn hoặc sai**. Prefer sequential + virtual threads cho I/O — [threading.md](threading.md).
4. **`forEach` + collection không thread-safe** trên parallel — dùng concurrent collector / `forEachOrdered` / serial.
5. **Không đóng resource gốc** — `Files.lines` cần đóng stream; với `BufferedReader.lines`, phải đóng **reader** (đóng stream không tự đóng reader). Dùng try-with-resources cho đúng owner.
6. **NPE nguồn** — `list.stream()` khi `list == null`; dùng empty collection hoặc `Stream.ofNullable`.
7. **`peek` không chắc chạy** — pipeline có thể bỏ qua intermediate operations nếu suy ra được kết quả (ví dụ `count()` trên nguồn có size đã biết); terminal không bảo đảm mọi callback đã chạy.
8. **`findFirst`/`findAny` gặp null** — ném NPE nếu phần tử được chọn là null; lọc null khi contract yêu cầu. `allMatch`/`noneMatch` trên stream rỗng trả true, `anyMatch` trả false.

```java
Stream<String> s = list.stream().map(String::trim);
s.toList();
// s.count(); // IllegalStateException — đã consumed
```

---

## 11. Best practices

- Giữ pipeline **đọc được**: tách method references / named predicates khi lambda dài.
- Prefer `toList()` (unmodifiable) khi không cần mutate; `collect(toCollection(...))` khi cần kiểu cụ thể.
- Short-circuit sớm (`filter` trước `sorted`/`map` đắt).
- Parallel chỉ khi đo được lợi ích CPU-bound; đo trên workload thật.
- Gatherers (24+): dùng `Gatherers.*` built-in trước khi custom — mục 9.

```java
Stream.ofNullable(maybeNull);          // 0 hoặc 1
Optional.ofNullable(x).stream();
```

---

## 12. Cheat sheet ↔ LINQ

| LINQ | Stream |
|------|--------|
| `Where` | `filter` |
| `Select` | `map` |
| `SelectMany` | `flatMap` |
| `OrderBy` | `sorted(Comparator.comparing(...))` |
| `Distinct` | `distinct` |
| `Take` / `Skip` | `limit` / `skip` |
| `GroupBy` | `collect(groupingBy(...))` |
| `Aggregate` | `reduce` / `collect` |
| `Any` / `All` | `anyMatch` / `allMatch` |
| `First` / `FirstOrDefault` | `findFirst` + Optional |
| `ToList` | `toList()` / `collect(toList())` |
| `AsParallel` | `parallel()` / `parallelStream()` |

```java
// Tương đương LINQ method chain điển hình
var q = people.stream()
        .filter(p -> p.age() >= 18)
        .sorted(Comparator.comparing(Person::lastName))
        .map(p -> p.lastName() + ", " + p.firstName())
        .toList();
```

---

*Tham chiếu nhanh — Java 27. Stream từ 8; `toList()` từ 16; Gatherers final từ 24; trên HotSpot/OpenJDK, parallel stream thường dùng common ForkJoinPool.*
