# Memory, GC, FFM & Diagnostics trong Java

Tài liệu tham khảo nâng cao về **quản lý bộ nhớ trên HotSpot JVM (Java 27)**: Stack/Heap/Metaspace, Object Layout (**Compact Object Headers mặc định — JEP 534**), Garbage Collectors (**G1 mặc định mọi môi trường — JEP 523**), Escape Analysis, Reference types (`Weak`/`Soft`/`Phantom`/`Cleaner`), `ByteBuffer` & `FileChannel`, **Foreign Function & Memory (FFM) API (`java.lang.foreign`, final từ Java 22)**, `VarHandle`, và chẩn đoán bộ nhớ với **JFR (JEP 536)** / `jcmd`.

> Cross-link: [typesystem.md](typesystem.md) (primitives, boxing, EA overview) · [threading.md](threading.md) (JMM happens-before, VT pinning) · [oop.md](oop.md) (inner class leak, `Cleaner`) · [packages-modules.md](packages-modules.md) (`--enable-native-access`, AOT Cache)

---

## Mục lục

- [1. Mô hình bộ nhớ HotSpot JVM](#1-mô-hình-bộ-nhớ-hotspot-jvm)
  - [1.1 Đường đi cấp phát trên Heap: TLAB, Generational \& G1 Humongous Objects](#11-đường-đi-cấp-phát-trên-heap-tlab-generational--g1-humongous-objects)
- [2. Object Layout, Compressed OOPs \& Compact Object Headers (JEP 534)](#2-object-layout-compressed-oops--compact-object-headers-jep-534)
- [3. Escape Analysis & Scalar Replacement](#3-escape-analysis--scalar-replacement)
- [4. Garbage Collectors trên JDK 27](#4-garbage-collectors-trên-jdk-27)
- [5. Reference Types & `Cleaner`](#5-reference-types--cleaner)
- [6. `ByteBuffer`, `FileChannel` & Memory-Mapped Files](#6-bytebuffer-filechannel--memory-mapped-files)
- [7. FFM API (`java.lang.foreign`, Java 22+)](#7-ffm-api-javalangforeign-java-22)
  - [7.1 `Arena` & `MemorySegment`](#71-arena--memorysegment)
  - [7.2 `MemoryLayout`, `SequenceLayout` \& `VarHandle`](#72-memorylayout-sequencelayout--varhandle)
  - [7.3 `Linker`: Downcall, Upcall, `critical` \& `captureCallState`](#73-linker-downcall-upcall-critical--capturecallstate)
  - [7.4 Restricted methods, `reinterpret` \& `--enable-native-access`](#74-restricted-methods-reinterpret----enable-native-access)
- [8. `VarHandle` cho memory access có thứ tự](#8-varhandle-cho-memory-access-có-thứ-tự)
- [9. Chẩn đoán: JFR (JEP 536) & `jcmd`](#9-chẩn-đoán-jfr-jep-536--jcmd)
  - [9.1 Quy trình khoanh vùng Memory Leak (Shallow vs Retained Heap)](#91-quy-trình-khoanh-vùng-memory-leak-shallow-vs-retained-heap)
- [10. Memory Leaks phổ biến trên Java](#10-memory-leaks-phổ-biến-trên-java)
- [11. Pitfalls (Bẫy)](#11-pitfalls-bẫy)
- [12. Best practices & Cheat sheet](#12-best-practices--cheat-sheet)
- [Xem thêm](#xem-thêm)

---

## 1. Mô hình bộ nhớ HotSpot JVM

| Vùng nhớ | Chứa gì | Quản lý / Giới hạn |
|---|---|---|
| **Java Heap** | Mọi instance object và mảng (trừ phần bị JIT loại bỏ qua EA) | GC thu hồi; chỉnh qua `-Xms`/`-Xmx` hoặc `-XX:MaxRAMPercentage` |
| **Thread Stacks** | Frame method, local primitives, references | Per-thread (`-Xss` cho platform thread; virtual thread dùng stack chunk trên heap) |
| **Metaspace** | Class metadata, bytecode, constant pool | Native memory (`-XX:MaxMetaspaceSize`) |
| **Code Cache** | Mã máy JIT biên dịch (C1/C2) | Native memory (`-XX:ReservedCodeCacheSize`) |
| **Direct / Off-Heap** | `ByteBuffer.allocateDirect`, FFM `MemorySegment`, JNI/native | Ngoài Java heap (`-XX:MaxDirectMemorySize` cho DirectBuffer; `Arena` cho FFM) |

- **Trong container (Docker/Kubernetes):** tổng RAM tiến trình = Heap + Metaspace + Direct/Off-heap + Thread stacks + Code Cache + JVM overhead. Không bao giờ đặt `-Xmx` = 100% RAM container (thường bắt đầu ở `-XX:MaxRAMPercentage=75.0` và đo RSS thật).

### 1.1 Đường đi cấp phát trên Heap: TLAB, Generational & G1 Humongous Objects

- **TLAB (Thread-Local Allocation Buffer):** mỗi thread sở hữu một vùng nhỏ riêng trong Eden; `new Foo()` thông thường chỉ là thao tác **bump-the-pointer** (tăng con trỏ lên `size` bytes, **không cần lock** — nhanh ngang cấp phát stack C!). Chỉ khi TLAB đầy mới xin TLAB mới.
- **Giả thuyết thế hệ (Weak Generational Hypothesis):** phần lớn object chết rất trẻ (request DTO, `Iterator`, `StringBuilder`). Vì thế G1, Generational ZGC và Generational Shenandoah gom Young Gen cực nhanh (chỉ phải copy số ít object sống sót).
- **Write Barriers & Remembered Sets (RSets):** khi một object ở Old Gen trỏ sang object ở Young Gen, JVM ghi nhận tham chiếu chéo qua *card table* / *remembered set* nhờ write barrier để Young GC không phải quét toàn bộ Old Gen.
- **Bẫy G1 Humongous Objects:** trong G1, mọi object (thường là `byte[]` / `String` lớn) có kích thước **≥ 50% G1 region size** (mặc định region 1–32 MB tùy heap) được xếp vào loại **Humongous** — cấp phát thẳng vào Old Gen trên các region liên tiếp, gây phân mảnh nội bộ (một mảng 2.1 MB trên region 4 MB chiếm trọn 4 MB) và có thể kích hoạt Full GC / OOM sớm. Khắc phục: tránh gom payload khổng lồ vào một `byte[]` duy nhất (stream theo chunk), hoặc tăng `-XX:G1HeapRegionSize` có đo đạc.

---

## 2. Object Layout, Compressed OOPs & Compact Object Headers (JEP 534)

Mỗi object trên HotSpot gồm **Object Header** + **Instance Fields** (JVM tự sắp xếp lại thứ tự field từ lớn→nhỏ để giảm lỗ hổng alignment) + **Alignment Padding** (mặc định bội số 8 bytes).

- **Compact Object Headers (JEP 519 JDK 25 / mặc định từ JEP 534 JDK 27):** rút Object Header từ **12–16 bytes** xuống **8 bytes** (64-bit). Ví dụ `record Point(int x, int y)` với 2 trường `int` (8 bytes):
  - Trước JEP 534: `12B header + 8B fields + 4B padding = 24 bytes`.
  - Từ JDK 27 (JEP 534 mặc định): `8B header + 8B fields = 16 bytes` (**tiết kiệm 33%**!).
  - Tắt khi cần benchmark A/B hoặc tương thích tạm thời: `-XX:-UseCompactObjectHeaders`.
- **Compressed OOPs (`-XX:+UseCompressedOops`) & Bẫy ngưỡng ~32 GB Heap:**
  - Khi `-Xmx < ~32 GB` (chính xác là ~31.5 GB với alignment 8 bytes), HotSpot nén con trỏ object (OOP) từ **64-bit (8 bytes) xuống 32-bit (4 bytes)** nhờ dịch trái 3 bit (zero-based compressed OOPs).
  - **Bẫy kinh điển:** tăng `-Xmx` từ **30 GB lên 34 GB** làm JVM tắt Compressed OOPs → mọi reference field và phần tử mảng `Object[]` phình gấp đôi (4B → 8B), khiến **số lượng object chứa được trên heap 34 GB ít hơn cả heap 30 GB**! Hoặc giữ dưới ngưỡng ~31 GB, hoặc tăng hẳn lên ≥ 48 GB (nếu thực sự cần heap lớn).
- **False Sharing:** hai field mutable nóng nằm cùng 1 CPU cache line (thường 64 bytes) bị nhiều thread ghi đồng thời làm suy giảm throughput (JDK nội bộ dùng `@Contended`, app code thường tách `LongAdder` hoặc padding).

---

## 3. Escape Analysis & Scalar Replacement

Java **không** có `struct` / `stackalloc` kiểu C# (tới khi Project Valhalla ra mắt). Thay vào đó, JIT C2 thực hiện **Escape Analysis (EA)** lúc runtime:

| Mức độ | Ý nghĩa | Tối ưu JIT |
|---|---|---|
| **NoEscape** | Object không thoát khỏi phương thức được inline | **Scalar replacement**: phá object thành biến local/register, không cấp phát trên heap; có thể loại bỏ lock cục bộ (lock elision) |
| **ArgEscape** | Truyền làm tham số callee nhưng không lưu ra field/global | Tối ưu hạn chế hơn |
| **GlobalEscape** | Trả về từ method, gán vào field/static/array, hoặc publish sang thread khác | Cấp phát bình thường trên heap (TLAB) |

- EA là **tối ưu của JIT**, không phải đảm bảo ngôn ngữ. Mất inline (method quá lớn, megamorphic call site) có thể khiến object bất ngờ rơi ra heap.
- Đo allocation thực tế bằng **JFR** (`jdk.ObjectAllocationInNewTLAB` / `ObjectAllocationOutsideTLAB`) hoặc async-profiler.

---

## 4. Garbage Collectors trên JDK 27

| GC | Flag | Đặc điểm | Khi nào chọn |
|---|---|---|---|
| **G1 GC** | *(mặc định mọi môi trường — **JEP 523**, JDK 27)* | Region-based, cân bằng throughput & pause mục tiêu (`-XX:MaxGCPauseMillis`); cải thiện throughput ở JDK 26 (JEP 522) | Mặc định cho đa số dịch vụ backend |
| **ZGC (Generational)** | `-XX:+UseZGC` | Pause sub-millisecond gần như độc lập kích thước heap; Generational mặc định từ JDK 23 (JEP 474), bỏ non-gen từ JDK 24 (JEP 490) | Dịch vụ latency-sensitive (SLA p99 chặt), heap lớn |
| **Shenandoah** | `-XX:+UseShenandoahGC` *(+ `-XX:ShenandoahGCMode=generational`, JEP 521 từ 25)* | Concurrent compaction, pause thấp | Latency-sensitive trên distro hỗ trợ Shenandoah |
| **Parallel GC** | `-XX:+UseParallelGC` | Throughput cao nhất, chấp nhận STW pause dài hơn | Batch/ETL, công cụ xử lý offline |
| **Serial GC** | `-XX:+UseSerialGC` | Đơn luồng, footprint thấp nhất | Micro-container 1 vCPU rất nhỏ khi đo thấy lợi |

```text
# Unified GC Logging
java -Xlog:gc*:file=gc.log:time,uptime,level,tags:filecount=5,filesize=20m -jar app.jar
```

---

## 5. Reference Types & `Cleaner`

Theo độ mạnh giảm dần (trong `java.lang.ref`):

| Loại | Hành vi GC | Dùng khi |
|---|---|---|
| **Strong** (mặc định) | Không bị thu hồi khi còn reachable | Phần lớn object ứng dụng |
| **`SoftReference<T>`** | Thu hồi khi heap chịu áp lực (trước khi OOM) | Cache nhạy bộ nhớ *(nhưng thực tế nên ưu tiên cache có giới hạn kích thước như Caffeine thay vì phụ thuộc chính sách GC)* |
| **`WeakReference<T>`** | Thu hồi ngay chu kỳ GC kế tiếp khi không còn strong ref | Metadata gắn theo vòng đời key (`WeakHashMap`, canonicalizing map) |
| **`PhantomReference<T>`** | `get()` luôn trả `null`; báo qua `ReferenceQueue` khi object đã sẵn sàng giải phóng | Cơ chế nền của `Cleaner` |

### `java.lang.ref.Cleaner` (Java 9+, thay thế `finalize()`)

`Object.finalize()` đã **deprecated for removal** (JEP 421, Java 18). Cho tài nguyên native cần phương án dự phòng ngoài `AutoCloseable`:

```java
public final class NativeHandle implements AutoCloseable {
    private static final Cleaner CLEANER = Cleaner.create();

    // BẮT BUỘC là static nested class — TUYỆT ĐỐI KHÔNG capture `this`!
    private static final class State implements Runnable {
        private long address;
        State(long address) { this.address = address; }

        @Override
        public void run() {
            if (address != 0) {
                freeNative(address);
                address = 0;
            }
        }
    }

    private final State state;
    private final Cleaner.Cleanable cleanable;

    public NativeHandle(long address) {
        this.state = new State(address);
        this.cleanable = CLEANER.register(this, state);
    }

    @Override
    public void close() {
        cleanable.clean(); // gọi tối đa 1 lần, an toàn đa luồng
    }

    private static native void freeNative(long addr);
}
```

- Nếu action truyền vào `CLEANER.register(this, action)` capture `this` (như lambda `() -> free(this.addr)`), `Cleaner` giữ strong ref tới `this` → **object không bao giờ được GC**!

---

## 6. `ByteBuffer`, `FileChannel` & Memory-Mapped Files

`ByteBuffer` là abstraction vùng byte cho I/O không copy thừa (analogue gần nhất với `Span<byte>`/`Memory<byte>` trong JDK cổ điển trước khi có FFM):

```java
// Heap buffer vs Direct (off-heap) buffer
ByteBuffer heapBuf = ByteBuffer.allocate(8192);
ByteBuffer directBuf = ByteBuffer.allocateDirect(8192); // off-heap, giảm copy sang kernel

try (FileChannel ch = FileChannel.open(path, StandardOpenOption.READ)) {
    while (ch.read(heapBuf) != -1) {
        heapBuf.flip();       // chuẩn bị đọc: limit = position, position = 0
        consume(heapBuf);
        heapBuf.compact();    // dồn phần chưa đọc về đầu buffer (hoặc clear() nếu đã đọc hết)
    }
}
```

- **Byte order:** `ByteBuffer` mặc định `ByteOrder.BIG_ENDIAN` (khác đa số CPU x86/ARM là `LITTLE_ENDIAN`). Luôn gọi `.order(ByteOrder.LITTLE_ENDIAN)` nếu đọc định dạng nhị phân native.
- **Memory-mapped files:**
  - `FileChannel.map(MapMode, pos, size)` trả về `MappedByteBuffer` — **không có `unmap()` chuẩn** (phải chờ GC → khóa file trên Windows).
  - **Cách hiện đại (Java 22+):** `FileChannel.map(MapMode, offset, size, Arena)` trả về **`MemorySegment`** → unmap **tất định** ngay khi `arena.close()`!

---

## 7. FFM API (`java.lang.foreign`, Java 22+)

**Foreign Function & Memory (FFM) API** (final ở **Java 22**, [JEP 454](https://openjdk.org/jeps/454)) thay thế an toàn cho JNI và `sun.misc.Unsafe`: không cần viết code C glue, có kiểm tra biên (bounds check) và kiểm tra vòng đời (temporal safety).

### 7.1 `Arena` & `MemorySegment`

`Arena` quản lý vòng đời (temporal scope) của các `MemorySegment` được cấp phát từ nó:

| Loại `Arena` | Đóng tường minh? | Thread truy cập | Dùng khi |
|---|---|---|---|
| `Arena.ofConfined()` | Có (`try-with-resources`) | Chỉ 1 thread sở hữu (nhanh nhất) | Buffer/native call cục bộ trong 1 request/task |
| `Arena.ofShared()` | Có (`try-with-resources`) | Đa luồng an toàn | Chia sẻ vùng nhớ off-heap giữa nhiều thread |
| `Arena.ofAuto()` | Không (GC tự giải phóng) | Đa luồng | Vùng nhớ sống gắn vòng đời object Java |
| `Arena.global()` | Không bao giờ giải phóng | Đa luồng | Hằng số native, thư viện sống suốt vòng đời JVM |

```java
try (Arena arena = Arena.ofConfined()) {
    // Cấp phát 1024 bytes off-heap, tự giải phóng khi thoát try
    MemorySegment seg = arena.allocate(1024);
    seg.set(ValueLayout.JAVA_INT, 0, 42);
    int v = seg.get(ValueLayout.JAVA_INT, 0);

    // Zero-copy slice (tương tự Span.Slice trong C#)
    MemorySegment slice = seg.asSlice(4, 16);

    // Cấp phát chuỗi C (null-terminated UTF-8)
    MemorySegment cStr = arena.allocateFrom("hello");
    String back = cStr.getString(0);
}
// Mọi truy cập vào seg/slice sau try → IllegalStateException (chống use-after-free!)
```

- `MemorySegment.ofArray(byte[])` cho phép bọc mảng Java trên heap thành `MemorySegment` để xử lý đồng nhất với off-heap.

### 7.2 `MemoryLayout`, `SequenceLayout` & `VarHandle`

Mô tả cấu trúc C `struct Point { int x; int y; };` và **mảng struct `Point[N]`** không tính offset thủ công:

```java
StructLayout POINT_LAYOUT = MemoryLayout.structLayout(
        ValueLayout.JAVA_INT.withName("x"),
        ValueLayout.JAVA_INT.withName("y")
);
SequenceLayout POINTS_ARRAY = MemoryLayout.sequenceLayout(100, POINT_LAYOUT);

VarHandle X_ELEM = POINTS_ARRAY.varHandle(
        MemoryLayout.PathElement.sequenceElement(),
        MemoryLayout.PathElement.groupElement("x"));
VarHandle Y_ELEM = POINTS_ARRAY.varHandle(
        MemoryLayout.PathElement.sequenceElement(),
        MemoryLayout.PathElement.groupElement("y"));

try (Arena arena = Arena.ofConfined()) {
    MemorySegment points = arena.allocate(POINTS_ARRAY);
    for (long i = 0; i < 100; i++) {
        X_ELEM.set(points, 0L, i, (int) i);
        Y_ELEM.set(points, 0L, i, (int) (i * 2));
    }

    // Bulk copy giữa off-heap và mảng Java (không tạo vòng lặp từng phần tử)
    int[] firstTwoInts = new int[2];
    MemorySegment.copy(points, ValueLayout.JAVA_INT, 0L, firstTwoInts, 0, 2);
}
```

- Với `struct` có trường khác kích thước (vd. `byte` + `long`), cần tự chèn `MemoryLayout.paddingLayout(7)` đúng theo quy tắc alignment của ABI C để khớp kích thước thật.

### 7.3 `Linker`: Downcall, Upcall, `critical` & `captureCallState`

#### 1. Downcall (Java gọi hàm C)

```java
Linker linker = Linker.nativeLinker();
SymbolLookup stdlib = linker.defaultLookup();

MemorySegment strlenAddr = stdlib.find("strlen").orElseThrow();
FunctionDescriptor desc = FunctionDescriptor.of(ValueLayout.JAVA_LONG, ValueLayout.ADDRESS);
MethodHandle strlen = linker.downcallHandle(strlenAddr, desc);

try (Arena arena = Arena.ofConfined()) {
    MemorySegment cStr = arena.allocateFrom("Java 27");
    long len = (long) strlen.invokeExact(cStr); // 7L
}
```

#### 2. Upcall Stub (C gọi ngược hàm Java — vd. truyền comparator cho `qsort`)

```java
static int compareInts(MemorySegment a, MemorySegment b) {
    return Integer.compare(a.get(ValueLayout.JAVA_INT, 0), b.get(ValueLayout.JAVA_INT, 0));
}

FunctionDescriptor cmpDesc = FunctionDescriptor.of(
        ValueLayout.JAVA_INT,
        ValueLayout.ADDRESS.withTargetLayout(ValueLayout.JAVA_INT),
        ValueLayout.ADDRESS.withTargetLayout(ValueLayout.JAVA_INT));
MethodHandle cmpHandle = MethodHandles.lookup().findStatic(
        Demo.class, "compareInts", MethodType.methodType(int.class, MemorySegment.class, MemorySegment.class));

try (Arena arena = Arena.ofConfined()) {
    // Upcall stub sống đúng bằng vòng đời arena
    MemorySegment cmpStub = linker.upcallStub(cmpHandle, cmpDesc, arena);
    // Truyền cmpStub như function pointer vào downcall qsort(...)
}
```

#### 3. `Linker.Option.critical(...)` & `captureCallState("errno")`

- **`Linker.Option.critical(boolean allowHeapAccess)`:** dành cho hàm C **cực ngắn, không gọi ngược Java (no upcall), không block** (như hash/SIMD/toán học):
  - Bỏ chi phí chuyển trạng thái safepoint JVM → độ trễ downcall gần bằng gọi hàm Java nội bộ.
  - Khi truyền `critical(true)`, cho phép truyền **trực tiếp heap `MemorySegment`** (`MemorySegment.ofArray(byte[])`) xuống C mà không cần copy ra off-heap!
- **`Linker.Option.captureCallState("errno")`:** trên Virtual Threads, thread có thể đổi carrier giữa hai lệnh gọi nên gọi hàm lấy `errno` tách rời là sai! Option này lưu ngay `errno` (hoặc `"GetLastError"` trên Windows) vào một `MemorySegment` riêng ngay khi hàm C vừa return:

```java
Linker.Option ccs = Linker.Option.captureCallState("errno");
StructLayout stateLayout = Linker.Option.captureStateLayout();
VarHandle errnoHandle = stateLayout.varHandle(MemoryLayout.PathElement.groupElement("errno"));
// Truyền thêm captureState segment làm đối số đầu tiên cho downcallHandle(..., ccs)
```

- Thư viện C lớn: dùng công cụ `jextract` để tự sinh bindings từ file `.h`.

### 7.4 Restricted methods, `reinterpret` & `--enable-native-access`

Các thao tác phá vỡ ranh giới an toàn (`Linker.downcallHandle`, `MemorySegment.reinterpret`) là **restricted methods** (JEP 472):
- **Quản lý con trỏ do C cấp phát (`malloc`/`free`):** con trỏ trả về từ hàm C có kích thước mặc định `0` (không đọc/ghi được trực tiếp). Dùng **`reinterpret(size, arena, cleanup)`** để gắn kích thước hợp lệ và callback giải phóng (`free`) chạy tự động khi `arena.close()`:

```java
// Gắn vòng đời của con trỏ trả từ malloc vào Arena (restricted method)
MemorySegment owned = rawPtr.reinterpret(byteSize, arena, ptr -> callNativeFree(ptr));
```

- Trên JDK 24+, gọi restricted method mà không cấp quyền sẽ phát cảnh báo (và bản tương lai sẽ ném `IllegalCallerException`). Cấp quyền rõ theo module hoặc classpath:

```text
java --enable-native-access=ALL-UNNAMED ...
java --enable-native-access=com.example.nativelib ...
```

- Lưu ý trên Virtual Threads: lời gọi native downcall dài vẫn có thể **pin** carrier thread — đo bằng JFR `jdk.VirtualThreadPinned` ([threading.md](threading.md#3-pinning-trên-virtual-threads)).

---

## 8. `VarHandle` cho memory access có thứ tự

`java.lang.invoke.VarHandle` (Java 9+) thay thế an toàn cho `sun.misc.Unsafe` khi cần truy cập atomic / acquire-release / opaque trên field, mảng hoặc `MemorySegment`:

```java
private static final VarHandle COUNT;
static {
    try {
        COUNT = MethodHandles.lookup().findVarHandle(Counter.class, "count", int.class);
    } catch (ReflectiveOperationException e) {
        throw new ExceptionInInitializerError(e);
    }
}

private int count;
public int inc() {
    return (int) COUNT.getAndAdd(this, 1); // CAS / atomic không cần bọc AtomicInteger
}
```

Các chế độ truy cập: `Plain` → `Opaque` → `Acquire`/`Release` → `Volatile` (mạnh nhất, tương đương field `volatile`) + các phép CAS (`compareAndSet`, `weakCompareAndSetPlain`, `getAndAdd`).

---

## 9. Chẩn đoán: JFR (JEP 536) & `jcmd`

**JDK Flight Recorder (JFR)** chạy trực tiếp trên production với overhead thấp (~1%):

```text
# Bật ghi từ lúc chạy
java -XX:StartFlightRecording=filename=app.jfr,settings=profile,dumponexit=true -jar app.jar

# Ghi nóng 60 giây không cần restart
jcmd <pid> JFR.start name=diag duration=60s settings=profile filename=diag.jfr
```

- **JEP 536 — JFR In-Process Data Redaction (JDK 27):** JFR tự động che (redact) dữ liệu nhạy cảm (env vars, system properties, command-line args khớp `*password*`, `*token*`, `*secret*`…) **ngay trong bộ nhớ JVM** trước khi ghi file `.jfr`. Mở rộng pattern:

```text
java -XX:FlightRecorderOptions:redact-key=+*confidential*,+*api_key* -jar app.jar
```

- **Lệnh `jcmd` thiết yếu:**

```text
jcmd <pid> Thread.dump_to_file -format=json threads.json  # Thread dump hỗ trợ đầy đủ Virtual Threads
jcmd <pid> GC.class_histogram                             # Đếm object theo class (nhẹ hơn heap dump)
jcmd <pid> GC.heap_dump heap.hprof                        # Full heap dump (cẩn thận pause trên heap lớn)
jcmd <pid> VM.native_memory summary                       # Native Memory Tracking (cần -XX:NativeMemoryTracking=summary)
```

### 9.1 Quy trình khoanh vùng Memory Leak (Shallow vs Retained Heap)

- **Shallow Heap:** kích thước bản thân object (header + fields). Một `ArrayList` chỉ tốn ~24 bytes shallow heap.
- **Retained Heap:** tổng bộ nhớ sẽ được giải phóng nếu object đó bị GC thu hồi (tính cả toàn bộ đồ thị con chỉ reachable qua nó). Một `ArrayList` nhỏ có thể giữ **2 GB retained heap**.
- **GC Roots:** biến local trên stack các thread đang sống, trường `static`, lớp đã nạp bởi bootstrap/system classloader, JNI global references.

**Quy trình 4 bước điều tra leak trên production:**
1. **Phân biệt Heap vs Native leak:** đối chiếu biểu đồ Heap (JFR / metrics) với RSS của OS; nếu Heap phẳng mà RSS tăng → bật `-XX:NativeMemoryTracking=summary` và chạy `jcmd <pid> VM.native_memory baseline` → `summary.diff` (tìm DirectBuffer, `Arena`/FFM, Metaspace, thread stacks).
2. **Chụp histogram chênh lệch (nhẹ, ít pause):** chạy `jcmd <pid> GC.class_histogram` ở mốc `t0` và `t0 + 15m` để xem class nào tăng liên tục sau nhiều chu kỳ GC.
3. **Bật JFR Allocation Profiling:** xem stack trace chính xác nơi tạo ra các object tăng trưởng (sự kiện `jdk.OldObjectSample` theo dõi trực tiếp các object sống dai lên Old Gen với overhead cực nhỏ).
4. **Full Heap Dump (khi cần đường giữ tham chiếu):** `jcmd <pid> GC.heap_dump heap.hprof`, mở bằng Eclipse MAT / JProfiler → xem **Dominator Tree** (sắp theo *Retained Heap*) → *Path to GC Roots (exclude weak/soft references)* để tìm chính xác biến/collection đang ghim bộ nhớ.

---

## 10. Memory Leaks phổ biến trên Java

GC chỉ thu hồi object **không còn reachable**. Leak trong Java là giữ reference sống lâu hơn vòng đời logic:

1. **Collection `static` tăng vô hạn** (cache tự viết không có eviction/TTL).
2. **Listener / callback không unregister**, đặc biệt non-static inner class hoặc lambda capture `this` ([oop.md](oop.md#82-bẫy-inner-giữ-outer--memory-leak)).
3. **`ThreadLocal` không gọi `remove()`** trên thread pool tái sử dụng — giữ cả value lẫn classloader.
4. **Không đóng resource (`AutoCloseable`)** — file descriptor, `Files.walk`/`Files.lines` stream, `HttpClient` body stream, `Arena.ofConfined()`.
5. **`Cleaner` action capture `this`** — tạo vòng giữ strong reference bất tử.
6. **Direct buffer / Off-heap không kiểm soát** — heap trông rỗng nhưng RSS container tăng vọt → bị OOMKilled.

---

## 11. Pitfalls (Bẫy)

1. **Đặt `-Xmx` bằng 100% RAM container** — thiếu chỗ cho Metaspace, off-heap, stacks, JIT → OOMKilled.
2. **Dùng `sun.misc.Unsafe` cho code mới** — đang bị loại bỏ dần (JEP 471/498); chuyển sang FFM (`MemorySegment`) và `VarHandle`.
3. **Truy cập `MemorySegment` sau khi đóng `Arena`** — ném `IllegalStateException` (hoặc truyền nhầm `Arena.ofConfined()` sang thread khác → `WrongThreadException`).
4. **Quên `ByteBuffer.flip()` / `compact()` hoặc sai `ByteOrder`** — đọc sai vùng dữ liệu / ngược endianness.
5. **Dùng `MappedByteBuffer` thay vì `FileChannel.map(..., Arena)`** — file bị khóa trên Windows tới khi GC thu hồi buffer.
6. **Phụ thuộc `SoftReference` làm cache production** — GC xóa đột ngột gây cache stampede; dùng cache có kích thước giới hạn rõ.
7. **Dùng `jstack` cho ứng dụng Virtual Threads** — không hiện đủ cây VT → dùng `jcmd <pid> Thread.dump_to_file`.
8. **Gọi `System.gc()` trong code ứng dụng** — gây STW pause không cần thiết, không giải quyết leak thật.

---

## 12. Best practices & Cheat sheet

- [ ] Bắt đầu với G1 mặc định (JEP 523) + Compact Object Headers mặc định (JEP 534); chỉ chuyển ZGC/Shenandoah khi có số liệu p99/GC log chứng minh.
- [ ] Trong container, dùng `-XX:MaxRAMPercentage` và bật `-XX:NativeMemoryTracking=summary` khi nghi rò native memory.
- [ ] Off-heap & gọi C mới → dùng **FFM API (`Arena` + `MemorySegment` + `Linker`)** thay JNI/`Unsafe`, bật `--enable-native-access` theo module hẹp nhất.
- [ ] Memory-mapped file → dùng `FileChannel.map(..., Arena)` để unmap tất định.
- [ ] Tài nguyên cần fallback cleanup → `AutoCloseable` + `Cleaner` với `static` state class không capture `this`.
- [ ] Chẩn đoán CPU/allocation/pinning bằng **JFR** (tận dụng JEP 536 redaction) và `jcmd`.

```text
# Cheat sheet chẩn đoán nhanh trên JDK 27
java -XX:MaxRAMPercentage=75.0 -Xlog:gc*:file=gc.log:time,uptime,tags -jar app.jar
jcmd <pid> JFR.start duration=60s settings=profile filename=profile.jfr
jcmd <pid> Thread.dump_to_file -format=json vt-dump.json
jcmd <pid> GC.class_histogram | head -n 30
```

---

## Xem thêm

| File | Liên quan |
|------|-----------|
| [typesystem.md](typesystem.md) | Stack/Heap, EA, primitives, boxing |
| [threading.md](threading.md) | JMM happens-before, VT pinning & JFR |
| [oop.md](oop.md) | Inner class leak, `Cleaner`, object layout |
| [packages-modules.md](packages-modules.md) | `--enable-native-access`, Project Leyden AOT Cache |
| [exceptions.md](exceptions.md) | Try-with-resources cho `Arena`, `FileChannel`, streams |

---

*Tham chiếu nhanh — Java 27. `VarHandle`/`Cleaner` từ 9; FFM API final từ 22 (JEP 454); G1 default everywhere (JEP 523), Compact Object Headers default (JEP 534) & JFR In-Process Data Redaction (JEP 536) trên JDK 27.*
