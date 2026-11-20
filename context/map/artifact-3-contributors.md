# Artefakt 3: Kontrybutorzy (kto wie co, na podstawie historii Gita)

Raport roboczy dla agenta. Stan na 2026-11-20.
- **Źródła:** `git log`, `git show`, `git blame` (tylko odczyt).
- **Stan repo:** `be1eb26` (plik jest jeszcze nieśledzony). Kod produktu jest taki sam jak w stanach T1 i T2.
- **Obszary:** numeracja 1–5 z tego pliku przechodzi na `areas.md` tak: 1 = A6, 2 = A1, 3 = X1, 4 = X2, 5 = P1. Obszary A3, A4, A7, A8 i testy z P1 są w sekcji 2a.
- **Odwołania:** `artifact-1-territory.md` = **T1**, `artifact-2-structure.md` = **T2**, `U<n>` = unknowns z T2.
- **Tylko nazwy autorów,** bez adresów e-mail.

## 1. Najważniejsze obserwacje

1. **Stały zespół to 3 maintainerów:** Dave Syer, Patrick Baumgartner i Stéphane Nicoll. W 2026 doszło 14 zewnętrznych autorów, prawie wszyscy z 1–3 commitami. Dave Syer jako committer przyjął **wszystkie** zewnętrzne PR-y z 2026 (ostatni 2026-09-29). Domyślnie to on jest recenzentem w każdym obszarze.
2. **Repo nie ma formalnych właścicieli.** Brak CODEOWNERS, MAINTAINERS i `<developers>` w `pom.xml`. Tagi `@author` w `owner/` i `model/` to autorzy sprzed historii Gita i nie zgadzają się z historią zmian.
3. **Wiedza o przypadkach brzegowych jest jednorazowa.** Każdą poprawkę z fali utwardzania w 2026Q3 zrobiła inna osoba, zwykle w jedynym swoim commicie w repo. Sama wiedza o regule unikalności imienia zwierzęcia jest u jednej osoby: Shivram (`e0db9b1`).
4. **Uzasadnienie dzisiejszego schematu jest w dużej części u nieaktywnych autorów.** Według `blame` Costin Leau (2010) i Fabian Muscariello (2021) mają ok. 42% linii `db/`, a Costin Leau 45% linii w obszarze walidacji ↔ kolumn.
5. **Build to jedyny obszar wyraźnie skupiony.** Przy 3 maintainerach to norma, a nie ryzyko. Jako autor w ostatnim półroczu commitował tylko Patrick Baumgartner (2026-06-11). Dave Syer był w tym czasie aktywny wyłącznie jako committer (do 2026-09-29), a jego ostatni commit jako autor jest z 2026-04-20.

## 2. Wybrane obszary

| # | Ścieżki | Funkcja | Sygnały |
|---|---------|---------|---------|
| 1 | `src/main/resources/db/{h2,mysql,postgres}/`, `application-{mysql,postgres}.properties` | schemat i dane trzech dialektów | Jedyna regresja w oknie: `e0db9b1` → `88e37c1` (T1 d)). 50% poprawek. Dialekty zmieniły się razem tylko raz (T1 e)). Obszar niewidoczny dla jdeps (U19, U23, U24). Brak testu idempotentności (T2 §7 #2). |
| 2 | `owner/Owner.java`, `OwnerRepository.java`, `OwnerController.java`, `templates/owners/` | właściciele; zapis zwierząt i wizyt przez kaskadę | Najwięcej commitów (8) i 63% poprawek (T1 a), d)). `Owner` ma Ca 4 i jest jedyną ścieżką zapisu (T2 §1, §6). Powtarzalna para właściciele–zwierzęta (T1 e)). Kaskada mockowana w `@WebMvcTest` (T2 §7 #3). |
| 3 | `owner/PetController.java`, `PetControllerTests`, `PetClinicConcurrencyTests`, `service/ClinicServiceTests`, indeks `unique_owner_pet_name` w trzech `schema.sql` (`PetValidator` i `Pet.java` nie biorą udziału, T2 §1.5) | unikalne imię zwierzęcia u właściciela | `PetController` ma Ce 6 (T2 §6). Reguła rozpoznaje naruszenie po napisie `unique_owner_pet_name` (U24). Najszerszy feature w oknie (T1 e)). Testy tylko na H2 (T2 §7 #1). Ryzyko pierwszego cyklu JPA (T2 §4). |
| 4 | `model/{Person,NamedEntity,BaseEntity}.java`, `@Size` w `Owner`/`Pet`/`Visit`, trzy `schema.sql` | walidacja ↔ długość kolumn | Ta sama poprawka w 4 encjach (T1 d)). `model` ma Ca 7 (T2 §6). `NamedEntity` nie ma `@Size`, a kolumny mają różne długości (T2 §3). Brak testu zgodności z kolumną (T2 §7 #5, U23). |
| 5 | `pom.xml`, `build.gradle`, wrappery, `application.properties` | build, upgrade'y, globalne JPA | `pom.xml` to jedyny prawdziwy węzeł, 10 commitów (T1 f)). Oba reverty w oknie (T1 d)). `application.properties` działa na wszystkie encje. Dryf Maven/Gradle (U34). |

## 2a. Pozostałe obszary (uzupełnienie)

Filtry jak w §6: bez merge'y i bez `44d5f21`, `37c7f98`, `3e1ce23`. **Linie z `blame -w -M -C` liczone bez `--ignore-rev`**, więc nie da się ich porównać wprost z liniami z §5. Emoji jak w §3.

| Obszar (`areas.md`) | 12 mies. (commity) | 36 mies. | Linie dziś (top 3) | Kogo zapytać |
|---|---|---|---|---|
| A3 Wizyty | Ayush Keshri 1 (`f3c7483`), shivam tiwari 1 (`753d35c`), Dave Syer 1 (`c7ee170`) | Baumgartner 5, Syer 3 | Syer 90, Costin Leau 78, Baumgartner 34 | shivam tiwari 🟢 2026-06-01 (data wizyty, `minVisitDate`), Ayush Keshri 🟢 2026-09-18 (długość opisu); zapasowo Syer 🟡 |
| A4 Weterynarze | Pedro Arthur Hartmann 2 (`500158f`, `b33136f`), king-407 1 (`1312314`) | Baumgartner 5, anizmo 2, Hartmann 2 | Costin Leau 145, Syer 108, Mic 63 | Hartmann 🟢 2026-09-29 (paginacja). Cache (U36) i XML: nikt aktywny, najbliżej Syer 🟡 |
| A7 System + i18n | 5 osób po 1 commicie: shivam tiwari (`753d35c`), Robinson J (`0f6e861`, japoński), Prajwalraut29 (`51045d1`), Jaguar-H (`f182358`, hindi), Baumgartner (`37d5315`) | Baumgartner 8, Anyul Rivas 4, Syer 3 | anizmo 521 (głównie tłumaczenia), Syer 119, Costin Leau 78 | wiedza **rozproszona**; i18n jako całość: anizmo (poza oknem 12 mies.) |
| A8 Start i obraz natywny | Viktar Patotski 1 (`a2c2ef9`, współautor AI), Baumgartner 1 (`9a5d50c`) | Baumgartner 3, Syer 2 | Mic 24, Antoine Rey 18, Deleuze 13 | Patotski 🟢 2026-05-27 (hinty `db/`); U28 `mysql-default-conf`: Syer (`c231682`, 2023) |
| P1 Testy integracyjne | Baumgartner 3, Syer 2, Shivram 1 | Baumgartner 12, Syer 4 | Syer 203, Shivram 126, Nicoll 92 | Baumgartner 🟢 (upgrade'y, obrazy baz), Syer 🟡 (docker compose, `e316074`) |

## 3. Kogo zapytać

Oznaczenia: 🟢 ostatni commit w repo ≤ 6 mies. temu, 🟡 6–12 mies., ⚪ ponad 12 mies. Data to data autora ostatniego commita w całym repo.

| Obszar | Osoba | Tematy | Przykładowe commity | Ostatni commit |
|---|---|---|---|---|
| 1 `db/` | Michael Popov | idempotentność DDL na PostgreSQL, poprawka awaryjna | `88e37c1` issue #2584: fix relation "unique_owner_pet_name" already exists | 🟢 2026-07-22 |
| | Dave Syer | skrypty MySQL bez roota, idempotentne dane Postgresa | `5d57e0d` Re-organise mysql scripts…, `5ecaccf` Make postgres data.sql properly idempotent | 🟡 2026-04-20 (committer do 2026-09-29) |
| | Stéphane Nicoll | schemat H2, usunięcie HSQLDB | `c0847b7` Add support for H2, `2beb238` Remove outdated references to HSQLDB | 🟡 2026-01-02 |
| 2 `Owner` | Pedro Arthur Hartmann | paginacja, overflow danych wejściowych (też w `vet/`) | `0d064b0` adding integer overflow mitigations…, `500158f` added redirection… out of bounds | 🟢 2026-09-29 |
| | Zaid1681 | agregat `Owner.addPet`, `isNew()` | `676db04` Fix persisted pet association and enforce pet name length | 🟢 2026-08-11 |
| | Dave Syer | modularyzacja agregatu (2016), binder | `83ff9a5` Modularize and migrate to aggregate-oriented domain, `c7ee170` Be more careful with allowed fields in binders | 🟡 2026-04-20 |
| 3 unikalność | Shivram | reguła w kontrolerze, indeks w 3 schematach, test współbieżności | `e0db9b1` Enforce unique pet names per owner | 🟢 2026-07-14 |
| | sumituppal03 | testy duplikatu przy edycji | `b3ee2c5` Add test for duplicate pet name during update, `b11afec` | 🟢 2026-06-17 |
| | Dave Syer | committer `e0db9b1` i `88e37c1` | – | 🟡 2026-04-20 |
| 4 walidacja | Rennan Ballaro Gomes de Sousa | `@Size` ↔ kolumny, HTTP 500 | `3c7ab98` Prevent HTTP 500 when owner city/address exceed column length | 🟢 2026-09-28 |
| | Ayush Keshri | walidacja `Visit` | `f3c7483` Validate visit description length | 🟢 2026-09-18 |
| | Thomas Schmidt | `@Size` na `Person` | `3c06fbf` fix: add @Size validation on Person firstName and lastName | 🟡 2026-04-13 |
| 5 build | Patrick Baumgartner | Boot 4.0 i 4.1, obrazy baz, Gradle, SBOM | `9a5d50c` Upgrade to Spring Boot 4.1, `a50bfb6` …adding Gradle build…, `c71ccfd` Revert checkstyle to latest v12 | 🟢 2026-06-11 |
| | Dave Syer | Java 17, konfiguracja Hibernate | `828940e` Support building with Java 17, `e316074` Set fetch size for Hibernate | 🟡 2026-04-20 |
| | Stéphane Nicoll | upgrade'y Boot, Maven i Gradle, flagi kompilatora | `fc1c749` Revert removal of --release 17, `6feeae0` Switch to building the project with Java 25 | 🟡 |

**Wiedza historyczna (⚪), gdy powyższe osoby nie wystarczą:**
- YiXuan Ding (2024-11): repozytoria Spring Data, walidacja duplikatu imienia. Commity: `668629d`, `1cad412`, `50866de`.
- Fabian Muscariello (2021-12): dodanie PostgreSQL (`ce626da`).
- Shaan Sapra (2022-01): schemat Postgresa bez DROP (`43beff9`).
- Sébastien Deleuze (2024-09): wyłączenie Open Session In View (`d90e284`).
- thomasperkins1123 (2024-02): wspólny checkstyle dla Maven i Gradle (`a2f1ad5`).
- Philippe Marschall (🟡 2025-12): strategia nazw snake_case (`fd4361b`).

## 4. Do przeczytania przed zmianą

Numery `#`/`gh-` pochodzą z treści commitów. Nie sprawdzałem ich na GitHubie.

| Obszar | Commit / ref | Co zawiera |
|---|---|---|
| 1 | `88e37c1` (issue #2584) | Regresja indeksu przy `sql.init.mode=always` na Postgresie. Poprawka uczyniła indeksy idempotentnymi. |
| 1 | `e0db9b1` | Wzorzec zmiany schematu: indeks w trzech dialektach naraz. |
| 1 | `5ecaccf` (#936), `43beff9` | Idempotentność danych Postgresa i rezygnacja z DROP schematu. |
| 1 | `ce626da` (#636), `c0847b7` (gh-584) | Decyzje o dialektach Postgres i H2. W H2 jest `VARCHAR_IGNORECASE`. |
| 1 | `5d57e0d`, `8f08b38` | Użytkownik MySQL bez roota, zgodność z MySQL 8+. |
| 1 | `2beb238` (gh-2165) | Usunięcie czwartego dialektu (HSQLDB). |
| 2 | `83ff9a5` | Decyzja o agregacie: brak repozytoriów dla `Pet` i `Visit`. |
| 2 | `676db04` | `Owner.addPet` i `isNew()`: zdublowane zwierzę. |
| 2 | `0d064b0` → `500158f` (+ `b33136f` w `vet/`) | Paginacja: clamp, a potem redirect. Bliźniak w `VetController`. |
| 2 | `bb37aad`, `1cad412` | `strip()` nazwiska, `findByLastNameStartingWith`. |
| 2 | `c7ee170` | `setDisallowedFields("id", "*.id")` w trzech kontrolerach. |
| 3 | `e0db9b1`, `88e37c1` | Reguła po napisie z SQL i jej regresja. |
| 3 | `50866de`, `2aa53f9` (#1752) | Wcześniejsza walidacja duplikatu, poprawka edycji zwierzęcia. |
| 3 | `b3ee2c5`, `b11afec` | Przypadki brzegowe edycji z tym samym imieniem. |
| 4 | `3c7ab98`, `f3c7483`, `3c06fbf`, `676db04` | Ten sam wzorzec `@Size` = kolumna w `Owner`, `Visit`, `Person` i `Pet`. Limit `Pet` jest w `PetValidator` (U30). |
| 4 | `753d35c` | Walidacja daty: encja, klucz `messages_*` i fragment `inputField.html`. |
| 4 | `fd4361b` | snake_case: nazwy kolumn wynikają z nazw pól (U20). |
| 5 | `37d5315`, `9a5d50c` | Migracje Boot 4.0 i 4.1, z zakresem zmian w testach integracyjnych. |
| 5 | `fc1c749` (gh-2133), `828940e` (#2136) | Java 17 i `--release 17`. |
| 5 | `c71ccfd` | Revert zbyt świeżego checkstyle. |
| 5 | `e316074` (#2157), `d90e284` | Globalne JPA: fetch size i Open Session In View. |

## 5. Rozkład wiedzy

„Osoby na 80%” to liczba osób, które zrobiły ≥ 80% wartości w kolejnych miarach: commity w 12 mies. / commity w dłuższym oknie / linie dzisiejszego kodu (`blame`).

| Obszar | Ocena | Osoby na 80% | Komentarz |
|---|---|:-:|---|
| 1 `db/` | **rozproszona** | 4 / 8 / 4 | Każda zmiana pochodzi od innej osoby. ~42% linii mają nieaktywni autorzy. Aktywne punkty odniesienia: Syer, Nicoll. |
| 2 `Owner` | **rozproszona** | 5 / 9 / 10 | Nikt nie ma ponad 20% linii. Najwięcej ma Dave Syer (🟡). |
| 3 unikalność | **skupiona** | 5 / 8 / 7 | Miary plikowe są rozproszone, ale samą regułę zna jedna osoba (Shivram, 🟢, jeden commit w repo). Zapasowo: Dave Syer. |
| 4 walidacja | **rozproszona** | 8 / 11 / 5 | Po 1 commicie na osobę i encję. Nikt nie zna konwencji jako całości. Przewaga Costina Leau w liniach to dziedziczony schemat. |
| 5 build | **skupiona** (norma przy 3 maintainerach) | 3 / 4 / 6 | Baumgartner 🟢, Syer 🟡 (aktywny jako committer), Nicoll 🟡. |

Żaden obszar nie spełnia kryterium „skupiona i nieaktywna”.

## 6. Metoda

- **Okno:** 12 mies. od 2025-11-20, liczone po dacie commitu, tak jak w T1. Dłuższe okna:
  - `db/`: 7 lat, bo w 12 mies. są tylko 4 commity,
  - pozostałe obszary: 36 mies., bo poprawiany kod jest starszy niż okno.
- **Odfiltrowane:**
  - boty jako autorzy: 0 (w całej historii brak `*[bot]`, dependabota i renovate),
  - agenci jako autorzy: 0,
  - commity z agentem tylko jako współautorem: zostawione (`a2c2ef9` i 5 commitów `context/`, wszystkie poza obszarami),
  - merge: 1 (`ab1d536`, poza obszarami),
  - masowe przeglądy w 12 mies.: `44d5f21`, `37c7f98`, `3e1ce23`; w dłuższych oknach dodatkowo copyright, importy, NullAway, chmod i formatowanie,
  - upgrade'y i podbicia: 6 w 12 mies. i 35 w dłuższym oknie buildu. W obszarze 5 pokazane osobno, a nie usunięte,
  - dokumentacja `*.txt` w `db/`: 2 commity.
- **Klasyfikacja ręczna** (po temacie i `--stat`). Graniczne commity zostawione jako merytoryczne: `a50bfb6`, `6feeae0`, `2beb238`.
- **Zmiany ścieżek:** `git log -M --diff-filter=R` nie znalazł żadnej w oknach. Ostatnie przenosiny są z 2022 (`58fe629`) i 2016 (`83ff9a5`), więc nie było historii do łączenia.
- **Tożsamości:** repo nie ma `.mailmap`.
  - Ta sama nazwa z różnymi adresami, połączone (wniosek, wysoka pewność): Dave Syer, Patrick Baumgartner, Sébastien Deleuze, Anyul Rivas, Pedro Arthur Hartmann.
  - „Stephane Nicoll” i „Stéphane Nicoll”: połączone na podstawie wniosku.
  - „Mic” i „michaelisvy”: ten sam adres, połączenie mechaniczne.
  - Celowo rozdzielone: Shivram i shivam tiwari.
  - „Wick Dynex” w `@author` to prawdopodobnie YiXuan Ding (wniosek).
- **Linie kodu:** `git blame -w -M -C` z `--ignore-rev` dla commitów masowych i upgrade'ów. Skrypty `authors.sh` i `blame.sh` były w scratchpadzie sesji.
- **`gh` nie był używany.** Mapa opiera się wyłącznie na historii gita. Numery `#`/`gh-` z §4 nie są sprawdzone na GitHubie.

## 7. Ograniczenia

- **Formalny właściciel:** historia go nie wskazuje, a repo nie ma CODEOWNERS. „Committer” i „autor” to role w Gicie, a nie odpowiedzialność za obszar.
- **Czy ktoś nadal pracuje przy projekcie:** daty dotyczą tylko commitów w tym repo. Nie mówią o dostępności, zmianie pracy ani aktywności w issue i recenzjach. Od 2026-09-29 w repo nie ma commitów produktowych. Historia gita nie pokazuje, czy w tym czasie były zgłoszenia, których nie przyjęto.
- **Czy dawne decyzje są aktualne:** commity z lat 2016–2022 (agregat, dialekty, `sql.init.mode`) pokazują, co zrobiono, a nie czy maintainerzy nadal tego chcą.
- **Klasyfikacja i małe liczby:** podział na masowe i merytoryczne jest ręczny. Przy 4–9 commitach na obszar jeden commit zmienia wynik o osobę.
- **Ślepe punkty `blame`:** mierzy przetrwałe linie, a nie zrozumienie kodu. `-C` przypisuje skopiowane linie pierwotnym autorom.
- **Commity AI:** rozpoznawane tylko po trailerze `Co-Authored-By`.
