# Dowody: jdeps

Wygenerowano 2026-11-20 narzędziem `jdeps 17.0.21.1` (Temurin 17.0.21.1+2) z `target/classes` i `target/test-classes`. Pliki `pom.xml` i `build.gradle` nie były zmieniane.

## Środowisko

```sh
export JAVA_HOME="$HOME/.jdks/jdk-17.0.21.1+2"
export PATH="$JAVA_HOME/bin:$PATH"
java -version        # openjdk version "17.0.21.1" 2026-11-17
jdeps --version      # 17.0.21.1
```

Klasy skompilowano wcześniej poleceniem `./mvnw -B -q -Dcheckstyle.skip compile test-compile`. Checkstyle został pominięty, bo nohttp zgłasza adresy plain-HTTP (lokalny adres IP) w nieśledzonych plikach `.claude/skills/10x-observability-audit/`. Sam kod aplikacji przechodzi bez błędów.

## Komendy

Zmienne wspólne:

```sh
R='org\.springframework\.samples\.petclinic.*'
E=context/map/evidence/jdeps
```

1. Classpath zależności (170 wpisów, separator `;` na Windows):
   ```sh
   ./mvnw -q dependency:build-classpath -Dmdep.outputFile=target/cp.txt
   ```
2. Graf pakietów, kod main, do `package/`:
   ```sh
   jdeps -verbose:package --multi-release 17 --class-path "$(cat target/cp.txt)" -e "$R" -dotoutput $E/package target/classes
   ```
3. Graf klas, kod main, do `class/`:
   ```sh
   jdeps -verbose:class --multi-release 17 --class-path "$(cat target/cp.txt)" -e "$R" -dotoutput $E/class target/classes
   ```
4. Graf klas, testy, do `test/`:
   ```sh
   jdeps -verbose:class --multi-release 17 --class-path "target/classes;$(cat target/cp.txt)" -e "$R" -dotoutput $E/test target/test-classes
   ```

Przebiegi uzupełniające (powody niżej):

5. Graf klas **razem z zależnościami wewnątrz pakietu** (`-verbose`), kod main, do `class-full/`:
   ```sh
   jdeps -verbose --multi-release 17 --class-path "$(cat target/cp.txt)" -e "$R" -dotoutput $E/class-full target/classes
   ```
6. To samo dla testów, do `test-full/`:
   ```sh
   jdeps -verbose --multi-release 17 --class-path "target/classes;$(cat target/cp.txt)" -e "$R" -dotoutput $E/test-full target/test-classes
   ```
7. Graf pakietów bez filtra `-e`, czyli z zależnościami zewnętrznymi, do `package-unfiltered.txt`:
   ```sh
   jdeps -verbose:package --multi-release 17 --class-path "$(cat target/cp.txt)" target/classes > $E/package-unfiltered.txt
   ```
8. Kontrola brakujących zależności, bez filtra, bo `-e` ukrywa wiersze `not found`:
   ```sh
   jdeps -verbose:class --multi-release 17 --class-path "$(cat target/cp.txt)" target/classes | grep -i 'not found'
   jdeps -verbose:class --multi-release 17 --class-path "target/classes;$(cat target/cp.txt)" target/test-classes | grep -i 'not found'
   ```
   Oba polecenia nic nie zwróciły.

## Skrypty analityczne

Oba uruchamia się z tego katalogu. Wymagają Node, bez zależności.

- **Cykle** (silnie spójne składowe):
  ```sh
  node find-cycles.mjs class-full/classes.dot --strip-prefix org.springframework.samples.petclinic. --merge-nested
  ```
- **Metryki sprzężenia** (Ca, Ce, I), zapisane w `coupling-metrics.md`:
  ```sh
  node coupling-metrics.mjs class-full/classes.dot --test test-full/test-classes.dot \
    --classes-dir ../../../../target/classes --strip-prefix org.springframework.samples.petclinic. > coupling-metrics.md
  ```
  Liczone są tylko klasy aplikacji. `Ca_test` nie widzi `@WebMvcTest(X.class)`, więc dla kontrolerów wynosi 0, mimo że testy istnieją.
- **Diagramy Mermaid** (zamiast SVG, bo Graphviz nie jest zainstalowany), zapisane w `graphs.md`:
  ```sh
  node dot-to-mermaid.mjs package/classes.dot --extra system
  node dot-to-mermaid.mjs class-full/classes.dot --only OwnerController,PetController,VisitController,OwnerRepository,Owner,Pet,Visit
  ```

## Pokrycie: czego nie ma w grafach i dlaczego

Opcja `-e` zostawia tylko krawędzie, których **cel** jest w `petclinic.*`. Klasa, która zależy wyłącznie od JDK i Springa, nie pojawia się więc w grafie jako węzeł.

| Element | `package/` | `class/` | `class-full/` | Powód braku |
|---------|:-:|:-:|:-:|-------------|
| `owner` | tak | tylko encje | wszystkie 11 klas | `-verbose:class` pomija zależności wewnątrz pakietu, więc kontrolery, repozytoria, `PetValidator` i `PetTypeFormatter` znikają. |
| `vet` | tak | tylko `Vet`, `Specialty` | wszystkie 5 klas | Jak wyżej. |
| `model` | tak | tak | tak | |
| korzeń: `PetClinicRuntimeHints` | tak | tak | tak | |
| korzeń: `PetClinicApplication` | nie | nie | nie | Jedyne odwołanie do aplikacji to wartość adnotacji `@ImportRuntimeHints(PetClinicRuntimeHints.class)`. jdeps nie liczy jej jako zależności. W `test-full/` klasa pojawia się jako cel z testów. |
| `system` (4 klasy) | nie | nie | nie | Pakiet nie importuje żadnej klasy aplikacji, tylko Spring Web, Cache i `javax.cache`. Potwierdza to `package-unfiltered.txt`. W `test-full/` widać `system.CrashController` jako cel z testów. |

`package-info` nie jest klasą z zależnościami, więc jego brak nie ma znaczenia.

**Wniosek:** do analizy struktury używaj `class-full/` i `package/`. Brak `system` i `PetClinicApplication` oznacza brak zależności od kodu aplikacji, a nie lukę w danych.
