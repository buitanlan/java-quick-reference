# Stream API  

*(Pipeline, intermediate/terminal, Collectors, Optional, Gatherers — tương tự LINQ)*

`java.util.stream` (Java 8+) mang phong cách **declarative / functional** để xử lý chuỗi dữ liệu: filter, map, reduce, group — gần với LINQ to Objects trong C#. Tài liệu nhắm **Java 25 LTS** (Gatherers ổn định từ 24).

> Cross-link: [lambdas-functional.md](lambdas-functional.md) · [collections-generics.md](collections-generics.md) ·
> [threading.md](threading.md) (parallel / ForkJoin) · [async.md](async.md) · [java25.md](java25.md)

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
  - [6. Primitive streams](#6-primitive-streams)
  - [7. Optional](#7-optional)
  - [8. Parallel streams — caveats](#8-parallel-streams--caveats)
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

Stream<String> lines = Files.lines(Path.of("f.txt")); // cần close — dùng try-with-resources
try (var st = Files.lines(path)) {
    long n = st.count();
}

Stream<String> fromArr = Arrays.stream(array);
Stream.Builder<String> b = Stream.builder();
b.add("a").add("b");
Stream<String> built = b.build();
```

- `Stream.concat(a, b)` nối hai stream.
- Infinite stream (`iterate`/`generate`) **phải** có short-circuit / `limit`.

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

- `mapMulti` (Java 16): thay một số `flatMap` bằng consumer đẩy phần tử — giảm allocation trung gian.
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

- `sorted` / `distinct` trên parallel + unordered có chi phí / semantics khác.
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

List<String> list = stream.collect(toList());        // mutable ArrayList (cổ điển)
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

```java
Map<Dept, Optional<Person>> eldest = people.stream()
        .collect(groupingBy(Person::department, maxBy(Comparator.comparing(Person::age))));
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

Song song dùng **ForkJoinPool.commonPool()** (trừ khi custom).

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
// Collector song song cần CONCURRENT / UNORDERED characteristics khi phù hợp
Map<String, Long> freq = words.parallelStream()
        .collect(groupingByConcurrent(Function.identity(), counting()));
```

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

// fold / scan kiểu chạy tích lũy
var folded = Stream.of(1, 2, 3, 4)
        .gather(Gatherers.fold(() -> 0, Integer::sum))
        .findFirst(); // Optional[10]
```

Tự viết gatherer khi cần stateful intermediate phức tạp (debouncing, custom batching) mà không muốn thu thập hết rồi xử lý.

```java
// phác thảo: Gatherer.ofSequential / of — initializer, integrator, finisher
// Dùng cho hot path chỉ khi API sẵn có chưa đủ
```

> Trong Java 25, Gatherers đã **ổn định** (không phải preview). Prefers built-in `Gatherers.*` trước khi custom.

---

## 10. Pitfalls (Bẫy)

1. **Reuse stream đã consumed** — sau terminal, gọi lại → `IllegalStateException`. Tạo stream mới từ nguồn mỗi lần.
2. **Side-effect trong `map` / `filter` / `peek`** — mutate shared state, I/O, logging “làm việc thật” → khó debug; parallel thì race. Side-effect chỉ thuộc terminal có chủ đích (`forEach`) hoặc collector.
3. **Parallel mặc định** — `parallelStream()` dùng **common ForkJoinPool**; dataset nhỏ / I/O blocking / shared mutable thường **chậm hơn hoặc sai**. Prefer sequential + virtual threads cho I/O — [threading.md](threading.md).
4. **`forEach` + collection không thread-safe** trên parallel — dùng concurrent collector / `forEachOrdered` / serial.
5. **Không đóng** `Files.lines` / `BufferedReader.lines` — rò tài nguyên; luôn try-with-resources.
6. **NPE nguồn** — `list.stream()` khi `list == null`; dùng empty collection hoặc `Stream.ofNullable`.

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

*Tham chiếu nhanh — Java 25 LTS. Stream từ 8; `toList()` từ 16; Gatherers final từ 24; parallel vẫn dùng common ForkJoinPool.*
